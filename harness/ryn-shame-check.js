/* RYN's shame counter, held against the server's own rule.
 *
 *   node ryn-shame-check.js [ryn.js]
 *
 * The rule is in the shared player code the 2025 bundle carries (buildItem's
 * consume branch), the same as 2024's:
 *
 *   if (consume && hitTime) { B = now - hitTime; hitTime = 0;
 *     B <= 120 ? (++shameCount >= 8 && (shameTimer = 3e4, shameCount = 0))
 *              : (shameCount = max(0, shameCount - 2)) }
 *
 * RYN cannot see a consume; it sees health go up. It used to count every
 * gain after a hit as an apple and never reset at 8, so on 2025 — lifesteal,
 * heal over time, healing pads — players showed shame 20 and no clown, and
 * Auto Heal, which stops healing early at 7, held back for nothing.
 *
 * This lifts Player.updateHealth and Player._foodHeal out of the client and
 * plays health sequences into them on a clock it controls.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const RYN = process.argv[2] || path.join(ROOT, "ryn/Ryn_Type_2.user.js");
const src = fs.readFileSync(RYN, "utf8");

let bad = 0;
const say = (ok, line) => { if (!ok) bad++; console.log("  " + (ok ? "ok  " : "FAIL") + "  " + line); };

function method(marker) {
  const start = src.indexOf(marker);
  if (start < 0) return null;
  let d = 0;
  for (let k = src.indexOf("{", start); k < src.length; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}") { d--; if (!d) return src.slice(start, k + 1).trim(); }
  }
  return null;
}
const updateSrc = method("    updateHealth(health) {\n      this.previousHealth = this.currentHealth;");
const foodSrc = method("    _foodHeal(previous, current) {");
console.log(path.basename(RYN) + " — the shame counter against the server's rule\n");
if (!updateSrc) { console.log("  FAIL  Player.updateHealth not found"); process.exit(1); }

let now = 0;
const clock = { now: () => now };
const Settings = { _autoheal: false };
const make = new Function("Settings_default", "Date",
  "return { updateHealth: function " + updateSrc + (foodSrc ? ", _foodHeal: function " + foodSrc : "") + " };");
const methods = make(Settings, clock);

function player() {
  const p = {
    id: 2, currentHealth: 100, previousHealth: 100, tempHealth: 100, maxHealth: 100,
    receivedDamage: null, shameCount: 0, shameActive: false, shameTimer: 0, shameObserved: 0,
    damageTick: 0, tickCount: 0, tickDamage: 0, stackedDamage: 0, damages: [], bullTick: 0, isDmgOverTime: false,
    client: { myPlayer: { id: 1, isEnemyByID: () => true }, PlayerManager: { lastEnemyReceivedDamage: [0, 0] } },
  };
  Object.assign(p, methods);
  // a model without _foodHeal (before the fix) gets none, and counts everything
  return p;
}
// A hit, then `gain` back after `after` ms; health starts wherever it is.
function hitThen(p, dmg, gain, after) {
  now += 1000;
  p.updateHealth(p.currentHealth - dmg);
  now += after;
  p.updateHealth(Math.min(100, p.currentHealth + gain));
}

{
  const p = player();
  const seen = [];
  for (let i = 0; i < 8; i++) { hitThen(p, 25, 20, 40); seen.push(p.shameCount); }
  say(p.shameActive && p.shameCount === 8 && seen.slice(0, 7).join() === "1,2,3,4,5,6,7",
      "eight apples each inside 120 ms of a hit: 1, 2 … 7, then the clown at 8 (" + seen.join(", ") + (p.shameActive ? ", shamed" : ", not shamed") + ")");
  hitThen(p, 25, 20, 40);
  say(p.shameCount <= 8, "and the count never passes 8 (" + p.shameCount + " after a ninth)");
}
{
  const p = player();
  for (let i = 0; i < 20; i++) hitThen(p, 25, 5, 40);
  say(p.shameCount === 0, "twenty regen ticks (+5) inside 120 ms of a hit leave the count alone (" + p.shameCount + ")");
}
{
  const p = player();
  for (let i = 0; i < 20; i++) hitThen(p, 30, 7, 30);
  say(p.shameCount === 0, "twenty lifesteal gains (+7, the 2025 emerald) after a hit leave it alone too (" + p.shameCount + ")");
}
{
  const p = player();
  for (let i = 0; i < 5; i++) hitThen(p, 25, 10, 60);
  say(p.shameCount === 0, "cheese's heal over time (+10 a second) is not an apple either (" + p.shameCount + ")");
}
{
  const p = player();
  for (let i = 0; i < 5; i++) hitThen(p, 45, 40, 50);
  hitThen(p, 25, 30, 50);
  say(p.shameCount === 6, "cookies (+40) and cheese (+30) inside 120 ms count, like apples (" + p.shameCount + ")");
  hitThen(p, 25, 20, 300);
  say(p.shameCount === 4, "an apple 300 ms after the hit takes two off (" + p.shameCount + ")");
}
{
  const p = player();
  hitThen(p, 5, 20, 40);   // 95 -> 100: the apple capped at the top
  say(p.shameCount === 1, "an apple that tops you up (+5 to 100) still counts (" + p.shameCount + ")");
}

console.log("\n  " + (bad ? bad + " check(s) failed" : "all checks hold"));
process.exit(bad ? 1 : 0);
