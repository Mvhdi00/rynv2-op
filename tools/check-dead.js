#!/usr/bin/env node
/*
 * check-dead.js
 *
 * check-scopes.js answers "is every name that is READ declared?". This answers
 * the other half: "is every name that is DECLARED ever used?" — and the two
 * shapes of rot that a large edited userscript actually grows.
 *
 *   DEAD        a function or binding declared and never referenced again. The
 *               clients this code borrows from are full of these: NOVASTORM
 *               calls batchPlaceTrap in six places and never defines it, AI
 *               Client's AutoReplace is never called, starrclient's better
 *               preplacer is shadowed by a second assignment to the same name.
 *   SHADOWED    two declarations of one name in one scope. The second wins
 *               silently, so the first is dead and reads as live.
 *
 * A vendored game bundle legitimately declares plenty it does not itself use,
 * so a raw count is noise. Pass a baseline with --base and only the DELTA is
 * reported: what this file has that the untouched one did not.
 *
 *   node tools/check-dead.js [client.js] [--base pristine.js]
 */

const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE_PATH = baseIdx !== -1 ? args[baseIdx + 1] : null;
if (baseIdx !== -1) args.splice(baseIdx, 2);

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = args[0] ? path.resolve(args[0]) : path.join(ROOT, "YoRHa_System.user.js");

// ---------------------------------------------------------------------------
function analyse(file) {
  const src = fs.readFileSync(file, "utf8");
  const ast = acorn.parse(src, {
    ecmaVersion: "latest", sourceType: "script",
    allowReturnOutsideFunction: true, locations: true,
  });

  // Declarations: name -> [{line, kind}]. References: name -> count.
  const declared = new Map();
  const referenced = new Map();
  const shadowed = [];

  // Scope only matters for the shadow test; for "is it ever used" a file-wide
  // reference count is the right question and cannot produce a false DEAD.
  const scopes = [];

  function declare(name, line, kind, scopeId) {
    if (!declared.has(name)) declared.set(name, []);
    declared.get(name).push({ line, kind, scopeId });
  }

  function reference(name) {
    referenced.set(name, (referenced.get(name) || 0) + 1);
  }

  let scopeCounter = 0;

  function walk(node, scopeId, parent) {
    if (!node || typeof node.type !== "string") return;

    switch (node.type) {
      case "FunctionDeclaration": {
        if (node.id) declare(node.id.name, node.loc.start.line, "function", scopeId);
        const inner = ++scopeCounter;
        for (const p of node.params) declarePattern(p, inner, "param");
        // The body block belongs to the function, so its statements are walked
        // directly rather than through the BlockStatement case — otherwise a
        // `var` in the body would land one scope below the params.
        if (node.body.type === "BlockStatement") {
          for (const st of node.body.body) walk(st, inner, node);
        } else walk(node.body, inner, node);
        return;
      }
      case "FunctionExpression":
      case "ArrowFunctionExpression": {
        const inner = ++scopeCounter;
        for (const p of node.params) declarePattern(p, inner, "param");
        if (node.body.type === "BlockStatement") {
          for (const st of node.body.body) walk(st, inner, node);
        } else walk(node.body, inner, node);
        return;
      }
      case "VariableDeclaration": {
        for (const d of node.declarations) {
          declarePattern(d.id, scopeId, node.kind);
          if (d.init) walk(d.init, scopeId, node);
        }
        return;
      }
      case "ClassDeclaration": {
        if (node.id) declare(node.id.name, node.loc.start.line, "class", scopeId);
        if (node.superClass) walk(node.superClass, scopeId, node);
        walk(node.body, ++scopeCounter, node);
        return;
      }
      // let/const are block-scoped, so two sibling blocks each declaring
      // `candidate` are not shadowing anything — they are two different
      // bindings. A first cut of this only opened scopes for functions, which
      // reported every ordinary pair of loops in the file as a shadow.
      case "BlockStatement": {
        const inner = ++scopeCounter;
        for (const st of node.body) walk(st, inner, node);
        return;
      }
      case "ForStatement":
      case "ForInStatement":
      case "ForOfStatement": {
        const inner = ++scopeCounter;
        if (node.init) walk(node.init, inner, node);
        if (node.left) walk(node.left, inner, node);
        if (node.right) walk(node.right, inner, node);
        if (node.test) walk(node.test, inner, node);
        if (node.update) walk(node.update, inner, node);
        walk(node.body, inner, node);
        return;
      }
      case "CatchClause": {
        const inner = ++scopeCounter;
        if (node.param) declarePattern(node.param, inner, "param");
        walk(node.body, inner, node);
        return;
      }
      case "MemberExpression":
        walk(node.object, scopeId, node);
        if (node.computed) walk(node.property, scopeId, node);
        return;
      case "Property":
        if (node.computed) walk(node.key, scopeId, node);
        walk(node.value, scopeId, node);
        return;
      case "MethodDefinition":
      case "PropertyDefinition":
        if (node.computed) walk(node.key, scopeId, node);
        if (node.value) walk(node.value, scopeId, node);
        return;
      case "LabeledStatement":
        walk(node.body, scopeId, node);
        return;
      case "BreakStatement":
      case "ContinueStatement":
        return;
      case "Identifier":
        reference(node.name);
        return;
    }

    for (const key of Object.keys(node)) {
      if (key === "type" || key === "loc" || key === "start" || key === "end") continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(c => walk(c, scopeId, node));
      else if (child && typeof child.type === "string") walk(child, scopeId, node);
    }
  }

  function declarePattern(node, scopeId, kind) {
    if (!node) return;
    switch (node.type) {
      case "Identifier": declare(node.name, node.loc.start.line, kind, scopeId); break;
      case "ObjectPattern":
        for (const p of node.properties) {
          if (p.type === "RestElement") declarePattern(p.argument, scopeId, kind);
          else declarePattern(p.value, scopeId, kind);
        }
        break;
      case "ArrayPattern":
        for (const el of node.elements) declarePattern(el, scopeId, kind);
        break;
      case "AssignmentPattern":
        declarePattern(node.left, scopeId, kind);
        walk(node.right, scopeId, node);
        break;
      case "RestElement": declarePattern(node.argument, scopeId, kind); break;
    }
  }

  for (const s of ast.body) walk(s, 0, null);

  // A declaration site does not count itself as a reference — the walk declares
  // and returns without descending into the binding identifier — so a name with
  // zero references is one nothing ever reads. Comparing the reference count
  // against the declaration count instead, as a first cut of this did, marks
  // every function called exactly once as dead.
  const dead = [];
  for (const [name, sites] of declared) {
    const refs = referenced.get(name) || 0;
    if (refs > 0) continue;

    // Params and catch bindings going unused is ordinary style, not rot.
    const real = sites.filter(s => s.kind !== "param");
    if (!real.length) continue;

    dead.push({ name, line: real[0].line, kind: real[0].kind });
  }

  // Two declarations of one name inside one scope: the later silently wins.
  for (const [name, sites] of declared) {
    const byScope = new Map();
    for (const s of sites) {
      if (s.kind === "param") continue;
      if (!byScope.has(s.scopeId)) byScope.set(s.scopeId, []);
      byScope.get(s.scopeId).push(s);
    }
    for (const [, group] of byScope) {
      if (group.length > 1) {
        shadowed.push({ name, lines: group.map(g => g.line) });
      }
    }
  }

  return { dead, shadowed, declaredCount: declared.size };
}

// ---------------------------------------------------------------------------
const mine = analyse(CLIENT_PATH);
const base = BASE_PATH && fs.existsSync(BASE_PATH) ? analyse(BASE_PATH) : null;

console.log(`${path.basename(CLIENT_PATH)}: ${mine.declaredCount} distinct names declared`);
console.log(`  unreferenced: ${mine.dead.length}   shadowed: ${mine.shadowed.length}`);

let failed = false;

if (base) {
  console.log(`\nbaseline ${path.basename(BASE_PATH)}: ` +
              `unreferenced ${base.dead.length}, shadowed ${base.shadowed.length}`);

  const baseDead = new Set(base.dead.map(d => d.name));
  const baseShadow = new Set(base.shadowed.map(s => s.name));

  const newDead = mine.dead.filter(d => !baseDead.has(d.name));
  const newShadow = mine.shadowed.filter(s => !baseShadow.has(s.name));

  console.log(`\nDELTA — introduced by the edits:`);
  if (!newDead.length && !newShadow.length) {
    console.log("  ✓ nothing. No name declared by these edits goes unused, and");
    console.log("    nothing they added shadows anything.");
  } else {
    failed = true;
    for (const d of newDead) console.log(`  ✗ DEAD      ${d.kind} ${d.name}  (line ${d.line})`);
    for (const s of newShadow) console.log(`  ✗ SHADOWED  ${s.name}  (lines ${s.lines.join(", ")})`);
  }

  // Anything the baseline had that this no longer does is a cleanup, worth
  // saying out loud rather than leaving implicit.
  const mineDead = new Set(mine.dead.map(d => d.name));
  const cleaned = base.dead.filter(d => !mineDead.has(d.name));
  if (cleaned.length && cleaned.length <= 12) {
    console.log(`\n  cleaned up (dead in the base, gone here): ${cleaned.map(c => c.name).join(", ")}`);
  }
} else {
  if (mine.shadowed.length) {
    console.log("\nshadowed declarations:");
    for (const s of mine.shadowed) console.log(`  ${s.name}  lines ${s.lines.join(", ")}`);
  }
  if (mine.dead.length) {
    console.log(`\nunreferenced declarations (${mine.dead.length}):`);
    for (const d of mine.dead) console.log(`  ${d.kind} ${d.name}  line ${d.line}`);
  }
}

process.exit(failed ? 1 : 0);
