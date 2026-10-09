#!/usr/bin/env node
/*
 * check-tweaks.js
 *
 * The preferences in tools/tweaks.js, checked against the built script:
 * the token pool at 50 (by default, at most, on the slider, and for a size
 * stored before the change), and a bottom-right corner that shows a card only
 * while Cloudflare wants a click.
 *
 * Simulated, no browser: the pieces are sliced out and run in a vm, or read as
 * text where there is nothing to run.
 *
 *   node tools/check-tweaks.js [path/to/client.js]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const { maskLiterals } = require("./deobfuscate.js");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "Ryn_Type_2.user.js");
const client = fs.readFileSync(CLIENT_PATH, "utf8");
const masked = maskLiterals(client);

function slice(name) {
  const start = client.indexOf("  const " + name + " = ");
  if (start === -1) throw new Error("not found in client: " + name);
  let depth = 0;
  for (let i = start; i < masked.length; i++) {
    const c = masked[i];
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === ";" && depth === 0) return client.slice(start, i + 1);
  }
  throw new Error("unterminated: " + name);
}

const ok = [], problems = [];
const check = (what, pass, detail) => (pass ? ok : problems).push(pass ? what : what + " — " + detail);

/* The pool size, as rynPoolTarget() reads it. */
{
  const run = (setting) => {
    const sandbox = { Number, Math, Settings_default: setting === undefined ? {} : { _tokenPoolTarget: setting } };
    vm.runInNewContext(
      [slice("TURNSTILE_POOL_DEFAULT"), slice("TURNSTILE_POOL_MAX"), slice("rynPoolTarget"),
        "globalThis.__t = rynPoolTarget();"].join("\n"),
      sandbox
    );
    return sandbox.__t;
  };
  check("pool size 50 is taken as 50", run(50) === 50, "got " + run(50));
  check("pool size above 50 stops at 50", run(80) === 50, "got " + run(80));
  check("no pool size set: 50", run(undefined) === 50, "got " + run(undefined));
}

/* The slider and the setting's default. */
{
  const page = slice("Bots_default");
  const html = vm.runInNewContext("(" + page.slice(page.indexOf("=") + 1).replace(/;\s*$/, "") + ")");
  const slider = /id="_tokenPoolTarget"[^>]*max="(\d+)"/.exec(html);
  check("the pool slider goes to 50", slider && slider[1] === "50", "max is " + (slider && slider[1]));

  // The defaults object refers to other constants, so the one value is read
  // as text rather than the whole object evaluated.
  const def = /\n\s*_tokenPoolTarget:\s*(\d+),/.exec(slice("defaultSettings"));
  check("the pool setting's default is 50", def && def[1] === "50", "default is " + (def && def[1]));
}

/* A size stored before the change. */
{
  const at = client.indexOf("  const settings = {\n    ...defaultSettings,\n    ...storedSettings\n  };");
  const migration = /^\s*if \(!settings\._tokenPool50\) \{[\s\S]*?\n  \}/.exec(
    client.slice(at + "  const settings = {\n    ...defaultSettings,\n    ...storedSettings\n  };".length)
  );
  const run = (stored) => {
    const sandbox = { defaultSettings: { _tokenPoolTarget: 50, _tokenPool50: false }, storedSettings: stored };
    vm.runInNewContext(
      "const settings = {...defaultSettings, ...storedSettings};\n" + (migration ? migration[0] : "") +
      "\nglobalThis.__s = settings;",
      sandbox
    );
    return sandbox.__s._tokenPoolTarget;
  };
  check("a stored 4 from before becomes 50", run({ _tokenPoolTarget: 4 }) === 50, "stays " + run({ _tokenPoolTarget: 4 }));
  check("a size set after the change is kept", run({ _tokenPoolTarget: 10, _tokenPool50: true }) === 10,
    "became " + run({ _tokenPoolTarget: 10, _tokenPool50: true }));
}

/* The corner. */
{
  check("cards are hidden unless Cloudflare wants a click",
    /#ryn-cf-dock \.ryn-cf-card:not\(\.ryn-cf-ask\) \{ opacity: 0 !important; pointer-events: none !important; \}/.test(client),
    "no hide rule in the dock's stylesheet");
  check("the waiting count is hidden", /#ryn-cf-dock \.ryn-cf-more \{ display: none !important; \}/.test(client),
    "no rule for .ryn-cf-more");
  check("a click request still marks its card", /"before-interactive-callback": \(\) => \{[\s\S]{0,400}"ask"\)/.test(client),
    "before-interactive-callback no longer sets the ask tone");
  check("a bot's failure is still said, in the toast",
    /fail: \(text, retry\) => \{\s*if \(att\.closed\) return;[\s\S]{0,160}rynBotNotice\(att\.label/.test(client),
    "att.fail does not call rynBotNotice");
}

console.log("client :", path.relative(ROOT, CLIENT_PATH));
console.log("mode   : simulated (vm and text; no browser)\n");
for (const line of ok) console.log("  ok    " + line);
for (const line of problems) console.log("  FAIL  " + line);
if (problems.length) {
  console.log("\n" + problems.length + " problem(s).");
  process.exit(1);
}
console.log("\nOK - pool at 50, and the corner speaks only when Cloudflare wants a click.");
