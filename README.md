# RYN builds

Two independent build lineages live here, sharing the same extracted game
tables in `drivers/` and the same rule that every constant must be traceable to
the shipped bundle.

| Build | Input | Output | What it is |
|---|---|---|---|
| **Auto Heal** | `src/RYN_GapFill.user.js` | `RYN_AutoHeal.user.js` | RYN v5.4 with the Auto Heal Engine reworked — see below |
| **ReUp Mix** | `src/RYN_Client_v4.js` | `ReUp_Mix.user.js` | RYN v4 with the Luna features ported onto it — see [ReUp Mix](#reup-mix-luna--ryn) |

---

## Auto Heal Engine v2

A predictive survival engine: it owns every automatic food press, the defensive
hat/gear decision, projectile micro-evasion, and the packet budget those three
spend. Nothing else in the client is rebuilt — Auto Place, Preplace, Replace,
Spike Tick, Combat, Auto Mills, Safe Soldier and Velocity Tick are read through
an adapter and never written.

The objective is **shame 0, held**. 7 is the state one press short of a
thirty-second food lock, not an operating point. Everything above 0 is a debt
and is repaid at the first opening, which is affordable because of what the
game's own rule costs: a press more than 120ms after a hit is −2, and a press at
full health spends no food at all (`changeHealth` refuses a heal at the cap, and
`useRes` is gated on it). A `+1` press is a constraint rather than a price — it
leaves only when waiting would drop the bar under the reserve, or when waiting
would kill you.

```
src/autoheal/ryn-autoheal-engine.js   the engine (edit this, not the build)
tools/build-autoheal.js               engine + base client -> RYN_AutoHeal.user.js
tools/verify-autoheal.js              every constant, re-derived from the game
tools/test-autoheal.js                43 scenarios against a stand-in client
docs/AUTOHEAL_ENGINE.md               design notes and the full derivation
```

### Build and check

```sh
node tools/build-autoheal.js
node tools/verify-autoheal.js RYN_AutoHeal.user.js
node tools/test-autoheal.js
node --check RYN_AutoHeal.user.js
```

Current state: **78/78 constants** verified against `src/game_index.js` and
`drivers/game-drivers.json`, **43/43 scenarios** passing — every requested Anti,
plus multiple simultaneous threats, high and unstable ping, a six-packet budget,
sixty ticks of sustained pressure (peak shame 0), and the negative cases that
catch false positives.

Full detail, including the twelve defects found in v1 and why Bull Helmet is
never equipped as defence, is in [docs/AUTOHEAL_ENGINE.md](docs/AUTOHEAL_ENGINE.md).

---

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
ReUp_Mix.user.js          the ReUp Mix build output
RYN_AutoHeal.user.js      the Auto Heal build output
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      ReUp Mix base client (input)
src/RYN_GapFill.user.js   Auto Heal base client, RYN v5.4 (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/autoheal/             the Auto Heal Engine source
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js  -> ReUp_Mix.user.js
tools/build-autoheal.js   src/RYN_GapFill.user.js + the engine -> RYN_AutoHeal.user.js
tools/verify-autoheal.js  engine constants vs. the shipped game
tools/test-autoheal.js    engine scenarios
docs/AUTOHEAL_ENGINE.md   Auto Heal design notes
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
