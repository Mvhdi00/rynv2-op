#!/usr/bin/env node
/*
 * check-bots.js
 *
 * Does each bot join as a device of its own — and does a fleet that runs into
 * the join API's per-address limit (429) wait it out and get in, instead of
 * failing with "Too many joins"?
 *
 * Simulated, with no network: the client's real RynBotDevices, rynJoinTicket,
 * RynJoinGate and createSocket are sliced out of the script and run against a
 * fake localStorage (holding the player's own device id), a fake join API, a
 * fake WebSocket and a fake clock. The Cloudflare check and the server list
 * are stubbed — they are not what is under test.
 *
 *   node tools/check-bots.js [path/to/client.js]
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

/* A `const <name> = …;` declaration, through the `;` that closes it. Brackets
 * are counted on the masked source (tools/deobfuscate.js), so a quote, brace or
 * semicolon inside a string, a regex or a comment is not mistaken for code. */
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

const OWN = "USER-DEVICE";

function world() {
  const store = new Map([["moo_did", OWN]]);
  const requests = [];
  const sockets = [];
  let issued = 0;
  // `limit`: at most `max` /join requests (accepted or not, the way a rate
  // limiter counts them) in any `windowMs`; past it, 429.
  const api = { refuse: null, limit: null, tokens: 0 };

  /* A clock that moves only when a timer is due: each timer runs on its own
   * turn of the real event loop, so every promise it starts settles first. */
  const clock = { now: 1e6 };
  const timers = [];
  let seq = 0, pending = false;
  const drain = () => {
    pending = false;
    if (!timers.length) return;
    timers.sort((a, b) => a.at - b.at || a.id - b.id);
    const t = timers.shift();
    if (t.at > clock.now) clock.now = t.at;
    t.fn();
    if (timers.length && !pending) { pending = true; setImmediate(drain); }
  };
  const later = (fn, ms) => {
    timers.push({ id: ++seq, at: clock.now + (ms || 0), fn });
    if (!pending) { pending = true; setImmediate(drain); }
    return seq;
  };

  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    JSON, Math, Array, Set, Map, Promise, Error, URL, Number, encodeURIComponent,
    Date: { now: () => clock.now, parse: (s) => Date.parse(s) },
    setTimeout: later,
    clearTimeout: (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    },
    AbortSignal: { timeout: () => undefined },
    RYN_API_BASE: "https://api-prod2.moomoo.io",
    // The join API: a device of its own for a join that brings none, the same
    // one back for a join that does.
    fetch: async (url, init) => {
      const body = JSON.parse(init.body);
      requests.push({ url, init, body, at: clock.now });
      if (api.limit) {
        const recent = requests.filter((r) => r.at > clock.now - api.limit.windowMs);
        if (recent.length > api.limit.max) {
          requests[requests.length - 1].busy = true;
          return { status: 429, ok: false, json: async () => ({}) };
        }
      }
      if (api.refuse) {
        return { status: 403, ok: false, json: async () => ({ error: api.refuse }) };
      }
      const did = body.did || "BOT-" + ++issued;
      return { status: 200, ok: true, json: async () => ({ ticket: "T" + requests.length, did }) };
    },
    WebSocket: class {
      constructor(url) {
        this.url = url;
        this.listeners = {};
        sockets.push(this);
      }
      addEventListener(type, fn) {
        (this.listeners[type] = this.listeners[type] || []).push(fn);
      }
      close() {
        for (const fn of this.listeners.close || []) fn({ code: 1000 });
      }
    },
    // Not under test: the server is one bots can join, the protocol module is
    // in, and every bot gets a Cloudflare token.
    rynServerOfHost: () => ({ name: "Test 1", auth: false }),
    rynMembersNotice: () => {},
    rynBotNotice: () => {},
    RynWire: { protocol: () => ({}), ensureProtocol: async () => {} },
    TokenPool: { take: () => (api.tokens++, "CF"), minting: 0, waitFor: async () => null, refill() {} },
    TURNSTILE_WAIT_MS: 0,
    generateTurnstileToken: async () => (api.tokens++, "CF"),
    rynEnc: () => ({ buildId: "s16nvz" }),
    _rynOwnSocket: false,
    // A signed-in player: the bot path must not care.
    RYN: { _account: { verified: () => true, accessToken: () => "ACCOUNT-TOKEN" } },
  };

  vm.createContext(sandbox);
  vm.runInContext(
    [
      slice("RYN_JOIN_REFUSED"),
      slice("rynJoinTicket"),
      // The join queue, where the client has one.
      ...["rynRetryAfterMs", "RYN_JOIN_LANES", "RYN_JOIN_GAP_MIN_MS", "RYN_JOIN_GAP_MAX_MS",
        "RYN_JOIN_BUSY_WAIT_MS", "RYN_JOIN_BUSY_WAIT_MAX_MS", "RYN_JOIN_GIVE_UP_MS", "RYN_JOIN_STALE_MS",
        "RynJoinGate"].map((name) => (client.includes("  const " + name + " = ") ? slice(name) : "")),
      slice("RYN_BOT_DIDS_KEY"),
      client.includes("  const RYN_BOT_DIDS_MAX = ") ? slice("RYN_BOT_DIDS_MAX") : "",
      slice("RynBotDevices"),
      client.includes("  const createSocketWith = ") ? slice("createSocketWith") : "",
      slice("createSocket"),
      "globalThis.__t = { RynBotDevices, createSocket };",
    ].join("\n"),
    sandbox
  );
  return { store, requests, sockets, api, clock, ...sandbox.__t };
}

const HREF = "wss://abc.moomoo.io/?token=tk:mine&b=s16nvz";
const problems = [];
const ok = [];
const check = (what, pass, detail) => (pass ? ok : problems).push(pass ? what : what + " — " + detail);

(async () => {
  /* Five bots at once, signed in. */
  {
    const w = world();
    await Promise.all([1, 2, 3, 4, 5].map((n) => w.createSocket(HREF, false, "Bot " + n)));
    const dids = w.requests.map((r) => r.body.did || null);
    const held = w.sockets.map((s) => s._rynDid);
    check("five bots join as five devices", new Set(held).size === 5, "devices: " + JSON.stringify(held));
    check("no bot joins as your device", !held.includes(OWN) && !dids.includes(OWN),
      "sent: " + JSON.stringify(dids) + ", held: " + JSON.stringify(held));
    check("your moo_did is untouched", w.store.get("moo_did") === OWN, "moo_did is now " + w.store.get("moo_did"));
    check("no bot's join carries your account", w.requests.every((r) => !("auth" in r.body)),
      "a body had auth: " + JSON.stringify(w.requests.map((r) => r.body)));
    check("every bot's join omits credentials", w.requests.every((r) => r.init.credentials === "omit"),
      "credentials: " + JSON.stringify(w.requests.map((r) => r.init.credentials)));

    /* All five leave, five more come: the same five devices, nothing new. */
    for (const s of w.sockets) s.close();
    check("a bot that leaves gives its device back", w.RynBotDevices.inUse.size === 0,
      "still held: " + JSON.stringify([...w.RynBotDevices.inUse]));
    const before = w.requests.length;
    await Promise.all([1, 2, 3, 4, 5].map((n) => w.createSocket(HREF, false, "Bot " + n)));
    const again = w.requests.slice(before).map((r) => r.body.did);
    check("returning bots reuse their own devices", again.every(Boolean) && new Set(again).size === 5 &&
      again.every((d) => held.includes(d)), "sent: " + JSON.stringify(again));
  }

  /* A guest with no device yet: a bot must not make one for you. */
  {
    const w = world();
    w.store.delete("moo_did");
    await w.createSocket(HREF, false, "Bot");
    check("a bot never gives you a device id", !w.store.has("moo_did"), "moo_did became " + w.store.get("moo_did"));
  }

  /* Refused at /join: the device goes back. */
  {
    const w = world();
    w.store.set("_ryn_bot_dids", JSON.stringify(["BOT-OLD"]));
    w.api.refuse = "vpn";
    let threw = false;
    try {
      await w.createSocket(HREF, false, "Bot");
    } catch (_) {
      threw = true;
    }
    check("a refused bot gives its device back", threw && w.RynBotDevices.inUse.size === 0,
      "threw: " + threw + ", held: " + JSON.stringify([...w.RynBotDevices.inUse]));
  }

  /* Cancelled after the join, before the socket: the device goes back. */
  {
    const w = world();
    w.store.set("_ryn_bot_dids", JSON.stringify(["BOT-OLD"]));
    const att = { cancelled: false, say() {}, onCancel() {} };
    let threw = false;
    // Cancelled while the join is in flight.
    const p = w.createSocket(HREF, false, "Bot", att);
    att.cancelled = true;
    try {
      await p;
    } catch (e) {
      threw = e && e.message === "cancelled";
    }
    check("a cancelled bot gives its device back", threw && w.RynBotDevices.inUse.size === 0,
      "threw cancelled: " + threw + ", held: " + JSON.stringify([...w.RynBotDevices.inUse]));
  }

  /* Under the API's limit: a fleet is not held back. */
  {
    const w = world();
    const start = w.clock.now;
    await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map((n) => w.createSocket(HREF, false, "Bot " + n)));
    const took = w.clock.now - start;
    check("under the join limit, eight bots join without waiting", w.sockets.length === 8 && took < 2e3,
      w.sockets.length + " joined in " + took + " ms");
  }

  /* Over it: the API takes 3 joins per 10 s, and eight bots are added at once. */
  {
    const w = world();
    w.api.limit = { max: 3, windowMs: 10e3 };
    const results = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
      w.createSocket(HREF, false, "Bot " + n).then(() => null, (e) => (e && (e.rynReason || e.message)) || "threw")));
    const failed = results.filter(Boolean);
    check("over the join limit, all eight bots still get in on their own", w.sockets.length === 8 && failed.length === 0,
      w.sockets.length + " joined; failed: " + JSON.stringify(failed));
    const busy = w.requests.filter((r) => r.busy);
    check("429s are waited out, not hammered (fewer 429s than bots)", busy.length < 8,
      busy.length + " requests answered 429 out of " + w.requests.length);
    let tooSoon = null;
    for (const r of busy) {
      const next = w.requests.find((q) => q.at > r.at);
      if (next && next.at - r.at < 2500) tooSoon = next.at - r.at;
    }
    check("after a 429 the next join waits at least 2.5 s", tooSoon === null, "next one went " + tooSoon + " ms later");
    check("every bot still has a device of its own", new Set(w.sockets.map((s) => s._rynDid)).size === 8,
      JSON.stringify(w.sockets.map((s) => s._rynDid)));
  }

  console.log("client :", path.relative(ROOT, CLIENT_PATH));
  console.log("mode   : simulated (fake storage, join API, sockets and clock; no network)\n");
  for (const line of ok) console.log("  ok    " + line);
  for (const line of problems) console.log("  FAIL  " + line);
  if (problems.length) {
    console.log("\n" + problems.length + " problem(s).");
    process.exit(1);
  }
  console.log("\nOK - every bot joins as a device of its own, yours is never used, and a 429 is waited out.");
})().catch((e) => {
  console.error("check-bots crashed:", e && e.stack || e);
  process.exit(2);
});
