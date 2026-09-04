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

# Ryn Type 2 — Realistic Weapon Animation System

`Ryn_Type_2.user.js` is the Ryn Type 2 client (v5.4) with a weapon animation
system that replaces the bundle's one-size-fits-all swing. It is always on:
no toggle, no setting, no menu entry.

## What the bundle does, and why every weapon looks the same

A held weapon is a static sprite pinned at `(scale, 0)` in the player's local
frame. An attack is one number, `dirPlus`, lerped `0 → targetAngle → 0`; the
render loop adds it to `dir` and rotates the **whole player** — body, hands,
hat and weapon together:

```js
Ni = (r == v ? Ci() : r.dir) + r.dirPlus;
k.rotate(Ni); Dl(r, k);
```

`targetAngle` is `-90°` on a connecting hit and `-180°` on a whiff. So a spear,
a musket and a dagger all do the same thing: orbit the character. That is the
"generic 90-degree stick swing".

## What replaces it

That single rotation is redistributed. The body keeps a weapon-specific
fraction of it as a lean; the weapon carries the rest as a rotation **about a
grip point near the hand**, plus a reach along the attack direction and a
lateral offset. Hands are re-placed so they stay on the grip.

Four bundle hooks, all in the render path:

| Hook | Site | Effect |
|---|---|---|
| `weaponAnimBody` | `dir + dirPlus` in the player loop | body keeps `dirPlus * profile.body` |
| `weaponAnimPose` | both `renderTool` calls in `Dl` | grip pivot, reach, lateral offset |
| `weaponAnimAmmo` | the nocked arrow/bolt in `Dl` | ammo rides the weapon and the string |
| `weaponAnimHands` | the two hand circles in `Dl` | hands track the weapon's motion |

Each of the 16 weapons has a profile of five keyframes — idle → wind-up →
strike → follow-through → idle — with its own stage times, per-segment easing,
grip point, body-lean factor and hand weights. Stage times are fractions of the
weapon's own `speed`, so a 100 ms dagger and a 1500 ms musket share the
vocabulary at wildly different speeds.

## It reads the combat clock, it never writes to it

The phase comes from `animTime / animSpeed` — the clock the server starts with
the `K` packet. Nothing here writes to `animTime`, `animSpeed`, `targetAngle`
or `dirPlus`. Total animation duration is still exactly `weapons[i].speed`, and
peak extension still lands where the bundle put it. Damage, hitboxes, range,
cooldown, knockback, projectiles, targeting and packets are untouched: the diff
against the input client **removes no line at all**.

`_bodyAngle` returns the raw `dirPlus` unchanged whenever a building is in hand
or the weapon has no profile, so placement and any future weapon fall back to
vanilla.

---

## Layout

```
Ryn_Type_2.user.js        Ryn Type 2 + the weapon animation system
ReUp_Mix.user.js          the build output — this is the script to install
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/check-weapon-anim.js       weapon animation behaviour + invariants
tools/check-weapon-anim-alloc.js weapon animation per-frame allocation
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

Same three against Ryn Type 2, plus the weapon animation suite:

```sh
node tools/verify-drivers.js Ryn_Type_2.user.js
node tools/check-hooks.js Ryn_Type_2.user.js
node --check Ryn_Type_2.user.js
node --expose-gc tools/check-weapon-anim.js
```

`check-weapon-anim.js` runs the animation system against a stub canvas for
every weapon, every attack direction, hits and whiffs, idle, building-in-hand,
weapon switching and rapid re-attacks — 50k simulated player-frames — and
asserts no NaN, balanced `save`/`restore`, hands that stay on the character,
an unprofiled weapon reaching the vanilla draw untouched, and no state growth
across 800k player-frames. It then shells out to `check-weapon-anim-alloc.js`,
which needs its own process because `heapUsed` deltas stop meaning anything
once the surrounding code has deoptimised the call sites.

Current state of the build:

- **Drivers** — hats (46), accessories (21), weapons (16), items (23), item
  groups (14) and 42 scalar config keys all match `src/game_index.js`. The
  client also carries the right frame-signature width, transport mode, table
  salt, and both opcode alphabets.
- **Hooks** — 36/36 bundle-rewrite hooks bind, including the new
  `objectRotation` hook and the pre-existing `freezeTurnSpeed`, which now
  resolves to the animal turn-rate site only.

Ryn Type 2: driver tables match, 45/45 hooks bind (41 existing + the four
weapon animation hooks), and all 14 animation checks pass.

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
- The weapon animation system in `Ryn_Type_2.user.js` is not gated on
  `_lowQuality` or anything else — it is the default and only way weapons are
  drawn. The one continuously-running part is the idle sway, a single `sin` per
  visible player per frame off a timestamp the renderer already samples.
- The animation profiles are 16 blocks of plain numbers at the top of the
  module. Retuning a weapon means editing its keyframes; nothing else in the
  client needs to know.
