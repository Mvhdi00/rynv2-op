# Ryn Type 2 — 2.8.0

## 2.8.0: the 3d3599b6 build (protocol module s16nvz)

The live game moved to `index-3d3599b6.js` with a new `moomoo-protocol`
module, `s16nvz.js`. On that build 2.7.0 could not run at all, and a refresh
broke it for good:

- **The game never started under RYN.** The new bundle ends in
  `export{m as U};`, and RYN's copy of it failed to compile. Exports are now
  converted like the imports.
- **Refresh, enter again, nothing works.** The game now saves your skin colour
  itself, as plain text. RYN had set it to `"toString"`, so on the next load
  reading it threw inside RYN's start-up: no lobby, and Play did nothing.
  Reproduced on the harness with 2.7.0, and fixed. RYN reads non-JSON values,
  and only sends real colour numbers.
- **Bots and packets.** The obfuscator now routes different calls through
  proxy objects, so the five crypto hooks (session, receive, sign, send,
  fastSign) found nothing. They now recognise a call written either way, on
  both builds. A bot loads the protocol module itself if it was not captured.
  If it still cannot, it leaves with a message, rather than joining with keys
  the server refuses.
- **The join API's new VPN refusal** (`403 {error:"vpn"}`) gets its own
  message.
- **The server list asks for v=1.28.** The version is now a constant in the
  bundle, and it is read from there.
- **Name colour.** The game draws a nameplate as coloured pieces now; only the
  name piece takes your colour, and your clan tag keeps the game's.
- **Grid.** The grid loops gained the game's own Show Grid flag; the hook
  matches either form.
- **Texture packs** (dev hosts only) import the original game module. RYN
  does not load that chunk, so it cannot start a second copy of the game.

**Signed in, the game puts you on members-only servers.** When your region has
one, the game auto-picks only among them (`Uc`). Bots join as guests and
cannot enter those servers. To use bots, pick a server without the shield.

Verified in the harness on 3d3599b6, with the real s16nvz module (its
WebAssembly mixKey and BUILD_SALT) on both sides of a pinned session:
- vanilla, fast and late;
- pinned, signed in, interactive Cloudflare, refresh, too-late injection, the
  Crab King, and the token pool: 0 failures;
- the old build (`BUNDLE=cfaab428`): unchanged;
- 69 of 71 hooks match on both builds; the rewrite compiles on both; the
  protocol, wire and signature checks hold on both.

---


`Ryn_Type_2.user.js` is the script to install. It is built on the 2.5.1 file
you sent (`src/Ryn_Type_2-2.5.1.js`, unchanged) against the 2025 game bundle
you sent (`index-cfaab428.js` / `vendor-a3a301f0.js`, in `harness/fixtures/`).

Every change below was run in Chromium against that real bundle with the
harness in `harness/` (see [Verified](#verified)). The live servers can't be
reached from here, so "verified" means "against the real game code and a
server that follows its rules", not "on moomoo.io".

---

## 1. Bots: "No Cloudflare check for the bot (turnstile API not available)"

**What was wrong.** A bot is a guest, so its `/join` needs a Cloudflare
Turnstile token of its own. 2.5.1 only ever borrowed the Cloudflare script
the game puts on the page. When there was none at that moment, it gave up on
the spot with that message and never put a check up.

**Now (`RynCF`).**

- **Cloudflare's script is loaded by RYN when it's missing.** It waits a few
  seconds for the game's own copy, then adds its own. It loads in the
  background as soon as you're in a game, so the first bot doesn't wait. If
  it can't load, the message says why: *blocked by an ad blocker / tracking
  protection*, or *never arrived*. It no longer says "not available".
- **Every bot check is a visible card in the bottom-right corner.** The card
  shows which bot it's for, what Cloudflare is doing, and has a cancel ×. A
  hidden widget is a check that never finishes. When Cloudflare wants a
  click, the card lights up and says *"Cloudflare wants a click to let your
  bot in — tick the box"*, a toast points to it, and it waits up to 3
  minutes. Two checks run at once and the rest queue ("N more waiting").
- **Cloudflare's own error codes become words**: sitekey, domain, browser,
  clock, frame blocked, "did not pass this browser".

Tested signed in with no Cloudflare script on the page: 2.5.1 never opened a
bot socket. 2.7.0 loads the script and the bot is in about 0.9 s after Connect.

### Token pool

Checked, and fixed:

- **The pool size was a fixed 99.** Each token is a check of its own and
  lasts four minutes, so 99 meant a check every ~2.5 s for as long as you
  played. That is exactly what makes Cloudflare start asking for clicks. It's
  a slider now: **Bots → Spawn → Pool size**, 1–24, default 4. As before, that
  section shows after typing `!tk` in chat.
- The pool now loads Cloudflare itself (it used to stall at "not ready" on a
  page without the script). Its checks use the same corner cards, labelled
  "Token pool · n of N". **Stop** takes them off the screen.
- Tested: the pool fills to its size and stops. A bot added with a full pool
  spends a pre-made token and is in 34–42 ms after Connect.

## 2. Breaking felt heavy

**Cause.** The 2025 server only sends a world update when something changes.
When you stand still breaking a wall, it sends almost nothing. RYN fills those
gaps with ticks of its own. 2.5.1 ran them 200 ms after the last real update,
then every 111 ms, which put every one of them **89 ms after the server's
real tick**. With any ping over ~20 ms, the hit (and the Tank Gear for it)
reached the server one tick too late, so each swing slipped a tick.

**Fix, in two parts:**

1. **RYN's fill-in ticks follow the server's clock.** Each lands where the
   real update would have arrived, with a little slack for jitter (14–45 ms,
   measured as you play; 4 ms once a quiet spell has started). A real update
   that turns up late for a tick RYN already ran is merged in, not counted
   twice.
2. **Sustained hitting holds the button** instead of tapping it each tick:
   mouse held on something, and Auto Grind. The press goes down two ticks
   before the reload ends, with the hat for the swing (Tank Gear on buildings,
   Bull on players) put on at the same time. The server's own reload then
   decides the swing. Single module hits still tap, as before.

Measured on a quiet server with a 90 ms ping:

| | 2.5.1 | 2.7.0 |
|---|---|---|
| Holding the mouse on a building (tool hammer) | 557 ms per swing (one tick late) | **445 ms** (every 4th tick, the hammer's real rate) |
| Auto Grind (great hammer) | 669 ms per swing | **556 ms** (every 5th tick) |
| Tank Gear on for the swing | yes | yes, every swing |

## 3. Your name colour stayed white

The colour hook worked on the bundle you sent, but on your live build the
name still came out white. 2.5.1's fallback only kicked in when the hook was
completely silent.

Now RYN recognises the game's own call that draws **your** nameplate: your
player's name, over your head, ignoring invisible characters. It draws it
itself in your colour, with the same outline, size and position, on RYN's
overlay. That overlay is the top layer of the world. The game no longer draws
a white copy underneath. Your clan tag and every other name are left alone.

**Not above the menus.** The game's own windows are lifted over that overlay
wherever they're positioned: the shop, the tribe list, the in-game
settings/friends/clan window, the report menu, chat, your profile card, the
clan, sign-in and confirm cards, and the human check. Before this, RYN's
overlay (HP numbers and the rest) could also show through them.

Tested on a build where the colour hook finds nothing, and on one that hands
the renderer your name with a zero-width character: coloured both times.

## 4. Crab King

The game takes bosses out of the normal name/health loop. It shows one bar
pinned across the top of the screen instead, and only while you stand in the
King's pool. RYN now sends the King through the same loop as any animal:

- its name over it
- RYN's health bar under it
- its HP number under the bar, grouped (`312,450`)

There's a switch for it: **Visual → Player HUD → Boss Health Under It** (on).

## 5. Lobby: Sign in / Sign out, Clan, Friends

All of these sit in **one bar across the top, opposite the RYN mark**. They
used to be beside Play and under the name box (the middle of the screen), and
Clan and Friends had no way in at all. Each has its own colour from the
lobby's palette:

- **Clan** (sky): opens the game's clan card. A guest is asked to sign in,
  as the game does. It's hidden on sandbox, where the game has no clans.
- **Friends** (sage): the game's friends list in a card over the lobby. It
  uses the game's own rows, buttons, requests and add-friend box. Close it
  with × or Esc, or by clicking outside. It also opens after a guest signs in
  from the game's "sign in to add friends" prompt.
- **Sign in** (iris, filled) for a guest, with the game's own hint under it.
- **Signed in · name** (sage chip) and **Sign out** (rose) when signed in.
  Sign out uses the game's own sign-out. If FRVR never answers it, so the
  page would otherwise stay "signed in", the page reloads after 6 s and comes
  back as a guest.

A notification dot on the game's own Clan/Friends links shows on these too.
The game's "Your name is permanent" / name-error line is now shown under the
name box. It used to be hidden with the game's menu.

The game's own sign-in, profile, clan and confirm cards take the lobby's
colours.

## 6. Loading screen

It now shows what it's waiting for, as a list, and leaves the moment those
things are done. 2.5.1 held every load for at least 2.3 s.

1. **Loading the game**: RYN's copy of the game is fetched and drawing its
   first frame.
2. **Fetching servers**: the game's server list arrives.
3. **Waiting for Cloudflare** (guest): the game's own check hands it a
   token. **Opening your session** (signed in): your account, from FRVR.
4. **Ready**.

After 2 s on one step it counts the seconds. After 8 s it offers **Continue to
the lobby**. If the game's own check wants a click, the screen doesn't wait:
it leaves and says the game will ask when you press Play. That click can't be
made on the loading screen.

## 7. Stuck after a refresh

Reproduced: when the userscript manager injects RYN **after the game has
already started**, which a cached reload can do, 2.5.1 started a second copy
of the game next to the running one. The result was two games in one page,
Cloudflare refusing the second one's check, and a Play button that did
nothing.

Now RYN checks for that (`window.loadedScript`, which the game sets as it
starts):

- **The first time**, it reloads the page once so it can start first.
- **Late again within a minute**, it doesn't start at all. The game keeps
  working on its own, and a bar at the bottom says what happened. To stop it
  happening: Tampermonkey → *Inject Mode: Instant*.

A normal refresh followed by Play was also tested (guest and signed in): in on
the first press.

## 8. Other things the update moved

- **The server list's API version.** RYN asked for `/servers?v=1.27`, which
  was fixed in its code. It now reads the version out of the game bundle it
  loads, so a newer build's list is asked for at the newer version. Glotus
  already asks for 1.28, which suggests the live game has moved past the
  bundle sent here.
- Checked again against the bundle: 69 of RYN's 71 bundle hooks match and
  resolve, and the other 2 are known to be gone in 2025 (the game still
  runs without them). RYN's rewrite of the bundle compiles. The 2025 wire
  format, the bot session crypto (opcode tables, masks, keystream) and the
  frame signatures all match the game's own functions.

---

## Verified

```sh
cd harness && npm install
node boot-2025.js all ../ryn/Ryn_Type_2.user.js   # 38 configurations in Chromium
node ryn-hooks-check.js                           # every bundle hook matches and resolves
node ryn-rewrite-check.js                         # RYN's rewrite of the bundle compiles and runs
node ryn-protocol-2025.js                         # the 2025 wire format, RYN vs the bundle
node ryn-wire-check.js                            # bot session crypto vs the game's own functions
node ryn-sign-check.js                            # frame signatures vs HMAC-SHA256 and the game
```

New harness flags for this round:

| Flag | What it does |
|---|---|
| `+pool` | Switches the token pool on, lets it fill, then adds a bot. |
| `+hold` | Breaking by hand: mouse held on two turrets, Auto Grind off. Swing cadence, Tank Gear per swing, release. |
| `+reload` | In, spawned, F5, then everything measured again on the second load. |
| `toolate` | RYN injected after the game has started. `+lateagain`: the second time within a minute. |

The fake Cloudflare now numbers tokens across reloads. It used to hand out
`cf-token-1` again after F5, and the fake `/join` refused it, which made any
reload test fail even without RYN.

Not covered here: the live moomoo.io servers and Cloudflare's real
challenges. The harness fakes both by the rules the game's code implies.
