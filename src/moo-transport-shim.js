/* ==========================================================================
 * moo-transport-shim.js
 *
 * Restores the wire protocol that socket-hooking moomoo.io userscripts were
 * written against.
 *
 * Those mods all assume the old transport: every frame is a bare msgpack
 * `[typeString, args]`, in both directions. The game shipped in
 * src/game_index.js does not do that any more. On connect the server sends
 * `io-init` carrying `[socketId, seed, hexKey, mode]`, and when `mode` is 1 the
 * client must:
 *
 *   - permute the 17 c2s and 36 s2c opcode names from `seed`, so a packet is
 *     addressed by a per-connection *number* rather than by its name;
 *   - carry a monotonic sequence counter as a third frame element;
 *   - prefix every client frame with the first 6 bytes of
 *     HMAC-SHA256(key, frame).
 *
 * A mod that still speaks the old protocol cannot send one accepted packet,
 * and none of its receive handlers ever fire, because the incoming type is a
 * number that matches no string key.
 *
 * Rather than rewrite each mod's packet logic, this shim sits at the socket
 * boundary and keeps the old protocol true from the mod's point of view:
 *
 *   incoming   numeric opcode -> string name, re-encoded before any listener
 *              runs, so `events["A"]` and `type == "6"` work again
 *   outgoing   plain `[name, args]` -> `[opcode, args, seq]`, signed
 *   io-init    the seed and key are captured here, and `mode` is rewritten to
 *              0 on its way to the page
 *
 * That last point is what makes the whole thing hold together. With `mode`
 * reported as 0 the game's own transport stays in plaintext mode and emits
 * bare `[name, args]` frames — exactly what the mods' `WebSocket.prototype.send`
 * hooks expect to decode and re-encode. Every frame is then signed once, here,
 * at the last point before the wire, and the sequence counter has a single
 * owner instead of being split between the game and the mod.
 *
 * Load order matters: the game captures `WebSocket.prototype.send` into a
 * private binding as its bundle evaluates and calls that captured reference
 * directly, so anything installed afterwards is bypassed. This shim, and the
 * mod above it, must be in place first — hence `@run-at document-start`.
 *
 * The constants and the three algorithms below are ports of `Io`/`jt`/`Ht`,
 * `bo`/`To`, `Co`/`Oi`/`Po`, and `Vt`/`Ao`/`Eo` in src/game_index.js.
 * ========================================================================== */

(function () {
  "use strict";

  if (window.__mooShim) return;

  /* ---- protocol constants (game_index.js: Io, jt, Ht, bo, To) ---------- */
  var SALT = 1;
  var SIG_BYTES = 6;
  var ENCRYPTED_MODE = 1;

  var C2S = ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"];
  var S2C = ["A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

  /* ==== msgpack ==========================================================
   * Self-contained so the shim does not depend on a CDN copy of msgpack-lite.
   * The @require URLs these mods used are dead, and the game's own codec lives
   * inside an ES module that a userscript cannot reach. Covers the types
   * moomoo frames actually carry: nil, bool, int, float, str, bin, array, map.
   * ===================================================================== */

  function utf8Len(str) {
    var n = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length && (str.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { n += 4; i++; }
      else n += 3;
    }
    return n;
  }

  function Writer() {
    this.buf = new Uint8Array(1024);
    this.view = new DataView(this.buf.buffer);
    this.pos = 0;
  }
  Writer.prototype.need = function (n) {
    if (this.pos + n <= this.buf.length) return;
    var size = this.buf.length;
    while (size < this.pos + n) size *= 2;
    var next = new Uint8Array(size);
    next.set(this.buf);
    this.buf = next;
    this.view = new DataView(next.buffer);
  };
  Writer.prototype.u8 = function (v) { this.need(1); this.view.setUint8(this.pos++, v); };
  Writer.prototype.u16 = function (v) { this.need(2); this.view.setUint16(this.pos, v); this.pos += 2; };
  Writer.prototype.u32 = function (v) { this.need(4); this.view.setUint32(this.pos, v); this.pos += 4; };
  Writer.prototype.i8 = function (v) { this.need(1); this.view.setInt8(this.pos++, v); };
  Writer.prototype.i16 = function (v) { this.need(2); this.view.setInt16(this.pos, v); this.pos += 2; };
  Writer.prototype.i32 = function (v) { this.need(4); this.view.setInt32(this.pos, v); this.pos += 4; };
  Writer.prototype.f64 = function (v) { this.need(8); this.view.setFloat64(this.pos, v); this.pos += 8; };
  Writer.prototype.bytes = function (b) { this.need(b.length); this.buf.set(b, this.pos); this.pos += b.length; };

  Writer.prototype.str = function (s) {
    var n = utf8Len(s);
    if (n < 32) this.u8(0xa0 | n);
    else if (n < 256) { this.u8(0xd9); this.u8(n); }
    else if (n < 65536) { this.u8(0xda); this.u16(n); }
    else { this.u8(0xdb); this.u32(n); }
    this.need(n);
    var p = this.pos;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) this.buf[p++] = c;
      else if (c < 0x800) {
        this.buf[p++] = 0xc0 | (c >> 6);
        this.buf[p++] = 0x80 | (c & 63);
      } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
        c = ((c & 1023) << 10) + (s.charCodeAt(++i) & 1023) + 0x10000;
        this.buf[p++] = 0xf0 | (c >> 18);
        this.buf[p++] = 0x80 | ((c >> 12) & 63);
        this.buf[p++] = 0x80 | ((c >> 6) & 63);
        this.buf[p++] = 0x80 | (c & 63);
      } else {
        this.buf[p++] = 0xe0 | (c >> 12);
        this.buf[p++] = 0x80 | ((c >> 6) & 63);
        this.buf[p++] = 0x80 | (c & 63);
      }
    }
    this.pos = p;
  };

  Writer.prototype.write = function (v) {
    if (v === null || v === undefined) return this.u8(0xc0);

    var t = typeof v;
    if (t === "boolean") return this.u8(v ? 0xc3 : 0xc2);

    if (t === "number") {
      if (Number.isSafeInteger(v)) {
        if (v >= 0) {
          if (v < 128) return this.u8(v);
          if (v < 256) { this.u8(0xcc); return this.u8(v); }
          if (v < 65536) { this.u8(0xcd); return this.u16(v); }
          if (v < 4294967296) { this.u8(0xce); return this.u32(v); }
          this.u8(0xcf); this.u32(Math.floor(v / 4294967296)); return this.u32(v >>> 0);
        }
        if (v >= -32) return this.u8(0xe0 | (v + 32));
        if (v >= -128) { this.u8(0xd0); return this.i8(v); }
        if (v >= -32768) { this.u8(0xd1); return this.i16(v); }
        if (v >= -2147483648) { this.u8(0xd2); return this.i32(v); }
        this.u8(0xd3); this.i32(Math.floor(v / 4294967296)); return this.u32(v >>> 0);
      }
      this.u8(0xcb);
      return this.f64(v);
    }

    if (t === "string") return this.str(v);

    if (v instanceof Uint8Array || ArrayBuffer.isView(v)) {
      var b = v instanceof Uint8Array ? v : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
      if (b.length < 256) { this.u8(0xc4); this.u8(b.length); }
      else if (b.length < 65536) { this.u8(0xc5); this.u16(b.length); }
      else { this.u8(0xc6); this.u32(b.length); }
      return this.bytes(b);
    }

    if (Array.isArray(v)) {
      if (v.length < 16) this.u8(0x90 | v.length);
      else if (v.length < 65536) { this.u8(0xdc); this.u16(v.length); }
      else { this.u8(0xdd); this.u32(v.length); }
      for (var i = 0; i < v.length; i++) this.write(v[i]);
      return;
    }

    var keys = Object.keys(v);
    if (keys.length < 16) this.u8(0x80 | keys.length);
    else if (keys.length < 65536) { this.u8(0xde); this.u16(keys.length); }
    else { this.u8(0xdf); this.u32(keys.length); }
    for (var k = 0; k < keys.length; k++) {
      this.str(keys[k]);
      this.write(v[keys[k]]);
    }
  };

  function encode(value) {
    var w = new Writer();
    w.write(value);
    return w.buf.slice(0, w.pos);
  }

  function Reader(bytes) {
    this.b = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = 0;
  }
  Reader.prototype.str = function (n) {
    var out = "", chunk = [], end = this.pos + n;
    while (this.pos < end) {
      var f = this.b[this.pos++], cp;
      if (!(f & 0x80)) cp = f;
      else if ((f & 0xe0) === 0xc0) cp = ((f & 31) << 6) | (this.b[this.pos++] & 63);
      else if ((f & 0xf0) === 0xe0) cp = ((f & 15) << 12) | ((this.b[this.pos++] & 63) << 6) | (this.b[this.pos++] & 63);
      else {
        cp = ((f & 7) << 18) | ((this.b[this.pos++] & 63) << 12) | ((this.b[this.pos++] & 63) << 6) | (this.b[this.pos++] & 63);
        if (cp > 0xffff) {
          cp -= 0x10000;
          chunk.push(0xd800 | (cp >>> 10));
          cp = 0xdc00 | (cp & 1023);
        }
      }
      chunk.push(cp);
      if (chunk.length >= 4096) { out += String.fromCharCode.apply(String, chunk); chunk.length = 0; }
    }
    if (chunk.length) out += String.fromCharCode.apply(String, chunk);
    return out;
  };
  Reader.prototype.read = function () {
    var h = this.b[this.pos++], i, n, out;

    if (h < 0x80) return h;
    if (h >= 0xe0) return h - 256;
    if (h >= 0xa0 && h < 0xc0) return this.str(h - 0xa0);
    if (h >= 0x90 && h < 0xa0) { n = h - 0x90; out = new Array(n); for (i = 0; i < n; i++) out[i] = this.read(); return out; }
    if (h >= 0x80 && h < 0x90) { n = h - 0x80; out = {}; for (i = 0; i < n; i++) { var k = this.read(); out[k] = this.read(); } return out; }

    switch (h) {
      case 0xc0: return null;
      case 0xc2: return false;
      case 0xc3: return true;
      case 0xc4: n = this.b[this.pos++]; return this.bin(n);
      case 0xc5: n = this.view.getUint16(this.pos); this.pos += 2; return this.bin(n);
      case 0xc6: n = this.view.getUint32(this.pos); this.pos += 4; return this.bin(n);
      case 0xca: out = this.view.getFloat32(this.pos); this.pos += 4; return out;
      case 0xcb: out = this.view.getFloat64(this.pos); this.pos += 8; return out;
      case 0xcc: return this.b[this.pos++];
      case 0xcd: out = this.view.getUint16(this.pos); this.pos += 2; return out;
      case 0xce: out = this.view.getUint32(this.pos); this.pos += 4; return out;
      case 0xcf: out = this.view.getUint32(this.pos) * 4294967296 + this.view.getUint32(this.pos + 4); this.pos += 8; return out;
      case 0xd0: return this.view.getInt8(this.pos++);
      case 0xd1: out = this.view.getInt16(this.pos); this.pos += 2; return out;
      case 0xd2: out = this.view.getInt32(this.pos); this.pos += 4; return out;
      case 0xd3: out = this.view.getInt32(this.pos) * 4294967296 + this.view.getUint32(this.pos + 4); this.pos += 8; return out;
      case 0xd9: n = this.b[this.pos++]; return this.str(n);
      case 0xda: n = this.view.getUint16(this.pos); this.pos += 2; return this.str(n);
      case 0xdb: n = this.view.getUint32(this.pos); this.pos += 4; return this.str(n);
      case 0xdc: n = this.view.getUint16(this.pos); this.pos += 2; out = new Array(n); for (i = 0; i < n; i++) out[i] = this.read(); return out;
      case 0xdd: n = this.view.getUint32(this.pos); this.pos += 4; out = new Array(n); for (i = 0; i < n; i++) out[i] = this.read(); return out;
      case 0xde: n = this.view.getUint16(this.pos); this.pos += 2; out = {}; for (i = 0; i < n; i++) { var k2 = this.read(); out[k2] = this.read(); } return out;
      case 0xdf: n = this.view.getUint32(this.pos); this.pos += 4; out = {}; for (i = 0; i < n; i++) { var k3 = this.read(); out[k3] = this.read(); } return out;
      /* Fixed-width and variable extensions. moomoo frames do not carry these,
       * but skipping them cleanly beats throwing on an unexpected frame. */
      case 0xd4: return this.ext(1);
      case 0xd5: return this.ext(2);
      case 0xd6: return this.ext(4);
      case 0xd7: return this.ext(8);
      case 0xd8: return this.ext(16);
      case 0xc7: n = this.b[this.pos++]; return this.ext(n);
      case 0xc8: n = this.view.getUint16(this.pos); this.pos += 2; return this.ext(n);
      case 0xc9: n = this.view.getUint32(this.pos); this.pos += 4; return this.ext(n);
    }
    throw new Error("msgpack: unknown byte 0x" + h.toString(16));
  };
  Reader.prototype.bin = function (n) {
    var out = this.b.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  };
  Reader.prototype.ext = function (n) {
    var type = this.view.getInt8(this.pos);
    this.pos += 1 + n;
    return { __ext: type };
  };

  function decode(bytes) {
    return new Reader(bytes).read();
  }

  /* ==== opcode tables (game_index.js: Co, Oi, Po) ======================== */

  /* splitmix32 — the game seeds this from io-init so client and server derive
   * the same permutation. */
  function rng(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 1831565813) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(alphabet, seed) {
    var n = alphabet.length;
    var idx = alphabet.map(function (_, i) { return i; });
    var next = rng(seed >>> 0);
    for (var i = n - 1; i > 0; i--) {
      var j = Math.floor(next() * (i + 1));
      var tmp = idx[i];
      idx[i] = idx[j];
      idx[j] = tmp;
    }
    var enc = {}, dec = {};
    for (var k = 0; k < n; k++) {
      enc[alphabet[k]] = idx[k];
      dec[idx[k]] = alphabet[k];
    }
    return { enc: enc, dec: dec };
  }

  function tablesFor(seed) {
    var mixed = (seed ^ Math.imul(SALT, 2654435761)) >>> 0;
    return {
      c2s: shuffle(C2S, mixed),
      s2c: shuffle(S2C, (mixed ^ 2246822507) >>> 0),
    };
  }

  /* ==== HMAC-SHA256, truncated (game_index.js: Vt, Ao, Eo) ============== */

  var K = new Uint32Array([
    1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221,
    3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580,
    3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
    2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895,
    666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037,
    2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
    430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779,
    1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298,
  ]);

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256(input) {
    var h = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
    var len = input.length;
    var bits = len * 8;
    var padded = new Uint8Array(Math.ceil((len + 9) / 64) * 64);
    padded.set(input);
    padded[len] = 0x80;

    var view = new DataView(padded.buffer);
    view.setUint32(padded.length - 4, bits >>> 0, false);
    view.setUint32(padded.length - 8, Math.floor(bits / 4294967296), false);

    var w = new Uint32Array(64);
    for (var off = 0; off < padded.length; off += 64) {
      for (var i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
      for (i = 16; i < 64; i++) {
        var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }

    var out = new Uint8Array(32);
    var ov = new DataView(out.buffer);
    for (var j = 0; j < 8; j++) ov.setUint32(j * 4, h[j], false);
    return out;
  }

  var BLOCK = 64;

  function hmac(key, msg) {
    var k = key;
    if (k.length > BLOCK) k = sha256(k);
    var padded = new Uint8Array(BLOCK);
    padded.set(k);

    var inner = new Uint8Array(BLOCK + msg.length);
    var outer = new Uint8Array(BLOCK + 32);
    for (var i = 0; i < BLOCK; i++) {
      inner[i] = padded[i] ^ 0x36;
      outer[i] = padded[i] ^ 0x5c;
    }
    inner.set(msg, BLOCK);
    outer.set(sha256(inner), BLOCK);
    return sha256(outer);
  }

  function sign(key, frame) {
    return hmac(key, frame).subarray(0, SIG_BYTES);
  }

  function unhex(hex) {
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }

  /* ==== socket wiring ==================================================== */

  /* Per-socket state, keyed by the socket itself. A socket only gets a session
   * once it has produced an io-init, so the mods' own side channels — the
   * party and relay sockets some of them open — pass through untouched. */
  var sessions = new WeakMap();

  function toBytes(data) {
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return null;
  }

  /* Rewrite a frame from the server so the page sees the old protocol:
   * numeric opcode back to its name, and io-init's mode field cleared. */
  function inbound(socket, raw) {
    var bytes = toBytes(raw);
    if (!bytes) return raw;

    var frame;
    try { frame = decode(bytes); } catch (e) { return raw; }
    if (!Array.isArray(frame) || frame.length < 2) return raw;

    var type = frame[0];
    var args = frame[1];

    if (type === "io-init") {
      var session = null;
      if (args && args[3] === ENCRYPTED_MODE) {
        session = { key: unhex(args[2]), tables: tablesFor(args[1] >>> 0), seq: 0 };
      }
      sessions.set(socket, session);

      /* Report plaintext mode upward. The game then leaves its own crypto off
       * and emits bare [name, args] frames, which is what the mod hooks above
       * decode — and it leaves this shim as the single owner of the sequence
       * counter and the signature. */
      if (session) {
        var patched = args.slice();
        patched[3] = 0;
        return encode(["io-init", patched]).buffer;
      }
      return raw;
    }

    var s = sessions.get(socket);
    if (!s || typeof type !== "number") return raw;

    var name = s.tables.s2c.dec[type];
    if (name === undefined) return raw;

    return encode([name, args]).buffer;
  }

  /* Turn a bare [name, args] frame from the page into a signed
   * [opcode, args, seq] frame. */
  function outbound(socket, data) {
    var s = sessions.get(socket);
    if (!s) return data;

    var bytes = toBytes(data);
    if (!bytes) return data;

    var frame;
    try { frame = decode(bytes); } catch (e) { return data; }
    if (!Array.isArray(frame) || typeof frame[0] !== "string") return data;

    var opcode = s.tables.c2s.enc[frame[0]];
    if (opcode === undefined) return null;

    var payload = encode([opcode, frame[1], ++s.seq]);
    var out = new Uint8Array(SIG_BYTES + payload.length);
    out.set(sign(s.key, payload), 0);
    out.set(payload, SIG_BYTES);
    return out;
  }

  /* ---- install --------------------------------------------------------
   * Both directions are wrapped on the prototype, before the page runs, so
   * every listener the game and the mod register later is already covered. */

  var nativeSend = WebSocket.prototype.send;

  WebSocket.prototype.send = function (data) {
    var out = outbound(this, data);
    if (out === null) return;            // unknown packet name — drop, do not desync
    return nativeSend.call(this, out);
  };

  function wrapListener(socket, fn) {
    if (typeof fn !== "function") return fn;
    if (fn.__mooWrapped) return fn.__mooWrapped;
    var wrapped = function (event) {
      var rewritten = inbound(socket, event.data);
      if (rewritten === event.data) return fn.call(this, event);

      /* A MessageEvent's `data` is read-only, so hand the page a stand-in that
       * proxies the original and reports the rewritten payload. */
      var view = Object.create(event);
      Object.defineProperty(view, "data", { value: rewritten, enumerable: true });
      return fn.call(this, view);
    };
    fn.__mooWrapped = wrapped;
    return wrapped;
  }

  var nativeAdd = WebSocket.prototype.addEventListener;
  var nativeRemove = WebSocket.prototype.removeEventListener;

  WebSocket.prototype.addEventListener = function (type, fn, opts) {
    return nativeAdd.call(this, type, type === "message" ? wrapListener(this, fn) : fn, opts);
  };
  WebSocket.prototype.removeEventListener = function (type, fn, opts) {
    return nativeRemove.call(this, type, type === "message" && fn && fn.__mooWrapped ? fn.__mooWrapped : fn, opts);
  };

  var onmessage = Object.getOwnPropertyDescriptor(WebSocket.prototype, "onmessage");
  Object.defineProperty(WebSocket.prototype, "onmessage", {
    configurable: true,
    enumerable: true,
    get: function () {
      var fn = onmessage.get.call(this);
      return (fn && fn.__mooOriginal) || fn;
    },
    set: function (fn) {
      var wrapped = wrapListener(this, fn);
      if (wrapped && wrapped !== fn) wrapped.__mooOriginal = fn;
      return onmessage.set.call(this, wrapped);
    },
  });

  /* Exposed so a mod can send a packet without going through its own encoder,
   * and so tools/verify-shim.js can exercise the codec and the crypto. */
  window.__mooShim = {
    encode: encode,
    decode: decode,
    tablesFor: tablesFor,
    sign: sign,
    sha256: sha256,
    session: function (socket) { return sessions.get(socket); },
  };

  /* Several of these mods expect a global `msgpack` from a @require that no
   * longer resolves. Fill it in rather than leaving them to throw. */
  if (!window.msgpack) {
    window.msgpack = {
      encode: encode,
      decode: function (d) { return decode(toBytes(d) || d); },
    };
  }
})();
