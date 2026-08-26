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

# YoRHa System — placer aiming

`YoRHa_System.user.js` is a separate script from the mix above (a different
lineage: YoRHa 1.5, with Luna's placer and Falcon 0.4.7's auto-replace already
folded in). What changed here is its **preplacer** and **replacer**: both now
aim at the enemy instead of at the ground.

## What was wrong

Every player the tick handler touches carries two positions — `x2/y2`, where
the server last put them, and `xVel/yVel`, which despite the name is that same
position stepped once more along their last step. The placers mixed the two
freely: one test measured to `x2/y2`, the next to `xVel/yVel`, a third drew a
line between them. A ring slot is ~90px across and a tick of running is ~25px,
so which of the two a test reached for decided whether a spike landed on him or
a third of a body behind him.

On top of that:

- **The preplacer never asked where he was.** It took every legal *spike* slot,
  sorted by distance to the object that was breaking, and placed the first one —
  falling back to traps only when no spike was legal at all. Since
  `isPrePlaceAngle` passes every trap on the ring (its last rule is a bare
  `if (isTrap) return true`), that meant a trap at whatever angle happened to
  sit nearest a dying bush: behind you as readily as in front of him.
- **A spike "hit" was measured at `scale + 55`.** The game damages at
  `playerScale + spikeScale` — 87 at spike scale 52, not 107. Twenty pixels of
  phantom reach, most of a body, is why aimed spikes missed.
- **A standing player had a phantom walk.** `predictMoveAngle` is `null` with no
  move key down, and `Math.cos(null)` is `1`, so the line-of-sight vetoes
  invented a future position 222px due east and rejected good slots against it.
- **Falcon's replace grades in the present tense.** The hole it answers opened a
  tick ago and its packet lands a tick from now, so against anyone actually
  running the wall closes behind them.

## What it does now

One shared aiming layer (`aimStep` / `aimLead` / `aimPathHits` / `aimClosing` /
`aimOffAngle`, above `isPrePlaceAngle`), used by both placers:

| | |
|---|---|
| **Lead** | `x2/y2` plus one clamped tick of travel, `placeLead` ticks of it. The clamp (40px) is above what any speed hat or boost pad reaches in a tick and throws away the 400px "steps" a teleport or resync produces. |
| **Path** | walking *through* a trap catches you as surely as standing in it, so slots are tested against the segment, not only its endpoints. |
| **Reach** | the game's own numbers: `35 + scale` for a spike (with the +10 slack the mod's own damage predictor uses), 50 for a trap. |
| **Angle** | how far off the line from me to him a slot sits — "the best angle", measured. |

The preplacer then **grades both lists on one scale** and the best slot takes
the tick, spike or trap: a trap that closes on the point he is running to
outscores a spike that reaches the air behind him, and once he is held, the
spike that reaches him outscores a second trap out of a stock of six. With
**Trap + Spike Combo** on it will spend a second, non-overlapping slot on the
same tick — but only on a building that also reaches him.

The replacer keeps Falcon's grading table and adds the lead to it: a trap
closing on the lead point, a spike reaching it, ties settled by distance to his
body and by aim.

## Tuning (Placers page)

| Setting | Default | What it does |
|---|---|---|
| `Aim At Enemy` (`placeAim`) | on | Off collapses the lead to zero and both placers grade in the present tense, as before. |
| `Lead (% of a tick)` (`placeLead`) | 100 | 100 = one tick of his travel (~25px at a run). Raise it against runners, lower it against players who juke. |
| `Trap + Spike Combo` (`prePlaceCombo`) | on | The second preplace slot described above. |

## Verification

```sh
node --check YoRHa_System.user.js
node tools/test-place-aim.js
```

`test-place-aim.js` lifts the aiming and scoring blocks out of the userscript
by their `---8<---` markers and instantiates them with every free variable
passed in, so the tests run the shipped code rather than a copy of it.
