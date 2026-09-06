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
Nova_ChickenTick.user.js  second build: Nova with chicken's one tick (see below)
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/Nova_Client_Recode.js Nova client, base of the second build (input)
src/chicken_v4.6.2.js     chicken client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/build-nova-ot.js    src/Nova_Client_Recode.js -> Nova_ChickenTick.user.js
tools/verify-nova-ot.js   runs the ported one tick against stub globals
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

# Nova Client (chicken OT)

A second, independent build: the **Nova Client (Recode)** with its entire one
tick torn out and replaced by **chicken v4.6.2**'s.

Build output: **`Nova_ChickenTick.user.js`**

```sh
node tools/build-nova-ot.js      # produce Nova_ChickenTick.user.js
node tools/verify-nova-ot.js     # run the ported one tick against stub globals
node --check Nova_ChickenTick.user.js
```

Nothing else in Nova is touched. This has no connection to the ReUp Mix build
above; they share only the repo.

## What came out

Nova had the same combo written five times over, plus two ways of walking into
it and a third that fired on its own:

| Removed | What it was |
|---|---|
| `oneTick(insta, dontMove)` | the standalone combo, called by the auto path |
| `instaC.oneTickType` / `threeOneTickType` / `zeroFrame` / `kmTickType` / `boostTickType` | five spellings of that same combo |
| `instaC.tickMovement` / `boostTickMovement` / `kmTickMovement` / `BoostOneTick` | four `gotoGoal` walk-ins, on goals of 238 / 372 / 240 / 372 |
| `doOneFrame()` / `autoOneFrame()` | the "AOT" auto one frame, on a ping-scaled 170–245 window |
| the AVOT block | ~70 lines of hat prediction in front of `oneTick(1)` |

`gotoGoal` itself stays, because `bowMovement` (middle click, bow insta) is its
only other caller and that is not a one tick.

Four things in there were already broken before this change, and are worth
naming because they are why the old one tick behaved unevenly:

- `oneTick()` opened with `if (traps.in) return;` — the `Traps` class has no
  `in`, the field is `inTrap`, so the "don't one tick out of a trap" guard
  never fired once.
- the AOT distance gate read the same missing `traps.in`.
- the AVOT block indexed `near.skinIndex` as an array (`skinArray.length`,
  `skinArray[i]`). `skinIndex` is a number, so `arrayCount` was `undefined` and
  every branch under it compared against `NaN`.
- both auto paths logged through `loging.success(...)`, and `loging` is not
  defined anywhere in Nova. That line would have thrown the moment
  `configs.OneTickReactionMode` was ever set — it is not in `configs`, so it
  never was.

`noMove`, `noWep` and `onetick123modprov3asd` were written by `oneTick()` and
read by nothing, and went with it.

## What went in

chicken keeps one one tick, and it is a controller rather than a combo:

- **`instaManager.onQueue`** — a FIFO drained one entry per server tick, so the
  combo keeps its shape when a tick packet is late. Nova nested
  `game.tickBase(..., 1)` callbacks instead, which fire on an absolute tick
  number and bunch up together after a stutter.
- **`startInsta("ot" | "reverse")`** — the shot. Tick 0 turret gear + primary,
  tick 1 bull helmet + aim + hit, tick 2 release.
- **`oneTickMovement()`** — walks the player onto `game.perfectOTDistance`
  (225) by picking the hat/accessory pair whose combined speed multiplier lands
  inside the ±5 window, and fires the moment it is there:

  | \|error\| | hat | accessory | net speed |
  |---|---|---|---|
  | > 35 | soldier ×0.94 | monkey tail ×1.35 | ×1.27 — close in |
  | 20–35 | soldier ×0.94 | shadow wings ×1.10 | ×1.03 |
  | 10–20 | tank gear ×0.30 | none ×1.00 | ×0.30 — crawl |
  | ≤ 10 | tank gear ×0.30 | shadow wings ×1.10 | ×0.33 |
  | ≤ 5 | **fire**, or hold with soldier + shadow wings |

Translated into Nova's API: `hatSystem.storeEquip` → `buyEquip`,
`chicken.selectToBuild` → `selectWeapon`, `io.send`/`chicken.sendAim` →
`packet`, `game.enemies.nearest`/`.angle` → `near`/`near.aim2`, `player.vel` →
Nova's `x3`/`y3` (both are `pos + (pos − lastPos)`, the same one-tick
extrapolation), `healer.reloadPercent(p, i) == 1` → `player.reloads[i] == 0`.

### Wiring

- **Hold `T` or `;`** — chicken's hold mode, on the two keys that used to run
  `tickMovement` and `boostTickMovement`. chicken binds this to
  `scriptMenu.keyBinds.oneTickKey`, which Nova has no equivalent of. Nova
  gated those keys on weapon and reload before it would even walk; chicken
  only gates the shot, so the keys now just arm it.
- **`P`** still toggles Nova's auto one frame (`configs.autoOneFrame`), and
  `configs.safeTick` still keeps it off soldier and EMP targets — but it fires
  on chicken's window now, through `instaManager.autoOneTick()`. That path
  only takes a tick that is already there: no steering, no gear staging.
- While hold mode is steering it sets `instaC.ticking`, which is how Nova's
  own OT movement kept `hatChanger`, `accChanger` and `autoPush` off its gear.
  The reloaded-weapon swap is also held off, which Nova never did — that swap
  fought `gotoGoal` for the weapon slot on every approach tick.
- `my.anti0Tick` (Nova holding soldier against a threat) overrides the
  controller's hat, the same way `hatSystem.checkOnlySoldier()` does in
  chicken.

### Two deliberate changes to chicken's code

- chicken's fire gate reads `e.skinindex != 6` — lowercase `i`, so that half of
  it always passed and chicken would one tick into a soldier helmet. Ported as
  `skinIndex`, which is what the line is for.
- Turret gear and bull helmet ownership are checked before firing. chicken gets
  this for free (`storeEquip` returns early on a hat you don't own); Nova's
  `buyEquip` equips a fallback hat instead, which would have burned the combo.

### One thing left as-is

`oneTickMovement` opens with `if (n <= 25 && s < 0) n = 5;`, where `s` is the
predicted distance minus the error you already have. A tick of movement is
~40px, so `s` never goes negative and the shortcut cannot fire; the band table
is what decides. It is ported verbatim rather than guessed at, and
`verify-nova-ot.js` pins that it stays unreachable — if a future change makes
it live, that check fails and says so.

## Verification

`node tools/verify-nova-ot.js` lifts `instaManager` straight out of the built
script and runs it against stub globals — 35 checks covering the band table,
the three-tick packet sequence, one queue step per tick, every fire gate
(soldier, EMP, monkey tail, both reloads, both hats), the trap and death
paths, hold-mode release, and the auto path's own gates. All 35 pass on the
current build.

That exercises the ported module, not the client around it: the rest of Nova
is unchanged code that this repo does not run.
