# ReUp Mix (Luna × Ryn)

A merged moomoo.io userscript: the RYN Client v4 core with the Luna Client
features RYN never had, built against the game bundles in `src/` and verified
against them.

Build output: **`ReUp_Mix.user.js`**

Also in this repo: **`Ryn_Type_2.user.js`**, a separate client — see
[Ryn Type 2](#ryn-type-2).

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

## Layout

```
ReUp_Mix.user.js          the build output — this is the script to install
Ryn_Type_2.user.js        Ryn Type 2, edited in place (not built)
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/sim-explorer.js     Ryn Type 2's exploration system, run headless
tools/check-bots-ui.js    Ryn Type 2's Bots page: markup, fleet naming, bot IDs
tools/check-food-texture.js  Ryn Type 2's sakura food texture: hook, asset, render
tools/check-structure-readout.js  Ryn Type 2's building name + health bar
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

---

# Ryn Type 2

`Ryn_Type_2.user.js` is a separate client that lives here alongside the mix. It
is edited directly rather than built, so the file in the repo is the file you
install.

## Structure readout

Placed buildings carry the owner's name and a health bar, within 500 units.
This is Whiteout v4's readout, and RYN's own circular arc bar that used to be
here is gone.

Whiteout draws it inside its `renderGameObjects`:

```js
if (hacking && tmpObj.dist2 <= 500) {
    roundRect(tmpX - config.healthBarWidth / 2 - config.healthBarPad,
              tmpY - config.healthBarPad,
              config.healthBarWidth + config.healthBarPad * 2, 17, 8)   // holder
    roundRect(tmpX - config.healthBarWidth / 2, tmpY,
              config.healthBarWidth * (tmpObj.health / tmpObj.maxHealth),
              17 - config.healthBarPad * 2, 7)                           // fill
}
let owner = findPlayerBySID(tmpObj.owner.sid);
if (owner && tmpObj.dist2 <= 500) { strokeText/fillText owner.name at tmpY - 7 }
```

Ported onto RYN's own pieces rather than a second set of primitives beside
them, and they line up exactly: `Renderer.barContainer` and `barContent`
already draw this shape, because `Config.barWidth`, `barHeight` and `barPad`
are 50, 17 and 4.5 — the same three numbers Whiteout reads out of the game as
`healthBarWidth`, the literal `17`, and `healthBarPad`. Ownership comes from
the `isMyPlayerByID` / `isTeammateByID` pair the rest of the client uses, and
the owner's name off `PlayerManager` instead of Whiteout's `findPlayerBySID`
scan.

Whiteout colours the bar by ownership — green for yours, yellow for the clan's,
red for everyone else. Here every bar is one **light sky blue** (`#b3e5fc`);
the two toggles already decide which structures get a bar at all, so the bar
itself does not answer the same question twice. The old `_itemHealthBarEnemyColor`
is gone and one colour picker remains.

**The name sits on the bar.** Whiteout puts it at `tmpY - 7` while the holder
starts at `tmpY - 4.5`, so a name of any length covers most of the bar. That is
Whiteout's layout and it is kept as-is; `STRUCTURE_NAME_OFFSET` is the one value
to raise (≈22) to lift the name clear of the holder.

Verify with:

```sh
node tools/check-structure-readout.js
```

It checks the Visual page against Settings — `attachColorPickers` and
`attachCheckboxes` silently skip a control whose id is not a setting, so a
removed setting leaves a dead control that looks fine until you click it — that
the default colour actually reads as a light, soft sky blue, and then runs
`structureInfo` against a recording context to confirm it draws Whiteout's
rectangles *to the pixel*, the name where Whiteout puts it, and nothing at all
past 500 units, for an indestructible structure, or with the matching toggle
off.

## Sakura food

The FOOD resource wears a sakura flower instead of the game's berry bush.

Food is resource type 1 — the berry bush in the green and snow biomes, the
cactus in the desert. The game builds its sprite in `El()`, which caches one
canvas per type/scale/biome and hands it to the object draw, which centres it
with `drawImage(sprite, x - sprite.width / 2, …)`. RYN already intercepts
exactly that canvas: the `resourceTint` hook wraps `El()`'s return in
`Renderer._objectTint` before it reaches `drawImage`. So the whole change is:

- `resourceTint` now passes the resource through as a second argument, the way
  `buildingTint` always has, so the renderer can tell food from wood and stone.
- `_objectTint` swaps in a sakura canvas of **identical dimensions** when the
  entity is food, before anything else looks at the sprite. The tint, the tint
  cache and the game's own draw carry on unchanged.

Nothing else moves. Spawning, collision, hitboxes, gathering, healing and the
inventory never look at a sprite, so none of them can notice.

The image is the supplied PNG resampled to 256 square and embedded as a data
URI — a userscript is one file with no asset directory, and the largest food
sprite the game ever asks for is 205px (`bushScales` tops out at 95, and `El`
sizes the canvas `2.1 * scale + 5.5`), so the full 1254 square would have added
a megabyte of base64 for detail that cannot be shown. Framing, colours and the
transparent background are untouched.

**The desert cactus is food too**, so it becomes a sakura as well. Its 35 damage
on contact is unchanged — but the visual warning is gone. Restricting the swap
to non-desert bushes is a one-line change in `_foodSprite` if that matters more
than consistency.

Verify with:

```sh
node tools/check-food-texture.js     # needs: npm i --no-save terser
node tools/check-hooks.js Ryn_Type_2.user.js
```

`check-food-texture` covers the parts a diff cannot show. It runs the real hook
against the re-minified bundle and checks the rewritten resource draw still
parses and still hands the resource through; it decodes the embedded data URI
and checks pixels — 8-bit RGBA, square, transparent corners rather than black
ones, the flower centred, still pink — because a re-encode that flattened the
alpha would look identical in a diff; and it runs `_objectTint` against a fake
canvas to check that only food is swapped, at the sprite's own dimensions, with
nothing painted behind it, and that the purple object tint still composites on
top.

## Naming the fleet, and bot IDs

Bots → Fleet has a **Name every bot** box. Type a name there — say `Raptor` —
and every bot row you add from then on is pre-filled with it, so the whole fleet
joins under one name. **Apply to all** also pushes it onto the rows and bots you
already have. It wins over *Auto random bot names*; clear the box to get the old
per-row behaviour back. The name persists across sessions like any other
setting.

A moomoo name is chosen at spawn — it travels in the spawn packet and nothing
else sets it — so a bot standing in the world cannot be renamed underneath
itself. Apply sets what each bot spawns as **next**, and since bots respawn
themselves, they catch up on their own. Until then the row shows both:
`Raptor → Wolf`. Nothing is force-respawned, so bots held at the menu with `[`
stay held.

Each connected bot's row now reads:

```
✓  BOT 3   Raptor   id 1247   ✕
```

Two ids, because they answer different questions. **BOT 3** is the fleet slot —
short, stable for the life of the connection, and what you mean by "bot 3".
**id 1247** is the id the server gave that connection: what the bot is called in
packets and by every other client.

**Two bugs fixed on the way there.** The fleet slot came from `let id = 0`
declared *inside* `handleBotCreation`, which runs once per row — so every row had
its own counter sitting at zero and every bot came out as bot 0. And a bot
connected through the dynamic list has no `#bot-container` option, which
`botOption` dereferenced without checking; the throw landed inside
`onFirstTickAfterSpawn`, so everything after that call was skipped —
`clientIDList` never learned the bot's id, and bots did not recognise each other
as friendly.

Verify with:

```sh
node tools/check-bots-ui.js
```

It unescapes the Bots page and checks the ids are unique, that every id the code
looks up exists, that the name box is a text input bound to a real setting
(`attachTextInputs` silently skips one that is not), and that the tags balance.
Then it pulls the UI object out of the shipped file, constructs it against a
fake document, and actually runs the row rendering and the Apply handler.

## Persistent exploration

Bot random movement (Bots → the Scatter Bots key, `J` by default) used to be
x18's wander: roll a random heading, re-roll while it lands within 2 radians of
the last one, walk it until 3300 units of straight-line distance have gone by,
10 seconds pass, or the bot stops. A heading is not a destination, and rolling
one repeatedly is a random walk — displacement grows with the square root of the
number of legs, so a fleet left to it stays in the corner it started in. The
forced >115° turn made each leg partly undo the one before, and the third
re-roll condition fires on *stopped*, which is what a bot is every time it walks
into something.

`BotExplorer` replaces the heading with a destination and a route to it:

```
current position -> a distant sector -> a corridor to it -> travel
-> arrive -> another distant sector -> ...
```

The bot commits to a destination and keeps it. Direction changes only for a
reason: the route bends around something, the destination is reached or proven
unreachable, another bot is too close, or the bot is recovering from being
stuck. There is no per-tick randomness in the steering at all.

| Concern | Where |
|---|---|
| What counts as solid | `_expBlockerAt`, `_expFirstBlocker` |
| Corridor clearance | `_expCorridorClear`, `_expClearHeading` |
| Path generation | `_expBuildPath` |
| Bot-to-bot separation | `_expSpacingPass` |
| Destination choice, following, stuck recovery, breaking, execution | `BotExplorer` |

It is a bot module — `ModuleHandler.botModules`, between `botRangedAttack` and
`movement` — so it runs on the server tick like every other module rather than
on its own animation-frame pass, and `Movement.postTick` stands aside for it on
the `_scatterActive` flag it always used.

Everything underneath is the client's existing machinery:

- **`PlayerManager.canMoveOnTop`** decides what is passable. It is
  ownership-aware — boost pads, platforms, healing and spawn pads, blockers,
  teleporters and your own clan's pit traps are walkable, an enemy pit trap is
  not, and no resource ever is. That is what gives paths their openings: a
  building boundary is only a wall where the game actually makes it one, so a
  gate is routed through rather than walked around. The old check queried only
  `PlayerObject`, so every tree, bush and rock was invisible to it and routes
  were drawn straight through them.
- **`ObjectManager.grid2D`** for lookups, and `isDestroyedObject` as the signal
  that a structure nearby just came down.
- **`ModuleHandler.startMovement`**, which keeps `move_dir` and
  `reverse_move_dir` in step (Automill builds off the latter) and runs
  `MovementSimulation`, so a step into a spike is refused rather than sent.
  Movement goes out on a real change of heading or a 2s keepalive, not every
  tick — re-sending a slightly different heading every tick is the jitter.
- **`moduleActive` / `useAngle` / `forceWeapon` / `shouldAttack`**, the same
  channel `BotAutoBreak` uses, for breaking. There is no second attack path and
  the reload gate is the client's own.

Breaking is only reached after routing around has failed, and only for what the
same swept-disc probe reports first along the heading the bot is walking — it
must also be destroyable and enemy-owned, since a clan's own buildings take no
damage and a tree does not come down. Nothing off to the side is touched however
close the bot walks past it. Bringing a blocker down resets the recovery clock;
nothing coming down means recovery keeps escalating, which is what stops a bot
hammering a wall it cannot break.

Path building is the only expensive part, so it runs on a budget shared by the
whole fleet (3 plans per 100ms whatever the bot count); a bot waiting for a slot
holds the straight line to its destination, which is what the planner returns in
open ground anyway.

Verify with:

```sh
node tools/sim-explorer.js
node --check Ryn_Type_2.user.js
```

`sim-explorer` pulls the block straight out of the shipped file and runs it
against a stub of the client surface it uses, driven by an integrator that
resolves collisions the way the game does. It checks that a bot crosses the map
rather than milling about and that its move packets are keepalives rather than
corrections; that a wall with a gap is routed through the gap; that a breakable
wall is broken through while a breakable thing off to the side is left alone;
that a pair of bots separates and only ever one of them yields; and that 24 bots
starting on one spot spread out, stay spread, and cost a fraction of a
millisecond per tick between them.
