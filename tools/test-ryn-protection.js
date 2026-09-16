#!/usr/bin/env node
//
// Tests for the bot-protection, exclusion, clan and formation work in
// Ryn_Type_2.user.js.
//
//   node tools/test-ryn-protection.js
//
// The userscript is one 40k-line IIFE that only runs inside the game page, so
// there is nothing to import. Instead each suite slices the block it is about
// straight out of the file and evaluates it against stubs for the handful of
// things it reaches outside itself. That means the code under test is the code
// that ships — not a copy that can drift from it — and a rename that breaks a
// slice fails loudly rather than silently testing nothing.
//
// The stubs are the game's own numbers, taken from drivers/game-drivers.json:
// gatherAngle, shieldAngle, weapon ranges, projectile ranges, player scale.

const fs = require("fs");
const path = require("path");

const SCRIPT = path.join(__dirname, "..", "Ryn_Type_2.user.js");
const source = fs.readFileSync(SCRIPT, "utf8");

function slice(startMarker, endMarker, label) {
  const a = source.indexOf(startMarker);
  if (a === -1) throw new Error(`could not find the start of ${label}: ${startMarker}`);
  const b = source.indexOf(endMarker, a);
  if (b === -1) throw new Error(`could not find the end of ${label}: ${endMarker}`);
  return source.slice(a, b);
}

// ── shared stubs ────────────────────────────────────────────────────────────
const PI2 = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const getAngleDist = (a, b) => { const p = Math.abs(b - a) % PI2; return p > Math.PI ? PI2 - p : p; };
const hyp = (a, b) => Math.sqrt(a * a + b * b);
const lineInRect = (x1, y1, x2, y2, ax, ay, bx, by) => {
  let minX = ax, maxX = bx; if (ax > bx) { minX = bx; maxX = ax; }
  if (maxX > x2) maxX = x2; if (minX < x1) minX = x1; if (minX > maxX) return false;
  let minY = ay, maxY = by; const dx = bx - ax;
  if (Math.abs(dx) > 1e-7) { const m = (by - ay) / dx, c = ay - m * ax; minY = m * minX + c; maxY = m * maxX + c; }
  if (minY > maxY) { const t = maxY; maxY = minY; minY = t; }
  if (maxY > y2) maxY = y2; if (minY < y1) minY = y1;
  return minY <= maxY;
};
const Config_default = { gatherAngle: 1.208304866765305, mapScale: 14400, shieldAngle: 1.0471975511965976 };
const Weapons = { 7: { range: 65 }, 9: { range: 1000, projectile: 0 }, 15: { range: 1400, projectile: 5 } };
const Projectiles = { 0: { range: 1000 }, 5: { range: 1400 } };
const DataHandler_default = { getWeapon: id => Weapons[id] || { range: 65 }, isShootable: id => id === 9 || id === 15 };
const SaveSettings = () => {};
let Settings_default = {};

let failures = 0;
const ok = (cond, msg) => { if (!cond) { console.log("  FAIL:", msg); failures++; } };
const note = msg => console.log("  ·", msg);

class V {
  constructor(x, y) { this.x = x; this.y = y; }
  distance(o) { return hyp(this.x - o.x, this.y - o.y); }
  distanceDefault(o) { const dx = this.x - o.x, dy = this.y - o.y; return dx * dx + dy * dy; }
  angle(o) { return Math.atan2(o.y - this.y, o.x - this.x); }
}

// ── suite 1: allegiance and the attack gate ─────────────────────────────────
function suiteAllegiance() {
  console.log("allegiance / safe aim");
  const code = slice("  const EXCLUDE_LIMIT = 200;", "  class PlayerManager {", "RynAllegiance + RynSafeAim");
  let RynAllegiance, RynSafeAim;
  eval(code.replace(/^\s*const RynAllegiance/m, "RynAllegiance").replace(/^\s*const RynSafeAim/m, "RynSafeAim"));

  Settings_default = { _excludedPlayers: [] };
  const mk = (id, x, y, opts = {}) => ({
    id, isPlayer: true, nickname: opts.name || ("p" + id),
    clanName: opts.clan === undefined ? null : opts.clan,
    scale: 35, hitScale: 63,
    pos: { current: new V(x, y), future: new V(x, y), previous: new V(x, y) },
    getItemByType: t => (opts.items ? opts.items[t] : null),
  });

  const owner = { clients: new Set(), clientIDList: new Set([2, 3]), myPlayer: { id: 1 } };
  const botA = { ownerClient: owner, myPlayer: mk(2, 100, 100) };
  const botB = { ownerClient: owner, myPlayer: mk(3, 160, 100) };
  owner.clients.add(botA); owner.clients.add(botB); owner.ownerClient = owner;

  ok(RynAllegiance.isFriendlyID(botA, 1), "the main player must read as friendly");
  ok(RynAllegiance.isFriendlyID(botA, 3), "a sibling bot must read as friendly");
  ok(!RynAllegiance.isFriendlyID(botA, 99), "a stranger must not read as friendly");
  const botC = { ownerClient: owner, myPlayer: mk(4, 200, 100) };
  owner.clients.add(botC); RynAllegiance.invalidate();
  ok(RynAllegiance.isFriendlyID(botA, 4), "a bot whose first tick has not landed is already friendly");
  note("friendly set");

  RynAllegiance.toggleExcluded(50, "cowboy28");
  ok(RynAllegiance.isExcludedID(50, "cowboy28"), "excluded by id");
  ok(RynAllegiance.isExcludedID(999, "cowboy28"), "still excluded after a respawn on a new sid");
  ok(!RynAllegiance.isExcludedID(51, "Enemy123"), "an unrelated player is not excluded");
  RynAllegiance.toggleExcluded(50);
  ok(!RynAllegiance.isExcludedID(999, "cowboy28"), "toggling off clears the name rule too");
  RynAllegiance.toggleExcluded(50, "cowboy28");
  note("exclusions");

  ok(!RynAllegiance.isVulnerableTo({ clanName: "GG" }, { clanName: "GG" }), "clan mates cannot damage each other");
  ok(RynAllegiance.isVulnerableTo({ clanName: "GG1" }, { clanName: "GG2" }), "separate tribes can");
  note("vulnerability");

  // The brief's case: an excluded player standing between a bot and an enemy.
  const me = mk(2, 0, 0, { items: { 0: 7, 1: 9 } });
  const excluded = mk(50, 60, 0, { name: "cowboy28" });
  const enemy = mk(60, 120, 0, { name: "Enemy123" });
  let TICK = 0;
  const c = {
    isOwner: false, myPlayer: me, ownerClient: owner,
    PlayerManager: { players: [me, excluded, enemy] },
    get _ModuleHandler() { return { tickCount: TICK }; },
  };
  const tick = () => { TICK++; };

  let shielded = RynSafeAim.shielded(c);
  ok(shielded.length === 1 && shielded[0].id === 50, "only the excluded player is shielded, not the enemy");
  ok(RynSafeAim.meleeBlocker(c, 0, 0, shielded) !== null, "a swing through an excluded player must be refused");
  ok(RynSafeAim.safeMeleeAngle(c, 0, 0, enemy) === null,
     "with the excluded player directly in line the swing is held, not nudged into them");

  excluded.pos.current = new V(40, 45); excluded.pos.future = excluded.pos.current; tick();
  const reaimed = RynSafeAim.safeMeleeAngle(c, 0, 0, enemy);
  ok(reaimed !== null, "with the excluded player off to one side a safe swing exists");
  ok(reaimed === null || RynSafeAim.meleeBlocker(c, reaimed, 0, RynSafeAim.shielded(c)) === null,
     "the re-aimed swing still sweeps someone protected");
  ok(reaimed === null || getAngleDist(reaimed, me.pos.current.angle(enemy.pos.current)) <= Config_default.gatherAngle,
     "the re-aimed swing no longer contains the enemy it was meant for");
  note("melee gate");

  excluded.pos.current = new V(60, 0); excluded.pos.future = excluded.pos.current; tick();
  ok(RynSafeAim.shotBlocker(c, 0, 1, 183, RynSafeAim.shielded(c)) !== null, "a shot through an excluded player is refused");
  excluded.pos.current = new V(400, 0); excluded.pos.future = excluded.pos.current; tick();
  ok(RynSafeAim.shotBlocker(c, 0, 1, 183, RynSafeAim.shielded(c)) === null,
     "someone well behind the target cannot be hit and must not block the shot");
  excluded.pos.current = new V(60, 200); excluded.pos.future = excluded.pos.current; tick();
  ok(RynSafeAim.shotBlocker(c, 0, 1, 1000, RynSafeAim.shielded(c)) === null, "a clear lane is not refused");
  note("shot gate");

  RynAllegiance.clear();
  const mate = mk(3, 60, 0);
  mate.clanName = "GG13"; me.clanName = "GG12";
  let TICK2 = 0;
  const c2 = {
    isOwner: false, myPlayer: me, ownerClient: owner,
    PlayerManager: { players: [me, mate, enemy] },
    get _ModuleHandler() { return { tickCount: TICK2 }; },
  };
  const s2 = RynSafeAim.shielded(c2);
  ok(s2.length === 1 && s2[0].id === 3, "a bot on its own tribe is shielded from my swing");
  ok(RynSafeAim.meleeBlocker(c2, 0, 0, s2) !== null, "a swing that would sweep my own bot is refused");
  mate.clanName = "GG12"; TICK2++;
  ok(RynSafeAim.shielded(c2).length === 0, "a clan mate needs no client-side dodge — the server already refuses it");
  note("friendly fire gate");
}

// ── suite 2: formation geometry ─────────────────────────────────────────────
function suiteFormations() {
  console.log("formations");
  const code = slice("  const RynFormations = new class {", "\n  };\n\n  class Movement {", "RynFormations") + "\n  };";
  let RynFormations;
  eval(code.replace(/^\s*const RynFormations/m, "RynFormations"));
  const ids = RynFormations.LIST.map(f => f.id);
  note(ids.join(", "));
  const OPTS = { spacing: 88, depth: 70, radius: 140 };

  // Rotation must be a pure rotation of the same local point, which is what
  // makes turning the formation rotate the shape without reordering the slots.
  for (const id of ids) {
    for (const n of [1, 2, 3, 5, 6, 7, 9, 12, 20]) {
      for (let slot = 0; slot < n; slot++) {
        const base = RynFormations.world(id, slot, n, 0, OPTS);
        for (const d of [0.4, 1.57, Math.PI, -2.2, 4.9]) {
          const rot = RynFormations.world(id, slot, n, d, OPTS);
          const ex = base.dx * Math.cos(d) - base.dy * Math.sin(d);
          const ey = base.dx * Math.sin(d) + base.dy * Math.cos(d);
          ok(Math.abs(rot.dx - ex) < 1e-9 && Math.abs(rot.dy - ey) < 1e-9,
             `${id} n=${n} slot=${slot}: turning the formation moved the slot`);
        }
      }
    }
  }
  note("rotation is a pure rotation");

  for (const id of ids) {
    const n = 5, before = [], after = [];
    for (let s = 0; s < n; s++) {
      before.push(RynFormations.world(id, s, n, 0, OPTS));
      after.push(RynFormations.world(id, s, n, Math.PI, OPTS));
    }
    for (let s = 0; s < n; s++) {
      ok(Math.abs(after[s].dx + before[s].dx) < 1e-9 && Math.abs(after[s].dy + before[s].dy) < 1e-9,
         `${id}: slot ${s} did not stay slot ${s} across a 180 degree turn`);
    }
  }
  note("slot identity holds across a 180 degree turn");

  for (const id of ids) {
    for (const n of [2, 3, 5, 7, 9, 12]) {
      const seen = [];
      for (let s = 0; s < n; s++) {
        const p = RynFormations.world(id, s, n, 0.7, OPTS);
        for (const q of seen) ok(hyp(p.dx - q.dx, p.dy - q.dy) >= 1, `${id} n=${n}: two slots on one spot`);
        seen.push(p);
      }
    }
  }
  note("no two slots share a position");

  for (const want of [40, 88, 200]) {
    const sp = RynFormations.spacingFor(want);
    ok(sp >= 72 && sp <= 104, `spacingFor(${want}) = ${sp} is outside the closed-line band`);
  }
  for (const n of [2, 3, 5, 8, 12, 20]) {
    const sp = RynFormations.spacingFor(88);
    const pts = [];
    for (let s = 0; s < n; s++) pts.push(RynFormations.world("wall", s, n, 1.1, { spacing: sp, depth: 70, radius: 140 }));
    for (let s = 1; s < n; s++) {
      const d = hyp(pts[s].dx - pts[s - 1].dx, pts[s].dy - pts[s - 1].dy);
      ok(d >= 70 && d <= 105, `wall n=${n}: a ${d.toFixed(1)} gap leaves a hole or shoves neighbours`);
    }
  }
  note("gap closing");

  const a = RynFormations.world("wedge", 2, 6, 0, { spacing: 80, depth: 70, radius: 140 });
  const b = RynFormations.world("wedge", 2, 6, 0, { spacing: 120, depth: 70, radius: 140 });
  ok(Math.abs(a.dx - b.dx) > 1e-9 || Math.abs(a.dy - b.dy) > 1e-9, "the cache ignored a spacing change");
  const tight = RynFormations.world("spearhead", 4, 6, 0, { spacing: 84, depth: 52, radius: 120 });
  const wide = RynFormations.world("spearhead", 4, 6, 0, { spacing: 100, depth: 140, radius: 240 });
  ok(hyp(tight.dx - wide.dx, tight.dy - wide.dy) > 20, "advance did not change the shape itself");
  note("cache keying, and advance changing geometry");
}

// ── suite 3: one tribe per bot ──────────────────────────────────────────────
function suiteClan() {
  console.log("individual clans");
  const helpers = slice("  const CLAN_NAME_MAX = 7;", "  // Drop everything and start the rotation over", "clan helpers");
  const cls = slice("  class ClanJoiner {", "  const ClanJoiner_default = ClanJoiner;", "ClanJoiner");
  let CLAN_ACTION_STATE, ClanJoiner, botClanBase, botClanCandidate, clanActionTurn;
  const RynAllegiance = { isFriendlyID: (c, id) => c.ownerClient.fleetIDs.has(id) };
  const window = { localStorage: { getItem: () => null } };
  eval((helpers + "\n" + cls)
    .replace(/^\s*const CLAN_ACTION_STATE/m, "CLAN_ACTION_STATE")
    .replace(/^\s*function botClanBase/m, "botClanBase = function botClanBase")
    .replace(/^\s*function botClanCandidate/m, "botClanCandidate = function botClanCandidate")
    .replace(/^\s*function clanActionTurn/m, "clanActionTurn = function clanActionTurn")
    .replace(/^\s*class ClanJoiner/m, "ClanJoiner = class ClanJoiner"));

  // A server that behaves the way the real one does: tribe names are unique
  // and capped at seven characters, a player already in a tribe cannot create
  // another, leaving deletes the tribe you own, and a join request from a
  // stranger is never answered.
  class Server {
    constructor() { this.tribes = new Map(); this.pending = []; this.packets = 0; }
    send(bot, type, name) {
      this.packets++;
      if (type === "L") {
        if (bot.myPlayer.clanName !== null) return;
        const n = String(name).slice(0, 7);
        if (this.tribes.has(n)) return;
        this.tribes.set(n, bot.myPlayer.id);
        this.pending.push(() => { bot.myPlayer.clanName = n; });
      } else if (type === "N") {
        for (const [k, v] of [...this.tribes]) if (v === bot.myPlayer.id) this.tribes.delete(k);
        this.pending.push(() => { bot.myPlayer.clanName = null; });
      }
    }
    flush() { const p = this.pending; this.pending = []; for (const f of p) f(); }
  }

  function fleet(n) {
    const server = new Server();
    const owner = { clients: new Set(), fleetIDs: new Set(), myPlayer: { id: 1, clanName: null } };
    owner.ownerClient = owner;
    const bots = [];
    for (let i = 1; i <= n; i++) {
      const bot = {
        id: i, ownerClient: owner,
        myPlayer: { id: 100 + i, inGame: true, clanName: null },
        PlayerManager: { clanData: server.tribes, clanExist: nm => server.tribes.has(nm) },
      };
      bot.PacketManager = {
        createClan: nm => server.send(bot, "L", nm),
        joinClan: nm => server.send(bot, "b", nm),
        leaveClan: () => server.send(bot, "N"),
      };
      bot.joiner = new ClanJoiner(bot);
      owner.clients.add(bot); owner.fleetIDs.add(100 + i); bots.push(bot);
    }
    return { server, owner, bots };
  }
  const spin = (server, bots, steps, from) => {
    let t = from; const real = Date.now;
    for (let s = 0; s < steps; s++) { t += 110; Date.now = () => t; for (const b of bots) b.joiner._individualClanTick(); server.flush(); }
    Date.now = real;
    return t;
  };

  Settings_default = { _botIndividualClans: true, _botClanPrefix: "", _botBulkName: "GG1", _botNameNumberStart: 1 };

  {
    const { server, bots } = fleet(5);
    spin(server, bots, 200, 1000);
    const names = bots.map(b => b.myPlayer.clanName);
    note("five bots -> " + names.join(", ") + ` (${server.packets} packets)`);
    ok(names.every(x => x !== null), "every bot ends up in a tribe");
    ok(new Set(names).size === 5, "every tribe is unique");
    ok(JSON.stringify(names) === JSON.stringify(["GG11", "GG12", "GG13", "GG14", "GG15"]),
       "names follow the fleet naming, GG11..GG15");
    ok(server.packets <= 12, `must not spam: ${server.packets} packets for five bots`);
  }
  {
    // The old code asked for the whole player name; anything over seven
    // characters could never come back equal and it looped forever.
    Settings_default._botBulkName = "SuperLongBotName";
    const { server, bots } = fleet(3);
    spin(server, bots, 200, 1000);
    const names = bots.map(b => b.myPlayer.clanName);
    note("long fleet name -> " + names.join(", ") + ` (${server.packets} packets)`);
    ok(names.every(x => x !== null && x.length <= 7), "tribe names fit the game's seven-character cap");
    ok(new Set(names).size === 3, "long names still produce unique tribes");
    ok(server.packets <= 8, `a long name must not loop: ${server.packets} packets`);
    Settings_default._botBulkName = "GG1";
  }
  {
    // joinClan against a stranger is a request they never accept, which is
    // what the old code sent every third tick for the life of the bot.
    const { server, bots } = fleet(2);
    server.tribes.set("GG11", 777);
    spin(server, bots, 200, 1000);
    const names = bots.map(b => b.myPlayer.clanName);
    note("contested name -> " + names.join(", ") + ` (${server.packets} packets)`);
    ok(names[0] !== null && names[0] !== "GG11", "the bot rotates to a free name rather than fighting for a taken one");
    ok(names[1] === "GG12", "the other bot is unaffected");
    ok(server.packets <= 10, `a contested name must not become a request loop: ${server.packets} packets`);
  }
  {
    const { server, bots } = fleet(3);
    let t = spin(server, bots, 80, 1000);
    bots[1].myPlayer.clanName = "OTHER";
    spin(server, bots, 120, t);
    note("after a desync -> " + bots.map(b => b.myPlayer.clanName).join(", "));
    ok(bots[1].myPlayer.clanName === "GG12", "a bot pulled into the wrong tribe recovers to its own");
  }
  {
    const { server, bots } = fleet(2);
    let t = spin(server, bots, 80, 1000);
    bots[0].myPlayer.inGame = false; bots[0].myPlayer.clanName = null;
    server.tribes.delete("GG11");
    t = spin(server, bots, 20, t);
    bots[0].myPlayer.inGame = true;
    spin(server, bots, 120, t);
    note("after a respawn -> " + bots.map(b => b.myPlayer.clanName).join(", "));
    ok(bots[0].myPlayer.clanName === "GG11", "a respawned bot retakes its own tribe");
  }
  {
    const { server, bots } = fleet(20);
    spin(server, bots, 400, 1000);
    const names = bots.map(b => b.myPlayer.clanName);
    note(`twenty bots -> ${names.filter(Boolean).length}/20 tribes, ${server.packets} packets`);
    ok(names.filter(Boolean).length === 20, "all twenty get a tribe");
    ok(new Set(names).size === 20, "all twenty tribes are unique");
    ok(server.packets <= 40, `packet budget blown: ${server.packets}`);
  }
}

// ── suite 4: the protection board ───────────────────────────────────────────
function suiteProtection() {
  console.log("bot protection");
  const code = slice("  const PROT_BOARD_MS = 110;", "\n  class BotProtection {", "RynProtect");
  let RYN_PROTECT_BOARDS, RynProtect, protNameStem, protBoard;
  const RynAllegiance = { isFriendlyID: () => false };
  Settings_default = { _botProtection: true, _botProtectionGuards: 5 };
  eval(code
    .replace(/^\s*const RYN_PROTECT_BOARDS/m, "RYN_PROTECT_BOARDS")
    .replace(/^\s*function protNameStem/m, "protNameStem = function protNameStem")
    .replace(/^\s*function protBoard/m, "protBoard = function protBoard")
    .replace(/^\s*const RynProtect/m, "RynProtect"));

  ok(protNameStem("cowboy28") === "cowboy", "cowboy28 stem");
  ok(protNameStem("Player28") === protNameStem("Player11"), "Player28 and Player11 share a stem");
  ok(protNameStem("ab1") === "", "a two-letter stem is too weak to count");
  note("name stems");

  const blank = () => ({
    at: 0, guards: [1, 2, 3, 4, 5], guardSlots: 5, wards: [], anchor: { x: 0, y: 0 }, wardDrift: null,
    enemies: [], track: new Map(), sectors: [], projectiles: [], incoming: [],
    grouped: false, groupSize: 0, rangedAt: 0, threatAt: 0,
  });
  const mkE = (id, x, y, o = {}) => ({
    player: { id, hitScale: 63, pos: { current: { x, y } } }, id, x, y,
    vx: o.vx || 0, vy: o.vy || 0, dist: hyp(x, y), angle: Math.atan2(y, x),
    stem: protNameStem(o.name || ("z" + id)), clan: o.clan || null,
    holdingRanged: !!o.ranged, ownsRanged: !!o.ranged,
  });

  let b = blank(); b.enemies = [mkE(1, 400, 0, { name: "Enemy123" })];
  RynProtect._cluster(b, 1000);
  ok(!b.grouped, "one player is not a group");
  ok(b.sectors.length === 1, "but is still a direction worth facing");

  b = blank(); b.enemies = [mkE(1, 400, 0, { name: "cowboy28" }), mkE(2, 470, 60, { name: "cowboy11" })];
  RynProtect._cluster(b, 1000);
  ok(b.grouped && b.groupSize === 2, "cowboy28 and cowboy11 standing together read as a group");

  b = blank(); b.enemies = [mkE(1, 400, 0, { name: "Kappa" }), mkE(2, 460, 40, { name: "Zorblat" })];
  RynProtect._cluster(b, 1000);
  ok(!b.grouped, "two unrelated players standing near each other must not read as a group");

  b = blank(); b.enemies = [mkE(1, 400, 0, { name: "cowboy28" }), mkE(2, -600, 500, { name: "cowboy11" })];
  RynProtect._cluster(b, 1000);
  ok(!b.grouped, "a shared name across the map is not a group");
  ok(b.sectors.length === 2, "two far-apart threats are two directions");

  b = blank();
  b.enemies = [mkE(1, 400, 0, { name: "Kappa", vx: 9, vy: 1 }), mkE(2, 470, 60, { name: "Zorblat", vx: 8, vy: 2 })];
  RynProtect._cluster(b, 1000);
  ok(b.grouped, "players walking together read as a group whatever they are called");

  b = blank();
  b.enemies = [mkE(1, 400, 0, { name: "Kappa", clan: "WOLF" }), mkE(2, 470, 60, { name: "Zorblat", clan: "WOLF" })];
  RynProtect._cluster(b, 1000);
  ok(b.grouped, "a shared tribe reads as a group");
  note("group detection: proximity plus one more signal, never a name alone");

  b = blank();
  b.enemies = [mkE(1, 500, 0, { name: "a1" }), mkE(2, 560, 40, { name: "a2" }),
               mkE(3, -500, 0, { name: "b1" }), mkE(4, -560, 40, { name: "b2" })];
  RynProtect._cluster(b, 1000);
  ok(b.sectors.length === 2, "two threat directions produce two sectors");
  const seen = new Set();
  for (const s of b.sectors) for (let i = s.from; i < s.from + s.count; i++) { ok(!seen.has(i), `slot ${i} assigned twice`); seen.add(i); }
  ok(seen.size === 5, "every guard slot is covered exactly once");
  ok(b.sectors[0].from === 0 && b.sectors[1].from === b.sectors[0].count, "sectors take contiguous runs of slots");

  b = blank();
  b.enemies = [mkE(1, 500, 0, { name: "a1" }), mkE(2, 560, 40, { name: "a2" }), mkE(3, 600, -40, { name: "a3" })];
  RynProtect._cluster(b, 1000);
  ok(b.sectors.length === 1 && b.sectors[0].count === 5, "one crowd is one sector and gets every guard");
  ok(getAngleDist(b.sectors[0].angle, 0) < 0.2, "the sector faces the crowd");
  note("sector split and collapse");

  b = blank();
  b.wards = [{ myPlayer: { scale: 35, pos: { current: { x: 600, y: 0 } } } }];
  b.projectiles = [{ x: 0, y: 0, angle: 0, speed: 1.6, range: 1000, damage: 25, at: 1000 }];
  RynProtect._prune(b, 1000);
  ok(b.incoming.length === 1, "an arrow on a line through a protected bot registers before it lands");
  b.projectiles = [{ x: 0, y: 300, angle: 0, speed: 1.6, range: 1000, damage: 25, at: 1000 }];
  RynProtect._prune(b, 1000);
  ok(b.incoming.length === 0, "an arrow that misses does not raise the shield");
  b.projectiles = [{ x: 0, y: 0, angle: 0, speed: 1.6, range: 1000, damage: 25, at: 1000 }];
  RynProtect._prune(b, 1700);
  ok(b.projectiles.length === 0, "a spent arrow leaves the board");
  note("projectile tracking");

  const owner = { clients: new Set(Array.from({ length: 20 }, (_, i) => i + 1)), getClientIndex: x => x - 1 };
  Settings_default._botProtectionGuards = 5;
  ok(RynProtect.guardCount(owner) === 5, "20 bots with guards=5 gives 5 guards");
  for (let i = 1; i <= 20; i++) ok(RynProtect.roleOf(owner, i).isGuard === (i <= 5), `bot ${i} guard state`);
  Settings_default._botProtectionGuards = 40;
  ok(RynProtect.guardCount(owner) === 20, "asking for more guards than bots puts every bot on guard");
  note("guard assignment");
}

for (const suite of [suiteAllegiance, suiteFormations, suiteClan, suiteProtection]) {
  suite();
}
console.log(failures === 0 ? "\nall suites passed" : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
