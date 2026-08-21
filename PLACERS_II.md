# YoRHa System — Placer II (Preplace 2 / Replace 2)

Build output: **`YoRHa_System.user.js`** (v1.6)

A second placement engine, added beside the one the mod already had. The old
Preplacer and Replace are still in the script, byte for byte, still on their own
toggles. Only one engine is ever allowed to run — see [The lock](#the-lock).

```
Menu → PLACERS → Placer II
    Preplace 2          the new preplacer
    Replace 2           the new replacer
    Instant Replace     refill in the same turn the destroy packet arrives
    Predictive Refill   work the refill out before the break lands
    Spend Traps         let the engine spend traps as well as spikes
    Engage Range        150 .. 500
    Places Per Tick     1 .. 4
    Accuracy Readout    corner panel: accept rate, prediction error, cost
```

---

## The lock

Preplace 2 and Replace 2 close and lock the v1 pair. Switch either one on and
the old Preplacer and Replace go off, grey out, grow a **LOCKED** chip and stop
answering clicks; their tooltip names what is holding them. Switch the v2 pair
off and they are clickable again.

It is enforced in three places, because one is not enough:

| Where | What it catches |
|---|---|
| The toggle renderer | The click itself — a locked switch does not flip. |
| `enforcePlacerLocks()` at load | A saved config from an older build carrying both. |
| `yp2Lock()`, every tick | Anything else at all: another script, a bot context, a hand-edited `window.vars`. |

The **Placers** keybind (default `J`) drives whichever engine is the active one.
It never switches engines and never turns on a pair the lock would close again;
which engine that is survives a reload in `window.vars.placerEngine`.

---

## What the engine is

### Recorder

One sample per server tick.

- **Object registry** — every item near you by sid: position, scale, item id,
  trap/damage flags, health, whose it is, when it was last seen.
- **Motion tracks** — the last four positions of every enemy in view.
- **Placement ledger** — every placement the engine asks for is written down and
  then checked against the world for the next four ticks. It either appears
  (confirmed, with the latency in ticks) or it does not (written off). That
  feeds a Laplace-smoothed accept rate per item-and-angle bucket, which is a
  term in the score, so angles the server keeps refusing lose their appeal on
  their own.
- **Sweep** — anything that was in the registry last tick, is well inside the
  view and is not here now is treated as destroyed, whether or not the removal
  came through `killObject`.

The readout (`Accuracy Readout`, or `window.YP2.report()` in the console) shows
what was measured, not what was hoped for:

```
PLACER II  LIVE
preplace on   replace on
placed 41  (instant 7)
confirmed 38 / lost 3   92.7%
land 1.02 ticks   err 4.7 px
decide 88 us   angles 27
```

### Predictor

- **Enemy motion** — second order: position + velocity + acceleration, each term
  from the recorder's track, clamped to what a player can actually cover in a
  tick (42 px) and to a sane acceleration. The game's own guess is first order
  (`xVel = x2 * 2 - lastX`), which is exact for a straight line and wrong the
  moment somebody turns or accelerates — the case that decides fights. Held
  enemies are predicted as stationary, at full confidence, because they are.
  Every prediction is scored against what arrives next tick; the measured error
  is on the readout.
- **Break risk** — for each building of ours: its health against the damage the
  nearest enemy's *ready* weapon would do at its current range. One hit away
  from death and the engine treats the ground as already open, which is what
  makes a preplacement a preplacement.

### Scorer

Every reachable angle is scored and the best total wins — there is no priority
ladder where the first matching rule ends the search.

| Term | Weight |
|---|---|
| Spike stands on the enemy's path this tick | +100 |
| Spike stands where they are going (× confidence) | +135 |
| ...the tick after that | +62 |
| Knockback drives them into another of our spikes (× alignment) | +74 |
| Trap lands on their predicted position | +125 |
| Trap lands on them now | +60 |
| Trap stacked on a held, bleeding enemy | +48 |
| Each escape lane the placement closes | +24 |
| Ground that is one hit from opening | +22 |
| Ground just freed (replace) | +55 |
| Takes ground the enemy was about to build on | +26 |
| Learned accept rate for this angle | ±18 |
| Sits on my own escape corridor | −70 |
| Blocks my line to the enemy | −48 |
| Spends one of my last three of that item | −14 each |

Collision is tested the way the server tests it — circle against circle. The v1
path uses `lineInRect`, a bounding box, which over-reports a diagonal approach
by up to 41%: it reports hits that will not happen.

### Executor

- **Preplacements** ride the path that already exists: `addPredictObject(id,
  angle, true)`, sent by the mod's own deferred loop at `111 - ping` ms and
  again at `111 - minPing` when the engine asks for the second burst. The cyan
  ghost still draws; the ~119 packets/second ceiling is still respected.
- **Replacements** can go out in the same turn as the destroy packet, from
  inside `killObject`, which is up to a full tick (≈111 ms) earlier than any
  next-tick path. When Predictive Refill is on, the angle was already chosen
  while the building was still standing, so that path is a validity check rather
  than a search.
- A spot the engine has committed to is reserved for five ticks, so it never
  spends two placements on the same ground — including the case where the
  preplacer already claimed ground that then broke.

---

## Why it is not just the old one retuned

The old pair was left alone deliberately, so this is a comparison, not a
complaint.

- **v1's replacer never reaches the wire.** `rynDoReplace()` queues its refills
  with `addPredictObject()`, and the next statement in the same function is
  `predictObjects = []`. Everything it queued is discarded in the same call; the
  only thing that survives is the `spamPrePlacer = true` side effect. Placer II
  runs *after* that clear, which is why its commits survive.
- **v1's item-limit check never fires.** `isItemLimit()` reads
  `group.sandboxLimit || 99`, so outside sandbox it believes spikes cap at 99
  (really 15), traps at 99 (really 6), turrets at 99 (really 2). Placer II reads
  the real cap the way `ClientPlayer.getItemCount` does, so it stops spending
  packets on placements the server will refuse.
- **v1 measures nothing.** Its only feedback is `bannedAngles`: place, and if the
  ground is still free next tick, ban that exact angle for 18 ticks. Placer II
  keeps a ledger and an accept rate per angle, and the score uses it.
- **Cost.** Placer II builds one neighbourhood per tick — objects within 340 px,
  the only ones a placement can collide with — and works in squared distances
  off that. The v1 path re-scans the full 1000 px visible set, 72 angles at a
  time, several times per tick.

Measured on the test harness with 240 objects in view: **~90 µs of decision time
per tick**, against a 111 ms tick.

---

## Safety

- Every entry point is wrapped. Eight consecutive throws and the engine switches
  itself off, logs once, and the rest of the mod carries on — a placer must
  never cost you a tick.
- State is per player context (a `WeakMap` keyed by bot), so Full-Mod bots each
  get their own recorder and never share yours.
- Nothing outside the placers is touched: 10 anchored edits, four of them one
  line each.
- Bots run Preplace 2 through the normal tick path. The instant replace path
  hangs off `killObject`, which bot worlds do not use — their refills go through
  the tick sweep instead, one tick later.

---

## Build and check

```sh
node tools/build-yorha-placers2.js    # src/YoRHa_System_v1.5.js + engine -> YoRHa_System.user.js
node tools/verify-placers2.js         # hooks, lock, settings, v1 left untouched
node tools/test-placers2.js           # the engine against a simulated fight
node tools/test-menulock.js           # the shipped toggle renderer against a DOM stub
```

Every edit in the build script is anchored to an exact string in
`src/YoRHa_System_v1.5.js`; an anchor that is missing or ambiguous fails the
build rather than producing a half-patched script. Dropping in a newer YoRHa
System surfaces as an error naming the edit that no longer applies.

`verify-placers2.js` re-runs the build and compares it byte for byte with the
committed output, then checks that all ten v1 placement functions
(`getPrePlaceAngles`, `isPrePlaceAngle`, `isAutoPlaceAngle`, `getPrePlaceObject`,
`rynReplacePick`, `rynDoReplace`, `checkPredictObjects`, `addPredictObject`,
`canPlace`, `isItemLimit`) appear in the output verbatim.

Current state: **all verify checks pass, 30/30 engine tests, 24/24 menu-lock
tests.**
