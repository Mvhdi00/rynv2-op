#!/usr/bin/env node
// Logic check for the BOT WORLD block in novastorm_1.4_ryn.user.js — the small
// per-bot model that stands in for RYN's PlayerClient managers.
//
// The block is lifted out of the userscript by text and fed the same packet
// shapes the game sends, with the same field layouts the master parses.
//
//   node tools/test-bot-world.js

const fs = require('fs');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', 'novastorm_1.4_ryn.user.js');
const src = fs.readFileSync(SCRIPT, 'utf8');

const start = src.indexOf('        function NovaBotWorld(bot) {');
const end = src.indexOf('        // =====================================================================\n        // BOTS — CONNECTION');
if (start < 0 || end < 0) throw new Error('bot world block not found');
const block = src.slice(start, end);

let failed = 0;
function check(name, got, want) {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);
}

// stubs for the two things the world reaches outside itself
const ours = new Set();
const NovaBots = { isOurs: (sid, name) => ours.has(sid) || ours.has(name) };
const myPlayer = { sid: 1 };

const NovaBotWorld = new Function('NovaBots', 'myPlayer', `${block}\nreturn NovaBotWorld;`)(NovaBots, myPlayer);

const world = NovaBotWorld({ name: 'nova1' });
world.self.sid = 10;

// --- "a": the tick packet, 13 fields per player -----------------------------
console.log('-- players --');

// sid, x, y, dir, buildIndex, weaponIndex, weaponVariant, team, isLeader, skin, tail, icon, zIndex
const tickPacket = [
    10, 100, 100, 0, -1, 0, 0, 'RYN', 0, 0, 0, 0, 0,   // the bot itself
    20, 400, 100, 0, -1, 5, 2, null, 0, 0, 0, 0, 0,    // an enemy, no clan
    30, 150, 100, 0, -1, 0, 0, 'RYN', 0, 0, 0, 0, 0,   // a clanmate
    40, 900, 900, 0, -1, 0, 0, 'OTHER', 0, 0, 0, 0, 0  // another clan, far off
];
world.feedPlayers(tickPacket);

check('every player in the packet is tracked', world.players.size, 4);
check('the bot reads its own row', [world.self.x, world.self.y, world.self.team], [100, 100, 'RYN']);
check('a clanmate is not an enemy', world.enemies().map(p => p.sid).sort(), [20, 40]);
check('the nearest enemy is the nearest one', world.nearestEnemy().sid, 20);
check('distance is measured from the bot', Math.round(world.distanceTo({ x: 400, y: 100 })), 300);
check('angle is measured from the bot', Math.round(world.angleTo({ x: 200, y: 100 }) * 100) / 100, 0);

// our own crew never counts as an enemy, whatever clan they are in
ours.add(40);
check('our own bots are excluded even in another clan', world.enemies().map(p => p.sid), [20]);
ours.delete(40);

// players missing from a tick are out of view and must not linger
world.feedPlayers([
    10, 100, 100, 0, -1, 0, 0, 'RYN', 0, 0, 0, 0, 0,
    20, 380, 100, 0, -1, 5, 2, null, 0, 0, 0, 0, 0
]);
check('players absent from a tick are dropped', [...world.players.keys()].sort((a, b) => a - b), [10, 20]);
check('the survivor is updated, not duplicated', world.players.get(20).x, 380);

// --- "D" / "E" / "O" --------------------------------------------------------
console.log('\n-- names and health --');

// id, sid, name, x, y, dir, health, maxHealth, scale, skinColor
world.feedPlayerData(['sock-7', 20, 'enemyGuy', 380, 100, 0, 100, 100, 35, 0]);
check('"D" fills in the name', world.players.get(20).name, 'enemyGuy');

world.feedHealth(20, 55);
check('"O" updates that player\'s health', world.players.get(20).health, 55);

world.feedHealth(10, 70);
check('"O" on the bot updates its own health', world.self.health, 70);

world.removePlayerById('sock-7');
check('"E" removes by socket id, not sid', world.players.has(20), false);

// --- "H" / "Q" / "R": objects ----------------------------------------------
console.log('\n-- objects --');

// sid, x, y, dir, scale, type, id, owner   (owner -1 means a resource)
world.feedObjects([
    101, 120, 100, 0, 50, 0, -1, -1,     // tree, right next to the bot
    102, 600, 100, 0, 60, 2, -1, -1,     // stone, further off
    103, 130, 130, 0, 35, 0, 4, 20,      // an enemy spike (owned)
    104, 4000, 4000, 0, 50, 3, -1, -1    // gold, far away
]);

check('objects are tracked', world.objects.size, 4);
check('resources exclude anything owned', world.resourcesNear(null, 700).map(r => r.object.sid), [101, 102]);
check('a resource type can be asked for', world.resourcesNear(2, 700).map(r => r.object.sid), [102]);
check('range is respected', world.resourcesNear(3, 700).length, 0);
check('blockers come back nearest first', world.blockersNear(200).map(b => b.object.sid), [101, 103]);

world.removeObject(101);
check('"Q" removes one object', world.objects.has(101), false);

world.removeObjectsOf(20);
check('"R" removes every object of one owner', world.objects.has(103), false);
check('other owners are untouched', world.objects.size, 2);

// --- "N": the bot's own counters -------------------------------------------
console.log('\n-- own values --');

world.feedValue('wood', 250);
world.feedValue('points', 1200);
world.feedValue('age', 6);
check('resources land on the bot itself', [world.self.wood, world.self.points, world.self.age], [250, 1200, 6]);

world.feedValue('nonsense', 5);
check('an unknown value is ignored', world.self.nonsense, undefined);

// --- the bot's own player, shaped like the master's myPlayer ---------------
console.log('\n-- self as a full player --');
const w2 = NovaBotWorld({ name: 'nova2' });
w2.self.sid = 10;

// two ticks so velocity (x2*2 - lastX) has a previous frame to work from
w2.feedPlayers([10, 100, 100, 0, 2, 5, 3, 'RYN', 0, 7, 0, 0, 0]);
w2.feedPlayers([10, 120, 100, 0, 2, 5, 3, 'RYN', 0, 7, 0, 0, 0]);

check('x2/y2 are the server position', [w2.self.x2, w2.self.y2], [120, 100]);
check('xVel is the one-tick-ahead point the master predicts', [w2.self.xVel, w2.self.yVel], [140, 100]);
check('weapon index and variant are tracked', [w2.self.weaponIndex, w2.self.weaponVariant], [5, 3]);
check('the variant lands in the per-weapon table', w2.self.weaponVariants[5], 3);
check('build index and skin are tracked', [w2.self.buildIndex, w2.self.skinIndex], [2, 7]);

w2.feedItemCount(3, 7);
check('"S" fills the bot\'s item counts', w2.self.itemCounts[3], 7);

// enemies carry x2/xVel too, so a bot aims like the master
w2.feedPlayers([
    10, 120, 100, 0, 2, 5, 3, 'RYN', 0, 7, 0, 0, 0,
    50, 300, 100, 0, -1, 0, 0, null, 0, 0, 0, 0, 0
]);
w2.feedPlayers([
    10, 120, 100, 0, 2, 5, 3, 'RYN', 0, 7, 0, 0, 0,
    50, 320, 100, 0, -1, 0, 0, null, 0, 0, 0, 0, 0
]);
const foe = w2.nearestEnemy();
check('an enemy has a predicted position', [foe.x2, foe.xVel], [320, 340]);

// --- death ------------------------------------------------------------------
console.log('\n-- death --');
world.reset();
check('dying clears what it could see', [world.players.size, world.objects.size, world.self.health], [0, 0, 100]);
check('nearest enemy on an empty world is nothing', world.nearestEnemy(), null);

console.log(failed ? `\n${failed} failing case(s)` : '\nall cases pass');
process.exit(failed ? 1 : 0);
