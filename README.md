# ReUp Mix (Luna × Ryn)

A merged moomoo.io userscript: the RYN Client v4 core with the Luna Client
features RYN never had, built against the game bundles in `src/` and verified
against them.

Build output: **`ReUp_Mix.user.js`**

The same game bundles back a second build in this repo: **`LemonMod_Fixed.user.js`**,
LemonMod v3.0 brought onto the current protocol — see
[LemonMod v3.0 on the current protocol](#lemonmod-v30-on-the-current-protocol).

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
LemonMod_Fixed.user.js    LemonMod v3.0 on the current protocol (see below)
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/LemonMod_v3.0.js      LemonMod v3.0 (input)
src/LemonMod_Visuals_v3.0.js  LemonMod's visuals script (input, see below)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/lemon-bridge.js     old-protocol <-> current-protocol bridge, injected by
tools/build-lemon.js      src/LemonMod_v3.0.js -> LemonMod_Fixed.user.js
tools/verify-lemon.js     LemonMod_Fixed.user.js vs. the bundle's own crypto
```

## Build

```sh
node tools/extract-drivers.js    # refresh drivers from src/game_*.js
node tools/build-reup.js         # produce ReUp_Mix.user.js
node tools/build-lemon.js        # produce LemonMod_Fixed.user.js
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

# LemonMod v3.0 on the current protocol

`LemonMod_Fixed.user.js` is LemonMod v3.0 rebuilt to run on the game in `src/`.
Build it with `node tools/build-lemon.js`, check it with
`node tools/verify-lemon.js`.

LemonMod is not a fork of the bundle — it is an overlay that hooks the socket —
so unlike Luna it *can* be brought forward. Nothing was wrong with its game
knowledge: every hat, accessory and upgrade slot it names by id still exists in
the bundle, unchanged. What broke is the wire and when the script loads.

## What was broken

**The transport.** LemonMod speaks the old protocol: plain msgpack
`[type, args]` frames with string opcodes — `"sp"` to spawn, `"33"` to move,
`"ch"` to chat, `"2"` to aim. The game negotiates an opcode permutation per
connection on `io-init`, so every opcode on the wire is now a number that means
something different on the next connection; each client frame is
`[opcode, args, seq]` behind 6 bytes of truncated HMAC-SHA256. LemonMod's frames
were rejected on the way out, and on the way in its handlers — which switch on
`"1"`, `"2"`, `"6"`, `"33"`, `"ch"`, `"h"` … — never matched a numeric opcode,
so the mod saw nothing at all.

**When it loads.** The bundle caches `WebSocket.prototype.send` at module load
and calls that cached reference directly. LemonMod runs at document-idle, which
is far too late: the game's own traffic never reached its hook, so the line that
captures the socket —

```js
_0x83059 || (document.ws = this, _0x83059 = this, _0x51247d(this), …)
```

— never ran, so it never attached its message listener. That is the "nothing
works" part: not a broken feature, an inert script.

**Its extra sockets** built `url.split("&")[0] + "&token="`. That was right when
the server URL carried `?gameIndex=N`; the current one is
`wss://<host>?token=<turnstile>`, where it produces a second `token` on a URL
that already has one.

## What the build does

| | |
|---|---|
| `@run-at document-start` | so the hooks are in place before the bundle caches `send`. The mod body is wrapped and gated on `DOMContentLoaded`, which is what document-idle used to guarantee it — it reads `#enterGame` at top level. |
| `tools/lemon-bridge.js` | injected ahead of the mod: translates frames both ways. |
| bot sockets | `?token=`, and their `onmessage` is pointed at the bridge so their traffic is translated too. |

The mod's own code is otherwise untouched.

### The bridge

It sits underneath LemonMod so the mod keeps seeing the frames it was written
against:

```
game -> bridge -> [old-style frame] -> LemonMod's send hook -> bridge -> wire
wire -> bridge -> [old-style frame] -> LemonMod's message listener
```

Three things are worth calling out:

- **It re-signs every outgoing frame, the game's included.** The bundle keeps a
  private sequence counter; a second counter running alongside it would collide
  on every packet the mod sends. Owning the numbering for both senders is what
  keeps `seq` monotonic on the wire.
- **Passing the game's frames *through* LemonMod's hook is deliberate.** That is
  what the mod expects on the old game, and several features depend on it —
  chat commands (`!crash`, `!join`, `!kick`) are implemented by inspecting the
  game's outgoing `"ch"` packets.
- **Every opcode is mapped explicitly, in both directions.** The sixteen the mod
  handles get their old names; the other twenty get names it ignores. Passing an
  unmapped opcode through raw would be worse than dropping it — the bundle's
  `"1"` is *delete alliance*, and LemonMod's `"1"` is *setup game*.

It also carries its own msgpack rather than depending on LemonMod's
`@require` of `msgpack.js` from `lemonmod.com`, and fills in `window.msgpack`
from it if that require ever fails.

Two smaller things the bridge does, both easy to delete if you would rather it
did not:

- reports synthetic events as trusted (`Event.prototype.isTrusted`). Every UI
  and key handler in the bundle goes through `checkTrusted`, which drops
  `isTrusted === false`, so the clicks LemonMod synthesises — accepting an
  alliance request, for one — land on handlers that ignore them;
- claims the id `userscript-warning` with an empty node, which makes the
  bundle's red "disable your userscript manager" banner bail out. It shows for
  anyone with Tampermonkey installed, with or without this script.

## Verification

```sh
node tools/verify-lemon.js
node --check LemonMod_Fixed.user.js
```

`verify-lemon.js` builds and checks its frames with the bundle's *own* crypto —
`Po`, `Eo`, `Ro` lifted out of `src/game_index.js` rather than reimplemented —
so the test cannot agree with the bridge by sharing its mistakes. It runs the
bridge in a sandbox against a stand-in for LemonMod's hook and covers:

- the opcode tables against `drivers/game-drivers.json`: every opcode the game
  sends or receives accounted for exactly once, no two sharing a name, and the
  sixteen the mod handles landing on the right ones;
- a game frame arriving at the mod's hook as an old-style frame and leaving
  validly signed, correctly permuted and sequenced; the same for a mod frame and
  for a spawn, which carries a map rather than scalars;
- sequence numbers staying monotonic across both senders;
- what a real hook does: sending its own packets from inside the hook,
  swallowing a frame, and reading through `onmessage` on a bot socket;
- two connections keeping separate key schedules and counters;
- every hat, accessory and upgrade slot the mod names still existing in the
  bundle.

`build-lemon.js` additionally refuses to build if LemonMod stops doing any of
the three things the bridge is written around — hooking
`WebSocket.prototype.send`, keeping the old one as `oldSend`, and reading the
wire through `addEventListener("message")`.

## What is still not fixed

- **Bots / multiboxing.** The bridge translates their traffic and their URL is
  corrected, but they fetch a server list from `sandbox.moomoo.io/serverData.js`
  and sign on with a reCAPTCHA token. The game moved to Cloudflare Turnstile, so
  the token those sockets present is not one the server will take. Getting that
  working is a rewrite of the bot connect path, not a fix.
- **`LemonMod - Visuals`.** That script is a fork of the whole old webpack
  `bundle.js`, the same kind of thing as Luna 1.1 — it replaces the client
  rather than hooking it, and it predates this transport entirely. It cannot be
  patched forward; it is checked in as `src/LemonMod_Visuals_v3.0.js` for
  reference only. (It also opens with a `fetch` to a base64'd glitch.me URL, on
  every load.)
- **`!crash`** sends a deliberately malformed buffer. The bridge passes it
  through untouched rather than trying to make it work.

---

## Notes

- `_spikeRotation`, `_millRotation` and `_usernameCycler` are excluded from
  Legit Mode — they are cosmetic and naming options, not combat automation.
- Rotation toggles default to **on**, i.e. vanilla behaviour. Luna defaulted
  them off; the mix does not silently change how the game looks on first run.
- `_lowQuality` still freezes all object rotation, as it did in RYN.
