# Revelation — moomoo.io userscript

`Revelation.user.js` (file 17), updated to work against the current moomoo.io
client. `reference/` holds the two game bundles it was ported against
(`game-index.js` = file 1, `game-vendor.js` = file 2) for future diffing.

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
