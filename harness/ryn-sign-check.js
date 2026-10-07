/* RYN's own frame signature (RynSign), checked against the real thing.
 *
 *   node ryn-sign-check.js [ryn.js] [bundle.js]
 *
 * Every frame to the 2025 server carries the first bytes of an HMAC-SHA256 of
 * its payload. The game computes it through obfuscated JavaScript at a third
 * of a millisecond a frame; RYN signs with a plain implementation instead and
 * proves it against the game's own function before trusting it. A wrong
 * signature is a dropped connection, so this takes RynSign out of the client
 * and checks:
 *
 *   - it is HMAC-SHA256, byte for byte, for keys and payloads of every size
 *     that matters (short and long keys, one block, two, padding edges);
 *   - through sign(), it agrees with the game's own signing function, lifted
 *     out of the bundle (proto-2025.js);
 *   - an original it disagrees with switches it off for good, and that frame
 *     goes out with the original's bytes;
 *   - it does not sign alone until it has matched.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const RYN = process.argv[2] || path.join(ROOT, "ryn/Ryn_Type_2.user.js");
const src = fs.readFileSync(RYN, "utf8");

let bad = 0;
const say = (ok, line) => { if (!ok) bad++; console.log("  " + (ok ? "ok  " : "FAIL") + "  " + line); };

// the class, as written in the client
const start = src.indexOf("const RynSign = new class {");
if (start < 0) { console.log("  FAIL  RynSign not found in " + path.basename(RYN)); process.exit(1); }
let d = 0, end = -1;
for (let k = src.indexOf("{", start); k < src.length; k++) {
  const c = src[k];
  if (c === "{") d++;
  else if (c === "}") { d--; if (!d) { end = k; break; } }
}
const block = src.slice(start, src.indexOf(";", end) + 1);
const load = () => new Function(block + "\nreturn RynSign;")();

console.log(path.basename(RYN) + " — RynSign against HMAC-SHA256 and the game\n");

// 1. HMAC-SHA256, byte for byte
{
  const S = load();
  let n = 0, wrong = 0;
  for (const klen of [1, 16, 32, 55, 63, 64, 65, 100, 200]) {
    for (let dlen = 0; dlen < 260; dlen += dlen < 140 ? 1 : 11) {
      const key = new Uint8Array(crypto.randomBytes(klen)), data = new Uint8Array(crypto.randomBytes(dlen));
      const mine = Buffer.from(S.hmac(S._prepare(key), data));
      const ref = crypto.createHmac("sha256", Buffer.from(key)).update(Buffer.from(data)).digest();
      n++;
      if (!mine.equals(ref)) wrong++;
    }
  }
  say(wrong === 0, "it is HMAC-SHA256: " + n + " key/payload sizes, " + wrong + " wrong");
}

// 2. through sign(), the same bytes as the game's own function
{
  const game = require("./proto-2025")(process.argv[3]);
  const S = load();
  const key = new Uint8Array(crypto.randomBytes(32));
  let wrong = 0;
  for (let i = 0; i < 40; i++) {
    const data = new Uint8Array(crypto.randomBytes(4 + i * 3));
    if (!Buffer.from(S.sign(game.yf, key, data)).equals(Buffer.from(game.yf(key, data)))) wrong++;
  }
  const k = S._keys.get(key);
  say(wrong === 0 && !S._bad && k && k.checks >= S._CHECKS, "it signs exactly as the game does (" + wrong + " of 40 frames differ" +
      (S._bad ? ", and it switched itself off" : "") + ")");
}

// 3. an original it disagrees with switches it off, and wins
{
  const S = load();
  const key = new Uint8Array(crypto.randomBytes(32));
  const liar = () => new Uint8Array(6).fill(7);
  const first = S.sign(liar, key, new Uint8Array([1, 2, 3]));
  let still = 0;
  for (let i = 0; i < 10; i++) if (S.sign(liar, key, new Uint8Array([i])).every(b => b === 7)) still++;
  say(S._bad === true && first.every(b => b === 7) && still === 10,
      "a signing function it disagrees with switches it off, and that function's bytes are what is sent");
}

// 4. no signing alone before it has matched
{
  const S = load();
  const key = new Uint8Array(crypto.randomBytes(32));
  let calls = 0;
  const counted = (k, data) => { calls++; return new Uint8Array(crypto.createHmac("sha256", Buffer.from(k)).update(Buffer.from(data)).digest().subarray(0, 6)); };
  for (let i = 0; i < 10; i++) S.sign(counted, key, new Uint8Array([i, i + 1]));
  say(calls === S._CHECKS && S._CHECKS >= 1, "the game's own function signs the first " + S._CHECKS + " frames of a session alongside it, then it signs alone (" +
      calls + " of 10 went to the original)");
}

console.log("\n  " + (bad ? bad + " check(s) failed" : "all checks hold"));
process.exit(bad ? 1 : 0);
