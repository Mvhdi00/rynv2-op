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
ships as an ES module, which is what its WebSocket capture races against — and
the geometry of the two elements whose size changes what a client can do: the
canvas, and the transparent full-screen layer mouse input is bound to. Left in
normal flow that layer has no area, and the harness reports actions as unsent
that a player can perform perfectly well. Everything else is unstyled, and
sprite hosts are unreachable from the sandbox, so every run is also a test of
the client with every image broken.

It deliberately does **not** synthesise ids the client builds for itself. A mod
menu creates its own controls at runtime — real checkboxes, read back by id
every tick — and a placeholder div for each of those puts a second element with
the same id earlier in the document. `getElementById` answers with the
placeholder, so every `.checked` read comes back `undefined`, every feature
tests as off, and a check for "is the menu built" finds an empty one. The
harness reported a mod layer as missing while it sat right there with 84 toggles
in it. Ids emitted by `createToggleSlider` and friends are left to the client.

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
node packet-layout.js         # a client's packet field layouts vs the game's own
node spawn-check.js           # for clients that open their own socket
node boot-check.js            # can the real Play button reach a connection
node reconnect-check.js       # is the second connection as good as the first
node canvas-owner.js          # is anything else painting the game canvas
node tick-survives.js         # can one bad player blank the whole world
node input-check.js           # do moving, attacking and building reach the server
node silence-check.js         # can the client still talk after the server stalls
node features-check.js        # do the mod's own per-tick features actually run
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

### `spawn-check.js`, `boot-check.js`, `reconnect-check.js`

For a client that carries its own copy of the game and opens its own socket.
`play.js` opens the socket itself, which suits a client that hooks
`window.WebSocket`; a client that connects on its own never sees that socket and
sits on its menu proving nothing. These three redirect every socket the page
opens to the mock instead, so the client's own connection is the one under test,
and they tell the two programs on the page apart — both open sockets, so
counting them proves nothing.

`spawn-check.js` drives a whole session: through the client's real captcha gate,
into the world, then samples the canvas where your character should be. The mock
server it runs against only puts you in the world once it accepts a spawn frame
it can verify, as the real one does — spawning on a timer instead made a client
that never sent a valid spawn look exactly like one that did.

```
  frames the server accepted: 0 seq=1 [] | M seq=2 [{"name":"","moofoll":1,"skin":0}]
  frames it rejected:         none
  client state: "me": {"sid":1,"x":7000,"y":7000,"visible":true,"alive":true}
```

Against the build that sent its spawn from `onopen`, before `io-init` had given
it a key: `frame shorter than its signature (4 bytes)` and `"me": null`.

`boot-check.js` is the only one that goes through the Play button rather than
calling the gate directly, so it covers the part of the boot that has to wire
the button at all — under four states of the FRVR SDK the page hands over. It
serves the page under the game's own hostname, because on `127.0.0.1` a client
may take a localhost shortcut that skips the captcha gate and the server list
and so tests a path no player is on. Two faults in this test hid a real one for
several rounds: that hostname, and `assets/frvr-stub.js` running after the test
had staged its SDK mode and overwriting it, so all four modes were really the
healthy one. The stub now stands aside when a mode is staged.

`reconnect-check.js` connects, drops the socket and connects again. The signing
key, both opcode tables and the sequence number belong to one connection;
carrying them into the next signs with a key the server never issued, and the
client then looks connected while doing nothing.

### `canvas-owner.js`, `tick-survives.js`, `input-check.js`

Three ways a client can be connected and still show you nothing.

`canvas-owner.js` asks who is painting `#gameCanvas`. A client that carries its
own copy of the game does not replace the page's bundle — it runs beside it, and
both draw. Counting sockets says nothing because both open one, so this
attributes every full-canvas fill to the program that made it, and separately
samples each frame for your body in the middle. A draw to a canvas no longer in
the document is reported as such rather than counted.

`tick-survives.js` puts a malformed record *ahead* of yours in a player update.
The handler is async, so a throw in it is an unhandled rejection — easy to
filter away, and it abandons the rest of the loop, leaving every player after
the bad one unmarked and undrawn. The server keeps ticking underneath, so the
probe clears everyone, runs exactly one tick, and reads the answer before
yielding.

`input-check.js` presses the keys a player presses and reports the packets the
server accepted, checking for the packet each action is *supposed* to send —
otherwise the aim packets that flow continuously cover for an action that never
happened.

`silence-check.js` has the server stop ticking without closing the socket, holds
input through the stall, and then tries to play again. An outgoing rate limiter
whose counter is only cleared by an incoming packet latches shut here and never
opens: connected, drawing, sending nothing.

`features-check.js` answers a different question: a client can connect, spawn,
draw and move while nothing it was installed for works. Auto heal, the mills,
the buyer and the reloads all live in the tail of one per-tick function, so a
throw part-way down that tail takes every feature below it and leaves the game
looking healthy. It wraps the functions that tail ends with and counts how often
the tick reaches each, so the first one at zero is where it stops — and reports
the real state of the controls those features read.

This is the test the page builder used to make impossible: see below.

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
permutation, 6-byte signed client frames), verifies every frame the client sends
— signature, opcode, strictly increasing sequence — and with `requireSpawn` puts
the client in the world only once it accepts a spawn.

It is not the game. It covers only the packets in `server.js`, and their
*payloads* are the harness's own: the field layouts are checked against
`src/game_index.js` separately, by comparing the strides each client parses them
with. A clean run here means the client loads, connects, spawns, renders and
survives; it is not a substitute for playing.
