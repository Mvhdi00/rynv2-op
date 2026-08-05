#!/usr/bin/env node
/*
 * fix-mods.js
 *
 * Repairs the two old-bundle moomoo mods in src/mods against the game bundle
 * checked in under src/ (game_index.js + game_vendor.js).
 *
 * Both mods are forks of the pre-2024 webpack `bundle.js`. Neither one was
 * broken by anything it does itself — the game moved:
 *
 *   1. Transport. io-init now negotiates a per-connection opcode permutation
 *      and an HMAC key; client frames carry a 6-byte truncated HMAC-SHA256
 *      prefix, and server frames arrive with numeric opcodes. The mods still
 *      speak plain msgpack([name, args]), so every packet they send is dropped
 *      and every packet they receive lands on `events[<number>]`, which is
 *      undefined.
 *
 *   2. Entry. The old io-client fires the connect callback from `onopen`. The
 *      spawn packet therefore goes out before io-init has handed over the
 *      opcode table, so the player never enters the world. The shipped bundle
 *      calls back from io-init instead.
 *
 *   3. The WebSocket lock. The bundle now runs an anti-userscript pass at load
 *      that makes `window.WebSocket` non-writable and non-configurable. Both
 *      mods hook it by plain assignment at document-end/idle, which is after
 *      the lock, so the hook silently does nothing and the mod never sees a
 *      connection at all.
 *
 *   4. Table drift — config scalars, skin colours and one weapon row that no
 *      longer match src/game_index.js.
 *
 * Every edit is anchored to an exact string; a missing or ambiguous anchor
 * fails the run rather than producing a half-fixed script.
 *
 *   node tools/fix-mods.js
 */

const fs = require("fs");
const path = require("path");

const T = require("./mod-transport.js");

const ROOT = path.resolve(__dirname, "..");
const DRIVERS = T.drivers();
const MSGPACK_ID = "./node_modules/msgpack-lite/lib/browser.js";

/* ------------------------------------------------------------------ *
 * Small anchored-edit harness, shared by both mods.
 * ------------------------------------------------------------------ */

function Patcher(label, code) {
  const applied = [];

  function edit(name, find, replace) {
    const parts = code.split(find);
    if (parts.length === 1) throw new Error(`[${label}] anchor not found: ${name}`);
    if (parts.length > 2)
      throw new Error(`[${label}] anchor is ambiguous (${parts.length - 1} hits): ${name}`);
    code = parts[0] + replace + parts[1];
    applied.push(name);
  }

  function slice(name, from, to) {
    const a = code.indexOf(from);
    if (a === -1) throw new Error(`[${label}] slice start not found: ${name}`);
    const b = code.indexOf(to, a);
    if (b === -1) throw new Error(`[${label}] slice end not found: ${name}`);
    return code.slice(a, b);
  }

  return {
    edit,
    slice,
    applied,
    get code() { return code; },
    set code(v) { code = v; },
  };
}

/* Locate a webpack module's body — the span inside the braces of its
 * `function (module, exports, __webpack_require__) { ... }` — so it can be
 * swapped wholesale without depending on how the bundle was beautified. */
function moduleBodyRange(code, id) {
  const at = code.indexOf(JSON.stringify(id) + ":");
  if (at === -1) throw new Error(`webpack module not found: ${id}`);
  const fnAt = code.indexOf("function", at);
  if (fnAt === -1) throw new Error(`module has no factory: ${id}`);
  const open = code.indexOf("{", code.indexOf(")", fnAt));

  let depth = 0;
  let quote = null;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "/" && code[i + 1] === "/") {
      const nl = code.indexOf("\n", i);
      i = nl === -1 ? code.length : nl;
      continue;
    }
    if (c === "/" && code[i + 1] === "*") {
      const cl = code.indexOf("*/", i);
      i = cl === -1 ? code.length : cl + 1;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return { start: open + 1, end: i };
    }
  }
  throw new Error(`unterminated webpack module: ${id}`);
}

/* The five config keys the current bundle carries that the old one did not.
 * `_t` is pinned to 0 in the shipped game, so MAX_ATTACK/MAX_SPEED are inert
 * multipliers today — they are mirrored so the mod's config keeps matching the
 * game's rather than because they change anything right now. */
const NEW_CONFIG_KEYS = `
                    // EVENT MULTIPLIERS (added by the current bundle):
                    module.exports.MAX_ATTACK = ${DRIVERS.config.MAX_ATTACK};
                    module.exports.MAX_SPAWN_DELAY = ${DRIVERS.config.MAX_SPAWN_DELAY};
                    module.exports.MAX_SPEED = ${DRIVERS.config.MAX_SPEED};
                    module.exports.MAX_TURN_SPEED = ${DRIVERS.config.MAX_TURN_SPEED};
                    module.exports.DAY_INTERVAL = ${DRIVERS.config.DAY_INTERVAL};
`;

/* ------------------------------------------------------------------ *
 * Shared fixes
 * ------------------------------------------------------------------ */

function replaceIoClient(p, extras) {
  const range = moduleBodyRange(p.code, "./src/js/libs/io-client.js");
  p.code =
    p.code.slice(0, range.start) +
    T.ioClientModule({ protocol: DRIVERS.protocol, extras, msgpackId: MSGPACK_ID }) +
    p.code.slice(range.end);
  p.applied.push("transport: io-client rewritten for the keyed opcode protocol");
}

/* The mods install their socket hook deep inside the bundle, long after the
 * game has locked window.WebSocket. The prologue now owns the property; this
 * just registers the mod's connect function with it. */
function rewireSocketHook(p, hookSource) {
  p.edit(
    "entry: socket hook handed to the document-start prologue",
    hookSource,
    `/* The document-start prologue already owns window.WebSocket — the game
             * bundle locks the property before this point, so assigning to it
             * here is a no-op. Register the connect function with the prologue
             * instead, and it replays any address the game already asked for. */
            window.__reupSocketHook(connectSocket);`
  );
}

/* The metadata block has to stay the first thing in the file for the userscript
 * manager to read it, so it is lifted back out over the prologue. */
function wrapForDomReady(p, name) {
  const marker = "// ==/UserScript==";
  const at = p.code.indexOf(marker);
  if (at === -1) throw new Error("no userscript header to hoist");
  const header = p.code.slice(0, at + marker.length);
  const body = p.code.slice(at + marker.length).replace(/^\r?\n/, "");

  p.code = header + "\n\n" + T.prologue(name) + T.domReadyOpen() + body + T.domReadyClose();
  p.applied.push("entry: body deferred to DOM-ready, prologue runs at document-start");
}

function rewriteHeader(p, header) {
  const end = p.code.indexOf("// ==/UserScript==");
  if (end === -1) throw new Error("no userscript header found");
  p.code = header + p.code.slice(end + "// ==/UserScript==".length).replace(/^\r?\n/, "\n");
  p.applied.push("header: rewritten (document-start, dead @require lines dropped)");
}

/* ------------------------------------------------------------------ *
 * Dune's mod
 * ------------------------------------------------------------------ */

function fixDune() {
  const src = path.join(ROOT, "src/mods/Dune_Mod_0.1.0.js");
  const p = Patcher("dune", fs.readFileSync(src, "utf8"));

  rewriteHeader(
    p,
    `// ==UserScript==
// @name         Dune's mod unpatch (fixed)
// @namespace    http://tampermonkey.net/
// @version      0.1.1
// @description  try to take over the world!
// @author       dune
// @match        *://moomoo.io/*
// @match        *://sandbox.moomoo.io/*
// @match        *://dev.moomoo.io/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=moomoo.io
// @run-at       document-start
// @grant        none
// ==/UserScript==`
  );

  /* msgpack came in over @require, but the only consumer is the io-client
   * module, which resolves msgpack-lite out of the bundle itself. The remote
   * copy is a dependency on a third-party host for nothing. */
  p.applied.push("header: dropped the unused msgpack @require (bundle carries msgpack-lite)");

  replaceIoClient(p, "");

  rewireSocketHook(
    p,
    `window.OriginalWebSocket = window.WebSocket;
            window.WebSocket = class {
                constructor(wsAddress) {
                    connectSocket(wsAddress);
                };
            }`
  );

  /* The current bundle sends movement at 5 Hz. At 20 the mod is putting out
   * four times the frames the server expects for the same input. */
  p.edit(
    "config: clientSendRate 20 -> 5",
    "module.exports.clientSendRate = 20;",
    `module.exports.clientSendRate = ${DRIVERS.config.clientSendRate};`
  );

  p.edit(
    "config: maxPlayers 50 -> 40",
    'module.exports.maxPlayers = (process && process.argv.indexOf("--largeserver") != -1) ? 80 : 50;',
    `module.exports.maxPlayers = (process && process.argv.indexOf("--largeserver") != -1) ? 80 : ${DRIVERS.config.maxPlayers};`
  );

  p.edit(
    "config: added the bundle's MAX_* / DAY_INTERVAL keys",
    "                    module.exports.mapPingTime = 2200;",
    "                    module.exports.mapPingTime = 2200;\n" + NEW_CONFIG_KEYS
  );

  wrapForDomReady(p, "Dune's mod");

  return { out: path.join(ROOT, "Dune_Mod_Fixed.user.js"), p };
}

/* ------------------------------------------------------------------ *
 * cowgame
 * ------------------------------------------------------------------ */

function fixCow() {
  const src = path.join(ROOT, "src/mods/Cowgame_v7.js");
  const p = Patcher("cowgame", fs.readFileSync(src, "utf8"));

  /* Pull the author's own send-path extras out before the module is replaced,
   * so the rate limiter and the chat filter survive verbatim. */
  const rateLimit = p.slice(
    "cowgame send preamble",
    "                        if (!firstSend.min) {",
    "                        if (secPacket < secMax && minPacket < minMax) {"
  );
  const chatFilter = p
    .slice(
      "cowgame send filters",
      '                            if (type == "ch") {',
      "                            let binary = msgpack.encode("
    )
    /* Both of these were dead: the game renamed chat to "6" and alliance
     * creation to "L" — cowgame already sends the new names, so the filter and
     * the clan-name padding never ran. Retargeted to the live opcodes. */
    .replace('if (type == "ch") {', 'if (type == "6") {')
    .replace('} else if (type == "8") {', '} else if (type == "L") {');

  if (!chatFilter.includes('type == "6"') || !chatFilter.includes('type == "L"')) {
    throw new Error("[cowgame] send filters did not retarget onto the live opcodes");
  }

  rewriteHeader(
    p,
    `// ==UserScript==
// @name         cowgame (fixed)
// @author       Emre
// @description  Thanks for $weetDream$, Blockkidd and Hisyrury
// @version      7.1
// @match        *://moomoo.io/*
// @match        *://*.moomoo.io/*
// @run-at       document-start
// @license      MIT
// @grant        none
// ==/UserScript==`
  );
  p.applied.push(
    "header: dropped the rawgit msgpack @require (host is gone; bundle carries msgpack-lite)"
  );
  p.applied.push("header: dropped the csb.app cow.js @require (see the window.r gate below)");

  /* The whole script was gated on metadata equality with `window.r`, which the
   * csb.app @require supplied. With that host gone `window.r` is undefined and
   * the very first statement throws, so nothing runs at all. Keep the check
   * where the data is actually present; skip it where it is not. */
  p.edit(
    "entry: window.r integrity gate no longer bricks when its host is unreachable",
    "if (GM_info.script.name == window.r[0] && GM_info.script.author == window.r[1] && GM_info.script.description == window.r[2] && GM_info.script.version == window.r[3]) {",
    `var __sig = (typeof window !== "undefined" && window.r) || null;
var __gm = typeof GM_info !== "undefined" ? GM_info : null;
if (!__sig || !__gm || (__gm.script.name == __sig[0] && __gm.script.author == __sig[1] && __gm.script.description == __sig[2] && __gm.script.version == __sig[3])) {`
  );

  replaceIoClient(
    p,
    `                        if (!this.connected) return;
${rateLimit}                        if (secPacket >= secMax || minPacket >= minMax) return;
${chatFilter}                        minPacket++;
                        secPacket++;
`
  );

  rewireSocketHook(
    p,
    `window.OriginalWebSocket = window.WebSocket;
            window.WebSocket = class {
                constructor(wsAddress) {
                    connectSocket(wsAddress);
                };
            }`
  );

  p.edit(
    "config: maxPlayers 60 -> 40",
    'module.exports.maxPlayers = process && process.argv.indexOf("--largeserver") != -1 ? 80 : 60;',
    `module.exports.maxPlayers = process && process.argv.indexOf("--largeserver") != -1 ? 80 : ${DRIVERS.config.maxPlayers};`
  );

  /* The 11th colour is not in the game's table. Picking it sends a skin index
   * the server has no entry for, and every other client renders it as
   * undefined. */
  p.edit(
    "config: skinColors trimmed to the game's 10",
    'module.exports.skinColors = ["#bf8f54", "#cbb091", "#896c4b", "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3", "#8bc373", "#91b2db", ];',
    `module.exports.skinColors = ${JSON.stringify(DRIVERS.config.skinColors).replace(/","/g, '", "')};`
  );

  p.edit(
    "config: added the bundle's MAX_* / DAY_INTERVAL keys",
    "                    module.exports.mapPingTime = 2200;",
    "                    module.exports.mapPingTime = 2200;\n" + NEW_CONFIG_KEYS
  );

  /* Short sword carried the katana's sprite and offset — index 3 got index 4's
   * `src`/`yOff` at some point. The game has sword_1 / 46. */
  p.edit(
    "weapons: short sword sprite restored to sword_1 / yOff 46",
    `                    name: "short sword",
                    desc: "increased attack power but slower move speed",
                    src: "samurai_1",
                    iPad: 1.3,
                    length: 130,
                    width: 210,
                    xOff: -8,
                    yOff: 59,`,
    `                    name: "short sword",
                    desc: "increased attack power but slower move speed",
                    src: "${DRIVERS.weapons[3].src}",
                    iPad: 1.3,
                    length: 130,
                    width: 210,
                    xOff: -8,
                    yOff: ${DRIVERS.weapons[3].yOff},`
  );

  wrapForDomReady(p, "cowgame");

  return { out: path.join(ROOT, "Cowgame_Fixed.user.js"), p };
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

for (const build of [fixDune, fixCow]) {
  const { out, p } = build();
  fs.writeFileSync(out, p.code);
  console.log(path.relative(ROOT, out));
  for (const line of p.applied) console.log("  - " + line);
  console.log("");
}
