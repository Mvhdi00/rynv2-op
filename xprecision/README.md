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
| accessory | Angel Wings (13) | **reverted to Angel Wings** — see below |

**The accessory swap was a mistake and is undone.** Monkey Tail carries
`dmgMultO: 0.2`, and the game applies it straight to your outgoing damage:

```js
Ot = Bt * (skin.dmgMultO || 1) * (tail.dmgMultO || 1)     // Bt is the base damage
```

Wearing it deals **a fifth of the damage**. The description says only "reduced
damage" and never says by how much, so it was made on request without the number
being read first. Angel Wings has no such penalty — it is `healthRegen: 3`.

The hat is fine and stays: Booster Hat is `spdMult: 1.16` with no damage term,
against Halo's literal "no effect".

[`../harness/loadout-check.js`](../harness/README.md) now reads the ids a
client's `hatFc` actually equips and prints what the shipped game says each one
does, so a penalty like that cannot be picked blind again. It still flags
Monkey Tail, because one branch — great hammer in hand — equips it deliberately,
and that was the original author's choice, not this one.

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

They were briefly four menu settings; on request they are plain numbers again
and the four controls are gone from the menu. The behaviour is unchanged —
`canTrapTick` is now byte-identical to Novastorm's — the menu is just shorter.

**Two things were deliberately *not* taken from Novastorm**, because this client
is better here:

- `place range` is a setting here and a hardcoded 350 there.
- The lookahead falls back when `predictMoveAngle` is null; Novastorm passes it
  straight to `Math.cos`, and `Math.cos(null)` is 1 — the prediction points due
  east no matter where you are actually going.

## The placement ring: the step count was never the lever

`prePlaceSteps` was raised from 144 to 240 on request, played, put back, and the
step count was then tuned twice more before anyone measured what a placement
scan is actually competing against. The geometry settles it in three numbers,
all of them from the game's own tables.

Every candidate for one item sits on a circle around you of radius
`35 + scale + placeOffset`. Greater spikes are scale 52, offset −5, so the ring
is **82**. And `addPredictObject` refuses a second placement within
`scale + scale` = **104** of the first — which is not a mod's conservatism but
the server's own rule, since `getScale(0.6, isItem)` returns full scale for a
placed building. A 104 chord on an 82 ring is **78.7°**.

So:

1. **Four spikes is the most the ring can ever hold**, at any resolution. 360°
   ÷ 78.7° = 4.57.
2. A gap between two spikes only becomes walkable for a 35-radius body once they
   are **138.6°** apart. Four spikes, however badly arranged, cannot leave a gap
   wider than 360 − 3×78.7 = **123.9°**. Three can leave 202.6°.
3. Therefore **the ring is sealed exactly when the fourth spike goes down** — not
   when the scan is fine.

That reframes the whole question. The scan's only job is to find candidates;
which four go down was being decided by nothing but the order the scan happened
to produce them in. `checkPredictObjects` walked the edge angles, then the rest
in index order, and each accepted angle locked out 78.7° around it. One leg
landing a few degrees off costs the fourth spike and the seal with it.

[`../harness/seal-bench.js`](../harness/README.md) measures it: 600 random fight
scenes, and for each one, whether an enemy body can still reach you by flood
fill rather than by an angle heuristic.

| placement scan | checks/tick | spikes down | all 4 | enemy shut out |
|---|---|---|---|---|
| 144, first-come (was in use) | 144 | 3.02/4 | 39.3% | **74.2%** |
| 360, first-come | 360 | 3.06/4 | 41.2% | 76.0% |
| 72, chosen as a set | 72 | 3.06/4 | 43.3% | 86.0% |
| 144, chosen as a set | 144 | 3.08/4 | 44.2% | 86.3% |
| 240, chosen as a set | 240 | 3.10/4 | 44.8% | 86.3% |
| **360, chosen as a set** | **360** | **3.11/4** | **45.8%** | **87.0%** ← in use |
| 720, chosen as a set | 720 | 3.12/4 | 45.8% | 87.0% |

Two other seeds give 75.0 → 87.7% and 75.0 → 86.8% for the 144 pair, so the
+12-point step is the picker and the ±0.5 is the resolution. Choosing the set is
worth roughly **twenty-four times** what raising the scan is.

`sealRingOrder` does the choosing: fix a first angle, take the earliest
candidate clearing 78.7°, repeat, check the wrap, and try every candidate as the
first. That is exact, not approximate — if a valid ring `{a₁..a₄}` exists then
greedy from `a₁` picks each leg no later than `aₖ`, so it closes too. Brute
force over every four-subset agrees: in 600 scenes a valid ring existed 265
times and this found one 265 times. A third construction that looked like it
should reach sets the forward walk cannot was written, measured identically on
every count, and deleted.

When no full ring exists, it switches from packing tight to spreading evenly —
three legs crammed at 79° leave a 202° hole, the same three at 120° leave
nothing walkable. Packing is what maximises the *count*, spreading is what
matters once the count is capped, and they pull against each other, so it tries
them in that order.

`placeSteps` is 360 because that is where resolution stops paying at all — 720
measures identical — and because it costs nothing real: one tick scanning both
items plus the search is **0.42 ms at 360** against 0.19 ms at 144, or 0.38% of
a core at the game's tick rate. Advising against 240 on CPU grounds was wrong on
the facts; the reason to leave it alone was that it barely does anything.

`prePlaceSteps` stays at 144. That path places one object at the angle nearest
the one being replaced, and nothing measured says a finer scan improves it.

## The "replace" switch had nothing behind it

The menu shows two placer switches side by side. `prePlace` works. `prePlace2`,
labelled **replace**, appeared exactly once in the whole 20,000-line file — in
the line that draws the toggle. No code read it. The state it would plausibly
have driven was dead too: `placeTick` is written in two places and read in none.
So the switch did nothing whichever way it was set, and nothing on screen said so.

It now does what its name says. Preplace puts an object down *before* the enemy
breaks yours, predicting the hit; replace answers the hit that already landed —
your wall or spike is gone, so one goes back where it stood, that tick.

Only your own buildings, and only ones that died within reach: every placement
lands on your own ring, so an object further off than the ring plus its own scale
cannot be replaced where it was, and guessing a different spot is not replacing.
`canPlace` decides the rest — item limits, collisions and the river included.

**Off by default.** It is new behaviour, not a repair.

One thing it needs, which is easy to miss: the object that just died has to be
excluded from the collision check. `visibleObjects` is a once-per-tick snapshot,
so at that moment the dead building is still in it, sitting exactly where the
replacement goes — it blocks its own replacement and `canPlace` says no every
time. The server has already destroyed it; the list is only stale.

[`../harness/replace-check.js`](../harness/README.md) breaks one of the player's
own buildings and counts what follows:

| replace | item placed back |
|---|---|
| off | 0 |
| on | **1** |

## Preplace is back to how it shipped

The spike tick port raised one number inside the preplace path — the reach at
which a preplace spot counts as able to tick the enemy — from this client's own
`scale + 35` to Novastorm's `scale + 55`. That was the only line the port changed
on this path, and it is back at 35.

`canTrapTick` keeps Novastorm's numbers (95 and 55, no shame gate); it is a
different path and was not part of this.

Everything else in preplace is byte-identical to the file as it arrived:
`getPrePlaceAngles`, `getPrePlaceObject`, and the whole preplace decision block
were compared line by line against the original. `prePlaceSteps` went 144 → 240
→ back to 144, so the net change there is zero.

The one thing not restored is a pair of calls in the preplace timeout:

```js
getPrePlaceAngles(myPlayer.items[2], object.id, object.angle);
getPrePlaceAngles(myPlayer.items[4] || 15, object.id, object.angle);
```

The function takes `(id, customObjects)`. A **number** was arriving where the
object list goes, so `objects.length` was `undefined`, the collision loop never
ran, every angle came back placeable — and the return value was discarded, since
nothing was assigned. 288 `checkItemLocation` calls per preplace tick spent on an
answer nothing read. Restoring them would restore the waste and change no
behaviour, so they stay out.

### The dedupe window, corrected

An earlier version of this file blamed `angleDedupe` (1.5°) for the 240
regression: the scan spacing at 240 equals the dedupe window, so candidates get
thrown away as they are collected. That reading was incomplete in a way that
mattered. `addPredictObject` runs the angle test *and* a distance test, and for
anything but item 17 the distance test rejects everything within 104 units —
about 78.7° of ring. The 1.5° window is entirely inside that shadow, so for
spikes and traps it decides nothing at all. The real cap on placements was
always the separation rule, which is why no step count ever moved the number of
spikes that went down.

The game also rounds every placement angle before sending — `Ci()` ends in
`fixTo(dir, 2)`, one hundredth of a radian — so the circle holds 628
distinguishable angles and no scan finer than that can send a different packet.
That ceiling is real but never binds here; the 78.7° one binds first.

The arc geometry in Novastorm reaches **0 blind at 5,112 checks**, cheaper than
144 was. It remains a good answer to the *cost* of scanning, and is still not
taken here — but it is a different question from which four spikes go down.

## What was already fine

- The outgoing packet counter is cleared by its own `setInterval`, so it cannot
  latch the client silent the way Revelation's could.
- Sprites are drawn behind `isLoaded` checks.
- The transport is the current signed one.

## Not verified

The live server. The harness speaks the same transport and enforces it, but its
packet payloads are the harness's own.
