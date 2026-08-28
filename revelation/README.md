# Revelation

`Revelation.user.js` — the Revelation client, with the render loop made
survivable. Verified with [`../harness`](../harness/README.md).

Unlike Whiteout and Novastorm, this one is not a hook over the shipped bundle —
it carries its own copy of the game and opens its own socket. It also runs at
`document-idle` (no `@run-at` in the metadata block), so it never races the page
for anything.

## What was checked

Run through the same harness as the other two, against the failure modes that
caused their green screens:

- **Item limits** — already correct. Both places that compute a cap apply the
  game's own rule, `sandbox ? (sandboxLimit || max(limit * 3, 99)) : limit`.
- **Packet sequencing** — does not apply. It never hooks `window.WebSocket`, so
  there is no shared socket for a second sequence counter to collide on.
- **Image draws** — most are behind an `isLoaded` check or take a locally built
  canvas. One was not; see below.

## What was fixed

### A single exception ended the render loop permanently

`Uo` finished with its own reschedule:

```js
function Uo() {
    ...
    Of();
    requestAFrame(Uo);   // never reached if Of throws
}
```

So any throw inside `Of` — one bad sprite, one unexpected packet, one undefined
field on a player — meant `requestAFrame` was never called again. The loop
stopped for good and the canvas froze on its last frame, recoverable only by
reloading.

The reschedule now happens in a `finally`, after unwinding the canvas to its
base state — a throw between `save()` and `restore()` otherwise leaves the
transform and the saved-state stack corrupt, so the picture stays broken even
once the loop is running again. Faults report once each rather than sixty times
a second.

Measured by [`../harness/loop-alive.js`](../harness/README.md), which counts
calls to the client's own `window.requestAFrame` through an injected fault:

| frames per 500ms | before | after |
|---|---|---|
| before the fault | 31 | 30 |
| during the fault | **0** | 30 |
| after it clears | **0 — dead for good** | 31 |

### Minimap icons never appeared, and leaked

`lf` built a fresh `Image` for every broken object on every frame and drew it in
the same breath:

```js
let image = new Image();
image.src = imgURL;
ce.drawImage(image, ...);
```

Decoding is asynchronous even for a data URI, so the draw always came too early
and the icon never rendered — while a new `Image` was allocated per object per
frame. They are now decoded once, cached by url, and drawn only once actually
drawable.

### The dead `@require`

The metadata block requires msgpack-lite from `rawgit.com`, which shut down in
2019. The browser console says so outright:

```
@require: couldn't load @require from URL
'https://rawgit.com/kawanet/msgpack-lite/master/dist/msgpack.min.js': internal error
```

`window.msgpack` is therefore undefined, and the bot socket paths that call it
(`ws.send`, `ws.onmessage`) throw. Nothing external was needed: the client
already carries a working msgpack codec for its own connection (`ql` / `Wl`), so
`window.msgpack` now falls back to that when the require is missing.

This does **not** explain the missing character — the main client never touches
`window.msgpack`. See below.

## The missing character

The client draws its themed world but not your player, while the leaderboard,
resources and age bar keep updating. Those two halves come from two different
programs.

**Revelation speaks the old protocol.** The live game negotiates a per-connection
opcode permutation from the `io-init` seed and prefixes every client frame with
six HMAC bytes. Revelation's socket handler does neither:

```js
const l = Wl.decode(a);
const c = l[0];
if (c == "io-init") { s.socketId = a[0]; }   // ignores seed, key and mode
else { i[c].apply(undefined, a); }            // c is a number now, not a letter
```

None of the transport's fingerprints are present anywhere in the file:

| | table salt | c2s alphabet | SHA-256 constants |
|---|---|---|---|
| the shipped game | yes | yes | yes |
| Novastorm | yes | yes | yes |
| Whiteout | yes | yes | yes |
| **Revelation** | **no** | **no** | **no** |

So its connection cannot carry game state, and `E` — your player — is never
populated from the wire. What still works on screen is the page's *own* game
bundle, which does speak the protocol and keeps running because this script is
`document-idle` and blocks nothing: the leaderboard, resources and age are its
DOM, while the canvas underneath is Revelation's.

This is the same position Luna 1.1 is in, as the top-level README describes: a
fork of an older bundle that predates the current transport.

### The transport, ported

The transport block is lifted verbatim out of `src/game_index.js` — the salt,
both alphabets, the seeded Fisher-Yates permutation, SHA-256, the truncated HMAC
and the hex reader — and wrapped in a closure so the game's short names do not
collide with this file's own. Three edits wire it in:

- `io-init` now builds the connection state from the seed, key and mode instead
  of reading the socket id and throwing the rest away.
- Incoming opcodes are numbers on this server; they are mapped back through the
  s2c table to the letter the handler table is keyed on, and an unrecognised one
  is ignored rather than dereferenced.
- Outgoing frames are `[opcode, args, ++seq]` with the six signature bytes in
  front. The frame is built at the moment of sending, not at the top of `send`,
  because a sequence number must not be minted by a call that then returns early.

[`../harness/transport-check.js`](../harness/README.md) runs the ported code and
the game's own side by side:

```
  s2c handlers:             36 of 36, complete
  signature width and mode: match
  opcode tables compared:   200 seeds x both directions
  signatures compared:      200
  byte-for-byte identical to the game's own transport
```

The handler count matters as much as the bytes: a correct transport still
delivers nothing if the client is keyed on a different opcode set. Every letter
the server can send has a handler, and no handler waits on a letter it cannot —
so the packet vocabulary was already current, and only the transport was missing.

### playerUpdate threw before the player existed

With the transport working, `../harness/spawn-check.js` could finally drive a
real session — and it surfaced a second fault straight away:

```
Cannot read properties of undefined (reading 'd1')
```

`playerUpdate` runs on every tick and its tail dereferences `E`, the local
player, four times. But an update can arrive before the packet that creates
them — on join, and again on every respawn. Worse, `playerUpdate` is `async`, so
the throw surfaced as an unhandled rejection rather than an error anyone would
see, and it took the rest of the tick's state update with it: `renderObjects`,
`nearObjects` and the pathfinder position all stayed stale, so the world kept
drawing from old data while the player never appeared.

It now returns early when there is no local player yet.

### It never opened a socket at all

With the transport in and the tick no longer dying, the client still sat there:
world drawn, nobody in it, no movement, no building, nothing. The reason was
upstream of all of it — `ee.connect` was never reached.

The gate:

```js
if (Eh || ls) {
  if (code) { gn("alt:" + code); }   // no token, no connection, no message
}
```

`code` is the captcha token, and two separate things stopped it ever being set:

1. It was wired up inside a `window` `"load"` listener — but this script runs at
   `document-idle`, by which time `load` has already been and gone, so the
   listener never ran.
2. Even had it run, it looked for a `#altcha` element. The site moved to
   Cloudflare Turnstile; that element no longer exists.

And the prefix was wrong for the new one either way: Turnstile tokens go out as
`cf:`, not `alt:`.

So the client wrapped `window.onGotTurnstileToken` — the function the game
itself is handed the token through — to take a copy on the way past, remembers
which captcha it came from so the prefix is right, wires the altcha path
immediately when `load` has already fired, and connects without a token rather
than silently doing nothing when the page never produces one.

`../harness/spawn-check.js` drives the real gate, handing the page a Turnstile
token the way the game does and then pressing Play:

| | before | after |
|---|---|---|
| captcha token | `absent` | `stub-token`, kind `cf` |
| transport state | `null` | key and both opcode tables |
| local player | `null` | `{sid: 1, visible: true, alive: true}` |
| **sockets opened** | **0** | **1** |

Zero sockets is the whole symptom: nothing to see, nothing to move, nothing to
build.

### It spawned before it had a transport

With the socket open the client still put nobody in the world. The reason is one
line out of place.

The game reports its connection open from *inside* the `io-init` branch:

```js
if (m === "io-init") {
    s.socketId = g[0],
    Z = { key: Ro(g[2]), tables: Po(g[1] >>> 0), seq: 0 },
    o || (o = !0, t());     // here — and onopen does not call t()
    return
}
```

Revelation called it from `onopen` instead. `onopen` fires before the first
message, so the callback ran with no key, no opcode tables and no sequence
number — and the first thing that callback does is `bs()`, which sends the spawn
packet. `revNetFrame` has no state to build a frame from at that point, so the
spawn goes out in the pre-2023 format: unsigned, unnumbered, addressed by letter
instead of opcode. The server discards it.

Everything downstream follows from that. The socket is open and healthy, the
ping packets that need no player go out and come back, the leaderboard arrives —
but you are not in the game, so there is no character to draw, nothing to move
and nothing to build with. The client shows you the world it is being sent from
outside it.

Two smaller faults in the same object: `onclose` and `close()` left `revNet`
holding the finished connection's key, tables and sequence counter, so a
reconnect signed with a key the server never issued; and nothing stopped a send
before the handshake, which could only ever produce a malformed frame. The key
is now cleared on both paths and frames before `io-init` are dropped rather than
mangled.

The mock server had been spawning the player on a timer, which made a client
that never sent a valid spawn look exactly like one that did. It now waits for a
frame it can verify, as the real one does. [`../harness/spawn-check.js`](../harness/README.md)
against that server:

| | before | after |
|---|---|---|
| spawn frame | `frame shorter than its signature (4 bytes)` | accepted, `seq=2` |
| frames rejected | 2 | **0** |
| local player | `null` | `{sid: 1, x: 7000, y: 7000, visible, alive}` |
| players in the world | 0 | 2 |

And [`../harness/reconnect-check.js`](../harness/README.md), which connects,
drops the socket and connects again:

| session | spawn | rejected | local player |
|---|---|---|---|
| before — #1 | NO | 2 | NONE |
| before — #2 | NO | 2 | NONE |
| after — #1 | accepted | 0 | sid 1, alive |
| after — #2 | accepted | 0 | sid 1, alive |

## What is verified and what is not

A full session against the mock server runs, entered through the client's own
captcha gate and its own Play button: it opens its own socket, negotiates the
signed transport, sends a spawn the server accepts, and draws the world, the
objects, the other player and the health bars, with no page errors and no
rejected frames.

Also verified:

- The transport is byte-identical to the game's over 200 seeds and 200
  signatures, and the handler vocabulary covers all 36 opcodes.
- The bulk packets are parsed with the same field strides as the shipped game —
  player update 13, leaderboard 3, objects 8, animals 7 — so the field layouts
  these handlers expect are the current ones.
- The client reaches a connection whether the FRVR SDK resolves, throws because
  the page's bundle already consumed it, never settles, or is missing entirely.
- The render loop survives a fault.

**Still not verified:** the live server. The mock speaks the same transport and
now enforces it, but its packet *payloads* are still the harness's own. The
startup line `[revelation] build: spawn-after-handshake 2026-08-28` in the
console tells you which build is actually running.

## Not fixed

- It runs at `document-idle` and carries its own copy of the game, so the page's
  own bundle runs alongside it — which is why the leaderboard and resources kept
  working while the canvas did not. Both now speak the protocol, so they will
  both connect. Blocking the page's bundle needs `@run-at document-start` and
  script interception, as the Whiteout client does, and is its own change.
