# Novastorm 1.41.4

`Novastorm_1.41.4.user.js` — the "novastorm" client, with the render loop made
survivable. Verified with [`../harness`](../harness/README.md).

## What was checked

Novastorm was run through the same harness as the Whiteout client, against the
failure modes that caused that client's intermittent green screen. It came
through most of them clean:

- **Socket hook** — already hooks `WebSocket.prototype.onmessage` as well as
  swapping the constructor, so it does not depend on winning a load-order race.
- **Packet sequencing** — 60 frames on the wire, none rejected by a server that
  verifies signature, opcode and sequence the way the real one does. It already
  warns when a second client would open a competing sequence counter.
- **Image draws** — the unguarded `drawImage` calls take sprites built from
  local canvases (`getItemSprite`), and everything from the network is behind an
  `isLoaded` check. It also loads no third-party image hosts, which is what made
  the equivalent draws in Whiteout fail intermittently.

## What was fixed

**A single exception ended the render loop permanently.** `doUpdate` finished
with its own reschedule:

```js
function doUpdate() {
    ...
    updateGame();
    scheduleFrame(doUpdate);   // never reached if updateGame throws
}
```

So any throw inside `updateGame` — one bad sprite, one unexpected packet, one
undefined field on a player — meant `scheduleFrame` was never called again. The
loop stopped for good and the canvas froze on its last frame. Nothing recovers
from that except a reload, and the console shows one error that scrolls away.

The reschedule now happens in a `finally`, so the loop outlives a bad frame. Two
details worth keeping:

- It still runs *after* the frame's work, so `scheduleFrame`'s pacing maths
  against `frameStart` is unchanged — moving it to the top of the function would
  have made every frame wait a full interval.
- The canvas is unwound to its base state first. A throw between `save()` and
  `restore()` leaves the transform and alpha where the dead frame left them and
  the saved-state stack a level deeper each time, so without this the picture
  stays corrupt even once the loop is running again.

Faults are reported once each through `reportFault`, rather than sixty times a
second.

`../harness/chaos.js` demonstrates the difference: with a transient fault
injected mid-frame and then cleared, the loop used to stay dead (`drawing=no`)
and now comes back.

## Not fixed

- Two copies of the script on one page throw inside novastorm's own
  `window.WebSocket` replacement, which calls into its connect path from the
  constructor. It already warns about running two clients at once; making a
  duplicate stand down cleanly, as the Whiteout client now does, would be a
  separate change.
