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

### The page's own game was drawing on the same canvas

This client carries its own copy of the game and runs at `document-idle`, so the
page's bundle is still there and still running. It never enters a game — this
client wins the Play button — so it sits on its menu forever, and a moomoo menu
backdrop is the world plus a 35% dark wash across the whole canvas, painted
every frame. Both programs draw `#gameCanvas`.

Counting sockets said nothing, because both open one; counting draws does.
[`../harness/canvas-owner.js`](../harness/README.md) attributes every
full-canvas fill by where it came from:

| over 2.5s | before | after |
|---|---|---|
| full-canvas draws by this client | 750 | 750 |
| full-canvas draws by the page's bundle | **300** | **0** |
| draws that never reach the screen | 0 | 300 |

Both programs take `getContext("2d")` once and keep it, so this client now
swaps the canvas element for a fresh one before taking its own reference. The
page's context still points at the old canvas, which is no longer in the
document, and everything it draws goes nowhere.

Worth being exact about what this did and did not explain: in the harness the
client happened to draw last, so the character survived either way. Which loop
draws last depends on registration order, and the page's fill is opaque — where
it lands second it erases the frame beneath it, character included. That was
worth removing whether or not it was the fault on any particular machine.

### One player's data could blank the whole world

`playerUpdate` is the tick everything hangs off. It marks who is on screen,
refreshes every player's derived state, and then rebuilds the object lists, the
pathfinder position and the bot state — and it is `async`, so a throw anywhere
inside it became an unhandled rejection: nothing in the console anyone would
notice, and the rest of the loop never ran.

`reloadWeapon`, called once per player per tick, had two ways to throw:

```js
let { speed } = R.weapons[_.primary];   // undefined index -> destructure throws
...
if (_.sid != E.sid) {                   // E is null before you spawn
```

The index it uses is not the one off the wire — `playerEncounter` resets
`primary` and `secondary` to `null`, and only a later tick fills whichever one
matches the weapon in hand. And `E` does not exist until the packet that creates
you arrives, which is after the first tick on join and on every respawn.

Either throw ends the per-player loop, so **no player after the bad record is
ever marked visible — your own included**. The objects and the leaderboard keep
updating from their own handlers, so the world draws normally with nobody in it
and nothing responding to a key. That is exactly what a player sees and reports
as "I am in the game but there is no one here and I cannot do anything".

The weapon tables themselves are current — 16 weapons, same order as the shipped
bundle, only a cosmetic rename — so the index is not stale; the code simply
never checked. Both lookups are now guarded, the visible flag is set before
anything that can fail, and each player is handled independently.

[`../harness/tick-survives.js`](../harness/README.md) puts a malformed record
*ahead* of you in a tick:

| the record before yours has | before | after |
|---|---|---|
| a weapon index off the end of the table | you are **not** drawn, silently | drawn |
| a weapon index that is not a number | drawn | drawn |
| a null weapon index | you are **not** drawn, silently | drawn |

### The rate limiter could latch shut for good

This is the one that matches "I could move for a second, then no packets".

`send` allows 120 packets a second. The counter it measures against is cleared
in exactly one place:

```js
if (!(tick % 9)) {        // inside playerUpdate — every ninth tick
  packets = 0;
}
```

So the limiter's release depends on the server still talking to you. While ticks
are missing — a stall, a respawn, a moment of loss, a handler that gave up — the
count keeps climbing on whatever you send, reaches 120, and every `send` from
then on returns early. Nothing clears it, because the only thing that could is a
tick you can no longer ask for.

The socket stays open. The render loop keeps drawing. Not one packet leaves
again. From the outside that is a frozen game that still reports itself
connected, and it is exactly as far as you get before it happens: a second or
two of play.

[`../harness/silence-check.js`](../harness/README.md) spawns, has the server go
quiet, holds input through it, then tries to play again:

| | before | after |
|---|---|---|
| limiter counter during the stall | 120 / 120 | 1 / 120 |
| limiter counter after it | **120 / 120** | 2 / 120 |
| packets the server got afterwards | **0** | 5 |

The counter is now also cleared on its own clock, but only once the tick-driven
reset has actually stopped, so normal play keeps the limit it was given.

### The boot chain died on the page's SDK, and took the client with it

The read-out settled it in one line:

```
rev  120 fps   up 0/s   down 0/s   no socket
```

Frames climbing, nothing sent, nothing received, and `no socket` — the initial
value, so `ee.connect` was never reached at all. Meanwhile the player could walk
around and the leaderboard kept updating, because **the game they were playing
was the page's own**. This client had taken the canvas and was painting an empty
world over the top of it.

Everything needed to play hangs off one line:

```js
window.frvrSdkInitPromise.then(() => window.FRVR.bootstrapper.complete())
                         .then(() => $h());
```

`$h()` fetches the server list and calls `Wh()`, and `Wh()` is what puts a
handler on the Play button. No catch, no timeout — and this client runs at
`document-idle`, so the page's bundle has already run the identical line and
already called `complete()`. A second call is not something the SDK promises to
survive, and if `frvrSdkInitPromise` is missing the line throws at the module's
top level and takes the remaining ~15,500 lines with it. The build banner, the
canvas and the captcha wrapper all sit above it, which is why they printed while
nothing below them ever ran.

It now lets the SDK have its turn and boots regardless of how that turn goes,
with a short floor for a promise that never settles.

[`../harness/boot-check.js`](../harness/README.md), clicking the real Play
button under four states of that SDK:

| the page's SDK | before | after |
|---|---|---|
| resolves normally | connects | connects |
| `complete()` throws (already consumed) | **nothing** | connects |
| promise never settles | **nothing** | connects |
| `frvrSdkInitPromise` missing | **died at load** | connects |

This test had been passing all four. Two things were wrong with it: it served
the page from `127.0.0.1`, which trips the client's own localhost shortcut and
skips the captcha gate and the server list entirely; and the page's own
`frvr-stub.js` ran after the test staged its mode and quietly overwrote it, so
every mode was really the healthy one. It now serves under the game's hostname
and the stub stands aside.

### A client with nothing to draw must not take the screen

Taking the canvas outright is right only while this client has a game behind it.
With no connection it has nothing, so it painted an empty world over a game the
player was in the middle of — worse than doing nothing, because it took the
screen from a program that was working.

The page keeps its canvas and keeps drawing on it. This client's canvas now sits
on top, hidden, until `io-init` says there is really a game behind it, and
hidden again the moment the socket closes.

| | before | after |
|---|---|---|
| with no connection | painting over the page's game | `hidden` |
| the page's own canvas | removed | kept and visible |
| once connected | visible | visible |

### The layer took the clicks with it

The layer above was right in principle and wrong in two details, and between
them they stopped every one of the mod's features working while the game itself
carried on perfectly.

It was given `z-index` one above the page's canvas. Raising it above that canvas
also raises it above every part of the page that has no `z-index` of its own and
relies on document order — the action bar, the store, the mod menu's controls.
A canvas over those is a canvas you cannot click through. And nothing is bound
to this element except `oncontextmenu`; all real input goes to
`#touch-controls-fullscreen`.

So it takes no `z-index` at all — being inserted directly after the page's
canvas already puts it above that one and below everything later in the
document — and `pointer-events: none`, so it can never take a click meant for
anything underneath.

There is also a line at boot now saying whether the mod layer is actually there:

```
[revelation] mod menu: 84 toggles, 3 on
```

`mod menu: NOT BUILT` instead means no feature can run, which is a different
problem from a menu whose toggles are simply off — and from a chair the two look
identical.

### Nothing fails silently any more

Every fault above was invisible. The packet handlers are called through one
`apply`, so all 36 are now wrapped: a throw names its handler, once, and the
socket goes on reading. `playerUpdate` reports rather than rejecting, and an
`unhandledrejection` listener names anything that still gets past.

```
[revelation] packet a: Cannot read properties of undefined (reading 'speed')
```

That line is the point. A clean session prints none of them; if one appears, it
says which handler stopped and why, which is the thing no amount of reading the
file could establish from here.

A socket close now names its code and reason too, since "no packets" and "the
server dropped you" look identical from a chair.

### A read-out, because three faults look the same

"The screen is frozen and nothing is being sent" describes three different
faults that are indistinguishable from outside: this client's render loop has
stopped, or this client is fine and something else owns the canvas you are
looking at, or the loop is running and the socket has gone quiet. The console
separates none of them.

So the counters are drawn on *this client's own canvas*, top left:

```
rev  60 fps   up 34/s   down 9/s   signed
```

- No read-out on screen at all → you are not looking at this client's canvas.
- Frame count frozen → its render loop died.
- Frames climbing, packet counts at zero → the socket is the problem, and the
  last field says which: `signed`, `rate-limited 120/s`, `closed 1006`.

Green while packets are arriving, red when they are not. **F8** hides it.

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
- Moving, aiming, attacking and building each put their own packet on the wire
  and the server accepts all of them.
- The client still talks after the server goes quiet for several seconds.
- This client is the only thing drawing the canvas.
- The render loop survives a fault, and so does the tick.

**Still not verified:** the live server. The mock speaks the same transport and
now enforces it, but its packet *payloads* are still the harness's own — so a
field only the real server produces is exactly what the fault reporter above is
for. The startup line `[revelation] build: layer-and-menu 2026-08-29` in the
console tells you which build is actually running.

## Not a fault

The world is drawn very dark on purpose. This client paints two tints over the
finished frame every frame — `rgba(15, 0, 70, 0.59)` and a second at `0.294` —
which is what makes everything read as dark purple rather than grass green. The
strength is a setting, not a constant:

```js
lightmode.checked ? "rgba(15, 0, 70, 0.39)"
  : regVis.checked ? "rgba(10, 0, 25, 0.6)"
  : "rgba(15, 0, 70, 0.59)"
```

The **Light mode** and **Shaders** toggles in the client's own menu control it.

## Not fixed

- The page's own bundle still runs alongside this one — it just cannot reach the
  canvas any more. It keeps a render loop going against a detached canvas, which
  costs a little CPU and nothing else. Stopping it outright needs
  `@run-at document-start` and script interception, as the Whiteout client does,
  and is its own change.
