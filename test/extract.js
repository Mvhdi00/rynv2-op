// Pulls the pieces under test straight out of the shipped userscript and out
// of the game bundles, so the tests always run against the real source rather
// than a copy that can drift.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'Revelation.user.js');
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
};
