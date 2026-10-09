# Ryn Type 2 harness

Runs Ryn Type 2 in Chromium against the real 2025 game bundle (`fixtures/`)
on a mock moomoo.io page and a mock game server, and plays it: the lobby,
sign-in, Play, the spawn, the in-game overlay, Auto Grind and hand breaking,
and bots through RYN's own menu.

```sh
npm install                                     # playwright, ws, @msgpack/msgpack
node boot-2025.js all ../ryn/Ryn_Type_2.user.js # every configuration below that matters
node boot-2025.js late+hold+quiet+lag ../ryn/Ryn_Type_2.user.js   # one of them
```

Chromium comes from the environment (`PLAYWRIGHT_BROWSERS_PATH`); nothing
else needs to be reachable — the page, the APIs, Cloudflare and the game
server are all served from inside the test.

## Modes and flags

```sh
node boot-2025.js [vanilla|fast|late|toolate][+flag...] [ryn.js]   # or `all`
node ryn-rewrite-check.js   # RYN's own rewrite of the bundle, run and inspected
node ryn-protocol-2025.js   # the wire format, from the bundle and from RYN
node ryn-hooks-check.js     # each hook: does it match, does what it injects resolve
node ryn-sign-check.js      # RYN's own frame signature against HMAC-SHA256 and the game's
node ryn-wire-check.js      # RYN's own 2025 session (bots) against the game's functions
```

`vanilla` is the control (no RYN); `fast` injects RYN before `<head>`
exists, `late` after it, `toolate` after the game has already started.

The flags, each one a way the live game behaves that a plain run would not show:

- `+interactive` — Cloudflare asks for a click. Every challenge wants one, and the
  harness clicks a challenge only when its frame is on screen and on top, as a
  person would. RYN's loading screen used to borrow the challenge's container and
  hand it to a lobby slot the 2025 game never reveals: this mode is how a login
  that "sometimes takes minutes" became a red line.
- `+hidpi` — 150% display scaling. The game draws at the device pixel ratio, so
  an overlay sized by pixels alone lands off its players.
- `+grind` — Auto Grind against `server.js`'s `sim`: the server's side of a
  player who swings, by the game's own shared rules (only the weapon in hand
  reloads, a press latches `gathering`), with turrets counted the server's way
  (`S` on every place and break, two at most). `SIM_LATCH=0` runs the stricter
  rule in which a release takes back a press sent in the same tick — every RYN
  attack is a tap, so nothing of RYN's can swing there; it is not the live
  server. `SIM_POSITIONS=delta` leaves a player who has not moved out of the
  tick's position list. `GRIND_TRACE=1` prints every swing, hat, weapon,
  placement and break.
- `+quiet` — the server sends no player update at all on a tick where nothing
  changed. Standing still, the updates stop; everything RYN does once a tick
  stopped with them, and Auto Grind hit once and waited (0 swings in 8 s here
  without the tick watchdog). `+heartbeat` is the same with an empty update
  once a second, which must not talk RYN out of running the missing ticks.
- `+trap` — Trap Animal on, a pit trap picked from the upgrade bar, and a boar
  (a 2025 animal) a step away, announced once and never updated, as an animal
  standing still is on the 2025 wire. It must get a trap; a crab put in the same
  place afterwards (`noTrap`) must not. `TRAP_DEBUG=1` prints what was placed.
- `+reshaped` — the bundle's crypto code reshaped the way the obfuscator
  reshapes it between builds. The hooks that found the game's session functions
  by shape miss here, as they did on the live build; bots must still join.
- `+members`, `+busy` (or `JOIN_REFUSE=members|busy`) — the join API turns the
  bot away as a guest on a server for signed-in players, or answers its first
  join "too many". The bot must say why, and in the second case get in.
- `+kill` — the rival dies to me. Nothing may ask me to sign in, and RYN must
  keep drawing: its corpse is drawn through the game's player drawer, which a
  loose hook pattern had swapped for the sign-in card's opener on 2025.
  `+visuals` turns every Visual option on and kills the rival under each kill
  animation in turn. `SHOW_TRACE=<element id>` prints the stack of whatever
  shows that element; it is how the card's opener was found.
- `+heal` — the server hurts me down to 60; Auto Heal has to eat.
- Bots on the 2025 join: the fake API takes each Cloudflare token once, as the
  real one does; it gives each new device an id; and `/name-check` says the
  harness bot's first name (bot11) is taken. `+slowclick` answers the bot's
  check only after 25 s; `+tserror` fails it outright (the bot must say so,
  and never offer a token twice); `+silentname` has the server ignore a spawn
  under one name; `+kickname` has it turn the bot away with a reason.
- `+signedin` — I am signed in: the join goes through on the account and the
  game never loads Cloudflare's script, as on the live build. A bot must still
  get its check (RYN loads the script). Also checks the lobby's account row,
  Clan card and Friends list for a signed-in player.
- `+hats` — I wear a hat and the store is opened: every picture must load and
  the hat must be on me. Sprites are served as real PNGs in colours nothing
  else uses (hats magenta, weapons cyan). `+spritefail` refuses each hat and
  weapon once first (`SPRITEFAIL_KINDS`, `SPRITE_DELAY` to vary it).
- `+restyled` — the bundle's grid and name-colour code written another way, so
  RYN's hooks for them miss, as on the live build: the grid must still go and
  my name must still take my colour. `+oddname` also hands the renderer my
  name in a form RYN cannot recognise, so only its redraw from the player can.
- `+boss` — a Crab King above me: it must get a health bar and number under it.
- `+lag` — 45 ms each way on every frame (`NET_DELAY_MS` for any other);
  `+grind+quiet+lag` is where Auto Grind's tap used to land a tick late.

- `+pool` — the token pool (Bots → Spawn, behind `!tk`) is switched on and
  left to fill before the bot is added: it must stop at its size (4), and the
  bot must spend a token made before the press.
- `+hold` — breaking by hand: Auto Grind off, the mouse held down on the two
  turrets in front of me. The tool hammer must swing every fourth tick
  (444 ms), Tank Gear on for every swing, and stop when the button comes up.
  `+hold+quiet+lag` is where 2.5.1's taps landed a tick late (557 ms).
- `+reload` — in, spawned, then the page reloaded (F5); everything after is
  measured on the second load.
- `+botacct` — bots with accounts of their own ("Bots sign in"). Bot 2 signs
  in with a typed password (`bot1@mock`/`pw1`), Bot 3 with an email code
  (`bot2@mock`, code `424242`), Bot 4 (`bot3@mock`, a password account) asks
  for a code and must sign in on the bot password the dialog filled in
  (`123456789aa`). A wrong password, and an account whose email is not
  verified (`bot4@mock`), must each be said. All must join on their
  account's token alone (no captcha, no Cloudflare check) under a random name
  claimed past a taken one (`/name` answers 409 once); removed and added
  again, and after a reload, they must come back on the same accounts with
  nothing typed (tokens run out in `BOT_JWT_S`, 70 s). bot2's and bot3's
  sessions end after 10 s, so Bot 3 — no password saved — must get back in on
  the bot password by itself. Switched off, a bot is a guest. The fake FRVR
  SDK keeps its session in localStorage and a cookie, and the page's own must
  stay untouched throughout.
- `toolate` (a mode, like `fast`/`late`) — RYN injected after the game has
  already started, as a cached reload can do: it must reload the page once.
  `toolate+lateagain` — the second time within a minute: it must stand aside
  (the game still playable, one copy) and say why.

The fake Turnstile numbers its tokens across reloads (`sessionStorage`), as
Cloudflare never hands the same token out twice; it used to hand out
`cf-token-1` again after a reload, which the fake `/join` then refused.

Every RYN run also measures the grid (one grass pixel in eight is grid line
without RYN, next to none with it), names the loading screen's waits and how
long it stays after it is ready, and, for a guest, the lobby's Sign in, Clan
and Friends. `LOBBY_PNG=<path>` saves the lobby as it first shows.

Every run also checks that only one copy of the game runs (late injection used to
run the page's own copy beside RYN's), that Turnstile's script loads once and no
challenge is thrown away by moving its frame, that Play gets you in on the first
press, that the game canvas is not resized between frames, and that the HP
number sits centred under the bar. `PERF=1` adds frames per second, main-thread
time and the top functions by self time — read the frame rate with care here:
SwiftShader composites in software, so extra canvas layers cost far more than on
a real GPU, and main-thread time is the number that carries over.

`boot-2025.js` serves `fixtures/moomoo_index_new.js` and `moomoo_vendor_new.js`
as modules from `https://moomoo.io/assets/` behind an import map, stubs
`moomoo-protocol`, the FRVR SDK (with the `auth` surface sign-in calls) and
Turnstile (including Cloudflare's "already rendered" refusal), mocks
`api-prod2.moomoo.io` (`/servers`, `/join`, `/name-check`, `/top`), and puts
`server.js` behind `routeWebSocket` speaking the 2025 world packets. With
`+pinned` the server masks, salts and signs with the game's own primitives,
lifted out of the bundle by `proto-2025.js` — so the masking is the bundle's,
not this harness's idea of it. It then plays: server list, Sign in, Enter Game,
spawn, the player on screen, RYN's overlay, and a bot through RYN's own menu.

`fast` injects RYN before `<head>` exists; `late` after it — the module tag has
then been prepared, and Chrome runs it however it is removed. RYN now stops that
copy at its first line; the `late` run is what proves it.

