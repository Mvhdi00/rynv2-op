# Client harness

Runs a moomoo.io userscript client in a real browser against a mock moomoo.io
page and a mock game server, and reports what it draws and what it throws.

Every script takes an optional client path and defaults to
`../whiteout/Whiteout_v4_1.user.js`:

```sh
node build-page.js ../novastorm/Novastorm_1.41.4.user.js   # page ids come from the client
node play.js       ../novastorm/Novastorm_1.41.4.user.js
```

Rebuild the page whenever you switch clients — it is generated from the element
ids that client reaches for.

The green-screen bugs this was built for could not be found by reading: one only
appears when the userscript loses a load-order race, the other only when a
sprite host is unreachable. Both are one line in a console the player never
opens. The harness makes each of them a reproducible pass/fail.

## Setup

```sh
npm install          # playwright, ws, @msgpack/msgpack, jquery
node build-page.js   # synthesises index.html and copies the bundles from ../../src
```

`build-page.js` builds the page from the element ids `src/game_index.js` and the
chosen client actually reach for. It reproduces script types and load order — the game
ships as an ES module, which is what its WebSocket capture races against — but
not layout or art. Sprite hosts are unreachable from the sandbox, so every run
is also a test of the client with every image broken.

## Running

```sh
node play.js                  # normal load order
node play.js "" native        # userscript injected late (see below)
node chaos.js                 # transient mid-frame fault, then recovery
node protocol.js              # what the client puts on the wire
node sole-sender.js           # only one packet sequence per socket
node preplace-bench.js        # preplace angle search: safety, cost, coverage
node retrap.js                # instant retrap: does the break get answered, how fast
node item-limits.js           # placement caps vs the game's own rule
node loop-alive.js            # counts the render loop's own reschedules
node transport-check.js       # a client's wire format vs the game's own
node spawn-check.js           # for clients that open their own socket
```

Each script installs the client the way its metadata block asks — a
`@run-at document-start` script goes in before the page's own scripts, anything
else after load. Injecting one the way the other expects produces failures that
belong to the harness, not the client.

`play.js` prints the distinct colours sampled off the canvas — a live world is
~15-20, an empty green one is 1 — followed by every page error and console
warning, deduplicated.

### `native` mode

The game bundle snapshots `window.WebSocket` into a module-local on its first
line, then locks the property so it cannot be re-hooked. `native` opens the game
socket through a constructor captured *before* the client ran, which is exactly
what happens when the userscript manager injects a moment late. Before the fix
this printed `distinctColours: 1` and no errors at all: a silent, perfectly
uniform green screen.

### `chaos.js`

Injects a throw into the render loop after a `ctx.save()` and before its
`restore()` — the shape the `bowTie` draw had — holds it for a second, then
clears it. It reports colour count *and* whether the canvas is still changing,
because a wedged loop leaves the last good frame on screen and still looks rich:

```
  before fault         colours=20 drawing=yes
  during fault         colours= 3 drawing=no
  after fault cleared  colours=18 drawing=yes
  recovered: YES
```

Run it against the pre-fix script and `after fault cleared` stays
`drawing=no` — the leaked save-stack means one bad frame is permanent.

Canvas liveness is only a proxy, though: a client sitting on a menu barely
animates, so two samples can match while the loop is fine. Where the client
exposes its frame scheduler on `window`, `loop-alive.js` counts calls to it
instead and answers the question outright:

```
  frames per 500ms, before fault: 31
  during fault:                    0
  after fault cleared:             0
  loop survived: NO — the loop is dead
```

### `protocol.js` and `sole-sender.js`

The mock server verifies client frames the way the real one does — signature,
opcode, strictly increasing sequence — and with `strict` it closes on the first
frame it cannot verify, which is what a player sees as `disconnected`.

`protocol.js` reports what the client sends and whether any of it is rejected.

`sole-sender.js` covers the case that actually caused a disconnect: two things
sending on one socket. It runs three arrangements — one client, two copies of
the client, and a client that lost the race to a game bundle that sends past it
through a pristine `WebSocket.send` — and all three must end with the
connection alive:

```
  solo       frames=  3 rejected= 0 closed=no  colours=20 OK
  duplicate  frames=  3 rejected= 0 closed=no  colours=19 OK
  late       frames=  8 rejected= 0 closed=no  colours=19 OK
```

Against a build without the stand-down guard, `late` fails with
`sequence out of order (9: got 1, expected 4)`, close code 4001, and
`colours=1` — a green screen and `disconnected`.

### `preplace-bench.js`

Runs the client's own placement geometry against a 0.5 degree reference sweep
over random object layouts. It reports three things: how many
`checkItemLocation` calls the angle scan costs, whether the geometry ever rules
out an angle that reference sweep accepts (must be zero), and how often a 5
degree grid is blind to a gap a placement really fits through.

```
  checkItemLocation, old scan:  28800
  checkItemLocation, new scan:  5112 (17.8% of old)
  valid angles wrongly skipped: 0   <- safe
  scenes the 5deg grid missed:  6 of 288 (2.1%)
  ...of those, arc edges found: 6 (100.0%)
```

Pure geometry, no browser — it lifts the helpers out of the client with `vm` so
the test runs the shipped code rather than a copy.

## Limits

The mock server speaks the real transport (`io-init`, per-connection opcode
permutation, 6-byte signed client frames) and sends enough packets to spawn,
render and tick. It is not the game: it does not validate what the client sends
back, and it covers only the packets in `server.js`. A clean run here means the
client loads, connects, renders and survives; it is not a substitute for
playing.
