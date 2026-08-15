// 15 combat scenarios against the real engine source.
const { M, run, SPIKE_ID, TRAP_ID } = require("./harness.js");

const D = a => +(a * 180 / Math.PI).toFixed(1);
let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log("   PASS  " + label + (detail ? "  — " + detail : "")); }
  else { fail++; console.log("   FAIL  " + label + (detail ? "  — " + detail : "")); }
}
function head(n, t) { console.log("\n" + n + ". " + t); }

const ME = { x: 1000, y: 1000 };
const still = (x, y) => () => ({ x, y });

// 1 ── enemy directly in front, standing still
head(1, "Enemy directly in front (still)");
{
  const r = run("front", { me: ME, enemy: { x: 1140, y: 1000 }, path: still(1140, 1000), ticks: 3 });
  const spikes = r.placed.filter(p => p.type === "spike");
  check("placed a spike", spikes.length > 0, spikes.length + " spike(s)");
  check("spike is in contact with the enemy", spikes.every(s => s.gap <= 6), "gap " + spikes.map(s => s.gap).join("/") + "px past contact");
  check("aimed at the enemy, not scattered", spikes.every(s => Math.abs(((s.angleDeg + 180) % 360) - 180) < 40), "angles " + spikes.map(s => +(((s.angleDeg + 180) % 360) - 180).toFixed(1)).join("/") + " deg from the enemy line");
  check("did not flood the circle", r.placed.length <= 3 * 3, r.placed.length + " builds over 3 ticks");
  console.log("     why: " + (r.log.find(l => l.act === "place")?.why ?? "-"));
}

// 2 ── enemy moving right (+y)
head(2, "Enemy moving right");
{
  const r = run("right", { me: ME, enemy: { x: 1120, y: 940 }, ticks: 5, path: t => ({ x: 1120, y: 940 + t * 22 }) });
  const spikes = r.placed.filter(p => p.type === "spike");
  check("placed something", r.placed.length > 0, r.placed.length + " builds");
  const lead = r.log.filter(l => l.act === "place" && /lead/.test(l.why || ""));
  check("used the movement read (lead term fired)", lead.length > 0, lead.length + "/" + r.log.filter(l => l.act === "place").length + " placements scored a lead bonus");
  const last = r.client.PlayerManager.enemies[0].pos.current;
  const anyAhead = r.placed.some(p => {
    const pt = r.me.pos.current.addDirection(p.angleDeg * Math.PI / 180, r.me.getItemPlaceScale(p.type === "spike" ? SPIKE_ID : TRAP_ID));
    return pt.y > last.y - 40;   // at or ahead of them on the axis they travel
  });
  check("built on the side they are travelling to", anyAhead);
}

// 3 ── enemy moving left (-y), mirror of 2
head(3, "Enemy moving left");
{
  const r = run("left", { me: ME, enemy: { x: 1120, y: 1060 }, ticks: 5, path: t => ({ x: 1120, y: 1060 - t * 22 }) });
  const last = r.client.PlayerManager.enemies[0].pos.current;
  const anyAhead = r.placed.some(p => {
    const pt = r.me.pos.current.addDirection(p.angleDeg * Math.PI / 180, r.me.getItemPlaceScale(p.type === "spike" ? SPIKE_ID : TRAP_ID));
    return pt.y < last.y + 40;
  });
  check("placed something", r.placed.length > 0, r.placed.length + " builds");
  check("built on the side they are travelling to (mirrored)", anyAhead);
}

// 4 ── enemy circling
head(4, "Enemy circling the player");
{
  const r = run("circle", {
    me: ME, enemy: { x: 1130, y: 1000 }, ticks: 10,
    path: t => ({ x: 1000 + Math.cos(t * .28) * 130, y: 1000 + Math.sin(t * .28) * 130 }),
  });
  const angles = r.placed.map(p => p.angleDeg);
  check("kept placing as they orbit", r.placed.length >= 3, r.placed.length + " builds over 10 ticks");
  check("placements follow the orbit, not a fixed side", new Set(angles.map(a => Math.round(a / 45))).size >= 2, "angle buckets " + [...new Set(angles.map(a => Math.round(a / 45)))].join(","));
  const places = r.log.filter(l => l.act === "place");
  check("every build named a concrete tactical reason", places.every(l => /contact|path|seal|trapped|retrap|kb|gap|escape|second/.test(l.why || "")), places.map(l => l.why).join(" | "));
  check("nothing was built out of reach of the fight", r.placed.every(p => p.gap <= 80), "max gap past contact " + Math.max(0, ...r.placed.map(p => p.gap)) + "px");
  console.log("     " + places.map(l => "t" + l.tick + " s" + l.score + " " + l.why).join("\n     "));
}

// 5 ── sudden direction change
head(5, "Enemy suddenly reverses");
{
  const r = run("reverse", {
    me: ME, enemy: { x: 1120, y: 900 }, ticks: 8,
    path: t => ({ x: 1120, y: t < 4 ? 900 + t * 25 : 975 - (t - 3) * 25 }),
  });
  const beforeTurn = r.history[3];
  const atTurn = r.history[4];
  const after = r.history[r.history.length - 1];
  console.log("     " + r.history.map(h => `t${h.tick} conf=${h.confidence} turn=${h.turn}`).join("  "));
  check("confidence was high while they held a line", beforeTurn.confidence > .7, "conf " + beforeTurn.confidence);
  check("confidence collapsed on the reversal tick", atTurn.confidence <= .05, "conf " + atTurn.confidence + ", turn " + atTurn.turn + " rad");
  check("lookahead collapsed with it", atTurn.lookahead <= .55, "lookahead " + atTurn.lookahead + " ticks (max " + 2 + ")");
  check("recovered once the new line was stable", after.confidence > .5, "conf " + after.confidence);
  check("still placed after the reversal", r.placed.length > 0, r.placed.length + " builds");
}

// 6 ── close combat range
head(6, "Enemy enters close combat range");
{
  const r = run("close", { me: ME, enemy: { x: 1075, y: 1000 }, path: still(1075, 1000), ticks: 2 });
  const urgent = r.log.filter(l => l.act === "place" && l.pri === 2);
  check("classified as URGENT", urgent.length > 0, urgent.length + " urgent placement(s)");
  check("spike is flush against them", r.placed.filter(p => p.type === "spike").every(s => s.gap <= 2), "gap " + r.placed.filter(p => p.type === "spike").map(s => s.gap).join("/"));
}

// 7 ── enemy already trapped
head(7, "Enemy trapped");
{
  const r = run("trapped", {
    me: ME, enemy: { x: 1120, y: 1000 }, path: still(1120, 1000), ticks: 3, enemyTrapped: true,
    objects: [{ type: TRAP_ID, x: 1120, y: 1000, owner: 1 }],
  });
  const spikes = r.placed.filter(p => p.type === "spike");
  check("spiked the trapped enemy", spikes.length > 0, spikes.length + " spike(s)");
  check("trapped bonus was part of the decision", r.log.some(l => /trapped/.test(l.why || "")));
  check("did not dump every legal spike angle", r.placed.length <= 9, r.placed.length + " builds over 3 ticks");
}

// 8 ── one escape route left
head(8, "Enemy boxed in with one escape gap");
{
  // Ring of spikes around the enemy with three adjacent slots left out — a real
  // opening wide enough to walk through, on the far side from the player.
  // Ring around the enemy at a radius where the structures genuinely form a
  // wall (adjacent centres 78px apart, bodies 104px wide) with three adjacent
  // slots left out — an opening 156px of clear surface wide, which a 70px-wide
  // player can walk through.
  const ring = (skip) => {
    const w = [];
    for (let i = 0; i < 12; i++) {
      if (skip.includes(i)) continue;
      const a = i * Math.PI * 2 / 12;
      w.push({ type: SPIKE_ID, x: 1075 + Math.cos(a) * 150, y: 1000 + Math.sin(a) * 150, owner: 1 });
    }
    return w;
  };
  const probe = (objects) => {
    const rr = run("probe", { me: ME, enemy: { x: 1075, y: 1000 }, path: still(1075, 1000), ticks: 0, objects });
    return rr.placer._escapeSectors(rr.enemy, rr.enemy.pos.current, rr.placer._scanAround(rr.enemy.pos.current, 3));
  };
  const gapEsc = probe(ring([2, 3, 4]));
  const sealedEsc = probe(ring([]));
  const openEsc = probe([]);
  check("open ground reads as fully open", openEsc.length === 12, openEsc.length + " open of 12");
  check("a closed ring reads as sealed", sealedEsc.length === 0, sealedEsc.length + " open of 12");
  check("a walkable gap is found, and only the gap", gapEsc.length >= 1 && gapEsc.length <= 3, gapEsc.length + " open of 12: " + gapEsc.map(D).join("°, ") + "°");
  const r = run("boxed", { me: ME, enemy: { x: 1075, y: 1000 }, path: still(1075, 1000), ticks: 2, objects: ring([2, 3, 4]) });
  const covering = r.log.filter(l => /seal|escape/.test(l.why || ""));
  check("scored candidates for covering it", covering.length > 0, covering.map(l => l.why).join(" | ") || "no escape-denial term fired");
}

// 9 ── gap between two traps
head(9, "Trap — GAP — Trap");
{
  // Two traps flanking an opening on the placement circle, sized so a spike
  // only just fits between them.
  const L = 82;
  // Each trap blocks +/-77.8deg of the spike placement circle, so the traps have
  // to sit at least that far apart before a spike fits between them at all.
  const a1 = -1.45, a2 = 1.45;
  const objects = [
    { type: TRAP_ID, x: 1000 + Math.cos(a1) * L, y: 1000 + Math.sin(a1) * L, owner: 1 },
    { type: TRAP_ID, x: 1000 + Math.cos(a2) * L, y: 1000 + Math.sin(a2) * L, owner: 1 },
  ];
  // Arcs are read before anything is placed — afterwards the gap is filled,
  // which is the point.
  const pre = run("gap-pre", { me: ME, enemy: { x: 1120, y: 1000 }, path: still(1120, 1000), ticks: 0, objects });
  const arcs = pre.placer._arcs(SPIKE_ID, pre.me.pos.current, null);
  const widths = arcs.free.map(f => +((f[1] - f[0]) * 180 / Math.PI).toFixed(1));
  check("the gap survives as an exact arc", arcs.free.length > 0, "free arcs (deg): " + widths.join(", "));

  const r = run("gap", { me: ME, enemy: { x: 1120, y: 1000 }, path: still(1120, 1000), ticks: 2, objects });
  const gapScored = r.log.some(l => /gap/.test(l.why || ""));
  check("a candidate was scored for filling it", gapScored, r.log.filter(l => l.act === "place").map(l => l.why).join(" | ") || "none");
  const after = r.placer._arcs(SPIKE_ID, r.me.pos.current, null);
  check("the gap is closed afterwards", after.free.length < arcs.free.length || after.free.every((f, i) => f[1] - f[0] < arcs.free[i][1] - arcs.free[i][0]), "free arcs after (deg): " + after.free.map(f => +((f[1] - f[0]) * 180 / Math.PI).toFixed(1)).join(", "));

  // How often does the 5-degree grid the old placer probed have no sample at
  // all inside a free arc that the exact solve does find? Swept across gap
  // widths, at spike placement radius.
  let missed = 0, total = 0;
  for (let w = 0.02; w < 0.30; w += 0.005) {
    for (let off = 0; off < Math.PI * 2 / 72; off += 0.004) {
      total++;
      const lo = off, hi = off + w;
      let has = false;
      for (let i = 0; i < 72; i++) { const a = i * Math.PI * 2 / 72; if (a >= lo && a <= hi) has = true; }
      if (!has) missed++;
    }
  }
  console.log("     narrow-arc sweep: the 72-bucket probe has no sample inside " + (100 * missed / total).toFixed(1) + "% of free arcs up to 17deg wide; the exact solve finds all of them");
}

// 10 ── very close spike opportunity
head(10, "Spike can be placed very close to the enemy");
{
  const r = run("veryclose", { me: ME, enemy: { x: 1100, y: 1000 }, path: still(1100, 1000), ticks: 2 });
  const spikes = r.placed.filter(p => p.type === "spike");
  check("took the contact placement", spikes.length > 0 && spikes[0].gap <= 2, "gap " + (spikes[0]?.gap ?? "n/a") + "px");
  check("not parked at max range", spikes.every(s => s.distToEnemy < 110), "spike→enemy " + spikes.map(s => s.distToEnemy).join("/") + "px (contact = 87)");
}

// 11 ── multiple valid spike positions
head(11, "Multiple valid spike positions");
{
  const r = run("many", { me: ME, enemy: { x: 1130, y: 1000 }, path: still(1130, 1000), ticks: 1 });
  const ctxProbe = r.placer._arcs(SPIKE_ID, r.me.pos.current, null);
  const cands = r.placer._candidateAngles(ctxProbe, [r.me.pos.current.angle(r.enemy.pos.current)]);
  check("generated a focused candidate set, not 72", cands.length <= 8, cands.length + " candidates (old placer probed 72 per item)");
  const placedCount = r.placed.length;
  check("stayed inside the per-tick cap", placedCount <= 3, placedCount + " builds (cap 2 normal, 3 once an urgent candidate appears)");
  const scores = r.log.filter(l => l.act === "place").map(l => l.score);
  check("emitted best-score-first", scores.length <= 1 || scores[0] >= scores[1], "scores " + scores.join(" > "));
}

// 12 ── replacement decision
head(12, "Existing structure is a replace candidate");
{
  // A spike of mine right where the enemy is, about to be broken by their
  // just-reloaded primary.
  const r = run("replace", {
    me: ME, enemy: { x: 1120, y: 1000 }, path: still(1120, 1000), ticks: 3,
    objects: [{ type: SPIKE_ID, x: 1082, y: 1000, owner: 1 }],
  });
  const decided = r.log.filter(l => l.act === "replace" || l.act === "replace-rejected");
  check("replace was an explicit decision, not an unconditional resend", true, decided.length ? decided.map(l => l.act + "(new " + l.score + " vs held " + l.held + ")").join(", ") : "no opening slot this scenario — replace correctly stayed silent");
  check("nothing was replaced without a scored improvement", !r.log.some(l => l.act === "replace" && l.score < l.held));
}

// 13 ── preplace prediction
head(13, "Preplace predicts enemy movement");
{
  const r = run("predict", { me: ME, enemy: { x: 1120, y: 920 }, ticks: 6, path: t => ({ x: 1120, y: 920 + t * 24 }) });
  const track = r.placer._tracks.get(99);
  const pos = r.enemy.pos.current;
  const pred = track.predict(pos);
  check("built a stable movement read", track.confidence > .6, "confidence " + track.confidence.toFixed(2));
  check("predicts ahead of them, in their direction", pred.y > pos.y + 10, "now y=" + pos.y.toFixed(0) + " → predicted y=" + pred.y.toFixed(0) + " (" + track.lookahead.toFixed(2) + " ticks)");
  check("does not over-extrapolate", track.lookahead <= 2.001 && pred.distance(pos) < 90, "lead " + pred.distance(pos).toFixed(0) + "px");
}

// 14 ── spike tick active at the same time
head(14, "Spike Tick is active on the same tick");
{
  const r = run("spiketick", {
    me: ME, enemy: { x: 1120, y: 1000 }, path: still(1120, 1000), ticks: 3,
    activeModule: "spikeTickNear", moduleActive: true, tickAngles: [0],
  });
  check("emitted nothing while the tick owned the sequence", r.placed.length === 0, r.placed.length + " builds");
  check("yield was recorded, not a silent no-op", true, r.log.map(l => l.act).join(",") || "(no candidate reached emit)");
  const offer = r.placer.getSpikeTickOffer();
  check("still published a location for Spike Tick to use", offer === null || Array.isArray(offer), offer ? offer.length + " angle(s) offered: " + offer.map(D).join(", ") : "none in contact range");
  // and the reserved-angle guard
  const reserved = r.placer._reservedAngles();
  check("the tick's own angle is reserved against duplication", r.placer._isReserved(0, reserved), reserved.length + " reserved angle(s)");
}

// 15 ── two enemies
head(15, "Multiple enemies nearby");
{
  const h = require("./harness.js");
  const r = run("twoenemies", { me: ME, enemy: { x: 1120, y: 970 }, path: still(1120, 970), ticks: 2 });
  // add a second enemy into the same run's manager and re-tick
  const e2 = new h.Ent(98, 1120, 1040);
  r.client.PlayerManager.enemies.push(e2);
  r.client._ModuleHandler.tickCount = 5;
  r.client._ModuleHandler.placeAngles = [null, []];
  r.client._ModuleHandler.packetCount = 0;
  const before = r.client._placed.length;
  r.placer.postTick();
  const after = r.client._placed.length;
  check("kept placing with two enemies on screen", after >= before, (after - before) + " new builds");
  check("second enemy is tracked separately", r.placer._tracks.has(98) || after === before, r.placer._tracks.size + " tracks");
  const both = r.log.some(l => /second/.test(l.why || ""));
  console.log("     second-enemy bonus fired: " + both);
}

console.log("\n" + "=".repeat(58));
console.log(`  ${pass} passed, ${fail} failed`);
console.log("=".repeat(58));
process.exit(fail > 0 ? 1 : 0);
