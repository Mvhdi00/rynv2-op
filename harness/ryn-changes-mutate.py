import subprocess, sys, shutil, os
SRC = "ryn/RYN_Client_v5.4.user.js"
MUT = "/tmp/claude-0/-home-user-rynv2-op/84985967-839c-5cb9-84f9-ceebbe0cce70/scratchpad/mut.js"
base = open(SRC, encoding="utf-8").read()

MUTATIONS = [
  ("heal presses once, not once per restore",
   "for (let i = 0; i < maxHealth - tempHealth; i += restore) {",
   "for (let i = 0; i < 1; i += restore) {"),
  ("_report never called on success",
   'this._report("placed");', ""),
  ("velocityTick dropped from the run order",
   "this.staticModules.velocityTick, ", ""),
  ("_velocityTick setting removed",
   "    _velocityTick: false,\n", ""),
  ("Devtool span id renamed",
   '_spikeTickOutcome\\" class', '_spikeTickWrong\\" class'),
  ("a deleted helper is called again",
   "      ModuleHandler.healedOnce = true;\n      for (let i = 0;",
   "      this._healsInFlight(ModuleHandler);\n      ModuleHandler.healedOnce = true;\n      for (let i = 0;"),
  ("AntiSpikePush reads pushingOnSpike again",
   "      // (nearestTrap && spikeDmgCount < 1)",
   "      if (!EnemyManager2.pushingOnSpike) return;\n      // (nearestTrap && spikeDmgCount < 1)"),
  ("heal() regains its packet budget",
   "    heal() {\n      this.selectItem(2);",
   "    heal() {\n      if (this._healBudgetLeft() < 3) return;\n      this.selectItem(2);"),
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
  ("updateSpikeTick queries the wrong element",
   'querySelector("#_spikeTickOutcome")', 'querySelector("#nope")'),
  ("VelocityTick class deleted but still registered",
   "  class VelocityTick {", "  class VelocityTickX {"),
]

print("mutation tests — break it on purpose, confirm the checker goes red\n")
missed = 0
for label, old, new in MUTATIONS:
    n = base.count(old)
    if n != 1:
        print("  %-44s SKIPPED — anchor matched %d times" % (label, n)); missed += 1; continue
    open(MUT, "w", encoding="utf-8").write(base.replace(old, new))
    r = subprocess.run(["node", "harness/ryn-changes-check.js", MUT],
                       capture_output=True, text=True)
    fails = [l for l in r.stdout.splitlines() if l.strip().startswith("FAIL")]
    if fails:
        first = fails[0].strip()[4:].strip()
        print("  %-44s caught (%d)  %s" % (label, len(fails), first[:56]))
    else:
        print("  %-44s MISSED — checker stayed green" % label); missed += 1
print("\n  %d of %d mutations caught" % (len(MUTATIONS) - missed, len(MUTATIONS)))
sys.exit(1 if missed else 0)
