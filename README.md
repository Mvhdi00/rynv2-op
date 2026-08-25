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
YoRHa_System.user.js      YoRHa System 1.5 with Falcon's Replace (see below)
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/YoRHa_System_1.5.js   YoRHa System 1.5, unmodified (input)
src/Falcon_0.4.7.js       Falcon 0.4.7, unmodified (input)
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

# YoRHa System — Replace, from Falcon

A second, separate script lives here: **`YoRHa_System.user.js`**. It is YoRHa
System 1.5 with its Replace feature taken out and Falcon 0.4.7's auto-replace
put in its place, written in YoRHa's own primitives. Nothing else in YoRHa
changes — the packet layer above all is untouched.

## Why the old one had to go

YoRHa 1.5's replacer was dead code. `rynDoReplace()` ran at the top of
`getPredictObjects()` and added through `addPredictObject(...)`, but the very
next statements were `predictObjects = []` and `spamPrePlacer = false` — so
every object it queued and the spam flag it set were thrown away before
anything could send them. The feature was on by default and had never placed
anything.

## What Falcon's replacer does differently

It does not drop something back on the exact ground that was freed. When a
building dies within reach it rebuilds the whole placement ring around *you*,
grades every slot on it, puts the best spike and the best trap down, then fills
up to four more non-overlapping slots behind them. The hole is the trigger, not
the target — which is why the wall closes in one tick instead of one object at
a time.

The whole algorithm came across: the candidate ring, the grading table
(re-trap, deny-the-enemy's-ring, knock-them-into-a-building, pusher count), the
knock-into test with its bounce bonus, the block-my-own-movement veto, and the
best-spike / best-trap / four-fill selection.

## How it is written in YoRHa terms

| Falcon | YoRHa |
|---|---|
| `Je.find()` 30-angle ring | `getPrePlaceAngles()` (the 72 / 144 sweep) |
| `nn.checkItemPlacement()` | `objectManager.checkItemLocation()`, via `canPlace()` |
| `me.checkMarkers()` | `addPredictObject()`'s overlap reject |
| `me.usedAngles` / `isUsed` | `bannedAngles` |
| `_e.fetch(sid).possible` | `replaceEnemyRing()` |
| `Jt.closeObjects` | `visibleObjects` |
| `Fr.isFriendly(o.owner.sid)` | `isObjectOur(o)` |
| `enemy.trapData` | `traps_our.find(... < trap.scale)` |
| `J.withinPath()` | `pathfindingState.currentPath` |
| `Ae.dataSent.move` | `predictMoveAngle` / `lastMoveDir` |
| `this.place(id, angle)` | `addPredictObject(id, angle, false)` |
| `W.toggles.autoReplace` / `autoReplaceRange` | `window.vars.replace` / `replaceRange` |

Two Falcon expressions did not survive contact, and neither is a behaviour
change. `checkItemPlacement()` allows a slot whose only blockers carry
`breakPotential` — but nothing in Falcon 0.4.7 ever sets that flag, so the test
reduces to "the ground is empty", which is what `canPlace()` answers. And
Falcon's spike-vs-enemy-ring overlap test reuses the *trap* candidate's cached
distance plus a `spikeScale - 50` fudge in place of the spike's own radius,
reading `undefined` (→ `NaN` → "free") whenever no trap candidate shares that
angle; the real distance is measured here instead.

## Deliberate departures

1. **When it runs.** Falcon fires it synchronously out of `killObject()`. YoRHa
   collects every placement for a tick in `getPredictObjects()` and spends them
   through one packet-budgeted loop, so `killObject()` queues the break (with
   the dead object's measurements, taken while it still exists) and
   `getPredictObjects()` answers it. It still lands on the same tick, in the
   immediate — non-preplace — lane.
2. **Who it grades against.** Falcon grades against every enemy on screen and
   hands enemies beyond 300 a `placementDistance` of `Infinity`, which is a flat
   +1 to every candidate per distant player and pushes junk slots over the
   `grade > 0` bar. Only enemies inside the replace range are graded here.
3. **The spike tick.** Falcon's `spiketick` flag calls `It.do()`, its own
   weapon-swap trick. YoRHa already owns that ground (`shameTick` /
   `canTrapTick`), so the flag stays a grading signal and nothing is swapped
   from the replacer. YoRHa's spike tick is untouched.

4. **`points` is spent.** Falcon never initialises `points` on a candidate — so
   every `points +=` in the grading table lands on `undefined` — and never
   reads it, which makes the two things it scores (a spike beside a trapped
   enemy, a spike on their far side) count for nothing. It is initialised here
   and used as a tiebreak between candidates of equal grade. That cannot
   reorder anything Falcon ordered by grade; it only settles the ties Falcon
   settled by accident.

A fifth, smaller one: a slot vetoed for walling in your own walk stays vetoed.
Falcon re-grades it from zero on the next enemy in the loop, which can lift it
back above the bar even though the veto was never about that enemy.

## Sync with Auto Place and Preplace

The replacer runs between the two, and that order is the sync:

- the **preplacer** guesses the break that is about to happen and keeps first
  claim on the ring;
- the **replacer** answers the breaks that already happened;
- the **autoplacer** fills whatever ground the two of them left.

All three add through `addPredictObject()`, which now returns whether the slot
was taken — YoRHa's equivalent of Falcon's markers. None of them can take a
slot another one already holds, so there is no double-place inside a tick.
Across ticks they share one book: the angles all three spend land in
`placedAngles` in the same send loop, and the ban pass `updateAngles()` runs for
the autoplacer now also runs in the replacer's sweep, so an angle spent last
tick that still reads as free is held back rather than spent twice — including
when the autoplacer is switched off.

Bot contexts are covered too: `replaceQueue` is in `MOD_CTX_KEYS` and in
`ctxCapture` / `ctxRestore`, so a bot's breaks never leak into yours.

**Packets are untouched.** The replacer sends nothing itself. Its objects ride
the ordinary immediate lane and stop at the same `packets + 5 > 119` budget as
every other placement.

## Menu

Placers now reads Autoplacer / Preplacer / **Replace** / Placer Resolution. The
toggle keeps the `replace` id it had in 1.5, so saved settings and the one-key
Auto+Pre+Replace hotkey carry over untouched; `replaceRange` (100–500,
default 300) is Falcon's `autoReplaceRange`.

## Past Falcon

Three changes on top of the port. The first is a YoRHa bug that happens to hit
the replacer hardest; the other two are places where Falcon leaves value on the
table.

### `isItemLimit` never fired

It read `group.sandboxLimit || 99` and never looked at `group.limit`. Only
three groups carry a `sandboxLimit` — mill, booster, platform — so for
everything else the cap came out as 99:

| group | real limit | what the placer enforced |
|---|---|---|
| spikes | 15 | 99 |
| trap | 6 | 99 |
| turret | 2 | 99 |
| mine | 1 | 99 |
| mill | 7 | 299 |

Outside sandbox the gate therefore never fired, and every placer that asks
through `canPlace()` — autoplacer, preplacer, replacer — kept queueing
placements the server rejects and spending packets on them. The game's own
authority is `ClientPlayer.canBuild`: sandbox lifts the caps entirely, and
elsewhere `group.limit` is the number. `isItemLimit` now says the same thing.

This is the same expression the mix already fixed once in `AutoPlacer` — see
[the placer](#the-placer) above.

### Replace reads what actually broke

`killObject` records each dead building's owner and kind, and Falcon's
algorithm throws that away: it rebuilds the ring without ever looking at the
hole it is answering. Two things follow from reading it.

**An enemy's building coming down is not a hole in your wall.** It frees
ground, which is the autoplacer's and the preplacer's business. Only your own
losses trigger the replacer now.

**What you lost is the strongest hint on the table.** A trap that was holding
them pulls a re-trap up a grade; a spike that was cutting them off pulls a
spike that still reaches them up a grade.

### A grade floor on the four fills

Falcon spends all four on whatever is left, graded or not. A grade of zero
means the slot earned nothing from any enemy on the table, and four of those is
four buildings out of a stock the caps keep small. The best spike and the best
trap already refused to go down at zero; the fills hold to the same bar.

In the scenes the harness runs, an enemy held in an uncovered trap went from
three placements to two, and the knock-in case from five to four — the dropped
ones were the grade-zero slots in both.

---

# Combat Readout, from Falcon

Three more Falcon features came across, under Visuals → **Combat Readout**.
All three are pure drawing over data YoRHa already keeps; none of them send
anything, and none touch the placers.

| Toggle | Falcon | What YoRHa already had |
|---|---|---|
| **Reload bars** | `renderReloadingBars` | `primaryReload[sid]` / `secondaryReload[sid]`, a 0–1 fraction per player that its own combat logic reads every tick — that fraction *is* the bar |
| **Building health** | `renderBuildingHealth` | `GameObject.health` / `.maxHealth`, kept current by `changeObjectHealth()` off the hit packets |
| **Red enemy spikes / traps** | `renderRedOverlay` | `isObjectOur()`, and an item-sprite cache to key the tinted copy into |

A reload bar is only up while its weapon is loading, so a player with both bars
gone is a player who can swing right now. Building health is drawn only for
damaged buildings within 400, coloured green / yellow / red by owner, after
every object layer and before the player labels — where Falcon has it, so a bar
never hides under the building it belongs to.

### Reading a toggle from inside the render loop

These three were the first render-path code in the file to read
`window.vars` directly, and that is a green screen.

`doUpdate()` is called synchronously at the bottom of the game bundle,
thousands of lines before the settings block at the end of the userscript
assigns `window.vars`. So the first frame paints with it still undefined. And
`doUpdate()` calls `updateGame()` and only *then* schedules the next frame — so
a throw inside the render escapes before `requestAnimationFrame` is reached.
The loop never starts again, and the canvas is left showing the one thing that
did get painted: the full-screen grass fill at the top of the render.

`yorhaOn()` already existed as a guard for exactly this. Everything the render
path reads now goes through `visualOn(name)` beside it, and each of the three
features is wrapped so a cosmetic overlay can never take the game down with it.
The render suite covers the case: with `window.vars` undefined, all three draw
nothing and throw nothing, and all three come back once the settings block has
run.

The red wash departs from Falcon in one place. Falcon re-fills the current path,
which only tints the silhouette if the last shape drawn happens to be it;
compositing `source-atop` over the finished sprite paints exactly the pixels
already there, outline included, whatever branch of the item switch ran. The
tinted sprite gets its own cache slot (`itemSpriteKey`), or the first spike
drawn would decide the colour of every spike on the map.

---

# Bots, alerts and the HUD

## Bots come in as a pool, not a queue

Spawning was strictly one bot at a time with an 800ms gap on top, on the belief
that a captcha per bot needed the screen to itself. It does not — `_takeSlot` /
`_freeSlot` already stack the Turnstile widgets up the right-hand edge, a slot
allocator built for several at once and then never used that way.

Turnstile is also the entire cost of a bot: a second or two of silent
verification in front of a connection that takes milliseconds. Solving them one
after another is what made a squad take minutes.

Now a pool of workers pulls from one counter, so `botSpawnParallel` captchas are
in flight at any moment and each bot connects the instant its own token lands.
Two smaller things went with it: the ready-wait polled every 100ms after the bot
was already there and now resolves on the io-init packet itself, and the
Turnstile load poll went from 200ms to 50ms.

The gap stays, because the limit that is real is the server's connection rate,
not the captcha — but it is a setting now (`botSpawnGap`, default 150ms, per
worker) rather than a hardcoded 800. **Raise it if joins start failing**; the
Bot Join Alerts toast below is there to tell you when they do.

Against a stubbed 120ms captcha, twelve bots take ~360ms instead of ~1440ms at
four in flight — the parallelism, with nothing else changed.

## What a bot inherits from you, and what it did not

Under Full Mod a bot runs the whole mod as itself, and everything in
`window.vars` already reaches it — autoPlace, prePlace, replace, **autoBuy**,
the shame and tick toggles — because `window.vars` is one object the mod reads
wherever it runs. Auto Buy in particular goes out on the bot's own socket:
`storeBuy` sends through `io.send`, which is the bot's `modSend` for the length
of the tick.

What did **not** reach a bot is the state your keyboard drives. Auto Mills, Auto
Grind, Path Break and the three place keys are module-scope runtime variables,
they are in `MOD_CTX_KEYS`, and `ctxFresh` zeroes every one of them for a new
bot. Nothing ever set them again — so a bot could run the entire mod and still
never lay a mill, because as far as its copy of the mod was concerned you never
pressed the key.

`ctxFresh` is right not to *inherit* them, and says so: a held key copied in as
`true` has no keyup coming in the bot and would stay down for good. But
mirroring every tick is the opposite of inheriting — release the key and the
very next tick carries the `false` across too, so a key cannot stick. That is
**Mirror My Keys** in the Bots tab, and the six values are written every tick
whether it is on or off, so switching it off mid-game releases them rather than
freezing them down. The suite covers the hazard directly: hold, tick, release,
tick.

Note this is separate from the bots' own `botAutoMills` / `botAutoPlace`
behaviour layer, which is what they do without Full Mod and answers to its own
toggles.

### What a bot still cannot do

- **Chat, at all.** `modSend` swallows opcode `"6"` — deliberately, since forty
  bots on the chat line is a ban. So Killchat, Auto Chat, the Music page and the
  Pod's chat are yours alone.
- **Pathfind.** There is one `pathfindWorker` for the whole script and its
  `onmessage` is a module-scope callback, so the reply lands long after `ctxRun`
  has put your state back — and writes `pathfindingState` and
  `predictMoveAngle`, which *is* the movement command. A bot asking for a path
  would have walked **your** player down it, and two bots asking would cross
  each other's answers, since the requests carry no id. Both routes into it run
  inside the mod tick a Full Mod bot runs: auto grind sets `pathPosition`, and
  so does Autoplay's circle — and Mirror My Keys, above, is what put auto grind
  within a bot's reach. `pathfindTo` now returns early in a bot context. Where a
  bot walks is `_botTick`'s formation, which is the one thing the mod has no
  opinion about because it has no keyboard.
- **Aim at your cursor.** A bot has no mouse; its aim is whoever it is fighting.
  Driving one hands it your cursor, which is the exception that proves it.
- **Anything drawn.** The Pod, toasts, the minimap, the CRT veil and the new
  combat readout are one screen's worth of yours, not per-bot.

## Alerts

Under Server Log → **Alerts**.

**Repeated Joins.** The server tells this client about every spawn on it, by
name — that is what the join log is already built on. Counting those per name
over a rolling window turns the same feed into an answer the log cannot give by
eye: who keeps coming back. Defaults to 3 joins inside 90s, both sliders. One
toast per name per window, so a determined rejoiner does not become the spam
itself. Keyed by name rather than sid, because a rejoin *is* a new sid — the
name is the only thread between the two. The name table is an LRU capped at 200,
and a name that keeps being seen keeps itself warm, so a rejoiner's history is
never what gets evicted.

**Bot Join Alerts.** One toast per burst when bots are refused a join, with the
count, because a server turning connections away turns a lot of them away at
once. It is the difference between "spawning is slow" and "the server is
refusing me", which look identical from the outside otherwise.

## Server population

`Players: n` sits beside FPS / Ping / Bots. The server sends `addPlayer` for
everyone in the room and `removePlayer` when they leave — the same packets the
join/leave log reads — so `players` *is* the population, you and your bots
included. The HUD lives outside the game scope and `players` is rebound by the
bot context swap, so it reads through `window._novaServerPop()` rather than
holding the array: the swap is synchronous inside a tick, so a frame can never
catch a bot's world there.

---

## What was left in Falcon, and why

- **Auto Upgrade** — not the configurable age path it looks like. It substring-
  matches the upgrade element's DOM id against a hardcoded `["17","31","23",
  7thSlot]`, which also mis-matches (`"17"` hits `"117"`). YoRHa's bot age-path
  config (`botPrimary` / `botSecondary` / `botAgeTrap` / `botAge8`) is the
  better shape to build the player's own on.
- **Shame count and sid over players, placement ghosts** — YoRHa already draws
  all three.
- **One Tick / ATOS / Auto KB Insta / Melee Turret Sync / Spiek Tick** — YoRHa
  has its own insta (`instaKill`, `insta`), spike tick (`shameTick`,
  `canTrapTick`, `velocityTick`) and shame systems. Falcon's versions contend
  for weapon selection and packet ordering with them.
- **Moomoo Pet** — the Pod covers it and more.
