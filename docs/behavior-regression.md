# Behaviour regression — source vs. shipped

Requested format: **ORIGINAL → CHANGE → REASON → EXPECTED RESULT**, with each
reason attributed to one of: Auto Place compatibility, Spike Tick
compatibility, game API difference, shared-state integration, duplicate-action
prevention — or, where none of those apply, **architectural preference / a later
instruction in this session**, named as such.

---

## 0. The blocker, stated first

Two facts established earlier in this session, with line numbers, constrain what
"preserve the proven source behaviour" can mean.

**Whiteout has two preplacers and the named one is dead.** `traps.preplacer`
(9844) has exactly one caller, inside a block commented out at 16501 whose own
comment reads `//traps.preplacer(FANEYEATASALAD) rip old preplacer`.
`traps.replacer` (9619) has **no caller anywhere in the file**. So there is no
running behaviour in either to preserve. Whiteout's live preplacing is
`autoplacers()` (12616, called from `updatePlayers` at 16208), where **preplace
is a per-candidate boolean inside one unified placer**, not a separate system.

**Luna's Replace is a stub plus a duplicate send.** `prePlace2` (19253) occurs
once in the whole file, has no `window.vars` key and is read nowhere. The
working mechanism is `spamPrePlacer` — four sites — which re-sends Preplace's
decision at a second offset with no success check. And Luna's
`getPredictObjects` diffs to **zero** against NovaStorm's baseline ignoring
whitespace, so "Luna Replace behaviour" is, almost exactly, the behaviour
NovaStorm already shipped.

So: for Whiteout the fidelity target is `autoplacers`, and §2 measures the
shipped code against it honestly. For Luna the fidelity target is a two-branch
doomed-object finder plus an unconditional double-send, and §3 does the same.

**Verdict up front: what I shipped is substantially a new implementation, not a
port.** §4 lists every divergence. Several of them exist because of instructions
you gave later in this session that are incompatible with literal fidelity; §5
sets those out so you can decide which way to resolve them.

---

## 1. What was preserved

Genuinely carried across, and unchanged in intent:

| source | mechanism | in shipped code |
|---|---|---|
| Whiteout `calcVel` 14917 | two hypotheses scored against last tick's observed position | `NS_updateMoveModel` |
| Whiteout `calcVel` 12987–12998 | `.0016` / `.993` integration constants | `NS_updateMoveModel` |
| Whiteout 15119 | measured inter-tick interval, not a constant | `dt = p.t2 - p.t1` |
| Whiteout 7610–7621 | `buildIndex >= 0 ? 0.5 : 1` speed term | `NS_updateMoveModel` |
| Whiteout 14917 | direction-stability gate | `STABLE_RAD` / `TURN_RAD` |
| Whiteout `check3` 12592 | revalidate at commit instead of cancelling | `NS_revalidate` |
| Whiteout `findAvailableAngles` 12277 | resolution/anchor as parameters | `NS_probeAngles` |
| Whiteout `gradeAngles` 12348 | points scoring **with negative terms** | `NS_usefulness` |
| Luna 11765–11771 | reload **edge** trigger | `NS_findDoomed` |
| Luna 11749–11757 | range + aim cone + lethality + accurate hat filter | `NS_findDoomed` |
| Luna 11814 | doomed object spliced out of the collision set | `NS_runReplace` |
| Luna 11296 | correct item-limit expression | `NS_groupLimit` |

---

## 2. Whiteout Preplace — before / after, on your six axes

| axis | Whiteout `autoplacers` (live) | shipped | same? |
|---|---|---|---|
| prediction | `x3` from `calcVel`, accel/decel chosen by scoring last tick | same mechanism | **yes** |
| movement handling | `movDir`/`pmovDir`, one tick of history, stability gate | same, with the signed-sum bug fixed | **yes, improved** |
| candidate generation | `findAvailableAngles(item, 0, 0, PI/100)` — 201 uniform angles from 0, at `player.x2` | identical: 201 uniform from 0, at `player.x2` | **yes** |
| | legality via `checkItemLocation3`: passes iff **every** overlapping object has `assumeBreak` | `canPlace`: **any** overlap blocks | **no** — D2 |
| candidate selection | `gradeAngles` points table, `bestSpike` + `bestTrap`, then `fullplace` tops up to **4 placements** | single best by `gain`, **1 placement** | **no** — D3, D4 |
| timing | preplace+priority → `setTimeout(tickRate - pingTime)`; everything else immediate | deferred at `111 - tickPing()` | **yes** |
| placement | `placers()` → `check3()` revalidate → `place()`, **3 packets** | `NS_revalidate` → `place()`, **4 packets** | mechanism yes, cost no — D5 |

## 3. Luna Replace — before / after, on your five axes

| axis | Luna | shipped | same? |
|---|---|---|---|
| replacement detection | `getPrePlaceObject` 11746: two branches, `nearestEnemy` only, `* 3.3` hard-coded, no aim cone or ownership test on the enemy branch | `NS_findDoomed`: all nearby enemies, hat-accurate, aim cone, ownership | **no** — D6 |
| replacement selection | `isPrePlaceAngle` 7-rule cascade, first match wins, tie-broken by distance to the doomed object; spikes tried before traps | loss/recovery scoring, best by recovery | **no** — D7 |
| validation | `canPlace` at decision time only | `canPlace` at decision **and** `NS_revalidate` at commit | **no** — D8 |
| timing | second send at `111 - minPingTime`, unconditional | mode A deferred, mode B immediate; retry conditional | **no** — D9 |
| execution | `place()` twice per tick | `place()` once, retry only on unconfirmed landing | **no** — D9 |

---

## 4. Every divergence

### D1 — sweep generation — ***CLOSED, now a faithful port***
**ORIGINAL** `findAvailableAngles` (12277):

```js
for (let offset = thisAng; offset <= thisAng + PI2; offset += interval)
```

Uniform, both endpoints inclusive. Live call sites pass `thisAng = 0` and
`interval = PI/100` in `autoplacers` (12626) and `PI/50` in the reactive
replacer (14467) — **201** and **101** probes respectively.

**CHANGE (v1)** 72 probes, NovaStorm's stock budget.
**CHANGE (v2)** 200 / 100, but still anchored on the bearing to the predicted
enemy with a fine band — my optimisation, not Whiteout's behaviour.
**CHANGE (current)** `NS_probeAngles` is a literal port of the loop above.
Anchor defaults to `0`, matching every live Whiteout call site; step is
`PI/100` for Preplace and `PI/50` for Replace. Verified in
`tools/test-preplace.js` against a standalone reimplementation of Whiteout's
loop — the emitted angle sequences are identical to 1e-12, 201 and 101 probes.

**REASON** Fidelity. The anchoring was architectural preference, which the
behaviour-preservation directive rules out. Measured cost at 400 objects:
0.055 ms (72) → 0.118 ms (201) per sweep against a 111 ms tick.
**EXPECTED RESULT** Candidate generation is now Whiteout's, exactly — same
angles, same order, same density.

### D2 — multi-object break-aware legality *(the biggest fidelity gap)*
**ORIGINAL** `checkItemLocation3` (6102) collects **every** overlapping object
and its `assumeBreak`, and passes iff none is `false`. `objDmgPot` (14736) sets
`assumeBreak` across all `nearPlayers`. This is what lets Whiteout preplace into
space occupied by several objects that are all about to die.
**CHANGE** Not implemented for Preplace. `canPlace` blocks on any overlap.
Replace excludes only its single `targetSid`.
**REASON** *Architectural preference / omission.* Not required by any
compatibility constraint — I simply did not port it.
**EXPECTED RESULT** Preplace finds **strictly fewer** candidates than Whiteout in
exactly the situation preplacing exists for: contested space about to clear.
This is the single change most likely to make it feel weaker than Whiteout.

### D3 — placement count per tick
**ORIGINAL** `fullplace` (12640) tops up to **4** non-overlapping placements per
tick, capped further by `ppAmt < 2` for preplace-priority and `secPacket <= 60`.
**CHANGE** One Preplace intent per tick.
**REASON** *Your instruction* — "Do not spam predicted placements" (PREPLACE
DESIGN), reinforced by the packet analysis (one preplaced object already costs
11 packets/tick ≈ 99/s against ~120).
**EXPECTED RESULT** Far lower packet load, materially less board coverage per
tick than Whiteout.

### D4 — scoring table
**ORIGINAL** `gradeAngles` (12348): `+8` confirmed bounce, `+4` knocks into a
spike, `+3.5` into a pit trap, `+4.5` spike hits a trapped enemy, `+2.5` retrap,
`(aim1-1.8)*4+1` for an enemy facing away, `−2` blocks our own path.
**CHANGE** `NS_usefulness` — same *shape* (points with penalties) but different
terms and weights, plus escape-route sealing.
**REASON** *Architectural preference*, partly forced: Whiteout's terms reference
its own state (`nearHacker.aim3`, `placePot`, `trapInfo2`) that NovaStorm does
not compute.
**EXPECTED RESULT** Different candidate ranking than Whiteout. Relative
priorities are broadly similar; exact choices will differ.

### D5 — packet cost per placement
**ORIGINAL** Whiteout `place()` (8040) sends 3 packets — it omits the
attack-release `sendAtck(0, …)`.
**CHANGE** NovaStorm's `place()` (4 packets) is used unchanged.
**REASON** *Auto Place compatibility.* `place()` is shared with Auto Place, Auto
Mills, manual keys and healing, and is on the frozen list.
**EXPECTED RESULT** 33% more packets per placement than Whiteout. Correct under
the compatibility contract.

### D6 — replacement detection
**ORIGINAL** Luna `getPrePlaceObject` (11746): `nearestEnemy` only; enemy branch
has no aim cone and no ownership filter; `* 3.3` assumes the tank hat always.
**CHANGE** All nearby enemies; aim cone and ownership applied; hat read from
`skinIndex`.
**REASON** *Duplicate-action prevention and correctness.* Without the ownership
filter, enemy-owned buildings qualify as replace targets. Luna's own branch A
three lines above already has the full filter set.
**EXPECTED RESULT** Fewer, better-founded replacements. Fires **less often** than
Luna against an enemy without the tank hat or facing away.

### D7 — replacement selection
**ORIGINAL** Luna's `isPrePlaceAngle` cascade, first match wins; rule 7 is
`if (isTrap) return true` — unconditional.
**CHANGE** Loss/recovery gating (`loss >= LOSS_MIN`, `recov >= loss × 0.8`).
**REASON** *Your instruction* — "Do NOT replace merely because replacement is
technically possible" (REPLACE DESIGN).
**EXPECTED RESULT** Materially fewer replacements than Luna, which replaces
anything doomed within weapon range.

### D8 — validation timing
**ORIGINAL** Luna validates once, at decision time.
**CHANGE** Re-validated at commit (`NS_revalidate`).
**REASON** *Your instruction* — STALE ACTION PREVENTION — and Whiteout's `check3`.
**EXPECTED RESULT** Some sends Luna would make are cancelled. Fewer rejected
placements; a small number of legitimate ones lost to conservatism.

### D9 — the second send
**ORIGINAL** Luna re-sends unconditionally at `111 - minPingTime` whenever a
doomed object exists.
**CHANGE** Removed. Replace commits once; a retry requires evidence the first
did not land (`spawnedObjectSids`).
**REASON** *Duplicate-action prevention*, plus a genuine defect:
`minPingTime` starts at `Infinity`, so `111 - Infinity` clamps to 0 ms and the
retry fired **before** the tick body had decided anything.
**EXPECTED RESULT** Roughly half the packets. If the server drops the first
send, the replacement now lands a tick later than Luna's would.

### D10 — confidence gate
**ORIGINAL** Whiteout has **no** confidence gate. `autoplacers` runs whenever
`configs.autoPlace && nearHacker.sid && dist3 <= placeRange`.
**CHANGE** `conf < CONF_MIN` aborts before any sweep.
**REASON** *Your instruction* — "Unreliable prediction → do not execute"
(PREPLACE DESIGN).
**EXPECTED RESULT** Preplace stands down on erratic enemies where Whiteout would
still place. **This is the largest behavioural difference in normal play.**

### D11 — Auto Place yield
**ORIGINAL** Neither source defers to a separate autoplacer: in Whiteout they
are the same system; Luna's Preplace queues first and wins.
**CHANGE** Any angle `isAutoPlaceAngle` claims is skipped.
**REASON** *Auto Place compatibility* — your explicit requirement.
**EXPECTED RESULT** Measured: with the enemy trapped, Auto Place's rule A3 claims
**55 of 55** placeable spike angles, so Preplace queues nothing in that state.

### D12 — Spike Tick deference
**ORIGINAL** Whiteout's placer sets `instaC.canZpykeTick` and places anyway.
**CHANGE** Preplace and Replace stand down entirely while a tick is live, and
avoid the `scale + 55` annulus.
**REASON** *Spike Tick compatibility* — your explicit requirement.
**EXPECTED RESULT** No placement during tick windows.

### D13 — `prioLoc` reservations not ported
**ORIGINAL** Whiteout reserves preplace locations in `prioLoc` so its reactive
placer avoids them.
**CHANGE** Not ported.
**REASON** *Defect in the source.* `prioLoc` is `const prioLoc = []` (1890) with
six push sites, three read sites and **no clear anywhere** — an unbounded array
that progressively disables the reactive placer over a session.
**EXPECTED RESULT** No leak. Cross-system avoidance is instead handled by the
existing `addPredictObject` dedup.

### D14 — angle helper and stationary test
**ORIGINAL** Whiteout's `dAng` (14818) never wraps; its stationary test is
`(xVel + yVel) <= 7`, a signed sum.
**CHANGE** `UTILS.getAngleDist`; `Math.hypot`.
**REASON** *Defects in the source*, both verified numerically —
`dAng(0.1, 6.2)` returns `6.1000` where the truth is `0.1832`; `(-10, +10)`
sums to 0 and reads as stationary.
**EXPECTED RESULT** Correct angle comparisons and correct diagonal handling.

---

## 5. The conflict you need to resolve

Of the fourteen divergences, **four are compatibility-driven** (D5, D11, D12,
plus D6 in part), **three are source defects** (D13, D14, and half of D9), and
**four exist because you asked for them later in this session** in terms that
contradict literal fidelity:

| divergence | the instruction that caused it | what literal fidelity would require |
|---|---|---|
| D3 (1 vs 4 placements) | "Do not spam predicted placements" | restore Whiteout's 4-per-tick top-up |
| D7 (loss/recovery gate) | "Do NOT replace merely because possible" | restore Luna's unconditional trap rule |
| D9 (conditional retry) | duplicate-action prevention | restore Luna's unconditional double-send |
| D10 (confidence gate) | "Unreliable prediction → do not execute" | remove the gate entirely |

I cannot satisfy both readings at once, and I am not going to pick for you.

**Three remaining divergences are mine alone, with no instruction behind them,
and I would close them regardless of what you decide:**

- **D2** — multi-object `assumeBreak` legality. The most valuable single thing in
  Whiteout's live path and I did not port it. Closing this is the highest-value
  work available. **Now the only one left of the three.**
- **D4** — the scoring table's specific weights.

## 6. Options

**A — Fidelity first.** Port `autoplacers` more literally: `assumeBreak`
multi-object legality, `gradeAngles`' actual weights, up to 4 placements per
tick, 200-angle sweep, no confidence gate; and restore Luna's `getPrePlaceObject`
+ cascade + double-send for Replace. Keeps only the compatibility hooks (D5,
D11, D12) and the source-defect fixes (D13, D14). Discards D3, D7, D9, D10 —
i.e. four things you asked for.

**B — Close my three, keep yours.** D1 is done. Remaining: implement D2 (the big
one) and align the scoring weights to `gradeAngles`. Keep the
confidence gate, one-placement rule, loss/recovery gate and conditional retry.
Result: closer to Whiteout everywhere the two are not in direct conflict.

**C — Selective.** Name which of D3, D7, D9, D10 to revert toward source, and I
close D1/D2/D4 alongside.

My recommendation is **B**, then revisit D3 and D10 with live play — the packet
budget is the real constraint on D3, and D10 is the one most likely to make
Preplace feel quiet.
