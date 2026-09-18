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
Ryn_Type2.user.js         Ryn Type 2, with the Chat Log integrated
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/build-chatlog.js    Chat Log -> Ryn_Type2.user.js
tools/chatlog/            the Chat Log module, its stylesheet, and its harness
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

---

# Ryn Type 2 — Chat Log

`Ryn_Type2.user.js` is Ryn Type 2 with a Chat Log integrated into it: a
draggable panel in the top-left corner listing what was said, who arrived, who
left, who died, and who formed or joined a clan.

```sh
node tools/build-chatlog.js --check   # report the anchors, write nothing
node tools/build-chatlog.js           # patch Ryn_Type2.user.js in place
node tools/chatlog/preview.js         # build the browser test harness
node tools/chatlog/artifact.js        # build the shareable live preview
```

The module lives in `tools/chatlog/chatlog.js` and its stylesheet in
`tools/chatlog/chatlog.css`; `build-chatlog.js` injects both and makes 17 other
anchored edits, each of which fails the build if its anchor is missing or
ambiguous — the same rule `build-reup.js` follows.

It appears when this client spawns, not on moomoo's menu card, and it stays on
screen while the Ryn menu is open. Both are read off the client's own state:
`ClientPlayer.playerSpawn` and `ClientPlayer.reset`. The log records in the
lobby too — everything said before you spawned is there when you arrive.

## Docked to the corner mark

By default the panel is joined to the Ryn Type 2 corner mark: the panel's
header opens up to the mark's height, the mark takes its seat inside it, and
the panel drops its own "RYN Chat Log" title because the mark is already saying
it. Drag the panel away to separate them; drop it back near the corner to join
them again.

Two panes of glass sharing an edge do not merge — each blurs the page behind it
separately, and over a gradient the two results differ enough that the join
reads as a line. So there is only ever one pane: the panel's. The mark
(`#ryn-v2-wrapper`, already at `z-index: 99999`) is repositioned into the
panel's header through two custom properties, and its own styling, hover and
click-to-open-menu are untouched.

## Where the events come from

Nothing is inferred and nothing is polled. Each event is read at a point the
client already runs for that packet:

| Event | Source | Payload |
|---|---|---|
| Chat | `SocketManager` case `"6"` | `[sid, message]` |
| Join | `SocketManager` case `"D"` | `[socketID, sid, nickname, …]`, first time that connection appears |
| Leave | `SocketManager` case `"E"` | `[socketID]` — added; the client had no use for it before |
| Death | `SocketManager` case `"O"` / `"P"` / kill credit | zero health, own death, or `myPlayer.killedSomeone` |
| Clan created | `SocketManager` case `"g"` | `{sid: clanName, owner: sid}` |
| Clan joined | `PlayerManager.updatePlayer` | `player.clanName` changing, in the loop that already decodes it |

Identity is the server's own player sid — the one `"D"` hands out and every
later packet keys on. The nickname is display metadata, so a rename keeps the
same `[id]` and keeps its mute.

A connection's **first** `"D"` is an arrival; every later one is that player
respawning, and is not logged as a join. `"E"` is the only packet that means
gone-for-good, which is what makes a leave distinguishable from a death and
from a respawn.

## Mute

Muting filters at the game's own presentation layer. The bundle's entire chat
display is one function:

```js
function dl(e,t){const i=Rt(e);i&&(i.chatMessage=t,i.chatCountdown=y.chatCountdown)}
```

`e` is the sender's sid, and those two assignments are the whole act of showing
a message — the render loop draws the bubble for as long as `chatCountdown` is
above zero. The `chatMute` hook declines to make them for a muted sender. The
packet still arrives and is still decoded, the socket is untouched, nothing is
blocked, every other player's chat is unaffected, and outgoing messages are not
involved. A muted player is invisible in the game's own chat bubbles *and* in
the log.

## Cost

- **No polling.** No `setInterval`, no `MutationObserver`, no frame loop. One
  `setTimeout` for the whole system, armed for the moment the oldest entry
  turns 15 minutes old and rearmed from whatever is oldest after that — nothing
  runs at all while the log is idle.
- **Incremental DOM.** One event appends one row; one expiry removes one row.
- **Filters and mutes are CSS.** Hiding a kind, or every message from a player,
  rewrites one stylesheet — O(1) in the number of entries, and the entries
  themselves are never touched, so the log keeps collecting what it collected
  before.
- **One forced layout per frame.** Following the tail reads `scrollHeight`,
  which is a synchronous layout; it is coalesced into one `requestAnimationFrame`
  so a burst of messages costs one layout, not one per message. This is worth
  60× on a flood: 0.66ms per event before, 0.011ms after.
- **Bounded.** 15-minute lifetime, 400-entry cap, and per-player bookkeeping
  released when that player leaves.

## Checks

```sh
node --check Ryn_Type2.user.js
node tools/chatlog/preview.js && open tools/chatlog/preview.html
```

`preview.html` cuts the module out of the built userscript — so it exercises the
integrated code, not a copy — stubs the handful of client objects it closes
over, drives the observation points with real packet payloads, and prints 61
assertions on the page. All 61 pass, and all 53 bundle-rewrite hooks bind
against the shipped `moomoo.io` bundle, `chatMute` among them.

## Limits

moomoo broadcasts no "player X died" packet for third parties. Three signals
are read instead — the server's zero-health update, the `"P"` sent to this
client on its own death, and RYN's existing kill credit — and reconciled on the
game's tick counter so one death is one entry. A death you did not cause, and
which no zero-health update accompanies, cannot be detected without guessing,
and is not guessed at.

Muting a player while their bubble is already on screen leaves that one bubble
up until the game's own ~3s countdown runs out. The next message is suppressed.

---

## Notes

- `_spikeRotation`, `_millRotation` and `_usernameCycler` are excluded from
  Legit Mode — they are cosmetic and naming options, not combat automation.
- Rotation toggles default to **on**, i.e. vanilla behaviour. Luna defaulted
  them off; the mix does not silently change how the game looks on first run.
- `_lowQuality` still freezes all object rotation, as it did in RYN.
