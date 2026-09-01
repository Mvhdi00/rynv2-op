import subprocess, sys, shutil, os
SRC = "ryn/RYN_Client_v5.4.user.js"
MUT = "/tmp/claude-0/-home-user-rynv2-op/84985967-839c-5cb9-84f9-ceebbe0cce70/scratchpad/mut.js"
base = open(SRC, encoding="utf-8").read()

MUTATIONS = [
  ("heal presses once, not once per restore",
   "for (let i = 0; i < maxHealth - tempHealth; i += restore) {",
   "for (let i = 0; i < 1; i += restore) {"),
  ("velocityTick dropped from the run order",
   "this.staticModules.velocityTick, ", ""),
  ("_velocityTick setting removed",
   "    _velocityTick: false,\n", ""),
  ("Devtool span id renamed",
   '_automillSent\\" class', '_automillWrong\\" class'),
  ("a deleted helper is called again",
   "      ModuleHandler.healedOnce = true;\n      for (let i = 0;",
   "      this._healsInFlight(ModuleHandler);\n      ModuleHandler.healedOnce = true;\n      for (let i = 0;"),
  ("AntiSpikePush reads pushingOnSpike again",
   "      // (nearestTrap && spikeDmgCount < 1)",
   "      if (!EnemyManager2.pushingOnSpike) return;\n      // (nearestTrap && spikeDmgCount < 1)"),
  ("heal() regains its packet budget",
   "      this.selectItem(2);\n      this.attack(null, 1);",
   "      if (this._healBudgetLeft() < 3) return;\n      this.selectItem(2);\n      this.attack(null, 1);"),
  ("heal() presses food through the 30s shame lock again",
   "      if (myPlayer && myPlayer.shameActive) {\n        return;\n      }\n", ""),
  ("heal() stops asking about the 120ms window",
   "      if (!this._foodIsShameSafe()) {\n        return;\n      }\n", ""),
  ("the food guard waits for the window forever",
   "      if (lands >= SHAME_SAFE_WINDOW || this._foodHeldTick === this.tickCount - 1) {",
   "      if (lands >= SHAME_SAFE_WINDOW) {"),
  ("the food guard answers twice in one tick",
   "      if (this._foodHeldTick === this.tickCount) {\n        return false;\n      }\n", ""),
  ("trap branch replaces the window instead of widening it",
   "const inAttackRange = inRange(dist1, this.minKB, this.maxKB) ||\n        pinned && dist1 <= VELOCITY_TICK_TRAP_RANGE;",
   "const inAttackRange = pinned ? dist1 <= VELOCITY_TICK_TRAP_RANGE : inRange(dist1, this.minKB, this.maxKB);"),
  ("trap branch stops checking who owns the trap",
   "return !PlayerManager2.isEnemyByID(trappedIn.ownerID, myPlayer);", "return true;"),
  ("automill goes back to placing whatever fits",
   "      if (!this.canPlaceWindmill(angle) ||\n          !this.canPlaceWindmill(leftAngle) ||\n          !this.canPlaceWindmill(rightAngle)) {\n        return;\n      }",
   "      if (!this.canPlaceWindmill(angle)) {\n        return;\n      }"),
  ("knockback tick drops the turret follow-up",
   "            if (!isPrimaryEnough) {\n              this.useTurret = true;\n            }\n", ""),
  ("knockback tick removed from the run order",
   "this.staticModules.knockbackTick, ", ""),
  ("blood wings comes back on a stationary player",
   "      // Standing still used to force Blood Wings (18). Removed: nothing about",
   "      if (!ModuleHandler.isMoving && myPlayer.speed <= 5) {\n        if (useBloodWings) return 18;\n      }\n      // Standing still used to force Blood Wings (18). Removed: nothing about"),
  ("shared bot name stops reaching the rows",
   "        const sharedName = (Settings_default._botNameAll || \"\").trim();",
   "        const sharedName = \"\";"),
  ("numbered bot name stops trimming the base",
   "return base.slice(0, Math.max(0, 15 - suffix.length)) + suffix;",
   "return base + suffix;"),
  ("updateAutomill queries the wrong element",
   'querySelector("#_automillSent")', 'querySelector("#nope")'),
  ("VelocityTick class deleted but still registered",
   "  class VelocityTick {", "  class VelocityTickX {"),
  ("the long-range turret anti is never called",
   "      this.antiLongRangeTurret(enemy);\n", ""),
  ("the turret anti runs after its damage has been counted",
   "      this.antiLongRangeTurret(enemy);\n      this.potentialDamage += enemy.potentialDamage;",
   "      this.potentialDamage += enemy.potentialDamage;\n      this.antiLongRangeTurret(enemy);"),
  ("the turret anti reads the enemy's spike flags instead of mine",
   "        if (this.collidingSpike && primaryJustFired\n            || this.willCollideSpike && !primaryReloaded",
   "        if (enemy.collidingSpike && primaryJustFired\n            || enemy.willCollideSpike && !primaryReloaded"),
  ("the turret's reach shrinks to weapon range",
   "  const ANTI_TURRET_RANGE = 350;", "  const ANTI_TURRET_RANGE = 200;"),
  ("the turret predicts no damage at all",
   "  const ANTI_TURRET_DAMAGE = 25;", "  const ANTI_TURRET_DAMAGE = 0;"),
  ("the velocity-tick band leans on the outer guard and lets 350 in",
   "      if (distance <= ANTI_VELOCITY_TICK_MIN || distance >= ANTI_TURRET_RANGE) {",
   "      if (distance <= ANTI_VELOCITY_TICK_MIN) {"),
  ("the velocity-tick anti stops checking for turret gear",
   "      if (!primaryReloaded || enemy.hatID !== ANTI_VELOCITY_TICK_HAT) {",
   "      if (!primaryReloaded) {"),
  ("the velocity-tick anti forgets the primary that comes with it",
   "      enemy.potentialDamage += ANTI_TURRET_DAMAGE +\n        (primary !== null && primary !== undefined ? enemy.getMaxWeaponDamage(primary, lookingShield) : 0);",
   "      enemy.potentialDamage += ANTI_TURRET_DAMAGE;"),
  # The spike tick is gone in every form; these put a piece of it back, or
  # reach into one of the three placement systems again.
  ("a spike tick class comes back",
   "  class SpikeSync {",
   "  class SpikeTick {\n    moduleName=\"spikeTick\";\n  }\n  class SpikeSync {"),
  ("a SPIKE_TICK constant comes back",
   "  const ANTI_TURRET_RANGE = 350;",
   "  const SPIKE_TICK_TYPE = 4;\n  const ANTI_TURRET_RANGE = 350;"),
  ("a _spikeTick setting comes back",
   "    _velocityTick: false,", "    _spikeTick: false,\n    _velocityTick: false,"),
  ("auto place asks the placement engine before it sends again",
   "        if (!myPlayer.canPlace(type)) return;\n        ModuleHandler.place(type, obj.angle);",
   "        if (!myPlayer.canPlace(type)) return;\n        if (!placementEngine.groundIsFree(type, obj.angle)) return;\n        ModuleHandler.place(type, obj.angle);"),
  ("auto place stops sending at all",
   "        ModuleHandler.place(type, obj.angle);\n        ModuleHandler.placedOnce = true;",
   "        ModuleHandler.placedOnce = true;"),
  ("Luna's unconditional trap branch is made conditional",
   "            if (neitherTrapped) return true;", "            if (neitherTrapped) return false;"),
  ("the placement engine grows a reservation API",
   "    anglesFor(", "    groundIsFree(t, a) { return true; }\n    anglesFor("),
  ("preplace generation is removed from the engine",
   "    _generatePreplace(", "    _generatePreplaceX("),
  ("replace generation is removed from the engine",
   "    _generateReplace(", "    _generateReplaceX("),
  ("auto place loses its own canSpikeTick",
   "        let canSpikeTick = Math.hypot(", "        let canSpikeTickX = Math.hypot("),

  # Aimed at anti-audit's dataflow column: a term whose name survives but whose
  # value stops reaching the total AntiInsta sums. This is the pushingOnSpike
  # failure mode, and a name-existence probe cannot see it.
  ("the poison tick is computed and dropped",
   "        this.potentialDamage += 5;", "        const unusedPoison = 5;"),
  ("projectiles in flight stop being counted",
   "      this.potentialDamage += this.client.ProjectileManager.totalDamage;",
   "      const unusedProjectiles = this.client.ProjectileManager.totalDamage;"),
  ("the knockback anti stops feeding the spike total",
   "              this.potentialSpikeKnockbackDamage = Math.max(this.potentialSpikeKnockbackDamage, object.getDamage());",
   "              this.possibleToKnockbackDamage = object.getDamage();"),
  ("the secondary's damage is dropped from the total",
   "          this.potentialDamage += secondaryDamage;", "          const unusedSecondary = secondaryDamage;"),
  ("AntiInsta sums something other than the two accumulators",
   "      let totalDmgPot = EnemyManager2.potentialDamage + EnemyManager2.potentialSpikeDamage;",
   "      let totalDmgPot = EnemyManager2.potentialDamage;"),
  ("the 140 cap is removed",
   "      if (totalDmgPot > ANTI_INSTA_DMG_CAP) {", "      if (false) {"),
  # Aimed at shame-model: the three guards, and the mirror they read.
  ("the shame mirror stops counting up",
   "          this.shameCount += 1;", "          this.shameCount += 0;"),
  ("the shame mirror stops counting down",
   "          this.shameCount -= 2;", "          this.shameCount -= 0;"),
  ("the mirror is not clamped, so it runs away",
   "        this.shameCount = clamp(this.shameCount, 0, 7);", ""),
  ("the hat-45 lock latch never fires",
   "      if (this.hatID === 45 && !this.shameActive) {", "      if (false) {"),
  ("the lock never lifts after 30 seconds",
   "      if (this.shameTimer >= 3e4 && this.shameActive) {", "      if (false) {"),
  ("the heal rule stops checking the shame count",
   "      if (!(((healing && myPlayer.shameCount < 7) || myPlayer.tickCount - myPlayer.damageTick > 0)",
   "      if (!(((healing) || myPlayer.tickCount - myPlayer.damageTick > 0)"),
]

# Every verifier that reads the client, not just the checker. A mutation counts
# as caught if ANY of them goes red — which is the honest question, since they
# divide the client between them: the checker owns wiring, anti-audit owns the
# damage terms, shame-model owns the counter and its guards.
VERIFIERS = [
    ("check",  ["node", "harness/ryn-changes-check.js"]),
    ("anti",   ["node", "harness/anti-audit.js"]),
    ("shame",  ["node", "harness/shame-model.js"]),
]

print("mutation tests — break it on purpose, confirm a verifier goes red\n")
print("  each mutation is run past all three: %s\n" % ", ".join(n for n, _ in VERIFIERS))
missed = 0
for label, old, new in MUTATIONS:
    n = base.count(old)
    if n != 1:
        print("  %-44s SKIPPED — anchor matched %d times" % (label, n)); missed += 1; continue
    open(MUT, "w", encoding="utf-8").write(base.replace(old, new))
    caught_by, detail = [], ""
    for name, cmd in VERIFIERS:
        r = subprocess.run(cmd + [MUT], capture_output=True, text=True)
        # A verifier that CRASHES on the mutant has still noticed it: an anchor
        # it needs is gone. That is a red result, not a skip.
        fails = [l for l in (r.stdout + r.stderr).splitlines() if l.strip().startswith("FAIL")]
        if fails or r.returncode != 0:
            caught_by.append(name)
            if not detail:
                detail = fails[0].strip()[4:].strip() if fails else "non-zero exit"
    if caught_by:
        print("  %-44s caught by %-18s %s" % (label, "+".join(caught_by), detail[:44]))
    else:
        print("  %-44s MISSED — every verifier stayed green" % label); missed += 1
print("\n  %d of %d mutations caught" % (len(MUTATIONS) - missed, len(MUTATIONS)))
sys.exit(1 if missed else 0)
