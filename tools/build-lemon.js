#!/usr/bin/env node
/*
 * build-lemon.js
 *
 * Builds LemonMod_Fixed.user.js from LemonMod v3.0.
 *
 * LemonMod v3.0 was written against the old moomoo.io transport - plain msgpack
 * `[type, args]` frames with string opcodes - and against a bundle that did not
 * cache `WebSocket.prototype.send`. Neither holds for the game in src/. The
 * three things that stop it working are all load-order and transport, not game
 * data - the hats, accessories and upgrade slots it names by id all still
 * exist in the bundle, and tools/verify-lemon.js keeps checking that.
 *
 *   1. the script runs at document-idle, so the bundle has already cached
 *      `WebSocket.prototype.send`. LemonMod's hook never sees the game's own
 *      traffic, so it never captures the socket, so it never attaches its
 *      message listener - the mod is inert from the first frame onwards;
 *   2. every opcode on the wire is now a per-connection permuted number, and
 *      every client frame carries a 6-byte truncated HMAC and a sequence
 *      counter. LemonMod's frames are rejected and its handlers never match;
 *   3. its extra socket for bots builds `url + "&token="`, which was right when
 *      the server URL already had a query string and is wrong now.
 *
 * So the build moves the script to document-start, injects the protocol bridge
 * (tools/lemon-bridge.js) ahead of everything, and gates the mod body on the
 * DOM being ready - which is what document-idle used to guarantee it.
 *
 *   node tools/build-lemon.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/LemonMod_v3.0.js");
const BRIDGE = path.join(ROOT, "tools/lemon-bridge.js");
const VISUALS = path.join(ROOT, "tools/lemon-visuals.js");
const OUT = path.join(ROOT, "LemonMod_Fixed.user.js");

let code = fs.readFileSync(BASE, "utf8");
const bridge = fs.readFileSync(BRIDGE, "utf8");
const visuals = fs.readFileSync(VISUALS, "utf8");
const applied = [];

/* Every edit goes through here so a stale anchor fails the build loudly
 * instead of silently producing a half-patched script. */
function edit(label, find, replace) {
  const parts = body.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  body = parts[0] + replace + parts[1];
  applied.push(label);
}

/* ------------------------------------------------------------------ *
 * 1. Split the userscript header off the body
 * ------------------------------------------------------------------ */

const HEADER_END = "// ==/UserScript==";
const headerEnd = code.indexOf(HEADER_END);
if (headerEnd === -1) throw new Error("could not find the end of the userscript header");

let header = code.slice(0, headerEnd + HEADER_END.length);
let body = code.slice(headerEnd + HEADER_END.length);

/* ------------------------------------------------------------------ *
 * 2. Header
 *
 * `@run-at document-start` is the whole reason this build exists: the hooks
 * have to be in place before the bundle's module script runs.
 * ------------------------------------------------------------------ */

const EOL = header.indexOf("\r\n") === -1 ? "\n" : "\r\n";

{
  if (/@run-at/.test(header)) throw new Error("base script already sets @run-at");

  const headerEdit = (label, find, replace) => {
    const parts = header.split(find);
    if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
    if (parts.length > 2) throw new Error(`anchor is ambiguous: ${label}`);
    header = parts[0] + replace + parts[1];
  };

  headerEdit(
    "header @name",
    "// @name         ! LemonMod v3.0 !",
    "// @name         ! LemonMod v3.0 (protocol fix) !"
  );
  headerEdit("header @version", "// @version      v3.0", "// @version      v3.0-fix1");
  headerEdit(
    "header @match",
    "// @match        *://*.moomoo.io/*",
    "// @match        *://*.moomoo.io/*" + EOL +
      "// @run-at       document-start" + EOL +
      "// @grant        none"
  );
  applied.push("header: @run-at document-start, @grant none, version v3.0-fix1");
}

/* ------------------------------------------------------------------ *
 * 3. Bot socket URL
 *
 * The old server URL carried `?gameIndex=N`, so a bot socket could be built by
 * cutting at the first `&` and appending `&token=`. The current URL is
 * `wss://<host>?token=<turnstile>`, where that produces two `token` params on
 * a URL that still has the first one. Cut at the query instead.
 * ------------------------------------------------------------------ */

edit(
  "bots: build the extra socket URL with ?token= instead of &token=",
  `_0x83059['\\x75\\x72' + '\\x6c']['\\x73\\x70' + '\\x6c\\x69' + '\\x74']('\\x26')[0x16b1 + 0x287 * 0xe + 0x3a13 * -0x1] + ('\\x26\\x74' + '\\x6f\\x6b' + '\\x65\\x6e' + '\\x3d')`,
  `_0x83059['\\x75\\x72' + '\\x6c']['\\x73\\x70' + '\\x6c\\x69' + '\\x74']('\\x3f')[0x16b1 + 0x287 * 0xe + 0x3a13 * -0x1] + ('\\x3f\\x74' + '\\x6f\\x6b' + '\\x65\\x6e' + '\\x3d')`
);

/* ------------------------------------------------------------------ *
 * 4. Bot sockets: route their messages through the bridge
 *
 * The mod's extra sockets read the wire through `onmessage`, which is also how
 * the bundle reads its own - so the property cannot be wrapped wholesale
 * without rewriting what the game sees. Point this one assignment at the
 * bridge's own setter instead, and only these sockets get translated.
 * ------------------------------------------------------------------ */

edit(
  "bots: take incoming frames through the bridge",
  `['\\x6f\\x6e' + '\\x6d\\x65' + '\\x73\\x73' + '\\x61\\x67' + '\\x65'] = _0x100d06 =>`,
  `['__lemonBotMessage'] = _0x100d06 =>`
);

/* ------------------------------------------------------------------ *
 * 5. Do not let the name field swallow the spawn
 *
 * LemonMod's send hook drops every frame while the focus is on one of the
 * inputs it lists, `nameInput` among them. That was harmless on the old
 * bundle. The current one added
 *
 *   nt.onkeypress = i => { if (i.key === "Enter") return i.preventDefault(),
 *                          we.onclick(i), !1 }
 *
 * so starting the game with Enter now sends the spawn while the name field
 * still has focus - and the mod drops it. The menu never goes away, the world
 * behind it is already loaded, and you sit there. The gate stays for every
 * other input; the name field is exempted from it.
 * ------------------------------------------------------------------ */

{
  const gate = `if (!LEMONMOD_0x35bf68['\\x69\\x6e' + '\\x63\\x6c' + '\\x75\\x64' + '\\x65\\x73'](document['\\x61\\x63' + '\\x74\\x69' + '\\x76\\x65' + '\\x45\\x6c' + '\\x65\\x6d' + '\\x65\\x6e' + '\\x74']['\\x69\\x64']['\\x74\\x6f' + '\\x4c\\x6f' + '\\x77\\x65' + '\\x72\\x43' + '\\x61\\x73' + '\\x65']()))`;
  edit(
    "spawn: the name field no longer blocks outgoing frames",
    gate + " {",
    gate.slice(0, -1) + ` || document.activeElement.id.toLowerCase() === "nameinput") {`
  );
}

/* ------------------------------------------------------------------ *
 * 6. The mod's own hooks
 *
 * The bridge is written around three things LemonMod does. If a future
 * LemonMod stops doing any of them the bridge would sit there translating for
 * nobody, so the build refuses to produce that quietly.
 * ------------------------------------------------------------------ */

const expects = [
  ["the mod hooks WebSocket.prototype.send",
    `WebSocket['\\x70\\x72' + '\\x6f\\x74' + '\\x6f\\x74' + '\\x79\\x70' + '\\x65']['\\x73\\x65' + '\\x6e\\x64'] = function`],
  ["the mod keeps the previous send as oldSend",
    `WebSocket['\\x70\\x72' + '\\x6f\\x74' + '\\x6f\\x74' + '\\x79\\x70' + '\\x65']['\\x6f\\x6c' + '\\x64\\x53' + '\\x65\\x6e' + '\\x64'] = WebSocket`],
  ["the mod reads the wire through addEventListener('message')",
    `['\\x61\\x64' + '\\x64\\x45' + '\\x76\\x65' + '\\x6e\\x74' + '\\x4c\\x69' + '\\x73\\x74' + '\\x65\\x6e' + '\\x65\\x72']('\\x6d\\x65' + '\\x73\\x73' + '\\x61\\x67' + '\\x65'`]
];
for (const [label, anchor] of expects) {
  if (!body.includes(anchor)) throw new Error(`the mod no longer does what the bridge assumes: ${label}`);
  applied.push(`checked: ${label}`);
}

/* ------------------------------------------------------------------ *
 * 7. Assemble
 *
 * The body is wrapped so it still runs with a document behind it. Nothing in
 * LemonMod reaches its own top-level declarations through `window` - every
 * global it publishes it assigns explicitly, and it uses no inline HTML event
 * handlers - so moving them into a function scope is invisible to it.
 * ------------------------------------------------------------------ */

const banner = `
/* -------------------------------------------------------------------------
 * LemonMod v3.0, rebuilt against the current moomoo.io bundle.
 *
 *   built by : tools/build-lemon.js   (from src/LemonMod_v3.0.js)
 *   bridge   : tools/lemon-bridge.js
 *   verified : tools/verify-lemon.js against drivers/game-drivers.json
 *
 * The mod itself is unchanged apart from the bot socket URL. What is new is
 * the protocol bridge below and the document-start / DOM-ready split: the
 * bridge translates between LemonMod's old-protocol frames and the opcode
 * permutation plus truncated-HMAC transport the game uses now.
 *
 * After the bridge comes the visuals overlay, which rebuilds the three things
 * the separate "LemonMod - Visuals" script added - reload bars, the shame
 * counter, the insta marker. That script is a fork of the whole old bundle and
 * cannot be patched forward; these are ported onto the current game instead.
 * ------------------------------------------------------------------------- */
`;

const prelude = `
/* --- LemonMod body: gated on the DOM, which document-idle used to guarantee --- */
(function () {
  var __lemonBoot = function () {
`;

const postlude = `
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", __lemonBoot, { once: true });
  } else {
    __lemonBoot();
  }
})();
`;

code = header + "\n" + banner + "\n" + bridge + "\n" + visuals + "\n" + prelude + body + postlude;
applied.push("bridge: injected tools/lemon-bridge.js ahead of the mod");
applied.push("visuals: injected tools/lemon-visuals.js (reload bars, shame counter, insta marker)");
applied.push("boot: mod body deferred to DOMContentLoaded");

fs.writeFileSync(OUT, code);

console.log("built", path.relative(ROOT, OUT));
console.log(`  ${(code.length / 1024).toFixed(0)} KB, ${code.split("\n").length} lines\n`);
for (const step of applied) console.log("  + " + step);
