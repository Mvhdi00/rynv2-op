#!/usr/bin/env node
// Runs the same situations through the game's own shared logic (tools/parity/game-shared.js,
// cut from the 12d386a8 bundle) and through the private server's (private-server/src), and
// compares them tick by tick: positions, speeds, health, what gets built, what gets hit.
//
//   node tools/server-parity.js [--verbose]
//
// Both worlds get the same seeded randomness and a steady 1000/9 ms tick. Places where the
// private server is different on purpose (the Crab King's arena west of x = 0, the calm water
// at the west end of the river, Ryn's commands) are kept out of the situations.

const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const VERBOSE = process.argv.includes("--verbose");
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

// what is compared each tick
const snap = w => ({
  players: w.players.map(p => [p.x, p.y, p.xVel, p.yVel, p.health, p.alive ? 1 : 0, p.slowMult, p.reloads[p.weaponIndex] || 0, p.shameCount, p.lockMove ? 1 : 0, p.wood, p.food, p.stone, p.points]),
  ais: w.ais.map(a => [a.x, a.y, a.xVel, a.yVel, a.health, a.dir]),
  objects: w.objects.map(o => [o.active ? 1 : 0, o.health === undefined ? -1 : o.health]),
  projectiles: w.projectiles.map(p => [p.active ? 1 : 0, p.x, p.y, p.range])
});
const close = (a, b) => a === b || Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

const results = [];
function scenario(name, ticks, setup, opts = {}) {
  const run = kind => {
    seed(opts.seed || 1234);
    const w = makeWorld(kind, opts);
    try {
      setup(w);
      const frames = [];
      for (let t = 0; t < ticks; t++) {
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
  let worst = 0;
  for (let t = 0; t < ticks && !first; t++) {
    for (const part of [ "players", "ais", "objects", "projectiles" ]) {
      const A = g.frames[t][part], B = s.frames[t][part];
      if (A.length !== B.length) {
        first = { t, part, what: "count " + A.length + " vs " + B.length };
        break;
      }
      for (let i = 0; i < A.length && !first; i++) {
        for (let k = 0; k < A[i].length; k++) {
          const a = A[i][k], b = B[i][k];
          if (typeof a === "number" && typeof b === "number") worst = Math.max(worst, Math.abs(a - b));
          if (!close(a, b)) {
            first = { t, part, i, k, game: a, server: b };
            break;
          }
        }
      }
    }
  }
  const ok = !first;
  results.push({ name, ok, first });
  console.log((ok ? "  same  " : "  DIFF  ") + name + (ok ? "" : "  — tick " + first.t + " " + first.part + (first.what ? " " + first.what : "[" + first.i + "] field " + first.k + ": game " + first.game + ", server " + first.server)));
  if (VERBOSE && !ok) console.log("    game:   ", JSON.stringify(g.frames[first.t][first.part]), "\n    server: ", JSON.stringify(s.frames[first.t][first.part]));
  return { g, s };
}
function check(name, fn) {
  const g = fn("game"), s = fn("server");
  const ok = JSON.stringify(g) === JSON.stringify(s);
  results.push({ name, ok });
  console.log((ok ? "  same  " : "  DIFF  ") + name + (ok ? "" : "\n    game:   " + JSON.stringify(g) + "\n    server: " + JSON.stringify(s)));
}

console.log("Movement");
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

console.log("Buildings");
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

console.log("Combat");
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

console.log("Animals");
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

console.log("Rules");
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

const bad = results.filter(r => !r.ok);
console.log("\n" + (bad.length ? bad.length + " of " + results.length + " differ from the game" : "All " + results.length + " match the game"));
process.exit(bad.length ? 1 : 0);
