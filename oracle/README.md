# Oracle Laffer v1.2

`Oracle_Laffer_v1.2.user.js` — a laffer-based client that could not connect to
the live game at all. Seven fixes, in two groups.

```
node harness/oracle-net.js            # the connection, checked as the server checks it
node harness/transport-check.js oracle/Oracle_Laffer_v1.2.user.js
python3 harness/oracle-net-mutate.py  # 21 mutations, all caught
```

---

## Packets — it spoke a protocol the server retired

This was the fatal one. Oracle's `io.send` was:

```js
send: function (type) {
    var data = Array.prototype.slice.call(arguments, 1);
    var binary = msgpack.encode([type, data]);
    this.socket.send(binary);
}
```

`msgpack([letter, args])` and nothing else — the pre-2023 format. The live
server's own layer, from the shipped bundle:

```js
send: function(e){
  const t = Array.prototype.slice.call(arguments,1);
  if (Z && Z.mode === Ht) {
    const s = Z.tables.c2s.enc[e];        // letter -> permuted number
    if (s === undefined) return;
    const n = ++Z.seq;                     // strictly increasing
    const a = Hi.encode([s, t, n]);
    const o = Eo(Z.key, a);                // 6-byte signature
    const d = new Uint8Array(jt + a.length);
    d.set(o, 0); d.set(a, jt);
    Ri.call(this.socket, d); return;
  }
  Ri.call(this.socket, Hi.encode([e, t]));
}
```

Three things Oracle had none of: **the opcode tables** (a seeded shuffle that
must land on exactly the server's permutation), **the sequence number**, and
**the signature**. A frame missing any of them is discarded, and the connection
is closed on the first one — which is what "disconnected" on the menu is.

Incoming was the mirror image: server opcodes arrive **permuted and numeric**,
and Oracle's handler table is keyed on letters. Worse, the dispatch was a bare
`events[type].apply(...)` — an opcode with no handler threw inside `onmessage`
and took the rest of that message with it. The game's own is
`const h = i[m]; h && h.apply(...)`.

| fix | |
| --- | --- |
| the transport | ported in whole from this repo's Revelation port, where `transport-check.js` runs it against the game's own implementation over 200 seeds and 200 signatures and requires an exact match. Copied verbatim rather than rewritten so both stay checkable by the same tool. |
| `send` | maps the opcode through `c2s.enc`, sequences, signs, and prefixes. Drops an opcode the server has no slot for instead of sending a frame it will reject. |
| `onmessage` | maps numeric opcodes back through `s2c.dec`, and guards the handler lookup |
| the handshake | the connect callback now fires on **io-init**, not `onopen`. io-init carries the key and the tables, so anything sent in between could be neither signed nor addressed. Oracle called back from `onopen`, which put every startup frame on the wire in a format the server discards. |

All 17 opcodes Oracle sends are in the server's 17-entry `c2s` table, so nothing
is dropped by the new guard.

---

## Login — it could never learn where to connect

Oracle got its address by hooking the page's own bundle:

```js
window.OriginalWebSocket = window.WebSocket;
window.WebSocket = class {
    constructor(wsAddr) { if (!wsAddress) wsAddress = wsAddr; connectSocket(wsAddr); }
}
```

That cannot work on the live game, for two **independent** reasons:

1. The bundle's first line is `const kn = window.WebSocket, Ri = window.WebSocket && window.WebSocket.prototype.send`,
   and it connects with `new kn(e)`. It never reads `window.WebSocket` again, so
   replacing that property intercepts nothing.
2. It then calls
   `Object.defineProperty(window,"WebSocket",{value:kn,writable:!1,configurable:!1})`,
   so the assignment is a silent no-op anyway.

Winning the race is not the answer either: Oracle resolves `gameCanvas` and
`#enterGame` at module top level, so `@run-at document-start` would throw before
the DOM exists and kill the script outright.

**So the address is built here instead**, with the game's own formula —
`key + "." + region + "." + baseUrl`, plus `:port`, honouring `?server=region:name`
from the query — after fetching `api.moomoo.io/servers?v=1.27`.

And the captcha: the block at the top of the file waited for `#altcha_iframe`
and clicked `#altcha_checkbox`. **moomoo replaced altcha with Cloudflare
Turnstile**, so neither element exists. Every use was guarded, so it never
threw — it just quietly did nothing, and it was the client's only captcha
handling, so no token was ever obtained. Turnstile is fetched before the socket
opens and goes on the address as `?token=cf:<token>`.

---

## Reconnect — one drop was permanent

Three separate latches, each of which alone made a dropped connection final.

| | before | why it was fatal |
| --- | --- | --- |
| `io.close()` | `this.socket && this.socket.close()` | left `this.socket` set, and `connect()` opens with `if (this.socket) return` — so no later connect could ever open a socket |
| `disconnect()` | did not touch `inGame` | only `killPlayer()` cleared it. A disconnect is not a death, so `enterGame()`'s `if (!inGame && socketReady())` was false forever |
| the ping timer | `setInterval(() => pingSocket(), 2500)` in the connect callback | the callback fires on io-init **and** on every close and error, so each drop added another interval and the ping traffic multiplied |

All three are fixed, and the bench drives a second io-init to prove the session
is genuinely rebuilt: new key, new opcode table, sequence restarted at 1.

Also removed: the `@require` on **rawgit.com**, which shut down in 2019 and
produced a failed fetch on every start. The bundle defines `window.msgpack`
itself, so nothing needed it.

---

## What is not verified

The live server accepting the connection, and Cloudflare issuing a token.
Oracle does not boot in this harness. What **is** verified is that every frame
it now produces passes the server's own signature, table and sequence checks —
`oracle-net.js` recomputes them with the game's own primitives.
