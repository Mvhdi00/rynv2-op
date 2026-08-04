#!/usr/bin/env node
/*
 * verify-luminary.js
 *
 * Checks Luminary_Fixed.user.js against the shipped game bundle.
 *
 * The interesting check is the first one: the transport the fork now speaks is
 * a hand port of the game's own frame code, so it is run side by side with the
 * original sliced straight out of src/game_index.js. If a permuted opcode or a
 * signature byte disagrees on any of the random cases, the server would drop
 * the frame, and the build is wrong.
 *
 *   node tools/verify-luminary.js [path/to/script.user.js]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const OUT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "Luminary_Fixed.user.js");

const script = fs.readFileSync(OUT_PATH, "utf8");
const source = fs.readFileSync(path.join(ROOT, "src/Luminary_v3.js"), "utf8");
const indexLines = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8").split("\n");
const drivers = JSON.parse(fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8"));

const problems = [];
const notes = [];
const fail = (m) => problems.push(m);
const note = (m) => notes.push(m);

/* ------------------------------------------------------------------ *
 * The game's own implementation, lines 278..405 of the bundle: the salt,
 * both alphabets, the seeded shuffle, SHA-256 and the truncated HMAC.
 * ------------------------------------------------------------------ */

const gameImpl = (() => {
  const body = indexLines.slice(277, 405).join("\n").replace(/^\s*,\s*/, "const ");
  const sandbox = { Math, Uint8Array, Uint32Array, DataView, ArrayBuffer, parseInt };
  vm.runInNewContext(
    body + "\n;globalThis.__out = { Po, Eo, Ro, Io, jt, Ht, bo, To };",
    sandbox
  );
  return sandbox.__out;
})();

/* ------------------------------------------------------------------ *
 * The shipped shim, sliced out of the built userscript so what runs here is
 * what a player would actually load.
 * ------------------------------------------------------------------ */

const shimImpl = (() => {
  const at = script.indexOf("e.exports = (function() {");
  if (at === -1) throw new Error("transport shim not found in the built script");
  const open = script.indexOf("{", script.indexOf("(function()", at));
  const tail = script.indexOf("var state = null;", open);
  if (tail === -1) throw new Error("could not find the end of the shim's protocol block");

  const body = script.slice(open + 1, tail);
  const sandbox = { Math, Uint8Array, Uint32Array, DataView, ArrayBuffer, parseInt, String };
  vm.runInNewContext(
    body + "\n;globalThis.__out = { tablesFor, sign, unhex, TX, RX, SIG, MODE, SALT, C2S, S2C };",
    sandbox
  );
  return sandbox.__out;
})();

/* ---- 1. transport conformance --------------------------------------- */

{
  if (shimImpl.SALT !== gameImpl.Io) fail(`table salt: shim ${shimImpl.SALT}, game ${gameImpl.Io}`);
  if (shimImpl.SIG !== gameImpl.jt) fail(`signature width: shim ${shimImpl.SIG}, game ${gameImpl.jt}`);
  if (shimImpl.MODE !== gameImpl.Ht) fail(`transport mode: shim ${shimImpl.MODE}, game ${gameImpl.Ht}`);
  if (JSON.stringify(shimImpl.C2S) !== JSON.stringify(gameImpl.bo)) fail("c2s alphabet differs from the bundle");
  if (JSON.stringify(shimImpl.S2C) !== JSON.stringify(gameImpl.To)) fail("s2c alphabet differs from the bundle");

  const CASES = 500;
  let tableMismatch = 0, sigMismatch = 0;

  for (let n = 0; n < CASES; n++) {
    const seed = (Math.random() * 4294967296) >>> 0;
    const mine = shimImpl.tablesFor(seed);
    const theirs = gameImpl.Po(seed);

    if (JSON.stringify(mine.c2s.enc) !== JSON.stringify(theirs.c2s.enc)) tableMismatch++;
    else if (JSON.stringify(mine.s2c.dec) !== JSON.stringify(theirs.s2c.dec)) tableMismatch++;

    let keyHex = "";
    for (let i = 0; i < 32; i++) keyHex += ((Math.random() * 256) | 0).toString(16).padStart(2, "0");
    const mineKey = shimImpl.unhex(keyHex);
    const theirKey = gameImpl.Ro(keyHex);
    if (Buffer.compare(Buffer.from(mineKey), Buffer.from(theirKey)) !== 0) fail("hex key decode differs");

    const len = 1 + ((Math.random() * 300) | 0);
    const payload = new Uint8Array(len);
    for (let i = 0; i < len; i++) payload[i] = (Math.random() * 256) | 0;

    const a = Buffer.from(shimImpl.sign(mineKey, payload));
    const b = Buffer.from(gameImpl.Eo(theirKey, payload));
    if (Buffer.compare(a, b) !== 0) sigMismatch++;
  }

  if (tableMismatch) fail(`opcode permutation differs on ${tableMismatch}/${CASES} seeds`);
  if (sigMismatch) fail(`frame signature differs on ${sigMismatch}/${CASES} payloads`);
  if (!tableMismatch && !sigMismatch) {
    note(`transport: ${CASES} random seeds and payloads produce identical tables and signatures`);
  }
}

/* ---- 2. opcode translation covers what the fork actually uses -------- */

{
  const sent = new Set();
  const re = /\bs\.send\(\s*("([^"]+)"|'([^']+)'|(\d+))/g;
  let m;
  while ((m = re.exec(source)) !== null) sent.add(m[2] ?? m[3] ?? m[4]);

  const missing = [...sent].filter((op) => shimImpl.TX[op] === undefined);
  if (missing.length) fail(`c2s opcodes with no translation: ${missing.join(", ")}`);
  else note(`c2s: all ${sent.size} opcodes the fork sends translate onto the current alphabet`);

  const encoded = new Set(Object.values(shimImpl.TX));
  const strayC2S = shimImpl.C2S.filter((o) => !encoded.has(o));
  if (strayC2S.length) fail(`c2s alphabet entries nothing maps onto: ${strayC2S.join(", ")}`);

  const handlerBlock = source.match(/\}\), \{\n\s*id: st,[\s\S]*?\n\s*\}\)/);
  if (!handlerBlock) fail("could not find the fork's s2c handler table");
  else {
    const keys = [...handlerBlock[0].matchAll(/^\s*("?)([\w]+)\1:\s/gm)].map((k) => k[2]);
    const known = new Set(Object.values(shimImpl.RX));
    const unmapped = keys.filter((k) => !known.has(k));
    if (unmapped.length) fail(`s2c handlers nothing decodes to: ${unmapped.join(", ")}`);
    else note(`s2c: all ${keys.length} handlers are reachable from the current alphabet`);

    const decoded = new Set(Object.values(shimImpl.RX));
    if (decoded.size !== shimImpl.S2C.length) {
      fail(`s2c translation is not one-to-one (${decoded.size} names for ${shimImpl.S2C.length} opcodes)`);
    }
  }
}

/* ---- 3. item groups ------------------------------------------------- */

{
  const at = script.indexOf("e.exports.groups = [{");
  if (at === -1) fail("item groups table not found in the built script");
  else {
    const body = script.slice(script.indexOf("[", at));
    let depth = 0, end = -1;
    for (let i = 0; i < body.length; i++) {
      if (body[i] === "[") depth++;
      else if (body[i] === "]") { depth--; if (depth === 0) { end = i; break; } }
    }
    const groups = vm.runInNewContext("(" + body.slice(0, end + 1) + ")", {});
    let bad = 0;
    for (let i = 0; i < drivers.itemGroups.length; i++) {
      const a = groups[i], b = drivers.itemGroups[i];
      if (!a) { bad++; continue; }
      for (const f of ["id", "name", "place", "limit", "sandboxLimit", "layer"]) {
        if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) {
          fail(`itemGroups[${i}] ${b.name}.${f}: script ${JSON.stringify(a[f])}, game ${JSON.stringify(b[f])}`);
          bad++;
        }
      }
    }
    if (!bad) note(`tables: all ${drivers.itemGroups.length} item groups match the shipped bundle`);
  }
}

/* ---- 4. entry ------------------------------------------------------- */

{
  const header = script.slice(0, script.indexOf("// ==/UserScript=="));
  const matches = [...header.matchAll(/^\/\/ @match\s+(\S+)/gm)].map((m) => m[1]);
  if (!matches.length) fail("no @match in the header");
  for (const p of matches) {
    if (!/^(\*|https?):\/\//.test(p)) fail(`@match has no scheme, managers reject it: ${p}`);
  }
  if (!/^\/\/ @run-at\s+document-start/m.test(header)) fail("@run-at document-start is missing");
  else note("entry: runs at document-start with scheme-qualified match patterns");

  if (/endsWith\("bundle\.js"\)/.test(script)) fail("entry still only strips bundle.js");
  if (!/assets\\\/\(index\|vendor\)/.test(script)) fail("entry does not strip the game's module scripts");
  if (!/beforescriptexecute/.test(script)) fail("no guard for game scripts the parser already queued");

  if (/grecaptcha/.test(script)) fail("still calls reCAPTCHA");
  if (!script.includes(drivers.protocol.turnstileSitekey)) fail("turnstile sitekey missing");

  /* `ht` only flips when window.captchaCallback fires, and the page used to
   * fire it from the reCAPTCHA script tag. Nothing calls it now unless the
   * build does, and without it w() never connects and the loading screen
   * never lifts. */
  if (!/window\.captchaCallback\(\)/.test(script)) {
    fail("nothing drives window.captchaCallback, so ht never flips and w() never connects");
  } else note("boot: the build drives window.captchaCallback itself");

  /* #turnstileWidget sits inside the menu, which stays display:none until the
   * connect callback runs - a widget rendered into it would never lay out. */
  if (/getElementById\("turnstileWidget"\)/.test(script)) {
    fail("renders turnstile into the menu's hidden #turnstileWidget");
  }
  if (!/luminaryTurnstileHost/.test(script)) fail("no laid-out host for the turnstile widget");
  else note("captcha: turnstile renders into its own host, not the hidden menu node");

  const stubs = script.match(/var legacy = (\[[^\]]*\]);/);
  if (!stubs) fail("legacy element stubs missing from the entry");
  else {
    const list = JSON.parse(stubs[1]);
    const stillUsed = list.filter((id) => !new RegExp(`getElementById\\("${id}"\\)`).test(source));
    if (stillUsed.length) fail(`stubbing ids the fork never reads: ${stillUsed.join(", ")}`);
    else note(`boot: ${list.length} legacy element(s) stubbed if the page no longer ships them (${list.join(", ")})`);
  }
  if (/:8008\/\?gameIndex=/.test(script)) fail("socket url still carries the old port and gameIndex");
  if (/vultr\.servers/.test(script)) fail("still reads the vultr global the old page defined");
  const listOk =
    script.includes(JSON.stringify(drivers.protocol.apiHost)) &&
    script.includes(JSON.stringify("/servers?v=" + drivers.protocol.serverListVersion));
  if (!listOk) fail("server list url does not match the bundle");
  else note("discovery: server list, socket url and captcha all match the bundle");
}

/* ---- report --------------------------------------------------------- */

console.log(path.relative(ROOT, OUT_PATH));
for (const n of notes) console.log("  ok    " + n);
for (const p of problems) console.log("  FAIL  " + p);
console.log(problems.length ? `\n${problems.length} problem(s)` : "\nall checks passed");
process.exit(problems.length ? 1 : 0);
