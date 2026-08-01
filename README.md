# moomoo.io userscripts, updated for the current client

Seven scripts. Five were current-generation clients that needed the new
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
- **`LemonMod.user.js`** / **`LemonModVisuals.user.js`** (v3.0) — 2019-era
  protocol; transport fixed and packet vocabulary mapped forward.

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

The script still `@require`s **jQuery and jQuery UI from lemonmod.com**, which
is a genuine hard dependency. Whether that host is reachable could not be
verified from here. If the script does not load at all, that is the first thing
to suspect. The requires were left pointing there because the jQuery version
served is unknown and swapping majors could break the mod.

Nothing here has been run against the live server.

---

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

The test harness pulls the code under test straight out of the shipped scripts
and out of the game bundles, so the tests cannot drift from what ships. Run
them with `npm test` — 187 checks.

None of them has been verified against the live server; that needs a
browser and a real Turnstile token.
