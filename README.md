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

# Whiteout

A second client in this repo, and a separate build: **`Whiteout_Fixed.user.js`**,
produced from `src/Whiteout_Abdo.js` by `tools/fix-whiteout.js`.

Whiteout had the same problem Luna has — it was written against the wire format
the game used before the current transport — but unlike Luna it is a userscript
that rides on top of the live bundle rather than a fork of an old one, so it
could be brought forward instead of ported.

## What was wrong

**The wire format.** Whiteout read and wrote plain msgpack `[letterOpcode, args]`
in both directions. The current bundle negotiates a transport in `io-init`:

```
io-init -> [socketId, tableSeed, hmacKeyHex, mode]
```

and when `mode === 1`, every client frame becomes

```
[6 bytes of HMAC-SHA256(key, payload)][payload]
payload = msgpack([permutedOpcode, args, sequence])
```

with both opcode alphabets permuted per connection from `tableSeed`, and server
frames carrying the permuted number where the letter used to be. Whiteout was
decoding signed frames as if the signature were part of the message, and then
re-encoding plaintext over a connection the server expects to be signed. The
spawn packet goes through that same path, which is why entry failed before
anything else got a chance to.

**The hook never bound.** The bundle does

```js
const kn = window.WebSocket, Ri = window.WebSocket.prototype.send;
```

as it loads, and sends every frame through that captured `Ri`. Whiteout had no
`@run-at`, so it ran at document-end — after the bundle had already taken its
copy. Its outgoing hook was never called.

**io-init was never seen.** The socket was captured on the first *outgoing*
packet, but nothing is sent until the player presses Play, long after `io-init`
has come and gone. Even with the framing fixed there would have been no key.

**msgpack came off greasyfork** via a `<script>` appended to `document.body` —
impossible at document-start, and a race against the first packet even at
document-end.

## What the fix does

The transport is not reimplemented. `tools/fix-whiteout.js` slices the msgpack
codec out of `src/game_vendor.js` and the signing, hashing and opcode-permutation
functions out of `src/game_index.js`, both verbatim, and builds a `WhiteoutNet`
prologue around them. Frames are therefore built by the same code the game builds
them with — `tools/verify-whiteout.js` checks that byte for byte.

| | Before | After |
|---|---|---|
| Frame format | plain msgpack | permuted opcode, sequence, HMAC prefix |
| msgpack | fetched from greasyfork | bundled from the game's vendor chunk |
| Hook timing | document-end (too late) | document-start trampoline |
| Socket capture | on first send | on `io-init`, from a constructor hook |
| Sequence numbers | — | one gate, gap-free across drops |

The script runs at document-start now, so the body — which reads `window.config`,
published on the bundle's last line — is wrapped and run on `DOMContentLoaded`,
exactly where document-end used to put it. Only the transport runs early.

Every outgoing frame passes through one gate, so dropping a packet in the
client's filter does not leave a hole in the sequence the server is counting.

### Also corrected

- **`window.leave`** sent an opcode called `"kys"` with a joke payload, on the
  theory that an unparseable packet gets you dropped. Nothing outside the
  alphabet can be encoded now, so it was a no-op; it closes the socket instead.
- **The bot section** was still on the opcode set from two protocols ago — `"a"`
  for movement, `"G"` for item select, `"d"` for attack, where the current
  alphabet has `"9"`, `"z"` and `"F"`, and `"1"` for setupGame where it is now
  `"C"`. It also gets its own crypto state, since it is a second connection with
  its own `io-init`. Note that this whole section sits inside a block comment in
  the base client (`/** APPLY SOCKET CODES`) and does not run as shipped; the
  edits are there so it is correct if it is ever uncommented.
- **`packet("B")`** in `receiveChat` is a booby trap a remote player can spring
  by saying the right thing — `"B"` is a *server* opcode, so sending it broke
  your own connection. It has no client encoding, so it is now dropped. Left in
  place, and asserted as dropped by the verifier, rather than quietly deleted.

---

## Layout

```
ReUp_Mix.user.js          ReUp Mix build output — the script to install
Whiteout_Fixed.user.js    Whiteout build output — the script to install
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/Whiteout_Abdo.js      Whiteout client (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js  -> ReUp_Mix.user.js
tools/fix-whiteout.js     src/Whiteout_Abdo.js  -> Whiteout_Fixed.user.js
tools/verify-whiteout.js  built client's transport vs. the game bundle
```

## Build

```sh
node tools/extract-drivers.js    # refresh drivers from src/game_*.js
node tools/build-reup.js         # produce ReUp_Mix.user.js
node tools/fix-whiteout.js       # produce Whiteout_Fixed.user.js
```

Every edit in both builds is anchored to an exact string in its base client,
and an anchor that is missing or ambiguous fails the build. Dropping in a newer
base will surface as a build error rather than a half-converted script.
`fix-whiteout.js` additionally parses its own output before writing it — large
stretches of the Whiteout source sit inside block comments, so an edit that
landed in one and carried a comment terminator would take dead code live.

## Verification

```sh
node tools/verify-drivers.js ReUp_Mix.user.js
node tools/check-hooks.js ReUp_Mix.user.js     # needs: npm i --no-save terser
node --check ReUp_Mix.user.js

node tools/verify-whiteout.js                  # Whiteout_Fixed.user.js
```

`verify-whiteout.js` reconstructs the bundle's own `O.send` from
`src/game_index.js` and compares it against the built client frame by frame,
rather than only checking that the file parses. It covers the hooks, the
`io-init` handshake, byte-identical signed frames, sequence numbering across a
dropped packet, round trips in both directions, opcode coverage against both
alphabets, and the full entry path from spawn to wire. 25/25 checks pass.

Current state of the ReUp Mix build:

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
