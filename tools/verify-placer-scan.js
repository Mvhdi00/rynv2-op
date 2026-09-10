// Unit tests against the real AutoPlacer class, lifted out of the client and
// instantiated on stubs. Covers the two behaviour changes that are not the
// aperture swap: resolution selection, and the wrap seam in perfect-angle
// detection.

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "Ryn_Type_2.user.js");
const lines = fs.readFileSync(SRC, "utf8").split("\n");

function lift(header, closer) {
  const start = lines.findIndex(l => l === header);
  if (start === -1) throw new Error("not found: " + header);
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i] === closer) return lines.slice(start, i + 1).join("\n");
  }
  throw new Error("end not found: " + header);
}

const RPE_EPS = 1e-6;
const RPE_TAU = Math.PI * 2;
const Config_default = { mapScale: 14400, riverWidth: 724, playerScale: 35 };
const GeometrySolver = new Function("RPE_EPS", "RPE_TAU", "Config_default",
  lift("  const GeometrySolver = {", "  };") + "\n  return GeometrySolver;"
)(RPE_EPS, RPE_TAU, Config_default);

// Constants, read out of the client rather than restated here.
function constant(name) {
  const line = lines.find(l => l.startsWith("  const " + name + " = "));
  if (!line) throw new Error("constant not found: " + name);
  return eval(line.slice(line.indexOf("=") + 1).replace(/;\s*$/, ""));
}
const LUNA_ANGLE_RESOLUTIONS = constant("LUNA_ANGLE_RESOLUTIONS");
const LUNA_ANGLE_STEPS_DEFAULT = constant("LUNA_ANGLE_STEPS_DEFAULT");

const Settings_default = { _autoplacerResolution: 72 };
const Items = [];
Items[6]  = { id: 6,  scale: 49, placeOffset: -5, itemGroup: 2 };
Items[15] = { id: 15, scale: 50, placeOffset: -5, itemGroup: 5 };

const AutoPlacer = new Function(
  "Items", "Config_default", "Settings_default", "GeometrySolver",
  "LUNA_ANGLE_RESOLUTIONS", "LUNA_ANGLE_STEPS_DEFAULT",
  "SpikeOpportunity",
  lift("  class AutoPlacer {", "  }") + "\n  return AutoPlacer;"
)(Items, Config_default, Settings_default, GeometrySolver,
  LUNA_ANGLE_RESOLUTIONS, LUNA_ANGLE_STEPS_DEFAULT,
  { reset() {} });

let failures = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${ok ? "" : `  expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
}

// --- harness ----------------------------------------------------------------
let tick = 0;
function makePlacer(objects) {
  const client = {
    _ModuleHandler: {
      get tickCount() { return tick; },
      // No engine: forces the _canPlace fallback, which is what these tests
      // want to exercise for the seam.
      staticModules: {}
    }
  };
  const p = new AutoPlacer(client);
  const ObjectManager = {
    objects: new Map(objects.map((o, i) => [i, o])),
    grid2D: {
      // A grid that hands back everything, so the fallback path is exercised
      // without a spatial index in the way.
      query(x, y, search, cb) {
        for (const id of ObjectManager.objects.keys()) if (cb(id)) return true;
        return false;
      }
    }
  };
  return { p, ObjectManager };
}
const myPlayer = { getItemCount: () => ({ count: 0, limit: 0 }) };
const ORIGIN = { x: 7000, y: 4000 };

// --- resolution selection ---------------------------------------------------
// The setting is the rate, flat. There is no escalation ladder: sampling is
// 0.0007ms at 36 against 0.0021ms at 144 on top of a 0.0059ms aperture solve,
// so the coarser rung saves nothing worth the builds it drops.
console.log("\nresolution selection");
{
  const { p } = makePlacer([]);
  for (const steps of LUNA_ANGLE_RESOLUTIONS) {
    Settings_default._autoplacerResolution = steps;
    check(`${steps} -> ${steps}, every tick`, p._resolutionFor(), steps);
  }
  Settings_default._autoplacerResolution = 999;
  check("above the top rung clamps down", p._resolutionFor(), 144);
  Settings_default._autoplacerResolution = 50;
  check("between rungs snaps down", p._resolutionFor(), 36);
  Settings_default._autoplacerResolution = 1;
  check("below the bottom rung takes the bottom", p._resolutionFor(), 36);
  delete Settings_default._autoplacerResolution;
  check("missing setting falls back to the default", p._resolutionFor(), LUNA_ANGLE_STEPS_DEFAULT);
  Settings_default._autoplacerResolution = "144";
  check("string off the <select> is accepted", p._resolutionFor(), 144);
  Settings_default._autoplacerResolution = NaN;
  check("unreadable value takes the bottom rung", p._resolutionFor(), 36);
  Settings_default._autoplacerResolution = 72;
}

// --- wrap seam --------------------------------------------------------------
// One blocker parked so that the blocked arc sits strictly inside the table and
// the placeable run therefore wraps through angle 0. Luna's loop never compares
// the last entry with the first, so both ends of that run went unmarked.
console.log("\nperfect angles across the wrap seam");
{
  const ringR = 35 + Items[6].scale + Items[6].placeOffset;
  // Blocker opposite angle 0, wide enough to close a contiguous arc there.
  const blocker = {
    pos: { current: { x: ORIGIN.x - ringR, y: ORIGIN.y } },
    placementScale: 60
  };
  const { p, ObjectManager } = makePlacer([blocker]);
  tick = 1;
  p._steps = 72;
  const angles = p._getPrePlaceAngles(6, ORIGIN, myPlayer, ObjectManager, null);

  check("table length", angles.length, 72);
  const placeable = angles.filter(a => a.placeable).length;
  const perfect = angles.filter(a => a.perfect).length;
  console.log(`        ${placeable} placeable, ${perfect} perfect`);

  // Exactly one contiguous blocked arc means exactly one run, so exactly two
  // run ends — and with the run wrapping, both live at the seam.
  check("one wrapping run has two marked ends", perfect, 2);
  check("angle 0 is inside the run", angles[0].placeable, true);

  // The ends must be the entries either side of the blocked arc.
  const idx = angles.map((a, i) => a.perfect ? i : -1).filter(i => i !== -1);
  const blockedIdx = angles.map((a, i) => a.placeable ? -1 : i).filter(i => i !== -1);
  const firstBlocked = blockedIdx[0], lastBlocked = blockedIdx[blockedIdx.length - 1];
  check("marked ends bracket the blocked arc",
        idx, [ firstBlocked - 1, lastBlocked + 1 ].sort((a, b) => a - b));
}

// A run that does not wrap must be marked exactly as Luna marked it.
console.log("\nperfect angles on a run that does not wrap");
{
  const ringR = 35 + Items[6].scale + Items[6].placeOffset;
  const blocker = {
    pos: { current: { x: ORIGIN.x + ringR, y: ORIGIN.y } },  // sits on angle 0
    placementScale: 60
  };
  const { p, ObjectManager } = makePlacer([blocker]);
  tick = 2;
  p._steps = 72;
  const angles = p._getPrePlaceAngles(6, ORIGIN, myPlayer, ObjectManager, null);
  check("angle 0 is blocked", angles[0].placeable, false);
  check("still exactly two run ends", angles.filter(a => a.perfect).length, 2);
}

// --- resolution actually changes the table ----------------------------------
console.log("\nresolution");
{
  for (const steps of LUNA_ANGLE_RESOLUTIONS) {
    const { p, ObjectManager } = makePlacer([]);
    tick = 10 + steps;
    p._steps = steps;
    const angles = p._getPrePlaceAngles(6, ORIGIN, myPlayer, ObjectManager, null);
    check(`${steps} steps produces ${steps} entries`, angles.length, steps);
    check(`${steps} steps spans the circle`,
          Math.abs(angles[angles.length - 1].angle - (RPE_TAU - RPE_TAU / steps)) < 1e-9, true);
  }
}

console.log(failures === 0 ? "\nPASS" : `\nFAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
