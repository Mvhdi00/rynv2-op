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
YoRHa_System.user.js      YoRHa System 1.5 with Falcon's Replace (see below)
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/YoRHa_System_1.5.js   YoRHa System 1.5, unmodified (input)
src/Falcon_0.4.7.js       Falcon 0.4.7, unmodified (input)
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

# YoRHa System — Replace, from Falcon

A second, separate script lives here: **`YoRHa_System.user.js`**. It is YoRHa
System 1.5 with its Replace feature taken out and Falcon 0.4.7's auto-replace
put in its place, written in YoRHa's own primitives. Nothing else in YoRHa
changes — the packet layer above all is untouched.

## Why the old one had to go

YoRHa 1.5's replacer was dead code. `rynDoReplace()` ran at the top of
`getPredictObjects()` and added through `addPredictObject(...)`, but the very
next statements were `predictObjects = []` and `spamPrePlacer = false` — so
every object it queued and the spam flag it set were thrown away before
anything could send them. The feature was on by default and had never placed
anything.

## What Falcon's replacer does differently

It does not drop something back on the exact ground that was freed. When a
building dies within reach it rebuilds the whole placement ring around *you*,
grades every slot on it, puts the best spike and the best trap down, then fills
up to four more non-overlapping slots behind them. The hole is the trigger, not
the target — which is why the wall closes in one tick instead of one object at
a time.

The whole algorithm came across: the candidate ring, the grading table
(re-trap, deny-the-enemy's-ring, knock-them-into-a-building, pusher count), the
knock-into test with its bounce bonus, the block-my-own-movement veto, and the
best-spike / best-trap / four-fill selection.

## How it is written in YoRHa terms

| Falcon | YoRHa |
|---|---|
| `Je.find()` 30-angle ring | `getPrePlaceAngles()` (the 72 / 144 sweep) |
| `nn.checkItemPlacement()` | `objectManager.checkItemLocation()`, via `canPlace()` |
| `me.checkMarkers()` | `addPredictObject()`'s overlap reject |
| `me.usedAngles` / `isUsed` | `bannedAngles` |
| `_e.fetch(sid).possible` | `replaceEnemyRing()` |
| `Jt.closeObjects` | `visibleObjects` |
| `Fr.isFriendly(o.owner.sid)` | `isObjectOur(o)` |
| `enemy.trapData` | `traps_our.find(... < trap.scale)` |
| `J.withinPath()` | `pathfindingState.currentPath` |
| `Ae.dataSent.move` | `predictMoveAngle` / `lastMoveDir` |
| `this.place(id, angle)` | `addPredictObject(id, angle, false)` |
| `W.toggles.autoReplace` / `autoReplaceRange` | `window.vars.replace` / `replaceRange` |

Two Falcon expressions did not survive contact, and neither is a behaviour
change. `checkItemPlacement()` allows a slot whose only blockers carry
`breakPotential` — but nothing in Falcon 0.4.7 ever sets that flag, so the test
reduces to "the ground is empty", which is what `canPlace()` answers. And
Falcon's spike-vs-enemy-ring overlap test reuses the *trap* candidate's cached
distance plus a `spikeScale - 50` fudge in place of the spike's own radius,
reading `undefined` (→ `NaN` → "free") whenever no trap candidate shares that
angle; the real distance is measured here instead.

## Deliberate departures

1. **When it runs.** Falcon fires it synchronously out of `killObject()`. YoRHa
   collects every placement for a tick in `getPredictObjects()` and spends them
   through one packet-budgeted loop, so `killObject()` queues the break (with
   the dead object's measurements, taken while it still exists) and
   `getPredictObjects()` answers it. It still lands on the same tick, in the
   immediate — non-preplace — lane.
2. **Who it grades against.** Falcon grades against every enemy on screen and
   hands enemies beyond 300 a `placementDistance` of `Infinity`, which is a flat
   +1 to every candidate per distant player and pushes junk slots over the
   `grade > 0` bar. Only enemies inside the replace range are graded here.
3. **The spike tick.** Falcon's `spiketick` flag calls `It.do()`, its own
   weapon-swap trick. YoRHa already owns that ground (`shameTick` /
   `canTrapTick`), so the flag stays a grading signal and nothing is swapped
   from the replacer. YoRHa's spike tick is untouched.

A fourth, smaller one: a slot vetoed for walling in your own walk stays vetoed.
Falcon re-grades it from zero on the next enemy in the loop, which can lift it
back above the bar even though the veto was never about that enemy.

## Sync with Auto Place and Preplace

The replacer runs between the two, and that order is the sync:

- the **preplacer** guesses the break that is about to happen and keeps first
  claim on the ring;
- the **replacer** answers the breaks that already happened;
- the **autoplacer** fills whatever ground the two of them left.

All three add through `addPredictObject()`, which now returns whether the slot
was taken — YoRHa's equivalent of Falcon's markers. None of them can take a
slot another one already holds, so there is no double-place inside a tick.
Across ticks they share one book: the angles all three spend land in
`placedAngles` in the same send loop, and the ban pass `updateAngles()` runs for
the autoplacer now also runs in the replacer's sweep, so an angle spent last
tick that still reads as free is held back rather than spent twice — including
when the autoplacer is switched off.

Bot contexts are covered too: `replaceQueue` is in `MOD_CTX_KEYS` and in
`ctxCapture` / `ctxRestore`, so a bot's breaks never leak into yours.

**Packets are untouched.** The replacer sends nothing itself. Its objects ride
the ordinary immediate lane and stop at the same `packets + 5 > 119` budget as
every other placement.

## Menu

Placers now reads Autoplacer / Preplacer / **Replace** / Placer Resolution. The
toggle keeps the `replace` id it had in 1.5, so saved settings and the one-key
Auto+Pre+Replace hotkey carry over untouched; `replaceRange` (100–500,
default 300) is Falcon's `autoReplaceRange`.
