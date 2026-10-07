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
/* The bundle unmasks IN PLACE on a view of event.data, keyed on
 * wf(xe.mask.s2c, ++xe.received) — and on the main socket xe is the very
 * object RYN reads. So RYN must read a copy keyed on received+1 and change
 * neither the buffer nor the count; only a bot's own socket is unmasked in
 * place with its own counter. The first version of this did the reverse and
 * corrupted every frame after io-init on a pinned connection. */
{
  const unmasks = handle.match(/applyMask\(bytes,\s*enc\.\w+\(/g) || [];
  const viaWf = handle.match(/applyMask\(bytes,\s*enc\.maskIn\(cryptoIn\.mask\.s2c,/g) || [];
  say(unmasks.length === 2 && viaWf.length === unmasks.length,
      "incoming frames — the main socket's and a bot's — are unmasked with the s2c mask through wf(), " +
      "the bundle's receive-side function (" + viaWf.length + "/" + unmasks.length + ")");
}
say(/bytes\s*=\s*bytes\.slice\(\)/.test(handle) && /\(cryptoIn\.received\s*>>>\s*0\)\s*\+\s*1/.test(handle),
    "on the main socket RYN unmasks a COPY keyed on the count the bundle is about to use");
say(!/cryptoIn\._bundle[\s\S]{0,400}cryptoIn\.received\s*=\s*\(/.test(handle.slice(handle.indexOf("if (cryptoIn._bundle)"), handle.indexOf("} else {", handle.indexOf("if (cryptoIn._bundle)")))),
    "and never advances the bundle's own receive count");
// The bot's branch, not the player's: the player's socket has a counter of
// its own for a build where exposeGameCrypto finds nothing, and the same line
// there would hide this one going missing.
say(/\} else \{\s*cryptoIn\.received\s*=\s*\(\s*cryptoIn\.received\s*\|\|\s*0\s*\)\s*\+\s*1;\s*enc\.applyMask\(bytes,\s*enc\.maskIn\(cryptoIn\.mask\.s2c,\s*cryptoIn\.received\)\)/.test(handle),
    "a bot's socket keeps its own per-message counter");

const ioinit = src.slice(src.indexOf('case "io-init":'), src.indexOf('case "io-init":') + 4200);
const io = strip(ioinit);
say(/args\[4\]\s*===\s*1/.test(io), "io-init's fifth field is read as the `pinned` flag");
say(/enc\.mixKey\(baseKey,\s*seed\)/.test(io), "a pinned key is mixed with the seed");
say(/enc\.Po\(seed,\s*enc\.salt\)/.test(io), "and the opcode tables are salted with BUILD_SALT");
say(/enc\.maskFrom\(key\)/.test(io), "and the mask is derived from the mixed key");
say(/mask:\s*pinned\s*&&\s*enc\.maskFrom\s*\?/.test(io), "an unpinned connection gets no mask, as the bundle does");
/* And RYN's own copy of the session is called ready (`_ready`, which the send
 * gate below accepts on a build where exposeGameCrypto finds nothing) at the
 * same moment, not before: one task on, the bundle has built its own. */
say(/if \(this\.client\.isOwner\) \{\s*const own = this\.client\._gameCrypto;\s*setTimeout\(\(\) => \{\s*if \(own && !own\._bundle\) own\._ready = true;\s*try \{\s*PacketManager2\.pingRequest\(\)/.test(io),
    "the main socket's first ping waits a task — before then the bundle has no session and sends raw — and RYN's copy of the session is ready no sooner");

const bot = strip(src.slice(src.indexOf("const botCrypto = this.client._gameCrypto;"),
                            src.indexOf("const botCrypto = this.client._gameCrypto;") + 1600));
say(/applyMask\(d\.subarray\(enc\.jt\)/.test(bot),
    "outgoing bot frames mask the PAYLOAD only, leaving the signature clear");
say(/maskVal\(botCrypto\.mask\.c2s,\s*o\)/.test(bot),
    "keyed on the c2s mask and the frame's own signature — bf(xe.mask.c2s, signature), as the bundle sends");

const sendPath = strip(slice("    _send(data) {", "PacketManager._send"));
say(/crypto\._bundle\s*\|\|\s*crypto\._ready\s*\|\|\s*!this\.client\.isOwner/.test(sendPath),
    "nothing goes out on the main socket until there is a session: the bundle's own, or RYN's copy once the bundle has had its task to build one");

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

console.log("\n  THE BINDING — lazy, found by shape, and it cannot take the game down\n");
const hookStart = src.indexOf('Hook.replace("exposeCryptoFns"');
const hook = src.slice(src.indexOf("const cryptoName = "), src.indexOf("let \" + session + \"=null\");", hookStart) + 30);
say(/Object\.defineProperty\(RYN,'_enc'/.test(hook),
    "_enc is a lazy getter, so the names resolve after every declaration has run");
say(/try\{/.test(hook) && /catch\(e\)\{return null\}/.test(hook),
    "and it is wrapped, so a missing name degrades the bot path rather than throwing");
say(!/Eo:yf|jt:So|Ro:vf|Po:Ll|maskFrom:kf|applyMask:Nl|maskVal:bf/.test(hook),
    "no minified name is written into it — each is captured from the code that uses it");
for (const [label, re] of [
  ["cryptoSession", /Hook\.match\("cryptoSession"/], ["cryptoInbound", /Hook\.match\("cryptoInbound"/],
  ["cryptoSign", /Hook\.match\("cryptoSign"/], ["cryptoOutbound", /Hook\.match\("cryptoOutbound"/],
  ["cryptoBuild", /Hook\.match\("cryptoBuild"/]]) {
  say(re.test(src), label + " is captured by pattern");
}
// ...and the patterns really do find the bundle's primitives: run them here.
{
  const pat = name => {
    const at = src.indexOf('Hook.match("' + name + '", ');
    const lit = src.slice(at).match(/, (\/(?:[^\/\\\n]|\\.)+\/)\);/)[1];
    return new RegExp(eval(lit).source.replace(/\\w/g, "(?:[^\\x00-\\x7F-]|\\$|\\w)"));
  };
  const session = pat("cryptoSession").exec(nb), inbound = pat("cryptoInbound").exec(nb);
  const signing = pat("cryptoSign").exec(nb), outbound = pat("cryptoOutbound").exec(nb), build = pat("cryptoBuild").exec(nb);
  say(!!session && session[2] === "vf" && session[5] === "z0" && session[9] === "Ll" && session[10] === "K0" && session[11] === "kf",
      "on the fixture they find vf, mixKey (z0), Ll, BUILD_SALT (K0) and kf");
  say(!!inbound && inbound[1] === "Nl" && inbound[2] === "wf", "the receive side's Nl and wf");
  say(!!signing && signing[1] === "yf" && signing[4] === "So", "the signer yf and the signature width So");
  say(!!outbound && outbound[2] === "bf", "the send side's bf");
  say(!!build && build[1] === "Q0", "and BUILD_ID (Q0) from the socket URL");
}

console.log("\n  Not covered: the live server accepting any of this, and the moomoo-protocol");
console.log("  module itself, which RYN reaches through the bundle rather than reimplementing.");
console.log("\n  " + (bad ? bad + " assertion(s) failed" : "all assertions hold"));
process.exit(bad ? 1 : 0);
