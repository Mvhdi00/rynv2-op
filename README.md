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

### The angle engine

Four places in the client decide on an angle, and each of them was giving
something away. All four now go through one set of shared math (`ReUpAim`),
switched from **Combat → Aim**.

| Switch | Default | What it does |
|---|---|---|
| **Precision Aim** (`_smartAim`) | on | Aims from where you are to the point under the cursor, every tick, and corrects your facing as soon as it drifts. |
| **Target Lock** (`_targetLock`) | off | Points at the nearest enemy instead of at the cursor, led for movement and arrow flight. |
| **Target lock range** (`_targetLockRange`) | 400 | How far the lock reaches. |
| **Flush Placement** (`_placerRefine`) | on | Slides placements off the 72-point ring onto the exact edge of what blocks them. |
| **Exact Break Angle** (`_smartBreakAngle`) | on | Gives autobreak the exact best multi-hit facing instead of the best of 72 samples. |

**Where you are pointing.** The aim was `atan2(mouse − screen centre)`, which
only describes the direction of the cursor when the player is at the centre of
the screen. The camera lerps toward the player rather than sitting on it
(`oe += g·cos(m)` in the bundle's frame loop), so while you move, the player
drifts off centre and the cursor no longer points where the angle says. The
correction is to rebuild the aim from the camera the frame was actually drawn
with — the renderer offset RYN already hooks — and take the angle from the
player's own position. Same fix for `cursorPosition()`, which follow-cursor and
the bot positions are driven off, and which was also reading the target zoom
rather than the smoothed one the frame used.

Two smaller things came with it: the angle is no longer rounded to two decimals
on the way in, and the cursor position is tracked whether or not rotation is
locked, so locking it no longer freezes the coordinates the rest of the client
reads.

**How often you say it.** The facing was only resent once it was more than
`0.3` rad — 17° — from what the server had. That is a lot of aim to give away
on every hit and every placement, and the comparison was a plain subtraction,
so aiming near the ±π seam read as 6 rad of drift and resent every tick anyway.
RYN v5 fixes the wrap with `getAngleDist`; the mix takes that and makes the
threshold adaptive: `0.02` rad with an enemy near, `0.12` otherwise, and back to
the stock `0.3` when the second's packet budget is nearly spent. At 9 ticks a
second the tight figure costs at most 9 packets out of 70.

**Where things get placed.** Placement angles come off a 72-point ring, so every
one of them can be up to 2.5° from the angle the placer meant — around 7px at
spike radius, which is the width of the gap an enemy walks out of. When the
chosen angle has a blocked neighbour, `_reupRefineAngle` bisects the gap between
them so the placement lands flush against the blocker; when both neighbours are
blocked it is a slot, and the middle of the free arc is the only angle that
fits. Both `AutoPlacer` and `AutoRetrap` carry it.

**What you hit.** Autobreak wants the facing that hits the most objects at once
and swept 72 angles looking for it. A facing either covers an object or it does
not, and it stops covering it exactly on the edge of that object's hit window,
so the best facing always sits on one of those edges — a fixed sweep only lands
on one by luck. Testing the edges directly is exact, and with a handful of
objects in range it is also less work than the sweep.

`node tools/test-angle.js` runs 22 tests over this, including a randomised check
that the candidate set never scores below a 0.1° sweep.

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

## RYN v5

The same angle work, folded into the two RYN v5 builds. Those are a separate
client from the v4 core this repo mixes — the placer is rebuilt and there is no
Legit Mode — so the angle engine was ported rather than copied, and only the
parts v5 still gives away were changed.

```sh
node tools/patch-v5.js      # -> RYN_Client_v5_OWNER.user.js, RYN_Client_v5_PLAYER.user.js
node tools/test-v5-aim.js   # 31 tests
```

| | v4 / ReUp Mix | v5 |
|---|---|---|
| Aim from the screen centre | yes | yes → **fixed** |
| Facing resent at 0.3 rad | yes | yes → **adaptive** |
| ±π wrap in the resend check | broken | already fixed upstream |
| Autobreak sweeps 72 angles | yes | yes → **exact** |
| Placement angles on a 72-point ring | yes → refined | already exact (`AuraPlacer` solves arcs analytically) |
| Angle rounded on the wire | client sends raw | rounds to 2 dp, like the vanilla client — **left alone** |

That last row is why v5 does not get the precision changes v4 got: `wireAngle`
rounds every angle to two decimals on the way out, which is what the vanilla
game sends, and the placer already simulates that rounding when it decides
where a spike will land. Sending more precision than the real client does would
be a fingerprint, so the engine computes precisely and lets the client round.

### The PLAYER build

`RYN_Client_v5_PLAYER.user.js` ships through obfuscator.io: every string in it,
including the property names it reads off objects, is RC4'd into a shuffled
array behind ~2100 per-scope decoder aliases. It is patched anyway, and it
stays obfuscated.

`tools/decode-v5-player.js` resolves those calls back to the strings they
return — 17,359 of them, no failures — and records the byte range each one came
from. `tools/patch-v5.js` finds each patch site in that readable view, maps it
back through those ranges, and splices the shipped file. Only the patched spans
change; everything around them is byte-identical, including the string array,
its rotation checksum, and the one self-defending check in the header.

Both builds share one engine (`v5-src/reup-aim.js`). It leans on nothing inside
the client — it reaches everything through `window.RYN`, which the client
publishes — so the same code drops into the readable build and the obfuscated
one, and the call sites are a single line each.

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
tools/test-angle.js       the angle engine in the build, against client stand-ins
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js

v5-src/*.orig.js          the two shipped RYN v5 builds (input)
v5-src/reup-aim.js        the angle engine injected into both
tools/decode-v5-player.js resolves the PLAYER build's obfuscated strings
tools/patch-v5.js         v5-src/*.orig.js -> RYN_Client_v5_*.user.js
tools/test-v5-aim.js      the v5 engine and both patched builds
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
node tools/test-angle.js
node --check ReUp_Mix.user.js
```

Current state of the build:

- **Drivers** — hats (46), accessories (21), weapons (16), items (23), item
  groups (14) and 42 scalar config keys all match `src/game_index.js`. The
  client also carries the right frame-signature width, transport mode, table
  salt, and both opcode alphabets.
- **Angle engine** — 22/22 tests pass. `test-angle.js` lifts `ReUpAim` and
  `_reupRefineAngle` out of the built script by their source text and runs them
  against stand-ins for the camera, the zoom, the weapon tables and the placer,
  so it exercises the shipped code rather than a copy that can drift.
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

- `_smartAim`, `_placerRefine` and `_smartBreakAngle` are excluded from Legit
  Mode: they do not act on their own, they only change how an angle the client
  is already sending gets computed, and flipping them off would quietly degrade
  the aim and the placer after Legit Mode was turned back off. `_targetLock`
  **is** automation and stays in the sweep.
- `_spikeRotation`, `_millRotation` and `_usernameCycler` are excluded from
  Legit Mode — they are cosmetic and naming options, not combat automation.
- Rotation toggles default to **on**, i.e. vanilla behaviour. Luna defaulted
  them off; the mix does not silently change how the game looks on first run.
- `_lowQuality` still freezes all object rotation, as it did in RYN.
