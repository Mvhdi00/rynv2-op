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
console.log('\n=== both scripts wire it the same way ===');
{
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.join(__dirname, '..');
  const unx = fs.readFileSync(path.join(ROOT, 'UnX.user.js'), 'utf8');
  const sak = fs.readFileSync(path.join(ROOT, 'Sakuna.user.js'), 'utf8');

  check(/return unxAutoPlay\.dir\(\);/.test(unx),
        'unX hands the wheel over only in the no-keys branch of getMoveDir');
  check(/dx == 0 && dy == 0 \? sakAutoPlay\.dir\(\) : angle/.test(sak),
        'and Sakuna does the same in its own getMoveDir');
  check(/id: "autoPlay"/.test(unx), 'unX has the toggle in its mod menu');
  check(/addCheck\("Auto Play", "autoPlay"/.test(sak), 'Sakuna has it in the Move section');
  check(/const box = getEl\("autoPlay"\);/.test(sak),
        "and Sakuna guards the lookup, since the menu does not exist at boot");
}

console.log('\n' + (fails === 0 ? '=> ALL AUTOPLAY TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
