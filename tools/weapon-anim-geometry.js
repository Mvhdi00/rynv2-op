#!/usr/bin/env node
/*
 * weapon-anim-geometry.js
 *
 * Where each weapon and each hand circle actually lands, for every keyframe of
 * every profile. This is the tool the grip numbers were derived with: the
 * sprite art is not available to read, but the sprite boxes are, and the
 * bundle's own attack settles which end of the box is the business end, so the
 * geometry can be computed rather than guessed.
 *
 * check-weapon-anim.js asserts the invariants; this prints the numbers behind
 * them, for retuning a profile by construction instead of by eye.
 *
 *   node tools/weapon-anim-geometry.js [path/to/client.js]
 *
 * Frame: +X is the attack direction, +Y is the player's right, body radius 35.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_PATH = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "Ryn_Type_2.user.js");
const client = fs.readFileSync(CLIENT_PATH, "utf8");
const START = "  /* Easing ids";
const END = "  const WeaponAnimation_default = WeaponAnimation;";
const src = client.slice(client.indexOf(START), client.indexOf(END) + END.length);
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const WA = new Function("clamp", src + "\nreturn WeaponAnimation_default;")(clamp);

/* Sprite boxes from src/game_index.js: length (x) by width (y), centred at
 * (35 + xOff, yOff). Where width > length the long axis is +Y. */
const GEO = [
  { name: "tool hammer",       len: 140, wid: 140, xOff: -3, yOff: 18 },
  { name: "hand axe",          len: 140, wid: 140, xOff: 3,  yOff: 24 },
  { name: "great axe",         len: 140, wid: 140, xOff: -8, yOff: 25 },
  { name: "short sword",       len: 130, wid: 210, xOff: -8, yOff: 46 },
  { name: "katana",            len: 130, wid: 210, xOff: -8, yOff: 59 },
  { name: "polearm",           len: 130, wid: 210, xOff: -8, yOff: 53 },
  { name: "bat",               len: 110, wid: 180, xOff: -8, yOff: 53 },
  { name: "daggers",           len: 110, wid: 110, xOff: 18, yOff: 0 },
  { name: "stick",             len: 140, wid: 140, xOff: 3,  yOff: 24 },
  { name: "hunting bow",       len: 120, wid: 120, xOff: -6, yOff: 0 },
  { name: "great hammer",      len: 140, wid: 140, xOff: -9, yOff: 25 },
  { name: "wooden shield",     len: 120, wid: 120, xOff: 6,  yOff: 0 },
  { name: "crossbow",          len: 120, wid: 120, xOff: -4, yOff: 0 },
  { name: "repeater crossbow", len: 120, wid: 120, xOff: -4, yOff: 0 },
  { name: "mc grabby",         len: 130, wid: 210, xOff: -8, yOff: 53 },
  { name: "musket",            len: 205, wid: 205, xOff: 25, yOff: 0 },
];
for (const g of GEO) {
  g.cx = 35 + g.xOff;
  g.cy = g.yOff;
  g.long = g.wid > g.len;
  g.half = (g.long ? g.wid : g.len) / 2;
}

const f = (n, w = 6) => n.toFixed(1).padStart(w);
const r = (x, y) => Math.hypot(x, y);
const deg = a => a * 180 / Math.PI;

/* Reproduces the module's own transform for one keyframe index. */
function frame(p, k) {
  const rot = p["r" + k], reach = p["d" + k], lat = p["l" + k];
  const slide = p["g" + k], sep = p["s" + k];
  const c = Math.cos(rot), s = Math.sin(rot);
  const R = (x, y) => [x * c - y * s, x * s + y * c];
  const [sfx, sfy] = R(p.cha, p.sha);
  const dx = 1 + (sfx - 1) * p.thrust;
  const dy = sfy * p.thrust;
  const ax = p.gripX + reach * dx - lat * dy;
  const ay = p.gripY + reach * dy + lat * dx;
  const at = (along, across) => {
    const [x, y] = R(along * p.cha - across * p.sha, along * p.sha + across * p.cha);
    return [ax + x, ay + y];
  };
  return {
    anchor: [ax, ay],
    h1: at(p.h1d - slide, p.h1p),
    h2: p.hands === 2 ? at(p.h2d - slide - sep, p.h2p) : [p.freeX + (p.restAX - ax) * p.freeSwing,
                                                         p.freeY + (p.restAY - ay) * p.freeSwing],
    shaftAngle: Math.atan2(sfy, sfx),
    at: at,
  };
}

const STAGE = ["idle", "wind", "hit ", "foll"];
let worst = 0;
for (let id = 0; id < 16; id++) {
  const p = WA._table[id];
  const g = GEO[id];
  const tipD = (g.long ? g.cy + g.half : g.half) - (g.long ? p.gripY : 0);
  console.log(`\n== ${String(id).padStart(2)} ${g.name}  [${p.hands === 2 ? "two" : "one"}-hand, ${p.motion}]`);
  if (p.plain) {
    console.log("   left on the bundle's own draw: sprite at (" + g.cx + ", " + g.cy + "), vanilla hands, vanilla swing");
    continue;
  }
  console.log(`   shaft ${f(deg(Math.atan2(p.sha, p.cha)), 5)}deg in sprite frame, pivot (${p.gripX}, ${p.gripY}),` +
              ` grip at ${p.h1d}${p.hands === 2 ? " and " + p.h2d : ""} along it`);
  const angles = [];
  for (let k = 0; k < 4; k++) {
    const o = frame(p, k);
    const tip = o.at(tipD, 0);
    angles.push(o.shaftAngle);
    console.log(`   ${STAGE[k]}  h1 (${f(o.h1[0])},${f(o.h1[1])}) r=${f(r(...o.h1))}` +
                `   h2 (${f(o.h2[0])},${f(o.h2[1])}) r=${f(r(...o.h2))}` +
                `   span ${f(r(o.h1[0] - o.h2[0], o.h1[1] - o.h2[1]), 5)}` +
                `   tip r=${f(r(...tip))} @${f(deg(Math.atan2(tip[1], tip[0])), 6)}deg`);
    worst = Math.max(worst, r(...o.h1), r(...o.h2));
  }
  const arc = Math.max(...angles) - Math.min(...angles);
  const span = t => Math.max(p[t + 0], p[t + 1], p[t + 2], p[t + 3]) - Math.min(p[t + 0], p[t + 1], p[t + 2], p[t + 3]);
  console.log(`   shaft arc ${f(deg(arc), 5)}deg + body lean ${f(90 * p.body, 5)}deg` +
              `   drive ${f(span("d"), 5)}  across ${f(span("l"), 5)}  slide ${f(span("g"), 5)}  draw ${f(span("s"), 5)}` +
              `   stages ${p.tW.toFixed(2)}/${p.tH.toFixed(2)}/${p.tHold.toFixed(2)}/${p.tF.toFixed(2)}`);
}
console.log(`\nfurthest any hand gets from the body centre: ${worst.toFixed(1)} (body radius 35)`);
