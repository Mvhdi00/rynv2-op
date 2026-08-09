#!/usr/bin/env node
"use strict";

// src/RYN_Client_v5_OWNER.js + src/luna-placer.js -> RYN_Client_v5_LunaPlacer.user.js
//
// Swaps the Auraro placer that RYN v5 shipped with for Luna's autoplace /
// preplace / replace, ported onto RYN's managers in src/luna-placer.js.
//
// Every edit is anchored to an exact string or line in the base client, and a
// missing or unexpected anchor fails the build — dropping in a newer RYN
// surfaces as an error rather than a half-patched script.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BASE = path.join(ROOT, "src", "RYN_Client_v5_OWNER.js");
const PLACER = path.join(ROOT, "src", "luna-placer.js");
const OUT = path.join(ROOT, "RYN_Client_v5_LunaPlacer.user.js");

// 1-indexed inclusive line range of the Auraro placer in the base client:
// the comment header down to the last of its three module exports.
const BLOCK_START = 8811;
const BLOCK_END = 10421;

const ANCHORS = [
  [ BLOCK_START, "// ====" ],
  [ BLOCK_START + 1, "Auraro placer, ported whole" ],
  [ BLOCK_END, "const Replacer_default = Replacer;" ],
  [ BLOCK_END + 1, "class TrapAnimal" ]
];

function fail(message) {
  console.error("build-luna-placer: " + message);
  process.exit(1);
}

function replaceOnce(text, needle, replacement, what) {
  const first = text.indexOf(needle);
  if (first === -1) fail("anchor not found: " + what);
  if (text.indexOf(needle, first + needle.length) !== -1) fail("anchor is ambiguous: " + what);
  return text.slice(0, first) + replacement + text.slice(first + needle.length);
}

const lines = fs.readFileSync(BASE, "utf8").split("\n");
for (const [lineNo, needle] of ANCHORS) {
  const line = lines[lineNo - 1];
  if (line === undefined || !line.includes(needle)) {
    fail("line " + lineNo + " does not contain " + JSON.stringify(needle));
  }
}

const placer = fs.readFileSync(PLACER, "utf8").replace(/\n+$/, "").split("\n");
let text = [ ...lines.slice(0, BLOCK_START - 1), ...placer, ...lines.slice(BLOCK_END) ].join("\n");

// The Luna placer is one module: preplace and replace are the second and third
// send of the entry it already queued, not separate decisions. The two module
// slots the Auraro split needed go away with it.
text = replaceOnce(
  text,
  "        prePlacer: new PrePlacer_default(client2),\n        replacer: new Replacer_default(client2),\n",
  "",
  "staticModules prePlacer/replacer"
);
text = replaceOnce(
  text,
  " this.staticModules.replacer, this.staticModules.autoPlacer, this.staticModules.prePlacer,",
  " this.staticModules.autoPlacer,",
  "module order prePlacer/replacer"
);

const stale = text.match(/PrePlacer_default|Replacer_default|AuraPlacer|AURA_[A-Z_]+/g);
if (stale) fail("stale references to the old placer remain: " + [ ...new Set(stale) ].join(", "));

for (const needed of [ "class AutoPlacer", "lunaSpikeTickBusy", "Settings_default._prePlace", "Settings_default._replace" ]) {
  if (!text.includes(needed)) fail("expected " + JSON.stringify(needed) + " in the output");
}

fs.writeFileSync(OUT, text);
console.log("build-luna-placer: wrote " + path.relative(ROOT, OUT) + " (" + text.split("\n").length + " lines)");
