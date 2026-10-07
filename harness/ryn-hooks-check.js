/* Every RYN bundle hook, against a real game bundle — does it MATCH, and does
 * what it injects RESOLVE?
 *
 *   node ryn-hooks-check.js [ryn.js] [bundle.js ...]
 *
 * RYN works by rewriting the game's own bundle with ~50 regex patches. Two
 * things can go wrong when the game updates, and only one of them is obvious:
 *
 *   1. A pattern stops matching. The feature silently disappears. RYN prints
 *      "Failed to find: <name>" to a console nobody reads.
 *
 *   2. A pattern still matches, but the code it injects names identifiers that
 *      no longer exist — or, far worse, still exist and are declared LATER.
 *      Reading a `let`/`const` binding before its declaration is a TDZ
 *      ReferenceError thrown while the rewritten bundle is evaluating, which
 *      kills the whole game at load. The script installs, the menu never
 *      works, and nothing in RYN's own logging says why.
 *
 * (2) is what the 2025 update did to `exposeCryptoFns`: it injected
 * `{Eo:Eo, jt:jt, Po:Po, Ro:Ro}` at offset ~35k, and in the new bundle all
 * four are declared at 46k, 137k, 143k and 128k. A match-only check is green
 * for that. So this checks both.
 *
 * What it CANNOT tell you: whether a hook that matches patches the RIGHT
 * place. Matching the wrong site is still possible; only reading the context
 * catches that, and the report prints it for eyeballing.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const RYN = process.argv[2] || path.join(ROOT, "ryn/Ryn_Type_2.user.js");
const BUNDLES = process.argv.length > 3
  ? process.argv.slice(3)
  : [path.join(ROOT, "harness/fixtures/moomoo_index_new.js")];

const src = fs.readFileSync(RYN, "utf8");

/* RYN's own Regexer expands NUM{n} into \d{n}; mirror it so the patterns here
 * are the patterns that actually run. */
const expand = s => s.replace(/NUM\{(\d+)\}/g, "\\d{$1}");

/* Pull every Hook.<op>("name", /re/, "replacement") out of the client. The
 * replacement may be a concatenation of string literals across lines. */
function hooks() {
  const out = [];
  const re = /Hook\.(replace|match|append|prepend|template)\(\s*"([^"]+)"\s*,\s*(\/(?:[^\/\\\n]|\\.)+\/[gimsuy]*)\s*(?:,\s*([\s\S]*?))?\)\s*;/g;
  let m;
  while ((m = re.exec(src))) {
    let rx = null;
    try { rx = new RegExp(expand(eval(m[3]).source), eval(m[3]).flags.replace("g", "")); } catch (e) {}
    out.push({ op: m[1], name: m[2], rx, repl: firstArg(m[4]) });
  }
  return out;
}

/* Only the FIRST argument after the regex is the replacement; Hook.replace
 * takes `flags` after it. Joining every string literal in the tail pulled the
 * flags in too, which invented an identifier "FRVRg" out of "FRVR" + "g" and
 * reported a healthy hook as broken. Split on top-level commas instead. */
function firstArg(tail) {
  if (!tail) return null;
  let depth = 0, q = null, end = tail.length;
  for (let i = 0; i < tail.length; i++) {
    const c = tail[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === "," && depth === 0) { end = i; break; }
  }
  const head = tail.slice(0, end).trim();
  if (!/^["']/.test(head)) return null;          // not a string replacement
  const lits = head.match(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g);
  if (!lits) return null;
  try { return lits.map(x => JSON.parse(x[0] === "'" ? '"' + x.slice(1, -1).replace(/"/g, '\\"') + '"' : x)).join(""); }
  catch (e) { return null; }
}

/* Identifiers the injected text reads from the bundle's own scope. Skips its
 * own $1..$9 group refs, property names after a dot, object keys, string
 * contents, and the RYN namespace it is deliberately reaching for. */
function freeIdents(repl) {
  if (!repl) return [];
  let s = repl.replace(/\$\d/g, " ");
  s = s.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");

  /* Names the replacement binds ITSELF — arrow and function parameters, and
   * its own declarations. `checkTrusted` injects
   * `(callback)=>(event)=>callback(event)`, whose two names were reported as
   * undeclared reads of the bundle; they are its own parameters. */
  const bound = new Set();
  for (const m of s.matchAll(/\(([^()]*)\)\s*=>/g)) {
    for (const part of m[1].split(",")) {
      const id = part.trim().match(/^[A-Za-z_$][\w$]*/);
      if (id) bound.add(id[0]);
    }
  }
  for (const m of s.matchAll(/function\s*[\w$]*\s*\(([^()]*)\)/g)) {
    for (const part of m[1].split(",")) {
      const id = part.trim().match(/^[A-Za-z_$][\w$]*/);
      if (id) bound.add(id[0]);
    }
  }
  for (const m of s.matchAll(/(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g)) bound.add(m[1]);

  const out = new Set();
  const re = /(^|[^.\w$])([A-Za-z_$][\w$]*)/g;
  let m;
  /* RYN's own wrapper supplies these to the rewritten bundle:
   *   Hook.wrap("(async function THIS_STORAGE(){const FRVR=window.FRVR; ... const RYN=window.RYN;")
   * so they are in scope even though the bundle never declares them. */
  const SKIP = new Set(["RYN", "THIS_STORAGE", "FRVR",
    "window", "document", "Math", "Object", "Array", "JSON",
    "console", "true", "false", "null", "undefined", "typeof", "function", "return",
    "var", "let", "const", "new", "this", "if", "else", "try", "catch", "void", "in", "of",
    "Uint8Array", "Promise", "setTimeout", "setInterval", "clearInterval",
    "configurable", "get", "set", "value", "writable", "enumerable", "Number", "String"]);
  while ((m = re.exec(s))) {
    const id = m[2];
    if (SKIP.has(id) || bound.has(id)) continue;
    const after = s.slice(m.index + m[0].length);
    if (/^\s*:/.test(after)) continue;          // an object key is not a read
    out.add(id);
  }
  return [...out];
}

/* Where a top-level `let`/`const`/`function`/`var` for `name` is declared.
 * Returns -1 if never declared (a free global, or gone). */
function declIndex(bundle, name) {
  const n = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pats = [
    new RegExp("(?<![\\w$])function\\s+" + n + "\\s*\\(") ,
    new RegExp("(?<![\\w$])(?:const|let|var)\\s+(?:[\\w$]+\\s*=\\s*[^,;]+,\\s*)*?" + n + "\\s*[=,;]"),
    new RegExp("(?<![\\w$])import\\{[^}]*\\bas\\s+" + n + "\\b"),
    new RegExp("(?<![\\w$])import\\{[^}]*\\b" + n + "\\s*[,}]"),
  ];
  let best = -1;
  for (const p of pats) {
    const m = p.exec(bundle);
    if (m && (best === -1 || m.index < best)) best = m.index;
  }
  return best;
}

/* The hooks that DO match the current bundle. A hook dropping out of this set
 * is a regression: the feature silently disappears and the game still runs, so
 * nothing else notices. Mutation testing found six ways to break a hook that
 * left every other check green — reporting a non-match without failing on it is
 * not a test, it is a log line.
 *
 * The eight absent from this list do not match and are not expected to; the
 * report says why each one is gone. Add a name here once its hook is fixed. */
const EXPECTED = new Set([
  "preRenderLoop",
  "postRenderLoop",
  "mapSelfColor",
  "mapTeamColor",
  "mapDeathMarker",
  "LockRotationClient",
  "DisableResetMoveDir",
  "offset",
  "renderEntity",
  "renderItemPush",
  "objectAlpha",
  "resourceTint",
  "animalTint",
  "renderItem",
  "RemoveSendAngle",
  "handleEquip",
  "exposeGameNet",
  "exposeGameCrypto",
  "captureTurnstile",
  "connectLatch",
  "connectLatchFix",
  "connectGuardRelease",
  "disconnectRelease",
  "spawnLatchRelease",
  "exposeCryptoFns",
  "handleBuy",
  "RemovePingCall",
  "RenderGrid",
  "upgradeItem",
  "DeathMarker",
  "updateNotificationRemove",
  "checkTrusted",
  "removeSkins",
  "unlockedItems",
  "gameColor",
  "renderPlayer",
  "meleeWeapon",
  "meleeBody",
  "chatMute",
  "maskFRVR",
  "scaleWidth",
  "scaleHeight",
  "maskLerp",
  "cowName",
  "wolfName",
  "freezeTurnSpeed",
]);

const pad = (v, n) => String(v).padEnd(n);
let bad = 0;

for (const B of BUNDLES) {
  const bundle = fs.readFileSync(B, "utf8");
  const list = hooks();
  console.log("\n" + path.basename(RYN) + "  vs  " + path.basename(B) + "\n");
  console.log("  " + pad("hook", 28) + pad("match", 7) + pad("injects", 9) + "note");
  console.log("  " + "-".repeat(94));

  const broken = [], fatal = [];
  for (const h of list) {
    if (!h.rx) { console.log("  " + pad(h.name, 28) + pad("BAD", 7) + pad("-", 9) + "regex did not parse"); bad++; continue; }
    const m = h.rx.exec(bundle);
    if (!m) {
      broken.push(h.name);
      const regressed = EXPECTED.has(h.name);
      if (regressed) bad++;
      console.log("  " + pad(h.name, 28) + pad(regressed ? "LOST" : "no", 7) + pad("-", 9) +
        (regressed ? "REGRESSION — this hook used to match and no longer does"
                   : "pattern does not match this bundle (known, not expected to)"));
      continue;
    }
    const at = m.index;
    const ids = freeIdents(h.repl);
    const problems = [];
    for (const id of ids) {
      const d = declIndex(bundle, id);
      if (d === -1) problems.push(id + " undeclared");
      else if (d > at) problems.push(id + " declared later (TDZ)");
    }
    const tdz = problems.filter(x => x.endsWith("(TDZ)"));
    const unknown = problems.filter(x => !x.endsWith("(TDZ)"));
    if (tdz.length) {
      fatal.push(h.name);
      console.log("  " + pad(h.name, 28) + pad("yes", 7) + pad("FATAL", 9) + tdz.join(", "));
    } else if (unknown.length) {
      /* Not counted as a failure. An identifier with no top-level declaration
       * is usually a browser global, or a word inside a string literal this
       * hook merely substitutes — only a TDZ is certain enough to fail on. */
      console.log("  " + pad(h.name, 28) + pad("yes", 7) + pad("note", 9) +
        "no declaration found for " + unknown.join(", "));
    } else {
      console.log("  " + pad(h.name, 28) + pad("yes", 7) + pad("ok", 9) +
        (ids.length ? ids.length + " identifier(s) resolve" : "literal only"));
    }
  }

  console.log("\n  " + list.length + " hooks: " + (list.length - broken.length) + " match, " +
    broken.length + " do not");
  if (fatal.length) {
    console.log("\n  FATAL — these match but inject something that cannot run:");
    for (const n of fatal) console.log("    " + n);
    console.log("  A TDZ ReferenceError here is thrown while the rewritten bundle is still");
    console.log("  evaluating, so it does not break one feature — it kills the whole game.");
    bad += fatal.length;
  }
  if (broken.length) {
    const lost = broken.filter(n => EXPECTED.has(n));
    const known = broken.filter(n => !EXPECTED.has(n));
    if (lost.length) {
      console.log("\n  REGRESSION — these were matching and are not any more:");
      console.log("    " + lost.join(", "));
    }
    if (known.length) {
      console.log("\n  Known absent (feature gone, game still runs):");
      console.log("    " + known.join(", "));
    }
  }
}

console.log("\n  Not covered: whether a matching hook patches the right site, and anything");
console.log("  that needs the client to actually boot. RYN does not boot in this harness.");
console.log("\n  " + (bad ? bad + " hook(s) would not run" : "every hook matches and resolves"));
process.exit(bad ? 1 : 0);
