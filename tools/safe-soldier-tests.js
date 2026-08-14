const { scenario, check, done, Settings, source, Vector } = require("./safe-soldier-harness.js");

const plan = ctx => ctx.module.plan();
const veto = ctx => { ctx.module.plan(); return ctx.module.lastVeto; };
const kind = ctx => { const p = plan(ctx); return p === null ? null : p.kind; };
const setIntent = (ctx, a) => { ctx.client._ModuleHandler.move_dir = a; };

// ── nothing to react to ──────────────────────────────────────────────────
scenario("clear board, walking freely", ctx => {
  setIntent(ctx, 0);
  check("nothing on the board → no decision", veto(ctx), "clear");
});

scenario("standing still with hazards but no pressure", ctx => {
  ctx.add(10, 0, 200);                 // far off to the side
  check("no intent, nothing pressing → hold position", veto(ctx), "standing");
});

// ── 1/3. enemy approaching and chasing ───────────────────────────────────
scenario("safe heading is kept untouched", ctx => {
  ctx.add(10, -150, 0);                // hazard behind me
  setIntent(ctx, 0);                   // walking away from it
  const p = plan(ctx);
  check("keep", p && p.kind, "keep");
  check("heading unchanged", p && p.angle, 0);
  ctx.module.postTick();
  check("no steering packet", ctx.steerCalls.length, 0);
  check("moveTo untouched", ctx.client._ModuleHandler.moveTo, "disable");
});

// ── 5. spike directly ahead ──────────────────────────────────────────────
scenario("spike directly ahead", ctx => {
  ctx.add(10, 75, 0);                  // right where I am walking
  setIntent(ctx, 0);
  const p = plan(ctx);
  check("not kept", p && p.kind !== "keep", true);
  check("repositioned rather than stopped", p && p.kind, "reposition");
  check("heading actually changed", p && p.angle !== 0, true);
});

scenario("the old behaviour was to stop; now it steers", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  ctx.module.postTick();
  check("a heading was written", ctx.client._ModuleHandler.moveTo !== "disable", true);
  check("and it is not a stop", ctx.client._ModuleHandler.moveTo !== null, true);
});

// ── 6. trap behind ───────────────────────────────────────────────────────
scenario("trap behind is not an escape route", ctx => {
  ctx.add(10, 75, 0);                                    // spike ahead
  ctx.add(11, -80, 0, { type: 15, scale: 45, damage: 0 }); // trap behind
  setIntent(ctx, 0);
  const p = plan(ctx);
  check("a heading was found", p !== null, true);
  if (p && p.angle !== null) {
    const landing = new Vector(Math.cos(p.angle) * 40, Math.sin(p.angle) * 40);
    check("does not walk into the trap", landing.distance(new Vector(-80, 0)) > 80, true);
    check("does not walk into the spike", landing.distance(new Vector(75, 0)) > 70, true);
  } else {
    check("does not walk into the trap", true, true);
    check("does not walk into the spike", true, true);
  }
});

// ── 7/8. multiple spikes, surrounded ─────────────────────────────────────
scenario("multiple spikes still leave a lane", ctx => {
  ctx.add(10, 75, 0);
  ctx.add(11, 53, 53);
  ctx.add(12, 0, 75);
  setIntent(ctx, 0);
  const p = plan(ctx);
  check("found the open side", p !== null && p.angle !== null, true);
  if (p && p.angle !== null) {
    const landing = new Vector(Math.cos(p.angle) * 40, Math.sin(p.angle) * 40);
    let clear = true;
    for (const h of [ [75, 0], [53, 53], [0, 75] ]) {
      if (landing.distance(new Vector(h[0], h[1])) <= 76) clear = false;
    }
    check("lands clear of all three", clear, true);
  } else {
    check("lands clear of all three", true, true);
  }
});

scenario("fully surrounded → hold", ctx => {
  // A ring tight enough that every landing point is inside something.
  for (let i = 0; i < 12; i++) {
    const a = i * (Math.PI * 2 / 12);
    ctx.add(20 + i, Math.cos(a) * 60, Math.sin(a) * 60);
  }
  setIntent(ctx, 0);
  const p = plan(ctx);
  check("no safe escape → hold", p && p.kind, "hold");
  check("hold means stop", p && p.angle, null);
  ctx.module.postTick();
  check("a stop was written", ctx.client._ModuleHandler.moveTo, null);
});

// ── 2. enemy attacking / pressure ────────────────────────────────────────
scenario("pressure turns reposition into escape", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  check("reposition while calm", kind(ctx), "reposition");
  ctx.client.EnemyManager.detectedDangerEnemy = true;
  ctx.tick();
  check("escape under pressure", kind(ctx), "escape");
});

scenario("escape ignores intent, reposition respects it", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  const bend = plan(ctx).angle;
  ctx.client.EnemyManager.detectedDangerEnemy = true;
  ctx.tick();
  const flee = plan(ctx).angle;
  // The bend is lerped halfway from intent; the escape is not.
  check("escape is further from intent than the bend", Math.abs(flee) >= Math.abs(bend), true);
});

// ── 4. enemy changing direction ──────────────────────────────────────────
scenario("enemy reach is read from the predicted position", ctx => {
  ctx.add(10, 0, 200);                       // hazard out of the way
  ctx.enemy.pos.previous._setXY(200, 0);
  ctx.enemy.pos.current._setXY(200, 0);
  for (let i = 0; i < 3; i++) ctx.enemy.step(-9, 0);   // charging me
  ctx.client.EnemyManager.detectedEnemy = true;
  setIntent(ctx, 0);                                   // straight at them
  const p = plan(ctx);
  check("a decision was made", p !== null, true);
  // Walking into someone's reach is a fight, not a hazard. The module reads it
  // (the reach penalty is applied) but does not veto it — combat direction
  // belongs to the player and to autopush, not to safe movement.
  check("combat direction is not overridden", p && p.kind, "keep");
});

// ── knockback awareness ──────────────────────────────────────────────────
scenario("a heading that lines me up to be knocked onto a spike is penalised", ctx => {
  const ctxNoSpike = null;
  ctx.enemy.pos.previous._setXY(-120, 0);
  ctx.enemy.pos.current._setXY(-120, 0);
  ctx.enemy.hold(2);
  ctx.add(10, 200, 0);                    // spike on the far side of me
  ctx.client.EnemyManager.detectedEnemy = true;
  setIntent(ctx, 0);                      // walking away from them, toward it
  const p = plan(ctx);
  check("a decision was made", p !== null, true);
  check("does not keep walking onto the knockback line", p && p.kind !== "keep", true);
});

// ── 13. spike tick active ────────────────────────────────────────────────
scenario("spike tick owns the tick → do not move", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  ctx.client._ModuleHandler.activeModule = "spikeTickNear";
  check("stand down", veto(ctx), "position-critical");
  ctx.module.postTick();
  check("nothing steered", ctx.steerCalls.length, 0);
});

scenario("anti smart tick owns the tick → do not move", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  ctx.client._ModuleHandler.activeModule = "antiSmartTick";
  check("stand down", veto(ctx), "position-critical");
});

scenario("autopush owns the tick → do not move", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  ctx.client._ModuleHandler.activeModule = "autoPush";
  check("stand down", veto(ctx), "position-critical");
});

// ── 10-12. placement active ──────────────────────────────────────────────
scenario("the placer owning the tick does not stop movement", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  ctx.client._ModuleHandler.activeModule = "autoPlacer";
  const p = plan(ctx);
  check("placement is not position-critical", p !== null, true);
  check("still repositions", p && p.kind, "reposition");
});

scenario("movement never touches placement state", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  ctx.module.postTick();
  const MH = ctx.client._ModuleHandler;
  check("no placement fields written", MH.placeAngles, undefined);
  check("no attack requested", MH.shouldAttack, undefined);
});

// ── knocked-onto-a-spike is not a movement problem ───────────────────────
scenario("unavoidable knockback is not steered around", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  ctx.client.EnemyManager.possibleToKnockback = true;
  check("their swing moves me, not my feet", veto(ctx), "unavoidable");
});

scenario("unavoidable but lethal still gets a decision", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  ctx.client.EnemyManager.possibleToKnockback = true;
  ctx.client.EnemyManager.dangerWithoutSoldier = true;
  check("lethal overrides the shortcut", plan(ctx) !== null, true);
});

// ── soldier escalation ───────────────────────────────────────────────────
scenario("lethal projection forces soldier", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  ctx.client.EnemyManager.dangerWithoutSoldier = true;
  ctx.module.postTick();
  check("soldier forced", ctx.client._ModuleHandler.forceHat, 6);
  check("flag raised", ctx.client._ModuleHandler.shouldEquipSoldier, true);
});

scenario("soldier is not forced when nothing is lethal", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  ctx.module.postTick();
  check("hat left alone", ctx.client._ModuleHandler.forceHat, null);
});

scenario("soldier does not override a hat another module forced", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  ctx.client.EnemyManager.dangerWithoutSoldier = true;
  ctx.client._ModuleHandler.forceHat = 7;     // bull, from a combat module
  ctx.module.postTick();
  check("existing choice kept", ctx.client._ModuleHandler.forceHat, 7);
});

// ── packet discipline ────────────────────────────────────────────────────
scenario("a heading that barely drifts sends nothing", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  ctx.module.postTick();
  const first = ctx.client._ModuleHandler.moveTo;
  ctx.tick();
  ctx.client._ModuleHandler.moveTo = "disable";
  ctx.module.postTick();
  check("same heading reused", ctx.client._ModuleHandler.moveTo, first);
});

scenario("keep costs nothing at all", ctx => {
  ctx.add(10, -150, 0);
  setIntent(ctx, 0);
  ctx.module.postTick();
  check("no steer call", ctx.steerCalls.length, 0);
});

// ── gates ────────────────────────────────────────────────────────────────
scenario("trapped → not a movement problem", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  ctx.client.myPlayer.isTrapped = true;
  check("anti smart tick owns this", veto(ctx), "trapped");
});

scenario("toggle off", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  Settings._safeSoldier = false;
  const v = veto(ctx);
  Settings._safeSoldier = true;
  check("off is off", v, "off");
});

// ── revalidation ─────────────────────────────────────────────────────────
scenario("a spike appearing on the chosen heading cancels it", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  const p = plan(ctx);
  check("valid at plan time", ctx.module.revalidate(p), true);
  ctx.add(11, Math.cos(p.angle) * 40, Math.sin(p.angle) * 40);
  ctx.module._boardTick = -1;             // the board moved
  check("newly blocked → cancel", ctx.module.revalidate(p), false);
});

scenario("a claim landing between plan and execution cancels it", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  const p = plan(ctx);
  ctx.client._ModuleHandler.activeModule = "spikeTickBreak";
  check("claimed → cancel", ctx.module.revalidate(p), false);
  ctx.module.postTick();
  check("nothing steered", ctx.steerCalls.length, 0);
});

scenario("getting trapped between plan and execution cancels it", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  const p = plan(ctx);
  ctx.client.myPlayer.isTrapped = true;
  check("trapped → cancel", ctx.module.revalidate(p), false);
});

scenario("a plan from last tick is stale", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  const p = plan(ctx);
  ctx.tick();
  check("stale → cancel", ctx.module.revalidate(p), false);
});

scenario("plan is memoised within a tick", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  check("same object twice", ctx.module.plan() === ctx.module.plan(), true);
});

scenario("the board is queried once a tick", ctx => {
  ctx.add(10, 75, 0);
  setIntent(ctx, 0);
  let queries = 0;
  const real = ctx.client.ObjectManager.grid2D.query;
  ctx.client.ObjectManager.grid2D.query = function (...args) { queries += 1; return real.apply(this, args); };
  ctx.module.plan();
  ctx.module.plan();
  ctx.module.board();
  check("one query for the whole tick", queries, 1);
});

// ── architecture contract ────────────────────────────────────────────────
scenario("architecture contract", ctx => {
  check("no second simulation", /class\s+\w*Simulation/.test(source), false);
  check("borrows the existing one", source.includes("myPlayer.simulation"), true);
  check("no second prediction engine", source.includes("predictPosition(1)"), true);
  check("no socket access", /SocketManager|new WebSocket|PacketManager/.test(source), false);
  check("no direct movement send", /startMovement|stopMovement|\bmove\(/.test(source), false);
  check("movement written through RynNetwork", source.includes("network.steer"), true);
  check("no scheduler", /setTimeout|setInterval/.test(source), false);
  check("danger read from EnemyManager", source.includes("EM.potentialDamage"), true);
  check("no placement writes", /placeAngles|attemptSpikePlacement|\.place\(/.test(source), false);
});

done();
