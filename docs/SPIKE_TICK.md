# Spike Tick (RYN v5.5)

The spike tick is the one thing RYN v5.4 did not have a module for: a spike put
down *because of the moment*, with the weapon hit that makes it a tick landing
in the same server step.

Build output: **`RYN_Client_v5.5.user.js`** (input: `src/RYN_Client_v5.4.user.js`)

---

## What was there before

| Module | What it does | Why it is not a spike tick |
|---|---|---|
| `spikeSync` | Places at `EnemyManager.nearestSpikePlacerAngle` and swings | Gated on `canSpikeSync` — a *destroyed object this tick* plus a placement angle that did not exist last tick. It fires on a resync, not on an opportunity. |
| `spikeSyncHammer` | Hammer a low-HP build, place, swing | Needs a great hammer, a one-shot object and a sync enemy. |
| `knockbackTick` | Hit them so knockback carries them into an existing spike | Explicitly stands down when the target is trapped, and never places anything. |
| `spikeTrap` / `teammateSpikeTrap` | Four spikes in a box | Manual, hotkey-driven. |
| `velocityTick` | Turret gear then polearm across a 220–245 window | A movement combo, not a placement one. |
| `autoPlacer` | Luna's auto place | Computes `canSpikeTick` in `_los` and **never reads it** — the value is dropped. |
| `trapTick` | — | An empty class: `postTick() {}`. |

So the timing question — *is this the tick where a spike is worth five packets
and a swing* — had no owner.

## The module

`SpikeTick` (`moduleName: "spikeTick"`), between `autoPlay` and `autoPlacer` in
the module order: after every insta, sync and defensive answer, before every
placement system.

```
target        EnemyManager.nearestEnemy + PlayerManager.enemies, best
              opportunity wins, held target keeps its place unless a rival is
              clearly better or lethal
motion        the engine's TargetMotion — measured velocity, acceleration,
              stability and confidence; no second predictor
opportunity   contact now / arrival / pinned / trap follow-up / measured gap /
              sealed exit — never proximity
candidates    exact contact angles on the engine's ring, predicted-arrival
              contacts, rebound angles, gap centres, exit mouths
legality      the engine's apertures (continuous free arcs), asked once
scoring       the engine's scorer for the ground + a timing layer for the
              moment (damage now, lethality, arrival, containment, swing)
arbitration   the engine's ledger, the engine's memory, its own ground memory
validation    re-derived against live state immediately before the send
execution     ModuleHandler.requestPlaceMany -> the engine's executor
swing         ModuleHandler intent (useAngle / forceWeapon / forceHat 7 /
              shouldAttack), carried out by UpdateAttack like every other
              combat module
```

Two toggles, Combat → Spikes & Traps:

- **Spike tick** (`_spikeTick`, default on)
- **Spike tick (predict)** (`_spikeTickPredict`, default on) — the predictive
  half only; off leaves contact, containment and gap ticks working.

Counters for a session are on the module: in the console,
`client._ModuleHandler.staticModules.spikeTick.stats`.

## What it will not do

- Fire on proximity. A candidate that cannot touch them now, cannot touch them
  where they are predicted to be, closes no measured hole and seals no exit is
  dropped before it is scored.
- Place a spike whose push sends them into me (`≥ π/5` from "at me"), unless
  they are pinned and cannot be pushed at all.
- Take ground the ledger says is claimed, ground it paid for in the last three
  ticks, or ground the engine's memory says went out this tick.
- Spend the tick when another module has claimed it, or when
  `EnemyManager.shouldIgnoreModule()` says we are the ones about to die.
- Call a hole closed when a player still fits past the spike, or when the hole
  is not on the placement ring in the first place.

## Shared code that changed

Three additive accessors on `RynPlacementEngine` (`aperturesFor`, `evaluate`,
`frameFor`), one extraction (`exitsAround`, lifted out of `sense()` unchanged),
and an optional target argument on `ThreatAnalyzer.build` with its own cache.
The default paths are unchanged; nothing else in the client was touched except
the module registry, the settings defaults and the two menu entries.

## Tests

```sh
node tools/spike-tick-harness.js            # 59 checks, 23 scenarios
node tools/verify-drivers.js RYN_Client_v5.5.user.js
node tools/check-hooks.js RYN_Client_v5.5.user.js    # needs: npm i --no-save terser
node --check RYN_Client_v5.5.user.js
```

The harness slices the real geometry solver, scorer, motion model, placement
memory and reservation ledger out of the built script and runs the real module
against them, so what is under test is the module's decisions rather than a
re-implementation of them.
