// ==UserScript==
// @name         ! LemonMod - Visuals (rebuilt) !
// @namespace    https://lemonmod.com/
// @author       LemonFlux - rebuilt for the current game
// @description  Reload bars, shame counter and insta marker, drawn on the current moomoo.io
// @version      v3.0-fix1
// @icon         https://lemonmod.com/LemonMod.png
// @match        *://*.moomoo.io/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/* -------------------------------------------------------------------------
 * The three things "LemonMod - Visuals" drew, rebuilt for the game in src/.
 *
 *   built by : tools/build-lemon.js   (from tools/lemon-visuals.js)
 *   bridge   : tools/lemon-bridge.js
 *   verified : tools/verify-lemon.js against drivers/game-drivers.json
 *
 * The original Visuals script is a fork of the whole old webpack bundle - it
 * replaces the client instead of hooking it, and predates the current
 * transport entirely, so it cannot be patched forward. This draws the same
 * three things on the current game instead, off the wire.
 *
 * It stands on its own: install it with or without LemonMod. With LemonMod
 * present, the toggles go into its settings menu and the insta marker follows
 * the target it is tracking; without it, the toggles get their own small
 * panel and the marker stays idle.
 * ------------------------------------------------------------------------- */

/*
 * lemon-bridge.js
 *
 * The protocol bridge that build-lemon.js injects at the top of LemonMod v3.0.
 *
 * LemonMod v3.0 speaks the old moomoo.io transport: plain msgpack `[type, args]`
 * frames with string opcodes ("sp", "33", "c", "ch", ...). The game shipped in
 * src/game_index.js does not:
 *
 *   - it negotiates a per-connection opcode permutation on `io-init`
 *     (`io-init[3] === 1`), so every opcode on the wire is a number whose
 *     meaning changes per connection;
 *   - it prefixes every client frame with 6 truncated-HMAC-SHA256 bytes over
 *     the payload, and the payload is `[opcode, args, seq]` rather than
 *     `[type, args]`;
 *   - it caches `WebSocket.prototype.send` at module load and calls that cached
 *     reference directly, so a hook installed after the bundle runs never sees
 *     the game's own traffic.
 *
 * The bridge sits underneath LemonMod and translates in both directions, so the
 * mod keeps sending and receiving exactly the frames it was written against:
 *
 *   game  -> bridge -> [old-style frame] -> LemonMod's send hook -> bridge -> wire
 *   wire  -> bridge -> [old-style frame] -> LemonMod's message listener
 *
 * Because every outgoing frame is re-signed by the bridge, the sequence counter
 * stays monotonic across the game's packets and the mod's packets alike, which
 * a counter of our own running alongside the bundle's private one could not do.
 *
 * The tables and constants here are the ones in drivers/game-drivers.json;
 * tools/verify-lemon.js checks them against the bundle.
 */
(function () {
  "use strict";

  if (window.__lemonBridge) return;

  /* ------------------------------------------------------------------ *
   * Protocol constants (drivers/game-drivers.json -> protocol)
   * ------------------------------------------------------------------ */

  var SIG_BYTES = 6;
  var ENCRYPTED_MODE = 1;
  var TABLE_SALT = 1;
  var C2S_ALPHABET = ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"];
  var S2C_ALPHABET = ["A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P",
    "Q", "R", "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

  /* LemonMod's opcode -> the current bundle's opcode, client to server.
   * Derived from the send sites in src/game_index.js:
   *   M spawn, D aim, 9 move, F attack, z select item, H upgrade, K toggle,
   *   6 chat, L create alliance, N leave, b join request, P accept/decline,
   *   Q kick, c store, S map ping, 0 ping, e reset moves. */
  var C2S = {
    sp: "M",       // spawn        ({ name, moofoll, skin })
    "2": "D",      // aim angle
    "33": "9",     // move direction
    c: "F",        // attack       (state, angle)
    "5": "z",      // select item  (id, isWeapon)
    "6": "H",      // buy upgrade  (index)
    "7": "K",      // toggle       (0 lock dir / 1 auto attack)
    ch: "6",       // chat
    "8": "L",      // create alliance
    "9": "N",      // leave alliance
    "10": "b",     // join alliance request
    "11": "P",     // accept / decline join request
    "12": "Q",     // kick from alliance
    "13c": "c",    // store        (buy|equip, id, isAccessory)
    "14": "S",     // map ping
    pp: "0",       // ping
    rmd: "e"       // reset move keys
  };

  /* The current bundle's opcode -> LemonMod's opcode, server to client.
   * The seventeen LemonMod actually handles carry their old names; the rest get
   * names LemonMod ignores, so that (for example) the bundle's "1" - delete
   * alliance - can never be mistaken for the old "1" - setup game. */
  var S2C = {
    C: "1",        // setup game        (yourSID)          <- handled
    D: "2",        // add player                           <- handled
    H: "6",        // load game objects                    <- handled
    K: "7",        // player attack animation              <- handled
    L: "8",        // wiggle object                        <- handled
    N: "9",        // update resource   (type, value)      <- handled
    P: "11",       // died                                 <- handled
    Q: "12",       // remove object                        <- handled
    R: "13",       // remove every object of a player      <- handled
    U: "16",       // upgrade points                       <- handled
    V: "17",       // items / weapons list                 <- handled
    X: "18",       // add projectile                       <- handled
    a: "33",       // update players                       <- handled
    g: "ac",       // alliance created                     <- handled
    "6": "ch",     // chat message                         <- handled
    O: "h",        // update health                        <- handled
    A: "al",       // alliance list
    B: "d",        // disconnected
    E: "4",        // remove player
    G: "5",        // leaderboard
    I: "aa",       // update animals
    J: "aa2",      // animal attack animation
    M: "tr",       // turret shoot
    S: "14",       // item counts
    T: "15",       // xp / age
    Y: "19",       // projectile range
    Z: "sd",       // server shutdown notice
    "1": "ad",     // alliance deleted
    "2": "an",     // alliance join request
    "3": "st",     // set player team
    "4": "sa",     // alliance members
    "5": "us",     // store state
    "7": "mm",     // minimap ping
    "8": "t",      // floating text
    "9": "p",      // map pulse
    "0": "pp"      // ping response
  };

  var C2S_NEW = {};                                    // new opcode -> old opcode
  for (var oldOp in C2S) C2S_NEW[C2S[oldOp]] = oldOp;

  /* ------------------------------------------------------------------ *
   * msgpack
   *
   * Self-contained on purpose: the transport must not depend on LemonMod's
   * @require of msgpack.js from lemonmod.com being reachable. If that require
   * did fail, `window.msgpack` is filled in from here at the end of this file
   * so the rest of the mod keeps working too.
   * ------------------------------------------------------------------ */

  function utf8Length(str) {
    var len = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 128) len += 1;
      else if (c < 2048) len += 2;
      else if (c >= 55296 && c <= 56319 && i + 1 < str.length) {
        var next = str.charCodeAt(i + 1);
        if ((next & 64512) === 56320) { len += 4; i++; } else len += 3;
      } else len += 3;
    }
    return len;
  }

  function Writer() {
    this.bytes = new Uint8Array(1024);
    this.pos = 0;
  }
  Writer.prototype.need = function (n) {
    if (this.pos + n <= this.bytes.length) return;
    var size = this.bytes.length;
    while (size < this.pos + n) size *= 2;
    var grown = new Uint8Array(size);
    grown.set(this.bytes);
    this.bytes = grown;
  };
  Writer.prototype.u8 = function (v) { this.need(1); this.bytes[this.pos++] = v; };
  Writer.prototype.raw = function (arr) { this.need(arr.length); this.bytes.set(arr, this.pos); this.pos += arr.length; };
  Writer.prototype.view = function (n) {
    this.need(n);
    var dv = new DataView(this.bytes.buffer, this.pos, n);
    this.pos += n;
    return dv;
  };
  Writer.prototype.done = function () { return this.bytes.slice(0, this.pos); };

  function encodeInto(w, value) {
    if (value === null || value === undefined) { w.u8(0xc0); return; }
    var t = typeof value;
    if (t === "boolean") { w.u8(value ? 0xc3 : 0xc2); return; }
    if (t === "number") {
      if (Number.isSafeInteger(value)) {
        if (value >= 0) {
          if (value < 128) w.u8(value);
          else if (value < 256) { w.u8(0xcc); w.u8(value); }
          else if (value < 65536) { w.u8(0xcd); w.view(2).setUint16(0, value); }
          else if (value < 4294967296) { w.u8(0xce); w.view(4).setUint32(0, value); }
          else { w.u8(0xcb); w.view(8).setFloat64(0, value); }
        } else if (value >= -32) w.u8(0xe0 | (value + 32));
        else if (value >= -128) { w.u8(0xd0); w.view(1).setInt8(0, value); }
        else if (value >= -32768) { w.u8(0xd1); w.view(2).setInt16(0, value); }
        else if (value >= -2147483648) { w.u8(0xd2); w.view(4).setInt32(0, value); }
        else { w.u8(0xcb); w.view(8).setFloat64(0, value); }
      } else { w.u8(0xcb); w.view(8).setFloat64(0, value); }
      return;
    }
    if (t === "string") {
      var len = utf8Length(value);
      if (len < 32) w.u8(0xa0 | len);
      else if (len < 256) { w.u8(0xd9); w.u8(len); }
      else if (len < 65536) { w.u8(0xda); w.view(2).setUint16(0, len); }
      else { w.u8(0xdb); w.view(4).setUint32(0, len); }
      w.need(len);
      var pos = w.pos;
      for (var i = 0; i < value.length; i++) {
        var c = value.charCodeAt(i);
        if (c >= 55296 && c <= 56319 && i + 1 < value.length) {
          var next = value.charCodeAt(i + 1);
          if ((next & 64512) === 56320) { c = ((c & 1023) << 10) + (next & 1023) + 65536; i++; }
        }
        if (c < 128) w.bytes[pos++] = c;
        else if (c < 2048) {
          w.bytes[pos++] = (c >> 6) | 192;
          w.bytes[pos++] = (c & 63) | 128;
        } else if (c < 65536) {
          w.bytes[pos++] = (c >> 12) | 224;
          w.bytes[pos++] = ((c >> 6) & 63) | 128;
          w.bytes[pos++] = (c & 63) | 128;
        } else {
          w.bytes[pos++] = (c >> 18) | 240;
          w.bytes[pos++] = ((c >> 12) & 63) | 128;
          w.bytes[pos++] = ((c >> 6) & 63) | 128;
          w.bytes[pos++] = (c & 63) | 128;
        }
      }
      w.pos = pos;
      return;
    }
    if (value instanceof Uint8Array || ArrayBuffer.isView(value)) {
      var bin = value instanceof Uint8Array
        ? value
        : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      if (bin.length < 256) { w.u8(0xc4); w.u8(bin.length); }
      else if (bin.length < 65536) { w.u8(0xc5); w.view(2).setUint16(0, bin.length); }
      else { w.u8(0xc6); w.view(4).setUint32(0, bin.length); }
      w.raw(bin);
      return;
    }
    if (Array.isArray(value)) {
      if (value.length < 16) w.u8(0x90 | value.length);
      else if (value.length < 65536) { w.u8(0xdc); w.view(2).setUint16(0, value.length); }
      else { w.u8(0xdd); w.view(4).setUint32(0, value.length); }
      for (var n = 0; n < value.length; n++) encodeInto(w, value[n]);
      return;
    }
    var keys = Object.keys(value);
    if (keys.length < 16) w.u8(0x80 | keys.length);
    else if (keys.length < 65536) { w.u8(0xde); w.view(2).setUint16(0, keys.length); }
    else { w.u8(0xdf); w.view(4).setUint32(0, keys.length); }
    for (var k = 0; k < keys.length; k++) {
      encodeInto(w, keys[k]);
      encodeInto(w, value[keys[k]]);
    }
  }

  function encode(value) {
    var w = new Writer();
    encodeInto(w, value);
    return w.done();
  }

  function Reader(bytes) {
    this.b = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = 0;
  }
  Reader.prototype.need = function (n) {
    if (this.pos + n > this.b.length) throw new Error("msgpack: truncated");
  };
  Reader.prototype.str = function (len) {
    this.need(len);
    var out = "";
    var end = this.pos + len;
    while (this.pos < end) {
      var c = this.b[this.pos++];
      if (c < 128) out += String.fromCharCode(c);
      else if ((c & 224) === 192) out += String.fromCharCode(((c & 31) << 6) | (this.b[this.pos++] & 63));
      else if ((c & 240) === 224) {
        out += String.fromCharCode(((c & 15) << 12) | ((this.b[this.pos++] & 63) << 6) | (this.b[this.pos++] & 63));
      } else {
        var cp = ((c & 7) << 18) | ((this.b[this.pos++] & 63) << 12) |
          ((this.b[this.pos++] & 63) << 6) | (this.b[this.pos++] & 63);
        cp -= 65536;
        out += String.fromCharCode(55296 | (cp >> 10), 56320 | (cp & 1023));
      }
    }
    return out;
  };
  Reader.prototype.value = function () {
    this.need(1);
    var h = this.b[this.pos++];
    if (h < 0x80) return h;
    if (h >= 0xe0) return h - 256;
    if (h >= 0x80 && h <= 0x8f) return this.map(h & 15);
    if (h >= 0x90 && h <= 0x9f) return this.array(h & 15);
    if (h >= 0xa0 && h <= 0xbf) return this.str(h & 31);
    var dv;
    switch (h) {
      case 0xc0: return null;
      case 0xc2: return false;
      case 0xc3: return true;
      case 0xc4: this.need(1); return this.bin(this.b[this.pos++]);
      case 0xc5: dv = this.dv(2); return this.bin(dv.getUint16(0));
      case 0xc6: dv = this.dv(4); return this.bin(dv.getUint32(0));
      case 0xca: dv = this.dv(4); return dv.getFloat32(0);
      case 0xcb: dv = this.dv(8); return dv.getFloat64(0);
      case 0xcc: this.need(1); return this.b[this.pos++];
      case 0xcd: dv = this.dv(2); return dv.getUint16(0);
      case 0xce: dv = this.dv(4); return dv.getUint32(0);
      case 0xcf: dv = this.dv(8); return dv.getUint32(0) * 4294967296 + dv.getUint32(4);
      case 0xd0: dv = this.dv(1); return dv.getInt8(0);
      case 0xd1: dv = this.dv(2); return dv.getInt16(0);
      case 0xd2: dv = this.dv(4); return dv.getInt32(0);
      case 0xd3: dv = this.dv(8); return dv.getInt32(0) * 4294967296 + dv.getUint32(4);
      case 0xd9: this.need(1); return this.str(this.b[this.pos++]);
      case 0xda: dv = this.dv(2); return this.str(dv.getUint16(0));
      case 0xdb: dv = this.dv(4); return this.str(dv.getUint32(0));
      case 0xdc: dv = this.dv(2); return this.array(dv.getUint16(0));
      case 0xdd: dv = this.dv(4); return this.array(dv.getUint32(0));
      case 0xde: dv = this.dv(2); return this.map(dv.getUint16(0));
      case 0xdf: dv = this.dv(4); return this.map(dv.getUint32(0));
      default: throw new Error("msgpack: unsupported type 0x" + h.toString(16));
    }
  };
  Reader.prototype.dv = function (n) {
    this.need(n);
    var dv = new DataView(this.b.buffer, this.b.byteOffset + this.pos, n);
    this.pos += n;
    return dv;
  };
  Reader.prototype.bin = function (len) {
    this.need(len);
    var out = this.b.slice(this.pos, this.pos + len);
    this.pos += len;
    return out;
  };
  Reader.prototype.array = function (len) {
    var out = new Array(len);
    for (var i = 0; i < len; i++) out[i] = this.value();
    return out;
  };
  Reader.prototype.map = function (len) {
    var out = {};
    for (var i = 0; i < len; i++) {
      var key = this.value();
      out[key] = this.value();
    }
    return out;
  };

  /* Strict: the frame has to decode cleanly *and* use every byte. That is what
   * makes "is this an old-style mod frame or a signed game frame?" a decision
   * and not a guess - a signed frame starts with six HMAC bytes, which only
   * decode as a complete msgpack document by coincidence. */
  function decode(bytes) {
    var r = new Reader(bytes);
    var value = r.value();
    if (r.pos !== bytes.length) throw new Error("msgpack: trailing bytes");
    return value;
  }

  /* ------------------------------------------------------------------ *
   * Frame signing - SHA-256 / HMAC, truncated to SIG_BYTES
   * (the same construction as `Vt` / `Ao` / `Eo` in src/game_index.js)
   * ------------------------------------------------------------------ */

  var K = new Uint32Array([
    1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221,
    3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580,
    3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
    2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895,
    666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037,
    2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
    430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779,
    1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298
  ]);

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256(input) {
    var h = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762,
      1359893119, 2600822924, 528734635, 1541459225]);
    var len = input.length;
    var bits = len * 8;
    var padded = new Uint8Array(Math.ceil((len + 9) / 64) * 64);
    padded.set(input);
    padded[len] = 128;
    var dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 4, bits >>> 0, false);
    dv.setUint32(padded.length - 8, Math.floor(bits / 4294967296), false);
    var w = new Uint32Array(64);
    for (var off = 0; off < padded.length; off += 64) {
      for (var i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
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
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    var out = new Uint8Array(32);
    var outView = new DataView(out.buffer);
    for (var j = 0; j < 8; j++) outView.setUint32(j * 4, h[j], false);
    return out;
  }

  var BLOCK = 64;

  function hmac(key, message) {
    var k = key;
    if (k.length > BLOCK) k = sha256(k);
    var padKey = new Uint8Array(BLOCK);
    padKey.set(k);
    var inner = new Uint8Array(BLOCK + message.length);
    var outer = new Uint8Array(BLOCK + 32);
    for (var i = 0; i < BLOCK; i++) {
      inner[i] = padKey[i] ^ 54;
      outer[i] = padKey[i] ^ 92;
    }
    inner.set(message, BLOCK);
    outer.set(sha256(inner), BLOCK);
    return sha256(outer);
  }

  function signature(key, payload) {
    return hmac(key, payload).subarray(0, SIG_BYTES);
  }

  function hexToBytes(hex) {
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Opcode permutation (`Co` / `Oi` / `Po` in src/game_index.js)
   * ------------------------------------------------------------------ */

  function prng(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 1831565813) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function permute(alphabet, seed) {
    var n = alphabet.length;
    var order = alphabet.map(function (_, i) { return i; });
    var random = prng(seed >>> 0);
    for (var i = n - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    var enc = {};
    var dec = {};
    for (var k = 0; k < n; k++) {
      enc[alphabet[k]] = order[k];
      dec[order[k]] = alphabet[k];
    }
    return { enc: enc, dec: dec };
  }

  function buildTables(seed) {
    var mixed = (seed ^ Math.imul(TABLE_SALT, 2654435761)) >>> 0;
    return {
      c2s: permute(C2S_ALPHABET, mixed),
      s2c: permute(S2C_ALPHABET, (mixed ^ 2246822507) >>> 0)
    };
  }

  /* ------------------------------------------------------------------ *
   * Per-socket transport state
   * ------------------------------------------------------------------ */

  var sockets = new WeakMap();
  var warnedUnsigned = false;

  function stateOf(socket) {
    return sockets.get(socket) || null;
  }

  function onIoInit(socket, args) {
    if (!args || args[3] !== ENCRYPTED_MODE) {
      sockets.set(socket, { mode: 0, key: null, tables: null, seq: 0 });
      return;
    }
    sockets.set(socket, {
      mode: ENCRYPTED_MODE,
      key: hexToBytes(args[2]),
      tables: buildTables(args[1] >>> 0),
      seq: 0
    });
  }

  function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Outgoing
   * ------------------------------------------------------------------ */

  /* A frame the way LemonMod expects to see it, or null if we cannot tell what
   * it is (a raw buffer the mod built itself, say) and should leave it alone. */
  function toOldStyle(socket, data) {
    var bytes = toBytes(data);
    if (!bytes) return null;
    var st = stateOf(socket);

    if (st && st.mode === ENCRYPTED_MODE && bytes.length > SIG_BYTES) {
      try {
        var payload = decode(bytes.subarray(SIG_BYTES));
        if (Array.isArray(payload) && payload.length === 3 && typeof payload[0] === "number") {
          var letter = st.tables.c2s.dec[payload[0]];
          var old = letter !== undefined ? C2S_NEW[letter] : undefined;
          if (old !== undefined) return encode([old, payload[1] || []]);
          return null;
        }
      } catch (e) {}
    }

    try {
      var plain = decode(bytes);
      if (Array.isArray(plain) && plain.length >= 1 && typeof plain[0] === "string") {
        if (C2S[plain[0]] !== undefined) return bytes;            // already old-style
        if (C2S_NEW[plain[0]] !== undefined) {                    // plain-mode game frame
          return encode([C2S_NEW[plain[0]], plain[1] === undefined ? [] : plain[1]]);
        }
      }
    } catch (e) {}

    return null;
  }

  function sendSigned(socket, st, code, args) {
    var payload = encode([code, args, ++st.seq]);
    var out = new Uint8Array(SIG_BYTES + payload.length);
    out.set(signature(st.key, payload), 0);
    out.set(payload, SIG_BYTES);
    nativeSend.call(socket, out);
  }

  /* Put a frame on the wire: translate the opcode, re-sign, send. */
  function dispatch(socket, data) {
    var bytes = toBytes(data);
    if (!bytes) return;
    var st = stateOf(socket);

    /* An already-signed frame that never became an old-style one - the mod has
     * no name for that opcode. It still gets re-numbered rather than passed
     * through, because the sequence counter on the wire has to be ours alone. */
    if (st && st.mode === ENCRYPTED_MODE && bytes.length > SIG_BYTES) {
      try {
        var signedPayload = decode(bytes.subarray(SIG_BYTES));
        if (Array.isArray(signedPayload) && signedPayload.length === 3 && typeof signedPayload[0] === "number") {
          sendSigned(socket, st, signedPayload[0], signedPayload[1] || []);
          return;
        }
      } catch (e) {}
    }

    var frame = null;
    try {
      frame = decode(bytes);
    } catch (e) {}

    if (!Array.isArray(frame) || frame.length < 1 || typeof frame[0] !== "string") {
      nativeSend.call(socket, bytes);       // not ours to touch
      return;
    }

    var type = frame[0];
    var args = Array.isArray(frame[1]) ? frame[1] : frame.slice(1);
    var opcode = C2S[type] !== undefined ? C2S[type] : (C2S_NEW[type] !== undefined ? type : undefined);
    if (opcode === undefined) {
      nativeSend.call(socket, bytes);
      return;
    }

    if (!st || st.mode !== ENCRYPTED_MODE) {
      if (!st && !warnedUnsigned) {
        warnedUnsigned = true;
        try {
          console.warn("LemonMod bridge: sending \"" + type + "\" before io-init was seen on this socket - " +
            "the frame goes out unsigned and the server will drop it.");
        } catch (e) {}
      }
      nativeSend.call(socket, encode([opcode, args]));
      return;
    }

    var code = st.tables.c2s.enc[opcode];
    if (code === undefined) return;
    sendSigned(socket, st, code, args);
    if (type === "sp") watchSpawn(socket);
  }

  function watchSpawn(socket) {
    spawnSentAt = Date.now();
    if (spawnTimer !== null) clearTimeout(spawnTimer);
    spawnTimer = setTimeout(function () {
      spawnWentNowhere(socket);
    }, 4000);
  }

  /* ------------------------------------------------------------------ *
   * Incoming
   * ------------------------------------------------------------------ */

  /* The opcode this frame carries, under the name LemonMod knows it by, or
   * undefined if there is no name for it. */
  function oldName(socket, type) {
    if (typeof type === "number") {
      var st = stateOf(socket);
      if (!st || !st.tables) return undefined;
      type = st.tables.s2c.dec[type];
      if (type === undefined) return undefined;
    }
    if (type === "io-init") return "io-init";
    return S2C[type];
  }

  function toOldStyleMessage(socket, raw) {
    var bytes = toBytes(raw);
    if (!bytes) return null;
    var decoded;
    try {
      decoded = decode(bytes);
    } catch (e) {
      return null;
    }
    if (!Array.isArray(decoded)) return null;

    var old = oldName(socket, decoded[0]);
    if (old === undefined) return null;
    if (old === "io-init") return raw;

    var out = encode([old, decoded[1] === undefined ? [] : decoded[1]]);
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  }

  /* Anything that wants to read the wire without hooking it itself - the
   * visuals overlay does - registers here and is handed every incoming frame
   * under its old name, once, whichever socket it arrived on. */
  var observers = [];

  function notify(socket, decoded) {
    var old = oldName(socket, decoded[0]);
    if (old === undefined) return;
    var args = decoded[1] === undefined ? [] : decoded[1];
    if (old === "1") spawnConfirmed();
    else if (old === "11") setSpawned(false);
    for (var i = 0; i < observers.length; i++) {
      try {
        observers[i](socket, old, args);
      } catch (e) {}
    }
  }

  /* ------------------------------------------------------------------ *
   * `window.hasSpawned`
   *
   * LemonMod sets this the moment the Play button is clicked, and a timer of
   * its own then keeps `#mainMenu` hidden for as long as it is true:
   *
   *   document.getElementById("enterGame").addEventListener("click", () => {
   *     …; window.hasSpawned = true;
   *   });
   *   setInterval(() => { if (window.hasSpawned && …)
   *     document.getElementById("mainMenu").style.display = "none"; }, …);
   *
   * So a spawn that does not come back takes the menu with it: no HUD, no
   * menu, the world from before still drawn, and no way to press Play again.
   * That is the screen people get stuck on.
   *
   * The flag is answered from the wire instead - true when the server sends
   * the setup frame that actually starts the game, false again on death or a
   * dropped connection - and the mod's own optimistic writes are ignored.
   * ------------------------------------------------------------------ */

  var spawned = false;
  var spawnSentAt = 0;
  var spawnTimer = null;

  function setSpawned(value) {
    spawned = !!value;
    if (spawned) {
      spawnSentAt = 0;
      if (spawnTimer !== null) {
        clearTimeout(spawnTimer);
        spawnTimer = null;
      }
    }
  }

  function spawnConfirmed() {
    setSpawned(true);
  }

  try {
    Object.defineProperty(window, "hasSpawned", {
      configurable: true,
      get: function () { return spawned; },
      set: function () { /* answered from the wire, not from the click */ }
    });
  } catch (e) {}

  /* If a spawn goes out and the game never starts, say so where it can be
   * read - the menu is still there to read it in, now that it stays put. */
  function spawnWentNowhere(socket) {
    spawnTimer = null;
    if (spawned) return;
    var st = stateOf(socket);
    var why = !st
      ? "the connection handshake was never seen (io-init missed - reload once)"
      : st.mode !== ENCRYPTED_MODE
        ? "the server did not negotiate the signed transport"
        : "the server did not answer it";
    var text = "LemonMod bridge: spawn sent, " + why + ".";
    try {
      console.warn(text);
    } catch (e) {}
    try {
      var loading = document.getElementById("loadingText");
      if (loading && loading.style.display !== "none") {
        loading.innerHTML = text +
          "<a href='javascript:window.location.href=window.location.href' class='ytLink'>reload</a>";
      }
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ *
   * Hooks
   * ------------------------------------------------------------------ */

  var Native = window.WebSocket;
  var nativeSend = Native.prototype.send;
  var nativeAddEventListener = Native.prototype.addEventListener ||
    EventTarget.prototype.addEventListener;

  var modHook = null;          // LemonMod's own WebSocket.prototype.send
  var inMod = false;           // true while a frame is inside that hook
  var dispatched = false;      // did the hook hand the frame back to us?

  function isSpawn(frame) {
    try {
      var decoded = decode(toBytes(frame));
      return Array.isArray(decoded) && decoded[0] === "sp";
    } catch (e) {
      return false;
    }
  }

  function bridgeSend(data) {
    var socket = this;
    if (inMod) {
      dispatched = true;
      dispatch(socket, data);
      return;
    }
    if (modHook) {
      var old = toOldStyle(socket, data);
      if (old !== null) {
        inMod = true;
        dispatched = false;
        try {
          modHook.call(socket, old);
        } catch (e) {
          if (!dispatched) {
            try { dispatch(socket, old); } catch (e2) {}
          }
        } finally {
          inMod = false;
        }
        /* The mod's hook drops every frame while one of the inputs it lists
         * has focus. That is its business for ordinary traffic - but a
         * swallowed spawn leaves the game unreachable, and the hook does not
         * look at spawns anyway, so this one always goes out. */
        if (!dispatched && isSpawn(old)) {
          try { dispatch(socket, old); } catch (e3) {}
        }
        return;
      }
    }
    dispatch(socket, data);
  }

  try {
    Object.defineProperty(Native.prototype, "send", {
      configurable: true,
      enumerable: false,
      get: function () { return bridgeSend; },
      set: function (fn) { modHook = typeof fn === "function" ? fn : null; }
    });
  } catch (e) {
    Native.prototype.send = bridgeSend;
  }

  function bridgedMessageListener(socket, listener) {
    return function (event) {
      var translated = toOldStyleMessage(socket, event.data);
      if (translated === null) return;
      listener.call(socket, {
        data: translated,
        type: "message",
        target: socket,
        currentTarget: socket,
        origin: event.origin,
        bridged: true
      });
    };
  }

  /* LemonMod's bot sockets take their messages through `onmessage` rather than
   * addEventListener, and the bundle's own socket does too - so the property
   * itself cannot be wrapped without also rewriting the game's view of the
   * wire. build-lemon.js points the mod's assignment at this instead, which
   * translates for that socket and leaves the game's alone. */
  try {
    Object.defineProperty(Native.prototype, "__lemonBotMessage", {
      configurable: true,
      enumerable: false,
      get: function () { return this.__lemonBotMessageFn || null; },
      set: function (fn) {
        if (typeof fn !== "function") return;
        this.__lemonBotMessageFn = fn;
        nativeAddEventListener.call(this, "message", bridgedMessageListener(this, fn));
      }
    });
  } catch (e) {}

  Native.prototype.addEventListener = function (type, listener, options) {
    if (type === "message" && typeof listener === "function" && !listener.__lemonBridged) {
      var wrapped = bridgedMessageListener(this, listener);
      wrapped.__lemonBridged = true;
      return nativeAddEventListener.call(this, type, wrapped, options);
    }
    return nativeAddEventListener.call(this, type, listener, options);
  };

  /* The bundle caches `WebSocket.prototype.send` when it loads and calls that
   * cached reference directly, so the hooks above only ever see the game's own
   * traffic if they are installed before the bundle runs - hence
   * `@run-at document-start`. The constructor is wrapped as well so that
   * `io-init` is observed before the bundle's own `onmessage` handler sees it,
   * which is where the key and the opcode tables come from. */
  function observeSocket(socket) {
    if (socket.__lemonObserved) return;
    socket.__lemonObserved = true;
    nativeAddEventListener.call(socket, "message", function (event) {
      var bytes = toBytes(event.data);
      if (!bytes) return;
      try {
        var decoded = decode(bytes);
        if (!Array.isArray(decoded)) return;
        if (decoded[0] === "io-init") onIoInit(socket, decoded[1]);
        notify(socket, decoded);
      } catch (e) {}
    });
    nativeAddEventListener.call(socket, "close", function () {
      setSpawned(false);
    });
  }

  function BridgedWebSocket(url, protocols) {
    var socket = protocols === undefined ? new Native(url) : new Native(url, protocols);
    observeSocket(socket);
    return socket;
  }
  BridgedWebSocket.prototype = Native.prototype;
  BridgedWebSocket.CONNECTING = Native.CONNECTING;
  BridgedWebSocket.OPEN = Native.OPEN;
  BridgedWebSocket.CLOSING = Native.CLOSING;
  BridgedWebSocket.CLOSED = Native.CLOSED;

  try {
    window.WebSocket = BridgedWebSocket;
  } catch (e) {}

  /* Belt and braces, always - not only when the constructor could not be
   * wrapped. If this script lands after the bundle has already cached the
   * constructor (a slow @require can do that), the socket is still built
   * later than that, and the bundle reaches it through `onmessage`. Catching
   * the handshake there is what keeps the key and the opcode tables coming
   * even on a late load. `observeSocket` only ever attaches once per socket. */
  try {
    Object.defineProperty(Native.prototype, "onmessage", {
      configurable: true,
      get: function () { return this.__lemonOnMessage || null; },
      set: function (fn) {
        var socket = this;
        this.__lemonOnMessage = fn;
        observeSocket(this);
        if (this.__lemonOnMessageHooked) return;
        this.__lemonOnMessageHooked = true;
        nativeAddEventListener.call(this, "message", function (event) {
          if (socket.__lemonOnMessage) socket.__lemonOnMessage.call(socket, event);
        });
      }
    });
  } catch (err) {}

  /* Every UI and key handler in the bundle goes through `checkTrusted`, which
   * drops any event with `isTrusted === false` - so the clicks and mouse moves
   * LemonMod synthesises (accepting an alliance request, aiming through the
   * canvas) land on handlers that ignore them. Report synthetic events as
   * trusted; the bundle reads the flag nowhere else. */
  try {
    var isTrusted = Object.getOwnPropertyDescriptor(Event.prototype, "isTrusted");
    if (isTrusted && isTrusted.configurable) {
      Object.defineProperty(Event.prototype, "isTrusted", {
        configurable: true,
        enumerable: isTrusted.enumerable,
        get: function () { return true; }
      });
    }
  } catch (e) {}

  /* The bundle puts a red "disable your userscript manager" banner over the
   * menu whenever it spots one, which it does from the extension IDs alone -
   * with or without this script. `ys()` bails if the banner already exists, so
   * claim the id with an empty node. */
  try {
    var placeholder = document.createElement("div");
    placeholder.id = "userscript-warning";
    placeholder.style.display = "none";
    (document.documentElement || document.head).appendChild(placeholder);
  } catch (e) {}

  if (typeof window.msgpack === "undefined") {
    window.msgpack = { encode: encode, decode: function (d) { return decode(toBytes(d) || d); } };
  }

  window.__lemonBridge = {
    version: "1.0.0",
    c2s: C2S,
    s2c: S2C,
    msgpack: { encode: encode, decode: decode },
    stateOf: stateOf,
    observe: function (fn) {
      if (typeof fn === "function") observers.push(fn);
    },
    /* what to read out when something is not working */
    status: function (socket) {
      var target = socket || (typeof document !== "undefined" && document.ws) || null;
      var st = target ? stateOf(target) : null;
      return {
        installed: true,
        modHookSeen: modHook !== null,
        socket: !!target,
        handshake: !!st,
        signedTransport: !!(st && st.mode === ENCRYPTED_MODE),
        framesSent: st ? st.seq : 0,
        spawned: spawned,
        spawnSentAt: spawnSentAt
      };
    },
    protocol: {
      signatureBytes: SIG_BYTES,
      encryptedMode: ENCRYPTED_MODE,
      tableSalt: TABLE_SALT,
      c2sAlphabet: C2S_ALPHABET,
      s2cAlphabet: S2C_ALPHABET
    }
  };
})();

/*
 * lemon-visuals.js
 *
 * The three things `LemonMod - Visuals` added, rebuilt for the current game.
 *
 * That script is a fork of the whole old webpack bundle: it replaces the client
 * rather than hooking it, so it cannot be patched forward - see the README. Its
 * renderer changes, though, are three self-contained features, and those are
 * portable:
 *
 *   1. reload bars      - primary and secondary weapon reload, drawn above each
 *                         player's health bar in the fork's three colours;
 *   2. shame counter    - `<n/7>` after every other player's name, counting the
 *                         times they healed straight out of damage;
 *   3. insta marker     - a crosshair over the player LemonMod is tracking,
 *                         while its insta display reads ON.
 *
 * Neither the camera nor the interpolation is reachable from outside the
 * bundle, so nothing here tries to reproduce them. Instead the overlay draws
 * from inside the game's own render pass: the bundle strokes and then fills
 * each nametag at `(x - xOffset, y - yOffset - scale - nameY)`, so hooking
 * fillText hands us the exact screen position of every visible player, in the
 * frame it is drawn, with the game's own interpolation already applied. The
 * health bar sits `2 * (playerScale + nameY)` below that, which is where the
 * bars are measured from.
 *
 * State comes off the wire through the bridge's observer hook, under the old
 * opcode names, and the reload model is the fork's own: accumulate
 * `111 / weapon.speed` per tick, reset on the attack the player is seen making.
 */
(function () {
  "use strict";

  if (window.__lemonVisuals) return;
  var bridge = window.__lemonBridge;
  if (!bridge || typeof bridge.observe !== "function") return;

  /* ------------------------------------------------------------------ *
   * Constants (drivers/game-drivers.json -> config, weapons)
   * ------------------------------------------------------------------ */

  var PLAYER_SCALE = 35;
  var NAME_Y = 34;
  var HEALTH_BAR_WIDTH = 50;
  var HEALTH_BAR_PAD = 4.5;
  var BAR_HEIGHT = 17;
  var TICK_MS = 111;                       // the server tick the fork counts in
  var BAR_LIFT = 13;                       // how far above the health bar

  var BAR_BACKGROUND = "#3d3f42";          // the bundle's own health bar backing
  var RELOADED = "#fff200";
  var HALF_RELOADED = "#ffa600";
  var NOT_RELOADED = "#FF0000";

  /* weapon fire rates, index-aligned with the bundle's weapon list */
  var WEAPON_SPEED = [300, 400, 400, 300, 300, 700, 300, 100, 400,
    600, 400, null, 700, 230, 700, 1500];
  var PRIMARY_COUNT = 9;                   // 0..8 primary, 9..15 secondary
  var MELEE_SECONDARY = { 10: true, 14: true };

  /* ------------------------------------------------------------------ *
   * What the wire says
   * ------------------------------------------------------------------ */

  var players = new Map();                 // sid -> state
  var bySocketId = new Map();              // player id -> sid
  var mainSocket = null;
  var selfSid = null;
  var tick = 0;

  function player(sid) {
    var p = players.get(sid);
    if (!p) {
      p = {
        sid: sid, name: "", team: null, health: 100, skinIndex: null,
        weaponIndex: 0, buildIndex: -1, primary: 0, secondary: null,
        primaryReload: 1, secondaryReload: 1, pr: 1, sr: 1,
        tickAt: 0, clown: 0, lastDamage: 0,
        x: 0, y: 0, px: 0, py: 0
      };
      players.set(sid, p);
    }
    return p;
  }

  function reloadStep(weapon) {
    var speed = WEAPON_SPEED[weapon];
    return speed ? TICK_MS / speed : 1;
  }

  /* The fork's model, kept as it was: a weapon the player is holding but not
   * building with recharges a tick's worth per update, and the attack itself
   * empties it. */
  function onTick(data) {
    tick++;
    var now = Date.now();
    for (var i = 0; i < data.length; i += 13) {
      var p = player(data[i]);
      p.px = p.x;
      p.py = p.y;
      p.x = data[i + 1];
      p.y = data[i + 2];
      p.buildIndex = data[i + 4];
      p.weaponIndex = data[i + 5];
      p.team = data[i + 7] === undefined ? null : data[i + 7];
      p.skinIndex = data[i + 9];
      p.tickAt = now;

      if (p.skinIndex === 45) p.clown = 7;          // wearing Shame! already

      if (p.weaponIndex < PRIMARY_COUNT) {
        if (p.weaponIndex === p.primary) {
          p.pr = p.primaryReload;
          p.sr = p.secondaryReload;
          if (p.buildIndex === -1) {
            p.primaryReload = Math.min(1, p.primaryReload + reloadStep(p.primary));
          }
        } else {
          p.primary = p.weaponIndex;
        }
      } else if (p.weaponIndex === p.secondary) {
        p.sr = p.secondaryReload;
        p.pr = p.primaryReload;
        if (p.buildIndex === -1) {
          p.secondaryReload = Math.min(1, p.secondaryReload + reloadStep(p.secondary));
        }
      } else {
        p.secondary = p.weaponIndex;
      }
    }
  }

  /* `startAnim(didHit, weaponIndex)` in the bundle, so the third argument says
   * which weapon swung. The fork emptied the primary bar for anything that was
   * not a great hammer or mc grabby, which also fired on bow and musket shots;
   * those are the ones the projectile below accounts for, so they are left
   * alone here. */
  function onAttack(sid, didHit, index) {
    var p = players.get(sid);
    if (!p) return;
    if (MELEE_SECONDARY[index]) p.secondaryReload = 0;
    else if (index === undefined || index < PRIMARY_COUNT) p.primaryReload = 0;
  }

  /* A projectile appears without saying who fired it, so the fork looks for the
   * nearest player holding a secondary that shoots at that speed. Same idea
   * here, off the last two positions we were sent. */
  function onProjectile(x, y, dir, range, speed) {
    var best = null;
    var bestDist = Infinity;
    players.forEach(function (p) {
      if (p.secondary === null || WEAPON_SPEED[p.secondary] === null) return;
      var ex = p.x + (p.x - p.px) * 0.5;
      var ey = p.y + (p.y - p.py) * 0.5;
      var dist = Math.pow(ex - x + 80 * Math.cos(dir), 2) + Math.pow(ey - y + 80 * Math.sin(dir), 2);
      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    });
    if (best && Math.sqrt(bestDist) < 220) best.secondaryReload = 0;
  }

  /* Health going up right after it went down is the shame the counter counts. */
  function onHealth(sid, health) {
    var p = players.get(sid);
    if (!p) return;
    var change = health - p.health;
    if (change > 0) {
      if (p.lastDamage) {
        if (tick - p.lastDamage < 2) p.clown++;
        else p.clown = Math.max(0, p.clown - 2);
        p.lastDamage = 0;
      }
    } else if (change < 0) {
      p.lastDamage = tick;
    }
    p.health = health;
  }

  bridge.observe(function (socket, type, args) {
    if (mainSocket === null) mainSocket = socket;      // the game connects first
    if (socket !== mainSocket) return;
    switch (type) {
      case "1":
        selfSid = args[0];
        break;
      case "2": {
        var data = args[0] || [];
        var p = player(data[1]);
        bySocketId.set(data[0], data[1]);
        p.name = data[2] || "";
        p.health = data[6] === undefined ? 100 : data[6];
        p.primaryReload = p.secondaryReload = p.pr = p.sr = 1;
        p.clown = 0;
        p.lastDamage = 0;
        break;
      }
      case "4": {
        var sid = bySocketId.get(args[0]);
        if (sid !== undefined) {
          players.delete(sid);
          bySocketId.delete(args[0]);
        }
        break;
      }
      case "33":
        onTick(args[0] || []);
        break;
      case "7":
        onAttack(args[0], args[1], args[2]);
        break;
      case "18":
        onProjectile(args[0], args[1], args[2], args[3], args[4]);
        break;
      case "h":
        onHealth(args[0], args[1]);
        break;
      case "11":
        players.forEach(function (p) {
          p.primaryReload = p.secondaryReload = p.pr = p.sr = 1;
        });
        break;
    }
  });

  /* ------------------------------------------------------------------ *
   * Settings, in LemonMod's own menu
   *
   * The fork's toggles lived in its own settings panel, which went with it.
   * These clone the markup LemonMod uses for its checkboxes and sit beside
   * them; if that menu is not there, the features stay on their defaults and
   * `window.__lemonVisuals.settings` still works.
   * ------------------------------------------------------------------ */

  var settings = { reloadBars: true, shameCounter: true, instaMarker: true };

  function remember(name, input) {
    var stored = null;
    try {
      stored = localStorage.getItem("lemonVisuals." + name);
    } catch (e) {}
    if (stored !== null) settings[name] = stored === "1";
    input.checked = settings[name];
    input.addEventListener("change", function () {
      settings[name] = input.checked;
      try {
        localStorage.setItem("lemonVisuals." + name, input.checked ? "1" : "0");
      } catch (e) {}
    });
  }

  function addToggles() {
    if (document.getElementById("reloadBars")) return true;
    var anchor = document.getElementById("radar");
    if (!anchor || !anchor.parentElement || !anchor.parentElement.parentElement) return false;
    var after = anchor.parentElement.parentElement;        // <div><label>…</label></div>

    [["reloadBars", "Reload Bars"], ["shameCounter", "Shame Counter"], ["instaMarker", "Insta Marker"]]
      .forEach(function (pair) {
        var holder = document.createElement("div");
        var label = document.createElement("label");
        label.className = pair[0];
        var input = document.createElement("input");
        input.id = pair[0];
        input.type = "checkbox";
        input.className = "i-checkbox";
        label.appendChild(input);
        label.appendChild(document.createTextNode(pair[1]));
        holder.appendChild(label);
        after.parentElement.insertBefore(holder, after.nextSibling);
        after = holder;
        remember(pair[0], input);
      });
    return true;
  }

  function enabled(name) {
    var input = document.getElementById(name);
    return input ? input.checked : settings[name];
  }

  /* ------------------------------------------------------------------ *
   * Drawing, from inside the bundle's own render pass
   * ------------------------------------------------------------------ */

  function nameOf(p) {
    return (p.team ? "[" + p.team + "] " : "") + (p.name || "");
  }

  /* Nametags are the only text the bundle strokes and then fills at the same
   * spot; chat bubbles are filled only. That is what tells them apart. */
  var lastStroke = null;

  /* Rebuilt once a tick rather than walked per nametag per frame. Two players
   * wearing the same name in the same clan stay unmatched rather than guessed
   * at - they would otherwise wear each other's bars. */
  var signs = null;
  var signsTick = -1;

  function findBySign(text) {
    if (signs === null || signsTick !== tick) {
      signs = new Map();
      players.forEach(function (p) {
        var sign = nameOf(p);
        signs.set(sign, signs.has(sign) ? null : p);
      });
      signsTick = tick;
    }
    return signs.get(text) || null;
  }

  function decorate(text, p) {
    if (!p || p.sid === selfSid || !enabled("shameCounter")) return text;
    if (p.skinIndex === null || p.skinIndex === undefined) return text;
    return text + " <" + (p.clown || 0) + "/7>";
  }

  function barPath(ctx, x, y, w, h, r, roundLeft, roundRight) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    if (r < 0) r = 0;
    ctx.beginPath();
    ctx.moveTo(x + (roundLeft ? r : 0), y);
    if (roundRight) {
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
    } else {
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
    }
    if (roundLeft) {
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
    } else {
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function colourFor(value) {
    return value >= 1 ? RELOADED : value > 0.5 ? HALF_RELOADED : NOT_RELOADED;
  }

  /* Between two ticks the fork slides the bar from where it was to where it is
   * now, over one tick's worth of time. */
  function eased(from, to, since) {
    if (from >= to) return to;
    return from + (to - from) * Math.min(1, since / TICK_MS);
  }

  function drawBars(ctx, p, x, nameY) {
    var top = nameY + 2 * (PLAYER_SCALE + NAME_Y) - BAR_LIFT;
    var since = Date.now() - p.tickAt;
    var width = (HEALTH_BAR_WIDTH * 2) / 2.1;

    ctx.fillStyle = BAR_BACKGROUND;
    barPath(ctx, x - HEALTH_BAR_PAD, top, HEALTH_BAR_WIDTH + 2 * HEALTH_BAR_PAD, BAR_HEIGHT, 8, false, true);
    ctx.fillStyle = BAR_BACKGROUND;
    barPath(ctx, x - HEALTH_BAR_WIDTH - HEALTH_BAR_PAD, top, HEALTH_BAR_WIDTH + 2 * HEALTH_BAR_PAD, BAR_HEIGHT, 8, true, false);

    var secondary = eased(p.sr, p.secondaryReload, since);
    var primary = eased(p.pr, p.primaryReload, since);

    ctx.fillStyle = colourFor(p.secondaryReload);
    barPath(ctx, x + 2.5, top + HEALTH_BAR_PAD, Math.max(0, width * secondary),
      BAR_HEIGHT - 2 * HEALTH_BAR_PAD, 7, true, true);

    ctx.fillStyle = colourFor(p.primaryReload);
    barPath(ctx, x - HEALTH_BAR_WIDTH, top + HEALTH_BAR_PAD, Math.max(0, width * primary),
      BAR_HEIGHT - 2 * HEALTH_BAR_PAD, 7, true, true);
  }

  /* The fork drew a red crosshair PNG over the target; this is the same mark,
   * as strokes, at the same 2.2 * scale it used. */
  function drawInstaMarker(ctx, x, nameY) {
    var centre = nameY + PLAYER_SCALE + NAME_Y;
    var radius = PLAYER_SCALE * 0.8;
    var arm = PLAYER_SCALE * 1.1;
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, centre, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - arm, centre);
    ctx.lineTo(x - radius * 0.45, centre);
    ctx.moveTo(x + radius * 0.45, centre);
    ctx.lineTo(x + arm, centre);
    ctx.moveTo(x, centre - arm);
    ctx.lineTo(x, centre - radius * 0.45);
    ctx.moveTo(x, centre + radius * 0.45);
    ctx.lineTo(x, centre + arm);
    ctx.stroke();
  }

  function instaTarget() {
    if (!enabled("instaMarker")) return null;
    var display = document.getElementById("instaDisplay");
    if (!display || display.innerText !== "ON") return null;
    var match = /(?:^|;\s*)target=([^;]*)/.exec(document.cookie);
    if (!match || match[1] === "none" || match[1] === "") return null;
    return match[1];
  }

  var proto = window.CanvasRenderingContext2D && window.CanvasRenderingContext2D.prototype;
  if (!proto) return;
  var nativeFillText = proto.fillText;
  var nativeStrokeText = proto.strokeText;

  function isGameCanvas(ctx) {
    return ctx.canvas && ctx.canvas.id === "gameCanvas";
  }

  proto.strokeText = function (text, x, y) {
    if (typeof text === "string" && isGameCanvas(this)) {
      lastStroke = { text: text, x: x, y: y };
      var p = findBySign(text);
      if (p) {
        return nativeStrokeText.call(this, decorate(text, p), x, y);
      }
    }
    return nativeStrokeText.apply(this, arguments);
  };

  proto.fillText = function (text, x, y) {
    if (typeof text !== "string" || !isGameCanvas(this)) {
      return nativeFillText.apply(this, arguments);
    }
    var isNameTag = lastStroke !== null && lastStroke.text === text &&
      lastStroke.x === x && lastStroke.y === y;
    lastStroke = null;
    if (!isNameTag) return nativeFillText.apply(this, arguments);

    var p = findBySign(text);
    var result = nativeFillText.call(this, decorate(text, p), x, y);
    if (!p) return result;

    this.save();
    try {
      if (enabled("reloadBars") && p.health > 0) drawBars(this, p, x, y);
      var target = instaTarget();
      if (target !== null && String(p.sid) === String(target)) drawInstaMarker(this, x, y);
    } catch (e) {} finally {
      this.restore();
    }
    return result;
  };

  /* Standing on its own, without LemonMod's menu to sit in: a small panel of
   * its own, in the same corner the game keeps its own counters. */
  function addOwnPanel() {
    if (document.getElementById("reloadBars")) return;
    var panel = document.createElement("div");
    panel.id = "lemonVisualsPanel";
    panel.style.cssText = [
      "position:fixed", "left:10px", "bottom:10px", "z-index:2147483646",
      "background:rgba(0,0,0,.45)", "color:#fff", "padding:8px 10px",
      "border-radius:6px", "font-family:Hammersmith One, sans-serif",
      "font-size:14px", "line-height:1.6", "user-select:none"
    ].join(";");

    var title = document.createElement("div");
    title.textContent = "Visuals";
    title.style.cssText = "opacity:.7;font-size:12px;letter-spacing:1px";
    panel.appendChild(title);

    [["reloadBars", "Reload bars"], ["shameCounter", "Shame counter"], ["instaMarker", "Insta marker"]]
      .forEach(function (pair) {
        var label = document.createElement("label");
        label.style.cssText = "display:block;cursor:pointer";
        var input = document.createElement("input");
        input.id = pair[0];
        input.type = "checkbox";
        input.style.cssText = "margin-right:6px;vertical-align:middle";
        label.appendChild(input);
        label.appendChild(document.createTextNode(pair[1]));
        panel.appendChild(label);
        remember(pair[0], input);
      });

    (document.body || document.documentElement).appendChild(panel);
  }

  /* The mod's menu is built well after the page is, so wait for it - but not
   * forever, and put up our own panel if it never arrives. */
  var attempts = 0;
  var settleToggles = setInterval(function () {
    if (addToggles()) {
      clearInterval(settleToggles);
      return;
    }
    if (++attempts > 20) {
      clearInterval(settleToggles);
      try {
        addOwnPanel();
      } catch (e) {}
    }
  }, 1000);

  window.__lemonVisuals = {
    version: "1.0.0",
    settings: settings,
    players: players,
    /* for tools/verify-lemon.js */
    _internals: {
      onTick: onTick, onAttack: onAttack, onHealth: onHealth, onProjectile: onProjectile,
      player: player, decorate: decorate, findBySign: findBySign, eased: eased,
      colourFor: colourFor,
      state: function () { return { tick: tick, selfSid: selfSid }; }
    }
  };
})();
