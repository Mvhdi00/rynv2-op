const { scenario, check, done, Settings, source, Vector } = require("./spike-tick-harness.js");

const plan = ctx => ctx.engine.plan();
const veto = ctx => { ctx.engine.plan(); return ctx.engine.lastVeto; };

// ── CASE 2 — enemy already standing on a spike ───────────────────────────
scenario("trapped/touching", ctx => {
  ctx.addSpike(10, 100, 60);       // 60 away, reach = (35+35)*1.05 = 73.5
  ctx.enemy.hold(2);
  const p = plan(ctx);
  check("CASE 2 touching spike → plan", p !== null, true);
  check("CASE 2 contact tick is 0", p && p.contact.tick, 0);
  check("CASE 2 no escape risk", p && p.risk, 0);
});

// ── CASE 1 — enemy walking straight into a spike ─────────────────────────
scenario("walk straight in", ctx => {
  ctx.addSpike(10, 100, 90);
  for (let i = 0; i < 3; i++) ctx.enemy.step(0, 5);   // steady walk toward it
  const p = plan(ctx);
  check("CASE 1 walk-in predicted", p !== null && p.contact.kind !== "touching", true);
  check("CASE 1 confidence high", p && p.contact.confidence > .9, true);
  check("CASE 1 horizon extended for stable walk", ctx.enemy.predictHorizon, 3);
});

// ── enemy strafing across the spike, never closing ───────────────────────
scenario("strafing past", ctx => {
  ctx.addSpike(10, 100, 300);
  for (let i = 0; i < 3; i++) ctx.enemy.step(5, 0);
  check("strafe far from spike → no contact", veto(ctx), "no-contact");
});

// ── direction change collapses confidence and shortens the window ────────
scenario("hard direction change", ctx => {
  ctx.enemy.step(0, 8);
  ctx.enemy.step(0, 8);
  check("stable heading → confident", ctx.enemy.predictConfidence > .9, true);
  ctx.enemy.step(-8, 0);                                // 90° cut
  check("hard cut → confidence collapses", ctx.enemy.predictConfidence < .2, true);
  check("hard cut → horizon back to 1", ctx.enemy.predictHorizon, 1);
});

scenario("fast mover gets short window", ctx => {
  for (let i = 0; i < 3; i++) ctx.enemy.step(0, 9);
  check("fast + stable → horizon 1", ctx.enemy.predictHorizon, 1);
  check("fast + stable → still confident", ctx.enemy.predictConfidence > .9, true);
});

// ── CASE 5 — enemy running away from the spike ───────────────────────────
scenario("running away", ctx => {
  const s = ctx.addSpike(10, 100, 74);   // just outside reach
  ctx.enemy.step(0, -6);
  ctx.enemy.step(0, -6);                 // opening the range every tick
  const p = plan(ctx);
  check("CASE 5 leaving → no plan", p, null);
  check("CASE 5 veto reason", ctx.engine.lastVeto, "no-contact");
});

// ── CASE 3 — knockback forces contact ────────────────────────────────────
scenario("knockback into spike", ctx => {
  // spike sits directly behind the enemy on my->enemy line, out of walk reach
  ctx.addSpike(10, 200, 0);
  ctx.enemy.hold(2);
  ctx.client.myPlayer.kb = 111;
  const p = plan(ctx);
  check("CASE 3 knockback contact found", p !== null && p.contact.kind, "knockback");
  check("CASE 3 lands next tick", p && p.contact.tick, 1);
});

// ── CASE 4 — pinned between several spikes ───────────────────────────────
scenario("multi-spike", ctx => {
  ctx.addSpike(10, 100, 60, 25);
  ctx.addSpike(11, 100, -60, 25);
  ctx.addSpike(12, 160, 0, 25);
  ctx.enemy.hold(2);
  const p = plan(ctx);
  check("CASE 4 all three colliders counted", p && p.colliders, 3);
  check("CASE 4 scores above a lone spike", p && p.score > 25 + 40, true);
});

scenario("multi-spike picks the hardest hitter", ctx => {
  ctx.addSpike(10, 100, 60, 25);
  ctx.addSpike(11, 100, -60, 45);   // greater spikes
  ctx.enemy.hold(2);
  const p = plan(ctx);
  check("best damage wins the plan", p && p.object.id, 11);
});

// ── enemy already dead / gone ────────────────────────────────────────────
scenario("dead enemy", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  ctx.enemy.currentHealth = 0;
  const p = plan(ctx);
  check("dead enemy plan built but revalidate rejects", p !== null && ctx.engine.revalidate(p), false);
});

// ── CASE 6 — primary not back in time ────────────────────────────────────
scenario("primary on cooldown", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  ctx.client._ModuleHandler.staticModules.reloading.slots[0] = 0;
  check("CASE 6 not reloaded → reload veto", veto(ctx), "reload");
});

// ── low packet budget ────────────────────────────────────────────────────
scenario("packet starved", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  ctx.client._ModuleHandler.packetCount = 60;   // 60 + 4 + 5 + 12 > 70
  check("packet budget veto", veto(ctx), "packets");
});
scenario("packet budget just fits", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  ctx.client._ModuleHandler.packetCount = 49;   // 49 + 4 + 5 + 12 = 70
  check("plan survives at the limit", plan(ctx) !== null, true);
});

// ── arbitration ──────────────────────────────────────────────────────────
scenario("break beats near", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  ctx.client.ObjectManager.deletedObjects.add({ pos: { current: new Vector(90, 30) } });
  const p = plan(ctx);
  check("break opportunity claims the tick", p && p.kind, "break");
  check("near cannot also claim it", ctx.engine.claim("near"), null);
  check("break claims once", ctx.engine.claim("break") !== null, true);
  check("second claim is refused", ctx.engine.claim("break"), null);
});

scenario("break toggle off falls through to near", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  ctx.client.ObjectManager.deletedObjects.add({ pos: { current: new Vector(90, 30) } });
  Settings._spikeTickBreak = false;
  const p = plan(ctx);
  Settings._spikeTickBreak = true;
  check("break off → near takes the tick instead of losing it", p && p.kind, "near");
});

scenario("all three shapes off", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  Settings._spikeTickBreak = Settings._spikeTickNear = Settings._spikeTickTrap = false;
  const v = veto(ctx);
  Settings._spikeTickBreak = Settings._spikeTickNear = Settings._spikeTickTrap = true;
  check("nothing enabled → no-kind", v, "no-kind");
});

scenario("master toggle off", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  Settings._spikeTick = false;
  const v = veto(ctx);
  Settings._spikeTick = true;
  check("master off → off", v, "off");
});

// ── enemy trapped by me, hammer takes the trap down ──────────────────────
scenario("trap tick", ctx => {
  const trap = { id: 50, pos: { current: new Vector(100, 0) }, health: 200, scale: 45, collisionScale: 45, getDamage: () => 0 };
  ctx.addSpike(10, 200, 0);            // spike behind them, on the kb line
  ctx.enemy.isTrapped = true;
  ctx.enemy.trappedIn = trap;
  ctx.enemy.reload[1] = { current: 1, max: 2 };   // one tick from reloaded
  ctx.client.EnemyManager.nearestTrappedEnemy = ctx.enemy;
  ctx.client.myPlayer.kb = 111;
  ctx.enemy.hold(2);
  const p = plan(ctx);
  check("trapped enemy + breakable trap + spike → trap tick", p && p.kind, "trap");
  check("trap tick knows which trap", p && p.trap === trap, true);
});

scenario("trapped enemy with no spike anywhere", ctx => {
  const trap = { id: 50, pos: { current: new Vector(100, 0) }, health: 200 };
  ctx.enemy.isTrapped = true;
  ctx.enemy.trappedIn = trap;
  ctx.enemy.reload[1] = { current: 1, max: 2 };
  ctx.client.EnemyManager.nearestTrappedEnemy = ctx.enemy;
  ctx.enemy.hold(2);
  check("no damaging object → nothing to tick", veto(ctx), "no-contact");
});

// ── gates that must keep the tick shut ───────────────────────────────────
scenario("module already active", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  ctx.client._ModuleHandler.moduleActive = true;
  check("busy veto", veto(ctx), "busy");
});
scenario("danger read says stand down", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  ctx.client.EnemyManager._ignore = true;
  check("shouldIgnoreModule veto", veto(ctx), "busy");
});
scenario("counter threat", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  ctx.client.EnemyManager.possibleToKnockback = true;
  check("their swing knocks me into a spike → stand down", veto(ctx), "counter");
});
scenario("i am trapped", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  ctx.client.myPlayer.isTrapped = true;
  check("trapped → no target", veto(ctx), "no-target");
});
scenario("just left a trap", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  ctx.client.myPlayer.isTrapped = true;
  ctx.engine.plan();                                   // stamps the trap tick
  ctx.client.myPlayer.isTrapped = false;
  ctx.client._ModuleHandler.tickCount += 2;            // inside the 3-tick grace
  check("trap grace holds the tick", veto(ctx), "trap-grace");
  ctx.client._ModuleHandler.tickCount += 3;            // outside it
  check("grace expires", plan(ctx) !== null, true);
});
scenario("enemy spikes are not my spikes", ctx => {
  const s = ctx.addSpike(10, 100, 60);
  s.ownerID = 2;                                       // the enemy's own spike
  ctx.enemy.hold(2);
  check("their own spike does not hurt them", veto(ctx), "no-contact");
});
scenario("out of primary range", ctx => {
  ctx.enemy.pos.previous._setXY(600, 0);
  ctx.enemy.pos.current._setXY(600, 0);
  ctx.addSpike(10, 600, 60);
  ctx.enemy.hold(2);
  check("too far → range veto", veto(ctx), "range");
});

// ── execution + revalidation ─────────────────────────────────────────────
scenario("execute sets combat state", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  const p = ctx.engine.claim("near");
  check("near claims a plain touching tick", p !== null, true);
  ctx.engine.execute(p.enemy);
  const MH = ctx.client._ModuleHandler;
  check("bull hat forced", MH.forceHat, 7);
  check("primary forced", MH.forceWeapon, 0);
  check("attack requested", MH.shouldAttack, true);
  check("module claimed", MH.moduleActive, true);
  check("placement went through the existing angles", MH.placedOnce, true);
  check("one place per angle", MH.totalPlaces, 1);
});
scenario("revalidate catches a moved enemy", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  const p = plan(ctx);
  check("valid at plan time", ctx.engine.revalidate(p), true);
  ctx.enemy.step(40, 40);
  check("moved enemy → invalid", ctx.engine.revalidate(p), false);
});
scenario("revalidate catches a destroyed spike", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  const p = plan(ctx);
  ctx.client.ObjectManager.objects.delete(10);
  check("spike gone → invalid", ctx.engine.revalidate(p), false);
});
scenario("revalidate catches a stale tick", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  const p = plan(ctx);
  ctx.client._ModuleHandler.tickCount += 1;
  check("plan from last tick → invalid", ctx.engine.revalidate(p), false);
});
scenario("plan is memoised within a tick", ctx => {
  ctx.addSpike(10, 100, 60);
  ctx.enemy.hold(2);
  check("same object twice", ctx.engine.plan() === ctx.engine.plan(), true);
});

// ── enemy leaving a trap ─────────────────────────────────────────────────
scenario("enemy leaves the trap", ctx => {
  const trap = { id: 50, pos: { current: new Vector(100, 0) }, health: 200 };
  ctx.addSpike(10, 200, 0);
  ctx.enemy.isTrapped = true;
  ctx.enemy.trappedIn = trap;
  ctx.enemy.reload[1] = { current: 1, max: 2 };
  ctx.client.EnemyManager.nearestTrappedEnemy = ctx.enemy;
  ctx.client.myPlayer.kb = 111;
  ctx.enemy.hold(2);
  check("trapped → trap tick", plan(ctx).kind, "trap");
  // they get out; the trap variant must stop claiming and the near tick takes
  // over on the same board.
  ctx.enemy.isTrapped = false;
  ctx.enemy.trappedIn = null;
  ctx.client.EnemyManager.nearestTrappedEnemy = null;
  ctx.client._ModuleHandler.tickCount += 1;
  const p = plan(ctx);
  check("out of the trap → near tick, same spike", p && p.kind, "near");
  check("still the knockback contact", p && p.contact.kind, "knockback");
});

// ── the placer arbitration contract must not have drifted ────────────────
scenario("placer arbitration contract", ctx => {
  for (const name of [ "spikeTickBreak", "spikeTickNear", "spikeTickTrap" ]) {
    check(`module name ${name} still declared`, source.includes(`moduleName="${name}"`), true);
  }
  check("no second angle solver", /getBestPlacementAngles|getPrePlaceAngles/.test(source), false);
  check("placement goes through EnemyManager", source.includes("attemptSpikePlacement()"), true);
  check("no direct socket use", /PacketManager\s*\.\s*send|SocketManager/.test(source), false);
});

done();
