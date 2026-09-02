/*
 * transport.js — the moomoo.io wire protocol, as the shipped bundle implements it.
 *
 * COOKIE CaraMila speaks the pre-2024 transport: plain `msgpack([type, data])`
 * with a string opcode, no signature and no sequence number. The live game does
 * not accept that any more, which is why the client cannot get into a game:
 *
 *   - the server announces the session in `io-init` (game_index.js:428-437):
 *     `[socketId, tableSeed, keyHex, mode]`. When `mode === 1` the connection is
 *     signed and permuted for its whole life.
 *   - every client frame must then be
 *         HMAC-SHA256(key, body)[0..6]  ||  msgpack([opcode, args, seq])
 *     where `opcode` is the *number* the per-connection c2s table maps the
 *     string opcode to, and `seq` increments on every frame (:469-483).
 *   - every server frame arrives with a numeric opcode that has to be mapped
 *     back through the s2c table before it means anything (:439-443).
 *
 * Everything below is a direct port of that code — `Co`, `Oi`, `Po`, `Vt`,
 * `Ao`, `Eo`, `Ro` in the bundle — kept in the same order and with the same
 * arithmetic so it can be checked line against line. Nothing here is invented;
 * the constants are the bundle's own (game_index.js:279-281, 312-317).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CaraTransport = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* game_index.js:279-281 — signature width, signed-mode marker, table salt. */
  var SIG_BYTES = 6;
  var MODE_SIGNED = 1;
  var TABLE_SALT = 1;

  /* game_index.js:282-283 — the two opcode alphabets, in order. The order is
   * the whole point: the permutation is an index shuffle over these arrays. */
  var C2S = ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"];
  var S2C = ["A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P",
             "Q", "R", "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6",
             "7", "8", "9", "0"];

  /* ---- Co: the seeded PRNG the shuffle draws from --------------------- */
  function prng(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 1831565813) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---- Oi: Fisher-Yates over the alphabet's indices ------------------- */
  function shuffle(alphabet, seed) {
    var n = alphabet.length;
    var idx = alphabet.map(function (_, i) { return i; });
    var rand = prng(seed >>> 0);
    for (var i = n - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = idx[i];
      idx[i] = idx[j];
      idx[j] = tmp;
    }
    var enc = {};
    var dec = {};
    for (var k = 0; k < n; k++) {
      enc[alphabet[k]] = idx[k];
      dec[idx[k]] = alphabet[k];
    }
    return { enc: enc, dec: dec };
  }

  /* ---- Po: both tables from the one seed the server sends ------------- */
  function buildTables(seed) {
    var t = (seed ^ Math.imul(TABLE_SALT, 2654435761)) >>> 0;
    return {
      c2s: shuffle(C2S, t),
      s2c: shuffle(S2C, (t ^ 2246822507) >>> 0)
    };
  }

  /* ---- Vt: SHA-256 ---------------------------------------------------- */
  var K = new Uint32Array([
    1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748,
    2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206,
    2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983,
    1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671,
    3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372,
    1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411,
    3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734,
    506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779,
    1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479,
    3329325298]);

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256(bytes) {
    var h = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762,
                             1359893119, 2600822924, 528734635, 1541459225]);
    var len = bytes.length;
    var bits = len * 8;
    var padded = new Uint8Array(Math.ceil((len + 9) / 64) * 64);
    padded.set(bytes);
    padded[len] = 128;
    var view = new DataView(padded.buffer);
    view.setUint32(padded.length - 4, bits >>> 0, false);
    view.setUint32(padded.length - 8, Math.floor(bits / 4294967296), false);

    var w = new Uint32Array(64);
    for (var off = 0; off < padded.length; off += 64) {
      for (var i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
      for (var j = 16; j < 64; j++) {
        var s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        var s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3];
      var e = h[4], f = h[5], g = h[6], hh = h[7];
      for (var r = 0; r < 64; r++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + K[r] + w[r]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e;
        e = (d + t1) | 0;
        d = c; c = b; b = a;
        a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0;
      h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0;
      h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    var out = new Uint8Array(32);
    var ov = new DataView(out.buffer);
    for (var m = 0; m < 8; m++) ov.setUint32(m * 4, h[m], false);
    return out;
  }

  /* ---- Ao / Eo: HMAC-SHA256, truncated to the frame prefix ------------ */
  var BLOCK = 64;
  function hmac(key, msg) {
    var k = key;
    if (k.length > BLOCK) k = sha256(k);
    var pad = new Uint8Array(BLOCK);
    pad.set(k);
    var inner = new Uint8Array(BLOCK + msg.length);
    var outer = new Uint8Array(BLOCK + 32);
    for (var i = 0; i < BLOCK; i++) {
      inner[i] = pad[i] ^ 54;
      outer[i] = pad[i] ^ 92;
    }
    inner.set(msg, BLOCK);
    outer.set(sha256(inner), BLOCK);
    return sha256(outer);
  }
  function sign(key, body) { return hmac(key, body).subarray(0, SIG_BYTES); }

  /* ---- Ro: the key arrives as hex ------------------------------------- */
  function hexToBytes(hex) {
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }

  /* ================================================================== *
   * The session.
   * ================================================================== */
  function Transport(msgpack) {
    this.msgpack = msgpack;
    this.reset();
  }

  Transport.prototype.reset = function () {
    this.mode = 0;
    this.key = null;
    this.tables = null;
    this.seq = 0;
    this.socketId = -1;
  };

  /* The handshake. `args` is io-init's payload:
   * [socketId, tableSeed, keyHex, mode]. Anything other than mode 1 leaves the
   * connection on the legacy plain protocol, which is still what a private or
   * older server may speak — so this degrades rather than assuming. */
  Transport.prototype.noteInit = function (args) {
    this.socketId = args[0];
    if (args[3] === MODE_SIGNED) {
      this.mode = MODE_SIGNED;
      this.key = hexToBytes(args[2]);
      this.tables = buildTables(args[1] >>> 0);
      this.seq = 0;
    } else {
      this.mode = 0;
      this.key = null;
      this.tables = null;
    }
    return this.socketId;
  };

  Transport.prototype.signed = function () {
    return this.mode === MODE_SIGNED && !!this.key && !!this.tables;
  };

  /* Build one outgoing frame. This is the only place a sequence number is
   * issued, so every frame on the wire — the game's own and the mod's — comes
   * from one counter and the server sees a single monotonic stream. */
  Transport.prototype.encode = function (type, data) {
    if (!this.signed()) return this.msgpack.encode([type, data]);
    var op = this.tables.c2s.enc[type];
    if (op === undefined) return null;          // unknown opcode: drop, as the game does
    var body = this.msgpack.encode([op, data, ++this.seq]);
    var sig = sign(this.key, body);
    var frame = new Uint8Array(SIG_BYTES + body.length);
    frame.set(sig, 0);
    frame.set(body, SIG_BYTES);
    return frame;
  };

  /* Read a frame the game produced, so the mod can inspect and re-issue it.
   * Returns [stringType, data] or null. */
  Transport.prototype.decodeOutgoing = function (buffer) {
    var bytes = new Uint8Array(buffer);
    if (this.signed()) {
      var parsed;
      try {
        parsed = this.msgpack.decode(bytes.subarray(SIG_BYTES));
      } catch (e) { return null; }
      if (!parsed) return null;
      var name = typeof parsed[0] === "number" ? this.tables.c2s.dec[parsed[0]] : parsed[0];
      if (name === undefined) return null;
      return [name, parsed[1]];
    }
    try {
      var plain = this.msgpack.decode(bytes);
      return plain ? [plain[0], plain[1]] : null;
    } catch (e) { return null; }
  };

  /* Read a frame from the server. s2c frames carry no signature — only the
   * opcode is permuted (game_index.js:439-443). */
  Transport.prototype.decodeIncoming = function (buffer) {
    var parsed;
    try {
      parsed = this.msgpack.decode(new Uint8Array(buffer));
    } catch (e) { return null; }
    if (!parsed) return null;
    var type = parsed[0];
    if (typeof type === "number") {
      if (!this.tables) return null;            // numeric before io-init: unreadable
      type = this.tables.s2c.dec[type];
      if (type === undefined) return null;
    }
    return [type, parsed[1]];
  };

  Transport.SIG_BYTES = SIG_BYTES;
  Transport.MODE_SIGNED = MODE_SIGNED;
  Transport.TABLE_SALT = TABLE_SALT;
  Transport.C2S = C2S;
  Transport.S2C = S2C;
  Transport.buildTables = buildTables;
  Transport.sha256 = sha256;
  Transport.hmac = hmac;
  Transport.sign = sign;
  Transport.hexToBytes = hexToBytes;
  return Transport;
});
