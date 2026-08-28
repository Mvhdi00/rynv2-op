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

## What is verified and what is not

Verified here: the transport is byte-identical to the game's, the handler
vocabulary is complete, the client loads and renders without errors, and the
render loop survives a fault.

**Not verified here:** an actual game session. Revelation only connects after a
Cloudflare Turnstile token, which this sandbox cannot produce, so no socket is
ever opened and the in-game path stays untested. The transport is proven correct
in isolation; whether the packet *payloads* behind those opcodes still match
what this client's handlers expect can only be settled by playing it.

## Not fixed

- It runs at `document-idle` and carries its own copy of the game, so the page's
  own bundle runs alongside it — which is why the leaderboard and resources kept
  working while the canvas did not. Both now speak the protocol, so they will
  both connect. Blocking the page's bundle needs `@run-at document-start` and
  script interception, as the Whiteout client does, and is its own change.
