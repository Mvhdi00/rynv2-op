/* The 2025 protocol change, against the game's own new bundle.
 *
 *   node ryn-protocol-2025.js [ryn.js] [bundle.js]
 *
 * The game updated and the wire format moved under it. This reads what the new
 * bundle does, reads what RYN now does, and requires them to agree — because
 * the failure mode is silent: a client that builds the pre-2025 session
 * connects, sends frames the server discards, and decodes incoming frames to
 * garbage. Nothing throws.
 *
 * What it CANNOT tell you: whether the live server accepts the result. RYN does
 * not boot in this harness, and the `moomoo-protocol` module the bundle imports
 * (BUILD_ID, mixKey, BUILD_SALT) is not in this repo — RYN reaches it through
 * the bundle's own scope rather than reimplementing it, which is the point.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const RYN = process.argv[2] || path.join(ROOT, "ryn/Ryn_Type_2.user.js");
const NEW = process.argv[3] || path.join(ROOT, "harness/fixtures/moomoo_index_new.js");
const OLD = path.join(ROOT, "harness/fixtures/moomoo_bundle.js");

const src = fs.readFileSync(RYN, "utf8");
const nb = fs.readFileSync(NEW, "utf8");
const ob = fs.readFileSync(OLD, "utf8");

let bad = 0;
const say = (ok, line) => { if (!ok) bad++; console.log("  " + (ok ? "ok  " : "FAIL") + "  " + line); };

console.log(path.basename(RYN) + " vs " + path.basename(NEW) + " — the 2025 protocol\n");

// ── what the bundle itself now does ───────────────────────────────────────
console.log("  THE BUNDLE — read, not assumed\n");

const consts = /const uf=([^,]+),So=([^,]+),Ws=([^,]+),Bl=(\[[^\]]*\]),hf=([^,]+),Dl=(\[[^\]]*\])/.exec(nb);
say(!!consts, "the protocol constants and both opcode tables are found");
const ev = x => Function("return (" + x + ")")();
const sigBytes = ev(consts[2]), mode = ev(consts[3]);
const c2s = JSON.parse(consts[4]), s2c = JSON.parse(consts[6]);

const oldT = /bo=(\[[^\]]*\])\s*,\s*To=(\[[^\]]*\])/.exec(ob);
const oc2s = JSON.parse(oldT[1]), os2c = JSON.parse(oldT[2]);

console.log("    signature width   " + sigBytes + "  (was " + 6 + ")");
console.log("    encrypted mode    " + mode + "  (was " + 1 + ")");
console.log("    c2s opcodes       " + c2s.length + " (was " + oc2s.length + ")  added: " +
            (c2s.filter(x => !oc2s.includes(x)).join(", ") || "none"));
console.log("    s2c opcodes       " + s2c.length + " (was " + os2c.length + ")  added: " +
            (s2c.filter(x => !os2c.includes(x)).join(", ") || "none"));
console.log("");

say(sigBytes === 6, "the signature is still 6 bytes, so the frame layout is unchanged");
say(c2s.length > oc2s.length, "the client->server table GREW — a client with the old table " +
    "maps every opcode to the wrong number");
say(s2c.length > os2c.length, "and so did server->client");

// The new session build, straight out of the bundle.
const init = /const (\w+)=(\w+)\[1\]>>>0,(\w+)=(\w+)\(\w+\[2\]\),(\w+)=(\w+)\?(\w+)\((\w+),\1\):\3/.exec(nb)
  || /(\w+)\[1\]>>>0/.exec(nb);
say(/\?z0\(|z0\(\w+,\w+\)/.test(nb) || /mixKey/.test(nb),
    "the bundle mixes the key with the seed (mixKey) on a pinned connection");
say(/import\{BUILD_ID as \w+,mixKey as \w+,BUILD_SALT as \w+\}from"moomoo-protocol"/.test(nb),
    "BUILD_ID, mixKey and BUILD_SALT come from a new `moomoo-protocol` module");
say(/\?"\?":"&"\)\+"b=",\w+\)/.test(nb) || /\+"b=",Q0\)/.test(nb),
    "the socket URL now carries ?b=<BUILD_ID> as well as ?token=");
say(/\w+&&\w+\[[^\]]*\]&&Nl\(/.test(nb) || /Nl\(\w+,\w+\(/.test(nb),
    "frames are XOR-masked per message on a pinned connection");

// ── what RYN now does ─────────────────────────────────────────────────────
console.log("\n  THE CLIENT — the same four facts\n");

function slice(mark, label) {
  const i = src.indexOf(mark);
  if (i === -1) throw new Error("could not find " + label);
  const open = src.indexOf("{", i + mark.length - 1);
  let d = 0;
  for (let k = open; k < src.length; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}") { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error("unbalanced " + label);
}
const strip = c => c.replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");

const handle = strip(slice("handleMessage(event) {", "handleMessage"));
say(/applyMask\(bytes,\s*enc\.maskVal\(/.test(handle),
    "incoming frames are unmasked before they are decoded");
say(/received\s*=\s*\(\s*cryptoIn\.received\s*\|\|\s*0\s*\)\s*\+\s*1/.test(handle),
    "with a per-message counter, which is what the mask value is derived from");

const ioinit = src.slice(src.indexOf('case "io-init":'), src.indexOf('case "io-init":') + 1800);
const io = strip(ioinit);
say(/args\[4\]\s*===\s*1/.test(io), "io-init's fifth field is read as the `pinned` flag");
say(/enc\.mixKey\(baseKey,\s*seed\)/.test(io), "a pinned key is mixed with the seed");
say(/enc\.Po\(seed,\s*enc\.salt\)/.test(io), "and the opcode tables are salted with BUILD_SALT");
say(/enc\.maskFrom\(key\)/.test(io), "and the mask is derived from the mixed key");
say(/mask:\s*pinned/.test(io) && /mask:\s*pinned\s*&&\s*enc\.maskFrom\s*\?/.test(io) || /mask:\s*pinned/.test(io),
    "an unpinned connection gets no mask, as the bundle does");

const bot = strip(src.slice(src.indexOf("const botCrypto = this.client._gameCrypto;"),
                            src.indexOf("const botCrypto = this.client._gameCrypto;") + 1600));
say(/applyMask\(d\.subarray\(enc\.jt\)/.test(bot),
    "outgoing bot frames mask the PAYLOAD only, leaving the signature clear");
say(/maskVal\(botCrypto\.mask,\s*n\)/.test(bot),
    "keyed on the sequence number, which is what the bundle uses outbound");

// ── the primitives it binds ───────────────────────────────────────────────
/* A login hook can keep matching and still stop INSTALLING the call it exists
 * for — the pattern is fine, the replacement is gutted. Mutation testing found
 * three such holes, all of them silent: the latch simply never releases again.
 * So each rewrite is required to carry the call it is for. */
console.log("\n  THE LOGIN HOOKS — matching is not enough, they must install\n");
{
  function hookText(name) {
    const i = src.indexOf('Hook.replace("' + name + '"');
    if (i === -1) return null;
    // to the end of the statement, past any `);` inside the pattern itself
    let depth = 0, q = null;
    for (let k = src.indexOf("(", i); k < src.length; k++) {
      const c = src[k];
      if (q) { if (c === "\\") k++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === "/" && src[k + 1] !== "/" && src[k + 1] !== "*") {
        // skip a regex literal
        let j = k + 1;
        for (; j < src.length; j++) {
          if (src[j] === "\\") { j++; continue; }
          if (src[j] === "/") break;
        }
        k = j; continue;
      }
      if (c === "(") depth++;
      else if (c === ")") { depth--; if (!depth) return src.slice(i, k + 1); }
    }
    return null;
  }
  const INSTALLS = {
    connectLatchFix:      "RYN._Login._releaseConnect",
    connectGuardRelease:  "RYN._Login._releaseConnect",
    disconnectRelease:    "RYN._Login._onDisconnect",
    spawnLatchRelease:    "RYN._Login._releaseSpawn",
  };
  for (const [name, call] of Object.entries(INSTALLS)) {
    const t = hookText(name);
    say(!!t, name + " is present");
    if (t) say(t.includes(call), name + " installs " + call + "()");
  }
  // The disconnect rewrite must clear BOTH flags, or Tc still returns early.
  const d = hookText("disconnectRelease");
  say(!!d && /\$2=!1,\$3=!1/.test(d),
      "disconnectRelease clears both En and Cn — clearing one leaves Tc returning at `if(Cn)return`");
  // And the guard release must cover both of xh's early returns, not one.
  const g = hookText("connectGuardRelease");
  say(!!g && (g.match(/RYN\._Login\._releaseConnect\(\)/g) || []).length === 2,
      "connectGuardRelease covers BOTH of xh's early returns (no server, server full)");
}

console.log("\n  THE BINDING — lazy, and it cannot take the game down\n");
/* Taken to the end of the statement, not to the first `);` — the regex literal
 * inside the hook contains `);` itself, so a lazy match stopped at the pattern
 * and reported the replacement as missing everything. */
const hookStart = src.indexOf('Hook.replace("exposeCryptoFns"');
const hook = src.slice(hookStart, src.indexOf('"let $5=null");', hookStart) + 20);
say(/Object\.defineProperty\(RYN,'_enc'/.test(hook),
    "_enc is a lazy getter, so the names resolve after every declaration has run");
say(/try\{/.test(hook) && /catch\(e\)\{return null\}/.test(hook),
    "and it is wrapped, so a renamed identifier degrades the bot path rather than throwing");
say(!/Eo:Eo|jt:jt|Po:Po|Ro:Ro/.test(hook),
    "it no longer binds Eo/jt/Po/Ro, which in this bundle are a keybind map, the " +
    "Turnstile token, a DOM button and an array — all declared after the injection point");

/* The one that mattered: those four are `let`/`const` further down the module,
 * so the old eager injection threw a TDZ ReferenceError while the rewritten
 * bundle was still evaluating and killed the whole game at load. */
const inj = nb.indexOf("const Gl=new q0,Sf=new V0;let xe=null");
for (const [name, pat] of [["Eo", /let st=\{\},ia=\{\},Eo=\{\}/], ["jt", /let jt,Se,Ii/],
                           ["Po", /Po=document\.getElementById/], ["Ro", /Ro=\[\];function/]]) {
  const m = pat.exec(nb);
  say(!!m && m.index > inj, name + " really is declared after the injection point (" +
      (m ? m.index : "?") + " > " + inj + ") — a TDZ, not a guess");
}

console.log("\n  Not covered: the live server accepting any of this, and the moomoo-protocol");
console.log("  module itself, which RYN reaches through the bundle rather than reimplementing.");
console.log("\n  " + (bad ? bad + " assertion(s) failed" : "all assertions hold"));
process.exit(bad ? 1 : 0);
