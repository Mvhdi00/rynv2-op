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

Fixing it means porting that transport in — seeded opcode permutation both ways,
truncated HMAC-SHA256 frame signatures, sequence numbers, and numeric-to-letter
opcode mapping on the way in. `../harness/protocol.js` validates all of it
against a server that enforces the same rules, so the work is checkable; but it
is a rewrite of the client's network layer, not a patch, and the packet field
layouts behind it may have drifted too.

## Not fixed

- The old transport, above.
- It runs at `document-idle` and carries its own copy of the game, so the page's
  own bundle runs alongside it. That is what keeps the DOM working while the
  canvas does not, and untangling it is part of the same job.
