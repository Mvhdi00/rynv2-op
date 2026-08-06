// ==UserScript==
// @name        project aurora
// @match       *://*.moomoo.io/*
// @grant       none
// @version     v2.2
// @author      Zylo & Misia & Allah
// @description worldisyours.
// @require     https://cdnjs.cloudflare.com/ajax/libs/msgpack-lite/0.1.26/msgpack.min.js
// @require     https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js
// @run-at       document-start
// ==/UserScript==

(function () {
    "use strict";
    if (typeof window === "undefined" || window.__mooTransport)
        return;

    var utf8enc = new TextEncoder();
    var utf8dec = new TextDecoder();

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

    function mpDecode(buf) {
        var r = new Reader(buf)
          , v = r.next();
        if (r.pos !== buf.length)
            throw new RangeError("msgpack: trailing bytes");
        return v;
    }

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

    function isGameEndpoint(url) {
        try {
            var host = new URL(String(url),location.href).hostname;
            return /(^|\.)moomoo\.io$/.test(host) || host === location.hostname;
        } catch (e) {
            return false;
        }
    }

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

    function hookedSend(data) {
        var st = states.get(this) || claim(this);
        var buf = toU8(data);
        if (!buf)
            return nativeSend.call(this, data);

        var fromGame = readFrame(st, buf);
        if (fromGame) {
            st.owner = "game";

            var upper = NativeWS.prototype.send;
            if (typeof upper === "function" && upper !== hookedSend && !this.__mooInUpper) {
                this.__mooInUpper = true;
                try {
                    return upper.call(this, mpEncode(fromGame));
                } finally {
                    this.__mooInUpper = false;
                }
            }

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

        return nativeSend.call(this, frame);
    }

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

    function attach(sock) {
        var st = claim(sock);

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

    window.__mooTransport = {
        version: 1,

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

        legacy: function (sock) {
            if (sock)
                stateFor(sock).owner = "mod";
            return sock;
        },
        get negotiated() {
            return !!(gameSocket && stateFor(gameSocket).proto);
        },

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

(function () {
    var __clientMain = function () {

/*

version: v2.0 added new visuals,new heal / rocled heal,new spiketick.
version: v2.1 added new function auto spin,mirror chat,best replacer.
version: v2.2 added new dmg,added new placer.


──────▄▄▄▄▄███████████████████▄▄▄▄▄──────
────▄██████████▀▀▀▀▀▀▀▀▀▀██████▀████▄────
──▄██▀████████▄─────────────▀▀████─▀██▄──
─▀██▄▄██████████████████▄▄▄─────────▄██▀─
───▀█████████████████████████▄────▄██▀───
─────▀████▀▀▀▀▀▀▀▀▀▀▀▀█████████▄▄██▀─────
───────▀███▄──────────────▀██████▀───────
─────────▀██████▄─────────▄████▀─────────
────────────▀█████▄▄▄▄▄▄▄███▀────────────
──────────────▀████▀▀▀████▀──────────────
────────────────▀███▄███▀────────────────
───────────────────▀█▀───────────────────


*/
(function () {
    // create audio
    const sound = new Audio("https://freesound.org/data/previews/341/341695_3248244-lq.mp3"); // Replace with any sound URL
    sound.volume = 0.5;

    // aaaaaaauuu
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.backgroundColor = "#0b0f00";
    overlay.style.zIndex = 99999;
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.userSelect = "none";
    overlay.style.overflow = "hidden";
    overlay.style.opacity = "1";
    overlay.style.transition = "opacity 0.5s ease-out";
    document.body.appendChild(overlay);

    // glowing aaaaaa
    const content = document.createElement("div");
    content.style.display = "flex";
    content.style.flexDirection = "column";
    content.style.alignItems = "center";
    content.style.justifyContent = "center";
    content.style.color = "#c6a9ff";
    content.style.fontFamily = "Arial, sans-serif";
    content.style.transition = "transform 0.6s ease, opacity 0.6s ease";
    content.style.transform = "scale(1)";
    content.style.opacity = "1";
    content.style.textShadow = "0 0 10px #c6a9ff, 0 0 20px #a06fff";
    overlay.appendChild(content);

    // the welcome text ajajajaj
    const title = document.createElement("h1");
    title.textContent = "Welcome";
    title.style.fontSize = "4em";
    content.appendChild(title);

    // subtitle with typing effect
    const subtitle = document.createElement("h2");
    subtitle.style.fontSize = "2em";
    content.appendChild(subtitle);

    const typingText = "Press Enter to continue";
    let charIndex = 0;

    function typeLetter() {
        if (charIndex < typingText.length) {
            subtitle.textContent += typingText[charIndex];
            charIndex++;
            setTimeout(typeLetter, 50);
        }
    }

    typeLetter();

    // creating snowflake ssssssss
    function createSnowflake() {
        const snowflake = document.createElement("div");
        snowflake.textContent = "❄";
        snowflake.style.position = "fixed";
        snowflake.style.top = "-20px";
        snowflake.style.left = Math.random() * 100 + "vw";
        snowflake.style.fontSize = (Math.random() * 10 + 10) + "px";
        snowflake.style.color = "#00d5ff";
        snowflake.style.zIndex = 100000;
        snowflake.style.pointerEvents = "none";
        snowflake.style.userSelect = "none";
        const duration = Math.random() * 3 + 2;
        snowflake.style.transition = `transform ${duration}s linear, opacity ${duration}s`;

        document.body.appendChild(snowflake);

        requestAnimationFrame(() => {
            snowflake.style.transform = `translateY(110vh)`;
            snowflake.style.opacity = "0";
        });

        setTimeout(() => snowflake.remove(), duration * 1000);
    }

    const snowInterval = setInterval(createSnowflake, 200);

    const keyHandler = (e) => {
        if (e.key === "Enter") {
            // play sound oy hea
            sound.play().catch(() => {});

            //
            content.style.transform = "scale(0.7)";
            content.style.opacity = "0";

            clearInterval(snowInterval);
            document.removeEventListener("keydown", keyHandler);

            //
            setTimeout(() => {
                overlay.style.opacity = "0";
            }, 600);

            //
            setTimeout(() => {
                overlay.remove();
            }, 1100);
        }
    };

    document.addEventListener("keydown", keyHandler);
})();


function showNicknamePrompt() {
  // create overlay with special effects
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.backgroundColor = "#0b0f00";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.color = "#c6a9ff";
  overlay.style.fontFamily = "Arial, sans-serif";
  overlay.style.userSelect = "none";
  overlay.style.zIndex = 9999;
  overlay.style.padding = "20px";
  overlay.style.textAlign = "center";
  overlay.style.transition = "opacity 0.6s ease";
  overlay.style.opacity = "0";
  document.body.appendChild(overlay);

  // fade in overlay
  setTimeout(() => {
    overlay.style.opacity = "1";
  }, 200);

  // Prompt text (smaller)
  const promptText = document.createElement("h2");
  promptText.textContent = "Enter your nickname";
  promptText.style.marginBottom = "30px";
  promptText.style.fontSize = "1.5em";  // smaller font than before
  promptText.style.fontWeight = "normal";
  overlay.appendChild(promptText);

  // Input box
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Your nickname...";
  input.style.padding = "15px 30px";
  input.style.fontSize = "1em";
  input.style.borderRadius = "10px";
  input.style.border = "none";
  input.style.outline = "none";
  input.style.marginBottom = "25px";
  input.style.textAlign = "center";
  input.style.width = "300px";
  overlay.appendChild(input);

  // countinue button
  const button = document.createElement("button");
  button.textContent = "Continue";
  button.style.padding = "15px 40px";
  button.style.fontSize = "1.6em";
  button.style.borderRadius = "10px";
  button.style.border = "none";
  button.style.backgroundColor = "#8a5fff";
  button.style.color = "#fff";
  button.style.cursor = "pointer";
  button.style.transition = "background 0.3s";
  button.onmouseover = () => (button.style.backgroundColor = "#a47fff");
  button.onmouseleave = () => (button.style.backgroundColor = "#8a5fff");
  overlay.appendChild(button);

  // message div
  const message = document.createElement("div");
  message.style.marginTop = "40px";
  message.style.fontSize = "1.2em";  // moderately bigger but not too big
  message.style.opacity = "0";
  message.style.transition = "opacity 0.8s ease";
  overlay.appendChild(message);

  button.onclick = () => {
    const name = input.value.trim();
    if (!name) {
      alert("Please enter a nickname!");
      return;
    }

    // Hide input, button and prompt text
    promptText.style.display = "none";
    input.style.display = "none";
    button.style.display = "none";

    // show welcome message with you nickname and mod descreption
    message.innerHTML = `
      Welcome to project aurora v2.2! <strong style="color:#d49fff;"></strong>, <strong>${name}</strong>!<br><br>
      Try new version of aurora domiate all!<br>
      <span style="color:#00ffee;">Have nice game!</span><span style="color:#ff5e5e;">All is yours!</span>
    `;
    message.style.opacity = "1";

    // after 4 seconds trying to fade out and remove overlay
    setTimeout(() => {
      overlay.style.opacity = "0";
      setTimeout(() => {
        overlay.remove();
      }, 600);
    }, 4000);
  };
}

setTimeout(showNicknamePrompt, 1200);


(function(_0x352b46,_0xf87036){const _0x138286=_0x4934,_0xd16a12=_0x352b46();while(!![]){try{const _0x338e20=parseInt(_0x138286(0xd8))/0x1*(parseInt(_0x138286(0xe6))/0x2)+parseInt(_0x138286(0xcf))/0x3*(-parseInt(_0x138286(0xde))/0x4)+-parseInt(_0x138286(0xdb))/0x5*(-parseInt(_0x138286(0xd1))/0x6)+parseInt(_0x138286(0x10f))/0x7*(-parseInt(_0x138286(0x113))/0x8)+-parseInt(_0x138286(0x108))/0x9+-parseInt(_0x138286(0x112))/0xa*(parseInt(_0x138286(0x10b))/0xb)+-parseInt(_0x138286(0xd5))/0xc*(-parseInt(_0x138286(0xf5))/0xd);if(_0x338e20===_0xf87036)break;else _0xd16a12['push'](_0xd16a12['shift']());}catch(_0xc7e77b){_0xd16a12['push'](_0xd16a12['shift']());}}}(_0x49fa,0x7dc66),setTimeout(showNicknamePrompt,0x4b0));function _0x4934(_0xa87868,_0x390cf7){const _0x49fa83=_0x49fa();return _0x4934=function(_0x493461,_0x3bf6fd){_0x493461=_0x493461-0xc8;let _0x1699aa=_0x49fa83[_0x493461];return _0x1699aa;},_0x4934(_0xa87868,_0x390cf7);}function _0x49fa(){const _0x159790=['center','15IVmKEx','userSelect','backgroundColor','308192wxUHWZ','10px','onmouseover','input','40px','20px','transition','fixed','452108WgBKmX','marginBottom','1.6em','onmouseleave','onclick','appendChild','flexDirection','\x0a\x20\x20\x20\x20\x20\x20\x20\x20Access\x20<strong\x20style=\x22color:#00ffcc;\x22>granted</strong>.<br>\x0a\x20\x20\x20\x20\x20\x20\x20\x20Welcome\x20to\x20<strong\x20style=\x22color:#d49fff;\x22>aurora\x20Project</strong>!\x0a\x20\x20\x20\x20\x20\x20','15px\x2030px','outline','placeholder','background\x200.3s','Incorrect\x20password!','borderRadius','fontFamily','5447kFGyAc','textAlign','textContent','#ff5e5e','color','#8a5fff','style','none','width','top','15px\x2040px','justifyContent','remove','password','100vw','worldisyours.','cursor','300px','type','5229801eXqBQG','opacity\x200.6s\x20ease','1.2em','251152zEezey','fontWeight','opacity','div','728ApKbFb','padding','Continue','330SoHLHX','68768cVLDMp','fontSize','Arial,\x20sans-serif','button','25px','#fff','pointer','#c6a9ff','30cJuCLs','innerHTML','1967244rIatSo','alignItems','marginTop','column','53052cHsOEF','createElement','30px','3BYmYIw','Please\x20enter\x20a\x20password!'];_0x49fa=function(){return _0x159790;};return _0x49fa();}function showPasswordPrompt(){const _0x5e3e9c=_0x4934,_0x87ca99=_0x5e3e9c(0x104),_0x194a50=document[_0x5e3e9c(0xd6)](_0x5e3e9c(0x10e));_0x194a50[_0x5e3e9c(0xfb)]['position']=_0x5e3e9c(0xe5),_0x194a50[_0x5e3e9c(0xfb)][_0x5e3e9c(0xfe)]=0x0,_0x194a50[_0x5e3e9c(0xfb)]['left']=0x0,_0x194a50[_0x5e3e9c(0xfb)][_0x5e3e9c(0xfd)]=_0x5e3e9c(0x103),_0x194a50[_0x5e3e9c(0xfb)]['height']='100vh',_0x194a50[_0x5e3e9c(0xfb)][_0x5e3e9c(0xdd)]='#0b0f00',_0x194a50[_0x5e3e9c(0xfb)]['display']='flex',_0x194a50[_0x5e3e9c(0xfb)][_0x5e3e9c(0xec)]=_0x5e3e9c(0xd4),_0x194a50[_0x5e3e9c(0xfb)][_0x5e3e9c(0x100)]='center',_0x194a50['style'][_0x5e3e9c(0xd2)]=_0x5e3e9c(0xda),_0x194a50['style'][_0x5e3e9c(0xf9)]=_0x5e3e9c(0xce),_0x194a50[_0x5e3e9c(0xfb)][_0x5e3e9c(0xf4)]=_0x5e3e9c(0xc9),_0x194a50[_0x5e3e9c(0xfb)][_0x5e3e9c(0xdc)]=_0x5e3e9c(0xfc),_0x194a50['style']['zIndex']=0x270f,_0x194a50[_0x5e3e9c(0xfb)][_0x5e3e9c(0x110)]=_0x5e3e9c(0xe3),_0x194a50['style'][_0x5e3e9c(0xf6)]='center',_0x194a50['style'][_0x5e3e9c(0xe4)]=_0x5e3e9c(0x109),_0x194a50[_0x5e3e9c(0xfb)][_0x5e3e9c(0x10d)]='0',document['body'][_0x5e3e9c(0xeb)](_0x194a50),setTimeout(()=>{const _0x39ebca=_0x5e3e9c;_0x194a50[_0x39ebca(0xfb)][_0x39ebca(0x10d)]='1';},0xc8);const _0x59959d=document[_0x5e3e9c(0xd6)]('h2');_0x59959d[_0x5e3e9c(0xf7)]='Please\x20enter\x20password',_0x59959d[_0x5e3e9c(0xfb)][_0x5e3e9c(0xe7)]=_0x5e3e9c(0xd7),_0x59959d[_0x5e3e9c(0xfb)]['fontSize']='1.5em',_0x59959d[_0x5e3e9c(0xfb)][_0x5e3e9c(0x10c)]='normal',_0x194a50['appendChild'](_0x59959d);const _0x30b41b=document[_0x5e3e9c(0xd6)](_0x5e3e9c(0xe1));_0x30b41b[_0x5e3e9c(0x107)]=_0x5e3e9c(0x102),_0x30b41b[_0x5e3e9c(0xf0)]='Password...',_0x30b41b[_0x5e3e9c(0xfb)]['padding']=_0x5e3e9c(0xee),_0x30b41b['style']['fontSize']='1em',_0x30b41b['style'][_0x5e3e9c(0xf3)]=_0x5e3e9c(0xdf),_0x30b41b[_0x5e3e9c(0xfb)]['border']=_0x5e3e9c(0xfc),_0x30b41b['style'][_0x5e3e9c(0xef)]=_0x5e3e9c(0xfc),_0x30b41b['style'][_0x5e3e9c(0xe7)]=_0x5e3e9c(0xcb),_0x30b41b[_0x5e3e9c(0xfb)]['textAlign']=_0x5e3e9c(0xda),_0x30b41b[_0x5e3e9c(0xfb)][_0x5e3e9c(0xfd)]=_0x5e3e9c(0x106),_0x194a50[_0x5e3e9c(0xeb)](_0x30b41b);const _0x1afadd=document[_0x5e3e9c(0xd6)](_0x5e3e9c(0xca));_0x1afadd[_0x5e3e9c(0xf7)]=_0x5e3e9c(0x111),_0x1afadd['style']['padding']=_0x5e3e9c(0xff),_0x1afadd[_0x5e3e9c(0xfb)][_0x5e3e9c(0xc8)]=_0x5e3e9c(0xe8),_0x1afadd['style'][_0x5e3e9c(0xf3)]=_0x5e3e9c(0xdf),_0x1afadd[_0x5e3e9c(0xfb)]['border']=_0x5e3e9c(0xfc),_0x1afadd['style'][_0x5e3e9c(0xdd)]=_0x5e3e9c(0xfa),_0x1afadd[_0x5e3e9c(0xfb)]['color']=_0x5e3e9c(0xcc),_0x1afadd['style'][_0x5e3e9c(0x105)]=_0x5e3e9c(0xcd),_0x1afadd[_0x5e3e9c(0xfb)]['transition']=_0x5e3e9c(0xf1),_0x1afadd[_0x5e3e9c(0xe0)]=()=>_0x1afadd[_0x5e3e9c(0xfb)][_0x5e3e9c(0xdd)]='#a47fff',_0x1afadd[_0x5e3e9c(0xe9)]=()=>_0x1afadd['style'][_0x5e3e9c(0xdd)]=_0x5e3e9c(0xfa),_0x194a50[_0x5e3e9c(0xeb)](_0x1afadd);const _0x8e765b=document[_0x5e3e9c(0xd6)](_0x5e3e9c(0x10e));_0x8e765b['style'][_0x5e3e9c(0xd3)]=_0x5e3e9c(0xe2),_0x8e765b['style'][_0x5e3e9c(0xc8)]=_0x5e3e9c(0x10a),_0x8e765b[_0x5e3e9c(0xfb)][_0x5e3e9c(0x10d)]='0',_0x8e765b['style'][_0x5e3e9c(0xe4)]='opacity\x200.8s\x20ease',_0x194a50['appendChild'](_0x8e765b),_0x1afadd[_0x5e3e9c(0xea)]=()=>{const _0x30e9f4=_0x5e3e9c,_0x24020b=_0x30b41b['value']['trim']();if(!_0x24020b){alert(_0x30e9f4(0xd9));return;}_0x24020b===_0x87ca99?(_0x59959d[_0x30e9f4(0xfb)]['display']=_0x30e9f4(0xfc),_0x30b41b[_0x30e9f4(0xfb)]['display']=_0x30e9f4(0xfc),_0x1afadd['style']['display']=_0x30e9f4(0xfc),_0x8e765b[_0x30e9f4(0xd0)]=_0x30e9f4(0xed),_0x8e765b[_0x30e9f4(0xfb)][_0x30e9f4(0x10d)]='1',setTimeout(()=>{const _0x544f6c=_0x30e9f4;_0x194a50[_0x544f6c(0xfb)][_0x544f6c(0x10d)]='0',setTimeout(()=>_0x194a50[_0x544f6c(0x101)](),0x258);},0xbb8)):(_0x8e765b[_0x30e9f4(0xf7)]=_0x30e9f4(0xf2),_0x8e765b['style'][_0x30e9f4(0xf9)]=_0x30e9f4(0xf8),_0x8e765b[_0x30e9f4(0xfb)]['opacity']='1');};}setTimeout(showPasswordPrompt,0x4b0);




setInterval(() => {
    console.clear()
}, 180000);
const wutezez = document.createElement("div");
wutezez.textContent = "Welcome to aurora!";
wutezez.style.position = "fixed";
wutezez.style.top = "-100px";
wutezez.style.left = "50%";
wutezez.style.backgroundColor = "black";
wutezez.style.color = "white";
wutezez.style.padding = "15px";
wutezez.style.fontSize = "15px";
wutezez.style.borderRadius = "10px";
wutezez.style.transition = "top 1s, opacity 1s";
wutezez.style.zIndex = "9999";
document.body.appendChild(wutezez);
setTimeout(() => {
    wutezez.style.top = "0";
    wutezez.style.opacity = "1";
}, 500);
setTimeout(() => {
    wutezez.style.opacity = "0";
    setTimeout(() => {
        wutezez.remove();
    }, 1000);
}, 3000);
let serverID
(function(modules) {
    let cache = {};
    function require(id) {
        if (cache[id]) return cache[id].exports;
        let module = {
            exports: {}
        };
        modules[id](module, module.exports, require);
        cache[id] = module;
        return module.exports;
    }
    require.s = "_main_script_";
    return require(require.s);
})({
    "config.js": function(module, exports) {
        // RENDER:
        module.exports.maxScreenWidth = 1920;
        module.exports.maxScreenHeight = 1080;

        // SERVER:
        module.exports.serverUpdateRate = 9;
        module.exports.maxPlayers = 40;
        module.exports.maxPlayersHard = module.exports.maxPlayers + 10;
        module.exports.collisionDepth = 6;
        module.exports.minimapRate = 2000;

        // COLLISIONS:
        module.exports.colGrid = 10;

        // CLIENT:
        module.exports.clientSendRate = 5;

        // UI:
        module.exports.healthBarWidth = 50;
        module.exports.healthBarPad = 4.5;
        module.exports.iconPadding = 15;
        module.exports.iconPad = 0.9;
        module.exports.deathFadeout = 3000;
        module.exports.crownIconScale = 60;
        module.exports.crownPad = 35;

        // CHAT:
        module.exports.chatCountdown = 3000;
        module.exports.chatCooldown = 500;

        // SANDBOX:
        module.exports.isSandbox = window.location.hostname == "sandbox.moomoo.io" ? true : false;

        // PLAYER:
        module.exports.maxAge = 100;
        module.exports.gatherAngle = Math.PI/2.6;
        module.exports.gatherWiggle = 10;
        module.exports.hitReturnRatio = 0.25;
        module.exports.hitAngle = Math.PI / 2;
        module.exports.playerScale = 35;
        module.exports.playerSpeed = 0.0016;
        module.exports.playerDecel = 0.993;
        module.exports.nameY = 34;

        // CUSTOMIZATION:
        module.exports.skinColors = ["#bf8f54", "#cbb091", "#896c4b",
                                     "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3",
                                     "#8bc373"];

        // ANIMALS:
        module.exports.animalCount = 7;
        module.exports.aiTurnRandom = 0.06;
        module.exports.cowNames = ["Sid", "Steph", "Bmoe", "Romn", "Jononthecool", "Fiona", "Vince", "Nathan", "Nick", "Flappy", "Ronald", "Otis", "Pepe", "Mc Donald", "Theo", "Fabz", "Oliver", "Jeff", "Jimmy", "Helena", "Reaper",
                                   "Ben", "Alan", "Naomi", "XYZ", "Clever", "Jeremy", "Mike", "Destined", "Stallion", "Allison", "Meaty", "Sophia", "Vaja", "Joey", "Pendy", "Murdoch", "Theo", "Jared", "July", "Sonia", "Mel", "Dexter", "Quinn", "Milky"];

        // WEAPONS:
        module.exports.shieldAngle = Math.PI/3;
        module.exports.weaponVariants = [{
            id: 0,
            src: "",
            xp: 0,
            val: 1
        }, {
            id: 1,
            src: "_g",
            xp: 3000,
            val: 1.1
        }, {
            id: 2,
            src: "_d",
            xp: 7000,
            val: 1.18
        }, {
            id: 3,
            src: "_r",
            poison: true,
            xp: 12000,
            val: 1.18
        }];
        module.exports.fetchVariant = function(player) {
            var tmpXP = player.weaponXP[player.weaponIndex]||0;
            for (var i = module.exports.weaponVariants.length - 1; i >= 0; --i) {
                if (tmpXP >= module.exports.weaponVariants[i].xp) {
                    return module.exports.weaponVariants[i];
                }
            }
        };

        // NATURE:
        module.exports.resourceTypes = ["wood", "food", "stone", "points"];
        module.exports.areaCount = 7;
        module.exports.treesPerArea = 9;
        module.exports.bushesPerArea = 3;
        module.exports.totalRocks = 32;
        module.exports.goldOres = 7;
        module.exports.riverWidth = 724;
        module.exports.riverPadding = 114;
        module.exports.waterCurrent = 0.0011;
        module.exports.waveSpeed = 0.0001;
        module.exports.waveMax = 1.3;
        module.exports.treeScales = [150, 160, 165, 175];
        module.exports.bushScales = [80, 85, 95];
        module.exports.rockScales = [80, 85, 90];

        // BIOME DATA:
        module.exports.snowBiomeTop = 2400;
        module.exports.snowSpeed = 0.75;

        // DATA:
        module.exports.maxNameLength = 15;

        // MAP:
        module.exports.mapScale = 14400;
        module.exports.mapPingScale = 40;
        module.exports.mapPingTime = 2200;


        // VOLCANO:
        module.exports.volcanoScale = 320;
        module.exports.innerVolcanoScale = 100;
        module.exports.volcanoAnimalStrength = 2;
        module.exports.volcanoAnimationDuration = 3200;
        module.exports.volcanoAggressionRadius = 1440;
        module.exports.volcanoAggressionPercentage = 0.2;
        module.exports.volcanoDamagePerSecond = -1;
        module.exports.volcanoLocationX = 14400 - 440;
        module.exports.volcanoLocationY = 14400 - 440;
    },
    "_UIS_client_": function(module, exports) {
        let e = (id) => document.getElementById(id);
        module.exports = {
            ads: {
                adCard: e("adCard"),
                adContainer: e("ad-container"),
                promoImg: e("promoImg"),
                promoImageHolder: e("promoImgHolder"),
                wideAdCard: e("wideAdCard"),
            },
            buttons: {
                store: e("storeButton"),
                alliance: e("allianceButton"),
                chat: e("chatButton"),
                enterGame: e("enterGame"),
                altchaCheckBox: e("altcha_checkbox"),
                partyButton: e("partyButton"),
                joinB: e("joinPartyButton"),
                settingsButton: e("settingsButton"),
                settingsButtonTitle: e("settingsButton").getElementsByTagName('span')[0],
            },
            resources: {
                food: e("foodDisplay"),
                wood: e("woodDisplay"),
                stone: e("stoneDisplay"),
                score: e("scoreDisplay"),
                kill: e("killCounter"),
            },
            global: {// i made this since im to lazy to make catagorize for them
                menuText: e("desktopInstructions"),
                setupCard: e("setupCard"),
                guideCard: e("guideCard"),
                gameUI: e("gameUI"),
                gameName: e("gameName"),
                mainMenu: e("mainMenu"),
                storeMenu: e("storeMenu"),
                nameInput: e("nameInput"),
                gameCanvas: e("gameCanvas"),
                gameContext: e("gameCanvas").getContext("2d"),
                mapDisplay: e("mapDisplay"),
                mapContext: e("mapDisplay").getContext("2d"),
                shutdownDisplay: e("shutdownDisplay"),
                pingDisplay: e("pingDisplay"),
                loadingText: e("loadingText"),
                diedText: e("diedText"),
                ageText: e("ageText"),
                ageBarBody: e("ageBarBody"),
                allianceMenu: e("allianceMenu"),
                allianceManager: e("allianceManager"),
                notificationDisplay: e("notificationDisplay"),
                leaderboardData: e("leaderboardData"),
                actionBar: e("actionBar"),
                playMusic: e("playMusic"),
                upgradeCounter: e("upgradeCounter"),
                chatBox: e("chatBox"),
                altcha: e("altcha")
            },
            holder: {
                menuCardHolder: e("menuCardHolder"),
                itemInfoHolder: e("itemInfoHolder"),
                upgradeHolder: e("upgradeHolder"),
                allianceHolder: e("allianceHolder"),
                skinColorHolder: e("skinColorHolder"),
                storeHolder: e("storeHolder"),
                chatHolder: e("chatHolder"),
            },
            server: {
                serverBrowser: e("serverBrowser"),
                nativeResolutionOption: e("nativeResolution"),
                showPingOption: e("showPing"),
            },
        };
    },
    "_main_script_": function(module, exports, require) {
        // CONFIG:
        var config = require("config.js");
        window.config = config;

        // UIS:
        var UIS = require("_UIS_client_");
        var menuText = UIS.global.menuText;
        var setupCard = UIS.global.setupCard;
        var guideCard = UIS.global.guideCard;
        var gameName = UIS.global.gameName;
        var gameUI = UIS.global.gameUI;
        var mainMenu = UIS.global.mainMenu;
        var storeMenu = UIS.global.storeMenu;
        var nameInput = UIS.global.nameInput;
        var gameCanvas = UIS.global.gameCanvas;
        var gameContext = UIS.global.gameContext;
        var mapDisplay = UIS.global.mapDisplay;
        var mapContext = UIS.global.mapContext;
        var shutdownDisplay = UIS.global.shutdownDisplay;
        var pingDisplay = UIS.global.pingDisplay;
        var loadingText = UIS.global.loadingText;
        var diedText = UIS.global.diedText;
        var ageText = UIS.global.ageText;
        var ageBarBody = UIS.global.ageBarBody;
        var allianceMenu = UIS.global.allianceMenu;
        var allianceManager = UIS.global.allianceManager;
        var notificationDisplay = UIS.global.notificationDisplay;
        var leaderboardData = UIS.global.leaderboardData;
        var actionBar = UIS.global.actionBar;
        var playMusic = UIS.global.playMusic;
        var upgradeCounter = UIS.global.upgradeCounter;
        var chatBox = UIS.global.chatBox;
        var altcha = UIS.global.altcha;

        // BUTTON:
        var storeButton = UIS.buttons.store;
        var allianceButton = UIS.buttons.alliance;
        var chatButton = UIS.buttons.chat;
        var enterGameButton = UIS.buttons.enterGame;
        var altchaButton = UIS.buttons.altchaCheckBox
        var partyButton = UIS.buttons.partyButton;
        var joinB = UIS.buttons.joinB;
        var settingsButton = UIS.buttons.settingsButton;
        var settingsButtonTitle = UIS.buttons.settingsButtonTitle;

        chatButton.remove();

        // RESOURCE:
        var foodDisplay = UIS.resources.food;
        var woodDisplay = UIS.resources.wood;
        var stoneDisplay = UIS.resources.stone;
        var scoreDisplay = UIS.resources.score;
        var killCounter = UIS.resources.kill;


        // ADS:
        var adCard = UIS.ads.adCard;
        var adContainer = UIS.ads.adContainer;
        var promoImg = UIS.ads.promoImg;
        var promoImageHolder = UIS.ads.promoImageHolder;
        var wideAdCard = UIS.ads.wideAdCard;
        var ads = Object.values(UIS.ads);
        promoImg.remove();
        adCard.remove();
        wideAdCard.remove();

        // HOLDER:
        var menuCardHolder = UIS.holder.menuCardHolder;
        var itemInfoHolder = UIS.holder.itemInfoHolder;
        var upgradeHolder = UIS.holder.upgradeHolder;
        var allianceHolder = UIS.holder.allianceHolder;
        var skinColorHolder = UIS.holder.skinColorHolder;
        var storeHolder = UIS.holder.storeHolder;
        var chatHolder = UIS.holder.chatHolder;

        // SETTING:
        var serverBrowser = UIS.server.serverBrowser;
        var nativeResolutionOption = UIS.server.nativeResolutionOption;
        var showPingOption = UIS.server.showPingOption;

        // CTX || CONTEXT:
        var mainContext = gameCanvas.getContext("2d");

        // GAME UI;
        function hover(html) {// sorry me was to lazy to DO THEM BY ONE
            html.style.opacity = '0';
            html.style.transition = 'opacity 0.5s ease, transform 0.3s ease';
            html.style.transform = 'scale(1)';
            html.onmouseover = function() {
                html.style.opacity = '1';
                html.style.transform = 'scale(1.05)';
            };
            html.onmouseout = function() {
                html.style.transform = 'scale(1)';
            };
        }
 mapDisplay.style = `
                            width: 130px;
                            height: 130px;
                            bottom: 20px;
                            left: 20px;
                            top: auto;
                        `;
        let coolFont = document.createElement('link');
        coolFont.href = "https://fonts.googleapis.com/css2?family=Lilita+One&display=swap";
        coolFont.rel = "stylesheet";
        document.head.appendChild(coolFont);
        gameName.innerHTML = "Inf";
        gameName.style.cssText = `
        display: "none";
        opacity: 0.85;
        text-shadow: 0 1px 0 #c4c4c4, 0 2px 0 #c4c4c4, 0 3px 0 #c4c4c4, 0 4px 0 #c4c4c4, 0 5px 0 #c4c4c4, 0 6px 0 #c4c4c4, 0 7px 0 #c4c4c4, 0 8px 0 #c4c4c4, 0 9px 0 #c4c4c4;
        font-size: 100px;
        font-family: 'Lilita One', sans-serif;
        opacity: 0;
        transition: opacity 0.5s ease;
        `;
        altcha.style.display = 'none';
        let annoyingAltchaStuff = setInterval(() => {
            altchaButton.click();
            let verifyStateHTML = altcha.querySelector(".altcha-label span");
            if (verifyStateHTML) {
                let brokenAltcha = verifyStateHTML.textContent.trim() === "Verified" && enterGameButton.classList.contains("disabled")
                if (brokenAltcha) {
                    location.reload();
                }
                if (inGame) {
                    clearInterval(annoyingAltchaStuff);
                }
            }
        }, 890)
        window.addEventListener("load", () => {
            setTimeout(() => {
                const currentURL = window.location.href;




// Add the new title at the top of the leaderboard
leaderboard.insertBefore(titleElement, leaderboard.firstChild);

                // Regular expression to match the 'server' parameter
                const match = currentURL.match(/[?&]server=([^&]+)/);

                if (match && match[1]) {
                    const server = decodeURIComponent(match[1]);
                    serverID = server;
                } else {
                    location.reload();
                }
                if (altcha.querySelector(".altcha-label span").textContent.trim() === "Verifying...") {
                    location.reload();
                }
            }, 5000)
        });
        document.getElementById("promoImgHolder").append(document.getElementById("skinColorHolder"));
        document.getElementById("skinColorHolder").style.cssText = `
        display: flex;
        justify-content: center;
        gap: 10px;
        align-items: center;
        flex-wrap: nowrap;
        padding: 10px;
        background-color: rgba(0, 0, 0, 0.25);
        border-radius: 8px;
        `;

        let serverMenu = document.createElement("div");
        serverMenu.id = "serverMenu";
        serverMenu.style.cssText = `
    position: fixed;
    top: 240px;
    left: 1250px;
    width: 280px;
    opacity: 0;
    height: auto;
    max-height: 275px;
    overflow-y: auto;
    background-color: rgba(0, 0, 0, 0.45);
    padding: 10px;
    border-radius: 8px;
    color: #fff;
    font-family: Arial, sans-serif;
    z-index: 1000;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
    transition: opacity 0.3s ease-in-out;
`;
        document.body.appendChild(serverMenu);
        let buttonContainer = document.createElement("div");
        buttonContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 15px;
    padding: 10px;
`;
        serverMenu.appendChild(buttonContainer);

        let testServerButton = document.createElement("button");
        testServerButton.textContent = "Join Test Server";
        testServerButton.style.cssText = `
    background-color: #28a745;
    border: none;
    color: white;
    padding: 10px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s;
`;
        testServerButton.addEventListener("click", async () => {
            let servers = await getServers();
            let testServer = servers.filter(server => server.playerCount === 0)
            .sort((a, b) => a.ping - b.ping)[0];

            if (testServer) {
                let newUrl = `${location.protocol}//${location.hostname}/?server=${testServer.region}:${testServer.name}`;
                window.location.href = newUrl;
            } else {
                alert("Wla Pang test server");
            }
        });
        buttonContainer.appendChild(testServerButton);

        let largestServerButton = document.createElement("button");
        largestServerButton.textContent = "Join Active Server";
        largestServerButton.style.cssText = `
    background-color: #007bff;
    border: none;
    color: white;
    padding: 8px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s;
`;
        largestServerButton.addEventListener("click", async () => {
            let servers = await getServers();
            let largestServer = servers.sort((a, b) => {
                if (a.playerCount === b.playerCount) return a.ping - b.ping;
                return b.playerCount - a.playerCount;
            })[0];

            if (largestServer) {
                let newUrl = `${location.protocol}//${location.hostname}/?server=${largestServer.region}:${largestServer.name}`;
                window.location.href = newUrl;
            } else {
                alert("wala nga ehh");
            }
        });
        buttonContainer.appendChild(largestServerButton);

        let gameServers = document.createElement("div");
        gameServers.id = "game_servers";
        serverMenu.appendChild(gameServers);
        let style = document.createElement("style");
        style.innerHTML = `
    #game_servers::-webkit-scrollbar {
        width: 8px;
    }
    #game_servers::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
    }
    #game_servers::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.4);
        border-radius: 4px;
    }
    #game_servers::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.6);
    }
`;
        document.head.appendChild(style);
        window.regionsName = {
            "eu-west": "Frankfurt",
            gb: "London",
            "us-east": "Miami",
            "us-west": "Silicon Valley",
            au: "Sydney",
            sg: "Singapore",
            saopaulo: "São Paulo"
        };
        async function getServers() {
            let currentMode = location.host.replace(/\.moomoo\.io/, "");
            let getRequestUrl = () => {
                if (/(sandbox|dev)/.test(currentMode)) {
                    return `https://api-${currentMode}.moomoo.io/servers?v=1.26`;
                }
                return "https://api.moomoo.io/servers";
            };
            let response = await fetch(getRequestUrl());
            let servers = await response.json();
            await Promise.all(servers.map(async server => {
                let requestPingUrl = `https://${server.key}.${server.region}.moomoo.io/ping/`;
                let startTime = Date.now();
                try {
                    await fetch(requestPingUrl);
                    server.ping = Date.now() - startTime;
                } catch (error) {
                    server.ping = Infinity;
                }
            }));

            return servers;
        }
        async function updateServers() {
            let servers = await getServers();
            let serversByRegion = {};
            servers.forEach(server => {
                serversByRegion[server.region] = serversByRegion[server.region] || [];
                serversByRegion[server.region].push(server);
            });

            let sortedServers = [];
            for (let region in serversByRegion) {
                sortedServers = sortedServers.concat(serversByRegion[region]);
            }
            sortedServers.sort((a, b) => {
                if (a.ping === b.ping) return b.playerCount - a.playerCount;
                return a.ping - b.ping;
            });
            let existingBoxes = {};
            gameServers.childNodes.forEach(box => {
                existingBoxes[box.dataset.serverKey] = box;
            });
            sortedServers.forEach(server => {
                let key = `${server.region}:${server.name}`;
                let serverBox = existingBoxes[key];

                if (!serverBox) {
                    serverBox = document.createElement("div");
                    serverBox.dataset.serverKey = key;
                    serverBox.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                background-color: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                margin: 3px 0;
                margin-bottom: 16px;
                margin-left: 10px;
                padding: 8px;
            `;
                    gameServers.appendChild(serverBox);
                }
                let colorPlc = server.playerCount >= 25 ? "red" : server.playerCount >= 15 ? "orange" : "green";
                let pingColor = server.ping < 150 ? "green" : server.ping < 400 ? "orange" : server.ping < 5000 ? "red" : "black";

                serverBox.innerHTML = `
            ${window.regionsName[server.region] || server.region} ${server.name}
            (<span style="color: ${colorPlc};">${server.playerCount}</span>/${server.playerCapacity})
            <span style="color: ${pingColor};">${server.ping} ms</span>
        `;
                let joinB = serverBox.querySelector("button");
                if (!joinB) {
                    joinB = document.createElement("button");
                    joinB.textContent = "Join";
                    joinB.style.cssText = `
                background-color: #007bff;
                border: none;
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.3s;
            `;
                    serverBox.appendChild(joinB);
                }
                joinB.onclick = () => {
                    let newUrl = `${location.protocol}//${location.hostname}/?server=${server.region}:${server.name}`;
                    window.location.href = newUrl;
                };
            });
        }

        setInterval(updateServers, 5000);
        updateServers();

        hover(promoImageHolder);
        hover(setupCard);
        guideCard.remove();
        mainMenu.style.cssText = `
        background: rgba(0, 0, 10, 0.45);
        backdrop-filter: blur(7px);
        border-radius: 6px;
        `;
        nameInput.style.cssText = `
        width: 350px;
        height: 50px;
        `;
        nameInput.placeholder = "Enter Username";
        enterGameButton.style.cssText = `
        width: 95px;
        height: 50px;
        margin-left: 20px;
        `;
        enterGameButton.innerHTML = 'Play!';
        promoImageHolder.style.cssText += `
        width: auto;
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgba(0, 0, 0, 0);
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0px 4px 15px rgba(0, 0, 0, 0);
        `;
        setupCard.style.cssText += `
        background: rgba(0, 0, 0, 0.45);
        box-shadow: none;
        display: flex;
        width: 450px;
        height: 50px;
        border-radius: 10px;
        margin-bottom: -20px;
        margin-left: 70px;
        `;

        gameName.style.cssText = `
        opacity: 0.85;
        text-shadow: 0 1px 0 #c4c4c4, 0 2px 0 #c4c4c4, 0 3px 0 #c4c4c4, 0 4px 0 #c4c4c4, 0 5px 0 #c4c4c4, 0 6px 0 #c4c4c4, 0 7px 0 #c4c4c4, 0 8px 0 #c4c4c4, 0 9px 0 #c4c4c4;
        font-size: 170px;
        margin-bottom: -25px;
        font-family: 'Lilita One', sans-serif;
        opacity: 0;
        `;
        setTimeout(() => {
            gameName.style.opacity = '1';
            setupCard.style.opacity = '1';
            guideCard.style.opacity = '1';
            promoImageHolder.style.opacity = '1';
            serverMenu.style.opacity = '1';
        }, 2000);
//document.getElementById("mainMenu").style.backgroundImage = "https://th.bing.com/th/id/OIP.bR79zCRgzMT9xP40nlYZtwHaGW?rs=1&pid=ImgDetMain
//https://www.hdwallpapers.in/download/anime_girl_4k_3-HD.jpg    //https://wallpapercave.com/wp/wp5299847.jpg
document.getElementById("mainMenu").style.backgroundSize = "cover"; // Ensure the background covers the entire element
document.getElementById("mainMenu").style.backgroundPosition = "down"; // Position the background image at the center
document.getElementById("mainMenu").style.width = "100%";
document.getElementById("mainMenu").style.height = "100vh";
document.getElementById("gameName").style.color = "#0f0b0c";
document.getElementById("loadingText").innerText="";
document.getElementById('loadingText').style.color = "#49ceee";
document.getElementById('gameName').style.color = "#820950";
document.getElementById('enterGame').innerText = "hello";
document.getElementById("enterGame").addEventListener("mouseenter", function() {
    document.getElementById('enterGame').innerText = "Dominate!";
    document.getElementById("gameName").style.color = "#92139c";
});
document.getElementById("enterGame").addEventListener("mouseleave", function() {
    document.getElementById('enterGame').innerText = "Ur best!";
    document.getElementById("gameName").style.color = "#25139c";
});
        let useHack = true;

        let log = console.log;
        let testMode = window.location.hostname == "127.0.0.1";
        let imueheua = true;

        function getEl(id) {
            return document.getElementById(id);
        }

        var EasyStar = function(e) {
            var o = {};
            function r(t) {
                if (o[t]) return o[t].exports;
                var n = o[t] = {
                    i: t,
                    l: !1,
                    exports: {}
                };
                return e[t].call(n.exports, n, n.exports, r), n.l = !0, n.exports
            }
            return r.m = e, r.c = o, r.d = function(t, n, e) {
                r.o(t, n) || Object.defineProperty(t, n, {
                    enumerable: !0,
                    get: e
                })
            }, r.r = function(t) {
                "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(t, Symbol.toStringTag, {
                    value: "Module"
                }), Object.defineProperty(t, "__esModule", {
                    value: !0
                })
            }, r.t = function(n, t) {
                if (1 & t && (n = r(n)), 8 & t) return n;
                if (4 & t && "object" == typeof n && n && n.__esModule) return n;
                var e = Object.create(null);
                if (r.r(e), Object.defineProperty(e, "default", {
                    enumerable: !0,
                    value: n
                }), 2 & t && "string" != typeof n)
                    for (var o in n) r.d(e, o, function(t) {
                        return n[t]
                    }.bind(null, o));
                return e
            }, r.n = function(t) {
                var n = t && t.__esModule ? function() {
                    return t.default
                } : function() {
                    return t
                };
                return r.d(n, "a", n), n
            }, r.o = function(t, n) {
                return Object.prototype.hasOwnProperty.call(t, n)
            }, r.p = "/bin/", r(r.s = 0)
        }([function(t, n, e) {
            var P = {},
                M = e(1),
                _ = e(2),
                A = e(3);
            t.exports = P;
            var E = 1;
            P.js = function() {
                var c, i, f, s = 1.4,
                    p = !1,
                    u = {},
                    o = {},
                    r = {},
                    l = {},
                    a = !0,
                    h = {},
                    d = [],
                    y = Number.MAX_VALUE,
                    v = !1;
                this.setAcceptableTiles = function(t) {
                    t instanceof Array ? f = t : !isNaN(parseFloat(t)) && isFinite(t) && (f = [t])
                }, this.enableSync = function() {
                    p = !0
                }, this.disableSync = function() {
                    p = !1
                }, this.enableDiagonals = function() {
                    v = !0
                }, this.disableDiagonals = function() {
                    v = !1
                }, this.setGrid = function(t) {
                    c = t;
                    for (var n = 0; n < c.length; n++)
                        for (var e = 0; e < c[0].length; e++) o[c[n][e]] || (o[c[n][e]] = 1)
                }, this.setTileCost = function(t, n) {
                    o[t] = n
                }, this.setAdditionalPointCost = function(t, n, e) {
                    void 0 === r[n] && (r[n] = {}), r[n][t] = e
                }, this.removeAdditionalPointCost = function(t, n) {
                    void 0 !== r[n] && delete r[n][t]
                }, this.removeAllAdditionalPointCosts = function() {
                    r = {}
                }, this.setDirectionalCondition = function(t, n, e) {
                    void 0 === l[n] && (l[n] = {}), l[n][t] = e
                }, this.removeAllDirectionalConditions = function() {
                    l = {}
                }, this.setIterationsPerCalculation = function(t) {
                    y = t
                }, this.avoidAdditionalPoint = function(t, n) {
                    void 0 === u[n] && (u[n] = {}), u[n][t] = 1
                }, this.stopAvoidingAdditionalPoint = function(t, n) {
                    void 0 !== u[n] && delete u[n][t]
                }, this.enableCornerCutting = function() {
                    a = !0
                }, this.disableCornerCutting = function() {
                    a = !1
                }, this.stopAvoidingAllAdditionalPoints = function() {
                    u = {}
                }, this.findPath = function(t, n, e, o, r) {
                    function i(t) {
                        p ? r(t) : setTimeout(function() {
                            r(t)
                        })
                    }
                    if (void 0 === f) throw new Error("You can't set a path without first calling setAcceptableTiles() on EasyStar.");
                    if (void 0 === c) throw new Error("You can't set a path without first calling setGrid() on EasyStar.");
                    if (t < 0 || n < 0 || e < 0 || o < 0 || t > c[0].length - 1 || n > c.length - 1 || e > c[0].length - 1 || o > c.length - 1) throw new Error("Your start or end point is outside the scope of your grid.");
                    if (t !== e || n !== o) {
                        for (var s = c[o][e], u = !1, l = 0; l < f.length; l++)
                            if (s === f[l]) {
                                u = !0;
                                break
                            } if (!1 !== u) {
                                var a = new M;
                                a.openList = new A(function(t, n) {
                                    return t.bestGuessDistance() - n.bestGuessDistance()
                                }), a.isDoneCalculating = !1, a.nodeHash = {}, a.startX = t, a.startY = n, a.endX = e, a.endY = o, a.callback = i, a.openList.push(O(a, a.startX, a.startY, null, 1));
                                o = E++;
                                return h[o] = a, d.push(o), o
                            }
                        i(null)
                    } else i([])
                }, this.cancelPath = function(t) {
                    return t in h && (delete h[t], !0)
                }, this.calculate = function() {
                    if (0 !== d.length && void 0 !== c && void 0 !== f)
                        for (i = 0; i < y; i++) {
                            if (0 === d.length) return;
                            p && (i = 0);
                            var t = d[0],
                                n = h[t];
                            if (void 0 !== n)
                                if (0 !== n.openList.size()) {
                                    var e = n.openList.pop();
                                    if (n.endX !== e.x || n.endY !== e.y) (e.list = 0) < e.y && T(n, e, 0, -1, +b(e.x, e.y - 1)), e.x < c[0].length - 1 && T(n, e, 1, 0, +b(e.x + 1, e.y)), e.y < c.length - 1 && T(n, e, 0, 1, +b(e.x, e.y + 1)), 0 < e.x && T(n, e, -1, 0, +b(e.x - 1, e.y)), v && (0 < e.x && 0 < e.y && (a || g(c, f, e.x, e.y - 1, e) && g(c, f, e.x - 1, e.y, e)) && T(n, e, -1, -1, s * b(e.x - 1, e.y - 1)), e.x < c[0].length - 1 && e.y < c.length - 1 && (a || g(c, f, e.x, e.y + 1, e) && g(c, f, e.x + 1, e.y, e)) && T(n, e, 1, 1, s * b(e.x + 1, e.y + 1)), e.x < c[0].length - 1 && 0 < e.y && (a || g(c, f, e.x, e.y - 1, e) && g(c, f, e.x + 1, e.y, e)) && T(n, e, 1, -1, s * b(e.x + 1, e.y - 1)), 0 < e.x && e.y < c.length - 1 && (a || g(c, f, e.x, e.y + 1, e) && g(c, f, e.x - 1, e.y, e)) && T(n, e, -1, 1, s * b(e.x - 1, e.y + 1)));
                                    else {
                                        var o = [];
                                        o.push({
                                            x: e.x,
                                            y: e.y
                                        });
                                        for (var r = e.parent; null != r;) o.push({
                                            x: r.x,
                                            y: r.y
                                        }), r = r.parent;
                                        o.reverse(), n.callback(o), delete h[t], d.shift()
                                    }
                                } else n.callback(null), delete h[t], d.shift();
                            else d.shift()
                        }
                };
                var T = function(t, n, e, o, r) {
                    e = n.x + e, o = n.y + o;
                    void 0 !== u[o] && void 0 !== u[o][e] || !g(c, f, e, o, n) || (void 0 === (o = O(t, e, o, n, r)).list ? (o.list = 1, t.openList.push(o)) : n.costSoFar + r < o.costSoFar && (o.costSoFar = n.costSoFar + r, o.parent = n, t.openList.updateItem(o)))
                },
                    g = function(t, n, e, o, r) {
                        var i = l[o] && l[o][e];
                        if (i) {
                            var s = x(r.x - e, r.y - o);
                            if (! function() {
                                for (var t = 0; t < i.length; t++)
                                    if (i[t] === s) return !0;
                                return !1
                            }()) return !1
                        }
                        for (var u = 0; u < n.length; u++)
                            if (t[o][e] === n[u]) return !0;
                        return !1
                    },
                    x = function(t, n) {
                        if (0 === t && -1 === n) return P.TOP;
                        if (1 === t && -1 === n) return P.TOP_RIGHT;
                        if (1 === t && 0 === n) return P.RIGHT;
                        if (1 === t && 1 === n) return P.BOTTOM_RIGHT;
                        if (0 === t && 1 === n) return P.BOTTOM;
                        if (-1 === t && 1 === n) return P.BOTTOM_LEFT;
                        if (-1 === t && 0 === n) return P.LEFT;
                        if (-1 === t && -1 === n) return P.TOP_LEFT;
                        throw new Error("These differences are not valid: " + t + ", " + n)
                    },
                    b = function(t, n) {
                        return r[n] && r[n][t] || o[c[n][t]]
                    },
                    O = function(t, n, e, o, r) {
                        if (void 0 !== t.nodeHash[e]) {
                            if (void 0 !== t.nodeHash[e][n]) return t.nodeHash[e][n]
                        } else t.nodeHash[e] = {};
                        var i = m(n, e, t.endX, t.endY),
                            r = null !== o ? o.costSoFar + r : 0,
                            i = new _(o, n, e, r, i);
                        return t.nodeHash[e][n] = i
                    },
                    m = function(t, n, e, o) {
                        var r, i;
                        return v ? (r = Math.abs(t - e)) < (i = Math.abs(n - o)) ? s * r + i : s * i + r : (r = Math.abs(t - e)) + (i = Math.abs(n - o))
                    }
                }, P.TOP = "TOP", P.TOP_RIGHT = "TOP_RIGHT", P.RIGHT = "RIGHT", P.BOTTOM_RIGHT = "BOTTOM_RIGHT", P.BOTTOM = "BOTTOM", P.BOTTOM_LEFT = "BOTTOM_LEFT", P.LEFT = "LEFT", P.TOP_LEFT = "TOP_LEFT"
        }, function(t, n) {
            t.exports = function() {
                this.pointsToAvoid = {}, this.startX, this.callback, this.startY, this.endX, this.endY, this.nodeHash = {}, this.openList
            }
        }, function(t, n) {
            t.exports = function(t, n, e, o, r) {
                this.parent = t, this.x = n, this.y = e, this.costSoFar = o, this.simpleDistanceToTarget = r, this.bestGuessDistance = function() {
                    return this.costSoFar + this.simpleDistanceToTarget
                }
            }
        }, function(t, n, e) {
            t.exports = e(4)
        }, function(u, T, t) {
            var g, x;
            (function() {
                var t, p, l, h, d, n, a, e, y, v, o, r, i, c, f;
                function s(t) {
                    this.cmp = null != t ? t : p, this.nodes = []
                }
                l = Math.floor, v = Math.min, p = function(t, n) {
                    return t < n ? -1 : n < t ? 1 : 0
                }, y = function(t, n, e, o, r) {
                    var i;
                    if (null == e && (e = 0), null == r && (r = p), e < 0) throw new Error("lo must be non-negative");
                    for (null == o && (o = t.length); e < o;) r(n, t[i = l((e + o) / 2)]) < 0 ? o = i : e = i + 1;
                    return [].splice.apply(t, [e, e - e].concat(n)), n
                }, n = function(t, n, e) {
                    return null == e && (e = p), t.push(n), c(t, 0, t.length - 1, e)
                }, d = function(t, n) {
                    var e, o;
                    return null == n && (n = p), e = t.pop(), t.length ? (o = t[0], t[0] = e, f(t, 0, n)) : o = e, o
                }, e = function(t, n, e) {
                    var o;
                    return null == e && (e = p), o = t[0], t[0] = n, f(t, 0, e), o
                }, a = function(t, n, e) {
                    var o;
                    return null == e && (e = p), t.length && e(t[0], n) < 0 && (n = (o = [t[0], n])[0], t[0] = o[1], f(t, 0, e)), n
                }, h = function(e, t) {
                    var n, o, r, i, s, u;
                    for (null == t && (t = p), s = [], o = 0, r = (i = function() {
                        u = [];
                        for (var t = 0, n = l(e.length / 2); 0 <= n ? t < n : n < t; 0 <= n ? t++ : t--) u.push(t);
                        return u
                    }.apply(this).reverse()).length; o < r; o++) n = i[o], s.push(f(e, n, t));
                    return s
                }, i = function(t, n, e) {
                    if (null == e && (e = p), -1 !== (n = t.indexOf(n))) return c(t, 0, n, e), f(t, n, e)
                }, o = function(t, n, e) {
                    var o, r, i, s, u;
                    if (null == e && (e = p), !(r = t.slice(0, n)).length) return r;
                    for (h(r, e), i = 0, s = (u = t.slice(n)).length; i < s; i++) o = u[i], a(r, o, e);
                    return r.sort(e).reverse()
                }, r = function(t, n, e) {
                    var o, r, i, s, u, l, a, c, f;
                    if (null == e && (e = p), 10 * n <= t.length) {
                        if (!(i = t.slice(0, n).sort(e)).length) return i;
                        for (r = i[i.length - 1], s = 0, l = (a = t.slice(n)).length; s < l; s++) e(o = a[s], r) < 0 && (y(i, o, 0, null, e), i.pop(), r = i[i.length - 1]);
                        return i
                    }
                    for (h(t, e), f = [], u = 0, c = v(n, t.length); 0 <= c ? u < c : c < u; 0 <= c ? ++u : --u) f.push(d(t, e));
                    return f
                }, c = function(t, n, e, o) {
                    var r, i, s;
                    for (null == o && (o = p), r = t[e]; n < e && o(r, i = t[s = e - 1 >> 1]) < 0;) t[e] = i, e = s;
                    return t[e] = r
                }, f = function(t, n, e) {
                    var o, r, i, s, u;
                    for (null == e && (e = p), r = t.length, i = t[u = n], o = 2 * n + 1; o < r;)(s = o + 1) < r && !(e(t[o], t[s]) < 0) && (o = s), t[n] = t[o], o = 2 * (n = o) + 1;
                    return t[n] = i, c(t, u, n, e)
                }, s.push = n, s.pop = d, s.replace = e, s.pushpop = a, s.heapify = h, s.updateItem = i, s.nlargest = o, s.nsmallest = r, s.prototype.push = function(t) {
                    return n(this.nodes, t, this.cmp)
                }, s.prototype.pop = function() {
                    return d(this.nodes, this.cmp)
                }, s.prototype.peek = function() {
                    return this.nodes[0]
                }, s.prototype.contains = function(t) {
                    return -1 !== this.nodes.indexOf(t)
                }, s.prototype.replace = function(t) {
                    return e(this.nodes, t, this.cmp)
                }, s.prototype.pushpop = function(t) {
                    return a(this.nodes, t, this.cmp)
                }, s.prototype.heapify = function() {
                    return h(this.nodes, this.cmp)
                }, s.prototype.updateItem = function(t) {
                    return i(this.nodes, t, this.cmp)
                }, s.prototype.clear = function() {
                    return this.nodes = []
                }, s.prototype.empty = function() {
                    return 0 === this.nodes.length
                }, s.prototype.size = function() {
                    return this.nodes.length
                }, s.prototype.clone = function() {
                    var t = new s;
                    return t.nodes = this.nodes.slice(0), t
                }, s.prototype.toArray = function() {
                    return this.nodes.slice(0)
                }, s.prototype.insert = s.prototype.push, s.prototype.top = s.prototype.peek, s.prototype.front = s.prototype.peek, s.prototype.has = s.prototype.contains, s.prototype.copy = s.prototype.clone, t = s, g = [], void 0 === (x = "function" == typeof (x = function() {
                    return t
                }) ? x.apply(T, g) : x) || (u.exports = x)
            }).call(this)
        }]);
        let easystar = new EasyStar.js();

        "use strict";
        let newFont = document.createElement("link");
        newFont.rel = "stylesheet";
        newFont.href = "https://fonts.googleapis.com/css?family=Ubuntu:700";
        newFont.type = "text/css";
        document.body.append(newFont);

        window.oncontextmenu = function() {
            return false;
        };

        // VISUAL:
        config.anotherVisual = false;
        config.useWebGl = false;
        config.resetRender = false;

        function waitTime(timeout) {
            return new Promise((done) => {
                setTimeout(() => {
                    done();
                }, timeout);
            });
        }

        let changed = false;


        // STORAGE:
        let canStore;
        if (typeof(Storage) !== "undefined") {
            canStore = true;
        }
        function saveVal(name, val) {
            if (canStore)
                localStorage.setItem(name, val);
        }
        function deleteVal(name) {
            if (canStore)
                localStorage.removeItem(name);
        }
        function getSavedVal(name) {
            if (canStore)
                return localStorage.getItem(name);
            return null;
        }

        // CONFIGS:
        let gC = function(a, b) {
            try {
                let res = JSON.parse(getSavedVal(a));
                if (typeof res === "object") {
                    return b;
                } else {
                    return res;
                }
            } catch(e) {

                return b;
            }
        };

        function setCommands() {
            return {
                "help": {
                    desc: "Show Commands",
                    action: function(message) {
                        for (let cmds in commands) {
                            ChText("/" + cmds, commands[cmds].desc, "lime", 1);
                        }
                    }
                },
                "clear": {
                    desc: "Clear Chats",
                    action: function(message) {
                        resetMenuChText();
                    }
                },
                "debug": {
                    desc: "Debug Mod For Development",
                    action: function(message) {
                        addDeadPlayer(player);
                        ChText("Debug", "Done", "#99ee99", 1);
                    }
                },
                "play": {
                    desc: "Play Music ( /play [link] )",
                    action: function(message) {
                        let link = message.split(" ");
                        if (link[1]) {
                            let audio = new Audio(link[1]);
                            audio.play();
                        } else {
                            ChText("Warn", "Enter Link ( /play [link] )", "#99ee99", 1);
                        }
                    }
                },
                "bye": {
                    desc: "Leave Game",
                    action: function(message) {
                        window.leave();
                    }
                },
            };
        }

        let commands = setCommands();
        //
const applyStyles = selector => $(selector).css({'border-radius': '8px', 'background-color': 'rgba(50, 50, 50, 0.7)', 'backdrop-filter': 'blur(10px)', 'box-shadow': '0px 4px 20px rgba(0, 0, 0, 0.5)', 'border': '1px solid #808080', 'color': '#e0e0e0', 'text-align': 'center', 'transition': 'transform 0.3s ease'});

const applyInputStyles = selector => $(selector).css({'border-radius': '8px', 'background-color': '#1e1e1e', 'border': '1px solid #606060', 'color': '#e0e0e0', 'text-align': 'left', 'padding': '10px', 'transition': 'border-color 0.3s ease'});

const applyInitialStyles = () => { applyStyles('#foodDisplay, #woodDisplay, #stoneDisplay, #scoreDisplay, #killCounter, #chatButton, #storeButton, #mapDisplay, #leaderboard, #allianceButton'); applyInputStyles('#nameInput'); };

$(document).ready(() => applyInitialStyles());

$('#allianceButton').on('click', () => applyInitialStyles());

$('#storeButton').on('click', () => applyInitialStyles());

$('body').append(`<style>::-webkit-scrollbar { width: 12px; } ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.1); border-radius: 10px; } ::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.5); border-radius: 10px; border: 3px solid rgba(0, 0, 0, 0.1); } ::-webkit-scrollbar-thumb:hover { background-color: rgba(255, 255, 255, 0.7); }</style>`);

        class HtmlAction {
            constructor(element) {
                this.element = element;
            };
            add(code) {
                if (!this.element) return undefined;
                this.element.innerHTML += code;
            };
            newLine(amount) {
                let result = `<br>`;
                if (amount > 0) {
                    result = ``;
                    for (let i = 0; i < amount; i++) {
                        result += `<br>`;
                    }
                }
                this.add(result);
            };
            checkBox(setting) {
                let newCheck = `<input type = "checkbox"`;
                setting.id && (newCheck += ` id = ${setting.id}`);
                setting.style && (newCheck += ` style = ${setting.style.replaceAll(" ", "")}`);
                setting.class && (newCheck += ` class = ${setting.class}`);
                setting.checked && (newCheck += ` checked`);
                setting.onclick && (newCheck += ` onclick = ${setting.onclick}`);
                newCheck += `>`;
                this.add(newCheck);
            };
            text(setting) {
                let newText = `<input type = "text"`;
                setting.id && (newText += ` id = ${setting.id}`);
                setting.style && (newText += ` style = ${setting.style.replaceAll(" ", "")}`);
                setting.class && (newText += ` class = ${setting.class}`);
                setting.size && (newText += ` size = ${setting.size}`);
                setting.maxLength && (newText += ` maxLength = ${setting.maxLength}`);
                setting.value && (newText += ` value = ${setting.value}`);
                setting.placeHolder && (newText += ` placeHolder = ${setting.placeHolder.replaceAll(" ", "&nbsp;")}`);
                newText += `>`;
                this.add(newText);
            };
            select(setting) {
                let newSelect = `<select`;
                setting.id && (newSelect += ` id = ${setting.id}`);
                setting.style && (newSelect += ` style = ${setting.style.replaceAll(" ", "")}`);
                setting.class && (newSelect += ` class = ${setting.class}`);
                newSelect += `>`;
                for (let options in setting.option) {
                    newSelect += `<option value = ${setting.option[options].id}`
                        setting.option[options].selected && (newSelect += ` selected`);
                    newSelect += `>${options}</option>`;
                }
                newSelect += `</select>`;
                this.add(newSelect);
            };
            button(setting) {
                let newButton = `<button`;
                setting.id && (newButton += ` id = ${setting.id}`);
                setting.style && (newButton += ` style = ${setting.style.replaceAll(" ", "")}`);
                setting.class && (newButton += ` class = ${setting.class}`);
                setting.onclick && (newButton += ` onclick = ${setting.onclick}`);
                newButton += `>`;
                setting.innerHTML && (newButton += setting.innerHTML);
                newButton += `</button>`;
                this.add(newButton);
            };
            selectMenu(setting) {
                let newSelect = `<select`;
                if (!setting.id) {
                    alert("please put id skid");
                    return;
                }
                window[setting.id + "Func"] = function() {};
                setting.id && (newSelect += ` id = ${setting.id}`);
                setting.style && (newSelect += ` style = ${setting.style.replaceAll(" ", "")}`);
                setting.class && (newSelect += ` class = ${setting.class}`);
                newSelect += ` onchange = window.${setting.id + "Func"}()`;
                newSelect += `>`;
                let last;
                let i = 0;
                for (let options in setting.menu) {
                    newSelect += `<option value = ${"option_" + options} id = ${"O_" + options}`;
                    setting.menu[options] && (newSelect += ` checked`);
                    newSelect += ` style = "color: ${setting.menu[options] ? "#000" : "#fff"}; background: ${setting.menu[options] ? "#8ecc51" : "#cc5151"};">${options}</option>`;
                    i++;
                }
                newSelect += `</select>`;

                this.add(newSelect);

                i = 0;
                for (let options in setting.menu) {
                    window[options + "Func"] = function() {
                        setting.menu[options] = getEl("check_" + options).checked ? true : false;
                        saveVal(options, setting.menu[options]);

                        getEl("O_" + options).style.color = setting.menu[options] ? "#000" : "#fff";
                        getEl("O_" + options).style.background = setting.menu[options] ? "#8ecc51" : "#cc5151";

                        //getEl(setting.id).style.color = setting.menu[options] ? "#8ecc51" : "#cc5151";

                    };
                    this.checkBox({
                        id: "check_" + options,
                        style: `display: ${i == 0 ? "inline-block" : "none"};`,
                        class: "checkB",
                        onclick: `window.${options + "Func"}()`,
                        checked: setting.menu[options]
                    });
                    i++;
                }

                last = "check_" + getEl(setting.id).value.split("_")[1];
                window[setting.id + "Func"] = function() {
                    getEl(last).style.display = "none";
                    last = "check_" + getEl(setting.id).value.split("_")[1];
                    getEl(last).style.display = "inline-block";

                    //getEl(setting.id).style.color = setting.menu[last.split("_")[1]] ? "#8ecc51" : "#fff";

                };
            };
        };
        class Html {
            constructor() {
                this.element = null;
                this.action = null;
                this.divElement = null;
                this.startDiv = function (setting, func) {

                    let newDiv = document.createElement("div");
                    setting.id && (newDiv.id = setting.id);
                    setting.style && (newDiv.style = setting.style);
                    setting.class && (newDiv.className = setting.class);
                    this.element.appendChild(newDiv);
                    this.divElement = newDiv;

                    let addRes = new HtmlAction(newDiv);
                    typeof func == "function" && func(addRes);

                };
                this.addDiv = function (setting, func) {

                    let newDiv = document.createElement("div");
                    setting.id && (newDiv.id = setting.id);
                    setting.style && (newDiv.style = setting.style);
                    setting.class && (newDiv.className = setting.class);
                    setting.appendID && getEl(setting.appendID).appendChild(newDiv);
                    this.divElement = newDiv;

                    let addRes = new HtmlAction(newDiv);
                    typeof func == "function" && func(addRes);

                };
            };
            set(id) {
                this.element = getEl(id);
                this.action = new HtmlAction(this.element);
            };
            resetHTML(text) {
                if (text) {
                    this.element.innerHTML = ``;
                } else {
                    this.element.innerHTML = ``;
                }
            };
            setStyle(style) {
                this.element.style = style;
            };
            setCSS(style) {
                this.action.add(`<style>` + style + `</style>`);
            };
        };


        class UI {
            constructor() {
                this.content = '';
            }

            append(html) {
                this.content += html;
            }

            Text(text, size = '16px', color = 'white') {
                this.append(`<span style="font-size: ${size}; color: ${color};">${text}</span>`);
            }

            newLine(num = 1) {
                this.append('<br>'.repeat(num));
            }

            static AppendTo(targetId, uiCallback) {
                const target = document.getElementById(targetId);
                if (target) {
                    const htmlui = new UI();
                    uiCallback(htmlui);
                    target.innerHTML += htmlui.content;
                }
            }

            static InnerHtml(targetId, uiCallback) {
                const target = document.getElementById(targetId);
                if (target) {
                    const htmlui = new UI();
                    uiCallback(htmlui);
                    target.innerHTML = htmlui.content;
                }
            }

            TabContent(tabId, contentCallback) {
                const ui = new UI();
                contentCallback(ui);
                this.append(`
            <div id="${tabId}" class="tab-content">
                ${ui.content}
            </div>
        `);
            }

            static addStyle(id, style) {
                let styleElement = document.getElementById(id);
                if (!styleElement) {
                    styleElement = document.createElement('style');
                    styleElement.id = id;
                    document.head.appendChild(styleElement);
                }
                styleElement.textContent = style;
            }

            BoxF(name, description, id, config = {}) {
                const checkedStatus = localStorage.getItem(id) === "true";
                const optionsHtml = config.option
                ? `<select id="${id}-dropdown" class="checkbox-dropdown">
            ${Object.entries(config.options || {})
                .map(([optionName, optionConfig]) =>
                     `<option value="${optionConfig.id}" ${optionConfig.selected ? "selected" : ""}>
                        ${optionName}
                    </option>`).join('')}
        </select>`
        : "";

                const boxHtml = `
    <div id="${id}" class="checkbox-container">
        <label class="checkbox-label">
            <input type="checkbox" ${checkedStatus ? "checked" : ""} class="checkbox-input" />
            <span class="checkbox-name">${name}</span>
            ${optionsHtml}
        </label>
        <p class="checkbox-description">${description}</p>
    </div>
    `;
                this.append(boxHtml);
                setTimeout(() => {
                    const checkbox = document.querySelector(`#${id} .checkbox-input`);
                    if (checkbox) {
                        checkbox.addEventListener("change", (event) => {
                            const isChecked = event.target.checked;
                            localStorage.setItem(id, isChecked);
                        });
                    }
                    if (config.option) {
                        const dropdown = document.getElementById(`${id}-dropdown`);
                        if (dropdown) {
                            dropdown.addEventListener("change", (event) => {
                                const selectedOption = event.target.value;
                                localStorage.setItem(`${id}-selected`, selectedOption);
                            });
                            const storedSelected = localStorage.getItem(`${id}-selected`);
                            if (storedSelected) {
                                const selectedOption = dropdown.querySelector(`option[value="${storedSelected}"]`);
                                if (selectedOption) {
                                    selectedOption.selected = true;
                                }
                            }
                        }
                    }
                }, 100);
            }



            renderDropdown(options) {
                let dropdownHtml = '<select class="dropdown-menu">';
                for (const [optionName, optionConfig] of Object.entries(options)) {
                    const selected = optionConfig.selected ? 'selected' : '';
                    dropdownHtml += `<option value="${optionConfig.id}" ${selected}>${optionName}</option>`;
                }
                dropdownHtml += '</select>';
                return dropdownHtml;
            }

            initializeDropdown(boxId, options) {
                const dropdown = document.querySelector(`#${boxId} .dropdown-menu`);
                if (dropdown) {
                    dropdown.addEventListener('change', (event) => {
                        const selectedOption = event.target.value;
                        for (const [name, config] of Object.entries(options)) {
                            config.selected = config.id === selectedOption;
                            localStorage.setItem(config.id, config.selected);
                        }
                    });
                    Object.entries(options).forEach(([name, config]) => {
                        const storedSelected = localStorage.getItem(config.id) === "true";
                        config.selected = storedSelected;

                        const optionElement = dropdown.querySelector(`option[value="${config.id}"]`);
                        if (optionElement) {
                            optionElement.selected = storedSelected;
                        }
                    });
                }
            }

        }

        let HTML = new Html();
let menuDiv = document.createElement("div");
menuDiv.id = "menuDiv";
document.body.appendChild(menuDiv);
HTML.set("menuDiv");
HTML.setStyle(`
    position: absolute;
    left: 20px;
    top: 20px;
    display: none;
`);
HTML.resetHTML();
HTML.setCSS(`
.menuClass {
    color: #fff; /* Text color */
    font-size: 20px; /* Font size for the menu */
    text-align: left;
    padding: 10px; /* Padding for the menu */
    width: 220px; /* Width of the menu */
    background: transparent; /* Fully transparent background */
    border-radius: 12px; /* Rounded corners */
    box-shadow: none; /* No shadow */
    transition: transform 0.3s; /* Transition effects */
    border: none; /* No border */
}

.menuClass:hover {
    transform: scale(1.05); /* Slightly enlarge on hover */
}

.menuC {
    display: none; /* Hidden by default */
    font-family: "Hammersmith One", sans-serif;
    font-size: 14px;
    max-height: 200px;
    overflow-y: auto;
    user-select: none;
    padding: 10px;
}

.menuB {
    text-align: center;
    background-color: transparent; /* Transparent background for buttons */
    color: #fff; /* Text color */
    border: none; /* No border */
    cursor: pointer;
    transition: background 0.3s, transform 0.3s, box-shadow 0.3s;
    padding: 8px; /* Padding for buttons */
}

.menuB:hover {
    background-color: rgba(255, 255, 255, 0.1); /* Light background on hover */
    transform: scale(1.1); /* Slightly enlarge on hover */
    box-shadow: 0 4px 20px rgba(255, 255, 255, 0.2); /* Glow effect */
}

.menuB:active {
    color: rgb(25, 25, 25);
    background-color: rgba(230, 230, 230, 0.5); /* Background color on active */
}

.customText {
    color: #fff; /* Text color */
    border: none; /* No border */
    padding: 8px; /* Padding for text input */
    background-color: transparent; /* Transparent background */
    transition: background 0.3s;
}

.customText:focus {
    background-color: rgba(255, 255, 255, 0.1); /* Light background on focus */
    outline: none; /* Remove outline */
}

.Cselect {
    border: none; /* No border */
    background-color: transparent; /* Transparent background */
    color: #fff; /* Text color */
    padding: 6px; /* Padding for select */
    transition: background 0.3s;
}

.Cselect:hover {
    background-color: rgba(255, 255, 255, 0.1); /* Light background on hover */
}

/* Positioning the menu */
#modmenus {
    position: fixed; /* Fixed positioning */
    top: 50%; /* Center vertically */
    left: 50%; /* Center horizontally */
    transform: translate(-50%, -50%); /* Center the menu */
    z-index: 9999; /* High z-index to stay on top */
}

::-webkit-scrollbar {
    width: 12px; /* Width of the scrollbar */
}

::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.4); /* Track color */
}

::-webkit-scrollbar-thumb {
    background-color: rgb(30, 30, 30); /* Thumb color */
    border-radius: 6px; /* Rounded corners */
}

::-webkit-scrollbar-thumb:active {
    background-color: rgb(230, 230, 230); /* Thumb color on active */
}


`);

let menuuss = document.createElement('div');
menuuss.id = 'modmenus';
document.body.appendChild(menuuss);

// Add content to the menu
const content = document.createElement('div');
content.id = 'modmenus-content';
content.innerHTML = `
    <div class="image-container">
        <p>Your menu content here...</p>
    </div>
`;
menuuss.appendChild(content);

UI.addStyle('modmenus-styles', `
#modmenus {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.5) rotate(15deg); /* Start smaller and rotated */
    background: linear-gradient(135deg, rgba(10, 10, 20, 0.8), rgba(30, 30, 30, 0.9)),
                url('https://tse1.mm.bing.net/th/id/OIP.PUjmvxLs2m_K_n8S_wJeVAHaHa?rs=1&pid=ImgDetMain&o=7&rm=3');
    background-size: cover;
    color: #00f; /* Blue text color */
    border: 5px solid rgba(255, 255, 255, 0.8);
    border-radius: 20px;
    font-family: 'Verdana', sans-serif;
    font-size: 26px;
    z-index: 9999;
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.5s ease-out, transform 0.5s ease-out, visibility 0.5s ease-out;
    width: 700px;
    height: 500px;
    text-align: center;
    box-shadow: 0px 15px 40px rgba(255, 255, 255, 0.7);
}

#modmenus.open {
    visibility: visible;
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(0deg); /* Reset scale and rotation on open */
    animation: openMenu 0.6s ease-out forwards; /* Trigger opening animation */
}

@keyframes openMenu {
    0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.5) rotate(15deg); /* Small and rotated */
    }
    50% {
        opacity: 0.5; /* Fade in halfway */
        transform: translate(-50%, -50%) scale(1.1) rotate(5deg); /* Scale up slightly and rotate back */
    }
    100% {
        opacity: 1; /* Fully visible */
        transform: translate(-50%, -50%) scale(1) rotate(0deg); /* Final position */
    }
}

@keyframes closeMenu {
    0% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1) rotate(0deg);
    }
    50% {
        transform: translate(-50%, -50%) scale(0.5) rotate(-15deg); /* Shrink and rotate */
    }
    100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.1) rotate(-360deg); /* Fully disappear */
    }
}

#modmenus.closed {
    visibility: hidden;
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.95);
    animation: closeMenu 0.5s ease-in-out forwards;
}

#modmenus-sidebar {
    position: absolute;
    top: 0;
    left: 0;
    width: 80px;
    height: 100%;
    background-color: rgba(255, 255, 255, 0.2);
    color: #00f;
    padding: 20px;
    box-sizing: border-box;
    text-align: center;
    border-radius: 20px 0 0 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
    opacity: 0;
    animation: slideIn 0.5s ease-out forwards;
}

#modmenus-sidebar button {
    width: 70px;
    height: 70px;
    background: rgba(255, 255, 255, 0.5);
    color: #000;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    transition: transform 0.3s ease, background 0.3s ease, box-shadow 0.3s ease;
    box-shadow: 0px 6px 20px rgba(255, 255, 255, 0.5);
}

#modmenus-sidebar button:hover {
    background: rgba(255, 255, 255, 0.7);
    transform: scale(1.1);
    box-shadow: 0px 10px 30px rgba(255, 255, 255, 0.8);
}

#modmenus-sidebar button.active {
    background: rgba(0, 255, 255, 0.3);
    font-weight: bold;
}

#modmenus-content {
    position: absolute;
    top: 0;
    left: 80px;
    width: 620px;
    height: 100%;
    padding: 25px;
    box-sizing: border-box;
    background-color: rgba(30, 30, 30, 0.9);
    color: #fff;
    text-align: left;
    overflow-x: auto;
    overflow-y: auto;
    animation: fadeInContent 0.5s ease-out;
    border-radius: 0 20px 20px 0;
}

#modmenus-content::-webkit-scrollbar {
    width: 12px;
}

#modmenus-content::-webkit-scrollbar-thumb {
    background: #666;
    border-radius: 10px;
}

#modmenus-content::-webkit-scrollbar-thumb:hover {
    background: #888;
}

#modmenus-content::-webkit-scrollbar-track {
    background: #333;
    border-radius: 10px;
}

.tab-content {
    display: none;
}

.tab-content.active {
    display: block;
    animation: fadeIn 0.5s ease-out;
}

.search-bar {
    display: inline-block;
    margin-left: 10px;
}

.search-bar input {
    width: 400px;
    height: 35px;
    font-size: 18px;
    border-radius: 20px;
    border: 1px solid #666;
    background-color: #444;
    color: white;
    outline: none;
    transition: background 0.3s, border-color 0.3s;
}

.search-bar input:focus {
    border-color: #00ffcc;
    background-color: #555;
}

.image-container {
    text-align: center;
    margin-top: 20px;
}

.image-container img {
    max-width: 100%;
    height: auto;
    border-radius: 15px;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateX(-100%);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes fadeInContent {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}


`);

        UI.InnerHtml('modmenus', (ui) => {
            ui.append(`
            <div id="modmenus-sidebar">
                <button class="tab-btn" data-tab="offensive">⚔️💪🏾</button>
                <button class="tab-btn" data-tab="defensive">🛡️🐉</button>
                <button class="tab-btn" data-tab="render">👁️</button>
                <button class="tab-btn" data-tab="robot">🤖</button>
                <button class="tab-btn" data-tab="keybind">⌨️</button>
                <button class="tab-btn" data-tab="others">⚙️</button>
            </div>
            <div id="modmenus-content"></div>
        `);
        });
        /*           //     killChat: true,
             //   autoBuy: false,
             //   alwaysFlipper: false,
             //   autoQonSync: true,
                //// autoQonHighPing: true, // havent implemented
              //  anti1tick: true,
              //  autoPush: true,
               ```` revTick: false, //dont have this in code idk why
             //   revInsta: false,
             //   doSpikeOnReverse: true,
              //  hammerBreakerOptimisation: true,
               // autoPlay: false,
              //  safeWalk: false,
             //   spikeTick: true,
             //   predictTick: true,
              //  autoPlace: true,
             //   autoReplace: true,
             //   autoPrePlace: true,
              //  antiTrap: true,
               // slowOT: false,
               // attackDir: false,
             //   noDir: false,
             //   showDir: true,
              //  autoRespawn: true*/
        UI.InnerHtml('modmenus-content', (ui) => {
            const addSearchBar = (dc) => {
                dc.append(`
                <div class="search-bar">
                    <input type="text" placeholder="Search..." class="search-input" />
                </div>
            `);
            };

            ui.TabContent('offensive', (dc) => {
                dc.Text("COMBAT TAB", "20px", "white");
                addSearchBar(dc);
                dc.newLine(1);
                dc.BoxF("Auto Placer", "Places Item For you such as spike and Traps", "autoPlace");
                dc.BoxF("Auto Replacer", "Auto Replace Buildings", "autoReplace");
                dc.BoxF("Preplacer", "Advanced Placing Obj", "autoPrePlace", {
                    option: true,
                    options: {
                        "Spike Tick Type": { id: "spike"},
                        "Retrap Type": { id: "retrap", selected: true },
                    }
                });
                dc.BoxF("Auto Push", "Pushes enemies to spike when they in trap", "autoPush");
                dc.BoxF("Reverse Insta", "Always reverse insta", "revInsta");
                dc.BoxF("Spike On Reverse", "Place spike when reverse instaing and close to enemy", "doSpikeOnReverse");
                dc.BoxF("Auto Play", "Pathfinds to nearest enemy", "autoPlay");
                dc.BoxF("Spike Tick", "Spike and hit together when enemy break out of trap", "spikeTick");
                dc.BoxF("KB Tick", "Knocks back enemy into spike", "predictTick");
                dc.BoxF("Slow One Tick", "Select wall when polearm ticking to slow down", "slowOT");
                dc.BoxF("Turret Combat", "Uses turret when spike ticking", "turretCombat");
                dc.newLine(2);
                /* dc.BoxF("Musket Sync", "Sync with players when you have musket", "secondarySync", {
                input: idk make it cut off at 30 characters,
            });*/
                dc.BoxF("Primary Sync", "Sync with players using this mod with primary", "serverSync");
            });

            ui.TabContent('defensive', (dc) => {
                dc.Text("DEFENSIVE TAB", "20px", "white");
                addSearchBar(dc);
                dc.newLine(1);
                dc.BoxF("Auto buy", "Buys hats and accessories automatically", "autoBuy");
                dc.BoxF("Anti 1 tick", "Forces soldier when detects 1 tick", "anti1tick");
                dc.BoxF("Auto Q on sync", "Heals as fast as possible when you may be synced", "autoQonSync");
                dc.BoxF("Hammer breaker", "Use hammer when breaking", "hammerBreakerOptimisation");
                dc.BoxF("Safe Walk", "Avoids spikes", "safeWalk", {
                    option: true,
                    options: {
                        "Move Away": {id: "move", selected: true},
                        "Stop": {id: "stop"}
                    }
                });
                dc.BoxF("Anti Trap", "Places traps or spikes behind you when in trap", "antiTrap");
                dc.BoxF("Extra Anti Spike Tick", "Uses knock back prediction and trap health to soldier or heal too", "safeAntiSpikeTick");
                dc.BoxF("Spike Breaker", "Auto break enemy spikes in range", "breakSpikeSwitch");
                dc.BoxF("Turret type Breaker", "Auto break enemy turret/tp/blocked in range", "breakTTBSwitch");
                dc.BoxF("Break All", "Auto break all buildings. Note: disables avoid ur own buildings breaker", "breakAllSwitch");
                dc.BoxF("Counter Insta", "Spike gear and hit when enemy hit you (strongly not recommended)", "antiBullType", {
                    option: true,
                    options: {
                        "Predict": {id: "abreload"},
                        "Always": {id: "abalway", selected: true},
                    }
                });
            });
            ui.TabContent('render', (dc) => {
                dc.Text("VISUAL TAB", "20px", "white");
                addSearchBar(dc);
                dc.newLine(1);
                dc.BoxF("Smoother Camera", "Makes camera move slower", "CAmera");
                dc.BoxF("Mirror Chat", "Send Chat Same As Opponent", "cMirr");
                dc.BoxF("autoSpin", "spin", "spinhere");
                dc.BoxF("morning", "morning", "morning");
                dc.BoxF("movecamera", "movecamera", "movecam");
                dc.BoxF("grid", "shows grid", "renderGrid");
                dc.BoxF("autoHello", "saying: Spotted, nickname", "autoHello");
                dc.BoxF("Render Direction", "Shows real direction", "renderDir", {
                    option: true,
                    options: {
                        "When Auto Aim": {id: "attackDir"},
                        "Always": {id: "showDir", selected: true},
                        "No Dir": {id: "noDir"}
                    }
                });
                dc.BoxF("visuals", "visuals", "visualsType", {
                    option: true,
                    options: {
                        "fz": {id: "fz"},
                        "zika": {id: "zika", selected: true},
                    }
                });
                dc.BoxF("Render Placers", "Show positions placed", "placeVis");
            });
            ui.TabContent('robot', (dc) => {
                dc.Text("BOTS TAB", "20px", "white");
                addSearchBar(dc);
                dc.newLine(1);
                dc.Text("No bots for you :>")
            });
            ui.TabContent('keybind', (dc) => {
                dc.Text("KEYBINDS TAB", "20px", "white");
                addSearchBar(dc);
                dc.newLine(1);
                dc.Text("z for auto mill, f for trap type, v for spike type, n for mill type, h for turret type, y for stone/sapling");
                dc.newLine(1);
                dc.Text("If auto push or auto play dumb, press shift once to disable for 10 seconds");
                dc.Text("C for song. It is case sensitive so press shift + c or caps + c. Song chat stuff found in others tab");
                dc.newLine(1);
                dc.Text("hold t for 1 tick, '.' (period) for boost tick. They are not really worked on so dont expect them to be very good");
            });
            ui.TabContent('others', (dc) => {
                dc.Text("OTHERS TAB", "20px", "white");
                addSearchBar(dc);
                dc.newLine(1);
                dc.BoxF("Kill Chat", "Sends message when you kill someone", "killChat");
                dc.BoxF("Weapon Grind", "Auto place turret type item around you", "weaponGrind");
                dc.BoxF("Auto Respawn", "Respawns when you die automatically", "autoRespawn");
                dc.BoxF("Always Flipper", "Equips flipper when in water more", "alwaysFlipper");
                dc.BoxF("Funni Hats :)", "Changes hat changing when not near players", "hatType", {
                    option: true,
                    options: {
                        "Hat loop": {id: "loop"},
                        "Bush gear": {id: "bg", selected: true},
                        "Assassion gear": {id: "ag"},
                    }
                });
                dc.BoxF("Random loop songs", "Loop through songs randomly. If unchecked, play selected song", "songChat", {
                    option: true,
                    options: {
                        "Park Chinois": {
                            id: "song1",
                        },
                        "Gas Gas Gas": {
                            id: "song2",
                        },
                        "Verbatim": {
                            id: "song3"
                        },
                        "Dead of night": {
                            id: "song4"
                        },
                        "I see a dreamer": {
                            id: "song5"
                        },
                        "Sailor Song": {
                            id: "song6",
                        },
                        "My ordinary life": {
                            id: "song7",
                        },
                        "Dont Stand So Close": {
                            id: "song8",
                        },
                        "Everything is awesome": {
                            id: "song9",
                        },
                        "Candles on fire": {
                            id: "song10",
                        },
                        "Enemy": {
                            id: "song11",
                        },
                        "SUS": {
                            id: "song12",
                        },
                        "Scopin": {
                            id: "song13",
                        },
                        "GIGACHAD": {
                            id: "song14",
                        },
                        "Shape of you": {
                            id: "song15",
                        },
                        "laplace recommendation": {
                            id: "song16",
                        },
                        "The nights": {
                            id: "song17",
                            slected: true
                        }
                    }
                })
            });
        });
        /*  HTML.startDiv({id: "menuHeadLine", class: "menuClass"}, (html) => {
            html.add(`Mod:`);
            html.button({id: "menuChanger", class: "material-icons", innerHTML: `sync`, onclick: "window.changeMenu()"});
            HTML.addDiv({id: "menuButtons", style: "display: block; overflow-y: visible;", class: "menuC", appendID: "menuHeadLine"}, (html) => {
                html.button({class: "menuB", innerHTML: "Debug", onclick: "window.debug()"});
                html.button({class: "menuB", innerHTML: "Night Mode", onclick: "window.toggleNight()"});
            });
            HTML.addDiv({id: "menuMain", style: "display: block", class: "menuC", appendID: "menuHeadLine"}, (html) => {
                html.button({class: "menuB", innerHTML: "Toggle Wasd Mode", onclick: "window.wasdMode()"});
                html.newLine();
                html.add(`Weapon Grinder: `);
                html.checkBox({id: "weaponGrind", class: "checkB", onclick: "window.startGrind()"});
                html.newLine(2);
                HTML.addDiv({style: "font-size: 20px; color: #99ee99;", appendID: "menuMain"}, (html) => {
                    html.add(`Developing Settings:`);
                });
                html.newLine()
                html.add(`CAmera`);
                html.checkBox({id: "camSexy", class: "checkB", checked: true});
                html.newLine();
                html.newLine();
                html.add(`Auto Breaker`)
                html.newLine();
                html.add(`Spike Breaker`)
                html.checkBox({id: "breakSpikeSwitch", class: "checkB", checked: true});
                html.newLine();
                html.add(`Tp/turr/bloc Breaker`)
                html.checkBox({id: "breakTTBSwitch", class: "checkB", checked: true});
                html.newLine();
                html.add(`Break All`)
                html.checkBox({id: "breakAllSwitch", class: "checkB", checked: false});
            });
            HTML.addDiv({id: "menuConfig", class: "menuC", appendID: "menuHeadLine"}, (html) => {
                html.add(`AutoPlacer Placement Tick: `);
                html.text({id: "autoPlaceTick", class: "customText", value: "2", size: "2em", maxLength: "1"});
                html.newLine();
                html.add(`Configs: `);
                html.selectMenu({id: "configsChanger", class: "Cselect", menu: configs});
                html.newLine();
                html.add(`InstaKill Type: `);
                html.select({id: "instaType", class: "Cselect", option: {
                    OneShot: {
                        id: "oneShot",
                        selected: true
                    },
                    Spammer: {
                        id: "spammer"
                    }
                }});
                html.newLine();
                html.add(`AntiBull Type: `);
                html.select({id: "antiBullType", class: "Cselect", option: {
                    "Disable AntiBull": {
                        id: "noab",
                        selected: true
                    },
                    "When Reloaded": {
                        id: "abreload",
                    },
                    "Primary Reloaded": {
                        id: "abalway"
                    }
                }});
                html.newLine();
                html.add(`safe walk type: (not perfect yet)`);
                html.select({id: "avoidType", class: "Cselect", option: {
                    "Move away": {
                        id: "move",
                        selected: true
                    },
                    "Stand still": {
                        id: "stop"
                    }
                }});
                html.newLine();
                html.add(`Preplacer Type: `);
                html.select({id: "preplaceMore", class: "Cselect", option: {
                    "For SpikeTick": {
                        id: "spike"
                    },
                    "For retrap": {
                        id: "trap",
                        selected: true
                    }
                }});
                html.newLine();
                html.add(`Hat Changer Type: `);
                html.select({id: "hatType", class: "Cselect", option: {
                    "Assassin Gear": {
                        id: "ag"
                    },
                    "Bush Gear": {
                        id: "bg"
                    },
                    "Normal": {
                        id: "norm",
                        selected: true
                    },
                    "Hat Loop": {
                        id: "loop"
                    }
                }});
                html.newLine();
                html.add(`Backup Nobull Insta: `);
                html.checkBox({id: "backupNobull", class: "checkB", checked: true});
                html.newLine();
                html.add(`Turret Gear Combat Assistance: `);
                html.checkBox({id: "turretCombat", class: "checkB"});
                html.newLine();
                html.add(`Safe AntiSpikeTick: `);
                html.checkBox({id: "safeAntiSpikeTick", class: "checkB", checked: true});
                html.newLine();
                html.select({
                    id: "songChat",
                    class: "Cselect",
                    option: {
                        "Park Chinois": {
                            id: "song1",
                        },
                        "Gas Gas Gas": {
                            id: "song2",
                        },
                        "Verbatim": {
                            id: "song3"
                        },
                        "Dead of night": {
                            id: "song4"
                        },
                        "I see a dreamer": {
                            id: "song5"
                        },
                        "Sailor Song": {
                            id: "song6",
                        },
                        "My ordinary life": {
                            id: "song7",
                        },
                        "Dont Stand So Close": {
                            id: "song8",
                        },
                        "Everything is awesome": {
                            id: "song9",
                        },
                        "Candles on fire": {
                            id: "song10",
                        },
                        "Enemy": {
                            id: "song11",
                            selected: true
                        },
                        "SUS": {
                            id: "song12",
                        }
                    }
                });
                html.newLine();
                html.add(`Target Player: `);
                html.text({id: "targetSid", class: "customText", value: "0", size: "3em", maxLength: "2"});
                html.newLine();
                html.add(`Player Follower: `);
                html.checkBox({id: "followPlayer", class: "checkB", checked: false});
            });
            HTML.addDiv({id: "menuOther", class: "menuC", appendID: "menuHeadLine"}, (html) => {

                html.newLine();
                html.button({class: "menuB", innerHTML: "Reset Break Objects", onclick: "window.resBuild()"});
                html.newLine();
                html.add(`sync chat: `);
                html.text({ id: "syncChat", class: "customText", value: 'wasdwasd', size: "30em", maxLength: "30" });
                html.newLine();
                html.add(`primary weapon sync`);
                html.checkBox({id: "serverSync", class: "checkB", checked: false});
                html.newLine();
                html.add(`Break Objects Range: `);
                html.text({id: "breakRange", class: "customText", value: "700", size: "3em", maxLength: "4"});
                html.newLine();
                html.add(`Predict Movement Type: `);
                html.select({id: "predictType", class: "Cselect", option: {
                    "Disable Render": {
                        id: "disableRender",
                        selected: true
                    },
                    "X/Y and 2": {
                        id: "pre2",
                    },
                    "X/Y and 3": {
                        id: "pre3"
                    }
                }});
                html.newLine();
                html.add(`Render Placers: `);
                html.checkBox({id: "placeVis", class: "checkB", checked: true});
                html.newLine();
                html.add(`Visuals: `);
                html.select({id: "visualType", class: "Cselect", option: {
                    "Old Shit": {
                        id: "ueh1",
                    },
                    "New shit": {
                        id: "ueh2",
                        selected: true
                    },
                }});
                html.newLine(2);
                html.add(`Cross World: `);
                html.checkBox({id: "funni", class: "checkB"});
                html.newLine();
                html.button({class: "menuB", innerHTML: "Toggle Another Visual", onclick: "window.toggleVisual()"});
                html.newLine();
            });
        });*/

        let menuChatDiv = document.createElement("div");
        menuChatDiv.id = "menuChatDiv";
        document.body.appendChild(menuChatDiv);
        HTML.set("menuChatDiv");
        HTML.setStyle(`
            position: absolute;
            display: block;
            left: 10px;
            top: 10px;
            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.65);
            `);
        HTML.resetHTML();
        HTML.setCSS(`
            .chDiv{
                color: #fff;
                padding: 5px;
                width: 400px;
                height: 240px;
                background-color: rgba(0, 0, 0, 0.35);
            }
            .chMainDiv{
                font-family: "Ubuntu";
                font-size: 12px;
                max-height: 195px;
                overflow-y: scroll;
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                -khtml-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                user-select: none;
            }
            .chMainBox{
                position: absolute;
                left: 5px;
                bottom: 10px;
                width: 395px;
                height: 30px;
                background-color: rgb(128, 128, 128, 0.35);
                -webkit-border-radius: 4px;
                -moz-border-radius: 4px;
                border-radius: 4px;
                color: #fff;
                font-family: "Ubuntu";
                font-size: 12px;
                border: none;
                outline: none;
            }
            `);
        HTML.startDiv({id: "mChDiv", class: "chDiv"}, (html) => {
            HTML.addDiv({id: "mChMain", class: "chMainDiv", appendID: "mChDiv"}, (html) => {
            });
            html.text({id: "mChBox", class: "chMainBox", placeHolder: `To chat click here or press "Enter" key`});
        });

        let menuChats = getEl("mChMain");
        let menuChatBox = getEl("mChBox");
        let menuCBFocus = false;
        let menuChCounts = 0;

        menuChatBox.value = "";
        menuChatBox.addEventListener("focus", () => {
            menuCBFocus = true;
        });
        menuChatBox.addEventListener("blur", () => {
            menuCBFocus = false;
        });

        function ChText(name, message, color, noTimer) {
            HTML.set("menuChatDiv");
            color = color || "white";

            let time = new Date();
            let min = time.getMinutes();
            let hour = time.getHours();

            let getAMPM = hour >= 12 ? "PM" : "AM";
            let text = ``;
            if (!noTimer) text += `<span style="color: white;">[${(hour % 12) + ":" + min + " " + getAMPM}] </span>`;
            if (name) text += `${name}`;
            if (message) text += `${(name ? ": " : !noTimer ? " " : "") + message}\n`;

            HTML.addDiv({id: "menuChDisp" + menuChCounts, style: `color: ${color}`, appendID: "mChMain"}, (html) => {
                html.add(text);
            });
            menuChats.scrollTop = menuChats.scrollHeight;
            menuChCounts++;
        }


        function resetMenuChText() {
            menuChats.innerHTML = ``;
            menuChCounts = 0;
            ChText("Script", "Thank you for using, aurora! ", "#0f0", 1);
        }
        resetMenuChText();
        document.body.addEventListener('click', (event) => {
            if (event.target.classList.contains('tab-btn')) {
                const tabName = event.target.dataset.tab;
                document.querySelectorAll('#modmenus-sidebar .tab-btn').forEach((btn) => {
                    btn.classList.remove('active');
                });
                document.querySelectorAll('.tab-content').forEach((content) => {
                    content.classList.remove('active');
                });
                event.target.classList.add('active');
                const selectedContent = document.getElementById(tabName);
                if (selectedContent) {
                    selectedContent.classList.add('active');
                }
            }
        });
        document.body.addEventListener('input', (event) => {
            if (event.target && event.target.classList.contains('search-input')) {
                const searchText = event.target.value.toLowerCase();
                const tabContent = event.target.closest('.tab-content');
                if (tabContent) {
                    const textElements = tabContent.querySelectorAll('span');
                    textElements.forEach((textElement) => {
                        const isVisible = textElement.textContent.toLowerCase().includes(searchText);
                        textElement.style.display = isVisible ? '' : 'none';
                    });
                }
            }
        });
        document.body.addEventListener('input', (event) => {
            if (event.target && event.target.classList.contains('search-input')) {
                const searchText = event.target.value.toLowerCase();
                const tabContent = event.target.closest('.tab-content');
                if (tabContent) {
                    const boxFContainers = tabContent.querySelectorAll('.checkbox-container');
                    boxFContainers.forEach((container) => {
                        const nameElement = container.querySelector('.checkbox-name');
                        if (nameElement) {
                            const isVisible = nameElement.textContent.toLowerCase().includes(searchText);
                            container.style.display = isVisible ? '' : 'none';
                        }
                    });
                }
            }
        });

        document.addEventListener('DOMContentLoaded', () => {
            const defaultTab = document.getElementById('offensive');
            const defaultButton = document.querySelector('#modmenus-sidebar .tab-btn[data-tab="offensive"]');
            if (defaultTab) defaultTab.classList.add('active');
            if (defaultButton) defaultButton.classList.add('active');
        });
        function isC(id) {// for checking if the ids is checked or not so use it oe
            let checkVal = localStorage.getItem(id) === "true";
            let optionVal = localStorage.getItem(`${id}-selected`);
            return {
                checked: checkVal,
                options: {
                    value: optionVal
                }
            };
        }
        let WS = undefined;
        let socketID = undefined;

        let useWasd = false;
        let secPacket = 0;
        let secMax = 110;
        let secTime = 1000;
        let firstSend = {
            sec: false
        };
        let game = {
            tick: 0,
            tickQueue: [],
            tickBase: function (set, tick) {
                if (this.tickQueue[this.tick + tick]) {
                    this.tickQueue[this.tick + tick].push(set);
                } else {
                    this.tickQueue[this.tick + tick] = [set];
                }
            },
            tickRate: (1000 / config.serverUpdateRate),
            tickSpeed: 0,
            lastTick: performance.now()
        };
        let projectileTick = [];
        let modConsole = [];

        let dontSend = false;
        let fpsTimer = {
            last: 0,
            time: 0,
            ltime: 0
        }
        let lastsp = ["cc", 1, "__proto__"];

        WebSocket.prototype.nsend = WebSocket.prototype.send;
        WebSocket.prototype.send = function (message) {
            if (!WS) {
                WS = this;
                WS.addEventListener("message", function (msg) {
                    getMessage(msg);
                });
                WS.addEventListener("close", (event) => {
                    window.location.reload();
                });
            }
            if (WS == this) {
                dontSend = false;
                // EXTRACT DATA ARRAY:
                let data = new Uint8Array(message);
                let parsed = msgpack.decode(data);

                let type = parsed[0];
                data = parsed[1];

                // SEND MESSAGE:
                if (type == "6") {

                    if (data[0]) {
                        // ANTI PROFANITY:
                        let profanity = [];
                        let tmpString;
                        profanity.forEach((profany) => {
                            if (data[0].indexOf(profany) > -1) {
                                tmpString = "";
                                for (let i = 0; i < profany.length; ++i) {
                                    if (i == 1) {
                                        tmpString += String.fromCharCode(0);
                                    }
                                    tmpString += profany[i];
                                }
                                let re = new RegExp(profany, "g");
                                data[0] = data[0].replace(re, tmpString);
                            }
                        });

                        // FIX CHAT:
                        data[0] = data[0].slice(0, 30);
                    }
                } else if (type == "L") {
                    // MAKE SAME CLAN:
                    data[0] = data[0] + (String.fromCharCode(0).repeat(7));
                    data[0] = data[0].slice(0, 7);
                } else if (type == "M") {
                    // APPLY CYAN COLOR:
                    data[0].name = data[0].name == "" ? "unknown" : data[0].name;
                    data[0].moofoll = true;
                    data[0].skin = data[0].skin == 10 ? "__proto__" : data[0].skin;
                    lastsp = [data[0].name, data[0].moofoll, data[0].skin];
                } else if (type == "D") {
                    if ((my.lastDir == data[0]) || [null, undefined].includes(data[0])) {
                        dontSend = true;
                    } else {
                        my.lastDir = data[0];
                    }
                } else if (type == "F") {
                    if (!data[2]) {
                        dontSend = true;
                    } else {
                        if (![null, undefined].includes(data[1])) {
                            my.lastDir = data[1];
                        }
                    }
                } else if (type == "K") {
                    if (!data[1]) {
                        dontSend = true;
                    }
                } else if (type == "S") {
                    instaC.wait = !instaC.wait;
                    dontSend = true;
                } else if (type == "9") {
                    if (data[1]) {
                        if (player.moveDir == data[0]) {
                            dontSend = true;
                        }
                        player.moveDir = data[0];
                        if (player.moveDir) player.moveTime = Date.now();
                    } else {
                        dontSend = true;
                    }
                }
                if (!dontSend) {
                    let binary = msgpack.encode([type, data]);
                    this.nsend(binary);
                    // START COUNT:
                    if (!firstSend.sec) {
                        firstSend.sec = true;
                        setTimeout(() => {
                            firstSend.sec = false;
                            secPacket = 0;
                        }, secTime);
                    }
                    secPacket++;
                }
            } else {
                this.nsend(message);
            }
        }

        function packet(type) {
            // EXTRACT DATA ARRAY:
            let data = Array.prototype.slice.call(arguments, 1);

            // SEND MESSAGE:
            let binary = msgpack.encode([type, data]);
            WS.send(binary);
        }
        function origPacket(type) {
            // EXTRACT DATA ARRAY:
            let data = Array.prototype.slice.call(arguments, 1);

            // SEND MESSAGE:
            let binary = msgpack.encode([type, data]);
            WS.nsend(binary);
        }

        //...lol
        let io = {
            send: packet
        };

        function getMessage(message) {
            let data = new Uint8Array(message.data);
            let parsed = msgpack.decode(data);
            let type = parsed[0];
            data = parsed[1];
            let events = {
                A: setInitData,
                // B: disconnect,
                C: setupGame,
                D: addPlayer,
                E: removePlayer,
                a: updatePlayers,
                G: updateLeaderboard,
                H: loadGameObject,
                I: loadAI,
                J: animateAI,
                K: gatherAnimation,
                L: wiggleGameObject,
                M: shootTurret,
                N: updatePlayerValue,
                O: updateHealth,
                P: killPlayer,
                Q: killObject,
                R: killObjects,
                S: updateItemCounts,
                T: updateAge,
                U: updateUpgrades,
                V: updateItems,
                X: addProjectile,
                Y: remProjectile,
                Z: serverShutdownNotice,
                // 0: addAlliance,
                //1: deleteAlliance,
                2: allianceNotification,
                3: setPlayerTeam,
                4: setAlliancePlayers,
                5: updateStoreItems,
                6: receiveChat,
                7: updateMinimap,
                8: showText,
                9: pingMap,
                0: pingSocketResponse,
            };
            if (type == "io-init") {
                socketID = data[0];
            } else {
                if (events[type]) {
                    events[type].apply(undefined, data);
                }
            }
        }

        // MATHS:
        Math.lerpAngle = function (value1, value2, amount) {
            let difference = Math.abs(value2 - value1);
            if (difference > Math.PI) {
                if (value1 > value2) {
                    value2 += Math.PI * 2;
                } else {
                    value1 += Math.PI * 2;
                }
            }
            let value = value2 + ((value1 - value2) * amount);
            if (value >= 0 && value <= Math.PI * 2) return value;
            return value % (Math.PI * 2);
        };

        // REOUNDED RECTANGLE:
        CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
            if (w < 2 * r) r = w / 2;
            if (h < 2 * r) r = h / 2;
            if (r < 0)
                r = 0;
            this.beginPath();
            this.moveTo(x+r, y);
            this.arcTo(x+w, y, x+w, y+h, r);
            this.arcTo(x+w, y+h, x, y+h, r);
            this.arcTo(x, y+h, x, y, r);
            this.arcTo(x, y, x+w, y, r);
            this.closePath();
            return this;
        };

        // GLOBAL VALUES:

        // PLACER:
function place(id, rad, rmd) {
    try {
        if (id == undefined) return;
        let item = items.list[player.items[id]];
        let tmpS = player.scale + item.scale + (item.placeOffset || 0);
        let tmpX = player.x2 + tmpS * Math.cos(rad);
        let tmpY = player.y2 + tmpS * Math.sin(rad);
        if ((player.alive && inGame && player.itemCounts[item.group.id] == undefined ? true : player.itemCounts[item.group.id] < (config.isSandbox ? id === 3 || id === 5 ? 290 : 99 : item.group.limit ? item.group.limit : 99))) {
            selectToBuild(player.items[id]);
            sendAtck(1, rad);
            selectWeapon(player.weaponCode, 1);
            if (rmd && getEl("placeVis").checked) {
                placeVisible.push({
                    x: tmpX,
                    y: tmpY,
                    name: item.name,
                    scale: item.scale,
                    dir: rad
                });
                game.tickBase(() => {
                    placeVisible.shift();
                }, 1);
                game.tickBase(() => {
                    placeVisible.shift();
                }, 3);
            }
        }
    } catch (e) {}
}
function cplace(id, rad, rmd) { // for preplacer indi
    try {
        if (id == undefined) return;
        let item = items.list[player.items[id]];
        let tmpS = player.scale + item.scale + (item.placeOffset || 0);
        let tmpX = player.x2 + tmpS * Math.cos(rad);
        let tmpY = player.y2 + tmpS * Math.sin(rad);
        if ((player.alive && inGame && player.itemCounts[item.group.id] == undefined ? true : player.itemCounts[item.group.id] < (config.isSandbox ? id === 3 || id === 5 ? 290 : 99 : item.group.limit ? item.group.limit : 99))) {
            selectToBuild(player.items[id]);
            sendAtck(1, rad);
            selectWeapon(player.weaponCode, 1);
            if (rmd && getEl("PrePlaceVis").checked) {
                preplaceVisible.push({
                    x: tmpX,
                    y: tmpY,
                    name: item.name,
                    scale: item.scale,
                    dir: rad
                });
                game.tickBase(() => {
                    preplaceVisible.shift();
                }, 1);
                game.tickBase(() => {
                    preplaceVisible.shift();
                }, 3);
            }
        }
    } catch (e) {}
}

        // VOLCANO:
        let xof = undefined;
        let yof = undefined;
        var volcano = {
            animationTime: 0,
            land: null,
            lava: null,
            x: config.volcanoLocationX,
            y: config.volcanoLocationY
        };
        let debugStop = false;
        let kbIndc = {
            mex:0,
            mey:0
        }

        let petals = [];
        let allChats = [];

        let ais = [];
        let players = [];
        let alliances = [];
        let alliancePlayers = [];
        let allianceNotifications = [];
        let gameObjects = [];
        let nearObjs = [];
        let projectiles = [];
        let deadPlayers = [];

        let player;
        let playerSID;
        let tmpObj;

        let enemy = [];
        let nears = [];
        let near = [];
        let ping = 0;

        let my = {
            reloaded: false,
            waitHit: 0,
            autoAim: false,
            revAim: false,
            ageInsta: true,
            reSync: false,
            bullTick: true,
            anti0Tick: 0,
            predictSpikes: 0,
            antiSync: false,
            safePrimary: function (tmpObj) {
                return [0, 8].includes(tmpObj.primaryIndex);
            },
            safeSecondary: function (tmpObj) {
                return [10, 11, 14].includes(tmpObj.secondaryIndex);
            },
            lastDir: 0,
            autoPush: false,
            pushData: {},
            millPlacePos: {
                x: 0,
                y: 0
            },
            antiInsta: false,
            forceStop: false
        }

        // FIND OBJECTS BY ID/SID:
        function findID(tmpObj, tmp) {
            return tmpObj.find((THIS) => THIS.id == tmp);
        }

        function findSID(tmpObj, tmp) {
            return tmpObj.find((THIS) => THIS.sid == tmp);
        }

        function findPlayerByID(id) {
            return findID(players, id);
        }

        function findPlayerBySID(sid) {
            return findSID(players, sid);
        }

        function findAIBySID(sid) {
            return findSID(ais, sid);
        }

        function findObjectBySid(sid) {
            return findSID(gameObjects, sid);
        }

        function findProjectileBySid(sid) {
            return findSID(gameObjects, sid);
        }


        let screenWidth;
        let screenHeight;
        let maxScreenWidth = config.maxScreenWidth;
        let maxScreenHeight = config.maxScreenHeight;
        let pixelDensity = 1;
        let delta;
        let now;
        let lastUpdate = performance.now();
        let camX;
        let camY;
        let tmpDir;
        let mouseX = 0;
        let mouseY = 0;

        let waterMult = 1;
        let waterPlus = 0;

        let outlineColor = "#525252";
        let darkOutlineColor = "#3d3f42";
        let outlineWidth = 5.5;

        let isNight = true;
        let firstSetup = true;
        let keys = {};
        let moveKeys = {
            87: [0, -1],
            38: [0, -1],
            83: [0, 1],
            40: [0, 1],
            65: [-1, 0],
            37: [-1, 0],
            68: [1, 0],
            39: [1, 0],
        };
        let attackState = 0;
        let inGame = false;

        let macro = {};
        let mills = {
            place: 0,
            placeSpawnPads: 0
        };
        let lastDir;

        let lastLeaderboardData = [];

        // ON LOAD:
        let inWindow = true;
        window.onblur = function () {
            inWindow = false;
        };
        window.onfocus = function () {
            inWindow = true;
            if (player && player.alive) {
                // resetMoveDir();
            }
        };
    let placeVisible = [];
        let preplaceVisible = [];
        let spikeplaceVisible = [];
        let profanityList = ["cunt", "whore", "fuck", "shit", "faggot", "nigger",
                             "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex",
                             "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune",
                             "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard"];

        /** CLASS CODES */

        class Utils {
            constructor() {

                // MATH UTILS:
                let mathABS = Math.abs,
                    mathCOS = Math.cos,
                    mathSIN = Math.sin,
                    mathPOW = Math.pow,
                    mathSQRT = Math.sqrt,
                    mathATAN2 = Math.atan2,
                    mathPI = Math.PI;

                let _this = this;

                // GLOBAL UTILS:
                this.round = function(n, v) {
                    return Math.round(n * v) / v;
                };
                this.toRad = function (angle) {
                    return angle * (mathPI / 180);
                };
                this.toAng = function (radian) {
                    return radian / (mathPI / 180);
                };
                this.randInt = function (min, max) {
                    return Math.floor(Math.random() * (max - min + 1)) + min;
                };
                this.collisionDetection = function(obj1, obj2, scale) {
                    return mathSQRT((obj1.x - obj2.x) ** 2 + (obj1.y - obj2.y) ** 2) < scale;
                };
                this.randFloat = function (min, max) {
                    return Math.random() * (max - min) + min;
                };
                this.lerp = function (value1, value2, amount) {
                    return value1 + (value2 - value1) * amount;
                };
                this.decel = function (val, cel) {
                    if (val > 0)
                        val = Math.max(0, val - cel);
                    else if (val < 0)
                        val = Math.min(0, val + cel);
                    return val;
                };
                this.getDistance = function (x1, y1, x2, y2) {
                    return mathSQRT((x2 -= x1) * x2 + (y2 -= y1) * y2);
                };
                this.getDist = function (tmp1, tmp2, type1, type2) {
                    let tmpXY1 = {
                        x: type1 == 0 ? tmp1.x : type1 == 1 ? tmp1.x1 : type1 == 2 ? tmp1.x2 : type1 == 3 && tmp1.x3,
                        y: type1 == 0 ? tmp1.y : type1 == 1 ? tmp1.y1 : type1 == 2 ? tmp1.y2 : type1 == 3 && tmp1.y3,
                    };
                    let tmpXY2 = {
                        x: type2 == 0 ? tmp2.x : type2 == 1 ? tmp2.x1 : type2 == 2 ? tmp2.x2 : type2 == 3 && tmp2.x3,
                        y: type2 == 0 ? tmp2.y : type2 == 1 ? tmp2.y1 : type2 == 2 ? tmp2.y2 : type2 == 3 && tmp2.y3,
                    };
                    return mathSQRT((tmpXY2.x -= tmpXY1.x) * tmpXY2.x + (tmpXY2.y -= tmpXY1.y) * tmpXY2.y);
                };
                this.findMiddlePoint = function (tmp1, tmp2, type1, type2) {
    // Helper function to get the correct coordinates
    const getCoords = (obj, type) => {
        switch (type) {
            case 0: return { x: obj.x, y: obj.y };
            case 1: return { x: obj.x1, y: obj.y1 };
            case 2: return { x: obj.x2, y: obj.y2 };
            case 3: return { x: obj.x3, y: obj.y3 };
            default: throw new Error("Invalid type");
        }
    };

    const tmpXY1 = getCoords(tmp1, type1);
    const tmpXY2 = getCoords(tmp2, type2);

    return {
        x: (tmpXY1.x + tmpXY2.x) / 2,
        y: (tmpXY1.y + tmpXY2.y) / 2
    };
};
                this.fgdo = function(a, b) {
                    return Math.sqrt(Math.pow((b.y - a.y), 2) + Math.pow((b.x - a.x), 2));
                }
                this.getDirection = function (x1, y1, x2, y2) {
                    return mathATAN2(y1 - y2, x1 - x2);
                };
                this.getDirect = function (tmp1, tmp2, type1, type2) { // direction of tmp1 from tmp2
                    let tmpXY1 = {
                        x: type1 == 0 ? tmp1.x : type1 == 1 ? tmp1.x1 : type1 == 2 ? tmp1.x2 : type1 == 3 && tmp1.x3,
                        y: type1 == 0 ? tmp1.y : type1 == 1 ? tmp1.y1 : type1 == 2 ? tmp1.y2 : type1 == 3 && tmp1.y3,
                    };
                    let tmpXY2 = {
                        x: type2 == 0 ? tmp2.x : type2 == 1 ? tmp2.x1 : type2 == 2 ? tmp2.x2 : type2 == 3 && tmp2.x3,
                        y: type2 == 0 ? tmp2.y : type2 == 1 ? tmp2.y1 : type2 == 2 ? tmp2.y2 : type2 == 3 && tmp2.y3,
                    };
                    return mathATAN2(tmpXY1.y - tmpXY2.y, tmpXY1.x - tmpXY2.x);
                };
                this.getAngleDist = function (a, b) {
                    let p = mathABS(b - a) % (mathPI * 2);
                    return (p > mathPI ? (mathPI * 2) - p : p);
                };
                this.isNumber = function (n) {
                    return (typeof n == "number" && !isNaN(n) && isFinite(n));
                };
                this.isString = function (s) {
                    return (s && typeof s == "string");
                };
                this.kFormat = function (num) {
                    return num > 999 ? (num / 1000).toFixed(1) + "k" : num;
                };
                this.sFormat = function (num) {
                    let fixs = [
                        {num: 1e3, string: "k"},
                        {num: 1e6, string: "m"},
                        {num: 1e9, string: "b"},
                        {num: 1e12, string: "q"}
                    ].reverse();
                    let sp = fixs.find(v => num >= v.num);
                    if (!sp) return num;
                    return (num / sp.num).toFixed(1) + sp.string;
                };
                this.capitalizeFirst = function (string) {
                    return string.charAt(0).toUpperCase() + string.slice(1);
                };
                this.fixTo = function (n, v) {
                    return parseFloat(n.toFixed(v));
                };
                this.sortByPoints = function (a, b) {
                    return parseFloat(b.points) - parseFloat(a.points);
                };
                this.lineInRect = function (recX, recY, recX2, recY2, x1, y1, x2, y2) {
                    let minX = x1;
                    let maxX = x2;
                    if (x1 > x2) {
                        minX = x2;
                        maxX = x1;
                    }
                    if (maxX > recX2)
                        maxX = recX2;
                    if (minX < recX)
                        minX = recX;
                    if (minX > maxX)
                        return false;
                    let minY = y1;
                    let maxY = y2;
                    let dx = x2 - x1;
                    if (Math.abs(dx) > 0.0000001) {
                        let a = (y2 - y1) / dx;
                        let b = y1 - a * x1;
                        minY = a * minX + b;
                        maxY = a * maxX + b;
                    }
                    if (minY > maxY) {
                        let tmp = maxY;
                        maxY = minY;
                        minY = tmp;
                    }
                    if (maxY > recY2)
                        maxY = recY2;
                    if (minY < recY)
                        minY = recY;
                    if (minY > maxY)
                        return false;
                    return true;
                };
                this.containsPoint = function (element, x, y) {
                    let bounds = element.getBoundingClientRect();
                    let left = bounds.left + window.scrollX;
                    let top = bounds.top + window.scrollY;
                    let width = bounds.width;
                    let height = bounds.height;

                    let insideHorizontal = x > left && x < left + width;
                    let insideVertical = y > top && y < top + height;
                    return insideHorizontal && insideVertical;
                };
                this.mousifyTouchEvent = function (event) {
                    let touch = event.changedTouches[0];
                    event.screenX = touch.screenX;
                    event.screenY = touch.screenY;
                    event.clientX = touch.clientX;
                    event.clientY = touch.clientY;
                    event.pageX = touch.pageX;
                    event.pageY = touch.pageY;
                };
                this.hookTouchEvents = function (element, skipPrevent) {
                    let preventDefault = !skipPrevent;
                    let isHovering = false;
                    // let passive = window.Modernizr.passiveeventlisteners ? {passive: true} : false;
                    let passive = false;
                    element.addEventListener("touchstart", this.checkTrusted(touchStart), passive);
                    element.addEventListener("touchmove", this.checkTrusted(touchMove), passive);
                    element.addEventListener("touchend", this.checkTrusted(touchEnd), passive);
                    element.addEventListener("touchcancel", this.checkTrusted(touchEnd), passive);
                    element.addEventListener("touchleave", this.checkTrusted(touchEnd), passive);

                    function touchStart(e) {
                        _this.mousifyTouchEvent(e);
                        window.setUsingTouch(true);
                        if (preventDefault) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                        if (element.onmouseover)
                            element.onmouseover(e);
                        isHovering = true;
                    }

                    function touchMove(e) {
                        _this.mousifyTouchEvent(e);
                        window.setUsingTouch(true);
                        if (preventDefault) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                        if (_this.containsPoint(element, e.pageX, e.pageY)) {
                            if (!isHovering) {
                                if (element.onmouseover)
                                    element.onmouseover(e);
                                isHovering = true;
                            }
                        } else {
                            if (isHovering) {
                                if (element.onmouseout)
                                    element.onmouseout(e);
                                isHovering = false;
                            }
                        }
                    }

                    function touchEnd(e) {
                        _this.mousifyTouchEvent(e);
                        window.setUsingTouch(true);
                        if (preventDefault) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                        if (isHovering) {
                            if (element.onclick)
                                element.onclick(e);
                            if (element.onmouseout)
                                element.onmouseout(e);
                            isHovering = false;
                        }
                    }
                };
                this.removeAllChildren = function (element) {
                    while (element.hasChildNodes()) {
                        element.removeChild(element.lastChild);
                    }
                };
                this.generateElement = function (config) {
                    let element = document.createElement(config.tag || "div");

                    function bind(configValue, elementValue) {
                        if (config[configValue])
                            element[elementValue] = config[configValue];
                    }
                    bind("text", "textContent");
                    bind("html", "innerHTML");
                    bind("class", "className");
                    for (let key in config) {
                        switch (key) {
                            case "tag":
                            case "text":
                            case "html":
                            case "class":
                            case "style":
                            case "hookTouch":
                            case "parent":
                            case "children":
                                continue;
                            default:
                                break;
                        }
                        element[key] = config[key];
                    }
                    if (element.onclick)
                        element.onclick = this.checkTrusted(element.onclick);
                    if (element.onmouseover)
                        element.onmouseover = this.checkTrusted(element.onmouseover);
                    if (element.onmouseout)
                        element.onmouseout = this.checkTrusted(element.onmouseout);
                    if (config.style) {
                        element.style.cssText = config.style;
                    }
                    if (config.hookTouch) {
                        this.hookTouchEvents(element);
                    }
                    if (config.parent) {
                        config.parent.appendChild(element);
                    }
                    if (config.children) {
                        for (let i = 0; i < config.children.length; i++) {
                            element.appendChild(config.children[i]);
                        }
                    }
                    return element;
                };
                this.checkTrusted = function (callback) {
                    return function (ev) {
                        if (ev && ev instanceof Event && (ev && typeof ev.isTrusted == "boolean" ? ev.isTrusted : true)) {
                            callback(ev);
                        } else {
                            //console.error("Event is not trusted.", ev);
                        }
                    };
                };
                this.randomString = function (length) {
                    let text = "";
                    let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                    for (let i = 0; i < length; i++) {
                        text += possible.charAt(Math.floor(Math.random() * possible.length));
                    }
                    return text;
                };
                this.countInArray = function (array, val) {
                    let count = 0;
                    for (let i = 0; i < array.length; i++) {
                        if (array[i] === val) count++;
                    }
                    return count;
                };
                this.hexToRgb = function(hex) {
                    return hex.slice(1).match(/.{1,2}/g).map(g => parseInt(g, 16));
                };
                this.getRgb = function(r, g, b) {
                    return [r / 255, g / 255, b / 255].join(", ");
                };
            }
        };
            class Animtext {
        // ANIMATED TEXT:
        constructor() {
            // INIT:
            this.init = function(x, y, scale, speed, life, text, color) {
                (this.x = x),
                    (this.y = y),
                    (this.color = color),
                    (this.scale = scale*2.5),
                    (this.weight = 50);
                (this.startScale = this.scale * 1.5),
                    (this.maxScale = 2.0 * scale),
                    (this.minScale = 0.5 * scale),
                    (this.scaleSpeed = 0.7),
                    (this.speed = speed),
                    (this.speedMax = speed),
                    (this.life = life),
                    (this.maxLife = life),
                    (this.text = text),
                    this.movSpeed = speed;
            };

            // UPDATE:
            this.update = function(delta) {
                if(this.life){
                    this.life -= delta;
                    if(this.scaleSpeed != -0.35){
                        this.y -= this.speed * delta;
                        (this.x += this.speed * delta);
                    } else {
                        this.y -= this.speed * delta;
                    }
                    this.scale -= .8;
                     // this.scale > 8 && (this.scale = Math.max(this.scale, this.startScale));
                     this.speed < this.speedMax && (this.speed -= this.speedMax * .0075);
                    if(this.scale >= this.maxScale){
                        this.scale = this.maxScale;
                        this.scaleSpeed *= -.5;
                        this.speed = this.speed * .75;
                    };
                    this.life <= 0 && (this.life = 0)
                };
            };

            // RENDER:
            this.render = function(ctxt, xOff, yOff) {
                ctxt.lineWidth = 10;
                ctxt.strokeStyle = darkOutlineColor; //"black";
                ctxt.fillStyle = this.color;
                ctxt.globalAlpha = 1;
                ctxt.font = this.scale + "px Lilita One";
                ctxt.strokeText(this.text, this.x - xOff, this.y - yOff);
                ctxt.fillText(this.text, this.x - xOff, this.y - yOff);
                ctxt.globalAlpha = 1;
            };
        }
    };
    class Textmanager {
        // TEXT MANAGER:
        constructor() {
            this.texts = [];
            this.stack = [];

            // UPDATE:
            this.update = function(delta, ctxt, xOff, yOff) {
                ctxt.textBaseline = "middle";
                ctxt.textAlign = "center";
                for (let i = 0; i < this.texts.length; ++i) {
                    if (this.texts[i].life) {
                        this.texts[i].update(delta);
                        this.texts[i].render(ctxt, xOff, yOff);
                    }
                }
            };

            // SHOW TEXT:
            this.showText = function(x, y, scale, speed, life, text, color) {
                let tmpText;
                for (let i = 0; i < this.texts.length; ++i) {
                    if (!this.texts[i].life) {
                        tmpText = this.texts[i];
                        break;
                    }
                }
                if (!tmpText) {
                    tmpText = new Animtext();
                    this.texts.push(tmpText);
                }
                tmpText.init(x, y, scale, speed, life, text, color);
            };
        }
    }
        class GameObject {
            constructor(sid) {
                this.sid = sid;

                // INIT:
                this.init = function (x, y, dir, scale, type, data, owner) {
                    data = data || {};
                    this.sentTo = {};
                    this.gridLocations = [];
                    this.active = true;
                    this.alive = true;
                    this.doUpdate = data.doUpdate;
                    this.x = x;
                    this.y = y;
                    if (config.anotherVisual) {
                        this.dir = dir + Math.PI;
                    } else {
                        this.dir = dir;
                    }
                    this.lastDir = dir;
                    this.xWiggle = 0;
                    this.yWiggle = 0;
                    this.visScale = scale;
                    this.scale = scale;
                    this.type = type;
                    this.id = data.id;
                    this.owner = owner;
                    this.name = data.name;
                    this.isItem = (this.id != undefined);
                    this.group = data.group;
                    this.maxHealth = data.health;
                    this.health = this.maxHealth;
                    this.layer = 2;
                    if (this.group != undefined) {
                        this.layer = this.group.layer;
                    } else if (this.type == 0) {
                        this.layer = 3;
                    } else if (this.type == 2) {
                        this.layer = 0;
                    } else if (this.type == 4) {
                        this.layer = -1;
                    }
                    this.colDiv = data.colDiv || 1;
                    this.blocker = data.blocker;
                    this.ignoreCollision = data.ignoreCollision;
                    this.dontGather = data.dontGather;
                    this.hideFromEnemy = data.hideFromEnemy;
                    this.friction = data.friction;
                    this.projDmg = data.projDmg;
                    this.dmg = data.dmg;
                    this.pDmg = data.pDmg;
                    this.pps = data.pps;
                    this.zIndex = data.zIndex || 0;
                    this.turnSpeed = data.turnSpeed;
                    this.req = data.req;
                    this.trap = data.trap;
                    this.healCol = data.healCol;
                    this.teleport = data.teleport;
                    this.boostSpeed = data.boostSpeed;
                    this.projectile = data.projectile;
                    this.shootRange = data.shootRange;
                    this.shootRate = data.shootRate;
                    this.shootCount = this.shootRate;
                    this.spawnPoint = data.spawnPoint;
                    this.onNear = 0;
                    this.breakObj = false;
                    this.alpha = data.alpha||1;
                    this.maxAlpha = data.alpha||1;
                    this.damaged = 0;
                    this.breakTime = 0;
                };
                // FADE-OUT PROCESS:
                this.startFadeOut = function () {
                    this.fadingOut = true;
                };
                // GET HIT:
                this.changeHealth = function (amount, doer) {
                    this.health += amount;
                    return (this.health <= 0);
                };

                // GET SCALE:
                this.getScale = function (sM, ig) {
                    sM = sM || 1;
                    return this.scale * ((this.isItem || this.type == 2 || this.type == 3 || this.type == 4) ?
                                         1 : (0.6 * sM)) * (ig ? 1 : this.colDiv);
                };

                // VISIBLE TO PLAYER:
                this.visibleToPlayer = function (player) {
                    return !(this.hideFromEnemy) || (this.owner && (this.owner == player ||
                                                                    (this.owner.team && player.team == this.owner.team)));
                };

                // UPDATE:
                this.update = function (delta) {
                    if (this.active) {
                        if (this.xWiggle) {
                            this.xWiggle *= Math.pow(0.99, delta);
                        }
                        if (this.yWiggle) {
                            this.yWiggle *= Math.pow(0.99, delta);
                        }

                        if (this.turnSpeed && this.dmg) {
                            this.dir += this.turnSpeed * delta;
                        }
                        if (this.hideFromEnemy && this.isTeamObject(player)) {
                            for (let i of enemy) {
                                let nearDist = UTILS.getDist({x: this.x, y: this.y}, i, 0, 2)
                                if (nearDist < 49) {
                                    this.hideFromEnemy = false
                                }
                            }
                        }
                    } else if (this.fadingOut) {
                        if (this.alpha > 0) {
                            this.alpha -= delta;
                            if (this.alpha <= 0) {
                                this.alpha = 0;
                                this.alive = false;
                                this.fadingOut = false;
                            }
                        }
                    } else {
                        if (this.alive) {
                            this.alpha -= delta / (200 / this.maxAlpha);
                            this.visScale += delta / (this.scale / 2.5);
                            if (this.alpha <= 0) {
                                this.alpha = 0;
                                this.alive = false;
                            }
                        }
                    }
                };

                // CHECK TEAM:
                this.isTeamObject = function (tmpObj) {
                    return this.owner == null ? true : (this.owner && tmpObj.sid == this.owner.sid || tmpObj.findAllianceBySid(this.owner.sid));
                };
            }
        }
        class Items {
            constructor() {
                // ITEM GROUPS:
                this.groups = [{
                    id: 0,
                    name: "food",
                    layer: 0
                }, {
                    id: 1,
                    name: "walls",
                    place: true,
                    limit: 30,
                    layer: 0
                }, {
                    id: 2,
                    name: "spikes",
                    place: true,
                    limit: 15,
                    layer: 0
                }, {
                    id: 3,
                    name: "mill",
                    place: true,
                    limit: 7,
                    layer: 1
                }, {
                    id: 4,
                    name: "mine",
                    place: true,
                    limit: 1,
                    layer: 0
                }, {
                    id: 5,
                    name: "trap",
                    place: true,
                    limit: 6,
                    layer: -1
                }, {
                    id: 6,
                    name: "booster",
                    place: true,
                    limit: 12,
                    layer: -1
                }, {
                    id: 7,
                    name: "turret",
                    place: true,
                    limit: 2,
                    layer: 1
                }, {
                    id: 8,
                    name: "watchtower",
                    place: true,
                    limit: 12,
                    layer: 1
                }, {
                    id: 9,
                    name: "buff",
                    place: true,
                    limit: 4,
                    layer: -1
                }, {
                    id: 10,
                    name: "spawn",
                    place: true,
                    limit: 1,
                    layer: -1
                }, {
                    id: 11,
                    name: "sapling",
                    place: true,
                    limit: 2,
                    layer: 0
                }, {
                    id: 12,
                    name: "blocker",
                    place: true,
                    limit: 3,
                    layer: -1
                }, {
                    id: 13,
                    name: "teleporter",
                    place: true,
                    limit: 2,
                    layer: -1
                }];

                // PROJECTILES:
                this.projectiles = [{
                    indx: 0,
                    layer: 0,
                    src: "arrow_1",
                    dmg: 25,
                    speed: 1.6,
                    scale: 103,
                    range: 1000
                }, {
                    indx: 1,
                    layer: 1,
                    dmg: 25,
                    scale: 20
                }, {
                    indx: 0,
                    layer: 0,
                    src: "arrow_1",
                    dmg: 35,
                    speed: 2.5,
                    scale: 103,
                    range: 1200
                }, {
                    indx: 0,
                    layer: 0,
                    src: "arrow_1",
                    dmg: 30,
                    speed: 2,
                    scale: 103,
                    range: 1200
                }, {
                    indx: 1,
                    layer: 1,
                    dmg: 16,
                    scale: 20
                }, {
                    indx: 0,
                    layer: 0,
                    src: "bullet_1",
                    dmg: 50,
                    speed: 3.6,
                    scale: 160,
                    range: 1400
                }];

                // WEAPONS:
                this.weapons = [{
                    id: 0,
                    type: 0,
                    name: "tool hammer",
                    desc: "tool for gathering all resources",
                    src: "hammer_1",
                    length: 140,
                    width: 140,
                    xOff: -3,
                    yOff: 18,
                    dmg: 25,
                    range: 65,
                    gather: 1,
                    speed: 300
                }, {
                    id: 1,
                    type: 0,
                    age: 2,
                    name: "hand axe",
                    desc: "gathers resources at a higher rate",
                    src: "axe_1",
                    length: 140,
                    width: 140,
                    xOff: 3,
                    yOff: 24,
                    dmg: 30,
                    spdMult: 1,
                    range: 70,
                    gather: 2,
                    speed: 400
                }, {
                    id: 2,
                    type: 0,
                    age: 8,
                    pre: 1,
                    name: "great axe",
                    desc: "deal more damage and gather more resources",
                    src: "great_axe_1",
                    length: 140,
                    width: 140,
                    xOff: -8,
                    yOff: 25,
                    dmg: 35,
                    spdMult: 1,
                    range: 75,
                    gather: 4,
                    speed: 400
                }, {
                    id: 3,
                    type: 0,
                    age: 2,
                    name: "short sword",
                    desc: "increased attack power but slower move speed",
                    src: "sword_1",
                    iPad: 1.3,
                    length: 130,
                    width: 210,
                    xOff: -8,
                    yOff: 46,
                    dmg: 35,
                    spdMult: 0.85,
                    range: 110,
                    gather: 1,
                    speed: 300
                }, {
                    id: 4,
                    type: 0,
                    age: 8,
                    pre: 3,
                    name: "katana",
                    desc: "greater range and damage",
                    src: "samurai_1",
                    iPad: 1.3,
                    length: 130,
                    width: 210,
                    xOff: -8,
                    yOff: 59,
                    dmg: 40,
                    spdMult: 0.8,
                    range: 118,
                    gather: 1,
                    speed: 300
                }, {
                    id: 5,
                    type: 0,
                    age: 2,
                    name: "polearm",
                    desc: "long range melee weapon",
                    src: "spear_1",
                    iPad: 1.3,
                    length: 130,
                    width: 210,
                    xOff: -8,
                    yOff: 53,
                    dmg: 45,
                    knock: 0.2,
                    spdMult: 0.82,
                    range: 142,
                    gather: 1,
                    speed: 700
                }, {
                    id: 6,
                    type: 0,
                    age: 2,
                    name: "bat",
                    desc: "fast long range melee weapon",
                    src: "bat_1",
                    iPad: 1.3,
                    length: 110,
                    width: 180,
                    xOff: -8,
                    yOff: 53,
                    dmg: 20,
                    knock: 0.7,
                    range: 110,
                    gather: 1,
                    speed: 300
                }, {
                    id: 7,
                    type: 0,
                    age: 2,
                    name: "daggers",
                    desc: "really fast short range weapon",
                    src: "dagger_1",
                    iPad: 0.8,
                    length: 110,
                    width: 110,
                    xOff: 18,
                    yOff: 0,
                    dmg: 20,
                    knock: 0.1,
                    range: 65,
                    gather: 1,
                    hitSlow: 0.1,
                    spdMult: 1.13,
                    speed: 100
                }, {
                    id: 8,
                    type: 0,
                    age: 2,
                    name: "stick",
                    desc: "great for gathering but very weak",
                    src: "stick_1",
                    length: 140,
                    width: 140,
                    xOff: 3,
                    yOff: 24,
                    dmg: 1,
                    spdMult: 1,
                    range: 70,
                    gather: 7,
                    speed: 400
                }, {
                    id: 9,
                    type: 1,
                    age: 6,
                    name: "hunting bow",
                    desc: "bow used for ranged combat and hunting",
                    src: "bow_1",
                    req: ["wood", 4],
                    length: 120,
                    width: 120,
                    xOff: -6,
                    yOff: 0,
                    Pdmg: 25,
                    projectile: 0,
                    spdMult: 0.75,
                    speed: 600
                }, {
                    id: 10,
                    type: 1,
                    age: 6,
                    name: "great hammer",
                    desc: "hammer used for destroying structures",
                    src: "great_hammer_1",
                    length: 140,
                    width: 140,
                    xOff: -9,
                    yOff: 25,
                    dmg: 10,
                    Pdmg: 10,
                    spdMult: 0.88,
                    range: 75,
                    sDmg: 7.5,
                    gather: 1,
                    speed: 400
                }, {
                    id: 11,
                    type: 1,
                    age: 6,
                    name: "wooden shield",
                    desc: "blocks projectiles and reduces melee damage",
                    src: "shield_1",
                    length: 120,
                    width: 120,
                    shield: 0.2,
                    xOff: 6,
                    yOff: 0,
                    Pdmg: 0,
                    spdMult: 0.7
                }, {
                    id: 12,
                    type: 1,
                    age: 8,
                    pre: 9,
                    name: "crossbow",
                    desc: "deals more damage and has greater range",
                    src: "crossbow_1",
                    req: ["wood", 5],
                    aboveHand: true,
                    armS: 0.75,
                    length: 120,
                    width: 120,
                    xOff: -4,
                    yOff: 0,
                    Pdmg: 35,
                    projectile: 2,
                    spdMult: 0.7,
                    speed: 700
                }, {
                    id: 13,
                    type: 1,
                    age: 9,
                    pre: 12,
                    name: "repeater crossbow",
                    desc: "high firerate crossbow with reduced damage",
                    src: "crossbow_2",
                    req: ["wood", 10],
                    aboveHand: true,
                    armS: 0.75,
                    length: 120,
                    width: 120,
                    xOff: -4,
                    yOff: 0,
                    Pdmg: 30,
                    projectile: 3,
                    spdMult: 0.7,
                    speed: 230
                }, {
                    id: 14,
                    type: 1,
                    age: 6,
                    name: "mc grabby",
                    desc: "steals resources from enemies",
                    src: "grab_1",
                    length: 130,
                    width: 210,
                    xOff: -8,
                    yOff: 53,
                    dmg: 0,
                    Pdmg: 0,
                    steal: 250,
                    knock: 0.2,
                    spdMult: 1.05,
                    range: 125,
                    gather: 0,
                    speed: 700
                }, {
                    id: 15,
                    type: 1,
                    age: 9,
                    pre: 12,
                    name: "musket",
                    desc: "slow firerate but high damage and range",
                    src: "musket_1",
                    req: ["stone", 10],
                    aboveHand: true,
                    rec: 0.35,
                    armS: 0.6,
                    hndS: 0.3,
                    hndD: 1.6,
                    length: 205,
                    width: 205,
                    xOff: 25,
                    yOff: 0,
                    Pdmg: 50,
                    projectile: 5,
                    hideProjectile: true,
                    spdMult: 0.6,
                    speed: 1500
                }];

                // ITEMS:
                this.list = [{
                    group: this.groups[0],
                    name: "apple",
                    desc: "restores 20 health when consumed",
                    req: ["food", 10],
                    consume: function (doer) {
                        return doer.changeHealth(20, doer);
                    },
                    scale: 22,
                    holdOffset: 15,
                    healing: 20,
                    itemID: 0,
                    itemAID: 16,
                }, {
                    age: 3,
                    group: this.groups[0],
                    name: "cookie",
                    desc: "restores 40 health when consumed",
                    req: ["food", 15],
                    consume: function (doer) {
                        return doer.changeHealth(40, doer);
                    },
                    scale: 27,
                    holdOffset: 15,
                    healing: 40,
                    itemID: 1,
                    itemAID: 17,
                }, {
                    age: 7,
                    group: this.groups[0],
                    name: "cheese",
                    desc: "restores 30 health and another 50 over 5 seconds",
                    req: ["food", 25],
                    consume: function (doer) {
                        if (doer.changeHealth(30, doer) || doer.health < 100) {
                            doer.dmgOverTime.dmg = -10;
                            doer.dmgOverTime.doer = doer;
                            doer.dmgOverTime.time = 5;
                            return true;
                        }
                        return false;
                    },
                    scale: 27,
                    holdOffset: 15,
                    healing: 30,
                    itemID: 2,
                    itemAID: 18,
                }, {
                    group: this.groups[1],
                    name: "wood wall",
                    desc: "provides protection for your village",
                    req: ["wood", 10],
                    projDmg: true,
                    health: 380,
                    scale: 50,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 3,
                    itemAID: 19,
                }, {
                    age: 3,
                    group: this.groups[1],
                    name: "stone wall",
                    desc: "provides improved protection for your village",
                    req: ["stone", 25],
                    health: 900,
                    scale: 50,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 4,
                    itemAID: 20,
                }, {
                    age: 7,
                    group: this.groups[1],
                    name: "castle wall",
                    desc: "provides powerful protection for your village",
                    req: ["stone", 35],
                    health: 1500,
                    scale: 52,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 5,
                    itemAID: 21,
                }, {
                    group: this.groups[2],
                    name: "spikes",
                    desc: "damages enemies when they touch them",
                    req: ["wood", 20, "stone", 5],
                    health: 400,
                    dmg: 20,
                    scale: 49,
                    spritePadding: -23,
                    holdOffset: 8,
                    placeOffset: -5,
                    itemID: 6,
                    itemAID: 22,
                }, {
                    age: 5,
                    group: this.groups[2],
                    name: "greater spikes",
                    desc: "damages enemies when they touch them",
                    req: ["wood", 30, "stone", 10],
                    health: 500,
                    dmg: 35,
                    scale: 52,
                    spritePadding: -23,
                    holdOffset: 8,
                    placeOffset: -5,
                    itemID: 7,
                    itemAID: 23,
                }, {
                    age: 9,
                    group: this.groups[2],
                    name: "poison spikes",
                    desc: "poisons enemies when they touch them",
                    req: ["wood", 35, "stone", 15],
                    health: 600,
                    dmg: 30,
                    pDmg: 5,
                    scale: 52,
                    spritePadding: -23,
                    holdOffset: 8,
                    placeOffset: -5,
                    itemID: 8,
                    itemAID: 24,
                }, {
                    age: 9,
                    group: this.groups[2],
                    name: "spinning spikes",
                    desc: "damages enemies when they touch them",
                    req: ["wood", 30, "stone", 20],
                    health: 500,
                    dmg: 45,
                    turnSpeed: 0.003,
                    scale: 52,
                    spritePadding: -23,
                    holdOffset: 8,
                    placeOffset: -5,
                    itemID: 9,
                    itemAID: 25,
                }, {
                    group: this.groups[3],
                    name: "windmill",
                    desc: "generates gold over time",
                    req: ["wood", 50, "stone", 10],
                    health: 400,
                    pps: 1,
                    turnSpeed: 0.0016,
                    spritePadding: 25,
                    iconLineMult: 12,
                    scale: 45,
                    holdOffset: 20,
                    placeOffset: 5,
                    itemID: 10,
                    itemAID: 26,
                }, {
                    age: 5,
                    group: this.groups[3],
                    name: "faster windmill",
                    desc: "generates more gold over time",
                    req: ["wood", 60, "stone", 20],
                    health: 500,
                    pps: 1.5,
                    turnSpeed: 0.0025,
                    spritePadding: 25,
                    iconLineMult: 12,
                    scale: 47,
                    holdOffset: 20,
                    placeOffset: 5,
                    itemID: 11,
                    itemAID: 27,
                }, {
                    age: 8,
                    group: this.groups[3],
                    name: "power mill",
                    desc: "generates more gold over time",
                    req: ["wood", 100, "stone", 50],
                    health: 800,
                    pps: 2,
                    turnSpeed: 0.005,
                    spritePadding: 25,
                    iconLineMult: 12,
                    scale: 47,
                    holdOffset: 20,
                    placeOffset: 5,
                    itemID: 12,
                    itemAID: 28,
                }, {
                    age: 5,
                    group: this.groups[4],
                    type: 2,
                    name: "mine",
                    desc: "allows you to mine stone",
                    req: ["wood", 20, "stone", 100],
                    iconLineMult: 12,
                    scale: 65,
                    holdOffset: 20,
                    placeOffset: 0,
                    itemID: 13,
                    itemAID: 29,
                }, {
                    age: 5,
                    group: this.groups[11],
                    type: 0,
                    name: "sapling",
                    desc: "allows you to farm wood",
                    req: ["wood", 150],
                    iconLineMult: 12,
                    colDiv: 0.5,
                    scale: 110,
                    holdOffset: 50,
                    placeOffset: -15,
                    itemID: 14,
                    itemAID: 30,
                }, {
                    age: 4,
                    group: this.groups[5],
                    name: "pit trap",
                    desc: "pit that traps enemies if they walk over it",
                    req: ["wood", 30, "stone", 30],
                    trap: true,
                    ignoreCollision: true,
                    hideFromEnemy: true,
                    health: 500,
                    colDiv: 0.2,
                    scale: 50,
                    holdOffset: 20,
                    placeOffset: -5,
                    alpha: 0.6,
                    itemID: 15,
                    itemAID: 31,
                }, {
                    age: 4,
                    group: this.groups[6],
                    name: "boost pad",
                    desc: "provides boost when stepped on",
                    req: ["stone", 20, "wood", 5],
                    ignoreCollision: true,
                    boostSpeed: 1.5,
                    health: 150,
                    colDiv: 0.7,
                    scale: 45,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 16,
                    itemAID: 32,
                }, {
                    age: 7,
                    group: this.groups[7],
                    doUpdate: true,
                    name: "turret",
                    desc: "defensive structure that shoots at enemies",
                    req: ["wood", 200, "stone", 150],
                    health: 800,
                    projectile: 1,
                    shootRange: 700,
                    shootRate: 2200,
                    scale: 43,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 17,
                    itemAID: 33,
                }, {
                    age: 7,
                    group: this.groups[8],
                    name: "platform",
                    desc: "platform to shoot over walls and cross over water",
                    req: ["wood", 20],
                    ignoreCollision: true,
                    zIndex: 1,
                    health: 300,
                    scale: 43,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 18,
                    itemAID: 34,
                }, {
                    age: 7,
                    group: this.groups[9],
                    name: "healing pad",
                    desc: "standing on it will slowly heal you",
                    req: ["wood", 30, "food", 10],
                    ignoreCollision: true,
                    healCol: 15,
                    health: 400,
                    colDiv: 0.7,
                    scale: 45,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 19,
                    itemAID: 35,
                }, {
                    age: 9,
                    group: this.groups[10],
                    name: "spawn pad",
                    desc: "you will spawn here when you die but it will dissapear",
                    req: ["wood", 100, "stone", 100],
                    health: 400,
                    ignoreCollision: true,
                    spawnPoint: true,
                    scale: 45,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 20,
                    itemAID: 36,
                }, {
                    age: 7,
                    group: this.groups[12],
                    name: "blocker",
                    desc: "blocks building in radius",
                    req: ["wood", 30, "stone", 25],
                    ignoreCollision: true,
                    blocker: 300,
                    health: 400,
                    colDiv: 0.7,
                    scale: 45,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 21,
                    itemAID: 37,
                }, {
                    age: 7,
                    group: this.groups[13],
                    name: "teleporter",
                    desc: "teleports you to a random point on the map",
                    req: ["wood", 60, "stone", 60],
                    ignoreCollision: true,
                    teleport: true,
                    health: 200,
                    colDiv: 0.7,
                    scale: 45,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 22,
                    itemAID: 38
                }];

                // CHECK ITEM ID:
                this.checkItem = {
                    index: function(id, myItems) {
                        return [0, 1, 2].includes(id) ? 0 :
                        [3, 4, 5].includes(id) ? 1 :
                        [6, 7, 8, 9].includes(id) ? 2 :
                        [10, 11, 12].includes(id) ? 3 :
                        [13, 14].includes(id) ? 5 :
                        [15, 16].includes(id) ? 4 :
                        [17, 18, 19, 21, 22].includes(id) ?
                            [13, 14].includes(myItems) ? 6 :
                        5 :
                        id == 20 ?
                            [13, 14].includes(myItems) ? 7 :
                        6 :
                        undefined;
                    }
                }

                // ASSIGN IDS:
                for (let i = 0; i < this.list.length; ++i) {
                    this.list[i].id = i;
                    if (this.list[i].pre) this.list[i].pre = i - this.list[i].pre;
                }

                // TROLOLOLOL:
                if (typeof window !== "undefined") {
                    function shuffle(a) {
                        for (let i = a.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [a[i], a[j]] = [a[j], a[i]];
                        }
                        return a;
                    }
                    //shuffle(this.list);
                }
            }
        }
        class Objectmanager {
            constructor(GameObject, gameObjects, UTILS, config, players, server) {
                let mathFloor = Math.floor,
                    mathABS = Math.abs,
                    mathCOS = Math.cos,
                    mathSIN = Math.sin,
                    mathPOW = Math.pow,
                    mathSQRT = Math.sqrt;

                this.ignoreAdd = false;
                this.hitObj = [];

                // DISABLE OBJ:
                this.disableObj = function (obj) {
                    obj.active = false;
                    obj.breakTime = Date.now();
                    obj.startFadeOut();
                };

                // ADD NEW:
                let tmpObj;
                this.add = function (sid, x, y, dir, s, type, data, setSID, owner) {
                    tmpObj = findObjectBySid(sid);
                    if (!tmpObj) {
                        tmpObj = gameObjects.find((tmp) => !tmp.active);
                        if (!tmpObj) {
                            tmpObj = new GameObject(sid);
                            gameObjects.push(tmpObj);
                        }
                    }
                    if (setSID) {
                        tmpObj.sid = sid;
                    }
                    tmpObj.init(x, y, dir, s, type, data, owner);
                };

                // DISABLE BY SID:
                this.disableBySid = function (sid) {
                    let find = findObjectBySid(sid);
                    if (find) {
                        this.disableObj(find);
                    }
                };

                // REMOVE ALL FROM PLAYER:
                this.removeAllItems = function (sid, server) {
                    gameObjects.filter((tmp) => tmp.active && tmp.owner && tmp.owner.sid == sid).forEach((tmp) => this.disableObj(tmp));
                };

                // CHECK IF PLACABLE:
                this.checkItemLocation = function(x, y, s, sM, indx, ignoreWater) {
                    let cantPlace = nearObjs.find((tmp) => tmp.active && UTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
                    if (cantPlace) return false;
                    if (!ignoreWater && indx != 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) return false;
                    return true;
                };

                this.preplaceCheck = function(x, y, s, sM, indx, ignoreWater, object){
                    let cantPlace = nearObjs.find((tmp) => tmp.active && tmp.sid != object.sid && UTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
                    if (cantPlace) return false;
                    if (!ignoreWater && indx != 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) return false;
                    let additionalStuff = UTILS.getDistance(x, y, object.x, object.y) < s + object.scale
                    if (!additionalStuff) return false;
                    return true;
                };

                this.canBeBroken = function(object) {
                    if (!inGame || !object || !enemy.length) return;
                    let playerWeapon = player.weapons[autoBreak.useHammer(object) ? 1 : 0];
                    let playerVariant = player[(playerWeapon < 9 ? "prima" : "seconda") + "ryVariant"];
                    let playerVariantDmg = playerVariant != undefined ? config.weaponVariants[playerVariant].val : 1;

                    let enemyWeapon = (near.secondaryIndex != undefined && near.primaryIndex != undefined) ? (near.secondaryIndex == 10 && ((object.health > items.weapons[near.weapons[0]].dmg) || near.primaryIndex == 5)) ? near.secondaryIndex : near.primaryIndex : 10
                    let enemyVariant = (near.secondaryIndex != undefined && near.primaryIndex != undefined) ? near[(enemyWeapon < 9 ? "prima" : "seconda") + "ryVariant"] : 3;
                    let enemyVariantDmg = config.weaponVariants[enemyVariant].val;

                    let playerDamage = items.weapons[playerWeapon].dmg;
                    let enemyDamage = items.weapons[enemyWeapon].dmg;

                    let tank = 3.3

                    let damageThreat = 0

                    if (near.reloads[enemyWeapon] == 0 && this.canHit(near, object, enemyWeapon, 24)) {
                        damageThreat += enemyDamage * tank * enemyVariantDmg * (items.weapons[playerWeapon].sDmg || 1);
                    }

                    if (player.reloads[playerWeapon] == 0 && (clicks.right || (autoBreak.active && (autoBreak.priority[0].includes(object) || autoBreak.priority[1].includes(object) || autoBreak.priority[2].includes(object))))) {
                        damageThreat += playerDamage * tank * playerVariantDmg * (items.weapons[playerWeapon].sDmg || 1);
                    }

                    if (object.health <= damageThreat) {
                        return true
                    }
                    return false
                };

                this.hitsToBreak = function(object, who) {
                    if (!inGame || !object || !enemy.length || !who) return;

                    // Determine player weapon and its variant damage
                    let weapon = autoBreak.useHammer(object, who) ? who.weapons[1] : who.weapons[0];
                    let variant = who[(weapon < 9 ? "prima" : "seconda") + "ryVariant"];
                    let variantDmg = variant != undefined ? config.weaponVariants[variant].val : 1.18;
                    let damage = items.weapons[weapon].dmg;

                    let tank = 3.3;

                    // Calculate hits required for player
                    let effectiveDamage = damage * tank * variantDmg * (items.weapons[weapon].sDmg || 1);
                    return Math.ceil(object.health / effectiveDamage);
                };

                this.canHit = function(player, object, weapon, moreSafe = 0) {
                    return UTILS.getDist(player, object, 2, 0) <= items.weapons[weapon].range + object.scale + moreSafe;
                };

            }
        }
        class Projectile {
            constructor(players, ais, objectManager, items, config, UTILS, server) {

                // INIT:
                this.init = function (indx, x, y, dir, spd, dmg, rng, scl, owner) {
                    this.active = true;
                    this.tickActive = true;
                    this.indx = indx;
                    this.x = x;
                    this.y = y;
                    this.x2 = x;
                    this.y2 = y;
                    this.dir = dir;
                    this.skipMov = true;
                    this.speed = spd;
                    this.dmg = dmg;
                    this.scale = scl;
                    this.range = rng;
                    this.r2 = rng;
                    this.owner = owner;
                };

                // UPDATE:
                this.update = function (delta) {
                    if (this.active) {
                        let tmpSpeed = this.speed * delta;
                        if (!this.skipMov) {
                            this.x += tmpSpeed * Math.cos(this.dir);
                            this.y += tmpSpeed * Math.sin(this.dir);
                            this.range -= tmpSpeed;
                            if (this.range <= 0) {
                                this.x += this.range * Math.cos(this.dir);
                                this.y += this.range * Math.sin(this.dir);
                                tmpSpeed = 1;
                                this.range = 0;
                                this.active = false;
                            }
                        } else {
                            this.skipMov = false;
                        }
                    }
                };
                this.tickUpdate = function (delta) {
                    if (this.tickActive) {
                        let tmpSpeed = this.speed * delta;
                        if (!this.skipMov) {
                            this.x2 += tmpSpeed * Math.cos(this.dir);
                            this.y2 += tmpSpeed * Math.sin(this.dir);
                            this.r2 -= tmpSpeed;
                            if (this.r2 <= 0) {
                                this.x2 += this.r2 * Math.cos(this.dir);
                                this.y2 += this.r2 * Math.sin(this.dir);
                                tmpSpeed = 1;
                                this.r2 = 0;
                                this.tickActive = false;
                            }
                        } else {
                            this.skipMov = false;
                        }
                    }
                };
            }
        };
        class Store {
            constructor() {
                // STORE HATS:
                this.hats = [{
                    id: 45,
                    name: "Shame!",
                    dontSell: true,
                    price: 0,
                    scale: 120,
                    desc: "hacks are for winners"
                }, {
                    id: 51,
                    name: "Moo Cap",
                    price: 0,
                    scale: 120,
                    desc: "coolest mooer around"
                }, {
                    id: 50,
                    name: "Apple Cap",
                    price: 0,
                    scale: 120,
                    desc: "apple farms remembers"
                }, {
                    id: 28,
                    name: "Moo Head",
                    price: 0,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 29,
                    name: "Pig Head",
                    price: 0,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 30,
                    name: "Fluff Head",
                    price: 0,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 36,
                    name: "Pandou Head",
                    price: 0,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 37,
                    name: "Bear Head",
                    price: 0,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 38,
                    name: "Monkey Head",
                    price: 0,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 44,
                    name: "Polar Head",
                    price: 0,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 35,
                    name: "Fez Hat",
                    price: 0,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 42,
                    name: "Enigma Hat",
                    price: 0,
                    scale: 120,
                    desc: "join the enigma army"
                }, {
                    id: 43,
                    name: "Blitz Hat",
                    price: 0,
                    scale: 120,
                    desc: "hey everybody i'm blitz"
                }, {
                    id: 49,
                    name: "Bob XIII Hat",
                    price: 0,
                    scale: 120,
                    desc: "like and subscribe"
                }, {
                    id: 57,
                    name: "Pumpkin",
                    price: 50,
                    scale: 120,
                    desc: "Spooooky"
                }, {
                    id: 8,
                    name: "Bummle Hat",
                    price: 100,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 2,
                    name: "Straw Hat",
                    price: 500,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 15,
                    name: "Winter Cap",
                    price: 600,
                    scale: 120,
                    desc: "allows you to move at normal speed in snow",
                    coldM: 1
                }, {
                    id: 5,
                    name: "Cowboy Hat",
                    price: 1000,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 4,
                    name: "Ranger Hat",
                    price: 2000,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 18,
                    name: "Explorer Hat",
                    price: 2000,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 31,
                    name: "Flipper Hat",
                    price: 2500,
                    scale: 120,
                    desc: "have more control while in water",
                    watrImm: true
                }, {
                    id: 1,
                    name: "Marksman Cap",
                    price: 3000,
                    scale: 120,
                    desc: "increases arrow speed and range",
                    aMlt: 1.3
                }, {
                    id: 10,
                    name: "Bush Gear",
                    price: 3000,
                    scale: 160,
                    desc: "allows you to disguise yourself as a bush"
                }, {
                    id: 48,
                    name: "Halo",
                    price: 3000,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 6,
                    name: "Soldier Helmet",
                    price: 4000,
                    scale: 120,
                    desc: "reduces damage taken but slows movement",
                    spdMult: 0.94,
                    dmgMult: 0.75
                }, {
                    id: 23,
                    name: "Anti Venom Gear",
                    price: 4000,
                    scale: 120,
                    desc: "makes you immune to poison",
                    poisonRes: 1
                }, {
                    id: 13,
                    name: "Medic Gear",
                    price: 5000,
                    scale: 110,
                    desc: "slowly regenerates health over time",
                    healthRegen: 3
                }, {
                    id: 9,
                    name: "Miners Helmet",
                    price: 5000,
                    scale: 120,
                    desc: "earn 1 extra gold per resource",
                    extraGold: 1
                }, {
                    id: 32,
                    name: "Musketeer Hat",
                    price: 5000,
                    scale: 120,
                    desc: "reduces cost of projectiles",
                    projCost: 0.5
                }, {
                    id: 7,
                    name: "Bull Helmet",
                    price: 6000,
                    scale: 120,
                    desc: "increases damage done but drains health",
                    healthRegen: -5,
                    dmgMultO: 1.5,
                    spdMult: 0.96
                }, {
                    id: 22,
                    name: "Emp Helmet",
                    price: 6000,
                    scale: 120,
                    desc: "turrets won't attack but you move slower",
                    antiTurret: 1,
                    spdMult: 0.7
                }, {
                    id: 12,
                    name: "Booster Hat",
                    price: 6000,
                    scale: 120,
                    desc: "increases your movement speed",
                    spdMult: 1.16
                }, {
                    id: 26,
                    name: "Barbarian Armor",
                    price: 8000,
                    scale: 120,
                    desc: "knocks back enemies that attack you",
                    dmgK: 0.6
                }, {
                    id: 21,
                    name: "Plague Mask",
                    price: 10000,
                    scale: 120,
                    desc: "melee attacks deal poison damage",
                    poisonDmg: 5,
                    poisonTime: 6
                }, {
                    id: 46,
                    name: "Bull Mask",
                    price: 10000,
                    scale: 120,
                    desc: "bulls won't target you unless you attack them",
                    bullRepel: 1
                }, {
                    id: 14,
                    name: "Windmill Hat",
                    topSprite: true,
                    price: 10000,
                    scale: 120,
                    desc: "generates points while worn",
                    pps: 1.5
                }, {
                    id: 11,
                    name: "Spike Gear",
                    topSprite: true,
                    price: 10000,
                    scale: 120,
                    desc: "deal damage to players that damage you",
                    dmg: 0.45
                }, {
                    id: 53,
                    name: "Turret Gear",
                    topSprite: true,
                    price: 10000,
                    scale: 120,
                    desc: "you become a walking turret",
                    turret: {
                        proj: 1,
                        range: 700,
                        rate: 2500
                    },
                    spdMult: 0.7
                }, {
                    id: 20,
                    name: "Samurai Armor",
                    price: 12000,
                    scale: 120,
                    desc: "increased attack speed and fire rate",
                    atkSpd: 0.78
                }, {
                    id: 58,
                    name: "Dark Knight",
                    price: 12000,
                    scale: 120,
                    desc: "restores health when you deal damage",
                    healD: 0.4
                }, {
                    id: 27,
                    name: "Scavenger Gear",
                    price: 15000,
                    scale: 120,
                    desc: "earn double points for each kill",
                    kScrM: 2
                }, {
                    id: 40,
                    name: "Tank Gear",
                    price: 15000,
                    scale: 120,
                    desc: "increased damage to buildings but slower movement",
                    spdMult: 0.3,
                    bDmg: 3.3
                }, {
                    id: 52,
                    name: "Thief Gear",
                    price: 15000,
                    scale: 120,
                    desc: "steal half of a players gold when you kill them",
                    goldSteal: 0.5
                }, {
                    id: 55,
                    name: "Bloodthirster",
                    price: 20000,
                    scale: 120,
                    desc: "Restore Health when dealing damage. And increased damage",
                    healD: 0.25,
                    dmgMultO: 1.2,
                }, {
                    id: 56,
                    name: "Assassin Gear",
                    price: 20000,
                    scale: 120,
                    desc: "Go invisible when not moving. Can't eat. Increased speed",
                    noEat: true,
                    spdMult: 1.1,
                    invisTimer: 1000
                }];

                // STORE ACCESSORIES:
                this.accessories = [{
                    id: 12,
                    name: "Snowball",
                    price: 1000,
                    scale: 105,
                    xOff: 18,
                    desc: "no effect"
                }, {
                    id: 9,
                    name: "Tree Cape",
                    price: 1000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 10,
                    name: "Stone Cape",
                    price: 1000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 3,
                    name: "Cookie Cape",
                    price: 1500,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 8,
                    name: "Cow Cape",
                    price: 2000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 11,
                    name: "Monkey Tail",
                    price: 2000,
                    scale: 97,
                    xOff: 25,
                    desc: "Super speed but reduced damage",
                    spdMult: 1.35,
                    dmgMultO: 0.2
                }, {
                    id: 17,
                    name: "Apple Basket",
                    price: 3000,
                    scale: 80,
                    xOff: 12,
                    desc: "slowly regenerates health over time",
                    healthRegen: 1
                }, {
                    id: 6,
                    name: "Winter Cape",
                    price: 3000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 4,
                    name: "Skull Cape",
                    price: 4000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 5,
                    name: "Dash Cape",
                    price: 5000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 2,
                    name: "Dragon Cape",
                    price: 6000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 1,
                    name: "Super Cape",
                    price: 8000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 7,
                    name: "Troll Cape",
                    price: 8000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 14,
                    name: "Thorns",
                    price: 10000,
                    scale: 115,
                    xOff: 20,
                    desc: "no effect"
                }, {
                    id: 15,
                    name: "Blockades",
                    price: 10000,
                    scale: 95,
                    xOff: 15,
                    desc: "no effect"
                }, {
                    id: 20,
                    name: "Devils Tail",
                    price: 10000,
                    scale: 95,
                    xOff: 20,
                    desc: "no effect"
                }, {
                    id: 16,
                    name: "Sawblade",
                    price: 12000,
                    scale: 90,
                    spin: true,
                    xOff: 0,
                    desc: "deal damage to players that damage you",
                    dmg: 0.15
                }, {
                    id: 13,
                    name: "Angel Wings",
                    price: 15000,
                    scale: 138,
                    xOff: 22,
                    desc: "slowly regenerates health over time",
                    healthRegen: 3
                }, {
                    id: 19,
                    name: "Shadow Wings",
                    price: 15000,
                    scale: 138,
                    xOff: 22,
                    desc: "increased movement speed",
                    spdMult: 1.1
                }, {
                    id: 18,
                    name: "Blood Wings",
                    price: 20000,
                    scale: 178,
                    xOff: 26,
                    desc: "restores health when you deal damage",
                    healD: 0.2
                }, {
                    id: 21,
                    name: "Corrupt X Wings",
                    price: 20000,
                    scale: 178,
                    xOff: 26,
                    desc: "deal damage to players that damage you",
                    dmg: 0.25
                }];
            }
        };
        class ProjectileManager {
            constructor(Projectile, projectiles, players, ais, objectManager, items, config, UTILS, server) {
                this.addProjectile = function (x, y, dir, range, speed, indx, owner, ignoreObj, layer, inWindow) {
                    let tmpData = items.projectiles[indx];
                    let tmpProj;
                    for (let i = 0; i < projectiles.length; ++i) {
                        if (!projectiles[i].active) {
                            tmpProj = projectiles[i];
                            break;
                        }
                    }
                    if (!tmpProj) {
                        tmpProj = new Projectile(players, ais, objectManager, items, config, UTILS, server);
                        tmpProj.sid = projectiles.length;
                        projectiles.push(tmpProj);
                    }
                    tmpProj.init(indx, x, y, dir, speed, tmpData.dmg, range, tmpData.scale, owner);
                    tmpProj.ignoreObj = ignoreObj;
                    tmpProj.layer = layer || tmpData.layer;
                    tmpProj.inWindow = inWindow;
                    tmpProj.src = tmpData.src;
                    return tmpProj;
                };
            }
        };
        class AiManager {

            // AI MANAGER:
            constructor(ais, AI, players, items, objectManager, config, UTILS, scoreCallback, server) {

                // AI TYPES:
                this.aiTypes = [{
                    id: 0,
                    src: "cow_1",
                    killScore: 150,
                    health: 500,
                    weightM: 0.8,
                    speed: 0.00095,
                    turnSpeed: 0.001,
                    scale: 72,
                    drop: ["food", 50]
                }, {
                    id: 1,
                    src: "pig_1",
                    killScore: 200,
                    health: 800,
                    weightM: 0.6,
                    speed: 0.00085,
                    turnSpeed: 0.001,
                    scale: 72,
                    drop: ["food", 80]
                }, {
                    id: 2,
                    name: "Bull",
                    src: "bull_2",
                    hostile: true,
                    dmg: 20,
                    killScore: 1000,
                    health: 1800,
                    weightM: 0.5,
                    speed: 0.00094,
                    turnSpeed: 0.00074,
                    scale: 78,
                    viewRange: 800,
                    chargePlayer: true,
                    drop: ["food", 100]
                }, {
                    id: 3,
                    name: "Bully",
                    src: "bull_1",
                    hostile: true,
                    dmg: 20,
                    killScore: 2000,
                    health: 2800,
                    weightM: 0.45,
                    speed: 0.001,
                    turnSpeed: 0.0008,
                    scale: 90,
                    viewRange: 900,
                    chargePlayer: true,
                    drop: ["food", 400]
                }, {
                    id: 4,
                    name: "Wolf",
                    src: "wolf_1",
                    hostile: true,
                    dmg: 8,
                    killScore: 500,
                    health: 300,
                    weightM: 0.45,
                    speed: 0.001,
                    turnSpeed: 0.002,
                    scale: 84,
                    viewRange: 800,
                    chargePlayer: true,
                    drop: ["food", 200]
                }, {
                    id: 5,
                    name: "Quack",
                    src: "chicken_1",
                    dmg: 8,
                    killScore: 2000,
                    noTrap: true,
                    health: 300,
                    weightM: 0.2,
                    speed: 0.0018,
                    turnSpeed: 0.006,
                    scale: 70,
                    drop: ["food", 100]
                }, {
                    id: 6,
                    name: "MOOSTAFA",
                    nameScale: 50,
                    src: "enemy",
                    hostile: true,
                    dontRun: true,
                    fixedSpawn: true,
                    spawnDelay: 60000,
                    noTrap: true,
                    colDmg: 100,
                    dmg: 40,
                    killScore: 8000,
                    health: 18000,
                    weightM: 0.4,
                    speed: 0.0007,
                    turnSpeed: 0.01,
                    scale: 80,
                    spriteMlt: 1.8,
                    leapForce: 0.9,
                    viewRange: 1000,
                    hitRange: 210,
                    hitDelay: 1000,
                    chargePlayer: true,
                    drop: ["food", 100]
                }, {
                    id: 7,
                    name: "Treasure",
                    hostile: true,
                    nameScale: 35,
                    src: "crate_1",
                    fixedSpawn: true,
                    spawnDelay: 120000,
                    colDmg: 200,
                    killScore: 5000,
                    health: 20000,
                    weightM: 0.1,
                    speed: 0.0,
                    turnSpeed: 0.0,
                    scale: 70,
                    spriteMlt: 1.0
                }, {
                    id: 8,
                    name: "MOOFIE",
                    src: "wolf_2",
                    hostile: true,
                    fixedSpawn: true,
                    dontRun: true,
                    hitScare: 4,
                    spawnDelay: 30000,
                    noTrap: true,
                    nameScale: 35,
                    dmg: 10,
                    colDmg: 100,
                    killScore: 3000,
                    health: 7000,
                    weightM: 0.45,
                    speed: 0.0015,
                    turnSpeed: 0.002,
                    scale: 90,
                    viewRange: 800,
                    chargePlayer: true,
                    drop: ["food", 1000]
                }, {
                    id: 9,
                    name: "💀MOOFIE",
                    src: "wolf_2",
                    hostile: true,
                    fixedSpawn: true,
                    dontRun: true,
                    hitScare: 50,
                    spawnDelay: 60000,
                    noTrap: true,
                    nameScale: 35,
                    dmg: 12,
                    colDmg: 100,
                    killScore: 3000,
                    health: 9000,
                    weightM: 0.45,
                    speed: 0.0015,
                    turnSpeed: 0.0025,
                    scale: 94,
                    viewRange: 1440,
                    chargePlayer: true,
                    drop: ["food", 3000]
                }, {
                    id: 10,
                    name: "💀Wolf",
                    src: "wolf_1",
                    hostile: true,
                    fixedSpawn: true,
                    dontRun: true,
                    hitScare: 50,
                    spawnDelay: 30000,
                    nameScale: 35,
                    dmg: 10,
                    killScore: 700,
                    health: 500,
                    weightM: 0.45,
                    speed: 0.00115,
                    turnSpeed: 0.0025,
                    scale: 88,
                    viewRange: 1440,
                    chargePlayer: true,
                    drop: ["food", 400]
                }, {
                    id: 11,
                    name: "💀Bully",
                    src: "bull_1",
                    hostile: true,
                    fixedSpawn: true,
                    dontRun: true,
                    hitScare: 50,
                    spawnDelay: 100000,
                    nameScale: 35,
                    dmg: 20,
                    killScore: 5000,
                    health: 5000,
                    weightM: 0.45,
                    speed: 0.0015,
                    turnSpeed: 0.0025,
                    scale: 94,
                    viewRange: 1440,
                    chargePlayer: true,
                    drop: ["food", 800]
                }];

                // SPAWN AI:
                this.spawn = function (x, y, dir, index) {
                    let tmpObj = ais.find((tmp) => !tmp.active);
                    if (!tmpObj) {
                        tmpObj = new AI(ais.length, objectManager, players, items, UTILS, config, scoreCallback, server);
                        ais.push(tmpObj);
                    }
                    tmpObj.init(x, y, dir, index, this.aiTypes[index]);
                    return tmpObj;
                };
            }

        };
        class AI {
            constructor(sid, objectManager, players, items, UTILS, config, scoreCallback, server) {
                this.sid = sid;
                this.isAI = true;
                this.nameIndex = UTILS.randInt(0, config.cowNames.length - 1);

                // INIT:
                this.init = function (x, y, dir, index, data) {
                    this.x = x;
                    this.y = y;
                    this.startX = data.fixedSpawn ? x : null;
                    this.startY = data.fixedSpawn ? y : null;
                    this.xVel = 0;
                    this.yVel = 0;
                    this.zIndex = 0;
                    this.dir = dir;
                    this.dirPlus = 0;
                    this.index = index;
                    this.src = data.src;
                    if (data.name) this.name = data.name;
                    this.weightM = data.weightM;
                    this.speed = data.speed;
                    this.killScore = data.killScore;
                    this.turnSpeed = data.turnSpeed;
                    this.scale = data.scale;
                    this.maxHealth = data.health;
                    this.leapForce = data.leapForce;
                    this.health = this.maxHealth;
                    this.chargePlayer = data.chargePlayer;
                    this.viewRange = data.viewRange;
                    this.drop = data.drop;
                    this.dmg = data.dmg;
                    this.hostile = data.hostile;
                    this.dontRun = data.dontRun;
                    this.hitRange = data.hitRange;
                    this.hitDelay = data.hitDelay;
                    this.hitScare = data.hitScare;
                    this.spriteMlt = data.spriteMlt;
                    this.nameScale = data.nameScale;
                    this.colDmg = data.colDmg;
                    this.noTrap = data.noTrap;
                    this.spawnDelay = data.spawnDelay;
                    this.hitWait = 0;
                    this.waitCount = 1000;
                    this.moveCount = 0;
                    this.targetDir = 0;
                    this.active = true;
                    this.alive = true;
                    this.runFrom = null;
                    this.chargeTarget = null;
                    this.dmgOverTime = {};
                };

                let tmpRatio = 0;
                let animIndex = 0;
                this.animate = function (delta) {
                    if (this.animTime > 0) {
                        this.animTime -= delta;
                        if (this.animTime <= 0) {
                            this.animTime = 0;
                            this.dirPlus = 0;
                            tmpRatio = 0;
                            animIndex = 0;
                        } else {
                            if (animIndex == 0) {
                                tmpRatio += delta / (this.animSpeed * config.hitReturnRatio);
                                this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.min(1, tmpRatio));
                                if (tmpRatio >= 1) {
                                    tmpRatio = 1;
                                    animIndex = 1;
                                }
                            } else {
                                tmpRatio -= delta / (this.animSpeed * (1 - config.hitReturnRatio));
                                this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.max(0, tmpRatio));
                            }
                        }
                    }
                };

                // ANIMATION:
                this.startAnim = function () {
                    this.animTime = this.animSpeed = 600;
                    this.targetAngle = Math.PI * 0.8;
                    tmpRatio = 0;
                    animIndex = 0;
                };

            };

        };
        class Petal {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.damage = 10;
                this.health = 10;
                this.maxHealth = this.health;
                this.active = false;
                this.alive = false;
                this.timer = 1500;
                this.time = 0;
                this.damaged = 0;
                this.alpha = 1;
                this.scale = 9;
                this.visScale = this.scale;
            }
        };
        class addCh {
            constructor(x, y, chat, tmpObj) {
                this.x = x;
                this.y = y;
                this.alpha = 0;
                this.active = true;
                this.alive = false;
                this.chat = chat;
                this.owner = tmpObj;
            };
        };
        class DeadPlayer {
            constructor(x, y, dir, buildIndex, weaponIndex, weaponVariant, skinColor, scale, name) {
                this.x = x;
                this.y = y;
                this.lastDir = dir;
                this.dir = dir + Math.PI;
                this.buildIndex = buildIndex;
                this.weaponIndex = weaponIndex;
                this.weaponVariant = weaponVariant;
                this.skinColor = skinColor;
                this.scale = scale;
                this.visScale = 0;
                this.name = name;
                this.alpha = 1;
                this.active = true;
                this.animate = function(delta) {
                    let d2 = UTILS.getAngleDist(this.lastDir, this.dir);
                    if (d2 > 0.01) {
                        this.dir += d2 / 20;
                    } else {
                        this.dir = this.lastDir;
                    }
                    if (this.visScale < this.scale) {
                        this.visScale += delta / (this.scale / 2);
                        if (this.visScale >= this.scale) {
                            this.visScale = this.scale;
                        }
                    }
                    this.alpha -= delta / 30000;
                    if (this.alpha <= 0) {
                        this.alpha = 0;
                        this.active = false;
                    }
                }
            }
        };
        class Player {
            constructor(id, sid, config, UTILS, projectileManager, objectManager, players, ais, items, hats, accessories, server, scoreCallback, iconCallback) {
                this.id = id;
                this.sid = sid;
                this.tmpScore = 0;
                this.team = null;
                this.latestSkin = 0;
                this.oldSkinIndex = 0;
                this.prevHW;
                this.prevDW;
                this.skinIndex = 0;
                this.latestTail = 0;
                this.oldTailIndex = 0;
                this.tailIndex = 0;
                this.hitTime = 0;
                this.lastHit = 0;
                this.hitTick = 0;
                this.inWater = false;
                this.tails = {};
                this.antiTurretSpam = false;
                for (let i = 0; i < accessories.length; ++i) {
                    if (accessories[i].price <= 0)
                        this.tails[accessories[i].id] = 1;
                }
                this.skins = {};
                for (let i = 0; i < hats.length; ++i) {
                    if (hats[i].price <= 0)
                        this.skins[hats[i].id] = 1;
                }
                this.points = 0;
                this.dt = 0;
                this.hidden = false;
                this.itemCounts = {};
                this.isPlayer = true;
                this.pps = 0;
                this.moveDir = undefined;
                this.moveTime = 0;
                this.skinRot = 0;
                this.lastPing = 0;
                this.hitSpike = false;
                this.iconIndex = 0;
                this.skinColor = 0;
                this.dist2 = 0;
                this.aim2 = 0;
                this.maxSpeed = 1;
                this.chat = {
                    message: null,
                    count: 0
                };
                this.backupNobull = true;
                this.healSpeed = 0;

                // SPAWN:
                this.spawn = function (moofoll) {
                    this.attacked = false;
                    this.death = false;
                    this.spinDir = 0;
                    this.sync = false;
                    this.antiBull = 0;
                    //  this.bullTimer = 0;
                    this.poisonCounter = 0;
                    this.active = true;
                    this.alive = true;
                    this.lockMove = false;
                    this.lockDir = false;
                    this.minimapCounter = 0;
                    this.chatCountdown = 0;
                    this.shameCount = 0;
                    this.shameTimer = 0;
                    this.sentTo = {};
                    this.gathering = 0;
                    this.gatherIndex = 0;
                    this.lastGather = 0;
                    this.shooting = {};
                    this.shootIndex = 9;
                    this.autoGather = 0;
                    this.animTime = 0;
                    this.animSpeed = 0;
                    this.mouseState = 0;
                    this.buildIndex = -1;
                    this.weaponIndex = 0;
                    this.weaponCode = 0;
                    this.weaponVariant = 0;
                    this.primaryIndex = undefined;
                    this.secondaryIndex = undefined;
                    this.dmgOverTime = {};
                    this.noMovTimer = 0;
                    this.maxXP = 300;
                    this.XP = 0;
                    this.age = 1;
                    this.kills = 0;
                    this.upgrAge = 2;
                    this.upgradePoints = 0;
                    this.x = 0;
                    this.y = 0;
                    this.oldXY = {
                        x: 0,
                        y: 0
                    };
                    this.zIndex = 0;
                    this.xVel = 0;
                    this.yVel = 0;
                    this.slowMult = 1;
                    this.dir = 0;
                    this.dirPlus = 0;
                    this.targetDir = 0;
                    this.targetAngle = 0;
                    this.maxHealth = 100;
                    this.health = this.maxHealth;
                    this.oldHealth = this.maxHealth;
                    this.damaged = 0;
                    this.scale = config.playerScale;
                    this.speed = config.playerSpeed;
                    this.resetMoveDir();
                    this.resetResources(moofoll);
                    this.items = [0, 3, 6, 10];
                    this.weapons = [0];
                    this.shootCount = 0;
                    this.weaponXP = [];
                    this.reloads = {
                        0: 0,
                        1: 0,
                        2: 0,
                        3: 0,
                        4: 0,
                        5: 0,
                        6: 0,
                        7: 0,
                        8: 0,
                        9: 0,
                        10: 0,
                        11: 0,
                        12: 0,
                        13: 0,
                        14: 0,
                        15: 0,
                        53: 0,
                    };
                    this.bowThreat = {
                        9: 0,
                        12: 0,
                        13: 0,
                        15: 0,
                    };
                    this.damageThreat = 0;
                    this.mostDamageThreat = 0;
                    this.inTrap = false;
                    this.lastTrap = false;
                    this.escaped = false;
                    this.canEmpAnti = false;
                    this.empAnti = false;
                    this.soldierAnti = false;
                    this.bullTick = 0;
                    this.needTick = 0;
                    this.antiTimer = 2;
                };

                // RESET MOVE DIR:
                this.resetMoveDir = function () {
                    this.moveDir = undefined;
                };

                // RESET RESOURCES:
                this.resetResources = function (moofoll) {
                    for (let i = 0; i < config.resourceTypes.length; ++i) {
                        this[config.resourceTypes[i]] = moofoll ? 100 : 0;
                    }
                };

                // ADD ITEM:
                this.getItemType = function(id) {
                    let findindx = this.items.findIndex((ids) => ids == id);
                    if (findindx != -1) {
                        return findindx;
                    } else {
                        return items.checkItem.index(id, this.items);
                    }
                };

                // SET DATA:
                this.setData = function (data) {
                    this.id = data[0];
                    this.sid = data[1];
                    this.name = data[2];
                    this.x = data[3];
                    this.y = data[4];
                    this.dir = data[5];
                    this.health = data[6];
                    this.maxHealth = data[7];
                    this.scale = data[8];
                    this.skinColor = data[9];
                };
                this.update = function(delta) {
                    if (this.active) {

                        // MOVE:
                        let gear = {
                            skin: findID(hats, this.skinIndex),
                            tail: findID(accessories, this.tailIndex)
                        }
                        let spdMult = ((this.buildIndex >= 0) ? 0.5 : 1) * (items.weapons[this.weaponIndex].spdMult || 1) * (gear.skin ? (gear.skin.spdMult || 1) : 1) * (gear.tail ? (gear.tail.spdMult || 1) : 1) * (this.y <= config.snowBiomeTop ? ((gear.skin && gear.skin.coldM) ? 1 : config.snowSpeed) : 1) * this.slowMult;
                        this.maxSpeed = spdMult;

                    }
                };

                let tmpRatio = 0;
                let animIndex = 0;
                this.animate = function(delta) {
                    if (this.animTime > 0) {
                        this.animTime -= delta;
                        if (this.animTime <= 0) {
                            this.animTime = 0;
                            this.dirPlus = 0;
                            tmpRatio = 0;
                            animIndex = 0;
                        } else {
                            if (animIndex == 0) {
                                tmpRatio += delta / (this.animSpeed * config.hitReturnRatio);
                                this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.min(1, tmpRatio));
                                if (tmpRatio >= 1) {
                                    tmpRatio = 1;
                                    animIndex = 1;
                                }
                            } else {
                                tmpRatio -= delta / (this.animSpeed * (1-config.hitReturnRatio));
                                this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.max(0, tmpRatio));
                            }
                        }
                    }
                };

                // GATHER ANIMATION:
                this.startAnim = function (didHit, index) {
                    this.animTime = this.animSpeed = items.weapons[index].speed;
                    this.targetAngle = (didHit ? -config.hitAngle : -Math.PI);
                    tmpRatio = 0;
                    animIndex = 0;
                };

                // CAN SEE:
                this.canSee = function(other) {
                    if (!other) return false;
                    let dx = Math.abs(other.x - this.x) - other.scale;
                    let dy = Math.abs(other.y - this.y) - other.scale;
                    return dx <= (config.maxScreenWidth / 2) * 1.3 && dy <= (config.maxScreenHeight / 2) * 1.3;
                };

                // SHAME SYSTEM:
                this.judgeShame = function() {
                    if (this.oldHealth < this.health) {
                        if (this.hitTime) {
                            let timeSinceHit = Date.now() - this.hitTime;
                            this.hitTime = 0;
                            if (timeSinceHit < 120) {
                                this.shameCount++;
                            } else {
                                this.shameCount = Math.max(0, this.shameCount - 2);
                            }
                        }
                    } else if (this.oldHealth > this.health) {
                        this.hitTime = Date.now();
                        this.lastHit = Date.now();
                        this.hitTick = game.tick;
                    }
                };
                this.addShameTimer = function () {
                    this.shameCount = 0;
                    this.shameTimer = 30;
                    let interval = setInterval(() => {
                        this.shameTimer--;
                        if (this.shameTimer <= 0) {
                            clearInterval(interval);
                        }
                    }, 1000);
                };

                // CHECK TEAM:
                this.isTeam = function (tmpObj) {
                    return (this == tmpObj || (this.team && this.team == tmpObj.team));
                };

                // FOR THE PLAYER:
                this.findAllianceBySid = function (sid) {
                    return this.team ? alliancePlayers.find((THIS) => THIS === sid) : null;
                };
                this.checkCanInsta = function (nobull) {
                    let totally = 0;
                    if (this.alive && inGame) {
                        let primary = {
                            weapon: this.weapons[0],
                            variant: this.primaryVariant,
                            dmg: this.weapons[0] == undefined ? 0 : items.weapons[this.weapons[0]].dmg,
                        };
                        let secondary = {
                            weapon: this.weapons[1],
                            variant: this.secondaryVariant,
                            dmg: this.weapons[1] == undefined ? 0 : items.weapons[this.weapons[1]].Pdmg,
                        };
                        let bull = this.skins[7] && !nobull ? 1.5 : 1;
                        let pV = primary.variant != undefined ? config.weaponVariants[primary.variant].val : 1;
                        if (primary.weapon != undefined && this.reloads[primary.weapon] == 0) {
                            totally += primary.dmg * pV * bull;
                        }
                        if (secondary.weapon != undefined && this.reloads[secondary.weapon] == 0) {
                            totally += secondary.dmg;
                        }
                        if (this.skins[53] && this.reloads[53] <= (player.weapons[1] == 10 ? 0 : game.tickRate) && near.skinIndex != 22) {
                            totally += 25;
                        }
                        totally *= near.skinIndex == 6 ? 0.75 : 1;
                        return totally;
                    }
                    return 0;
                };

                // UPDATE WEAPON RELOAD:
                this.manageReload = function () {
                    if (this.shooting[53]) {
                        this.shooting[53] = 0;
                        this.reloads[53] = (2500 - game.tickRate);
                    } else {
                        if (this.reloads[53] > 0) {
                            this.reloads[53] = Math.max(0, this.reloads[53] - game.tickRate);
                        }
                    }
                    if (this.gathering || this.shooting[1]) {
                        if (this.gathering) {
                            this.gathering = 0;
                            this.reloads[this.gatherIndex] = (items.weapons[this.gatherIndex].speed * (this.skinIndex == 20 ? 0.78 : 1));
                            this.attacked = true;
                        }
                        if (this.shooting[1]) {
                            this.shooting[1] = 0;
                            this.reloads[this.shootIndex] = (items.weapons[this.shootIndex].speed * (this.skinIndex == 20 ? 0.78 : 1));
                            this.attacked = true;
                        }
                    } else {
                        this.attacked = false;
                        if (this.buildIndex < 0) {
                            if (this.reloads[this.weaponIndex] > 0) {
                                this.reloads[this.weaponIndex] = Math.max(0, this.reloads[this.weaponIndex] - game.tickRate);
                                if (this.reloads[this.primaryIndex] == 0 && this.reloads[this.weaponIndex] == 0) {
                                    this.antiBull++;
                                    game.tickBase(() => {
                                        this.antiBull = 0;
                                    }, 1);
                                }
                            }
                        }
                    }
                };

                // FOR ANTI INSTA:
                this.addDamageThreat = function() {
                    let damageThreat = 0;
                    nears.forEach((tmpObj) => {
                        let primary = {
                            weapon: tmpObj.primaryIndex,
                            variant: tmpObj.primaryVariant,
                            dmg: 0
                        }
                        let secondary = {
                            weapon: tmpObj.secondaryIndex,
                            variant: tmpObj.secondaryVariant,
                            dmg: 0
                        };
                        primary.dmg = primary.weapon == undefined ? 45 : items.weapons[primary.weapon].dmg;
                        secondary.dmg = secondary.weapon == undefined ? 50 : items.weapons[secondary.weapon].Pdmg;
                        let pV = primary.variant != undefined ? config.weaponVariants[primary.variant].val : 1.18;
                        let sV = secondary.variant != undefined ? [9, 12, 13, 15].includes(secondary.weapon) ? 1 : config.weaponVariants[secondary.variant].val : 1.18;
                        if (primary.weapon == undefined || tmpObj.reloads[primary.weapon] == 0) {
                            primary.dmg = primary.dmg * pV * 1.5;
                        } else {
                            primary.dmg = 0;
                        }
                        if (secondary.weapon == undefined || tmpObj.reloads[secondary.weapon] == 0) {
                            secondary.dmg = secondary.dmg * sV;
                        } else {
                            secondary.dmg = 0;
                        }
                        if (tmpObj.reloads[53] == 0) {
                            secondary.dmg += 25;
                        }
                        damageThreat += Math.max(primary.dmg, secondary.dmg);
                        if (player.poisonCounter > 0) {
                            damageThreat += 5;
                        }
                        if (projectile.count) {
                            damageThreat += projectile.dmg
                            player.chat.message = "projectile dmg: " + projectile.dmg;
                            player.chat.count = 500;
                        }
                        if (my.predictSpikes > 0 && tmpObj.secondaryIndex == 10) {
                            let spikeDamage = 45 * my.predictSpikes;
                            damageThreat += spikeDamage;
                            my.predictSpikes = 0;
                        }
                    });
                    if (my.predictSpikes > 0) damageThreat += 35 * my.predictSpikes;
                    my.predictSpikes = 0;
                    this.mostDamageThreat = damageThreat;
                    damageThreat *= (this.skinIndex == 6 && !instaC.isTrue) ? 0.75 : 1;
                    this.damageThreat = damageThreat;
                };
            }
        };

        // SOME CODES:
        function sendUpgrade(index) {
            player.reloads[index] = 0;
            packet("H", index);
        }

        function storeEquip(id, index) {
            packet("c", 0, id, index);
        }

        function storeBuy(id, index) {
            packet("c", 1, id, index);
        }

        let lastChangeTime = 0;
        let sentHat = 0;
        function buyEquip(id, index) {
            let nID = player.skins[6] ? 6 : 0;
            if (player.alive && inGame) {
                if (index == 0) {
                    if (id == 6) {
                        if (Date.now() - lastChangeTime > game.tickRate) {
                            sentHat = id;
                            lastChangeTime = Date.now();
                        }
                    } else {
                        sentHat = id
                        lastChangeTime = Date.now();
                    }
                    if (player.skins[id]) {
                        if (player.latestSkin != id) {
                            packet("c", 0, id, 0);
                        }
                    } else {
                        if (player.latestSkin != nID) {
                            packet("c", 0, nID, 0);
                        }
                    }
                } else if (index == 1) {
                    if (useWasd && (id != 11 && id != 0)) {
                        if (player.latestTail != 0) {
                            packet("c", 0, 0, 1);
                        }
                        return;
                    }
                    if (player.tails[id]) {
                        if (player.latestTail != id) {
                            packet("c", 0, id, 1);
                        }
                    } else {
                        if (player.latestTail != 0) {
                            packet("c", 0, 0, 1);
                        }
                    }
                }
            }
        }
        function selectToBuild(index, wpn) {
            packet("z", index, wpn);
        }
        function selectWeapon(index, isPlace) {
            if (!isPlace) {
                player.weaponCode = index;
            }
            packet("z", index, 1);
        }
        let isThrottled = false; // Flag to track if the function is throttled
        let autoGathering = false;

        function sendAutoGather(debug) {
            if (isThrottled) {
                return; // If throttled, exit and don't execute
            }

            // Set the throttle flag
            isThrottled = true;

            // Function logic
            if (debug) {
                packet("K", 1, 1);
            } else {
                autoGathering = !autoGathering;
                packet("K", 1, 1);
            }

            // Set a timeout to clear the throttle flag after 69ms
            setTimeout(() => {
                isThrottled = false;
            }, 69);
        }
        function sendAtck(id, angle) {
            packet("F", id, angle, 1);
        }
        //test menu temporary menu
            const menu = document.createElement('div');
    menu.id = 'tm-menu';
    menu.style.cssText = `
        position: fixed; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        background: #333; color: white;
        padding: 20px; border-radius: 12px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        display: none; z-index: 9999;
    `;

    // Add inputs and buttons
    menu.innerHTML = `
        <input type="text" id="testInput1" id="input1" style="display: block; margin: 10px 0; padding: 8px; width: 200px;">
        <input type="text" id="testInput2" id="input2" style="display: block; margin: 10px 0; padding: 8px; width: 200px;">
        <input type="text" id="testInput3" id="input2" style="display: block; margin: 10px 0; padding: 8px; width: 200px;">
        <input type="checkbox" id="button1">1</input>
        <input type="checkbox" id="button2">2</input>
    `;
    document.body.appendChild(menu);

    // Toggle menu visibility on "\" key
    document.addEventListener('keydown', (e) => {
        if (e.key === '\\') {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    });


        function place(id, rad, rmd, spikeTickkk) {
            try {
                if (id == undefined) return;
                let item = items.list[player.items[id]];
                let tmpS = player.scale + item.scale + (item.placeOffset || 0);
                let tmpX = player.x2 + tmpS * Math.cos(rad);
                let tmpY = player.y2 + tmpS * Math.sin(rad);
                if (id === 0 || testMode || (player.alive && inGame && player.itemCounts[item.group.id] == undefined ? true : player.itemCounts[item.group.id] < (config.isSandbox ? id === 3 || id === 5 ? 299 : 99 : item.group.limit ? item.group.limit : 99))) {
                    selectToBuild(player.items[id]);
                    sendAtck(1, rad);
                    selectWeapon(player.weaponCode, 1);
                    if (spikeTickkk && isC("spikeTick").checked && id == 2 && UTILS.getDist(near, {x: tmpX, y: tmpY}, 2, 0) <= 85) {
                        instaC.canSpikeTick = true;
                    }
                    if (isC("placeVis").checked) {
 placeVisible.push({
                    x: tmpX,
                    y: tmpY,
                    name: item.name,
                    scale: item.scale,
                    dir: rad,
                });
                game.tickBase(() => {
                    placeVisible.shift();
                }, 1);
            }
        }
    } catch(e) {}
}

        function spikeTickPlace(id, rad) {
            checkPlace(id, rad, 1)
        }

        function checkPlace(id, rad, spikeTick) {
            try {
                if (id == undefined) return;
                let item = items.list[player.items[id]];
                let tmpS = player.scale + item.scale + (item.placeOffset || 0);
                let tmpX = player.x2 + tmpS * Math.cos(rad);
                let tmpY = player.y2 + tmpS * Math.sin(rad);
                if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false)) {
                    place(id, rad, 0, spikeTick);
                }
            } catch (e) {}
        }

        // HEALING:
        function soldierMult() {
            return player.latestSkin == 6 ? 0.75 : 1;
        }

        function healthBased() {
            if (player.health == 100) return 0;
            if ((player.skinIndex != 45 && player.skinIndex != 56)) {
                return Math.ceil((100 - player.health) / items.list[player.items[0]].healing);
            }
            return 0;
        }

        function getAttacker(damaged) {
            let poisonHit = [];
            let attacker = nears.filter(tmp => {
                if (tmp.attacked) {
                    let index = tmp.weaponIndex
                    let dmg = index > 8 ? items.weapons[index].Pdmg : items.weapons[index].dmg;
                    let variant = tmp[(index < 9 ? "prima" : "seconda") + "ryVariant"]
                    dmg *= (player.skinIndex == 6 ? 0.75 : 1) * (tmp.skinIndex == 7 ? 1.5 : 1) * (tmp.tailIndex == 11 ? 0.2 : 1) * (config.weaponVariants[variant].val);
                    if (damaged == dmg) {
                        poisonHit.push(variant == 3 || tmp.skinIndex == 21);
                        return true
                    }
                }
                return false;
            });
            let poisonCount = poisonHit.filter(Boolean).length;
            if (poisonHit.length > 0 && poisonCount == poisonHit.length) {
                player.poisonCounter = 5;
            }
            return attacker;
        }

        function healer(extra = 0) {
            for (let i = 0; i < healthBased(); i++) {
                place(0, getAttackDir());
            }
            for (let i = 0; i < extra; i++) {
                place(0, getAttackDir());
            }
        }

        function predictHeal(howManyCookieToEat) {
            for (let i = 0; i < howManyCookieToEat; i++) {
                place(0, getAttackDir());
            }
        }

        function antiSyncHealing(timearg) {
            my.antiSync = true;
            let healAnti = setInterval(() => {
                if (player.shameCount < 5) {
                    place(0, getAttackDir());
                }
            }, 75);
            setTimeout(() => {
                clearInterval(healAnti);
                setTimeout(() => {
                    my.antiSync = false;
                }, game.tickRate);
            }, game.tickRate);
        }
        let loopHats = [28, 29, 30, 36, 37, 38, 44];
        let aCounter = 0;

        function biomeGear(mover, returns) {
            if (player.inWater) {
                if (returns) return 31;
                buyEquip(31, 0);
            } else {
                if (!isC("hatType").checked || isC("hatType").options.value == "ag") {
                    if (player.y2 <= config.snowBiomeTop) {
                        if (returns) return mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : 15;
                        buyEquip(mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : 15, 0);
                    } else {
                        if (returns) return mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : 12;
                        buyEquip(mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : 12, 0);
                    }
                } else {
                    if (isC("hatType").options.value == "bg") {
                        if (returns) return 10;
                        buyEquip(10, 0)
                    } else if (isC("hatType").options.value == "loop") {
                        aCounter = (aCounter >= loopHats.length - 1 ? 0 : aCounter + 1);
                        if (player.y2 <= config.snowBiomeTop) {
                            if (returns) return mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : loopHats[aCounter];
                            buyEquip(mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : loopHats[aCounter], 0);
                        } else {
                            if (returns) return mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : loopHats[aCounter];
                            buyEquip(mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : loopHats[aCounter], 0);
                        }
                    }
                }
            }
            if (returns) return 0;
        }

        function woah(mover) {
            buyEquip(mover && player.moveDir == undefined ? 0 : 11, 1);
        }

        const findPlacementAngle = (id, build, trap) => {
            if (!build) return null;
            const MAX_OFFSET = Math.PI / 2;
            const ANGLE_STEP = Math.PI / 50;
            const item = items.list[player.items[id]];
            let tmpS = player.scale + item.scale + (item.placeOffset || 0);
            let safeAngles = [];
            let buildingAngle = UTILS.getDirect(build, player, 0, 2);
            if (trap) {
                if (build.sid != trap.sid) {
                    closestPossibleAngles(trap, 2);
                } else if (id == 4) {
                    let trapAngle = UTILS.getDirect(trap, player, 0, 2);
                    let spike = nearObjs
                    .filter(obj => obj.active && obj.dmg && obj.isTeamObject(player) && UTILS.getDist(obj, trap, 0, 0) <= trap.scale + obj.scale + 69)
                    .sort((a, b) => UTILS.getDist(a, trap, 0, 0) - UTILS.getDist(b, trap, 0, 0))[0];

                    if (spike) {
                        let closestAngle = null;
                        let closestDistance = Infinity;

                        for (let offset = 0; offset <= MAX_OFFSET; offset += ANGLE_STEP) {
                            let angles = [(trapAngle + offset) % (2 * Math.PI), (trapAngle - offset + 2 * Math.PI) % (2 * Math.PI)];
                            for (let angle of angles) {
                                let tmpX = player.x2 + tmpS * Math.cos(angle);
                                let tmpY = player.y2 + tmpS * Math.sin(angle);
                                if (objectManager.preplaceCheck(tmpX, tmpY, item.scale, 0.6, item.id, false, build)) {

                                    // Distance to enemy (near)
                                    let distanceToNear = UTILS.getDistance(tmpX, tmpY, near.x2, near.y2);
                                    // Distance to spike
                                    let distanceToSpike = UTILS.getDistance(tmpX, tmpY, spike.x, spike.y);

                                    // Ensure item is close enough to enemy and nearer to spike
                                    if (distanceToNear <= 30 && distanceToSpike < closestDistance) {
                                        closestDistance = distanceToSpike;
                                        closestAngle = angle;
                                    }
                                }
                            }
                        }

                        if (closestAngle !== null) {
                            return closestAngle;
                        }
                    }
                }
            }
            for (let offset = 0; offset <= MAX_OFFSET; offset += ANGLE_STEP) {
                let angles = [(buildingAngle + offset) % (2 * Math.PI), (buildingAngle - offset + 2 * Math.PI) % (2 * Math.PI)];
                for (let angle of angles) {
                    let tmpX = player.x2 + tmpS * Math.cos(angle);
                    let tmpY = player.y2 + tmpS * Math.sin(angle);
                    if (objectManager.preplaceCheck(tmpX, tmpY, item.scale, 0.6, item.id, false, build)) {
                        return angle;
                    }
                }
            }
            return null;
        };
        const preplacer = () => {
            if (near.dist2 > 269 || !isC("autoPrePlace").checked) return;
            const replaceable = [];
            for (let i of gameObjects) {
                if (!i.isItem || !i.active || UTILS.getDist(i, player, 0, 2) > 200 || (i.isTeamObject(player) && i.hideFromEnemy)) continue;
                if (objectManager.canBeBroken(i)) {
                    replaceable.push(i);
                }
            }
            let twoHolyObjects = replaceable.sort((a, b) => UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2)).slice(0, Math.min(2, replaceable.length));
            let nearTrap = near.inTrap;
            twoHolyObjects.forEach((build) => {
                let buildId = nearTrap && !my.autoPush && (isC("autoPrePlace").options.value == "spike" ? true : build.sid != nearTrap.sid) ? 2 : 4;
                let angle = findPlacementAngle(buildId, build, nearTrap);
                if (angle !== null) {
                    place(buildId, angle, 1);
                    /*if (secPacket < 25) place(buildId, angle, 1);
                    setTimeout(() => {
                        place(buildId, angle, 1);
                        setTimeout(() => {
                            if (secPacket < 50) place(buildId, angle, 1);
                        }, 1)
                    }, 1);*/
                }
            });
        };

        /* let triedObj = [];
        setInterval(() => {
            if (config.isSandbox && inGame) {
                if (configs.autoPrePlace && !instaC.instaTrue && near.dist2 <= 300 && !getEl("weaponGrind").checked) {
                    triedObj = [];
                    PrePlacer(player);
                    for (let i = 0; i < enemy.length; i++) {
                        let iii = enemy[i];
                        if (iii && iii.reloads[iii.weaponIndex] <= 1500 / 9) {
                            PrePlacer(iii);
                        }
                    }
                }
            }
        }, 65); //speed

        function PrePlacer(tmpObj) {
            let Delay = Math.max(0, 111 - window.pingTime);
            let index = tmpObj.weaponIndex;
            let val = items.weapons[index].dmg * (config.weaponVariants[tmpObj[(index < 9 ? "prima" : "seconda") + "ryVariant"]].val) * (items.weapons[index].sDmg || 1) * (3.3);;
            let nearObjs = gameObjects.filter(tmp => tmp.active && tmp.health < val && (UTILS.getDist(tmp, tmpObj, 0, 2) <= (items.weapons[tmpObj.weaponIndex].range + 100)) && (UTILS.getDist(tmp, near, 0, 2) <= (config.playerScale + tmp.scale * 2 + 20)));
            if (nearObjs.length) {
                let FindTrap = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= (near.scale + tmp.getScale() + 5)).sort(function(a, b) {
                    return UTILS.getDist(a, near, 0, 5) - UTILS.getDist(b, near, 0, 5);
                })[0];
                let FindSpike = gameObjects.find(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= (near.scale + tmp.getScale() + 70));
                setTimeout(() => {
                    nearObjs.forEach((e) => {
                        if (UTILS.getDist(e, player, 0, 2) <= (e.scale*2 + player.scale + 20) && !triedObj.includes(e.sid)) {
                            let objAim = UTILS.getDirect(e, player, 0, 2);
                            if (enemy.length && FindTrap && FindSpike) {
                                isItemSetted[22].innerHTML != 99 && prePlace(4, objAim, e);
                            } else {
                                isItemSetted[22].innerHTML != 99 && prePlace(2, objAim, e);
                            }
                            triedObj.push(e.sid);
                        }
                    });
                }, Delay);
            }
        }

        function prePlace(id, rad, obj) {
            try {
                if (id == undefined) return;
                let item = items.list[player.items[id]];
                let tmpS = player.scale + item.scale + (item.placeOffset || 0);
                let tmpX = player.x2 + tmpS * Math.cos(rad);
                let tmpY = player.y2 + tmpS * Math.sin(rad);
                if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false, player, obj)) { //skip this obj
                    place(id, rad);
                    addMark(tmpX, tmpY, item, rad, true);
                } else {
                    for (let i = -1; i <= 1; i += 1/10) {
                        let tmpX = player.x2 + tmpS * Math.cos(rad+i);
                        let tmpY = player.y2 + tmpS * Math.sin(rad+i);
                        if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false, player, obj /*Skip this Obj)) { //skip this obj
                            place(id, rad+i);
                            addMark(tmpX, tmpY, item, rad+i, true);
                            break;
                        }
                    }
                }
            } catch (e) {}
        }

        function addMark(tmpX, tmpY, item, rad, preplc) {
            placeVisible.push({
                x: tmpX,
                y: tmpY,
                name: item.name,
                scale: item.scale,
                dir: rad,
                preplc: preplc
            });
            game.tickBase(() => {
                placeVisible.shift();
            }, 1)
        }*/

        let advHeal = [];
        class AnimPlayer {
            constructor() {
            }
        }
        class Traps {
            constructor(UTILS, items) {
                this.replaced = true;
                this.antiTrapped = false;
                this.info = {};
                this.replaceSids = [];
                this.radObjs = [];
                this.preplaces = [[], []];
                this.nest = {
                    rad: 0,
                    x: 0,
                    y: 0
                };
                this.testCanPlace = function (id, first = -(Math.PI / 2), repeat = (Math.PI / 2), plus = (Math.PI / 18), radian, special, yaboi) {
                    try {
                        let item = items.list[player.items[id]];
                        let tmpS = player.scale + item.scale + (item.placeOffset || 0);
                        let counts = {
                            attempts: 0,
                            placed: 0,
                        };
                        let tmpObjects = [];
                        nearObjs.forEach((p) => {
                            tmpObjects.push({
                                x: p.x,
                                y: p.y,
                                active: p.active,
                                blocker: p.blocker,
                                scale: p.scale,
                                isItem: p.isItem,
                                type: p.type,
                                colDiv: p.colDiv,
                                getScale: function(sM, ig) {
                                    sM = sM||1;
                                    return this.scale * ((this.isItem||this.type==2||this.type==3||this.type==4)
                                                         ?1:(0.6*sM)) * (ig?1:this.colDiv);
                                },
                            });
                        });
                        for (let i = first; i < repeat; i += plus) {
                            counts.attempts++;
                            let relAim = radian + i;
                            let tmpX = player.x2 + tmpS * Math.cos(relAim);
                            let tmpY = player.y2 + tmpS * Math.sin(relAim);
                            let cantPlace = tmpObjects.find((tmp) => tmp.active && UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) < item.scale + (tmp.blocker ? tmp.blocker : tmp.getScale(0.6, tmp.isItem)));
                            if (cantPlace) continue;
                            if (item.id != 18 && tmpY >= config.mapScale / 2 - config.riverWidth / 2 && tmpY <= config.mapScale / 2 + config.riverWidth / 2) continue;
                            place(id, relAim);
                            if (yaboi) {
                                tmpObjects.push({
                                    x: tmpX,
                                    y: tmpY,
                                    active: true,
                                    blocker: item.blocker,
                                    scale: item.scale,
                                    isItem: true,
                                    type: null,
                                    colDiv: item.colDiv,
                                    getScale: function() {
                                        return this.scale;
                                    },
                                });
                            }
                            if (special == 1) {
                                this.preplaces[0].push({
                                    x: tmpX,
                                    y: tmpY,
                                    scale: item.scale,
                                });
                            }
                            if (UTILS.getAngleDist(near.aim2, relAim) <= 1) {
                                counts.placed++;
                            }
                            if (counts.placed > 0) {
                                if (special == 1 && item.dmg) {
                                    if (UTILS.getDist(near, {x: tmpX, y: tmpY}, 2, 0) <= 85 && isC("spikeTick").checked) {
                                        instaC.canSpikeTick = true;
                                    }
                                }
                                if (special == 2 && item.dmg && counts.placed >= 8) {
                                    packet("N")
                                }
                            }
                        }
                    } catch (err) {
                    }
                };
                this.createObj = function (item, direct) {
                    let preObj = {
                        id: item.id,
                        dir: direct,
                        scale: item.scale,
                    };

                    preObj.x = player.x2 + (player.scale + preObj.scale + (item.placeOffset || 0)) * Math.cos(preObj.dir);
                    preObj.y = player.y2 + (player.scale + preObj.scale + (item.placeOffset || 0)) * Math.sin(preObj.dir);
                    return preObj;
                }
                this.radCalc = function (obj, direct, item, type) {
                    let preObj = this.createObj(item, direct);
                    let getScale = obj.getScale(0.6, obj.isItem);

                    let dist = UTILS.getDist(obj, preObj, 0, 0);
                    let scale = getScale + preObj.scale;

                    let angles = [];
                    if (dist < scale) {
                        let calc = Math.acos(dist / scale);
                        let sum = [calc, -calc];

                        for (let i = 0; i < sum.length; i++) {
                            let angle = direct + sum[i];
                            preObj = this.createObj(item, angle);

                            let nears = this.preplaces[1].length ? this.preplaces[1].some(pos => UTILS.getDist(pos, preObj, 0, 0) < pos.scale + preObj.scale) : false;
                            if (nears) continue;

                            let renears = this.preplaces[0].length ? this.preplaces[0].some(pos => UTILS.getDist(pos, preObj, 0, 0) < pos.scale + preObj.scale) : false;
                            if (renears) continue;

                            let canPlace = objectManager.checkItemLocation(preObj.x, preObj.y, preObj.scale, 0.6, preObj.id, false);
                            if (canPlace) {
                                angles.push(angle);
                                this.preplaces[1].push(preObj);
                            }
                        }

                    } else {
                        if (type) return [];

                        preObj = this.createObj(item, direct);

                        let nears = this.preplaces[1].length ? this.preplaces[1].some(pos => UTILS.getDist(pos, preObj, 0, 0) < pos.scale + preObj.scale) : false;
                        if (nears) return [];

                        let renears = this.preplaces[0].length ? this.preplaces[0].some(pos => UTILS.getDist(pos, preObj, 0, 0) < pos.scale + preObj.scale) : false;
                        if (renears) return [];

                        let canPlace = objectManager.checkItemLocation(preObj.x, preObj.y, preObj.scale, 0.6, preObj.id, false);
                        if (canPlace) {
                            angles.push(direct);
                            this.preplaces[1].push(preObj);
                        }
                    }
                    return angles;
                };
                this.checkSpikeTick = function(findObj) {
   try {
                            if (isC("spiketick").checked) {
                                if (near.dist2 <= 10) {
                                    if (![3, 4, 5].includes(near.primaryIndex)) return false;
                                    if (!isC("safeAntiSpikeTick").checked || !enemy.length) return false;

                    if (near.dist2 <= 175) {
                        if (player.lastTrap || (player.inTrap && player.inTrap.health <= player.weapons[autoBreak.useHammer(player.inTrap) ? 1 : 0].dmg * 3.3 * config.weaponVariants[player[(player.weapons[autoBreak.useHammer(player.inTrap) ? 1 : 0] < 9 ? "prima" : "seconda") + "ryVariant"]].val * (items.weapons[player.weapons[autoBreak.useHammer(player.inTrap) ? 1 : 0]].sDmg || 1))) {
                            noOfSpikes++;
                            dontForceSoldier = true;
                            my.bullTick = false;
                        } else {
                            my.bullTick = true;
                        }
                                        for (let i = -1; i <= 1; i += 1 / 10) {
                                            counts.attempts++;
                                            let relAim = UTILS.getDirect(player, near, 2, 2) + i;
                                            let tmpX = near.x2 + tmpS * waMath.cos(relAim);
                                            let tmpY = near.y2 + tmpS * Math.sin(relAim);
                                            let cantPlace = liztobj.find((tmp) => tmp.active && UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) < item.scale + (tmp.blocker ? tmp.blocker : tmp.getScale(0.6, tmp.isItem)));
                                            if (cantPlace) continue;
                                            if (tmpY >= config.mapScale / 2 - config.riverWidth / 2 && tmpY <= config.mapScale / 2 + config.riverWidth / 2) continue;
                                            danger++;
                                            counts.block = `blocked`;
                                            break;
                                        }
                                    }
                                }
                                if (danger) {
                                    return true;
                                }
                            }
                        } catch (err) {
                            return null;
                        }
                        return false;
                    }
                this.protect = function (aim) {
                    if (!isC("antiTrap").checked) return;
                    this.testCanPlace(4, -(Math.PI / 2), (Math.PI / 2), (Math.PI / 5), aim + Math.PI);
                    this.testCanPlace(2, -(Math.PI / 3), (Math.PI / 3), (Math.PI / 3), aim + Math.PI);
                    this.antiTrapped = true;
                };

                this.autoPlace = function (type, id, id2, reasonhaha) {
                    if (!enemy.length) return;
                    if (!isC("autoPlace").checked) return;

                    if (type == 0) {
                        // id only

                        if (id == undefined) return;

                        let itemId = player.items[id];
                        if (itemId == undefined) return;

                        let item = items.list[itemId];

                        let itemId2 = id2 == undefined ? null : player.items[id2];
                        let item2 = itemId2 == undefined ? null : items.list[itemId2];

                        this.radObjs = nearObjs.filter(obj => obj.active && UTILS.getDist(obj, player, 0, 2) < 300);
                        if (this.radObjs.length) {
                            for (let i = 0; i < this.radObjs.length; i++) {
                                let obj = this.radObjs[i];
                                let direct = UTILS.getDirect(obj, player, 0, 2);
                                let placeAngles = this.radCalc(obj, direct, item);
                                if (placeAngles.length) {
                                    for (let i = 0; i < placeAngles.length; i++) {
                                        place(id, placeAngles[i]);
                                    }
                                } else {
                                    if (item2) {
                                        let obj = this.radObjs[i];
                                        let direct = UTILS.getDirect(obj, player, 0, 2);
                                        let placeAngles = this.radCalc(obj, direct, item2);
                                        if (placeAngles.length) {
                                            for (let i = 0; i < placeAngles.length; i++) {
                                                place(id2, placeAngles[i]);
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            for (let i = 0; i < Math.PI*2; i += Math.PI/2) {
                                checkPlace(id, near.aim2 + i);
                            }
                        }
                    } else if (type == 1) {
                        // id and id2
                        if (id == undefined) return;

                        let itemId = player.items[id];
                        if (itemId == undefined) return;

                        let item = items.list[itemId];

                        //let itemId2 = id2 == undefined ? null : player.items[id2];
                        //let item2 = itemId2 == undefined ? null : items.list[itemId2];

                        this.nest.rad = 0;
                        this.nest.x = near.x2;
                        this.nest.y = near.y2;
                        this.radObjs = nearObjs.filter(obj => {
                            if ((id == 4 ? obj.dmg : obj.trap) && obj.active/* && obj.isTeamObject(player)*/) {
                                let dist = UTILS.getDist(obj, near, 0, 2);
                                if (dist < 500) {
                                    if (this.nest.rad < dist) this.nest.rad = dist;
                                    return true;
                                }
                            }
                        });
                        if (this.radObjs.length) {
                            for (let i = 0; i < this.radObjs.length; i++) {
                                let obj = this.radObjs[i];
                                let direct = UTILS.getDirect(obj, player, 0, 2);
                                let placeAngles = this.radCalc(obj, direct, item, 1);
                                if (placeAngles.length) {
                                    for (let i = 0; i < placeAngles.length; i++) {
                                        place(id, placeAngles[i]);
                                    }
                                }
                            }
                        }
                        if (reasonhaha && this.preplaces[1].length < 1) {
                            this.autoPlace(1, id2, id, false);
                        }
                    }
                };
                this.autoReplace = function (sidList) {
                    if (!enemy.length) return;
                    if (near.dist2 > 300) return;
                    if (!isC("autoReplace").checked) return;
                    if (isC("weaponGrind").checked) return;

                    for (let i = 0; i < sidList.length; i++) {
                        let sid = sidList[i];
                        let building = findObjectBySid(sid);
                        let breakDist = UTILS.getDist(building, player, 0, 2)
                        if (breakDist > 300) continue;
                        let breakDir = UTILS.getDirect(building, player, 0, 2);
                        if (near.escaped) {
                            if (sid == near.lastTrap.sid && [4, 5].includes(player.weapons[0]) && player.reloads[player.weapons[0]] == 0) {
                                for (let i = near.aim2 - Math.PI/3; i <= near.aim2 + Math.PI/3; i += Math.PI/7.5) {
                                    let preObj = this.createObj(2, i);
                                    spikeTickPlace(2, i)
                                    this.preplaces[0].push(preObj)
                                }
                                this.testCanPlace(2, near.aim2 - Math.PI/3, near.aim2 + Math.PI/3, Math.PI/7.5, near.aim2, 1);
                                break;
                            } else {
                                checkPlace(4, near.aim2)
                                checkPlace(4, near.aim2+Math.PI/12)
                                checkPlace(4, near.aim2-Math.PI/12)
                                // this.testCanPlace(4, near.aim2 - Math.PI/12, near.aim2 + Math.PI/12, Math.PI/12, near.aim2, 1);
                                break;
                            }
                        }
                        if (near.inTrap && near.dist2 <= 150 && UTILS.getDist(building, near.inTrap, 0, 0) <= 169) {
                            this.testCanPlace(2, near.aim2 - Math.PI/2, near.aim2 + Math.PI/2+0.0001, Math.PI/32, near.aim2, 1, 1);
                            break;
                        }
                        if (player.escaped && sid == player.lastTrap.sid) {
                            this.testCanPlace(4, 0, Math.PI*2, Math.PI/6, UTILS.randFloat(0, Math.PI*2), 1);
                            break;
                        }
                        this.testCanPlace(4, 0, Math.PI*2, Math.PI/3, breakDir, 1);
                        break;

                        /* let placed = false;
                let sid = sidList[i];

                tmpObj = findObjectBySid(sid);

                if (!tmpObj) continue;

                let breakDist = UTILS.getDist(tmpObj, player, 0, 2);

                if (breakDist > 300) continue;

                let breakDir = UTILS.getDirect(tmpObj, player, 0, 2);
                let dirDist = UTILS.getAngleDist(breakDir, near.aim2);
                if (player.escaped) {
                    if (player.items[4] == 15) {
                        this.testCanPlace(4, 0, Math.PI*2, Math.PI/5, UTILS.randFloat(0, Math.PI*2));
                        return;
                    }
                }

                let id = breakDist > 200 ? 4 : dirDist < Math.PI/3 ? 4 : 2;
                let itemId = player.items[id];

                if (itemId == undefined) continue;

                let item = items.list[itemId];
                let preObj = this.createObj(item, breakDir);

                let nears = this.preplaces[0].length ? this.preplaces[0].some(pos => UTILS.getDist(pos, preObj, 0, 0) < pos.scale + preObj.scale) : false;
                if (!nears) {
                    let canPlace = objectManager.checkItemLocation(preObj.x, preObj.y, preObj.scale, 0.6, preObj.id, false);
                    if (canPlace) {
                        spikeTickPlace(id, breakDir);
                        placed = true;
                        this.preplaces[0].push(preObj);
                    }
                }

                if (placed) {
                    for (let i = -Math.PI * 1.5; i < Math.PI * 1.5; i += Math.PI/32) {

                        let toDir = breakDir + i + Math.PI;

                        let dirDist = UTILS.getAngleDist(toDir, near.aim2);
                        let id = breakDist > 200 ? 4 : dirDist < Math.PI/4 ? 4 : dirDist > Math.PI * 1.5 ? 4 : 2;
                        let itemId = player.items[id];

                        if (itemId == undefined) continue;

                        let item = items.list[itemId];
                        let preObj = this.createObj(item, toDir);

                        let nears = this.preplaces[0].length ? this.preplaces[0].some(pos => UTILS.getDist(pos, preObj, 0, 0) < pos.scale + preObj.scale) : false;
                        if (!nears) {
                            let canPlace = objectManager.checkItemLocation(preObj.x, preObj.y, preObj.scale, 0.6, preObj.id, false);
                            if (canPlace) {
                                spikeTickPlace(id, toDir);
                                this.preplaces[0].push(preObj);
                            }
                        }
                    }
                } else {
                    for (let i = -Math.PI * 1.5; i < Math.PI * 1.5; i += Math.PI / 32) {

                        let toDir = breakDir + i;

                        let dirDist = UTILS.getAngleDist(toDir, near.aim2);
                        let id = breakDist > 200 ? 4 : dirDist < Math.PI/4 ? 4 : dirDist > Math.PI * 1.5 ? 4 : 2;
                        let itemId = player.items[id];

                        if (itemId == undefined) continue;

                        let item = items.list[itemId];
                        let preObj = this.createObj(item, toDir);

                        let nears = this.preplaces[0].length ? this.preplaces[0].some(pos => UTILS.getDist(pos, preObj, 0, 0) < pos.scale + preObj.scale) : false;
                        if (!nears) {
                            let canPlace = objectManager.checkItemLocation(preObj.x, preObj.y, preObj.scale, 0.6, preObj.id, false);
                            if (canPlace) {
                                spikeTickPlace(id, toDir);
                                this.preplaces[0].push(preObj);
                            }
                        }
                    }
                }*/
                    }

                };
            }
        };
class AutoBreaker {
    constructor() {
        this.active = false; // Indicates if the auto-breaker system is active
        this.aim = 0; // Current aim direction
        this.priority = [[], [], [], []]; // Priority lists for target objects
        this.target = null; // Stores the closest current target
    }

    objectsHit(aim) {
        let results = [];
        nearObjs.forEach(e => {
            let dir = UTILS.getDirect(e, player, 0, 2);
            if (e.active && e.type == null && UTILS.getDist(player, e, 2, 0) <= items.weapons[this.useHammer(e) ? player.weapons[1] : player.weapons[0]].range + e.scale && UTILS.getAngleDist(dir, aim) <= Math.PI / 2.6) {
                results.push(e);
            }
        });
        return results; // Return all hittable objects
    }

    getFilteredPriority() {
        const filteredPriority = this.priority.map(list =>
            list.filter(obj =>
                obj.active && UTILS.getDist(obj, player, 0, 2) <= items.weapons[this.useHammer(obj) ? player.weapons[1] : player.weapons[0]].range + obj.scale
            )
        );
        return filteredPriority;
    }

    calculateAim() {
        const filteredPriority = this.getFilteredPriority();

        // Loop through priority levels from [0] to [3]
        for (let level = 0; level < filteredPriority.length; level++) {
            const targets = filteredPriority[level];

            if (level == 3) {
                if (enemy.length && near.dist2 <= 569) {
                    this.active = false;
                    return; // Exit early if the condition is met
                }
            }

            if (targets.length > 0) {
                this.processTargets(targets, level);
                return; // Exit after processing targets
            }
        }

        // If no targets were processed, deactivate
        this.active = false;
    }

processTargets(targetObjs, level) {
    if (!targetObjs.length) return; // No targets, no aim

    let maxTargetsHit = 0;
    const checkedAims = new Set(); // To avoid redundant aim checks

    // Handle multiple targets
    if (targetObjs.length > 1) {
        let aimAngles = [];
        // 1. Check pairwise aims (in-between targets)
        for (let i = 0; i < targetObjs.length; i++) {
            for (let j = i + 1; j < targetObjs.length; j++) {
                const adjust = (angle) => angle < 0 ? angle + 2 * Math.PI : angle;
                let aim1 = UTILS.getDirect(targetObjs[i], player, 0, 2);
                let aim2 = UTILS.getDirect(targetObjs[j], player, 0, 2);
                const aAdjusted = adjust(aim1);
                const bAdjusted = adjust(aim2);
                let avg = (aAdjusted + bAdjusted) / 2;
                let diff = Math.abs(aAdjusted - bAdjusted);
                if (diff > Math.PI) {
                    avg += Math.PI;
                }
                avg = avg % (2 * Math.PI);
                if (avg > Math.PI) {
                    avg -= 2 * Math.PI;
                }
                let aimBetween = avg + 180 * (diff > 180);

                // Avoid redundant checks
                if (checkedAims.has(aimBetween)) continue;
                checkedAims.add(aimBetween);

                const objectsHit = this.objectsHit(aimBetween);

                let reward = 0;

                objectsHit.forEach((obj) => {
                    if (obj.isTeamObject(player)) {
                        if (near.inTrap && obj.sid == near.inTrap.sid) {
                            reward -= level != 3 ? 50 : -50;
                        } else if (obj.dmg || obj.trap) {
                            reward -= level != 3 ? 30 : -50;
                        } else {
                            reward -= level != 3 ? 10 : -50;
                        }
                    } else {
                        if (obj.dmg) {
                            reward += 70;
                        } else if (obj.trap) {
                            reward += 60;
                        } else {
                            reward += 50;
                        }
                    }
                });
                aimAngles.push({
                    aim: aimBetween,
                    reward: reward
                });
                if (player.inTrap && targetObjs.length == 2) {
                    console.log(aimAngles[0]);
                }
            }
        }

        // 2. Check direct aims at each target
        for (let i = 0; i < targetObjs.length; i++) {
            const aimDirect = UTILS.getDirect(targetObjs[i], player, 0, 2);

            // Avoid redundant checks
            if (checkedAims.has(aimDirect)) continue;
            checkedAims.add(aimDirect);

            const objectsHit = this.objectsHit(aimDirect);
            let reward = 0;

            objectsHit.forEach((obj) => {
                if (obj.isTeamObject(player)) {
                        if (near.inTrap && obj.sid == near.inTrap.sid) {
                        reward -= level != 3 ? 50 : -50;
                    } else if (obj.dmg || obj.trap) {
                        reward -= level != 3 ? 30 : -50;
                    } else {
                        reward -= level != 3 ? 10 : -50;
                    }
                } else {
                    if (obj.dmg) {
                        reward += 70;
                    } else if (obj.trap) {
                        reward += 60;
                    } else {
                        reward += 50;
                    }
                }
            });
            aimAngles.push({
                aim: aimDirect,
                reward: reward
            });
        }
        this.aim = aimAngles.sort((a, b) => b.reward - a.reward)[0].aim;
        this.target = targetObjs.filter((obj) => objectManager.canHit(player, obj, player.weapons[0])).sort((a, b) => a.health - b.health)[0]||{health: 9999};
        this.active = true;

        return;
    }

    let aimAngles = [];
    // Handle single target case or fallback if no valid multi-target aim is found
    const target = targetObjs[0];
    const aimDirect = UTILS.getDirect(targetObjs[0], player, 0, 2);
    let objectsHit = this.objectsHit(aimDirect)
    let reward = 0;

    objectsHit.forEach((obj) => {
        if (obj.isTeamObject(player)) {
                if (near.inTrap && obj.sid == near.inTrap.sid) {
                reward -= level != 3 ? 50 : -50;
            } else if (obj.dmg || obj.trap) {
                reward -= level != 3 ? 30 : -50;
            } else {
                reward -= level != 3 ? 10 : -50;
            }
        } else {
            reward += 60;
        }
    });
    aimAngles.push({
        aim: aimDirect,
        reward: reward
    });

    const saferAngles = [Math.PI / 2.6 / 3, Math.PI / 2.6 / 2, Math.PI / 2.6 - 0.1];
    for (let saferAngle of saferAngles) {
        const saferAims = [aimDirect - saferAngle, aimDirect + saferAngle];
        for (let saferAim of saferAims) {
            let objectsHit = this.objectsHit(saferAim)
            let reward = 0;

            objectsHit.forEach((obj) => {
                if (obj.isTeamObject(player)) {
                        if (near.inTrap && obj.sid == near.inTrap.sid) {
                        reward -= level != 3 ? 50 : -50;
                    } else if (obj.dmg || obj.trap) {
                        reward -= level != 3 ? 30 : -50;
                    } else {
                        reward -= level != 3 ? 10 : -50;
                    }
                } else {
                    reward += 60;
                }
            });
            aimAngles.push({
                aim: saferAim,
                reward: reward
            });
        }
    }
    this.aim = aimAngles.sort((a, b) => b.reward - a.reward)[0].aim;
    this.target = target;
    this.active = true;
    return;
}

    useHammer(object) {
        if (isC("hammerBreakerOptimisation").checked && player.weapons[1] == 10) {
            if (object) {
                if (object.health > 0 && object.health <= items.weapons[player.weapons[0]].dmg && objectManager.canHit(player, object, player.weapons[0]) && ![5, 8].includes(player.weapons[0])) return false;
            }
            return true;
        }
        return false;
    }
}

        let PF = {
            active: false,
            gridSize: 100,
            scale: 1440,
            paths: [],
            attempts: 0,
            finded: false,
        };

        class CreatePath {
            constructor() {
                this.grid = [];
                this.foundPath = false;
            };
            init(delPos, reFind, type) {
                let goalPos = { x: 0, y: 0 };
                let dists = [];
                let nearBuilds = gameObjects.filter(obj => obj.active && !obj.ignoreCollision && Math.abs(player.x2 - obj.x) <= (PF.scale / 2 + obj.scale) && Math.abs(player.y2 - obj.y) <= (PF.scale / 2 + obj.scale));
                let centX = Math.round(player.x2) - (PF.scale / 2);
                let centY = Math.round(player.y2) - (PF.scale / 2);
                let griScale = PF.scale / PF.gridSize;

                let overScale = [griScale - 10, griScale + 10];
                let overPos = [player.scale, config.mapScale - player.scale];

                let reEScale = reFind ? overScale[1] : griScale;

                this.grid = [];
                for (let i = 0; i < PF.gridSize; i++) {
                    this.grid[i] = [];
                    for (let i2 = 0; i2 < PF.gridSize; i2++) {
                        let pos = {
                            x: centX + griScale * i2,
                            y: centY + griScale * i
                        };
                        if (UTILS.getDist(pos, player, 0, 2) <= player.scale) {
                            this.grid[i][i2] = 0;
                            continue;
                        }

                        if (type == "auto push") {
                            let tdist = UTILS.getDist(pos, {
                                x: near.x2 - delPos.x,
                                y: near.y2 - delPos.y
                            }, 0, 0);
                            if (tdist <= overScale[1]) {
                                dists.push({ x: i2, y: i, dist: tdist });
                                this.grid[i][i2] = 0;
                                continue;
                            }

                            let dist = UTILS.getDist(pos, near, 0, 2);
                            if (dist < near.scale + player.scale) {
                                this.grid[i][i2] = 1;
                                continue;
                            }

                            let some = nearBuilds.some(obj => {
                                if (!obj.isTeamObject(player)) {
                                    return UTILS.getDist(pos, obj, 0, 0) <= (obj.scale + player.scale)
                                } else {
                                    return UTILS.getDist(pos, obj, 0, 0) <= (obj.scale + 15)
                                }
                            });
                            if (some) {
                                this.grid[i][i2] = 1;
                            } else {
                                this.grid[i][i2] = 0;
                            }

                        } else if (type == "follow") {
                            let tdist = UTILS.getDist(pos, {
                                x: near.x2 - delPos.x,
                                y: near.y2 - delPos.y
                            }, 0, 0);
                            if (tdist <= overScale[1]) {
                                dists.push({ x: i2, y: i, dist: tdist });
                                this.grid[i][i2] = 0;
                                continue;
                            }

                            let some = nearBuilds.some(obj => {
                                return UTILS.getDist(pos, obj, 0, 0) <= obj.scale + 10
                            });
                            if (some) {
                                this.grid[i][i2] = 1;
                            } else {
                                this.grid[i][i2] = 0;
                            }
                        }

                        if (pos.x < overPos[0] || pos.x > overPos[1] || pos.y < overPos[0] || pos.y > overPos[1]) {
                            this.grid[i][i2] = 1;
                        }
                    }
                }

                this.foundPath = false;

                if (dists.length) {
                    dists.sort((a, b) => a.dist - b.dist);
                    goalPos = { x: dists[0].x, y: dists[0].y };
                }

                // Check if start or goal is occupied
                const start = {
                    x: Math.round(PF.gridSize / 2),
                    y: Math.round(PF.gridSize / 2)
                };
                if (this.grid[start.y][start.x] === 1) {
                    return { start: null, goal: null }; // Keep this for valid start checks
                }
                // Check if goal is occupied
                if (this.grid[goalPos.y]?.[goalPos.x] === 1) {
                    // Check neighbors of the goal
                    const neighbors = this.getPaths(goalPos).filter(pos =>
                                                                    pos.x >= 0 && pos.y >= 0 && pos.x < PF.gridSize && pos.y < PF.gridSize
                                                                   );

                    // Find a free neighbor
                    const freeNeighbor = neighbors.find(pos => this.grid[pos.y]?.[pos.x] === 0);

                    if (freeNeighbor) {
                        goalPos = freeNeighbor; // Update goal to the nearest free cell
                    } else {
                        return { start: null, goal: null }; // No valid goal or neighbors
                    }
                }

                return { start: start, goal: goalPos };
            }
            getPaths(pos) {
                return [{
                    x: pos.x + 1,
                    y: pos.y
                }, {
                    x: pos.x + 1,
                    y: pos.y + 1
                }, {
                    x: pos.x,
                    y: pos.y + 1
                }, {
                    x: pos.x - 1,
                    y: pos.y + 1
                }, {
                    x: pos.x - 1,
                    y: pos.y
                }, {
                    x: pos.x - 1,
                    y: pos.y - 1
                }, {
                    x: pos.x,
                    y: pos.y - 1
                }, {
                    x: pos.x + 1,
                    y: pos.y - 1
                }];
            }
            getScore(pos1, pos2) {
                // hahhaha why
                // return sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2);

                return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
            }
            calc(delPos, reFind, type) {

                let data = this.init(delPos, reFind, type);
                if (!data.start || !data.goal) {
                    return { paths: [], attempts: 0 }; // Return empty if start or goal is invalid
                }

                let start = data.goal;
                let goal = data.start;

                let search = {
                    x: start.x,
                    y: start.y
                };

                let paths = [{
                    x: search.x,
                    y: search.y,
                    score: this.getScore(search, goal),
                    seek: 0,
                    hop: 0,
                    start: true
                }];

                let searchPaths = this.getPaths(search);

                this.grid[start.y][start.x] = 0;
                this.grid[goal.y][goal.x] = 0;

                for (let i = 0; i < searchPaths.length; i++) {
                    let searchPath = searchPaths[i];

                    if (searchPath.x < 0 || searchPath.y < 0 || searchPath.x > PF.gridSize - 1 || searchPath.y > PF.gridSize - 1) {
                        continue;
                    }

                    if (this.grid[searchPath.y][searchPath.x] == 1) continue;

                    paths.push({
                        x: searchPath.x,
                        y: searchPath.y,
                        score: this.getScore(searchPath, goal),
                        seek: 0,
                        hop: 1
                    });
                }

                let maxAttempt = 100;
                let foundPaths = [];
                let i = 0;
                for (i = 0; i < maxAttempt; i++) {
                    if (this.foundPath || search.x == goal.x && search.y == goal.y) {
                        if (!this.foundPath) {
                            this.foundPath = true;
                            foundPaths.push({
                                x: player.x2 - (PF.scale / 2) + (PF.scale / PF.gridSize) * search.x,
                                y: player.y2 - (PF.scale / 2) + (PF.scale / PF.gridSize) * search.y
                            });
                        }

                        let found = paths.filter(a => (a.seek == 1 || a.start) && Math.abs(a.x - search.x) <= 1 && Math.abs(a.y - search.y) <= 1).toSorted((a, b) => {
                            return a.hop - b.hop;
                        });

                        if (found.length > 0) {
                            let nearPath = found[0];

                            search = {
                                x: nearPath.x,
                                y: nearPath.y
                            };
                            nearPath.seek = 2;

                            foundPaths.push({
                                x: player.x2 - (PF.scale / 2) + (PF.scale / PF.gridSize) * search.x,
                                y: player.y2 - (PF.scale / 2) + (PF.scale / PF.gridSize) * search.y
                            });

                            if (nearPath.start) break;

                        } else {
                            break;
                        }
                    } else {
                        let found = paths.filter(a => a.seek == 0).toSorted((a, b) => {
                            return a.score - b.score;
                        });

                        if (found.length > 0) {
                            let nearPath = found[0];

                            search = {
                                x: nearPath.x,
                                y: nearPath.y
                            };
                            nearPath.seek = 1;

                            searchPaths = this.getPaths(search);

                            let hop = nearPath.hop + 1;
                            for (let i = 0; i < searchPaths.length; i++) {
                                let searchPath = searchPaths[i];

                                if (searchPath.x < 0 || searchPath.y < 0 || searchPath.x > PF.gridSize - 1 || searchPath.y > PF.gridSize - 1) {
                                    continue;
                                }

                                if (this.grid[searchPath.y][searchPath.x] == 1) continue;

                                if (paths.some(a => a.x == searchPath.x && a.y == searchPath.y)) continue;

                                paths.push({
                                    x: searchPath.x,
                                    y: searchPath.y,
                                    score: this.getScore(searchPath, goal),
                                    seek: 0,
                                    hop: hop
                                });
                            }

                        } else {
                            break;
                        }
                    }
                }

                return {
                    paths: foundPaths,
                    attempts: i
                };
            };
        };

        const makeWorker = (fn) => {
            var blobURL = URL.createObjectURL(
                new Blob(["(", fn.toString(), ")()"], {
                    type: "application/javascript",
                })
            );
            let worker = new Worker(blobURL);
            URL.revokeObjectURL(blobURL);
            return worker;
        };

        let worker = makeWorker(function () {
            function getDist(node1, node2) {
                return Math.hypot(node2.x - node1.x, node2.y - node1.y);
            }
            function isOccupied(x, y, builds, near = null) {
                for (const build of builds) {
                    const dist = Math.hypot(build.x - x, build.y - y);
                    const minDist = build.scale + 20;
                    if (dist < minDist) return true;
                }
                if (near) {
                    const dist = Math.hypot(near.x - x, near.y - y);
                    const minDist = 35*2;
                    if (dist < minDist) return true;
                }
                return false;
            }
            function astar(start, goal, builds, near, avoidNear = true) {
                const directions = [
                    [0, 1], [1, 1], [1, 0], [1, -1],
                    [0, -1], [-1, -1], [-1, 0], [-1, 1]
                ];

                const openSet = [{ x: start.x, y: start.y, cost: 0, priority: getDist(start, goal), parent: null }];
                const visited = new Set();
                let attempts = 0;
                const maxAttempts = 300;

                while (attempts < maxAttempts) {
                    attempts++;
                    openSet.sort((a, b) => a.priority - b.priority);
                    const current = openSet.shift();

                    const key = `${current.x},${current.y}`;
                    if (visited.has(key)) continue;
                    visited.add(key);

                    if (getDist(current, goal) <= 42) {
                        const path = [];
                        let node = current;
                        while (node) {
                            path.push({ x: node.x, y: node.y });
                            node = node.parent;
                        }
                        return { success: true, path: path.reverse() };
                    }

                    for (const [dx, dy] of directions) {
                        const neighborX = current.x + dx * 35;
                        const neighborY = current.y + dy * 35;
                        if (
                            neighborX < 35 || neighborX > 14400 - 35 ||
                            neighborY < 35 || neighborY > 14400 - 35
                        ) continue;
                        if (isOccupied(neighborX, neighborY, builds, avoidNear ? near : null)) continue;

                        openSet.push({
                            x: neighborX,
                            y: neighborY,
                            cost: current.cost + getDist(current, { x: neighborX, y: neighborY }),
                            priority: current.cost + getDist(current, { x: neighborX, y: neighborY }) + getDist({ x: neighborX, y: neighborY }, goal),
                            parent: current
                        });
                    }
                }
                // Attempt to find the nearest node to the goal if the goal is occupied
                let nearestNode = null;
                let minDist = Infinity;
                visited.forEach((key) => {
                    const [x, y] = key.split(",").map(Number);
                    const dist = getDist({ x, y }, goal);
                    if (dist < minDist) {
                        nearestNode = { x, y, parent: null };
                        minDist = dist;
                    }
                });

                if (nearestNode) {
                    const path = [];
                    let node = nearestNode;
                    while (node) {
                        path.push({ x: node.x, y: node.y });
                        node = node.parent;
                    }
                    return { success: true, path: path.reverse() };
                }
                return { success: false };
            }

            self.onmessage = (ev) => {
                const args = ev.data;
                const [currentNode, targetNode, builds, near, avoidNear] = args;

                let result = astar(currentNode, targetNode, builds, near, avoidNear);

                self.postMessage(result);
            };
        });
        //AUTOPUSH:
        //pathinf

        worker.onmessage = (ev) => {
            if (ev.data.success) {
                const path = ev.data.path;
                if (path.length > 1) {
                    const nextNode = path[1];
                    const currentNode = path[0];
                    const resolveData = {
                        x: nextNode.x - currentNode.x,
                        y: nextNode.y - currentNode.y
                    };
                    PF.active = true;
                    PF.paths = path;
                    if (isC("autoPush").checked) {
                        my.autoPush = true;
                        packet("9", Math.atan2(resolveData.y, resolveData.x), 1);
                    }
                }
            } else {
                console.log(1);
                PF.active = false;
                PF.paths = [];
                if (UTILS.getDist(player, my.pushData, 2, 2) > 69) {
                    if (my.autoPush) {
                        my.autoPush = false;
                    }
                }
            }
        };

        class Instakill {
            constructor() {
                this.wait = false;
                this.can = false;
                this.isTrue = false;
                this.nobull = false;
                this.ticking = false;
                this.canSpikeTick = false;
                this.startTick = false;
                this.readyTick = false;
                this.canCounter = false;
                this.revTick = false;
                this.syncHit = false;
                this.changeType = function (type) {
                    this.wait = false;
                    this.isTrue = true;
                    my.autoAim = true;
                    let instaLog = [type];
                    let backupNobull = near.backupNobull;
                    near.backupNobull = false;
                    game.tickBase(() => {
                        instaLog.push(player.skinIndex);
                        game.tickBase(() => {
                            /* if (near.skinIndex == 22 && getEl("backupNobull").checked) {
                                near.backupNobull = true;
                            }*/
                            instaLog.push(player.skinIndex);
                        }, 1);
                    }, 1);
                    if (type == "rev") {
                        selectWeapon(player.weapons[1]);
                        buyEquip(53, 0);
                        buyEquip(21, 1);
                        if (!autoGathering) sendAutoGather();
                        game.tickBase(() => {
                            selectWeapon(player.weapons[0]);
                            if (near.dist2 <= 120 && isC("doSpikeOnReverse").checked) place(2, near.aim2);
                            buyEquip(7, 0);
                            buyEquip(21, 1);
                            game.tickBase(() => {
                                this.isTrue = false;
                                my.autoAim = false;
                            }, 1);
                        }, 1);
                    } else if (type == "nobull") {
                        selectWeapon(player.weapons[0]);
                        if (/*getEl("backupNobull").checked &&*/ backupNobull) {
                            buyEquip(7, 0);
                        } else {
                            buyEquip(6, 0);
                        }
                        buyEquip(21, 1);
                        if (!autoGathering) sendAutoGather();
                        game.tickBase(() => {
                            if (near.skinIndex == 22) {
                                /*  if (getEl("backupNobull").checked) {
                                    near.backupNobull = true;
                                }*/
                                buyEquip(6, 0);
                            } else {
                                buyEquip(53, 0);
                            }
                            selectWeapon(player.weapons[1]);
                            buyEquip(21, 1);
                            game.tickBase(() => {
                                this.isTrue = false;
                                my.autoAim = false;
                            }, 1);
                        }, 1);
                    } else if (type == "normal") {
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        buyEquip(21, 1);
                        if (!autoGathering) sendAutoGather();
                        game.tickBase(() => {
                            selectWeapon(player.weapons[1]);
                            buyEquip(player.reloads[53] <= ping/2 ? 53 : 6, 0);
                            buyEquip(21, 1);
                            game.tickBase(() => {
                                this.isTrue = false;
                                my.autoAim = false;
                            }, 1);
                        }, 1);
                    } else {
                        setTimeout(() => {
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 50);
                    }
                };
                this.spikeTickType = function (type) {
                    //spiketick new
              const _0x2f011c=_0x2fbb;function _0x22cd(){const _0x285246=['3104453ZWxpzR','8KJRgXe','344187rIiQIr','12909jgjdXr','2QAZKdM','weapons','tickBase','6096xysWTg','630668CEQkTP','982655iTBvpe','209411Ptcyts','6tJYqWA','autoAim','527346atirBY','isTrue','10kenPCT','14cUbJcN'];_0x22cd=function(){return _0x285246;};return _0x22cd();}(function(_0x2d8142,_0x579469){const _0x211fd0=_0x2fbb,_0x33bf82=_0x2d8142();while(!![]){try{const _0x1c5f46=parseInt(_0x211fd0(0x12a))/0x1*(-parseInt(_0x211fd0(0x124))/0x2)+-parseInt(_0x211fd0(0x12b))/0x3*(-parseInt(_0x211fd0(0x128))/0x4)+parseInt(_0x211fd0(0x129))/0x5+parseInt(_0x211fd0(0x12d))/0x6*(parseInt(_0x211fd0(0x11f))/0x7)+parseInt(_0x211fd0(0x121))/0x8*(-parseInt(_0x211fd0(0x122))/0x9)+parseInt(_0x211fd0(0x11e))/0xa*(parseInt(_0x211fd0(0x120))/0xb)+-parseInt(_0x211fd0(0x127))/0xc*(parseInt(_0x211fd0(0x123))/0xd);if(_0x1c5f46===_0x579469)break;else _0x33bf82['push'](_0x33bf82['shift']());}catch(_0x24025b){_0x33bf82['push'](_0x33bf82['shift']());}}}(_0x22cd,0x352ac));let perfectAngle=UTILS['getDirect'](tmpObj,player,0x0,0x2),placeCountOMG=0x4;function _0x2fbb(_0x439ea3,_0x53cae5){const _0x22cdea=_0x22cd();return _0x2fbb=function(_0x2fbb3e,_0x491f04){_0x2fbb3e=_0x2fbb3e-0x11d;let _0x21e816=_0x22cdea[_0x2fbb3e];return _0x21e816;},_0x2fbb(_0x439ea3,_0x53cae5);}this['isTrue']=!![],my['autoAim']=!![],sendChat(''),selectWeapon(player['weapons'][0x0]),buyEquip(0x7,0x0),buyEquip(0x15,0x1),sendAutoGather(),game[_0x2f011c(0x126)](()=>{const _0x53a57=_0x2f011c;selectWeapon(player[_0x53a57(0x125)][0x0]),buyEquip(0x35,0x0),buyEquip(0x15,0x1),game[_0x53a57(0x126)](()=>{const _0x1ffc48=_0x53a57;sendAutoGather(),this[_0x1ffc48(0x11d)]=![],my[_0x1ffc48(0x12c)]=![];},0x1);},0x1);/*this.isTrue = true;
               /*this.isTrue = true;
                my.autoAim = true;
                selectWeapon(player.weapons[0]);
                buyEquip(7, 0);
                sendAutoGather();
                game.tickBase(() => {
                    selectWeapon(player.weapons[0]);
                    buyEquip(53, 0);
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 1);//retire this*/
            };
                this.counterType = function () {
                    this.isTrue = true;
                    my.autoAim = true;
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    buyEquip(21, 1);
                    if (!autoGathering) sendAutoGather();
                    game.tickBase(() => {
                        if (player.reloads[53] == 0 && isC("turretCombat").checked) {
                            selectWeapon(player.weapons[0]);
                            buyEquip(53, 0);
                            buyEquip(21, 1);
                            game.tickBase(() => {
                                this.isTrue = false;
                                my.autoAim = false;
                            }, 1);
                        } else {
                            this.isTrue = false;
                            my.autoAim = false;
                        }
                    }, 1);
                };
                this.rangeType = function(type) {
                    this.isTrue = true;
                    my.autoAim = true;
                    if (type == "ageInsta") {
                        my.ageInsta = false;
                        if (player.items[5] == 18) {
                            traps.testCanPlace(5, 0, Math.PI*2, Math.PI/3,near.aim2);
                        }
                        packet("9", undefined, 1);
                        buyEquip(53, 0);
                        game.tickBase(() => {
                            selectWeapon(player.weapons[1]);
                            buyEquip(53, 0);
                            if (!autoGathering) sendAutoGather();
                            game.tickBase(() => {
                                sendUpgrade(12);
                                selectWeapon(player.weapons[1]);
                                buyEquip(53, 0);
                                game.tickBase(() => {
                                    sendUpgrade(15);
                                    selectWeapon(player.weapons[1]);
                                    buyEquip(53, 0);
                                    game.tickBase(() => {
                                        this.isTrue = false;
                                        my.autoAim = false;
                                        this.ticking = false;
                                    }, 3);
                                }, 1);
                            }, 1);
                        }, 2);
                    } else {
                        selectWeapon(player.weapons[1]);
                        if (player.reloads[53] == 0 && near.dist2 <= 700 && near.skinIndex != 22) {
                            buyEquip(53, 0);
                        } else {
                            buyEquip(20, 0);
                        }
                        if (!autoGathering) sendAutoGather();
                        game.tickBase(() => {
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 1);
                    }
                };
                this.musketSync = function() {
                    if (player.weapons[1] != 15) return;
                    this.isTrue = true;
                    if (player.items[5] == 18) traps.testCanPlace(5, 0, Math.PI*2, Math.PI/3,near.aim2);
                    my.autoAim = true;
                    buyEquip(53, 0) //equip earlier cuz turret is slower but I dont think this will sync
                    game.tickBase(() => {
                        selectWeapon(player.weapons[1])
                        if (!autoGathering) sendAutoGather()
                        game.tickBase(() => {
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 1)
                    }, 1)
                };
                this.oneTickType = function() {
                    textManager.showText(player.x2, player.y2, 30, 0.15, 1850, "Test OneTick", "#946110", 2);
                    this.isTrue = true;
                    this.ticking = true;
                    my.autoAim = true;
                    packet("9", near.aim2, 1);
                    game.tickBase(() => {
                        if (player.weapons[1] == 15) {
                            my.revAim = true;
                        }
                        selectWeapon(player.weapons[[9, 10, 12, 13, 15].includes(player.weapons[1]) ? 1 : 0]);
                        buyEquip(53, 0);
                        if ([9, 12, 13, 15].includes(player.weapons[1])) {
                            if (!autoGathering) sendAutoGather();
                        }
                        game.tickBase(() => {
                            my.revAim = false;
                            selectWeapon(player.weapons[0]);
                            buyEquip(7, 0);
                            if (!autoGathering) sendAutoGather();
                            packet("9", near.aim2, 1);
                            game.tickBase(() => {
                                this.isTrue = false;
                                this.ticking = false;
                                my.autoAim = false;
                                this.goTickThem = false;
                                packet("9", undefined, 1);
                            }, 1);
                        }, 1);
                    }, 1);
                };
                this.threeOneTickType = function () {
        textManager.showText(player.x2, player.y2, 30, 0.15, 1850, "Test OneTick", "#946110", 2);
                    this.isTrue = true;
                    my.autoAim = true;
                    selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                    buyEquip(11, 1);
                    packet("9", near.aim2, 1);
                    game.tickBase(() => {
                        selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                        buyEquip(53, 0);
                        buyEquip(11, 1);
                        packet("9", near.aim2, 1);
                        game.tickBase(() => {
                            selectWeapon(player.weapons[0]);
                            buyEquip(7, 0);
                            buyEquip(19, 1);
                            if (!autoGathering) sendAutoGather();
                            packet("9", near.aim2, 1);
                            game.tickBase(() => {
                                this.isTrue = false;
                                my.autoAim = false;
                                packet("9", undefined, 1);
                            }, 1);
                        }, 1);
                    }, 1);
                };
                this.newTickType = function () {
                    this.isTrue = true;
                    this.ticking = true;
                    my.autoAim = true;
                    packet("9", near.aim2, 1);
                    buyEquip(53, 0);
                    game.tickBase(() => {
                        my.revAim = false;
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        if (!autoGathering) sendAutoGather();
                        packet("9", near.aim2, 1);
                        game.tickBase(() => {
                            this.isTrue = false;
                            this.ticking = false;
                            my.autoAim = false;
                            this.goTickThem = false;
                            packet("9", undefined, 1);
                        }, 1);
                    }, 1);
                };
                this.boostTickType = function () {
                    /*this.isTrue = true;
                        my.autoAim = true;
                        selectWeapon(player.weapons[0]);
                        buyEquip(53, 0);
                        buyEquip(11, 1);
                        packet("33", near.aim2);
                        game.tickBase(() => {
                            place(4, near.aim2);
                            selectWeapon(player.weapons[1]);
                            buyEquip(11, 1);
                            sendAutoGather();
                            packet("33", near.aim2);
                            game.tickBase(() => {
                                selectWeapon(player.weapons[0]);
                                buyEquip(7, 0);
                                buyEquip(19, 1);
                                packet("33", near.aim2);
                                game.tickBase(() => {
                                    sendAutoGather();
                                    this.isTrue = false;
                                    my.autoAim = false;
                                    packet("33", undefined);
                                }, 1);
                            }, 1);
                        }, 1);*/
                    this.isTrue = true;
                    my.autoAim = true;
                    packet("9", near.aim2, 1);
                    game.tickBase(() => {
                        if (player.weapons[1] == 15) {
                            my.revAim = true;
                        }
                        selectWeapon(player.weapons[[9, 12, 13, 15].includes(player.weapons[1]) ? 1 : 0]);
                        buyEquip(53, 0);
                        buyEquip(11, 1);
                        if ([9, 12, 13, 15].includes(player.weapons[1])) {
                            if (!autoGathering) sendAutoGather();
                        }
                        packet("9", near.aim2, 1);
                        place(4, near.aim2);
                        game.tickBase(() => {
                            my.revAim = false;
                            selectWeapon(player.weapons[0]);
                            buyEquip(7, 0);
                            buyEquip(19, 1);
                            if (![9, 12, 13, 15].includes(player.weapons[1])) {
                                if (!autoGathering) sendAutoGather();
                            }
                            packet("9", near.aim2, 1);
                            game.tickBase(() => {
                                this.isTrue = false;
                                my.autoAim = false;
                                packet("9", undefined, 1);
                            }, 1);
                        }, 1);
                    }, 1);
                };
                this.gotoGoal = function (goto, OT) {
                    let slowDists = (weeeee) => weeeee * config.playerScale;
                    let goal = {
                        a: goto - OT,
                        b: goto + OT,
                        c: goto - slowDists(1),
                        d: goto + slowDists(1),
                        e: goto - slowDists(2),
                        f: goto + slowDists(2),
                        g: goto - slowDists(4),
                        h: goto + slowDists(4)
                    };
                    let bQ = function(wwww, awwww) {
                        if (player.inWater && awwww == 0) {
                            buyEquip(31, 0);
                        } else {
                            buyEquip(wwww, awwww);
                        }
                    }
                    if (enemy.length) {
                        let dst = near.dist2;
                        this.ticking = true;
                        if (dst >= goal.a && dst <= goal.b) {
                            bQ(22, 0);
                            bQ(19, 1);
                            if (player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0] || player.buildIndex > -1) {
                                selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                            }
                            return {
                                dir: undefined,
                                action: 1
                            };
                        } else {
                            if (dst < goal.a) {
                                if (dst >= goal.g) {
                                    if (dst >= goal.e) {
                                        if (dst >= goal.c) {
                                            bQ(40, 0);
                                            bQ(0, 1);
                                            if (isC("slowOT").checked) {
                                                player.buildIndex != player.items[1] && selectToBuild(player.items[1]);
                                            } else {
                                                if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                                    selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                                }
                                            }
                                        } else {
                                            bQ(22, 0);
                                            bQ(0, 1);
                                            if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                                selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                            }
                                        }
                                    } else {
                                        bQ(6, 0);
                                        bQ(0, 1);
                                        if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                            selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                        }
                                    }
                                } else {
                                    biomeGear(1);
                                    bQ(11, 1);
                                    if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                        selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                    }
                                }
                                return {
                                    dir: near.aim2 + Math.PI,
                                    action: 0
                                };
                            } else if (dst > goal.b) {
                                if (dst <= goal.h) {
                                    if (dst <= goal.f) {
                                        if (dst <= goal.d) {
                                            bQ(40, 0);
                                            bQ(0, 1);
                                            if (isC("slowOT").checked) {
                                                player.buildIndex != player.items[1] && selectToBuild(player.items[1]);
                                            } else {
                                                if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                                    selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                                }
                                            }
                                        } else {
                                            bQ(22, 0);
                                            bQ(0, 1);
                                            if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                                selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                            }
                                        }
                                    } else {
                                        bQ(6, 0);
                                        bQ(0, 1);
                                        if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                            selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                        }
                                    }
                                } else {
                                    biomeGear(1);
                                    bQ(11, 1);
                                    if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                        selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                    }
                                }
                                return {
                                    dir: near.aim2,
                                    action: 0
                                };
                            }
                            return {
                                dir: undefined,
                                action: 0
                            };
                        }
                    } else {
                        this.ticking = false
                        return {
                            dir: undefined,
                            action: 0
                        };
                    }
                }
                /** wait 1 tick for better quality */
                this.bowMovement = function () {
                    let moveMent = this.gotoGoal(682, 4);
                    if (moveMent.action) {
                        if (player.reloads[53] == 0 && !this.isTrue) {
                            this.rangeType("ageInsta");
                        } else {
                            packet("9", moveMent.dir, 1);
                        }
                    } else {
                        packet("9", moveMent.dir, 1);
                    }
                }
                this.tickMovement = function () {
                    this.ticking = true;
                    let moveMent = this.gotoGoal(([10, 14].includes(player.weapons[1]) && player.y2 > config.snowBiomeTop) ? 243 : player.weapons[1] == 15 ? 270 : player.y2 <= config.snowBiomeTop ? [10, 14].includes(player.weapons[1]) ? 233 : 231 : 240, 3);
                    if (moveMent.action) {
                        if (near.skinIndex != 22 && player.reloads[53] == 0 && !this.isTrue) {
                            this.oneTickType()
                        } else {
                            packet("9", moveMent.dir, 1);
                        }
                    } else {
                        packet("9", moveMent.dir, 1);
                    }
                }
                this.goTickThem = false;
                this.newTickMovement = function () {
                    this.ticking = true;
                    let dir = near.dist2 < parseInt(getEl("testInput2").value)+500 ? near.aim2 + Math.PI : undefined;
                    if (this.goTickThem) {
                        game.tickBase(() =>{
                            selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                            game.tickBase(() => {
                                buyEquip(19, 1);
                            }, parseInt(getEl("testInput3").value));
                        }, 1);
                        packet("9", near.aim2, 1);
                        let dist = parseInt(getEl("testInput1").value);
                        if (near.dist2 <= dist) {
                            console.log(near.dist2);
                            this.newTickType();
                        }
                    } else {
                        packet("9", dir, 1)
                        buyEquip(11, 1);
                        if (near.dist2 >= parseInt(getEl("testInput2").value)) {
                            player.buildIndex != player.items[1] && selectToBuild(player.items[1]);
                            this.goTickThem = true;
                        }
                    }
                    biomeGear(1);
                }
                this.boostTickMovement = function () {
                    this.ticking = true;
                    let dist = player.weapons[1] == 9 ? 365 : player.weapons[1] == 12 ? 380 : player.weapons[1] == 13 ? 390 : player.weapons[1] == 15 ? 365 : 370;
                    let actionDist = player.weapons[1] == 9 ? 2 : player.weapons[1] == 12 ? 1.5 : player.weapons[1] == 13 ? 1.5 : player.weapons[1] == 15 ? 2 : 3;
                    let moveMent = this.gotoGoal(dist, actionDist);
                    if (moveMent.action) {
                        if (player.reloads[53] == 0 && !this.isTrue) {
                            this.boostTickType();
                        } else {
                            packet("9", moveMent.dir, 1);
                        }
                    } else {
                        packet("9", moveMent.dir, 1);
                    }
                }
                /** wait 1 tick for better quality */
                this.perfCheck = function(pl, nr) {
                    if (nr.weaponIndex == 11 && UTILS.getAngleDist(nr.aim2 + Math.PI, nr.d2) <= config.shieldAngle) return false;
                    if (![9, 12, 13, 15].includes(player.weapons[1])) return true;
                    let pjs = {
                        x: nr.x2 + (70 * Math.cos(nr.aim2 + Math.PI)),
                        y: nr.y2 + (70 * Math.sin(nr.aim2 + Math.PI))
                    };
                    if (UTILS.lineInRect(pl.x2 - pl.scale, pl.y2 - pl.scale, pl.x2 + pl.scale, pl.y2 + pl.scale, pjs.x, pjs.y, pjs.x, pjs.y)) {
                        return true;
                    }
                    let finds = ais.filter(tmp => tmp.visible).find((tmp) => {
                        if (UTILS.lineInRect(tmp.x2 - tmp.scale, tmp.y2 - tmp.scale, tmp.x2 + tmp.scale, tmp.y2 + tmp.scale, pjs.x, pjs.y, pjs.x, pjs.y)) {
                            return true;
                        }
                    });
                    if (finds) return false;
                    finds = gameObjects.filter(tmp => tmp.active).find((tmp) => {
                        let tmpScale = tmp.getScale();
                        if (!tmp.ignoreCollision && UTILS.lineInRect(tmp.x - tmpScale, tmp.y - tmpScale, tmp.x + tmpScale, tmp.y + tmpScale, pjs.x, pjs.y, pjs.x, pjs.y)) {
                            return true;
                        }
                    });
                    if (finds) return false;
                    return true;
                }
            }
        };

        class Autobuy {
            constructor(items) {
                this.items = items; // Array of items to buy [[id, type], ...]
            }

            buyNext() {
                for (const [id, type] of this.items) {
                    // Find the item in the appropriate list
                    const find = type === 0 ? findID(hats, id) : findID(accessories, id);

                    // Check if the item exists and isn't already owned
                    const isOwned = type === 0 ? player.skins[id] : player.tails[id];
                    if (!find || isOwned) continue; // Skip if not found or already owned

                    // Check if the player has enough points to buy the item
                    if (player.points >= find.price) {
                        packet("c", 1, id, type); // Buy the item
                        if (id == 7 && type == 0) my.reSync = true;
                        return; // Stop after attempting to buy one item
                    }
                    return; // Stop if the item couldn't be bought (not enough points)
                }
            }
        }

        class Autoupgrade {
            constructor() {
                this.sb = function(upg) {
                    upg(3);
                    upg(17);
                    upg(31);
                    upg(23);
                    upg(9);
                    upg(38);
                };
                this.kh = function(upg) {
                    upg(3);
                    upg(17);
                    upg(31);
                    upg(23);
                    upg(10);
                    upg(38);
                    upg(4);
                    upg(25);
                };
                this.pb = function(upg) {
                    upg(5);
                    upg(17);
                    upg(32);
                    upg(23);
                    upg(9);
                    upg(38);
                };
                this.ph = function(upg) {
                    upg(5);
                    upg(17);
                    upg(32);
                    upg(23);
                    upg(10);
                    upg(38);
                    upg(28);
                    upg(25);
                };
                this.db = function(upg) {
                    upg(7);
                    upg(17);
                    upg(31);
                    upg(23);
                    upg(9);
                    upg(34);
                };
                /* old functions */
                this.km = function(upg) {
                    upg(7);
                    upg(17);
                    upg(31);
                    upg(23);
                    upg(10);
                    upg(38);
                    upg(4);
                    upg(15);
                };
            };
        };

        class Damages {
            constructor(items) {
                // 0.75 1 1.125 1.5
                this.calcDmg = function(dmg, val) {
                    return dmg * val;
                };
                this.getAllDamage = function(dmg) {
                    return [this.calcDmg(dmg, 0.75), dmg, this.calcDmg(dmg, 1.125), this.calcDmg(dmg, 1.5)];
                };
                this.weapons = [];
                for (let i = 0; i < items.weapons.length; i++) {
                    let wp = items.weapons[i];
                    let name = wp.name.split(" ").length <= 1 ? wp.name : (wp.name.split(" ")[0] + "_" + wp.name.split(" ")[1]);
                    this.weapons.push(this.getAllDamage(i > 8 ? wp.Pdmg : wp.dmg));
                    this[name] = this.weapons[i];
                }
            }
        }

        /** CLASS CODES */
        // jumpscare code warn
        let tmpList = [];

        // LOADING:
        let UTILS = new Utils();
        let items = new Items();
        let objectManager = new Objectmanager(GameObject, gameObjects, UTILS, config);
        let store = new Store();
        let hats = store.hats;
        let accessories = store.accessories;
        let projectileManager = new ProjectileManager(Projectile, projectiles, players, ais, objectManager, items, config, UTILS);
        let aiManager = new AiManager(ais, AI, players, items, null, config, UTILS);
        let textManager = new Textmanager();

        let traps = new Traps(UTILS, items);
        let autoBreak = new AutoBreaker();
        let instaC = new Instakill();
        let autoBuy = new Autobuy([[11, 1], [40, 0], [6, 0], [7, 0], [31, 0], [15, 0], [19, 1], [22, 0], [53, 0], [12, 0], [20, 0], [10, 0], [56, 0], [21, 1], [11, 0], [26, 0], [18, 1], [13, 1]])
        let autoUpgrade = new Autoupgrade();
        let createPath = new CreatePath()

        let lastDeath;
        let minimapData;
        let mapMarker = {};
        let mapPings = [];
        let tmpPing;

        let breakTrackers = [];

        let grid = [];

        function sendChat(message) {
            packet("6", message.slice(0, 30));
        }

        function checkProjectileHolder(x, y, dir, range, speed, indx, layer, sid) {
            let weaponIndx = indx == 0 ? 9 : indx == 2 ? 12 : indx == 3 ? 13 : indx == 5 && 15;
            let projOffset = config.playerScale * 2;
            let projXY = {
                x: indx == 1 ? x : x - projOffset * Math.cos(dir),
                y: indx == 1 ? y : y - projOffset * Math.sin(dir),
            };
            let nearPlayer = players.filter((e) => e.visible && UTILS.getDist(projXY, e, 0, 2) <= e.scale).sort(function (a, b) {
                return UTILS.getDist(projXY, a, 0, 2) - UTILS.getDist(projXY, b, 0, 2);
            })[0];
            if (nearPlayer) {
                if (indx == 1) {
                    nearPlayer.shooting[53] = 1;
                } else {
                    nearPlayer.shootIndex = weaponIndx;
                    nearPlayer.shooting[1] = 1;
                    antiProj(nearPlayer, dir, range, speed, indx, weaponIndx);
                }
            }
        }
        let musketCount = 0;
        let projectile = {
            count: 0,
            dmg: 0
        };
        function antiProj(tmpObj, dir, range, speed, index, weaponIndex) {
            if (!tmpObj.isTeam(player)) {
                tmpDir = UTILS.getDirect(player, tmpObj, 2, 2);
                if (UTILS.getAngleDist(tmpDir, dir) <= 0.2 && UTILS.getDist(player, tmpObj, 2, 2) > speed*game.tickRate*2) {
                    tmpObj.bowThreat[weaponIndex]++;
                    if (index == 5) musketCount++;
                    if (tmpObj.dist2 > 234) {
                        projectile.count++
                        projectile.dmg += items.projectiles[index].dmg
                    }
                    setTimeout(() => {
                        tmpObj.bowThreat[weaponIndex]--;
                        musketCount--;
                        if (projectile.count > 0) {
                            projectile.count--
                            projectile.dmg -= items.projectiles[index].dmg
                        }
                    }, range / speed);
                    if (tmpObj.bowThreat[9] >= 1 && (tmpObj.bowThreat[12] >= 1 || tmpObj.bowThreat[15] >= 1)) {
                        place(3, tmpObj.aim2);
                        place(1, tmpObj.aim2);
                        my.anti0Tick = 4;
                        player.chat.message = `anti bow insta by ${tmpObj.sid} ${tmpObj.name}`;
                        player.chat.count = 445;
                        predictHeal(1);
                    } else {
                        if (musketCount >= 2 || projectile.count >= 4) {
                            place(3, tmpObj.aim2);
                            place(1, tmpObj.aim2);
                            my.anti0Tick = 4;
                            player.chat.message = `anti proj sync`;
                            player.chat.count = 445;
                            predictHeal(2);
                        }
                    }
                }
            }
        }

        // SHOW ITEM INFO:
        function showItemInfo(item, isWeapon, isStoreItem) {
            if (player && item) {
                UTILS.removeAllChildren(itemInfoHolder);
                itemInfoHolder.classList.add("visible");
                UTILS.generateElement({
                    id: "itemInfoName",
                    text: UTILS.capitalizeFirst(item.name),
                    parent: itemInfoHolder
                });
                UTILS.generateElement({
                    id: "itemInfoDesc",
                    text: item.desc,
                    parent: itemInfoHolder
                });
                if (isStoreItem) {

                } else if (isWeapon) {
                    UTILS.generateElement({
                        class: "itemInfoReq",
                        text: !item.type?"primary":"secondary",
                        parent: itemInfoHolder
                    });
                } else {
                    for (let i = 0; i < item.req.length; i += 2) {
                        UTILS.generateElement({
                            class: "itemInfoReq",
                            html: item.req[i] + "<span class='itemInfoReqVal'> x" + item.req[i + 1] + "</span>",
                            parent: itemInfoHolder
                        });
                    }
                    if (item.group.limit) {
                        UTILS.generateElement({
                            class: "itemInfoLmt",
                            text: (player.itemCounts[item.group.id] || 0) + "/" + (config.isSandbox ? 99 : item.group.limit),
                            parent: itemInfoHolder
                        });
                    }
                }
            } else {
                itemInfoHolder.classList.remove("visible");
            }
        }


        // RESIZE:
        window.addEventListener("resize", UTILS.checkTrusted(resize));

        function resize() {
            screenWidth = window.innerWidth;
            screenHeight = window.innerHeight;
            let scaleFillNative = Math.max(screenWidth / maxScreenWidth, screenHeight / maxScreenHeight) * pixelDensity;
            gameCanvas.width = screenWidth * pixelDensity;
            gameCanvas.height = screenHeight * pixelDensity;
            gameCanvas.style.width = screenWidth + "px";
            gameCanvas.style.height = screenHeight + "px";
            mainContext.setTransform(
                scaleFillNative, 0,
                0, scaleFillNative,
                (screenWidth * pixelDensity - (maxScreenWidth * scaleFillNative)) / 2,
                (screenHeight * pixelDensity - (maxScreenHeight * scaleFillNative)) / 2
            );
        }
        resize();
        gameCanvas = document.getElementById("touch-controls-fullscreen");
        // MOUSE INPUT:
        gameCanvas.addEventListener("mousemove", gameInput, false);

        function gameInput(e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        }
        let clicks = {
            left: false,
            middle: false,
            right: false,
        };
        gameCanvas.addEventListener("mousedown", mouseDown, false);

        function mouseDown(e) {
            if (attackState != 1) {
                attackState = 1;
                if (e.button == 0) {
                    clicks.left = true;
                } else if (e.button == 1) {
                    clicks.middle = true;
                } else if (e.button == 2) {
                    clicks.right = true;
                }
            }
        }
        window.addEventListener("mouseup", UTILS.checkTrusted(mouseUp));

        function mouseUp(e) {
            if (attackState != 0) {
                attackState = 0;
                if (e.button == 0) {
                    clicks.left = false;
                } else if (e.button == 1) {
                    clicks.middle = false;
                } else if (e.button == 2) {
                    clicks.right = false;
                }
            }
        }
       gameCanvas.addEventListener("wheel", wheel, false);

let wbe = 1;
let mWbe = 1;
let smothAnim = null;

function wheel(e, t = [null, 0]) {
    if (e.deltaY > 0) {
        //if (maxScreenWidth < 2100) {
        mWbe = Math.min(mWbe + 0.35, 10);
        //}
    } else {
        if (maxScreenWidth > 800) {
            mWbe = Math.max(mWbe - 0.35, 0.1);
        }
    }
    vision(mWbe);
}

function vision(mWbe) {
    if (smothAnim) clearInterval(smothAnim);
    smothAnim = setInterval(() => {
        wbe += (mWbe - wbe) * 0.1;
        maxScreenWidth = config.maxScreenWidth * wbe;
        maxScreenHeight = config.maxScreenHeight * wbe;
        resize();
        if (Math.abs(mWbe - wbe) < 0.01) {
            clearInterval(smothAnim);
        }
    }, 15);
}

        // INPUT UTILS:
        function getMoveDir() {
            let dx = 0;
            let dy = 0;
            for (let key in moveKeys) {
                let tmpDir = moveKeys[key];
                dx += !!keys[key] * tmpDir[0];
                dy += !!keys[key] * tmpDir[1];
            }
            return dx == 0 && dy == 0 ? undefined : Math.atan2(dy, dx);
        }

        function isNearPlayer() {
            return near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8;
        }
        function getSafeDir() {// THANK U BRT
            let x = mouseX + camX - player.x;
            let y = mouseY + camY - player.y;
            if (!player) return 0;
            if (!player.lockDir) {
                return UTILS.getDirect({x, y}, {x: screenWidth/2, y: screenHeight/2}, 0, 0)//Math.atan2(y - (screenHeight / 2), x - (screenWidth / 2));
            }
            return lastDir || 0;
        }

        function getAttackDir() {
            if (!player)
                return 0;

            if (my.autoAim || (isNearPlayer() && clicks.left)) {
                lastDir = isC("weaponGrind").checked ? getSafeDir() : enemy.length ? my.revAim ? (near.aim2 + Math.PI) : near.aim2 : getSafeDir();
            } else if (clicks.right) {
                lastDir = getSafeDir();
            } else if (autoBreak.active) {
                lastDir = autoBreak.aim;
            } else if (!player.lockDir) {
                if (isC("renderDir").checked && isC("renderDir").options.value == "noDir") return undefined;
                lastDir = getSafeDir();
                if (isC("spinhere").checked) {
                    lastDir += 360 && lastDir + (performance.now() / 30) % (Math.PI * 360);
                } // 40 = good , but >= 20 = slow or no
            }
            return lastDir || 0;
        }

        function getVisualDir() {
            if (!player)
                return 0;

            if (my.autoAim || (isNearPlayer() && clicks.left)) {
                lastDir = isC("weaponGrind").checked ? getSafeDir() : enemy.length ? my.revAim ? (near.aim2 + Math.PI) : near.aim2 : getSafeDir();
            } else if (clicks.right) {
                lastDir = getSafeDir();
            } else if (autoBreak.active) {
                lastDir = autoBreak.aim;
            } else if (!player.lockDir) {
                if (isC("renderDir").checked && isC("renderDir").options.value == "noDir") return undefined;
                lastDir = getSafeDir();
            }
            return lastDir || 0;
        }

        // KEYS:
        function keysActive() {
            return (allianceMenu.style.display != "block" &&
                    chatHolder.style.display != "block" &&
                    !menuCBFocus);
        }

        function toggleMenuChat() {
            if (menuChatDiv.style.display != "none") {
                chatHolder.style.display = "none";
                if (menuChatBox.value != "") {
                    //commands[command.slice(1)]
                    let cmd = function(command) {
                        return {
                            found: command.startsWith("/") && commands[command.slice(1).split(" ")[0]],
                            fv: commands[command.slice(1).split(" ")[0]]
                        }
                    }
                    let command = cmd(menuChatBox.value);
                    if (command.found) {
                        if (typeof command.fv.action === "function") {
                            command.fv.action(menuChatBox.value);
                        }
                    } else {
                        sendChat(menuChatBox.value);
                    }
                    menuChatBox.value = "";
                    menuChatBox.blur();
                } else {
                    if (menuCBFocus) {
                        menuChatBox.blur();
                    } else {
                        menuChatBox.focus();
                    }
                }
            }
        }

        function keyDown(event) {
            let keyNum = event.which || event.keyCode || 0;
            if (player && player.alive && keysActive()) {
                if (!keys[keyNum]) {
                    keys[keyNum] = 1;
                    macro[event.key] = 1;
                    if (keyNum == 27) {
                        const menu = document.getElementById('modmenus');
                        if (menu.classList.contains('open')) {
                            menu.classList.add('closed');
                            menu.classList.remove('open');
                            setTimeout(() => {
                                menu.style.display = 'none';
                            }, 400);
                        } else {
                            menu.classList.add('open');
                            menu.classList.remove('closed');
                            menu.style.display = 'block';
                            setTimeout(() => {
                                document.getElementById('modmenus-sidebar').style.opacity = 1;
                            }, 400);
                        }
                    } else if (keyNum == 69) {
                        sendAutoGather(1);
                    } else if (keyNum == 67) {
                        updateMapMarker();
                    } else if (player.weapons[keyNum - 49] != undefined) {
                        player.weaponCode = player.weapons[keyNum - 49];
                    } else if (keyNum == 81) {
                        selectWeapon(player.weaponCode);
                    } else if (event.key == "m") {
                        mills.placeSpawnPads = !mills.placeSpawnPads;
                    } else if (event.key == "z") {
                        mills.place = !mills.place;
                        textManager.showText(player.x2, player.y2, 20, 0.15, 1850, `Automills: ${mills.place}`, "#00FFFF", 2);
                    } else if (event.key == "Z") {
                        typeof window.debug == "function" && window.debug();
                    } else if (keyNum == 32) {
                        packet("F", 1, getSafeDir(), 1);
                        packet("F", 0, getSafeDir(), 1);
                    } else if (event.key == ",") {
                        player.sync = true;
                        //  sendChat(getEl("syncChat").value)
                    } else if (keyNum == 16) {
                        debugStop = true;
                        setTimeout(() => {
                            debugStop = false;
                        }, 10000)
                    }
                }
            }
        }
        addEventListener("keydown", UTILS.checkTrusted(keyDown));

        function keyUp(event) {
            if (player && player.alive) {
                let keyNum = event.which || event.keyCode || 0;
                if (keyNum == 13) {
                    toggleMenuChat();
                    player.moveDir = undefined;
                } else if (keysActive()) {
                    if (keys[keyNum]) {
                        keys[keyNum] = 0;
                        macro[event.key] = 0;
                        if (event.key == ",") {
                            player.sync = false;
                        } else if (event.key == "C") {
                            toggleSong();
                        }
                    }
                }
            }
        }
        window.addEventListener("keyup", UTILS.checkTrusted(keyUp));
        function sendMoveDir() {
            if (instaC.ticking) return;
            let newMoveDir;
            /* if (isC("followPlayer").checked) {
                let targetPlayerSID = parseInt(getEl("targetSid").value);
                let targetPlayer = findPlayerBySID(targetPlayerSID);
                if (targetPlayer) {
                    if (targetPlayer.dist2 >= (isC("serverSync").checked ? 10 : 135)) {
                        newMoveDir = targetPlayer.aim2;
                    } else {
                        newMoveDir = undefined;
                    }
                }
            } else {*/
            newMoveDir = getMoveDir();
            //   }
            if (newMoveDir == undefined || player.moveDir == null || Math.abs(newMoveDir - player.moveDir) > 0.123) {
                if (!my.autoPush && !macro.l) {
                    packet("9", newMoveDir, 1);
                }
            }
        }

        // BUTTON EVENTS:
        function bindEvents() {}
        bindEvents();

        /** PATHFIND TEST */

        function PathFinder() {

        }
        /** PATHFIND TEST */

        // ITEM COUNT DISPLAY:
        let isItemSetted = [];
        let itemCounter = [];

        var length;

        const itemCount = () => {
            let R = items;
            let E = player;
            let base = [];
            let elements = document.getElementsByClassName("actionBarItem");

            for (let element of elements) {
                if (element.style.display === "inline-block") {
                    const id = Number(element.id.split("Item")[1]);
                    base.push(id);
                }
            }

            length = base.length;

            for (let i = 0; i < base.length; i++) {
                let realIndex = base[i];
                let element = document.getElementById(`actionBarItem${realIndex}`);
                let limit, count;

                if (realIndex >= 19) {
                    let item = R.list[realIndex - 16];
                    limit = window.location.href.includes("sandbox") ? 299 : item.group.limit;
                    count = Math.min(limit, (E.itemCounts[realIndex - 18] || 0));
                } else if (realIndex <= 15) {
                    let reload = E.reloads[realIndex] == 0 ? R.weapons[realIndex].speed : E.reloads[realIndex];
                    limit = R.weapons[realIndex].speed;
                    count = reload;
                } else {
                    limit = 8;
                    count = E.shameCount;
                }

                if (count > 0 || realIndex <= 18) {
                    let counter = itemCounter[realIndex];

                    if (!counter) {
                        counter = itemCounter[realIndex] = document.createElement("canvas");
                        counter.id = "itemCount" + realIndex;
                        counter.classList.add("animated-progress");
                        counter.style.height = "66px";
                        element.appendChild(counter);

                        counter.getContext("2d").translate(68, 66);
                    }

                    updateCounter(counter.getContext("2d"), limit, count, realIndex <= 15, realIndex);
                }
            }
        };

        function updateCounter(ctx, max, current, isWeapon, ID) {
            let R = items;
            let E = player;

            ctx.clearRect(-100, -100, 1000, 1000); // clear the canvas before drawing

            if (isWeapon) {
                let targetReloads = {
                    primary: (E.primaryIndex === undefined ? 1 : ((R.weapons[E.primaryIndex].speed - E.reloads[E.primaryIndex]) / R.weapons[E.primaryIndex].speed)),
                    secondary: (E.secondaryIndex === undefined ? 1 : ((R.weapons[E.secondaryIndex].speed - E.reloads[E.secondaryIndex]) / R.weapons[E.secondaryIndex].speed)),
                };

                if (!E.currentReloads) {
                    E.currentReloads = {
                        primary: targetReloads.primary,
                        secondary: targetReloads.secondary,
                    };
                }

                const lerpFactor = 0.1;
                E.currentReloads.primary = (1 - lerpFactor) * E.currentReloads.primary + lerpFactor * targetReloads.primary;
                E.currentReloads.secondary = (1 - lerpFactor) * E.currentReloads.secondary + lerpFactor * targetReloads.secondary;

                let weapon = ID;
                let primaryInd = (weapon == E.primaryIndex);

                if (E.reloads[weapon] != 0) {
                    ctx.beginPath();
                    ctx.lineWidth = 10;
                    ctx.strokeStyle = "#FFFFFF";
                    ctx.arc(10, 10, 60, 0, (Math.PI * 2 * (primaryInd ? E.currentReloads.primary : E.currentReloads.secondary)) * -1);
                    ctx.stroke();
                }
            } else {
                ctx.beginPath();
                ctx.lineWidth = 10;
                ctx.strokeStyle = "#FFFFFF";
                ctx.arc(0, 0, 60, 0, (Math.PI * 2 * (current / max)));
                ctx.stroke();
            }
        }
        function updateItemCountDisplay(index = undefined) {
            for (let i = 3; i < items.list.length; ++i) {
                let id = items.list[i].group.id;
                let tmpI = items.weapons.length + i;
                if (!isItemSetted[tmpI]) {
                    isItemSetted[tmpI] = document.createElement("div");
                    isItemSetted[tmpI].id = "itemCount" + tmpI;
                    getEl("actionBarItem" + tmpI).appendChild(isItemSetted[tmpI]);

                    isItemSetted[tmpI].style = `
                        display: block;
                        position: absolute;
                        padding-left: 27px;
                        font-size: 1em;
                        color: #fff;
                        `;
                    isItemSetted[tmpI].innerHTML = player.itemCounts[id] || 0;
                } else {
                    if (index == id) isItemSetted[tmpI].innerHTML = player.itemCounts[index] || 0;
                }
            }
        }
        function willIntersectWithSpike(spike) {
            const collisionDistance = player.scale + spike.scale; // Total collision radius

            // Player movement direction components
            const moveDirX = Math.cos(player.moveDir);
            const moveDirY = Math.sin(player.moveDir);

            // Vector from player to spike
            const dx = spike.x - player.x2;
            const dy = spike.y - player.y2;

            // Project the vector (dx, dy) onto the movement direction (moveDirX, moveDirY)
            let projectionLength = dx * moveDirX + dy * moveDirY;

            // Check if the spike is in the forward direction and within 150 units
            if (projectionLength <= 0 || projectionLength > 150) {
                return false; // Spike is behind the player or beyond 150 units
            }

            // Find the closest point on the ray to the spike (clamped to 150 units)
            const closestX = player.x2 + projectionLength * moveDirX;
            const closestY = player.y2 + projectionLength * moveDirY;

            // Calculate the distance from the spike's center to this closest point
            const distanceToSpike = UTILS.getDistance(closestX, closestY, spike.x, spike.y);

            // Check if the distance is within the collision range
            return distanceToSpike <= collisionDistance;
        }
        function safeWalk() {
            my.safeWalk = false;
            if (!isC("safeWalk").checked) return;
            if (isC("safeWalk").options.value == "move") {
                let aspike = nearObjs.find(obj => (obj.dmg && obj.active && !obj.isTeamObject(player) && UTILS.getDist(obj, player, 0, 3) <= obj.scale + player.scale + Math.max(player.scale / 1.5, UTILS.getDist(player, player, 2, 3) / 1.5)) || (obj.type == 1 && obj.y >= 12000 && UTILS.getDist(obj, player, 0, 3) <= obj.scale + player.scale));
                if (aspike) {
                    let spikeDir = UTILS.getDirect(aspike, player, 0, 2);
                    packet("9", spikeDir+Math.PI, 1)
                    my.safeWalk = true;
                }
            } else {
                // Find all nearby spikes
                let spikes = nearObjs.filter(obj =>
                                             obj.dmg && obj.active &&
                                             !obj.isTeamObject(player)
                                            );
                let cactus = nearObjs.filter(obj => obj.type == 1 && obj.y >= 12000);

                for (let spike of spikes) {
                    // Get direction to spike (used for angle checks)
                    if (willIntersectWithSpike(spike)) {

                        // Calculate attack range and collision range
                        let collisionRange = spike.scale + 75;

                        // Check if predicted position collides with the spike
                        let futureDistToSpike = UTILS.getDist(player, spike, 3, 0);
                        if (futureDistToSpike <= collisionRange) {
                            // Stop movement at attack range
                            my.safeWalk = true;
                            packet("9", undefined, 1); // Stop movement
                            break; // No need to check other spikes
                        }
                    }
                }
                for (let cac of cactus) {
                    if (willIntersectWithSpike(cac)) {

                        // Calculate attack range and collision range
                        let collisionRange = player.scale + cac.scale;
                        let futureDistToSpike = UTILS.getDist(player, cac, 3, 0);
                        if (futureDistToSpike <= collisionRange) {
                            // Stop movement at attack range
                            my.safeWalk = true;
                            packet("9", undefined, 1); // Stop movement
                            break; // No need to check other spikes
                        }
                    }
                }
            }
        }
        function antiSpike() {
            if (!enemy.length) return;
            // Analyze trap spikes
            const moreantiSpikeTick = traps.checkSpikeTick();
            if (moreantiSpikeTick[0] > 0) {
                my.predictSpikes += moreantiSpikeTick[0];
                if (!moreantiSpikeTick[1]) {
                    my.anti0Tick = 3;
                    player.chat.message = `PaS detected by ${near.sid} ${near.name}`;
                    sendChat("Why even try? " +near.sid);
                    player.chat.count = 334;
                }
            }

            // Handle anti-spike tick events
            const antiSpikeTick = nearObjs
            .filter(e => e.dmg && e.active && !e.isTeamObject(player) && UTILS.getDist(e, player, 0, 3) <= (e.scale + player.scale));

            if (antiSpikeTick[0] && near.reloads[near.primaryIndex] == 0 && [3, 4, 5].includes(near.primaryIndex) && near.dist2 < 210) {
                my.predictSpikes += antiSpikeTick.length;
                if (player.inTrap) {
                    if (player.reloads[player.weaponIndex] > 0) {
                        my.anti0tick = 1;
                        player.chat.message = `Anti SpikeTick by ${player.name} (${near.sid}`;
                        player.chat.count = 112;
                    }
                } else {
                    my.anti0Tick = 2;
                    player.chat.message = `Anti SpikeTick by ${player.name} (${near.sid})`;
                    sendChat("Wild. " +near.sid);
                    player.chat.count = 334;
                }
            }
        }

        const tryAutoPush = () => {
            if (debugStop || !isC("autoPush").checked || !enemy.length || !near.inTrap) {
                PF.active = false;
                if (my.autoPush) {
                    my.autoPush = false;
                    my.classInsta = true;
                    packet("9", player.moveDir, 1);
                }
                return;
            }
            let spikes = gameObjects.filter(obj => obj.active && (obj.dmg && obj.isTeamObject(player)) && UTILS.getDist(obj, near.inTrap, 0, 0) <= (obj.scale*0.8 + near.inTrap.scale + near.scale));
            if (!spikes.length) {
                PF.active = false;
                if (my.autoPush) {
                    my.autoPush = false;
                    my.classInsta = true;
                    packet("9", player.moveDir, 1);
                }
                return;
            }
            let point = {};
            let nearSpike = spikes[0];
            if (spikes.length == 1) {
                point = {
                    x: nearSpike.x,
                    y: nearSpike.y,
                    scale: nearSpike.scale
                }
            } else {
                let closest = spikes.sort((a, b) => b.health - a.health).sort((a, b) => UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2));
                let spike1 = closest[0];
                let spike2 = closest.filter(e => e.sid != spike1.sid).sort((a, b) => UTILS.getDist(a, spike1, 0, 0) - UTILS.getDist(b, spike1, 0, 0))[0];
                if (spike2) {
                    let midPoint = UTILS.findMiddlePoint(spike1, spike2, 0, 0);
                    if (UTILS.getDist(midPoint, spike1, 0, 0) <= 32 + spike1.scale && UTILS.getDist(midPoint, spike2, 0, 0) <= 32 + spike2.scale) {
                        point = {
                            x: midPoint.x,
                            y: midPoint.y,
                            scale: Math.min(spike1.scale, spike2.scale) * 0.7
                        };
                    } else {
                        point = {
                            x: spike1.x,
                            y: spike1.y,
                            scale: spike1.scale
                        };
                    }
                } else {
                    point = {
                        x: spike1.x,
                        y: spike1.y,
                        scale: spike1.scale
                    };
                }
            }
            if (!point) {
                PF.active = false;
                if (my.autoPush) {
                    my.autoPush = false;
                    packet("9", player.moveDir, 1);
                }
                return;
            }

            let spikeDir = UTILS.getDirect(point, near, 0, 2);
            let trapSpikeDir = UTILS.getDirect(point, near.inTrap, 0, 0);
            let trapSpikeMid = UTILS.findMiddlePoint(point, near.inTrap, 0, 0)
            my.pushData = {
                x: point.x,
                y: point.y
            }

            let decelScale;
            let decel;
            let diffDir;
            let diffCheck;
            let pathScale;
            let pushType;

            let diff = UTILS.getAngleDist(trapSpikeDir, spikeDir);

            if (diff > 0.25 && point.scale >= 20) {
                let myTrapDir = UTILS.getDirect(near.inTrap, player, 0, 2);
                let midPointDir = UTILS.getDirect(trapSpikeMid, near, 0, 2);
                let midPointDist = UTILS.getDist(trapSpikeMid, near, 0, 2);

                decelScale = near.scale * 1.5;
                decel = Math.max(near.scale/1.5, (near.scale + decelScale) - midPointDist);
                diffDir = midPointDir;
                diffCheck = UTILS.getAngleDist(myTrapDir, midPointDir) < 0.5;
                pathScale = decelScale;
                pushType = 1;

            } else {
                let mySpikeDir = UTILS.getDirect(point, player, 0, 2);
                let spikeDist = UTILS.getDist(point, near, 0, 2);

                decelScale = near.scale * 1.5;
                decel = Math.max(near.scale/1.5, (point.scale + near.scale + decelScale) - spikeDist);
                diffDir = spikeDir;
                diffCheck = UTILS.getAngleDist(mySpikeDir, spikeDir) < 0.4;
                pathScale = null;
                pushType = 0;

            }
            my.pushData.x2 = near.x2 - Math.cos(diffDir) * decel;
            my.pushData.y2 = near.y2 - Math.sin(diffDir) * decel;

            if (UTILS.getDist(player, my.pushData, 2, 2) <= 69 && diffCheck) {
                PF.active = false;
                PF.paths = [];
                let dir = UTILS.getDirect({
                    x: near.x2 - Math.cos(diffDir) * decel,
                    y: near.y2 - Math.sin(diffDir) * decel
                }, player, 0, 2);
                packet("9", dir, 1);
                my.autoPush = true;
                //  my.lastStop.active = false;
            } else {
                let toX = near.x2 - Math.cos(diffDir) * (50);
                let toY = near.y2 - Math.sin(diffDir) * (50);
                let builds = gameObjects.filter(
                    (t) => t.active && !t.ignoreCollision
                );
                let serializableBuilds = builds.map(building => ({
                    x: building.x,
                    y: building.y,
                    scale: building.scale
                }));

                worker.postMessage([{x: player.x2, y: player.y2}, {x: toX, y: toY}, serializableBuilds, {x: near.x2, y: near.y2}, true]);
            }
        };
        /*end of pathfinder*/
        //best sync using a glitch server ig
        // WebSocket variable
        let socket = null;
        const serverURL = "wss://beryl-brief-farmhouse.glitch.me"; // Replace with your Glitch WebSocket URL
        let playersInServer = [];
        let syncersInServer = [];
        let reconnectAttempts = 0;
        // Function to open WebSocket connection
        function openSocket() {
            if (!socket || socket.readyState === WebSocket.CLOSED) {
                socket = new WebSocket(serverURL);

                socket.addEventListener('open', () => {
                    reconnectAttempts = 0; // Reset attempts on successful connection
                    console.log("WebSocket connection established.");
                });
                socket.addEventListener('message', (event) => {
                    const data = JSON.parse(event.data);
                    if (data.action === "update") {
                        let otherPlayersData = data.data.filter(playerData => playerData.sid !== player.sid);
                        if (!otherPlayersData) return;
                        playersInServer = otherPlayersData.map(playerData => playerData.sid);
                        syncersInServer = otherPlayersData.filter(playerData => playerData.sync).map(playerData => playerData.sid);
                        /*data.data:

  [
    { "sid": player1_sid, "sync": true/false }
  ],
  [
      { "sid": player2_sid, "sync": true/false }
  ]

  eg:
data.data[0] = { "sid": "player1_sid", "sync": true/false }
data.data[1].sid = player2_sid
also otherPlayersData has everyone except you in the array
oh yea I remove the syncing stuff cuz thats logic for next time :)
*/
                    }
                });

                socket.addEventListener('close', () => {
                    console.log("WebSocket connection closed. Attempting to reconnect...");
                    setTimeout(openSocket, Math.min(1000 * 2 ** reconnectAttempts, 30000)); // Exponential backoff
                    reconnectAttempts++;
                });
            }
        }

        // Function to send player and nearby enemy information to the server
        function sendPlayerInfo() {
            if (socket && socket.readyState === WebSocket.OPEN) {
                const playerInfo = {
                    action: 'update',
                    data: {
                        sid: player.sid, // Your player's unique session ID
                        server: serverID, // Your server ID
                        sync: isC("serverSync").checked // Sync state
                    }
                };
                socket.send(JSON.stringify(playerInfo));
            } else {
                openSocket();
            }
        }
        setInterval(() => {
            if (inGame) {
                sendPlayerInfo();
                for (let i = 0; i < gameObjects.length; i++) {
                    if (gameObjects[i].type == null && !gameObjects[i].active && Date.now - gameObjects[i].breakTime > 5000) {
                        gameObjects.splice(i, 1)
                    }
                }
            }
        }, 8000);

        function toFancyTimeFormat(time) {
            let minutes = ~~((time % 3600) / 60);
            let seconds = ~~time % 60;
            if (seconds <= 9) seconds = `0${seconds}`;
            return `${minutes}:${seconds}`;
        }

        const songs = [
            {audio: new Audio("https://github.com/oe2735/music/raw/refs/heads/main/Headie_One_K-Trap_-_PARK_CHINOIS_(Hydr0.org).mp3"), lyrics: {
'0:01' : "S-R-B separation confirmed",
'0:05' : "Comin' up on, uh,",
'0:06' : "stagin' the burnout of these",
'0:07' : "twin solid rocket boosters at",
'0:09' : "two minutes, five seconds",
'0:14' : "Clean up gang with the hoover,",
'0:16' : "pull up and sweep the street",
'0:17' : "Told bae 'Book Park Chinois',",
'0:18' : "the bricks came cheap",
'0:19' : "this week",
'0:20' : "Brought out da glee this week,",
'0:21' : "so somethin' might end up",
'0:22' : "on a tee this week",
'0:23' : "Done studio time,",
'0:24' : "done the re this week,",
'0:25' : "big bustdown,",
'0:26' : "that ain't no jesus piece",
'0:27' : "No G17, G19, had the G17,",
'0:29' : "then the G19",
'0:30' : "Had a old 44,",
'0:31' : "but the pin was weak,",
'0:32' : "still gonna spin if need",
'0:34' : "Sayin' No smoke backstage,",
'0:35' : "but bro still ask",
'0:36' : "can we bring it please",
'0:37' : "Or a ZK at least",
'0:40' : "You could see me",
'0:41' : "in tape with the Gs,",
'0:42' : "bro just got a",
'0:43' : "strip tape with the G",
'0:44' : "Get the drop, it's go time,",
'0:45' : "bro came out with the key",
'0:47' : "Yo, three-eight autos gang",
'0:49' : "said 'We need more sweets'",
'0:51' : "Before Halloween we was out",
'0:52' : "playin' trick-or-treat",
'0:54' : "An opp boy swam and drowned,",
'0:56' : "he didn't kick his feet",
'0:57' : "Heard that news",
'0:58' : "I was right by the runway,",
'0:59' : "made me feel like bree",
'1:00' : "This C come like",
'1:01' : "a pocket rocket,",
'1:02' : "now the gang",
'1:03' : "in central with C",
'1:04' : "Had my case papers printed,",
'1:05' : "now I got the monogram",
'1:06' : "print on me",
'1:07' : "Runnin' through bells,",
'1:08' : "throwback run with the 12",
'1:10' : "Whole one cover the scales,",
'1:11' : "bine at the barbeque,",
'1:12' : "better cover your girl",
'1:14' : "Hate when theyre",
'1:15' : "runnin' their mouth,",
'1:16' : "see them runnin' for help",
'1:17' : "I'm in the bando,",
'1:18' : "but let me see my man again,",
'1:19' : "I'll double the L",
'1:21' : "We really leave Shit drownin',",
'1:22' : "you ain't bought",
'1:23' : "three on an outin'",
'1:24' : "Shootouts in the",
'1:25' : "oldest clothes,",
'1:26' : "you wouldn't believe",
'1:27' : "these outfits",
'1:28' : "Foot down, no breaks, tryna",
'1:29' : "leave everythin' taped",
'1:30' : "Asked bout the shotty,",
'1:31' : "told them I got it",
'1:32' : "from the farm,",
'1:33' : "now they think I got from H",
'1:34' : "Clean up gang with the hoover,",
'1:35' : "pull up and sweep the street",
'1:37' : "Told bae 'Book Park Chinois',",
'1:38' : "the bricks came",
'1:39' : "cheap this week",
'1:40' : "Brought out the glee",
'1:41' : "this week,",
'1:42' : "so somethin' might end",
'1:42' : "up on a tee this week",
'1:43' : "Done studio time,",
'1:44' : "done the re this week,",
'1:45' : "big bustdown,",
'1:46' : "that ain't no jesus piece",
'1:47' : "No G17, G19, had the G17,",
'1:49' : "then the G19",
'1:50' : "Had a old .44,",
'1:51' : "but the pin was weak,",
'1:52' : "still gonna spin if need",
'1:54' : "Sayin' No smoke backstage,",
'1:55' : "but bro still ask",
'1:56' : "can we bring it please",
'1:57' : "Or a ZK at least",
'2:00' : "This opp in this",
'2:01' : "spliff's sativa,",
'2:02' : "still put smoke in",
'2:03' : "the wiz, Khalifa",
'2:04' : "Bad B don't wanna",
'2:05' : "lock the smoke,",
'2:06' : "I just gotta love",
'2:07' : "her and leave her",
'2:08' : "Yo, had the Liz",
'2:09' : "come like Peter",
'2:10' : "and the bujj like Cleveland",
'2:11' : "This ice on my wrist",
'2:12' : "says a whole lotta money,",
'2:13' : "swear it's comin' like BIA",
'2:14' : "O14 me,",
'2:15' : "Zee had the bruc' back",
'2:16' : "in a bruck down Kia",
'2:17' : "Now you'll find me in Venice,",
'2:18' : "tryin' some shellfish,",
'2:19' : "oh mama mia",
'2:20' : "Old-school, I was hoppin' out",
'2:22' : "first, had bro sayin'",
'2:22' : "Stop bein' selfish",
'2:24' : "Yo, now I just",
'2:25' : "leave that stage,",
'2:26' : "pullin' strings like Elvis",
'2:27' : "Ding-dong on an outin',",
'2:28' : "would've been a loss",
'2:29' : "if we found him",
'2:30' : "Can't record, need more",
'2:31' : "points on the board",
'2:31' : "Gang, tape it first,",
'2:33' : "then I'll give them an album",
'2:34' : "Spoke to the yard man, wanna",
'2:35' : "know the P for the .45,",
'2:36' : "like Alhan",
'2:37' : "Spoke to the runner, said he's",
'2:38' : "got more than a oner and",
'2:39' : "he's still countin'",
'2:40' : "Go get that car, congestion",
'2:42' : "zone, gotta step with ours",
'2:43' : "Pocket rocket,",
'2:44' : "had it in a pouch,",
'2:45' : "next to the brush",
'2:46' : "and the metro card",
'2:47' : "Double R truck, stars in the",
'2:48' : "roof, and we got",
'2:49' : "a separate star",
'2:50' : "Ain't done it in a Tesla yet,",
'2:51' : "if we do that's lead",
'2:52' : "in a electric car",
'2:54' : "Clean up gang with the hoover,",
'2:55' : "pull up and sweep the street",
'2:57' : "Told bae 'Book Park Chinois',",
'2:58' : "the bricks came",
'2:59' : "cheap this week",
'3:00' : "Brought out the",
'3:01' : "glee this week,",
'3:02' : "so somethin' might end",
'3:03' : "up on a tee this week",
'3:04' : "Done studio time,",
'3:05' : "done the re this week,",
'3:06' : "big bustdown,",
'3:07' : "that ain't no jesus piece",
'3:08' : "No G17, G19, had the G17,",
'3:09' : "then the G19",
'3:10' : "Had a old .44,",
'3:11' : "but the pin was weak,",
'3:12' : "still gonna spin if need",
'3:14' : "Sayin' No smoke backstage,",
'3:15' : "but bro still ask",
'3:16' : "can we bring it please",
'3:17' : "Or a ZK at least",
            }},
            {audio: new Audio("https://github.com/oe2735/music/raw/refs/heads/main/Eurobeat_-_Manuel_-_Gas_Gas_Gas_(Hydr0.org).mp3"), lyrics: {
                '0:16' : "Ahhhhh",
                '0:19' : "gas,",
                '0:20' : "Gas,",
                '0:21' : "gas",
                '0:23' : "Ahhhhh",
                '0:28' : "Do you like",
                '0:29' : "My car?",
                '0:31' : "my car",
                '0:32' : "m y  c a r",
                '0:52' : "Guess you're ready",
                '0:53' : "Cause I'm waiting for you",
                '0:55' : "It's gonna be so exciting!",
                '0:58' : "Got this feeling",
                '1:00' : "Really deep in my soul",
                '1:01' : "Let's get out, I wanna go",
                '1:03' : "Come along, get it on!",
                '1:05' : "Gonna take my car",
                '1:07' : "Gonna sit in",
                '1:08' : "Gona drive along till I get you",
                '1:10' : "Cause I'm crazy, hot and ready",
                '1:12' : "But you'll like it!",
                '1:14' : "I wanna race for you!",
                '1:15' : "(Shall I go now?)",
                '1:17' : "Gas Gas Gas!",
                '1:19' : "I'm gonna step on the gas",
                '1:20' : "Tonight I'll fly!",
                '1:22' : "And be your lover",
                '1:23' : "Yeah yeah yeah!",
                '1:25' : "I'll be so quick as a flash",
                '1:27' : "And I'll be your hero",
                '1:29' : "Gas Gas Gas!",
                '1:31' : "I'm gonna run as a flash",
                '1:32' : "Tonight I'll fight!",
                '1:34' : "To be the winner",
                '1:35' : "Yeah yeah yeah!",
                '1:37' : "I'm gonna step on the gas",
                '1:39' : "And you'll see the big show!",
                '1:54' : "Don't be lazy",
                '1:56' : "Cause I'm burning for you",
                '1:57' : "It's like a hot sensation!",
                '2:00' : "Got this power",
                '2:02' : "That is taking me out",
                '2:03' : "Yes, I've got a crush on you",
                '2:05' : "Ready, now",
                '2:06' : "Ready, go!",
                '2:07' : "Gonna take my car",
                '2:09' : "Gonna sit in",
                '2:10' : "Gona drive along til I get you",
                '2:13' : "Cause I'm crazy, hot and ready",
                '2:14' : "But you'll like it!",
                '2:16' : "I wanna race for you!",
                '2:18' : "Shall I go now?",
                '2:19' : "Gas Gas Gas!",
                '2:21' : "I'm gonna step on the gas",
                '2:23' : "Tonight I'll fly!",
                '2:24' : "And be your lover",
                '2:25' : "Yeah yeah yeah!",
                '2:27' : "I'll be so quick as a flash",
                '2:29' : "And I'll be your hero",
                '2:31' : "Gas Gas Gas!",
                '2:33' : "I'm gonna run as a flash",
                '2:35' : "Tonight I'll fight!",
                '2:37' : "To be the winner",
                '2:38' : "Yeah yeah yeah!",
                '2:40' : "I'm gonna step on the gas",
                '2:41' : "And you'll see the big show!",
                '3:09' : "Guess you're ready",
                '3:10' : "Cause I'm waiting for you",
                '3:12' : "It's gonna be so exciting!",
                '3:15' : "Got this feeling",
                '3:17' : "Really deep in my soul",
                '3:18' : "Let's get out, I wanna go",
                '3:20' : "Come along, get it on",
                '3:22' : "Gonna take my car",
                '3:23' : "Do you like my car?",
                '3:28' : "Cause I'm crazy, hot and ready",
                '3:30' : "But you'll like it!",
                '3:31' : "I wanna race for you!",
                '3:33' : "Shall I go now?",
                '3:34' : "Gas Gas Gas!",
                '3:37' : "I'm gonna step on the gas",
                '3:39' : "Tonight I'll fly!",
                '3:41' : "And be your lover",
                '3:42' : "Yeah yeah yeah!",
                '3:43' : "I'll be so quick as a flash",
                '3:45' : "And I'll be your hero",
                '3:48' : "Gas Gas Gas!",
                '3:50' : "I'm gonna run as a flash",
                '3:51' : "Tonight I'll fight!",
                '3:53' : "To be the winner",
                '3:54' : "Yeah yeah yeah!",
                '3:56' : "I'm gonna step on the gas",
                '3:58' : "And you'll see the big show!",
                '4:01' : "Gas Gas Gas!",
                '4:04' : "Yeah yeah yeah!",
                '4:07' : "Gas Gas Gas!",
                '4:10' : "And you'll see the big show!",
                '4:27' : "Ahhhhh",
            }},
            {audio: new Audio("https://github.com/oe2735/music/raw/refs/heads/main/verbatim_-_mother_mother_(Hydr0.org).mp3"), lyrics: {
                '0:13' : "Oh, oh",
                '0:14' : "Yeah, yeah",
                '0:16' : "Oh, oh",
                '0:17' : "Yeah, yeah, oh",
                '0:19' : "Oh, oh",
                '0:20' : "Yeah, yeah",
                '0:22' : "Oh, oh",
                '0:25' : "I wear women's underwear",
                '0:27' : "And then I go to strike a pose",
                '0:29' : "In my full length mirror",
                '0:30' : "I cross my legs",
                '0:31' : "Just like a queer",
                '0:33' : "But my libido is strong",
                '0:34' : "When a lady is near, yeah",
                '0:36' : "What defines",
                '0:37' : "A straight man's straight?",
                '0:39' : "Is it the boxer in the briefs",
                '0:41' : "Or a 12 ounce steak? Nah",
                '0:43' : "I tell you what a women",
                '0:44' : "Loves most",
                '0:45' : "It's a man who can slap",
                '0:47' : "But can also stroke",
                '0:49' : "Goin' in the wind is an eddy",
                '0:51' : "Of the truth and it's naked",
                '0:52' : "It's verbatim",
                '0:53' : "And it's shakin'",
                '0:56' : "No, no, no, no, no, no,",
                '0:58' : "no, no, no, no, no,",
                '0:59' : "no more gettin' elated",
                '1:00' : "No more listless invitations",
                '1:05' : "URGH",
                '1:06' : "I live by a hospital",
                '1:08' : "And every day",
                '1:10' : "I go out walking past",
                '1:11' : "It's sickly windows",
                '1:12' : "I see people dying there",
                '1:15' : "But my tender age",
                '1:16' : "Makes it hard to care",
                '1:18' : "The incinerator and",
                '1:19' : "A big smoke stack",
                '1:21' : "It's a phallic symbol and",
                '1:23' : "It makes me laugh",
                '1:24' : "All I need is a heart attack",
                '1:27' : "C'mon, humble my bones",
                '1:28' : "With a cardiac",
                '1:31' : "Goin' in the wind is an eddy",
                '1:33' : "Of the truth and it's naked",
                '1:35' : "It's verbatim and it's shakin'",
                '1:38' : "No, no, no, no, no, no,",
                '1:39' : "no, no, no, no, no,",
                '1:42' : "no more gettin' elated",
                '1:43' : "No more listless invitations",
                '1:47' : "For the love of Fuck",
                '1:49' : "For the sake of Pete",
                '1:50' : "Did you ever really think",
                '1:52' : "You'd love a guy like me?",
                '1:53' : "I am the rooster in the mornin",
                '1:55' : "I'm the Cock of the day",
                '1:57' : "I'm the boxer in the briefs",
                '1:58' : "I'm a 12 ounce steak",
                '2:00' : "Ayy-oh, Ayy-oh, Ayy-oh, Hey-oh",
                '2:06' : "Yeah-bo, yeah-bo, yeah-bo,",
                '2:11' : "yeah-bo, yeah-bo",
                '2:15' : "It's verbatim",
                '2:17' : "And yeah, and it's naked",
                '2:19' : "And yeah, and it's shakin'",
                '2:22' : "It shakes, shakes, shakes",
                '2:25' : "Oh-oh, yeah-yeah,",
                '2:29' : "oh-oh, yeah-yeah-oh",
                '2:31' : "Oh-oh, yeah-yeah,",
                '2:34' : "oh-oh, yeah-yeah-oh",
                '2:37' : "Oh-oh, yeah-yeah,",
                '2:40' : "oh-oh, yeah-yeah-oh",
                '2:43' : "Oh-oh, yeah-yeah",
            }},
            {audio: new Audio("https://ncs.io/track/download/3db2d7b2-fe13-4063-a618-a29eca83f45f?_gl=1*1we4mwn*_up*MQ..*_ga*MTgxNjU2NDI0MC4xNzMwMTYzNTE0*_ga_PFS54FR7NV*MTczMDE2MzUxNC4xLjAuMTczMDE2MzUxNC4wLjAuMA.."), lyrics: {
                '0:03' : "Baby, this is do or die",
                '0:06' : "Feel it in my veins at night",
                '0:08' : "Emotional suicide",
                '0:11' : "You know it's an eye for eye",
                '0:13' : "I didn't wanna walk,",
                '0:15' : "didn't wanna walk the plank",
                '0:19' : "No,",
                '0:20' : "but then ready or not,",
                '0:21' : "then ready or not it came",
                '0:23' : "Like the thunder,",
                '0:24' : "I was on my way to going under",
                '0:26' : "(under)",
                '0:27' : "Swimming in the pain,",
                '0:28' : "yeah, I was covered",
                '0:30' : "In a tidal wave,",
                '0:32' : "in a tidal wave",
                '0:33' : "But I'm a fighter",
                '0:34' : "(hu)",
                '0:35' : "Tryna take me down,",
                '0:36' : "I'm going higher",
                '0:37' : "(I'm higher)",
                '0:38' : "Baby, you've been playing",
                '0:39' : "with some fire",
                '0:40' : "(you've playing)",
                '0:41' : "You've been playing with fire",
                '0:42' : "(playing with fire)",
                '0:43' : "One day you will see",
                '0:46' : "What you made of me",
                '0:48' : "Found my inner beast",
                '0:49' : "(inner beast)",
                '0:51' : "You'll watch it release",
                '0:53' : "In the dead of night",
                '1:05' : "In the dead of night",
                '1:10' : "In the dead of",
                '1:14' : "  Night  ",
                '1:18' : "Baby, when it's do or die",
                '1:19' : "(when it's do or die)",
                '1:20' : "You know it's an eye for eye",
                '1:22' : "(it's an eye for eye)",
                '1:23' : "Feel the energy align",
                '1:25' : "(oh)",
                '1:26' : "In the dead of night",
                '1:27' : "you've been playing with fire",
                '1:28' : "In the dead of night,",
                '1:31' : "In the dead of night",
                '1:33' : "(in the dead of night)",
                '1:37' : "In the dead of night",
                '1:50' : "You can save your alibi",
                '1:52' : "I already know you lied",
                '1:55' : "Oh no, no don't even try",
                '1:57' : "(don't even try)",
                '1:58' : "Watch the flame in me ignite",
                '2:00' : "You didn't wanna walk,",
                '2:02' : "didn't wanna walk the plank",
                '2:05' : "But then ready or not,",
                '2:07' : "then ready or not it came",
                '2:09' : "Baby, it was dark",
                '2:10' : "It was hard to see",
                '2:12' : "And that's when a spark",
                '2:14' : "lit inside of me,",
                '2:16' : " Oh ",
                '2:17' : "I was lost in reverie,",
                '2:19' : "Oh-oh, oh-oh",
                '2:22' : "One day you will see",
                '2:23' : "(you will see)",
                '2:24' : "What you made of me",
                '2:27' : "What's inside of me",
                '2:28' : "(what's inside of me)",
                '2:30' : "Oh, one day you will see",
                '2:35' : "I found my inner beast",
                '2:37' : "(I found my inner beast)",
                '2:38' : "You'll watch it release",
                '2:41' : "In the dead of night, oh",
                '2:51' : "In the dead of night",
                '2:55' : "(In the dead of)",
                '2:57' : "In the dead of night, oh-woah",
                '3:03' : "In the dead of night",
                '3:05' : "Baby, when it's do or die",
                '3:07' : "You know it's an eye for eye",
                '3:10' : "Feel the energy align",
                '3:12' : "In the dead of night",
                '3:16' : " In the dead of night ",
                '3:18' : "  In the dead of night  ",
                '3:21' : "   In the dead of night   ",
                '3:23' : "    In the dead of night    ",
                '3:26' : "And one day you will see",
                '3:28' : "What you made of me",
                '3:31' : "What's inside of me",
                '3:35' : "Oh, and one day you will see",
                '3:39' : "I found my inner beast",
                '3:42' : "And you'll watch it release",
            }},
            {audio: new Audio("https://github.com/oe2735/music/raw/refs/heads/main/I_See_a_Dreamer_Dream_Team_Original_Song_-_CG5_(Hydr0.org).mp3"), lyrics: {
'0:07' : "As the wind whips 'round",
'0:10' : "I take a breath for victory",
'0:15' : "Wanna play tag,",
'0:16' : "or wave your white flag?",
'0:17' : "'Cause you'll never touch me",
'0:22' : "King of hearts, all in",
'0:24' : "(all in)",
'0:25' : "It's not a sin to wanna win",
'0:27' : "(sin to wanna win)",
'0:29' : "Cant see me",
'0:31' : "Flying like a bee,",
'0:32' : "black and yellow energy",
'0:34' : "Only me on my team,",
'0:36' : "naturallyy~",
'0:38' : "I see a dreamer",
'0:39' : "Over there by the water",
'0:41' : "But I got no,",
'0:42' : "but I got no",
'0:43' : "Kakorrhaphiophobia",
'0:45' : "I see a dreamer",
'0:47' : "And he's ripe for",
'0:48' : "the slaughter",
'0:49' : "But I got no,",
'0:50' : "but I got no",
'0:51' : "Kakorrhaphiophobia",
'0:53' : "Phobia,",
'0:54' : "phobia,",
'0:55' : "p h o b i a",
'0:56' : "ow",
'0:57' : "I hear battalions sing",
'0:58' : "of my demise",
'0:59' : "But I don't know the words",
'1:01' : "(what?)",
'1:01' : "I take a road of my own making",
'1:03' : "On a journey, no returning",
'1:04' : "Whoa,",
'1:05' : "whoa",
'1:06' : "That's how",
'1:07' : "it goes",
'1:08' : "They've drawn the battle line",
'1:10' : "And I see fire in their eyes",
'1:12' : "Na na na na na na",
'1:14' : "I'm better off not listening",
'1:15' : "Huh",
'1:16' : "Na na na na na na",
'1:17' : "I've got my own song to sing",
'1:20' : "We're flying like a bee,",
'1:21' : "black and yellow energy",
'1:23' : "Only me on my team,",
'1:25' : "naturallyyy",
'1:27' : "Yeah~",
'1:28' : "I see a dreamer",
'1:29' : "Over there by the water",
'1:31' : "But I got no,",
'1:32' : "but I got no",
'1:33' : "Kakorrhaphiophobia",
'1:35' : "I see a dreamer",
'1:37' : "And hes ripe for the slaughter",
'1:39' : "But I got no,",
'1:40' : "but I got no",
'1:41' : "Kakorrhaphiophobia",
'1:43' : "Phobia,",
'1:44' : "phobia,",
'1:45' : "  phobia  ",
'1:47' : "(Phobia)",
'1:52' : "Ooh",
'1:59' : "My boat is full,",
'2:01' : "why don't you swim?",
'2:02' : "Enjoy my fortress,",
'2:04' : "I'll be right in",
'2:06' : "I stare a hole through",
'2:08' : "danger's soul",
'2:10' : "We all know",
'2:11' : "I can do this, eyes closed",
'2:17' : "I refuse to fail",
'2:19' : "So heed this cautionary tale",
'2:24' : "You've got dragons,",
'2:25' : "my little friend",
'2:26' : "You'll conquer them in the end",
'2:30' : "If you can, ahahahahaha",
'2:31' : "(jump in)",
'2:32' : "I see a dreamer",
'2:33' : "Over there by the water",
'2:36' : "Oh, but I got no,",
'2:37' : "but I got no",
'2:38' : "Kakorrhaphiophobia",
'2:40' : "I see a dreamer",
'2:41' : "And hes ripe for the slaughter",
'2:43' : "Oh, but I got no,",
'2:44' : "but I got no",
'2:45' : "Kakorrhaphiophobia",
'2:48' : "Phobia,",
'2:49' : "phobia,",
'2:50' : "pHoBiA",
'2:51' : "(Oh)",
'3:03' : "Phobia,",
'3:04' : "phobia,",
'3:05' : "PhObIa",
            }},
            {audio: new Audio("https://github.com/oe2735/music/raw/refs/heads/main/Gigi_Perez_-_Sailor_Song_(Hydr0.org).mp3"), lyrics: {
                '0:25' : "I saw her in the rightest way",
'0:30' : "Looking like Anne Hathaway",
'0:35' : "Laughing while she hit her pen",
'0:40' : "And coughed,",
'0:42' : "and coughed",
'0:45' : "And then,",
'0:46' : "she came up to my knees",
'0:50' : "Begging, baby,",
'0:53' : "would you please?",
'0:55' : "Do the things you said",
'0:59' : "you'd do to me, to me",
'1:05' : "Oh, won't you kiss me on the",
'1:07' : "mouth and love me",
'1:08' : "like a sailor?",
'1:10' : "And when you get a taste, can",
'1:13' : "you tell me what's my flavor?",
'1:15' : "I don't believe in God, but I",
'1:18' : "believe that you're my savior",
'1:20' : "My mom says that shes worried,",
'1:23' : "but I'm covered in this favor",
'1:25' : "And when we're getting dirty,",
'1:27' : "I forget all that is wrong",
'1:30' : "I sleep so I can see you",
'1:33' : "'cause I hate to wait so long",
'1:36' : "I sleep so I can see you",
'1:38' : "and I hate to wait so long",
'1:46' : "She took my fingers",
'1:48' : "to her mouth",
'1:51' : "The kind of thing",
'1:53' : "that makes you proud",
'1:56' : "That nothing else had ever",
'2:00' : "Worked out,",
'2:03' : "worked out",
'2:06' : "And lately,",
'2:07' : "I've tried other things",
'2:11' : "But nothing can",
'2:13' : "capture the sting",
'2:16' : "Of the venom she's",
'2:20' : "gonna spit out right now",
'2:26' : "Oh, won't you kiss me on the",
'2:27' : "mouth and love me",
'2:29' : "like a sailor?",
'2:31' : "When you get a taste, can you",
'2:34' : "tell me what's my flavor?",
'2:36' : "I don't believe in God, but I",
'2:39' : "believe that you're my savior",
'2:41' : "I know that u've been worried,",
'2:43' : "but youre dripping in my favor",
'2:46' : "And when we're getting dirty,",
'2:48' : "I forget all that is wrong",
'2:51' : "I sleep so I can see you",
'2:54' : "'cause I hate to wait so long",
'2:56' : "I sleep so that I can see you",
'2:59' : "and I hate to wait so long",
'3:07' : "And we can run away to the",
'3:10' : "walls inside your house",
'3:12' : "I can be the cat, baby,",
'3:15' : "you can be the mouse",
'3:17' : "And we can laugh off things",
'3:19' : "that we know nothing about",
'3:22' : "We can go forever until",
'3:24' : "you wanna sit it out"
            }},
            {audio: new Audio("https://github.com/oe2735/music/raw/refs/heads/main/he_Living_Tombstone_-_My_Ordinary_Life_(Hydr0.org).mp3"), lyrics: {
                '0:30' : "They tell me keep it simple,",
                '0:31' : "I tell them take it slow",
                '0:32' : "I feed and water an idea,",
                '0:33' : "so I let it grow",
                '0:35' : "I tell them take it easy,",
                '0:36' : "they laugh and tell me no",
                '0:37' : "It's cool, but I dont see them",
                '0:38' : "laughin' at my money, though",
                '0:40' : "They spittin' facts at me,",
                '0:41' : "Im spittin' tracks, catch me?",
                '0:43' : "Im spinnin gold out my records",
                '0:44' : "know you can't combat me",
                '0:45' : "They tell me, Jesus walks,",
                '0:47' : "I tell them, money talks",
                '0:48' : "Bling got me chill, 'cause im",
                '0:49' : "living in an icebox",
                '0:51' : "They tell me I've been sleepin",
                '0:52' : "I say im wide awake",
                '0:53' : "Tracks hot and ready so they,",
                '0:54' : "call me Mr. Easy-Bake",
                '0:56' : "They say the grass is greener,",
                '0:57' : "I think my grass is dank",
                '0:58' : "Drivin' with a drank on an",
                '0:59' : "empty tank to the bank",
                '1:02' : "Do you feel me? Take a look,",
                '1:03' : "inside my brain",
                '1:04' : "The people always different,",
                '1:05' : "but it always feels the same",
                '1:07' : "That's the real me, pop the",
                '1:08' : "champagne",
                '1:09' : "The haters wanna hurt me,",
                '1:10' : "and im laughin' at the pain",
                '1:12' : "Stayin' still, eyes closed",
                '1:14' : "Let the world just pass me by,",
                '1:17' : "Pain pills, nice clothes",
                '1:20' : "If I fall, I think I'll fly",
                '1:23' : "Touch me, Midas",
                '1:25' : "Make me part of your design",
                '1:28' : "None to, guide us",
                '1:30' : "I feel fear",
                '1:31' : "for the very last time",
                '1:54' : "They tell me that im special,",
                '1:56' : "I smile and shake my head",
                '1:57' : "I'll give them stories to tell,",
                '1:58' : "friends bout the things I said",
                '2:00' : "They tell me im so humble,",
                '2:01' : "I say im turning red",
                '2:02' : "They let me lie to them",
                '2:03' : "and dont feel like",
                '2:04' : "they've been misled",
                '2:05' : "They give so much to me,",
                '2:06' : "Im losing touch, get me?",
                '2:07' : "Served on a silver platter,",
                '2:08' : "ask for seconds,",
                '2:09' : "they just let me",
                '2:10' : "They tell me im a god,",
                '2:11' : "Im lost in the facade",
                '2:13' : "Six feet off the ground at all",
                '2:14' : "times, I think im feelin' odd",
                '2:15' : "No matter what I make,",
                '2:17' : "they never see mistakes",
                '2:18' : "Makin' so much bread,",
                '2:19' : "I don't care that",
                '2:20' : "they're just fake",
                '2:21' : "They tell me they're below me,",
                '2:22' : "I act like im above",
                '2:23' : "The people blend together,",
                '2:24' : "but I'd be lost",
                '2:25' : "without their love",
                '2:26' : "Can you heal me?",
                '2:27' : "Have I gained too much?",
                '2:29' : "When you become untouchable,",
                '2:30' : "you're unable to touch",
                '2:31' : "Is there a real me?",
                '2:32' : "Pop the champagne",
                '2:34' : "It hurts me just to think,",
                '2:35' : "and I don't do pain",
                '2:37' : "Stayin' still, eyes closed,",
                '2:39' : "Let the world just pass me by",
                '2:42' : "Pain pills, nice clothes,",
                '2:44' : "If I fall, I think I'll fly",
                '2:47' : "Touch me, Midas,",
                '2:50' : "Make me part of your design,",
                '2:53' : "None to guide us,",
                '2:55' : "I feel fear",
                '2:56' : "for the very last time",
                '2:58' : "Lay still, restless,",
                '3:00' : "Losing sleep while",
                '3:01' : "I lose my mind",
                '3:03' : "All thrill, no stress,",
                '3:06' : "All my muses left behind",
                '3:09' : "World is below,",
                '3:11' : "So high up, im near-divine",
                '3:14' : "Lean in, let go,",
                '3:16' : "I feel fear",
                '3:17' : "for the very last time"
            }},
            {audio: new Audio("https://github.com/oe2735/music/raw/refs/heads/main/dont_stand_so_close_to_me_-_initial_d_(Hydr0.org).mp3"), lyrics: {
                '0:04' : "Ooh-ooh-ooh",
                '0:07' : "I will be good",
                '0:18' : "We'll be together",
                '0:19' : "'til the morning light",
                '0:21' : "Don't stand so,",
                '0:23' : "don't stand so,",
                '0:24' : "Don't stand so close to me",
                '0:39' : "Baby, you belong to me",
                '0:42' : "Yes, you do, yes, you do",
                '0:44' : "you're my affection",
                '0:46' : "I can make you wanna cry",
                '0:48' : "Yes, I do, yes, I do",
                '0:50' : "I will be good",
                '0:52' : "You're like a cruel device",
                '0:54' : "your blood is cold like ice",
                '0:55' : "Poison for my veins",
                '0:56' : "I'm breaking my chains",
                '0:58' : "One look and you can kill",
                '0:59' : "my pain now is your thrill",
                '1:01' : "Your love is for me",
                '1:03' : "I say, try me",
                '1:05' : "take a chance on emotions",
                '1:07' : "For now and ever",
                '1:08' : "close to your heart",
                '1:10' : "I say, try me",
                '1:11' : "take a chance on my passion",
                '1:13' : "We'll be together all the time",
                '1:16' : "I say, try me",
                '1:17' : "take a chance on emotions",
                '1:20' : "For now and ever",
                '1:21' : "into my heart",
                '1:22' : "I say, try me",
                '1:23' : "take a chance on my passion",
                '1:26' : "We'll be together",
                '1:27' : "'til the morning light",
                '1:29' : "Don't stand so,",
                '1:30' : "don't stand so,",
                '1:32' : "Don't stand so close to me",
                '1:47' : "Baby, let me take control",
                '1:50' : "Yes, I do, yes, I do",
                '1:52' : "you are my target",
                '1:53' : "No one ever made me cry",
                '1:56' : "What you do, what you do",
                '1:58' : "baby's so bad",
                '2:00' : "You're like a cruel device",
                '2:01' : "your blood is cold like ice",
                '2:03' : "Poison for my veins",
                '2:04' : "I'm breaking my chains",
                '2:06' : "One look and you can kill",
                '2:07' : "my pain now is your thrill",
                '2:09' : "Your love is for me",
                '2:11' : "I say, try me",
                '2:13' : "take a chance on emotions",
                '2:15' : "For now and ever",
                '2:16' : "close to your heart",
                '2:17' : "I say, try me",
                '2:19' : "take a chance on my passion",
                '2:21' : "We'll be together all the time",
                '2:23' : "I say, try me",
                '2:25' : "take a chance on emotions",
                '2:27' : "For now and ever",
                '2:28' : "into my heart",
                '2:29' : "I say, try me",
                '2:31' : "take a chance on my passion",
                '2:33' : "We'll be together",
                '2:34' : "'til the morning light",
                '2:37' : "Don't stand so,",
                '2:38' : "don't stand so,",
                '2:40' : "Don't stand so close to me",
                '3:07' : "I say, try me",
                '3:08' : "take a chance on emotions",
                '3:10' : "For now and ever",
                '3:11' : "close to your heart",
                '3:13' : "I say, try me",
                '3:14' : "take a chance on my passion",
                '3:17' : "We'll be together all the time",
                '3:19' : "I say, try me",
                '3:20' : "take a chance on emotions",
                '3:23' : "For now and ever",
                '3:24' : "into my heart",
                '3:25' : "I say, try me",
                '3:26' : "take a chance on my passion",
                '3:29' : "We'll be together",
                '3:30' : "'til the morning light",
                '3:32' : "Don't stand so,",
                '3:34' : "don't stand so,",
                '3:35' : "Don't stand so close to me",
                '3:50' : "Try me",
                '3:51' : "take a chance on emotions",
                '3:53' : "For now and ever",
                '3:54' : "close to your heart",
                '3:55' : "I say, try me",
                '3:56' : "take a chance on my passion",
                '3:59' : "We'll be together all the time",
                '4:02' : "I say, try me",
                '4:03' : "take a chance on emotions",
                '4:06' : "For now and ever",
                '4:07' : "into my heart",
                '4:08' : "I say, try me",
                '4:09' : "take a chance on my passion",
                '4:12' : "We'll be together",
                '4:13' : "'til the morning light",
                '4:15' : "Don't stand so,",
                '4:17' : "don't stand so,",
                '4:18' : "Don't stand so close to me",
            }},
            {audio: new Audio("https://github.com/oe2735/music/raw/refs/heads/main/The_LEGO_Movie_-_Everything_is_awesome_(Hydr0.org).mp3"), lyrics: {
                '0:01' : "Everything is awesome",
                '0:03' : "Everything is cool when",
                '0:05' : "you're part of a team",
                '0:07' : "Everything is awesome",
                '0:10' : "When you're living out a dream",
                '0:15' : "Everything is better when",
                '0:16' : "we stick together",
                '0:21' : "Side by side, you and I",
                '0:23' : "are gonna win forever,",
                '0:25' : "let's party forever",
                '0:28' : "We're the same, I'm like you,",
                '0:29' : "you're like me",
                '0:30' : "We are working in harmony",
                '0:33' : "Everything is awesome",
                '0:36' : "Everything is cool when you're",
                '0:38' : "part of a team",
                '0:40' : "Everything is awesome",
                '0:43' : "When you're living out a dream",
                '0:45' : "(Woooo! Three, two, one, go!)",
                '0:46' : "Have you heard the news?",
                '0:47' : "Everyone's talkin'",
                '0:48' : "Life is good 'cause",
                '0:49' : "everything's awesome",
                '0:50' : "Lost my job, there's",
                '0:51' : "a new opportunity",
                '0:52' : "More free time for",
                '0:53' : "my awesome community",
                '0:54' : "I feel more awesome than an",
                '0:55' : "awesome possum",
                '0:56' : "Dip my body in",
                '0:57' : "chocolate frostin'",
                '0:58' : "Three years later,",
                '0:59' : "wash off the frostin'",
                '1:00' : "Smellin' like a blossom,",
                '1:01' : "everything is awesome",
                '1:02' : "Stepped in mud,",
                '1:03' : "got new brown shoes",
                '1:04' : "It's awesome to win, and it's",
                '1:05' : "awesome to lose",
                '1:08' : "Everything is better when",
                '1:09' : "we stick together",
                '1:14' : "Side by side, you and I",
                '1:15' : "are gonna win forever,",
                '1:17' : "let's party forever",
                '1:21' : "We're the same, I'm like you,",
                '1:22' : "you're like me",
                '1:23' : "We are working in harmony",
                '1:28' : "Everything is awesome",
                '1:31' : "Everything is cool when",
                '1:32' : "you're part of a team",
                '1:34' : "Everything is awesome",
                '1:37' : "When you're living out a dream",
                '1:40' : "Blue skies, bouncy springs",
                '1:41' : "We just named",
                '1:42' : "two awesome things",
                '1:43' : "A Nobel prize,",
                '1:44' : "a piece of string",
                '1:45' : "You know what's awesome?",
                '1:46' : "Everything!",
                '1:47' : "Dogs with fleas, allergies",
                '1:48' : "A book of Greek antiquities",
                '1:50' : "Brand new pants,",
                '1:51' : "a very old vest",
                '1:52' : "Awesome items are the best",
                '1:53' : "Trees, frogs, clogs,",
                '1:56' : "they're awesome",
                '1:57' : "Rocks, clocks, and socks,",
                '1:59' : "they're awesome",
                '2:00' : "Figs, and jigs, and twigs,",
                '2:02' : "that's awesome",
                '2:03' : "Everything you see or think",
                '2:05' : "or say is awesome",
                '2:27' : "Everything is awesome",
                '2:30' : "Everything is cool when you're",
                '2:32' : "part of a team",
                '2:33' : "Everything is awesome",
                '2:36' : "When you're living out a dream",
            }},
            {audio: new Audio("https://github.com/oe2735/music/raw/refs/heads/main/Quaceda%20candles%20on%20fire.m4a"), lyrics: {
                '0:25' : "Woke up feeling mad today",
                '0:26' : "Bitch, im ugly, but",
                '0:27' : "I act like Timmy Chalamet, uh",
                '0:28' : "I hate these motherFuckers",
                '0:29' : "so, so much",
                '0:30' : "Why I keep on tryna get em",
                '0:31' : "all to validate me?",
                '0:32' : "Its no help, im living like,",
                '0:33' : "Oh well",
                '0:34' : "Like my English teacher said,",
                '0:35' : "had to show em, I dont tell",
                '0:36' : "I show em I dont fail,",
                '0:37' : "they knowin me so well",
                '0:38' : "I been catchin all the shade",
                '0:39' : "they've been throwin im, Odell",
                '0:41' : "Turn the cameras on",
                '0:42' : "Quick water break",
                '0:43' : "in the marathon",
                '0:44' : "Walk in your room",
                '0:45' : "and I set the mood",
                '0:46' : "They aint gotta light the",
                '0:47' : "MotherFuckin candles on fire",
                '0:48' : "Cant see without da cameras on",
                '0:49' : "Without a platform",
                '0:50' : "to be standin on, uh",
                '0:51' : "All this baggage",
                '0:52' : "going over they heads",
                '0:53' : "So I keep it underneath",
                '0:54' : "how I carry on, ooh",
                '0:56' : "Im goin crazy",
                '0:58' : "Too hot for Milan,",
                '0:59' : "had to add the AC (Woo)",
                '1:00' : "Guess whats gettin",
                '1:01' : "to em lately?",
                '1:02' : "They been takin shots at a boy",
                '1:03' : "I just say Cheese!",
                '1:04' : "I smell the green,",
                '1:05' : "thats synesthesia",
                '1:06' : "Growin up, im already",
                '1:07' : "too old for Chris D'Elia",
                '1:08' : "They tryna run they mouth,",
                '1:09' : "checkin in on that big career",
                '1:10' : "and look, its nada",
                '1:11' : "Voila, it disappeared, ok, ayy",
                '1:12' : "These sparks are fickle",
                '1:13' : "and simple-minded",
                '1:14' : "Flashlight in the dark",
                '1:15' : "how people gon get behind em",
                '1:16' : "I never killed my ego,",
                '1:17' : "its trippin on psilocybin",
                '1:18' : "That Shit'll kill me inside if",
                '1:19' : "they hear it and never mind-it",
                '1:20' : "Ive been gassed up, thats why",
                '1:21' : "they dont hold a candle to me",
                '1:22' : "Masked up way before",
                '1:23' : "it was a standard duty",
                '1:24' : "Back up, I came in this Shit",
                '1:25' : "Put my sticks in the ground so",
                '1:26' : "I sorry but you cant remove me",
                '1:28' : "Turn the cameras on",
                '1:30' : "Quick water break",
                '1:31' : "in the marathon",
                '1:32' : "Walk in your room",
                '1:33' : "and I set the mood",
                '1:34' : "They aint gotta light the",
                '1:35' : "MotherFuckin candles on fire",
                '1:36' : "Cant see without da cameras on",
                '1:37' : "Without a platform",
                '1:38' : "to be standin on, uh",
                '1:39' : "All this baggage",
                '1:40' : "going over they heads",
                '1:41' : "So I keep it underneath",
                '1:42' : "how I carry on, ooh",
                '1:47' : "They put the red dot",
                '1:48' : "right back on his head",
                '1:49' : "In fact, it never left",
                '1:50' : "Fuck a gold plaque,",
                '1:51' : "I want platinum instead, uh",
                '1:53' : "It wont matter no less",
                '1:54' : "All my nights sleepless,",
                '1:55' : "but my dreams still vivid",
                '1:56' : "Hole getting deeper,",
                '1:57' : "but the team still winnin",
                '1:58' : "Let me look around,",
                '1:59' : "like will you please love me?",
                '2:00' : "End up in the ground,",
                '2:01' : "will they still think of me",
                '2:02' : "Where they stil feel something",
                '2:03' : "Aint nobody laughing,",
                '2:04' : "but it still feels funny to me",
                '2:05' : "Its all a game, all these",
                '2:06' : "people just a number to me",
                '2:07' : "And what could it be?",
                '2:08' : "No matter how I feel you could",
                '2:09' : "bet I give em somethin to see",
                '2:10' : "Whats the price of",
                '2:11' : "living comfortably?",
                '2:12' : "All these numbers mind numbing",
                '2:13' : "to me, its nothin to me",
                '2:14' : "Get my pants tailored",
                '2:15' : "with the big pockets",
                '2:16' : "I dont give em much room",
                '2:17' : "when they Shit talkin, ayy",
                '2:19' : "Turn the cameras on",
                '2:20' : "Quick water break",
                '2:21' : "in the marathon",
                '2:22' : "Walk in your room",
                '2:23' : "and I set the mood",
                '2:24' : "They aint gotta light the",
                '2:25' : "MotherFuckin candles on fire",
                '2:26' : "Cant see without da cameras on",
                '2:27' : "Without a platform",
                '2:28' : "to be standin on, uh",
                '2:39' : "All this baggage",
                '2:30' : "going over they heads",
                '2:31' : "So I keep it underneath",
                '2:32' : "how I carry on, ooh",
                '2:36' : "Turn the cameras on",
                '2:38' : "Walk in your room",
                '2:39' : "and I set the mood",
                '2:41' : "They aint gotta light the",
                '2:42' : "MotherFuckin candles on fire",
                '2:44' : "Cameras on",
                '2:45' : "Without a platform",
                '2:46' : "to be standing on",
                '2:47' : "All this baggage",
                '2:48' : "going over they heads",
                '2:49' : "So I keep it underneath",
                '2:50' : "how I carry on, ooh",
                '2:55' : "The route up the ice ridge",
                '2:57' : "was hard but safe",
                '2:58' : "Boyson could watch the",
                '2:59' : "avalanches go by and",
                '3:00' : "even enjoy the view",
            }},
            {audio: new Audio("https://github.com/oe2735/music/raw/refs/heads/main/Enemy_-_Imagine_Dragons_(Hydr0.org).mp3"), lyrics: {
                '0:04' : "Look out for youself",
                '0:07' : "I wake up to the sounds",
                '0:08' : "of the silence that allows",
                '0:10' : "For my mind to run around",
                '0:12' : "with my ear up to the ground",
                '0:13' : "I'm searching to behold",
                '0:14' : "the stories that are told",
                '0:16' : "When my back is to the world",
                '0:18' : "that was smiling when I turned",
                '0:20' : "Tell you you're the greatest",
                '0:26' : "But once you turn they hate us",
                '0:33' : "Oh, the misery",
                '0:35' : "Everybody wants to be my enemy",
                '0:39' : "Spare the sympathy",
                '0:41' : "Everybody wants to be my enemy",
                '0:48' : "(Look out for yourself)",
                '0:50' : "My enemy",
                '0:54' : "(Look out for yourself)",
                '0:56' : "But I'm ready",
                '0:57' : "Your words up on the wall",
                '0:59' : "as you're praying for my fall",
                '1:00' : "And the laughter in the halls and",
                '1:01' : "the names that Ive been called",
                '1:03' : "I stack it in my mind",
                '1:05' : "and I'm waiting for the time",
                '1:06' : "When I show you what it's like",
                '1:08' : "to be words spit in a mic",
                '1:09' : "Tell you you're the greatest",
                '1:12' : "But once you turn they hate us",
                '1:22' : "Oh, the misery",
                '1:25' : "Everybody wants to be my enemy",
                '1:29' : "Spare the sympathy",
                '1:31' : "Everybody wants to be",
                '1:33' : "My enemy",
                '1:38' : "(Look out for yourself)",
                '1:40' : "My enemy",
                '1:42' : "(yeah)",
                '1:44' : "(Look out for yourself)",
                '1:45' : "Uh, look, okay, I'm hoping",
                '1:46' : "that somebody pray for me.",
                '1:47' : "I'm praying that somebody",
                '1:48' : "hope for me. I'm staying",
                '1:49' : "where nobody 'posed to be.",
                '1:50' : "P-P-Posted, being a wreck",
                '1:51' : "of emotions. Ready to go",
                '1:52' : "whenever, just let me know.",
                '1:53' : "The road is long, so put",
                '1:54' : "the pedal into the floor.",
                '1:55' : "The enemy on my trail,",
                '1:56' : "my energy unavailable",
                '1:57' : "I'ma tell 'em, Hasta luego.",
                '1:58' : "They wanna plot on my trot",
                '1:59' : "to the top. I've been outta",
                '2:00' : "shape, thinkin' out the box,",
                '2:01' : "I'm an astronaut. I blasted",
                '2:02' : "off the planet rock to cause",
                '2:03' : "catastrophe. And it matters",
                '2:04' : "more 'cause I had it not.",
                '2:05' : "Had I thought about wreakin'",
                '2:06' : "havoc on an opposition,",
                '2:07' : "kinda shocking they wanted",
                '2:08' : "static with precision, I'm",
                '2:09' : "automatic. Quarterback, I",
                '2:10' : "ain't talkin' sacking. Pack",
                '2:11' : "it, pack it up, I don't",
                '2:12' : "panic. Batter, batter up,",
                '2:13' : "who the baddest? It don't",
                '2:14' : "matter cause we at your throat",
                '2:15' : "Everybody wants to be my enemy",
                '2:19' : "Spare the sympathy",
                '2:21' : "Everybody wants to be",
                '2:23' : "My enemy",
                '2:26' : "Oh, the misery",
                '2:27' : "Everybody wants to be my enemy",
                '2:31' : "Spare the sympathy",
                '2:34' : "Everybody wants to be my enemy",
                '2:37' : "Pray it away, I swear",
                '2:39' : "I'll never be a saint, no way",
                '2:42' : "My enemy",
                '2:43' : "Pray it away, I swear",
                '2:45' : "I'll never be a saint",
            }},
            {audio: new Audio("https://github.com/oe2735/music/raw/refs/heads/main/KSI_-_Thick_Of_It_Official_Sus_Remix_(Hydr0.org).mp3"), lyrics: {
                '0:01' : "He sucked the tip of it,",
                '0:02' : "loves it in his throat",
                '0:04' : "I told him he should blow,",
                '0:05' : "filled him up, made him choke",
                '0:07' : "Shoved in his ass, yeah",
                '0:09' : "I gave him my bone",
                '0:11' : "I Fuck many guys every night,",
                '0:13' : "my Dick broke",
                '0:14' : "Why does it taste like prime",
                '0:15' : "when im licking his balls?",
                '0:17' : "Pulled on his nuts then",
                '0:18' : "slammed him hard into a wall",
                '0:21' : "I slapped his ass",
                '0:22' : "after I sucked him",
                '0:23' : "through his drawers",
                '0:24' : "You might be",
                '0:25' : "wondering who he is",
                '0:26' : "He is Logan Paul",
                '0:28' : "~~~WOAH~~~",
                '0:31' : "He's begging me",
                '0:32' : "for the stroke",
                '0:34' : "   WOAH   ",
                '0:37' : "So can you just",
                '0:39' : "put it in my throat",
                '0:41' : "He loves how thick it is",
                '0:42' : "loves it in his throat",
                '0:44' : "I told him he should blow",
                '0:45' : "filled him up, made him choke",
                '0:47' : "DanTDM, you do not",
                '0:49' : "want the smoke",
                '0:50' : "cuz in the ring I'll",
                '0:51' : "bend you over",
                '0:52' : "and give you my load",
                '0:53' : "Made him scream",
                '0:54' : "Made him cream",
                '0:55' : "Then he slobbered on my meat",
                '0:57' : "Logan wants to suck my Dick",
                '0:58' : "want me drippy like his cheese",
                '1:00' : "then afterwards I think",
                '1:02' : "I'll talk to mr beast",
                '1:03' : "He wants to pry open my ass",
                '1:05' : "and have a feast",
                '1:07' : "\\\\WOAH//",
                '1:10' : "He's beggin me for the stroke",
                '1:13' : "//WOAH\\\\",
                '1:16' : "So can you just",
                '1:18' : "put it in my throat",
                '1:20' : "he loves how thick it is",
                '1:21' : "loves it in his throat",
                '1:23' : "I told him he should blow",
                '1:24' : "filled him up, made him choke",
                '1:26' : "If he wants some more",
                '1:27' : "I'll eat his ass",
                '1:28' : "then send him home",
                '1:29' : "make him sign a NDA",
                '1:31' : "he'll never tell a soul",
                '1:33' : "His Dick's so big and fat",
                '1:34' : "I really love to show",
                '1:36' : "how big it is",
                '1:38' : "to friends and family at home",
                '1:39' : "The only reason I",
                '1:41' : "agreed to do this song",
                '1:43' : "is cuz KSI told me that",
                '1:45' : "he would give me dome",
                '1:47' : "YEAHHHHH",
                '1:49' : "I REALLY WANT TO SPANK YOU",
                '1:51' : "REALLY WANNA TASTE YOU",
                '1:53' : "<--- WOAH --->",
                '1:55' : "When I lick your Dick can",
                '1:58' : "you just put it in MY THROAT",
                '1:59' : "He sucked the tip of it",
                '2:01' : "loves it in his throat",
                '2:02' : "I told him he should blow,",
                '2:04' : "filled him up, made him choke",
                '2:06' : "shoved it in has ass, yeah",
                '2:07' : "I gave him my bone",
                '2:09' : "I Fuck many guys every night",
                '2:11' : "my Dick broke",
                '2:13' : "He loves how thick it is",
                '2:14' : "loves it in his throat",
                '2:16' : "I told him he should blow",
                '2:17' : "filled him up,",
                '2:18' : "made him choke",
                '2:19' : "DanTDM, you do not",
                '2:21' : "want the smoke",
                '2:22' : "cuz in the ring I'll bend you over",
                '2:24' : "then give you my load",
                '2:25' : "|-=[  WOAH  ]=-|",
                '2:29' : "He's beggin me for the stroke",
                '2:32' : ".:|WOAH|:.",
                '2:35' : "Can you just",
                '2:37' : "put it in my throat",
            }},
            {audio: new Audio("https://github.com/oe2735/music/raw/refs/heads/main/KORDHELL_-_SCOPIN_(Hydr0.org).mp3"), lyrics: {
                '0:03' : "I got that gauge 38",
                '0:04' : "and that four-five Glock",
                '0:05' : "Deep in the bushes, see",
                '0:06' : "I'm scopin' with that red dot",
                '0:08' : "I got that, I got that,",
                '0:09' : "I got that four-five Glock",
                '0:10' : "Deep in the bushes, see",
                '0:11' : "I'm scopin' with that red dot",
                '0:12' : "I got that gauge 38",
                '0:13' : "and that four-five Glock",
                '0:15' : "Deep in the bushes, see",
                '0:16' : "I'm scopin' with that red dot",
                '0:17' : "I got that, I got that,",
                '0:19' : "I got that, I got that",
                '0:20' : "I, I, I, I",
                '0:31' : "Scopin' with that red dot",
                '0:40' : "Deep in the bushes, see",
                '0:41' : "I'm scopin' with that red dot",
                '0:42' : "I got that gauge 38",
                '0:44' : "and that four-five Glock",
                '0:45' : "Deep in the bushes, see",
                '0:46' : "I'm scopin' with that red dot",
                '0:47' : "I got that, I got that,",
                '0:48' : "I got that four-five Glock",
                '0:50' : "Deep in the bushes, see",
                '0:51' : "I'm scopin' with that red dot",
                '0:52' : "I got that gauge 38",
                '0:53' : "and that four-five Glock",
                '0:54' : "Deep in the bushes, see",
                '0:55' : "I'm scopin' with that red dot",
                '0:57' : "I got that, I got that,",
                '0:58' : "I got that four-five Glock",
                '0:59' : "Deep in the bushes, see",
                '1:00' : "I'm scopin' with that red dot",
                '1:10' : "Scopin' with that red dot",
                '1:18' : "Deep in the bushes, see",
                '1:20' : "I'm scopin' with that red dot",
                '1:22' : "Scopin' with that red dot",
                '1:24' : "Scopin',",
                '1:25' : "scopin' with that red dot",
                '1:27' : "Scopin' with that red dot",
                '1:28' : "Deep in the bushes, see",
                '1:29' : "I'm scopin' with that red dot",
                '1:32' : "Scopin' with that red dot",
                '1:34' : "Scopin',",
                '1:35' : "scopin' with that red dot",
                '1:37' : "Scopin' with that red dot",
                '1:38' : "Deep in the bushes, see",
                '1:39' : "I'm scopin' with that red dot",
            }},
            {audio: new Audio("https://github.com/oe2735/music/raw/refs/heads/main/G3OX_EM_-_GIGACHAD_THEME_(Hydr0.org).mp3"), lyrics: {
                '0:00' : "Rollin' wit da devil on dat",
                '0:01' : "level, dig yo ditch, Bitch",
                '0:02' : "Hitch with da hiker on da mic,",
                '0:03' : "I'll make yo ass wish",
                '0:04' : "Yeah da Triple 6 brang it real",
                '0:05' : "Real, a mothaFucka",
                '0:06' : "Gonna pack the steel",
                '0:07' : "Rollin' wit da devil on dat",
                '0:08' : "level, dig yo ditch, Bitch",
                '0:09' : "Hitch with da hiker on da mic,",
                '0:10' : "I'll make yo ass wish",
                '0:11' : "Yeah da Triple 6 brang it real",
                '0:12' : "Real, a mothaFucka",
                '0:13' : "Gonna pack the steel",
                '0:14' : "Rollin' wit da devil on dat",
                '0:15' : "level, dig yo ditch, Bitch",
                '0:16' : "Hitch with da hiker on da mic,",
                '0:17' : "I'll make yo ass wish",
                '0:18' : "Yeah da Triple 6 brang it real",
                '0:19' : "Real, a mothaFucka",
                '0:20' : "gonna pack the steel",
                '0:21' : "Rollin' wit da devil on dat",
                '0:22' : "level, dig yo ditch, Bitch",
                '0:23' : "Hitch with da hiker on da mic,",
                '0:24' : "I'll make yo ass wish",
                '0:25' : "Yeah da Triple 6 brang it real",
                '0:27' : "Real, a mothaFucka",
                '0:28' : "gonna pack the steel",
                '0:29' : "Still I fuck a Fly,",
                '0:30' : "I pack a real",
                '0:31' : "Real on da mic like",
                '0:32' : "Evander Holyfield",
                '0:33' : "Yeah da Triple 6 brang it real",
                '0:35' : "Real, a mothaFucka",
                '0:36' : "gonna pack the steel",
                '0:37' : "Rollin' wit da devil on dat",
                '0:38' : "level, dig yo ditch, Bitch",
                '0:39' : "Hitch with da hiker on da mic,",
                '0:40' : "I'll make yo ass wish",
                '0:41' : "Yeah da Triple 6 brang it real",
                '0:42' : "Real, a mothaFucka",
                '0:43' : "gonna pack the steel",
                '0:44' : "Rollin' wit da devil on dat",
                '0:45' : "level, dig yo ditch, Bitch",
                '0:46' : "Hitch with da hiker on da mic,",
                '0:47' : "I'll make yo ass wish",
                '0:48' : "Yeah da Triple 6 brang it real",
                '0:49' : "Real, a mothaFucka",
                '0:50' : "gonna pack the steel",
                '0:51' : "Rollin' wit da devil on dat",
                '0:52' : "level, dig yo ditch, Bitch",
                '0:53' : "Hitch with da hiker on da mic,",
                '0:54' : "I'll make yo ass wish",
                '0:55' : "Yeah da Triple 6 brang it real",

                '0:57' : "Real, a mothaFucka",
                '0:58' : "gonna pack the steel",
                '0:59' : "Rollin' wit da devil on dat",
                '1:00' : "level, dig yo ditch, Bitch",
                '1:01' : "Hitch with da hiker on da mic,",
                '1:02' : "I'll make yo ass wish",
                '1:03' : "Yeah da Triple 6 brang it real",
                '1:04' : "Real, a mothaFucka",
                '1:05' : "gonna pack the steel",
                '1:06' : "Rollin' wit da devil on dat",
                '1:07' : "level, dig yo ditch, Bitch",
                '1:08' : "Hitch with da hiker on da mic,",
                '1:09' : "I'll make yo ass wish",
                '1:10' : "Yeah da Triple 6 brang it real",
                '1:12' : "Real, a mothaFucka",
                '1:13' : "gonna pack the steel",
                '1:14' : "Rollin' wit da devil on dat",
                '1:15' : "level, dig yo ditch, Bitch",
                '1:16' : "Hitch with da hiker on da mic,",
                '1:17' : "I'll make yo ass wish",
                '1:18' : "Yeah da Triple 6 brang it real",
                '1:20' : "Real, a mothaFucka",
                '1:21' : "gonna pack the steel",
                '1:22' : "Rollin' wit da devil on dat",
                '1:23' : "level, dig yo ditch, Bitch",
                '1:24' : "Hitch with da hiker on da mic,",
                '1:25' : "I'll make yo ass wish",
                '1:26' : "Yeah da Triple 6 brang it real",
                '1:27' : "Real, a mothaFucka",
                '1:28' : "gonna pack the steel",
                '1:29' : "Rollin' wit da devil on dat",
                '1:30' : "level, dig yo ditch, Bitch",
                '1:31' : "Hitch with da hiker on da mic,",
                '1:32' : "I'll make yo ass wish",
                '1:33' : "Yeah da Triple 6 brang it real",
                '1:35' : "Real, a mothaFucka",
                '1:36' : "gonna pack the steel",
                '1:37' : "Still I fuck a Fly,",
                '1:38' : "I pack a real",
                '1:39' : "Real on da mic",
                '1:40' : "like Evander Holyfield",
                '1:41' : "Yeah da Triple 6 brang it real",
                '1:42' : "Real, a mothaFucka",
                '1:43' : "gonna pack the steel",
                '1:44' : "Rollin' wit da devil on dat",
                '1:45' : "level, dig yo ditch, Bitch",
                '1:46' : "Hitch with da hiker on da mic,",
                '1:47' : "I'll make yo ass wish",
                '1:48' : "Yeah da Triple 6 brang it real",
                '1:49' : "Real, a mothaFucka",
                '1:50' : "gonna pack the steel",
                '1:52' : "Rollin' wit da devil on dat",
                '1:53' : "level, dig yo ditch, Bitch",
                '1:54' : "Hitch with da hiker on da mic,",
                '1:55' : "I'll make yo ass wish",
                '1:56' : "Yeah da Triple 6 brang it real",
                '1:57' : "Real, a mothaFucka",
                '1:58' : "gonna pack the steel",
                '1:59' : "Rollin' wit da devil on dat",
                '2:00' : "level, dig yo ditch, Bitch",
                '2:01' : "Hitch with da hiker on da mic,",
                '2:02' : "I'll make yo ass wish",
                '2:03' : "Yeah da Triple 6 brang it real",
                '2:05' : "Real, a mothaFucka",
                '2:06' : "gonna pack the steel",
                '2:07' : "Rollin' wit da devil on dat",
                '2:08' : "level, dig yo ditch, Bitch",
                '2:09' : "Hitch with da hiker on da mic,",
                '2:10' : "I'll make yo ass wish",
                '2:11' : "Yeah da Triple 6 brang it real",
                '2:12' : "Real, a mothaFucka",
                '2:13' : "gonna pack the steel",
            }},
            {audio: new Audio("https://github.com/oe2735/music/raw/refs/heads/main/Ed_Sheeran_-_Shape_of_You_(Hydr0.org).mp3"), lyrics: {
                '0:10' : "The club isn't the",
                '0:11' : "best place to find a lover",
                '0:12' : "So the bar is where I go",
                '0:15' : "Me and my friends at",
                '0:16' : "the table doing shots",
                '0:17' : "Drinking fast and then",
                '0:18' : "we talk slow",
                '0:20' : "Come over and start up",
                '0:21' : "a conversation with just me",
                '0:22' : "And trust me I'll",
                '0:23' : "give it a chance now",
                '0:25' : "Take my hand, stop,",
                '0:26' : "put Van the Man on the jukebox",
                '0:27' : "And then we start to dance,",
                '0:29' : "and now I'm singing like",
                '0:30' : "Girl, you know",
                '0:31' : "I want your love",
                '0:32' : "Your love was handmade",
                '0:34' : "for somebody like me",
                '0:36' : "Come on now, follow my lead",
                '0:38' : "I may be crazy, don't mind me",
                '0:40' : "Say, boy, let's",
                '0:41' : "not talk too much",
                '0:42' : "Grab on my waist",
                '0:43' : "and put that body on me",
                '0:45' : "Come on now, follow my lead",
                '0:47' : "Come, come on now,",
                '0:48' : "follow my lead",
                '0:51' : "I'm in love with",
                '0:52' : "the shape of you",
                '0:53' : "We push and pull",
                '0:54' : "like a magnet do",
                '0:56' : "Although my heart",
                '0:57' : "is falling too",
                '0:59' : "I'm in love with your body",
                '1:01' : "And last night you",
                '1:02' : "were in my room",
                '1:03' : "And now my bedsheets",
                '1:04' : "smell like you",
                '1:05' : "Every day discovering",
                '1:06' : "something brand new",
                '1:08' : "I'm in love with your body",
                '1:10' : "(Oh-I-oh-I-oh-I-oh-I)",
                '1:14' : "I'm in love with your body",
                '1:15' : "(Oh-I-oh-I-oh-I-oh-I)",
                '1:19' : "I'm in love with your body",
                '1:20' : "(Oh-I-oh-I-oh-I-oh-I)",
                '1:24' : "I'm in love with your body",
                '1:25' : "Every day discovering",
                '1:27' : "something brand new",
                '1:28' : "I'm in love with",
                '1:29' : "the shape of you",
                '1:30' : "One week in we",
                '1:31' : "let the story begin",
                '1:32' : "We're going out",
                '1:33' : "on our first date",
                '1:35' : "You and me are thrifty,",
                '1:36' : "so go all you can eat",
                '1:37' : "Fill up your bag",
                '1:38' : "and I fill up a plate",
                '1:40' : "We talk for hours and hours",
                '1:41' : "about the sweet and the sour",
                '1:42' : "And how your family",
                '1:43' : "is doing okay",
                '1:45' : "And leave and get in a taxi,",
                '1:46' : "then kiss in the backseat",
                '1:47' : "Tell the driver make the",
                '1:48' : "radio play, and",
                '1:49' : "I'm singing like",
                '1:50' : "Girl, you know",
                '1:51' : "I want your love",
                '1:52' : "Your love was handmade",
                '1:53' : "for somebody like me",
                '1:55' : "Come on now, follow my lead",
                '1:57' : "I may be crazy, don't mind me",
                '1:59' : "Say, boy, let's",
                '2:00' : "not talk too much",
                '2:02' : "Grab on my waist",
                '2:03' : "and put that body on me",
                '2:05' : "Come on now, follow my lead",
                '2:07' : "Come, come on now,",
                '2:08' : "follow my lead",
                '2:11' : "I'm in love with",
                '2:12' : "the shape of you",
                '2:13' : "We push and pull",
                '2:14' : "like a magnet do",
                '2:16' : "Although my heart",
                '2:17' : "is falling too",
                '2:18' : "I'm in love with your body",
                '2:21' : "And last night you",
                '2:22' : "were in my room",
                '2:23' : "And now my bedsheets",
                '2:24' : "smell like you",
                '2:25' : "Every day discovering",
                '2:26' : "something brand new",
                '2:28' : "I'm in love with your body",
                '2:30' : "(Oh-I-oh-I-oh-I-oh-I)",
                '2:33' : "I'm in love with your body",
                '2:35' : "(Oh-I-oh-I-oh-I-oh-I)",
                '2:38' : "I'm in love with your body",
                '2:40' : "(Oh-I-oh-I-oh-I-oh-I)",
                '2:43' : "I'm in love with your body",
                '2:45' : "Every day discovering",
                '2:46' : "something brand new",
                '2:48' : "I'm in love with",
                '2:49' : "the shape of you",
                '2:50' : "Come on, be my baby,",
                '2:52' : "come on",
                '2:53' : "Come on, be my baby,",
                '2:54' : "come on",
                '2:55' : "Come on, be my baby",
                '2:57' : "come on",
                '2:58' : "Come on, be my baby,",
                '3:00' : "come on",
                '3:01' : "Come on, be my baby,",
                '3:02' : "come on",
                '3:03' : "Come on, be my baby,",
                '3:04' : "come on",
                '3:05' : "Come on, be my baby,",
                '3:06' : "come on",
                '3:07' : "Come on, be my baby,",
                '3:09' : "come on",
                '3:11' : "I'm in love with",
                '3:12' : "the shape of you",
                '3:13' : "We push and pull",
                '3:14' : "like a magnet do",
                '3:15' : "Although my heart",
                '3:16' : "is falling too",
                '3:18' : "I'm in love with your body",
                '3:21' : "And last night you",
                '3:22' : "were in my room",
                '3:23' : "And now my bedsheets",
                '3:24' : "smell like you",
                '3:25' : "Every day discovering",
                '3:27' : "something brand new",
                '3:28' : "I'm in love with your body",
                '3:30' : "Come on, be my baby,",
                '3:31' : "come on",
                '3:32' : "Come on",
                '3:33' : "(I'm in love with your body),",
                '3:34' : "be my baby, come on",
                '3:35' : "Come on, be my baby, come on",
                '3:37' : "Come on",
                '3:38' : "(I'm in love with your body),",
                '3:39' : "be my baby, come on",
                '3:40' : "Come on, be my baby,",
                '3:41' : "come on",
                '3:42' : "Come on, be my baby,",
                '3:43' : "(I'm in love with your body),",
                '3:44' : "come on",
                '3:45' : "Every day discovering",
                '3:46' : "something brand new",
                '3:48' : "I'm in love with",
                '3:49' : "the shape of you",
            }},
            {audio: new Audio("https://github.com/oe2735/music/raw/refs/heads/main/FUWAMOCO_Ch._hololive-EN_-_Born_to_be_BAU_DOL_(Hydr0.org).mp3"), lyrics: {
                '0:04' : "Fuwa Fuwa, Moco Moco",
'0:06' : "Makai no banken shisutaazu",
'0:08' : "Kono sekai ni",
'0:09' : "bakutan 'BAU' DOLdesu",
'0:13' : "BAU BAU!!",
'0:14' : "Fuwawa (Fuwawa),",
'0:15' : "Mococo (Mococo)",
'0:16' : "FUWA plus MOCO wa",
'0:17' : "FUWAMOCO (FUWAMOCO)",
'0:19' : "Fuwawa (Fuwawa),",
'0:20' : "Mococo (Mococo)",
'0:21' : "FUWA plus MOCO wa",
'0:22' : "FUWAMOCO (FUWAMOCO)",
'0:24' : "BAU BAU",
'0:25' : "Wake up shitara",
'0:26' : "kimi ni Morning",
'0:27' : "New na deai hana",
'0:28' : "kikase Search Shite",
'0:30' : "doki doki Doggy",
'0:32' : "Migi ni hidari BAU BAU BAU",
'0:35' : "Nayandeite mo kichau Future",
'0:37' : "Mazuha me no mae no",
'0:38' : "michi Step Shite",
'0:40' : "Happy Lucky Puppy",
'0:42' : "Issho ni arukou yo",
'0:45' : "Doonatsu no ana no naka ni wa",
'0:50' : "Kitto kitto",
'0:53' : "Yume ga tsumatteru kara",
'0:57' : "Fuwa Fuwa (Wa-foo!!),",
'0:58' : "Moco Moco (Come on!!)",
'0:59' : "Makai no banken shisutaazu",
'1:02' : "Nihiki gasoroeba mou oosawagi",
'1:07' : "Moamoa (Motto!!)",
'1:08' : "haroharo (BAUBAU!!)",
'1:09' : "Mayowazu ni Go my way",
'1:11' : "Kimi no zettai",
'1:13' : "mikata 'BAU' DOL desu",
'1:16' : "BAU BAU",
'1:17' : "Fuwawa (Fuwawa),",
'1:18' : "Mococo (Mococo)",
'1:19' : "FUWA plus MOCO wa",
'1:20' : "FUWAMOCO (FUWAMOCO)",
'1:22' : "Fuwawa (Fuwawa),",
'1:23' : "Mococo (Mococo)",
'1:24' : "FUWA plus MOCO wa",
'1:25' : "FUWAMOCO (FUWAMOCO)",
'1:27' : "BAU BAU",
'1:28' : "Hitori janai yo We're together",
'1:30' : "Heart tsunagatteru",
'1:32' : "kimi to Chat Shite",
'1:33' : "Fluffy fuzzy yappy",
'1:35' : "issho ni utaou yo",
'1:38' : "Doonatsu no ana no mukou e",
'1:43' : "Kitto kitto",
'1:46' : "kimi ga matteiru kara",
'1:50' : "Fuwa Fuwa (Wa-foo!!),",
'1:51' : "Moco Moco (Come on!!)",
'1:53' : "Makai no banken shisutaazu",
'1:55' : "Nihiki ga soroeba",
'1:57' : "mou tomaranai",
'2:00' : "Omimi mo (Ear!!)",
'2:01' : "shippo mo (BunBun!!)",
'2:02' : "osawari wa genkin",
'2:05' : "Suriru manten bakudan",
'2:06' : "'BAU' DOL desu",
'2:09' : "BAU BAU",
'2:10' : "Hey, Ruffians!!",
'2:12' : "Kept you waiting, huh?",
'2:15' : "Can I get a 'Heck, yeah'!?",
'2:17' : "Let's shout 'BAU'!!",
'2:20' : "BAU! BAU! BAU! BAU!",
'2:22' : "BAU!! BAU!! BAU!! BAU!!",
'2:25' : "Now, hear the howling",
'2:27' : "of my soul!!",
'2:28' : "Are you ready!?",
'2:32' : "Moco-chan!!",
'2:33' : "Kono kyoku wa kawaiku",
'2:35' : "utaou ne tte itta desho!!",
'2:36' : "Bau bau",
'2:37' : "Jaa B mero kara... seeno!",
'2:39' : "Doonatsu ringu ni chikatte",
'2:45' : "Zutto zutto",
'2:47' : "Egao o mamoru kara",
'2:51' : "Fuwa Fuwa (Wa-foo!!),",
'2:53' : "Moco Moco (Come on!!)",
'2:54' : "Makai no banken shisutaazu",
'2:57' : "Nihiki gasoroeba mou oosawagi",
'3:02' : "Moamoa (Motto!!)",
'3:03' : "haroharo (BAU BAU!!)",
'3:04' : "Mayowazu ni Go my way",
'3:07' : "Kimi no zettai",
'3:09' : "mikata 'BAU' DOL desu",
'3:16' : "BAU BAU",
'3:17' : "Fuwawa (Fuwawa),",
'3:18' : "Mococo (Mococo)",
'3:19' : "FUWA plus MOCO wa",
'3:20' : "FUWAMOCO (FUWAMOCO)",
'3:22' : "Fuwawa (Fuwawa),",
'3:23' : "Mococo (Mococo)",
'3:24' : "FUWA plus MOCO wa",
'3:25' : "FUWAMOCO (FUWAMOCO)",
'3:27' : "BAU BAU"
            }},
            {audio: new Audio("https://github.com/oe2735/music/raw/refs/heads/main/Avicii_-_The_Nights_(Hydr0.org).mp3"), lyrics: {
                '0:04' : "Once upon a younger year",
'0:05' : "When all our shadows",
'0:06' : "disappeared",
'0:07' : "The animals inside",
'0:08' : "came out to play",
'0:11' : "Went face to face",
'0:12' : "with all our fears",
'0:13' : "Learned our lessons",
'0:14' : "through the tears",
'0:15' : "Made memories we knew",
'0:16' : "would never fade",
'0:18' : "One day my father, he told me,",
'0:20' : "Son, don't let it slip away",
'0:22' : "He took me in his arms,",
'0:23' : "I heard him say",
'0:25' : "When you get older",
'0:27' : "your wild heart",
'0:28' : "will live for younger days",
'0:30' : "Think of me if ever",
'0:31' : "you're afraid",
'0:32' : "He said,",
'0:33' : "One day, you'll leave",
'0:35' : "this world behind",
'0:37' : "So live a life",
'0:38' : "you will remember",
'0:41' : "My father told me when",
'0:42' : "I was just a child",
'0:44' : "These are the nights",
'0:46' : "that never die",
'0:48' : "My father told me",
'1:19' : "When thunderclouds",
'1:20' : "start pouring down",
'1:21' : "Light a fire they",
'1:22' : "can't put out",
'1:23' : "Carve your name into",
'1:24' : "those shining stars",
'1:26' : "He said,",
'1:27' : "Go venture",
'1:28' : "far beyond the shores",
'1:29' : "Don't forsake this",
'1:30' : "life of yours",
'1:31' : "I'll guide you home no",
'1:32' : "matter where you are",
'1:34' : "One day my father, he told me,",
'1:36' : "Son, don't let it slip away",
'1:38' : "When I was just a kid,",
'1:39' : "I heard him say",
'1:42' : "When you get older",
'1:43' : "your wild heart will",
'1:44' : "live for younger days",
'1:46' : "Think of me if ever",
'1:47' : "you're afraid",
'1:49' : "He said,",
'1:50' : "One day, you'll leave",
'1:51' : "this world behind",
'1:53' : "So live a life",
'1:54' : "you will remember",
'1:57' : "My father told me when",
'1:59' : "I was just a child",
'2:01' : "These are the nights",
'2:02' : "that never die",
'2:04' : "My father told me",
'2:16' : "These are the nights",
'2:17' : "that never die",
'2:19' : "My father told me",
'2:28' : "Oh~",
'2:50' : "My father told me",
            }},
        ]
        let isPlaying = false;
        let currentSong = null;
        let currentPart = "";

        function playSong(songIndex, isRandom = false) {
            if (currentSong) {
                currentSong.audio.pause();
                currentSong.audio.currentTime = 0;
            }
            currentSong = songs[songIndex];
            currentSong.audio.play();
            isPlaying = true;

            currentSong.audio.ontimeupdate = function () {
                let part = currentSong.lyrics[toFancyTimeFormat(Math.round(this.currentTime))];
                if (part && part !== currentPart) {
                    currentPart = part;
                    sendChat(part); // Assuming sendChat is defined elsewhere
                }
            };

            currentSong.audio.onended = function () {
                if (isRandom && isC("songChat").checked) {
                    playSong(UTILS.randInt(0, songs.length-1), true); // Play a random song
                } else if (isPlaying) {
                    this.play(); // Loop the same song
                }
            };
        }

        function toggleSong() {
            if (isPlaying) {
                songs.forEach(song => {
                    song.audio.pause();
                    song.audio.currentTime = 0;
                });
                isPlaying = false;
                currentSong = null;
            } else {
                const selectedOption = isC("songChat").options.value; // Assuming isC("songChat") is defined elsewhere
                const songIndex = parseInt(selectedOption.replace("song", ""), 10) - 1;

                if (isC("songChat").checked) {
                    playSong(Math.floor(Math.random() * songs.length), true); // Start random playback
                } else if (!isNaN(songIndex)) {
                    playSong(songIndex, false); // Play the selected song
                }
            }
        }


        function knockBackPredict() {
            let nea = near.aim2;
            let minDist = Infinity;
            let neIT = near.inTrap;
            if (near.dist2 - player.scale * 1.8 <= items.weapons[player.weapons[0]].range && !neIT) {
                for (let tmp of gameObjects) {
                    //let scope = KBIndc; //for rendering knock back prediction. im too lazy to add it cuz im not in charge of rendering :D

                    if ((tmp.dmg && tmp.active && tmp.isTeamObject(player)) || (tmp.type == 1 && tmp.y >= 12000)) {
                        let primaryScaling = ((items.weapons[player.weapons[0]].knock||0) + 0.3) * items.weapons[player.weapons[0]].range + player.scale * 2
                        let secondaryScaling = ![undefined, 9, 12, 13, 15].includes(player.weapons[1]) ? (items.weapons[player.weapons[1]].knock||0) * items.weapons[player.weapons[1]].range + player.scale*2 - 10 : player.weapons[1] != undefined ? 60 : 0
                        let instaStuff = primaryScaling + secondaryScaling
                        let turretStuff = player.reloads[53] == 0 ? primaryScaling + secondaryScaling + 75 : instaStuff
                        let primaryX = near.x3 + primaryScaling * Math.cos(nea)
                        let primaryY = near.y3 + primaryScaling * Math.sin(nea)
                        let secondaryX = near.x3 + secondaryScaling * Math.cos(nea)
                        let secondaryY = near.y3 + secondaryScaling * Math.sin(nea)
                        let instaX = near.x3 + instaStuff * Math.cos(nea)
                        let instaY = near.y3 + instaStuff * Math.sin(nea)
                        let turretX = near.x3 + turretStuff * Math.cos(nea)
                        let turretY = near.y3 + turretStuff * Math.sin(nea)
                        /*scope.x0 = primaryX, scope.y0 = primaryY
                    scope.x1 = secondaryX, scope.y1 = secondaryY
                    scope.instax = instaX, scope.instay = instaY
                    scope.turretx = turretX, scope.turrety = turretY*/
                        //So, primary means primary weapon hit knock back, same for secondary, insta means primary + secondary. turret means primary + secondary + turret
                        if ((UTILS.getDist({ x: primaryX, y: primaryY }, tmp, 0, 0) < tmp.getScale(0.6, tmp.isItem) + player.scale) && player.reloads[player.weapons[0]] == 0) {
                            return "primary sync"
                        }
                        if ((UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) < tmp.getScale(0.6, tmp.isItem) + player.scale) && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && near.dist2 <= items.weapons[player.weapons[1]].range + player.scale * 1.8) {
                            return "insta them"
                        }
                    }
                }
            } else {
                /*KBIndc = {
                x0: 0,
                y0: 0,
                x1: 0,
                y1: 0,
                instax: 0,
                instay: 0,
                turretx: 0,
                turrety: 0
            }*/
            }
            return false
        }

        function drawCircles(_, f, d) {
            let M = document.getElementById("gameCanvas").getContext("2d");
            let tmp = kbIndc;
            M.globalAlpha = 0.5
            let obj5 = {
                x: tmp.mex - f,
                y: tmp.mey - d
            }
            M.fillStyle = "#A9A9A9"; // Different color for obj5
            M.beginPath();
            M.arc(obj5.x, obj5.y, 50*1.3, 0, 2 * Math.PI);
            M.fill();
        }

        // ADD DEAD PLAYER:
        function addDeadPlayer(tmpObj) {
            deadPlayers.push(new DeadPlayer(tmpObj.x, tmpObj.y, tmpObj.dir, tmpObj.buildIndex, tmpObj.weaponIndex, tmpObj.weaponVariant, tmpObj.skinColor, tmpObj.scale, tmpObj.name));
        }

        /** APPLY SOCKET CODES */

        // SET INIT DATA:
        function setInitData(data) {
            alliances = data.teams;
        }

        // SETUP GAME:
        function setupGame(yourSID) {
            keys = {};
            macro = {};
            playerSID = yourSID;
            attackState = 0;
            inGame = true;
            serverMenu.style.display = "none";
            packet("F", 0, getAttackDir(), 1);
            my.ageInsta = true;
            if (firstSetup) {
                firstSetup = false;
                gameObjects.length = 0;
            }
        }

        // ADD NEW PLAYER:
        function addPlayer(data, isYou) {
            let tmpPlayer = findPlayerByID(data[0]);
            if (!tmpPlayer) {
                tmpPlayer = new Player(data[0], data[1], config, UTILS, projectileManager,
                                       objectManager, players, ais, items, hats, accessories);
                players.push(tmpPlayer);
                if (isC("autoHello").checked) {
                    ChText("Game", `Encountered ${data[2]} {${data[1]}}.`, "lightblue");
                    sendChat("")
                }
            } else {
                if (isC("autoHello").checked) {
                    ChText("Game", `Encountered ${data[2]} {${data[1]}}.`, "lightblue");
                    sendChat("")
                }
            }
            tmpPlayer.spawn(isYou ? true : null);
            tmpPlayer.visible = false;
            tmpPlayer.oldPos = {
                x2: undefined,
                y2: undefined
            };
            tmpPlayer.x2 = undefined;
            tmpPlayer.y2 = undefined;
            tmpPlayer.x3 = undefined;
            tmpPlayer.y3 = undefined;
            tmpPlayer.setData(data);
            if (isYou) {
                if (!player) {
                    window.prepareUI(tmpPlayer);
                }
                player = tmpPlayer;
                camX = player.x;
                camY = player.y;
                my.lastDir = 0;
                updateItems();
                updateAge();
                updateItemCountDisplay();
                for (let i = 0; i < 5; i++) {
                    petals.push(new Petal(player.x, player.y));
                }
                if (player.skins[7]) {
                    my.reSync = true;
                }
            }
        }

        // REMOVE PLAYER:
        function removePlayer(id) {
            for (let i = 0; i < players.length; i++) {
                if (players[i].id == id) {
                    ChText("Game", players[i].name + " left the game", "yellow");
                    players.splice(i, 1);
                    break;
                }
            }
        }
        let healed = false;

setInterval(() => {
    if (inGame && player) {
        // Reset healed flag if still damaged
        if (player.health < 100) healed = false;

        if (player.health < 100 && !healed) {
            const timeSinceHit = Date.now() - player.lastHit;

            if (ping <= 69) {
                if (timeSinceHit >= 100) { // Slightly slower than 80ms
                    healed = true;
                    healer();
                }
            } else {
                if (game.tick - player.hitTick > 1) { // Wait 2 ticks
                    healed = true;
                    healer();
                }
            }
        }
    }
}, 40); // Slower check loop: every 40ms


        // UPDATE HEALTH:
        function updateHealth(sid, value) {
            tmpObj = findPlayerBySID(sid);
            if (tmpObj) {
                tmpObj.oldHealth = tmpObj.health;
                tmpObj.health = value;
                tmpObj.judgeShame();
                if (tmpObj.oldHealth > tmpObj.health) {
                    my.antiInsta = true;
                    tmpObj.damaged = tmpObj.oldHealth - tmpObj.health;
                    advHeal.push([sid, value, tmpObj.damaged]);
                }
            }
        }

        let pingTracker = [];

        function pingSocketResponse() {
            let currentPing = window.pingTime;
            pingTracker.push(currentPing);

            if (pingTracker.length > 69) {
                pingTracker.shift(); // Remove the oldest entry
            }

            // Calculate the median of current ping values
            let medianPing = calculateStuff(pingTracker);
            ping = medianPing;
        }
        function calculateStuff(values) {
            if (values.length === 0) return 0; // Edge case for empty array

            // Sort the array to find the median
            let sortedValues = [...values].sort((a, b) => a - b);
            return sortedValues.length == 69 ? sortedValues[50] : sortedValues[Math.round(sortedValues.length % 2)];
        }

        // KILL PLAYER:
        function killPlayer() {
            inGame = false;
            lastDeath = {
                x: player.x,
                y: player.y,
            };
            if (isC("autoRespawn").checked) {
                packet("M", {
                    name: lastsp[0],
                    moofoll: lastsp[1],
                    skin: lastsp[2]
                });
            }
            setTimeout(() => {
                if (inGame) {
                    menuCardHolder.style.display = "none";
                    mainMenu.style.display = "none";
                    diedText.style.display = "none";
                }
            }, config.deathFadeout)
        }

        // UPDATE PLAYER ITEM VALUES:
        function updateItemCounts(index, value) {
            if (player) {
                player.itemCounts[index] = value;
                updateItemCountDisplay(index);
            }
        }

        // UPDATE AGE:
        function updateAge(xp, mxp, age) {
            if (xp != undefined)
                player.XP = xp;
            if (mxp != undefined)
                player.maxXP = mxp;
            if (age != undefined)
                player.age = age;
        }

        // UPDATE UPGRADES:
        function updateUpgrades(points, age) {
            player.upgradePoints = points;
            player.upgrAge = age;
            if (points > 0) {
                tmpList.length = 0;
                UTILS.removeAllChildren(upgradeHolder);
                for (let i = 0; i < items.weapons.length; ++i) {
                    if (items.weapons[i].age == age && (testMode || items.weapons[i].pre == undefined || player.weapons.indexOf(items.weapons[i].pre) >= 0)) {
                        let e = UTILS.generateElement({
                            id: "upgradeItem" + i,
                            class: "actionBarItem",
                            onmouseout: function () {
                                showItemInfo();
                            },
                            parent: upgradeHolder
                        });
                        e.style.backgroundImage = getEl("actionBarItem" + i).style.backgroundImage;
                        tmpList.push(i);
                    }
                }
                for (let i = 0; i < items.list.length; ++i) {
                    if (items.list[i].age == age && (testMode || items.list[i].pre == undefined || player.items.indexOf(items.list[i].pre) >= 0)) {
                        let tmpI = (items.weapons.length + i);
                        let e = UTILS.generateElement({
                            id: "upgradeItem" + tmpI,
                            class: "actionBarItem",
                            onmouseout: function () {
                                showItemInfo();
                            },
                            parent: upgradeHolder
                        });
                        e.style.backgroundImage = getEl("actionBarItem" + tmpI).style.backgroundImage;
                        tmpList.push(tmpI);
                    }
                }
                for (let i = 0; i < tmpList.length; i++) {
                    (function (i) {
                        let tmpItem = getEl('upgradeItem' + i);
                        tmpItem.onmouseover = function () {
                            if (items.weapons[i]) {
                                showItemInfo(items.weapons[i], true);
                            } else {
                                showItemInfo(items.list[i - items.weapons.length]);
                            }
                        };
                        tmpItem.onclick = UTILS.checkTrusted(function () {
                            packet("H", i);
                        });
                        UTILS.hookTouchEvents(tmpItem);
                    })(tmpList[i]);
                }
                if (tmpList.length) {
                    upgradeHolder.style.display = "block";
                    upgradeCounter.style.display = "block";
                    upgradeCounter.innerHTML = "SELECT ITEMS (" + points + ")";
                } else {
                    upgradeHolder.style.display = "none";
                    upgradeCounter.style.display = "none";
                    showItemInfo();
                }
            } else {
                upgradeHolder.style.display = "none";
                upgradeCounter.style.display = "none";
                showItemInfo();
            }
        }
            // auto spiketick
        function _0x5484(_0x293f09,_0x3d073e){const _0x5543e2=_0x5543();return _0x5484=function(_0x548400,_0x21a26a){_0x548400=_0x548400-0x1c4;let _0x1da7b2=_0x5543e2[_0x548400];return _0x1da7b2;},_0x5484(_0x293f09,_0x3d073e);}(function(_0x4865d7,_0x33417c){const _0x3958e9=_0x5484,_0x311a88=_0x4865d7();while(!![]){try{const _0x2f8c45=parseInt(_0x3958e9(0x1d0))/0x1+parseInt(_0x3958e9(0x1d2))/0x2+parseInt(_0x3958e9(0x1cf))/0x3*(parseInt(_0x3958e9(0x1c9))/0x4)+parseInt(_0x3958e9(0x1c8))/0x5+-parseInt(_0x3958e9(0x1ce))/0x6+parseInt(_0x3958e9(0x1cd))/0x7+-parseInt(_0x3958e9(0x1cb))/0x8;if(_0x2f8c45===_0x33417c)break;else _0x311a88['push'](_0x311a88['shift']());}catch(_0x155030){_0x311a88['push'](_0x311a88['shift']());}}}(_0x5543,0x8f44e));function bianosSpTick(){const _0x3daa74=_0x5484;let _0xa8ed65=UTILS[_0x3daa74(0x1ca)](tmpObj,player,0x0,0x2);buyEquip(0x7,0x0),buyEquip(0x12,0x1),selectWeapon(player[_0x3daa74(0x1c4)][0x0]),io[_0x3daa74(0x1d1)]('d',0x1,near[_0x3daa74(0x1c5)]),textManager[_0x3daa74(0x1c6)](player['x2'],player['y2'],0x1e,0.1,0x73a,_0x3daa74(0x1cc),_0x3daa74(0x1c7),0x2),place(0x2,_0xa8ed65),place(0x2,near['aim2']);for(let _0x1de9a1=0x0;_0x1de9a1<0x4;_0x1de9a1++){io[_0x3daa74(0x1d1)]('6',''),checkPlace(0x2,near['aim2']-0x5a+_0x1de9a1*0x2d);}setTickout(()=>{buyEquip(0x35,0x0),buyEquip(0x15,0x1),setTickout(()=>{const _0x21b7a4=_0x5484;io[_0x21b7a4(0x1d1)]('d',0x0,near[_0x21b7a4(0x1c5)]),buyEquip(0x6,0x0);},0x3);},0x1);}function _0x5543(){const _0x2134dd=['#cc0000','305970SsODuv','116dIkhGJ','getDirect','19927536sVmtjE','Trying\x20SpikeTick','7358575VxVKDH','3749322SAWJfZ','80277kVfPnM','884047mgNJEc','send','1860364EfNJhW','weapons','aim2','showText'];_0x5543=function(){return _0x2134dd;};return _0x5543();}
        // KILL OBJECT:
        function killObject(sid) {
            let findObj = findObjectBySid(sid);
            objectManager.disableBySid(sid);
            if (player) {
                if (!player.canSee(findObj)) {
                    breakTrackers.push({x: findObj.x, y: findObj.y});
                }
                if (breakTrackers.length > 8) {
                    breakTrackers.shift();
                }
                traps.replaceSids.push(sid)
                traps.replaced = false;
            }
                //autospiketick
        var _0x33c3eb=_0x584f;(function(_0x18f11f,_0x5ac7a8){var _0x2e8fac=_0x584f,_0x2f7cd4=_0x18f11f();while(!![]){try{var _0x60fa70=-parseInt(_0x2e8fac(0x185))/0x1*(parseInt(_0x2e8fac(0x180))/0x2)+-parseInt(_0x2e8fac(0x182))/0x3*(parseInt(_0x2e8fac(0x187))/0x4)+-parseInt(_0x2e8fac(0x188))/0x5*(parseInt(_0x2e8fac(0x17f))/0x6)+-parseInt(_0x2e8fac(0x186))/0x7*(parseInt(_0x2e8fac(0x183))/0x8)+-parseInt(_0x2e8fac(0x17e))/0x9+parseInt(_0x2e8fac(0x181))/0xa+parseInt(_0x2e8fac(0x189))/0xb;if(_0x60fa70===_0x5ac7a8)break;else _0x2f7cd4['push'](_0x2f7cd4['shift']());}catch(_0x57e320){_0x2f7cd4['push'](_0x2f7cd4['shift']());}}}(_0x599e,0xe6886));function _0x599e(){var _0x549010=['10358290zJMcMn','186OEqAyT','322344OrmXCQ','weapons','1811219cCdovw','259qVCKTe','7120JcioIi','5OmKvjS','58568620sXeFaY','reloads','14137506pNYEUK','2596398FFBWIz','2xnoiVa'];_0x599e=function(){return _0x549010;};return _0x599e();}function _0x584f(_0x416fbc,_0x2392fa){var _0x599e16=_0x599e();return _0x584f=function(_0x584fe6,_0x101de0){_0x584fe6=_0x584fe6-0x17e;var _0x24ee43=_0x599e16[_0x584fe6];return _0x24ee43;},_0x584f(_0x416fbc,_0x2392fa);}objDist<=0xc8&&getDist(player,tmpObj)<=0xa8&&tmpObj!=player&&player[_0x33c3eb(0x18a)][player[_0x33c3eb(0x184)][0x0]]==0x0&&bianosSpTick();
    }
        // KILL ALL OBJECTS BY A PLAYER:
        function killObjects(sid) {
            if (player) objectManager.removeAllItems(sid);
        }

        function optimisingAutoReloadFunction(weaponIndex) {
            return player.reloads[weaponIndex] > 0;
        }
        function optimisingAutoReloadFunction_2(weaponIndex) {
            return player.weaponIndex != weaponIndex || player.buildIndex > -1;
        }
        let hatChanger = function() {
            if (my.anti0Tick > 0 || my.forceStop) {
                buyEquip(6, 0);
            } else {
                let bullTick = canBullTick();
                if (isC("hatType").checked && isC("hatType").options.value == "ag" && player.moveDir == null && Date.now() - player.moveTime > 1357 && player.health == 100 && Date.now() - player.lastHit > 1357 && Date.now() - player.lastGather > 1357 && !autoGathering) {
                    buyEquip(56, 0)
                } else {
                    if (clicks.left || clicks.right) {
                        if (clicks.left) {
                            buyEquip((player.reloads[player.weapons[0]] <= ping/2) ? isC("weaponGrind").checked ? 40 : 7 : player.tailIndex == 11 ? 7 : player.empAnti || player.antiTurretSpam ? 22 : player.soldierAnti ? 6 : (isC("antiBullType").checked && isC("antiBullType").options.value == "abreload" && near.antiBull > 0) ? 11 : near.dist2 <= 300 ? (isC("antiBullType").checked && isC("antiBullType").value == "abalway" && near.reloads[near.primaryIndex] == 0) ? 11 : 6 : biomeGear(1, 1), 0);
                        } else if (clicks.right) {
                            buyEquip((player.reloads[autoBreak.useHammer() ? player.weapons[1] : player.weapons[0]] <= ping/2) && sentHat != 40 ? 40 : (player.empAnti || player.antiTurretSpam) ? 22 : player.soldierAnti ? 6 : (isC("antiBullType").checked && isC("antiBullType").options.value == "abreload" && near.antiBull > 0) ? 11 : near.dist2 <= 300 ? (isC("antiBullType").checked && isC("antiBullType").value == "abalway" && near.reloads[near.primaryIndex] == 0) ? 11 : 6 : biomeGear(1, 1), 0);
                        }
                    } else if (autoBreak.active) {
                        let weapon = autoBreak.useHammer(autoBreak.target) ? player.weapons[1] : player.weapons[0]
                        if (autoBreak.target.health > items.weapons[weapon].dmg * (items.weapons[weapon].sDmg||1) && player.reloads[weapon] <= ping/2 && sentHat != 40) {
                            buyEquip(40, 0);
                        } else {
                            if (bullTick || my.reSync) {
                                buyEquip(7, 0);
                            } else {
                                buyEquip((player.empAnti || near.dist2 > 300 || !enemy.length) ? 22 : 6, 0);
                            }
                        }
                    } else {
                        if (player.empAnti || player.antiTurretSpam || player.soldierAnti) {
                            buyEquip((player.empAnti || player.antiTurretSpam) ? 22 : 6, 0);
                        } else {
                            if (bullTick || my.reSync) {
                                buyEquip(7, 0);
                            } else {
                                if (player.inWater) {
                                    if (!isC("alwaysFlipper").checked) {
                                        if (near.dist2 <= 300) {
                                            buyEquip((isC("antiBullType").checked && isC("antiBullType").options.value == "abreload" && near.antiBull > 0) ? 11 : (isC("antiBullType").checked && isC("antiBullType").options.value == "abalway" && near.reloads[near.primaryIndex] == 0) ? 11 : 6, 0);
                                        } else {
                                            biomeGear(1);
                                        }
                                    } else {
                                        biomeGear(1);
                                    }
                                } else {
                                    if (near.dist2 <= 300) {
                                        buyEquip((isC("antiBullType").checked && isC("antiBullType").value == "abreload" && near.antiBull > 0) ? 11 : (isC("antiBullType").checked && isC("antiBullType").value == "abalway" && near.reloads[near.primaryIndex] == 0) ? 11 : 6, 0);
                                    } else {
                                        biomeGear(1);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        let accChanger = function() {
            if ((clicks.left || near.dist2 < 300) && player.weapons[0] != 8 && !(my.autoPush && UTILS.getDist(player, my.pushData, 2, 2) > 100)) {
                if (!isC("antiBullType").checked || (isC("alwaysFlipper").checked && player.inWater)) {
                    buyEquip(16, 1)
                } else buyEquip(12, 1);
            } else {
                buyEquip(19, 1);
            }
        };
        function canBullTick() {
            if (player.shameCount > 0 && !(my.anti0Tick > 0) && player.skinIndex != 45 && player.health > 5 && !(player.poisonCounter > 0) && my.bullTick && !player.canEmpAnti) {
                if (((game.tick - player.bullTick) % 9 == 8 || player.needTick > 1)) {
                    return true;
                } else if (((game.tick - player.bullTick) % 9 == 0 && game.tick - player.bullTick > 8)) {
                    if (!autoBreak.active && !instaC.isTrue) player.needTick++;
                    return true;
                }
            }
            return false;
        }

        function closestPossibleAngles(obj, id) {
            let itemId = player.items[id];
            if (itemId == undefined) return;
            let item = items.list[itemId];

            let x = player.x2;
            let y = player.y2;

            let objX = obj.x;
            let objY = obj.y;
            let objScale = obj.getScale(0.6, obj.isItem) + 0.5; //a bit more cuz hitboxes cannot intersect at all I believe

            let dx = objX - x;
            let dy = objY - y;

            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > player.scale + objScale + 2 * item.scale + item.placeOffset) {//if object so far away that it wont affect anything, return angle to object
                return [UTILS.getDirect(objX, objY, x, y)];
            }

            const D = player.scale + item.scale + item.placeOffset;
            const E = objScale + item.scale;

            const a = (D * D - E * E + dist * dist) / (2 * dist);
            const h = Math.sqrt(Math.max(0, D * D - a * a));

            const px = x + (a / dist) * dx;
            const py = y + (a / dist) * dy;

            const cx1 = px + (h / dist) * dy;
            const cy1 = py - (h / dist) * dx;

            const cx2 = px - (h / dist) * dy;
            const cy2 = py + (h / dist) * dx;

            return [UTILS.getDirection(cx1, cy1, x, y), UTILS.getDirection(cx2, cy2, x, y)];
        }

        // Function to find free angle ranges
function angleRanges(id) {
    let itemId = player.items[id];
    if (itemId == undefined) return;
    let item = items.list[itemId];

    let closeEnoughBuilds = nearObjs.filter(obj => UTILS.getDist(obj, player, 0, 2) <= 200);

    let blockedRanges = [];

    for (let obj of closeEnoughBuilds) {
        let angles = closestPossibleAngles(obj, id);

        if (angles.length == 1) {
            continue;
        } else {
            let [angle1, angle2] = angles;
            let tmpS = player.scale + item.scale + (item.placeOffset || 0);

            let tmpX = player.x2 + tmpS * Math.cos(angle1);
            let tmpY = player.y2 + tmpS * Math.sin(angle1);
            let valid1 = objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, id, false);

            tmpX = player.x2 + tmpS * Math.cos(angle2);
            tmpY = player.y2 + tmpS * Math.sin(angle2);
            let valid2 = objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, id, false);

            let buildingAngle = UTILS.getDirect(obj, player, 0, 2);

            const inDirection = (start, end) => (buildingAngle - start + Math.PI * 2) % (Math.PI * 2) < (end - start + Math.PI * 2) % (Math.PI * 2);

            if (valid1 && valid2) {
                if (!inDirection(angle1, angle2)) {
                    [angle1, angle2] = [angle2, angle1];
                }
                blockedRanges.push(["both fine", angle1, angle2]);
            } else if (valid1 || valid2) {
                let validAngle = valid1 ? angle1 : angle2;
                let invalidAngle = valid1 ? angle2 : angle1;
                let direction = inDirection(validAngle, invalidAngle) ? "clockwise" : "anticlockwise";
                blockedRanges.push([direction, validAngle]);
            } else {
                if (!inDirection(angle1, angle2)) {
                    [angle1, angle2] = [angle2, angle1];
                }
                blockedRanges.push(["completely blocked", angle1, angle2]);
            }
        }
    }

    if (blockedRanges.length === 0) {
        return [[-Math.PI, Math.PI]];
    }

    // Merge overlapping blocked ranges
    let mergedBlockedRanges = [];

    for (let range of blockedRanges) {
        if (range[0] === "both fine" || range[0] === "completely blocked") {
            let [_, start, end] = range;

            if (mergedBlockedRanges.length === 0) {
                mergedBlockedRanges.push([start, end]);
            } else {
                let last = mergedBlockedRanges[mergedBlockedRanges.length - 1];
                if ((start - last[1] + Math.PI * 2) % (Math.PI * 2) <= 0) {
                    last[1] = end;
                } else {
                    mergedBlockedRanges.push([start, end]);
                }
            }
        } else {
            let [_, validAngle] = range;
            mergedBlockedRanges.push([validAngle, validAngle]);
        }
    }

    // Check if fully blocked
    let totalBlocked = 0;
    for (let [start, end] of mergedBlockedRanges) {
        totalBlocked += (end - start + Math.PI * 2) % (Math.PI * 2);
    }

    if (totalBlocked >= Math.PI * 2) {
        return [];
    }

    let freeRanges = [];
    let lastEnd = mergedBlockedRanges[mergedBlockedRanges.length - 1][1];

    for (let i = 0; i < mergedBlockedRanges.length; i++) {
        let [start, end] = mergedBlockedRanges[i];

        if ((start - lastEnd + Math.PI * 2) % (Math.PI * 2) > 0) {
            freeRanges.push([lastEnd, start]);
        }

        lastEnd = end;
    }

    let [firstStart] = mergedBlockedRanges[0];
    if ((firstStart - lastEnd + Math.PI * 2) % (Math.PI * 2) > 0) {
        freeRanges.push([lastEnd, firstStart]);
    }

    return freeRanges;
}



        let tickInterval = 1000/9;
        let lastTickTime = performance.now();

        function scheduleAction() {
            let nextTick = lastTickTime + tickInterval;
            let sendTime = nextTick - (ping / 2);
            let delay = sendTime - performance.now() + 2;

            setTimeout(() => {
                preplacer();
            }, delay)
        }
        // UPDATE PLAYER DATA:
        function updatePlayers(data) {
           /* setTimeout(() => {
                if (isC("autoPrePlace").checked && enemy.length) {
                    preplacer();
                }
            }, game.tickRate - ping + 1)*/
            game.tick++;
            enemy = [];
            nears = [];
            near = [];
            game.tickSpeed = performance.now() - game.lastTick;
            game.lastTick = performance.now();
            lastTickTime = game.lastTick - ping/2;
            scheduleAction();
            players.forEach((tmp) => {
                tmp.forcePos = !tmp.visible;
                tmp.visible = false;
            });
            for (let i = 0; i < data.length;) {
                tmpObj = findPlayerBySID(data[i]);
                if (tmpObj) {
                    tmpObj.t1 = (tmpObj.t2 === undefined) ? game.lastTick : tmpObj.t2;
                    tmpObj.t2 = game.lastTick;
                    tmpObj.oldPos.x2 = tmpObj.x2;
                    tmpObj.oldPos.y2 = tmpObj.y2;
                    tmpObj.x1 = tmpObj.x;
                    tmpObj.y1 = tmpObj.y;
                    tmpObj.x2 = data[i + 1];
                    tmpObj.y2 = data[i + 2];
                    tmpObj.x3 = tmpObj.x2 + (tmpObj.x2 - tmpObj.oldPos.x2);
                    tmpObj.y3 = tmpObj.y2 + (tmpObj.y2 - tmpObj.oldPos.y2);
                    tmpObj.d1 = (tmpObj.d2 === undefined) ? data[i + 3] : tmpObj.d2;
                    tmpObj.d2 = data[i + 3];
                    tmpObj.dt = 0;
                    tmpObj.buildIndex = data[i + 4];
                    tmpObj.weaponIndex = data[i + 5];
                    tmpObj.weaponVariant = data[i + 6];
                    tmpObj.team = data[i + 7];
                    tmpObj.isLeader = data[i + 8];
                    tmpObj.oldSkinIndex = tmpObj.skinIndex;
                    tmpObj.oldTailIndex = tmpObj.tailIndex;
                    tmpObj.skinIndex = data[i + 9];
                    tmpObj.tailIndex = data[i + 10];
                    tmpObj.iconIndex = data[i + 11];
                    tmpObj.zIndex = data[i + 12];
                    tmpObj.visible = true;
                    tmpObj.update(game.tickSpeed);
                    tmpObj.dist2 = UTILS.getDist(tmpObj, player, 2, 2);
                    tmpObj.aim2 = UTILS.getDirect(tmpObj, player, 2, 2);
                    tmpObj.dist3 = UTILS.getDist(tmpObj, player, 3, 3);
                    tmpObj.aim3 = UTILS.getDirect(tmpObj, player, 3, 3);
                    tmpObj.damageThreat = 0;
                    tmpObj.mostDamageThreat = 0;
                    tmpObj.hitSpike = false;
                    if (tmpObj.skinIndex == 45 && tmpObj.shameTimer <= 0) {
                        tmpObj.addShameTimer();
                    }
                    if (tmpObj.oldSkinIndex == 45 && tmpObj.skinIndex != 45) {
                        tmpObj.shameTimer = 0;
                        tmpObj.shameCount = 0;
                        if (tmpObj == player) {
                            healer();
                        }
                    }
                    let nearTrap = gameObjects.filter(e => e.trap && e.active && UTILS.getDist(e, tmpObj, 0, 2) <= (tmpObj.scale + e.getScale() + 3) && !e.isTeamObject(tmpObj)).sort(function (a, b) {
                        return UTILS.getDist(a, tmpObj, 0, 2) - UTILS.getDist(b, tmpObj, 0, 2);
                    })[0];
                    tmpObj.lastTrap = tmpObj.inTrap;
                    tmpObj.inTrap = nearTrap;
                    tmpObj.escaped = !tmpObj.inTrap && tmpObj.lastTrap
                    if (tmpObj == player) {
                        let turretsCanHit = 0
                        tmpObj.inWater = tmpObj.y2 >= config.mapScale / 2 - config.riverWidth / 2 && tmpObj.y2 <= config.mapScale / 2 + config.riverWidth / 2 // added inWater to check if ur in water. This is only for u player so it doesnt check every single player so it wont lag like hell (actually idk if it will lag)
                        if (gameObjects.length) {
                            gameObjects.forEach((tmp) => {
                                tmp.onNear = false;
                                if (tmp.active) {
                                    if (!tmp.onNear && UTILS.getDist(tmp, tmpObj, 0, 2) <= tmp.scale + items.weapons[tmpObj.weapons[0]].range) {
                                        tmp.onNear = true;
                                    }
                                    if (tmp.isItem && tmp.owner) {
                                        if (tmp.name == "turret" && UTILS.getDist(player, tmp, 2, 0) < 680 && !tmp.isTeamObject(tmpObj)) {
                                            turretsCanHit++
                                        }
                                    }
                                }
                            });
                            tmpObj.antiTurretSpam = turretsCanHit >= 5
                            nearObjs = gameObjects.filter(e => e.active && UTILS.getDist(e, tmpObj, 0, 2) <= 500).sort((a,b) => {return UTILS.getDist(a, tmpObj, 0, 2) - UTILS.getDist(b, tmpObj, 0, 2)})
                            let nearSpikes = nearObjs.filter(e => e.dmg && e.active && (UTILS.getDist(e, player, 0, 2) <= 169) && !e.isTeamObject(tmpObj)).sort(function (a, b) {
                                return UTILS.getDist(a, tmpObj, 0, 2) - UTILS.getDist(b, tmpObj, 0, 2);
                            })
                            if (nearTrap) {
                                traps.info = nearTrap;
                                let aimToTrap = UTILS.getDirect(nearTrap, player, 0, 2);
                                if (!traps.antiTrapped) {
                                    traps.protect(aimToTrap);
                                }
                                [nearSpikes[0], nearTrap, nearSpikes[1]].forEach(item => {
                                    if (item && !autoBreak.priority[0].includes(item)) {
                                        autoBreak.priority[0].push(item);
                                    }
                                });
                            } else {
                                traps.antiTrapped = false;
                            }
                            if (isC("breakSpikeSwitch").checked) {
                                nearSpikes.forEach(spike => {
                                    if (!autoBreak.priority[1].includes(spike)) {
                                        autoBreak.priority[1].push(spike)
                                    }
                                });
                            }
                            if (isC("breakTTBSwitch").checked) {
                                let turretTp = nearObjs.filter(e => e.active && !e.isTeamObject(player)&& (e.name == "turret" || e.name == "teleporter" || e.name == "blocker")).sort((a, b) => {return UTILS.getDist(a, tmpObj, 0, 2) - UTILS.getDist(b, tmpObj, 0, 2)})
                                turretTp.forEach(obj => {
                                    if (!autoBreak.priority[2].includes(obj)) {
                                         autoBreak.priority[2].push(obj)
                                    }
                                });
                            }
                            if (isC("breakAllSwitch").checked) {
                                nearObjs.forEach(obj => {
                                    if (obj.type == null && !autoBreak.priority[3].includes(obj)) {
                                        autoBreak.priority[3].push(obj)
                                    }
                                });
                            }
                        }
                    }
                    if (tmpObj.weaponIndex < 9) {
                        tmpObj.primaryIndex = tmpObj.weaponIndex;
                        tmpObj.primaryVariant = tmpObj.weaponVariant;
                    } else if (tmpObj.weaponIndex > 8) {
                        tmpObj.secondaryIndex = tmpObj.weaponIndex;
                        tmpObj.secondaryVariant = tmpObj.weaponVariant;
                    }
                }
                i += 13;
            }
            if (textManager.stack.length) {
                let stacks = [];
                let notstacks = [];
                let num = 0;
                let num2 = 0;
                let pos = {
                    x: null,
                    y: null
                };
                let pos2 = {
                    x: null,
                    y: null
                }
                textManager.stack.forEach((text) => {
                    if (text.value >= 0) {
                        if (num == 0) pos = {
                            x: text.x,
                            y: text.y
                        };
                        num += Math.abs(text.value);
                    } else {
                        if (num2 == 0) pos2 = {
                            x: text.x,
                            y: text.y
                        };
                        num2 += Math.abs(text.value);
                    }
                });
                if (num2 > 0) {
                    textManager.showText(pos2.x, pos2.y, Math.max(45, Math.min(50, num2)), 0.18, 500, num2, "#8ecc51");
                }
                if (num > 0) {
                    textManager.showText(pos.x, pos.y, Math.max(45, Math.min(50, num)), 0.18, 500, num, "#fff");
                }
                textManager.stack = [];
            }

            if (projectileTick.length) {
                projectileTick.forEach((tmp) => {
                    checkProjectileHolder(...tmp);
                });
                projectileTick = [];
            }

            for (let i = 0; i < data.length;) {
                tmpObj = findPlayerBySID(data[i]);
                if (tmpObj) {
                    if (!tmpObj.isTeam(player)) {
                        enemy.push(tmpObj);
                        if (tmpObj.dist2 <= items.weapons[tmpObj.primaryIndex == undefined ? 5 : tmpObj.primaryIndex].range + player.scale * 2 + 69) {
                            nears.push(tmpObj);
                        }
                    }
                    tmpObj.manageReload();
                }
                i += 13;
            }
            projectiles.forEach((proj) => {
                    tmpObj = proj;
                    if (tmpObj.active) {
                        tmpObj.tickUpdate(game.tickSpeed);
                    }
                });
            if (player && player.alive) {
                if (enemy.length) {
                    near = enemy.sort(function (tmp1, tmp2) {
                        return tmp1.dist2 - tmp2.dist2;
                    })[0];
                }
                if (game.tickQueue[game.tick]) {
                    game.tickQueue[game.tick].forEach((action) => {
                        action();
                    });
                    game.tickQueue[game.tick] = null;
                }
                antiSpike();
                if (advHeal.length) {
                    advHeal.forEach((updHealth) => {
                        let sid = updHealth[0];
                        let value = updHealth[1];
                        let damaged = updHealth[2];
                        let bullTicked = false;
                        tmpObj = findPlayerBySID(sid);

                        if (tmpObj.health <= 0) {
                            if (!tmpObj.death) {
                                tmpObj.death = true;
                                if (tmpObj != player) {
                                    ChText("", `${tmpObj.name} {${tmpObj.sid}} has died.`, "red");
                                }
                                addDeadPlayer(tmpObj);
                            }
                        }
                        let nearSpike = nearObjs.find(obj => ((obj.type == 1 && obj.y >= 12000) || (obj.dmg && !obj.isTeamObject(tmpObj))) && UTILS.getDist(obj, tmpObj, 0, 2) < obj.getScale(0.6, obj.isItem) + tmpObj.scale);
                        if (nearSpike && damaged == (nearSpike.dmg) * (tmpObj.skinIndex == 6 ? 0.75 : 1)) tmpObj.hitSpike = true;
                        if (damaged == 5 * (player.skinIndex == 6 ? 0.75 : 1)) {
                            player.bullTick = game.tick;
                            if (tmpObj.sid == player.sid) {
                                tmpObj.needTick = 0;
                                if (my.reSync) {
                                    my.reSync = false;
                                }
                                if (player.skinIndex == 7) {
                                    bullTicked = true;
                                } else {
                                    player.poisonCounter--;
                                }
                            }
                        }
                        if (tmpObj.sid == player.sid) {
                            if (inGame) {
                                let attackers = getAttacker(damaged);
                                let dmg = 100 - player.health;

                                let bullTickDmg = 5;
                                let shame = (near.primaryIndex == 5 && [undefined, 9, 12, 13, 15].includes(near.secondaryIndex)) ? 6 : [7, 8].includes(near.primaryIndex) ? 3 : 5;
                                tmpObj.addDamageThreat();
                                if (dmg + tmpObj.mostDamageThreat >= 100 && dmg + tmpObj.damageThreat < 100) {
                                    my.forceStop = true;
                                }
                                if (attackers.some(near => [undefined, 9, 12, 13, 15].includes(near.secondaryIndex))) {
                                    if (damaged > 39 && damaged < 80 && dmg + tmpObj.damageThreat >= 100) {
                                        if (game.tick - tmpObj.antiTimer > 1) {
                                            tmpObj.canEmpAnti = true;
                                            tmpObj.antiTimer = game.tick;
                                        }
                                        if (tmpObj.shameCount < shame) {
                                            healer();
                                        }
                                    } else if ([18.75, 22.5, 25, 26.25, 30, 35, 37.5, 50].includes(damaged) && dmg + tmpObj.damageThreat >= 100) {
                                        if (game.tick - tmpObj.antiTimer > 1) {
                                            tmpObj.canEmpAnti = true; //this makes it equip soldier cuz near player turret isint reloaded (u can go look at canEmpAnti code)
                                            tmpObj.antiTimer = game.tick;
                                        }
                                        if (tmpObj.shameCount < shame) {
                                            healer();
                                        }
                                    } else if (damaged > bullTickDmg && dmg + tmpObj.damageThreat >= 100) {
                                        if (tmpObj.shameCount < shame) {
                                            healer();
                                        }
                                    }
                                } else {
                                    if (damaged > bullTickDmg && dmg + tmpObj.damageThreat >= 100) {
                                        if (tmpObj.shameCount < shame) {
                                            healer();
                                        }
                                    }
                                }
                                if (damaged >= 20 && player.skinIndex == 11) instaC.canCounter = true;
                            }
                        }
                    });
                    advHeal = [];
                    healed = false;
                }
                players.forEach((tmp) => {
                    if (!tmp.visible && player != tmp) {
                        tmp.reloads = {
                            0: 0,
                            1: 0,
                            2: 0,
                            3: 0,
                            4: 0,
                            5: 0,
                            6: 0,
                            7: 0,
                            8: 0,
                            9: 0,
                            10: 0,
                            11: 0,
                            12: 0,
                            13: 0,
                            14: 0,
                            15: 0,
                            53: 0,
                        };
                    }
                });
                if (inGame) {
                   // console.log(player.x2, player.y2, player.oldPos.x2, player.oldPos.y2, UTILS.getDist(player, player, 2, 3), player.maxSpeed);
                    if (enemy.length) {
                        traps.preplaces[0] = [];
                        traps.preplaces[1] = [];
                        if (!traps.replaced) {
                            traps.autoReplace(traps.replaceSids);
                            traps.replaced = true;
                            traps.replaceSids = [];
                        }
                        if (player.inTrap && near.dist2 < 600) {
                            traps.autoPlace(1, 4, 2, true);
                        }
                        if (near.dist2 <= 169) {
                            if (near.inTrap) {
                                traps.autoPlace(0, 2, 4, true);
                            } else if (near.escaped) {
                                traps.autoPlace(0, 4, 2);
                            } else {
                                traps.autoPlace(1, 2, 4, true);
                            }
                        } else {
                            if (near.dist2 > 269 && near.dist2 < 400) {
                                traps.autoPlace(0, 4, 2);
                            } else if (near.dist2 <= 269) {
                                traps.autoPlace(1, 4, 2, true);
                            }
                        }
                        if (player.canEmpAnti) {
                            player.canEmpAnti = false;
                            if (near.dist2 <= 300 && !my.safePrimary(near) && !my.safeSecondary(near)) {
                                if (near.reloads[53] == 0){
                                    player.empAnti = true;
                                    player.soldierAnti = false;
                                    //modLog("EmpAnti");
                                } else {
                                    player.empAnti = false;
                                    player.soldierAnti = true;
                                    //modLog("SoldierAnti");
                                }
                            }
                        }
                        if (!instaC.isTrue && isC("predictTick").checked && my.anti0Tick <= 0) {
                            let spikeSync = knockBackPredict();
                            if (spikeSync == "insta them" && (![9, 12, 13, 15].includes(player.weapons[1]) || near.dist2 <= items.weapons[player.weapons[1]].range + player.scale * 1.8)) {
                                instaC.changeType("rev");
                            }
                            if (spikeSync == "primary sync") {
                                instaC.spikeTickType("rev")
                            }
                            let prehit = nearObjs.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 3) <= (tmp.scale + near.scale)).sort(function (a, b) {
                                return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                            })[0];
                            if (prehit) {
                                if (near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8 && !near.inTrap) {
                                    instaC.canSpikeTick = true;
                                }
                            }
                        }
                        if (!instaC.isTrue && isC("spikeTick").checked) {
                            if (near.inTrap && near.hitSpike && near.reloads[near.secondaryIndex == 10 ? near.secondaryIndex : near.primaryIndex] <= game.tickRate) {
                                if (my.anti0Tick > 0) {
                                    instaC.canSpikeTick = true;
                                } else {
                                    instaC.spikeTickType("rev");
                                }
                            }
                        }
                        if (isC("anti1tick").checked) {
                            //this works even if the second nearest person is one ticking you
                            nears.forEach((tmpObj) => {
                                if (tmpObj.primaryIndex == 5 && tmpObj.primaryVariant >= 2) {
                                    if (tmpObj.dist2 >= 169 && tmpObj.dist2 < 250) {
                                        if (tmpObj.skinIndex == 53) {
                                            my.anti0Tick = 3;
                                            predictHeal(1)
                                            player.chat.message = `Anti 1 tick by ${tmpObj.sid} ${tmpObj.name}`
                                            player.chat.count = 334;
                                }
                            }
                        }
                    })
                }
                //auto q when they havve short sword, katana, polearm
                if (isC("autoQonSync").checked && nears.length > 1 && player.shameCount < 5 && nears.some(tmpObj => [undefined, 3, 4, 5].includes(tmpObj.primaryIndex)) && secPacket < 60) {
                    my.anti0Tick = 3;
                    predictHeal(2)
                    player.chat.message = `sync detect test`
                            player.chat.count = 334
                        }
                if (isC("serverSync").checked && syncersInServer.length && nears.length) {
                    nears.forEach((near) => {
                        let myDist = near.dist2
                        syncersInServer.forEach((sid) => {
                            if (near.sid == sid) return;
                            let syncer = findPlayerBySID(sid)
                            let syncerDist = UTILS.getDist(syncer, near, 2, 2)
                            if (myDist <= player.scale*1.8 + items.weapons[player.weapons[0]].range && syncerDist <= player.scale*1.8 + items.weapons[syncer.primaryIndex||5].range && player.reloads[player.weapons[0]] <= ping/2 && syncer.reloads[syncer.primaryIndex||5] == 0) {
                                instaC.spikeTickType();
                            }
                        })
                    })
                }
            }
            if (near.dist2 <= items.weapons[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]].range + near.scale * 1.8 && instaC.wait && !instaC.isTrue && !my.waitHit && player.reloads[player.weapons[0]] <= ping/2 && player.reloads[player.weapons[1]] <= ping/2 && instaC.perfCheck(player, near)) {
                instaC.can = true;
            } else {
                instaC.can = false;
            }
            macro.q && place(0, getAttackDir());
            macro.f && place(4, getSafeDir());
            macro.v && place(2, getSafeDir());
            macro.y && place(5, getSafeDir());
            macro.h && place(player.getItemType(22), getSafeDir());
            macro.n && place(3, getSafeDir());
                    if (macro.g) {
    let freeRanges = angleRanges(4);
                        console.log(freeRanges)

    freeRanges.forEach(([start, end]) => {
        let itemId = player.items[4];
        if (itemId == undefined) return;
        let item = items.list[itemId];

        let tmpS = player.scale + item.scale + (item.placeOffset || 0);

        let step = ((end - start + Math.PI * 2) % (Math.PI * 2)) / 5;

        for (let i = 0; i <= 5; i++) {
            let angle = start + step * i;
            if (angle > Math.PI) angle -= 2 * Math.PI;

            let tmpX = player.x2 + tmpS * Math.cos(angle);
            let tmpY = player.y2 + tmpS * Math.sin(angle);

            preplaceVisible.push({
                x: tmpX,
                y: tmpY,
                name: item.name,
                scale: item.scale
            });

            game.tickBase(() => {
                preplaceVisible.shift();
            }, 1);
        }
    });
                    }
            /*   if (macro.l) {
                        let targetPlayer = findPlayerBySID(parseInt(getEl("targetSid").value));
                        if (targetPlayer) {
                            if (isC("hatType").checked && isC("hatType").options.value != "ag") {
                                packet("9", targetPlayer.aim2, 1);
                                if (targetPlayer.dist2 >= 145) {
                                    if (player.items[4] != 15) {
                                        place(4, targetPlayer.aim2)
                                    }
                                }
                            }
                            if (targetPlayer.dist2 <= 70) {
                                traps.testCanPlace(2, 0, Math.PI * 2, Math.PI/4, targetPlayer.aim2 + Math.PI/4, 0, 1);
                            }
                        }
                    }*/
            sendMoveDir();
            if (UTILS.getDist(my.millPlacePos, player, 0, 2) > 99) {
                if (mills.place) {
                    let placeAngle = player.items[4] == 16 ? 1.4 : 1.20427718
                    traps.testCanPlace(3, -placeAngle, placeAngle+0.0001, placeAngle, UTILS.getDirect(my.millPlacePos, player, 0, 2))
                }
                if (mills.placeSpawnPads) {
                    traps.testCanPlace(player.getItemType(20), 0, Math.PI*2, Math.PI/2, UTILS.getDirect(player.oldPos, player, 2, 2))
                }
                my.millPlacePos = {
                    x: player.x2,
                    y: player.y2
                }
            }
            safeWalk();
            if (!my.safeWalk) {
                tryAutoPush();
                if (!my.autoPush && !debugStop) {
                    if (isC("autoPlay").checked && enemy.length && near.dist2 < PF.scale / 2) {
                        let result = createPath.calc({x: Math.cos(near.aim2 + Math.PI/2) * (near.scale * 2), y: Math.sin(near.aim2 + Math.PI/2) * (near.scale * 2)}, false, "follow");
                        PF.paths = result.paths;
                        PF.attempts = result.attempts;
                        if (PF.paths.length > 0) {
                            PF.finded = true;
                            //  player.lastStop.active = false;
                            let dir = UTILS.getDirect(PF.paths[1], player, 0, 2);
                            packet("9", dir, 1);
                        } else {
                            if (PF.attempts < 20) {
                                result = createPath.calc({x:0, y:0}, true, "follow");
                                PF.paths = result.paths;
                                PF.attempts = result.attempts;
                                if (PF.paths.length > 0) {
                                    PF.finded = true;
                                    // player.lastStop.active = false;
                                    let dir = UTILS.getDirect(PF.paths[1], player, 0, 2);
                                    packet("9", dir, 1);
                                } else {
                                    PF.finded = false;
                                    packet("9", player.moveDir, 1)
                                }
                            } else {
                                PF.finded = false;
                            }
                        }
                    } else {
                        PF.finded = false;
                    }
                } else {
                    PF.finded = false;
                }
            } else {
                if (my.autoPush) {
                    my.autoPush = false;
                    packet("9", player.moveDir, 1);
                }
            }
            if (instaC.can && !my.anti0Tick && secPacket < 69) {
                instaC.changeType((isC("revInsta").checked || player.weapons[1] == 10) ? "rev" : "normal");
            }
            if (instaC.canCounter && !my.anti0Tick && secPacket < 69) {
                instaC.canCounter = false;
                if (player.reloads[player.weapons[0]] <= ping/2 && !instaC.isTrue) {
                    instaC.counterType();
                }
            }
            if (instaC.canSpikeTick && !my.anti0Tick && secPacket < 69) {
                instaC.canSpikeTick = false;
                if (player.reloads[player.weapons[0]] <= ping/2 && !instaC.isTrue) {
                    instaC.spikeTickType();
                }
            }
            autoBreak.calculateAim();
            if (my.forceStop && autoGathering) {
                sendAutoGather();
            } else {
                if (!clicks.middle && !clicks.left && !clicks.right && !instaC.isTrue && !autoBreak.active && autoGathering) {
                    sendAutoGather();
                }
                if (!clicks.middle && (clicks.left || clicks.right) && !instaC.isTrue) {
                    if ((player.weaponIndex != (clicks.right && autoBreak.useHammer() ? player.weapons[1] : player.weapons[0])) || player.buildIndex > -1) {
                        selectWeapon(clicks.right && autoBreak.useHammer() ? player.weapons[1] : player.weapons[0]);
                    }
                    if (player.reloads[clicks.right && autoBreak.useHammer() ? player.weapons[1] : player.weapons[0]] <= ping/2 && !my.waitHit && !autoGathering) {
                        sendAutoGather();
                        my.waitHit = 1;
                        game.tickBase(() => {
                            my.waitHit = 0
                        }, 1)
                    }
                }
                if (autoBreak.active) {
                    if (!clicks.left && !clicks.right && !instaC.isTrue) {
                        let weapon = autoBreak.useHammer(autoBreak.target) ? player.weapons[1] : player.weapons[0];
                        if (player.weaponIndex != weapon || player.buildIndex > -1) {
                            selectWeapon(weapon);
                        }
                        if (player.reloads[weapon] <= ping/2 && !my.waitHit && !autoGathering) {
                            sendAutoGather();
                            my.waitHit = 1;
                            game.tickBase(() => {
                                my.waitHit = 0;
                            }, 1)
                        }
                    }
                }
            }
            if (clicks.middle && !player.inTrap) {
                if (!instaC.isTrue && player.reloads[player.weapons[1]] <= ping/2) {
                    if (my.ageInsta && player.weapons[0] != 4 && player.weapons[1] == 9 && player.age >= 9 && enemy.length) {
                        instaC.bowMovement();
                    } else {
                        instaC.rangeType();
                    }
                }
            }
            if (macro.t && !player.inTrap) {
                if (!instaC.isTrue && player.reloads[player.weapons[0]] <= ping/2 && (player.weapons[1] == 15 ? (player.reloads[player.weapons[1]] <= ping) : true) && (player.weapons[0] == 5 || (player.weapons[0] == 4 && player.weapons[1] == 15))) {
                    instaC[getEl("button2").checked ? "newTickMovement" : "tickMovement"]();
                }
            }
                    if (!macro.t && !instaC.isTrue && instaC.ticking) {
                        instaC.ticking = false;
                    }
            if (macro["."] && !player.inTrap) {
                if (!instaC.isTrue && player.reloads[player.weapons[0]] <= ping/2 && ([9, 12, 13, 15].includes(player.weapons[1]) ? (player.reloads[player.weapons[1]] <= ping) : true)) {
                    instaC.boostTickMovement();
                }
            }
            if (player.weapons[1] && !clicks.left && !clicks.right && !player.inTrap && !instaC.isTrue && !autoBreak.active) {
                if (player.reloads[player.weapons[0]] <= ping/2 && player.reloads[player.weapons[1]] <= ping/2) {
                    if (!my.reloaded) {
                        my.reloaded = true;
                        let fastSpeed = items.weapons[player.weapons[0]].spdMult < items.weapons[player.weapons[1]].spdMult ? 1 : 0;
                        if (player.weaponIndex != player.weapons[fastSpeed] || player.buildIndex > -1) {
                            selectWeapon(player.weapons[fastSpeed]);
                        }
                    }
                } else {
                    my.reloaded = false;
                    if (optimisingAutoReloadFunction(player.weapons[0])) {
                        if (optimisingAutoReloadFunction_2(player.weapons[0])) {
                            selectWeapon(player.weapons[0]);
                        }
                    } else if (optimisingAutoReloadFunction(player.weapons[1])) {
                        if (optimisingAutoReloadFunction_2(player.weapons[1])) {
                            selectWeapon(player.weapons[1]);
                        }
                    }
                }
            }
            if (!macro.q && !macro.f && !macro.v && !macro.h && !macro.n) {
                if (autoBreak.active) {
                    if (player.reloads[autoBreak.useHammer(autoBreak.target) ? player.weapons[1] : player.weapons[0]] == 0) {
                        packet("D", getAttackDir());
                    }
                } else {
                    packet("D", getAttackDir());
                }
            }
            if (storeMenu.style.display != "block" && !instaC.isTrue && !instaC.ticking) {
                hatChanger();
                accChanger();
            }
            //lastMoveDir = getSafeDir();
            //packet("33", lastMoveDir, 1);
            /* if (configs.autoPush && enemy.length && nears.length < 3 && !debugStop && !my.safeWalk) {
                       /* if (near.inTrap && near.dist2 <= PF.scale / 2) {
                            let items = gameObjects.filter(e => {
                                if (!e.active) return false;
                                if (UTILS.getDist(e, player, 0, 2) < 500) {
                                    if (e.dmg) {
                                        if (e.isTeamObject(player) && UTILS.getDist(e, near.inTrap, 0, 0) <= 75 + e.scale) {
                                            return true;
                                        } else {
                                            return false
                                        }
                                    } else if (e.type == 1 && e.y >= 12000) {
                                        if (UTILS.getDist(e, near.inTrap, 0, 0) <= 75 + e.scale) {
                                            return true;
                                        } else {
                                            return false;
                                        }
                                    } else {
                                        return false;
                                    }
                                }
                            });
                            let push = function (tmp, closest) {
                                if (!nearObjs.find(e => e.active && !e.ignoreCollision && e.sid != closest.sid && UTILS.getDist(tmp, e, 0, 0) <= e.scale - 9)) {
                                    if (near.dist2 > 90) {
                                        let result = createPath.calc(tmp, false, "auto push");
                                        PF.paths = result.paths;
                                        PF.attempts = result.attempts;
                                        if (PF.paths.length > 0) {
                                            PF.finded = true;
                                            PF.active = true;
                                            let dir = UTILS.getDirect(PF.paths[1], player, 0, 2);
                                            my.autoPush = true
                                            packet("9", dir, 1);
                                        } else {
                                            PF.active = false;
                                            if (my.autoPush) {
                                                my.autoPush = false;
                                                packet("9", player.moveDir, 1);
                                            }
                                        }
                                    } else {
                                        PF.active = false;
                                        my.autoPush = true
                                        packet("9", Math.atan2(tmp.y - player.y2, tmp.x - player.x2), 1)
                                    }
                                } else {
                                    PF.active = false;
                                    if (my.autoPush) {
                                        my.autoPush = false;
                                        packet("9", player.moveDir, 1);
                                    }
                                }
                            };
                            if (items.length) {
                                let closest = items.sort((a, b) => b.health - a.health).sort((a, b) => UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2));
                                if (items.length == 1) {
                                    closest = closest[0];
                                } else {
                                    let spike1 = closest[0];
                                    let spike2 = closest.filter(e => e.sid != spike1.sid).sort((a, b) => UTILS.getDist(a, spike1, 0, 0) - UTILS.getDist(b, spike1, 0, 0))[0];
                                    let midPoint = UTILS.findMiddlePoint(spike1, spike2);
                                    if (UTILS.getDist(midPoint, spike1, 0, 0) <= 32 + spike1.scale && UTILS.getDist(midPoint, spike2, 0, 0) <= 32 + spike2.scale) {
                                        closest = {
                                            x: midPoint.x,
                                            y: midPoint.y
                                        };
                                    } else {
                                        closest = closest[0];
                                    }
                                }
                                if (closest) {
                                    let angle = Math.atan2(near.y2 - closest.y, near.x2 - closest.x);
                                    let addon = UTILS.getDist(near, player, 2, 2) > 75 ? 60 : 50;
                                    if (addon == 55 && UTILS.getAngleDist(near.aim2, angle + Math.PI) > Math.PI / 1.5) {
                                        addon = 70;
                                    }
                                    let distance = UTILS.getDist(closest, near, 0, 2) + addon;
                                    if (closest.dmg && distance <= 35 * 3 + closest.scale) {
                                        distance = UTILS.getDist(closest, near, 0, 2) + 60;
                                    }
                                    let tmp = {
                                        x: closest.x + Math.cos(angle) * distance,
                                        y: closest.y + Math.sin(angle) * distance
                                    };
                                    push(tmp, closest);
                                } else {
                                    PF.active = false;
                                    if (my.autoPush) {
                                        my.autoPush = false;
                                        packet("9", player.moveDir, 1);
                                    }
                                }
                            } else {
                                PF.active = false;
                                if (my.autoPush) {
                                    my.autoPush = false;
                                    packet("9", player.moveDir, 1);
                                }
                            }
                        } else {
                            PF.active = false;
                            if (my.autoPush) {
                                my.autoPush = false;
                            }
                        }*/
            instaC.syncHit &&= false;
            player.empAnti &&= false;
            player.soldierAnti &&= false;
            if (my.anti0Tick > 0) {
                my.anti0Tick--;
            }
            if (isC("weaponGrind").checked) {
                traps.testCanPlace(player.getItemType(22), 0, Math.PI*2, Math.PI/2, 0)
            }
            my.predictSpikes &&= false;
            my.forceStop &&= false;
            my.antiInsta &&= false;
            autoBreak.priority = [[], [], [], []];
        }
    }

}

 // UPDATE LEADERBOARD:
// Get the leaderboard element
let leaderboardElement = document.getElementById('leaderboard');

// Function to update the leaderboard
function updateLeaderboard(data) {
    // Clear any existing leaderboard content
    leaderboardElement.innerHTML = '';

    // Loop through the leaderboard data
    for (let i = 0; i < data.length; i += 3) {
        // Get the player name and score
        let playerName = data[i + 1];
        let playerScore = data[i + 2];

        // Create a new leaderboard item
        let leaderboardItem = document.createElement('div');
        leaderboardItem.classList.add('leaderboard-item');

        // Set the styles for the leaderboard item
        leaderboardItem.style.display = 'flex';
        leaderboardItem.style.justifyContent = 'space-between';
        leaderboardItem.style.alignItems = 'center';
        leaderboardItem.style.color = data[i] === player.sid ? '#fffb95' : syncersInServer.includes(data[i]) ? '#FF0000' : playersInServer.includes(data[i]) ? '#00ff00' : '#fff';
        leaderboardItem.style.fontWeight = 'bold';
        leaderboardItem.style.fontSize = '16px';
        leaderboardItem.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.5)';
        leaderboardItem.style.backgroundColor = 'rgba(30, 30, 30, 0.7)';
        leaderboardItem.style.padding = '10px 15px';
        leaderboardItem.style.borderRadius = '8px';
        leaderboardItem.style.marginBottom = '10px';
        leaderboardItem.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';
        leaderboardItem.style.transition = 'transform 0.3s ease-in-out';

        // Add hover effect
        leaderboardItem.addEventListener('mouseover', () => {
            leaderboardItem.style.transform = 'translateY(-2px)';
        });
        leaderboardItem.addEventListener('mouseout', () => {
            leaderboardItem.style.transform = 'translateY(0)';
        });

        // Create the player name and score elements
        let playerNameElement = document.createElement('div');
        playerNameElement.textContent = playerName;
        let playerScoreElement = document.createElement('div');
        playerScoreElement.textContent = UTILS.sFormat(playerScore) || '0';

        // Append the name and score to the leaderboard item
        leaderboardItem.appendChild(playerNameElement);
        leaderboardItem.appendChild(playerScoreElement);

        // Add the leaderboard item to the leaderboard element
        leaderboardElement.appendChild(leaderboardItem);

        // Add the white divider
        if (i < data.length - 3) {
            let divider = document.createElement('div');
            divider.classList.add('leaderboard-divider');
            divider.style.height = '1px';
            divider.style.width = '100%';
            divider.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            divider.style.marginBottom = '10px';
            leaderboardElement.appendChild(divider);
        }
    }
}



      // LOAD GAME OBJECT:
function loadGameObject(data) {
    for (let i = 0; i < data.length;) {
        objectManager.add(data[i], data[i + 1], data[i + 2], data[i + 3], data[i + 4],
                          data[i + 5], items.list[data[i + 6]], true, (data[i + 7] >= 0 ? {
            sid: data[i + 7]
        } : null));
        // sid, x, y, dir, s, type, data, setSID, owner
        /*let dist = UTILS.getDist({
                        x: data[i + 1],
                        y: data[i + 2]
                    }, player, 0, 2);
                    let aim = UTILS.getDirect({
                        x: data[i + 1],
                        y: data[i + 2]
                    }, player, 0, 2);
                    find = findObjectBySid(data[i]);
                    if (data[i + 6] == 15) {
                        if (find && !find.isTeamObject(player)) {
                            if (dist <= 100) {
                                traps.dist = dist;
                                traps.aim = aim;
                                traps.protect(aim);
                            }
                        }
                    }*/
        i += 8;
    }
}


        // ADD AI:
        function loadAI(data) {
            for (let i = 0; i < ais.length; ++i) {
                ais[i].forcePos = !ais[i].visible;
                ais[i].visible = false;
            }
            if (data) {
                let tmpTime = performance.now();
                for (let i = 0; i < data.length;) {
                    tmpObj = findAIBySID(data[i]);
                    if (tmpObj) {
                        tmpObj.index = data[i + 1];
                        tmpObj.t1 = (tmpObj.t2 === undefined) ? tmpTime : tmpObj.t2;
                        tmpObj.t2 = tmpTime;
                        tmpObj.x1 = tmpObj.x;
                        tmpObj.y1 = tmpObj.y;
                        tmpObj.x2 = data[i + 2];
                        tmpObj.y2 = data[i + 3];
                        tmpObj.d1 = (tmpObj.d2 === undefined) ? data[i + 4] : tmpObj.d2;
                        tmpObj.d2 = data[i + 4];
                        tmpObj.health = data[i + 5];
                        tmpObj.dt = 0;
                        tmpObj.visible = true;
                    } else {
                        tmpObj = aiManager.spawn(data[i + 2], data[i + 3], data[i + 4], data[i + 1]);
                        tmpObj.x2 = tmpObj.x;
                        tmpObj.y2 = tmpObj.y;
                        tmpObj.d2 = tmpObj.dir;
                        tmpObj.health = data[i + 5];
                        if (!aiManager.aiTypes[data[i + 1]].name)
                            tmpObj.name = config.cowNames[data[i + 6]];
                        tmpObj.forcePos = true;
                        tmpObj.sid = data[i];
                        tmpObj.visible = true;
                    }
                    i += 7;
                }
            }
        }

        // ANIMATE AI:
        function animateAI(sid) {
            tmpObj = findAIBySID(sid);
            if (tmpObj) tmpObj.startAnim();
        }

        // GATHER ANIMATION:
        function gatherAnimation(sid, didHit, index) {
            tmpObj = findPlayerBySID(sid);
            if (tmpObj) {
                tmpObj.startAnim(didHit, index);
                tmpObj.gatherIndex = index;
                tmpObj.gathering = 1;
                tmpObj.lastGather = Date.now();
                if (didHit) {
                    let tmpObjects = objectManager.hitObj;
                    objectManager.hitObj = [];
                    game.tickBase(() => {
                        // refind
                        tmpObj = findPlayerBySID(sid);
                        let val = items.weapons[index].dmg * (config.weaponVariants[tmpObj[(index < 9 ? "prima" : "seconda") + "ryVariant"]].val) * (items.weapons[index].sDmg || 1) * (tmpObj.skinIndex == 40 ? 3.3 : 1);
                        tmpObjects.forEach((healthy) => {
                            healthy.health -= val;
                        });
                    }, 1);
                }
            }
        }

        // WIGGLE GAME OBJECT:
        function wiggleGameObject(dir, sid) {
            tmpObj = findObjectBySid(sid);
            if (tmpObj) {
                tmpObj.xWiggle += config.gatherWiggle * Math.cos(dir);
                tmpObj.yWiggle += config.gatherWiggle * Math.sin(dir);
                if (tmpObj.health) {
                    //tmpObj.damaged = Math.min(255, tmpObj.damaged + 60);
                    objectManager.hitObj.push(tmpObj);
                }
            }
        }

        // SHOOT TURRET:
        function shootTurret(sid, dir) {
            tmpObj = findObjectBySid(sid);
            if (tmpObj) {
                if (config.anotherVisual) {
                    tmpObj.lastDir = dir;
                } else {
                    tmpObj.dir = dir;
                }
                tmpObj.xWiggle += config.gatherWiggle * Math.cos(dir + Math.PI);
                tmpObj.yWiggle += config.gatherWiggle * Math.sin(dir + Math.PI);
            }
        }

let killCount = 0;

function showKillMessage(victimName) {
    killCount++;

    const messageDiv = document.createElement('div');
    messageDiv.textContent = `You killed: ${near.name}`;

    Object.assign(messageDiv.style, {
        position: "fixed",
        top: "80px",
        left: "50%",
        transform: "translateX(-50%) translateY(-50px)",
        backgroundColor: "#e74c3c",
        backgroundImage: "linear-gradient(to right, rgba(104, 121, 85, 0.94), rgb(117, 17, 239))",
        color: "#ffffff",
        padding: "10px 25px",
        borderRadius: "15px",
        fontSize: "1.1rem",
        fontWeight: "bold",
        letterSpacing: "1px",
        textShadow: "0 0 5px rgba(255,255,255,0.7)",
        zIndex: "1000",
        boxShadow: "0 8px 20px rgba(0, 0, 0, 0.4), 0 0 15px rgba(132, 115, 114, 0.9)",
        opacity: "0",
        transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
        willChange: "opacity, transform"
    });

    document.body.appendChild(messageDiv);

    requestAnimationFrame(() => {
        messageDiv.style.opacity = "1";
        messageDiv.style.transform = "translateX(-50%) translateY(0)";
    });

    setTimeout(() => {
        messageDiv.style.opacity = "0";
        messageDiv.style.transform = "translateX(-50%) translateY(-50px)";
        messageDiv.addEventListener("transitionend", () => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, { once: true });
    }, 2500);
}

// UPDATE PLAYER VALUE:
        function updatePlayerValue(index, value, updateView) {
            if (player) {
                player[index] = value;
                if (index == "points") {
                    if (isC("autoBuy").checked) {
                        autoBuy.buyNext();
                    }
                } else if (index == "kills") {
                    if (isC("killChat").checked) {
                      showKillMessage();
                        sendChat("project aurora!");
                       setTimeout(() => {
                      sendChat("");
                          }, 1400);
                    }
                }
            }
        }


// Function to get a varying kill chat message
function getKillChatMessage(kills) {
    // Calculate the base kill count
    let baseKillCount = Math.floor(kills / 10) * 10;

    if (kills <= 1) {
        return "";
    } else {
        // Display additional information when the kill count crosses a multiple of 10
        let additionalInfo = "x" + Math.floor(kills / 10); // Adjusted the calculation
        return additionalInfo; // Return the additionalInfo
    }
}


        // ACTION BAR:
        function updateItems(data, wpn) {
            if (data) {
                if (wpn) {
                    player.weapons = data;
                    player.primaryIndex = player.weapons[0];
                    player.secondaryIndex = player.weapons[1];
                    if (!instaC.isTrue) {
                        selectWeapon(player.weapons[0]);
                    }
                } else {
                    player.items = data;
                }
            }
            for (let i = 0; i < items.list.length; i++) {
                let tmpI = items.weapons.length + i;
                getEl("actionBarItem" + tmpI).style.display = player.items.indexOf(items.list[i].id) >= 0 ? "inline-block" : "none";
            }
            for (let i = 0; i < items.weapons.length; i++) {
                getEl("actionBarItem" + i).style.display = player.weapons[items.weapons[i].type] == items.weapons[i].id ? "inline-block" : "none";
            }
            let kms = player.weapons[0] == 3 && player.weapons[1] == 15;
            if (kms) {
                getEl("actionBarItem3").style.display = "none";
                getEl("actionBarItem4").style.display = "inline-block";
            }
        }

        // ADD PROJECTILE:
        function addProjectile(x, y, dir, range, speed, indx, layer, sid) {
            projectileManager.addProjectile(x, y, dir, range, speed, indx, null, null, layer, inWindow).sid = sid;
            projectileTick.push(Array.prototype.slice.call(arguments));
        }

        // REMOVE PROJECTILE:
        function remProjectile(sid, range) {
            for (let i = 0; i < projectiles.length; ++i) {
                if (projectiles[i].sid == sid) {
                    projectiles[i].range = range;
                    let tmpObjects = objectManager.hitObj;
                    objectManager.hitObj = [];
                    game.tickBase(() => {
                        let val = projectiles[i].dmg;
                        tmpObjects.forEach((healthy) => {
                            if (healthy.projDmg) {
                                healthy.health -= val;
                            }
                        });
                    }, 1);
                }
            }
        }

        function serverShutdownNotice(time) {
            shutdownDisplay.innerHTML = `Server restarting in ${time}s`
        }

        // SHOW ALLIANCE MENU:
        function allianceNotification(sid, name) {

        }

        function setPlayerTeam(team, isOwner) {
            if (player) {
                player.team = team;
                player.isOwner = isOwner;
                if (team == null) {
                    alliancePlayers = [];
                }
            }
        }

        function setAlliancePlayers(data) {
            alliancePlayers = data;
        }

        // STORE MENU:
        function updateStoreItems(type, id, index) {
            if (index) {
                if (!type) {
                    player.tails[id] = 1;
                } else {
                    player.latestTail = id;
                }
            } else {
                if (!type) {
                    player.skins[id] = 1
                } else {
                    player.latestSkin = id;
                }
            }
        }
        function isTeam(tmpObj) {
            return (tmpObj == player || (tmpObj.team && tmpObj.team == player.team));
        }

        // SEND MESSAGE:
        function receiveChat(sid, message) {
            message = DOMPurify.sanitize(message);
            let tmpPlayer = findPlayerBySID(sid);
            if (tmpPlayer) {
                ChText(`${tmpPlayer.name} {${tmpPlayer.sid}}`, message, tmpPlayer == player || (tmpPlayer.team && tmpPlayer.team == player.team) ? "#8ecc51" : "#fff");
                tmpPlayer.chatMessage = message;
                tmpPlayer.chatCountdown = config.chatCountdown;
                /* if (tmpPlayer.team == player.team && message == getEl("syncChat").value) {
                    instaC.musketSync();
                }*/
                if (isC("cMirr").checked) {
        if (message.includes(tmpPlayer.chatMessage));
        io.send("6", tmpPlayer.chatMessage)
    }
            if (message.includes("mod")) sendChat("");
            if (message.includes("dc")) sendChat("");
        }
    }

        // MINIMAP:
        function updateMinimap(data) {
            minimapData = data;
        }

// SHOW ANIM TEXT:
function showText(x, y, value, type) {
    // if (config.anotherVisual) {
    textManager.stack.push({
        x: x,
        y: y,
        value: value
    });
    // } else {
    //     textManager.showText(x, y, 50, 0.18, useWasd ? 500 : 1500, Math.abs(value), (value >= 0) ? "#fff" : "#8ecc51");
    // }
}
        function showSettingText(life, setting) {
            textManager.showText(player.x, player.y, player.scale, 0.1, life, setting, "#fff");
        }


        // RENDER LEAF:
        function renderLeaf(x, y, l, r, ctxt) {
            let endX = x + (l * Math.cos(r));
            let endY = y + (l * Math.sin(r));
            let width = l * 0.4;
            ctxt.moveTo(x, y);
            ctxt.beginPath();
            ctxt.quadraticCurveTo(((x + endX) / 2) + (width * Math.cos(r + Math.PI / 2)),
                                  ((y + endY) / 2) + (width * Math.sin(r + Math.PI / 2)), endX, endY);
            ctxt.quadraticCurveTo(((x + endX) / 2) - (width * Math.cos(r + Math.PI / 2)),
                                  ((y + endY) / 2) - (width * Math.sin(r + Math.PI / 2)), x, y);
            ctxt.closePath();
            ctxt.fill();
            ctxt.stroke();
        }
        /*
                    if (configs.autoPlay || my.autoPush) {
                mainContext.globalAlpha = 1;
                for (let i = 0; i < PF.paths.length; i++) {
                    let path = PF.paths[i];

                    let posX = path.x - xOffset;
                    let posY = path.y - yOffset;

                    mainContext.beginPath();
                    mainContext.fillStyle = `rgb(${(i + 1) / PF.paths.length * 85}, ${(i + 1) / PF.paths.length * 127.5}, ${(i + 1) / PF.paths.length * 225})`;
                    mainContext.arc(posX, posY, 10, 0, Math.PI*2);
                    mainContext.fill();
                }
            }
            */
        function renderPathFinder(ctx, offset) {
            if (PF.active) {
                ctx.lineWidth = 6;
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.strokeStyle = "#ff0008";
                ctx.moveTo(player.x - offset.x, player.y - offset.y);
                for (let i = 0; i < PF.paths.length; i++) {
                    let path = PF.paths[i];
                    if (path) {
                        ctx.lineTo(path.x - offset.x, path.y - offset.y);
                    }
                }
                ctx.stroke();
                if (my.pushData) {
                    ctx.lineWidth = 6;
                    ctx.beginPath();
                    ctx.strokeStyle = "#fff";
                    ctx.moveTo(PF.paths[PF.paths.length - 1].x - offset.x, PF.paths[PF.paths.length - 1].y - offset.y);
                    ctx.lineTo(my.pushData.x - offset.x, my.pushData.y - offset.y);
                    ctx.stroke();
                }
            } else if (my.autoPush) {
                ctx.lineWidth = 6;
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.strokeStyle = "#520a8c";
                ctx.moveTo(player.x - offset.x, player.y - offset.y);
                ctx.lineTo(my.pushData.x2 - offset.x, my.pushData.y2 - offset.y);
                ctx.lineTo(my.pushData.x - offset.x, my.pushData.y - offset.y);
                ctx.stroke();
            } else if (PF.finded) {
                ctx.globalAlpha = 1;
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.strokeStyle = "#ff0008";
                ctx.moveTo(player.x - offset.x, player.y - offset.y);
                let optimise = PF.paths.length
                for (let i = 0; i < optimise; i++) {
                    let path = PF.paths[i];
                    if (path) {
                        ctx.lineTo(path.x - offset.x, path.y - offset.y);
                    }
                }
                ctx.stroke();
            }
        }

        // RENDER CIRCLE:
        function renderCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
            tmpContext = tmpContext || mainContext;
            tmpContext.beginPath();
            tmpContext.arc(x, y, scale, 0, 2 * Math.PI);
            if (!dontFill) tmpContext.fill();
            if (!dontStroke) tmpContext.stroke();
        }

        function renderHealthCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
            tmpContext = tmpContext || mainContext;
            tmpContext.beginPath();
            tmpContext.arc(x, y, scale, 0, 2 * Math.PI);
            if (!dontFill) tmpContext.fill();
            if (!dontStroke) tmpContext.stroke();
        }

        // RENDER STAR SHAPE:
        function renderStar(ctxt, spikes, outer, inner) {
            let rot = Math.PI / 2 * 3;
            let x, y;
            let step = Math.PI / spikes;
            ctxt.beginPath();
            ctxt.moveTo(0, -outer);
            for (let i = 0; i < spikes; i++) {
                x = Math.cos(rot) * outer;
                y = Math.sin(rot) * outer;
                ctxt.lineTo(x, y);
                rot += step;
                x = Math.cos(rot) * inner;
                y = Math.sin(rot) * inner;
                ctxt.lineTo(x, y);
                rot += step;
            }
            ctxt.lineTo(0, -outer);
            ctxt.closePath();
        }

        function renderHealthStar(ctxt, spikes, outer, inner) {
            let rot = Math.PI / 2 * 3;
            let x, y;
            let step = Math.PI / spikes;
            ctxt.beginPath();
            ctxt.moveTo(0, -outer);
            for (let i = 0; i < spikes; i++) {
                x = Math.cos(rot) * outer;
                y = Math.sin(rot) * outer;
                ctxt.lineTo(x, y);
                rot += step;
                x = Math.cos(rot) * inner;
                y = Math.sin(rot) * inner;
                ctxt.lineTo(x, y);
                rot += step;
            }
            ctxt.lineTo(0, -outer);
            ctxt.closePath();
        }

        // RENDER RECTANGLE:
        function renderRect(x, y, w, h, ctxt, dontStroke, dontFill) {
            if (!dontFill) ctxt.fillRect(x - (w / 2), y - (h / 2), w, h);
            if (!dontStroke) ctxt.strokeRect(x - (w / 2), y - (h / 2), w, h);
        }

        function renderHealthRect(x, y, w, h, ctxt, dontStroke, dontFill) {
            if (!dontFill) ctxt.fillRect(x - (w / 2), y - (h / 2), w, h);
            if (!dontStroke) ctxt.strokeRect(x - (w / 2), y - (h / 2), w, h);
        }

        // RENDER RECTCIRCLE:
        function renderRectCircle(x, y, s, sw, seg, ctxt, dontStroke, dontFill) {
            ctxt.save();
            ctxt.translate(x, y);
            seg = Math.ceil(seg / 2);
            for (let i = 0; i < seg; i++) {
                renderRect(0, 0, s * 2, sw, ctxt, dontStroke, dontFill);
                ctxt.rotate(Math.PI / seg);
            }
            ctxt.restore();
        }

        // RENDER BLOB:
        function renderBlob(ctxt, spikes, outer, inner) {
            let rot = Math.PI / 2 * 3;
            let x, y;
            let step = Math.PI / spikes;
            let tmpOuter;
            ctxt.beginPath();
            ctxt.moveTo(0, -inner);
            for (let i = 0; i < spikes; i++) {
                tmpOuter = UTILS.randInt(outer + 0.9, outer * 1.2);
                ctxt.quadraticCurveTo(Math.cos(rot + step) * tmpOuter, Math.sin(rot + step) * tmpOuter,
                                      Math.cos(rot + (step * 2)) * inner, Math.sin(rot + (step * 2)) * inner);
                rot += step * 2;
            }
            ctxt.lineTo(0, -inner);
            ctxt.closePath();
        }

        // RENDER TRIANGLE:
        function renderTriangle(s, ctx) {
            ctx = ctx || mainContext;
            let h = s * (Math.sqrt(3) / 2);
            ctx.beginPath();
            ctx.moveTo(0, -h / 2);
            ctx.lineTo(-s / 2, h / 2);
            ctx.lineTo(s / 2, h / 2);
            ctx.lineTo(0, -h / 2);
            ctx.fill();
            ctx.closePath();
        }

        // RENDER POLYGON:
        function renderPolygon(mainContext, sides, diameter) {
            let lineWidth = mainContext.lineWidth || 0;
            let radius = diameter / 2;
            mainContext.beginPath();
            let angles = (Math.PI * 2) / sides;

            for (let index = 0; index < sides; index++) {
                let x = radius + (radius - lineWidth / 2) * Math.cos(angles * index);
                let y = radius + (radius - lineWidth / 2) * Math.sin(angles * index);
                mainContext.lineTo(x, y);
            }

            mainContext.closePath();
        }

        // PREPARE MENU BACKGROUND:
        function prepareMenuBackground() {
            var tmpMid = config.mapScale / 2;
            objectManager.add(0, tmpMid, tmpMid + 200, 0, config.treeScales[3], 0);
            objectManager.add(1, tmpMid, tmpMid - 480, 0, config.treeScales[3], 0);
            objectManager.add(2, tmpMid + 300, tmpMid + 450, 0, config.treeScales[3], 0);
            objectManager.add(3, tmpMid - 950, tmpMid - 130, 0, config.treeScales[2], 0);
            objectManager.add(4, tmpMid - 750, tmpMid - 400, 0, config.treeScales[3], 0);
            objectManager.add(5, tmpMid - 700, tmpMid + 400, 0, config.treeScales[2], 0);
            objectManager.add(6, tmpMid + 800, tmpMid - 200, 0, config.treeScales[3], 0);
            objectManager.add(7, tmpMid - 260, tmpMid + 340, 0, config.bushScales[3], 1);
            objectManager.add(8, tmpMid + 760, tmpMid + 310, 0, config.bushScales[3], 1);
            objectManager.add(9, tmpMid - 800, tmpMid + 100, 0, config.bushScales[3], 1);
            objectManager.add(10, tmpMid - 800, tmpMid + 300, 0, items.list[4].scale, items.list[4].id, items.list[10]);
            objectManager.add(11, tmpMid + 650, tmpMid - 390, 0, items.list[4].scale, items.list[4].id, items.list[10]);
            objectManager.add(12, tmpMid - 400, tmpMid - 450, 0, config.rockScales[2], 2);
        }
        const speed = 35;

        // RENDER PLAYERS:
        function renderDeadPlayers(xOffset, yOffset) {
            mainContext.fillStyle = "#91b2db";
            deadPlayers.filter(dead => dead.active).forEach((dead) => {
                dead.animate(delta);

                mainContext.globalAlpha = dead.alpha;
                mainContext.strokeStyle = outlineColor;

                mainContext.save();
                mainContext.translate(dead.x - xOffset, dead.y - yOffset);

                // RENDER PLAYER:
                mainContext.rotate(dead.dir);
                mainContext.scale(dead.visScale / dead.scale, dead.visScale / dead.scale);
                renderDeadPlayer(dead, mainContext);
                mainContext.restore();

                mainContext.font = "20px Ubuntu";
                let tmpSize = mainContext.measureText("imagine using fixed mod L");
                let tmpH = 60;
                let tmpW = tmpSize.width + 10;
                mainContext.textBaseline = "middle";
                mainContext.textAlign = "center";

                mainContext.fillStyle = "#ccc";
                mainContext.strokeStyle = "#999";
                mainContext.roundRect(dead.x - xOffset - (tmpW / 2), dead.y - yOffset - (tmpH / 2) + (dead.scale * 1.5), tmpW, tmpH, 6);
                mainContext.fill();
                mainContext.stroke();

                mainContext.fillStyle = "#fff";
                mainContext.strokeStyle = "#000";
                mainContext.strokeText("disney", dead.x - xOffset, dead.y + (dead.scale * 1.5) - yOffset);
                mainContext.fillText("fixed", dead.x - xOffset, dead.y + (dead.scale * 1.5) - yOffset);
                mainContext.strokeText(dead.name, dead.x - xOffset, dead.y + (dead.scale * 1.5) + 20 - yOffset);
                mainContext.fillText(dead.name, dead.x - xOffset, dead.y + (dead.scale * 1.5) + 20 - yOffset);

                // same color in bundle
                mainContext.fillStyle = "#91b2db";

            });
        }
        function renderCircle2(x, y, scale, tmpContext, dontStroke, dontFill) {
            tmpContext = tmpContext || mainContext;
            tmpContext.beginPath();
            tmpContext.ellipse(x, y, scale * 1.5, scale, Math.PI / 2, 0, Math.PI * 2);
            if (!dontFill)
                tmpContext.fill();
            if (!dontStroke)
                (tmpContext.lineWidth = 3.5),
                    tmpContext.stroke();
        }
        // RENDER PLAYERS:
        function renderPlayers(xOffset, yOffset, zIndex) {
            mainContext.globalAlpha = 1;
            mainContext.fillStyle = "#91b2db";
            for (var i = 0; i < players.length; ++i) {
                tmpObj = players[i];
                if (tmpObj.zIndex == zIndex) {
                    tmpObj.animate(delta);
                    if (tmpObj.visible) {
                        tmpObj.skinRot += (0.002 * delta);
                        tmpDir = (!isC("renderDir").options.value == "showDir" && !useWasd && tmpObj == player) ? isC("renderDir").options.value == "attackDir" ? getVisualDir() : getSafeDir() : (tmpObj.dir||0);
                        mainContext.save();
                        mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);

                        // RENDER PLAYER:
                        mainContext.rotate(tmpDir + tmpObj.dirPlus);
                        renderPlayer(tmpObj, mainContext);
                        mainContext.restore();
                    }
                }
            }
        }

        // RENDER DEAD PLAYER:
        function renderDeadPlayer(obj, ctxt) {
            ctxt = ctxt || mainContext;
            ctxt.lineWidth = outlineWidth;
            ctxt.lineJoin = "miter";
            let handAngle = (Math.PI / 4) * (items.weapons[obj.weaponIndex].armS||1);
            let oHandAngle = (obj.buildIndex < 0)?(items.weapons[obj.weaponIndex].hndS||1):1;
            let oHandDist = (obj.buildIndex < 0)?(items.weapons[obj.weaponIndex].hndD||1):1;

            // WEAPON BELLOW HANDS:
            if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
                renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
                if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
                    renderProjectile(obj.scale, 0,
                                     items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
                }
            }

            // HANDS:
            ctxt.fillStyle = config.skinColors[obj.skinColor];
            renderCircle(obj.scale * Math.cos(handAngle), (obj.scale * Math.sin(handAngle)), 14);
            renderCircle((obj.scale * oHandDist) * Math.cos(-handAngle * oHandAngle),
                         (obj.scale * oHandDist) * Math.sin(-handAngle * oHandAngle), 14);

            // WEAPON ABOVE HANDS:
            if (obj.buildIndex < 0 && items.weapons[obj.weaponIndex].aboveHand) {
                renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
                if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
                    renderProjectile(obj.scale, 0,
                                     items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
                }
            }

            // BUILD ITEM:
            if (obj.buildIndex >= 0) {
                var tmpSprite = getItemSprite(items.list[obj.buildIndex]);
                ctxt.drawImage(tmpSprite, obj.scale - items.list[obj.buildIndex].holdOffset, -tmpSprite.width / 2);
            }

            // BODY:
            renderCircle(0, 0, obj.scale, ctxt);

            ctxt.lineWidth = 2;
            ctxt.fillStyle = "#555";
            ctxt.font = "35px Hammersmith One";
            ctxt.textBaseline = "middle";
            ctxt.textAlign = "center";

            ctxt.fillText("(", 20, 5);

            ctxt.rotate(Math.PI / 2);
            ctxt.font = "30px Hammersmith One";
            ctxt.fillText("X", -15, 15/2);
            ctxt.fillText("D", 15, 15/2);

        }

       // RENDER PLAYER:
function renderPlayer(obj, ctxt) {
    ctxt = ctxt || mainContext;
    ctxt.lineWidth = outlineWidth;
    ctxt.lineJoin = "miter";
    let handAngle = (Math.PI / 4) * (items.weapons[obj.weaponIndex].armS || 1);
    let oHandAngle = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndS || 1) : 1;
    let oHandDist = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndD || 1) : 1;


    // TAIL/CAPE:
    if (obj.tailIndex > 0) {
        renderTailTextureImage(obj.tailIndex, ctxt, obj);
    }

    // WEAPON BELLOW HANDS:
    if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
        renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
        if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
            renderProjectile(obj.scale, 0,
                             items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
        }
    }

    // HANDS:
    ctxt.fillStyle = config.skinColors[obj.skinColor];
    renderCircle(obj.scale * Math.cos(handAngle), (obj.scale * Math.sin(handAngle)), 14);
    renderCircle((obj.scale * oHandDist) * Math.cos(-handAngle * oHandAngle),
                 (obj.scale * oHandDist) * Math.sin(-handAngle * oHandAngle), 14);

    // WEAPON ABOVE HANDS:
    if (obj.buildIndex < 0 && items.weapons[obj.weaponIndex].aboveHand) {
        renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
        if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
            renderProjectile(obj.scale, 0,
                             items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
        }
    }

    // BUILD ITEM:
    if (obj.buildIndex >= 0) {
        var tmpSprite = getItemSprite(items.list[obj.buildIndex]);
        ctxt.drawImage(tmpSprite, obj.scale - items.list[obj.buildIndex].holdOffset, -tmpSprite.width / 2);
    }

    // BODY:
    renderCircle(0, 0, obj.scale, ctxt);

    // SKIN:
    if (obj.skinIndex > 0) {
        ctxt.rotate(Math.PI / 2);
        renderTextureSkin(obj.skinIndex, ctxt, null, obj);
    }

    // Reset globalAlpha to 1 for subsequent drawings
    ctxt.globalAlpha = 1.0; // Reset to fully opaque
}
      // RENDER NORMAL SKIN
var skinSprites2 = {};
var skinPointers2 = {};
function renderSkin2(index, ctxt, parentSkin, owner) {
    tmpSkin = skinSprites2[index];
    if (!tmpSkin) {
        var tmpImage = new Image();
        tmpImage.onload = function() {
            this.isLoaded = true;
            this.onload = null;
        };
        //tmpImage.src = "https://moomoo.io/img/hats/hat_" + index + ".png";
        tmpImage.src = "https://moomoo.io/img/hats/hat_" + index + ".png";
        skinSprites2[index] = tmpImage;
        tmpSkin = tmpImage;
    }
    var _ = parentSkin||skinPointers2[index];
    if (!_) {
        for (var i = 0; i < hats.length; ++i) {
            if (hats[i].id == index) {
                _ = hats[i];
                break;
            }
        }
        skinPointers2[index] = _;
    }
    if (tmpSkin.isLoaded)
        ctxt.drawImage(tmpSkin, -_.scale/2, -_.scale/2, _.scale, _.scale);
    if (!parentSkin && _.topSprite) {
        ctxt.save();
        ctxt.rotate(owner.skinRot);
        renderSkin2(index + "_top", ctxt, _, owner);
        ctxt.restore();
    }
}

// RENDER SKIN:
function renderTextureSkin(index, ctxt, parentSkin, owner) {
    if (!(tmpSkin = skinSprites[index + (txt ? "lol" : 0)])) {
        var tmpImage = new Image();
        tmpImage.onload = function() {
            this.isLoaded = true,
                this.onload = null
        }
            ,
            tmpImage.src = setSkinTextureImage(index, "hat", index),
            skinSprites[index + (txt ? "lol" : 0)] = tmpImage,
            tmpSkin = tmpImage
    }
    var _ = parentSkin||skinPointers[index];
    if (!_) {
        for (var i = 0; i < hats.length; ++i) {
            if (hats[i].id == index) {
                _ = hats[i];
                break;
            }
        }
        skinPointers[index] = _;
    }
    if (tmpSkin.isLoaded)
        ctxt.drawImage(tmpSkin, -_.scale/2, -_.scale/2, _.scale, _.scale);
    if (!parentSkin && _.topSprite) {
        ctxt.save();
        ctxt.rotate(owner.skinRot);
        renderSkin(index + "_top", ctxt, _, owner);
        ctxt.restore();
    }
}

var FlareZHat = {
    6: "https://cdn.discordapp.com/attachments/1334460038005391361/1344571814063509515/latest.png?ex=67c35fd5&is=67c20e55&hm=189f1767e5c3fd2bd83b751c2e36ac10a18673ab29122cd204c3cc226802f443&",
    7: "https://moomoo.io/img/hats/hat_7.png",
    26: "https://moomoo.io/img/hats/hat_7.png",
    12: "https://moomoo.io/img/hats/hat_12.png",
    15: "https://moomoo.io/img/hats/hat_15.png",
    31: "https://moomoo.io/img/hats/hat_31.png",
    //11: "https://i.imgur.com/yfqME8H.png",
    "11_p": "https://moomoo.io/img/hats/hat_11_p.png",
    //"11_top": "https://i.imgur.com/s7Cxc9y.png",
    40: "https://moomoo.io/img/hats/hat_40.png",
    6: "https://moomooio.fandom.com/wiki/Hats?file=Hat_6.png",

    22: "https://moomoo.io/img/hats/hat_22.png",
    53: "https://i.imgur.com/pTpe6ig.png",
    "53_p": "https://moomoo.io/img/hats/hat_53_p.png",
    "53_top": "https://moomoo.io/img/hats/hat_53_p.png",
};

function setSkinTextureImage(id, type, id2) {
    if (true) {
        if(FlareZHat[id] && type == "hat") {
            return FlareZHat[id];
        } else {
            if(type == "acc") {
                return ".././img/accessories/access_" + id + ".png";
            } else if(type == "hat") {
                return ".././img/hats/hat_" + id + ".png";
            } else {
                return ".././img/weapons/" + id + ".png";
            }
        }
    } else {
        if(type == "acc") {
            return ".././img/accessories/access_" + id + ".png";
        } else if(type == "hat") {
            return ".././img/hats/hat_" + id + ".png";
        } else {
            return ".././img/weapons/" + id + ".png";
        }
    }
}
// RENDER SKINS:
let skinSprites = {};
let skinPointers = {};
let tmpSkin;

function renderSkin(index, ctxt, parentSkin, owner) {
    tmpSkin = skinSprites[index];
    if (!tmpSkin) {
        let tmpImage = new Image();
        tmpImage.onload = function() {
            this.isLoaded = true;
            this.onload = null;
        };
        tmpImage.src = "https://moomoo.io/img/hats/hat_" + index + ".png";
        skinSprites[index] = tmpImage;
        tmpSkin = tmpImage;
    }
    let _ = parentSkin || skinPointers[index];
    if (!_) {
        for (let i = 0; i < hats.length; ++i) {
            if (hats[i].id == index) {
                _ = hats[i];
                break;
            }
        }
        skinPointers[index] = _;
    }
    if (tmpSkin.isLoaded)
        ctxt.drawImage(tmpSkin, -_.scale / 2, -_.scale / 2, _.scale, _.scale);
    if (!parentSkin && _.topSprite) {
        ctxt.save();
        ctxt.rotate(owner.skinRot);
        renderSkin(index + "_top", ctxt, _, owner);
        ctxt.restore();
    }
}

// RENDER TAIL:
var FlareZAcc = {

};

function setTailTextureImage(id, type, id2) {
    if(true) {
        if(FlareZAcc[id] && type == "acc") {
            return FlareZAcc[id];
        } else {
            if(type == "acc") {
                return ".././img/accessories/access_" + id + ".png";
            } else if(type == "hat") {
                return ".././img/hats/hat_" + id + ".png";
            } else {
                return ".././img/weapons/" + id + ".png";
            }
        }
    } else {
        if(type == "acc") {
            return ".././img/accessories/access_" + id + ".png";
        } else if(type == "hat") {
            return ".././img/hats/hat_" + id + ".png";
        } else {
            return ".././img/weapons/" + id + ".png";
        }
    }
}

function renderTailTextureImage(index, ctxt, owner) {
    if(!(tmpSkin = accessSprites[index + (txt ? "lol" : 0)])) {
        var tmpImage = new Image();
        (tmpImage.onload = function() {
            (this.isLoaded = true), (this.onload = null);
        }),
            (tmpImage.src = setTailTextureImage(index, "acc")), //".././img/accessories/access_" + index + ".png";
            (accessSprites[index + (txt ? "lol" : 0)] = tmpImage), (tmpSkin = tmpImage);
    }
    var _ = accessPointers[index];
    if(!_) {
        for(var i = 0; i < accessories.length; ++i) {
            if(accessories[i].id == index) {
                _ = accessories[i];
                break;
            }
        }
        accessPointers[index] = _;
    }
    if(tmpSkin.isLoaded) {
        ctxt.save();
        ctxt.translate(-20 - (_.xOff || 0), 0);
        if(_.spin) ctxt.rotate(owner.skinRot);
        ctxt.drawImage(tmpSkin, -(_.scale / 2), -(_.scale / 2), _.scale, _.scale);
        ctxt.restore();
    }
}
let accessSprites = {};
let accessPointers = {};
var txt = true;

function renderTail(index, ctxt, owner) {
    tmpSkin = accessSprites[index];
    if(!tmpSkin) {
        let tmpImage = new Image();
        tmpImage.onload = function() {
            this.isLoaded = true;
            this.onload = null;
        };
        tmpImage.src = "https://moomoo.io/img/accessories/access_" + index + ".png";
        accessSprites[index] = tmpImage;
        tmpSkin = tmpImage;
    }
    let _ = accessPointers[index];
    if(!_) {
        for(let i = 0; i < accessories.length; ++i) {
            if(accessories[i].id == index) {
                _ = accessories[i];
                break;
            }
        }
        accessPointers[index] = _;
    }
    if(tmpSkin.isLoaded) {
        ctxt.save();
        ctxt.translate(-20 - (_.xOff || 0), 0);
        if(_.spin) ctxt.rotate(owner.skinRot);
        ctxt.drawImage(tmpSkin, -(_.scale / 2), -(_.scale / 2), _.scale, _.scale);
        ctxt.restore();
    }
}
var accessSprites2 = {};
var accessPointers2 = {};

function renderTail2(index, ctxt, owner) {
    tmpSkin = accessSprites2[index];
    if(!tmpSkin) {
        var tmpImage = new Image();
        tmpImage.onload = function() {
            this.isLoaded = true;
            this.onload = null;
        };
        tmpImage.src = "https://moomoo.io/img/accessories/access_" + index + ".png";
        accessSprites2[index] = tmpImage;
        tmpSkin = tmpImage;
    }
    var _ = accessPointers2[index];
    if(!_) {
        for(var i = 0; i < accessories.length; ++i) {
            if(accessories[i].id == index) {
                _ = accessories[i];
                break;
            }
        }
        accessPointers2[index] = _;
    }
    if(tmpSkin.isLoaded) {
        ctxt.save();
        ctxt.translate(-20 - (_.xOff || 0), 0);
        if(_.spin) ctxt.rotate(owner.skinRot);
        ctxt.drawImage(tmpSkin, -(_.scale / 2), -(_.scale / 2), _.scale, _.scale);
        ctxt.restore();
    }
}
// RENDER TOOL:
let toolSprites = {};
// hishsihsishi code
let weaponsT = {
};

function setWpt(id, type) {
    if (true) {
        if(weaponsT[id] && type == "weapons") {
            return weaponsT[id];
        } else {
            if(type == "acc") {
                return ".././img/accessories/access_" + id + ".png";
            } else if(type == "hat") {
                return ".././img/hats/hat_" + id + ".png";
            } else {
                return ".././img/weapons/" + id + ".png";
            }
        }
    } else {
        if(type == "acc") {
            return ".././img/accessories/access_" + id + ".png";
        } else if(type == "hat") {
            return ".././img/hats/hat_" + id + ".png";
        } else {
            return ".././img/weapons/" + id + ".png";
        }
    }
}

// RENDER TOOL:
function renderTool(obj, variant, x, y, ctxt) {
    let tmpSrc = obj.src + (variant || "");
    let tmpSprite = toolSprites[tmpSrc + "lol"];
    if (!tmpSprite) {
        tmpSprite = new Image();
        tmpSprite.onload = function() {
            this.isLoaded = true;
        }
        tmpSprite.src = setWpt(tmpSrc, "weapons");
        toolSprites[tmpSrc + "lol"] = tmpSprite;
    }
    if (tmpSprite.isLoaded) ctxt.drawImage(tmpSprite, x + obj.xOff - (obj.length / 2), y + obj.yOff - (obj.width / 2), obj.length, obj.width);
}


        // RENDER PROJECTILES:
        function renderProjectiles(layer, xOffset, yOffset) {
            for(let i = 0; i < projectiles.length; i++) {
                tmpObj = projectiles[i];
                if (tmpObj.active && tmpObj.layer == layer && tmpObj.inWindow) {
                    tmpObj.update(delta);
                    if (tmpObj.active && isOnScreen(tmpObj.x - xOffset, tmpObj.y - yOffset, tmpObj.scale)) {
                        mainContext.save();
                        mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
                        mainContext.rotate(tmpObj.dir);
                        renderProjectile(0, 0, tmpObj, mainContext, 1);
                        mainContext.restore();
                    }
                }
            };
        }

        // RENDER PROJECTILE:
        let projectileSprites = {};
        function renderProjectile(x, y, obj, ctxt, debug) {
            if (obj.src) {
                let tmpSrc = items.projectiles[obj.indx].src;
                let tmpSprite = projectileSprites[tmpSrc];
                if (!tmpSprite) {
                    tmpSprite = new Image();
                    tmpSprite.onload = function() {
                        this.isLoaded = true;
                    }
                    tmpSprite.src = "https://moomoo.io/img/weapons/" + tmpSrc + ".png";
                    projectileSprites[tmpSrc] = tmpSprite;
                }
                if (tmpSprite.isLoaded)
                    ctxt.drawImage(tmpSprite, x - (obj.scale / 2), y - (obj.scale / 2), obj.scale, obj.scale);
            } else if (obj.indx == 1) {
                ctxt.fillStyle = "#939393";
                renderCircle(x, y, obj.scale, ctxt);
            }
        }

        // RENDER AI:
        let aiSprites = {};
        function renderAI(obj, ctxt) {
            let tmpIndx = obj.index;
            let tmpSprite = aiSprites[tmpIndx];
            if (!tmpSprite) {
                let tmpImg = new Image();
                tmpImg.onload = function() {
                    this.isLoaded = true;
                    this.onload = null;
                };
                tmpImg.src = "https://moomoo.io/img/animals/" + obj.src + ".png";
                tmpSprite = tmpImg;
                aiSprites[tmpIndx] = tmpSprite;
            }
            if (tmpSprite.isLoaded) {
                let tmpScale = obj.scale * 1.2 * (obj.spriteMlt || 1);
                ctxt.drawImage(tmpSprite, -tmpScale, -tmpScale, tmpScale * 2, tmpScale * 2);
            }
        }

        // RENDER WATER BODIES:
        function renderWaterBodies(xOffset, yOffset, ctxt, padding) {

            // MIDDLE RIVER:
            let tmpW = config.riverWidth + padding;
            let tmpY = (config.mapScale / 2) - yOffset - (tmpW / 2);
            if (tmpY < maxScreenHeight && tmpY + tmpW > 0) {
                ctxt.fillRect(0, tmpY, maxScreenWidth, tmpW);
            }
        }

// RENDER GAME OBJECTS:
let gameObjectSprites = {};
function getResSprite(obj) {
    let biomeID = (obj.y >= config.mapScale - config.snowBiomeTop) ? 2 : ((obj.y <= config.snowBiomeTop) ? 1 : 0);
    let tmpIndex = (obj.type + "_" + obj.scale + "_" + biomeID);
    let tmpSprite = gameObjectSprites[tmpIndex];
    if (!tmpSprite) {
        let blurScale = 25; // Increased blur for smoother appearance
        let tmpCanvas = document.createElement("canvas");
        tmpCanvas.width = tmpCanvas.height = (obj.scale * 2.1) + outlineWidth;
        let tmpContext = tmpCanvas.getContext('2d');
        tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
        tmpContext.rotate(UTILS.randFloat(0, Math.PI));
        tmpContext.strokeStyle = '#333'; // Darker outline color
        tmpContext.lineWidth = outlineWidth;

        if (isNight) {
            tmpContext.shadowBlur = blurScale;
            tmpContext.shadowColor = `rgba(0, 0, 0, ${obj.alpha})`;
        }

        if (obj.type == 0) {
            let tmpScale;
            let tmpCount = UTILS.randInt(5, 7);
            tmpContext.globalAlpha = isNight ? 0.5 : 0.7; // Lowered alpha for darker effect
            for (let i = 0; i < 2; ++i) {
                tmpScale = tmpObj.scale * (!i ? 1 : 0.5);
                renderStar(tmpContext, tmpCount, tmpScale, tmpScale * 0.7);
                tmpContext.fillStyle = !biomeID ? (!i ? "#7a9f47" : "#9bcf5e") : (!i ? "#c2e1e4" : "#e5e5e5"); // Darker fill colors
                tmpContext.fill();
                if (!i) {
                    tmpContext.stroke();
                    tmpContext.shadowBlur = null;
                    tmpContext.shadowColor = null;
                    tmpContext.globalAlpha = 1;
                }
            }
        } else if (obj.type == 1) {
            if (biomeID == 2) {
                tmpContext.fillStyle = "#505050"; // Darker color for biome 2
                renderStar(tmpContext, 6, obj.scale * 0.3, obj.scale * 0.71);
                tmpContext.fill();
                tmpContext.stroke();

                // Adding shiny effect
                let gradient = tmpContext.createRadialGradient(0, 0, 0, 0, 0, obj.scale * 0.55);
                gradient.addColorStop(0, "rgba(255, 255, 255, 0.6)"); // Center highlight
                gradient.addColorStop(1, "#6b8b3a"); // Darker edge
                tmpContext.fillStyle = gradient;
                renderCircle(0, 0, obj.scale * 0.55, tmpContext);
                tmpContext.fill();

                // Inner circle
                tmpContext.fillStyle = "#8cb65a"; // Darker inner circle
                renderCircle(0, 0, obj.scale * 0.3, tmpContext, true);
            } else {
                renderBlob(tmpContext, 6, tmpObj.scale, tmpObj.scale * 0.7);
                tmpContext.fillStyle = biomeID ? "#c2e1e4" : "#6b8b3a"; // Adjusted fill colors
                tmpContext.fill();
                tmpContext.stroke();

                // Adding shiny effect for berries
                let tmpRange;
                let berries = 4;
                let rotVal = (Math.PI * 2) / berries;
                for (let i = 0; i < berries; ++i) {
                    tmpRange = UTILS.randInt(tmpObj.scale / 3.5, tmpObj.scale / 2.3);
                    let berryGradient = tmpContext.createRadialGradient(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i), 0, tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i), 10);
                    berryGradient.addColorStop(0, "rgba(255, 255, 255, 0.5)"); // Highlight
                    berryGradient.addColorStop(1, biomeID ? "#5a5aaf" : "#a04040"); // Darker berry colors
                    tmpContext.fillStyle = berryGradient;
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i), UTILS.randInt(10, 12), tmpContext);
                    tmpContext.fill();
                }
            }
        } else if (obj.type == 2 || obj.type == 3) {
            tmpContext.fillStyle = (obj.type == 2) ? (biomeID == 2 ? "#7a7a6b" : "#7a7a7a") : "#b0a655"; // Darker colors
            renderStar(tmpContext, 3, obj.scale, obj.scale);
            tmpContext.fill();
            tmpContext.stroke();

            tmpContext.shadowBlur = null;
            tmpContext.shadowColor = null;

            // Adding shiny effect for the inner star
            let innerGradient = tmpContext.createRadialGradient(0, 0, 0, 0, 0, obj.scale * 0.55);
            innerGradient.addColorStop(0, "rgba(255, 255, 255, 0.6)"); // Highlight
            innerGradient.addColorStop(1, (obj.type == 2) ? (biomeID == 2 ? "#9c9c8a" : "#a0a0a0") : "#dedca3"); // Darker inner colors
            tmpContext.fillStyle = innerGradient;
            renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
            tmpContext.fill();
        }
        tmpSprite = tmpCanvas;
        gameObjectSprites[tmpIndex] = tmpSprite;
    }
    return tmpSprite;
}

   // GET ITEM SPRITE:
let itemSprites = {}, itemSpritesColors = {}, lastitemSpritesColors = {};
function getItemSprite(obj, asIcon) {
    const {id, name, strokeStyle, scale} = obj; // й«йў‘еЏ‚ж•°йў„е­
    const colorKey = strokeStyle || 'default';
    const cacheKey = `${id}_${asIcon ? 1 : 0}_${colorKey}`; // еЊ…еђ«йўњи‰Іе’Ње›ѕж ‡зЉ¶жЂЃзљ„зј“е­й”?

    // её¦йўњи‰ІзЉ¶жЂЃзљ„жњ‰ж•€зј“е­жЈЂжџ?
    if (!asIcon && itemSprites[cacheKey] && itemSpritesColors[cacheKey] === colorKey) {
        return itemSprites[cacheKey];
    }
    let tmpSprite = null;
    try{
        tmpSprite = itemSprites[cacheKey];
    }catch(e){}
    if (!tmpSprite || asIcon) {
        let tmpCanvas = document.createElement("canvas");
        let reScale = ((!asIcon && obj.name.includes("windmill")) ? items.list[4].scale : obj.scale);
        tmpCanvas.width = tmpCanvas.height = (obj.render ? 200 : (reScale * 2.5) + outlineWidth + (items.list[obj.id].spritePadding || 0));
        let tmpContext = tmpCanvas.getContext("2d");
        tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
        tmpContext.rotate(asIcon ? 0 : (Math.PI / 2));
        tmpContext.strokeStyle = obj.strokeStyle;
        tmpContext.lineWidth = outlineWidth * (asIcon ? (tmpCanvas.width / 81) : 1);
        if (obj.name == "apple") {
            tmpContext.fillStyle = "#c15555";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fillStyle = "#89a54c";
            let leafDir = -(Math.PI / 2);
            renderLeaf(obj.scale * Math.cos(leafDir), obj.scale * Math.sin(leafDir),
                       25, leafDir + Math.PI / 2, tmpContext);
        } else if (obj.name == "cookie") {
            tmpContext.fillStyle = "#cca861";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fillStyle = "#937c4b";
            let chips = 4;
            let rotVal = (Math.PI * 2) / chips;
            let tmpRange;
            for (let i = 0; i < chips; ++i) {
                tmpRange = obj.scale / 2.1;
                renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                             4, tmpContext, true);
            }
        } else if (obj.name == "cheese") {
            tmpContext.fillStyle = "#f4f3ac";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fillStyle = "#c3c28b";
            let chips = 4;
            let rotVal = (Math.PI * 2) / chips;
            let tmpRange;
            for (let i = 0; i < chips; ++i) {
                tmpRange = obj.scale / 2.1;
                renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                             5, tmpContext, true);
            }
        } else if (obj.name == "wood wall" || obj.name == "stone wall" || obj.name == "castle wall") {
            tmpContext.fillStyle = (obj.name == "castle wall") ? "#83898e" : (obj.name == "wood wall") ?
                "#a5974c" : "#939393";
            let sides = (obj.name == "castle wall") ? 4 : 3;
            renderStar(tmpContext, sides, obj.scale * 1.1, obj.scale * 1.1);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = (obj.name == "castle wall") ? "#9da4aa" : (obj.name == "wood wall") ?
                "#c9b758" : "#bcbcbc";
            renderStar(tmpContext, sides, obj.scale * 0.65, obj.scale * 0.65);
            tmpContext.fill();
        } else if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" ||
                   obj.name == "spinning spikes") {
            tmpContext.fillStyle = (obj.name == "poison spikes") ? "#7b935d" : "#939393";
            let tmpScale = (obj.scale * 0.6);
            renderStar(tmpContext, (obj.name == "spikes") ? 5 : 6, obj.scale, tmpScale);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#040402";
            renderCircle(0, 0, tmpScale, tmpContext);
            tmpContext.fillStyle = "#000000";
            renderCircle(0, 0, tmpScale / 2, tmpContext, true);
} else if (obj.name == "windmill" || obj.name == "faster windmill" || obj.name == "power mill") {
    const mainColor = "rgba(169, 151, 76, 0.3)";  // Main color for the windmill with high transparency
    const accentColor = "rgba(201, 183, 88, 0.3)"; // Accent color for the rectangular part with high transparency
    const darkShaftColor = "rgba(176, 158, 74, 0.3)"; // Darker color for the shaft with high transparency
    const borderColor = "rgba(0, 0, 0, 0.3)"; // Transparent border color for all shapes
    const shadowColor = "rgba(0, 0, 0, 0.5)"; // Shadow color for the windmill

    // Function to render a circle with fill and stroke
    function renderCircleWithStyle(x, y, radius, fillColor) {
        tmpContext.fillStyle = fillColor;
        renderCircle(x, y, radius, tmpContext);

        // Set stroke to the same transparent color for the border
        tmpContext.strokeStyle = borderColor; // Transparent border for circles
        tmpContext.lineWidth = 2;
        renderCircle(x, y, radius, tmpContext);
        tmpContext.stroke();
    }

    // Function to render a rectangle with style
    function renderRectWithStyle(x, y, width, height, radius, fillColor) {
        tmpContext.fillStyle = fillColor;
        renderRectCircle(x, y, width, height, radius, tmpContext);

        // Set stroke to the same transparent color for the border
        tmpContext.strokeStyle = borderColor; // Transparent border for rectangles
        tmpContext.lineWidth = 2;
        renderRectCircle(x, y, width, height, radius, tmpContext);
        tmpContext.stroke();
    }

    // Set shadow properties
    tmpContext.shadowColor = shadowColor;
    tmpContext.shadowBlur = 10; // Adjust the blur amount
    tmpContext.shadowOffsetX = 5; // Horizontal shadow offset
    tmpContext.shadowOffsetY = 5; // Vertical shadow offset

    // Render the main circle with a gradient effect
    const gradient = tmpContext.createRadialGradient(0, 0, reScale * 0.5, 0, 0, reScale);
    gradient.addColorStop(0, mainColor);
    gradient.addColorStop(1, "rgba(224, 220, 165, 0.3)"); // Lighter shade for a cool effect with high transparency
    tmpContext.fillStyle = gradient;
    renderCircleWithStyle(0, 0, reScale, gradient); // Render the big circle with transparency

    // Render the rectangular shaft with the darker color
    renderRectWithStyle(0, 0, reScale * 1.5, 29, 4, darkShaftColor); // Render the shaft with transparent border

    // Render the inner circle with a darker gradient
    const innerGradient = tmpContext.createRadialGradient(0, 0, reScale * 0.25, 0, 0, reScale * 0.5);
    innerGradient.addColorStop(0, "rgba(124, 111, 63, 0.3)"); // Darker shade for depth with high transparency
    innerGradient.addColorStop(1, mainColor);
    renderCircleWithStyle(0, 0, reScale * 0.5, innerGradient); // Render the inner circle with transparency

    // Reset shadow properties after rendering
    tmpContext.shadowColor = 'transparent'; // Remove shadow after rendering
    tmpContext.shadowBlur = 0;
    tmpContext.shadowOffsetX = 0;
    tmpContext.shadowOffsetY = 0;

    // If there are additional components (like blades), render them here with transparency
    const bladeLength = reScale * 1.2; // Example length for blades
    // Render blades here if necessary





        } else if (obj.name == "mine") {
            tmpContext.fillStyle = "#939393";
            renderStar(tmpContext, 3, obj.scale, obj.scale);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#bcbcbc";
            renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
            tmpContext.fill();
        } else if (obj.name == "sapling") {
            for (let i = 0; i < 2; ++i) {
                let tmpScale = obj.scale * (!i ? 1 : 0.5);
                renderStar(tmpContext, 7, tmpScale, tmpScale * 0.7);
                tmpContext.fillStyle = (!i ? "#9ebf57" : "#b4db62");
                tmpContext.fill();
                if (!i) tmpContext.stroke();
            }
        } else if (obj.name == "pit trap") {
            tmpContext.fillStyle = "#a5974c";
            renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = outlineColor;
            renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
            tmpContext.fill();
        } else if (obj.name == "boost pad") {
            tmpContext.fillStyle = "#7e7f82";
            renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#dbd97d";
            renderTriangle(obj.scale * 1, tmpContext);
        } else if (obj.name == "turret") {
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#939393";
            let tmpLen = 50;
            renderRect(0, -tmpLen / 2, obj.scale * 0.9, tmpLen, tmpContext);
            renderCircle(0, 0, obj.scale * 0.6, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
        } else if (obj.name == "platform") {
            tmpContext.fillStyle = "#cebd5f";
            let tmpCount = 4;
            let tmpS = obj.scale * 2;
            let tmpW = tmpS / tmpCount;
            let tmpX = -(obj.scale / 2);
            for (let i = 0; i < tmpCount; ++i) {
                renderRect(tmpX - (tmpW / 2), 0, tmpW, obj.scale * 2, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpX += tmpS / tmpCount;
            }
        } else if (obj.name == "healing pad") {
            tmpContext.fillStyle = "#7e7f82";
            renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#db6e6e";
            renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
        } else if (obj.name == "spawn pad") {
            tmpContext.fillStyle = "#7e7f82";
            renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#71aad6";
            renderCircle(0, 0, obj.scale * 0.6, tmpContext);
        } else if (obj.name == "blocker") {
            tmpContext.fillStyle = "#7e7f82";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.rotate(Math.PI / 4);
            tmpContext.fillStyle = "#db6e6e";
            renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
        } else if (obj.name == "teleporter") {
            tmpContext.fillStyle = "#7e7f82";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.rotate(Math.PI / 4);
            tmpContext.fillStyle = "#d76edb";
            renderCircle(0, 0, obj.scale * 0.5, tmpContext, true);
        }

        tmpSprite = tmpCanvas;
        if (!asIcon){
            itemSprites[cacheKey] = tmpSprite;
            itemSpritesColors[cacheKey] = colorKey;
        }
    }
    return tmpSprite;
}

        function getItemSprite2(obj, tmpX, tmpY) {
            let tmpContext = mainContext;
            let reScale = (obj.name == "windmill" ? items.list[4].scale : obj.scale);
            tmpContext.save();
            tmpContext.translate(tmpX, tmpY);
            tmpContext.rotate(obj.dir);
            tmpContext.strokeStyle = outlineColor;
            tmpContext.lineWidth = outlineWidth;
            if (obj.name == "apple") {
                tmpContext.fillStyle = "#c15555";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fillStyle = "#89a54c";
                let leafDir = -(Math.PI / 2);
                renderLeaf(obj.scale * Math.cos(leafDir), obj.scale * Math.sin(leafDir),
                           25, leafDir + Math.PI / 2, tmpContext);
            } else if (obj.name == "cookie") {
                tmpContext.fillStyle = "#cca861";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fillStyle = "#937c4b";
                let chips = 4;
                let rotVal = (Math.PI * 2) / chips;
                let tmpRange;
                for (let i = 0; i < chips; ++i) {
                    tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                                 UTILS.randInt(4, 5), tmpContext, true);
                }
            } else if (obj.name == "cheese") {
                tmpContext.fillStyle = "#f4f3ac";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fillStyle = "#c3c28b";
                let chips = 4;
                let rotVal = (Math.PI * 2) / chips;
                let tmpRange;
                for (let i = 0; i < chips; ++i) {
                    tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                                 UTILS.randInt(4, 5), tmpContext, true);
                }
            } else if (obj.name == "wood wall" || obj.name == "stone wall" || obj.name == "castle wall") {
                tmpContext.fillStyle = (obj.name == "castle wall") ? "#83898e" : (obj.name == "wood wall") ?
                    "#a5974c" : "#939393";
                let sides = (obj.name == "castle wall") ? 4 : 3;
                renderStar(tmpContext, sides, obj.scale * 1.1, obj.scale * 1.1);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = (obj.name == "castle wall") ? "#9da4aa" : (obj.name == "wood wall") ?
                    "#c9b758" : "#bcbcbc";
                renderStar(tmpContext, sides, obj.scale * 0.65, obj.scale * 0.65);
                tmpContext.fill();
            } else if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" ||
                       obj.name == "spinning spikes") {
                tmpContext.fillStyle = (obj.name == "poison spikes") ? "#7b935d" : "#939393";
                let tmpScale = (obj.scale * 0.6);
                renderStar(tmpContext, (obj.name == "spikes") ? 5 : 6, obj.scale, tmpScale);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#000000";
                renderCircle(0, 0, tmpScale, tmpContext);
                tmpContext.fillStyle = "#c9b758";
                renderCircle(0, 0, tmpScale / 2, tmpContext, true);
            } else if (obj.name == "windmill" || obj.name == "faster windmill" || obj.name == "power mill") {
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, reScale, tmpContext);
                tmpContext.fillStyle = "#c9b758";
                renderRectCircle(0, 0, reScale * 1.5, 29, 4, tmpContext);
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, reScale * 0.5, tmpContext);
            } else if (obj.name == "mine") {
                tmpContext.fillStyle = "#939393";
                renderStar(tmpContext, 3, obj.scale, obj.scale);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#bcbcbc";
                renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
                tmpContext.fill();
            } else if (obj.name == "sapling") {
                for (let i = 0; i < 2; ++i) {
                    let tmpScale = obj.scale * (!i ? 1 : 0.5);
                    renderStar(tmpContext, 7, tmpScale, tmpScale * 0.7);
                    tmpContext.fillStyle = (!i ? "#9ebf57" : "#b4db62");
                    tmpContext.fill();
                    if (!i) tmpContext.stroke();
                }
            } else if (obj.name == "pit trap") {
                tmpContext.fillStyle = "#a5974c";
                renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = outlineColor;
                renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
                tmpContext.fill();
            } else if (obj.name == "boost pad") {
                tmpContext.fillStyle = "#7e7f82";
                renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#dbd97d";
                renderTriangle(obj.scale * 1, tmpContext);
            } else if (obj.name == "turret") {
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#939393";
                let tmpLen = 50;
                renderRect(0, -tmpLen / 2, obj.scale * 0.9, tmpLen, tmpContext);
                renderCircle(0, 0, obj.scale * 0.6, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
            } else if (obj.name == "platform") {
                tmpContext.fillStyle = "#cebd5f";
                let tmpCount = 4;
                let tmpS = obj.scale * 2;
                let tmpW = tmpS / tmpCount;
                let tmpX = -(obj.scale / 2);
                for (let i = 0; i < tmpCount; ++i) {
                    renderRect(tmpX - (tmpW / 2), 0, tmpW, obj.scale * 2, tmpContext);
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpX += tmpS / tmpCount;
                }
            } else if (obj.name == "healing pad") {
                tmpContext.fillStyle = "#7e7f82";
                renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#db6e6e";
                renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
            } else if (obj.name == "spawn pad") {
                tmpContext.fillStyle = "#7e7f82";
                renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#71aad6";
                renderCircle(0, 0, obj.scale * 0.6, tmpContext);
            } else if (obj.name == "blocker") {
                tmpContext.fillStyle = "#7e7f82";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.rotate(Math.PI / 4);
                tmpContext.fillStyle = "#db6e6e";
                renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
            } else if (obj.name == "teleporter") {
                tmpContext.fillStyle = "#7e7f82";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.rotate(Math.PI / 4);
                tmpContext.fillStyle = "#d76edb";
                renderCircle(0, 0, obj.scale * 0.5, tmpContext, true);
            }
            tmpContext.restore();
        }

        let objSprites = [];
        function getObjSprite(obj) {
            let tmpSprite = objSprites[obj.id];
            if (!tmpSprite) {
                let blurScale = isNight ? 15 : 0;
                let tmpCanvas = document.createElement("canvas");
                tmpCanvas.width = tmpCanvas.height = obj.scale * 2.5 + outlineWidth + (items.list[obj.id].spritePadding || 0) + blurScale;
                let tmpContext = tmpCanvas.getContext("2d");
                tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
                tmpContext.rotate(Math.PI / 2);
                tmpContext.strokeStyle = outlineColor;
                tmpContext.lineWidth = outlineWidth;
                if (isNight) {
                    tmpContext.shadowBlur = blurScale;
                    tmpContext.shadowColor = `rgba(0, 0, 0, ${Math.min(0.3, obj.alpha)})`;
                }
               if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" || obj.name == "spinning spikes") {
      tmpContext.fillStyle = obj.name == "poison spikes" ? "#7b935d" : "#939393";
      let tmpScale = obj.scale * 0.6;
      renderStar(tmpContext, obj.name == "spikes" ? 5 : 6, obj.scale, tmpScale);
      tmpContext.fill();
      tmpContext.stroke();
      tmpContext.fillStyle = "#6e1625";
      renderCircle(0, 0, tmpScale, tmpContext);
      tmpContext.fillStyle = "#040402";
                } else if (obj.name == "pit trap") {
                    tmpContext.fillStyle = "#a5974c";
                    renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpContext.fillStyle = "#cc5151";
                    renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
                    tmpContext.fill();
                }
                tmpSprite = tmpCanvas;
                objSprites[obj.id] = tmpSprite;
            }
            return tmpSprite;
        }

        // GET MARK SPRITE:
        function getMarkSprite(obj, tmpContext, tmpX, tmpY, preplc) {
            tmpContext.lineWidth = outlineWidth;
            tmpContext.globalAlpha = 1;
            tmpContext.strokeStyle = outlineColor;
            tmpContext.save();
            tmpContext.translate(tmpX, tmpY);
            tmpContext.rotate(obj.dir);
            if (preplc) {
                tmpContext.globalAlpha = 0.6;
                tmpContext.fillStyle = "rgba(0, 255, 255, 0.6)";
                renderCircle(0, 0, tmpObj.scale, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
            } else if (obj.name == "wood wall" || obj.name == "stone wall" || obj.name == "castle wall") {
                let sides = obj.name == "castle wall" ? 4 : 3;
                renderHealthStar(tmpContext, sides, obj.scale * 1.1, obj.scale * 1.1);
                tmpContext.stroke();
           } else if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" || obj.name == "spinning spikes") {
                let tmpScale = obj.scale * 0.6;
                renderHealthStar(tmpContext, obj.name == "spikes" ? 5 : 6, obj.scale, tmpScale);
                tmpContext.stroke();
            } else if (obj.name == "windmill" || obj.name == "faster windmill" || obj.name == "power mill") {
                renderHealthCircle(0, 0, obj.scale, tmpContext, false, true);
            } else if (obj.name == "mine") {
                renderHealthStar(tmpContext, 3, obj.scale, obj.scale);
                tmpContext.stroke();
            } else if (obj.name == "sapling") {
                let tmpScale = obj.scale * 0.7;
                renderHealthStar(tmpContext, 7, obj.scale, tmpScale);
                tmpContext.stroke();
            } else if (obj.name == "pit trap") {
                renderHealthStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
                tmpContext.stroke();
            } else if (obj.name == "boost pad") {
                renderHealthRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext, false, true);
            } else if (obj.name == "turret") {
                renderHealthCircle(0, 0, obj.scale, tmpContext, false, true);
            } else if (obj.name == "platform") {
                renderHealthRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext, false, true);
            } else if (obj.name == "healing pad") {
                renderHealthRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext, false, true);
            } else if (obj.name == "spawn pad") {
                renderHealthRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext, false, true);
            } else if (obj.name == "blocker") {
                renderHealthCircle(0, 0, obj.scale, tmpContext, false, true);
            } else if (obj.name == "teleporter") {
                renderHealthCircle(0, 0, obj.scale, tmpContext, false, true);
            }
            tmpContext.restore();
        }
        //renderCircle(tmpObj.x - xOffset, tmpObj.y - yOffset, tmpObj.getScale(0.6, true), mainContext, false, true);

        // OBJECT ON SCREEN:
        function isOnScreen(x, y, s) {
            return (x + s >= 0 && x - s <= maxScreenWidth && y + s >= 0 && (y,
                                                                            s,
                                                                            maxScreenHeight));
        }


        function createVolcano() {
            let volcanoDimension = config.volcanoScale * 2;
            let landCanvas = document.createElement("canvas");
            landCanvas.width = volcanoDimension;
            landCanvas.height = volcanoDimension;
            let landContext = landCanvas.getContext("2d");
            landContext.strokeStyle = "#3e3e3e";
            landContext.lineWidth = 5.5 * 2;
            landContext.fillStyle = "#7f7f7f";
            renderPolygon(landContext, 10, volcanoDimension);
            landContext.fill();
            landContext.stroke();
            volcano.land = landCanvas;

            let lavaCanvas = document.createElement("canvas");
            let lavaDimension = config.innerVolcanoScale * 2;
            lavaCanvas.width = lavaDimension;
            lavaCanvas.height = lavaDimension;

            let lavaContext = lavaCanvas.getContext("2d");
            lavaContext.strokeStyle = "#525252";
            lavaContext.lineWidth = 5.5 * 1.6;
            lavaContext.fillStyle = "#f54e16";
            lavaContext.strokeStyle = "#f56f16";

            renderPolygon(lavaContext, 10, lavaDimension);
            lavaContext.fill();
            lavaContext.stroke();
            volcano.lava = lavaCanvas;
        }
        createVolcano();
        function renderVolcano() {
            let XOffset = xof
            let YOffset = yof
            volcano.animationTime += delta;
            volcano.animationTime %= config.volcanoAnimationDuration;
            let halfAnimationDuration = config.volcanoAnimationDuration / 2;
            let lavaScaleFactor = 1.7 + .3 * (Math.abs(halfAnimationDuration - volcano.animationTime) / halfAnimationDuration);
            let finalLavaScale = config.innerVolcanoScale * lavaScaleFactor;
            mainContext.drawImage(volcano.land, volcano.x - config.volcanoScale - XOffset, volcano.y - config.volcanoScale - YOffset, config.volcanoScale * 2, config.volcanoScale * 2);
            mainContext.drawImage(volcano.lava, volcano.x - finalLavaScale - XOffset, volcano.y - finalLavaScale - YOffset, finalLavaScale * 2, finalLavaScale * 2);
        }

        // RENDER GAME OBJECTS:
        function renderGameObjects(layer, xOffset, yOffset) {
            let tmpSprite;
            let tmpX;
            let tmpY;
            gameObjects.forEach((tmp) => {
                tmpObj = tmp;
                if (tmpObj.alive) {
                    tmpX = tmpObj.x + tmpObj.xWiggle - xOffset;
                    tmpY = tmpObj.y + tmpObj.yWiggle - yOffset;
                    if (layer == 0) {
                        tmpObj.update(delta);
                    }
                    mainContext.globalAlpha = tmpObj.alpha;
                    if (tmpObj.layer == layer && isOnScreen(tmpX, tmpY, tmpObj.scale + (tmpObj.blocker || 0))) {
                        if (tmpObj.isItem) {
                            if ((tmpObj.dmg || tmpObj.trap) && !tmpObj.isTeamObject(player)) {
                                tmpSprite = getObjSprite(tmpObj);
                            } else {
                                tmpSprite = getItemSprite(tmpObj);
                            }

                            mainContext.save();
                            mainContext.translate(tmpX, tmpY);
                            mainContext.rotate(tmpObj.dir);
                            if (!tmpObj.active) {
                                mainContext.scale(tmpObj.visScale / tmpObj.scale, tmpObj.visScale / tmpObj.scale);
                            }
                            if (!tmpObj.hideFromEnemy) {
                                mainContext.globalAlpha = 1
                            }
                           /* if (autoBreak.objectsHit(getAttackDir()).includes(tmpObj)) {
                                mainContext.globalAlpha = 0.1
                            }*/
                            //mainContext.globalAlpha = autoBreak.objectsHit(getAttackDir()).includes(tmpObj) ? 0.1 : 1;
                            mainContext.drawImage(tmpSprite, -(tmpSprite.width / 2), -(tmpSprite.height / 2));

                            if (tmpObj.blocker) {
                                mainContext.strokeStyle = "#db6e6e";
                                mainContext.globalAlpha = 0.3;
                                mainContext.lineWidth = 6;
                                renderCircle(0, 0, tmpObj.blocker, mainContext, false, true);
                            }
                            mainContext.restore();
                        } else {
                            if (tmpObj.type == 4) {
                                renderVolcano();
                            } else {
                                tmpSprite = getResSprite(tmpObj);
                                mainContext.drawImage(tmpSprite, tmpX - (tmpSprite.width / 2), tmpY - (tmpSprite.height / 2));
                            }
                        }
                    }
                    if (layer == 3 && !useWasd) {
                        if (tmpObj.health < tmpObj.maxHealth) {
                            // HEALTH HOLDER:
                            mainContext.fillStyle = darkOutlineColor;
                            mainContext.roundRect(tmpX - config.healthBarWidth / 2 - config.healthBarPad, tmpY - config.healthBarPad, config.healthBarWidth + config.healthBarPad * 2, 17, 8);
                            mainContext.fill();

                            // HEALTH BAR:
                            mainContext.fillStyle = tmpObj.isTeamObject(player) ? "#8ecc51" : "#cc5151";
                            mainContext.roundRect(tmpX - config.healthBarWidth / 2, tmpY, config.healthBarWidth * (tmpObj.health / tmpObj.maxHealth), 17 - config.healthBarPad * 2, 7);
                            mainContext.fill();
                        }
                    }
                }
            });

    // PLACE VISIBLE:
    if(layer == 0) {
        if(placeVisible.length) {
            placeVisible.forEach((places) => {
                tmpX = places.x - xOffset;
                tmpY = places.y - yOffset;
                markObject(places, tmpX, tmpY);
            });
        }
    }
}
        function markObject(tmpObj, tmpX, tmpY) {
            getMarkSprite(tmpObj, mainContext, tmpX, tmpY);
        }
        function markPreplace(tmpObj, tmpX, tmpY) {
            if (tmpObj.name == "pit trap") {
                yen(mainContext, tmpX, tmpY);
            } else {
                anotherYen(mainContext, tmpX, tmpY);
            }
        }
        function yen(context, x, y) {
            context.fillStyle = "rgba(0, 255, 255, 0.4)";
            context.beginPath();
            context.arc(x, y, 55, 0, Math.PI * 2); // Adjust the circle size
            context.fill();
            context.closePath();
        }
        function anotherYen(context, x, y) {
            context.fillStyle = "rgba(255, 0, 0, 0.4)";
            context.beginPath();
            context.arc(x, y, 55, 0, Math.PI * 2); // Adjust the circle size
            context.fill();
            context.closePath();
        }
        // RENDER MINIMAP:
        class MapPing {
            constructor(color, scale) {
                this.init = function (x, y) {
                    this.scale = 0;
                    this.x = x;
                    this.y = y;
                    this.active = true;
                };
                this.update = function (ctxt, delta) {
                    if (this.active) {
                        this.scale += 0.05 * delta;
                        if (this.scale >= scale) {
                            this.active = false;
                        } else {
                            ctxt.globalAlpha = (1 - Math.max(0, this.scale / scale));
                            ctxt.beginPath();
                            ctxt.arc((this.x / config.mapScale) * mapDisplay.width, (this.y / config.mapScale)
                                     * mapDisplay.width, this.scale, 0, 2 * Math.PI);
                            ctxt.stroke();
                        }
                    }
                };
                this.color = color;
            }
        }
        function pingMap(x, y) {
            tmpPing = mapPings.find(pings => !pings.active);
            if (!tmpPing) {
                tmpPing = new MapPing("#fff", config.mapPingScale);
                mapPings.push(tmpPing);
            }
            tmpPing.init(x, y);
        }
        function updateMapMarker() {
            mapMarker.x = player.x;
            mapMarker.y = player.y;
        }
        function renderMinimap(delta) {
            if (player && player.alive) {
                mapContext.clearRect(0, 0, mapDisplay.width, mapDisplay.height);

                // RENDER PINGS:
                mapContext.lineWidth = 4;
                for (let i = 0; i < mapPings.length; ++i) {
                    tmpPing = mapPings[i];
                    mapContext.strokeStyle = tmpPing.color;
                    tmpPing.update(mapContext, delta);
                }

                // RENDER BREAK TRACKS:
                mapContext.globalAlpha = 1;
                mapContext.fillStyle = "#ff0000";
                if (breakTrackers.length) {
                    mapContext.fillStyle = "#abcdef";
                    mapContext.font = "34px Hammersmith One";
                    mapContext.textBaseline = "middle";
                    mapContext.textAlign = "center";
                    for (let i = 0; i < breakTrackers.length;) {
                        mapContext.fillText("!", (breakTrackers[i].x/config.mapScale)*mapDisplay.width,
                                            (breakTrackers[i].y/config.mapScale)*mapDisplay.height);
                        i += 2;
                    }
                }

                // RENDER PLAYERS:
                mapContext.globalAlpha = 1;
                mapContext.fillStyle = "#fff";
                renderCircle((player.x/config.mapScale)*mapDisplay.width,
                             (player.y/config.mapScale)*mapDisplay.height, 7, mapContext, true);
                mapContext.fillStyle = "rgba(255,255,255,0.35)";
                if (player.team && minimapData) {
                    for (let i = 0; i < minimapData.length;) {
                        renderCircle((minimapData[i]/config.mapScale)*mapDisplay.width,
                                     (minimapData[i+1]/config.mapScale)*mapDisplay.height, 7, mapContext, true);
                        i+=2;
                    }
                }



                // DEATH LOCATION:
                if (lastDeath) {
                    mapContext.fillStyle = "#fc5553";
                    mapContext.font = "34px Hammersmith One";
                    mapContext.textBaseline = "middle";
                    mapContext.textAlign = "center";
                    mapContext.fillText("x", (lastDeath.x/config.mapScale)*mapDisplay.width,
                                        (lastDeath.y/config.mapScale)*mapDisplay.height);
                }

                // MAP MARKER:
                if (mapMarker) {
                    mapContext.fillStyle = "#fff";
                    mapContext.font = "34px Hammersmith One";
                    mapContext.textBaseline = "middle";
                    mapContext.textAlign = "center";
                    mapContext.fillText("x", (mapMarker.x/config.mapScale)*mapDisplay.width,
                                        (mapMarker.y/config.mapScale)*mapDisplay.height);
                }
            }
        }

        let crossHairs = ["https://media.discordapp.net/attachments/1353838391493656727/1378294559817076776/Pngtreefocus_on_aim_crosshair_icon_6442106.png?ex=684d37d6&is=684be656&hm=f9726fbe1846d9a7243605ac62bde8467be85bbacfd236d2ee255ea8dcd2e179&format=webp&quality=lossless&width=882&height=882&", "https://media.discordapp.net/attachments/1353838391493656727/1378294559817076776/Pngtreefocus_on_aim_crosshair_icon_6442106.png?ex=684d37d6&is=684be656&hm=f9726fbe1846d9a7243605ac62bde8467be85bbacfd236d2ee255ea8dcd2e179&format=webp&quality=lossless&width=882&height=882&"];
        let crossHairSprites = {};
        let iconSprites = {};
        let icons = ["crown", "skull"];
        function loadIcons() {
            for (let i = 0; i < icons.length; ++i) {
                let tmpSprite = new Image();
                tmpSprite.onload = function() {
                    this.isLoaded = true;
                };
                tmpSprite.src = "./../img/icons/" + icons[i] + ".png";
                iconSprites[icons[i]] = tmpSprite;
            }
            for (let i = 0; i < crossHairs.length; ++i) {
                let tmpSprite = new Image();
                tmpSprite.onload = function() {
                    this.isLoaded = true;
                };
                tmpSprite.src = crossHairs[i];
                crossHairSprites[i] = tmpSprite;
            }
        }
        loadIcons();

        function seePoint(point) {
            var deltaX = Math.abs(point.x - player.x) - point.scale;
            var deltaY = Math.abs(point.y - player.y) - point.scale;
            var maxVisibleWidth = maxScreenWidth / 2 * 1.3;
            var maxVisibleHeight = maxScreenHeight / 2 * 1.3;
            return deltaX <= maxVisibleWidth && deltaY <= maxVisibleHeight;
        }
        // COASTLINE MAKER:
        function ShorePath(startX, startY, endX, distance, float) {
            this.startX = startX
            this.startY = startY
            this.endX = endX
            this.distance = distance
            this.float = float

            this.amountPaths = Math.ceil(this.endX / this.distance)

            this.path = new Map()

            this.generate = function() {
                for (let i = 1; i <= this.amountPaths; i += 1) {
                    const offsetY = i % 2 === 0 ? this.distance : 0
                    const x = this.startX + this.distance * (i - 1)
                    const randomOffsetY = Math.floor(Math.random() * (45 - 10)) + 10
                    const y = this.startY + ((this.float === "down" ? offsetY : -offsetY) + (i % 2 === 0 ? (Math.random() < .55 ? randomOffsetY : -randomOffsetY) : 0))

                    this.path.set(i, [ x, y, offsetY, randomOffsetY ])
                }
            }

            this.render = function(color, xOffset, yOffset) {
                const path = Array.from(this.path.values())
                if (!player?.active || !player?.alive) return

                for (let i = 1; i < path.length; i++) {
                    const oldPoint = path[i - 1]
                    const currentPoint = path[i]

                    if (!seePoint({
                        x: oldPoint[0],
                        y: oldPoint[1],
                        scale: 10
                    })) continue

                    if (!seePoint({
                        x: currentPoint[0],
                        y: currentPoint[1],
                        scale: 10
                    })) continue

                    const pointOffset = this.distance / 2
                    const sidePoint1 = [ oldPoint[0] - pointOffset / 2, oldPoint[1] + (oldPoint[2] === 0 ? pointOffset : -pointOffset) ]
                    const sidePoint2 = [ currentPoint[0] + pointOffset * 1.15, currentPoint[1] + pointOffset * 1.2 ]
                    const sidePoint3 = [ currentPoint[0] + pointOffset * 1.35, currentPoint[1] - pointOffset * 1.15 ]
                    const sidePoint4 = [ currentPoint[0] - pointOffset * 1.35, currentPoint[1] + pointOffset * 1.15 ]

                    mainContext.save()
                    mainContext.fillStyle = color
                    mainContext.lineCap = "round"
                    mainContext.lineJoin = "round"
                    mainContext.beginPath()
                    mainContext.moveTo(oldPoint[0] - xOffset, oldPoint[1] - yOffset)
                    mainContext.lineTo(oldPoint[0] + this.distance * 2 - xOffset, this.startY - yOffset)
                    mainContext.lineTo(currentPoint[0] - xOffset, currentPoint[1] - yOffset)
                    mainContext.fill()
                    mainContext.beginPath()
                    mainContext.moveTo(oldPoint[0] - xOffset, oldPoint[1] - yOffset)
                    mainContext.bezierCurveTo(
                        sidePoint1[0] - xOffset, sidePoint1[1] - yOffset,
                        sidePoint2[0] - xOffset, sidePoint2[1] - yOffset,
                        currentPoint[0] + (currentPoint[3] >= 10 ? 3.5 : 1) - xOffset, currentPoint[1] - yOffset
                    )
                    mainContext.fill()
                    mainContext.beginPath()
                    mainContext.moveTo(currentPoint[0] - xOffset, currentPoint[1] - yOffset)
                    mainContext.bezierCurveTo(
                        sidePoint2[0] - xOffset, sidePoint2[1] - yOffset,
                        sidePoint3[0] - xOffset, sidePoint3[1] - yOffset,
                        currentPoint[0] + this.distance * 2 - xOffset, this.startY - yOffset
                    )
                    mainContext.fill()
                    mainContext.restore()
                }
            }

            return this.generate()
        }

        const snowPath = new ShorePath(-maxScreenWidth, config.snowBiomeTop - 1, config.mapScale + maxScreenWidth * 2, 50, "down")
        const desertPath = new ShorePath(-maxScreenWidth, config.mapScale - config.snowBiomeTop + 1, config.mapScale + maxScreenWidth * 2, 50, "up")


        let removeSnowflakes = () => {
            let snowflakes = document.querySelectorAll('.snowflake');
            snowflakes.forEach(snowflake => snowflake.remove());
        };

        let createSnowflake = function () {
            let snowflake = document.createElement("div");
            snowflake.className = "snowflake";
            snowflake.style = `
        position: absolute;
        width: 10px;
        height: 10px;
        background: #fff;
        border-radius: 50%;
        z-index: 9998;
        opacity: ${Math.random()};
        left: ${Math.random() * 100}vw;
        animation: fall ${Math.random() * 3 + 2}s linear infinite;
    `;

    snowflake.addEventListener("animationiteration", function () {
        snowflake.style.left = `${Math.random() * 100}vw`;
        snowflake.style.opacity = Math.random();
    });

    return snowflake;
};

        let styleSnowflakes = document.createElement("style");
        styleSnowflakes.textContent = `
    @keyframes fall {
        0% { transform: translateY(-10vh); opacity: 1; }
        100% { transform: translateY(110vh); opacity: 0; }
    }
    .fast-fall { animation-duration: ${Math.random() * 1 + 1}s; }
`;
        document.head.appendChild(styleSnowflakes);

        let snowflakeContainer = document.createElement("div");
        snowflakeContainer.style = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9998;
    display: none;
`;
        document.body.appendChild(snowflakeContainer);
        for (let i = 0; i < 55; i++) {
            let snowflake = createSnowflake();
            if (Math.random() > 0.7) {
                snowflake.classList.add("fast-fall");
            }
            snowflakeContainer.appendChild(snowflake);
        }


        // UPDATE GAME:
        let nightModeState = { // Ueh logic of making beutiful stars
            isEnabled: false,
            overlay: { opacity: 0, r: 0, g: 0, b: 0 },
            starField: []
        };

        let starSpawnTimer = 0;

        let renderShapes = (mainContext, delta, offsetX, offsetY) => {
            nightModeState.overlay.opacity = nightModeState.isEnabled
                ? Math.min(0.5, nightModeState.overlay.opacity + 0.001)
            : Math.max(0, nightModeState.overlay.opacity - 0.001);

            if (nightModeState.overlay.opacity > 0) {
                if (nightModeState.overlay.opacity > 0.3 && starSpawnTimer > 300) {
                    starSpawnTimer = 0;
                    let starCount = UTILS.randInt(3, 5);
                    for (let i = 0; i < starCount; i++) {
                        let scaleMultiplier = UTILS.randFloat(1, 3);
                        nightModeState.starField.push({
                            scaleMultiplier,
                            posX: (offsetX * scaleMultiplier) + UTILS.randFloat(0, maxScreenWidth),
                            posY: (offsetY * scaleMultiplier) + UTILS.randFloat(0, maxScreenHeight),
                            size: UTILS.randFloat(2, 6),
                            transparency: 0,
                            visible: true,
                            brightening: true,
                            color: `rgb(255, 255, ${UTILS.randInt(0, 255)})`
                });
                    }
                } else {
                    starSpawnTimer += delta;
                }
            }

            nightModeState.starField = nightModeState.starField.filter(star => star.visible);

            for (let i = 0; i < nightModeState.starField.length; i++) {
                let star = nightModeState.starField[i];

                if (star.brightening) {
                    star.transparency = Math.min(1, star.transparency + 0.02);
                    if (star.transparency >= 1) star.brightening = false;
                } else {
                    star.transparency = Math.max(0, star.transparency - 0.02);
                    if (star.transparency <= 0) star.visible = false;
                }

                mainContext.save();
                mainContext.globalAlpha = star.transparency;
                mainContext.translate(star.posX - (offsetX * star.scaleMultiplier), star.posY - (offsetY * star.scaleMultiplier));
                mainContext.scale(star.size, star.size);
                renderStar(mainContext, 3);
                mainContext.fillStyle = star.color;
                mainContext.fill();
                mainContext.restore();
            }
        };

        let nightState = 1;
        let nightStateTime = Date.now();

        function toggleDay_NightMode() {
            nightModeState.isEnabled = !nightModeState.isEnabled;

            if (nightModeState.isEnabled) {
                nightMode.style.animationName = "night1";
                nightMode.style.opacity = 0.35;
                nightMode.style.display = "block";
            } else {
                nightMode.style.animationName = "night2";
                nightMode.style.opacity = 0;
                setTimeout(() => {
                    nightMode.style.display = "none";
                }, 1000 * parseFloat(nightMode.style.animationDuration));
            }
        }

        setInterval(() => {
            if (!nightStateTime || Date.now() - nightStateTime >= 240000) {
                nightState = !nightState;
                nightStateTime = Date.now();
                toggleDay_NightMode();
            }
        }, 1000);

        window.toggleNight = function() {
            clearTimeout(changeDays);
            toggleDay_NightMode();
            nightState = !nightState;
            nightStateTime = Date.now();
        };
        function updateGame() {
            itemCount();
            if (config.resetRender) {
                mainContext.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
                mainContext.beginPath();
            }
            let original1 = {
                width: 1920,
                height: 1080
            }
            if (true) {
                if (isC("CAmera").checked) {
                    if (player) {
                        let width, targetScreenHeight;
                        let smoothness = 0.1;
                        let pullFactor = 0;
                        let targetX = player.x;
                        let targetY = player.y;
                        if (enemy.length) {
                            if (near.dist2 <= 650) {
                                pullFactor = (650 - near.dist2) / 650
                                targetX = player.x2 + (near.x2 - player.x2) * pullFactor;
                                targetY = player.y2 + (near.y2 - player.y2) * pullFactor;
                            }
                        }
                        width = original1.width;
                        targetScreenHeight = original1.height;
                        if (pullFactor === 0) {
                            width *= 1.2;
                            targetScreenHeight *= 1.4;
                        }
                        camX = (camX * 24 + targetX) / 25;
                        camY = (camY * 24 + targetY) / 25;
                        camX = Math.max(540, Math.min(13840, camX));
                        camY = Math.max(200, Math.min(14240, camY));
                        maxScreenWidth += (width - maxScreenWidth) * smoothness;
                        maxScreenHeight += (targetScreenHeight - maxScreenHeight) * smoothness;
                        resize();
                    } else {
                        camX = Math.max(540, Math.min(13840, config.mapScale / 2));
                        camY = Math.max(200, Math.min(14240, config.mapScale / 2));
                        resize();
                    }
                } else {
                    if (player) {
                        if (false) {
                            camX = player.x;
                            camY = player.y;
                        } else {
                            let tmpDist = UTILS.getDistance(camX, camY, player.x, player.y);
                            let tmpDir = UTILS.getDirection(player.x, player.y, camX, camY);
                            let camSpd = Math.min(tmpDist * 0.01 * delta, tmpDist);
                            if (tmpDist > 0.05) {
                                camX += camSpd * Math.cos(tmpDir);
                                camY += camSpd * Math.sin(tmpDir);
                            } else {
                                camX = player.x;
                                camY = player.y;
                            }
                        }
                    } else {
                        camX = config.mapScale / 2 + config.riverWidth;
                        camY = config.mapScale / 2;
                    }
                }
                // INTERPOLATE PLAYERS AND AI:
                let lastTime = now - (1000 / config.serverUpdateRate);
                let tmpDiff;
                for (let i = 0; i < players.length + ais.length; ++i) {
                    tmpObj = players[i] || ais[i - players.length];
                    if (tmpObj && tmpObj.visible) {
                        if (tmpObj.forcePos) {
                            tmpObj.x = tmpObj.x2;
                            tmpObj.y = tmpObj.y2;
                            tmpObj.dir = tmpObj.d2;
                        } else {
                            let total = tmpObj.t2 - tmpObj.t1;
                            let fraction = lastTime - tmpObj.t1;
                            let ratio = (fraction / total);
                            let rate = 170;
                            tmpObj.dt += delta;
                            let tmpRate = Math.min(1.7, tmpObj.dt / rate);
                            tmpDiff = (tmpObj.x2 - tmpObj.x1);
                            tmpObj.x = tmpObj.x1 + (tmpDiff * tmpRate);
                            tmpDiff = (tmpObj.y2 - tmpObj.y1);
                            tmpObj.y = tmpObj.y1 + (tmpDiff * tmpRate);
                            tmpObj.dir = Math.lerpAngle(tmpObj.d2, tmpObj.d1, Math.min(1.2, ratio));
                        }
                    }
                }
                // RENDER CORDS:
                let xOffset = camX - (maxScreenWidth / 2);
                let yOffset = camY - (maxScreenHeight / 2);

                xof = xOffset;
                yof = yOffset;

                // RENDER BACKGROUND:
                if (config.snowBiomeTop - yOffset <= 0 && config.mapScale - config.snowBiomeTop - yOffset >= maxScreenHeight) {
                    mainContext.fillStyle = "#b6db66";
                    mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
                } else if (config.mapScale - config.snowBiomeTop - yOffset <= 0) {
                    mainContext.fillStyle = "#dbc666";
                    mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
                } else if (config.snowBiomeTop - yOffset >= maxScreenHeight) {
                    mainContext.fillStyle = "#fff";
                    mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
                } else if (config.snowBiomeTop - yOffset >= 0) {
                    mainContext.fillStyle = "#fff";
                    mainContext.fillRect(0, 0, maxScreenWidth, config.snowBiomeTop - yOffset);
                    mainContext.fillStyle = "#b6db66";
                    mainContext.fillRect(0, config.snowBiomeTop - yOffset, maxScreenWidth, maxScreenHeight - (config.snowBiomeTop - yOffset));
                    snowPath.render("#fff", xOffset, yOffset);
                } else {
                    mainContext.fillStyle = "#b6db66";
                    mainContext.fillRect(0, 0, maxScreenWidth, (config.mapScale - config.snowBiomeTop - yOffset));
                    mainContext.fillStyle = "#dbc666";
                    mainContext.fillRect(0, (config.mapScale - config.snowBiomeTop - yOffset), maxScreenWidth, maxScreenHeight - (config.mapScale - config.snowBiomeTop - yOffset));
                    desertPath.render("#b6db66", xOffset, yOffset);
                }

                // RENDER WATER AREAS:
                if (!firstSetup) {
                    waterMult += waterPlus * config.waveSpeed * delta;
                    if (waterMult >= config.waveMax) {
                        waterMult = config.waveMax;
                        waterPlus = -1;
                    } else if (waterMult <= 1) {
                        waterMult = waterPlus = 1;
                    }
                    mainContext.globalAlpha = 1;
                    mainContext.fillStyle = "#dbc666";
                    renderWaterBodies(xOffset, yOffset, mainContext, config.riverPadding);
                    mainContext.fillStyle = "#91b2db";
                    renderWaterBodies(xOffset, yOffset, mainContext, (waterMult - 1) * 250);
                }

                if (player) {
                    if (player.alive) {
                        drawCircles(tmpObj, xOffset, yOffset)
                    }
if (isC("renderGrid").checked) {
        mainContext.lineWidth = 3;
        mainContext.strokeStyle = "#000";
        mainContext.globalAlpha = 0.05;
        mainContext.beginPath();
        let ratfrr = 60;
        for (var x = -xOffset % ratfrr; x < maxScreenWidth; x += ratfrr) {
            if (x > 0) {
                mainContext.moveTo(x, 0);
                mainContext.lineTo(x, maxScreenHeight);
            }
        }
        for (var y = -yOffset % ratfrr; y < maxScreenHeight; y += ratfrr) {
            if (y > 0) {
                mainContext.moveTo(0, y);
                mainContext.lineTo(maxScreenWidth, y);
            }
        }
        mainContext.stroke();
    }
                    // DEATH LOCATION:
                    if (lastDeath) {
                        mainContext.globalAlpha = 1;
                        mainContext.fillStyle = "#fc5553";
                        mainContext.font = "100px Hammersmith One";
                        mainContext.textBaseline = "middle";
                        mainContext.textAlign = "center";
                        mainContext.fillText("x", lastDeath.x - xOffset, lastDeath.y - yOffset);
                    }
                }

                // RENDER DEAD PLAYERS:
                mainContext.globalAlpha = 1;
                mainContext.strokeStyle = outlineColor;
                renderDeadPlayers(xOffset, yOffset);

                // RENDER BOTTOM LAYER:
                mainContext.globalAlpha = 1;
                mainContext.strokeStyle = outlineColor;
                renderGameObjects(-1, xOffset, yOffset);

                // RENDER PROJECTILES:
                mainContext.globalAlpha = 1;
                mainContext.lineWidth = outlineWidth;
                renderProjectiles(0, xOffset, yOffset);

                // RENDER PLAYERS:
                renderPlayers(xOffset, yOffset, 0);

                // RENDER AI:
                mainContext.globalAlpha = 1;
                for (let i = 0; i < ais.length; ++i) {
                    tmpObj = ais[i];
                    if (tmpObj.active && tmpObj.visible) {
                        tmpObj.animate(delta);
                        mainContext.save();
                        mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
                        mainContext.rotate(tmpObj.dir + tmpObj.dirPlus - (Math.PI / 2));
                        renderAI(tmpObj, mainContext);
                        mainContext.restore();
                    }
                }

                // RENDER GAME OBJECTS (LAYERED):
                renderGameObjects(0, xOffset, yOffset);
                renderProjectiles(1, xOffset, yOffset);
                renderGameObjects(1, xOffset, yOffset);
                renderPlayers(xOffset, yOffset, 1);
                renderGameObjects(2, xOffset, yOffset);
                renderGameObjects(3, xOffset, yOffset);

             // MAP BOUNDARIES:
    mainContext.fillStyle = "#000";
    mainContext.globalAlpha = 0.09;
    if (xOffset <= 0) {
        mainContext.fillRect(0, 0, -xOffset, maxScreenHeight);
    }
    if (config.mapScale - xOffset <= maxScreenWidth) {
        let tmpY = Math.max(0, -yOffset);
        mainContext.fillRect(config.mapScale - xOffset, tmpY, maxScreenWidth - (config.mapScale - xOffset), maxScreenHeight - tmpY);
    }
    if (yOffset <= 0) {
        mainContext.fillRect(-xOffset, 0, maxScreenWidth + xOffset, -yOffset);
    }
    if (config.mapScale - yOffset <= maxScreenHeight) {
        let tmpX = Math.max(0, -xOffset);
        let tmpMin = 0;
        if (config.mapScale - xOffset <= maxScreenWidth)
            tmpMin = maxScreenWidth - (config.mapScale - xOffset);
        mainContext.fillRect(tmpX, config.mapScale - yOffset,
                             (maxScreenWidth - tmpX) - tmpMin, maxScreenHeight - (config.mapScale - yOffset));
    }

// RENDER DAY/NIGHT TIME:
    mainContext.globalAlpha = 0.5;
    mainContext.fillStyle = isC("morning").checked ? "rgb(0, 0, 50, 0.50)" : "rgb(5, 0, 70)";
    mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
    mainContext.strokeStyle = darkOutlineColor;
                // RENDER PLAYER AND AI UI:
                mainContext.strokeStyle = darkOutlineColor;
                mainContext.globalAlpha = 1;
                for (let i = 0; i < players.length + ais.length; ++i) {
                    tmpObj = players[i] || ais[i - players.length];
                    if (tmpObj.visible) {
                        mainContext.strokeStyle = darkOutlineColor;

                        // NAME AND HEALTH:
                        if (tmpObj.skinIndex != 10 || (tmpObj==player) || (tmpObj.team && tmpObj.team==player.team)) {
                            let tmpText = (tmpObj.team?"["+tmpObj.team+"] ":"")+(tmpObj.name||"")+(tmpObj.isPlayer?" {"+tmpObj.sid+"}":"");
                            if (tmpText != "") {
                                mainContext.font = (tmpObj.nameScale||30) + "px HammerSmith One";
                                mainContext.fillStyle = tmpObj.isPlayer ? syncersInServer.includes(tmpObj.sid) ? "#fff" : playersInServer.includes(tmpObj.sid) ? "#fff" : "#fff" : "#fff";
                                mainContext.textBaseline = "middle";
                                mainContext.textAlign = "center";
                                mainContext.lineWidth = (tmpObj.nameScale?11:8);
                                mainContext.lineJoin = "round";
                                mainContext.strokeText(tmpText, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY);
                                mainContext.fillText(tmpText, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY);
                                if (tmpObj.isLeader && iconSprites["crown"].isLoaded) {
                                    let tmpS = config.crownIconScale;
                                    let tmpX = tmpObj.x - xOffset - (tmpS/2) - (mainContext.measureText(tmpText).width / 2) - config.crownPad;
                                    mainContext.drawImage(iconSprites["crown"], tmpX, (tmpObj.y - yOffset - tmpObj.scale)
                                                          - config.nameY - (tmpS/2) - 5, tmpS, tmpS);
                                } if (tmpObj.iconIndex == 1 && iconSprites["skull"].isLoaded) {
                                    let tmpS = config.crownIconScale;
                                    let tmpX = tmpObj.x - xOffset - (tmpS/2) + (mainContext.measureText(tmpText).width / 2) + config.crownPad;
                                    mainContext.drawImage(iconSprites["skull"], tmpX, (tmpObj.y - yOffset - tmpObj.scale)
                                                          - config.nameY - (tmpS/2) - 5, tmpS, tmpS);
                                } if (tmpObj.isPlayer && instaC.wait && near == tmpObj && (tmpObj.backupNobull ? crossHairSprites[1].isLoaded : crossHairSprites[0].isLoaded) && enemy.length && !useWasd) {
                                    let tmpS = tmpObj.scale * 2.2;
                                    mainContext.drawImage((tmpObj.backupNobull ? crossHairSprites[1] : crossHairSprites[0]), tmpObj.x - xOffset - tmpS / 2, tmpObj.y - yOffset - tmpS / 2, tmpS, tmpS);
                                }
                            } if (tmpObj.health > 0) {
 // HEALTH HOLDER:
                        mainContext.fillStyle = darkOutlineColor;
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth - config.healthBarPad,
                                              (tmpObj.y - yOffset + tmpObj.scale) + config.nameY, (config.healthBarWidth * 2) +
                                              (config.healthBarPad * 2), 17, 8);
                        mainContext.fill();

                        // HEALTH BAR:
                        mainContext.fillStyle = (tmpObj == player || (tmpObj.team && tmpObj.team == player.team)) ? "#db69cc" : "#cc5151";
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth,
                                              (tmpObj.y - yOffset + tmpObj.scale) + config.nameY + config.healthBarPad,
                                              ((config.healthBarWidth * 2) * (tmpObj.health / tmpObj.maxHealth)), 17 - config.healthBarPad * 2, 7);
                        mainContext.fill();


                                    if (tmpObj.isPlayer) {

    mainContext.globalAlpha = 1;



                                        mainContext.globalAlpha = 1;
                    //reload lover rv
                    // SHAME COUNT:
                    mainContext.globalAlpha = 1;
                    mainContext.font = "25px Hammersmith One";
                    mainContext.fillStyle = "#fff";
                    mainContext.strokeStyle = "darkOutlineColor";
                    mainContext.textBaseline = "middle";
                    mainContext.textAlign = "center";
                    mainContext.lineWidth = tmpObj.nameScale ? 11 : 8;
                    mainContext.lineJoin = "round";
                    var tmpS = config.crownIconScale;
                    var tmpX = tmpObj.x - xOffset - tmpS / 2 + mainContext.measureText(tmpText).width / 2 + config.crownPad + (tmpObj.iconIndex == 1 ? (tmpObj.nameScale || 30) * 2.75 : tmpObj.nameScale || 30);
                    mainContext.strokeText(tmpObj.shameCount, tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 35);
                    mainContext.fillText(tmpObj.shameCount, tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 35);


                                    // PLAYER TRACER:
                                    if (!tmpObj.isTeam(player)) {
                                        let center = {
                                            x: screenWidth / 2,
                                            y: screenHeight / 2,
                                        };
                                        let alpha = Math.min(1, (UTILS.getDistance(0, 0, player.x - tmpObj.x, (player.y - tmpObj.y) * (16 / 9)) * 100) / (config.maxScreenHeight / 2) / center.y);
                                        let dist = center.y * alpha;
                                        let tmpX = dist * Math.cos(UTILS.getDirect(tmpObj, player, 0, 0));
                                        let tmpY = dist * Math.sin(UTILS.getDirect(tmpObj, player, 0, 0));
                                        mainContext.save();
                                        mainContext.translate((player.x - xOffset) + tmpX, (player.y - yOffset) + tmpY);
                                        mainContext.rotate(tmpObj.aim2 + Math.PI / 2);
                                        let by = 255 - (tmpObj.sid * 2);
                                        mainContext.fillStyle = `rgb(${by}, ${by}, ${by})`;
                                        mainContext.globalAlpha = alpha;
                                        let renderTracer = function(s, ctx) {
                                            ctx = ctx || mainContext;
                                            let h = s * (Math.sqrt(3) / 2);
                                            ctx.beginPath();
                                            ctx.moveTo(0, -h / 1.5);
                                            ctx.lineTo(-s / 2, h / 2);
                                            ctx.lineTo(s / 2, h / 2);
                                            ctx.lineTo(0, -h / 1.5);
                                            ctx.fill();
                                            ctx.closePath();
                                        }
                                        renderTracer(25, mainContext);
                                        mainContext.restore();
                                    }

                                    /*   if (getEl("predictType").value == "pre2") {
                                        mainContext.lineWidth = 3;
                                        mainContext.strokeStyle = "#cc5151";
                                        mainContext.globalAlpha = 1;
                                        mainContext.beginPath();
                                        let render = {
                                            x: tmpObj.x2 - xOffset,
                                            y: tmpObj.y2 - yOffset
                                        };
                                        mainContext.moveTo(tmpObj.x - xOffset, tmpObj.y - yOffset);
                                        mainContext.lineTo(render.x, render.y);
                                        mainContext.stroke();
                                    } else if (getEl("predictType").value == "pre3") {
                                        mainContext.lineWidth = 3;
                                        mainContext.strokeStyle = "#cc5151";
                                        mainContext.globalAlpha = 1;
                                        mainContext.beginPath();
                                        let render = {
                                            x: tmpObj.x3 - xOffset,
                                            y: tmpObj.y3 - yOffset
                                        };
                                        mainContext.moveTo(tmpObj.x - xOffset, tmpObj.y - yOffset);
                                        mainContext.lineTo(render.x, render.y);
                                        mainContext.stroke();
                                    }*/

                                }
                            }
                        }
                    }
                }

                if (player) {

                    // AUTOPUSH LINE:

                    renderPathFinder(mainContext, {x: xOffset, y: yOffset})

                    // FUNNY:
                    if (false /*petals.length && getEl("funni").checked*/) {

                        player.spinDir += 2.5 / 60;
                        let maxRad = 0;
                        if (clicks.left) {
                            maxRad = 100;
                        } else if (clicks.right) {
                            maxRad = 15;
                        } else {
                            maxRad = 40;
                        }
                        maxRad += player.scale;

                        petals.forEach((petal, i) => {
                            if (petal.active) {
                                let petalRad = (Math.PI * (i / (petals.length / 2)));
                                let pl = {
                                    x: player.x + (maxRad * Math.cos(player.spinDir + petalRad)),
                                    y: player.y + (maxRad * Math.sin(player.spinDir + petalRad))
                                };
                                let angle = UTILS.getDirect(pl, petal, 0, 0);
                                let dist = UTILS.getDist(pl, petal, 0, 0);
                                petal.x += (dist / 7) * Math.cos(angle);
                                petal.y += (dist / 7) * Math.sin(angle);

                                players.filter((tmp) => tmp.visible && tmp != player).forEach((tmp) => {
                                    let angle = UTILS.getDirect(petal, tmp, 0, 0);
                                    let dist = UTILS.getDist(petal, tmp, 0, 0);
                                    let sc = petal.scale + tmp.scale;
                                    if (dist <= sc) {
                                        let tD = dist - sc;
                                        let diff = -tD;
                                        petal.x += diff * Math.cos(angle);
                                        petal.y += diff * Math.sin(angle);
                                        petal.health -= 10;
                                        petal.damaged += 125;
                                        if (petal.health <= 0) {
                                            petal.active = false;
                                        }
                                    }
                                });

                            } else {
                                petal.time += delta;

                                if (petal.alive) {
                                    petal.alpha -= delta / 200;
                                    petal.visScale += delta / (petal.scale * 2);
                                    if (petal.alpha <= 0) {
                                        petal.alpha = 0;
                                        petal.alive = false;
                                    }
                                }

                                if (petal.time >= petal.timer) {
                                    petal.time = 0;
                                    petal.active = true;
                                    petal.alive = true;
                                    petal.x = player.x;
                                    petal.y = player.y;
                                    petal.health = petal.maxHealth;
                                    petal.damaged = 0;
                                    petal.alpha = 1;
                                    petal.visScale = petal.scale;
                                }
                            }

                            if (petal.alive) {

                                let cD = function(r, g, b, dmg) {
                                    return "rgb(" + `${Math.min(255, r + Math.floor(dmg))}, ${Math.max(0, g - Math.floor(dmg))}, ${Math.max(0, b - Math.floor(dmg))}` + ")";
                                }

                                mainContext.globalAlpha = petal.alpha;
                                mainContext.lineWidth = 3;
                                mainContext.fillStyle = cD(255, 255, 255, petal.damaged);
                                mainContext.strokeStyle = cD(200, 200, 200, petal.damaged);
                                mainContext.beginPath();
                                mainContext.arc(petal.x - xOffset, petal.y - yOffset, petal.visScale, 0, Math.PI * 2);
                                mainContext.fill();
                                mainContext.stroke();

                                petal.damaged = Math.max(0, petal.damaged - (delta / 2));

                            }

                        });
                    }

                }

                mainContext.globalAlpha = 1;

                // RENDER ANIM TEXTS:
                textManager.update(delta, mainContext, xOffset, yOffset);

               // RENDER CHAT MESSAGES:
for (let i = 0; i < players.length; ++i) {
    tmpObj = players[i];
    if (tmpObj.visible) {
        if (tmpObj.chatCountdown > 0) {
            tmpObj.chatCountdown -= delta;
            if (tmpObj.chatCountdown <= 0)
                tmpObj.chatCountdown = 0;

            mainContext.font = "32px Lilita One";
            let tmpSize = mainContext.measureText(tmpObj.chatMessage);
            mainContext.textBaseline = "middle";
            mainContext.textAlign = "center";
            let tmpX = tmpObj.x - xOffset;
            let tmpY = tmpObj.y - tmpObj.scale - yOffset - 90;
            let tmpH = 47;
            let tmpW = tmpSize.width + 17;

            // Background bubble
            mainContext.fillStyle = "rgba(0,0,0,0.2)";
            mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
            mainContext.fill();

            // Text with border
            mainContext.lineWidth = 8;
            mainContext.strokeStyle = "black";
            mainContext.strokeText(tmpObj.chatMessage, tmpX, tmpY); // Border
            mainContext.fillStyle = "#fff";
            mainContext.fillText(tmpObj.chatMessage, tmpX, tmpY);   // Fill
        }
                  if (tmpObj.chat.count > 0) {
                            if (!useWasd) {
                                tmpObj.chat.count -= delta;
                                if (tmpObj.chat.count <= 0)
                                    tmpObj.chat.count = 0;
                                mainContext.font = "32px Hammersmith One";
                                let tmpSize = mainContext.measureText(tmpObj.chat.message);
                                mainContext.textBaseline = "middle";
                                mainContext.textAlign = "center";
                                let tmpX = tmpObj.x - xOffset;
                                let tmpY = tmpObj.y - tmpObj.scale - yOffset + (90 * 2);
                                let tmpH = 47;
                                let tmpW = tmpSize.width + 17;
                                mainContext.fillStyle = "rgba(0,0,0,0.2)";
                                mainContext.roundRect(tmpX-tmpW/2, tmpY-tmpH/2, tmpW, tmpH, 6);
                                mainContext.fill();
                                mainContext.fillStyle = "#ffffff99";
                                mainContext.fillText(tmpObj.chat.message, tmpX, tmpY);
                            } else {
                                tmpObj.chat.count = 0;
                            }
                        }
                    }
                }

                if (allChats.length) {
                    allChats.filter(ch => ch.active).forEach((ch) => {
                        if (!ch.alive) {
                            if (ch.alpha <= 1) {
                                ch.alpha += delta / 250;
                                if (ch.alpha >= 1) {
                                    ch.alpha = 1;
                                    ch.alive = true;
                                }
                            }
                        } else {
                            ch.alpha -= delta / 5000;
                            if (ch.alpha <= 0) {
                                ch.alpha = 0;
                                ch.active = false;
                            }
                        }
                        if (ch.active) {
                            mainContext.font = "20px Ubuntu";
                            let tmpSize = mainContext.measureText(ch.chat);
                            mainContext.textBaseline = "middle";
                            mainContext.textAlign = "center";
                            let tmpX = ch.x - xOffset;
                            let tmpY = ch.y - yOffset - 90;
                            let tmpH = 40;
                            let tmpW = tmpSize.width + 15;

                            mainContext.globalAlpha = ch.alpha;

                            mainContext.fillStyle = ch.owner.isTeam(player) ? "#8ecc51" : "#cc5151";
                            mainContext.strokeStyle = "rgb(25, 25, 25)";
                            mainContext.strokeText(ch.owner.name, tmpX, tmpY - 45);
                            mainContext.fillText(ch.owner.name, tmpX, tmpY - 45);

                            mainContext.lineWidth = 5;
                            mainContext.fillStyle = "#ccc";
                            mainContext.strokeStyle = "rgb(25, 25, 25)";

                            mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
                            mainContext.stroke();
                            mainContext.fill();

                            mainContext.fillStyle = "#fff";
                            mainContext.strokeStyle = "#000";
                            mainContext.strokeText(ch.chat, tmpX, tmpY);
                            mainContext.fillText(ch.chat, tmpX, tmpY);
                            ch.y -= delta / 100;
                        }
                    });

                }
                renderShapes(mainContext, delta, xOffset, yOffset)
            }

            mainContext.globalAlpha = 1;

            // RENDER MINIMAP:
            renderMinimap(delta);
        }


        // UPDATE & ANIMATE:
        window.requestAnimFrame = function() {
            return null;
        }
        window.rAF = (function() {
            return window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                function(callback) {
                window.setTimeout(callback, 1000 / 60);
            };
        })();
        function doUpdate() {
            now = performance.now();
            delta = now - lastUpdate;
            lastUpdate = now;

            let timer = performance.now();
            let diff = timer - fpsTimer.last;
            if (diff >= 1000) {

                fpsTimer.ltime = fpsTimer.time * (1000 / diff);

                fpsTimer.last = timer;
                fpsTimer.time = 0;
            }
            fpsTimer.time++;
            pingDisplay.innerHTML = `Ping: ${ping} FPS: ${UTILS.round(fpsTimer.ltime, 10)} Packets: ${secPacket}`
            updateGame();
    rAF(doUpdate);
}
        prepareMenuBackground();
        doUpdate();

        let changeDays;
        window.debug = function() {
            my.waitHit = 0;
            my.autoAim = false;
            instaC.isTrue = false;
            autoBreak.active = false;
            itemSprites = [];
            objSprites = [];
            gameObjectSprites = [];
            debugStop = true;
            setTimeout(() => {
                debugStop = false
            }, 10000)
            game.tick = 0
        };


        window.wasdMode = function() {
            useWasd = !useWasd;
            toggleUseless(useWasd);
        };
        const wx = async t => new Promise(e => setTimeout(e, t));
        const bx = (e, t) => {
            const n = q3.url.split("token=")[0] + "token=" + encodeURIComponent("alt:" + V0);
            let c = new WebSocket(n);
            c.binaryType = "arraybuffer";
            c.botType = t;
            c.emit = (e, t, n, i) => {
                c.send(msgpack.encode([e, [t, n, i]]))
            };
            c.spawn = function() {
                c.emit("M", {
                    name: "unknown",
                    moofoll: 1,
                    skin: 0
                });
            };
            c.onopen = async () => {
                await wx(111);
                c.spawn();
            };
            c.onmessage = e => {
                let data = new Uint8Array(e.data);
                let parsed = msgpack.decode(data);
                let type = parsed[0];
                if (type == "P") {
                    c.spawn();
                }
            }
        };
        window.toggleVisual = function() {
            config.anotherVisual = !config.anotherVisual;
            gameObjects.forEach((tmp) => {
                if (tmp.active) {
                    tmp.dir = tmp.lastDir;
                }
            });
        };
        window.prepareUI = function(tmpObj) {
            resize();
            // ACTION BAR:
            UTILS.removeAllChildren(actionBar);
            for (let i = 0; i < (items.weapons.length + items.list.length); ++i) {
                (function(i) {
                    UTILS.generateElement({
                        id: "actionBarItem" + i,
                        class: "actionBarItem",
                        style: "display:none",
                        onmouseout: function() {
                            showItemInfo();
                        },
                        parent: actionBar
                    });
                })(i);
            }
            for (let i = 0; i < (items.list.length + items.weapons.length); ++i) {
                (function(i) {
                    let tmpCanvas = document.createElement("canvas");
                    tmpCanvas.width = tmpCanvas.height = 66;
                    let tmpContext = tmpCanvas.getContext("2d");
                    tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
                    tmpContext.imageSmoothingEnabled = false;
                    tmpContext.webkitImageSmoothingEnabled = false;
                    tmpContext.mozImageSmoothingEnabled = false;
                    if (items.weapons[i]) {
                        tmpContext.rotate((Math.PI/4)+Math.PI);
                        let tmpSprite = new Image();
                        toolSprites[items.weapons[i].src] = tmpSprite;
                        tmpSprite.onload = function() {
                            this.isLoaded = true;
                            let tmpPad = 1 / (this.height / this.width);
                            let tmpMlt = (items.weapons[i].iPad || 1);
                            tmpContext.drawImage(this, -(tmpCanvas.width*tmpMlt*config.iconPad*tmpPad)/2, -(tmpCanvas.height*tmpMlt*config.iconPad)/2,
                                                 tmpCanvas.width*tmpMlt*tmpPad*config.iconPad, tmpCanvas.height*tmpMlt*config.iconPad);
                            tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
                            tmpContext.globalCompositeOperation = "source-atop";
                            tmpContext.fillRect(-tmpCanvas.width / 2, -tmpCanvas.height / 2, tmpCanvas.width, tmpCanvas.height);
                            getEl('actionBarItem' + i).style.backgroundImage = "url(" + tmpCanvas.toDataURL() + ")";
                        };
                        tmpSprite.src = "./../img/weapons/" + items.weapons[i].src + ".png";
                        let tmpUnit = getEl('actionBarItem' + i);
                        tmpUnit.onmouseover = UTILS.checkTrusted(function() {
                            showItemInfo(items.weapons[i], true);
                        });
                        tmpUnit.onclick = UTILS.checkTrusted(function() {
                            selectWeapon(tmpObj.weapons[items.weapons[i].type]);
                        });
                        UTILS.hookTouchEvents(tmpUnit);
                    } else {
                        let tmpSprite = getItemSprite(items.list[i-items.weapons.length], true);
                        let tmpScale = Math.min(tmpCanvas.width - config.iconPadding, tmpSprite.width);
                        tmpContext.globalAlpha = 1;
                        tmpContext.drawImage(tmpSprite, -tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);
                        tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
                        tmpContext.globalCompositeOperation = "source-atop";
                        tmpContext.fillRect(-tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);
                        getEl('actionBarItem' + i).style.backgroundImage = "url(" + tmpCanvas.toDataURL() + ")";
                        let tmpUnit = getEl('actionBarItem' + i);
                        tmpUnit.onmouseover = UTILS.checkTrusted(function() {
                            showItemInfo(items.list[i - items.weapons.length]);
                        });
                        tmpUnit.onclick = UTILS.checkTrusted(function() {
                            selectToBuild(tmpObj.items[tmpObj.getItemType(i - items.weapons.length)]);
                        });
                        UTILS.hookTouchEvents(tmpUnit);
                    }
                })(i);
            }
        };
        window.toggleNight();

    },
});

    };
    if (document.readyState === "loading")
        document.addEventListener("DOMContentLoaded", __clientMain, { once: true });
    else
        __clientMain();
})();
