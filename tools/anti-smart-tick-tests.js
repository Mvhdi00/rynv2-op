const { scenario, check, done, Settings, source } = require("./anti-smart-tick-harness.js");

const plan = ctx => ctx.module.plan();
const veto = ctx => { ctx.module.plan(); return ctx.module.lastVeto; };
const kind = ctx => { const p = plan(ctx); return p === null ? null : p.kind; };

// ── the base situation is detected at all ────────────────────────────────
scenario("threat detected", ctx => {
  ctx.addSpike(10, -90, 0);              // their spike behind me
  ctx.enemy.hold(2);
  const p = plan(ctx);
  check("plan exists", p !== null, true);
  check("it names their spike", p && p.spike.id, 10);
  check("it found a pusher position", p && p.pusher !== null, true);
});

scenario("no enemy spike anywhere → nothing to be thrown onto", ctx => {
  ctx.enemy.hold(2);
  check("no geometry", veto(ctx), "no-geometry");
});

scenario("their own spike already on me needs no placement", ctx => {
  ctx.addSpike(10, 60, 0);               // touching me at (0,0): 60 < 73.5
  ctx.enemy.hold(2);
  const p = plan(ctx);
  check("plan exists", p !== null, true);
  check("no pusher needed", p && p.pusher, null);
});

scenario("my own spike is not a threat", ctx => {
  ctx.addSpike(10, -90, 0, { ownerID: 1 });   // mine
  ctx.enemy.hold(2);
  check("teammate spike ignored", veto(ctx), "no-geometry");
});

// ── gates ────────────────────────────────────────────────────────────────
scenario("not trapped", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.client.myPlayer.isTrapped = false;
  ctx.enemy.hold(2);
  check("free → nothing to defend", veto(ctx), "not-trapped");
});

scenario("trap my hammer cannot break", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.trap.health = 5000;
  ctx.enemy.hold(2);
  check("no launchpad, no problem", veto(ctx), "trap-holds");
});

scenario("already on the spike", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.client.myPlayer.spikeDamage = 25;
  ctx.enemy.hold(2);
  check("too late → hand it to autobreak", veto(ctx), "too-late");
});

scenario("no hammer", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.client.myPlayer.weapon.secondary = 4;
  ctx.enemy.hold(2);
  check("cannot break out anyway", veto(ctx), "no-hammer");
});

scenario("enemy trapped by me", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.client.EnemyManager._pinned = true;
  ctx.enemy.hold(2);
  check("pinned enemy sets nothing up", veto(ctx), "enemy-pinned");
});

scenario("toggle off", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  Settings._antiSmartTick = false;
  const v = veto(ctx);
  Settings._antiSmartTick = true;
  check("off is off", v, "off");
});

// ── enemy timing, not proximity ──────────────────────────────────────────
scenario("enemy swing far out and standing still", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.reload = [ { current: 0, max: 12 }, { current: 0, max: 12 } ];  // nowhere near ready
  ctx.enemy.canPlaceSpike = false;
  ctx.enemy.buildingDamage = 10;          // cannot break my trap either
  ctx.enemy.hold(2);
  check("cold read → stand down", veto(ctx), "cold");
});

scenario("cold read latches for two ticks", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  check("hot while the swing is close", plan(ctx) !== null, true);
  // swing goes away
  ctx.enemy.reload = [ { current: 0, max: 12 }, { current: 0, max: 12 } ];
  ctx.enemy.canPlaceSpike = false;
  ctx.enemy.buildingDamage = 10;
  ctx.tick();
  check("still hot one tick later", plan(ctx) !== null, true);
  ctx.tick(); ctx.tick(); ctx.tick();
  check("cold once the latch expires", veto(ctx), "cold");
});

scenario("enemy approaching keeps the read hot", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.canPlaceSpike = false;
  ctx.enemy.buildingDamage = 10;
  for (let i = 0; i < 3; i++) ctx.enemy.step(-8, 0);   // walking in
  const p = plan(ctx);
  check("closing counts as intent", p !== null, true);
  check("timing read says closing", p && p.timing.closing, true);
});

scenario("enemy retreating drops the read", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.canPlaceSpike = false;
  ctx.enemy.buildingDamage = 10;
  ctx.enemy.reload = [ { current: 0, max: 12 }, { current: 0, max: 12 } ];
  for (let i = 0; i < 3; i++) ctx.enemy.step(9, 0);   // running off
  // Geometry is the earlier of the two vetoes: from out there they cannot
  // reach a spike onto me at all, so the timing read is never consulted.
  check("retreating enemy → no plan", plan(ctx), null);
  check("geometry rules it out first", ctx.module.lastVeto, "no-geometry");
});

scenario("enemy in range but committed to nothing", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.canPlaceSpike = false;
  ctx.enemy.buildingDamage = 10;
  ctx.enemy.reload = [ { current: 0, max: 12 }, { current: 0, max: 12 } ];
  for (let i = 0; i < 3; i++) ctx.enemy.step(3, 0);   // easing away, still close
  check("proximity alone is not a threat", veto(ctx), "cold");
});

scenario("enemy who can break my trap is a threat even standing still", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.canPlaceSpike = false;
  ctx.enemy.buildingDamage = 400;         // one-shots the trap
  ctx.enemy.hold(2);
  const p = plan(ctx);
  check("break capability alone keeps it live", p !== null, true);
  check("timing knows they can break it", p && p.timing.canBreak, true);
});

// ── response ladder ──────────────────────────────────────────────────────
scenario("secondary reloading → hold the secondary", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  ctx.client._ModuleHandler.staticModules.reloading.slots[1] = 0;
  const p = plan(ctx);
  check("hold", p && p.kind, "hold");
  check("holds slot 1", p && p.holdSlot, 1);
});

scenario("primary reloading → hold the primary", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  ctx.client._ModuleHandler.staticModules.reloading.slots[0] = 0;
  const p = plan(ctx);
  check("hold", p && p.kind, "hold");
  check("holds slot 0", p && p.holdSlot, 0);
});

scenario("both ready and healthy → counter", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  check("counter", kind(ctx), "counter");
});

scenario("both ready but hurt → heal", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.client.myPlayer.tempHealth = 40;
  ctx.enemy.hold(2);
  check("heal", kind(ctx), "heal");
});

scenario("the incoming hit would kill → heal", ctx => {
  ctx.addSpike(10, -90, 0, { damage: 45 });
  ctx.client.myPlayer.tempHealth = 60;
  ctx.client.EnemyManager.primaryDamage = 40;   // 45 + 40 > 60
  ctx.enemy.hold(2);
  check("heal", kind(ctx), "heal");
});

// ── execution ────────────────────────────────────────────────────────────
scenario("every response stops autobreak", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  ctx.module.postTick();
  check("suppressBreak raised", ctx.client._ModuleHandler.suppressBreak, true);
});

scenario("hold spends nothing and claims nothing", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  ctx.client._ModuleHandler.staticModules.reloading.slots[1] = 0;
  ctx.module.postTick();
  const MH = ctx.client._ModuleHandler;
  check("weapon held", MH.forceWeapon, 1);
  check("tick not claimed", MH.moduleActive, false);
  check("no attack", MH.shouldAttack, false);
  check("no heal asked for", MH.antiSmartHeal, false);
});

scenario("hold does not override a weapon someone else forced", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  ctx.client._ModuleHandler.staticModules.reloading.slots[1] = 0;
  ctx.client._ModuleHandler.forceWeapon = 0;   // another module got there first
  ctx.module.postTick();
  check("existing choice kept", ctx.client._ModuleHandler.forceWeapon, 0);
});

scenario("heal is a signal, not a heal", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.client.myPlayer.tempHealth = 40;
  ctx.enemy.hold(2);
  ctx.module.postTick();
  const MH = ctx.client._ModuleHandler;
  check("flag raised for AutoHeal", MH.antiSmartHeal, true);
  check("tick not claimed", MH.moduleActive, false);
});

scenario("counter claims and swings", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  ctx.module.postTick();
  const MH = ctx.client._ModuleHandler;
  check("tick claimed", MH.moduleActive, true);
  check("primary forced", MH.forceWeapon, 0);
  check("turret gear", MH.forceHat, 53);
  check("attacking", MH.shouldAttack, true);
});

// ── arbitration and budget ───────────────────────────────────────────────
scenario("counter yields to a claimed tick", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  ctx.client._ModuleHandler.moduleActive = true;   // spike tick / insta got here first
  ctx.module.postTick();
  check("no second claim", ctx.client._ModuleHandler.shouldAttack, false);
  check("but autobreak is still stopped", ctx.client._ModuleHandler.suppressBreak, true);
});

scenario("counter yields when the arbiter says no", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  ctx.setArbiter(false);
  ctx.module.postTick();
  ctx.setArbiter(true);
  check("arbiter refused", ctx.client._ModuleHandler.moduleActive, false);
  check("suppression still applied", ctx.client._ModuleHandler.suppressBreak, true);
});

scenario("counter yields when the wire is full", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  ctx.setBudget(2);
  ctx.module.postTick();
  ctx.setBudget(60);
  check("no packets, no counter", ctx.client._ModuleHandler.moduleActive, false);
});

scenario("hold survives a full wire", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  ctx.client._ModuleHandler.staticModules.reloading.slots[1] = 0;
  ctx.setBudget(0);
  ctx.module.postTick();
  ctx.setBudget(60);
  check("free response still runs", ctx.client._ModuleHandler.forceWeapon, 1);
  check("and still stops the break", ctx.client._ModuleHandler.suppressBreak, true);
});

// ── cancellation / revalidation ──────────────────────────────────────────
scenario("enemy switching weapon cancels the plan", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  const p = plan(ctx);
  check("valid at plan time", ctx.module.revalidate(p), true);
  ctx.enemy.weapon.secondary = 4;
  check("weapon change → cancel", ctx.module.revalidate(p), false);
});

scenario("enemy getting pinned cancels the plan", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  const p = plan(ctx);
  ctx.enemy.isTrapped = true;
  check("pinned → cancel", ctx.module.revalidate(p), false);
});

scenario("enemy dying cancels the plan", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  const p = plan(ctx);
  ctx.enemy.currentHealth = 0;
  check("dead → cancel", ctx.module.revalidate(p), false);
});

scenario("getting out of the trap cancels the plan", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  const p = plan(ctx);
  ctx.client.myPlayer.isTrapped = false;
  check("free → cancel", ctx.module.revalidate(p), false);
});

scenario("being retrapped by a different trap cancels the plan", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  const p = plan(ctx);
  ctx.client.myPlayer.trappedIn = { id: 51, health: 200 };
  check("different trap → replan", ctx.module.revalidate(p), false);
});

scenario("their spike being destroyed cancels the plan", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  const p = plan(ctx);
  ctx.client.ObjectManager.objects.delete(10);
  check("spike gone → cancel", ctx.module.revalidate(p), false);
});

scenario("taking the spike hit cancels the plan", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  const p = plan(ctx);
  ctx.client.myPlayer.spikeDamage = 25;
  check("hit landed → cancel", ctx.module.revalidate(p), false);
});

scenario("a plan from last tick is stale", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  const p = plan(ctx);
  ctx.tick();
  check("stale → cancel", ctx.module.revalidate(p), false);
});

scenario("a cancelled plan executes nothing", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  plan(ctx);
  ctx.enemy.weapon.secondary = 4;    // invalidate after planning
  ctx.module.postTick();
  const MH = ctx.client._ModuleHandler;
  check("no suppression", MH.suppressBreak, false);
  check("no claim", MH.moduleActive, false);
  check("no heal", MH.antiSmartHeal, false);
});

scenario("plan is memoised within a tick", ctx => {
  ctx.addSpike(10, -90, 0);
  ctx.enemy.hold(2);
  check("same object twice", ctx.module.plan() === ctx.module.plan(), true);
});

// ── architecture contract ────────────────────────────────────────────────
scenario("architecture contract", ctx => {
  check("no angle probe of its own", /for\s*\(\s*let\s+i\s*=\s*0;\s*i\s*<\s*36/.test(source), false);
  check("angles come from ObjectManager", source.includes("getBestPlacementAngles"), true);
  check("collision from ObjectManager", source.includes("canPlaceItem"), true);
  check("shared segment test reused", source.includes("segmentReachesCircle"), true);
  check("budget read through RynNetwork", source.includes("engine.network.budgetLeft()"), true);
  check("priority read through RynArbiter", source.includes("engine.arbiter.allows"), true);
  check("no socket access", /SocketManager|new WebSocket|PacketManager\s*\.\s*send/.test(source), false);
  check("no setTimeout scheduler", /setTimeout|setInterval/.test(source), false);
  check("healing delegated, not performed", /ModuleHandler\.heal\(\)|MH\.heal\(\)/.test(source), false);
});

done();
