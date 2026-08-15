    // ------------------------------------------------------------------------
    // Autoheal — Novastorm's rule, whole.
    //
    // Novastorm decides with one number. It accumulates every source of damage
    // that could land this tick — spike contact, weapon hits in range and off
    // reload, turrets, secondaries, poison — caps it at 140, adjusts for the hat
    // that is actually on, and heals if that number reaches its health. On top
    // of that it tops up whenever a tick passed without being hit:
    //
    //     if (currentHat == 6) totalDmgPot *= 0.75;
    //     if (currentHat == 7) totalDmgPot += 5;
    //     if (myPlayer.health <= totalDmgPot) healing = true;
    //     if (((healing && shameCount < 7) || (tick - damageTick) > 0)
    //         && myPlayer.health < 100) heal(100 - myPlayer.health);
    //
    // What was here instead was eight stacked special cases — trap about to
    // break, melee+ranged combo in range, reverse insta, tool hammer, ranged
    // bow, danger flags, health under 20 — each with its own hand-picked number
    // of food presses. Every one of those cases is a specific way of arriving at
    // "they can take my health bar off this tick", which is the number
    // EnemyManager already computes and keeps in potentialDamage +
    // potentialSpikeDamage. The cascade was a worse estimator of a quantity that
    // was sitting right there, and each branch healed a different amount for no
    // stated reason.
    //
    // Two things are RYN's and stay, because novastorm has no equivalent:
    //   · myPlayer.shameActive — do not spend food while the server is refusing
    //     it anyway
    //   · ModuleHandler.heal()'s shame guard, which queues a heal that lands
    //     inside the post-damage window rather than dropping it
    // ------------------------------------------------------------------------
    postTick() {
      this.forceHeal = false;
      // Cleared every tick and re-set below, so the latch cannot survive the
      // situation that raised it — autoBreak reads it on the following tick.
      this.blockBreak = false;
      if (!Settings_default._autoheal) {
        return;
      }
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2} = this.client;
      if (myPlayer.shameActive) {
        return;
      }
      const foodID = myPlayer.getItemByType(2);
      if (foodID === null || foodID === void 0 || !Items[foodID]) {
        return;
      }
      const restore = Items[foodID].restore;
      const tempHealth = myPlayer.tempHealth;
      const maxHealth = myPlayer.maxHealth;
      const shameCount = myPlayer.shameCount;
      const nearestEnemy = EnemyManager2.nearestEnemy;

      // Anti Smart Tick keeps its own branch ahead of the rule: it is not a heal
      // decision, it is a refusal to break out of a trap into a spike, and the
      // heal is what it does with the tick instead.
      if (Settings_default._antiSmartTick && myPlayer.isTrapped && nearestEnemy) {
        const {ObjectManager: ObjectManager2, PlayerManager: PlayerManager2} = this.client;
        if (this.antiSmartTick(myPlayer, nearestEnemy, ModuleHandler, ObjectManager2, PlayerManager2)) {
          ModuleHandler.healedOnce = true;
          ModuleHandler.didAntiInsta = true;
          ModuleHandler.shouldAttack = false;
          const needTimes = Math.max(1, Math.ceil((maxHealth - tempHealth) / restore));
          const hits = Math.max(needTimes + 1, 3);
          for (let i = 0; i < hits; i++) ModuleHandler.heal();
          return;
        }
      }

      if (tempHealth >= maxHealth) {
        return;
      }

      // Novastorm's totalDmgPot. EnemyManager has already summed weapon,
      // turret, secondary and projectile damage into potentialDamage and
      // resolved the spike term into potentialSpikeDamage this tick.
      let dmgPot = EnemyManager2.potentialDamage + EnemyManager2.potentialSpikeDamage;
      if (dmgPot > ANTI_INSTA_DMG_CAP) {
        dmgPot = ANTI_INSTA_DMG_CAP;
      }
      const hatID = myPlayer.hatID;
      if (hatID === 6) {
        dmgPot *= Hats[6].dmgMult;
      }
      if (hatID === 7) {
        dmgPot += ANTI_INSTA_SCUBA_BIAS;
      }
      const healing = tempHealth <= dmgPot;

      // The second half of novastorm's condition: a tick went by without being
      // hit, so topping up costs nothing that matters.
      const quiet = this.isSaveHealTick();
      if (!((healing && shameCount < 7) || quiet)) {
        return;
      }
      this.forceHeal = healing;
      if (healing) {
        ModuleHandler.didAntiInsta = true;
      }
      ModuleHandler.healedOnce = true;
      const needTimes = Math.max(1, Math.ceil((maxHealth - tempHealth) / restore));
      for (let i = 0; i < needTimes; i++) {
        ModuleHandler.heal();
      }
    }
