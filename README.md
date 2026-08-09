# ReUp Mix (Luna × Ryn)

A merged moomoo.io userscript: the RYN Client v4 core with the Luna Client
features RYN never had, built against the game bundles in `src/` and verified
against them.

Build outputs: **`ReUp_Mix.user.js`** (RYN v4 + Luna) and
**`RYN_v5_OWNER.user.js`** (RYN v5 OWNER + precise angles).

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

### Precise angles

Nothing in the protocol quantises a direction. The move packet (`"9"`) carries
raw radians that the server feeds straight into `cos(moveDir) / sin(moveDir)`
(`src/game_index.js`, `Player.update`); the placement angle is the same kind of
float. What limited the client was its own input and its own search grid:

| | Before | Now |
|---|---|---|
| Movement directions | 8 — the key vector, and nothing between | **624**, slider 8–624 |
| Placement scan | 72 steps (5°) | **624**, slider 24–624 |

624 rather than some rounder number: the game's own client rounds every angle
with `fixTo(angle, 2)`, so 0.01 rad is the finest direction it can express and
628 the most it can distinguish. 624 is the largest multiple of 8 at or under
that, and being a multiple of 8 keeps the eight key directions exactly on the
grid at every slider position.

Both grids live in `AngleGrid`. **Misc → Precise Angles** holds the master
switch and the two sliders; turning it off puts every sweep back to the step count it was written with.

Reaching the extra directions needs an input that can express them, so two are
added, both under **Keybinds → Precise Angles**:

- **Mouse Movement** — the movement keys are read relative to the cursor: `W`
  goes toward it, `A`/`D` strafe, `S` backs off. Aiming then reaches every step
  on the grid, and diagonals stay diagonal relative to where you are looking.
- **Rotate Move Left / Right** (`J` / `L`) — turns about 2.5° per press
  whatever the grid is set to (`max(1, round(steps / 144))` steps), so a finer
  grid never makes the keys slower. Auto-repeat included; the offset clears as
  soon as you stop moving. **ReUp Mix only** — the v5 build takes the feature
  without any new keybinds, so there the mouse is the only way onto the fine
  grid.

#### Why it is free

Two things had to stop scaling with the step count.

**Packets.** Snapping to a grid instead of sending raw floats means a direction
only goes out when it lands on a new step, so a full 360° mouse sweep costs at
most 624 move packets instead of one per `mousemove` — measured at 624 sends
across 20000 mouse events. Mouse steering and held nudge keys then share one
gate: at most one packet per 60 ms, skipped entirely when the client's own 70/s
budget (`ModuleHandler.packetLimit`) is close to spent. Only the packet is held
back — the angle keeps updating at full rate, and a trailing send delivers the
direction you settled on, so the throttle costs precision nowhere.

**The placement scan.** `_canPlace` ran a spatial-grid query per angle — 81 cell
lookups and a fresh `Set` each time — so 624 steps would have cost 129 ms of a
111 ms tick. `_getPlaceableMask` solves the same question instead of sampling
it: every candidate sits on a circle of radius `length` around you, so an object
at distance `d` blocks one contiguous arc of it, the angles within
`acos((d² + length² - reach²) / (2·d·length))` of the object's bearing. That is
the law `ObjectManager.getBestPlacementAngles` already solves for its tangents,
applied to the whole circle at once. One query, then arithmetic.

The result is the same verdict `_canPlace` gave, angle for angle —
`tools/check-angles.js` holds it to that across tangency, the 0/2π seam, objects
that swallow the circle whole, the river rule and 300 fuzz scenes: **811,440
agreements, 0 disagreements**, with 69% of angles blocked so both outcomes are
exercised.

What a full tick of eight cached scans costs, measured on the client's own
`SpatialHashGrid2D`:

| Objects near you | old, 8 steps | old, 72 | old, 144 | **new, 624** |
|---|---|---|---|---|
| 60 (a normal fight) | 0.50 ms | 4.12 ms | 8.20 ms | **0.49 ms** |
| 150 (busy area) | 0.54 ms | 4.64 ms | 9.23 ms | **0.52 ms** |
| 500 (packed bases) | 1.48 ms | 13.46 ms | 26.08 ms | **0.61 ms** |

624 angles now cost what 8 used to, and less than that in a crowd. The slider is
still there, but there is no longer a performance reason to move it.

#### What is left alone

Module-computed angles — pathfinder, autopush, safewalk — stay the raw floats
they already were. They were never the thing being rounded. The one exception is
`LunaSafeWalk`, which picked its way around a spike from 24 candidates; it now
uses the movement grid.

On the building side the same grid drives the preplace scan, the retrap scan,
the trap-bounce sweep and auto-break's swing search, so one setting describes
all of it.

Precise angles and mouse movement are excluded from Legit Mode: they set how
finely a direction can be expressed, not whether the client acts on its own.

### The same patch on RYN v5 OWNER

`src/RYN_Client_v5_OWNER.js` gets the same feature, built by `tools/build-v5.js`
into `RYN_v5_OWNER.user.js`. v5 is not v4 with more on it — it is a different
client — and the two halves of the patch land very differently on it.

**Movement is the same code.** v5 carries the same `InputHandler` and the same
`getAngleFromBitmask`, so it had the same 8 directions and nothing between them.
That half is character-for-character the v4 patch; it lives in
`tools/precise-angles.js` so the two builds cannot drift apart.

**Building is already solved in v5.** It replaced RYN's `AutoPlacer` with the
Auraro placer, which decides geometrically — it builds the blocked arcs around
the player, inverts them into free arcs, and takes the free angle nearest what
it is aiming at. There is no step count in it to raise, and its placement angles
are already exact. So there is no preplace scan here to convert, and no claim
that the placer got finer.

What the building slider drives in v5 is the three sweeps that still walk fixed
step counts:

| Sweep | Was | Cost per step |
|---|---|---|
| Trap bounce | 36 | arithmetic |
| Auto-break swing search | 72 | arithmetic |
| Enemy spike slots | 36 | one `canPlaceItem` grid query |

Only the third one cost anything per step, so only the third one gets
`_getPlaceableMask`. It sweeps a circle around the *enemy* rather than the
player and passes `canPlaceItem` a negative `addRadius`, so the shared helper
takes the anchor, the radius adjustment and the query radius as parameters —
`canPlaceItem` queries at search radius 1, not the placer's 4.

Switching precise angles off puts each of those sweeps back to its own original
count rather than to a shared stand-in, which is what `AngleGrid.buildStepsOr`
is for.

**No new keybinds in v5.** It gets the four menu options and nothing on the
Keybinds page: no rotate keys, no mouse-movement hotkey. `Misc → Precise Angles
→ Mouse Movement` is the way onto the fine grid there. The shared module takes
`nudgeKeys: false` for it, which drops the settings, the offset, the key handler
and the keydown hook together — leaving any one of them behind would have called
a method the build no longer generates.

**Left alone in v5:** its first-run `fetch` to `webhook.site` is still there.
The ReUp Mix build strips v4's, but that is a separate decision about someone
else's client — it is at the top of `RYN_v5_OWNER.user.js` if you want it gone.

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
ReUp_Mix.user.js          build output: RYN v4 + Luna features + precise angles
RYN_v5_OWNER.user.js      build output: RYN v5 OWNER + precise angles
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/RYN_Client_v5_OWNER.js  RYN v5 OWNER (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/check-angles.js     precise-angle grid + placement scan, out of the build
tools/precise-angles.js   the precise-angle patch, shared by both builds
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/build-v5.js         src/RYN_Client_v5_OWNER.js -> RYN_v5_OWNER.user.js
```

## Build

```sh
node tools/extract-drivers.js    # refresh drivers from src/game_*.js
node tools/build-reup.js         # produce ReUp_Mix.user.js
node tools/build-v5.js           # produce RYN_v5_OWNER.user.js
```

Every edit in `build-reup.js` is anchored to an exact string in the base
client, and an anchor that is missing or ambiguous fails the build. Dropping in
a newer RYN will surface as a build error rather than a half-merged script.

## Verification

```sh
for out in ReUp_Mix.user.js RYN_v5_OWNER.user.js; do
  node tools/verify-drivers.js "$out"
  node tools/check-hooks.js "$out"      # needs: npm i --no-save terser
  node tools/check-angles.js "$out"     # add --cost for the scan timings
  node --check "$out"
done
```

Current state of the build:

- **Drivers** — hats (46), accessories (21), weapons (16), items (23), item
  groups (14) and 42 scalar config keys all match `src/game_index.js`. The
  client also carries the right frame-signature width, transport mode, table
  salt, and both opcode alphabets.
- **Hooks** — 36/36 bundle-rewrite hooks bind, including the new
  `objectRotation` hook and the pre-existing `freezeTurnSpeed`, which now
  resolves to the animal turn-rate site only.
- **v5 OWNER** — drivers match the shipped bundle, 41/41 of its hooks bind,
  and the angle checks pass against its build too.
- **Angles** — 48/48 checks pass: the grid wraps and snaps within half a step,
  the eight key directions stay exact at every slider value, mouse steering
  reaches all 624 directions for 624 packets, a nudge press turns ~2.5° at any
  resolution, the master switch restores 8/72, the placement cache resizes
  cleanly mid-tick, and the analytic mask matches the `_canPlace` it replaced
  across 811,440 angle tests.

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
  `_preciseAngles` and `_mouseMovement` are excluded for the same reason: they
  are input resolution, not automation.
- `_preciseAngles` defaults to **on** at 624/624. It changes how finely a
  direction can be expressed, not what the client does with it — the movement
  keys, the placer and every module behave exactly as before, on a finer grid.
  `_mouseMovement` defaults to **off**, since it re-reads WASD.
- A stored resolution that is missing or nonsense falls back to 624, the same
  value as the default.
- The nudge keys default to `J` and `L`, which nothing in the game or the
  client already binds.
- Rotation toggles default to **on**, i.e. vanilla behaviour. Luna defaulted
  them off; the mix does not silently change how the game looks on first run.
- `_lowQuality` still freezes all object rotation, as it did in RYN.
