// ============================================================================
// Current moomoo.io transport, transcribed from src/game_index.js.
//
// remedy 4.1 speaks the old wire format: it encodes msgpack [type, args] and
// hands that straight to WebSocket.send, and it reads inbound frames the same
// way. The shipped game has not worked like that for a while. On connect it
// negotiates a per-connection opcode permutation and an HMAC key, and from
// then on every client frame is
//
//     [ 6 HMAC bytes ][ msgpack([ opcodeNumber, args, sequence ]) ]
//
// while server frames stay plain msgpack but carry a permuted numeric opcode
// instead of the letter. So remedy's sends are dropped by the server, its own
// WebSocket.send hook throws trying to msgpack-decode a signed frame, and its
// inbound handler looks up events[number] against a table keyed by letters.
//
// Everything below is taken from the bundle rather than reimplemented:
//
//   jt = 6                 signature bytes            (game_index.js:279)
//   Ht = 1                 secure-mode flag           (game_index.js:280)
//   Io = 1                 table salt                 (game_index.js:278)
//   bo / To                c2s / s2c alphabets        (game_index.js:281-282)
//   Co                     seeded PRNG                (game_index.js:283)
//   Oi                     alphabet shuffle           (game_index.js:293)
//   Po                     seed -> both tables        (game_index.js:312)
//   Ro                     hex key -> bytes           (game_index.js:400)
//   Vt / Ao / Eo           sha256 / hmac / truncated  (game_index.js:320-398)
//
// io-init carries [socketId, seed, keyHex, mode]; secure mode is on only when
// mode === Ht, and the client must fall back to plain msgpack otherwise —
// which is what the bundle does, and what this does.
// ============================================================================
const RemedyWire = (function() {
    const SIGNATURE_BYTES = 6;
    const SECURE_MODE = 1;
    const TABLE_SALT = 1;
    const C2S_ALPHABET = ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"];
    const S2C_ALPHABET = ["A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

    // Co
    function makeRandom(seed) {
        return function() {
            seed |= 0;
            seed = seed + 1831565813 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    // Oi — Fisher-Yates over the index list, driven by the seeded PRNG.
    function shuffleTable(alphabet, seed) {
        const size = alphabet.length;
        const order = alphabet.map((_, i) => i);
        const random = makeRandom(seed >>> 0);
        for (let i = size - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            const tmp = order[i];
            order[i] = order[j];
            order[j] = tmp;
        }
        const enc = {};
        const dec = {};
        for (let i = 0; i < size; i++) {
            enc[alphabet[i]] = order[i];
            dec[order[i]] = alphabet[i];
        }
        return { enc: enc, dec: dec };
    }

    // Po
    function buildTables(seed) {
        const mixed = (seed ^ Math.imul(TABLE_SALT, 2654435761)) >>> 0;
        return {
            c2s: shuffleTable(C2S_ALPHABET, mixed),
            s2c: shuffleTable(S2C_ALPHABET, (mixed ^ 2246822507) >>> 0)
        };
    }

    // Ro
    function hexToBytes(hex) {
        const out = new Uint8Array(hex.length / 2);
        for (let i = 0; i < out.length; i++) {
            out[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        return out;
    }

    const K = new Uint32Array([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);

    function rotr(value, bits) {
        return value >>> bits | value << 32 - bits;
    }

    // Vt
    function sha256(bytes) {
        const h = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
        const len = bytes.length;
        const bits = len * 8;
        const padded = new Uint8Array(Math.ceil((len + 9) / 64) * 64);
        padded.set(bytes);
        padded[len] = 128;
        const view = new DataView(padded.buffer);
        view.setUint32(padded.length - 4, bits >>> 0, false);
        view.setUint32(padded.length - 8, Math.floor(bits / 4294967296), false);
        const w = new Uint32Array(64);
        for (let base = 0; base < padded.length; base += 64) {
            for (let i = 0; i < 16; i++) {
                w[i] = view.getUint32(base + i * 4, false);
            }
            for (let i = 16; i < 64; i++) {
                const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ w[i - 15] >>> 3;
                const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ w[i - 2] >>> 10;
                w[i] = w[i - 16] + s0 + w[i - 7] + s1 | 0;
            }
            let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
            for (let i = 0; i < 64; i++) {
                const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
                const ch = e & f ^ ~e & g;
                const temp1 = hh + S1 + ch + K[i] + w[i] | 0;
                const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
                const maj = a & b ^ a & c ^ b & c;
                const temp2 = S0 + maj | 0;
                hh = g;
                g = f;
                f = e;
                e = d + temp1 | 0;
                d = c;
                c = b;
                b = a;
                a = temp1 + temp2 | 0;
            }
            h[0] = h[0] + a | 0;
            h[1] = h[1] + b | 0;
            h[2] = h[2] + c | 0;
            h[3] = h[3] + d | 0;
            h[4] = h[4] + e | 0;
            h[5] = h[5] + f | 0;
            h[6] = h[6] + g | 0;
            h[7] = h[7] + hh | 0;
        }
        const out = new Uint8Array(32);
        const outView = new DataView(out.buffer);
        for (let i = 0; i < 8; i++) {
            outView.setUint32(i * 4, h[i], false);
        }
        return out;
    }

    const BLOCK_SIZE = 64;

    // Ao
    function hmacSha256(key, message) {
        let k = key;
        if (k.length > BLOCK_SIZE) k = sha256(k);
        const padded = new Uint8Array(BLOCK_SIZE);
        padded.set(k);
        const inner = new Uint8Array(BLOCK_SIZE + message.length);
        const outer = new Uint8Array(BLOCK_SIZE + 32);
        for (let i = 0; i < BLOCK_SIZE; i++) {
            inner[i] = padded[i] ^ 54;
            outer[i] = padded[i] ^ 92;
        }
        inner.set(message, BLOCK_SIZE);
        outer.set(sha256(inner), BLOCK_SIZE);
        return sha256(outer);
    }

    // Eo
    function signature(key, message) {
        return hmacSha256(key, message).subarray(0, SIGNATURE_BYTES);
    }

    const codec = () => window[window.msgpackJsName || "msgpack"];

    // One of these per connection. The key, the opcode tables and the sequence
    // counter are all negotiated per socket, so the bot sockets in connectBot
    // cannot share the main one — each gets its own channel.
    function createChannel() {
    let state = null;

    return {
        SIGNATURE_BYTES: SIGNATURE_BYTES,

        // Called with the io-init argument array. Mirrors the bundle: secure
        // mode only when args[3] matches, otherwise the connection stays on
        // plain msgpack and everything below passes through untouched.
        init: function(args) {
            if (args && args[3] === SECURE_MODE) {
                state = {
                    key: hexToBytes(args[2]),
                    tables: buildTables(args[1] >>> 0),
                    seq: 0
                };
            } else {
                state = null;
            }
            return state !== null;
        },

        reset: function() {
            state = null;
        },

        get active() {
            return state !== null;
        },

        // [type, args] -> the bytes to hand to the native send.
        encode: function(type, args) {
            const pack = codec();
            if (state === null) {
                return pack.encode([type, args]);
            }
            const opcode = state.tables.c2s.enc[type];
            if (opcode === undefined) {
                return null;
            }
            const seq = ++state.seq;
            const body = pack.encode([opcode, args, seq]);
            const sig = signature(state.key, body);
            const frame = new Uint8Array(SIGNATURE_BYTES + body.length);
            frame.set(sig, 0);
            frame.set(body, SIGNATURE_BYTES);
            return frame;
        },

        // A frame on its way out -> [type, args], for the code that inspects
        // its own traffic. Returns null when the frame cannot be read.
        decodeOutgoing: function(bytes) {
            const pack = codec();
            try {
                if (state === null) {
                    const flat = pack.decode(bytes);
                    return [flat[0], flat[1]];
                }
                const parsed = pack.decode(bytes.subarray(SIGNATURE_BYTES));
                const type = state.tables.c2s.dec[parsed[0]];
                if (type === undefined) return null;
                return [type, parsed[1]];
            } catch (e) {
                return null;
            }
        },

        // Server frames stay plain msgpack; only the opcode is permuted.
        decodeIncoming: function(bytes) {
            const pack = codec();
            try {
                const parsed = pack.decode(bytes);
                let type = parsed[0];
                if (type === "io-init") {
                    return [type, parsed[1]];
                }
                if (state !== null && typeof type === "number") {
                    type = state.tables.s2c.dec[type];
                    if (type === undefined) return null;
                }
                return [type, parsed[1]];
            } catch (e) {
                return null;
            }
        }
    };
    }

    const main = createChannel();

    // remedy attaches its message listener the first time the game calls
    // WebSocket.send:
    //
    //     if (!WS) { WS = this; WS.addEventListener("message", ...); }
    //
    // io-init arrives from the server the moment the socket opens, before the
    // game has sent anything, so that listener is always too late to see it —
    // and io-init is the only place the key and the opcode tables ever appear.
    // Miss it and every frame goes out as plain msgpack and is dropped, which
    // looks like joining a game and never spawning.
    //
    // The socket is wrapped at construction instead. The bundle takes its
    // reference once, at module scope (`const kn = window.WebSocket`), and this
    // script runs at document-start, so the wrapper is in place first.
    //
    // Bot sockets come through the same constructor but own their channel:
    // connectBot assigns ws.wire synchronously right after `new WebSocket`,
    // while messages only arrive on a later turn, so `socket.wire` is a
    // reliable "not the main socket" test by the time anything is received.
    function install(scope) {
        const target = scope || (typeof window !== "undefined" ? window : null);
        if (!target) return false;
        const Native = target.WebSocket;
        if (!Native || Native.__remedyWired) return false;

        function Wrapped(url, protocols) {
            const socket = protocols === undefined ? new Native(url) : new Native(url, protocols);
            socket.addEventListener("message", function(event) {
                if (socket.wire) return;
                try {
                    const parsed = codec().decode(new Uint8Array(event.data));
                    if (parsed && parsed[0] === "io-init") {
                        main.init(parsed[1]);
                    }
                } catch (e) {}
            });
            return socket;
        }

        Wrapped.prototype = Native.prototype;
        Wrapped.__remedyWired = true;
        Wrapped.__native = Native;
        for (const key of [ "CONNECTING", "OPEN", "CLOSING", "CLOSED" ]) {
            Wrapped[key] = Native[key];
        }
        target.WebSocket = Wrapped;
        return true;
    }

    install();

    return {
        SIGNATURE_BYTES: SIGNATURE_BYTES,
        create: createChannel,
        install: install,
        main: main
    };
})();
