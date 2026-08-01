// Verifies the patched bot socket layer — ws.emit and the io-init handling at
// the top of ws.onmessage — against a simulated current-protocol server.
const extract = require('./extract.js');

const { RVNP, game, msgpack } = extract.load();
const { Encoder, Decoder } = msgpack;

global.RVNP = RVNP;
global.ql = new Encoder();
global.Wl = new Decoder();

const emitSrc = extract.botEmitSource();
const onmsgHead = extract.botOnMessageHead();

const sent = [];
RVNP.nativeSend = function (d) { sent.push(Buffer.from(d)); };

// Builds a fake bot socket with the real ws.emit / ws.onmessage head installed.
// The sources are rebound onto a fresh local named `ws` for each instance so
// two bots can be exercised independently.
function makeBot() {
  const ws = {
    fS: false, packets: 0, hitPacket: 0, moveDir: null,
    proto: null, socketId: -1, spawned: false, sid: null,
    spawnCalls: 0, pingCalls: 0, lastTemp: null,
  };
  ws.spawn = () => { ws.spawnCalls++; };
  ws.pingSocketResponse = () => { ws.pingCalls++; };
  eval(emitSrc);
  eval(onmsgHead + '\n  ws.lastTemp = temp;\n};');
  return ws;
}

const enc = new Encoder(), dec = new Decoder();
let fails = 0;
const check = (c, l) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l); if (!c) fails++; };

const SEED = 0x1234ABCD;
const KEY_HEX = 'aabbccdd00112233445566778899aabb';
const tables = game.Po(SEED);
const key = game.Ro(KEY_HEX);

const bot = makeBot();

// --------------------------------------------------------------------------
console.log('\n1. bot handshake');
check(bot.spawnCalls === 0, 'bot does not spawn before io-init');
bot.onmessage({ data: enc.encode(['io-init', [77, SEED, KEY_HEX, game.Ht]]).buffer });
check(bot.spawnCalls === 1, 'bot spawns exactly once, driven by io-init');
check(bot.pingCalls === 1, 'ping issued after handshake');
check(bot.socketId === 77, 'socketId stored');
check(bot.sid === null, 'player sid NOT clobbered by socketId');
check(bot.proto !== null && bot.proto.mode === 1, 'bot has its own protocol state');

bot.onmessage({ data: enc.encode(['io-init', [77, SEED, KEY_HEX, game.Ht]]).buffer });
check(bot.spawnCalls === 1, 'duplicate io-init does not double-spawn');

// --------------------------------------------------------------------------
console.log('\n2. bot outgoing framing');
sent.length = 0;
bot.emit('9', 1.5, null, null);
check(sent.length === 1, 'move packet transmitted');

const payload = sent[0].subarray(game.jt);
check(Buffer.from(game.Eo(key, payload)).equals(sent[0].subarray(0, game.jt)),
      "bot HMAC verifies with the bot's own key");
const d = dec.decode(new Uint8Array(payload));
check(tables.c2s.dec[d[0]] === '9', 'opcode maps back to "9"');
check(d[2] === 1, 'bot sequence starts at 1');
check(bot.moveDir === 1.5, 'mod bookkeeping still runs (moveDir)');

sent.length = 0;
bot.emit('K', 1, null, null);
check(bot.hitPacket === 1, 'hit counter still increments');
check(dec.decode(new Uint8Array(sent[0].subarray(game.jt)))[2] === 2, 'bot sequence increments');

sent.length = 0;
bot.emit('NOPE', 1, null, null);
check(sent.length === 0, 'unknown bot packet dropped');

// --------------------------------------------------------------------------
console.log('\n3. bot incoming opcode mapping');
bot.onmessage({ data: enc.encode([tables.s2c.enc['O'], [5, 42]]).buffer });
check(bot.lastTemp[0] === 'O', 'numeric opcode decoded to "O" (healthUpdate)');
check(JSON.stringify(bot.lastTemp[1]) === '[5,42]', 'payload intact');

// --------------------------------------------------------------------------
console.log('\n4. per-bot key isolation');
const bot2 = makeBot();
const SEED2 = 0x99887766, KEY2 = '0102030405060708090a0b0c0d0e0f10';
bot2.onmessage({ data: enc.encode(['io-init', [78, SEED2, KEY2, game.Ht]]).buffer });
sent.length = 0;
bot2.emit('M', { name: 'bot' }, null, null);
const p2 = sent[0].subarray(game.jt);
check(Buffer.from(game.Eo(game.Ro(KEY2), p2)).equals(sent[0].subarray(0, game.jt)),
      'second bot signs with its own distinct key');
check(!Buffer.from(game.Eo(key, p2)).equals(sent[0].subarray(0, game.jt)),
      "first bot's key does not validate it (state is per-bot)");
check(bot.proto.seq === 2 && bot2.proto.seq === 1, 'sequence counters are independent');

console.log('\n' + (fails === 0 ? '=> ALL BOT TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
