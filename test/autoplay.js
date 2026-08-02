// unX and Sakuna both carry the same port of the RYN client's AutoPlay module:
// circle the nearest enemy at a fixed radius, step a fifth of a radian per
// tick, and reverse the direction of travel when the next point on the ring is
// blocked. The same assertions run against both, so the two cannot drift apart.
const extract = require('./extract.js');

let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
// angle between two bearings, wrapped into (-pi, pi]
const delta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

for (const which of ['unx', 'sakuna']) {
  console.log('\n=== ' + which + ' ===');
  const A = extract.loadAutoPlay(which);
  const ap = A.autoPlay;

  // RYN's numbers, exactly
  check(A.RADIUS === 80, 'circle radius is 80');
  check(A.SPEED === 0.2, 'it steps 0.2 radians per tick');
  check(A.CLEARANCE === 35, 'and keeps the player\'s own radius clear of buildings');

  // --- it does nothing unless it should ---
  A.setPlayer({ sid: 1, alive: true, x2: 0, y2: 0 });
  A.setObjects([]);
  A.setKeys(undefined);          // hands off the keyboard
  A.setEnemy(null);
  check(ap.dir() === undefined, 'with no enemy it leaves movement alone');

  A.setEnemy({ sid: 2, x2: 200, y2: 0 });
  A.toggle(false);
  check(ap.dir() === undefined, 'and with the toggle off it leaves movement alone');
  A.toggle(true);

  A.setPlayer({ sid: 1, alive: false, x2: 0, y2: 0 });
  check(ap.dir() === undefined, 'and while dead');
  A.setPlayer({ sid: 1, alive: true, x2: 0, y2: 0 });

  A.setEnemy({ sid: 2, x2: undefined, y2: 0 });
  check(ap.dir() === undefined, 'an enemy with no position yet is ignored rather than aimed at');
  A.setEnemy({ sid: 2, x2: 200, y2: 0 });

  // your own keys always win, which is how RYN stays out of your way
  A.setKeys(1.2);
  check(ap.dir() === undefined, 'while you are holding a movement key it does not steer');
  A.setKeys(undefined);

  // --- predicted positions, the way RYN reads pos.future ---
  {
    ap.reset();
    A.setObjects([]);
    // standing still: with no previous position the future is the current one
    A.setPlayer({ sid: 1, alive: true, x2: 120, y2: 0 });
    A.setEnemy({ sid: 2, x2: 200, y2: 0 });
    const still = ap.dir();

    // now give the enemy a previous position, so it is moving north at 40/tick
    ap.reset();
    A.setEnemy(Object.assign(
      { sid: 2, x2: 200, y2: 0 },
      which === 'sakuna' ? { oldPos: { x2: 200, y2: 40 } } : { lastX: 200, lastY: 40 }));
    const moving = ap.dir();
    check(!near(still, moving),
          'a moving enemy is led, not chased -- the ring is built on the predicted position');

    // and the prediction is exactly the client's own 2*x2 - previous
    const enFut = { x: 200, y: -40 };
    const cur = Math.atan2(0 - enFut.y, 120 - enFut.x);
    const nextA = cur + 0.2;
    const tx = enFut.x + Math.cos(nextA) * 80, ty = enFut.y + Math.sin(nextA) * 80;
    check(near(moving, Math.atan2(ty - 0, tx - 120)),
          'using 2*x2 - previous for the enemy, and our own position for the bearing');
  }

  // --- the circle ---
  ap.reset();
  // sitting due west of the enemy at exactly the ring radius
  A.setPlayer({ sid: 1, alive: true, x2: 120, y2: 0 });
  A.setEnemy({ sid: 2, x2: 200, y2: 0 });
  let d = ap.dir();
  check(typeof d === 'number', 'with an enemy in view it produces a direction');

  // the point it steers at must be one 0.2-radian step around the ring
  {
    const ex = 200, ey = 0, px = 120, py = 0;
    const current = Math.atan2(py - ey, px - ex);
    const nextA = current + 0.2;
    const tx = ex + Math.cos(nextA) * 80, ty = ey + Math.sin(nextA) * 80;
    check(near(d, Math.atan2(ty - py, tx - px)),
          'and it is the bearing to the next point on the ring, not at the enemy');
    check(!near(d, Math.atan2(ey - py, ex - px)),
          'so it strafes around them rather than walking into them');
  }

  // stepping repeatedly walks the ring in one consistent direction
  {
    ap.reset();
    A.setObjects([]);
    let x = 120, y = 0;
    const bearings = [];
    for (let i = 0; i < 6; i++) {
      A.setPlayer({ sid: 1, alive: true, x2: x, y2: y });
      const dir = ap.dir();
      bearings.push(Math.atan2(y - 0, x - 200));
      // walk a little along the direction it asked for
      x += Math.cos(dir) * 12;
      y += Math.sin(dir) * 12;
    }
    let allForward = true;
    for (let i = 1; i < bearings.length; i++) if (delta(bearings[i], bearings[i - 1]) <= 0) allForward = false;
    check(allForward, 'stepping repeatedly carries it around the enemy the same way each tick');
    const r = Math.hypot(x - 200, y - 0);
    check(r > 40 && r < 130, 'and it stays near the ring rather than spiralling in or out (r=' + r.toFixed(0) + ')');
  }

  // --- blocking and reversal ---
  ap.reset();
  A.setPlayer({ sid: 1, alive: true, x2: 120, y2: 0 });
  A.setEnemy({ sid: 2, x2: 200, y2: 0 });

  // work out where the next point would be, and drop a wall of our own on it
  const ex = 200, ey = 0;
  const cur = Math.atan2(0 - ey, 120 - ex);
  const blockedAt = { x: ex + Math.cos(cur + 0.2) * 80, y: ey + Math.sin(cur + 0.2) * 80 };
  const wall = {
    active: true, x: blockedAt.x, y: blockedAt.y, scale: 50,
    dmg: false, owner: { sid: 1 }, isTeamObject: () => true,
  };
  A.setObjects([wall]);
  const reversed = ap.dir();
  {
    const nextA = cur - 0.2;
    const tx = ex + Math.cos(nextA) * 80, ty = ey + Math.sin(nextA) * 80;
    check(near(reversed, Math.atan2(ty - 0, tx - 120)),
          'a building on the next point flips the direction of travel');
  }

  // an ENEMY spike must not block: RYN circles straight over them on purpose
  ap.reset();
  const spike = {
    active: true, x: blockedAt.x, y: blockedAt.y, scale: 50,
    dmg: true, owner: { sid: 2 }, isTeamObject: () => false,
  };
  A.setObjects([spike]);
  const overSpike = ap.dir();
  {
    const nextA = cur + 0.2;
    const tx = ex + Math.cos(nextA) * 80, ty = ey + Math.sin(nextA) * 80;
    check(near(overSpike, Math.atan2(ty - 0, tx - 120)),
          "an enemy's spikes are walked over, not treated as a wall");
  }

  // our own damaging building still blocks
  ap.reset();
  A.setObjects([{
    active: true, x: blockedAt.x, y: blockedAt.y, scale: 50,
    dmg: true, owner: { sid: 1 }, isTeamObject: () => true,
  }]);
  check(!near(ap.dir(), overSpike), 'but our own spikes do block, so it does not walk into them');

  // an inactive building is ignored
  ap.reset();
  A.setObjects([Object.assign({}, wall, { active: false })]);
  check(near(ap.dir(), overSpike), 'a destroyed building blocks nothing');

  // --- pit traps never block (RYN skips item 15 outright) ---
  ap.reset();
  A.setObjects([Object.assign({}, wall, { trap: true })]);
  check(near(ap.dir(), overSpike),
        'a pit trap on the next point does not block -- RYN skips item 15 outright');
  ap.reset();
  A.setObjects([Object.assign({}, spike, { trap: true })]);
  check(near(ap.dir(), overSpike), "and neither does an enemy's");

  // --- the clearance rule ---
  ap.reset();
  A.setObjects([]);
  const free = ap.dir();
  ap.reset();
  // just outside scale+35 of the next point: must not block
  A.setObjects([Object.assign({}, wall, { x: blockedAt.x + 86, y: blockedAt.y })]);
  check(near(ap.dir(), free), 'a building further than scale+35 away does not block');
  ap.reset();
  A.setObjects([Object.assign({}, wall, { x: blockedAt.x + 80, y: blockedAt.y })]);
  check(!near(ap.dir(), free), 'one inside scale+35 does');
}

// --------------------------------------------------------------------------
console.log("\n=== sakuna's per-tick sender ===");
{
  const A = extract.loadAutoPlay('sakuna');
  const ap = A.autoPlay;
  ap.reset();
  A.sent.length = 0;
  A.setPlayer({ sid: 1, alive: true, x2: 120, y2: 0 });
  A.setObjects([]);
  A.setKeys(undefined);
  A.setEnemy({ sid: 2, x2: 200, y2: 0 });

  check(ap.tick() === true, 'a tick with an enemy in view steers');
  check(A.sent.length === 1 && A.sent[0][0] === '9',
        'and puts a move packet on the wire through the script\'s own packet()');
  check(typeof A.sent[0][1] === 'number', 'carrying the direction');

  // walking on, the angle changes, so it keeps sending
  A.setPlayer({ sid: 1, alive: true, x2: 130, y2: 30 });
  ap.tick();
  check(A.sent.length === 2, 'as we move round, it keeps steering every tick');

  // standing still, the angle does not move, so it does not repeat itself
  const before = A.sent.length;
  ap.tick();
  check(A.sent.length === before,
        'but an unchanged angle is not re-sent, so it does not burn the packet budget');

  // hands on the keyboard: it stops and forgets, so the next release re-sends
  A.setKeys(0.5);
  check(ap.tick() === false, 'holding a key stops it');
  check(A.sent.length === before, 'and sends nothing');
  A.setKeys(undefined);
  ap.tick();
  check(A.sent.length === before + 1, 'letting go picks it straight back up');
}

// --------------------------------------------------------------------------
console.log('\n=== each script drives it from its own tick ===');
{
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.join(__dirname, '..');
  const unx = fs.readFileSync(path.join(ROOT, 'UnX.user.js'), 'utf8');
  const sak = fs.readFileSync(path.join(ROOT, 'Sakuna.user.js'), 'utf8');

  // The first cut hooked getMoveDir(), which both scripts call only on key
  // press and release -- so it produced one direction and then sat there. RYN
  // runs its module every tick, and that is the whole difference.
  check(!/return unxAutoPlay\.dir\(\);/.test(unx) && !/sakAutoPlay\.dir\(\) : angle/.test(sak),
        'neither script hooks getMoveDir any more');
  check(/function getMoveDir\(\) \{[\s\S]{0,400}?return undefined;/.test(unx),
        "and unX's getMoveDir is back to exactly what it was");

  // unX has a real per-tick movement authority: manageTickBase builds an
  // override and hands it to tickMovement, so auto play just supplies it
  check(/let e = this\.autoPush\(\);\n\s*if \(typeof e != "number" && scriptMenu\.toggles\.autoPlay\)/.test(unx),
        'unX supplies the same per-tick override its own autoPush does');
  check(/e = unxAutoPlay\.dir\(\);/.test(unx), 'and it reaches tickMovement through it');
  check(/typeof e != "number"/.test(unx), 'yielding to autoPush, which is the client\'s own mover');

  // Sakuna has no single authority, so the module sends for itself, once a tick
  check(/sakAutoPlay\.tick\(\);/.test(sak), 'Sakuna calls it once per game tick');
  check(/packet\(code\.move, dir, 1\);/.test(sak), 'and it sends through the script\'s own packet()');

  check(/try \{\n\s*e = unxAutoPlay\.dir\(\);/.test(unx), 'unX wraps the call');
  check(/try \{\n\s*sakAutoPlay\.tick\(\);/.test(sak), 'and so does Sakuna');
  check(/auto play failed, leaving movement alone/.test(unx)
        && /auto play failed, leaving movement alone/.test(sak),
        'a failure there falls back to normal movement instead of killing it');
  check(/id: "autoPlay"/.test(unx), 'unX has the toggle in its mod menu');
  check(/addCheck\("Auto Play", "autoPlay"/.test(sak), 'Sakuna has it in the Move section');
  check(/const box = getEl\("autoPlay"\);/.test(sak),
        "and Sakuna guards the lookup, since the menu does not exist at boot");
}

console.log('\n' + (fails === 0 ? '=> ALL AUTOPLAY TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
