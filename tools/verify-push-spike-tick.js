#!/usr/bin/env node
/*
 * verify-push-spike-tick.js
 *
 * Checks the handoff between Auto Push, Spike KB and Velocity Tick:
 *
 *   shove in progress  -> Spike KB holds, so its knockback does not throw the
 *                         target off the line Auto Push is walking them down
 *   shove lands        -> Velocity Tick takes the tick on the contact, and
 *                         Auto Push stands down because the push is over
 *
 * The three classes are pulled out of the client verbatim and driven against a
 * stub world, so this tests the shipped bodies rather than a paraphrase.
 *
 *   node tools/verify-push-spike-tick.js [path/to/client.js]
 */

const fs = require("fs");
const nodePath = require("path");

const ROOT = nodePath.resolve(__dirname, "..");
const file = process.argv[2] ? nodePath.resolve(process.argv[2]) : nodePath.join(ROOT, "Ryn_Type_2.user.js");
const lines = fs.readFileSync(file, "utf8").split("\n");

const find = re => {
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return i + 1;
  throw new Error("not found: " + re);
};
const endOf = start => {
  for (let i = start; i < lines.length; i++) if (lines[i] === "  }") return i + 1;
  throw new Error("no end for " + start);
};
const classSrc = name => {
  const at = find(new RegExp("^  class " + name + " \\{"));
  return lines.slice(at - 1, endOf(at)).join("\n");
};

// ── stub world ─────────────────────────────────────────────────────────────
const Settings_default = { _autoPush: true, _autoPushRange: 250, _spikeKB: true, _velocityTick: true, _spikeSync2: true };
const getAngleDist = (a, b) => { const d = Math.abs(a - b) % (Math.PI * 2); return d > Math.PI ? Math.PI * 2 - d : d; };
const inRange = (v, lo, hi) => v >= lo && v <= hi;
const DataHandler_default = {
  getWeapon: () => ({ range: 100, type: 0, damage: 30 }),
  isMelee: () => true,
};
const pt = (x, y) => ({
  x, y,
  angle: o => Math.atan2(o.y - y, o.x - x),
  distance: o => Math.hypot(o.x - x, o.y - y),
  addDirection: (a, d) => pt(x + Math.cos(a) * d, y + Math.sin(a) * d),
});

const [AutoPush, SpikeKB, VelocityTick] = new Function(
  "Settings_default", "getAngleDist", "inRange", "DataHandler_default",
  [classSrc("AutoPush"), classSrc("SpikeKB"), classSrc("VelocityTick")].join("\n\n") +
  "\nreturn [AutoPush, SpikeKB, VelocityTick];"
)(Settings_default, getAngleDist, inRange, DataHandler_default);

if (typeof AutoPush.prototype.pushState !== "function") {
  console.log("FAIL  AutoPush.pushState is missing - this client predates the push handoff.");
  process.exit(1);
}

// `touching` drives both collision predicates the handoff turns on.
const mkWorld = ({ pushEnemy = true, touching = false, enemyInSpike = null } = {}) => {
  const enemy = {
    id: 9, collisionScale: 35, hitScale: 63, trappedIn: { collisionScale: 50, pos: { current: pt(100, 0) } },
    pos: { current: pt(100, 0), future: pt(100, 0) }, weapon: { current: 0 }, futureHat: 0,
    atExact: () => false, colliding: () => touching,
  };
  const spike = { id: 3, collisionScale: 50, pos: { current: pt(140, 0) } };
  const myPlayer = {
    id: 1, trappedIn: null, collisionScale: 35, pos: { current: pt(0, 0) },
    collidingSimple: () => true, getItemByType: () => 5, getWeaponVariant: () => ({ current: 2 }),
  };
  const ModuleHandler = {
    moduleActive: false, moveTo: "disable", useAngle: null, forceHat: null,
    forceWeapon: null, shouldAttack: false,
    hasStoreItem: () => true,
    staticModules: { reloading: { isReloaded: () => true } },
  };
  const client = {
    myPlayer, _ModuleHandler: ModuleHandler,
    EnemyManager: {
      nearestEnemyPush: pushEnemy ? enemy : null,
      nearestPushSpike: pushEnemy ? spike : null,
      nearestEnemy: enemy,
      nearestEnemySpikeCollider: enemyInSpike, spikeCollider: enemyInSpike ? spike : null,
      enemySpikeCollider: enemyInSpike,
      shouldIgnoreModule: () => false,
    },
    ObjectManager: { grid2D: { queryFull: () => [] }, objects: new Map() },
    PlayerManager: { canMoveOnTop: () => true },
    StatsManager: { set velocityTickTimes(_v) {} },
  };
  const autoPush = new AutoPush(client);
  ModuleHandler.staticModules.autoPush = autoPush;
  return { client, ModuleHandler, enemy, spike, autoPush,
    spikeKB: new SpikeKB(client), velocityTick: new VelocityTick(client) };
};

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `   got=${got} want=${want}`}`);
};

// ── pushState, the contract the other two read ─────────────────────────────
{
  const w = mkWorld({ touching: false });
  const s = w.autoPush.pushState();
  t("pushState sees a shove in progress", s !== null && s.contact === false, true);
}
{
  const w = mkWorld({ touching: true });
  const s = w.autoPush.pushState();
  t("pushState reports contact once they meet the spike", s !== null && s.contact === true, true);
}
{
  Settings_default._autoPush = false;
  const w = mkWorld({ touching: false });
  t("pushState is null with Auto Push off", w.autoPush.pushState(), null);
  Settings_default._autoPush = true;
}
{
  const w = mkWorld({ pushEnemy: false });
  t("pushState is null with no push candidate", w.autoPush.pushState(), null);
}

// ── Spike KB holds for the shove ───────────────────────────────────────────
{
  const w = mkWorld({ touching: false, enemyInSpike: null });
  w.enemy.colliding = () => false;
  w.client.EnemyManager.enemySpikeCollider = w.enemy;   // a target it would take
  w.spikeKB.postTick();
  t("Spike KB holds while the shove is in progress", w.ModuleHandler.shouldAttack, false);
}
{
  const w = mkWorld({ touching: true });
  w.client.EnemyManager.enemySpikeCollider = w.enemy;
  w.spikeKB.postTick();
  t("Spike KB resumes on the tick the shove lands", w.ModuleHandler.shouldAttack, true);
}
{
  Settings_default._autoPush = false;
  const w = mkWorld({ touching: false });
  w.client.EnemyManager.enemySpikeCollider = w.enemy;
  w.spikeKB.postTick();
  t("Spike KB is untouched with Auto Push off", w.ModuleHandler.shouldAttack, true);
  Settings_default._autoPush = true;
}

// ── Velocity Tick takes the contact ────────────────────────────────────────
{
  const w = mkWorld({ touching: true });
  w.velocityTick.postTick();
  t("Velocity Tick fires on contact", w.ModuleHandler.moduleActive, true);
  t("...wearing turret for the first tick", w.ModuleHandler.forceHat, 53);
  t("...and arms the swing for the next one", w.velocityTick.nearestTarget, w.enemy);
}
{
  const w = mkWorld({ touching: false });
  w.velocityTick.postTick();
  t("Velocity Tick does not fire mid-shove", w.ModuleHandler.moduleActive, false);
}
{
  // The far distance band is what the normal path needs; the contact path must
  // not be gated on it, since the shove has just closed that distance.
  const w = mkWorld({ touching: true });
  w.enemy.pos.current = pt(90, 0);
  w.enemy.pos.future = pt(90, 0);
  w.velocityTick.postTick();
  t("contact path ignores the far knockback band", w.ModuleHandler.moduleActive, true);
}

// ── Spike KB yields to Velocity Tick on that same tick ─────────────────────
{
  const w = mkWorld({ touching: true });
  w.client.EnemyManager.enemySpikeCollider = w.enemy;
  w.velocityTick.postTick();          // runs first in ModuleHandler.modules
  w.ModuleHandler.shouldAttack = false;
  w.spikeKB.postTick();
  t("Spike KB yields the contact tick to Velocity Tick", w.ModuleHandler.shouldAttack, false);
}

// ── Spike Sync 2 does not answer to the Velocity Tick switch ───────────────
{
  Settings_default._velocityTick = false;
  const w = mkWorld({ touching: true });
  w.velocityTick.postTick();
  t("contact burst fires with Velocity Tick off", w.ModuleHandler.moduleActive, true);
  t("...still in turret for the first tick", w.ModuleHandler.forceHat, 53);
  // A burst is two ticks. A first half that cannot reach its second is a hat
  // swap that does nothing, so the follow-up has to survive the same switch.
  w.ModuleHandler.moduleActive = false;
  w.ModuleHandler.moveTo = "disable";
  w.velocityTick.postTick();
  t("...and the swing still lands on the next tick", w.ModuleHandler.shouldAttack, true);
  t("...wearing bull for it", w.ModuleHandler.forceHat, 7);
  t("...with the burst then cleared", w.velocityTick.nearestTarget, null);
}
{
  // Velocity Tick's own band stays off when its switch is off.
  Settings_default._velocityTick = false;
  const w = mkWorld({ touching: false });
  w.client.EnemyManager.nearestEnemyPush = null;
  w.client.EnemyManager.nearestPushSpike = null;
  w.enemy.pos.future = pt(230, 0);
  w.velocityTick.postTick();
  t("Velocity Tick's own band stays off with its switch off", w.ModuleHandler.moduleActive, false);
}
{
  // Both off means the module does nothing at all.
  Settings_default._velocityTick = false;
  Settings_default._spikeSync2 = false;
  const w = mkWorld({ touching: true });
  w.velocityTick.postTick();
  t("both switches off leaves the module silent", w.ModuleHandler.moduleActive, false);
  Settings_default._velocityTick = true;
  Settings_default._spikeSync2 = true;
}

// ── the Spike Sync 2 switch turns the whole interaction off ────────────────
{
  Settings_default._spikeSync2 = false;
  const w = mkWorld({ touching: false });
  w.client.EnemyManager.enemySpikeCollider = w.enemy;
  w.spikeKB.postTick();
  t("Spike KB is untouched with Spike Sync 2 off", w.ModuleHandler.shouldAttack, true);
}
{
  const w = mkWorld({ touching: true });
  w.velocityTick.postTick();
  t("Velocity Tick does not take the contact with Spike Sync 2 off", w.ModuleHandler.moduleActive, false);
}
{
  const w = mkWorld({ touching: false });
  w.autoPush.postTick();
  t("Auto Push still shoves with Spike Sync 2 off", w.autoPush.pushPos !== null, true);
  Settings_default._spikeSync2 = true;
}

// ── the switch is wired end to end ─────────────────────────────────────────
{
  const whole = lines.join("\n");
  t("_spikeSync2 has a default", /_spikeSync2:\s*(true|false),/.test(whole), true);
  t("_spikeSync2 has a menu toggle", whole.includes('id=\\"_spikeSync2\\" type=\\"checkbox\\"'), true);
  t("...labelled Spike Sync 2", whole.includes(">Spike Sync 2</label>"), true);
  // attachCheckboxes binds by id and logs an error for any checkbox with no
  // matching setting, so the two above have to agree for the toggle to work.
  t("...and both halves read by the same key",
    /for=\\"_spikeSync2\\"/.test(whole) && /Settings_default\._spikeSync2/.test(whole), true);
}

// ── Auto Push itself is unchanged in its two exits ─────────────────────────
{
  const w = mkWorld({ touching: true });
  w.autoPush.postTick();
  t("Auto Push stands down once the shove has landed", w.autoPush.pushPos, null);
}
{
  const w = mkWorld({ pushEnemy: false });
  w.autoPush.postTick();
  t("Auto Push stands down with no candidate", w.autoPush.pushPos, null);
}
{
  const w = mkWorld({ touching: false });
  w.autoPush.postTick();
  t("Auto Push still engages a live shove", w.autoPush.pushPos !== null, true);
  t("...and still steers toward it", typeof w.ModuleHandler.moveTo, "number");
}

console.log("");
if (fail) {
  console.log(`${fail} check(s) failed - the push handoff is not wired as intended.`);
  process.exit(1);
}
console.log(`OK - ${pass} checks passed.`);
