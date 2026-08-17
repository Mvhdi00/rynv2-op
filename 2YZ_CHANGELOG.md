# 2YZ Changelog

## 1.2.0 — game-file audit

Triggered by a direct question: had everything actually been taken from the game
files? A systematic audit against `src/game_index.js` said no. Three whole
classes of game data were missing, and the audit is now part of the test suite so
the answer cannot quietly change again.

### What the audit found

Of the 35 s2c handlers the bundle registers, 1.1 routed **17**. The gaps were not
all cosmetic:

| Missing | Why it mattered |
|---|---|
| **The animal table** | `this.aiTypes` is assigned inside the AI-manager constructor, not to a top-level binding, so the extractor never saw it. Nine animal types with real `dmg`, `colDmg`, `health`, `hitRange`, `hitDelay`, `viewRange` and `hostile` flags — a Bull hits for 20 and MOOSTAFA for 40 with 100 contact damage, and none of it was in the client. |
| **Animals themselves** (`I`, `J`) | `GameState.animals` was declared and never populated. Hostile animals were invisible to the threat model and to targeting. |
| **Projectiles** (`X`, `Y`) | Arrows and bullets in flight were untracked, so Safe Soldier could not see anything ranged coming — it projected turret damage from the hat but not the actual shot. |
| **The alliance roster** (`A`, `4`, `g`, `1`, `2`) | Ownership was inferred from team strings alone, which fails for a structure whose owner has never been a visible player. |
| **Struck structures** (`L`) | A direct "this was hit" signal, stronger than inferring a break from a swing that may have missed. |
| **Leaderboard, shutdown, chat, disconnect** (`G`, `Z`, `6`, `B`) | Smaller, but each is state a complete client keeps. |

Coverage is now **32 of 35**. The three left are cosmetic and the test suite
asserts the list of exceptions rather than the absence of gaps, so a newly
unhandled opcode fails the build: `8` damage text (UPDATE_HEALTH is exact, that
is rounded for display), `7` minimap data, `9` map-ping marker.

### Added

- **`Animal` entity class.** Every stat from `Defs.animals`; motion, trap
  containment and spike contact derived by the same `EntityTracker` pass players
  get, so the shared prediction and placement layers work on animals unchanged.
- **`Projectile` class with dead reckoning.** The server describes a shot once
  plus a range update; `EntityTracker` advances and retires it.
- **Animals in targeting**, score-scaled so a bull never outranks a player who is
  actively fighting you. Passive animals off by default.
- **Animals and projectiles in the damage projection.** Swing damage gated on the
  animal's own `hitDelay`, contact damage applied on touch regardless of cooldown.
- **Alliance roster as the authoritative ally test**, with structure ownership
  re-bucketed whenever it changes.
- **`objectHit` feeds Replace**: a confirmed strike upgrades a predicted break,
  and a structure being hit by an attacker we cannot see gets flagged on its own.
- **Overlay layers** for animals and projectiles.

### Bugs found and fixed

1. **`isEnemyOf` ignored the alliance roster.** It compared team strings only, so
   a player on the server's own roster with no visible team string still read as
   an enemy — and was targeted. Found by the alliance test.
2. **A zero inter-packet delta made every per-tick integration a no-op.**
   `lastTickDelta` came straight from wall-clock gaps, so two packets in the same
   millisecond advanced nothing and a stalled connection advanced everything at
   once. The server steps at a fixed rate, so the observed gap is now clamped to
   [0.5×, 2×] of `config.serverUpdateRate`. Found because a projectile refused to
   expire in the suite.

### Also in this release

- **The menu opens on Escape** instead of Shift+T. Nothing in the bundle reads
  keyCode 27, so this takes a key the game leaves unused. Bound in the capture
  phase, and skipped while an input has focus, because closing the chat box is
  what Escape means when you are typing in it.

### Verification

- **258 assertions** (up from 211), all passing. Four new groups: animals,
  projectiles, alliances, and a packet-coverage audit.
- **165 settings**, every one read.
- 24 events emitted, 24 listened. No unused declarations beyond the `Runtime`
  entry point.

---

## 1.1.0 — completeness pass

The 1.0 build implemented the nine systems the brief named and nothing else. This
release adds every remaining capability the reference clients have, so 2yz is a
complete client rather than a decision engine with gaps around it.

### The gap this closes

1.0 sent exactly four kinds of packet: aim, attack, select, and hat-equip. It
never moved, never upgraded, never bought, never respawned, never chatted, and —
the one real architectural inconsistency — **never broke the trap it was held
in**. Anti Smart Tick decided when *not* to break out of a trap while nothing in
the client ever broke out, so the hold guarded a decision that was never made.
Combat only ever targeted players; a structure is a different kind of target and
had no module.

### Systems added

| Module | What it does | Source concept |
|---|---|---|
| **AutoBreak** | Swing at structures: escape a trap, clear a blocked line, remove a hazard. Closes the Anti-Smart-Tick gap — the hold now vetoes a real action. | NovaStorm `selectWeaponAndBreak` (novastorm_1.4.txt:14021) |
| **Movement** | Anti-knockback, safe walk around hazards, body-block push. The only part of 2yz that steers; off by default. | NovaStorm `canAutoPush` / `isNearestEnemyPushPlayer` (13757, 13780) |
| **AutoUpgrade** | Spend age points, filtered exactly as the game filters its own offer row. | game_index.js:4734 |
| **AutoBuy** | Buy the hats the defensive modules want, so `hat-not-owned` stops being a permanent refusal. | shipped hat/accessory price tables |
| **AutoRespawn** | Rejoin by replaying the game's own spawn payload rather than reconstructing one. | game_index.js:4612 |
| **AutoGather** | Hold the attack for farming, release it when the swing is needed. | NovaStorm `needAutoGather` (15316) |
| **ShameReset** | Burn the anti-heal-spam counter with the draining hat during a lull. | NovaStorm `shouldResetShame` / `hatFc` (15208, 16188) |
| **AutoChat** | Kill lines and idle lines, rate-limited by the game's own `chatCooldown`. | game_index.js:4451 |
| **Overlay** | Targets, prediction, placement candidates, hazards and weapon ranges, drawn on 2yz's own canvas. | game camera maths (4466, 4831) |

### Infrastructure changes

- **Seven new intent types** — `BreakIntent`, `MoveIntent`, `UpgradeIntent`,
  `BuyIntent`, `SpawnIntent`, `ToggleIntent`, `ChatIntent` — each with its own
  `validate()`, so the new actions get the same "never execute stale" guarantee
  as the old ones.
- **Two arbitration lanes instead of one.** `Break` joins the exclusive
  build/attack lane. `Move`, `Upgrade`, `Buy`, `Spawn`, `Toggle`, `Chat` and
  `Defense` are singletons: at most one of each per tick, but they run alongside
  an attack rather than competing with it.
- **Movement dedup rule.** A 2yz steering correction overrides a passthrough
  move in the same tick; without that an anti-knockback correction would be
  undone by the player's own movement packet arriving after it.
- **Runtime runs while dead.** `EntityTracker` now emits `trackerReady` with no
  local player so AutoRespawn gets a turn; the dead path arbitrates only that
  one module.
- **Shame is inferred, not received.** The protocol never transmits the local
  shame count. `ShameReset` watches heals: one that moved the health bar lowers
  the count, one that did not raises it. Documented as inference, not fact.
- **Config gains a `text` leaf type** for the upgrade order, shopping list and
  chat lines, with a matching input in the generated menu.

### Verification after the change

- **211 assertions** (up from 131), all passing. Eleven new groups cover each new
  module, the new arbitration lanes and every new packet path.
- **156 settings** (up from 101), every one read by the code — the fake-setting
  check still fails the build on an unread key.
- Static sweep clean: no unused declarations beyond the `Runtime` entry point,
  18 events emitted and 18 listened, no duplicate declarations.
- `verify-drivers.js ReUp_Mix.user.js` still passes.

---

## 1.0.0 — initial build

2yz built from scratch against `src/game_index.js` / `src/game_vendor.js`, with
behaviour extracted from NovaStorm 1.4, Whiteout v4, Luna 1.1.1 and TND. See
`2YZ_SOURCE_MAP.md` for what came from where, and `2YZ_ARCHITECTURE.md` for how
it fits together.

### Files created

| File | Lines | Purpose |
|---|---|---|
| `src/2yz/00-log.js` | 34 | Error collapsing |
| `src/2yz/01-defs.js` | 160 | Game constants, ids, opcode maps |
| `src/2yz/02-utils.js` | 111 | Geometry transcribed from the game |
| `src/2yz/10-transport.js` | 502 | msgpack, opcode permutation, HMAC, socket hook |
| `src/2yz/11-net.js` | 68 | RTT and frame accounting |
| `src/2yz/20-gamestate.js` | 298 | World model + event bus |
| `src/2yz/21-router.js` | 286 | Wire → state |
| `src/2yz/22-tracker.js` | 251 | Derived per-tick state |
| `src/2yz/30-prediction.js` | 250 | The one movement model |
| `src/2yz/31-targeting.js` | 182 | The one target system |
| `src/2yz/40-placement.js` | 353 | The placement engine (WHERE) |
| `src/2yz/41-combat.js` | 304 | Combat engine and burst sequences |
| `src/2yz/50-mod-autoplace.js` | 96 | Auto Place |
| `src/2yz/51-mod-preplace.js` | 171 | Preplace |
| `src/2yz/52-mod-replace.js` | 195 | Replace |
| `src/2yz/53-mod-spiketick.js` | 105 | Spike Tick |
| `src/2yz/54-mod-antismarttick.js` | 163 | Anti Smart Tick |
| `src/2yz/55-mod-safesoldier.js` | 181 | Safe Soldier |
| `src/2yz/56-mod-autoheal.js` | 112 | Auto Heal |
| `src/2yz/57-mod-automills.js` | 124 | Auto Mills |
| `src/2yz/58-mod-autobreak.js` | 198 | Auto Break |
| `src/2yz/59-mod-movement.js` | 205 | Movement: anti-knockback, safe walk, push |
| `src/2yz/5a-mod-autoupgrade.js` | 88 | Auto Upgrade |
| `src/2yz/5b-mod-autobuy.js` | 77 | Auto Buy |
| `src/2yz/5c-mod-autorespawn.js` | 52 | Auto Respawn |
| `src/2yz/5d-mod-autogather.js` | 67 | Auto Gather |
| `src/2yz/5e-mod-shamereset.js` | 98 | Shame Reset |
| `src/2yz/5f-mod-autochat.js` | 82 | Auto Chat |
| `src/2yz/73-overlay.js` | 234 | Visual overlay |
| `src/2yz/60-intent.js` | 323 | Intent types |
| `src/2yz/61-arbiter.js` | 136 | Arbitration |
| `src/2yz/62-scheduler.js` | 319 | The one packet scheduler |
| `src/2yz/70-config.js` | 621 | Config schema (101 settings) |
| `src/2yz/71-ui.js` | 223 | Menu, generated from the schema |
| `src/2yz/72-debug.js` | 134 | Debug panel and journal |
| `src/2yz/80-runtime.js` | 147 | Wiring and tick loop |
| `tools/build-2yz.js` | 77 | Build |
| `tools/verify-2yz.js` | 235 | Static audit |
| `tools/test-2yz.js` | 1739 | Headless behavioural suite |
| `2yz.user.js` | — | Build output |
| `2YZ_SOURCE_MAP.md`, `2YZ_ARCHITECTURE.md`, `2YZ_CHANGELOG.md` | — | Docs |

### Files modified

- **`tools/extract-drivers.js`** — added `probeConsumables`. Food healing is not
  a field in the shipped item table; the game encodes it as
  `consume: function(e) { return e.changeHealth(20, e) }` and a JSON dump drops
  the function. The extractor now runs each item's own `consume()` against a
  recording stub and records the result, adding `heal` (apple 20, cookie 40,
  cheese 30) and `healOverTime` (cheese `{perTick: 10, ticks: 5}`). This is the
  only change to a pre-existing file.
- **`drivers/game-drivers.json`** — regenerated; gains the two fields above.
  `tools/verify-drivers.js ReUp_Mix.user.js` still passes against it.
- **`README.md`** — 2yz section added.

No source client was modified. `ReUp_Mix.user.js` and `src/RYN_Client_v4.js` are
untouched; 2yz shares nothing with them but the game bundles and the drivers file.

### Algorithms implemented

**Transport** — msgpack encode/decode; seeded Fisher–Yates opcode permutation
(`Oi`/`Po`); SHA-256 and HMAC-SHA256 (`Vt`/`Ao`), truncated to the protocol
signature width; frame assembly `[6-byte MAC][msgpack([opcode, args, seq])]`.
All transcribed from `src/game_index.js:292-490`.

**Prediction** — the game's own player integrator
(`src/game_index.js:2330-2374`), expressed as the per-tick displacement
recurrence `D(n) = D(n-1)·playerDecel^f + playerSpeed·mult·f²`, with three
branches (accel / decel / hold) selected per entity per tick by replaying the
last observed step and keeping the best fit. Fit error and turn sharpness produce
a confidence figure that every module gates on differently.

**Placement scoring** — ring sweep with boundary detection (an angle whose
placeability differs from its neighbour's sits flush against a structure);
swept-interception test against the target's predicted path; knockback-chain
scoring by angular agreement between push direction and follow-up spike; escape
angle sampling before and after a candidate; line-of-sight and path penalties.

**Combat sequencing** — multi-tick bursts with per-step revalidation; pair
ordering derived from the shipped range table; a three-way commit gate (raw
damage, target held, or knockback chain available).

**Reload inference** — the server broadcasts every swing (`ATTACK_ANIM`), and
cooldowns are in the weapon table, so reload state is reconstructed for every
player including weapons 2yz never sees them select.

**Damage projection** — itemised per source (each enemy slot gated on reload,
reach and shield arc; turret gated on its own fire rate; structure contact;
knockback-into-spike), capped, and reported after the defensive hat's own
multiplier.

**Arbitration** — validate, apply holds conditionally on rank, score by
`urgency × (0.5 + 0.5 × confidence)`, one exclusive lane winner, frame budget
reserved before execution.

### Bugs fixed relative to the sources

1. **Item limit read the wrong field.** NovaStorm and Luna both compute
   `limit = (group.sandboxLimit || 99)`, which outside sandbox caps spikes at 99
   (real cap 15), traps at 99 (6), turrets at 99 (2) and mines at 99 (1) — so the
   gate never fires. `Defs.groupLimit` uses `sandboxLimit` only when
   `config.inSandbox` and falls back to `group.limit`.

2. **Food heal read a field that no longer exists.** NovaStorm's `heal()` divides
   by `items.list[id].heal`; the current bundle has no such field, so the loop
   would divide by `undefined`. Fixed at the extractor by probing `consume()`.

3. **Priority ladders masked their own later clauses.** `isAutoPlaceAngle` and
   `isPrePlaceAngle` return `true` on the first matching condition, so a spike
   that hits the target *and* blocks the player's own swing is accepted without
   the blocking test ever running. Replaced by additive scoring.

4. **Unbounded defensive wait.** `doSmartTickAnti` re-derives its wait every tick
   with no ceiling, so a patient enemy can hold the client in a trap
   indefinitely. `defense.antiSmartTick.maxHoldTicks` bounds it.

5. **Hard-coded damage figures.** NovaStorm's projection uses literal `45` for
   spike damage and `25` for turret damage. 2yz reads the actual structure's
   damage and the projectile table.

6. **Sequences that could not be cancelled.** TND's `doInsta` holds state in
   module-level flags across `await nextTick()`; a target lost mid-await can leave
   `instaing` stuck true. `Sequence` is owned by `CombatEngine` and killed on
   `targetSwitched`.

7. **Packets emitted outside any scheduler.** TND calls `ee.send` from inside
   combat routines; Whiteout's `chainPlace` fires from a `setTimeout` regardless
   of whether the prediction survived. In 2yz nothing but `PacketScheduler`
   reaches the socket, and every action is revalidated one frame before the write.

8. **Turret cooldown never started.** Found by the dead-code audit: `turretReady`
   existed but nothing ever marked a turret as fired, so it always returned true
   and Safe Soldier counted turret damage on every tick. Wired to the
   `SHOOT_TURRET` packet.

### Conflicts resolved

- **Auto Place vs Preplace** — Auto Place declines below its confidence floor and
  Preplace declines on a stationary target, so the two do not both bid on the same
  situation. When both do bid, Preplace carries higher urgency.
- **Spike Tick vs Auto Place** — Spike Tick outranks ordinary placement (75 vs 50)
  because its window closes when the holding trap breaks.
- **Anti Smart Tick vs everything** — expressed as a `HoldIntent` blocking
  `Placement` and `Replace` but *not* `Attack`, and only winning when it outranks
  the best intent of the kind it blocks.
- **Auto Heal vs Combat** — heal urgency scales with lethality (95 lethal, 62
  danger, 25 top-up) against combat's 70/55, so a lethal projection wins and a
  routine top-up does not interrupt a burst.
- **Auto Mills vs everything** — urgency 5, plus its own suppression: any enemy
  within 500, being held or hurt, an active combat sequence, an armed preplace,
  a resource floor, or a frame floor. It withdraws rather than losing, so the
  Arbiter never has to choose between a mill and a spike.
- **Combat's damage hat vs Safe Soldier's defensive hat** — both are intents;
  the Arbiter picks by priority instead of by source order.

### Tests performed

`node tools/test-2yz.js` — **131 assertions, all passing**. The client is built
exactly as shipped and run in a vm sandbox with a fake socket; nothing inside it
is stubbed.

| Group | Assertions | Covers |
|---|---|---|
| transport | 5 | msgpack round-trip across every value class; opcode permutation matched against an independent re-implementation of the game's algorithm over five seeds; frame signature matched against Node `crypto` HMAC-SHA256; payload shape `[opcode, args, seq]`; sequence increment |
| world model | 10 | spawn, player tracking, object add/remove, ownership bucketing, health, kill-all-objects, store packets, real item caps |
| prediction | 6 | leads a straight-line target; confidence high when steady and collapsed on reversal; direction-change detection; stationary target predicts to itself; per-tick caching |
| targeting | 6 | selection, nearest of equals, candidate listing, switch hysteresis, dropped when gone, teammates excluded |
| placement engine | 10 | sweep resolution, open ground, ranking order and reasons, best faces target, occupied positions rejected by the game's collision rule with a reason, boundary detection, `stillValid` refusal |
| auto place | 5 | produces intents in range, correct type, validates clean, silent out of range, enable toggle actually gates |
| preplace | 6 | arms on steady movement, does not fire immediately, interception point leads the target, disarms on direction change rather than firing stale, releases on its timer, ignores a stationary target |
| replace | 6 | swing marks a breakable structure doomed, offers a replacement into the gap, lands inside the footprint, validates while doomed, dropped once already broken, a swing that cannot break marks nothing |
| spike tick | 6 | no window without a trap, target reads as held, window opens with hammer ready, produces a placement, outranks ordinary placement, unbreakable trap closes the window |
| anti smart tick | 6 | silent while free, detects the setup, produces a hold, blocks placement but not combat, hold is bounded, counter resets |
| safe soldier | 6 | zero projection from distance, projects from a weapon in reach, offers the hat, capped, itemised, no re-equip of a worn hat |
| auto heal | 8 | silent at full, heals when hurt and calm, count covers missing health, frame cost, validates, drops when full, refuses past the shame ceiling, count clamped by budget |
| auto mills | 6 | builds when idle and safe, lowest urgency, spread not stacked, withdraws near enemies, reports why, withdraws at the resource reserve |
| combat | 9 | no burst without a reason, knockback chain justifies the pair, long-reach primary swings second, both slots used once, weapons named per slot, second step follows, does not finish into a vanished target, quiet with no target, no swing out of reach |
| arbitration | 9 | one exclusive winner, higher priority wins, loser records why, confidence scales priority, weak hold loses, strong hold vetoes, invalid dropped before ranking, unaffordable refused, defense rides along |
| packet scheduler | 8 | placement emits frames, flush reported, select precedes attack, press/release pair, repeated aims collapse, sub-epsilon aim dropped, budget overrun dropped not queued, cancelled sequence frames never sent |
| full loop | 8 | 120 ticks of approach / circle / retreat / erratic movement with two enemies and every module live: no errors, still sending, budget never exceeded, at most one exclusive action per tick; death clears state, dead client offers nothing, respawn restores, objects load after respawn |
| config | 5 | every key has a value, numeric clamping, `section()`, reset, every setting has a label and a description |

Scenarios from the brief and where they are covered: normal gameplay, enemy
approaching / retreating / changing direction, close combat, enemy trapped and
multiple enemies (full loop, prediction, targeting); each module (its own group);
simultaneous actions and conflicting intents (arbitration); packet limitations
(arbitration, packet scheduler); stale predictions (preplace, auto place);
invalid targets (targeting, combat, replace).

### Static analysis

`node tools/verify-2yz.js` — all checks passing:

- 101 config keys, every one read; every `Config.get`/`Config.section` names a
  real key. Deliberately regression-tested by inserting a setting nothing reads
  and confirming the build fails.
- 17 c2s opcodes, each matched to an `O.send` site in the shipped bundle.
- 31 s2c opcodes, each matched to a handler key in the bundle's `O.connect` map.
- Protocol scalars (`signatureBytes`, `tableSalt`) and `playerDecel` matched
  against the bundle directly.
- No reference-client identifier (`NovaStorm`, `Whiteout`, `getPrePlaceAngles`,
  `doSmartTickAnti`, `chainPlace`, `MOHCORE`, …) appears in 2yz code. Comments
  cite them; code does not.
- 39 top-level declarations, no collisions across modules.

Additional sweeps run and cleared during the audit:

- Unused top-level declarations: only `Runtime`, which is the entry point called
  by the build epilogue.
- Uncalled inner functions: none.
- Emitted-but-unheard events: none (16 emitted, 16 listened). `objectAdded`,
  `configChanged`, `configReset` and a `SHOW_TEXT` handler were removed as dead;
  `preplaceArmed` / `preplaceDisarmed` / `preplaceReleased` / `intentDropped` /
  `sequenceCancelled` were given a consumer in the debug journal.
- Dead members removed: `U.angleDiff`, `Transport.session.socketId`,
  `Defs.ACC` with `DefenseIntent.accessory` and its scheduler branch,
  `Log.setQuiet` / `Log.clear`, `EntityTracker.markTurretFired` (replaced by the
  `turretFired` event).
- Duplicate listeners: none. Duplicate schedulers, prediction layers or target
  systems: none, by construction — there is one of each and the verifier's
  duplicate-declaration check would catch a second.

`node --check 2yz.user.js` passes on the build output.
