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
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
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

---

# YoRHa System — frame rate and performance

`YoRHa_System.user.js` is the YoRHa System 1.5 userscript with its frame rate
unlocked and its render loop cleaned up. Same mod, same features, same look —
only the pacing and the per-frame waste changed. Install it over the old one;
settings carry over.

## What was capping it

The render loop ended in a bare `requestAnimationFrame`, so the browser paced
it: one frame per screen refresh and nothing while the tab is hidden. That is
the "FPS: 60 no matter what" everyone sees on the counter. There were also
three separate `requestAnimationFrame` loops running at once — the game
render, the FPS counter, and the stats line.

## The frame clock

One loop now drives all three, and it picks its own driver from the target:

| Target | Driver |
|---|---|
| V-Sync | `requestAnimationFrame`, exactly as before |
| at or below the screen's refresh | `requestAnimationFrame`, gated to hold the target |
| above it (120 / 144 / 240 / Unlimited) | `setTimeout` + `MessageChannel`, not tied to the refresh at all |

The uncapped driver sleeps until ~2 ms before the frame is due and only then
hands off to the message port, so it hits its target without the busy-spin a
pure `postMessage` loop burns a whole core on. "Unlimited" is capped at 1000
internally for the same reason — past that it would spin waiting for itself.
Frames are due on a fixed grid rather than one period after the last one
finished, which is what keeps the measured rate on target instead of drifting
a few per cent under it.

Measured against a simulated 60 Hz screen: 120 → 120, 144 → 144, 240 → 240,
Unlimited → 987. A frame that takes longer than the target period (10 ms
against a 240 target) settles at a steady 99 fps with no catch-up burst.

Two more things fall out of owning the loop:

- **Frame time comes from `performance.now()`**, not `Date.now()`. At 240 fps
  a frame is 4.17 ms and `Date.now()` can only say 4 or 5 — that rounding is
  visible as micro-stutter in the camera and in every animation. It is also
  clamped at 100 ms, so coming back from a hidden tab no longer teleports the
  world.
- **A throw in the render no longer kills the session.** It used to: the loop
  scheduled its next frame *after* `updateGame()`, so anything that threw
  stopped the loop for good and left the canvas on the last thing painted — a
  solid green screen. Callbacks now run inside a try/catch.

## Menu → Performance

| Setting | Default | |
|---|---|---|
| Frame Rate Cap | 240 FPS | V-Sync / 60 / 120 / 144 / 165 / 240 / 360 / Unlimited |
| Smooth frame pacing | on | sub-millisecond frame time + the spike clamp |
| Keep running when tab is hidden | off | on costs CPU for frames nobody sees |
| Minimap redraw | 60/s | its data only arrives 9 times a second |
| FPS / Ping on screen | on | the counter itself |
| Show frame time (ms) | off | adds `(4.2ms)` next to the FPS |
| Opaque canvas | on | `alpha: false` — reload to apply |
| Low latency canvas | on | `desynchronized: true` — reload to apply |

Both canvas flags are toggles because they are set when the context is created
and a graphics driver is allowed to dislike them. Nothing has ever shown
through the world canvas — the first thing every frame does is fill the whole
surface — so `alpha: false` only removes a blend that was doing nothing.

## Per-frame waste that is gone

None of this changes what is drawn:

- The **stats line** was a template string, a bot-count walk and an `innerHTML`
  reparse on every single frame, for numbers that change once a second. It
  refreshes 5 times a second and only touches the DOM when the text changed.
- The **FPS tracker** for the ping readout was a third render loop pushing a
  timestamp into an array and shifting the expired ones off, every frame. The
  clock already counts frames.
- Both **full-screen gradients** (the day/night vignette and the YoRHa one)
  were rebuilt, colour stops and all, every frame. They only depend on the
  screen size, so they are built once. Verified pixel-identical: not one byte
  of 5.7 million differs.
- The **minimap** was a full clear-and-redraw per world frame.
- **Spike markers** allocated a fresh array of fresh objects every frame,
  including for spikes off screen. Reused array, on-screen only.

## Two "optimizations" that were measured and thrown out

Both looked obviously right and are both slower. Canvas work is queued and only
rasterised at flush time, so a timing loop without a flush measures nothing but
queue insertion — these were re-measured with a `getImageData` forcing the draw:

- **Scanlines as a repeating 1×3 pattern** instead of 360 `fillRect`s: the loop
  costs 0.67 ms, the pattern fill **31 ms**, a pre-rendered full-screen blit
  6.2 ms. A transformed repeating pattern drops the rasteriser onto a per-pixel
  shader over the whole surface; axis-aligned solid rects hit its fast path.
- **Batching the spike dots** into two paths instead of four calls per dot:
  0.26 ms the old way, 0.37 ms batched. A path of 60 subpaths goes through the
  general rasteriser while a lone small circle has a fast path of its own.

Both were reverted. The render path is otherwise within a few per cent of the
original per frame — the frame rate is what changed.
