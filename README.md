# ReUp Mix (Luna × Ryn)

A merged moomoo.io userscript: the RYN Client v4 core with the Luna Client
features RYN never had, built against the game bundles in `src/` and verified
against them.

Build output: **`ReUp_Mix.user.js`**

---

## Why RYN is the base

The two clients are not the same kind of thing:

| | RYN Client v4 | Luna Client 1.1 |
|---|---|---|
| Form | Userscript that rewrites the game bundle at load | A fork of the whole game bundle |
| Protocol | Per-connection opcode permutation + truncated-HMAC frame prefix | Plain msgpack `[type, args]` |
| Runs on the current game | Yes | No |

The game shipped in `src/game_index.js` negotiates an opcode table per
connection (`io-init[3] === 1`), permutes the c2s/s2c alphabets from a seed,
and prefixes every client frame with 6 HMAC bytes. Luna 1.1 predates that
transport entirely — it is a fork of the old webpack `bundle.js` and cannot
connect to the current game at all.

So Luna's code could not be merged in as code. Its features were ported across
onto the RYN core instead, and everything else in RYN was left alone.

## What the mix changes

### Ported from Luna

| Feature | Where it lives |
|---|---|
| **Username Cycler** | Misc → ReUp Mix. Advances `#nameInput` through a comma-separated list on every spawn. |
| **Spike Rotation / Mill Rotation** | Misc → ReUp Mix. Off freezes spinning spikes and mills so their hitboxes are readable. |
| **Menu themes** | Misc → ReUp Mix. Five accent presets (Ryn / NVG / Ice / Red / Void). |

Luna features that were **not** ported, and why:

- *Song / auto-chat lyric loop* — RYN already has a fuller version of this
  (the Music page, with chunked chat sending and session tracking).
- *Autoplacer / preplace / replace* — see below; RYN's `AutoPlacer` **is**
  Luna's placer, ported.
- *Killchat, shame combat, anti-KB, autobuy, pathfinding, AI movement /
  spikepush* — already present in RYN, in several cases as direct ports
  (`LunaPathfinder`, `LunaSafeWalk`).
- *"ai hat predict" (`autsh1`) and "ai triangulation" (`triangle2`)* — these
  are menu entries in Luna with no implementation behind them. Nothing to port.

### The placer

Luna's placer was already ported into RYN before this merge — `AutoPlacer`
carries Luna's function set under RYN's naming (`getConfig` → `_getConfig`,
`canPlace` → `_canPlace`, `addPredictObject` → `_addPredictObject`,
`getPrePlaceAngles` → `_getPrePlaceAngles`, `getPrePlaceObject` →
`_getPrePlaceObject`), rebuilt on RYN's spatial grid. Luna's whole placer menu
is present and then some:

| Luna | ReUp Mix |
|---|---|
| `autoPlace` | `_autoplacer` |
| `placeRange` | `_autoplacerRadius` |
| `prePlace` | `_preplacer` |
| `prePlace2` (replace) | `_replacer` |
| — | `_placeAttempts`, `_glotusPlacer`, `_placerRetrapCombo` |

`_lunaExactPlacer` picks between the two decision sets: **on** restricts spike
placement to Luna's original conditions, **off** (the default) adds RYN's extra
heuristics — seals-exit, double-spike, bounces-onto-spike, touches-enemy.

**Bug fixed in the placer.** `AutoPlacer._isItemLimit` read
`group.sandboxLimit || 99` and never looked at `group.limit`. Outside sandbox
that made the cap 99 for everything without a `sandboxLimit` — spikes (real
limit 15), traps (6), turrets (2), mines (1) — and 299 for the three that have
one. The limit gate effectively never fired, so the placer kept spending
placement ticks on items it could not place.

This came straight from Luna, which has the same expression. The rest of the
client already gets it right: `ClientPlayer.getItemCount` picks `sandboxLimit`
only when actually in sandbox and falls back to `group.limit` otherwise, and
`AutoRetrap._isItemLimit` is written against that. `AutoPlacer` now makes the
same call, so all three agree.

### Driver correction

`ItemGroups[8]` — the platform group — carried `layer: -1` in RYN. The shipped
bundle has `layer: 1`.

That value is not cosmetic: `PlayerObject` reads `ItemGroups[itemGroup].layer`
straight into its own `.layer`, which the collision and placement paths key
off, so a platform was being treated as a pass-under layer like traps and boost
pads. Corrected to `1`.

This was the only mismatch across item groups, weapons, items, hats,
accessories, and config — see [Verification](#verification).

### Removed

RYN v4 opened with this:

```js
if (!localStorage.getItem("_ryn_sent")) {
  fetch("https://webhook.site/d1428dcc-.../?t=" + Date.now());
  localStorage.setItem("_ryn_sent", "1");
}
```

A first-run ping to a third-party webhook endpoint, fired before anything else
and never surfaced to the user. It carries no payload beyond the hit itself,
but nothing in the client needs it. It is stripped from the build.

---

## Spike Tick (`Ryn_Type_2.user.js`)

Spike, bull hat, hit and turret as one transaction on one tick, added to the
existing placement engine rather than beside it. Combat → Placement → **Spike
Tick**, with a **Spike Tick Turret** sub-toggle.

It is a module (`spikeTick`) in `ModuleHandler.modules`, sitting fifth so it
gets first refusal among the tick/sync family, and it is in
`LUNA_TICK_OWNER_MODULES` so auto place stands aside on a tick it claims — for
that tick only, because `activeModule` is recomputed every tick. It owns no
scan, no scheduler, no packet path and no prediction of its own: the target is
`EnemyManager.nearestEnemy`, the world sweep and the one-tick prediction are the
placement engine's memoised frame, legality is its aperture solver, the chain
evaluation is `SpikeOpportunity`, and the wire is `requestPlace` / `forceHat` /
`shouldAttack`.

### What the protocol allows, and what it does not

Read out of `src/game_index.js`:

- `O.send` is synchronous, one frame per call, monotonically sequenced. N sends
  in one JS turn arrive in order and all land before the server's next tick.
  That is the only batching the protocol has, and no delay is needed anywhere.
- `Player.buildItem` places at `this.dir` — which the attack packet's angle sets
  — then resets `buildIndex = -1`. One select+attack pair places one item.
- `Player.update` runs `gather()` only while `buildIndex < 0`, so the swing must
  follow the builds, which that reset guarantees server-side.
- `gather()` reads `skin.dmgMultO` **when it resolves, on the server's tick** —
  so the bull hat may be equipped in the same burst as the swing, as long as it
  precedes it. `autoHat` already runs after every placement module and before
  `updateAttack`, so the wire order falls out of the existing pipeline:

  ```
  z(spike) F(1,spikeAng) F(0) z(weapon)     SPIKE
  z(17)    F(1,turAng)   F(0) z(weapon)     TURRET (building)
  c(0,7,0)                                  BULL HAT
  [z(weapon)] F(1,hitAng) F(0)              HIT
  D(hitAng)
  ```

Two things the game does **not** allow, and the client says so rather than
faking them:

- **The turret gear cannot share the tick.** Hat 53 is the turret that deals
  damage, and there is one hat slot, which the bull hat holds while the swing
  resolves. `reload[2]` counts up regardless of hat, so the gear goes on the
  *next* tick and fires on the one after — the tightest the slot allows, and the
  same two-step `SpikeSync` and `VelocityTick` already use.
- **The turret building cannot form a pocket with the spike.** Its ring is
  `35+43-5 = 73` against the spike's `82`, and `checkItemLocation` refuses a
  build within `43+52 = 95` of the spike — which on those rings means ~79° of
  angular separation, while a spike that ends the push must be within 60° of it.
  The turret is pushed to the flank by arithmetic. It is still placed, on the
  closest legal flank, because it narrows the retreat now and shoots them from
  2200ms on; it is not described as walling anything.

### Tests

```sh
node tools/test-spiketick.js
```

55 checks over the scenarios in the brief — stationary / slow / fast targets,
trap and spike geometry, every placement route, bull owned and not, turret
available and not, target lost before execution, duplicate prevention, and a
geometry sweep asserting the turret never overlaps or shadows the spike.

## Layout

```
Ryn_Type_2.user.js        the Type 2 client — this is the script to install
ReUp_Mix.user.js          the earlier Luna x RYN build
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/test-spiketick.js   Spike Tick transaction tests
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
```

## Build

```sh
node tools/extract-drivers.js    # refresh drivers from src/game_*.js
node tools/build-reup.js         # produce ReUp_Mix.user.js
```

Every edit in `build-reup.js` is anchored to an exact string in the base
client, and an anchor that is missing or ambiguous fails the build. Dropping in
a newer RYN will surface as a build error rather than a half-merged script.

## Verification

```sh
node tools/verify-drivers.js ReUp_Mix.user.js
node tools/check-hooks.js ReUp_Mix.user.js     # needs: npm i --no-save terser
node --check ReUp_Mix.user.js
```

Current state of the build:

- **Drivers** — hats (46), accessories (21), weapons (16), items (23), item
  groups (14) and 42 scalar config keys all match `src/game_index.js`. The
  client also carries the right frame-signature width, transport mode, table
  salt, and both opcode alphabets.
- **Hooks** — 36/36 bundle-rewrite hooks bind, including the new
  `objectRotation` hook and the pre-existing `freezeTurnSpeed`, which now
  resolves to the animal turn-rate site only.

`check-hooks.js` re-minifies `src/game_index.js` before matching, because the
hook patterns are written against minified code and the bundle checked in here
is beautified. It approximates the shipped asset; it does not reproduce the
original mangled identifiers, which the patterns match generically anyway.

### Runtime drift check

The build embeds a `ReUpDrivers` manifest recording what it was verified
against, and re-checks the observable parts ~15s after load — frame signature
width, transport mode, live opcode table size. A server-side protocol change
shows up as a console warning instead of as packets that quietly stop being
understood.

## Notes

- `_spikeRotation`, `_millRotation` and `_usernameCycler` are excluded from
  Legit Mode — they are cosmetic and naming options, not combat automation.
- Rotation toggles default to **on**, i.e. vanilla behaviour. Luna defaulted
  them off; the mix does not silently change how the game looks on first run.
- `_lowQuality` still freezes all object rotation, as it did in RYN.
