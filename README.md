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

---

# Ryn Type 2 — melee animation and weapon grip

`Ryn_Type_2.user.js` is a separate script in this repo: the Ryn Type 2 client
with a new melee animation and weapon-grip system. It is built against the same
`src/game_index.js` the rest of the repo is verified against.

## The problem

Vanilla moomoo animates an attack with one value. `Player.startAnim` sets
`targetAngle` to `-hitAngle` or `-Math.PI`, `animate` lerps `dirPlus` up to it
and back, and the render loop rotates the **entire player** by it:

```js
Ni = (r == v ? Ci() : r.dir) + r.dirPlus;
k.rotate(Ni);
```

Body, hat, both hand circles and the weapon sprite all sit inside that one
transform. So every weapon performs the identical motion, the pivot is always
the player's centre, and the result reads as a sprite spinning around a disc.

## What replaces it

For melee weapons only, the body stops spinning — it keeps a torso twist of a
few degrees — and the weapon together with its two grip points moves as one
rigid body about a pivot **on the weapon's own handle**. Each weapon drives that
rigid body through its own keyframe track.

### The grip comes first

The game already carries two grip points per weapon: the hand circles it places
from `armS` / `hndS` / `hndD`. For every melee weapon those two points land on a
single line through the sprite — the haft. So the haft is read out of the game's
own data rather than guessed off artwork nobody in this repo has:

```
      head / tip
          |
      [ hand 1 ]     primary grip:   angle +armS·45°, radius scale
          |
      [ hand 2 ]     secondary grip: angle -armS·hndS·45°, radius ·hndD
          |
      butt of haft
```

The rest pose is left exactly as vanilla draws it, and every pose is that rest
pose under a rotation about a grip point plus a translation. Two consequences
fall out for free: **no weapon can end up mis-oriented, sideways or detached
from its sprite**, and **the hands cannot come off the weapon**, because a rigid
transform preserves the distances that put them there.

Idle is therefore pixel-identical to vanilla, which the verifier asserts.

### Pivot follows the sign of the rotation

A two-handed weapon being *loaded* turns about the lead hand — the head travels,
the hands stay put. The same weapon being *driven* turns about the rear hand,
which is what puts the head through the arc. So the pivot swaps where the
rotation crosses zero, and because both pivots agree exactly at zero the swap
costs no continuity.

Without this, rotating the front hand backwards around the rear hand sweeps it
straight across the player's chest and the body circle eats it.

### Per weapon, not per speed

Eleven profiles, one per melee weapon, each a keyframe track over rotation,
forward and lateral translation, how far the primary hand slides along the haft,
and torso twist. Weight is expressed in the *easing* — `i4` into a great
hammer's fall, `o2` into a stick's, so the stick is at full speed the instant it
moves and the hammer is still gathering when it lands — not by scaling one
motion up and down.

| | motion | grip | signature |
|---|---|---|---|
| polearm / spear | thrust | two hands, both on the shaft | loads *negative*: comes up to bear along its own line rather than winding up. At full extension shaft end, rear hand, front hand and head are colinear and pointing down the facing direction |
| katana | committed cut | two hands on the hilt | raises, cuts once, then **holds** the blade out on line for four frames before returning slowly |
| short sword | compact cut | one hand, off hand counter-swings | short cock of the wrist, slash close to the body, quick recovery |
| bat | wrap-around swing | two hands | the only weapon whose rotation keeps *growing* after contact |
| great hammer | power swing | two hands, upper slides 16px down the haft | slowest lift, cubic acceleration, quartic stop, then a flat dwell while the head sits where it landed |
| great axe | chop | two hands, upper slides 14px | wide load, heavy acceleration, head checked hard at the bite |
| hand axe | chop | one hand | same family, one-handed, smaller and faster |
| tool hammer | tap | one hand | a flick of a wind-up and straight back on guard |
| stick | whip | one hand | every key decelerates in; springs back off the strike |
| daggers | alternating stab | one blade per hand, both riding | pivot alternates between the two grips on successive attacks, lateral offset mirrors with it |
| mc grabby | reach and haul | two hands | spear geometry, deliberately not spear character: no chamber, quadratic snap out, then a hard quartic pull back in |

A swing that connected and a swing that hit nothing are told apart from
`targetAngle`, which the game already sets: a whiff carries further.

## What is not touched

Shield, hunting bow, both crossbows and the musket have no profile, so
`_track` returns null before anything else happens and all three call sites run
the original code verbatim — same coordinates, same draw order, same
`dirPlus`. The same is true of anyone holding a building item, and of everything
when **Visual → Interface → Melee Animation** is off.

Nothing gameplay-facing changes: no damage, range, hit detection, packets or
input. The three hooks land in the renderer only.

## The hooks

Three sites, all inside the player renderer:

| hook | site | becomes |
|---|---|---|
| `meleeWeapon` | both `pn(weapon, variant, scale, 0, ctx)` calls | `RYN._MeleeAnim._drawWeapon(pn, …)` |
| `meleeHands` | the pair of `R(…, 14)` hand circles | `RYN._MeleeAnim._drawHands(R, …)` |
| `meleeBody` | `(r == v ? Ci() : r.dir) + r.dirPlus` | `… + RYN._MeleeAnim._bodyRot(r)` |

Melee weapons are all `!aboveHand`, so the weapon is drawn before the hands and
both grip circles stay whole on top of it. The three `aboveHand` weapons keep
drawing over the hands, as they did.

## Cost

One motion sample and one placement per player per frame, both cached on a
size-one key of `(player, animTime, weaponIndex)` and written into two reused
scratch objects. The three call sites hit the cache. No allocation, no library,
about twenty flops and four trig calls per player.

## Verification

```sh
node tools/verify-melee.js Ryn_Type_2.user.js
node tools/check-hooks.js Ryn_Type_2.user.js     # needs: npm i --no-save terser
node tools/verify-drivers.js Ryn_Type_2.user.js
node --check Ryn_Type_2.user.js
```

`verify-melee.js` lifts the real profile table and the real `MeleeAnim` class
out of the built script and sweeps every melee weapon through its whole attack —
connected and whiffed, both alternations — checking that:

- no grip point ever comes within 30px of the player's centre, where the body
  circle (drawn last, over everything) would swallow it
- the two grips never close to under 24px apart
- a rigid grip stays rigid: the hands sit on the weapon's own haft line to
  within 0.01px, and their spacing changes only by the slide the profile asked
  for
- no grip travels more than 60px in a 60fps frame — hands stay readable while
  the weapon is free to blur
- at each weapon's impact frame the grips are in butt → rear → front → head
  order along the weapon, which is the freeze-frame question asked as geometry
- idle is bit-identical to the vanilla hand coordinates, and the excluded
  weapons never enter the new path at all

It then re-runs the client's own hook pass over the game bundle, lifts the
**rewritten** player renderer out of the result and executes it against a
recording canvas, so the argument order, the balance of `save`/`restore` and the
untouched excluded path are checked as running code and not as text.

Current state: 44/44 hooks bind, 2664 checks pass, and the visibility clamp —
the safety net for a grip that would sink into the body — never fires on any
weapon at any point, i.e. the profiles are correct by construction rather than
rescued.

```
weapon              min grip r   min gap   hand px/f   weapon px/f
0  tool hammer            33.8      49.5           7            46
1  hand axe               33.1      49.5           9            59
2  great axe              33.2      35.5          40            94
3  short sword            33.6      47.9           7            86
4  katana                 33.1      43.5          35           129
5  polearm                35.0      46.5          15            41
6  bat                    31.8      41.5          41           142
7  daggers                31.8      49.5          24            30
8  stick                  33.8      49.5           5            40
10 great hammer           34.2      33.5          39           103
14 mc grabby              35.0      46.5          16            43
```

---

## Layout

```
ReUp_Mix.user.js          the build output — this is the script to install
Ryn_Type_2.user.js        Ryn Type 2, with the melee animation and grip system
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/verify-melee.js     Ryn Type 2's melee grip geometry and rewritten renderer
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
