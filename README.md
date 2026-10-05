# ReUp Mix (Luna × Ryn)

A merged moomoo.io userscript: the RYN Client v4 core with the Luna Client
features RYN never had, built against the game bundles in `src/` and verified
against them.

Build output: **`ReUp_Mix.user.js`**

This repo also builds **`Luna_Client.user.js`**: Luna Client 1.7 with its
auto-heal rebuilt and its anti toggles actually wired up. See
[Luna+](#luna-luna-client-18).

---

## Luna+ (Luna Client 1.8)

`src/Luna_Client_1.7.js` → `tools/build-luna.js` → `Luna_Client.user.js`.
It keeps 1.7's `@name` and `@namespace`, so Tampermonkey installs it as an
update instead of a second copy.

Compared against the auto-heal and antis of ai slop skidd v1, Misery V3,
novastorm 1.4 and Ryn Type 2. Misery, ai slop and novastorm are all forks of
Luna's survival block (novastorm's is line-for-line the same). Ryn Type 2 ports
it again on its own engine.

### What was broken in 1.7

| | |
|---|---|
| **Dead anti toggles** | `anti default insta`, `anti reverse insta`, `anti sync`, `anti onetick`, `anti Kb Sync/Hammer/Dagger/Placement`: menu rows with no code behind them and no default. |
| **Dead "faster heal" key** | Q set a `qPress` flag that nothing read and nothing cleared. |
| **`antiTick` never read** | `projectileHandle` spotted the turret shot from 200–300 out that opens a velocity one-tick, set `antiTick`… and nothing used it. |
| **Wrong projectile damage** | `getPlayerInfo("secondaryDmg")` had bow 15 (really 25), crossbow 30 (35), repeater 35 (30), so bow and crossbow instas were read too low. |
| **`damages` never cleared** | It grew all session. After the first poison chunk, poison prediction stopped for good. Before any poison it predicted a fake 5 dmg every 9 ticks. `% 9 == 9` can never be true. |
| **`damagesByShoots` never cleared** | It stayed non-empty forever after the first projectile hit. |
| **`canStillGather` reset per enemy** | A second enemy cleared the spike-push read found for the first (Misery fixed this, Luna never did). |
| **Slow heal** | A free heal waited 1–2 full server ticks (111–222 ms) after a hit, whatever the ping. |
| **Heal packets** | 4 packets per food, no packet budget, no food-count check. |
| **Upgrade bar hid items** | Luna's copy of the item table never turned `pre` from a relative offset into an item id, as the game does. So at age 9 poison spikes only showed if you had cookie, and spinning spikes only if you had cheese, never both. Castle wall and the mill upgrades were also locked behind a food. Fixed: the bar now matches the game in all 1,106,640 ownership × age states checked. |

### What Luna+ does

**Auto heal**
- **Ping-aware shame-safe timing.** The server counts shame when food lands
  within 120 ms of the last hit, measured server-side. That gap is our wait
  plus one full round trip, so the heal waits `max(0, 120 + margin − minRTT)`.
  At 60 ms ping that is 80 ms instead of up to 222. From about 140 ms ping it
  heals straight away. A timer fires the heal at that moment instead of
  waiting for the next tick to notice.
- **Emergency heal** when the damage read says the next tick kills: right
  away, under 7 shame. It also goes through 7 shame when the first half of an
  insta has *already landed* (ai slop's foe-burst rule), because being clowned
  is better than dying.
- **Packets:** 3 per food plus 1 weapon restore, trimmed to the 119 budget
  before anything is sent (from ai slop). Only food you can afford is sent
  (from Ryn Type 2). A batch already on its way is not sent again unless a new
  hit lands.
- The **faster heal** key (default Q) heals on press and tops you up while held.

**Antis** (all on by default; a value you already saved still wins)

| Toggle | What it reads |
|---|---|
| anti default insta | Luna's primary-opener follow-up, now behind its toggle. It also marks the burst as confirmed when the opener came from that enemy. |
| anti reverse insta | **New.** Secondary, turret or projectile lands first, then the bull primary, which is ready and in reach. A musket or bolt still in the air at you also counts. |
| anti sync | **New.** Two or more enemies who can all swing this tick, summed. Luna's per-enemy reads only ever counted one. |
| anti onetick | Luna's velocity-tick read, plus the long-dead `antiTick`, plus Ryn Type 2's forward sim (diamond/ruby polearm in bull or turret gear, loaded within 3 ticks, closing and facing you). |
| pre-emptive soldier | **New.** One enemy has everything for an insta loaded and in reach, and the combo kills at your HP: the helmet goes on *before* the opener. A turret only counts for someone seen wearing or firing one. This costs bull on your own swings, so it has its own switch. |
| anti Kb Sync | **New.** Two enemies' knockbacks added together, onto a spike. |
| anti Kb Hammer | **New.** Hammer knockback onto a spike. Luna only swept primaries. |
| anti Kb Dagger | **New.** Daggers reload every tick: a double push onto a spike. |
| anti Kb Placement | Luna's 36-angle "enemy places a spike and hits", plus ai slop's and Misery's soldier for 4 ticks after your trap breaks, and while a spike is biting. |

**Soldier.** Any read that is lethal at your current HP puts on the helmet.
Often the helmet alone makes the hit survivable, so no shame-costing heal is
needed. This changes the hat only, so you keep swinging. It is skipped while
your own insta is mid-sequence, and Luna's `soldierAnti` still has the last
word.

**Auto Heal** menu: `smart heal (ping aware)`, `heal through shame on insta`,
and `shame safety ms` (the margin, default 20).

**Show all upgrades** (Utilities, on by default). With `pre` resolved, the bar
shows what the game shows: both age-9 spikes need greater spikes. Every other
client in the set shows more. Misery, ai slop, novastorm and Luna 1.1 have no
item `pre` at all, and Ryn Type 2 / RYN v4 remove the check with a `true||`
hook, so they offer every item of the age. None of the files proves whether
the server accepts an item without its prerequisite, so Luna+ offers those
choices too, but dimmed, with a "needs X - the server may refuse it" tooltip. A
refused pick spends nothing. Turn the toggle off to get the game's bar exactly.
Weapons always keep their prerequisite, as in every client.

### Build / test

```sh
node tools/build-luna.js          # -> Luna_Client.user.js
node tools/test-luna.js           # 37 scenarios (fights + real upgrade bar) against the build
node --check Luna_Client.user.js
```

`test-luna.js` cuts the helpers, `getPlayerInfo`, the whole ANTIS AND HEAL
block and `hatFc` out of the build. It runs them against scripted ticks using
the game's own items, config and utils modules. That proves every new path
runs without throwing, and that each anti fires on its target state and stays
quiet otherwise. It is not a live match. The thresholds (`healMargin`, the 35
reach pad, the 3-tick sim) are the knobs to tune after real fights. Luna's
death log (`Predict Damages before death` next to `Damages before death`) is
the tool for that.

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
Luna_Client.user.js       Luna+ build output (Luna 1.7 + survival engine)
src/Luna_Client_1.7.js    Luna 1.7 as supplied (input to build-luna.js)
tools/build-luna.js       src/Luna_Client_1.7.js -> Luna_Client.user.js
tools/test-luna.js        Luna+ survival scenarios against the build
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
