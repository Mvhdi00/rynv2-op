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
| **Auto Heal** | Bots → Behaviour | Bots read their own health off the packets they receive, so they know they were hit on the same tick you would, and eat the moment they drop — up to three units in one burst, then the weapon goes straight back in hand. Runs while you are driving a bot too. |
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
your own player, though, so at that range the screen would be empty: the
possessed bot's own world model is drawn as an overlay — buildings, resources,
players, names, and its health bar — but only for entities your client does not
already have, so nothing gets a flat circle stamped over its sprite.

Your own character freezes: your keys and mouse are steering the bot, so it
stops walking and stops turning. If an enemy comes within **Guard Radius**
(100–600, default 300) of it, Autoplay switches itself on and fights for you,
and switches back off once they leave. Releasing the bot hands Autoplay back
the way it was.

The arrows stop steering you while this is on — that is the trade, and
**Bots → Control → Arrow keys switch bots** turns it off. WASD is unaffected.

## Verification

```sh
node --check novastorm_1.5.user.js
node tools/test-novastorm-bots.js
```

The test evaluates the `RynBots` block straight out of the shipped userscript
against stubs and asserts the packets it emits — 87 checks over the age path,
break-weapon pick, targeting, world model, formation, auto break, safe walk,
sync, random move, auto buy, packet throttling, auto heal, auto place, the bot
console, Scan and Kill and possession.

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
