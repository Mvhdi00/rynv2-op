// Pulls the pieces under test straight out of the shipped userscript and out
// of the game bundles, so the tests always run against the real source rather
// than a copy that can drift.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'Revelation.user.js');
const EXTERNAL = path.join(ROOT, 'ExternalClient.user.js');
const LAFFER = path.join(ROOT, 'LafferRemake.user.js');
const AE86 = path.join(ROOT, 'AE86.user.js');
const AURORA = path.join(ROOT, 'Aurora.user.js');
const LEMON = path.join(ROOT, 'LemonMod.user.js');
const LEMON_VIS = path.join(ROOT, 'LemonModVisuals.user.js');
const X18K = path.join(ROOT, 'X18K.user.js');
const ROBOTICS = path.join(ROOT, 'Robotics.user.js');
const PETER = path.join(ROOT, 'PeterClient.user.js');
const CHICKEN = path.join(ROOT, 'Chicken.user.js');
const GAME = path.join(ROOT, 'reference/game-index.js');
const VENDOR = path.join(ROOT, 'reference/game-vendor.js');

function lines(file) {
  // the userscript ships with CRLF endings
  return fs.readFileSync(file, 'utf8').split('\n').map(l => l.replace(/\r$/, ''));
}

// Index of the first line that exactly equals `needle`, at or after `from`.
function findLine(src, needle, from = 0) {
  for (let i = from; i < src.length; i++) if (src[i] === needle) return i;
  throw new Error('marker not found: ' + JSON.stringify(needle));
}
function findStart(src, prefix, from = 0) {
  for (let i = from; i < src.length; i++) if (src[i].startsWith(prefix)) return i;
  throw new Error('marker not found: ' + JSON.stringify(prefix));
}

const script = lines(SCRIPT);

/** The RVNP protocol module, as a loadable CommonJS module. */
function rvnpModule() {
  const a = findLine(script, 'var RVNP = (function() {');
  const b = findLine(script, ')();', a);
  return 'global.window = global.window || { WebSocket: function(){} };\n'
    + script.slice(a, b + 1).join('\n')
    + '\nmodule.exports = RVNP;\n';
}

/** The `ee` transport object literal, as an expression. */
function eeExpression() {
  const a = findLine(script, ', ee = {');
  const b = findLine(script, '};', a);
  return '(' + script.slice(a, b).join('\n').replace(/^, ee = \{/, '{') + '})';
}

/** The bot's `ws.emit` assignment, verbatim. */
function botEmitSource() {
  const a = findStart(script, '    ws.emit = (packet, val, bool, val2) => {');
  const b = findStart(script, '    ws.findPlayer = function(ID){', a);
  return script.slice(a, b).join('\n').replace(/\s+$/, '');
}

/**
 * The patched head of the bot's `ws.onmessage` — everything from the handler
 * opening up to (but not including) the pre-existing `let data;`, which is
 * where our changes stop.
 */
function botOnMessageHead() {
  const a = findStart(script, '    ws.onmessage = message => {');
  const b = findStart(script, '        let data;', a);
  return script.slice(a, b).join('\n');
}

/** The game's own protocol helpers, for differential comparison. */
function gameProtoModule() {
  const g = lines(GAME);
  const a = findStart(g, '  , jt = 6');
  const b = findStart(g, 'function Ro(', a);
  const end = findLine(g, '}', b);
  return 'const Io = 1\n'
    + g.slice(a, end + 1).join('\n')
    + '\nmodule.exports = { Po, Eo, Ro, jt, Ht, bo, To };\n';
}

/** The game's msgpack encoder/decoder, used to stand in for the server. */
function vendorMsgpackModule() {
  const v = lines(VENDOR);
  const end = findStart(v, 'function ze(t) {');
  return v.slice(0, end).join('\n') + '\nmodule.exports = { Encoder: yn, Decoder: kn };\n';
}

// Materialise the generated modules next to this file so `require` works.
function write(name, contents) {
  const p = path.join(__dirname, '.generated', name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, contents);
  return p;
}

/** The EXP protocol shim, as a loadable CommonJS module. Both the External
 *  Client and the AE86 script carry the same shim, so this works for either. */
function expModule(file) {
  const ext = lines(file || EXTERNAL);
  const a = findLine(ext, 'const EXP = (function() {');
  const b = findLine(ext, ')();', a);
  return `
class FakeWebSocket {
  constructor(url) { this.url = url; this.readyState = 1; this.binaryType = ''; this._listeners = []; this.sentRaw = []; }
  addEventListener(type, fn) { if (type === 'message') this._listeners.push(fn); }
  deliver(data) { for (const fn of this._listeners.slice()) fn({ data, target: this }); }
}
FakeWebSocket.prototype.send = function (d) { this.sentRaw.push(d); };
['CONNECTING','OPEN','CLOSING','CLOSED'].forEach((k, i) => { FakeWebSocket[k] = i; });
global.FakeWebSocket = FakeWebSocket;
global.window = { WebSocket: FakeWebSocket };
global.document = { getElementById() { return null; } };
global.TextEncoder = global.TextEncoder || require('util').TextEncoder;
global.TextDecoder = global.TextDecoder || require('util').TextDecoder;
`
    + ext.slice(a, b + 1).join('\n')
    + '\nmodule.exports = { EXP, FakeWebSocket, window: global.window };\n';
}

module.exports = {
  eeExpression,
  botEmitSource,
  botOnMessageHead,
  load() {
    return {
      RVNP: require(write('mod_proto.js', rvnpModule())),
      game: require(write('game_proto.js', gameProtoModule())),
      msgpack: require(write('vendor_msgpack.js', vendorMsgpackModule())),
    };
  },
  loadExternal() {
    return require(write('exp.js', expModule()));
  },

  loadAe86() {
    return require(write('exp_ae86.js', expModule(AE86)));
  },

  loadAurora() {
    return require(write('exp_aurora.js', expModule(AURORA)));
  },

  loadRobotics() {
    return require(write('exp_robotics.js', expModule(ROBOTICS)));
  },

  loadPeter() {
    return require(write('exp_peter.js', expModule(PETER)));
  },

  /**
   * chicken's CHKP protocol module together with its patched `io` object,
   * wired to the game's own msgpack codec and a fake socket.
   */
  loadChicken() {
    const l = lines(CHICKEN);

    const pa = findLine(l, 'const CHKP = (function () {');
    const pb = findLine(l, 'let chkReady = false;', pa);
    const proto = l.slice(pa, pb + 1).join('\n');

    const ia = findLine(l, 'let io = new (class {');
    const ib = findLine(l, '})();', ia);
    const io = l.slice(ia, ib + 1).join('\n').replace(/^let io = /, 'const io = ');

    const src = `
const { Encoder, Decoder } = require('./vendor_msgpack.js');
const _enc = new Encoder(), _dec = new Decoder();
const msgpack = { encode: v => _enc.encode(v), decode: b => _dec.decode(b) };
const profanityList = ['fuck'];
const clientTranslate = new Map([['M', 'sp'], ['D', '2'], ['9', '33']]);

class FakeSocket {
  constructor(url) { this.url = url; this.readyState = 0; this.binaryType = ''; this.sent = []; }
  open() { this.readyState = 1; if (this.onopen) this.onopen(); }
  deliver(data) { this.onmessage({ data }); }
  close() { this.readyState = 3; if (this.onclose) this.onclose({ code: 1000 }); }
}
FakeSocket.prototype.send = function (d) { this.sent.push(Buffer.from(d)); };
['CONNECTING','OPEN','CLOSING','CLOSED'].forEach((k, i) => { FakeSocket[k] = i; });
global.WebSocket = FakeSocket;
global.window = { turnstile: null };
global.document = { getElementById() { return null; } };
global.location = { href: 'https://moomoo.io/' };

${proto}

${io}

module.exports = {
  CHKP, io, FakeSocket, msgpack,
  window: global.window,
  proto: () => chkProto,
  ready: () => chkReady,
  setHref: h => { global.location.href = h; },
};
`;
    return require(write('chicken.js', src));
  },

  /**
   * Every hook-based script carries the same EXP shim. Assert the copies have
   * not drifted apart.
   */
  shimsMatch() {
    const strip = f => {
      const l = lines(f);
      const a = findLine(l, 'const EXP = (function() {');
      const b = findLine(l, ')();', a);
      return l.slice(a, b + 1).join('\n');
    };
    const ref = strip(EXTERNAL);
    return [AE86, AURORA, LEMON, LEMON_VIS, ROBOTICS, PETER].every(f => strip(f) === ref);
  },

  /** The Laffer remake's LAF shim, as a loadable CommonJS module. */
  loadLaffer() {
    const laf = lines(LAFFER);
    const a = findLine(laf, 'const LAF = (function() {');
    const b = findLine(laf, ')();', a);
    const src = `
class FakeWebSocket {
  constructor(url) { this.url = url; this.readyState = 1; this.binaryType = ''; this.sentRaw = []; }
  send(d) { this.sentRaw.push(d); }
  close() { this.closed = true; }
}
['CONNECTING','OPEN','CLOSING','CLOSED'].forEach((k, i) => { FakeWebSocket[k] = i; });
global.window = { WebSocket: FakeWebSocket };
global.FakeNativeWebSocket = FakeWebSocket;
`
      + laf.slice(a, b + 1).join('\n')
      + '\nmodule.exports = { LAF, HijackedWebSocket: window.WebSocket, FakeWebSocket };\n';
    return require(write('laf.js', src));
  },

  /**
   * x18k's document-start section (the X18P protocol core plus the socket stub
   * and the render-loop guard) together with its patched io client, wired to
   * the game's own msgpack codec and a fake socket.
   */
  loadX18k() {
    const l = lines(X18K);

    const pa = findLine(l, 'var X18P = (function() {');
    const pb = findStart(l, "/* The client below needs the page's DOM", pa);
    const head = l.slice(pa, pb).join('\n');

    const ia = findStart(l, '        module.exports = {', findLine(l, '            ready: false,') - 4);
    const ib = findLine(l, '        };', ia);
    const io = l.slice(ia, ib).join('\n').replace(/^\s*module\.exports = \{/, '{');

    const src = `
const { Encoder, Decoder } = require('./vendor_msgpack.js');
const _enc = new Encoder(), _dec = new Decoder();
const msgpack = { encode: v => _enc.encode(v), decode: b => _dec.decode(b) };

class FakeSocket {
  constructor(url) { this.url = url; this.readyState = 0; this.binaryType = ''; this.sent = []; }
  open() { this.readyState = 1; if (this.onopen) this.onopen(); }
  deliver(data) { this.onmessage({ data }); }
  close() { this.readyState = 3; if (this.onclose) this.onclose({ code: 1000 }); }
}
FakeSocket.prototype.send = function (d) { this.sent.push(Buffer.from(d)); };
['CONNECTING','OPEN','CLOSING','CLOSED'].forEach((k, i) => { FakeSocket[k] = i; });
global.window = { WebSocket: FakeSocket };
const OriginalWebSocket = FakeSocket;

${head}

let packets = 0, packetInterval, pps = 0;

const io = (${io}});

module.exports = {
  X18P, io, FakeSocket,
  window: global.window,
  stub: () => global.window.WebSocket,
  proto: () => x18kProto,
  pending: () => X18K_PENDING,
  setConnect: fn => { X18K_CONNECT = fn; },
  msgpack,
};
`;
    return require(write('x18k.js', src));
  },

  /** The Laffer remake's io client object, as an expression. */
  lafferIoExpression() {
    const laf = lines(LAFFER);
    const a = findStart(laf, '        module.exports = {', findLine(laf, '            socket: null,') - 4);
    const b = findLine(laf, '        };', a);
    return '(' + laf.slice(a, b).join('\n').replace(/^\s*module\.exports = \{/, '{') + '})';
  },
};
