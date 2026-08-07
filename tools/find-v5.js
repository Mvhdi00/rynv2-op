#!/usr/bin/env node
/* Print context around a match in the decoded PLAYER build - the file is one
 * long line, so grep is not much use on it.
 *
 *   node tools/find-v5.js "<needle>" [before] [after]
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "v5-src/RYN_Client_v5_PLAYER.decoded.js");
const source = fs.readFileSync(file, "utf8");
const needle = process.argv[2];
const before = Number(process.argv[3] || 200);
const after = Number(process.argv[4] || 600);

let at = -1;
let count = 0;
while ((at = source.indexOf(needle, at + 1)) !== -1) {
  count++;
  console.log(`\n--- match ${count} @ ${at} ---`);
  console.log(source.slice(Math.max(0, at - before), at + after));
  if (count >= 6) break;
}
if (count === 0) console.log("no match");
