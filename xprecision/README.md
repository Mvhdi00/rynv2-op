# X- Precision Client 2.0

`X_Precision_2.0.user.js` — audited for hidden behaviour, then fixed against the
same failure modes as the other clients here. Verified with
[`../harness`](../harness/README.md).

Built on Luna. Whoever made it had already fixed three things that took several
rounds on [Revelation](../revelation/README.md), and their own comments say so:
it stopped assigning `window.WebSocket` (the game made that property read-only,
and the assignment threw and killed the script), it moved from the dead `#altcha`
element to Cloudflare Turnstile, and it drives its own connection rather than
waiting for a hook that can no longer fire. It carries all three fingerprints of
the current signed transport, so it speaks today's protocol.

## Was anything hidden in it

Asked directly: spying, auto-kick, auto-chat.

| | finding |
|---|---|
| **Sending your data anywhere** | **No.** Not one `fetch`, `XMLHttpRequest`, `sendBeacon` or socket to any host. Every URL in the file is a documentation link inside a comment or a bundled library, plus moomoo's own API and Google Fonts. |
| **Hidden or packed code** | **No.** No `eval`, no `atob`, no `new Function` over a string. Every `String.fromCharCode` is inside the bundled msgpack/buffer/punycode libraries. |
| **Reading anything private** | **No.** `localStorage` is touched twice: the game's own name field, and this client's own settings. No cookies, no passwords, no keylogging. |
| **Auto-kick** | **No.** `kickFromClan` is the game's own kick, wired to a button you click in the clan list. Nothing calls it on a timer. |
| **Auto-chat** | **Yes — two features, one of them on by default.** See below. |

### The auto-chat

**Kill chat, which was `killChat: true` out of the box.** Every time your kill
count went up it sent two lines into public chat:

```js
killChat: true,
chatMsg:  "X- kill u",
chatMsg2: "X- precision diff",
```

That is an advert for whoever built the client, published under your name, on
every kill, without you turning anything on.

**A chat loop on the B key.** Pressing `B` starts a timer that sends one line
every 700 ms, forever, cycling eight hardcoded slogans — "X- is the best", "X-
precision diff", "X- owns this" — until you press `B` again. Off until pressed,
but the text was not yours to choose, and 700 ms is the rate servers mute people
for.

Both now start from nothing: `killChat` is off, the two kill lines are blank, and
the B-key list is empty. The features still work — type your own text in the
menu, or put your own lines in `songLyrics` — they just no longer speak for
someone else by default. The loop also stops instead of sending `undefined` when
the list is empty, which used to throw inside the render tick.

## What was broken

### One exception ended the render loop permanently

The same fault the other three clients had:

```js
function doUpdate() {
    ...
    updateGame();
    requestAnimationFrame(doUpdate);   // never reached if updateGame throws
}
```

One bad sprite, one unexpected packet, one undefined field on a player, and
`requestAnimationFrame` is never called again. The loop stops for good and the
canvas freezes on its last frame, recoverable only by reloading.

The reschedule now happens in a `finally`, after unwinding the canvas to its base
state — a throw between `save()` and `restore()` otherwise leaves the transform
and the saved-state stack corrupt, so the picture stays broken even once the loop
is running again.

[`../harness/loop-alive.js`](../harness/README.md), counting only this client's
own frame callback:

| frames per 500ms | before | after |
|---|---|---|
| before the fault | 13 | 13 |
| during the fault | **0** | 28 |
| after it clears | **0 — dead for good** | 12 |

### A missing page element killed the whole client at load

Eight unguarded `.remove()` calls on elements looked up by id, run at load,
before the socket and the render loop exist, inside a module:

```js
document.getElementById("altServer").remove();
document.getElementById("linksContainer2").remove();
document.querySelector('#guideCard .menuText').remove();
```

The first one the page happens not to have takes the entire client down before it
starts, with nothing on screen to say why. This is not hypothetical — it is what
the harness page hit, and the page these were written against is not the only
page this will ever run on. They now remove what is there and skip what is not.

### Placement caps used the sandbox numbers everywhere

```js
let limit = (group.sandboxLimit || 99);
```

No check for which server you are on, `group.limit` ignored entirely, and the
`|| 99` capping groups the game leaves uncapped. On normal moomoo it believed you
could place 299 mills and 99 of everything else, and kept offering placements the
server refuses.

It now applies the game's own rule,
`sandbox ? (sandboxLimit || max(limit * 3, 99)) : limit`.
[`../harness/item-limits.js`](../harness/README.md) reports **every group matches
the game**, in both modes.

### The page's own game was drawing on the same canvas

It carries its own copy of the game and has no `@run-at`, so it runs after the
page's bundle — which is still there, still drawing on the same `#gameCanvas`,
sitting on its menu painting a backdrop over your frames. Both programs take
`getContext("2d")` once and keep it, so this client now swaps the element for a
fresh one before taking its own reference; the page's context still points at the
old canvas, which is no longer in the document.

### Nothing said when something failed

There is now a build line and a fault reporter, so "I installed the fix" and "the
fix is running" stop being the same guess:

```
[x-] build: audited 2026-08-29
[x-] canvas: taken from the page's game
[x-] render frame failed: <what went wrong>     (only if something does)
```

## Changed on request

The resting hat and accessory — what the client puts on when nothing else in
`hatFc` has a reason to change it:

| | was | now |
|---|---|---|
| hat | Halo (48) | Booster Hat (12) |
| accessory | Angel Wings (13) | Monkey Tail (11) |

Halo was on the line directly above Booster Hat, so Booster already won whenever
you owned both; the Halo line is simply gone. Neither of these is the *only*
thing the function does — the soldier helmet near an enemy, the turret gear, the
biome hats and everything else still override them exactly as before.

The accessory line is a starting value and is not behind an `isBoughtHat` check,
the same as the line it replaces. Nothing in a client can equip something the
account has not bought; the server decides that.

## Asked to port Novastorm's auto heal — it is already the same code

The request was to bring Novastorm's auto heal across "100%". Measured first,
because copying code that is already there changes nothing and hides that
nothing changed.

Novastorm and X- are forks of one base: **560 shared function names, 83.8%
overlap** (every other pair of clients here is 2.5–12.6%). Of the 438 functions
both define, **396 have byte-identical bodies**. Auto heal is in that 396:

| | result |
|---|---|
| the 350-line `ANTIS AND HEAL` → `AUTO PLACER` block | **byte-identical**, zero differing lines |
| `heal()` | byte-identical |
| `place()`, which `heal` calls | byte-identical |
| `updateHealth`, `changeObjectHealth` | byte-identical |
| `io.send` packet accounting | same counter, same 1s reset, neither throttles |

The 42 functions that do differ, and the 177 differing lines inside the shared
per-tick `updatePlayers`, are trap and spike placement, the connection layer and
the chat features. Not one of them touches the heal decision, the damage
prediction, or the placement it uses.

So there was nothing to port. What was worth doing instead was proving the
feature runs, which
[`../harness/heal-check.js`](../harness/README.md) does from the wire — the
server hurts the player and the test counts the food that goes down:

```
phase               food placed  other builds  item ids used   first heal
after damage        138          0             0               29ms
after more damage   220          0             0               92ms
```

Item 0 is the apple, and no other build went out with it. Auto heal fires, 29ms
after the damage that called for it.

## Novastorm's spike tick, added

Measured before changing anything, as with the heal. Unlike the heal, this one
really did differ — in four ways, one of which is why it looked missing.

**The toggle is there, under another name.** Novastorm shows it as **"Spike
Tick"**; this client showed the *same setting*, id `shameTick`, as **"shame
tick"**. Same id, same code behind it. Both default to off, so it was never on
in either — it just could not be found here by the name people use. Renamed to
"spike tick".

The other three are real geometry, and all three made this client offer a tick
where Novastorm takes one:

| | was | now (Novastorm's) | where |
|---|---|---|---|
| spike tick reach | `scale + 35` | `scale + 55` | `isPrePlaceAngle` |
| trap tick reach | `scale + 75` | `scale + 95` | `canTrapTick` |
| trap tick spike reach | `scale + 35` | `scale + 55` | `canTrapTick` |
| enemy must be shamed out | yes, `shameCount >= 7` | no | `canTrapTick` |

That last one mattered most: waiting for shame 7 means never ticking anyone who
heals properly. Novastorm has no such gate.

All four are settings now, in the placement section, following the pattern this
client already uses for `place range` — a number fixed in code is a number
nobody can tune. Existing saved settings keep them, because the loader is
`Object.assign(window.vars, parsed)` and leaves keys the saved blob has never
heard of.

**Two things were deliberately *not* taken from Novastorm**, because this client
is better here:

- `place range` is a setting here and a hardcoded 350 there.
- The lookahead falls back when `predictMoveAngle` is null; Novastorm passes it
  straight to `Math.cos`, and `Math.cos(null)` is 1 — the prediction points due
  east no matter where you are actually going.

## What was already fine

- The outgoing packet counter is cleared by its own `setInterval`, so it cannot
  latch the client silent the way Revelation's could.
- Sprites are drawn behind `isLoaded` checks.
- The transport is the current signed one.

## Not verified

The live server. The harness speaks the same transport and enforces it, but its
packet payloads are the harness's own.
