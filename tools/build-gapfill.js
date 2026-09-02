#!/usr/bin/env node
/*
 * build-gapfill.js
 *
 * Builds RYN_GapFill.user.js from RYN Client v5.4 + Auto Heal Engine, adding
 * one feature: trap enclosure gap fill.
 *
 *   node tools/build-gapfill.js
 *
 * The feature is a tactical layer on the Ryn Placement Engine, not a second
 * placer. v5 already owns everything it needs:
 *
 *   ActiveTarget      ThreatAnalyzer.build() -> frame.target, which is
 *                     EnemyManager.nearestEnemy — the same target preplace,
 *                     replace and the aim already follow
 *   geometry          GeometrySolver.occlusion/merge/invert, the same solver
 *                     the engine uses for its own placement ring
 *   prediction        TargetMotion (measured velocity, acceleration,
 *                     confidence), not a second predictor
 *   reservations      PlacementLedger + PreplaceBook + PlacementMemory, which
 *                     is what already stops two placements taking one slot
 *   execution         PlacementScheduler -> PlacementPlanner -> validate ->
 *                     PlacementExecutor, with its packet budget and batching
 *
 * So the layer adds exactly three things: it measures the target's own escape
 * ring the same way the engine measures its placement ring, it proposes a
 * handful of angles aimed at the opening the target is predicted to leave
 * through, and it prices "closes that opening" as one more scoring term.
 * Everything after that is the pipeline that was already there.
 *
 * Every edit is anchored to an exact string in the base client; a missing or
 * ambiguous anchor fails the build rather than producing a half-patched script.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/RYN_Client_v5.js");
const OUT = path.join(ROOT, "RYN_GapFill.user.js");

let code = fs.readFileSync(BASE, "utf8");
const applied = [];

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
  `// @description     ! have fun — v5.4 plus a new Auto Heal Engine: shame control, predictive defense and threat priority, built from the game bundle`,
  `// @description     ! have fun — v5.4 plus the Auto Heal Engine and trap enclosure gap fill: when the locked target is boxed in, the placement engine seals the way out`
);

/* ------------------------------------------------------------------ *
 * 2. Constants
 *
 * The escape ring is one short step outside the target's own body — the ground
 * they have to cross to leave — and a way out has to be wide enough to walk
 * through. The occlusion already accounts for the target's body, so the width
 * below is the slack on top of it.
 * ------------------------------------------------------------------ */

edit(
  "constants: gap fill",
  `  const RPE_PREPLACE_MIN_CONFIDENCE = .3;`,
  `  const RPE_PREPLACE_MIN_CONFIDENCE = .3;

  // ── gap fill ──────────────────────────────────────────────────────────────
  // The target's escape ring: one step outside their body, measured with the
  // same solver the engine measures its own placement ring with.
  const RPE_GAP_RING_STEP = 20;
  // Slack a way out needs before it counts as walkable, in world units at the
  // ring. The occlusion has already taken the target's own radius out.
  const RPE_GAP_MIN_WIDTH = 10;
  // How much of the ring has to be closed before "boxed in" means anything.
  // Lower once something is actually holding them, because a pinned target is
  // not going to walk around the long way.
  const RPE_GAP_MIN_RATIO = .55;
  const RPE_GAP_PINNED_RATIO = .35;
  const RPE_GAP_MAX_EXITS = 3;
  // A trap only counts as the one denying the spike if it sits on the side the
  // target is leaving from, and breaking it has to buy this much score.
  const RPE_GAP_BREAK_ARC = Math.PI / 3;
  const RPE_GAP_BREAK_GAIN = .6;`
);

/* ------------------------------------------------------------------ *
 * 3. Weights
 *
 * Kept in the same table as every other weight, so the layer is tunable the
 * same way the rest of the engine is (and at runtime through
 * ModuleHandler.staticModules.placementEngine.weights).
 * ------------------------------------------------------------------ */

edit(
  "weights: gap fill terms",
  `    sealExit: 3.6,
    capture: 3,`,
  `    sealExit: 3.6,
    // gap fill: taking away a share of the way out, closing it outright, and
    // sitting on the route the target is actually taking
    gapCover: 3.6,
    gapSeal: 5.4,
    gapEscape: 2.4,
    capture: 3,`
);

/* ------------------------------------------------------------------ *
 * 4. Geometry
 *
 * Two pure functions, in the same style as the rest of GeometrySolver: how
 * long an arc is, and how much of one arc lies inside another. Measuring how
 * much of a way out a build takes away is exactly that second question.
 * ------------------------------------------------------------------ */

edit(
  "geometry: arc span and overlap",
  `    inAperture(apertures, angle) {`,
  `    // Length of an arc in radians, wrap included.
    arcSpan(arc) {
      if (arc === "full") return RPE_TAU;
      const raw = arc[1] - arc[0];
      if (raw >= RPE_TAU - RPE_EPS) return RPE_TAU;
      const span = raw % RPE_TAU;
      return span < 0 ? span + RPE_TAU : span;
    },

    // How much of arc b lies inside arc a. Both may wrap, so b is measured in
    // a's frame and both of its possible positions are counted.
    arcOverlap(a, b) {
      if (a === "full") return this.arcSpan(b);
      if (b === "full") return this.arcSpan(a);
      const aSpan = this.arcSpan(a), bSpan = this.arcSpan(b);
      if (aSpan <= RPE_EPS || bSpan <= RPE_EPS) return 0;
      let offset = this.norm(b[0]) - this.norm(a[0]);
      if (offset < 0) offset += RPE_TAU;
      const piece = (start, end) => Math.max(0, Math.min(aSpan, end) - Math.max(0, start));
      return Math.min(aSpan, piece(offset, offset + bSpan) + piece(offset - RPE_TAU, offset - RPE_TAU + bSpan));
    },

    inAperture(apertures, angle) {`
);

/* ------------------------------------------------------------------ *
 * 5. Coverage
 *
 * The one measurement the feature rests on, written once and read by both the
 * scorer (to price a candidate) and the break check (to compare two worlds).
 * ------------------------------------------------------------------ */

edit(
  "geometry: gap coverage",
  `  // ── World model ───────────────────────────────────────────────────────────`,
  `  // How much of a way out a footprint at (x, y) takes away, asked of the
  // target's escape ring with the same occlusion the engine asks of its own
  // placement ring. Null when the build does not reach the ring at all.
  //
  // \`seals\` is deliberately conservative: the residual is the whole opening
  // minus what is covered, which is an upper bound on the largest piece left,
  // so a build is only called a seal when nothing walkable can remain.
  function rpeGapCoverage(enclosure, exit, targetPos, targetScale, x, y, footR) {
    const arc = GeometrySolver.occlusion(targetPos.x, targetPos.y, enclosure.ring, targetScale, x, y, footR);
    if (!arc) return null;
    const span = GeometrySolver.arcSpan(exit);
    if (span <= RPE_EPS) return null;
    const covered = GeometrySolver.arcOverlap(exit, arc);
    if (covered <= RPE_EPS) return null;
    const residual = Math.max(0, span - covered);
    return {
      covered: covered,
      share: covered / span,
      residual: residual,
      seals: 2 * enclosure.ring * Math.sin(Math.min(Math.PI, residual) / 2) < RPE_GAP_MIN_WIDTH
    };
  }

  // ── World model ───────────────────────────────────────────────────────────`
);

/* ------------------------------------------------------------------ *
 * 6. Scoring
 *
 * One more term in the same weighted sum. Because scoring is central, this
 * prices gap sealing on every candidate the engine has — auto, preplace and
 * replace alike — rather than only on the ones the layer proposes.
 * ------------------------------------------------------------------ */

edit(
  "scorer: gap fill term",
  `      terms.tactical = tactical;
      cand.reach = reach;`,
  `      // Gap fill ----------------------------------------------------------
      // What this build does to the way out the target is predicted to leave
      // through. Worth the share of the opening it takes away, worth more
      // again when nothing walkable is left, and worth more still when it sits
      // on the route they are actually taking.
      let gapfill = 0;
      const encl = ctx.enclosure;
      if (p.isDamage && encl && encl.enclosed && encl.primary) {
        const cover = rpeGapCoverage(encl, encl.primary, frame.targetPos, frame.targetScale, cand.x, cand.y, p.footR);
        if (cover && cover.share > .05) {
          gapfill = w.gapCover * cover.share;
          if (cover.seals) gapfill += w.gapSeal;
          const toCand = Math.atan2(cand.y - frame.targetPos.y, cand.x - frame.targetPos.x);
          gapfill += w.gapEscape * Math.max(0, Math.cos(GeometrySolver.angleDist(toCand, encl.heading)));
          reach += gapfill;
        }
      }
      terms.gapfill = gapfill;

      terms.tactical = tactical;
      cand.reach = reach;`
);

/* ------------------------------------------------------------------ *
 * 7. Scheduling
 *
 * A gap fill is due when it is planned. It is not waiting for the target to
 * arrive somewhere — it is taking away the ground they are about to use — so
 * it is deadline-driven like the vacating case rather than interception-driven.
 * ------------------------------------------------------------------ */

edit(
  "scheduler: gap fill is due on its deadline",
  `      if (cand.kind === "vacating") return tick >= cand.dueTick;`,
  `      if (cand.kind === "vacating" || cand.kind === "gapfill") return tick >= cand.dueTick;`
);

/* ------------------------------------------------------------------ *
 * 8. Engine state
 * ------------------------------------------------------------------ */

edit(
  "engine: enclosure state",
  `    _exits=null;
    constructor(client2) {`,
  `    _exits=null;
    _enclosure=null;
    _enclosureTick=-1;
    constructor(client2) {`
);

edit(
  "engine: clear enclosure on reset",
  `      this._blockers = null;
      this._blockersTick = -1;
    }`,
  `      this._blockers = null;
      this._blockersTick = -1;
      this._enclosure = null;
      this._enclosureTick = -1;
    }`
);

/* ------------------------------------------------------------------ *
 * 9. Enclosure analysis, candidate generation, break check
 *
 * The escape ring is measured with GeometrySolver.occlusion, exactly as the
 * placement ring is: every blocker that would stop the target walking removes
 * an arc, merge unions them, invert hands back the ways out. What blocks is
 * read from the game's own rule (PlayerManager.canMoveOnTop): resources always,
 * an ignoreCollision building never, and a trap only for whoever its owner
 * counts as an enemy — ownership from PlayerManager.isEnemyByID, never guessed
 * from position.
 * ------------------------------------------------------------------ */

edit(
  "engine: enclosure, gap candidates, break check",
  `    // ── SENSE ───────────────────────────────────────────────────────────────
    // One sweep, one frame, shared by every mode in this cycle.
    sense() {`,
  `    // ── gap fill ────────────────────────────────────────────────────────────
    // Ownership is asked of the game's tables, never inferred. isEnemyByID
    // throws for an owner we have not seen yet, and an unknown owner counts as
    // hostile, which is the conservative read.
    _hostileTo(object, entity) {
      try {
        return this.client.PlayerManager.isEnemyByID(object.ownerID, entity);
      } catch (e) {
        return true;
      }
    }

    // The target's own escape ring, measured the same way the engine measures
    // its placement ring. Blockers occlude arcs, what is left is where they can
    // leave, and how much is left is what "boxed in" means.
    //
    // Reuses the blocker sweep the engine already did this tick, so this costs
    // arithmetic over a list, not a second query.
    _enclosureOf(frame) {
      if (!this._blockers || !frame.target) return null;
      const ring = frame.targetScale + RPE_GAP_RING_STEP;
      const reach = ring + frame.targetScale;
      const arcs = [], blockers = [];
      const myPlayer = this.client.myPlayer;
      for (const obj of this._blockers) {
        if (obj instanceof PlayerObject) {
          const item = Items[obj.type];
          // canMoveOnTop, asked about the target: a pass-through building stops
          // nobody, except a trap, which stops whoever its owner counts as an
          // enemy. Their own trap and a teammate's, they walk straight over.
          if (item && item.ignoreCollision) {
            if (obj.type !== 15) continue;
            if (!this._hostileTo(obj, frame.target)) continue;
          }
        }
        const pos = obj.pos.current;
        const distance = Math.hypot(pos.x - frame.targetPos.x, pos.y - frame.targetPos.y);
        const blockR = obj.collisionScale;
        if (distance > reach + blockR) continue;
        const arc = GeometrySolver.occlusion(frame.targetPos.x, frame.targetPos.y, ring, frame.targetScale, pos.x, pos.y, blockR);
        if (!arc) continue;
        arcs.push(arc);
        const isPlayerObject = obj instanceof PlayerObject;
        blockers.push({
          object: obj,
          x: pos.x,
          y: pos.y,
          distance: distance,
          angle: Math.atan2(pos.y - frame.targetPos.y, pos.x - frame.targetPos.x),
          trap: isPlayerObject && obj.type === 15,
          spike: isPlayerObject && obj.itemGroup === 2,
          mine: isPlayerObject && myPlayer.isMyPlayerByID(obj.ownerID),
          holds: isPlayerObject && obj.type === 15 && distance <= blockR + frame.targetScale
        });
      }
      // One blocker is a wall to walk around, not an enclosure.
      if (blockers.length < 2) return null;
      const free = GeometrySolver.invert(GeometrySolver.merge(arcs));
      let open = 0;
      const exits = [];
      for (const ap of free) {
        open += ap[2];
        // Wide enough to actually walk through, not just to touch.
        if (2 * ring * Math.sin(Math.min(Math.PI, ap[2]) / 2) >= RPE_GAP_MIN_WIDTH) exits.push(ap);
      }
      const ratio = 1 - open / RPE_TAU;
      // Where they are going: the measured heading while they are moving, and
      // away from us when they are not, which is where a cornered player goes.
      const moving = frame.motion && frame.motion.heading !== null && frame.motion.speed > .5;
      const heading = moving ? frame.motion.heading : Math.atan2(frame.targetPos.y - frame.myPos.y, frame.targetPos.x - frame.myPos.x);
      let primary = null, best = -Infinity;
      for (const ap of exits) {
        const mid = GeometrySolver.norm(ap[0] + ap[2] / 2);
        // On their route, narrow enough to be worth sealing, and near enough
        // to us to be reachable at all.
        let score = Math.cos(GeometrySolver.angleDist(mid, heading)) * 2 - ap[2] * .35;
        const px = frame.targetPos.x + ring * Math.cos(mid);
        const py = frame.targetPos.y + ring * Math.sin(mid);
        score -= Math.hypot(px - frame.myPos.x, py - frame.myPos.y) / 200;
        if (score > best) {
          best = score;
          primary = ap;
        }
      }
      const pinned = !!frame.targetTrapped || blockers.some(b => b.holds);
      const floor = pinned ? RPE_GAP_PINNED_RATIO : RPE_GAP_MIN_RATIO;
      return {
        ring: ring,
        blockers: blockers,
        exits: exits,
        primary: primary,
        heading: heading,
        moving: moving,
        pinned: pinned,
        ratio: ratio,
        // Sealed already, or wide open, and there is nothing here to fill.
        enclosed: primary !== null && exits.length <= RPE_GAP_MAX_EXITS && ratio >= floor
      };
    }

    // One measurement per tick, whoever asks first. Autobreak runs before the
    // engine in the module order, so the break check can be the one to trigger
    // it; both then read the same answer.
    // Switched off means not measured, so nothing downstream can price a gap
    // the feature is not supposed to be looking at.
    _enclosureFor(frame) {
      if (this._enclosureTick === frame.tick) return this._enclosure;
      this._enclosureTick = frame.tick;
      this._enclosure = Settings_default._gapFill ? this._enclosureOf(frame) : null;
      return this._enclosure;
    }

    // Angles that point at the opening. The ring scan has no reason to ask
    // about this direction in particular, which is the whole point of the
    // layer: it is a reason for a candidate to exist, not a new way to place.
    _gapAngles(profile, frame, apertures) {
      const encl = this._enclosure;
      if (!encl || !encl.primary || apertures.length === 0) return [];
      const mid = GeometrySolver.norm(encl.primary[0] + encl.primary[2] / 2);
      const mouthX = frame.targetPos.x + encl.ring * Math.cos(mid);
      const mouthY = frame.targetPos.y + encl.ring * Math.sin(mid);
      const out = [];
      const seen = new Set;
      const push = angle => {
        if (angle === null || angle === undefined || !isFinite(angle)) return;
        if (!GeometrySolver.inAperture(apertures, angle)) return;
        const key = this.memory.key(profile, angle);
        if (seen.has(key)) return;
        seen.add(key);
        out.push(GeometrySolver.norm(angle));
      };
      // Straight at the mouth, snapped onto legal ground...
      push(GeometrySolver.nearestFree(apertures, Math.atan2(mouthY - frame.myPos.y, mouthX - frame.myPos.x)));
      // ...the two angles where our footprint just touches it, which are the
      // placements that cover the opening rather than sit beside it...
      for (const a of GeometrySolver.contactAngles(frame.myPos.x, frame.myPos.y, profile.ringR, profile.footR, mouthX, mouthY, frame.targetScale)) {
        push(a);
      }
      // ...and the edges of the aperture the mouth falls in, where a packed
      // build goes.
      const ap = GeometrySolver.inAperture(apertures, Math.atan2(mouthY - frame.myPos.y, mouthX - frame.myPos.x));
      if (ap) {
        const inset = Math.min(.03, ap[2] / 3);
        push(GeometrySolver.norm(ap[0] + inset));
        push(GeometrySolver.norm(ap[1] - inset));
      }
      return out;
    }

    // Candidates for the opening. They carry mode PREPLACE like everything
    // else the tick generates, so they are booked, held, planned, validated,
    // budgeted and executed by the pipeline that was already there.
    _generateGapFill(pool, profile, frame) {
      if (!Settings_default._gapFill) return;
      // A spike is what closes a way out; a trap is what catches someone
      // walking into one, and the engine already prices that.
      if (!profile.isDamage) return;
      const encl = this._enclosure;
      if (!encl || !encl.enclosed) return;
      // A spike tick owns the tick it fires on. The layer proposes nothing
      // rather than competing with it for the same packets.
      if (lunaSpikeTickBusy(this.client._ModuleHandler)) return;
      const apertures = this._generator.apertures(profile, frame.myPos.x, frame.myPos.y, this._blockers, null);
      if (apertures.length === 0) return;
      for (const angle of this._gapAngles(profile, frame, apertures)) {
        const x = frame.myPos.x + profile.ringR * Math.cos(angle);
        const y = frame.myPos.y + profile.ringR * Math.sin(angle);
        // Ground already spoken for by a booked candidate is not offered again.
        if (this.book.has(x, y, profile.footR)) continue;
        const hit = this.motion.intercept(frame.target, x, y, profile.footR + frame.targetScale, RPE_PREPLACE_MAX_LEAD);
        // Belief, not merit: how much the prediction behind the opening is
        // worth. A pinned target is not going anywhere, so the reading of where
        // they will leave from is worth more, not less.
        const base = encl.pinned ? .9 : Math.max(RPE_PREPLACE_MIN_CONFIDENCE, frame.motion ? frame.motion.stability : .5);
        pool.push(this._candidate(profile, angle, apertures, RPE_MODE.PREPLACE, {
          source: "gap",
          kind: "gapfill",
          confidence: hit ? Math.max(base, hit.confidence) : base,
          interceptTick: hit ? hit.tick : 0,
          dueTick: frame.tick
        }));
      }
    }

    // The best gap fill available, in score terms, with one object optionally
    // taken out of the world. This is what makes "would breaking it help?" a
    // measurement rather than a guess.
    _gapBest(frame, profile, exclude) {
      const encl = this._enclosure;
      if (!encl || !encl.primary) return 0;
      const apertures = this._generator.apertures(profile, frame.myPos.x, frame.myPos.y, this._blockers, exclude || null);
      if (apertures.length === 0) return 0;
      const w = this.weights;
      let best = 0;
      for (const angle of this._gapAngles(profile, frame, apertures)) {
        const x = frame.myPos.x + profile.ringR * Math.cos(angle);
        const y = frame.myPos.y + profile.ringR * Math.sin(angle);
        const cover = rpeGapCoverage(encl, encl.primary, frame.targetPos, frame.targetScale, x, y, profile.footR);
        if (!cover || cover.share <= .05) continue;
        let value = w.gapCover * cover.share;
        if (cover.seals) value += w.gapSeal;
        const toCand = Math.atan2(y - frame.targetPos.y, x - frame.targetPos.x);
        value += w.gapEscape * Math.max(0, Math.cos(GeometrySolver.angleDist(toCand, encl.heading)));
        if (value > best) best = value;
      }
      return best;
    }

    // A trap of mine denies a spike the fifty units of placement scale around
    // it, so the trap parked on the opening is often the reason nothing can be
    // placed there. This answers whether taking one out would buy a better
    // spike; Autobreak owns the swing, because breaking things is its job and
    // not the placement engine's.
    //
    // Never the trap holding the target — letting them out is not an
    // improvement — and never one that is not on the side they are leaving by.
    gapFillBreakTarget() {
      if (!Settings_default._gapFill || !Settings_default._gapFillBreak) return null;
      const myPlayer = this.client.myPlayer;
      if (!myPlayer || !myPlayer.inGame || !myPlayer.canPlace(4)) return null;
      // Asked from Autobreak, which runs first, so the frame, the motion track
      // and the blocker sweep are built here rather than assumed. All three are
      // tick-cached, so the engine's own cycle reads the same ones later.
      const frame = this._threat.build();
      if (!frame || !frame.target) return null;
      if (!frame.motion) frame.motion = this.motion.observe(frame.target, frame.tick);
      this._ensureBlockers(frame.myPos, frame.tick);
      const encl = this._enclosureFor(frame);
      if (!encl || !encl.enclosed || !encl.primary) return null;
      const profile = this.profileFor(4);
      if (!profile || !profile.isDamage) return null;
      const mid = GeometrySolver.norm(encl.primary[0] + encl.primary[2] / 2);
      let best = this._gapBest(frame, profile, null);
      let pick = null;
      for (const blocker of encl.blockers) {
        if (!blocker.mine || !blocker.trap) continue;
        if (blocker.holds) continue;
        if (frame.targetTrapped && blocker.object.id === frame.targetTrapped.id) continue;
        if (GeometrySolver.angleDist(blocker.angle, mid) > RPE_GAP_BREAK_ARC) continue;
        const after = this._gapBest(frame, profile, blocker.object);
        if (after > best + RPE_GAP_BREAK_GAIN) {
          best = after;
          pick = blocker.object;
        }
      }
      return pick;
    }

    // ── SENSE ───────────────────────────────────────────────────────────────
    // One sweep, one frame, shared by every mode in this cycle.
    sense() {`
);

/* The enclosure is measured after motion, because which way out matters
 * depends on which way they are going. */
edit(
  "engine: measure the enclosure each cycle",
  `      frame.motion = this.motion.observe(frame.target, tick);
      this.stats.dropped = this.book.sweep(tick, frame, this);`,
  `      frame.motion = this.motion.observe(frame.target, tick);
      this._enclosureFor(frame);
      this.stats.dropped = this.book.sweep(tick, frame, this);`
);

edit(
  "engine: generate gap fill candidates",
  `        if (trigger.modes.indexOf(RPE_MODE.PREPLACE) !== -1) {
          this._generatePreplace(pool, profile, frame, trigger);
        }`,
  `        if (trigger.modes.indexOf(RPE_MODE.PREPLACE) !== -1) {
          this._generatePreplace(pool, profile, frame, trigger);
          this._generateGapFill(pool, profile, frame);
        }`
);

edit(
  "engine: enclosure into the scoring context",
  `      const ctx = {
        exits: this._exits,
        memory: this.memory,
        batched: false,
        replace: trigger.replace || null
      };`,
  `      const ctx = {
        exits: this._exits,
        enclosure: this._enclosure,
        memory: this.memory,
        batched: false,
        replace: trigger.replace || null
      };`
);

/* ------------------------------------------------------------------ *
 * 10. The break
 *
 * Autobreak already owns "break something because it is worth breaking", and
 * already runs before the placer with the reload, range and one-hit checks the
 * swing needs. The engine says which trap; this branch does the swinging, in
 * the same shape as the beneficial-break branch below it.
 * ------------------------------------------------------------------ */

edit(
  "autobreak: break the trap denying the gap fill",
  `      const beneficial = this._beneficialBreakTarget(myPlayer, EnemyManager2.nearestEnemy, ObjectManager3, PlayerManager3);`,
  `      // The trap of mine standing where the gap-filling spike needs to go.
      // The engine decided it is worth removing; this only asks whether the
      // swing is available.
      const engine = ModuleHandler.staticModules.placementEngine;
      const denying = engine && engine.gapFillBreakTarget ? engine.gapFillBreakTarget() : null;
      if (denying) {
        const {reloading: reloading} = ModuleHandler.staticModules;
        const type = this.getDestroyingWeapon(denying);
        if (type !== null && reloading.isReloaded(type)) {
          const weapon = myPlayer.getItemByType(type);
          const damage = myPlayer.getBuildingDamage(weapon, ModuleHandler.canBuy(0, 40));
          // One swing or none: a half-broken trap denies the ground just as
          // well as a whole one, and the tick is spent either way.
          if (damage >= denying.health) {
            ModuleHandler.moduleActive = true;
            ModuleHandler.forceWeapon = type;
            ModuleHandler.useAngle = myPlayer.pos.current.angle(denying.pos.current);
            ModuleHandler.shouldAttack = true;
            return;
          }
        }
      }
      const beneficial = this._beneficialBreakTarget(myPlayer, EnemyManager2.nearestEnemy, ObjectManager3, PlayerManager3);`
);

/* ------------------------------------------------------------------ *
 * 11. Settings
 *
 * Gap fill rides the preplace pass, so it follows Autoplacer like Preplace and
 * Replace do. The break is opt-in on its own: it spends a tick and one of my
 * own traps, which is a different kind of decision from placing a spike.
 * ------------------------------------------------------------------ */

edit(
  "settings: gap fill keys",
  `    _prePlace: true,
    _replace: true,`,
  `    _prePlace: true,
    _replace: true,
    _gapFill: true,
    _gapFillBreak: false,`
);

/* ------------------------------------------------------------------ *
 * 12. Menu
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
  if (hits > 1) throw new Error(`page anchor is ambiguous in ${constName}`);
  code =
    code.slice(0, start + declaration.length) +
    JSON.stringify(html.replace(anchorHtml, insertHtml + anchorHtml)) +
    ";" +
    code.slice(lineEnd);
  applied.push(`menu: options added to ${constName}`);
}

patchPage(
  "Combat_default",
  '<div class="content-option">\r\n                <label class="option-title" for="_spikeSync">Spike sync</label>',
  `<div class="content-option">\r
                <label class="option-title" for="_gapFill">Trap Gap Fill</label>\r
                <label class="switch-checkbox">\r
                    <input id="_gapFill" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">When the locked target is boxed in by traps, spikes or terrain, measures the ways out they have left, works out which one they are leaving by, and prices closing it into the placement engine. Rides the Preplace pass, so it needs Preplace on.</span>\r
            </div>\r
            <div class="content-option">\r
                <label class="option-title" for="_gapFillBreak">Gap Fill Trap Break</label>\r
                <label class="switch-checkbox">\r
                    <input id="_gapFillBreak" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Lets Autobreak take out one of your own traps when its placement scale is what denies the sealing spike, and only when the engine can measure a better spike on the other side of it. Never the trap holding the target.</span>\r
            </div>\r
            `
);

/* ------------------------------------------------------------------ */

fs.writeFileSync(OUT, code);

console.log("built", path.relative(ROOT, OUT));
console.log(`  ${(code.length / 1024).toFixed(0)} KB, ${code.split("\n").length} lines\n`);
for (const step of applied) console.log("  + " + step);
