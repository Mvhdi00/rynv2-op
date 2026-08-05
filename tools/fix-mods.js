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

/* These three vary across the family only by indentation, by the --largeserver
 * branch's constant, and by whether the bundle was minified — the minified ones
 * write `e.exports` where the beautified ones write `module.exports`. Written
 * once as patterns rather than seven times as literals. */
const MAX_PLAYERS_FIX = [
  `config: maxPlayers -> ${DRIVERS.config.maxPlayers}`,
  /(\w+\.exports\.maxPlayers = [^;\n]*\?[^:\n]*: )\d+;/,
  `$1${DRIVERS.config.maxPlayers};`,
];

/* The 11th colour is not in the game's table. Picking it sends a skin index
 * the server has no entry for, and every other client renders it as
 * undefined. */
const SKIN_COLORS_FIX = [
  "config: skinColors trimmed to the game's 10",
  /(\w+\.exports\.skinColors = )\[[^\]]*\](;?)/,
  `$1${skinColorsLiteral}$2`,
];

const NEW_KEYS_FIX = [
  "config: added the bundle's MAX_* / DAY_INTERVAL keys",
  /( *)(\w+)\.exports\.mapPingTime = 2200;/,
  (m, indent, target) => m + "\n" + newConfigKeys(target + ".exports", ";", indent),
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
    code = parts[0] + (typeof replace === "function" ? replace(find) : replace) + parts[1];
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
    /* ---------------------------------------------------------------- */
    name: "Lolfly v4",
    src: "src/mods/Lolfly_v4.js",
    out: "Lolfly_v4_Fixed.user.js",
    connectFn: "connectSocket",
    header: `// ==UserScript==
// @name         Lolfly v4 (fixed)
// @author       ryan8402
// @description  Solo diviértete
// @version      001
// @match        *://moomoo.io/*
// @match        *://*.moomoo.io/*
// @icon         https://pa1.narvii.com/6564/396626249978b4faee638d4b3b05549fe1443b3f_hq.gif
// @require      https://code.jquery.com/jquery-3.3.1.min.js
// @run-at       document-start
// @grant        none
// ==/UserScript==`,
    notes: [
      "header: dropped both msgpack @requires (rawgit is gone; bundle carries msgpack-lite)",
      "header: jQuery @require switched from http to https (mixed content is blocked on the game page)",
      "header: dropped the unused jquery-ui and jquery-confirm @requires",
    ],
    hook: `window.OriginalWebSocket = window.WebSocket;
            window.WebSocket = class {
                constructor(wsAddress) {
                    connectSocket(wsAddress);
                };
            }`,
    prepare: (p) => ({ msgpackExpr: NAMED_MSGPACK, extras: liftEmreSendExtras(p) }),
    edits: [MAX_PLAYERS_FIX, SKIN_COLORS_FIX, NEW_KEYS_FIX],
  },

  {
    /* ---------------------------------------------------------------- */
    name: "Lrx 2023",
    src: "src/mods/Lrx_2023.js",
    out: "Lrx_2023_Fixed.user.js",
    connectFn: "connectSocket",
    header: `// ==UserScript==
// @name         Lrx (fixed)
// @author       Emre & BlockKidd
// @description  like eat humans
// @version      1.1
// @match        *://moomoo.io/*
// @match        *://*.moomoo.io/*
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
    edits: [MAX_PLAYERS_FIX, SKIN_COLORS_FIX, NEW_KEYS_FIX],
  },

  {
    /* ----------------------------------------------------------------
     * A re-wrapped Lolfly, distinct from src/mods/Lolfly_v4.js: same base,
     * different packaging, mangled identifiers, and two WebSocket.prototype.send
     * proxies bolted on top of the bundle.
     * ---------------------------------------------------------------- */
    name: "Lolfly v4 (MihailSurviv build)",
    src: "src/mods/Lolfly_v4_MS.js",
    out: "Lolfly_v4_MS_Fixed.user.js",
    connectFn: "f581",
    header: `// ==UserScript==
// @name         Lolfly v4 — MihailSurviv build (fixed)
// @author       ryan8402, MihailSurviv.
// @description  checked for a logger, but it doesn't exist
// @version      001
// @match        *://moomoo.io/*
// @match        *://*.moomoo.io/*
// @icon         https://pa1.narvii.com/6564/396626249978b4faee638d4b3b05549fe1443b3f_hq.gif
// @require      https://code.jquery.com/jquery-3.3.1.min.js
// @run-at       document-start
// @grant        none
// ==/UserScript==`,
    notes: [
      "header: dropped both msgpack @requires (bundle carries msgpack-lite)",
      "header: jQuery @require switched from http to https (mixed content is blocked on the game page)",
      "header: dropped the unused jquery-ui and jquery-confirm @requires",
    ],
    hook: `window.OriginalWebSocket = window.WebSocket;
    window.WebSocket = class {
      constructor(p1618) {
        f581(p1618);
      }
    };`,
    io: {
      msgpackExpr: NAMED_MSGPACK,
      /* Counters for the anti-kick lifted out of the proxy below. */
      preamble: `                var antiKickWindow = Date.now();
                var antiKickCount = 0;`,
      /* Peadox anti-kick, moved here from the WebSocket.prototype.send proxy it
       * used to live in. That proxy msgpack-decoded every outbound frame, which
       * a signed frame is not — it would have shredded the transport. Here the
       * packet name is already in hand and nothing has been encoded yet. */
      extras: `                        if (Date.now() - antiKickWindow > 500) {
                            antiKickCount = 0;
                            antiKickWindow = Date.now();
                        }
                        if (antiKickCount > 45 && type !== "0") return;
                        if (type !== "0") antiKickCount++;`,
    },
    edits: [
      /* Two proxies wrapped WebSocket.prototype.send, both of them decoding
       * every outbound frame as bare msgpack. Under the keyed transport a frame
       * is 6 HMAC bytes followed by the payload, so neither could decode it and
       * both would have corrupted whatever they re-encoded. The rename table was
       * a guess at the current opcodes in the first place; the io-client now
       * carries the real one, negotiated per connection. */
      ["entry: removed the FreeUnpatcher send proxy (guessed opcodes, shreds signed frames)",
        `const FreeUnpatcherForYourNewMods = {
    "f": "9",
    "a": "9",
    "d": "F",
    "G": "z"
}
let originalSend = WebSocket.prototype.send;
WebSocket.prototype.send = new Proxy(originalSend, {
    apply: ((target, websocket, argsList) => {
        let decoded = msgpack.decode(new Uint8Array(argsList[0]));
        if (FreeUnpatcherForYourNewMods.hasOwnProperty(decoded[0])) {
            decoded[0] = FreeUnpatcherForYourNewMods[decoded[0]];
        };
        return target.apply(websocket, [msgpack.encode(decoded)]);
    }),
});`,
        `/* removed: the "FreeUnpatcher" send proxy. It renamed four opcodes by
   guesswork and msgpack-decoded every outbound frame; the current transport
   negotiates its opcode table per connection and signs each frame, so the
   proxy could neither read nor safely rewrite one. */`],
      ["entry: removed the Peadox anti-kick send proxy (moved into the io-client)",
        `window.WebSocket.prototype.send = new Proxy(window.WebSocket.prototype.send, {
  apply: function () {
    let v371 = msgpack.decode(new Uint8Array(arguments[2][0]));
    console.log(+new Date() - v370, vA12.length, v371);
    if (+new Date() - v370 > 500) {
      vA12 = [];
      v370 = +new Date();
    }
    if (vA12.length > 45 && v371[0] != "0") {
      return console.log("[Peadox]: Anti kick Stopped client from sending request");
    }
    if (v371[0] != "0") {
      vA12.push(v371);
    }
    return Reflect.apply(...arguments);
  }
});`,
        `/* removed: the Peadox anti-kick send proxy — same problem, it decoded every
   outbound frame as bare msgpack. The rate limit it enforced now lives in the
   io-client's send path, where the packet name is available before the frame
   is built and signed. */`],
      MAX_PLAYERS_FIX,
      SKIN_COLORS_FIX,
      NEW_KEYS_FIX,
    ],
  },

  {
    /* ----------------------------------------------------------------
     * Already carries a correct keyed transport and its own document-start
     * WebSocket capture with an address queue — verified against the game
     * before anything was changed, and every transport check passes on the
     * file as shipped. Only its tables had drifted, so that is all that is
     * touched here.
     *
     * maxPlayers is left at Infinity and deathFadeout at 0: the first only
     * feeds the server-browser "x / y" readout, the second only the death
     * fade. Both look like deliberate choices rather than drift, and neither
     * crosses the wire.
     * ---------------------------------------------------------------- */
    name: "operator rageok.",
    src: "src/mods/Operator_Rageok_v1.4.js",
    out: "Operator_Rageok_v1.4_Fixed.user.js",
    steps: { transport: false, hook: false, wrap: false },
    header: null,
    edits: [SKIN_COLORS_FIX, NEW_KEYS_FIX],
  },

  {
    /* ----------------------------------------------------------------
     * x18k is not a webpack fork like the rest — it is a fork of a much newer,
     * flat bundle, so there is no io-client module to swap. Its `T` object is
     * the io-client, inlined, and its send path carries a lot of the mod's own
     * per-opcode logic that has to survive intact. So this one is patched
     * surgically at four sites instead of having a module replaced.
     *
     * Its connect flow is already current: it builds `wss://<host>` and appends
     * ?token=, matching the shipped bundle, and it handles the `alt:` token. It
     * simply never learned the keyed transport.
     * ---------------------------------------------------------------- */
    name: "x18k v7.4.0",
    src: "src/mods/X18k_v7.4.0.js",
    out: "X18k_v7.4.0_Fixed.user.js",
    steps: { transport: false, hook: false, wrap: false },
    header: `// ==UserScript==
// @name         x18k (fixed)
// @namespace    http://tampermonkey.net/
// @version      7.4.1
// @description  best!
// @author       New priv _no share -
// @match        https://*.moomoo.io/*
// @grant        none
// @icon         http://moomoo.io/img/icons/crown.png
// @noframes
// ==/UserScript==`,
    edits: [
      /* The primitives go in immediately above the io-client object. */
      ["transport: keyed-opcode primitives spliced in above the io-client",
        "      sl = new ar,\n      ol = new Ir,\n      T = {",
        () => "      sl = new ar,\n      ol = new Ir;\n" +
              T.transportModule(DRIVERS.protocol, "__x18kTransport") +
              "      var T = {"],

      /* io-init carried only the socket id. It now also carries the seed, the
       * HMAC key and the mode; and the connect callback moves here from onopen,
       * because on open there is still no opcode table to encode the spawn
       * packet with. `n` is the callback, but the decoded array shadows it
       * inside onmessage, so it is aliased first. */
      ["entry: io-init negotiated, callback moved off onopen, numeric s2c decoded",
        `this.socket = new WebSocket(e), q3 = this.socket, this.socket.binaryType = "arraybuffer", this.socket.onmessage = function(e) {
                      var t = new Uint8Array(e.data);
                      const n = ol.decode(t),
                            i = n[0];
                      var t = n[1];
                      i == "io-init" ? o.socketId = t[0] : s[i].apply(void 0, t)
                  }, this.socket.onopen = function() {
                      o.connected = !0, n()
                  }`,
        `this.socket = new WebSocket(e), q3 = this.socket, this.socket.binaryType = "arraybuffer";
                  const __cb = n;
                  let __entered = !1;
                  this.socket.onmessage = function(e) {
                      var t = new Uint8Array(e.data);
                      const n = ol.decode(t);
                      let i = n[0];
                      var t = n[1];
                      if (i == "io-init") {
                          o.socketId = t[0];
                          __x18kTransportSession = t[3] === __x18kTransport.MODE_KEYED ? {
                              key: __x18kTransport.hexToBytes(t[2]),
                              tables: __x18kTransport.buildTables(t[1] >>> 0),
                              seq: 0
                          } : null;
                          if (!__entered) { __entered = !0; __cb(); }
                          return;
                      }
                      if (__x18kTransportSession && typeof i == "number") {
                          i = __x18kTransportSession.tables.s2c.dec[i];
                          if (i === undefined) return;
                      }
                      if (s[i]) s[i].apply(void 0, t)
                  }, this.socket.onopen = function() {
                      o.connected = !0
                  }`],

      /* The body was encoded at the top of send and sent at the bottom, with a
       * dozen early returns in between. Building it up front would burn a
       * sequence number on every packet the mod then decides to drop, so the
       * frame is now built where it is actually sent. */
      ["transport: frame built at the send site, not before the early returns",
        `const t = Array.prototype.slice.call(arguments, 1),
                    n = sl.encode([e, t]);`,
        `const t = Array.prototype.slice.call(arguments, 1);`],

      ["transport: outbound frames signed and given a sequence number",
        "              this.socket && this.socket.send(n)",
        `              if (!this.socket) return;
              let n;
              if (__x18kTransportSession) {
                  const __op = __x18kTransportSession.tables.c2s.enc[e];
                  /* A name the current server has no opcode for. Dropping it
                     here beats sending a frame it will treat as malformed. */
                  if (__op === undefined) return;
                  const __body = sl.encode([__op, t, ++__x18kTransportSession.seq]);
                  n = new Uint8Array(__x18kTransport.SIG_BYTES + __body.length);
                  n.set(__x18kTransport.signFrame(__x18kTransportSession.key, __body), 0);
                  n.set(__body, __x18kTransport.SIG_BYTES);
              } else {
                  n = sl.encode([e, t]);
              }
              this.socket.send(n)`],

      ["transport: session dropped on close",
        "              this.socket && this.socket.close(), this.socket = null, this.connected = !1",
        "              this.socket && this.socket.close(), this.socket = null, this.connected = !1, __x18kTransportSession = null"],
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
  /* One mod already carries a correct transport and its own document-start
   * capture, so it opts out of those steps and takes only the table edits. */
  const steps = Object.assign({ transport: true, hook: true, wrap: true }, mod.steps);

  const io = steps.transport ? (mod.prepare ? mod.prepare(p) : mod.io) : null;
  if (mod.header) rewriteHeader(p, mod.header);
  for (const note of mod.notes || []) p.applied.push(note);

  if (steps.transport) replaceIoClient(p, io);
  if (steps.hook) rewireSocketHook(p, mod.hook, mod.connectFn);
  for (const [name, find, replace] of mod.edits) p.edit(name, find, replace);
  if (steps.wrap) wrapForDomReady(p, mod.name);

  fs.writeFileSync(path.join(ROOT, mod.out), p.code);
  console.log(mod.out);
  for (const line of p.applied) console.log("  - " + line);
  console.log("");
}
