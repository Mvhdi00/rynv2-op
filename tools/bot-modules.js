  // ==========================================================================
  // Bot-only combat modules. Both live in ModuleHandler.botModules, so they run
  // for bots and never for the owner, and both go out through ModuleHandler —
  // no separate scheduler, no separate packet path.
  // ==========================================================================

  // Ranged secondaries a bot can kite with. Great hammer (10), shield (11) and
  // Mc Grabby (14) are the other secondaries and none of them shoot.
  const BOT_RANGED_SECONDARIES = new Set([ 9, 12, 13, 15 ]);

  // Sakuna's autobreak, for bots.
  //
  // Sakuna sweeps 360 one-degree directions, counts the blocking builds within
  // 90 degrees of each, takes the fullest direction, sorts those builds by
  // health and swings at the mean angle to them:
  //
  //     for (let i = 0; i < 2*PI; i += angleStep) { ...within PI/2... }
  //     bestDirection = buildsByDirection.reduce(longest)
  //     sortedByHealth = [...bestDirection].sort((a,b) => a.health - b.health)
  //     player.nearBreakAim = calculateMeanAngle(angles)
  //
  // The sweep is the expensive way to write it. The best direction always has a
  // blocking build within 90 degrees of it, so testing the directions of the
  // builds themselves finds the same maximum from n candidates instead of 360 —
  // same answer, and it cannot miss a cluster that falls between two steps.
  const BOT_BREAK_ARC = Math.PI / 2;
  // How slow counts as "not moving" — RYN's Entity.speed is the distance
  // covered last tick, so this is a fraction of a normal step.
  const BOT_BREAK_STUCK_SPEED = 8;
  // Ticks of being stuck before swinging. One stalled tick is a collision, three
  // in a row is something in the way.
  const BOT_BREAK_STUCK_TICKS = 3;
  const BOT_BREAK_RELEASE_TICKS = 2;

  class BotAutoBreak {
    moduleName="botAutoBreak";
    client;
    stuckTicks=0;
    freeTicks=0;
    target=null;
    constructor(client2) {
      this.client = client2;
    }
    reset() {
      this.stuckTicks = 0;
      this.freeTicks = 0;
      this.target = null;
    }

    // Mean of a set of angles, taken on the unit circle so that headings either
    // side of the +/-PI seam average to the direction between them rather than
    // to zero.
    _meanAngle(angles) {
      let sx = 0, sy = 0;
      for (let i = 0; i < angles.length; i++) {
        sx += Math.cos(angles[i]);
        sy += Math.sin(angles[i]);
      }
      if (sx === 0 && sy === 0) return angles[0] ?? 0;
      return Math.atan2(sy, sx);
    }

    // Everything within reach that could be what the bot is walking into.
    _blockers(myPlayer, ObjectManager2, PlayerManager2, reach) {
      const pos = myPlayer.pos.current;
      const out = [];
      ObjectManager2.grid2D.query(pos.x, pos.y, 2, id => {
        const obj = ObjectManager2.objects.get(id);
        if (obj === void 0 || !(obj instanceof PlayerObject)) return false;
        if (!obj.isDestroyable) return false;
        // Things you can walk over are never the reason you stopped.
        if (obj.canMoveOnTop()) return false;
        const d = pos.distance(obj.pos.current);
        if (d - obj.collisionScale > reach) return false;
        out.push({
          obj: obj,
          angle: pos.angle(obj.pos.current),
          dist: d
        });
        return false;
      });
      return out;
    }

    postTick() {
      if (!Settings_default._botAutoBreak) {
        this.reset();
        return;
      }
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler, ObjectManager: ObjectManager2, PlayerManager: PlayerManager2} = this.client;
      if (!myPlayer || !myPlayer.inGame) {
        this.reset();
        return;
      }
      // Never fight a higher-priority action for the tick.
      if (ModuleHandler.moduleActive || ModuleHandler.placedOnce) return;

      // Stuck means: told to move, and not moving. A bot standing still because
      // nobody asked it to walk is not stuck.
      const wantsToMove = ModuleHandler.move_dir !== null && ModuleHandler.move_dir !== void 0;
      const moving = myPlayer.speed > BOT_BREAK_STUCK_SPEED;
      if (!wantsToMove || moving) {
        this.freeTicks++;
        if (this.freeTicks >= BOT_BREAK_RELEASE_TICKS) {
          this.stuckTicks = 0;
          this.target = null;
        }
        return;
      }
      this.freeTicks = 0;
      this.stuckTicks++;
      if (this.stuckTicks < BOT_BREAK_STUCK_TICKS) return;

      const primary = myPlayer.getItemByType(0);
      const secondary = myPlayer.getItemByType(1);
      // Sakuna breaks with the great hammer when it has one, otherwise the
      // primary — `player.weapons[1] == 10 ? weapons[1] : weapons[0]`.
      const useSecondary = secondary === 10;
      const weaponID = useSecondary ? secondary : primary;
      if (weaponID === null || weaponID === void 0) return;
      const weapon = DataHandler_default.getWeapon(weaponID);
      if (!weapon) return;
      const reloading = ModuleHandler.staticModules.reloading;
      if (!reloading.isReloaded(useSecondary ? 1 : 0)) return;

      const blockers = this._blockers(myPlayer, ObjectManager2, PlayerManager2, weapon.range ?? 0);
      if (blockers.length === 0) {
        this.target = null;
        return;
      }

      // Sakuna's fullest-direction pick, over the blockers' own directions.
      let best = null;
      for (let i = 0; i < blockers.length; i++) {
        const dir = blockers[i].angle;
        const group = [];
        for (let j = 0; j < blockers.length; j++) {
          if (getAngleDist(dir, blockers[j].angle) < BOT_BREAK_ARC) group.push(blockers[j]);
        }
        if (best === null || group.length > best.length) best = group;
      }
      if (best === null || best.length === 0) return;

      // Lowest health first, and swing at the mean direction of the group so one
      // swing covers as much of the wall as the arc allows.
      best.sort((a, b) => a.obj.health - b.obj.health);
      const aim = this._meanAngle(best.map(b => b.angle));

      ModuleHandler.moduleActive = true;
      ModuleHandler.useAngle = aim;
      ModuleHandler.forceWeapon = useSecondary ? 1 : 0;
      ModuleHandler.shouldAttack = true;
      this.target = best[0].obj;
    }
  }

  // Target selection that ignores a raised shield.
  //
  // A wooden shield blocks a 60 degree arc in front of whoever holds it
  // (Config.shieldAngle), and against it getMaxWeaponDamage returns literally
  // zero for anything shootable and a fifth for melee. So the shield bot parked
  // in front of a group is not a hard target, it is a target worth nothing at
  // all, and every arrow spent on it is spent on nothing.
  //
  // PlayerManager.lookingShield already answers the exact question — is this
  // player holding weapon 11 *and* facing me — so the pick is just "nearest
  // enemy that is not doing that". A shield only faces one way, so it is
  // per-bot: the same shield bot can be blocking one of your bots and wide open
  // to another standing off its flank, and each bot decides for itself.
  const BOT_TARGET_RANGE = 1500;
  function botPickTarget(client) {
    const {myPlayer: myPlayer, PlayerManager: PlayerManager2, EnemyManager: EnemyManager2} = client;
    const nearest = EnemyManager2.nearestEnemy;
    if (!Settings_default._botAvoidShield) {
      return {
        target: nearest,
        shielded: null,
        blockedBy: null
      };
    }
    const enemies = PlayerManager2.enemies;
    if (!enemies || enemies.length === 0) {
      return {
        target: nearest,
        shielded: null,
        blockedBy: null
      };
    }
    const myPos = myPlayer.pos.current;
    let open = null, openDist = Infinity;
    let shielded = null, shieldedDist = Infinity;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e || !e.pos) continue;
      const d = myPos.distance(e.pos.current);
      if (d > BOT_TARGET_RANGE) continue;
      let blocking = false;
      try {
        blocking = PlayerManager2.lookingShield(e, myPlayer);
      } catch (_) {}
      if (blocking) {
        if (d < shieldedDist) {
          shieldedDist = d;
          shielded = e;
        }
        continue;
      }
      if (d < openDist) {
        openDist = d;
        open = e;
      }
    }
    // `shielded` is reported whether or not an open target exists, because
    // volley fire needs to know where the shield is in order to shove it even
    // while other people are standing in the open.
    //
    // `blockedBy` is the narrower question — is the shield the *only* thing
    // left — and it is what makes the caller hold fire rather than quietly fall
    // back to the nearest and feed shots into a wall. A shield cannot be held
    // and swung at the same time, so waiting costs the bot nothing.
    return {
      target: open,
      shielded: shielded,
      blockedBy: open === null ? shielded : null
    };
  }

  // Volley fire.
  //
  // A shield only blocks what it faces, and an arrow into it still moves the
  // player holding it. So against a shield wall the useful order is: a handful
  // of bots shoot the shield and shove it backwards, and the moment it has
  // moved, everyone else shoots the people it was covering.
  //
  // Firing all forty bots at once wastes the whole salvo on the shield, because
  // every one of them resolves against the same frame in which the shield was
  // still in front. Splitting it means only the opening wave is spent on the
  // push, and the rest lands after the picture has changed.
  //
  // The state is per owner, not per bot, because the waves have to agree on
  // which one is firing — a bot deciding its own phase would put wave two out
  // before wave one on the first tick it happened to run.
  const BOT_VOLLEY_STATE = new WeakMap;
  // Gap between the waves. Long enough for the shove and the arrows already in
  // the air to resolve, short enough that the target has not walked out of it.
  const BOT_VOLLEY_GAP_MS = 260;
  // After this long with no attack the sequence starts over rather than leaving
  // wave two permanently armed.
  const BOT_VOLLEY_RESET_MS = 700;

  function botVolleyState(owner) {
    let v = BOT_VOLLEY_STATE.get(owner);
    if (v === void 0) {
      v = {
        phase: "idle",
        startedAt: 0,
        lastSeen: 0
      };
      BOT_VOLLEY_STATE.set(owner, v);
    }
    return v;
  }

  // Which wave this bot belongs to, and whether that wave may fire yet.
  function botVolleyTurn(client, owner, now) {
    if (!Settings_default._botVolley) {
      return {
        mayFire: true,
        wave: 0
      };
    }
    const v = botVolleyState(owner);
    if (now - v.lastSeen > BOT_VOLLEY_RESET_MS) {
      v.phase = "idle";
    }
    v.lastSeen = now;
    if (v.phase === "idle") {
      v.phase = "first";
      v.startedAt = now;
    }
    if (v.phase === "first" && now - v.startedAt >= BOT_VOLLEY_GAP_MS) {
      v.phase = "rest";
    }
    const size = Math.max(1, Settings_default._botVolleyWave ?? 5);
    const index = owner.getClientIndex(client);
    const inFirst = index >= 0 && index < size;
    return {
      mayFire: v.phase === "rest" || inFirst,
      wave: inFirst ? 1 : 2,
      phase: v.phase
    };
  }

  // Ranged kiting. With a bow, crossbow, repeater or musket in the secondary,
  // holding attack sends the bots out to a set distance and has them shoot the
  // enemy from there instead of walking into melee with a weapon that does not
  // want to be there.
  const BOT_KITE_BAND = 45;        // px of slack either side of the set distance
  const BOT_KITE_MIN = 150;
  const BOT_KITE_MAX = 1200;

  class BotRangedAttack {
    moduleName="botRangedAttack";
    client;
    active=false;
    lastDir=null;
    constructor(client2) {
      this.client = client2;
    }
    reset() {
      this.active = false;
      this.lastDir = null;
    }

    // Is the owner asking for an attack right now — left mouse, the autoattack
    // toggle, or the bot auto-attack toggle.
    _ownerAttacking() {
      const owner = this.client.ownerClient;
      if (!owner) return false;
      if (Settings_default._botAutoAttackEnabled) return true;
      const mh = owner._ModuleHandler;
      return !!(mh && (mh.attacking === 1 || mh.attackingState === 1));
    }

    postTick() {
      this.active = false;
      if (!Settings_default._botRangedKite) return;
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2} = this.client;
      if (!myPlayer || !myPlayer.inGame) return;
      if (ModuleHandler.moduleActive) return;
      const secondary = myPlayer.getItemByType(1);
      if (!this._ownerAttacking()) return;

      const pick = botPickTarget(this.client);
      const owner = this.client.ownerClient;
      const now = Date.now();
      const turn = owner && typeof owner.getClientIndex === "function" ? botVolleyTurn(this.client, owner, now) : {
        mayFire: true,
        wave: 0
      };
      // Wave one shoots the shield itself when there is one, because the point
      // of that wave is the shove, not the damage. Wave two shoots whoever the
      // shield was covering.
      const enemy = turn.wave === 1 && pick.shielded !== null && pick.shielded !== void 0 ? pick.shielded : pick.target;

      // Melee bots get the same target choice without the kiting: the swing is
      // simply pointed at someone it can actually hurt.
      if (!BOT_RANGED_SECONDARIES.has(secondary)) {
        if (Settings_default._botAvoidShield && enemy !== null) {
          ModuleHandler.useAngle = myPlayer.pos.current.angle(enemy.pos.future ?? enemy.pos.current);
        }
        return;
      }

      if (enemy === null) {
        // Nothing worth shooting: hold the shot, but keep station off whoever is
        // hiding behind the shield rather than drifting into them.
        if (pick.blockedBy !== null) {
          this.active = true;
          const holdDist = myPlayer.pos.current.distance(pick.blockedBy.pos.current);
          const holdWant = Math.min(BOT_KITE_MAX, Math.max(BOT_KITE_MIN, Settings_default._botKiteDistance ?? 400));
          if (holdDist < holdWant - BOT_KITE_BAND) {
            const away = myPlayer.pos.current.angle(pick.blockedBy.pos.current) + Math.PI;
            if (this.lastDir === null || getAngleDist(away, this.lastDir) > .15) {
              ModuleHandler.startMovement(away);
              this.lastDir = away;
            }
          }
        }
        return;
      }

      const myPos = myPlayer.pos.current;
      const enemyPos = enemy.pos.current;
      // Lead the shot by a tick, the same one-tick extrapolation the rest of the
      // client aims with.
      const aimPos = enemy.pos.future ?? enemyPos;
      const dist = myPos.distance(enemyPos);
      const want = Math.min(BOT_KITE_MAX, Math.max(BOT_KITE_MIN, Settings_default._botKiteDistance ?? 400));

      // Hold the band. Closer than it and they back off, further and they close
      // in; inside it they stand and shoot, which is what makes the volley land
      // together instead of trailing in one bot at a time.
      const toEnemy = myPos.angle(enemyPos);
      let want_dir = null;
      if (dist < want - BOT_KITE_BAND) want_dir = toEnemy + Math.PI;
      else if (dist > want + BOT_KITE_BAND) want_dir = toEnemy;
      // PacketManager.move sends on every call, and a bot holding the band would
      // otherwise re-send "stop" nine times a second for as long as it stands
      // there. Only a real change of direction is worth a packet.
      const changed = want_dir === null !== (this.lastDir === null) || want_dir !== null && this.lastDir !== null && getAngleDist(want_dir, this.lastDir) > .15;
      if (changed) {
        ModuleHandler.startMovement(want_dir);
        this.lastDir = want_dir;
      } else {
        ModuleHandler.move_dir = want_dir;
      }

      ModuleHandler.moduleActive = true;
      ModuleHandler.useAngle = myPos.angle(aimPos);
      ModuleHandler.forceWeapon = 1;
      // Wave two is aimed and in position, it just does not loose yet.
      ModuleHandler.shouldAttack = turn.mayFire;
      // Claims the tick's movement so the Movement module leaves it alone.
      this.active = true;
    }
  }
