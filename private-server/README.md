# Ryn private server

kookywarrior's moomoo.io private server (MIT, see `LICENSE`), run by Ryn Type 2
inside the page instead of as a Node program. Lobby → Mode → **Private** reloads the
tab into it; Play and Ryn's bots then connect to it instead of moomoo's servers.

In private mode the game's join step (`POST api…moomoo.io/join`) is answered by Ryn
itself, for guests and signed-in players alike, so nothing reaches moomoo's join
server and a refusal there does not keep you out of your own server.

`tools/build-private-server.js` wraps these files into the `RynPrivateServer` block
in `RynType2.user.js` and swaps the Node-only modules (`ws`, `http`, `inquirer`,
`node-fetch`, `dotenv`) for in-page shims. Edit here, then:

```sh
node tools/build-private-server.js
```

Changes from the copy it came from:

- `src/utils.js`: the `io-init` handshake had no name in the packet table and went
  out as `null`, so the game never finished connecting.
- `index.js`: players and animals go out in the format the current game reads
  (`a`: positions with dir×100, looks, and the sids that left view; `I`: eight
  fields per animal plus the gone list).
- `index.js`: server chat goes out from sid `-1`, which the game shows as a
  notice; sid `0` matched nobody, so replies never showed.
- `index.js`: the page owner's own connection is admin (`conn.rynOwner`); bots
  are not. `src/config.js` no longer hands admin to a fixed name.
- Messages translated to English; `package` renamed to `pkg` (reserved in strict
  mode).
- `msgpack.js` is the codec from the game's own vendor bundle, replacing
  `msgpack-lite`.

## Synced with the current game (12d386a8)

Checked table by table against the game bundle (parsed statically, nothing run):

- Hats: Scout Hat (59), Frost Helm (60), Crab Shell (61). The Crab Shell cannot be
  bought; killing the Crab King gives it.
- Animals: Boar (9), Yeti (10, in the snow), Crab King (11), Sheep (12), Crab (13),
  Crabling (14), with the game's stats.
- Emerald weapon tier (30000 XP): poison and 15% lifesteal on melee hits.
- Weapon and item upgrade prerequisites (`pre`), group sandbox limits, the game's
  view range (1920x1080) and skin colours.
- The arena west of the map (`config.secretPool`): through the gorge at the river,
  five pools and the passage behind the waterfall (to x = -7000, where the game stops
  drawing it). The river runs on into the gorge as the game draws it, and it is calm
  in the game's shallows (`secretPool.shallows`, up to x = 320), so the gorge can be
  walked into. Nothing can be built in the arena.

## Checked against the game's own logic

The game's client bundle carries the server's shared modules: the player, the
animals, game objects, the object manager, projectiles, the config, the data tables
and the helpers. `tools/parity/extract.js` cuts them out of
`src/game_index-12d386a8.js` into `tools/parity/game-shared.js`, and
`node tools/server-parity.js` runs the same situations through the game's code and
this server's (seeded, steady ticks) and compares every tick: walking, snow, the
river, hats, collisions, spikes, boost pads, traps, walls, melee with tiers, poison,
shields and reflected damage, shots, gathering, shame, animals, sandbox caps, names.
They match. What was different and is now the game's:

- Speeds stop at 0.01, as in the game: before, players never fully stopped, so they
  never "settled" for the client and "still" timers (invisibility) never ran.
- An object touched in one sub-step of a tick is not checked again in the next ones:
  a fast player took a spike's damage and push up to four times in one tick.
- Gear that hurts the attacker returns the weapon's own damage on every hit; it was
  skipped for gold and better weapons and against shields, and scaled by the
  attacker's hats.
- Sandbox keeps the game's building caps (the group's sandbox limit, else 3x the
  limit and at least 99) instead of none.
- Health goes out exact, not rounded; a new player's data is rounded the way the
  game rounds it; a broken object is announced once.
- Names go through the game's filter (`src/badwords.js`, generated from the game's
  files); an attack aimed at exactly 0 rad turns the player too.
- One tick is always exactly 1000/9 ms of game time. The page's timers jitter, and
  movement is not time-step independent, so a late tick used to move everyone
  further (up to three ticks' worth in one).

## fix26: everything else the game's files say

`node tools/server-parity.js` now also compares every packet sent each tick and what a
new player owns, over generated situations: every weapon at every tier (on a player,
animals, trees, bushes, rocks, gold and an enemy wall), every hat and accessory (walking,
snow, river, a fight, shots, gathering), every building (walked into, stood on, own and
enemy) and every animal (near a still player, hit with walls and a trap around, killed
and back after its delay). 557 situations, all the same as the game. Found and fixed:

- Everyone started owning **Shame!** and the **Crab Shell** (the game skips `dontSell`),
  so killing the Crab King gave nothing. Worlds saved before this keep neither.
- The store sold what you already had (charging again), sold Shame! and the Crab Shell,
  and stopped on an unknown id. Now: only what you do not have, never what is only given,
  and you wear only what you own.
- Upgrades took anything at any time, even with no points. Now only what the game's
  upgrade bar offers: a point left, the age being picked, and the weapon or item it
  needs (`pre`).
- The crown (kill leader) went to the first player with a kill, not the most kills
  (`player.kill` instead of `player.kills`).
- The leaderboard now has the game's other parts: the dead (a skull) and the Crab King's
  killers (a crab), whoever has played and not only the living.
- The **Windmill Hat** paid nothing. Points per second (it and the windmills) now run on
  game time, so they stop with `!time pause`.
- An unknown animal kind becomes a cow (as the game) instead of stopping the server, and
  `minSpawnRange`/`maxSpawnRange` work as in the game. Projectile 1 is the game's again;
  extra gold from the Miners Helmet comes after the resource, as in the game.

### Capes

Fourteen accessories have an effect only in the game's store text; the code for them is not
in the game's files. They follow the text (`src/capes.js`):

| | |
|---|---|
| Dash Cape | 5% faster |
| Winter Cape / Snowball | no snow slowdown / half of it (x0.875 instead of x0.75) |
| Super Cape | after a kill, 10 s of 5% more damage and 15% more speed |
| Dragon Cape | 5 s of 5% more damage after hitting a player |
| Tree, Cookie, Stone Cape | 1 more wood, food (bush, cactus), stone per hit |
| Cow Cape | 1.5x the gold and food of a cow |
| Skull Cape | 3x the gold for killing the kill leader |
| Troll Cape | 2x the gold for a kill by your spikes |
| Blockades | 25% less damage from shots |
| Thorns | heals "a little" when you hit a player: **10% of the hit** (ours) |
| Devils Tail | the hit player bleeds for 2 s: **5 a second** (ours); a longer poison stays |

The damage bonuses count for melee and weapon shots, not turrets. `config.storeEffects =
false` turns these off, with the Emerald lifesteal (also only in the game's data);
`tools/server-parity.js` compares the rest with the game that way and then checks each
of them against its text. Ryn's own movement prediction knows the Dash, Winter and
Snowball capes.

### Ryn's page

The in-page socket delivered each message on its own timer. Timers round to whole
milliseconds and a message with no delay could pass a late one, so with a fake ping about
one message in seven came out of order: a tick's player list could arrive before the
player it lists, and Ryn's client stopped on `getWeaponSpeed`. Each direction is now one
queue delivered in order. `node tools/panel-test.js --soak 60` (12 bots on 150±80 ms for a
minute, killed and back) went from 3 page errors to none. `--server-checks` drives the
store, upgrades, Windmill Hat and leaderboard through real packets.

## Crab King

Rebuilt in fix27 on the game's own animal code, the code MOOSTAFA runs. From the game's
files, and checked against them (`tools/server-parity.js`):

- Its numbers (aiTypes 11): speed 0.00045, turn 0.0007, hitRange 400, hitDelay 700,
  dmg 45, health 480000. It walks and turns with the game's movement: chasing, about
  18 units a tick, half a player's speed.
- Its hit is the game's: it holds for 700 ms (shown as warning 3, a circle of 400 around
  it), then everyone within 400 takes 45 and a 0.6 push, buildings take 5x, and the
  game's `J` animation plays. Hurt, it may hit back after 500 ms, and sometimes again.
- With Ryn's extras off (`config.rynKingExtras = false`) it is the game's code alone, and
  the parity tool compares it with the game tick by tick, packets included.
- It and its crabs stay inside the pools, all of their body (the game shows the King's
  health bar only to players in the pools).
- Under water: going under is drawn over 700 ms (state 1), coming up over 1650 ms
  (state 3); it cannot be hurt under water (state 2). Its crabs come up out of the
  water too: the game draws crabs as divers.

Ours, until it can be measured on the real game (`kingThink` in `src/ai.js`):

- It fights players in its pools and lets go of anyone who leaves them.
- Every 6-9 s (faster below 40% health) one of its own attacks, in turn: a charge along
  a line (warning 4, its body's width, held 700 ms, at twice its chase pace), a ring
  of 250 under you (warning 1, 1.1 s), or a dive (it comes up under you, at 1.5x its
  pace, with a splash, warning 0, and its hit). Close up, its own hit does the work.
  Each does its damage (45) and the game's 0.6 push.
- Its crabs: none until it is down to 75% health, then two Crablings and a Crab, again
  every 30 s while it fights, six at most; they go when it dies.
- It heals 1.5% a second under water, 0.5% a second after 5 s with nobody in its pools,
  and comes back 3 minutes after it dies.

`!king speed` and `!king damage` scale all of this; `!king only slam|charge|ring|dive`
practises one attack. `node tools/panel-test.js --king 90` fights it in the page and
checks what the game receives: the pools, its pace, its warnings, dives and crabs.

## Admin commands

The page owner is admin. `!help` lists everything. Added by Ryn:

| Command | |
|---|---|
| `!ping <ms> [jitter]` | fake round-trip ping for you and your bots, `0` turns it off; kept across reloads |
| `!spawn <animal> [count]` | in front of you; crabs and the King go to the arena |
| `!hp <n> [sid]`, `!heal [sid]`, `!god [sid]` | health and god mode, yours by default |
| `!age <n> [sid]`, `!res <amount> [sid]` | age with its upgrade points, all resources |
| `!hat <id> [sid]`, `!acc <id> [sid]` | equip anything, `0` takes it off |
| `!arena` | into the Crab King's arena |
| `!give weapon <id> [tier] [sid]`, `!give item <id> [sid]` | any weapon at any tier, any item in its hotbar slot |
| `!bring <sid>` | that player in front of you |
| `!dummy <kind> [count] [p= s= tier= hat= heal=1 delay= god=1]` | server-side test players: `idle walk circle chase attack insta`; `!dummy clear`, `!dummy remove <sid>`, `!dummy set <sid> <kind>` |
| `!place <what> [count]`, `!placeat <what> <x> <y> [sid\|none]` | trees, bushes, stone, gold or any building (name or id), owned by you, a dummy or nobody |
| `!remove`, `!removeat <x> <y>`, `!clearnear <r>` | delete objects |
| `!time pause\|play\|step [n]\|speed <x>` | pause the server, step it tick by tick, or slow it down |
| `!scenario <name>` | `trapped push metrapped surrounded duel crab`, built around you |
| `!rules dmg\|gather\|sandbox\|tick <v>` | player damage and gather multipliers, free building, ticks per second |
| `!king respawn\|attack\|hp <n>\|speed <x>\|damage <x>` | the Crab King |
| `!king only slam\|charge\|ring\|dive\|all`, `!king stats`, `!king resetstats` | practise one attack; dodges and kill times |
| `!survival start\|stop` | waves of dummies and animals until you die |
| `!spawner <animal> [every s] [max]`, `!spawner clear\|remove <id>` | a point that keeps spawning animals |
| `!map empty\|forest\|rocks\|duel\|reset` | reshape the land around you, or put the original map back |
| `!killmobs [r]` | send the animals near you away |

These live in `src/ryn.js`, which also keeps a combat log (every health change with
its tick and source), fight stats (DPS, best tick, damage taken, insta kills, time
from a hit to your heal, time to kill) and knockback probes: for every hit on a
player it records how far the next server ticks moved them, next to Ryn's model
(push x 111 ms for the first tick). Dummies are real `Player`s with no connection;
the game tick moves them and skips sending to them.

`ryn.endTick()` runs after every server tick and keeps the last 30 seconds for the
replay (players, animals, shots, hits, and buildings as changes), each real
player's health and damage per tick for the graph, and the test bench's events:
a guarded player is left on 1 health instead of dying and the server records a
death; insta dummies record each insta they start. The Crab King reports every
attack (`config.rynKingAttack`) with the player it was aimed at and who it hit.
`conn.rynTap` sees every packet both ways for the packet inspector.

Also fixed: `!mobs off`, `!hostile off` and `!bosses off` sent packet `'11'` per
animal, which is the game's "you died" packet; removed animals now just drop out
of view. Natural objects were sent with owner `undefined` instead of `-1`.

## Admin panel

In private mode the game's own admin button (`#adminButton`, hidden for normal
accounts) is shown and opens Ryn's admin panel instead of the game's. The panel
drives the server through the owner's connection (`conn.rynCommand`, which feeds
the chat handler; `conn.rynState` for players and world switches), and server
replies to the owner go to the panel (`conn.rynNotice`) instead of the game's gold
notice. Everything in `!help` has a button; the panel can be dragged anywhere and
holds your own buttons (several commands each, optional hotkey).

The panel has seven tabs (the Lab tab and the extras below came later): **Me** (health, god, age, resources, gear, give weapons and
items, loadouts), **Players** (live health of everyone with heal, god, kill, bring,
go to; add, freeze or remove your Ryn bots), **Test** (dummies, scenarios, time
control, animals), **World** (a map editor that places or deletes where you click,
world saves that can come back after a refresh, rules, the Crab King's health,
phase and tuning, a fresh start), **Stats** (fight stats, combat log, knockback
server vs Ryn, and a server overlay that draws where the server has every player
and animal over what you see, with the server tick) and **Mine** (your buttons and
fake ping). It reads the server through `conn.rynState`, `conn.rynCall` and
`conn.rynWorld`.

Later additions: a shame meter (Me); survival (Test); editor shapes (line, circle,
square) with undo, base stamps, map presets, spawners, Crab King practice with
dodge counts and kill times (World); on-screen layers for weapon ranges, spikes and
turrets, shot paths, desync between Ryn's predicted position and the server, and
shame; a 60 second health/damage graph; fight export (Stats); a test bench that
runs scenarios against your Ryn and scores them, with A/B of one setting and
saved reports compared run to run; a 30 second replay you can scrub tick by tick;
a packet inspector (Lab); and a ping that keeps changing between two values (Mine).

Worlds: in Private mode Ryn's lobby lists saved worlds instead of servers. The one
you pick loads into the in-page server when you first spawn in it (map, buildings,
dummies, rules, your age, weapons, hats, resources and position: `restore`,
`applyPlayer`, or `newWorld` for a fresh one), saves itself every 5 seconds, right
before you leave (before the server removes your buildings) and when the page
closes. Respawning after a death keeps playing the same world. Worlds live in
localStorage (`_ryn_worlds`, `_ryn_world_<id>`).
