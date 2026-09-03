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

### Single target lock

RYN ships **two** copies of the preplace / replace engine — `AutoPlacer` and
`AutoRetrap` — and each one opened its tick with its own
`EnemyManager.nearestEnemy` read. Two independent selectors on the same frame,
with no memory between ticks: with two enemies at roughly equal range the two
modules could pick differently, and either could flip back and forth every
tick, throwing away the candidate set it had just derived.

`TargetLock` is now the one selector both go through. It runs first in the
module list, so everything downstream sees the same `ActiveTarget`:

```
closest valid enemy inside _autoplacerRadius
  -> ActiveTarget            (held through a switch margin)
  -> predicted position      (one tick of travel + ping lead)
  -> preplace / replace candidates
  -> trap gap fill
  -> aim circle
```

- **Validity** is the client's own definition, not a new one: the entry has to
  be in `PlayerManager.enemies` for the current tick — which is what makes it
  alive, visible, not a teammate and not one of our own bots — still an enemy
  by clan, and carrying a position.
- **Switching** needs the challenger to be `_targetSwitchMargin` units closer
  (default 60) *and* at least two ticks since the last switch, so A → B → A
  thrash cannot happen. Death, invalidity or leaving the hold range releases
  the lock immediately.
- **Cost**: one update per game tick, never per frame. The candidate loop is
  skipped entirely when a target is held and only one enemy is visible; when it
  does run it is one squared-distance pass over the visible enemy list.
- **Staleness** is tracked by a generation counter that bumps on every acquire
  and release. Both placers drop their candidates, bans and cached gap on a
  bump, and the gap-fill candidate re-checks the generation again in the
  preplace timers, milliseconds before the packet goes out.
- **Prediction**: `pos.future` is exactly one tick of travel; the ping lead
  stretches it by the trip the placement packet still has to make, capped at
  two extra ticks. The placers work against that predicted point; the aim
  circle stays on the current position.

`_targetLock` off restores the old per-module `nearestEnemy` behaviour exactly.
Glotus parity mode (`_glotusPlacer`) is a separate placer that replaces this
one wholesale and is deliberately left on its own line-for-line target
selection.

The **aim circle** (`_aimCircle`) draws a ring on the locked enemy and a faint
ring for the targeting radius around the local player. It reads `TargetLock`
and draws; it never selects anything, and because it keys off the render
entity's interpolated position it follows the target at frame rate with no
smoothing of its own. `RYN._TargetLock` exposes the live lock from the console.

### Trap enclosure gap fill

A tactical layer on top of the placer, not a new placer. When the locked target
is boxed in, `_trapGapFill` works out which openings are left, which one the
target is running for, and fills that one with a single spike.

- **Enclosure** uses the game's own collision rule from `checkCollision`: an
  `ignoreCollision` object does not push a player, with the one exception of a
  trap, which locks the movement of anyone who is not its owner and not on the
  owner's team. Under three blockers is not an enclosure; the gaps come from
  the placer's existing `SiegeAnalysis.isEscapable`.
- **Candidates** are the spike angles the placer already computed and cached
  this tick — no second scan — filtered to those standing in an opening. Every
  search pass stays anchored to a real opening, so an unreachable gap produces
  no placement rather than a spike dropped somewhere near the target.
- **Scoring** weighs sealing the route and standing in it above raw closeness,
  so a slightly farther spike that closes the escape beats a closer one that
  does nothing.
- **Execution** goes through `_addPredictObject` and the placer's existing
  preplace timers. No new scheduler, no new packet path.
- **Spike Tick is never touched.** The layer stands down while Spike Tick is
  the active module and on the tick before a committed Spike Tick placement,
  and rejects any angle already reserved in `ModuleHandler.placeAngles`.
- **Breaking a trap** is analysed, not performed. When one of my own traps is
  the wall a spike belongs in, the layer names it and works out where the spike
  goes once it is gone (`RYN._myClient._gapFillBreak`), then places nothing —
  issuing the break would mean choosing a weapon and an attack angle, which is
  a second scheduler and an override of Spike Tick's decisions. The prepared
  spike goes in by itself on the first tick that angle frees up.

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
ReUp_Mix.user.js               build output — the RYN v4 / Luna mix
Ryn_Type_2_TargetLock.user.js  build output — RYN Type 2 with the target lock
drivers/game-drivers.json      protocol + data tables extracted from the bundle
src/RYN_Client_v4.js           base client for the mix (input)
src/Ryn_Type_2.js              RYN Type 2 v5.4 (input)
src/Luna_Client_1.1.js         Luna client, kept for reference (input)
src/game_index.js              game bundle: protocol, data tables, engine
src/game_vendor.js             game bundle: msgpack codec, polyfills
refs/                          five reference clients read for prior art (inputs)
tools/extract-drivers.js       game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js        client tables vs. drivers/game-drivers.json
tools/check-hooks.js           bundle-rewrite hooks vs. the game bundle
tools/test-target-lock.js      behaviour tests, ReUp build
tools/test-ryn-type2.js        behaviour tests, Type 2 build
tools/build-reup.js            src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/build-ryn-type2.js       src/Ryn_Type_2.js -> Ryn_Type_2_TargetLock.user.js
```

## Build

```sh
node tools/extract-drivers.js    # refresh drivers from src/game_*.js
node tools/build-reup.js         # produce ReUp_Mix.user.js
node tools/build-ryn-type2.js    # produce Ryn_Type_2_TargetLock.user.js
```

Every edit in `build-reup.js` is anchored to an exact string in the base
client, and an anchor that is missing or ambiguous fails the build. Dropping in
a newer RYN will surface as a build error rather than a half-merged script.

## Verification

```sh
node tools/verify-drivers.js ReUp_Mix.user.js
node tools/check-hooks.js ReUp_Mix.user.js     # needs: npm i --no-save terser
node tools/test-target-lock.js ReUp_Mix.user.js
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
- **Behaviour** — 67/67 target-lock and gap-fill tests pass, and all 128 menu
  inputs across the four pages resolve to a real setting.

`test-target-lock.js` slices the classes under test straight out of the built
`ReUp_Mix.user.js` and runs them against stand-ins for the game objects, so it
tests the shipped code rather than a copy of the logic. It covers selection,
the switch margin, validity, the ping-compensated prediction and the per-tick
scan budget; and for the gap fill: enclosure detection, escape-route choice,
the Spike Tick stand-downs, anti-duplicate, the replace threshold, trap
ownership, and the full sealed-box → identify the blocking trap → place once it
is gone cycle.

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

- `_spikeRotation`, `_millRotation`, `_usernameCycler` and `_aimCircle` are
  excluded from Legit Mode — they are cosmetic and naming options, not combat
  automation. `_targetLock` and `_trapGapFill` are placement behaviour and stay
  inside it.
- Rotation toggles default to **on**, i.e. vanilla behaviour. Luna defaulted
  them off; the mix does not silently change how the game looks on first run.
- `_lowQuality` still freezes all object rotation, as it did in RYN.

---

## RYN Type 2

`src/Ryn_Type_2.js` is a different client from the v4 the mix is built on —
v5.4, no `AutoRetrap`, no Glotus parity mode, and a full placement engine
(`RynPlacementEngine`, with `CandidateGenerator`, `AngleSolver`,
`PlacementScorer`, `PlacementPlanner`, `PreplaceBook` and a `TargetMotion`
tracker) where v4 has a pair of hand-rolled placers. So the same two features
were re-derived against its own structures rather than transplanted:
`tools/build-ryn-type2.js` → `Ryn_Type_2_TargetLock.user.js`.

**Single target lock.** Type 2 reads `EnemyManager.nearestEnemy` in two
independent places: `ThreatAnalyzer.build()`, which is the frame every mode of
the engine works from, and `AutoPlacer.postTick()`. Both now take the one
`ActiveTarget`, so preplace, replace and the autoplacer cannot disagree about
who they are working. Selection, the switch margin and the validity rule are
the same as in the mix.

Prediction is **not** reimplemented here. The engine already carries
`TargetMotion` — velocity, acceleration, heading stability and a confidence,
bounded by the game's own speed decay — which is strictly better than
extrapolating `pos.future`, so `TargetLock` asks it for the predicted point at
a ping-derived lead (`round(pong / TICK) + 1`, capped at the engine's own
`RPE_PREPLACE_MAX_LEAD`) and falls back to `pos.future` only when the engine
has not seen the target yet. `frame.targetNext` becomes that point, so every
candidate the engine scores is scored against where the target is going.

A target switch bumps the generation, which clears the plan, the replace plan
and the preplace bookings — through `PreplaceBook.invalidateAll()`, the book's
own retirement path, so the ledger tokens the bookings were holding go back
rather than leaking.

**Trap enclosure.** The engine already computed an exit list, but only from my
own spikes and traps, and only as a flat "does this candidate stand in some
exit" bonus. That analysis is widened in place rather than duplicated beside
it, so the existing `sealExit` weight keeps working exactly as before:

- The box is read with the game's own collision rule from `checkCollision` —
  an `ignoreCollision` object does not push a player, with the one exception of
  a trap, which locks the movement of anyone who is not its owner and not on
  the owner's team. So *their* traps are not part of *their* box (they walk
  straight through their own), while their spikes are walls whoever owns them.
- The exit the target is actually running for is picked from `TargetMotion`'s
  heading, and a new `escapeRoute` / `escapeRouteHeld` weight rides on top of
  `sealExit` for candidates standing in it.
- When the box is sealed shut, the trap of mine standing in the way the target
  is going is identified and published on `RYN._myClient._gapFillBreak` —
  alignment with the escape route decides, distance only breaks ties, so a ring
  of traps at equal range cannot pick arbitrarily. It is reported, never acted
  on: issuing the break would mean choosing a weapon and an attack angle, which
  is a second scheduler and an override of the spike-tick modules' decisions.

Two `nearestEnemy` reads survive on purpose — `AutoPlay` (circle-strafe
movement) and `AntiTrapStar` (a defensive placement around me). Neither is the
preplace/replace engine, and locking them would be modifying unrelated systems.

### What the reference clients changed

`refs/` holds the five clients this work was supposed to be read against and
originally was not: `x18k_Original_5.3.js`, `Aurora_Client_v5.5.js`,
`13ms_laffer_v2.js`, `COOKIE_CaraMila.js`, `luminary_fixed_3.1.0.js`. They are
inputs, not build sources — nothing is copied out of them. Reading them changed
four things.

| | Corpus | Was here | Now |
|---|---|---|---|
| Target selection | laffer re-sorts every enemy by distance every tick (`13ms_laffer_v2.js:14106`); nothing holds a target, nothing has hysteresis | one cached lock, switch margin, per-tick scan budget | unchanged — nothing in the corpus is better |
| Free/blocked angles | Aurora holds them as merged angular intervals (`Aurora_Client_v5.5.js:15802` `mergeBlocked`, `:15832` `invertArcs`) | this client already does the same on the *placement ring* (`GeometrySolver.merge`/`invert`) — but the *enemy's* escape used a chord heuristic | escape arcs computed the same exact way |
| Placement angles | laffer sweeps 200 headings and keeps the placeable/unplaceable boundaries (`13ms_laffer_v2.js:12806` `getPerfectAngles`); Aurora solves the same tangency in closed form (`:15717` `closestPossibleAngles`) | the gap only had a scoring bonus, so nothing ever proposed an angle in it | the mouth of the gap is proposed, via the closed-form `contactAngles` the client already had |
| Aim indicator | Aurora eases a ring toward a predicted point at a frame-rate-independent rate (`Aurora_Client_v5.5.js:20636`) | a ring on the entity, no predicted mark | ring stays on the entity; a second, eased marker shows the predicted point the placer is actually aiming at |
| Candidate scoring | x18k scores with a reasons trail — bounce +5, into a trap +2.5, target already trapped +2 (`x18k_Original_5.3.js:14771`) | weighted sum with every term kept on the candidate | unchanged — already the same shape, with more terms |
| Enclosure geometry | nothing in any of the five computes where a boxed-in enemy can still get out | — | — |

**Escape arcs instead of a chord.** `SiegeAnalysis.isEscapable` sorted the
blockers by bearing, paired each with its angular neighbour and measured the
centre-to-centre chord. That never accounts for how much of the circle a
blocker actually covers: an object 300 units away counted as a wall, and one
the target was already standing against counted for no more than a distant one.
`SiegeAnalysis.exitArcs` cuts each blocker's denied cone exactly
(`GeometrySolver.escapeCone` — `asin((selfR + blockR) / d)`, and the half plane
when the target is already overlapping it, where `asin` is undefined), merges
them and inverts. A free arc is then passable by construction. `isEscapable` is
left in place; the non-gap-fill path still calls it.

That makes **coverage** available, and coverage is what decides whether the
target is enclosed — not a count of openings. Three traps in a line beside a
player leave exactly one opening, and the opening is most of the circle; three
around a corner leave one opening too. The old rule ("at most three exits")
called both of them a box.

**The gap is proposed, not just rewarded.** Each exit now carries its two
doorposts, the mouth between them, and a seal point in the middle of it, so
`AngleSolver` proposes the angles that put a spike's footprint on that seal
point. Before, a candidate had to happen to land in the gap for the escape-route
weight to apply to it. When an exit has no two identifiable doorposts it carries
no seal point and proposes nothing — a widening pass that degrades into "any
angle near the enemy" is exactly the spike spam this is meant to avoid.

The weight is now scaled by how much of the mouth the footprint takes away, so
the same spike is worth more in a 90-unit doorway than in a 300-unit one.
Alignment alone scored those the same, and the second one closes nothing.

**Where a spike goes after a break.** Nothing is prepared into ground that is
still sealed. The deletion packet is the trigger: `onVacated` re-senses with the
object gone, the exit the break analysis named becomes a real opening with a
seal point, and the gap proposal aims at it on that same call.

Not added, because the architecture already has it: a per-tick placement
repeat guard (Aurora's `tryPlaceAngle`) and a replace threshold (§14.9). Both
claims are now pinned by tests driving the real `PlacementLedger`,
`PlacementMemory` and `ConflictResolver` sliced out of the built client rather
than argued for in prose:

- ground already sent is refused to any priority at any value;
- a soft reservation yields only to a claim that both outranks it and is worth
  more than `RPE_SOFT_DOMINANCE ×` its value — which *is* §14.9's threshold;
- the same angle twice in one tick is refused, and so is one within the item's
  own angular width, because `PlacementMemory` quantises by footprint rather
  than matching exactly;
- ground a preplace has booked is refused.

The gap layer also stands down entirely while a spike-tick module holds the
tick (`lunaSpikeTickBusy`). That guard reads `ModuleHandler.activeModule`, so
it is only meaningful if spike tick has already run when the engine does — it
has: the six spike-tick modules sit at slots 10–15 of the 62-module list and
`placementEngine` at slot 46. A test pins that ordering, since the stand-down
silently becomes a no-op if it ever changes.

### The survival layer

`tools/inject/survival.js` — shame, threats, defensive gear and the packet
budget, injected ahead of `AntiInsta` and run first in the module list.

**The shame rule, from the bundle.** `src/game_index.js:2454-2469`, with
`changeHealth` at `:2417-2431`:

```js
if (this.hitTime) {                       // set ONLY by damage, :2422
    const W = Date.now() - this.hitTime;
    this.hitTime = 0;                     // CONSUMED by the first eat
    W <= 120 ? (shameCount++, shameCount >= 8 && ban(30000))
             : (shameCount -= 2, clamp0());
}
this.shameTimer <= 0 && (consumed = food.consume(this));
```

Three consequences, and the old code acted on none of them:

1. **Exactly one eat per hit carries a verdict.** `hitTime` is zeroed by the
   first eat, so apples two onward skip the block entirely. The old code
   re-applied the window to every apple of a top-up, rationing sends against a
   rule that could no longer apply to them.
2. **Shame only falls when an eat lands more than 120 ms after a hit.** With no
   `hitTime` an eat moves shame neither way. You cannot heal shame down at
   will — which is why Bull Helmet matters: `healthRegen: -5`
   (`game_index.js:2794`) is the only way to arm a `hitTime` on demand.
3. **The 120 ms is measured on the server.** We learn of the damage one
   downstream latency late and our eat lands one upstream latency late, so the
   server always sees the whole round trip *more* elapsed than we do. The guard
   therefore **adds** ping.

So shame is not a budget to spend down from 7. It is the penalty for answering
a hit too fast, and it costs nothing to avoid.

**What was wrong.** Each of these is a line in the shipped client, not a
suspicion:

| | Was | Now |
|---|---|---|
| Emergency heal | `AntiInsta` commented "the emergency branch deliberately does not wait" and then called `heal()`, which queued it to the next tick boundary at or after +130 ms — up to ~220 ms after the decision | `heal(urgent)`; urgent is the one thing that eats inside the window |
| The window | ping-aware in `isSaveHealTime` (`elapsed + pong >= 125`), ping-blind in `heal()` (`sinceHit <= 130`). At 100 ms ping the caller said safe and the callee queued for another 100 ms | one gate, one formula, ping added |
| Shame target | `healing && shameCount < 7` in three places — 7 as the operating ceiling | verdict-based; 0 is the operating point |
| The ban | the model clamped its own count at 7, so the 7→8 transition was unrepresentable and the 30-second ban was learned afterwards from the Shame! hat arriving | `wouldBan()` predicts it, and it is the only thing that outranks an emergency |
| Schedulers | `ModuleHandler` had one queue, `AntiSync` had another (`_pendingHealDeadline`, `_SHAME_SAFE_DELAY = 139`) | one; `AntiSync` keeps its detection and defers |
| Hat managers | `ShameReset` wrote `forceHat = 7`, the Safe Soldier block wrote `forceHat = 6`, nothing between them | `DefenceState` decides; `ShameReset` defers; Safe Soldier keeps proximity and gains one ORed case |
| Packets | `heal()` dropped silently under 3 free packets; nothing could hold budget against the placers | one `PacketBudget` with priority reservation |

**Not rebuilt.** Spike Tick, Auto Place, Preplace, Replace, Auto Mills,
Velocity Tick and the placement engine are untouched. Safe Soldier keeps all
three of its own conditions and its clear-down branch; one case is ORed in for
the threats proximity cannot see — a turret stack at 600 units, a ranged
sequence, a spike push still closing.

`_survivalEngine` off restores the previous Auto Heal path exactly, including
its own in-flight accounting.

```sh
node tools/build-ryn-type2.js
node tools/test-ryn-type2.js     # 123 passed
node tools/test-survival.js      # 132 passed
node --check Ryn_Type_2_TargetLock.user.js
```

`tools/test-ryn-type2.js` slices `TargetLock` and the enclosure methods out of
the built file and runs them against stand-ins, together with the client's own
`SiegeAnalysis`, `GeometrySolver` and `TargetMotion`, so the prediction and
geometry under test are the real ones.

Type 2's first-run `webhook.site` beacon is **left in place** — this build adds
the two features and changes nothing else. The mix strips it; if you want the
same here, say so.
