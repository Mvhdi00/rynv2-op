# 2YZ Architecture

## The decision that shapes everything else

All four reference clients are forks of the moomoo.io bundle. Each ships a copy
of the whole game plus a shim that re-frames its outgoing packets for the current
transport. That is why they are 850 KB – 2.3 MB: almost all of it is game.

2yz is not a fork and does not patch the bundle either. It attaches one level
below both, **at the socket**, and rebuilds its own view of the world from the
wire.

```
  browser
  ┌────────────────────────────────────────────────────────┐
  │  moomoo.io bundle (untouched)                          │
  │      │ WebSocket.send                    ▲ onmessage   │
  └──────┼────────────────────────────────────┼────────────┘
         │                                    │
  ┌──────▼────────────────────────────────────┴────────────┐
  │  2yz Transport                                          │
  │    decode outbound  ─────► human intent                 │
  │    decode inbound   ─────► world model                  │
  │    the ONLY writer to the socket                        │
  └─────────────────────────────────────────────────────────┘
```

Consequences, and why this was chosen over the alternatives:

- **No minified identifiers anywhere in 2yz.** A bundle-patching client (RYN's
  approach, which this repository already carries) binds 36 hook patterns to
  minified code; a rebuild can unbind them silently. 2yz binds to the *protocol*,
  which is verified against the shipped bundle by `tools/verify-2yz.js`.
- **The game keeps running as itself.** Rendering, UI, input, store and menus are
  the real game's. 2yz never has to reimplement them, which is most of what makes
  a fork enormous.
- **One writer.** The game's own frames are decoded, re-numbered and re-signed by
  2yz before they reach the socket, so `PacketScheduler` can order, deduplicate,
  budget and cancel across both streams. No module can emit a packet behind its
  back — there is no other path.
- **The cost:** 2yz must decode the protocol itself. That is ~200 lines of
  msgpack plus the opcode permutation and HMAC, all transcribed from
  `src/game_index.js` and unit-tested against Node's `crypto` and an independent
  re-implementation of the game's permutation.

## Per-tick flow

Everything is driven by one packet: `UPDATE_PLAYERS` (s2c `a`). Its arrival is
the tick.

```
  UPDATE_PLAYERS
        │
        ▼
  Router ──────────────► GameState          world model: players, objects,
        │                                    inventory, buckets
        │ emit 'tick'
        ▼
  EntityTracker                              velocity, facing, reload clocks,
        │                                    trap containment, spike contact,
        │                                    near-object list
        │ emit 'trackerReady'
        ├──► Prediction                      branch fit + confidence per entity
        ├──► Targeting                       one target, with hysteresis
        ├──► Preplace.invalidate             kill armed placements that went stale
        ├──► Replace.expire                  drop break predictions that lapsed
        └──► Runtime.onTick
                 │
                 ├─ CombatEngine.decide()            ─┐
                 ├─ AutoPlace.tick()                  │
                 ├─ Preplace.tick()                   │  intents
                 ├─ Replace.tick()                    │  (modules never act)
                 ├─ SpikeTick.tick()                  │
                 ├─ AntiSmartTick.tick()              │
                 ├─ SafeSoldier.tick()                │
                 ├─ AutoHeal.tick()                   │
                 └─ AutoMills.tick()                 ─┘
                          │
                          ▼
                    Arbiter.resolve()          validate → apply holds →
                          │                     rank → one exclusive winner →
                          │                     reserve frame budget
                          ▼
                    Scheduler.run()            build packets, dedupe, revalidate,
                          │                     write
                          ▼
                    Transport.write()          frame + sign + native send
```

Listener registration order in `Runtime.start` is load-bearing: Prediction
scores before Targeting ranks, Targeting settles before the modules read it, and
`Runtime.onTick` is registered last so it sees a fully-updated world.

## Modules

### Shared systems

| File | Exports | Responsibility |
|---|---|---|
| `00-log.js` | `Log` | Error collapsing, so a per-tick throw does not flood the console |
| `01-defs.js` | `Defs` | Every game constant, id, table and opcode. Tables injected at build time from `drivers/game-drivers.json` |
| `02-utils.js` | `U` | Geometry transcribed from the game, so range and collision match the server |
| `10-transport.js` | `Transport` | msgpack, opcode permutation, HMAC, WebSocket hook. Owns the sequence counter |
| `11-net.js` | `Net` | RTT from the game's own ping exchange; outbound frame accounting |
| `20-gamestate.js` | `GameState`, `Entity`, `Animal`, `Projectile`, `WorldObject`, `Events` | The single world model, plus the event bus |
| `21-router.js` | `Router` | Wire → state. The only packet interpreter |
| `22-tracker.js` | `EntityTracker` | Derived state, once per tick |
| `30-prediction.js` | `Prediction` | The one movement model |
| `31-targeting.js` | `Targeting` | The one target |
| `40-placement.js` | `PlacementEngine`, `Candidate` | WHERE, for every placing module |
| `41-combat.js` | `CombatEngine`, `Sequence` | Attack decisions and multi-tick bursts |
| `60-intent.js` | `Intent` + 6 subclasses | What a module can ask for |
| `61-arbiter.js` | `Arbiter` | The one decision per tick |
| `62-scheduler.js` | `Scheduler` | The one writer |
| `70-config.js` | `Config` | The one schema; menu and code read the same store |
| `71-ui.js` | `Menu` | Generated from the schema |
| `72-debug.js` | `Debug` | Optional panel plus a journal of between-tick decisions |
| `80-runtime.js` | `Runtime` | Wiring and the tick loop |

### Feature modules

Each exposes `tick()` returning an intent, an array of intents, or `null`, and
`debugState()`. None of them writes to `GameState`, calls `Transport`, or knows
another module exists.

`50-mod-autoplace.js` · `51-mod-preplace.js` · `52-mod-replace.js` ·
`53-mod-spiketick.js` · `54-mod-antismarttick.js` · `55-mod-safesoldier.js` ·
`56-mod-autoheal.js` · `57-mod-automills.js` · `58-mod-autobreak.js` ·
`59-mod-movement.js` · `5a-mod-autoupgrade.js` · `5b-mod-autobuy.js` ·
`5c-mod-autorespawn.js` · `5d-mod-autogather.js` · `5e-mod-shamereset.js` ·
`5f-mod-autochat.js`

Plus `73-overlay.js`, which draws and never decides.

Two hold state between ticks, and both clear it on the events that invalidate it:
`Preplace.armed` (killed by `targetSwitched`, `death`, direction change, drift or
age) and `Replace.doomed` (cleared by `objectRemoved` and by expiry).

## State flow

`GameState` is authoritative and single-writer: only `Router` mutates it from the
wire, only `EntityTracker` writes derived fields. Modules read.

Three sets — `myObjects`, `teamObjects`, `enemyObjects` — are maintained
incrementally on add/remove rather than refiltered per tick, and rebuilt wholesale
only when ownership semantics change (`SETUP_GAME`, `SET_TEAM`).

`nearObjects` is rebuilt once per tick at a radius derived from the widest range
in the shipped tables (turret, 700, plus margin). Every collision and placement
query in the client walks that list, not the full object map.

Four entity classes are tracked, not one. `players` and `animals` both carry the
full derived set (velocity, heading, trap containment, spike contact) and are
therefore interchangeable to Prediction, Targeting and PlacementEngine.
`projectiles` are dead reckoned from a single server description plus range
updates. `objects` are structures and resources.

`lastTickDelta` is clamped to [0.5×, 2×] of the server's own step. The server
advances at a fixed rate, so the wall-clock gap between two packets is network
jitter rather than a change in how far the world moved — clamping keeps the
reload clocks and projectile reckoning honest across both a stalled connection
and two packets in the same millisecond.

Allies come from the server's alliance roster (`ALLY_LIST`) when it is known and
from the team string otherwise. The roster is authoritative because a structure's
owner may never have been a visible player.

## Prediction

One layer, one integrator, taken from `PlayerObject.update`
(`src/game_index.js:2330-2374`). Per server step of `f` ms the game does
accelerate → move → decay, which in per-tick displacement `D` is:

```
D(n) = D(n-1) · playerDecel^f  +  playerSpeed · mult · f²
```

Three branches, because which one an entity is on is not observable:

- `accel` — holding a direction, full recurrence
- `decel` — released, decay only
- `hold` — at terminal speed, displacement carries unchanged

`hold` is not redundant with `accel`: they agree only at the recurrence's fixed
point, and that point depends on a speed multiplier folding in biome, water
current, `slowMult` and the target's accessory — none of which are on the wire
for other players.

Each tick, `scoreBranches` replays the last observed step under all three and
keeps whichever fit best, reporting the fit as `confidence`. Modules gate on it
differently: Preplace refuses below 0.6, Auto Place below 0.35, target sorting
ignores it.

Results are cached per `(sid, horizon, mode)` and invalidated every tick, because
several modules ask for the same horizon on the same entity in one pass.

## Targeting

One target, scored on three weighted terms — proximity, threat, vulnerability —
not on distance alone. Threat is computed from the shipped tables: for each of an
enemy's two slots, damage × readiness (how far through its cooldown) × reach,
with a multiplier for a closing gap.

Switching is damped. A challenger must beat the incumbent by `switchMargin` and
the incumbent must have been held for `switchMinTicks`, because swapping targets
mid-sequence throws away a wound-up burst and a half-built trap. A switch emits
`targetSwitched`, which kills the active combat sequence and disarms Preplace.

## Placement

`PlacementEngine` answers WHERE for every module. The search space is one angle:
the game only ever builds at `playerScale + item.scale + placeOffset` from the
player, so a sweep of the ring is exhaustive.

Each candidate is tested with the game's own `checkItemLocation` rule and then
scored on: intercepts the target's predicted path, proximity, sits flush against
an existing structure (a *boundary* angle, where placeability flips between
neighbours), chains knockback into one of our spikes, closes the target's escape
angles, fully encloses them — minus penalties for blocking our own swing, blocking
our own path, or pushing the target toward us.

Sweeps are cached per `(item, resolution, origin, object-set)` and invalidated per
tick, so Auto Place, Spike Tick and Replace share one.

Modules decide WHETHER and WHEN:

- **AutoPlace** — reactive, gated on confidence and score.
- **Preplace** — sweeps around our *predicted* position and scores against the
  target's *predicted* position, then arms rather than sends, releasing on a
  timer so the build lands on the tick it was computed for.
- **Replace** — sweeps with a doomed object removed from the collision set, and
  only accepts a candidate that lands in that gap and scores better than what is
  being lost.
- **SpikeTick** — pure timing; takes the best candidate that will be in contact.
- **AutoMills** — `utility` intent shape, which prefers positions behind the
  direction of travel.

## Combat

A burst is a `Sequence` of steps run across consecutive ticks, each with its own
`validate(seq)` re-run immediately before its packets are queued. Order depends on
the pair: a long-reach primary (katana, polearm — the only two above the threshold
in the shipped range table) swings *second*, after a knockback secondary.

A burst is committed when it does enough raw damage, **or** the target is held,
**or** the secondary is a knockback weapon and there is one of our spikes for it
to throw the target onto — without that third case the polearm-and-hammer pair
would never fire, because its raw two-slot damage is 55.

## Arbitration

```
intents ──► validate()  ──► drop anything the world has moved past
        ──► holds       ──► a hold removes the kinds it blocks, but only
                            if it outranks the best intent of that kind
        ──► rank         ──► priority = urgency × (0.5 + 0.5 × confidence)
        ──► lanes        ──► exclusive:  Attack / Placement / Replace / Heal /
                                         Break — one per tick, they all drive
                                         the same build-and-attack slot
                            singleton:  Move / Upgrade / Buy / Spawn / Toggle /
                                         Chat / Defense — one of each per tick,
                                         but they run alongside an exclusive
        ──► budget       ──► an intent that cannot afford its frames is refused,
                            never truncated
```

Confidence scales urgency rather than gating it, so a half-sure emergency still
outranks a certain convenience.

The hold rule is what "must not blindly override" means mechanically. Anti Smart
Tick can veto a placement, but only when its case is stronger; a weak hold loses
and the placement goes through.

## Packet scheduling

One queue carries both 2yz's frames and the game's. Packet costs quoted in the
intents are the counts actually emitted:

| Action | Frames |
|---|---|
| Build one item | 4 — aim, select item, attack down, attack up (+ restore weapon) |
| One swing | 3 — aim, select weapon, attack down/up |
| Break a structure | 4 — aim, select weapon, attack down, attack up |
| Heal | 4 per item |
| Hat swap, buy, upgrade, spawn, toggle, chat, move | 1 each |

Movement has one extra rule: a 2yz steering correction overrides a passthrough
move in the same tick. Without it, an anti-knockback correction would be undone
by the player's own movement packet arriving behind it.

Dedupe collapses repeated aims within a tick and applies the game's own 0.3 rad
gate; a select of the same item twice becomes one; an attack invalidates the
select cache. Budget exhaustion drops rather than queueing into the next second.
Frames belonging to a cancelled sequence are dropped at the last moment.

## Configuration and menu

`Config.schema` is the single source. The menu is generated by walking it, so a
control cannot exist for a key nothing reads — the key *is* the reader's storage.
`tools/verify-2yz.js` walks the schema and greps the module sources for a matching
`Config.get` / `Config.section` call and fails the build on a key with no reader,
or a read with no key.

Categories mirror the architecture: Combat · Placement (Scoring Weights, Auto
Place, Preplace, Replace, Spike Tick) · Defense (Anti Smart Tick, Safe Soldier,
Auto Heal) · Utility (Auto Mills) · Prediction · Network · Debug.

Menu toggles with Escape, bound in the capture phase. Nothing in the shipped
bundle reads keyCode 27, so it takes a key the game leaves unused; it is skipped
while an input has focus, because closing the chat box is what Escape means when
you are typing in it.

## Movement, and why it is off by default

2yz is a decision layer over human movement. It normally never sends a movement
packet at all — the player's own `MOVE_DIR` passes straight through. The
`Movement` module is the single exception and only speaks when it has a specific
reason: an incoming hit that would throw us onto a structure, a heading that runs
into a hazard, or a body-block that would carry the target onto one of our
spikes. Its master switch defaults to off.

## Overlay, and what it cannot promise

Because 2yz does not fork the renderer, the overlay draws on its own canvas and
reproduces the game's camera from `game_index.js` — the viewport scale at
4466-4472 and the camera lerp at 4831-4836, plus the per-entity interpolation
between the last two snapshots. It tracks closely but is not pixel-identical,
because the game's frame delta and ours are different clocks. That is why
nothing the overlay draws feeds a decision: every range check and every
placement is computed in world coordinates.

## Debug

Off by default, seven independent sections. Each reads the subsystem's own
`debugState()`, so what is displayed is the state the client actually decided on.
A journal additionally records decisions invisible in a per-tick snapshot —
preplace armed/disarmed/released, intents dropped at the last check, sequences
cancelled mid-burst.

## Build and verification

```sh
node tools/extract-drivers.js    # game bundles -> drivers/game-drivers.json
node tools/build-2yz.js          # src/2yz/*.js -> 2yz.user.js
node tools/verify-2yz.js         # static audit
node tools/test-2yz.js           # headless behavioural suite
```

The build is concatenation in filename order — the numeric prefixes are the
dependency order — wrapped in one IIFE, with a single `__2YZ_DRIVERS__`
substitution. No bundler, no npm dependency.

## Performance

- One sweep per (item, origin, object-set) per tick, shared by all placing
  modules.
- One prediction per (entity, horizon, mode) per tick.
- Ownership buckets maintained incrementally, never refiltered.
- `nearObjects` rebuilt once per tick; nothing walks the full object map.
- Fixed-capacity rings for movement history and the debug journal, so no array
  churn per tick.
- Early rejection: modules return `null` before doing work when range,
  confidence, cooldown or budget already rules them out.
- The debug panel renders at most every 100 ms regardless of tick rate.

None of these trades accuracy: the collision test, the placement offset and the
movement integrator are the game's own, at full resolution.
