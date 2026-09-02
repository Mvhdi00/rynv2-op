#!/usr/bin/env node
/*
 * build-reup.js
 *
 * Builds ReUp_Mix.user.js from the RYN v4 client, folding in the Luna features
 * RYN never had and correcting one driver table against the shipped game bundle.
 *
 * RYN is the base rather than Luna because only RYN speaks the protocol the
 * current game actually uses: the per-connection opcode permutation plus the
 * truncated-HMAC frame prefix in src/game_index.js. Luna 1.1 is a fork of the
 * old webpack bundle and predates that transport entirely, so its features are
 * ported across as modules instead of its code being merged in.
 *
 *   node tools/build-reup.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/RYN_Client_v4.js");
const OUT = path.join(ROOT, "ReUp_Mix.user.js");
const DRIVERS = JSON.parse(
  fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8")
);

let code = fs.readFileSync(BASE, "utf8");
const applied = [];

/* Every edit goes through here so a stale anchor fails the build loudly
 * instead of silently producing a half-merged script. */
function edit(label, find, replace) {
  const parts = code.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  code = parts[0] + replace + parts[1];
  applied.push(label);
}

/* ------------------------------------------------------------------ *
 * 1. Userscript header
 * ------------------------------------------------------------------ */

const header = `// ==UserScript==
// @name            ReUp Mix (Luna x Ryn)
// @namespace       reup-mix
// @author          Mix build - RYN v4 by Raptor, Luna Client by Luna & Skye (help from Zenith and XTRFY)
// @description     RYN v4 core on the current protocol, with the Luna-only features folded in
// @version         1.0.0
// @match           *://moomoo.io/
// @match           *://moomoo.io/?server*
// @match           *://*.moomoo.io/
// @match           *://*.moomoo.io/?server*
// @run-at          document-start
// @grant           none
// @license         MIT
// ==/UserScript==
`;

{
  const end = code.indexOf("// ==/UserScript==");
  if (end === -1) throw new Error("could not find end of base userscript header");
  code = header + code.slice(end + "// ==/UserScript==".length).replace(/^\r?\n/, "\n");
  applied.push("header: rewritten for ReUp Mix");
}

/* ------------------------------------------------------------------ *
 * 2. Drop the phone-home beacon
 *
 * RYN v4 opens with a fetch to a webhook.site endpoint on first run, gated by
 * a localStorage flag. It sends nothing but the hit itself, but it is an
 * unannounced call to a third party the user never agreed to, so it goes.
 * ------------------------------------------------------------------ */

{
  const beacon = code.match(
    /\(function\(\) \{\s*try \{\s*if \(!localStorage\.getItem\("_ryn_sent"\)\)[\s\S]*?\}\)\(\);\s*/
  );
  if (!beacon) throw new Error("anchor not found: webhook beacon");
  code = code.replace(
    beacon[0],
    "/* removed in ReUp Mix: RYN v4's first-run beacon to webhook.site */\n\n"
  );
  applied.push("privacy: removed first-run webhook.site beacon");
}

/* ------------------------------------------------------------------ *
 * 3. Branding
 * ------------------------------------------------------------------ */

edit(
  "branding: window title",
  `  if (document.title !== "Ryn") document.title = "Ryn";`,
  `  if (document.title !== "ReUp Mix") document.title = "ReUp Mix";`
);

/* ------------------------------------------------------------------ *
 * 4. Driver correction
 *
 * verify-drivers.js flags item group 8 (the platform / "watchtower" group) as
 * layer -1 in RYN, while the shipped bundle has layer 1. PlayerObject reads
 * ItemGroups[group].layer straight into its own .layer, which every collision
 * and placement check keys off, so the wrong value makes the client treat
 * platforms as a pass-under layer like traps and boost pads.
 * ------------------------------------------------------------------ */

edit(
  "drivers: item group 8 layer -1 -> 1 (matches shipped bundle)",
  `    [8]: {
      name: "Plaftorm",
      limit: 12,
      layer: -1
    },`,
  `    [8]: {
      name: "Plaftorm",
      limit: 12,
      layer: 1
    },`
);

/* ------------------------------------------------------------------ *
 * 5. Settings for the ported Luna features
 * ------------------------------------------------------------------ */

edit(
  "settings: ReUp keys",
  `    _lunaMigration: 0,`,
  `    _spikeRotation: true,
    _millRotation: true,
    _usernameCycler: false,
    _usernameList: "Luna1, Luna2, Luna3",
    _usernameIndex: 0,
    _menuTheme: "ryn",
    _lunaMigration: 0,`
);

/* ------------------------------------------------------------------ *
 * Autoplacer item-limit check
 *
 * AutoPlacer._isItemLimit read `group.sandboxLimit || 99` and never looked at
 * `group.limit`, so outside sandbox the cap was 99 for everything without a
 * sandboxLimit (spikes 15, traps 6, turrets 2, mines 1) and 299 for the three
 * that have one. The limit gate therefore effectively never fired, and the
 * placer kept spending placement ticks on items it could not place.
 *
 * This came from Luna, which has the same expression. The rest of the client
 * already gets it right: ClientPlayer.getItemCount picks sandboxLimit only when
 * actually in sandbox and falls back to group.limit otherwise, and AutoRetrap's
 * own _isItemLimit is written against that. AutoPlacer is switched to the same
 * call so all three agree.
 * ------------------------------------------------------------------ */

edit(
  "autoplacer: honour real item-group limits",
  `    _isItemLimit(id, myPlayer) {
      const group = ItemGroups[Items[id].itemGroup];
      const limit = ("sandboxLimit" in group ? group.sandboxLimit : null) || 99;
      const count = myPlayer.itemCount.get(Items[id].itemGroup) || 0;
      return count >= limit;
    }`,
  `    _isItemLimit(id, myPlayer) {
      const {count: count, limit: limit} = myPlayer.getItemCount(Items[id].itemGroup);
      return count >= limit;
    }`
);

/* Legit Mode flips every boolean setting off. The ported toggles are cosmetic
 * (rotation) or naming (cycler), so they sit alongside the other exclusions
 * rather than being reset along with the combat automation. */
edit(
  "settings: keep ReUp toggles out of Legit Mode",
  `"_botAttackStagger" ]);`,
  `"_botAttackStagger", "_spikeRotation", "_millRotation", "_usernameCycler" ]);`
);

/* ------------------------------------------------------------------ *
 * Trap enclosure + smart spike gap fill
 *
 * A tactical layer inside AutoPlacer, not a second placer. When the placer's
 * ActiveTarget (EnemyManager.nearestEnemy — the same target the aim, the
 * preplacer and the replacer already follow) is boxed in by traps, spikes or
 * terrain, it works out which way they are going to leave and prepares the
 * closest spike that seals that opening.
 *
 * Everything it decides is expressed as one entry in AutoPlacer._predictObjects,
 * the list the preplace and immediate paths at the end of postTick already
 * drain, so it inherits the existing packet budget, ping-synced timing and
 * anti-duplicate rules instead of owning any of them. It selects no target,
 * schedules no packet, and stands down for the whole tick whenever Spike Tick
 * has claimed it.
 *
 * The geometry comes from the game's own definitions:
 *   - PlayerManager.canMoveOnTop for what actually blocks movement (resources
 *     always, ignoreCollision buildings never, a trap only for whoever its
 *     owner counts as an enemy),
 *   - PlayerObject.collisionScale / Items[].scale for the radii,
 *   - the chord test out of SiegeAnalysis.isEscapable for whether the target
 *     still fits through an opening,
 *   - PlayerManager.isEnemyByID for ownership — never appearance or position.
 * ------------------------------------------------------------------ */

edit(
  "settings: trap gap fill keys",
  `    _preplacer: false,
    _replacer: false,`,
  `    _preplacer: false,
    _replacer: false,
    _trapGapFill: false,
    _trapGapFillBreak: false,`
);

edit(
  "autoplacer: trap enclosure gap-fill layer",
  `  class AutoPlacer {
    moduleName="autoPlacer";
    _glotusAngles=new Map;
    _glotusCount=0;`,
  `  class AutoPlacer {
    moduleName="autoPlacer";
    _glotusAngles=new Map;
    _glotusCount=0;
    // ══════════════════════════════════════════════════════════════════════
    // TRAP ENCLOSURE + SMART SPIKE GAP FILL
    //
    // Reads the geometry around the ActiveTarget, finds the opening they are
    // most likely to leave through, and hands the closest spike that seals it
    // to _predictObjects — the same list the preplace/immediate paths at the
    // end of postTick already drain. No target selection, no scheduler, no
    // packet of its own, and never on top of Spike Tick.
    // ══════════════════════════════════════════════════════════════════════
    _GAP_BAND=62;             // how far past the target's own hitbox a blocker still counts
    _GAP_RANGE=260;           // beyond this the target is out of reach of any placement
    _GAP_MIN_ENCLOSURE=.55;   // share of the circle that has to be blocked to call it enclosed
    _GAP_TRAPPED_ENCLOSURE=.35; // ...lower once a trap is actually holding them
    _GAP_REPLACE_MARGIN=18;   // a new position has to beat the committed one by this much
    _GAP_BREAK_COOLDOWN=8;
    _GAP_BREAK_GAIN=55;       // a break has to open up at least this good a spike
    _gapFill={
      targetId: null,
      tick: -1,
      analysis: null,
      committed: null,
      breakTick: -1,
      pendingBreak: null,
      errorUntil: -1
    };
    _gapNormalize(angle) {
      let a = angle % PI2;
      if (a > PI) a -= PI2;
      if (a < -PI) a += PI2;
      return a;
    }
    // Ownership comes from the game's tables, never from appearance or
    // coordinates. isEnemyByID throws for an owner we have not seen yet, and an
    // unknown owner counts as an enemy — the conservative read.
    _gapIsEnemyOf(object, entity, PlayerManager2) {
      try {
        return PlayerManager2.isEnemyByID(object.ownerID, entity);
      } catch (e) {
        return true;
      }
    }
    // Everything within reach of the target that actually stops them moving,
    // by PlayerManager.canMoveOnTop's rules. One grid query, two cells wide —
    // no map-wide scan.
    _gapBlockers(ctx) {
      const {target: target, ObjectManager2: ObjectManager2, PlayerManager2: PlayerManager2, myPlayer: myPlayer} = ctx;
      const pos = target.pos.current;
      const selfScale = target.collisionScale;
      const reach = selfScale + this._GAP_BAND;
      const out = [];
      ObjectManager2.grid2D.query(pos.x, pos.y, 2, id => {
        const object = ObjectManager2.objects.get(id);
        if (!object) return;
        const isPlayerObject = object instanceof PlayerObject;
        let trapsTarget = false;
        if (isPlayerObject) {
          const item = Items[object.type];
          if ("ignoreCollision" in item) {
            // A trap is the one pass-through building that still stops
            // somebody: whoever its owner counts as an enemy. Their own trap,
            // and a teammate's, they walk straight over.
            if (object.type !== 15) return;
            if (!this._gapIsEnemyOf(object, target, PlayerManager2)) return;
            trapsTarget = true;
          }
        }
        const objPos = object.pos.current;
        const scale = object.collisionScale;
        const distance = Math.hypot(objPos.x - pos.x, objPos.y - pos.y);
        if (distance > reach + scale) return;
        out.push({
          object: object,
          x: objPos.x,
          y: objPos.y,
          scale: scale,
          distance: distance,
          angle: Math.atan2(objPos.y - pos.y, objPos.x - pos.x),
          trap: isPlayerObject && object.type === 15,
          spike: isPlayerObject && object.itemGroup === 2,
          mine: isPlayerObject && myPlayer.isMyPlayerByID(object.ownerID),
          friendly: isPlayerObject && !this._gapIsEnemyOf(object, myPlayer, PlayerManager2),
          trapsTarget: trapsTarget,
          holding: trapsTarget && distance <= scale + selfScale
        });
      });
      return out;
    }
    // Angular occupancy around the target: each blocker covers the arc it would
    // physically stop them walking through. The complement of the merged arcs is
    // the set of openings — so a ring of traps that leaves a hole reads as
    // enclosed, and three traps off to one side do not.
    _gapAnalyse(target, blockers) {
      const selfScale = target.collisionScale;
      const spans = [];
      for (const b of blockers) {
        // The trap they are standing in holds them, it does not wall off a
        // side: it decides that they are pinned (below), while the openings
        // are still the ones they would take on the way out.
        if (b.holding) continue;
        const sum = b.scale + selfScale;
        const half = b.distance <= sum ? PI / 2 : Math.asin(Math.min(1, sum / b.distance));
        const start = this._gapNormalize(b.angle - half);
        const end = this._gapNormalize(b.angle + half);
        if (start <= end) {
          spans.push([ start, end ]);
        } else {
          spans.push([ start, PI ]);
          spans.push([ -PI, end ]);
        }
      }
      spans.sort((a, b) => a[0] - b[0]);
      const merged = [];
      for (const span of spans) {
        const last = merged[merged.length - 1];
        if (last && span[0] <= last[1]) {
          if (span[1] > last[1]) last[1] = span[1];
        } else {
          merged.push([ span[0], span[1] ]);
        }
      }
      let blocked = 0;
      for (const span of merged) blocked += span[1] - span[0];
      const gaps = [];
      if (merged.length === 0) {
        gaps.push({
          start: -PI,
          end: PI,
          span: PI2,
          mid: 0,
          left: null,
          right: null,
          passable: true
        });
      } else {
        for (let i = 0; i < merged.length; i++) {
          const start = merged[i][1];
          let end = merged[(i + 1) % merged.length][0];
          if (merged.length === 1) {
            end = merged[0][0] + PI2;
          } else if (end < start) {
            end += PI2;
          }
          const span = end - start;
          if (span <= .001) continue;
          gaps.push({
            start: start,
            end: end,
            span: span,
            mid: this._gapNormalize(start + span / 2),
            left: null,
            right: null,
            passable: true
          });
        }
      }
      for (const gap of gaps) {
        let left = null, right = null, leftDist = Infinity, rightDist = Infinity;
        for (const b of blockers) {
          const toStart = getAngleDist(b.angle, gap.start);
          if (toStart < leftDist) {
            leftDist = toStart;
            left = b;
          }
          const toEnd = getAngleDist(b.angle, gap.end);
          if (toEnd < rightDist) {
            rightDist = toEnd;
            right = b;
          }
        }
        gap.left = left;
        gap.right = right;
        gap.passable = gap.span >= 1.2 || this._gapFits(left, right, selfScale);
      }
      const passable = gaps.filter(g => g.passable);
      const held = blockers.some(b => b.holding);
      const ratio = blocked / PI2;
      const floor = held ? this._GAP_TRAPPED_ENCLOSURE : this._GAP_MIN_ENCLOSURE;
      return {
        blockers: blockers,
        gaps: gaps,
        passable: passable,
        blockedRatio: ratio,
        held: held,
        sealed: blockers.length > 0 && passable.length === 0,
        enclosed: blockers.length >= 2 && ratio >= floor && passable.length > 0 && passable.length <= 3
      };
    }
    // Does the target still fit out between these two blockers? Same chord test
    // SiegeAnalysis.isEscapable uses, so an opening this layer calls closed is
    // the one the placer's own seals-exit rule calls closed.
    _gapFits(left, right, selfScale) {
      if (!left || !right || left === right) return true;
      const between = getAngleDist(left.angle, right.angle);
      const width2 = left.distance * left.distance + right.distance * right.distance - 2 * left.distance * right.distance * Math.cos(between);
      const need = selfScale * 2 + left.scale + right.scale + 10;
      return width2 > need * need;
    }
    // How much of one opening a spike at (x, y) takes away, and whether what is
    // left on either side of it is still walkable.
    _gapCover(x, y, scale, gap, target) {
      const pos = target.pos.current;
      const selfScale = target.collisionScale;
      const dx = x - pos.x, dy = y - pos.y;
      const distance = Math.hypot(dx, dy);
      const sum = scale + selfScale;
      const half = distance <= sum ? PI / 2 : Math.asin(Math.min(1, sum / distance));
      let center = this._gapNormalize(Math.atan2(dy, dx));
      while (center < gap.start - PI) center += PI2;
      while (center > gap.start + PI) center -= PI2;
      const overlap = Math.max(0, Math.min(gap.end, center + half) - Math.max(gap.start, center - half));
      const asBlocker = {
        angle: center,
        distance: distance,
        scale: scale
      };
      return {
        overlap: overlap,
        ratio: gap.span > 0 ? overlap / gap.span : 0,
        distance: distance,
        angle: center,
        seals: !this._gapFits(gap.left, asBlocker, selfScale) && !this._gapFits(asBlocker, gap.right, selfScale)
      };
    }
    // One grid read and one analysis per tick per target; the break check
    // re-runs _gapAnalyse over the same blocker list minus one to ask what the
    // layout would look like without it.
    _gapAnalysis(ctx) {
      const state = this._gapFill;
      if (state.tick === ctx.tick && state.analysis) return state.analysis;
      state.tick = ctx.tick;
      state.analysis = this._gapAnalyse(ctx.target, this._gapBlockers(ctx));
      return state.analysis;
    }
    // Which way they are leaving. Movement direction when they are actually
    // moving, away from us when they are not, and the opening that best matches
    // it is the one worth sealing.
    _gapEscape(ctx, analysis) {
      const {target: target, myPos: myPos, pingTicks: pingTicks} = ctx;
      const pos = target.pos.current;
      const speed = target.speed || 0;
      const moving = speed > 1.2;
      const away = Math.atan2(pos.y - myPos.y, pos.x - myPos.x);
      // Where they are actually going while they are moving; away from us when
      // they are not, which is where a cornered player goes first.
      const dir = moving && target.move_dir != null ? target.move_dir : away;
      const lookahead = Math.min(speed * (1 + pingTicks), 150);
      const predicted = {
        x: pos.x + Math.cos(dir) * lookahead,
        y: pos.y + Math.sin(dir) * lookahead
      };
      let primary = null, bestScore = -Infinity;
      for (const gap of analysis.passable) {
        let score = Math.cos(getAngleDist(gap.mid, dir)) * (moving ? 100 : 55);
        score += Math.cos(getAngleDist(gap.mid, away)) * 25;
        score -= gap.span * 8;
        const edge = target.collisionScale + 40;
        const gx = pos.x + Math.cos(gap.mid) * edge;
        const gy = pos.y + Math.sin(gap.mid) * edge;
        score -= Math.hypot(gx - myPos.x, gy - myPos.y) * .05;
        if (score > bestScore) {
          bestScore = score;
          primary = gap;
        }
      }
      return {
        dir: dir,
        away: away,
        moving: moving,
        speed: speed,
        predicted: predicted,
        primary: primary
      };
    }
    // Candidates come out of the placer's own 72-angle set, already cached for
    // this tick and already collision- and range-checked, so this is a scoring
    // pass over a handful of points rather than a search. Narrow first (the
    // predicted opening, tight band); the caller widens only if nothing lands.
    // exclude re-runs the set as if one object were already gone, which is how
    // the break check prices a swing.
    _gapRank(ctx, analysis, escape, wide, exclude) {
      const {target: target, myPos: myPos, myFut: myFut, myPlayer: myPlayer, ObjectManager2: ObjectManager2, spikeId: spikeId} = ctx;
      const gaps = wide ? analysis.passable : escape.primary ? [ escape.primary ] : [];
      if (!gaps.length) return [];
      const pos = target.pos.current;
      const selfScale = target.collisionScale;
      const spikeScale = Items[spikeId].scale;
      const reach = selfScale + spikeScale + (wide ? this._GAP_BAND : this._GAP_BAND * .72);
      const placeLength = myPlayer.getItemPlaceScale(spikeId);
      const pending = this._gapFill.pendingBreak;
      const angles = this._getPrePlaceAngles(spikeId, myPos, myPlayer, ObjectManager2, exclude || null);
      const out = [];
      for (const cfg of angles) {
        if (!cfg || !cfg.placeable) continue;
        const distance = Math.hypot(cfg.x - pos.x, cfg.y - pos.y);
        if (distance > reach) continue;
        // How crowded the spot already is — same for every opening, so it is
        // counted once per candidate.
        let density = 0;
        for (const b of analysis.blockers) {
          if (Math.hypot(cfg.x - b.x, cfg.y - b.y) < b.scale + spikeScale + 40) density += 1;
        }
        let best = null;
        for (const gap of gaps) {
          const cover = this._gapCover(cfg.x, cfg.y, spikeScale, gap, target);
          if (cover.ratio <= .12) continue;
          // Ticks until they reach it. Standing still counts as already there:
          // there is nothing to pre-place for, the spike wants to land now.
          const arrival = escape.moving ? Math.max(0, distance - selfScale - spikeScale) / escape.speed : 0;
          // Blocking the route they are actually taking outweighs being close,
          // so a slightly farther spike that seals the opening beats a nearer
          // one that only clips it.
          let score = cover.ratio * 100;
          if (cover.seals) score += 60;
          score += Math.max(0, Math.cos(getAngleDist(cover.angle, escape.dir))) * (escape.moving ? 45 : 20);
          if (gap === escape.primary) score += 25;
          score += Math.max(0, 1 - distance / reach) * 30;
          score += cover.overlap / PI2 * 40;
          if (distance < selfScale + spikeScale + 6) score += 15;
          score -= Math.abs(Math.hypot(cfg.x - myFut.x, cfg.y - myFut.y) - placeLength) * .12;
          score -= density * 4;
          if (escape.moving) {
            // Ping decides what we can still get down in time: too early and
            // they walk past it, about right and it lands as they arrive.
            const need = ctx.pingTicks + 1;
            if (arrival < need - .5) {
              score -= 30;
            } else if (arrival <= need + 2) {
              score += 22;
            }
          }
          if (pending && ctx.tick - pending.tick <= 6 && getAngleDist(cover.angle, pending.angle) < .6) score += 30;
          if (this._bannedAngles.has(cfg.angle)) score -= 25;
          if (!best || score > best.score) {
            best = {
              angle: cfg.angle,
              x: cfg.x,
              y: cfg.y,
              score: score,
              gap: gap,
              cover: cover,
              distance: distance,
              arrival: arrival,
              seals: cover.seals
            };
          }
        }
        if (best) out.push(best);
      }
      out.sort((a, b) => b.score - a.score);
      return out.slice(0, 8);
    }
    // Last-moment check, run immediately before the candidate is handed over:
    // the target still has to be the ActiveTarget, the spot still has to be
    // placeable, and nothing else may already have claimed it.
    _gapValidate(ctx, candidate) {
      const {ModuleHandler: ModuleHandler, EnemyManager2: EnemyManager2, ObjectManager2: ObjectManager2, myPlayer: myPlayer, myPos: myPos, spikeId: spikeId, target: target} = ctx;
      if (EnemyManager2.nearestEnemy !== target) return false;
      if (this._isItemLimit(spikeId, myPlayer)) return false;
      if (!this._canPlace(spikeId, candidate.angle, myPos, ObjectManager2, null)) return false;
      if (this._bannedAngles.has(candidate.angle) && !Settings_default._replacer) return false;
      for (const angle of this._placedAngles) {
        if (getAngleDist(angle, candidate.angle) < .01) return false;
      }
      // Anything already placed this tick, by any module.
      const placed = ModuleHandler.placeAngles && ModuleHandler.placeAngles[1];
      if (placed) {
        for (const angle of placed) {
          if (getAngleDist(angle, candidate.angle) < .02) return false;
        }
      }
      // Spike Tick's own reservation — attemptSpikePlacement will use these.
      const reserved = EnemyManager2.nearestSpikePlacerAngle;
      if (reserved) {
        for (const angle of reserved) {
          if (getAngleDist(angle, candidate.angle) < .02) return false;
        }
      }
      const spikeScale = Items[spikeId].scale;
      for (const object of this._predictObjects) {
        if (Math.hypot(candidate.x - object.x, candidate.y - object.y) < spikeScale + object.scale) return false;
      }
      return true;
    }
    // Breaking one of our own traps, only when it demonstrably buys a better
    // spike than anything currently placeable — a trap denies a spike the 50
    // units of placement scale around it, so the one sitting on the opening is
    // often the reason nothing can be placed there. Never the trap that is
    // holding the target — letting them out is not an improvement — and never
    // while another module owns the tick.
    _gapBreak(ctx, analysis, escape) {
      if (!Settings_default._trapGapFillBreak) return false;
      const {ModuleHandler: ModuleHandler, myPlayer: myPlayer, target: target, myPos: myPos} = ctx;
      const state = this._gapFill;
      if (ModuleHandler.moduleActive || ModuleHandler.placedOnce) return false;
      if (ctx.tick - state.breakTick < this._GAP_BREAK_COOLDOWN) return false;
      const reloading = ModuleHandler.staticModules.reloading;
      const ownsTank = ModuleHandler.canBuy(0, 40);
      const held = target.trappedIn;
      const walls = analysis.blockers.filter(b => b.mine && b.trap && b.object.isDestroyable && b.object !== held && !b.holding);
      if (!walls.length) return false;
      walls.sort((a, b) => getAngleDist(a.angle, escape.dir) - getAngleDist(b.angle, escape.dir));
      const secondary = myPlayer.getItemByType(1);
      const primary = myPlayer.getItemByType(0);
      const type = secondary === 10 ? 1 : primary !== null ? 0 : null;
      if (type === null || !reloading.isReloaded(type)) return false;
      const weapon = myPlayer.getItemByType(type);
      // Melee only, the same rule Autobreak uses for reaching a building.
      if (weapon === null || !DataHandler_default.isMelee(weapon)) return false;
      const weaponData = DataHandler_default.getWeapon(weapon);
      if (!weaponData) return false;
      const damage = myPlayer.getBuildingDamage(weapon, ownsTank);
      for (let i = 0; i < Math.min(2, walls.length); i++) {
        const wall = walls[i];
        // It has to be the wall on the side they are leaving from...
        if (getAngleDist(wall.angle, escape.dir) > PI / 3) continue;
        // ...and it has to come down in one swing, from where we are standing.
        if (wall.object.health > damage) continue;
        if (Math.hypot(wall.x - myPos.x, wall.y - myPos.y) > (weaponData.range || 0) + wall.object.hitScale) continue;
        const after = this._gapAnalyse(target, analysis.blockers.filter(b => b !== wall));
        // They have to actually be heading for the opening it would leave.
        const opening = after.passable.find(g => getAngleDist(g.mid, escape.dir) < 1);
        if (!opening) continue;
        const ranked = this._gapRank(ctx, after, {
          dir: escape.dir,
          away: escape.away,
          moving: escape.moving,
          speed: escape.speed,
          predicted: escape.predicted,
          primary: opening
        }, true, wall.object);
        if (!ranked.length || ranked[0].score < this._GAP_BREAK_GAIN) continue;
        ModuleHandler.moduleActive = true;
        ModuleHandler.forceWeapon = type;
        ModuleHandler.useAngle = Math.atan2(wall.y - myPos.y, wall.x - myPos.x);
        ModuleHandler.shouldAttack = true;
        state.breakTick = ctx.tick;
        // Remembered so the next tick prepares the spike for the opening this
        // swing is about to create, rather than rediscovering it cold.
        state.pendingBreak = {
          id: wall.object.id,
          angle: opening.mid,
          tick: ctx.tick
        };
        return true;
      }
      return false;
    }
    _gapFillTick(ctx) {
      const {ModuleHandler: ModuleHandler, myPlayer: myPlayer, myPos: myPos, target: target, spikeId: spikeId} = ctx;
      const state = this._gapFill;
      // Target lock: this layer never selects anything, it follows the placer's
      // ActiveTarget — and the moment that changes, every cached gap goes with it.
      if (state.targetId !== target.id) {
        state.targetId = target.id;
        state.committed = null;
        state.analysis = null;
        state.pendingBreak = null;
        state.tick = -1;
      }
      // Spike Tick decides first and owns its multi-tick sequences.
      if (ModuleHandler.activeModule === "spikeTick") return;
      const spikeTick = ModuleHandler.staticModules.spikeTick;
      if (spikeTick && (spikeTick.useBreakTrapPlace || spikeTick.useBreakTrapFollowup || spikeTick.useTurret)) return;
      if (!spikeId || this._isItemLimit(spikeId, myPlayer)) return;
      const pos = target.pos.current;
      if (Math.hypot(pos.x - myPos.x, pos.y - myPos.y) > this._GAP_RANGE) {
        state.committed = null;
        return;
      }
      const analysis = this._gapAnalysis(ctx);
      // Not boxed in, or boxed in with nothing left to fill: hand the target
      // straight back to the normal preplace/replace pass.
      if (!analysis.enclosed) {
        state.committed = null;
        return;
      }
      const escape = this._gapEscape(ctx, analysis);
      let ranked = this._gapRank(ctx, analysis, escape, false);
      if (!ranked.length) ranked = this._gapRank(ctx, analysis, escape, true);
      // Replace: stay on the position already being prepared unless a new one
      // beats it by a real margin, and only when Re Placer is on.
      const committed = state.committed;
      if (committed && committed.targetId === target.id && ctx.tick - committed.tick <= 4) {
        const keep = ranked.find(c => getAngleDist(c.angle, committed.angle) < .01);
        if (keep) {
          const upgrade = ranked[0] !== keep && ranked[0].score > keep.score + this._GAP_REPLACE_MARGIN;
          if (!upgrade || !Settings_default._replacer) {
            ranked = [ keep ].concat(ranked.filter(c => c !== keep));
          }
        }
      }
      let chosen = null;
      for (const candidate of ranked) {
        if (this._gapValidate(ctx, candidate)) {
          chosen = candidate;
          break;
        }
      }
      if (!chosen) {
        this._gapBreak(ctx, analysis, escape);
        return;
      }
      // Preplace while they still have to travel to the opening — that is the
      // ping-synced path at the end of postTick — immediate once they are there.
      this._addPredictObject(spikeId, chosen.angle, Settings_default._preplacer && chosen.arrival > .75, myPos);
      state.committed = {
        targetId: target.id,
        angle: chosen.angle,
        score: chosen.score,
        tick: ctx.tick
      };
      state.pendingBreak = null;
    }`
);

edit(
  "autoplacer: run the gap-fill layer before execution",
  `      const autoObjects = this._predictObjects.filter(o => !o.preplace);
      const preObjects = this._predictObjects.filter(o => o.preplace);
      for (const obj of autoObjects) {
        if (ModuleHandler.packetCount + 5 > ModuleHandler.packetLimit) break;`,
  `      // Trap enclosure gap fill: one more candidate on the same list, chosen
      // from the same angle set, drained by the same two paths below. A throw
      // in here parks the layer for a while instead of taking the placer down
      // with it.
      if (Settings_default._trapGapFill && this._tick >= this._gapFill.errorUntil) {
        try {
          this._gapFillTick({
            tick: this._tick,
            ModuleHandler: ModuleHandler,
            EnemyManager2: EnemyManager2,
            ObjectManager2: ObjectManager2,
            PlayerManager2: PlayerManager2,
            myPlayer: myPlayer,
            myPos: myPos,
            myFut: myFut,
            target: enemy,
            spikeId: spikeId,
            pingTicks: Math.min(2, (pingTime || 0) / 111)
          });
        } catch (e) {
          this._gapFill.committed = null;
          this._gapFill.errorUntil = this._tick + 60;
          Logger.error("Trap gap fill skipped for 60 ticks: " + e);
        }
      }
      const autoObjects = this._predictObjects.filter(o => !o.preplace);
      const preObjects = this._predictObjects.filter(o => o.preplace);
      for (const obj of autoObjects) {
        if (ModuleHandler.packetCount + 5 > ModuleHandler.packetLimit) break;`
);

/* ------------------------------------------------------------------ *
 * 6. Object spin hook (Luna: "spike rotation" / "mill rotation")
 *
 * Luna gates `this.dir += this.turnSpeed * delta` in the object update on a
 * pair of toggles so spinning spikes and mills can be frozen and read at a
 * glance. RYN already rewrites that same expression for its low-quality mode,
 * so the specific object-update site is claimed first and routed through a
 * helper that honours both; the existing generic hook then only catches the
 * remaining animal turn-rate site.
 * ------------------------------------------------------------------ */

edit(
  "hook: object rotation toggles",
  `    Hook.replace("freezeTurnSpeed",`,
  `    Hook.replace("objectRotation", /(\\w+)\\.turnSpeed\\s*&&\\s*\\(\\1\\.dir\\s*\\+=\\s*\\1\\.turnSpeed\\s*\\*\\s*(\\w+)\\)/, "$1.turnSpeed&&($1.dir+=RYN._objectSpin($1,$2))");
    Hook.replace("freezeTurnSpeed",`
);

edit(
  "bridge: RYN._objectSpin",
  `    _config: {},
    version: version,`,
  `    _config: {},
    /* Per-frame rotation delta for a placed object. Group 2 is spikes and
     * group 3 is mills; the id ranges are the fallback for objects that
     * reach here before their group is resolved. */
    _objectSpin(object, delta) {
      try {
        if (Settings_default._lowQuality) return 0;
        const groupId = object.group ? object.group.id : -1;
        const id = object.id;
        const isSpike = groupId === 2 || (groupId === -1 && id > 5 && id < 10);
        const isMill = groupId === 3 || (groupId === -1 && id > 9 && id < 13);
        if (isSpike && !Settings_default._spikeRotation) return 0;
        if (isMill && !Settings_default._millRotation) return 0;
        return object.turnSpeed * delta;
      } catch (e) {
        return object.turnSpeed * delta;
      }
    },
    version: version,`
);

/* ------------------------------------------------------------------ *
 * 7. Username cycler (Luna)
 *
 * Advances the name in #nameInput through a user-supplied list every time the
 * player spawns, so consecutive lives do not share a name. Luna hangs this off
 * document-level capture listeners for Enter and the play button; same idea
 * here, wired where the rest of the client's DOM setup happens.
 * ------------------------------------------------------------------ */

edit(
  "module: username cycler",
  `  const contentLoaded = () => {
    Logger.test("Menu initialization..");`,
  `  const cycleUsername = () => {
    if (!Settings_default._usernameCycler) return;
    const names = (Settings_default._usernameList || "")
      .split(",")
      .map(n => n.trim())
      .filter(Boolean);
    if (!names.length) return;
    const index = ((Settings_default._usernameIndex || 0) + 1) % names.length;
    Settings_default._usernameIndex = index;
    const nextName = names[index];
    const nameInput = document.getElementById("nameInput");
    if (nameInput) {
      nameInput.value = nextName;
      nameInput.dispatchEvent(new Event("input", {
        bubbles: true
      }));
      nameInput.dispatchEvent(new Event("change", {
        bubbles: true
      }));
    }
    SaveSettings();
  };
  const handleSpawnForCycler = event => {
    if (!Settings_default._usernameCycler) return;
    const nameInput = document.getElementById("nameInput");
    if (!nameInput || !nameInput.offsetParent) return;
    const isEnter = event.type === "keydown" && event.code === "Enter";
    const isPlayClick = event.type === "click" && event.target && event.target.id === "enterGame";
    if (isEnter || isPlayClick) cycleUsername();
  };
  document.addEventListener("keydown", handleSpawnForCycler, true);
  document.addEventListener("click", handleSpawnForCycler, true);
  const contentLoaded = () => {
    Logger.test("Menu initialization..");`
);

/* ------------------------------------------------------------------ *
 * 8. Menu themes (Luna)
 *
 * Luna ships five accent presets behind a picker. RYN's stylesheet already
 * drives every accent off --accent / --accent2 / --border-active on :root, so
 * a theme is just an override of those three on the menu root.
 * ------------------------------------------------------------------ */

const THEMES = {
  ryn: { name: "Ryn", accent: "#7A42F4", accent2: "#3A86FF" },
  nvg: { name: "NVG", accent: "#10B981", accent2: "#34D399" },
  ice: { name: "Ice", accent: "#0EA5E9", accent2: "#38BDF8" },
  red: { name: "Red", accent: "#EF4444", accent2: "#F87171" },
  void: { name: "Void", accent: "#D946EF", accent2: "#E879F9" },
};

edit(
  "menu: theme binder",
  `        this.attachTextInputs();`,
  `        this.attachTextInputs();
        this.attachReUpTheme();`
);

edit(
  "menu: attachReUpTheme",
  `    attachDescriptions() {`,
  `    get reUpThemes() {
      return ${JSON.stringify(THEMES, null, 6).replace(/\n/g, "\n      ")};
    }
    applyReUpTheme(key) {
      const theme = this.reUpThemes[key] || this.reUpThemes.ryn;
      const doc = this.frame && this.frame.document;
      if (!doc || !doc.documentElement) return;
      const root = doc.documentElement.style;
      root.setProperty("--accent", theme.accent);
      root.setProperty("--accent2", theme.accent2);
      root.setProperty("--border-active", theme.accent + "80");
    }
    attachReUpTheme() {
      const buttons = this.querySelectorAll(".reup-theme[data-theme]");
      const paint = () => {
        for (const button of buttons) {
          button.classList.toggle("active", button.dataset.theme === Settings_default._menuTheme);
        }
      };
      for (const button of buttons) {
        const key = button.dataset.theme;
        const theme = this.reUpThemes[key];
        if (theme) button.style.setProperty("--swatch", theme.accent);
        button.onclick = () => {
          Settings_default._menuTheme = key;
          SaveSettings();
          this.applyReUpTheme(key);
          paint();
        };
      }
      paint();
      this.applyReUpTheme(Settings_default._menuTheme);
    }
    attachDescriptions() {`
);

/* ------------------------------------------------------------------ *
 * 9. Menu markup for the ported features
 *
 * The page constants are JS string literals, so decode, splice, re-encode.
 * Checkboxes and text inputs bind themselves by id off the settings object.
 * ------------------------------------------------------------------ */

function patchPage(constName, anchorHtml, insertHtml) {
  const declaration = `const ${constName} = `;
  const start = code.indexOf(declaration);
  if (start === -1) throw new Error(`page constant not found: ${constName}`);

  const lineEnd = code.indexOf("\n", start);
  const literal = code.slice(start + declaration.length, lineEnd).replace(/;\s*$/, "");

  // eslint-disable-next-line no-eval
  const html = eval(literal);
  if (!html.includes(anchorHtml)) throw new Error(`page anchor not found in ${constName}`);

  const patched = html.replace(anchorHtml, insertHtml + anchorHtml);
  code =
    code.slice(0, start + declaration.length) +
    JSON.stringify(patched) +
    ";" +
    code.slice(lineEnd);
  applied.push(`menu: options added to ${constName}`);
}

const themeButtons = Object.entries(THEMES)
  .map(
    ([key, theme]) =>
      `                    <button class="reup-theme" data-theme="${key}" title="${theme.name}"></button>`
  )
  .join("\r\n");

patchPage(
  "Misc_default",
  "\r\n\r\n    <!-- Menu -->",
  `\r
    <!-- ReUp Mix -->\r
    <div class="section">\r
        <h2 class="section-title">ReUp Mix</h2>\r
\r
        <div class="section-content">\r
\r
            <div class="content-option">\r
                <span class="option-title">Username Cycler</span>\r
                <div class="option-content">\r
                    <input id="_usernameList" class="input" type="text" maxlength="120">\r
                    <label class="switch-checkbox">\r
                        <input id="_usernameCycler" type="checkbox">\r
                        <span></span>\r
                    </label>\r
                </div>\r
                <span class="option-description">Uses the next name in the comma separated list every time you spawn.</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Spike Rotation</span>\r
                <label class="switch-checkbox">\r
                    <input id="_spikeRotation" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Off freezes spinning spikes so their hitbox is easier to read.</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Mill Rotation</span>\r
                <label class="switch-checkbox">\r
                    <input id="_millRotation" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Off freezes windmills and power mills.</span>\r
            </div>\r
\r
            <div class="content-option">\r
                <span class="option-title">Menu Theme</span>\r
                <div class="option-content reup-theme-row">\r
${themeButtons}\r
                </div>\r
            </div>\r
\r
        </div>\r
    </div>\r
`
);

/* The two gap-fill switches sit with the rest of the placement options, right
 * above Auto Retrap. */
patchPage(
  "Combat_default",
  '<div class="content-option">\r\n                <label class="option-title" for="_autoRetrap">Auto Retrap</label>',
  `<div class="content-option">\r
                <label class="option-title" for="_trapGapFill">Trap Gap Fill</label>\r
                <label class="switch-checkbox">\r
                    <input id="_trapGapFill" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">When the locked target is boxed in by traps, spikes or terrain, works out which opening they are leaving through and prepares the closest spike that seals it. Places through Pre Placer / Re Placer, never on top of Spike Tick.</span>\r
            </div>\r
            <div class="content-option">\r
                <label class="option-title" for="_trapGapFillBreak">Gap Fill Trap Break</label>\r
                <label class="switch-checkbox">\r
                    <input id="_trapGapFillBreak" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Lets the gap filler break one of your own walls when that opens a better spike than anything placeable right now. Never the trap holding the target, and never while another module owns the tick.</span>\r
            </div>\r
            `
);

/* Styles for the theme swatch row. */
{
  const declaration = "const styles_default = ";
  const start = code.indexOf(declaration);
  if (start === -1) throw new Error("styles_default not found");
  const lineEnd = code.indexOf("\n", start);
  const literal = code.slice(start + declaration.length, lineEnd).replace(/;\s*$/, "");
  // eslint-disable-next-line no-eval
  const css = eval(literal);

  const extra = `
.reup-theme-row{display:flex;gap:8px;align-items:center;}
.reup-theme{
  width:22px;height:22px;padding:0;border-radius:50%;cursor:pointer;
  background:var(--swatch,#7A42F4);
  border:2px solid transparent;
  transition:border-color 140ms ease,transform 140ms ease;
}
.reup-theme:hover{transform:scale(1.12);}
.reup-theme.active{border-color:var(--text);}
`;

  code =
    code.slice(0, start + declaration.length) +
    JSON.stringify(css + extra) +
    ";" +
    code.slice(lineEnd);
  applied.push("menu: theme swatch styles");
}

/* ------------------------------------------------------------------ *
 * 10. Driver manifest + runtime drift check
 *
 * The tables the client carries were checked against the shipped bundle at
 * build time (tools/verify-drivers.js). This records what they were checked
 * against and re-checks the parts that are observable at runtime, so a
 * protocol change on the server side shows up as a console warning rather
 * than as packets that quietly stop being understood.
 * ------------------------------------------------------------------ */

const manifest = {
  builtAt: new Date().toISOString(),
  extractedFrom: DRIVERS.source,
  extractedAt: DRIVERS.extractedAt,
  protocol: DRIVERS.protocol,
  tableSizes: {
    itemGroups: DRIVERS.itemGroups.length,
    projectiles: DRIVERS.projectiles.length,
    weapons: DRIVERS.weapons.length,
    items: DRIVERS.items.length,
    hats: DRIVERS.hats.length,
    accessories: DRIVERS.accessories.length,
  },
};

edit(
  "drivers: manifest + runtime check",
  `  const RYN = {
    _myClient: client,`,
  `  /* Game drivers this build was verified against. See drivers/game-drivers.json. */
  const ReUpDrivers = ${JSON.stringify(manifest, null, 4).replace(/\n/g, "\n  ")};
  ReUpDrivers.check = () => {
    const problems = [];
    const p = ReUpDrivers.protocol;
    try {
      const enc = win.RYN && win.RYN._enc;
      if (enc && enc.jt !== undefined && enc.jt !== p.signatureBytes) {
        problems.push(\`frame signature is \${enc.jt} bytes, expected \${p.signatureBytes}\`);
      }
      const crypto = client && client._gameCrypto;
      if (crypto && crypto.mode !== undefined && crypto.mode !== p.encryptedMode) {
        problems.push(\`transport mode is \${crypto.mode}, expected \${p.encryptedMode}\`);
      }
      if (crypto && crypto.tables && crypto.tables.c2s && crypto.tables.c2s.enc) {
        const live = Object.keys(crypto.tables.c2s.enc).length;
        if (live !== p.c2sAlphabet.length) {
          problems.push(\`c2s opcode table has \${live} entries, expected \${p.c2sAlphabet.length}\`);
        }
      }
    } catch (e) {}
    if (problems.length) {
      Logger.error("Driver drift vs the bundle this build was verified against:");
      for (const problem of problems) Logger.error("  " + problem);
    }
    return problems;
  };
  const RYN = {
    _myClient: client,
    _drivers: ReUpDrivers,`
);

edit(
  "drivers: run check once connected",
  `  resetGame_default(loadedFast);`,
  `  setTimeout(() => {
    try {
      ReUpDrivers.check();
    } catch (e) {}
  }, 15e3);
  resetGame_default(loadedFast);`
);

/* ------------------------------------------------------------------ */

fs.writeFileSync(OUT, code);

console.log("built", path.relative(ROOT, OUT));
console.log(`  ${(code.length / 1024).toFixed(0)} KB, ${code.split("\n").length} lines\n`);
for (const step of applied) console.log("  + " + step);
