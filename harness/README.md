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
node heal-check.js            # does auto heal fire when the server hurts you
node loadout-check.js         # what the hats and accessories a client wears really do
node seal-bench.js            # how many of the four placements land, and is the ring sealed
node replace-check.js         # does the "replace" switch answer a broken building
node replace-bench.js         # graded replace vs putting the same thing back
node packet-burn.js           # packets a second on the wire, against the client's own guard
node trap-tick-check.js       # which spike a trap tick runs on, and whether it survives
node trapped-preplace.js      # does preplace still run while you are in the enemy's trap
node weapon-style.js          # does the custom weapon carry draw, and unwind the canvas
node weapon-poses.js          # a contact sheet of weapon angles, to pick one by looking
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

The anchor argument decides where the fault is injected, and putting it in the
wrong place reports a healthy client as dead. A guarded loop looks like
`doUpdate` wrapping `updateGame()` in try/catch/**finally**, and the reschedule
lives in the `finally`; anchoring on `function doUpdate() {` throws *before* that
try is entered, so nothing reschedules and the test prints `NO` for a client that
recovers perfectly. Anchor inside the guarded body — for X- Precision:

```sh
node loop-alive.js ../xprecision/X_Precision_2.0.user.js requestAnimationFrame "function updateGame() {"
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

`heal-check.js` asks the same question of one feature, from outside. Auto heal is
a damage prediction feeding a decision feeding a placement, and any of the three
can be intact while the feature does nothing — so the server hurts the player and
the test counts the food that goes down, and how long after. It reaches into
nothing: these clients are webpack bundles whose state lives in closures, and an
earlier version that appended a hook read `heal is not defined` and was about to
report a working feature as broken.

Two more traps it fell into first, both worth knowing when writing a check here.
A placement is `z` carrying the item id, not `G` — counting the wrong opcode
turned 358 food placements into zero. And a client that never spawned proves
nothing about a feature, so the verdict says INCONCLUSIVE rather than
"not firing".

### `weapon-poses.js`

`X_STYLE.holdAngle` decides where the weapon points, and words do not settle it —
"out to the side" and "trailing back" is one sentence for two poses that look
nothing alike. So this renders the same character at a spread of angles and
stitches a labelled sheet, and an angle gets chosen by looking at it.

It needs `window.X_STYLE` exposed by the client, and says so plainly rather than
producing seven identical tiles if it is not.

The crop is deliberately wide. The stand-in sprite is drawn at the weapon's own
`length` and `width`, which for a polearm is large, so a tight frame fills with
bar and hides the very thing being chosen — the first version did exactly that.

### `weapon-style.js`

A custom weapon carry means a save/rotate/restore around the draw, and an
unbalanced pair there is the fault this repo already carries an unwind for. It
also means a picture, and sprite hosts are unreachable here — so any image the
client requests from the weapons folder is answered with a solid bar, and the
crop is read straight out of the canvas with `drawImage` rather than screenshot
off the page, which caught the mod menu and none of the character.

Three checks of the balance were needed before one was right, and the two wrong
ones are the interesting part:

- **saves vs restores over a window** counts a read landing mid-frame as a leak,
  because those saves have not been restored yet. Reports a healthy loop as
  broken.
- **watching the gap grow** fails differently: `doUpdate`'s `finally` calls
  `restore()` 32 times unconditionally every frame, so the gap marches away from
  zero on a perfectly healthy loop — and no leak could survive a frame anyway.
- **net save-restore per frame, compared between the style on and off** is the
  one that answers the question. One unbalanced save in the player draw shifts it
  by one per player per frame. It reads `-32.0 vs -32.0`: the unwind, and nothing
  else.

### `trap-tick-check.js`

`canTrapTick` proves a specific spike would land before it lets the combo run,
then returned `true` and let that spike fall on the floor — so the hammer broke
the trap and the primary swung with nothing placed for the enemy to be freed
into. It also took the *first* candidate that passed, and the scan hands them
over in angle order from zero, so the move ran on whichever spike sat lowest on
the circle rather than the one that hits.

Both are decisions inside one function, so both test without a browser: lift it,
hand it a candidate list whose answer is known, read back what it chose.

```
  the enemy sits at angle 1.90, and candidates arrive in angle order from 0
  nearest candidate to the enemy    angle 1.92, 9.1 away
  the one it kept                   angle 1.92, 9.1 away      (before: none)
```

It does **not** cover the placement reaching the wire. A trap tick needs a trap
damaged below the hammer's structure damage, and object health is not reachable
from the mock — nothing in the packet table sets it, so a loaded trap sits at the
item table's 500 and the gate never opens.

### `trapped-preplace.js`

Preplace used to switch itself off when you were standing in an enemy trap
taking spike damage. Both halves of that state are reachable from the wire, which
is what makes it testable: `nearestTrap` is an enemy pit trap within 50 of you,
and spike damage is recognised purely by the amount — `distributionDamages` keeps
a health delta only if it is 20, 30, 35, 45 or one of those times 0.75.

Where the probes go is the whole test. The first version put one counter inside
the block, after the gate, which cannot see what the gate excluded: against the
old build it reported "never reached trapped+spiked" and called itself
inconclusive — true, and useless. So one probe sits outside the gate recording
the state every tick, and one inside recording that the search ran.

```
  run                 spawned   trapped    spiked     both at once  preplace ran while both
  before              yes       30 ticks   6 ticks    6 ticks       0 of 6
  after               yes       29 ticks   6 ticks    6 ticks       6 of 6
```

The outside anchor is the part of the condition both builds share, so one test
runs against either, and a missing anchor exits 2 instead of reporting a zero.

What it does **not** cover: whether a placement actually goes out. A preplace
needs the enemy mid-swing at a building weak enough to die to it, and the mock
reproduces neither reload timing nor object health, so the untrapped run places
nothing either. This counts the gate, which is what changed.

### `packet-burn.js`

moomoo drops a client that sends too fast, and this file guards its placements
with `packets + 5 > 119` against a counter that resets every second. That guard
covers placements only — attacks, aim, hat swaps and weapon selects increment the
same counter without asking — so a placer firing four placements at four packets
each does not break the guard, it eats the budget everything else was going to
spend. "Feels like it burns packets" is measurable, so this measures it.

```
  replace     peak/s    average/s   total    busiest packets
  off         10        8.4         76       Dx73 0x3
  on          22        17.2        155      Dx72 zx40 Fx40 0x3
```

Per-second buckets rather than an average, because the guard is written against a
one-second counter and an average hides the spike that gets you dropped.

Read it with its limit in mind: the mock has no real fight running, so the base
rate here is far below what combat produces. What it settles is the *increment* —
replace adds about 9 packets a second — not whether some other client state is
already near the line.

### `replace-bench.js`

"Grades every spot against every enemy and takes the best four" sounds better
than "puts one back where it stood", and sounding better is not evidence. Both
are geometry, so both run over the same scenes:

```
  policy                placements   placed nothing  enemy shut out   enemy spots denied
  put it back (was)     0.69         30.6%           0 (0.0%)         5.3
  graded, best four     2.75         0.2%            174 (34.8%)      17.8
```

The last column is what the scoring is actually for — a spike sitting where the
enemy wanted to build is worth more than the same spike in open ground, and
neither of the other columns can see that. The first row's 30.6% is the reason
the put-back was weak: the spot that just failed is often still blocked.

### `replace-check.js`

A switch that is off by default and a switch with nothing behind it look
identical from outside, so this tests the difference rather than the presence:
it breaks one of the player's own buildings, then counts the placements that
follow, once with `replace` off and once on. Off must place nothing; on must put
the same item back.

It also reads the toggle back after setting it, because a switch that silently
failed to take would make "off places nothing" true for the wrong reason.

Finding this one took a harness fix first, described below — every `canPlace` in
every browser test was returning false, so the feature tested as broken while
working.

### `seal-bench.js`

Asks what a placement scan is actually competing against, which turns out not to
be its own resolution. Every candidate for one item sits on a fixed ring around
the player, and `addPredictObject` refuses a second within `scale + scale` of the
first — the server's own rule, since `getScale(0.6, isItem)` returns full scale
for a placed building. For greater spikes that is a 78.7 degree chord on an 82
ring, so **four** is the most that can ever go down, at any step count, and the
ring is sealed exactly when the fourth lands.

So it reports how many of the four a given policy gets down and whether an enemy
body can still reach the player — answered by flood fill over the plane the enemy
moves in, because a barrier can look gapless on one radius and be walk-through on
another.

```
  scan            checks/tick  spikes down  all 4    enemy shut out
  144 in order    144          3.02/4       39.3%    445 of 600 (74.2%)
  144 sealed      144          3.08/4       44.2%    518 of 600 (86.3%)
  360 sealed      360          3.11/4       45.8%    522 of 600 (87.0%)
  720 sealed      720          3.12/4       45.8%    522 of 600 (87.0%)
```

The rows named `sealed` drive the client's own `sealRingOrder` — lifted with `vm`
so the test moves when the file does, not a copy of it. `SEAL_SEED` changes the
scenes and `SEAL_ONLY` selects rows by label prefix.

Two traps this fell into first, both worth knowing. Modelling a placed building's
blocking radius as `scale * 0.6` is wrong — the 0.6 never applies to an item — and
it made the world look far emptier than it is. And a scaffold picker written to
compare against reported *better* full-ring rates than the shipped one, which was
impossible: greedy-from-every-start is provably exact here. Brute-forcing every
four-subset settled it — a valid ring existed in 265 of 600 scenes and the client
found one in all 265 — and the scaffold was the thing that was wrong.

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

### `heal-duel.js` and `preplace-duel.js`

Two comparisons against RYN v5.4 rather than against an earlier version of this
client. Both are **models**, and both say so at the top: neither client's heal
or preplace path can be lifted into a `vm` — X-'s lives inside one enormous
inline tick block, RYN's reaches through five managers — so the rules are
transcribed from source with the line each came from and run against a shared
scenario. Read the transcription before believing the table.

`heal-duel.js` is the more trustworthy of the two, because the part that
decides the result is not modelled at all: the shame rule is the game's own
server code, which `X_Precision_2.0.user.js` ships verbatim at line 18516. Two
things in it are easy to get backwards:

* `this.hitTime = 0` runs inside the branch, so only the **first** food after
  each hit is ever judged. A burst of five apples costs at most one shame
  point — spamming food is not what gets you shamed, the timing of the first
  apple after a hit is.
* The shame arithmetic runs **before** the `shameTimer <= 0` check, so apples
  sent while already shame-locked keep feeding the counter and re-arm the lock.
  A client that does not track the lock can hold itself in it.

```
  totals across every row
  client         apples   packets   wasted      shame locks  deaths
  X-             2676     10704     1815 (68%)  30           108
  RYN (was)      1230     4920      300 (24%)   6            96
  RYN (ported)   2676     10704     1815 (68%)  30           108
  RYN (now)      1698     6792      860 (51%)   2            112
```

The 68% is one mechanism: X- computes `heal(100 - myPlayer.health)` from the
server's last echo and nothing subtracts what is already on the wire, so the
same missing health is paid for on every tick of the round trip. RYN's
`_healsInFlight` used to subtract it.

`RYN (ported)` is the client after its autoheal was replaced with novastorm's
rule, and its acceptance test is that the **decision** is indistinguishable from
X- on every row — the file exits non-zero otherwise, so a guard creeping back
into the decision fails the run rather than passing quietly. `RYN (now)` is the
same decision with the two shame guards from `auto-q.js` in
`ModuleHandler.heal()`; it is asserted to take no more locks and spend no more
food into a lock than the bare rule, on every row.

It is **not** asserted to send fewer apples, and on the burst fight it sends
more: a press held one tick is one more tick of damage before the top-up, so
`heal(100 - health)` asks for a bigger number. Same arithmetic, lower figure.

### `auto-q.js`

Why the ported autoheal reads as Q being held down, and which guard fixes it.
Seven candidates over three fights and three pings, against the game's own shame
rule — the same server code `heal-duel.js` quotes.

The row marked `<-` is not a description of the client, it **is** the client:
`ModuleHandler._foodIsShameSafe` is lifted out of the file with `vm` and asked
the same question on the same ticks, and the bench refuses to run if the
client's `SHAME_SAFE_WINDOW` has moved or `heal()` has stopped standing down
during the lock.

```
  guards                   apples   refused   judged +1  judged -2  locks   deaths
  v5.4 as shipped          2676     1095      294        231        30      108
  lock                     1716     30        102        231        6       96
  window, bypass           2676     1095      294        231        30      108
  lock + wait forever      1628     10        34         267        2       112
  lock + wait unless held  1716     30        102        231        6       96
  RYN v5.4 now  <-         1698     10        48         267        2       112
```

Four of the seven rows are there because they did **not** work, which is the
point of keeping them:

* `window, bypass` — let an emergency press through — is inert, identical to
  shipped everywhere. The shaming press *is* the emergency press. This was the
  first design, and the table killed it.
* `lock + wait forever` starves: under damage every tick the window never opens,
  and at ping 30 and 100 it never eats at all.
* `lock + wait unless held` — skip the wait when hits land on back-to-back ticks
  — collapses back to the lock guard, because a burst *is* three consecutive
  ticks of damage.
* `lock` alone is safe and good but leaves the counting-up untouched.

The cost is printed rather than buried: deaths go up by 4, all of them on the
third fight — 12 damage every single tick with no gap, where every candidate
dies about once a second. On the two fights anyone survives, deaths are
unchanged and shame is zero at ping 30 and 100.

Five mutations of the client's own method were run against this bench — drop the
one-tick cap, invert the window test, never hold, stop standing down during the
lock, widen the window to a second — and it goes red on all five.

### `antipush-duel.js`

Unlike the two duels above, this one transcribes nothing. Novastorm's
`isNearestEnemyPushPlayer()` is a top-level function and RYN's `AntiSpikePush`
is a class, so both are lifted out of the shipped files with `vm` and run
against the same staged world — it compares the real code, and the only thing
written here is the scenery.

All 96 combinations of the six inputs the rule looks at (am I trapped, is a
spike against that trap, which primary, are they in reach, `spikeDmgCount`, are
they in a trap of mine) are staged in each client's world shape. A single
disagreement fails the run.

It also prints a second table, and that one is the point: agreement across 96
scenes where only 2 fire could be agreement on "no". So it takes the scene that
does fire and flips each gate on its own — every flip must turn **both** clients
off, which is what proves each gate is carrying weight on both sides rather than
being absent from both.

### `automill-*.js` — four theories, all wrong

Four files, because automill was reported broken twice and the cause was
guessed wrong four times. Each file is the measurement that killed one theory,
and they are kept as a record of how the question was actually settled.

* **`automill-shape.js`** — the one that found something. Walks 60 ticks past
  scattered rocks under both placement policies: 60.7% of placing ticks laid a
  partial row under "whatever fits", 0% under "all three or none". That is the
  ragged wall.
* **`automill-spacing.js`** — floating point. The spacing solve is exact
  (`2·R·sin(asin(r/R)) = 2r`), so mills sit *exactly* touching and the `9e-13`
  epsilon is the whole margin. Sweeping 360 headings through the real
  `PlacementLedger`: three at every one. The coordinate error is correlated
  between the two points compared, so it cancels.
* **`automill-ledger.js`** — the ledger, and `GeometrySolver.norm`. The real
  path normalises each angle before projecting it, which rewrites its bits and
  only fires for angles outside `[0, 2pi)` — heading-dependent, and a good
  theory. Measured: margin 9.09e-13 raw, 7.67e-13 after a normalise from seven
  turns out. Three mills at every heading either way.
* **`automill-apertures.js`** — the gate that actually limits it, and it is not
  a bug. A windmill is 45 on a ring of 85, so **one existing mill occludes 128°
  of your own ring**. Your last row blocks the next one, a step of 25 does not
  clear 270 of row, and the result is a clean trio every ~4 ticks at *every*
  heading. Novastorm's wider spacing gives exactly the same pattern.

### `automill-shape.js` and `automill-spacing.js`

`automill-shape.js` answers "why does automill build a ragged wall". It walks a
player 60 ticks past scattered rocks under both placement policies, adding each
mill to the world as it lands so stragglers block the next trio the way they do
in the game:

```
  policy                      mills total   placing ticks   uneven
  whatever fits (RYN was)     3218          1423            60.7%
  all three or none (Glotus)  1854          618             0.0%
```

The trio *geometry* is identical between the clients; the difference is only
what happens when one of the three does not fit.

`automill-spacing.js` is the wrong turn, kept on purpose. The first theory was
floating point: the spacing solve is exact — `2·R·sin(asin(r/R)) = 2r` for any
R — so the mills sit *exactly* touching, and the `9e-13` epsilon buys ~8.8e-13
of daylight, the same order as the rounding error in `cos(θ)·R`. That predicts
a heading-dependent count, which matched the report almost too well. Sweeping
all 360 headings through the client's real `PlacementLedger` gives three mills
at **every** one: the coordinate error is correlated between the two points
being compared, so it cancels. Worth keeping — it is a natural theory, and this
is the thing that settles it.

### `spike-geometry.js`

What a spike tick can and cannot do, derived from moomoo's own item table and
collision rule rather than restated. A build always lands on your own ring
(79 for spikes, 82 for the age-5 kinds) at the angle you face; a spike hurts
within 84 of its centre and **your own spikes hurt them as much as theirs do**;
two spikes on one ring must be 98 apart, which is 76.7 degrees.

From those three, the reach window: a spike touches a target at distance *d*
only from within `acos((R² + d² − 84²) / 2Rd)` of the aim — ±64° at d=79,
±38° at d=130, nothing past 163. The window is exactly one separation wide at
**d = 130.2**, which is the distance above which a second reaching spike simply
does not exist.

That last figure corrects the note left when the old spike tick was removed.
"Disjoint at every distance" is true only when the existing spike sits **on the
aim line** — which was both the case that bench tested and the angle the old
controller kept asking for. Off-aim, a second spike fits comfortably below 130.

### `spike-tick.js`

The spike tick itself, lifted out of the client with `vm` and run — together
with the real `GeometrySolver`, `TargetMotion` and `PlacementLedger`. Only the
world around them is staged.

26 scenarios (the 20 in the brief, plus six the geometry made worth adding) and
5 multi-tick properties: the bull-then-turret combo lands on consecutive ticks,
a strike delegated from `SpikeSyncHammer` keeps its follow-up for the next tick,
hysteresis holds a target against a marginal rival but yields to a clear one,
and auto place's reservation survives untouched.

18 mutations of the module are run against it and all 18 turn it red.

Two guards were written, measured, and then deleted or retuned because they
could never be the test that decided anything — which is the point of measuring:

* an angle cooldown, unreachable behind the `_coveredBy` check that sees the
  hard ledger entry a send leaves;
* a 60° turn limit on the motion track, which cleared `TargetMotion`'s own
  confidence floor only in a 0.13°-wide sliver. Retuned to 30°, where it bites
  first and actually decides.

### `spike-vs-trap.js`

Why a trap was reaching the wire before the spike tick's window, and what the
fix changes. Real `PlacementLedger`, `ConflictResolver`, `TargetMotion` and
`SpikeTick`; auto place reduced to the one branch that matters, with its emit
modelled both ways.

Two facts, and between them they are the whole bug. `checkItemLocation` refuses
a build within `s + blockS`, and for a placed item `blockS` is the full scale —
so a spike (49) and a pit trap (50) need 99 between them, and on rings of 79 and
80 that is **77 degrees**. The reach window is ±64° at best and narrower
everywhere else, so **one trap dropped toward the enemy forbids every spike that
would reach them, at every distance.** And auto place was the one placement path
that sent with `ModuleHandler.place()` — raw, with `_notePlacement` recording the
footprint in the ledger *after* the decision — while its trap branch is
`if (neitherTrapped) return true` and every spike branch is conditional.

```
  auto place emit           traps   spikes  spike tick swung  held ground on
  raw place() — before      4       0       never             0 ticks
  groundIsFree() — after    1       1       tick 1            1 ticks
```

Eleven cases and ten properties, and twelve mutations of the fix all turn it
red — including auto place sending without asking, asking after it has sent, the
hold taken hard instead of soft, and the trap-versus-spike comparison dropped.

Auto place is 490 lines of Luna ladder and is modelled here rather than lifted,
so the bench asserts against the source that the emit it models is the emit the
client has, and refuses to run otherwise. It also names, in its header, the one
line it cannot cover with a failing case and why.

### `anti-audit.js`

Every anti in novastorm's damage prediction, checked off against RYN's — and
the two that were missing, run side by side after being ported.

novastorm 15473 and X- Precision 14681 are byte for byte the same block; `diff`
says so. Two pieces of it had no counterpart in RYN, because RYN's `+25` for a
turret comes from `canPossiblyInstakill`, which only counts a turret once the
enemy is already inside weapon reach — most of a turret's useful range missing:

* **PREDICT TURRET HIT** — out to 350, three cases: standing on a spike as their
  primary goes, about to be knocked onto one, or on ≤25 health with almost
  nothing else predicted.
* **VELOCITY TICK ANTI** — turret gear between 150 and 350 with a loaded primary
  and a spent turret is someone lining up the move this client now has as an
  offence.

Both are now `EnemyManager.antiLongRangeTurret`. The bench lifts that method out
of the client with `vm` and transcribes novastorm's block beside it:

```
  situation                                     novastorm   RYN
  on a spike, their primary just fired          25          25
  about to be knocked onto a spike              25          25
  low health, nothing else predicted            25          25
  low health, but plenty already predicted      0           0
  turret gear at 200, turret spent, primary up  70          70
  turret gear at 100 — too close for the band   0           0
  turret gear but the turret is loaded          0           0

  exhaustive sweep: 2048 of 2048 worlds agree
```

The first run showed 444 disagreements and every one was the bench's fault:
novastorm's reload is a 0/1 scale and RYN's is a tick counter, so driving one
into the other invented a difference. Modelling ticks properly (`RELOAD_MAX = 3`,
`charged = ticks >= max`) removed all 444 — and left **one real bug**, which is
the reason to build the sweep at all: my band used the outer `> 350` guard, so
`dist === 350` passed, where novastorm's `dist < 350` is strict. Fixed with its
own return, and the sweep closed at 2048/2048.

One convention difference is left in and printed by the bench rather than hidden:
`isReloaded(type, 1)` is `current >= max - 1`, so RYN calls a turret ready one
tick before novastorm does. For an anti, one tick early is the safe side.

The rest of the file is the audit proper — a term-by-term table of every other
block in novastorm's summation against RYN's, including the one non-cosmetic
difference deliberately not changed (**ANTI NORMAL INSTAKILL**: novastorm fires
within 400 given a recent hit, RYN within `primaryRange + 130` with no recent-hit
requirement — those bounds are `canPossiblyInstakill`'s, and it feeds danger
detection, the soldier hat and every insta module, not only the heal).

### `ryn-changes-check.js` and `ryn-changes-mutate.py`

The standing check over every change made to `ryn/`. It exists because RYN
cannot be booted here, so `node --check` is the only whole-file check available
and it validates syntax only — it will not notice a call to a deleted helper, an
identifier that resolves nowhere, or a UI id no element carries.

104 checks in four groups: **EXECUTE** (each changed block lifted with `vm` and
actually run against stubs), **RESOLVE** (outer identifiers declared),
**WIRE** (settings, registration, run order, UI ids — including that all 63
`staticModules` constructors name something real, and that the spike tick takes
no ground of its own), **NO GHOSTS** (the 17 deleted helpers have no surviving
reader — including `SpikeSync`'s three `EnemyManager` members and the two spike
tick guards that measurement showed could never decide anything).

`ryn-changes-mutate.py` is the check on the check: it breaks the client 45 ways
and requires a red result each time. Three real holes came out of it and are
worth knowing about, because all three are easy to reproduce elsewhere:

* `indexOf("class VelocityTick")` still matches after the class is renamed to
  `VelocityTickX` — a prefix match kept the check green while the thing it
  looked for no longer existed. Anchor on `class X\s*\{`, not a substring.
* The original `check()` treated any returned string as a pass-with-note, so a
  check whose failure path returned `"still read somewhere"` printed that
  message next to an `ok`. The contract is now `true` or `[pass, note]`.
* A check that lifts a method into a `vm` and *stubs the constants it reads*
  is not testing those constants. Shrinking `ANTI_TURRET_RANGE` from 350 to 200
  in the client left the check green, because the sandbox still said 350. The
  constants are now read out of the source with `constant()` and the distances
  in the assertions are the literals — so the check asserts the reach, not that
  the file contains the digits.

### `bot-names.js`

One name typed once on the Bots page, optionally numbered, reaching every bot.
The prefill block and `_numberedBotName` are lifted out of the client, so the
rule under test is the shipped one rather than a copy of it.

Covers the precedence that matters — a typed name beats the random-name switch,
an empty field leaves the old behaviour untouched — and that numbering survives
moomoo's 15 character cap by trimming the base rather than the digits.

### `knockback-duel.js`

Glotus 5.5.5's `KnockbackTick` against the copy now in RYN — hit them so the
knockback carries them onto a spike. Both classes lifted with `vm`, one stub
client, nothing transcribed. 12 rows, all agreeing.

It drives **two** ticks on purpose. The reach test is a knockback budget rather
than a range — primary knockback alone, or primary plus the turret's ~60 — and
when only the two-tier budget covers the gap the turret goes out on the tick
after. That follow-up is the half a port loses quietly: the swing still lands
either way, and a missing latch shows only as the enemy stopping just short of
the spike. So the file checks the latch and the next-tick hat 53 separately from
the swing.

### `velocity-duel.js`

Glotus 5.5.5's `VelocityTick` against the copy now in RYN. Both classes are
lifted with `vm` and driven by **one** stub client, so nothing is transcribed
and neither side sees a world the other did not. 768 scenes across eight axes;
all three signals (arms, fires, walks on the firing tick) must match.

Two things this file has to get right, and both are easy to get wrong:

* The real `ModuleHandler.postTick` resets `moveTo` to `"disable"` every tick
  (RYN 17332). Without the stub doing the same between ticks, tick two bails on
  the module's own `moveTo !== "disable"` guard and the FIRE step is never
  exercised — the run passes while testing half the feature.
* `almostReloaded` and `futureHat` are the two halves of one OR
  (`canSend = almostReloaded || detectFutureHat`), not two gates. Flipping either
  alone correctly leaves the tick firing on the other. The first version of the
  gate table flipped them separately and failed a working client; the table is
  one row per *gate* now, not per field.

### `preplace-duel.js`

`preplace-duel.js` enumerates 162 situations (their reload × building toughness
× in range × motion × distance) and applies each client's *gate conditions* as
written, counting where each produces a candidate at all. It measures coverage,
not quality — RYN's candidates then face a scorer, a `minValue` and a conflict
resolver, and some die there — and it weights every situation equally, which a
real fight does not.

## Limits

The mock server speaks the real transport (`io-init`, per-connection opcode
permutation, 6-byte signed client frames), verifies every frame the client sends
— signature, opcode, strictly increasing sequence — and with `requireSpawn` puts
the client in the world only once it accepts a spawn.

It spawns the world on dry land, and that is not cosmetic. It used to put
everything at 7000, 7000 — the middle of the map, and the middle of the river.
`checkItemLocation` ends by refusing any placement whose y is inside
`mapScale/2 ± riverWidth/2`, which for the game's own 14400 and 724 is
y ∈ [6838, 7562]. So **every `canPlace` call in every browser test returned
false**, whatever the client decided: a placement feature that worked perfectly
tested as placing nothing, with no error anywhere to say why. If a placement
test here reports a feature dead, check where the player is standing before
believing it.

It is not the game. It covers only the packets in `server.js`, and their
*payloads* are the harness's own: the field layouts are checked against
`src/game_index.js` separately, by comparing the strides each client parses them
with. A clean run here means the client loads, connects, spawns, renders and
survives; it is not a substitute for playing.
