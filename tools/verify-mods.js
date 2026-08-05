#!/usr/bin/env node
/*
 * verify-mods.js
 *
 * End-to-end checks on the fixed mods, run against the game bundle in src/.
 *
 * Two halves:
 *
 *   Transport — the rebuilt io-client is loaded out of the built userscript
 *   (together with the bundle's own msgpack-lite) and driven through a real
 *   handshake: an io-init frame in, a spawn packet out. The frame it produces
 *   is then taken apart and checked against the game's own opcode table and
 *   HMAC, both lifted from src/game_index.js.
 *
 *   Tables — the mod's config/items/store modules are evaluated and diffed
 *   against drivers/game-drivers.json, the same way tools/verify-drivers.js
 *   does it for the RYN-based build.
 *
 * Modules are located by content rather than by id, so the four beautified
 * mods and the minified Chicken build go through the same path.
 *
 *   node tools/verify-mods.js [path/to/mod.user.js ...]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const B = require("./mod-bundle.js");

const ROOT = path.resolve(__dirname, "..");
const GAME = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8");
const DRIVERS = JSON.parse(
  fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8")
);

/* x18k is a fork of a newer, flat bundle: no webpack module to load, its
 * io-client is an inline object, and its codec is two bundle classes. It gets
 * its own harness below rather than being forced through the module path. */
const FLAT = new Set(["X18k_v7.4.0_Fixed.user.js"]);

const BUILT = [
  "Dune_Mod_Fixed.user.js",
  "Cowgame_Fixed.user.js",
  "Lrx_v5_Fixed.user.js",
  "S_Client_v8.2_Fixed.user.js",
  "Lolfly_v4_Fixed.user.js",
  "Lrx_2023_Fixed.user.js",
  "Lolfly_v4_MS_Fixed.user.js",
  "Operator_Rageok_v1.4_Fixed.user.js",
  "Chicken_v3_Fixed.user.js",
  "X18k_v7.4.0_Fixed.user.js",
];

const TARGETS = process.argv.length > 2
  ? process.argv.slice(2).map((p) => path.resolve(p))
  : BUILT.map((f) => path.join(ROOT, f));

/* Config keys a mod diverges on deliberately. Both of these are client-render
 * only — maxPlayers feeds the server-browser "x / y" readout, deathFadeout the
 * death fade — so neither can desync anything with the server, and rewriting
 * them would undo a choice the author made on purpose. */
const ACCEPTED = {
  "Operator_Rageok_v1.4_Fixed.user.js": ["maxPlayers", "maxPlayersHard", "deathFadeout"],
};

/* How to reach each module: by webpack id where the bundle kept them, by
 * content where it did not. */
const MODULES = {
  config: { id: "./src/js/config.js", signature: "maxScreenWidth = 1920" },
  items: { id: "./src/js/data/items.js", signature: "tool hammer" },
  store: { id: "./src/js/data/store.js", signature: '"Shame!"' },
};

/* ------------------------------------------------------------------ *
 * The game's transport primitives, executed from the bundle itself.
 * ------------------------------------------------------------------ */
function gameTransport() {
  const lines = GAME.split("\n").map((l) => l.replace(/\r$/, ""));
  const from = lines.findIndex((l) => l === "  , Io = 1");
  const to = lines.findIndex((l) => l === "function Ro(e) {");
  let end = to;
  while (end < lines.length && lines[end] !== "}") end++;
  const src = "const " + lines.slice(from, end + 1).join("\n").replace(/^\s*,\s*/, "");

  const sandbox = { Math, Uint8Array, Uint32Array, DataView, ArrayBuffer, parseInt, console };
  vm.runInNewContext(src + "\n; __api = { Po, Eo, Ro, jt, Ht, bo, To };", sandbox);
  return sandbox.__api;
}

const game = gameTransport();
let failures = 0;

function report(label, ok, detail) {
  if (ok) {
    console.log("  ok   " + label);
  } else {
    failures++;
    console.log("  FAIL " + label + (detail ? " — " + detail : ""));
  }
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/* ------------------------------------------------------------------ *
 * Transport
 * ------------------------------------------------------------------ */
function checkTransport(src) {
  const req = B.createLoader(src);
  const range = B.ioClientRange(src);
  const body = src.slice(range.start, range.end);

  /* Take msgpack from wherever the rebuilt module takes it, rather than
   * guessing: the named bundles reach it by webpack id, the minified one by
   * array index, and the emitted line says which. */
  const lookup = body.match(/var msgpack = (.+);/);
  if (!lookup) throw new Error("rebuilt io-client has no msgpack lookup");
  const byIndex = lookup[1].match(/^\w+\(\s*(\d+)\s*\)$/);
  const byName = lookup[1].match(/^\w+\(\s*"([^"]+)"\s*\)$/);
  if (!byIndex && !byName) throw new Error("unrecognised msgpack lookup: " + lookup[1]);
  const msgpack = req(byIndex ? Number(byIndex[1]) : byName[1]);

  /* A handshake exactly as the server sends it. */
  const seed = 0x9e3779b9;
  const keyHex = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
  const key = game.Ro(keyHex);
  const tables = game.Po(seed >>> 0);

  /* Stand-in socket that records what the client puts on the wire. */
  const sent = [];
  let socket = null;
  class FakeSocket {
    constructor(address) {
      this.address = address;
      this.readyState = 1;
      socket = this;
    }
    send(frame) { sent.push(frame); }
    close() { this.readyState = 3; }
  }

  /* io-client is loaded on its own so the whole game engine does not have to
   * boot. Its msgpack lookup is rewritten to a sandbox binding, because the
   * expression differs between the named and minified bundles. */
  const io = (function () {
    const isolated = body.replace(/var msgpack = [^;]+;/, "var msgpack = __reupMsgpack;");

    const m = { exports: {} };
    const sandbox = B.baseSandbox({
      module: m, exports: m.exports,
      __reupMsgpack: msgpack,
      /* Chicken's factory parameters are mangled, and it keeps a side-effect
       * require of the config module. */
      e: m, t: m.exports, n: () => ({}),
      __webpack_require__: () => ({}),
      window: { OriginalWebSocket: FakeSocket, packetSent: 0, WebSocket: FakeSocket },
      /* Some io-clients reach for a bare OriginalWebSocket rather than the
       * window property. */
      OriginalWebSocket: FakeSocket,
      WebSocket: FakeSocket,
      performance: { now: () => 0, timeOrigin: 0 },
      packets: 0, packetInterval: undefined, pps: 0,
      /* The Emre-descended mods keep their rate limiter in the userscript
       * scope outside the bundle; the module closes over these at runtime. */
      firstSend: {}, minPacket: 0, secPacket: 0,
      minMax: Infinity, secMax: Infinity, minTime: 60000, secTime: 1000,
      /* lrx gates its limiter on a menu checkbox. */
      getEl: () => ({ checked: false }),
    });
    vm.createContext(sandbox);
    vm.runInContext("(function(){" + isolated + "\n})()", sandbox);
    return m.exports;
  })();

  /* ---- entry ordering ---- */
  let callbacks = 0;
  const received = [];
  io.connect(
    "wss://example.invalid",
    function (err) { if (!err) callbacks++; },
    {
      C: (...args) => received.push(["C", args]),
      a: (...args) => received.push(["a", args]),
    }
  );

  socket.onopen();
  report("connect callback withheld until io-init", callbacks === 0);

  socket.onmessage({ data: msgpack.encode(["io-init", [7, seed, keyHex, game.Ht]]).buffer });
  report("connect callback fired on io-init", callbacks === 1);
  report("socketId taken from io-init", io.socketId === 7);

  /* ---- outbound frame ---- */
  sent.length = 0;
  io.send("M", { name: "test", moofoll: 1, skin: 0 });
  report("spawn packet produced a frame", sent.length === 1);

  if (sent.length === 1) {
    const frame = new Uint8Array(sent[0]);
    const sig = frame.subarray(0, game.jt);
    const body = frame.subarray(game.jt);

    report(`frame carries a ${game.jt}-byte prefix`, frame.length > game.jt);
    report(
      "prefix is the game's truncated HMAC over the body",
      bytesEqual(sig, game.Eo(key, body)),
      "signature mismatch"
    );

    const decoded = msgpack.decode(body);
    report(
      `opcode "M" encoded as ${tables.c2s.enc.M}`,
      decoded[0] === tables.c2s.enc.M,
      `got ${decoded[0]}`
    );
    report("arguments preserved", JSON.stringify(decoded[1][0].name) === '"test"');
    report("sequence starts at 1", decoded[2] === 1);
  }

  /* Sequence must advance per frame — a repeat is a replay the server drops. */
  sent.length = 0;
  io.send("e");
  io.send("e");
  const seqs = sent.map((f) => msgpack.decode(new Uint8Array(f).subarray(game.jt))[2]);
  report("sequence advances per frame", seqs.length === 2 && seqs[1] === seqs[0] + 1, JSON.stringify(seqs));

  /* Every packet name the mod actually uses must exist in the game's c2s
   * alphabet, or it is silently dropped at send time. Commented-out call sites
   * are left over from older opcode names and do not count. */
  const used = new Set();
  for (const m of B.stripComments(src).matchAll(/\.send\(\s*"([A-Za-z0-9]{1,3})"/g)) {
    used.add(m[1]);
  }
  const unknown = [...used].filter((n) => tables.c2s.enc[n] === undefined);
  report(
    `all ${used.size} packet names are in the game's c2s alphabet`,
    unknown.length === 0,
    unknown.join(", ")
  );

  /* ---- inbound frame ---- */
  received.length = 0;
  socket.onmessage({ data: msgpack.encode([tables.s2c.enc.C, [1, 2, 3]]).buffer });
  report(
    "numeric s2c opcode dispatched to its handler",
    received.length === 1 && received[0][0] === "C",
    JSON.stringify(received)
  );

  /* An opcode with no handler must not throw — the old client did
   * events[type].apply(...) unguarded. */
  let threw = false;
  try {
    socket.onmessage({ data: msgpack.encode([tables.s2c.enc.Z, []]).buffer });
  } catch (e) {
    threw = true;
  }
  report("unhandled opcode does not throw", !threw);

  /* ---- teardown ----
   * Chicken deliberately ships close() as a no-op so the game's own disconnect
   * path cannot drop its socket. That is the mod's choice and is preserved, so
   * the expectation differs; everywhere else the session must be dropped, or a
   * reconnect could sign frames with a table the new connection never agreed
   * to. */
  const inertClose = /close: function \(\) \{\s*if \(false\)/.test(body);
  io.close();
  if (inertClose) {
    report("close() left inert, as this mod ships it", io.socket !== null);
  } else {
    sent.length = 0;
    io.connect("wss://example.invalid", function () {}, {});
    socket.onopen();
    io.send("e");
    report(
      "session dropped on close (no stale table reused before io-init)",
      sent.length === 1 && msgpack.decode(new Uint8Array(sent[0]))[0] === "e",
      "expected an unkeyed frame after reconnect"
    );
  }
}


/* ------------------------------------------------------------------ *
 * Flat-bundle transport (x18k)
 * ------------------------------------------------------------------ */
function checkFlatTransport(src) {
  /* The spliced-in primitives, then the io-client object they serve. */
  const primStart = src.indexOf("const __x18kTransport = (function () {");
  if (primStart === -1) throw new Error("x18k transport block not found");
  const objStart = src.indexOf("var T = {", primStart);
  if (objStart === -1) throw new Error("x18k io-client object not found");
  const objEnd = B.matchBrace(src, src.indexOf("{", objStart));
  const block = src.slice(primStart, objEnd + 1) + ";";

  /* x18k ships its own self-contained msgpack as a fallback at the top of the
   * file; reusing it means the test encodes exactly what the mod would. */
  const shimStart = src.indexOf("var msgpack = { encode:");
  const shimEnd = B.matchBrace(src, src.indexOf("{", shimStart));
  const shim = src.slice(shimStart, shimEnd + 1) + ";";

  const sent = [];
  let socket = null;
  class FakeSocket {
    constructor(address) { this.address = address; this.readyState = 1; socket = this; }
    send(frame) { sent.push(frame); }
    close() { this.readyState = 3; }
  }

  const sandbox = B.baseSandbox({
    WebSocket: FakeSocket,
    TextEncoder, TextDecoder,
    /* Everything the send path touches outside the io-client itself. */
    q3: null, Wt: {}, He: 0, We: 0, np: 0, v: 0, Dn: null, ni: 0, ui: 0,
    St: 0, qt: 0, A: 0, ee: 0, Hy: () => "", b: () => {},
    window: {},
  });
  vm.createContext(sandbox);
  vm.runInContext(shim + "\nvar sl = msgpack, ol = msgpack;\n" + block + "\n__T = T;", sandbox);

  const io = sandbox.__T;
  const msgpack = sandbox.msgpack;

  const seed = 0x9e3779b9;
  const keyHex = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
  const key = game.Ro(keyHex);
  const tables = game.Po(seed >>> 0);

  let callbacks = 0;
  const received = [];
  io.connect("wss://example.invalid", function (err) { if (!err) callbacks++; }, {
    C: (...args) => received.push(["C", args]),
  });

  socket.onopen();
  report("connect callback withheld until io-init", callbacks === 0);

  socket.onmessage({ data: msgpack.encode(["io-init", [7, seed, keyHex, game.Ht]]) });
  report("connect callback fired on io-init", callbacks === 1);
  report("socketId taken from io-init", io.socketId === 7);

  sent.length = 0;
  io.send("M", { name: "test", moofoll: 1, skin: 0 });
  report("spawn packet produced a frame", sent.length === 1);

  if (sent.length === 1) {
    const frame = new Uint8Array(sent[0]);
    const sig = frame.subarray(0, game.jt);
    const body = frame.subarray(game.jt);
    report(`frame carries a ${game.jt}-byte prefix`, frame.length > game.jt);
    report("prefix is the game's truncated HMAC over the body",
      bytesEqual(sig, game.Eo(key, body)), "signature mismatch");
    const decoded = msgpack.decode(body);
    report(`opcode "M" encoded as ${tables.c2s.enc.M}`,
      decoded[0] === tables.c2s.enc.M, `got ${decoded[0]}`);
    report("arguments preserved", JSON.stringify(decoded[1][0].name) === '"test"');
    report("sequence starts at 1", decoded[2] === 1);
  }

  /* The mod drops duplicate aim packets. A sequence number must not be spent on
   * one it never sends, or the server sees gaps. */
  sent.length = 0;
  io.send("9", 1.0, 0);
  io.send("9", 1.0, 0);
  const seqs = sent.map((f) => msgpack.decode(new Uint8Array(f).subarray(game.jt))[2]);
  report("no sequence burned on a dropped packet",
    seqs.length >= 1 && seqs.every((q, i) => q === seqs[0] + i), JSON.stringify(seqs));

  received.length = 0;
  socket.onmessage({ data: msgpack.encode([tables.s2c.enc.C, [1, 2, 3]]) });
  report("numeric s2c opcode dispatched to its handler",
    received.length === 1 && received[0][0] === "C", JSON.stringify(received));

  let threw = false;
  try { socket.onmessage({ data: msgpack.encode([tables.s2c.enc.Z, []]) }); } catch (e) { threw = true; }
  report("unhandled opcode does not throw", !threw);

  io.close();
  sent.length = 0;
  io.connect("wss://example.invalid", function () {}, {});
  socket.onopen();
  io.send("e");
  report("session dropped on close (no stale table reused before io-init)",
    sent.length === 1 && msgpack.decode(new Uint8Array(sent[0]))[0] === "e",
    "expected an unkeyed frame after reconnect");
}

/* ------------------------------------------------------------------ *
 * Table drift
 * ------------------------------------------------------------------ */
function checkTables(src, accepted = []) {
  const req = B.createLoader(src);
  const config = req(B.findModuleId(src, MODULES.config));
  const items = req(B.findModuleId(src, MODULES.items));
  const store = req(B.findModuleId(src, MODULES.store));

  const drift = [];
  const cosmetic = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  for (const [k, v] of Object.entries(DRIVERS.config)) {
    if (typeof config[k] === "function") continue;
    if (!(k in config)) { drift.push(`config: missing "${k}"`); continue; }
    /* inSandbox is a build-time flag in the bundle and a host check in the
     * mods; both are false in a browser on the live game. */
    if (k === "inSandbox" || accepted.includes(k)) continue;
    if (!same(config[k], v)) drift.push(`config.${k}: mod=${JSON.stringify(config[k])} game=${JSON.stringify(v)}`);
  }

  /* Only fields the game itself defines are compared; the mods add their own
   * (healing, Pdmg, dmg2, iPad) and those are theirs to keep. */
  function positional(label, mine, theirs, keys) {
    if (mine.length !== theirs.length) drift.push(`${label}: ${mine.length} entries, game has ${theirs.length}`);
    for (let i = 0; i < Math.min(mine.length, theirs.length); i++) {
      for (const k of keys) {
        if (theirs[i][k] === undefined) continue;
        if (same(mine[i][k], theirs[i][k])) continue;
        const line = `${label}[${i}] "${theirs[i].name}" .${k}: mod=${JSON.stringify(mine[i][k])} game=${JSON.stringify(theirs[i][k])}`;
        /* Tooltip text never crosses the wire, and several mods reword it on
         * purpose. Worth showing, not worth failing on. */
        (k === "desc" ? cosmetic : drift).push(line);
      }
    }
  }

  positional("itemGroups", items.groups, DRIVERS.itemGroups, ["id", "name", "place", "limit", "layer"]);
  positional("items", items.list, DRIVERS.items, ["name", "desc", "req", "scale", "holdOffset", "placeOffset", "dmg", "pps", "turret", "projectile", "spawnDelay", "ignoreCollision", "doUpdate", "hideFromEnemy", "trap", "healImmunity", "protectionRange", "shootRange", "shootRate"]);
  positional("weapons", items.weapons, DRIVERS.weapons, ["id", "type", "name", "desc", "src", "length", "width", "xOff", "yOff", "dmg", "range", "gather", "speed", "spdMult", "projectile", "knockback", "aimPadding", "armorPenetration"]);
  positional("hats", store.hats, DRIVERS.hats, ["id", "name", "price", "scale", "desc", "dontSell", "topSpeed", "spdMult", "healthRegen", "dmgMultO", "dmgMult", "dmgReduction", "poisonDmg", "poisonTime", "bushGather", "antiBull", "healD", "aMlt", "dmgK", "pDmg", "colDmg", "kScrM", "pierceX", "ignoreCollision", "blockDmg"]);
  positional("accessories", store.accessories, DRIVERS.accessories, ["id", "name", "price", "scale", "desc", "dontSell", "xOff", "spin", "spdMult", "xp"]);

  report(
    `tables match the shipped bundle (${DRIVERS.hats.length} hats, ${DRIVERS.accessories.length} accessories, ${DRIVERS.weapons.length} weapons, ${DRIVERS.items.length} items, ${DRIVERS.itemGroups.length} groups, ${Object.keys(DRIVERS.config).length} config keys)`,
    drift.length === 0
  );
  for (const d of drift) console.log("       " + d);
  if (cosmetic.length) {
    console.log(`  note ${cosmetic.length} description string(s) reworded by the mod (display only)`);
  }
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */
console.log("game :", DRIVERS.source.index, "+", DRIVERS.source.vendor);
console.log("");

for (const target of TARGETS) {
  const src = fs.readFileSync(target, "utf8");
  console.log(path.relative(ROOT, target));
  if (FLAT.has(path.basename(target))) {
    checkFlatTransport(src);
  } else {
    checkTransport(src);
    checkTables(src, ACCEPTED[path.basename(target)] || []);
  }
  console.log("");
}

if (failures) {
  console.log(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log(`OK - ${TARGETS.length} mods speak the shipped protocol and carry the shipped tables.`);
