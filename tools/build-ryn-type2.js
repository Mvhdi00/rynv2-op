#!/usr/bin/env node
/*
 * build-ryn-type2.js
 *
 * Adds the single-target aim lock and the trap-enclosure gap-fill layer to
 * RYN Type 2 (v5.4), producing Ryn_Type_2_TargetLock.user.js.
 *
 * Type 2 is a different client from RYN v4: no AutoRetrap, no Glotus parity
 * mode, and the preplace / replace work lives in RynPlacementEngine rather
 * than in AutoPlacer. So the additions are anchored against Type 2's own
 * structures and reuse what it already has — TargetMotion for prediction,
 * SiegeAnalysis for escape geometry, lunaSpikeTickBusy for the Spike Tick
 * stand-down, and the engine's own scorer for the seal-exit weight.
 *
 *   node tools/build-ryn-type2.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/Ryn_Type_2.js");
const OUT = path.join(ROOT, "Ryn_Type_2_TargetLock.user.js");

let code = fs.readFileSync(BASE, "utf8");
const applied = [];

/* Every edit goes through here so a stale anchor fails the build loudly
 * instead of silently producing a half-patched script. */
function edit(label, find, replace) {
  const parts = code.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  code = parts[0] + replace + parts[1];
  applied.push(label);
}

/* ------------------------------------------------------------------ *
 * 1. Header
 * ------------------------------------------------------------------ */

edit(
  "header: name the build",
  `// @name           ! Ryn Type 2`,
  `// @name           ! Ryn Type 2 (Target Lock)`
);

/* ------------------------------------------------------------------ *
 * 2. Settings
 * ------------------------------------------------------------------ */

edit(
  "settings: target lock keys",
  `    _autoplacer: true,
    _prePlace: true,
    _replace: true,`,
  `    _autoplacer: true,
    _prePlace: true,
    _replace: true,
    _targetLock: true,
    _targetSwitchMargin: 60,
    _aimCircle: true,
    _aimCircleColor: "#8b5cf6",
    _trapGapFill: true,`
);

/* ------------------------------------------------------------------ *
 * 2b. Escape geometry
 *
 * The client already holds legality as continuous angular intervals on the
 * placement ring — GeometrySolver.occlusion / merge / invert — and that is the
 * right shape for the question the enclosure layer asks, which is the same
 * question turned around: which directions can the *target* still leave in.
 * SiegeAnalysis.isEscapable did not use it. It sorted the blockers by bearing,
 * paired each with its angular neighbour and measured the centre-to-centre
 * chord, which never accounts for how much of the circle a blocker actually
 * covers: a distant object counted as a wall, and one the target is already
 * standing against counted for no more than one 200 units away.
 *
 * Aurora computes the player's own free arcs exactly this way
 * (refs/Aurora_Client_v5.5.js:15802 mergeBlocked, :15832 invertArcs, :15717
 * closestPossibleAngles), so the algebra is prior art; what is new here is
 * pointing it at the enemy instead of at the placement ring.
 *
 * isEscapable is left exactly as it was — the non-gap-fill path still calls it.
 * ------------------------------------------------------------------ */

edit(
  "geometry: escape cone",
  `    // The arc of the placement ring a blocker removes.`,
  `    // The directions a body of radius selfR cannot leave (cx, cy) in, because
    // a blocker of radius blockR stands in the way. Unlike occlusion this is a
    // cone from a point rather than an arc of a fixed ring: the target walks
    // outward, it does not travel along a circle around itself.
    //
    // A blocker it is already overlapping denies every heading with a component
    // towards it, which is the half plane — asin is undefined there and
    // clamping it to a full circle would seal a box that has an obvious way
    // out.
    escapeCone(cx, cy, selfR, bx, by, blockR) {
      const dx = bx - cx, dy = by - cy;
      const d = Math.hypot(dx, dy);
      const reach = selfR + blockR;
      if (d < RPE_EPS) return "full";
      const centre = Math.atan2(dy, dx);
      if (d <= reach) return [ centre - Math.PI / 2, centre + Math.PI / 2 ];
      return [ centre - Math.asin(reach / d), centre + Math.asin(reach / d) ];
    },

    // The arc of the placement ring a blocker removes.`
);

edit(
  "siege: exact exit arcs",
  `    knockInto(spikeX, spikeY, objects, enemyX, enemyY, dir, playerHasPolearm) {`,
  `    // Every direction the target can still walk out in, as free arcs, plus how
    // much of the circle is closed. A free arc here is passable by construction
    // — the cones are cut at selfRadius + blockR, so a heading outside all of
    // them carries the whole body clear — which is why the count of arcs is not
    // the useful number. Coverage is: three objects in a line leave one enormous
    // opening and enclose nothing, three around a corner leave one small one and
    // enclose a great deal.
    exitArcs(cx, cy, selfRadius, objects) {
      const cones = [];
      for (const o of objects) {
        const arc = GeometrySolver.escapeCone(cx, cy, selfRadius, o.x, o.y, o.escapeScale);
        if (arc === null) continue;
        if (arc === "full") return {
          coverage: 1,
          exits: [],
          escapable: false
        };
        cones.push({
          arc: arc,
          obj: o,
          s: GeometrySolver.norm(arc[0]),
          e: GeometrySolver.norm(arc[1])
        });
      }
      if (cones.length === 0) return {
        coverage: 0,
        exits: [],
        escapable: true
      };
      const free = GeometrySolver.invert(GeometrySolver.merge(cones.map(c => c.arc)));
      let open = 0;
      for (const f of free) open += f[2];
      const coverage = Math.max(0, Math.min(1, 1 - open / RPE_TAU));
      const exits = [];
      for (const f of free) {
        // The two objects that form the mouth: the one whose cone ends where the
        // opening starts, and the one whose cone starts where it ends. After a
        // merge those edges are still exact cone edges, so this identifies the
        // real doorposts rather than the nearest thing to them — and when it
        // cannot, the exit carries no seal point and proposes no placement.
        const left = this.edgeOwner(cones, f[0], true);
        const right = this.edgeOwner(cones, f[1], false);
        let width = Infinity;
        let seal = null;
        if (left && right && left !== right) {
          width = Math.max(0, Math.hypot(right.obj.x - left.obj.x, right.obj.y - left.obj.y) - left.obj.escapeScale - right.obj.escapeScale);
          seal = {
            x: (left.obj.x + right.obj.x) / 2,
            y: (left.obj.y + right.obj.y) / 2
          };
        }
        exits.push({
          angle: GeometrySolver.norm(f[0] + f[2] / 2),
          edges: [ f[0], f[1] ],
          span: f[2],
          width: width,
          seal: seal,
          left: left ? left.obj : null,
          right: right ? right.obj : null
        });
      }
      return {
        coverage: coverage,
        exits: exits,
        escapable: exits.length > 0
      };
    },
    edgeOwner(cones, angle, wantEnd) {
      let best = null, bestD = Infinity;
      for (const c of cones) {
        const d = GeometrySolver.angleDist(wantEnd ? c.e : c.s, angle);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      return bestD <= .001 ? best : null;
    },
    knockInto(spikeX, spikeY, objects, enemyX, enemyY, dir, playerHasPolearm) {`
);

/* ------------------------------------------------------------------ *
 * 3. TargetLock
 *
 * Type 2 reads EnemyManager.nearestEnemy in two independent places:
 * ThreatAnalyzer.build(), which is the frame every mode of the placement
 * engine works from, and AutoPlacer.postTick(). Two selectors on the same
 * frame with no memory between ticks, so two equidistant enemies can be
 * picked differently by the two of them and either can flip every tick.
 *
 * This is the one selector both now go through. Prediction is deliberately
 * NOT reimplemented here: the engine already carries TargetMotion, which
 * tracks velocity, acceleration, heading stability and a confidence, and is
 * strictly better than extrapolating pos.future. TargetLock asks it for the
 * predicted point and only falls back to pos.future when the engine has not
 * seen this target yet.
 * ------------------------------------------------------------------ */

edit(
  "module: TargetLock",
  `  class AutoPlacer {`,
  `  class TargetLock {
    moduleName="targetLock";
    client;
    target=null;
    targetId=null;
    /* Bumped on every acquire and every release. Anything derived from an
     * older generation is stale by definition. */
    generation=0;
    valid=false;
    distance=Infinity;
    pos=new Vector_default;
    predicted=new Vector_default;
    velocity=new Vector_default;
    moveDir=0;
    speed=0;
    confidence=0;
    leadTicks=1;
    lockedTick=-1;
    lockedAt=0;
    lastSwitchTick=-1;
    _spin=0;
    _tick=-1;
    /* Render-only easing state for the predicted-position marker. Kept on the
     * lock rather than on the renderer so the generation that invalidates it is
     * the same one everything else keys off. */
    _drawX=null;
    _drawY=null;
    _drawGen=-1;
    constructor(client2) {
      this.client = client2;
    }
    get enabled() {
      return !!Settings_default._targetLock;
    }
    /* The configured targeting / placement range is the placer radius — the
     * same number the placement decisions are already gated on. */
    get range() {
      return Settings_default._autoplacerRadius ?? 350;
    }
    /* Held a little past the acquire range so a target sitting on the edge
     * does not drop and re-acquire on alternating ticks. */
    get holdRange() {
      return this.range + 60;
    }
    get switchMargin() {
      return Settings_default._targetSwitchMargin ?? 60;
    }
    reset() {
      this._release();
      this._tick = -1;
    }
    /* Validity is the client's existing definition, not a new one: the entry
     * has to be in PlayerManager.enemies for this tick — which is what makes
     * it alive, visible, not a teammate and not one of our own bots — still
     * an enemy by clan, and carrying a position. */
    isValidTarget(enemy) {
      if (!enemy || !enemy.pos || !enemy.pos.current) return false;
      const {PlayerManager: PlayerManager2, myPlayer: myPlayer} = this.client;
      if (!myPlayer || !myPlayer.inGame) return false;
      if (enemy === myPlayer) return false;
      if (enemy.currentHealth !== undefined && enemy.currentHealth <= 0) return false;
      if (!PlayerManager2 || !PlayerManager2.enemies) return false;
      if (PlayerManager2.enemies.indexOf(enemy) === -1) return false;
      try {
        if (!myPlayer.isEnemyByID(enemy.id)) return false;
      } catch (e) {
        return false;
      }
      return true;
    }
    activeTarget() {
      return this.valid ? this.target : null;
    }
    /* The prediction is only handed out for the locked target, so no caller
     * can end up aiming one enemy's predicted position at another. */
    predictedFor(enemy) {
      return this.valid && enemy === this.target ? this.predicted : null;
    }
    isStale(generation) {
      return generation !== this.generation;
    }
    _release() {
      if (this.target !== null) this.generation++;
      this.target = null;
      this.targetId = null;
      this.valid = false;
      this.distance = Infinity;
      this.confidence = 0;
    }
    _lock(enemy, tick) {
      if (enemy === this.target) return;
      this.target = enemy;
      this.targetId = enemy.id;
      this.generation++;
      this.lockedTick = tick;
      this.lockedAt = Date.now();
      this.lastSwitchTick = tick;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer, PlayerManager: PlayerManager2} = this.client;
      const tick = ModuleHandler.tickCount;
      /* Once per game tick. The renderer reads the cached fields at 60 fps
       * and never triggers a scan. */
      if (this._tick === tick) return;
      this._tick = tick;
      if (!this.enabled || !myPlayer || !myPlayer.inGame) {
        this._release();
        return;
      }
      const myPos = myPlayer.pos.current;
      let current = this.target;
      /* Cheapest path first: the locked target almost always survives, and
       * checking it costs one array lookup and one distance. */
      if (current !== null && !this.isValidTarget(current)) {
        this._release();
        current = null;
      }
      let currentDist = Infinity;
      if (current !== null) {
        currentDist = myPos.distance(current.pos.current);
        if (currentDist > this.holdRange) {
          this._release();
          current = null;
          currentDist = Infinity;
        }
      }
      /* A scan can only change the answer when nothing is locked or when
       * somebody else could be closer, so a single visible enemy never costs
       * one. Distances stay squared until a candidate actually wins. */
      const enemies = PlayerManager2 && PlayerManager2.enemies ? PlayerManager2.enemies : [];
      if (current === null || enemies.length > 1) {
        const range2 = this.range * this.range;
        let best = null;
        let bestDist2 = Infinity;
        for (let i = 0; i < enemies.length; i++) {
          const enemy = enemies[i];
          if (enemy === current) continue;
          const dist2 = myPos.distanceDefault(enemy.pos.current);
          if (dist2 > range2 || dist2 >= bestDist2) continue;
          if (!this.isValidTarget(enemy)) continue;
          bestDist2 = dist2;
          best = enemy;
        }
        if (best !== null) {
          if (current === null) {
            /* Nothing held: take it immediately. */
            this._lock(best, tick);
          } else if (tick - this.lastSwitchTick >= 2 && Math.sqrt(bestDist2) + this.switchMargin < currentDist) {
            /* Hysteresis: meaningfully closer, and not on the tick right
             * after the last switch. A -> B -> A cannot happen inside the
             * margin. */
            this._lock(best, tick);
          }
        }
      }
      this._refresh(myPos, tick);
    }
    _refresh(myPos, tick) {
      const target = this.target;
      if (target === null) {
        this.valid = false;
        this.distance = Infinity;
        this.confidence = 0;
        return;
      }
      const current = target.pos.current;
      const future = target.pos.future ?? current;
      this.pos._setXY(current.x, current.y);
      this.velocity._setXY(future.x - current.x, future.y - current.y);
      this.speed = Math.hypot(this.velocity.x, this.velocity.y);
      if (this.speed > .5) this.moveDir = Math.atan2(this.velocity.y, this.velocity.x);
      /* Dynamic network timing: how many ticks of travel the placement packet
       * still has to cover, capped at the engine's own preplace horizon. */
      const socket = this.client.SocketManager;
      const pong = socket && Number.isFinite(socket.pong) ? socket.pong : 0;
      const tickMs = socket && socket.TICK ? socket.TICK : 1e3 / 9;
      this.leadTicks = Math.max(1, Math.min(RPE_PREPLACE_MAX_LEAD, Math.round(pong / tickMs) + 1));
      /* Prediction comes from the engine's own TargetMotion — velocity,
       * acceleration, heading stability and a confidence, bounded by the
       * game's speed decay. Extrapolating pos.future here instead would be a
       * second, worse predictor of the same thing. */
      const engine = this.client._ModuleHandler.staticModules.placementEngine;
      let predicted = null;
      if (engine && engine.motion) {
        try {
          engine.motion.observe(target, tick);
          predicted = engine.motion.predict(target, this.leadTicks);
        } catch (e) {
          predicted = null;
        }
      }
      if (predicted) {
        this.predicted._setXY(predicted.x, predicted.y);
        this.confidence = predicted.confidence ?? 0;
      } else {
        this.predicted._setXY(current.x + this.velocity.x * this.leadTicks, current.y + this.velocity.y * this.leadTicks);
        this.confidence = .25;
      }
      this.distance = myPos.distance(current);
      this.valid = true;
    }
  }
  const TargetLock_default = TargetLock;
  class AutoPlacer {`
);

edit(
  "modules: register targetLock",
  `        autoPlacer: new AutoPlacer_default(client2),`,
  `        targetLock: new TargetLock_default(client2),
        autoPlacer: new AutoPlacer_default(client2),`
);

/* First in the list: AutoPlacer, the placement engine and the renderer all
 * read the ActiveTarget this leaves behind. */
edit(
  "modules: run targetLock first",
  `      this.modules = [ this.staticModules.autoAccept,`,
  `      this.modules = [ this.staticModules.targetLock, this.staticModules.autoAccept,`
);

/* ------------------------------------------------------------------ *
 * 4. Both selectors read the one ActiveTarget
 * ------------------------------------------------------------------ */

edit(
  "engine: the frame follows the locked target",
  `      const target = EnemyManager2.nearestEnemy;
      if (!target) {
        this.frameTick = tick;
        this.frame = null;
        return null;
      }`,
  `      /* One ActiveTarget for the whole engine. The frame is what preplace,
       * replace and auto all work from, so locking it here locks all three. */
      const lock = ModuleHandler.staticModules.targetLock;
      const target = lock && lock.enabled ? lock.activeTarget() : EnemyManager2.nearestEnemy;
      if (!target) {
        this.frameTick = tick;
        this.frame = null;
        return null;
      }`
);

/* frame.targetLock lets everything downstream reach the prediction and the
 * generation without another lookup, and frame.targetNext becomes the
 * ping-adjusted predicted point rather than a single damped tick. */
edit(
  "engine: predicted target position on the frame",
  `      const targetPos = target.pos.current;
      const targetNext = this._drift(target, true);`,
  `      const targetPos = target.pos.current;
      /* Where the target is going, not where it was. The lock's predicted
       * point is TargetMotion's own answer at the ping-derived lead; _drift
       * stays the fallback for when there is no lock. */
      const locked = lock && lock.predictedFor(target);
      const targetNext = locked ? {
        x: locked.x,
        y: locked.y
      } : this._drift(target, true);`
);

edit(
  "engine: carry the lock on the frame",
  `        targetId: target.id,
        targetTrapped: targetTrapped,`,
  `        targetId: target.id,
        targetLock: lock ?? null,
        targetGeneration: lock ? lock.generation : 0,
        targetTrapped: targetTrapped,`
);

edit(
  "autoplacer: follow the same locked target",
  `      const enemy = EnemyManager2.nearestEnemy;
      if (!enemy) return;

      const spikeId = myPlayer.getItemByType(LUNA_SPIKE_TYPE);`,
  `      const _lock = ModuleHandler.staticModules.targetLock;
      const enemy = _lock && _lock.enabled ? _lock.activeTarget() : EnemyManager2.nearestEnemy;
      if (!enemy) {
        this._lockGeneration = _lock ? _lock.generation : 0;
        return;
      }
      /* Target moved: every candidate, ban and booking below was scored
       * against the old one, so none of it survives. */
      if (_lock && this._lockGeneration !== _lock.generation) {
        this._lockGeneration = _lock.generation;
        this._predictObjects = [];
        this._placedAngles = [];
        this._bannedAngles.clear();
        this._angleCache.clear();
        this._angleCacheTick = -1;
        this._lastPrePlaceObj = null;
      }

      const spikeId = myPlayer.getItemByType(LUNA_SPIKE_TYPE);`
);

edit(
  "autoplacer: lock generation field",
  `  class AutoPlacer {
    moduleName="autoPlacer";
    client;`,
  `  class AutoPlacer {
    moduleName="autoPlacer";
    _lockGeneration=-1;
    client;`
);

/* The engine already replans when frame.targetId changes. Bookings outlive a
 * single frame, though, so a switch has to drop the ones made for the old
 * target as well. */
edit(
  "engine: drop bookings made for a target that is no longer locked",
  `      if (this._planIsStale(frame)) this._plan = [];
      this._planTargetId = frame.targetId;`,
  `      if (this._planIsStale(frame)) this._plan = [];
      /* A booking is a promise about where one particular target is going.
       * When the lock moves, every promise about the old one is void.
       * invalidateAll is the book's own retirement path, so the ledger tokens
       * the bookings were holding go back rather than leaking. */
      if (this._lockGeneration !== frame.targetGeneration) {
        this._lockGeneration = frame.targetGeneration;
        this._plan = [];
        this._replacePlan = [];
        this.book.invalidateAll("target-switch", this);
        this._enclosure = null;
      }
      this._planTargetId = frame.targetId;`
);

edit(
  "engine: lock generation field",
  `    _blockers=null;
    _blockersTick=-1;
    _exits=null;`,
  `    _blockers=null;
    _blockersTick=-1;
    _exits=null;
    _lockGeneration=-1;
    _enclosure=null;`
);

/* ------------------------------------------------------------------ *
 * 5. Trap enclosure + smart spike gap fill
 *
 * The engine already computed an exit list, but only from my own spikes and
 * traps, and only as a flat "does this candidate stand in some exit" bonus.
 * That misses three things the enclosure case needs: the enemy's own traps
 * and the map's obstacles are part of the box too; which exit the target is
 * actually running for matters more than any exit; and when one of my traps
 * is the wall a spike belongs in, nothing notices.
 *
 * So the analysis is widened in place rather than duplicated beside it. The
 * existing sealExit weight keeps working off ctx.exits exactly as before, and
 * the new escape-route term rides on top of it.
 * ------------------------------------------------------------------ */

edit(
  "engine: enclosure analysis replaces the narrower exit scan",
  `      // Escape analysis around the target is shared by every candidate that
      // wants to know whether it closes a way out.
      this._exits = null;
      if (frame.ourSpikes.length + frame.ourTraps.length >= 2) {
        const surround = [];
        for (const o of frame.ourSpikes.concat(frame.ourTraps)) {
          const d = frame.targetPos.distance(o.pos.current);
          if (d > frame.targetScale + o.collisionScale + 40) continue;
          surround.push({
            x: o.pos.current.x,
            y: o.pos.current.y,
            escapeScale: o.collisionScale
          });
        }
        if (surround.length >= 2) {
          const esc = SiegeAnalysis.isEscapable(frame.targetPos.x, frame.targetPos.y, frame.targetScale, surround);
          if (esc.escapable) this._exits = esc.exits;
        }
      }
      return frame;`,
  `      // Escape analysis around the target is shared by every candidate that
      // wants to know whether it closes a way out.
      this._enclosure = this._encloseAround(frame);
      this._exits = this._enclosure ? this._enclosure.exits : null;
      /* On the frame as well as on the engine, because AngleSolver.propose is
       * handed the frame and nothing else. Every path that reaches propose goes
       * through sense() first — cycle() calls sense() then generate(), and
       * onVacated() calls sense() before cycle() — so the field is always set
       * by the time an angle is proposed. */
      frame.enclosure = this._enclosure;
      return frame;`
);

edit(
  "engine: enclosure methods",
  `    _planIsStale(frame) {`,
  `    /* Everything near the target that constrains where it can go.
     *
     * Blocking is the game's own rule from checkCollision: an ignoreCollision
     * object does not push a player, with the single exception of a trap,
     * which locks the movement of anyone who is not its owner and not on the
     * owner's team. So the enemy's own traps are walls to walk around while
     * mine are walls that hold, and both shape the box.
     *
     * Ownership comes from the client's existing PlayerManager.isEnemyByID
     * rather than from position or appearance. */
    _blockersAroundTarget(frame) {
      const {ObjectManager: ObjectManager2, PlayerManager: PlayerManager2, myPlayer: myPlayer} = this.client;
      const targetPos = frame.targetPos;
      const target = frame.target;
      const reach = frame.targetScale + RPE_ENCLOSURE_REACH;
      const blockers = [];
      /* Search radius 2 on a 100-unit grid: a 500x500 window around the
       * target, never the map. */
      ObjectManager2.grid2D.query(targetPos.x, targetPos.y, 2, id => {
        const obj = ObjectManager2.objects.get(id);
        if (!obj || !obj.pos || !obj.pos.current) return false;
        const isPlayerObject = obj instanceof PlayerObject;
        const isTrap = isPlayerObject && obj.type === 15;
        let mine = false;
        let holdsTarget = false;
        if (isPlayerObject) {
          try {
            mine = obj.ownerID === myPlayer.id;
            holdsTarget = isTrap && PlayerManager2.isEnemyByID(obj.ownerID, target);
          } catch (e) {
            mine = false;
            holdsTarget = false;
          }
        }
        if (obj.canMoveOnTop && obj.canMoveOnTop() && !holdsTarget) return false;
        const scale = obj.collisionScale ?? obj.scale ?? 0;
        const dist = targetPos.distance(obj.pos.current);
        if (dist > reach + scale) return false;
        blockers.push({
          x: obj.pos.current.x,
          y: obj.pos.current.y,
          escapeScale: scale,
          dist: dist,
          isTrap: isTrap,
          mine: mine,
          holdsTarget: holdsTarget,
          obj: isPlayerObject ? obj : null
        });
        return false;
      });
      return blockers;
    }
    /* Which way the target leaves. TargetMotion's heading when it is moving
     * with a course worth believing; otherwise away from me, which is where a
     * cornered player breaks for.
     *
     * The track is read from the motion store rather than off frame.motion,
     * because sense() runs before predict() and onVacated() re-senses without
     * predicting at all, so the frame field is not set yet on either path.
     * observe() is idempotent within a tick, so asking here is free. */
    _escapeHeading(frame) {
      let motion = null;
      try {
        motion = this.motion.observe(frame.target, frame.tick);
      } catch (e) {
        motion = null;
      }
      if (motion && motion.speed > .5 && motion.heading !== null && motion.heading !== undefined && motion.stability > .35) {
        return motion.heading;
      }
      return Math.atan2(frame.targetPos.y - frame.myPos.y, frame.targetPos.x - frame.myPos.x);
    }
    /* The box, the ways out of it, the one the target is running for, and the
     * trap of mine that is standing where a spike belongs. Null when the
     * target is not meaningfully enclosed, which is when normal preplace and
     * replace should just get on with it. */
    _encloseAround(frame) {
      if (!Settings_default._trapGapFill) {
        /* The narrower original scan still feeds the existing sealExit
         * weight, so turning the layer off changes nothing else. */
        const surround = [];
        for (const o of frame.ourSpikes.concat(frame.ourTraps)) {
          const d = frame.targetPos.distance(o.pos.current);
          if (d > frame.targetScale + o.collisionScale + 40) continue;
          surround.push({
            x: o.pos.current.x,
            y: o.pos.current.y,
            escapeScale: o.collisionScale
          });
        }
        if (surround.length < 2) return null;
        const esc = SiegeAnalysis.isEscapable(frame.targetPos.x, frame.targetPos.y, frame.targetScale, surround);
        return esc.escapable ? {
          exits: esc.exits,
          escapeExit: null,
          blockers: surround,
          held: false,
          breakCandidate: null
        } : null;
      }
      /* Spike tick owns the tick while it is executing. The gap layer stands
       * down for it rather than competing over the same placement: with no
       * enclosure there is no gap candidate and no escape-route weight, and
       * normal preplace and replace carry on untouched. */
      if (lunaSpikeTickBusy(this.client._ModuleHandler)) return null;
      const blockers = this._blockersAroundTarget(frame);
      /* Two objects beside an enemy is not a box. */
      if (blockers.length < 3) return null;
      const held = blockers.some(b => b.holdsTarget && b.dist <= frame.targetScale + b.escapeScale);
      const survey = SiegeAnalysis.exitArcs(frame.targetPos.x, frame.targetPos.y, frame.targetScale, blockers);
      /* How much of the circle is shut, not how many openings are left. Counting
       * openings says a target with three traps in a line beside it is boxed in
       * — it has one gap, and the gap is most of the map. Coverage says what
       * "trapped or partially enclosed" actually means. One physically held in
       * my trap is not walking anywhere, so a leakier box around it still
       * counts. */
      if (survey.coverage < (held ? RPE_ENCLOSURE_HELD_COVER : RPE_ENCLOSURE_MIN_COVER)) return null;
      const exits = survey.exits;
      const heading = this._escapeHeading(frame);
      /* Sealed shut: nothing to fill, but this is exactly the case where one
       * of my own traps is the wall a spike belongs in. */
      if (exits.length === 0) {
        return {
          exits: [],
          escapeExit: null,
          coverage: survey.coverage,
          blockers: blockers,
          held: held,
          breakCandidate: this._blockingTrap(frame, blockers, heading)
        };
      }
      /* Which opening matters is decided by how close it is to the way the
       * target is already going. Width only breaks ties, and breaks them
       * towards the narrow one — that is the mouth a single spike can actually
       * close. Ranking on width first would send the spike to the widest hole
       * in the box, which is the one it cannot shut. */
      let escapeExit = null;
      let best = -Infinity;
      for (const exit of exits) {
        const off = GeometrySolver.angleDist(exit.angle, heading);
        const score = (Math.PI - off) * 100 - Math.min(exit.width, 400) * .05;
        if (score > best) {
          best = score;
          escapeExit = exit;
        }
      }
      return {
        exits: exits,
        escapeExit: escapeExit,
        coverage: survey.coverage,
        blockers: blockers,
        held: held,
        breakCandidate: this._blockingTrap(frame, blockers, heading)
      };
    }
    /* Which of my own traps is standing between the placer and an opening.
     *
     * Drop trap T, see what opens: if removing it would give the target a way
     * out that a spike could then stand in, T is what is in the way. Reported,
     * never acted on — issuing the break would mean choosing a weapon and an
     * attack angle, which is a second scheduler and an override of the spike
     * tick modules' decisions. The engine places into that ground by itself on
     * the first tick it frees up. */
    _blockingTrap(frame, blockers, heading) {
      let found = null;
      for (const blocker of blockers) {
        if (!blocker.isTrap || !blocker.mine || blocker.obj === null) continue;
        const without = blockers.filter(other => other !== blocker);
        if (without.length < 3) continue;
        const opened = SiegeAnalysis.exitArcs(frame.targetPos.x, frame.targetPos.y, frame.targetScale, without).exits;
        if (opened.length === 0) continue;
        const toTrap = Math.atan2(blocker.y - frame.targetPos.y, blocker.x - frame.targetPos.x);
        for (const exit of opened) {
          /* Worth breaking only when what it opens is the way the target is
           * already trying to go. Anything else is a hole they will not use
           * and one wall less. */
          const off = GeometrySolver.angleDist(exit.angle, heading);
          if (off > RPE_GAP_CONE) continue;
          /* And only when the trap is itself standing in that opening —
           * otherwise it is not what is in the way. */
          if (GeometrySolver.angleDist(toTrap, exit.angle) > RPE_GAP_CONE) continue;
          /* Alignment with the escape route decides; distance only breaks
           * ties, so a ring of traps at equal range cannot pick arbitrarily. */
          const score = (1 - off / RPE_GAP_CONE) * 100 - blocker.dist * .1;
          if (found === null || score > found.score) {
            found = {
              trap: blocker.obj,
              x: blocker.x,
              y: blocker.y,
              exit: exit,
              score: score
            };
          }
        }
      }
      this.client._gapFillBreak = found;
      return found;
    }
    _planIsStale(frame) {`
);

edit(
  "engine: constants for the enclosure layer",
  `  const RPE_PREPLACE_MAX_LEAD = 6;`,
  `  const RPE_PREPLACE_MAX_LEAD = 6;
  /* How far out from the target's own body an object still counts as part of
   * the box around it. */
  const RPE_ENCLOSURE_REACH = 130;
  /* How much of the circle around the target has to be shut before the gap
   * layer treats it as enclosed. The lower bar applies when one of my traps is
   * physically holding them, because then they are not walking out of the
   * remainder either. */
  const RPE_ENCLOSURE_MIN_COVER = .6;
  const RPE_ENCLOSURE_HELD_COVER = .4;`
);

/* ------------------------------------------------------------------ *
 * 5b. Gap-seal candidate generation
 *
 * Scoring an opening is not enough on its own: nothing proposed an angle that
 * stands in it, so the bonus only ever applied to a candidate that happened to
 * land there. laffer generates its preplace angles by sweeping 200 headings and
 * keeping the ones on the boundary between placeable and not
 * (refs/13ms_laffer_v2.js:12806 getPerfectAngles) — the useful placements are
 * the tangencies, not the samples. This client already solves that tangency
 * analytically as GeometrySolver.contactAngles, so the boundary angles against
 * the mouth of the opening come out of the geometry it already has, with no
 * sweep.
 *
 * The proposals are anchored to a validated exit with two identified doorposts.
 * When there is none, nothing is proposed — a widening pass that degrades into
 * "any angle near the enemy" is the spike spam this is supposed to avoid.
 * ------------------------------------------------------------------ */

edit(
  "angles: propose the mouth of the escape gap",
  `      push(GeometrySolver.nearestFree(apertures, toTarget), "intent");
      push(GeometrySolver.nearestFree(apertures, toNext), "intent");`,
  `      push(GeometrySolver.nearestFree(apertures, toTarget), "intent");
      push(GeometrySolver.nearestFree(apertures, toNext), "intent");
      /* The two angles that put this footprint against the centre of the
       * opening, plus the direct bearing snapped into legal ground. Three
       * proposals, only while the target is actually enclosed. */
      const enclosure = frame.enclosure;
      if (enclosure && enclosure.escapeExit && enclosure.escapeExit.seal) {
        const seal = enclosure.escapeExit.seal;
        for (const a of GeometrySolver.contactAngles(myPos.x, myPos.y, profile.ringR, profile.footR, seal.x, seal.y, 0)) {
          push(a, "gap");
        }
        push(GeometrySolver.nearestFree(apertures, Math.atan2(seal.y - myPos.y, seal.x - myPos.x)), "gap");
      }`
);

/* The escape route reaches the scorer alongside the exits the existing
 * sealExit weight already reads. */
edit(
  "engine: hand the escape route to the scorer",
  `      const ctx = {
        exits: this._exits,
        memory: this.memory,`,
  `      const ctx = {
        exits: this._exits,
        escapeExit: this._enclosure ? this._enclosure.escapeExit : null,
        enclosureHeld: this._enclosure ? this._enclosure.held : false,
        memory: this.memory,`
);

edit(
  "scorer: reward sealing the route the target is running for",
  `        if (ctx.exits && ctx.exits.length) {
          const toCand = Math.atan2(cand.y - frame.targetPos.y, cand.x - frame.targetPos.x);
          for (const exit of ctx.exits) {
            if (GeometrySolver.angleDist(toCand, exit.angle) < .45) {
              tactical += w.sealExit;
              reach += w.sealExit;
              break;
            }
          }
        }`,
  `        if (ctx.exits && ctx.exits.length) {
          const toCand = Math.atan2(cand.y - frame.targetPos.y, cand.x - frame.targetPos.x);
          for (const exit of ctx.exits) {
            if (GeometrySolver.angleDist(toCand, exit.angle) < .45) {
              tactical += w.sealExit;
              reach += w.sealExit;
              break;
            }
          }
          /* Any way out is worth closing; the one they are running for is
           * worth more, and worth more still when a trap of mine is already
           * holding them there. Scaled by how far into the gap the candidate
           * sits, so a spike squarely in the mouth beats one clipping its
           * edge — and by how much of the mouth the footprint actually takes
           * away, so the same spike is worth more in a 90-unit doorway than in
           * a 300-unit one. Alignment on its own scores those two the same,
           * and the second one does not close anything. */
          if (ctx.escapeExit) {
            const off = GeometrySolver.angleDist(toCand, ctx.escapeExit.angle);
            if (off < RPE_GAP_CONE) {
              const mouth = ctx.escapeExit.width;
              const fill = isFinite(mouth) && mouth > 1 ? Math.min(1, p.footR * 2 / mouth) : .35;
              const aim = (1 - off / RPE_GAP_CONE) * fill * (ctx.enclosureHeld ? w.escapeRouteHeld : w.escapeRoute);
              tactical += aim;
              reach += aim;
            }
          }
        }`
);

edit(
  "weights: escape-route seal",
  `    sealExit: 3.6,`,
  `    sealExit: 3.6,
    escapeRoute: 5.2,
    escapeRouteHeld: 8,`
);

edit(
  "constants: gap cone",
  `  const RPE_ENCLOSURE_REACH = 130;`,
  `  const RPE_ENCLOSURE_REACH = 130;
  /* Half-width of the mouth of a gap, in radians. A candidate outside this
   * arc is not standing in the opening. */
  const RPE_GAP_CONE = .85;`
);

/* ------------------------------------------------------------------ *
 * 6. Aim circle
 *
 * Display only. It reads TargetLock and draws; it never selects anything, and
 * because it keys off the render entity's interpolated position it follows
 * the target at frame rate without any smoothing of its own.
 * ------------------------------------------------------------------ */

edit(
  "renderer: drawAimLock",
  `    drawDanger(ctx, entity) {}`,
  `    drawDanger(ctx, entity) {}
    /* One ring on the locked enemy, one faint ring for the targeting radius
     * around me. Exactly one target exists, so exactly one of these is ever
     * drawn. */
    drawAimLock(ctx, entity, player, isMyPlayer, ModuleHandler) {
      if (!Settings_default._aimCircle || isMyPlayer || !entity.isPlayer) return;
      const lock = ModuleHandler.staticModules.targetLock;
      if (!lock || !lock.valid || entity.sid !== lock.targetId) return;
      const color = Settings_default._aimCircleColor || "#8b5cf6";
      /* Eased in over ~200 ms so a switch reads as a move, not a pop. */
      const fade = Math.max(0, Math.min(1, (Date.now() - lock.lockedAt) / 200));
      const radius = entity.scale + 14;
      /* The ring sits on the entity's interpolated render position, which the
       * game already smooths, so it never lags behind the enemy on screen. */
      Renderer_default.circle(ctx, entity.x, entity.y, radius, color, .85 * fade, 2.5);
      Renderer_default.circle(ctx, player.x, player.y, lock.range, color, .12 * fade, 1.5);
      const offset = RYN._offset;
      /* Where the placer is aiming, as opposed to who is locked — §6's two
       * different things, drawn as two different marks. The predicted point is
       * recomputed once per game tick and would strobe at 60 fps if it were
       * drawn raw, so it is eased towards at a rate derived from the frame time
       * rather than a fixed fraction: the same exponential Aurora uses for its
       * velocity ring (refs/Aurora_Client_v5.5.js:20636).
       *
       * Aurora's own version keeps that state in a static that nothing resets,
       * so on a target change its ring slides across the screen from the old
       * enemy to the new one. Here the generation is the reset: on a switch the
       * marker is placed, not eased. */
      if (lock._drawGen !== lock.generation || lock._drawX === null) {
        lock._drawX = lock.predicted.x;
        lock._drawY = lock.predicted.y;
        lock._drawGen = lock.generation;
      } else {
        const ease = Math.min(1, (this.step || 16) / 60);
        lock._drawX += (lock.predicted.x - lock._drawX) * ease;
        lock._drawY += (lock.predicted.y - lock._drawY) * ease;
      }
      Renderer_default.circle(ctx, lock._drawX, lock._drawY, 10, color, .5 * fade, 2);
      /* The opening the gap-fill layer is working, drawn across the arc of the
       * target's own ring that it spans. Absent whenever the layer has decided
       * the target is not enclosed, which is the same moment it stops acting. */
      const engine = ModuleHandler.staticModules.placementEngine;
      const enc = Settings_default._trapGapFill && engine ? engine._enclosure : null;
      if (enc && enc.escapeExit) {
        ctx.save();
        ctx.globalAlpha = .7 * fade;
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(entity.x - offset.x, entity.y - offset.y, radius + 16, enc.escapeExit.edges[0], enc.escapeExit.edges[0] + enc.escapeExit.span);
        ctx.stroke();
        ctx.restore();
      }
      if (!Settings_default._lowQuality) lock._spin = (lock._spin + .012) % 6.28;
      ctx.save();
      ctx.globalAlpha = .9 * fade;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.translate(entity.x - offset.x, entity.y - offset.y);
      ctx.rotate(lock._spin);
      for (let i = 0; i < 4; i++) {
        const mid = i * (Math.PI / 2);
        ctx.beginPath();
        ctx.arc(0, 0, radius + 7, mid - .17, mid + .17);
        ctx.stroke();
      }
      ctx.restore();
    }`
);

edit(
  "renderer: draw the aim lock on the active target",
  `      if (Settings_default._collisionHitbox) {
        Renderer_default.square(ctx, entity.x, entity.y, entity.scale, "#c7fff2", .5, 1);
      }`,
  `      this.drawAimLock(ctx, entity, player, isMyPlayer, ModuleHandler);
      if (Settings_default._collisionHitbox) {
        Renderer_default.square(ctx, entity.x, entity.y, entity.scale, "#c7fff2", .5, 1);
      }`
);

/* ------------------------------------------------------------------ *
 * 7. Menu
 * ------------------------------------------------------------------ */

function patchPage(constName, anchorHtml, insertHtml) {
  const declaration = `const ${constName} = `;
  const start = code.indexOf(declaration);
  if (start === -1) throw new Error(`page constant not found: ${constName}`);

  const lineEnd = code.indexOf("\n", start);
  const literal = code.slice(start + declaration.length, lineEnd).replace(/;\s*$/, "");

  // eslint-disable-next-line no-eval
  const html = eval(literal);
  const hits = html.split(anchorHtml).length - 1;
  if (hits === 0) throw new Error(`page anchor not found in ${constName}`);
  if (hits > 1) throw new Error(`page anchor is ambiguous (${hits} hits) in ${constName}`);

  const patched = html.replace(anchorHtml, insertHtml + anchorHtml);
  code =
    code.slice(0, start + declaration.length) +
    JSON.stringify(patched) +
    ";" +
    code.slice(lineEnd);
  applied.push(`menu: options added to ${constName}`);
}

patchPage(
  "Combat_default",
  `<div class="content-option">\r
                <label class="option-title" for="_prePlace">Preplace</label>`,
  `<div class="content-option">\r
                <label class="option-title" for="_targetLock">Single Target Lock</label>\r
                <label class="switch-checkbox">\r
                    <input id="_targetLock" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Preplace, Replace and the autoplacer all work one enemy: the closest valid one inside the autoplacer radius. Off goes back to each of them re-picking the nearest enemy every tick.</span>\r
            </div>\r
            <div class="content-option">\r
                <span class="option-title">Aim Circle</span>\r
                <div class="option-content">\r
                    <button class="reset-color" title="Reset Color"></button>\r
                    <input id="_aimCircleColor" type="color" title="Select Color">\r
                    <label class="switch-checkbox">\r
                        <input id="_aimCircle" type="checkbox"></input>\r
                        <span></span>\r
                    </label>\r
                </div>\r
                <span class="option-description">Ring on the locked enemy plus the targeting radius. Display only - it never picks the target.</span>\r
            </div>\r
            <div class="content-option">\r
                <span class="option-title">Target switch margin</span>\r
                <label class="slider">\r
                    <span class="slider-value"></span>\r
                    <input id="_targetSwitchMargin" type="range" step="5" min="0" max="200">\r
                </label>\r
                <span class="option-description">How much closer another enemy has to get before the lock moves to it. 0 switches on any tie.</span>\r
            </div>\r
            <div class="content-option">\r
                <label class="option-title" for="_survivalEngine">Survival Engine</label>\r
                <label class="switch-checkbox">\r
                    <input id="_survivalEngine" type="checkbox"></input>\r
                </label>\r
                <span class="option-description">One layer decides healing, shame and defensive gear. Shame is held at 0 by never answering a hit inside the game's 120ms window unless the hit would kill you. Off returns Auto Heal to the old rule.</span>\r
            </div>\r
            <div class="content-option">\r
                <label class="option-title" for="_survivalSoldier">Threat Soldier</label>\r
                <label class="switch-checkbox">\r
                    <input id="_survivalSoldier" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Lets the threat layer ask for Soldier against things Safe Soldier cannot see - a turret stack, a ranged sequence, a spike push still closing. Safe Soldier keeps the proximity case.</span>\r
            </div>\r
            <div class="content-option">\r
                <label class="option-title" for="_microEvasion">Projectile Sidestep</label>\r
                <label class="switch-checkbox">\r
                    <input id="_microEvasion" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">One tick sideways out of an incoming arrow, bullet or turret shot, using the square hitbox the server actually tests. Only when the step is clear of buildings, spikes and traps, clears every shot in the air, and there is time to make it. Movement returns to you the moment nothing is incoming.</span>\r
            </div>\r
            <div class="content-option">\r
                <label class="option-title" for="_trapGapFill">Trap Gap Fill</label>\r
                <label class="switch-checkbox">\r
                    <input id="_trapGapFill" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">When the locked enemy is boxed in, reads the whole box - my traps, their traps, obstacles - and pushes the placer at the opening they are running for.</span>\r
            </div>\r
            `
);

/* ================================================================== *
 * 9. SURVIVAL LAYER — auto heal, shame, threat, defence, packets
 *
 * The shame rule the whole rework turns on, from the shipped bundle
 * (src/game_index.js:2454-2469, changeHealth at :2417-2431):
 *
 *   · changeHealth sets hitTime ONLY when the change is negative. Damage arms
 *     it; healing does not.
 *   · The first eat after a hit CONSUMES hitTime. Its timing decides the
 *     verdict: <= 120ms adds one shame, > 120ms takes two off. Every further
 *     eat before the next hit skips the block entirely and is free.
 *   · Eight shame is a thirty-second refusal to eat at all.
 *
 * So shame is not a budget to spend down from 7. It is a penalty for
 * answering a hit too fast, and it costs nothing to avoid: wait out the
 * window, then eat as much as you like. That is what makes 0 the operating
 * point rather than 7.
 * ------------------------------------------------------------------ */

edit(
  "settings: survival engine",
  `    _targetLock: true,`,
  `    _survivalEngine: true,
    _survivalSoldier: true,
    _microEvasion: true,
    _targetLock: true,`
);

edit(
  "module: survival layer",
  `  class AntiInsta {`,
  fs.readFileSync(path.join(__dirname, "inject/survival.js"), "utf8") + `  class AntiInsta {`
);

edit(
  "modules: register survival",
  `        targetLock: new TargetLock_default(client2),`,
  `        survival: new SurvivalEngine_default(client2),
        targetLock: new TargetLock_default(client2),`
);

/* Ahead of everything, targetLock included: the shame verdict, the threat list
 * and the packet reservation have to be settled before any module asks whether
 * it can afford to act. */
edit(
  "modules: run survival first",
  `      this.modules = [ this.staticModules.targetLock,`,
  `      this.modules = [ this.staticModules.survival, this.staticModules.targetLock,`
);

/* ---- the one heal path ------------------------------------------------- *
 * What was here queued every heal that fell inside a 130ms post-damage window
 * and flushed the queue at the top of a later tick. Three things were wrong
 * with it, and the first one kills:
 *
 *   1. The emergency heal went through the same queue. AntiInsta's own comment
 *      said "the emergency branch deliberately does not wait: +1 shame is a
 *      better outcome than dying" — and then called heal(), which waited. A
 *      heal decided at +10ms did not reach the wire until the first tick
 *      boundary at or after +130ms, so up to ~220ms later, with the follow-up
 *      hit already landed.
 *   2. The window was ping-blind here (`sinceHit <= 130`) and ping-aware in
 *      AntiInsta.isSaveHealTime (`elapsed + pong >= 125`). At 100ms ping the
 *      caller said safe and the callee queued anyway, for another 100ms.
 *   3. It re-applied the window to every apple of a top-up, when the server
 *      consumes hitTime on the first one and cannot judge the rest.
 * ------------------------------------------------------------------------ */

edit(
  "handler: heal through the survival layer",
  `    _SHAME_GUARD_MARGIN=130;
    _shameHealQueue=0;
    _shameHealDeadline=null;
    _rawHeal() {
      this.selectItem(2);
      this.attack(null, 1);
      this.whichWeapon(this._getPredictWeapon());
    }
    _healBudgetLeft() {
      return this.packetLimit - this.packetCount;
    }
    heal() {
      if (this._healBudgetLeft() < 3) return;
      const myPlayer = this.client.myPlayer;
      if (myPlayer && !myPlayer.isSandbox && myPlayer.receivedDamage) {
        const sinceHit = Date.now() - myPlayer.receivedDamage;
        if (sinceHit <= this._SHAME_GUARD_MARGIN) {
          this._shameHealQueue = Math.min(this._shameHealQueue + 1, 12);
          this._shameHealDeadline = myPlayer.receivedDamage + this._SHAME_GUARD_MARGIN;
          return;
        }
      }
      this._rawHeal();
    }
    _flushShameHealQueue() {
      if (this._shameHealQueue <= 0 || this._shameHealDeadline === null) return;
      if (Date.now() < this._shameHealDeadline) return;
      const affordable = Math.max(0, Math.floor(this._healBudgetLeft() / 3));
      const count = Math.min(this._shameHealQueue, affordable);
      this._shameHealQueue -= count;
      if (this._shameHealQueue <= 0) {
        this._shameHealQueue = 0;
        this._shameHealDeadline = null;
      }
      for (let i = 0; i < count; i++) {
        this._rawHeal();
      }
    }`,
  `    _rawHeal() {
      this.selectItem(2);
      this.attack(null, 1);
      this.whichWeapon(this._getPredictWeapon());
    }
    _healBudgetLeft() {
      return this.packetLimit - this.packetCount;
    }
    get _survival() {
      return this.staticModules ? this.staticModules.survival : null;
    }
    /* The only way food reaches the wire. Returns whether it went, so a caller
     * that wanted several can stop asking the moment one is refused instead of
     * looping against a budget that is already spent.
     *
     * urgent means the damage on the table this tick is at or above our health.
     * It buys exactly one thing: permission to eat inside the shame window,
     * because one shame is cheaper than the round. It does not buy packets past
     * the limit — nothing does. */
    heal(urgent = false) {
      const survival = this._survival;
      if (!survival) {
        if (this._healBudgetLeft() < SV_HEAL_COST) return false;
        this._rawHeal();
        return true;
      }
      const priority = urgent ? SV_THREAT.LETHAL : SV_THREAT.DAMAGE;
      const owner = urgent ? "survival" : undefined;
      if (!survival.budget.canAfford(SV_HEAL_COST, priority, owner)) return false;
      const myPlayer = this.client.myPlayer;
      if (myPlayer && myPlayer.shameActive) return false;
      /* The centralised shame gate. One place decides, and the emergency is the
       * only thing that passes it — which is what the old comment claimed and
       * the old code did not do. Even the emergency stops short of the eat that
       * would trip the thirty-second ban, because a ban is not survivable
       * either. */
      if (!urgent && !(myPlayer && myPlayer.isSandbox) && survival.shame.verdict() === "shameful") return false;
      if (urgent && survival.shame.wouldBan()) return false;
      this._rawHeal();
      survival.shame.noteEat();
      survival.noteHealSent(this.tickCount, myPlayer ? myPlayer.tempHealth : 0);
      return true;
    }`
);

edit(
  "handler: drop the old heal queue flush",
  `    postTick() {
      this._flushShameHealQueue();
      if (Settings_default._circleRotation && this.move_dir === null) {`,
  `    postTick() {
      if (Settings_default._circleRotation && this.move_dir === null) {`
);

/* ---- AntiInsta becomes the executor, not the decider -------------------- */

edit(
  "autoheal: execute the survival plan",
  `      const quiet = this.isSaveHealTick() && this.isSaveHealTime();
      if (!((healing && shameCount < 7) || quiet)) {
        return;
      }`,
  `      /* The decision now belongs to the survival layer, which settled it at
       * the top of this tick against the game's actual shame rule, the threat
       * list and the packet reservation. What is left here is carrying it out.
       *
       * The old condition was \`(healing && shameCount < 7) || quiet\`: heal
       * while shame is under seven, or when a tick passed quietly. That treats
       * seven as the operating ceiling — it will happily run the count from 0
       * to 6 and only then stop — and it cannot tell the difference between an
       * eat that costs a shame and one the server cannot judge at all. */
      const survival = ModuleHandler.staticModules.survival;
      if (survival && Settings_default._survivalEngine) {
        const plan = survival.plan;
        if (!plan.allow || plan.count === 0) return;
        this.forceHeal = plan.urgent;
        if (plan.urgent) ModuleHandler.didAntiInsta = true;
        ModuleHandler.healedOnce = true;
        /* In-flight accounting lives in the survival layer now, because every
         * apple goes through ModuleHandler.heal and AntiInsta is no longer the
         * only thing that asks for one. */
        for (let i = 0; i < plan.count; i++) {
          if (!ModuleHandler.heal(plan.urgent)) break;
        }
        return;
      }
      const quiet = this.isSaveHealTick() && this.isSaveHealTime();
      if (!((healing && shameCount < 7) || quiet)) {
        return;
      }`
);

/* ---- the second heal scheduler goes ------------------------------------- *
 * AntiSync kept its own: _pendingHealDeadline / _pendingHealsNeeded /
 * _SHAME_SAFE_DELAY = 139, a private copy of the same window on a private
 * timer. §26 and §30 both say one. Its detection stays exactly as it was; only
 * the deferral is handed over.
 * ------------------------------------------------------------------------ */

edit(
  "antisync: one heal scheduler, not two",
  `        const safeToEatInstantly = myPlayer.isSandbox || myPlayer.shameCount < 7;
        if (safeToEatInstantly) {
          for (let i = 0; i < healsNeeded; i++) {
            ModuleHandler.heal();
          }
        } else {
          this._pendingHealDeadline = Date.now() + this._SHAME_SAFE_DELAY;
          this._pendingHealsNeeded = healsNeeded;
        }`,
  `        /* A detected sync kill is a lethal sequence by definition, so this is
         * the urgent path: it eats through the window rather than deferring
         * into the middle of it. The survival layer refuses the one eat that
         * would trip the ban and nothing else. */
        for (let i = 0; i < healsNeeded; i++) {
          if (!ModuleHandler.heal(true)) break;
        }`
);

/* The deferral queue itself, now that nothing fills it. Left in place it is
 * dead code that still reads as a second scheduler. */
edit(
  "antisync: remove the orphaned deferral queue",
  `      if (this._pendingHealDeadline !== null) {
        if (Date.now() >= this._pendingHealDeadline) {
          for (let i = 0; i < this._pendingHealsNeeded; i++) {
            ModuleHandler.heal();
          }
          this._pendingHealDeadline = null;
          this._pendingHealsNeeded = 0;
        }
        ModuleHandler.shouldAttack = false;
        ModuleHandler.moduleActive = false;
        return;
      }
`,
  ``
);

edit(
  "placer: shame verdict rather than a count of seven",
  `        if (myPlayer.shameCount < 7) {
          ModuleHandler.heal();
          ModuleHandler.healedOnce = true;
          ModuleHandler.didAntiInsta = true;
        }`,
  `        if (ModuleHandler.heal()) {
          ModuleHandler.healedOnce = true;
          ModuleHandler.didAntiInsta = true;
        }`
);

/* ---- one hat manager ---------------------------------------------------- *
 * ShameReset owned the Bull decision and AntiInsta's cascade owned Soldier,
 * with nothing between them. The decision moves to DefenceState, which is the
 * only thing that now writes forceHat for defensive reasons. ShameReset keeps
 * its detection and defers.
 * ------------------------------------------------------------------------ */

edit(
  "shamereset: defer the hat to the defence manager",
  `    postTick() {
      const {_ModuleHandler: ModuleHandler} = this.client;
      if (Settings_default._autoheal && !this.notSave() && (this.shouldReset || this.tickToggle)) {
        this.tickToggle = true;
        ModuleHandler.moduleActive = true;
        ModuleHandler.forceHat = 7;
      }
    }`,
  `    postTick() {
      const {_ModuleHandler: ModuleHandler} = this.client;
      /* One defensive hat decision per tick, taken by DefenceState. Two
       * managers writing forceHat is how a client ends up flicking between
       * Bull and Soldier on alternating ticks under a threat that wants one of
       * them held. */
      if (Settings_default._survivalEngine && ModuleHandler.staticModules.survival) return;
      if (Settings_default._autoheal && !this.notSave() && (this.shouldReset || this.tickToggle)) {
        this.tickToggle = true;
        ModuleHandler.moduleActive = true;
        ModuleHandler.forceHat = 7;
      }
    }`
);

/* Minimal integration with Safe Soldier, which the brief says not to rebuild
 * and which is not rebuilt: its own three conditions are untouched and its
 * clear-down branch still runs. One more case is ORed in — the threats
 * proximity cannot see, which is the whole reason a threat layer exists. */
edit(
  "safe soldier: accept a request from the defence manager",
  `        if (Settings_default._antienemy && _isDanger || _isClose || _safeSoldier) {`,
  `        const _survivalSoldier = !!(this.staticModules.survival && this.staticModules.survival.wantSoldier);
        if (Settings_default._antienemy && _isDanger || _isClose || _safeSoldier || _survivalSoldier) {`
);

/* ------------------------------------------------------------------ *
 * 10. Console handle
 * ------------------------------------------------------------------ */

edit(
  "bridge: RYN._TargetLock",
  `    _config: {},`,
  `    /* Read-only view of the one ActiveTarget, for checking what the placer
     * is actually locked onto. */
    get _TargetLock() {
      return client._ModuleHandler.staticModules.targetLock;
    },
    _config: {},`
);

/* ------------------------------------------------------------------ */

fs.writeFileSync(OUT, code);

console.log("built", path.relative(ROOT, OUT));
console.log(`  ${(code.length / 1024).toFixed(0)} KB, ${code.split("\n").length} lines\n`);
for (const step of applied) console.log("  + " + step);
