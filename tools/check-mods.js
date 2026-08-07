#!/usr/bin/env node
/*
 * check-mods.js
 *
 * Audits third-party moomoo.io userscripts in mods/ against the shipped game
 * bundle (via drivers/game-drivers.json).
 *
 * These mods were all written against the old transport — plain msgpack
 * `[type, args]` frames with string type names. The game shipped in
 * src/game_index.js negotiates a per-connection opcode permutation and prefixes
 * every client frame with a truncated HMAC, so a mod that still speaks the old
 * protocol does not merely misbehave: it cannot send a single accepted packet,
 * and every one of its receive handlers is dead because the incoming type
 * arrives as a permuted number rather than a string.
 *
 * Three classes of breakage are reported:
 *
 *   loader     userscript metadata that stops the mod from running or from
 *              intercepting the socket at all
 *   transport  disagreement with the game's wire format
 *   drivers    data-table drift (hats/accessories/weapons) against the bundle
 *
 *   node tools/check-mods.js [path/to/mod.js ...]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const game = JSON.parse(
  fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8")
);

/* CDNs that no longer serve the file the mods @require. rawgit.com was shut
 * down in October 2019; the others are third-party hosts outside the game. */
const DEAD_REQUIRES = [
  [/rawgit\.com/i, "rawgit.com was shut down in 2019 — this @require resolves to nothing, so msgpack is undefined"],
  [/energyaproton2\.onrender\.com/i, "third-party host for the msgpack copy — unpinned code from outside the game"],
];

/* ---- literal extraction -------------------------------------------------
 * `anchor` names the table's *first* entry, so the opening bracket is only a
 * few characters back and can be found without a full backward parse. From
 * there the span is closed by forward bracket matching, tracking string state
 * so brackets inside descriptions do not close it early. */
function tableAt(src, anchor) {
  const hit = src.indexOf(anchor);
  if (hit === -1) return null;

  let start = -1;
  for (let i = hit; i >= 0 && hit - i < 200; i--) {
    if (src[i] === "[") { start = i; break; }
  }
  if (start === -1) return null;

  let d = 0, quote = null, end = -1;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "[") d++;
    else if (c === "]") { d--; if (d === 0) { end = i; break; } }
  }
  if (end === -1) return null;

  try {
    return vm.runInNewContext("(" + src.slice(start, end + 1) + ")", { Math });
  } catch {
    return null;
  }
}

function checkTable(label, mine, theirs, fields, out, notes) {
  if (!mine) { out.push(["drivers", `${label}: table not found in mod — cannot verify`]); return; }
  notes.push(`${label}: ${mine.length} entries compared against ${theirs.length} in the bundle`);

  const byId = new Map(theirs.map((e) => [e.id, e]));
  for (const entry of mine) {
    const ref = byId.get(entry.id);
    if (!ref) { out.push(["drivers", `${label}: mod carries id ${entry.id} ("${entry.name}") that the game does not`]); continue; }
    for (const [k, gk] of fields) {
      const a = entry[k];
      const b = ref[gk];
      if (a === undefined && b === undefined) continue;
      if (b === undefined && (a === false || a === 0 || a === "")) continue;
      if (a === undefined && (b === false || b === 0)) continue;
      if (a !== b) {
        out.push(["drivers", `${label}: id ${entry.id} ("${ref.name}") ${k}=${JSON.stringify(a)} but game has ${gk}=${JSON.stringify(b)}`]);
      }
    }
  }
  const have = new Set(mine.map((e) => e.id));
  for (const ref of theirs) {
    if (!have.has(ref.id)) out.push(["drivers", `${label}: id ${ref.id} ("${ref.name}") missing from mod`]);
  }
}

function audit(file) {
  const src = fs.readFileSync(file, "utf8");
  const out = [];
  const notes = [];
  const header = src.slice(0, src.indexOf("==/UserScript==") + 1 || 2000);

  /* ---- loader -------------------------------------------------------- */

  /* The game captures WebSocket.prototype.send into a private binding the
   * moment its bundle evaluates, and calls that captured reference directly
   * for every packet. It then locks window.WebSocket with defineProperty.
   * A userscript that patches the prototype after the bundle has loaded is
   * therefore bypassed completely — the patch has to be in place first, which
   * only @run-at document-start guarantees. */
  if (!/@run-at\s+document-start/.test(header)) {
    out.push(["loader", "no @run-at document-start — the game captures WebSocket.prototype.send at bundle load, so a later patch is never called"]);
  }

  for (const [re, why] of DEAD_REQUIRES) {
    const line = src.split("\n").find((l) => /@require/.test(l) && re.test(l));
    if (line) out.push(["loader", `dead @require: ${why}`]);
  }

  /* ---- transport ------------------------------------------------------ */
  const p = game.protocol;

  /* The shim carries the transport on the mod's behalf: it maps opcodes both
   * ways, numbers each frame and signs it, and reports plaintext mode upward
   * so everything above it keeps emitting the bare [type, args] frames it was
   * written for. When it is present the mod's own packet code is *expected* to
   * look like the old protocol, so what gets verified is the shim itself. */
  const shimmed = /__mooShim/.test(src);

  if (shimmed) {
    notes.push("transport supplied by moo-transport-shim.js");

    const carries = [
      [`c2s alphabet (${p.c2sAlphabet.length} opcodes)`, new RegExp(p.c2sAlphabet.map((c) => `"${c}"`).join(",\\s*"))],
      [`s2c alphabet (${p.s2cAlphabet.length} opcodes)`, new RegExp(p.s2cAlphabet.map((c) => `"${c}"`).join(",\\s*"))],
      [`table salt ${p.tableSalt}`, new RegExp("SALT\\s*=\\s*" + p.tableSalt + "\\b")],
      [`signature width ${p.signatureBytes}`, new RegExp("SIG_BYTES\\s*=\\s*" + p.signatureBytes + "\\b")],
      [`encrypted mode ${p.encryptedMode}`, new RegExp("ENCRYPTED_MODE\\s*=\\s*" + p.encryptedMode + "\\b")],
      ["c2s seed mix", /2654435761/],
      ["s2c seed mix", /2246822507/],
      ["sha256 round constants", /1116352408/],
    ];
    for (const [label, re] of carries) {
      if (!re.test(src)) out.push(["transport", `shim does not carry ${label}`]);
    }
  } else {
    /* io-init carries [socketId, seed, hexKey, mode]. A mod that reads only
     * [0] cannot build the opcode tables or sign a frame. */
    if (/io-init/.test(src)) {
      const usesSeed = /io-init[\s\S]{0,400}?\[1\]/.test(src);
      const usesKey = /io-init[\s\S]{0,400}?\[2\]/.test(src);
      if (!usesSeed || !usesKey) {
        out.push(["transport", "io-init handler ignores the seed and key — mod cannot derive the opcode tables or sign frames"]);
      }
    }

    if (!/2654435761/.test(src)) {
      out.push(["transport", `no opcode-table derivation — game permutes ${p.c2sAlphabet.length} c2s / ${p.s2cAlphabet.length} s2c opcodes per connection from the io-init seed`]);
    }

    if (!/2246822507/.test(src)) {
      out.push(["transport", "no s2c table derivation — incoming frames arrive as permuted numbers, so every string-keyed packet handler is dead"]);
    }

    if (!/1116352408/.test(src)) {
      out.push(["transport", `no sha256/HMAC implementation — game prefixes every c2s frame with ${p.signatureBytes} HMAC bytes; unsigned frames are rejected`]);
    }

    /* The old two-element encode is the tell: the game now sends
     * [opcode, args, seq]. */
    const twoElem = src.match(/msgpack\.encode\(\s*\[\s*\w+\s*,\s*\w+\s*\]\s*\)/g);
    if (twoElem) {
      out.push(["transport", `${twoElem.length} site(s) encode a 2-element [type, args] frame — the game's frame is [opcode, args, seq] behind a signature`]);
    }
  }

  /* ---- drivers -------------------------------------------------------- */
  checkTable("hats", tableAt(src, 'name: "Shame!"'), game.hats, [
    ["id", "id"], ["name", "name"], ["price", "price"], ["scale", "scale"], ["dontSell", "dontSell"],
  ], out, notes);

  checkTable("accessories", tableAt(src, 'name: "Snowball"'), game.accessories, [
    ["id", "id"], ["name", "name"], ["price", "price"], ["scale", "scale"], ["xOff", "xOff"], ["dontSell", "dontSell"],
  ], out, notes);

  return { out, notes };
}

const files = process.argv.length > 2
  ? process.argv.slice(2).map((f) => path.resolve(f))
  : fs.existsSync(path.join(ROOT, "mods"))
    ? fs.readdirSync(path.join(ROOT, "mods")).filter((f) => f.endsWith(".js")).map((f) => path.join(ROOT, "mods", f))
    : [];

if (!files.length) {
  console.error("no mods to check");
  process.exit(1);
}

console.log("game   :", game.source.index, "+", game.source.vendor);
console.log("");

let total = 0;
for (const file of files) {
  const { out: found, notes } = audit(file);
  total += found.length;
  console.log(path.relative(ROOT, file));
  for (const n of notes) console.log(`  note      ${n}`);
  if (!found.length) {
    console.log("  OK - speaks the shipped transport and matches the bundle's tables");
  } else {
    for (const [kind, msg] of found) console.log(`  ${kind.padEnd(9)} ${msg}`);
  }
  console.log("");
}

console.log(total ? `${total} finding(s).` : "all mods clean.");
process.exit(total ? 1 : 0);
