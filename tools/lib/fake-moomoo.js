/*
 * fake-moomoo.js
 *
 * What the end-to-end tests share: a local stand-in for a moomoo.io game
 * server, and a stand-in game page that Luna_Client.user.js can boot in.
 *
 * The server speaks the game's protocol and checks every client frame the way
 * the game server has to:
 *
 *   io-init  [socketId, seed, key, 1]   per-connection opcode tables + HMAC key
 *   client   6-byte HMAC-SHA256 prefix + msgpack([opcode, args, seq])
 *   server   msgpack([opcode, args])
 *
 * The signature is checked with Node's own HMAC-SHA256 and the opcode through
 * tables built by the game's own functions, lifted verbatim from
 * src/game_index.js — not Luna's copy of them. msgpack is written here too, so
 * the server shares no code with the client it is checking.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "../..");
const GAME = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8");

function loadPlaywright() {
  const root = (() => {
    try { return path.dirname(require.resolve("playwright/package.json")); } catch (_) {}
    return path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright");
  })();
  const { chromium } = require(root);
  const core = path.dirname(require.resolve("playwright-core/package.json", { paths: [ root ] }));
  const { wsServer: WebSocketServer } = require(path.join(core, "lib/utilsBundle.js"));
  return { chromium, WebSocketServer };
}

/* ---- the game's own opcode tables (src/game_index.js: Io, bo, To, Co, Oi, Po) ---- */

function gameTables() {
  const grab = re => {
    const m = GAME.match(re);
    if (!m) throw new Error("not found in src/game_index.js: " + re);
    return m[0];
  };
  const src = [
    "const Io = " + grab(/\bIo = (\d+)/).replace(/^Io = /, "") + ";",
    "const bo = " + grab(/\bbo = \[[^\]]*\]/).replace(/^bo = /, "") + ";",
    "const To = " + grab(/\bTo = \[[^\]]*\]/).replace(/^To = /, "") + ";",
    grab(/function Co\(e\) \{[\s\S]*?\r?\n\}\r?\nfunction Oi/).replace(/\r?\nfunction Oi$/, ""),
    grab(/function Oi\(e, t\) \{[\s\S]*?\r?\n\}\r?\nfunction Po/).replace(/\r?\nfunction Po$/, ""),
    grab(/function Po\(e\) \{[\s\S]*?\r?\n\}/),
    "return Po;"
  ].join("\n");
  return new Function(src)();
}
const Po = gameTables();
const SIG = Number((GAME.match(/\bjt = (\d+)/) || [])[1]);
if (SIG !== 6) throw new Error("unexpected signature width " + SIG);

/* ---- msgpack: the subset the game uses ---- */

function mpEncode(v) {
  const out = [];
  const u8 = n => out.push(n & 0xff);
  const be = (n, bytes) => { for (let i = bytes - 1; i >= 0; i--) u8(Math.floor(n / 2 ** (8 * i))); };
  const enc = v => {
    if (v === null || v === undefined) return u8(0xc0);
    if (v === true) return u8(0xc3);
    if (v === false) return u8(0xc2);
    if (typeof v === "number") {
      if (Number.isInteger(v) && v >= 0 && v < 128) return u8(v);
      if (Number.isInteger(v) && v >= 0 && v <= 0xffffffff) { u8(0xce); return be(v, 4); }
      if (Number.isInteger(v) && v < 0 && v >= -32) return u8(0xe0 | (v + 32));
      const b = Buffer.alloc(8); b.writeDoubleBE(v); u8(0xcb); return out.push(...b);
    }
    if (typeof v === "string") {
      const b = Buffer.from(v, "utf8");
      if (b.length < 32) u8(0xa0 | b.length); else if (b.length < 256) { u8(0xd9); u8(b.length); } else { u8(0xda); be(b.length, 2); }
      return out.push(...b);
    }
    if (Array.isArray(v)) {
      if (v.length < 16) u8(0x90 | v.length); else { u8(0xdc); be(v.length, 2); }
      return v.forEach(enc);
    }
    const keys = Object.keys(v);
    u8(0x80 | keys.length);
    keys.forEach(k => { enc(k); enc(v[k]); });
  };
  enc(v);
  return Buffer.from(out);
}

function mpDecode(buf) {
  let p = 0;
  const str = n => { const s = buf.toString("utf8", p, p + n); p += n; return s; };
  const arr = n => { const a = []; for (let i = 0; i < n; i++) a.push(dec()); return a; };
  const map = n => { const o = {}; for (let i = 0; i < n; i++) { const k = dec(); o[k] = dec(); } return o; };
  const dec = () => {
    const b = buf[p++];
    if (b <= 0x7f) return b;
    if (b >= 0xe0) return b - 0x100;
    if ((b & 0xe0) === 0xa0) return str(b & 0x1f);
    if ((b & 0xf0) === 0x90) return arr(b & 0x0f);
    if ((b & 0xf0) === 0x80) return map(b & 0x0f);
    switch (b) {
      case 0xc0: return null;
      case 0xc2: return false;
      case 0xc3: return true;
      case 0xcc: return buf[p++];
      case 0xcd: p += 2; return buf.readUInt16BE(p - 2);
      case 0xce: p += 4; return buf.readUInt32BE(p - 4);
      case 0xd0: p += 1; return buf.readInt8(p - 1);
      case 0xd1: p += 2; return buf.readInt16BE(p - 2);
      case 0xd2: p += 4; return buf.readInt32BE(p - 4);
      case 0xca: p += 4; return buf.readFloatBE(p - 4);
      case 0xcb: p += 8; return buf.readDoubleBE(p - 8);
      case 0xd9: return str(buf[p++]);
      case 0xda: p += 2; return str(buf.readUInt16BE(p - 2));
      case 0xdc: p += 2; return arr(buf.readUInt16BE(p - 2));
      case 0xde: p += 2; return map(buf.readUInt16BE(p - 2));
    }
    throw new Error("msgpack: unsupported byte 0x" + b.toString(16) + " at " + (p - 1));
  };
  return dec();
}

/* ---- the stand-in game server ----
 *
 * Handles the handshake, verifies and records every frame, spawns the player
 * on "M" (sid 5, at `spawn` — 7200,7200 by default), answers pings, and
 * records chat. `onFrame` sees every frame after that, for a test's own
 * behaviour.
 */
function createGameServer(onFrame, opts) {
  const spawn = (opts && opts.spawn) || [ 7200, 7200 ];
  const server = {
    frames: [],
    chats: [],
    sock: null,
    tables: null,
    sendTo(name, args) {
      this.sock.send(mpEncode([ this.tables.s2c.enc[name], args ]));
    }
  };
  server.onConnection = sock => {
    const seed = crypto.randomBytes(4).readUInt32BE(0);
    const key = crypto.randomBytes(32);
    server.sock = sock;
    server.tables = Po(seed >>> 0);
    let lastSeq = 0;
    sock.send(mpEncode([ "io-init", [ 7, seed, key.toString("hex"), 1 ] ]));
    sock.on("message", data => {
      const buf = Buffer.from(data);
      const sig = buf.subarray(0, SIG);
      const payload = buf.subarray(SIG);
      const want = crypto.createHmac("sha256", key).update(payload).digest().subarray(0, SIG);
      const [ opcode, args, seq ] = mpDecode(payload);
      const name = server.tables.c2s.dec[opcode];
      const frame = { name, args, seq, sigOk: sig.equals(want), seqOk: seq === lastSeq + 1, at: Date.now() };
      lastSeq = seq;
      server.frames.push(frame);
      if (name === "M") {
        server.sendTo("C", [ 5 ]);
        server.sendTo("D", [ [ "p5", 5, "Tester", spawn[0], spawn[1], 0, 100, 100, 35, 0 ], true ]);
      } else if (name === "0") {
        setTimeout(() => server.sendTo("0", []), 40);       /* ~40 ms ping */
      } else if (name === "6") {
        server.chats.push({ text: args[0], at: frame.at });
      }
      if (onFrame) onFrame(frame, server);
    });
  };
  return server;
}

/* ---- the stand-in moomoo page: every element Luna looks up by id ----
 *
 * Audio elements are tracked as they are made (window.__song() is the one
 * playing), so a test can read the music clock without reaching into Luna's
 * scope. The enter button is real and clickable, for a respawn.
 */
function standInPage(luna) {
  const ids = (luna.match(/getElementById\(["'][A-Za-z0-9_-]+["']\)/g) || [])
    .map(s => s.slice(16, -2)).filter((v, i, a) => a.indexOf(v) === i);
  const tag = { gameCanvas: "canvas", mapDisplay: "canvas", nameInput: "input", chatBox: "input", allianceInput: "input", serverBrowser: "select", altServer: "select" };
  return `<!doctype html><html><head><meta charset="utf-8">
<script>
  window.__audios = [];
  const NativeAudio = window.Audio;
  window.Audio = function (src) { const a = new NativeAudio(src); window.__audios.push(a); return a; };
  window.Audio.prototype = NativeAudio.prototype;
  window.__song = () => window.__audios.filter(a => !a.muted && a.getAttribute("src")).pop() || null;
</script>
<script src="/luna.js"></script></head><body>
<button id="enterGame">Enter game</button>
${ids.filter(id => id !== "enterGame").map(id => `<${tag[id] || "div"} id="${id}"></${tag[id] || "div"}>`).join("\n").replace('<div id="guideCard"></div>', '<div id="guideCard"><div class="menuText"></div><div class="menuHeader"></div></div>')}
<script>window.$ = () => ({ toggle() {}, show() {}, hide() {} });</script>
</body></html>`;
}

module.exports = { loadPlaywright, Po, SIG, mpEncode, mpDecode, createGameServer, standInPage, ROOT };
