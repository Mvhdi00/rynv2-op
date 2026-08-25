#!/usr/bin/env node
/*
 * test-bot-modules.js
 *
 * Exercises the two bot capability modules the build folds in (BotBuilder and
 * BotShopper) against stub clients, so their gating is checked without a game
 * to run them in.
 *
 * The classes are lifted straight out of the build output rather than
 * re-declared here, so this fails if the build stops producing them. Store
 * prices and item groups come from drivers/game-drivers.json, which means the
 * hat and accessory ids in the buy plan are checked against the shipped game
 * tables too.
 *
 *   node tools/test-bot-modules.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "ReUp_Mix.user.js");
const DRIVERS = JSON.parse(
  fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8")
);

/* ---------- load the modules out of the build ---------- */

const built = fs.readFileSync(OUT, "utf8");
const START = "  const BOT_BUILD_PLAN = [";
const END = "  class ModuleHandler {";
const start = built.indexOf(START);
const end = built.indexOf(END);
if (start === -1 || end === -1 || end < start) {
  throw new Error("could not find the bot capability modules in " + path.relative(ROOT, OUT));
}
const source = built.slice(start, end);

/* Items is only read for `Items[id].itemGroup`; the client indexes it by item
 * id and the drivers dump keeps the same order. */
const Items = DRIVERS.items.map((item, index) => ({ id: index, itemGroup: itemGroupOf(index) }));

function itemGroupOf(id) {
  /* group ids in ItemGroups order, indexed by item id - the mapping the game
   * table carries on each item */
  const groups = [0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 11, 5, 6, 7, 8, 9, 10, 12, 13];
  return groups[id];
}

const STORE = {
  0: DRIVERS.hats,
  1: DRIVERS.accessories,
};
const DataHandler_default = {
  getStore(type) {
    const table = [];
    for (const entry of STORE[type]) table[entry.id] = entry;
    return table;
  },
};

const reverseAngle = angle => Math.atan2(-Math.sin(angle), -Math.cos(angle));

/* The client never normalises the angles it places at - Automill hands
 * `angle +/- offset` straight to place() - so comparisons here go through the
 * same wrap the game does. */
const sameAngle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 1e-6;

let Settings_default = {};
const load = () =>
  new Function(
    "Settings_default",
    "Items",
    "DataHandler_default",
    "reverseAngle",
    source + "\nreturn { BotBuilder, BotShopper, BOT_BUILD_PLAN, BOT_STORE_PLAN };"
  )(new Proxy({}, { get: (_t, key) => Settings_default[key] }), Items, DataHandler_default, reverseAngle);

const { BotBuilder, BotShopper, BOT_STORE_PLAN } = load();

/* ---------- stubs ---------- */

class Vec {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  distance(other) {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }
  angle(other) {
    return Math.atan2(other.y - this.y, other.x - this.x);
  }
}

const MILL_TYPE = 5;

function makeClient(options = {}) {
  const placed = [];
  const bought = { 0: new Set(), 1: new Set() };
  const buys = [];
  const client = {
    isOwner: options.isOwner === true,
    ownerClient: null,
    clients: new Set(),
    myPlayer: {
      inGame: options.inGame !== false,
      isSandbox: options.isSandbox === true,
      isTrapped: options.isTrapped === true,
      tempGold: options.gold || 0,
      pos: { current: new Vec(0, 0) },
      inventory: { 2: 0, 3: 3, 4: 6, 5: 10, 7: options.hasTrap ? 15 : null },
      counts: options.counts || {},
      getItemByType(type) {
        const id = this.inventory[type];
        return id === undefined ? null : id;
      },
      getItemCount(group) {
        return {
          count: this.counts[group] || 0,
          limit: this.isSandbox ? 299 : [30, 30, 15, 7, 1, 6, 12, 2, 12, 4, 1, 2, 3, 2][group],
        };
      },
      canPlace(type) {
        if (options.canPlace === false) return false;
        return this.getItemByType(type) !== null;
      },
      canPlaceObject(type, angle) {
        return options.placeable ? options.placeable(type, angle) : true;
      },
      getPlacePosition(from, id, angle) {
        return new Vec(from.x + Math.cos(angle) * 100, from.y + Math.sin(angle) * 100);
      },
    },
    EnemyManager: {
      nearestEnemy: options.enemy || null,
      detectedEnemy: options.detectedEnemy === true,
      detectedDangerEnemy: false,
    },
    _ModuleHandler: {
      placedOnce: options.placedOnce === true,
      healedOnce: false,
      placeAngles: [null, []],
      moduleActive: false,
      packetCount: options.packetCount || 0,
      packetLimit: 70,
      reverse_move_dir: null,
      bought,
      hasStoreItem: (type, id) => bought[type].has(id),
      place(type, angle) {
        placed.push({ type, angle });
      },
      _buy(type, id) {
        buys.push({ type, id });
      },
    },
  };
  client.ownerClient = options.owner || client;
  client.placed = placed;
  client.buys = buys;
  client.bought = bought;
  return client;
}

function ownerAt(x, y) {
  const owner = makeClient({ isOwner: true });
  owner.myPlayer.pos.current = new Vec(x, y);
  return owner;
}

/* ---------- assertions ---------- */

let failures = 0;
let checks = 0;
function check(name, condition) {
  checks += 1;
  if (condition) {
    console.log("  ok    " + name);
  } else {
    failures += 1;
    console.log("  FAIL  " + name);
  }
}

/* ---------- BotBuilder ---------- */

console.log("BotBuilder");

Settings_default = { _botBuilder: true, _botBuildMills: true, _botBuildLimit: 7 };

{
  const owner = ownerAt(500, 0);
  const bot = makeClient({ owner });
  owner.clients.add(bot);
  const builder = new BotBuilder(bot);
  builder.postTick();
  check("places a windmill with no enemy around", bot.placed.length === 1 && bot.placed[0].type === MILL_TYPE);
  check("marks the tick as used", bot._ModuleHandler.placedOnce === true && bot._ModuleHandler.placeAngles[0] === MILL_TYPE);
  check("builds away from the owner", sameAngle(bot.placed[0].angle, reverseAngle(new Vec(0, 0).angle(owner.myPlayer.pos.current))));
}

{
  const owner = ownerAt(500, 0);
  const bot = makeClient({ owner });
  const builder = new BotBuilder(bot);
  builder.postTick();
  check("waits out its cooldown after placing", bot.placed.length === 1);
  builder.postTick();
  check("still waiting one tick later", bot.placed.length === 1);
  builder.postTick();
  builder.postTick();
  bot._ModuleHandler.placedOnce = false;
  builder.postTick();
  check("places again once the cooldown expires", bot.placed.length === 2);
}

{
  const owner = ownerAt(500, 0);
  const bot = makeClient({ owner, isOwner: true });
  new BotBuilder(bot).postTick();
  check("never runs for the owner", bot.placed.length === 0);
}

{
  const bot = makeClient({ enemy: { pos: { current: new Vec(300, 0) } } });
  new BotBuilder(bot).postTick();
  check("stands down with an enemy inside 500", bot.placed.length === 0);
}

{
  const bot = makeClient({ enemy: { pos: { current: new Vec(900, 0) } } });
  new BotBuilder(bot).postTick();
  check("builds with the nearest enemy far away", bot.placed.length === 1);
}

{
  const bot = makeClient({ detectedEnemy: true, enemy: { pos: { current: new Vec(900, 0) } } });
  new BotBuilder(bot).postTick();
  check("stands down while EnemyManager reports a threat", bot.placed.length === 0);
}

{
  const bot = makeClient({ isTrapped: true });
  new BotBuilder(bot).postTick();
  check("stands down while trapped", bot.placed.length === 0);
}

{
  const bot = makeClient({ placedOnce: true });
  new BotBuilder(bot).postTick();
  check("yields the tick to combat placement", bot.placed.length === 0);
}

{
  const bot = makeClient({ packetCount: 65 });
  new BotBuilder(bot).postTick();
  check("yields when the packet budget is nearly spent", bot.placed.length === 0);
}

{
  const bot = makeClient({ counts: { 3: 7 } });
  new BotBuilder(bot).postTick();
  check("stops at the windmill limit", bot.placed.length === 0);
}

{
  Settings_default = { _botBuilder: true, _botBuildMills: true, _botBuildLimit: 3 };
  const bot = makeClient({ counts: { 3: 3 } });
  new BotBuilder(bot).postTick();
  check("stops at the configured limit below the game cap", bot.placed.length === 0);
  const other = makeClient({ counts: { 3: 2 } });
  new BotBuilder(other).postTick();
  check("builds while under the configured limit", other.placed.length === 1);
}

{
  Settings_default = { _botBuilder: true, _botBuildMills: false, _botBuildLimit: 7 };
  const bot = makeClient({});
  new BotBuilder(bot).postTick();
  check("builds nothing with every building switched off", bot.placed.length === 0);
}

{
  Settings_default = { _botBuilder: false, _botBuildMills: true, _botBuildLimit: 7 };
  const bot = makeClient({});
  new BotBuilder(bot).postTick();
  check("does nothing while the master toggle is off", bot.placed.length === 0);
}

{
  /* every angle blocked by an object except one */
  Settings_default = { _botBuilder: true, _botBuildMills: true, _botBuildLimit: 7 };
  const owner = ownerAt(500, 0);
  const wanted = Math.PI / 2;
  const bot = makeClient({
    owner,
    placeable: (type, angle) => sameAngle(angle, wanted),
  });
  new BotBuilder(bot).postTick();
  check("falls through to the one angle that is free", bot.placed.length === 1 && sameAngle(bot.placed[0].angle, wanted));
}

{
  const owner = ownerAt(500, 0);
  const bot = makeClient({ owner });
  /* the only free angle drops the building on top of the owner */
  bot.myPlayer.pos.current = new Vec(440, 0);
  bot.myPlayer.canPlaceObject = (type, angle) => sameAngle(angle, 0);
  new BotBuilder(bot).postTick();
  check("never drops a building on the owner", bot.placed.length === 0);
}

{
  const owner = ownerAt(2000, 0);
  const bot = makeClient({ owner });
  const sibling = makeClient({ owner });
  sibling.myPlayer.pos.current = new Vec(-100, 0);
  owner.clients.add(bot);
  owner.clients.add(sibling);
  bot.myPlayer.canPlaceObject = (type, angle) => sameAngle(angle, Math.PI);
  new BotBuilder(bot).postTick();
  check("never drops a building on another bot", bot.placed.length === 0);
}

{
  /* spikes and traps are opt-in, and traps need the item in the inventory */
  Settings_default = {
    _botBuilder: true,
    _botBuildMills: false,
    _botBuildSpikes: true,
    _botBuildTraps: true,
    _botBuildLimit: 7,
  };
  const bot = makeClient({});
  new BotBuilder(bot).postTick();
  check("places spikes when asked", bot.placed.length === 1 && bot.placed[0].type === 4);

  const noTrap = makeClient({});
  Settings_default = { _botBuilder: true, _botBuildMills: false, _botBuildSpikes: false, _botBuildTraps: true, _botBuildLimit: 7 };
  new BotBuilder(noTrap).postTick();
  check("skips traps before age 4", noTrap.placed.length === 0);

  const withTrap = makeClient({ hasTrap: true });
  new BotBuilder(withTrap).postTick();
  check("places traps once the item is in the inventory", withTrap.placed.length === 1 && withTrap.placed[0].type === 7);
}

/* ---------- BotShopper ---------- */

console.log("BotShopper");

const priceOf = (type, id) => DataHandler_default.getStore(type)[id].price;

{
  const missing = BOT_STORE_PLAN.filter(([type, id]) => !DataHandler_default.getStore(type)[id]);
  check("every id in the buy plan exists in the shipped store tables", missing.length === 0);
  const free = BOT_STORE_PLAN.filter(([type, id]) => priceOf(type, id) === 0);
  check("nothing in the buy plan is a free item", free.length === 0);
}

Settings_default = { _botAutoBuy: true };

{
  const bot = makeClient({ gold: 4000 });
  const shopper = new BotShopper(bot);
  shopper.postTick();
  check("buys the first affordable item in the plan", bot.buys.length === 1);
  check("that item is the Soldier Helmet", bot.buys[0].type === 0 && bot.buys[0].id === 6);
  shopper.postTick();
  check("throttles the next purchase", bot.buys.length === 1);
}

{
  const bot = makeClient({ gold: 3999 });
  new BotShopper(bot).postTick();
  check("skips what it cannot afford and takes the next thing it can", bot.buys.length === 1 && bot.buys[0].id === 11 && bot.buys[0].type === 1);
}

{
  const bot = makeClient({ gold: 100 });
  new BotShopper(bot).postTick();
  check("buys nothing while broke", bot.buys.length === 0);
}

{
  const bot = makeClient({ gold: 4000 });
  bot.bought[0].add(6);
  new BotShopper(bot).postTick();
  check("skips what it already owns", bot.buys.length === 1 && !(bot.buys[0].type === 0 && bot.buys[0].id === 6));
}

{
  const bot = makeClient({ gold: 4000, isOwner: true });
  new BotShopper(bot).postTick();
  check("never runs for the owner", bot.buys.length === 0);
}

{
  const bot = makeClient({ gold: 4000, isSandbox: true });
  new BotShopper(bot).postTick();
  check("leaves sandbox to the existing AutoBuy", bot.buys.length === 0);
}

{
  const bot = makeClient({ gold: 4000, inGame: false });
  new BotShopper(bot).postTick();
  check("buys nothing while dead", bot.buys.length === 0);
}

{
  Settings_default = { _botAutoBuy: false };
  const bot = makeClient({ gold: 4000 });
  new BotShopper(bot).postTick();
  check("does nothing while switched off", bot.buys.length === 0);
  Settings_default = { _botAutoBuy: true };
}

{
  /* the server never confirms, so `bought` never fills: the retry has to stop */
  const bot = makeClient({ gold: 4000 });
  const shopper = new BotShopper(bot);
  for (let tick = 0; tick < 400; tick++) shopper.postTick();
  const soldier = bot.buys.filter(buy => buy.type === 0 && buy.id === 6).length;
  check("gives up on an item the server keeps rejecting", soldier === 4);
  check("moves on to the rest of the plan after giving up", bot.buys.length > soldier);
}

{
  const bot = makeClient({ gold: 4000, packetCount: 68 });
  new BotShopper(bot).postTick();
  check("yields when the packet budget is nearly spent", bot.buys.length === 0);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
