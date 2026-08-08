/*
 * Compare the data tables baked into the Ae86 build against
 * drivers/game-drivers.json (pulled from the shipped bundle).
 *
 * Ae86 keeps its tables inside webpack modules rather than as top-level
 * consts, so this loads those modules directly instead of using
 * tools/verify-drivers.js, which is written against the RYN layout.
 *
 * Drift here does not stop the client connecting — it shows up in game as
 * wrong prices, wrong placement limits, or hats that equip to something else.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const buildPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'Ae86_v10_2_Fixed.user.js');
const built = fs.readFileSync(buildPath, 'utf8');
const game = JSON.parse(fs.readFileSync(path.join(ROOT, 'drivers/game-drivers.json'), 'utf8'));

function loadModule(key, requireStub) {
  const marker = `'${key}': function (`;
  const at = built.indexOf(marker);
  if (at === -1) throw new Error(`module not found: ${key}`);
  const argsEnd = built.indexOf(')', at);
  const args = built.slice(at + marker.length, argsEnd);
  const open = built.indexOf('{', argsEnd);
  let depth = 0, end = -1;
  for (let i = open; i < built.length; i++) {
    if (built[i] === '{') depth++;
    else if (built[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  const sandbox = { console, Math, Date, JSON, Object, Array, String, Number, parseInt, parseFloat };
  sandbox.window = sandbox;
  sandbox.location = { hostname: 'moomoo.io', href: 'https://moomoo.io/' };
  sandbox.document = { getElementById: () => null };
  vm.createContext(sandbox);
  vm.runInContext(`this.__f = function (${args}) ${built.slice(open, end)};`, sandbox);
  const mod = { exports: {} };
  // config.js pulls in the browserify `process` shim to read argv.
  sandbox.__f(mod, mod.exports, requireStub || (() => ({ argv: [], env: {}, nextTick: (f) => f() })));
  return mod.exports;
}

let failures = 0;
const note = [];
function check(name, ok, detail) {
  if (ok) console.log(`  ok    ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

const config = loadModule('./src/js/config.js');
const items = loadModule('./src/js/data/items.js');

console.log(`client : ${path.relative(ROOT, buildPath)}`);
console.log(`game   : drivers/game-drivers.json\n`);

/*
 * Day/night scaling constants the shipped engine added after Ae86 forked.
 * Nothing in the Ae86 build references them (grep the build for any of these
 * and you get zero hits), so carrying them over would be dead weight rather
 * than a fix. Tracked here so the gap stays visible instead of silent.
 */
const UNUSED_BY_AE86 = new Set(['MAX_ATTACK', 'MAX_SPAWN_DELAY', 'MAX_SPEED', 'MAX_TURN_SPEED', 'DAY_INTERVAL']);

console.log('config scalars');
let cfgMismatch = [];
let cfgSkipped = [];
for (const [k, v] of Object.entries(game.config)) {
  if (typeof v !== 'number' && typeof v !== 'string' && typeof v !== 'boolean') continue;
  if (!(k in config)) {
    if (UNUSED_BY_AE86.has(k)) {
      if (built.includes(k)) cfgMismatch.push(`${k}: absent from config but referenced in the build`);
      else cfgSkipped.push(k);
    } else {
      cfgMismatch.push(`${k}: missing in client`);
    }
    continue;
  }
  if (config[k] !== v) cfgMismatch.push(`${k}: client ${JSON.stringify(config[k])} vs game ${JSON.stringify(v)}`);
}
check(`${Object.keys(game.config).length} config keys`, cfgMismatch.length === 0);
for (const m of cfgMismatch) console.log(`        ${m}`);
if (cfgSkipped.length) {
  console.log(`  note  ${cfgSkipped.length} key(s) absent from Ae86 and unreferenced by it: ${cfgSkipped.join(', ')}`);
}

function compareList(label, clientList, gameList, fields) {
  if (!Array.isArray(clientList)) { check(label, false, 'client table missing'); return; }
  if (clientList.length !== gameList.length) {
    check(label, false, `count ${clientList.length} vs ${gameList.length}`);
  }
  const diffs = [];
  const n = Math.min(clientList.length, gameList.length);
  for (let i = 0; i < n; i++) {
    for (const f of fields) {
      const a = clientList[i][f], b = gameList[i][f];
      if (a === undefined && b === undefined) continue;
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        diffs.push(`[${i}] ${gameList[i].name || gameList[i].id || i}.${f}: client ${JSON.stringify(a)} vs game ${JSON.stringify(b)}`);
      }
    }
  }
  check(`${label} (${gameList.length})`, diffs.length === 0 && clientList.length === gameList.length);
  for (const d of diffs.slice(0, 25)) console.log(`        ${d}`);
  if (diffs.length > 25) console.log(`        ... and ${diffs.length - 25} more`);
}

console.log('\ndata tables');
compareList('itemGroups', items.groups, game.itemGroups, ['id', 'name', 'layer', 'limit', 'sandboxLimit', 'place']);
// The extracted item table keys off array position, so it carries no `id`.
compareList('items', items.list, game.items, ['name', 'desc', 'req', 'scale', 'holdOffset', 'placeOffset']);
compareList('weapons', items.weapons, game.weapons, ['id', 'name', 'dmg', 'range', 'scale', 'speed', 'age', 'gather']);
compareList('projectiles', items.projectiles, game.projectiles, ['indx', 'layer', 'src', 'dmg', 'speed', 'scale', 'range']);

const store = loadModule('./src/js/data/store.js');
compareList('hats', store.hats, game.hats, ['id', 'name', 'price', 'scale', 'desc']);
compareList('accessories', store.accessories, game.accessories, ['id', 'name', 'price', 'scale', 'desc']);

console.log('');
if (failures) { console.log(`${failures} table(s) differ from the shipped bundle.`); process.exit(1); }
console.log('All data tables match the shipped bundle.');
