# Client architecture, verified against `src/RYN_Client_v4.js`

Line numbers are against `src/RYN_Client_v4.js` (the input; 25,974 lines) unless
noted. `ReUp_Mix.user.js` is the built output of `tools/build-reup.js` against
that same file, so the same line-number-adjacent structure applies there too,
shifted by whatever `build-reup.js` inserted before the point you're looking at.

## Module system: `ModuleHandler` (`class ModuleHandler`, line 18093)

Two views of the same module instances:

- **`staticModules`** (built at lines 18160-18235): a name-keyed object,
  `{ autoAccept: new AutoAccept_default(client2), ..., autoPlacer: new AutoPlacer_default(client2), ... }`.
  Use this for by-name lookup: `ModuleHandler.staticModules.autoPlacer`.
- **`this.modules`** (built at line 18237, from the *same instances*): a flat
  array in a fixed order. This order **is** the per-tick execution order — the
  `postTick()` loop (lines 18579-18585) does exactly:

  ```js
  for (const module of this.modules) {
    const prevg = this.moduleActive;
    module.postTick();
    if (!prevg && this.moduleActive) this.activeModule = module.moduleName;
  }
  ```

  A module earlier in the array can set shared `ModuleHandler` state
  (`moduleActive`, `useAngle`, `_currentAngle`, `forceWeapon`, ...) that a later
  module reads the same tick; a module later in the array cannot affect one
  earlier. **If you add a module, its position in the `this.modules` literal
  (line 18237) decides what state already exists when it runs** — this is not
  something you can fix from inside the new module.

  In the current order, `autoRetrap` and `spikeTick` sit early-ish (right after
  `antiSync`/`adaptiveGearSwitching`), while `autoPlacer`, `trapRebuild`,
  `trapTick`, `dashMovement` and `placer` run much later — after essentially all
  combat/insta modules and before `autoHat`/`updateAttack`/`updateAngle`. Read
  the literal at line 18237 directly rather than trusting this summary once
  you're deciding exact placement for a new module.

- **`_ModuleHandler.moduleActive`** (boolean field, declared line 18134): the
  busy flag. `SpikeTick.postTick()` (line 15157) opens with
  `if (ModuleHandler.moduleActive || !Settings_default._spikeTick) return;` —
  i.e. "if some earlier module already claimed this tick, don't also act."
  **`_ModuleHandler.activeModule`** (a *string*, set at line 18583) is a
  different field: the `moduleName` of whichever module last flipped
  `moduleActive` from false to true. Guard on `moduleActive`; don't confuse it
  with `activeModule`, which is diagnostic, not a lock.

## Tick pipeline (verified call chain)

```
PlayerManager.postTick()            line 7016
  -> ProjectileManager.postTick()   line 7034
  -> EnemyManager.handleEnemies(this.enemies)   line 7035
  -> ObjectManager.postTick()       line 7036
  -> myPlayer.tickUpdate()          line 7038 (method defined line 6595)
       -> ModuleHandler.postTick()  line 6611
            -> the `this.modules` loop above (lines 18579-18585)
```

## Enemy selection

- **`EnemyManager.nearestEnemy`** is a getter (line 2710) backed by `_nearestEnemy`
  (line 2581), recomputed every tick. It's read independently by several modules
  in the same tick (e.g. lines 6393, 11061) with no memory between calls — two
  modules can each pick a target this way and get different answers if the field
  changes mid-tick. If a feature needs a *stable* target for the whole tick,
  cache it once yourself; don't re-read the getter in multiple places and assume
  consistency.
- **`PlayerManager.enemies`** (field, line 6876) is populated at lines 6999-7001
  by pushing any player where `myPlayer.isEnemyByID(id)` is true. Read
  `isEnemyByID` itself before assuming what "enemy" means here:

  ```js
  isEnemyByID(id) {                    // line 6454
    return !this.isMyPlayerByID(id) && !this.isTeammateByID(id);
  }
  ```

  That's it — **not self, not teammate**. It does *not* check `currentHealth`
  (aliveness) and does *not* exclude your own bots. Don't assume `.enemies` is
  pre-filtered for "alive" or "not one of ours" — if a feature needs that, filter
  explicitly. There's already a local pattern for this at line 5426:
  `client.PlayerManager.players.filter(p => p && p.currentHealth > 0 && p.pos && p.pos.current && !client.myPlayer.isMyPlayerByID(p.id))`.

## Position and prediction: `class Entity` (line 2507)

```js
pos = { previous: new Vector_default, current: new Vector_default, future: new Vector_default };  // :2509-2513
setFuturePosition() {                                                                              // :2518
  const {previous, current, future} = this.pos;
  this.speed = previous.distance(current);
  this.move_dir = previous.angle(current);
  future.setVec(current.addDirection(this.move_dir, this.speed));
}
```

`future` is exactly one tick of straight-line extrapolation from the last two
observed positions — no velocity smoothing, no acceleration term, no heading
confidence. If a task calls for anything beyond "one tick ahead," that logic does
not exist yet in this codebase and has to be built, not found.

## Spatial queries: `ObjectManager.grid2D`

`grid2D = new SpatialHashGrid2D(100)` (line 5755; class body around lines
5651-5722) — **100-unit cells**. `.query(x, y, searchCells, cb)` visits every
object in cells covering `±searchCells` cells around `(x, y)`, i.e.
`search: 2` is a 500×500-unit window centered on the point — local, not a map
scan. `AutoPlacer.getBestPlacementAngles` (line 5887) uses `search: 1` for its
own placement queries; `SpikeTick.findEnemyOwnTrap` (line 15147) uses `search: 4`.
Match the search radius to the feature's actual reach; widening it is a silent
way to turn "near me" into "anywhere," which is exactly the failure mode
`references/verification-rules.md` warns about.

## Network timing: `class SocketManager` (line 7349)

`pong` (line 7355, latest measured RTT), `minPingTime` (line 7378, running
minimum of `pong`), `TICK` (`1e3/9`, lines 6250/7356). Placement/retrap timers
combine these, e.g. `Math.max(1, 111 - minPingTime)` (lines 12817, 13539), to
schedule an action to land on the next server tick net of latency.

## Settings and the menu (`Settings_default` / `defaultSettings`)

The menu binds DOM inputs to settings **purely by element id** — `attachCheckboxes`
(line 18985) reads `checkbox.id`, checks `id in Settings_default`, and if it's
missing:

```js
Logger.error(`attachCheckboxes Error: Property "${id}" does not exist in settings`);
continue;
```

The checkbox is left permanently unwired — no thrown error, nothing visible in
the menu itself, just a console line and a dead control. `attachColorPickers`
(line 19013+), text inputs, and sliders follow the identical pattern. **Before
adding a menu control, grep `defaultSettings` for the id you're about to use** —
don't rely on the menu to tell you it's wrong.

## Rendering

`EntityRenderer._render(ctx, entity, player)` (line 5049) runs once per entity
per frame, using the game's own interpolated `entity.x/y`. `RYN._offset`
(used pervasively from line 4197 on) converts world coordinates to screen
coordinates for drawing. An overlay that tracks a target visually should read
these same interpolated values — don't add separate smoothing/lerp code on top.

## Bundle hooks: `Hook.append` / `Hook.prepend` / `Hook.replace`

RYN rewrites the loaded game bundle at `document-start` using regex-anchored
hooks (examples at lines 21325-21339: `preRenderLoop`, `gameInit`,
`LockRotationClient`, `offset`, `renderEntity`, `handleEquip`, `exposeGameNet`,
`exposeGameCrypto`, and others). Every hook pattern is written against the
bundle's *minified* shape and matched generically (it doesn't rely on specific
mangled identifier names, but it does rely on statement shape). `tools/check-hooks.js`
re-minifies `src/game_index.js` with `terser` and confirms every hook still
binds — run it after any change that could shift the bundle-facing regexes or
after updating `src/game_index.js` itself.
