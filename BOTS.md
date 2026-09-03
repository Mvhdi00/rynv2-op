# Ryn Type 2 — bot fixes and features

Everything here is in **`Ryn_Type_2.user.js`**, which is the script with the bot
squad in it (`! Ryn Type 2` v5.4). It is a different base from
`ReUp_Mix.user.js` — the merge in the main README is RYN Client v4, and none of
the work below applies to it.

The file was committed verbatim first, so `git log -p Ryn_Type_2.user.js` reads
as a diff against exactly what was running.

---

## Fixes

### Bots stuck holding the secondary and not attacking

Three separate causes, all of which end with a bot standing there with a bow or
a shield out and no longer reacting to anything.

**1. A right click leaves the whole squad in destroy mode, permanently.**

`InputHandler.handleMousedown` copies the owner's attack state to every bot —
`1` for left click, `2` for right. `handleMouseup` is the only place a bot's
state ever comes back down, and it read:

```js
if (!Settings._botAutoAttackEnabled || _squadBlocked) {
  client2._ModuleHandler.staticModules.tempData.setAttacking(0);
}
```

With Bot Auto Attack on, the branch is skipped and the `2` stays. From then on:

- `ModuleHandler._getPredictWeapon` returns `1` while `attacking === 2` — the
  bot holds the secondary,
- `UseAttacking`, which is the module that swings at players, runs only at
  `attackingState === 1` — so it never fires again,
- `UseDestroying` runs instead, which is aimed at buildings.

One right click, and the squad is useless until it is rebuilt. Mouseup now
returns the bots to state `1` rather than leaving `2` in place.

**2. Ranged kiting holding the tick with a shot it cannot take.**

`BotRangedAttack` set `forceWeapon = 1` and `moduleActive = true` whenever it
had a target, including with an enemy inside the bow's dead zone and the shot on
cooldown. `moduleActive` locks out `UseAttacking`, `UseFastest` and
`botAutoBreak` for the tick, so the bot stood in melee range holding a bow and
did nothing at all. It now hands the tick back to the melee weapon in that case,
aimed at the same target the kiting picked.

**3. `BotWeaponWatchdog`** is the catch-all for whatever is left. A bot that
wants to attack, is holding the secondary, has an enemy inside its own melee
reach and has not attacked for a second gets its stale item selection cleared
and the primary put back in its hand — once a second at most, and never while
the squad has been told to stand down.

### A trapped bot never breaks out

`BotAutoBreak._blockers` drops anything `canMoveOnTop()` is true for, on the
reasonable grounds that a thing you can walk over is never why you stopped. A
trap carries `ignoreCollision`, so `canMoveOnTop()` is true for it — the trap
holding the bot was filtered out of the list built to answer *what is holding
me*. The bot found nothing to hit and stayed in the trap until something killed
it.

A trap that has actually closed on the bot is now handled first and by name,
before the three-tick stuck test. The same case is handled again inside the
scatter loop, because `Movement.postTick` — and the whole bot module chain that
ends in `botAutoBreak` — steps aside while random movement is on, so the module
fix alone would never have reached a roaming bot.

### The guard system was dead code

`Settings._shieldGuard` and `Settings._autoJoinGuard` were read by `GuardModule`
and `_applyBotWeaponPatch`, but neither was declared in `defaultSettings` — and
the settings loader deletes every key that is not in defaults:

```js
for (const iterator in settings) {
  if (!defaultSettings.hasOwnProperty(iterator)) delete settings[iterator];
}
```

So `_shieldGuard` was permanently `undefined` and `GuardModule.postTick`
returned on its first line, every tick, forever. There was no UI for it either.
Alongside that:

- the front-distance slider was wired in a `setInterval` against a
  `_guardFrontDistVal` label that does not exist in the markup, and stored the
  value in a `window` variable that was never saved;
- `Movement.postTick` called `_resolveGuard` through a synthetic `this` carrying
  only `client`, which works only for as long as the method touches nothing else
  on itself;
- `_applyBotWeaponPatch` handed shields to the first **three** bots while
  `GuardModule` ran **four**, so the fourth guard was given a musket and then
  asked to hold a shield it had never bought.

All four are fixed, and the guards are rebuilt — see **Smart Shield** below.

---

## Why one enemy costs 90 fps with ten bots

This is the whole answer, and it is not about enemies.

Every bot is a full client: its own socket, its own `ObjectManager`, its own
`EnemyManager`, its own module list, all of it running on every server tick. The
expensive parts of that work are gated on whether an enemy exists:

| Path | Gate |
|---|---|
| `ThreatAnalyzer.build` | `if (!target) { ...; return null; }` |
| `AutoPlacer.postTick` | `const enemy = ...; if (!enemy) return;` |
| `EnemyManager.handleEnemies` | `if (nearest !== null) { ...solve... }` |
| `RynPlacementEngine.cycle` | returns as soon as `sense()` gives no frame |

With nothing visible, all of it returns on its first line and forty bots cost
almost nothing. One enemy coming into view turns all of it on **for every client
at the same time**, and each one then runs several wide spatial-grid queries per
tick:

- `ThreatAnalyzer.build` — 11×11 cells around the target,
- `CandidateGenerator.blockersAround` — 13×13 cells around the bot,
- `AutoPlacer.postTick` — another 11×11 around the target,
- `EnemyManager.checkCollision` — 7×7 per enemy, with spike-knockback geometry
  per object inside it,

and then the placement pipeline scores its candidates on top.

So the cost does not scale with how many enemies there are. It scales with **how
many clients are looking at one**, which is why a single enemy is enough and why
it appears the instant they come into view rather than building up.

It lands in a single frame because the bots do not tick independently — they are
all on the same server broadcast, so their sockets deliver within a few
milliseconds of each other and every bot's tick is processed inside one
animation frame. Eleven clients × ~3ms is a 30ms frame. That is the 120 → 30.

### What was done about it

- **`botAnalysisTurn`** deals the bots into four lanes and lets one lane run the
  placement analysis per tick — the `handleEnemies` angle solve, `AutoPlacer`
  and `RynPlacementEngine.postTick`. Four or fewer bots keep every tick. Twelve
  bots do a third of the work per frame and re-analyse every third tick, which
  costs 330ms of freshness on a decision about where to drop a spike. Movement,
  attacking, reloading, healing and breaking still run every tick for every bot.
  The toggle is **Bots → Roaming & Performance → Spread bot analysis**.
- **Bots skip the per-enemy contact analysis beyond 1100px** and keep the
  nearest-enemy pick. Every term `checkCollision` produces — trapped, spike
  collider, knockback trap, push spike — is about contact, and an enemy that far
  out is not in contact with anything.
- **`getClientIndex` no longer spreads the client Set on every call.** It is
  called several times per bot per tick (formation offsets, volley waves, guard
  slots, the stride); with forty bots that was 1600 hops and forty throwaway
  arrays every tick before anything had been decided.
- **The scatter loop's packet flood.** It runs on `requestAnimationFrame` and
  called `PacketManager.move` — and `attack`, whenever a blocker was in front —
  on *every frame*. That is 60 a second per bot against a server that ticks nine
  times a second and allows about 120 packets a second in total. Both are now
  capped to one per server tick.

---

## New features

All of them live on the **Bots** page.

### Squad Name

One name for every bot. `ClientPlayer.spawn` is the only place a name reaches
the server and it runs again on every respawn, so the field is read there rather
than written onto the bots once — a bot that dies comes back under whatever the
box says *now*, and changing the box does not need to touch the bots that are
already connected.

**Add numbers** appends the bot's position in the roster, so the squad reads
`Ryn1, Ryn2, Ryn3` instead of fifteen identical names. The numbers follow the
roster, so kicking a bot does not leave a hole. The base name is trimmed to
leave room for the digits rather than letting the server's 15-character cut take
them off the end.

**Apply to connected bots** writes the name onto every bot now. It cannot rename
a bot that is alive — the name is only ever sent in the spawn packet — so what
it does is guarantee the next spawn uses it, and it says how many bots it tagged
rather than pretending the rename already happened.

### Find Enemy

A command box with a log.

```
!F <player id>     send the squad looking
!F <name>          same, matched against nicknames you can see
!F                 repeat the last search
!F stop            call it off
```

The search is the roaming wander: every bot is put into scatter and tours the
map, which is already the code that avoids obstacles, breaks out of traps and
puts each bot on a different route. Nothing new walks.

Finding is passive. A bot's `PlayerManager.players` is rebuilt from the server's
visible-players list on every tick, so *this bot can see them* is membership of
that list — no scanning, no extra packets, and it is per bot, which is the point
of sending forty of them out.

Several targets work in one command — `!F 12 34 56`, ids or names mixed — and
there are two buttons next to the box: **Cancel**, and **Hunt mode**.

**Splitting.** The squad is dealt out round-robin over the live roster: bot *i*
goes to target *i % targets*. Ten bots on two targets is 5/5; ten on three is
4/3/3, the even split with the remainder handed to the first group. It is
recomputed every pass, so a group does not empty out as its bots die.

**Watching** (Hunt off) is the original behaviour. The first bot to see the
target keeps it: it drops out of the sweep, pings the map from where it is
standing (the ping packet is a position ping, so the marker lands on top of the
target) and holds station at the **Shadow distance**, re-pinging every four
seconds. The rest of its group walks home. The shadow does not open fire — that
is what would lose the distance it was told to hold.

**Hunting** (Hunt on) kills the target instead. Arriving one at a time is how a
group of bots feeds itself to one player, so each group runs a two-state cycle:

- **gather** — every bot walks to its own slot on a ring around the target and
  waits there. Ranged groups take a wide ring; melee groups take a tight one.
- **strike** — the group attacks only once it is *both* in position and every
  bot's weapon is off cooldown. That is the sync: not "everyone attacks when
  ready" but *nobody attacks until everyone is ready*, which is what makes the
  damage land as one number instead of five the target can heal between. All of
  them are fired in a single pass of the loop, so the shots leave within a
  millisecond of each other.

Both states have a deadline — six seconds to gather, three to wait on reloads —
so one bot that cannot reach its slot cannot hold the group still.

A group is **ranged** only if most of it is carrying a musket; those hold the
shadow distance and shoot from it. Everything else, bows included, takes the
tight ring and stacks, because a bow bot with a melee primary is worth more
inside reach than it is standing off.

While a group owns a bot its own trigger is held down (`attacking = 0`), so
`UseAttacking` cannot swing the moment something wanders into reach and break
the sync before it starts. If a group loses sight of its target for six seconds
it goes back to sweeping; after four minutes the whole search gives up.

### Auto Shot

Anything that walks inside the radius gets shot the moment the weapon is ready,
whether or not you are attacking. Deliberately narrow: it only ever selects the
secondary slot, and only when that slot holds something that shoots — the bow
line (hunting bow, crossbow, repeater) and the musket. A bot carrying a shield
or a great hammer there is left alone entirely, which is what stops this from
quietly turning the guards into archers.

When the shot is not ready it releases the tick untouched, so a bot in melee
range swings instead of standing there aiming — the same failure the ranged
kiting fix above is about.

### Smart Shield

The guards, rebuilt on top of the module that was never reachable.

- The wall points at the nearest enemy the tick it appears — an enemy on the
  right puts the shields on the right immediately, which is the point of the
  feature.
- Guards form a **straight line, shoulder to shoulder, square across the
  threat**. The arc this replaced put every guard the same distance from the
  anchor but at a different angle, so the gaps between them grew with the
  distance and the two on the ends faced away from the middle — the shield arcs
  splayed instead of overlapping. In a line every guard is the same distance in
  front, spaced by two collision radii and a little (78px, so nothing fits
  through the gap) and all square on to the same direction.
- **Facing is not position.** A guard stands in its slot in the line but turns
  its shield at the nearest enemy, because a wooden shield only blocks the 60
  degrees it is pointed at.
- **They hit back now.** The melee branch was gated on
  `distToEnemy < 80 && !forceShield`, and `forceShield` was true whenever any
  enemy was within 550 — so the condition could not be met in the one situation
  it was written for, and the guards held the shield through every fight. The
  question is now whether *this* guard can reach with what it is holding: in
  reach it swings with its fastest melee weapon (lowest `speed` number, shield
  never a candidate), out of reach it holds the shield.
- Detection widened 550 → 750, because at 550 a player closing at full speed is
  inside the line before it has finished forming.
- **Mouse control** — with nothing in range, the wall points where your mouse
  does, so you can aim it by hand. An enemy still overrides it.
- **Guards protect the bots** — the wall forms around the average position of
  the bots behind the guards instead of around you, so the shields screen the
  squad. With every bot a guard there is nothing behind them to screen and you
  are the anchor again.
- **Guards** (1–5) and **Front distance** (50–300) sliders. Five is where a
  line stops being wider than the thing it is covering, and where the guards on
  the ends stop arriving after the fight. The front distance is a real saved
  setting now, not a `window` variable.

### Remote control

Take over a bot and play as it. It is three independent things:

**The camera.** A bundle hook rewrites the two lines that turn the game's
smoothed camera into the render offset, so they come from the remote module
instead. Everything downstream of those two variables follows without knowing
anything happened — the terrain, every entity, the minimap, and RYN's own
overlays, because the pre-existing `offset` hook appends *after* those lines and
therefore reads the values the new one produces. The ease is the game's own
(1% of the remaining distance per millisecond of frame time), so a possessed
camera feels like the normal one rather than floaty or snappy.

The new hook has to run *after* the `offset` hook, not before: that one matches
`d=oe-_/2` with `\w+-\w+`, which stops matching the moment a call is wrapped
around the source variable.

**The input.** `InputHandler` already writes through a client's `PacketManager`
and `ModuleHandler`, and a bot is the same kind of object as the owner — so the
handlers now ask `driven` which client they are for instead of assuming
`this.client`. Movement, placement, attacking, aiming, the cursor anchor and the
formation anchor all move to the bot, which is why the rest of the squad follows
whoever you are driving.

One line tied control to the owner being alive:

```js
if (!this.client.myPlayer.inGame) { return; }
```

It asks the driven client now. That is what makes your own character's death
irrelevant, and the two hotkeys sit *above* that check so letting go still works
if the bot you are driving dies.

**The chat.** The bundle's chat sender is hooked; while possessing, what you
type goes out on the bot's socket and the game's own send is skipped.

What is deliberately *not* done: the game's own HUD. Its resource counters, age
bar and health bar are driven by the owner's connection deep in the bundle, and
rewriting all of it would be a dozen fragile hooks for a cosmetic result. The
possessed bot's health, age, kills and resources go in an overlay across the top
of the screen instead, which is honest about whose numbers they are. That
overlay also reports if the camera hook ever stops binding — detected by whether
the bundle actually calls through it, not by whether a regex matched at load.

**Your own character** has the two modes asked for: stand where you left it, or
trail the bot the way a squad member would (same movement radius the formation
uses). Either way it keeps healing and defending itself, because those modules
never depended on input.

The possessed bot is exempted from everything that would otherwise walk off with
it — formation movement, random movement, Find Enemy — and from the squad attack
broadcast, since its trigger comes from your mouse.

Controls: **Control next bot** walks the roster and then hands control back, so
one key (default `O`) both takes over and lets go; **Back to me** / `L` drops it
immediately.

### Spam Packet

One burst of 300 frames down each bot's own socket, per press. The server's
allowance is about 120 a second, so 300 is over it on purpose and the bots that
send it are the ones that get kicked for spam — that is the button, not a side
effect of it. The frames are weapon selects: real packets that change nothing
the bot cares about, so a bot that survives the burst is where it was.

The five second cooldown is part of the feature rather than UI politeness —
without it, holding the button turns a one-off burst into a sustained flood.

### Full-map roaming

x18's wander is a random walk, and a random walk does not explore: expected
distance from the start grows with the square root of the number of steps, and
every hard turn undoes part of the last leg. Bots that had been wandering for
five minutes were still milling around where they spawned.

Roaming replaces the dice with a tour. The map is cut into a 4×4 grid of sectors
and each bot walks to a point inside one, then moves to the next. The next
sector is the current one plus a per-bot **odd stride** — 16 and any odd number
are coprime, so the tour visits all sixteen sectors before repeating one, and
two bots with different strides never walk the same route. Sectors closer than a
quarter of the map are skipped while a further one is available, which is what
sends them to the corners instead of shuffling between neighbours.

Obstacle avoidance, the repel from other bots and breaking what will not be
walked around are unchanged and apply to the waypoint heading exactly as they
applied to the random one. **Roam the whole map** turns it off if you want the
old wander back.

---

### Battle orders

**War Split** (button + hotkey) cuts the squad in two: a shooting half and a
closing half, both working in **pairs**. The pairing is the point rather than a
detail — two muskets are 100 damage and one is 50, so a musket bot alone trades
and a musket pair kills. Enemies are handed to pairs, never to individuals, and
an odd bot out joins the last pair rather than being sent somewhere on its own.
Which half a bot lands in comes from what it is carrying, not its number: a bot
in the shooting half with no ranged weapon would be standing at range holding a
sword. Other people's bots count as enemies like anything else.

**Dodge & Fort** uses both answers to being shot at. A wall goes up between the
bot and the shooter — a wall stops an arrow or a musket ball outright. Then,
because a wall blocks the bot's own shot too, the moment the enemy's ranged
weapon goes on cooldown the bot **breaks its own wall and answers through the
gap**. `reload.current < max` on the enemy is the whole signal; there is nothing
to guess. When there is no wall to be had — no resources, no room, on cooldown —
it steps **perpendicular to the incoming projectile**, which is the shortest
movement that leaves the line the shot is travelling along. Moving along that
line is not a dodge. Firing is synced with any bot near enough to be shooting at
the same person.

**Bot Musket Bow Insta** is not a second implementation of the combo.
`MusketBowInsta` already exists and already runs for every client, bots
included; what it waits on is `InputHandler.instaToggle`, which for a bot is a
flag nothing ever sets, because only the owner has a middle mouse button.
`BotInstaArm` is the trigger that was missing, armed when a player enters the
combo's own range band.

**Right-click targets charge** — see the fix below. Off by default.

### Ghost Shot

Bots buy Assassin Gear (hat 56) and **stand still**, because standing still is
what makes that hat invisible — it is the mechanic, not a side effect. Anything
inside the radius gets shot out of nowhere; attacking does not break the
invisibility, only moving does.

Which means it has to hold the hat against everything else that wants to change
it. `ModuleHandler.postTick` assigns `forceHat = 6` for soldier *directly*,
after every module has run, so a module cannot win that by writing `forceHat`
earlier — the soldier block asks Ghost Shot first instead. Auto Shot and ranged
kiting stand aside through the coordinator flag, since a bot that walks to a
kiting distance has just made itself visible.

### Marks: green and red

In the Find Enemy box:

```
!Team <id|name>    green — hold fire
!Red  <id|name>    red — shoot on sight
!Team clear        (or the Clear green button)
```

Green is a hold-fire order and it covers the **line of fire**, not just the
player: an arrow aimed at somebody standing behind a green player is an arrow
through the green player. So the check is not "is this the green one" but "does
the shot pass near a green one" — a point-to-segment distance against every
green player. It is enforced in `botPickTarget`, which is the single place every
bot decides who it is shooting at, so auto shot, ranged kiting and the melee aim
are all covered by one check.

Red is shot on sight whatever else the squad is doing, so it runs on its own
rather than inside War Split — the order was "every time they are seen". Two
bots or more on the same red player fire together; a bot with nobody near enough
to pair with cannot wait for a partner that is not coming, so it goes for the
burst instead — the shot, then the melee follow-up as soon as it is in reach.

### Solo Auto Play

Right-click one of **your own** bots to put it on Auto Play on its own; it gets a
red ring and a key clears them all. Right-clicking an enemy still marks them
instead. Previously right-clicking your own bot added it to the enemy target
list, which — with target charging on — pointed the rest of the squad at it.

### Squad habits

- **Random primary weapon** — each bot rolls its own once, never the stick.
  Chosen once per bot rather than per spawn: a weapon that changed every death
  would never finish an upgrade path.
- **New random name on every death** — read inside `spawn()`, so it takes effect
  on the packet that brings the bot back. It wins over the squad name when both
  are on, because "change it every time it dies" is the more specific order.
- **Build platforms in the river** — `canPlaceItem` refuses every item in the
  river except the platform, so a bot crossing either swims it or builds its way
  over. The platform goes down along the direction of travel, so a squad
  crossing lays a bridge in front of itself.
- **Bot numbers under HP** — the same roster index the Bots list shows, the clan
  re-check reports, and the possession overlay puts next to the name. One
  identity for a bot everywhere it appears.

### !FF — a search with a fixed number of bots

```
!FF 12 4      four bots go looking for player 12
!FF 4 12      the same
```

Both arguments are bare numbers, so which is which cannot be decided by
position. It is decided by meaning: the token that resolves to a player the
client can actually see is the id, the other is the count. Asking for more bots
than exist says so and uses what there is, rather than silently doing something
else.

---

## More fixes

### Bots charging and attacking with no order given

One right click put a player on the target list, and from then on **every bot
charged it and swung inside 160px, nine times a second, forever**. There was a
variable called `_ctTargetEnabled` that looked like the switch for it, but
nothing anywhere read it. Charging is a real setting now and it is **off by
default**, so the target list marks people without commanding anybody.

### Bots that never joined the clan

Two independent causes.

`AutoAccept`'s loop gate was `_autoaccept || pendingJoins.size !== 0` — a
property of the *queue* rather than of the request being looked at. Two bots
asking in the same tick was enough to wedge it: the first accept deletes the
only pending id, size drops to zero, and the loop breaks with the second bot's
request still sitting at the head, where it blocks every request behind it until
the clan changes. It asks whether the request is one of ours now, which
`clientIDList` answers directly.

`ClanJoiner` returned early on `!clanExist(ownerClan)`. That is the *bot's* view
of what clans exist, built from whichever team packets its own connection
happened to receive — a bot that connected while the clan already existed, or
that missed the packet, answered false there forever and never even reached the
rotation, so no amount of re-checking would move it. It is a 2.5 second grace
now, then the join is attempted anyway; a join for a clan that does not exist
costs one packet and is refused.

The rotation was also 1500ms per bot, which is half a minute for twenty bots.
600ms now, which is safe because our own bots are accepted the moment they ask.

**Re-check** audits every bot's `clanName` individually — the only real answer,
since there is no join acknowledgement to listen for — and names the ones still
out by squad number instead of only counting them.

### The find ping was invisible

The game's map ping is only drawn for people on your team, so a bot that had not
managed to join the clan pinged into nothing. There is a client-side marker now
that does not depend on the clan, the game, or the packet arriving anywhere.

### Roaming bots zigzagging

Two causes. The repel between bots was 0.22 of the heading — a 12 degree push —
and two bots roaming near each other pushed each other every pass in opposite
directions, so both weaved. It applies only when another bot is genuinely in the
way now, and is small enough to sidestep with rather than steer by. And
re-deciding on a 600ms timer meant a bot walking a perfectly good line re-solved
it constantly and took a slightly different one each time; it holds its line now
and only re-aims on arrival, on drift past 0.35 radians, or when stopped.

### An empty screen when possessing a bot

The camera hook was working. **The game bundle can only draw what its own
connection was sent, and the server only sends what is near the player that
connection owns** — so pointing the camera at a bot across the map points it at
a region this client has no data for at all: no terrain, no players, no animals.

The bot's own connection *does* have that data, but it lives in RYN's object
model rather than the bundle's private entity arrays, so drawing from it would
mean writing a second renderer for the whole game.

So the owner is walked to the bot instead. Following is no longer optional — it
is what makes possession show anything — and the "acts as a bot" toggle now only
decides whether the owner also *fights* while it is over there. The overlay
reports the gap while it closes, so a blank screen is legible rather than
looking broken.

---

## Settings added

| Key | Control | Default |
|---|---|---|
| `_botSquadName` | Squad name | `""` |
| `_botSquadNumbers` | Add numbers | off |
| `_findHoldDistance` | Shadow distance | 450 |
| `_botAutoShot` | Auto Shot | off |
| `_botAutoShotRange` | Shoot within | 700 |
| `_shieldGuard` | Shield Guards | off |
| `_guardMouseControl` | Mouse control | off |
| `_guardProtectBots` | Guards protect the bots | off |
| `_autoJoinGuard` | Only age 6+ bots guard | off |
| `_guardCount` | Guards | 3 |
| `_guardFrontDist` | Front distance | 90 |
| `_botRoamFullMap` | Roam the whole map | on |
| `_botPerfMode` | Spread bot analysis | on |
| `_findHunt` | Hunt mode | off |
| `_remoteControlKey` | Switch / next bot | `O` |
| `_remoteReleaseKey` | Let go | `L` |
| `_remoteOwnerAsBot` | My character also fights | off |
| `_showBotNumbers` | Show bot numbers under HP | on |
| `_botChargeTargets` | Right-click targets charge | off |
| `_botWarSplit` / `_botWarSplitKey` | War Split | off / `Y` |
| `_botDodgeFort` | Dodge & Fort | off |
| `_botMusketBowInsta` | Bot Musket Bow Insta | off |
| `_botGhostShot` / `_botGhostShotKey` / `_botGhostShotRange` | Ghost Shot | off / `M` / 700 |
| `_botAutoPlayClearKey` | Clear solo Auto Play | `;` |
| `_botRandomWeapon` | Random primary weapon | off |
| `_botRandomNameOnDeath` | New random name on every death | off |
| `_botRiverPlatform` | Build platforms in the river | off |

`_shieldGuard` and `_autoJoinGuard` were already being read by the code; the
rest are new.

---

## Checking a build

```sh
node --check Ryn_Type_2.user.js
npm i --no-save terser
node tools/check-hooks.js Ryn_Type_2.user.js    # 43/43 should bind
node tools/verify-drivers.js Ryn_Type_2.user.js
```

`check-hooks.js` matters more than it used to: remote control's camera and chat
are bundle rewrites, so a game update that moves either line takes the feature
with it. The camera one degrades visibly (the overlay says the hook did not
bind); the chat one degrades silently back to sending as yourself.

The Bots page markup is a JS string literal, so it is worth confirming it still
parses and that every bound input resolves to a settings key — an id that is not
in `defaultSettings` is skipped by `attachCheckboxes` / `attachSliders` /
`attachTextInputs` and the control silently does nothing.
