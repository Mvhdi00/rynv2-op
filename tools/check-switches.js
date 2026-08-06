/*
 * Every switch in the menu should decide something. Two ways it can fail to:
 * the setting is never read, so the feature runs whatever the box says; or the
 * module that owns it never asks before acting.
 */
const fs = require("fs");
const path = require("path");
const code = fs.readFileSync(path.join(__dirname, "..", "src", "RYN_Client_v4.js"), "utf8");

/* the declared settings */
const at = code.indexOf("const defaultSettings = {");
const body = code.slice(at, code.indexOf("\n  };", at));
const declared = new Set([...body.matchAll(/^\s{4}([\w$]+)\s*:/gm)].map(m => m[1]));

/* everything the menu shows, by page */
const PAGES = ["Combat_default", "Visuals_default", "Misc_default", "Keybinds_default",
  "Bots_default", "Music_default", "Store_default", "Home_default", "Devtool_default"];
const shown = new Map();
for (const page of PAGES) {
  const p = code.indexOf(`  const ${page} = `);
  if (p === -1) continue;
  const html = eval(code.slice(p + `  const ${page} = `.length, code.indexOf("\n", p)).replace(/;\s*$/, ""));
  for (const m of html.matchAll(/<input[^>]*\bid="([\w$]+)"[^>]*type="(\w+)"/g)) {
    shown.set(m[1], { page, type: m[2] });
  }
  for (const m of html.matchAll(/<select[^>]*\bid="([\w$]+)"/g)) {
    shown.set(m[1], { page, type: "select" });
  }
}

/* how many times each setting is read outside the settings block itself */
const outside = code.slice(0, at) + code.slice(code.indexOf("\n  };", at));
const reads = new Map();
for (const m of outside.matchAll(/Settings_default\??\.([\w$]+)/g)) {
  reads.set(m[1], (reads.get(m[1]) || 0) + 1);
}
/* the menu machinery reads settings generically too; those do not count as a gate */
const dead = [];
for (const [id, info] of shown) {
  if (!declared.has(id)) continue;
  const count = reads.get(id) || 0;
  if (count === 0) dead.push(`${info.page.replace("_default", "")}: ${id}  (${info.type}, never read)`);
}

console.log("switches the code never reads");
console.log(dead.length ? dead.map(d => "  " + d).join("\n") : "  none");

/* the other direction: a module in the tick list whose own setting it never
 * mentions. A module with no gate at all runs from the moment it exists. */
const listAt = code.indexOf("this.modules = [");
const list = code.slice(listAt, code.indexOf("];", listAt));
const ticked = [...list.matchAll(/staticModules\.([\w$]+)/g)].map(m => m[1]);

const regAt = code.indexOf("this.staticModules = {");
const regBody = code.slice(regAt, code.indexOf("\n      };", regAt));
const classOf = new Map();
for (const m of regBody.matchAll(/^\s{8}([\w$]+): new ([\w$]+)/gm)) {
  classOf.set(m[1], m[2].replace(/_default$/, ""));
}

const ungated = [];
for (const name of ticked) {
  const cls = classOf.get(name);
  if (!cls) continue;
  const start = code.search(new RegExp(`^  class ${cls}\\b`, "m"));
  if (start === -1) continue;
  let end = start, depth = 0, started = false;
  for (; end < code.length; end++) {
    const ch = code[end];
    if (ch === "{") { depth++; started = true; }
    else if (ch === "}") { depth--; if (started && depth === 0) { end++; break; } }
  }
  const src = code.slice(start, end);
  if (!/Settings_default\??\./.test(src)) ungated.push(`${name}  (class ${cls})`);
}

console.log("\nmodules that tick without consulting any setting");
console.log(ungated.length ? ungated.map(d => "  " + d).join("\n") : "  none");

process.exit(dead.length ? 1 : 0);
