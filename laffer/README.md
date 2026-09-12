# Laffer Remake v1

`Laffer_Remake_v1.user.js` — the same laffer base as `../oracle/`, and every
connection block in it was **byte-identical** to Oracle's before either was
fixed:

```
io.connect       IDENTICAL
io.send          IDENTICAL
io.close         IDENTICAL
disconnect       IDENTICAL
connectSocket    IDENTICAL
enterGame        IDENTICAL
```

So the same seven fixes were ported across mechanically rather than rewritten,
and both clients are checked by the same tools.

```
node harness/oracle-net.js laffer/Laffer_Remake_v1.user.js
node harness/transport-check.js laffer/Laffer_Remake_v1.user.js
python3 harness/oracle-net-mutate.py laffer/Laffer_Remake_v1.user.js
```

| | what was wrong |
| --- | --- |
| **packets** | `msgpack.encode([type, data])` — the pre-2023 format. The server wants a permuted numeric opcode, a strictly increasing sequence and a six-byte signature; a frame missing any of them is discarded and the connection closed on the first one |
| **incoming** | server opcodes arrive permuted and numeric while the handler table is keyed on letters, and the dispatch was a bare `events[type].apply(...)` — an opcode with no handler threw inside `onmessage` |
| **handshake** | the connect callback fired on `onopen`. io-init carries the key and the tables, so every startup frame went out unsignable and unaddressable |
| **address** | it hooked `window.WebSocket` to steal the URL from the page's bundle. The bundle snapshots `const kn = window.WebSocket` on its first line and then locks the property, so the hook intercepts nothing and cannot be installed either |
| **captcha** | it waited for `#altcha_iframe` and clicked `#altcha_checkbox`. moomoo replaced altcha with Cloudflare Turnstile, so neither element exists and no token was ever obtained |
| **reconnect** | `io.close()` left `this.socket` set (and `connect()` opens with `if (this.socket) return`); `disconnect()` never cleared `inGame`, which only `killPlayer()` cleared; and the ping interval was started inside the connect callback, which fires on every close |
| **@require** | `rawgit.com` shut down in 2019 — a failed fetch on every start. The bundle defines `window.msgpack` itself |

Full reasoning for each, with the game's own code quoted, is in
[`../oracle/README.md`](../oracle/README.md).

## Verified

* **61 assertions** in `oracle-net.js`, which lifts this client's real `send`
  and `onmessage` and verifies every frame the way the server would — split the
  prefix, recompute the signature with the game's own primitives, decode, check
  the shape.
* **byte-for-byte identical** to the game's own transport over 200 seeds in both
  directions and 200 signatures.
* All **17** opcodes this client sends are in the server's 17-entry `c2s` table,
  so the "drop what the server has no slot for" guard drops nothing.
* **36 of 36 mutations** caught — the same suite that covers Oracle.

## Not verified

The live server accepting the connection, and Cloudflare issuing a token.
Neither client boots in this harness.
