# Whiteout v4

`Whiteout_v4_1.user.js` — the "whiteout abdo" client, with the intermittent
green screen fixed.

This is not part of the ReUp Mix build. It is a separate userscript that keeps
its own copy of the game's msgpack codec and transport (`WhiteoutNet`), renders
the world itself, and disables the game's own render loop by overwriting
`window.requestAnimFrame`. Verified with [`harness/`](harness/README.md).

## The green screen

The reported symptom — *sometimes it works, sometimes the screen stays green and
I can't see anything* — was two unrelated faults that look the same on screen.
Both are silent: nothing appears in the UI, and the game is often still running
underneath, so the player is alive and moving in a world they cannot see.

The reason either one is invisible rather than merely broken is that the client
takes the game's renderer offline. `window.requestAnimFrame = () => null` stops
the bundle's loop, so the client's own loop is the only thing drawing. If that
loop stops producing frames, nothing else picks up the slack.

### 1. The socket hook lost a load-order race

`WhiteoutNet` hooked the socket by swapping `window.WebSocket`, which only
catches sockets built through the global. The game bundle's first line is:

```js
const kn = window.WebSocket
```

and it later runs `Object.defineProperty(window, "WebSocket", {writable: false,
configurable: false})`. So if the userscript was injected even a moment late,
the swap was both missed — the game builds its socket from its own snapshot —
and unrepairable, because the property is locked by the time the client could
try again. `track()` never ran, `main` was never set, `WS` stayed `undefined`,
and no packet ever reached the client. It sat at the map centre with no player
and no objects, drawing grass: a perfectly uniform green screen, with an empty
console.

Fixed by hooking `WebSocket.prototype` instead — an `onmessage` accessor and an
`addEventListener` wrapper, both of which register the tracker before the page's
own handler. The socket is now caught by how it is *used*, so load order stops
mattering. The constructor swap is kept as well; it is harmless when it wins.

That alone is not enough, though — see below.

### 1b. …and then the connection was dropped instead

Reading the stream late is safe. *Sending* late is not, and fixing only the
first turned the green screen into an immediate `disconnected`.

Every frame carries a sequence number the server verifies. Normally the game
bundle's own packets are routed through this client's gate, which renumbers
them, so one counter covers the socket. But the bundle captures
`WebSocket.prototype.send` on its second line:

```js
const Ri = window.WebSocket && window.WebSocket.prototype.send;
```

If it captured that before the client replaced it, the bundle sends through the
pristine builtin — past the gate, with a counter of its own. Two counters both
starting at 1 on one socket means duplicate sequence numbers, and the server
closes with code 4001 the moment the player spawns.

So the client now decides, before hooking anything, whether it can be the only
thing sending:

- **another copy of the script is already running** — stand down completely,
  installing no hooks at all. Two copies would collide the same way.
- **the game bundle already ran** (`window.loadedScript` / `window.config` are
  set) — it holds a `send` this client cannot route, so this page load is
  render-only: the world is still drawn, but the client opens no sequence of
  its own. Reloading usually wins the race.

Both say so in the console rather than failing quietly, and socket closes now
report their code and reason, so `disconnected` is no longer opaque.

`harness/sole-sender.js` checks all three arrangements against a server that
enforces sequencing the way the real one does.

### 2. A broken image killed every frame

`drawImage` throws `InvalidStateError` when handed an image that failed to load.
`renderPlayers` drew the `bowTie` sprite with no guard, and that sprite comes
from a third-party image gallery — as do the `astolfo` sprites and the texture
pack. When one of those hosts is down, rate-limiting, hotlink-blocking or
filtered, the throw lands mid-frame, and everything the renderer had left to do
is skipped: game objects, map boundaries, day/night shading, health bars, names,
chat, the minimap. What survives is `drawBackground`. Green.

That is the "sometimes" — it depends on whether a third-party host answered.

Fixed by routing every unguarded draw through `canDraw()`, which accepts local
canvases and requires `complete && naturalWidth > 0` of an image, and by giving
the remote sprites an `error` handler so a failure is remembered rather than
retried every frame. Sprites already guarded by `isLoaded` were left alone.

`generateCompositeImage` had the same shape of problem from the other side: it
called `toDataURL()` on a canvas that a cross-origin sprite had tainted, which
throws. It now returns the canvas itself, which is drawable either way.

### Why it stayed green

Both faults threw *between* `ctx.save()` and its matching `restore()`. The
canvas keeps the transform and alpha the dead frame left behind, and the
saved-state stack grows one level deeper every frame. So even after the
underlying cause cleared — the image finally loaded, the packet finally
arrived — the loop kept drawing into a corrupted state and never came back.

`doUpdate` now unwinds to the base state in a `finally` and contains the frame's
exceptions, so each frame is independent of the last. `chaos.js` demonstrates
the difference: with a transient fault injected and then cleared, the old script
stays frozen and the fixed one resumes.

## Other fixes

- **`addPlayerToList` threw on every tick.** It referenced an undefined
  `tmpObj`, a leftover from the copy it was adapted from. The `ReferenceError`
  escaped `updatePlayers` as soon as another player came near — so the whole
  second half of the tick, including the automation, silently stopped. It also
  tested `player.team` while printing `plyr.team`; both now read `plyr`.
- **Packet handlers are contained.** A throw inside one handler used to escape
  the socket listener, where it was invisible. `getMessage` now catches, and
  reports through `reportFault`.
- **Faults are reported once.** `reportFault` prints one `[whiteout]` line per
  distinct fault. Anything failing once a frame would otherwise print sixty
  times a second.

None of this changes what the client does when things are working — the fixes
only cover paths that previously ended in an exception.

## Not fixed

- The client still needs `window.config`, `$` and the game's DOM from the page,
  so it remains coupled to the shipped bundle.
- The dead scan for `index-f3a4c1ad.js` in `whiteoutMain` was left in place. It
  runs at `DOMContentLoaded`, by which time a module script has long executed,
  so removing the element does nothing — and it must do nothing, since the
  client depends on that bundle having run. It is inert either way.
- `renderProjectiles(1, xOffset, yOffset)` passes three arguments to a
  two-parameter function, so projectiles render at the wrong offset. It is a
  real bug, unrelated to the green screen, and fixing it changes what the client
  draws rather than stopping it from crashing — left for a separate change.
