#!/usr/bin/env node
/*
 * check-ryn2-hooks.js
 *
 * Runs Ryn Type 2's own bundle rewriter (the Regexer class and formatCode2,
 * lifted out of the userscript) over a game bundle and lists every hook that
 * did not bind. Nothing is re-implemented: the patterns and the matching are
 * the script's own.
 *
 *   node tools/check-ryn2-hooks.js [userscript] [game bundle] [--out patched.js]
 *
 * Defaults: Ryn_Type_2.user.js against src/game_index-cfaab428.js.
 *
 * Expected misses on the s16nqv build, both harmless:
 *   gameInit      the 2024 altcha start path; the 2025 game never takes it
 *   buildingTint  the 2024 form of the structure tint; buildingTint2025 binds
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const outAt = args.indexOf("--out");
const outFile = outAt >= 0 ? args.splice(outAt, 2)[1] : null;
const script = args[0] || path.join(ROOT, "Ryn_Type_2.user.js");
const bundle = args[1] || path.join(ROOT, "src/game_index-cfaab428.js");

const lines = fs.readFileSync(script, "utf8").split("\n");
const start = lines.findIndex(l => /^  class Logger \{/.test(l));
const end = lines.findIndex(l => /^  const formatCode_default = formatCode2;/.test(l));
if (start < 0 || end < 0) throw new Error("could not find the bundle rewriter in " + script);

const misses = [];
const factory = new Function("misses", "const isProd=false;" + lines.slice(start, end).join("\n") +
  "\nLogger.staticError=m=>misses.push(m);Logger.staticLog=()=>{};Logger.staticWarn=()=>{};return formatCode2;");
const formatCode = factory(misses);
const patched = formatCode(fs.readFileSync(bundle, "utf8"));
if (outFile) fs.writeFileSync(outFile, patched);

const hooks = (lines.slice(start, end).join("\n").match(/Hook\.(?:replace|append|prepend|match)\(/g) || []).length;
console.log(`${path.relative(ROOT, script)} against ${path.relative(ROOT, bundle)}`);
console.log(`  ${hooks - misses.length}/${hooks} hook calls bound`);
for (const m of misses) console.log("  - " + m);
