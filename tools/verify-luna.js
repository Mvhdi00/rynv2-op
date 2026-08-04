#!/usr/bin/env node
/*
 * verify-luna.js
 *
 * Checks Luna_Fixed.user.js against the shipped game bundle, the same way
 * verify-luminary.js does: the game's own frame code is sliced out of
 * src/game_index.js and run beside the shim the build embedded.
 *
 *   node tools/verify-luna.js [path/to/script.user.js]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const OUT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "Luna_Fixed.user.js");

const script = fs.readFileSync(OUT_PATH, "utf8");
const source = fs.readFileSync(path.join(ROOT, "src/Luna_Client_1.1.js"), "utf8").replace(/\r\n/g, "\n");
const indexLines = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8").split("\n");
const drivers = JSON.parse(fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8"));

const problems = [];
const notes = [];
const fail = (m) => problems.push(m);
const note = (m) => notes.push(m);

const gameImpl = (() => {
  const body = indexLines.slice(277, 405).join("\n").replace(/^\s*,\s*/, "const ");
  const sandbox = { Math, Uint8Array, Uint32Array, DataView, ArrayBuffer, parseInt };
  vm.runInNewContext(body + "\n;globalThis.__out = { Po, Eo, Ro, Io, jt, Ht, bo, To };", sandbox);
  return sandbox.__out;
})();

const shimImpl = (() => {
  const at = script.indexOf("var LUNA_SIG =");
  if (at === -1) throw new Error("transport shim not found in the built script");
  const tail = script.indexOf("var lunaState = null;", at);
  if (tail === -1) throw new Error("could not find the end of the shim's protocol block");
  const sandbox = { Math, Uint8Array, Uint32Array, DataView, ArrayBuffer, parseInt };
  vm.runInNewContext(
    script.slice(at, tail) +
      "\n;globalThis.__out = { lunaTables, lunaHmac, lunaUnhex, LUNA_SIG, LUNA_MODE, LUNA_SALT, LUNA_C2S, LUNA_S2C };",
    sandbox
  );
  return sandbox.__out;
})();

/* ---- 1. transport conformance --------------------------------------- */

{
  if (shimImpl.LUNA_SALT !== gameImpl.Io) fail(`table salt: shim ${shimImpl.LUNA_SALT}, game ${gameImpl.Io}`);
  if (shimImpl.LUNA_SIG !== gameImpl.jt) fail(`signature width: shim ${shimImpl.LUNA_SIG}, game ${gameImpl.jt}`);
  if (shimImpl.LUNA_MODE !== gameImpl.Ht) fail(`transport mode: shim ${shimImpl.LUNA_MODE}, game ${gameImpl.Ht}`);
  if (JSON.stringify(shimImpl.LUNA_C2S) !== JSON.stringify(gameImpl.bo)) fail("c2s alphabet differs from the bundle");
  if (JSON.stringify(shimImpl.LUNA_S2C) !== JSON.stringify(gameImpl.To)) fail("s2c alphabet differs from the bundle");

  const CASES = 500;
  let tableMismatch = 0, sigMismatch = 0;

  for (let n = 0; n < CASES; n++) {
    const seed = (Math.random() * 4294967296) >>> 0;
    const mine = shimImpl.lunaTables(seed);
    const theirs = gameImpl.Po(seed);
    if (JSON.stringify(mine.c2s.enc) !== JSON.stringify(theirs.c2s.enc)) tableMismatch++;
    else if (JSON.stringify(mine.s2c.dec) !== JSON.stringify(theirs.s2c.dec)) tableMismatch++;

    let keyHex = "";
    for (let i = 0; i < 32; i++) keyHex += ((Math.random() * 256) | 0).toString(16).padStart(2, "0");
    const mineKey = shimImpl.lunaUnhex(keyHex);
    const theirKey = gameImpl.Ro(keyHex);
    if (Buffer.compare(Buffer.from(mineKey), Buffer.from(theirKey)) !== 0) fail("hex key decode differs");

    const len = 1 + ((Math.random() * 300) | 0);
    const payload = new Uint8Array(len);
    for (let i = 0; i < len; i++) payload[i] = (Math.random() * 256) | 0;

    const a = Buffer.from(shimImpl.lunaHmac(mineKey, payload).subarray(0, shimImpl.LUNA_SIG));
    const b = Buffer.from(gameImpl.Eo(theirKey, payload));
    if (Buffer.compare(a, b) !== 0) sigMismatch++;
  }

  if (tableMismatch) fail(`opcode permutation differs on ${tableMismatch}/${CASES} seeds`);
  if (sigMismatch) fail(`frame signature differs on ${sigMismatch}/${CASES} payloads`);
  if (!tableMismatch && !sigMismatch) {
    note(`transport: ${CASES} random seeds and payloads produce identical tables and signatures`);
  }
}

/* ---- 2. opcode names ------------------------------------------------ */

{
  const at = script.indexOf(`                    "A": setInitData,`);
  if (at === -1) fail("s2c handler table not found");
  else {
    const block = script.slice(at, script.indexOf("});", at));
    const keys = [...block.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]);
    const missing = drivers.protocol.s2cAlphabet.filter((o) => !keys.includes(o));
    const extra = keys.filter((k) => !drivers.protocol.s2cAlphabet.includes(k));
    if (missing.length) fail(`no handler for s2c ${missing.join(", ")}`);
    if (extra.length) fail(`handles unknown s2c ${extra.join(", ")}`);
    if (!missing.length && !extra.length) note(`s2c: all ${keys.length} handlers are the bundle's own names`);
  }

  const sent = new Set([...script.matchAll(/io\.send\("([^"]+)"/g)].map((m) => m[1]));
  const unknown = [...sent].filter((o) => !drivers.protocol.c2sAlphabet.includes(o));
  if (unknown.length) fail(`sends unknown c2s ${unknown.join(", ")}`);
  else note(`c2s: all ${sent.size} opcodes sent are the bundle's own names`);
}

/* ---- 3. data tables ------------------------------------------------- */

function literalAt(src, at) {
  const start = src.indexOf("[", at);
  const body = src.slice(start);
  let depth = 0, quote = null;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) return body.slice(0, i + 1); }
  }
  throw new Error("unterminated literal");
}

function table(pattern, scope) {
  const at = script.search(pattern);
  if (at === -1) return null;
  return vm.runInNewContext("(" + literalAt(script, at) + ")", Object.assign({ Math }, scope || {}));
}

{
  const groups = table(/module\.exports\.groups\s*=\s*\[/);
  const scope = { module: { exports: { groups: groups || drivers.itemGroups } } };

  const tables = [
    ["itemGroups", groups, drivers.itemGroups],
    ["weapons", table(/\.weapons\s*=\s*\[/), drivers.weapons],
    ["projectiles", table(/\.projectiles\s*=\s*\[/), drivers.projectiles],
    ["items", table(/module\.exports\.list\s*=\s*\[/, scope), drivers.items],
    ["hats", table(/\.hats\s*=\s*\[/), drivers.hats],
    ["accessories", table(/\.accessories\s*=\s*\[/), drivers.accessories],
  ];

  for (const [name, mine, game] of tables) {
    if (!mine) { fail(`${name}: table not found in the built script`); continue; }
    if (mine.length !== game.length) { fail(`${name}: ${mine.length} entries, bundle has ${game.length}`); continue; }
    let bad = 0, extra = 0;
    for (let i = 0; i < game.length; i++) {
      const a = mine[i], b = game[i];
      for (const f of Object.keys(b)) {
        const av = f === "group" ? JSON.stringify(a[f] && a[f].id) : JSON.stringify(a[f]);
        const bv = f === "group" ? JSON.stringify(b[f] && b[f].id) : JSON.stringify(b[f]);
        if (av !== bv) { fail(`${name}[${i}] ${b.name || b.src || i}.${f}: script ${av}, bundle ${bv}`); bad++; }
      }
      for (const f of Object.keys(a)) if (!(f in b)) extra++;
    }
    if (!bad) note(`tables: ${name} (${game.length}) match the bundle` + (extra ? `, ${extra} fork-only field(s) kept` : ""));
  }
}

/* ---- 4. config ------------------------------------------------------ */

{
  const mine = {};
  for (const m of script.matchAll(/module\.exports\.(\w+)\s*=\s*([^;\n]+?);/g)) {
    try {
      mine[m[1]] = vm.runInNewContext("(" + m[2] + ")", { Math, window: { location: { hostname: "moomoo.io" } } });
    } catch {}
  }

  /* deathFadeout is a deliberate Luna change and client-side only. */
  const allowed = new Set(["inSandbox", "deathFadeout"]);
  let bad = 0, seen = 0;
  for (const k of Object.keys(drivers.config)) {
    const g = drivers.config[k];
    if (g === null || typeof g === "object") continue;
    if (!(k in mine) || allowed.has(k)) continue;
    seen++;
    if (JSON.stringify(mine[k]) !== JSON.stringify(g)) {
      fail(`config.${k}: script ${JSON.stringify(mine[k])}, bundle ${JSON.stringify(g)}`);
      bad++;
    }
  }
  if (!bad) note(`config: ${seen} scalars match the bundle`);
}

/* ---- 5. sandbox ----------------------------------------------------- */

{
  if (/VULTR_SCHEME/.test(script)) fail("inSandbox still keys off the server-side VULTR_SCHEME");
  const sites = script.match(/sandboxLimit \|\| Math\.max\([\w.]+\.limit \* 3, 99\)/g) || [];
  if (sites.length < 2) fail(`sandbox cap formula appears ${sites.length} time(s), expected canBuild and the placer`);
  else note(`sandbox: the bundle's per-group cap is used in ${sites.length} place(s)`);
  if (/\(group\.sandboxLimit \|\| 99\)/.test(script)) fail("the placer still caps at sandboxLimit || 99");
}

/* ---- 6. entry ------------------------------------------------------- */

{
  const header = script.slice(0, script.indexOf("// ==/UserScript=="));
  for (const p of [...header.matchAll(/^\/\/ @match\s+(\S+)/gm)].map((m) => m[1])) {
    if (!/^(\*|https?):\/\//.test(p)) fail(`@match has no scheme: ${p}`);
  }
  if (!/^\/\/ @run-at\s+document-start/m.test(header)) fail("@run-at document-start is missing");

  /* The hook has to be installed before the client freezes the property, and
   * the client itself has to wait for a DOM. */
  const hookAt = script.indexOf("__LunaSocket.prototype.send");
  const bootAt = script.indexOf("function __lunaBoot()");
  if (hookAt === -1) fail("the early WebSocket stub is missing");
  else if (bootAt === -1) fail("the client is not deferred to DOMContentLoaded");
  else if (hookAt > bootAt) fail("the WebSocket stub is installed inside the deferred boot, too late to beat the freeze");
  else note("entry: WebSocket stub at document-start, client deferred to DOMContentLoaded");

  if (/window\.WebSocket = class \{/.test(script)) fail("Luna's own late WebSocket replacement is still present");
  if (!/__lunaRegisterConnect/.test(script)) fail("nothing feeds the captured address into Luna");

  /* The client reads window.WebSocket.prototype.send at module scope. */
  if (!/__LunaSocket\.prototype\.send = function/.test(script)) {
    fail("the stub has no prototype send, which the client reads off it");
  }
}

/* ---- report --------------------------------------------------------- */

console.log(path.relative(ROOT, OUT_PATH));
for (const n of notes) console.log("  ok    " + n);
for (const p of problems) console.log("  FAIL  " + p);
console.log(problems.length ? `\n${problems.length} problem(s)` : "\nall checks passed");
process.exit(problems.length ? 1 : 0);
