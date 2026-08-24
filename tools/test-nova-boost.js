// Checks the Nova Boost additions in YoRHa_System_replace_falcon.user.js.
//
// The two pure helpers are lifted out of the userscript itself rather than
// copied here, so this fails if the file drifts. Everything else is asserted
// against the file's own source text.
//
// Run: node tools/test-nova-boost.js

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "YoRHa_System_replace_falcon.user.js");
const src = fs.readFileSync(FILE, "utf8");

let failures = 0;
function ok(name, cond, detail) {
    if (cond) { console.log("  pass  " + name); return; }
    failures++;
    console.log("  FAIL  " + name + (detail ? "  -- " + detail : ""));
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps === undefined ? 1e-9 : eps); }

function lift(name) {
    const start = src.indexOf("function " + name + "(");
    if (start < 0) throw new Error("not found in userscript: " + name);
    let depth = 0, i = src.indexOf("{", start), j = i;
    for (; j < src.length; j++) {
        if (src[j] === "{") depth++;
        else if (src[j] === "}" && --depth === 0) { j++; break; }
    }
    return src.slice(start, j);
}

// --- stubs matching the userscript's own UTILS -------------------------------
const UTILS = {
    getDistance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    getAngleDist: (a, b) => {
        const p = Math.abs(b - a) % (Math.PI * 2);
        return p > Math.PI ? Math.PI * 2 - p : p;
    }
};
let nearestEnemy = null;

eval(lift("novaEnemyStep"));
eval(lift("novaLookahead"));

// objectManager writes xVel = x2 * 2 - lastX, i.e. next tick's POSITION.
// A player at (7000, 7000) who moved +24 on x last tick therefore carries
// x2 = 7000, xVel = 7024.
function enemyAt(x, y, dx, dy) {
    return { x2: x, y2: y, xVel: x + dx, yVel: y + dy };
}

console.log("novaEnemyStep — reads the step, not the coordinate");
nearestEnemy = enemyAt(7000, 7000, 24, 0);
ok("walking player reads 24 u/tick", near(novaEnemyStep(), 24));
nearestEnemy = enemyAt(7000, 7000, 0, 0);
ok("standing player reads 0", near(novaEnemyStep(), 0));
nearestEnemy = enemyAt(120, 340, 3, 4);
ok("diagonal step is the hypotenuse", near(novaEnemyStep(), 5));
nearestEnemy = null;
ok("no enemy reads 0", novaEnemyStep() === 0);

console.log("\nnovaLookahead — varies across the real speed range");
ok("standing -> floor 200", near(novaLookahead(0), 200));
ok("walking (24) -> 272", near(novaLookahead(24), 272));
ok("boosted (35) -> capped 300", near(novaLookahead(35), 300));
ok("cap holds above 100/3", near(novaLookahead(1000), 300));
ok("strictly increasing under the cap", novaLookahead(10) < novaLookahead(20));
ok("stays inside Novastorm's [200,300] band",
   novaLookahead(0) >= 200 && novaLookahead(1e6) <= 300);

console.log("\nthe input bug this avoids");
// Novastorm: enemySpeed = sqrt(xVel^2 + yVel^2) over fields that hold a map
// coordinate, then LOOKAHEAD = 200 + min(speed * 10, 100).
const novastormSpeed = (e) => Math.hypot(e.xVel, e.yVel);
const novastormLookahead = (e) => 200 + Math.min(novastormSpeed(e) * 10, 100);
const still = enemyAt(7000, 7000, 0, 0);
const sprinting = enemyAt(7000, 7000, 35, 0);
ok("Novastorm's term is pinned at the cap for a standing player",
   near(novastormLookahead(still), 300), "got " + novastormLookahead(still));
ok("...and identical for a sprinting one (the term never varies)",
   near(novastormLookahead(still), novastormLookahead(sprinting)));
nearestEnemy = still;
const ourStill = novaLookahead(novaEnemyStep());
nearestEnemy = sprinting;
const ourSprinting = novaLookahead(novaEnemyStep());
ok("ours separates the two cases", ourStill === 200 && ourSprinting === 300,
   ourStill + " vs " + ourSprinting);
// Novastorm's enemyFuture = x2 + xVel * 2 lands ~3x off a 14400 map.
ok("Novastorm's path ray leaves the map", still.x2 + still.xVel * 2 > 14400);
ok("ours steps 2 ticks from the enemy",
   near(sprinting.x2 + (sprinting.xVel - sprinting.x2) * 2, 7070));

console.log("\nsecond-spike angle rule — wrapped, not raw");
const RULE = 1.2;
ok("0.1 and 6.1 rad are 0.28 apart, so no second spike",
   UTILS.getAngleDist(0.1, 6.1) <= RULE);
ok("raw subtraction would have queued it", Math.abs(0.1 - 6.1) > RULE);
ok("genuinely opposed angles still qualify",
   UTILS.getAngleDist(0, Math.PI) > RULE);
ok("adjacent 5deg steps never qualify",
   UTILS.getAngleDist(0, (2 * Math.PI) / 72) <= RULE);

console.log("\nsource-level guarantees");
ok("preplacer lookahead falls back to 222/35 with the boost off",
   /novaOn \? novaLookahead\(enemyStep\) : 222/.test(src) &&
   /const START_OFFSET = novaOn \? 30 : 35;/.test(src));
ok("autoplacer falls back the same way",
   /novaOn \? novaLookahead\(novaEnemyStep\(\)\) : 222/.test(src));
ok("path test starts false, so both priorities read as before",
   /let spikeWillBlockEnemyPath = false;/.test(src));
ok("path test is gated on the boost AND a real step",
   /if \(novaOn && enemyStep > 4\)/.test(src));
ok("second spike is budgeted against the replacer's packet ceiling",
   /packets \+ 2 \* FR_PACKETS_PER_PLACE <= FR_PACKET_CEIL/.test(src));
ok("second spike only fires when the first one was the spike sweep's",
   /novaSpikes && findAngle === novaSpikes\[0\]/.test(src));
ok("at most one extra spike per preplace (break, not continue)",
   /addPredictObject\(novaSpikes\[i\]\.id, novaSpikes\[i\]\.angle, true\);\s*\n\s*break;/.test(src));
ok("toggle defaults off", /novaBoost: false,/.test(src));
ok("toggle is in the Preplacer menu section", /id: "novaBoost"/.test(src));

console.log(failures ? "\n" + failures + " check(s) failed" : "\nall checks passed");
process.exit(failures ? 1 : 0);
