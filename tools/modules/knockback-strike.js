  // ── Knockback strike ──────────────────────────────────────────────────
  // Hit them so the recoil carries them onto something that hurts.
  //
  // The module this replaces asked one question, once per pit trap: does the
  // trap fall inside a cone drawn from me through them, and are they within
  // getActualMaxKnockback of it. Three things were wrong with that.
  //
  //   · A cone anchored at the player widens with distance, so a trap well
  //     behind the target passed the test while a spike sitting just off the
  //     push axis failed it.
  //   · The range gate spent a knockback budget with the secondary and the
  //     turret already folded in, whether or not either was going out that
  //     tick, so the module committed to pushes it could not deliver.
  //   · It only ever looked at pit traps. Every spike on the map was
  //     invisible to it, which is most of what a knockback is for.
  //
  // The push is a radial impulse along me -> them, so the honest question is
  // where that impulse runs out and what the segment between here and there
  // passes through:
  //
  //   travel   the weapon's own knockback figure straight off the item table
  //            (33.3 / 55.6 / 111.1 — that is 111ms x (0.3 + knock) under the
  //            game's 0.993/ms decay), plus the turret's 33.3 only on a tick
  //            the turret is actually going out
  //   path     a segment from their predicted position along the push axis,
  //            each hazard tested by closest approach to it, so a hazard is
  //            found wherever along the line it sits and one past the end of
  //            the travel is not found at all
  //   worth    what landing there does — a trap ends the fight, a spike deals
  //            its own damage, and a second hazard on the same line chains —
  //            so the target is chosen by outcome rather than by proximity
  //
  // Ours only, in both directions: their spikes are their prize, not ours,
  // and a target already pinned does not move when hit, so there is no push
  // to aim and nothing here can use them.
  const KB_STRIKE_TURRET_TRAVEL = 33.3;
  const KB_STRIKE_TRAP_CATCH = 47.5;
  const KB_STRIKE_TRAP_WORTH = 120;
  const KB_STRIKE_CHAIN = .6;
  const KB_STRIKE_MIN_WORTH = 15;
  const KB_STRIKE_CELLS = 3;

  class KnockbackStrike {
    moduleName="knockbackStrike";
    client;
    target=null;
    landing=null;
    worth=0;
    constructor(client2) {
      this.client = client2;
    }
    reset() {
      this.target = null;
      this.landing = null;
      this.worth = 0;
    }

    // Closest approach from a point to the segment a->b, squared. Testing the
    // segment rather than an angle is the whole point: it catches a hazard
    // wherever on the push it sits, and refuses one beyond the travel.
    _segmentDistance2(px, py, ax, ay, bx, by) {
      const dx = bx - ax;
      const dy = by - ay;
      const length2 = dx * dx + dy * dy;
      let t = length2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / length2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = px - (ax + t * dx);
      const ey = py - (ay + t * dy);
      return ex * ex + ey * ey;
    }

    // One hit's carry. The item table already holds the finished distance per
    // weapon, so the impulse and the decay are not re-derived here.
    _travel(primary, withTurret) {
      const travel = DataHandler_default.getWeapon(primary).knockback || 0;
      if (travel <= 0) {
        return 0;
      }
      return travel + (withTurret ? KB_STRIKE_TURRET_TRAVEL : 0);
    }

    // What the push line runs through, and what that is worth.
    _readPath(target, dir, travel) {
      const {ObjectManager: ObjectManager2, PlayerManager: PlayerManager2, myPlayer: myPlayer} = this.client;
      const from = target.pos.future;
      const toX = from.x + Math.cos(dir) * travel;
      const toY = from.y + Math.sin(dir) * travel;
      const ids = ObjectManager2.grid2D.queryFull((from.x + toX) / 2, (from.y + toY) / 2, KB_STRIKE_CELLS);
      const reach = target.collisionScale;
      const allowTrap = Settings_default._knockbackStrikeTrap;
      let worth = 0;
      let landing = null;
      let bestWorth = 0;
      let found = 0;
      for (const id of ids) {
        const object = ObjectManager2.objects.get(id);
        if (!object) {
          continue;
        }
        const isBuild = object instanceof PlayerObject;
        if (isBuild && PlayerManager2.isEnemyByID(object.ownerID, myPlayer)) {
          continue;
        }
        const isTrap = isBuild && object.type === 15;
        if (isTrap && !allowTrap) {
          continue;
        }
        if (!isTrap && !(isBuild ? object.isSpike : object.isCactus)) {
          continue;
        }
        const pos = object.pos.current;
        // A trap catches at its own radius, not at the collision radius its
        // colDiv leaves behind — pit trap is scale 50 with colDiv 0.2, so
        // collisionScale would put the catch at 10 and miss every time.
        const radius = (isTrap ? KB_STRIKE_TRAP_CATCH : object.collisionScale) + reach;
        if (this._segmentDistance2(pos.x, pos.y, from.x, from.y, toX, toY) > radius * radius) {
          continue;
        }
        const value = isTrap ? KB_STRIKE_TRAP_WORTH : object.getDamage();
        if (value <= 0) {
          continue;
        }
        found++;
        // Only the first landing is certain; anything further along the line
        // depends on them still travelling, so it is worth a fraction.
        worth += found > 1 ? value * KB_STRIKE_CHAIN : value;
        if (value > bestWorth) {
          bestWorth = value;
          landing = object;
        }
      }
      return {
        worth: worth,
        landing: landing
      };
    }

    postTick() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, PlayerManager: PlayerManager2, myPlayer: myPlayer} = this.client;
      this.target = null;
      this.landing = null;
      this.worth = 0;
      if (!Settings_default._knockbackStrike || ModuleHandler.moduleActive || EnemyManager2.shouldIgnoreModule()) {
        return;
      }
      const {reloading: reloading} = ModuleHandler.staticModules;
      if (!reloading.isReloaded(0)) {
        return;
      }
      const primary = myPlayer.getItemByType(0);
      if (primary === null) {
        return;
      }
      const turretReady = ModuleHandler.hasStoreItem(0, 53) && reloading.isReloaded(2);
      const travel = this._travel(primary, turretReady);
      if (travel <= 0) {
        return;
      }
      const weaponRange = DataHandler_default.getWeapon(primary).range;
      const myPos = myPlayer.pos.current;
      let bestWorth = KB_STRIKE_MIN_WORTH;
      let bestTarget = null;
      let bestLanding = null;
      let bestAngle = 0;
      for (const enemy of PlayerManager2.enemies) {
        if (enemy.isTrapped) {
          continue;
        }
        if (!myPlayer.collidingEntity(enemy, weaponRange + enemy.hitScale)) {
          continue;
        }
        const dir = myPos.angle(enemy.pos.future);
        const read = this._readPath(enemy, dir, travel);
        if (read.worth <= bestWorth) {
          continue;
        }
        bestWorth = read.worth;
        bestTarget = enemy;
        bestLanding = read.landing;
        bestAngle = dir;
      }
      if (bestTarget === null) {
        return;
      }
      this.target = bestTarget;
      this.landing = bestLanding;
      this.worth = bestWorth;
      ModuleHandler.moduleActive = true;
      ModuleHandler.useAngle = bestAngle;
      // The turret is free knockback and free damage on the same tick, so it
      // is worn when it is up — the travel above was measured with it.
      if (turretReady) {
        ModuleHandler.forceHat = 53;
      }
      ModuleHandler.forceWeapon = 0;
      ModuleHandler.shouldAttack = true;
    }
  }
