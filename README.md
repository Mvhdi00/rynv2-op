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

---

# YoRHa System — FORGE

Build output: **`YoRHa_System.user.js`** (base: YoRHa System 1.5, sandbox-limits
revision). Verified by `node tools/verify-forge.js` — 115 checks.

FORGE is one engine for trap and spike placement. It **replaces** YoRHa's
preplacer and replacer outright — `isPrePlaceAngle`, `getPrePlaceObject`,
`replaceWithinPath`, `replaceCandidates`, `replaceGrade` and `doReplace` are
deleted, not wrapped. The **autoplacer is untouched**.

Tuned for **1v1**.

## What was wrong with what it replaces

| | Old | FORGE |
|---|---|---|
| Prediction | one linear step | game-physics simulation, 4 ticks, with a confidence figure |
| Decisions | 6-branch if/else, first match wins | every slot scored for every role on one scale |
| Cost | shame gates re-swept **per candidate angle** (~288/tick) | one sweep per item per tick |
| Packets | 4 scattered `packets + 5 > 119` checks | one budget, priority-ordered, with a reserve |
| Measurement | none | every emission logged and confirmed against the world |

### Prediction

`xVel` in this client is **not a velocity** — `updatePlayers` writes
`x2 * 2 - lastX`, the position one tick ahead if the enemy keeps doing exactly
what they just did. No acceleration, no decay, no error bar.

FORGE uses the game's own integration, with the game's own constants:

```
vel += playerSpeed * delta * cos(dir)     while a key is held
pos += vel * delta
vel *= playerDecel ^ delta
```

A tick is 1000/9 ms, so one tick's decay is `0.993^111 ≈ 0.458`, not `0.993`.
Holding a direction converges on ~36 units/tick — which is what a player
actually covers, and the harness asserts it.

Two futures are run — they keep holding the key, or they let go — and the gap
between them is the honest error bar. **Confidence** comes from the *mean
resultant length* of their recent headings (correct across the 0/2π seam, where
averaging the raw numbers is not): a straight line reads ~1.0, juking reads
<0.35. Aim interpolates from their known position toward the held future by that
confidence, so a low-trust read collapses onto the only thing actually known.

### Roles, scored on one scale

`RETRAP 1000 · TRAP 620 · TICK 560 · MEND 430 · AHEAD 360 · KNOCK 300 · SEAL 180`

Those numbers are the priority. There is **no separate priority list** — every
intent from every role goes into one queue sorted by score, and the best one
gets the packet. Per-role caps stop any one role eating the tick.

This was not the first design. The engine originally walked a fixed priority
order and sorted by score only *within* a role, which made the weights
decorative: in a real duel frame a perfect wall-fill scoring **430** lost its
packet to a marginal spike scoring **210**, purely because "spike" sat higher in
a list. That is the same first-branch-wins failure the engine exists to remove,
so the list went and the scores decide.

Costs subtracted from every score: standing in our own line of retreat, breaking
our own line to them, spending the last of a small stock, and — for roles that
depend on the prediction — a penalty scaled by `1 - confidence`.

A spike that would knock the enemy **toward** us is refused outright: it undoes
the hold it was meant to punish.

### Packets

One ledger. `perTick` structures maximum, never below `reserve` packets/sec so
heal, insta and hat swaps always have room. Spending walks the priority list and
never across it — a re-trap can't lose its packet to a speculative seal.

### Recording

Every emission is written down with the spot it was aimed at. Later ticks look
for one of our structures there: found is a confirm, the window expiring is a
reject. Reachable live at `window.FORGE_STATS()` — tuning, ledger, per-role
accuracy, the current world model, and the last twelve decisions.

## Why it cannot conflict with the autoplacer

- Emits **only** through `addPredictObject()` — the same marker check the
  autoplacer adds through. A held slot is refused and FORGE takes its next
  candidate.
- Runs **before** `updateAngles()`, so its angles are in `placedAngles` for the
  autoplacer's ban pass on the next tick — the existing mechanism, unchanged.
- Never calls `place()` or `io.send()`; output is ordinary `predictObjects`.
- Never writes `bannedAngles` or `placedAngles`, never mutates a sweep result.
- Never calls `canTrapTick()` / `canShamePlace()` — they survive untouched for
  the autoplacer, and not calling them per-angle is what removes the FPS drop.

All six are asserted against the engine's source with comments stripped.

## Menu

**Placers → FORGE**: Enable, Engage Range, Structures/Tick, Packet Reserve. The
sliders are read fresh each tick, so changes apply without a reload.

## Verifying

```
node tools/verify-forge.js [path/to/YoRHa_System.user.js]
```

Lifts the real function bodies out of the client by name — nothing is
re-implemented — and runs them in a stub world with a recording
`addPredictObject`. Covers physics, confidence, sensing, each role, scoring,
knockback, budget, boundaries, cost, ledger, safety gates, robustness against
malformed wire data, and integration.

Three defects caught during the build: a `null` in the break list threw inside
the tick body; a non-finite enemy position made every distance `NaN` — which
compares false against every threshold, so the engine would have sailed straight
past its own range gates instead of stopping at them; and the fixed priority
walk described above, which a worked scenario exposed.
