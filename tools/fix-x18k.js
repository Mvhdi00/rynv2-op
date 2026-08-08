/*
 * src/x18k_7.4_original.js -> x18k_7_4_Fixed.user.js
 *
 * x18k 7.4 forked a much later bundle than Ae86 did: its inbound handler table
 * is already keyed by the current 36 names and 13 of its 16 outbound names are
 * current, with the other three rewritten inline. What it never had is the
 * transport the server now requires — the io-init negotiation, the permuted
 * opcodes and the signed frame.
 *
 * Every edit is anchored to an exact string and a missing or ambiguous anchor
 * fails the build, so a different x18k build surfaces as an error rather than a
 * half-patched script.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IN = path.join(ROOT, 'src/x18k_7.4_original.js');
const CORE = path.join(ROOT, 'src/moomoo-transport.js');
const SHIM = path.join(ROOT, 'src/x18k-protocol.js');
const OUT = path.join(ROOT, 'x18k_7_4_Fixed.user.js');

let src = fs.readFileSync(IN, 'utf8');
const edits = [];

function edit(label, find, replace) {
  const first = src.indexOf(find);
  if (first === -1) throw new Error(`[fix-x18k] anchor not found: ${label}\n---\n${find}\n---`);
  if (src.indexOf(find, first + 1) !== -1) throw new Error(`[fix-x18k] anchor is ambiguous: ${label}`);
  src = src.slice(0, first) + replace + src.slice(first + find.length);
  edits.push(label);
}

/* ------------------------------------------------------------------ *
 * 1. Ship the transport, and drop the dead @require.
 *
 * rawgit.com shut down in 2019, so that @require resolves to nothing. The
 * script bundles its own msgpack encoder/decoder anyway (see edit 2), so the
 * dependency is removed rather than repointed at another CDN.
 * ------------------------------------------------------------------ */
{
  const dead = '// @require https://rawgit.com/kawanet/msgpack-lite/master/dist/msgpack.min.js\n// ==/UserScript==\n';
  const shim = fs.readFileSync(CORE, 'utf8') + '\n' + fs.readFileSync(SHIM, 'utf8');
  edit('inject transport, drop dead @require',
    dead,
    '// ==/UserScript==\n\n' + shim + '\n');
}

/* ------------------------------------------------------------------ *
 * 2. Stop depending on the global the dead @require was meant to provide.
 *
 * `Ke = msgpack` reads a global that no longer exists — a ReferenceError at
 * load that would take the whole script down. Ke is assigned once and never
 * read, so it simply goes. The bot sockets do use `window.msgpack`, so that is
 * populated from the encoder/decoder the script already builds.
 * ------------------------------------------------------------------ */
edit('drop dead msgpack global read', '    Ke = msgpack,', '    Ke = null,');

edit('provide window.msgpack from the bundled codec',
  `      sl = new ar,
      ol = new Ir,`,
  `      sl = new ar,
      ol = new Ir,
      _x18kMsgpackInstalled = (function () {
        // The bot sockets reach for window.msgpack; serve them the codec this
        // script already carries instead of an external one.
        if (!window.msgpack) {
          window.msgpack = {
            encode: function (v) { return sl.encode(v); },
            decode: function (v) { return ol.decode(v); }
          };
        }
        return true;
      })(),`);

/* ------------------------------------------------------------------ *
 * 3. Main socket: negotiate on io-init and translate inbound opcodes.
 *
 * The shipped bundle fires the "connected" callback from io-init rather than
 * onopen, because nothing can be sent before the key and tables arrive.
 * ------------------------------------------------------------------ */
edit('main socket: inbound + ready callback',
  `this.socket.onmessage = function(e) {
                      var t = new Uint8Array(e.data);
                      const n = ol.decode(t),
                            i = n[0];
                      var t = n[1];
                      i == "io-init" ? o.socketId = t[0] : s[i].apply(void 0, t)
                  }, this.socket.onopen = function() {
                      o.connected = !0, n()
                  }`,
  `this.socket.onmessage = function(e) {
                      const d = ol.decode(new Uint8Array(e.data)),
                            i = d[0],
                            t = d[1];
                      if (i === "io-init") {
                          o.socketId = t[0];
                          o.proto = window.X18kProto.createState(t);
                          if (!o._ready) { o._ready = !0; n() }
                          return
                      }
                      const nm = window.X18kProto.decodeName(o.proto, i);
                      if (nm === void 0) return;
                      const h = s[nm];
                      if (h) h.apply(void 0, t)
                  }, this.socket.onopen = function() {
                      o.connected = !0
                  }`);

/* ------------------------------------------------------------------ *
 * 4. Main socket: declare the per-connection state field.
 * ------------------------------------------------------------------ */
edit('main socket: declare proto field',
  `      T = {
          socket: null,
          connected: !1,
          socketId: -1,`,
  `      T = {
          socket: null,
          connected: !1,
          proto: null,
          _ready: !1,
          socketId: -1,`);

/* ------------------------------------------------------------------ *
 * 5. Main socket: sign and permute outbound frames.
 *
 * The msgpack encode moves down next to the send so the frame is built once,
 * after the client's own rate limiting has decided to let it through.
 * ------------------------------------------------------------------ */
edit('main socket: drop the early plain encode',
  `              const t = Array.prototype.slice.call(arguments, 1),
                    n = sl.encode([e, t]);`,
  `              const t = Array.prototype.slice.call(arguments, 1);`);

edit('main socket: outbound frames',
  '              this.socket && this.socket.send(n)',
  `              if (!this.socket) return;
              const n = window.X18kProto.encodeFrame(this.proto, function (v) { return sl.encode(v) }, e, t);
              if (n) this.socket.send(n)`);

/* ------------------------------------------------------------------ *
 * 6. Main socket: state is per-connection, so clear it on close.
 * ------------------------------------------------------------------ */
edit('main socket: reset state on close',
  '              this.socket && this.socket.close(), this.socket = null, this.connected = !1',
  '              this.socket && this.socket.close(), this.socket = null, this.connected = !1, this.proto = null, this._ready = !1');

/* ------------------------------------------------------------------ *
 * 7. Bot sockets: one transport state each, negotiated the same way.
 * ------------------------------------------------------------------ */
edit('bot socket: declare proto field',
  `    let c = new WebSocket(n);
    c.binaryType = "arraybuffer";`,
  `    let c = new WebSocket(n);
    c.binaryType = "arraybuffer";
    c.proto = null;
    c.protoReady = false;`);

edit('bot socket: outbound frames',
  '        c.send(window.msgpack.encode([e, [t, n, i]]))',
  `        const fr = window.X18kProto.encodeFrame(c.proto, function (v) { return window.msgpack.encode(v) }, e, [t, n, i]);
        if (fr) c.send(fr)`);

edit('bot socket: inbound translation',
  `    c.onmessage = e => {
        let t = window.msgpack.decode(new Uint8Array(e.data));
        let s;`,
  `    c.onmessage = e => {
        let t = window.msgpack.decode(new Uint8Array(e.data));
        if (t[0] === "io-init") {
            c.proto = window.X18kProto.createState(t[1]);
            if (!c.protoReady) { c.protoReady = true; c.onProtoReady && c.onProtoReady() }
            return
        }
        {
            const nm = window.X18kProto.decodeName(c.proto, t[0]);
            if (nm === void 0) return;
            t = [nm, t[1]]
        }
        let s;`);

/* ------------------------------------------------------------------ *
 * 8. Bot sockets: spawn once the transport is up, not on a timer.
 *
 * onopen fired 111ms after the socket opened and spawned regardless of whether
 * io-init had landed, which raced the handshake.
 * ------------------------------------------------------------------ */
edit('bot socket: spawn on io-init, not on a timer',
  `    c.onopen = async () => {
        c.HERE = true;
        await wx(111);
        c.spawn();
        c.pingSocketResponse()
    };`,
  `    c.onopen = async () => {
        c.HERE = true;
    };
    c.onProtoReady = async () => {
        await wx(111);
        c.spawn();
        c.pingSocketResponse()
    };`);

fs.writeFileSync(OUT, src);
console.log(`Applied ${edits.length} edits:`);
for (const e of edits) console.log(`  - ${e}`);
console.log(`\nWrote ${path.relative(ROOT, OUT)} (${src.length} bytes)`);
