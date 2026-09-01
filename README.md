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

Combat, Auto Place / Preplace / Replace, Spike Tick, Safe Soldier, Anti Smart
Tick, Auto Mills and Velocity Tick are **read only** — for the threat numbers,
the packet budget and the tick claim. Nothing in them is modified or duplicated.

## Measured

`tools/sim-autoheal.js` runs the engine against the game's own rules
transcribed — `buildItem`'s arithmetic, `changeHealth`'s hit stamp and
full-health refusal, the one-second regen counter, `canBuild`'s resource gate —
with latency modelled on both legs. Over eleven scenarios: no 30 s lock is ever
armed, nothing is sent while one is on, the count never passes 7, and eight of
the eleven hold shame at 0 for 100 % of ticks, including a 90 dps pressure run
and a 250 ms ping run. `verify-autoheal.js` re-runs all of it against the engine
copy pulled back out of the built userscript.

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
