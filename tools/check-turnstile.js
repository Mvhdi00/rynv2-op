#!/usr/bin/env node
/*
 * check-turnstile.js
 *
 * Can a bot get its Cloudflare check when the page's window.turnstile is dead?
 *
 * Simulated, with no network: Cloudflare's api.js cannot be fetched from here,
 * so a stand-in plays it — one that, like the failure seen on a signed-in
 * player, takes itself for a duplicate and publishes nothing when a
 * `turnstile` property is already on the window. The client's real RynCF and
 * its real trap on window.turnstile are sliced out of the script and run
 * against it on a fake clock.
 *
 *   node tools/check-turnstile.js [path/to/client.js]
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

/* `<indent>const|let <name> = …;` through the `;` that closes it. */
function slice(name, indent = "  ") {
  let start = client.indexOf(indent + "const " + name + " = ");
  if (start === -1) start = client.indexOf(indent + "let " + name + " = ");
  if (start === -1) return "";
  let depth = 0;
  for (let i = start; i < masked.length; i++) {
    const c = masked[i];
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === ";" && depth === 0) return client.slice(start, i + 1);
  }
  throw new Error("unterminated: " + name);
}

/* RYN's trap on window.turnstile: from wrapTurnstile to the end of the
 * try-block that installs the accessor. */
function trapSource() {
  const start = client.indexOf("    const wrapTurnstile = api => {");
  const tail = client.indexOf("\n    {\n      // ...and if the API defines itself", start);
  if (start === -1 || tail === -1) throw new Error("RYN's turnstile trap not found");
  return client.slice(start, tail);
}

function world({ cloudflareFirst }) {
  // A clock that only moves when told to.
  let now = 0, seq = 0;
  const timers = new Map();
  const later = (fn, ms, every) => {
    const id = ++seq;
    timers.set(id, { fn, at: now + ms, every });
    return id;
  };
  const clear = (id) => timers.delete(id);
  const advance = async (ms) => {
    const end = now + ms;
    for (;;) {
      let next = null;
      for (const [id, t] of timers) if (t.at <= end && (!next || t.at < next[1].at)) next = [id, t];
      if (!next) break;
      const [id, t] = next;
      now = t.at;
      if (t.every) t.at = now + t.every; else timers.delete(id);
      t.fn();
      for (let i = 0; i < 5; i++) await Promise.resolve();
    }
    now = end;
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };

  const scripts = [];
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    Promise, Error, URL, Object, Array, JSON, Math, Date,
    setTimeout: (fn, ms) => later(fn, ms || 0),
    setInterval: (fn, ms) => later(fn, ms, ms),
    clearTimeout: clear,
    clearInterval: clear,
    location: { href: "https://moomoo.io/" },
    Injector_lastCode: null,
  };
  sandbox.window = sandbox;
  sandbox.win = sandbox;

  /* Cloudflare's api.js, as the failure behaves: a `turnstile` property
   * already on the window and it publishes nothing. Otherwise it publishes
   * the API and calls the documented `onload` callback. */
  const runCloudflare = (src) => {
    if ("turnstile" in sandbox) return;
    sandbox.turnstile = { render: () => "widget", reset() {}, remove() {} };
    const cb = new URL(src).searchParams.get("onload");
    if (cb && typeof sandbox[cb] === "function") sandbox[cb]();
  };
  const element = (tag) => {
    const listeners = {};
    return {
      tagName: tag.toUpperCase(),
      src: "",
      setAttribute() {},
      remove() {},
      addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
      _fire(type) { for (const fn of listeners[type] || []) fn({}); },
    };
  };
  const appendChild = (node) => {
    if (node.tagName === "SCRIPT") {
      scripts.push(node);
      later(() => { runCloudflare(node.src); node._fire("load"); }, 50);
    }
    return node;
  };
  sandbox.document = {
    head: { appendChild },
    documentElement: { appendChild },
    createElement: element,
    querySelectorAll: () => scripts.filter((s) => s.src),
  };

  vm.createContext(sandbox);

  // Cloudflare already ran (the game's copy beat RYN's trap) — or not.
  if (cloudflareFirst) runCloudflare("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");

  vm.runInContext(
    [
      slice("rynGameSitekey"),
      slice("rynTurnstileAdopt"),
      slice("rynTurnstileSlot"),
      slice("rynTurnstileReadySeq"),
      slice("RYN_TS_SRC"),
      slice("RYN_CF_LOAD_MS"),
      slice("RYN_CF_GAME_GRACE_MS"),
      slice("RynCF"),
      // RYN's trap goes on before Cloudflare's script arrives.
      trapSource(),
      "globalThis.__RynCF = RynCF;",
    ].join("\n"),
    sandbox
  );
  return { sandbox, advance, RynCF: sandbox.__RynCF };
}

async function scenario(cloudflareFirst) {
  const w = world({ cloudflareFirst });
  let api = null, error = null;
  w.RynCF.load().then((a) => (api = a), (e) => (error = e));
  await w.advance(40000);
  const d = Object.getOwnPropertyDescriptor(w.sandbox, "turnstile");
  return { api, error, trapped: !!(d && d.get), live: w.sandbox.turnstile };
}

(async () => {
  const ok = [], problems = [];
  const check = (what, pass, detail) => (pass ? ok : problems).push(pass ? what : what + " — " + detail);

  const usual = await scenario(true);
  check("Cloudflare's script ran before RYN's trap: the check is available",
    usual.api && typeof usual.api.render === "function",
    usual.error ? usual.error.message : "no API");

  const lost = await scenario(false);
  check("RYN's trap was there first: RYN's own copy still gets the check",
    lost.api && typeof lost.api.render === "function",
    lost.error ? lost.error.message : "no API");
  if (lost.api) {
    check("…and RYN's trap is back around it", lost.trapped && lost.live && typeof lost.live.render === "function",
      "trapped: " + lost.trapped);
  }

  console.log("client :", path.relative(ROOT, CLIENT_PATH));
  console.log("mode   : simulated (stand-in for Cloudflare's api.js, fake clock; no network)\n");
  for (const line of ok) console.log("  ok    " + line);
  for (const line of problems) console.log("  FAIL  " + line);
  if (problems.length) {
    console.log("\n" + problems.length + " problem(s).");
    process.exit(1);
  }
  console.log("\nOK - a bot gets its Cloudflare check whichever of RYN's trap and Cloudflare's script came first.");
})().catch((e) => {
  console.error("check-turnstile crashed:", e && e.stack || e);
  process.exit(2);
});
