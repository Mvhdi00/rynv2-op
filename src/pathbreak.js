  // ==========================================================================
  // PATH BREAK
  //
  // Walk to a point on the map, and break whatever is in the way.
  //
  // The pathfinder is a beam search over *simulated server ticks*, not over a
  // grid of squares. Every candidate direction is fed through the same physics
  // MovementSimulation runs — acceleration, the 0.993^delta decay, the 1..4
  // sub-step collision depth, river current, snow, spike knockback, pit-trap
  // lock — so a path that the search says arrives in 23 ticks is a path the
  // player can actually walk in 23 ticks. A grid pathfinder cannot say that:
  // it plans in positions, and this game moves in velocities.
  //
  // The search runs in a Worker because it is expensive: ~21 candidate
  // directions per beam per tick, over a horizon of up to 80 ticks. On the main
  // thread that is a visible stutter every tick; in a Worker it overlaps with
  // rendering and the result is picked up before the next tick boundary.
  //
  // Replanning happens every tick from the true current state, so a stale plan
  // never accumulates error — the first direction of each plan is the only one
  // ever sent.
  //
  // The breaking half: a plan can be perfect and still not be walkable, because
  // a wall ring has no gap to walk through. Each tick the module checks the
  // corridor directly ahead for an enemy building that blocks it, and if one is
  // in weapon reach it swings at it with tank gear on until it is gone. Nothing
  // of ours is ever a target, and neither is anything outside the corridor.
  // ==========================================================================

  // Physics mirrors MovementSimulation.update / .checkCollision exactly. When
  // that changes, this has to change with it — it is the same model of the same
  // server, just running dozens of ticks deep instead of 2.
  const PATHBREAK_WORKER_SRC = `
'use strict';

let CFG = null;
let GRID = null;
let STAMP = 0;
// Collision lookup grid, matching SpatialHashGrid2D's 100-unit cell.
const CELL = 100;
// Frontier thinning. DEDUPE_CELL must stay under one tick of travel; see the
// note where it is used.
const DEDUPE_CELL = 25;
const SPREAD_CELL = 150;
// Charged against a frontier state with no clear line to the target, standing
// in for the detour it has not discovered yet. About the cost of walking around
// one building cluster.
const PATHBREAK_BLOCKED_PENALTY = 600;

// Same layout as SpatialHashGrid2D: insert over the object's collision radius,
// read the 3x3 cells around a point. Rebuilt once per message.
function buildGrid(objs) {
  const grid = new Map();
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    o.s = 0;
    const startX = (o.x - o.cs) / CELL | 0;
    const startY = (o.y - o.cs) / CELL | 0;
    const endX = (o.x + o.cs) / CELL | 0;
    const endY = (o.y + o.cs) / CELL | 0;
    for (let cx = startX; cx <= endX; cx++) {
      for (let cy = startY; cy <= endY; cy++) {
        const key = cx * 100003 + cy;
        let cell = grid.get(key);
        if (cell === undefined) grid.set(key, cell = []);
        cell.push(o);
      }
    }
  }
  return grid;
}

function nearObjects(x, y, out) {
  out.length = 0;
  STAMP++;
  const cellX = x / CELL | 0;
  const cellY = y / CELL | 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const cell = GRID.get((cellX + i) * 100003 + (cellY + j));
      if (cell === undefined) continue;
      for (let k = 0; k < cell.length; k++) {
        const o = cell[k];
        if (o.s === STAMP) continue;
        o.s = STAMP;
        out.push(o);
      }
    }
  }
  return out;
}

// Returns a bitmask of what this contact did: 1 = spike knockback,
// 2 = walked into something the path must not touch (enemy pit trap,
// teleporter). MovementSimulation.checkCollision, with the branch order kept.
function collide(s, o, stepMult) {
  const dx = s.x - o.x;
  const dy = s.y - o.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const collisionRange = s.cs + o.cs + 5;
  if (distance > collisionRange) return 0;
  if (!o.moveOnTop) {
    const tmpDir = Math.atan2(dy, dx);
    s.x = o.x + collisionRange * Math.cos(tmpDir);
    s.y = o.y + collisionRange * Math.sin(tmpDir);
    s.xVel *= 0.75;
    s.yVel *= 0.75;
    if (o.isCactus || (o.isSpike && o.isEnemy)) {
      s.xVel += 1.5 * Math.cos(tmpDir);
      s.yVel += 1.5 * Math.sin(tmpDir);
      return 1;
    }
    return 0;
  }
  if (o.isPO && o.type === 15 && o.isEnemy) {
    // Pit trap: the server pins you here for a tick. Never route through one.
    s.lockMove = true;
    return 2;
  }
  if (o.isPO && o.type === 22) {
    // Teleporter: standing on it moves you somewhere the plan knows nothing
    // about, so the plan is void.
    return 2;
  }
  if (o.isPO && o.type === 16) {
    s.xVel += stepMult * o.boostSpeed * Math.cos(o.angle);
    s.yVel += stepMult * o.boostSpeed * Math.sin(o.angle);
  }
  return 0;
}

const NEAR_BUF = [];

// One server tick. Returns the same bitmask collide() does, OR-ed over every
// contact in the tick.
function simulateTick(s, moveDir) {
  const D = CFG.delta;
  let flags = 0;
  if (s.slowMult < 1) s.slowMult = Math.min(1, s.slowMult + 8e-4 * D);
  // Biome and river are read at the top of the tick, before the move — same as
  // MovementSimulation, which snapshots getPos() before touching velocity.
  const inSnow = s.y <= CFG.snowBiomeTop && !s.coldM;
  const snowMult = inSnow ? CFG.snowSpeed : 1;
  if (s.lockMove) {
    s.xVel = 0;
    s.yVel = 0;
  } else {
    let spdMult = s.buildMult * s.weaponSpd * s.skinSpd * s.tailSpd * snowMult * s.slowMult;
    const inRiver = !s.onPlatform && s.y >= CFG.riverMin && s.y <= CFG.riverMax;
    if (inRiver) {
      if (s.watrImm) {
        spdMult *= 0.75;
        s.xVel += CFG.waterCurrent * 0.4 * D;
      } else {
        spdMult *= 0.33;
        s.xVel += CFG.waterCurrent * D;
      }
    }
    if (moveDir !== null) {
      const accel = CFG.playerSpeed * spdMult * D;
      const xDir = Math.cos(moveDir);
      const yDir = Math.sin(moveDir);
      if (xDir) s.xVel += xDir * accel;
      if (yDir) s.yVel += yDir * accel;
    }
  }
  // lockMove is consumed by the tick it was set in front of, then cleared —
  // a trap costs you exactly one tick of input, as on the server.
  s.lockMove = false;
  const moveDist = Math.hypot(s.xVel * D, s.yVel * D);
  // Same 1..4 sub-steps MovementSimulation uses, written so a non-finite
  // velocity collapses to one step instead of Math.max(1, NaN) === NaN, which
  // would skip the collision loop and silently freeze the beam in place.
  const depth = moveDist > 40 ? Math.min(4, Math.round(moveDist / 40)) : 1;
  const stepMult = 1 / depth;
  for (let i = 0; i < depth; i++) {
    if (s.xVel) s.x += s.xVel * D * stepMult;
    if (s.yVel) s.y += s.yVel * D * stepMult;
    const list = nearObjects(s.x, s.y, NEAR_BUF);
    for (let k = 0; k < list.length; k++) flags |= collide(s, list[k], stepMult);
  }
  if (s.xVel) {
    s.xVel *= CFG.decay;
    if (s.xVel >= -0.01 && s.xVel <= 0.01) s.xVel = 0;
  }
  if (s.yVel) {
    s.yVel *= CFG.decay;
    if (s.yVel >= -0.01 && s.yVel <= 0.01) s.yVel = 0;
  }
  const min = CFG.playerScale;
  const max = CFG.mapScale - CFG.playerScale;
  s.x = Math.min(Math.max(s.x, min), max);
  s.y = Math.min(Math.max(s.y, min), max);
  return flags;
}

// The nearest enemy coasts on its own velocity and is pushed apart from us the
// way checkCollision handles a Player target. MovementSimulation holds the
// enemy still because it only looks two ticks ahead; over a long horizon that
// is wrong, and coasting costs nothing since the decay flattens it in ~5 ticks.
function coastNear(n) {
  const D = CFG.delta;
  n.x += n.xVel * D;
  n.y += n.yVel * D;
  n.xVel *= CFG.decay;
  n.yVel *= CFG.decay;
  if (n.xVel >= -0.01 && n.xVel <= 0.01) n.xVel = 0;
  if (n.yVel >= -0.01 && n.yVel <= 0.01) n.yVel = 0;
}

function separate(s, n) {
  const dx = s.x - n.x;
  const dy = s.y - n.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const scale = s.cs + n.cs;
  if (distance > scale + 5 || distance === 0) return;
  const tmpDir = Math.atan2(dy, dx);
  const tmpInt = (distance - scale) * -1 / 2;
  s.x += tmpInt * Math.cos(tmpDir);
  s.y += tmpInt * Math.sin(tmpDir);
}

function dist2D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function cloneState(s) {
  return {
    x: s.x, y: s.y, xVel: s.xVel, yVel: s.yVel,
    cs: s.cs, slowMult: s.slowMult, lockMove: s.lockMove,
    buildMult: s.buildMult, weaponSpd: s.weaponSpd, skinSpd: s.skinSpd,
    tailSpd: s.tailSpd, coldM: s.coldM, watrImm: s.watrImm, onPlatform: s.onPlatform
  };
}

function cloneNear(n) {
  return n === null ? null : { x: n.x, y: n.y, xVel: n.xVel, yVel: n.yVel, cs: n.cs };
}

// Is the straight line from here to the target free of anything the player
// cannot walk through? Only asked once per surviving beam, and only when no
// beam reached the target, so the linear scan is not worth indexing.
function hasLineOfSight(from, target, objs, radius) {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const length2 = dx * dx + dy * dy;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    const solid = !o.moveOnTop || (o.isPO && (o.type === 15 || o.type === 22));
    if (!solid) continue;
    let t = 0;
    if (length2 > 0) {
      t = ((o.x - from.x) * dx + (o.y - from.y) * dy) / length2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
    }
    const cx = from.x + dx * t - o.x;
    const cy = from.y + dy * t - o.y;
    const clear = radius + o.cs;
    if (cx * cx + cy * cy < clear * clear) return false;
  }
  return true;
}

self.onmessage = function (e) {
  const data = e.data;
  CFG = data.cfg;
  // Math.pow(0.993, 111.11) is a constant of the tick, not of the beam.
  CFG.decay = Math.pow(CFG.playerDecel, CFG.delta);
  GRID = buildGrid(data.objs);
  const target = data.target;
  const arrive = data.arrive;
  const beamWidth = data.beamWidth;
  const deadline = Date.now() + data.budgetMs;
  const start = cloneState(data.player);
  const startNear = cloneNear(data.near);

  if (dist2D(start, target) < arrive) {
    self.postMessage({ id: data.id, path: [], waypoints: [], arrived: true });
    return;
  }

  // A beam is one candidate future: where the player would be, what the enemy
  // would be doing, and the directions that got there. sumDist is the running
  // sum of distance-to-target over every tick so far, so a beam that closed the
  // gap early beats one that loitered and then sprinted.
  //
  // The directions are held as a parent-pointer chain rather than an array per
  // beam. Copying the whole path onto every candidate is quadratic in the
  // horizon and it is the single most expensive thing the search does — at 40
  // ticks it was spending more time copying directions than simulating them.
  let beams = [ { state: start, near: startNear, node: null, len: 0, sumDist: 0, score: dist2D(start, target) } ];
  let bestNode = null;
  let bestTicks = Infinity;
  let bestSum = Infinity;
  let closestNode = null;
  let closestDist = dist2D(start, target);

  for (let tick = 0; tick < data.maxTicks; tick++) {
    if (Date.now() > deadline) break;
    const candidates = [];
    for (let bi = 0; bi < beams.length; bi++) {
      // Checked inside the beam loop as well as outside it: a wide frontier
      // makes one tick expensive enough to overshoot the budget on its own.
      if ((bi & 15) === 15 && Date.now() > deadline) break;
      const beam = beams[bi];
      const state = beam.state;
      const targetDir = Math.atan2(target.y - state.y, target.x - state.x);
      const dirs = [];
      for (let k = -10; k <= 10; k++) dirs.push(targetDir + k * (Math.PI / 16));
      // Carrying the current heading forward matters when the player is already
      // fast: the fan above is centred on the target, and forcing a turn every
      // tick throws away momentum that would have carried through a gap.
      const spd = Math.sqrt(state.xVel * state.xVel + state.yVel * state.yVel);
      if (spd > 0.05) dirs.push(Math.atan2(state.yVel, state.xVel));

      for (let di = 0; di < dirs.length; di++) {
        const ns = cloneState(state);
        const nn = cloneNear(beam.near);
        const flags = simulateTick(ns, dirs[di]);
        if (flags & 2) continue;
        if (data.avoidSpikes && (flags & 1)) continue;
        if (nn !== null) {
          coastNear(nn);
          separate(ns, nn);
        }
        const d = dist2D(ns, target);
        const node = { dir: dirs[di], prev: beam.node };
        const len = beam.len + 1;
        const sumDist = beam.sumDist + d;
        if (d < closestDist) {
          closestDist = d;
          closestNode = node;
        }
        if (d < arrive) {
          if (len < bestTicks || (len === bestTicks && sumDist < bestSum)) {
            bestNode = node;
            bestTicks = len;
            bestSum = sumDist;
          }
        } else {
          candidates.push({ state: ns, near: nn, node: node, len: len, sumDist: sumDist, score: d });
        }
      }
    }

    // Every beam of this tick has been expanded, so nothing found later can be
    // shorter than what arrived here.
    if (bestNode !== null) break;

    // Thin the frontier by position, not by score. Sorting candidates by
    // distance-to-target collapses the frontier onto whichever route currently
    // looks best and quietly kills the beam that was going the long way around
    // a wall — which is the route that actually gets there.
    //
    // The cell has to be smaller than one tick of travel (~36 units at full
    // speed) or this backfires: with a cell any bigger, all 21 candidates off a
    // beam land in the same one or two cells, the frontier never widens, and
    // the search creeps forward a couple of cells per tick exploring nothing.
    const cells = new Map();
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const key = (c.state.x / DEDUPE_CELL | 0) * 100003 + (c.state.y / DEDUPE_CELL | 0);
      const prev = cells.get(key);
      if (prev === undefined || c.sumDist < prev.sumDist) cells.set(key, c);
    }
    beams = Array.from(cells.values());
    if (beams.length > beamWidth) {
      // Over budget. Take the best beam out of each coarse cell before taking
      // any second beam from a cell already represented, so what gets dropped
      // is duplication within a route rather than a whole route.
      const coarse = new Map();
      const rest = [];
      for (let i = 0; i < beams.length; i++) {
        const c = beams[i];
        const key = (c.state.x / SPREAD_CELL | 0) * 100003 + (c.state.y / SPREAD_CELL | 0);
        const prev = coarse.get(key);
        if (prev === undefined) {
          coarse.set(key, c);
        } else if (c.sumDist < prev.sumDist) {
          coarse.set(key, c);
          rest.push(prev);
        } else {
          rest.push(c);
        }
      }
      const kept = Array.from(coarse.values());
      if (kept.length > beamWidth) {
        kept.sort(function (a, b) { return a.score - b.score; });
        kept.length = beamWidth;
      } else if (kept.length < beamWidth && rest.length > 0) {
        rest.sort(function (a, b) { return a.score - b.score; });
        for (let i = 0; i < rest.length && kept.length < beamWidth; i++) kept.push(rest[i]);
      }
      beams = kept;
    }
    if (beams.length === 0) break;
  }

  // Nothing reached the target inside the horizon, so something has to be
  // picked to walk at. Plain closest-approach is the obvious choice and a bad
  // one: the state nearest the target is usually flattened against the near
  // face of whatever is in the way, and re-choosing it every tick is how a
  // search walks into a wall and stays there.
  //
  // So the frontier is scored on how much journey is left, not how much
  // distance: a state that can see the target is worth walking to even if it is
  // further away, because from there the rest is a straight line. A state with
  // no clear line has an unknown detour still ahead of it, charged here as a
  // flat penalty roughly the size of walking around a typical building cluster.
  // When everything is blocked the penalty cancels out and this degrades to
  // closest-approach — pressing into the wall, which is the case the breaker
  // exists for.
  let finalNode = bestNode;
  if (finalNode === null) {
    finalNode = closestNode;
    let bestCost = closestDist + PATHBREAK_BLOCKED_PENALTY;
    for (let i = 0; i < beams.length; i++) {
      const beam = beams[i];
      if (beam.score >= bestCost) continue;
      const cost = beam.score +
        (hasLineOfSight(beam.state, target, data.objs, beam.state.cs) ? 0 : PATHBREAK_BLOCKED_PENALTY);
      if (cost < bestCost) {
        bestCost = cost;
        finalNode = beam.node;
      }
    }
  }

  const finalPath = [];
  for (let node = finalNode; node !== null; node = node.prev) finalPath.push(node.dir);
  finalPath.reverse();
  if (finalPath.length === 0) {
    self.postMessage({ id: data.id, path: [], waypoints: [], arrived: false });
    return;
  }

  // Replay the winner once to get world coordinates for the overlay.
  const waypoints = [];
  const replay = cloneState(start);
  const replayNear = cloneNear(startNear);
  for (let i = 0; i < finalPath.length; i++) {
    simulateTick(replay, finalPath[i]);
    if (replayNear !== null) {
      coastNear(replayNear);
      separate(replay, replayNear);
    }
    waypoints.push({ x: replay.x, y: replay.y });
  }

  self.postMessage({
    id: data.id,
    path: finalPath,
    waypoints: waypoints,
    arrived: bestNode !== null
  });
};
`;

  // Close enough to the target to call it done. One player width plus change —
  // tighter than this and the last few ticks are spent oscillating around a
  // point the collision resolver will not let you stand on.
  const PATHBREAK_ARRIVE = 69;
  // ~9 seconds of lookahead, which at full speed is about 2900 world units —
  // enough to plan the detour around a long wall rather than pressing into it.
  // In open terrain the search stops as soon as it arrives, so this ceiling
  // only costs anything when a detour is actually being searched for, and even
  // then the time budget below is what really ends the search.
  const PATHBREAK_MAX_TICKS = 80;
  const PATHBREAK_BEAM_WIDTH = 120;
  // How far the search can get inside its horizon: the whole horizon at full
  // speed, ~36 world units a tick. Nothing further away can affect a plan.
  const PATHBREAK_REACH = PATHBREAK_MAX_TICKS * 36;
  // Hard wall on search time. The tick is 111ms; spending more than this on a
  // plan means the plan lands after the tick it was for.
  const PATHBREAK_BUDGET_MS = 55;
  // How far down the corridor ahead to look for something worth breaking.
  const PATHBREAK_LOOK = 140;

  class PathBreak {
    moduleName = "pathBreak";
    client;
    target = null;
    waypoints = [];
    direction = null;
    blocker = null;
    reachesTarget = false;
    freshDirection = false;
    pending = false;
    requestID = 0;
    stuckTicks = 0;
    worker = null;
    workerBlocked = false;

    constructor(client2) {
      this.client = client2;
    }

    get active() {
      return this.target !== null;
    }

    reset() {
      this.stop();
    }

    setTarget(x, y) {
      const {_ModuleHandler: ModuleHandler} = this.client;
      this.target = new Vector_default(x, y);
      this.waypoints = [];
      this.direction = null;
      this.blocker = null;
      this.reachesTarget = false;
      this.freshDirection = false;
      this.stuckTicks = 0;
      this.requestID++;
      ModuleHandler.endTarget._setXY(x, y);
      ModuleHandler.followPath = true;
    }

    toggleTarget(x, y) {
      if (this.active) {
        this.stop();
      } else {
        this.setTarget(x, y);
      }
    }

    // restoreInput=false when the caller is itself about to issue a movement
    // packet, so cancelling a route from a keypress does not send two.
    stop(restoreInput = true) {
      const wasActive = this.target !== null;
      this.target = null;
      this.waypoints = [];
      this.direction = null;
      this.blocker = null;
      this.reachesTarget = false;
      this.freshDirection = false;
      this.stuckTicks = 0;
      this.requestID++;
      if (!wasActive) {
        return;
      }
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer, InputHandler: InputHandler2} = this.client;
      ModuleHandler.followPath = false;
      if (!restoreInput || !myPlayer.inGame) {
        return;
      }
      // Hand movement back to whatever the player is actually holding. Stopping
      // outright would leave someone who walked the whole way with a finger on
      // W standing still until they let go and pressed it again.
      if (this.client.isOwner && InputHandler2 !== undefined) {
        InputHandler2.handleMovement();
        return;
      }
      ModuleHandler.stopMovement();
      ModuleHandler.move_dir = null;
      ModuleHandler.reverse_move_dir = null;
    }

    // Returns null if a Worker cannot be had. Constructing one off a blob URL
    // is the one thing here a page can forbid outright, and when it throws it
    // has to degrade to walking the straight line rather than take the tick —
    // and with it every module ordered after this one — down with it.
    _getWorker() {
      if (this.worker !== null) {
        return this.worker;
      }
      if (this.workerBlocked) {
        return null;
      }
      try {
        const blob = new Blob([ PATHBREAK_WORKER_SRC ], {
          type: "application/javascript"
        });
        const worker = new Worker(URL.createObjectURL(blob));
        worker.onmessage = event => this._onResult(event.data);
        worker.onerror = event => {
          Logger.warn("Path Break: search worker failed - " + (event.message || "no detail") + ". Falling back to straight-line walking.");
          this.pending = false;
          this.worker = null;
          this.workerBlocked = true;
        };
        this.worker = worker;
        return worker;
      } catch (error) {
        Logger.warn("Path Break: could not start the search worker (" + error.message + "). Falling back to straight-line walking.");
        this.workerBlocked = true;
        return null;
      }
    }

    // Walk in `angle`. This is what startMovement does when nothing else has
    // claimed movement this tick; going through it directly keeps move_dir in
    // step for safeWalk and the placer, without letting another module's
    // leftover moveTo swallow the packet.
    _walk(angle) {
      const {_ModuleHandler: ModuleHandler} = this.client;
      ModuleHandler.move_dir = angle;
      ModuleHandler.reverse_move_dir = angle === null ? null : reverseAngle(angle);
      ModuleHandler.startMovement(angle, true);
    }

    _onResult(result) {
      this.pending = false;
      // A plan for a target we have since abandoned or replaced.
      if (result.id !== this.requestID || !this.active) {
        return;
      }
      const {myPlayer: myPlayer} = this.client;
      if (!myPlayer.inGame) {
        return;
      }
      this.waypoints = result.waypoints;
      this.reachesTarget = result.arrived;
      if (result.path.length === 0) {
        this.direction = null;
        return;
      }
      this.direction = result.path[0];
      // Send it now rather than at the next tick. The plan was computed from
      // this tick's state; holding it for one more tick would make every step
      // act on where we were, not where we are.
      this._walk(this.direction);
      this.freshDirection = true;
    }

    _serialize() {
      const {
        myPlayer: myPlayer,
        ObjectManager: ObjectManager2,
        PlayerManager: PlayerManager2,
        EnemyManager: EnemyManager2,
        _ModuleHandler: ModuleHandler
      } = this.client;
      const {autoHat: autoHat} = ModuleHandler.staticModules;
      const pos = myPlayer.pos.current;
      const skin = Hats[autoHat.getNextHat()] || {};
      const tail = Accessories[autoHat.getNextAcc()] || {};
      const weapon = DataHandler_default.getWeapon(autoHat.getNextWeaponID()) || {};

      const player = {
        x: pos.x,
        y: pos.y,
        xVel: 0,
        yVel: 0,
        cs: myPlayer.collisionScale,
        slowMult: 1,
        lockMove: false,
        buildMult: autoHat.getNextItemID() >= 0 ? .5 : 1,
        weaponSpd: weapon.spdMult || 1,
        skinSpd: "spdMult" in skin ? skin.spdMult : 1,
        tailSpd: "spdMult" in tail ? tail.spdMult : 1,
        coldM: "coldM" in skin,
        watrImm: "watrImm" in skin,
        onPlatform: !!myPlayer.onPlatform
      };
      // The client is not told its own velocity, only where it was and where it
      // is. MovementSimulation.reset rebuilds it from the last tick's travel;
      // same reconstruction here.
      if (ModuleHandler.move_dir !== null) {
        const speed = myPlayer.speed / (1e3 / 9);
        player.xVel = Math.cos(ModuleHandler.move_dir) * speed;
        player.yVel = Math.sin(ModuleHandler.move_dir) * speed;
      }

      let near = null;
      const nearestEnemy = EnemyManager2.nearestEnemy;
      if (nearestEnemy !== null) {
        const enemyPos = nearestEnemy.pos.current;
        const enemySpeed = nearestEnemy.speed / (1e3 / 9);
        near = {
          x: enemyPos.x,
          y: enemyPos.y,
          xVel: Math.cos(nearestEnemy.move_dir) * enemySpeed,
          yVel: Math.sin(nearestEnemy.move_dir) * enemySpeed,
          cs: nearestEnemy.collisionScale
        };
      }

      // Everything the search can reach has to be shipped, and nothing it
      // cannot is worth shipping. A corridor between here and the target is the
      // tempting shape and the wrong one — routing around an obstacle swings
      // well outside any sensible corridor width, and terrain missing from the
      // message is terrain the search believes is empty.
      //
      // What the search genuinely cannot leave is a disk: it never plans past
      // the horizon, and it is target-seeking, so it never strays far beyond
      // the target either.
      const objs = [];
      const target = this.target;
      const radius = Math.min(pos.distance(target) + 600, PATHBREAK_REACH);
      for (const object of ObjectManager2.objects.values()) {
        const objectPos = object.pos.current;
        const reach = radius + object.collisionScale;
        if (Math.abs(objectPos.x - pos.x) > reach || Math.abs(objectPos.y - pos.y) > reach) {
          continue;
        }
        const isPO = object instanceof PlayerObject;
        let isEnemy = true;
        if (isPO) {
          try {
            isEnemy = PlayerManager2.isEnemyByID(object.ownerID, myPlayer);
          } catch (error) {
            isEnemy = true;
          }
        }
        objs.push({
          x: objectPos.x,
          y: objectPos.y,
          cs: object.collisionScale,
          moveOnTop: object.canMoveOnTop(),
          isPO: isPO,
          type: isPO ? object.type : -1,
          angle: object.angle,
          boostSpeed: isPO && object.type === 16 ? Items[16].boostSpeed || 0 : 0,
          isSpike: isPO ? object.isSpike : false,
          isCactus: !isPO && object instanceof Resource ? object.isCactus : false,
          isEnemy: isEnemy
        });
      }

      return {
        id: this.requestID,
        player: player,
        near: near,
        objs: objs,
        target: {
          x: target.x,
          y: target.y
        },
        arrive: PATHBREAK_ARRIVE,
        maxTicks: PATHBREAK_MAX_TICKS,
        beamWidth: PATHBREAK_BEAM_WIDTH,
        budgetMs: PATHBREAK_BUDGET_MS,
        avoidSpikes: !!Settings_default._pathBreakAvoidSpikes,
        cfg: {
          delta: 1e3 / 9,
          playerSpeed: Config_default.playerSpeed,
          playerDecel: Config_default.playerDecel,
          playerScale: Config_default.playerScale,
          mapScale: Config_default.mapScale,
          snowBiomeTop: Config_default.snowBiomeTop,
          snowSpeed: Config_default.snowSpeed,
          waterCurrent: Config_default.waterCurrent,
          riverMin: Config_default.mapScale / 2 - Config_default.riverWidth / 2,
          riverMax: Config_default.mapScale / 2 + Config_default.riverWidth / 2
        }
      };
    }

    _dispatch() {
      if (this.pending || !this.active || this.workerBlocked) {
        return;
      }
      const worker = this._getWorker();
      if (worker === null) {
        return;
      }
      let message;
      try {
        message = this._serialize();
      } catch (error) {
        return;
      }
      // Set only once the send is certain to be attempted: a pending flag left
      // standing after a failed dispatch stops the module forever.
      this.pending = true;
      try {
        worker.postMessage(message);
      } catch (error) {
        this.pending = false;
        this.workerBlocked = true;
      }
    }

    // The one enemy building standing in the corridor we are walking down, or
    // null. Ours is never a candidate, and neither is anything we cannot reach
    // with the weapon we are holding.
    _findBlocker(moveDir) {
      const {
        myPlayer: myPlayer,
        ObjectManager: ObjectManager2,
        PlayerManager: PlayerManager2,
        _ModuleHandler: ModuleHandler
      } = this.client;
      const {autoBreak: autoBreak} = ModuleHandler.staticModules;
      const pos = myPlayer.pos.current;
      const cos = Math.cos(moveDir);
      const sin = Math.sin(moveDir);
      // Nothing has moved for a few ticks: the corridor test is too strict for
      // whatever we are wedged against, so widen it until something is found.
      const slack = Math.min(this.stuckTicks, 8) * 9;
      const look = PATHBREAK_LOOK + slack * 4;
      let best = null;
      let bestHits = Infinity;
      ObjectManager2.grid2D.query(pos.x, pos.y, 2, id => {
        const object = ObjectManager2.objects.get(id);
        if (object === undefined || !(object instanceof PlayerObject)) {
          return;
        }
        if (!object.isDestroyable) {
          return;
        }
        // Boost pads and blockers can be walked over; pit traps and teleporters
        // cannot be walked over safely even though the collision says they can.
        if (object.canMoveOnTop() && object.type !== 15 && object.type !== 22) {
          return;
        }
        let isEnemy;
        try {
          isEnemy = PlayerManager2.isEnemyByID(object.ownerID, myPlayer);
        } catch (error) {
          return;
        }
        if (!isEnemy) {
          return;
        }
        const objectPos = object.pos.current;
        const along = (objectPos.x - pos.x) * cos + (objectPos.y - pos.y) * sin;
        const t = along < 0 ? 0 : along > look ? look : along;
        const cx = pos.x + t * cos;
        const cy = pos.y + t * sin;
        const clearance = myPlayer.collisionScale + object.collisionScale + 5 + slack;
        if (Math.hypot(objectPos.x - cx, objectPos.y - cy) > clearance) {
          return;
        }
        const type = autoBreak.getDestroyingWeapon(object);
        if (type === null) {
          return;
        }
        const weapon = myPlayer.getItemByType(type);
        if (weapon === null) {
          return;
        }
        // Rank by swings-to-destroy, counting the tank bonus only if we can
        // actually put the hat on — the same call postTick makes below, so the
        // ranking and the swing agree about how hard we hit.
        const damage = myPlayer.getBuildingDamage(weapon, ModuleHandler.canBuy(0, 40));
        const hits = damage > 0 ? Math.ceil(object.health / damage) : Infinity;
        if (hits < bestHits) {
          bestHits = hits;
          best = {
            object: object,
            type: type
          };
        }
      });
      return best;
    }

    // ModuleHandler runs the module list without a try/catch, so anything that
    // throws in here takes out every module ordered after it — safeWalk among
    // them — for the rest of the session, while the ones before it keep
    // working. That failure reads as "this one feature does nothing" and hides
    // the fact that three others quietly died with it. Not worth the risk for
    // a module that is optional by design.
    postTick() {
      try {
        this._tick();
      } catch (error) {
        Logger.warn("Path Break: " + error.message);
        this.stop();
      }
    }

    _tick() {
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      if (!Settings_default._pathBreak || !myPlayer.inGame) {
        if (this.active) {
          this.stop();
        }
        return;
      }
      if (!this.active) {
        return;
      }
      const pos = myPlayer.pos.current;
      if (pos.distance(this.target) < PATHBREAK_ARRIVE) {
        this.stop();
        return;
      }

      // Direction first: the worker only sends one when it has a plan, and on
      // the tick it does the walk has already gone out.
      if (this.freshDirection) {
        this.freshDirection = false;
      } else if (this.direction !== null) {
        this._walk(this.direction);
      } else {
        this._walk(pos.angle(this.target));
      }

      this.stuckTicks = myPlayer.speed < 4 ? this.stuckTicks + 1 : 0;

      this.blocker = null;
      if (Settings_default._pathBreakObstacles && !ModuleHandler.moduleActive) {
        const heading = ModuleHandler.move_dir !== null ? ModuleHandler.move_dir : pos.angle(this.target);
        const blocker = this._findBlocker(heading);
        if (blocker !== null) {
          const {reloading: reloading} = ModuleHandler.staticModules;
          this.blocker = blocker.object;
          if (reloading.isReloaded(blocker.type)) {
            ModuleHandler.moduleActive = true;
            ModuleHandler.forceWeapon = blocker.type;
            ModuleHandler.useAngle = pos.angle(blocker.object.pos.current);
            if (ModuleHandler.canBuy(0, 40)) ModuleHandler.forceHat = 40;
            ModuleHandler.shouldAttack = true;
          }
        }
      }

      this._dispatch();
    }
  }

  // --------------------------------------------------------------------------
  // Overlay: the planned route, drawn in world space on its own canvas above
  // the game. Its own canvas rather than a hook into the object renderer so it
  // costs nothing at all while no path is active.
  // --------------------------------------------------------------------------
  let _pathBreakCanvas = null;

  function _pathBreakModule() {
    const handler = client && client._ModuleHandler;
    const modules = handler && handler.staticModules;
    return modules ? modules.pathBreak : null;
  }

  function _removePathBreakOverlay() {
    if (_pathBreakCanvas !== null) {
      _pathBreakCanvas.remove();
      _pathBreakCanvas = null;
    }
  }

  function _ensurePathBreakCanvas() {
    if (_pathBreakCanvas !== null && _pathBreakCanvas.parentNode !== null) {
      return _pathBreakCanvas;
    }
    const gameCanvas = document.querySelector("#gameCanvas");
    if (gameCanvas === null || gameCanvas.parentNode === null) {
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.id = "ryn-pathbreak";
    canvas.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:50;";
    gameCanvas.parentNode.appendChild(canvas);
    _pathBreakCanvas = canvas;
    return canvas;
  }

  function _renderPathBreak(module) {
    const gameCanvas = document.querySelector("#gameCanvas");
    if (gameCanvas === null) {
      return;
    }
    const canvas = _ensurePathBreakCanvas();
    if (canvas === null) {
      return;
    }
    if (canvas.width !== gameCanvas.width || canvas.height !== gameCanvas.height) {
      canvas.width = gameCanvas.width;
      canvas.height = gameCanvas.height;
    }
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const offset = RYN._offset;
    const target = module.target;
    const waypoints = module.waypoints;

    ctx.save();
    if (waypoints.length > 0) {
      // A route the search could not finish is drawn dashed and dimmer: it is
      // the best approach found so far, not a way through, and that is usually
      // the moment the breaker is about to start swinging.
      const partial = !module.reachesTarget;
      ctx.strokeStyle = "#9b5cf6";
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.globalAlpha = partial ? .4 : .75;
      if (partial) ctx.setLineDash([ 10, 8 ]);
      ctx.beginPath();
      const start = client.myPlayer.pos.current;
      ctx.moveTo(start.x - offset.x, start.y - offset.y);
      for (let i = 0; i < waypoints.length; i++) {
        ctx.lineTo(waypoints[i].x - offset.x, waypoints[i].y - offset.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = partial ? .5 : .9;
      ctx.fillStyle = "#d9c2ff";
      for (let i = 4; i < waypoints.length; i += 5) {
        ctx.beginPath();
        ctx.arc(waypoints[i].x - offset.x, waypoints[i].y - offset.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (target !== null) {
      ctx.globalAlpha = .95;
      ctx.strokeStyle = "#9b5cf6";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(target.x - offset.x, target.y - offset.y, PATHBREAK_ARRIVE, 0, Math.PI * 2);
      ctx.stroke();
    }
    const blocker = module.blocker;
    if (blocker !== null && blocker !== undefined) {
      const blockerPos = blocker.pos.current;
      ctx.globalAlpha = .95;
      ctx.strokeStyle = "#c2383d";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(blockerPos.x - offset.x, blockerPos.y - offset.y, blocker.collisionScale + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // A route either works or it does nothing, and from the outside those look
    // identical — no path drawn could be a dead worker, a target that never got
    // set, or a search that found nothing. One line of state tells them apart
    // without a console, which this client tries fairly hard to keep shut.
    ctx.save();
    ctx.globalAlpha = .85;
    ctx.font = "600 13px Orbitron, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const plan = module.workerBlocked
      ? "search off (worker blocked) - walking straight"
      : module.waypoints.length > 0
        ? `${module.waypoints.length} ticks${module.reachesTarget ? "" : " (partial)"}`
        : module.pending ? "searching" : "no plan yet";
    const away = Math.round(client.myPlayer.pos.current.distance(target));
    const line = `PATH BREAK  ${away}u  |  ${plan}${blocker ? "  |  breaking" : ""}`;
    ctx.fillStyle = "rgba(0,0,0,.55)";
    const width = ctx.measureText(line).width;
    ctx.fillRect(12, 12, width + 16, 24);
    ctx.fillStyle = "#d9c2ff";
    ctx.fillText(line, 20, 17);
    ctx.restore();
  }

  (function _pathBreakLoop() {
    requestAnimationFrame(_pathBreakLoop);
    let module = null;
    try {
      module = _pathBreakModule();
    } catch (error) {
      return;
    }
    if (module === null || !module.active || !Settings_default._pathBreakRender || !client.myPlayer.inGame) {
      _removePathBreakOverlay();
      return;
    }
    try {
      _renderPathBreak(module);
    } catch (error) {}
  })();
