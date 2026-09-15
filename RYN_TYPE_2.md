# RYN Type 2 — bot spawn, target scan, second weapon

Changes to **`Ryn_Type_2.user.js`**, worked against the shipped game bundle in
`src/game_index.js` and the tables extracted from it in
`drivers/game-drivers.json`.

```sh
node tools/test-ryn-type2.js     # 180 behaviour tests
node --check Ryn_Type_2.user.js
```

---

## 1. Spawning a bot

### What the game requires

`src/game_index.js` fixes the order, and there is no room in it:

```
hold a token  ->  wss://host/?token=…  ->  server sends io-init  ->  send "M" (spawn)
```

`O.connect` runs its ready callback on the `io-init` frame, and the client's
`Ct()` sends the spawn frame from inside it, gated only on `O.connected`.
RYN already does the same — `SocketManager`'s `case "io-init"` calls
`myPlayer.spawn()` on the frame itself. **That is the earliest point the
protocol will accept a spawn, and it was already being hit.**

So nothing after the socket opens was worth optimising. Everything that made
SPAWN BOT feel slow was in front of it.

### Where the time went

| | before | after |
|---|---|---|
| `_spawnBot` hotkey | `setTimeout(…, 100)` between adding the row and clicking Connect | gone — the row is built synchronously, so there was never anything to wait for |
| `createSocket` | `await generateTurnstileToken()` on the critical path: a fresh Turnstile widget rendered and answered before a single byte reached the server, up to a 20s ceiling | takes a pre-minted token; mints inline only if the pool is empty |
| after `connected` | `setInterval(…, 100)` polling for `inGame` before installing the bot's weapon patch | installed when the `PlayerClient` is constructed |

### The token pool

A Cloudflare Turnstile token is valid for 300 seconds and may be redeemed once.
A token minted while nothing is happening is therefore worth exactly the same
as one minted on the press — so the pool solves them ahead of time and hands
them out single-use.

Nothing about the verification changes: same widget, same sitekey, same proof
of work, same server-side validation. Only the timing moves.

- **Single use.** `take()` removes the token from the pool. It is never copied
  and never handed to two sockets.
- **Inside Cloudflare's window, by construction.** The pool lifetime is not a
  number someone picked — it is `TURNSTILE_CF_LIFETIME_MS - TURNSTILE_SAFETY_MS`,
  300s minus a 60s margin. There is no way to configure a pool lifetime that
  outlives the token, and the oldest token the pool will ever serve still has
  the whole margin left when it reaches the server.
- **Oldest first.** Everything in the pool has passed the prune, so the oldest
  is exactly as good as the newest while having the least time left to sit.
  Serving newest-first was fine for a pool of two and quietly wasteful at forty,
  where the bottom of the stack aged out and was re-minted without ever being
  used.
- **One challenge at a time, two while you stand still.** A Turnstile challenge
  is a cross-origin iframe that lays out, composites and runs proof of work, and
  several of them side by side is a frame-rate cost you can feel — the page is
  trying to render a game at the same time. So the default is one. Standing
  still is the exception: nothing needs the frame budget at that moment, so a
  second runs alongside and the pool catches up while you are not doing
  anything.

  "Standing still" is `myPlayer.speed` — the distance covered in the last server
  tick, which the rest of this client already reads the same way — under 8, for
  four seconds. An unreadable speed counts as moving and takes the quieter rate.

  Nothing ever waits on a full pool; an empty one just mints inline the way it
  did before.
- **Frames come first.** The rate above is a guess at when there is room; this
  is the measurement. `Renderer._dtSmoothed` — the smoothed average of the last
  eight frame times the client already keeps — is read before every top-up, and
  if frames are running long the pool stops starting challenges until they are
  not. Whatever a challenge costs on a given machine, it stops being paid the
  moment it shows up in the frame time.

  Judged against the machine's own baseline rather than a fixed frame rate: a
  144Hz machine and a 40fps machine should each keep their own frames, and one
  number would either never pause the fast one or never let the slow one mint at
  all. The baseline is the best smoothed frame time seen lately, drifting upward
  slowly so it follows the machine rather than pinning to one lucky frame. Below
  17ms (60fps) the test is skipped — nothing is wrong on any machine at 60fps.

  A hidden tab renders nothing, so it mints nothing.
- **Started from idle.** Rendering a challenge means inserting a cross-origin
  iframe, and the layout and composite that follow are the part that shows up as
  a dropped frame. They go through `requestIdleCallback` (2s timeout backstop),
  so the browser places them in a frame with room instead of one the game
  needed. The concurrency slot is claimed immediately, so a deferred challenge
  still counts against the budget.

  The widget host also carries `contain: layout style`, which tells the browser
  its layout cannot affect anything outside it — so inserting and removing it
  does not invalidate the rest of the page. Paint containment is deliberately
  left out: it clips to the box, and an interactive challenge that needs to draw
  outside its own frame would be clipped into something unanswerable.
- **Runs while you are in the game, and only then.** Two gates, both live: the
  pool waits for Cloudflare's own script to appear (the userscript runs at
  `document-start`, and without that check the keeper would fire challenges
  every 2.5s that could only reject), and it waits for the main
  player to be in the game. A tab parked on the name box, or left on the death
  screen, mints nothing at all. From the moment you are playing it fills and
  stays full, so any bot you ask for is instant.

  Read live rather than latched on the first spawn, so leaving the tab on the
  death screen stops it the same way the menu does. A death itself costs
  nothing: tokens last four minutes, so the pause until you respawn is far too
  short for the pool to drain.
- **Cannot wedge.** In-flight challenges are subtracted from what the pool may
  start, so one that never settles holds a concurrency slot for good — and four
  of those used to stop the pool for the rest of the page: empty, full or
  otherwise, it computed nothing to do and never came back. Challenges are now
  tracked as slots with a start time and written off after 30s, so the budget
  always returns. A written-off challenge that answers late is still delivered;
  only the accounting was reclaimed.
- **Never competes with a spawn.** A spawn that found the pool empty used to
  start its own challenge alongside the ones the pool already had running —
  several widgets stacked up the edge of the screen, and when Cloudflare wanted
  an interaction there was no telling which of them to answer. A spawn now joins
  the queue for work already in progress and is served **ahead** of the pool's
  own shelf. Several spawns at once queue behind each other rather than each
  starting a challenge, because the rate limit applies to them too; they only
  fall through to minting their own when nothing can be started at all.
- **Recoverable.** A socket that opens and closes without ever producing
  `io-init` is what a declined token looks like from the client. That gets
  exactly one retry with the pool bypassed, so a pooled token can never leave a
  bot silently unconnected.

| | |
|---|---|
| tokens kept ready | 40 — the fleet cap, so a full pool is a full fleet |
| challenges at once | 1 moving, 2 standing still |
| pool lifetime | derived: Cloudflare's 300s − 60s margin = 240s |
| keeper interval | 2.5s |
| standing still means | `myPlayer.speed` ≤ 8 for 4s |
| pauses when | frame time > 1.3× the machine's own best, or tab hidden |
| challenges start | from `requestIdleCallback` |
| cold fill to forty | ~100s moving, ~53s standing still |
| a challenge is written off after | 30s |
| a spawn waits for one in flight for | 5s, then mints its own |
| runs when | Turnstile loaded **and** `myPlayer.inGame` |

**Bots → Spawn** carries the readout, and it is **hidden by default**. Type
`!tk` in the game's own chat box to toggle it — the text is intercepted on blur,
before `Possess.chat` is reached, so nothing is encoded, nothing is sent and
nobody else sees it. The chat box is just the one place the game reliably hands
the keyboard over.

It shows ready, solving, why it is going at the speed it is (the rate, or
*holding off — frames are running long*), spawns waiting, spent, expired unused
and timed out, and says *paused until you are in the game* when it is not
running. **Stop / Start** is the manual switch — Stop halts all minting while
keeping whatever is already on the shelf, so the tokens you have are still
spendable and any spawn waiting on one is released to mint its own rather than
sitting out its timeout. **Fill now** skips the wait for the next keeper tick
after a burst of spawns has drained the pool.

*Timed out* moving is the wedge recovery doing its job, not something stuck. A
number that keeps climbing means Cloudflare is not answering.

### Why a slow fill is the right trade

A cold pool takes about a minute and a half to reach forty while you are
moving, against the twenty-five seconds four-at-a-time would have taken. That
is the trade, and it is the right way round: a pool that is a minute behind
costs nothing once it is full, and dropped frames cost something every second.

It also keeps up once full even at the slower rate. Forty tokens expiring at
240s is one to replace every 6 seconds; one challenge per 2.5s keeper tick is
capacity for one every 2.5s. The rate limit only lengthens the initial fill —
it never stops the pool holding its level.

### The standing cost, and what the gate buys

Holding forty tokens ready is not free. Forty ageing out at 240s is **a
challenge solved every few seconds for as long as the pool runs**, and a token
that ages out unused is a solve spent on nothing — which is what the *expired
unused* counter exists to make visible.

There is no way to hold forty ready more cheaply: tokens expire at 240s
whatever we do, so forty ready means re-minting forty every 240s. The only
lever is *when* the pool runs at all, and that is what the in-game gate is. A
tab on the main menu — which is where a browser tab spends most of its life —
mints nothing, and neither does one left on the death screen.

Worth knowing either way: Cloudflare may respond to sustained volume from one
client by making challenges harder or interactive, which would make spawning
slower rather than faster. If *expired unused* climbs while spawns stay rare,
that is the trade going the wrong way.

The weapon patch move is a correctness fix as well as a speed one: `newUpgrade`
is driven by the server's `"U"` frame, and the first of those can arrive in the
same burst as the spawn. A patch applied up to a poll interval later was a race
the bot could lose, and its first upgrade would come out of the owner's order
instead of the configured loadout.

### What is left

The socket open and the server's `io-init` round trip. Both are network, and
neither can be started earlier than it already is.

---

## 2. The second-weapon stuck state

### The bug

Reported as: the bot fires its secondary and then will not switch weapons,
move, attack with anything else, or run any of its normal logic.

The cause is two halves of the same line in the server's own player update
(`src/game_index.js`, `Player.update`):

```js
else if (weapons[wi].projectile != null && this.hasRes(weapons[wi], projCost)) {
    this.useRes(...); addProjectile(...)
} else C = false;
this.gathering = this.mouseState,
C && (this.reloads[wi] = weapons[wi].speed * atkSpd)
```

Without the resources the weapon charges per shot — 4 wood for the bow, 5 for
the crossbow, 10 for the repeater, 10 stone for the musket — **nothing is
fired, and because the reload is only armed when something was fired, nothing
goes on cooldown either.** The attack frame is accepted, consumed, and has no
effect whatsoever.

RYN's own reload model mirrors the server faithfully:
`Player.updateReloads` only resets the counter when it recognises the
projectile the shot produced. A shot the server dropped produces none, so the
counter stays pinned at max and the weapon reads "ready" on every tick that
follows.

`BotRangedAttack.postTick` then took the tick unconditionally:

```js
ModuleHandler.moduleActive = true;
ModuleHandler.forceWeapon = 1;
ModuleHandler.shouldAttack = turn.mayFire;
```

`moduleActive` is the flag every other module reads as *someone else owns this
tick*. Held on every tick, it stops the bot placing, healing, breaking,
switching or doing anything at all — which is every symptom in the report.

Measured on the original file, 90 ticks (10 seconds) with a musket and no
stone:

| | before | after |
|---|---|---|
| ticks locked out | 90 | 0 |
| ticks holding the secondary | 90 | 0 |
| attack frames sent | 90 | 0 |

### The fix

Two changes, both of them the server's own rules rather than new ones.

**The shot is gated on the game's `hasRes`.** `botHasAmmoFor` reads
`Weapons[id].cost` — the game's `req` pair normalised into the four resources —
and applies the hat's `projCost` with the same `Math.round` the server applies
it with. The multiplier is read off the hat rather than tested against the
Musketeer Hat's id, because that is what the server does. A shot the server
would drop is never sent, so the reload it would not arm is never waited on.

`tools/test-ryn-type2.js` checks this against `drivers/game-drivers.json` for
every weapon × resource set × hat: 336 combinations, all agreeing with the
game's own `hasRes`.

**The weapon claim is scoped to the firing tick.** Standing in the kite band
and pointing at someone is a movement decision and an aim decision; neither
needs the weapon, so neither takes it.

- `this.active` — the movement claim — is taken whenever the bot is kiting.
  Movement and BotExplorer keep standing aside, so kiting is unchanged.
- `moduleActive`, `forceWeapon` and `shouldAttack` are now taken **only** on a
  tick where the shot can actually go out: off cooldown, with the ammo for it,
  and the bot's volley wave cleared to fire.

Off the firing tick the bot is under normal control with its normal loadout.
That is what returns it to normal after the secondary completes, and the client
already knew what to do with those ticks — `UseFastest` holds whichever weapon
is on cooldown so it reloads, which is exactly the game's model
(`updateReloads` only advances the held weapon's counter) and was previously
unreachable because the tick was never free.

**A backstop, for the same failure arriving by a route the ammo test cannot
see** — a hat swap mid-flight, a resource count a frame out of date. A
requested shot whose reload counter has not moved two ticks later did not
happen; three of those in a row and the secondary stands down for 1.5s rather
than being asked again every tick. Judged at two ticks rather than one because
the projectile frame and the player update that reads it arrive in the same
burst and the order between them is the server's to choose. On a bot shooting
normally neither counter ever leaves zero.

The same ammo test is applied to `UseAttacking`'s secondary branch, which could
otherwise re-enter the identical wasted-frame loop.

### What is deliberately not changed

Weapon switching, reload timing, cooldowns, attack cadence, inventory sync, the
primary, and the owner's own insta sequences. No fake reloads, no bypassed
cooldowns, no duplicate attack frames — the fix removes frames, it does not add
any.

---

## 3. Player index and target scan

Both live in the **Bots → Target Scan** panel.

### The index

Everyone this tab has seen, from any of its connections, in one deduplicated
list. Two sources, both already in the client:

- **`PlayerManager.createPlayer`** runs on the server's add-player frame — the
  one that carries a name — for every player entering any connection's view. A
  fleet spread over the map sees most of the server between them.
- **`LeaderboardManager.updatePlayer`** names the top ten wherever they are
  standing, so someone no connection has had in view is still listed, just
  without a position.

Positions come from the player update stream, which is already walked once a
tick per connection.

The key is the player's **sid** — the id the update stream, the leaderboard,
the clan list and every packet that names a player all use. Keying on it is
what makes the list deduplicate itself: the same player seen by nine bots is
nine writes to one entry.

Each entry carries the id, name, last known position, health, clan, which
connection saw them and when.

**Your own bots are never in it.** They are filtered on the way in by the
owner's id, the fleet's `clientIDList`, and the live `clients` set — and
removed again when a bot registers, because a bot can be seen by another bot
one tick before it learns its own id.

### The scan

Pick a player, press **SCAN**. It is a toggle, and nothing switches it off but
pressing it again.

**Searching.** Every bot roams. This is not new machinery: `BotExplorer`
already scores all 36 map sectors on every destination choice, keeps no
explored/unexplored state anywhere, applies a decaying penalty to a sector a
bot has just stood in, pulls the fleet's destinations apart from one another,
and pulls destinations onto the map edge half the time so the rim and corners
get visited rather than passed near. Searching the whole server for one player
is what it does, so the scan drives it rather than duplicating it — one extra
term in its "should I be roaming" test.

**Detection is not a search.** Each connection is told about a player exactly
when the server decides that bot can see them, and already walks that list once
a tick. A bot spotting the target is one integer compare inside a loop that was
running anyway. There is no per-bot map sweep and no distance matrix, and
nothing costs more at forty bots than the update stream already did.

**On contact:** a marker on the minimap at the target's position — an expanding
ring on the game's own `mapPingScale` and `mapPingTime`, so it reads as a ping —
with the target's name and distance beside it, and the coordinates, distance and
which bot has them in the panel. The ring is drawn locally rather than sent as
the game's ping frame, which would ping from the *bot's* position and show it to
everyone on the server.

**The converge.** Every other bot walks in. Each takes its own slot on a ring
around the target, from its fleet index, so forty bots surround it instead of
stacking on one coordinate where the game's collision would spend the fight
shoving them off each other. The ring is 170 units — inside the polearm's 142
reach plus a player's 63 of hit scale, so every bot can swing from its slot.
The bot that found them holds the inside at 80 and keeps the engagement; a bot
arriving later never displaces it. A bot already kiting the target is left to
kite.

**Tracking.** The confirmed server position always wins. The client's existing
one-tick extrapolation is added as a lead only while the sighting is under
170ms old, and never extends past the one tick the server itself moved them —
so the fleet is not chasing ghosts. Past 1400ms with nobody reporting, the
sighting is dropped.

**After the target dies** — or walks out of view; from the client the two look
identical and the right response is the same — the sighting expires, the scan
stays on, and every bot is back to distributed searching on the next tick.
Found again, they converge again. Only pressing SCAN again stops it.

### Cost

| | |
|---|---|
| detection | one integer compare per visible player per tick, inside an existing loop |
| index positions | throttled to 4 writes/second per player |
| staleness | once per tick, on the owner's connection only |
| converge | ~10 arithmetic ops per bot per tick, off a cached fleet index |
| search | BotExplorer's existing fleet-wide budget of 3 path plans per 100ms |
| panel | 500ms timer, revision-gated, and only while its page is open |
| minimap marker | a handful of draws, only while a target is found |

### Arbitration

The mission owns `_scanMissionActive` — a flag `Movement.postTick`,
`BotExplorer.postTick` and the targets system already stood aside for. It is
set and cleared once a tick, before either reader runs.

Order in `botModules`: ranged attack, **scan mission**, explorer, movement.
That is the order the three movement claims resolve in — a bot in range should
be shooting rather than walking, a bot that knows where the target is should be
walking to them rather than roaming, and roaming is what is left. Possession,
frozen bots, duels, auto-farm and squad gating all still outrank the mission.
