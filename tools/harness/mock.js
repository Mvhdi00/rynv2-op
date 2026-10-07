// Minimal mock of the moomoo game server: unpinned mode-1 session.
const MP = {
  encode(v) { const out = []; const enc = x => {
      if (x === null || x === undefined) return out.push(0xc0);
      if (x === false) return out.push(0xc2); if (x === true) return out.push(0xc3);
      if (typeof x === "number") { if (Number.isInteger(x) && x >= 0 && x < 128) return out.push(x);
        if (Number.isInteger(x) && x < 0 && x >= -32) return out.push(0xe0 | (x + 32));
        const b = Buffer.alloc(9); b[0] = 0xcb; b.writeDoubleBE(x, 1); return out.push(...b); }
      if (typeof x === "string") { const b = Buffer.from(x, "utf8"); if (b.length < 32) out.push(0xa0 | b.length); else out.push(0xd9, b.length); return out.push(...b); }
      if (Array.isArray(x)) { if (x.length < 16) out.push(0x90 | x.length); else out.push(0xdc, x.length >> 8, x.length & 255); return x.forEach(enc); }
      const ks = Object.keys(x); out.push(0x80 | ks.length); ks.forEach(k => { enc(k); enc(x[k]); }); };
    enc(v); return Buffer.from(out); },
  decode(u) { let p = 0; const val = () => { const c = u[p++];
      if (c < 0x80) return c; if (c >= 0xe0) return c - 256;
      if (c >= 0x90 && c <= 0x9f) { const a = []; for (let i = 0; i < (c & 15); i++) a.push(val()); return a; }
      if (c >= 0x80 && c <= 0x8f) { const o = {}; for (let i = 0; i < (c & 15); i++) { const k = val(); o[k] = val(); } return o; }
      if (c >= 0xa0 && c <= 0xbf) { const n = c & 31, s = u.slice(p, p + n).toString("utf8"); p += n; return s; }
      switch (c) { case 0xc0: return null; case 0xc2: return false; case 0xc3: return true;
        case 0xca: { const v = u.readFloatBE(p); p += 4; return v; } case 0xcb: { const v = u.readDoubleBE(p); p += 8; return v; }
        case 0xcc: return u[p++]; case 0xcd: { const v = u.readUInt16BE(p); p += 2; return v; } case 0xce: { const v = u.readUInt32BE(p); p += 4; return v; }
        case 0xd0: return u.readInt8(p++); case 0xd1: { const v = u.readInt16BE(p); p += 2; return v; } case 0xd2: { const v = u.readInt32BE(p); p += 4; return v; }
        case 0xd9: { const n = u[p++], s = u.slice(p, p + n).toString("utf8"); p += n; return s; }
        case 0xdc: { const n = u.readUInt16BE(p); p += 2; const a = []; for (let i = 0; i < n; i++) a.push(val()); return a; }
        default: throw new Error("mp " + c.toString(16)); } };
    return val(); }
};
const C2S = ["M","D","9","e","F","z","H","K","L","N","b","P","Q","c","6","S","0","T","R","A","V"], S2C = ["A","B","C","D","E","a","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","X","Y","Z","g","1","2","3","4","5","6","7","8","9","0","W","F"];
function rand(seed) { let e = seed; return () => { e |= 0; e = e + 1831565813 | 0; let t = Math.imul(e ^ e >>> 15, 1 | e); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function permute(alpha, seed) { const n = alpha.length, o = alpha.map((_, i) => i), r = rand(seed >>> 0); for (let u = n - 1; u > 0; u--) { const x = Math.floor(r() * (u + 1)), t = o[u]; o[u] = o[x]; o[x] = t; } const enc = {}, dec = {}; for (let u = 0; u < n; u++) { enc[alpha[u]] = o[u]; dec[o[u]] = alpha[u]; } return { enc, dec }; }
function tables(seed, salt) { const plain = salt == null; const a = (seed ^ Math.imul(plain ? 1 : salt, 2654435761)) >>> 0; return { c2s: permute(plain ? C2S.slice(0, 17) : C2S, a), s2c: permute(plain ? S2C.slice(0, 36) : S2C, (a ^ 2246822507) >>> 0) }; }
const WASM_B64 = "AGFzbQEAAAABBwFgAn9/AX8DAgEABwUBAW0AAAqWAQGTAQAgAUEBakGx893xeWwgAHMhACAAIABBEnZzIQAgAEGwyu30BnMhACAAIABBFXZzIQAgAEGN98afBmohACAAQR93IQAgAEHk4ILTe2ohACAAQQJ3IQAgACAAQR50cyEAIABB7IulkgNzIQAgACAAQQl2cyEAIABB8arckwdqIQAgACAAQRx0cyEAIABBC3ZB/wFxCw==";
const wasmM = new WebAssembly.Instance(new WebAssembly.Module(Buffer.from(WASM_B64, "base64")), {}).exports.m;
const mixKey = (D, O) => { const out = Buffer.alloc(D.length); for (let i = 0; i < D.length; i++) out[i] = D[i] ^ wasmM(O | 0, i); return out; };
const word = (b, o) => (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0;
const xorshift = (e, t) => { let s = t >>> 0; if (s === 0) s = 1831565813; for (let a = 0; a < e.length; a += 4) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; e[a] ^= s & 255; if (a + 1 < e.length) e[a + 1] ^= s >>> 8 & 255; if (a + 2 < e.length) e[a + 2] ^= s >>> 16 & 255; if (a + 3 < e.length) e[a + 3] ^= s >>> 24 & 255; } return e; };
const crypto = require("crypto");
function attach(ws, log, scenario = {}) {
  const seed = 12345, pinned = !!scenario.pinned, keyHex = "00112233445566778899aabbccddeeff";
  const T = tables(seed, pinned ? 2292205383 : null);
  const key = pinned ? mixKey(Buffer.from(keyHex, "hex"), seed) : Buffer.from(keyHex, "hex");
  const mask = pinned ? { c2s: (word(key, 0) ^ 3266489909) >>> 0, s2c: (word(key, 4) ^ 668265263) >>> 0 } : null;
  let sent = 0;
  const raw = buf => ws.send(buf);
  const send = (name, args) => { const b = MP.encode([name === "io-init" ? name : T.s2c.enc[name], args]); if (mask && name !== "io-init") xorshift(b, (mask.s2c ^ Math.imul(++sent, 2654435761)) >>> 0); raw(b); };
  send("io-init", ["sock" + Math.floor(Math.random() * 1e6), seed, keyHex, 1, pinned ? 1 : 0]);
  const me = scenario.me || { sid: 1, x: 7000, y: 7000, hat: 7, tail: 11 };
  const others = scenario.others || [{ sid: 2, name: "Enemy", x: 7250, y: 7000, hat: 6, tail: 0, clan: null }];
  let timer = null, tick = 0, myName = "me", pendingLook = false;
  ws.onMessage(raw => {
    const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    const sig = buf.subarray(0, 6), body = Buffer.from(buf.subarray(6));
    if (mask) xorshift(body, (mask.c2s ^ word(sig, 0)) >>> 0);
    const want = crypto.createHmac("sha256", key).update(body).digest().subarray(0, 6);
    if (!want.equals(Buffer.from(sig))) { log.push("[mock] BAD SIGNATURE"); }
    let pkt; try { pkt = MP.decode(body); } catch (e) { log.push("[mock] bad frame " + e.message); return; }
    const name = T.c2s.dec[pkt[0]], args = pkt[1];
    if (name !== "0" && name !== "D" && name !== "9") log.push("[mock] <- " + name + " " + JSON.stringify(args).slice(0, 120));
    if (name === "0") return send("0", []);
    if (name === "M") {
      myName = args[0] && args[0].name || "me";
      send("C", [me.sid]);
      send("D", [["sockme", me.sid, myName, me.x, me.y, 0, 100, 100, 35, 0, 0, 0, scenario.myClan || null], true]);
      for (const o of others) send("D", [["sock" + o.sid, o.sid, o.name, o.x, o.y, Math.PI, 100, 100, 35, 3, 0, 0, o.clan || null], false]);
      for (const id of [6, 7, 9, 22, 32, 40, 60]) send("5", [0, id, 0]);
      send("5", [0, 11, 1]);
      send("5", [1, me.hat, 0]); send("5", [1, me.tail, 1]);
      send("N", ["points", 100000, 1]);
      const look = [me.sid, -1, 0, 0, scenario.myClan || null, 0, me.hat, me.tail, 0, 0];
      for (const o of others) look.push(o.sid, -1, 0, 0, o.clan || null, 0, o.hat, o.tail, 0, 0);
      let first = true; pendingLook = false;
      timer = setInterval(() => {
        tick++;
        const pos = [me.sid, me.x, me.y, 0];
        for (const o of others) pos.push(o.sid, o.x, o.y + Math.round(Math.sin(tick / 5) * 20), 314);
        if (pendingLook) { look[6] = me.hat; look[7] = me.tail; }
        send("a", [pos, first || pendingLook ? look : [], []]); first = false; pendingLook = false;
      }, 111);
      if (timer.unref) timer.unref();
    }
    if (name === "c") { /* equip/buy */ const [buy, id, tail] = args; send("5", [buy ? 0 : 1, id, tail]);
      if (!buy) { if (tail) me.tail = id; else me.hat = id; pendingLook = true; } }
  });
  ws.onClose && ws.onClose(() => clearInterval(timer));
}
module.exports = { attach, MP };
