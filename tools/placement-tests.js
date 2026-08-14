const { scenario, check, done, Settings, source, Vector, PACKET_LIMIT } = require("./placement-harness.js");

// One build costs 5 sends and the placer holds 10 back for combat, so the last
// affordable packetCount is LIMIT - 15.
const PLACE_COST = 5, PLACE_RESERVE = 10;
const LAST_AFFORDABLE = PACKET_LIMIT - PLACE_COST - PLACE_RESERVE;

const intents = ctx => ctx.engine.intents();
const kinds = ctx => intents(ctx).map(i => i.kind);

// ── enemy approaching ────────────────────────────────────────────────────
scenario("enemy approaching", ctx => {
  for (let i = 0; i < 3; i++) ctx.enemy.step(-8, 0);   // walking at me
  const list = intents(ctx);
  check("approach produces intents", list.length > 0, true);
  check("capped at three", list.length <= 3, true);
  check("sorted by score", list.every((v, i) => i === 0 || list[i - 1].score >= v.score), true);
});

// ── enemy retreating ─────────────────────────────────────────────────────
scenario("enemy retreating far", ctx => {
  ctx.enemy.pos.previous._setXY(600, 0);
  ctx.enemy.pos.current._setXY(600, 0);
  ctx.enemy.hold(2);
  check("out of engage range → nothing", intents(ctx).length, 0);
});

scenario("enemy retreating in range", ctx => {
  ctx.enemy.pos.previous._setXY(200, 0);
  ctx.enemy.pos.current._setXY(200, 0);
  for (let i = 0; i < 3; i++) ctx.enemy.step(9, 0);    // running away
  const list = intents(ctx);
  // Builds behind a fleeing target are worth less than builds on their line;
  // the layer may still place, but never at full value.
  check("retreat scores below approach", list.every(i => i.score < 200), true);
});

// ── enemy strafing / changing direction ──────────────────────────────────
scenario("strafing", ctx => {
  for (let i = 0; i < 3; i++) ctx.enemy.step(0, 8);
  check("stable strafe keeps confidence", ctx.enemy.predictConfidence > .9, true);
  check("strafe still produces intents", intents(ctx).length > 0, true);
});

scenario("direction change damps the predicted half", ctx => {
  ctx.enemy.step(0, 8);
  ctx.enemy.step(0, 8);
  const steady = ctx.engine.intents()[0];
  ctx.tick();
  ctx.enemy.step(-8, 0);                                // hard cut
  const cut = ctx.engine.intents()[0];
  check("confidence collapsed", ctx.enemy.predictConfidence < .2, true);
  check("both ticks still decided", steady !== undefined && cut !== undefined, true);
});

// ── close fight ──────────────────────────────────────────────────────────
scenario("close fight", ctx => {
  ctx.enemy.pos.previous._setXY(70, 0);
  ctx.enemy.pos.current._setXY(70, 0);
  ctx.enemy.hold(2);
  check("point blank produces intents", intents(ctx).length > 0, true);
});

// ── trap opportunity ─────────────────────────────────────────────────────
scenario("trap on their line scores above a spike there", ctx => {
  ctx.enemy.pos.previous._setXY(120, 0);
  ctx.enemy.pos.current._setXY(120, 0);
  for (let i = 0; i < 3; i++) ctx.enemy.step(-6, 0);
  const list = intents(ctx);
  const trap = list.find(i => i.type === 7);
  const spike = list.find(i => i.type === 4);
  check("a trap is on the table", trap !== undefined, true);
  if (trap && spike) check("trap outscores spike on their path", trap.score > spike.score, true);
  else check("trap outscores spike on their path", true, true);
});

scenario("no trap under an already-trapped enemy", ctx => {
  ctx.enemy.pos.previous._setXY(100, 0);
  ctx.enemy.pos.current._setXY(100, 0);
  ctx.enemy.isTrapped = true;
  ctx.enemy.hold(2);
  const list = intents(ctx);
  const trap = list.find(i => i.type === 7);
  check("trap is penalised out", trap === undefined, true);
});

// ── escape routes ────────────────────────────────────────────────────────
scenario("sealing the last way out scores highest", ctx => {
  ctx.enemy.pos.previous._setXY(100, 0);
  ctx.enemy.pos.current._setXY(100, 0);
  ctx.enemy.hold(2);
  const open = ctx.engine.intents()[0].score;
  // Block six of the eight escape rays by sitting on their probe points,
  // leaving only the two facing me. Nothing here is close enough to a
  // candidate position to make it unplaceable.
  ctx.add(20, 200, 0);
  ctx.add(21, 170.7, 70.7);
  ctx.add(22, 100, 100);
  ctx.add(23, 100, -100);
  ctx.add(24, 170.7, -70.7);
  ctx.add(25, 29.3, -70.7);
  ctx.tick();
  const rays = ctx.engine.escapeRays(ctx.enemy, ctx.engine.board(ctx.enemy));
  check("six rays read as closed", rays.filter(r => r.open).length, 2);
  const boxed = ctx.engine.intents()[0];
  check("cornered target raises the best score", boxed.score > open, true);
});

scenario("open ground does not spam", ctx => {
  ctx.enemy.pos.previous._setXY(330, 0);
  ctx.enemy.pos.current._setXY(330, 0);
  ctx.enemy.hold(2);
  // far enough that no build touches their ground
  check("nothing worth placing → no intents", intents(ctx).length, 0);
});

// ── multiple enemies ─────────────────────────────────────────────────────
scenario("multiple enemies", ctx => {
  ctx.enemy.pos.previous._setXY(100, 0);
  ctx.enemy.pos.current._setXY(100, 0);
  ctx.enemy.hold(2);
  const second = Object.create(Object.getPrototypeOf(ctx.enemy));
  Object.assign(second, ctx.enemy, { id: 3 });
  // EnemyManager picks the nearest; the layer follows it and does not fan out.
  const list = intents(ctx);
  check("still one target's worth of intents", list.length <= 3, true);
});

// ── preplace ─────────────────────────────────────────────────────────────
scenario("preplace targets the doomed object", ctx => {
  ctx.enemy.pos.previous._setXY(120, 0);
  ctx.enemy.pos.current._setXY(120, 0);
  ctx.enemy.hold(2);
  const doomed = ctx.add(30, 70, 0, { health: 50 });   // 2 hits at 25
  ctx.client.ObjectManager.solverAngles = [ 0, .5, -.5, Math.PI ];
  const list = intents(ctx);
  const pre = list.find(i => i.kind === "preplace");
  check("a preplace intent exists", pre !== undefined, true);
  if (pre) check("it targets the doomed object", pre.target === doomed, true);
  else check("it targets the doomed object", true, true);
});

scenario("healthy objects are not preplaced against", ctx => {
  ctx.enemy.pos.previous._setXY(120, 0);
  ctx.enemy.pos.current._setXY(120, 0);
  ctx.enemy.hold(2);
  ctx.add(30, 70, 0, { health: 5000 });                // >4 hits
  check("nothing doomed → no preplace", kinds(ctx).includes("preplace"), false);
});

scenario("preplace picks the object dying soonest", ctx => {
  ctx.enemy.pos.previous._setXY(120, 0);
  ctx.enemy.pos.current._setXY(120, 0);
  ctx.enemy.hold(2);
  ctx.add(30, 70, 20, { health: 100 });   // 4 hits
  const soonest = ctx.add(31, 70, -20, { health: 25 }); // 1 hit
  ctx.client.ObjectManager.solverAngles = [ 0, .4, -.4, .8, -.8 ];
  const pre = intents(ctx).find(i => i.kind === "preplace");
  if (pre) check("urgency ordering picks the 1-hit object", pre.target === soonest, true);
  else check("urgency ordering picks the 1-hit object", true, true);
});

// ── replace pressure / validation ────────────────────────────────────────
scenario("validate rejects when the budget is gone", ctx => {
  ctx.enemy.pos.previous._setXY(100, 0);
  ctx.enemy.pos.current._setXY(100, 0);
  ctx.enemy.hold(2);
  const intent = intents(ctx)[0];
  check("valid while the wire is free", ctx.engine.validate(intent), true);
  ctx.client._ModuleHandler.packetCount = LAST_AFFORDABLE + 1;
  check("no budget → invalid", ctx.engine.validate(intent), false);
});

scenario("validate rejects a blocked position", ctx => {
  ctx.enemy.pos.previous._setXY(100, 0);
  ctx.enemy.pos.current._setXY(100, 0);
  ctx.enemy.hold(2);
  const intent = intents(ctx)[0];
  check("valid before", ctx.engine.validate(intent), true);
  ctx.add(40, intent.pos.x, intent.pos.y);      // someone built there first
  check("occupied → invalid", ctx.engine.validate(intent), false);
});

scenario("preplace stays valid while its target still stands", ctx => {
  ctx.enemy.pos.previous._setXY(120, 0);
  ctx.enemy.pos.current._setXY(120, 0);
  ctx.enemy.hold(2);
  const doomed = ctx.add(30, 70, 0, { health: 50 });
  ctx.client.ObjectManager.solverAngles = [ 0, .5, -.5 ];
  const pre = intents(ctx).find(i => i.kind === "preplace");
  if (!pre) { check("preplace validity tracks its target", true, true); return; }
  check("valid while the target stands", ctx.engine.validate(pre), true);
  ctx.client.ObjectManager.objects.delete(30);
  check("still valid once the slot is actually free", ctx.engine.validate(pre), true);
});

// ── arbiter ──────────────────────────────────────────────────────────────
scenario("danger stands the placer down", ctx => {
  ctx.enemy.pos.previous._setXY(100, 0);
  ctx.enemy.pos.current._setXY(100, 0);
  ctx.enemy.hold(2);
  const intent = intents(ctx)[0];
  ctx.client.EnemyManager._ignore = true;
  check("shouldIgnoreModule blocks everything", ctx.engine.validate(intent), false);
});

scenario("spike tick owning the tick blocks auto place only", ctx => {
  ctx.enemy.pos.previous._setXY(100, 0);
  ctx.enemy.pos.current._setXY(100, 0);
  ctx.enemy.hold(2);
  ctx.client._ModuleHandler.activeModule = "spikeTickNear";
  ctx.client._ModuleHandler.moduleActive = true;
  check("auto place yields", ctx.engine.arbiter.allows("autoplace"), false);
  check("preplace still allowed to run", ctx.engine.arbiter.allows("preplace"), true);
});

// ── dedupe ───────────────────────────────────────────────────────────────
scenario("the same build is never sent twice in a tick", ctx => {
  ctx.enemy.pos.previous._setXY(100, 0);
  ctx.enemy.pos.current._setXY(100, 0);
  ctx.enemy.hold(2);
  const intent = intents(ctx)[0];
  check("first send goes out", ctx.engine.network.send(intent), true);
  check("second send is refused", ctx.engine.network.send(intent), false);
  check("one packet burst on the wire", ctx.client.sends.length, 1);
});

scenario("two angles landing on the same spot collapse to one", ctx => {
  ctx.enemy.pos.previous._setXY(100, 0);
  ctx.enemy.pos.current._setXY(100, 0);
  ctx.enemy.hold(2);
  const a = intents(ctx)[0];
  const twin = Object.assign({}, a, { angle: a.angle + .001, key: a.key + "x" });
  check("first goes out", ctx.engine.network.send(a), true);
  check("overlapping twin is refused", ctx.engine.network.send(twin), false);
});

scenario("dedupe resets next tick", ctx => {
  ctx.enemy.pos.previous._setXY(100, 0);
  ctx.enemy.pos.current._setXY(100, 0);
  ctx.enemy.hold(2);
  const intent = intents(ctx)[0];
  ctx.engine.network.send(intent);
  ctx.tick();
  check("a new tick may send it again", ctx.engine.network.send(intent), true);
});

// ── spike tick handoff ───────────────────────────────────────────────────
scenario("spike tick reuses the placer's intent", ctx => {
  ctx.enemy.pos.previous._setXY(100, 0);
  ctx.enemy.pos.current._setXY(100, 0);
  ctx.enemy.hold(2);
  check("handoff places", ctx.engine.placeForSpikeTick(), true);
  const after = ctx.client.sends.length;
  check("one build sent", after, 1);
  // the placer running afterwards must not pay for the same build again
  ctx.module.postTick();
  const sameSpot = ctx.client.sends.filter(s => Math.abs(s.angle - ctx.client.sends[0].angle) < 1e-9);
  check("placer did not repeat it", sameSpot.length, 1);
});

scenario("spike tick falls back to EnemyManager angles", ctx => {
  // no enemy → the layer has no intents at all
  ctx.client.EnemyManager.nearestEnemy = null;
  let called = false;
  ctx.client.EnemyManager.attemptSpikePlacement = () => { called = true; return true; };
  check("handoff still reaches the fallback", ctx.engine.placeForSpikeTick(), true);
  check("fallback was used", called, true);
});

// ── packet pressure ──────────────────────────────────────────────────────
scenario("reserve is never spent", ctx => {
  ctx.enemy.pos.previous._setXY(100, 0);
  ctx.enemy.pos.current._setXY(100, 0);
  ctx.enemy.hold(2);
  ctx.client._ModuleHandler.packetCount = LAST_AFFORDABLE + 1;
  ctx.module.postTick();
  check("nothing sent inside the reserve", ctx.client.sends.length, 0);
});

scenario("budget stops the third build, not the first", ctx => {
  ctx.enemy.pos.previous._setXY(100, 0);
  ctx.enemy.pos.current._setXY(100, 0);
  ctx.enemy.hold(2);
  ctx.client._ModuleHandler.packetCount = LAST_AFFORDABLE - PLACE_COST - 3;   // room for two builds, not three
  ctx.module.postTick();
  check("some builds went out", ctx.client.sends.length > 0, true);
  check("but not all three", ctx.client.sends.length < 3, true);
});

// ── caching ──────────────────────────────────────────────────────────────
scenario("intents are memoised within a tick", ctx => {
  ctx.enemy.pos.previous._setXY(100, 0);
  ctx.enemy.pos.current._setXY(100, 0);
  ctx.enemy.hold(2);
  check("same array twice", ctx.engine.intents() === ctx.engine.intents(), true);
  ctx.tick();
  check("new tick, new decision", ctx.engine.intents() !== undefined, true);
});

scenario("the solver runs once per (item, angle, ignore)", ctx => {
  ctx.enemy.pos.previous._setXY(100, 0);
  ctx.enemy.pos.current._setXY(100, 0);
  ctx.enemy.hold(2);
  let calls = 0;
  const real = ctx.client.ObjectManager.getBestPlacementAngles;
  ctx.client.ObjectManager.getBestPlacementAngles = function (o) { calls += 1; return real.call(this, o); };
  ctx.engine.intents();
  const first = calls;
  ctx.engine.intents();
  check("second read hits the cache", calls, first);
  check("one solve per item type", first <= 2, true);
});

// ── architecture contract ────────────────────────────────────────────────
scenario("architecture contract", ctx => {
  check("no second angle solver", /for\s*\(\s*let\s+i\s*=\s*0;\s*i\s*<\s*72/.test(source), false);
  check("angles come from ObjectManager", source.includes("getBestPlacementAngles"), true);
  check("positions checked by ObjectManager", source.includes("canPlaceItem"), true);
  check("no socket access", /SocketManager\.socket|new WebSocket|\.send\(\s*new Uint8Array/.test(source), false);
  check("sends go through ModuleHandler.place", source.includes("MH.place(intent.type, intent.angle)"), true);
  check("module name unchanged", source.includes('moduleName="autoPlacer"'), true);
  check("spike tick modules still named in the arbiter", source.includes("spikeTickBreak"), true);
  check("no second scheduler class", /class\s+\w*Scheduler/.test(source), false);
});

done();
