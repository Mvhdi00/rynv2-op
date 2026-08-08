// ==UserScript==
// @name         Ae86
// @author       NOTxxNOT
// @description  katana hammer module hi have fun shit codes my old coding skills skull
// @version      v10
// @match        *://*.moomoo.io/*
// @grant        none
// @license      MIT
// @namespace https://greasyfork.org/users/1023980
// ==/UserScript==

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

/*
 * Ae86 v10.2 name maps.
 *
 * Ae86 is a fork of the pre-permutation bundle, so every packet name it uses
 * differs from the shipped one. Both maps were recovered by comparing handler
 * bodies between the two bundles one at a time — the correspondence turned out
 * to be positional, but that was checked rather than assumed.
 *
 * Requires src/moomoo-transport.js.
 */
(function (root) {
  'use strict';

  // Ae86 (old bundle) outbound name -> shipped bundle name.
  var C2S_MAP = {
    'sp': 'M',    // spawn
    '2': 'D',     // move direction
    '33': '9',    // aim / turn
    'rmd': 'e',   // reset move dir
    'c': 'F',     // attack state
    '5': 'z',     // select item / weapon
    '6': 'H',     // buy upgrade
    '7': 'K',     // lock dir (0) / auto attack (1)
    '8': 'L',     // create alliance
    '9': 'N',     // leave alliance
    '10': 'b',    // kick from alliance
    '11': 'P',    // respond to alliance request
    '12': 'Q',    // send alliance request
    '13c': 'c',   // store equip/buy (skin 0 / tail 1)
    'ch': '6',    // chat
    '14': 'S',    // ping / map marker
    'pp': '0'     // latency probe
  };

  // Shipped bundle inbound name -> Ae86 (old bundle) name.
  var S2C_MAP = {
    'A': 'id',    // init teams
    'B': 'd',     // disconnect
    'C': '1',     // setup game
    'D': '2',     // add player
    'E': '4',     // remove player
    'a': '33',    // update players
    'G': '5',     // update leaderboard
    'H': '6',     // load game objects
    'I': 'a',     // update AI
    'J': 'aa',    // animate AI
    'K': '7',     // gather animation
    'L': '8',     // wiggle object
    'M': 'sp',    // shoot turret / set dir
    'N': '9',     // update player value
    'O': 'h',     // update health
    'P': '11',    // kill player
    'Q': '12',    // kill object (disable by sid)
    'R': '13',    // kill all objects by owner
    'S': '14',    // update item counts
    'T': '15',    // update XP / age
    'U': '16',    // update upgrades
    'V': '17',    // update items / weapons
    'X': '18',    // add projectile
    'Y': '19',    // remaining projectile range
    'Z': '20',    // server shutdown notice
    'g': 'ac',    // add alliance
    '1': 'ad',    // delete alliance
    '2': 'an',    // alliance notification
    '3': 'st',    // set player team
    '4': 'sa',    // set alliance players
    '5': 'us',    // update store items
    '6': 'ch',    // chat message
    '7': 'mm',    // minimap
    '8': 't',     // show text
    '9': 'p',     // ping map
    '0': 'pp'     // latency reply
  };

  root.Ae86Proto = root.MooTransport.create({ c2s: C2S_MAP, s2c: S2C_MAP });
})(typeof window !== 'undefined' ? window : globalThis);

// @license      MIT
var minecraft = false;
var antiBug = Number.MAX_VALUE;
let bot = 3;
let isConnected = false;
var _0x3f6567 = {
  clan: undefined,
  enemyCount: 0x0,
  nearAim: 0x0
};
let myConfig = _0x3f6567;
var _0x39de7c = {
  waitHeal: false,
  botJoin: false,
  stop: false,
  atck: false,
  nearDst: 0x115c
};
let botConfig = _0x39de7c;
let randomcowname = ["im god", "haha", "ha ez", 'ez', "fan", "urbad v2", "urbad", 'L', "ratio", "VapeClientV2", "Real", "furry", "heheheha", "omg", "mega fan", "cool man", 'ok', "cool", "cps 20", "mama", "Im human", "#1haha", "69gamer", "NOOB", "pill", "windmill", "me fan", ':(', ':)', ':o', "pls", 'no', "what", "ae69", "ae68", "funny man", "quasar mod", "quasar v3", "queue", "manager", "Sope fan 2022", "sisi", "Hello", "World", "Warriors"];
let tmpClan = undefined;
let firstMan;
(function () {
  var _0x51597b;
  try {
    var _0x1042eb = Function("return (function() {}.constructor(\"return this\")( ));");
    _0x51597b = _0x1042eb();
  } catch (_0x709ada) {
    _0x51597b = window;
  }
  void _0x51597b;
})();
let tmpAddress;
function bConnect(_0x43b864, _0x10ab3f, _0x4b824b) {
  let _0x4431c3 = _0x43b864 && new WebSocket(tmpAddress + "?token=" + encodeURIComponent(_0x43b864));
  _0x4431c3.proto = null;
  _0x4431c3.binaryType = "arraybuffer";
  _0x4431c3.botthing = _0x10ab3f;
  _0x4431c3.weapons = [0];
  _0x4431c3.fixItems = [0, 3, 6, 10];
  _0x4431c3.waitHeal = false;
  _0x4431c3.testTickCount = 0;
  _0x4431c3.lessmove = undefined;
  _0x4431c3.mill = {
    x: 0x0,
    y: 0x0
  };
  _0x4431c3.old = {
    x: 0x0,
    y: 0x0
  };
  _0x4431c3.skins = [0];
  _0x4431c3.tails = [0];
  _0x4431c3.millCount = 0;
  _0x4431c3.score = 0;
  _0x4431c3.enemyCount = [];
  _0x4431c3.nearDist = [];
  _0x4431c3.nearAim = 0;
  _0x4431c3.inTrap = false;
  var _0x4f775a = {
    sid: undefined,
    x: undefined,
    y: undefined
  };
  _0x4431c3.trapData = _0x4f775a;
  _0x4431c3.waita = 0;
  _0x4431c3.sTime = 0;
  _0x4431c3.sCount = 0;
  _0x4431c3.health = 100;
  _0x4431c3.owner = false;
  let _0x21e25d = 2400;
  let _0x14a182 = 724;
  let _0x1cf669 = 14400;
  let _0x295576 = [];
  function _0x7be9bd(_0x6ea41) {
    var _0xframe = window.Ae86Proto.encodeFrame(_0x4431c3.proto, function (_0xv) {
      return window.msgpack.encode(_0xv);
    }, _0x6ea41[0], _0x6ea41[1] || []);
    if (_0xframe) {
      _0x4431c3.send(_0xframe);
    }
  }
  function _0x2d6a12(_0x185383, _0x50d51d) {
    if (_0x4431c3.stop) {
      _0x7be9bd(['5', [_0x4431c3.fixItems[_0x185383]]]);
      _0x7be9bd(['c', [1, _0x50d51d]]);
      _0x7be9bd(['5', [_0x4431c3.weapon, 1]]);
    } else {
      _0x7be9bd(['5', [_0x4431c3.fixItems[_0x185383]]]), _0x7be9bd(['c', [1, _0x50d51d]]), _0x7be9bd(['5', [_0x4431c3.weapon, 1]]);
    }
  }
  function _0x59e986(_0x18aa9f) {
    return _0x18aa9f * (Math.PI / 180);
  }
  function _0x2670d9(_0x133766, _0x38c1aa) {
    return Math.atan2(_0x133766.y - _0x38c1aa.y, _0x133766.x - _0x38c1aa.x);
  }
  function _0xb1e192(_0x2d51e4, _0x15f175) {
    return Math.atan2(_0x2d51e4[2] - _0x15f175.y, _0x2d51e4[1] - _0x15f175.x);
  }
  function _0x5e2f06(_0x4b6ada, _0x117757) {
    return Math.hypot(_0x4b6ada.y - _0x117757.y, _0x4b6ada.x - _0x117757.x);
  }
  function _0x517442(_0x335334, _0x217fba) {
    return Math.hypot(_0x335334[2] - _0x217fba.y, _0x335334[1] - _0x217fba.x);
  }
  function _0x14a0ec(_0xce4c84, _0x2c20c3) {
    _0x7be9bd(["13c", [0, _0xce4c84, _0x2c20c3]]);
  }
  function _0x31cb63(_0x37d8b9, _0x3d7840) {
    _0x7be9bd(["13c", [1, _0x37d8b9, _0x3d7840]]);
  }
  function _0x253dec(_0x143ee6, _0x438167) {
    if (!_0x4431c3.skins[_0x143ee6] && _0x438167 == 0) {
      _0x31cb63(_0x143ee6, 0);
    } else {
      !_0x4431c3.tails[_0x143ee6] && _0x438167 == 1 && _0x31cb63(_0x143ee6, 1);
    }
    if (_0x4431c3.skins[_0x143ee6] && _0x438167 == 0) {
      if (_0x4431c3.hat != _0x143ee6) {
        _0x14a0ec(_0x143ee6, 0);
      }
    } else {
      if (_0x4431c3.tails[_0x143ee6] && _0x438167 == 1) {
        if (_0x4431c3.accessory != _0x143ee6) {
          _0x14a0ec(_0x143ee6, 1);
        }
      }
    }
  }
  function _0x12e70d(_0x35f8bb, _0x22a2d6) {
    if (_0x22a2d6 == 0) {
      if (_0x4431c3.skins[_0x35f8bb]) {
        _0x4431c3.hat != _0x35f8bb && _0x14a0ec(_0x35f8bb, 0);
      } else {
        if (_0x35f8bb == 40 && _0x4431c3.score >= 15000) {
          _0x31cb63(_0x35f8bb, 0);
        } else {
          if (_0x35f8bb == 53 && _0x4431c3.score >= 10000) {
            _0x31cb63(_0x35f8bb, 0);
          } else {
            if (_0x35f8bb == 12 && _0x4431c3.score >= 6000) {
              _0x31cb63(_0x35f8bb, 0);
            } else {
              if (_0x35f8bb == 6 && _0x4431c3.score >= 4000) {
                _0x31cb63(_0x35f8bb, 0);
              } else {
                if (_0x35f8bb == 31 && _0x4431c3.score >= 2500) {
                  _0x31cb63(_0x35f8bb, 0);
                } else {
                  _0x35f8bb == 15 && _0x4431c3.score >= 600 && _0x31cb63(_0x35f8bb, 0);
                }
              }
            }
          }
        }
      }
    } else {
      if (_0x22a2d6 == 1) {
        if (_0x4431c3.tails[_0x35f8bb]) {
          if (_0x4431c3.accessory != _0x35f8bb) {
            _0x14a0ec(_0x35f8bb, 1);
          }
        } else {
          _0x35f8bb == 21 && _0x4431c3.score >= 15000 && _0x31cb63(_0x35f8bb, 1);
        }
      }
    }
  }
  function _0x20b231(_0xf16092, _0x48442d) {
    if (_0x48442d == 0) {
      !_0x4431c3.skins[_0xf16092] && _0x31cb63(_0xf16092, 0);
    } else {
      _0x48442d == 1 && !_0x4431c3.tails[_0xf16092] && _0x31cb63(_0xf16092, 0);
    }
  }
  function _0x211a34() {
    if (_0x4431c3.inTrap) {
      _0x12e70d(40, 0);
    } else {
      if (_0x4431c3.y <= _0x21e25d) {
        _0x12e70d(15, 0);
      } else {
        _0x4431c3.y >= 6838 && _0x4431c3.y <= 7562 ? _0x12e70d(31, 0) : _0x12e70d(6, 0);
      }
    }
    _0x12e70d(21, 1);
  }
  function _0x5bca3f() {
    _0x4431c3.fixItems = [0, 3, 6, 10];
    _0x4431c3.weapons = [0];
    _0x4431c3.age = 0;
    _0x4431c3.upgraded = 0;
    _0x4431c3.score = 0;
    let _0x13d985 = Math.floor(Math.random() * 11);
    let _0x4c618e = _0x13d985 == 10 ? "constructor" : Math.floor(Math.random() * 11);
    _0x7be9bd(['sp', [{
      name: randomcowname[Math.floor(Math.random() * randomcowname.length)],
      moofoll: 0x1,
      skin: _0x4c618e
    }]]);
    _0x7be9bd(['7', [1]]);
    _0x4431c3.randomAng = Math.random() * (Math.PI * 2);
    if (window.location.hostname != "sandbox.moomoo.io") {
      _0x2d6a12(3, _0x4431c3.randomAng);
      _0x2d6a12(3, _0x4431c3.randomAng + Math.PI);
    }
    setTimeout(() => {
      _0x7be9bd(['c', [1]]), _0x7be9bd(['5', [_0x4431c3.weapons[0], true]]);
    }, 1000);
  }
  function _0x1d5187(_0x117aca) {
    _0x7be9bd(['6', [_0x117aca]]);
  }
  _0x4431c3.onmessage = function (_0x1326d0) {
    let _0x40cd37 = window.msgpack.decode(new Uint8Array(_0x1326d0.data));
    if (_0x40cd37[0] === "io-init") {
      _0x4431c3.proto = window.Ae86Proto.createState(_0x40cd37[1]);
      if (!_0x4431c3.readyFired) {
        _0x4431c3.readyFired = true;
        _0x5bca3f();
      }
      return;
    }
    let _0xname = window.Ae86Proto.decodeName(_0x4431c3.proto, _0x40cd37[0]);
    if (_0xname === undefined) {
      return;
    }
    _0x40cd37 = [_0xname, _0x40cd37[1]];
    let _0x5be0ef;
    if (_0x40cd37.length > 1) {
      _0x5be0ef = [_0x40cd37[0], ..._0x40cd37[1]];
      _0x5be0ef[1] instanceof Array && (_0x5be0ef = _0x5be0ef);
    } else {
      _0x5be0ef = _0x40cd37;
    }
    let _0x3946c3 = _0x5be0ef[0];
    if (!_0x5be0ef) {
      return;
    }
    _0x5be0ef[0] == '1' && _0x4431c3.id == null && (_0x4431c3.id = _0x5be0ef[1]);
    if (_0x5be0ef[0] == 'st') {
      if (_0x4431c3) {
        _0x4431c3.clan = _0x5be0ef[1];
        _0x4431c3.owner = _0x5be0ef[2];
      }
    }
    if (_0x5be0ef[0] == '33') {
      _0x4431c3.enemyCount = [];
      _0x4431c3.nearDist = [];
      _0x4431c3.nearAim = 0;
      _0x4431c3.testTickCount++;
      for (let _0x3f79d4 = 0; _0x3f79d4 < _0x5be0ef[1].length / 13; _0x3f79d4++) {
        let _0x4ec933 = _0x5be0ef[1].slice(13 * _0x3f79d4, 13 * _0x3f79d4 + 13);
        if (_0x4ec933[0] == _0x4431c3.id) {
          _0x4431c3.id = _0x4ec933[0];
          _0x4431c3.x = _0x4ec933[1];
          _0x4431c3.y = _0x4ec933[2];
          _0x4431c3.dir = _0x4ec933[3];
          _0x4431c3.object = _0x4ec933[4];
          _0x4431c3.weapon = _0x4ec933[5];
          _0x4431c3.clan = _0x4ec933[7];
          _0x4431c3.isLeader = _0x4ec933[8];
          _0x4431c3.hat = _0x4ec933[9];
          _0x4431c3.accessory = _0x4ec933[10];
          _0x4431c3.isSkull = _0x4ec933[11];
        }
        !(_0x4ec933[0] == _0x4431c3.id || _0x4ec933[7] && _0x4ec933[7] == _0x4431c3.clan) && _0x4431c3.enemyCount.push(_0x5be0ef[1].slice(13 * _0x3f79d4, 13 * _0x3f79d4 + 13));
        _0x4431c3.enemyCount.length && (_0x4431c3.nearDist = _0x4431c3.enemyCount.sort(function (_0x4068d5, _0x405465) {
          return _0x517442(_0x4068d5, _0x4431c3) - _0x517442(_0x405465, _0x4431c3);
        })[0]);
        _0x4431c3.nearAim = _0x4431c3.enemyCount.length ? _0xb1e192(_0x4431c3.nearDist, _0x4431c3) : _0x4431c3.dir;
        if (_0x4431c3.testTickCount % 9 === 0) {
          tmpClan = '';
          let _0xc49959 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
          for (let _0x4238ac = 0; _0x4238ac < 7; _0x4238ac++) {
            tmpClan += _0xc49959.charAt(Math.floor(Math.random() * _0xc49959.length));
          }
          !_0x4431c3.clan && _0x7be9bd(['8', [tmpClan]]);
        }
        if (_0x5e2f06(_0x4431c3.trapData, _0x4431c3) <= 60) {
          _0x4431c3.inTrap = true;
          _0x4431c3.trapAim = _0x2670d9(_0x4431c3.trapData, _0x4431c3);
          if (_0x4431c3.testTickCount % 3 === 0) {
            _0x7be9bd(['2', [_0x4431c3.trapAim]]);
          }
        } else {
          _0x4431c3.inTrap = false;
        }
        _0x211a34();
        if (_0x4431c3.testTickCount % 27 === 0) {}
        if (!_0x4431c3.inTrap) {
          if (_0x4431c3.enemyCount.length) {
            if (_0x4431c3.testTickCount % 4 === 0) {
              if (_0x4431c3.lessmove != (_0x4431c3.waita > 3 ? _0x4431c3.nearAim + Math.PI : _0x4431c3.nearAim)) {
                _0x4431c3.lessmove = _0x4431c3.waita > 3 ? _0x4431c3.nearAim + Math.PI : _0x4431c3.nearAim;
                _0x7be9bd(['33', [_0x4431c3.lessmove]]);
                _0x7be9bd(['2', [_0x4431c3.lessmove]]);
              }
            }
          } else {
            if (_0x4431c3.testTickCount % 60 === 0) {
              _0x4431c3.randomAng = Math.random() * (Math.PI * 2);
              _0x4431c3.lessmove != _0x4431c3.randomAng && (_0x4431c3.lessmove = _0x4431c3.randomAng, _0x7be9bd(['33', [_0x4431c3.randomAng]]), _0x7be9bd(['2', [_0x4431c3.randomAng]]));
            }
            if (_0x4431c3.millCount <= 96 && !(_0x4431c3.y >= 6838 && _0x4431c3.y <= 7562) && window.location.hostname == "sandbox.moomoo.io") {
              if (_0x4431c3.oldy != _0x4431c3.y || _0x4431c3.oldx != _0x4431c3.x) {
                if (_0x5e2f06(_0x4431c3.mill, _0x4431c3) > 94) {
                  let _0xb9c0c = _0x2670d9(_0x4431c3.old, _0x4431c3);
                  _0x2d6a12(3, _0xb9c0c + _0x59e986(75.2));
                  _0x2d6a12(3, _0xb9c0c - _0x59e986(75.2));
                  _0x2d6a12(3, _0xb9c0c);
                  _0x4431c3.mill.x = _0x4431c3.x;
                  _0x4431c3.mill.y = _0x4431c3.y;
                }
                _0x4431c3.old.x = _0x4431c3.x;
                _0x4431c3.old.y = _0x4431c3.y;
              }
            }
          }
        }
      }
    }
    if (_0x5be0ef[0] == '5') {
      for (var _0x118860 = 0; _0x118860 < _0x5be0ef[1].length / 3; _0x118860++) {
        let _0x1ec23a = _0x5be0ef[1].slice(3 * _0x118860, 3 * _0x118860 + 3);
        _0x1ec23a[0] == _0x4431c3.id && (_0x4431c3.score = _0x1ec23a[2]);
      }
    }
    if (_0x5be0ef[0] == '11') {
      _0x5bca3f();
    }
    if (_0x5be0ef[0] == '12') {
      if (_0x4431c3.trapData.sid == _0x5be0ef[1]) {
        var _0x219f00 = {
          sid: undefined,
          x: undefined,
          y: undefined
        };
        _0x4431c3.trapData = _0x219f00;
        _0x4431c3.inTrap = false;
      }
      _0x4431c3.waita++;
      setTimeout(() => {
        _0x4431c3.waita--;
      }, 1000);
      if (_0x4431c3.enemyCount.length && _0x4431c3.waita < 4) {
        if (_0x517442(_0x4431c3.nearDist, _0x4431c3) > 260) {
          for (let _0x539228 = 0; _0x539228 < Math.PI * 2; _0x539228 += Math.PI / 1.5) {
            _0x2d6a12(4, _0x4431c3.nearAim + _0x539228);
          }
        } else {
          for (let _0x162921 = 0; _0x162921 < Math.PI * 2; _0x162921 += Math.PI / 1.5) {
            _0x2d6a12(2, _0x4431c3.nearAim + _0x162921);
          }
        }
      }
    }
    if (_0x5be0ef[0] == '14') {
      _0x5be0ef[1] == 3 && (_0x4431c3.millCount = _0x5be0ef[2]);
    }
    _0x5be0ef[0] == '15' && (_0x4431c3.age = _0x5be0ef[3]);
    if (_0x5be0ef[0] == '16') {
      if (_0x5be0ef[1] > 0) {
        if (_0x4431c3.upgraded == 0) {
          _0x1d5187(3);
        } else {
          if (_0x4431c3.upgraded == 1) {
            _0x1d5187(17);
          } else {
            if (_0x4431c3.upgraded == 2) {
              _0x1d5187(31);
            } else {
              if (_0x4431c3.upgraded == 3) {
                _0x1d5187(27);
              } else {
                if (_0x4431c3.upgraded == 4) {
                  _0x1d5187(10);
                } else {
                  if (_0x4431c3.upgraded == 5) {
                    _0x1d5187(38);
                  } else {
                    if (_0x4431c3.upgraded == 6) {
                      _0x1d5187(4);
                    } else {
                      if (_0x4431c3.upgraded == 7) {
                        _0x1d5187(25);
                      }
                    }
                  }
                }
              }
            }
          }
        }
        _0x4431c3.upgraded++;
      }
    }
    if (_0x5be0ef[0] == '6') {
      for (let _0x55a486 = 0; _0x55a486 < _0x5be0ef[1].length / 8; _0x55a486++) {
        let _0x227570 = _0x5be0ef[1].slice(8 * _0x55a486, 8 * _0x55a486 + 8);
        if (_0x227570[6] == 15 && _0x517442(_0x227570, _0x4431c3) <= 90 && _0x227570[7] != _0x4431c3.id && _0x227570[7] != _0x4431c3.clan) {
          _0x4431c3.inTrap = true;
          var _0x3f8da8 = {
            sid: _0x227570[0],
            x: _0x227570[1],
            y: _0x227570[2]
          };
          _0x4431c3.trapData = _0x3f8da8;
        }
      }
    }
    if (_0x5be0ef[0] == '17') {
      if (_0x5be0ef[1]) {
        if (_0x5be0ef[2]) {
          _0x4431c3.weapons = _0x5be0ef[1];
        } else {
          _0x4431c3.fixItems = _0x5be0ef[1];
        }
      }
    }
    if (_0x5be0ef[0] == 'h' && _0x5be0ef[1] == _0x4431c3.id) {
      let _0x349a0b = _0x4431c3.health - _0x5be0ef[2];
      if (_0x4431c3.health - _0x5be0ef[2] < 0) {
        if (_0x4431c3.sTime) {
          let _0x5dafd1 = Date.now() - _0x4431c3.sTime;
          _0x4431c3.sTime = 0;
          _0x5dafd1 <= 120 ? _0x4431c3.sCount++ : _0x4431c3.sCount = Math.max(0, _0x4431c3.sCount - 2);
        }
      } else {
        _0x4431c3.sTime = Date.now();
      }
      if (_0x349a0b > (_0x4431c3.hat == 6 ? 45 : 9) && _0x4431c3.sCount < 4) {
        _0x2d6a12(0);
      } else {
        setTimeout(() => {
          _0x2d6a12(0);
        }, 150);
      }
      _0x4431c3.health = _0x5be0ef[2];
    }
    if (_0x5be0ef[0] == 'us') {
      if (_0x5be0ef[3]) {
        if (!_0x5be0ef[1]) {
          _0x4431c3.tails[_0x5be0ef[2]] = 1;
        } else {
          _0x4431c3.accessory = _0x5be0ef[2];
        }
      } else {
        if (!_0x5be0ef[1]) {
          _0x4431c3.skins[_0x5be0ef[2]] = 1;
        } else {
          _0x4431c3.hat = _0x5be0ef[2];
        }
      }
    }
  };
  _0x4431c3.onopen = function () {
    isConnected = true;
  };
  _0x4431c3.onclose = function () {
    isConnected = false;
  };
}
var antiKick = true;
var secPacket = 0;
var minPacket = 0;
var secMax = 100;
var minMax = 5400;
var secTime = 1000;
var minTime = 60000;
var pktSended = 0;
var sCount = 0;
var sTime = 0;
(function (_0x1622bd) {
  var _0x1c7335 = {};
  function _0x592e2f(_0x3612f2) {
    if (_0x1c7335[_0x3612f2]) {
      return _0x1c7335[_0x3612f2].exports;
    }
    var _0xfecba3 = _0x1c7335[_0x3612f2] = {
      i: _0x3612f2,
      l: false,
      exports: {}
    };
    _0x1622bd[_0x3612f2].call(_0xfecba3.exports, _0xfecba3, _0xfecba3.exports, _0x592e2f);
    _0xfecba3.l = true;
    return _0xfecba3.exports;
  }
  _0x592e2f.m = _0x1622bd;
  _0x592e2f.c = _0x1c7335;
  _0x592e2f.d = function (_0x3da356, _0x327749, _0x523399) {
    if (!_0x592e2f.o(_0x3da356, _0x327749)) {
      var _0x510fb5 = {
        enumerable: true,
        get: _0x523399
      };
      Object.defineProperty(_0x3da356, _0x327749, _0x510fb5);
    }
  };
  _0x592e2f.r = function (_0x47b53f) {
    if (typeof Symbol !== "undefined" && Symbol.toStringTag) {
      Object.defineProperty(_0x47b53f, Symbol.toStringTag, {
        value: "Module"
      });
    }
    var _0x4ba7e8 = {
      value: true
    };
    Object.defineProperty(_0x47b53f, "__esModule", _0x4ba7e8);
  };
  _0x592e2f.t = function (_0x168844, _0x196229) {
    if (_0x196229 & 1) {
      _0x168844 = _0x592e2f(_0x168844);
    }
    if (_0x196229 & 8) {
      return _0x168844;
    }
    if (_0x196229 & 4 && typeof _0x168844 === "object" && _0x168844 && _0x168844.__esModule) {
      return _0x168844;
    }
    var _0x18f3ec = Object.create(null);
    _0x592e2f.r(_0x18f3ec);
    var _0x16f9f6 = {
      enumerable: true,
      value: _0x168844
    };
    Object.defineProperty(_0x18f3ec, "default", _0x16f9f6);
    if (_0x196229 & 2 && typeof _0x168844 != "string") {
      for (var _0x461c85 in _0x168844) {
        _0x592e2f.d(_0x18f3ec, _0x461c85, function (_0x35d697) {
          return _0x168844[_0x35d697];
        }.bind(null, _0x461c85));
      }
    }
    return _0x18f3ec;
  };
  _0x592e2f.n = function (_0x24ed6c) {
    var _0x23c992 = _0x24ed6c && _0x24ed6c.__esModule ? function _0x1b567c() {
      return _0x24ed6c.default;
    } : function _0x3db585() {
      return _0x24ed6c;
    };
    _0x592e2f.d(_0x23c992, 'a', _0x23c992);
    return _0x23c992;
  };
  _0x592e2f.o = function (_0x25b273, _0x1129b5) {
    return Object.prototype.hasOwnProperty.call(_0x25b273, _0x1129b5);
  };
  _0x592e2f.p = '';
  return _0x592e2f(_0x592e2f.s = "./src/js/app.js");
})({
  './node_modules/bad-words/lib/badwords.js': function (_0x54a365, _0x492875, _0x56ddfd) {
    const _0x1f4a0a = _0x56ddfd("./node_modules/bad-words/lib/lang.json").words;
    const _0x3eaf95 = _0x56ddfd("./node_modules/badwords-list/lib/index.js").array;
    class _0x651ac7 {
      constructor(_0x4c8059 = {}) {
        Object.assign(this, {
          list: _0x4c8059.emptyList && [] || Array.prototype.concat.apply(_0x1f4a0a, [_0x3eaf95, _0x4c8059.list || []]),
          exclude: _0x4c8059.exclude || [],
          placeHolder: _0x4c8059.placeHolder || '*',
          regex: _0x4c8059.regex || /[^a-zA-Z0-9|\$|\@]|\^/g,
          replaceRegex: _0x4c8059.replaceRegex || /\w/g
        });
      }
      ["isProfane"](_0x310f4c) {
        return this.list.filter(_0x1931ad => {
          var _0x4f4574 = new RegExp('\x5cb' + _0x1931ad.replace(/(\W)/g, "\\$1") + '\x5cb', 'gi');
          return !this.exclude.includes(_0x1931ad.toLowerCase()) && _0x4f4574.test(_0x310f4c);
        }).length > 0 || false;
      }
      ["replaceWord"](_0x2d1c29) {
        return _0x2d1c29.replace(this.regex, '').replace(this.replaceRegex, this.placeHolder);
      }
      ["clean"](_0x379646) {
        return _0x379646.split(/\b/).map(_0x1c8634 => {
          return this.isProfane(_0x1c8634) ? this.replaceWord(_0x1c8634) : _0x1c8634;
        }).join('');
      }
      ["addWords"]() {
        let _0x2ba7a9 = Array.from(arguments);
        this.list.push(..._0x2ba7a9);
        _0x2ba7a9.map(_0x1fd996 => _0x1fd996.toLowerCase()).forEach(_0x300b2f => {
          if (this.exclude.includes(_0x300b2f)) {
            this.exclude.splice(this.exclude.indexOf(_0x300b2f), 1);
          }
        });
      }
      ["removeWords"]() {
        this.exclude.push(...Array.from(arguments).map(_0x2c58e9 => _0x2c58e9.toLowerCase()));
      }
    }
    _0x54a365.exports = _0x651ac7;
  },
  './node_modules/bad-words/lib/lang.json': function (_0x3f7252) {
    _0x3f7252.exports = {
      words: ["ahole", "anus", "ash0le", "ash0les", "asholes", "ass", "Ass Monkey", "Assface", "assh0le", "assh0lez", "asshole", "assholes", "assholz", "asswipe", "azzhole", "bassterds", "bastard", "bastards", "bastardz", "basterds", "basterdz", "Biatch", "bitch", "bitches", "Blow Job", "boffing", "butthole", "buttwipe", "c0ck", "c0cks", "c0k", "Carpet Muncher", "cawk", "cawks", "Clit", "cnts", "cntz", "cock", "cockhead", "cock-head", "cocks", "CockSucker", "cock-sucker", "crap", "cum", "cunt", "cunts", "cuntz", "dick", "dild0", "dild0s", "dildo", "dildos", "dilld0", "dilld0s", "dominatricks", "dominatrics", "dominatrix", "dyke", "enema", "f u c k", "f u c k e r", "fag", "fag1t", "faget", "fagg1t", "faggit", "faggot", "fagg0t", "fagit", "fags", "fagz", "faig", "faigs", "fart", "flipping the bird", "fuck", "fucker", "fuckin", "fucking", "fucks", "Fudge Packer", "fuk", "Fukah", "Fuken", "fuker", "Fukin", "Fukk", "Fukkah", "Fukken", "Fukker", "Fukkin", "g00k", "God-damned", "h00r", "h0ar", "h0re", "hells", "hoar", "hoor", "hoore", "jackoff", "jap", "japs", "jerk-off", "jisim", "jiss", "jizm", "jizz", "knob", "knobs", "knobz", "kunt", "kunts", "kuntz", "Lezzian", "Lipshits", "Lipshitz", "masochist", "masokist", "massterbait", "masstrbait", "masstrbate", "masterbaiter", "masterbate", "masterbates", "Motha Fucker", "Motha Fuker", "Motha Fukkah", "Motha Fukker", "Mother Fucker", "Mother Fukah", "Mother Fuker", "Mother Fukkah", "Mother Fukker", "mother-fucker", "Mutha Fucker", "Mutha Fukah", "Mutha Fuker", "Mutha Fukkah", "Mutha Fukker", "n1gr", "nastt", "nigger;", "nigur;", "niiger;", "niigr;", "orafis", "orgasim;", "orgasm", "orgasum", "oriface", "orifice", "orifiss", "packi", "packie", "packy", "paki", "pakie", "paky", "pecker", "peeenus", "peeenusss", "peenus", "peinus", "pen1s", "penas", "penis", "penis-breath", "penus", "penuus", "Phuc", "Phuck", "Phuk", "Phuker", "Phukker", "polac", "polack", "polak", "Poonani", "pr1c", "pr1ck", "pr1k", "pusse", "pussee", "pussy", "puuke", "puuker", "queer", "queers", "queerz", "qweers", "qweerz", "qweir", "recktum", "rectum", "retard", "sadist", "scank", "schlong", "screwing", "semen", "sex", "sexy", "Sh!t", "sh1t", "sh1ter", "sh1ts", "sh1tter", "sh1tz", "shit", "shits", "shitter", "Shitty", "Shity", "shitz", "Shyt", "Shyte", "Shytty", "Shyty", "skanck", "skank", "skankee", "skankey", "skanks", "Skanky", "slag", "slut", "sluts", "Slutty", "slutz", "son-of-a-bitch", "tit", "turd", "va1jina", "vag1na", "vagiina", "vagina", "vaj1na", "vajina", "vullva", "vulva", "w0p", "wh00r", "wh0re", "whore", "xrated", "xxx", "b!+ch", "bitch", "blowjob", "clit", "arschloch", "fuck", "shit", "ass", "asshole", "b!tch", "b17ch", "b1tch", "bastard", "bi+ch", "boiolas", "buceta", "c0ck", "cawk", "chink", "cipa", "clits", "cock", "cum", "cunt", "dildo", "dirsa", "ejakulate", "fatass", "fcuk", "fuk", "fux0r", "hoer", "hore", "jism", "kawk", "l3itch", "l3i+ch", "lesbian", "masturbate", "masterbat*", "masterbat3", "motherfucker", "s.o.b.", "mofo", "nazi", "nigga", "nigger", "nutsack", "phuck", "pimpis", "pusse", "pussy", "scrotum", "sh!t", "shemale", "shi+", "sh!+", "slut", "smut", "teets", "tits", "boobs", "b00bs", "teez", "testical", "testicle", "titt", "w00se", "jackoff", "wank", "whoar", "whore", "*damn", "*dyke", "*fuck*", "*shit*", "@$$", "amcik", "andskota", "arse*", "assrammer", "ayir", "bi7ch", "bitch*", "bollock*", "breasts", "butt-pirate", "cabron", "cazzo", "chraa", "chuj", "Cock*", "cunt*", "d4mn", "daygo", "dego", "dick*", "dike*", "dupa", "dziwka", "ejackulate", "Ekrem*", "Ekto", "enculer", "faen", "fag*", "fanculo", "fanny", "feces", "feg", "Felcher", "ficken", "fitt*", "Flikker", "foreskin", "Fotze", "Fu(*", "fuk*", "futkretzn", "gook", "guiena", "h0r", "h4x0r", "hell", "helvete", "hoer*", "honkey", "Huevon", "hui", "injun", "jizz", "kanker*", "kike", "klootzak", "kraut", "knulle", "kuk", "kuksuger", "Kurac", "kurwa", "kusi*", "kyrpa*", "lesbo", "mamhoon", "masturbat*", "merd*", "mibun", "monkleigh", "mouliewop", "muie", "mulkku", "muschi", "nazis", "nepesaurio", "nigger*", "orospu", "paska*", "perse", "picka", "pierdol*", "pillu*", "pimmel", "piss*", "pizda", "poontsee", "poop", "porn", "p0rn", "pr0n", "preteen", "pula", "pule", "puta", "puto", "qahbeh", "queef*", "rautenberg", "schaffer", "scheiss*", "schlampe", "schmuck", "screw", "sh!t*", "sharmuta", "sharmute", "shipal", "shiz", "skribz", "skurwysyn", "sphencter", "spic", "spierdalaj", "splooge", "suka", "b00b*", "testicle*", "titt*", "twat", "vittu", "wank*", "wetback*", "wichser", "wop*", "yed", "zabourah"]
    };
  },
  './node_modules/badwords-list/lib/array.js': function (_0xdf13b1, _0x17491f) {
    _0xdf13b1.exports = ["4r5e", "5h1t", "5hit", "a55", "anal", "anus", "ar5e", "arrse", "arse", "ass", "ass-fucker", "asses", "assfucker", "assfukka", "asshole", "assholes", "asswhole", "a_s_s", "b!tch", "b00bs", "b17ch", "b1tch", "ballbag", "balls", "ballsack", "bastard", "beastial", "beastiality", "bellend", "bestial", "bestiality", "bi+ch", "biatch", "bitch", "bitcher", "bitchers", "bitches", "bitchin", "bitching", "bloody", "blow job", "blowjob", "blowjobs", "boiolas", "bollock", "bollok", "boner", "boob", "boobs", "booobs", "boooobs", "booooobs", "booooooobs", "breasts", "buceta", "bugger", "bum", "bunny fucker", "butt", "butthole", "buttmuch", "buttplug", "c0ck", "c0cksucker", "carpet muncher", "cawk", "chink", "cipa", "cl1t", "clit", "clitoris", "clits", "cnut", "cock", "cock-sucker", "cockface", "cockhead", "cockmunch", "cockmuncher", "cocks", "cocksuck", "cocksucked", "cocksucker", "cocksucking", "cocksucks", "cocksuka", "cocksukka", "cok", "cokmuncher", "coksucka", "coon", "cox", "crap", "cum", "cummer", "cumming", "cums", "cumshot", "cunilingus", "cunillingus", "cunnilingus", "cunt", "cuntlick", "cuntlicker", "cuntlicking", "cunts", "cyalis", "cyberfuc", "cyberfuck", "cyberfucked", "cyberfucker", "cyberfuckers", "cyberfucking", "d1ck", "damn", "dick", "dickhead", "dildo", "dildos", "dink", "dinks", "dirsa", "dlck", "dog-fucker", "doggin", "dogging", "donkeyribber", "doosh", "duche", "dyke", "ejaculate", "ejaculated", "ejaculates", "ejaculating", "ejaculatings", "ejaculation", "ejakulate", "f u c k", "f u c k e r", "f4nny", "fag", "fagging", "faggitt", "faggot", "faggs", "fagot", "fagots", "fags", "fanny", "fannyflaps", "fannyfucker", "fanyy", "fatass", "fcuk", "fcuker", "fcuking", "feck", "fecker", "felching", "fellate", "fellatio", "fingerfuck", "fingerfucked", "fingerfucker", "fingerfuckers", "fingerfucking", "fingerfucks", "fistfuck", "fistfucked", "fistfucker", "fistfuckers", "fistfucking", "fistfuckings", "fistfucks", "flange", "fook", "fooker", "fuck", "fucka", "fucked", "fucker", "fuckers", "fuckhead", "fuckheads", "fuckin", "fucking", "fuckings", "fuckingshitmotherfucker", "fuckme", "fucks", "fuckwhit", "fuckwit", "fudge packer", "fudgepacker", "fuk", "fuker", "fukker", "fukkin", "fuks", "fukwhit", "fukwit", "fux", "fux0r", "f_u_c_k", "gangbang", "gangbanged", "gangbangs", "gaylord", "gaysex", "goatse", "God", "god-dam", "god-damned", "goddamn", "goddamned", "hardcoresex", "hell", "heshe", "hoar", "hoare", "hoer", "homo", "hore", "horniest", "horny", "hotsex", "jack-off", "jackoff", "jap", "jerk-off", "jism", "jiz", "jizm", "jizz", "kawk", "knob", "knobead", "knobed", "knobend", "knobhead", "knobjocky", "knobjokey", "kock", "kondum", "kondums", "kum", "kummer", "kumming", "kums", "kunilingus", "l3i+ch", "l3itch", "labia", "lust", "lusting", "m0f0", "m0fo", "m45terbate", "ma5terb8", "ma5terbate", "masochist", "master-bate", "masterb8", "masterbat*", "masterbat3", "masterbate", "masterbation", "masterbations", "masturbate", "mo-fo", "mof0", "mofo", "mothafuck", "mothafucka", "mothafuckas", "mothafuckaz", "mothafucked", "mothafucker", "mothafuckers", "mothafuckin", "mothafucking", "mothafuckings", "mothafucks", "mother fucker", "motherfuck", "motherfucked", "motherfucker", "motherfuckers", "motherfuckin", "motherfucking", "motherfuckings", "motherfuckka", "motherfucks", "muff", "mutha", "muthafecker", "muthafuckker", "muther", "mutherfucker", "n1gga", "n1gger", "nazi", "nigg3r", "nigg4h", "nigga", "niggah", "niggas", "niggaz", "nigger", "niggers", "nob", "nob jokey", "nobhead", "nobjocky", "nobjokey", "numbnuts", "nutsack", "orgasim", "orgasims", "orgasm", "orgasms", "p0rn", "pawn", "pecker", "penis", "penisfucker", "phonesex", "phuck", "phuk", "phuked", "phuking", "phukked", "phukking", "phuks", "phuq", "pigfucker", "pimpis", "piss", "pissed", "pisser", "pissers", "pisses", "pissflaps", "pissin", "pissing", "pissoff", "poop", "porn", "porno", "pornography", "pornos", "prick", "pricks", "pron", "pube", "pusse", "pussi", "pussies", "pussy", "pussys", "rectum", "retard", "rimjaw", "rimming", "s hit", "s.o.b.", "sadist", "schlong", "screwing", "scroat", "scrote", "scrotum", "semen", "sex", "sh!+", "sh!t", "sh1t", "shag", "shagger", "shaggin", "shagging", "shemale", "shi+", "shit", "shitdick", "shite", "shited", "shitey", "shitfuck", "shitfull", "shithead", "shiting", "shitings", "shits", "shitted", "shitter", "shitters", "shitting", "shittings", "shitty", "skank", "slut", "sluts", "smegma", "smut", "snatch", "son-of-a-bitch", "spac", "spunk", "s_h_i_t", "t1tt1e5", "t1tties", "teets", "teez", "testical", "testicle", "tit", "titfuck", "tits", "titt", "tittie5", "tittiefucker", "titties", "tittyfuck", "tittywank", "titwank", "tosser", "turd", "tw4t", "twat", "twathead", "twatty", "twunt", "twunter", "v14gra", "v1gra", "vagina", "viagra", "vulva", "w00se", "wang", "wank", "wanker", "wanky", "whoar", "whore", "willies", "willy", "xrated", "xxx"];
  },
  './node_modules/badwords-list/lib/index.js': function (_0x2cb90b, _0x373b99, _0x1d6c7e) {
    _0x2cb90b.exports = {
      object: _0x1d6c7e("./node_modules/badwords-list/lib/object.js"),
      array: _0x1d6c7e("./node_modules/badwords-list/lib/array.js"),
      regex: _0x1d6c7e("./node_modules/badwords-list/lib/regexp.js")
    };
  },
  './node_modules/badwords-list/lib/object.js': function (_0x42272f, _0x38f61a) {
    _0x42272f.exports = {
      "4r5e": 0x1,
      "5h1t": 0x1,
      "5hit": 0x1,
      a55: 0x1,
      anal: 0x1,
      anus: 0x1,
      ar5e: 0x1,
      arrse: 0x1,
      arse: 0x1,
      ass: 0x1,
      "ass-fucker": 0x1,
      asses: 0x1,
      assfucker: 0x1,
      assfukka: 0x1,
      asshole: 0x1,
      assholes: 0x1,
      asswhole: 0x1,
      a_s_s: 0x1,
      "b!tch": 0x1,
      b00bs: 0x1,
      b17ch: 0x1,
      b1tch: 0x1,
      ballbag: 0x1,
      balls: 0x1,
      ballsack: 0x1,
      bastard: 0x1,
      beastial: 0x1,
      beastiality: 0x1,
      bellend: 0x1,
      bestial: 0x1,
      bestiality: 0x1,
      "bi+ch": 0x1,
      biatch: 0x1,
      bitch: 0x1,
      bitcher: 0x1,
      bitchers: 0x1,
      bitches: 0x1,
      bitchin: 0x1,
      bitching: 0x1,
      bloody: 0x1,
      "blow job": 0x1,
      blowjob: 0x1,
      blowjobs: 0x1,
      boiolas: 0x1,
      bollock: 0x1,
      bollok: 0x1,
      boner: 0x1,
      boob: 0x1,
      boobs: 0x1,
      booobs: 0x1,
      boooobs: 0x1,
      booooobs: 0x1,
      booooooobs: 0x1,
      breasts: 0x1,
      buceta: 0x1,
      bugger: 0x1,
      bum: 0x1,
      "bunny fucker": 0x1,
      butt: 0x1,
      butthole: 0x1,
      buttmuch: 0x1,
      buttplug: 0x1,
      c0ck: 0x1,
      c0cksucker: 0x1,
      "carpet muncher": 0x1,
      cawk: 0x1,
      chink: 0x1,
      cipa: 0x1,
      cl1t: 0x1,
      clit: 0x1,
      clitoris: 0x1,
      clits: 0x1,
      cnut: 0x1,
      cock: 0x1,
      "cock-sucker": 0x1,
      cockface: 0x1,
      cockhead: 0x1,
      cockmunch: 0x1,
      cockmuncher: 0x1,
      cocks: 0x1,
      cocksuck: 0x1,
      cocksucked: 0x1,
      cocksucker: 0x1,
      cocksucking: 0x1,
      cocksucks: 0x1,
      cocksuka: 0x1,
      cocksukka: 0x1,
      cok: 0x1,
      cokmuncher: 0x1,
      coksucka: 0x1,
      coon: 0x1,
      cox: 0x1,
      crap: 0x1,
      cum: 0x1,
      cummer: 0x1,
      cumming: 0x1,
      cums: 0x1,
      cumshot: 0x1,
      cunilingus: 0x1,
      cunillingus: 0x1,
      cunnilingus: 0x1,
      cunt: 0x1,
      cuntlick: 0x1,
      cuntlicker: 0x1,
      cuntlicking: 0x1,
      cunts: 0x1,
      cyalis: 0x1,
      cyberfuc: 0x1,
      cyberfuck: 0x1,
      cyberfucked: 0x1,
      cyberfucker: 0x1,
      cyberfuckers: 0x1,
      cyberfucking: 0x1,
      d1ck: 0x1,
      damn: 0x1,
      dick: 0x1,
      dickhead: 0x1,
      dildo: 0x1,
      dildos: 0x1,
      dink: 0x1,
      dinks: 0x1,
      dirsa: 0x1,
      dlck: 0x1,
      "dog-fucker": 0x1,
      doggin: 0x1,
      dogging: 0x1,
      donkeyribber: 0x1,
      doosh: 0x1,
      duche: 0x1,
      dyke: 0x1,
      ejaculate: 0x1,
      ejaculated: 0x1,
      ejaculates: 0x1,
      ejaculating: 0x1,
      ejaculatings: 0x1,
      ejaculation: 0x1,
      ejakulate: 0x1,
      "f u c k": 0x1,
      "f u c k e r": 0x1,
      f4nny: 0x1,
      fag: 0x1,
      fagging: 0x1,
      faggitt: 0x1,
      faggot: 0x1,
      faggs: 0x1,
      fagot: 0x1,
      fagots: 0x1,
      fags: 0x1,
      fanny: 0x1,
      fannyflaps: 0x1,
      fannyfucker: 0x1,
      fanyy: 0x1,
      fatass: 0x1,
      fcuk: 0x1,
      fcuker: 0x1,
      fcuking: 0x1,
      feck: 0x1,
      fecker: 0x1,
      felching: 0x1,
      fellate: 0x1,
      fellatio: 0x1,
      fingerfuck: 0x1,
      fingerfucked: 0x1,
      fingerfucker: 0x1,
      fingerfuckers: 0x1,
      fingerfucking: 0x1,
      fingerfucks: 0x1,
      fistfuck: 0x1,
      fistfucked: 0x1,
      fistfucker: 0x1,
      fistfuckers: 0x1,
      fistfucking: 0x1,
      fistfuckings: 0x1,
      fistfucks: 0x1,
      flange: 0x1,
      fook: 0x1,
      fooker: 0x1,
      fuck: 0x1,
      fucka: 0x1,
      fucked: 0x1,
      fucker: 0x1,
      fuckers: 0x1,
      fuckhead: 0x1,
      fuckheads: 0x1,
      fuckin: 0x1,
      fucking: 0x1,
      fuckings: 0x1,
      fuckingshitmotherfucker: 0x1,
      fuckme: 0x1,
      fucks: 0x1,
      fuckwhit: 0x1,
      fuckwit: 0x1,
      "fudge packer": 0x1,
      fudgepacker: 0x1,
      fuk: 0x1,
      fuker: 0x1,
      fukker: 0x1,
      fukkin: 0x1,
      fuks: 0x1,
      fukwhit: 0x1,
      fukwit: 0x1,
      fux: 0x1,
      fux0r: 0x1,
      f_u_c_k: 0x1,
      gangbang: 0x1,
      gangbanged: 0x1,
      gangbangs: 0x1,
      gaylord: 0x1,
      gaysex: 0x1,
      goatse: 0x1,
      God: 0x1,
      "god-dam": 0x1,
      "god-damned": 0x1,
      goddamn: 0x1,
      goddamned: 0x1,
      hardcoresex: 0x1,
      hell: 0x1,
      heshe: 0x1,
      hoar: 0x1,
      hoare: 0x1,
      hoer: 0x1,
      homo: 0x1,
      hore: 0x1,
      horniest: 0x1,
      horny: 0x1,
      hotsex: 0x1,
      "jack-off": 0x1,
      jackoff: 0x1,
      jap: 0x1,
      "jerk-off": 0x1,
      jism: 0x1,
      jiz: 0x1,
      jizm: 0x1,
      jizz: 0x1,
      kawk: 0x1,
      knob: 0x1,
      knobead: 0x1,
      knobed: 0x1,
      knobend: 0x1,
      knobhead: 0x1,
      knobjocky: 0x1,
      knobjokey: 0x1,
      kock: 0x1,
      kondum: 0x1,
      kondums: 0x1,
      kum: 0x1,
      kummer: 0x1,
      kumming: 0x1,
      kums: 0x1,
      kunilingus: 0x1,
      "l3i+ch": 0x1,
      l3itch: 0x1,
      labia: 0x1,
      lust: 0x1,
      lusting: 0x1,
      m0f0: 0x1,
      m0fo: 0x1,
      m45terbate: 0x1,
      ma5terb8: 0x1,
      ma5terbate: 0x1,
      masochist: 0x1,
      "master-bate": 0x1,
      masterb8: 0x1,
      "masterbat*": 0x1,
      masterbat3: 0x1,
      masterbate: 0x1,
      masterbation: 0x1,
      masterbations: 0x1,
      masturbate: 0x1,
      "mo-fo": 0x1,
      mof0: 0x1,
      mofo: 0x1,
      mothafuck: 0x1,
      mothafucka: 0x1,
      mothafuckas: 0x1,
      mothafuckaz: 0x1,
      mothafucked: 0x1,
      mothafucker: 0x1,
      mothafuckers: 0x1,
      mothafuckin: 0x1,
      mothafucking: 0x1,
      mothafuckings: 0x1,
      mothafucks: 0x1,
      "mother fucker": 0x1,
      motherfuck: 0x1,
      motherfucked: 0x1,
      motherfucker: 0x1,
      motherfuckers: 0x1,
      motherfuckin: 0x1,
      motherfucking: 0x1,
      motherfuckings: 0x1,
      motherfuckka: 0x1,
      motherfucks: 0x1,
      muff: 0x1,
      mutha: 0x1,
      muthafecker: 0x1,
      muthafuckker: 0x1,
      muther: 0x1,
      mutherfucker: 0x1,
      n1gga: 0x1,
      n1gger: 0x1,
      nazi: 0x1,
      nigg3r: 0x1,
      nigg4h: 0x1,
      nigga: 0x1,
      niggah: 0x1,
      niggas: 0x1,
      niggaz: 0x1,
      nigger: 0x1,
      niggers: 0x1,
      nob: 0x1,
      "nob jokey": 0x1,
      nobhead: 0x1,
      nobjocky: 0x1,
      nobjokey: 0x1,
      numbnuts: 0x1,
      nutsack: 0x1,
      orgasim: 0x1,
      orgasims: 0x1,
      orgasm: 0x1,
      orgasms: 0x1,
      p0rn: 0x1,
      pawn: 0x1,
      pecker: 0x1,
      penis: 0x1,
      penisfucker: 0x1,
      phonesex: 0x1,
      phuck: 0x1,
      phuk: 0x1,
      phuked: 0x1,
      phuking: 0x1,
      phukked: 0x1,
      phukking: 0x1,
      phuks: 0x1,
      phuq: 0x1,
      pigfucker: 0x1,
      pimpis: 0x1,
      piss: 0x1,
      pissed: 0x1,
      pisser: 0x1,
      pissers: 0x1,
      pisses: 0x1,
      pissflaps: 0x1,
      pissin: 0x1,
      pissing: 0x1,
      pissoff: 0x1,
      poop: 0x1,
      porn: 0x1,
      porno: 0x1,
      pornography: 0x1,
      pornos: 0x1,
      prick: 0x1,
      pricks: 0x1,
      pron: 0x1,
      pube: 0x1,
      pusse: 0x1,
      pussi: 0x1,
      pussies: 0x1,
      pussy: 0x1,
      pussys: 0x1,
      rectum: 0x1,
      retard: 0x1,
      rimjaw: 0x1,
      rimming: 0x1,
      "s hit": 0x1,
      "s.o.b.": 0x1,
      sadist: 0x1,
      schlong: 0x1,
      screwing: 0x1,
      scroat: 0x1,
      scrote: 0x1,
      scrotum: 0x1,
      semen: 0x1,
      sex: 0x1,
      "sh!+": 0x1,
      "sh!t": 0x1,
      sh1t: 0x1,
      shag: 0x1,
      shagger: 0x1,
      shaggin: 0x1,
      shagging: 0x1,
      shemale: 0x1,
      "shi+": 0x1,
      shit: 0x1,
      shitdick: 0x1,
      shite: 0x1,
      shited: 0x1,
      shitey: 0x1,
      shitfuck: 0x1,
      shitfull: 0x1,
      shithead: 0x1,
      shiting: 0x1,
      shitings: 0x1,
      shits: 0x1,
      shitted: 0x1,
      shitter: 0x1,
      shitters: 0x1,
      shitting: 0x1,
      shittings: 0x1,
      shitty: 0x1,
      skank: 0x1,
      slut: 0x1,
      sluts: 0x1,
      smegma: 0x1,
      smut: 0x1,
      snatch: 0x1,
      "son-of-a-bitch": 0x1,
      spac: 0x1,
      spunk: 0x1,
      s_h_i_t: 0x1,
      t1tt1e5: 0x1,
      t1tties: 0x1,
      teets: 0x1,
      teez: 0x1,
      testical: 0x1,
      testicle: 0x1,
      tit: 0x1,
      titfuck: 0x1,
      tits: 0x1,
      titt: 0x1,
      tittie5: 0x1,
      tittiefucker: 0x1,
      titties: 0x1,
      tittyfuck: 0x1,
      tittywank: 0x1,
      titwank: 0x1,
      tosser: 0x1,
      turd: 0x1,
      tw4t: 0x1,
      twat: 0x1,
      twathead: 0x1,
      twatty: 0x1,
      twunt: 0x1,
      twunter: 0x1,
      v14gra: 0x1,
      v1gra: 0x1,
      vagina: 0x1,
      viagra: 0x1,
      vulva: 0x1,
      w00se: 0x1,
      wang: 0x1,
      wank: 0x1,
      wanker: 0x1,
      wanky: 0x1,
      whoar: 0x1,
      whore: 0x1,
      willies: 0x1,
      willy: 0x1,
      xrated: 0x1,
      xxx: 0x1
    };
  },
  './node_modules/badwords-list/lib/regexp.js': function (_0x46be7c, _0x308c09) {
    _0x46be7c.exports = /\b(4r5e|5h1t|5hit|a55|anal|anus|ar5e|arrse|arse|ass|ass-fucker|asses|assfucker|assfukka|asshole|assholes|asswhole|a_s_s|b!tch|b00bs|b17ch|b1tch|ballbag|balls|ballsack|bastard|beastial|beastiality|bellend|bestial|bestiality|bi\+ch|biatch|bitch|bitcher|bitchers|bitches|bitchin|bitching|bloody|blow job|blowjob|blowjobs|boiolas|bollock|bollok|boner|boob|boobs|booobs|boooobs|booooobs|booooooobs|breasts|buceta|bugger|bum|bunny fucker|butt|butthole|buttmuch|buttplug|c0ck|c0cksucker|carpet muncher|cawk|chink|cipa|cl1t|clit|clitoris|clits|cnut|cock|cock-sucker|cockface|cockhead|cockmunch|cockmuncher|cocks|cocksuck|cocksucked|cocksucker|cocksucking|cocksucks|cocksuka|cocksukka|cok|cokmuncher|coksucka|coon|cox|crap|cum|cummer|cumming|cums|cumshot|cunilingus|cunillingus|cunnilingus|cunt|cuntlick|cuntlicker|cuntlicking|cunts|cyalis|cyberfuc|cyberfuck|cyberfucked|cyberfucker|cyberfuckers|cyberfucking|d1ck|damn|dick|dickhead|dildo|dildos|dink|dinks|dirsa|dlck|dog-fucker|doggin|dogging|donkeyribber|doosh|duche|dyke|ejaculate|ejaculated|ejaculates|ejaculating|ejaculatings|ejaculation|ejakulate|f u c k|f u c k e r|f4nny|fag|fagging|faggitt|faggot|faggs|fagot|fagots|fags|fanny|fannyflaps|fannyfucker|fanyy|fatass|fcuk|fcuker|fcuking|feck|fecker|felching|fellate|fellatio|fingerfuck|fingerfucked|fingerfucker|fingerfuckers|fingerfucking|fingerfucks|fistfuck|fistfucked|fistfucker|fistfuckers|fistfucking|fistfuckings|fistfucks|flange|fook|fooker|fuck|fucka|fucked|fucker|fuckers|fuckhead|fuckheads|fuckin|fucking|fuckings|fuckingshitmotherfucker|fuckme|fucks|fuckwhit|fuckwit|fudge packer|fudgepacker|fuk|fuker|fukker|fukkin|fuks|fukwhit|fukwit|fux|fux0r|f_u_c_k|gangbang|gangbanged|gangbangs|gaylord|gaysex|goatse|God|god-dam|god-damned|goddamn|goddamned|hardcoresex|hell|heshe|hoar|hoare|hoer|homo|hore|horniest|horny|hotsex|jack-off|jackoff|jap|jerk-off|jism|jiz|jizm|jizz|kawk|knob|knobead|knobed|knobend|knobhead|knobjocky|knobjokey|kock|kondum|kondums|kum|kummer|kumming|kums|kunilingus|l3i\+ch|l3itch|labia|lust|lusting|m0f0|m0fo|m45terbate|ma5terb8|ma5terbate|masochist|master-bate|masterb8|masterbat*|masterbat3|masterbate|masterbation|masterbations|masturbate|mo-fo|mof0|mofo|mothafuck|mothafucka|mothafuckas|mothafuckaz|mothafucked|mothafucker|mothafuckers|mothafuckin|mothafucking|mothafuckings|mothafucks|mother fucker|motherfuck|motherfucked|motherfucker|motherfuckers|motherfuckin|motherfucking|motherfuckings|motherfuckka|motherfucks|muff|mutha|muthafecker|muthafuckker|muther|mutherfucker|n1gga|n1gger|nazi|nigg3r|nigg4h|nigga|niggah|niggas|niggaz|nigger|niggers|nob|nob jokey|nobhead|nobjocky|nobjokey|numbnuts|nutsack|orgasim|orgasims|orgasm|orgasms|p0rn|pawn|pecker|penis|penisfucker|phonesex|phuck|phuk|phuked|phuking|phukked|phukking|phuks|phuq|pigfucker|pimpis|piss|pissed|pisser|pissers|pisses|pissflaps|pissin|pissing|pissoff|poop|porn|porno|pornography|pornos|prick|pricks|pron|pube|pusse|pussi|pussies|pussy|pussys|rectum|retard|rimjaw|rimming|s hit|s.o.b.|sadist|schlong|screwing|scroat|scrote|scrotum|semen|sex|sh!\+|sh!t|sh1t|shag|shagger|shaggin|shagging|shemale|shi\+|shit|shitdick|shite|shited|shitey|shitfuck|shitfull|shithead|shiting|shitings|shits|shitted|shitter|shitters|shitting|shittings|shitty|skank|slut|sluts|smegma|smut|snatch|son-of-a-bitch|spac|spunk|s_h_i_t|t1tt1e5|t1tties|teets|teez|testical|testicle|tit|titfuck|tits|titt|tittie5|tittiefucker|titties|tittyfuck|tittywank|titwank|tosser|turd|tw4t|twat|twathead|twatty|twunt|twunter|v14gra|v1gra|vagina|viagra|vulva|w00se|wang|wank|wanker|wanky|whoar|whore|willies|willy|xrated|xxx)\b/gi;
  },
  './node_modules/base64-js/index.js': function (_0x281660, _0x27f7d3, _0x1c6d85) {
    'use strict';

    _0x27f7d3.byteLength = _0x155517;
    _0x27f7d3.toByteArray = _0x243bc7;
    _0x27f7d3.fromByteArray = _0x116fe3;
    var _0x4f4357 = [];
    var _0x101d01 = [];
    var _0x3f09f4 = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
    var _0x54c519 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (var _0x2f7a34 = 0, _0x1e5529 = _0x54c519.length; _0x2f7a34 < _0x1e5529; ++_0x2f7a34) {
      _0x4f4357[_0x2f7a34] = _0x54c519[_0x2f7a34];
      _0x101d01[_0x54c519.charCodeAt(_0x2f7a34)] = _0x2f7a34;
    }
    _0x101d01['-'.charCodeAt(0)] = 62;
    _0x101d01['_'.charCodeAt(0)] = 63;
    function _0x2a484e(_0xb23d93) {
      var _0x437e98 = _0xb23d93.length;
      if (_0x437e98 % 4 > 0) {
        throw new Error("Invalid string. Length must be a multiple of 4");
      }
      var _0x458411 = _0xb23d93.indexOf('=');
      if (_0x458411 === -1) {
        _0x458411 = _0x437e98;
      }
      var _0x28257c = _0x458411 === _0x437e98 ? 0 : 4 - _0x458411 % 4;
      return [_0x458411, _0x28257c];
    }
    function _0x155517(_0x5a4415) {
      var _0x486a84 = _0x2a484e(_0x5a4415);
      var _0x283b04 = _0x486a84[0];
      var _0x35b64f = _0x486a84[1];
      return (_0x283b04 + _0x35b64f) * 3 / 4 - _0x35b64f;
    }
    function _0x12ef0a(_0x458ea8, _0x639080, _0x241ff4) {
      return (_0x639080 + _0x241ff4) * 3 / 4 - _0x241ff4;
    }
    function _0x243bc7(_0x3ae1ac) {
      var _0x52d337;
      var _0xf1249c = _0x2a484e(_0x3ae1ac);
      var _0x4f12a4 = _0xf1249c[0];
      var _0x48f242 = _0xf1249c[1];
      var _0xd3d5c6 = new _0x3f09f4(_0x12ef0a(_0x3ae1ac, _0x4f12a4, _0x48f242));
      var _0x455c9f = 0;
      var _0x21258f = _0x48f242 > 0 ? _0x4f12a4 - 4 : _0x4f12a4;
      var _0x1129b4;
      for (_0x1129b4 = 0; _0x1129b4 < _0x21258f; _0x1129b4 += 4) {
        _0x52d337 = _0x101d01[_0x3ae1ac.charCodeAt(_0x1129b4)] << 18 | _0x101d01[_0x3ae1ac.charCodeAt(_0x1129b4 + 1)] << 12 | _0x101d01[_0x3ae1ac.charCodeAt(_0x1129b4 + 2)] << 6 | _0x101d01[_0x3ae1ac.charCodeAt(_0x1129b4 + 3)], _0xd3d5c6[_0x455c9f++] = _0x52d337 >> 16 & 255, _0xd3d5c6[_0x455c9f++] = _0x52d337 >> 8 & 255, _0xd3d5c6[_0x455c9f++] = _0x52d337 & 255;
      }
      if (_0x48f242 === 2) {
        _0x52d337 = _0x101d01[_0x3ae1ac.charCodeAt(_0x1129b4)] << 2 | _0x101d01[_0x3ae1ac.charCodeAt(_0x1129b4 + 1)] >> 4;
        _0xd3d5c6[_0x455c9f++] = _0x52d337 & 255;
      }
      if (_0x48f242 === 1) {
        _0x52d337 = _0x101d01[_0x3ae1ac.charCodeAt(_0x1129b4)] << 10 | _0x101d01[_0x3ae1ac.charCodeAt(_0x1129b4 + 1)] << 4 | _0x101d01[_0x3ae1ac.charCodeAt(_0x1129b4 + 2)] >> 2;
        _0xd3d5c6[_0x455c9f++] = _0x52d337 >> 8 & 255;
        _0xd3d5c6[_0x455c9f++] = _0x52d337 & 255;
      }
      return _0xd3d5c6;
    }
    function _0x26b545(_0x214a8f) {
      return _0x4f4357[_0x214a8f >> 18 & 63] + _0x4f4357[_0x214a8f >> 12 & 63] + _0x4f4357[_0x214a8f >> 6 & 63] + _0x4f4357[_0x214a8f & 63];
    }
    function _0xb8fa80(_0x2c895c, _0x333b3d, _0xab7338) {
      var _0x1a8aeb;
      var _0x1aae37 = [];
      for (var _0x3670fc = _0x333b3d; _0x3670fc < _0xab7338; _0x3670fc += 3) {
        _0x1a8aeb = (_0x2c895c[_0x3670fc] << 16 & 16711680) + (_0x2c895c[_0x3670fc + 1] << 8 & 65280) + (_0x2c895c[_0x3670fc + 2] & 255);
        _0x1aae37.push(_0x26b545(_0x1a8aeb));
      }
      return _0x1aae37.join('');
    }
    function _0x116fe3(_0xe7c282) {
      var _0x15f82e;
      var _0x25da75 = _0xe7c282.length;
      var _0x717c94 = _0x25da75 % 3;
      var _0x4f4713 = [];
      var _0x4565d9 = 16383;
      for (var _0x161498 = 0, _0x2c8eb8 = _0x25da75 - _0x717c94; _0x161498 < _0x2c8eb8; _0x161498 += _0x4565d9) {
        _0x4f4713.push(_0xb8fa80(_0xe7c282, _0x161498, _0x161498 + _0x4565d9 > _0x2c8eb8 ? _0x2c8eb8 : _0x161498 + _0x4565d9));
      }
      if (_0x717c94 === 1) {
        _0x15f82e = _0xe7c282[_0x25da75 - 1];
        _0x4f4713.push(_0x4f4357[_0x15f82e >> 2] + _0x4f4357[_0x15f82e << 4 & 63] + '==');
      } else {
        if (_0x717c94 === 2) {
          _0x15f82e = (_0xe7c282[_0x25da75 - 2] << 8) + _0xe7c282[_0x25da75 - 1];
          _0x4f4713.push(_0x4f4357[_0x15f82e >> 10] + _0x4f4357[_0x15f82e >> 4 & 63] + _0x4f4357[_0x15f82e << 2 & 63] + '=');
        }
      }
      return _0x4f4713.join('');
    }
  },
  './node_modules/buffer/index.js': function (_0x88793e, _0x9330a, _0x5cea5b) {
    'use strict';

    (function (_0x5b687b) {
      /*!
      * The buffer module from node.js, for the browser.
      *
      * @author   Feross Aboukhadijeh <http://feross.org>
      * @license  MIT
      */
      var _0xe67086 = _0x5cea5b("./node_modules/base64-js/index.js");
      var _0x53bb62 = _0x5cea5b("./node_modules/ieee754/index.js");
      var _0x2075e4 = _0x5cea5b("./node_modules/buffer/node_modules/isarray/index.js");
      _0x9330a.Buffer = _0x4e4ab8;
      _0x9330a.SlowBuffer = _0x2f0840;
      _0x9330a.INSPECT_MAX_BYTES = 50;
      _0x4e4ab8.TYPED_ARRAY_SUPPORT = _0x5b687b.TYPED_ARRAY_SUPPORT !== undefined ? _0x5b687b.TYPED_ARRAY_SUPPORT : _0x2c0cba();
      _0x9330a.kMaxLength = _0x347956();
      function _0x2c0cba() {
        try {
          var _0x5a5c4c = new Uint8Array(1);
          _0x5a5c4c.__proto__ = {
            __proto__: Uint8Array.prototype,
            foo: function () {
              return 42;
            }
          };
          return _0x5a5c4c.foo() === 42 && typeof _0x5a5c4c.subarray === "function" && _0x5a5c4c.subarray(1, 1).byteLength === 0;
        } catch (_0x17bca9) {
          return false;
        }
      }
      function _0x347956() {
        return _0x4e4ab8.TYPED_ARRAY_SUPPORT ? 2147483647 : 1073741823;
      }
      function _0x413f34(_0xca729b, _0x4de83c) {
        if (_0x347956() < _0x4de83c) {
          throw new RangeError("Invalid typed array length");
        }
        if (_0x4e4ab8.TYPED_ARRAY_SUPPORT) {
          _0xca729b = new Uint8Array(_0x4de83c), _0xca729b.__proto__ = _0x4e4ab8.prototype;
        } else {
          if (_0xca729b === null) {
            _0xca729b = new _0x4e4ab8(_0x4de83c);
          }
          _0xca729b.length = _0x4de83c;
        }
        return _0xca729b;
      }
      function _0x4e4ab8(_0x43d168, _0x55dcd1, _0x3559c0) {
        if (!_0x4e4ab8.TYPED_ARRAY_SUPPORT && !(this instanceof _0x4e4ab8)) {
          return new _0x4e4ab8(_0x43d168, _0x55dcd1, _0x3559c0);
        }
        if (typeof _0x43d168 === "number") {
          if (typeof _0x55dcd1 === "string") {
            throw new Error("If encoding is specified then the first argument must be a string");
          }
          return _0x390667(this, _0x43d168);
        }
        return _0x4b740e(this, _0x43d168, _0x55dcd1, _0x3559c0);
      }
      _0x4e4ab8.poolSize = 8192;
      _0x4e4ab8._augment = function (_0x4d9c61) {
        _0x4d9c61.__proto__ = _0x4e4ab8.prototype;
        return _0x4d9c61;
      };
      function _0x4b740e(_0x13a5a9, _0x222ec1, _0x317f1a, _0x501cba) {
        if (typeof _0x222ec1 === "number") {
          throw new TypeError("\"value\" argument must not be a number");
        }
        if (typeof ArrayBuffer !== "undefined" && _0x222ec1 instanceof ArrayBuffer) {
          return _0x10cd04(_0x13a5a9, _0x222ec1, _0x317f1a, _0x501cba);
        }
        if (typeof _0x222ec1 === "string") {
          return _0x255dee(_0x13a5a9, _0x222ec1, _0x317f1a);
        }
        return _0x1f7aed(_0x13a5a9, _0x222ec1);
      }
      _0x4e4ab8.from = function (_0x2612bc, _0x2a29bd, _0x46c095) {
        return _0x4b740e(null, _0x2612bc, _0x2a29bd, _0x46c095);
      };
      if (_0x4e4ab8.TYPED_ARRAY_SUPPORT) {
        _0x4e4ab8.prototype.__proto__ = Uint8Array.prototype;
        _0x4e4ab8.__proto__ = Uint8Array;
        if (typeof Symbol !== "undefined" && Symbol.species && _0x4e4ab8[Symbol.species] === _0x4e4ab8) {
          var _0xe3cb16 = {
            value: null,
            configurable: true
          };
          Object.defineProperty(_0x4e4ab8, Symbol.species, _0xe3cb16);
        }
      }
      function _0x48217a(_0x17216f) {
        if (typeof _0x17216f !== "number") {
          throw new TypeError("\"size\" argument must be a number");
        } else {
          if (_0x17216f < 0) {
            throw new RangeError("\"size\" argument must not be negative");
          }
        }
      }
      function _0x1a76ac(_0x19e171, _0x2b8bb8, _0x39efba, _0x355d9b) {
        _0x48217a(_0x2b8bb8);
        if (_0x2b8bb8 <= 0) {
          return _0x413f34(_0x19e171, _0x2b8bb8);
        }
        if (_0x39efba !== undefined) {
          return typeof _0x355d9b === "string" ? _0x413f34(_0x19e171, _0x2b8bb8).fill(_0x39efba, _0x355d9b) : _0x413f34(_0x19e171, _0x2b8bb8).fill(_0x39efba);
        }
        return _0x413f34(_0x19e171, _0x2b8bb8);
      }
      _0x4e4ab8.alloc = function (_0x27501c, _0x12c77d, _0x2ed154) {
        return _0x1a76ac(null, _0x27501c, _0x12c77d, _0x2ed154);
      };
      function _0x390667(_0x24a473, _0x1d8974) {
        _0x48217a(_0x1d8974);
        _0x24a473 = _0x413f34(_0x24a473, _0x1d8974 < 0 ? 0 : _0x3dc7c9(_0x1d8974) | 0);
        if (!_0x4e4ab8.TYPED_ARRAY_SUPPORT) {
          for (var _0x5ac216 = 0; _0x5ac216 < _0x1d8974; ++_0x5ac216) {
            _0x24a473[_0x5ac216] = 0;
          }
        }
        return _0x24a473;
      }
      _0x4e4ab8.allocUnsafe = function (_0x474f27) {
        return _0x390667(null, _0x474f27);
      };
      _0x4e4ab8.allocUnsafeSlow = function (_0x4d4a0c) {
        return _0x390667(null, _0x4d4a0c);
      };
      function _0x255dee(_0x47e2c7, _0x2fa3f6, _0x118357) {
        (typeof _0x118357 !== "string" || _0x118357 === '') && (_0x118357 = "utf8");
        if (!_0x4e4ab8.isEncoding(_0x118357)) {
          throw new TypeError("\"encoding\" must be a valid string encoding");
        }
        var _0x2701bc = _0x39eb61(_0x2fa3f6, _0x118357) | 0;
        _0x47e2c7 = _0x413f34(_0x47e2c7, _0x2701bc);
        var _0x2f09f6 = _0x47e2c7.write(_0x2fa3f6, _0x118357);
        _0x2f09f6 !== _0x2701bc && (_0x47e2c7 = _0x47e2c7.slice(0, _0x2f09f6));
        return _0x47e2c7;
      }
      function _0x3d1fb4(_0x282f80, _0x4094d7) {
        var _0x44daff = _0x4094d7.length < 0 ? 0 : _0x3dc7c9(_0x4094d7.length) | 0;
        _0x282f80 = _0x413f34(_0x282f80, _0x44daff);
        for (var _0x37abaa = 0; _0x37abaa < _0x44daff; _0x37abaa += 1) {
          _0x282f80[_0x37abaa] = _0x4094d7[_0x37abaa] & 255;
        }
        return _0x282f80;
      }
      function _0x10cd04(_0x4431f7, _0xd45bf8, _0x1a4b59, _0x184db9) {
        _0xd45bf8.byteLength;
        if (_0x1a4b59 < 0 || _0xd45bf8.byteLength < _0x1a4b59) {
          throw new RangeError("'offset' is out of bounds");
        }
        if (_0xd45bf8.byteLength < _0x1a4b59 + (_0x184db9 || 0)) {
          throw new RangeError("'length' is out of bounds");
        }
        if (_0x1a4b59 === undefined && _0x184db9 === undefined) {
          _0xd45bf8 = new Uint8Array(_0xd45bf8);
        } else {
          if (_0x184db9 === undefined) {
            _0xd45bf8 = new Uint8Array(_0xd45bf8, _0x1a4b59);
          } else {
            _0xd45bf8 = new Uint8Array(_0xd45bf8, _0x1a4b59, _0x184db9);
          }
        }
        if (_0x4e4ab8.TYPED_ARRAY_SUPPORT) {
          _0x4431f7 = _0xd45bf8;
          _0x4431f7.__proto__ = _0x4e4ab8.prototype;
        } else {
          _0x4431f7 = _0x3d1fb4(_0x4431f7, _0xd45bf8);
        }
        return _0x4431f7;
      }
      function _0x1f7aed(_0x4c364c, _0x1cf682) {
        if (_0x4e4ab8.isBuffer(_0x1cf682)) {
          var _0x506261 = _0x3dc7c9(_0x1cf682.length) | 0;
          _0x4c364c = _0x413f34(_0x4c364c, _0x506261);
          if (_0x4c364c.length === 0) {
            return _0x4c364c;
          }
          _0x1cf682.copy(_0x4c364c, 0, 0, _0x506261);
          return _0x4c364c;
        }
        if (_0x1cf682) {
          if (typeof ArrayBuffer !== "undefined" && _0x1cf682.buffer instanceof ArrayBuffer || "length" in _0x1cf682) {
            if (typeof _0x1cf682.length !== "number" || _0x177470(_0x1cf682.length)) {
              return _0x413f34(_0x4c364c, 0);
            }
            return _0x3d1fb4(_0x4c364c, _0x1cf682);
          }
          if (_0x1cf682.type === "Buffer" && _0x2075e4(_0x1cf682.data)) {
            return _0x3d1fb4(_0x4c364c, _0x1cf682.data);
          }
        }
        throw new TypeError("First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.");
      }
      function _0x3dc7c9(_0x34d062) {
        if (_0x34d062 >= _0x347956()) {
          throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + _0x347956().toString(16) + " bytes");
        }
        return _0x34d062 | 0;
      }
      function _0x2f0840(_0x7036f7) {
        +_0x7036f7 != _0x7036f7 && (_0x7036f7 = 0);
        return _0x4e4ab8.alloc(+_0x7036f7);
      }
      _0x4e4ab8.isBuffer = function _0x572738(_0x48aed3) {
        return !!(_0x48aed3 != null && _0x48aed3._isBuffer);
      };
      _0x4e4ab8.compare = function _0x5999de(_0x5a3b3c, _0x5ce8d6) {
        if (!_0x4e4ab8.isBuffer(_0x5a3b3c) || !_0x4e4ab8.isBuffer(_0x5ce8d6)) {
          throw new TypeError("Arguments must be Buffers");
        }
        if (_0x5a3b3c === _0x5ce8d6) {
          return 0;
        }
        var _0x2d48cf = _0x5a3b3c.length;
        var _0x4232b6 = _0x5ce8d6.length;
        for (var _0x9d30be = 0, _0x1eb36e = Math.min(_0x2d48cf, _0x4232b6); _0x9d30be < _0x1eb36e; ++_0x9d30be) {
          if (_0x5a3b3c[_0x9d30be] !== _0x5ce8d6[_0x9d30be]) {
            _0x2d48cf = _0x5a3b3c[_0x9d30be];
            _0x4232b6 = _0x5ce8d6[_0x9d30be];
            break;
          }
        }
        if (_0x2d48cf < _0x4232b6) {
          return -1;
        }
        if (_0x4232b6 < _0x2d48cf) {
          return 1;
        }
        return 0;
      };
      _0x4e4ab8.isEncoding = function _0x13aad2(_0x2bd22f) {
        switch (String(_0x2bd22f).toLowerCase()) {
          case "hex":
          case "utf8":
          case "utf-8":
          case "ascii":
          case "latin1":
          case "binary":
          case "base64":
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return true;
          default:
            return false;
        }
      };
      _0x4e4ab8.concat = function _0x6f8d7a(_0x38591, _0x57e7b6) {
        if (!_0x2075e4(_0x38591)) {
          throw new TypeError("\"list\" argument must be an Array of Buffers");
        }
        if (_0x38591.length === 0) {
          return _0x4e4ab8.alloc(0);
        }
        var _0x2a7545;
        if (_0x57e7b6 === undefined) {
          _0x57e7b6 = 0;
          for (_0x2a7545 = 0; _0x2a7545 < _0x38591.length; ++_0x2a7545) {
            _0x57e7b6 += _0x38591[_0x2a7545].length;
          }
        }
        var _0x59ad23 = _0x4e4ab8.allocUnsafe(_0x57e7b6);
        var _0x24cad9 = 0;
        for (_0x2a7545 = 0; _0x2a7545 < _0x38591.length; ++_0x2a7545) {
          var _0x3099d4 = _0x38591[_0x2a7545];
          if (!_0x4e4ab8.isBuffer(_0x3099d4)) {
            throw new TypeError("\"list\" argument must be an Array of Buffers");
          }
          _0x3099d4.copy(_0x59ad23, _0x24cad9);
          _0x24cad9 += _0x3099d4.length;
        }
        return _0x59ad23;
      };
      function _0x39eb61(_0x497fda, _0xe5a59a) {
        if (_0x4e4ab8.isBuffer(_0x497fda)) {
          return _0x497fda.length;
        }
        if (typeof ArrayBuffer !== "undefined" && typeof ArrayBuffer.isView === "function" && (ArrayBuffer.isView(_0x497fda) || _0x497fda instanceof ArrayBuffer)) {
          return _0x497fda.byteLength;
        }
        typeof _0x497fda !== "string" && (_0x497fda = '' + _0x497fda);
        var _0x121740 = _0x497fda.length;
        if (_0x121740 === 0) {
          return 0;
        }
        var _0x29dd82 = false;
        for (;;) {
          switch (_0xe5a59a) {
            case "ascii":
            case "latin1":
            case "binary":
              return _0x121740;
            case "utf8":
            case "utf-8":
            case undefined:
              return _0x17a853(_0x497fda).length;
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return _0x121740 * 2;
            case "hex":
              return _0x121740 >>> 1;
            case "base64":
              return _0xbe1208(_0x497fda).length;
            default:
              if (_0x29dd82) {
                return _0x17a853(_0x497fda).length;
              }
              _0xe5a59a = ('' + _0xe5a59a).toLowerCase();
              _0x29dd82 = true;
          }
        }
      }
      _0x4e4ab8.byteLength = _0x39eb61;
      function _0x3d6c96(_0x315ff7, _0x5eef4b, _0x24292f) {
        var _0x308070 = false;
        (_0x5eef4b === undefined || _0x5eef4b < 0) && (_0x5eef4b = 0);
        if (_0x5eef4b > this.length) {
          return '';
        }
        if (_0x24292f === undefined || _0x24292f > this.length) {
          _0x24292f = this.length;
        }
        if (_0x24292f <= 0) {
          return '';
        }
        _0x24292f >>>= 0;
        _0x5eef4b >>>= 0;
        if (_0x24292f <= _0x5eef4b) {
          return '';
        }
        if (!_0x315ff7) {
          _0x315ff7 = "utf8";
        }
        while (true) {
          switch (_0x315ff7) {
            case "hex":
              return _0x2eea81(this, _0x5eef4b, _0x24292f);
            case "utf8":
            case "utf-8":
              return _0x543f80(this, _0x5eef4b, _0x24292f);
            case "ascii":
              return _0x548cf1(this, _0x5eef4b, _0x24292f);
            case "latin1":
            case "binary":
              return _0x1a25eb(this, _0x5eef4b, _0x24292f);
            case "base64":
              return _0x5ec886(this, _0x5eef4b, _0x24292f);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return _0x2a5e6f(this, _0x5eef4b, _0x24292f);
            default:
              if (_0x308070) {
                throw new TypeError("Unknown encoding: " + _0x315ff7);
              }
              _0x315ff7 = (_0x315ff7 + '').toLowerCase();
              _0x308070 = true;
          }
        }
      }
      _0x4e4ab8.prototype._isBuffer = true;
      function _0x36c13e(_0x18753a, _0x358c72, _0x108206) {
        var _0x50c51e = _0x18753a[_0x358c72];
        _0x18753a[_0x358c72] = _0x18753a[_0x108206];
        _0x18753a[_0x108206] = _0x50c51e;
      }
      _0x4e4ab8.prototype.swap16 = function _0x1d8ab9() {
        var _0x71e28 = this.length;
        if (_0x71e28 % 2 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 16-bits");
        }
        for (var _0x4adee1 = 0; _0x4adee1 < _0x71e28; _0x4adee1 += 2) {
          _0x36c13e(this, _0x4adee1, _0x4adee1 + 1);
        }
        return this;
      };
      _0x4e4ab8.prototype.swap32 = function _0x42c8e2() {
        var _0x452eec = this.length;
        if (_0x452eec % 4 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 32-bits");
        }
        for (var _0x5ee338 = 0; _0x5ee338 < _0x452eec; _0x5ee338 += 4) {
          _0x36c13e(this, _0x5ee338, _0x5ee338 + 3), _0x36c13e(this, _0x5ee338 + 1, _0x5ee338 + 2);
        }
        return this;
      };
      _0x4e4ab8.prototype.swap64 = function _0x5e2b7c() {
        var _0x38e440 = this.length;
        if (_0x38e440 % 8 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 64-bits");
        }
        for (var _0x1e80d9 = 0; _0x1e80d9 < _0x38e440; _0x1e80d9 += 8) {
          _0x36c13e(this, _0x1e80d9, _0x1e80d9 + 7);
          _0x36c13e(this, _0x1e80d9 + 1, _0x1e80d9 + 6);
          _0x36c13e(this, _0x1e80d9 + 2, _0x1e80d9 + 5);
          _0x36c13e(this, _0x1e80d9 + 3, _0x1e80d9 + 4);
        }
        return this;
      };
      _0x4e4ab8.prototype.toString = function _0x217512() {
        var _0x4077d7 = this.length | 0;
        if (_0x4077d7 === 0) {
          return '';
        }
        if (arguments.length === 0) {
          return _0x543f80(this, 0, _0x4077d7);
        }
        return _0x3d6c96.apply(this, arguments);
      };
      _0x4e4ab8.prototype.equals = function _0x45cc46(_0x97b4a4) {
        if (!_0x4e4ab8.isBuffer(_0x97b4a4)) {
          throw new TypeError("Argument must be a Buffer");
        }
        if (this === _0x97b4a4) {
          return true;
        }
        return _0x4e4ab8.compare(this, _0x97b4a4) === 0;
      };
      _0x4e4ab8.prototype.inspect = function _0x15024d() {
        var _0x1605a2 = '';
        var _0x22b728 = _0x9330a.INSPECT_MAX_BYTES;
        if (this.length > 0) {
          _0x1605a2 = this.toString("hex", 0, _0x22b728).match(/.{2}/g).join('\x20');
          if (this.length > _0x22b728) {
            _0x1605a2 += " ... ";
          }
        }
        return "<Buffer " + _0x1605a2 + '>';
      };
      _0x4e4ab8.prototype.compare = function _0x2e5fd0(_0x61d7e0, _0x17fca4, _0x356b47, _0x102a3c, _0x57688d) {
        if (!_0x4e4ab8.isBuffer(_0x61d7e0)) {
          throw new TypeError("Argument must be a Buffer");
        }
        _0x17fca4 === undefined && (_0x17fca4 = 0);
        if (_0x356b47 === undefined) {
          _0x356b47 = _0x61d7e0 ? _0x61d7e0.length : 0;
        }
        _0x102a3c === undefined && (_0x102a3c = 0);
        if (_0x57688d === undefined) {
          _0x57688d = this.length;
        }
        if (_0x17fca4 < 0 || _0x356b47 > _0x61d7e0.length || _0x102a3c < 0 || _0x57688d > this.length) {
          throw new RangeError("out of range index");
        }
        if (_0x102a3c >= _0x57688d && _0x17fca4 >= _0x356b47) {
          return 0;
        }
        if (_0x102a3c >= _0x57688d) {
          return -1;
        }
        if (_0x17fca4 >= _0x356b47) {
          return 1;
        }
        _0x17fca4 >>>= 0;
        _0x356b47 >>>= 0;
        _0x102a3c >>>= 0;
        _0x57688d >>>= 0;
        if (this === _0x61d7e0) {
          return 0;
        }
        var _0x1173bd = _0x57688d - _0x102a3c;
        var _0x19ffa3 = _0x356b47 - _0x17fca4;
        var _0x1b12fe = Math.min(_0x1173bd, _0x19ffa3);
        var _0x40dbd0 = this.slice(_0x102a3c, _0x57688d);
        var _0x10fc67 = _0x61d7e0.slice(_0x17fca4, _0x356b47);
        for (var _0x1e0e85 = 0; _0x1e0e85 < _0x1b12fe; ++_0x1e0e85) {
          if (_0x40dbd0[_0x1e0e85] !== _0x10fc67[_0x1e0e85]) {
            _0x1173bd = _0x40dbd0[_0x1e0e85];
            _0x19ffa3 = _0x10fc67[_0x1e0e85];
            break;
          }
        }
        if (_0x1173bd < _0x19ffa3) {
          return -1;
        }
        if (_0x19ffa3 < _0x1173bd) {
          return 1;
        }
        return 0;
      };
      function _0xa5427e(_0x26348e, _0x1d9f5d, _0x38d568, _0x5e2de9, _0x2a8827) {
        if (_0x26348e.length === 0) {
          return -1;
        }
        if (typeof _0x38d568 === "string") {
          _0x5e2de9 = _0x38d568;
          _0x38d568 = 0;
        } else {
          if (_0x38d568 > 2147483647) {
            _0x38d568 = 2147483647;
          } else {
            if (_0x38d568 < -2147483648) {
              _0x38d568 = -2147483648;
            }
          }
        }
        _0x38d568 = +_0x38d568;
        if (isNaN(_0x38d568)) {
          _0x38d568 = _0x2a8827 ? 0 : _0x26348e.length - 1;
        }
        if (_0x38d568 < 0) {
          _0x38d568 = _0x26348e.length + _0x38d568;
        }
        if (_0x38d568 >= _0x26348e.length) {
          if (_0x2a8827) {
            return -1;
          } else {
            _0x38d568 = _0x26348e.length - 1;
          }
        } else {
          if (_0x38d568 < 0) {
            if (_0x2a8827) {
              _0x38d568 = 0;
            } else {
              return -1;
            }
          }
        }
        typeof _0x1d9f5d === "string" && (_0x1d9f5d = _0x4e4ab8.from(_0x1d9f5d, _0x5e2de9));
        if (_0x4e4ab8.isBuffer(_0x1d9f5d)) {
          if (_0x1d9f5d.length === 0) {
            return -1;
          }
          return _0x277ff5(_0x26348e, _0x1d9f5d, _0x38d568, _0x5e2de9, _0x2a8827);
        } else {
          if (typeof _0x1d9f5d === "number") {
            _0x1d9f5d = _0x1d9f5d & 255;
            if (_0x4e4ab8.TYPED_ARRAY_SUPPORT && typeof Uint8Array.prototype.indexOf === "function") {
              if (_0x2a8827) {
                return Uint8Array.prototype.indexOf.call(_0x26348e, _0x1d9f5d, _0x38d568);
              } else {
                return Uint8Array.prototype.lastIndexOf.call(_0x26348e, _0x1d9f5d, _0x38d568);
              }
            }
            return _0x277ff5(_0x26348e, [_0x1d9f5d], _0x38d568, _0x5e2de9, _0x2a8827);
          }
        }
        throw new TypeError("val must be string, number or Buffer");
      }
      function _0x277ff5(_0xbd5bd, _0x2de877, _0x2d986e, _0x4c70d5, _0x320595) {
        var _0x2c21b2 = 1;
        var _0x432e96 = _0xbd5bd.length;
        var _0x2469e5 = _0x2de877.length;
        if (_0x4c70d5 !== undefined) {
          _0x4c70d5 = String(_0x4c70d5).toLowerCase();
          if (_0x4c70d5 === "ucs2" || _0x4c70d5 === "ucs-2" || _0x4c70d5 === "utf16le" || _0x4c70d5 === "utf-16le") {
            if (_0xbd5bd.length < 2 || _0x2de877.length < 2) {
              return -1;
            }
            _0x2c21b2 = 2;
            _0x432e96 /= 2;
            _0x2469e5 /= 2;
            _0x2d986e /= 2;
          }
        }
        function _0x555ed2(_0x576e9a, _0x1e4817) {
          if (_0x2c21b2 === 1) {
            return _0x576e9a[_0x1e4817];
          } else {
            return _0x576e9a.readUInt16BE(_0x1e4817 * _0x2c21b2);
          }
        }
        var _0x447d0e;
        if (_0x320595) {
          var _0x3cb464 = -1;
          for (_0x447d0e = _0x2d986e; _0x447d0e < _0x432e96; _0x447d0e++) {
            if (_0x555ed2(_0xbd5bd, _0x447d0e) === _0x555ed2(_0x2de877, _0x3cb464 === -1 ? 0 : _0x447d0e - _0x3cb464)) {
              if (_0x3cb464 === -1) {
                _0x3cb464 = _0x447d0e;
              }
              if (_0x447d0e - _0x3cb464 + 1 === _0x2469e5) {
                return _0x3cb464 * _0x2c21b2;
              }
            } else {
              if (_0x3cb464 !== -1) {
                _0x447d0e -= _0x447d0e - _0x3cb464;
              }
              _0x3cb464 = -1;
            }
          }
        } else {
          if (_0x2d986e + _0x2469e5 > _0x432e96) {
            _0x2d986e = _0x432e96 - _0x2469e5;
          }
          for (_0x447d0e = _0x2d986e; _0x447d0e >= 0; _0x447d0e--) {
            var _0x4b0eff = true;
            for (var _0x404e36 = 0; _0x404e36 < _0x2469e5; _0x404e36++) {
              if (_0x555ed2(_0xbd5bd, _0x447d0e + _0x404e36) !== _0x555ed2(_0x2de877, _0x404e36)) {
                _0x4b0eff = false;
                break;
              }
            }
            if (_0x4b0eff) {
              return _0x447d0e;
            }
          }
        }
        return -1;
      }
      _0x4e4ab8.prototype.includes = function _0x36d559(_0xabae64, _0x4970c4, _0x5f0c11) {
        return this.indexOf(_0xabae64, _0x4970c4, _0x5f0c11) !== -1;
      };
      _0x4e4ab8.prototype.indexOf = function _0x981d77(_0x43bf9f, _0x38bb59, _0x4b5baa) {
        return _0xa5427e(this, _0x43bf9f, _0x38bb59, _0x4b5baa, true);
      };
      _0x4e4ab8.prototype.lastIndexOf = function _0x4181cf(_0xae5fbf, _0x3f8f4b, _0x5d49d7) {
        return _0xa5427e(this, _0xae5fbf, _0x3f8f4b, _0x5d49d7, false);
      };
      function _0x5e1371(_0x543c73, _0x5796b1, _0x166450, _0x26c375) {
        _0x166450 = Number(_0x166450) || 0;
        var _0x4be3e7 = _0x543c73.length - _0x166450;
        !_0x26c375 ? _0x26c375 = _0x4be3e7 : (_0x26c375 = Number(_0x26c375), _0x26c375 > _0x4be3e7 && (_0x26c375 = _0x4be3e7));
        var _0x8d04f3 = _0x5796b1.length;
        if (_0x8d04f3 % 2 !== 0) {
          throw new TypeError("Invalid hex string");
        }
        if (_0x26c375 > _0x8d04f3 / 2) {
          _0x26c375 = _0x8d04f3 / 2;
        }
        for (var _0x59b803 = 0; _0x59b803 < _0x26c375; ++_0x59b803) {
          var _0xe58ac2 = parseInt(_0x5796b1.substr(_0x59b803 * 2, 2), 16);
          if (isNaN(_0xe58ac2)) {
            return _0x59b803;
          }
          _0x543c73[_0x166450 + _0x59b803] = _0xe58ac2;
        }
        return _0x59b803;
      }
      function _0x487cb1(_0xc6a4a9, _0x51f4d7, _0x3ad02d, _0x39cf48) {
        return _0x46abe6(_0x17a853(_0x51f4d7, _0xc6a4a9.length - _0x3ad02d), _0xc6a4a9, _0x3ad02d, _0x39cf48);
      }
      function _0x18d2d6(_0x5851de, _0x13e8d5, _0x62af61, _0x52b807) {
        return _0x46abe6(_0x593c41(_0x13e8d5), _0x5851de, _0x62af61, _0x52b807);
      }
      function _0x267347(_0x43bd97, _0x3a3907, _0x479488, _0x34cf35) {
        return _0x18d2d6(_0x43bd97, _0x3a3907, _0x479488, _0x34cf35);
      }
      function _0x466a1a(_0x16c463, _0x21f477, _0x57955a, _0x29d58f) {
        return _0x46abe6(_0xbe1208(_0x21f477), _0x16c463, _0x57955a, _0x29d58f);
      }
      function _0x2c35e0(_0x2f1f9c, _0x309251, _0x2c2b6e, _0x4f237c) {
        return _0x46abe6(_0x111516(_0x309251, _0x2f1f9c.length - _0x2c2b6e), _0x2f1f9c, _0x2c2b6e, _0x4f237c);
      }
      _0x4e4ab8.prototype.write = function _0x221eca(_0x2fffd8, _0x33d654, _0x3c9002, _0x5bbfcd) {
        if (_0x33d654 === undefined) {
          _0x5bbfcd = "utf8";
          _0x3c9002 = this.length;
          _0x33d654 = 0;
        } else {
          if (_0x3c9002 === undefined && typeof _0x33d654 === "string") {
            _0x5bbfcd = _0x33d654;
            _0x3c9002 = this.length;
            _0x33d654 = 0;
          } else {
            if (isFinite(_0x33d654)) {
              _0x33d654 = _0x33d654 | 0;
              if (isFinite(_0x3c9002)) {
                _0x3c9002 = _0x3c9002 | 0;
                if (_0x5bbfcd === undefined) {
                  _0x5bbfcd = "utf8";
                }
              } else {
                _0x5bbfcd = _0x3c9002, _0x3c9002 = undefined;
              }
            } else {
              throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");
            }
          }
        }
        var _0x13ed1 = this.length - _0x33d654;
        if (_0x3c9002 === undefined || _0x3c9002 > _0x13ed1) {
          _0x3c9002 = _0x13ed1;
        }
        if (_0x2fffd8.length > 0 && (_0x3c9002 < 0 || _0x33d654 < 0) || _0x33d654 > this.length) {
          throw new RangeError("Attempt to write outside buffer bounds");
        }
        if (!_0x5bbfcd) {
          _0x5bbfcd = "utf8";
        }
        var _0x3d4c4c = false;
        for (;;) {
          switch (_0x5bbfcd) {
            case "hex":
              return _0x5e1371(this, _0x2fffd8, _0x33d654, _0x3c9002);
            case "utf8":
            case "utf-8":
              return _0x487cb1(this, _0x2fffd8, _0x33d654, _0x3c9002);
            case "ascii":
              return _0x18d2d6(this, _0x2fffd8, _0x33d654, _0x3c9002);
            case "latin1":
            case "binary":
              return _0x267347(this, _0x2fffd8, _0x33d654, _0x3c9002);
            case "base64":
              return _0x466a1a(this, _0x2fffd8, _0x33d654, _0x3c9002);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return _0x2c35e0(this, _0x2fffd8, _0x33d654, _0x3c9002);
            default:
              if (_0x3d4c4c) {
                throw new TypeError("Unknown encoding: " + _0x5bbfcd);
              }
              _0x5bbfcd = ('' + _0x5bbfcd).toLowerCase();
              _0x3d4c4c = true;
          }
        }
      };
      _0x4e4ab8.prototype.toJSON = function _0x2c293a() {
        return {
          type: "Buffer",
          data: Array.prototype.slice.call(this._arr || this, 0)
        };
      };
      function _0x5ec886(_0x306c27, _0x1c7345, _0x13b4c9) {
        if (_0x1c7345 === 0 && _0x13b4c9 === _0x306c27.length) {
          return _0xe67086.fromByteArray(_0x306c27);
        } else {
          return _0xe67086.fromByteArray(_0x306c27.slice(_0x1c7345, _0x13b4c9));
        }
      }
      function _0x543f80(_0x2dab98, _0x4b70e5, _0x37d3e2) {
        _0x37d3e2 = Math.min(_0x2dab98.length, _0x37d3e2);
        var _0x2903ab = [];
        var _0x25af25 = _0x4b70e5;
        while (_0x25af25 < _0x37d3e2) {
          var _0x41637c = _0x2dab98[_0x25af25];
          var _0x889ea8 = null;
          var _0x1b4978 = _0x41637c > 239 ? 4 : _0x41637c > 223 ? 3 : _0x41637c > 191 ? 2 : 1;
          if (_0x25af25 + _0x1b4978 <= _0x37d3e2) {
            var _0x2540d9;
            var _0x1bc5ca;
            var _0x526278;
            var _0x551d8f;
            switch (_0x1b4978) {
              case 1:
                _0x41637c < 128 && (_0x889ea8 = _0x41637c);
                break;
              case 2:
                _0x2540d9 = _0x2dab98[_0x25af25 + 1];
                if ((_0x2540d9 & 192) === 128) {
                  _0x551d8f = (_0x41637c & 31) << 6 | _0x2540d9 & 63;
                  _0x551d8f > 127 && (_0x889ea8 = _0x551d8f);
                }
                break;
              case 3:
                _0x2540d9 = _0x2dab98[_0x25af25 + 1];
                _0x1bc5ca = _0x2dab98[_0x25af25 + 2];
                if ((_0x2540d9 & 192) === 128 && (_0x1bc5ca & 192) === 128) {
                  _0x551d8f = (_0x41637c & 15) << 12 | (_0x2540d9 & 63) << 6 | _0x1bc5ca & 63;
                  if (_0x551d8f > 2047 && (_0x551d8f < 55296 || _0x551d8f > 57343)) {
                    _0x889ea8 = _0x551d8f;
                  }
                }
                break;
              case 4:
                _0x2540d9 = _0x2dab98[_0x25af25 + 1];
                _0x1bc5ca = _0x2dab98[_0x25af25 + 2];
                _0x526278 = _0x2dab98[_0x25af25 + 3];
                if ((_0x2540d9 & 192) === 128 && (_0x1bc5ca & 192) === 128 && (_0x526278 & 192) === 128) {
                  _0x551d8f = (_0x41637c & 15) << 18 | (_0x2540d9 & 63) << 12 | (_0x1bc5ca & 63) << 6 | _0x526278 & 63;
                  if (_0x551d8f > 65535 && _0x551d8f < 1114112) {
                    _0x889ea8 = _0x551d8f;
                  }
                }
            }
          }
          if (_0x889ea8 === null) {
            _0x889ea8 = 65533, _0x1b4978 = 1;
          } else {
            if (_0x889ea8 > 65535) {
              _0x889ea8 -= 65536;
              _0x2903ab.push(_0x889ea8 >>> 10 & 1023 | 55296);
              _0x889ea8 = 56320 | _0x889ea8 & 1023;
            }
          }
          _0x2903ab.push(_0x889ea8);
          _0x25af25 += _0x1b4978;
        }
        return _0x244603(_0x2903ab);
      }
      var _0x4a4336 = 4096;
      function _0x244603(_0x1f9ad1) {
        var _0x455c84 = _0x1f9ad1.length;
        if (_0x455c84 <= _0x4a4336) {
          return String.fromCharCode.apply(String, _0x1f9ad1);
        }
        var _0x1e99b4 = '';
        var _0x45aebe = 0;
        while (_0x45aebe < _0x455c84) {
          _0x1e99b4 += String.fromCharCode.apply(String, _0x1f9ad1.slice(_0x45aebe, _0x45aebe += _0x4a4336));
        }
        return _0x1e99b4;
      }
      function _0x548cf1(_0x596263, _0x482f97, _0x12fdfe) {
        var _0x3865e0 = '';
        _0x12fdfe = Math.min(_0x596263.length, _0x12fdfe);
        for (var _0x4f3857 = _0x482f97; _0x4f3857 < _0x12fdfe; ++_0x4f3857) {
          _0x3865e0 += String.fromCharCode(_0x596263[_0x4f3857] & 127);
        }
        return _0x3865e0;
      }
      function _0x1a25eb(_0x5118f9, _0x50a11d, _0x1334b6) {
        var _0x59b6a2 = '';
        _0x1334b6 = Math.min(_0x5118f9.length, _0x1334b6);
        for (var _0x44d1f4 = _0x50a11d; _0x44d1f4 < _0x1334b6; ++_0x44d1f4) {
          _0x59b6a2 += String.fromCharCode(_0x5118f9[_0x44d1f4]);
        }
        return _0x59b6a2;
      }
      function _0x2eea81(_0x396b99, _0x4c6d30, _0x3922ba) {
        var _0x2d0998 = _0x396b99.length;
        if (!_0x4c6d30 || _0x4c6d30 < 0) {
          _0x4c6d30 = 0;
        }
        if (!_0x3922ba || _0x3922ba < 0 || _0x3922ba > _0x2d0998) {
          _0x3922ba = _0x2d0998;
        }
        var _0x5a7653 = '';
        for (var _0x12e77a = _0x4c6d30; _0x12e77a < _0x3922ba; ++_0x12e77a) {
          _0x5a7653 += _0x2e32d7(_0x396b99[_0x12e77a]);
        }
        return _0x5a7653;
      }
      function _0x2a5e6f(_0x1eb2fe, _0xaf572, _0x1887ba) {
        var _0x4eefa2 = _0x1eb2fe.slice(_0xaf572, _0x1887ba);
        var _0x17d10e = '';
        for (var _0x27d467 = 0; _0x27d467 < _0x4eefa2.length; _0x27d467 += 2) {
          _0x17d10e += String.fromCharCode(_0x4eefa2[_0x27d467] + _0x4eefa2[_0x27d467 + 1] * 256);
        }
        return _0x17d10e;
      }
      _0x4e4ab8.prototype.slice = function _0x25c95b(_0x342a18, _0xcf0b1b) {
        var _0x154696 = this.length;
        _0x342a18 = ~~_0x342a18;
        _0xcf0b1b = _0xcf0b1b === undefined ? _0x154696 : ~~_0xcf0b1b;
        if (_0x342a18 < 0) {
          _0x342a18 += _0x154696;
          if (_0x342a18 < 0) {
            _0x342a18 = 0;
          }
        } else {
          _0x342a18 > _0x154696 && (_0x342a18 = _0x154696);
        }
        if (_0xcf0b1b < 0) {
          _0xcf0b1b += _0x154696;
          if (_0xcf0b1b < 0) {
            _0xcf0b1b = 0;
          }
        } else {
          if (_0xcf0b1b > _0x154696) {
            _0xcf0b1b = _0x154696;
          }
        }
        if (_0xcf0b1b < _0x342a18) {
          _0xcf0b1b = _0x342a18;
        }
        var _0x2b0b79;
        if (_0x4e4ab8.TYPED_ARRAY_SUPPORT) {
          _0x2b0b79 = this.subarray(_0x342a18, _0xcf0b1b), _0x2b0b79.__proto__ = _0x4e4ab8.prototype;
        } else {
          var _0x270ea3 = _0xcf0b1b - _0x342a18;
          _0x2b0b79 = new _0x4e4ab8(_0x270ea3, undefined);
          for (var _0x4eb459 = 0; _0x4eb459 < _0x270ea3; ++_0x4eb459) {
            _0x2b0b79[_0x4eb459] = this[_0x4eb459 + _0x342a18];
          }
        }
        return _0x2b0b79;
      };
      function _0x10cfb7(_0x1a82a4, _0x1c7ec5, _0x59d9d9) {
        if (_0x1a82a4 % 1 !== 0 || _0x1a82a4 < 0) {
          throw new RangeError("offset is not uint");
        }
        if (_0x1a82a4 + _0x1c7ec5 > _0x59d9d9) {
          throw new RangeError("Trying to access beyond buffer length");
        }
      }
      _0x4e4ab8.prototype.readUIntLE = function _0x4d3679(_0x26f959, _0x2f4157, _0x1b3b6f) {
        _0x26f959 = _0x26f959 | 0;
        _0x2f4157 = _0x2f4157 | 0;
        if (!_0x1b3b6f) {
          _0x10cfb7(_0x26f959, _0x2f4157, this.length);
        }
        var _0xc8ccc1 = this[_0x26f959];
        var _0x5be949 = 1;
        var _0x1dfb66 = 0;
        while (++_0x1dfb66 < _0x2f4157 && (_0x5be949 *= 256)) {
          _0xc8ccc1 += this[_0x26f959 + _0x1dfb66] * _0x5be949;
        }
        return _0xc8ccc1;
      };
      _0x4e4ab8.prototype.readUIntBE = function _0x2e98a4(_0x4cd6e9, _0x35feeb, _0x47b953) {
        _0x4cd6e9 = _0x4cd6e9 | 0;
        _0x35feeb = _0x35feeb | 0;
        if (!_0x47b953) {
          _0x10cfb7(_0x4cd6e9, _0x35feeb, this.length);
        }
        var _0x13437f = this[_0x4cd6e9 + --_0x35feeb];
        var _0x31dae7 = 1;
        while (_0x35feeb > 0 && (_0x31dae7 *= 256)) {
          _0x13437f += this[_0x4cd6e9 + --_0x35feeb] * _0x31dae7;
        }
        return _0x13437f;
      };
      _0x4e4ab8.prototype.readUInt8 = function _0x35db47(_0x300147, _0x46ba5d) {
        if (!_0x46ba5d) {
          _0x10cfb7(_0x300147, 1, this.length);
        }
        return this[_0x300147];
      };
      _0x4e4ab8.prototype.readUInt16LE = function _0x159097(_0x49b359, _0x5cce04) {
        if (!_0x5cce04) {
          _0x10cfb7(_0x49b359, 2, this.length);
        }
        return this[_0x49b359] | this[_0x49b359 + 1] << 8;
      };
      _0x4e4ab8.prototype.readUInt16BE = function _0x547d07(_0x5906e6, _0x3e1302) {
        if (!_0x3e1302) {
          _0x10cfb7(_0x5906e6, 2, this.length);
        }
        return this[_0x5906e6] << 8 | this[_0x5906e6 + 1];
      };
      _0x4e4ab8.prototype.readUInt32LE = function _0x20cbac(_0x34fc6e, _0x104e3e) {
        if (!_0x104e3e) {
          _0x10cfb7(_0x34fc6e, 4, this.length);
        }
        return (this[_0x34fc6e] | this[_0x34fc6e + 1] << 8 | this[_0x34fc6e + 2] << 16) + this[_0x34fc6e + 3] * 16777216;
      };
      _0x4e4ab8.prototype.readUInt32BE = function _0x197317(_0x4919f3, _0x519f23) {
        if (!_0x519f23) {
          _0x10cfb7(_0x4919f3, 4, this.length);
        }
        return this[_0x4919f3] * 16777216 + (this[_0x4919f3 + 1] << 16 | this[_0x4919f3 + 2] << 8 | this[_0x4919f3 + 3]);
      };
      _0x4e4ab8.prototype.readIntLE = function _0x34cfda(_0x5871a4, _0x314d1b, _0x4cd479) {
        _0x5871a4 = _0x5871a4 | 0;
        _0x314d1b = _0x314d1b | 0;
        if (!_0x4cd479) {
          _0x10cfb7(_0x5871a4, _0x314d1b, this.length);
        }
        var _0x1a259c = this[_0x5871a4];
        var _0x38288c = 1;
        var _0x37094f = 0;
        while (++_0x37094f < _0x314d1b && (_0x38288c *= 256)) {
          _0x1a259c += this[_0x5871a4 + _0x37094f] * _0x38288c;
        }
        _0x38288c *= 128;
        if (_0x1a259c >= _0x38288c) {
          _0x1a259c -= Math.pow(2, 8 * _0x314d1b);
        }
        return _0x1a259c;
      };
      _0x4e4ab8.prototype.readIntBE = function _0x57547f(_0x54f77f, _0x16e368, _0xa0d031) {
        _0x54f77f = _0x54f77f | 0;
        _0x16e368 = _0x16e368 | 0;
        if (!_0xa0d031) {
          _0x10cfb7(_0x54f77f, _0x16e368, this.length);
        }
        var _0x1a30f9 = _0x16e368;
        var _0x3a7f32 = 1;
        var _0x469c9f = this[_0x54f77f + --_0x1a30f9];
        while (_0x1a30f9 > 0 && (_0x3a7f32 *= 256)) {
          _0x469c9f += this[_0x54f77f + --_0x1a30f9] * _0x3a7f32;
        }
        _0x3a7f32 *= 128;
        if (_0x469c9f >= _0x3a7f32) {
          _0x469c9f -= Math.pow(2, 8 * _0x16e368);
        }
        return _0x469c9f;
      };
      _0x4e4ab8.prototype.readInt8 = function _0x56a2cf(_0x32cba7, _0xcb8a40) {
        if (!_0xcb8a40) {
          _0x10cfb7(_0x32cba7, 1, this.length);
        }
        if (!(this[_0x32cba7] & 128)) {
          return this[_0x32cba7];
        }
        return (255 - this[_0x32cba7] + 1) * -1;
      };
      _0x4e4ab8.prototype.readInt16LE = function _0x50d295(_0x4a1d11, _0x57eb9d) {
        if (!_0x57eb9d) {
          _0x10cfb7(_0x4a1d11, 2, this.length);
        }
        var _0x2d5faa = this[_0x4a1d11] | this[_0x4a1d11 + 1] << 8;
        return _0x2d5faa & 32768 ? _0x2d5faa | 4294901760 : _0x2d5faa;
      };
      _0x4e4ab8.prototype.readInt16BE = function _0x2cf7d2(_0x35ee01, _0x2e825d) {
        if (!_0x2e825d) {
          _0x10cfb7(_0x35ee01, 2, this.length);
        }
        var _0x1c2b9c = this[_0x35ee01 + 1] | this[_0x35ee01] << 8;
        return _0x1c2b9c & 32768 ? _0x1c2b9c | 4294901760 : _0x1c2b9c;
      };
      _0x4e4ab8.prototype.readInt32LE = function _0x488b0c(_0x44c8f0, _0x3eaefc) {
        if (!_0x3eaefc) {
          _0x10cfb7(_0x44c8f0, 4, this.length);
        }
        return this[_0x44c8f0] | this[_0x44c8f0 + 1] << 8 | this[_0x44c8f0 + 2] << 16 | this[_0x44c8f0 + 3] << 24;
      };
      _0x4e4ab8.prototype.readInt32BE = function _0x20cd48(_0x429697, _0xa36d12) {
        if (!_0xa36d12) {
          _0x10cfb7(_0x429697, 4, this.length);
        }
        return this[_0x429697] << 24 | this[_0x429697 + 1] << 16 | this[_0x429697 + 2] << 8 | this[_0x429697 + 3];
      };
      _0x4e4ab8.prototype.readFloatLE = function _0x39641d(_0x3952b5, _0x2fcfb5) {
        if (!_0x2fcfb5) {
          _0x10cfb7(_0x3952b5, 4, this.length);
        }
        return _0x53bb62.read(this, _0x3952b5, true, 23, 4);
      };
      _0x4e4ab8.prototype.readFloatBE = function _0x316d63(_0x4019e8, _0x169764) {
        if (!_0x169764) {
          _0x10cfb7(_0x4019e8, 4, this.length);
        }
        return _0x53bb62.read(this, _0x4019e8, false, 23, 4);
      };
      _0x4e4ab8.prototype.readDoubleLE = function _0x4cd315(_0x48ff8, _0x626662) {
        if (!_0x626662) {
          _0x10cfb7(_0x48ff8, 8, this.length);
        }
        return _0x53bb62.read(this, _0x48ff8, true, 52, 8);
      };
      _0x4e4ab8.prototype.readDoubleBE = function _0x1fd1ef(_0x386637, _0x50ef2a) {
        if (!_0x50ef2a) {
          _0x10cfb7(_0x386637, 8, this.length);
        }
        return _0x53bb62.read(this, _0x386637, false, 52, 8);
      };
      function _0x4bcf82(_0x184428, _0x2738ad, _0x11bd78, _0x199a5c, _0x3efed0, _0x1efab1) {
        if (!_0x4e4ab8.isBuffer(_0x184428)) {
          throw new TypeError("\"buffer\" argument must be a Buffer instance");
        }
        if (_0x2738ad > _0x3efed0 || _0x2738ad < _0x1efab1) {
          throw new RangeError("\"value\" argument is out of bounds");
        }
        if (_0x11bd78 + _0x199a5c > _0x184428.length) {
          throw new RangeError("Index out of range");
        }
      }
      _0x4e4ab8.prototype.writeUIntLE = function _0x153b04(_0x5964c4, _0x5328c5, _0x1e7d6f, _0x170b48) {
        _0x5964c4 = +_0x5964c4;
        _0x5328c5 = _0x5328c5 | 0;
        _0x1e7d6f = _0x1e7d6f | 0;
        if (!_0x170b48) {
          var _0x2e3459 = Math.pow(2, 8 * _0x1e7d6f) - 1;
          _0x4bcf82(this, _0x5964c4, _0x5328c5, _0x1e7d6f, _0x2e3459, 0);
        }
        var _0x34cfd9 = 1;
        var _0x45c180 = 0;
        this[_0x5328c5] = _0x5964c4 & 255;
        while (++_0x45c180 < _0x1e7d6f && (_0x34cfd9 *= 256)) {
          this[_0x5328c5 + _0x45c180] = _0x5964c4 / _0x34cfd9 & 255;
        }
        return _0x5328c5 + _0x1e7d6f;
      };
      _0x4e4ab8.prototype.writeUIntBE = function _0x3635fa(_0x43e6ca, _0x10e983, _0x5a4b04, _0x1e31fb) {
        _0x43e6ca = +_0x43e6ca;
        _0x10e983 = _0x10e983 | 0;
        _0x5a4b04 = _0x5a4b04 | 0;
        if (!_0x1e31fb) {
          var _0x5a77ae = Math.pow(2, 8 * _0x5a4b04) - 1;
          _0x4bcf82(this, _0x43e6ca, _0x10e983, _0x5a4b04, _0x5a77ae, 0);
        }
        var _0x26bd7a = _0x5a4b04 - 1;
        var _0x4a39ae = 1;
        this[_0x10e983 + _0x26bd7a] = _0x43e6ca & 255;
        while (--_0x26bd7a >= 0 && (_0x4a39ae *= 256)) {
          this[_0x10e983 + _0x26bd7a] = _0x43e6ca / _0x4a39ae & 255;
        }
        return _0x10e983 + _0x5a4b04;
      };
      _0x4e4ab8.prototype.writeUInt8 = function _0x2d2cf8(_0x553142, _0x18668f, _0x40ee83) {
        _0x553142 = +_0x553142;
        _0x18668f = _0x18668f | 0;
        if (!_0x40ee83) {
          _0x4bcf82(this, _0x553142, _0x18668f, 1, 255, 0);
        }
        if (!_0x4e4ab8.TYPED_ARRAY_SUPPORT) {
          _0x553142 = Math.floor(_0x553142);
        }
        this[_0x18668f] = _0x553142 & 255;
        return _0x18668f + 1;
      };
      function _0x8fabf2(_0x4abddd, _0x48b8b6, _0x52c6a1, _0x3ddff9) {
        if (_0x48b8b6 < 0) {
          _0x48b8b6 = 65535 + _0x48b8b6 + 1;
        }
        for (var _0x3a8410 = 0, _0x3191a8 = Math.min(_0x4abddd.length - _0x52c6a1, 2); _0x3a8410 < _0x3191a8; ++_0x3a8410) {
          _0x4abddd[_0x52c6a1 + _0x3a8410] = (_0x48b8b6 & 255 << 8 * (_0x3ddff9 ? _0x3a8410 : 1 - _0x3a8410)) >>> (_0x3ddff9 ? _0x3a8410 : 1 - _0x3a8410) * 8;
        }
      }
      _0x4e4ab8.prototype.writeUInt16LE = function _0x192129(_0x1571d8, _0x7a3d76, _0x40d449) {
        _0x1571d8 = +_0x1571d8;
        _0x7a3d76 = _0x7a3d76 | 0;
        if (!_0x40d449) {
          _0x4bcf82(this, _0x1571d8, _0x7a3d76, 2, 65535, 0);
        }
        if (_0x4e4ab8.TYPED_ARRAY_SUPPORT) {
          this[_0x7a3d76] = _0x1571d8 & 255;
          this[_0x7a3d76 + 1] = _0x1571d8 >>> 8;
        } else {
          _0x8fabf2(this, _0x1571d8, _0x7a3d76, true);
        }
        return _0x7a3d76 + 2;
      };
      _0x4e4ab8.prototype.writeUInt16BE = function _0x20d01e(_0x2f9f17, _0x2f17aa, _0x331087) {
        _0x2f9f17 = +_0x2f9f17;
        _0x2f17aa = _0x2f17aa | 0;
        if (!_0x331087) {
          _0x4bcf82(this, _0x2f9f17, _0x2f17aa, 2, 65535, 0);
        }
        if (_0x4e4ab8.TYPED_ARRAY_SUPPORT) {
          this[_0x2f17aa] = _0x2f9f17 >>> 8, this[_0x2f17aa + 1] = _0x2f9f17 & 255;
        } else {
          _0x8fabf2(this, _0x2f9f17, _0x2f17aa, false);
        }
        return _0x2f17aa + 2;
      };
      function _0x39ffb1(_0xdf0d91, _0x488c1f, _0x12b850, _0x57b952) {
        if (_0x488c1f < 0) {
          _0x488c1f = 4294967295 + _0x488c1f + 1;
        }
        for (var _0x51019c = 0, _0x18d570 = Math.min(_0xdf0d91.length - _0x12b850, 4); _0x51019c < _0x18d570; ++_0x51019c) {
          _0xdf0d91[_0x12b850 + _0x51019c] = _0x488c1f >>> (_0x57b952 ? _0x51019c : 3 - _0x51019c) * 8 & 255;
        }
      }
      _0x4e4ab8.prototype.writeUInt32LE = function _0x263e5c(_0x340f0c, _0x1a0f0c, _0x449165) {
        _0x340f0c = +_0x340f0c;
        _0x1a0f0c = _0x1a0f0c | 0;
        if (!_0x449165) {
          _0x4bcf82(this, _0x340f0c, _0x1a0f0c, 4, 4294967295, 0);
        }
        if (_0x4e4ab8.TYPED_ARRAY_SUPPORT) {
          this[_0x1a0f0c + 3] = _0x340f0c >>> 24;
          this[_0x1a0f0c + 2] = _0x340f0c >>> 16;
          this[_0x1a0f0c + 1] = _0x340f0c >>> 8;
          this[_0x1a0f0c] = _0x340f0c & 255;
        } else {
          _0x39ffb1(this, _0x340f0c, _0x1a0f0c, true);
        }
        return _0x1a0f0c + 4;
      };
      _0x4e4ab8.prototype.writeUInt32BE = function _0x1a9fb6(_0x1562e6, _0x4718c3, _0x14786a) {
        _0x1562e6 = +_0x1562e6;
        _0x4718c3 = _0x4718c3 | 0;
        if (!_0x14786a) {
          _0x4bcf82(this, _0x1562e6, _0x4718c3, 4, 4294967295, 0);
        }
        if (_0x4e4ab8.TYPED_ARRAY_SUPPORT) {
          this[_0x4718c3] = _0x1562e6 >>> 24;
          this[_0x4718c3 + 1] = _0x1562e6 >>> 16;
          this[_0x4718c3 + 2] = _0x1562e6 >>> 8;
          this[_0x4718c3 + 3] = _0x1562e6 & 255;
        } else {
          _0x39ffb1(this, _0x1562e6, _0x4718c3, false);
        }
        return _0x4718c3 + 4;
      };
      _0x4e4ab8.prototype.writeIntLE = function _0x5764fb(_0xcab6d0, _0x2bfeae, _0x518c3f, _0x9caf5d) {
        _0xcab6d0 = +_0xcab6d0;
        _0x2bfeae = _0x2bfeae | 0;
        if (!_0x9caf5d) {
          var _0x198060 = Math.pow(2, 8 * _0x518c3f - 1);
          _0x4bcf82(this, _0xcab6d0, _0x2bfeae, _0x518c3f, _0x198060 - 1, -_0x198060);
        }
        var _0x4ee619 = 0;
        var _0x3bebce = 1;
        var _0x505205 = 0;
        this[_0x2bfeae] = _0xcab6d0 & 255;
        while (++_0x4ee619 < _0x518c3f && (_0x3bebce *= 256)) {
          _0xcab6d0 < 0 && _0x505205 === 0 && this[_0x2bfeae + _0x4ee619 - 1] !== 0 && (_0x505205 = 1), this[_0x2bfeae + _0x4ee619] = (_0xcab6d0 / _0x3bebce >> 0) - _0x505205 & 255;
        }
        return _0x2bfeae + _0x518c3f;
      };
      _0x4e4ab8.prototype.writeIntBE = function _0x2db7be(_0x8e0d98, _0xbe3206, _0x385ecb, _0xc08bb0) {
        _0x8e0d98 = +_0x8e0d98;
        _0xbe3206 = _0xbe3206 | 0;
        if (!_0xc08bb0) {
          var _0x9e5821 = Math.pow(2, 8 * _0x385ecb - 1);
          _0x4bcf82(this, _0x8e0d98, _0xbe3206, _0x385ecb, _0x9e5821 - 1, -_0x9e5821);
        }
        var _0x210267 = _0x385ecb - 1;
        var _0x2f0c4d = 1;
        var _0xb75547 = 0;
        this[_0xbe3206 + _0x210267] = _0x8e0d98 & 255;
        while (--_0x210267 >= 0 && (_0x2f0c4d *= 256)) {
          _0x8e0d98 < 0 && _0xb75547 === 0 && this[_0xbe3206 + _0x210267 + 1] !== 0 && (_0xb75547 = 1), this[_0xbe3206 + _0x210267] = (_0x8e0d98 / _0x2f0c4d >> 0) - _0xb75547 & 255;
        }
        return _0xbe3206 + _0x385ecb;
      };
      _0x4e4ab8.prototype.writeInt8 = function _0x305e4d(_0x145155, _0x4b7ad2, _0x2d9449) {
        _0x145155 = +_0x145155;
        _0x4b7ad2 = _0x4b7ad2 | 0;
        if (!_0x2d9449) {
          _0x4bcf82(this, _0x145155, _0x4b7ad2, 1, 127, -128);
        }
        if (!_0x4e4ab8.TYPED_ARRAY_SUPPORT) {
          _0x145155 = Math.floor(_0x145155);
        }
        if (_0x145155 < 0) {
          _0x145155 = 255 + _0x145155 + 1;
        }
        this[_0x4b7ad2] = _0x145155 & 255;
        return _0x4b7ad2 + 1;
      };
      _0x4e4ab8.prototype.writeInt16LE = function _0x395d81(_0x7481b2, _0x190fbc, _0x15dd36) {
        _0x7481b2 = +_0x7481b2;
        _0x190fbc = _0x190fbc | 0;
        if (!_0x15dd36) {
          _0x4bcf82(this, _0x7481b2, _0x190fbc, 2, 32767, -32768);
        }
        if (_0x4e4ab8.TYPED_ARRAY_SUPPORT) {
          this[_0x190fbc] = _0x7481b2 & 255, this[_0x190fbc + 1] = _0x7481b2 >>> 8;
        } else {
          _0x8fabf2(this, _0x7481b2, _0x190fbc, true);
        }
        return _0x190fbc + 2;
      };
      _0x4e4ab8.prototype.writeInt16BE = function _0x1dff46(_0x5be114, _0x2aa9f4, _0x34e8d0) {
        _0x5be114 = +_0x5be114;
        _0x2aa9f4 = _0x2aa9f4 | 0;
        if (!_0x34e8d0) {
          _0x4bcf82(this, _0x5be114, _0x2aa9f4, 2, 32767, -32768);
        }
        if (_0x4e4ab8.TYPED_ARRAY_SUPPORT) {
          this[_0x2aa9f4] = _0x5be114 >>> 8, this[_0x2aa9f4 + 1] = _0x5be114 & 255;
        } else {
          _0x8fabf2(this, _0x5be114, _0x2aa9f4, false);
        }
        return _0x2aa9f4 + 2;
      };
      _0x4e4ab8.prototype.writeInt32LE = function _0x5bc461(_0x409aa2, _0x364a48, _0x39fa7c) {
        _0x409aa2 = +_0x409aa2;
        _0x364a48 = _0x364a48 | 0;
        if (!_0x39fa7c) {
          _0x4bcf82(this, _0x409aa2, _0x364a48, 4, 2147483647, -2147483648);
        }
        if (_0x4e4ab8.TYPED_ARRAY_SUPPORT) {
          this[_0x364a48] = _0x409aa2 & 255, this[_0x364a48 + 1] = _0x409aa2 >>> 8, this[_0x364a48 + 2] = _0x409aa2 >>> 16, this[_0x364a48 + 3] = _0x409aa2 >>> 24;
        } else {
          _0x39ffb1(this, _0x409aa2, _0x364a48, true);
        }
        return _0x364a48 + 4;
      };
      _0x4e4ab8.prototype.writeInt32BE = function _0x270683(_0x414cde, _0x27838b, _0x5ec25b) {
        _0x414cde = +_0x414cde;
        _0x27838b = _0x27838b | 0;
        if (!_0x5ec25b) {
          _0x4bcf82(this, _0x414cde, _0x27838b, 4, 2147483647, -2147483648);
        }
        if (_0x414cde < 0) {
          _0x414cde = 4294967295 + _0x414cde + 1;
        }
        if (_0x4e4ab8.TYPED_ARRAY_SUPPORT) {
          this[_0x27838b] = _0x414cde >>> 24, this[_0x27838b + 1] = _0x414cde >>> 16, this[_0x27838b + 2] = _0x414cde >>> 8, this[_0x27838b + 3] = _0x414cde & 255;
        } else {
          _0x39ffb1(this, _0x414cde, _0x27838b, false);
        }
        return _0x27838b + 4;
      };
      function _0x429751(_0x47cab1, _0x2edf09, _0x24113e, _0x3b1d13, _0x445b37, _0xb80d11) {
        if (_0x24113e + _0x3b1d13 > _0x47cab1.length) {
          throw new RangeError("Index out of range");
        }
        if (_0x24113e < 0) {
          throw new RangeError("Index out of range");
        }
      }
      function _0x4020cf(_0x1def1d, _0x103602, _0x13b846, _0x153f03, _0x405b39) {
        if (!_0x405b39) {
          _0x429751(_0x1def1d, _0x103602, _0x13b846, 4, 0xffffff00000000000000000000000000, -0xffffff00000000000000000000000000);
        }
        _0x53bb62.write(_0x1def1d, _0x103602, _0x13b846, _0x153f03, 23, 4);
        return _0x13b846 + 4;
      }
      _0x4e4ab8.prototype.writeFloatLE = function _0x33a30(_0x176f18, _0x2863c8, _0x257899) {
        return _0x4020cf(this, _0x176f18, _0x2863c8, true, _0x257899);
      };
      _0x4e4ab8.prototype.writeFloatBE = function _0x3aa486(_0x598d15, _0x2b2ced, _0x5caafc) {
        return _0x4020cf(this, _0x598d15, _0x2b2ced, false, _0x5caafc);
      };
      function _0x18e3b5(_0x2555db, _0x3329e8, _0x1bda57, _0x2e56c3, _0x12be4f) {
        if (!_0x12be4f) {
          _0x429751(_0x2555db, _0x3329e8, _0x1bda57, 8, 0xfffffffffffff800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000, -0xfffffffffffff800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000);
        }
        _0x53bb62.write(_0x2555db, _0x3329e8, _0x1bda57, _0x2e56c3, 52, 8);
        return _0x1bda57 + 8;
      }
      _0x4e4ab8.prototype.writeDoubleLE = function _0xfb1eb7(_0x4e5d90, _0x3ec1f5, _0x183222) {
        return _0x18e3b5(this, _0x4e5d90, _0x3ec1f5, true, _0x183222);
      };
      _0x4e4ab8.prototype.writeDoubleBE = function _0x5f14f6(_0x31bfb9, _0x56ecfe, _0x3761da) {
        return _0x18e3b5(this, _0x31bfb9, _0x56ecfe, false, _0x3761da);
      };
      _0x4e4ab8.prototype.copy = function _0x2df3ea(_0x9dfa22, _0x268e8c, _0x2ca3fa, _0x6bb00d) {
        if (!_0x2ca3fa) {
          _0x2ca3fa = 0;
        }
        if (!_0x6bb00d && _0x6bb00d !== 0) {
          _0x6bb00d = this.length;
        }
        if (_0x268e8c >= _0x9dfa22.length) {
          _0x268e8c = _0x9dfa22.length;
        }
        if (!_0x268e8c) {
          _0x268e8c = 0;
        }
        if (_0x6bb00d > 0 && _0x6bb00d < _0x2ca3fa) {
          _0x6bb00d = _0x2ca3fa;
        }
        if (_0x6bb00d === _0x2ca3fa) {
          return 0;
        }
        if (_0x9dfa22.length === 0 || this.length === 0) {
          return 0;
        }
        if (_0x268e8c < 0) {
          throw new RangeError("targetStart out of bounds");
        }
        if (_0x2ca3fa < 0 || _0x2ca3fa >= this.length) {
          throw new RangeError("sourceStart out of bounds");
        }
        if (_0x6bb00d < 0) {
          throw new RangeError("sourceEnd out of bounds");
        }
        if (_0x6bb00d > this.length) {
          _0x6bb00d = this.length;
        }
        if (_0x9dfa22.length - _0x268e8c < _0x6bb00d - _0x2ca3fa) {
          _0x6bb00d = _0x9dfa22.length - _0x268e8c + _0x2ca3fa;
        }
        var _0x37c462 = _0x6bb00d - _0x2ca3fa;
        var _0x121f70;
        if (this === _0x9dfa22 && _0x2ca3fa < _0x268e8c && _0x268e8c < _0x6bb00d) {
          for (_0x121f70 = _0x37c462 - 1; _0x121f70 >= 0; --_0x121f70) {
            _0x9dfa22[_0x121f70 + _0x268e8c] = this[_0x121f70 + _0x2ca3fa];
          }
        } else {
          if (_0x37c462 < 1000 || !_0x4e4ab8.TYPED_ARRAY_SUPPORT) {
            for (_0x121f70 = 0; _0x121f70 < _0x37c462; ++_0x121f70) {
              _0x9dfa22[_0x121f70 + _0x268e8c] = this[_0x121f70 + _0x2ca3fa];
            }
          } else {
            Uint8Array.prototype.set.call(_0x9dfa22, this.subarray(_0x2ca3fa, _0x2ca3fa + _0x37c462), _0x268e8c);
          }
        }
        return _0x37c462;
      };
      _0x4e4ab8.prototype.fill = function _0xd3af3f(_0x4d692d, _0x5b27ff, _0x45ef54, _0x2ac161) {
        if (typeof _0x4d692d === "string") {
          if (typeof _0x5b27ff === "string") {
            _0x2ac161 = _0x5b27ff, _0x5b27ff = 0, _0x45ef54 = this.length;
          } else {
            typeof _0x45ef54 === "string" && (_0x2ac161 = _0x45ef54, _0x45ef54 = this.length);
          }
          if (_0x4d692d.length === 1) {
            var _0x43991a = _0x4d692d.charCodeAt(0);
            _0x43991a < 256 && (_0x4d692d = _0x43991a);
          }
          if (_0x2ac161 !== undefined && typeof _0x2ac161 !== "string") {
            throw new TypeError("encoding must be a string");
          }
          if (typeof _0x2ac161 === "string" && !_0x4e4ab8.isEncoding(_0x2ac161)) {
            throw new TypeError("Unknown encoding: " + _0x2ac161);
          }
        } else {
          if (typeof _0x4d692d === "number") {
            _0x4d692d = _0x4d692d & 255;
          }
        }
        if (_0x5b27ff < 0 || this.length < _0x5b27ff || this.length < _0x45ef54) {
          throw new RangeError("Out of range index");
        }
        if (_0x45ef54 <= _0x5b27ff) {
          return this;
        }
        _0x5b27ff = _0x5b27ff >>> 0;
        _0x45ef54 = _0x45ef54 === undefined ? this.length : _0x45ef54 >>> 0;
        if (!_0x4d692d) {
          _0x4d692d = 0;
        }
        var _0x10b846;
        if (typeof _0x4d692d === "number") {
          for (_0x10b846 = _0x5b27ff; _0x10b846 < _0x45ef54; ++_0x10b846) {
            this[_0x10b846] = _0x4d692d;
          }
        } else {
          var _0x346005 = _0x4e4ab8.isBuffer(_0x4d692d) ? _0x4d692d : _0x17a853(new _0x4e4ab8(_0x4d692d, _0x2ac161).toString());
          var _0x24963a = _0x346005.length;
          for (_0x10b846 = 0; _0x10b846 < _0x45ef54 - _0x5b27ff; ++_0x10b846) {
            this[_0x10b846 + _0x5b27ff] = _0x346005[_0x10b846 % _0x24963a];
          }
        }
        return this;
      };
      var _0x2f166a = /[^+\/0-9A-Za-z-_]/g;
      function _0x1cb748(_0x227137) {
        _0x227137 = _0x2068c0(_0x227137).replace(_0x2f166a, '');
        if (_0x227137.length < 2) {
          return '';
        }
        while (_0x227137.length % 4 !== 0) {
          _0x227137 = _0x227137 + '=';
        }
        return _0x227137;
      }
      function _0x2068c0(_0xbca62b) {
        if (_0xbca62b.trim) {
          return _0xbca62b.trim();
        }
        return _0xbca62b.replace(/^\s+|\s+$/g, '');
      }
      function _0x2e32d7(_0x1c1204) {
        if (_0x1c1204 < 16) {
          return '0' + _0x1c1204.toString(16);
        }
        return _0x1c1204.toString(16);
      }
      function _0x17a853(_0x9c0412, _0x419f77) {
        _0x419f77 = _0x419f77 || Infinity;
        var _0x5928a7;
        var _0x5bbcfc = _0x9c0412.length;
        var _0x57f120 = null;
        var _0x3c6c9d = [];
        for (var _0x3bd3ed = 0; _0x3bd3ed < _0x5bbcfc; ++_0x3bd3ed) {
          _0x5928a7 = _0x9c0412.charCodeAt(_0x3bd3ed);
          if (_0x5928a7 > 55295 && _0x5928a7 < 57344) {
            if (!_0x57f120) {
              if (_0x5928a7 > 56319) {
                if ((_0x419f77 -= 3) > -1) {
                  _0x3c6c9d.push(239, 191, 189);
                }
                continue;
              } else {
                if (_0x3bd3ed + 1 === _0x5bbcfc) {
                  if ((_0x419f77 -= 3) > -1) {
                    _0x3c6c9d.push(239, 191, 189);
                  }
                  continue;
                }
              }
              _0x57f120 = _0x5928a7;
              continue;
            }
            if (_0x5928a7 < 56320) {
              if ((_0x419f77 -= 3) > -1) {
                _0x3c6c9d.push(239, 191, 189);
              }
              _0x57f120 = _0x5928a7;
              continue;
            }
            _0x5928a7 = (_0x57f120 - 55296 << 10 | _0x5928a7 - 56320) + 65536;
          } else {
            if (_0x57f120) {
              if ((_0x419f77 -= 3) > -1) {
                _0x3c6c9d.push(239, 191, 189);
              }
            }
          }
          _0x57f120 = null;
          if (_0x5928a7 < 128) {
            if ((_0x419f77 -= 1) < 0) {
              break;
            }
            _0x3c6c9d.push(_0x5928a7);
          } else {
            if (_0x5928a7 < 2048) {
              if ((_0x419f77 -= 2) < 0) {
                break;
              }
              _0x3c6c9d.push(_0x5928a7 >> 6 | 192, _0x5928a7 & 63 | 128);
            } else {
              if (_0x5928a7 < 65536) {
                if ((_0x419f77 -= 3) < 0) {
                  break;
                }
                _0x3c6c9d.push(_0x5928a7 >> 12 | 224, _0x5928a7 >> 6 & 63 | 128, _0x5928a7 & 63 | 128);
              } else {
                if (_0x5928a7 < 1114112) {
                  if ((_0x419f77 -= 4) < 0) {
                    break;
                  }
                  _0x3c6c9d.push(_0x5928a7 >> 18 | 240, _0x5928a7 >> 12 & 63 | 128, _0x5928a7 >> 6 & 63 | 128, _0x5928a7 & 63 | 128);
                } else {
                  throw new Error("Invalid code point");
                }
              }
            }
          }
        }
        return _0x3c6c9d;
      }
      function _0x593c41(_0x40588a) {
        var _0xd4c3da = [];
        for (var _0x3b67f5 = 0; _0x3b67f5 < _0x40588a.length; ++_0x3b67f5) {
          _0xd4c3da.push(_0x40588a.charCodeAt(_0x3b67f5) & 255);
        }
        return _0xd4c3da;
      }
      function _0x111516(_0x1540b2, _0x44a7d3) {
        var _0x9ebacc;
        var _0x268367;
        var _0x180bab;
        var _0x2e72c9 = [];
        for (var _0x3fe9bf = 0; _0x3fe9bf < _0x1540b2.length; ++_0x3fe9bf) {
          if ((_0x44a7d3 -= 2) < 0) {
            break;
          }
          _0x9ebacc = _0x1540b2.charCodeAt(_0x3fe9bf);
          _0x268367 = _0x9ebacc >> 8;
          _0x180bab = _0x9ebacc % 256;
          _0x2e72c9.push(_0x180bab);
          _0x2e72c9.push(_0x268367);
        }
        return _0x2e72c9;
      }
      function _0xbe1208(_0x558b5b) {
        return _0xe67086.toByteArray(_0x1cb748(_0x558b5b));
      }
      function _0x46abe6(_0x213983, _0x510397, _0x391ef0, _0x571e79) {
        for (var _0x4881b4 = 0; _0x4881b4 < _0x571e79; ++_0x4881b4) {
          if (_0x4881b4 + _0x391ef0 >= _0x510397.length || _0x4881b4 >= _0x213983.length) {
            break;
          }
          _0x510397[_0x4881b4 + _0x391ef0] = _0x213983[_0x4881b4];
        }
        return _0x4881b4;
      }
      function _0x177470(_0x20bcf5) {
        return _0x20bcf5 !== _0x20bcf5;
      }
    }).call(this, _0x5cea5b("./node_modules/webpack/buildin/global.js"));
  },
  './node_modules/buffer/node_modules/isarray/index.js': function (_0x4c0a3d, _0x4b87c7) {
    var _0x91f99b = {}.toString;
    _0x4c0a3d.exports = Array.isArray || function (_0xadb608) {
      return _0x91f99b.call(_0xadb608) == "[object Array]";
    };
  },
  './node_modules/charenc/charenc.js': function (_0x17a745, _0x2dd355) {
    var _0x57bfea = {
      utf8: {
        stringToBytes: function (_0x493337) {
          return _0x57bfea.bin.stringToBytes(unescape(encodeURIComponent(_0x493337)));
        },
        bytesToString: function (_0x154982) {
          return decodeURIComponent(escape(_0x57bfea.bin.bytesToString(_0x154982)));
        }
      },
      bin: {
        stringToBytes: function (_0x1fb70a) {
          for (var _0x93ead5 = [], _0x2c28de = 0; _0x2c28de < _0x1fb70a.length; _0x2c28de++) {
            _0x93ead5.push(_0x1fb70a.charCodeAt(_0x2c28de) & 255);
          }
          return _0x93ead5;
        },
        bytesToString: function (_0x20c768) {
          for (var _0x2e0965 = [], _0x358e9c = 0; _0x358e9c < _0x20c768.length; _0x358e9c++) {
            _0x2e0965.push(String.fromCharCode(_0x20c768[_0x358e9c]));
          }
          return _0x2e0965.join('');
        }
      }
    };
    _0x17a745.exports = _0x57bfea;
  },
  './node_modules/crypt/crypt.js': function (_0x1ffde0, _0x3cc264) {
    (function () {
      var _0x590429 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      var _0x8f0fcd = {
        rotl: function (_0x27c62f, _0x166545) {
          return _0x27c62f << _0x166545 | _0x27c62f >>> 32 - _0x166545;
        },
        rotr: function (_0x220e79, _0x21c8ac) {
          return _0x220e79 << 32 - _0x21c8ac | _0x220e79 >>> _0x21c8ac;
        },
        endian: function (_0x2e380d) {
          if (_0x2e380d.constructor == Number) {
            return _0x8f0fcd.rotl(_0x2e380d, 8) & 16711935 | _0x8f0fcd.rotl(_0x2e380d, 24) & 4278255360;
          }
          for (var _0x29a4dc = 0; _0x29a4dc < _0x2e380d.length; _0x29a4dc++) {
            _0x2e380d[_0x29a4dc] = _0x8f0fcd.endian(_0x2e380d[_0x29a4dc]);
          }
          return _0x2e380d;
        },
        randomBytes: function (_0x44ec24) {
          for (var _0x551063 = []; _0x44ec24 > 0; _0x44ec24--) {
            _0x551063.push(Math.floor(Math.random() * 256));
          }
          return _0x551063;
        },
        bytesToWords: function (_0x5ceb94) {
          for (var _0x495beb = [], _0x199bb9 = 0, _0x40e74d = 0; _0x199bb9 < _0x5ceb94.length; _0x199bb9++, _0x40e74d += 8) {
            _0x495beb[_0x40e74d >>> 5] |= _0x5ceb94[_0x199bb9] << 24 - _0x40e74d % 32;
          }
          return _0x495beb;
        },
        wordsToBytes: function (_0x13501f) {
          for (var _0x443285 = [], _0xef4d10 = 0; _0xef4d10 < _0x13501f.length * 32; _0xef4d10 += 8) {
            _0x443285.push(_0x13501f[_0xef4d10 >>> 5] >>> 24 - _0xef4d10 % 32 & 255);
          }
          return _0x443285;
        },
        bytesToHex: function (_0x5c88de) {
          for (var _0x4cdf08 = [], _0x241b20 = 0; _0x241b20 < _0x5c88de.length; _0x241b20++) {
            _0x4cdf08.push((_0x5c88de[_0x241b20] >>> 4).toString(16)), _0x4cdf08.push((_0x5c88de[_0x241b20] & 15).toString(16));
          }
          return _0x4cdf08.join('');
        },
        hexToBytes: function (_0x422b05) {
          for (var _0x410984 = [], _0x4d3953 = 0; _0x4d3953 < _0x422b05.length; _0x4d3953 += 2) {
            _0x410984.push(parseInt(_0x422b05.substr(_0x4d3953, 2), 16));
          }
          return _0x410984;
        },
        bytesToBase64: function (_0x193d3e) {
          for (var _0x5c91bf = [], _0x240c0a = 0; _0x240c0a < _0x193d3e.length; _0x240c0a += 3) {
            var _0x3d8368 = _0x193d3e[_0x240c0a] << 16 | _0x193d3e[_0x240c0a + 1] << 8 | _0x193d3e[_0x240c0a + 2];
            for (var _0x50d27a = 0; _0x50d27a < 4; _0x50d27a++) {
              if (_0x240c0a * 8 + _0x50d27a * 6 <= _0x193d3e.length * 8) {
                _0x5c91bf.push(_0x590429.charAt(_0x3d8368 >>> 6 * (3 - _0x50d27a) & 63));
              } else {
                _0x5c91bf.push('=');
              }
            }
          }
          return _0x5c91bf.join('');
        },
        base64ToBytes: function (_0x5050d9) {
          _0x5050d9 = _0x5050d9.replace(/[^A-Z0-9+\/]/ig, '');
          for (var _0x58891a = [], _0x15cbbb = 0, _0x308478 = 0; _0x15cbbb < _0x5050d9.length; _0x308478 = ++_0x15cbbb % 4) {
            if (_0x308478 == 0) {
              continue;
            }
            _0x58891a.push((_0x590429.indexOf(_0x5050d9.charAt(_0x15cbbb - 1)) & Math.pow(2, -2 * _0x308478 + 8) - 1) << _0x308478 * 2 | _0x590429.indexOf(_0x5050d9.charAt(_0x15cbbb)) >>> 6 - _0x308478 * 2);
          }
          return _0x58891a;
        }
      };
      _0x1ffde0.exports = _0x8f0fcd;
    })();
  },
  './node_modules/event-lite/event-lite.js': function (_0x4e41ea, _0x47fc7d, _0x5081b9) {
    /**
    * event-lite.js - Light-weight EventEmitter (less than 1KB when gzipped)
    *
    * @copyright Yusuke Kawasaki
    * @license MIT
    * @constructor
    * @see https://github.com/kawanet/event-lite
    * @see http://kawanet.github.io/event-lite/EventLite.html
    * @example
    * var EventLite = require("event-lite");
    *
    * function MyClass() {...}             // your class
    *
    * EventLite.mixin(MyClass.prototype);  // import event methods
    *
    * var obj = new MyClass();
    * obj.on("foo", function() {...});     // add event listener
    * obj.once("bar", function() {...});   // add one-time event listener
    * obj.emit("foo");                     // dispatch event
    * obj.emit("bar");                     // dispatch another event
    * obj.off("foo");                      // remove event listener
    */
    function _0x214da9() {
      if (!(this instanceof _0x214da9)) {
        return new _0x214da9();
      }
    }
    (function (_0x2f0e54) {
      if (true) {
        _0x4e41ea.exports = _0x2f0e54;
      }
      var _0x4baf18 = "listeners";
      var _0x311fd5 = {
        on: _0x18ffd7,
        once: _0x30e019,
        off: _0x54fbe3,
        emit: _0x5a238a
      };
      var _0x1d83c8 = _0x311fd5;
      _0x72d812(_0x2f0e54.prototype);
      _0x2f0e54.mixin = _0x72d812;
      function _0x72d812(_0x16c739) {
        for (var _0x20e2f5 in _0x1d83c8) {
          _0x16c739[_0x20e2f5] = _0x1d83c8[_0x20e2f5];
        }
        return _0x16c739;
      }
      function _0x18ffd7(_0x1a7cde, _0x43d667) {
        return _0x4a79ff(this, _0x1a7cde).push(_0x43d667), this;
      }
      function _0x30e019(_0x1bb3a7, _0x57982c) {
        var _0x322847 = this;
        _0x25f87b.originalListener = _0x57982c;
        _0x4a79ff(_0x322847, _0x1bb3a7).push(_0x25f87b);
        return _0x322847;
        function _0x25f87b() {
          _0x54fbe3.call(_0x322847, _0x1bb3a7, _0x25f87b), _0x57982c.apply(this, arguments);
        }
      }
      function _0x54fbe3(_0x26bbfa, _0x26ba44) {
        var _0x4299e9 = this;
        var _0x36d058;
        if (!arguments.length) {
          delete _0x4299e9[_0x4baf18];
        } else {
          if (!_0x26ba44) {
            _0x36d058 = _0x4299e9[_0x4baf18];
            if (_0x36d058) {
              delete _0x36d058[_0x26bbfa];
              if (!Object.keys(_0x36d058).length) {
                return _0x54fbe3.call(_0x4299e9);
              }
            }
          } else {
            _0x36d058 = _0x4a79ff(_0x4299e9, _0x26bbfa, true);
            if (_0x36d058) {
              _0x36d058 = _0x36d058.filter(_0x436082);
              if (!_0x36d058.length) {
                return _0x54fbe3.call(_0x4299e9, _0x26bbfa);
              }
              _0x4299e9[_0x4baf18][_0x26bbfa] = _0x36d058;
            }
          }
        }
        return _0x4299e9;
        function _0x436082(_0x3d805a) {
          return _0x3d805a !== _0x26ba44 && _0x3d805a.originalListener !== _0x26ba44;
        }
      }
      function _0x5a238a(_0x504d7d, _0x593a57) {
        var _0x3b3f1d = this;
        var _0x53445d = _0x4a79ff(_0x3b3f1d, _0x504d7d, true);
        if (!_0x53445d) {
          return false;
        }
        var _0x405ce8 = arguments.length;
        if (_0x405ce8 === 1) {
          _0x53445d.forEach(_0x5a1d87);
        } else {
          if (_0x405ce8 === 2) {
            _0x53445d.forEach(_0x18280d);
          } else {
            var _0x1c97fe = Array.prototype.slice.call(arguments, 1);
            _0x53445d.forEach(_0x4f1779);
          }
        }
        return !!_0x53445d.length;
        function _0x5a1d87(_0x47cbaf) {
          _0x47cbaf.call(_0x3b3f1d);
        }
        function _0x18280d(_0x3d5fb9) {
          _0x3d5fb9.call(_0x3b3f1d, _0x593a57);
        }
        function _0x4f1779(_0x343868) {
          _0x343868.apply(_0x3b3f1d, _0x1c97fe);
        }
      }
      function _0x4a79ff(_0xe59a28, _0x29da17, _0x34b88c) {
        if (_0x34b88c && !_0xe59a28[_0x4baf18]) {
          return;
        }
        var _0x2fa7f7 = _0xe59a28[_0x4baf18] || (_0xe59a28[_0x4baf18] = {});
        return _0x2fa7f7[_0x29da17] || (_0x2fa7f7[_0x29da17] = []);
      }
    })(_0x214da9);
  },
  './node_modules/ieee754/index.js': function (_0x373769, _0x2894fb) {
    _0x2894fb.read = function (_0x58837e, _0x271db1, _0x21ae0c, _0x37367c, _0x124676) {
      var _0x33247d;
      var _0x2153ad;
      var _0x357d83 = _0x124676 * 8 - _0x37367c - 1;
      var _0x2d184e = (1 << _0x357d83) - 1;
      var _0x1d9e3d = _0x2d184e >> 1;
      var _0x186987 = -7;
      var _0x40d76b = _0x21ae0c ? _0x124676 - 1 : 0;
      var _0x27bf27 = _0x21ae0c ? -1 : 1;
      var _0x23ab32 = _0x58837e[_0x271db1 + _0x40d76b];
      _0x40d76b += _0x27bf27;
      _0x33247d = _0x23ab32 & (1 << -_0x186987) - 1;
      _0x23ab32 >>= -_0x186987;
      _0x186987 += _0x357d83;
      for (; _0x186987 > 0; _0x33247d = _0x33247d * 256 + _0x58837e[_0x271db1 + _0x40d76b], _0x40d76b += _0x27bf27, _0x186987 -= 8) {}
      _0x2153ad = _0x33247d & (1 << -_0x186987) - 1;
      _0x33247d >>= -_0x186987;
      _0x186987 += _0x37367c;
      for (; _0x186987 > 0; _0x2153ad = _0x2153ad * 256 + _0x58837e[_0x271db1 + _0x40d76b], _0x40d76b += _0x27bf27, _0x186987 -= 8) {}
      if (_0x33247d === 0) {
        _0x33247d = 1 - _0x1d9e3d;
      } else {
        if (_0x33247d === _0x2d184e) {
          return _0x2153ad ? NaN : (_0x23ab32 ? -1 : 1) * Infinity;
        } else {
          _0x2153ad = _0x2153ad + Math.pow(2, _0x37367c);
          _0x33247d = _0x33247d - _0x1d9e3d;
        }
      }
      return (_0x23ab32 ? -1 : 1) * _0x2153ad * Math.pow(2, _0x33247d - _0x37367c);
    };
    _0x2894fb.write = function (_0x2482e3, _0x42cbb8, _0x30e599, _0x4a8c67, _0x20f510, _0x5f342e) {
      var _0x4258c8;
      var _0x1f6640;
      var _0x25565d;
      var _0x4c3d92 = _0x5f342e * 8 - _0x20f510 - 1;
      var _0xe3d230 = (1 << _0x4c3d92) - 1;
      var _0x4c4b47 = _0xe3d230 >> 1;
      var _0x5ea9b0 = _0x20f510 === 23 ? 5.960464477539062e-8 : 0;
      var _0x2bd449 = _0x4a8c67 ? 0 : _0x5f342e - 1;
      var _0x3bee15 = _0x4a8c67 ? 1 : -1;
      var _0x6fc4bc = _0x42cbb8 < 0 || _0x42cbb8 === 0 && 1 / _0x42cbb8 < 0 ? 1 : 0;
      _0x42cbb8 = Math.abs(_0x42cbb8);
      if (isNaN(_0x42cbb8) || _0x42cbb8 === Infinity) {
        _0x1f6640 = isNaN(_0x42cbb8) ? 1 : 0;
        _0x4258c8 = _0xe3d230;
      } else {
        _0x4258c8 = Math.floor(Math.log(_0x42cbb8) / Math.LN2);
        _0x42cbb8 * (_0x25565d = Math.pow(2, -_0x4258c8)) < 1 && (_0x4258c8--, _0x25565d *= 2);
        if (_0x4258c8 + _0x4c4b47 >= 1) {
          _0x42cbb8 += _0x5ea9b0 / _0x25565d;
        } else {
          _0x42cbb8 += _0x5ea9b0 * Math.pow(2, 1 - _0x4c4b47);
        }
        if (_0x42cbb8 * _0x25565d >= 2) {
          _0x4258c8++;
          _0x25565d /= 2;
        }
        if (_0x4258c8 + _0x4c4b47 >= _0xe3d230) {
          _0x1f6640 = 0, _0x4258c8 = _0xe3d230;
        } else {
          _0x4258c8 + _0x4c4b47 >= 1 ? (_0x1f6640 = (_0x42cbb8 * _0x25565d - 1) * Math.pow(2, _0x20f510), _0x4258c8 = _0x4258c8 + _0x4c4b47) : (_0x1f6640 = _0x42cbb8 * Math.pow(2, _0x4c4b47 - 1) * Math.pow(2, _0x20f510), _0x4258c8 = 0);
        }
      }
      for (; _0x20f510 >= 8; _0x2482e3[_0x30e599 + _0x2bd449] = _0x1f6640 & 255, _0x2bd449 += _0x3bee15, _0x1f6640 /= 256, _0x20f510 -= 8) {}
      _0x4258c8 = _0x4258c8 << _0x20f510 | _0x1f6640;
      _0x4c3d92 += _0x20f510;
      for (; _0x4c3d92 > 0; _0x2482e3[_0x30e599 + _0x2bd449] = _0x4258c8 & 255, _0x2bd449 += _0x3bee15, _0x4258c8 /= 256, _0x4c3d92 -= 8) {}
      _0x2482e3[_0x30e599 + _0x2bd449 - _0x3bee15] |= _0x6fc4bc * 128;
    };
  },
  './node_modules/int64-buffer/int64-buffer.js': function (_0x3ccb65, _0x24c2c6, _0x210325) {
    (function (_0x2bfa64) {
      var _0x43310f;
      var _0x20894a;
      var _0x4af7db;
      var _0x231094;
      !function (_0x452603) {
        var _0x8e2b9b = "undefined";
        var _0x4687d2 = _0x8e2b9b !== typeof _0x2bfa64 && _0x2bfa64;
        var _0x3d604a = _0x8e2b9b !== typeof Uint8Array && Uint8Array;
        var _0x1b46a = _0x8e2b9b !== typeof ArrayBuffer && ArrayBuffer;
        var _0x42d29d = [0, 0, 0, 0, 0, 0, 0, 0];
        var _0x5968dc = Array.isArray || _0x42923e;
        var _0x217275 = 4294967296;
        var _0xd2540a = 16777216;
        var _0x366708;
        _0x43310f = _0x2db274("Uint64BE", true, true);
        _0x20894a = _0x2db274("Int64BE", true, false);
        _0x4af7db = _0x2db274("Uint64LE", false, true);
        _0x231094 = _0x2db274("Int64LE", false, false);
        function _0x2db274(_0x5888f8, _0x128599, _0x1cb2a6) {
          var _0x54d316 = _0x128599 ? 0 : 4;
          var _0x518569 = _0x128599 ? 4 : 0;
          var _0x9e654d = _0x128599 ? 0 : 3;
          var _0x1ac5a7 = _0x128599 ? 1 : 2;
          var _0x1f2d1e = _0x128599 ? 2 : 1;
          var _0x43cd01 = _0x128599 ? 3 : 0;
          var _0x211f91 = _0x128599 ? _0x58a3f5 : _0x57113c;
          var _0x427e16 = _0x128599 ? _0x5628d4 : _0x5526a2;
          var _0x720cd6 = _0x5871bf.prototype;
          var _0x5c56b0 = 'is' + _0x5888f8;
          var _0x3f70c1 = '_' + _0x5c56b0;
          _0x720cd6.buffer = undefined;
          _0x720cd6.offset = 0;
          _0x720cd6[_0x3f70c1] = true;
          _0x720cd6.toNumber = _0x2a7805;
          _0x720cd6.toString = _0x44e56b;
          _0x720cd6.toJSON = _0x2a7805;
          _0x720cd6.toArray = _0x4b52a0;
          if (_0x4687d2) {
            _0x720cd6.toBuffer = _0x1ee361;
          }
          if (_0x3d604a) {
            _0x720cd6.toArrayBuffer = _0x14c21f;
          }
          _0x5871bf[_0x5c56b0] = _0x11950b;
          _0x452603[_0x5888f8] = _0x5871bf;
          return _0x5871bf;
          function _0x5871bf(_0x237729, _0x3dba55, _0x2c31ca, _0x2ab806) {
            if (!(this instanceof _0x5871bf)) {
              return new _0x5871bf(_0x237729, _0x3dba55, _0x2c31ca, _0x2ab806);
            }
            return _0x43f5e5(this, _0x237729, _0x3dba55, _0x2c31ca, _0x2ab806);
          }
          function _0x11950b(_0x10bcaf) {
            return !!(_0x10bcaf && _0x10bcaf[_0x3f70c1]);
          }
          function _0x43f5e5(_0x47f01f, _0x35cb71, _0x4abc54, _0x3fa515, _0x272c7c) {
            if (_0x3d604a && _0x1b46a) {
              if (_0x35cb71 instanceof _0x1b46a) {
                _0x35cb71 = new _0x3d604a(_0x35cb71);
              }
              if (_0x3fa515 instanceof _0x1b46a) {
                _0x3fa515 = new _0x3d604a(_0x3fa515);
              }
            }
            if (!_0x35cb71 && !_0x4abc54 && !_0x3fa515 && !_0x366708) {
              _0x47f01f.buffer = _0x18554c(_0x42d29d, 0);
              return;
            }
            if (!_0x293611(_0x35cb71, _0x4abc54)) {
              var _0x3f976b = _0x366708 || Array;
              _0x272c7c = _0x4abc54;
              _0x3fa515 = _0x35cb71;
              _0x4abc54 = 0;
              _0x35cb71 = new _0x3f976b(8);
            }
            _0x47f01f.buffer = _0x35cb71;
            _0x47f01f.offset = _0x4abc54 |= 0;
            if (_0x8e2b9b === typeof _0x3fa515) {
              return;
            }
            if ("string" === typeof _0x3fa515) {
              _0x197c99(_0x35cb71, _0x4abc54, _0x3fa515, _0x272c7c || 10);
            } else {
              if (_0x293611(_0x3fa515, _0x272c7c)) {
                _0x39ea3d(_0x35cb71, _0x4abc54, _0x3fa515, _0x272c7c);
              } else {
                if ("number" === typeof _0x272c7c) {
                  _0xf687f0(_0x35cb71, _0x4abc54 + _0x54d316, _0x3fa515), _0xf687f0(_0x35cb71, _0x4abc54 + _0x518569, _0x272c7c);
                } else {
                  if (_0x3fa515 > 0) {
                    _0x211f91(_0x35cb71, _0x4abc54, _0x3fa515);
                  } else {
                    if (_0x3fa515 < 0) {
                      _0x427e16(_0x35cb71, _0x4abc54, _0x3fa515);
                    } else {
                      _0x39ea3d(_0x35cb71, _0x4abc54, _0x42d29d, 0);
                    }
                  }
                }
              }
            }
          }
          function _0x197c99(_0x2f790d, _0x2bf1d5, _0x4d68f3, _0x7557ed) {
            var _0x4dd8a0 = 0;
            var _0x37d274 = _0x4d68f3.length;
            var _0x1827fb = 0;
            var _0x52e653 = 0;
            if (_0x4d68f3[0] === '-') {
              _0x4dd8a0++;
            }
            var _0x35bef9 = _0x4dd8a0;
            while (_0x4dd8a0 < _0x37d274) {
              var _0x54fb04 = parseInt(_0x4d68f3[_0x4dd8a0++], _0x7557ed);
              if (!(_0x54fb04 >= 0)) {
                break;
              }
              _0x52e653 = _0x52e653 * _0x7557ed + _0x54fb04;
              _0x1827fb = _0x1827fb * _0x7557ed + Math.floor(_0x52e653 / _0x217275);
              _0x52e653 %= _0x217275;
            }
            if (_0x35bef9) {
              _0x1827fb = ~_0x1827fb;
              if (_0x52e653) {
                _0x52e653 = _0x217275 - _0x52e653;
              } else {
                _0x1827fb++;
              }
            }
            _0xf687f0(_0x2f790d, _0x2bf1d5 + _0x54d316, _0x1827fb);
            _0xf687f0(_0x2f790d, _0x2bf1d5 + _0x518569, _0x52e653);
          }
          function _0x2a7805() {
            var _0x1c50a0 = this.buffer;
            var _0x2fcb0c = this.offset;
            var _0x56c24d = _0x95840b(_0x1c50a0, _0x2fcb0c + _0x54d316);
            var _0x616c = _0x95840b(_0x1c50a0, _0x2fcb0c + _0x518569);
            if (!_0x1cb2a6) {
              _0x56c24d |= 0;
            }
            return _0x56c24d ? _0x56c24d * _0x217275 + _0x616c : _0x616c;
          }
          function _0x44e56b(_0x1c4c79) {
            var _0x365235 = this.buffer;
            var _0x51c36c = this.offset;
            var _0x3caa60 = _0x95840b(_0x365235, _0x51c36c + _0x54d316);
            var _0x33d376 = _0x95840b(_0x365235, _0x51c36c + _0x518569);
            var _0x38fc54 = '';
            var _0x49498e = !_0x1cb2a6 && _0x3caa60 & 2147483648;
            if (_0x49498e) {
              _0x3caa60 = ~_0x3caa60;
              _0x33d376 = _0x217275 - _0x33d376;
            }
            _0x1c4c79 = _0x1c4c79 || 10;
            while (1) {
              var _0x47c776 = _0x3caa60 % _0x1c4c79 * _0x217275 + _0x33d376;
              _0x3caa60 = Math.floor(_0x3caa60 / _0x1c4c79);
              _0x33d376 = Math.floor(_0x47c776 / _0x1c4c79);
              _0x38fc54 = (_0x47c776 % _0x1c4c79).toString(_0x1c4c79) + _0x38fc54;
              if (!_0x3caa60 && !_0x33d376) {
                break;
              }
            }
            _0x49498e && (_0x38fc54 = '-' + _0x38fc54);
            return _0x38fc54;
          }
          function _0xf687f0(_0x3eaf03, _0x10ed4e, _0x57cd08) {
            _0x3eaf03[_0x10ed4e + _0x43cd01] = _0x57cd08 & 255;
            _0x57cd08 = _0x57cd08 >> 8;
            _0x3eaf03[_0x10ed4e + _0x1f2d1e] = _0x57cd08 & 255;
            _0x57cd08 = _0x57cd08 >> 8;
            _0x3eaf03[_0x10ed4e + _0x1ac5a7] = _0x57cd08 & 255;
            _0x57cd08 = _0x57cd08 >> 8;
            _0x3eaf03[_0x10ed4e + _0x9e654d] = _0x57cd08 & 255;
          }
          function _0x95840b(_0x2a5d45, _0x3df051) {
            return _0x2a5d45[_0x3df051 + _0x9e654d] * _0xd2540a + (_0x2a5d45[_0x3df051 + _0x1ac5a7] << 16) + (_0x2a5d45[_0x3df051 + _0x1f2d1e] << 8) + _0x2a5d45[_0x3df051 + _0x43cd01];
          }
        }
        function _0x4b52a0(_0x1141f8) {
          var _0x76a9e1 = this.buffer;
          var _0xe6ee30 = this.offset;
          _0x366708 = null;
          if (_0x1141f8 !== false && _0xe6ee30 === 0 && _0x76a9e1.length === 8 && _0x5968dc(_0x76a9e1)) {
            return _0x76a9e1;
          }
          return _0x18554c(_0x76a9e1, _0xe6ee30);
        }
        function _0x1ee361(_0x69f2e4) {
          var _0x5676a9 = this.buffer;
          var _0x14a9c2 = this.offset;
          _0x366708 = _0x4687d2;
          if (_0x69f2e4 !== false && _0x14a9c2 === 0 && _0x5676a9.length === 8 && _0x2bfa64.isBuffer(_0x5676a9)) {
            return _0x5676a9;
          }
          var _0x49c990 = new _0x4687d2(8);
          _0x39ea3d(_0x49c990, 0, _0x5676a9, _0x14a9c2);
          return _0x49c990;
        }
        function _0x14c21f(_0x5cafec) {
          var _0x3a1bd6 = this.buffer;
          var _0x28f2b8 = this.offset;
          var _0x5bb329 = _0x3a1bd6.buffer;
          _0x366708 = _0x3d604a;
          if (_0x5cafec !== false && _0x28f2b8 === 0 && _0x5bb329 instanceof _0x1b46a && _0x5bb329.byteLength === 8) {
            return _0x5bb329;
          }
          var _0x339d7b = new _0x3d604a(8);
          _0x39ea3d(_0x339d7b, 0, _0x3a1bd6, _0x28f2b8);
          return _0x339d7b.buffer;
        }
        function _0x293611(_0xf26c4e, _0x174306) {
          var _0x116362 = _0xf26c4e && _0xf26c4e.length;
          _0x174306 |= 0;
          return _0x116362 && _0x174306 + 8 <= _0x116362 && "string" !== typeof _0xf26c4e[_0x174306];
        }
        function _0x39ea3d(_0x4ae0fa, _0x203246, _0x2899e8, _0x4c33f1) {
          _0x203246 |= 0;
          _0x4c33f1 |= 0;
          for (var _0x558572 = 0; _0x558572 < 8; _0x558572++) {
            _0x4ae0fa[_0x203246++] = _0x2899e8[_0x4c33f1++] & 255;
          }
        }
        function _0x18554c(_0x13de29, _0x27effa) {
          return Array.prototype.slice.call(_0x13de29, _0x27effa, _0x27effa + 8);
        }
        function _0x58a3f5(_0x2baf58, _0x396c0c, _0x3168b6) {
          var _0x42e41c = _0x396c0c + 8;
          while (_0x42e41c > _0x396c0c) {
            _0x2baf58[--_0x42e41c] = _0x3168b6 & 255;
            _0x3168b6 /= 256;
          }
        }
        function _0x5628d4(_0x16a8b1, _0x162c8b, _0x405273) {
          var _0x5b9bff = _0x162c8b + 8;
          _0x405273++;
          while (_0x5b9bff > _0x162c8b) {
            _0x16a8b1[--_0x5b9bff] = -_0x405273 & 255 ^ 255, _0x405273 /= 256;
          }
        }
        function _0x57113c(_0x3097b5, _0x12a9f8, _0x3ca305) {
          var _0x38560d = _0x12a9f8 + 8;
          while (_0x12a9f8 < _0x38560d) {
            _0x3097b5[_0x12a9f8++] = _0x3ca305 & 255, _0x3ca305 /= 256;
          }
        }
        function _0x5526a2(_0x45c95e, _0x22caa6, _0x4451eb) {
          var _0x80ae3c = _0x22caa6 + 8;
          _0x4451eb++;
          while (_0x22caa6 < _0x80ae3c) {
            _0x45c95e[_0x22caa6++] = -_0x4451eb & 255 ^ 255, _0x4451eb /= 256;
          }
        }
        function _0x42923e(_0x35f4d3) {
          return !!_0x35f4d3 && "[object Array]" == Object.prototype.toString.call(_0x35f4d3);
        }
      }(true && typeof _0x24c2c6.nodeName !== "string" ? _0x24c2c6 : this || {});
    }).call(this, _0x210325("./node_modules/buffer/index.js").Buffer);
  },
  './node_modules/is-buffer/index.js': function (_0x2715d7, _0x4f8b42) {
    /*!
    * Determine if an object is a Buffer
    *
    * @author   Feross Aboukhadijeh <https://feross.org>
    * @license  MIT
    */
    _0x2715d7.exports = function (_0x7dde70) {
      return _0x7dde70 != null && (_0xfdc5f1(_0x7dde70) || _0x33ffc(_0x7dde70) || !!_0x7dde70._isBuffer);
    };
    function _0xfdc5f1(_0xe4a826) {
      return !!_0xe4a826.constructor && typeof _0xe4a826.constructor.isBuffer === "function" && _0xe4a826.constructor.isBuffer(_0xe4a826);
    }
    function _0x33ffc(_0x1197c6) {
      return typeof _0x1197c6.readFloatLE === "function" && typeof _0x1197c6.slice === "function" && _0xfdc5f1(_0x1197c6.slice(0, 0));
    }
  },
  './node_modules/md5/md5.js': function (_0x43d959, _0x3ab4fc, _0x38879e) {
    (function () {
      var _0x597b49 = _0x38879e("./node_modules/crypt/crypt.js");
      var _0x103fa3 = _0x38879e("./node_modules/charenc/charenc.js").utf8;
      var _0x4bf45c = _0x38879e("./node_modules/is-buffer/index.js");
      var _0x19381d = _0x38879e("./node_modules/charenc/charenc.js").bin;
      function _0x1607a6(_0xfc059e, _0x588e6c) {
        if (_0xfc059e.constructor == String) {
          if (_0x588e6c && _0x588e6c.encoding === "binary") {
            _0xfc059e = _0x19381d.stringToBytes(_0xfc059e);
          } else {
            _0xfc059e = _0x103fa3.stringToBytes(_0xfc059e);
          }
        } else {
          if (_0x4bf45c(_0xfc059e)) {
            _0xfc059e = Array.prototype.slice.call(_0xfc059e, 0);
          } else {
            if (!Array.isArray(_0xfc059e)) {
              _0xfc059e = _0xfc059e.toString();
            }
          }
        }
        var _0x499bcf = _0x597b49.bytesToWords(_0xfc059e);
        var _0x1dbdfc = _0xfc059e.length * 8;
        var _0x3a7af2 = 1732584193;
        var _0x2376f9 = -271733879;
        var _0x57960d = -1732584194;
        var _0x5244e5 = 271733878;
        for (var _0x258c3b = 0; _0x258c3b < _0x499bcf.length; _0x258c3b++) {
          _0x499bcf[_0x258c3b] = (_0x499bcf[_0x258c3b] << 8 | _0x499bcf[_0x258c3b] >>> 24) & 16711935 | (_0x499bcf[_0x258c3b] << 24 | _0x499bcf[_0x258c3b] >>> 8) & 4278255360;
        }
        _0x499bcf[_0x1dbdfc >>> 5] |= 128 << _0x1dbdfc % 32;
        _0x499bcf[(_0x1dbdfc + 64 >>> 9 << 4) + 14] = _0x1dbdfc;
        var _0x390897 = _0x1607a6._ff;
        var _0x434927 = _0x1607a6._gg;
        var _0x43efeb = _0x1607a6._hh;
        var _0xe29256 = _0x1607a6._ii;
        for (var _0x258c3b = 0; _0x258c3b < _0x499bcf.length; _0x258c3b += 16) {
          var _0x42fd60 = _0x3a7af2;
          var _0xe06f54 = _0x2376f9;
          var _0x26f6c5 = _0x57960d;
          var _0x410971 = _0x5244e5;
          _0x3a7af2 = _0x390897(_0x3a7af2, _0x2376f9, _0x57960d, _0x5244e5, _0x499bcf[_0x258c3b + 0], 7, -680876936);
          _0x5244e5 = _0x390897(_0x5244e5, _0x3a7af2, _0x2376f9, _0x57960d, _0x499bcf[_0x258c3b + 1], 12, -389564586);
          _0x57960d = _0x390897(_0x57960d, _0x5244e5, _0x3a7af2, _0x2376f9, _0x499bcf[_0x258c3b + 2], 17, 606105819);
          _0x2376f9 = _0x390897(_0x2376f9, _0x57960d, _0x5244e5, _0x3a7af2, _0x499bcf[_0x258c3b + 3], 22, -1044525330);
          _0x3a7af2 = _0x390897(_0x3a7af2, _0x2376f9, _0x57960d, _0x5244e5, _0x499bcf[_0x258c3b + 4], 7, -176418897);
          _0x5244e5 = _0x390897(_0x5244e5, _0x3a7af2, _0x2376f9, _0x57960d, _0x499bcf[_0x258c3b + 5], 12, 1200080426);
          _0x57960d = _0x390897(_0x57960d, _0x5244e5, _0x3a7af2, _0x2376f9, _0x499bcf[_0x258c3b + 6], 17, -1473231341);
          _0x2376f9 = _0x390897(_0x2376f9, _0x57960d, _0x5244e5, _0x3a7af2, _0x499bcf[_0x258c3b + 7], 22, -45705983);
          _0x3a7af2 = _0x390897(_0x3a7af2, _0x2376f9, _0x57960d, _0x5244e5, _0x499bcf[_0x258c3b + 8], 7, 1770035416);
          _0x5244e5 = _0x390897(_0x5244e5, _0x3a7af2, _0x2376f9, _0x57960d, _0x499bcf[_0x258c3b + 9], 12, -1958414417);
          _0x57960d = _0x390897(_0x57960d, _0x5244e5, _0x3a7af2, _0x2376f9, _0x499bcf[_0x258c3b + 10], 17, -42063);
          _0x2376f9 = _0x390897(_0x2376f9, _0x57960d, _0x5244e5, _0x3a7af2, _0x499bcf[_0x258c3b + 11], 22, -1990404162);
          _0x3a7af2 = _0x390897(_0x3a7af2, _0x2376f9, _0x57960d, _0x5244e5, _0x499bcf[_0x258c3b + 12], 7, 1804603682);
          _0x5244e5 = _0x390897(_0x5244e5, _0x3a7af2, _0x2376f9, _0x57960d, _0x499bcf[_0x258c3b + 13], 12, -40341101);
          _0x57960d = _0x390897(_0x57960d, _0x5244e5, _0x3a7af2, _0x2376f9, _0x499bcf[_0x258c3b + 14], 17, -1502002290);
          _0x2376f9 = _0x390897(_0x2376f9, _0x57960d, _0x5244e5, _0x3a7af2, _0x499bcf[_0x258c3b + 15], 22, 1236535329);
          _0x3a7af2 = _0x434927(_0x3a7af2, _0x2376f9, _0x57960d, _0x5244e5, _0x499bcf[_0x258c3b + 1], 5, -165796510);
          _0x5244e5 = _0x434927(_0x5244e5, _0x3a7af2, _0x2376f9, _0x57960d, _0x499bcf[_0x258c3b + 6], 9, -1069501632);
          _0x57960d = _0x434927(_0x57960d, _0x5244e5, _0x3a7af2, _0x2376f9, _0x499bcf[_0x258c3b + 11], 14, 643717713);
          _0x2376f9 = _0x434927(_0x2376f9, _0x57960d, _0x5244e5, _0x3a7af2, _0x499bcf[_0x258c3b + 0], 20, -373897302);
          _0x3a7af2 = _0x434927(_0x3a7af2, _0x2376f9, _0x57960d, _0x5244e5, _0x499bcf[_0x258c3b + 5], 5, -701558691);
          _0x5244e5 = _0x434927(_0x5244e5, _0x3a7af2, _0x2376f9, _0x57960d, _0x499bcf[_0x258c3b + 10], 9, 38016083);
          _0x57960d = _0x434927(_0x57960d, _0x5244e5, _0x3a7af2, _0x2376f9, _0x499bcf[_0x258c3b + 15], 14, -660478335);
          _0x2376f9 = _0x434927(_0x2376f9, _0x57960d, _0x5244e5, _0x3a7af2, _0x499bcf[_0x258c3b + 4], 20, -405537848);
          _0x3a7af2 = _0x434927(_0x3a7af2, _0x2376f9, _0x57960d, _0x5244e5, _0x499bcf[_0x258c3b + 9], 5, 568446438);
          _0x5244e5 = _0x434927(_0x5244e5, _0x3a7af2, _0x2376f9, _0x57960d, _0x499bcf[_0x258c3b + 14], 9, -1019803690);
          _0x57960d = _0x434927(_0x57960d, _0x5244e5, _0x3a7af2, _0x2376f9, _0x499bcf[_0x258c3b + 3], 14, -187363961);
          _0x2376f9 = _0x434927(_0x2376f9, _0x57960d, _0x5244e5, _0x3a7af2, _0x499bcf[_0x258c3b + 8], 20, 1163531501);
          _0x3a7af2 = _0x434927(_0x3a7af2, _0x2376f9, _0x57960d, _0x5244e5, _0x499bcf[_0x258c3b + 13], 5, -1444681467);
          _0x5244e5 = _0x434927(_0x5244e5, _0x3a7af2, _0x2376f9, _0x57960d, _0x499bcf[_0x258c3b + 2], 9, -51403784);
          _0x57960d = _0x434927(_0x57960d, _0x5244e5, _0x3a7af2, _0x2376f9, _0x499bcf[_0x258c3b + 7], 14, 1735328473);
          _0x2376f9 = _0x434927(_0x2376f9, _0x57960d, _0x5244e5, _0x3a7af2, _0x499bcf[_0x258c3b + 12], 20, -1926607734);
          _0x3a7af2 = _0x43efeb(_0x3a7af2, _0x2376f9, _0x57960d, _0x5244e5, _0x499bcf[_0x258c3b + 5], 4, -378558);
          _0x5244e5 = _0x43efeb(_0x5244e5, _0x3a7af2, _0x2376f9, _0x57960d, _0x499bcf[_0x258c3b + 8], 11, -2022574463);
          _0x57960d = _0x43efeb(_0x57960d, _0x5244e5, _0x3a7af2, _0x2376f9, _0x499bcf[_0x258c3b + 11], 16, 1839030562);
          _0x2376f9 = _0x43efeb(_0x2376f9, _0x57960d, _0x5244e5, _0x3a7af2, _0x499bcf[_0x258c3b + 14], 23, -35309556);
          _0x3a7af2 = _0x43efeb(_0x3a7af2, _0x2376f9, _0x57960d, _0x5244e5, _0x499bcf[_0x258c3b + 1], 4, -1530992060);
          _0x5244e5 = _0x43efeb(_0x5244e5, _0x3a7af2, _0x2376f9, _0x57960d, _0x499bcf[_0x258c3b + 4], 11, 1272893353);
          _0x57960d = _0x43efeb(_0x57960d, _0x5244e5, _0x3a7af2, _0x2376f9, _0x499bcf[_0x258c3b + 7], 16, -155497632);
          _0x2376f9 = _0x43efeb(_0x2376f9, _0x57960d, _0x5244e5, _0x3a7af2, _0x499bcf[_0x258c3b + 10], 23, -1094730640);
          _0x3a7af2 = _0x43efeb(_0x3a7af2, _0x2376f9, _0x57960d, _0x5244e5, _0x499bcf[_0x258c3b + 13], 4, 681279174);
          _0x5244e5 = _0x43efeb(_0x5244e5, _0x3a7af2, _0x2376f9, _0x57960d, _0x499bcf[_0x258c3b + 0], 11, -358537222);
          _0x57960d = _0x43efeb(_0x57960d, _0x5244e5, _0x3a7af2, _0x2376f9, _0x499bcf[_0x258c3b + 3], 16, -722521979);
          _0x2376f9 = _0x43efeb(_0x2376f9, _0x57960d, _0x5244e5, _0x3a7af2, _0x499bcf[_0x258c3b + 6], 23, 76029189);
          _0x3a7af2 = _0x43efeb(_0x3a7af2, _0x2376f9, _0x57960d, _0x5244e5, _0x499bcf[_0x258c3b + 9], 4, -640364487);
          _0x5244e5 = _0x43efeb(_0x5244e5, _0x3a7af2, _0x2376f9, _0x57960d, _0x499bcf[_0x258c3b + 12], 11, -421815835);
          _0x57960d = _0x43efeb(_0x57960d, _0x5244e5, _0x3a7af2, _0x2376f9, _0x499bcf[_0x258c3b + 15], 16, 530742520);
          _0x2376f9 = _0x43efeb(_0x2376f9, _0x57960d, _0x5244e5, _0x3a7af2, _0x499bcf[_0x258c3b + 2], 23, -995338651);
          _0x3a7af2 = _0xe29256(_0x3a7af2, _0x2376f9, _0x57960d, _0x5244e5, _0x499bcf[_0x258c3b + 0], 6, -198630844);
          _0x5244e5 = _0xe29256(_0x5244e5, _0x3a7af2, _0x2376f9, _0x57960d, _0x499bcf[_0x258c3b + 7], 10, 1126891415);
          _0x57960d = _0xe29256(_0x57960d, _0x5244e5, _0x3a7af2, _0x2376f9, _0x499bcf[_0x258c3b + 14], 15, -1416354905);
          _0x2376f9 = _0xe29256(_0x2376f9, _0x57960d, _0x5244e5, _0x3a7af2, _0x499bcf[_0x258c3b + 5], 21, -57434055);
          _0x3a7af2 = _0xe29256(_0x3a7af2, _0x2376f9, _0x57960d, _0x5244e5, _0x499bcf[_0x258c3b + 12], 6, 1700485571);
          _0x5244e5 = _0xe29256(_0x5244e5, _0x3a7af2, _0x2376f9, _0x57960d, _0x499bcf[_0x258c3b + 3], 10, -1894986606);
          _0x57960d = _0xe29256(_0x57960d, _0x5244e5, _0x3a7af2, _0x2376f9, _0x499bcf[_0x258c3b + 10], 15, -1051523);
          _0x2376f9 = _0xe29256(_0x2376f9, _0x57960d, _0x5244e5, _0x3a7af2, _0x499bcf[_0x258c3b + 1], 21, -2054922799);
          _0x3a7af2 = _0xe29256(_0x3a7af2, _0x2376f9, _0x57960d, _0x5244e5, _0x499bcf[_0x258c3b + 8], 6, 1873313359);
          _0x5244e5 = _0xe29256(_0x5244e5, _0x3a7af2, _0x2376f9, _0x57960d, _0x499bcf[_0x258c3b + 15], 10, -30611744);
          _0x57960d = _0xe29256(_0x57960d, _0x5244e5, _0x3a7af2, _0x2376f9, _0x499bcf[_0x258c3b + 6], 15, -1560198380);
          _0x2376f9 = _0xe29256(_0x2376f9, _0x57960d, _0x5244e5, _0x3a7af2, _0x499bcf[_0x258c3b + 13], 21, 1309151649);
          _0x3a7af2 = _0xe29256(_0x3a7af2, _0x2376f9, _0x57960d, _0x5244e5, _0x499bcf[_0x258c3b + 4], 6, -145523070);
          _0x5244e5 = _0xe29256(_0x5244e5, _0x3a7af2, _0x2376f9, _0x57960d, _0x499bcf[_0x258c3b + 11], 10, -1120210379);
          _0x57960d = _0xe29256(_0x57960d, _0x5244e5, _0x3a7af2, _0x2376f9, _0x499bcf[_0x258c3b + 2], 15, 718787259);
          _0x2376f9 = _0xe29256(_0x2376f9, _0x57960d, _0x5244e5, _0x3a7af2, _0x499bcf[_0x258c3b + 9], 21, -343485551);
          _0x3a7af2 = _0x3a7af2 + _0x42fd60 >>> 0;
          _0x2376f9 = _0x2376f9 + _0xe06f54 >>> 0;
          _0x57960d = _0x57960d + _0x26f6c5 >>> 0;
          _0x5244e5 = _0x5244e5 + _0x410971 >>> 0;
        }
        return _0x597b49.endian([_0x3a7af2, _0x2376f9, _0x57960d, _0x5244e5]);
      }
      _0x1607a6._ff = function (_0x54d83a, _0x1edb83, _0x349639, _0x207a14, _0x38a90b, _0x244f39, _0x24e51d) {
        var _0xdfd677 = _0x54d83a + (_0x1edb83 & _0x349639 | ~_0x1edb83 & _0x207a14) + (_0x38a90b >>> 0) + _0x24e51d;
        return (_0xdfd677 << _0x244f39 | _0xdfd677 >>> 32 - _0x244f39) + _0x1edb83;
      };
      _0x1607a6._gg = function (_0x77fc04, _0x598d7b, _0x5c1a6f, _0x5217fd, _0x1717a7, _0x4a807b, _0x284483) {
        var _0x26de7f = _0x77fc04 + (_0x598d7b & _0x5217fd | _0x5c1a6f & ~_0x5217fd) + (_0x1717a7 >>> 0) + _0x284483;
        return (_0x26de7f << _0x4a807b | _0x26de7f >>> 32 - _0x4a807b) + _0x598d7b;
      };
      _0x1607a6._hh = function (_0xcc0c94, _0x33b3af, _0x1471da, _0x2dec33, _0x5d93b6, _0x241c50, _0x26c20a) {
        var _0xb389b6 = _0xcc0c94 + (_0x33b3af ^ _0x1471da ^ _0x2dec33) + (_0x5d93b6 >>> 0) + _0x26c20a;
        return (_0xb389b6 << _0x241c50 | _0xb389b6 >>> 32 - _0x241c50) + _0x33b3af;
      };
      _0x1607a6._ii = function (_0x3af931, _0x2ed729, _0x20d5df, _0x8d1c21, _0x38c2d9, _0x1cc774, _0xff319e) {
        var _0x25950c = _0x3af931 + (_0x20d5df ^ (_0x2ed729 | ~_0x8d1c21)) + (_0x38c2d9 >>> 0) + _0xff319e;
        return (_0x25950c << _0x1cc774 | _0x25950c >>> 32 - _0x1cc774) + _0x2ed729;
      };
      _0x1607a6._blocksize = 16;
      _0x1607a6._digestsize = 16;
      _0x43d959.exports = function (_0x26e5ba, _0x275f58) {
        if (_0x26e5ba === undefined || _0x26e5ba === null) {
          throw new Error("Illegal argument " + _0x26e5ba);
        }
        var _0xe8bde6 = _0x597b49.wordsToBytes(_0x1607a6(_0x26e5ba, _0x275f58));
        return _0x275f58 && _0x275f58.asBytes ? _0xe8bde6 : _0x275f58 && _0x275f58.asString ? _0x19381d.bytesToString(_0xe8bde6) : _0x597b49.bytesToHex(_0xe8bde6);
      };
    })();
  },
  './node_modules/msgpack-lite/lib/browser.js': function (_0x1db822, _0x51cb94, _0x274947) {
    _0x51cb94.encode = _0x274947("./node_modules/msgpack-lite/lib/encode.js").encode;
    _0x51cb94.decode = _0x274947("./node_modules/msgpack-lite/lib/decode.js").decode;
    _0x51cb94.Encoder = _0x274947("./node_modules/msgpack-lite/lib/encoder.js").Encoder;
    _0x51cb94.Decoder = _0x274947("./node_modules/msgpack-lite/lib/decoder.js").Decoder;
    _0x51cb94.createCodec = _0x274947("./node_modules/msgpack-lite/lib/ext.js").createCodec;
    _0x51cb94.codec = _0x274947("./node_modules/msgpack-lite/lib/codec.js").codec;
  },
  './node_modules/msgpack-lite/lib/buffer-global.js': function (_0x18ebf9, _0x437706, _0x353239) {
    (function (_0x35bd4b) {
      _0x18ebf9.exports = _0x4fa006("undefined" !== typeof _0x35bd4b && _0x35bd4b) || _0x4fa006(this.Buffer) || _0x4fa006("undefined" !== typeof window && window.Buffer) || this.Buffer;
      function _0x4fa006(_0x1df2e2) {
        return _0x1df2e2 && _0x1df2e2.isBuffer && _0x1df2e2;
      }
    }).call(this, _0x353239("./node_modules/buffer/index.js").Buffer);
  },
  './node_modules/msgpack-lite/lib/buffer-lite.js': function (_0x1e30c6, _0x3be7c1) {
    var _0x232bbd = 8192;
    _0x3be7c1.copy = _0x3d3d84;
    _0x3be7c1.toString = _0x4f0f82;
    _0x3be7c1.write = _0x41c6a9;
    function _0x41c6a9(_0x4564d6, _0x395576) {
      var _0x3f2065 = this;
      var _0x3fea08 = _0x395576 || (_0x395576 |= 0);
      var _0x38abc7 = _0x4564d6.length;
      var _0x312625 = 0;
      var _0x2e56f1 = 0;
      while (_0x2e56f1 < _0x38abc7) {
        _0x312625 = _0x4564d6.charCodeAt(_0x2e56f1++);
        if (_0x312625 < 128) {
          _0x3f2065[_0x3fea08++] = _0x312625;
        } else {
          if (_0x312625 < 2048) {
            _0x3f2065[_0x3fea08++] = 192 | _0x312625 >>> 6;
            _0x3f2065[_0x3fea08++] = 128 | _0x312625 & 63;
          } else {
            if (_0x312625 < 55296 || _0x312625 > 57343) {
              _0x3f2065[_0x3fea08++] = 224 | _0x312625 >>> 12;
              _0x3f2065[_0x3fea08++] = 128 | _0x312625 >>> 6 & 63;
              _0x3f2065[_0x3fea08++] = 128 | _0x312625 & 63;
            } else {
              _0x312625 = (_0x312625 - 55296 << 10 | _0x4564d6.charCodeAt(_0x2e56f1++) - 56320) + 65536;
              _0x3f2065[_0x3fea08++] = 240 | _0x312625 >>> 18;
              _0x3f2065[_0x3fea08++] = 128 | _0x312625 >>> 12 & 63;
              _0x3f2065[_0x3fea08++] = 128 | _0x312625 >>> 6 & 63;
              _0x3f2065[_0x3fea08++] = 128 | _0x312625 & 63;
            }
          }
        }
      }
      return _0x3fea08 - _0x395576;
    }
    function _0x4f0f82(_0xadc253, _0x13e1a2, _0x528fc7) {
      var _0x4a921f = this;
      var _0x4fba22 = _0x13e1a2 | 0;
      if (!_0x528fc7) {
        _0x528fc7 = _0x4a921f.length;
      }
      var _0x62a2b5 = '';
      var _0x35992f = 0;
      while (_0x4fba22 < _0x528fc7) {
        _0x35992f = _0x4a921f[_0x4fba22++];
        if (_0x35992f < 128) {
          _0x62a2b5 += String.fromCharCode(_0x35992f);
          continue;
        }
        if ((_0x35992f & 224) === 192) {
          _0x35992f = (_0x35992f & 31) << 6 | _0x4a921f[_0x4fba22++] & 63;
        } else {
          if ((_0x35992f & 240) === 224) {
            _0x35992f = (_0x35992f & 15) << 12 | (_0x4a921f[_0x4fba22++] & 63) << 6 | _0x4a921f[_0x4fba22++] & 63;
          } else {
            if ((_0x35992f & 248) === 240) {
              _0x35992f = (_0x35992f & 7) << 18 | (_0x4a921f[_0x4fba22++] & 63) << 12 | (_0x4a921f[_0x4fba22++] & 63) << 6 | _0x4a921f[_0x4fba22++] & 63;
            }
          }
        }
        if (_0x35992f >= 65536) {
          _0x35992f -= 65536;
          _0x62a2b5 += String.fromCharCode((_0x35992f >>> 10) + 55296, (_0x35992f & 1023) + 56320);
        } else {
          _0x62a2b5 += String.fromCharCode(_0x35992f);
        }
      }
      return _0x62a2b5;
    }
    function _0x3d3d84(_0x40acc4, _0x10c141, _0xfc53fc, _0x4c5590) {
      var _0x1002f9;
      if (!_0xfc53fc) {
        _0xfc53fc = 0;
      }
      if (!_0x4c5590 && _0x4c5590 !== 0) {
        _0x4c5590 = this.length;
      }
      if (!_0x10c141) {
        _0x10c141 = 0;
      }
      var _0x31a982 = _0x4c5590 - _0xfc53fc;
      if (_0x40acc4 === this && _0xfc53fc < _0x10c141 && _0x10c141 < _0x4c5590) {
        for (_0x1002f9 = _0x31a982 - 1; _0x1002f9 >= 0; _0x1002f9--) {
          _0x40acc4[_0x1002f9 + _0x10c141] = this[_0x1002f9 + _0xfc53fc];
        }
      } else {
        for (_0x1002f9 = 0; _0x1002f9 < _0x31a982; _0x1002f9++) {
          _0x40acc4[_0x1002f9 + _0x10c141] = this[_0x1002f9 + _0xfc53fc];
        }
      }
      return _0x31a982;
    }
  },
  './node_modules/msgpack-lite/lib/bufferish-array.js': function (_0x537e7f, _0x9bb6be, _0x41aa1f) {
    var _0x334433 = _0x41aa1f("./node_modules/msgpack-lite/lib/bufferish.js");
    var _0x9bb6be = _0x537e7f.exports = _0x49f61b(0);
    _0x9bb6be.alloc = _0x49f61b;
    _0x9bb6be.concat = _0x334433.concat;
    _0x9bb6be.from = _0x5a8ac0;
    function _0x49f61b(_0x5a8484) {
      return new Array(_0x5a8484);
    }
    function _0x5a8ac0(_0x3cb0ec) {
      if (!_0x334433.isBuffer(_0x3cb0ec) && _0x334433.isView(_0x3cb0ec)) {
        _0x3cb0ec = _0x334433.Uint8Array.from(_0x3cb0ec);
      } else {
        if (_0x334433.isArrayBuffer(_0x3cb0ec)) {
          _0x3cb0ec = new Uint8Array(_0x3cb0ec);
        } else {
          if (typeof _0x3cb0ec === "string") {
            return _0x334433.from.call(_0x9bb6be, _0x3cb0ec);
          } else {
            if (typeof _0x3cb0ec === "number") {
              throw new TypeError("\"value\" argument must not be a number");
            }
          }
        }
      }
      return Array.prototype.slice.call(_0x3cb0ec);
    }
  },
  './node_modules/msgpack-lite/lib/bufferish-buffer.js': function (_0x10e22a, _0x2b69cd, _0x58fd89) {
    var _0x1db481 = _0x58fd89("./node_modules/msgpack-lite/lib/bufferish.js");
    var _0x50fc2e = _0x1db481.global;
    var _0x2b69cd = _0x10e22a.exports = _0x1db481.hasBuffer ? _0x381a1c(0) : [];
    _0x2b69cd.alloc = _0x1db481.hasBuffer && _0x50fc2e.alloc || _0x381a1c;
    _0x2b69cd.concat = _0x1db481.concat;
    _0x2b69cd.from = _0x5321d4;
    function _0x381a1c(_0x224e22) {
      return new _0x50fc2e(_0x224e22);
    }
    function _0x5321d4(_0x40910e) {
      if (!_0x1db481.isBuffer(_0x40910e) && _0x1db481.isView(_0x40910e)) {
        _0x40910e = _0x1db481.Uint8Array.from(_0x40910e);
      } else {
        if (_0x1db481.isArrayBuffer(_0x40910e)) {
          _0x40910e = new Uint8Array(_0x40910e);
        } else {
          if (typeof _0x40910e === "string") {
            return _0x1db481.from.call(_0x2b69cd, _0x40910e);
          } else {
            if (typeof _0x40910e === "number") {
              throw new TypeError("\"value\" argument must not be a number");
            }
          }
        }
      }
      if (_0x50fc2e.from && _0x50fc2e.from.length !== 1) {
        return _0x50fc2e.from(_0x40910e);
      } else {
        return new _0x50fc2e(_0x40910e);
      }
    }
  },
  './node_modules/msgpack-lite/lib/bufferish-proto.js': function (_0x31fe17, _0x3500a7, _0x541bf7) {
    var _0x47f3bc = _0x541bf7("./node_modules/msgpack-lite/lib/buffer-lite.js");
    _0x3500a7.copy = _0x4e20b1;
    _0x3500a7.slice = _0xd1ca5;
    _0x3500a7.toString = _0x162da6;
    _0x3500a7.write = _0x435cc8("write");
    var _0x5da658 = _0x541bf7("./node_modules/msgpack-lite/lib/bufferish.js");
    var _0x22e297 = _0x5da658.global;
    var _0x48236 = _0x5da658.hasBuffer && "TYPED_ARRAY_SUPPORT" in _0x22e297;
    var _0x57cf53 = _0x48236 && !_0x22e297.TYPED_ARRAY_SUPPORT;
    function _0x4e20b1(_0x271caa, _0x350df8, _0x522147, _0x2879a6) {
      var _0x561723 = _0x5da658.isBuffer(this);
      var _0x787911 = _0x5da658.isBuffer(_0x271caa);
      if (_0x561723 && _0x787911) {
        return this.copy(_0x271caa, _0x350df8, _0x522147, _0x2879a6);
      } else {
        if (!_0x57cf53 && !_0x561723 && !_0x787911 && _0x5da658.isView(this) && _0x5da658.isView(_0x271caa)) {
          var _0x587821 = _0x522147 || _0x2879a6 != null ? _0xd1ca5.call(this, _0x522147, _0x2879a6) : this;
          _0x271caa.set(_0x587821, _0x350df8);
          return _0x587821.length;
        } else {
          return _0x47f3bc.copy.call(this, _0x271caa, _0x350df8, _0x522147, _0x2879a6);
        }
      }
    }
    function _0xd1ca5(_0x3135c1, _0x58a439) {
      var _0x9ab9f8 = this.slice || !_0x57cf53 && this.subarray;
      if (_0x9ab9f8) {
        return _0x9ab9f8.call(this, _0x3135c1, _0x58a439);
      }
      var _0x2f4568 = _0x5da658.alloc.call(this, _0x58a439 - _0x3135c1);
      _0x4e20b1.call(this, _0x2f4568, 0, _0x3135c1, _0x58a439);
      return _0x2f4568;
    }
    function _0x162da6(_0x5de1bb, _0x5590d8, _0x1790c3) {
      var _0x13a431 = !_0x48236 && _0x5da658.isBuffer(this) ? this.toString : _0x47f3bc.toString;
      return _0x13a431.apply(this, arguments);
    }
    function _0x435cc8(_0x1ac8dc) {
      return _0x47d2c4;
      function _0x47d2c4() {
        var _0x5d5539 = this[_0x1ac8dc] || _0x47f3bc[_0x1ac8dc];
        return _0x5d5539.apply(this, arguments);
      }
    }
  },
  './node_modules/msgpack-lite/lib/bufferish-uint8array.js': function (_0x369ea2, _0x274b48, _0x31852f) {
    var _0x22245f = _0x31852f("./node_modules/msgpack-lite/lib/bufferish.js");
    var _0x274b48 = _0x369ea2.exports = _0x22245f.hasArrayBuffer ? _0x24fced(0) : [];
    _0x274b48.alloc = _0x24fced;
    _0x274b48.concat = _0x22245f.concat;
    _0x274b48.from = _0x474b7c;
    function _0x24fced(_0x5997bf) {
      return new Uint8Array(_0x5997bf);
    }
    function _0x474b7c(_0x550d73) {
      if (_0x22245f.isView(_0x550d73)) {
        var _0x5ea926 = _0x550d73.byteOffset;
        var _0x3a2f17 = _0x550d73.byteLength;
        _0x550d73 = _0x550d73.buffer;
        if (_0x550d73.byteLength !== _0x3a2f17) {
          if (_0x550d73.slice) {
            _0x550d73 = _0x550d73.slice(_0x5ea926, _0x5ea926 + _0x3a2f17);
          } else {
            _0x550d73 = new Uint8Array(_0x550d73);
            if (_0x550d73.byteLength !== _0x3a2f17) {
              _0x550d73 = Array.prototype.slice.call(_0x550d73, _0x5ea926, _0x5ea926 + _0x3a2f17);
            }
          }
        }
      } else {
        if (typeof _0x550d73 === "string") {
          return _0x22245f.from.call(_0x274b48, _0x550d73);
        } else {
          if (typeof _0x550d73 === "number") {
            throw new TypeError("\"value\" argument must not be a number");
          }
        }
      }
      return new Uint8Array(_0x550d73);
    }
  },
  './node_modules/msgpack-lite/lib/bufferish.js': function (_0xff914c, _0x4c1085, _0x5aa72b) {
    var _0x5df523 = _0x4c1085.global = _0x5aa72b("./node_modules/msgpack-lite/lib/buffer-global.js");
    var _0x194c78 = _0x4c1085.hasBuffer = _0x5df523 && !!_0x5df523.isBuffer;
    var _0x3d781b = _0x4c1085.hasArrayBuffer = "undefined" !== typeof ArrayBuffer;
    var _0x55b10b = _0x4c1085.isArray = _0x5aa72b("./node_modules/msgpack-lite/node_modules/isarray/index.js");
    _0x4c1085.isArrayBuffer = _0x3d781b ? _0x4cd395 : _0xab7ea3;
    var _0x4396bc = _0x4c1085.isBuffer = _0x194c78 ? _0x5df523.isBuffer : _0xab7ea3;
    var _0x18f211 = _0x4c1085.isView = _0x3d781b ? ArrayBuffer.isView || _0x488559("ArrayBuffer", "buffer") : _0xab7ea3;
    _0x4c1085.alloc = _0x551c0a;
    _0x4c1085.concat = _0xd635fb;
    _0x4c1085.from = _0x50b837;
    var _0x3d59f1 = _0x4c1085.Array = _0x5aa72b("./node_modules/msgpack-lite/lib/bufferish-array.js");
    var _0x1ac6d3 = _0x4c1085.Buffer = _0x5aa72b("./node_modules/msgpack-lite/lib/bufferish-buffer.js");
    var _0x347e88 = _0x4c1085.Uint8Array = _0x5aa72b("./node_modules/msgpack-lite/lib/bufferish-uint8array.js");
    var _0xa15496 = _0x4c1085.prototype = _0x5aa72b("./node_modules/msgpack-lite/lib/bufferish-proto.js");
    function _0x50b837(_0x4d363f) {
      if (typeof _0x4d363f === "string") {
        return _0x4b9fc0.call(this, _0x4d363f);
      } else {
        return _0x101831(this).from(_0x4d363f);
      }
    }
    function _0x551c0a(_0x236861) {
      return _0x101831(this).alloc(_0x236861);
    }
    function _0xd635fb(_0x180de1, _0x400219) {
      !_0x400219 && (_0x400219 = 0, Array.prototype.forEach.call(_0x180de1, _0x5f0e1a));
      var _0x19bc96 = this !== _0x4c1085 && this || _0x180de1[0];
      var _0x3b996c = _0x551c0a.call(_0x19bc96, _0x400219);
      var _0x2a3191 = 0;
      Array.prototype.forEach.call(_0x180de1, _0x485772);
      return _0x3b996c;
      function _0x5f0e1a(_0x91351d) {
        _0x400219 += _0x91351d.length;
      }
      function _0x485772(_0x47f669) {
        _0x2a3191 += _0xa15496.copy.call(_0x47f669, _0x3b996c, _0x2a3191);
      }
    }
    var _0x1ea19f = _0x488559("ArrayBuffer");
    function _0x4cd395(_0x2488a4) {
      return _0x2488a4 instanceof ArrayBuffer || _0x1ea19f(_0x2488a4);
    }
    function _0x4b9fc0(_0x57b76e) {
      var _0x4c0125 = _0x57b76e.length * 3;
      var _0x2d1643 = _0x551c0a.call(this, _0x4c0125);
      var _0xba9870 = _0xa15496.write.call(_0x2d1643, _0x57b76e);
      _0x4c0125 !== _0xba9870 && (_0x2d1643 = _0xa15496.slice.call(_0x2d1643, 0, _0xba9870));
      return _0x2d1643;
    }
    function _0x101831(_0x21ec3b) {
      return _0x4396bc(_0x21ec3b) ? _0x1ac6d3 : _0x18f211(_0x21ec3b) ? _0x347e88 : _0x55b10b(_0x21ec3b) ? _0x3d59f1 : _0x194c78 ? _0x1ac6d3 : _0x3d781b ? _0x347e88 : _0x3d59f1;
    }
    function _0xab7ea3() {
      return false;
    }
    function _0x488559(_0x5affa8, _0x2da811) {
      _0x5affa8 = "[object " + _0x5affa8 + ']';
      return function (_0x30a2f8) {
        return _0x30a2f8 != null && {}.toString.call(_0x2da811 ? _0x30a2f8[_0x2da811] : _0x30a2f8) === _0x5affa8;
      };
    }
  },
  './node_modules/msgpack-lite/lib/codec-base.js': function (_0x260ed9, _0x1cc9ef, _0x53dab2) {
    var _0x20e563 = _0x53dab2("./node_modules/msgpack-lite/node_modules/isarray/index.js");
    _0x1cc9ef.createCodec = _0x2f6837;
    _0x1cc9ef.install = _0x5ec310;
    _0x1cc9ef.filter = _0x42bf21;
    var _0x49b708 = _0x53dab2("./node_modules/msgpack-lite/lib/bufferish.js");
    function _0xcdfe11(_0x59e899) {
      if (!(this instanceof _0xcdfe11)) {
        return new _0xcdfe11(_0x59e899);
      }
      this.options = _0x59e899;
      this.init();
    }
    _0xcdfe11.prototype.init = function () {
      var _0xaf736 = this.options;
      if (_0xaf736 && _0xaf736.uint8array) {
        this.bufferish = _0x49b708.Uint8Array;
      }
      return this;
    };
    function _0x5ec310(_0x36f869) {
      for (var _0x159375 in _0x36f869) {
        _0xcdfe11.prototype[_0x159375] = _0x2b084(_0xcdfe11.prototype[_0x159375], _0x36f869[_0x159375]);
      }
    }
    function _0x2b084(_0x593e4e, _0x1da351) {
      return _0x593e4e && _0x1da351 ? _0x59087f : _0x593e4e || _0x1da351;
      function _0x59087f() {
        _0x593e4e.apply(this, arguments);
        return _0x1da351.apply(this, arguments);
      }
    }
    function _0x26846a(_0x307a76) {
      _0x307a76 = _0x307a76.slice();
      return function (_0x2ac9a3) {
        return _0x307a76.reduce(_0x4a6e1a, _0x2ac9a3);
      };
      function _0x4a6e1a(_0x301638, _0x334fba) {
        return _0x334fba(_0x301638);
      }
    }
    function _0x42bf21(_0x238e10) {
      return _0x20e563(_0x238e10) ? _0x26846a(_0x238e10) : _0x238e10;
    }
    function _0x2f6837(_0x17b663) {
      return new _0xcdfe11(_0x17b663);
    }
    var _0x54bab2 = {
      preset: true
    };
    _0x1cc9ef.preset = _0x2f6837(_0x54bab2);
  },
  './node_modules/msgpack-lite/lib/codec.js': function (_0x273d6e, _0x5f3716, _0x3fddf6) {
    _0x3fddf6("./node_modules/msgpack-lite/lib/read-core.js");
    _0x3fddf6("./node_modules/msgpack-lite/lib/write-core.js");
    _0x5f3716.codec = {
      preset: _0x3fddf6("./node_modules/msgpack-lite/lib/codec-base.js").preset
    };
  },
  './node_modules/msgpack-lite/lib/decode-buffer.js': function (_0x2fe435, _0x3f7e92, _0x3890cc) {
    _0x3f7e92.DecodeBuffer = _0x341996;
    var _0x110f4e = _0x3890cc("./node_modules/msgpack-lite/lib/read-core.js").preset;
    var _0x4dae59 = _0x3890cc("./node_modules/msgpack-lite/lib/flex-buffer.js").FlexDecoder;
    _0x4dae59.mixin(_0x341996.prototype);
    function _0x341996(_0x289424) {
      if (!(this instanceof _0x341996)) {
        return new _0x341996(_0x289424);
      }
      if (_0x289424) {
        this.options = _0x289424;
        if (_0x289424.codec) {
          var _0x5b5939 = this.codec = _0x289424.codec;
          if (_0x5b5939.bufferish) {
            this.bufferish = _0x5b5939.bufferish;
          }
        }
      }
    }
    _0x341996.prototype.codec = _0x110f4e;
    _0x341996.prototype.fetch = function () {
      return this.codec.decode(this);
    };
  },
  './node_modules/msgpack-lite/lib/decode.js': function (_0x343ed3, _0x59f410, _0x3238bc) {
    _0x59f410.decode = _0x5f5b0c;
    var _0xfd2a8d = _0x3238bc("./node_modules/msgpack-lite/lib/decode-buffer.js").DecodeBuffer;
    function _0x5f5b0c(_0x4c323a, _0xee0b30) {
      var _0x157395 = new _0xfd2a8d(_0xee0b30);
      _0x157395.write(_0x4c323a);
      return _0x157395.read();
    }
  },
  './node_modules/msgpack-lite/lib/decoder.js': function (_0x3238d4, _0x347b2e, _0x2e1ba7) {
    _0x347b2e.Decoder = _0x18fe0a;
    var _0x16cec0 = _0x2e1ba7("./node_modules/event-lite/event-lite.js");
    var _0x39853f = _0x2e1ba7("./node_modules/msgpack-lite/lib/decode-buffer.js").DecodeBuffer;
    function _0x18fe0a(_0x3ce6f5) {
      if (!(this instanceof _0x18fe0a)) {
        return new _0x18fe0a(_0x3ce6f5);
      }
      _0x39853f.call(this, _0x3ce6f5);
    }
    _0x18fe0a.prototype = new _0x39853f();
    _0x16cec0.mixin(_0x18fe0a.prototype);
    _0x18fe0a.prototype.decode = function (_0x29c3dd) {
      if (arguments.length) {
        this.write(_0x29c3dd);
      }
      this.flush();
    };
    _0x18fe0a.prototype.push = function (_0xc8bad8) {
      this.emit("data", _0xc8bad8);
    };
    _0x18fe0a.prototype.end = function (_0x5eac04) {
      this.decode(_0x5eac04), this.emit("end");
    };
  },
  './node_modules/msgpack-lite/lib/encode-buffer.js': function (_0x2b252e, _0x3b9df8, _0x264d6f) {
    _0x3b9df8.EncodeBuffer = _0x549bfd;
    var _0x4897bb = _0x264d6f("./node_modules/msgpack-lite/lib/write-core.js").preset;
    var _0x4e33c5 = _0x264d6f("./node_modules/msgpack-lite/lib/flex-buffer.js").FlexEncoder;
    _0x4e33c5.mixin(_0x549bfd.prototype);
    function _0x549bfd(_0x23617) {
      if (!(this instanceof _0x549bfd)) {
        return new _0x549bfd(_0x23617);
      }
      if (_0x23617) {
        this.options = _0x23617;
        if (_0x23617.codec) {
          var _0x362b74 = this.codec = _0x23617.codec;
          if (_0x362b74.bufferish) {
            this.bufferish = _0x362b74.bufferish;
          }
        }
      }
    }
    _0x549bfd.prototype.codec = _0x4897bb;
    _0x549bfd.prototype.write = function (_0x315f19) {
      this.codec.encode(this, _0x315f19);
    };
  },
  './node_modules/msgpack-lite/lib/encode.js': function (_0xed5448, _0xb6780a, _0x187bcc) {
    _0xb6780a.encode = _0x5cc7b7;
    var _0x5526fe = _0x187bcc("./node_modules/msgpack-lite/lib/encode-buffer.js").EncodeBuffer;
    function _0x5cc7b7(_0x16788f, _0x3e00ee) {
      var _0x43df1f = new _0x5526fe(_0x3e00ee);
      _0x43df1f.write(_0x16788f);
      return _0x43df1f.read();
    }
  },
  './node_modules/msgpack-lite/lib/encoder.js': function (_0x51804c, _0xaffc9c, _0x559381) {
    _0xaffc9c.Encoder = _0x3611d7;
    var _0x27225d = _0x559381("./node_modules/event-lite/event-lite.js");
    var _0xf829de = _0x559381("./node_modules/msgpack-lite/lib/encode-buffer.js").EncodeBuffer;
    function _0x3611d7(_0x4d2b20) {
      if (!(this instanceof _0x3611d7)) {
        return new _0x3611d7(_0x4d2b20);
      }
      _0xf829de.call(this, _0x4d2b20);
    }
    _0x3611d7.prototype = new _0xf829de();
    _0x27225d.mixin(_0x3611d7.prototype);
    _0x3611d7.prototype.encode = function (_0x3c1d7b) {
      this.write(_0x3c1d7b), this.emit("data", this.read());
    };
    _0x3611d7.prototype.end = function (_0x1829ee) {
      if (arguments.length) {
        this.encode(_0x1829ee);
      }
      this.flush();
      this.emit("end");
    };
  },
  './node_modules/msgpack-lite/lib/ext-buffer.js': function (_0x5dd791, _0x10c665, _0x1e3167) {
    _0x10c665.ExtBuffer = _0x1b957b;
    var _0x17d31b = _0x1e3167("./node_modules/msgpack-lite/lib/bufferish.js");
    function _0x1b957b(_0x130bdf, _0x46f47e) {
      if (!(this instanceof _0x1b957b)) {
        return new _0x1b957b(_0x130bdf, _0x46f47e);
      }
      this.buffer = _0x17d31b.from(_0x130bdf);
      this.type = _0x46f47e;
    }
  },
  './node_modules/msgpack-lite/lib/ext-packer.js': function (_0x296766, _0x4a8ffa, _0x25956a) {
    _0x4a8ffa.setExtPackers = _0x115584;
    var _0x2cf992 = _0x25956a("./node_modules/msgpack-lite/lib/bufferish.js");
    var _0x2f776b = _0x2cf992.global;
    var _0x35237e = _0x2cf992.Uint8Array.from;
    var _0x42c108;
    var _0x29301f = {
      name: 0x1,
      message: 0x1,
      stack: 0x1,
      columnNumber: 0x1,
      fileName: 0x1,
      lineNumber: 0x1
    };
    function _0x115584(_0x345998) {
      _0x345998.addExtPacker(14, Error, [_0x530a86, _0x33ef55]), _0x345998.addExtPacker(1, EvalError, [_0x530a86, _0x33ef55]), _0x345998.addExtPacker(2, RangeError, [_0x530a86, _0x33ef55]), _0x345998.addExtPacker(3, ReferenceError, [_0x530a86, _0x33ef55]), _0x345998.addExtPacker(4, SyntaxError, [_0x530a86, _0x33ef55]), _0x345998.addExtPacker(5, TypeError, [_0x530a86, _0x33ef55]), _0x345998.addExtPacker(6, URIError, [_0x530a86, _0x33ef55]), _0x345998.addExtPacker(10, RegExp, [_0x51b737, _0x33ef55]), _0x345998.addExtPacker(11, Boolean, [_0x12bc6c, _0x33ef55]), _0x345998.addExtPacker(12, String, [_0x12bc6c, _0x33ef55]), _0x345998.addExtPacker(13, Date, [Number, _0x33ef55]), _0x345998.addExtPacker(15, Number, [_0x12bc6c, _0x33ef55]), "undefined" !== typeof Uint8Array && (_0x345998.addExtPacker(17, Int8Array, _0x35237e), _0x345998.addExtPacker(18, Uint8Array, _0x35237e), _0x345998.addExtPacker(19, Int16Array, _0x35237e), _0x345998.addExtPacker(20, Uint16Array, _0x35237e), _0x345998.addExtPacker(21, Int32Array, _0x35237e), _0x345998.addExtPacker(22, Uint32Array, _0x35237e), _0x345998.addExtPacker(23, Float32Array, _0x35237e), "undefined" !== typeof Float64Array && _0x345998.addExtPacker(24, Float64Array, _0x35237e), "undefined" !== typeof Uint8ClampedArray && _0x345998.addExtPacker(25, Uint8ClampedArray, _0x35237e), _0x345998.addExtPacker(26, ArrayBuffer, _0x35237e), _0x345998.addExtPacker(29, DataView, _0x35237e)), _0x2cf992.hasBuffer && _0x345998.addExtPacker(27, _0x2f776b, _0x2cf992.from);
    }
    function _0x33ef55(_0x1dd223) {
      if (!_0x42c108) {
        _0x42c108 = _0x25956a("./node_modules/msgpack-lite/lib/encode.js").encode;
      }
      return _0x42c108(_0x1dd223);
    }
    function _0x12bc6c(_0x12e2c6) {
      return _0x12e2c6.valueOf();
    }
    function _0x51b737(_0x434440) {
      _0x434440 = RegExp.prototype.toString.call(_0x434440).split('/');
      _0x434440.shift();
      var _0x5446c3 = [_0x434440.pop()];
      _0x5446c3.unshift(_0x434440.join('/'));
      return _0x5446c3;
    }
    function _0x530a86(_0x2cd774) {
      var _0x29e7ab = {};
      for (var _0x4cb868 in _0x29301f) {
        _0x29e7ab[_0x4cb868] = _0x2cd774[_0x4cb868];
      }
      return _0x29e7ab;
    }
  },
  './node_modules/msgpack-lite/lib/ext-unpacker.js': function (_0x265e90, _0x29c9c4, _0x2b4dea) {
    _0x29c9c4.setExtUnpackers = _0x400673;
    var _0xd6f1a4 = _0x2b4dea("./node_modules/msgpack-lite/lib/bufferish.js");
    var _0x4dda4c = _0xd6f1a4.global;
    var _0x351ede;
    var _0x1a6f70 = {
      name: 0x1,
      message: 0x1,
      stack: 0x1,
      columnNumber: 0x1,
      fileName: 0x1,
      lineNumber: 0x1
    };
    function _0x400673(_0x5d3f68) {
      _0x5d3f68.addExtUnpacker(14, [_0x435f85, _0x3b0bfd(Error)]);
      _0x5d3f68.addExtUnpacker(1, [_0x435f85, _0x3b0bfd(EvalError)]);
      _0x5d3f68.addExtUnpacker(2, [_0x435f85, _0x3b0bfd(RangeError)]);
      _0x5d3f68.addExtUnpacker(3, [_0x435f85, _0x3b0bfd(ReferenceError)]);
      _0x5d3f68.addExtUnpacker(4, [_0x435f85, _0x3b0bfd(SyntaxError)]);
      _0x5d3f68.addExtUnpacker(5, [_0x435f85, _0x3b0bfd(TypeError)]);
      _0x5d3f68.addExtUnpacker(6, [_0x435f85, _0x3b0bfd(URIError)]);
      _0x5d3f68.addExtUnpacker(10, [_0x435f85, _0x31bf0e]);
      _0x5d3f68.addExtUnpacker(11, [_0x435f85, _0x9ccc86(Boolean)]);
      _0x5d3f68.addExtUnpacker(12, [_0x435f85, _0x9ccc86(String)]);
      _0x5d3f68.addExtUnpacker(13, [_0x435f85, _0x9ccc86(Date)]);
      _0x5d3f68.addExtUnpacker(15, [_0x435f85, _0x9ccc86(Number)]);
      if ("undefined" !== typeof Uint8Array) {
        _0x5d3f68.addExtUnpacker(17, _0x9ccc86(Int8Array));
        _0x5d3f68.addExtUnpacker(18, _0x9ccc86(Uint8Array));
        _0x5d3f68.addExtUnpacker(19, [_0x2e5be6, _0x9ccc86(Int16Array)]);
        _0x5d3f68.addExtUnpacker(20, [_0x2e5be6, _0x9ccc86(Uint16Array)]);
        _0x5d3f68.addExtUnpacker(21, [_0x2e5be6, _0x9ccc86(Int32Array)]);
        _0x5d3f68.addExtUnpacker(22, [_0x2e5be6, _0x9ccc86(Uint32Array)]);
        _0x5d3f68.addExtUnpacker(23, [_0x2e5be6, _0x9ccc86(Float32Array)]);
        if ("undefined" !== typeof Float64Array) {
          _0x5d3f68.addExtUnpacker(24, [_0x2e5be6, _0x9ccc86(Float64Array)]);
        }
        "undefined" !== typeof Uint8ClampedArray && _0x5d3f68.addExtUnpacker(25, _0x9ccc86(Uint8ClampedArray));
        _0x5d3f68.addExtUnpacker(26, _0x2e5be6);
        _0x5d3f68.addExtUnpacker(29, [_0x2e5be6, _0x9ccc86(DataView)]);
      }
      _0xd6f1a4.hasBuffer && _0x5d3f68.addExtUnpacker(27, _0x9ccc86(_0x4dda4c));
    }
    function _0x435f85(_0x1dcd0b) {
      if (!_0x351ede) {
        _0x351ede = _0x2b4dea("./node_modules/msgpack-lite/lib/decode.js").decode;
      }
      return _0x351ede(_0x1dcd0b);
    }
    function _0x31bf0e(_0xfc4be2) {
      return RegExp.apply(null, _0xfc4be2);
    }
    function _0x3b0bfd(_0x194934) {
      return function (_0x398a8a) {
        var _0x145f6f = new _0x194934();
        for (var _0x493278 in _0x1a6f70) {
          _0x145f6f[_0x493278] = _0x398a8a[_0x493278];
        }
        return _0x145f6f;
      };
    }
    function _0x9ccc86(_0x41a914) {
      return function (_0x5bcde4) {
        return new _0x41a914(_0x5bcde4);
      };
    }
    function _0x2e5be6(_0x1b6dea) {
      return new Uint8Array(_0x1b6dea).buffer;
    }
  },
  './node_modules/msgpack-lite/lib/ext.js': function (_0x5ac763, _0x34a9e8, _0x415ae1) {
    _0x415ae1("./node_modules/msgpack-lite/lib/read-core.js");
    _0x415ae1("./node_modules/msgpack-lite/lib/write-core.js");
    _0x34a9e8.createCodec = _0x415ae1("./node_modules/msgpack-lite/lib/codec-base.js").createCodec;
  },
  './node_modules/msgpack-lite/lib/flex-buffer.js': function (_0x1628ef, _0x1700c8, _0x2c4adb) {
    _0x1700c8.FlexDecoder = _0x12993;
    _0x1700c8.FlexEncoder = _0x547bf9;
    var _0x41ddda = _0x2c4adb("./node_modules/msgpack-lite/lib/bufferish.js");
    var _0x44f19c = 2048;
    var _0x49fbd4 = 65536;
    var _0x2f344f = "BUFFER_SHORTAGE";
    function _0x12993() {
      if (!(this instanceof _0x12993)) {
        return new _0x12993();
      }
    }
    function _0x547bf9() {
      if (!(this instanceof _0x547bf9)) {
        return new _0x547bf9();
      }
    }
    _0x12993.mixin = _0x17075a(_0x1e8c11());
    _0x12993.mixin(_0x12993.prototype);
    _0x547bf9.mixin = _0x17075a(_0x430b41());
    _0x547bf9.mixin(_0x547bf9.prototype);
    function _0x1e8c11() {
      var _0x1937d7 = {
        bufferish: _0x41ddda,
        write: _0x1cdf5b,
        fetch: _0xf119d0,
        flush: _0x234821,
        push: _0x3f2b64,
        pull: _0x18992a,
        read: _0x41ff7e,
        reserve: _0x2f6f27,
        offset: 0x0
      };
      return _0x1937d7;
      function _0x1cdf5b(_0x2a9d0a) {
        var _0x43651d = this.offset ? _0x41ddda.prototype.slice.call(this.buffer, this.offset) : this.buffer;
        this.buffer = _0x43651d ? _0x2a9d0a ? this.bufferish.concat([_0x43651d, _0x2a9d0a]) : _0x43651d : _0x2a9d0a;
        this.offset = 0;
      }
      function _0x234821() {
        while (this.offset < this.buffer.length) {
          var _0x4c7290 = this.offset;
          var _0x80900f;
          try {
            _0x80900f = this.fetch();
          } catch (_0x17304e) {
            if (_0x17304e && _0x17304e.message != _0x2f344f) {
              throw _0x17304e;
            }
            this.offset = _0x4c7290;
            break;
          }
          this.push(_0x80900f);
        }
      }
      function _0x2f6f27(_0x253197) {
        var _0xf73410 = this.offset;
        var _0x28d10a = _0xf73410 + _0x253197;
        if (_0x28d10a > this.buffer.length) {
          throw new Error(_0x2f344f);
        }
        this.offset = _0x28d10a;
        return _0xf73410;
      }
    }
    function _0x430b41() {
      var _0x35194d = {
        bufferish: _0x41ddda,
        write: _0x2c0176,
        fetch: _0x302b75,
        flush: _0x55e911,
        push: _0x3f2b64,
        pull: _0x5067f7,
        read: _0x41ff7e,
        reserve: _0x13735f,
        send: _0x26dff6,
        maxBufferSize: _0x49fbd4,
        minBufferSize: _0x44f19c,
        offset: 0x0,
        start: 0x0
      };
      return _0x35194d;
      function _0x302b75() {
        var _0x2e1460 = this.start;
        if (_0x2e1460 < this.offset) {
          var _0x3d2354 = this.start = this.offset;
          return _0x41ddda.prototype.slice.call(this.buffer, _0x2e1460, _0x3d2354);
        }
      }
      function _0x55e911() {
        while (this.start < this.offset) {
          var _0xd711eb = this.fetch();
          if (_0xd711eb) {
            this.push(_0xd711eb);
          }
        }
      }
      function _0x5067f7() {
        var _0x274664 = this.buffers || (this.buffers = []);
        var _0x2464e4 = _0x274664.length > 1 ? this.bufferish.concat(_0x274664) : _0x274664[0];
        _0x274664.length = 0;
        return _0x2464e4;
      }
      function _0x13735f(_0x1d755a) {
        var _0x36d370 = _0x1d755a | 0;
        if (this.buffer) {
          var _0x202cfd = this.buffer.length;
          var _0x5b888b = this.offset | 0;
          var _0xbe3f5d = _0x5b888b + _0x36d370;
          if (_0xbe3f5d < _0x202cfd) {
            this.offset = _0xbe3f5d;
            return _0x5b888b;
          }
          this.flush();
          _0x1d755a = Math.max(_0x1d755a, Math.min(_0x202cfd * 2, this.maxBufferSize));
        }
        _0x1d755a = Math.max(_0x1d755a, this.minBufferSize);
        this.buffer = this.bufferish.alloc(_0x1d755a);
        this.start = 0;
        this.offset = _0x36d370;
        return 0;
      }
      function _0x26dff6(_0x277748) {
        var _0x3a8731 = _0x277748.length;
        if (_0x3a8731 > this.minBufferSize) {
          this.flush();
          this.push(_0x277748);
        } else {
          var _0x1c2eb5 = this.reserve(_0x3a8731);
          _0x41ddda.prototype.copy.call(_0x277748, this.buffer, _0x1c2eb5);
        }
      }
    }
    function _0x2c0176() {
      throw new Error("method not implemented: write()");
    }
    function _0xf119d0() {
      throw new Error("method not implemented: fetch()");
    }
    function _0x41ff7e() {
      var _0x387295 = this.buffers && this.buffers.length;
      if (!_0x387295) {
        return this.fetch();
      }
      this.flush();
      return this.pull();
    }
    function _0x3f2b64(_0x295883) {
      var _0x3f6006 = this.buffers || (this.buffers = []);
      _0x3f6006.push(_0x295883);
    }
    function _0x18992a() {
      var _0x3c1dc8 = this.buffers || (this.buffers = []);
      return _0x3c1dc8.shift();
    }
    function _0x17075a(_0x1bbaa8) {
      return _0x202b84;
      function _0x202b84(_0x3607f8) {
        for (var _0x457703 in _0x1bbaa8) {
          _0x3607f8[_0x457703] = _0x1bbaa8[_0x457703];
        }
        return _0x3607f8;
      }
    }
  },
  './node_modules/msgpack-lite/lib/read-core.js': function (_0x468a58, _0x394cab, _0x18bf8c) {
    var _0x15af5c = _0x18bf8c("./node_modules/msgpack-lite/lib/ext-buffer.js").ExtBuffer;
    var _0x306140 = _0x18bf8c("./node_modules/msgpack-lite/lib/ext-unpacker.js");
    var _0x443df6 = _0x18bf8c("./node_modules/msgpack-lite/lib/read-format.js").readUint8;
    var _0x203fff = _0x18bf8c("./node_modules/msgpack-lite/lib/read-token.js");
    var _0x5c7c30 = _0x18bf8c("./node_modules/msgpack-lite/lib/codec-base.js");
    var _0x8cdc65 = {
      addExtUnpacker: _0x18ae11,
      getExtUnpacker: _0x20542d,
      init: _0x34a6f7
    };
    _0x5c7c30.install(_0x8cdc65);
    _0x394cab.preset = _0x34a6f7.call(_0x5c7c30.preset);
    function _0x250ccc(_0x1c938f) {
      var _0x471bff = _0x203fff.getReadToken(_0x1c938f);
      return _0x37f131;
      function _0x37f131(_0x368073) {
        var _0x2a1e7d = _0x443df6(_0x368073);
        var _0x101d25 = _0x471bff[_0x2a1e7d];
        if (!_0x101d25) {
          throw new Error("Invalid type: " + (_0x2a1e7d ? '0x' + _0x2a1e7d.toString(16) : _0x2a1e7d));
        }
        return _0x101d25(_0x368073);
      }
    }
    function _0x34a6f7() {
      var _0x35b137 = this.options;
      this.decode = _0x250ccc(_0x35b137);
      _0x35b137 && _0x35b137.preset && _0x306140.setExtUnpackers(this);
      return this;
    }
    function _0x18ae11(_0x8d5d78, _0x56acb4) {
      var _0x611bac = this.extUnpackers || (this.extUnpackers = []);
      _0x611bac[_0x8d5d78] = _0x5c7c30.filter(_0x56acb4);
    }
    function _0x20542d(_0xa7d0f0) {
      var _0x423ae4 = this.extUnpackers || (this.extUnpackers = []);
      return _0x423ae4[_0xa7d0f0] || _0x30976d;
      function _0x30976d(_0x2272db) {
        return new _0x15af5c(_0x2272db, _0xa7d0f0);
      }
    }
  },
  './node_modules/msgpack-lite/lib/read-format.js': function (_0x5c759b, _0x2cc19a, _0x38b465) {
    var _0x37c272 = _0x38b465("./node_modules/ieee754/index.js");
    var _0x221d51 = _0x38b465("./node_modules/int64-buffer/int64-buffer.js");
    var _0x5bad59 = _0x221d51.Uint64BE;
    var _0x1cfc5a = _0x221d51.Int64BE;
    _0x2cc19a.getReadFormat = _0x24851e;
    _0x2cc19a.readUint8 = _0x36d5ad;
    var _0x34c2e6 = _0x38b465("./node_modules/msgpack-lite/lib/bufferish.js");
    var _0x5de5f1 = _0x38b465("./node_modules/msgpack-lite/lib/bufferish-proto.js");
    var _0x123cca = "undefined" !== typeof Map;
    var _0x1854ed = true;
    function _0x24851e(_0x350dff) {
      var _0x23c2cd = _0x34c2e6.hasArrayBuffer && _0x350dff && _0x350dff.binarraybuffer;
      var _0x17c031 = _0x350dff && _0x350dff.int64;
      var _0x33c413 = _0x123cca && _0x350dff && _0x350dff.usemap;
      var _0xf1f956 = {
        map: _0x33c413 ? _0x3ffc29 : _0x4d2c1e,
        array: _0x3f5126,
        str: _0x63abab,
        bin: _0x23c2cd ? _0x233de7 : _0x31922b,
        ext: _0x50480e,
        uint8: _0x36d5ad,
        uint16: _0x458d2c,
        uint32: _0x4afecd,
        uint64: _0x1866a7(8, _0x17c031 ? _0x164bbb : _0x256527),
        int8: _0x1458dc,
        int16: _0x251c5d,
        int32: _0x8893bc,
        int64: _0x1866a7(8, _0x17c031 ? _0x1b21dd : _0x4f261b),
        float32: _0x1866a7(4, _0x2572a4),
        float64: _0x1866a7(8, _0x589fd1)
      };
      return _0xf1f956;
    }
    function _0x4d2c1e(_0x582067, _0x1095a7) {
      var _0x38d348 = {};
      var _0x268c40;
      var _0x13a39f = new Array(_0x1095a7);
      var _0x8ab0d6 = new Array(_0x1095a7);
      var _0x350eaa = _0x582067.codec.decode;
      for (_0x268c40 = 0; _0x268c40 < _0x1095a7; _0x268c40++) {
        _0x13a39f[_0x268c40] = _0x350eaa(_0x582067), _0x8ab0d6[_0x268c40] = _0x350eaa(_0x582067);
      }
      for (_0x268c40 = 0; _0x268c40 < _0x1095a7; _0x268c40++) {
        _0x38d348[_0x13a39f[_0x268c40]] = _0x8ab0d6[_0x268c40];
      }
      return _0x38d348;
    }
    function _0x3ffc29(_0x764411, _0x290cb8) {
      var _0xcdc32b = new Map();
      var _0x31ed47;
      var _0x2546e6 = new Array(_0x290cb8);
      var _0x4f0ab3 = new Array(_0x290cb8);
      var _0x31b6fd = _0x764411.codec.decode;
      for (_0x31ed47 = 0; _0x31ed47 < _0x290cb8; _0x31ed47++) {
        _0x2546e6[_0x31ed47] = _0x31b6fd(_0x764411);
        _0x4f0ab3[_0x31ed47] = _0x31b6fd(_0x764411);
      }
      for (_0x31ed47 = 0; _0x31ed47 < _0x290cb8; _0x31ed47++) {
        _0xcdc32b.set(_0x2546e6[_0x31ed47], _0x4f0ab3[_0x31ed47]);
      }
      return _0xcdc32b;
    }
    function _0x3f5126(_0xb87337, _0x183e34) {
      var _0x1d91c3 = new Array(_0x183e34);
      var _0x16db4b = _0xb87337.codec.decode;
      for (var _0x45e6d2 = 0; _0x45e6d2 < _0x183e34; _0x45e6d2++) {
        _0x1d91c3[_0x45e6d2] = _0x16db4b(_0xb87337);
      }
      return _0x1d91c3;
    }
    function _0x63abab(_0x1840d4, _0x3ed8da) {
      var _0x282c98 = _0x1840d4.reserve(_0x3ed8da);
      var _0x1fc8c3 = _0x282c98 + _0x3ed8da;
      return _0x5de5f1.toString.call(_0x1840d4.buffer, "utf-8", _0x282c98, _0x1fc8c3);
    }
    function _0x31922b(_0xb83255, _0x38d691) {
      var _0x1a4e11 = _0xb83255.reserve(_0x38d691);
      var _0x5da7a7 = _0x1a4e11 + _0x38d691;
      var _0x266c91 = _0x5de5f1.slice.call(_0xb83255.buffer, _0x1a4e11, _0x5da7a7);
      return _0x34c2e6.from(_0x266c91);
    }
    function _0x233de7(_0x44fca1, _0x17d22a) {
      var _0x393dda = _0x44fca1.reserve(_0x17d22a);
      var _0x57b86f = _0x393dda + _0x17d22a;
      var _0x2de52c = _0x5de5f1.slice.call(_0x44fca1.buffer, _0x393dda, _0x57b86f);
      return _0x34c2e6.Uint8Array.from(_0x2de52c).buffer;
    }
    function _0x50480e(_0xbc10aa, _0x5831d3) {
      var _0x21ff57 = _0xbc10aa.reserve(_0x5831d3 + 1);
      var _0x1eeaed = _0xbc10aa.buffer[_0x21ff57++];
      var _0x3bc5a8 = _0x21ff57 + _0x5831d3;
      var _0x50e4f8 = _0xbc10aa.codec.getExtUnpacker(_0x1eeaed);
      if (!_0x50e4f8) {
        throw new Error("Invalid ext type: " + (_0x1eeaed ? '0x' + _0x1eeaed.toString(16) : _0x1eeaed));
      }
      var _0x5ca20c = _0x5de5f1.slice.call(_0xbc10aa.buffer, _0x21ff57, _0x3bc5a8);
      return _0x50e4f8(_0x5ca20c);
    }
    function _0x36d5ad(_0x5b1426) {
      var _0x502984 = _0x5b1426.reserve(1);
      return _0x5b1426.buffer[_0x502984];
    }
    function _0x1458dc(_0x539f5c) {
      var _0x5d2094 = _0x539f5c.reserve(1);
      var _0x365bd9 = _0x539f5c.buffer[_0x5d2094];
      return _0x365bd9 & 128 ? _0x365bd9 - 256 : _0x365bd9;
    }
    function _0x458d2c(_0x12cf75) {
      var _0x4ab169 = _0x12cf75.reserve(2);
      var _0x3f837c = _0x12cf75.buffer;
      return _0x3f837c[_0x4ab169++] << 8 | _0x3f837c[_0x4ab169];
    }
    function _0x251c5d(_0x2ea5ae) {
      var _0x22e540 = _0x2ea5ae.reserve(2);
      var _0x3a50d8 = _0x2ea5ae.buffer;
      var _0x15596e = _0x3a50d8[_0x22e540++] << 8 | _0x3a50d8[_0x22e540];
      return _0x15596e & 32768 ? _0x15596e - 65536 : _0x15596e;
    }
    function _0x4afecd(_0x5dccbe) {
      var _0x4eb858 = _0x5dccbe.reserve(4);
      var _0x3166f4 = _0x5dccbe.buffer;
      return _0x3166f4[_0x4eb858++] * 16777216 + (_0x3166f4[_0x4eb858++] << 16) + (_0x3166f4[_0x4eb858++] << 8) + _0x3166f4[_0x4eb858];
    }
    function _0x8893bc(_0x403598) {
      var _0x4df62b = _0x403598.reserve(4);
      var _0x352d2a = _0x403598.buffer;
      return _0x352d2a[_0x4df62b++] << 24 | _0x352d2a[_0x4df62b++] << 16 | _0x352d2a[_0x4df62b++] << 8 | _0x352d2a[_0x4df62b];
    }
    function _0x1866a7(_0x439cc4, _0x4c853f) {
      return function (_0x2a3773) {
        var _0x366455 = _0x2a3773.reserve(_0x439cc4);
        return _0x4c853f.call(_0x2a3773.buffer, _0x366455, _0x1854ed);
      };
    }
    function _0x256527(_0xf64bd1) {
      return new _0x5bad59(this, _0xf64bd1).toNumber();
    }
    function _0x4f261b(_0x33d81f) {
      return new _0x1cfc5a(this, _0x33d81f).toNumber();
    }
    function _0x164bbb(_0x26a54a) {
      return new _0x5bad59(this, _0x26a54a);
    }
    function _0x1b21dd(_0x194a0d) {
      return new _0x1cfc5a(this, _0x194a0d);
    }
    function _0x2572a4(_0xd40d62) {
      return _0x37c272.read(this, _0xd40d62, false, 23, 4);
    }
    function _0x589fd1(_0x343e3f) {
      return _0x37c272.read(this, _0x343e3f, false, 52, 8);
    }
  },
  './node_modules/msgpack-lite/lib/read-token.js': function (_0x1da483, _0x2c9535, _0x500a28) {
    var _0x41239f = _0x500a28("./node_modules/msgpack-lite/lib/read-format.js");
    _0x2c9535.getReadToken = _0x1f45e2;
    function _0x1f45e2(_0x5ef00b) {
      var _0x147139 = _0x41239f.getReadFormat(_0x5ef00b);
      if (_0x5ef00b && _0x5ef00b.useraw) {
        return _0x592381(_0x147139);
      } else {
        return _0x44bfa7(_0x147139);
      }
    }
    function _0x44bfa7(_0x37f1ac) {
      var _0x1d4624;
      var _0x37cf67 = new Array(256);
      for (_0x1d4624 = 0; _0x1d4624 <= 127; _0x1d4624++) {
        _0x37cf67[_0x1d4624] = _0x4a3b44(_0x1d4624);
      }
      for (_0x1d4624 = 128; _0x1d4624 <= 143; _0x1d4624++) {
        _0x37cf67[_0x1d4624] = _0x5a9c2c(_0x1d4624 - 128, _0x37f1ac.map);
      }
      for (_0x1d4624 = 144; _0x1d4624 <= 159; _0x1d4624++) {
        _0x37cf67[_0x1d4624] = _0x5a9c2c(_0x1d4624 - 144, _0x37f1ac.array);
      }
      for (_0x1d4624 = 160; _0x1d4624 <= 191; _0x1d4624++) {
        _0x37cf67[_0x1d4624] = _0x5a9c2c(_0x1d4624 - 160, _0x37f1ac.str);
      }
      _0x37cf67[192] = _0x4a3b44(null);
      _0x37cf67[193] = null;
      _0x37cf67[194] = _0x4a3b44(false);
      _0x37cf67[195] = _0x4a3b44(true);
      _0x37cf67[196] = _0x1c7580(_0x37f1ac.uint8, _0x37f1ac.bin);
      _0x37cf67[197] = _0x1c7580(_0x37f1ac.uint16, _0x37f1ac.bin);
      _0x37cf67[198] = _0x1c7580(_0x37f1ac.uint32, _0x37f1ac.bin);
      _0x37cf67[199] = _0x1c7580(_0x37f1ac.uint8, _0x37f1ac.ext);
      _0x37cf67[200] = _0x1c7580(_0x37f1ac.uint16, _0x37f1ac.ext);
      _0x37cf67[201] = _0x1c7580(_0x37f1ac.uint32, _0x37f1ac.ext);
      _0x37cf67[202] = _0x37f1ac.float32;
      _0x37cf67[203] = _0x37f1ac.float64;
      _0x37cf67[204] = _0x37f1ac.uint8;
      _0x37cf67[205] = _0x37f1ac.uint16;
      _0x37cf67[206] = _0x37f1ac.uint32;
      _0x37cf67[207] = _0x37f1ac.uint64;
      _0x37cf67[208] = _0x37f1ac.int8;
      _0x37cf67[209] = _0x37f1ac.int16;
      _0x37cf67[210] = _0x37f1ac.int32;
      _0x37cf67[211] = _0x37f1ac.int64;
      _0x37cf67[212] = _0x5a9c2c(1, _0x37f1ac.ext);
      _0x37cf67[213] = _0x5a9c2c(2, _0x37f1ac.ext);
      _0x37cf67[214] = _0x5a9c2c(4, _0x37f1ac.ext);
      _0x37cf67[215] = _0x5a9c2c(8, _0x37f1ac.ext);
      _0x37cf67[216] = _0x5a9c2c(16, _0x37f1ac.ext);
      _0x37cf67[217] = _0x1c7580(_0x37f1ac.uint8, _0x37f1ac.str);
      _0x37cf67[218] = _0x1c7580(_0x37f1ac.uint16, _0x37f1ac.str);
      _0x37cf67[219] = _0x1c7580(_0x37f1ac.uint32, _0x37f1ac.str);
      _0x37cf67[220] = _0x1c7580(_0x37f1ac.uint16, _0x37f1ac.array);
      _0x37cf67[221] = _0x1c7580(_0x37f1ac.uint32, _0x37f1ac.array);
      _0x37cf67[222] = _0x1c7580(_0x37f1ac.uint16, _0x37f1ac.map);
      _0x37cf67[223] = _0x1c7580(_0x37f1ac.uint32, _0x37f1ac.map);
      for (_0x1d4624 = 224; _0x1d4624 <= 255; _0x1d4624++) {
        _0x37cf67[_0x1d4624] = _0x4a3b44(_0x1d4624 - 256);
      }
      return _0x37cf67;
    }
    function _0x592381(_0x5e3711) {
      var _0x3822fb;
      var _0x547dc1 = _0x44bfa7(_0x5e3711).slice();
      _0x547dc1[217] = _0x547dc1[196];
      _0x547dc1[218] = _0x547dc1[197];
      _0x547dc1[219] = _0x547dc1[198];
      for (_0x3822fb = 160; _0x3822fb <= 191; _0x3822fb++) {
        _0x547dc1[_0x3822fb] = _0x5a9c2c(_0x3822fb - 160, _0x5e3711.bin);
      }
      return _0x547dc1;
    }
    function _0x4a3b44(_0x187828) {
      return function () {
        return _0x187828;
      };
    }
    function _0x1c7580(_0x9916bb, _0x2aaf18) {
      return function (_0x360d5c) {
        var _0x139d01 = _0x9916bb(_0x360d5c);
        return _0x2aaf18(_0x360d5c, _0x139d01);
      };
    }
    function _0x5a9c2c(_0x4c396a, _0x5175d4) {
      return function (_0x457f90) {
        return _0x5175d4(_0x457f90, _0x4c396a);
      };
    }
  },
  './node_modules/msgpack-lite/lib/write-core.js': function (_0x3553dc, _0x2f9f8c, _0x15a1a5) {
    var _0x519453 = _0x15a1a5("./node_modules/msgpack-lite/lib/ext-buffer.js").ExtBuffer;
    var _0x13e134 = _0x15a1a5("./node_modules/msgpack-lite/lib/ext-packer.js");
    var _0x325ca = _0x15a1a5("./node_modules/msgpack-lite/lib/write-type.js");
    var _0x147ceb = _0x15a1a5("./node_modules/msgpack-lite/lib/codec-base.js");
    var _0x4b82dc = {
      addExtPacker: _0x5efdc6,
      getExtPacker: _0x509b5b,
      init: _0x4f63d7
    };
    _0x147ceb.install(_0x4b82dc);
    _0x2f9f8c.preset = _0x4f63d7.call(_0x147ceb.preset);
    function _0x54b937(_0x5526b9) {
      var _0x3e376f = _0x325ca.getWriteType(_0x5526b9);
      return _0x211812;
      function _0x211812(_0x314180, _0x4142fd) {
        var _0x2bcd0f = _0x3e376f[typeof _0x4142fd];
        if (!_0x2bcd0f) {
          throw new Error("Unsupported type \"" + typeof _0x4142fd + "\": " + _0x4142fd);
        }
        _0x2bcd0f(_0x314180, _0x4142fd);
      }
    }
    function _0x4f63d7() {
      var _0x5bc489 = this.options;
      this.encode = _0x54b937(_0x5bc489);
      if (_0x5bc489 && _0x5bc489.preset) {
        _0x13e134.setExtPackers(this);
      }
      return this;
    }
    function _0x5efdc6(_0x5390a6, _0x35ad72, _0x34daa2) {
      _0x34daa2 = _0x147ceb.filter(_0x34daa2);
      var _0x480b8 = _0x35ad72.name;
      if (_0x480b8 && _0x480b8 !== "Object") {
        var _0x204f52 = this.extPackers || (this.extPackers = {});
        _0x204f52[_0x480b8] = _0x2662f3;
      } else {
        var _0x15804d = this.extEncoderList || (this.extEncoderList = []);
        _0x15804d.unshift([_0x35ad72, _0x2662f3]);
      }
      function _0x2662f3(_0x50c80f) {
        if (_0x34daa2) {
          _0x50c80f = _0x34daa2(_0x50c80f);
        }
        return new _0x519453(_0x50c80f, _0x5390a6);
      }
    }
    function _0x509b5b(_0x4c79ec) {
      var _0x4872ab = this.extPackers || (this.extPackers = {});
      var _0x13e168 = _0x4c79ec.constructor;
      var _0x1c2d0c = _0x13e168 && _0x13e168.name && _0x4872ab[_0x13e168.name];
      if (_0x1c2d0c) {
        return _0x1c2d0c;
      }
      var _0x2f6e9a = this.extEncoderList || (this.extEncoderList = []);
      var _0x13d6a1 = _0x2f6e9a.length;
      for (var _0x19947e = 0; _0x19947e < _0x13d6a1; _0x19947e++) {
        var _0x5ee6ee = _0x2f6e9a[_0x19947e];
        if (_0x13e168 === _0x5ee6ee[0]) {
          return _0x5ee6ee[1];
        }
      }
    }
  },
  './node_modules/msgpack-lite/lib/write-token.js': function (_0x27c503, _0x4b73aa, _0x5304ab) {
    var _0x1c5a48 = _0x5304ab("./node_modules/ieee754/index.js");
    var _0x2457d8 = _0x5304ab("./node_modules/int64-buffer/int64-buffer.js");
    var _0x27bfc2 = _0x2457d8.Uint64BE;
    var _0x1b6941 = _0x2457d8.Int64BE;
    var _0x431b36 = _0x5304ab("./node_modules/msgpack-lite/lib/write-uint8.js").uint8;
    var _0x262525 = _0x5304ab("./node_modules/msgpack-lite/lib/bufferish.js");
    var _0x5a727a = _0x262525.global;
    var _0x4de206 = _0x262525.hasBuffer && "TYPED_ARRAY_SUPPORT" in _0x5a727a;
    var _0x2cfd5e = _0x4de206 && !_0x5a727a.TYPED_ARRAY_SUPPORT;
    var _0x57444b = _0x262525.hasBuffer && _0x5a727a.prototype || {};
    _0x4b73aa.getWriteToken = _0x4f662a;
    function _0x4f662a(_0xaaf0ae) {
      if (_0xaaf0ae && _0xaaf0ae.uint8array) {
        return _0x26e06a();
      } else {
        if (_0x2cfd5e || _0x262525.hasBuffer && _0xaaf0ae && _0xaaf0ae.safe) {
          return _0x125e43();
        } else {
          return _0x2331cc();
        }
      }
    }
    function _0x26e06a() {
      var _0x44d963 = _0x2331cc();
      _0x44d963[202] = _0x140646(202, 4, _0x48ae0c);
      _0x44d963[203] = _0x140646(203, 8, _0x4e6aab);
      return _0x44d963;
    }
    function _0x2331cc() {
      var _0x5d55a6 = _0x431b36.slice();
      _0x5d55a6[196] = _0x1909ba(196);
      _0x5d55a6[197] = _0x11edf6(197);
      _0x5d55a6[198] = _0x2c5143(198);
      _0x5d55a6[199] = _0x1909ba(199);
      _0x5d55a6[200] = _0x11edf6(200);
      _0x5d55a6[201] = _0x2c5143(201);
      _0x5d55a6[202] = _0x140646(202, 4, _0x57444b.writeFloatBE || _0x48ae0c, true);
      _0x5d55a6[203] = _0x140646(203, 8, _0x57444b.writeDoubleBE || _0x4e6aab, true);
      _0x5d55a6[204] = _0x1909ba(204);
      _0x5d55a6[205] = _0x11edf6(205);
      _0x5d55a6[206] = _0x2c5143(206);
      _0x5d55a6[207] = _0x140646(207, 8, _0x38e4f8);
      _0x5d55a6[208] = _0x1909ba(208);
      _0x5d55a6[209] = _0x11edf6(209);
      _0x5d55a6[210] = _0x2c5143(210);
      _0x5d55a6[211] = _0x140646(211, 8, _0x2f5c97);
      _0x5d55a6[217] = _0x1909ba(217);
      _0x5d55a6[218] = _0x11edf6(218);
      _0x5d55a6[219] = _0x2c5143(219);
      _0x5d55a6[220] = _0x11edf6(220);
      _0x5d55a6[221] = _0x2c5143(221);
      _0x5d55a6[222] = _0x11edf6(222);
      _0x5d55a6[223] = _0x2c5143(223);
      return _0x5d55a6;
    }
    function _0x125e43() {
      var _0x4169b2 = _0x431b36.slice();
      _0x4169b2[196] = _0x140646(196, 1, _0x5a727a.prototype.writeUInt8);
      _0x4169b2[197] = _0x140646(197, 2, _0x5a727a.prototype.writeUInt16BE);
      _0x4169b2[198] = _0x140646(198, 4, _0x5a727a.prototype.writeUInt32BE);
      _0x4169b2[199] = _0x140646(199, 1, _0x5a727a.prototype.writeUInt8);
      _0x4169b2[200] = _0x140646(200, 2, _0x5a727a.prototype.writeUInt16BE);
      _0x4169b2[201] = _0x140646(201, 4, _0x5a727a.prototype.writeUInt32BE);
      _0x4169b2[202] = _0x140646(202, 4, _0x5a727a.prototype.writeFloatBE);
      _0x4169b2[203] = _0x140646(203, 8, _0x5a727a.prototype.writeDoubleBE);
      _0x4169b2[204] = _0x140646(204, 1, _0x5a727a.prototype.writeUInt8);
      _0x4169b2[205] = _0x140646(205, 2, _0x5a727a.prototype.writeUInt16BE);
      _0x4169b2[206] = _0x140646(206, 4, _0x5a727a.prototype.writeUInt32BE);
      _0x4169b2[207] = _0x140646(207, 8, _0x38e4f8);
      _0x4169b2[208] = _0x140646(208, 1, _0x5a727a.prototype.writeInt8);
      _0x4169b2[209] = _0x140646(209, 2, _0x5a727a.prototype.writeInt16BE);
      _0x4169b2[210] = _0x140646(210, 4, _0x5a727a.prototype.writeInt32BE);
      _0x4169b2[211] = _0x140646(211, 8, _0x2f5c97);
      _0x4169b2[217] = _0x140646(217, 1, _0x5a727a.prototype.writeUInt8);
      _0x4169b2[218] = _0x140646(218, 2, _0x5a727a.prototype.writeUInt16BE);
      _0x4169b2[219] = _0x140646(219, 4, _0x5a727a.prototype.writeUInt32BE);
      _0x4169b2[220] = _0x140646(220, 2, _0x5a727a.prototype.writeUInt16BE);
      _0x4169b2[221] = _0x140646(221, 4, _0x5a727a.prototype.writeUInt32BE);
      _0x4169b2[222] = _0x140646(222, 2, _0x5a727a.prototype.writeUInt16BE);
      _0x4169b2[223] = _0x140646(223, 4, _0x5a727a.prototype.writeUInt32BE);
      return _0x4169b2;
    }
    function _0x1909ba(_0x38970b) {
      return function (_0x55d67f, _0x76dfc0) {
        var _0x93faa4 = _0x55d67f.reserve(2);
        var _0x21cab4 = _0x55d67f.buffer;
        _0x21cab4[_0x93faa4++] = _0x38970b;
        _0x21cab4[_0x93faa4] = _0x76dfc0;
      };
    }
    function _0x11edf6(_0x20fd17) {
      return function (_0x17965c, _0x56bb9b) {
        var _0x57702d = _0x17965c.reserve(3);
        var _0xa2689f = _0x17965c.buffer;
        _0xa2689f[_0x57702d++] = _0x20fd17;
        _0xa2689f[_0x57702d++] = _0x56bb9b >>> 8;
        _0xa2689f[_0x57702d] = _0x56bb9b;
      };
    }
    function _0x2c5143(_0x114e9f) {
      return function (_0x1b5955, _0x5d9981) {
        var _0xcf19eb = _0x1b5955.reserve(5);
        var _0xfe83f2 = _0x1b5955.buffer;
        _0xfe83f2[_0xcf19eb++] = _0x114e9f;
        _0xfe83f2[_0xcf19eb++] = _0x5d9981 >>> 24;
        _0xfe83f2[_0xcf19eb++] = _0x5d9981 >>> 16;
        _0xfe83f2[_0xcf19eb++] = _0x5d9981 >>> 8;
        _0xfe83f2[_0xcf19eb] = _0x5d9981;
      };
    }
    function _0x140646(_0x1b346, _0x491019, _0x245a78, _0x6a9875) {
      return function (_0x4a303d, _0x566f3e) {
        var _0x1171f3 = _0x4a303d.reserve(_0x491019 + 1);
        _0x4a303d.buffer[_0x1171f3++] = _0x1b346;
        _0x245a78.call(_0x4a303d.buffer, _0x566f3e, _0x1171f3, _0x6a9875);
      };
    }
    function _0x38e4f8(_0x2850e6, _0x35c858) {
      new _0x27bfc2(this, _0x35c858, _0x2850e6);
    }
    function _0x2f5c97(_0x5926a0, _0x107e12) {
      new _0x1b6941(this, _0x107e12, _0x5926a0);
    }
    function _0x48ae0c(_0x2ba3fc, _0x17184a) {
      _0x1c5a48.write(this, _0x2ba3fc, _0x17184a, false, 23, 4);
    }
    function _0x4e6aab(_0x4ce79a, _0x3d2019) {
      _0x1c5a48.write(this, _0x4ce79a, _0x3d2019, false, 52, 8);
    }
  },
  './node_modules/msgpack-lite/lib/write-type.js': function (_0x27ca62, _0x36d4b8, _0x194793) {
    var _0x3b47cb = _0x194793("./node_modules/msgpack-lite/node_modules/isarray/index.js");
    var _0x339faf = _0x194793("./node_modules/int64-buffer/int64-buffer.js");
    var _0x209bf8 = _0x339faf.Uint64BE;
    var _0x4f29dc = _0x339faf.Int64BE;
    var _0x414b62 = _0x194793("./node_modules/msgpack-lite/lib/bufferish.js");
    var _0x3b0520 = _0x194793("./node_modules/msgpack-lite/lib/bufferish-proto.js");
    var _0x2631ec = _0x194793("./node_modules/msgpack-lite/lib/write-token.js");
    var _0x1f91cb = _0x194793("./node_modules/msgpack-lite/lib/write-uint8.js").uint8;
    var _0xd8fbe2 = _0x194793("./node_modules/msgpack-lite/lib/ext-buffer.js").ExtBuffer;
    var _0x3f7cdf = "undefined" !== typeof Uint8Array;
    var _0x19b907 = "undefined" !== typeof Map;
    var _0x238444 = [];
    _0x238444[1] = 212;
    _0x238444[2] = 213;
    _0x238444[4] = 214;
    _0x238444[8] = 215;
    _0x238444[16] = 216;
    _0x36d4b8.getWriteType = _0x42a479;
    function _0x42a479(_0x4452ef) {
      var _0x3eaea0 = _0x2631ec.getWriteToken(_0x4452ef);
      var _0x4f21ad = _0x4452ef && _0x4452ef.useraw;
      var _0x1f4274 = _0x3f7cdf && _0x4452ef && _0x4452ef.binarraybuffer;
      var _0x98d48b = _0x1f4274 ? _0x414b62.isArrayBuffer : _0x414b62.isBuffer;
      var _0x12b6b1 = _0x1f4274 ? _0x132e6b : _0x15fec0;
      var _0x211387 = _0x19b907 && _0x4452ef && _0x4452ef.usemap;
      var _0x250d97 = _0x211387 ? _0x42fb99 : _0x1bc7d2;
      var _0x2af109 = {
        boolean: _0xa80c9,
        function: _0x276139,
        number: _0x42e23e,
        object: _0x4f21ad ? _0x212cfd : _0x5da13c,
        string: _0x167aa1(_0x4f21ad ? _0x1760d2 : _0x1fb5af),
        symbol: _0x276139,
        undefined: _0x276139
      };
      return _0x2af109;
      function _0xa80c9(_0x56662d, _0x4ea084) {
        var _0x533cff = _0x4ea084 ? 195 : 194;
        _0x3eaea0[_0x533cff](_0x56662d, _0x4ea084);
      }
      function _0x42e23e(_0x5f06da, _0x3676b5) {
        var _0x9d8950 = _0x3676b5 | 0;
        var _0x36f689;
        if (_0x3676b5 !== _0x9d8950) {
          _0x36f689 = 203;
          _0x3eaea0[_0x36f689](_0x5f06da, _0x3676b5);
          return;
        } else {
          if (-32 <= _0x9d8950 && _0x9d8950 <= 127) {
            _0x36f689 = _0x9d8950 & 255;
          } else {
            if (0 <= _0x9d8950) {
              _0x36f689 = _0x9d8950 <= 255 ? 204 : _0x9d8950 <= 65535 ? 205 : 206;
            } else {
              _0x36f689 = -128 <= _0x9d8950 ? 208 : -32768 <= _0x9d8950 ? 209 : 210;
            }
          }
        }
        _0x3eaea0[_0x36f689](_0x5f06da, _0x9d8950);
      }
      function _0x2327d4(_0x2b2673, _0x2fb27f) {
        var _0x231e7f = 207;
        _0x3eaea0[_0x231e7f](_0x2b2673, _0x2fb27f.toArray());
      }
      function _0xd23cbf(_0x1896ce, _0x3cb55d) {
        var _0x23121b = 211;
        _0x3eaea0[_0x23121b](_0x1896ce, _0x3cb55d.toArray());
      }
      function _0x1fb5af(_0x592bd1) {
        return _0x592bd1 < 32 ? 1 : _0x592bd1 <= 255 ? 2 : _0x592bd1 <= 65535 ? 3 : 5;
      }
      function _0x1760d2(_0x4f4587) {
        return _0x4f4587 < 32 ? 1 : _0x4f4587 <= 65535 ? 3 : 5;
      }
      function _0x167aa1(_0x4aa2fb) {
        return _0x14110f;
        function _0x14110f(_0x269669, _0x137fd0) {
          var _0x5caaa4 = _0x137fd0.length;
          var _0x72ad37 = 5 + _0x5caaa4 * 3;
          _0x269669.offset = _0x269669.reserve(_0x72ad37);
          var _0x47b03d = _0x269669.buffer;
          var _0x225fbc = _0x4aa2fb(_0x5caaa4);
          var _0x3d38ca = _0x269669.offset + _0x225fbc;
          _0x5caaa4 = _0x3b0520.write.call(_0x47b03d, _0x137fd0, _0x3d38ca);
          var _0x1d5943 = _0x4aa2fb(_0x5caaa4);
          if (_0x225fbc !== _0x1d5943) {
            var _0x397233 = _0x3d38ca + _0x1d5943 - _0x225fbc;
            var _0x9fba8a = _0x3d38ca + _0x5caaa4;
            _0x3b0520.copy.call(_0x47b03d, _0x47b03d, _0x397233, _0x3d38ca, _0x9fba8a);
          }
          var _0x8bcd3b = _0x1d5943 === 1 ? 160 + _0x5caaa4 : _0x1d5943 <= 3 ? 215 + _0x1d5943 : 219;
          _0x3eaea0[_0x8bcd3b](_0x269669, _0x5caaa4);
          _0x269669.offset += _0x5caaa4;
        }
      }
      function _0x5da13c(_0x5730ea, _0x5c8f08) {
        if (_0x5c8f08 === null) {
          return _0x276139(_0x5730ea, _0x5c8f08);
        }
        if (_0x98d48b(_0x5c8f08)) {
          return _0x12b6b1(_0x5730ea, _0x5c8f08);
        }
        if (_0x3b47cb(_0x5c8f08)) {
          return _0x193dce(_0x5730ea, _0x5c8f08);
        }
        if (_0x209bf8.isUint64BE(_0x5c8f08)) {
          return _0x2327d4(_0x5730ea, _0x5c8f08);
        }
        if (_0x4f29dc.isInt64BE(_0x5c8f08)) {
          return _0xd23cbf(_0x5730ea, _0x5c8f08);
        }
        var _0x5b7f84 = _0x5730ea.codec.getExtPacker(_0x5c8f08);
        if (_0x5b7f84) {
          _0x5c8f08 = _0x5b7f84(_0x5c8f08);
        }
        if (_0x5c8f08 instanceof _0xd8fbe2) {
          return _0x2ebc67(_0x5730ea, _0x5c8f08);
        }
        _0x250d97(_0x5730ea, _0x5c8f08);
      }
      function _0x212cfd(_0x3821b4, _0x30c5b0) {
        if (_0x98d48b(_0x30c5b0)) {
          return _0x3dd0ae(_0x3821b4, _0x30c5b0);
        }
        _0x5da13c(_0x3821b4, _0x30c5b0);
      }
      function _0x276139(_0x331103, _0x5957fa) {
        var _0xdd0e29 = 192;
        _0x3eaea0[_0xdd0e29](_0x331103, _0x5957fa);
      }
      function _0x193dce(_0x210180, _0x54e29f) {
        var _0xd5f162 = _0x54e29f.length;
        var _0x1d2564 = _0xd5f162 < 16 ? 144 + _0xd5f162 : _0xd5f162 <= 65535 ? 220 : 221;
        _0x3eaea0[_0x1d2564](_0x210180, _0xd5f162);
        var _0x3d641d = _0x210180.codec.encode;
        for (var _0xfa53c2 = 0; _0xfa53c2 < _0xd5f162; _0xfa53c2++) {
          _0x3d641d(_0x210180, _0x54e29f[_0xfa53c2]);
        }
      }
      function _0x15fec0(_0x2b084b, _0x4ccc3e) {
        var _0x2e7f5d = _0x4ccc3e.length;
        var _0x53c79a = _0x2e7f5d < 255 ? 196 : _0x2e7f5d <= 65535 ? 197 : 198;
        _0x3eaea0[_0x53c79a](_0x2b084b, _0x2e7f5d);
        _0x2b084b.send(_0x4ccc3e);
      }
      function _0x132e6b(_0x4c5959, _0x5a969e) {
        _0x15fec0(_0x4c5959, new Uint8Array(_0x5a969e));
      }
      function _0x2ebc67(_0x4bb5bd, _0x51799d) {
        var _0x295840 = _0x51799d.buffer;
        var _0x40dec2 = _0x295840.length;
        var _0x120976 = _0x238444[_0x40dec2] || (_0x40dec2 < 255 ? 199 : _0x40dec2 <= 65535 ? 200 : 201);
        _0x3eaea0[_0x120976](_0x4bb5bd, _0x40dec2);
        _0x1f91cb[_0x51799d.type](_0x4bb5bd);
        _0x4bb5bd.send(_0x295840);
      }
      function _0x1bc7d2(_0x451deb, _0x1bb972) {
        var _0x3d994d = Object.keys(_0x1bb972);
        var _0x5911b4 = _0x3d994d.length;
        var _0x459301 = _0x5911b4 < 16 ? 128 + _0x5911b4 : _0x5911b4 <= 65535 ? 222 : 223;
        _0x3eaea0[_0x459301](_0x451deb, _0x5911b4);
        var _0x10713a = _0x451deb.codec.encode;
        _0x3d994d.forEach(function (_0x231d2d) {
          _0x10713a(_0x451deb, _0x231d2d);
          _0x10713a(_0x451deb, _0x1bb972[_0x231d2d]);
        });
      }
      function _0x42fb99(_0x1fbf60, _0x53f6c4) {
        if (!(_0x53f6c4 instanceof Map)) {
          return _0x1bc7d2(_0x1fbf60, _0x53f6c4);
        }
        var _0x4d9189 = _0x53f6c4.size;
        var _0x160988 = _0x4d9189 < 16 ? 128 + _0x4d9189 : _0x4d9189 <= 65535 ? 222 : 223;
        _0x3eaea0[_0x160988](_0x1fbf60, _0x4d9189);
        var _0x552fde = _0x1fbf60.codec.encode;
        _0x53f6c4.forEach(function (_0x4651f0, _0x406a51, _0x405b71) {
          _0x552fde(_0x1fbf60, _0x406a51), _0x552fde(_0x1fbf60, _0x4651f0);
        });
      }
      function _0x3dd0ae(_0x5e36f0, _0xaf45c) {
        var _0x625c70 = _0xaf45c.length;
        var _0x41ff54 = _0x625c70 < 32 ? 160 + _0x625c70 : _0x625c70 <= 65535 ? 218 : 219;
        _0x3eaea0[_0x41ff54](_0x5e36f0, _0x625c70);
        _0x5e36f0.send(_0xaf45c);
      }
    }
  },
  './node_modules/msgpack-lite/lib/write-uint8.js': function (_0x59f023, _0x1a4967) {
    var _0x24ee9e = _0x1a4967.uint8 = new Array(256);
    for (var _0x3ca9aa = 0; _0x3ca9aa <= 255; _0x3ca9aa++) {
      _0x24ee9e[_0x3ca9aa] = _0x5a7aab(_0x3ca9aa);
    }
    function _0x5a7aab(_0x520452) {
      return function (_0x3a704c) {
        var _0x2aedc2 = _0x3a704c.reserve(1);
        _0x3a704c.buffer[_0x2aedc2] = _0x520452;
      };
    }
  },
  './node_modules/msgpack-lite/node_modules/isarray/index.js': function (_0x14c905, _0x2cfcc2) {
    var _0x7472fb = {}.toString;
    _0x14c905.exports = Array.isArray || function (_0x357deb) {
      return _0x7472fb.call(_0x357deb) == "[object Array]";
    };
  },
  './node_modules/process/browser.js': function (_0x4416e2, _0x18db58) {
    var _0x1e3277 = _0x4416e2.exports = {};
    var _0x2baa2b;
    var _0x4656a9;
    function _0x33e06b() {
      throw new Error("setTimeout has not been defined");
    }
    function _0x3549a5() {
      throw new Error("clearTimeout has not been defined");
    }
    (function () {
      try {
        if (typeof setTimeout === "function") {
          _0x2baa2b = setTimeout;
        } else {
          _0x2baa2b = _0x33e06b;
        }
      } catch (_0x10e835) {
        _0x2baa2b = _0x33e06b;
      }
      try {
        typeof clearTimeout === "function" ? _0x4656a9 = clearTimeout : _0x4656a9 = _0x3549a5;
      } catch (_0x59ffe1) {
        _0x4656a9 = _0x3549a5;
      }
    })();
    function _0x46768c(_0x6d49fe) {
      if (_0x2baa2b === setTimeout) {
        return setTimeout(_0x6d49fe, 0);
      }
      if ((_0x2baa2b === _0x33e06b || !_0x2baa2b) && setTimeout) {
        _0x2baa2b = setTimeout;
        return setTimeout(_0x6d49fe, 0);
      }
      try {
        return _0x2baa2b(_0x6d49fe, 0);
      } catch (_0x58ef05) {
        try {
          return _0x2baa2b.call(null, _0x6d49fe, 0);
        } catch (_0x32ba36) {
          return _0x2baa2b.call(this, _0x6d49fe, 0);
        }
      }
    }
    function _0x17e380(_0x1e4025) {
      if (_0x4656a9 === clearTimeout) {
        return clearTimeout(_0x1e4025);
      }
      if ((_0x4656a9 === _0x3549a5 || !_0x4656a9) && clearTimeout) {
        return _0x4656a9 = clearTimeout, clearTimeout(_0x1e4025);
      }
      try {
        return _0x4656a9(_0x1e4025);
      } catch (_0x52d2cc) {
        try {
          return _0x4656a9.call(null, _0x1e4025);
        } catch (_0x5a9d58) {
          return _0x4656a9.call(this, _0x1e4025);
        }
      }
    }
    var _0x3b68a4 = [];
    var _0x23e5c3 = false;
    var _0x1accd2;
    var _0x57d604 = -1;
    function _0x32df77() {
      if (!_0x23e5c3 || !_0x1accd2) {
        return;
      }
      _0x23e5c3 = false;
      _0x1accd2.length ? _0x3b68a4 = _0x1accd2.concat(_0x3b68a4) : _0x57d604 = -1;
      _0x3b68a4.length && _0x169740();
    }
    function _0x169740() {
      if (_0x23e5c3) {
        return;
      }
      var _0x35890f = _0x46768c(_0x32df77);
      _0x23e5c3 = true;
      var _0x14d2db = _0x3b68a4.length;
      while (_0x14d2db) {
        _0x1accd2 = _0x3b68a4;
        _0x3b68a4 = [];
        while (++_0x57d604 < _0x14d2db) {
          if (_0x1accd2) {
            _0x1accd2[_0x57d604].run();
          }
        }
        _0x57d604 = -1;
        _0x14d2db = _0x3b68a4.length;
      }
      _0x1accd2 = null;
      _0x23e5c3 = false;
      _0x17e380(_0x35890f);
    }
    _0x1e3277.nextTick = function (_0x224b25) {
      var _0x308e90 = new Array(arguments.length - 1);
      if (arguments.length > 1) {
        for (var _0x2eebdb = 1; _0x2eebdb < arguments.length; _0x2eebdb++) {
          _0x308e90[_0x2eebdb - 1] = arguments[_0x2eebdb];
        }
      }
      _0x3b68a4.push(new _0x32cb7b(_0x224b25, _0x308e90));
      if (_0x3b68a4.length === 1 && !_0x23e5c3) {
        _0x46768c(_0x169740);
      }
    };
    function _0x32cb7b(_0x4e6797, _0x52fbd2) {
      this.fun = _0x4e6797;
      this.array = _0x52fbd2;
    }
    _0x32cb7b.prototype.run = function () {
      this.fun.apply(null, this.array);
    };
    _0x1e3277.title = "browser";
    _0x1e3277.browser = true;
    _0x1e3277.env = {};
    _0x1e3277.argv = [];
    _0x1e3277.version = '';
    _0x1e3277.versions = {};
    function _0x391127() {}
    _0x1e3277.on = _0x391127;
    _0x1e3277.addListener = _0x391127;
    _0x1e3277.once = _0x391127;
    _0x1e3277.off = _0x391127;
    _0x1e3277.removeListener = _0x391127;
    _0x1e3277.removeAllListeners = _0x391127;
    _0x1e3277.emit = _0x391127;
    _0x1e3277.prependListener = _0x391127;
    _0x1e3277.prependOnceListener = _0x391127;
    _0x1e3277.listeners = function (_0xc5adb5) {
      return [];
    };
    _0x1e3277.binding = function (_0x33b271) {
      throw new Error("process.binding is not supported");
    };
    _0x1e3277.cwd = function () {
      return '/';
    };
    _0x1e3277.chdir = function (_0x489234) {
      throw new Error("process.chdir is not supported");
    };
    _0x1e3277.umask = function () {
      return 0;
    };
  },
  './node_modules/punycode/punycode.js': function (_0x17f0a5, _0x45c9bf, _0x3189af) {
    (function (_0x221305, _0x59b5d6) {
      var _0x265e14;
      ;
      (function (_0x1c2b82) {
        var _0x4ee3e3 = true && _0x45c9bf && !_0x45c9bf.nodeType && _0x45c9bf;
        var _0x4b07c6 = true && _0x221305 && !_0x221305.nodeType && _0x221305;
        var _0x130a6a = typeof _0x59b5d6 == "object" && _0x59b5d6;
        if (_0x130a6a.global === _0x130a6a || _0x130a6a.window === _0x130a6a || _0x130a6a.self === _0x130a6a) {
          _0x1c2b82 = _0x130a6a;
        }
        var _0x39b29f;
        var _0x34d27d = 2147483647;
        var _0x3e267a = 36;
        var _0x438a69 = 1;
        var _0x211f2d = 26;
        var _0x5b4860 = 38;
        var _0x252dfb = 700;
        var _0x56c8a4 = 72;
        var _0x18ee99 = 128;
        var _0x33e1c4 = '-';
        var _0x16bdac = /^xn--/;
        var _0xfdbd4e = /[^\x20-\x7E]/;
        var _0x420078 = /[\x2E\u3002\uFF0E\uFF61]/g;
        var _0x1d1903 = {
          overflow: "Overflow: input needs wider integers to process",
          "not-basic": "Illegal input >= 0x80 (not a basic code point)",
          "invalid-input": "Invalid input"
        };
        var _0x3d6764 = 35;
        var _0x3f2957 = Math.floor;
        var _0x1e453a = String.fromCharCode;
        var _0x4a10b7;
        function _0x26fb66(_0x109ef4) {
          throw new RangeError(_0x1d1903[_0x109ef4]);
        }
        function _0x40dabb(_0x4ac9fe, _0x4dae8f) {
          var _0x41a6a4 = _0x4ac9fe.length;
          var _0x20fcd3 = [];
          while (_0x41a6a4--) {
            _0x20fcd3[_0x41a6a4] = _0x4dae8f(_0x4ac9fe[_0x41a6a4]);
          }
          return _0x20fcd3;
        }
        function _0x6a082a(_0x4bb092, _0xef0c45) {
          var _0x3dac02 = _0x4bb092.split('@');
          var _0x5061fb = '';
          _0x3dac02.length > 1 && (_0x5061fb = _0x3dac02[0] + '@', _0x4bb092 = _0x3dac02[1]);
          _0x4bb092 = _0x4bb092.replace(_0x420078, '.');
          var _0x3c6eb7 = _0x4bb092.split('.');
          var _0x27359f = _0x40dabb(_0x3c6eb7, _0xef0c45).join('.');
          return _0x5061fb + _0x27359f;
        }
        function _0x1c149a(_0xd0c9dd) {
          var _0x4687d8 = [];
          var _0x9c1fd4 = 0;
          var _0x957bed = _0xd0c9dd.length;
          var _0x564c24;
          var _0x5e4a2f;
          while (_0x9c1fd4 < _0x957bed) {
            _0x564c24 = _0xd0c9dd.charCodeAt(_0x9c1fd4++);
            if (_0x564c24 >= 55296 && _0x564c24 <= 56319 && _0x9c1fd4 < _0x957bed) {
              _0x5e4a2f = _0xd0c9dd.charCodeAt(_0x9c1fd4++);
              if ((_0x5e4a2f & 64512) == 56320) {
                _0x4687d8.push(((_0x564c24 & 1023) << 10) + (_0x5e4a2f & 1023) + 65536);
              } else {
                _0x4687d8.push(_0x564c24), _0x9c1fd4--;
              }
            } else {
              _0x4687d8.push(_0x564c24);
            }
          }
          return _0x4687d8;
        }
        function _0x2a77a9(_0x3d5c40) {
          return _0x40dabb(_0x3d5c40, function (_0x22618d) {
            var _0x1ba0ab = '';
            if (_0x22618d > 65535) {
              _0x22618d -= 65536;
              _0x1ba0ab += _0x1e453a(_0x22618d >>> 10 & 1023 | 55296);
              _0x22618d = 56320 | _0x22618d & 1023;
            }
            _0x1ba0ab += _0x1e453a(_0x22618d);
            return _0x1ba0ab;
          }).join('');
        }
        function _0x5bfbb2(_0x5428cd) {
          if (_0x5428cd - 48 < 10) {
            return _0x5428cd - 22;
          }
          if (_0x5428cd - 65 < 26) {
            return _0x5428cd - 65;
          }
          if (_0x5428cd - 97 < 26) {
            return _0x5428cd - 97;
          }
          return _0x3e267a;
        }
        function _0x4270bb(_0x3a3e9c, _0x2b8546) {
          return _0x3a3e9c + 22 + 75 * (_0x3a3e9c < 26) - ((_0x2b8546 != 0) << 5);
        }
        function _0x4be775(_0x266101, _0x2aba9c, _0x1515f5) {
          var _0x2c955e = 0;
          _0x266101 = _0x1515f5 ? _0x3f2957(_0x266101 / _0x252dfb) : _0x266101 >> 1;
          _0x266101 += _0x3f2957(_0x266101 / _0x2aba9c);
          for (; _0x266101 > 455; _0x2c955e += _0x3e267a) {
            _0x266101 = _0x3f2957(_0x266101 / _0x3d6764);
          }
          return _0x3f2957(_0x2c955e + 36 * _0x266101 / (_0x266101 + _0x5b4860));
        }
        function _0x217b97(_0x439c35) {
          var _0x1845b8 = [];
          var _0x374a3e = _0x439c35.length;
          var _0x5f2c94;
          var _0x5cd5fb = 0;
          var _0x4058c6 = _0x18ee99;
          var _0x50ee98 = _0x56c8a4;
          var _0x48dda2;
          var _0x366601;
          var _0x5beab8;
          var _0x10b587;
          var _0x99dedd;
          var _0x3e1959;
          var _0x152bca;
          var _0x34f837;
          var _0x3be293;
          _0x48dda2 = _0x439c35.lastIndexOf(_0x33e1c4);
          _0x48dda2 < 0 && (_0x48dda2 = 0);
          for (_0x366601 = 0; _0x366601 < _0x48dda2; ++_0x366601) {
            if (_0x439c35.charCodeAt(_0x366601) >= 128) {
              _0x26fb66("not-basic");
            }
            _0x1845b8.push(_0x439c35.charCodeAt(_0x366601));
          }
          for (_0x5beab8 = _0x48dda2 > 0 ? _0x48dda2 + 1 : 0; _0x5beab8 < _0x374a3e;) {
            _0x10b587 = _0x5cd5fb;
            _0x99dedd = 1;
            _0x3e1959 = _0x3e267a;
            for (;; _0x3e1959 += _0x3e267a) {
              _0x5beab8 >= _0x374a3e && _0x26fb66("invalid-input");
              _0x152bca = _0x5bfbb2(_0x439c35.charCodeAt(_0x5beab8++));
              if (_0x152bca >= _0x3e267a || _0x152bca > _0x3f2957((_0x34d27d - _0x5cd5fb) / _0x99dedd)) {
                _0x26fb66("overflow");
              }
              _0x5cd5fb += _0x152bca * _0x99dedd;
              _0x34f837 = _0x3e1959 <= _0x50ee98 ? _0x438a69 : _0x3e1959 >= _0x50ee98 + _0x211f2d ? _0x211f2d : _0x3e1959 - _0x50ee98;
              if (_0x152bca < _0x34f837) {
                break;
              }
              _0x3be293 = _0x3e267a - _0x34f837;
              _0x99dedd > _0x3f2957(_0x34d27d / _0x3be293) && _0x26fb66("overflow");
              _0x99dedd *= _0x3be293;
            }
            _0x5f2c94 = _0x1845b8.length + 1;
            _0x50ee98 = _0x4be775(_0x5cd5fb - _0x10b587, _0x5f2c94, _0x10b587 == 0);
            _0x3f2957(_0x5cd5fb / _0x5f2c94) > _0x34d27d - _0x4058c6 && _0x26fb66("overflow");
            _0x4058c6 += _0x3f2957(_0x5cd5fb / _0x5f2c94);
            _0x5cd5fb %= _0x5f2c94;
            _0x1845b8.splice(_0x5cd5fb++, 0, _0x4058c6);
          }
          return _0x2a77a9(_0x1845b8);
        }
        function _0x3c5d23(_0x5a8a37) {
          var _0x11cc3e;
          var _0x49bf17;
          var _0x5721df;
          var _0x52730a;
          var _0x156586;
          var _0x360aa3;
          var _0x11e891;
          var _0x3b1ec0;
          var _0x373d15;
          var _0x4c2e15;
          var _0x259090;
          var _0x4c6b58 = [];
          var _0x2f0dce;
          var _0x40d36c;
          var _0x583e67;
          var _0x128b8f;
          _0x5a8a37 = _0x1c149a(_0x5a8a37);
          _0x2f0dce = _0x5a8a37.length;
          _0x11cc3e = _0x18ee99;
          _0x49bf17 = 0;
          _0x156586 = _0x56c8a4;
          for (_0x360aa3 = 0; _0x360aa3 < _0x2f0dce; ++_0x360aa3) {
            _0x259090 = _0x5a8a37[_0x360aa3];
            if (_0x259090 < 128) {
              _0x4c6b58.push(_0x1e453a(_0x259090));
            }
          }
          _0x5721df = _0x52730a = _0x4c6b58.length;
          _0x52730a && _0x4c6b58.push(_0x33e1c4);
          while (_0x5721df < _0x2f0dce) {
            _0x11e891 = _0x34d27d;
            _0x360aa3 = 0;
            for (; _0x360aa3 < _0x2f0dce; ++_0x360aa3) {
              _0x259090 = _0x5a8a37[_0x360aa3];
              _0x259090 >= _0x11cc3e && _0x259090 < _0x11e891 && (_0x11e891 = _0x259090);
            }
            _0x40d36c = _0x5721df + 1;
            _0x11e891 - _0x11cc3e > _0x3f2957((_0x34d27d - _0x49bf17) / _0x40d36c) && _0x26fb66("overflow");
            _0x49bf17 += (_0x11e891 - _0x11cc3e) * _0x40d36c;
            _0x11cc3e = _0x11e891;
            for (_0x360aa3 = 0; _0x360aa3 < _0x2f0dce; ++_0x360aa3) {
              _0x259090 = _0x5a8a37[_0x360aa3];
              if (_0x259090 < _0x11cc3e && ++_0x49bf17 > _0x34d27d) {
                _0x26fb66("overflow");
              }
              if (_0x259090 == _0x11cc3e) {
                _0x3b1ec0 = _0x49bf17;
                _0x373d15 = _0x3e267a;
                for (;; _0x373d15 += _0x3e267a) {
                  _0x4c2e15 = _0x373d15 <= _0x156586 ? _0x438a69 : _0x373d15 >= _0x156586 + _0x211f2d ? _0x211f2d : _0x373d15 - _0x156586;
                  if (_0x3b1ec0 < _0x4c2e15) {
                    break;
                  }
                  _0x128b8f = _0x3b1ec0 - _0x4c2e15;
                  _0x583e67 = _0x3e267a - _0x4c2e15;
                  _0x4c6b58.push(_0x1e453a(_0x4270bb(_0x4c2e15 + _0x128b8f % _0x583e67, 0)));
                  _0x3b1ec0 = _0x3f2957(_0x128b8f / _0x583e67);
                }
                _0x4c6b58.push(_0x1e453a(_0x4270bb(_0x3b1ec0, 0)));
                _0x156586 = _0x4be775(_0x49bf17, _0x40d36c, _0x5721df == _0x52730a);
                _0x49bf17 = 0;
                ++_0x5721df;
              }
            }
            ++_0x49bf17;
            ++_0x11cc3e;
          }
          return _0x4c6b58.join('');
        }
        function _0x4b1ae7(_0x55116d) {
          return _0x6a082a(_0x55116d, function (_0x2c8fe7) {
            return _0x16bdac.test(_0x2c8fe7) ? _0x217b97(_0x2c8fe7.slice(4).toLowerCase()) : _0x2c8fe7;
          });
        }
        function _0x466712(_0x283a63) {
          return _0x6a082a(_0x283a63, function (_0x31f199) {
            return _0xfdbd4e.test(_0x31f199) ? "xn--" + _0x3c5d23(_0x31f199) : _0x31f199;
          });
        }
        var _0x58aa1e = {
          decode: _0x1c149a,
          encode: _0x2a77a9
        };
        var _0x50edfc = {
          version: "1.4.1",
          ucs2: _0x58aa1e,
          decode: _0x217b97,
          encode: _0x3c5d23,
          toASCII: _0x466712,
          toUnicode: _0x4b1ae7
        };
        _0x39b29f = _0x50edfc;
        if (true) {
          !(_0x265e14 = function () {
            return _0x39b29f;
          }.call(_0x45c9bf, _0x3189af, _0x45c9bf, _0x221305), _0x265e14 !== undefined && (_0x221305.exports = _0x265e14));
        } else {}
      })(this);
    }).call(this, _0x3189af("./node_modules/webpack/buildin/module.js")(_0x17f0a5), _0x3189af("./node_modules/webpack/buildin/global.js"));
  },
  './node_modules/querystring-es3/decode.js': function (_0x4bd6b6, _0x32ce44, _0x458835) {
    'use strict';

    function _0xb3cf1a(_0x4c6c9e, _0x1e3eb9) {
      return Object.prototype.hasOwnProperty.call(_0x4c6c9e, _0x1e3eb9);
    }
    _0x4bd6b6.exports = function (_0x2a8513, _0xddde3b, _0x5afd7a, _0x1382e3) {
      _0xddde3b = _0xddde3b || '&';
      _0x5afd7a = _0x5afd7a || '=';
      var _0xeae3bd = {};
      if (typeof _0x2a8513 !== "string" || _0x2a8513.length === 0) {
        return _0xeae3bd;
      }
      var _0x5ca544 = /\+/g;
      _0x2a8513 = _0x2a8513.split(_0xddde3b);
      var _0x494cd4 = 1000;
      if (_0x1382e3 && typeof _0x1382e3.maxKeys === "number") {
        _0x494cd4 = _0x1382e3.maxKeys;
      }
      var _0x430f3e = _0x2a8513.length;
      _0x494cd4 > 0 && _0x430f3e > _0x494cd4 && (_0x430f3e = _0x494cd4);
      for (var _0x28e730 = 0; _0x28e730 < _0x430f3e; ++_0x28e730) {
        var _0x12cd7a = _0x2a8513[_0x28e730].replace(_0x5ca544, "%20");
        var _0x5eb599 = _0x12cd7a.indexOf(_0x5afd7a);
        var _0x4be66c;
        var _0x1295ce;
        var _0x282f44;
        var _0x4b0684;
        if (_0x5eb599 >= 0) {
          _0x4be66c = _0x12cd7a.substr(0, _0x5eb599);
          _0x1295ce = _0x12cd7a.substr(_0x5eb599 + 1);
        } else {
          _0x4be66c = _0x12cd7a;
          _0x1295ce = '';
        }
        _0x282f44 = decodeURIComponent(_0x4be66c);
        _0x4b0684 = decodeURIComponent(_0x1295ce);
        if (!_0xb3cf1a(_0xeae3bd, _0x282f44)) {
          _0xeae3bd[_0x282f44] = _0x4b0684;
        } else {
          _0x270234(_0xeae3bd[_0x282f44]) ? _0xeae3bd[_0x282f44].push(_0x4b0684) : _0xeae3bd[_0x282f44] = [_0xeae3bd[_0x282f44], _0x4b0684];
        }
      }
      return _0xeae3bd;
    };
    var _0x270234 = Array.isArray || function (_0x56b583) {
      return Object.prototype.toString.call(_0x56b583) === "[object Array]";
    };
  },
  './node_modules/querystring-es3/encode.js': function (_0x4d3cf5, _0x21dd86, _0x4f6905) {
    'use strict';

    function _0x2b02c8(_0x5d82bd) {
      switch (typeof _0x5d82bd) {
        case "string":
          return _0x5d82bd;
        case "boolean":
          return _0x5d82bd ? "true" : "false";
        case "number":
          return isFinite(_0x5d82bd) ? _0x5d82bd : '';
        default:
          return '';
      }
    }
    _0x4d3cf5.exports = function (_0x18a18a, _0x24905c, _0x8b7589, _0x54f57e) {
      _0x24905c = _0x24905c || '&';
      _0x8b7589 = _0x8b7589 || '=';
      _0x18a18a === null && (_0x18a18a = undefined);
      if (typeof _0x18a18a === "object") {
        return _0x32905b(_0x1b58f9(_0x18a18a), function (_0x3fa778) {
          var _0x16f4c7 = encodeURIComponent(_0x2b02c8(_0x3fa778)) + _0x8b7589;
          return _0x137a45(_0x18a18a[_0x3fa778]) ? _0x32905b(_0x18a18a[_0x3fa778], function (_0x102e0b) {
            return _0x16f4c7 + encodeURIComponent(_0x2b02c8(_0x102e0b));
          }).join(_0x24905c) : _0x16f4c7 + encodeURIComponent(_0x2b02c8(_0x18a18a[_0x3fa778]));
        }).join(_0x24905c);
      }
      if (!_0x54f57e) {
        return '';
      }
      return encodeURIComponent(_0x2b02c8(_0x54f57e)) + _0x8b7589 + encodeURIComponent(_0x2b02c8(_0x18a18a));
    };
    var _0x137a45 = Array.isArray || function (_0x2d5479) {
      return Object.prototype.toString.call(_0x2d5479) === "[object Array]";
    };
    function _0x32905b(_0x2f2db5, _0x209744) {
      if (_0x2f2db5.map) {
        return _0x2f2db5.map(_0x209744);
      }
      var _0x1f98e0 = [];
      for (var _0x52c9a8 = 0; _0x52c9a8 < _0x2f2db5.length; _0x52c9a8++) {
        _0x1f98e0.push(_0x209744(_0x2f2db5[_0x52c9a8], _0x52c9a8));
      }
      return _0x1f98e0;
    }
    var _0x1b58f9 = Object.keys || function (_0x3a7ea5) {
      var _0x5d4237 = [];
      for (var _0x1bb85c in _0x3a7ea5) {
        if (Object.prototype.hasOwnProperty.call(_0x3a7ea5, _0x1bb85c)) {
          _0x5d4237.push(_0x1bb85c);
        }
      }
      return _0x5d4237;
    };
  },
  './node_modules/querystring-es3/index.js': function (_0x565a18, _0x5bd8e0, _0x179d0c) {
    'use strict';

    _0x5bd8e0.decode = _0x5bd8e0.parse = _0x179d0c("./node_modules/querystring-es3/decode.js");
    _0x5bd8e0.encode = _0x5bd8e0.stringify = _0x179d0c("./node_modules/querystring-es3/encode.js");
  },
  './node_modules/url/url.js': function (_0x117dd8, _0x5e54f9, _0x2d4ee3) {
    'use strict';

    var _0x35ed23 = _0x2d4ee3("./node_modules/punycode/punycode.js");
    var _0x6e1a36 = _0x2d4ee3("./node_modules/url/util.js");
    _0x5e54f9.parse = _0x7b326f;
    _0x5e54f9.resolve = _0x39070b;
    _0x5e54f9.resolveObject = _0x16c940;
    _0x5e54f9.format = _0xbfcecc;
    _0x5e54f9.Url = _0xfc4045;
    function _0xfc4045() {
      this.protocol = null;
      this.slashes = null;
      this.auth = null;
      this.host = null;
      this.port = null;
      this.hostname = null;
      this.hash = null;
      this.search = null;
      this.query = null;
      this.pathname = null;
      this.path = null;
      this.href = null;
    }
    var _0xc77f08 = {
      javascript: true,
      "javascript:": true
    };
    var _0x293c66 = {
      javascript: true,
      "javascript:": true
    };
    var _0x1a3e24 = {
      http: true,
      https: true,
      ftp: true,
      gopher: true,
      file: true,
      "http:": true,
      "https:": true,
      "ftp:": true,
      "gopher:": true,
      "file:": true
    };
    var _0x475b5f = /^([a-z0-9.+-]+:)/i;
    var _0x5630d9 = /:[0-9]*$/;
    var _0x1e9ae2 = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/;
    var _0x4d5e33 = ['<', '>', '\x22', '`', '\x20', '\x0d', '\x0a', '\x09'];
    var _0xe88ce1 = ['{', '}', '|', '\x5c', '^', '`'].concat(_0x4d5e33);
    var _0x3ae468 = ['\x27'].concat(_0xe88ce1);
    var _0x536c8e = ['%', '/', '?', ';', '#'].concat(_0x3ae468);
    var _0xeb4008 = ['/', '?', '#'];
    var _0x334791 = 255;
    var _0x4b21e9 = /^[+a-z0-9A-Z_-]{0,63}$/;
    var _0x1b6f10 = /^([+a-z0-9A-Z_-]{0,63})(.*)$/;
    var _0x2c6ee5 = _0xc77f08;
    var _0x2fe3aa = _0x293c66;
    var _0x356c91 = _0x1a3e24;
    var _0x47a4e5 = _0x2d4ee3("./node_modules/querystring-es3/index.js");
    function _0x7b326f(_0x2c30c0, _0x3c21b8, _0x2a4acf) {
      if (_0x2c30c0 && _0x6e1a36.isObject(_0x2c30c0) && _0x2c30c0 instanceof _0xfc4045) {
        return _0x2c30c0;
      }
      var _0x12be46 = new _0xfc4045();
      _0x12be46.parse(_0x2c30c0, _0x3c21b8, _0x2a4acf);
      return _0x12be46;
    }
    _0xfc4045.prototype.parse = function (_0x41bb18, _0x5bebe5, _0x1d3d25) {
      if (!_0x6e1a36.isString(_0x41bb18)) {
        throw new TypeError("Parameter 'url' must be a string, not " + typeof _0x41bb18);
      }
      var _0x3ed551 = _0x41bb18.indexOf('?');
      var _0x124d40 = _0x3ed551 !== -1 && _0x3ed551 < _0x41bb18.indexOf('#') ? '?' : '#';
      var _0x34a583 = _0x41bb18.split(_0x124d40);
      var _0x40b98a = /\\/g;
      _0x34a583[0] = _0x34a583[0].replace(_0x40b98a, '/');
      _0x41bb18 = _0x34a583.join(_0x124d40);
      var _0x5f5162 = _0x41bb18;
      _0x5f5162 = _0x5f5162.trim();
      if (!_0x1d3d25 && _0x41bb18.split('#').length === 1) {
        var _0x5a9a49 = _0x1e9ae2.exec(_0x5f5162);
        if (_0x5a9a49) {
          this.path = _0x5f5162;
          this.href = _0x5f5162;
          this.pathname = _0x5a9a49[1];
          if (_0x5a9a49[2]) {
            this.search = _0x5a9a49[2];
            if (_0x5bebe5) {
              this.query = _0x47a4e5.parse(this.search.substr(1));
            } else {
              this.query = this.search.substr(1);
            }
          } else {
            if (_0x5bebe5) {
              this.search = '';
              this.query = {};
            }
          }
          return this;
        }
      }
      var _0x3ef765 = _0x475b5f.exec(_0x5f5162);
      if (_0x3ef765) {
        _0x3ef765 = _0x3ef765[0];
        var _0x35c66a = _0x3ef765.toLowerCase();
        this.protocol = _0x35c66a;
        _0x5f5162 = _0x5f5162.substr(_0x3ef765.length);
      }
      if (_0x1d3d25 || _0x3ef765 || _0x5f5162.match(/^\/\/[^@\/]+@[^@\/]+/)) {
        var _0x43f878 = _0x5f5162.substr(0, 2) === '//';
        if (_0x43f878 && !(_0x3ef765 && _0x2fe3aa[_0x3ef765])) {
          _0x5f5162 = _0x5f5162.substr(2);
          this.slashes = true;
        }
      }
      if (!_0x2fe3aa[_0x3ef765] && (_0x43f878 || _0x3ef765 && !_0x356c91[_0x3ef765])) {
        var _0x1ae0fc = -1;
        for (var _0xd4235f = 0; _0xd4235f < _0xeb4008.length; _0xd4235f++) {
          var _0x5b1cba = _0x5f5162.indexOf(_0xeb4008[_0xd4235f]);
          if (_0x5b1cba !== -1 && (_0x1ae0fc === -1 || _0x5b1cba < _0x1ae0fc)) {
            _0x1ae0fc = _0x5b1cba;
          }
        }
        var _0x2d8453;
        var _0x213504;
        _0x1ae0fc === -1 ? _0x213504 = _0x5f5162.lastIndexOf('@') : _0x213504 = _0x5f5162.lastIndexOf('@', _0x1ae0fc);
        _0x213504 !== -1 && (_0x2d8453 = _0x5f5162.slice(0, _0x213504), _0x5f5162 = _0x5f5162.slice(_0x213504 + 1), this.auth = decodeURIComponent(_0x2d8453));
        _0x1ae0fc = -1;
        for (var _0xd4235f = 0; _0xd4235f < _0x536c8e.length; _0xd4235f++) {
          var _0x5b1cba = _0x5f5162.indexOf(_0x536c8e[_0xd4235f]);
          if (_0x5b1cba !== -1 && (_0x1ae0fc === -1 || _0x5b1cba < _0x1ae0fc)) {
            _0x1ae0fc = _0x5b1cba;
          }
        }
        if (_0x1ae0fc === -1) {
          _0x1ae0fc = _0x5f5162.length;
        }
        this.host = _0x5f5162.slice(0, _0x1ae0fc);
        _0x5f5162 = _0x5f5162.slice(_0x1ae0fc);
        this.parseHost();
        this.hostname = this.hostname || '';
        var _0x5b6bdf = this.hostname[0] === '[' && this.hostname[this.hostname.length - 1] === ']';
        if (!_0x5b6bdf) {
          var _0x5ce0e5 = this.hostname.split(/\./);
          for (var _0xd4235f = 0, _0x32bafa = _0x5ce0e5.length; _0xd4235f < _0x32bafa; _0xd4235f++) {
            var _0x57904d = _0x5ce0e5[_0xd4235f];
            if (!_0x57904d) {
              continue;
            }
            if (!_0x57904d.match(_0x4b21e9)) {
              var _0x3d51e0 = '';
              for (var _0x20a3d2 = 0, _0x23b598 = _0x57904d.length; _0x20a3d2 < _0x23b598; _0x20a3d2++) {
                if (_0x57904d.charCodeAt(_0x20a3d2) > 127) {
                  _0x3d51e0 += 'x';
                } else {
                  _0x3d51e0 += _0x57904d[_0x20a3d2];
                }
              }
              if (!_0x3d51e0.match(_0x4b21e9)) {
                var _0x48f08c = _0x5ce0e5.slice(0, _0xd4235f);
                var _0x476b2c = _0x5ce0e5.slice(_0xd4235f + 1);
                var _0x55ba42 = _0x57904d.match(_0x1b6f10);
                _0x55ba42 && (_0x48f08c.push(_0x55ba42[1]), _0x476b2c.unshift(_0x55ba42[2]));
                if (_0x476b2c.length) {
                  _0x5f5162 = '/' + _0x476b2c.join('.') + _0x5f5162;
                }
                this.hostname = _0x48f08c.join('.');
                break;
              }
            }
          }
        }
        if (this.hostname.length > _0x334791) {
          this.hostname = '';
        } else {
          this.hostname = this.hostname.toLowerCase();
        }
        !_0x5b6bdf && (this.hostname = _0x35ed23.toASCII(this.hostname));
        var _0x2b1a79 = this.port ? ':' + this.port : '';
        var _0x59de24 = this.hostname || '';
        this.host = _0x59de24 + _0x2b1a79;
        this.href += this.host;
        if (_0x5b6bdf) {
          this.hostname = this.hostname.substr(1, this.hostname.length - 2);
          if (_0x5f5162[0] !== '/') {
            _0x5f5162 = '/' + _0x5f5162;
          }
        }
      }
      if (!_0x2c6ee5[_0x35c66a]) {
        for (var _0xd4235f = 0, _0x32bafa = _0x3ae468.length; _0xd4235f < _0x32bafa; _0xd4235f++) {
          var _0x33822b = _0x3ae468[_0xd4235f];
          if (_0x5f5162.indexOf(_0x33822b) === -1) {
            continue;
          }
          var _0x1d3d56 = encodeURIComponent(_0x33822b);
          if (_0x1d3d56 === _0x33822b) {
            _0x1d3d56 = escape(_0x33822b);
          }
          _0x5f5162 = _0x5f5162.split(_0x33822b).join(_0x1d3d56);
        }
      }
      var _0x15e270 = _0x5f5162.indexOf('#');
      _0x15e270 !== -1 && (this.hash = _0x5f5162.substr(_0x15e270), _0x5f5162 = _0x5f5162.slice(0, _0x15e270));
      var _0x5dd347 = _0x5f5162.indexOf('?');
      if (_0x5dd347 !== -1) {
        this.search = _0x5f5162.substr(_0x5dd347);
        this.query = _0x5f5162.substr(_0x5dd347 + 1);
        if (_0x5bebe5) {
          this.query = _0x47a4e5.parse(this.query);
        }
        _0x5f5162 = _0x5f5162.slice(0, _0x5dd347);
      } else {
        _0x5bebe5 && (this.search = '', this.query = {});
      }
      if (_0x5f5162) {
        this.pathname = _0x5f5162;
      }
      _0x356c91[_0x35c66a] && this.hostname && !this.pathname && (this.pathname = '/');
      if (this.pathname || this.search) {
        var _0x2b1a79 = this.pathname || '';
        var _0x137734 = this.search || '';
        this.path = _0x2b1a79 + _0x137734;
      }
      this.href = this.format();
      return this;
    };
    function _0xbfcecc(_0x2dcf97) {
      if (_0x6e1a36.isString(_0x2dcf97)) {
        _0x2dcf97 = _0x7b326f(_0x2dcf97);
      }
      if (!(_0x2dcf97 instanceof _0xfc4045)) {
        return _0xfc4045.prototype.format.call(_0x2dcf97);
      }
      return _0x2dcf97.format();
    }
    _0xfc4045.prototype.format = function () {
      var _0x364948 = this.auth || '';
      _0x364948 && (_0x364948 = encodeURIComponent(_0x364948), _0x364948 = _0x364948.replace(/%3A/i, ':'), _0x364948 += '@');
      var _0x4d03a7 = this.protocol || '';
      var _0x47a0f2 = this.pathname || '';
      var _0x488f21 = this.hash || '';
      var _0x1fc774 = false;
      var _0x2d7f8e = '';
      if (this.host) {
        _0x1fc774 = _0x364948 + this.host;
      } else {
        if (this.hostname) {
          _0x1fc774 = _0x364948 + (this.hostname.indexOf(':') === -1 ? this.hostname : '[' + this.hostname + ']');
          if (this.port) {
            _0x1fc774 += ':' + this.port;
          }
        }
      }
      if (this.query && _0x6e1a36.isObject(this.query) && Object.keys(this.query).length) {
        _0x2d7f8e = _0x47a4e5.stringify(this.query);
      }
      var _0xaf26ba = this.search || _0x2d7f8e && '?' + _0x2d7f8e || '';
      if (_0x4d03a7 && _0x4d03a7.substr(-1) !== ':') {
        _0x4d03a7 += ':';
      }
      if (this.slashes || (!_0x4d03a7 || _0x356c91[_0x4d03a7]) && _0x1fc774 !== false) {
        _0x1fc774 = '//' + (_0x1fc774 || '');
        if (_0x47a0f2 && _0x47a0f2.charAt(0) !== '/') {
          _0x47a0f2 = '/' + _0x47a0f2;
        }
      } else {
        if (!_0x1fc774) {
          _0x1fc774 = '';
        }
      }
      if (_0x488f21 && _0x488f21.charAt(0) !== '#') {
        _0x488f21 = '#' + _0x488f21;
      }
      if (_0xaf26ba && _0xaf26ba.charAt(0) !== '?') {
        _0xaf26ba = '?' + _0xaf26ba;
      }
      _0x47a0f2 = _0x47a0f2.replace(/[?#]/g, function (_0x443a92) {
        return encodeURIComponent(_0x443a92);
      });
      _0xaf26ba = _0xaf26ba.replace('#', "%23");
      return _0x4d03a7 + _0x1fc774 + _0x47a0f2 + _0xaf26ba + _0x488f21;
    };
    function _0x39070b(_0x3134a0, _0x1f47b4) {
      return _0x7b326f(_0x3134a0, false, true).resolve(_0x1f47b4);
    }
    _0xfc4045.prototype.resolve = function (_0x321fed) {
      return this.resolveObject(_0x7b326f(_0x321fed, false, true)).format();
    };
    function _0x16c940(_0x58875e, _0x53a30e) {
      if (!_0x58875e) {
        return _0x53a30e;
      }
      return _0x7b326f(_0x58875e, false, true).resolveObject(_0x53a30e);
    }
    _0xfc4045.prototype.resolveObject = function (_0x1b01f2) {
      if (_0x6e1a36.isString(_0x1b01f2)) {
        var _0x1c2ced = new _0xfc4045();
        _0x1c2ced.parse(_0x1b01f2, false, true);
        _0x1b01f2 = _0x1c2ced;
      }
      var _0x331f1c = new _0xfc4045();
      var _0x228a7a = Object.keys(this);
      for (var _0x56e507 = 0; _0x56e507 < _0x228a7a.length; _0x56e507++) {
        var _0x146117 = _0x228a7a[_0x56e507];
        _0x331f1c[_0x146117] = this[_0x146117];
      }
      _0x331f1c.hash = _0x1b01f2.hash;
      if (_0x1b01f2.href === '') {
        _0x331f1c.href = _0x331f1c.format();
        return _0x331f1c;
      }
      if (_0x1b01f2.slashes && !_0x1b01f2.protocol) {
        var _0x144ab0 = Object.keys(_0x1b01f2);
        for (var _0x24fe35 = 0; _0x24fe35 < _0x144ab0.length; _0x24fe35++) {
          var _0x10100e = _0x144ab0[_0x24fe35];
          if (_0x10100e !== "protocol") {
            _0x331f1c[_0x10100e] = _0x1b01f2[_0x10100e];
          }
        }
        _0x356c91[_0x331f1c.protocol] && _0x331f1c.hostname && !_0x331f1c.pathname && (_0x331f1c.path = _0x331f1c.pathname = '/');
        _0x331f1c.href = _0x331f1c.format();
        return _0x331f1c;
      }
      if (_0x1b01f2.protocol && _0x1b01f2.protocol !== _0x331f1c.protocol) {
        if (!_0x356c91[_0x1b01f2.protocol]) {
          var _0x1321d0 = Object.keys(_0x1b01f2);
          for (var _0x2c14d0 = 0; _0x2c14d0 < _0x1321d0.length; _0x2c14d0++) {
            var _0x46e0be = _0x1321d0[_0x2c14d0];
            _0x331f1c[_0x46e0be] = _0x1b01f2[_0x46e0be];
          }
          _0x331f1c.href = _0x331f1c.format();
          return _0x331f1c;
        }
        _0x331f1c.protocol = _0x1b01f2.protocol;
        if (!_0x1b01f2.host && !_0x2fe3aa[_0x1b01f2.protocol]) {
          var _0x522747 = (_0x1b01f2.pathname || '').split('/');
          while (_0x522747.length && !(_0x1b01f2.host = _0x522747.shift()));
          if (!_0x1b01f2.host) {
            _0x1b01f2.host = '';
          }
          if (!_0x1b01f2.hostname) {
            _0x1b01f2.hostname = '';
          }
          if (_0x522747[0] !== '') {
            _0x522747.unshift('');
          }
          if (_0x522747.length < 2) {
            _0x522747.unshift('');
          }
          _0x331f1c.pathname = _0x522747.join('/');
        } else {
          _0x331f1c.pathname = _0x1b01f2.pathname;
        }
        _0x331f1c.search = _0x1b01f2.search;
        _0x331f1c.query = _0x1b01f2.query;
        _0x331f1c.host = _0x1b01f2.host || '';
        _0x331f1c.auth = _0x1b01f2.auth;
        _0x331f1c.hostname = _0x1b01f2.hostname || _0x1b01f2.host;
        _0x331f1c.port = _0x1b01f2.port;
        if (_0x331f1c.pathname || _0x331f1c.search) {
          var _0x184407 = _0x331f1c.pathname || '';
          var _0x19e412 = _0x331f1c.search || '';
          _0x331f1c.path = _0x184407 + _0x19e412;
        }
        _0x331f1c.slashes = _0x331f1c.slashes || _0x1b01f2.slashes;
        _0x331f1c.href = _0x331f1c.format();
        return _0x331f1c;
      }
      var _0x479462 = _0x331f1c.pathname && _0x331f1c.pathname.charAt(0) === '/';
      var _0x343c65 = _0x1b01f2.host || _0x1b01f2.pathname && _0x1b01f2.pathname.charAt(0) === '/';
      var _0x1ff28e = _0x343c65 || _0x479462 || _0x331f1c.host && _0x1b01f2.pathname;
      var _0x220df0 = _0x1ff28e;
      var _0x2220cb = _0x331f1c.pathname && _0x331f1c.pathname.split('/') || [];
      var _0x522747 = _0x1b01f2.pathname && _0x1b01f2.pathname.split('/') || [];
      var _0x1b2387 = _0x331f1c.protocol && !_0x356c91[_0x331f1c.protocol];
      if (_0x1b2387) {
        _0x331f1c.hostname = '';
        _0x331f1c.port = null;
        if (_0x331f1c.host) {
          if (_0x2220cb[0] === '') {
            _0x2220cb[0] = _0x331f1c.host;
          } else {
            _0x2220cb.unshift(_0x331f1c.host);
          }
        }
        _0x331f1c.host = '';
        if (_0x1b01f2.protocol) {
          _0x1b01f2.hostname = null;
          _0x1b01f2.port = null;
          if (_0x1b01f2.host) {
            if (_0x522747[0] === '') {
              _0x522747[0] = _0x1b01f2.host;
            } else {
              _0x522747.unshift(_0x1b01f2.host);
            }
          }
          _0x1b01f2.host = null;
        }
        _0x1ff28e = _0x1ff28e && (_0x522747[0] === '' || _0x2220cb[0] === '');
      }
      if (_0x343c65) {
        _0x331f1c.host = _0x1b01f2.host || _0x1b01f2.host === '' ? _0x1b01f2.host : _0x331f1c.host;
        _0x331f1c.hostname = _0x1b01f2.hostname || _0x1b01f2.hostname === '' ? _0x1b01f2.hostname : _0x331f1c.hostname;
        _0x331f1c.search = _0x1b01f2.search;
        _0x331f1c.query = _0x1b01f2.query;
        _0x2220cb = _0x522747;
      } else {
        if (_0x522747.length) {
          if (!_0x2220cb) {
            _0x2220cb = [];
          }
          _0x2220cb.pop();
          _0x2220cb = _0x2220cb.concat(_0x522747);
          _0x331f1c.search = _0x1b01f2.search;
          _0x331f1c.query = _0x1b01f2.query;
        } else {
          if (!_0x6e1a36.isNullOrUndefined(_0x1b01f2.search)) {
            if (_0x1b2387) {
              _0x331f1c.hostname = _0x331f1c.host = _0x2220cb.shift();
              var _0x24f156 = _0x331f1c.host && _0x331f1c.host.indexOf('@') > 0 ? _0x331f1c.host.split('@') : false;
              _0x24f156 && (_0x331f1c.auth = _0x24f156.shift(), _0x331f1c.host = _0x331f1c.hostname = _0x24f156.shift());
            }
            _0x331f1c.search = _0x1b01f2.search;
            _0x331f1c.query = _0x1b01f2.query;
            if (!_0x6e1a36.isNull(_0x331f1c.pathname) || !_0x6e1a36.isNull(_0x331f1c.search)) {
              _0x331f1c.path = (_0x331f1c.pathname ? _0x331f1c.pathname : '') + (_0x331f1c.search ? _0x331f1c.search : '');
            }
            _0x331f1c.href = _0x331f1c.format();
            return _0x331f1c;
          }
        }
      }
      if (!_0x2220cb.length) {
        _0x331f1c.pathname = null;
        if (_0x331f1c.search) {
          _0x331f1c.path = '/' + _0x331f1c.search;
        } else {
          _0x331f1c.path = null;
        }
        _0x331f1c.href = _0x331f1c.format();
        return _0x331f1c;
      }
      var _0x1e863a = _0x2220cb.slice(-1)[0];
      var _0x5a8769 = (_0x331f1c.host || _0x1b01f2.host || _0x2220cb.length > 1) && (_0x1e863a === '.' || _0x1e863a === '..') || _0x1e863a === '';
      var _0x34ffc3 = 0;
      for (var _0x1d4da2 = _0x2220cb.length; _0x1d4da2 >= 0; _0x1d4da2--) {
        _0x1e863a = _0x2220cb[_0x1d4da2];
        if (_0x1e863a === '.') {
          _0x2220cb.splice(_0x1d4da2, 1);
        } else {
          if (_0x1e863a === '..') {
            _0x2220cb.splice(_0x1d4da2, 1);
            _0x34ffc3++;
          } else {
            _0x34ffc3 && (_0x2220cb.splice(_0x1d4da2, 1), _0x34ffc3--);
          }
        }
      }
      if (!_0x1ff28e && !_0x220df0) {
        for (; _0x34ffc3--; _0x34ffc3) {
          _0x2220cb.unshift('..');
        }
      }
      _0x1ff28e && _0x2220cb[0] !== '' && (!_0x2220cb[0] || _0x2220cb[0].charAt(0) !== '/') && _0x2220cb.unshift('');
      _0x5a8769 && _0x2220cb.join('/').substr(-1) !== '/' && _0x2220cb.push('');
      var _0x3a9213 = _0x2220cb[0] === '' || _0x2220cb[0] && _0x2220cb[0].charAt(0) === '/';
      if (_0x1b2387) {
        _0x331f1c.hostname = _0x331f1c.host = _0x3a9213 ? '' : _0x2220cb.length ? _0x2220cb.shift() : '';
        var _0x24f156 = _0x331f1c.host && _0x331f1c.host.indexOf('@') > 0 ? _0x331f1c.host.split('@') : false;
        if (_0x24f156) {
          _0x331f1c.auth = _0x24f156.shift();
          _0x331f1c.host = _0x331f1c.hostname = _0x24f156.shift();
        }
      }
      _0x1ff28e = _0x1ff28e || _0x331f1c.host && _0x2220cb.length;
      _0x1ff28e && !_0x3a9213 && _0x2220cb.unshift('');
      if (!_0x2220cb.length) {
        _0x331f1c.pathname = null;
        _0x331f1c.path = null;
      } else {
        _0x331f1c.pathname = _0x2220cb.join('/');
      }
      if (!_0x6e1a36.isNull(_0x331f1c.pathname) || !_0x6e1a36.isNull(_0x331f1c.search)) {
        _0x331f1c.path = (_0x331f1c.pathname ? _0x331f1c.pathname : '') + (_0x331f1c.search ? _0x331f1c.search : '');
      }
      _0x331f1c.auth = _0x1b01f2.auth || _0x331f1c.auth;
      _0x331f1c.slashes = _0x331f1c.slashes || _0x1b01f2.slashes;
      _0x331f1c.href = _0x331f1c.format();
      return _0x331f1c;
    };
    _0xfc4045.prototype.parseHost = function () {
      var _0x5116c0 = this.host;
      var _0x59b7b0 = _0x5630d9.exec(_0x5116c0);
      if (_0x59b7b0) {
        _0x59b7b0 = _0x59b7b0[0];
        _0x59b7b0 !== ':' && (this.port = _0x59b7b0.substr(1));
        _0x5116c0 = _0x5116c0.substr(0, _0x5116c0.length - _0x59b7b0.length);
      }
      if (_0x5116c0) {
        this.hostname = _0x5116c0;
      }
    };
  },
  './node_modules/url/util.js': function (_0x1672f8, _0x37b6df, _0x28cf1e) {
    'use strict';

    _0x1672f8.exports = {
      isString: function (_0x4e7a33) {
        return typeof _0x4e7a33 === "string";
      },
      isObject: function (_0x436092) {
        return typeof _0x436092 === "object" && _0x436092 !== null;
      },
      isNull: function (_0xf519be) {
        return _0xf519be === null;
      },
      isNullOrUndefined: function (_0x14ab0b) {
        return _0x14ab0b == null;
      }
    };
  },
  './node_modules/webpack/buildin/global.js': function (_0x371880, _0x1548cf) {
    var _0x1ef037;
    _0x1ef037 = function () {
      return this;
    }();
    try {
      _0x1ef037 = _0x1ef037 || new Function("return this")();
    } catch (_0x5ab9e8) {
      if (typeof window === "object") {
        _0x1ef037 = window;
      }
    }
    _0x371880.exports = _0x1ef037;
  },
  './node_modules/webpack/buildin/module.js': function (_0x1558df, _0x587050) {
    _0x1558df.exports = function (_0x1243b4) {
      if (!_0x1243b4.webpackPolyfill) {
        _0x1243b4.deprecate = function () {};
        _0x1243b4.paths = [];
        if (!_0x1243b4.children) {
          _0x1243b4.children = [];
        }
        Object.defineProperty(_0x1243b4, "loaded", {
          enumerable: true,
          get: function () {
            return _0x1243b4.l;
          }
        });
        Object.defineProperty(_0x1243b4, 'id', {
          enumerable: true,
          get: function () {
            return _0x1243b4.i;
          }
        });
        _0x1243b4.webpackPolyfill = 1;
      }
      return _0x1243b4;
    };
  },
  './src/js/app.js': function (_0x28958b, _0x504b1a, _0x495a94) {
    'use strict';

    window.loadedScript = true;
    var _0x22dbbf = location.hostname !== "127.0.0.1" && !location.hostname.startsWith("192.168.");
    _0x495a94("./src/js/libs/modernizr.js");
    var _0x32027d = _0x495a94("./src/js/libs/io-client.js");
    var _0x4a052b = _0x495a94("./src/js/libs/utils.js");
    var _0xd8622e = _0x495a94("./src/js/libs/animText.js");
    var _0x1052c8 = _0x495a94("./src/js/config.js");
    var _0x8e208a = _0x495a94("./src/js/data/gameObject.js");
    var _0x34ff74 = _0x495a94("./src/js/data/items.js");
    var _0x32659d = _0x495a94("./src/js/data/mapManager.js");
    var _0x597e78 = _0x495a94("./src/js/data/objectManager.js");
    var _0x4364e4 = _0x495a94("./src/js/data/player.js");
    var _0x586444 = _0x495a94("./src/js/data/store.js");
    var _0x20f8dc = _0x495a94("./src/js/data/projectile.js");
    var _0x2dc667 = _0x495a94("./src/js/data/projectileManager.js");
    var _0x551989 = _0x495a94("./src/js/libs/soundManager.js").obj;
    var _0x40c2fb = new _0xd8622e.TextManager();
    var _0x27d978 = _0x495a94("./vultr/VultrClient.js");
    var _0x17dbb2 = new _0x27d978("moomoo.io", 443, _0x1052c8.maxPlayers, 5, false);
    _0x17dbb2.debugLog = false;
    function _0x43bc19(_0x146e6d, _0x4c3f59) {
      !_0x4c3f59 && (_0x4c3f59 = window.location.href);
      _0x146e6d = _0x146e6d.replace(/[\[\]]/g, "\\$&");
      var _0x4f585d = new RegExp("[?&]" + _0x146e6d + "(=([^&#]*)|&|#|$)");
      var _0x415263 = _0x4f585d.exec(_0x4c3f59);
      if (!_0x415263) {
        return null;
      }
      if (!_0x415263[2]) {
        return '';
      }
      return decodeURIComponent(_0x415263[2].replace(/\+/g, '\x20'));
    }
    var _0x5956f8 = false;
    var _0x3e329a = false;
    function _0xa65e8() {
      if (!_0x5d1731 || !_0x1a7310) {
        return;
      }
      _0x3e329a = true;
      if (_0x22dbbf) {
        window.grecaptcha.execute("6LevKusUAAAAAAFknhlV8sPtXAk5Z5dGP5T2FYIZ", {
          action: "homepage"
        }).then(function (_0x227e96) {
          _0x1ec7be(_0x227e96);
        });
      } else {
        _0x1ec7be(null);
      }
    }
    let _0x7d5668 = false;
    function _0x1ec7be(_0x275321) {
      _0x17dbb2.start(function (_0x2ad292, _0x29983a, _0x565f74) {
        var _0x34d3aa = "wss://" + _0x2ad292;
        tmpAddress = _0x34d3aa;
        if (_0x275321) {
          _0x34d3aa += "?token=" + encodeURIComponent(_0x275321);
        }
        _0x32027d.connect(_0x34d3aa, function (_0x2f6087) {
          setInterval(() => {
            minPacket = Math.max(0, minPacket - 2700);
          }, minTime);
          setInterval(() => {
            secPacket = Math.max(0, secPacket - 50);
          }, secTime);
          _0x4b1f7a();
          setInterval(() => _0x4b1f7a(), 2500);
          if (_0x2f6087) {
            _0x35ea04(_0x2f6087);
          } else {
            _0x5956f8 = true;
            _0x470a7e();
          }
        }, {
          id: _0x4e8f93,
          d: _0x35ea04,
          '1': _0x43a10c,
          '2': _0x1a4abc,
          '4': _0x415cbf,
          '33': _0x1bef36,
          '5': _0xaa259b,
          '6': _0x151524,
          a: _0x59442f,
          aa: _0x265b66,
          '7': _0x1eb3d9,
          '8': _0x1cf399,
          sp: _0x4c3e4e,
          '9': _0x71ab7d,
          h: _0x24b6be,
          '11': _0x201b39,
          '12': _0x4ed211,
          '13': _0x179200,
          '14': _0x4bf482,
          '15': _0x246259,
          '16': _0x428306,
          '17': _0xe32733,
          '18': _0x449319,
          '19': _0x5b43b8,
          '20': _0x3af19e,
          ac: _0x58b130,
          ad: _0x54b870,
          an: _0x222b1c,
          st: _0x4c7a50,
          sa: _0x4d30a4,
          us: _0x2e512a,
          ch: _0x477922,
          mm: _0x5c813c,
          t: _0x56be14,
          p: _0x15d20d,
          pp: _0x533c47
        });
        _0x179f00();
        setTimeout(() => _0x5a61d9(), 3000);
      }, function (_0x52bb4f) {
        console.error("Vultr error:", _0x52bb4f), _0x35ea04("disconnected");
      });
    }
    function _0x1c7600() {
      return _0x32027d.connected;
    }
    function _0x587e55() {
      var _0x3209ab = _0x580e68.value;
      var _0x4310ce = prompt("party key", _0x3209ab);
      if (_0x4310ce) {
        window.onbeforeunload = undefined;
        window.location.href = "/?server=" + _0x4310ce;
      }
    }
    var _0x149fcb = new _0x551989(_0x1052c8, _0x4a052b);
    function _0x586fd8(_0x580afc) {
      if (_0x580afc == undefined) {
        _0x580afc = !_0x149fcb.active;
      }
      _0x149fcb.active = _0x580afc;
      _0x5a4e2c("moo_moosic", _0x580afc ? 1 : 0);
    }
    var _0x28e4b1 = Math.PI;
    var _0x27c20d = _0x28e4b1 * 2;
    var _0x2b7a35 = _0x28e4b1 * 3;
    Math.lerpAngle = function (_0x39ce81, _0x34dc68, _0x353158) {
      var _0x43c558 = Math.abs(_0x34dc68 - _0x39ce81);
      if (_0x43c558 > _0x28e4b1) {
        if (_0x39ce81 > _0x34dc68) {
          _0x34dc68 += _0x27c20d;
        } else {
          _0x39ce81 += _0x27c20d;
        }
      }
      var _0xdb81a1 = _0x34dc68 + (_0x39ce81 - _0x34dc68) * _0x353158;
      if (_0xdb81a1 >= 0 && _0xdb81a1 <= _0x27c20d) {
        return _0xdb81a1;
      }
      return _0xdb81a1 % _0x27c20d;
    };
    CanvasRenderingContext2D.prototype.roundRect = function (_0x4bfebe, _0x37588e, _0x147150, _0x187357, _0x5dd181) {
      if (_0x147150 < 2 * _0x5dd181) {
        _0x5dd181 = _0x147150 / 2;
      }
      if (_0x187357 < 2 * _0x5dd181) {
        _0x5dd181 = _0x187357 / 2;
      }
      if (_0x5dd181 < 0) {
        _0x5dd181 = 0;
      }
      this.beginPath();
      this.moveTo(_0x4bfebe + _0x5dd181, _0x37588e);
      this.arcTo(_0x4bfebe + _0x147150, _0x37588e, _0x4bfebe + _0x147150, _0x37588e + _0x187357, _0x5dd181);
      this.arcTo(_0x4bfebe + _0x147150, _0x37588e + _0x187357, _0x4bfebe, _0x37588e + _0x187357, _0x5dd181);
      this.arcTo(_0x4bfebe, _0x37588e + _0x187357, _0x4bfebe, _0x37588e, _0x5dd181);
      this.arcTo(_0x4bfebe, _0x37588e, _0x4bfebe + _0x147150, _0x37588e, _0x5dd181);
      this.closePath();
      return this;
    };
    var _0x290a7a;
    if (typeof Storage !== "undefined") {
      _0x290a7a = true;
    }
    function _0x5a4e2c(_0xd6acf6, _0x56b3fa) {
      if (_0x290a7a) {
        localStorage.setItem(_0xd6acf6, _0x56b3fa);
      }
    }
    function _0x2a4f0f(_0x4fe402) {
      if (_0x290a7a) {
        localStorage.removeItem(_0x4fe402);
      }
    }
    function _0x5cd5b4(_0x468ed4) {
      if (_0x290a7a) {
        return localStorage.getItem(_0x468ed4);
      }
      return null;
    }
    var _0x2a7dfd = _0x5cd5b4("moofoll");
    function _0x4b6d2a() {
      !_0x2a7dfd && (_0x2a7dfd = true, _0x5a4e2c("moofoll", 1));
    }
    var _0x37ed13;
    var _0x14cfa4;
    var _0xa3a065;
    var _0x5dab85 = 1;
    var _0x17d20f;
    var _0x5462e6;
    var _0x4fc701;
    var _0x51c021 = Date.now();
    var _0x835d48;
    var _0x42b0d6;
    var _0x4c7cec = [];
    var _0xe6cd1d = [];
    var _0x1751ab = [];
    var _0x4a45e9 = [];
    var _0x6d2acb = [];
    var _0x5eddd3 = new _0x2dc667(_0x20f8dc, _0x6d2acb, _0xe6cd1d, _0x4c7cec, _0x1a4d70, _0x34ff74, _0x1052c8, _0x4a052b);
    var _0x1fde67 = _0x495a94("./src/js/data/aiManager.js");
    var _0x47a74b = _0x495a94("./src/js/data/ai.js");
    var _0xee4ba9 = new _0x1fde67(_0x4c7cec, _0x47a74b, _0xe6cd1d, _0x34ff74, null, _0x1052c8, _0x4a052b);
    var _0x2c6f82;
    var _0x4d4c14;
    var _0x48c073;
    var _0x50d938 = 1;
    var _0x4fdee5 = 0;
    var _0x3c100f = 0;
    var _0x508ec3 = 0;
    var _0x2a2abc = {
      id: -1,
      startX: 0x0,
      startY: 0x0,
      currentX: 0x0,
      currentY: 0x0
    };
    var _0x59c5a6 = _0x2a2abc;
    var _0x494678 = {
      id: -1,
      startX: 0x0,
      startY: 0x0,
      currentX: 0x0,
      currentY: 0x0
    };
    var _0x3433b6 = _0x494678;
    var _0x376363;
    var _0x174296;
    var _0x5921f8;
    var _0x43337d = 0;
    var _0xfa8e22 = _0x1052c8.maxScreenWidth;
    var _0x207741 = _0x1052c8.maxScreenHeight;
    var _0x58f14f;
    var _0x7ed5da;
    var _0x1a6b21 = false;
    var _0x5a747b = document.getElementById("ad-container");
    var _0xc915d = document.getElementById("mainMenu");
    var _0x5b380a = document.getElementById("enterGame");
    var _0x173923 = document.getElementById("promoImg");
    var _0x31daaa = document.getElementById("partyButton");
    var _0xe0268 = document.getElementById("joinPartyButton");
    var _0x46f329 = document.getElementById("settingsButton");
    var _0x4ad253 = _0x46f329.getElementsByTagName("span")[0];
    var _0x38d98a = document.getElementById("allianceButton");
    var _0xd38152 = document.getElementById("storeButton");
    var _0x2f6209 = document.getElementById("chatButton");
    var _0x44932d = document.getElementById("gameCanvas");
    var _0xce3328 = _0x44932d.getContext('2d');
    var _0x580e68 = document.getElementById("serverBrowser");
    var _0x3e7877 = document.getElementById("nativeResolution");
    var _0x564521 = document.getElementById("showPing");
    var _0x55387e = document.getElementById("playMusic");
    var _0x7e01b4 = document.getElementById("pingDisplay");
    var _0x274f80 = document.getElementById("shutdownDisplay");
    var _0x2996d0 = document.getElementById("menuCardHolder");
    var _0x626a64 = document.getElementById("guideCard");
    var _0x2f3f09 = document.getElementById("loadingText");
    var _0x5a888a = document.getElementById("gameUI");
    var _0x4b4042 = document.getElementById("actionBar");
    var _0x15d528 = document.getElementById("scoreDisplay");
    var _0x3422a5 = document.getElementById("foodDisplay");
    var _0x122d08 = document.getElementById("woodDisplay");
    var _0x372140 = document.getElementById("stoneDisplay");
    var _0x2d7ed1 = document.getElementById("killCounter");
    var _0x449745 = document.getElementById("leaderboardData");
    var _0xfea98f = document.getElementById("nameInput");
    var _0xa07602 = document.getElementById("itemInfoHolder");
    var _0x3d2b41 = document.getElementById("ageText");
    var _0x15ae40 = document.getElementById("ageBarBody");
    var _0x2cdfa4 = document.getElementById("upgradeHolder");
    var _0x360713 = document.getElementById("upgradeCounter");
    var _0x28965f = document.getElementById("allianceMenu");
    var _0x56e409 = document.getElementById("allianceHolder");
    var _0x5a36a4 = document.getElementById("allianceManager");
    var _0x53fefd = document.getElementById("mapDisplay");
    var _0x46ad7d = document.getElementById("diedText");
    var _0x1f4507 = document.getElementById("skinColorHolder");
    var _0x47f03a = _0x53fefd.getContext('2d');
    _0x53fefd.width = 300;
    _0x53fefd.height = 300;
    var _0x58dc29 = document.getElementById("storeMenu");
    var _0x235a4b = document.getElementById("storeHolder");
    var _0x17d4b5 = document.getElementById("noticationDisplay");
    var _0x2ecb5e = _0x586444.hats;
    var _0x1bbb87 = _0x586444.accessories;
    var _0x1a4d70 = new _0x597e78(_0x8e208a, _0x4a45e9, _0x4a052b, _0x1052c8);
    var _0x36f304 = "#525252";
    var _0x5abed7 = "#3d3f42";
    var _0x59cf25 = Math.PI;
    function _0x4e8f93(_0x12b174) {
      _0x1751ab = _0x12b174.teams;
    }
    var _0x584c31 = document.getElementById("featuredYoutube");
    var _0x176fe0 = [{
      name: "InsanityMon",
      link: "https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw"
    }, {
      name: "Skid",
      link: "https://www.youtube.com/@King_DG"
    }, {
      name: "Shame",
      link: "https://www.youtube.com/@user-ne2vz4gc3j"
    }, {
      name: "Dog",
      link: "https://www.youtube.com/@Dream2947YT"
    }, {
      name: "Ae's dog",
      link: "https://www.youtube.com/@Zyenith"
    }, {
      name: "Pro",
      link: "https://www.youtube.com/@literallynuro"
    }, {
      name: "Fan",
      link: "https://www.youtube.com/@insspixelzyx4360"
    }, {
      name: "Balwan",
      link: "https://www.youtube.com/@SabrinaSophina"
    }, {
      name: "Gay",
      link: "https://www.youtube.com/@bevis2910"
    }, {
      name: "Pls",
      link: "https://www.youtube.com/@zechy256"
    }, {
      name: "CowGamer69",
      link: "https://www.youtube.com/@sopeCow"
    }, {
      name: "Send Mod",
      link: "https://www.youtube.com/@waves440"
    }, {
      name: "Bad",
      link: "https://www.youtube.com/@Xiaokai.2"
    }, {
      name: "Ohio",
      link: "https://www.youtube.com/@squewe"
    }, {
      name: "meee mega boob :o",
      link: "https://www.youtube.com/@duckman7118"
    }, {
      name: "be mega boob",
      link: "https://www.youtube.com/@memeganoob"
    }, {
      name: "Ass",
      link: "https://www.youtube.com/@content7054"
    }];
    var _0x2e8bae = _0x176fe0[_0x4a052b.randInt(0, _0x176fe0.length - 1)];
    _0x584c31.innerHTML = "<a target='_blank' class='ytLink' href='" + _0x2e8bae.link + "'><i class='material-icons' style='vertical-align: top;'>&#xE064;</i> " + _0x2e8bae.name + "</a>";
    var _0x24e997 = true;
    var _0x5d1731 = false;
    var _0x1a7310 = false;
    window.onblur = function () {
      _0x24e997 = false;
    };
    window.onfocus = function () {
      _0x24e997 = true;
      if (_0x2c6f82 && _0x2c6f82.alive) {
        _0x5d09e9();
      }
    };
    window.onload = function () {
      _0x5d1731 = true;
      _0xa65e8();
      setTimeout(function () {
        !_0x3e329a && window.location.reload();
      }, 20000);
    };
    window.captchaCallback = function () {
      _0x1a7310 = true, _0xa65e8();
    };
    _0x44932d.oncontextmenu = function () {
      return false;
    };
    function _0x35ea04(_0x3ac75e) {
      _0x5956f8 = false, _0x32027d.close(), _0x4648d4(_0x3ac75e);
    }
    function _0x4648d4(_0x18f0f3) {
      _0xc915d.style.display = "block";
      _0x5a888a.style.display = "none";
      _0x2996d0.style.display = "none";
      _0x46ad7d.style.display = "none";
      _0x2f3f09.style.display = "block";
      _0x2f3f09.innerHTML = _0x18f0f3 + "<a href='javascript:window.location.href=window.location.href' class='ytLink'>reload</a>";
    }
    function _0x4a39e3() {
      _0x5b380a.onclick = _0x4a052b.checkTrusted(function () {
        _0x3c674c();
      });
      _0x4a052b.hookTouchEvents(_0x5b380a);
      _0x173923.onclick = _0x4a052b.checkTrusted(function () {
        _0x2b2283("https://krunker.io/?play=SquidGame_KB");
      });
      _0x4a052b.hookTouchEvents(_0x173923);
      _0xe0268.onclick = _0x4a052b.checkTrusted(function () {
        setTimeout(function () {
          _0x587e55();
        }, 10);
      });
      _0x4a052b.hookTouchEvents(_0xe0268);
      _0x46f329.onclick = _0x4a052b.checkTrusted(function () {
        _0x5c1a9d();
      });
      _0x4a052b.hookTouchEvents(_0x46f329);
      _0x38d98a.onclick = _0x4a052b.checkTrusted(function () {
        _0x39a0d0();
      });
      _0x4a052b.hookTouchEvents(_0x38d98a);
      _0xd38152.onclick = _0x4a052b.checkTrusted(function () {
        _0x3f2f2d();
      });
      _0x4a052b.hookTouchEvents(_0xd38152);
      _0x2f6209.onclick = _0x4a052b.checkTrusted(function () {
        _0x481f7d();
      });
      _0x4a052b.hookTouchEvents(_0x2f6209);
      _0x53fefd.onclick = _0x4a052b.checkTrusted(function () {
        _0x4a0b64();
      });
      _0x4a052b.hookTouchEvents(_0x53fefd);
    }
    var _0xce4d18 = 1;
    function _0x179f00() {
      var _0x138bd4 = '';
      var _0x279879 = 0;
      var _0x1872ba = 0;
      for (var _0x4848e8 in _0x17dbb2.servers) {
        var _0x55c554 = _0x17dbb2.servers[_0x4848e8];
        var _0x497e66 = 0;
        for (var _0xbc2a06 = 0; _0xbc2a06 < _0x55c554.length; _0xbc2a06++) {
          for (var _0x388d0d = 0; _0x388d0d < _0x55c554[_0xbc2a06].games.length; _0x388d0d++) {
            _0x497e66 += _0x55c554[_0xbc2a06].games[_0x388d0d].playerCount;
          }
        }
        _0x279879 += _0x497e66;
        var _0x32f56a = _0x17dbb2.regionInfo[_0x4848e8].name;
        _0x138bd4 += "<option disabled>" + _0x32f56a + " - " + _0x497e66 + " players</option>";
        for (var _0x4f446d = 0; _0x4f446d < _0x55c554.length; _0x4f446d++) {
          var _0x171d63 = _0x55c554[_0x4f446d];
          for (var _0x5e46a7 = 0; _0x5e46a7 < _0x171d63.games.length; _0x5e46a7++) {
            var _0x1b5dfd = _0x171d63.games[_0x5e46a7];
            var _0x485730 = _0x171d63.index * _0xce4d18 + _0x5e46a7 + 1;
            var _0x2c2189 = _0x17dbb2.server && _0x17dbb2.server.region === _0x171d63.region && _0x17dbb2.server.index === _0x171d63.index && _0x17dbb2.gameIndex == _0x5e46a7;
            var _0x4ae7c6 = _0x32f56a + '\x20' + _0x485730 + '\x20[' + Math.min(_0x1b5dfd.playerCount, _0x1052c8.maxPlayers) + '/' + _0x1052c8.maxPlayers + ']';
            let _0x3819f2 = _0x17dbb2.stripRegion(_0x4848e8) + ':' + _0x4f446d + ':' + _0x5e46a7;
            if (_0x2c2189) {
              _0x31daaa.getElementsByTagName("span")[0].innerText = _0x3819f2;
            }
            let _0x9e823e = _0x2c2189 ? "selected" : '';
            _0x138bd4 += "<option value='" + _0x3819f2 + '\x27\x20' + _0x9e823e + '>' + _0x4ae7c6 + "</option>";
          }
        }
        _0x138bd4 += "<option disabled></option>";
        _0x1872ba++;
      }
      _0x138bd4 += "<option disabled>All Servers - " + _0x279879 + " players</option>";
      _0x580e68.innerHTML = _0x138bd4;
      var _0x503249;
      var _0xcb3165;
      if (location.hostname == "sandbox.moomoo.io") {
        _0x503249 = "Back to MooMoo";
        _0xcb3165 = "//moomoo.io/";
      } else {
        _0x503249 = "Try the sandbox", _0xcb3165 = "//sandbox.moomoo.io/";
      }
      document.getElementById("altServer").innerHTML = "<a href='" + _0xcb3165 + '\x27>' + _0x503249 + "<i class='material-icons' style='font-size:10px;vertical-align:middle'>arrow_forward_ios</i></a>";
    }
    function _0x5a61d9() {
      var _0x1c317c = new XMLHttpRequest();
      var _0x53658f = "/serverData";
      _0x1c317c.onreadystatechange = function () {
        if (this.readyState == 4) {
          if (this.status == 200) {
            window.vultr = JSON.parse(this.responseText);
            _0x17dbb2.processServers(vultr.servers);
            _0x179f00();
          } else {
            console.error("Failed to load server data with status code:", this.status);
          }
        }
      };
      _0x1c317c.open("GET", _0x53658f, true);
      _0x1c317c.send();
    }
    _0x580e68.addEventListener("change", _0x4a052b.checkTrusted(function () {
      let _0x4c328d = _0x580e68.value.split(':');
      _0x17dbb2.switchServer(_0x4c328d[0], _0x4c328d[1], _0x4c328d[2]);
    }));
    var _0x120e70 = document.getElementById("pre-content-container");
    var _0x1dbe0d = 300000;
    var _0x64e1dd = 0;
    var _0x585cc9 = 0;
    function _0x3c674c() {
      _0x585cc9++;
      var _0x1aab8b = _0x585cc9 > 1;
      var _0x340301 = Date.now() - _0x64e1dd > _0x1dbe0d;
      _0x1aab8b && _0x340301 ? (_0x64e1dd = Date.now(), _0x5875e0()) : _0x49a9df();
    }
    function _0x5875e0() {
      if (!window.adsbygoogle) {
        return console.log("Failed to load video ad API");
        undefined;
      }
      window.adsbygoogle.push({
        type: "next",
        adBreakDone: () => {
          _0x49a9df();
        }
      });
    }
    window.adsbygoogle && adsbygoogle.push({
      preloadAdBreaks: 'on'
    });
    window.showPreAd = _0x5875e0;
    function _0x509f14() {
      _0x120e70.style.display = "none";
      _0x49a9df();
    }
    function _0x4873c6(_0x1c3a12, _0x4c2d22, _0x4b8b0e) {
      if (_0x2c6f82 && _0x1c3a12) {
        _0x4a052b.removeAllChildren(_0xa07602);
        _0xa07602.classList.add("visible");
        _0x4a052b.generateElement({
          id: "itemInfoName",
          text: _0x4a052b.capitalizeFirst(_0x1c3a12.name),
          parent: _0xa07602
        });
        var _0x1fff90 = {
          id: "itemInfoDesc",
          text: _0x1c3a12.desc,
          parent: _0xa07602
        };
        _0x4a052b.generateElement(_0x1fff90);
        if (_0x4b8b0e) {} else {
          if (_0x4c2d22) {
            var _0x3b224d = {
              class: "itemInfoReq",
              text: !_0x1c3a12.type ? "primary" : "secondary",
              parent: _0xa07602
            };
            _0x4a052b.generateElement(_0x3b224d);
          } else {
            for (var _0x54196a = 0; _0x54196a < _0x1c3a12.req.length; _0x54196a += 2) {
              _0x4a052b.generateElement({
                class: "itemInfoReq",
                html: _0x1c3a12.req[_0x54196a] + "<span class='itemInfoReqVal'> x" + _0x1c3a12.req[_0x54196a + 1] + "</span>",
                parent: _0xa07602
              });
            }
            if (_0x1c3a12.group.limit) {
              _0x4a052b.generateElement({
                class: "itemInfoLmt",
                text: (_0x2c6f82.itemCounts[_0x1c3a12.group.id] || 0) + '/' + _0x1c3a12.group.limit,
                parent: _0xa07602
              });
            }
          }
        }
      } else {
        _0xa07602.classList.remove("visible");
      }
    }
    var _0x22bc45 = [];
    var _0x236358 = [];
    function _0x222b1c(_0x3d88ac, _0x24bbaa) {
      var _0x4025c6 = {
        sid: _0x3d88ac,
        name: _0x24bbaa
      };
      _0x22bc45.push(_0x4025c6);
      _0x622f7f();
    }
    function _0x622f7f() {
      if (_0x22bc45[0]) {
        var _0x25e27 = _0x22bc45[0];
        _0x4a052b.removeAllChildren(_0x17d4b5);
        _0x17d4b5.style.display = "block";
        var _0x1755bf = {
          class: "notificationText",
          text: _0x25e27.name,
          parent: _0x17d4b5
        };
        _0x4a052b.generateElement(_0x1755bf);
        _0x4a052b.generateElement({
          class: "notifButton",
          html: "<i class='material-icons' style='font-size:28px;color:#cc5151;'>&#xE14C;</i>",
          parent: _0x17d4b5,
          onclick: function () {
            _0x376840(0);
          },
          hookTouch: true
        });
        _0x4a052b.generateElement({
          class: "notifButton",
          html: "<i class='material-icons' style='font-size:28px;color:#8ecc51;'>&#xE876;</i>",
          parent: _0x17d4b5,
          onclick: function () {
            _0x376840(1);
          },
          hookTouch: true
        });
      } else {
        _0x17d4b5.style.display = "none";
      }
    }
    function _0x58b130(_0x308913) {
      _0x1751ab.push(_0x308913);
      if (_0x28965f.style.display == "block") {
        _0x173ecd();
      }
    }
    function _0x4c7a50(_0x4375c7, _0x8c2fa9) {
      if (_0x2c6f82) {
        _0x2c6f82.team = _0x4375c7;
        _0x2c6f82.isOwner = _0x8c2fa9;
        if (_0x28965f.style.display == "block") {
          _0x173ecd();
        }
      }
    }
    function _0x4d30a4(_0x4479c7) {
      _0x236358 = _0x4479c7;
      if (_0x28965f.style.display == "block") {
        _0x173ecd();
      }
    }
    function _0x54b870(_0x4f8d39) {
      for (var _0x16fa03 = _0x1751ab.length - 1; _0x16fa03 >= 0; _0x16fa03--) {
        if (_0x1751ab[_0x16fa03].sid == _0x4f8d39) {
          _0x1751ab.splice(_0x16fa03, 1);
        }
      }
      if (_0x28965f.style.display == "block") {
        _0x173ecd();
      }
    }
    function _0x39a0d0() {
      _0x5d09e9();
      _0x28965f.style.display != "block" ? _0x173ecd() : _0x28965f.style.display = "none";
    }
    function _0x173ecd() {
      if (_0x2c6f82 && _0x2c6f82.alive) {
        _0x29fd15();
        _0x58dc29.style.display = "none";
        _0x28965f.style.display = "block";
        _0x4a052b.removeAllChildren(_0x56e409);
        if (_0x2c6f82.team) {
          for (var _0x114fac = 0; _0x114fac < _0x236358.length; _0x114fac += 2) {
            (function (_0x1498a1) {
              var _0x1f93f3 = _0x4a052b.generateElement({
                class: "allianceItem",
                style: "color:" + (_0x236358[_0x1498a1] == _0x2c6f82.sid ? "#fff" : "rgba(255,255,255,0.6)"),
                text: _0x236358[_0x1498a1 + 1],
                parent: _0x56e409
              });
              _0x2c6f82.isOwner && _0x236358[_0x1498a1] != _0x2c6f82.sid && _0x4a052b.generateElement({
                class: "joinAlBtn",
                text: "Kick",
                onclick: function () {
                  _0x57ba04(_0x236358[_0x1498a1]);
                },
                hookTouch: true,
                parent: _0x1f93f3
              });
            })(_0x114fac);
          }
        } else {
          if (_0x1751ab.length) {
            for (var _0x114fac = 0; _0x114fac < _0x1751ab.length; ++_0x114fac) {
              (function (_0x38735c) {
                var _0x5a7b7c = _0x4a052b.generateElement({
                  class: "allianceItem",
                  style: "color:" + (_0x1751ab[_0x38735c].sid == _0x2c6f82.team ? "#fff" : "rgba(255,255,255,0.6)"),
                  text: _0x1751ab[_0x38735c].sid,
                  parent: _0x56e409
                });
                _0x4a052b.generateElement({
                  class: "joinAlBtn",
                  text: "Join",
                  onclick: function () {
                    _0x43f278(_0x38735c);
                  },
                  hookTouch: true,
                  parent: _0x5a7b7c
                });
              })(_0x114fac);
            }
          } else {
            var _0x5158d2 = {
              class: "allianceItem",
              text: "No Tribes Yet",
              parent: _0x56e409
            };
            _0x4a052b.generateElement(_0x5158d2);
          }
        }
        _0x4a052b.removeAllChildren(_0x5a36a4);
        if (_0x2c6f82.team) {
          _0x4a052b.generateElement({
            class: "allianceButtonM",
            style: "width: 360px",
            text: _0x2c6f82.isOwner ? "Delete Tribe" : "Leave Tribe",
            onclick: function () {
              _0x1a0fd5();
            },
            hookTouch: true,
            parent: _0x5a36a4
          });
        } else {
          _0x4a052b.generateElement({
            tag: "input",
            type: "text",
            id: "allianceInput",
            maxLength: 0x7,
            placeholder: "unique name",
            ontouchstart: function (_0x2cbc35) {
              _0x2cbc35.preventDefault();
              var _0x343582 = prompt("unique name", _0x2cbc35.currentTarget.value);
              _0x2cbc35.currentTarget.value = _0x343582.slice(0, 7);
            },
            parent: _0x5a36a4
          });
          _0x4a052b.generateElement({
            tag: "div",
            class: "allianceButtonM",
            style: "width: 140px;",
            text: "Create",
            onclick: function () {
              _0x94ac9c();
            },
            hookTouch: true,
            parent: _0x5a36a4
          });
        }
      }
    }
    function _0x376840(_0x212345) {
      _0x32027d.send('11', _0x22bc45[0].sid, _0x212345), _0x22bc45.splice(0, 1), _0x622f7f();
    }
    function _0x57ba04(_0x2eb0eb) {
      _0x32027d.send('12', _0x2eb0eb);
    }
    function _0x43f278(_0x17abf3) {
      _0x32027d.send('10', _0x1751ab[_0x17abf3].sid);
    }
    function _0x94ac9c() {
      _0x32027d.send('8', document.getElementById("allianceInput").value);
    }
    function _0x1a0fd5() {
      _0x22bc45 = [];
      _0x622f7f();
      _0x32027d.send('9');
    }
    var _0x160775;
    var _0x33e5a5;
    var _0xf82bf3;
    var _0x587ca7 = [];
    var _0x32a00a;
    var _0xb5543a = [];
    var _0x32a00a;
    var _0xca30d9;
    function _0x33a768() {
      this.init = function (_0x388288, _0x436063) {
        this.scale = 0, this.x = _0x388288, this.y = _0x436063, this.active = true;
      }, this.update = function (_0x504786, _0x52e010) {
        if (this.active) {
          this.scale += 0.05 * _0x52e010;
          if (this.scale >= _0x1052c8.mapPingScale) {
            this.active = false;
          } else {
            _0x504786.globalAlpha = 1 - Math.max(0, this.scale / _0x1052c8.mapPingScale);
            _0x504786.beginPath();
            _0x504786.arc(this.x / _0x1052c8.mapScale * _0x53fefd.width, this.y / _0x1052c8.mapScale * _0x53fefd.width, this.scale, 0, 2 * Math.PI);
            _0x504786.stroke();
          }
        }
      };
    }
    function _0x15d20d(_0x58bd65, _0x2f968f) {
      for (var _0x50c910 = 0; _0x50c910 < _0x587ca7.length; ++_0x50c910) {
        if (!_0x587ca7[_0x50c910].active) {
          _0x32a00a = _0x587ca7[_0x50c910];
          break;
        }
      }
      !_0x32a00a && (_0x32a00a = new _0x33a768(), _0x587ca7.push(_0x32a00a));
      _0x32a00a.init(_0x58bd65, _0x2f968f);
    }
    function _0x14b799(_0x426c63, _0x4035fb) {
      for (var _0x5e40ac = 0; _0x5e40ac < _0xb5543a.length; ++_0x5e40ac) {
        if (!_0xb5543a[_0x5e40ac].active) {
          _0xca30d9 = _0xb5543a[_0x5e40ac];
          break;
        }
      }
      if (!_0xca30d9) {
        _0xca30d9 = new _0x33a768();
        _0xb5543a.push(_0xca30d9);
      }
      _0xca30d9.init(_0x426c63, _0x4035fb);
    }
    function _0x3a1bac() {
      if (!_0xf82bf3) {
        _0xf82bf3 = {};
      }
      _0xf82bf3.x = _0x2c6f82.x;
      _0xf82bf3.y = _0x2c6f82.y;
    }
    function _0x5c813c(_0x3ee8dc) {
      _0x33e5a5 = _0x3ee8dc;
    }
    function _0x3e4886(_0x1f1c3b) {
      if (_0x2c6f82 && _0x2c6f82.alive) {
        _0x47f03a.clearRect(0, 0, _0x53fefd.width, _0x53fefd.height);
        _0x47f03a.strokeStyle = "#fff";
        _0x47f03a.lineWidth = 4;
        for (var _0x238f46 = 0; _0x238f46 < _0x587ca7.length; ++_0x238f46) {
          _0x32a00a = _0x587ca7[_0x238f46];
          _0x32a00a.update(_0x47f03a, _0x1f1c3b);
        }
        _0x47f03a.strokeStyle = "#cc5151";
        _0x47f03a.lineWidth = 4;
        for (var _0x238f46 = 0; _0x238f46 < _0xb5543a.length; ++_0x238f46) {
          _0xca30d9 = _0xb5543a[_0x238f46], _0xca30d9.update(_0x47f03a, _0x1f1c3b);
        }
        _0x47f03a.globalAlpha = 1;
        _0x47f03a.fillStyle = "#fff";
        _0x33b930(_0x2c6f82.x / _0x1052c8.mapScale * _0x53fefd.width, _0x2c6f82.y / _0x1052c8.mapScale * _0x53fefd.height, 7, _0x47f03a, true);
        _0x47f03a.fillStyle = "rgba(255,255,255,0.35)";
        if (_0x2c6f82.team && _0x33e5a5) {
          for (var _0x238f46 = 0; _0x238f46 < _0x33e5a5.length;) {
            _0x33b930(_0x33e5a5[_0x238f46] / _0x1052c8.mapScale * _0x53fefd.width, _0x33e5a5[_0x238f46 + 1] / _0x1052c8.mapScale * _0x53fefd.height, 7, _0x47f03a, true);
            _0x238f46 += 2;
          }
        }
        for (let _0x4cff8a = 0; _0x4cff8a < _0x1db1ef.length; _0x4cff8a++) {
          let _0xe77cef = _0x1db1ef[_0x4cff8a];
          if (_0xe77cef.ueheua != 0) {
            if (_0x34ff74.list[_0xe77cef[6]]) {
              _0x47f03a.fillStyle = _0x34ff74.list[_0xe77cef[6]].dmg ? "#a5974c" : _0x34ff74.list[_0xe77cef[6]].trap ? _0x5abed7 : _0x34ff74.list[_0xe77cef[6]].teleport && "#d76edb";
              _0x33b930(_0xe77cef[1] / _0x1052c8.mapScale * _0x53fefd.width, _0xe77cef[2] / _0x1052c8.mapScale * _0x53fefd.height, _0x34ff74.list[_0xe77cef[6]].scale / 10, _0x47f03a, true);
            }
          }
        }
        if (_0x160775) {
          _0x47f03a.fillStyle = "#fc5553";
          _0x47f03a.font = "34px Hammersmith One";
          _0x47f03a.textBaseline = "middle";
          _0x47f03a.textAlign = "center";
          _0x47f03a.fillText('x', _0x160775.x / _0x1052c8.mapScale * _0x53fefd.width, _0x160775.y / _0x1052c8.mapScale * _0x53fefd.height);
        }
      }
    }
    var _0x3c090d = 0;
    var _0x571a84 = {};
    function _0x1bf532(_0x4aa31e) {
      if (_0x3c090d != _0x4aa31e) {
        _0x3c090d = _0x4aa31e;
        _0x1f3a8b();
      }
    }
    function _0x3f2f2d() {
      if (_0x58dc29.style.display != "block") {
        _0x58dc29.style.display = "block";
        _0x28965f.style.display = "none";
        _0x29fd15();
        _0x1f3a8b();
      } else {
        _0x58dc29.style.display = "none";
      }
    }
    function _0x2e512a(_0x1718c8, _0x295a92, _0xa539fb) {
      if (_0xa539fb) {
        if (!_0x1718c8) {
          _0x2c6f82.tails[_0x295a92] = 1;
        } else {
          _0x2c6f82.tailIndex = _0x295a92;
        }
      } else {
        if (!_0x1718c8) {
          _0x2c6f82.skins[_0x295a92] = 1;
        } else {
          _0x2c6f82.skinIndex = _0x295a92;
        }
      }
      if (_0x58dc29.style.display == "block") {
        _0x1f3a8b();
      }
    }
    function _0x1f3a8b() {
      if (_0x2c6f82) {
        _0x4a052b.removeAllChildren(_0x235a4b);
        var _0x3b3a05 = _0x3c090d;
        var _0x22590d = _0x3b3a05 ? _0x1bbb87 : _0x2ecb5e;
        for (var _0x4123ea = 0; _0x4123ea < _0x22590d.length; ++_0x4123ea) {
          !_0x22590d[_0x4123ea].dontSell && function (_0x20a89e) {
            var _0xda6155 = _0x4a052b.generateElement({
              id: "storeDisplay" + _0x20a89e,
              class: "storeItem",
              onmouseout: function () {
                _0x4873c6();
              },
              onmouseover: function () {
                _0x4873c6(_0x22590d[_0x20a89e], false, true);
              },
              parent: _0x235a4b
            });
            _0x4a052b.hookTouchEvents(_0xda6155, true);
            _0x4a052b.generateElement({
              tag: "img",
              class: "hatPreview",
              src: "../img/" + (_0x3b3a05 ? "accessories/access_" : "hats/hat_") + _0x22590d[_0x20a89e].id + (_0x22590d[_0x20a89e].topSprite ? '_p' : '') + ".png",
              parent: _0xda6155
            });
            var _0x277f53 = {
              tag: "span",
              text: _0x22590d[_0x20a89e].name,
              parent: _0xda6155
            };
            _0x4a052b.generateElement(_0x277f53);
            if (_0x3b3a05 ? !_0x2c6f82.tails[_0x22590d[_0x20a89e].id] : !_0x2c6f82.skins[_0x22590d[_0x20a89e].id]) {
              _0x4a052b.generateElement({
                class: "joinAlBtn",
                style: "margin-top: 5px",
                text: "Buy",
                onclick: function () {
                  _0x562237(_0x22590d[_0x20a89e].id, _0x3b3a05);
                },
                hookTouch: true,
                parent: _0xda6155
              });
              var _0x52370f = {
                tag: "span",
                class: "itemPrice",
                text: _0x22590d[_0x20a89e].price,
                parent: _0xda6155
              };
              _0x4a052b.generateElement(_0x52370f);
            } else {
              (_0x3b3a05 ? _0x2c6f82.tailIndex : _0x2c6f82.skinIndex) == _0x22590d[_0x20a89e].id ? _0x4a052b.generateElement({
                class: "joinAlBtn",
                style: "margin-top: 5px",
                text: "Unequip",
                onclick: function () {
                  _0x342269(0, _0x3b3a05);
                },
                hookTouch: true,
                parent: _0xda6155
              }) : _0x4a052b.generateElement({
                class: "joinAlBtn",
                style: "margin-top: 5px",
                text: "Equip",
                onclick: function () {
                  _0x342269(_0x22590d[_0x20a89e].id, _0x3b3a05);
                },
                hookTouch: true,
                parent: _0xda6155
              });
            }
          }(_0x4123ea);
        }
      }
    }
    function _0x342269(_0x57a76e, _0xc03e71) {
      _0x32027d.send("13c", 0, _0x57a76e, _0xc03e71);
    }
    function _0x562237(_0x303bf9, _0x29b5c7) {
      _0x32027d.send("13c", 1, _0x303bf9, _0x29b5c7);
    }
    let _0x4f5bbd = [51, 50, 28, 29, 30, 36, 37, 38, 44, 35, 42, 43, 49];
    function _0x24e16f(_0x5795e7, _0x537f10, _0x560131) {
      if (_0x2c6f82.alive) {
        if (_0x537f10 == 0) {
          if (_0x2c6f82.skins[_0x5795e7]) {
            if (_0x560131) {
              if (_0x2c6f82.skinIndex != _0x5795e7) {
                _0x32027d.send("13c", 0, _0x5795e7, 0);
              }
            } else {
              _0x32027d.send("13c", 0, _0x5795e7, 0);
            }
          } else {
            if (_0x560131) {
              _0x2c6f82.skinIndex != 0 && _0x32027d.send("13c", 0, 0, 0);
            } else {
              _0x32027d.send("13c", 0, 50, 0);
            }
            _0x32027d.send("13c", 1, _0x5795e7, 0);
          }
        } else {
          if (_0x537f10 == 1) {
            if (_0x2c6f82.tails[_0x5795e7]) {
              if (_0x560131) {
                _0x2c6f82.tailIndex != _0x5795e7 && _0x32027d.send("13c", 0, _0x5795e7, 1);
              } else {
                _0x32027d.send("13c", 0, _0x5795e7, 1);
              }
            } else {
              if (_0x560131) {
                if (_0x2c6f82.tailIndex != 0) {
                  _0x32027d.send("13c", 0, 0, 1);
                }
              } else {
                _0x32027d.send("13c", 0, 0, 1);
              }
              _0x32027d.send("13c", 1, _0x5795e7, 1);
            }
          }
        }
      }
    }
    function _0x3d13ae() {
      _0x32027d.send("13c", 0, 0, 0);
    }
    function _0x3cfa15() {
      _0x32027d.send("13c", 0, 0, 1);
    }
    function _0x59e69a() {
      _0x58dc29.style.display = "none";
      _0x28965f.style.display = "none";
      _0x29fd15();
    }
    function _0x22c606() {
      var _0x79c2de = _0x5cd5b4("native_resolution");
      if (!_0x79c2de) {
        _0x543493(typeof cordova !== "undefined");
      } else {
        _0x543493(_0x79c2de == "true");
      }
      _0x14cfa4 = _0x5cd5b4("show_ping") == "true";
      _0x7e01b4.hidden = !_0x14cfa4;
      _0xa3a065 = _0x5cd5b4("moo_moosic") || 0;
      setInterval(function () {
        if (window.cordova) {
          document.getElementById("downloadButtonContainer").classList.add("cordova");
          document.getElementById("mobileDownloadButtonContainer").classList.add("cordova");
        }
      }, 1000);
      _0xa0095a();
      _0x4a052b.removeAllChildren(_0x4b4042);
      for (var _0xc7df07 = 0; _0xc7df07 < _0x34ff74.weapons.length + _0x34ff74.list.length; ++_0xc7df07) {
        (function (_0x31a345) {
          _0x4a052b.generateElement({
            id: "actionBarItem" + _0x31a345,
            class: "actionBarItem",
            style: "display:none",
            onmouseout: function () {
              _0x4873c6();
            },
            parent: _0x4b4042
          });
        })(_0xc7df07);
      }
      for (var _0xc7df07 = 0; _0xc7df07 < _0x34ff74.list.length + _0x34ff74.weapons.length; ++_0xc7df07) {
        (function (_0x3e4c23) {
          var _0x335158 = document.createElement("canvas");
          _0x335158.width = _0x335158.height = 66;
          var _0x31ce2d = _0x335158.getContext('2d');
          _0x31ce2d.translate(_0x335158.width / 2, _0x335158.height / 2);
          _0x31ce2d.imageSmoothingEnabled = false;
          _0x31ce2d.webkitImageSmoothingEnabled = false;
          _0x31ce2d.mozImageSmoothingEnabled = false;
          if (_0x34ff74.weapons[_0x3e4c23]) {
            _0x31ce2d.rotate(Math.PI / 4 + Math.PI);
            var _0x27a21a = new Image();
            _0x1b307c[_0x34ff74.weapons[_0x3e4c23].src] = _0x27a21a;
            _0x27a21a.onload = function () {
              this.isLoaded = true;
              var _0x188940 = 1 / (this.height / this.width);
              var _0x3f609c = _0x34ff74.weapons[_0x3e4c23].iPad || 1;
              _0x31ce2d.drawImage(this, -(_0x335158.width * _0x3f609c * _0x1052c8.iconPad * _0x188940) / 2, -(_0x335158.height * _0x3f609c * _0x1052c8.iconPad) / 2, _0x335158.width * _0x3f609c * _0x188940 * _0x1052c8.iconPad, _0x335158.height * _0x3f609c * _0x1052c8.iconPad);
              _0x31ce2d.fillStyle = "rgba(0, 0, 70, 0.1)";
              _0x31ce2d.globalCompositeOperation = "source-atop";
              _0x31ce2d.fillRect(-_0x335158.width / 2, -_0x335158.height / 2, _0x335158.width, _0x335158.height);
              document.getElementById("actionBarItem" + _0x3e4c23).style.backgroundImage = "url(" + _0x335158.toDataURL() + ')';
            };
            _0x27a21a.src = ".././img/weapons/" + _0x34ff74.weapons[_0x3e4c23].src + ".png";
            var _0x4a3942 = document.getElementById("actionBarItem" + _0x3e4c23);
            _0x4a3942.onmouseover = _0x4a052b.checkTrusted(function () {
              _0x4873c6(_0x34ff74.weapons[_0x3e4c23], true);
            });
            _0x4a3942.onclick = _0x4a052b.checkTrusted(function () {
              _0x389917(_0x3e4c23, true);
            });
            _0x4a052b.hookTouchEvents(_0x4a3942);
          } else {
            var _0x27a21a = _0xeb974d(_0x34ff74.list[_0x3e4c23 - _0x34ff74.weapons.length], true);
            var _0x20d47d = Math.min(_0x335158.width - _0x1052c8.iconPadding, _0x27a21a.width);
            _0x31ce2d.globalAlpha = 1;
            _0x31ce2d.drawImage(_0x27a21a, -_0x20d47d / 2, -_0x20d47d / 2, _0x20d47d, _0x20d47d);
            _0x31ce2d.fillStyle = "rgba(0, 0, 70, 0.1)";
            _0x31ce2d.globalCompositeOperation = "source-atop";
            _0x31ce2d.fillRect(-_0x20d47d / 2, -_0x20d47d / 2, _0x20d47d, _0x20d47d);
            document.getElementById("actionBarItem" + _0x3e4c23).style.backgroundImage = "url(" + _0x335158.toDataURL() + ')';
            var _0x4a3942 = document.getElementById("actionBarItem" + _0x3e4c23);
            _0x4a3942.onmouseover = _0x4a052b.checkTrusted(function () {
              _0x4873c6(_0x34ff74.list[_0x3e4c23 - _0x34ff74.weapons.length]);
            });
            _0x4a3942.onclick = _0x4a052b.checkTrusted(function () {
              _0x389917(_0x3e4c23 - _0x34ff74.weapons.length);
            });
            _0x4a052b.hookTouchEvents(_0x4a3942);
          }
        })(_0xc7df07);
      }
      _0xfea98f.ontouchstart = _0x4a052b.checkTrusted(function (_0x26b704) {
        _0x26b704.preventDefault();
        var _0x992817 = prompt("enter name", _0x26b704.currentTarget.value);
        _0x26b704.currentTarget.value = _0x992817.slice(0, 15);
      });
      _0x3e7877.checked = _0x37ed13;
      _0x3e7877.onchange = _0x4a052b.checkTrusted(function (_0x3ef133) {
        _0x543493(_0x3ef133.target.checked);
      });
      _0x564521.checked = _0x14cfa4;
      _0x564521.onchange = _0x4a052b.checkTrusted(function (_0x1c4d0f) {
        _0x14cfa4 = _0x564521.checked, _0x7e01b4.hidden = !_0x14cfa4, _0x5a4e2c("show_ping", _0x14cfa4 ? "true" : "false");
      });
    }
    function _0xe32733(_0x7f7950, _0x319014) {
      if (_0x7f7950) {
        if (_0x319014) {
          _0x2c6f82.weapons = _0x7f7950;
        } else {
          _0x2c6f82.items = _0x7f7950;
        }
      }
      for (var _0x15a581 = 0; _0x15a581 < _0x34ff74.list.length; ++_0x15a581) {
        var _0x2b71b = _0x34ff74.weapons.length + _0x15a581;
        document.getElementById("actionBarItem" + _0x2b71b).style.display = _0x2c6f82.items.indexOf(_0x34ff74.list[_0x15a581].id) >= 0 ? "inline-block" : "none";
      }
      for (var _0x15a581 = 0; _0x15a581 < _0x34ff74.weapons.length; ++_0x15a581) {
        document.getElementById("actionBarItem" + _0x15a581).style.display = _0x2c6f82.weapons[_0x34ff74.weapons[_0x15a581].type] == _0x34ff74.weapons[_0x15a581].id ? "inline-block" : "none";
      }
    }
    function _0x543493(_0x45aadf) {
      _0x37ed13 = _0x45aadf;
      _0x5dab85 = _0x45aadf ? window.devicePixelRatio || 1 : 1;
      _0x3e7877.checked = _0x45aadf;
      _0x5a4e2c("native_resolution", _0x45aadf.toString());
      _0x585517();
    }
    function _0xd79429() {
      if (_0x16ea19) {
        _0x626a64.classList.add("touch");
      } else {
        _0x626a64.classList.remove("touch");
      }
    }
    function _0x5c1a9d() {
      if (_0x626a64.classList.contains("showing")) {
        _0x626a64.classList.remove("showing");
        _0x4ad253.innerText = "Settings";
      } else {
        _0x626a64.classList.add("showing"), _0x4ad253.innerText = "Close";
      }
    }
    let _0x3c79a1 = 0;
    function _0xa0095a() {
      var _0x3c4ca2 = '';
      for (var _0x2ab73a = 0; _0x2ab73a < _0x1052c8.skinColors.length; ++_0x2ab73a) {
        if (_0x2ab73a == _0x3c79a1) {
          _0x3c4ca2 += "<div class='skinColorItem activeSkin' style='background-color:" + _0x1052c8.skinColors[_0x2ab73a] + "' onclick='selectSkinColor(" + _0x2ab73a + ")'></div>";
        } else {
          _0x3c4ca2 += "<div class='skinColorItem' style='background-color:" + _0x1052c8.skinColors[_0x2ab73a] + "' onclick='selectSkinColor(" + _0x2ab73a + ")'></div>";
        }
      }
      _0x1f4507.innerHTML = _0x3c4ca2;
    }
    function _0x3993a2(_0x247ec5) {
      _0x3c79a1 = _0x247ec5;
      _0x43337d = _0x247ec5 == 10 ? "constructor" : _0x247ec5;
      _0xa0095a();
    }
    var _0x115bda = document.getElementById("chatBox");
    var _0x4afc7c = document.getElementById("chatHolder");
    function _0x481f7d() {
      if (!_0x16ea19) {
        if (_0x4afc7c.style.display == "block") {
          _0x115bda.value && _0x385069(_0x115bda.value);
          _0x29fd15();
        } else {
          _0x58dc29.style.display = "none";
          _0x28965f.style.display = "none";
          _0x4afc7c.style.display = "block";
          _0x115bda.focus();
          _0x5d09e9();
        }
      } else {
        setTimeout(function () {
          var _0x43c3a6 = prompt("chat message");
          _0x43c3a6 && _0x385069(_0x43c3a6);
        }, 1);
      }
      _0x115bda.value = '';
    }
    function _0x385069(_0x21e68a) {
      let _0x22ddc5 = function (_0x2969d3) {
        return _0x21e68a == '!!' + _0x2969d3;
      };
      let _0x36ab8f = _0x21e68a;
      if (_0x22ddc5("dir")) {
        _0x539477 = !_0x539477, _0x36fb77(500, _0x539477);
      } else {
        if (_0x22ddc5("bull")) {
          _0x2df32f = !_0x2df32f;
          _0x36fb77(500, _0x2df32f);
        } else {
          if (_0x22ddc5("spin")) {
            _0x2c821 = !_0x2c821, _0x36fb77(500, _0x2c821);
          } else {
            if (_0x21e68a == "!!speed " + _0x21e68a.slice(8)) {
              _0x64689a = Math.PI / Math.max(1, _0x21e68a.slice(8)), _0x40c2fb.showText(_0x2c6f82.x, _0x2c6f82.y, 50, 0.18, 500, "Spinspeed " + Math.max(1, _0x21e68a.slice(8)), "#8ecc51");
            } else {
              if (_0x22ddc5("join")) {
                botConfig.stop = !botConfig.stop, _0x36fb77(500, botConfig.stop);
              } else {
                if (_0x22ddc5("atck")) {
                  botConfig.atck = !botConfig.atck;
                  _0x36fb77(500, botConfig.atck);
                } else {
                  if (_0x22ddc5("antikik")) {
                    antiKick = !antiKick;
                    _0x36fb77(500, antiKick);
                  } else {
                    if (_0x22ddc5("combat")) {
                      _0x33d522 = !_0x33d522;
                      _0x36fb77(500, _0x33d522);
                    } else {
                      if (_0x22ddc5("heals")) {
                        _0x561a2e = !_0x561a2e;
                        _0x36fb77(500, _0x561a2e);
                      } else {
                        if (_0x22ddc5("grind")) {
                          _0x1ec4b2 = !_0x1ec4b2, _0x36fb77(500, _0x1ec4b2);
                        } else {
                          if (_0x22ddc5("change")) {
                            _0xb767d2 = !_0xb767d2, _0x36fb77(500, _0xb767d2);
                          } else {
                            if (_0x21e68a == "!!set " + _0x21e68a.slice(6)) {
                              _0x49ed08 = _0x21e68a.slice(6);
                              _0x40c2fb.showText(_0x2c6f82.x, _0x2c6f82.y, 50, 0.18, 500, "Set To " + _0x49ed08, "#8ecc51");
                            } else {
                              if (_0x21e68a == "!!test " + _0x21e68a.slice(7)) {
                                _0x40c2fb.showText(_0x2c6f82.x, _0x2c6f82.y, 50, 0.18, 500, _0x21e68a.slice(7), "#8ecc51");
                              } else {
                                if (_0x22ddc5("texture")) {
                                  _0x4ffa9 = !_0x4ffa9;
                                  _0x36fb77(500, _0x4ffa9);
                                } else {
                                  _0x32027d.send('ch', _0x21e68a.slice(0, 30));
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    function _0x29fd15() {
      _0x115bda.value = '', _0x4afc7c.style.display = "none";
    }
    var _0x4a61aa = ["cunt", "whore", "fuck", "shit", "faggot", "nigger", "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex", "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune", "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard"];
    function _0xa73957(_0x277856) {
      var _0x4210f5;
      for (var _0x4863fa = 0; _0x4863fa < _0x4a61aa.length; ++_0x4863fa) {
        if (_0x277856.indexOf(_0x4a61aa[_0x4863fa]) > -1) {
          _0x4210f5 = '';
          for (var _0x1cb176 = 0; _0x1cb176 < _0x4a61aa[_0x4863fa].length; ++_0x1cb176) {
            _0x4210f5 += _0x4210f5.length ? 'o' : 'M';
          }
          var _0x1bc9e7 = new RegExp(_0x4a61aa[_0x4863fa], 'g');
          _0x277856 = _0x277856.replace(_0x1bc9e7, _0x4210f5);
        }
      }
      return _0x277856;
    }
    function _0x477922(_0x4f1b46, _0x2ad3df) {
      var _0x1754f4 = _0x54663(_0x4f1b46);
      if (_0x1754f4) {
        _0x1754f4.chatMessage = _0xa73957(_0x2ad3df);
        _0x1754f4.chatCountdown = _0x1052c8.chatCountdown;
      }
    }
    window.addEventListener("resize", _0x4a052b.checkTrusted(_0x585517));
    function _0x585517() {
      _0x58f14f = window.innerWidth;
      _0x7ed5da = window.innerHeight;
      var _0x1ad001 = Math.max(_0x58f14f / _0xfa8e22, _0x7ed5da / _0x207741) * _0x5dab85;
      _0x44932d.width = _0x58f14f * _0x5dab85;
      _0x44932d.height = _0x7ed5da * _0x5dab85;
      _0x44932d.style.width = _0x58f14f + 'px';
      _0x44932d.style.height = _0x7ed5da + 'px';
      _0xce3328.setTransform(_0x1ad001, 0, 0, _0x1ad001, (_0x58f14f * _0x5dab85 - _0xfa8e22 * _0x1ad001) / 2, (_0x7ed5da * _0x5dab85 - _0x207741 * _0x1ad001) / 2);
    }
    _0x585517();
    var _0x16ea19;
    _0x57c4a3(false);
    function _0x57c4a3(_0x58cdbc) {
      _0x16ea19 = _0x58cdbc;
      _0xd79429();
    }
    window.setUsingTouch = _0x57c4a3;
    _0x44932d.addEventListener("touchmove", _0x4a052b.checkTrusted(_0x538ed2), false);
    function _0x538ed2(_0x56fea7) {
      _0x56fea7.preventDefault();
      _0x56fea7.stopPropagation();
      _0x57c4a3(true);
      for (var _0x16e063 = 0; _0x16e063 < _0x56fea7.changedTouches.length; _0x16e063++) {
        var _0x5358f5 = _0x56fea7.changedTouches[_0x16e063];
        if (_0x5358f5.identifier == _0x59c5a6.id) {
          _0x59c5a6.currentX = _0x5358f5.pageX;
          _0x59c5a6.currentY = _0x5358f5.pageY;
          _0x4540d5();
        } else {
          if (_0x5358f5.identifier == _0x3433b6.id) {
            _0x3433b6.currentX = _0x5358f5.pageX;
            _0x3433b6.currentY = _0x5358f5.pageY;
            _0x42b0d6 = 1;
          }
        }
      }
    }
    _0x44932d.addEventListener("touchstart", _0x4a052b.checkTrusted(_0x4691b6), false);
    function _0x4691b6(_0x385173) {
      _0x385173.preventDefault();
      _0x385173.stopPropagation();
      _0x57c4a3(true);
      for (var _0x13cc43 = 0; _0x13cc43 < _0x385173.changedTouches.length; _0x13cc43++) {
        var _0x284b1d = _0x385173.changedTouches[_0x13cc43];
        if (_0x284b1d.pageX < document.body.scrollWidth / 2 && _0x59c5a6.id == -1) {
          _0x59c5a6.id = _0x284b1d.identifier;
          _0x59c5a6.startX = _0x59c5a6.currentX = _0x284b1d.pageX;
          _0x59c5a6.startY = _0x59c5a6.currentY = _0x284b1d.pageY;
          _0x4540d5();
        } else {
          if (_0x284b1d.pageX > document.body.scrollWidth / 2 && _0x3433b6.id == -1) {
            _0x3433b6.id = _0x284b1d.identifier;
            _0x3433b6.startX = _0x3433b6.currentX = _0x284b1d.pageX;
            _0x3433b6.startY = _0x3433b6.currentY = _0x284b1d.pageY;
            if (_0x2c6f82.buildIndex < 0) {
              _0x42b0d6 = 1;
              _0x11a60a();
            }
          }
        }
      }
    }
    _0x44932d.addEventListener("touchend", _0x4a052b.checkTrusted(_0x27da62), false);
    _0x44932d.addEventListener("touchcancel", _0x4a052b.checkTrusted(_0x27da62), false);
    _0x44932d.addEventListener("touchleave", _0x4a052b.checkTrusted(_0x27da62), false);
    function _0x27da62(_0x2e4571) {
      _0x2e4571.preventDefault();
      _0x2e4571.stopPropagation();
      _0x57c4a3(true);
      for (var _0x4869b6 = 0; _0x4869b6 < _0x2e4571.changedTouches.length; _0x4869b6++) {
        var _0x569e2d = _0x2e4571.changedTouches[_0x4869b6];
        if (_0x569e2d.identifier == _0x59c5a6.id) {
          _0x59c5a6.id = -1;
          _0x4540d5();
        } else {
          if (_0x569e2d.identifier == _0x3433b6.id) {
            _0x3433b6.id = -1;
            if (_0x2c6f82.buildIndex >= 0) {
              _0x42b0d6 = 1;
              _0x11a60a();
            }
            _0x42b0d6 = 0;
            _0x11a60a();
          }
        }
      }
    }
    _0x44932d.addEventListener("mousemove", _0x253382, false);
    function _0x253382(_0x32b496) {
      _0x32b496.preventDefault();
      _0x32b496.stopPropagation();
      _0x57c4a3(false);
      _0x3c100f = _0x32b496.clientX;
      _0x508ec3 = _0x32b496.clientY;
    }
    _0x44932d.addEventListener("mousedown", _0x3be2a0, false);
    var _0x51ce99 = false;
    var _0x148bf1 = false;
    var _0x5488f9 = false;
    function _0x3be2a0(_0x1ecab4) {
      _0x57c4a3(false);
      if (_0x42b0d6 != 1) {
        _0x42b0d6 = 1;
        _0x11a60a();
        if (_0x1ecab4.button == 0) {
          _0x148bf1 = true;
        } else {
          if (_0x1ecab4.button == 2) {
            _0x5488f9 = true;
          }
        }
        _0x51ce99 = true;
      }
    }
    _0x44932d.addEventListener("mouseup", _0x471a5e, false);
    function _0x471a5e(_0x150643) {
      _0x57c4a3(false);
      if (_0x42b0d6 != 0) {
        _0x42b0d6 = 0;
        _0x11a60a();
        if (_0x150643.button == 0) {
          _0x148bf1 = false;
        } else {
          _0x150643.button == 2 && (_0x5488f9 = false);
        }
        if (!_0x148bf1 && !_0x5488f9) {
          _0x51ce99 = false;
        }
      }
    }
    var _0x937041 = false;
    function _0x10e592(_0x10c0f9) {
      if (_0x10c0f9.deltaY < 0) {
        _0x937041 = true;
        _0x24e16f(7, 0);
      } else {
        _0x937041 = false;
        _0x24e16f(6, 0);
      }
    }
    ;
    _0x44932d.addEventListener("wheel", _0x10e592, false);
    function _0x2c7e97() {
      var _0x1773a2 = 0;
      var _0x4f7a3a = 0;
      if (_0x59c5a6.id != -1) {
        _0x1773a2 += _0x59c5a6.currentX - _0x59c5a6.startX;
        _0x4f7a3a += _0x59c5a6.currentY - _0x59c5a6.startY;
      } else {
        for (var _0x3ad74b in _0x510a17) {
          var _0x1a3b4f = _0x510a17[_0x3ad74b];
          _0x1773a2 += !!_0x835d48[_0x3ad74b] * _0x1a3b4f[0];
          _0x4f7a3a += !!_0x835d48[_0x3ad74b] * _0x1a3b4f[1];
        }
      }
      return _0x1773a2 == 0 && _0x4f7a3a == 0 ? undefined : _0x4a052b.fixTo(Math.atan2(_0x4f7a3a, _0x1773a2), 2);
    }
    var _0x37d6ab;
    var _0x2b0fae = null;
    function _0x2541d9() {
      if (!_0x2c6f82) {
        return 0;
      }
      if (_0x2e7a61 || _0x314e30) {
        return _0x11b3cf;
      } else {
        if (!_0x2e7a61 && _0x33b253 && (_0x1cfd78 ? _0x2c6f82.sR : _0x2c6f82.pR) == 1) {
          return _0x5e40db;
        } else {
          if (_0x3433b6.id != -1) {
            _0x37d6ab = Math.atan2(_0x3433b6.currentY - _0x3433b6.startY, _0x3433b6.currentX - _0x3433b6.startX);
          } else {
            !_0x2c6f82.lockDir && !_0x16ea19 && (_0x37d6ab = Math.atan2(_0x508ec3 - _0x7ed5da / 2, _0x3c100f - _0x58f14f / 2));
          }
          return _0x4a052b.fixTo(_0x37d6ab || 0, 2);
        }
      }
    }
    function _0x1bbdc3() {
      if (!_0x2c6f82) {
        return 0;
      }
      if (_0x3433b6.id != -1) {
        _0x37d6ab = Math.atan2(_0x3433b6.currentY - _0x3433b6.startY, _0x3433b6.currentX - _0x3433b6.startX);
      } else {
        if (!_0x2c6f82.lockDir && !_0x16ea19) {
          _0x37d6ab = Math.atan2(_0x508ec3 - _0x7ed5da / 2, _0x3c100f - _0x58f14f / 2);
        }
      }
      return _0x4a052b.fixTo(_0x37d6ab || 0, 2);
    }
    var _0x29c0aa = undefined;
    var _0x5bb3b5 = 0;
    var _0x2c821 = false;
    var _0x64689a = Math.PI / 6;
    function _0x368167() {
      if (!_0x2c6f82) {
        return 0;
      }
      if (_0x2e7a61 || _0x314e30 && _0x2c6f82.pR == 1) {
        return _0x11b3cf;
      } else {
        if (!_0x2e7a61 && _0x33b253 && (_0x1cfd78 ? _0x2c6f82.sR : _0x2c6f82.pR) == 1) {
          return _0x5e40db;
        } else {
          if (_0x51ce99 && !_0x33b253 && (_0x1cfd78 && _0x5488f9 ? _0x2c6f82.sR : _0x2c6f82.pR) == 1) {
            return _0x2c6f82.dir;
          } else {
            if (_0x2c821) {
              return _0x24a5b4;
            } else {
              if (_0x3433b6.id != -1) {
                _0x37d6ab = Math.atan2(_0x3433b6.currentY - _0x3433b6.startY, _0x3433b6.currentX - _0x3433b6.startX);
              } else {
                if (!_0x2c6f82.lockDir && !_0x16ea19) {
                  _0x37d6ab = Math.atan2(_0x508ec3 - _0x7ed5da / 2, _0x3c100f - _0x58f14f / 2);
                }
              }
              return _0x4a052b.fixTo(_0x37d6ab || 0, 2);
            }
          }
        }
      }
    }
    var _0x835d48 = {};
    var _0xbb0cee = {
      '87': [0, -1],
      '38': [0, -1],
      '83': [0, 1],
      '40': [0, 1],
      '65': [-1, 0],
      '37': [-1, 0],
      '68': [1, 0],
      '39': [1, 0]
    };
    var _0x510a17 = _0xbb0cee;
    function _0x5d09e9() {
      _0x835d48 = {}, _0x32027d.send("rmd");
    }
    function _0x1a146a() {
      return _0x28965f.style.display != "block" && _0x4afc7c.style.display != "block";
    }
    var _0x369177 = false;
    var _0x342608 = false;
    var _0x32bd58 = false;
    var _0x5a5613 = false;
    function _0x5859ad(_0x4db2db) {
      var _0x42a527 = _0x4db2db.which || _0x4db2db.keyCode || 0;
      if (_0x42a527 == 27) {
        _0x59e69a();
      } else {
        if (_0x2c6f82 && _0x2c6f82.alive && _0x1a146a()) {
          if (!_0x835d48[_0x42a527]) {
            _0x835d48[_0x42a527] = 1;
            if (_0x42a527 == 69) {
              _0xd86a8();
            } else {
              if (_0x42a527 == 67) {
                _0x3a1bac();
              } else {
                if (_0x42a527 == 77) {
                  _0x6ca58e = !_0x6ca58e;
                } else {
                  if (_0x42a527 == 88) {
                    _0x1256bd();
                  } else {
                    if (_0x2c6f82.weapons[_0x42a527 - 49] != undefined) {
                      _0x499306 = _0x2c6f82.weapons[_0x42a527 - 49];
                      _0x389917(_0x2c6f82.weapons[_0x42a527 - 49], true);
                    } else {
                      if (_0x2c6f82.items[_0x42a527 - 49 - _0x2c6f82.weapons.length] != undefined) {
                        _0x389917(_0x2c6f82.items[_0x42a527 - 49 - _0x2c6f82.weapons.length]);
                      } else {
                        if (_0x42a527 == 82) {
                          _0x29436e = !_0x29436e;
                          _0x4a0b64();
                        } else {
                          if (_0x510a17[_0x42a527]) {
                            _0x4540d5();
                          } else {
                            if (_0x42a527 == 32) {
                              _0x42b0d6 = 1, _0x11a60a();
                            } else {
                              if (_0x4db2db.key == 'q') {
                                _0x27f535(0, _0x2541d9()), _0x369177 = true;
                              } else {
                                if (_0x4db2db.key == 'f') {
                                  _0x342608 = true;
                                } else {
                                  if (_0x4db2db.key == 'v') {
                                    _0x32bd58 = true;
                                  } else {
                                    if (_0x4db2db.key == 'h') {
                                      _0x5a5613 = true;
                                    } else {
                                      if (_0x4db2db.key == 'B') {
                                        _0x405841 = !_0x405841;
                                        _0x49ed08 = _0x2c6f82.tailIndex <= 0 ? 0 : _0x2c6f82.tailIndex;
                                        _0x40c2fb.showText(_0x2c6f82.x, _0x2c6f82.y, 50, 0.18, 500, _0x2c6f82.tailIndex <= 0 ? "Set To Unequip" : "Set To " + _0x49ed08, "#8ecc51");
                                      } else {
                                        if (_0x4db2db.key == 'G') {
                                          for (let _0x35f6ee = 0; _0x35f6ee < bot; _0x35f6ee++) {
                                            if (_0x22dbbf && tmpAddress) {
                                              window.grecaptcha.execute("6LevKusUAAAAAAFknhlV8sPtXAk5Z5dGP5T2FYIZ", {
                                                action: "homepage"
                                              }).then(function (_0x1107cc) {
                                                bConnect(_0x1107cc, _0x35f6ee, "test");
                                              });
                                            } else {
                                              bConnect(null, _0x35f6ee, "test");
                                            }
                                          }
                                          bot = 4;
                                        } else {
                                          _0x4db2db.key == 'L' && console.log(_0x4b4042);
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    window.addEventListener("keydown", _0x4a052b.checkTrusted(_0x5859ad));
    function _0xe92755(_0x13e802) {
      if (_0x2c6f82 && _0x2c6f82.alive) {
        var _0x27c422 = _0x13e802.which || _0x13e802.keyCode || 0;
        if (_0x27c422 == 13) {
          _0x481f7d();
        } else {
          if (_0x1a146a()) {
            if (_0x835d48[_0x27c422]) {
              _0x835d48[_0x27c422] = 0;
              if (_0x510a17[_0x27c422]) {
                _0x4540d5();
              } else {
                if (_0x27c422 == 32) {
                  _0x42b0d6 = 0, _0x11a60a();
                } else {
                  if (_0x13e802.key == 'q') {
                    _0x369177 = false;
                  } else {
                    if (_0x13e802.key == 'f') {
                      _0x342608 = false;
                    } else {
                      if (_0x13e802.key == 'v') {
                        _0x32bd58 = false;
                      } else {
                        if (_0x13e802.key == 'h') {
                          _0x5a5613 = false;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    window.addEventListener("keyup", _0x4a052b.checkTrusted(_0xe92755));
    function _0x11a60a() {
      if (_0x2c6f82 && _0x2c6f82.alive) {
        _0x32027d.send('c', _0x42b0d6, _0x2c6f82.buildIndex >= 0 ? _0x2541d9() : null);
      }
    }
    var _0x3892e2 = undefined;
    var _0x32ee81 = undefined;
    function _0x4540d5() {
      var _0x2897fc = _0x2c7e97();
      (_0x3892e2 == undefined || _0x2897fc == undefined || Math.abs(_0x2897fc - _0x3892e2) > 0.3) && (_0x32027d.send('33', _0x2897fc), _0x3892e2 = _0x2897fc, _0x32ee81 = _0x2897fc);
    }
    function _0x1256bd() {
      _0x2c6f82.lockDir = _0x2c6f82.lockDir ? 0 : 1, _0x32027d.send('7', 0);
    }
    function _0x4a0b64() {
      _0x32027d.send('14', 1);
    }
    function _0xd86a8() {
      _0x32027d.send('7', 1);
    }
    function _0x389917(_0x3a5c1d, _0x48463a) {
      _0x32027d.send('5', _0x3a5c1d, _0x48463a);
    }
    function _0x49a9df() {
      _0x5a4e2c("moo_name", _0xfea98f.value);
      if (!_0x1a6b21 && _0x1c7600()) {
        _0x1d4af5 = 0;
        _0x1a6b21 = true;
        _0x149fcb.stop("menu");
        _0x4648d4("Loading...");
        var _0x1d6f52 = {
          name: _0xfea98f.value,
          moofoll: _0x2a7dfd,
          skin: _0x43337d
        };
        _0x32027d.send('sp', _0x1d6f52);
        let _0x5ba94f = document.getElementById("ot-sdk-btn-floating");
        _0x5ba94f && (_0x5ba94f.style.display = "none");
      }
    }
    var _0x58bfa8 = true;
    function _0x43a10c(_0x2a30ff) {
      _0x2f3f09.style.display = "none", _0x2996d0.style.display = "block", _0xc915d.style.display = "none", _0x835d48 = {}, _0x4d4c14 = _0x2a30ff, _0x42b0d6 = 0, _0x1a6b21 = true, _0x58bfa8 && (_0x58bfa8 = false, _0x4a45e9.length = 0);
    }
    function _0x56be14(_0x7b5db0, _0x446c00, _0x56e24a, _0x52fc93) {
      _0x40c2fb.showText(_0x7b5db0, _0x446c00, 50, 0.18, 500, Math.abs(_0x56e24a), _0x56e24a >= 0 ? "#fff" : "#8ecc51");
    }
    function _0x36fb77(_0x119092, _0x46b541) {
      _0x40c2fb.showText(_0x2c6f82.x, _0x2c6f82.y, _0x2c6f82.scale, 0.1, _0x119092, _0x46b541 ? "Enabled" : "Disabled", _0x46b541 ? "#fff" : "#cc5151");
    }
    function _0x3f12bb(_0x245258, _0x3ca1e0, _0x5f2854, _0x49d977, _0x42252b, _0x2a4681) {
      _0x40c2fb.showText(_0x245258.x, _0x245258.y, _0x3ca1e0, _0x5f2854, _0x49d977, _0x42252b, _0x2a4681);
    }
    var _0x973f1b = 99999;
    function _0x201b39() {
      _0x1a6b21 = false;
      try {
        factorem.refreshAds([2], true);
      } catch (_0x5a57e7) {}
      ;
      _0x5a888a.style.display = "none";
      _0x59e69a();
      var _0x57686e = {
        x: _0x2c6f82.x,
        y: _0x2c6f82.y
      };
      _0x160775 = _0x57686e;
      _0x2f3f09.style.display = "none";
      _0x46ad7d.style.display = "block";
      _0x46ad7d.style.fontSize = "0px";
      _0x973f1b = 0;
      setTimeout(function () {
        _0x2996d0.style.display = "block";
        _0xc915d.style.display = "block";
        _0x46ad7d.style.display = "none";
      }, _0x1052c8.deathFadeout);
      _0x5a61d9();
    }
    function _0x179200(_0xb79a38) {
      if (_0x2c6f82) {
        _0x1a4d70.removeAllItems(_0xb79a38);
      }
    }
    var _0x22f4d8 = false;
    var _0x1b01df = false;
    var _0x1ec4b2 = false;
    function _0x4ed211(_0x1147a7) {
      let _0x252882 = _0x5d58c5(_0x1147a7);
      let _0x1a2122 = Math.atan2(_0x252882.y - _0x2c6f82.y2, _0x252882.x - _0x2c6f82.x2);
      let _0x40c8a8 = Math.hypot(_0x252882.y - _0x2c6f82.y2, _0x252882.x - _0x2c6f82.x2);
      if (_0x2c6f82.alive) {
        if (_0x1ec4b2) {
          if (_0x40c8a8 <= 135) {
            _0x27f535(_0x2c6f82.items[5] ? 5 : 1, Math.atan2(_0x252882.y - _0x2c6f82.y2, _0x252882.x - _0x2c6f82.x2));
            _0x32027d.send('2', _0x1bbdc3());
          }
        } else {
          if (_0x5e1af5.length && _0x40c8a8 <= 486) {
            if (_0x40c8a8 <= 200 && _0x1ad2a2(_0xb04feb, _0x2c6f82) <= 180 && !_0x51ce99 && !_0x33b253 && !_0x22f4d8 && _0x2c6f82.pR == 1) {
              _0x27f535(2, _0x1a2122);
              _0x1b01df = true;
            } else {
              if (_0x1ad2a2(_0xb04feb, _0x2c6f82) <= 250) {
                let _0xa96043 = -1;
                for (let _0x256ad4 = -90; _0x256ad4 < 180; _0x256ad4 += 90) {
                  _0xa96043++;
                  _0x29c0aa = _0x35ab04(_0x256ad4);
                  if (_0xa96043 == 1 && _0x40c8a8 <= 200) {
                    _0x27f535(2, _0x1a2122);
                  } else {
                    _0x59f82f(2, _0x1a2122 + _0x35ab04(_0x256ad4));
                  }
                }
              } else {
                if (_0x1ad2a2(_0xb04feb, _0x2c6f82) > 250 && _0x1ad2a2(_0xb04feb, _0x2c6f82) < 500) {
                  let _0x1339cd = -1;
                  for (let _0x5a6cd2 = 0; _0x5a6cd2 < Math.PI * 2; _0x5a6cd2 += Math.PI / 2) {
                    if (_0x2c6f82.items[4] == 15) {
                      _0x1339cd++;
                      _0x29c0aa = _0x35ab04(_0x5a6cd2);
                      if (_0x1339cd == 0 && _0x40c8a8 <= 200) {
                        _0x27f535(4, _0x1a2122);
                      } else {
                        _0x59f82f(4, _0x1a2122 + _0x5a6cd2);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      _0x4f6d8c(_0x252882, _0x2c6f82) > 1200 && _0x14b799(_0x252882.x, _0x252882.y);
      _0x1db1ef.forEach(_0x2a04ce => {
        _0x2a04ce[0] == _0x1147a7 && (_0x2a04ce.ueheua = 0);
      });
      _0x1a4d70.disableBySid(_0x1147a7);
    }
    var _0x5cbf93 = false;
    function _0x54bba1() {
      let _0x5028ab = [];
      if (_0x2c6f82.y2 >= _0x1052c8.mapScale / 2 - _0x1052c8.riverWidth / 2 && _0x2c6f82.y2 <= _0x1052c8.mapScale / 2 + _0x1052c8.riverWidth / 2) {
        if (_0x2c6f82.items[5] == 18 && _0x32ee81 != undefined) {
          _0x59f82f(5, _0x32ee81);
        }
      } else {
        if (_0x4a45e9.length && _0x5e1af5.length) {
          var _0x46d0c7 = {
            x: _0xb04feb.x2,
            y: _0xb04feb.y2,
            inTrap: false
          };
          let _0x22b0ac = _0x46d0c7;
          _0x5028ab = _0x4a45e9.filter(_0x7997c9 => _0x7997c9.trap).sort(function (_0x22c3c7, _0x44c20b) {
            return _0x4f6d8c(_0x22c3c7, _0x22b0ac) - _0x4f6d8c(_0x44c20b, _0x22b0ac);
          })[0];
          if (_0x5028ab) {
            !(_0x2c6f82.sid != _0x5028ab.owner.sid && !_0x1af301(_0x5028ab.owner.sid)) && _0x4f6d8c(_0x5028ab, _0x22b0ac) <= 65 && _0x5028ab.active ? _0x22b0ac.inTrap = true : _0x22b0ac.inTrap = false;
            if (_0x1ad2a2(_0xb04feb, _0x2c6f82) <= 300) {
              if (_0x22b0ac.inTrap) {
                if (_0x5cbf93) {
                  for (let _0x58393f = Math.PI / 1.5; _0x58393f < Math.PI * 2; _0x58393f += Math.PI / 1.5) {
                    _0x59f82f(2, _0x11b3cf + _0x58393f);
                  }
                } else {
                  for (let _0x989e8b = 0; _0x989e8b < Math.PI * 2; _0x989e8b += Math.PI / 1.5) {
                    _0x59f82f(2, _0x11b3cf + _0x989e8b);
                  }
                }
              } else {
                if (_0x2c6f82.items[4] == 15) {
                  if (_0x1052c8.isSandbox) {
                    if (_0x5cbf93) {
                      _0x59f82f(2, _0x11b3cf);
                    } else {
                      for (let _0xd59a9d = 0; _0xd59a9d < Math.PI * 2; _0xd59a9d += Math.PI / 1.5) {
                        _0x59f82f(4, _0x11b3cf + _0xd59a9d);
                      }
                    }
                  } else {
                    _0x59f82f(4, _0x11b3cf);
                  }
                }
              }
            }
          } else {
            if (_0x1052c8.isSandbox) {
              if (_0x2c6f82.items[4] == 15) {
                _0x59f82f(4, _0x2541d9() + Math.PI);
              }
            }
          }
        }
      }
    }
    function _0x3e93a0() {
      _0x22f4d8 = true;
      _0x2e7a61 = true;
      _0x24e16f(7, 0);
      _0x499306 = _0x2c6f82.weapons[0];
      _0x389917(_0x2c6f82.weapons[0], true);
      _0x32027d.send('7', 1);
      _0xd8099b(() => {
        _0x32027d.send('7', 1);
        _0x22f4d8 = false;
        _0x2e7a61 = false;
        _0x24e16f(_0x4c6a38.length ? 22 : 6, 0);
      }, 1);
    }
    var _0x29436e = false;
    var _0xf70d71 = false;
    function _0x4a0cb7() {
      _0xf70d71 = true;
      _0x2e7a61 = true;
      _0x499306 = _0x2c6f82.weapons[1];
      _0x389917(_0x2c6f82.weapons[1], true);
      _0x24e16f(53, 0);
      _0xd86a8();
      _0xd8099b(() => {
        _0x499306 = _0x2c6f82.weapons[0], _0x389917(_0x2c6f82.weapons[0], true), _0x24e16f(7, 0), _0xd8099b(() => {
          _0xd86a8(), _0xf70d71 = false, _0x2e7a61 = false, _0x24e16f(_0x4c6a38.length ? 22 : 6, 0);
        }, 1);
      }, 1);
    }
    function _0x26b0bc() {
      _0x15d528.innerText = _0x2c6f82.points;
      _0x3422a5.innerText = _0x2c6f82.food;
      ;
      _0x122d08.innerText = _0x2c6f82.wood;
      _0x372140.innerText = _0x2c6f82.stone;
      _0x2d7ed1.innerText = _0x2c6f82.kills;
    }
    var _0x1f1236 = {};
    var _0x390c31 = ["crown", "skull"];
    function _0x174b82() {
      for (var _0x42e4d9 = 0; _0x42e4d9 < _0x390c31.length; ++_0x42e4d9) {
        var _0x5b7d51 = new Image();
        _0x5b7d51.onload = function () {
          this.isLoaded = true;
        };
        _0x5b7d51.src = ".././img/icons/" + _0x390c31[_0x42e4d9] + ".png";
        _0x1f1236[_0x390c31[_0x42e4d9]] = _0x5b7d51;
      }
    }
    var _0x3fdbfc = [];
    var _0xaeed3f = true;
    var _0x1d4af5 = 0;
    var _0xb767d2 = true;
    function _0x428306(_0x554d42, _0x2ada09) {
      _0x2c6f82.upgradePoints = _0x554d42;
      _0x2c6f82.upgrAge = _0x2ada09;
      if (_0x554d42 > 0) {
        _0x3fdbfc.length = 0;
        _0x4a052b.removeAllChildren(_0x2cdfa4);
        for (var _0x3a1a7a = 0; _0x3a1a7a < _0x34ff74.weapons.length; ++_0x3a1a7a) {
          if (_0x34ff74.weapons[_0x3a1a7a].age == _0x2ada09 && (_0x34ff74.weapons[_0x3a1a7a].pre == undefined || _0x2c6f82.weapons.indexOf(_0x34ff74.weapons[_0x3a1a7a].pre) >= 0)) {
            var _0x21d337 = _0x4a052b.generateElement({
              id: "upgradeItem" + _0x3a1a7a,
              class: "actionBarItem",
              onmouseout: function () {
                _0x4873c6();
              },
              parent: _0x2cdfa4
            });
            _0x21d337.style.backgroundImage = document.getElementById("actionBarItem" + _0x3a1a7a).style.backgroundImage;
            _0x3fdbfc.push(_0x3a1a7a);
          }
        }
        for (var _0x3a1a7a = 0; _0x3a1a7a < _0x34ff74.list.length; ++_0x3a1a7a) {
          if (_0x34ff74.list[_0x3a1a7a].age == _0x2ada09 && (_0x34ff74.list[_0x3a1a7a].pre == undefined || _0x2c6f82.items.indexOf(_0x34ff74.list[_0x3a1a7a].pre) >= 0)) {
            var _0x9e7db0 = _0x34ff74.weapons.length + _0x3a1a7a;
            var _0x21d337 = _0x4a052b.generateElement({
              id: "upgradeItem" + _0x9e7db0,
              class: "actionBarItem",
              onmouseout: function () {
                _0x4873c6();
              },
              parent: _0x2cdfa4
            });
            _0x21d337.style.backgroundImage = document.getElementById("actionBarItem" + _0x9e7db0).style.backgroundImage;
            _0x3fdbfc.push(_0x9e7db0);
          }
        }
        for (var _0x3a1a7a = 0; _0x3a1a7a < _0x3fdbfc.length; _0x3a1a7a++) {
          (function (_0x270f9d) {
            var _0x4dd86e = document.getElementById("upgradeItem" + _0x270f9d);
            _0x4dd86e.onmouseover = function () {
              _0x34ff74.weapons[_0x270f9d] ? _0x4873c6(_0x34ff74.weapons[_0x270f9d], true) : _0x4873c6(_0x34ff74.list[_0x270f9d - _0x34ff74.weapons.length]);
            };
            _0x4dd86e.onclick = _0x4a052b.checkTrusted(function () {
              if (_0x270f9d >= 0 && _0x270f9d <= 15) {
                _0x499306 = _0x270f9d;
                if (_0x270f9d < 9) {
                  _0x2c6f82.pR = 1;
                } else {
                  _0x270f9d > 8 && (_0x2c6f82.sR = 1);
                }
              }
              _0x32027d.send('6', _0x270f9d);
            });
            _0x4a052b.hookTouchEvents(_0x4dd86e);
          })(_0x3fdbfc[_0x3a1a7a]);
        }
        if (_0x3fdbfc.length) {
          _0x2cdfa4.style.display = "block";
          _0x360713.style.display = "block";
          _0x360713.innerHTML = "SELECT ITEMS (" + _0x554d42 + ')';
        } else {
          _0x2cdfa4.style.display = "none";
          _0x360713.style.display = "none";
          _0x4873c6();
        }
        if (_0x2c6f82.alive) {
          if (_0x1d4af5 == 0) {
            _0x249ae8(3);
          } else {
            if (_0x1d4af5 == 1) {
              _0x249ae8(17);
            } else {
              if (_0x1d4af5 == 2) {
                _0x249ae8(31);
              } else {
                if (_0x1d4af5 == 3) {
                  _0x249ae8(27);
                } else {
                  if (_0x1d4af5 == 4) {
                    _0xb767d2 ? _0x249ae8(10) : _0x249ae8(9);
                  } else {
                    if (_0x1d4af5 == 5) {
                      _0x249ae8(38);
                    } else {
                      if (_0x1d4af5 == 6) {
                        _0x249ae8(4);
                      } else {
                        if (_0x1d4af5 == 7) {
                          _0x249ae8(25);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          _0x1d4af5++;
        }
      } else {
        _0x2cdfa4.style.display = "none";
        _0x360713.style.display = "none";
        _0x4873c6();
      }
    }
    function _0x249ae8(_0x218f0e) {
      if (_0x218f0e >= 0 && _0x218f0e <= 15) {
        _0x499306 = _0x218f0e;
        if (_0x218f0e < 9) {
          _0x2c6f82.pR = 1;
        } else {
          if (_0x218f0e > 8) {
            _0x2c6f82.sR = 1;
          }
        }
      }
      _0x32027d.send('6', _0x218f0e);
    }
    function _0x246259(_0x6eeee5, _0x3ca8d7, _0x3fe196) {
      if (_0x6eeee5 != undefined) {
        _0x2c6f82.XP = _0x6eeee5;
      }
      if (_0x3ca8d7 != undefined) {
        _0x2c6f82.maxXP = _0x3ca8d7;
      }
      if (_0x3fe196 != undefined) {
        _0x2c6f82.age = _0x3fe196;
      }
      if (_0x3fe196 == _0x1052c8.maxAge) {
        _0x3d2b41.innerHTML = "MAX AGE";
        _0x15ae40.style.width = '0%';
      } else {
        _0x3d2b41.innerHTML = "AGE " + _0x2c6f82.age, _0x15ae40.style.width = '0%';
      }
    }
    function _0xaa259b(_0x32c20f) {
      _0x4a052b.removeAllChildren(_0x449745);
      var _0xa96eb7 = 1;
      for (var _0x714386 = 0; _0x714386 < _0x32c20f.length; _0x714386 += 3) {
        (function (_0x1b5d5f) {
          _0x4a052b.generateElement({
            class: "leaderHolder",
            parent: _0x449745,
            children: [_0x4a052b.generateElement({
              class: "leaderboardItem",
              style: "color:" + (_0x32c20f[_0x1b5d5f] == _0x4d4c14 ? "#fff" : "rgba(255,255,255,0.6)"),
              text: _0xa96eb7 + '.\x20' + (_0x32c20f[_0x1b5d5f + 1] != '' ? _0x32c20f[_0x1b5d5f + 1] : "unknown")
            }), _0x4a052b.generateElement({
              class: "leaderScore",
              text: _0x4a052b.kFormat(_0x32c20f[_0x1b5d5f + 2]) || '0'
            })]
          });
        })(_0x714386);
        _0xa96eb7++;
      }
    }
    let _0x2b702e = Math.random() * _0x1052c8.mapScale;
    let _0xae7142 = false;
    let _0x1dffdc = 0.35;
    function _0x3f45aa() {
      if (true) {
        if (_0x2c6f82) {
          if (!_0x4fc701 || _0x5462e6 - _0x4fc701 >= 1000 / _0x1052c8.clientSendRate) {
            _0x4fc701 = _0x5462e6;
            let _0x37e722 = _0x2541d9();
            _0x2b0fae !== _0x37e722 && (_0x2b0fae = _0x37e722, _0x32027d.send('2', _0x37e722));
          }
        }
        _0x973f1b < 120 && (_0x973f1b += 0.1 * _0x17d20f, _0x46ad7d.style.fontSize = Math.min(Math.round(_0x973f1b), 120) + 'px');
        if (_0x2c6f82) {
          var _0x1559c = _0x4a052b.getDistance(_0x376363, _0x174296, _0x2c6f82.x, _0x2c6f82.y);
          var _0x2786b5 = _0x4a052b.getDirection(_0x2c6f82.x, _0x2c6f82.y, _0x376363, _0x174296);
          var _0x54dcdf = Math.min(_0x1559c * 0.01 * _0x17d20f, _0x1559c);
          if (_0x1559c > 0.05) {
            _0x376363 += _0x54dcdf * Math.cos(_0x2786b5);
            _0x174296 += _0x54dcdf * Math.sin(_0x2786b5);
          } else {
            _0x376363 = _0x2c6f82.x;
            _0x174296 = _0x2c6f82.y;
          }
        } else {
          _0x376363 = _0x1052c8.mapScale / 2, _0x174296 = _0x1052c8.mapScale / 2;
        }
        var _0x25d931 = _0x5462e6 - 1000 / _0x1052c8.serverUpdateRate;
        var _0x527a3c;
        for (var _0x3945e8 = 0; _0x3945e8 < _0xe6cd1d.length + _0x4c7cec.length; ++_0x3945e8) {
          _0x48c073 = _0xe6cd1d[_0x3945e8] || _0x4c7cec[_0x3945e8 - _0xe6cd1d.length];
          if (_0x48c073 && _0x48c073.visible) {
            if (_0x48c073.forcePos) {
              _0x48c073.x = _0x48c073.x2;
              _0x48c073.y = _0x48c073.y2;
              _0x48c073.dir = _0x48c073.d2;
            } else {
              var _0x5a425f = _0x48c073.t2 - _0x48c073.t1;
              var _0x20a0ba = _0x25d931 - _0x48c073.t1;
              var _0x41746a = _0x20a0ba / _0x5a425f;
              var _0x6a4636 = 170;
              _0x48c073.dt += _0x17d20f;
              var _0x555a44 = Math.min(1.7, _0x48c073.dt / _0x6a4636);
              var _0x527a3c = _0x48c073.x2 - _0x48c073.x1;
              _0x48c073.x = _0x48c073.x1 + _0x527a3c * _0x555a44;
              _0x527a3c = _0x48c073.y2 - _0x48c073.y1;
              _0x48c073.y = _0x48c073.y1 + _0x527a3c * _0x555a44;
              _0x48c073.dir = Math.lerpAngle(_0x48c073.d2, _0x48c073.d1, Math.min(1.2, _0x41746a));
            }
          }
        }
        var _0x52219d = _0x376363 - _0xfa8e22 / 2;
        var _0x14cd6c = _0x174296 - _0x207741 / 2;
        if (_0x1052c8.snowBiomeTop - _0x14cd6c <= 0 && _0x1052c8.mapScale - _0x1052c8.snowBiomeTop - _0x14cd6c >= _0x207741) {
          _0xce3328.fillStyle = "#b6db66", _0xce3328.fillRect(0, 0, _0xfa8e22, _0x207741);
        } else {
          if (_0x1052c8.mapScale - _0x1052c8.snowBiomeTop - _0x14cd6c <= 0) {
            _0xce3328.fillStyle = "#dbc666";
            _0xce3328.fillRect(0, 0, _0xfa8e22, _0x207741);
          } else {
            if (_0x1052c8.snowBiomeTop - _0x14cd6c >= _0x207741) {
              _0xce3328.fillStyle = "#fff";
              _0xce3328.fillRect(0, 0, _0xfa8e22, _0x207741);
            } else {
              _0x1052c8.snowBiomeTop - _0x14cd6c >= 0 ? (_0xce3328.fillStyle = "#fff", _0xce3328.fillRect(0, 0, _0xfa8e22, _0x1052c8.snowBiomeTop - _0x14cd6c), _0xce3328.fillStyle = "#b6db66", _0xce3328.fillRect(0, _0x1052c8.snowBiomeTop - _0x14cd6c, _0xfa8e22, _0x207741 - (_0x1052c8.snowBiomeTop - _0x14cd6c))) : (_0xce3328.fillStyle = "#b6db66", _0xce3328.fillRect(0, 0, _0xfa8e22, _0x1052c8.mapScale - _0x1052c8.snowBiomeTop - _0x14cd6c), _0xce3328.fillStyle = "#dbc666", _0xce3328.fillRect(0, _0x1052c8.mapScale - _0x1052c8.snowBiomeTop - _0x14cd6c, _0xfa8e22, _0x207741 - (_0x1052c8.mapScale - _0x1052c8.snowBiomeTop - _0x14cd6c)));
            }
          }
        }
        if (!_0x58bfa8) {
          _0x50d938 += _0x4fdee5 * _0x1052c8.waveSpeed * _0x17d20f;
          if (_0x50d938 >= _0x1052c8.waveMax) {
            _0x50d938 = _0x1052c8.waveMax;
            _0x4fdee5 = -1;
          } else {
            _0x50d938 <= 1 && (_0x50d938 = _0x4fdee5 = 1);
          }
          _0xce3328.globalAlpha = 1;
          _0xce3328.fillStyle = "#dbc666";
          _0x7feb27(_0x52219d, _0x14cd6c, _0xce3328, _0x1052c8.riverPadding);
          _0xce3328.fillStyle = "#91b2db";
          _0x7feb27(_0x52219d, _0x14cd6c, _0xce3328, (_0x50d938 - 1) * 250);
        }
        _0xce3328.globalAlpha = 1;
        _0xce3328.strokeStyle = _0x36f304;
        _0xad7b05(-1, _0x52219d, _0x14cd6c);
        _0xce3328.globalAlpha = 1;
        _0xce3328.lineWidth = _0x59cf25;
        _0x4c025e(0, _0x52219d, _0x14cd6c);
        _0x4e7bec(_0x52219d, _0x14cd6c, 0);
        _0xce3328.globalAlpha = 1;
        for (var _0x3945e8 = 0; _0x3945e8 < _0x4c7cec.length; ++_0x3945e8) {
          _0x48c073 = _0x4c7cec[_0x3945e8];
          if (_0x48c073.active && _0x48c073.visible) {
            _0x48c073.animate(_0x17d20f);
            _0xce3328.save();
            _0xce3328.translate(_0x48c073.x - _0x52219d, _0x48c073.y - _0x14cd6c);
            _0xce3328.rotate(_0x48c073.dir + _0x48c073.dirPlus - Math.PI / 2);
            _0x5ee6aa(_0x48c073, _0xce3328);
            _0xce3328.restore();
          }
        }
        _0xad7b05(0, _0x52219d, _0x14cd6c);
        _0x4c025e(1, _0x52219d, _0x14cd6c);
        _0xad7b05(1, _0x52219d, _0x14cd6c);
        _0x4e7bec(_0x52219d, _0x14cd6c, 1);
        _0xad7b05(2, _0x52219d, _0x14cd6c);
        _0xad7b05(3, _0x52219d, _0x14cd6c);
        _0xce3328.fillStyle = "#000";
        _0xce3328.globalAlpha = 0.09;
        _0x52219d <= 0 && _0xce3328.fillRect(0, 0, -_0x52219d, _0x207741);
        if (_0x1052c8.mapScale - _0x52219d <= _0xfa8e22) {
          var _0x5a62df = Math.max(0, -_0x14cd6c);
          _0xce3328.fillRect(_0x1052c8.mapScale - _0x52219d, _0x5a62df, _0xfa8e22 - (_0x1052c8.mapScale - _0x52219d), _0x207741 - _0x5a62df);
        }
        if (_0x14cd6c <= 0) {
          _0xce3328.fillRect(-_0x52219d, 0, _0xfa8e22 + _0x52219d, -_0x14cd6c);
        }
        if (_0x1052c8.mapScale - _0x14cd6c <= _0x207741) {
          var _0x29c594 = Math.max(0, -_0x52219d);
          var _0x44dbda = 0;
          if (_0x1052c8.mapScale - _0x52219d <= _0xfa8e22) {
            _0x44dbda = _0xfa8e22 - (_0x1052c8.mapScale - _0x52219d);
          }
          _0xce3328.fillRect(_0x29c594, _0x1052c8.mapScale - _0x14cd6c, _0xfa8e22 - _0x29c594 - _0x44dbda, _0x207741 - (_0x1052c8.mapScale - _0x14cd6c));
        }
        _0xce3328.globalAlpha = 1;
        _0xce3328.fillStyle = "rgba(0, 0, 70, " + _0x1dffdc + ')';
        _0xce3328.fillRect(0, 0, _0xfa8e22, _0x207741);
        _0xce3328.strokeStyle = _0x5abed7;
        for (var _0x3945e8 = 0; _0x3945e8 < _0xe6cd1d.length + _0x4c7cec.length; ++_0x3945e8) {
          _0x48c073 = _0xe6cd1d[_0x3945e8] || _0x4c7cec[_0x3945e8 - _0xe6cd1d.length];
          _0xce3328.strokeStyle = _0x5abed7;
          if (_0x48c073.visible) {
            if (_0x48c073.isPlayer && (_0x48c073.weaponIndex < 9 || _0x48c073.weaponIndex == 10 || _0x48c073.weaponIndex == 14)) {
              _0xce3328.beginPath();
              _0xce3328.arc(_0x48c073.x - _0x52219d, _0x48c073.y - _0x14cd6c, _0x48c073.scale + _0x34ff74.weapons[_0x48c073.weaponIndex].range, _0x48c073.dir - Math.PI / 2, _0x48c073.dir + Math.PI / 2);
              _0xce3328.globalAlpha = 0.175;
              _0xce3328.fillStyle = "red";
              _0xce3328.fill();
            }
            _0xce3328.globalAlpha = 1;
            var _0x5679c0 = (_0x48c073.team ? '[' + _0x48c073.team + ']\x20' : '') + (_0x48c073.name || '');
            if (_0x5679c0 != '') {
              _0xce3328.font = (_0x48c073.nameScale || 30) + "px Hammersmith One";
              _0xce3328.fillStyle = "#fff";
              _0xce3328.textBaseline = "middle";
              _0xce3328.textAlign = "center";
              _0xce3328.lineWidth = _0x48c073.nameScale ? 11 : 8;
              _0xce3328.lineJoin = "round";
              _0xce3328.strokeText(_0x5679c0, _0x48c073.x - _0x52219d, _0x48c073.y - _0x14cd6c - _0x48c073.scale - _0x1052c8.nameY);
              _0xce3328.fillText(_0x5679c0, _0x48c073.x - _0x52219d, _0x48c073.y - _0x14cd6c - _0x48c073.scale - _0x1052c8.nameY);
              if (_0x48c073.isLeader && _0x1f1236.crown.isLoaded) {
                var _0x4ace92 = _0x1052c8.crownIconScale;
                var _0x29c594 = _0x48c073.x - _0x52219d - _0x4ace92 / 2 - _0xce3328.measureText(_0x5679c0).width / 2 - _0x1052c8.crownPad;
                _0xce3328.drawImage(_0x1f1236.crown, _0x29c594, _0x48c073.y - _0x14cd6c - _0x48c073.scale - _0x1052c8.nameY - _0x4ace92 / 2 - 5, _0x4ace92, _0x4ace92);
              }
              if (_0x48c073.iconIndex == 1 && _0x1f1236.skull.isLoaded) {
                var _0x4ace92 = _0x1052c8.crownIconScale;
                var _0x29c594 = _0x48c073.x - _0x52219d - _0x4ace92 / 2 + _0xce3328.measureText(_0x5679c0).width / 2 + _0x1052c8.crownPad;
                _0xce3328.drawImage(_0x1f1236.skull, _0x29c594, _0x48c073.y - _0x14cd6c - _0x48c073.scale - _0x1052c8.nameY - _0x4ace92 / 2 - 5, _0x4ace92, _0x4ace92);
              }
            }
            if (_0x48c073.health > 0) {
              var _0x3f238f = _0x1052c8.healthBarWidth;
              _0xce3328.fillStyle = _0x5abed7;
              _0xce3328.roundRect(_0x48c073.x - _0x52219d - _0x1052c8.healthBarWidth / 2 - _0x1052c8.healthBarPad, _0x48c073.y - _0x14cd6c - _0x1052c8.healthBarPad, _0x1052c8.healthBarWidth + _0x1052c8.healthBarPad * 2, 17, 8);
              _0xce3328.fill();
              _0xce3328.fillStyle = _0x48c073 == _0x2c6f82 || _0x48c073.team && _0x48c073.team == _0x2c6f82.team ? "#8ecc51" : "#cc5151";
              _0xce3328.roundRect(_0x48c073.x - _0x52219d - _0x1052c8.healthBarWidth / 2, _0x48c073.y - _0x14cd6c, _0x1052c8.healthBarWidth * (_0x48c073.health / _0x48c073.maxHealth), 17 - _0x1052c8.healthBarPad * 2, 7);
              _0xce3328.fill();
            }
            if (_0x48c073 == _0x2c6f82) {
              _0xce3328.font = (_0x48c073.nameScale || 30) + "px Hammersmith One";
              _0xce3328.fillStyle = _0x48c073.shameCount < 5 ? "#8ecc51" : "#cc5151";
              _0xce3328.textBaseline = "middle";
              _0xce3328.textAlign = "center";
              _0xce3328.lineWidth = _0x48c073.nameScale ? 11 : 8;
              _0xce3328.lineJoin = "round";
              var _0x4ace92 = _0x1052c8.crownIconScale;
              var _0x29c594 = _0x48c073.x - _0x52219d - _0x4ace92 / 2 + _0xce3328.measureText(_0x5679c0).width / 2 + _0x1052c8.crownPad + (_0x48c073.iconIndex == 1 ? (_0x48c073.nameScale || 30) * 2.75 : _0x48c073.nameScale || 30);
              _0xce3328.strokeText(_0x48c073.shameCount, _0x29c594, _0x48c073.y - _0x14cd6c - _0x48c073.scale - _0x1052c8.nameY);
              _0xce3328.fillText(_0x48c073.shameCount, _0x29c594, _0x48c073.y - _0x14cd6c - _0x48c073.scale - _0x1052c8.nameY);
              _0xce3328.font = "20px Hammersmith One";
              _0xce3328.fillStyle = "#fff";
              _0xce3328.textBaseline = "middle";
              _0xce3328.textAlign = "center";
              _0xce3328.lineWidth = _0x48c073.nameScale ? 11 : 8;
              _0xce3328.lineJoin = "round";
              _0xce3328.strokeText('[' + [pktSended, minPacket, secPacket].join('/') + ']', _0x48c073.x - _0x52219d, _0x48c073.y - _0x14cd6c + _0x48c073.scale + _0x1052c8.nameY);
              _0xce3328.fillText('[' + [pktSended, minPacket, secPacket].join('/') + ']', _0x48c073.x - _0x52219d, _0x48c073.y - _0x14cd6c + _0x48c073.scale + _0x1052c8.nameY);
            } else {
              if (_0x48c073.isPlayer) {
                _0xce3328.font = "20px Hammersmith One";
                _0xce3328.fillStyle = "#fff";
                _0xce3328.textBaseline = "middle";
                _0xce3328.textAlign = "center";
                _0xce3328.lineWidth = _0x48c073.nameScale ? 11 : 8;
                _0xce3328.lineJoin = "round";
                _0xce3328.strokeText('[' + [_0x48c073.primaryIndex, _0x48c073.secondaryIndex].join('/') + ']', _0x48c073.x - _0x52219d, _0x48c073.y - _0x14cd6c + _0x48c073.scale + _0x1052c8.nameY);
                _0xce3328.fillText('[' + [_0x48c073.primaryIndex, _0x48c073.secondaryIndex].join('/') + ']', _0x48c073.x - _0x52219d, _0x48c073.y - _0x14cd6c + _0x48c073.scale + _0x1052c8.nameY);
              }
            }
            if (_0x48c073 != _0x2c6f82 && _0x48c073.isPlayer) {
              if (!(_0x48c073 == _0x2c6f82 || _0x48c073.team && _0x48c073.team == _0x2c6f82.team)) {
                let _0x3fcdd3 = function (_0x4a8727, _0x25121c) {
                  return Math.hypot(_0x4a8727.y1 - _0x25121c.y1, _0x4a8727.x1 - _0x25121c.x1);
                };
                let _0x4eda05 = function (_0x5eb589, _0x52b180) {
                  return Math.atan2(_0x5eb589.y1 - _0x52b180.y1, _0x5eb589.x1 - _0x52b180.x1);
                };
                let _0x2f2ce4 = Math.floor(_0x3fcdd3(_0x48c073, _0x2c6f82));
                let _0x1967cf = function (_0x4ec825) {
                  return _0x2f2ce4 / _0x4ec825;
                };
                let _0x3d774a = function (_0x15deb1, _0x9ce3f3) {
                  _0x9ce3f3 = _0x9ce3f3 || _0xce3328;
                  var _0x15d46c = _0x15deb1 * 0.8660254037844386;
                  _0x9ce3f3.beginPath();
                  _0x9ce3f3.moveTo(0, -_0x15d46c / 2);
                  _0x9ce3f3.lineTo(-_0x15deb1 / 2, _0x15d46c / 2);
                  _0x9ce3f3.lineTo(_0x15deb1 / 2, _0x15d46c / 2);
                  _0x9ce3f3.lineTo(0, -_0x15d46c / 2);
                  _0x9ce3f3.fill();
                  _0x9ce3f3.closePath();
                };
                _0xce3328.save();
                _0xce3328.translate(_0x2c6f82.x1 + _0x1967cf(2) * Math.cos(_0x4eda05(_0x48c073, _0x2c6f82)) - _0x52219d, _0x2c6f82.y1 + _0x1967cf(2) * Math.sin(_0x4eda05(_0x48c073, _0x2c6f82)) - _0x14cd6c);
                _0xce3328.rotate(_0x4eda05(_0x48c073, _0x2c6f82) + Math.PI / 2);
                _0xce3328.fillStyle = "#cc5151";
                _0xce3328.globalAlpha = _0x1967cf(1440) > 1 ? 1 : _0x1967cf(1440);
                _0x3d774a(_0x1052c8.playerScale, _0xce3328);
                _0xce3328.restore();
              }
              if (_0x5e1af5.length && _0x29436e) {
                _0xce3328.strokeStyle = "#cc5151";
                _0xce3328.globalAlpha = 1;
                _0xce3328.lineWidth = 8;
                _0x33b930(_0xb04feb.x - _0x52219d, _0xb04feb.y - _0x14cd6c, _0xb04feb.scale, _0xce3328, false, true);
              }
            }
          }
        }
        _0xce3328.strokeStyle = _0x5abed7;
        function _0x264ac0(_0x2c60c8, _0x3183ac, _0x55bbf5, _0xc2f2ef) {
          _0xc2f2ef = _0xc2f2ef || _0xce3328;
        }
        _0x40c2fb.update(_0x17d20f, _0xce3328, _0x52219d, _0x14cd6c);
        for (var _0x3945e8 = 0; _0x3945e8 < _0xe6cd1d.length; ++_0x3945e8) {
          _0x48c073 = _0xe6cd1d[_0x3945e8];
          if (_0x48c073.visible && _0x48c073.chatCountdown > 0) {
            _0x48c073.chatCountdown -= _0x17d20f;
            if (_0x48c073.chatCountdown <= 0) {
              _0x48c073.chatCountdown = 0;
            }
            _0xce3328.font = "32px Hammersmith One";
            var _0x244434 = _0xce3328.measureText(_0x48c073.chatMessage);
            _0xce3328.textBaseline = "middle";
            _0xce3328.textAlign = "center";
            var _0x29c594 = _0x48c073.x - _0x52219d;
            var _0x5a62df = _0x48c073.y - _0x48c073.scale - _0x14cd6c - 90;
            var _0x3a68f5 = 47;
            var _0x543045 = _0x244434.width + 17;
            _0xce3328.fillStyle = "rgba(0,0,0,0.2)";
            _0xce3328.roundRect(_0x29c594 - _0x543045 / 2, _0x5a62df - _0x3a68f5 / 2, _0x543045, _0x3a68f5, 6);
            _0xce3328.fill();
            _0xce3328.fillStyle = "#fff";
            _0xce3328.fillText(_0x48c073.chatMessage, _0x29c594, _0x5a62df);
          }
        }
      }
      _0x3e4886(_0x17d20f);
      _0x59c5a6.id !== -1 && _0x56d447(_0x59c5a6.startX, _0x59c5a6.startY, _0x59c5a6.currentX, _0x59c5a6.currentY);
      if (_0x3433b6.id !== -1) {
        _0x56d447(_0x3433b6.startX, _0x3433b6.startY, _0x3433b6.currentX, _0x3433b6.currentY);
      }
    }
    function _0x56d447(_0x52e6f4, _0x2b8393, _0x260919, _0x18a618) {
      _0xce3328.save();
      _0xce3328.setTransform(1, 0, 0, 1, 0, 0);
      _0xce3328.scale(_0x5dab85, _0x5dab85);
      var _0x3f068a = 50;
      _0xce3328.beginPath();
      _0xce3328.arc(_0x52e6f4, _0x2b8393, _0x3f068a, 0, Math.PI * 2, false);
      _0xce3328.closePath();
      _0xce3328.fillStyle = "rgba(255, 255, 255, 0.3)";
      _0xce3328.fill();
      var _0x3f068a = 50;
      var _0x279253 = _0x260919 - _0x52e6f4;
      var _0x7c6d52 = _0x18a618 - _0x2b8393;
      var _0x39db97 = Math.sqrt(Math.pow(_0x279253, 2) + Math.pow(_0x7c6d52, 2));
      var _0x4ad6de = _0x39db97 > _0x3f068a ? _0x39db97 / _0x3f068a : 1;
      _0x279253 /= _0x4ad6de;
      _0x7c6d52 /= _0x4ad6de;
      _0xce3328.beginPath();
      _0xce3328.arc(_0x52e6f4 + _0x279253, _0x2b8393 + _0x7c6d52, _0x3f068a * 0.5, 0, Math.PI * 2, false);
      _0xce3328.closePath();
      _0xce3328.fillStyle = "white";
      _0xce3328.fill();
      _0xce3328.restore();
    }
    function _0x4c025e(_0x2af165, _0x2c8a0c, _0x48069e) {
      for (var _0x273803 = 0; _0x273803 < _0x6d2acb.length; ++_0x273803) {
        _0x48c073 = _0x6d2acb[_0x273803];
        if (_0x48c073.active && _0x48c073.layer == _0x2af165) {
          _0x48c073.update(_0x17d20f);
          if (_0x48c073.active && _0x2de10f(_0x48c073.x - _0x2c8a0c, _0x48c073.y - _0x48069e, _0x48c073.scale)) {
            _0xce3328.save();
            _0xce3328.translate(_0x48c073.x - _0x2c8a0c, _0x48c073.y - _0x48069e);
            _0xce3328.rotate(_0x48c073.dir);
            _0x3a37a9(0, 0, _0x48c073, _0xce3328, 1);
            _0xce3328.restore();
          }
        }
      }
    }
    var _0x1e2f1d = {};
    function _0x3a37a9(_0x1bd91c, _0x1954b3, _0x36943f, _0x19d63a, _0x40b478) {
      if (_0x36943f.src) {
        var _0x10d10b = _0x34ff74.projectiles[_0x36943f.indx].src;
        var _0x54af91 = _0x1e2f1d[_0x10d10b];
        if (!_0x54af91) {
          _0x54af91 = new Image();
          _0x54af91.onload = function () {
            this.isLoaded = true;
          };
          _0x54af91.src = ".././img/weapons/" + _0x10d10b + ".png";
          _0x1e2f1d[_0x10d10b] = _0x54af91;
        }
        if (_0x54af91.isLoaded) {
          _0x19d63a.drawImage(_0x54af91, _0x1bd91c - _0x36943f.scale / 2, _0x1954b3 - _0x36943f.scale / 2, _0x36943f.scale, _0x36943f.scale);
        }
      } else {
        if (_0x36943f.indx == 1) {
          _0x19d63a.fillStyle = "#939393";
          _0x33b930(_0x1bd91c, _0x1954b3, _0x36943f.scale, _0x19d63a);
        }
      }
    }
    function _0x7feb27(_0x2a97a6, _0x542586, _0x2a91cb, _0x2c571e) {
      var _0xb48a2b = _0x1052c8.riverWidth + _0x2c571e;
      var _0x39a84d = _0x1052c8.mapScale / 2 - _0x542586 - _0xb48a2b / 2;
      _0x39a84d < _0x207741 && _0x39a84d + _0xb48a2b > 0 && _0x2a91cb.fillRect(0, _0x39a84d, _0xfa8e22, _0xb48a2b);
    }
    function _0xad7b05(_0x4e41d4, _0x439fc4, _0x1f5a7) {
      var _0x333e48;
      var _0x16150e;
      var _0x2b2670;
      for (var _0x3f78be = 0; _0x3f78be < _0x4a45e9.length; ++_0x3f78be) {
        _0x48c073 = _0x4a45e9[_0x3f78be];
        if (_0x48c073.active) {
          _0x16150e = _0x48c073.x + _0x48c073.xWiggle - _0x439fc4;
          _0x2b2670 = _0x48c073.y + _0x48c073.yWiggle - _0x1f5a7;
          if (_0x4e41d4 == 0) {
            _0x48c073.update(_0x17d20f);
          }
          if (_0x48c073.layer == _0x4e41d4 && _0x2de10f(_0x16150e, _0x2b2670, _0x48c073.scale + (_0x48c073.blocker || 0))) {
            _0xce3328.globalAlpha = _0x48c073.hideFromEnemy ? 0.6 : 1;
            if (_0x48c073.isItem) {
              _0x333e48 = _0xeb974d(_0x48c073);
              _0xce3328.save();
              _0xce3328.translate(_0x16150e, _0x2b2670);
              _0xce3328.rotate(_0x48c073.dir);
              _0xce3328.drawImage(_0x333e48, -(_0x333e48.width / 2), -(_0x333e48.height / 2));
              (_0x48c073.trap || _0x48c073.dmg) && (_0xce3328.strokeStyle = _0x2c6f82 && _0x2c6f82.sid != _0x48c073.owner.sid && !_0x1af301(_0x48c073.owner.sid) ? "#cc5151" : "#8ecc51", _0xce3328.globalAlpha = 0.6, _0xce3328.lineWidth = 4, _0x33b930(0, 0, _0x48c073.scale, _0xce3328, false, true));
              if (_0x48c073.blocker) {
                _0xce3328.strokeStyle = "#db6e6e";
                _0xce3328.globalAlpha = 0.3;
                _0xce3328.lineWidth = 6;
                _0x33b930(0, 0, _0x48c073.blocker, _0xce3328, false, true);
              }
              _0xce3328.restore();
            } else {
              _0x333e48 = _0x1f7e7e(_0x48c073);
              _0xce3328.drawImage(_0x333e48, _0x16150e - _0x333e48.width / 2, _0x2b2670 - _0x333e48.height / 2);
            }
          }
        }
      }
    }
    function _0x1eb3d9(_0x10bbbd, _0x141e6f, _0x4f2ed7) {
      _0x48c073 = _0x54663(_0x10bbbd);
      if (_0x48c073) {
        _0x48c073.startAnim(_0x141e6f, _0x4f2ed7);
        if (_0x4f2ed7 < 9) {
          _0x48c073.pR = -(1000 / _0x1052c8.serverUpdateRate) / _0x34ff74.weapons[_0x4f2ed7].speed;
        } else {
          if (_0x4f2ed7 > 8) {
            _0x48c073.sR = -(1000 / _0x1052c8.serverUpdateRate) / _0x34ff74.weapons[_0x4f2ed7].speed;
          }
        }
        if (_0x48c073 == _0x2c6f82) {
          if (_0x33b253 && _0x2c6f82.weapons[1] == 10 && _0x2c6f82.skins[40]) {}
        }
      }
    }
    var _0x539477 = true;
    function _0x4e7bec(_0x35732a, _0x161248, _0x49971a) {
      _0xce3328.globalAlpha = 1;
      for (var _0xde2102 = 0; _0xde2102 < _0xe6cd1d.length; ++_0xde2102) {
        _0x48c073 = _0xe6cd1d[_0xde2102];
        if (_0x48c073.zIndex == _0x49971a) {
          _0x48c073.animate(_0x17d20f);
          if (_0x48c073.visible) {
            _0x48c073.skinRot += 0.002 * _0x17d20f;
            _0x5921f8 = (_0x48c073 == _0x2c6f82 && !_0x539477 ? _0x368167() : _0x48c073.dir) + _0x48c073.dirPlus;
            _0xce3328.save();
            _0xce3328.translate(_0x48c073.x - _0x35732a, _0x48c073.y - _0x161248);
            _0xce3328.rotate(_0x5921f8);
            _0x5e55b9(_0x48c073, _0xce3328);
            _0xce3328.restore();
          }
        }
      }
    }
    var _0x4ffa9 = true;
    function _0x5e55b9(_0x3b961c, _0x3850ce) {
      _0x3850ce = _0x3850ce || _0xce3328;
      _0x3850ce.lineWidth = _0x59cf25;
      _0x3850ce.lineJoin = "miter";
      var _0x470b9c = Math.PI / 4 * (_0x34ff74.weapons[_0x3b961c.weaponIndex].armS || 1);
      var _0x312626 = _0x3b961c.buildIndex < 0 ? _0x34ff74.weapons[_0x3b961c.weaponIndex].hndS || 1 : 1;
      var _0x2132ae = _0x3b961c.buildIndex < 0 ? _0x34ff74.weapons[_0x3b961c.weaponIndex].hndD || 1 : 1;
      if (_0x3b961c.tailIndex > 0) {
        _0x31b875(_0x3b961c.tailIndex, _0x3850ce, _0x3b961c);
      }
      _0x3b961c.buildIndex < 0 && !_0x34ff74.weapons[_0x3b961c.weaponIndex].aboveHand && (_0x4ffa9 ? _0x354d41(_0x34ff74.weapons[_0x3b961c.weaponIndex], _0x1052c8.weaponVariants[_0x3b961c.weaponVariant].src, _0x3b961c.scale, 0, _0x3850ce, _0x3b961c) : _0x5bdd29(_0x34ff74.weapons[_0x3b961c.weaponIndex], _0x1052c8.weaponVariants[_0x3b961c.weaponVariant].src, _0x3b961c.scale, 0, _0x3850ce), _0x34ff74.weapons[_0x3b961c.weaponIndex].projectile != undefined && !_0x34ff74.weapons[_0x3b961c.weaponIndex].hideProjectile && _0x3a37a9(_0x3b961c.scale, 0, _0x34ff74.projectiles[_0x34ff74.weapons[_0x3b961c.weaponIndex].projectile], _0xce3328));
      _0x3850ce.fillStyle = _0x1052c8.skinColors[_0x3b961c.skinColor];
      true && (_0x33b930(_0x3b961c.scale * Math.cos(_0x470b9c), _0x3b961c.scale * Math.sin(_0x470b9c), 14), _0x33b930(_0x3b961c.scale * _0x2132ae * Math.cos(-_0x470b9c * _0x312626), _0x3b961c.scale * _0x2132ae * Math.sin(-_0x470b9c * _0x312626), 14));
      if (_0x3b961c.buildIndex < 0 && _0x34ff74.weapons[_0x3b961c.weaponIndex].aboveHand) {
        if (_0x4ffa9) {
          _0x354d41(_0x34ff74.weapons[_0x3b961c.weaponIndex], _0x1052c8.weaponVariants[_0x3b961c.weaponVariant].src, _0x3b961c.scale, 0, _0x3850ce, _0x3b961c);
        } else {
          _0x5bdd29(_0x34ff74.weapons[_0x3b961c.weaponIndex], _0x1052c8.weaponVariants[_0x3b961c.weaponVariant].src, _0x3b961c.scale, 0, _0x3850ce);
        }
        _0x34ff74.weapons[_0x3b961c.weaponIndex].projectile != undefined && !_0x34ff74.weapons[_0x3b961c.weaponIndex].hideProjectile && _0x3a37a9(_0x3b961c.scale, 0, _0x34ff74.projectiles[_0x34ff74.weapons[_0x3b961c.weaponIndex].projectile], _0xce3328);
      }
      if (_0x3b961c.buildIndex >= 0) {
        var _0x44fee8 = _0xeb974d(_0x34ff74.list[_0x3b961c.buildIndex]);
        _0x3850ce.drawImage(_0x44fee8, _0x3b961c.scale - _0x34ff74.list[_0x3b961c.buildIndex].holdOffset, -_0x44fee8.width / 2);
      }
      if (minecraft) {
        _0x4c4e74(0, 0, _0x3b961c.scale * Math.PI / 2, _0x3b961c.scale * Math.PI / 2, _0x3850ce), _0x4c4e74(_0x3b961c.scale * Math.cos(_0x470b9c), _0x3b961c.scale * Math.sin(_0x470b9c), 21, 21, _0x3850ce), _0x4c4e74(_0x3b961c.scale * _0x2132ae * Math.cos(-_0x470b9c * _0x312626), _0x3b961c.scale * _0x2132ae * Math.sin(-_0x470b9c * _0x312626), 21, 21, _0x3850ce);
      } else {
        _0x33b930(0, 0, _0x3b961c.scale, _0x3850ce);
      }
      if (_0x3b961c.skinIndex > 0) {
        _0x3850ce.rotate(Math.PI / 2);
        _0x136d38(_0x3b961c.skinIndex, _0x3850ce, null, _0x3b961c);
      }
    }
    var _0x509685 = {};
    var _0x4d9b1c = {};
    var _0xed8546;
    function _0x136d38(_0x199a02, _0x5d5411, _0x59af7e, _0x522393) {
      _0xed8546 = _0x509685[_0x199a02];
      if (!_0xed8546) {
        var _0x3640f7 = new Image();
        _0x3640f7.onload = function () {
          this.isLoaded = true;
          this.onload = null;
        };
        _0x3640f7.src = ".././img/hats/hat_" + _0x199a02 + ".png";
        _0x509685[_0x199a02] = _0x3640f7;
        _0xed8546 = _0x3640f7;
      }
      var _0x3eedad = _0x59af7e || _0x4d9b1c[_0x199a02];
      if (!_0x3eedad) {
        for (var _0x1aeb05 = 0; _0x1aeb05 < _0x2ecb5e.length; ++_0x1aeb05) {
          if (_0x2ecb5e[_0x1aeb05].id == _0x199a02) {
            _0x3eedad = _0x2ecb5e[_0x1aeb05];
            break;
          }
        }
        _0x4d9b1c[_0x199a02] = _0x3eedad;
      }
      if (_0xed8546.isLoaded) {
        _0x5d5411.drawImage(_0xed8546, -_0x3eedad.scale / 2, -_0x3eedad.scale / 2, _0x3eedad.scale, _0x3eedad.scale);
      }
      if (!_0x59af7e && _0x3eedad.topSprite) {
        _0x5d5411.save();
        _0x5d5411.rotate(_0x522393.skinRot);
        _0x136d38(_0x199a02 + "_top", _0x5d5411, _0x3eedad, _0x522393);
        _0x5d5411.restore();
      }
    }
    var _0xb9b0cd = {};
    var _0x207553 = {};
    function _0x31b875(_0x5a4413, _0x38edc2, _0x4bfb00) {
      _0xed8546 = _0xb9b0cd[_0x5a4413];
      if (!_0xed8546) {
        var _0x28e5e9 = new Image();
        _0x28e5e9.onload = function () {
          this.isLoaded = true;
          this.onload = null;
        };
        _0x28e5e9.src = ".././img/accessories/access_" + _0x5a4413 + ".png";
        _0xb9b0cd[_0x5a4413] = _0x28e5e9;
        _0xed8546 = _0x28e5e9;
      }
      var _0xc3c52 = _0x207553[_0x5a4413];
      if (!_0xc3c52) {
        for (var _0x253cfb = 0; _0x253cfb < _0x1bbb87.length; ++_0x253cfb) {
          if (_0x1bbb87[_0x253cfb].id == _0x5a4413) {
            _0xc3c52 = _0x1bbb87[_0x253cfb];
            break;
          }
        }
        _0x207553[_0x5a4413] = _0xc3c52;
      }
      if (_0xed8546.isLoaded) {
        _0x38edc2.save();
        _0x38edc2.translate(-20 - (_0xc3c52.xOff || 0), 0);
        if (_0xc3c52.spin) {
          _0x38edc2.rotate(_0x4bfb00.skinRot);
        }
        _0x38edc2.drawImage(_0xed8546, -(_0xc3c52.scale / 2), -(_0xc3c52.scale / 2), _0xc3c52.scale, _0xc3c52.scale);
        _0x38edc2.restore();
      }
    }
    var _0x1b307c = {};
    function _0x5bdd29(_0x710cb3, _0x28871e, _0x4aa77d, _0xead32e, _0x1de10b) {
      var _0x5bfe28 = _0x710cb3.src + (_0x28871e || '');
      var _0x4b10e0 = _0x1b307c[_0x5bfe28];
      !_0x4b10e0 && (_0x4b10e0 = new Image(), _0x4b10e0.onload = function () {
        this.isLoaded = true;
      }, _0x4b10e0.src = ".././img/weapons/" + _0x5bfe28 + ".png", _0x1b307c[_0x5bfe28] = _0x4b10e0);
      if (_0x4b10e0.isLoaded) {
        _0x1de10b.drawImage(_0x4b10e0, _0x4aa77d + _0x710cb3.xOff - _0x710cb3.length / 2, _0xead32e + _0x710cb3.yOff - _0x710cb3.width / 2, _0x710cb3.length, _0x710cb3.width);
      }
    }
    var _0x5e549c = {};
    function _0x53b62b(_0x39e8c1, _0x6745b, _0x22f35a) {
      if (_0x6745b.weaponVariant == 3) {
        if (_0x39e8c1.id == 0) {
          return "https://i.imgur.com/oRXUfW8.png";
        } else {
          if (_0x39e8c1.id == 1) {
            return "https://i.imgur.com/kr8H9g7.png";
          } else {
            if (_0x39e8c1.id == 2) {
              return "https://i.imgur.com/UZ2HcQw.png";
            } else {
              if (_0x39e8c1.id == 3) {
                return "https://i.imgur.com/V9dzAbF.png";
              } else {
                if (_0x39e8c1.id == 4) {
                  return "https://i.imgur.com/vxLZW0S.png";
                } else {
                  if (_0x39e8c1.id == 5) {
                    return "https://i.imgur.com/UY7SV7j.png";
                  } else {
                    if (_0x39e8c1.id == 6) {
                      return "https://i.imgur.com/6ayjbIz.png";
                    } else {
                      if (_0x39e8c1.id == 7) {
                        return "https://i.imgur.com/CDAmjux.png";
                      } else {
                        if (_0x39e8c1.id == 8) {
                          return "https://i.imgur.com/aEs3FSU.png";
                        } else {
                          if (_0x39e8c1.id == 10) {
                            return "https://i.imgur.com/tmUzurk.png";
                          } else {
                            return ".././img/weapons/" + _0x22f35a + ".png";
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } else {
        if (_0x6745b.weaponVariant == 2) {
          if (_0x39e8c1.id == 0) {
            return "https://i.imgur.com/WPWU8zC.png";
          } else {
            if (_0x39e8c1.id == 1) {
              return "https://i.imgur.com/OU5os0h.png";
            } else {
              if (_0x39e8c1.id == 2) {
                return "https://i.imgur.com/aAJyHBB.png";
              } else {
                if (_0x39e8c1.id == 3) {
                  return "https://i.imgur.com/h5jqSRp.png";
                } else {
                  if (_0x39e8c1.id == 4) {
                    return "https://i.imgur.com/4ZxIJQM.png";
                  } else {
                    if (_0x39e8c1.id == 5) {
                      return "https://i.imgur.com/HSWcyku.png";
                    } else {
                      if (_0x39e8c1.id == 6) {
                        return "https://i.imgur.com/phXTNsa.png";
                      } else {
                        if (_0x39e8c1.id == 7) {
                          return "https://i.imgur.com/ROTb7Ks.png";
                        } else {
                          if (_0x39e8c1.id == 8) {
                            return "https://i.imgur.com/RnkmWgs.png";
                          } else {
                            if (_0x39e8c1.id == 9) {
                              return "https://i.imgur.com/qu7HHT5.png";
                            } else {
                              if (_0x39e8c1.id == 10) {
                                return "https://i.imgur.com/Fg93gj3.png";
                              } else {
                                if (_0x39e8c1.id == 11) {
                                  return "https://i.imgur.com/hSqLP3t.png";
                                } else {
                                  if (_0x39e8c1.id == 12) {
                                    return "https://i.imgur.com/TRqDlgX.png";
                                  } else {
                                    if (_0x39e8c1.id == 13) {
                                      return "https://i.imgur.com/DVjCdwI.png";
                                    } else {
                                      return ".././img/weapons/" + _0x22f35a + ".png";
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } else {
          if (_0x6745b.weaponVariant == 1) {
            if (_0x39e8c1.id == 3) {
              return "https://i.imgur.com/wOTr8TG.png";
            } else {
              if (_0x39e8c1.id == 4) {
                return "https://i.imgur.com/QKBc2ou.png";
              } else {
                if (_0x39e8c1.id == 5) {
                  return "https://i.imgur.com/jKDdyvc.png";
                } else {
                  if (_0x39e8c1.id == 6) {
                    return "https://i.imgur.com/ivLPh10.png";
                  } else {
                    if (_0x39e8c1.id == 8) {
                      return "https://i.imgur.com/DTd8Xl6.png";
                    } else {
                      return ".././img/weapons/" + _0x22f35a + ".png";
                    }
                  }
                }
              }
            }
          } else {
            return ".././img/weapons/" + _0x22f35a + ".png";
          }
        }
      }
    }
    function _0x354d41(_0x4b8c22, _0x41e6c8, _0x17ff41, _0x4da772, _0x253206, _0x5ea374) {
      var _0x6502ed = _0x4b8c22.src + (_0x41e6c8 || '');
      var _0x4cd869 = _0x5e549c[_0x6502ed];
      !_0x4cd869 && (_0x4cd869 = new Image(), _0x4cd869.onload = function () {
        this.isLoaded = true;
      }, _0x4cd869.src = _0x53b62b(_0x4b8c22, _0x5ea374, _0x6502ed), _0x5e549c[_0x6502ed] = _0x4cd869);
      if (_0x4cd869.isLoaded) {
        _0x253206.drawImage(_0x4cd869, _0x17ff41 + _0x4b8c22.xOff - _0x4b8c22.length / 2, _0x4da772 + _0x4b8c22.yOff - _0x4b8c22.width / 2, _0x4b8c22.length, _0x4b8c22.width);
      }
    }
    var _0x35bd24 = {};
    function _0x1f7e7e(_0x543333) {
      var _0x543cc0 = _0x543333.y >= _0x1052c8.mapScale - _0x1052c8.snowBiomeTop ? 2 : _0x543333.y <= _0x1052c8.snowBiomeTop ? 1 : 0;
      var _0x4bcde8 = _0x543333.type + '_' + _0x543333.scale + '_' + _0x543cc0;
      var _0x408941 = _0x35bd24[_0x4bcde8];
      if (!_0x408941) {
        var _0x4b7f4e = document.createElement("canvas");
        _0x4b7f4e.width = _0x4b7f4e.height = _0x543333.scale * 2.1 + _0x59cf25;
        var _0x2a521d = _0x4b7f4e.getContext('2d');
        _0x2a521d.translate(_0x4b7f4e.width / 2, _0x4b7f4e.height / 2);
        _0x2a521d.rotate(_0x4a052b.randFloat(0, Math.PI));
        _0x2a521d.strokeStyle = _0x36f304;
        _0x2a521d.lineWidth = _0x59cf25;
        if (_0x543333.type == 0) {
          var _0x6cef8c;
          for (var _0x1bb08d = 0; _0x1bb08d < 2; ++_0x1bb08d) {
            _0x6cef8c = _0x48c073.scale * (!_0x1bb08d ? 1 : 0.5);
            _0x330052(_0x2a521d, 7, _0x6cef8c, _0x6cef8c * 0.7);
            _0x2a521d.fillStyle = !_0x543cc0 ? !_0x1bb08d ? "#9ebf57" : "#b4db62" : !_0x1bb08d ? "#e3f1f4" : "#fff";
            _0x2a521d.fill();
            if (!_0x1bb08d) {
              _0x2a521d.stroke();
            }
          }
        } else {
          if (_0x543333.type == 1) {
            if (_0x543cc0 == 2) {
              _0x2a521d.fillStyle = "#606060";
              _0x330052(_0x2a521d, 6, _0x543333.scale * 0.3, _0x543333.scale * 0.71);
              _0x2a521d.fill();
              _0x2a521d.stroke();
              _0x2a521d.fillStyle = "#89a54c";
              _0x33b930(0, 0, _0x543333.scale * 0.55, _0x2a521d);
              _0x2a521d.fillStyle = "#a5c65b";
              _0x33b930(0, 0, _0x543333.scale * 0.3, _0x2a521d, true);
            } else {
              _0x1f7c09(_0x2a521d, 6, _0x48c073.scale, _0x48c073.scale * 0.7);
              _0x2a521d.fillStyle = _0x543cc0 ? "#e3f1f4" : "#89a54c";
              _0x2a521d.fill();
              _0x2a521d.stroke();
              _0x2a521d.fillStyle = _0x543cc0 ? "#6a64af" : "#c15555";
              var _0x2ac8c6;
              var _0x95484e = 4;
              var _0x59427 = _0x27c20d / _0x95484e;
              for (var _0x1bb08d = 0; _0x1bb08d < _0x95484e; ++_0x1bb08d) {
                _0x2ac8c6 = _0x4a052b.randInt(_0x48c073.scale / 3.5, _0x48c073.scale / 2.3), _0x33b930(_0x2ac8c6 * Math.cos(_0x59427 * _0x1bb08d), _0x2ac8c6 * Math.sin(_0x59427 * _0x1bb08d), _0x4a052b.randInt(10, 12), _0x2a521d);
              }
            }
          } else {
            if (_0x543333.type == 2 || _0x543333.type == 3) {
              _0x2a521d.fillStyle = _0x543333.type == 2 ? _0x543cc0 == 2 ? "#938d77" : "#939393" : "#e0c655";
              _0x330052(_0x2a521d, 3, _0x543333.scale, _0x543333.scale);
              _0x2a521d.fill();
              _0x2a521d.stroke();
              _0x2a521d.fillStyle = _0x543333.type == 2 ? _0x543cc0 == 2 ? "#b2ab90" : "#bcbcbc" : "#ebdca3";
              _0x330052(_0x2a521d, 3, _0x543333.scale * 0.55, _0x543333.scale * 0.65);
              _0x2a521d.fill();
            }
          }
        }
        _0x408941 = _0x4b7f4e;
        _0x35bd24[_0x4bcde8] = _0x408941;
      }
      return _0x408941;
    }
    var _0x4fbde6 = [];
    function _0xeb974d(_0x1d857f, _0x1c504d) {
      var _0xcc116c = _0x4fbde6[_0x1d857f.id];
      if (!_0xcc116c || _0x1c504d) {
        var _0x35d29f = document.createElement("canvas");
        _0x35d29f.width = _0x35d29f.height = _0x1d857f.scale * 2.5 + _0x59cf25 + (_0x34ff74.list[_0x1d857f.id].spritePadding || 0);
        var _0x459ab9 = _0x35d29f.getContext('2d');
        _0x459ab9.translate(_0x35d29f.width / 2, _0x35d29f.height / 2);
        _0x459ab9.rotate(_0x1c504d ? 0 : Math.PI / 2);
        _0x459ab9.strokeStyle = _0x36f304;
        _0x459ab9.lineWidth = _0x59cf25 * (_0x1c504d ? _0x35d29f.width / 81 : 1);
        if (_0x1d857f.name == "apple") {
          _0x459ab9.fillStyle = "#c15555";
          if (minecraft) {
            _0x4c4e74(0, 0, _0x1d857f.scale * (Math.PI / 2), _0x1d857f.scale * (Math.PI / 2), _0x459ab9);
          } else {
            _0x33b930(0, 0, _0x1d857f.scale, _0x459ab9);
          }
          _0x459ab9.fillStyle = "#89a54c";
          var _0x13be6d = -(Math.PI / 2);
          _0x9b12b8(_0x1d857f.scale * Math.cos(_0x13be6d), _0x1d857f.scale * Math.sin(_0x13be6d), 25, _0x13be6d + Math.PI / 2, _0x459ab9);
        } else {
          if (_0x1d857f.name == "cookie") {
            _0x459ab9.fillStyle = "#cca861";
            minecraft ? _0x4c4e74(0, 0, _0x1d857f.scale * (Math.PI / 2), _0x1d857f.scale * (Math.PI / 2), _0x459ab9) : _0x33b930(0, 0, _0x1d857f.scale, _0x459ab9);
            _0x459ab9.fillStyle = "#937c4b";
            var _0x1812b0 = 4;
            var _0x4c977d = _0x27c20d / _0x1812b0;
            var _0x3cb5bb;
            for (var _0x39fb37 = 0; _0x39fb37 < _0x1812b0; ++_0x39fb37) {
              _0x3cb5bb = _0x4a052b.randInt(_0x1d857f.scale / 2.5, _0x1d857f.scale / 1.7);
              _0x33b930(_0x3cb5bb * Math.cos(_0x4c977d * _0x39fb37), _0x3cb5bb * Math.sin(_0x4c977d * _0x39fb37), _0x4a052b.randInt(4, 5), _0x459ab9, true);
            }
          } else {
            if (_0x1d857f.name == "cheese") {
              _0x459ab9.fillStyle = "#f4f3ac";
              if (minecraft) {
                _0x4c4e74(0, 0, _0x1d857f.scale * (Math.PI / 2), _0x1d857f.scale * (Math.PI / 2), _0x459ab9);
              } else {
                _0x33b930(0, 0, _0x1d857f.scale, _0x459ab9);
              }
              _0x459ab9.fillStyle = "#c3c28b";
              var _0x1812b0 = 4;
              var _0x4c977d = _0x27c20d / _0x1812b0;
              var _0x3cb5bb;
              for (var _0x39fb37 = 0; _0x39fb37 < _0x1812b0; ++_0x39fb37) {
                _0x3cb5bb = _0x4a052b.randInt(_0x1d857f.scale / 2.5, _0x1d857f.scale / 1.7);
                _0x33b930(_0x3cb5bb * Math.cos(_0x4c977d * _0x39fb37), _0x3cb5bb * Math.sin(_0x4c977d * _0x39fb37), _0x4a052b.randInt(4, 5), _0x459ab9, true);
              }
            } else {
              if (_0x1d857f.name == "wood wall" || _0x1d857f.name == "stone wall" || _0x1d857f.name == "castle wall") {
                _0x459ab9.fillStyle = _0x1d857f.name == "castle wall" ? "#83898e" : _0x1d857f.name == "wood wall" ? "#a5974c" : "#939393";
                var _0x1befd4 = _0x1d857f.name == "castle wall" ? 4 : 3;
                if (minecraft) {
                  _0x4c4e74(0, 0, _0x1d857f.scale * (Math.PI / 2) * 1.1, _0x1d857f.scale * (Math.PI / 2) * 1.1, _0x459ab9);
                } else {
                  _0x330052(_0x459ab9, _0x1befd4, _0x1d857f.scale * 1.1, _0x1d857f.scale * 1.1);
                }
                _0x459ab9.fill();
                _0x459ab9.stroke();
                _0x459ab9.fillStyle = _0x1d857f.name == "castle wall" ? "#9da4aa" : _0x1d857f.name == "wood wall" ? "#c9b758" : "#bcbcbc";
                minecraft ? _0x4c4e74(0, 0, _0x1d857f.scale * (Math.PI / 2) * 0.65, _0x1d857f.scale * (Math.PI / 2) * 0.65, _0x459ab9) : _0x330052(_0x459ab9, _0x1befd4, _0x1d857f.scale * 0.65, _0x1d857f.scale * 0.65);
                _0x459ab9.fill();
              } else {
                if (_0x1d857f.name == "spikes" || _0x1d857f.name == "greater spikes" || _0x1d857f.name == "poison spikes" || _0x1d857f.name == "spinning spikes") {
                  _0x459ab9.fillStyle = _0x1d857f.name == "poison spikes" ? "#7b935d" : "#939393";
                  var _0x1825c3 = _0x1d857f.scale * 0.6;
                  _0x330052(_0x459ab9, _0x1d857f.name == "spikes" ? 5 : 6, _0x1d857f.scale, _0x1825c3);
                  _0x459ab9.fill();
                  _0x459ab9.stroke();
                  _0x459ab9.fillStyle = "#a5974c";
                  minecraft ? _0x4c4e74(0, 0, _0x1825c3 * (Math.PI / (Math.PI / 2)), _0x1825c3 * (Math.PI / (Math.PI / 2)), _0x459ab9) : _0x33b930(0, 0, _0x1825c3, _0x459ab9);
                  if (_0x2c6f82 && _0x1d857f.owner && _0x2c6f82.sid != _0x1d857f.owner.sid && !_0x1af301(_0x1d857f.owner.sid)) {
                    _0x459ab9.fillStyle = "#c9b758";
                  } else {
                    _0x459ab9.fillStyle = "#c9b758";
                  }
                  minecraft ? _0x4c4e74(0, 0, _0x1825c3 * (Math.PI / (Math.PI / 2)) * 0.65, _0x1825c3 * (Math.PI / (Math.PI / 2)) * 0.65, _0x459ab9) : _0x33b930(0, 0, _0x1825c3 / 2, _0x459ab9, true);
                } else {
                  if (_0x1d857f.name == "windmill" || _0x1d857f.name == "faster windmill" || _0x1d857f.name == "power mill") {
                    _0x459ab9.fillStyle = "#a5974c";
                    if (minecraft) {
                      _0x4c4e74(0, 0, _0x1d857f.scale * (Math.PI / 2), _0x1d857f.scale * (Math.PI / 2), _0x459ab9);
                    } else {
                      _0x33b930(0, 0, _0x1d857f.scale, _0x459ab9);
                    }
                    _0x459ab9.fillStyle = "#c9b758";
                    _0x5044b7(0, 0, _0x1d857f.scale * 1.5, 29, 4, _0x459ab9);
                    _0x459ab9.fillStyle = "#a5974c";
                    if (minecraft) {
                      _0x4c4e74(0, 0, _0x1d857f.scale * (Math.PI / 2) * 0.5, _0x1d857f.scale * (Math.PI / 2) * 0.5, _0x459ab9);
                    } else {
                      _0x33b930(0, 0, _0x1d857f.scale * 0.5, _0x459ab9);
                    }
                  } else {
                    if (_0x1d857f.name == "mine") {
                      _0x459ab9.fillStyle = "#939393";
                      if (minecraft) {
                        _0x4c4e74(0, 0, _0x1d857f.scale * (Math.PI / 2), _0x1d857f.scale * (Math.PI / 2), _0x459ab9);
                      } else {
                        _0x330052(_0x459ab9, 3, _0x1d857f.scale, _0x1d857f.scale);
                      }
                      _0x459ab9.fill();
                      _0x459ab9.stroke();
                      _0x459ab9.fillStyle = "#bcbcbc";
                      minecraft ? _0x4c4e74(0, 0, _0x1d857f.scale * (Math.PI / 2) * 0.55, _0x1d857f.scale * (Math.PI / 2) * 0.55, _0x459ab9) : _0x330052(_0x459ab9, 3, _0x1d857f.scale * 0.55, _0x1d857f.scale * 0.65);
                      _0x459ab9.fill();
                    } else {
                      if (_0x1d857f.name == "sapling") {
                        for (var _0x39fb37 = 0; _0x39fb37 < 2; ++_0x39fb37) {
                          var _0x1825c3 = _0x1d857f.scale * (!_0x39fb37 ? 1 : 0.5);
                          if (minecraft) {
                            _0x4c4e74(0, 0, _0x1825c3 * (Math.PI / 2), _0x1825c3 * (Math.PI / 2), _0x459ab9);
                          } else {
                            _0x330052(_0x459ab9, 7, _0x1825c3, _0x1825c3 * 0.7);
                          }
                          _0x459ab9.fillStyle = !_0x39fb37 ? "#9ebf57" : "#b4db62";
                          _0x459ab9.fill();
                          if (!_0x39fb37) {
                            _0x459ab9.stroke();
                          }
                        }
                      } else {
                        if (_0x1d857f.name == "pit trap") {
                          _0x459ab9.fillStyle = "#a5974c";
                          _0x330052(_0x459ab9, 3, _0x1d857f.scale * 1.1, _0x1d857f.scale * 1.1);
                          _0x459ab9.fill();
                          _0x459ab9.stroke();
                          if (_0x2c6f82 && _0x1d857f.owner && _0x2c6f82.sid != _0x1d857f.owner.sid && !_0x1af301(_0x1d857f.owner.sid)) {
                            _0x459ab9.fillStyle = _0x36f304;
                          } else {
                            _0x459ab9.fillStyle = _0x36f304;
                          }
                          _0x330052(_0x459ab9, 3, _0x1d857f.scale * 0.65, _0x1d857f.scale * 0.65);
                          _0x459ab9.fill();
                        } else {
                          if (_0x1d857f.name == "boost pad") {
                            _0x459ab9.fillStyle = "#7e7f82";
                            _0x4c4e74(0, 0, _0x1d857f.scale * 2, _0x1d857f.scale * 2, _0x459ab9);
                            _0x459ab9.fill();
                            _0x459ab9.stroke();
                            _0x459ab9.fillStyle = "#dbd97d";
                            _0x562679(_0x1d857f.scale * 1, _0x459ab9);
                          } else {
                            if (_0x1d857f.name == "turret") {
                              _0x459ab9.fillStyle = "#a5974c";
                              _0x33b930(0, 0, _0x1d857f.scale, _0x459ab9);
                              _0x459ab9.fill();
                              _0x459ab9.stroke();
                              _0x459ab9.fillStyle = "#939393";
                              var _0x3366da = 50;
                              _0x4c4e74(0, -25, _0x1d857f.scale * 0.9, _0x3366da, _0x459ab9);
                              _0x33b930(0, 0, _0x1d857f.scale * 0.6, _0x459ab9);
                              _0x459ab9.fill();
                              _0x459ab9.stroke();
                            } else {
                              if (_0x1d857f.name == "platform") {
                                _0x459ab9.fillStyle = "#cebd5f";
                                var _0x1a1568 = 4;
                                var _0x55c03f = _0x1d857f.scale * 2;
                                var _0x450998 = _0x55c03f / _0x1a1568;
                                var _0x259eac = -(_0x1d857f.scale / 2);
                                for (var _0x39fb37 = 0; _0x39fb37 < _0x1a1568; ++_0x39fb37) {
                                  _0x4c4e74(_0x259eac - _0x450998 / 2, 0, _0x450998, _0x1d857f.scale * 2, _0x459ab9);
                                  _0x459ab9.fill();
                                  _0x459ab9.stroke();
                                  _0x259eac += _0x55c03f / _0x1a1568;
                                }
                              } else {
                                if (_0x1d857f.name == "healing pad") {
                                  _0x459ab9.fillStyle = "#7e7f82";
                                  _0x4c4e74(0, 0, _0x1d857f.scale * 2, _0x1d857f.scale * 2, _0x459ab9);
                                  _0x459ab9.fill();
                                  _0x459ab9.stroke();
                                  _0x459ab9.fillStyle = "#db6e6e";
                                  _0x5044b7(0, 0, _0x1d857f.scale * 0.65, 20, 4, _0x459ab9, true);
                                } else {
                                  if (_0x1d857f.name == "spawn pad") {
                                    _0x459ab9.fillStyle = "#7e7f82";
                                    _0x4c4e74(0, 0, _0x1d857f.scale * 2, _0x1d857f.scale * 2, _0x459ab9);
                                    _0x459ab9.fill();
                                    _0x459ab9.stroke();
                                    _0x459ab9.fillStyle = "#71aad6";
                                    _0x33b930(0, 0, _0x1d857f.scale * 0.6, _0x459ab9);
                                  } else {
                                    if (_0x1d857f.name == "blocker") {
                                      _0x459ab9.fillStyle = "#7e7f82";
                                      _0x33b930(0, 0, _0x1d857f.scale, _0x459ab9);
                                      _0x459ab9.fill();
                                      _0x459ab9.stroke();
                                      _0x459ab9.rotate(Math.PI / 4);
                                      _0x459ab9.fillStyle = "#db6e6e";
                                      _0x5044b7(0, 0, _0x1d857f.scale * 0.65, 20, 4, _0x459ab9, true);
                                    } else {
                                      if (_0x1d857f.name == "teleporter") {
                                        _0x459ab9.fillStyle = "#7e7f82";
                                        _0x33b930(0, 0, _0x1d857f.scale, _0x459ab9);
                                        _0x459ab9.fill();
                                        _0x459ab9.stroke();
                                        _0x459ab9.rotate(Math.PI / 4);
                                        _0x459ab9.fillStyle = "#d76edb";
                                        _0x33b930(0, 0, _0x1d857f.scale * 0.5, _0x459ab9, true);
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        _0xcc116c = _0x35d29f;
        if (!_0x1c504d) {
          _0x4fbde6[_0x1d857f.id] = _0xcc116c;
        }
      }
      return _0xcc116c;
    }
    function _0x9b12b8(_0x590817, _0x3c5a18, _0x4b6aca, _0x1cc64f, _0x4c7ef9) {
      var _0x7ea264 = _0x590817 + _0x4b6aca * Math.cos(_0x1cc64f);
      var _0x40e7a5 = _0x3c5a18 + _0x4b6aca * Math.sin(_0x1cc64f);
      var _0x111529 = _0x4b6aca * 0.4;
      _0x4c7ef9.moveTo(_0x590817, _0x3c5a18);
      _0x4c7ef9.beginPath();
      _0x4c7ef9.quadraticCurveTo((_0x590817 + _0x7ea264) / 2 + _0x111529 * Math.cos(_0x1cc64f + Math.PI / 2), (_0x3c5a18 + _0x40e7a5) / 2 + _0x111529 * Math.sin(_0x1cc64f + Math.PI / 2), _0x7ea264, _0x40e7a5);
      _0x4c7ef9.quadraticCurveTo((_0x590817 + _0x7ea264) / 2 - _0x111529 * Math.cos(_0x1cc64f + Math.PI / 2), (_0x3c5a18 + _0x40e7a5) / 2 - _0x111529 * Math.sin(_0x1cc64f + Math.PI / 2), _0x590817, _0x3c5a18);
      _0x4c7ef9.closePath();
      _0x4c7ef9.fill();
      _0x4c7ef9.stroke();
    }
    function _0x33b930(_0x4f8277, _0x2acae7, _0x3a4423, _0x480426, _0x2996ec, _0x414c9d) {
      _0x480426 = _0x480426 || _0xce3328;
      _0x480426.beginPath();
      _0x480426.arc(_0x4f8277, _0x2acae7, _0x3a4423, 0, 2 * Math.PI);
      if (!_0x414c9d) {
        _0x480426.fill();
      }
      if (!_0x2996ec) {
        _0x480426.stroke();
      }
    }
    function _0x330052(_0x578c51, _0xe07fbf, _0x33b1d9, _0x1de881) {
      var _0x16f1a5 = Math.PI / 2 * 3;
      var _0x2948e2;
      var _0xbedfee;
      var _0x50221d = Math.PI / _0xe07fbf;
      _0x578c51.beginPath();
      _0x578c51.moveTo(0, -_0x33b1d9);
      for (var _0x4e94be = 0; _0x4e94be < _0xe07fbf; _0x4e94be++) {
        _0x2948e2 = Math.cos(_0x16f1a5) * _0x33b1d9;
        _0xbedfee = Math.sin(_0x16f1a5) * _0x33b1d9;
        _0x578c51.lineTo(_0x2948e2, _0xbedfee);
        _0x16f1a5 += _0x50221d;
        _0x2948e2 = Math.cos(_0x16f1a5) * _0x1de881;
        _0xbedfee = Math.sin(_0x16f1a5) * _0x1de881;
        _0x578c51.lineTo(_0x2948e2, _0xbedfee);
        _0x16f1a5 += _0x50221d;
      }
      _0x578c51.lineTo(0, -_0x33b1d9);
      _0x578c51.closePath();
    }
    function _0x4c4e74(_0x31f4cc, _0x51ad48, _0x1b1516, _0x35b48c, _0x513b0a, _0x566d90) {
      _0x513b0a.fillRect(_0x31f4cc - _0x1b1516 / 2, _0x51ad48 - _0x35b48c / 2, _0x1b1516, _0x35b48c);
      if (!_0x566d90) {
        _0x513b0a.strokeRect(_0x31f4cc - _0x1b1516 / 2, _0x51ad48 - _0x35b48c / 2, _0x1b1516, _0x35b48c);
      }
    }
    function _0x5044b7(_0x452f8f, _0x395c68, _0x46cb54, _0x3a8361, _0x2dd37f, _0x1e96d2, _0x232cd9) {
      _0x1e96d2.save();
      _0x1e96d2.translate(_0x452f8f, _0x395c68);
      _0x2dd37f = Math.ceil(_0x2dd37f / 2);
      for (var _0x138ace = 0; _0x138ace < _0x2dd37f; _0x138ace++) {
        _0x4c4e74(0, 0, _0x46cb54 * 2, _0x3a8361, _0x1e96d2, _0x232cd9), _0x1e96d2.rotate(Math.PI / _0x2dd37f);
      }
      _0x1e96d2.restore();
    }
    function _0x1f7c09(_0x51f142, _0x24a23f, _0x4ea7cc, _0x3bfa8b) {
      var _0x2d748a = Math.PI / 2 * 3;
      var _0x3d4341;
      var _0x43206d;
      var _0x4f7346 = Math.PI / _0x24a23f;
      var _0x46d324;
      _0x51f142.beginPath();
      _0x51f142.moveTo(0, -_0x3bfa8b);
      for (var _0x4c186e = 0; _0x4c186e < _0x24a23f; _0x4c186e++) {
        _0x46d324 = _0x4a052b.randInt(_0x4ea7cc + 0.9, _0x4ea7cc * 1.2), _0x51f142.quadraticCurveTo(Math.cos(_0x2d748a + _0x4f7346) * _0x46d324, Math.sin(_0x2d748a + _0x4f7346) * _0x46d324, Math.cos(_0x2d748a + _0x4f7346 * 2) * _0x3bfa8b, Math.sin(_0x2d748a + _0x4f7346 * 2) * _0x3bfa8b), _0x2d748a += _0x4f7346 * 2;
      }
      _0x51f142.lineTo(0, -_0x3bfa8b);
      _0x51f142.closePath();
    }
    function _0x562679(_0x5b1745, _0x1f0537) {
      _0x1f0537 = _0x1f0537 || _0xce3328;
      var _0x35f3fb = _0x5b1745 * 0.8660254037844386;
      _0x1f0537.beginPath();
      _0x1f0537.moveTo(0, -_0x35f3fb / 2);
      _0x1f0537.lineTo(-_0x5b1745 / 2, _0x35f3fb / 2);
      _0x1f0537.lineTo(_0x5b1745 / 2, _0x35f3fb / 2);
      _0x1f0537.lineTo(0, -_0x35f3fb / 2);
      _0x1f0537.fill();
      _0x1f0537.closePath();
    }
    function _0x166242() {
      var _0xb801f7 = _0x1052c8.mapScale / 2;
      let _0x3eab0c = 0;
      _0x1a4d70.add(0, _0xb801f7, _0xb801f7 + 200, 0, _0x1052c8.treeScales[3], 0);
      _0x1a4d70.add(1, _0xb801f7, _0xb801f7 - 480, 0, _0x1052c8.treeScales[3], 0);
      _0x1a4d70.add(2, _0xb801f7 + 300, _0xb801f7 + 450, 0, _0x1052c8.treeScales[3], 0);
      _0x1a4d70.add(3, _0xb801f7 - 950, _0xb801f7 - 130, 0, _0x1052c8.treeScales[2], 0);
      _0x1a4d70.add(4, _0xb801f7 - 750, _0xb801f7 - 400, 0, _0x1052c8.treeScales[3], 0);
      _0x1a4d70.add(5, _0xb801f7 - 700, _0xb801f7 + 400, 0, _0x1052c8.treeScales[2], 0);
      _0x1a4d70.add(6, _0xb801f7 + 800, _0xb801f7 - 200, 0, _0x1052c8.treeScales[3], 0);
      _0x1a4d70.add(7, _0xb801f7 - 260, _0xb801f7 + 340, 0, _0x1052c8.bushScales[3], 1);
      _0x1a4d70.add(8, _0xb801f7 + 760, _0xb801f7 + 310, 0, _0x1052c8.bushScales[3], 1);
      _0x1a4d70.add(9, _0xb801f7 - 800, _0xb801f7 + 100, 0, _0x1052c8.bushScales[3], 1);
      _0x1a4d70.add(10, _0xb801f7 - 800, _0xb801f7 + 300, 0, _0x34ff74.list[4].scale, _0x34ff74.list[4].id, _0x34ff74.list[10]);
      _0x1a4d70.add(11, _0xb801f7 + 650, _0xb801f7 - 390, 0, _0x34ff74.list[4].scale, _0x34ff74.list[4].id, _0x34ff74.list[10]);
      _0x1a4d70.add(12, _0xb801f7 - 400, _0xb801f7 - 450, 0, _0x1052c8.rockScales[2], 2);
    }
    function _0x274eda(_0xd0d63e, _0x1a4503) {
      _0x5e40db = Math.atan2(_0x1a4503 - _0x2c6f82.y2, _0xd0d63e - _0x2c6f82.x2);
      if (_0x5e1af5.length && _0x1ad2a2(_0xb04feb, _0x2c6f82) <= 250) {
        for (let _0x454aff = -45; _0x454aff <= 45; _0x454aff += 90) {
          _0x59f82f(2, _0x5e40db + _0x35ab04(_0x454aff) + Math.PI);
        }
      } else {
        for (let _0x58e61c = -45; _0x58e61c <= 45; _0x58e61c += 90) {
          _0x59f82f(1, _0x5e40db + _0x35ab04(_0x58e61c) + Math.PI);
        }
      }
    }
    var _0x1db1ef = [];
    function _0x151524(_0x564297) {
      for (var _0x42cb3d = 0; _0x42cb3d < _0x564297.length;) {
        _0x1a4d70.add(_0x564297[_0x42cb3d], _0x564297[_0x42cb3d + 1], _0x564297[_0x42cb3d + 2], _0x564297[_0x42cb3d + 3], _0x564297[_0x42cb3d + 4], _0x564297[_0x42cb3d + 5], _0x34ff74.list[_0x564297[_0x42cb3d + 6]], true, _0x564297[_0x42cb3d + 7] >= 0 ? {
          sid: _0x564297[_0x42cb3d + 7]
        } : null);
        if (_0x564297[_0x42cb3d + 6] == 15 && Math.hypot(_0x564297[_0x42cb3d + 2] - _0x2c6f82.y2, _0x564297[_0x42cb3d + 1] - _0x2c6f82.x2) <= 85 && _0x2c6f82.sid != _0x564297[_0x42cb3d + 7] && !_0x1af301(_0x564297[_0x42cb3d + 7])) {
          _0x274eda(_0x564297[_0x42cb3d + 1], _0x564297[_0x42cb3d + 2]);
        }
        _0x564297[_0x42cb3d + 7] && _0x564297[_0x42cb3d + 6] && (_0x34ff74.list[_0x564297[_0x42cb3d + 6]].dmg || _0x34ff74.list[_0x564297[_0x42cb3d + 6]].trap || _0x34ff74.list[_0x564297[_0x42cb3d + 6]].teleport) && _0x2c6f82.sid == _0x564297[_0x42cb3d + 7] && _0x1db1ef.push(_0x564297);
        _0x42cb3d += 8;
      }
    }
    function _0x1cf399(_0x4efc2a, _0x4fef16) {
      _0x48c073 = _0x5d58c5(_0x4fef16);
      if (_0x48c073) {
        _0x48c073.xWiggle += _0x1052c8.gatherWiggle * Math.cos(_0x4efc2a);
        _0x48c073.yWiggle += _0x1052c8.gatherWiggle * Math.sin(_0x4efc2a);
      }
    }
    function _0x4c3e4e(_0x4bd8c6, _0xb78a78) {
      _0x48c073 = _0x5d58c5(_0x4bd8c6);
      if (_0x48c073) {
        _0x48c073.dir = _0xb78a78;
        _0x48c073.xWiggle += _0x1052c8.gatherWiggle * Math.cos(_0xb78a78 + Math.PI);
        _0x48c073.yWiggle += _0x1052c8.gatherWiggle * Math.sin(_0xb78a78 + Math.PI);
      }
    }
    function _0x449319(_0x9e17aa, _0x510401, _0x58c48d, _0x72600a, _0x3f981e, _0x106ddd, _0x37cc2a, _0x5d11a3) {
      let _0x303d39 = _0x106ddd == 0 ? 9 : _0x106ddd == 2 ? 12 : _0x106ddd == 3 ? 13 : _0x106ddd == 5 && 15;
      let _0x505721 = _0x2c6f82.scale * 2;
      if (_0x24e997) {
        _0x5eddd3.addProjectile(_0x9e17aa, _0x510401, _0x58c48d, _0x72600a, _0x3f981e, _0x106ddd, null, null, _0x37cc2a).sid = _0x5d11a3;
      }
    }
    function _0x5b43b8(_0x1e80ff, _0x2e2c72) {
      for (var _0x1fb8d1 = 0; _0x1fb8d1 < _0x6d2acb.length; ++_0x1fb8d1) {
        if (_0x6d2acb[_0x1fb8d1].sid == _0x1e80ff) {
          _0x6d2acb[_0x1fb8d1].range = _0x2e2c72;
        }
      }
    }
    function _0x265b66(_0x415075) {
      _0x48c073 = _0x38d2f1(_0x415075);
      if (_0x48c073) {
        _0x48c073.startAnim();
      }
    }
    function _0x59442f(_0x301f07) {
      for (var _0x51c375 = 0; _0x51c375 < _0x4c7cec.length; ++_0x51c375) {
        _0x4c7cec[_0x51c375].forcePos = !_0x4c7cec[_0x51c375].visible;
        _0x4c7cec[_0x51c375].visible = false;
      }
      if (_0x301f07) {
        var _0x718b4f = Date.now();
        for (var _0x51c375 = 0; _0x51c375 < _0x301f07.length;) {
          _0x48c073 = _0x38d2f1(_0x301f07[_0x51c375]);
          if (_0x48c073) {
            _0x48c073.index = _0x301f07[_0x51c375 + 1];
            _0x48c073.t1 = _0x48c073.t2 === undefined ? _0x718b4f : _0x48c073.t2;
            _0x48c073.t2 = _0x718b4f;
            _0x48c073.x1 = _0x48c073.x;
            _0x48c073.y1 = _0x48c073.y;
            _0x48c073.x2 = _0x301f07[_0x51c375 + 2];
            _0x48c073.y2 = _0x301f07[_0x51c375 + 3];
            _0x48c073.d1 = _0x48c073.d2 === undefined ? _0x301f07[_0x51c375 + 4] : _0x48c073.d2;
            _0x48c073.d2 = _0x301f07[_0x51c375 + 4];
            _0x48c073.health = _0x301f07[_0x51c375 + 5];
            _0x48c073.dt = 0;
            _0x48c073.visible = true;
          } else {
            _0x48c073 = _0xee4ba9.spawn(_0x301f07[_0x51c375 + 2], _0x301f07[_0x51c375 + 3], _0x301f07[_0x51c375 + 4], _0x301f07[_0x51c375 + 1]);
            _0x48c073.x2 = _0x48c073.x;
            _0x48c073.y2 = _0x48c073.y;
            _0x48c073.d2 = _0x48c073.dir;
            _0x48c073.health = _0x301f07[_0x51c375 + 5];
            if (!_0xee4ba9.aiTypes[_0x301f07[_0x51c375 + 1]].name) {
              _0x48c073.name = _0x1052c8.cowNames[_0x301f07[_0x51c375 + 6]];
            }
            _0x48c073.forcePos = true;
            _0x48c073.sid = _0x301f07[_0x51c375];
            _0x48c073.visible = true;
          }
          _0x51c375 += 7;
        }
      }
    }
    function _0x4f6d8c(_0x51e655, _0x36d5a3) {
      return Math.hypot(_0x51e655.y - _0x36d5a3.y, _0x51e655.x - _0x36d5a3.x);
    }
    function _0x1ad2a2(_0x47d34b, _0xabbce6) {
      return Math.hypot(_0x47d34b.y2 - _0xabbce6.y2, _0x47d34b.x2 - _0xabbce6.x2);
    }
    function _0x405b5b(_0x50ab10, _0x3b560d) {
      return Math.atan2(_0x50ab10.y - _0x3b560d.y, _0x50ab10.x - _0x3b560d.x);
    }
    function _0x4d6c19(_0x58712a, _0x17e780) {
      return Math.atan2(_0x58712a.y2 - _0x17e780.y2, _0x58712a.x2 - _0x17e780.x2);
    }
    var _0x356eec = {};
    function _0x5ee6aa(_0x54177d, _0x3cb0ea) {
      var _0x1bff43 = _0x54177d.index;
      var _0x5a4585 = _0x356eec[_0x1bff43];
      if (!_0x5a4585) {
        var _0x34bdd7 = new Image();
        _0x34bdd7.onload = function () {
          this.isLoaded = true;
          this.onload = null;
        };
        _0x34bdd7.src = ".././img/animals/" + _0x54177d.src + ".png";
        _0x5a4585 = _0x34bdd7;
        _0x356eec[_0x1bff43] = _0x5a4585;
      }
      if (_0x5a4585.isLoaded) {
        var _0x2283d6 = _0x54177d.scale * 1.2 * (_0x54177d.spriteMlt || 1);
        _0x3cb0ea.drawImage(_0x5a4585, -_0x2283d6, -_0x2283d6, _0x2283d6 * 2, _0x2283d6 * 2);
      }
    }
    function _0x2de10f(_0x42514f, _0x1fb3ec, _0x2e971d) {
      return _0x42514f + _0x2e971d >= 0 && _0x42514f - _0x2e971d <= _0xfa8e22 && _0x1fb3ec + _0x2e971d >= 0 && _0x1fb3ec - _0x2e971d <= _0x207741;
    }
    var _0x3dce21 = {
      x2: 0x0,
      y2: 0x0
    };
    var _0xafcc8a = {
      x2: 0x0,
      y2: 0x0
    };
    var _0x116a65 = {
      sid: undefined,
      hitCount: 0x0
    };
    var _0x1ca37c = _0x116a65;
    var _0x499306 = 0;
    var _0x6ca58e = false;
    var _0x2e7a61 = false;
    var _0x33b253 = false;
    var _0x5e40db = 0;
    var _0x15641f = false;
    var _0x255d64 = false;
    var _0x4c6a38 = 0;
    var _0x36ec3b = 0;
    var _0x405841 = false;
    var _0x33d522 = false;
    var _0x49ed08 = 21;
    var _0x2df32f = true;
    var _0x314e30 = false;
    function _0x1a4abc(_0x3cf235, _0x2ccf93) {
      var _0x22abef = _0x5af7c0(_0x3cf235[0]);
      if (!_0x22abef) {
        _0x22abef = new _0x4364e4(_0x3cf235[0], _0x3cf235[1], _0x1052c8, _0x4a052b, _0x5eddd3, _0x1a4d70, _0xe6cd1d, _0x4c7cec, _0x34ff74, _0x2ecb5e, _0x1bbb87);
        _0xe6cd1d.push(_0x22abef);
      }
      _0x22abef.spawn(_0x2ccf93 ? _0x2a7dfd : null);
      _0x22abef.visible = false;
      _0x22abef.x2 = undefined;
      _0x22abef.y2 = undefined;
      _0x22abef.pR = 1;
      _0x22abef.sR = 1;
      _0x22abef.tR = 1;
      _0x22abef.primaryIndex = 0;
      _0x22abef.secondaryIndex = 0;
      _0x22abef.primaryVariant = 0;
      _0x22abef.secondaryVariant = 0;
      _0x22abef.setData(_0x3cf235);
      if (_0x2ccf93) {
        _0x2c6f82 = _0x22abef;
        _0x376363 = _0x2c6f82.x;
        _0x174296 = _0x2c6f82.y;
        _0xe32733();
        _0x26b0bc();
        _0x246259();
        _0x428306(0);
        _0x5a888a.style.display = "block";
      }
    }
    function _0x415cbf(_0x24edc5) {
      for (var _0x37aa6f = 0; _0x37aa6f < _0xe6cd1d.length; _0x37aa6f++) {
        if (_0xe6cd1d[_0x37aa6f].id == _0x24edc5) {
          _0xe6cd1d.splice(_0x37aa6f, 1);
          break;
        }
      }
    }
    var _0x357771 = [0, 3, 6, 10];
    function _0x4bf482(_0x144994, _0x43a559) {
      if (_0x2c6f82) {
        _0x2c6f82.itemCounts[_0x144994] = _0x43a559;
      }
    }
    function _0x71ab7d(_0x2d505a, _0xc25c1a, _0x1c5739) {
      if (_0x2c6f82) {
        _0x2c6f82[_0x2d505a] = _0xc25c1a;
        if (_0x1c5739) {
          _0x26b0bc();
        }
      }
    }
    var _0x561a2e = false;
    function _0x24b6be(_0x4697cc, _0x587778) {
      _0x48c073 = _0x54663(_0x4697cc);
      if (_0x48c073) {
        let _0x5dc38a = _0x587778 - _0x48c073.health;
        if (_0x5dc38a > 0) {
          if (_0x48c073.hitTime) {
            let _0x3fdcd7 = Date.now() - _0x48c073.hitTime;
            _0x48c073.hitTime = 0;
            if (_0x3fdcd7 <= 120) {
              _0x48c073.shameCount++;
              _0x48c073.shameCount >= 8 && (_0x48c073.shameCount = 5);
            } else {
              _0x48c073.shameCount -= 2;
              if (_0x48c073.shameCount <= 0) {
                _0x48c073.shameCount = 0;
              }
            }
          }
        } else {
          if (_0x5dc38a < 0) {
            _0x48c073.hitTime = Date.now();
            if (_0x48c073 == _0x2c6f82) {
              if (_0x2c6f82.skinIndex == 7 && (_0x5dc38a == -5 || _0x2c6f82.tailIndex == 13 && _0x5dc38a == -2)) {
                _0x36ec3b = _0x14f8c0;
                _0x937041 = false;
              }
              let _0x50906d = _0x5e1af5.length && (_0xb04feb.secondaryIndex == 10 || _0xb04feb.secondaryIndex == 11 || _0xb04feb.secondaryIndex == 14) ? true : false;
              let _0x765381 = _0x5e1af5.length && (_0xb04feb.secondaryIndex == 9 || _0xb04feb.secondaryIndex == 12 || _0xb04feb.secondaryIndex == 13 || _0xb04feb.secondaryIndex == 15) ? true : false;
              if (_0x50906d ? _0x5dc38a < -9 && _0x2c6f82.skinIndex != 6 && _0x1ad2a2(_0xb04feb, _0x2c6f82) <= 300 && _0xb04feb.pR == 1 : _0x5dc38a < (_0x2c6f82.skinIndex == 6 ? -31 : -25) && _0x1ad2a2(_0xb04feb, _0x2c6f82) <= 300 && _0x5e1af5.length && _0xb04feb.pR == 1) {
                if (_0x2c6f82.shameCount < 5) {
                  for (let _0x2f9ced = 0; _0x2f9ced < _0x37845d(_0x5dc38a); _0x2f9ced++) {
                    _0x27f535(0, _0x2541d9());
                  }
                } else {
                  _0xd8099b(() => {
                    for (var _0x3554ad = 0; _0x3554ad < _0x37845d(_0x5dc38a); _0x3554ad++) {
                      _0x27f535(0, _0x2541d9());
                    }
                  }, 2);
                }
              } else {
                _0xd8099b(() => {
                  for (var _0x3ebb20 = 0; _0x3ebb20 < _0x37845d(_0x5dc38a); _0x3ebb20++) {
                    _0x27f535(0, _0x2541d9());
                  }
                }, 2);
              }
            }
          }
        }
        if (_0x48c073 != _0x2c6f82) {
          if (_0x5dc38a > 0) {
            if (_0x561a2e) {
              _0x40c2fb.showText(_0x48c073.x, _0x48c073.y, 50, 0.18, 500, Math.abs(Math.round(_0x5dc38a)), "#8ecc51");
            }
          }
        }
        _0x48c073.health = _0x587778;
      }
    }
    function _0x37845d(_0x271abe) {
      let _0x2adf70 = _0x271abe;
      if (_0x2c6f82.skinIndex != 45 && _0x2c6f82.skinIndex != 56) {
        if (0 == _0x2c6f82.items[0]) {
          if (_0x2adf70 < -80) {
            return 5;
          } else {
            if (_0x2adf70 < -60) {
              return 4;
            } else {
              if (_0x2adf70 < -40) {
                return 3;
              } else {
                if (_0x2adf70 < -20) {
                  return 2;
                } else {
                  return 1;
                }
              }
            }
          }
        } else {
          if (1 == _0x2c6f82.items[0]) {
            if (_0x2adf70 < -80) {
              return 3;
            } else {
              if (_0x2adf70 < -40) {
                return 2;
              } else {
                return 1;
              }
            }
          } else {
            if (2 == _0x2c6f82.items[0]) {
              if (_0x2adf70 < -90) {
                return 4;
              } else {
                if (_0x2adf70 < -60) {
                  return 3;
                } else {
                  if (_0x2adf70 < -30) {
                    return 2;
                  } else {
                    return 1;
                  }
                }
              }
            } else {
              return 4;
            }
          }
        }
      } else {
        return 0;
      }
    }
    function _0x35ab04(_0x3329d9) {
      return _0x3329d9 * (Math.PI / 180);
    }
    function _0x4ca537(_0x68cdd6) {
      return _0x68cdd6 / (Math.PI / 180);
    }
    function _0x27f535(_0x486b22, _0x427108) {
      var _0x206ad3 = _0x34ff74.list[_0x2c6f82.items[_0x486b22]];
      if (_0x2c6f82.itemCounts[_0x206ad3.group.id] == undefined ? true : _0x2c6f82.itemCounts[_0x206ad3.group.id] < (_0x1052c8.isSandbox ? 99 : _0x206ad3.group.limit ? _0x206ad3.group.limit : 99)) {
        _0x389917(_0x2c6f82.items[_0x486b22]);
        _0x32027d.send('c', 1, _0x427108);
        _0x389917(_0x499306, true);
      }
    }
    function _0x59f82f(_0x2d0466, _0x3bfedb) {
      var _0x4cf593 = _0x34ff74.list[_0x2c6f82.items[_0x2d0466]];
      var _0x25a480 = _0x2c6f82.scale + _0x4cf593.scale + (_0x4cf593.placeOffset || 0);
      var _0x15736e = _0x2c6f82.x + _0x25a480 * Math.cos(_0x3bfedb);
      var _0x55b1c0 = _0x2c6f82.y + _0x25a480 * Math.sin(_0x3bfedb);
      if (_0x1a4d70.checkItemLocation(_0x15736e, _0x55b1c0, _0x4cf593.scale, 0.6, _0x4cf593.id, false, _0x2c6f82)) {
        if (_0x4cf593 && _0x2c6f82.itemCounts[_0x4cf593.group.id] == undefined ? true : _0x2c6f82.itemCounts[_0x4cf593.group.id] < (_0x1052c8.isSandbox ? 99 : _0x4cf593.group.limit ? _0x4cf593.group.limit : 99)) {
          _0x389917(_0x2c6f82.items[_0x2d0466]);
          _0x32027d.send('c', 1, _0x3bfedb);
          _0x389917(_0x499306, true);
          _0x29c0aa = _0x3bfedb;
          _0x5bb3b5++;
          _0xd8099b(() => {
            _0x5bb3b5--;
          }, 1);
        }
      }
    }
    var _0x5e1af5 = [];
    var _0xb04feb = [];
    var _0x11b3cf = 0;
    var _0x14f8c0 = 0;
    var _0x8a98e6 = [];
    var _0x1cfd78 = false;
    var _0x35254c = 18;
    var _0x46b815 = false;
    function _0x267d86(_0x454dd6) {
      if (_0x454dd6 == '1') {} else {}
    }
    var _0x54ab41 = false;
    function _0x1bef36(_0x50d0ef) {
      _0x5e1af5 = [];
      _0xb04feb = [];
      _0x11b3cf = 0;
      _0x14f8c0++;
      var _0x3288b6 = Date.now();
      for (var _0x14b592 = 0; _0x14b592 < _0xe6cd1d.length; ++_0x14b592) {
        _0xe6cd1d[_0x14b592].forcePos = !_0xe6cd1d[_0x14b592].visible;
        _0xe6cd1d[_0x14b592].visible = false;
      }
      for (var _0x14b592 = 0; _0x14b592 < _0x50d0ef.length;) {
        _0x48c073 = _0x54663(_0x50d0ef[_0x14b592]);
        if (_0x48c073) {
          _0x48c073.t1 = _0x48c073.t2 === undefined ? _0x3288b6 : _0x48c073.t2;
          _0x48c073.t2 = _0x3288b6;
          _0x48c073.x1 = _0x48c073.x;
          _0x48c073.y1 = _0x48c073.y;
          _0x48c073.x2 = _0x50d0ef[_0x14b592 + 1];
          _0x48c073.y2 = _0x50d0ef[_0x14b592 + 2];
          _0x48c073.d1 = _0x48c073.d2 === undefined ? _0x50d0ef[_0x14b592 + 3] : _0x48c073.d2;
          _0x48c073.d2 = _0x50d0ef[_0x14b592 + 3];
          _0x48c073.dt = 0;
          _0x48c073.buildIndex = _0x50d0ef[_0x14b592 + 4];
          _0x48c073.weaponIndex = _0x50d0ef[_0x14b592 + 5];
          _0x48c073.weaponVariant = _0x50d0ef[_0x14b592 + 6];
          _0x48c073.team = _0x50d0ef[_0x14b592 + 7];
          _0x48c073.isLeader = _0x50d0ef[_0x14b592 + 8];
          _0x48c073.skinIndex = _0x50d0ef[_0x14b592 + 9];
          _0x48c073.tailIndex = _0x50d0ef[_0x14b592 + 10];
          _0x48c073.iconIndex = _0x50d0ef[_0x14b592 + 11];
          _0x48c073.zIndex = _0x50d0ef[_0x14b592 + 12];
          _0x48c073.visible = true;
          !(_0x48c073 == _0x2c6f82 || _0x48c073.team && _0x48c073.team == _0x2c6f82.team) && _0x5e1af5.push(_0x48c073);
          _0x3bf04e(_0x48c073);
        }
        _0x14b592 += 13;
      }
      if (!_0xae7142) {
        _0x1dffdc += 0.0001;
      } else {
        if (_0xae7142) {
          _0x1dffdc < 0.35 && (_0xae7142 = false);
          _0x1dffdc -= 0.00015;
        }
      }
      if (_0x1dffdc > 0.55) {
        _0xae7142 = true;
      }
      if (_0x14f8c0 % 36 === 0) {
        _0x35254c = window.pingTime;
      }
      _0x1cfd78 = _0x2c6f82.weapons[1] == 10 ? true : false;
      if (_0x5e1af5.length) {
        _0xb04feb = _0x5e1af5.sort(function (_0x20e64b, _0x4ffc0e) {
          return _0x1ad2a2(_0x20e64b, _0x2c6f82) - _0x1ad2a2(_0x4ffc0e, _0x2c6f82);
        })[0];
      }
      _0x11b3cf = _0x5e1af5.length ? _0x4d6c19(_0xb04feb, _0x2c6f82) : _0x2541d9();
      let _0x2be5a2 = function (_0x1b62bb, _0x4ddd08) {
        let _0x38e0e1 = Math.abs(_0x4ddd08 - _0x1b62bb) % (Math.PI * 2);
        return _0x38e0e1 > Math.PI ? Math.PI * 2 - _0x38e0e1 : _0x38e0e1;
      };
      _0x46b815 = _0xb04feb.weaponIndex == 11 && _0x2be5a2(_0x4d6c19(_0xb04feb, _0x2c6f82), _0xb04feb.d2) <= _0x1052c8.shieldAngle ? true : false;
      if (_0x369177) {
        _0x27f535(0, _0x2541d9());
      } else {
        if (_0x342608) {
          _0x27f535(4, _0x2541d9());
        } else {
          if (_0x32bd58) {
            _0x27f535(2, _0x2541d9());
          } else {
            _0x5a5613 && _0x27f535(5, _0x2541d9());
          }
        }
      }
      _0x405841 && (_0x405841 = false, _0x32027d.send('ch', _0x5e1af5.length));
      if (!_0x33b253 && !_0xf70d71 && !_0x22f4d8 && !_0x1b01df) {
        if (_0x148bf1) {
          !_0x15641f && _0x2c6f82.pR == 1 && (_0x15641f = true, _0x32027d.send('7', 1), _0x24e16f(_0x1ec4b2 ? 40 : 7, 0), _0xd8099b(() => {
            _0x15641f = false, _0x32027d.send('7', 1), _0x24e16f(_0x4c6a38.length ? 22 : _0x33d522 && !_0x1ec4b2 && _0x2c6f82.tailIndex == 21 && (_0xb04feb.primaryIndex == 4 || _0xb04feb.primaryIndex == 5 && _0xb04feb.primaryVariant < 2) && (_0xb04feb.secondaryIndex == 10 || _0xb04feb.secondaryIndex == 14) && _0x2c6f82.shameCount < 4 && _0x5e1af5.length && _0x1ad2a2(_0xb04feb, _0x2c6f82) <= 250 ? 11 : 6, 0);
          }, 1));
          _0x499306 = _0x2c6f82.weapons[0];
          if (_0x2c6f82.weaponIndex != _0x2c6f82.weapons[0]) {
            _0x389917(_0x2c6f82.weapons[0], true);
          }
        } else {
          if (_0x5488f9) {
            !_0x15641f && (_0x2c6f82.weapons[1] == 10 ? _0x2c6f82.sR : _0x2c6f82.pR) == 1 && (_0x15641f = true, _0x32027d.send('7', 1), _0x24e16f(40, 0), _0xd8099b(() => {
              _0x15641f = false, _0x32027d.send('7', 1), _0x24e16f(_0x4c6a38.length ? 22 : 6, 0);
            }, 1));
            _0x499306 = _0x2c6f82.weapons[1] == 10 ? _0x2c6f82.weapons[1] : _0x2c6f82.weapons[0];
            if (_0x2c6f82.weaponIndex != (_0x2c6f82.weapons[1] == 10 ? _0x2c6f82.weapons[1] : _0x2c6f82.weapons[0])) {
              _0x389917(_0x2c6f82.weapons[1] == 10 ? _0x2c6f82.weapons[1] : _0x2c6f82.weapons[0], true);
            }
          }
        }
      }
      if (_0x29436e && _0x1ad2a2(_0xb04feb, _0x2c6f82) < _0x34ff74.weapons[_0x2c6f82.weapons[1] == 10 ? _0x2c6f82.weapons[1] : _0x2c6f82.weapons[0]].range + (_0x2c6f82.scale + _0xb04feb.scale) && _0x2c6f82.pR == 1 && _0x2c6f82.sR == 1 && _0xb04feb.skinIndex != 6 && _0xb04feb.skinIndex != 22 && !_0x46b815) {
        _0x29436e = false;
        _0x4a0cb7();
      }
      if (_0x1b01df) {
        _0x1b01df = false;
        if (!_0xf70d71) {
          _0x3e93a0();
        }
      }
      if (_0x4a45e9.length) {
        _0x4c6a38 = _0x4a45e9.filter(_0x528ce0 => _0x528ce0.name == "turret" && _0x2c6f82.sid != _0x528ce0.owner.sid && !_0x1af301(_0x528ce0.owner.sid) && _0x4f6d8c(_0x528ce0, _0x2c6f82) <= 700 && _0x528ce0.active);
        let _0x52e8d6 = _0x4a45e9.filter(_0x295a8f => _0x295a8f.trap).sort(function (_0x43d480, _0x2d5d73) {
          return Math.hypot(_0x43d480.y - _0x2c6f82.y2, _0x43d480.x - _0x2c6f82.x2) - Math.hypot(_0x2d5d73.y - _0x2c6f82.y2, _0x2d5d73.x - _0x2c6f82.x2);
        })[0];
        if (_0x52e8d6) {
          _0x5e40db = Math.atan2(_0x52e8d6.y - _0x2c6f82.y2, _0x52e8d6.x - _0x2c6f82.x2);
          if (_0x2c6f82.sid != _0x52e8d6.owner.sid && !_0x1af301(_0x52e8d6.owner.sid) && Math.hypot(_0x52e8d6.y - _0x2c6f82.y2, _0x52e8d6.x - _0x2c6f82.x2) <= 50 && _0x52e8d6.active) {
            _0x33b253 = true;
            if (!_0x22f4d8 && !_0xf70d71) {
              _0x499306 = _0x1cfd78 ? _0x2c6f82.weapons[1] : _0x2c6f82.weapons[0];
              if (_0x2c6f82.weaponIndex != _0x1cfd78 ? _0x2c6f82.weapons[1] : _0x2c6f82.weapons[0]) {
                _0x389917(_0x1cfd78 ? _0x2c6f82.weapons[1] : _0x2c6f82.weapons[0], true);
              }
              (_0x1cfd78 ? _0x2c6f82.sR : _0x2c6f82.pR) == 1 && !_0x15641f && (_0x15641f = true, _0x24e16f(40, 0), _0x32027d.send('7', 1), _0x32027d.send('2', _0x5e40db), _0xd8099b(() => {
                _0x32027d.send('7', 1);
                _0x15641f = false;
                _0x24e16f(_0x4c6a38.length ? 22 : 6, 0);
              }, 1));
            }
          } else {
            _0x33b253 = false;
          }
        }
      }
      if (_0x2df32f && !_0x33b253 && !_0x1b01df && !_0x22f4d8 && !_0x51ce99 && !_0xf70d71 && _0x2c6f82.alive) {
        if (_0x1ad2a2(_0xb04feb, _0x2c6f82) < _0x34ff74.weapons[_0x2c6f82.weapons[0]].range + (_0x2c6f82.scale + _0xb04feb.scale)) {
          _0x5cbf93 = true;
          _0x314e30 = true;
          !_0x15641f && _0x2c6f82.pR == 1 && (_0x15641f = true, _0x32027d.send('7', 1), _0x32027d.send('2', _0x11b3cf), _0x24e16f(7, 0), _0xd8099b(() => {
            _0x15641f = false;
            _0x32027d.send('7', 1);
            _0x24e16f(_0x4c6a38.length ? 22 : _0x33d522 && !_0x1ec4b2 && _0x2c6f82.tailIndex == 21 && (_0xb04feb.primaryIndex == 4 || _0xb04feb.primaryIndex == 5 && _0xb04feb.primaryVariant < 2) && (_0xb04feb.secondaryIndex == 10 || _0xb04feb.secondaryIndex == 14) && _0x2c6f82.shameCount < 4 && _0x5e1af5.length && _0x1ad2a2(_0xb04feb, _0x2c6f82) <= 250 ? 11 : 6, 0);
          }, 1));
          _0x499306 = _0x2c6f82.weapons[0];
          if (_0x2c6f82.weaponIndex != _0x2c6f82.weapons[0]) {
            _0x389917(_0x2c6f82.weapons[0], true);
          }
        } else {
          _0x5cbf93 = false;
          _0x314e30 = false;
        }
      } else {
        _0x5cbf93 = false, _0x314e30 = false;
      }
      !_0x33b253 && !_0x22f4d8 && !_0x1b01df && !_0xf70d71 && !_0x51ce99 && _0x2c6f82.alive && !_0x369177 && !_0x342608 && !_0x32bd58 && !_0x5a5613 && _0x54bba1();
      if (!_0x33b253 && !_0x22f4d8 && !_0x1b01df && !_0xf70d71 && !_0x51ce99 && !_0x314e30 && _0x2c6f82.alive) {
        if ((_0x2c6f82.weapons[0] == 3 || _0x2c6f82.weapons[0] == 4 || _0x2c6f82.weapons[0] == 5) && (_0x2c6f82.weapons[1] == 10 || _0x2c6f82.weapons[1] == 14)) {
          if (_0x2c6f82.pR < 1) {
            _0x255d64 = false;
            _0x499306 = _0x2c6f82.weapons[0];
            _0x2c6f82.weaponIndex != _0x2c6f82.weapons[0] && _0x389917(_0x2c6f82.weapons[0], true);
          } else {
            if (_0x2c6f82.pR == 1 && _0x2c6f82.sR < 1) {
              _0x255d64 = false;
              _0x499306 = _0x2c6f82.weapons[1];
              if (_0x2c6f82.weaponIndex != _0x2c6f82.weapons[1]) {
                _0x389917(_0x2c6f82.weapons[1], true);
              }
            } else {
              if (_0x2c6f82.pR == 1 && _0x2c6f82.sR == 1) {
                if (!_0x255d64) {
                  _0x499306 = _0x2c6f82.weapons[1];
                  _0x2c6f82.weaponIndex != _0x2c6f82.weapons[1] && _0x389917(_0x2c6f82.weapons[1], true);
                  _0x255d64 = true;
                }
              } else {
                _0x499306 = _0x2c6f82.weaponIndex;
              }
            }
          }
        } else {
          if (_0x2c6f82.sR < 1) {
            _0x255d64 = false;
            _0x499306 = _0x2c6f82.weapons[1];
            if (_0x2c6f82.weaponIndex != _0x2c6f82.weapons[1]) {
              _0x389917(_0x2c6f82.weapons[1], true);
            }
          } else {
            if (_0x2c6f82.sR == 1 && _0x2c6f82.pR < 1) {
              _0x255d64 = false;
              _0x499306 = _0x2c6f82.weapons[0];
              _0x2c6f82.weaponIndex != _0x2c6f82.weapons[0] && _0x389917(_0x2c6f82.weapons[0], true);
            } else {
              if (_0x2c6f82.sR == 1 && _0x2c6f82.pR == 1) {
                if (!_0x255d64) {
                  _0x499306 = _0x2c6f82.weapons[0];
                  if (_0x2c6f82.weaponIndex != _0x2c6f82.weapons[0]) {
                    _0x389917(_0x2c6f82.weapons[0], true);
                  }
                  _0x255d64 = true;
                }
              } else {
                _0x499306 = _0x2c6f82.weaponIndex;
              }
            }
          }
        }
      }
      if ((_0x3dce21.y2 != _0x2c6f82.y2 || _0x3dce21.x2 != _0x2c6f82.x2) && !(_0x2c6f82.y2 >= _0x1052c8.mapScale / 2 - _0x1052c8.riverWidth / 2 && _0x2c6f82.y2 <= _0x1052c8.mapScale / 2 + _0x1052c8.riverWidth / 2)) {
        if (_0x6ca58e && !_0x33b253 && !_0x314e30) {
          if (_0x1ad2a2(_0xafcc8a, _0x2c6f82) > 94) {
            let _0x46a589 = _0x4d6c19(_0x3dce21, _0x2c6f82);
            _0x27f535(3, _0x46a589 + _0x35ab04(75.2));
            _0x27f535(3, _0x46a589 - _0x35ab04(75.2));
            _0x27f535(3, _0x46a589);
            _0xafcc8a.x2 = _0x2c6f82.x2;
            _0xafcc8a.y2 = _0x2c6f82.y2;
          }
        }
        _0x3dce21.x2 = _0x2c6f82.x2;
        _0x3dce21.y2 = _0x2c6f82.y2;
      }
      if (_0x8a98e6[_0x14f8c0]) {
        _0x8a98e6[_0x14f8c0].forEach(_0x4d0cf9 => _0x4d0cf9());
      }
      if (_0x58dc29.style.display == "none") {
        if (_0x51ce99 || _0x33b253 || _0x22f4d8 || _0x1b01df || _0xf70d71 || _0x2df32f && _0x1ad2a2(_0xb04feb, _0x2c6f82) <= 250) {
          _0x24e16f(_0x49ed08, 1, true);
        } else {
          if (_0x5e1af5.length && _0x1ad2a2(_0xb04feb, _0x2c6f82) <= 300) {
            if ((_0x14f8c0 - _0x36ec3b) % _0x1052c8.serverUpdateRate === 0) {
              _0x24e16f(13, 1, true);
            } else {
              _0x24e16f(11, 1, true);
            }
          } else {
            _0x24e16f(11, 1, true);
          }
        }
      }
      _0x2e7a61 && _0x32027d.send('2', _0x11b3cf);
      myConfig.enemyCount = _0x5e1af5.length;
      myConfig.nearAim = function (_0x1aa164) {
        return _0x5e1af5.length ? Math.atan2(_0xb04feb.y2 - _0x1aa164.y, _0xb04feb.x2 - _0x1aa164.x) : _0x2c6f82.d2;
      };
      myConfig.clan = _0x2c6f82.team;
    }
    function _0xd8099b(_0x2b71f8, _0x7329b4) {
      if (typeof _0x8a98e6[_0x14f8c0 + _0x7329b4] == "object") {
        _0x8a98e6[_0x14f8c0 + _0x7329b4].push(_0x2b71f8);
      } else {
        _0x8a98e6[_0x14f8c0 + _0x7329b4] = [_0x2b71f8];
      }
    }
    function _0x3bf04e(_0x2ea679) {
      if (_0x2ea679.weaponIndex < 9) {
        if (_0x2ea679 == _0x2c6f82) {
          _0x2ea679.primaryIndex = _0x2c6f82.weapons[0];
        } else {
          _0x2ea679.primaryIndex = _0x2ea679.weaponIndex;
        }
        _0x2ea679.primaryVariant = _0x2ea679.weaponVariant;
        _0x2ea679.weaponIndex == _0x2ea679.primaryIndex && _0x2ea679.buildIndex < 0 && (_0x2ea679.pR = Math.min(1, _0x2ea679.pR + 1000 / _0x1052c8.serverUpdateRate / _0x34ff74.weapons[_0x2ea679.primaryIndex].speed));
      } else {
        if (_0x2ea679.weaponIndex > 8) {
          _0x2ea679 == _0x2c6f82 ? _0x2ea679.secondaryIndex = _0x2c6f82.weapons[1] : _0x2ea679.secondaryIndex = _0x2ea679.weaponIndex;
          _0x2ea679.secondaryVariant = _0x2ea679.weaponVariant;
          if (_0x2ea679.weaponIndex == _0x2ea679.secondaryIndex) {
            _0x2ea679.buildIndex < 0 && (_0x2ea679.sR = Math.min(1, _0x2ea679.sR + 1000 / _0x1052c8.serverUpdateRate / _0x34ff74.weapons[_0x2ea679.secondaryIndex].speed));
          }
        }
      }
      _0x2ea679.tR = Math.min(1, _0x2ea679.tR + 1000 / _0x1052c8.serverUpdateRate / 2500);
    }
    function _0x5af7c0(_0x3f9488) {
      for (var _0x5860e3 = 0; _0x5860e3 < _0xe6cd1d.length; ++_0x5860e3) {
        if (_0xe6cd1d[_0x5860e3].id == _0x3f9488) {
          return _0xe6cd1d[_0x5860e3];
        }
      }
      return null;
    }
    function _0x54663(_0x18482e) {
      for (var _0x3e9547 = 0; _0x3e9547 < _0xe6cd1d.length; ++_0x3e9547) {
        if (_0xe6cd1d[_0x3e9547].sid == _0x18482e) {
          return _0xe6cd1d[_0x3e9547];
        }
      }
      return null;
    }
    function _0x38d2f1(_0x525643) {
      for (var _0x460359 = 0; _0x460359 < _0x4c7cec.length; ++_0x460359) {
        if (_0x4c7cec[_0x460359].sid == _0x525643) {
          return _0x4c7cec[_0x460359];
        }
      }
      return null;
    }
    function _0x5d58c5(_0x166060) {
      for (var _0x4d85c9 = 0; _0x4d85c9 < _0x4a45e9.length; ++_0x4d85c9) {
        if (_0x4a45e9[_0x4d85c9].sid == _0x166060) {
          return _0x4a45e9[_0x4d85c9];
        }
      }
      return null;
    }
    function _0x1af301(_0xa5f6e9) {
      for (let _0x472626 = 0; _0x472626 < _0x236358.length; _0x472626 += 2) {
        if (_0x236358[_0x472626] == _0xa5f6e9) {
          return _0x236358[_0x472626];
        }
      }
      return null;
    }
    var _0x38dab6 = -1;
    function _0x533c47() {
      var _0x221ee0 = Date.now() - _0x38dab6;
      window.pingTime = _0x221ee0;
      _0x7e01b4.innerText = "Ping: " + _0x221ee0 + " ms";
    }
    function _0x4b1f7a() {
      _0x38dab6 = Date.now();
      _0x32027d.send('pp');
    }
    _0x7e01b4.style.left = "50px";
    _0x7e01b4.style.display = "block";
    document.body.appendChild(_0x7e01b4);
    function _0x3af19e(_0x35e537) {
      if (_0x35e537 < 0) {
        return;
      }
      var _0x3e8d1f = Math.floor(_0x35e537 / 60);
      var _0x377967 = _0x35e537 % 60;
      _0x377967 = ('0' + _0x377967).slice(-2);
      _0x274f80.innerText = "Server restarting in " + _0x3e8d1f + ':' + _0x377967;
      _0x274f80.hidden = false;
    }
    window.requestAnimFrame = function () {
      return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function (_0x520ee4) {
        window.setTimeout(_0x520ee4, 16.666666666666668);
      };
    }();
    var _0xb087d5 = document.createElement("div");
    _0xb087d5.id = "status";
    var _0x235bc8 = _0xb087d5;
    var _0x24a5b4 = 0;
    function _0x366395() {
      _0x5462e6 = Date.now(), _0x17d20f = _0x5462e6 - _0x51c021, _0x51c021 = _0x5462e6, _0x3f45aa(), requestAnimFrame(_0x366395), _0x24a5b4 > Math.PI * 2 ? _0x24a5b4 = _0x64689a : _0x24a5b4 += _0x64689a;
    }
    function _0x470a7e() {
      _0x4a39e3();
      _0x174b82();
      _0x2f3f09.style.display = "none";
      _0x2996d0.style.display = "block";
      _0xfea98f.value = _0x5cd5b4("moo_name") || '';
      _0x22c606();
    }
    _0x166242();
    _0x366395();
    function _0x2b2283(_0x5d2e6a) {
      window.open(_0x5d2e6a, "_blank");
    }
    window.openLink = _0x2b2283;
    window.aJoinReq = _0x376840;
    window.follmoo = _0x4b6d2a;
    window.kickFromClan = _0x57ba04;
    window.sendJoin = _0x43f278;
    window.leaveAlliance = _0x1a0fd5;
    window.createAlliance = _0x94ac9c;
    window.storeBuy = _0x562237;
    window.storeEquip = _0x342269;
    window.showItemInfo = _0x4873c6;
    window.selectSkinColor = _0x3993a2;
    window.changeStoreIndex = _0x1bf532;
    window.config = _0x1052c8;
    window.FRVR = antiBug;
  },
  './src/js/config.js': function (_0x2480f9, _0x4a4994, _0x2c767f) {
    (function (_0xd28018) {
      _0x2480f9.exports.maxScreenWidth = 1920;
      _0x2480f9.exports.maxScreenHeight = 1080;
      _0x2480f9.exports.serverUpdateRate = 9;
      _0x2480f9.exports.maxPlayers = _0xd28018 && _0xd28018.argv.indexOf("--largeserver") != -1 ? 80 : 40;
      _0x2480f9.exports.maxPlayersHard = _0x2480f9.exports.maxPlayers + 10;
      _0x2480f9.exports.collisionDepth = 6;
      _0x2480f9.exports.minimapRate = 3000;
      _0x2480f9.exports.colGrid = 10;
      _0x2480f9.exports.clientSendRate = 5;
      _0x2480f9.exports.healthBarWidth = 50;
      _0x2480f9.exports.healthBarPad = 4.5;
      _0x2480f9.exports.iconPadding = 15;
      _0x2480f9.exports.iconPad = 0.9;
      _0x2480f9.exports.deathFadeout = 3000;
      _0x2480f9.exports.crownIconScale = 60;
      _0x2480f9.exports.crownPad = 35;
      _0x2480f9.exports.chatCountdown = 3000;
      _0x2480f9.exports.chatCooldown = 500;
      _0x2480f9.exports.inSandbox = _0xd28018 && _0xd28018.env.VULTR_SCHEME === "mm_exp";
      ;
      _0x2480f9.exports.isSandbox = window.location.hostname == "sandbox.moomoo.io";
      _0x2480f9.exports.maxAge = 100;
      _0x2480f9.exports.gatherAngle = Math.PI / 2.6;
      _0x2480f9.exports.gatherWiggle = 10;
      _0x2480f9.exports.hitReturnRatio = 0.25;
      _0x2480f9.exports.hitAngle = Math.PI / 2;
      _0x2480f9.exports.playerScale = 35;
      _0x2480f9.exports.playerSpeed = 0.0016;
      _0x2480f9.exports.playerDecel = 0.993;
      _0x2480f9.exports.nameY = 34;
      _0x2480f9.exports.skinColors = ["#bf8f54", "#cbb091", "#896c4b", "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3", "#8bc373", "#91b2db"];
      _0x2480f9.exports.animalCount = 7;
      _0x2480f9.exports.aiTurnRandom = 0.06;
      _0x2480f9.exports.cowNames = ["Sid", "Steph", "Bmoe", "Romn", "Jononthecool", "Fiona", "Vince", "Nathan", "Nick", "Flappy", "Ronald", "Otis", "Pepe", "Mc Donald", "Theo", "Fabz", "Oliver", "Jeff", "Jimmy", "Helena", "Reaper", "Ben", "Alan", "Naomi", "XYZ", "Clever", "Jeremy", "Mike", "Destined", "Stallion", "Allison", "Meaty", "Sophia", "Vaja", "Joey", "Pendy", "Murdoch", "Theo", "Jared", "July", "Sonia", "Mel", "Dexter", "Quinn", "Milky"];
      _0x2480f9.exports.shieldAngle = Math.PI / 3;
      var _0x586d37 = {
        id: 0x3,
        src: '_r',
        poison: true,
        xp: 0x2ee0,
        val: 1.18
      };
      _0x2480f9.exports.weaponVariants = [{
        id: 0x0,
        src: '',
        xp: 0x0,
        val: 0x1
      }, {
        id: 0x1,
        src: '_g',
        xp: 0xbb8,
        val: 1.1
      }, {
        id: 0x2,
        src: '_d',
        xp: 0x1b58,
        val: 1.18
      }, _0x586d37];
      _0x2480f9.exports.fetchVariant = function (_0x2295fb) {
        var _0x5b0e82 = _0x2295fb.weaponXP[_0x2295fb.weaponIndex] || 0;
        for (var _0x1d393c = _0x2480f9.exports.weaponVariants.length - 1; _0x1d393c >= 0; --_0x1d393c) {
          if (_0x5b0e82 >= _0x2480f9.exports.weaponVariants[_0x1d393c].xp) {
            return _0x2480f9.exports.weaponVariants[_0x1d393c];
          }
        }
      };
      _0x2480f9.exports.resourceTypes = ["wood", "food", "stone", "points"];
      _0x2480f9.exports.areaCount = 7;
      _0x2480f9.exports.treesPerArea = 9;
      _0x2480f9.exports.bushesPerArea = 3;
      _0x2480f9.exports.totalRocks = 32;
      _0x2480f9.exports.goldOres = 7;
      _0x2480f9.exports.riverWidth = 724;
      _0x2480f9.exports.riverPadding = 114;
      _0x2480f9.exports.waterCurrent = 0.0011;
      _0x2480f9.exports.waveSpeed = 0.0001;
      _0x2480f9.exports.waveMax = 1.3;
      _0x2480f9.exports.treeScales = [150, 160, 165, 175];
      _0x2480f9.exports.bushScales = [80, 85, 95];
      _0x2480f9.exports.rockScales = [80, 85, 90];
      _0x2480f9.exports.snowBiomeTop = 2400;
      _0x2480f9.exports.snowSpeed = 0.75;
      _0x2480f9.exports.maxNameLength = 15;
      _0x2480f9.exports.mapScale = 14400;
      _0x2480f9.exports.mapPingScale = 40;
      _0x2480f9.exports.mapPingTime = 2200;
    }).call(this, _0x2c767f("./node_modules/process/browser.js"));
  },
  './src/js/data/ai.js': function (_0x55b9e8, _0x29efc6) {
    var _0x29f179 = Math.PI * 2;
    _0x55b9e8.exports = function (_0x5c98db, _0x510f61, _0x533963, _0x39c7bc, _0x54223c, _0x304884, _0x243fbe, _0x5e5751) {
      this.sid = _0x5c98db;
      this.isAI = true;
      this.nameIndex = _0x54223c.randInt(0, _0x304884.cowNames.length - 1);
      this.init = function (_0x1089d8, _0x4e901c, _0x209575, _0x363419, _0x29a4ff) {
        this.x = _0x1089d8;
        this.y = _0x4e901c;
        this.startX = _0x29a4ff.fixedSpawn ? _0x1089d8 : null;
        this.startY = _0x29a4ff.fixedSpawn ? _0x4e901c : null;
        this.xVel = 0;
        this.yVel = 0;
        this.zIndex = 0;
        this.dir = _0x209575;
        this.dirPlus = 0;
        this.index = _0x363419;
        this.src = _0x29a4ff.src;
        if (_0x29a4ff.name) {
          this.name = _0x29a4ff.name;
        }
        this.weightM = _0x29a4ff.weightM;
        this.speed = _0x29a4ff.speed;
        this.killScore = _0x29a4ff.killScore;
        this.turnSpeed = _0x29a4ff.turnSpeed;
        this.scale = _0x29a4ff.scale;
        this.maxHealth = _0x29a4ff.health;
        this.leapForce = _0x29a4ff.leapForce;
        this.health = this.maxHealth;
        this.chargePlayer = _0x29a4ff.chargePlayer;
        this.viewRange = _0x29a4ff.viewRange;
        this.drop = _0x29a4ff.drop;
        this.dmg = _0x29a4ff.dmg;
        this.hostile = _0x29a4ff.hostile;
        this.dontRun = _0x29a4ff.dontRun;
        this.hitRange = _0x29a4ff.hitRange;
        this.hitDelay = _0x29a4ff.hitDelay;
        this.hitScare = _0x29a4ff.hitScare;
        this.spriteMlt = _0x29a4ff.spriteMlt;
        this.nameScale = _0x29a4ff.nameScale;
        this.colDmg = _0x29a4ff.colDmg;
        this.noTrap = _0x29a4ff.noTrap;
        this.spawnDelay = _0x29a4ff.spawnDelay;
        this.hitWait = 0;
        this.waitCount = 1000;
        this.moveCount = 0;
        this.targetDir = 0;
        this.active = true;
        this.alive = true;
        this.runFrom = null;
        this.chargeTarget = null;
        this.dmgOverTime = {};
      };
      var _0x350d08 = 0;
      this.update = function (_0x21c5a9) {
        if (this.active) {
          if (this.spawnCounter) {
            this.spawnCounter -= _0x21c5a9;
            this.spawnCounter <= 0 && (this.spawnCounter = 0, this.x = this.startX || _0x54223c.randInt(0, _0x304884.mapScale), this.y = this.startY || _0x54223c.randInt(0, _0x304884.mapScale));
            return;
          }
          _0x350d08 -= _0x21c5a9;
          if (_0x350d08 <= 0) {
            if (this.dmgOverTime.dmg) {
              this.changeHealth(-this.dmgOverTime.dmg, this.dmgOverTime.doer);
              this.dmgOverTime.time -= 1;
              if (this.dmgOverTime.time <= 0) {
                this.dmgOverTime.dmg = 0;
              }
            }
            _0x350d08 = 1000;
          }
          var _0x1d7e2c = false;
          var _0x2f66c1 = 1;
          if (!this.zIndex && !this.lockMove && this.y >= _0x304884.mapScale / 2 - _0x304884.riverWidth / 2 && this.y <= _0x304884.mapScale / 2 + _0x304884.riverWidth / 2) {
            _0x2f66c1 = 0.33;
            this.xVel += _0x304884.waterCurrent * _0x21c5a9;
          }
          if (this.lockMove) {
            this.xVel = 0, this.yVel = 0;
          } else {
            if (this.waitCount > 0) {
              this.waitCount -= _0x21c5a9;
              if (this.waitCount <= 0) {
                if (this.chargePlayer) {
                  var _0x5176ff;
                  var _0x2cdd31;
                  var _0x593938;
                  for (var _0x143604 = 0; _0x143604 < _0x533963.length; ++_0x143604) {
                    if (_0x533963[_0x143604].alive && !(_0x533963[_0x143604].skin && _0x533963[_0x143604].skin.bullRepel)) {
                      _0x593938 = _0x54223c.getDistance(this.x, this.y, _0x533963[_0x143604].x, _0x533963[_0x143604].y);
                      _0x593938 <= this.viewRange && (!_0x5176ff || _0x593938 < _0x2cdd31) && (_0x2cdd31 = _0x593938, _0x5176ff = _0x533963[_0x143604]);
                    }
                  }
                  if (_0x5176ff) {
                    this.chargeTarget = _0x5176ff;
                    this.moveCount = _0x54223c.randInt(8000, 12000);
                  } else {
                    this.moveCount = _0x54223c.randInt(1000, 2000), this.targetDir = _0x54223c.randFloat(-Math.PI, Math.PI);
                  }
                } else {
                  this.moveCount = _0x54223c.randInt(4000, 10000), this.targetDir = _0x54223c.randFloat(-Math.PI, Math.PI);
                }
              }
            } else {
              if (this.moveCount > 0) {
                var _0x52d630 = this.speed * _0x2f66c1;
                if (this.runFrom && this.runFrom.active && !(this.runFrom.isPlayer && !this.runFrom.alive)) {
                  this.targetDir = _0x54223c.getDirection(this.x, this.y, this.runFrom.x, this.runFrom.y), _0x52d630 *= 1.42;
                } else {
                  this.chargeTarget && this.chargeTarget.alive && (this.targetDir = _0x54223c.getDirection(this.chargeTarget.x, this.chargeTarget.y, this.x, this.y), _0x52d630 *= 1.75, _0x1d7e2c = true);
                }
                if (this.hitWait) {
                  _0x52d630 *= 0.3;
                }
                if (this.dir != this.targetDir) {
                  this.dir %= _0x29f179;
                  var _0x36ab4d = (this.dir - this.targetDir + _0x29f179) % _0x29f179;
                  var _0x424c79 = Math.min(Math.abs(_0x36ab4d - _0x29f179), _0x36ab4d, this.turnSpeed * _0x21c5a9);
                  var _0x167bc3 = _0x36ab4d - Math.PI >= 0 ? 1 : -1;
                  this.dir += _0x167bc3 * _0x424c79 + _0x29f179;
                }
                this.dir %= _0x29f179;
                this.xVel += _0x52d630 * _0x21c5a9 * Math.cos(this.dir);
                this.yVel += _0x52d630 * _0x21c5a9 * Math.sin(this.dir);
                this.moveCount -= _0x21c5a9;
                if (this.moveCount <= 0) {
                  this.runFrom = null;
                  this.chargeTarget = null;
                  this.waitCount = this.hostile ? 1500 : _0x54223c.randInt(1500, 6000);
                }
              }
            }
          }
          this.zIndex = 0;
          this.lockMove = false;
          var _0x5c483b;
          var _0x34150c = _0x54223c.getDistance(0, 0, this.xVel * _0x21c5a9, this.yVel * _0x21c5a9);
          var _0x4145d4 = Math.min(4, Math.max(1, Math.round(_0x34150c / 40)));
          var _0x36e52f = 1 / _0x4145d4;
          for (var _0x143604 = 0; _0x143604 < _0x4145d4; ++_0x143604) {
            if (this.xVel) {
              this.x += this.xVel * _0x21c5a9 * _0x36e52f;
            }
            if (this.yVel) {
              this.y += this.yVel * _0x21c5a9 * _0x36e52f;
            }
            _0x5c483b = _0x510f61.getGridArrays(this.x, this.y, this.scale);
            for (var _0xfe923b = 0; _0xfe923b < _0x5c483b.length; ++_0xfe923b) {
              for (var _0xe12aa8 = 0; _0xe12aa8 < _0x5c483b[_0xfe923b].length; ++_0xe12aa8) {
                if (_0x5c483b[_0xfe923b][_0xe12aa8].active) {
                  _0x510f61.checkCollision(this, _0x5c483b[_0xfe923b][_0xe12aa8], _0x36e52f);
                }
              }
            }
          }
          var _0x37ffe0 = false;
          if (this.hitWait > 0) {
            this.hitWait -= _0x21c5a9;
            if (this.hitWait <= 0) {
              _0x37ffe0 = true;
              this.hitWait = 0;
              if (this.leapForce && !_0x54223c.randInt(0, 2)) {
                this.xVel += this.leapForce * Math.cos(this.dir);
                this.yVel += this.leapForce * Math.sin(this.dir);
              }
              var _0x5c483b = _0x510f61.getGridArrays(this.x, this.y, this.hitRange);
              var _0x23dc5f;
              var _0x5032df;
              for (var _0x31c2ff = 0; _0x31c2ff < _0x5c483b.length; ++_0x31c2ff) {
                for (var _0xfe923b = 0; _0xfe923b < _0x5c483b[_0x31c2ff].length; ++_0xfe923b) {
                  _0x23dc5f = _0x5c483b[_0x31c2ff][_0xfe923b];
                  if (_0x23dc5f.health) {
                    _0x5032df = _0x54223c.getDistance(this.x, this.y, _0x23dc5f.x, _0x23dc5f.y);
                    if (_0x5032df < _0x23dc5f.scale + this.hitRange) {
                      if (_0x23dc5f.changeHealth(-this.dmg * 5)) {
                        _0x510f61.disableObj(_0x23dc5f);
                      }
                      _0x510f61.hitObj(_0x23dc5f, _0x54223c.getDirection(this.x, this.y, _0x23dc5f.x, _0x23dc5f.y));
                    }
                  }
                }
              }
              for (var _0xfe923b = 0; _0xfe923b < _0x533963.length; ++_0xfe923b) {
                _0x533963[_0xfe923b].canSee(this) && _0x5e5751.send(_0x533963[_0xfe923b].id, 'aa', this.sid);
              }
            }
          }
          if (_0x1d7e2c || _0x37ffe0) {
            var _0x23dc5f;
            var _0x5032df;
            var _0x9c5f0a;
            for (var _0x143604 = 0; _0x143604 < _0x533963.length; ++_0x143604) {
              _0x23dc5f = _0x533963[_0x143604];
              if (_0x23dc5f && _0x23dc5f.alive) {
                _0x5032df = _0x54223c.getDistance(this.x, this.y, _0x23dc5f.x, _0x23dc5f.y);
                if (this.hitRange) {
                  if (!this.hitWait && _0x5032df <= this.hitRange + _0x23dc5f.scale) {
                    if (_0x37ffe0) {
                      _0x9c5f0a = _0x54223c.getDirection(_0x23dc5f.x, _0x23dc5f.y, this.x, this.y);
                      _0x23dc5f.changeHealth(-this.dmg);
                      _0x23dc5f.xVel += 0.6 * Math.cos(_0x9c5f0a);
                      _0x23dc5f.yVel += 0.6 * Math.sin(_0x9c5f0a);
                      this.runFrom = null;
                      this.chargeTarget = null;
                      this.waitCount = 3000;
                      this.hitWait = !_0x54223c.randInt(0, 2) ? 600 : 0;
                    } else {
                      this.hitWait = this.hitDelay;
                    }
                  }
                } else {
                  _0x5032df <= this.scale + _0x23dc5f.scale && (_0x9c5f0a = _0x54223c.getDirection(_0x23dc5f.x, _0x23dc5f.y, this.x, this.y), _0x23dc5f.changeHealth(-this.dmg), _0x23dc5f.xVel += 0.55 * Math.cos(_0x9c5f0a), _0x23dc5f.yVel += 0.55 * Math.sin(_0x9c5f0a));
                }
              }
            }
          }
          if (this.xVel) {
            this.xVel *= Math.pow(_0x304884.playerDecel, _0x21c5a9);
          }
          if (this.yVel) {
            this.yVel *= Math.pow(_0x304884.playerDecel, _0x21c5a9);
          }
          var _0x1cbbba = this.scale;
          if (this.x - _0x1cbbba < 0) {
            this.x = _0x1cbbba;
            this.xVel = 0;
          } else {
            this.x + _0x1cbbba > _0x304884.mapScale && (this.x = _0x304884.mapScale - _0x1cbbba, this.xVel = 0);
          }
          if (this.y - _0x1cbbba < 0) {
            this.y = _0x1cbbba, this.yVel = 0;
          } else {
            this.y + _0x1cbbba > _0x304884.mapScale && (this.y = _0x304884.mapScale - _0x1cbbba, this.yVel = 0);
          }
        }
      };
      this.canSee = function (_0x5de79e) {
        if (!_0x5de79e) {
          return false;
        }
        if (_0x5de79e.skin && _0x5de79e.skin.invisTimer && _0x5de79e.noMovTimer >= _0x5de79e.skin.invisTimer) {
          return false;
        }
        var _0x2c5613 = Math.abs(_0x5de79e.x - this.x) - _0x5de79e.scale;
        var _0x1ca1bb = Math.abs(_0x5de79e.y - this.y) - _0x5de79e.scale;
        return _0x2c5613 <= _0x304884.maxScreenWidth / 2 * 1.3 && _0x1ca1bb <= _0x304884.maxScreenHeight / 2 * 1.3;
      };
      var _0x4098a6 = 0;
      var _0x1fe534 = 0;
      this.animate = function (_0x67cd67) {
        if (this.animTime > 0) {
          this.animTime -= _0x67cd67;
          if (this.animTime <= 0) {
            this.animTime = 0;
            this.dirPlus = 0;
            _0x4098a6 = 0;
            _0x1fe534 = 0;
          } else {
            if (_0x1fe534 == 0) {
              _0x4098a6 += _0x67cd67 / (this.animSpeed * _0x304884.hitReturnRatio);
              this.dirPlus = _0x54223c.lerp(0, this.targetAngle, Math.min(1, _0x4098a6));
              if (_0x4098a6 >= 1) {
                _0x4098a6 = 1;
                _0x1fe534 = 1;
              }
            } else {
              _0x4098a6 -= _0x67cd67 / (this.animSpeed * (1 - _0x304884.hitReturnRatio));
              this.dirPlus = _0x54223c.lerp(0, this.targetAngle, Math.max(0, _0x4098a6));
            }
          }
        }
      };
      this.startAnim = function () {
        this.animTime = this.animSpeed = 600;
        this.targetAngle = Math.PI * 0.8;
        _0x4098a6 = 0;
        _0x1fe534 = 0;
      };
      this.changeHealth = function (_0x30801e, _0x1a43a4, _0x14e881) {
        if (this.active) {
          this.health += _0x30801e;
          if (_0x14e881) {
            if (this.hitScare && !_0x54223c.randInt(0, this.hitScare)) {
              this.runFrom = _0x14e881;
              this.waitCount = 0;
              this.moveCount = 2000;
            } else {
              if (this.hostile && this.chargePlayer && _0x14e881.isPlayer) {
                this.chargeTarget = _0x14e881;
                this.waitCount = 0;
                this.moveCount = 8000;
              } else {
                !this.dontRun && (this.runFrom = _0x14e881, this.waitCount = 0, this.moveCount = 2000);
              }
            }
          }
          if (_0x30801e < 0 && this.hitRange && _0x54223c.randInt(0, 1)) {
            this.hitWait = 500;
          }
          _0x1a43a4 && _0x1a43a4.canSee(this) && _0x30801e < 0 && _0x5e5751.send(_0x1a43a4.id, 't', Math.round(this.x), Math.round(this.y), Math.round(-_0x30801e), 1);
          if (this.health <= 0) {
            this.spawnDelay ? (this.spawnCounter = this.spawnDelay, this.x = -1000000, this.y = -1000000) : (this.x = this.startX || _0x54223c.randInt(0, _0x304884.mapScale), this.y = this.startY || _0x54223c.randInt(0, _0x304884.mapScale));
            this.health = this.maxHealth;
            this.runFrom = null;
            if (_0x1a43a4) {
              _0x243fbe(_0x1a43a4, this.killScore);
              if (this.drop) {
                for (var _0x5b0746 = 0; _0x5b0746 < this.drop.length;) {
                  _0x1a43a4.addResource(_0x304884.resourceTypes.indexOf(this.drop[_0x5b0746]), this.drop[_0x5b0746 + 1]);
                  _0x5b0746 += 2;
                }
              }
            }
          }
        }
      };
    };
  },
  './src/js/data/aiManager.js': function (_0x3fe078, _0x5d35df) {
    _0x3fe078.exports = function (_0x1870e0, _0x4e6bce, _0x1e7d29, _0x15ed94, _0xcd88fa, _0x30a76c, _0x44dabe, _0x5d808b, _0x2718cc) {
      var _0x1cfaf0 = {
        id: 0x0,
        src: "cow_1",
        killScore: 0x96,
        health: 0x1f4,
        weightM: 0.8,
        speed: 0.00095,
        turnSpeed: 0.001,
        scale: 0x48,
        drop: ["food", 50]
      };
      var _0x3bb9a4 = {
        id: 0x1,
        src: "pig_1",
        killScore: 0xc8,
        health: 0x320,
        weightM: 0.6,
        speed: 0.00085,
        turnSpeed: 0.001,
        scale: 0x48,
        drop: ["food", 80]
      };
      var _0x114067 = {
        id: 0x2,
        name: "Bull",
        src: "bull_2",
        hostile: true,
        dmg: 0x14,
        killScore: 0x3e8,
        health: 0x708,
        weightM: 0.5,
        speed: 0.00094,
        turnSpeed: 0.00074,
        scale: 0x4e,
        viewRange: 0x320,
        chargePlayer: true,
        drop: ["food", 100]
      };
      var _0x376d34 = {
        id: 0x3,
        name: "Bully",
        src: "bull_1",
        hostile: true,
        dmg: 0x14,
        killScore: 0x7d0,
        health: 0xaf0,
        weightM: 0.45,
        speed: 0.001,
        turnSpeed: 0.0008,
        scale: 0x5a,
        viewRange: 0x384,
        chargePlayer: true,
        drop: ["food", 400]
      };
      var _0x2ef840 = {
        id: 0x4,
        name: "Wolf",
        src: "wolf_1",
        hostile: true,
        dmg: 0x8,
        killScore: 0x1f4,
        health: 0x12c,
        weightM: 0.45,
        speed: 0.001,
        turnSpeed: 0.002,
        scale: 0x54,
        viewRange: 0x320,
        chargePlayer: true,
        drop: ["food", 200]
      };
      var _0x148d98 = {
        id: 0x5,
        name: "Quack",
        src: "chicken_1",
        dmg: 0x8,
        killScore: 0x7d0,
        noTrap: true,
        health: 0x12c,
        weightM: 0.2,
        speed: 0.0018,
        turnSpeed: 0.006,
        scale: 0x46,
        drop: ["food", 100]
      };
      var _0x6fcedc = {
        id: 0x6,
        name: "MOOSTAFA",
        nameScale: 0x32,
        src: "enemy",
        hostile: true,
        dontRun: true,
        fixedSpawn: true,
        spawnDelay: 0xea60,
        noTrap: true,
        colDmg: 0x64,
        dmg: 0x28,
        killScore: 0x1f40,
        health: 0x4650,
        weightM: 0.4,
        speed: 0.0007,
        turnSpeed: 0.01,
        scale: 0x50,
        spriteMlt: 1.8,
        leapForce: 0.9,
        viewRange: 0x3e8,
        hitRange: 0xd2,
        hitDelay: 0x3e8,
        chargePlayer: true,
        drop: ["food", 100]
      };
      var _0x292bb9 = {
        id: 0x7,
        name: "Treasure",
        hostile: true,
        nameScale: 0x23,
        src: "crate_1",
        fixedSpawn: true,
        spawnDelay: 0x1d4c0,
        colDmg: 0xc8,
        killScore: 0x1388,
        health: 0x4e20,
        weightM: 0.1,
        speed: 0x0,
        turnSpeed: 0x0,
        scale: 0x46,
        spriteMlt: 0x1
      };
      var _0x5f12d2 = {
        id: 0x8,
        name: "MOOFIE",
        src: "wolf_2",
        hostile: true,
        fixedSpawn: true,
        dontRun: true,
        hitScare: 0x4,
        spawnDelay: 0x7530,
        noTrap: true,
        nameScale: 0x23,
        dmg: 0xa,
        colDmg: 0x64,
        killScore: 0xbb8,
        health: 0x1b58,
        weightM: 0.45,
        speed: 0.0015,
        turnSpeed: 0.002,
        scale: 0x5a,
        viewRange: 0x320,
        chargePlayer: true,
        drop: ["food", 1000]
      };
      this.aiTypes = [_0x1cfaf0, _0x3bb9a4, _0x114067, _0x376d34, _0x2ef840, _0x148d98, _0x6fcedc, _0x292bb9, _0x5f12d2];
      this.spawn = function (_0x1607f7, _0x297024, _0x5d7b63, _0x259e08) {
        var _0x101529;
        for (var _0x43ccaf = 0; _0x43ccaf < _0x1870e0.length; ++_0x43ccaf) {
          if (!_0x1870e0[_0x43ccaf].active) {
            _0x101529 = _0x1870e0[_0x43ccaf];
            break;
          }
        }
        if (!_0x101529) {
          _0x101529 = new _0x4e6bce(_0x1870e0.length, _0xcd88fa, _0x1e7d29, _0x15ed94, _0x44dabe, _0x30a76c, _0x5d808b, _0x2718cc);
          _0x1870e0.push(_0x101529);
        }
        _0x101529.init(_0x1607f7, _0x297024, _0x5d7b63, _0x259e08, this.aiTypes[_0x259e08]);
        return _0x101529;
      };
    };
  },
  './src/js/data/gameObject.js': function (_0x5b0665, _0x3dba53) {
    _0x5b0665.exports = function (_0x554917) {
      this.sid = _0x554917;
      this.init = function (_0x132c06, _0x398ee0, _0x45bbc8, _0x29fc2d, _0x5830e2, _0x15f79f, _0x27b2f0) {
        _0x15f79f = _0x15f79f || {};
        this.sentTo = {};
        this.gridLocations = [];
        this.active = true;
        this.doUpdate = _0x15f79f.doUpdate;
        this.x = _0x132c06;
        this.y = _0x398ee0;
        this.dir = _0x45bbc8;
        this.xWiggle = 0;
        this.yWiggle = 0;
        this.scale = _0x29fc2d;
        this.type = _0x5830e2;
        this.id = _0x15f79f.id;
        this.owner = _0x27b2f0;
        this.name = _0x15f79f.name;
        this.isItem = this.id != undefined;
        this.group = _0x15f79f.group;
        this.health = _0x15f79f.health;
        this.layer = 2;
        if (this.group != undefined) {
          this.layer = this.group.layer;
        } else {
          if (this.type == 0) {
            this.layer = 3;
          } else {
            if (this.type == 2) {
              this.layer = 0;
            } else {
              this.type == 4 && (this.layer = -1);
            }
          }
        }
        this.colDiv = _0x15f79f.colDiv || 1;
        this.blocker = _0x15f79f.blocker;
        this.ignoreCollision = _0x15f79f.ignoreCollision;
        this.dontGather = _0x15f79f.dontGather;
        this.hideFromEnemy = _0x15f79f.hideFromEnemy;
        this.friction = _0x15f79f.friction;
        this.projDmg = _0x15f79f.projDmg;
        this.dmg = _0x15f79f.dmg;
        this.pDmg = _0x15f79f.pDmg;
        this.pps = _0x15f79f.pps;
        this.zIndex = _0x15f79f.zIndex || 0;
        this.turnSpeed = _0x15f79f.turnSpeed;
        this.req = _0x15f79f.req;
        this.trap = _0x15f79f.trap;
        this.healCol = _0x15f79f.healCol;
        this.teleport = _0x15f79f.teleport;
        this.boostSpeed = _0x15f79f.boostSpeed;
        this.projectile = _0x15f79f.projectile;
        this.shootRange = _0x15f79f.shootRange;
        this.shootRate = _0x15f79f.shootRate;
        this.shootCount = this.shootRate;
        this.spawnPoint = _0x15f79f.spawnPoint;
      };
      this.changeHealth = function (_0x2c947c, _0x9e516e) {
        this.health += _0x2c947c;
        return this.health <= 0;
      };
      this.getScale = function (_0x438bb4, _0x1f774a) {
        _0x438bb4 = _0x438bb4 || 1;
        return this.scale * (this.isItem || this.type == 2 || this.type == 3 || this.type == 4 ? 1 : 0.6 * _0x438bb4) * (_0x1f774a ? 1 : this.colDiv);
      };
      this.visibleToPlayer = function (_0x38a126) {
        return !this.hideFromEnemy || this.owner && (this.owner == _0x38a126 || this.owner.team && _0x38a126.team == this.owner.team);
      };
      this.update = function (_0x435e79) {
        if (this.active) {
          this.xWiggle && (this.xWiggle *= Math.pow(0.99, _0x435e79));
          if (this.yWiggle) {
            this.yWiggle *= Math.pow(0.99, _0x435e79);
          }
          this.turnSpeed && !this.pps && (this.dir += this.turnSpeed * _0x435e79);
        }
      };
    };
  },
  './src/js/data/items.js': function (_0x12bf16, _0x27c934) {
    var _0x5dc155 = {
      id: 0x1,
      name: "walls",
      place: true,
      limit: 0x1e,
      layer: 0x0
    };
    var _0x1ff111 = {
      id: 0x2,
      name: "spikes",
      place: true,
      limit: 0xf,
      layer: 0x0
    };
    var _0x16ec4d = {
      id: 0x3,
      name: "mill",
      place: true,
      limit: 0x7,
      sandboxLimit: 0x12b,
      layer: 0x1
    };
    var _0x3df811 = {
      id: 0x4,
      name: "mine",
      place: true,
      limit: 0x1,
      layer: 0x0
    };
    var _0x191a77 = {
      id: 0x5,
      name: "trap",
      place: true,
      limit: 0x6,
      layer: -1
    };
    var _0x40cb53 = {
      id: 0x6,
      name: "booster",
      place: true,
      limit: 0xc,
      sandboxLimit: 0x12b,
      layer: -1
    };
    var _0x1de6da = {
      id: 0x7,
      name: "turret",
      place: true,
      limit: 0x2,
      layer: 0x1
    };
    var _0x143001 = {
      id: 0x8,
      name: "watchtower",
      place: true,
      limit: 0xc,
      layer: 0x1
    };
    var _0x1b60c9 = {
      id: 0x9,
      name: "buff",
      place: true,
      limit: 0x4,
      layer: -1
    };
    var _0x32525c = {
      id: 0xa,
      name: "spawn",
      place: true,
      limit: 0x1,
      layer: -1
    };
    var _0x51ed91 = {
      id: 0xb,
      name: "sapling",
      place: true,
      limit: 0x2,
      layer: 0x0
    };
    var _0x1faf2a = {
      id: 0xc,
      name: "blocker",
      place: true,
      limit: 0x3,
      layer: -1
    };
    var _0x58844f = {
      id: 0xd,
      name: "teleporter",
      place: true,
      limit: 0x2,
      sandboxLimit: 0x12b,
      layer: -1
    };
    _0x12bf16.exports.groups = [{
      id: 0x0,
      name: "food",
      layer: 0x0
    }, _0x5dc155, _0x1ff111, _0x16ec4d, _0x3df811, _0x191a77, _0x40cb53, _0x1de6da, _0x143001, _0x1b60c9, _0x32525c, _0x51ed91, _0x1faf2a, _0x58844f];
    _0x27c934.projectiles = [{
      indx: 0x0,
      layer: 0x0,
      src: "arrow_1",
      dmg: 0x19,
      speed: 1.6,
      scale: 0x67,
      range: 0x3e8
    }, {
      indx: 0x1,
      layer: 0x1,
      dmg: 0x19,
      scale: 0x14
    }, {
      indx: 0x0,
      layer: 0x0,
      src: "arrow_1",
      dmg: 0x23,
      speed: 2.5,
      scale: 0x67,
      range: 0x4b0
    }, {
      indx: 0x0,
      layer: 0x0,
      src: "arrow_1",
      dmg: 0x1e,
      speed: 0x2,
      scale: 0x67,
      range: 0x4b0
    }, {
      indx: 0x1,
      layer: 0x1,
      dmg: 0x10,
      scale: 0x14
    }, {
      indx: 0x0,
      layer: 0x0,
      src: "bullet_1",
      dmg: 0x32,
      speed: 3.6,
      scale: 0xa0,
      range: 0x578
    }];
    var _0x2a4805 = {
      id: 0x0,
      type: 0x0,
      name: "tool hammer",
      desc: "tool for gathering all resources",
      src: "hammer_1",
      length: 0x8c,
      width: 0x8c,
      xOff: -3,
      yOff: 0x12,
      dmg: 0x19,
      range: 0x41,
      gather: 0x1,
      speed: 0x12c
    };
    var _0x2ad53f = {
      id: 0x2,
      type: 0x0,
      age: 0x8,
      pre: 0x1,
      name: "great axe",
      desc: "deal more damage and gather more resources",
      src: "great_axe_1",
      length: 0x8c,
      width: 0x8c,
      xOff: -8,
      yOff: 0x19,
      dmg: 0x23,
      spdMult: 0x1,
      range: 0x4b,
      gather: 0x4,
      speed: 0x190
    };
    var _0x57136e = {
      id: 0x3,
      type: 0x0,
      age: 0x2,
      name: "short sword",
      desc: "increased attack power but slower move speed",
      src: "sword_1",
      iPad: 1.3,
      length: 0x82,
      width: 0xd2,
      xOff: -8,
      yOff: 0x2e,
      dmg: 0x23,
      spdMult: 0.85,
      range: 0x6e,
      gather: 0x1,
      speed: 0x12c
    };
    var _0x5817bf = {
      id: 0x4,
      type: 0x0,
      age: 0x8,
      pre: 0x3,
      name: "katana",
      desc: "greater range and damage",
      src: "samurai_1",
      iPad: 1.3,
      length: 0x82,
      width: 0xd2,
      xOff: -8,
      yOff: 0x3b,
      dmg: 0x28,
      spdMult: 0.8,
      range: 0x76,
      gather: 0x1,
      speed: 0x12c
    };
    var _0x1aeebb = {
      id: 0x5,
      type: 0x0,
      age: 0x2,
      name: "polearm",
      desc: "long range melee weapon",
      src: "spear_1",
      iPad: 1.3,
      length: 0x82,
      width: 0xd2,
      xOff: -8,
      yOff: 0x35,
      dmg: 0x2d,
      knock: 0.2,
      spdMult: 0.82,
      range: 0x8e,
      gather: 0x1,
      speed: 0x2bc
    };
    var _0x46c204 = {
      id: 0x6,
      type: 0x0,
      age: 0x2,
      name: "bat",
      desc: "fast long range melee weapon",
      src: "bat_1",
      iPad: 1.3,
      length: 0x6e,
      width: 0xb4,
      xOff: -8,
      yOff: 0x35,
      dmg: 0x14,
      knock: 0.7,
      range: 0x6e,
      gather: 0x1,
      speed: 0x12c
    };
    var _0x59c99c = {
      id: 0x9,
      type: 0x1,
      age: 0x6,
      name: "hunting bow",
      desc: "bow used for ranged combat and hunting",
      src: "bow_1",
      req: ["wood", 4],
      length: 0x78,
      width: 0x78,
      xOff: -6,
      yOff: 0x0,
      projectile: 0x0,
      spdMult: 0.75,
      speed: 0x258
    };
    var _0x1c828e = {
      id: 0xa,
      type: 0x1,
      age: 0x6,
      name: "great hammer",
      desc: "hammer used for destroying structures",
      src: "great_hammer_1",
      length: 0x8c,
      width: 0x8c,
      xOff: -9,
      yOff: 0x19,
      dmg: 0xa,
      spdMult: 0.88,
      range: 0x4b,
      sDmg: 7.5,
      gather: 0x1,
      speed: 0x190
    };
    var _0x2569b0 = {
      id: 0xc,
      type: 0x1,
      age: 0x8,
      pre: 0x9,
      name: "crossbow",
      desc: "deals more damage and has greater range",
      src: "crossbow_1",
      req: ["wood", 5],
      aboveHand: true,
      armS: 0.75,
      length: 0x78,
      width: 0x78,
      xOff: -4,
      yOff: 0x0,
      projectile: 0x2,
      spdMult: 0.7,
      speed: 0x2bc
    };
    var _0x230ac0 = {
      id: 0xd,
      type: 0x1,
      age: 0x9,
      pre: 0xc,
      name: "repeater crossbow",
      desc: "high firerate crossbow with reduced damage",
      src: "crossbow_2",
      req: ["wood", 10],
      aboveHand: true,
      armS: 0.75,
      length: 0x78,
      width: 0x78,
      xOff: -4,
      yOff: 0x0,
      projectile: 0x3,
      spdMult: 0.7,
      speed: 0xe6
    };
    var _0x11badf = {
      id: 0xe,
      type: 0x1,
      age: 0x6,
      name: "mc grabby",
      desc: "steals resources from enemies",
      src: "grab_1",
      length: 0x82,
      width: 0xd2,
      xOff: -8,
      yOff: 0x35,
      dmg: 0x0,
      steal: 0xfa,
      knock: 0.2,
      spdMult: 1.05,
      range: 0x7d,
      gather: 0x0,
      speed: 0x2bc
    };
    var _0x1eea03 = {
      id: 0xf,
      type: 0x1,
      age: 0x9,
      pre: 0xc,
      name: "musket",
      desc: "slow firerate but high damage and range",
      src: "musket_1",
      req: ["stone", 10],
      aboveHand: true,
      rec: 0.35,
      armS: 0.6,
      hndS: 0.3,
      hndD: 1.6,
      length: 0xcd,
      width: 0xcd,
      xOff: 0x19,
      yOff: 0x0,
      projectile: 0x5,
      hideProjectile: true,
      spdMult: 0.6,
      speed: 0x5dc
    };
    _0x27c934.weapons = [_0x2a4805, {
      id: 0x1,
      type: 0x0,
      age: 0x2,
      name: "hand axe",
      desc: "gathers resources at a higher rate",
      src: "axe_1",
      length: 0x8c,
      width: 0x8c,
      xOff: 0x3,
      yOff: 0x18,
      dmg: 0x1e,
      spdMult: 0x1,
      range: 0x46,
      gather: 0x2,
      speed: 0x190
    }, _0x2ad53f, _0x57136e, _0x5817bf, _0x1aeebb, _0x46c204, {
      id: 0x7,
      type: 0x0,
      age: 0x2,
      name: "daggers",
      desc: "really fast short range weapon",
      src: "dagger_1",
      iPad: 0.8,
      length: 0x6e,
      width: 0x6e,
      xOff: 0x12,
      yOff: 0x0,
      dmg: 0x14,
      knock: 0.1,
      range: 0x41,
      gather: 0x1,
      hitSlow: 0.1,
      spdMult: 1.13,
      speed: 0x64
    }, {
      id: 0x8,
      type: 0x0,
      age: 0x2,
      name: "stick",
      desc: "great for gathering but very weak",
      src: "stick_1",
      length: 0x8c,
      width: 0x8c,
      xOff: 0x3,
      yOff: 0x18,
      dmg: 0x1,
      spdMult: 0x1,
      range: 0x46,
      gather: 0x7,
      speed: 0x190
    }, _0x59c99c, _0x1c828e, {
      id: 0xb,
      type: 0x1,
      age: 0x6,
      name: "wooden shield",
      desc: "blocks projectiles and reduces melee damage",
      src: "shield_1",
      length: 0x78,
      width: 0x78,
      shield: 0.2,
      xOff: 0x6,
      yOff: 0x0,
      spdMult: 0.7
    }, _0x2569b0, _0x230ac0, _0x11badf, _0x1eea03];
    _0x12bf16.exports.list = [{
      group: _0x12bf16.exports.groups[0],
      name: "apple",
      desc: "restores 20 health when consumed",
      req: ["food", 10],
      consume: function (_0x257c4c) {
        return _0x257c4c.changeHealth(20, _0x257c4c);
      },
      scale: 0x16,
      holdOffset: 0xf
    }, {
      age: 0x3,
      group: _0x12bf16.exports.groups[0],
      name: "cookie",
      desc: "restores 40 health when consumed",
      req: ["food", 15],
      consume: function (_0x24dbb3) {
        return _0x24dbb3.changeHealth(40, _0x24dbb3);
      },
      scale: 0x1b,
      holdOffset: 0xf
    }, {
      age: 0x7,
      group: _0x12bf16.exports.groups[0],
      name: "cheese",
      desc: "restores 30 health and another 50 over 5 seconds",
      req: ["food", 25],
      consume: function (_0x354937) {
        if (_0x354937.changeHealth(30, _0x354937) || _0x354937.health < 100) {
          _0x354937.dmgOverTime.dmg = -10;
          _0x354937.dmgOverTime.doer = _0x354937;
          _0x354937.dmgOverTime.time = 5;
          return true;
        }
        return false;
      },
      scale: 0x1b,
      holdOffset: 0xf
    }, {
      group: _0x12bf16.exports.groups[1],
      name: "wood wall",
      desc: "provides protection for your village",
      req: ["wood", 10],
      projDmg: true,
      health: 0x17c,
      scale: 0x32,
      holdOffset: 0x14,
      placeOffset: -5
    }, {
      age: 0x3,
      group: _0x12bf16.exports.groups[1],
      name: "stone wall",
      desc: "provides improved protection for your village",
      req: ["stone", 25],
      health: 0x384,
      scale: 0x32,
      holdOffset: 0x14,
      placeOffset: -5
    }, {
      age: 0x7,
      group: _0x12bf16.exports.groups[1],
      name: "castle wall",
      desc: "provides powerful protection for your village",
      req: ["stone", 35],
      health: 0x5dc,
      scale: 0x34,
      holdOffset: 0x14,
      placeOffset: -5
    }, {
      group: _0x12bf16.exports.groups[2],
      name: "spikes",
      desc: "damages enemies when they touch them",
      req: ["wood", 20, "stone", 5],
      health: 0x190,
      dmg: 0x14,
      scale: 0x31,
      spritePadding: -23,
      holdOffset: 0x8,
      placeOffset: -5
    }, {
      age: 0x5,
      group: _0x12bf16.exports.groups[2],
      name: "greater spikes",
      desc: "damages enemies when they touch them",
      req: ["wood", 30, "stone", 10],
      health: 0x1f4,
      dmg: 0x23,
      scale: 0x34,
      spritePadding: -23,
      holdOffset: 0x8,
      placeOffset: -5
    }, {
      age: 0x9,
      group: _0x12bf16.exports.groups[2],
      name: "poison spikes",
      desc: "poisons enemies when they touch them",
      req: ["wood", 35, "stone", 15],
      health: 0x258,
      dmg: 0x1e,
      pDmg: 0x5,
      scale: 0x34,
      spritePadding: -23,
      holdOffset: 0x8,
      placeOffset: -5
    }, {
      age: 0x9,
      group: _0x12bf16.exports.groups[2],
      name: "spinning spikes",
      desc: "damages enemies when they touch them",
      req: ["wood", 30, "stone", 20],
      health: 0x1f4,
      dmg: 0x2d,
      turnSpeed: 0.003,
      scale: 0x34,
      spritePadding: -23,
      holdOffset: 0x8,
      placeOffset: -5
    }, {
      group: _0x12bf16.exports.groups[3],
      name: "windmill",
      desc: "generates gold over time",
      req: ["wood", 50, "stone", 10],
      health: 0x190,
      pps: 0x1,
      turnSpeed: 0.0016,
      spritePadding: 0x19,
      iconLineMult: 0xc,
      scale: 0x2d,
      holdOffset: 0x14,
      placeOffset: 0x5
    }, {
      age: 0x5,
      group: _0x12bf16.exports.groups[3],
      name: "faster windmill",
      desc: "generates more gold over time",
      req: ["wood", 60, "stone", 20],
      health: 0x1f4,
      pps: 1.5,
      turnSpeed: 0.0025,
      spritePadding: 0x19,
      iconLineMult: 0xc,
      scale: 0x2f,
      holdOffset: 0x14,
      placeOffset: 0x5
    }, {
      age: 0x8,
      group: _0x12bf16.exports.groups[3],
      name: "power mill",
      desc: "generates more gold over time",
      req: ["wood", 100, "stone", 50],
      health: 0x320,
      pps: 0x2,
      turnSpeed: 0.005,
      spritePadding: 0x19,
      iconLineMult: 0xc,
      scale: 0x2f,
      holdOffset: 0x14,
      placeOffset: 0x5
    }, {
      age: 0x5,
      group: _0x12bf16.exports.groups[4],
      type: 0x2,
      name: "mine",
      desc: "allows you to mine stone",
      req: ["wood", 20, "stone", 100],
      iconLineMult: 0xc,
      scale: 0x41,
      holdOffset: 0x14,
      placeOffset: 0x0
    }, {
      age: 0x5,
      group: _0x12bf16.exports.groups[11],
      type: 0x0,
      name: "sapling",
      desc: "allows you to farm wood",
      req: ["wood", 150],
      iconLineMult: 0xc,
      colDiv: 0.5,
      scale: 0x6e,
      holdOffset: 0x32,
      placeOffset: -15
    }, {
      age: 0x4,
      group: _0x12bf16.exports.groups[5],
      name: "pit trap",
      desc: "pit that traps enemies if they walk over it",
      req: ["wood", 30, "stone", 30],
      trap: true,
      ignoreCollision: true,
      hideFromEnemy: true,
      health: 0x1f4,
      colDiv: 0.2,
      scale: 0x32,
      holdOffset: 0x14,
      placeOffset: -5
    }, {
      age: 0x4,
      group: _0x12bf16.exports.groups[6],
      name: "boost pad",
      desc: "provides boost when stepped on",
      req: ["stone", 20, "wood", 5],
      ignoreCollision: true,
      boostSpeed: 1.5,
      health: 0x96,
      colDiv: 0.7,
      scale: 0x2d,
      holdOffset: 0x14,
      placeOffset: -5
    }, {
      age: 0x7,
      group: _0x12bf16.exports.groups[7],
      doUpdate: true,
      name: "turret",
      desc: "defensive structure that shoots at enemies",
      req: ["wood", 200, "stone", 150],
      health: 0x320,
      projectile: 0x1,
      shootRange: 0x2bc,
      shootRate: 0x898,
      scale: 0x2b,
      holdOffset: 0x14,
      placeOffset: -5
    }, {
      age: 0x7,
      group: _0x12bf16.exports.groups[8],
      name: "platform",
      desc: "platform to shoot over walls and cross over water",
      req: ["wood", 20],
      ignoreCollision: true,
      zIndex: 0x1,
      health: 0x12c,
      scale: 0x2b,
      holdOffset: 0x14,
      placeOffset: -5
    }, {
      age: 0x7,
      group: _0x12bf16.exports.groups[9],
      name: "healing pad",
      desc: "standing on it will slowly heal you",
      req: ["wood", 30, "food", 10],
      ignoreCollision: true,
      healCol: 0xf,
      health: 0x190,
      colDiv: 0.7,
      scale: 0x2d,
      holdOffset: 0x14,
      placeOffset: -5
    }, {
      age: 0x9,
      group: _0x12bf16.exports.groups[10],
      name: "spawn pad",
      desc: "you will spawn here when you die but it will dissapear",
      req: ["wood", 100, "stone", 100],
      health: 0x190,
      ignoreCollision: true,
      spawnPoint: true,
      scale: 0x2d,
      holdOffset: 0x14,
      placeOffset: -5
    }, {
      age: 0x7,
      group: _0x12bf16.exports.groups[12],
      name: "blocker",
      desc: "blocks building in radius",
      req: ["wood", 30, "stone", 25],
      ignoreCollision: true,
      blocker: 0x12c,
      health: 0x190,
      colDiv: 0.7,
      scale: 0x2d,
      holdOffset: 0x14,
      placeOffset: -5
    }, {
      age: 0x7,
      group: _0x12bf16.exports.groups[13],
      name: "teleporter",
      desc: "teleports you to a random point on the map",
      req: ["wood", 60, "stone", 60],
      ignoreCollision: true,
      teleport: true,
      health: 0xc8,
      colDiv: 0.7,
      scale: 0x2d,
      holdOffset: 0x14,
      placeOffset: -5
    }];
    for (var _0x3d8331 = 0; _0x3d8331 < _0x12bf16.exports.list.length; ++_0x3d8331) {
      _0x12bf16.exports.list[_0x3d8331].id = _0x3d8331;
      if (_0x12bf16.exports.list[_0x3d8331].pre) {
        _0x12bf16.exports.list[_0x3d8331].pre = _0x3d8331 - _0x12bf16.exports.list[_0x3d8331].pre;
      }
    }
    if (typeof window !== "undefined") {
      function _0x5c0b5c(_0x59a18e) {
        for (let _0x5ee7c3 = _0x59a18e.length - 1; _0x5ee7c3 > 0; _0x5ee7c3--) {
          const _0x69fcc6 = Math.floor(Math.random() * (_0x5ee7c3 + 1));
          [_0x59a18e[_0x5ee7c3], _0x59a18e[_0x69fcc6]] = [_0x59a18e[_0x69fcc6], _0x59a18e[_0x5ee7c3]];
        }
        return _0x59a18e;
      }
    }
  },
  './src/js/data/mapManager.js': function (_0x412941, _0x34b2e6) {
    _0x412941.exports = {};
  },
  './src/js/data/objectManager.js': function (_0x27370b, _0xeedcfb) {
    var _0x4f9148 = Math.floor;
    var _0x906055 = Math.abs;
    var _0x43828d = Math.cos;
    var _0x1d47c4 = Math.sin;
    var _0x49dd37 = Math.pow;
    var _0x4342c8 = Math.sqrt;
    _0x27370b.exports = function (_0x6e8214, _0xbc5a1b, _0x335106, _0x723814, _0x59d380, _0x35c880) {
      this.objects = _0xbc5a1b;
      this.grids = {};
      this.updateObjects = [];
      var _0x2bbd79;
      var _0x126071;
      var _0x2c50ed = _0x723814.mapScale / _0x723814.colGrid;
      this.setObjectGrids = function (_0x3677af) {
        var _0xe46e1a = Math.min(_0x723814.mapScale, Math.max(0, _0x3677af.x));
        var _0x4bb435 = Math.min(_0x723814.mapScale, Math.max(0, _0x3677af.y));
        for (var _0x41fc3f = 0; _0x41fc3f < _0x723814.colGrid; ++_0x41fc3f) {
          _0x2bbd79 = _0x41fc3f * _0x2c50ed;
          for (var _0x218fa0 = 0; _0x218fa0 < _0x723814.colGrid; ++_0x218fa0) {
            _0x126071 = _0x218fa0 * _0x2c50ed;
            if (_0xe46e1a + _0x3677af.scale >= _0x2bbd79 && _0xe46e1a - _0x3677af.scale <= _0x2bbd79 + _0x2c50ed && _0x4bb435 + _0x3677af.scale >= _0x126071 && _0x4bb435 - _0x3677af.scale <= _0x126071 + _0x2c50ed) {
              if (!this.grids[_0x41fc3f + '_' + _0x218fa0]) {
                this.grids[_0x41fc3f + '_' + _0x218fa0] = [];
              }
              this.grids[_0x41fc3f + '_' + _0x218fa0].push(_0x3677af);
              _0x3677af.gridLocations.push(_0x41fc3f + '_' + _0x218fa0);
            }
          }
        }
      };
      this.removeObjGrid = function (_0x201ad2) {
        var _0x36d9ad;
        for (var _0x4585c3 = 0; _0x4585c3 < _0x201ad2.gridLocations.length; ++_0x4585c3) {
          _0x36d9ad = this.grids[_0x201ad2.gridLocations[_0x4585c3]].indexOf(_0x201ad2);
          if (_0x36d9ad >= 0) {
            this.grids[_0x201ad2.gridLocations[_0x4585c3]].splice(_0x36d9ad, 1);
          }
        }
      };
      this.disableObj = function (_0x5a96e7) {
        _0x5a96e7.active = false;
        if (_0x35c880) {
          if (_0x5a96e7.owner && _0x5a96e7.pps) {
            _0x5a96e7.owner.pps -= _0x5a96e7.pps;
          }
          this.removeObjGrid(_0x5a96e7);
          var _0x473c5b = this.updateObjects.indexOf(_0x5a96e7);
          if (_0x473c5b >= 0) {
            this.updateObjects.splice(_0x473c5b, 1);
          }
        }
      };
      this.hitObj = function (_0x51b720, _0x161178) {
        for (var _0x2721e3 = 0; _0x2721e3 < _0x59d380.length; ++_0x2721e3) {
          if (_0x59d380[_0x2721e3].active) {
            if (_0x51b720.sentTo[_0x59d380[_0x2721e3].id]) {
              if (!_0x51b720.active) {
                _0x35c880.send(_0x59d380[_0x2721e3].id, '12', _0x51b720.sid);
              } else {
                if (_0x59d380[_0x2721e3].canSee(_0x51b720)) {
                  _0x35c880.send(_0x59d380[_0x2721e3].id, '8', _0x335106.fixTo(_0x161178, 1), _0x51b720.sid);
                }
              }
            }
            if (!_0x51b720.active && _0x51b720.owner == _0x59d380[_0x2721e3]) {
              _0x59d380[_0x2721e3].changeItemCount(_0x51b720.group.id, -1);
            }
          }
        }
      };
      var _0x5022d9 = [];
      var _0x251625;
      this.getGridArrays = function (_0x4db3f3, _0x208d3c, _0x27332f) {
        _0x2bbd79 = _0x4f9148(_0x4db3f3 / _0x2c50ed);
        _0x126071 = _0x4f9148(_0x208d3c / _0x2c50ed);
        _0x5022d9.length = 0;
        try {
          if (this.grids[_0x2bbd79 + '_' + _0x126071]) {
            _0x5022d9.push(this.grids[_0x2bbd79 + '_' + _0x126071]);
          }
          if (_0x4db3f3 + _0x27332f >= (_0x2bbd79 + 1) * _0x2c50ed) {
            _0x251625 = this.grids[_0x2bbd79 + 1 + '_' + _0x126071];
            if (_0x251625) {
              _0x5022d9.push(_0x251625);
            }
            if (_0x126071 && _0x208d3c - _0x27332f <= _0x126071 * _0x2c50ed) {
              _0x251625 = this.grids[_0x2bbd79 + 1 + '_' + (_0x126071 - 1)];
              if (_0x251625) {
                _0x5022d9.push(_0x251625);
              }
            } else {
              if (_0x208d3c + _0x27332f >= (_0x126071 + 1) * _0x2c50ed) {
                _0x251625 = this.grids[_0x2bbd79 + 1 + '_' + (_0x126071 + 1)];
                if (_0x251625) {
                  _0x5022d9.push(_0x251625);
                }
              }
            }
          }
          if (_0x2bbd79 && _0x4db3f3 - _0x27332f <= _0x2bbd79 * _0x2c50ed) {
            _0x251625 = this.grids[_0x2bbd79 - 1 + '_' + _0x126071];
            if (_0x251625) {
              _0x5022d9.push(_0x251625);
            }
            if (_0x126071 && _0x208d3c - _0x27332f <= _0x126071 * _0x2c50ed) {
              _0x251625 = this.grids[_0x2bbd79 - 1 + '_' + (_0x126071 - 1)];
              if (_0x251625) {
                _0x5022d9.push(_0x251625);
              }
            } else {
              if (_0x208d3c + _0x27332f >= (_0x126071 + 1) * _0x2c50ed) {
                _0x251625 = this.grids[_0x2bbd79 - 1 + '_' + (_0x126071 + 1)];
                if (_0x251625) {
                  _0x5022d9.push(_0x251625);
                }
              }
            }
          }
          if (_0x208d3c + _0x27332f >= (_0x126071 + 1) * _0x2c50ed) {
            _0x251625 = this.grids[_0x2bbd79 + '_' + (_0x126071 + 1)];
            if (_0x251625) {
              _0x5022d9.push(_0x251625);
            }
          }
          if (_0x126071 && _0x208d3c - _0x27332f <= _0x126071 * _0x2c50ed) {
            _0x251625 = this.grids[_0x2bbd79 + '_' + (_0x126071 - 1)];
            if (_0x251625) {
              _0x5022d9.push(_0x251625);
            }
          }
        } catch (_0x12997e) {}
        return _0x5022d9;
      };
      var _0x218cc6;
      this.add = function (_0xdeaa83, _0x132b22, _0x3a9368, _0x131a62, _0x19ae57, _0x24c40a, _0x590bcf, _0xf31df6, _0x1d335e) {
        _0x218cc6 = null;
        for (var _0x2a71f5 = 0; _0x2a71f5 < _0xbc5a1b.length; ++_0x2a71f5) {
          if (_0xbc5a1b[_0x2a71f5].sid == _0xdeaa83) {
            _0x218cc6 = _0xbc5a1b[_0x2a71f5];
            break;
          }
        }
        if (!_0x218cc6) {
          for (var _0x2a71f5 = 0; _0x2a71f5 < _0xbc5a1b.length; ++_0x2a71f5) {
            if (!_0xbc5a1b[_0x2a71f5].active) {
              _0x218cc6 = _0xbc5a1b[_0x2a71f5];
              break;
            }
          }
        }
        if (!_0x218cc6) {
          _0x218cc6 = new _0x6e8214(_0xdeaa83);
          _0xbc5a1b.push(_0x218cc6);
        }
        if (_0xf31df6) {
          _0x218cc6.sid = _0xdeaa83;
        }
        _0x218cc6.init(_0x132b22, _0x3a9368, _0x131a62, _0x19ae57, _0x24c40a, _0x590bcf, _0x1d335e);
        if (_0x35c880) {
          this.setObjectGrids(_0x218cc6);
          if (_0x218cc6.doUpdate) {
            this.updateObjects.push(_0x218cc6);
          }
        }
      };
      this.disableBySid = function (_0x591a33) {
        for (var _0x3e9263 = 0; _0x3e9263 < _0xbc5a1b.length; ++_0x3e9263) {
          if (_0xbc5a1b[_0x3e9263].sid == _0x591a33) {
            this.disableObj(_0xbc5a1b[_0x3e9263]);
            break;
          }
        }
      };
      this.removeAllItems = function (_0x8031, _0x41eb69) {
        for (var _0x145d61 = 0; _0x145d61 < _0xbc5a1b.length; ++_0x145d61) {
          _0xbc5a1b[_0x145d61].active && _0xbc5a1b[_0x145d61].owner && _0xbc5a1b[_0x145d61].owner.sid == _0x8031 && this.disableObj(_0xbc5a1b[_0x145d61]);
        }
        if (_0x41eb69) {
          _0x41eb69.broadcast('13', _0x8031);
        }
      };
      this.fetchSpawnObj = function (_0x986f23) {
        var _0x325db5 = null;
        for (var _0x50e57a = 0; _0x50e57a < _0xbc5a1b.length; ++_0x50e57a) {
          _0x218cc6 = _0xbc5a1b[_0x50e57a];
          if (_0x218cc6.active && _0x218cc6.owner && _0x218cc6.owner.sid == _0x986f23 && _0x218cc6.spawnPoint) {
            _0x325db5 = [_0x218cc6.x, _0x218cc6.y];
            this.disableObj(_0x218cc6);
            _0x35c880.broadcast('12', _0x218cc6.sid);
            if (_0x218cc6.owner) {
              _0x218cc6.owner.changeItemCount(_0x218cc6.group.id, -1);
            }
            break;
          }
        }
        return _0x325db5;
      };
      this.checkItemLocation = function (_0x41f04d, _0xb40cb1, _0x69d2ad, _0x4fac7c, _0x429fc9, _0x34e0de, _0x11fd05) {
        for (var _0x488541 = 0; _0x488541 < _0xbc5a1b.length; ++_0x488541) {
          var _0x120316 = _0xbc5a1b[_0x488541].blocker ? _0xbc5a1b[_0x488541].blocker : _0xbc5a1b[_0x488541].getScale(_0x4fac7c, _0xbc5a1b[_0x488541].isItem);
          if (_0xbc5a1b[_0x488541].active && _0x335106.getDistance(_0x41f04d, _0xb40cb1, _0xbc5a1b[_0x488541].x, _0xbc5a1b[_0x488541].y) < _0x69d2ad + _0x120316) {
            return false;
          }
        }
        if (!_0x34e0de && _0x429fc9 != 18 && _0xb40cb1 >= _0x723814.mapScale / 2 - _0x723814.riverWidth / 2 && _0xb40cb1 <= _0x723814.mapScale / 2 + _0x723814.riverWidth / 2) {
          return false;
        }
        return true;
      };
      this.addProjectile = function (_0x41cc28, _0x401c18, _0x5eb0bb, _0x4a8741, _0x251506) {
        var _0x30c1cc = items.projectiles[_0x251506];
        var _0x349bbb;
        for (var _0x4da708 = 0; _0x4da708 < projectiles.length; ++_0x4da708) {
          if (!projectiles[_0x4da708].active) {
            _0x349bbb = projectiles[_0x4da708];
            break;
          }
        }
        !_0x349bbb && (_0x349bbb = new Projectile(_0x59d380, _0x335106), projectiles.push(_0x349bbb));
        _0x349bbb.init(_0x251506, _0x41cc28, _0x401c18, _0x5eb0bb, _0x30c1cc.speed, _0x4a8741, _0x30c1cc.scale);
      };
      this.checkCollision = function (_0x311a44, _0x4e81e2, _0x38bc1a) {
        _0x38bc1a = _0x38bc1a || 1;
        var _0x1b11d6 = _0x311a44.x - _0x4e81e2.x;
        var _0x142f0c = _0x311a44.y - _0x4e81e2.y;
        var _0x569d25 = _0x311a44.scale + _0x4e81e2.scale;
        if (_0x906055(_0x1b11d6) <= _0x569d25 || _0x906055(_0x142f0c) <= _0x569d25) {
          _0x569d25 = _0x311a44.scale + (_0x4e81e2.getScale ? _0x4e81e2.getScale() : _0x4e81e2.scale);
          var _0x2da459 = _0x4342c8(_0x1b11d6 * _0x1b11d6 + _0x142f0c * _0x142f0c) - _0x569d25;
          if (_0x2da459 <= 0) {
            if (!_0x4e81e2.ignoreCollision) {
              var _0x3e5b7a = _0x335106.getDirection(_0x311a44.x, _0x311a44.y, _0x4e81e2.x, _0x4e81e2.y);
              var _0x1de672 = _0x335106.getDistance(_0x311a44.x, _0x311a44.y, _0x4e81e2.x, _0x4e81e2.y);
              if (_0x4e81e2.isPlayer) {
                _0x2da459 = _0x2da459 * -1 / 2;
                _0x311a44.x += _0x2da459 * _0x43828d(_0x3e5b7a);
                _0x311a44.y += _0x2da459 * _0x1d47c4(_0x3e5b7a);
                _0x4e81e2.x -= _0x2da459 * _0x43828d(_0x3e5b7a);
                _0x4e81e2.y -= _0x2da459 * _0x1d47c4(_0x3e5b7a);
              } else {
                _0x311a44.x = _0x4e81e2.x + _0x569d25 * _0x43828d(_0x3e5b7a);
                _0x311a44.y = _0x4e81e2.y + _0x569d25 * _0x1d47c4(_0x3e5b7a);
                _0x311a44.xVel *= 0.75;
                _0x311a44.yVel *= 0.75;
              }
              if (_0x4e81e2.dmg && _0x4e81e2.owner != _0x311a44 && !(_0x4e81e2.owner && _0x4e81e2.owner.team && _0x4e81e2.owner.team == _0x311a44.team)) {
                _0x311a44.changeHealth(-_0x4e81e2.dmg, _0x4e81e2.owner, _0x4e81e2);
                var _0x372e0f = 1.5 * (_0x4e81e2.weightM || 1);
                _0x311a44.xVel += _0x372e0f * _0x43828d(_0x3e5b7a);
                _0x311a44.yVel += _0x372e0f * _0x1d47c4(_0x3e5b7a);
                _0x4e81e2.pDmg && !(_0x311a44.skin && _0x311a44.skin.poisonRes) && (_0x311a44.dmgOverTime.dmg = _0x4e81e2.pDmg, _0x311a44.dmgOverTime.time = 5, _0x311a44.dmgOverTime.doer = _0x4e81e2.owner);
                if (_0x311a44.colDmg && _0x4e81e2.health) {
                  if (_0x4e81e2.changeHealth(-_0x311a44.colDmg)) {
                    this.disableObj(_0x4e81e2);
                  }
                  this.hitObj(_0x4e81e2, _0x335106.getDirection(_0x311a44.x, _0x311a44.y, _0x4e81e2.x, _0x4e81e2.y));
                }
              }
            } else {
              if (_0x4e81e2.trap && !_0x311a44.noTrap && _0x4e81e2.owner != _0x311a44 && !(_0x4e81e2.owner && _0x4e81e2.owner.team && _0x4e81e2.owner.team == _0x311a44.team)) {
                _0x311a44.lockMove = true;
                _0x4e81e2.hideFromEnemy = false;
              } else {
                if (_0x4e81e2.boostSpeed) {
                  _0x311a44.xVel += _0x38bc1a * _0x4e81e2.boostSpeed * (_0x4e81e2.weightM || 1) * _0x43828d(_0x4e81e2.dir);
                  _0x311a44.yVel += _0x38bc1a * _0x4e81e2.boostSpeed * (_0x4e81e2.weightM || 1) * _0x1d47c4(_0x4e81e2.dir);
                } else {
                  if (_0x4e81e2.healCol) {
                    _0x311a44.healCol = _0x4e81e2.healCol;
                  } else {
                    _0x4e81e2.teleport && (_0x311a44.x = _0x335106.randInt(0, _0x723814.mapScale), _0x311a44.y = _0x335106.randInt(0, _0x723814.mapScale));
                  }
                }
              }
            }
            if (_0x4e81e2.zIndex > _0x311a44.zIndex) {
              _0x311a44.zIndex = _0x4e81e2.zIndex;
            }
            return true;
          }
        }
        return false;
      };
    };
  },
  './src/js/data/player.js': function (_0x2a365c, _0x195752, _0x57ad37) {
    var _0xd3e671 = _0x57ad37("./node_modules/bad-words/lib/badwords.js");
    var _0x2fcb4e = new _0xd3e671();
    var _0x1b5e82 = ["jew", "black", "baby", "child", "white", "porn", "pedo", "trump", "clinton", "hitler", "nazi", "gay", "pride", "sex", "pleasure", "touch", "poo", "kids", "rape", "white power", "nigga", "nig nog", "doggy", "rapist", "boner", "nigger", "nigg", "finger", "nogger", "nagger", "nig", "fag", "gai", "pole", "stripper", "penis", "vagina", "pussy", "nazi", "hitler", "stalin", "burn", "chamber", "cock", "peen", "dick", "spick", "nieger", "die", "satan", "n|ig", "nlg", "cunt", "c0ck", "fag", "lick", "condom", "anal", "shit", "phile", "little", "kids", "free KR", "tiny", "sidney", "ass", "kill", ".io", "(dot)", "[dot]", "mini", "whiore", "whore", "faggot", "github", "1337", "666", "satan", "senpa", "discord", "d1scord", "mistik", ".io", "senpa.io", "sidney", "sid", "senpaio", "vries", "asa"];
    _0x2fcb4e.addWords(..._0x1b5e82);
    var _0x1f0750 = Math.abs;
    var _0x1ce859 = Math.cos;
    var _0x240bb4 = Math.sin;
    var _0x475fc7 = Math.pow;
    var _0x1c496d = Math.sqrt;
    _0x2a365c.exports = function (_0x4fd6b3, _0x56c28e, _0x3f9644, _0x444502, _0xbc36c8, _0x1da4c1, _0x2fb476, _0x12fcba, _0x35b16, _0x3a0f0a, _0x583a5b, _0x5a64cb, _0x1a998d, _0x587b56) {
      this.id = _0x4fd6b3;
      this.sid = _0x56c28e;
      this.tmpScore = 0;
      this.team = null;
      this.skinIndex = 0;
      this.tailIndex = 0;
      this.hitTime = 0;
      this.tails = {};
      for (var _0x48dc02 = 0; _0x48dc02 < _0x583a5b.length; ++_0x48dc02) {
        if (_0x583a5b[_0x48dc02].price <= 0) {
          this.tails[_0x583a5b[_0x48dc02].id] = 1;
        }
      }
      this.skins = {};
      for (var _0x48dc02 = 0; _0x48dc02 < _0x3a0f0a.length; ++_0x48dc02) {
        if (_0x3a0f0a[_0x48dc02].price <= 0) {
          this.skins[_0x3a0f0a[_0x48dc02].id] = 1;
        }
      }
      this.points = 0;
      this.dt = 0;
      this.hidden = false;
      this.itemCounts = {};
      this.isPlayer = true;
      this.pps = 0;
      this.moveDir = undefined;
      this.skinRot = 0;
      this.lastPing = 0;
      this.iconIndex = 0;
      this.skinColor = 0;
      this.spawn = function (_0x47c477) {
        this.active = true;
        this.alive = true;
        this.lockMove = false;
        this.lockDir = false;
        this.minimapCounter = 0;
        this.chatCountdown = 0;
        this.shameCount = 0;
        this.shameTimer = 0;
        this.sentTo = {};
        this.gathering = 0;
        this.autoGather = 0;
        this.animTime = 0;
        this.animSpeed = 0;
        this.mouseState = 0;
        this.buildIndex = -1;
        this.weaponIndex = 0;
        this.dmgOverTime = {};
        this.noMovTimer = 0;
        this.maxXP = 300;
        this.XP = 0;
        this.age = 1;
        this.kills = 0;
        this.upgrAge = 2;
        this.upgradePoints = 0;
        this.x = 0;
        this.y = 0;
        this.zIndex = 0;
        this.xVel = 0;
        this.yVel = 0;
        this.slowMult = 1;
        this.dir = 0;
        this.dirPlus = 0;
        this.targetDir = 0;
        this.targetAngle = 0;
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.scale = _0x3f9644.playerScale;
        this.speed = _0x3f9644.playerSpeed;
        this.resetMoveDir();
        this.resetResources(_0x47c477);
        this.items = [0, 3, 6, 10];
        this.weapons = [0];
        this.shootCount = 0;
        this.weaponXP = [];
        this.reloads = {};
      };
      this.resetMoveDir = function () {
        this.moveDir = undefined;
      };
      this.resetResources = function (_0x6d728c) {
        for (var _0xa4ead9 = 0; _0xa4ead9 < _0x3f9644.resourceTypes.length; ++_0xa4ead9) {
          this[_0x3f9644.resourceTypes[_0xa4ead9]] = _0x6d728c ? 100 : 0;
        }
      };
      this.addItem = function (_0x4f7f22) {
        var _0x234f52 = _0x35b16.list[_0x4f7f22];
        if (_0x234f52) {
          for (var _0x52a072 = 0; _0x52a072 < this.items.length; ++_0x52a072) {
            if (_0x35b16.list[this.items[_0x52a072]].group == _0x234f52.group) {
              if (this.buildIndex == this.items[_0x52a072]) {
                this.buildIndex = _0x4f7f22;
              }
              this.items[_0x52a072] = _0x4f7f22;
              return true;
            }
          }
          this.items.push(_0x4f7f22);
          return true;
        }
        return false;
      };
      this.setUserData = function (_0x35a6d) {
        if (_0x35a6d) {
          this.name = "unknown";
          var _0xb04a47 = _0x35a6d.name + '';
          _0xb04a47 = _0xb04a47.slice(0, _0x3f9644.maxNameLength);
          _0xb04a47 = _0xb04a47.replace(/[^\w:\(\)\/? -]+/gmi, '\x20');
          _0xb04a47 = _0xb04a47.replace(/[^\x00-\x7F]/g, '\x20');
          _0xb04a47 = _0xb04a47.trim();
          var _0x268067 = false;
          var _0x1ffe24 = _0xb04a47.toLowerCase().replace(/\s/g, '').replace(/1/g, 'i').replace(/0/g, 'o').replace(/5/g, 's');
          for (var _0x3a9abc of _0x2fcb4e.list) {
            if (_0x1ffe24.indexOf(_0x3a9abc) != -1) {
              _0x268067 = true;
              break;
            }
          }
          _0xb04a47.length > 0 && !_0x268067 && (this.name = _0xb04a47);
          this.skinColor = 0;
          if (_0x3f9644.skinColors[_0x35a6d.skin]) {
            this.skinColor = _0x35a6d.skin;
          }
        }
      };
      this.getData = function () {
        return [this.id, this.sid, this.name, _0x444502.fixTo(this.x, 2), _0x444502.fixTo(this.y, 2), _0x444502.fixTo(this.dir, 3), this.health, this.maxHealth, this.scale, this.skinColor];
      };
      this.setData = function (_0x2adb62) {
        this.id = _0x2adb62[0];
        this.sid = _0x2adb62[1];
        this.name = _0x2adb62[2];
        this.x = _0x2adb62[3];
        this.y = _0x2adb62[4];
        this.dir = _0x2adb62[5];
        this.health = _0x2adb62[6];
        this.maxHealth = _0x2adb62[7];
        this.scale = _0x2adb62[8];
        this.skinColor = _0x2adb62[9];
      };
      var _0x2c99c0 = 0;
      this.update = function (_0x39030a) {
        if (!this.alive) {
          return;
        }
        this.shameTimer > 0 && (this.shameTimer -= _0x39030a, this.shameTimer <= 0 && (this.shameTimer = 0, this.shameCount = 0));
        _0x2c99c0 -= _0x39030a;
        if (_0x2c99c0 <= 0) {
          var _0x180314 = (this.skin && this.skin.healthRegen ? this.skin.healthRegen : 0) + (this.tail && this.tail.healthRegen ? this.tail.healthRegen : 0);
          _0x180314 && this.changeHealth(_0x180314, this);
          if (this.dmgOverTime.dmg) {
            this.changeHealth(-this.dmgOverTime.dmg, this.dmgOverTime.doer);
            this.dmgOverTime.time -= 1;
            if (this.dmgOverTime.time <= 0) {
              this.dmgOverTime.dmg = 0;
            }
          }
          this.healCol && this.changeHealth(this.healCol, this);
          _0x2c99c0 = 1000;
        }
        if (!this.alive) {
          return;
        }
        if (this.slowMult < 1) {
          this.slowMult += 0.0008 * _0x39030a;
          if (this.slowMult > 1) {
            this.slowMult = 1;
          }
        }
        this.noMovTimer += _0x39030a;
        if (this.xVel || this.yVel) {
          this.noMovTimer = 0;
        }
        if (this.lockMove) {
          this.xVel = 0;
          this.yVel = 0;
        } else {
          var _0x4f393c = (this.buildIndex >= 0 ? 0.5 : 1) * (_0x35b16.weapons[this.weaponIndex].spdMult || 1) * (this.skin ? this.skin.spdMult || 1 : 1) * (this.tail ? this.tail.spdMult || 1 : 1) * (this.y <= _0x3f9644.snowBiomeTop ? this.skin && this.skin.coldM ? 1 : _0x3f9644.snowSpeed : 1) * this.slowMult;
          !this.zIndex && this.y >= _0x3f9644.mapScale / 2 - _0x3f9644.riverWidth / 2 && this.y <= _0x3f9644.mapScale / 2 + _0x3f9644.riverWidth / 2 && (this.skin && this.skin.watrImm ? (_0x4f393c *= 0.75, this.xVel += _0x3f9644.waterCurrent * 0.4 * _0x39030a) : (_0x4f393c *= 0.33, this.xVel += _0x3f9644.waterCurrent * _0x39030a));
          var _0x358fb8 = this.moveDir != undefined ? _0x1ce859(this.moveDir) : 0;
          var _0xe00651 = this.moveDir != undefined ? _0x240bb4(this.moveDir) : 0;
          var _0x4ef85d = _0x1c496d(_0x358fb8 * _0x358fb8 + _0xe00651 * _0xe00651);
          _0x4ef85d != 0 && (_0x358fb8 /= _0x4ef85d, _0xe00651 /= _0x4ef85d);
          if (_0x358fb8) {
            this.xVel += _0x358fb8 * this.speed * _0x4f393c * _0x39030a;
          }
          if (_0xe00651) {
            this.yVel += _0xe00651 * this.speed * _0x4f393c * _0x39030a;
          }
        }
        this.zIndex = 0;
        this.lockMove = false;
        this.healCol = 0;
        var _0x1486c2;
        var _0xa8d2ca = _0x444502.getDistance(0, 0, this.xVel * _0x39030a, this.yVel * _0x39030a);
        var _0x4b9554 = Math.min(4, Math.max(1, Math.round(_0xa8d2ca / 40)));
        var _0x1ba1ba = 1 / _0x4b9554;
        for (var _0x15487c = 0; _0x15487c < _0x4b9554; ++_0x15487c) {
          if (this.xVel) {
            this.x += this.xVel * _0x39030a * _0x1ba1ba;
          }
          if (this.yVel) {
            this.y += this.yVel * _0x39030a * _0x1ba1ba;
          }
          _0x1486c2 = _0x1da4c1.getGridArrays(this.x, this.y, this.scale);
          for (var _0xacc0f5 = 0; _0xacc0f5 < _0x1486c2.length; ++_0xacc0f5) {
            for (var _0x2e07ac = 0; _0x2e07ac < _0x1486c2[_0xacc0f5].length; ++_0x2e07ac) {
              if (_0x1486c2[_0xacc0f5][_0x2e07ac].active) {
                _0x1da4c1.checkCollision(this, _0x1486c2[_0xacc0f5][_0x2e07ac], _0x1ba1ba);
              }
            }
          }
        }
        var _0x43c19d = _0x2fb476.indexOf(this);
        for (var _0x15487c = _0x43c19d + 1; _0x15487c < _0x2fb476.length; ++_0x15487c) {
          if (_0x2fb476[_0x15487c] != this && _0x2fb476[_0x15487c].alive) {
            _0x1da4c1.checkCollision(this, _0x2fb476[_0x15487c]);
          }
        }
        if (this.xVel) {
          this.xVel *= _0x475fc7(_0x3f9644.playerDecel, _0x39030a);
          if (this.xVel <= 0.01 && this.xVel >= -0.01) {
            this.xVel = 0;
          }
        }
        if (this.yVel) {
          this.yVel *= _0x475fc7(_0x3f9644.playerDecel, _0x39030a);
          if (this.yVel <= 0.01 && this.yVel >= -0.01) {
            this.yVel = 0;
          }
        }
        if (this.x - this.scale < 0) {
          this.x = this.scale;
        } else {
          this.x + this.scale > _0x3f9644.mapScale && (this.x = _0x3f9644.mapScale - this.scale);
        }
        if (this.y - this.scale < 0) {
          this.y = this.scale;
        } else {
          this.y + this.scale > _0x3f9644.mapScale && (this.y = _0x3f9644.mapScale - this.scale);
        }
        if (this.buildIndex < 0) {
          if (this.reloads[this.weaponIndex] > 0) {
            this.reloads[this.weaponIndex] -= _0x39030a;
            this.gathering = this.mouseState;
          } else {
            if (this.gathering || this.autoGather) {
              var _0x5be97c = true;
              if (_0x35b16.weapons[this.weaponIndex].gather != undefined) {
                this.gather(_0x2fb476);
              } else {
                if (_0x35b16.weapons[this.weaponIndex].projectile != undefined && this.hasRes(_0x35b16.weapons[this.weaponIndex], this.skin ? this.skin.projCost : 0)) {
                  this.useRes(_0x35b16.weapons[this.weaponIndex], this.skin ? this.skin.projCost : 0);
                  this.noMovTimer = 0;
                  var _0x43c19d = _0x35b16.weapons[this.weaponIndex].projectile;
                  var _0x5abe95 = this.scale * 2;
                  var _0x83d1a2 = this.skin && this.skin.aMlt ? this.skin.aMlt : 1;
                  _0x35b16.weapons[this.weaponIndex].rec && (this.xVel -= _0x35b16.weapons[this.weaponIndex].rec * _0x1ce859(this.dir), this.yVel -= _0x35b16.weapons[this.weaponIndex].rec * _0x240bb4(this.dir));
                  _0xbc36c8.addProjectile(this.x + _0x5abe95 * _0x1ce859(this.dir), this.y + _0x5abe95 * _0x240bb4(this.dir), this.dir, _0x35b16.projectiles[_0x43c19d].range * _0x83d1a2, _0x35b16.projectiles[_0x43c19d].speed * _0x83d1a2, _0x43c19d, this, null, this.zIndex);
                } else {
                  _0x5be97c = false;
                }
              }
              this.gathering = this.mouseState;
              _0x5be97c && (this.reloads[this.weaponIndex] = _0x35b16.weapons[this.weaponIndex].speed * (this.skin ? this.skin.atkSpd || 1 : 1));
            }
          }
        }
      };
      this.addWeaponXP = function (_0x36021a) {
        if (!this.weaponXP[this.weaponIndex]) {
          this.weaponXP[this.weaponIndex] = 0;
        }
        this.weaponXP[this.weaponIndex] += _0x36021a;
      };
      this.earnXP = function (_0x3eff61) {
        this.age < _0x3f9644.maxAge && (this.XP += _0x3eff61, this.XP >= this.maxXP ? (this.age < _0x3f9644.maxAge ? (this.age++, this.XP = 0, this.maxXP *= 1.2) : this.XP = this.maxXP, this.upgradePoints++, _0x5a64cb.send(this.id, '16', this.upgradePoints, this.upgrAge), _0x5a64cb.send(this.id, '15', this.XP, _0x444502.fixTo(this.maxXP, 1), this.age)) : _0x5a64cb.send(this.id, '15', this.XP));
      };
      this.changeHealth = function (_0x225e06, _0x118731) {
        if (_0x225e06 > 0 && this.health >= this.maxHealth) {
          return false;
        }
        if (_0x225e06 < 0 && this.skin) {
          _0x225e06 *= this.skin.dmgMult || 1;
        }
        if (_0x225e06 < 0 && this.tail) {
          _0x225e06 *= this.tail.dmgMult || 1;
        }
        if (_0x225e06 < 0) {
          this.hitTime = Date.now();
        }
        this.health += _0x225e06;
        this.health > this.maxHealth && (_0x225e06 -= this.health - this.maxHealth, this.health = this.maxHealth);
        if (this.health <= 0) {
          this.kill(_0x118731);
        }
        for (var _0x42abf9 = 0; _0x42abf9 < _0x2fb476.length; ++_0x42abf9) {
          if (this.sentTo[_0x2fb476[_0x42abf9].id]) {
            _0x5a64cb.send(_0x2fb476[_0x42abf9].id, 'h', this.sid, Math.round(this.health));
          }
        }
        _0x118731 && _0x118731.canSee(this) && !(_0x118731 == this && _0x225e06 < 0) && _0x5a64cb.send(_0x118731.id, 't', Math.round(this.x), Math.round(this.y), Math.round(-_0x225e06), 1);
        return true;
      };
      this.kill = function (_0x1e757b) {
        if (_0x1e757b && _0x1e757b.alive) {
          _0x1e757b.kills++;
          if (_0x1e757b.skin && _0x1e757b.skin.goldSteal) {
            _0x1a998d(_0x1e757b, Math.round(this.points / 2));
          } else {
            _0x1a998d(_0x1e757b, Math.round(this.age * 100 * (_0x1e757b.skin && _0x1e757b.skin.kScrM ? _0x1e757b.skin.kScrM : 1)));
          }
          _0x5a64cb.send(_0x1e757b.id, '9', "kills", _0x1e757b.kills, 1);
        }
        this.alive = false;
        _0x5a64cb.send(this.id, '11');
        _0x587b56();
      };
      this.addResource = function (_0x1c19f2, _0x30b7e9, _0x23ca4a) {
        if (!_0x23ca4a && _0x30b7e9 > 0) {
          this.addWeaponXP(_0x30b7e9);
        }
        _0x1c19f2 == 3 ? _0x1a998d(this, _0x30b7e9, true) : (this[_0x3f9644.resourceTypes[_0x1c19f2]] += _0x30b7e9, _0x5a64cb.send(this.id, '9', _0x3f9644.resourceTypes[_0x1c19f2], this[_0x3f9644.resourceTypes[_0x1c19f2]], 1));
      };
      this.changeItemCount = function (_0x3117a0, _0xd6458b) {
        this.itemCounts[_0x3117a0] = this.itemCounts[_0x3117a0] || 0;
        this.itemCounts[_0x3117a0] += _0xd6458b;
        _0x5a64cb.send(this.id, '14', _0x3117a0, this.itemCounts[_0x3117a0]);
      };
      this.buildItem = function (_0x5e23f9) {
        var _0x1ff022 = this.scale + _0x5e23f9.scale + (_0x5e23f9.placeOffset || 0);
        var _0x289186 = this.x + _0x1ff022 * _0x1ce859(this.dir);
        var _0x443361 = this.y + _0x1ff022 * _0x240bb4(this.dir);
        if (this.canBuild(_0x5e23f9) && !(_0x5e23f9.consume && this.skin && this.skin.noEat) && (_0x5e23f9.consume || _0x1da4c1.checkItemLocation(_0x289186, _0x443361, _0x5e23f9.scale, 0.6, _0x5e23f9.id, false, this))) {
          var _0x42a691 = false;
          if (_0x5e23f9.consume) {
            if (this.hitTime) {
              var _0x378ffd = Date.now() - this.hitTime;
              this.hitTime = 0;
              _0x378ffd <= 120 ? (this.shameCount++, this.shameCount >= 8 && (this.shameTimer = 30000, this.shameCount = 0)) : (this.shameCount -= 2, this.shameCount <= 0 && (this.shameCount = 0));
            }
            if (this.shameTimer <= 0) {
              _0x42a691 = _0x5e23f9.consume(this);
            }
          } else {
            _0x42a691 = true;
            _0x5e23f9.group.limit && this.changeItemCount(_0x5e23f9.group.id, 1);
            if (_0x5e23f9.pps) {
              this.pps += _0x5e23f9.pps;
            }
            _0x1da4c1.add(_0x1da4c1.objects.length, _0x289186, _0x443361, this.dir, _0x5e23f9.scale, _0x5e23f9.type, _0x5e23f9, false, this);
          }
          _0x42a691 && (this.useRes(_0x5e23f9), this.buildIndex = -1);
        }
      };
      this.hasRes = function (_0x1d3730, _0x16c6bc) {
        for (var _0x44c1df = 0; _0x44c1df < _0x1d3730.req.length;) {
          if (this[_0x1d3730.req[_0x44c1df]] < Math.round(_0x1d3730.req[_0x44c1df + 1] * (_0x16c6bc || 1))) {
            return false;
          }
          _0x44c1df += 2;
        }
        return true;
      };
      this.useRes = function (_0x1479b3, _0x223bfc) {
        if (_0x3f9644.inSandbox) {
          return;
        }
        for (var _0x48d9a9 = 0; _0x48d9a9 < _0x1479b3.req.length;) {
          this.addResource(_0x3f9644.resourceTypes.indexOf(_0x1479b3.req[_0x48d9a9]), -Math.round(_0x1479b3.req[_0x48d9a9 + 1] * (_0x223bfc || 1)));
          _0x48d9a9 += 2;
        }
      };
      this.canBuild = function (_0x2f5f89) {
        if (_0x3f9644.inSandbox) {
          return true;
        }
        if (_0x2f5f89.group.limit && this.itemCounts[_0x2f5f89.group.id] >= _0x2f5f89.group.limit) {
          return false;
        }
        return this.hasRes(_0x2f5f89);
      };
      this.gather = function () {
        this.noMovTimer = 0;
        this.slowMult -= _0x35b16.weapons[this.weaponIndex].hitSlow || 0.3;
        if (this.slowMult < 0) {
          this.slowMult = 0;
        }
        var _0x51a711 = _0x3f9644.fetchVariant(this);
        var _0x1d7ee0 = _0x51a711.poison;
        var _0x5326da = _0x51a711.val;
        var _0x50172c = {};
        var _0x18b827;
        var _0x1bf504;
        var _0x547eae;
        var _0x5c9dab;
        var _0x123996 = _0x1da4c1.getGridArrays(this.x, this.y, _0x35b16.weapons[this.weaponIndex].range);
        for (var _0x504cc4 = 0; _0x504cc4 < _0x123996.length; ++_0x504cc4) {
          for (var _0x486149 = 0; _0x486149 < _0x123996[_0x504cc4].length; ++_0x486149) {
            _0x547eae = _0x123996[_0x504cc4][_0x486149];
            if (_0x547eae.active && !_0x547eae.dontGather && !_0x50172c[_0x547eae.sid] && _0x547eae.visibleToPlayer(this)) {
              _0x18b827 = _0x444502.getDistance(this.x, this.y, _0x547eae.x, _0x547eae.y) - _0x547eae.scale;
              if (_0x18b827 <= _0x35b16.weapons[this.weaponIndex].range) {
                _0x1bf504 = _0x444502.getDirection(_0x547eae.x, _0x547eae.y, this.x, this.y);
                if (_0x444502.getAngleDist(_0x1bf504, this.dir) <= _0x3f9644.gatherAngle) {
                  _0x50172c[_0x547eae.sid] = 1;
                  if (_0x547eae.health) {
                    if (_0x547eae.changeHealth(-_0x35b16.weapons[this.weaponIndex].dmg * _0x5326da * (_0x35b16.weapons[this.weaponIndex].sDmg || 1) * (this.skin && this.skin.bDmg ? this.skin.bDmg : 1), this)) {
                      for (var _0xe1fba8 = 0; _0xe1fba8 < _0x547eae.req.length;) {
                        this.addResource(_0x3f9644.resourceTypes.indexOf(_0x547eae.req[_0xe1fba8]), _0x547eae.req[_0xe1fba8 + 1]);
                        _0xe1fba8 += 2;
                      }
                      _0x1da4c1.disableObj(_0x547eae);
                    }
                  } else {
                    this.earnXP(4 * _0x35b16.weapons[this.weaponIndex].gather);
                    var _0x272bba = _0x35b16.weapons[this.weaponIndex].gather + (_0x547eae.type == 3 ? 4 : 0);
                    this.skin && this.skin.extraGold && this.addResource(3, 1);
                    this.addResource(_0x547eae.type, _0x272bba);
                  }
                  _0x5c9dab = true;
                  _0x1da4c1.hitObj(_0x547eae, _0x1bf504);
                }
              }
            }
          }
        }
        for (var _0x486149 = 0; _0x486149 < _0x2fb476.length + _0x12fcba.length; ++_0x486149) {
          _0x547eae = _0x2fb476[_0x486149] || _0x12fcba[_0x486149 - _0x2fb476.length];
          if (_0x547eae != this && _0x547eae.alive && !(_0x547eae.team && _0x547eae.team == this.team)) {
            _0x18b827 = _0x444502.getDistance(this.x, this.y, _0x547eae.x, _0x547eae.y) - _0x547eae.scale * 1.8;
            if (_0x18b827 <= _0x35b16.weapons[this.weaponIndex].range) {
              _0x1bf504 = _0x444502.getDirection(_0x547eae.x, _0x547eae.y, this.x, this.y);
              if (_0x444502.getAngleDist(_0x1bf504, this.dir) <= _0x3f9644.gatherAngle) {
                var _0x2003c0 = _0x35b16.weapons[this.weaponIndex].steal;
                _0x2003c0 && _0x547eae.addResource && (_0x2003c0 = Math.min(_0x547eae.points || 0, _0x2003c0), this.addResource(3, _0x2003c0), _0x547eae.addResource(3, -_0x2003c0));
                var _0x18c472 = _0x5326da;
                _0x547eae.weaponIndex != undefined && _0x35b16.weapons[_0x547eae.weaponIndex].shield && _0x444502.getAngleDist(_0x1bf504 + Math.PI, _0x547eae.dir) <= _0x3f9644.shieldAngle && (_0x18c472 = _0x35b16.weapons[_0x547eae.weaponIndex].shield);
                var _0xc6bbba = _0x35b16.weapons[this.weaponIndex].dmg * (this.skin && this.skin.dmgMultO ? this.skin.dmgMultO : 1) * (this.tail && this.tail.dmgMultO ? this.tail.dmgMultO : 1);
                var _0x5dcb55 = 0.3 * (_0x547eae.weightM || 1) + (_0x35b16.weapons[this.weaponIndex].knock || 0);
                _0x547eae.xVel += _0x5dcb55 * _0x1ce859(_0x1bf504);
                _0x547eae.yVel += _0x5dcb55 * _0x240bb4(_0x1bf504);
                if (this.skin && this.skin.healD) {
                  this.changeHealth(_0xc6bbba * _0x18c472 * this.skin.healD, this);
                }
                if (this.tail && this.tail.healD) {
                  this.changeHealth(_0xc6bbba * _0x18c472 * this.tail.healD, this);
                }
                if (_0x547eae.skin && _0x547eae.skin.dmg && _0x18c472 == 1) {
                  this.changeHealth(-_0xc6bbba * _0x547eae.skin.dmg, _0x547eae);
                }
                if (_0x547eae.tail && _0x547eae.tail.dmg && _0x18c472 == 1) {
                  this.changeHealth(-_0xc6bbba * _0x547eae.tail.dmg, _0x547eae);
                }
                _0x547eae.dmgOverTime && this.skin && this.skin.poisonDmg && !(_0x547eae.skin && _0x547eae.skin.poisonRes) && (_0x547eae.dmgOverTime.dmg = this.skin.poisonDmg, _0x547eae.dmgOverTime.time = this.skin.poisonTime || 1, _0x547eae.dmgOverTime.doer = this);
                _0x547eae.dmgOverTime && _0x1d7ee0 && !(_0x547eae.skin && _0x547eae.skin.poisonRes) && (_0x547eae.dmgOverTime.dmg = 5, _0x547eae.dmgOverTime.time = 5, _0x547eae.dmgOverTime.doer = this);
                _0x547eae.skin && _0x547eae.skin.dmgK && (this.xVel -= _0x547eae.skin.dmgK * _0x1ce859(_0x1bf504), this.yVel -= _0x547eae.skin.dmgK * _0x240bb4(_0x1bf504));
                _0x547eae.changeHealth(-_0xc6bbba * _0x18c472, this, this);
              }
            }
          }
        }
        this.sendAnimation(_0x5c9dab ? 1 : 0);
      };
      this.sendAnimation = function (_0x482fcc) {
        for (var _0x3c9e29 = 0; _0x3c9e29 < _0x2fb476.length; ++_0x3c9e29) {
          this.sentTo[_0x2fb476[_0x3c9e29].id] && this.canSee(_0x2fb476[_0x3c9e29]) && _0x5a64cb.send(_0x2fb476[_0x3c9e29].id, '7', this.sid, _0x482fcc ? 1 : 0, this.weaponIndex);
        }
      };
      var _0x54c9ac = 0;
      var _0x3e89f8 = 0;
      this.animate = function (_0x27b5e1) {
        this.animTime > 0 && (this.animTime -= _0x27b5e1, this.animTime <= 0 ? (this.animTime = 0, this.dirPlus = 0, _0x54c9ac = 0, _0x3e89f8 = 0) : _0x3e89f8 == 0 ? (_0x54c9ac += _0x27b5e1 / (this.animSpeed * _0x3f9644.hitReturnRatio), this.dirPlus = _0x444502.lerp(0, this.targetAngle, Math.min(1, _0x54c9ac)), _0x54c9ac >= 1 && (_0x54c9ac = 1, _0x3e89f8 = 1)) : (_0x54c9ac -= _0x27b5e1 / (this.animSpeed * (1 - _0x3f9644.hitReturnRatio)), this.dirPlus = _0x444502.lerp(0, this.targetAngle, Math.max(0, _0x54c9ac))));
      };
      this.startAnim = function (_0x204919, _0x3104f3) {
        this.animTime = this.animSpeed = _0x35b16.weapons[_0x3104f3].speed;
        this.targetAngle = _0x204919 ? -_0x3f9644.hitAngle : -Math.PI;
        _0x54c9ac = 0;
        _0x3e89f8 = 0;
      };
      this.canSee = function (_0x28a263) {
        if (!_0x28a263) {
          return false;
        }
        if (_0x28a263.skin && _0x28a263.skin.invisTimer && _0x28a263.noMovTimer >= _0x28a263.skin.invisTimer) {
          return false;
        }
        var _0x1d144a = _0x1f0750(_0x28a263.x - this.x) - _0x28a263.scale;
        var _0x4d7fac = _0x1f0750(_0x28a263.y - this.y) - _0x28a263.scale;
        return _0x1d144a <= _0x3f9644.maxScreenWidth / 2 * 1.3 && _0x4d7fac <= _0x3f9644.maxScreenHeight / 2 * 1.3;
      };
    };
  },
  './src/js/data/projectile.js': function (_0xce9997, _0x379cb4) {
    _0xce9997.exports = function (_0x199cb5, _0x93df15, _0x1adfe4, _0x1ac635, _0x47820c, _0x1e08ce, _0x4f9c52) {
      this.init = function (_0x52c68a, _0x17e184, _0x1dd8bc, _0x15da06, _0x532894, _0x45106c, _0x1c46f, _0x57e2e2, _0x594039) {
        this.active = true;
        this.indx = _0x52c68a;
        this.x = _0x17e184;
        this.y = _0x1dd8bc;
        this.dir = _0x15da06;
        this.skipMov = true;
        this.speed = _0x532894;
        this.dmg = _0x45106c;
        this.scale = _0x57e2e2;
        this.range = _0x1c46f;
        this.owner = _0x594039;
        if (_0x4f9c52) {
          this.sentTo = {};
        }
      };
      var _0x1aa6a1 = [];
      var _0x41a207;
      this.update = function (_0x409579) {
        if (this.active) {
          var _0x205f8d = this.speed * _0x409579;
          var _0xa340a4;
          if (!this.skipMov) {
            this.x += _0x205f8d * Math.cos(this.dir);
            this.y += _0x205f8d * Math.sin(this.dir);
            this.range -= _0x205f8d;
            if (this.range <= 0) {
              this.x += this.range * Math.cos(this.dir);
              this.y += this.range * Math.sin(this.dir);
              _0x205f8d = 1;
              this.range = 0;
              this.active = false;
            }
          } else {
            this.skipMov = false;
          }
          if (_0x4f9c52) {
            for (var _0x1a199a = 0; _0x1a199a < _0x199cb5.length; ++_0x1a199a) {
              !this.sentTo[_0x199cb5[_0x1a199a].id] && _0x199cb5[_0x1a199a].canSee(this) && (this.sentTo[_0x199cb5[_0x1a199a].id] = 1, _0x4f9c52.send(_0x199cb5[_0x1a199a].id, '18', _0x1e08ce.fixTo(this.x, 1), _0x1e08ce.fixTo(this.y, 1), _0x1e08ce.fixTo(this.dir, 2), _0x1e08ce.fixTo(this.range, 1), this.speed, this.indx, this.layer, this.sid));
            }
            _0x1aa6a1.length = 0;
            for (var _0x1a199a = 0; _0x1a199a < _0x199cb5.length + _0x93df15.length; ++_0x1a199a) {
              _0x41a207 = _0x199cb5[_0x1a199a] || _0x93df15[_0x1a199a - _0x199cb5.length];
              _0x41a207.alive && _0x41a207 != this.owner && !(this.owner.team && _0x41a207.team == this.owner.team) && _0x1e08ce.lineInRect(_0x41a207.x - _0x41a207.scale, _0x41a207.y - _0x41a207.scale, _0x41a207.x + _0x41a207.scale, _0x41a207.y + _0x41a207.scale, this.x, this.y, this.x + _0x205f8d * Math.cos(this.dir), this.y + _0x205f8d * Math.sin(this.dir)) && _0x1aa6a1.push(_0x41a207);
            }
            var _0xb35a4d = _0x1adfe4.getGridArrays(this.x, this.y, this.scale);
            for (var _0x4741db = 0; _0x4741db < _0xb35a4d.length; ++_0x4741db) {
              for (var _0x5d0f28 = 0; _0x5d0f28 < _0xb35a4d[_0x4741db].length; ++_0x5d0f28) {
                _0x41a207 = _0xb35a4d[_0x4741db][_0x5d0f28];
                _0xa340a4 = _0x41a207.getScale();
                _0x41a207.active && !(this.ignoreObj == _0x41a207.sid) && this.layer <= _0x41a207.layer && _0x1aa6a1.indexOf(_0x41a207) < 0 && !_0x41a207.ignoreCollision && _0x1e08ce.lineInRect(_0x41a207.x - _0xa340a4, _0x41a207.y - _0xa340a4, _0x41a207.x + _0xa340a4, _0x41a207.y + _0xa340a4, this.x, this.y, this.x + _0x205f8d * Math.cos(this.dir), this.y + _0x205f8d * Math.sin(this.dir)) && _0x1aa6a1.push(_0x41a207);
              }
            }
            if (_0x1aa6a1.length > 0) {
              var _0x525354 = null;
              var _0x3769e7 = null;
              var _0x58647e = null;
              for (var _0x1a199a = 0; _0x1a199a < _0x1aa6a1.length; ++_0x1a199a) {
                _0x58647e = _0x1e08ce.getDistance(this.x, this.y, _0x1aa6a1[_0x1a199a].x, _0x1aa6a1[_0x1a199a].y);
                (_0x3769e7 == null || _0x58647e < _0x3769e7) && (_0x3769e7 = _0x58647e, _0x525354 = _0x1aa6a1[_0x1a199a]);
              }
              if (_0x525354.isPlayer || _0x525354.isAI) {
                var _0x53d3a4 = 0.3 * (_0x525354.weightM || 1);
                _0x525354.xVel += _0x53d3a4 * Math.cos(this.dir);
                _0x525354.yVel += _0x53d3a4 * Math.sin(this.dir);
                (_0x525354.weaponIndex == undefined || !(_0x1ac635.weapons[_0x525354.weaponIndex].shield && _0x1e08ce.getAngleDist(this.dir + Math.PI, _0x525354.dir) <= _0x47820c.shieldAngle)) && _0x525354.changeHealth(-this.dmg, this.owner, this.owner);
              } else {
                _0x525354.projDmg && _0x525354.health && _0x525354.changeHealth(-this.dmg) && _0x1adfe4.disableObj(_0x525354);
                for (var _0x1a199a = 0; _0x1a199a < _0x199cb5.length; ++_0x1a199a) {
                  if (_0x199cb5[_0x1a199a].active) {
                    if (_0x525354.sentTo[_0x199cb5[_0x1a199a].id]) {
                      if (_0x525354.active) {
                        if (_0x199cb5[_0x1a199a].canSee(_0x525354)) {
                          _0x4f9c52.send(_0x199cb5[_0x1a199a].id, '8', _0x1e08ce.fixTo(this.dir, 2), _0x525354.sid);
                        }
                      } else {
                        _0x4f9c52.send(_0x199cb5[_0x1a199a].id, '12', _0x525354.sid);
                      }
                    }
                    if (!_0x525354.active && _0x525354.owner == _0x199cb5[_0x1a199a]) {
                      _0x199cb5[_0x1a199a].changeItemCount(_0x525354.group.id, -1);
                    }
                  }
                }
              }
              this.active = false;
              for (var _0x1a199a = 0; _0x1a199a < _0x199cb5.length; ++_0x1a199a) {
                if (this.sentTo[_0x199cb5[_0x1a199a].id]) {
                  _0x4f9c52.send(_0x199cb5[_0x1a199a].id, '19', this.sid, _0x1e08ce.fixTo(_0x3769e7, 1));
                }
              }
            }
          }
        }
      };
    };
  },
  './src/js/data/projectileManager.js': function (_0x849aa9, _0x44b62f) {
    _0x849aa9.exports = function (_0x5e7bbd, _0x32b111, _0x3415a3, _0x577015, _0x4d294e, _0x20c545, _0x2a8ab6, _0x6212df, _0x1675b9) {
      this.addProjectile = function (_0x5fea9b, _0x4bdd81, _0x5d7c31, _0x1b89d0, _0x3ea6e8, _0xdb137, _0x36c1f9, _0x48462b, _0x5cbcb5) {
        var _0x131c3f = _0x20c545.projectiles[_0xdb137];
        var _0x340d15;
        for (var _0x2b0ec6 = 0; _0x2b0ec6 < _0x32b111.length; ++_0x2b0ec6) {
          if (!_0x32b111[_0x2b0ec6].active) {
            _0x340d15 = _0x32b111[_0x2b0ec6];
            break;
          }
        }
        !_0x340d15 && (_0x340d15 = new _0x5e7bbd(_0x3415a3, _0x577015, _0x4d294e, _0x20c545, _0x2a8ab6, _0x6212df, _0x1675b9), _0x340d15.sid = _0x32b111.length, _0x32b111.push(_0x340d15));
        _0x340d15.init(_0xdb137, _0x5fea9b, _0x4bdd81, _0x5d7c31, _0x3ea6e8, _0x131c3f.dmg, _0x1b89d0, _0x131c3f.scale, _0x36c1f9);
        _0x340d15.ignoreObj = _0x48462b;
        _0x340d15.layer = _0x5cbcb5 || _0x131c3f.layer;
        _0x340d15.src = _0x131c3f.src;
        return _0x340d15;
      };
    };
  },
  './src/js/data/store.js': function (_0x286958, _0x544535) {
    var _0x5ecc41 = {
      id: 0x2d,
      name: "Shame!",
      dontSell: true,
      price: 0x0,
      scale: 0x78,
      desc: "hacks are for losers"
    };
    var _0x54dc18 = {
      id: 0x1f,
      name: "Flipper Hat",
      price: 0x9c4,
      scale: 0x78,
      desc: "have more control while in water",
      watrImm: true
    };
    var _0x2b93fb = {
      id: 0x7,
      name: "Bull Helmet",
      price: 0x1770,
      scale: 0x78,
      desc: "increases damage done but drains health",
      healthRegen: -5,
      dmgMultO: 1.5,
      spdMult: 0.96
    };
    var _0x3469c0 = {
      id: 0xe,
      name: "Windmill Hat",
      topSprite: true,
      price: 0x2710,
      scale: 0x78,
      desc: "generates points while worn",
      pps: 1.5
    };
    var _0x4d4ff7 = {
      id: 0xb,
      name: "Spike Gear",
      topSprite: true,
      price: 0x2710,
      scale: 0x78,
      desc: "deal damage to players that damage you",
      dmg: 0.45
    };
    var _0x33262e = {
      id: 0x35,
      name: "Turret Gear",
      topSprite: true,
      price: 0x2710,
      scale: 0x78,
      desc: "you become a walking turret",
      turret: {
        proj: 0x1,
        range: 0x2bc,
        rate: 0x9c4
      },
      spdMult: 0.7
    };
    var _0x343014 = {
      id: 0x38,
      name: "Assassin Gear",
      price: 0x4e20,
      scale: 0x78,
      desc: "Go invisible when not moving. Can't eat. Increased speed",
      noEat: true,
      spdMult: 1.1,
      invisTimer: 0x3e8
    };
    _0x286958.exports.hats = [_0x5ecc41, {
      id: 0x33,
      name: "Moo Cap",
      price: 0x0,
      scale: 0x78,
      desc: "coolest mooer around"
    }, {
      id: 0x32,
      name: "Apple Cap",
      price: 0x0,
      scale: 0x78,
      desc: "apple farms remembers"
    }, {
      id: 0x1c,
      name: "Moo Head",
      price: 0x0,
      scale: 0x78,
      desc: "no effect"
    }, {
      id: 0x1d,
      name: "Pig Head",
      price: 0x0,
      scale: 0x78,
      desc: "no effect"
    }, {
      id: 0x1e,
      name: "Fluff Head",
      price: 0x0,
      scale: 0x78,
      desc: "no effect"
    }, {
      id: 0x24,
      name: "Pandou Head",
      price: 0x0,
      scale: 0x78,
      desc: "no effect"
    }, {
      id: 0x25,
      name: "Bear Head",
      price: 0x0,
      scale: 0x78,
      desc: "no effect"
    }, {
      id: 0x26,
      name: "Monkey Head",
      price: 0x0,
      scale: 0x78,
      desc: "no effect"
    }, {
      id: 0x2c,
      name: "Polar Head",
      price: 0x0,
      scale: 0x78,
      desc: "no effect"
    }, {
      id: 0x23,
      name: "Fez Hat",
      price: 0x0,
      scale: 0x78,
      desc: "no effect"
    }, {
      id: 0x2a,
      name: "Enigma Hat",
      price: 0x0,
      scale: 0x78,
      desc: "join the enigma army"
    }, {
      id: 0x2b,
      name: "Blitz Hat",
      price: 0x0,
      scale: 0x78,
      desc: "hey everybody i'm blitz"
    }, {
      id: 0x31,
      name: "Bob XIII Hat",
      price: 0x0,
      scale: 0x78,
      desc: "like and subscribe"
    }, {
      id: 0x39,
      name: "Pumpkin",
      price: 0x32,
      scale: 0x78,
      desc: "Spooooky"
    }, {
      id: 0x8,
      name: "Bummle Hat",
      price: 0x64,
      scale: 0x78,
      desc: "no effect"
    }, {
      id: 0x2,
      name: "Straw Hat",
      price: 0x1f4,
      scale: 0x78,
      desc: "no effect"
    }, {
      id: 0xf,
      name: "Winter Cap",
      price: 0x258,
      scale: 0x78,
      desc: "allows you to move at normal speed in snow",
      coldM: 0x1
    }, {
      id: 0x5,
      name: "Cowboy Hat",
      price: 0x3e8,
      scale: 0x78,
      desc: "no effect"
    }, {
      id: 0x4,
      name: "Ranger Hat",
      price: 0x7d0,
      scale: 0x78,
      desc: "no effect"
    }, {
      id: 0x12,
      name: "Explorer Hat",
      price: 0x7d0,
      scale: 0x78,
      desc: "no effect"
    }, _0x54dc18, {
      id: 0x1,
      name: "Marksman Cap",
      price: 0xbb8,
      scale: 0x78,
      desc: "increases arrow speed and range",
      aMlt: 1.3
    }, {
      id: 0xa,
      name: "Bush Gear",
      price: 0xbb8,
      scale: 0xa0,
      desc: "allows you to disguise yourself as a bush"
    }, {
      id: 0x30,
      name: "Halo",
      price: 0xbb8,
      scale: 0x78,
      desc: "no effect"
    }, {
      id: 0x6,
      name: "Soldier Helmet",
      price: 0xfa0,
      scale: 0x78,
      desc: "reduces damage taken but slows movement",
      spdMult: 0.94,
      dmgMult: 0.75
    }, {
      id: 0x17,
      name: "Anti Venom Gear",
      price: 0xfa0,
      scale: 0x78,
      desc: "makes you immune to poison",
      poisonRes: 0x1
    }, {
      id: 0xd,
      name: "Medic Gear",
      price: 0x1388,
      scale: 0x6e,
      desc: "slowly regenerates health over time",
      healthRegen: 0x3
    }, {
      id: 0x9,
      name: "Miners Helmet",
      price: 0x1388,
      scale: 0x78,
      desc: "earn 1 extra gold per resource",
      extraGold: 0x1
    }, {
      id: 0x20,
      name: "Musketeer Hat",
      price: 0x1388,
      scale: 0x78,
      desc: "reduces cost of projectiles",
      projCost: 0.5
    }, _0x2b93fb, {
      id: 0x16,
      name: "Emp Helmet",
      price: 0x1770,
      scale: 0x78,
      desc: "turrets won't attack but you move slower",
      antiTurret: 0x1,
      spdMult: 0.7
    }, {
      id: 0xc,
      name: "Booster Hat",
      price: 0x1770,
      scale: 0x78,
      desc: "increases your movement speed",
      spdMult: 1.16
    }, {
      id: 0x1a,
      name: "Barbarian Armor",
      price: 0x1f40,
      scale: 0x78,
      desc: "knocks back enemies that attack you",
      dmgK: 0.6
    }, {
      id: 0x15,
      name: "Plague Mask",
      price: 0x2710,
      scale: 0x78,
      desc: "melee attacks deal poison damage",
      poisonDmg: 0x5,
      poisonTime: 0x6
    }, {
      id: 0x2e,
      name: "Bull Mask",
      price: 0x2710,
      scale: 0x78,
      desc: "bulls won't target you unless you attack them",
      bullRepel: 0x1
    }, _0x3469c0, _0x4d4ff7, _0x33262e, {
      id: 0x14,
      name: "Samurai Armor",
      price: 0x2ee0,
      scale: 0x78,
      desc: "increased attack speed and fire rate",
      atkSpd: 0.78
    }, {
      id: 0x3a,
      name: "Dark Knight",
      price: 0x2ee0,
      scale: 0x78,
      desc: "restores health when you deal damage",
      healD: 0.4
    }, {
      id: 0x1b,
      name: "Scavenger Gear",
      price: 0x3a98,
      scale: 0x78,
      desc: "earn double points for each kill",
      kScrM: 0x2
    }, {
      id: 0x28,
      name: "Tank Gear",
      price: 0x3a98,
      scale: 0x78,
      desc: "increased damage to buildings but slower movement",
      spdMult: 0.3,
      bDmg: 3.3
    }, {
      id: 0x34,
      name: "Thief Gear",
      price: 0x3a98,
      scale: 0x78,
      desc: "steal half of a players gold when you kill them",
      goldSteal: 0.5
    }, {
      id: 0x37,
      name: "Bloodthirster",
      price: 0x4e20,
      scale: 0x78,
      desc: "Restore Health when dealing damage. And increased damage",
      healD: 0.25,
      dmgMultO: 1.2
    }, _0x343014];
    var _0x2fbce1 = {
      id: 0x10,
      name: "Sawblade",
      price: 0x2ee0,
      scale: 0x5a,
      spin: true,
      xOff: 0x0,
      desc: "deal damage to players that damage you",
      dmg: 0.15
    };
    _0x286958.exports.accessories = [{
      id: 0xc,
      name: "Snowball",
      price: 0x3e8,
      scale: 0x69,
      xOff: 0x12,
      desc: "no effect"
    }, {
      id: 0x9,
      name: "Tree Cape",
      price: 0x3e8,
      scale: 0x5a,
      desc: "no effect"
    }, {
      id: 0xa,
      name: "Stone Cape",
      price: 0x3e8,
      scale: 0x5a,
      desc: "no effect"
    }, {
      id: 0x3,
      name: "Cookie Cape",
      price: 0x5dc,
      scale: 0x5a,
      desc: "no effect"
    }, {
      id: 0x8,
      name: "Cow Cape",
      price: 0x7d0,
      scale: 0x5a,
      desc: "no effect"
    }, {
      id: 0xb,
      name: "Monkey Tail",
      price: 0x7d0,
      scale: 0x61,
      xOff: 0x19,
      desc: "Super speed but reduced damage",
      spdMult: 1.35,
      dmgMultO: 0.2
    }, {
      id: 0x11,
      name: "Apple Basket",
      price: 0xbb8,
      scale: 0x50,
      xOff: 0xc,
      desc: "slowly regenerates health over time",
      healthRegen: 0x1
    }, {
      id: 0x6,
      name: "Winter Cape",
      price: 0xbb8,
      scale: 0x5a,
      desc: "no effect"
    }, {
      id: 0x4,
      name: "Skull Cape",
      price: 0xfa0,
      scale: 0x5a,
      desc: "no effect"
    }, {
      id: 0x5,
      name: "Dash Cape",
      price: 0x1388,
      scale: 0x5a,
      desc: "no effect"
    }, {
      id: 0x2,
      name: "Dragon Cape",
      price: 0x1770,
      scale: 0x5a,
      desc: "no effect"
    }, {
      id: 0x1,
      name: "Super Cape",
      price: 0x1f40,
      scale: 0x5a,
      desc: "no effect"
    }, {
      id: 0x7,
      name: "Troll Cape",
      price: 0x1f40,
      scale: 0x5a,
      desc: "no effect"
    }, {
      id: 0xe,
      name: "Thorns",
      price: 0x2710,
      scale: 0x73,
      xOff: 0x14,
      desc: "no effect"
    }, {
      id: 0xf,
      name: "Blockades",
      price: 0x2710,
      scale: 0x5f,
      xOff: 0xf,
      desc: "no effect"
    }, {
      id: 0x14,
      name: "Devils Tail",
      price: 0x2710,
      scale: 0x5f,
      xOff: 0x14,
      desc: "no effect"
    }, _0x2fbce1, {
      id: 0xd,
      name: "Angel Wings",
      price: 0x3a98,
      scale: 0x8a,
      xOff: 0x16,
      desc: "slowly regenerates health over time",
      healthRegen: 0x3
    }, {
      id: 0x13,
      name: "Shadow Wings",
      price: 0x3a98,
      scale: 0x8a,
      xOff: 0x16,
      desc: "increased movement speed",
      spdMult: 1.1
    }, {
      id: 0x12,
      name: "Blood Wings",
      price: 0x4e20,
      scale: 0xb2,
      xOff: 0x1a,
      desc: "restores health when you deal damage",
      healD: 0.2
    }, {
      id: 0x15,
      name: "Corrupt X Wings",
      price: 0x4e20,
      scale: 0xb2,
      xOff: 0x1a,
      desc: "deal damage to players that damage you",
      dmg: 0.25
    }];
  },
  './src/js/libs/animText.js': function (_0x4f5f17, _0x195580) {
    _0x4f5f17.exports.AnimText = function () {
      this.init = function (_0xcd2ade, _0x41adac, _0xe0f468, _0x562ea8, _0x14b04a, _0x3e195e, _0x1c0f49) {
        this.x = _0xcd2ade;
        this.y = _0x41adac;
        this.color = _0x1c0f49;
        this.scale = _0xe0f468;
        this.startScale = this.scale;
        this.maxScale = _0xe0f468 * 1.5;
        this.scaleSpeed = 0.7;
        this.speed = _0x562ea8;
        this.life = _0x14b04a;
        this.text = _0x3e195e;
      };
      this.update = function (_0x1709dd) {
        if (this.life) {
          this.life -= _0x1709dd;
          this.y -= this.speed * _0x1709dd;
          this.scale += this.scaleSpeed * _0x1709dd;
          if (this.scale >= this.maxScale) {
            this.scale = this.maxScale;
            this.scaleSpeed *= -1;
          } else {
            this.scale <= this.startScale && (this.scale = this.startScale, this.scaleSpeed = 0);
          }
          this.life <= 0 && (this.life = 0);
        }
      };
      this.render = function (_0xe4dd67, _0x367caf, _0x249269) {
        _0xe4dd67.fillStyle = this.color;
        _0xe4dd67.font = this.scale + "px Hammersmith One";
        _0xe4dd67.strokeText(this.text, this.x - _0x367caf, this.y - _0x249269);
        _0xe4dd67.fillText(this.text, this.x - _0x367caf, this.y - _0x249269);
      };
    };
    _0x4f5f17.exports.TextManager = function () {
      this.texts = [];
      this.update = function (_0x3dc966, _0x41536f, _0x25b1d5, _0x2d4f76) {
        _0x41536f.textBaseline = "middle";
        _0x41536f.textAlign = "center";
        for (var _0x59be3e = 0; _0x59be3e < this.texts.length; ++_0x59be3e) {
          this.texts[_0x59be3e].life && (this.texts[_0x59be3e].update(_0x3dc966), this.texts[_0x59be3e].render(_0x41536f, _0x25b1d5, _0x2d4f76));
        }
      };
      this.showText = function (_0x454738, _0x59ec04, _0x1ece2b, _0x1ae5f9, _0x3b1fef, _0x5a8070, _0x2b6a09) {
        var _0x269abb;
        for (var _0x304c01 = 0; _0x304c01 < this.texts.length; ++_0x304c01) {
          if (!this.texts[_0x304c01].life) {
            _0x269abb = this.texts[_0x304c01];
            break;
          }
        }
        !_0x269abb && (_0x269abb = new _0x4f5f17.exports.AnimText(), this.texts.push(_0x269abb));
        _0x269abb.init(_0x454738, _0x59ec04, _0x1ece2b, _0x1ae5f9, _0x3b1fef, _0x5a8070, _0x2b6a09);
      };
    };
  },
  './src/js/libs/io-client.js': function (_0xc84297, _0x19d2bb, _0x546b8e) {
    var _0x42e0ef = _0x546b8e("./node_modules/msgpack-lite/lib/browser.js");
    var _0x2bd0f2 = _0x546b8e("./src/js/config.js");
    _0xc84297.exports = {
      socket: null,
      connected: false,
      proto: null,
      socketId: -1,
      connect: function (_0x1b9f5d, _0x5dea48, _0x54e712) {
        if (this.socket) {
          return;
        }
        var _0x41d620 = this;
        try {
          var _0x559c2f = false;
          var _0x3a832d = _0x1b9f5d;
          this.socket = new WebSocket(_0x3a832d);
          this.socket.binaryType = "arraybuffer";
          var _0xreadyFired = false;
          this.socket.onmessage = function (_0x37e4da) {
            var _0x5fe955 = _0x42e0ef.decode(new Uint8Array(_0x37e4da.data));
            var _0x12256e = _0x5fe955[0];
            var _0x1126b9 = _0x5fe955[1];
            if (_0x12256e === "io-init") {
              _0x41d620.socketId = _0x1126b9[0];
              _0x41d620.proto = window.Ae86Proto.createState(_0x1126b9);
              if (!_0xreadyFired) {
                _0xreadyFired = true;
                _0x5dea48();
              }
              return;
            }
            var _0xname = window.Ae86Proto.decodeName(_0x41d620.proto, _0x12256e);
            if (_0xname === undefined) {
              return;
            }
            var _0xhandler = _0x54e712[_0xname];
            if (_0xhandler) {
              _0xhandler.apply(undefined, _0x1126b9);
            }
          };
          this.socket.onopen = function () {
            _0x41d620.connected = true;
          };
          this.socket.onclose = function (_0x434637) {
            _0x41d620.connected = false;
            if (_0x434637.code == 4001) {
              _0x5dea48("Invalid Connection");
            } else {
              !_0x559c2f && _0x5dea48("disconnected");
            }
          };
          this.socket.onerror = function (_0x3c4468) {
            this.socket && this.socket.readyState != WebSocket.OPEN && (_0x559c2f = true, console.error("Socket error", arguments), _0x5dea48("Socket error"));
          };
        } catch (_0x2d1bbd) {
          console.warn("Socket connection error:", _0x2d1bbd);
          _0x5dea48(_0x2d1bbd);
        }
      },
      send: function (_0x31ae90) {
        if (antiKick && secPacket < 100 && minPacket < 5400 || !antiKick) {
          var _0x5ec4f3 = Array.prototype.slice.call(arguments, 1);
          var _0x10a29a = window.Ae86Proto.encodeFrame(this.proto, function (_0xv) {
            return _0x42e0ef.encode(_0xv);
          }, _0x31ae90, _0x5ec4f3);
          if (!_0x10a29a) {
            return;
          }
          this.socket.send(_0x10a29a);
          minPacket++;
          secPacket++;
          pktSended++;
        }
      },
      bSend: function (_0x2706d4) {},
      socketReady: function () {
        return this.socket && this.connected;
      },
      close: function () {
        this.socket && this.socket.close();
        this.socket = null;
        this.connected = false;
        this.proto = null;
      }
    };
  },
  './src/js/libs/modernizr.js': function (_0x124f0b, _0x2780ef) {
    !function (_0x473280, _0x38a19a, _0x36bd5a) {
      function _0x22e566(_0x2822a6, _0x3f11d4) {
        return typeof _0x2822a6 === _0x3f11d4;
      }
      function _0x194292() {
        var _0x5a9e93;
        var _0x8c2741;
        var _0xc40da0;
        var _0x199229;
        var _0x283f8e;
        var _0x115e38;
        var _0x10d7fe;
        for (var _0x4c9451 in _0x3aeb26) {
          if (_0x3aeb26.hasOwnProperty(_0x4c9451)) {
            _0x5a9e93 = [];
            _0x8c2741 = _0x3aeb26[_0x4c9451];
            if (_0x8c2741.name && (_0x5a9e93.push(_0x8c2741.name.toLowerCase()), _0x8c2741.options && _0x8c2741.options.aliases && _0x8c2741.options.aliases.length)) {
              for (_0xc40da0 = 0; _0xc40da0 < _0x8c2741.options.aliases.length; _0xc40da0++) {
                _0x5a9e93.push(_0x8c2741.options.aliases[_0xc40da0].toLowerCase());
              }
            }
            _0x199229 = _0x22e566(_0x8c2741.fn, "function") ? _0x8c2741.fn() : _0x8c2741.fn;
            _0x283f8e = 0;
            for (; _0x283f8e < _0x5a9e93.length; _0x283f8e++) {
              _0x115e38 = _0x5a9e93[_0x283f8e];
              _0x10d7fe = _0x115e38.split('.');
              1 === _0x10d7fe.length ? _0x5bf6db[_0x10d7fe[0]] = _0x199229 : (!_0x5bf6db[_0x10d7fe[0]] || _0x5bf6db[_0x10d7fe[0]] instanceof Boolean || (_0x5bf6db[_0x10d7fe[0]] = new Boolean(_0x5bf6db[_0x10d7fe[0]])), _0x5bf6db[_0x10d7fe[0]][_0x10d7fe[1]] = _0x199229);
              _0x45bd30.push((_0x199229 ? '' : "no-") + _0x10d7fe.join('-'));
            }
          }
        }
      }
      function _0x2aaec4(_0x3f8db8) {
        var _0x57ae1d = _0x5dc1ba.className;
        var _0x31f17b = _0x5bf6db._config.classPrefix || '';
        _0x50958b && (_0x57ae1d = _0x57ae1d.baseVal);
        if (_0x5bf6db._config.enableJSClass) {
          var _0x1cfc8c = new RegExp("(^|\\s)" + _0x31f17b + "no-js(\\s|$)");
          _0x57ae1d = _0x57ae1d.replace(_0x1cfc8c, '$1' + _0x31f17b + "js$2");
        }
        _0x5bf6db._config.enableClasses && (_0x57ae1d += '\x20' + _0x31f17b + _0x3f8db8.join('\x20' + _0x31f17b), _0x50958b ? _0x5dc1ba.className.baseVal = _0x57ae1d : _0x5dc1ba.className = _0x57ae1d);
      }
      var _0x2ecdf1 = {
        classPrefix: '',
        enableClasses: true,
        enableJSClass: true,
        usePrefixes: true
      };
      var _0x45bd30 = [];
      var _0x3aeb26 = [];
      var _0x124df4 = {
        _version: "3.5.0",
        _config: _0x2ecdf1,
        _q: [],
        on: function (_0x155419, _0x1ecd1e) {
          var _0x5cd627 = this;
          setTimeout(function () {
            _0x1ecd1e(_0x5cd627[_0x155419]);
          }, 0);
        },
        addTest: function (_0x2077f5, _0x5e410f, _0x5e03a9) {
          var _0x457d11 = {
            name: _0x2077f5,
            fn: _0x5e410f,
            options: _0x5e03a9
          };
          _0x3aeb26.push(_0x457d11);
        },
        addAsyncTest: function (_0x25b8d9) {
          var _0xbed23 = {
            name: null,
            fn: _0x25b8d9
          };
          _0x3aeb26.push(_0xbed23);
        }
      };
      function _0x5bf6db() {}
      _0x5bf6db.prototype = _0x124df4;
      _0x5bf6db = new _0x5bf6db();
      var _0x5dc1ba = _0x38a19a.documentElement;
      var _0x50958b = "svg" === _0x5dc1ba.nodeName.toLowerCase();
      _0x5bf6db.addTest("passiveeventlisteners", function () {
        var _0x180702 = false;
        try {
          var _0x4d399f = {
            get: function () {
              _0x180702 = true;
            }
          };
          var _0x50bde6 = Object.defineProperty({}, "passive", _0x4d399f);
          _0x473280.addEventListener("test", null, _0x50bde6);
        } catch (_0x392d83) {}
        return _0x180702;
      });
      _0x194292();
      _0x2aaec4(_0x45bd30);
      delete _0x124df4.addTest;
      delete _0x124df4.addAsyncTest;
      for (var _0x24e1e7 = 0; _0x24e1e7 < _0x5bf6db._q.length; _0x24e1e7++) {
        _0x5bf6db._q[_0x24e1e7]();
      }
      _0x473280.Modernizr = _0x5bf6db;
    }(window, document);
  },
  './src/js/libs/soundManager.js': function (_0x1f50db, _0x1ad136) {
    _0x1f50db.exports.obj = function (_0x13af2f, _0x508450) {
      var _0x4530a6;
      this.sounds = [];
      this.active = true;
      this.play = function (_0x1cba7b, _0x2ea3ba, _0x565377) {
        if (!_0x2ea3ba || !this.active) {
          return;
        }
        _0x4530a6 = this.sounds[_0x1cba7b];
        !_0x4530a6 && (_0x4530a6 = new Howl({
          src: ".././sound/" + _0x1cba7b + ".mp3"
        }), this.sounds[_0x1cba7b] = _0x4530a6);
        (!_0x565377 || !_0x4530a6.isPlaying) && (_0x4530a6.isPlaying = true, _0x4530a6.play(), _0x4530a6.volume((_0x2ea3ba || 1) * _0x13af2f.volumeMult), _0x4530a6.loop(_0x565377));
      };
      this.toggleMute = function (_0x219a11, _0x5cdf3b) {
        _0x4530a6 = this.sounds[_0x219a11];
        if (_0x4530a6) {
          _0x4530a6.mute(_0x5cdf3b);
        }
      };
      this.stop = function (_0x3b261d) {
        _0x4530a6 = this.sounds[_0x3b261d];
        _0x4530a6 && (_0x4530a6.stop(), _0x4530a6.isPlaying = false);
      };
    };
  },
  './src/js/libs/utils.js': function (_0xfe526a, _0xf9c6a5) {
    var _0x5c1453 = Math.abs;
    var _0x2e6f0f = Math.cos;
    var _0x5c211d = Math.sin;
    var _0xd6fb9b = Math.pow;
    var _0xe11950 = Math.sqrt;
    var _0x5c1453 = Math.abs;
    var _0x3f14a9 = Math.atan2;
    var _0x25a1ae = Math.PI;
    _0xfe526a.exports.randInt = function (_0x16f2cd, _0x3a62fe) {
      return Math.floor(Math.random() * (_0x3a62fe - _0x16f2cd + 1)) + _0x16f2cd;
    };
    _0xfe526a.exports.randFloat = function (_0xc7c453, _0x50f5bb) {
      return Math.random() * (_0x50f5bb - _0xc7c453 + 1) + _0xc7c453;
    };
    _0xfe526a.exports.lerp = function (_0x3a92b4, _0x228b51, _0x3959d0) {
      return _0x3a92b4 + (_0x228b51 - _0x3a92b4) * _0x3959d0;
    };
    _0xfe526a.exports.decel = function (_0x47c0ec, _0x2cb335) {
      if (_0x47c0ec > 0) {
        _0x47c0ec = Math.max(0, _0x47c0ec - _0x2cb335);
      } else {
        if (_0x47c0ec < 0) {
          _0x47c0ec = Math.min(0, _0x47c0ec + _0x2cb335);
        }
      }
      return _0x47c0ec;
    };
    _0xfe526a.exports.getDistance = function (_0x504299, _0x231b90, _0x8630b0, _0x1065be) {
      return _0xe11950((_0x8630b0 -= _0x504299) * _0x8630b0 + (_0x1065be -= _0x231b90) * _0x1065be);
    };
    _0xfe526a.exports.getDirection = function (_0x230c9d, _0x26e6a4, _0x2c234f, _0x4d34fd) {
      return _0x3f14a9(_0x26e6a4 - _0x4d34fd, _0x230c9d - _0x2c234f);
    };
    _0xfe526a.exports.getAngleDist = function (_0x1f7c60, _0x335f32) {
      var _0x260e05 = _0x5c1453(_0x335f32 - _0x1f7c60) % (_0x25a1ae * 2);
      return _0x260e05 > _0x25a1ae ? _0x25a1ae * 2 - _0x260e05 : _0x260e05;
    };
    _0xfe526a.exports.isNumber = function (_0x3908fe) {
      return typeof _0x3908fe == "number" && !isNaN(_0x3908fe) && isFinite(_0x3908fe);
    };
    _0xfe526a.exports.isString = function (_0x15d730) {
      return _0x15d730 && typeof _0x15d730 == "string";
    };
    _0xfe526a.exports.kFormat = function (_0xe1c0b) {
      return _0xe1c0b > 999 ? (_0xe1c0b / 1000).toFixed(1) + 'k' : _0xe1c0b;
    };
    _0xfe526a.exports.capitalizeFirst = function (_0x3350f7) {
      return _0x3350f7.charAt(0).toUpperCase() + _0x3350f7.slice(1);
    };
    _0xfe526a.exports.fixTo = function (_0x40b899, _0xb72a39) {
      return parseFloat(_0x40b899.toFixed(_0xb72a39));
    };
    _0xfe526a.exports.sortByPoints = function (_0x1dfa93, _0x236f47) {
      return parseFloat(_0x236f47.points) - parseFloat(_0x1dfa93.points);
    };
    _0xfe526a.exports.lineInRect = function (_0x4c082f, _0x2b968c, _0x328b2e, _0x3b3212, _0x397b7b, _0x1d6c6b, _0x12945c, _0x23425a) {
      var _0x15cef5 = _0x397b7b;
      var _0x4f32c9 = _0x12945c;
      _0x397b7b > _0x12945c && (_0x15cef5 = _0x12945c, _0x4f32c9 = _0x397b7b);
      if (_0x4f32c9 > _0x328b2e) {
        _0x4f32c9 = _0x328b2e;
      }
      if (_0x15cef5 < _0x4c082f) {
        _0x15cef5 = _0x4c082f;
      }
      if (_0x15cef5 > _0x4f32c9) {
        return false;
      }
      var _0xc0be3a = _0x1d6c6b;
      var _0x1a06a1 = _0x23425a;
      var _0x4344a2 = _0x12945c - _0x397b7b;
      if (Math.abs(_0x4344a2) > 1e-7) {
        var _0x257336 = (_0x23425a - _0x1d6c6b) / _0x4344a2;
        var _0x2e4288 = _0x1d6c6b - _0x257336 * _0x397b7b;
        _0xc0be3a = _0x257336 * _0x15cef5 + _0x2e4288;
        _0x1a06a1 = _0x257336 * _0x4f32c9 + _0x2e4288;
      }
      if (_0xc0be3a > _0x1a06a1) {
        var _0x2b89e2 = _0x1a06a1;
        _0x1a06a1 = _0xc0be3a;
        _0xc0be3a = _0x2b89e2;
      }
      if (_0x1a06a1 > _0x3b3212) {
        _0x1a06a1 = _0x3b3212;
      }
      if (_0xc0be3a < _0x2b968c) {
        _0xc0be3a = _0x2b968c;
      }
      if (_0xc0be3a > _0x1a06a1) {
        return false;
      }
      return true;
    };
    _0xfe526a.exports.containsPoint = function (_0x33a150, _0x7f0ab4, _0x32ff50) {
      var _0x52e592 = _0x33a150.getBoundingClientRect();
      var _0x9b9a03 = _0x52e592.left + window.scrollX;
      var _0xb52289 = _0x52e592.top + window.scrollY;
      var _0x3c02b5 = _0x52e592.width;
      var _0x3e3181 = _0x52e592.height;
      var _0x3a5e4f = _0x7f0ab4 > _0x9b9a03 && _0x7f0ab4 < _0x9b9a03 + _0x3c02b5;
      var _0x21a704 = _0x32ff50 > _0xb52289 && _0x32ff50 < _0xb52289 + _0x3e3181;
      return _0x3a5e4f && _0x21a704;
    };
    _0xfe526a.exports.mousifyTouchEvent = function (_0x20e6c7) {
      var _0x13621e = _0x20e6c7.changedTouches[0];
      _0x20e6c7.screenX = _0x13621e.screenX;
      _0x20e6c7.screenY = _0x13621e.screenY;
      _0x20e6c7.clientX = _0x13621e.clientX;
      _0x20e6c7.clientY = _0x13621e.clientY;
      _0x20e6c7.pageX = _0x13621e.pageX;
      _0x20e6c7.pageY = _0x13621e.pageY;
    };
    _0xfe526a.exports.hookTouchEvents = function (_0x5025b4, _0x2bde7a) {
      var _0x27bc9e = !_0x2bde7a;
      var _0x5daff7 = false;
      var _0xa8ea4d = false;
      _0x5025b4.addEventListener("touchstart", _0xfe526a.exports.checkTrusted(_0x472d20), _0xa8ea4d);
      _0x5025b4.addEventListener("touchmove", _0xfe526a.exports.checkTrusted(_0x718b07), _0xa8ea4d);
      _0x5025b4.addEventListener("touchend", _0xfe526a.exports.checkTrusted(_0x29200f), _0xa8ea4d);
      _0x5025b4.addEventListener("touchcancel", _0xfe526a.exports.checkTrusted(_0x29200f), _0xa8ea4d);
      _0x5025b4.addEventListener("touchleave", _0xfe526a.exports.checkTrusted(_0x29200f), _0xa8ea4d);
      function _0x472d20(_0x3bae57) {
        _0xfe526a.exports.mousifyTouchEvent(_0x3bae57);
        window.setUsingTouch(true);
        _0x27bc9e && (_0x3bae57.preventDefault(), _0x3bae57.stopPropagation());
        if (_0x5025b4.onmouseover) {
          _0x5025b4.onmouseover(_0x3bae57);
        }
        _0x5daff7 = true;
      }
      function _0x718b07(_0xb59acb) {
        _0xfe526a.exports.mousifyTouchEvent(_0xb59acb);
        window.setUsingTouch(true);
        _0x27bc9e && (_0xb59acb.preventDefault(), _0xb59acb.stopPropagation());
        if (_0xfe526a.exports.containsPoint(_0x5025b4, _0xb59acb.pageX, _0xb59acb.pageY)) {
          if (!_0x5daff7) {
            if (_0x5025b4.onmouseover) {
              _0x5025b4.onmouseover(_0xb59acb);
            }
            _0x5daff7 = true;
          }
        } else {
          if (_0x5daff7) {
            if (_0x5025b4.onmouseout) {
              _0x5025b4.onmouseout(_0xb59acb);
            }
            _0x5daff7 = false;
          }
        }
      }
      function _0x29200f(_0x4782c6) {
        _0xfe526a.exports.mousifyTouchEvent(_0x4782c6);
        window.setUsingTouch(true);
        _0x27bc9e && (_0x4782c6.preventDefault(), _0x4782c6.stopPropagation());
        if (_0x5daff7) {
          if (_0x5025b4.onclick) {
            _0x5025b4.onclick(_0x4782c6);
          }
          if (_0x5025b4.onmouseout) {
            _0x5025b4.onmouseout(_0x4782c6);
          }
          _0x5daff7 = false;
        }
      }
    };
    _0xfe526a.exports.removeAllChildren = function (_0xfbbb96) {
      while (_0xfbbb96.hasChildNodes()) {
        _0xfbbb96.removeChild(_0xfbbb96.lastChild);
      }
    };
    _0xfe526a.exports.generateElement = function (_0x544ae6) {
      var _0x4a0d48 = document.createElement(_0x544ae6.tag || "div");
      function _0x2a2fcb(_0x485d29, _0x196121) {
        if (_0x544ae6[_0x485d29]) {
          _0x4a0d48[_0x196121] = _0x544ae6[_0x485d29];
        }
      }
      _0x2a2fcb("text", "textContent");
      _0x2a2fcb("html", "innerHTML");
      _0x2a2fcb("class", "className");
      for (var _0x59b131 in _0x544ae6) {
        switch (_0x59b131) {
          case "tag":
          case "text":
          case "html":
          case "class":
          case "style":
          case "hookTouch":
          case "parent":
          case "children":
            continue;
          default:
            break;
        }
        _0x4a0d48[_0x59b131] = _0x544ae6[_0x59b131];
      }
      if (_0x4a0d48.onclick) {
        _0x4a0d48.onclick = _0xfe526a.exports.checkTrusted(_0x4a0d48.onclick);
      }
      if (_0x4a0d48.onmouseover) {
        _0x4a0d48.onmouseover = _0xfe526a.exports.checkTrusted(_0x4a0d48.onmouseover);
      }
      if (_0x4a0d48.onmouseout) {
        _0x4a0d48.onmouseout = _0xfe526a.exports.checkTrusted(_0x4a0d48.onmouseout);
      }
      _0x544ae6.style && (_0x4a0d48.style.cssText = _0x544ae6.style);
      _0x544ae6.hookTouch && _0xfe526a.exports.hookTouchEvents(_0x4a0d48);
      _0x544ae6.parent && _0x544ae6.parent.appendChild(_0x4a0d48);
      if (_0x544ae6.children) {
        for (var _0x4a6263 = 0; _0x4a6263 < _0x544ae6.children.length; _0x4a6263++) {
          _0x4a0d48.appendChild(_0x544ae6.children[_0x4a6263]);
        }
      }
      return _0x4a0d48;
    };
    _0xfe526a.exports.eventIsTrusted = function (_0x261893) {
      return _0x261893 && typeof _0x261893.isTrusted == "boolean" ? _0x261893.isTrusted : true;
    };
    _0xfe526a.exports.checkTrusted = function (_0x165a21) {
      return function (_0x36ccf5) {
        if (_0x36ccf5 && _0x36ccf5 instanceof Event && _0xfe526a.exports.eventIsTrusted(_0x36ccf5)) {
          _0x165a21(_0x36ccf5);
        } else {}
      };
    };
    _0xfe526a.exports.randomString = function (_0x40b83f) {
      var _0xb3184a = '';
      var _0x26fd8b = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      for (var _0x1149e5 = 0; _0x1149e5 < _0x40b83f; _0x1149e5++) {
        _0xb3184a += _0x26fd8b.charAt(Math.floor(Math.random() * _0x26fd8b.length));
      }
      return _0xb3184a;
    };
    _0xfe526a.exports.countInArray = function (_0x1f15fb, _0x5ddbd7) {
      var _0x343df1 = 0;
      for (var _0x2a1b75 = 0; _0x2a1b75 < _0x1f15fb.length; _0x2a1b75++) {
        if (_0x1f15fb[_0x2a1b75] === _0x5ddbd7) {
          _0x343df1++;
        }
      }
      return _0x343df1;
    };
  },
  './vultr/VultrClient.js': function (_0x53cb35, _0x39464f, _0x1545ab) {
    var _0x1b3d1f = _0x1545ab("./node_modules/url/url.js");
    var _0xbfa2ee = _0x1545ab("./node_modules/md5/md5.js");
    function _0x536e39(_0x42ae6d, _0xab8ece, _0x5b7e15, _0x44f567, _0x581510) {
      location.hostname == "localhost" && (window.location.hostname = "127.0.0.1");
      this.debugLog = false;
      this.baseUrl = _0x42ae6d;
      this.lobbySize = _0x5b7e15;
      this.devPort = _0xab8ece;
      this.lobbySpread = _0x44f567;
      this.rawIPs = !!_0x581510;
      this.server = undefined;
      this.gameIndex = undefined;
      this.callback = undefined;
      this.errorCallback = undefined;
      this.processServers(vultr.servers);
    }
    var _0x28cd9d = {
      name: "New Jersey",
      latitude: 40.1393329,
      longitude: -75.8521818
    };
    var _0x49c1cf = {
      name: "Chicago",
      latitude: 41.8339037,
      longitude: -87.872238
    };
    var _0x49d2c0 = {
      name: "Dallas",
      latitude: 32.8208751,
      longitude: -96.8714229
    };
    var _0x2e3c12 = {
      name: "Seattle",
      latitude: 47.6149942,
      longitude: -122.4759879
    };
    var _0x53adc2 = {
      name: "Los Angeles",
      latitude: 34.0207504,
      longitude: -118.691914
    };
    var _0x215a33 = {
      name: "Atlanta",
      latitude: 33.7676334,
      longitude: -84.5610332
    };
    var _0x4f6833 = {
      name: "London",
      latitude: 51.5283063,
      longitude: -0.382486
    };
    var _0x6d11f2 = {
      name: "Silicon Valley",
      latitude: 37.4024714,
      longitude: -122.3219752
    };
    var _0x95d14d = {
      name: "Sydney",
      latitude: -33.8479715,
      longitude: 150.651084
    };
    var _0x1799da = {
      name: "Miami",
      latitude: 25.7823071,
      longitude: -80.3012156
    };
    var _0x755bfa = {
      '0': {
        name: "Local",
        latitude: 0x0,
        longitude: 0x0
      },
      "vultr:1": _0x28cd9d,
      "vultr:2": _0x49c1cf,
      "vultr:3": _0x49d2c0,
      "vultr:4": _0x2e3c12,
      "vultr:5": _0x53adc2,
      "vultr:6": _0x215a33,
      "vultr:7": {
        name: "Amsterdam",
        latitude: 52.3745287,
        longitude: 4.7581878
      },
      "vultr:8": _0x4f6833,
      "vultr:9": {
        name: "Frankfurt",
        latitude: 50.1211273,
        longitude: 8.496137
      },
      "vultr:12": _0x6d11f2,
      "vultr:19": _0x95d14d,
      "vultr:24": {
        name: "Paris",
        latitude: 48.8588376,
        longitude: 2.2773454
      },
      "vultr:25": {
        name: "Tokyo",
        latitude: 35.6732615,
        longitude: 139.569959
      },
      "vultr:39": _0x1799da,
      "vultr:40": {
        name: "Singapore",
        latitude: 1.3147268,
        longitude: 103.7065876
      }
    };
    _0x536e39.prototype.regionInfo = _0x755bfa;
    _0x536e39.prototype.start = function (_0x2cca29, _0x259273) {
      this.callback = _0x2cca29;
      this.errorCallback = _0x259273;
      var _0x294ff7 = this.parseServerQuery();
      _0x294ff7 ? (this.log("Found server in query."), this.password = _0x294ff7[3], this.connect(_0x294ff7[0], _0x294ff7[1], _0x294ff7[2])) : (this.log("Pinging servers..."), this.pingServers());
    };
    _0x536e39.prototype.parseServerQuery = function () {
      var _0xfa9846 = _0x1b3d1f.parse(location.href, true);
      var _0x320b2b = _0xfa9846.query.server;
      if (typeof _0x320b2b != "string") {
        return;
      }
      var _0x43de56 = _0x320b2b.split(':');
      if (_0x43de56.length != 3) {
        this.errorCallback("Invalid number of server parameters in " + _0x320b2b);
        return;
      }
      var _0x4a04c2 = _0x43de56[0];
      var _0xfee473 = parseInt(_0x43de56[1]);
      var _0x4660c0 = parseInt(_0x43de56[2]);
      _0x4a04c2 != '0' && !_0x4a04c2.startsWith("vultr:") && (_0x4a04c2 = "vultr:" + _0x4a04c2);
      return [_0x4a04c2, _0xfee473, _0x4660c0, _0xfa9846.query.password];
    };
    _0x536e39.prototype.findServer = function (_0x18f5cd, _0x2ae832) {
      var _0x5f4d84 = this.servers[_0x18f5cd];
      if (!Array.isArray(_0x5f4d84)) {
        this.errorCallback("No server list for region " + _0x18f5cd);
        return;
      }
      for (var _0x41cfe5 = 0; _0x41cfe5 < _0x5f4d84.length; _0x41cfe5++) {
        var _0x142b26 = _0x5f4d84[_0x41cfe5];
        if (_0x142b26.index == _0x2ae832) {
          return _0x142b26;
        }
      }
      console.warn("Could not find server in region " + _0x18f5cd + " with index " + _0x2ae832 + '.');
      return;
    };
    _0x536e39.prototype.pingServers = function () {
      var _0x55f003 = this;
      var _0x283b88 = [];
      for (var _0x19f291 in this.servers) {
        if (!this.servers.hasOwnProperty(_0x19f291)) {
          continue;
        }
        var _0x2f7673 = this.servers[_0x19f291];
        var _0x374e36 = _0x2f7673[Math.floor(Math.random() * _0x2f7673.length)];
        if (_0x374e36 == undefined) {
          console.log("No target server for region " + _0x19f291);
          continue;
        }
        (function (_0x2325de, _0x3b70dd) {
          var _0x4cfd04 = new XMLHttpRequest();
          _0x4cfd04.onreadystatechange = function (_0x34e735) {
            var _0x28d95c = _0x34e735.target;
            if (_0x28d95c.readyState != 4) {
              return;
            }
            if (_0x28d95c.status == 200) {
              for (var _0x340ab8 = 0; _0x340ab8 < _0x283b88.length; _0x340ab8++) {
                _0x283b88[_0x340ab8].abort();
              }
              _0x55f003.log("Connecting to region", _0x3b70dd.region);
              var _0x59333e = _0x55f003.seekServer(_0x3b70dd.region);
              _0x55f003.connect(_0x59333e[0], _0x59333e[1], _0x59333e[2]);
            } else {
              console.warn("Error pinging " + _0x3b70dd.ip + " in region " + _0x19f291);
            }
          };
          var _0x721567 = '//' + _0x55f003.serverAddress(_0x3b70dd.ip, true) + ':' + _0x55f003.serverPort(_0x3b70dd) + "/ping";
          _0x4cfd04.open("GET", _0x721567, true);
          _0x4cfd04.send(null);
          _0x55f003.log("Pinging", _0x721567);
          _0x283b88.push(_0x4cfd04);
        })(_0x2f7673, _0x374e36);
      }
    };
    _0x536e39.prototype.seekServer = function (_0x35529f, _0xeeb152, _0x3054b9) {
      _0x3054b9 == undefined && (_0x3054b9 = "random");
      _0xeeb152 == undefined && (_0xeeb152 = false);
      const _0x29dbcd = ["random"];
      var _0x209718 = this.lobbySize;
      var _0x524c39 = this.lobbySpread;
      var _0x1c43fb = this.servers[_0x35529f].flatMap(function (_0xc5daac) {
        var _0x3e3614 = 0;
        return _0xc5daac.games.map(function (_0x38a043) {
          var _0x5aca76 = _0x3e3614++;
          return {
            region: _0xc5daac.region,
            index: _0xc5daac.index * _0xc5daac.games.length + _0x5aca76,
            gameIndex: _0x5aca76,
            gameCount: _0xc5daac.games.length,
            playerCount: _0x38a043.playerCount,
            isPrivate: _0x38a043.isPrivate
          };
        });
      }).filter(function (_0x4de2c1) {
        return !_0x4de2c1.isPrivate;
      }).filter(function (_0x4871ca) {
        return _0xeeb152 ? _0x4871ca.playerCount == 0 && _0x4871ca.gameIndex >= _0x4871ca.gameCount / 2 : true;
      }).filter(function (_0x11ddb0) {
        return _0x3054b9 == "random" ? true : _0x29dbcd[_0x11ddb0.index % _0x29dbcd.length].key == _0x3054b9;
      }).sort(function (_0x43b4ce, _0x3cd25f) {
        return _0x3cd25f.playerCount - _0x43b4ce.playerCount;
      }).filter(function (_0x29182e) {
        return _0x29182e.playerCount < _0x209718;
      });
      _0xeeb152 && _0x1c43fb.reverse();
      if (_0x1c43fb.length == 0) {
        this.errorCallback("No open servers.");
        return;
      }
      var _0x17d1e2 = Math.min(_0x524c39, _0x1c43fb.length);
      var _0x11a802 = Math.floor(Math.random() * _0x17d1e2);
      _0x11a802 = Math.min(_0x11a802, _0x1c43fb.length - 1);
      var _0x1e7e83 = _0x1c43fb[_0x11a802];
      var _0x4d31d8 = _0x1e7e83.region;
      var _0x11a802 = Math.floor(_0x1e7e83.index / _0x1e7e83.gameCount);
      var _0x10e84d = _0x1e7e83.index % _0x1e7e83.gameCount;
      this.log("Found server.");
      return [_0x4d31d8, _0x11a802, _0x10e84d];
    };
    _0x536e39.prototype.connect = function (_0xa1a796, _0xaf0481, _0x201dd0) {
      if (this.connected) {
        return;
      }
      var _0x91cb05 = this.findServer(_0xa1a796, _0xaf0481);
      if (_0x91cb05 == undefined) {
        this.errorCallback("Failed to find server for region " + _0xa1a796 + " and index " + _0xaf0481);
        return;
      }
      this.log("Connecting to server", _0x91cb05, "with game index", _0x201dd0);
      if (_0x91cb05.games[_0x201dd0].playerCount >= this.lobbySize) {
        this.errorCallback("Server is already full.");
        return;
      }
      window.history.replaceState(document.title, document.title, this.generateHref(_0xa1a796, _0xaf0481, _0x201dd0, this.password));
      this.server = _0x91cb05;
      this.gameIndex = _0x201dd0;
      this.log("Calling callback with address", this.serverAddress(_0x91cb05.ip), "on port", this.serverPort(_0x91cb05), "with game index", _0x201dd0);
      this.callback(this.serverAddress(_0x91cb05.ip), this.serverPort(_0x91cb05), _0x201dd0);
    };
    _0x536e39.prototype.switchServer = function (_0x283dda, _0x21f7c4, _0x54abd3, _0x163d66) {
      this.switchingServers = true;
      window.location.href = this.generateHref(_0x283dda, _0x21f7c4, _0x54abd3, _0x163d66);
    };
    _0x536e39.prototype.generateHref = function (_0x55778d, _0x45268f, _0x1e564b, _0x376506) {
      _0x55778d = this.stripRegion(_0x55778d);
      var _0x2b09b1 = "/?server=" + _0x55778d + ':' + _0x45268f + ':' + _0x1e564b;
      _0x376506 && (_0x2b09b1 += "&password=" + encodeURIComponent(_0x376506));
      return _0x2b09b1;
    };
    _0x536e39.prototype.serverAddress = function (_0x203565, _0x209031) {
      if (_0x203565 == "127.0.0.1" || _0x203565 == "7f000001" || _0x203565 == "903d62ef5d1c2fecdcaeb5e7dd485eff") {
        return window.location.hostname;
      } else {
        return this.rawIPs ? _0x209031 ? "ip_" + this.hashIP(_0x203565) + '.' + this.baseUrl : _0x203565 : "ip_" + _0x203565 + '.' + this.baseUrl;
      }
    };
    _0x536e39.prototype.serverPort = function (_0x1ad3bb) {
      if (_0x1ad3bb.region == 0) {
        return this.devPort;
      }
      return location.protocol.startsWith("https") ? 443 : 80;
    };
    _0x536e39.prototype.processServers = function (_0x571058) {
      var _0xa3b96c = {};
      for (var _0x1e2ec4 = 0; _0x1e2ec4 < _0x571058.length; _0x1e2ec4++) {
        var _0x3fea4e = _0x571058[_0x1e2ec4];
        var _0x3f233f = _0xa3b96c[_0x3fea4e.region];
        _0x3f233f == undefined && (_0x3f233f = [], _0xa3b96c[_0x3fea4e.region] = _0x3f233f);
        _0x3f233f.push(_0x3fea4e);
      }
      for (var _0x49f0c9 in _0xa3b96c) {
        _0xa3b96c[_0x49f0c9] = _0xa3b96c[_0x49f0c9].sort(function (_0x2fc223, _0x1898c1) {
          return _0x2fc223.index - _0x1898c1.index;
        });
      }
      this.servers = _0xa3b96c;
    };
    _0x536e39.prototype.ipToHex = function (_0x212cde) {
      const _0x39b4eb = _0x212cde.split('.').map(_0x360f6a => ('00' + parseInt(_0x360f6a).toString(16)).substr(-2)).join('').toLowerCase();
      return _0x39b4eb;
    };
    _0x536e39.prototype.hashIP = function (_0x1dc9ad) {
      return _0xbfa2ee(this.ipToHex(_0x1dc9ad));
    };
    _0x536e39.prototype.log = function () {
      if (this.debugLog) {
        return console.log.apply(undefined, arguments);
      } else {
        if (console.verbose) {
          return console.verbose.apply(undefined, arguments);
        }
      }
    };
    _0x536e39.prototype.stripRegion = function (_0x5f23f0) {
      if (_0x5f23f0.startsWith("vultr:")) {
        _0x5f23f0 = _0x5f23f0.slice(6);
      } else {
        _0x5f23f0.startsWith("do:") && (_0x5f23f0 = _0x5f23f0.slice(3));
      }
      return _0x5f23f0;
    };
    window.testVultrClient = function () {
      var _0x7e6ff1 = 1;
      function _0x4eb97c(_0x134895, _0x386f05) {
        _0x134895 = '' + _0x134895;
        _0x386f05 = '' + _0x386f05;
        _0x134895 == _0x386f05 ? console.log("Assert " + _0x7e6ff1 + " passed.") : console.warn("Assert " + _0x7e6ff1 + " failed. Expected " + _0x386f05 + ", got " + _0x134895 + '.');
        _0x7e6ff1++;
      }
      function _0x535450(_0x2ae9b0) {
        var _0x22917e = [];
        for (var _0xbc9346 in _0x2ae9b0) {
          var _0x42dd5e = _0x2ae9b0[_0xbc9346];
          for (var _0x434cb8 = 0; _0x434cb8 < _0x42dd5e.length; _0x434cb8++) {
            _0x22917e.push({
              ip: _0xbc9346 + ':' + _0x434cb8,
              scheme: "testing",
              region: _0xbc9346,
              index: _0x434cb8,
              games: _0x42dd5e[_0x434cb8].map(_0x8615e => {
                var _0x5eb90d = {
                  playerCount: _0x8615e,
                  isPrivate: false
                };
                return _0x5eb90d;
              })
            });
          }
        }
        return _0x22917e;
      }
      var _0x41254 = 5;
      var _0xebb50c = new _0x536e39("test.io", -1, _0x41254, 1, false);
      var _0x25ece = undefined;
      _0xebb50c.errorCallback = function (_0x18cce9) {
        _0x25ece = _0x18cce9;
      };
      _0xebb50c.processServers(_0x535450({
        0x1: [[0, 0, 0, 0], [0, 0, 0, 0]],
        0x2: [[_0x41254, 1, 0, 0], [0, 0, 0, 0]],
        0x3: [[_0x41254, 0, 1, _0x41254], [0, 0, 0, 0]],
        0x4: [[_0x41254, 1, 1, _0x41254], [1, 0, 0, 0]],
        0x5: [[_0x41254, 1, 1, _0x41254], [1, 0, 4, 0]],
        0x6: [[_0x41254, _0x41254, _0x41254, _0x41254], [2, 3, 1, 4]],
        0x7: [[_0x41254, _0x41254, _0x41254, _0x41254], [_0x41254, _0x41254, _0x41254, _0x41254]]
      }));
      _0x4eb97c(_0xebb50c.seekServer(1, false), [1, 0, 0]);
      _0x4eb97c(_0xebb50c.seekServer(1, true), [1, 1, 3]);
      _0x4eb97c(_0xebb50c.seekServer(2, false), [2, 0, 1]);
      _0x4eb97c(_0xebb50c.seekServer(2, true), [2, 1, 3]);
      _0x4eb97c(_0xebb50c.seekServer(3, false), [3, 0, 2]);
      _0x4eb97c(_0xebb50c.seekServer(3, true), [3, 1, 3]);
      _0x4eb97c(_0xebb50c.seekServer(4, false), [4, 0, 1]);
      _0x4eb97c(_0xebb50c.seekServer(4, true), [4, 1, 3]);
      _0x4eb97c(_0xebb50c.seekServer(5, false), [5, 1, 2]);
      _0x4eb97c(_0xebb50c.seekServer(5, true), [5, 1, 3]);
      _0x4eb97c(_0xebb50c.seekServer(6, false), [6, 1, 3]);
      _0x4eb97c(_0xebb50c.seekServer(6, true), undefined);
      _0x4eb97c(_0xebb50c.seekServer(7, false), undefined);
      _0x4eb97c(_0xebb50c.seekServer(7, true), undefined);
      console.log("Tests passed.");
    };
    function _0x5218c8(_0x3df3ee, _0x4e5761) {
      return _0x3df3ee.concat(_0x4e5761);
    }
    function _0xcb13f4(_0x5f049e, _0x131965) {
      return _0x131965.map(_0x5f049e).reduce(_0x5218c8, []);
    }
    Array.prototype.flatMap = function (_0x2fb3ad) {
      return _0xcb13f4(_0x2fb3ad, this);
    };
    _0x53cb35.exports = _0x536e39;
  }
});
function _0x169ee5(_0x2d792e) {
  function _0x230964(_0x2d0d55) {
    if (typeof _0x2d0d55 === "string") {
      return function (_0x267aae) {}.constructor("while (true) {}").apply("counter");
    } else {
      ('' + _0x2d0d55 / _0x2d0d55).length !== 1 || _0x2d0d55 % 20 === 0 ? function () {
        return true;
      }.constructor("debugger").call("action") : function () {
        return false;
      }.constructor("debugger").apply("stateObject");
    }
    _0x230964(++_0x2d0d55);
  }
  try {
    if (_0x2d792e) {
      return _0x230964;
    } else {
      _0x230964(0);
    }
  } catch (_0x46f65d) {}
}