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

# Ryn Type 2 — bot protection, exclusion, clans and formations

A second artifact in this repo: **`Ryn_Type_2.user.js`**, the Ryn Type 2
userscript with four pieces of work added on top of its existing bot
architecture. It is a separate client from ReUp Mix and shares nothing with it
except the game bundles in `src/`, which the uploaded `moomoo_1.js` /
`moomoo_2.js` match byte for byte (whitespace aside), so `drivers/` is a valid
reference for both.

Tests: `node tools/test-ryn-protection.js`. The suites slice the blocks under
test straight out of the userscript and run them against stubs built from the
game's own constants, so they exercise the shipped code rather than a copy.

## 1. Friendly fire, at the decision level

The game's only protection between two players is the clan: the server skips a
melee hit, an arrow and a spike's contact damage exactly when
`owner.team == target.team` (`src/game_index.js`, the three
`!(x.team && x.team == y.team)` tests). Everything in the client that decided
"enemy" was reading `clanName`, directly or through `PlayerManager.isEnemy` —
correct only while the whole fleet shares one tribe, which the individual-clan
feature deliberately breaks. **That is why bots could be turned on each
other.**

`RynAllegiance` answers by ownership instead: the main player and every bot of
the fleet, by sid, from a set rebuilt only when the fleet changes. It is
consulted at the targeting chokepoints — `ClientPlayer.isTeammateByID`,
`PlayerManager.updatePlayer` (which is what fills the `enemies` array every
other module reads), `isEnemy` / `isEnemyByID` / `isEnemyTarget` / `canShoot`,
`EnemyManager.handleEnemies` and `handleNearest` — so a protected player never
becomes a target in the first place.

Behind that, `RynSafeAim` is the last gate. Nothing in moomoo aims at a player:
a swing damages *every* non-teammate inside `gatherAngle` of the direction it
was sent at, and an arrow damages the first body its flight line crosses. So
"do not attack X" cannot be answered by choosing a different target. The gate
in `ModuleHandler.attack` re-aims to a direction that still contains the
intended target and does not contain anyone protected, and holds the frame when
no such direction exists. `requestPlace` refuses a spike or trap whose
footprint would touch one. Clan mates are exempt — the server already refuses
that damage, so there is nothing to dodge and no output to give up.

A bot you are **possessing** is ungated, like your own client. Your clicks
never reached the gate anyway — the bundle raises the attack frame and the
possession wrapper hands it to the active entity's `PacketManager`, a
different path — so this only means the rest of that bot's tick behaves the
way the main player's does while you hold it.

## 2. Player exclusion

`EXCLUDE` sits next to `SCAN` on every row of the Target Scan list. The two are
independent: a player can be scanned and excluded at once, which tracks them
without any bot ever attacking them. Exclusions are stored by sid, carry the
name so the same person stays excluded after respawning onto a new sid, and
persist across reloads. The exclusion feeds the same chokepoints as ownership,
so it applies everywhere, not only inside SCAN — including the case in the
brief, an excluded player standing between a bot and a legitimate enemy.

## 3. One tribe per bot

The old `_individualClanTick` had three independent faults, each fatal:

| | |
|---|---|
| It asked for the bot's whole player name | Tribe names are capped at **7** characters (`maxLength: 7` on the alliance input, sliced to 7 before sending), so a longer name could never come back equal to what was asked for and the bot left and re-created forever |
| Every bot asked for the same name | They all carry the same base name; one got a tribe, the rest asked for one that was taken |
| A taken name was answered with `joinClan` | That is a *request* the tribe's owner must accept — against a stranger it was a packet every third tick for the life of the bot |

It is now a state machine over the transitions the server actually has, graded
against the `setPlayerTeam` frame (s2c `3`), which nothing previously read —
`clanName` was left to arrive with the next player update a tick later, so the
old code could not tell "not landed yet" from "refused". Each bot derives its
own name from its fleet slot, cut to seven characters with the number kept, so
`GG1` over five bots gives GG11…GG15. A contested name rotates instead of being
asked for again; the whole fleet shares one action token. Measured by the
tests: five bots, five packets; twenty bots, twenty packets, twenty unique
tribes.

## 4. Bot protection and the formation engine

`RynProtect` + `BotProtection` put the first *N* bots of the fleet in front of
the rest as a screen — bots only, not the main player. Everything expensive is
worked out once per owner per server tick and read by every guard: the merged
enemy picture, the grouping, the projectile tracking, the anchor and the sector
split. A guard's own tick is a cache read, one vector and a state machine.

- **Grouping** requires proximity *plus* at least one of a shared name stem, a
  shared tribe, or a shared direction of travel. A name alone is never enough,
  and neither is standing near someone.
- **Slots** come from the fleet index and nothing else, so a direction change
  rotates the shape and leaves every bot where it was. `RynFormations` holds
  the geometry in formation-local coordinates and rotates in one place, which
  is what makes that hold by construction — the tests assert it for every
  shape, every size and every facing.
- **Weapons** run a state machine with hysteresis: daggers and move when safe,
  shield and face the threat when a bow, crossbow, repeater or musket is in
  range or an arrow is already in the air, back to daggers when it passes.
  Guards choose daggers, wooden shield and boost pad through the existing
  upgrade patch rather than by pretending to hold them.
- **Boost pads** are laid on a ring around the formation and never on a heading
  with a friendly on it — the server's booster branch has no team test at all,
  so a pad shoves whoever steps on it.
- **Advance** moves the screen's origin forward *and* deepens the ranks, so it
  changes the geometry rather than the speed.
- Eleven new military formations — wedge, V, arrow, diamond, cross, wall,
  double line, spearhead, arc, crescent, staggered line — are added to the
  existing formation picker as well as the guard screen, from one table. Rank
  spacing is held between 72 and 104 units: under 70 the game's own collision
  shoves neighbours apart, over 105 a 35-radius body walks through the line.
