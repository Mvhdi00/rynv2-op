  // Hit them so the recoil carries them onto something that hurts.
  //
  // The push is a radial impulse along me -> them, so the question is where
  // that impulse runs out and what the segment between here and there passes
  // through. Travel is the weapon's own knockback figure from the item table,
  // plus the turret's 33.3 only on a tick the turret is going out.
  //
  // Ours only: their spikes are their prize, and a pinned target does not move
  // when hit, so there is no push to aim.
  const KB_STRIKE_TURRET_TRAVEL = 33.3;
  // A trap catches at its own radius, not the collision radius its colDiv
  // leaves behind: pit trap is scale 50 with colDiv 0.2, so collisionScale
  // would put the catch at 10.
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

    // Closest approach from a point to the segment a->b, squared.
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

    _travel(primary, withTurret) {
      const travel = DataHandler_default.getWeapon(primary).knockback || 0;
      if (travel <= 0) {
        return 0;
      }
      return travel + (withTurret ? KB_STRIKE_TURRET_TRAVEL : 0);
    }

    // What the push line runs through, and what that is worth. The two
    // switches are independent: spikes and traps are separate reasons to
    // swing, and neither one is a sub-option of the other.
    _readPath(target, dir, travel, allowSpike, allowTrap) {
      const {ObjectManager: ObjectManager2, PlayerManager: PlayerManager2, myPlayer: myPlayer} = this.client;
      const from = target.pos.future;
      const toX = from.x + Math.cos(dir) * travel;
      const toY = from.y + Math.sin(dir) * travel;
      const ids = ObjectManager2.grid2D.queryFull((from.x + toX) / 2, (from.y + toY) / 2, KB_STRIKE_CELLS);
      const reach = target.collisionScale;
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
        const isSpike = !isTrap && (isBuild ? object.isSpike : object.isCactus);
        if (isTrap ? !allowTrap : !(isSpike && allowSpike)) {
          continue;
        }
        const pos = object.pos.current;
        const radius = (isTrap ? KB_STRIKE_TRAP_CATCH : object.collisionScale) + reach;
        if (this._segmentDistance2(pos.x, pos.y, from.x, from.y, toX, toY) > radius * radius) {
          continue;
        }
        const value = isTrap ? KB_STRIKE_TRAP_WORTH : object.getDamage();
        if (value <= 0) {
          continue;
        }
        found++;
        // Only the first landing is certain; further along the line depends on
        // them still travelling, so it is worth a fraction.
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
      const allowSpike = !!Settings_default._knockbackStrike;
      const allowTrap = !!Settings_default._knockbackStrikeTrap;
      if (!allowSpike && !allowTrap) {
        return;
      }
      if (ModuleHandler.moduleActive || EnemyManager2.shouldIgnoreModule()) {
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
        const read = this._readPath(enemy, dir, travel, allowSpike, allowTrap);
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
      if (turretReady) {
        ModuleHandler.forceHat = 53;
      }
      ModuleHandler.forceWeapon = 0;
      ModuleHandler.shouldAttack = true;
    }
  }
