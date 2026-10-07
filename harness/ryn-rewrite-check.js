/* RYN's own rewrite, run on the game's bundle — and the result checked.
 *
 *   node ryn-rewrite-check.js [ryn.js] [bundle.js]
 *
 * ryn-hooks-check.js re-implements RYN's pattern syntax to test each hook on
 * its own. That is how two things got through: NUM{4} was read as "four
 * digits" when RYN means "the number 4", so four hooks were reported missing
 * that were there; and each hook was tried against the raw bundle, never
 * against the bundle as the earlier hooks had already left it.
 *
 * This takes RYN's actual Regexer and formatCode2 out of the client, runs
 * them in order on the real bundle, applies the injector's import conversion,
 * and then checks what came out:
 *
 *   - every hook that has to install, installed;
 *   - no hook deleted a large span of the bundle (the 2025 RenderGrid
 *     pattern matched 1,238 characters and took `const Oe=…` with it);
 *   - nothing the bundle still uses lost its declaration ("Oe is not
 *     defined", thrown by every frame);
 *   - the result compiles as the classic script Function() will run it as.
 *
 * What it cannot see is behaviour — that is boot-2025.js, in a browser.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const RYN = process.argv[2] || path.join(ROOT, "ryn/Ryn_Type_2.user.js");
const BUNDLE = process.argv[3] || path.join(__dirname, "fixtures/moomoo_index_new.js");
const src = fs.readFileSync(RYN, "utf8");
const raw = fs.readFileSync(BUNDLE, "utf8");

let bad = 0;
const say = (ok, line) => { if (!ok) bad++; console.log("  " + (ok ? "ok  " : "FAIL") + "  " + line); };

function block(startMarker, label) {
  const i = src.indexOf(startMarker);
  if (i === -1) throw new Error("could not find " + label);
  let d = 0, q = null;
  for (let k = src.indexOf("{", i); k < src.length; k++) {
    const c = src[k];
    if (q) { if (c === "\\") k++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "/" && src[k + 1] === "/") { k = src.indexOf("\n", k); continue; }
    if (c === "/" && src[k + 1] === "*") { k = src.indexOf("*/", k + 2) + 1; continue; }
    if (c === "/" && /[(,=:;!&|?{}\[\s]/.test(src[k - 1] || "")) {
      // a regex literal: skip to its closing slash, minding classes
      let j = k + 1, cls = false;
      for (; j < src.length; j++) {
        if (src[j] === "\\") { j++; continue; }
        if (src[j] === "[") cls = true; else if (src[j] === "]") cls = false;
        else if (src[j] === "/" && !cls) break;
      }
      k = j; continue;
    }
    if (c === "{") d++;
    else if (c === "}") { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error("unbalanced " + label);
}

console.log(path.basename(RYN) + " — its own rewrite of " + path.basename(BUNDLE) + "\n");

// ── run the pipeline ───────────────────────────────────────────────────────
const regexerSrc = block("class Regexer {", "class Regexer");
const formatSrc = block("const formatCode2 = code => {", "formatCode2");
const failed = [], badPattern = [], spans = [], attempted = [];
const sandbox = {
  console,
  Logger: {
    test() {}, warn() {}, log() {},
    error(m) {
      const s = String(m);
      if (s.startsWith("Failed to find: ")) failed.push(s.slice(16));
      else if (s.startsWith("Bad pattern for ")) badPattern.push(s.slice(16));
    },
  },
  isProd: true,
};
vm.createContext(sandbox);
vm.runInContext(regexerSrc + ";\nconst Regexer_default = Regexer;\n" +
  // Record how much text each replace takes out and puts back.
  "const _replace = Regexer.prototype.replace;\n" +
  "Regexer.prototype.replace = function (name, regex, substr, flags) {\n" +
  "  const expression = _replace.call(this, name, regex, substr, flags);\n" +
  "  return expression;\n" +
  "};\n" +
  "const _format = Regexer.prototype.format;\n" +
  "Regexer.prototype.format = function (name, regex, flags) {\n" +
  "  __attempted.push(name);\n" +
  "  const ex = _format.call(this, name, regex, flags);\n" +
  "  try { const m = new RegExp(ex.source, ex.flags.replace('g', '')).exec(this.code); if (m) __spans.push([name, m[0].length, m.index]); } catch (e) {}\n" +
  "  return ex;\n" +
  "};\n" +
  formatSrc + ";\n__out = formatCode2(__raw);", Object.assign(sandbox, { __raw: raw, __spans: spans, __attempted: attempted }));
let code = sandbox.__out;

// The injector's import conversion, as written in loadScript.
const conv = src.slice(src.indexOf("      const resolveSpec = spec => {"), src.indexOf("      Injector_lastCode = code;"));
const injected = new Function("code", "src", "Injector_importMap",
  "const toAbs = p => new URL(p, new URL('.', src).href).href;\n" + conv + "\nreturn code;");
code = injected(code, "https://moomoo.io/assets/" + path.basename(BUNDLE), { resolve: () => null });

// ── the hooks ──────────────────────────────────────────────────────────────
console.log("  THE HOOKS\n");
const MUST = [
  // the frame, the renderer, and drawing through it
  "preRenderLoop", "postRenderLoop", "frameGuard", "exposeResize", "viewport", "nameColor", "adoptRenderer", "renderEntity", "renderItemPush",
  "renderItem", "preRender", "RenderGrid", "objectAlpha", "resourceTint", "buildingTint2025", "animalTint",
  "meleeWeapon", "meleeBody", "mapSelfColor", "mapTeamColor", "mapDeathMarker", "mapPreRender",
  "offset", "renderPlayer", "totalDamage",
  // the network: the socket, its session, and the primitives bots need
  "exposeGameNet", "exposeGameCrypto", "cryptoSession", "cryptoInbound", "cryptoSign", "cryptoOutbound",
  "cryptoBuild", "exposeCryptoFns", "fastSign", "RemovePingCall", "RemovePingState",
  // login: the latch, Turnstile, the server list, FRVR
  "connectLatch", "connectLatchFix", "connectGuardRelease", "disconnectRelease", "spawnLatchRelease",
  "captureTurnstile", "exposeServers", "sdkReady", "noAds", "maskFRVR", "checkTrusted",
  // the rest of what was matching before the update
  "LockRotationClient", "DisableResetMoveDir", "RemoveSendAngle", "handleEquip", "handleBuy", "upgradeItem",
  "DeathMarker", "playerDied", "updateNotificationRemove", "removeSkins", "unlockedItems", "gameColor",
  "chatMute", "scaleWidth", "scaleHeight", "maskLerp", "cowName", "wolfName", "freezeTurnSpeed",
];
// Failed to match, or not even tried any more (the hook was taken out).
const missing = MUST.filter(n => failed.includes(n) || !attempted.includes(n));
say(missing.length === 0, "every hook that has to install, installed" +
    (missing.length ? " — missing: " + missing.join(", ") : " (" + MUST.length + ")"));
say(badPattern.length === 0, "no pattern failed to compile" + (badPattern.length ? ": " + badPattern.join(", ") : ""));
const absent = failed.filter(n => !MUST.includes(n));
console.log("        not installed, and not expected to be: " + (absent.join(", ") || "none"));

// ── no hook deletes the bundle ─────────────────────────────────────────────
/* A replace whose pattern spans hundreds of characters is either keeping them
 * in a group or eating them. Measured as what each replace leaves out: the
 * text a pattern matched that is not in the bundle any more afterwards. */
console.log("\n  WHAT THE REWRITE REMOVED\n");
/* Two hooks span a long way on purpose and keep all of it in a group: the
 * animal draw and the upgrade-button send. Any other long match is a pattern
 * that has wandered — the 2024 renderItemPush anchor appended a push into the
 * middle of a player's aura maths 650 characters on. */
const LONG_OK = new Set(["animalTint", "upgradeItem"]);
const longMatches = spans.filter(([, len]) => len > 300);
const wandered = longMatches.filter(([n]) => !LONG_OK.has(n)).map(([n, len]) => n + " (" + len + ")");
say(wandered.length === 0, "no hook's pattern wanders across the bundle" +
    (wandered.length ? " — " + wandered.join(", ") : " (long by design: " + longMatches.map(([n, len]) => n + " " + len).join(", ") + ")"));

// declarations: anything the rewritten code still uses must still be declared
const declared = c => {
  const set = new Map();
  // Statement-level declarations only: `for(let x=…` is a loop counter, and
  // a short name like that is declared and used in a hundred places.
  for (const m of c.matchAll(/(?<![(\w$.])(?:const |let |function |class )([A-Za-z_$][\w$]*)/g)) set.set(m[1], (set.get(m[1]) || 0) + 1);
  for (const m of c.matchAll(/(?<![(\w$.])(?:const|let) [^;()]*?,([A-Za-z_$][\w$]*)=/g)) set.set(m[1], (set.get(m[1]) || 0) + 1);
  return set;
};
const before = declared(raw), after = declared(code);
const lost = [];
for (const [name, n] of before) {
  if ((after.get(name) || 0) >= n) continue;
  // still referenced in the rewritten code?
  const uses = (code.match(new RegExp("[^\\w$.]" + name.replace(/\$/g, "\\$") + "[^\\w$:]", "g")) || []).length;
  if (uses > 0) lost.push(name);
}
say(lost.length === 0, "nothing the bundle still uses lost its declaration" +
    (lost.length ? " — " + lost.slice(0, 12).join(", ") + (lost.length > 12 ? " …" : "") : ""));

// ── it compiles ────────────────────────────────────────────────────────────
console.log("\n  THE RESULT\n");
let compiled = null;
try { new Function(code); compiled = true; } catch (e) { compiled = e.message; }
say(compiled === true, "the rewritten bundle compiles as classic script" + (compiled === true ? "" : " — " + compiled));
say(!/(^|[\n;{}])\s*import\s*[{*\w"']/.test(code.replace(/\bimport\s*\(/g, "")),
    "no static import is left (the 2025 bundle has two, back to back)");
say(!/\bimport\.meta\b/.test(code), "no import.meta is left");
say(/await import\("https:\/\/moomoo\.io\/assets\/vendor-[^"]+\.js"\)/.test(code) && /await import\("moomoo-protocol"\)/.test(code),
    "both imports became `await import()` — vendor by URL, moomoo-protocol through the page's import map");

console.log("\n  " + (bad ? bad + " check(s) failed" : "all checks hold"));
process.exit(bad ? 1 : 0);
