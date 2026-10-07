# RYN Type 2 on the 2025 game

The game shipped a new bundle (`index-*.js` + `vendor-*.js` + a new
`moomoo-protocol` module). RYN works by rewriting that bundle and running its
own copy of it, so a bundle change is a RYN change whether anyone edits RYN or
not.

**The first pass at this update did not work, and its checks said it did.**
They read hook patterns against the bundle's text; nothing ever ran the
result. The very first thing RYN does with the bundle, turning an ES module
into something `Function()` can run, threw on the second `import`, so RYN's
copy of the game never started. You saw it as a frozen world with no player,
a server panel stuck on "waiting for the server list", and no way to sign in.

This pass was verified the other way round: the real 2025 bundle runs in
Chromium with RYN on top, and the test plays it.

```
node harness/boot-2025.js            # the real bundle in a browser: 25 configurations, 856 checks
node harness/ryn-rewrite-check.js    # RYN's own rewrite of the bundle, run and inspected
node harness/ryn-protocol-2025.js    # the wire format, read out of the bundle and RYN
node harness/ryn-hooks-check.js      # every hook: does it match, does what it injects resolve
node harness/ryn-sign-check.js       # RYN's frame signature against HMAC-SHA256 and the game's
node harness/ryn-wire-check.js       # RYN's own session for bots against the game's functions
node harness/ryn-shame-check.js      # RYN's shame counter against the server's own rule
python3 harness/ryn-2025-mutate.py   # 49 deliberate breakages, static checks: 49 caught
python3 harness/ryn-boot-mutate.py   # 41 deliberate breakages, browser test: 41 caught
```

---

## Round five (v2.6): bots signed in, your name's colour, the grid, hats, the lobby

v2.6 starts from the 2.5.1 file you tested (another fork of v2.5): its Frost
Helm in the snow, its early stop of the page's own copy in fast injection and
its sprite fallbacks are all kept, merged with what follows.

### Bots: "turnstile API not available", every time

You are signed in. The game only loads Cloudflare's script for a player who
needs a check, and a signed-in player's join goes through on the account
alone. So there was no `window.turnstile` on the page. Every bot stopped at
"No Cloudflare check for the bot (turnstile API not available)" before it had
tried anything. A bot is a guest and always needs a check, so RYN now loads the
same script itself, the way Glotus does, and waits for it.

The harness reproduces this exactly (`+signedin`: an account, and the game's
own Cloudflare load skipped). With 2.5.1 the bot never opens a socket. With
v2.6 RYN loads the script, the bot joins and spawns.

What else was taken from Glotus, whose bots get in on the live game:

- **The check is shown.** It is a visible card in the middle of the screen
  ("Verify bot connection"), not an invisible widget in a corner. It usually
  ticks itself in a second or two and goes. Two run at once, the rest queue,
  and each gets three minutes. Cancel or Escape stops them. The card does not
  block the game.
- **The device id is yours** (`moo_did`), as the game and Glotus send it.
  v2.5 gave each bot a new device, which is the one thing a join API has
  reason to be strict about.
- **The host is the server's name alone**, and the protocol module is
  imported from the page's import map if RYN's copy of the game did not
  capture it. A pinned server cannot be joined without it, and RYN now says so
  rather than sending frames the server drops.

### Your name stayed white

The game draws names through its renderer's `text` call. RYN's nameColor hook
found nothing on the live build. 2.5.1's fallback only ran while that hook was
silent, and only for some styles. Now any name the renderer is given that is
yours is drawn in your colour, whatever the hook did. It is also drawn again
on RYN's overlay, the top layer, exactly where the game put it. If the
renderer is ever handed your name in a form RYN cannot recognise, RYN draws it
on top from the player itself, laid out the way the game lays out a name and
its clan tag.

### The grid

Your screenshot measured one grass pixel in nine as grid line: the RenderGrid
hook had found nothing on the live build either. The grid is now removed at
the renderer, which drops any long, straight, black line at a few percent,
whatever code draws it. Your 2.5.1 screenshot already showed it gone; v2.6
keeps that and widens the hook.

### Hats and the store's pictures

The game asks for each sprite once. A request that fails leaves the store
broken and the hat missing for the rest of the session. RYN now asks again
three times (1.5 s, 5 s, 15 s), past any cached refusal. If a sprite still
will not come, RYN says what the site answered. The harness now serves real
images (it answered 404 to all of them before): with each hat and weapon
refused once, the store fills and the hat is on you.

### Breaking felt heavy

When nothing changes, the 2025 server skips the update for that tick. RYN then
runs its own ticks, a little late on purpose. With a normal ping, Auto Grind's
tap arrived one tick after the window, so it swung every 668 ms instead of
every 556. Auto Grind now holds the press from two ticks before the reload
ends. A held press swings exactly when the reload runs out, so the timing is
the server's again. It lets go the first tick it is not grinding: switched
off, an enemy near, or placing. `+grind+quiet+lag` (90 ms ping): 556 ms.

### The Crab King

The game takes bosses out of the name and health loop and puts one bar
across the top of the screen. The King now goes through the same path as any
animal: its name over it, and RYN's health bar and number under it.

### The lobby

- **Sign in / Sign out** are in a row at the top, across from the RYN mark,
  instead of mid-screen. Sign in is an iris pill. Signed in, a sage chip says
  so, with Sign out in rose beside it.
- **Clan and Friends** are in the same row. They open the game's own clan card
  and friends list, over the lobby. For a guest, both ask you to sign in, as
  the game does. A dot on the game's button shows on RYN's.
- **The loading screen** says what it is waiting for (the page, the game, the
  servers, then Cloudflare, or your session when signed in) and stays exactly
  as long as that takes. It used to hold every load for at least 2.3 s.

---

## Round four: the sign-in card after a kill, shame 20, bots on the live join

### A sign-in card every kill, and the kill visuals broken: one hook

Every corpse, every one of the twenty kill animations and every ghost RYN
draws goes through the game's own player drawer, which the `renderPlayer` hook
captures from the bundle. Its pattern was "the first two-argument function that
opens on `a = b || c,`". On the 2024 bundle that was the player drawer. On the
2025 one the first such function is the game's **sign-in card opener**,
`function Zi(e,t){Xa=t||null,rc=e||"",lc.style.display="block",…`.

So from the first kill on, every frame a corpse was on screen, RYN "drew" it by
opening the sign-in card. The card's message was RYN's corpse data, shown as
"[object Object]". The card also took the mouse wheel, so the zoom stopped
too. The pattern now names the drawer exactly: `t=t||M,t.lineWidth=`, which
matches only that function on both bundles.

Found by adding a kill to the browser test (`+kill`) and tracing what opened
the card. The rewrite check now insists the captured function is the drawer,
and `+visuals` turns on every Visual option and kills the rival once under
each of the 22 kill-animation settings. Before: all 22 opened the card. Now:
none, with no errors.

### Shame 20: RYN's counter, not the server

The server's rule is unchanged in the 2025 bundle: on **eating**, if you were
hit since your last food, a heal within 120 ms adds one, and at 8 you get the
clown for 30 seconds and the count starts over; a slower heal takes two off.
RYN cannot see eating, only health going up. Its model counted every gain
after a hit as an apple and never reset at 8. In 2025, health also comes back
from emerald lifesteal, cheese's heal over time, healing pads and regen hats,
so players showed 20 with no clown.

It now counts only gains that look like food: 20, 30 or 40 (apple, cheese,
cookie), or whatever was left to full. It also resets at 8, as the server
does. Auto Heal stops instant heals at 7 of its own count, so the inflated
count was also holding your heals back. `ryn-shame-check.js` plays health
sequences into the model; the old one fails 5 of its 8 checks.

### Bots

**Does a bot need a token?** Yes, its own Cloudflare check (one per join, used
once), the same as your own join. Bots join as guests, so no account is
needed except on the shield (members-only) servers. RYN solves the check
automatically. Sometimes Cloudflare wants a click.

What made bots fail when it did:

- **Cloudflare wanted a click, and nobody saw it.** The bot's check showed
  itself as a small box in the bottom-right corner, said nothing, and gave up
  after 20 seconds. RYN then fell back on two tokens that cannot work in 2025:
  - your own, which your join has already spent at `/join`, and which, if it
    hadn't been, your next Play would then find spent;
  - a 2024-style captcha the 2025 join does not take.

  The join API refused the bot and its row vanished. Now the check comes to
  the middle of the screen with "Cloudflare wants a click to let your bot in"
  and waits two minutes. With no token, RYN says why and stops. Tested with a
  25-second click (`+slowclick`) against a join API that takes each token
  once, as Cloudflare does: v2.4 never opened a socket; now the bot joins.
- **Names can be taken.** A registered player's name is theirs alone; the
  game checks `/name-check` and refuses "This name belongs to someone else".
  The default bot name was yours, and if you are signed in it is taken.
  Every bot is now its base plus its slot number, always (yytt1, yytt2…), cut
  to 15 characters with the number kept whole. A name the API calls taken is
  skipped for the next free one (yytt1 → yytt101). A bot the server silently
  never spawns tries the next name and says so. A bot the server turns away
  shows the server's own reason.
- **A device id.** The 2025 join API gives each browser a device id and the
  game sends it back on every join. Each bot is now a device of its own: an id
  of its own, kept for next time, never yours and never shared by two bots at
  once. (v2.6 reverses this: bots send yours, as Glotus's do. See round five.)
- **The sitekey** a bot's token is minted for is read from the game, not
  assumed.

If a bot still fails, it now says why on screen.

---

## Round three: bots, the zoom, Auto Grind, the new animals

### Bots: no bot could join

A bot's connection is RYN's own, so RYN has to build the whole 2025 session for
it: the opcode tables, the per-message masks, the keystream, the signature, the
build id. It used to borrow each of those from the game's bundle through a hook
that recognises the function by the shape of the obfuscated code around it,
and the obfuscator reshapes that code at random on every build. One call
becomes `o.xyz(fn, a, b)` in one build and stays `fn(a, b)` in the next. The
live build is newer than the one this was first tested on, and on a reshaped
build those hooks miss: the bot's frames went out unsigned, its socket URL had
no build id, and the server closed it. Your own connection uses the game's
code directly, so it was fine. That matches what was reported.

The session is now in RYN as well, written out plainly (`RynWire`):

- the opcode alphabets and constants are read out of the bundle's own text as
  RYN loads it;
- the build id comes from your own socket's URL, where the game put it;
- `mixKey`, `BUILD_SALT` and `BUILD_ID` come from the game's `moomoo-protocol`
  module itself, captured where RYN imports it.

The game's own function is still used wherever a hook finds one.
`ryn-wire-check.js` holds every piece against the game's functions lifted out
of the bundle. The browser test runs on a bundle reshaped the way the
obfuscator reshapes it (`+reshaped`). Before this change no bot joined there;
now bots join, sign, mask and read their frames.

**Account or guest:** bots join as guests; no account is needed. The one
exception is a server for signed-in players (the shield in the list), which
refuses guests. RYN now says so instead of the bot silently vanishing from its
row. Every other refusal is shown too, on screen and in the console:

- too many joins at once: RYN waits and tries twice more with a new token;
- a Cloudflare token the API would not take;
- the server's own close reasons (codes 4001–4004).

### The zoom

The 2025 game caps the zoom-out in a constant it works out once, at load
(`const Ex = us * 1.15`). RYN's zoom changes the screen size the game reads,
and that one read froze it. The cap now follows the live value
(`zoomOutCap`). The test turns the wheel eight notches out and measures the HP
bar: ×2.20 smaller, then back to the same size coming in. v2.3 got ×1.14.

### Auto Grind: back to the old one, and the stall when breaking

Auto Grind is the old version again, byte for byte. The held attack from v2.3
is gone.

What made it stall was not Auto Grind. The 2025 server sends the player update
as a list of changes: who moved or turned, whose look changed, who went out of
view. On a tick where nothing changed there is nothing to say, and, by every
sign, it says nothing. Everything RYN does, it does once a tick, and that
update *was* the tick: the reload count, the hit a swing reports, every module.
Standing still while grinding, the updates stop. The turret got hit once, and
RYN then waited for something, anything, to move.

When the updates stop now, RYN runs the ticks itself. After 200 ms of silence
it runs an update with nothing in it, which is all the server would have said,
then one every 111 ms until the server speaks again. On a server that does send
its empty ticks, three of them a tick apart stand this down for the session.

Tested against a server that says nothing on a quiet tick:

| | Before | After |
|---|---|---|
| Swings in 8 s | 0 | 14 |
| Gap between swings | — | 558 ms |
| Turrets broken / put back | 0 / 0 | 6 / 6 |

558 ms is the most the great hammer's 400 ms reload allows in 111 ms ticks.
Against a server that also sends an empty update once a second, a version that
gives up on the first empty one gets 3 swings in 8 s, 3.2 s apart. That is the
"one hit, then a wait" exactly.

Auto Heal, the anti-insta and the rest of the tick-driven modules were held up
the same way whenever you stood still with nothing moving near you; they no
longer are.

New: **Emerald** (the 2025 fifth tier, members only) as a grind target. Ruby
stays the default.

### Trap Animal and the new animals

Trap Animal had a list: Bull, Bully, Wolf. It now takes the rule that list
came from: an animal that charges you and that a trap can hold. The game
decides the second part; its collision code skips the trap for any animal
marked `noTrap`. On the 2025 animals that adds the **Boar** and the **Yeti**:

| Animal | Trap Animal? | Why |
|---|---|---|
| Boar | yes | charges, trappable |
| Yeti | yes | charges, trappable |
| Crab King | no | `noTrap`: the game's traps cannot hold it |
| Crab | no | `noTrap` |
| Crabling | no | `noTrap` |
| Sheep | no | harmless, like the cow |

The 2025 server sends animals as changes too, so an animal standing still
(one held in a trap, above all) stopped being anyone's nearest animal. Trap
Animal, the anti-animal hat and every swing at an animal lost it the moment it
stopped. Every animal still in view is now offered again each tick.

Tested with a boar the server announces once and never updates, a step away:
a trap goes down straight at it (0.00 rad) 64 ms after the trap is picked. A
crab in the same place gets none. With the old list, or without the per-tick
offer, the boar got no trap.

### Anything else the update broke

Every packet the 2025 game handles was compared with how RYN reads it, and
RYN's tables with the game's:

- **Unchanged.** Weapon speeds, damage and ranges, items, hats, accessories,
  projectiles, the game config, food heals and the shame rules all match 2025.
- **Nothing to read.** The new packets `F` (account stats) and `W` (a boss's
  attack telegraph) carry nothing RYN needs. A player's data gained three
  fields at the end (aura, boss mode, clan), after the ones RYN reads.
- **Map ping.** RYN sent `["S"]`; the game sends `["S", 1]`.
- **Chat.** Capped at 30 characters, as the game's chat box sends it. A frame
  the game itself could never send is one a server checking its frames can
  refuse.
- **Buildings.** A row whose item field names no item is a resource, which is
  how the game reads it. RYN accepted only `null` there.

---

## Round two: in the game

You got in. Then: the frame rate fell through the floor, getting in took a
minute or two and not every time, the HP number sat to the right of its bar,
numbers were missing, and Auto Grind hit once and then waited.

### The frame rate

RYN's zoom fired a window `resize` on **every frame**, zooming or not. On the
2025 game that runs the game's whole resize: a new WebGL drawing buffer, the
renderer's own resize — which throws away every cached glyph and shape and
uploads them again — and every resize listener on the page. That was most of
each frame. Now the zoom resizes only while it is actually moving, calls the
game's handler directly (`exposeResize`), and the tail of that handler is made
idempotent (`viewport`): the canvas is resized only when its size changes, the
glyph cache rebuilt only when the scale moves by more than 8%. The test counts
writes to the canvas size while you stand still: 0.

Also: the weather draws into RYN's overlay instead of a canvas of its own (one
full-screen layer fewer to composite every frame), and the target overlay hides
when it has nothing to show.

**Frame signatures.** Every frame the 2025 client sends carries an HMAC-SHA256,
which the game computes with its own SHA-256 run through the obfuscator — every
rotate a call through an object of one-line functions with string-decoded names.
0.25–0.37 ms per frame in Chromium, on the main thread, for every frame you and
every bot send; a burst in a fight is a dropped frame on its own. RYN signs with
a plain implementation now (1.2 µs), the key's padded blocks hashed once per
session. It is not trusted on its word: each session's first frames are signed
both ways and the game's bytes are what is sent; one disagreement and it is
never used again. RYN's script time in the profile fell by a third.

### Getting in, first time

Two things made it a lottery.

1. **RYN's loading screen borrowed the Cloudflare challenge's container**, and
   on the way out handed it to a slot in RYN's lobby. On the 2025 page that
   container lives in the game's "one quick check" dialog — the only thing the
   game opens when Cloudflare wants a click. Moved, its iframe reloaded and the
   check in progress was thrown away; and a challenge that then wanted a click
   sat in a slot the 2025 flow never reveals. The dialog opened empty and Play
   waited for good. Whether you hit it depended on whether Cloudflare asked for a
   click that time. The loading screen leaves the container alone now.
2. **Injected late, the page's own copy of the game ran in full** beside RYN's:
   two server pollers, two Turnstile scripts, two sets of timers and listeners.
   It used to be stopped only at its first frame. It is now stopped at its first
   line: the bundle opens with `document.createElement("link")`, and that call,
   coming from the page's own module, starts RYN's copy in its place and ends
   the module there.

Tested against a Turnstile that behaves like Cloudflare's — the script arrives
late, a challenge takes time, an iframe that is moved reloads, and a mode in
which every challenge wants a click, answered only when it is on screen and on
top. Before: with a click wanted, late injection never got in, and neither did
document-start once the page's container was empty as it is on the real page.
Now: in under 150 ms after Play, or about 2.6 s when a click is wanted (the game
itself waits 1.5 s before it opens the dialog).

### The HP number, and the numbers

RYN draws through a bridge to a 2D canvas over the WebGL one. Its defaults were
the browser's — `start`, `alphabetic`, `10px sans-serif`. The 2024 game left its
context centred, middle-aligned, in Hammersmith One, and the HP number never set
its own alignment, so on 2025 it drew from the centre to the right. The defaults
are the 2024 game's now; the test finds the number's middle within 1 px of the
player's.

On a scaled display (125%, 150%) the overlay was also the wrong size on screen —
sized by its pixels rather than the game canvas's CSS size — so every number,
bar and ring slid right and down off its player, some of them off screen. It
matches the game canvas now; tested at 150%.

Checked on screen: the HP number, the player IDs, the shame counter, the damage
numbers. Name colours (your own, RYN players') were done by recolouring
`fillText` calls; the 2025 game draws names glyph by glyph from a cache, so that
could only ever recolour a letter everywhere. The colour is now picked where the
game picks a name's colour (`nameColor`).

### Auto Grind

*(Undone in round three, at your request: Auto Grind is the old tap again, and
what made it stall turned out to be the server's quiet ticks. See above.)*

It tapped — pressed and released in one tick — on the tick RYN's own reload count
said the weapon was ready. A tap that reaches the server while it is still
reloading is dropped, so every hit depended on that count agreeing with the
server's to the tick. It now **holds** the attack while it grinds, the way you
would with the mouse, and the server swings by itself the moment the weapon is
ready.

Tested against a server that plays the swing by the game's own shared rules
(only the weapon in hand reloads; a press latches), and against a stricter one in
which a release in the same tick takes the press back — where the old tap got no
hits at all. Either way: a swing every 557 ms, the great hammer's 400 ms reload
counted in 111 ms ticks; through turrets breaking and being put back; in Tank
Gear; and let go the moment it is switched off or an enemy comes into reach.

`boot-2025.js` runs vanilla (no RYN, the control), RYN injected at
document-start, and RYN injected late (what your console showed:
`win.requestAnimFrame → Injector.init`). Each runs once with a plain session and
once with a **pinned** one (mixed key, salted tables, every frame masked) using
the game's own crypto functions lifted out of the bundle
(`harness/proto-2025.js`).

---

## What was broken, and what fixed it

### 1. RYN's copy of the game never ran (the reported error)

```
Uncaught SyntaxError: Cannot use import statement outside a module
```

The bundle opens with two imports back to back. The injector's pattern ate the
`;` between them, which was the only thing the second could anchor on, so it
stayed a raw `import`. Also: `import.meta.url` (module-only syntax) was left
in, the `<script type="importmap">` that says where `moomoo-protocol` lives was
removed with every other script mentioning `assets`, and a bare specifier was
resolved against `/assets/`.

Fixed: each import becomes `await import()` without consuming its neighbour's
anchor, `import.meta` is replaced, the import map stays in the page and its
entries are applied when resolving.

### 2. The world froze and the player was invisible

Two causes, both inside the game's frame:

- **The 2024 `RenderGrid` pattern deleted 1,238 characters of the bundle**,
  `const Oe=…` included, so every frame threw `Oe is not defined`.
- **The game now draws with WebGL.** Its renderer implements a slice of the 2D
  API; RYN's overlays draw with paths (`beginPath`, `arc`, `fillText`). The
  first such call threw, the frame never reached `endFrame()` or its
  `requestAnimFrame`, and the canvas kept the last frame that finished: the
  menu's world, no player.

Fixed: the grid hook now targets the two grid loops only. RYN adopts the
game's renderer (`Renderer._adopt`) and forwards the 2D calls it lacks to an
overlay canvas whose transform mirrors the renderer's exactly. The frame and
every RYN draw hook are guarded, so a RYN bug costs one overlay, never the
picture.

### 3. Packets: the world updates changed shape

| packet | 2024 | 2025 |
| --- | --- | --- |
| `a` players | one list, 13 fields each, everyone in view every tick | positions `[sid,x,y,dir*100]`, appearance `[sid,…10 fields]` only when it changes, a list of who left view |
| `I` animals | 7 fields | 8 fields, `dir*100`, a list of who left view |
| `6` chat | always a player | sid `-1` is a server notice |
| `F`, `W` | — | new: stats, area effects |

RYN read the new `a` with the old stride (x where the weapon goes), and every
tick threw in `predictWeapons`. It now keeps the last-known state per sid and
rebuilds the layout its model reads. New game data added: animals 9-14 (boar,
yeti, Crab King, sheep, crab, crabling), hats 59-61 (Scout Hat, Frost Helm,
Crab Shell), a fifth weapon tier (members-only, lifesteal).

### 4. Pinned sessions: the masking was wrong both ways

The first pass guessed. The game's real code, decoded:

```js
receive:  xe.mask && Nl(frame, wf(xe.mask.s2c, ++xe.received))        // IN PLACE, on event.data
send:     xe.mask && Nl(payload, bf(xe.mask.c2s, signature))
```

RYN used one function for both directions, the whole mask object, and the
sequence number; worse, on the main socket it unmasked **the game's own
buffer** and bumped **the game's own counter**, so the game then unmasked every
frame a second time with the wrong count. On a pinned connection nothing after
`io-init` would have decoded, in the game or in RYN.

Fixed: on the main socket RYN reads a copy and touches neither; a bot's socket
uses its own counter; outgoing is keyed on the signature. The primitives are now
found by the shape of the code that uses them, not by minified names (the live
build, `index-3cf65e26`, is newer than the one provided).

### 5. RYN's first ping went out unsigned

RYN's listener runs before the game's, so at `io-init` the game had no session
yet and its `send()` wrote the ping raw: four bytes, no signature. The server
drops the connection on a frame like that. The first ping now waits one task,
and nothing is sent on the main socket until the game's own session exists.

### 6. The server list on the right

The API host moved (`api.moomoo.io` → `api-prod2.moomoo.io`), and the 2025 menu
has no `<select>` any more. The panel now reads the game's own server model
(regions, counts, ping, members-only), refreshed by the game every five seconds,
and picking a row calls the game's own `choose()`. Members-only servers are
listed and marked locked for guests.

### 7. Sign in / register

RYN replaced `window.FRVR` with a stand-in that had no `auth` and blocked the
real SDK ("[FRVR] sdk failed init"), hid the Sign in button with the rest of the
menu, and left the account card and the "one quick check" Turnstile dialog under
its own lobby. Now the real SDK stays (RYN only switches off ads), the game's
Sign in button sits beside Enter Game, and the account card and the check dialog
open above the lobby. Email code, password login and registration all go through
the game's own card.

### 8. Late injection: two Turnstile widgets

Injected late, the page's own copy of the game also renders Turnstile into the
same container; Cloudflare refuses the second render, and the refused copy can
never reset its token. The page's copy is now told no.

### 9. Bots

Bots connected the 2024 way. They now trade their Turnstile token at `/join`
for a ticket (`tk:`), carry `b=<BUILD_ID>`, and sign and mask their own frames
correctly on a pinned session. The game now locks `window.WebSocket` at load,
which left RYN's socket trap installed for good and made every bot socket
re-bind the main client to a bot; bot sockets are marked and skipped. Bots join
as guests.

### Smaller

- The game writes "Enter Game" / "Play as Guest" into a `<span>` inside the
  button; RYN's lobby deleted it and the game threw at load.
- A malformed hook pattern used to throw out of the whole rewrite; now it is one
  hook not installed.
- The PACKET readout counts the game's own frames (2025 sends through a saved
  `WebSocket.prototype.send`).

## Hook status

68 of 70 hooks install on the 2025 bundle (round two added `exposeResize`,
`viewport`, `nameColor` and `fastSign`; round three `zoomOutCap`). `gameInit`
served an altcha start path the game no longer has; `buildingTint`'s ternary
is now an if-statement, matched by `buildingTint2025`.

Installing is not enough. `renderPlayer` installed on 2025 and captured the
wrong function (round four), so the rewrite check now also asks that the
function it captures is the player drawer.

## Not verified, and what to know

- **The live server.** moomoo.io is not reachable from where this was tested.
  The page HTML is synthesised from what the bundle reaches for, the API and the
  game server are mocks, and `moomoo-protocol` is a stub. The mocks speak the
  protocol the bundle speaks (the pinned crypto is the bundle's own code), but
  only the live server can confirm it accepts the result.
- **Anti-userscript code.** The 2025 game probes for userscript managers, may
  show a red "userscript" warning bar, and reports integrity flags to the server
  (`T` packet). RYN does not hide from this. If the server acts on those flags,
  RYN cannot prevent it. Bots send no such reports, and RYN does not forge them:
  if the live server drops connections that never report, bots will be dropped
  soon after joining. That now shows on screen with the server's reason.
- **Members-only servers** need you signed in; bots cannot join them.
- **The live build.** moomoo.io cannot be fetched from here, so the hooks are
  tested against the build this started from (`index-cfaab428`), and the bot
  session also against a reshaped copy of it. A hook that misses on the live
  build prints `Failed to find: <name>` in the console; the bots no longer
  depend on any of them.
- **The server's quiet ticks.** Whether the live server sends nothing on a
  quiet tick cannot be read off the client's code. The symptom matches it
  exactly, and the simulation reproduces it. If the server turns out to send
  every tick after all, the tick watchdog never fires, and it stands down after
  three empty updates.
- **Cloudflare itself.** The Turnstile here is a model of the parts the login
  depends on, not Cloudflare. The loading-screen fault is certain (the page's
  container is moved, and the 2025 game only ever shows the one it owns); how
  often the live challenge asks for a click is not something this can measure.
- **Your injection mode.** RYN works either way, but in Tampermonkey's settings,
  *Inject Mode: Instant* gets it in before `<head>`, where the page's own copy of
  the game is never started at all.
- The map gained a secret area west of x = 0; RYN's map-edge maths assume the
  old bounds there.
