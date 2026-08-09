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

### Precise angles

Nothing in the protocol quantises a direction. The move packet (`"9"`) carries
raw radians and the server feeds them straight into `cos(moveDir) / sin(moveDir)`
(`src/game_index.js`, `Player.update`); the placement angle is the same kind of
float. What limits a client is its own input and its own search grid:

| | Before | Now |
|---|---|---|
| Movement directions | 8 — the key vector, and nothing between | **144** (2.5°), slider 8–360 |
| Placement scan | 72 steps (5°) | **144** (2.5°), slider 24–288 |

Both sit on one grid, in `AngleGrid`. **Misc → Precise Angles** holds the master
switch and the two sliders; turning it off restores 8 and 72 exactly.

Reaching the extra directions needs an input that can express them, so two are
added, both under **Keybinds → Precise Angles**:

- **Mouse Movement** — the movement keys are read relative to the cursor: `W`
  goes toward it, `A`/`D` strafe, `S` backs off. Aiming then reaches every step
  on the grid, and diagonals stay diagonal relative to where you are looking.
- **Rotate Move Left / Right** (`J` / `L`) — one grid step per press, auto-repeat
  included, so holding either key sweeps the circle. The offset clears as soon
  as you stop moving.

Snapping to a grid instead of sending raw floats is what makes the finer
resolution affordable. A direction only goes out when it lands on a new step, so
a full 360° mouse sweep costs at most 144 move packets instead of one per
`mousemove` — measured at 144 sends across 5000 mouse events — against the 70
packets/second the client budgets itself (`ModuleHandler.packetLimit`). Mouse
steering is additionally held to ~16/s and skipped entirely when the budget is
close to spent, so it can't crowd out the combat modules.

Module-computed angles — pathfinder, autopush, safewalk — are left as the raw
floats they already were. They were never the thing being rounded. The one
exception is `LunaSafeWalk`, which picked its way around a spike from 24
candidates; it now uses the movement grid.

On the building side the same grid drives the preplace scan, the retrap scan,
the trap-bounce sweep and auto-break's swing search, so one setting describes
all of it.

**What the finer scan costs.** The scan is O(steps) spatial-grid queries per
tick, so 144 doubles what 72 did. Measured against the client's own
`SpatialHashGrid2D`, for a full tick of eight cached scans:

| Objects near you | 72 steps | 144 steps | 288 steps |
|---|---|---|---|
| 60 (a normal fight) | 2.7 ms | 5.2 ms | 10.3 ms |
| 150 (busy area) | 4.7 ms | 9.7 ms | 18.4 ms |
| 500 (packed bases) | 17.0 ms | 31.2 ms | 61.1 ms |

Against a 111 ms tick that leaves 144 comfortable in normal play and heavy only
in the crowd case — which was already heavy at 72. The slider goes down to 24 if
a machine struggles.

Precise angles and mouse movement are excluded from Legit Mode: they set how
finely a direction can be expressed, not whether the client acts on its own.

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
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/check-angles.js     precise-angle grid + placement scan, out of the build
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
node tools/check-angles.js ReUp_Mix.user.js    # add --cost for the scan timings
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
- **Angles** — 42/42 checks pass: the grid wraps and snaps within half a step,
  the eight key directions stay exact at every slider value, mouse steering
  reaches all 144 directions for 144 packets, the master switch restores 8/72,
  and the placement cache resizes cleanly when the resolution changes
  mid-tick.

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
- `_preciseAngles` defaults to **on** at 144/144. It changes how finely a
  direction can be expressed, not what the client does with it — the movement
  keys, the placer and every module behave exactly as before, on a finer grid.
  `_mouseMovement` defaults to **off**, since it re-reads WASD.
- The nudge keys default to `J` and `L`, which nothing in the game or the
  client already binds.
- Rotation toggles default to **on**, i.e. vanilla behaviour. Luna defaulted
  them off; the mix does not silently change how the game looks on first run.
- `_lowQuality` still freezes all object rotation, as it did in RYN.
