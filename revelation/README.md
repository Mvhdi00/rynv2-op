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

## Not fixed

- It runs at `document-idle` and carries its own copy of the game, so the page's
  own bundle runs alongside it. Whether that is intended is a design question
  for the client, not a defect this pass could settle.
- The `@require` points at `rawgit.com`, which shut down in 2019.
  `window.msgpack` is used by the bot socket paths only (`ws.send` / `ws.onmessage`),
  with no fallback, so those paths depend on a script that no longer loads.
  Replacing the dependency is its own change.
