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
const CHICKEN = path.join(ROOT, 'UnX.user.js');
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

/**
 * Revelation's entry gate: Oh() (the play button's connect), the Turnstile
 * callbacks and the widget/panel plumbing, wired to a fake DOM and a fake
 * turnstile so the whole "press play -> solve -> connect" path can be driven.
 */
function revelationEntryModule() {
  const a = findLine(script, 'function Oh() {');
  const b = findLine(script, 'function gn(e) {', a);
  const body = script.slice(a, b).join('\n');

  return `
global.window = global.window || {};
// --- a DOM just real enough for the panel ---
class El {
  constructor(tag) {
    this.tagName = tag; this.style = { cssText: '' }; this.children = [];
    this.className = ''; this.id = ''; this.textContent = '';
    this.parentNode = null; this.classList = { remove() {}, add() {} };
  }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  querySelector(sel) {
    const want = sel.replace(/^\\./, '');
    for (const c of this.children) if (c.className === want) return c;
    return null;
  }
  // walk to the root: attaching a child before its parent is attached is
  // normal, so this cannot be a snapshot taken at append time
  get isConnected() {
    for (let n = this; n; n = n.parentNode) if (n === body) return true;
    return false;
  }
  // offsetParent is null for a detached node or one inside display:none; the
  // panel is position:fixed and the slot is a plain child of it
  get offsetParent() {
    for (let n = this; n; n = n.parentNode) if (n.style.display === 'none') return null;
    return this.isConnected ? body : null;
  }
}
const body = new El('body');
const head = new El('head');
global.document = {
  body, head,
  documentElement: body,
  createElement: t => new El(t),
  getElementById: id => registry[id] || null,
};
const registry = {};

// --- the globals the block closes over ---
let ki = false;          // localhost/dev build
const Eh = true, ls = true;   // production: a token is mandatory
let ps = false, code = null, Fn = false;
const Un = new El('button');
const loading = [];
function ms(e) { loading.push(e); }
const connects = [];
function gn(e) { connects.push(e); }
window.captchaCallbackHook = function () { ps = true; };

// --- a turnstile that only answers once someone solves our widget ---
let solved = null, rendered = [];
global.window.turnstile = {
  render(el, opts) { rendered.push({ el, opts }); return 'wid' + rendered.length; },
  getResponse() { return solved; },
  reset() { solved = null; },
};

${body}

module.exports = {
  Oh, rvnRenderTurnstile, rvnSetupTurnstile, rvnCaptchaSlot,
  onGotTurnstileToken: () => window.onGotTurnstileToken,
  loading, connects, rendered, body,
  state: () => ({ ps, code, Fn, pending: rvnPendingConnect }),
  panel: () => rvnCaptchaBox,
  widgetId: () => rvnTurnstileId,
  // stands in for the player ticking the box
  solve: t => { solved = t; window.onGotTurnstileToken(t); },
  // the page's own widget, already filled in, the way the live page leaves it
  addPageWidget: () => {
    const w = new El('div');
    w.id = 'turnstileWidget';
    w.appendChild(new El('iframe'));
    body.appendChild(w);
    registry.turnstileWidget = w;
    return w;
  },
};
`;
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

  /** Revelation's play-button / captcha entry gate, drivable end to end. */
  loadRevelationEntry() {
    return require(write('rvn_entry.js', revelationEntryModule()));
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

  /** unX's auto grind -- the port of RYN's AutoGrind -- on stubbed game state. */
  loadUnxGrind() {
    const l = lines(CHICKEN);
    const a = findLine(l, '    const GRIND_RUBY = 3;');
    const b = findLine(l, '    let lastKillName = "";', a);
    const grind = l.slice(a, b).join('\n');

    const ca = findLine(l, 'const config = {');
    const cb = findLine(l, '};', ca);
    const cfg = l.slice(ca, cb + 1).join('\n');

    const src = `
${cfg}
let player = null, gameObjects = [], isSandbox = false;
const items = { weapons: [] };
const hats = [{ id: 40, price: 3000 }];
const scriptMenu = { toggles: { autoGrind: true } };
const game = { enemies: { nearest: null } };
const UTILS = { getDistance: (a, b) => Math.hypot(a.x - b.x, a.y - b.y) };
const calls = [];
const placer = { regCheckPlace: (id, ang) => calls.push(['place', id, ang]) };
const hatSystem = {
  storeEquip: (id, i, f) => calls.push(['hat', id]),
  doBasicFunction: () => calls.push(['hat', 'basic']),
};
let reloaded = 1;
const healer = { reloadPercent: () => reloaded };
global.document = { getElementById: () => null };

${grind}

const owner = {
  aim: 0,
  getAttackDir(t) { return this.aim; },
  selectToBuild: (i, w) => calls.push(['weapon', i]),
  sendHitOnce: () => calls.push(['hit']),
};

module.exports = {
  unxGrind, owner, calls, config, items, hats, scriptMenu, game,
  setPlayer: p => { player = p; },
  setObjects: o => { gameObjects = o; },
  setSandbox: v => { isSandbox = v; },
  setReloaded: v => { reloaded = v; },
  setEnemy: e => { game.enemies.nearest = e; },
  setWeapons: w => { items.weapons = w; },
};
`;
    return require(write('unx_grind.js', src));
  },

  /**
   * unX's bot layer: the real per-bot game connection (BotSocket) and the
   * stand-in for the dead glitch.me relay socket (LocalRelay), loaded with the
   * same CHKP the shipped script uses.
   */
  loadUnxBots() {
    const l = lines(CHICKEN);

    const pa = findLine(l, 'const CHKP = (function () {');
    const pb = findLine(l, 'let chkReady = false;', pa);
    const proto = l.slice(pa, pb + 1).join('\n');

    const ba = findLine(l, '    let lastKillName = "";');
    const bb = findLine(l, '    class Bot {', ba);
    const bots = l.slice(ba, bb).join('\n');

    const src = `
const { Encoder, Decoder } = require('./vendor_msgpack.js');
const _enc = new Encoder(), _dec = new Decoder();
const msgpack = { encode: v => _enc.encode(v), decode: b => _dec.decode(b) };

let isMohMoh = false;
const clientTranslate = new Map([['M', 'sp'], ['9', '33'], ['D', '2']]);
let playerSID = 7;
let player = { kills: 0 };
const sentChats = [];
function sendChat(m) { sentChats.push(m); }
const scriptMenu = { toggles: {
  botNames: '',
  killChatMessage: 'gg {name}',
  killCountMessage: '{kills} idiots down',
} };

class FakeSocket {
  constructor(url) { this.url = url; this.readyState = 1; this.binaryType = ''; this.sent = []; }
  send(d) { this.sent.push(Buffer.from(d)); }
  close() { this.readyState = 3; if (this.onclose) this.onclose({ code: 1000 }); }
  deliver(data) { this.onmessage({ data }); }
}
global.WebSocket = FakeSocket;
global.window = { turnstile: null, wsAddress: 'wss://test.moomoo.io' };
global.document = {
  createElement: () => ({ style: {}, appendChild() {} }),
  documentElement: { appendChild() {} },
  head: { appendChild() {} },
  getElementById: () => null,
};

${proto}

${bots}

module.exports = {
  CHKP, BotSocket, LocalRelay, FakeSocket, msgpack,
  formatKillChat, sendKillChat, sentChats, scriptMenu,
  setKills: n => { player.kills = n; },
  setLastKill: (name, at) => { lastKillName = name; lastKillAt = at; },
  setMohMoh: v => { isMohMoh = v; },
  setNames: v => { scriptMenu.toggles.botNames = v; },
  setPlayerSID: v => { playerSID = v; },
};
`;
    return require(write('unx_bots.js', src));
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
