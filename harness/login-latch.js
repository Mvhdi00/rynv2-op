/* The login latch: why Play dies for the life of the page, and what the fix
 * changes — measured against the real moomoo bundle, not a description of it.
 *
 *   node login-latch.js [ryn.js] [bundle.js]
 *
 * Two halves, and both are needed:
 *
 *   1. APPLY   the three regex/replacement pairs are read OUT OF THE SHIPPED
 *              CLIENT and applied to the real game bundle in
 *              fixtures/moomoo_bundle.js. If a pattern stops matching — a new
 *              minifier run, a changed bundle — this says so instead of
 *              passing. The bench cannot drift from what the client does,
 *              because it uses the client's own strings.
 *
 *   2. RUN     the matched region, before and after, is executed in a vm and
 *              driven through the sequences a player actually hits. The
 *              "before" run has to reproduce the bug or the "after" run proves
 *              nothing.
 *
 * What it CANNOT tell you: whether Cloudflare hands out a token in a real
 * browser, or whether the socket the patched code opens is accepted. It tests
 * the latch logic and the patch application. RYN does not boot in this harness
 * and did not before this change.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RYN = process.argv[2] || path.resolve(__dirname, "../ryn/Ryn_Type_2.user.js");
const BUNDLE = process.argv[3] || path.resolve(__dirname, "fixtures/moomoo_bundle.js");
const src = fs.readFileSync(RYN, "utf8");
const bundle = fs.readFileSync(BUNDLE, "utf8");

let bad = 0;
const say = (ok, line) => { if (!ok) bad++; console.log("  " + (ok ? "ok  " : "FAIL") + "  " + line); };

/* Pull a Hook.replace/Hook.match pair out of the client by its name. The
 * regex and the replacement are taken from the file, so this bench tests the
 * shipped patch rather than a copy of it that could rot independently. */
function hook(name) {
  const re = new RegExp("Hook\\.(?:replace|match)\\(\"" + name + "\",\\s*(/[\\s\\S]*?/),\\s*(?:\"((?:[^\"\\\\]|\\\\.)*)\"(?:\\s*\\+\\s*\"((?:[^\"\\\\]|\\\\.)*)\")?)?");
  const m = re.exec(src);
  if (!m) throw new Error("no Hook named " + name + " in " + path.basename(RYN));
  // eslint-disable-next-line no-eval
  const pattern = eval(m[1]);
  let repl = null;
  if (m[2] !== undefined) {
    repl = JSON.parse('"' + m[2] + '"');
    if (m[3] !== undefined) repl += JSON.parse('"' + m[3] + '"');
  }
  return { pattern, repl };
}

console.log(path.basename(RYN) + " vs " + path.basename(BUNDLE) + " — the login latch\n");

// ── 1. APPLY ───────────────────────────────────────────────────────────────
console.log("  APPLY — the shipped patterns against the real bundle\n");

const PATCHES = ["connectLatchFix", "disconnectRelease", "spawnLatchRelease"];
const applied = {};
let patched = bundle;
for (const name of PATCHES) {
  const { pattern, repl } = hook(name);
  const global = new RegExp(pattern.source, "g");
  const hits = bundle.match(global) || [];
  say(hits.length === 1, name + " matches the bundle exactly once (" + hits.length + ")");
  if (hits.length !== 1) continue;
  applied[name] = { before: hits[0], after: hits[0].replace(pattern, repl) };
  patched = patched.replace(pattern, repl);
}
if (bad) { console.log("\n  patterns do not apply — stopping\n"); process.exit(1); }

// The rewrite has to stay valid JavaScript. A replacement with an unbalanced
// paren would sail through a regex check and take the whole bundle down.
for (const name of PATCHES) {
  let ok = true;
  try { new vm.Script("(function(){" + applied[name].after + "})"); } catch (e) { ok = false; }
  say(ok, name + " produces parseable code");
}
say(patched.length !== bundle.length, "the bundle really changed (" +
    (patched.length - bundle.length) + " chars)");

/* A patch that still MATCHES but no longer installs its hook would sail past
 * every check above — the region is rewritten, it parses, the length moves.
 * So each rewrite is required to contain the call it exists to add. */
const INSTALLS = {
  connectLatchFix: ["RYN._Login._releaseConnect", "RYN._Login._noToken"],
  disconnectRelease: ["RYN._Login._onDisconnect"],
  spawnLatchRelease: ["RYN._Login._releaseSpawn"],
};
for (const [name, wanted] of Object.entries(INSTALLS)) {
  for (const call of wanted) {
    say(applied[name].after.includes(call), name + " installs " + call + "()");
  }
}

console.log("\n  before → after, the site that matters:\n");
console.log("    " + applied.connectLatchFix.before.slice(0, 200));
console.log("      ↓");
console.log("    " + applied.connectLatchFix.after.slice(0, 260));

// ── 2. RUN ─────────────────────────────────────────────────────────────────
/* The three patched regions share one scope in the bundle — `ei`, `kt` and
 * `et` are siblings in the same module — so they are spliced into one scope
 * here too. Everything they call is a spy. The names come out of the match,
 * because they are minifier output and differ between builds. */
function world(useFix) {
  const connect = useFix ? applied.connectLatchFix.after : applied.connectLatchFix.before;
  const disc = useFix ? applied.disconnectRelease.after : applied.disconnectRelease.before;

  /* The identifiers this region reads from the wider bundle. Taken from the
   * text rather than hard-coded, because they are minifier output: `ei` in
   * this build is whatever the next build calls it. The declaration and the
   * function header are matched separately so the same extraction works on the
   * patched form, which has the releaser spliced between them. */
  const decl = /let (\w+)=!1,(\w+)=!1;/.exec(connect);
  const head = /function (\w+)\(\)\{!(\w+)\|\|/.exec(connect);
  if (!decl || !head) throw new Error("could not read the latch names out of the region");
  const [, kt, ei] = decl;
  const [, Fi, vi] = head;
  const zt = /function (\w+)\((\w+)\)\{\w+=!1,/.exec(disc)[1];

  const log = { connects: [], disconnects: 0, noToken: 0, spawnReleases: 0 };
  const sandbox = {
    console, __log: log,
    RYN: {
      _Login: {
        _releaseConnect: () => {},
        _releaseSpawn: () => { log.spawnReleases++; },
        _noToken() { log.noToken++; },
        _onDisconnect() {
          log.disconnects++;
          this._releaseConnect();
          this._releaseSpawn();
        },
      },
    },
  };
  vm.createContext(sandbox);

  /* moomoo.io's own values: Sa is true (the hostname is not localhost), pi is
   * false (We || Ia, both false), so `Sa||pi` takes the captcha-required
   * branch — the one that short-circuits without a token. vi is true because
   * `(!pi||We)&&(vi=!0)` fires. Those are read off the bundle, below. */
  const bind = code => code
    .replace(/(?<![A-Za-z0-9_$])Sa(?![A-Za-z0-9_$])/g, "Sa_")
    .replace(/(?<![A-Za-z0-9_$])pi(?![A-Za-z0-9_$])/g, "pi_")
    .replace(/(?<![A-Za-z0-9_$])ue(?![A-Za-z0-9_$])/g, "ue_")
    .replace(/(?<![A-Za-z0-9_$])Lt(?![A-Za-z0-9_$])/g, "Lt_")
    .replace(/(?<![A-Za-z0-9_$])O(?![A-Za-z0-9_$])/g, "O_")
    .replace(/(?<![A-Za-z0-9_$])Si(?![A-Za-z0-9_$])/g, "Si_");

  vm.runInContext(`
    this.W = (function(){
      var ${vi} = true;
      var Sa_ = true, pi_ = false;
      var ue_ = null;
      var O_ = { close(){} };
      var Si_ = function(){};
      var Lt_ = function(tok){ __log.connects.push(tok === undefined ? null : tok); };
      ${bind(connect)}
      ${bind(disc)}
      return {
        play(){ ${Fi}(); },
        drop(reason){ ${zt}(reason); },
        token(t){ ue_ = t; },
        latched(){ return ${ei}; },
        inGame(){ return ${kt}; },
      };
    })();
  `, sandbox);
  return { w: sandbox.W, log, names: { kt, ei, Fi, vi, zt } };
}

console.log("\n\n  RUN — the sequences a player actually hits\n");

/* Sequence 1: the reported bug. Press Play before the captcha has produced a
 * token — which _autospawn does on its own, and which a player does whenever
 * the challenge is slow — then let the token arrive and press again. */
function tokenlessThenToken(useFix) {
  const { w, log } = world(useFix);
  w.play();                       // no token yet
  w.token("TOKEN-A");             // Turnstile finally answers
  w.play();                       // press again
  return { connects: log.connects.length, latched: w.latched(), token: log.connects[0] };
}

/* Sequence 2: a connection that drops. The socket opens, the server closes it
 * (a kick, a restart, a refused login), and the player presses Play again. */
function dropThenRetry(useFix) {
  const { w, log } = world(useFix);
  w.token("TOKEN-A");
  w.play();                       // connects
  w.drop("disconnected");         // the screen in the report
  w.token("TOKEN-B");             // a fresh token for the retry
  w.play();
  return { connects: log.connects.length, latched: w.latched(), disconnects: log.disconnects };
}

const pad = (v, n) => String(v).padEnd(n);
/* `latch` is `ei` at the END of the sequence. Set is not automatically wrong:
 * after a connection is genuinely in flight it SHOULD be set — that is what it
 * is for. What matters is whether it is set with no socket behind it. */
console.log("  " + pad("sequence", 50) + pad("connects", 11) + pad("latch", 8) + "verdict");
console.log("  " + "-".repeat(92));
const rows = [];
for (const [label, fn] of [["press Play with no token, then get one", tokenlessThenToken],
                           ["connect, get dropped, press Play again", dropThenRetry]]) {
  for (const useFix of [false, true]) {
    const r = fn(useFix);
    rows.push({ label, useFix, ...r });
    console.log("  " + pad((useFix ? "AFTER   " : "BEFORE  ") + label, 50) +
                pad(r.connects, 11) + pad(r.latched ? "set" : "free", 8) +
                (r.connects > 0 ? "reaches the server" :
                 r.latched ? "NO SOCKET, and Play is dead from here on" : "no socket"));
  }
}

const before1 = rows[0], after1 = rows[1], before2 = rows[2], after2 = rows[3];

console.log("");
// The control. Without it, "after" passing would mean nothing.
say(before1.connects === 0 && before1.latched,
    "BEFORE: one tokenless press latches the flag and no socket is ever opened — the bug reproduces");
say(before2.connects === 1 && before2.latched,
    "BEFORE: after a drop the latch is still set, so the retry press does nothing");

say(after1.connects === 1, "AFTER: the tokenless press declines, and the press after the token connects");
say(after1.token === "cf:TOKEN-A", "AFTER: it connects with the token, not without one (" + after1.token + ")");
/* The property the whole patch turns on, checked on its own rather than at the
 * end of a sequence: a press that does not connect must leave the latch FREE.
 * The end-of-sequence value is a poor test because a successful connect sets it
 * legitimately, which is why this drives the tokenless press by itself. */
const solo = world(true);
solo.w.play();
say(solo.w.latched() === false,
    "AFTER: a press that opens no socket leaves the latch free, so the next press still works");
const soloBefore = world(false);
soloBefore.w.play();
say(soloBefore.w.latched() === true,
    "BEFORE: the same press latched it — that one line is the whole bug");
say(after2.connects === 2 && after2.disconnects === 1,
    "AFTER: a dropped connection is followed by a working retry (" + after2.connects + " connects)");

/* The gating itself must not have moved. The whole risk of this patch is
 * connecting WITHOUT a token, which the server would refuse — turning a login
 * bug into a login bug that also looks fixed. */
const gate = world(true);
gate.w.play();
say(gate.log.connects.length === 0,
    "AFTER: with no token it still refuses to connect — the game's own gating is unchanged");
say(gate.log.noToken === 1, "AFTER: and it reports the tokenless press so the captcha can be re-armed");

// ── 3. RUNTIME ─────────────────────────────────────────────────────────────
/* The supervisor itself, lifted out of the client rather than stubbed.
 *
 * Section 2 replaces RYN._Login with spies, which proves the bundle patches
 * call the right things but proves nothing about what they call INTO. This
 * runs the shipped class against a fake Turnstile and a fake DOM, and the
 * failure it is built for is Cloudflare's own: render() on a container that
 * already holds a widget does not throw, it returns undefined. */
console.log("\n\n  RUNTIME — the shipped _Login class, lifted and run\n");

function liftLogin() {
  const m = /const Login = new class \{[\s\S]*?\n  \}\(\);/.exec(src);
  if (!m) throw new Error("could not lift `const Login = new class` from the client");
  const consts = {};
  for (const k of ["RYN_LOGIN_GRACE_MS", "RYN_LOGIN_RETRY_MS", "RYN_LOGIN_MAX_RENDERS"]) {
    const c = new RegExp("const " + k + " = ([0-9.e+]+);").exec(src);
    if (!c) throw new Error("no `const " + k + "` in the client");
    consts[k] = Number(c[1]);
  }
  const sitekey = /const RYN_SITEKEY = "([^"]+)"/.exec(src)[1];
  return { code: m[0], consts, sitekey };
}

const lifted = liftLogin();
say(!!lifted.code, "the _Login class lifts out of the client (" + lifted.code.length + " chars)");
say(lifted.sitekey.length > 10, "and it renders with the game's own sitekey (" + lifted.sitekey + ")");

/* A Turnstile that behaves the way Cloudflare's does on a double render: the
 * second render into a container it has already used returns undefined and
 * warns, it does not throw. The registry is keyed on the ELEMENT — which is
 * the detail that matters, and the one this bench caught the fix getting
 * wrong. Emptying innerHTML does not clear it; only remove(id), or a container
 * Turnstile has never seen, does. */
function fakeTurnstile() {
  const state = { renders: 0, removes: 0, warned: 0, opts: null };
  const used = new Set();          // containers already rendered into
  const byId = new Map();          // widgetId -> container
  return {
    state, used,
    api: {
      render(el, opts) {
        state.renders++;
        if (used.has(el)) { state.warned++; return undefined; }
        used.add(el);
        const id = "widget-" + state.renders;
        byId.set(id, el);
        state.opts = opts;
        return id;
      },
      remove(id) {
        state.removes++;
        const el = byId.get(id);
        if (el) { used.delete(el); byId.delete(id); }
      },
    },
  };
}

function loginWorld({ occupiedAtStart = false, noApi = false } = {}) {
  const ts = fakeTurnstile();
  const btn = new Set(["disabled"]);
  const button = {
    classList: {
      contains: c => btn.has(c),
      add: c => btn.add(c),
      remove: c => btn.delete(c),
    },
  };
  // A container with a real parent, because replacing the node is how the fix
  // clears a widget whose id it does not own.
  const parent = { children: [] };
  const makeEl = () => {
    const el = {
      id: "turnstileWidget", offsetParent: {}, innerHTML: "",
      parentNode: parent,
      cloneNode() { return makeEl(); },
    };
    return el;
  };
  let container = makeEl();
  parent.replaceChild = (fresh, old) => { container = fresh; };
  const calls = { gotToken: [] };
  const sandbox = {
    console: { warn() {}, log() {} },
    Logger: { test() {}, error() {}, log() {} },
    Date,
    setInterval: () => 0, clearInterval: () => {},
    RYN_SITEKEY: lifted.sitekey,
    RYN_LOGIN_GRACE_MS: lifted.consts.RYN_LOGIN_GRACE_MS,
    RYN_LOGIN_RETRY_MS: lifted.consts.RYN_LOGIN_RETRY_MS,
    RYN_LOGIN_MAX_RENDERS: lifted.consts.RYN_LOGIN_MAX_RENDERS,
    document: {
      getElementById: id => id === "turnstileWidget" ? container
                          : id === "enterGame" ? button : null,
    },
    window: {
      turnstile: noApi ? null : ts.api,
      onGotTurnstileToken(t) { calls.gotToken.push(t); button.classList.remove("disabled"); },
      onTurnstileError() { button.classList.add("disabled"); },
      onTurnstileExpired() { button.classList.add("disabled"); },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(lifted.code + "\nthis.L = Login;", sandbox);
  // The game got there first: it rendered into the container RYN will find.
  if (occupiedAtStart) ts.api.render(container, { callback() {} });
  return { L: sandbox.L, ts, button, calls, el: () => container };
}

// The double-render case, which is what the console in the report shows.
{
  const { L, ts, calls } = loginWorld({ occupiedAtStart: true });
  say(ts.used.size === 1, "the game already rendered into the container, as Cloudflare reports");
  const first = L._render();
  say(first === true, "_render succeeds anyway — it replaces the container it cannot un-register");
  say(ts.state.removes === 0, "without calling remove() for a widget id it never had (" +
      ts.state.removes + " removes)");
  say(ts.state.renders === 2 && ts.state.warned === 0,
      "and the second render was ACCEPTED — the node was swapped, so Turnstile has not seen it");
  // A token through the game's own global is the whole point: it has to reach
  // the bundle's `ue`, not a callback of RYN's own.
  ts.state.opts.callback("TOK");
  say(calls.gotToken[0] === "TOK",
      "the token is handed to the game's own onGotTurnstileToken, so its `ue` is set");
  say(L._hasToken() === true, "and #enterGame loses `disabled`, which is how the bundle says it holds a token");
}

// Its own widget, replaced on a retry.
{
  const { L, ts } = loginWorld();
  L._render();
  const id1 = ts.state.renders;
  L._render();
  say(ts.state.removes === 1, "on a retry it removes the widget it owns before re-rendering (" +
      ts.state.removes + ")");
  say(ts.state.renders === id1 + 1 && ts.state.warned === 0,
      "so the retry is never the rejected double-render");
}

// The cap. A challenge that is genuinely blocked must not spin forever.
{
  const { L, ts } = loginWorld();
  let ok = 0;
  for (let i = 0; i < lifted.consts.RYN_LOGIN_MAX_RENDERS + 5; i++) if (L._render()) ok++;
  say(ok === lifted.consts.RYN_LOGIN_MAX_RENDERS,
      "it stops after RYN_LOGIN_MAX_RENDERS attempts (" + ok + ") rather than spinning");
}

// No API, no container: both must be survivable, not throw.
{
  const { L, el } = loginWorld();
  el().offsetParent = null;                            // menu hidden
  say(L._render() === false, "a hidden container is declined, not rendered into");
}
{
  /* No challenge script at all — the genuinely blocked case, which is what an
   * ad blocker produces. It has to decline rather than throw: this runs on the
   * menu, and an exception here takes the menu down with it. */
  const { L, ts } = loginWorld({ noApi: true });
  let threw = false, out = null;
  try { out = L._render(); } catch (e) { threw = true; }
  say(!threw, "with no Turnstile API at all it does not throw");
  say(out === false, "it declines (" + out + ")");
  say(ts.state.renders === 0, "and never reaches render()");
  /* And it must not SPEND an attempt. Without the `!ts` guard the counter is
   * incremented before the API is touched, so a challenge that is blocked for
   * the first few seconds burns the whole budget before it ever loads — the
   * try/catch hides the throw, which is why this is checked on the counter and
   * not on an exception. */
  for (let i = 0; i < lifted.consts.RYN_LOGIN_MAX_RENDERS + 3; i++) L._render();
  say(L._renders === 0,
      "and spends no part of the render budget while the API is missing (" + L._renders + ")");
}

// _onDisconnect has to release BOTH latches — this is what section 2 stubbed.
{
  const { L } = loginWorld();
  let connect = 0, spawn = 0;
  L._releaseConnect = () => connect++;
  L._releaseSpawn = () => spawn++;
  L._onDisconnect();
  say(connect === 1 && spawn === 1,
      "_onDisconnect releases both the connect latch and the spawn latch (" +
      connect + "/" + spawn + ")");
}

console.log("\n  Not covered: Cloudflare actually issuing a token, and the server accepting");
console.log("  the socket. RYN does not boot in this harness and did not before this change.");
console.log("\n  " + (bad ? bad + " assertion(s) failed" : "all assertions hold"));
process.exit(bad ? 1 : 0);
