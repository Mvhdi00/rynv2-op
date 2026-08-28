#!/usr/bin/env node
// Static audit of the Preplace/Replace work against the frozen surfaces.
//
//   node tools/verify-placement.js
//
// Compares NovaStorm.user.js against the pristine src/novastorm_1.4.js and
// checks the invariants recorded in docs/: the Auto Place contract (AC),
// the Spike Tick contract (ST), integration (IN) and performance (PF).

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BASE = fs.readFileSync(path.join(ROOT, "src/novastorm_1.4.js"), "utf8");
const WORK = fs.readFileSync(path.join(ROOT, "NovaStorm.user.js"), "utf8");

// Call-site counting must ignore prose: these files carry comments that name
// the very functions being counted.
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const BASE_C = stripComments(BASE);
const WORK_C = stripComments(WORK);

let pass = 0, fail = 0;
function check(id, desc, ok, detail) {
  if (ok) { pass++; console.log(`  ok   ${id}  ${desc}`); }
  else { fail++; console.log(`  FAIL ${id}  ${desc}${detail ? "\n         " + detail : ""}`); }
}

// Extract a top-level `function NAME(` body by brace matching.
function fn(src, name) {
  const re = new RegExp("(^|\\n)(\\s*)function\\s+" + name + "\\s*\\(", "");
  const m = re.exec(src);
  if (!m) return null;
  const start = src.indexOf("function", m.index);
  let i = src.indexOf("{", start);
  if (i < 0) return null;
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  return null;
}

function identical(name) {
  const a = fn(BASE, name), b = fn(WORK, name);
  if (a === null && b === null) return { ok: false, why: "not found in either file" };
  if (a === null) return { ok: false, why: "not found in baseline" };
  if (b === null) return { ok: false, why: "removed from working copy" };
  return { ok: a === b, why: a === b ? "" : "body differs" };
}

function count(src, re) { return (src.match(re) || []).length; }

console.log("\nAuto Place contract (AC1) — frozen decision surface");
for (const name of ["updateAngles", "checkPredictObjects", "isAutoPlaceAngle",
                    "getPerfectAngles", "getClosestConfig"]) {
  const r = identical(name);
  check("AC1", `${name} byte-identical`, r.ok, r.why);
}

console.log("\nSpike Tick contract (ST1) — frozen predicates");
for (const name of ["canTrapTick", "canSmartTick", "canShamePlace", "canShamePlus",
                    "advancedShameCombat", "canAutoShame"]) {
  const r = identical(name);
  check("ST1", `${name} byte-identical`, r.ok, r.why);
}

console.log("\nShared helpers (PF7) — behaviour-preserving");
for (const name of ["place", "getConfig", "canPlace", "getPrePlaceAngles", "heal"]) {
  const r = identical(name);
  check("PF7", `${name} byte-identical`, r.ok, r.why);
}

console.log("\nST2 — Spike Tick predicates called only from their own ladder");
{
  // Strip the predicate definitions themselves, then count call sites.
  let stripped = WORK_C;
  for (const name of ["canTrapTick", "canSmartTick", "canShamePlace", "canShamePlus",
                      "advancedShameCombat", "canAutoShame"]) {
    const body = fn(WORK_C, name);
    if (body) stripped = stripped.replace(body, "");
  }
  for (const name of ["canTrapTick", "canShamePlace", "canSmartTick"]) {
    const n = count(stripped, new RegExp("[^a-zA-Z_.]" + name + "\\s*\\(", "g"));
    const b = (() => {
      let s = BASE_C;
      for (const nm of ["canTrapTick", "canSmartTick", "canShamePlace", "canShamePlus",
                        "advancedShameCombat", "canAutoShame"]) {
        const bd = fn(BASE_C, nm); if (bd) s = s.replace(bd, "");
      }
      return count(s, new RegExp("[^a-zA-Z_.]" + name + "\\s*\\(", "g"));
    })();
    check("ST2", `${name}: ${n} call site(s), baseline had ${b}`, n <= 1,
          n > 1 ? "must be called only from the instaKill ladder" : "");
  }
}

console.log("\nIN2 — addPredictObject is the only producer, legacy arity preserved");
{
  const sites = src => [...src.matchAll(/(?<!function\s)addPredictObject\(([\s\S]*?)\);/g)]
    .map(m => m[1]);
  const wc = sites(WORK_C), bc = sites(BASE_C);
  const legacy = wc.filter(c => !c.includes("owner:"));
  const meta = wc.filter(c => c.includes("owner:"));
  const allLegacyThreeArg = legacy.every(c => (c.match(/,/g) || []).length === 2);
  check("IN2", `${wc.length} call sites (baseline ${bc.length}): ` +
               `${legacy.length} legacy, ${meta.length} with meta`,
        allLegacyThreeArg,
        "every pre-existing call site must still pass exactly three arguments");
  check("IN1", "predictObjects.push occurs only inside addPredictObject",
        count(WORK_C, /predictObjects\.push\(/g) === 1);
}

console.log("\nIN3 — place() call sites");
{
  const n = count(WORK_C, /[^a-zA-Z_.]place\(/g) - count(WORK_C, /function place\(/g);
  const b = count(BASE_C, /[^a-zA-Z_.]place\(/g) - count(BASE_C, /function place\(/g);
  check("IN3", `${n} call site(s), baseline ${b}`, n <= b,
        "a new place() call site would be a second placement engine");
}

console.log("\nIN4 — no new timers in the placement path");
{
  const n = count(WORK_C, /setTimeout\(/g), b = count(BASE_C, /setTimeout\(/g);
  check("IN4", `setTimeout count ${n} vs baseline ${b}`, n <= b);
  check("IN4", "no setInterval added",
        count(WORK_C, /setInterval\(/g) <= count(BASE_C, /setInterval\(/g));
  check("IN4", "still no clearTimeout in the placer",
        count(WORK_C, /clearTimeout\(/g) === count(BASE_C, /clearTimeout\(/g));
}

console.log("\nIN5 — one packet budget");
check("IN5", "no second packet counter declared",
      count(WORK_C, /let\s+packets\s*=/g) === 1 && count(WORK_C, /packets\+\+/g) === 1);

console.log("\nPF3 — no sweep from inside a per-candidate filter");
{
  const bad = /\.filter\([^)]*getPrePlaceAngles/.test(WORK_C);
  check("PF3", "getPrePlaceAngles not called from a filter callback", !bad);
  const inPre = fn(WORK_C, "isPrePlaceAngle");
  check("PF3", "old per-angle predicate cascade is gone",
        inPre === null, inPre === null ? "" : "isPrePlaceAngle still present");
}

console.log("\nDeletions (step 8) — reported, not enforced yet");
for (const [sym, re] of [["placeTick", /placeTick/g], ["setPlaceTick", /setPlaceTick/g],
                         ["updateAngles2", /updateAngles2/g],
                         ["settings.spampreplace", /spampreplace/g],
                         ["spamPrePlacer", /spamPrePlacer/g],
                         ["getPrePlaceObject", /getPrePlaceObject/g]]) {
  const n = count(WORK_C, re), b = count(BASE_C, re);
  console.log(`  info      ${sym}: ${n} reference(s), baseline ${b}`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
