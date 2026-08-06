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

---

## Legacy clients (`clients/`)

Six older moomoo clients are kept here, each in two versions: the script as it
was written in `clients/original/`, and a version fixed against the current game
in `clients/`. Install the ones in `clients/`.

None of them could connect as shipped. They were all written against the old
transport — plain `msgpack([type, args])` frames, string packet names in both
directions, and a `WebSocket.prototype.send` patch installed after page load.
Every one of those three assumptions is now wrong.

| | fixed |
|---|---|
| `aurora_v5.5.user.js` | Aurora Client v5.5 |
| `chocolate_illusion.user.js` | 18k chocolate mod / illusion mode |
| `porshe_client_v1.user.js` | Porshe Client v1 |
| `project_aurora_v2.2.user.js` | project aurora v2.2 |
| `project_zelta_reborn.user.js` | Project Zelta Reborn |
| `robotics_blood_v1.user.js` | Robotics Blood v1 |

### What was wrong

**Entry.** The bundle takes its own copy of `WebSocket.prototype.send` while it
evaluates and sends through that copy (`saved.call(socket, frame)`). A patch
installed at `document-idle` — which is when a userscript runs by default — is
therefore never called for a single game packet, no matter that it is sitting on
the prototype. It also freezes `window.WebSocket` with a non-configurable
`defineProperty`, so a client reassigning it later gets a silent no-op or, under
strict mode, a throw that takes the rest of the script with it.

**Packets.** `io-init` now carries `[socketId, seed, keyHex, mode]`. In mode 1
the client permutes the c2s/s2c name alphabets from `seed`, and every frame it
sends is `msgpack([opcode, args, seq])` behind 6 bytes of HMAC-SHA256 over that
payload. Frames from the server arrive with numeric opcodes. So each of these
clients was decoding a signed frame as if it were bare msgpack, re-encoding it
unsigned and unsequenced, and looking up numeric packet types in a table keyed
by letters.

**Requires.** Four of them `@require` msgpack from `rawgit.com`, which shut down
in 2019 and serves nothing. Two more inject the same dead URL as a `<script>` at
runtime. That is why `msgpack` was undefined in scripts that never declared it.

### The fix

`src/moo-transport.js` is spliced into each client ahead of its own code and
runs at `document-start`, before the bundle evaluates. It carries the negotiated
opcode tables, the SHA-256/HMAC signature, and its own msgpack, and it presents
the *old* protocol to everything above it:

```
bundle  --[signed frame]--> shim --[msgpack([name,args])]--> client hook
client hook --[msgpack([name,args])]--> shim --[signed frame]--> network
network --[numeric opcode]--> shim --[msgpack([name,args])]--> client listeners
```

So the clients' own packet code is untouched — including their packet-name
aliasing layers, their bot sockets, and the packets they choose to drop. Frames
are renumbered from the shim's own counter, so a dropped packet does not leave a
hole in the sequence the server sees, and the first packet on a connection is
still `seq` 1.

Around that:

- the client body is deferred to `DOMContentLoaded`, which is where it used to
  run, so moving the script to `document-start` changes nothing else about it;
- `window.WebSocket` is installed as a non-configurable accessor, so the
  bundle's own lockdown fails inside its `try/catch` instead of freezing the
  constructor out from under the client;
- the game socket is identified by endpoint, not by creation order, so a chat
  relay opened before the user hits play cannot take its place;
- dead rawgit URLs are repointed at cdnjs, and a client with no working msgpack
  at all gets the shim's;
- the bundle's `setInterval(… debugger …)` loop and its "disable your extension"
  banner are dropped.

A client that owns its socket instead of hooking the bundle's — the chocolate
mod is a fork of the old bundle — marks it with `__mooTransport.legacy(socket)`
so it keeps receiving legacy frames too. Servers that negotiate mode 0 (private
servers) keep the plain framing untouched.

### Rebuilding them

```sh
node tools/patch-clients.js     # clients/original/*.user.js -> clients/*.user.js
node tools/verify-clients.js
node tools/test-transport.js
```

`patch-clients.js` anchors every edit to an exact string and fails the build if
an anchor is missing or ambiguous, so nothing is ever half-patched.
`verify-clients.js` re-checks each output: it parses, it runs at
`document-start`, the shim is present and installs before the client touches
`WebSocket.prototype`, no rawgit URL survives, and the client's own body is
carried over byte for byte apart from the declared edits.

`test-transport.js` is the one that matters. It lifts SHA-256, the truncated
HMAC and the seeded table builder straight out of `src/game_index.js` and
compares them against the shim's (500 random seeds for the tables, block-boundary
lengths for the hash), round-trips the shim's msgpack against the bundle's own
codec in both directions, and then drives the whole path end to end against a
transcription of the bundle's `io.send` — checking that what reaches the wire
verifies under the connection key, maps back to the right packet name, keeps its
arguments, and stays consecutively numbered when the client drops a packet.

---

## Layout

```
ReUp_Mix.user.js          the build output — this is the script to install
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
src/moo-transport.js      transport shim spliced into the legacy clients
clients/*.user.js         the fixed legacy clients — these are the ones to install
clients/original/         the same clients as they were written (input)
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/patch-clients.js    clients/original -> clients, with the transport shim
tools/verify-clients.js   patched clients vs. their sources
tools/test-transport.js   the shim vs. the game bundle, primitives and end to end
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
