#!/usr/bin/env node
// Runs the same situations through the game's own shared logic (tools/parity/game-shared.js,
// cut from the 12d386a8 bundle) and through the private server's (private-server/src), and
// compares them tick by tick: positions, speeds, health, what gets built, what gets hit.
//
//   node tools/server-parity.js [--verbose] [--quiet] [--only <text>]
//
// Also compared: every packet sent each tick, and what a new player owns. Generated
// situations cover every weapon at every tier, every hat and accessory, every building and
// every animal. The capes whose effect is only in the game's store text (and the Emerald
// lifesteal) are off for the comparison and checked against that text at the end.
//
//   --quiet: only what differs, and a count per group; --only <text>: just those situations,
//   with how each ended
//
// Both worlds get the same seeded randomness and a steady 1000/9 ms tick. Places where the
// private server is different on purpose (the Crab King's arena west of x = 0, the calm water
// at the west end of the river, Ryn's commands) are kept out of the situations.

const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const VERBOSE = process.argv.includes("--verbose");
// --quiet: print only what differs (and a count per group)
const QUIET = process.argv.includes("--quiet");
// --only <text>: run just the situations whose name has <text>, and show how each ended
const ONLY = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const TICK = 1000 / 9;

const game = require("./parity/game-shared.js");
// --server <dir> checks another copy of private-server/ (an older one, say)
const at = process.argv.indexOf("--server");
const SERVER = path.resolve(at > 0 ? process.argv[at + 1] : path.join(ROOT, "private-server"));
const srv = {
  config: require(path.join(SERVER, "src/config.js")),
  utils: require(path.join(SERVER, "src/utils.js")),
  items: require(path.join(SERVER, "src/items.js")),
  store: require(path.join(SERVER, "src/store.js")),
  Player: require(path.join(SERVER, "src/player.js")),
  AI: require(path.join(SERVER, "src/ai.js")),
  AiManager: require(path.join(SERVER, "src/aiManager.js")),
  GameObject: require(path.join(SERVER, "src/gameObject.js")),
  ObjectManager: require(path.join(SERVER, "src/objectManager.js")),
  Projectile: require(path.join(SERVER, "src/projectile.js")),
  ProjectileManager: require(path.join(SERVER, "src/projectileManager.js"))
};
srv.config.canHitObj = true;
// the capes and the Emerald lifesteal the game only describes are compared with the game
// switched off, and checked on their own at the end
srv.config.storeEffects = false;

// one seeded random for both worlds, reset before each run
const realRandom = Math.random;
const seed = s => {
  let a = s >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

function makeWorld(kind, opts = {}) {
  const isGame = kind === "game";
  const config = isGame ? Object.assign({}, game.config) : srv.config;
  const saved = isGame ? null : { inSandbox: config.inSandbox };
  if (opts.sandbox !== undefined) config.inSandbox = opts.sandbox;
  const utils = isGame ? game.utils : srv.utils;
  const items = isGame ? game.items : srv.items;
  const hats = isGame ? game.hats : srv.store.hats;
  const accessories = isGame ? game.accessories : srv.store.accessories;
  const players = [], ais = [], objects = [], projectiles = [];
  const sent = [];
  // the game's code sends (id, type, ...args); the server's sends (id, type, [args])
  const server = {
    send: (id, type, ...a) => sent.push([id, type, isGame ? a : a[0] || []]),
    sendAll: (type, a) => sent.push(["all", type, a]),
    broadcast: (type, ...a) => sent.push(["all", type, a])
  };
  const GO = isGame ? game.GameObject : srv.GameObject;
  const objectManager = new (isGame ? game.ObjectManager : srv.ObjectManager)(GO, objects, utils, config, players, server);
  const ProjectileCls = isGame ? game.Projectile : srv.Projectile;
  const projectileManager = new (isGame ? game.ProjectileManager : srv.ProjectileManager)(ProjectileCls, projectiles, players, ais, objectManager, items, config, utils, server);
  const scoreCallback = (p, amount) => {
    p.points += amount;
    p.earnXP(amount);
  };
  const aiManager = new (isGame ? game.AiManager : srv.AiManager)(ais, isGame ? game.AI : srv.AI, players, items, objectManager, config, utils, scoreCallback, server);
  const PlayerCls = isGame ? game.Player : srv.Player;
  const w = {
    kind, config, utils, items, hats, accessories, players, ais, objects, projectiles, sent, objectManager, projectileManager, aiManager,
    addPlayer(sid, x, y, setup) {
      const p = isGame ? new PlayerCls("p" + sid, sid, config, utils, projectileManager, objectManager, players, ais, items, hats, accessories, server, scoreCallback, () => {})
        : new PlayerCls("p" + sid, sid, config, utils, projectileManager, objectManager, players, ais, items, hats, accessories, server, scoreCallback, () => {}, "SANDBOX");
      players.push(p);
      p.spawn(1);
      p.setUserData({ name: "P" + sid, skin: 0 });
      p.x = x;
      p.y = y;
      p.sentTo = {};
      for (const q of players) {
        p.sentTo[q.id] = 1;
        q.sentTo[p.id] = 1;
      }
      if (setup) setup(p, w);
      return p;
    },
    hat: id => hats.find(h => h.id === id),
    acc: id => accessories.find(h => h.id === id),
    place(itemName, x, y, dir, owner) {
      const it = items.list.find(i => i.name === itemName);
      objectManager.add(objects.length, x, y, dir || 0, it.scale, it.type, it, false, owner);
      const o = objects[objects.length - 1];
      for (const q of players) o.sentTo[q.id] = 1;
      return o;
    },
    tick() {
      for (const p of players) p.update(TICK);
      for (const a of ais) a.update(TICK);
      for (const pr of projectiles) pr.update(TICK);
    },
    restore() {
      if (saved) Object.assign(config, saved);
    }
  };
  return w;
}

// what is compared each tick: the world, and every packet sent during the tick (the
// server's old packet names turned into the game's)
const snap = w => ({
  players: w.players.map(p => [p.x, p.y, p.xVel, p.yVel, p.health, p.alive ? 1 : 0, p.slowMult, p.reloads[p.weaponIndex] || 0, p.shameCount, p.lockMove ? 1 : 0, p.wood, p.food, p.stone, p.points, p.kills, p.XP, p.age, p.zIndex, (p.dmgOverTime && p.dmgOverTime.dmg) || 0, (p.dmgOverTime && p.dmgOverTime.time) || 0, p.noMovTimer]),
  ais: w.ais.map(a => [a.x, a.y, a.xVel, a.yVel, a.health, a.dir, a.alive ? 1 : 0, a.waitCount, a.moveCount, a.hitWait, a.spawnCounter || 0, a.runFrom ? 1 : 0, a.chargeTarget ? 1 : 0]),
  objects: w.objects.map(o => [o.active ? 1 : 0, o.health === undefined ? -1 : o.health, o.x, o.y]),
  projectiles: w.projectiles.map(p => [p.active ? 1 : 0, p.x, p.y, p.range]),
  sent: w.sent.map(([id, type, a]) => [id, w.kind === "game" ? type : srv.utils.OldToNew(type, "RECEIVE"), ...(a || [])])
});
const close = (a, b) => a === b || Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
// the first place two values differ, or null
const differ = (a, b, at = "") => {
  if (typeof a === "number" && typeof b === "number") return close(a, b) ? null : { at, game: a, server: b };
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return { at, game: "length " + a.length, server: "length " + b.length };
    for (let i = 0; i < a.length; i++) {
      const d = differ(a[i], b[i], at + "[" + i + "]");
      if (d) return d;
    }
    return null;
  }
  return a === b ? null : { at, game: a, server: b };
};

const results = [];
function scenario(name, ticks, setup, opts = {}) {
  if (ONLY && !name.includes(ONLY)) return;
  const run = kind => {
    seed(opts.seed || 1234);
    const w = makeWorld(kind, opts);
    try {
      setup(w);
      const frames = [];
      for (let t = 0; t < ticks; t++) {
        w.sent.length = 0;
        if (opts.each) opts.each(w, t);
        w.tick();
        frames.push(snap(w));
      }
      return { frames, w };
    } finally {
      w.restore();
      Math.random = realRandom;
    }
  };
  const g = run("game");
  const s = run("server");
  let first = null;
  for (let t = 0; t < ticks && !first; t++) {
    for (const part of [ "players", "ais", "objects", "projectiles", "sent" ]) {
      const d = differ(g.frames[t][part], s.frames[t][part]);
      if (d) {
        first = Object.assign({ t, part }, d);
        break;
      }
    }
  }
  const ok = !first;
  results.push({ name, ok, first });
  if (!ok || !QUIET) console.log((ok ? "  same  " : "  DIFF  ") + name + (ok ? "" : "  — tick " + first.t + " " + first.part + first.at + ": game " + JSON.stringify(first.game) + ", server " + JSON.stringify(first.server)));
  if (VERBOSE && !ok) console.log("    game:   ", JSON.stringify(g.frames[first.t][first.part]), "\n    server: ", JSON.stringify(s.frames[first.t][first.part]));
  if (ONLY) {
    const last = s.frames[ticks - 1];
    const types = {};
    for (const f of s.frames) for (const m of f.sent) types[m[1]] = (types[m[1]] || 0) + 1;
    const round = a => a.map(r => r.map(v => typeof v === "number" ? Math.round(v * 100) / 100 : v));
    console.log("    players:", JSON.stringify(round(last.players)), "\n    animals:", JSON.stringify(round(last.ais)), "\n    objects:", JSON.stringify(round(last.objects)), "\n    packets:", JSON.stringify(types));
  }
  return { g, s };
}
function check(name, fn) {
  if (ONLY && !name.includes(ONLY)) return;
  const g = fn("game"), s = fn("server");
  const ok = JSON.stringify(g) === JSON.stringify(s);
  results.push({ name, ok });
  if (!ok || !QUIET) console.log((ok ? "  same  " : "  DIFF  ") + name + (ok ? "" : "\n    game:   " + JSON.stringify(g) + "\n    server: " + JSON.stringify(s)));
}
// a group heading; with --quiet, how many of the group's checks matched
let group = null;
const heading = title => {
  if (group && QUIET) console.log(group.title + ": " + results.slice(group.from).filter(r => r.ok).length + "/" + (results.length - group.from) + " same");
  group = title ? { title, from: results.length } : null;
  if (title && !QUIET) console.log(title);
};

heading("Movement");
scenario("walk east for 3s, then let go (speed, deceleration, stopping)", 60, w => {
  const p = w.addPlayer(1, 5000, 5000);
  p.moveDir = 0;
}, { each: (w, t) => t === 27 && (w.players[0].moveDir = undefined) });
scenario("walk diagonally in the snow, soldier helmet, polearm", 40, w => {
  w.addPlayer(1, 5000, 1200, p => {
    p.skin = w.hat(6);
    p.skinIndex = 6;
    p.weapons = [ 5 ];
    p.weaponIndex = 5;
    p.moveDir = Math.PI / 4;
  });
});
scenario("winter cap in the snow, holding a wall (build slows you)", 30, w => {
  w.addPlayer(1, 5000, 1200, p => {
    p.skin = w.hat(15);
    p.buildIndex = 3;
    p.moveDir = -2.2;
  });
});
scenario("river: swim north against the current, then with the flipper hat", 50, w => {
  w.addPlayer(1, 5000, 7300, p => p.moveDir = -Math.PI / 2);
  w.addPlayer(2, 9000, 7300, p => {
    p.skin = w.hat(31);
    p.moveDir = -Math.PI / 2;
  });
});
scenario("two players walk into each other", 30, w => {
  w.addPlayer(1, 5000, 5000, p => p.moveDir = 0);
  w.addPlayer(2, 5100, 5010, p => p.moveDir = Math.PI);
});
scenario("the map edge", 30, w => w.addPlayer(1, 14300, 200, p => p.moveDir = -Math.PI / 4));

heading("Buildings");
scenario("knocked fast into an enemy spike (once per tick, push back)", 20, w => {
  const enemy = w.addPlayer(2, 9000, 9000);
  w.place("spikes", 5400, 5000, 0, enemy);
  w.addPlayer(1, 5000, 5000, p => p.xVel = 4.2);
});
scenario("run over a boost pad at speed", 25, w => {
  const me = w.addPlayer(1, 5000, 5000, p => {
    p.moveDir = 0;
    p.xVel = 3.5;
  });
  w.place("boost pad", 5300, 5000, 0, me);
});
scenario("step into an enemy pit trap", 20, w => {
  const enemy = w.addPlayer(2, 9000, 9000);
  w.place("pit trap", 5200, 5000, 0, enemy);
  w.addPlayer(1, 5000, 5000, p => p.moveDir = 0);
});
scenario("walk into a wall and slide along it", 30, w => {
  w.place("wood wall", 5200, 5000, 0, null);
  w.addPlayer(1, 5000, 4980, p => p.moveDir = 0.15);
});

heading("Combat");
const facing = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
scenario("katana (gold) hits a bull-helmet player, who wears spike gear back (reflect)", 40, w => {
  const b = w.addPlayer(2, 5090, 5000, p => {
    p.skin = w.hat(11);
    p.skinIndex = 11;
  });
  w.addPlayer(1, 5000, 5000, p => {
    p.skin = w.hat(7);
    p.weapons = [ 4 ];
    p.weaponIndex = 4;
    p.weaponXP[4] = 3500;
    p.dir = facing(p, b);
    p.mouseState = 1;
    p.gathering = 1;
  });
});
scenario("polearm (ruby, poison) against a wooden shield, front then back", 40, w => {
  const b = w.addPlayer(2, 5120, 5000, p => {
    p.weapons = [ 0, 11 ];
    p.weaponIndex = 11;
    p.dir = Math.PI;
  });
  w.addPlayer(1, 5000, 5000, p => {
    p.weapons = [ 5 ];
    p.weaponIndex = 5;
    p.weaponXP[5] = 12000;
    p.dir = facing(p, b);
    p.mouseState = 1;
    p.gathering = 1;
  });
}, { each: (w, t) => t === 20 && (w.players[0].dir = 0) });
scenario("musket shot across 600, then a bow volley", 40, w => {
  const b = w.addPlayer(2, 5600, 5000);
  w.addPlayer(1, 5000, 5000, p => {
    p.weapons = [ 5, 15 ];
    p.weaponIndex = 15;
    p.dir = facing(p, b);
    p.mouseState = 1;
    p.gathering = 1;
    p.stone = 1e5;
    p.wood = 1e5;
  });
}, { each: (w, t) => t === 20 && (w.players[1].weaponIndex = 9, w.players[1].weapons = [ 5, 9 ]) });
scenario("hammer on a tree, a stone and an enemy wall (resources, XP, wall breaks)", 60, w => {
  w.objectManager.add(w.objects.length, 5150, 5000, 0, 150, 0, null, true, null);
  const enemy = w.addPlayer(2, 9000, 9000);
  w.place("wood wall", 5000, 4880, 0, enemy);
  w.addPlayer(1, 5000, 5000, p => {
    p.weapons = [ 0, 10 ];
    p.weaponIndex = 10;
    p.dir = 0;
    p.mouseState = 1;
    p.gathering = 1;
  });
}, { each: (w, t) => t === 30 && (w.players[1].dir = -Math.PI / 2) });
scenario("eat right after being hit (shame) and out of shame", 30, w => {
  const a = w.addPlayer(1, 5000, 5000);
  a.health = 40;
}, { each: (w, t) => {
  const p = w.players[0];
  if (t % 3 === 0) {
    p.changeHealth(-10, null);
    p.hitTime = Date.now() - (t < 18 ? 50 : 500);
    p.buildItem(w.items.list[0]);
  }
} });

heading("Animals");
scenario("a wolf finds a player and charges", 140, w => {
  w.addPlayer(1, 5000, 5000);
  w.aiManager.spawn(5500, 5050, 0, 4);
}, { seed: 7 });
scenario("cows wander, one swims", 160, w => {
  w.addPlayer(1, 3000, 3000);
  w.aiManager.spawn(5000, 5000, 1, 0);
  w.aiManager.spawn(6000, 7200, 2, 0);
}, { seed: 99 });
scenario("a player hits a pig, which runs; a bull charges back", 90, w => {
  w.aiManager.spawn(5110, 5000, 0, 1);
  w.aiManager.spawn(4800, 5200, 0, 2);
  w.addPlayer(1, 5000, 5000, p => {
    p.weapons = [ 3 ];
    p.weaponIndex = 3;
    p.dir = 0;
    p.mouseState = 1;
    p.gathering = 1;
  });
}, { seed: 3 });

heading("Rules");
check("sandbox building caps (walls, spikes, mills, mine, turret)", kind => {
  seed(5);
  const w = makeWorld(kind, { sandbox: true });
  try {
    const p = w.addPlayer(1, 5000, 5000);
    return [ "wood wall", "spikes", "windmill", "mine", "turret", "teleporter" ].map(name => {
      const it = w.items.list.find(i => i.name === name);
      return [ 0, 30, 98, 99, 298, 299, 300 ].map(n => {
        p.itemCounts[it.group.id] = n;
        return p.canBuild(it) ? 1 : 0;
      }).join("");
    });
  } finally {
    w.restore();
    Math.random = realRandom;
  }
});
check("building caps and costs outside sandbox", kind => {
  const w = makeWorld(kind, { sandbox: false });
  try {
    const p = w.addPlayer(1, 5000, 5000);
    p.wood = 1e4;
    p.stone = 1e4;
    p.food = 1e4;
    return [ "spikes", "mine", "turret" ].map(name => {
      const it = w.items.list.find(i => i.name === name);
      return [ 0, 1, 2, 14, 15 ].map(n => {
        p.itemCounts[it.group.id] = n;
        return p.canBuild(it) ? 1 : 0;
      }).join("");
    });
  } finally {
    w.restore();
  }
});
check("player names (the game's filter)", kind => {
  const w = makeWorld(kind);
  try {
    return [ "Ryn 123", "class act", "Diesel", "mini me", "Sid", "Tester", "k1ll", "  ", "a_b-c (x)", "hello!!", "ÄÖÜ abc", "x".repeat(30) ].map(n => {
      const p = w.addPlayer(9, 0, 0);
      p.setUserData({ name: n, skin: 3 });
      w.players.pop();
      return p.name + "/" + p.skinColor;
    });
  } finally {
    w.restore();
  }
});
check("health sent to others (exact, as the game sends it)", kind => {
  const w = makeWorld(kind);
  try {
    const a = w.addPlayer(1, 5000, 5000);
    w.addPlayer(2, 5100, 5000);
    a.skin = w.hat(6);
    w.sent.length = 0;
    a.changeHealth(-14.4, null);
    const h = w.sent.find(m => m[1] === "O" || m[1] === "h");
    return h ? h[2][1] : null;
  } finally {
    w.restore();
  }
});

check("what a new player owns and holds", kind => {
  const w = makeWorld(kind);
  try {
    const p = w.addPlayer(1, 5000, 5000);
    return { hats: Object.keys(p.skins).map(Number).sort((a, b) => a - b), accessories: Object.keys(p.tails).map(Number).sort((a, b) => a - b), items: p.items, weapons: p.weapons, res: [ p.wood, p.food, p.stone, p.points ], age: [ p.age, p.XP, p.maxXP, p.upgrAge, p.upgradePoints ] };
  } finally {
    w.restore();
  }
});

// ---- generated: every weapon, tier, hat, accessory, building and animal ----
const weapons = game.items.weapons;
const TIERS = game.config.weaponVariants.map(v => v.xp);
const armed = (p, id, xp, dir) => {
  const wpn = weapons[id];
  p.weapons = wpn.type ? [ 0, id ] : [ id ];
  p.weaponIndex = id;
  p.weaponXP[id] = xp || 0;
  p.dir = dir || 0;
  p.mouseState = 1;
  p.gathering = 1;
  p.wood = p.stone = p.food = 1e5;
  p.points = 1e5;
};
// how far away a target of this scale can stand and still be hit
const reach = (wpn, scale) => wpn.projectile !== undefined ? 450 : (wpn.range || 60) + scale * 1.8 - 6;

heading("Every weapon at every tier, on a player");
for (const wpn of weapons) {
  for (const xp of TIERS) {
    scenario(wpn.name + " (" + xp + " xp) on a player", 30, w => {
      w.addPlayer(2, 5000 + reach(wpn, 35), 5000, p => p.dir = Math.PI);
      w.addPlayer(1, 5000, 5000, p => armed(p, wpn.id, xp));
    });
  }
}

heading("Every weapon on animals and on the world");
for (const wpn of weapons) {
  for (const xp of [ 0, TIERS[3] ]) {
    scenario(wpn.name + " (" + xp + " xp) on a cow, then a bull", 50, w => {
      w.aiManager.spawn(5000 + reach(wpn, 72), 5000, 0, 0);
      w.aiManager.spawn(5000, 5000 - reach(wpn, 78), 0, 2);
      w.addPlayer(1, 5000, 5000, p => armed(p, wpn.id, xp));
    }, { seed: wpn.id + 11, each: (w, t) => t === 25 && (w.players[0].dir = -Math.PI / 2) });
    scenario(wpn.name + " (" + xp + " xp) on a tree, bush, rock, gold, and an enemy wall", 60, w => {
      const kinds = [ [ 0, 150 ], [ 1, 80 ], [ 2, 90 ], [ 3, 90 ] ];
      kinds.forEach(([ type, scale ], i) => {
        const a = i * Math.PI / 4 - Math.PI / 2;
        const r = wpn.projectile !== undefined ? 400 : (wpn.range || 60) + scale - 5;
        w.objectManager.add(w.objects.length, 5000 + r * Math.cos(a), 5000 + r * Math.sin(a), 0, scale, type, null, true, null);
      });
      const enemy = w.addPlayer(2, 9000, 9000);
      w.place("stone wall", 5000 - (wpn.projectile !== undefined ? 300 : (wpn.range || 60) + 45), 5000, 0, enemy);
      w.addPlayer(1, 5000, 5000, p => armed(p, wpn.id, xp, -Math.PI / 2));
    }, { each: (w, t) => t % 12 === 0 && (w.players[1].dir = [ -Math.PI / 2, -Math.PI / 4, 0, Math.PI / 4, Math.PI ][t / 12]) });
  }
}

const gear = (p, w, hat, acc) => {
  if (hat !== undefined) {
    p.skin = w.hat(hat) || null;
    p.skinIndex = hat;
  }
  if (acc !== undefined) {
    p.tail = w.acc(acc) || null;
    p.tailIndex = acc;
  }
};
for (const [ title, list, isAcc ] of [ [ "Every hat", game.hats, false ], [ "Every accessory", game.accessories, true ] ]) {
  heading(title + ": walking, snow, river, fighting, gathering");
  for (const it of list) {
    const put = (p, w) => isAcc ? gear(p, w, undefined, it.id) : gear(p, w, it.id);
    scenario(it.name + " (" + it.id + "): walk in the snow, out of it, then into the river", 90, w => {
      w.addPlayer(1, 5000, 2200, p => {
        put(p, w);
        p.moveDir = Math.PI / 2;
      });
    }, { each: (w, t) => t === 45 && (w.players[0].y = 6700) });
    scenario(it.name + " (" + it.id + "): polearm vs katana, both wearing it", 60, w => {
      const b = w.addPlayer(2, 5130, 5000, p => {
        put(p, w);
        armed(p, 4, 12000, Math.PI);
      });
      w.addPlayer(1, 5000, 5000, p => {
        put(p, w);
        armed(p, 5, 7000, 0);
      });
    });
    scenario(it.name + " (" + it.id + "): shot by a musket and a crossbow", 50, w => {
      w.addPlayer(2, 5500, 5000, p => put(p, w));
      w.addPlayer(1, 5000, 5000, p => armed(p, 15, 0, 0));
    }, { each: (w, t) => t === 20 && (armed(w.players[1], 12, 0, 0)) });
    scenario(it.name + " (" + it.id + "): hammer on a tree, a rock and gold", 60, w => {
      w.objectManager.add(w.objects.length, 5000, 4880, 0, 150, 0, null, true, null);
      w.objectManager.add(w.objects.length, 5130, 5000, 0, 90, 2, null, true, null);
      w.objectManager.add(w.objects.length, 5000, 5130, 0, 90, 3, null, true, null);
      w.addPlayer(1, 5000, 5000, p => {
        put(p, w);
        armed(p, 10, 3000, -Math.PI / 2);
      });
    }, { each: (w, t) => t % 20 === 0 && (w.players[0].dir = [ -Math.PI / 2, 0, Math.PI / 2 ][t / 20]) });
  }
}

heading("Every building: walked into, stood on, its owner and an enemy");
for (const it of game.items.list) {
  if (it.consume) continue;
  for (const owned of [ false, true ]) {
    scenario(it.name + (owned ? " (own)" : " (enemy)") + ": walked into", 40, w => {
      const enemy = w.addPlayer(2, 9000, 9000);
      const me = w.addPlayer(1, 5000, 5000, p => p.moveDir = 0);
      w.place(it.name, 5000 + 35 + it.scale + 30, 5000, 0, owned ? me : enemy);
    });
    scenario(it.name + (owned ? " (own)" : " (enemy)") + ": stood on, shot at, hit", 40, w => {
      const enemy = w.addPlayer(2, 5600, 5000, p => armed(p, 9, 0, Math.PI));
      const me = w.addPlayer(1, 5000, 5000, p => p.health = 60);
      w.place(it.name, 5000, 5000, 0, owned ? me : enemy);
      w.aiManager.spawn(5000, 4700, Math.PI / 2, 4);
    }, { seed: it.id + 40 });
  }
}

heading("Every animal: near a player, and attacked");
const animalTypes = game.config && new game.AiManager([], game.AI, [], game.items, null, game.config, game.utils, () => {}, null).aiTypes;
for (const type of animalTypes) {
  // the Crab King's behaviour is ours (see the README); its crabs are kept to the arena,
  // so here they run with the arena walls off, like the game's
  if (type.id === 11) continue;
  const free = (w, a) => {
    if (w.kind === "server") a.arena = false;
  };
  scenario(type.src + " " + (type.name || "") + " (" + type.id + ") near a still player", 220, w => {
    w.addPlayer(1, 5000, 5000);
    free(w, w.aiManager.spawn(5450, 5050, Math.PI, type.id));
  }, { seed: 100 + type.id });
  scenario(type.src + " " + (type.name || "") + " (" + type.id + ") hit by a polearm, walls around", 220, w => {
    const enemy = w.addPlayer(2, 9000, 9000);
    for (let i = 0; i < 6; i++) w.place("wood wall", 5000 + 260 * Math.cos(i), 5000 + 260 * Math.sin(i), 0, enemy);
    w.place("pit trap", 5000 + 170, 5000 + 80, 0, enemy);
    w.addPlayer(1, 5000, 5000, p => armed(p, 5, 12000, 0));
    free(w, w.aiManager.spawn(5000 + reach(weapons[5], type.scale), 5000, Math.PI, type.id));
  }, { seed: 200 + type.id, each: (w, t) => {
    const a = w.ais[0], p = w.players[1];
    if (a && p.alive) p.dir = Math.atan2(a.y - p.y, a.x - p.x);
  } });
  if (type.spawnDelay && type.spawnDelay <= 6e4) {
    scenario(type.src + " " + (type.name || "") + " (" + type.id + ") killed, comes back after its delay", Math.ceil(type.spawnDelay / TICK) + 30, w => {
      w.addPlayer(1, 5000, 5000, p => armed(p, 5, 30000, 0));
      const a = w.aiManager.spawn(5000 + reach(weapons[5], type.scale), 5000, Math.PI, type.id);
      free(w, a);
      a.health = 30;
    }, { seed: 300 + type.id });
  }
}

// ---- the server alone: what the game only describes, measured against its text ----
heading("Store effects (server only, against the store text)");
const effect = (name, fn) => {
  if (ONLY && !name.includes(ONLY)) return;
  srv.config.storeEffects = true;
  seed(9);
  let res;
  try {
    res = fn();
  } catch (e) {
    res = { ok: false, why: String(e && e.stack) };
  } finally {
    srv.config.storeEffects = false;
    Math.random = realRandom;
  }
  results.push({ name, ok: res.ok });
  if (!res.ok || !QUIET) console.log((res.ok ? "  ok    " : "  FAIL  ") + name + "  — " + res.why);
};
const near = (a, b) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));
const fmt = n => Math.round(n * 10000) / 10000;
const sworld = () => makeWorld("server");
const wearAcc = (w, p, id) => {
  p.tail = w.acc(id) || null;
  p.tailIndex = id;
};
// speed after a second of walking east
const walked = (acc, y, extra) => {
  const w = sworld();
  const p = w.addPlayer(1, 5000, y, p => {
    if (acc) wearAcc(w, p, acc);
    p.moveDir = 0;
    if (extra) extra(p);
  });
  for (let t = 0; t < 9; t++) w.tick();
  return p.xVel;
};
// a polearm hit from 1 on 2: what 2 lost, and the world for more
const struck = (setA, setB) => {
  const w = sworld();
  const b = w.addPlayer(2, 5100, 5000, p => setB && setB(p, w));
  const a = w.addPlayer(1, 5000, 5000, p => {
    armed(p, 5, 0, 0);
    if (setA) setA(p, w);
  });
  const before = b.health;
  w.tick();
  return { w, a, b, lost: before - b.health };
};
// put b back in front of a at full health, and wait for a's next hit on it
const ticksUntilHit = (w, b, a) => {
  if (a) {
    b.health = 100;
    b.x = a.x + 100 * Math.cos(a.dir);
    b.y = a.y + 100 * Math.sin(a.dir);
    b.xVel = b.yVel = 0;
  }
  const h = b.health;
  for (let t = 0; t < 40; t++) {
    w.tick();
    if (b.health !== h) return h - b.health;
  }
  return 0;
};
effect("Dash Cape: 5% faster", () => {
  const r = walked(5, 5000) / walked(0, 5000);
  return { ok: near(r, 1.05), why: "speed x" + fmt(r) };
});
effect("Winter Cape: no snow slowdown", () => {
  const r = walked(6, 1500) / walked(0, 1500), out = walked(6, 5000) / walked(0, 5000);
  return { ok: near(r, 1 / 0.75) && near(out, 1), why: "in the snow x" + fmt(r) + ", out of it x" + fmt(out) };
});
effect("Snowball: half the snow slowdown", () => {
  const r = walked(12, 1500) / walked(0, 1500);
  return { ok: near(r, 0.875 / 0.75), why: "in the snow x" + fmt(r) + " (0.875 instead of 0.75)" };
});
effect("Super Cape: after a kill, 5% more damage and 15% faster for 10s", () => {
  const { w, a, b } = struck(p => wearAcc(sworld(), p, 1), p => p.health = 10);
  const c = w.addPlayer(3, 5000, 5100);
  a.dir = Math.PI / 2;
  const dmg = ticksUntilHit(w, c, a);
  const buffed = a.capeSuper > 0;
  a.mouseState = a.gathering = 0;
  for (let t = 0; t < 95; t++) w.tick();
  a.mouseState = a.gathering = 1;
  const later = ticksUntilHit(w, c, a);
  const fast = walked(1, 5000, p => p.capeSuper = 5000) / walked(1, 5000);
  return { ok: !b.alive && buffed && near(dmg, 45 * 1.05) && near(later, 45) && near(fast, 1.15), why: "after the kill a hit did " + fmt(dmg) + ", 10s later " + fmt(later) + "; speed x" + fmt(fast) };
});
effect("Dragon Cape: 5% more damage for 5s after hitting a player", () => {
  const { w, a, b, lost } = struck(p => p.tail = null);
  wearAcc(w, a, 2);
  const first = ticksUntilHit(w, b, a);
  const second = ticksUntilHit(w, b, a);
  a.mouseState = a.gathering = 0;
  for (let t = 0; t < 50; t++) w.tick();
  a.mouseState = a.gathering = 1;
  const rested = ticksUntilHit(w, b, a);
  return { ok: near(lost, 45) && near(first, 45) && near(second, 45 * 1.05) && near(rested, 45), why: "hits: " + [ first, second ].map(fmt).join(", ") + ", after 5s without hitting " + fmt(rested) };
});
for (const [ id, name, type, scale, res ] of [ [ 9, "Tree Cape", 0, 150, "wood" ], [ 3, "Cookie Cape", 1, 80, "food" ], [ 10, "Stone Cape", 2, 90, "stone" ] ]) {
  effect(name + ": 1 extra " + res + " per hit", () => {
    const got = acc => {
      const w = sworld();
      w.objectManager.add(w.objects.length, 5000 + 60 + scale, 5000, 0, scale, type, null, true, null);
      const p = w.addPlayer(1, 5000, 5000, p => {
        armed(p, 0, 0, 0);
        p[res] = 0;
        if (acc) wearAcc(w, p, acc);
      });
      w.tick();
      return p[res];
    };
    return { ok: got(id) === got(0) + 1, why: got(0) + " -> " + got(id) + " " + res + " per hit" };
  });
}
effect("Cow Cape: 1.5x gold and food from cows", () => {
  const kill = (acc, type) => {
    const w = sworld();
    const p = w.addPlayer(1, 5000, 5000, p => {
      armed(p, 5, 0, 0);
      p.points = p.food = 0;
      if (acc) wearAcc(w, p, acc);
    });
    w.aiManager.spawn(5150, 5000, 0, type).health = 1;
    w.tick();
    return [ p.points, p.food ];
  };
  const cow = kill(8, 0), plain = kill(0, 0), pig = kill(8, 1);
  return { ok: cow[0] === plain[0] * 1.5 && cow[1] === plain[1] * 1.5 && pig[0] === 200 && pig[1] === 80, why: "cow: gold " + plain[0] + " -> " + cow[0] + ", food " + plain[1] + " -> " + cow[1] + "; a pig stays " + pig.join("/") };
});
effect("Skull Cape: 3x gold for killing the kill leader", () => {
  const kill = (acc, leader) => struck(p => {
    p.points = 0;
    if (acc) p.tail = { id: acc }, p.tailIndex = acc;
  }, p => {
    p.health = 10;
    p.iconIndex = leader ? 1 : 0;
  }).a.points;
  return { ok: kill(4, true) === 300 && kill(4, false) === 100 && kill(0, true) === 100, why: "leader " + kill(4, true) + ", anyone else " + kill(4, false) + ", without the cape " + kill(0, true) };
});
effect("Troll Cape: 2x gold for kills by your spikes", () => {
  const kill = acc => {
    const w = sworld();
    const me = w.addPlayer(1, 9000, 9000, p => {
      p.points = 0;
      if (acc) wearAcc(w, p, acc);
    });
    w.place("spikes", 5100, 5000, 0, me);
    w.addPlayer(2, 5000, 5000, p => {
      p.health = 5;
      p.moveDir = 0;
    });
    for (let t = 0; t < 20; t++) w.tick();
    return me.points;
  };
  return { ok: kill(7) === 200 && kill(0) === 100, why: "spike kill " + kill(0) + " -> " + kill(7) };
});
effect("Blockades: 25% less damage from projectiles", () => {
  const shot = acc => {
    const w = sworld();
    const b = w.addPlayer(2, 5500, 5000, p => acc && wearAcc(w, p, acc));
    w.addPlayer(1, 5000, 5000, p => armed(p, 15, 0, 0));
    for (let t = 0; t < 10 && b.health === 100; t++) w.tick();
    return 100 - b.health;
  };
  return { ok: shot(15) === shot(0) * 0.75, why: "musket " + shot(0) + " -> " + shot(15) };
});
effect("Thorns: heals 10% of the damage of a hit on a player (ours: 'a little')", () => {
  const { a } = struck(p => {
    p.health = 50;
    p.tail = { id: 14 };
    p.tailIndex = 14;
  });
  return { ok: near(a.health, 50 + 4.5), why: "50 -> " + fmt(a.health) + " after a 45 hit" };
});
effect("Devils Tail: hits make players bleed for 2s (ours: 5 a second), a longer poison stays", () => {
  const { w, b } = struck(p => {
    p.tail = { id: 20 };
    p.tailIndex = 20;
  });
  const bleed = [ b.dmgOverTime.dmg, b.dmgOverTime.time ];
  const h = b.health;
  b.mouseState = 0;
  w.players[1].mouseState = w.players[1].gathering = 0;
  for (let t = 0; t < 30; t++) w.tick();
  const poisoned = struck(p => {
    p.tail = { id: 20 };
    p.tailIndex = 20;
  }, p => p.dmgOverTime = { dmg: 5, time: 5, doer: null }).b.dmgOverTime;
  return { ok: bleed[0] === 5 && bleed[1] === 2 && h - b.health === 10 && poisoned.time > 2, why: "bleeds " + bleed.join(" for ") + "s: lost " + (h - b.health) + " more; a 5s poison kept " + poisoned.time + "s left" };
});
effect("Emerald tier: 15% of the damage back (lifesteal)", () => {
  const { a, lost } = struck(p => {
    p.health = 50;
    p.weaponXP[5] = 30000;
  });
  return { ok: near(a.health, 50 + lost * 0.15), why: "hit " + fmt(lost) + ", healed " + fmt(a.health - 50) };
});
effect("the crown (kill leader, the Skull Cape's target) goes to the most kills", () => {
  // iconCallback lives in index.js, next to the sockets: run its own text on a list of players
  const src = require("fs").readFileSync(path.join(SERVER, "index.js"), "utf8");
  const body = src.slice(src.indexOf("function iconCallback()"));
  const fn = body.slice(0, body.indexOf("\n}\n") + 2);
  const players = [ { alive: true, kills: 1 }, { alive: true, kills: 5 }, { alive: false, kills: 9 }, { alive: true, kills: 3 } ];
  new Function("players", fn + "\niconCallback()")(players);
  const icons = players.map(p => p.iconIndex);
  return { ok: JSON.stringify(icons) === "[0,1,0,0]", why: "kills 1, 5, 9 (dead), 3 -> crowns " + icons.join(",") };
});
effect("switched off (config.storeEffects = false), capes do nothing", () => {
  srv.config.storeEffects = false;
  const r = walked(5, 5000) / walked(0, 5000);
  return { ok: r === 1, why: "Dash Cape speed x" + r };
});

heading(null);
const bad = results.filter(r => !r.ok);
console.log("\n" + (bad.length ? bad.length + " of " + results.length + " failed: " + bad.map(r => r.name).slice(0, 8).join("; ") : "All " + results.length + " pass: the situations match the game, and the store effects do what the store says"));
process.exit(bad.length ? 1 : 0);
