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
src/mods/                 third-party userscripts, as received (inputs)
src/moo-transport-shim.js current transport, for scripts that hook the socket
mods/                     the repaired userscripts — these are the ones to install
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/fix-mods.js         src/mods/ -> mods/
tools/check-mods.js       mods vs. the game bundle
tools/verify-shim.js      shim vs. the game's own codec and crypto
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

---

# The other userscripts

Five third-party mods were repaired against the same two game files:
**Balthazar priv**, **Robotics kusoi**, **Sam Mod**, **x18k Original** and
**xelahot**. Inputs are in `src/mods/`, output in `mods/`.

## Why none of them worked

They were all written for the old transport, where every frame in both
directions is a bare msgpack `[typeString, args]`. The game in
`src/game_index.js` does not do that any more. On connect the server sends
`io-init` carrying `[socketId, seed, hexKey, mode]`, and when `mode` is 1 the
client has to

- permute the 17 c2s and 36 s2c opcode names from `seed`, so a packet is
  addressed by a per-connection **number** rather than by its name,
- carry a monotonic sequence counter as a third frame element, and
- prefix every client frame with the first 6 bytes of
  `HMAC-SHA256(key, frame)`.

So each mod was broken twice over: not one packet it sent could be accepted,
and none of its receive handlers ever ran, because the incoming type arrived as
a number matching no string key. Every one of them reads `io-init[0]` for the
socket id and ignores the seed and the key.

Three of them additionally `@require`d msgpack-lite from **rawgit.com**, which
was shut down in 2019 — those had been running with an undefined `msgpack`
global for years, before the protocol was ever a factor.

And none of them declared `@run-at document-start`. The game captures
`WebSocket.prototype.send` into a private binding as its bundle evaluates
(`kn`/`Ri`, near the top of `src/game_index.js`) and calls that captured
reference for every packet, then locks `window.WebSocket` with
`defineProperty`. A hook installed after the bundle has loaded is simply never
called, so their socket interception could not have worked whatever the
protocol was.

## The shim

`src/moo-transport-shim.js` sits at the socket boundary and keeps the old
protocol true from the mod's point of view — opcode names in both directions,
no signature, no counter — while speaking the real thing to the server.

The part that makes it hold together is that the shim rewrites `io-init`'s
`mode` to 0 on the way to the page. The game then leaves its own crypto off and
emits bare `[name, args]` frames, which is exactly what the mods'
`WebSocket.prototype.send` hooks expect to decode and re-encode. Every frame is
then signed once, at the last point before the wire, and the sequence counter
has a single owner instead of being split between the game and the mod.

That means no mod's packet logic had to be rewritten. It also covers **x18k**,
which is not a socket-hooking mod at all but a fork of the whole game bundle
with its own `packet.connect`/`packet.send`; because it still reaches the wire
through `WebSocket.prototype.send`, the shim picks it up unchanged.

A packet name that is not in the game's alphabet is dropped rather than sent,
and dropped without consuming a sequence number, so a mod's leftover
private-server opcodes cannot desync the stream.

## What was changed in each script

| | Balthazar | Robotics | Sam Mod | x18k | xelahot |
|---|---|---|---|---|---|
| transport shim | ✓ | ✓ | ✓ | ✓ | ✓ |
| `@run-at document-start` | ✓ | ✓ | ✓ | ✓ | ✓ |
| dead `@require` dropped | — | ✓ | ✓ | ✓ | ✓ |
| runtime CDN injection neutralised | ✓ | — | — | — | ✓ |
| metadata block moved to the top | ✓ | — | — | — | — |
| body gated on `<body>` / jQuery | ✓ | — | ✓ | ✓ | ✓ |

Balthazar's metadata block was not the first thing in the file — an
`IIFE` sat above it — so no userscript manager was parsing its header at all.

The readiness gate is there because `document-start` runs before `<body>`
exists and several of these scripts build DOM at top level. It holds the body
until the document has a body, and until the page's jQuery has loaded for the
four that call `$()` immediately. That still lands before the game runs: the
bundle is a module script, and module scripts are deferred until after parsing,
so the gate opens while parsing is still in progress and any
`WebSocket.prototype.send` hook below is in place before the bundle captures it.

Data tables needed no correction — hats (46) and accessories (21) in all five
already match the shipped bundle exactly.

## Build and verify

```sh
node tools/fix-mods.js        # src/mods/ -> mods/
node tools/check-mods.js      # audit mods/ against the bundle
node tools/verify-shim.js     # shim vs. the game's own codec and crypto
```

`verify-shim.js` does not test the shim against a restatement of the protocol.
It lifts the real msgpack encoder and decoder out of `src/game_vendor.js` and
the real `Po`/`Vt`/`Ao`/`Eo` out of `src/game_index.js` and runs them side by
side with the shim's, because what matters is agreement with the server and the
bundle is the only description of the server's side available. 73 checks:

- msgpack — 16 real frame shapes, each checked three ways: shim-encoded then
  decoded by the game's decoder, game-encoded then decoded by the shim's, and
  **byte-for-byte identical** encodings.
- opcode tables — 11 fixed seeds plus 2000 random ones, against the bundle's
  own `Po`.
- signature — sha256 across block boundaries against the bundle's `Vt`, plus
  the published vectors for `""` and `"abc"`; truncated HMAC over 500 random
  key/frame pairs against the bundle's `Eo`, and an over-length key.
- session — a full connection driven through the shim: `io-init` arriving with
  `mode` cleared and the socket id intact, an incoming opcode translated back
  to its name, outgoing frames renumbered from 1 and signed so the bundle's own
  `Eo` verifies them, an unknown name dropped without a gap in the sequence,
  and a socket that never sent `io-init` left untouched.

That last case is what keeps the mods' own side channels — the party and relay
sockets some of them open — out of the crypto path.

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
