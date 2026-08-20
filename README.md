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

# Novastorm 1.5 — bot system

Build output: **`novastorm_1.5.user.js`** (Novastorm 1.4 with the bots rewritten).

The 1.4 bots connected, entered the game and did nothing else. In 1.5 every bot
parses its own packet stream into a private world model — players, objects,
loadout, age, store — and acts on it on its own server tick. The engine lives in
one block (`RynBots`) next to `updatePlayers`, and everything it does goes out
through Novastorm's own EXP framing, so bots speak exactly the protocol the
master connection speaks.

## Features

| Feature | Where | What it does |
|---|---|---|
| **Auto Spawn** | Bots → Join / Leave | The instant a bot dies it re-sends the spawn packet. No menu, no wait; a dropped spawn is retried once a second. |
| **Auto Break** | Bots → Behaviour | Three stalled ticks while trying to walk means something is in the way: the bot finds the closest destroyable building within reach and within 90° of its heading, swaps to its breaking weapon and swings. Walls, mills, spikes, traps, turrets, blockers. |
| **Auto Heal** | Bots → Behaviour | The mod's own heal, not an approximation: it fires on **any** damage taken (the mod's `tick - damageTick > 0`, here a drop in the bot's own health packet) and tops all the way back to 100 in one tick — `ceil(missing / food.heal)` units, which is what the mod's `heal(100 - health)` loop works out to. The first version waited for 15 missing health and then ate at most three, which is why it felt bad. Runs while you are driving a bot too. |
| **Auto Mills** | Bots → Behaviour | The mod's three-mill trail, laid **behind** the direction of travel: `angle + 180°`, then `± toRad(scale + scale/2)` either side. That offset reads the mill's scale as degrees — odd arithmetic, but it is what the mod does and what gives the familiar spacing, so it is reproduced rather than "corrected". Off by default. |
| **Full Mod** | Bots → Behaviour | The bots stop running ported rules and run *the mod itself* — its own tick, on their own world, through their own socket. Everything the mod does, they do. Off by default; see [Full Mod](#full-mod--the-bots-run-the-mod-itself). |
| **Spike Tick** | Bots → Behaviour | The mod's trap tick, `canTrapTick()` gate for gate on the bot's own world: hammer and primary both charged, the enemy inside one of the bot's own traps, that trap one hammer hit from breaking, and a placeable spike spot within `scale + 55` of them whose knockback does not shove them at the bot. Pops the trap and drops the spike on the same server tick. See [the foundation it rides on](#the-spike-tick-foundation). |
| **Auto Push** | Bots → Behaviour | The mod's trap-into-spike play: when the nearest enemy stands in one of the bot's own pit traps and one of its own spikes sits beside that trap, it walks at the far side of the spike so they are shoved onto it, swinging as it goes. Same construction as the mod — `pos = spike + scale·unit(spike→trap)`, `push = pos + (dist+35)·unit(pos→enemy)` — and the same clearance test, refusing a line through their body, their spikes, a boost pad or a teleporter. |
| **Auto Place** | Bots → Behaviour | An enemy inside 250 gets a spike dropped between them and the bot, hardest one owned first, and never stacked on a spike already there. |
| **Sync** | Bots → Sync & Freeze | On: the squad swings on the same tick you do — one wrapper on `io.send` catches every swing the client makes, and `place()` flags its own use of the attack packet so putting a building down is not read as a swing. Off: they swing while the **Bot Attack** key is held. |
| **Loadout** | Bots → Loadout | You pick the primary (age 2) and the secondary (age 6); the bots take exactly that on upgrade. |
| **Auto Buy** | Bots → Behaviour | Bots buy and equip whatever hat and accessory you are wearing, and follow you when you change. |
| **Circle Radius** | Bots → Formation | 50–800. Bots take evenly spaced slots on a ring around the follow target. |
| **Stop Movement Radius** | Bots → Formation | 25–300. Deadzone: inside it a bot stops walking instead of jittering on its spot. |
| **Trap / Boost Pad** | Bots → Age Picks | Two toggles for one choice — switching one on closes the other. |
| **Age picks** | Bots → Age Picks | age 2 chosen primary · 3 cookie · 4 trap **or** boost pad · 5 greater spikes · 6 chosen secondary · 7 platform · 8 crossbow when the bot holds a bow, otherwise power mill · 9 spinning spikes. |
| **Freeze Bot** | Keybinds → Bot Keys | One key nails every bot to the ground; press again to release. |
| **Random Move** | Bots → Behaviour | Roams the whole map. Includes Auto Break and Safe Walk (never steps into an enemy's spikes or pit trap — it fans the heading out 25° at a time until the way ahead is clean). Blocked by something it cannot break — a tree, a rock — and it turns. Two bots walking the same line and the later one picks a new destination. While roaming a bot holds the fastest weapon it can break with. |
| **Auto Random Bots name** | Bots → Bot Setup | A random word plus a running number: `raven1`, `flux2`, `onyx3` … |
| **Follow Cursor** | Bots → Behaviour | The ring forms around the mouse in world space instead of around you. Off, they form around you. |

Bots never target each other and never target you: your SID and every bot SID
are filtered out of target selection, so only real players are ever hit.

## The breaking weapon

"The fastest weapon they can break with" is read off the live weapon table as
structure damage per millisecond, `dmg * (sDmg || 1) / speed`, over the two
weapons the bot actually owns. Every bow (9, 12, 13), the musket (15), the
shield (11) and mc grabby (14) are struck off the list first — they shoot,
block or steal and none of them puts real damage into a building.

## Defaults

Auto Spawn, Auto Break, Auto Attack, Auto Heal, Auto Place, Sync and Auto Buy
start **on**; Follow Cursor and Random Move start **off**. Keys: `N` freeze,
`M` bot attack, arrows for bot control, on top of the existing `P` spawn /
`U` release / `O` kill.

## Scan and Kill

A bot console sits in **Bots → Scan & Kill**. The same parser also reads the
game chat, so a command works from either box and never reaches the server.

| Command | What it does |
|---|---|
| `!find <id or name>` | Starts the hunt. |
| `!c` | Cancels the hunt; bots go back to normal. |
| `!cf` | Ceasefire — cancels the hunt *and* silences every bot: nobody targets anybody. |
| `!fire` | Lifts the ceasefire. |
| `!bots` | Squad status: in game / ready / connecting, hunt state, who you are driving. |
| `!help` | The list above. |

`!find` resolves the name or ID against your own client's player list first —
it holds every player on the server, with names — and falls back to per-bot
name matching for anyone it does not have yet. Your SID and the bots' SIDs are
never a match.

Then the map is cut into one cell per bot and each bot works its own cell, so
the swarm covers the whole map instead of piling into the middle. The moment
one of them has the target in view it becomes the **spotter**:

- it shadows from **Spotter Keep Distance** (150–800, default 350) and backs
  straight off if the target closes in;
- it does not swing, at all — a spotter that starts the fight is the one thing
  the shadowing distance exists to prevent (Auto Break still runs: that is a
  wall in the way, not a target);
- your minimap gets a ping on the target roughly once a second, plus a standing
  red marker with their name.

Every other bot drops what it was doing — Random Move included — and regroups
on your formation ring, so the squad walks in with you. Lose sight of them for
four seconds and the hunt falls back to the sweep on its own.

The ping is drawn locally from the spotter's own world model rather than sent
as a game ping: a real map ping only reaches your own clan, and the bots are
not in it.

## Bot control (possession)

| Key | What it does |
|---|---|
| **←** | Step to the next bot |
| **→** | Step to the previous bot |
| **↑** | Back to your own character |

Inside a bot, the camera rides it, your mouse is its aim, WASD are its legs,
space / left click / E are its swing, and the number row is its action bar —
slots 1–2 are its weapons, the rest are its buildings, placed at your cursor.
Auto Heal still runs for you.

The camera position comes off the bot's own socket, so it is exact even when
the bot is on the far side of the map. Your client is only *sent* what is near
your own player, though, so at that range there is nothing on screen to draw.

**It is drawn by the game's own renderer, not an overlay.** The first version
drew circles — it showed you where things were and looked nothing like moomoo.
The bot receives exactly the packets a real client receives, so the fix is not
to draw its world differently, it is to build a *second world* out of the
game's own classes and point the game's own renderer at it. `GameObject`,
`Player` and `AI` do not care which socket fed them, and `getResSprite`,
`getItemSprite`, `renderPlayer` and `renderSkin` work on any instance.

So possession looks like a second browser on that account: real sprites, real
trees and rocks, real player bodies with their hats and skins, animals, names,
health bars and chat bubbles.

**Entering a bot seeds the view from what that bot already knows**, rather than
starting empty and waiting for packets. This matters more than it sounds: the
server sends `loadGameObject` only when something *enters* a client's view, and
everything already standing around the bot entered view long ago and is never
repeated. `updatePlayers` is sent every tick, so with an empty start players
kept appearing and nothing else did — a bare green screen with the occasional
player walking through it. The bot has kept every object it was ever sent in its
own world model, so the view is built from that and the live packets carry on
from there.

Two worlds are kept side by side and never mixed — yours, fed by your socket,
and the view, fed by whichever bot you are driving. Releasing possession just
stops reading the view; your own state was never touched, so there is nothing
to resync. The packets mirrored into it are `C`, `D`, `E`, `a`, `H`, `I`, `L`,
`O`, `P`, `Q` and `R` — the same set the master client handles for rendering.

**The HUD comes with you.** Score, food, wood, stone, kills, the age bar, the
action bar and the placed-item counts are DOM driven from `myPlayer`, so
without moving them you would be playing someone else's body while reading your
own numbers — the age bar worst of all, since it is the one thing on screen
that visibly contradicts what you are doing. The bot tracks all of it from its
own `N`, `T`, `S` and `V` packets and writes it into the same elements;
releasing hands it back by calling the game's own updaters, so nothing drifts.

**And you can see it fight.** `K` (gatherAnimation) drives `startAnim` on the
view's player, which is the same call the real client makes for its own body —
without it you would be killing people with a body that just slides around. `J`
animates animals, `M` turns turrets, and `O` sets `hitTime` and throws the
floating damage number, so hits read the way they do on your own player.

Your own character freezes: your keys and mouse are steering the bot, so it
stops walking and stops turning. If an enemy comes within **Guard Radius**
(100–600, default 300) of it, Autoplay switches itself on and fights for you,
and switches back off once they leave. Releasing the bot hands Autoplay back
the way it was.

The arrows stop steering you while this is on — that is the trade, and
**Bots → Control → Arrow keys switch bots** turns it off. WASD is unaffected.

### Full Mod — the bots run the mod itself

**Bots → Behaviour → "Full Mod (bots run the whole mod)".** Off by default.

Everything else in this section is a rule copied out of the mod by hand. This is
the other approach, and it is the one RYN's architecture gets for free: don't
copy the rules, lend the mod a different player.

RYN builds every connection as a `PlayerClient` — its own `SocketManager`,
`ObjectManager`, `PlayerManager`, `myPlayer` and module set. A bot there runs the
same modules the owner does by being another instance of the same thing.

Novastorm is the other shape. Its features are not functions of a player: they
are one pipeline over module-scope singletons (`myPlayer`, `gameObjects`,
`visibleObjects`, `enemiesNear`, `primaryReload`, `predictObjects`, `packets` …)
that sends through `io.send`, which is your socket. There is no instance to make
a second of.

So the singletons get swapped instead. Every bot carries:

- **its own world** — real `Player`, `GameObject`, `AI`, `ObjectManager`,
  `AiManager` and `ProjectileManager` instances, fed from that bot's own packet
  stream (this is the same machinery that already drew the bot you possess, now
  built for all of them)
- **its own copy of the mod's entire mutable state** — 139 names, saved and
  restored *whole* rather than trimmed to "the ones that carry across ticks",
  because being wrong about one of those is a silent leak between your player
  and a bot
- **its own `io.send`**, adapting the positional signature (`io.send("z", i, true)`)
  onto the bot's socket

Entering a bot means writing its copy into module scope, pointing `io.send` at
its socket, running the mod's own `updatePlayers()` **unchanged**, then writing
the state back and restoring yours — `ctxCapture` / `ctxRestore` / `ctxRun`.

What the bot gets is not a feature list. It is the mod, whatever the mod happens
to do this version: auto heal, the placer, the pre-placer, shame combat, the
insta-kills, spike and trap ticks, anti-tick, Anti Bow Insta, auto push, auto
mills.

**The parts that needed care:**

| | |
|---|---|
| **Deferred work** | The tick does not finish synchronously — one promise and four `setTimeout`s carry the pre-placer and the anti-tick. Those fire long after the swap is undone, so on their own they would place buildings on *your* player with *your* socket. `ctxDefer` re-enters whichever bot scheduled them, and drops the callback if that bot died or disconnected in between. |
| **Targeting** | Teams do not keep a bot off you: an unteamed bot and an unteamed you both read as `team == null`, which the mod's `enemiesNear` filter treats as fair game. The filter now skips you and every other bot when it is running as one. Your sid is cached outside the swap, because inside a bot context `myPlayer` *is* the bot. |
| **Aim** | A bot has no mouse. After the mod's own overrides (autoaim, anti-push, auto-break, grind), `getAttackDir()` returns the enemy it is fighting, or the way it is already facing. The bot you are driving is the exception: there the cursor aims it, exactly as it aims you in your own body. `mouseX`/`mouseY` are deliberately *not* swapped for that reason. |
| **Rate limit** | The mod refuses to spam past ~119 packets a second, counted inside `io.send` — which a bot never reaches. The window is kept per bot and handed to the tick, or the limiter would never trip. |
| **The engine's own job** | With the mod driving, `_botTick` stops fighting entirely and does only what the mod has no opinion about, because it has no keyboard: where the bot walks. A move the mod already sent this tick wins outright. Sync, the manual attack key and `!cf` still apply, but only on a tick the mod did not decide the attack state itself. |

The state list is asserted key by key in `tools/test-mod-context.js`: a tick that
writes to all 139 must leave every one of yours untouched, and must leave all 139
of its own changes with the bot.

### What is still hand-ported, and why that is fine

With Full Mod off, the bots run the rules ported one at a time below. Those stay:
they are what runs when you would rather not have five extra copies of the whole
prediction pipeline on the wire, and they are what the tests cover in detail.

So what is ported here is ported *faithfully by rule*: Auto Heal and Auto Mills
reproduce the mod's exact trigger and pattern, checked against its source line
by line. `autoPush` turned out to port cleanly — it is geometry over objects and one
enemy, and the bot has both — so it is in.

The **spike tick** needed a foundation first, and that foundation is now built —
see below. What is still out is the rest of the prediction pipeline: shame
combat, the insta-kills and the full predict-object placer, all of which read
`totalDmgPot`, `predictObjects` and the damage accumulators that only exist for
your own player.

### The spike-tick foundation

Three things the mod reads off its own client every frame that the bot's world
model never carried:

| | How the bot gets it |
|---|---|
| **Reload clocks** | The `K` (gatherAnimation) packet is the server saying a swing just landed. `readyAt[weaponIndex] = now + speed × atkSpd` starts the clock on the server's tick rather than on the tick we asked for the swing — closer to the truth than the master's own delta counter. Samurai Armor (id 20) is the only hat that changes it. |
| **Structure damage** | `dmg × sDmg × variant × (tank gear ? 3.3 : 1)`, the same expression as `getPlayerInfo(player, "secondaryStructureDmg")`. The variant now reaches the bot from `updatePlayers`. |
| **Object health** | The `H` packet carries none, so objects load at full — which is exactly what the game's own client assumes. From there the bot watches swings land: on a `K` with `didHit`, everything inside that swinger's range and the `π/2.6` gather cone loses one hit's worth. A re-send of an object already tracked keeps its damage instead of healing back to full. |

On top of those, **Spike Tick** (Bots → Behaviour, on by default) is
`canTrapTick()` rewritten against the bot's world, gate for gate: the secondary
is the great hammer, hammer and primary are both charged, the enemy is not
already bleeding on a spike, they are inside one of the bot's *own* pit traps,
`trap.health ≤ hammer structure damage` so one hit finishes it, and a placeable
spike spot exists with `dist(trap, me) < scale + 95` and
`dist(spot, enemy) < scale + 55`. It also applies `shouldPlace()`'s own refusal:
if the knockback off that spike would run back the way the enemy already faces
you (`angleDist < π/5`), the spot is rejected and a flanking one is used.

The packet order is the whole trick, and it rides one server tick:

1. hammer, aimed at the trap — the trap dies
2. the spike, into the spot the trap was standing on (the trap is excluded from
   the collision test because it no longer exists, the same filter the mod uses)
3. primary back in hand, aimed at them, swinging for the next 400 ms while they
   bleed

The enemy is thrown out of the dying trap and lands on a spike that was not
there a tick earlier.

## Verification

```sh
node --check novastorm_1.5.user.js
node tools/test-novastorm-bots.js
```

The test evaluates the `RynBots` block straight out of the shipped userscript
against stubs and asserts the packets it emits — 152 checks over the age path,
break-weapon pick, targeting, world model, formation, auto break, safe walk,
sync, random move, auto buy, packet throttling, auto heal, auto place, the bot
console, Scan and Kill, possession, the mod's heal rule, the mill trail, auto
push, the reload clocks, structure damage, object health, the spike tick and
what the engine hands over under Full Mod.

```sh
node tools/test-mod-context.js
```

20 checks on the context swap itself: that the key list covers every singleton
the mod reads, that a tick writing to all 139 leaves none of yours touched, that
each bot keeps its own copy, that a throw still restores everything, that
`io.send` lands on the right socket, and that deferred work re-enters the bot
that scheduled it — or is dropped if that bot died first.

## Anti Bow Insta

**Defense → Ranged.** On by default.

A bow insta is a shot fired from outside melee range and timed to land on the
same tick as everything else. The existing damage prediction never saw it:
`spikeDmgPot`, `hitDmgPot`, `turretDmgPot` and `secDmgPot` are all melee, spike
and turret, so an arrow already in the air counted for nothing until it hit.

The answer is the Soldier Helmet. `changeHealth` applies the wearer's
`skin.dmgMult` to *every* incoming damage, projectiles included
(`src/game_index.js:2420`), and the soldier's is `0.75` — so a shot that kills
on the nose often does not through the helmet.

Two signals feed it:

1. **The arrow that already exists.** Novastorm is sent every projectile
   (`"X"` → `addProjectile`), so incoming shots are added up for real rather
   than guessed at. A projectile counts when its path clears the player's body,
   it still has the range to arrive, and it lands within about two server ticks
   — further out than that and you move rather than change hats. Damage comes
   straight off the projectile table and is never scaled by weapon variant or
   shooter hat: the server hands the flat value to the projectile
   (`game_index.js:990`), and the ranged-hat `aMlt` scales only range and speed.
2. **The switch tell**, ported from RYN's `rangedBowInsta`: an enemy beyond 300
   units, aimed at you, changing *into* a bow, or bow → crossbow, or crossbow →
   musket. That is the queue for a multi-projectile insta and it fires a tick
   before any arrow exists, which is the tick where you still have a choice.
   "Aimed at you" is the half-angle your body subtends from where they stand,
   so the cone tightens with distance — the same construction RYN uses.

The tell holds the helmet for 1.2 s and only fires on a *fresh* swap: the
tracked previous weapon is sticky, so without a freshness window one swap would
tell forever. Projectile damage is added into `totalDmgPot`, and the helmet
goes on when the total would kill or while a tell is live.

RYN gates the tell at 300 units, reading a bow insta as a ranged play. That is
backwards for the case that matters most: people fire the moment you are in
range, and up close the flight time is under one tick, so the swap is the only
warning that exists. **Ignore Swaps Closer Than** defaults to 0 — react at any
range — and can be raised to 600 if the helmet comes on too eagerly.

### What the helmet can and cannot save

Projectile damage is flat, so this table is exact. At 100 HP:

| combo | raw | in soldier (x0.75) |
|---|---|---|
| bow + crossbow | 60 | 45 — live |
| crossbow + musket | 85 | 63.75 — live |
| bow + crossbow + musket | 110 — **dead** | 82.5 — **live at 17.5** |
| + turret gear | 135 — **dead** | **101.25 — still dead** |

The three-piece is the one the helmet turns around. The four-piece with Turret
Gear is not survivable by hat alone: 135 × 0.75 = 101.25, over by 1.25. So the
helmet is not the whole answer — **Block Shot** and **Dodge** are.

### Block Shot — and why a wall is not a mill

One line in the game decides what stops what (`game_index.js:3111`):

```js
l.active && this.layer <= l.layer && !l.ignoreCollision && lineInRect(...)
```

The nearest candidate then consumes the projectile whether or not it takes
damage — `this.active = !1` runs either way (`:3134`). A stone wall eats an
arrow for free; only the wood wall has `projDmg` and actually loses health to
one.

The layers are what matter. Arrows are layer 0, the turret-gear shot is layer
1, walls are group layer 0, mills are group layer 1:

| | arrow (layer 0) | turret gear (layer 1) |
|---|---|---|
| **wall** (group layer 0) | blocks | **passes straight over** |
| **mill** (group layer 1) | blocks | blocks |

The turret shot is the exact 25 damage that takes the combo from 82.5
(survivable) to 101.25 (not) — and a wall cannot stop it. So the mill is tried
first always, and when a turret projectile is in the air it is the *only* thing
tried. A blocker goes down toward the shot, at the placer's own offset, with a
couple of angles either side attempted when the spot is occupied; it respects
the group limit and the 119-packet budget, and places one blocker per shot
rather than a wall every tick.

### Dodge

When nothing can be placed — no mill or wall owned, group at its limit, every
angle occupied — the response is to step out of the line instead. The step is
perpendicular to the shot, which is the shortest way out of its path, on
whichever side is not walled off (walk-over pads like boost and platform are
not cover). It lasts about two ticks and overrides every other reason to be
walking somewhere, because the alternative is taking the shot.

Both are toggles under **Defense → Ranged**.

### Pre-Block — the half that actually works up close

Everything above is reactive, and reaction has a floor. A musket from 150 units
lands in **42 ms**; the server tick is **111 ms**. The packet that would save
you leaves after the shot has already landed. No amount of tuning fixes that —
at close range there is no reacting, only having been covered already.

So Pre-Block runs whether or not anything is happening yet: while an enemy who
owns a ranged weapon has a **clear line** to you, it keeps something standing on
that line. When they pull the bow, the cover is already there and the shot never
had a path.

- "Owns a ranged weapon" is what they have shown they carry — `weapons[1]` is
  filled in from their own updates the first time they hold one — or what they
  are holding right now.
- "Clear line" uses the same rule the projectile does: any object on the segment
  with layer ≥ 0 that is not walk-over. A tree, a rock or someone else's wall
  already on the line is cover you did not have to pay for, and nothing is built.
- Only inside **Pre-Block Range** (200–1400, default 900), so it is not building
  across the whole map.
- Upkeep pace: one placement per 700 ms, against the reactive block's 250 ms.

**Pre-Soldier** is the same idea for the helmet: keep it on while someone who can
shoot has an open line, instead of waiting for the swap tell.

### Reacting on the packet, not the next tick

The rest of the feature runs inside `updatePlayers`' tick callback, which fires
once per server tick. The projectile packet (`"X"`) does not — it arrives on its
own, whenever the shot was fired. A response that waits for the next tick has
already burned up to **111 ms** before it starts, and a musket from 150 units
flies for **42 ms**. That was the lateness: not the logic, the place it ran from.

`addProjectile` now calls the response the moment the packet lands, so the
helmet, the blocker and the dodge all go out on the same millisecond the shot
appears. The helmet is sent directly with `hat(6)` rather than only setting
`soldierAnti`, because that flag is not read until `hatFc()` runs on the next
tick — which is the delay being removed.

The spawn path's window is wider than the tick path's (450 ms, about four
ticks, against 260 ms): acting early is free, since a blocker put up too soon
still blocks, while acting late is worth nothing.

### Can soldier alone survive the four-piece? No.

`dmgMult` appears on exactly one item in the entire game — the Soldier Helmet,
at `0.75`. `changeHealth` applies both `skin.dmgMult` and `tail.dmgMult`
(`game_index.js:2420-2421`), but no accessory carries one, so 0.75 is the floor.
135 × 0.75 = 101.25, and no gear closes that.

What does close it is removing **any one** projectile from the volley:

| blocked | left | in soldier |
|---|---|---|
| bow (25) | 110 | 82.5 — live |
| turret (25) | 110 | 82.5 — live |
| crossbow (35) | 100 | 75 — live |
| musket (50) | 85 | 63.75 — live |

That is the whole design in one line: **one blocked shot is the difference**,
which is why the blocker and Pre-Block matter more than the helmet does.

This is the honest answer to "how do I stop dying to it". The reactive layer
handles the shots you get warning of; Pre-Block handles the ones you do not.

Flat projectile damage, from `game_index.js:1552`:

| index | source | damage |
|---|---|---|
| 0 | hunting bow | 25 |
| 1 | turret | 25 |
| 2 | crossbow | 35 |
| 3 | repeater crossbow | 30 |
| 4 | mine | 16 |
| 5 | musket | 50 |

`tools/test-anti-bow-insta.js` runs the detection out of the shipped script
against these numbers — 50 checks over the projectile maths, the tell, the
range gate, the freshness and hold windows, the cases where the helmet saves
you and the one where it provably cannot, the mill-over-wall choice and the
turret-shot case that only a mill answers, the limit / budget / cooldown
guards, the dodge's perpendicular, its side choice and its expiry, the blocker
bearing across all eight directions, and the pre-block's arming check, line-of-
sight test, range gate and upkeep pace, and the instant path that runs off the
projectile packet — 79 in all.

## Lite Mode (performance)

**Visuals → Performance**, or the `L` key.

The frame loop is `requestAnimationFrame(doUpdate)`, so the browser caps it at
your display's refresh rate. 120 FPS is a 120 Hz screen, and nothing in the
script can print a bigger number. What Lite Mode buys is headroom: staying
pinned at the cap through fights and big bases instead of dipping, and far less
GPU and CPU load.

| Knob | Effect |
|---|---|
| **Render Scale** (50–100%) | Shrinks the canvas backing store while the CSS size stays the full window, so the renderer fills fewer pixels and the browser upscales. Measured 25% less frame time at 70%, 43% at 50%. Mouse aim is unaffected — input is in CSS pixels. |
| **Lite Mode** | Drops the day/night vignette (a full-screen alpha composite every frame), freezes the water wave, skips the trap-prediction and placer-ghost overlays, drops the dark backing stroke on building health rings, and skips the crown/skull icons. Also switches the canvas to nearest-neighbour scaling, which is cheaper than bilinear and loses nothing on flat art. |

Building health rings stay on — they are the one overlay you actually fight
with — they just draw one stroked arc per building instead of two. Chat bubbles
stay too: they only cost anything while somebody is actually talking.

Two fixes apply whether or not Lite Mode is on:

- The vignette gradient was rebuilt with `createRadialGradient` and three colour
  stops **every frame** for a gradient that never changes. It is now built once
  per viewport.
- The HUD wrote `statsDiv.innerHTML` every frame — a string rebuild, HTML
  re-parse and relayout 120 times a second to show a number that updates once a
  second. Now five times a second.

Measured with `tools/bench/run-render-bench.js` on the exact draw calls
involved. That harness runs on software GL in a container, so read the ratios
rather than the milliseconds:

```
  vignette per frame     6.600 ms    vignette cached    6.500 ms
  40 buildings, 2 arcs   1.400 ms    1 arc              0.600 ms
  15 names + measureText 0.200 ms    no icons           0.100 ms

  render scale 100%      4.400 ms/frame
               70%       3.300 ms/frame   (25% less)
               50%       2.500 ms/frame   (43% less)
```

Caching the gradient saves little on its own — the full-screen `fillRect`
dominates, not the gradient object — which is why Lite Mode skips the whole
pass rather than just caching it.

### Frame breakers

Lite Mode lowers the average. These four fix the *hitches* — they apply whether
or not it is on, because a dropped frame is a dropped frame.

- **`renderGameObjects` walked the whole world five times a frame.** It is
  called once per layer, and every call scanned the entire `gameObjects` array
   — which only ever grows, since the client keeps every object it has been
  sent. The array is now walked once, on-screen objects are bucketed by layer,
  and each pass draws its own bucket. At 3000 objects that is 15,000 iterations
  a frame down to 3000, and the buckets are reused between frames so a frame
  costs no allocations. Garbage collection pauses are dropped frames.
- **The red spike markers had no bounds check.** Every spike in the world got
  two filled arcs a frame, wherever it was. After exploring, that was hundreds
  of paths a frame drawn off the canvas where nothing could appear — in the
  test world, 205 markers of which 205 were off screen. Only visible spikes are
  marked now.
- **Two dead `getPrePlaceAngles` calls in the preplacer's 1 ms timeout.** They
  passed three arguments to a two-parameter function, so `customObjects` got a
  number, `checkItemLocation` read `.length` off it and skipped its loop, and
  every angle came back placeable. The return value was discarded anyway. Each
  was 144 angle tests and 144 allocations, twice per preplace object, fired
  from a timeout that lands inside frame time.
- **The FPS counter pushed a timestamp per frame and `shift()`ed the old ones
  off.** `shift()` is O(n) and the array held a second of frames, so it moved
  ~14,000 elements a second for one integer — on its own `requestAnimationFrame`
  loop next to the game's. It is a counter now, called from `doUpdate`, so the
  browser schedules one callback a frame instead of two.

`tools/test-render-buckets.js` proves the bucket restructure draws the same
sequence as the old five-pass version, calls `update()` on the same objects the
same number of times, and only differs where intended (the off-screen markers).

**If you want the counter itself above 120**, that is a display and browser
setting, not a script one: raise the refresh rate in your OS display settings
if the monitor supports more, or launch Chrome with `--disable-frame-rate-limit
--disable-gpu-vsync`, which uncaps `requestAnimationFrame`.

## Fixes to the 1.4 code

- **`addChatLog` was called but never defined.** The two calls in the
  death-damage debug path threw a `ReferenceError` from inside the tick
  promise's `then()`, which rejects the promise rather than surfacing —
  silently skipping the rest of that callback (the `spikeDamage` reset
  included) on every tick after a death that recorded damage. It is now
  defined once, and writes to the bot console in the Bots tab as well as
  devtools, so the mod's `Mod:` lines have somewhere on screen to land.
- **`updateAngles2()` removed.** It was never called, and it could not have
  been: its only distinguishing line calls `checkEnemyTraps()`, which is not
  defined anywhere in the file, so the first call would have thrown.

## Caveats

- Bots are the most server-dependent part of the client and could not be tested
  against a live server here. Cloudflare Turnstile may refuse the connections,
  and a server-side handshake change breaks spawning.
- Spawning stays sequential: one Turnstile widget has to recycle a fresh token
  per bot.
- Possession routes *manual* input only. The mod's own automation — the placer,
  the insta-kills, the pathfinder — is computed against your own player and
  keeps running on it; it is not re-aimed at the bot.
