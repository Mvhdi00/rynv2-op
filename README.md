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
onto the RYN core instead, and the rest of RYN was left alone except where it
was outright broken — see the fixes below.

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

### Bot performance with a large squad

One enemy walking into view used to cost most of the frame rate at twenty bots,
and firing at them cost the rest of it. A bot is a whole client: it keeps its
own copy of the world and runs the same threat analysis and the same module
pipeline as the owner, on the owner's thread, every 111 ms tick. Twenty-one of
those in one tick leaves the renderer whatever is left.

Three changes, in order of how much they buy:

**Threat analysis is bounded by range.** `EnemyManager.handleEnemies` ran
`checkCollision` (a spatial-grid query) and `handleDanger`
(`canPossiblyInstakill` → `detectSpikeInsta`, another grid query) for *every*
enemy in view, on every client, every tick. Nothing either one can find reaches
you from beyond 1600 units — the widest ring in `canPossiblyInstakill` is the
turret one at 700 + 130, and the widest read is the ranged-bow tell at a musket
projectile's 1400. Past that the work is now skipped. `handleNearest` still runs
for every enemy, so `nearestEnemy` and every module keyed off it are unchanged.

**The spike-placement search is gated on reach.** The same function ran
`getBestPlacementAngles` — a grid query plus a sort — for any enemy in view,
then filtered the result down to angles that actually touch them. A spike goes
down at arm's length, so past `placeLength + collisionScale + spikeScale` the
filter is provably empty and the whole search is thrown away. It is now skipped
at exactly that distance, so the output is identical.

**A wall-clock budget on the analysis stage** (`Misc → ReUp Mix → Bot AI
Budget`, default 8 ms, 0 to disable). Bots are analysed freely until the tick's
budget is spent; past it a bot reuses its last read and takes its turn in a
three-tick rotation, staggered by slot so the guaranteed reads spread across
ticks instead of landing together as one spike. Missing a turn skips the
analysis only — the module pipeline still runs, so the bot re-acquires its
target, moves, attacks and answers commands as usual — and a bot with an enemy
inside 350 is never held back at all, because that is where one stale tick is
the difference between eating an insta and blocking it. The owner is never held
back. Twenty bots all mid-range from an enemy go from a flat 24 ms/tick to a
steady 14 ms with no periodic spike; in practice the range gate has already
removed most of that before the budget sees it.

Alongside those, work whose result was being discarded:

- **Chat log.** Every bot client decoded the same join/leave/chat packets and
  filled a row buffer nothing would ever render — only the owner builds a panel.
  Twenty-one timestamped, escaped copies of every row for one visible list.
- **Trap rebuild** mapped your own traps out of a 9×9 grid sweep every tick on
  every client, though the rebuild it feeds needs an enemy inside 300 to do
  anything. It now scans at 600, which keeps the map warm before that gate can
  open. Its list of destroyed-object ids also lived on one `window` global that
  every client appended to and every client cleared, so which breakages a given
  client saw came down to tick order; the list is per-client now.
- **Overlay canvases.** The squad and halves overlays reassigned
  `canvas.width` every frame, which reallocates the backing store even when the
  value is unchanged, and the target overlay cleared a full-screen canvas every
  frame whether or not it had a target to draw.
- **Bot chat listener.** It re-read every bot socket with
  `JSON.parse(ev.data)`. The frames are binary msgpack, so `ev.data`
  stringifies to `"[object ArrayBuffer]"` and the parse threw on every packet of
  every bot — caught, so silent, but it also means the bot chat replies and the
  `nyx <n>` duel trigger behind it have never once fired. It now takes the
  already-decoded chat packet instead. Fixing the plumbing should not silently
  start twenty bots talking in public chat, so it stays off until you ask for
  it: `RYN._botChat = true`.

### Bots frozen holding a bow, crossbow or musket

A bot would lock up mid-fight still holding a ranged secondary, deaf to
commands. The cause was a reload counter that could stop advancing.

`UpdateAttack` only lets a client change weapon once `reloading.isReloaded()` is
true for the weapon in its hand, and `PreAttack` clamps `shouldAttack` the same
way. `Reloading` mirrors those counters straight off `myPlayer.reload`, and
`Player.updateReloads()` advanced only the reload of the weapon *currently
held*, and returned early whenever a placeable item was in hand. So a reload
that started on the secondary and then lost its tick — the bot placed
something, or switched — never finished. `isReloaded` stayed false for good, and
the client could neither swing nor let go of what it was holding.

Only the ranged secondaries have a reload window long enough for that race to
land, which is why it was always a bow, a crossbow or a musket.

Fixed in three layers:

- **Reload timers advance for both weapons, every tick.** A reload runs on the
  weapon, not on the hand — switching or holding a placeable does not pause it.
  This also removes a false positive in the `reverseInsta` read, which tested
  `isEmptyReload(1)` and saw a frozen `0` as "just fired" indefinitely.
- **A reload max can no longer be negative.** `getWeaponSpeed` returns `-1` for
  an empty slot and a bad ping could drag a real speed under zero; either way
  `isReloaded` compared against a max no counter could reach.
- **A watchdog on the mirrored counters.** A healthy reload gains exactly one
  per tick, so a counter that has not moved at all in two seconds is a lost
  packet, not a reload — it gets topped up. And `UpdateAttack` now switches
  weapon anyway after wanting one for two solid seconds: a swing the server
  refuses costs one packet, a bot that never lets go of its bow costs the bot.

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
