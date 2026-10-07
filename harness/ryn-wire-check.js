/* RYN's own 2025 session (RynWire), held against the game's.
 *
 *   node ryn-wire-check.js [ryn.js] [bundle.js]
 *
 * A bot's socket is RYN's, and on it RYN builds the session itself: opcode
 * tables, per-message masks, the keystream, the signature. It used to borrow
 * those from the bundle through hooks that recognise each function by the
 * shape of the obfuscated code around it, and the obfuscator reshapes that
 * code on every build — one miss on the live build and no bot could join.
 * RynWire is the same session written out plainly. This lifts it out of the
 * client and compares every piece with the game's own function, taken out of
 * the bundle by proto-2025.js:
 *
 *   - learn() reads the opcode alphabets and the session constants out of the
 *     bundle's text;
 *   - tables, masks, keystream, hex key and signature agree with the game's,
 *     pinned and plain, over many random seeds, salts, keys and frames;
 *   - and they agree on the fallback alphabets too, before learn() has run.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const RYN = process.argv[2] || path.join(ROOT, "ryn/Ryn_Type_2.user.js");
const BUNDLE = process.argv[3] || path.join(__dirname, "fixtures/moomoo_index_new.js");
const src = fs.readFileSync(RYN, "utf8");
const bundle = fs.readFileSync(BUNDLE, "utf8");

let bad = 0;
const say = (ok, line) => { if (!ok) bad++; console.log("  " + (ok ? "ok  " : "FAIL") + "  " + line); };

function lift(marker) {
  const start = src.indexOf(marker);
  if (start < 0) return null;
  let d = 0, end = -1;
  for (let k = src.indexOf("{", start); k < src.length; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}") { d--; if (!d) { end = k; break; } }
  }
  return src.slice(start, src.indexOf(";", end) + 1);
}
const signSrc = lift("const RynSign = new class {");
const wireSrc = lift("const RynWire = new class {");
if (!signSrc || !wireSrc) { console.log("  FAIL  RynSign / RynWire not found in " + path.basename(RYN)); process.exit(1); }
const load = () => new Function(signSrc + "\n" + wireSrc + "\nreturn RynWire;")();

const game = require("./proto-2025")(BUNDLE);
console.log(path.basename(RYN) + " — RynWire against the game's own session (" + path.basename(BUNDLE) + ")\n");

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const rnd32 = () => crypto.randomBytes(4).readUInt32LE(0);

for (const learned of [true, false]) {
  const W = load();
  if (learned) {
    const ok = W.learn(bundle);
    // the bundle's own arrays, independently
    const c2s = JSON.parse("[" + /\[("M","D","9"[^\]]*)\]/.exec(bundle)[1] + "]");
    const s2c = JSON.parse("[" + /\[("A","B","C"[^\]]*)\]/.exec(bundle)[1] + "]");
    say(ok && same(W.c2s, c2s) && same(W.s2c, s2c) && W.c2sPlain === 17 && W.s2cPlain === 36 &&
        W.defaultSalt === 1 && W.sigBytes === game.So && W.mode === game.Ws,
        "learn() reads the bundle's opcode alphabets (" + W.c2s.length + " up, " + W.s2c.length + " down; " + W.c2sPlain + "/" +
        W.s2cPlain + " unpinned) and its constants (salt " + W.defaultSalt + ", " + W.sigBytes + " signature bytes, mode " + W.mode + ")");
  }
  const tag = learned ? "after learn()" : "on the fallback alphabets";

  let wrong = 0;
  for (let i = 0; i < 300; i++) {
    const seed = rnd32(), salt = i % 3 === 0 ? undefined : rnd32() & 0xffff;
    if (!same(W.tables(seed, salt), salt === undefined ? game.Ll(seed) : game.Ll(seed, salt))) wrong++;
  }
  say(wrong === 0, "opcode tables match the game's, " + tag + ": 300 seeds, pinned and plain, " + wrong + " differ");

  wrong = 0;
  for (let i = 0; i < 200; i++) {
    const key = new Uint8Array(crypto.randomBytes(32));
    const m = W.mask(key), g = game.kf(key);
    const n = rnd32() & 0xffffff, sig = new Uint8Array(crypto.randomBytes(6));
    if (m.c2s !== g.c2s || m.s2c !== g.s2c || W.maskIn(m.s2c, n) !== game.wf(g.s2c, n) || W.maskOut(m.c2s, sig) !== game.bf(g.c2s, sig)) wrong++;
  }
  say(wrong === 0, "masks match the game's (key, incoming by count, outgoing by signature), " + tag + ": " + wrong + " of 200 differ");

  wrong = 0;
  for (let i = 0; i < 200; i++) {
    // a zero seed on payloads of 1, 11, 21 and 31 bytes: on an empty one it
    // would prove nothing
    const len = i % 40, seed = i % 50 === 1 ? 0 : rnd32();
    const bytes = new Uint8Array(crypto.randomBytes(len));
    if (!Buffer.from(W.xor(bytes.slice(), seed)).equals(Buffer.from(game.Nl(bytes.slice(), seed)))) wrong++;
  }
  say(wrong === 0, "the keystream matches the game's (lengths 0-39, a zero seed included), " + tag + ": " + wrong + " of 200 differ");

  wrong = 0;
  for (let i = 0; i < 50; i++) {
    const hex = crypto.randomBytes(32).toString("hex");
    if (!Buffer.from(W.hex(hex)).equals(Buffer.from(game.vf(hex)))) wrong++;
    const key = new Uint8Array(crypto.randomBytes(32)), data = new Uint8Array(crypto.randomBytes(3 + i));
    if (!Buffer.from(W.sign(key, data)).equals(Buffer.from(game.yf(key, data)))) wrong++;
  }
  say(wrong === 0, "the key parser and the signature match the game's, " + tag + ": " + wrong + " of 100 differ");
}

console.log("\n  " + (bad ? bad + " check(s) failed" : "all checks hold"));
process.exit(bad ? 1 : 0);
