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

---

# Auto Heal Engine (RYN v5.4)

A second, independent build in this repo: **`RYN_AutoHeal.user.js`** — the RYN
v5.4 client with a new Auto Heal engine spliced in as one more module. It is not
an extension of RYN's existing autoheal; it is a separate engine built from the
shipped game bundle, and RYN's own heal paths stand down while it is on.

Full derivation and architecture: **[docs/AUTOHEAL_ENGINE.md](docs/AUTOHEAL_ENGINE.md)**.

```sh
node tools/build-autoheal.js     # src/RYN_Client_v5.4.user.js -> RYN_AutoHeal.user.js
node tools/verify-autoheal.js    # mechanics + wiring + behaviour
node tools/sim-autoheal.js       # scenarios only (SIM_TRACE=1 for a per-tick trace)
```

## What it is built on

The shame rule, whole, from `src/game_index.js:2458`:

```js
if (this.hitTime) {                          // only a PENDING hit is judged
    const W = Date.now() - this.hitTime;
    this.hitTime = 0;                        // the first food after a hit only
    W <= 120 ? (this.shameCount++,
                this.shameCount >= 8 && (this.shameTimer = 3e4, this.shameCount = 0))
             : (this.shameCount -= 2, this.shameCount <= 0 && (this.shameCount = 0));
}
this.shameTimer <= 0 && (V = f.consume(this));   // refused during the lock
```

Four things the engine is shaped by:

- Each damage event is worth `+1` or `-2` depending only on when the *first*
  press after it lands. At 111 ms a server tick, one tick is inside the 120 ms
  window and two are not — so **one tick of patience turns `+1` into `-2`**.
- The press that takes the count to 8 sets the lock *before* `consume` is
  reached: it does not heal, and it buys 30 seconds of not healing. The engine
  never sends it, which is the `SHAME <= 7` objective in one rule.
- A press at full health costs no food (`useRes` is never reached) but still
  runs the shame arithmetic — the cheapest `-2` in the game.
- A charge is paid once per damage event however many presses follow, so a burst
  that pays it fills to full rather than to the floor.

## Twelve modules

State Tracker · Damage Analyzer · Shame Controller · Threat Detector ·
Prediction Engine · Heal Decision Engine · Priority Arbitration · Action
Validator · Cooldown Manager · Anti-Spam Manager · Action Executor ·
Integration Layer.

## The shame control engine

Module 3 is three parts behind one facade, with an objective of its own:
`SHAME <= 7` as an invariant, `0` as the goal.

- **Tracker** — current, previous, delta, increase and decrease rates over a
  5 s window, recent damage, damage frequency, healing state, cooldown state,
  and the zone: `SAFE` 0 · `WARNING` 1-6 · `CRITICAL` ≥ 7.
- **Predictor** — expected damage events over one second × the share that would
  force a charged heal × how *believable* the threat is, giving projected shame
  and ticks-to-critical. Confidence weights each damage source by whether it is
  going to happen (a DoT tick, 1.0) or merely could (someone standing in range,
  0.4). Below 0.4 the engine will not spend food on it.
- **Opportunity** — the earliest valid way down, which is always a *when*:
  `credit-now` (a pending hit past the window), `credit-wait` (one tick away),
  or `bull` (manufacture a hit with the −5 helmet on a quiet field).

What the zones change: at `SAFE`, nothing is owed so nothing is spent chasing
it — top-ups fall back to the food-economy rule. In `WARNING`, every credit
opportunity is taken at the earliest valid moment, and a top-up on a credit tick
is worth more than the food it wastes because it heals *and* takes two off. From
5 up — or as soon as the forecast says the count is heading there — the sustain
floor rises, so health is bought while presses are still free. At 7 no charged
press may leave at all.

**Validation.** Nothing is pressed on a count read at the top of the tick. The
live count, lock and hit stamp are re-read immediately before the wire, the
verdict is re-derived, and the plan is recalculated against what came back —
dropped if the live number says the press would arm the lock, trimmed if health
already came up, otherwise sent under its corrected verdict.

## The threat engine

Module 4 is one engine with eleven detectors, all reading the same per-tick
evidence gathered by the adapter. The damage number stays Combat's own; what
the detectors add is the shape of the threat.

`instakill` · `spike-tick` · `insta-rev` · `musket` · `bow` · `spam-dagger` ·
`velocity-tick` · `spike` · `trap` · `burst` · `sustained`

Each reports `{type, confidence, severity, timing, evidence[]}` with confidence
on `NONE / LOW / MEDIUM / HIGH / CRITICAL`, and every one is built on the same
rule: **evidence, not possession.** A musket ball in the air on a line to me is
a threat; a musket in someone's hands is not. A held ranged weapon is only
reported when it is loaded, pointed at me, and either inside half its own reach
or freshly switched to — and never above `MEDIUM`, because nothing has been
fired. Four armed enemies standing around doing nothing produce no report at
all, which the simulator asserts.

Timing feeds the decision rather than decorating the log: the hold-for-the-shame
window question asks the engine how much damage can actually land inside the
wait, so an exchange whose next hit is three ticks away is answered with a `-2`
instead of a `+1`.

## The decision: a price, not a threshold

`IF HP < X THEN HEAL` cannot answer the real question, because the same 40
health is worth different amounts depending on what it costs — nearly free at
shame 0, and at shame 6 it spends the last charge between you and a 30 s lock.
So module 6 prices every candidate twice, in health-equivalent points: once for
pressing **now**, once for pressing **next tick**. The larger number wins and
the reason it won is the reason reported.

Prices are anchored to the game, not to tuning knobs: overheal is thrown away,
a life is three bars, food is free until the larder runs low, packets cost
nothing until the budget is tight, and a shame charge costs the option it
consumes — `lifeValue / (7 − count)²`, which is ~6 points at count 0, 75 at 5
and 300 at 6. The zone behaviour is that curve, not a set of `if`s.

Waiting is not "don't heal" — it is the same heal one tick later, with the
shame arithmetic and the risk changed. A charged press converts to a credit
press if no new damage restamps the clock (the measured hit frequency prices
that); a press that is *already* a credit risks losing it by waiting. The old
heuristics fall out of the pricing rather than being coded.

One rule sits outside the arithmetic: **if waiting kills you, the shame numbers
don't get a vote.** Starting at shame 6 under 55 damage every three ticks, the
engine spends charges, reaches the ceiling and never crosses it — 0 deaths, 0
locks.

Five decisions, each with its reason: `HEAL_NOW` · `WAIT` · `PREPARE` ·
`CANCEL` · `RECALCULATE`. Real reasons look like
`topup: credit worth 128 beats pressing at -45` and
`survival: waiting loses 300 to save 75 of shame`.

**Priority is computed, not declared.** `urgency = severity × confidence ×
1/(1+timing) × (lethal ? 3 : 1)` produces the requested order — survival,
catastrophic, burst, rapid, spike, ranged, dagger, ordinary, shame — and the
verifier asserts that ranking by feeding the function representative cases
rather than trusting the prose. Arbitration against the rest of the client runs
on RYN's own `RPE_PRIORITY` scale through its own `priorityFor`, so a heal
answering a lethal burst is INSTA-class and outranks a sync, while a top-up is
UTILITY and yields to nearly everything.

## Execution: validate, press, commit

Three stages with nothing between them, and no scheduler or delay anywhere —
the verifier greps for the absence of `setTimeout`, `setInterval`,
`requestAnimationFrame` and `queueMicrotask`. A press leaves in the same
synchronous call that decided to send it, which is the only way to be fast in a
client whose tick is 111 ms wide.

**Validate.** Immediately before the wire, ten things are re-read live — HP,
shame, threat, threat confidence, predicted damage, healing availability,
cooldown, player state, combat state and action priority. A changed critical
state produces `CANCEL` (the action was wrong) or `RECALCULATE` (the world
moved, ask again next tick). It reads two already-updated objects; no part of
the decision is redone, because redoing it is what would cost something.

**Anti-spam.** Three layers: the in-flight ledger (latency-scaled) stops the
decision re-asking, a pending-action identity (`heal:<food>:<target>:<class>`)
refuses an identical action while one is still in the air, and an exponential
backoff stops asking when presses stop landing. A press that would land on a
full bar is not sent — that alone takes the poison run from 8 presses to 3, and
the every-tick beatdown from 28 to 19, with identical survival.

**Packets.** The client's own path only: `ModuleHandler.selectItem` / `attack` /
`whichWeapon`. No socket, no frame construction, no opcode names, no second
scheduler. The re-select before each press is required by the game (a successful
consume clears `buildIndex`), but the weapon restore is not — so it happens once
per burst instead of once per press: **three presses cost seven frames rather
than nine.**

**Commit.** Everything the press changed, immediately: the projection moves by
what was bought, shame accounts for the first press of the burst, the pending
action and in-flight ledger are recorded, the cooldown's hold ends, and the
forecast built on the old bar is dropped. Nothing is recomputed in the same
tick — the next tick rebuilds it once.

## Predictive defense

Module 5 acts on the tick *before* the bar moves. Motion prediction is not
rebuilt: the placement engine's `TargetMotion` already does samples, velocity,
acceleration, heading shift, stability, `predict(ticks)` with confidence and
`intercept()`, so the engine borrows that **class** and constructs a private
instance — same code, separate tracks, nothing written into another system's
state. Without the placement engine it falls back to the linear extrapolation
every `Entity` already carries.

It forecasts over 6 ticks from four sources — a projectile already in the air,
an enemy whose course enters weapon reach, someone already in reach, and the
fixed-period DoT tick — and publishes incoming damage, timing, expected health,
expected shame delta, threat duration and confidence.

Three rules keep it from burning food:

1. **A prediction never pays a shame charge.** A charged press is for damage
   that already landed; this hasn't. Not free? Wait — the hit isn't here yet.
2. **HIGH acts, MEDIUM acts on consequence, LOW never acts.**
3. **Compare against the floor at impact, not the floor now.**

Predictions are cached and thrown away by named event —
`target-changed` · `enemy-turned` · `enemy-stopped` (edge-triggered, so standing
still doesn't rebuild every tick) · `projectile-changed` · `collision-changed` ·
`player-moved` · `threat-gone` — with the enemy and projectile reads shared with
the threat engine rather than gathered twice. A still field serves 35 of 40
ticks from cache.

Combat, Auto Place / Preplace / Replace, Spike Tick, Safe Soldier, Anti Smart
Tick, Auto Mills and Velocity Tick are **read only** — for the threat numbers,
the packet budget and the tick claim. Nothing in them is modified or duplicated.

## Measured

`tools/sim-autoheal.js` runs the engine against the game's own rules
transcribed — `buildItem`'s arithmetic, `changeHealth`'s hit stamp and
full-health refusal, the one-second regen counter, `canBuild`'s resource gate —
with latency modelled on both legs. Over twenty-six scenarios: no 30 s lock is
ever armed, nothing is sent while one is on, the count never passes 7, every
scenario that starts in debt ends at 0, and most hold shame at 0 for 100 % of
ticks — including a 90 dps pressure run and a 250 ms ping run. A threat that
never actually swings costs one press and 15 food across 90 ticks; a field of
four loaded, facing enemies who never act produces no threat report and no
presses; a count planted to move between the plan and the press is caught 20
times, with 0 presses sent and 0 locks armed. `verify-autoheal.js` re-runs all
of it against the engine copy pulled back out of the built userscript.

## Two defects in the base it works around

- `Player.maxHealth` is `Math.LN1`, i.e. `undefined` (v5.4:3294, v4:3252). Every
  comparison against it is false and every subtraction `NaN`, so the shipped
  heal rule's `tempHealth < maxHealth` gate can never be true — the autoheal it
  replaces cannot fire. The engine takes max health from the bundle (100).
- `ModuleHandler.heal()`'s shame gate holds one tick and then presses anyway.
  Correct below 7; at 7 it is the press that arms the lock. The engine gates its
  own presses instead.

Neither is repaired in place, so `_autoHealEngine` off restores the shipped
behaviour exactly.

## Notes

- The base client's first-run `webhook.site` beacon is left as it is — it is not
  part of the heal path. The ReUp build strips it; this one does not touch it.
- `_spikeRotation`, `_millRotation` and `_usernameCycler` are excluded from
  Legit Mode — they are cosmetic and naming options, not combat automation.
- Rotation toggles default to **on**, i.e. vanilla behaviour. Luna defaulted
  them off; the mix does not silently change how the game looks on first run.
- `_lowQuality` still freezes all object rotation, as it did in RYN.
