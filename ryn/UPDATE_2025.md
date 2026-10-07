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
node harness/boot-2025.js            # the real bundle in a browser: 6 configurations, 130 checks
node harness/ryn-rewrite-check.js    # RYN's own rewrite of the bundle, run and inspected
node harness/ryn-protocol-2025.js    # the wire format, read out of the bundle and RYN
node harness/ryn-hooks-check.js      # every hook: does it match, does what it injects resolve
python3 harness/ryn-2025-mutate.py   # 30 deliberate breakages, static checks: 30 caught
python3 harness/ryn-boot-mutate.py   # 16 deliberate breakages, browser test: 16 caught
```

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

63 of 65 hooks install on the 2025 bundle. `gameInit` served an altcha start
path the game no longer has; `buildingTint`'s ternary is now an if-statement,
matched by `buildingTint2025`.

## Not verified, and what to know

- **The live server.** moomoo.io is not reachable from where this was tested.
  The page HTML is synthesised from what the bundle reaches for, the API and the
  game server are mocks, and `moomoo-protocol` is a stub. The mocks speak the
  protocol the bundle speaks (the pinned crypto is the bundle's own code), but
  only the live server can confirm it accepts the result.
- **Anti-userscript code.** The 2025 game probes for userscript managers, may
  show a red "userscript" warning bar, and reports integrity flags to the server
  (`T` packet). RYN does not hide from this. If the server acts on those flags,
  RYN cannot prevent it.
- **Members-only servers** need you signed in; bots cannot join them.
- The map gained a secret area west of x = 0; RYN's map-edge maths assume the
  old bounds there.
