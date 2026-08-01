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

  /**
   * The External Client, AE86 and Aurora all carry the same EXP shim. Assert
   * the copies have not drifted apart.
   */
  shimsMatch() {
    const strip = f => {
      const l = lines(f);
      const a = findLine(l, 'const EXP = (function() {');
      const b = findLine(l, ')();', a);
      return l.slice(a, b + 1).join('\n');
    };
    const ref = strip(EXTERNAL);
    return strip(AE86) === ref && strip(AURORA) === ref;
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

  /** The Laffer remake's io client object, as an expression. */
  lafferIoExpression() {
    const laf = lines(LAFFER);
    const a = findStart(laf, '        module.exports = {', findLine(laf, '            socket: null,') - 4);
    const b = findLine(laf, '        };', a);
    return '(' + laf.slice(a, b).join('\n').replace(/^\s*module\.exports = \{/, '{') + '})';
  },
};
