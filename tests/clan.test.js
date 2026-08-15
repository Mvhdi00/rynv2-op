// Clan join rotation, the HUD counters, Be Angel vs Cowboy When Safe, and the
// autoheal shame timing. Source is lifted out of the built userscript.
const fs = require("fs");
const vm = require("vm");

const FILE = process.argv[2] || __dirname + "/../RYN_v5.4.user.js";
const src = fs.readFileSync(FILE, "utf8");
const lines = src.split("\n");
const find = pfx => {
  const i = lines.findIndex(l => l.startsWith(pfx));
  if (i < 0) throw new Error("not found: " + pfx);
  return i;
};
const span = (a, b) => lines.slice(a, b).join("\n");

const M = vm.runInNewContext(
  "(function(){\n" +
  span(find("  const CLAN_QUEUE = new WeakMap;"), find("  class ClanJoiner {")) +
  "\nreturn { clanQueue, clanTakeTurn, clanAudit, clanRecheck, CLAN_TURN_MS };\n})()",
  { Math, Number, Array, Set, Map, WeakMap, console, Date, Infinity }
);

let pass = 0, fail = 0;
const check = (label, cond, detail) => {
  if (cond) { pass++; console.log("   PASS  " + label + (detail ? "  — " + detail : "")); }
  else { fail++; console.log("   FAIL  " + label + (detail ? "  — " + detail : "")); }
};
const head = (n, t) => console.log("\n" + n + ". " + t);

const mkBots = n => Array.from({ length: n }, (_, i) => ({
  _i: i, myPlayer: { inGame: true, clanName: null },
}));
const mkOwner = bots => ({ clients: new Set(bots), myPlayer: { clanName: "RYN" } });

// ═══════════════════════════════════════════════════════════════════════════
head(1, "One bot at a time, 1.5s apart");
{
  const bots = mkBots(4);
  const owner = mkOwner(bots);
  let t = 1e6;
  const tickAll = () => bots.map(b => M.clanTakeTurn(owner, b, "RYN", t));

  const first = tickAll();
  check("exactly one bot gets the slot", first.filter(Boolean).length === 1,
        first.filter(Boolean).length + " of 4 sending");

  // Same instant, and 1.4s later: still only that one.
  check("no second bot sneaks in on the same tick", tickAll().filter(Boolean).length === 1);
  t += M.CLAN_TURN_MS - 100;
  check("still only one at 1.4s", tickAll().filter(Boolean).length === 1, "gap is " + M.CLAN_TURN_MS + "ms");

  // Past the slot: the turn moves on.
  t += 200;
  const second = tickAll();
  check("the turn moves on after the gap", second.filter(Boolean).length === 1);
  const whoFirst = first.indexOf(true), whoSecond = second.indexOf(true);
  check("and it is a different bot", whoFirst !== whoSecond, "bot " + whoFirst + " then bot " + whoSecond);
}

// ═══════════════════════════════════════════════════════════════════════════
head(2, "Round robin: a failure goes to the back, not straight back in");
{
  const bots = mkBots(3);
  const owner = mkOwner(bots);
  let t = 2e6;
  const order = [];
  for (let slot = 0; slot < 6; slot++) {
    for (const b of bots) {
      if (M.clanTakeTurn(owner, b, "RYN", t)) order.push(b._i);
    }
    t += M.CLAN_TURN_MS + 10;   // nobody ever joins
  }
  check("nobody joins, so everyone keeps getting turns", order.length === 6, "slots used: " + order.join(" → "));
  check("it rotates 1,2,3 rather than retrying one bot", order.slice(0, 3).sort().join() === "0,1,2",
        "first three slots went to bots " + order.slice(0, 3).join(", "));
  check("then it comes back round to the first", order[3] === order[0],
        "slot 4 went back to bot " + order[3]);
}

// ═══════════════════════════════════════════════════════════════════════════
head(3, "It verifies, and stops asking once a bot is in");
{
  const bots = mkBots(3);
  const owner = mkOwner(bots);
  let t = 3e6;
  const slot = () => { const r = bots.filter(b => M.clanTakeTurn(owner, b, "RYN", t)); t += M.CLAN_TURN_MS + 10; return r[0]; };

  const a = slot();
  a.myPlayer.clanName = "RYN";          // that one made it
  const b = slot();
  check("the bot that joined is not asked again", b !== a, "bot " + a._i + " joined, slot went to bot " + b._i);
  b.myPlayer.clanName = "RYN";
  const c = slot();
  check("nor is the second", c !== a && c !== b, "slot went to bot " + c._i);
  c.myPlayer.clanName = "RYN";
  check("with everyone in, nobody is asked", slot() === undefined);

  const audit = M.clanAudit(owner);
  check("the audit counts them", audit.joined === 3 && audit.total === 3, audit.joined + "/" + audit.total + " in " + audit.clan);

  // One gets kicked: the rotation picks it up again.
  bots[1].myPlayer.clanName = null;
  const again = slot();
  check("a bot that drops out is re-queued", again === bots[1], "slot went back to bot " + (again && again._i));
}

// ═══════════════════════════════════════════════════════════════════════════
head(4, "Re-check button");
{
  const bots = mkBots(4);
  const owner = mkOwner(bots);
  bots[0].myPlayer.clanName = "RYN";
  bots[2].myPlayer.clanName = "RYN";
  const a = M.clanRecheck(owner);
  check("reports who is in", a.joined === 2 && a.total === 4, a.joined + "/" + a.total);
  check("restarts the rotation immediately", M.clanQueue(owner).nextAt === 0);
  const who = bots.filter(b => M.clanTakeTurn(owner, b, "RYN", 4e6));
  check("and the next slot goes to one that is out", who.length === 1 && who[0].myPlayer.clanName === null,
        "slot went to bot " + (who[0] && who[0]._i));

  const noClan = mkOwner(mkBots(2));
  noClan.myPlayer.clanName = null;
  check("with no clan it reports so rather than looping", M.clanRecheck(noClan).clan === null);

  // Where it sits: directly under the bot name rows.
  const iList = src.indexOf('id=\\"dynamic-bot-list\\"');
  const iBtn = src.indexOf('id=\\"_clanRecheck\\"');
  const iAdd = src.indexOf('id=\\"add-bot-dynamic\\"');
  check("the button sits under the bot name rows", iList > 0 && iList < iBtn, "list@" + iList + " button@" + iBtn);
  check("...and above Add Bots", iBtn < iAdd, "button@" + iBtn + " add@" + iAdd);
  check("it is wired through attachButtons", /case "_clanRecheck":/.test(src) && /handleClanRecheck\(button\)/.test(src));
}

// ═══════════════════════════════════════════════════════════════════════════
head(5, "HUD");
{
  const iP = src.indexOf('id="rynPlayers"'), iB = src.indexOf('id="rynBots"'), iPing = src.indexOf('id="rynPing"');
  check("PLAYERS sits above PING", iP > 0 && iP < iPing, "players@" + iP + " ping@" + iPing);
  check("a BOTS counter was added", iB > 0);
  check("BOTS sits between them", iP < iB && iB < iPing);
  check("it is driven on a timer", /GameUI_default\.updateBots\(/.test(src) && /clanAudit\(owner\)/.test(src));
}

// ═══════════════════════════════════════════════════════════════════════════
head(6, "Be Angel outranks Cowboy When Safe, for bots only");
{
  // getBestCurrentHat, bounded by its own class rather than by line prefixes.
  const cls = src.indexOf("  class DefaultHat {");
  const hat = src.slice(src.indexOf("getBestCurrentHat() {", cls), src.indexOf("  class SafeWalk {", cls));
  const iAngelIdle = hat.indexOf("if (beAngel) return 48;");
  const iCowboyIdle = hat.indexOf("if (this.canWearCowboy()) return 5;");
  check("the halo is checked before cowboy when standing still", iAngelIdle > 0 && iAngelIdle < iCowboyIdle,
        "angel@" + iAngelIdle + " cowboy@" + iCowboyIdle);
  const iAngelMove = hat.lastIndexOf("if (beAngel) {");
  const iCowboyMove = hat.lastIndexOf("if (this.canWearCowboy()) {");
  check("and before cowboy when moving", iAngelMove > 0 && iAngelMove < iCowboyMove,
        "angel@" + iAngelMove + " cowboy@" + iCowboyMove);
  check("still bots only", /const beAngel = !this\.client\.isOwner/.test(src));
}

// ═══════════════════════════════════════════════════════════════════════════
head(7, "Autoheal — the shame window");
{
  check("the routine top-up waits out the 120ms shame window",
        /const quiet = this\.isSaveHealTick\(\) && this\.isSaveHealTime\(\);/.test(src),
        "isSaveHealTime is 125ms with ping allowed for");
  check("the emergency heal deliberately does not wait",
        /\(healing && shameCount < 7\) \|\| quiet/.test(src));
  check("food already in flight is not paid for twice",
        /const inFlight = this\._healsInFlight\(ModuleHandler\);/.test(src));
  check("and a tick with nothing left to send does nothing",
        /if \(needTimes === 0\) \{\s*\n\s*return;/.test(src));

  // RYN's own shame model, which is what the guard is written against.
  const model = span(find("    updateHealth(health) {"), find("    updateHealth(health) {") + 40);
  check("RYN raises shame under 120ms and lowers it over",
        /if \(step <= 120\) \{[\s\S]{0,80}shameCount \+= 1/.test(model) && /shameCount -= 2/.test(model),
        "step <= 120 → +1, else → -2");
}

// ═══════════════════════════════════════════════════════════════════════════
head(8, "Safe Soldier no longer depends on Anti Enemy");
{
  check("the block is entered on owning soldier alone", /if \(_canSoldier\) \{/.test(src));
  check("anti-enemy now only gates its own two tests",
        /_isClose = Settings_default\._antienemy && _dist <= _atkRange/.test(src) &&
        /if \(Settings_default\._antienemy && _isDanger \|\| _isClose \|\| _safeSoldier\)/.test(src));
}

// ═══════════════════════════════════════════════════════════════════════════
head(9, "Auto Place / Preplace / Replace still untouched");
{
  const base = fs.readFileSync(__dirname + "/../src/RYN_Client_v5.3.js", "utf8");
  const slice = t => t.slice(t.indexOf("  const LUNA_SPIKE_TYPE"), t.indexOf("  const AutoPlacer_default = AutoPlacer;"));
  check("the placer is byte-identical to stock v5.3", slice(src) === slice(base), slice(src).split("\n").length + " lines");
}

console.log("\n" + "=".repeat(58));
console.log(`  ${pass} passed, ${fail} failed`);
console.log("=".repeat(58));
process.exit(fail > 0 ? 1 : 0);
