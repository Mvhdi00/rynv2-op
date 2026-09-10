// Placer scan-resolution and ban verification — pulls the AutoPlacer's ring
// arithmetic straight out of Ryn_Type_2.user.js and runs it against stubs.
//
// Two things it pins down:
//
//   · the scan rate, and how a stored value snaps onto a supported rung
//   · the resend ban, which is the part raising the rate to 144 would
//     otherwise break. A build lands 79 units out and is 49 across, so two
//     sends are the same ground until they are ~36 deg apart — banning the
//     angle alone leaves 14 neighbours at 144 free to re-send the build the
//     server just refused. The tests below hold the ban to the ground.
//
//     node tools/test-placer-ban.js [path/to/Ryn_Type_2.user.js]
const fs = require("fs");
const src = fs.readFileSync(process.argv[2] || __dirname + "/../Ryn_Type_2.user.js", "utf8");

const startMark = "  const LUNA_SPIKE_TYPE = 4;";
const endMark = "\n  const SiegeAnalysis = {";
const start = src.indexOf(startMark);
const end = src.indexOf(endMark);
if (start < 0 || end < 0) throw new Error("markers not found");
const moduleSrc = src.slice(start, end);

// ---- stubs ---------------------------------------------------------------
const hyp = (x, y) => Math.sqrt(x * x + y * y);
const Items = [];
Items[6] = { scale: 49, placeOffset: -5 };   // spikes
Items[15] = { scale: 50, placeOffset: -5 };  // pit trap
const Config_default = { mapScale: 14400, riverWidth: 724, playerScale: 35 };
const Settings_default = { _autoplacerResolution: 144 };
const SpikeOpportunity = { reset() {}, context: () => null, onPath: () => false, score: () => 0 };
const GeometrySolver = { inAperture: () => null };
const PlayerObject = class {};
const getAngleFromBitmask = () => 0;
const IH = () => ({ move: 0 });
const noop = () => {};

const AutoPlacer = new Function(
  "hyp", "Items", "Config_default", "Settings_default", "SpikeOpportunity",
  "GeometrySolver", "PlayerObject", "getAngleFromBitmask", "IH",
  moduleSrc + "\n return AutoPlacer;"
)(hyp, Items, Config_default, Settings_default, SpikeOpportunity, GeometrySolver, PlayerObject, getAngleFromBitmask, IH);

// A grid with nothing in it: every point is free unless a test says otherwise.
function stubClient(objects = []) {
  return {
    _ModuleHandler: { tickCount: 0 },
    ObjectManager: {
      grid2D: {
        cellSize: 100,
        query(x, y, cells, cb) {
          for (const o of objects) if (cb(o.id)) return true;
          return false;
        }
      },
      objects: new Map(objects.map(o => [ o.id, o ]))
    }
  };
}

const SPIKE = 6, TRAP = 15;
const RING = 35 + Items[SPIKE].scale + Items[SPIKE].placeOffset;   // 79
const deg = d => d * Math.PI / 180;

let failures = 0;
function check(name, expected, actual, extra = "") {
  const ok = expected === actual;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — expected ${expected}, got ${actual} ${extra}`);
}

// ---- scan resolution ------------------------------------------------------
{
  const placer = new AutoPlacer(stubClient());
  const at = v => {
    Settings_default._autoplacerResolution = v;
    return placer._resolutionFor();
  };
  check("default scan rate is 144", 144, at(144));
  check("stored 72 is still honoured", 72, at(72));
  check("stored 36 is still honoured", 36, at(36));
  check("a value between rungs snaps down", 72, at(100));
  check("a value above the top rung takes the top", 144, at(400));
  check("a value below the bottom rung takes the bottom", 36, at(1));
  check("select strings work (the menu hands back a string)", 144, at("144"));
  Settings_default._autoplacerResolution = 144;
}

// ---- the ring, and why an angle-keyed ban leaks ---------------------------
{
  const placer = new AutoPlacer(stubClient());
  const cfg = placer._getConfig(SPIKE, { x: 0, y: 0 });
  check("spike ring radius", 79, Math.round(RING));

  // How far one step moves the landing point, per rung.
  const stepChord = steps => 2 * RING * Math.sin(Math.PI / steps);
  check("one step at 36 moves the build 13.8 units", "13.8", stepChord(36).toFixed(1));
  check("one step at 144 moves the build 3.4 units", "3.4", stepChord(144).toFixed(1));

  // Two sends are the same slot while their centres are inside one scale.
  const sameSlotSpan = 2 * Math.asin(Math.min(1, Items[SPIKE].scale / (2 * RING))) * 180 / Math.PI;
  check("the same slot spans ~36 deg of the ring", "36.1", sameSlotSpan.toFixed(1));
  const neighboursInSlot = Math.floor(sameSlotSpan / (360 / 144));
  check("which is 14 neighbouring angles at 144", 14, neighboursInSlot);

  // Ban the ground a send was aimed at, then ask about its neighbours.
  const refused = cfg(deg(0));
  placer._bannedSlots.push({ id: SPIKE, x: refused.x, y: refused.y, r: refused.scale, expires: 100 });

  check("the refused angle itself is banned", true, placer._isBanned(cfg(deg(0))));
  check("one step over at 144 is the same ground, banned", true, placer._isBanned(cfg(deg(2.5))));
  check("one step over at 36 is the same ground, banned", true, placer._isBanned(cfg(deg(10))));
  check("still the same ground at 17.5 deg", true, placer._isBanned(cfg(deg(17.5))));
  check("a different slot at 40 deg is free", false, placer._isBanned(cfg(deg(40))));
  check("the far side of the ring is free", false, placer._isBanned(cfg(deg(180))));

  // The ban is per item: a trap is not the build the server refused.
  const trapCfg = placer._getConfig(TRAP, { x: 0, y: 0 });
  check("a trap on the same ground is not banned", false, placer._isBanned(trapCfg(deg(0))));

  // World-anchored, so walking away from it does not carry the ban along.
  const moved = placer._getConfig(SPIKE, { x: 300, y: 0 });
  check("the ban stays where the server said no, not on my ring", false, placer._isBanned(moved(deg(0))));
}

// ---- expiry ---------------------------------------------------------------
{
  const client = stubClient();
  const placer = new AutoPlacer(client);
  const cfg = placer._getConfig(SPIKE, { x: 0, y: 0 });
  const refused = cfg(0);
  placer._bannedSlots.push({ id: SPIKE, x: refused.x, y: refused.y, r: refused.scale, expires: 18 });
  placer._tick = 18;
  const sweep = () => {
    for (let i = placer._bannedSlots.length - 1; i >= 0; i--) {
      if (placer._tick > placer._bannedSlots[i].expires) placer._bannedSlots.splice(i, 1);
    }
  };
  sweep();
  check("still banned on the last tick of its life", 1, placer._bannedSlots.length);
  placer._tick = 19;
  sweep();
  check("gone the tick after", 0, placer._bannedSlots.length);
  check("and the ground is offered again", false, placer._isBanned(cfg(0)));
}

// ---- _pointFree: the test that decides whether a send landed --------------
{
  const cfgOf = (placer, id) => placer._getConfig(id, { x: 0, y: 0 });

  const empty = new AutoPlacer(stubClient());
  const p = cfgOf(empty, SPIKE)(0);
  check("empty ground reads free", true, empty._pointFree(SPIKE, p.x, p.y, p.scale, empty.client.ObjectManager, null));

  // A build standing on it: the send landed, so nothing is banned.
  const occupied = new AutoPlacer(stubClient([ {
    id: 1,
    pos: { current: { x: RING, y: 0 } },
    placementScale: 49
  } ]));
  check("occupied ground reads taken", false, occupied._pointFree(SPIKE, p.x, p.y, p.scale, occupied.client.ObjectManager, null));

  // The river refuses everything but a platform.
  const river = new AutoPlacer(stubClient());
  const mid = Config_default.mapScale / 2;
  check("the river refuses a spike", false, river._pointFree(SPIKE, 0, mid, 49, river.client.ObjectManager, null));
  check("and takes a platform", true, river._pointFree(18, 0, mid, 49, river.client.ObjectManager, null));
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
