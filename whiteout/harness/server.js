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
  const { strict = false, onViolation = null, onClose = null, onSession = null } = opts || {};
  const { WebSocketServer } = require("ws");
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws) => {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const keyHex = crypto.randomBytes(32).toString("hex");
    const tables = tablesFor(seed);
    const mySid = 1;

    const send = (letter, args) => {
      const op = tables.s2c.enc[letter];
      ws.send(Buffer.from(encode([op, args])));
    };

    /* The real server drops the connection on a frame it cannot verify, which
     * is what a client shows as "disconnected". Validate the same three things
     * it does — signature, opcode, strictly increasing sequence — and report
     * every violation instead of silently ignoring it. */
    const key = Buffer.from(keyHex, "hex");
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

      const payload = bytes.subarray(SIG_BYTES);
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
    });

    ws.on("close", () => { if (onClose) onClose(violations); });

    // Lets a test emulate the game bundle sending frames of its own.
    if (onSession) onSession({ keyHex, c2s: tables.c2s.enc });

    ws.send(Buffer.from(encode(["io-init", [7, seed, keyHex, ENCRYPTED_MODE]])));

    const mid = 7e3;
    const foeSid = 2;

    setTimeout(() => {
      send("A", [{ teams: [{ sid: "clan", owner: mySid }] }]);
      send("C", [mySid]);
      // [id, sid, name, x, y, dir, health, maxHealth, scale, skinColor]
      send("D", [["p1", mySid, "tester", mid, mid, 0, 100, 100, 35, 0], true]);
      send("D", [["p2", foeSid, "rival", mid + 150, mid + 40, 0, 100, 100, 35, 1], false]);
      // 13 fields per player
      send("a", [[
        mySid, mid, mid, 0, -1, 0, 0, null, 0, 0, 0, 0, 0,
        foeSid, mid + 150, mid + 40, 3, -1, 5, 1, null, 0, 6, 11, 1, 0,
      ]]);
      // loadGameObject: 8 fields per object [sid,x,y,dir,scale,type,itemId,ownerSid]
      send("H", [[
        1, mid + 200, mid + 120, 0, 70, 0, null, null,      // tree
        2, mid - 240, mid + 60, 1, 60, 2, null, null,       // stone
        3, mid + 60, mid - 90, 0, 35, null, 4, mySid,       // my spike
        4, mid - 60, mid - 120, 0, 35, null, 4, foeSid,     // enemy spike
      ]]);
      // loadAI: 7 fields per animal [sid,index,x,y,dir,health,nameIndex]
      send("I", [[9, 0, mid + 300, mid - 200, 0, 100, 0]]);
      send("G", [[mySid, "tester", 12, 0, foeSid, "rival", 8, 0]]);
      send("T", [0, 1, 1]);
      send("U", [1, 0]);
      send("S", [0, 3, 0]);
      send("V", [[0, 1, 2], null]);
      send("V", [[0, 1, 2, 3], true]);
      send("6", [mySid, "hello"]);
      send("8", [mid + 40, mid + 40, 15, 0]);
      send("7", []);
      send("K", [mySid, 1, 0]);
      send("L", [1]);
      send("O", [foeSid, 80]);
      // addProjectile: [x, y, dir, range, speed, index, layer, sid]
      send("X", [mid + 20, mid + 20, 0, 700, 1.5, 0, 0, 21]);
      send("J", [9, false]);
      send("g", [{ sid: "clan", owner: mySid }]);
      send("3", ["clan", 1]);
      send("4", [[mySid, "tester"]]);
      send("9", [mid, mid + 100]);
    }, 250);

    // Keep the world ticking so interpolation and the tick loop run.
    let t = 0;
    const tick = setInterval(() => {
      t++;
      const wobble = Math.sin(t / 8) * 60;
      send("a", [[
        mySid, mid, mid, 0, -1, 0, 0, null, 0, 0, 0, 0, 0,
        foeSid, mid + 150 + wobble, mid + 40, 3, -1, 5, 1, null, 0, 6, 11, 1, 0,
      ]]);
      if (t % 9 === 0) send("O", [foeSid, 60 + (t % 40)]);
      if (t % 15 === 0) send("M", [3, 1]);
    }, 111);
    ws.on("close", () => clearInterval(tick));
  });

  return wss;
}

module.exports = { start };

if (require.main === module) start(8322, console.log);
