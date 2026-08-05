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
 *   node tools/verify-mods.js [path/to/mod.user.js ...]
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const GAME = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8");
const DRIVERS = JSON.parse(
  fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8")
);

const TARGETS = process.argv.length > 2
  ? process.argv.slice(2).map((p) => path.resolve(p))
  : [
      path.join(ROOT, "Dune_Mod_Fixed.user.js"),
      path.join(ROOT, "Cowgame_Fixed.user.js"),
    ];

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

/* ------------------------------------------------------------------ *
 * Loading webpack modules out of a built userscript.
 * ------------------------------------------------------------------ */
function moduleBody(src, id) {
  const at = src.indexOf(JSON.stringify(id) + ":");
  if (at === -1) throw new Error("module not found: " + id);
  const fnAt = src.indexOf("function", at);
  const open = src.indexOf("{", src.indexOf(")", fnAt));

  let depth = 0;
  let quote = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const cl = src.indexOf("*/", i);
      i = cl === -1 ? src.length : cl + 1;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return src.slice(open + 1, i); }
  }
  throw new Error("unterminated module: " + id);
}

/* Blanks out comments while preserving offsets, so a call site that only
 * survives inside a /* ... *​/ block is not mistaken for live code. Both mods
 * carry dead io.send() lines under older opcode names. */
function stripComments(src) {
  const out = src.split("");
  let quote = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      const end = nl === -1 ? src.length : nl;
      for (let j = i; j < end; j++) out[j] = " ";
      i = end;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const cl = src.indexOf("*/", i);
      const end = cl === -1 ? src.length : cl + 2;
      for (let j = i; j < end; j++) if (out[j] !== "\n") out[j] = " ";
      i = end - 1;
      continue;
    }
  }
  return out.join("");
}

/* The mods destructure Math at the top of the userscript and lean on those
 * bindings from inside bundle modules, so the sandbox has to supply them. */
const MATH_SHORTHANDS = {
  sin: Math.sin, cos: Math.cos, min: Math.min, max: Math.max, random: Math.random,
  floor: Math.floor, ceil: Math.ceil, round: Math.round, PI: Math.PI, sqrt: Math.sqrt,
  abs: Math.abs, pow: Math.pow, log: Math.log, LN2: Math.LN2, atan2: Math.atan2,
};

function bundleLoader(src, extraGlobals = {}) {
  const cache = {};
  const processShim = { env: {}, argv: [], nextTick: (f) => setTimeout(f, 0) };

  function req(id) {
    if (cache[id]) return cache[id].exports;
    const m = (cache[id] = { exports: {} });
    const sandbox = Object.assign(
      {
        module: m, exports: m.exports, __webpack_require__: req,
        process: processShim, Math, JSON, console,
        setTimeout, clearTimeout, setInterval, clearInterval,
        Uint8Array, Uint32Array, Int32Array, Float64Array, DataView, ArrayBuffer,
        window: { location: { hostname: "moomoo.io" }, navigator: { userAgent: "node" } },
      },
      MATH_SHORTHANDS,
      extraGlobals
    );
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(
      "(function(module,exports,__webpack_require__){" + moduleBody(src, id) + "\n})(module,exports,__webpack_require__)",
      sandbox
    );
    return m.exports;
  }

  cache["./node_modules/process/browser.js"] = { exports: processShim };
  return req;
}

/* ------------------------------------------------------------------ *
 * Checks
 * ------------------------------------------------------------------ */
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

function checkTransport(src) {
  const req = bundleLoader(src);
  const msgpack = req("./node_modules/msgpack-lite/lib/browser.js");

  /* A handshake exactly as the server sends it. */
  const seed = 0x9e3779b9;
  const keyHex = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
  const key = game.Ro(keyHex);
  const tables = game.Po(seed >>> 0);

  /* Stand-in socket that records what the client puts on the wire. */
  const sent = [];
  let socketHandlers = null;
  class FakeSocket {
    constructor(address) {
      this.address = address;
      this.readyState = 1;
      socketHandlers = this;
    }
    send(frame) { sent.push(frame); }
    close() { this.readyState = 3; }
  }

  const io = (function () {
    /* io-client is loaded on its own so the whole game engine does not have to
     * boot; the module only needs msgpack and window.OriginalWebSocket. */
    const m = { exports: {} };
    const sandbox = Object.assign(
      {
        module: m, exports: m.exports,
        __webpack_require__: (id) => (id.includes("msgpack") ? msgpack : {}),
        Math, JSON, console, setTimeout, clearTimeout,
        Uint8Array, Uint32Array, DataView, ArrayBuffer, parseInt,
        window: { OriginalWebSocket: FakeSocket },
        /* cowgame's send path keeps its rate limiter in the userscript scope
         * outside the bundle; the module closes over these at runtime. */
        firstSend: {}, minPacket: 0, secPacket: 0,
        minMax: Infinity, secMax: Infinity, minTime: 60000, secTime: 1000,
      },
      MATH_SHORTHANDS
    );
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(
      "(function(module,exports,__webpack_require__){" +
        moduleBody(src, "./src/js/libs/io-client.js") +
        "\n})(module,exports,__webpack_require__)",
      sandbox
    );
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

  socketHandlers.onopen();
  report("connect callback withheld until io-init", callbacks === 0);

  socketHandlers.onmessage({
    data: msgpack.encode(["io-init", [7, seed, keyHex, game.Ht]]).buffer,
  });
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

    report(
      `frame carries a ${game.jt}-byte prefix`,
      frame.length > game.jt
    );
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
  for (const m of stripComments(src).matchAll(/io\.send\(\s*"([^"]+)"/g)) {
    used.add(m[1]);
  }
  const unknown = [...used].filter((n) => tables.c2s.enc[n] === undefined);
  report(
    `all ${used.size} packet names are in the game's c2s alphabet`,
    unknown.length === 0,
    unknown.join(", ")
  );

  /* ---- inbound frame ---- */
  sent.length = 0;
  received.length = 0;
  socketHandlers.onmessage({
    data: msgpack.encode([tables.s2c.enc.C, [1, 2, 3]]).buffer,
  });
  report(
    "numeric s2c opcode dispatched to its handler",
    received.length === 1 && received[0][0] === "C",
    JSON.stringify(received)
  );

  /* An opcode with no handler must not throw — the old client did
   * events[type].apply(...) unguarded. */
  let threw = false;
  try {
    socketHandlers.onmessage({ data: msgpack.encode([tables.s2c.enc.Z, []]).buffer });
  } catch (e) {
    threw = true;
  }
  report("unhandled opcode does not throw", !threw);

  /* ---- teardown ---- */
  io.close();
  sent.length = 0;
  io.connect("wss://example.invalid", function () {}, {});
  socketHandlers.onopen();
  io.send("e");
  report(
    "session dropped on close (no stale table reused before io-init)",
    sent.length === 1 && msgpack.decode(new Uint8Array(sent[0]))[0] === "e",
    "expected an unkeyed frame after reconnect"
  );
}

/* ------------------------------------------------------------------ *
 * Table drift
 * ------------------------------------------------------------------ */
function checkTables(src) {
  const req = bundleLoader(src);
  const config = req("./src/js/config.js");
  const items = req("./src/js/data/items.js");
  const store = req("./src/js/data/store.js");

  const drift = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  for (const [k, v] of Object.entries(DRIVERS.config)) {
    if (typeof config[k] === "function") continue;
    if (!(k in config)) { drift.push(`config: missing "${k}"`); continue; }
    /* inSandbox is a build-time flag in the bundle and a host check in the
     * mod; both are false in a browser on the live game. */
    if (k === "inSandbox") continue;
    if (!same(config[k], v)) drift.push(`config.${k}: mod=${JSON.stringify(config[k])} game=${JSON.stringify(v)}`);
  }

  /* Only fields the game itself defines are compared; the mods add their own
   * (healing, Pdmg, dmg2, iPad) and those are theirs to keep. */
  function positional(label, mine, theirs, keys) {
    if (mine.length !== theirs.length) drift.push(`${label}: ${mine.length} entries, game has ${theirs.length}`);
    for (let i = 0; i < Math.min(mine.length, theirs.length); i++) {
      for (const k of keys) {
        if (theirs[i][k] === undefined) continue;
        if (!same(mine[i][k], theirs[i][k])) {
          drift.push(`${label}[${i}] "${theirs[i].name}" .${k}: mod=${JSON.stringify(mine[i][k])} game=${JSON.stringify(theirs[i][k])}`);
        }
      }
    }
  }

  positional("itemGroups", items.groups, DRIVERS.itemGroups, ["id", "name", "place", "limit", "layer"]);
  positional("items", items.list, DRIVERS.items, ["name", "desc", "req", "scale", "holdOffset", "placeOffset", "dmg", "pps", "turret", "projectile", "spawnDelay", "ignoreCollision", "doUpdate", "hideFromEnemy", "trap", "healImmunity", "protectionRange", "shootRange", "shootRate"]);
  positional("weapons", items.weapons, DRIVERS.weapons, ["id", "type", "name", "desc", "src", "length", "width", "xOff", "yOff", "dmg", "range", "gather", "speed", "spdMult", "projectile", "knockback", "aimPadding", "armorPenetration"]);
  positional("hats", store.hats, DRIVERS.hats, ["id", "name", "price", "scale", "desc", "dontSell", "topSpeed", "spdMult", "healthRegen", "dmgMultO", "dmgMult", "dmgReduction", "poisonDmg", "poisonTime", "bushGather", "antiBull", "healD", "aMlt", "dmgK", "pDmg", "colDmg", "kScrM", "pierceX", "ignoreCollision", "blockDmg"]);
  positional("accessories", store.accessories, DRIVERS.accessories, ["id", "name", "price", "scale", "desc", "dontSell", "xOff", "spin", "spdMult", "xp"]);

  report(`tables match the shipped bundle (${DRIVERS.hats.length} hats, ${DRIVERS.accessories.length} accessories, ${DRIVERS.weapons.length} weapons, ${DRIVERS.items.length} items, ${DRIVERS.itemGroups.length} groups, ${Object.keys(DRIVERS.config).length} config keys)`, drift.length === 0);
  for (const d of drift) console.log("       " + d);
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */
console.log("game :", DRIVERS.source.index, "+", DRIVERS.source.vendor);
console.log("");

for (const target of TARGETS) {
  const src = fs.readFileSync(target, "utf8");
  console.log(path.relative(ROOT, target));
  checkTransport(src);
  checkTables(src);
  console.log("");
}

if (failures) {
  console.log(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log("OK - both mods speak the shipped protocol and carry the shipped tables.");
