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

# RYN v5.4 — Novastorm ports

`RYN_v5.4.user.js` is RYN v5.3 with five features taken from
`novastorm.v1.4.js` and nothing else changed. Novastorm is a fork of the old
game bundle (`myPlayer.x2`, `items.list`, `io.send`, `visibleObjects`), so
nothing could be copied as code — the rule each feature implements was ported
onto RYN's managers, with novastorm's original condition quoted in a comment
above every one of them.

Auto Place, Preplace and Replace are **untouched**: the `AutoPlacer` class and
everything it calls is byte-identical to v5.3.

| | was | is |
|---|---|---|
| **Autoheal** | eight stacked special cases (trap about to break, melee+ranged combo, reverse insta, tool hammer, ranged bow, danger flags, health < 20), each healing a hand-picked number of food | novastorm's single rule: `potentialDamage + potentialSpikeDamage`, capped at 140, `×0.75` under soldier, `+5` under scuba — heal if that reaches health, or if a tick passed without being hit. RYN's `shameActive` guard and `heal()`'s shame queue stay, novastorm has no equivalent |
| **Anti Smart Tick** | committed the moment it saw the danger; no toggle; approximated the knockback test with a box | novastorm's stall — stop autobreak, hold whichever weapon is still reloading, and only commit when both are ready and there is nothing left to stall on. New `Anti Smart Tick` toggle. Knockback test is now segment-to-circle |
| **Auto Mills** | sandbox only, `age < 20`, stopped once autobuy finished, and needed all three mills placeable — it could not run in a real game | novastorm's combat mill: three windmills dropped behind you, any time, not while pinned or next to a trap, each of the three tested on its own. **Off by default** now that it runs, on the existing keybind. Offset stays RYN's exact solve rather than novastorm's `toRad(scale + scale/2)` approximation |
| **Safe Soldier** | soldier went on at weapon reach + 20px, a tick late against anything that closes fast | novastorm's flat 300px radius, as a new `Safe Soldier` toggle, alongside the existing reach and danger tests |
| **Packets** | budget of 70/sec, counting only what RYN itself sent | novastorm's 119 — the whole server allowance. Safe to take because `socket.send` is now wrapped at the transport so the game bundle's own frames count too; frames sent through `PacketManager` are skipped there to avoid double counting |

## Bot random movement

x18 has no bot movement to take. Its Bots menu — "Send bots", "Close bots",
`botcount`, `botname`, `botplatformplacer` — has no implementation behind it:
the two buttons carry no event listener and the three settings have no readers
anywhere in the file. `altPlayerManager` is an iframe alt player, not a fleet.

The **other two x18 files do**, and their bot movement is three modes on a
variable called `ai`: `Wander` (random), `Static` (stand still) and `Summon`
(follow the owner). RYN already had all three — Scatter Bots, Freeze Bots and
normal follow — so what was ported is x18's *wander algorithm*, into RYN's
existing scatter, which otherwise keeps its obstacle steering and its
walk-everyone-home-on-toggle-off. What changed:

| | was | is |
|---|---|---|
| **The algorithm** | re-rolled the heading every 1200ms regardless — a bot changing its mind nine times before it has crossed its own body, which is why the movement read as jitter rather than roaming | x18's `moveRan`: commit to a heading and keep it until the bot has covered a 3300px leg or has stopped moving, then turn. The new heading is rejected and re-rolled while it lands within 2 radians of the old one, so a change of direction is always a hard turn of at least 115°, never a nudge |
| **The key** | `_scatterBots: ""` — unbound, so `event.code === Settings._scatterBots` was never true and the feature was unreachable | bound to **`J`**. The tile is renamed `Bot Random Movement`. x18's third mode, Static, is `Freeze Bots` and shipped unbound the same way — now **`K`** |
| **Bind check** | guarded on `!== "..."` while the default was `""`, so an untouched bind was a value the handler could not recognise | any falsy or placeholder bind counts as unset |
| **Toggle state** | read back off `clients[0]._ModuleHandler._scatterActive` | a persisted `Settings._botsScattered`, reconciled onto every bot each frame |
| **Late bots** | a bot spawned after the toggle kept trailing the owner while the rest wandered | joins the mode on its next frame |
| **Coming back** | "returning" ended only on getting within 120px of the owner — a blocked bot, or a dead or distant owner, left it suppressing normal movement forever | an 8s deadline hands it back regardless |

## Bot combat, formation and HUD

| | |
|---|---|
| **Bot Auto Break** | Sakuna's autobreak, bot-only, in the Bots menu. Fires when a bot is *told to move and does not move* for three ticks — a bot standing still because nobody asked it to walk is not stuck, and neither is one still drifting. It then takes Sakuna's fullest-direction pick: of the destroyable things in weapon reach, the direction with the most of them within 90°, lowest health first, swinging at the mean angle of that group. Sakuna sweeps 360 one-degree steps to find that direction; the same maximum is found by testing the blockers' own directions, which is `n` candidates instead of 360 and cannot miss a cluster falling between two steps. Breaks with the great hammer when the bot has one, per Sakuna, otherwise the primary |
| **Bot Ranged Kiting** | With a bow, crossbow, repeater or musket in the secondary, holding attack sends bots out to the distance set by the **Kite distance** slider (150–1200px) and has them shoot from there. Inside a 45px band they hold position and fire, so a volley lands together instead of trailing in one bot at a time. Holding the band costs no packets — `PacketManager.move` sends on every call, so only a real change of heading is sent |
| **Train formation** | Single file directly behind you, one carriage per bot, oriented to your *movement* direction and falling back to your aim when you stand still. Unlike `column`, which is a fixed-length line centred on you and squeezes as bots are added, the train is anchored at you and grows backwards, so spacing stays at 70px whether there are 5 bots or 40 |
| **Be Angel** | Bots settle on hat 12 (Booster Hat) and accessory 11 (Monkey Tail) whenever nothing dangerous is happening — both are movement speed. This swaps those two defaults for hat 48 (Halo) and accessory 13 (Angel Wings), which regenerate health instead, moving and standing still alike. Only those two "nothing is happening" exits are touched: soldier, bull, turret gear, emp, flipper and winter all keep priority, so a bot in trouble still wears the hat that keeps it alive. Bots only — the owner's hats are untouched |
| **Server player counter** | A `PLAYERS n/m` row above FPS. The game fetches its server list exactly once at load and has no refresh loop, so `#serverBrowser`'s `[n/m]` labels are a snapshot from before you joined; this re-fetches the same endpoint every 10s and reports the entry matching this tab's `?server=region:name`. Falls back to the browser label, then to `?` |

See `tests/README.md` for the build and test commands.
