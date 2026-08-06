/*
 * Whole-file sweep for the kind of damage a feature removal leaves behind:
 * a name that is still read somewhere after the thing that defined it is gone.
 * Every one of these is fatal at runtime, and most of them fire inside the
 * render hook, where a throw stops the frame loop for good.
 */
const fs = require("fs");
const path = require("path");
const code = fs.readFileSync(path.join(__dirname, "..", "src", "RYN_Client_v4.js"), "utf8");
let bad = 0;
const report = (label, missing) => {
  if (missing.length) { bad++; console.log(`  FAIL ${label}: ${missing.join(", ")}`); }
  else console.log(`  ok   ${label}`);
};

/* The module registry: the object literal every module is hung off. */
const regAt = code.indexOf("this.staticModules = {");
const regBody = code.slice(regAt, code.indexOf("\n      };", regAt));
const registered = new Set([...regBody.matchAll(/^\s{8}([\w$]+):/gm)].map(m => m[1]));

/* 1. every staticModules.X read has a registered module */
{
  const used = new Set();
  for (const m of code.matchAll(/staticModules\??\.([\w$]+)/g)) used.add(m[1]);
  for (const m of code.matchAll(/staticModules\s*\[\s*"([\w$]+)"\s*\]/g)) used.add(m[1]);
  for (const m of code.matchAll(/\{([^{}]*)\}\s*=\s*[\w.?]*staticModules/g)) {
    for (const p of m[1].split(",")) { const n = p.split(":")[0].trim(); if (n) used.add(n); }
  }
  report(`staticModules (${registered.size} registered)`,
    [...used].filter(n => !registered.has(n)));
}

/* 2. both tick lists name modules that exist */
{
  const missing = [];
  for (const list of ["botModules", "modules"]) {
    const at = code.indexOf(`this.${list} = [`);
    const body = code.slice(at, code.indexOf("];", at));
    for (const m of body.matchAll(/staticModules\.([\w$]+)/g)) {
      if (!registered.has(m[1])) missing.push(`${list}:${m[1]}`);
    }
  }
  report("tick lists", missing);
}

/* 3. every class the registry instantiates is defined in the file */
{
  const missing = [];
  for (const m of regBody.matchAll(/^\s{8}[\w$]+: new ([\w$]+)\(/gm)) {
    if (!new RegExp(`(class|var|const|function) ${m[1]}\\b`).test(code)) missing.push(m[1]);
  }
  report("module classes", missing);
}

/* 4. every Settings_default._x read is a declared setting */
{
  const at = code.indexOf("const defaultSettings = {");
  const body = code.slice(at, code.indexOf("\n  };", at));
  const declared = new Set([...body.matchAll(/^\s{4}([\w$]+):/gm)].map(m => m[1]));
  const used = new Set();
  for (const m of code.matchAll(/Settings_default\??\.([\w$]+)/g)) used.add(m[1]);
  /* These four are read but were never declared, in this build and in every
   * one before it: the guard feature has no menu entry to turn it on, the
   * texture pack switch was never wired, and the follow radius falls back to a
   * literal at its only use. They are listed so a genuinely new dangling read
   * still fails this check. */
  const known = new Set(["get", "set", "save", "load", "reset", "hasOwnProperty",
    "_shieldGuard", "_autoJoinGuard", "_texturepack", "_followRadius"]);
  report(`settings (${declared.size} declared)`,
    [...used].filter(n => !declared.has(n) && !known.has(n)));

  /* 4b. every menu <input id> has a setting behind it */
  const missing = [];
  for (const page of ["Combat_default", "Visuals_default", "Misc_default", "Keybinds_default", "Bots_default", "Music_default", "Store_default", "Home_default", "Devtool_default"]) {
    const p = code.indexOf(`  const ${page} = `);
    if (p === -1) continue;
    const html = eval(code.slice(p + `  const ${page} = `.length, code.indexOf("\n", p)).replace(/;\s*$/, ""));
    for (const m of html.matchAll(/<input[^>]*\bid="([\w$]+)"/g)) {
      if (!declared.has(m[1])) missing.push(`${page}:${m[1]}`);
    }
  }
  report("menu inputs", missing);
}

/* 5. menu page markup balances */
{
  const bads = [];
  for (const page of ["Combat_default", "Visuals_default", "Misc_default", "Keybinds_default", "Bots_default", "Music_default", "Store_default", "Navbar_default", "Home_default", "Devtool_default"]) {
    const at = code.indexOf(`  const ${page} = `);
    if (at === -1) continue;
    const html = eval(code.slice(at + `  const ${page} = `.length, code.indexOf("\n", at)).replace(/;\s*$/, ""));
    for (const tag of ["div", "label", "select", "details"]) {
      const o = (html.match(new RegExp(`<${tag}[\\s>]`, "g")) || []).length;
      const c = (html.match(new RegExp(`</${tag}>`, "g")) || []).length;
      if (o !== c) bads.push(`${page} ${tag} ${o}/${c}`);
    }
  }
  report("menu markup balance", bads);
}

/* 6. every RYN._hooks._X read is a hook object the file defines */
{
  const at = code.indexOf("_hooks: {");
  const body = code.slice(at, code.indexOf("\n    },", at));
  const defined = new Set([...body.matchAll(/^\s{6}(_[\w$]+):/gm)].map(m => m[1]));
  const used = new Set();
  for (const m of code.matchAll(/_hooks\??\.(_[\w$]+)/g)) used.add(m[1]);
  report(`hook objects (${defined.size} defined)`, [...used].filter(n => !defined.has(n)));
}

/* 7. an alias must not be read before the thing it aliases exists. A class is
 * hoisted but not initialised, so `const X_default = X` placed above `class X`
 * throws the moment the script runs — and node --check passes it, because it is
 * valid syntax that is only wrong in time. */
{
  const early = [];
  for (const m of code.matchAll(/^  const ([\w$]+_default) = ([\w$]+);$/gm)) {
    const declared = code.search(new RegExp(`^  (?:class|function|const|let|var) ${m[2]}\\b`, "m"));
    if (declared === -1 || declared > m.index) early.push(`${m[1]} = ${m[2]}`);
  }
  report(`aliases (declared after their class)`, early);
}

console.log(bad ? `\n${bad} check(s) failed` : "\nno dangling references");
process.exit(bad ? 1 : 0);
