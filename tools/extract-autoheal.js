#!/usr/bin/env node
/*
 * extract-autoheal.js — pull the Auto Heal Engine out of the userscript so it
 * can be loaded on its own.
 *
 * The engine is written as one dependency-injected factory,
 * `createRynAutoHealEngine(deps)`, precisely so it can be reasoned about
 * without a browser or a game socket. This slices that factory out of
 * Ryn Type 2.user.js and returns it as a callable function.
 *
 * Nothing is rewritten on the way through. If the slice does not parse, or the
 * markers move, that is a failure and not something to paper over: the tests
 * are only worth anything if they run the shipped code.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DEFAULT_SCRIPT = path.join(__dirname, "..", "Ryn Type 2.user.js");
const START = "function createRynAutoHealEngine(deps) {";
const END = "\n  const AutoHealEngine_default = createRynAutoHealEngine(";

function slice(scriptPath) {
  const src = fs.readFileSync(scriptPath, "utf8");
  const start = src.indexOf(START);
  if (start === -1) {
    throw new Error(`createRynAutoHealEngine not found in ${scriptPath}`);
  }
  const end = src.indexOf(END, start);
  if (end === -1) {
    throw new Error(`engine end marker not found in ${scriptPath}`);
  }
  return src.slice(start, end);
}

/* Returns createRynAutoHealEngine, compiled in its own context. */
function load(scriptPath = DEFAULT_SCRIPT) {
  const body = slice(scriptPath);
  const wrapper = `${body}\n;createRynAutoHealEngine;`;
  const context = vm.createContext({ console, Date, Math, Set, Map, isFinite });
  return vm.runInContext(wrapper, context, { filename: "ryn-autoheal-engine.js" });
}

module.exports = { load, slice, DEFAULT_SCRIPT };

if (require.main === module) {
  const target = process.argv[2] || DEFAULT_SCRIPT;
  const body = slice(target);
  const out = process.argv[3];
  if (out) {
    fs.writeFileSync(out, body);
    console.log(`wrote ${body.split("\n").length} lines to ${out}`);
  } else {
    process.stdout.write(body);
  }
}
