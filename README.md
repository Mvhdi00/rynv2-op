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

# RYN Client v5 OWNER — placer

`src/RYN_Client_v5_OWNER.js` is a separate userscript from the mix above: the
v5 OWNER client, whose placer is the auraro placer rather than RYN's own. Two
changes were made to it, both confined to the place path — `AutoPlacer`,
`PrePlacer`, `Replacer` and the shared `AuraPlacer` they run on. Nothing else
in the client was touched.

## Placement is one angle, and the corners are the answers

Read off `src/game_index.js`:

```js
buildItem(f) {
  const w = this.scale + f.scale + (f.placeOffset || 0);
  const T = this.x + w * cos(this.dir), A = this.y + w * sin(this.dir);
  if (this.canBuild(f) && a.checkItemLocation(T, A, f.scale, .6, f.id, !1, this)) { ... }
}

checkItemLocation(h, u, p, x, I, P, f) {
  for (let w = 0; w < t.length; ++w) {
    const T = t[w].blocker ? t[w].blocker : t[w].getScale(x, t[w].isItem);
    if (t[w].active && i.getDistance(h, u, t[w].x, t[w].y) < p + T) return !1;
  }
  return !(!P && I != 18 && u >= s.mapScale/2 - s.riverWidth/2 && u <= s.mapScale/2 + s.riverWidth/2);
}
```

The build lands on a circle of radius `w` around the player, so the only free
variable is the angle. Each object subtracts one arc from that circle, and the
two endpoints of that arc — where the build lands exactly tangent to the object
— are its **corners**. Every legal placement that touches anything is one of
them; between two corners the circle is either blocked or strictly further from
everything.

`AuraPlacer.cornerAngles(type, px, py)` enumerates the whole set: two per
object whose rejection circle crosses the placement circle, plus up to four
where the placement circle crosses the river bank (platforms, item 18, are the
one item allowed in the water and so have no corner there). Each is nudged
6e-3 rad clear of the tangent, because the angle is rounded to two decimals on
the wire and an exact tangent lands on either side of the boundary at random.

The corners are tried first in `testCanPlace`, in `autoPlace`'s open-ground
fallback and in `PrePlacer.retrapSpam`, ahead of the fixed sweeps those used
before.

Verified by brute force against the game's rule over randomised scenes built
from the real item table: **1884 of 1884** free arcs contain at least one
corner, **33278 of 33278** single-blocker corners are accepted, and the π/36
sweep the placer ran on is blind to **1.0%** of free arcs outright — a gap
narrower than 5° falls entirely between two of its steps.

## Three things it could not see

- **Blockers.** Item 21 reports `blocker: 300`, and the server checks every
  object with no distance cap. The placer scanned 200px, so a blocker was
  invisible to it: builds aimed inside one were validated locally, sent, and
  dropped by the server. The collision scan now reaches 540px — the largest
  distance at which anything can reject a landing point — and `angleRanges` and
  `calcPreplace` iterate that table instead of a 200px neighbour list.
- **Its own 40000 cut.** `angleRanges` skipped any object past 200px before
  asking whether it could block, which is the same blind spot again.
- **Gaps narrower than its step.** See above.

## Speed

`ModuleHandler.place()` spends four packets per build — `selectItem`, `attack`,
`stopAttack`, `whichWeapon` — against a budget of 70 per second shared with
movement, attacks and healing. Only `attack`/`stopAttack` are per-build; the
held item survives between them.

`AuraPlacer.send()` now emits the build itself and batches: the item is
selected once, each angle costs two packets, and the weapon comes back once
when the module's `postTick` ends (via a `try/finally`, so the early returns
are covered too). Nothing else sends between a placer's first and last build,
so the wire order is unchanged — only the redundant packets are gone.

| | packets |
|---|---|
| 7 mixed builds, before | 28 |
| 7 mixed builds, batched | 18 |
| traps per 70-packet second, before | 17 |
| traps per 70-packet second, batched | **34** |

Alongside that:

- **One grid sweep per tick.** `nearObjs` was called inside loops that already
  iterate objects — `radCalc` ran one per anchor — rebuilding the same `Set`
  and the same array dozens of times a tick. It is now a single position-keyed
  scan per tick, kept as a flat `{x, y, block, id}` table so the collision
  tests touch no getters and allocate nothing.
- **Squared distances.** `Math.hypot` is gone from the collision tests; only
  the comparison mattered.
- **`hitsToBreak` memoised per tick.** It was called once per candidate and
  again from `urgencyScore` during the sort, each time through a `try/catch`
  and two `getBuildingDamage` walks.
- **Retrap gate is per tick, not 200ms.** At moomoo's 111ms tick a 200ms wall
  clock gate is one tick and three quarters, so on the tick that mattered it
  was as likely to be shut as open depending on where the clock landed.
- **`AURA_MAX_PER_TICK` 2 → 3**, which the packet budget now affords.

## Spikes, only where a trap cannot go

`AuraPlacer.spikeFill()`, called by all three placers after their trap logic
and gated by **Combat → Spikes & Traps → Placer Spikes** (`_placerSpike`, on by
default). Two clauses, both enforced:

- **Only where a trap cannot.** Either there is no trap to place at all — the
  group limit is 6, and in a fight the limit runs out long before the geometry
  does — or the trap's own landing point at that same angle is rejected.
  Placement is parameterised by angle, so asking the question at the angle asks
  it exactly.
- **Only in contact with the enemy.** The spike must land within
  `spike.scale + enemy.scale + 8` of them. A spike short of that is a wall, and
  walls are not this module's job.

Candidates are the spike's own corners plus the bearing straight at the enemy,
tried closest-first so the packet budget buys the tightest contact available.

Verified over 60000 randomised scenes: **0** placements out of contact, **0**
placements into a slot a trap would have fitted.

| spike | fires | of which, because traps ran out |
|---|---|---|
| spikes (scale 49, smaller than the trap's 50) | 17.1% | 72.3% |
| greater / poison / spinning (scale 52) | 13.0% | **100%** |

Worth knowing: a spike bigger than the trap can never fit somewhere the trap
does not, so with greater spikes the geometric clause is vacuous and the
feature reduces to "spike when out of traps". With basic spikes it also finds
genuine tight gaps. It fires with the enemy between 61 and 177 away, median
109 — contact range, as asked.

### Not colliding with spike tick

All seven spike-tick modules sit at indices 5–13 of `ModuleHandler.modules`;
the placers are at 43–45. So a tick one of them claimed is already in
`activeModule` when the placer looks — that is the direct collision, and it was
already guarded. `spikeFill` adds two more:

- it stands down if anything ahead of it already built this tick
  (`ModuleHandler.placedOnce`), and
- it stands off for two further ticks after the last spike-tick claim, because
  those sequences span ticks — place, then swing — and dropping a spike into
  the contact ring halfway through is the collision that the `activeModule`
  check alone does not catch.

## A per-tick packet slice

The 70-packet allowance resets on a **wall clock**, not per tick. Measured on a
built-up base, `autoPlace` mode 0 wants ~12 builds in one tick — ~26 packets
even batched — so one busy tick took the whole second and the next eight had
nothing left. That is what "it places once and then goes dead" actually was.

`AURA_TICK_PACKETS = 24` caps the placer's slice per tick. The second's total is
unchanged; it is now spread over three or four productive ticks instead of one.
Sweeps ask `hasBudget()` rather than reading a failed `send()` as "out of
budget", since `send()` also returns false for a duplicate and that is not a
reason to abandon a sweep.

Also added: wire-precision deduplication in `send()`. The angle is rounded to
two decimals before transmission, so two candidates that round the same are the
same packet twice. Measured at only **0.7%** of mode-0 sends — marginal, but
free.

## What was measured, and what was not

The CPU work is now **3.0x** faster with 13 grid queries per tick down to 1 —
but it was **0.04%** of a 111ms tick to begin with, so it was never what made
the placer feel slow. The packet budget was, and still is, the binding
constraint.

One thing left unexplored: whether the server builds on each `F,1` or only on
the `1`→`0` transition. If the former, a run of builds could drop to roughly
one packet each. `buildItem` is server-side and is never called anywhere in the
shipped bundle, so there is nothing here to verify it against, and it was not
worth guessing at.
