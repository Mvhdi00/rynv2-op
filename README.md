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
chicken_v4.6.2.user.js    second build: chicken with Nova's one tick (see below)
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/chicken_v4.6.2.js     chicken client, base of the second build (input)
src/Nova_Client_Recode.js Nova client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/build-chicken-ot.js src/chicken_v4.6.2.js -> chicken_v4.6.2.user.js
tools/verify-chicken-ot.js runs the ported one tick against stub globals
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

# chicken (Nova one tick)

A second, independent build: **chicken v4.6.2** with its entire one tick torn
out and replaced by the **Nova Client (Recode)**'s.

Build output: **`chicken_v4.6.2.user.js`** — same name as the base client, and
the userscript header inside it is still chicken's own (`@name chicken`,
`@version v4.6.2`).

```sh
node tools/build-chicken-ot.js     # produce chicken_v4.6.2.user.js
node tools/verify-chicken-ot.js    # run the ported one tick against stub globals
node --check chicken_v4.6.2.user.js
```

Nothing else in chicken is touched, and this has no connection to the ReUp Mix
build above; they share only the repo.

## What came out

chicken's one tick is `instaManager`, and two of its three parts are the one
tick:

| Removed | What it was |
|---|---|
| `instaManager.oneTickMovement()` | a four-band controller onto `perfectOTDistance` (225) with a ±5 fire window |
| the `"ot"` body of `instaManager.startInsta` | the three-tick shot: turret gear → bull helmet + hit → release |

`startInsta` keeps its `"reverse"` body — that is what `autoHit.autoInsta()`
fires, chicken's auto insta rather than its one tick — and is now reverse-only,
which is the only value that path ever passes. The queue (`onQueue`,
`tickBase`, `addToQueue`) stays for it. `holdModeOT` stays exactly where it is:
`keyDown`/`keyUp` set it off `scriptMenu.keyBinds.oneTickKey` and the render
path draws the crosshair from it, and neither needs to know what runs
underneath.

## What went in

Nova's one tick is a different shape — a wider, coarser approach and a longer
shot — and all three of its parts came across:

- **`gotoGoal(goto, OT)`** — an eight-band approach controller. Nova measures
  the error in player scales (35px) and stages a hat and an accessory per band
  so the next tick lands closer to the goal:

  | \|error\| | hat | accessory | net speed |
  |---|---|---|---|
  | in window (±3) | emp helmet ×0.70 | stone cape ×1.00 | ×0.70 — hold and fire |
  | ≤ 35 | tank gear ×0.30 | stone cape ×1.00 | ×0.30 — crawl |
  | 35–70 | booster hat ×1.16 | none | ×1.16 |
  | 70–140 | *untouched* | none | — |
  | > 140 | soldier ×0.94 | stone cape ×1.00 | ×0.94 — close in |

  Overshooting runs the same ladder mirrored, with no accessory in the first
  band instead of the cape. In the river every hat slot becomes the flipper.

- **`boostTickType()`** — the shot, four ticks: biome gear + blood wings →
  turret gear, the walking weapon out, a booster/trap dropped at the target
  (and the hit here if the secondary is ranged) → bull helmet, primary back
  out, the hit here otherwise → release. A musket secondary flips the aim
  behind the target for its tick, Nova's `my.revAim`, so the shot's knockback
  carries you in.

- **`oneTick()`** — Nova's *other* one tick, the auto one, and a different
  combo: great hammer + turret gear → polearm + bull helmet + hit → release.
  It fires off a velocity prediction rather than a distance window
  (`calcOTVel`): if a tick of acceleration into the target lands inside 205
  while you are still past 223, take it now.

The goal is 238, or 372 when the secondary is a bow, crossbow, repeater or
musket — Nova's `tickMovement` and `boostTickMovement` respectively, folded
into one path and picked by weapon, since chicken has one one-tick key where
Nova had two macros.

Translated into chicken's API: `buyEquip` → `hatSystem.storeEquip`,
`selectWeapon` → `chicken.selectToBuild` + `preferedWeaponIndex`,
`sendAutoGather` → `chicken.sendAutoGather`, `packet("9", …)` → `io.send` behind
chicken's `movementDirection` cache, `place(4, …)` → `placer.place`,
`game.tickBase(fn, 1)` → `game.tickOut(fn, 1)`, `near`/`near.aim2` →
`game.enemies.nearest`/`.angle`, `player.reloads[i] == 0` →
`healer.reloadPercent(p, i) == 1`.

### Wiring

- **Hold the One Tick Key** (menu → One Tick, default `T`) runs the approach.
  Nova gated its two macros on weapon and reload before it would even walk —
  primary reloaded, and polearm out, or katana with a reloaded musket, or a
  reloaded ranged secondary — and those gates came along as `canRun()`. When
  they fail, chicken falls through to its normal branches instead of standing
  there doing nothing.
- **Auto One Tick** — chicken ships this toggle in its menu, with an **Ignore
  Soldier** child, and had no code behind either. They now drive Nova's
  `oneTick()` and its trigger, with Ignore Soldier being Nova's
  `configs.safeTick` inverted (off by default, i.e. don't one tick into a
  soldier or emp helmet).
- `chicken.autoaim` carries the combo the way `instaC.isTrue` + `my.autoAim`
  did in Nova: it stands the action chain down, aims at the target, and keeps
  chicken's own `tickMovement` walking in for the whole combo.

### Three deliberate changes to Nova's code

- Nova moves during `boostTickType` with `packet("a", …)`. **`"a"` is not a
  client opcode** — the c2s alphabet in `drivers/game-drivers.json` is
  `M D 9 e F z H K L N b P Q c 6 S 0`, and `"a"` is server→client — so as
  shipped that combo never moves, while every sibling combo in Nova uses
  `"9"`. Sent on `"9"` here; `novaOneTick.moveDuringCombo = false` restores
  the shipped behaviour.
- `oneTick()` opens with `if (traps.in) return;` and the `Traps` class has no
  `in` — the field is `inTrap` — so Nova's "not while trapped" guard never
  fired once. Reads `player.trapData` here.
- Nova's auto trigger also gated on `near.skinIndex` indexed as an array
  (`skinArray.length`, `skinArray[i]`) and logged through `loging.success()`,
  an object that is not defined anywhere in the client. Neither could do
  anything but produce `NaN` or throw, so the trigger is the part of it that
  computes: turret ready, primary within a tick, past 223, predicted inside
  205.

### Two things left as-is

- `calcOTVel` reads `player.xVel`, which Nova sets to 0 on spawn and never
  updates, so its velocity term is always zero. Kept at zero so the trigger
  fires on the same distances it was tuned on — which is a window of roughly
  223 to 248. chicken's `player.vel` is there if anyone wants the
  moving-start version.
- `gotoGoal` branches on `configs.slowOT`, which is not in Nova's `configs`
  object, so the branch never ran. Same default here, one flag away
  (`novaOneTick.slowOT`).

## Verification

`node tools/verify-chicken-ot.js` lifts `novaOneTick` straight out of the built
script and runs it against stub globals — 45 checks covering every band on both
sides of the goal, the river case, goal selection by weapon, the four-tick
combo (including the drop, the ranged/melee hit split and the musket's reverse
aim), the `moveDuringCombo` switch, all of Nova's macro gates, the auto combo's
sequence, every gate on the auto trigger, and that the trigger's window really
is 223 to ~248. All 45 pass on the current build.

That exercises the ported module, not the client around it: the rest of chicken
is unchanged code that this repo does not run.
