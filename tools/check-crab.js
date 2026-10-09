#!/usr/bin/env node
/*
 * check-crab.js
 *
 * The Crab King work in tools/tweaks.js (crabArena, crabMovement), checked
 * against the built script:
 *
 *   - the arena's ground, where building stops, and where the Flipper stays off;
 *   - the boss's warnings ("W") kept once however many connections hear them;
 *   - a bot under fire: hundreds of attacks the boss could announce, each one
 *     escapable in the time it gives, and the bot steered by the client's own
 *     BotCrabKing on a simulated clock — how many land;
 *   - what the bot does with nothing to dodge: close in, swing, hold off while
 *     the boss is under, shoot with a bow, take the gorge's mouth from outside;
 *   - that a build in the arena is refused by the client's own canPlace and
 *     place(), and that every piece is wired in (the W case, the eighth animal
 *     field, the menu switch, the bot mode).
 *
 * Simulated, no browser and no game: the pieces are sliced out and run in a
 * vm, or read as text where there is nothing to run.
 *
 *   node tools/check-crab.js [path/to/client.js]
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

/* From `start` through the bracket or `;` that closes it, on the masked source
 * so brackets inside strings and comments do not count. */
function through(start, stopAtSemicolon) {
  let depth = 0;
  for (let i = start; i < masked.length; i++) {
    const c = masked[i];
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) {
      depth--;
      if (!stopAtSemicolon && depth === 0) return client.slice(start, i + 1);
    } else if (stopAtSemicolon && c === ";" && depth === 0) return client.slice(start, i + 1);
  }
  throw new Error("unterminated at " + start);
}
function slice(name) {
  const start = client.indexOf("  const " + name + " = ");
  if (start === -1) throw new Error("not found in client: " + name);
  return through(start, true);
}
function sliceClass(name) {
  const start = client.indexOf("  class " + name + " {");
  if (start === -1) throw new Error("not found in client: class " + name);
  return through(start, false);
}
/* A method, `    name(args) {` … `}`, as a function expression. */
function method(head) {
  const start = client.indexOf("    " + head + " {");
  if (start === -1) throw new Error("not found in client: " + head);
  const body = through(start + 4 + head.length + 1, false);
  return "(function(" + head.slice(head.indexOf("(") + 1, head.lastIndexOf(")")) + ") " + body + ")";
}

const ok = [], problems = [];
const check = (what, pass, detail) => (pass ? ok : problems).push(pass ? what : what + " — " + detail);

let sandbox;
try {
  const clock = { now: 1e6 };
  sandbox = {
    Math, Number, Map, Infinity,
    Date: { now: () => clock.now },
    BOT_MODE: { CRAB: "crabKing" },
    DataHandler_default: { getWeapon: (id) => (id === 5 ? { range: 100 } : null) },
    __clock: clock,
  };
  vm.createContext(sandbox);
  vm.runInContext(
    [
      "RYN_CRAB_KING", "RYN_CRAB_POOLS", "RYN_CRAB_GORGE_X0", "RYN_CRAB_GORGE_HALF", "RYN_CRAB_MID_Y",
      "RYN_CRAB_WATERFALL", "RYN_CRAB_BODY", "RYN_CRAB_SEEN_MS", "RYN_CRAB_TICK_MS", "RYN_CRAB_BUILD_MARGIN",
      "RynCrab", "RYN_CRAB_PAD", "RYN_CRAB_LOOK_MS", "RYN_CRAB_SPEED", "RYN_CRAB_HOLD", "RYN_CRAB_RANGED",
      "RYN_CRAB_MOUTH",
    ].map(slice).join("\n") + "\n" + sliceClass("BotCrabKing") +
      "\nglobalThis.__t = { RynCrab, bot: new BotCrabKing(null) };",
    sandbox
  );
} catch (e) {
  problems.push("the Crab King code is not in this client — " + e.message);
}

if (sandbox && sandbox.__t) {
  const { RynCrab, bot } = sandbox.__t;
  const clock = sandbox.__clock;
  const reset = () => {
    RynCrab.boss = null;
    RynCrab.minions = new Map();
    RynCrab.warnings = [];
  };

  /* The arena. */
  {
    const P = (x, y) => ({ x, y });
    check("the pool and the gorge are where nothing is built",
      RynCrab.noBuild(P(-2500, 7200)) && RynCrab.noBuild(P(-800, 7300)) && RynCrab.noBuild(P(60, 7400)),
      "a build is allowed in the arena");
    check("the map is built on as before",
      !RynCrab.noBuild(P(5000, 3000)) && !RynCrab.noBuild(P(60, 9000)) && !RynCrab.noBuild(P(300, 7200)),
      "a build is refused outside the arena");
    check("the arena is west of the map's edge", RynCrab.inArena(P(-50, 7200)) && !RynCrab.inArena(P(50, 7200)),
      "inArena is wrong at the edge");
    check("its ground: pools and gorge walkable, rock not",
      RynCrab.edge(-2500, 7200) < 0 && RynCrab.edge(-800, 7200) <= 0 && RynCrab.edge(-800, 6000) > 0 && RynCrab.edge(100, 3000) <= 0,
      "edge() disagrees with the bundle's secretPool");
  }

  /* A warning heard by every connection is kept once. */
  {
    reset();
    for (let i = 0; i < 6; i++) RynCrab.noteWarning(3, -2500, 7200, 500, 1200, undefined, undefined);
    RynCrab.noteWarning(4, -2500, 7200, 200, 1200, -1500, 7200);
    check("one warning heard by six connections is kept once", RynCrab.active(clock.now).length === 2,
      RynCrab.warnings.length + " kept");
    clock.now += 1600;
    check("a warning is dropped once it has landed", RynCrab.active(clock.now).length === 0,
      RynCrab.warnings.length + " still kept");
  }

  /* A bot under fire. Each attack is placed somewhere around the bot and given
   * a lead it can be walked out of at a player's speed, with a quarter to
   * spare; the client's planner steers, one server tick at a time. */
  const V = 0.2, TICK = 1000 / 9;
  const rand = (() => {
    let s = 20261009;
    return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  })();
  const reach = (w) => (w.kind === 4 ? Math.max(w.r, 280) : w.r) + 35; // a hit: the player's radius inside
  const inside = (w, x, y) => RynCrab.depth(w, x, y, 35) > 0;
  const fire = (me, slot, warnings) => {
    for (const w of warnings) RynCrab.noteWarning(w.kind, w.x, w.y, w.r, w.ms, w.x2, w.y2);
    const kept = RynCrab.active(clock.now).slice();
    const end = Math.max(...kept.map((w) => w.end));
    while (clock.now < end) {
      const plan = bot._plan({ x: me.x, y: me.y, speed: V, reach: 100, ranged: false, slot }, clock.now);
      if (plan.move !== null) {
        me.x += Math.cos(plan.move) * V * TICK;
        me.y += Math.sin(plan.move) * V * TICK;
      }
      clock.now += TICK;
    }
    return kept.filter((w) => inside(w, me.x, me.y)).length;
  };
  const attack = (me) => {
    const kind = [1, 3, 4, 2][Math.floor(rand() * 4)];
    const a = rand() * Math.PI * 2, off = rand() * 260;
    const x = me.x + Math.cos(a) * off, y = me.y + Math.sin(a) * off;
    const w = { kind, x, y, r: 150 + rand() * 250, x2: undefined, y2: undefined };
    let need;
    if (kind === 4) {
      // A charge through (or past) the bot, 1400 long.
      const b = rand() * Math.PI * 2;
      w.x = x - Math.cos(b) * 700; w.y = y - Math.sin(b) * 700;
      w.x2 = x + Math.cos(b) * 700; w.y2 = y + Math.sin(b) * 700;
      need = reach(w) - Math.abs((me.x - w.x) * Math.sin(b) - (me.y - w.y) * Math.cos(b));
    } else {
      need = reach(w) - Math.hypot(me.x - x, me.y - y);
    }
    w.ms = Math.max(500, need / (0.75 * V)) + rand() * 300;
    return w;
  };

  {
    let hits = 0, threats = 0;
    for (let n = 0; n < 200; n++) {
      reset();
      // The boss in its own pool, the bot in the big one.
      RynCrab.noteAnimal(1, 11, -3300, 6750, 0, 4e5, 0);
      const me = { x: -2400 + rand() * 300, y: 7100 + rand() * 300 };
      const w = attack(me);
      if (inside(w, me.x, me.y)) threats++;
      hits += fire(me, 0, [w]);
    }
    check("200 attacks it could walk out of: none lands (" + threats + " started on the bot)", hits === 0,
      hits + " of 200 landed");
  }
  {
    let hits = 0;
    for (let n = 0; n < 100; n++) {
      reset();
      RynCrab.noteAnimal(1, 11, -3300, 6750, 0, 4e5, 0);
      const me = { x: -2400 + rand() * 300, y: 7100 + rand() * 300 };
      hits += fire(me, 0, [attack(me), attack(me)]);
    }
    check("100 pairs at once: at most one in ten lands (" + hits + " of 200)", hits <= 20, hits + " of 200 landed");
  }

  /* Nothing to dodge. */
  {
    const angle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    reset();
    clock.now += 1e4;
    RynCrab.noteAnimal(1, 11, -2500, 7200, 0, 4e5, 0);
    let plan = bot._plan({ x: -1500, y: 7200, speed: V, reach: 100, ranged: false, slot: 0 }, clock.now);
    check("far from the boss: walks to it", plan.move !== null && angle(plan.move, Math.PI) < Math.PI / 3 && plan.aim === null,
      JSON.stringify(plan));
    plan = bot._plan({ x: -2500 + 350, y: 7200, speed: V, reach: 100, ranged: false, slot: 0 }, clock.now);
    check("in its place and in reach: stands and swings", plan.move === null && plan.aim !== null && angle(plan.aim, Math.PI) < 0.01 && plan.weapon === 0,
      JSON.stringify(plan));
    plan = bot._plan({ x: -2500 + 350, y: 7200, speed: V, reach: 100, ranged: false, slot: Math.PI / 2 }, clock.now);
    check("the fleet spreads round it: another slot, another place",
      plan.move !== null && angle(plan.move, Math.PI / 2) < Math.PI / 2 + 0.01, JSON.stringify(plan));
    plan = bot._plan({ x: -2500 + 800, y: 7200, speed: V, reach: 100, ranged: true, slot: 0 }, clock.now);
    check("with a bow, shoots from out of melee reach", plan.aim !== null && plan.weapon === 1, JSON.stringify(plan));
    RynCrab.noteAnimal(1, 11, -2500, 7200, 0, 4e5, 2);
    plan = bot._plan({ x: -2500 + 350, y: 7200, speed: V, reach: 100, ranged: false, slot: 0 }, clock.now);
    check("while it is under: no swinging, and it backs off", plan.aim === null && plan.move !== null && angle(plan.move, 0) < Math.PI / 3,
      JSON.stringify(plan));
    RynCrab.noteAnimal(1, 11, -2500, 7200, 0, 4e5, 0);
    plan = bot._plan({ x: 300, y: 5200, speed: V, reach: 100, ranged: false, slot: 0 }, clock.now);
    const mouth = Math.atan2(7200 - 5200, 120 - 300);
    check("outside the arena: heads for the gorge's mouth, not into the rock", plan.move !== null && angle(plan.move, mouth) < Math.PI / 4,
      JSON.stringify(plan));
    RynCrab.noteAnimal(9, 13, -1950, 7200, 0, 500, 0);
    plan = bot._plan({ x: -1900 + 60, y: 7200, speed: V, reach: 100, ranged: false, slot: 0 }, clock.now);
    check("a crab in reach, the boss not: hits the crab", plan.aim !== null && angle(plan.aim, Math.PI) < 0.01,
      JSON.stringify(plan));
    // A whole tick of the module, on a bot in its place: one stop, not one per tick.
    {
      reset();
      RynCrab.noteAnimal(1, 11, -2500, 7200, 0, 4e5, 0);
      const sent = { move: 0, stop: 0, swing: 0 };
      const mh = {
        _rynMode: "crabKing", move_dir: 1,
        startMovement() { sent.move++; return true; }, stopMovement() { sent.stop++; },
      };
      const c = {
        isOwner: false, _ModuleHandler: mh,
        myPlayer: { inGame: true, speed: 0, pos: { current: { x: -2500 + 350, y: 7200 } }, getItemByType: (t) => (t === 0 ? 5 : null) },
      };
      c.ownerClient = { clientList: () => [c] };
      bot.client = c;
      bot.isStopped = false;
      for (let i = 0; i < 4; i++) {
        mh.shouldAttack = false;
        bot.postTick();
        if (mh.shouldAttack) sent.swing++;
      }
      check("a bot in its place sends one stop and swings every tick", sent.stop === 1 && sent.move === 0 && sent.swing === 4,
        JSON.stringify(sent));
      check("at the boss: marked close, so the Monkey Tail comes off", mh._rynCrabClose === true, "close is " + mh._rynCrabClose);
      c.myPlayer.pos.current = { x: -2500 + 1200, y: 7200 };
      bot.postTick();
      check("walking in from afar: not close, the tail may stay", mh._rynCrabClose === false, "close is " + mh._rynCrabClose);
    }
    clock.now += 9e3;
    check("a boss nobody has seen for a while is let go", RynCrab.bossNow(clock.now) === null, "still held");
  }

  /* The client's own canPlace and place(), in the arena and out of it. */
  {
    const canPlace = vm.runInContext(method("canPlace(type)"), sandbox);
    const me = (x, y) => ({
      pos: { current: { x, y } },
      getItemByType: () => 6, hasResourcesForType: () => true, hasItemCountForType: () => true,
    });
    check("canPlace: a spike in the arena is refused", canPlace.call(me(-1200, 7200), 4) === false, "allowed");
    check("canPlace: food in the arena is still eaten", canPlace.call(me(-1200, 7200), 2) === true, "refused");
    check("canPlace: a spike on the map is as before", canPlace.call(me(5000, 3000), 4) === true, "refused");
    const place = vm.runInContext(method("place(type, angle = this._currentAngle, reset = false)"), sandbox);
    let sent = 0;
    const mh = (x, y) => ({
      client: { myPlayer: { pos: { current: { x, y } } } },
      totalPlaces: 0, _notePlacement() {}, selectItem() { sent++; }, attack() {}, stopAttack() {},
      whichWeapon() {}, _getPredictWeapon() { return 0; },
    });
    place.call(mh(-1200, 7200), 4, 0);
    check("place(): nothing goes out in the arena", sent === 0, sent + " selects sent");
    place.call(mh(5000, 3000), 4, 0);
    check("place(): on the map it goes out as before", sent === 1, sent + " selects sent");
  }
}

/* Wiring, as text. */
{
  check("the W packet is read", /case "W":[\s\S]{0,200}RynCrab\.noteWarning\(temp\[1\], temp\[2\], temp\[3\], temp\[4\], temp\[5\], temp\[6\], temp\[7\]\)/.test(client),
    "no case for W");
  check("each animal's eighth field (the boss's state) is kept", /RynCrab\.noteAnimal\(sid, r\[1\], r\[2\], r\[3\], r\[4\], r\[5\], rows\[i \+ 7\]\)/.test(client),
    "_animals2024 does not pass rows[i + 7] on");
  for (const head of ["resendPlace(type, angle) {", "requestPlace(type, angle, owner) {", "requestPlaceMany(type, angles, owner) {"]) {
    check(head.slice(0, head.indexOf("(")) + "(): stops in the arena",
      client.includes("    " + head + "\n      if (type >= 3 && RynCrab.noBuild(this.client.myPlayer.pos.current)) return"),
      "no arena check at its top");
  }
  check("no Flipper in the arena", client.includes("const inRiver = !RynCrab.inArena(current) && (pointInRiver(current) || pointInRiver(future));"),
    "the biome hat still reads the gorge as river");
  const page = slice("Bots_default");
  const html = vm.runInNewContext("(" + page.slice(page.indexOf("=") + 1).replace(/;\s*$/, "") + ")");
  check("the Bots menu has Crabking movment", /Crabking movment[\s\S]{0,400}id="_botCrabKing" type="checkbox"/.test(html),
    "no switch in Bots_default");
  check("it is off until switched on", /\n\s*_botCrabKing: false,/.test(slice("defaultSettings")), "no default");
  check("no Monkey Tail at the boss: Blood Wings, the chosen one, or none",
    /getBestCurrentAcc\(\) \{[\s\S]{0,1200}if \(ModuleHandler\._rynMode === BOT_MODE\.CRAB && ModuleHandler\._rynCrabClose\) \{\s*if \(useBloodWings\) return 18;\s*if \(useActual && actual !== 11\) return actual;\s*return 0;\s*\}\s*if \(Settings_default\._tailPriority/.test(client),
    "DefaultAcc still picks the tail at the boss");
  check("the arbiter hands out the mode", client.includes("if (Settings_default._botCrabKing && RynCrab.bossNow(now) !== null) return BOT_MODE.CRAB;"),
    "BotArbiter never decides CRAB");
  check("the follow and roaming stand down for it", client.includes("|| m === BOT_MODE.GUARDING || m === BOT_MODE.CRAB;"),
    "_rynMovementOwned does not include CRAB");
  check("the module runs with the bot modules", client.includes("botCrabKing: new BotCrabKing(client2),") &&
    client.includes("this.staticModules.botScanMission, this.staticModules.botCrabKing, this.staticModules.botExplorer,"),
    "botCrabKing is not built or not run");
}

console.log("client :", path.relative(ROOT, CLIENT_PATH));
console.log("mode   : simulated (vm, fake clock; no browser, no game)\n");
for (const line of ok) console.log("  ok    " + line);
for (const line of problems) console.log("  FAIL  " + line);
if (problems.length) {
  console.log("\n" + problems.length + " problem(s).");
  process.exit(1);
}
console.log("\nOK - bots fight the Crab King and step out of what it announces; nothing is built and no Flipper worn in its arena.");
