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
revision). Verified by `node tools/verify-replace.js` — 93 checks.

YoRHa's replacer is **Falcon 0.4.7's grading table**, already carefully ported
with four documented fixes to Falcon's own bugs. Reading the replacers in nine
other clients turned up nothing better than it — so this does not replace it.
The grading table, `replaceKnockInto`, `replaceEnemyRing`, `replaceWithinPath`,
`replaceBlocksMyMove` and the four-slot fill limit are all untouched. So are the
preplacer and the autoplacer.

Four surgical changes, each taken from a specific client, each closing a
specific hole.

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
node tools/verify-replace.js [client.js]                  # 91 checks
node tools/check-scopes.js   [client.js]                  # names READ but never declared
node tools/check-dead.js     [client.js] --base [base.js] # names DECLARED but never used

# 93 checks: the two static passes fold in when a baseline is given
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
count; that the grading table and both other placers are untouched; robustness
against a malformed break list; and that the file's undeclared-identifier set is
unchanged from the pristine base.

**Diff against the base: 198 lines added, 6 replaced, in 8 hunks.**
