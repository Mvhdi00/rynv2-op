# LemonMod Mix

`! LemonMod v3.0 !` and `! LemonMod - Visuals !`, merged into one userscript
that runs on the moomoo.io the game actually ships today.

Build output: **`LemonMod_Mix.user.js`** — install this and nothing else.

---

## What was wrong

The two scripts were a pair by necessity. Visuals was a **fork of the whole
game bundle**; the main script deleted the real `bundle.js` on its way to the
parser so the fork could take its place, then checked for cookies the fork set
and, if they were missing, cleared `document.body` on a 100ms interval, alerted
`Please UPDATE/install the LemonMod Visuals to use this mod!`, and opened the
download page.

Both halves were written against a protocol the game has since replaced.

### The packets

LemonMod framed plain msgpack `[name, args]` and named its packets the way
moomoo did around 2021 — `sp` to spawn, `ch` to chat, `33` to move, `13c` for
the store.

The current bundle does none of that. On `io-init` the server hands over a
seed and a key; the client derives a **per-connection permutation** of both
opcode alphabets from the seed, so every packet is renamed to a single
character that is different on every connection. Each client frame is then
msgpack `[opcode, args, seq]` — with a **sequence number** — prefixed by
**six bytes of truncated HMAC-SHA256** over that payload.

So a LemonMod frame failed twice over: `"sp"` is not a name in the table at
all, and even a correctly-named frame would be rejected unsigned. That is why
nothing worked, entry included — the spawn packet was the first thing to go
out and the first thing to be dropped.

The same problem ran the other way. Inbound, LemonMod switched on `"1"`,
`"2"`, `"33"`, `"ch"`; the server now sends numeric opcodes that map to
letters. And its third seam — a `WebSocket.prototype.send` wrapper that
decoded the player's own frames to catch chat commands — was reading bytes
that no longer decode.

### The Visuals fork

A fork cannot be fixed by patching it. The copy it carries predates the
transport entirely, so it cannot connect at all, and every game update since
has widened the gap.

---

## What the merge does

### Packets: use the game's own transport

Three seams, all narrow, all pointed at the real bundle through hooks:

| seam | before | after |
|---|---|---|
| outbound | `socket.send(msgpack.encode([name, args]))` | `io.send(name, ...args)` — the game frames it |
| inbound | own `message` listener, own decode | called from inside the game's dispatcher, after the opcode is already resolved |
| sniffer | `WebSocket.prototype.send` wrapper | a filter on `io.send`, before framing |

Handing outbound packets back to the game is the part that matters most. The
sequence counter and the HMAC key live in one object, incremented by one
sender. A mod that framed its own packets would need a second counter, and two
counters on one connection is a desync.

The packet names are translated at the boundary, so LemonMod's own code still
says `["ch", [text]]` and never learns that the wire calls it something else.
`LemonMix.C2S` and `LemonMix.S2C` hold the mapping; every entry was read off
the send sites and the dispatch table in `src/game_index.js`, and
`tools/verify-lemonmix.js` checks them back against it.

### Visuals: rewrite the bundle instead of forking it

The reload bars and the insta-target ring are appended to the game's own
health-bar draw, in the same statement the fork edited, still inside its
`health > 0` guard. The reload state the fork tracked by patching four
functions inside its copy is rebuilt from the packet stream instead, so only
the drawing needs a hook.

Nothing is forked, so nothing goes stale except individual hooks — and an
orphaned hook is a build failure, not a silent one.

### No gate

There is no second script, so there is nothing to check for and nothing to
download. The build asserts that no trace of the gate survives.

---

## Removed

All of it silent in the originals, and none of it optional:

| what | where |
|---|---|
| **Remote code.** `crCheck.php` fetched on every load; if it answered `1`, `cr.php` was fetched and `eval`'d. | main |
| **A beacon** to `https://ksw2-center.glitch.me/mm_aib_1`, base64'd and hidden in an object of decoy numeric keys behind a `Math.min`/`Math.max` over a pile of huge floats, fired from `init()` on load. | **both** |
| **A blocking synchronous XHR** to `code.jquery.com` mid-startup whose response was never read. See [the bugs](#bugs-fixed-along-the-way) — this one did more than waste a round trip. | main |
| **Death telemetry** — an XHR on every death carrying your health, the damage taken, your weapons, hat, clan and several menu settings. | main |
| **A version ping** to `latest.php`, and a forced `location.replace` to the author's download page when it disagreed with the build. | main |
| **A remote stylesheet** from the same host — another way to put content on the page after the fact. | main |
| **Sounds, notification icons and the mouse cursor**, each a request to the author's host, timed to what you are doing in game. | main |
| **A bot routine** that spawned clients and had them repeat a racial slur in chat a hundred times a second. | main |
| **`@require` of jQuery, jQuery UI and msgpack** from the same host. | main |

The codec is now the game's own, sliced out of `src/game_vendor.js`. jQuery is
replaced by the eight methods LemonMod actually calls — it used none of jQuery
UI.

The "crash" payloads were hand-built msgpack blobs pushed down the socket with
no header. Unsigned frames are rejected now, and enough of them close the
connection with code 4001, so the only player they would disconnect is the one
sending them. The raw sender is a no-op.

---

## Bugs fixed along the way

Most of these predate the merge. They are visible now because the packet layer
works, so the code paths carrying them get reached.

The first four are why the first build of this script showed nothing in game —
you got a working game and no mod. Each one silently ends startup partway
through, and everything below it never runs.

- **The script ran too early.** This build needs `@run-at document-start` so
  the injector can claim the bundle `<script>` before the browser executes it.
  But the mod body reads `#enterGame` off the document at load, and at
  document-start that is `null` — so `null.addEventListener` threw and took
  every line below it with it. The original shipped with no `@run-at` at all,
  which got it document-idle and a page that already existed. The body is now
  deferred to `DOMContentLoaded`; only the injector runs early.
- **A blocking synchronous XHR to `code.jquery.com`**, halfway through
  startup, whose response is never read — the log lines around it claim it
  evaluates the result, but nothing does. If that host is slow it stalls the
  main thread; if it is unreachable at all — ad blocker, filtered network,
  CSP, offline — it *throws*, and the settings menu below it never gets built.
  jQuery is a shim here, so there was nothing to fetch even if the response
  had been used.
- **The menu was built behind a readyState race.** A polling loop sets the
  flag the whole settings menu waits on, and it only set it on
  `"interactive"`; `"complete"` fell through and did nothing. Start a moment
  late — a slow userscript manager, a warm cache — and the flag never gets
  set and the menu silently never appears.
- **Any error in UI setup blanked the page.** The block that clones
  `#chatButton` and `#storeButton` into the mod's own buttons was wrapped in a
  catch that cleared `document.body` every 100ms, alerted, and reloaded. One
  missing element in a hundred lines cost you the whole page, a reload loop,
  and nothing to read. It now logs and carries on.
- **`dns()` was never defined.** The developer console builds its commands
  around it and the katana/musket/stick quick-equip helpers call it directly,
  so `!km`, `!pm` and `!sh` threw a `ReferenceError` instead of equipping
  anything. It takes the same `[name, args]` pair as the send helper, and is
  now defined as one.
- **`iChat` was never defined either**, and is read on the insta-kill path —
  a `ReferenceError` out of the middle of a combo. There is no `#iChat` input
  in the menu and nothing assigns it; it is declared empty and the call
  guarded.
- **Every chat message sent a second packet.** The profanity-filter bypass
  sent its rewritten copy *in addition to* the original rather than instead of
  it, and when no filtered word matched it still fired `["ch", [null]]`. Both
  cost a sequence number now. The rewrite replaces the original, and stays
  quiet when nothing matched.
- **`window.send` was assigned a wrapper around itself.** `this` in that scope
  is the global object, not a socket, so it never wired anything up.

---

## Layout

```
LemonMod_Mix.user.js           the build output — this is the script to install
src/LemonMod_v3.0.js           deobfuscated main script (input)
src/LemonMod_Visuals_v3.0.js   Visuals, kept for reference (input, beacon removed)
src/lemonmix-runtime.js        packet translation, visuals state, jQuery shim
src/lemonmix-injector.js       bundle rewrite hooks + injector
tools/deobfuscate-lemonmod.js  shipped script -> src/LemonMod_v3.0.js
tools/build-lemonmix.js        src/* -> LemonMod_Mix.user.js
tools/verify-lemonmix.js       build vs. the shipped game bundle
tools/loadtest-lemonmix.js     does the mod actually come up in a headless page
tools/check-hooks.js           bundle-rewrite hooks vs. the game bundle
```

## Build

```sh
node tools/build-lemonmix.js
```

Every edit is anchored to an exact string in `src/LemonMod_v3.0.js`, and an
anchor that is missing or ambiguous fails the build rather than producing a
half-patched script. 39 edits currently apply.

Regenerating the deobfuscated source is reproducible and not part of the
normal build:

```sh
npm i --no-save @babel/parser @babel/traverse @babel/generator @babel/types
node tools/deobfuscate-lemonmod.js <shipped-script.js> src/LemonMod_v3.0.js
```

## Verification

```sh
node --check LemonMod_Mix.user.js
node tools/check-hooks.js LemonMod_Mix.user.js    # needs: npm i --no-save terser
node tools/verify-lemonmix.js                     # needs terser too
node tools/loadtest-lemonmix.js                   # needs: npm i --no-save jsdom
```

### The load test

`loadtest-lemonmix.js` exists because the protocol checks below were not
enough. The first build passed every one of them and still showed nothing in
game: it threw on `null.addEventListener` before it ever reached a menu, and
no check noticed, because no check ran the script.

So this one runs it, in a headless page built from the element ids the game
bundle itself reaches for — a missing element here means the mod expects
something the game does not provide, not that the harness is thin. It reports
whether the script evaluates, whether all ten of the mod's own UI elements get
built, whether anything cleared the page, and any error thrown from a timer.
It runs at both `document-start` and `document-idle`, because the two halves
of the script want opposite timings.

### The protocol checks

`verify-lemonmix.js` does not read the tables and compare them by eye. It
lifts the **real transport** out of `src/game_index.js` — the seeded
permutation, the HMAC, `io.send` itself — runs it next to the build's
translation layer, and takes the resulting frames apart:

- 9 packets sent through `LemonMix.send`, framed by the game's own `io.send`,
  decoded back, and checked against the opcode the negotiated table says they
  should carry, with the right arguments and the right sequence number
- the mod and the game shown to increment **one** shared sequence counter
- a bot frame built by hand and checked against the game's frame layout
- inbound dispatch names translated back to the ones the mod switches on
- every c2s name the build can emit shown to exist in the game's c2s alphabet,
  and every s2c name it claims to understand shown to exist in the game's
  dispatch table, with both directions round-tripping
- the rewritten bundle re-parsed, with all six injection points present
- the 16 weapon reload speeds diffed against the shipped table
- 14 call-home paths shown to be absent from the code

Current state: **6/6 hooks bind**, the mod builds all ten of its UI elements at
both load timings, and every check above passes.

---

## Notes

- **On the file getting smaller.** The shipped script is 3.1 MB; this build is
  around 0.6 MB. None of that is missing logic — the shipped file was
  javascript-obfuscator output, and most of its bulk was the obfuscation
  itself: a rotated string array, ~300 proxy functions each declaring sixty-odd
  dummy parameters, call sites passing sixty-odd hex numbers to reach one of
  them, every integer written as an arithmetic expression, and an opaque
  `"abcde" === "fghij"` wrapped around most statements. Folding that away is
  what `tools/deobfuscate-lemonmod.js` does, and it is reproducible: running it
  on the shipped script reproduces `src/LemonMod_v3.0.js` byte for byte. The
  logic is all still there — 6,860 lines of it — and the build adds the msgpack
  codec, the transport primitives, the runtime and the injector on top.
- Multibox bots are the one thing in the script that still builds frames by
  hand, because they open sockets outside the game's `io` object. They use the
  transport primitives sliced straight out of `src/game_index.js`, and they
  take their connection token from Cloudflare Turnstile — LemonMod v3.0 asked
  `grecaptcha`, which the game no longer loads. This path is wired and its
  framing is checked, but it is the least exercised part of the build.
- `_lemonCrypto` is per bot socket. Each bot negotiates its own opcode table,
  as it must — the permutation is per connection.
- The mod's own menu still carries a link to the author's site. It is an
  `<a href>`, so it costs nothing until someone clicks it.
