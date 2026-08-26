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

# YoRHa System — Replace

Build output: **`YoRHa_System.user.js`** (base: YoRHa System 1.5, sandbox-limits
revision). Verified by `node tools/verify-replace.js` — 150 checks.

YoRHa's replacer is **Falcon 0.4.7's grading table**, already carefully ported
with four documented fixes to Falcon's own bugs.

> **Checked against Falcon's own source.** Those fixes were originally inferred
> from the port; the original client has since been read directly. Two hold
> exactly as documented. Falcon's candidate constructor sets `grade = 0` and
> **never sets `points`** — it then writes `u.points++` once and `u.points += 2`
> twice, all onto `undefined`, and never reads the field back, so the two things
> it scores count for nothing. And its knock-in ladder reads
> `g.building.trap ? 2.5 : g.bounce ? 5 : g.building.trap ? (dead) : 3` — a third
> branch re-testing a condition the first already took, so it is unreachable.
> Falcon 0.4.7 also has **no preplacer at all**: its placer exposes `autoplace`,
> `autoreplace` and `grade`, and the `preplacer` field on its candidate object is
> written once in the constructor and never read. Reading the replacers in nine
other clients turned up nothing better than it — so this does not replace it.
The grading table, `replaceKnockInto`, `replaceEnemyRing`, `replaceWithinPath`,
`replaceBlocksMyMove` and the four-slot fill limit are all untouched. So are the
preplacer and the autoplacer.

Six surgical changes. Four are taken from a specific other client and each
closes a specific hole. Two more came out of measuring the result: one made the
replacer faster, one made it lead a moving target.

## 1. Fine aim — from AI Client 44

Falcon and YoRHa both choose from a fixed ring: 72 angles at 5°, or 144 at 2.5°.
That grid is what makes grading every slot affordable, and also a floor on
precision — the nearest grid angle to a hole can sit half a step away, and half
a step out on the placement ring is ground an enemy can still walk through.

AI Client 44 walks outward from the hole's **own** angle at `π/360` — half a
degree — both directions at once, taking the first slot that fits.

Applied here as a **refinement, not a replacement**, and that ordering is the
whole point: the grid still decides *which* slot to spend, because that is what
carries the grade. This only slides the chosen slot along the ring toward the
hole it answers, never further than one grid step, so the geometry that earned
the grade still holds.

Measured: a hole at 1.25° off-grid went from **1.25° → 0.00°**, in **1**
`canPlace` call. AI Client's own version would spend up to 720.

**This broke an invariant the file states about itself**, and it took three
fixes. From `buildPlaceAngles`' own notes: *"a placed angle is keyed exactly
(`bannedAngles.has(obj.angle)`) and matched with a 0.01 rad tolerance"*. The ban
book is what stops two lanes spending the same ground on two ticks — and a
refined angle is not a grid angle, so:

1. **It was never found.** A refined angle sits up to half a grid step off the
   ring — 0.0218 rad in 144 mode, more than twice the 0.01 tolerance — so
   `find()` returned nothing and the slot was never banned at all.
2. **Even a match would have been unreachable.** The ban was keyed on the
   *placed* angle while the reader asks `bannedAngles.has(slot.angle)`.
3. **Angles could be negative.** `atan2` returns −π..π, so a hole below the
   player refined to e.g. −0.0218 — the same slot as 6.2614, but a different key
   and a different number to every raw subtraction.

Both passes now match the nearest slot **within half a step**, measured
wrap-safe, and file the ban under **that slot's** angle. For a placement already
on the grid the distance is zero and the key is its own — identical behaviour.
`updateAngles` needed the same fix, because `placedAngles` is shared with it.

> Its copy never ran. `AutoReplace` is not called anywhere in that file, and the
> `customCheckItemLocation` it depends on is not defined in it either.

## 2. In-flight cap — from blisma mod v5

`isItemLimit()` reads `myPlayer.itemCounts`, and that is written **only** by the
server's `"S"` packet. Every placement queued inside the current tick is
invisible to it. Queue three traps with one slot left under the cap of **6** and
the server refuses two — with their packets already spent and the hole they were
for still open.

blisma keeps a `replacedObjs` tally and adds it to its own cap check. Same here,
and kept replace-local exactly as blisma keeps it: what the autoplacer spends is
not this function's business.

All three of `doReplace`'s placement points now go through **one** `spend()`
path, so neither the cap nor the fine aim can be forgotten at one of them.

## 3. Danger gate — from Ae86 2.8 / blisma

Both ask their `checkSpikeTick()` before placing: while the enemy is mid
spike-sync on you, the tick belongs to getting out, not to building. Falcon never
asked, so neither did this.

The reading is YoRHa's own — `nearestTrap && spikeDmgCount > 0`, the same pair
the preplacer already gates on. One without the other is not the sync, and those
cases still build.

## 4. Cost

`replaceGrade` reached `canTrapTick()` **once per spike candidate**, inside its
per-enemy loop, and each call swept a whole placement ring. Forty placeable
spikes and two enemies is eighty sweeps for an answer that cannot change inside
one tick.

- `canTrapTick()` memoises per tick, keyed on the context's `myPlayer` as well —
  `ctxRun` swaps `tick` along with everything else to run this code on a bot's
  world, so two contexts on the same tick number is ordinary.
- `getPrePlaceAngles()` caches per tick, keyed on the **object array itself**
  rather than its length (a length key collides between different sets of equal
  size). `updateAngles()` still calls `buildPlaceAngles()` directly for a
  guaranteed-fresh sweep.

Measured with Shame Tick on and 40 visible objects: **2 sweeps** per replace,
~2.9 ms — 2.7% of the 111 ms server tick.

> An earlier claim of mine, that `replaceEnemyRing` needed caching, was wrong:
> `doReplace` runs once per tick, so the ring was already computed once per
> enemy per tick. The cost was where the measurement said it was.

## 5. Commit first, refine second

`spend()` is offered far more candidates than it can ever place. Falcon grades
the whole ring and hands over everything scoring above zero, and only four slots
may be filled. Measured on one replace in a fight scene:

| | |
|---|---|
| candidates offered to `spend()` | 99 (bestSpike + bestTrap + 97 above zero) |
| refused by `addPredictObject` for overlap | **95** |
| actually placed | 4 |

The fine aim was running on all 99 — including the 95 about to be refused. And
nearly none of them could have moved anyway: the search never slides a slot
further than one grid step, so a candidate whose bearing sits more than a step
from its hole has no angle to try. **89 of the 97** were in exactly that
position, and every angle the loop offered them was rejected by its own first
filter.

> This is not the reason I first gave, and the first one was wrong. I wrote that
> the search costs "up to a dozen collision tests" — that is its worst case, not
> what it does. Across all 99 calls it reached `canPlace` **six times**. The cost
> is the search's own arithmetic: an `atan2`, a scan of the break list, and
> eleven angle-distance checks that all fail. **7.2 µs a candidate, 684 µs of the
> 869 µs the reordering saved.** The change and its numbers were right; the
> explanation behind them was not.

`addPredictObject` is a handful of distance comparisons, and it is the question
that actually decides. So `spend()` now commits on the grid angle first and
refines only what was accepted.

Sliding an accepted slot toward its hole can move it into something else queued
this tick — two spikes that clear each other at 60° apart do not still clear at
58.75° — so the move is kept only if the ground it lands on is free of everything
else in the list. That is a different question from the marker check: the marker
check asks whether a **new** object may join, this asks whether one already in
the list may **move**.

| | before | after |
|---|---|---|
| `replaceFineAim` calls | 99 | **4** |
| per replace | 5375 µs | **4506 µs** |
| placements | identical | identical |

## 6. Lead the target

Every other aiming path in this file already leads. The insta check measures to
`nearestEnemy.xVel/yVel`, the spike-knock search sorts on it, the velocity tick
places against it. `replaceGrade` was the one placer still grading on `x2/y2` —
the position the last packet reported, which by the time the building exists is a
server frame old. A frame is 111 ms, and a player at speed covers most of 25
units in it. The sharpest test on the spike table is `dist <= 35 + scale` —
does this slot reach them at all — and 25 units is most of the margin it has.

**There is nothing to simulate for this.** `updatePlayers` already writes

```js
tmpObj.xVel = tmpObj.x2 * 2 - lastX;
```

which is `x2` plus the step they just took: the client's own one-frame
extrapolation, at exactly the horizon a placement has. (An earlier branch of this
work carried a hand-rolled physics integrator for it. It was a worse copy of a
number already in the data.)

What the replacer cannot borrow from the aiming code is its **tolerance for being
wrong**. A missed swing costs a swing; a mis-led ring costs buildings out of a
stock the caps hold to six traps and fifteen spikes, and the replacer commits the
whole ring on one reading. So the lead is weighted by what the reading is worth:
the mean resultant length of the last six observed headings — the wrap-safe way
to measure how tightly a set of angles clusters. Hold one line and the grade
moves the whole way onto the extrapolation; juke and it collapses back onto
`x2/y2`, which is the only thing actually known. With no history at all the
weight is zero and the grading is bit-for-bit what it was.

The window is sampled in the tick body, not in `doReplace` — `doReplace` only
runs on the ticks something broke, and a window built from those measures across
the gaps between them rather than along a line.

**The prediction alone changes nothing, and that is the interesting part.**
Falcon grades in small integers, and in a bare duel most of the ring scores the
same: measured on one, **28 of 72 spike slots tie at grade 1 with identical
points**, so the winner is whichever the sweep reached first. A tie broken by
sweep order is a tie broken by nothing. So the slot's distance to the aim point
now feeds `points` — the field this file already reserves for settling ties the
grade left open — weighted so the contribution from every enemy together still
sums to under one, which keeps that rule literally true.

Measured as the **bearing error** of the queued spike against where the enemy
will be when it exists, over 48 paired duels (a spike can only sit on a ring of
fixed radius, so its distance to the enemy is floored by geometry no placer
controls; the bearing is what a placer actually chooses):

| | enemy holding one line | enemy juking every frame |
|---|---|---|
| before | 32.98° | 32.98° |
| tiebreak only | 7.58° | 7.58° |
| tiebreak + lead | **1.41°** | **4.89°** |

The two are not separable: with the lead but **without** the tiebreak the error
is **35.48°**, worse than not leading at all. Leading moves which slots qualify
while sweep order still picks arbitrarily among them.

Toggle: **Placers → Replace → Lead The Target** (`replaceLead`, on by default).

## What was rejected, and why

| Idea | From | Why not |
|---|---|---|
| Randomised start angle and step | Nova Recode | Trades placement quality for anti-detection, and a random step **misses valid slots**. |
| Rolling 5-angle average + sine jitter | Genessis, unknown v3.15 | Averaging angles across *different* holes is meaningless — 0° and 180° average to 90°, serving neither. Both copies also crash (TDZ). |
| `tickSpeed - ping` delay | AI Client 44 | YoRHa already lands in the same tick on the immediate lane. Adding delay is a regression. |
| `game.tickBase(fn, 1)` | Ae86 2.8 | `getPredictObjects` collects and spends in one budgeted loop — tick-synced by construction. |
| `spikeKb` | blisma | `replaceKnockInto` is strictly better: it detects the bounce and grades 2.5 / 3 / 5. |
| `isObjectBroken(health < 20)` | Ae86 2.8 | A *predictive* signal in a reactive replacer. That is preplace's job. |

## Also fixed

`doReplace`'s break-list filter threw on a `null` entry. Pre-existing, from the
Falcon port. `killObject` only ever writes well-formed entries so it should not
happen — but this runs inside the tick body, where "should not happen" throwing
takes the rest of the tick with it.

## Verifying

```
node tools/verify-replace.js [client.js]                  # 148 checks
node tools/mutate-replace.js [client.js]                  # does the suite have teeth?
node tools/check-scopes.js   [client.js]                  # names READ but never declared
node tools/check-dead.js     [client.js] --base [base.js] # names DECLARED but never used

# 150 checks: the two static passes fold in when a baseline is given
YORHA_BASE=/path/to/pristine.user.js node tools/verify-replace.js
```

`node --check` proves a file parses. It does not prove a name still resolves
after an edit, and it does not prove a function you added is ever called —
neither fails at load, both fail mid-fight. Two static passes over the **whole**
file cover that:

- **check-scopes** — every identifier read resolves to a declaration somewhere
  up the real scope chain. 7 do not, all from the vendored game bundle, and the
  untouched base reports the same 7.
- **check-dead** — every name declared is referenced, and no scope declares one
  name twice (the later silently wins, so the earlier is dead but reads live).
  Reported as a **delta** against a baseline, since a vendored bundle carries
  plenty of its own.

Both were calibrated against clients whose defects are already known, so a clean
report means something:

| | check-dead / check-scopes finds |
|---|---|
| NOVASTORM | `replacer` declared and never called · `optimizedPreplacer`, `beastModeReplacer`, `ultraSmartReplacer` each **defined twice** · `batchPlaceTrap` **called 10× and never defined**, `isTrapBlocked` 4×, `canPlaceTrap` 1× |
| AI Client 44 | `AutoReplace` declared and never called |

On this file: **0 dead, 0 shadowed, 0 undeclared introduced.**

The pre-existing 33 unreferenced names are all vendored-bundle leftovers and
debug renderers (`drawGrid`, `drawPath`, `drawCompassDirection`, `MapManager`,
msgpack internals). The 2 shadowed are benign `var` redeclarations
(`keys` 9426/11997, `data` 25267/25270). None is in the placer region; all are
identical in the untouched base.

Lifts the real function bodies out of the client by name — nothing is
re-implemented, including `addPredictObject`, since the no-double-spend claim
rests on it. Covers the fine aim's accuracy, bound and cost; the cap against a
counter only the server writes; the gate in all four combinations; the sweep
count; the lead's weighting, bounds, wrap safety and graceful failure, and its
bearing error swept over a grid of duels rather than asserted from one; that the
grading table and both other placers are untouched; robustness against a
malformed break list; and that the file's undeclared-identifier set is unchanged
from the pristine base.

### The suite has been made to fail

A suite that has never failed has not been shown to test anything.
`node tools/mutate-replace.js` breaks the client one way at a time and confirms
the suite notices each break. Thirteen mutations, all caught:

| mutation | first check that fails |
|---|---|
| drop the proximity tiebreak | `against a runner holding one line: 35.48deg led, 32.98deg unled` |
| grade on the present position again | `7.58deg led, 7.58deg unled` |
| trust every reading completely | `a heading that reverses every frame reads as unsteady` |
| average the heading numbers, not the vectors | `a heading that reverses every frame reads as unsteady` |
| drop the one-packet-one-observation guard | `the same reading ten times over is one observation, not ten` |
| stop sampling on ticks where nothing broke | `a tick with no break still records the heading` |
| let the heading window grow unbounded | `the heading window is bounded by REPLACE_LEAD_WINDOW` |
| let the lead run past the extrapolation | `the aim point lands on the extrapolation, not the report` |
| stop splitting the proximity term across enemies | `with 4 enemies the proximity term still totals under one point` |
| never prune the heading book | `the heading map does not grow for the whole session` |
| prune the heading book too aggressively | `sixty enemies seen every tick: all 0 keep a usable history` |
| move the refined slot's angle but not its position | `every queued position matches getConfig(id, its own angle)` |
| skip the clash check when sliding an accepted slot | `the one geometry that reaches the clash guard is placed without overlap` |

**Two of those came back MISSED the first time**, which is the whole point of
running it:

- *Splitting the proximity term.* The test measured `points - floor(points)`.
  That cannot fail — four enemies at 0.99 each sum to 3.96, whose fractional
  part is still under one. The bound is now read straight off `points`, in a
  scene built so no integer award fires.
- *The clash guard* had **no test at all**. Adjacent ring slots always overlap,
  so `addPredictObject` refuses them and the guard never sees them; it only
  matters where two slots are far enough apart to be accepted and close enough
  that one grid step of refinement closes the gap. Across 480 ordinary scenes
  the fine aim moved a slot **388 times and the guard fired zero times**.
  Sweeping 8400 geometries against a guard-removed client found **121 that
  differ**; the first is now pinned as a test. Without the guard, a trap refines
  from 2.617994 to 2.656367 and lands **99.59 units** from another trap — inside
  the 100 two traps need.

A mutation whose anchor no longer matches is reported `STALE` rather than
counted as caught, so a rewritten function cannot quietly retire its own test.

The same practice caught a real regression earlier in this work: the fine aim
silently broke the ban book three ways at once, and the tests written for it were
confirmed to produce six failures on the previous commit before being trusted.

**Diff against the base: 405 lines added, 17 replaced, in 19 hunks.**
