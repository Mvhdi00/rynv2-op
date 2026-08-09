  // ==========================================================================
  // Luna placer — autoplace, preplace and replace, ported from Luna Client 1.1
  // (`getPredictObjects`, `updateAngles`, `getPrePlaceAngles`,
  // `isAutoPlaceAngle`, `isPrePlaceAngle`, `getPrePlaceObject`,
  // `addPredictObject`). It replaces the Auraro placer this client shipped.
  //
  // Luna runs all three off one pass per tick. It rebuilds `predictObjects` —
  // the builds it wants — and flags each entry `preplace` or not:
  //
  //   autoplace  angles worth a spike or trap right now, sent immediately
  //              (`preplace: false`)
  //   preplace   one angle aimed at the slot an object is about to vacate,
  //              held back and sent a tick later, once the slot is free
  //              (`preplace: true`)
  //   replace    that same preplace entry sent a third time at min-ping, for
  //              when the second send lost the race to the server
  //
  // So preplace and replace are not separate decisions — they are the second
  // and third send of the one preplace entry, which is why this is a single
  // module rather than three. Luna gates them on `prePlace` and
  // `spampreplace`; here that is `Settings._prePlace` and `Settings._replace`.
  //
  // Only the data access is rewritten onto RYN's managers: `visibleObjects`
  // becomes ObjectManager.grid2D queries, `myPlayer.items[2]`/`items[4]`
  // become getItemByType(4)/(7), and Luna's `x2/y2` and `xVel/yVel` become
  // pos.current and pos.future. The geometry is carried over unchanged — the
  // 72-angle probe, the perfect-angle edge detection, lineInRect, the
  // knockback alignment scoring, and both placement priority ladders.
  //
  // Two Luna branches are kept in place but can never fire here: `canTrapTick`
  // and `canShamePlace` both gate on Luna's `shameTick` / `shameGrind`
  // toggles, and this client has no shame-grind feature to hang them on. They
  // are left as explicit `false` so the ladders still read 1:1 against Luna.
  // ==========================================================================
  const LUNA_SPIKE_TYPE = 4;
  const LUNA_TRAP_TYPE = 7;
  const LUNA_ANGLE_STEPS = 72;
  const LUNA_ANGLE_STEP = Math.PI * 2 / LUNA_ANGLE_STEPS;

  // Luna's own budget check was `packets + 5 > 119` against a counter it owned
  // outright. RYN shares one allowance across every module, so the same guard
  // is written against ModuleHandler's counter and limit.
  const LUNA_PLACE_COST = 5;

  // How long an angle stays banned after a build that the server dropped.
  const LUNA_BAN_TICKS = 18;

  // Modules that own a spike tick or a sync. Every one of them runs before the
  // placer in the module order and refuses to start once ModuleHandler.
  // moduleActive is set, so a spike tick that runs at all is the first module
  // to claim the tick — which is exactly when the loop copies its name into
  // ModuleHandler.activeModule. Reading that name is therefore a reliable
  // answer to "is a spike tick running right now".
  //
  // The placer stays out of a tick one of them owns. That matters more than
  // packets: ModuleHandler.place() sends a selectItem, and swapping the held
  // item out from under a tick mid-sequence loses the swing. This guard is
  // RYN's, not Luna's — Luna has no module ordering to collide with.
  const LUNA_SPIKE_TICK_MODULES = new Set([ "spikeTickBreak", "spikeTickNear", "spikeTickTrap", "spikeSync", "spikeSyncHammer", "spikeTrap", "teammateSpikeTrap" ]);
  function lunaSpikeTickBusy(ModuleHandler) {
    return LUNA_SPIKE_TICK_MODULES.has(ModuleHandler.activeModule);
  }

  class AutoPlacer {
    moduleName="autoPlacer";
    client;
    _predictObjects=[];
    _placedAngles=[];
    _bannedAngles=new Map;
    _angleCache=new Map;
    _angleCacheTick=-1;
    _tick=0;
    _lastPrePlaceObj=null;
    _spamPrePlacer=false;
    constructor(client2) {
      this.client = client2;
    }
    reset() {
      this._predictObjects = [];
      this._placedAngles = [];
      this._bannedAngles.clear();
      this._angleCache.clear();
      this._angleCacheTick = -1;
      this._lastPrePlaceObj = null;
      this._spamPrePlacer = false;
    }

    // UTILS.lineInRect, unchanged.
    _lineInRect(x1, y1, x2, y2, ax, ay, bx, by) {
      let minX = ax, maxX = bx;
      if (ax > bx) {
        minX = bx;
        maxX = ax;
      }
      if (maxX > x2) maxX = x2;
      if (minX < x1) minX = x1;
      if (minX > maxX) return false;
      let minY = ay, maxY = by;
      const dx = bx - ax;
      if (Math.abs(dx) > 1e-7) {
        const slope = (by - ay) / dx;
        const intercept = ay - slope * ax;
        minY = slope * minX + intercept;
        maxY = slope * maxX + intercept;
      }
      if (minY > maxY) {
        const tmp = maxY;
        maxY = minY;
        minY = tmp;
      }
      if (maxY > y2) maxY = y2;
      if (minY < y1) minY = y1;
      if (minY > maxY) return false;
      return true;
    }

    // Luna getConfig: where a build of `id` at `angle` would land. The game
    // puts it on a circle of radius playerScale + itemScale + placeOffset.
    _getConfig(id, myPos) {
      const item = Items[id];
      const dist = 35 + item.scale + (item.placeOffset || 0);
      return angle => ({
        id: id,
        angle: angle,
        x: myPos.x + dist * Math.cos(angle),
        y: myPos.y + dist * Math.sin(angle),
        scale: item.scale
      });
    }

    // Luna canPlace: the landing point has to clear every object, and stay out
    // of the river unless it is a platform.
    _canPlace(id, angle, myPos, ObjectManager2, excludeObj) {
      const cfg = this._getConfig(id, myPos)(angle);
      const cx = cfg.x, cy = cfg.y, cs = cfg.scale;
      const blocked = ObjectManager2.grid2D.query(cx, cy, 4, objId => {
        const obj = ObjectManager2.objects.get(objId);
        if (!obj) return false;
        if (excludeObj && obj === excludeObj) return false;
        return Math.hypot(cx - obj.pos.current.x, cy - obj.pos.current.y) < cs + obj.placementScale;
      });
      if (blocked) return false;
      if (id !== 18) {
        const mid = Config_default.mapScale / 2;
        const riverHalf = Config_default.riverWidth / 2;
        if (cy >= mid - riverHalf && cy <= mid + riverHalf) return false;
      }
      return true;
    }

    // Luna isItemLimit. Luna reads `group.sandboxLimit || Math.max(...)`
    // outside sandbox too, which caps everything at the sandbox number; RYN
    // already resolves this correctly in ClientPlayer.getItemCount, so the
    // limit comes from there.
    _isItemLimit(id, myPlayer) {
      const {count: count, limit: limit} = myPlayer.getItemCount(Items[id].itemGroup);
      return !!limit && count >= limit;
    }

    // Luna getPrePlaceAngles + getPerfectAngles: probe 72 evenly spaced
    // angles, then mark the two ends of every placeable run "perfect" — those
    // are the angles packed against something, which is where a build is worth
    // the most. `excludeObj` is the object Luna pretends is already gone.
    //
    // Luna recomputes all 72 on every call and calls it several times a tick.
    // The result only depends on (id, excludeObj) within a tick, so it is
    // memoised per tick — callers compare entries by identity, which needs the
    // same objects back anyway.
    _getPrePlaceAngles(id, myPos, myPlayer, ObjectManager2, excludeObj) {
      if (id === null || id === undefined) return [];
      if (this._isItemLimit(id, myPlayer)) return [];
      const tick = this.client._ModuleHandler.tickCount;
      if (this._angleCacheTick !== tick) {
        this._angleCache.clear();
        this._angleCacheTick = tick;
      }
      const key = id + "_" + (excludeObj ? excludeObj.id : "n");
      const cached = this._angleCache.get(key);
      if (cached) return cached;
      const getConfig = this._getConfig(id, myPos);
      const angles = [];
      for (let i = 0; i < LUNA_ANGLE_STEPS; i++) {
        const angle = i * LUNA_ANGLE_STEP;
        angles.push({
          ...getConfig(angle),
          placeable: this._canPlace(id, angle, myPos, ObjectManager2, excludeObj),
          perfect: false
        });
      }
      for (let i = 1; i < angles.length; i++) {
        if (angles[i].placeable && !angles[i - 1].placeable) angles[i].perfect = true;
        if (angles[i - 1].placeable && !angles[i].placeable) angles[i - 1].perfect = true;
      }
      this._angleCache.set(key, angles);
      return angles;
    }

    // Luna addPredictObject: queue a build, unless it would land on one this
    // tick has already queued.
    _addPredictObject(id, angle, preplace, myPos) {
      const item = Items[id];
      const dist = 35 + item.scale + (item.placeOffset || 0);
      const x = myPos.x + dist * Math.cos(angle);
      const y = myPos.y + dist * Math.sin(angle);
      for (const obj of this._predictObjects) {
        if (obj.id !== 17 && Math.hypot(x - obj.x, y - obj.y) < item.scale + obj.scale) return;
      }
      this._predictObjects.push({
        id: id,
        angle: angle,
        x: x,
        y: y,
        scale: item.scale,
        preplace: preplace
      });
    }

    // Luna getPrePlaceObject: the object whose slot is about to open. Either
    // one I am about to break myself while gathering, or one the enemy is
    // about to break with a weapon that just came off reload. Whichever it is,
    // the closest to the enemy wins, and finding one arms the replace resend.
    _getPrePlaceObject(myPlayer, enemy, myPos, enemyPos, ObjectManager2) {
      const ModuleHandler = this.client._ModuleHandler;
      let findObject = null;
      const autoGathering = ModuleHandler._autoBreakActive || ModuleHandler.autoattack || ModuleHandler.forceWeapon !== null;
      if (autoGathering) {
        const predictType = ModuleHandler._getPredictWeapon();
        const myWeapon = predictType === 0 || predictType === 1 ? myPlayer.getItemByType(predictType) : null;
        const predictReady = myWeapon !== null && myWeapon !== undefined && myPlayer.isReloaded(predictType, 0);
        if (predictReady) {
          const wd = DataHandler_default?.getWeapon?.(myWeapon);
          if (wd) {
            const myRange = wd.range ?? 0;
            const myDmg = myPlayer.getBuildingDamage?.(myWeapon, myPlayer.hatID === 40) ?? 0;
            const gatherAngle = Config_default.gatherAngle;
            const myFut = myPlayer.pos.future ?? myPos;
            const attackAngle = ModuleHandler._autoBreakActive && ModuleHandler._lastBreakAngle !== null && ModuleHandler._lastBreakAngle !== undefined ? ModuleHandler._lastBreakAngle : ModuleHandler._currentAngle ?? myPos.angle(enemyPos);
            const candidates = [];
            ObjectManager2.grid2D.query(myPos.x, myPos.y, 3, id => {
              const obj = ObjectManager2.objects.get(id);
              if (!obj || !(obj instanceof PlayerObject)) return false;
              if (myFut.distance(obj.pos.current) - obj.scale > myRange) return false;
              let diff = Math.abs(myFut.angle(obj.pos.current) - attackAngle);
              if (diff > Math.PI) diff = Math.PI * 2 - diff;
              if (diff > gatherAngle) return false;
              if (obj.health <= myDmg) candidates.push(obj);
              return false;
            });
            if (candidates.length > 0) {
              candidates.sort((a, b) => enemyPos.distance(a.pos.current) - enemyPos.distance(b.pos.current));
              findObject = candidates[0];
            }
          }
        }
      }
      if (!findObject) {
        const secReload = enemy.reload?.[1];
        const primReload = enemy.reload?.[0];
        const secJustReady = secReload && secReload.previous < secReload.max && secReload.current >= secReload.max;
        const primJustReady = primReload && primReload.previous < primReload.max && primReload.current >= primReload.max;
        const secID = enemy.weapon?.secondary ?? null;
        const primID = enemy.weapon?.primary ?? null;
        let weaponToCheck = null;
        // Luna checks the enemy's secondary only when it is the great hammer,
        // and their primary only when it swings inside 400ms.
        if (secID === 10 && secJustReady) {
          weaponToCheck = secID;
        }
        if (weaponToCheck === null && primID !== null && primJustReady) {
          const wd = DataHandler_default?.getWeapon?.(primID);
          if (wd && (wd.speed ?? 999) <= 400) weaponToCheck = primID;
        }
        if (weaponToCheck !== null) {
          const wd = DataHandler_default?.getWeapon?.(weaponToCheck);
          if (wd) {
            const weaponRange = wd.range ?? 0;
            const dmgToBuilding = enemy.getBuildingDamage?.(weaponToCheck, true) ?? 50;
            const candidates = [];
            ObjectManager2.grid2D.query(enemyPos.x, enemyPos.y, 3, id => {
              const obj = ObjectManager2.objects.get(id);
              if (!obj || !(obj instanceof PlayerObject)) return false;
              // Luna skips anything the enemy cannot see yet — a pit trap they
              // have not walked into is not a slot about to open.
              if (Items[obj.type] && Items[obj.type].hideFromEnemy) return false;
              if (enemyPos.distance(obj.pos.current) - obj.scale > weaponRange) return false;
              if (obj.health <= dmgToBuilding) candidates.push(obj);
              return false;
            });
            if (candidates.length > 0) {
              candidates.sort((a, b) => enemyPos.distance(a.pos.current) - enemyPos.distance(b.pos.current));
              findObject = candidates[0];
            }
          }
        }
      }
      if (findObject) {
        this._spamPrePlacer = true;
      }
      return findObject;
    }

    // Luna's knockback pick, shared by the autoplace and preplace ladders: of
    // the angles whose spike would catch the enemy, keep the ones whose
    // knockback throws them onto a spike we already own, and take the one
    // whose push lines up best with a spike — ties broken by distance.
    _closestSpikeToKb(spikeAngles, spikesOur, enemyPos, enemyFut, enemyScale, pad) {
      const hitsEnemy = a => this._lineInRect(a.x - (enemyScale + a.scale - pad), a.y - (enemyScale + a.scale - pad), a.x + (enemyScale + a.scale - pad), a.y + (enemyScale + a.scale - pad), enemyPos.x, enemyPos.y, enemyFut.x, enemyFut.y);
      const kbLine = a => {
        const kbAngle = Math.atan2(enemyFut.y - a.y, enemyFut.x - a.x);
        return [ enemyFut.x + 200 * Math.cos(kbAngle), enemyFut.y + 200 * Math.sin(kbAngle) ];
      };
      const scored = spikeAngles.filter(a => {
        if (!hitsEnemy(a)) return false;
        const [pX, pY] = kbLine(a);
        for (const sp of spikesOur) {
          const s = sp.pos.current, sc = sp.collisionScale;
          if (this._lineInRect(s.x - sc, s.y - sc, s.x + sc, s.y + sc, enemyFut.x, enemyFut.y, pX, pY)) return true;
        }
        return false;
      }).map(a => {
        const [pX, pY] = kbLine(a);
        let best = Infinity;
        for (const sp of spikesOur) {
          const s = sp.pos.current, sc = sp.collisionScale;
          if (this._lineInRect(s.x - sc, s.y - sc, s.x + sc, s.y + sc, enemyFut.x, enemyFut.y, pX, pY)) {
            const angleToEnemy = Math.atan2(enemyFut.y - a.y, enemyFut.x - a.x);
            const enemyToSpike = Math.atan2(s.y - enemyFut.y, s.x - enemyFut.x);
            let diff = Math.abs(angleToEnemy - enemyToSpike);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            best = Math.min(best, diff);
          }
        }
        return {
          angle: a,
          alignment: best
        };
      });
      if (scored.length === 0) return null;
      const bestScore = Math.min(...scored.map(v => v.alignment));
      return scored.filter(v => v.alignment === bestScore).sort((a, b) => Math.hypot(enemyFut.x - a.angle.x, enemyFut.y - a.angle.y) - Math.hypot(enemyFut.x - b.angle.x, enemyFut.y - b.angle.y))[0]?.angle ?? null;
    }

    // Whether the placer has to keep its hands off right now. Checked at the
    // top of postTick, and again inside each of the three delayed sends —
    // those fire 70-110ms later, which is inside the *next* tick, so a check
    // made when they were scheduled says nothing about the tick they land in.
    // Without the re-check a preplace resend would land in the middle of a
    // spike tick and swap the held item out from under it.
    _shouldYield() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer} = this.client;
      if (!Settings_default._autoplacer) return true;
      if (!myPlayer || !myPlayer.inGame) return true;
      return lunaSpikeTickBusy(ModuleHandler);
    }

    // Luna's "closest angle that catches the enemy on their way": the build
    // box has to cross the segment from where they are to where they will be.
    _closestToEnemy(angles, enemyPos, enemyFut, pad) {
      return angles.filter(a => this._lineInRect(a.x - pad(a), a.y - pad(a), a.x + pad(a), a.y + pad(a), enemyPos.x, enemyPos.y, enemyFut.x, enemyFut.y)).sort((a, b) => Math.hypot(enemyFut.x - a.x, enemyFut.y - a.y) - Math.hypot(enemyFut.x - b.x, enemyFut.y - b.y))[0] ?? null;
    }

    postTick() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer, ObjectManager: ObjectManager2, PlayerManager: PlayerManager2, PacketManager: PacketManager2} = this.client;
      if (this._shouldYield()) return;

      this._tick = ModuleHandler.tickCount;
      for (const [angle, expiry] of this._bannedAngles) {
        if (this._tick > expiry) this._bannedAngles.delete(angle);
      }

      const enemy = EnemyManager2.nearestEnemy;
      if (!enemy) return;

      const spikeId = myPlayer.getItemByType(LUNA_SPIKE_TYPE);
      const trapId = myPlayer.getItemByType(LUNA_TRAP_TYPE);
      if (spikeId === null && trapId === null) return;

      const myPos = myPlayer.pos.current;
      const myFut = myPlayer.pos.future ?? myPos;
      const enemyPos = enemy.pos.current;
      const enemyFut = enemy.pos.future ?? enemyPos;
      const enemyScale = enemy.collisionScale;

      // Luna's spikes_our / traps_our: everything around the enemy that is not
      // an enemy's.
      const spikesOur = [];
      const trapsOur = [];
      ObjectManager2.grid2D.query(enemyPos.x, enemyPos.y, 5, id => {
        const obj = ObjectManager2.objects.get(id);
        if (!obj || !(obj instanceof PlayerObject)) return false;
        if (PlayerManager2.isEnemyByID(obj.ownerID, myPlayer)) return false;
        if (obj.itemGroup === 2) spikesOur.push(obj);
        if (obj.type === 15) trapsOur.push(obj);
        return false;
      });
      const enemyTrapped = trapsOur.find(t => t.pos.current.distance(enemyPos) < t.scale) ?? null;
      const imTrapped = !!myPlayer.isTrapped;
      const neitherTrapped = !enemyTrapped && !imTrapped;
      const predictMoveAngle = getAngleFromBitmask(this.client.InputHandler.move, false) ?? 0;

      // Both Luna toggles behind these are absent from this client, so both
      // are dead — see the header note.
      const canTrapTick = () => false;
      const canShamePlace = () => false;

      // Luna's line-of-sight and tick tests, computed per candidate angle.
      const LOOKAHEAD = 222, START_OFFSET = 35;
      const futX = myPos.x + Math.cos(predictMoveAngle) * LOOKAHEAD;
      const futY = myPos.y + Math.sin(predictMoveAngle) * LOOKAHEAD;
      const stX = myPos.x + Math.cos(predictMoveAngle) * START_OFFSET;
      const stY = myPos.y + Math.sin(predictMoveAngle) * START_OFFSET;
      const _los = cfg => {
        const box = [ cfg.x - cfg.scale - 5, cfg.y - cfg.scale - 5, cfg.x + cfg.scale + 5, cfg.y + cfg.scale + 5 ];
        const blockFuture = this._lineInRect(box[0], box[1], box[2], box[3], stX, stY, futX, futY);
        const blockEnemy = this._lineInRect(box[0], box[1], box[2], box[3], myFut.x, myFut.y, enemyFut.x, enemyFut.y);
        let canSpikeTick = Math.hypot(cfg.x - enemyPos.x, cfg.y - enemyPos.y) < cfg.scale + 35;
        if (canSpikeTick) {
          // A spike that knocks them back towards me is the wrong spike.
          const kbAngle = Math.atan2(enemyPos.y - cfg.y, enemyPos.x - cfg.x);
          const enemyToMe = Math.atan2(myPos.y - enemyPos.y, myPos.x - enemyPos.x);
          let diff = Math.abs(kbAngle - enemyToMe);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          canSpikeTick = diff >= Math.PI / 5;
        }
        const canRetrap = Math.hypot(cfg.x - enemyPos.x, cfg.y - enemyPos.y) < 50;
        return {
          blockFuture: blockFuture,
          blockEnemy: blockEnemy,
          canSpikeTick: canSpikeTick,
          canRetrap: canRetrap
        };
      };

      this._predictObjects = [];
      this._lastPrePlaceObj = null;
      this._spamPrePlacer = false;
      if (ModuleHandler.packetCount >= ModuleHandler.packetLimit) return;

      // Luna's `spampreplace`. With Replace on, the third send always fires;
      // with it off, only a real preplace target arms it.
      if (Settings_default._replace) this._spamPrePlacer = true;

      // Not Luna's: an angle we built at last tick that is still free this
      // tick is an angle the server refused. Sit it out rather than spend the
      // tick's packets on it again.
      if (this._placedAngles.length > 0) {
        const checked = [ ...this._getPrePlaceAngles(spikeId, myPos, myPlayer, ObjectManager2, null), ...this._getPrePlaceAngles(trapId, myPos, myPlayer, ObjectManager2, null) ];
        for (const placed of this._placedAngles) {
          const match = checked.find(a => Math.abs(a.angle - placed) < .01);
          if (match && match.placeable) this._bannedAngles.set(placed, this._tick + LUNA_BAN_TICKS);
        }
      }
      this._placedAngles = [];

      // ────────────────────────────────────────────────────────────────────
      // PRE PLACER — Luna getPredictObjects, first half
      // ────────────────────────────────────────────────────────────────────
      if (Settings_default._prePlace && myPos.distance(enemyPos) < 300 && !(imTrapped && myPlayer.spikeDamage > 0)) {
        const findObject = this._getPrePlaceObject(myPlayer, enemy, myPos, enemyPos, ObjectManager2);
        if (findObject) {
          // Luna drops the doomed object out of the collision set, so the
          // angles it is standing on come back placeable.
          const spikeAngles = this._getPrePlaceAngles(spikeId, myPos, myPlayer, ObjectManager2, findObject);
          const trapAngles = this._getPrePlaceAngles(trapId, myPos, myPlayer, ObjectManager2, findObject);
          const placeableSpikes = spikeAngles.filter(a => a.placeable);
          const placeableTraps = trapAngles.filter(a => a.placeable);
          const closestSpikeToEnemy = this._closestToEnemy(placeableSpikes, enemyPos, enemyFut, a => enemyScale + a.scale - 1);
          const closestTrapToEnemy = this._closestToEnemy(placeableTraps, enemyPos, enemyFut, a => a.scale);
          const closestSpikeToKb = this._closestSpikeToKb(placeableSpikes, spikesOur, enemyPos, enemyFut, enemyScale, 2);

          const isPrePlaceAngle = config => {
            if (myPos.distance(enemyPos) > 350) return false;
            const isSpike = config.id === spikeId && !this._isItemLimit(spikeId, myPlayer);
            const isTrap = config.id === trapId && !this._isItemLimit(trapId, myPlayer);
            const {blockFuture: blockFuture, blockEnemy: blockEnemy, canSpikeTick: canSpikeTick, canRetrap: canRetrap} = _los(config);
            if (isSpike && canSpikeTick && canTrapTick()) return true;
            if (isTrap && canRetrap && canShamePlace()) return true;
            // 1: the spike that catches a trapped enemy
            if (isSpike && enemyTrapped && findObject !== enemyTrapped && closestSpikeToEnemy && config === closestSpikeToEnemy) return true;
            // 2: retrap an enemy already taking spike damage, when the trap
            //    holding them is the thing about to break
            if (isTrap && enemy.spikeDamage > 0 && enemyTrapped && findObject === enemyTrapped && closestTrapToEnemy && config === closestTrapToEnemy) return true;
            // 3: the spike whose knockback throws them onto another spike
            if (isSpike && closestSpikeToKb && config === closestSpikeToKb && !canShamePlace()) return true;
            // 4: any spike that does not wall off my own path or my view of them
            if (isSpike && enemyTrapped && !blockFuture && !blockEnemy && findObject !== enemyTrapped) return true;
            // 5: any trap
            if (isTrap) return true;
            return false;
          };

          // Spikes first, then traps; within each, the angle nearest the slot
          // that is opening.
          let findAngle = null;
          for (const angles of [ spikeAngles, trapAngles ]) {
            if (findAngle) break;
            findAngle = angles.filter(a => a.placeable && isPrePlaceAngle(a)).sort((a, b) => Math.hypot(findObject.pos.current.x - a.x, findObject.pos.current.y - a.y) - Math.hypot(findObject.pos.current.x - b.x, findObject.pos.current.y - b.y))[0] ?? null;
          }
          if (findAngle) {
            this._addPredictObject(findAngle.id, findAngle.angle, true, myPos);
            this._lastPrePlaceObj = findObject;
          }
        }
      }

      // ────────────────────────────────────────────────────────────────────
      // AUTO PLACER — Luna updateAngles + isAutoPlaceAngle
      // ────────────────────────────────────────────────────────────────────
      {
        const spikeAngles = this._getPrePlaceAngles(spikeId, myPos, myPlayer, ObjectManager2, null);
        const trapAngles = this._getPrePlaceAngles(trapId, myPos, myPlayer, ObjectManager2, null);
        const notBanned = a => !this._bannedAngles.has(a.angle);
        const validSpike = spikeAngles.filter(a => notBanned(a) && (a.placeable || a.perfect));
        const validTrap = trapAngles.filter(a => notBanned(a) && (a.placeable || a.perfect));
        const validAngles = [ ...validSpike, ...validTrap ];
        const closestSpikeToEnemy = this._closestToEnemy(validSpike, enemyPos, enemyFut, a => enemyScale + a.scale - 1);
        const closestTrapToEnemy = this._closestToEnemy(validTrap, enemyPos, enemyFut, a => a.scale);
        const closestSpikeToKb = this._closestSpikeToKb(validSpike, spikesOur, enemyPos, enemyFut, enemyScale, 1);

        const isAutoPlaceAngle = config => {
          if (myPos.distance(enemyPos) > (Settings_default._autoplacerRadius ?? 350)) return false;
          const isSpike = config.id === spikeId && !this._isItemLimit(spikeId, myPlayer);
          const isTrap = config.id === trapId && !this._isItemLimit(trapId, myPlayer);
          const {blockFuture: blockFuture, blockEnemy: blockEnemy} = _los(config);
          if (isSpike) {
            // 1: the spike that catches a trapped enemy
            if (enemyTrapped && closestSpikeToEnemy && config === closestSpikeToEnemy) return true;
            // 2: the spike whose knockback throws them onto another spike
            if (closestSpikeToKb && config === closestSpikeToKb) return true;
            // 3: spikes that do not wall off my own path or my view of them
            if (enemyTrapped && !blockFuture && !blockEnemy) return true;
          }
          if (isTrap) {
            // 1: the trap that retraps them as they move
            if (closestTrapToEnemy && config === closestTrapToEnemy && neitherTrapped) return true;
            // 2: any trap, while neither of us is pinned
            if (neitherTrapped) return true;
          }
          return false;
        };

        // Perfect angles first — Luna's two passes, in order.
        for (const obj of validAngles.filter(a => a.perfect)) {
          if (isAutoPlaceAngle(obj)) this._addPredictObject(obj.id, obj.angle, false, myPos);
        }
        for (const obj of validAngles.filter(a => a.placeable && !a.perfect)) {
          if (isAutoPlaceAngle(obj)) this._addPredictObject(obj.id, obj.angle, false, myPos);
        }
      }

      // ────────────────────────────────────────────────────────────────────
      // SEND — autoplace now, preplace next tick, replace at min ping
      // ────────────────────────────────────────────────────────────────────
      const typeOf = obj => obj.id === trapId ? LUNA_TRAP_TYPE : LUNA_SPIKE_TYPE;
      const outOfBudget = () => ModuleHandler.packetCount + LUNA_PLACE_COST > ModuleHandler.packetLimit;
      const emit = obj => {
        const type = typeOf(obj);
        // Luna only checks the item cap; RYN also knows whether the resources
        // are there, so a build it would refuse never reaches the wire.
        if (!myPlayer.canPlace(type)) return;
        ModuleHandler.place(type, obj.angle);
        ModuleHandler.placedOnce = true;
        ModuleHandler.placeAngles[0] = type;
        ModuleHandler.placeAngles[1].push(obj.angle);
        ModuleHandler.moduleActive = true;
        this._placedAngles.push(obj.angle);
      };

      for (const obj of this._predictObjects) {
        if (obj.preplace) continue;
        if (outOfBudget()) break;
        emit(obj);
      }

      const preObjects = this._predictObjects.filter(o => o.preplace);
      if (preObjects.length === 0) return;

      const socket = this.client.SocketManager;
      const pingTime = socket?.pong ?? 0;
      const minPingTime = Number.isFinite(socket?.minPingTime) ? socket.minPingTime : 0;
      const aimAngle = () => ModuleHandler._autoBreakActive && ModuleHandler._lastBreakAngle !== null && ModuleHandler._lastBreakAngle !== undefined ? ModuleHandler._lastBreakAngle : ModuleHandler._currentAngle ?? 0;

      // Luna keeps the aim pointed where it was attacking across all three
      // sends, so a build never drags the swing off target.
      //
      // All three re-check _shouldYield first. They land in the next tick, and
      // if a spike tick claimed that one it owns the held item and the swing —
      // a build sent into the middle of it costs the tick.
      setTimeout(() => {
        if (this._shouldYield()) return;
        try {
          for (const _ of preObjects) PacketManager2.updateAngle(aimAngle());
        } catch (_) {}
      }, 1);
      setTimeout(() => {
        if (this._shouldYield()) return;
        try {
          for (const obj of preObjects) {
            if (outOfBudget()) break;
            emit(obj);
            PacketManager2.updateAngle(aimAngle());
          }
        } catch (_) {}
      }, Math.max(1, 111 - pingTime));
      setTimeout(() => {
        if (!this._spamPrePlacer) return;
        if (this._shouldYield()) return;
        try {
          for (const obj of preObjects) {
            if (outOfBudget()) break;
            emit(obj);
            PacketManager2.updateAngle(aimAngle());
          }
        } catch (_) {}
      }, Math.max(1, 111 - minPingTime));
    }
  }
