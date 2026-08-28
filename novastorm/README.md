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

## Preplace: stability and speed

Two changes, both measured by [`../harness/preplace-bench.js`](../harness/README.md)
against a 0.5 degree reference sweep over 400 random object layouts.

### Item limits were never enforced

```js
let limit = (group.sandboxLimit || 99);   // never looked at group.limit
```

Outside sandbox that made the cap 99 for every group without a `sandboxLimit`
and 299 for the three that have one. The real limits are spikes 15, traps 6,
turrets 2, mines 1, mills 7. The gate never fired, so the placer kept scanning
angles and spending packets on items the server would refuse — which is what
"it sometimes just doesn't place" looks like from the inside. It now reads
`group.limit`, and only prefers `sandboxLimit` when actually in sandbox.

### The angle scan called checkItemLocation 72 times per item

Most of those angles are blocked by a nearby object, and that part is pure
geometry: a placement sits on a ring of radius `35 + item.scale + placeOffset`
around the player and collides with an object wherever it comes within
`item.scale + blockS` of that object's centre — so each object blocks one
contiguous arc of the ring. One circle-circle intersection per nearby object
gives those arcs (ported from Aurora/Robotics' `closestPossibleAngles`), and the
scan then skips the `checkItemLocation` call for every angle inside them.

The arcs also name the exact angles where a placement just grazes an obstacle.
A 5 degree grid only lands on those by luck, so they are added as candidates and
marked `perfect`.

| | before | after |
|---|---|---|
| `checkItemLocation` calls | 28,800 | **5,112** (17.8%) |
| valid angles wrongly skipped | — | **0** |
| scenes where the 5° grid found nothing but a placement existed | 6 of 288 (2.1%) | **0** — arc edges found all 6 |

The safety row is the one that matters: the geometry is only allowed to *skip*
work, never to decide. It mirrors `checkItemLocation`'s object test exactly and
each blocked arc is shrunk slightly, so a borderline angle is still handed to
`checkItemLocation` rather than discarded. Water and item limits are not
angular, so every angle the geometry calls free is still verified the old way.
If the geometry throws for any reason, the scan falls back to checking all 72.

## Not fixed

- Two copies of the script on one page throw inside novastorm's own
  `window.WebSocket` replacement, which calls into its connect path from the
  constructor. It already warns about running two clients at once; making a
  duplicate stand down cleanly, as the Whiteout client now does, would be a
  separate change.
