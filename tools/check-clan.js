#!/usr/bin/env node
/*
 * check-clan.js
 *
 * Does every bot get into your clan, and does Re-check keep at a bot that has
 * not until it is in?
 *
 * Simulated, no game: the client's real clan queue (clanQueueTick and the
 * functions round it) and its real AutoAccept are sliced out of the script
 * and run against a fake server on a fake clock. The server is the strict
 * kind: a bot's request waits on the leader until it is answered, and a bot
 * with a request waiting cannot make another.
 *
 *   node tools/check-clan.js [path/to/client.js]
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

/* From the first `{` (or, with `semicolon`, from `start`) to what closes it. */
function closing(start, semicolon) {
  let depth = 0;
  for (let i = semicolon ? start : masked.indexOf("{", start); i < masked.length; i++) {
    const c = masked[i];
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) {
      depth--;
      if (!semicolon && depth === 0) return i + 1;
    } else if (semicolon && c === ";" && depth === 0) return i + 1;
  }
  throw new Error("unterminated at " + start);
}
const has = (head) => client.includes(head);
function piece(kind, name) {
  const head = kind === "const" ? "  const " + name + " = " : kind === "class" ? "  class " + name + " {" : "  function " + name + "(";
  const start = client.indexOf(head);
  if (start === -1) return "";
  return client.slice(start, closing(start, kind === "const"));
}

const SOURCE = [
  ...["CLAN_QUEUE", "CLAN_JOIN_CONFIRM_MS", "CLAN_PACKET_GAP_MS", "CLAN_RETRY_BACKOFF_MS", "CLAN_AUDIT_INTERVAL_MS", "CLAN_INSIST_MS"]
    .map((n) => piece("const", n)),
  ...["clanIsFleet", "clanLeaderAccept", "clanQueue", "clanMissingBots", "clanStartPass", "clanQueueTick", "clanAnchor",
    "clanAudit", "clanRecheck"].map((n) => piece("function", n)),
  piece("class", "AutoAccept"),
  "globalThis.__t = { clanQueueTick, clanRecheck, AutoAccept };",
].join("\n");

const TICK = 1000 / 9;

/* One game: you lead the clan, `n` bots. Options:
 *   lateNotice  ms before your AutoAccept first sees the new clan
 *   unknown     bot numbers that neither RynAllegiance nor clientIDList know
 *   drops       { botNumber: how many of its requests the server loses }
 */
function game(n, opts = {}) {
  let now = 1e6;
  const events = [];
  const later = (ms, fn) => events.push({ at: now + ms, fn });
  const declined = [];

  const server = { clan: null, pending: new Map(), drops: new Map() };
  const owner = {
    isOwner: true,
    myPlayer: { id: 1, inGame: true, clanName: null, isLeader: false, joinRequests: [] },
    pendingJoins: new Set(),
    clientIDList: new Set(),
    clients: [],
    clientList() { return this.clients; },
    PacketManager: {
      clanRequest(id, accept) {
        if (!accept) declined.push(id);
        const bot = server.pending.get(id);
        if (!bot) return;
        server.pending.delete(id);
        if (accept) later(150, () => { bot.myPlayer.clanName = server.clan.name; });
      },
    },
  };
  const unknown = new Set(opts.unknown || []);
  for (let i = 1; i <= n; i++) {
    const bot = {
      id: i,
      ownerClient: owner,
      myPlayer: { id: 100 + i, inGame: true, clanName: null, joinRequests: [] },
      SocketManager: { socket: { readyState: 1 } },
      PacketManager: {
        joinClan(name) {
          if (!server.clan || name !== server.clan.name || bot.myPlayer.clanName === name) return;
          const id = bot.myPlayer.id;
          const lose = server.drops.get(id) || 0;
          if (lose > 0) { server.drops.set(id, lose - 1); return; }
          if (server.pending.has(id)) return; // one waiting request each
          server.pending.set(id, bot);
          later(200, () => owner.myPlayer.joinRequests.push([id, "bot" + i]));
        },
        leaveClan() {},
      },
    };
    owner.clients.push(bot);
    if (!unknown.has(i)) owner.clientIDList.add(bot.myPlayer.id);
    if (opts.drops && opts.drops[i]) server.drops.set(bot.myPlayer.id, opts.drops[i]);
  }

  const sandbox = {
    Date: { now: () => now }, Math, Set, Map, WeakMap, Number,
    Possess: null,
    PS: (o) => o,
    RynAllegiance: { isFriendlyID: (c, id) => owner.clientIDList.has(id) },
    Settings_default: { _autoaccept: false },
    GameUI_default: { clearNotication() {}, createRequest() {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);
  const { clanQueueTick, clanRecheck, AutoAccept } = sandbox.__t;
  const accept = new AutoAccept(owner);

  // You make the clan.
  server.clan = { name: "GG" };
  owner.myPlayer.clanName = "GG";
  owner.myPlayer.isLeader = true;
  const start = now;

  const run = (ms) => {
    const end = now + ms;
    while (now < end) {
      now += TICK;
      events.sort((a, b) => a.at - b.at);
      while (events.length && events[0].at <= now) events.shift().fn();
      if (now - start >= (opts.lateNotice || 0)) accept.postTick();
      for (const bot of owner.clients) clanQueueTick(owner, bot, owner.myPlayer.clanName, now);
    }
  };
  const inClan = () => owner.clients.filter((b) => b.myPlayer.clanName === "GG").map((b) => b.id);
  const joinedAt = {};
  const watch = (ms) => {
    const end = now + ms;
    while (now < end) {
      run(TICK);
      for (const id of inClan()) if (!(id in joinedAt)) joinedAt[id] = now - start;
    }
  };
  return {
    watch, inClan, joinedAt, declined,
    recheck: () => clanRecheck(owner),
    elapsed: () => now - start,
  };
}

const ok = [], problems = [];
const check = (what, pass, detail) => (pass ? ok : problems).push(pass ? what : what + " — " + detail);

if (!SOURCE.includes("function clanQueueTick(") || !SOURCE.includes("class AutoAccept")) {
  problems.push("the clan queue or AutoAccept is not in this client");
} else {
  /* Your AutoAccept sees the new clan a few ticks after the first bot asks. */
  {
    const g = game(12, { lateNotice: 400 });
    g.watch(60e3);
    const missing = 12 - g.inClan().length;
    check("12 bots, your client slow to see the new clan: all 12 get in", missing === 0,
      missing + " left outside for a minute");
  }
  /* A bot the client does not yet know as one of its own. */
  {
    const g = game(12, { unknown: [5] });
    g.watch(60e3);
    check("a bot not yet in the fleet lists is accepted, not declined", g.inClan().includes(5) && !g.declined.includes(105),
      "bot 5 " + (g.declined.includes(105) ? "was declined " + g.declined.filter((d) => d === 105).length + " times" : "never got in"));
  }
  /* Everything right: every bot in on the first pass. */
  {
    const g = game(12);
    g.watch(30e3);
    const slow = Object.entries(g.joinedAt).filter(([, t]) => t > 12 * 3e3).map(([id]) => id);
    check("an ordinary clan: all 12 in on the first pass", g.inClan().length === 12 && slow.length === 0,
      g.inClan().length + " in; late: " + JSON.stringify(slow));
  }
  /* The server loses a bot's first six requests: it keeps being asked. */
  {
    const g = game(6, { drops: { 3: 6 } });
    g.watch(40e3);
    check("a bot whose first six requests are lost is asked again until it is in (within 40 s)", g.inClan().includes(3),
      "bot 3 still outside after 40 s");
  }
  /* Re-check: twelve lost requests, and the button keeps at it. */
  {
    const g = game(6, { drops: { 2: 12 } });
    g.watch(15e3);
    const before = g.elapsed();
    const said = g.recheck();
    g.watch(45e3);
    const took = g.joinedAt[2] !== undefined ? Math.round((g.joinedAt[2] - before) / 1e3) : null;
    check("Re-check keeps a stuck bot trying until it is in (12 lost requests: in " + took + " s)",
      took !== null && took <= 45 && said && said.missing === 1, "bot 2 " + (took === null ? "never got in" : "took " + took + " s"));
  }
  check("Re-check says it keeps going", client.includes('" joined — retrying " + a.missing + " until in"'),
    "the button still says only \"retrying\"");
}

console.log("client :", path.relative(ROOT, CLIENT_PATH));
console.log("mode   : simulated (the client's clan queue and AutoAccept, a strict fake server, fake clock)\n");
for (const line of ok) console.log("  ok    " + line);
for (const line of problems) console.log("  FAIL  " + line);
if (problems.length) {
  console.log("\n" + problems.length + " problem(s).");
  process.exit(1);
}
console.log("\nOK - every bot gets into your clan, and Re-check keeps at the ones that have not.");
