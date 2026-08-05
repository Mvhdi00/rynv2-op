#!/usr/bin/env node
/*
 * fix-mods.js
 *
 * Repairs the old-bundle moomoo mods in src/mods against the game bundle
 * checked in under src/ (game_index.js + game_vendor.js).
 *
 * All of them are forks of the pre-2024 webpack `bundle.js`. None broke
 * because of anything it does itself — the game moved:
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
 *      that makes `window.WebSocket` non-writable and non-configurable. The
 *      mods hook it by plain assignment at document-end/idle, which is after
 *      the lock, so the hook silently does nothing and the mod never sees a
 *      connection at all.
 *
 *   4. Table drift — config scalars, skin colours, cow names and one weapon
 *      row that no longer match src/game_index.js.
 *
 * Every edit is anchored to an exact string; a missing or ambiguous anchor
 * fails the run rather than producing a half-fixed script.
 *
 *   node tools/fix-mods.js
 */

const fs = require("fs");
const path = require("path");

const T = require("./mod-transport.js");
const B = require("./mod-bundle.js");

const ROOT = path.resolve(__dirname, "..");
const DRIVERS = T.drivers();
const MSGPACK_ID = "./node_modules/msgpack-lite/lib/browser.js";
const NAMED_MSGPACK = `__webpack_require__(${JSON.stringify(MSGPACK_ID)})`;

/* The five config keys the current bundle carries that the old one did not.
 * `_t` is pinned to 0 in the shipped game, so MAX_ATTACK/MAX_SPEED are inert
 * multipliers today — they are mirrored so the mod's config keeps matching the
 * game's rather than because they change anything right now. */
function newConfigKeys(target = "module.exports", sep = ";", indent = " ".repeat(20)) {
  const c = DRIVERS.config;
  return [
    "",
    `${indent}// EVENT MULTIPLIERS (added by the current bundle):`,
    `${indent}${target}.MAX_ATTACK = ${c.MAX_ATTACK}${sep}`,
    `${indent}${target}.MAX_SPAWN_DELAY = ${c.MAX_SPAWN_DELAY}${sep}`,
    `${indent}${target}.MAX_SPEED = ${c.MAX_SPEED}${sep}`,
    `${indent}${target}.MAX_TURN_SPEED = ${c.MAX_TURN_SPEED}${sep}`,
    `${indent}${target}.DAY_INTERVAL = ${c.DAY_INTERVAL}${sep}`,
  ].join("\n");
}

const skinColorsLiteral = JSON.stringify(DRIVERS.config.skinColors).replace(/","/g, '", "');
const cowNamesLiteral = JSON.stringify(DRIVERS.config.cowNames).replace(/","/g, '", "');

/* Short sword carried the katana's sprite and offset — index 3 picked up index
 * 4's `src`/`yOff` somewhere upstream, and every mod in this family inherited
 * it. The game has sword_1 / 46. Anchored by pattern because the same table is
 * indented differently in each of them. */
const SHORT_SWORD_FIX = [
  "weapons: short sword sprite restored to sword_1 / yOff 46",
  /(name: "short sword",[\s\S]{0,200}?src: ")samurai_1(",[\s\S]{0,200}?yOff: )59(,)/,
  `$1${DRIVERS.weapons[3].src}$2${DRIVERS.weapons[3].yOff}$3`,
];

/* These three vary only by indentation and by the --largeserver branch's
 * constant across the Emre-descended mods, so they are written once as
 * patterns rather than four times as literals. */
const MAX_PLAYERS_FIX = [
  `config: maxPlayers -> ${DRIVERS.config.maxPlayers}`,
  /(module\.exports\.maxPlayers = [^;\n]*\?[^:\n]*: )\d+;/,
  `$1${DRIVERS.config.maxPlayers};`,
];

/* The 11th colour is not in the game's table. Picking it sends a skin index
 * the server has no entry for, and every other client renders it as
 * undefined. */
const SKIN_COLORS_FIX = [
  "config: skinColors trimmed to the game's 10",
  /module\.exports\.skinColors = \[[^\]]*\];/,
  `module.exports.skinColors = ${skinColorsLiteral};`,
];

const NEW_KEYS_FIX = [
  "config: added the bundle's MAX_* / DAY_INTERVAL keys",
  /( *)module\.exports\.mapPingTime = 2200;/,
  (m, indent) => m + "\n" + newConfigKeys("module.exports", ";", indent),
];

/* ------------------------------------------------------------------ *
 * Anchored-edit harness
 * ------------------------------------------------------------------ */

function Patcher(label, code) {
  const applied = [];

  /* `find` may be a string or a RegExp; the four Emre-descended mods carry the
   * same tables at three different indentation levels, so some anchors have to
   * be patterns. Either way exactly one match is required. */
  function edit(name, find, replace) {
    if (find instanceof RegExp) {
      const all = [...code.matchAll(new RegExp(find.source, find.flags.replace("g", "") + "g"))];
      if (all.length === 0) throw new Error(`[${label}] anchor not found: ${name}`);
      if (all.length > 1)
        throw new Error(`[${label}] anchor is ambiguous (${all.length} hits): ${name}`);
      const m = all[0];
      code = code.slice(0, m.index) + m[0].replace(find, replace) + code.slice(m.index + m[0].length);
      applied.push(name);
      return;
    }
    const parts = code.split(find);
    if (parts.length === 1) throw new Error(`[${label}] anchor not found: ${name}`);
    if (parts.length > 2)
      throw new Error(`[${label}] anchor is ambiguous (${parts.length - 1} hits): ${name}`);
    code = parts[0] + replace + parts[1];
    applied.push(name);
  }

  /* Regex-anchored because the four Emre-descended mods carry the same
   * send-path code at three different indentation levels. */
  function slice(name, fromRe, toRe) {
    const a = code.search(fromRe);
    if (a === -1) throw new Error(`[${label}] slice start not found: ${name}`);
    const rest = code.slice(a);
    const b = rest.search(toRe);
    if (b === -1) throw new Error(`[${label}] slice end not found: ${name}`);
    return code.slice(a, a + b);
  }

  return {
    label, edit, slice, applied,
    get code() { return code; },
    set code(v) { code = v; },
  };
}

/* ------------------------------------------------------------------ *
 * Steps every mod goes through
 * ------------------------------------------------------------------ */

function replaceIoClient(p, opts) {
  const range = B.ioClientRange(p.code);
  p.code =
    p.code.slice(0, range.start) +
    T.ioClientModule(Object.assign({ protocol: DRIVERS.protocol }, opts)) +
    p.code.slice(range.end);
  p.applied.push("transport: io-client rewritten for the keyed opcode protocol");
}

/* The mods install their socket hook deep inside the bundle, long after the
 * game has locked window.WebSocket. The prologue now owns the property; this
 * just registers the mod's connect function with it. */
function rewireSocketHook(p, hookSource, connectFn) {
  p.edit(
    "entry: socket hook handed to the document-start prologue",
    hookSource,
    `/* The document-start prologue already owns window.WebSocket — the game
             * bundle locks the property before this point, so assigning to it
             * here is a no-op. Register the connect function with the prologue
             * instead, and it replays any address the game already asked for. */
            window.__reupSocketHook(${connectFn});`
  );
}

/* The metadata block has to stay the first thing in the file for the userscript
 * manager to read it, so it is lifted back out over the prologue. */
function wrapForDomReady(p, name) {
  const marker = "// ==/UserScript==";
  const at = p.code.indexOf(marker);
  if (at === -1) throw new Error(`[${p.label}] no userscript header to hoist`);
  const header = p.code.slice(0, at + marker.length);
  const body = p.code.slice(at + marker.length).replace(/^\r?\n/, "");

  p.code = header + "\n\n" + T.prologue(name) + T.domReadyOpen() + body + T.domReadyClose();
  p.applied.push("entry: body deferred to DOM-ready, prologue runs at document-start");
}

function rewriteHeader(p, header) {
  const end = p.code.indexOf("// ==/UserScript==");
  if (end === -1) throw new Error(`[${p.label}] no userscript header found`);
  p.code = header + p.code.slice(end + "// ==/UserScript==".length).replace(/^\r?\n/, "\n");
  p.applied.push("header: rewritten (document-start, dead @require lines dropped)");
}

/* ------------------------------------------------------------------ *
 * Per-mod definitions
 *
 * `prepare` runs before the io-client is replaced, so a mod can lift its own
 * send-path additions out of the module it is about to lose.
 * ------------------------------------------------------------------ */

const MODS = [
  {
    /* ---------------------------------------------------------------- */
    name: "Dune's mod",
    src: "src/mods/Dune_Mod_0.1.0.js",
    out: "Dune_Mod_Fixed.user.js",
    connectFn: "connectSocket",
    io: { msgpackExpr: NAMED_MSGPACK },
    header: `// ==UserScript==
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
// ==/UserScript==`,
    notes: ["header: dropped the unused msgpack @require (bundle carries msgpack-lite)"],
    hook: `window.OriginalWebSocket = window.WebSocket;
            window.WebSocket = class {
                constructor(wsAddress) {
                    connectSocket(wsAddress);
                };
            }`,
    edits: [
      /* The current bundle sends movement at 5 Hz. At 20 the mod is putting
       * out four times the frames the server expects for the same input. */
      ["config: clientSendRate 20 -> 5",
        "module.exports.clientSendRate = 20;",
        `module.exports.clientSendRate = ${DRIVERS.config.clientSendRate};`],
      MAX_PLAYERS_FIX,
      NEW_KEYS_FIX,
    ],
  },

  {
    /* ---------------------------------------------------------------- */
    name: "cowgame",
    src: "src/mods/Cowgame_v7.js",
    out: "Cowgame_Fixed.user.js",
    connectFn: "connectSocket",
    header: `// ==UserScript==
// @name         cowgame (fixed)
// @author       Emre
// @description  Thanks for $weetDream$, Blockkidd and Hisyrury
// @version      7.1
// @match        *://moomoo.io/*
// @match        *://*.moomoo.io/*
// @run-at       document-start
// @license      MIT
// @grant        none
// ==/UserScript==`,
    notes: [
      "header: dropped the rawgit msgpack @require (host is gone; bundle carries msgpack-lite)",
      "header: dropped the csb.app cow.js @require (see the window.r gate below)",
    ],
    hook: `window.OriginalWebSocket = window.WebSocket;
            window.WebSocket = class {
                constructor(wsAddress) {
                    connectSocket(wsAddress);
                };
            }`,
    prepare: (p) => ({ msgpackExpr: NAMED_MSGPACK, extras: liftEmreSendExtras(p) }),
    edits: [
      /* The whole script was gated on metadata equality with `window.r`, which
       * the csb.app @require supplied. With that host gone `window.r` is
       * undefined and the very first statement throws, so nothing runs at all.
       * Keep the check where the data is present; skip it where it is not. */
      ["entry: window.r integrity gate no longer bricks when its host is unreachable",
        "if (GM_info.script.name == window.r[0] && GM_info.script.author == window.r[1] && GM_info.script.description == window.r[2] && GM_info.script.version == window.r[3]) {",
        `var __sig = (typeof window !== "undefined" && window.r) || null;
var __gm = typeof GM_info !== "undefined" ? GM_info : null;
if (!__sig || !__gm || (__gm.script.name == __sig[0] && __gm.script.author == __sig[1] && __gm.script.description == __sig[2] && __gm.script.version == __sig[3])) {`],
      MAX_PLAYERS_FIX,
      SKIN_COLORS_FIX,
      NEW_KEYS_FIX,
      SHORT_SWORD_FIX,
    ],
  },

  {
    /* ---------------------------------------------------------------- */
    name: "lrx v5",
    src: "src/mods/Lrx_v5.js",
    out: "Lrx_v5_Fixed.user.js",
    connectFn: "cS",
    header: `// ==UserScript==
// @name         !!!!!!!!!lrzlrzlrllrzzzx (fixed)
// @namespace    none
// @author       Emre, ueheuaheuhaueheauueahuaeuaehuae, vadviss(pishik)
// @version      v5.00000002
// @description  v5 but optimized and some funct are auto...
// @match        *://moomoo.io/*
// @match        *://*.moomoo.io/*
// @run-at       document-start
// @grant        none
// ==/UserScript==`,
    notes: [
      "header: dropped the rawgit msgpack @require (host is gone; bundle carries msgpack-lite)",
      'header: "@run-at none" replaced with document-start (none is not a valid value)',
    ],
    hook: `window.OriginalWebSocket = window.WebSocket;
            window.WebSocket = class {
                constructor(wsAddress) {
                    cS(wsAddress);
                };
            }`,
    prepare: (p) => ({ msgpackExpr: NAMED_MSGPACK, extras: liftEmreSendExtras(p) }),
    edits: [
      MAX_PLAYERS_FIX,
      /* maxAge is the XP/age ceiling the server actually runs. At 9 the client
       * stopped advancing age long before the server did, so the age readout
       * and the upgrade menu drifted out of step with the real player. */
      ["config: maxAge 9 -> 100",
        "module.exports.maxAge = 9;",
        `module.exports.maxAge = ${DRIVERS.config.maxAge};`],
      SKIN_COLORS_FIX,
      /* The server sends an *index* into this table for every animal name, so
       * a one-entry table leaves every cow past index 0 rendering undefined. */
      ["config: cowNames restored to the game's 45",
        'module.exports.cowNames = ["Xyz"];',
        `module.exports.cowNames = ${cowNamesLiteral};`],
      NEW_KEYS_FIX,
      SHORT_SWORD_FIX,
    ],
  },

  {
    /* ---------------------------------------------------------------- */
    name: "S Client v8.2",
    src: "src/mods/S_Client_v8.2.js",
    out: "S_Client_v8.2_Fixed.user.js",
    connectFn: "connectSocket",
    header: `// ==UserScript==
// @name         ! S Client v8.2 (fixed)
// @namespace    AceScript Scripts
// @creator      InsanityMon, Silly Hamster, Vengeance, Sop, Ueheua
// @description  haha ok
// @version      v8.2.1
// @match        *://moomoo.io/*
// @match        *://sandbox.moomoo.io/*
// @match        *://*.moomoo.io/*
// @icon         https://moomoo.io/img/favicon.png?v=1
// @run-at       document-start
// @grant        none
// ==/UserScript==`,
    notes: ["header: dropped the rawgit msgpack @require (host is gone; bundle carries msgpack-lite)"],
    hook: `window.OriginalWebSocket = window.WebSocket;
            window.WebSocket = class {
                constructor(wsAddress) {
                    connectSocket(wsAddress);
                };
            }`,
    prepare: (p) => ({ msgpackExpr: NAMED_MSGPACK, extras: liftEmreSendExtras(p) }),
    edits: [
      MAX_PLAYERS_FIX,
      SKIN_COLORS_FIX,
      NEW_KEYS_FIX,
      SHORT_SWORD_FIX,
    ],
  },

  {
    /* ----------------------------------------------------------------
     * Chicken is the minified asset, so the module map is an array and the
     * factory parameters are mangled: `e` is module, `t` exports, `n` require.
     * ---------------------------------------------------------------- */
    name: "Chicken v3",
    src: "src/mods/Chicken_v3.js",
    out: "Chicken_v3_Fixed.user.js",
    connectFn: "w",
    header: `// ==UserScript==
// @name        Chicken v3 (fixed)
// @version     v3.1
// @description try to take over the world!
// @author      You
// @match       *://moomoo.io/*
// @match       *://sandbox.moomoo.io/*
// @run-at      document-start
// @grant       none
// ==/UserScript==`,
    hook: `window.OriginalWebSocket = window.WebSocket;
window.WebSocket = class {
    constructor(e) {
        w(e);
     };
}`,
    io: {
      msgpackExpr: "n(24)",
      exportsTarget: "e.exports",
      /* The original required module 19 for its side effects. */
      preamble: "                n(19);",
      extras: "                        window.packetSent++;",
      /* Chicken deliberately neuters close() — `if(false)` around the only
       * statement — so the game's own disconnect path cannot drop the socket.
       * That is the mod's choice, not drift, so it is left exactly as it was.
       * Nothing resets `session` here as a result, which is consistent: a
       * socket that is never closed is never reconnected either. */
      closeBody: `                        if (false) {
                            this.socket && this.socket.close();
                        }`,
    },
    edits: [
      [`config: maxPlayers -> ${DRIVERS.config.maxPlayers}`,
        "e.exports.maxPlayers = 50,",
        `e.exports.maxPlayers = ${DRIVERS.config.maxPlayers},`],
      /* Shame! is the server-assigned hack-shaming hat and the game marks it
       * dontSell, which is what keeps it out of the buyable list. Chicken
       * dropped the flag, so its store offers a hat the server will not grant.
       * The joke rewrites elsewhere in this table are description text only
       * and are left alone. */
      ["hats: Shame! marked dontSell again",
        `        name: "Shame!",
        price: 0,`,
        `        name: "Shame!",
        dontSell: !0,
        price: 0,`],
      /* Chicken's config module is one long comma expression, so the new keys
       * join it the same way and the last one carries no separator. */
      ["config: added the bundle's MAX_* / DAY_INTERVAL keys",
        "        e.exports.mapPingTime = 2200",
        "        e.exports.mapPingTime = 2200," +
          newConfigKeys("e.exports", ",", " ".repeat(8)).replace(/,$/, "")],
    ],
  },
];

/* Four of the mods descend from the same Emre build and carry the same
 * send-path additions: a two-window rate limiter kept in the userscript scope,
 * plus a chat filter and a clan-name pad. Both filter branches were keyed on
 * opcodes the game renamed — "ch" is now "6" and "8" is now "L", which the
 * mods already send — so neither had been running. Lifted out verbatim and
 * retargeted. */
function liftEmreSendExtras(p) {
  /* The gate around the send differs per mod — cowgame checks the counters
   * flat, S Client wraps them in another paren, lrx makes the whole limiter
   * conditional on a menu toggle. Take whatever condition is there and invert
   * it into an early return rather than trying to match three spellings. */
  const gateAt = p.code.search(/if \([^\n]*secPacket < secMax/);
  if (gateAt === -1) throw new Error(`[${p.label}] no rate-limit gate found`);
  const condOpen = p.code.indexOf("(", gateAt);
  const condClose = matchParen(p.code, condOpen);
  if (condClose === -1) throw new Error(`[${p.label}] unterminated rate-limit condition`);
  const gateCond = p.code.slice(condOpen + 1, condClose).trim();

  const rateLimit = reindent(
    p.slice("send preamble", /if \(!firstSend\.min\) \{/, /if \([^\n]*secPacket < secMax/),
    24
  );
  const filters = reindent(
    p
      .slice("send filters", /if \(type == "ch"\) \{/, /(let|var) binary = msgpack\.encode\(/)
      .replace('if (type == "ch") {', 'if (type == "6") {')
      .replace('} else if (type == "8") {', '} else if (type == "L") {'),
    24
  );

  if (!filters.includes('type == "6"') || !filters.includes('type == "L"')) {
    throw new Error(`[${p.label}] send filters did not retarget onto the live opcodes`);
  }

  p.applied.push('send: chat filter and clan pad retargeted from "ch"/"8" to "6"/"L"');

  const pad = " ".repeat(24);
  return `${pad}if (!this.connected) return;
${rateLimit}${pad}if (!(${gateCond})) return;
${filters}${pad}minPacket++;
${pad}secPacket++;
`;
}

/* Index of the paren closing the one at `open`. */
function matchParen(src, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/* Lifted code arrives at whatever indentation its source used; line it back up
 * so the rebuilt module stays readable. */
function reindent(text, column) {
  const lines = text.replace(/\s+$/, "").split("\n");
  const base = Math.min(
    ...lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length)
  );
  return lines
    .map((l) => (l.trim() ? " ".repeat(column) + l.slice(base) : ""))
    .join("\n") + "\n";
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

for (const mod of MODS) {
  const p = Patcher(mod.name, fs.readFileSync(path.join(ROOT, mod.src), "utf8"));

  const io = mod.prepare ? mod.prepare(p) : mod.io;
  rewriteHeader(p, mod.header);
  for (const note of mod.notes || []) p.applied.push(note);

  replaceIoClient(p, io);
  rewireSocketHook(p, mod.hook, mod.connectFn);
  for (const [name, find, replace] of mod.edits) p.edit(name, find, replace);
  wrapForDomReady(p, mod.name);

  fs.writeFileSync(path.join(ROOT, mod.out), p.code);
  console.log(mod.out);
  for (const line of p.applied) console.log("  - " + line);
  console.log("");
}
