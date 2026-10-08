/* Minimal moomoo.io-compatible game server: negotiates the signed transport
 * the real game uses (io-init -> per-connection opcode permutation) and then
 * feeds the client enough packets to spawn and render a frame. */
const crypto = require("crypto");
const { encode, decode } = require("@msgpack/msgpack");

const SIG_BYTES = 6;
const ENCRYPTED_MODE = 1;
const TABLE_SALT = 1;

const C2S = ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"];
const S2C = ["A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R",
  "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

function seededRandom(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 1831565813) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function permute(alphabet, seed) {
  const n = alphabet.length;
  const order = alphabet.map((_, i) => i);
  const rand = seededRandom(seed >>> 0);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = order[i];
    order[i] = order[j];
    order[j] = t;
  }
  const enc = {}, dec = {};
  for (let i = 0; i < n; i++) {
    enc[alphabet[i]] = order[i];
    dec[order[i]] = alphabet[i];
  }
  return { enc, dec };
}

function tablesFor(seed) {
  const t = (seed ^ Math.imul(TABLE_SALT, 2654435761)) >>> 0;
  return { c2s: permute(C2S, t), s2c: permute(S2C, (t ^ 2246822507) >>> 0) };
}

function start(port, log, opts) {
  const { WebSocketServer } = require("ws");
  const wss = new WebSocketServer({ port });
  wss.on("connection", (ws) => attach(ws, log, opts));
  return wss;
}

/* One connection's worth of server, on anything with send/on/close. Split out
 * of start() so a test can drive it from Playwright's routeWebSocket, which is
 * how a page that dials wss://<key>.<region>.moomoo.io gets a server at all. */
function attach(ws, log, opts) {
  const {
    strict = false, onViolation = null, onClose = null, onSession = null,
    /* The real server puts you in the world when it accepts your "M" frame and
     * not before. Spawning on a timer instead makes a client that never sends a
     * valid spawn look identical to one that does — which is how a spawn sent
     * before the transport was negotiated went unnoticed here. */
    requireSpawn = false,
    /* Names this server will not spawn a player under, and says nothing about
     * — the way a name that belongs to someone else can be refused. */
    ignoreNames = [],
    // ...or turns away with a reason ("B"), as the game's server does
    kickNames = {},
    onSpawned = null,
    /* 2025 moved three world packets to new layouts:
     *   a  [sid,x,y,dir*100]x4, [sid,build,weapon,variant,team,leader,skin,tail,icon,z]x10, [hidden sids]
     *   I  [sid,index,x,y,dir*100,health,nameIndex,state]x8, [hidden sids]
     *   K  (sid, didHit, weaponIndex, extra)
     * A client still parsing the 2024 shapes reads every field off by one or
     * more. Pass proto: 2025 to get the new ones. */
    proto = 2024,
    /* A "pinned" 2025 session: io-init's fifth field is 1, the key goes
     * through mixKey with the seed, the opcode tables are salted, and every
     * frame both ways is XOR-masked. `crypto` is the game's own primitives
     * (harness/proto-2025.js), so the masking here is the bundle's, not a
     * re-implementation that could agree with a wrong client. `mixKey` must
     * be the one the page's moomoo-protocol module exports. */
    pinned = false,
    crypto: wire = null,
    mixKey = (key) => key,
    salt = 7,
    /* `sim`: the server's side of a player who swings at things, so a test can
     * watch a client's hit cadence instead of guessing at it. The rules are
     * the game's own shared Player update, copied out of the 2025 bundle:
     *
     *   if (buildIndex < 0)
     *     if (reloads[w] > 0) reloads[w] -= dt, gathering = mouseState
     *     else if (gathering || autoGather) swing, gathering = mouseState,
     *                                       reloads[w] = weapon.speed * hat.atkSpd
     *
     * so only the weapon in hand reloads, and only with no item in hand. A
     * press ("F" 1) latches `gathering`, which is what lets a press and a
     * release sent in the same tick still swing once. My own turrets are in
     * reach from the start; a swing that lands wiggles them ("L") and every
     * swing is announced ("K": sid, didHit, weapon, speedMult). Appearance
     * goes out only when it changes, as 2025 sends it.
     *
     *   sim.positions: "always" (default) or "delta" — whether a player who
     *   has not moved or turned is still in the tick's position list.
     *   sim.quiet: a tick with nothing to say says nothing — no update at all
     *   when all three of its lists are empty (implies "delta"). Whether the
     *   2025 server does this is not something a client can see from its
     *   code; a client has to work either way.
     *   sim.heartbeat (ms): quiet, but an empty update goes out anyway when
     *   nothing has been sent for this long.
     *   onSwing(t, weapon, didHit): every swing, for the test to time.
     *
     * Turrets are counted the way the server counts them: two to a player
     * (group 7), "S" with the new count on every place and every break, and a
     * place over the limit refused. */
    sim = null,
    // the hat my player wears (2025, outside `sim`): its look row's skin
    mySkin = 0,
    // the rival kept out of the way (a picture of me alone)
    foeAway = false,
    // a Crab King (2025 boss, index 11) in view, above me
    boss = false,
    // a player resumed after a refresh: my add-player frame carries the old
    // connection's socket id and comes before setupGame
    resume = false,
    // every frame this client sends: (letter, args)
    onC2S = null,
  } = opts || {};
  {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const keyHex = crypto.randomBytes(32).toString("hex");
    if (pinned && !wire) throw new Error("pinned sessions need the game's crypto primitives");
    const keyBytes = pinned ? mixKey(wire.vf(keyHex), seed) : Buffer.from(keyHex, "hex");
    const tables = pinned ? wire.Ll(seed, salt) : tablesFor(seed);
    const mask = pinned ? wire.kf(keyBytes) : null;
    let sent = 0;
    const mySid = 1;

    const send = (letter, args) => {
      const op = tables.s2c.enc[letter];
      const bytes = new Uint8Array(encode([op, args]));
      if (mask) wire.Nl(bytes, wire.wf(mask.s2c, ++sent));
      ws.send(Buffer.from(bytes));
    };

    /* The real server drops the connection on a frame it cannot verify, which
     * is what a client shows as "disconnected". Validate the same three things
     * it does — signature, opcode, strictly increasing sequence — and report
     * every violation instead of silently ignoring it. */
    const key = Buffer.from(keyBytes);
    let expectedSeq = 0;
    const violations = [];
    const reject = (why, detail) => {
      violations.push(why + (detail ? " (" + detail + ")" : ""));
      if (onViolation) onViolation(why, detail);
      if (strict) ws.close(4001, "Invalid Connection");
    };

    ws.on("message", (raw) => {
      const bytes = new Uint8Array(raw);
      if (bytes.length <= SIG_BYTES) return reject("frame shorter than its signature", bytes.length + " bytes");

      const payload = bytes.slice(SIG_BYTES);
      // The client masks the payload with bf(mask.c2s, signature) after
      // signing the plain payload; undo that before checking the signature.
      if (mask) wire.Nl(payload, wire.bf(mask.c2s, bytes.subarray(0, SIG_BYTES)));
      const want = crypto.createHmac("sha256", key).update(payload).digest().subarray(0, SIG_BYTES);
      if (!want.equals(Buffer.from(bytes.subarray(0, SIG_BYTES))))
        return reject("bad frame signature");

      let frame;
      try {
        frame = decode(payload);
      } catch (e) {
        return reject("payload is not msgpack", e.message);
      }
      if (!Array.isArray(frame)) return reject("payload is not a frame");

      const letter = tables.c2s.dec[frame[0]];
      if (letter === undefined) return reject("unknown c2s opcode", String(frame[0]));

      const seq = frame[2];
      if (typeof seq !== "number") return reject("missing sequence number", letter);
      if (seq !== expectedSeq + 1)
        return reject("sequence out of order", letter + ": got " + seq + ", expected " + (expectedSeq + 1));
      expectedSeq = seq;

      if (log) log("c2s", letter, "seq=" + seq, JSON.stringify(frame[1]).slice(0, 120));
      if (onC2S) try { onC2S(letter, frame[1]); } catch (e) {}
      if (letter === "M") {
        const name = Array.isArray(frame[1]) && frame[1][0] && frame[1][0].name;
        if (kickNames[name]) {
          send("B", [kickNames[name]]);
          setTimeout(() => ws.close(), 50);
        } else if (ignoreNames.indexOf(name) < 0) {
          if (!spawned && onSpawned) onSpawned(name);
          spawn();
        }
      }
      if (sim && spawned) simPacket(letter, frame[1]);
      // the real server answers a ping with an empty "0"
      if (letter === "0") send("0", []);
    });

    ws.on("close", () => { if (onClose) onClose(violations); });

    // Lets a test emulate the game bundle sending frames of its own, and go
    // quiet on demand — a server that stalls is a thing clients have to live
    // through, not an impossible state.
    if (onSession) onSession({
      keyHex,
      c2s: tables.c2s.enc,
      stopTicks: () => { if (tick) { clearInterval(tick); tick = null; } },
      /* Push any packet the server can send. A client built as a webpack
       * bundle keeps its state inside closures, so a test cannot reach in and
       * set a field — driving it from the wire is the only way, and it is the
       * way the real game does it anyway. */
      send: (letter, args) => send(letter, args),
      mySid,
      /* The rival dies to me, the way the 2025 server says it: its health to
       * zero, my kill count up, and from the next tick on it is in the update's
       * out-of-view list instead of its position list. */
      killFoe: () => {
        send("O", [foeSid, 0]);
        send("N", ["kills", ++myKills, 1]);
        foeDead = 1;
      },
      // back on its feet where it fell, in the next tick's position list
      reviveFoe: () => {
        foeDead = 0;
        send("O", [foeSid, 100]);
      },
    });

    ws.send(Buffer.from(encode(["io-init", pinned ? [7, seed, keyHex, ENCRYPTED_MODE, 1] : [7, seed, keyHex, ENCRYPTED_MODE]])));

    /* Put the world on dry land.
     *
     * This used to spawn everything at 7000, 7000 — the middle of the map, and
     * the middle of the river. checkItemLocation's last line refuses any
     * placement whose y falls inside mapScale/2 +/- riverWidth/2, which for the
     * game's own 14400 and 724 is y in [6838, 7562]. So every canPlace call in
     * every browser test returned false, whatever the client decided, and a
     * placer that worked perfectly would test as placing nothing. x stays at the
     * centre; y moves well clear of the bank. */
    const mid = 7e3;
    const midY = 6e3;
    const foeSid = 2;
    let foeDead = 0;  // 1: died this tick, 2: dead and gone (session.killFoe)
    let myKills = 0;

    // ── sim: my player's swing, by the game's own rules (see `sim` above) ──
    const SIM_TICK = 111;
    const SIM_WEAPONS = {
      0: { speed: 300, dmg: 25, range: 65, gather: 1 },              // tool hammer
      10: { speed: 400, dmg: 10, sDmg: 7.5, range: 75, gather: 1 },  // great hammer
    };
    const SIM_HATS = { 40: { bDmg: 3.3 }, 20: { atkSpd: .78 } };
    const SIM_GATHER_ANGLE = Math.PI / 2.6;
    const me = sim ? {
      dir: 0, weaponIndex: 0, buildIndex: -1, reloads: { 0: 0, 10: 0 },
      mouseState: 0, gathering: 0, skin: 0, sentLook: "", moved: true,
      turrets: 0,
    } : null;
    const SIM_TURRET_GROUP = 7, SIM_TURRET_LIMIT = 2;
    const simObjects = new Map();
    let simSid = 100;
    if (sim && !sim.trap) {
      // two of my turrets, either side of where I face, inside both weapons' reach
      for (const a of [-.7, .7]) simObjects.set(++simSid, { x: mid + Math.cos(a) * 86, y: midY + Math.sin(a) * 86, hp: 800, type: 17 });
      me.turrets = 2;
    }
    const simLook = () => [mySid, me.buildIndex, me.weaponIndex, 0, null, 0, me.skin, 0, 0, 0];
    const simPacket = (letter, args) => {
      if (!me || !Array.isArray(args)) return;
      if (letter === "F") {
        me.mouseState = args[0] ? 1 : 0;
        if (typeof args[1] === "number" && me.dir !== args[1]) { me.dir = args[1]; me.moved = true; }
        if (args[0]) {
          if (me.buildIndex >= 0) simPlace(me.buildIndex, me.dir);
          else me.gathering = 1;
        } else if (sim.latch === false) {
          // the stricter rule: a release takes the press back before the
          // tick that would have swung on it
          me.gathering = 0;
        }
      } else if (letter === "D") {
        if (typeof args[0] === "number" && me.dir !== args[0]) { me.dir = args[0]; me.moved = true; }
      } else if (letter === "z") {
        const id = args[0], weapon = !!args[1];
        if (weapon) { if (id in SIM_WEAPONS) { if (me.weaponIndex !== id && sim.onEvent) sim.onEvent("weapon " + id); me.weaponIndex = id; me.buildIndex = -1; } }
        else me.buildIndex = me.buildIndex === id ? -1 : id;
      } else if (letter === "c" && args[0] === 0 && args[2] === 0) {
        // equip a hat ("5" 1 = equipped); a hat that is not owned is refused
        const id = args[1] | 0;
        if (id !== 0 && !(sim.hats || []).includes(id)) return;
        if (me.skin !== id && sim.onEvent) sim.onEvent("hat " + id);
        me.skin = id;
        send("5", [1, id, 0]);
      } else if (letter === "H") {
        // the upgrades a grinder needs: the great hammer (age 6), then the
        // turret (age 7, item 17 = upgrade 16 + 17); a trapper's: the pit
        // trap (age 4, item 15 = upgrade 31)
        if (args[0] === 10) send("U", [1, 7]);
        else if (args[0] === 33) send("U", [0, 7]);
        else if (args[0] === 31) send("U", [0, 4]);
      }
    };
    // item: [scale, placeOffset] as the game has them
    const SIM_ITEMS = { 15: [50, -5], 17: [43, 8] };
    const simPlace = (id, dir) => {
      me.buildIndex = -1;
      if (!(id in SIM_ITEMS)) return;
      if (id === 17 && me.turrets >= SIM_TURRET_LIMIT) { if (sim.onEvent) sim.onEvent("place refused (limit)"); return; }
      const [scale, offset] = SIM_ITEMS[id];
      const sid = ++simSid;
      const reach = 35 + scale + offset;
      const o = { x: mid + Math.cos(dir) * reach, y: midY + Math.sin(dir) * reach, hp: 800, type: id };
      send("H", [[sid, o.x, o.y, dir, scale, null, id, mySid]]);
      if (id === 17) {
        // the turrets are what a grinder hits; anything else is left standing
        simObjects.set(sid, o);
        send("S", [SIM_TURRET_GROUP, ++me.turrets]);
        if (sim.onEvent) sim.onEvent("place");
      } else if (sim.onEvent) sim.onEvent("place " + id + " at " + dir.toFixed(2));
    };
    const simSwing = () => {
      const w = SIM_WEAPONS[me.weaponIndex];
      const hat = SIM_HATS[me.skin] || {};
      let hit = 0;
      for (const [sid, o] of simObjects) {
        const dx = o.x - mid, dy = o.y - midY;
        if (Math.hypot(dx, dy) - 43 > w.range) continue;
        let da = Math.abs(Math.atan2(dy, dx) - me.dir) % (Math.PI * 2);
        if (da > Math.PI) da = Math.PI * 2 - da;
        if (da > SIM_GATHER_ANGLE) continue;
        hit = 1;
        send("L", [me.dir, sid]);
        o.hp -= w.dmg * (w.sDmg || 1) * (hat.bDmg || 1);
        if (o.hp <= 0) {
          simObjects.delete(sid);
          send("Q", [sid]);
          send("S", [SIM_TURRET_GROUP, --me.turrets]);
          if (sim.onEvent) sim.onEvent("destroy");
        }
      }
      send("K", [mySid, hit, me.weaponIndex, 1]);
      if (sim.onSwing) sim.onSwing(Date.now(), me.weaponIndex, hit);
    };
    if (sim) {
      sim.state = () => ({ mouseState: me.mouseState, gathering: me.gathering });
      // an animal update, as 2025 sends it: the rows that changed, the sids gone
      sim.at = { x: mid, y: midY };
      sim.animals = (rows, gone) => send("I", [rows, gone || []]);
    }
    const simUpdate = () => {
      if (me.buildIndex >= 0) return;
      const w = me.weaponIndex;
      if (me.reloads[w] > 0) {
        me.reloads[w] -= SIM_TICK;
        me.gathering = me.mouseState;
      } else if (me.gathering) {
        simSwing();
        me.gathering = me.mouseState;
        me.reloads[w] = SIM_WEAPONS[w].speed * ((SIM_HATS[me.skin] || {}).atkSpd || 1);
      }
    };

    let spawned = false;
    let tick = null;
    const spawn = () => {
      if (spawned) return;
      spawned = true;
      sendWorld();
      tick = setInterval(tickWorld, 111);
    };

    function sendWorld() {
      send("A", [{ teams: [{ sid: "clan", owner: mySid }] }]);
      // [id, sid, name, x, y, dir, health, maxHealth, scale, skinColor]
      if (resume) {
        send("D", [["old-conn", mySid, "tester", mid, midY, 0, 100, 100, 35, 0], true]);
        send("C", [mySid]);
      } else {
        send("C", [mySid]);
        send("D", [["p1", mySid, "tester", mid, midY, 0, 100, 100, 35, 0], true]);
      }
      send("D", [["p2", foeSid, "rival", mid + (sim ? 3000 : 150), midY + 40, 0, 100, 100, 35, 1], false]);
      sendPlayers(0, true);
      // loadGameObject: 8 fields per object [sid,x,y,dir,scale,type,itemId,ownerSid]
      send("H", [[
        1, mid + 200, midY + 120, 0, 70, 0, null, null,      // tree
        2, mid - 240, midY + 60, 1, 60, 2, null, null,       // stone
        3, mid + 60, midY - 90, 0, 35, null, 4, mySid,       // my spike
        4, mid - 60, midY - 120, 0, 35, null, 4, foeSid,     // enemy spike
      ]]);
      // loadAI: 7 fields per animal [sid,index,x,y,dir,health,nameIndex]
      // 2025 also brought new animals (9-14); a crab is in view so a client
      // that only knows the old nine has to cope with one.
      if (sim && sim.trap) {
        // a boar (2025) a step away, facing me, sent once and never again:
        // what an animal standing still looks like on the 2025 wire
        send("I", [[11, 9, mid + 120, midY, 314, 900, 0, 0], []]);
      } else if (proto === 2025) send("I", [[9, 0, mid + 300, midY - 200, 0, 100, 0, 0,
                                             10, 13, mid - 320, midY + 220, 157, 500, 0, 0]
                                             .concat(boss ? [12, 11, mid, midY - 470, 157, 300000, 0, 0] : []), []]);
      else send("I", [[9, 0, mid + 300, midY - 200, 0, 100, 0]]);
      send("G", [[mySid, "tester", 12, 0, foeSid, "rival", 8, 0]]);
      send("T", [0, 1, 1]);
      send("U", [1, 0]);
      send("S", [0, 3, 0]);
      /* The game's own starting loadout, not three numbers in a row.
       *
       * updateItems takes this list as myPlayer.items, and every placer here
       * reads it by slot -- items[2] is the spike, items[4] the trap. Sending
       * [0,1,2] made slot 2 read as cheese and slot 4 as nothing, so a placement
       * test watched the client try to build food and called the feature broken.
       * The game spawns you with [0, 3, 6, 10]: apple, wood wall, spikes, mill. */
      send("V", [sim ? (sim.trap ? [0, 3, 6, 10, 15] : [0, 3, 6, 10, 17]) : [0, 3, 6, 10], null]);
      send("V", [sim ? [0, 10] : [0, 1, 2, 3], true]);
      if (sim) {
        send("H", [[...simObjects].flatMap(([sid, o]) => [sid, o.x, o.y, 0, 43, null, 17, mySid])]);
        send("S", [SIM_TURRET_GROUP, me.turrets]);
        send("U", sim.trap ? [1, 4] : [1, 6]);
        for (const id of sim.hats || []) send("5", [0, id, 0]);
        for (const r of ["wood", "stone", "food", "points"]) send("N", [r, 5000]);
      }
      send("6", [mySid, "hello"]);
      send("8", [mid + 40, midY + 40, 15, 0]);
      send("7", []);
      send("K", [mySid, 1, 0]);
      send("L", [1]);
      send("O", [foeSid, 80]);
      // addProjectile: [x, y, dir, range, speed, index, layer, sid]
      send("X", [mid + 20, midY + 20, 0, 700, 1.5, 0, 0, 21]);
      send("J", [9, false]);
      send("g", [{ sid: "clan", owner: mySid }]);
      send("3", ["clan", 1]);
      send("4", [[mySid, "tester"]]);
      send("9", [mid, midY + 100]);
    }

    function sendPlayers(wobble, full) {
      if (sim) {
        // my position every tick, or only when I moved or turned; my look only
        // when it changed; the rival far away and still
        const look = simLook();
        const changed = JSON.stringify(look) !== me.sentLook;
        const delta = sim.positions === "delta" || sim.quiet;
        const pos = (!delta || me.moved || full) ? [mySid, mid, midY, Math.round(me.dir * 100)] : [];
        me.moved = false;
        // sim.foeNear: the rival walks up to 250 away, inside the 400 at which
        // Auto Grind stands down
        const foeX = sim.foeNear ? mid + 250 : mid + 3000;
        const foeMoved = sim._foeX !== foeX;
        sim._foeX = foeX;
        const lists = [
          full || foeMoved ? pos.concat([foeSid, foeX, midY + 40, 300]) : pos,
          (changed || full ? look : []).concat(full ? [foeSid, -1, 5, 1, null, 0, 6, 11, 1, 0] : []),
          [],
        ];
        me.sentLook = JSON.stringify(look);
        const now = Date.now();
        if (sim.quiet && lists.every(l => l.length === 0)) {
          // sim.heartbeat: even a quiet server says something every so often
          if (!(sim.heartbeat && now - (sim._sentAt || 0) >= sim.heartbeat)) { sim.quietTicks = (sim.quietTicks || 0) + 1; return; }
        }
        sim._sentAt = now;
        send("a", lists);
        return;
      }
      if (proto === 2025) {
        // a dead rival is out of view: listed once as gone, then not at all
        const foe = foeDead ? [] : [foeSid, mid + (foeAway ? 900 : 150) + wobble, midY + 40, 300];
        send("a", [
          [mySid, mid, midY, 0].concat(foe),
          full ? [mySid, -1, 0, 0, null, 0, mySkin, 0, 0, 0,
                  foeSid, -1, 5, 1, null, 0, 6, 11, 1, 0] : [],
          foeDead === 1 ? [foeSid] : [],
        ]);
        if (foeDead === 1) foeDead = 2;
        return;
      }
      // 13 fields per player
      send("a", [[
        mySid, mid, midY, 0, -1, 0, 0, null, 0, 0, 0, 0, 0,
        foeSid, mid + 150 + wobble, midY + 40, 3, -1, 5, 1, null, 0, 6, 11, 1, 0,
      ]]);
    }

    // Keep the world ticking so interpolation and the tick loop run.
    let t = 0;
    function tickWorld() {
      t++;
      if (sim) {
        simUpdate();
        sendPlayers(0, false);
        return;
      }
      const wobble = Math.sin(t / 8) * 60;
      sendPlayers(wobble, false);
      if (t % 9 === 0 && !foeDead) send("O", [foeSid, 60 + (t % 40)]);
      // A hit on the rival every few ticks: the damage number the game floats
      // up from them ("8": x, y, value, type), so a screenshot has one alive.
      if (proto === 2025 && t % 3 === 0 && !foeDead) send("8", [mid + 150 + wobble, midY + 40, 17, 0]);
      if (t % 15 === 0) send("M", [3, 1]);
    }

    if (!requireSpawn) setTimeout(spawn, 250);
    ws.on("close", () => { if (tick) clearInterval(tick); });
  }
}

module.exports = { start, attach };

if (require.main === module) start(8322, console.log);
