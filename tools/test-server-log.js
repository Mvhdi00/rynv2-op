// Tests for the Server Log in YoRHa_System.user.js.
//
//   node tools/test-server-log.js [path/to/YoRHa_System.user.js]
//
// ServerLog hooks the packet table rather than any game function: wrap()
// returns the same table with every handler sandwiched between a `before` and
// an `after` pass. That split is not cosmetic — removePlayer splices the player
// out and setPlayerTeam overwrites the old team, so those lines can only be
// read before the handler runs, while addPlayer's name only exists after it.
// Both halves are exercised here through the wrapped table, the way the socket
// calls it, rather than by poking the internals.
//
// The block is lifted out of the shipped userscript, so this always runs
// against what actually ships.
const fs = require('fs');

const SCRIPT = process.argv[2] || (__dirname + '/../YoRHa_System.user.js');
const lines = fs.readFileSync(SCRIPT, 'utf8').split('\n');
const from = lines.findIndex(l => l.trim().startsWith('const ServerLog = {'));
const to = lines.findIndex(l => l.includes('window.ServerLog = ServerLog'));
if (from < 0 || to < 0 || to <= from) {
    console.error('could not find the ServerLog block in ' + SCRIPT);
    process.exit(2);
}
const BLOCK = lines.slice(from, to).join('\n');

// ------------------------------------------------------------------ harness
let players = [];
let myPlayer = null;
function findPlayerBySID(sid) {
    for (const p of players) if (p.sid == sid) return p;
    return null;
}
global.window = { vars: {} };

const ServerLog = eval('(function () {\n' + BLOCK + '\nreturn ServerLog;\n})()');

// The packet table the socket would be given: each handler records that it ran
// and mutates the world the way the real one does, so before/after see the same
// shape they see in the game.
let called = [];
const table = {
    "C": function () { called.push('C'); },
    "D": function (d, isYou) {
        called.push('D');
        let p = findPlayerBySID(d[1]);
        if (!p) { p = { id: d[0], sid: d[1], name: d[2], team: null, health: 100 }; players.push(p); }
        if (isYou) myPlayer = p;
        return 'D-ret';
    },
    "E": function (id) {
        called.push('E');
        players = players.filter(p => p.id != id);
    },
    "a": function (d) { called.push('a'); },
    "O": function (sid, v) { called.push('O'); const p = findPlayerBySID(sid); if (p) p.health = v; },
    "P": function () { called.push('P'); if (myPlayer) myPlayer.alive = false; },
    "g": function (a) { called.push('g'); },
    "1": function (sid) { called.push('1'); },
    "2": function (sid, name) { called.push('2'); },
    "3": function (team, isOwner) { called.push('3'); if (myPlayer) { myPlayer.team = team; myPlayer.isOwner = isOwner; } },
    "4": function (d) { called.push('4'); },
    "6": function (sid, msg) { called.push('6'); },
    "Z": function (n) { called.push('Z'); }
};
const io = ServerLog.wrap(table);

function defaults() {
    return { serverLog: true, logJoins: true, logDeaths: true, logClans: true, logChat: true };
}
// Walk past the join-burst window without waiting on a real clock.
function live() { ServerLog._synced = Date.now() - 1; }
function reset() {
    players = []; myPlayer = null; called = [];
    window.vars = defaults();
    ServerLog.lines.length = 0;
    ServerLog._names = {}; ServerLog._teams = {}; ServerLog._clans = {};
    ServerLog._mates = null; ServerLog._synced = 0; ServerLog._burst = 0;
    window._novaServerLogSink = null;
}
const texts = () => ServerLog.lines.map(l => l.text);
const kinds = () => ServerLog.lines.map(l => l.kind);
const last = () => ServerLog.lines[ServerLog.lines.length - 1];

let pass = 0, fail = 0;
function t(name, fn) {
    try { fn(); console.log('  ok   ' + name); pass++; }
    catch (e) { console.log('  FAIL ' + name + ' -> ' + e.message); fail++; }
}
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function ok(v, m) { if (!v) throw new Error(m || 'expected truthy'); }
function has(sub, m) {
    if (!texts().some(x => x.includes(sub))) throw new Error((m || 'no line contains ') + JSON.stringify(sub) + ' — got ' + JSON.stringify(texts()));
}
function hasnt(sub) {
    if (texts().some(x => x.includes(sub))) throw new Error('did not expect ' + JSON.stringify(sub) + ' — got ' + JSON.stringify(texts()));
}
// A player row as updatePlayers sends it: 13 fields, team at index 7.
function row(sid, team) { return [sid, 0, 0, 0, -1, 0, 0, team, 0, 0, 0, 0, 0]; }

// -------------------------------------------------------------------- tests
console.log('the clock');
reset();
t('every line carries hh:mm:ss', () => {
    live();
    io.D([1, 10, 'kelp'], false);
    ok(/^\d{2}:\d{2}:\d{2}$/.test(last().time), 'got ' + last().time);
});
t('and the raw timestamp, for sorting and export', () => {
    ok(typeof last().t === 'number' && last().t > 0);
});

console.log('\nthe wrapper does not disturb the packet');
t('the real handler still runs', () => {
    reset(); live();
    io.D([1, 10, 'kelp'], false);
    eq(called.join(','), 'D');
    eq(players.length, 1);
});
t('and its return value comes back', () => {
    reset(); live();
    eq(io.D([1, 10, 'kelp'], false), 'D-ret');
});
t('a throw in the logger cannot take a packet down', () => {
    reset(); live();
    const realName = ServerLog.name;
    ServerLog.name = () => { throw new Error('boom'); };
    try {
        io.O(10, 0);
        eq(called.join(','), 'O', 'the handler must still have run');
    } finally { ServerLog.name = realName; }
});
t('every handler in the table is wrapped', () => {
    for (const k in table) ok(io[k] !== table[k], k + ' was passed through unwrapped');
});

console.log('\njoining and leaving');
reset();
t('someone spawning is recorded by name', () => {
    live();
    io.D([1, 10, 'kelp'], false);
    has('kelp spawned');
    eq(last().kind, 'join');
});
t('your own spawn reads as yours', () => {
    reset(); live();
    io.D([2, 20, 'me'], true);
    has('you spawned as me');
});
t('leaving is recorded with the name the join carried', () => {
    reset(); live();
    io.D([1, 10, 'kelp'], false);
    io.E(1);
    has('kelp left');
    eq(last().kind, 'leave');
});
t('a leave after the player object is already gone still names them', () => {
    reset(); live();
    io.D([1, 10, 'kelp'], false);
    // The name has to come from before the splice — this is exactly why the
    // logger has a `before` pass at all.
    eq(players.length, 1);
    io.E(1);
    eq(players.length, 0);
    has('kelp left');
});
t('the world dump you get on joining is not reported as news', () => {
    reset();
    io.C();                     // setupGame opens the burst window
    io.D([1, 10, 'kelp'], false);
    io.D([2, 11, 'reed'], false);
    hasnt('kelp spawned');
    hasnt('reed spawned');
    has('joined the server');
});
t('but their names are learned during it', () => {
    live();
    io.E(1);
    has('kelp left');
});
t('spawns after the window are news again', () => {
    reset();
    io.C(); live();
    io.D([3, 12, 'thorn'], false);
    has('thorn spawned');
});

console.log('\ndeaths');
reset();
t('anyone dropping to zero is recorded', () => {
    live();
    io.D([1, 10, 'kelp'], false);
    io.O(10, 0);
    has('kelp died');
    eq(last().kind, 'death');
});
t('ordinary damage is not', () => {
    reset(); live();
    io.D([1, 10, 'kelp'], false);
    io.O(10, 45);
    hasnt('died');
});
t('your own death is yours', () => {
    reset(); live();
    io.D([2, 20, 'me'], true);
    io.P();
    has('you died');
});

console.log('\nclans');
reset();
t('a clan being created names its owner', () => {
    live();
    io.D([1, 10, 'kelp'], false);
    io.g({ sid: 10, name: 'WOLF' });
    has('kelp created clan «WOLF»');
    eq(last().kind, 'clan');
});
t('a clan being disbanded is named, not numbered', () => {
    io.d = null;
    io['1'](10);
    has('clan «WOLF» was disbanded');
});
t('the clans already on the server come as one line, not fifty', () => {
    reset();
    io.C();
    io.g({ sid: 10, name: 'A' });
    io.g({ sid: 11, name: 'B' });
    io.g({ sid: 12, name: 'C' });
    hasnt('created clan');
    live();
    io.Z(30);                   // any packet after the window flushes the count
    has('3 clan(s) already on the server');
});
t('a join request is recorded', () => {
    reset(); live();
    io['2'](10, 'kelp');
    has('kelp is asking to join your clan');
});
t('you creating, joining and leaving a clan all read differently', () => {
    reset(); live();
    io.D([2, 20, 'me'], true);
    io['3']('WOLF', 1);
    has('you created clan «WOLF»');
    reset(); live();
    io.D([2, 20, 'me'], true);
    io['3']('WOLF', 0);
    has('you joined clan «WOLF»');
    io['3'](null, 0);
    has('you left clan «WOLF»');
});
t('your own clan roster is diffed, so members are named', () => {
    reset(); live();
    io['4']([10, 'kelp', 11, 'reed']);       // first roster: the baseline
    eq(texts().length, 0, 'the first roster is not news');
    io['4']([10, 'kelp', 11, 'reed', 12, 'thorn']);
    has('thorn joined your clan');
    io['4']([10, 'kelp', 12, 'thorn']);
    has('reed left your clan');
});

console.log('\nclan changes anywhere on the server, off updatePlayers');
reset();
t('a first sighting of a team is not a join', () => {
    live();
    io.D([1, 10, 'kelp'], false);
    io.a([].concat(row(10, 'WOLF')));
    hasnt('joined clan');
});
t('a team that changes is', () => {
    io.a([].concat(row(10, 'BEAR')));
    has('kelp joined clan «BEAR»');
});
t('a team that clears is a leave, and names the clan they left', () => {
    io.a([].concat(row(10, null)));
    has('kelp left clan «BEAR»');
});
t('a team that stays put says nothing', () => {
    reset(); live();
    io.D([1, 10, 'kelp'], false);
    io.a([].concat(row(10, 'WOLF')));
    const n = texts().length;
    io.a([].concat(row(10, 'WOLF')));
    io.a([].concat(row(10, 'WOLF')));
    eq(texts().length, n);
});
t('your own clan change is left to the packet that reports it properly', () => {
    reset(); live();
    io.D([2, 20, 'me'], true);
    io.a([].concat(row(20, null)));
    io.a([].concat(row(20, 'WOLF')));
    hasnt('joined clan «WOLF»');
});
t('several players in one packet are all caught', () => {
    reset(); live();
    io.D([1, 10, 'kelp'], false);
    io.D([2, 11, 'reed'], false);
    io.a([].concat(row(10, null), row(11, null)));
    io.a([].concat(row(10, 'WOLF'), row(11, 'BEAR')));
    has('kelp joined clan «WOLF»');
    has('reed joined clan «BEAR»');
});

console.log('\nchat');
reset();
t('chat is recorded by name', () => {
    live();
    io.D([1, 10, 'kelp'], false);
    io['6'](10, 'hello');
    has('kelp: hello');
    eq(last().kind, 'chat');
});
t('an unknown sid falls back to the sid rather than dropping the line', () => {
    reset(); live();
    io['6'](77, 'hi');
    has('sid 77: hi');
});

console.log('\nthe toggles');
t('recording off records nothing', () => {
    reset(); live();
    window.vars.serverLog = false;
    io.D([1, 10, 'kelp'], false);
    io['6'](10, 'hello');
    io.O(10, 0);
    eq(ServerLog.lines.length, 0);
});
t('chat off still keeps joins', () => {
    reset(); live();
    window.vars.logChat = false;
    io.D([1, 10, 'kelp'], false);
    io['6'](10, 'hello');
    has('kelp spawned');
    hasnt('hello');
});
t('joins off still keeps deaths', () => {
    reset(); live();
    window.vars.logJoins = false;
    io.D([1, 10, 'kelp'], false);
    io.O(10, 0);
    hasnt('spawned');
    has('kelp died');
});
t('clans off silences every clan line', () => {
    reset(); live();
    window.vars.logClans = false;
    io.D([1, 10, 'kelp'], false);
    io.g({ sid: 10, name: 'WOLF' });
    io['2'](10, 'kelp');
    io.a([].concat(row(10, null)));
    io.a([].concat(row(10, 'WOLF')));
    eq(kinds().filter(k => k === 'clan').length, 0);
});
t('deaths off keeps the rest', () => {
    reset(); live();
    window.vars.logDeaths = false;
    io.D([1, 10, 'kelp'], false);
    io.O(10, 0);
    io.P();
    eq(kinds().filter(k => k === 'death').length, 0);
    has('kelp spawned');
});

console.log('\nthe buffer and the export');
t('it caps rather than growing without bound', () => {
    reset(); live();
    ServerLog.max = 20;
    for (let i = 0; i < 100; i++) io['6'](77, 'line ' + i);
    eq(ServerLog.lines.length, 20);
    has('line 99');
    hasnt('line 50');
    ServerLog.max = 800;
});
t('clear empties it', () => {
    reset(); live();
    io['6'](77, 'hi');
    ServerLog.clear();
    eq(ServerLog.lines.length, 0);
});
t('the export is time, kind and text', () => {
    reset(); live();
    io.D([1, 10, 'kelp'], false);
    const out = ServerLog.text();
    ok(/^\d{2}:\d{2}:\d{2}\s+\[join\] kelp spawned$/.test(out), 'got ' + JSON.stringify(out));
});
t('the live view is nudged on every line', () => {
    reset(); live();
    let hits = 0;
    window._novaServerLogSink = () => hits++;
    io['6'](77, 'a');
    io['6'](77, 'b');
    eq(hits, 2);
});
t('a broken view cannot stop the log', () => {
    reset(); live();
    window._novaServerLogSink = () => { throw new Error('bad paint'); };
    io['6'](77, 'a');
    eq(ServerLog.lines.length, 1);
});
t('reconnecting starts a clean sheet', () => {
    reset(); live();
    io.D([1, 10, 'kelp'], false);
    io.a([].concat(row(10, null)));
    io.C();
    eq(Object.keys(ServerLog._teams).length, 0, 'stale teams would fake a clan join');
    eq(Object.keys(ServerLog._names).length, 0);
    eq(ServerLog._mates, null);
});

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
