/* ===========================================================================
 * moomoo.io transport shim  (generated into each client by tools/patch-clients.js)
 * ---------------------------------------------------------------------------
 * The live game no longer speaks the plain `msgpack([type, args])` protocol the
 * clients in this folder were written against. Since the transport rewrite it:
 *
 *   1. negotiates a per-connection opcode table in `io-init`
 *      (`args = [socketId, seed, keyHex, mode]`, mode 1 = permuted transport),
 *   2. permutes the c2s / s2c name alphabets from `seed`,
 *   3. sends `msgpack([opcode:int, args:array, seq:int])` prefixed with the
 *      first 6 bytes of HMAC-SHA256(key, payload),
 *   4. captures `WebSocket.prototype.send` at module-eval time and calls it as
 *      `saved.call(socket, frame)`, so a prototype patch installed *after* the
 *      game bundle has loaded never sees a single outgoing packet.
 *
 * This shim installs at document-start (before the bundle evaluates) and makes
 * the new game look exactly like the old one to the client code above it:
 *
 *   game  --[new frame]--> shim --[legacy frame]--> client hook
 *   client hook --[legacy frame]--> shim --[new frame]--> network
 *   network --[numeric opcode]--> shim --[legacy frame]--> client listeners
 *
 * so the client's own packet code keeps working unchanged, including its
 * packet-name aliasing layers, its bot sockets, and its dontSend drops.
 * Frames the shim re-signs are numbered from its own sequence counter, so a
 * dropped packet does not leave a hole in the sequence the server sees.
 *
 * Servers that negotiate mode 0 (private servers, older builds) get the plain
 * legacy framing, untouched.
 * ======================================================================== */
(function () {
    "use strict";
    if (typeof window === "undefined" || window.__mooTransport)
        return;

    /* ---------------------------------------------------------------- msgpack
     * Self-contained so the shim does not depend on whichever msgpack build the
     * host script pulled in (several of them @require a CDN that is long dead).
     */
    var utf8enc = new TextEncoder();
    var utf8dec = new TextDecoder();

    // `instanceof ArrayBuffer` is per-realm, and message payloads can arrive
    // from another one (iframe, extension bridge), so test the brand instead.
    function isArrayBuffer(v) {
        return Object.prototype.toString.call(v) === "[object ArrayBuffer]";
    }

    function Writer() {
        this.buf = new Uint8Array(1024);
        this.pos = 0;
    }
    Writer.prototype.need = function (n) {
        if (this.pos + n <= this.buf.length)
            return;
        var size = this.buf.length;
        while (size < this.pos + n)
            size *= 2;
        var next = new Uint8Array(size);
        next.set(this.buf.subarray(0, this.pos));
        this.buf = next;
    };
    Writer.prototype.u8 = function (v) {
        this.need(1);
        this.buf[this.pos++] = v;
    };
    Writer.prototype.bytes = function (b) {
        this.need(b.length);
        this.buf.set(b, this.pos);
        this.pos += b.length;
    };
    Writer.prototype.view = function (n) {
        this.need(n);
        var dv = new DataView(this.buf.buffer,this.pos,n);
        this.pos += n;
        return dv;
    };
    Writer.prototype.done = function () {
        return this.buf.slice(0, this.pos);
    };

    function encodeInto(w, v) {
        if (v === null || v === undefined) {
            w.u8(0xc0);
            return;
        }
        var t = typeof v;
        if (t === "boolean") {
            w.u8(v ? 0xc3 : 0xc2);
            return;
        }
        if (t === "number") {
            if (Number.isSafeInteger(v)) {
                if (v >= 0) {
                    if (v < 128)
                        w.u8(v);
                    else if (v < 256)
                        w.u8(0xcc),
                        w.u8(v);
                    else if (v < 65536)
                        w.u8(0xcd),
                        w.view(2).setUint16(0, v, false);
                    else if (v < 4294967296)
                        w.u8(0xce),
                        w.view(4).setUint32(0, v, false);
                    else {
                        w.u8(0xcf);
                        var hi = w.view(8);
                        hi.setUint32(0, Math.floor(v / 4294967296), false);
                        hi.setUint32(4, v >>> 0, false);
                    }
                } else if (v >= -32)
                    w.u8(0xe0 | v + 32);
                else if (v >= -128)
                    w.u8(0xd0),
                    w.view(1).setInt8(0, v);
                else if (v >= -32768)
                    w.u8(0xd1),
                    w.view(2).setInt16(0, v, false);
                else if (v >= -2147483648)
                    w.u8(0xd2),
                    w.view(4).setInt32(0, v, false);
                else {
                    w.u8(0xd3);
                    var lo = w.view(8);
                    lo.setInt32(0, Math.floor(v / 4294967296), false);
                    lo.setUint32(4, v >>> 0, false);
                }
            } else {
                w.u8(0xcb);
                w.view(8).setFloat64(0, v, false);
            }
            return;
        }
        if (t === "string") {
            var s = utf8enc.encode(v);
            if (s.length < 32)
                w.u8(0xa0 | s.length);
            else if (s.length < 256)
                w.u8(0xd9),
                w.u8(s.length);
            else if (s.length < 65536)
                w.u8(0xda),
                w.view(2).setUint16(0, s.length, false);
            else
                w.u8(0xdb),
                w.view(4).setUint32(0, s.length, false);
            w.bytes(s);
            return;
        }
        if (ArrayBuffer.isView(v) || isArrayBuffer(v)) {
            var b = ArrayBuffer.isView(v) ? new Uint8Array(v.buffer,v.byteOffset,v.byteLength) : new Uint8Array(v);
            if (b.length < 256)
                w.u8(0xc4),
                w.u8(b.length);
            else if (b.length < 65536)
                w.u8(0xc5),
                w.view(2).setUint16(0, b.length, false);
            else
                w.u8(0xc6),
                w.view(4).setUint32(0, b.length, false);
            w.bytes(b);
            return;
        }
        if (Array.isArray(v)) {
            if (v.length < 16)
                w.u8(0x90 | v.length);
            else if (v.length < 65536)
                w.u8(0xdc),
                w.view(2).setUint16(0, v.length, false);
            else
                w.u8(0xdd),
                w.view(4).setUint32(0, v.length, false);
            for (var i = 0; i < v.length; i++)
                encodeInto(w, v[i]);
            return;
        }
        var keys = Object.keys(v);
        if (keys.length < 16)
            w.u8(0x80 | keys.length);
        else if (keys.length < 65536)
            w.u8(0xde),
            w.view(2).setUint16(0, keys.length, false);
        else
            w.u8(0xdf),
            w.view(4).setUint32(0, keys.length, false);
        for (var k = 0; k < keys.length; k++) {
            encodeInto(w, keys[k]);
            encodeInto(w, v[keys[k]]);
        }
    }

    function mpEncode(value) {
        var w = new Writer();
        encodeInto(w, value);
        return w.done();
    }

    function Reader(buf) {
        this.b = buf;
        this.dv = new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
        this.pos = 0;
    }
    Reader.prototype.str = function (n) {
        var s = utf8dec.decode(this.b.subarray(this.pos, this.pos + n));
        this.pos += n;
        return s;
    };
    Reader.prototype.bin = function (n) {
        var s = this.b.slice(this.pos, this.pos + n);
        this.pos += n;
        return s;
    };
    Reader.prototype.arr = function (n) {
        var out = new Array(n);
        for (var i = 0; i < n; i++)
            out[i] = this.next();
        return out;
    };
    Reader.prototype.map = function (n) {
        var out = {};
        for (var i = 0; i < n; i++) {
            var k = this.next();
            out[k] = this.next();
        }
        return out;
    };
    Reader.prototype.next = function () {
        if (this.pos >= this.b.length)
            throw new RangeError("msgpack: out of data");
        var c = this.b[this.pos++], v;
        if (c < 0x80)
            return c;
        if (c >= 0xe0)
            return c - 256;
        if (c >= 0xa0 && c < 0xc0)
            return this.str(c - 0xa0);
        if (c >= 0x90 && c < 0xa0)
            return this.arr(c - 0x90);
        if (c >= 0x80 && c < 0x90)
            return this.map(c - 0x80);
        switch (c) {
        case 0xc0:
            return null;
        case 0xc2:
            return false;
        case 0xc3:
            return true;
        case 0xc4:
            return this.bin(this.b[this.pos++]);
        case 0xc5:
            v = this.dv.getUint16(this.pos, false),
            this.pos += 2;
            return this.bin(v);
        case 0xc6:
            v = this.dv.getUint32(this.pos, false),
            this.pos += 4;
            return this.bin(v);
        case 0xc7:
            v = this.b[this.pos],
            this.pos += 2;
            return this.bin(v);
        case 0xc8:
            v = this.dv.getUint16(this.pos, false),
            this.pos += 3;
            return this.bin(v);
        case 0xc9:
            v = this.dv.getUint32(this.pos, false),
            this.pos += 5;
            return this.bin(v);
        case 0xca:
            v = this.dv.getFloat32(this.pos, false),
            this.pos += 4;
            return v;
        case 0xcb:
            v = this.dv.getFloat64(this.pos, false),
            this.pos += 8;
            return v;
        case 0xcc:
            return this.b[this.pos++];
        case 0xcd:
            v = this.dv.getUint16(this.pos, false),
            this.pos += 2;
            return v;
        case 0xce:
            v = this.dv.getUint32(this.pos, false),
            this.pos += 4;
            return v;
        case 0xcf:
            v = this.dv.getUint32(this.pos, false) * 4294967296 + this.dv.getUint32(this.pos + 4, false),
            this.pos += 8;
            return v;
        case 0xd0:
            v = this.dv.getInt8(this.pos),
            this.pos += 1;
            return v;
        case 0xd1:
            v = this.dv.getInt16(this.pos, false),
            this.pos += 2;
            return v;
        case 0xd2:
            v = this.dv.getInt32(this.pos, false),
            this.pos += 4;
            return v;
        case 0xd3:
            v = this.dv.getInt32(this.pos, false) * 4294967296 + this.dv.getUint32(this.pos + 4, false),
            this.pos += 8;
            return v;
        case 0xd4:
            this.pos += 1;
            return this.bin(1);
        case 0xd5:
            this.pos += 1;
            return this.bin(2);
        case 0xd6:
            this.pos += 1;
            return this.bin(4);
        case 0xd7:
            this.pos += 1;
            return this.bin(8);
        case 0xd8:
            this.pos += 1;
            return this.bin(16);
        case 0xd9:
            return this.str(this.b[this.pos++]);
        case 0xda:
            v = this.dv.getUint16(this.pos, false),
            this.pos += 2;
            return this.str(v);
        case 0xdb:
            v = this.dv.getUint32(this.pos, false),
            this.pos += 4;
            return this.str(v);
        case 0xdc:
            v = this.dv.getUint16(this.pos, false),
            this.pos += 2;
            return this.arr(v);
        case 0xdd:
            v = this.dv.getUint32(this.pos, false),
            this.pos += 4;
            return this.arr(v);
        case 0xde:
            v = this.dv.getUint16(this.pos, false),
            this.pos += 2;
            return this.map(v);
        case 0xdf:
            v = this.dv.getUint32(this.pos, false),
            this.pos += 4;
            return this.map(v);
        }
        throw new TypeError("msgpack: bad byte 0x" + c.toString(16));
    }
    ;

    /** Decodes and requires that the whole buffer was consumed. */
    function mpDecode(buf) {
        var r = new Reader(buf)
          , v = r.next();
        if (r.pos !== buf.length)
            throw new RangeError("msgpack: trailing bytes");
        return v;
    }

    /* --------------------------------------------------------------- SHA-256
     * Ported from the game bundle so the signature is bit-for-bit what the
     * server checks.
     */
    var K = new Uint32Array([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);

    function rotr(x, n) {
        return x >>> n | x << 32 - n;
    }

    function sha256(msg) {
        var h = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
        var len = msg.length
          , bits = len * 8
          , padded = len + 9;
        var buf = new Uint8Array(Math.ceil(padded / 64) * 64);
        buf.set(msg);
        buf[len] = 128;
        var dv = new DataView(buf.buffer);
        dv.setUint32(buf.length - 4, bits >>> 0, false);
        dv.setUint32(buf.length - 8, Math.floor(bits / 4294967296), false);
        var w = new Uint32Array(64);
        for (var off = 0; off < buf.length; off += 64) {
            for (var i = 0; i < 16; i++)
                w[i] = dv.getUint32(off + i * 4, false);
            for (var i = 16; i < 64; i++) {
                var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ w[i - 15] >>> 3;
                var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ w[i - 2] >>> 10;
                w[i] = w[i - 16] + s0 + w[i - 7] + s1 | 0;
            }
            var a = h[0]
              , b = h[1]
              , c = h[2]
              , d = h[3]
              , e = h[4]
              , f = h[5]
              , g = h[6]
              , hh = h[7];
            for (var i = 0; i < 64; i++) {
                var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
                var ch = e & f ^ ~e & g;
                var t1 = hh + S1 + ch + K[i] + w[i] | 0;
                var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
                var maj = a & b ^ a & c ^ b & c;
                var t2 = S0 + maj | 0;
                hh = g;
                g = f;
                f = e;
                e = d + t1 | 0;
                d = c;
                c = b;
                b = a;
                a = t1 + t2 | 0;
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
        var out = new Uint8Array(32)
          , odv = new DataView(out.buffer);
        for (var i = 0; i < 8; i++)
            odv.setUint32(i * 4, h[i], false);
        return out;
    }

    var BLOCK = 64;

    function hmac(key, msg) {
        var k = key;
        if (k.length > BLOCK)
            k = sha256(k);
        var pad = new Uint8Array(BLOCK);
        pad.set(k);
        var inner = new Uint8Array(BLOCK + msg.length)
          , outer = new Uint8Array(BLOCK + 32);
        for (var i = 0; i < BLOCK; i++) {
            inner[i] = pad[i] ^ 54;
            outer[i] = pad[i] ^ 92;
        }
        inner.set(msg, BLOCK);
        outer.set(sha256(inner), BLOCK);
        return sha256(outer);
    }

    /* --------------------------------------------------------- opcode tables */
    var SIG_BYTES = 6
      , TABLE_SALT = 1
      , ENCRYPTED_MODE = 1;
    var C2S = ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"];
    var S2C = ["A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

    function rng(seed) {
        var s = seed;
        return function () {
            s |= 0;
            s = s + 1831565813 | 0;
            var t = Math.imul(s ^ s >>> 15, 1 | s);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
        ;
    }

    function shuffleTable(alphabet, seed) {
        var n = alphabet.length
          , idx = alphabet.map(function (_, i) {
            return i;
        })
          , rand = rng(seed >>> 0);
        for (var i = n - 1; i > 0; i--) {
            var j = Math.floor(rand() * (i + 1))
              , tmp = idx[i];
            idx[i] = idx[j];
            idx[j] = tmp;
        }
        var enc = {}
          , dec = {};
        for (var k = 0; k < n; k++) {
            enc[alphabet[k]] = idx[k];
            dec[idx[k]] = alphabet[k];
        }
        return {
            enc: enc,
            dec: dec
        };
    }

    function buildTables(seed) {
        var s = (seed ^ Math.imul(TABLE_SALT, 2654435761)) >>> 0;
        return {
            c2s: shuffleTable(C2S, s),
            s2c: shuffleTable(S2C, (s ^ 2246822507) >>> 0)
        };
    }

    function hexToBytes(hex) {
        var out = new Uint8Array(hex.length / 2);
        for (var i = 0; i < out.length; i++)
            out[i] = parseInt(hex.substr(i * 2, 2), 16);
        return out;
    }

    function toU8(data) {
        if (!data)
            return null;
        if (ArrayBuffer.isView(data))
            return new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
        if (isArrayBuffer(data))
            return new Uint8Array(data);
        return null;
    }

    /* ------------------------------------------------------------ socket state */
    var NativeWS = window.WebSocket;
    var nativeSend = NativeWS.prototype.send;
    var nativeAdd = NativeWS.prototype.addEventListener;
    var states = new WeakMap();
    var gameSocket = null;

    function stateFor(sock) {
        var st = states.get(sock);
        if (!st) {
            st = {
                proto: null,
                owner: null
            };
            states.set(sock, st);
        }
        return st;
    }

    /** Chat relays, alt-server bridges and the like are never the game. */
    function isGameEndpoint(url) {
        try {
            var host = new URL(String(url),location.href).hostname;
            return /(^|\.)moomoo\.io$/.test(host) || host === location.hostname;
        } catch (e) {
            return false;
        }
    }

    /** The bundle's socket is the first live one pointed at the game; anything
     *  the client opens afterwards (bots, relays) is client-owned and keeps the
     *  legacy framing in both directions. */
    function claim(sock) {
        var st = stateFor(sock);
        if (st.owner)
            return st;
        var free = !gameSocket || gameSocket.readyState === 2 || gameSocket.readyState === 3;
        if (free && isGameEndpoint(sock && sock.url)) {
            gameSocket = sock;
            st.owner = "game";
        } else
            st.owner = "mod";
        return st;
    }

    /** io-init carries the per-connection key and opcode seed. */
    function negotiate(st, args) {
        if (args && args[3] === ENCRYPTED_MODE)
            st.proto = {
                key: hexToBytes(String(args[2])),
                tables: buildTables(args[1] >>> 0),
                seq: 0
            };
        else
            st.proto = null;
    }

    function sign(key, payload) {
        return hmac(key, payload).subarray(0, SIG_BYTES);
    }

    /** legacy [type, args] -> wire frame for this connection */
    function writeFrame(st, type, args) {
        var p = st.proto;
        if (!p)
            return mpEncode([type, args]);
        var op = p.tables.c2s.enc[type];
        if (op === undefined)
            return null;
        var payload = mpEncode([op, args, ++p.seq]);
        var frame = new Uint8Array(SIG_BYTES + payload.length);
        frame.set(sign(p.key, payload), 0);
        frame.set(payload, SIG_BYTES);
        return frame;
    }

    /** wire frame produced by the bundle -> legacy [type, args], or null */
    function readFrame(st, buf) {
        var p = st.proto;
        if (!p || !buf || buf.length <= SIG_BYTES)
            return null;
        var payload = buf.subarray(SIG_BYTES)
          , want = sign(p.key, payload);
        for (var i = 0; i < SIG_BYTES; i++)
            if (want[i] !== buf[i])
                return null;
        var parsed;
        try {
            parsed = mpDecode(payload);
        } catch (e) {
            return null;
        }
        if (!Array.isArray(parsed) || typeof parsed[0] !== "number")
            return null;
        var name = p.tables.c2s.dec[parsed[0]];
        if (name === undefined)
            return null;
        return [name, Array.isArray(parsed[1]) ? parsed[1] : []];
    }

    /** a frame written by client code, i.e. plain msgpack [type, args] */
    function readLegacy(buf) {
        var parsed;
        try {
            parsed = mpDecode(buf);
        } catch (e) {
            return null;
        }
        if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== "string")
            return null;
        return [parsed[0], Array.isArray(parsed[1]) ? parsed[1] : []];
    }

    /* ------------------------------------------------------------------ send */
    function hookedSend(data) {
        var st = states.get(this) || claim(this);
        var buf = toU8(data);
        if (!buf)
            return nativeSend.call(this, data);

        var fromGame = readFrame(st, buf);
        if (fromGame) {
            st.owner = "game";
            // Hand it up to whatever the client installed on the prototype, in
            // the shape that code expects. It comes back down here as legacy.
            var upper = NativeWS.prototype.send;
            if (typeof upper === "function" && upper !== hookedSend && !this.__mooInUpper) {
                this.__mooInUpper = true;
                try {
                    return upper.call(this, mpEncode(fromGame));
                } finally {
                    this.__mooInUpper = false;
                }
            }
            // Nothing above us: still re-frame it rather than forwarding the
            // bundle's own bytes, so every packet on this connection is numbered
            // from one counter. Mixing the two would leave a hole or a repeat in
            // the sequence the moment a client hook starts dropping packets.
            var reframed = writeFrame(st, fromGame[0], fromGame[1]);
            return nativeSend.call(this, reframed === null ? buf : reframed);
        }

        var legacy = readLegacy(buf);
        if (!legacy)
            return nativeSend.call(this, buf);
        if (st.owner === null)
            st.owner = "mod";
        var frame = writeFrame(st, legacy[0], legacy[1]);
        if (frame === null)
            return;
        // unknown opcode for this connection: drop rather than desync the seq
        return nativeSend.call(this, frame);
    }

    /* --------------------------------------------------------------- receive */
    function translateEvent(st, ev) {
        var buf = toU8(ev.data);
        if (!buf)
            return ev;
        var parsed;
        try {
            parsed = mpDecode(buf);
        } catch (e) {
            return ev;
        }
        if (!Array.isArray(parsed))
            return ev;
        var type = parsed[0]
          , args = Array.isArray(parsed[1]) ? parsed[1] : [];
        if (typeof type === "number") {
            if (!st.proto)
                return ev;
            type = st.proto.tables.s2c.dec[type];
            if (type === undefined)
                return null;
        }
        var out = mpEncode([type, args]);
        return {
            data: out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength),
            type: "message",
            target: ev.target,
            currentTarget: ev.currentTarget,
            origin: ev.origin,
            lastEventId: ev.lastEventId,
            source: null,
            ports: [],
            isTrusted: false,
            __mooOriginal: ev
        };
    }

    function wrapListener(sock, fn) {
        var handler = typeof fn === "function" ? fn : fn && fn.handleEvent && fn.handleEvent.bind(fn);
        if (!handler)
            return fn;
        var wrapped = function (ev) {
            var st = states.get(sock);
            if (!st)
                return handler.call(this, ev);
            var next = translateEvent(st, ev);
            if (next === null)
                return;
            return handler.call(this, next);
        };
        return wrapped;
    }

    /* ------------------------------------------------------------- install */
    function attach(sock) {
        var st = claim(sock);
        // First listener on the socket, so the tables exist before anything
        // downstream (including the bundle's own onmessage) reads a packet.
        nativeAdd.call(sock, "message", function (ev) {
            var buf = toU8(ev.data);
            if (!buf)
                return;
            var parsed;
            try {
                parsed = mpDecode(buf);
            } catch (e) {
                return;
            }
            if (Array.isArray(parsed) && parsed[0] === "io-init")
                negotiate(st, parsed[1]);
        });
        nativeAdd.call(sock, "close", function () {
            st.proto = null;
        });
    }

    NativeWS.prototype.send = hookedSend;

    NativeWS.prototype.addEventListener = function (type, fn, opts) {
        if (type === "message" && fn && !fn.__mooRaw) {
            var wrapped = wrapListener(this, fn);
            if (wrapped !== fn) {
                if (!this.__mooListeners)
                    this.__mooListeners = new Map();
                this.__mooListeners.set(fn, wrapped);
                return nativeAdd.call(this, type, wrapped, opts);
            }
        }
        return nativeAdd.call(this, type, fn, opts);
    }
    ;

    var nativeRemove = NativeWS.prototype.removeEventListener;
    NativeWS.prototype.removeEventListener = function (type, fn, opts) {
        if (type === "message" && this.__mooListeners && this.__mooListeners.has(fn)) {
            var wrapped = this.__mooListeners.get(fn);
            this.__mooListeners.delete(fn);
            return nativeRemove.call(this, type, wrapped, opts);
        }
        return nativeRemove.call(this, type, fn, opts);
    }
    ;

    // `onmessage` is how the bundle reads its own socket, so it stays raw there.
    // Client-opened sockets (bots) use it too, and those want legacy framing.
    var onmessageDesc = Object.getOwnPropertyDescriptor(NativeWS.prototype, "onmessage");
    if (onmessageDesc && onmessageDesc.set) {
        Object.defineProperty(NativeWS.prototype, "onmessage", {
            configurable: true,
            enumerable: onmessageDesc.enumerable,
            get: function () {
                return this.__mooOnMessage || onmessageDesc.get.call(this);
            },
            set: function (fn) {
                var st = states.get(this);
                if (fn && st && st.owner === "mod") {
                    this.__mooOnMessage = fn;
                    return onmessageDesc.set.call(this, wrapListener(this, fn));
                }
                this.__mooOnMessage = null;
                return onmessageDesc.set.call(this, fn);
            }
        });
    }

    var HookedWS = function WebSocket(url, protocols) {
        var sock = protocols === undefined ? new NativeWS(url) : new NativeWS(url,protocols);
        try {
            attach(sock);
        } catch (e) {}
        return sock;
    };
    HookedWS.prototype = NativeWS.prototype;
    ["CONNECTING", "OPEN", "CLOSING", "CLOSED"].forEach(function (k, i) {
        HookedWS[k] = i;
    });
    // Installed as a non-configurable accessor: the bundle's own
    // `Object.defineProperty(window, "WebSocket", { writable: false })` lockdown
    // then fails inside its try/catch instead of freezing the constructor, and
    // client code that reassigns window.WebSocket afterwards no longer throws.
    var shadowWS = null;
    try {
        Object.defineProperty(window, "WebSocket", {
            configurable: false,
            enumerable: true,
            get: function () {
                return HookedWS;
            },
            set: function (v) {
                shadowWS = v;
            }
        });
    } catch (e) {
        try {
            window.WebSocket = HookedWS;
        } catch (e2) {}
    }

    /* ------------------------------------------------ bundle nuisance removal */
    // The bundle runs `setInterval(() => { debugger }, 1000)` and paints a
    // "disable your extension" banner when it spots a userscript manager.
    var nativeSetInterval = window.setInterval;
    window.setInterval = function (fn, ms) {
        try {
            if (typeof fn === "function" && ms === 1e3 && /^\s*function\s*\(\s*\)\s*\{\s*\(\s*function\s*\(\s*\)\s*\{\s*debugger/.test(String(fn)))
                return 0;
        } catch (e) {}
        return nativeSetInterval.apply(this, arguments);
    }
    ;
    var dropBanner = function () {
        var el = document.getElementById("userscript-warning");
        if (el)
            el.remove();
    };
    if (typeof MutationObserver === "function" && document.documentElement)
        new MutationObserver(dropBanner).observe(document.documentElement, {
            childList: true,
            subtree: true
        });

    /* ------------------------------------------------------------------ api */
    window.__mooTransport = {
        version: 1,
        /** send a packet on the game socket using the legacy name */
        send: function (type) {
            var args = Array.prototype.slice.call(arguments, 1);
            if (!gameSocket)
                return false;
            var st = stateFor(gameSocket)
              , frame = writeFrame(st, type, args);
            if (!frame)
                return false;
            nativeSend.call(gameSocket, frame);
            return true;
        },
        get socket() {
            return gameSocket;
        },
        /** Force a socket onto the client side of the shim: its own frames are
         *  legacy and it wants legacy back. Bundle *forks* (clients that own the
         *  socket themselves rather than hooking the shipped bundle) call this. */
        legacy: function (sock) {
            if (sock)
                stateFor(sock).owner = "mod";
            return sock;
        },
        get negotiated() {
            return !!(gameSocket && stateFor(gameSocket).proto);
        },
        /** whatever the client tried to install over window.WebSocket, if any */
        get userWebSocket() {
            return shadowWS;
        },
        msgpack: {
            encode: mpEncode,
            decode: mpDecode
        },
        _internals: {
            sha256: sha256,
            hmac: hmac,
            buildTables: buildTables,
            shuffleTable: shuffleTable,
            rng: rng,
            hexToBytes: hexToBytes,
            writeFrame: writeFrame,
            readFrame: readFrame,
            readLegacy: readLegacy,
            stateFor: stateFor,
            C2S: C2S,
            S2C: S2C
        }
    };

    if (!window.msgpack)
        window.msgpack = {
            encode: mpEncode,
            decode: mpDecode
        };
}
)();
