/*
 * moomoo.io transport core.
 *
 * A direct port of the transport in the shipped bundle (src/game_index.js):
 * a per-connection opcode permutation negotiated in `io-init`, and a truncated
 * HMAC-SHA256 prefix on every client frame.
 *
 *   Vt -> sha256      Ao -> hmacSha256   Eo -> sign      Ro -> hexToBytes
 *   Co -> makeRng     Oi -> permute      Po -> makeTables
 *   jt = 6 (signature width)   Ht = 1 (permuted mode)   Io = 1 (table salt)
 *
 * The clients built on this (Ae86, x18k) are forks of older bundles, so each
 * one supplies its own translation between the packet names it was written
 * against and the names the shipped bundle uses. `create()` binds those maps
 * to the shared primitives; everything else here is protocol, not policy.
 */
(function (root) {
  'use strict';

  var SIG_LEN = 6; // jt
  var MODE_PERMUTED = 1; // Ht
  var TABLE_SALT = 1; // Io

  // Order matters: the permutation is derived from index order.
  var C2S_ALPHABET = ['M', 'D', '9', 'e', 'F', 'z', 'H', 'K', 'L', 'N', 'b', 'P', 'Q', 'c', '6', 'S', '0'];
  var S2C_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'a', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'X', 'Y', 'Z', 'g', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  var K = new Uint32Array([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);

  function rotr(e, t) {
    return e >>> t | e << 32 - t;
  }

  function sha256(e) {
    var t = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
    var i = e.length;
    var s = i * 8;
    var n = i + 9;
    var a = new Uint8Array(Math.ceil(n / 64) * 64);
    a.set(e);
    a[i] = 128;
    var o = new DataView(a.buffer);
    o.setUint32(a.length - 4, s >>> 0, false);
    o.setUint32(a.length - 8, Math.floor(s / 4294967296), false);
    var d = new Uint32Array(64);
    for (var m = 0; m < a.length; m += 64) {
      for (var w = 0; w < 16; w++) d[w] = o.getUint32(m + w * 4, false);
      for (w = 16; w < 64; w++) {
        var T = rotr(d[w - 15], 7) ^ rotr(d[w - 15], 18) ^ d[w - 15] >>> 3;
        var A = rotr(d[w - 2], 17) ^ rotr(d[w - 2], 19) ^ d[w - 2] >>> 10;
        d[w] = d[w - 16] + T + d[w - 7] + A | 0;
      }
      var g = t[0], h = t[1], u = t[2], p = t[3], x = t[4], I = t[5], P = t[6], f = t[7];
      for (w = 0; w < 64; w++) {
        var T2 = rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25);
        var A2 = x & I ^ ~x & P;
        var V = f + T2 + A2 + K[w] + d[w] | 0;
        var W = rotr(g, 2) ^ rotr(g, 13) ^ rotr(g, 22);
        var S = g & h ^ g & u ^ h & u;
        var H = W + S | 0;
        f = P;
        P = I;
        I = x;
        x = p + V | 0;
        p = u;
        u = h;
        h = g;
        g = V + H | 0;
      }
      t[0] = t[0] + g | 0;
      t[1] = t[1] + h | 0;
      t[2] = t[2] + u | 0;
      t[3] = t[3] + p | 0;
      t[4] = t[4] + x | 0;
      t[5] = t[5] + I | 0;
      t[6] = t[6] + P | 0;
      t[7] = t[7] + f | 0;
    }
    var l = new Uint8Array(32);
    var c = new DataView(l.buffer);
    for (m = 0; m < 8; m++) c.setUint32(m * 4, t[m], false);
    return l;
  }

  var BLOCK = 64; // he

  function hmacSha256(key, data) {
    var i = key;
    if (i.length > BLOCK) i = sha256(i);
    var s = new Uint8Array(BLOCK);
    s.set(i);
    var n = new Uint8Array(BLOCK + data.length);
    var a = new Uint8Array(BLOCK + 32);
    for (var o = 0; o < BLOCK; o++) {
      n[o] = s[o] ^ 54;
      a[o] = s[o] ^ 92;
    }
    n.set(data, BLOCK);
    a.set(sha256(n), BLOCK);
    return sha256(a);
  }

  function sign(key, data) {
    return hmacSha256(key, data).subarray(0, SIG_LEN);
  }

  function hexToBytes(e) {
    var t = new Uint8Array(e.length / 2);
    for (var i = 0; i < t.length; i++) t[i] = parseInt(e.substr(i * 2, 2), 16);
    return t;
  }

  function makeRng(e) {
    return function () {
      e |= 0;
      e = e + 1831565813 | 0;
      var t = Math.imul(e ^ e >>> 15, 1 | e);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function permute(e, t) {
    var i = e.length;
    var s = e.map(function (d, l) { return l; });
    var n = makeRng(t >>> 0);
    for (var d = i - 1; d > 0; d--) {
      var l = Math.floor(n() * (d + 1));
      var c = s[d];
      s[d] = s[l];
      s[l] = c;
    }
    var a = {};
    var o = {};
    for (d = 0; d < i; d++) {
      a[e[d]] = s[d];
      o[s[d]] = e[d];
    }
    return { enc: a, dec: o };
  }

  function makeTables(e) {
    var t = (e ^ Math.imul(TABLE_SALT, 2654435761)) >>> 0;
    return {
      c2s: permute(C2S_ALPHABET, t),
      s2c: permute(S2C_ALPHABET, (t ^ 2246822507) >>> 0)
    };
  }


  function toBytes(x) {
    if (x instanceof Uint8Array) return x;
    if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
    return new Uint8Array(x);
  }

  /*
   * Bind a client's name maps to the shared transport.
   *
   *   c2s: this client's outbound name -> shipped name
   *   s2c: shipped inbound name -> this client's name
   *
   * Names absent from a map pass through unchanged, so a client already using
   * current names supplies an empty map.
   */
  function create(maps) {
    var c2s = (maps && maps.c2s) || {};
    var s2c = (maps && maps.s2c) || {};

    /*
     * Build per-connection state from an io-init payload. Returns null when
     * the server is not running the permuted transport, in which case callers
     * fall back to plain frames.
     */
    function createState(args) {
      if (!args || args[3] !== MODE_PERMUTED) return null;
      return {
        mode: MODE_PERMUTED,
        key: hexToBytes(args[2]),
        tables: makeTables(args[1] >>> 0),
        seq: 0
      };
    }

    /*
     * Encode one outbound packet. `encode` is the bundle's msgpack encoder.
     * Returns null when the packet has no counterpart in the current protocol,
     * which the caller should treat as "drop".
     */
    function encodeFrame(state, encode, name, args) {
      var mapped = c2s[name];
      if (mapped === undefined) mapped = name;
      if (!state) return toBytes(encode([mapped, args]));
      var op = state.tables.c2s.enc[mapped];
      if (op === undefined) return null;
      var payload = toBytes(encode([op, args, ++state.seq]));
      var sig = sign(state.key, payload);
      var frame = new Uint8Array(SIG_LEN + payload.length);
      frame.set(sig, 0);
      frame.set(payload, SIG_LEN);
      return frame;
    }

    /*
     * Translate an inbound packet name into the name this client's handlers
     * expect. Returns undefined for opcodes outside the negotiated table.
     */
    function decodeName(state, raw) {
      if (state && typeof raw === 'number') {
        var name = state.tables.s2c.dec[raw];
        if (name === undefined) return undefined;
        raw = name;
      }
      var mapped = s2c[raw];
      return mapped === undefined ? raw : mapped;
    }

    return {
      SIG_LEN: SIG_LEN,
      MODE_PERMUTED: MODE_PERMUTED,
      C2S_MAP: c2s,
      S2C_MAP: s2c,
      sha256: sha256,
      hmacSha256: hmacSha256,
      sign: sign,
      hexToBytes: hexToBytes,
      makeTables: makeTables,
      createState: createState,
      encodeFrame: encodeFrame,
      decodeName: decodeName
    };
  }

  root.MooTransport = {
    SIG_LEN: SIG_LEN,
    MODE_PERMUTED: MODE_PERMUTED,
    C2S_ALPHABET: C2S_ALPHABET,
    S2C_ALPHABET: S2C_ALPHABET,
    sha256: sha256,
    hmacSha256: hmacSha256,
    sign: sign,
    hexToBytes: hexToBytes,
    makeTables: makeTables,
    create: create
  };
})(typeof window !== 'undefined' ? window : globalThis);
