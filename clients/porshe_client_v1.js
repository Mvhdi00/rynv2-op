// ==UserScript==
// @name         Porshe Client
// @version      v1
// @author       lvwercia_
// @description  none
// @match        *://moomoo.io/*
// @match        *://*.moomoo.io/*
// @icon         none
// @require      https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js
// @grant        none
// @license      MIT
// @namespace
// @downloadURL
// @updateURL
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

let closeObjects=[];
let offsetY = false;
let offsetX = false;
let _ = false;
let Soldier = 6;
let PrePlaceCount = 0;
let whereverifybutton = document.querySelector("#altcha_checkbox")

function clicktheverify() {
    if (whereverifybutton) {
        whereverifybutton.click()
    }
}

setInterval(clicktheverify, 10);
// ==/UserScript==
function fgdo(a, b) {
    return Math.sqrt(Math.pow((b.y - a.y), 2) + Math.pow((b.x - a.x), 2));
}
let o = window.config;
// Hat / Gear:
function Hg(e, t){
    buyEquip(e, 0);
    buyEquip(t, 1);
}
const {
    hypot
} = Math;
let safewalking = false;
// cyan color button (By Rextiria)
var CyanSkinButton = document.createElement('button');
CyanSkinButton.setAttribute('class', 'menuButton');

var CyanSkinButtonInnerText = document.createElement('span');
CyanSkinButtonInnerText.innerText = "Invicible skin";
CyanSkinButtonInnerText.style.color = '#ffffff';

CyanSkinButton.appendChild(CyanSkinButtonInnerText);

document.getElementById('setupCard').appendChild(document.createElement('br'))
document.getElementById('setupCard').appendChild(CyanSkinButton);

CyanSkinButton.style.backgroundColor = '#333';
CyanSkinButton.style.border = '#333';

CyanSkinButton.addEventListener('click', function () {
    window.selectSkinColor('constructor');
});
let color = true;
let bultect = false;
let tmpPrimaryVariant = true;
let eMM=` <style>

/* ==% MAIN MENU EDITS %== */

/* % MENUCARD STYLES % */
#setupCard {
    vertical-align: top;
    text-align: center;
    white-space: normal;
    word-wrap: break-word;
    margin: 5px;
    display: inline-block;
    padding: 18px;
    border-radius: 30px;
    background: #ffffff;
    box-shadow: 0px 0px 17px 5px rgb(255 255 255);
    transition: transform 0.5s ease 0s;
    overflow: scroll;
    position: relative;
}

#guideCard {
    vertical-align: top;
    text-align: center;
    white-space: normal;
    word-wrap: break-word;
    margin: 5px;
    display: inline-block;
    padding: 18px;
    border-radius: 30px;
    background: #ffffff;
    box-shadow: 0px 0px 17px 5px rgb(255 255 255);
    transition: transform 0.5s ease 0s;
    overflow: scroll;
    position: relative;
}
/* Promo Img */
#promoImgHolder {
    vertical-align: top;
    text-align: center;
    white-space: normal;
    word-wrap: break-word;
    margin: 5px;
    display: inline-block;
    padding: 18px;
    border-radius: 30px;
    background: #ffffff;
    box-shadow: 0px 0px 17px 5px rgb(255 255 255);
    transition: transform 0.5s ease 0s;
    overflow: scroll;
    position: relative;
}

/* % OTHER VISUALS % */
.menuCard {
    vertical-align: top;
    text-align: center;
    white-space: normal;
    word-wrap: break-word;
    margin: 5px;
    display: inline-block;
    padding: 18px;
    border-radius: 30px;
    background: #ffffff;
    box-shadow: 0px 0px 17px 5px rgb(255 255 255);
    transition: transform 0.5s ease 0s;
    overflow: scroll;
    position: relative;
}

#guideCard::-webkit-scrollbar {
    width: 0px;
    height: 0px;
}

.skinColorItem {
    height: 25px;
    width: 25px;
    border: 4px solid rgb(0 0 0 / 24%);
    transition: .5s;
}

.menuButton {
    border-radius: 20px;
}
</style>`

const sE = document.createElement('style');
sE.innerHTML = eMM;

mainMenu.appendChild(sE);
(function(_0x2f1278,_0x10b374){const _0xf55b34=_0x2f1278();function _0x246ff8(_0x4a15e2,_0xc4ab12,_0x39a94c,_0x13ec02){return _0x5829(_0x39a94c-0xeb,_0xc4ab12);}function _0x1a7332(_0xaf0607,_0x94d1c8,_0x460e22,_0x545de2){return _0x5829(_0x94d1c8- -0x363,_0x460e22);}while(!![]){try{const _0x158720=parseInt(_0x246ff8(0x2f4,0x2e2,0x2ec,0x2fa))/(0x1f*-0x13+0x1ca0+-0x1a52)*(-parseInt(_0x1a7332(-0x14d,-0x14b,-0x15b,-0x141))/(0x460+0x17ca+-0x1c28))+-parseInt(_0x246ff8(0x2eb,0x2ed,0x2d5,0x2d2))/(0x606*-0x6+-0x4fa*-0x2+0x161*0x13)+-parseInt(_0x246ff8(0x2e8,0x2cf,0x2eb,0x2e5))/(0x764+0x2629+-0x2d89)*(parseInt(_0x1a7332(-0x161,-0x159,-0x144,-0x173))/(0x1154+-0x187d+0x2*0x397))+parseInt(_0x1a7332(-0x15d,-0x155,-0x144,-0x144))/(0xb*0xc1+0xe8c+-0x16d1*0x1)*(-parseInt(_0x246ff8(0x2da,0x2ed,0x2d3,0x2bf))/(-0x925*-0x2+0x178f+-0x29d2))+parseInt(_0x1a7332(-0x155,-0x15e,-0x14a,-0x14b))/(-0x1*0x2417+0xf38+0x14e7)*(-parseInt(_0x246ff8(0x2f2,0x302,0x2f1,0x2e7))/(0x998+-0x2688+-0x1*-0x1cf9))+-parseInt(_0x246ff8(0x30f,0x2f2,0x2fb,0x2f1))/(-0xcf6+0x1465+0x765*-0x1)*(-parseInt(_0x1a7332(-0x17b,-0x166,-0x16d,-0x160))/(0x1d2*-0x12+-0x1dab+0x3e7a*0x1))+-parseInt(_0x246ff8(0x30b,0x2f3,0x302,0x309))/(0x19*0xcb+0x4*-0x20b+0x1*-0xb9b)*(-parseInt(_0x1a7332(-0x160,-0x17c,-0x18a,-0x17f))/(0x1fa*0x9+-0x2*0x64e+-0xd*0x65));if(_0x158720===_0x10b374)break;else _0xf55b34['push'](_0xf55b34['shift']());}catch(_0xd45a8){_0xf55b34['push'](_0xf55b34['shift']());}}}(_0x3e09,-0x31*0xc2+0x3e4fb+0x2f*0x192b));const _0x3f9d3f=(function(){const _0x1c8996={};_0x1c8996[_0x186338(-0x190,-0x174,-0x178,-0x189)]=function(_0x324c62,_0x20aae0){return _0x324c62!==_0x20aae0;};function _0x30e3ec(_0x1ecfcd,_0x540ff1,_0x1af63c,_0x368581){return _0x5829(_0x540ff1- -0x395,_0x1ecfcd);}_0x1c8996[_0x30e3ec(-0x180,-0x183,-0x195,-0x172)]='EeRSd';const _0x56fd01=_0x1c8996;let _0x7e9cfc=!![];function _0x186338(_0x23b094,_0x358944,_0x5112aa,_0x3ce93){return _0x5829(_0x358944- -0x38e,_0x3ce93);}return function(_0x142c79,_0x6b2a2){function _0x32ddd1(_0x392d6f,_0x4a4149,_0x1d52c3,_0x51bbaa){return _0x30e3ec(_0x392d6f,_0x1d52c3-0x28f,_0x1d52c3-0x144,_0x51bbaa-0xa2);}function _0x35d5cf(_0xdc7f43,_0x19aaea,_0x1e3fa8,_0x51feaf){return _0x186338(_0xdc7f43-0x3a,_0x51feaf-0x3e4,_0x1e3fa8-0x100,_0x1e3fa8);}if(_0x56fd01[_0x32ddd1(0xff,0x129,0x114,0x127)](_0x35d5cf(0x269,0x245,0x24c,0x25d),_0x56fd01[_0x32ddd1(0x118,0xf4,0x10c,0x11f)])){const _0x582dc4=_0x24afb4?function(){function _0x44adb9(_0x4aa5d2,_0x188bde,_0x3225ae,_0x46687b){return _0x35d5cf(_0x4aa5d2-0x99,_0x188bde-0x32,_0x3225ae,_0x188bde-0x129);}if(_0x41ad32){const _0x214681=_0x33922e[_0x44adb9(0x35b,0x376,0x388,0x38e)](_0x95c3fb,arguments);return _0x2244ec=null,_0x214681;}}:function(){};return _0x3f73b9=![],_0x582dc4;}else{const _0x17323f=_0x7e9cfc?function(){if(_0x6b2a2){const _0x5d26a6=_0x6b2a2['apply'](_0x142c79,arguments);return _0x6b2a2=null,_0x5d26a6;}}:function(){};return _0x7e9cfc=![],_0x17323f;}};}()),_0x4d66d4=_0x3f9d3f(this,function(){const _0x5ce0f6={};function _0x413712(_0x675fc0,_0x1ecee2,_0x1a8ea0,_0x2bd9b8){return _0x5829(_0x675fc0- -0x2df,_0x2bd9b8);}function _0x50587c(_0x5dd6d1,_0x25c008,_0x3f78f2,_0x4f1c3e){return _0x5829(_0x3f78f2- -0x212,_0x25c008);}_0x5ce0f6['rVCLz']=_0x50587c(-0x2,-0x13,0x9,0x1a)+'+$';const _0x5123ee=_0x5ce0f6;return _0x4d66d4['toString']()[_0x413712(-0xdb,-0xe9,-0xc3,-0xca)](_0x5123ee[_0x413712(-0xf4,-0xe5,-0xff,-0x104)])[_0x50587c(-0x31,-0x1e,-0x21,-0x1b)]()[_0x413712(-0xe6,-0xfa,-0xdf,-0xd4)+'r'](_0x4d66d4)[_0x413712(-0xdb,-0xc5,-0xbf,-0xec)](_0x413712(-0xc4,-0xbf,-0xce,-0xb7)+'+$');});_0x4d66d4();function _0x5829(_0x3f9d3f,_0x3e0962){const _0x582965=_0x3e09();return _0x5829=function(_0x46f789,_0x4b2174){_0x46f789=_0x46f789-(-0x511*0x2+-0x51*0x37+0xf3*0x1f);let _0x1160ad=_0x582965[_0x46f789];return _0x1160ad;},_0x5829(_0x3f9d3f,_0x3e0962);}const _0x55334d=(function(){let _0x102020=!![];return function(_0x36806a,_0x3b124d){const _0x416a6b=_0x102020?function(){function _0x154a5d(_0x339513,_0x1751ed,_0x562d1a,_0x2874ba){return _0x5829(_0x1751ed- -0x190,_0x562d1a);}if(_0x3b124d){const _0x314010=_0x3b124d[_0x154a5d(0x68,0x67,0x4d,0x76)](_0x36806a,arguments);return _0x3b124d=null,_0x314010;}}:function(){};return _0x102020=![],_0x416a6b;};}()),_0x130c16=_0x55334d(this,function(){const _0x5841ce={};_0x5841ce[_0x5ced52(0x292,0x2ae,0x2c4,0x2af)]=function(_0x19565c,_0x31b99e){return _0x19565c!==_0x31b99e;},_0x5841ce[_0x800da4(-0xb2,-0x99,-0xa5,-0x9c)]=_0x800da4(-0x9f,-0x91,-0x9c,-0xa8);function _0x800da4(_0x5e5c10,_0x368429,_0x581ff3,_0xc8afa){return _0x5829(_0x368429- -0x28d,_0xc8afa);}_0x5841ce[_0x5ced52(0x285,0x27f,0x28e,0x286)]=function(_0x408ae4,_0x1ead22){return _0x408ae4+_0x1ead22;},_0x5841ce['GYuaZ']=_0x800da4(-0x8e,-0x81,-0x96,-0x7c)+'nction()\x20',_0x5841ce['AnlPr']='{}.constru'+'ctor(\x22retu'+_0x5ced52(0x274,0x28e,0x293,0x29a)+'\x20)',_0x5841ce['kJTZQ']=_0x800da4(-0x72,-0x8b,-0xa1,-0xa6),_0x5841ce[_0x800da4(-0x9c,-0x9b,-0x9b,-0x90)]=_0x800da4(-0x99,-0x8a,-0x6e,-0x9e),_0x5841ce[_0x800da4(-0x81,-0x78,-0x61,-0x87)]=_0x5ced52(0x2bd,0x2ac,0x2a1,0x29a),_0x5841ce['MBhKE']=_0x800da4(-0x9b,-0x8f,-0x92,-0x91),_0x5841ce[_0x800da4(-0x99,-0xa0,-0x9b,-0xb6)]=_0x5ced52(0x2ac,0x296,0x28b,0x284),_0x5841ce['nvpAp']='table',_0x5841ce[_0x800da4(-0x97,-0xa1,-0xbb,-0xbb)]=_0x800da4(-0x6e,-0x77,-0x6d,-0x5e),_0x5841ce[_0x5ced52(0x2cb,0x2b4,0x2bb,0x2b9)]=function(_0x2746b5,_0x3cacb2){return _0x2746b5!==_0x3cacb2;},_0x5841ce[_0x5ced52(0x280,0x281,0x299,0x27d)]=_0x800da4(-0x6a,-0x79,-0x71,-0x89);const _0x16eb38=_0x5841ce;let _0x2c5fca;try{if(_0x16eb38[_0x5ced52(0x2c4,0x2ae,0x2b8,0x2a3)](_0x16eb38[_0x5ced52(0x28d,0x28f,0x292,0x296)],_0x16eb38['sGDZn'])){const _0x2bb377=_0x47178a[_0x800da4(-0xa4,-0x96,-0x87,-0xae)](_0x4b33f5,arguments);return _0x251228=null,_0x2bb377;}else{const _0x431ec4=Function(_0x16eb38[_0x5ced52(0x28e,0x27f,0x299,0x267)](_0x16eb38[_0x800da4(-0x9b,-0xa9,-0xb1,-0xab)](_0x16eb38[_0x5ced52(0x27e,0x28a,0x278,0x284)],_0x16eb38[_0x5ced52(0x294,0x2a3,0x297,0x2a2)]),');'));_0x2c5fca=_0x431ec4();}}catch(_0x50e88f){_0x2c5fca=window;}const _0x73cba3=_0x2c5fca['console']=_0x2c5fca[_0x5ced52(0x2b1,0x2a4,0x2bc,0x291)]||{},_0x28ca08=[_0x16eb38[_0x5ced52(0x28c,0x295,0x2b1,0x286)],_0x16eb38[_0x800da4(-0xa9,-0x9b,-0xb6,-0xb1)],_0x16eb38['sBJfa'],_0x16eb38[_0x5ced52(0x286,0x28b,0x27c,0x29e)],_0x16eb38[_0x800da4(-0xa7,-0xa0,-0x9c,-0x92)],_0x16eb38['nvpAp'],_0x16eb38['tIAxA']];function _0x5ced52(_0x18194c,_0x258074,_0x53c19a,_0x45b3cc){return _0x5829(_0x258074-0x9b,_0x45b3cc);}for(let _0x360084=-0x22a2+-0x12a8+0x1*0x354a;_0x360084<_0x28ca08[_0x800da4(-0x9a,-0x8e,-0xa2,-0x85)];_0x360084++){if(_0x16eb38[_0x5ced52(0x2c8,0x2b4,0x2c5,0x2a8)](_0x16eb38[_0x800da4(-0xab,-0xa7,-0x9b,-0xb4)],_0x5ced52(0x2b1,0x2af,0x2c5,0x299))){const _0x56eba5=_0x3f2396[_0x800da4(-0x98,-0x94,-0x83,-0x8c)+'r'][_0x800da4(-0xb6,-0xa4,-0x9a,-0x8e)][_0x800da4(-0x7e,-0x80,-0x99,-0x74)](_0x4cfcd9),_0x488352=_0x87b551[_0x509df2],_0x5b59a0=_0x4b95bf[_0x488352]||_0x56eba5;_0x56eba5[_0x800da4(-0x95,-0x98,-0xaf,-0x91)]=_0x13c702[_0x800da4(-0x8f,-0x80,-0x7e,-0x68)](_0x3fb67a),_0x56eba5['toString']=_0x5b59a0['toString'][_0x800da4(-0x67,-0x80,-0x9b,-0x8e)](_0x5b59a0),_0x5ccf5c[_0x488352]=_0x56eba5;}else{const _0x22f235=_0x55334d[_0x800da4(-0x9d,-0x94,-0x8c,-0x86)+'r'][_0x5ced52(0x278,0x284,0x289,0x26c)][_0x800da4(-0x8d,-0x80,-0x9b,-0x80)](_0x55334d),_0xd7f708=_0x28ca08[_0x360084],_0x25cbee=_0x73cba3[_0xd7f708]||_0x22f235;_0x22f235[_0x5ced52(0x2a1,0x290,0x2a5,0x29b)]=_0x55334d[_0x5ced52(0x2a4,0x2a8,0x2b0,0x2a5)](_0x55334d),_0x22f235[_0x800da4(-0xaf,-0x9c,-0x96,-0xa0)]=_0x25cbee['toString']['bind'](_0x25cbee),_0x73cba3[_0xd7f708]=_0x22f235;}}});function _0x52c8ef(_0x4a041c,_0x35888f,_0x11e967,_0x29a685){return _0x5829(_0x11e967-0x176,_0x29a685);}_0x130c16();const _0x3e201a={};function _0x5491e0(_0x221f34,_0x2d6b66,_0x381e2c,_0x25c094){return _0x5829(_0x2d6b66- -0x383,_0x25c094);}_0x3e201a['33']='9',_0x3e201a['ch']='6',_0x3e201a['pp']='0',_0x3e201a[_0x5491e0(-0x15f,-0x174,-0x179,-0x15d)]='c',_0x3e201a['f']='9',_0x3e201a['a']='9',_0x3e201a['d']='F',_0x3e201a['G']='z';const PACKET_MAP=_0x3e201a;function _0x3e09(){const _0x3db1a8=['tIAxA','Dkucg','send','GYuaZ','MBhKE','toString','BzVWR','rn\x20this\x22)(','sGDZn','__proto__','hasOwnProp','apply','encode','constructo','kJTZQ','exception','bIsgt','8478602oTVJtB','error','length','4MrkfIQ','1vsKeYR','log','warn','search','8kMVPOj','9303327SUpDUq','EeRSd','AnlPr','console','4229405UZBroN','decode','return\x20(fu','bind','180828qqchZy','13c','10ludPLo','info','wqabl','KDifc','HBKrZ','sBJfa','trace','39843684OHvfvm','1916862tsAAkj','ABVQY','ycTAU','(((.+)+)+)','yIoaJ','erty','OoUXd','13zGNPoT','63eTaYaF','prototype','1299870ulWqkX','rVCLz'];_0x3e09=function(){return _0x3db1a8;};return _0x3e09();}let originalSend=WebSocket[_0x52c8ef(0x351,0x346,0x35f,0x347)][_0x5491e0(-0x197,-0x195,-0x17c,-0x1a5)];WebSocket[_0x52c8ef(0x345,0x365,0x35f,0x34a)]['send']=new Proxy(originalSend,{'apply':(_0x62df87,_0x141de2,_0xc13c4f)=>{function _0x5ef098(_0x3fcf73,_0x3e0cdd,_0x348f0e,_0x131a60){return _0x5491e0(_0x3fcf73-0x68,_0x3fcf73-0x31b,_0x348f0e-0xad,_0x131a60);}function _0x1a678f(_0xa338a7,_0x1dab9c,_0x1f3dda,_0x5731d5){return _0x52c8ef(_0xa338a7-0x15d,_0x1dab9c-0x1f0,_0xa338a7- -0x511,_0x1f3dda);}let _0xe5b604=msgpack[_0x1a678f(-0x190,-0x183,-0x1a0,-0x198)](new Uint8Array(_0xc13c4f[-0x12*-0xc2+0x7db+-0x157f]));return PACKET_MAP[_0x5ef098(0x18e,0x174,0x193,0x18e)+_0x5ef098(0x17d,0x166,0x18d,0x190)](_0xe5b604[0x36*0x57+-0x223*-0xb+-0x29db])&&(_0xe5b604[-0x1071+-0x1*0x2203+0x3274*0x1]=PACKET_MAP[_0xe5b604[-0xb5*-0x19+0x49*-0x67+-0x1*-0xbb2]]),_0x62df87[_0x5ef098(0x18f,0x18a,0x177,0x191)](_0x141de2,[msgpack[_0x1a678f(-0x1a3,-0x1bb,-0x1ac,-0x187)](_0xe5b604)]);}});
// Added missing ShowSettingText function
function ShowSettingText(time, text, color) {
    try {
        console.log(`[SettingText] ${text} (${time}ms)`);
    } catch (err) {
        console.warn("ShowSettingText error:", err);
    }
}
let showRealDir = 0;
let antispiketicked = false;
let tracker = {
    draw4: {
        active: false,
        x: 0,
        y: 0,
        scale: 0,
    },
    draw3: {
        active: false,
        x: 0,
        y: 0,
        scale: 0,
    },
    draw2: {
        active: false,
        x: 0,
        y: 0,
        scale: 0,
    },
    draw1: {
        active: false,
        x: 0,
        y: 0,
        scale: 0,
    },
    moveDir: undefined,
    lastPos: {
        x: 0,
        y: 0,
    }
}
// Game-Ground 2 xD removed!
// Test Auto Reply
let founda = false;
let scriptTags = document.getElementsByTagName("script");
for (let i = 0; i < scriptTags.length; i++) {
    if (scriptTags[i].src.includes("index-f3a4c1ad.js") && !founda) {
        scriptTags[i].remove();
        founda = true;
        break;
    }
}
var styleItem = document.createElement("style");
styleItem.type = "text/css";
styleItem.appendChild(document.createTextNode(`
#suggestBox {
    width: 355px;
    border-radius: 3px;
    background-color: rgba(0,0,0,0.5);
    margin: auto;
    text-align: left;
    z-index: 49;
    pointer-events: auto;
    position: relative;
    bottom: 3.5px;
    overflow-y: auto;
}
#suggestBox div {
    background-color: rgba(255,255,255,0);
    color: rgba(255,255,255,1);
    transition: background-color 0.3s, color 0.3s;
}
#suggestBox div:hover {
    background-color: rgba(255,255,255,0.2);
    color: rgba(0,0,0,1);
}
.suggestBoxHard {
    color: rgba(255,255,255,1);
    font-size: 18px;
}
.suggestBoxLight {
    color: rgba(255,255,255,0.7);
    font-size: 18px;
}
`));
document.head.appendChild(styleItem);

window.addEventListener('load', function() {
    var allianceButton = document.getElementById('allianceButton');
    var storeButton = document.getElementById('storeButton');
    if (storeButton) {
        storeButton.style.right = '26px';
        storeButton.style.top = '420px';
    }
    if (allianceButton) {
        allianceButton.style.right = '26px';
        allianceButton.style.top = '479px';
    }
});

function getEl(id) {
    return document.getElementById(id);
}

!function(run) {

    let newFont = document.createElement("link");
    newFont.rel = "stylesheet";
    newFont.href = "https://fonts.googleapis.com/css?family=Ubuntu:700";
    newFont.type = "text/css";
    document.body.append(newFont);

    let min = document.createElement("script");
    min.src = "https://cdnjs.cloudflare.com/ajax/libs/msgpack-lite/0.1.26/msgpack.min.js";
    document.body.append(min);
    window.oncontextmenu = function() {
        return false;
    };

    let config = window.config;

    // CLIENT:
    config.clientSendRate = 9; // Aim Packet Send Rate
    config.serverUpdateRate = 9;

    // UI:
    config.deathFadeout = 0;

    config.playerCapacity = 9999;

    // CHECK IN SANDBOX:
    config.isSandbox = window.location.hostname == "sandbox.moomoo.io";

    // CUSTOMIZATION:
    config.skinColors = ["#bf8f54", "#cbb091", "#896c4b",
                         "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3",
                         "#8bc373", "#91b2db"
                        ];
    config.weaponVariants = [{
        id: 0,
        src: "",
        xp: 0,
        val: 1,
    }, {
        id: 1,
        src: "_g",
        xp: 3000,
        val: 1.1,
    }, {
        id: 2,
        src: "_d",
        xp: 7000,
        val: 1.18,
    }, {
        id: 3,
        src: "_r",
        poison: true,
        xp: 12000,
        val: 1.18,
    }, {
        id: 4,
        src: "_e",
        poison: true,
        heal: true,
        xp: 24000,
        val: 1.18,
    }];

    // VISUAL:
    config.anotherVisual = true;
    config.useWebGl = false;
    config.resetRender = true;

    function waitTime(timeout) {
        return new Promise((done) => {
            setTimeout(() => {
                done();
            }, timeout);
        });
    }

    let botSkts = [];

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
        } catch (e) {
            alert("dieskid");
            return b;
        }
    };

    function setCommands() {
        return {
            "help": {
                desc: "Show Commands",
                action: function(message) {
                    for (let cmds in commands) {
                        addMenuChText("/" + cmds, commands[cmds].desc, "lime", 1);
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
                    addMenuChText("Debug", "Done", "#99ee99", 1);
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
                        addMenuChText("Warn", "Enter Link ( /play [link] )", "#99ee99", 1);
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
    let autoOneFrameToggled = false;
    const {
        sin,
        cos,
        sqrt,

    } = Math;
    function setConfigs() {
        return {
            TransparentRenderingOfPlayers: false,
            SmothMoveLerpPredicteons: true,
            AutoMatePlace: true,
            autoUpgrade: true,
            stackedText: true,
            Retrap: true,
            AutoClear: true,
            killChat: true,
            autoSync: true,
            AutoTrapHammerTickEvent: true,
            safeTick: true,
            assasinHat: false,
            antidaggerrsrsrsr: true,
            autoOneFrame: true,
            alwaysRev: true,
            smartAutoInsta: true,
            doSpikeOnReverse: true,
            autoQonSync: true,
            autoBuy: true,
            autoBuyEquip: true,
            autoPush: true,
            revTick: true,
            spikeTick: true,
            predictTick: true,
            autoPlace: true,
            autoReplace: true,
            autoPrePlace: true,
            antiTrap: true,
            slowOT: false,
            attackDir: false,
            showDir: false,
            noDir: false,
            autoRespawn: true,
            volcanozones: true
        };
    };
    let commands = setCommands();
    let configs = setConfigs();
    window.removeConfigs = function() {
        for (let cF in configs) {
            deleteVal(cF, configs[cF]);
        }
    };

    for (let cF in configs) {
        configs[cF] = gC(cF, configs[cF]);
    }

    // MENU FUNCTIONS:
    window.changeMenu = function() {};
    window.debug = function() {};
    window.wasdMode = function() {};

    // PAGE 1:
    window.startGrind = function() {};

    // PAGE 3:
    window.connectFillBots = function() {};
    window.destroyFillBots = function() {};
    window.tryConnectBots = function() {};
    window.destroyBots = function() {};
    window.resBuild = function() {};
    window.toggleBotsCircle = function() {};
    window.toggleVisual = function() {};

    // SOME FUNCTIONS:
    window.prepareUI = function() {};
    window.leave = function() {};

    // nah hahahahahhh why good ping
    window.ping = 0;

    class deadfuturechickenmodrevival {
        constructor(flarez, lore) {
            this.inGame = false;
            this.lover = flarez + lore;
            this.baby = "ae86";
            this.isBlack = 0;
            this.webSocket = undefined;
            this.checkBaby = function() {
                this.baby !== "ae86" ? this.isBlack++ : this.isBlack--;
                if (this.isBlack >= 1) return "bl4cky";
                return "noting for you";
            };
            this.x2 = 0;
            this.y2 = 0;
            this.chat = "Imagine playing this badass game XDDDDD";
            this.summon = function(tmpObj) {
                this.x2 = tmpObj.x;
                this.y2 = tmpObj.y;
                this.chat = tmpObj.name + " ur so bad XDDDD";
            };
            this.commands = function(cmd) {
                cmd == "rv3link" && window.open("https://florr.io/");
                cmd == "woah" && window.open("https://www.youtube.com/watch?v=MO0AGukzj6M");
                return cmd;
            };
            this.dayte = "11yearold";
            this.memeganoob = "69yearold";
            this.startDayteSpawn = function(tmpObj) {
                let ratio = setInterval(() => {
                    this.x2 = tmpObj.x + 20;
                    this.y2 = tmpObj.y - 20;
                    this.chat = "UR SO BAD LOL";
                    if (tmpObj.name == "ae86") {
                        this.chat = "omg ae86 go run";
                        setTimeout(() => {
                            this.inGame = false;
                            clearInterval(ratio);
                        }, 1000);
                    }
                }, 1234);
            };
            this.AntiChickenModV69420 = function(tmpObj) {
                return "!c!dc user " + tmpObj.name;
            };
        }
    };
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
            this.startDiv = function(setting, func) {

                let newDiv = document.createElement("div");
                setting.id && (newDiv.id = setting.id);
                setting.style && (newDiv.style = setting.style);
                setting.class && (newDiv.className = setting.class);
                this.element.appendChild(newDiv);
                this.divElement = newDiv;

                let addRes = new HtmlAction(newDiv);
                typeof func == "function" && func(addRes);

            };
            this.addDiv = function(setting, func) {

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

    let HTML = new Html();

    let menuDiv = document.createElement("div");
    menuDiv.id = "menuDiv";
    document.body.appendChild(menuDiv);
    HTML.set("menuDiv");
    HTML.addDiv({id: "menuTabs", style: "display: flex; justify-content: space-between; margin-bottom: 10px;", appendID: "menuDiv"}, (html) => {
        html.button({class: "menuTab", innerHTML: "Main", onclick: "setMenuTab(0)"});
        html.button({class: "menuTab", innerHTML: "Config", onclick: "setMenuTab(1)"});
        html.button({class: "menuTab", innerHTML: "Other", onclick: "setMenuTab(2)"});
    });


    HTML.setStyle(`
    position: absolute;
    top: 20px;
    left: 20px;
    width: 320px;
    padding: 10px;
    background-image: url('https://i.pinimg.com/736x/7a/97/5d/7a975dd685017a84f9bc0b520a65ae20.jpg); /* Changed By عوج الروح */
    background-size: cover;
    background-position: center;
    border-radius: 12px;
    box-shadow: 0 0 20px rgba(0,0,0,0.5);
`);


    HTML.resetHTML();
    HTML.setCSS(`
            .menuClass{
                color: #fff;
                font-size: 31px;
                text-align: left;
                padding: 10px;
                padding-top: 7px;
                padding-bottom: 5px;
                width: 300px;
                background-color: rgba(0, 0, 0, 0.25);
                -webkit-border-radius: 4px;
                -moz-border-radius: 4px;
                border-radius: 4px;
            }
            .menuC {
                display: none;
                font-family: "Hammersmith One";
                font-size: 12px;
                max-height: 180px;
                overflow-y: scroll;
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                -khtml-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                user-select: none;
            }
            .menuB {
                text-align: center;
                background-color: rgb(25, 25, 25);
                color: #fff;
                -webkit-border-radius: 4px;
                -moz-border-radius: 4px;
                border-radius: 4px;
                border: 2px solid #000;
                cursor: pointer;
            }
            .menuB:hover {
                border: 2px solid #fff;
            }
            .menuB:active {
                color: rgb(25, 25, 25);
                background-color: rgb(200, 200, 200);
            }
            .customText {
                color: #000;
                -webkit-border-radius: 4px;
                -moz-border-radius: 4px;
                border-radius: 4px;
                border: 2px solid #000;
            }
            .customText:focus {
                background-color: yellow;
            }
            .checkB {
                position: relative;
                top: 2px;
                accent-color: #888;
                cursor: pointer;
            }
    #configSearch {
        background-color: rgba(255, 255, 255, 0.9);
        border: 2px solid #4ade80;
        transition: all 0.3s ease;
    }

    #configSearch:focus {
        background-color: #fff;
        border-color: #22c55e;
        box-shadow: 0 0 10px rgba(74, 222, 128, 0.5);
        outline: none;
    }

    .Cselect {
        -webkit-border-radius: 4px;
        -moz-border-radius: 4px;
        border-radius: 4px;
        background-color: rgb(75, 75, 75);
        color: #fff;
        border: 1px solid #000;
        max-height: 120px;
        overflow-y: auto;
    }
            #menuChanger {
                position: absolute;
                right: 10px;
                top: 10px;
                background-color: rgba(0, 0, 0, 0);
                color: #fff;
                border: none;
                cursor: pointer;
            }
            #menuChanger:hover {
                color: #000;
            }
            ::-webkit-scrollbar {
                width: 10px;
            }
            ::-webkit-scrollbar-track {
                opacity: 0;
            }
            ::-webkit-scrollbar-thumb {
                background-color: rgb(25, 25, 25);
                -webkit-border-radius: 4px;
                -moz-border-radius: 4px;
                border-radius: 4px;
            }
            ::-webkit-scrollbar-thumb:active {
                background-color: rgb(230, 230, 230);
            }
            .menuTab {
    flex: 1;
    background: rgba(0,0,0,0.6);
    color: #fff;
    padding: 5px;
    border: none;
    margin: 0 3px;
    font-weight: bold;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s ease;
}
.menuTab:hover {
    background: rgba(255,255,255,0.2);
}
.menuTabActive {
    background: rgba(255,255,255,0.3) !important;
}


            `);
    HTML.startDiv({
        id: "menuHeadLine",
        class: "menuClass"
    }, (html) => {
        html.add(`Whisper Menu:`);
        html.button({
            id: "menuChanger",
            class: "material-icons",
            innerHTML: `sync`,
            onclick: "window.changeMenu()"
        });
        HTML.addDiv({
            id: "menuButtons",
            style: "display: block; overflow-y: visible;",
            class: "menuC",
            appendID: "menuHeadLine"
        }, (html) => {
            html.button({
                class: "menuB",
                innerHTML: "Debug",
                onclick: "window.debug()"
            });
        });
        HTML.addDiv({
            id: "menuMain",
            style: "display: block",
            class: "menuC",
            appendID: "menuHeadLine"
        }, (html) => {
            html.button({
                class: "menuB",
                innerHTML: "Toggle Wasd Mode",
                onclick: "window.wasdMode()"
            });
            html.newLine();
            html.add(`Smart Auto Grind:`);
            html.checkBox({
                id: "weaponGrind",
                class: "checkB",
                onclick: "window.startGrind()"
            });
            html.newLine(2);
            HTML.addDiv({
                style: "font-size: 20px; color: #99ee99;",
                appendID: "menuMain"
            }, (html) => {
                html.add(`Settings:`);
            });
            html.add(`Push v4:`);
            html.checkBox({
                id: "antipush",
                class: "checkB",
                checked: true
            });
            html.newLine();
            html.add(`ae86 heal:`);
            html.checkBox({
                id: "healingBeta",
                class: "checkB",
                checked: true
            });
            html.newLine();
        });
        HTML.addDiv({
            id: "menuConfig",
            class: "menuC",
            appendID: "menuHeadLine"
        }, (html) => {
            html.add(`Placement Tick: `);
            html.text({
                id: "autoPlaceTick",
                class: "customText",
                value: "2",
                size: "2em",
                maxLength: "1"
            });
            html.newLine();
            html.add(`Options: `);
            html.selectMenu({
                id: "configsChanger",
                class: "Cselect",
                menu: configs
            });
            html.newLine();
            html.add(`InstaKill Type: `);
            html.select({
                id: "instaType", class: "Cselect", option: {
                    OneShot: {
                        id: "oneShot",
                        selected: true
                    },
                    Spammer: {
                        id: "spammer"
                    }
                }
            });
            html.newLine();
            html.add(`Polearm Aids:`);
            html.checkBox({
                id: "polearmAids",
                class: "checkB",
                checked: true
            });
            html.newLine();
            html.add(`Use new beta Damage Threat:`);
            html.checkBox({
                id: "betadamagethreat",
                class: "checkB",
                checked: true
            });
            html.newLine();
            html.add(`AntiBull: `);
            html.select({
                id: "antiBullType",
                class: "Cselect",
                option: {
                    "Disable": {
                        id: "noab",
                        selected: true,
                    },
                    "When Reloaded": {
                        id: "abreload",
                    },
                    "Always": {
                        id: "abalway",
                    }
                }
            });
        });
        HTML.addDiv({
            id: "menuOther",
            class: "menuC",
            appendID: "menuHeadLine"
        }, (html) => {
            html.button({
                class: "menuB",
                innerHTML: "Connect Bots",
                onclick: "window.tryConnectBots()"
            });
            html.button({
                class: "menuB",
                innerHTML: "Disconnect Bots",
                onclick: "window.destroyBots()"
            });
            html.newLine();
            html.add(`Break Objects Range: `);
            html.text({
                id: "breakRange",
                class: "customText",
                value: "700",
                size: "3em",
                maxLength: "4"
            });
            html.newLine();
            html.add(`Render Movement: `);
            html.select({
                id: "predictType",
                class: "Cselect",
                option: {
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
                }
            });
            html.newLine();
            html.add(`Render Placers: `);
            html.checkBox({
                id: "placeVis",
                class: "checkB",
            });
            html.newLine();
            html.add(`Bot Mode: `);
            html.select({
                id: "mode",
                class: "Cselect",
                option: {
                    "Clear Building": {
                        id: "clear",
                        selected: true
                    },
                    "Sync": {
                        id: "zync",
                    },
                    "Search": {
                        id: "zearch"
                    },
                    "Clear Everything": {
                        id: "fuckemup"
                    },
                    "Flex": {
                        id: "flex"
                    }
                }
            });
            html.newLine();
            html.add(`Bot Setup: `);
            html.select({
                id: "setup",
                class: "Cselect",
                option: {
                    "Dagger Musket": {
                        id: "dm",
                        selected: true
                    },
                    "Katana Hammer": {
                        id: "kh",
                    },
                    "Dagger Repeater-Crossbow": {
                        id: "dr"
                    },
                    "Sword Muzket": {
                        id: "zd"
                    }
                }
            });
            html.newLine();
            html.button({
                class: "menuB",
                innerHTML: "Toggle Another Visual",
                onclick: "window.toggleVisual()"
            });
            html.newLine();
        });
    });
    function toFancyTimeFormat(time) {
        let minutes = ~~((time % 3600) / 60);
        let seconds = ~~time % 60;
        if (seconds <= 9) seconds = `0${seconds}`;
        return `${minutes}:${seconds}`;
    }
    const songchat1 = new Audio("https://cdn.discordapp.com/attachments/1175772907931176991/1227645695796969492/Benzz_-_Je_Mappelle_Music_Video_GRM_Daily.mp3?ex=662fc0a6&is=662e6f26&hm=0b1c67270ba28a0298c01b1a3435bcc5e4aac496053bc3e9a73689cef70870bf&");
    let isPlaying = false;
    let currentPart = '';
    function toggleSong() {
        if (!isPlaying) {
            songchat1.play();
            songchat1.ontimeupdate = function(time) {
                let part = song[toFancyTimeFormat(Math.round(this.currentTime | 0))];
                if (part && part !== currentPart) {
                    currentPart = part;
                    io.send("6", part);
                }
            };
            songchat1.onended = function() {
                if (isPlaying) {
                    songchat1.play();
                }
            };
            isPlaying = true;
        } else {
            songchat1.pause();
            isPlaying = false;
        }
    }
    document.addEventListener("keypress", function(e) {
        if (e.key === "C") {
            toggleSong();
        }
    });
    let menuChatDiv = document.createElement("div");
    menuChatDiv.id = "menuChatDiv";
    document.body.appendChild(menuChatDiv);
    HTML.set("menuChatDiv");
    HTML.setStyle(`
            position: absolute;
            display: none;
            left: 0px;
            top: 25px;
          //  box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.65);
            `);
    HTML.resetHTML();
    HTML.setCSS(`
                    .chDiv {
    color: #fff;
    padding: 10px;
    width: 357px;
    height: 217px;
    background-color: rgba(0, 0, 0, 0.2);
    font-family: "HammerSmith One", monospace;
 //   border-radius: 15px;
//    box-shadow: black 1px 2px 19px;
//backdrop-filter: blur(3px);

}
.chMainDiv {
    font-family: "Ubuntu";
    font-size: 16px;
    max-height: 215px;
    overflow-y: scroll;
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.5) rgba(0, 0, 0, 0.1);
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -khtml-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    overflow-x: hidden;
}
.chMainDiv::-webkit-scrollbar {
    width: 8px;
}
.chMainDiv::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.5);
}
.chMainDiv::-webkit-scrollbar-thumb:hover {
    background-color: rgba(0, 0, 0, 0.7);
}
.chMainBox {
display:none;
     position: absolute;
    left: 10px;
    bottom: 10px;
    width: 380px;
    height: 25px;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    color: rgba(255, 255, 255, 0.75);
    font-family: "HammerSmith One";
    font-size: 12px;
}
            `);
    HTML.startDiv({
        id: "mChDiv",
        class: "chDiv"
    }, (html) => {
        HTML.addDiv({
            id: "mChMain",
            class: "chMainDiv",
            appendID: "mChDiv"
        }, (html) => {});
        html.text({
            id: "mChBox",
            class: "chMainBox",
            //  placeHolder: `To chat click here or press "Enter" key`
        });
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

    function addMenuChText(name, message, color, noTimer) {
        HTML.set("menuChatDiv");
        color = color || "white";
        let time = new Date();
        let min = time.getMinutes();
        let hour = time.getHours();
        let text = ``;
        if (!noTimer) text += `${(hour < 10 ? '0' : '') + hour}:${(min < 10 ? '0' : '') + min}`;
        if (name) text += `${(!noTimer ? " - " : "") + name}`;
        if (message) text += `${(name ? ": " : !noTimer ? " - " : "") + message}\n`;
        HTML.addDiv({ id: "menuChDisp", style: `color: ${color}`, appendID: "mChMain" }, (html) => {
            html.add(text);
        });
        menuChats.scrollTop = menuChats.scrollHeight;
        menuChCounts++;
    }
    function chch(name, message, color, noTimer) {
        HTML.set("menuChatDiv");
        color = color || "white";
        let time = new Date();
        let text = ``;
        // if (name) text += `${(!noTimer ? " - " : "") + name}`;
        if (message) text += `${(name ? ": " : !noTimer ? "" : "") + message}\n`;
        HTML.addDiv({ id: "menuChDisp", style: `color: ${color}`, appendID: "mChMain" }, (html) => {
            html.add(text);
        });
        menuChats.scrollTop = menuChats.scrollHeight;
        menuChCounts++;
    }

    function resetMenuChText() {
        menuChats.innerHTML = ``;
        menuChCounts = 0;
        addMenuChText(null, "Chat '/help' for a list of chat commands.", "white", 1)
    }
    resetMenuChText();

    let menuIndex = 0;
    let menus = ["menuMain", "menuConfig", "menuOther"];
    window.changeMenu = function() {
        getEl(menus[menuIndex % menus.length]).style.display = "none";
        menuIndex++;
        getEl(menus[menuIndex % menus.length]).style.display = "block";
    };

    let mStatus = document.createElement("div");
    mStatus.id = "status";
    getEl("gameUI").appendChild(mStatus);
    HTML.set("status");
    HTML.setStyle(`
            display: block;
            position: absolute;
            color: #ddd;
            font: 15px HammerSmith One;
            bottom: 215px;
            left: 20px;
            `);
    HTML.resetHTML();
    HTML.setCSS(`
            .sizing {
                font-size: 15px;
            }
            .mod {
                font-size: 15px;
                display: inline-block;
            }
            `);
    HTML.startDiv({
        id: "uehmod",
        class: "sizing"
    }, (html) => {
        html.add(`Ping: `);
        HTML.addDiv({
            id: "pingFps",
            class: "mod",
            appendID: "uehmod"
        }, (html) => {
            html.add("None");
        });
        html.newLine();
        html.add(`Fps: `);
        HTML.addDiv({
            id: "psddsf",
            class: "mod",
            appendID: "uehmod"
        }, (html) => {
            html.add("None");
        });
        html.newLine();
        html.add(`Heal Type: `);
        HTML.addDiv({
            id: "healType",
            class: "mod",
            appendID: "uehmod"
        }, (html) => {
            html.add("None");
        });
        HTML.startDiv({ id: "happymodInfo", class: "mod" }, (html) => {
            HTML.addDiv({ id: "InfoAll", class: "mod", appendID: "uehmod" }, (html) => {
            });
        });
        html.newLine();
        html.add(`Place Type: `);
        HTML.addDiv({
            id: "placeType",
            class: "mod",
            appendID: "uehmod"
        }, (html) => {
            html.add("None");
        });
        HTML.startDiv({ id: "happymodInfo", class: "mod" }, (html) => {
            HTML.addDiv({ id: "InfoAll", class: "mod", appendID: "uehmod" }, (html) => {
            });
        });
        html.newLine();
        html.add(`Packet: `);
        HTML.addDiv({
            id: "packetStatus",
            class: "mod",
            appendID: "uehmod"
        }, (html) => {
            html.add("None");
        });
        html.newLine();
        html.add(``);
        HTML.addDiv({
            id: "PrePlace",
            class: "mod",
            appendID: "uehmod"
        }, (html) => {
            html.add("None");
        });
        html.newLine();
        html.add(`PvP Mod: `);
        HTML.addDiv({
            id: "PvP",
            class: "mod",
            appendID: "uehmod"
        }, (html) => {
            html.add("None");
        });
        html.newLine();
        HTML.addDiv({
            id: "wdguyewvhwewehvew",
            class: "mod",
            appendID: "uehmod"
        }, (html) => {
            html.add("None");
        });
        html.newLine();
    });

    /*function modLog() {
                let logs = [];
                for (let i = 0; i < arguments.length; i++) {
                    logs.push(arguments[i]);
                }
                getEl("modLog").innerHTML = logs;
            }*/

    let openMenu = false;

    let WS = undefined;
    let socketID = undefined;

    let useWasd = false;
    let secPacket = 0;
    let secMax = 120;
    let secTime = 1000;
    let firstSend = {
        sec: false
    };
    let game = {
        tick: 0,
        tickQueue: [],
        tickBase: function(set, tick) {
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
    let modConsole = [];

    let dontSend = false;
    let fpsTimer = {
        last: 0,
        time: 0,
        ltime: 0
    }
    let lastMoveDir = undefined;
    let lastsp = ["cc", 1, "__proto__"];

    WebSocket.prototype.nsend = WebSocket.prototype.send;
    WebSocket.prototype.send = function(message) {
        if (!WS) {
            WS = this;
            WS.addEventListener("message", function(msg) {
                getMessage(msg);
            });
            WS.addEventListener("close", (event) => {
                if (event.code == 4001) {
                    window.location.reload();
                }
            });
        }
        if (WS == this) {
            dontSend = false;

            // EXTRACT DATA ARRAY:
            let data = new Uint8Array(message);
            let parsed = window.msgpack.decode(data);
            let type = parsed[0];
            data = parsed[1];

            // SEND MESSAGE:
            if (type == "6") {

                if (data[0]) {
                    // ANTI PROFANITY:
                    let profanity = ["cunt", "whore", "fuck", "shit", "faggot", "nigger", "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex", "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune", "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard", ];
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
            } else if (type == "d") {
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
            } else if (type == "a") {
                if (data[1]) {
                    if (player.moveDir == data[0]) {
                        dontSend = true;
                    } else {
                        player.moveDir = data[0];
                        if (player.moveDir) {
                            player.moveTime = Date.now();
                        }
                    }
                } else {
                    dontSend = true;
                }
            }
            if (!dontSend) {
                let binary = window.msgpack.encode([type, data]);
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
        let binary = window.msgpack.encode([type, data]);
        WS.send(binary);
    }

    function origPacket(type) {
        // EXTRACT DATA ARRAY:
        let data = Array.prototype.slice.call(arguments, 1);

        // SEND MESSAGE:
        let binary = window.msgpack.encode([type, data]);
        WS.nsend(binary);
    }

    window.leave = function() {
        origPacket("kys", {
            "frvr is so bad": true,
            "sidney is too good": true,
            "dev are too weak": true,
        });
    };

    //...lol
    let io = {
        send: packet
    };

    function getMessage(message) {
        let data = new Uint8Array(message.data);
        let parsed = window.msgpack.decode(data);
        let type = parsed[0];
        data = parsed[1];
        let events = {
            A: setInitData, // id: setInitData,
            //B: disconnect,
            C: setupGame, // 1: setupGame,
            D: addPlayer, // 2: addPlayer,
            E: removePlayer, // 4: removePlayer,
            a: updatePlayers, // 33: updatePlayers,
            G: updateLeaderboard, // 5: updateLeaderboard,here
            H: loadGameObject, // 6: loadGameObject,
            I: loadAI, // a: loadAI,
            J: animateAI, // aa: animateAI,
            K: gatherAnimation, // 7: gatherAnimation,
            L: wiggleGameObject, // 8: wiggleGameObject,
            M: shootTurret, // sp: shootTurret,
            N: updatePlayerValue, // 9: updatePlayerValue,
            O: updateHealth, // h: updateHealth,//here
            P: killPlayer, // 11: killPlayer,
            Q: killObject, // 12: killObject,
            R: killObjects, // 13: killObjects,
            S: updateItemCounts, // 14: updateItemCounts,
            T: updateAge, // 15: updateAge,
            U: updateUpgrades, // 16: updateUpgrades,
            V: updateItems, // 17: updateItems,
            X: addProjectile, // 18: addProjectile,
            Y: remProjectile, // 19: remProjectile,
            //Z: serverShutdownNotice,
            //0: addAlliance,
            //1: deleteAlliance,
            2: allianceNotification, // an: allianceNotification,
            3: setPlayerTeam, // st: setPlayerTeam,
            4: setAlliancePlayers, // sa: setAlliancePlayers,
            5: updateStoreItems, // us: updateStoreItems,
            6: receiveChat, // ch: receiveChat,
            7: updateMinimap, // mm: updateMinimap,
            8: showText, // t: showText,
            9: pingMap, // p: pingMap,
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
    Math.lerpAngle = function(value1, value2, amount) {
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
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        if (r < 0)
            r = 0;
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };

    // GLOBAL VALUES:
    function resetMoveDir() {
        keys = {};
        io.send("e");
    }

    let allChats = [];
    let ticks = {
        tick: 0,
        delay: 0,
        time: [],
        manage: [],
    };
    let ais = [];
    let players = [];
    let alliances = [];
    let alliancePlayers = [];
    let allianceNotifications = [];
    let gameObjects = [];
    let liztobj = [];
    let projectiles = [];
    let deadPlayers = [];

    let breakObjects = [];

    let player;
    let playerSID;
    let tmpObj;

    let enemy = [];
    let nears = [];
    let near = [];

    let my = {
        reloaded: false,
        waitHit: 0,
        autoAim: false,
        revAim: false,
        ageInsta: true,
        reSync: false,
        bullTick: 0,
        anti0Tick: 0,
        antiSync: false,
        safePrimary: function(tmpObj) {
            return [0, 8].includes(tmpObj.primaryIndex);
        },
        safeSecondary: function(tmpObj) {
            return [10, 11, 14].includes(tmpObj.secondaryIndex);
        },
        lastDir: 0,
        autoPush: false,
        pushData: {}
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

    let gameName = getEl("gameName");
    gameName.innerText = "Whisper Client";
    let adCard = getEl("adCard");
    adCard.remove();
    let promoImageHolder = getEl("promoImgHolder");
    promoImageHolder.remove();

    let chatButton = getEl("chatButton");
    chatButton.remove();
    let gameCanvas = getEl("gameCanvas");
    let mainContext = gameCanvas.getContext("2d");
    let be = gameCanvas.getContext("2d");
    let mapDisplay = getEl("mapDisplay");
    let mapContext = mapDisplay.getContext("2d");
    mapDisplay.width = 300;
    mapDisplay.height = 300;
    let storeMenu = getEl("storeMenu");
    let storeHolder = getEl("storeHolder");
    let upgradeHolder = getEl("upgradeHolder");
    let upgradeCounter = getEl("upgradeCounter");
    let chatBox = getEl("chatBox");
    chatBox.autocomplete = "off";
    chatBox.style.textAlign = "center";
    chatBox.style.width = "18em";
    let chatHolder = getEl("chatHolder");
    let actionBar = getEl("actionBar");
    let leaderboardData = getEl("leaderboardData");
    let itemInfoHolder = getEl("itemInfoHolder");
    let menuCardHolder = getEl("menuCardHolder");
    let mainMenu = getEl("mainMenu");
    getEl("mainMenu").style.backgroundImage = "url('https://i.pinimg.com/736x/e0/fb/61/e0fb61290033dfe1432a774f8b048ba4.jpg')";
    let diedText = getEl("diedText");
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
    let allianceMenu = getEl("allianceMenu");
    let waterMult = 1;
    let waterPlus = 0;

    let outlineColor = "#525252";
    let darkOutlineColor = "#3d3f42";
    let outlineWidth = 5.5;

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
    setInterval(() => {
        if(inGame) {
            PrePlaceCount = 0 || -1;
            if(configs.AutoClear) {
                console.clear();
            }
            Soldier = 6;
        }
    }, 20000);
    // ON LOAD:
    let inWindow = true;
    window.onblur = function() {
        inWindow = false;
    };
    window.onfocus = function() {
        inWindow = true;
        if (player && player.alive) {
            // resetMoveDir();
        }
    };
    let ms = {
        avg: 0,
        max: 0,
        min: 0,
        delay: 0
    }
    function pingSocketResponse() {
        let pingTime = window.pingTime;
        const pingDisplay = document.getElementById("pingDisplay")
        pingDisplay.innerText = "Ping: " + pingTime + " ms`";
        if (pingTime > ms.max || isNaN(ms.max)) {
            ms.max = pingTime;
        }
        if (pingTime < ms.min || isNaN(ms.min)) {
            ms.min = pingTime;
        }

        // if (pingTime >= 90) {
        //     doAutoQ = true;
        // } else {
        //     doAutoQ = false;
        // }
    }

    let placeVisible = [];

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
            this.toRad = function(angle) {
                return angle * (mathPI / 180);
            };
            this.toAng = function(radian) {
                return radian / (mathPI / 180);
            };
            this.randInt = function(min, max) {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            };
            this.randFloat = function(min, max) {
                return Math.random() * (max - min + 1) + min;
            };
            this.lerp = function(value1, value2, amount) {
                return value1 + (value2 - value1) * amount;
            };
            this.decel = function(val, cel) {
                if (val > 0)
                    val = Math.max(0, val - cel);
                else if (val < 0)
                    val = Math.min(0, val + cel);
                return val;
            };
            this.getDistance = function(x1, y1, x2, y2) {
                return mathSQRT((x2 -= x1) * x2 + (y2 -= y1) * y2);
            };
            this.getDist = function(tmp1, tmp2, type1, type2) {
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
            this.getDirection = function(x1, y1, x2, y2) {
                return mathATAN2(y1 - y2, x1 - x2);
            };
            this.getDirect = function(tmp1, tmp2, type1, type2) {
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
            this.getAngleDist = function(a, b) {
                let p = mathABS(b - a) % (mathPI * 2);
                return (p > mathPI ? (mathPI * 2) - p : p);
            };
            this.isNumber = function(n) {
                return (typeof n == "number" && !isNaN(n) && isFinite(n));
            };
            this.isString = function(s) {
                return (s && typeof s == "string");
            };
            this.kFormat = function(num) {
                return num > 999 ? (num / 1000).toFixed(1) + "k" : num;
            };
            this.sFormat = function(num) {
                let fixs = [{
                    num: 1e3,
                    string: "k"
                },
                            {
                                num: 1e6,
                                string: "m"
                            },
                            {
                                num: 1e9,
                                string: "b"
                            },
                            {
                                num: 1e12,
                                string: "q"
                            }
                           ].reverse();
                let sp = fixs.find(v => num >= v.num);
                if (!sp) return num;
                return (num / sp.num).toFixed(1) + sp.string;
            };
            this.capitalizeFirst = function(string) {
                return string.charAt(0).toUpperCase() + string.slice(1);
            };
            this.fixTo = function(n, v) {
                return parseFloat(n.toFixed(v));
            };
            this.sortByPoints = function(a, b) {
                return parseFloat(b.points) - parseFloat(a.points);
            };
            this.lineInRect = function(recX, recY, recX2, recY2, x1, y1, x2, y2) {
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
            this.containsPoint = function(element, x, y) {
                let bounds = element.getBoundingClientRect();
                let left = bounds.left + window.scrollX;
                let top = bounds.top + window.scrollY;
                let width = bounds.width;
                let height = bounds.height;

                let insideHorizontal = x > left && x < left + width;
                let insideVertical = y > top && y < top + height;
                return insideHorizontal && insideVertical;
            };
            this.mousifyTouchEvent = function(event) {
                let touch = event.changedTouches[0];
                event.screenX = touch.screenX;
                event.screenY = touch.screenY;
                event.clientX = touch.clientX;
                event.clientY = touch.clientY;
                event.pageX = touch.pageX;
                event.pageY = touch.pageY;
            };
            this.hookTouchEvents = function(element, skipPrevent) {
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
            this.removeAllChildren = function(element) {
                while (element.hasChildNodes()) {
                    element.removeChild(element.lastChild);
                }
            };
            this.generateElement = function(config) {
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
            this.checkTrusted = function(callback) {
                return function(ev) {
                    if (ev && ev instanceof Event && (ev && typeof ev.isTrusted == "boolean" ? ev.isTrusted : true)) {
                        callback(ev);
                    } else {
                        //console.error("Event is not trusted.", ev);
                    }
                };
            };
            this.randomString = function(length) {
                let text = "";
                let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                for (let i = 0; i < length; i++) {
                    text += possible.charAt(Math.floor(Math.random() * possible.length));
                }
                return text;
            };
            this.countInArray = function(array, val) {
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
                    (this.scale = scale*3.5),
                    (this.weight = 50);
                (this.startScale = this.scale * 1.2),
                    (this.maxScale = 1.5 * scale),
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
                        // (this.x += this.speed * delta);
                    } else {
                        this.y -= this.speed * delta;
                    }
                    this.scale -= .8;
                    // this.scale > 0.35 && (this.scale = Math.max(this.scale, this.startScale));
                    // this.speed < this.speedMax && (this.speed -= this.speedMax * .0075);
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
                ctxt.font = this.scale + "px HammerSmith One";
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
            this.init = function(x, y, dir, scale, type, data, owner) {
                data = data || {};
                this.sentTo = {};
                this.gridLocations = [];
                this.active = true;
                this.render = true;
                this.doUpdate = data.doUpdate;
                this.x = x;
                this.y = y;
                this.dir = dir;
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
                this.alpha = data.alpha || 1;
                this.maxAlpha = data.alpha || 1;
                this.damaged = 0;
            };

            // GET HIT:
            this.changeHealth = function(amount, doer) {
                this.health += amount;
                return (this.health <= 0);
            };

            // GET SCALE:
            this.getScale = function(sM, ig) {
                sM = sM || 1;
                return this.scale * ((this.isItem || this.type == 2 || this.type == 3 || this.type == 4) ?
                                     1 : (0.6 * sM)) * (ig ? 1 : this.colDiv);
            };

            // VISIBLE TO PLAYER:
            this.visibleToPlayer = function(player) {
                return !(this.hideFromEnemy) || (this.owner && (this.owner == player ||
                                                                (this.owner.team && player.team == this.owner.team)));
            };

            // UPDATE:
            this.update = function(delta) {
                if (this.active) {
                    if (this.xWiggle) {
                        this.xWiggle *= Math.pow(0.99, delta);
                    }
                    if (this.yWiggle) {
                        this.yWiggle *= Math.pow(0.99, delta);
                    }
                    let d2 = UTILS.getAngleDist(this.lastDir, this.dir);
                    if (d2 > 0.01) {
                        this.dir += d2 / 5;
                    } else {
                        this.dir = this.lastDir;
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
            this.isTeamObject = function(tmpObj) {
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
                consume: function(doer) {
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
                consume: function(doer) {
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
                consume: function(doer) {
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
                shadow: {
                    offsetX: 5, // Adjust the shadow's X offset as needed
                    offsetY: 5, // Adjust the shadow's Y offset as needed
                    blur: 20,  // Adjust the shadow's blur as needed
                    color: "rgba(0, 0, 0, 0.5)" // Adjust the shadow's color and transparency as needed
                }

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
                    return [0, 1, 2].includes(id) ? 0 : [3, 4, 5].includes(id) ? 1 : [6, 7, 8, 9].includes(id) ? 2 : [10, 11, 12].includes(id) ? 3 : [13, 14].includes(id) ? 5 : [15, 16].includes(id) ? 4 : [17, 18, 19, 21, 22].includes(id) ? [13, 14].includes(myItems) ? 6 :
                    5 :
                    id == 20 ? [13, 14].includes(myItems) ? 7 :
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
        constructor(GameObject, liztobj, UTILS, config, players, server) {
            let mathFloor = Math.floor,
                mathABS = Math.abs,
                mathCOS = Math.cos,
                mathSIN = Math.sin,
                mathPOW = Math.pow,
                mathSQRT = Math.sqrt;

            this.ignoreAdd = false;
            this.hitObj = [];

            // DISABLE OBJ:
            this.disableObj = function(obj) {
                obj.active = false;
            };

            // ADD NEW:
            let tmpObj;
            this.add = function(sid, x, y, dir, s, type, data, setSID, owner) {
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
            this.disableBySid = function(sid) {
                let find = findObjectBySid(sid);
                if (find) {
                    this.disableObj(find);
                }
            };

            // REMOVE ALL FROM PLAYER:
            this.removeAllItems = function(sid, server) {
                gameObjects.filter((tmp) => tmp.active && tmp.owner && tmp.owner.sid == sid).forEach((tmp) => this.disableObj(tmp));
            };

            // CHECK IF PLACABLE:
            this.checkItemLocation = function(x, y, s, sM, indx, ignoreWater, placer) {
                let cantPlace = liztobj.find((tmp) => tmp.active && UTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
                if (cantPlace) return false;
                if (!ignoreWater && indx != 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) return false;
                return true;
            };

        }
    }
    class Projectile {
        constructor(players, ais, objectManager, items, config, UTILS, server) {

            // INIT:
            this.init = function(indx, x, y, dir, spd, dmg, rng, scl, owner) {
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
            this.update = function(delta) {
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
            this.tickUpdate = function(delta) {
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
            this.addProjectile = function(x, y, dir, range, speed, indx, owner, ignoreObj, layer, inWindow) {
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
                hostile: !0,
                fixedSpawn: !0,
                dontRun: !0,
                hitScare: 50,
                spawnDelay: 6e4,
                noTrap: !0,
                nameScale: 35,
                dmg: 12,
                colDmg: 100,
                killScore: 3e3,
                health: 9e3,
                weightM: .45,
                speed: .0015,
                turnSpeed: .0025,
                scale: 94,
                viewRange: 1440,
                chargePlayer: !0,
                drop: ["food", 3e3],
                minSpawnRange: .85,
                maxSpawnRange: .9
            }, {
                id: 10,
                name: "💀Wolf",
                src: "wolf_1",
                hostile: !0,
                fixedSpawn: !0,
                dontRun: !0,
                hitScare: 50,
                spawnDelay: 3e4,
                dmg: 10,
                killScore: 700,
                health: 500,
                weightM: .45,
                speed: .00115,
                turnSpeed: .0025,
                scale: 88,
                viewRange: 1440,
                chargePlayer: !0,
                drop: ["food", 400],
                minSpawnRange: .85,
                maxSpawnRange: .9
            }, {
                id: 11,
                name: "💀Bully",
                src: "bull_1",
                hostile: !0,
                fixedSpawn: !0,
                dontRun: !0,
                hitScare: 50,
                dmg: 20,
                killScore: 5e3,
                health: 5e3,
                spawnDelay: 1e5,
                weightM: .45,
                speed: .00115,
                turnSpeed: .0025,
                scale: 94,
                viewRange: 1440,
                chargePlayer: !0,
                drop: ["food", 800],
                minSpawnRange: .85,
                maxSpawnRange: .9
            }];


            // SPAWN AI:
            this.spawn = function(x, y, dir, index) {
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
            this.init = function(x, y, dir, index, data) {
                this.x = x;
                this.y = y;
                this.startX = data.fixedSpawn ? x : null;
                this.startY = data.fixedSpawn ? y : null;
                this.xVel = 0;
                this.yVel = 0;
                this.zIndex = 0;
                this.dir = dir;
                this.dirPlus = 0;
                this.showName = 'aaa';
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
                            tmpRatio -= delta / (this.animSpeed * (1 - config.hitReturnRatio));
                            this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.max(0, tmpRatio));
                        }
                    }
                }
            };

            // ANIMATION:
            this.startAnim = function() {
                this.animTime = this.animSpeed = 600;
                this.targetAngle = Math.PI * 0.8;
                tmpRatio = 0;
                animIndex = 0;
            };

        };

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
            this.skinIndex = 0;
            this.latestTail = 0;
            this.oldTailIndex = 0;
            this.tailIndex = 0;
            this.hitTime = 0;
            this.lastHit = 0;
            this.showName = 'NOOO';
            this.tails = {};
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
            this.skinRot = 0;
            this.moveTime = 0;
            this.lastPing = 0;
            this.iconIndex = 0;
            this.skinColor = 0;
            this.dist2 = 0;
            this.aim2 = 0;
            this.maxSpeed = 1;
            this.chat = {
                message: null,
                count: 0
            };
            this.circle = false;
            this.cAngle = 0;
            // SPAWN:
            this.spawn = function(moofoll) {
                this.attacked = false;
                this.timeDamaged = 0;
                this.timeHealed = 0;
                this.pinge = 0;
                this.millPlace = 'NOOO';
                this.lastshamecount = 0;
                this.death = false;
                this.spinDir = 0;
                this.sync = false;
                this.antiBull = 0;
                this.bullTimer = 0;
                this.poisonTimer = 0;
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
                this.inTrap = false;
                this.canEmpAnti = false;
                this.empAnti = false;
                this.soldierAnti = false;
                this.poisonTick = 0;
                this.bullTick = 0;
                this.setPoisonTick = false;
                this.setBullTick = false;
                this.antiTimer = 2;
            };

            // RESET MOVE DIR:
            this.resetMoveDir = function() {
                this.moveDir = undefined;
            };

            // RESET RESOURCES:
            this.resetResources = function(moofoll) {
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
            this.setData = function(data) {
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

            // UPDATE POISON TICK:
            this.updateTimer = function() {

                this.bullTimer -= 1;
                if (this.bullTimer <= 0) {
                    this.setBullTick = false;
                    this.bullTick = game.tick - 1;
                    this.bullTimer = config.serverUpdateRate;
                }
                this.poisonTimer -= 1;
                if (this.poisonTimer <= 0) {
                    this.setPoisonTick = false;
                    this.poisonTick = game.tick - 1;
                    this.poisonTimer = config.serverUpdateRate;
                }

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
                            tmpRatio -= delta / (this.animSpeed * (1 - config.hitReturnRatio));
                            this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.max(0, tmpRatio));
                        }
                    }
                }
            };

            // GATHER ANIMATION:
            this.startAnim = function(didHit, index) {
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
                        let timeSinceHit = game.tick - this.hitTime;
                        this.hitTime = 0;
                        if (timeSinceHit < 2) {
                            this.shameCount++;
                        } else {
                            this.shameCount = Math.max(0, this.shameCount - 2);
                        }
                    }
                } else if (this.oldHealth > this.health) {
                    this.hitTime = game.tick;
                    this.lastHit = Date.now();
                }
            };
            this.addShameTimer = function() {
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
            this.isTeam = function(tmpObj) {
                return (this == tmpObj || (this.team && this.team == tmpObj.team));
            };

            // FOR THE PLAYER:
            this.findAllianceBySid = function(sid) {
                return this.team ? alliancePlayers.find((THIS) => THIS === sid) : null;
            };
            this.checkCanInsta = function(nobull) {
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
            this.manageReload = function() {
                if (this.shooting[53]) {
                    this.shooting[53] = 0;
                    this.reloads[53] = (2500 - game.tickRate);
                } else {
                    if (this.reloads[53] > 0) {
                        this.reloads[53] = Math.max(0, this.reloads[53] - game.tickRate);
                    }
                }

                // PREPLACER
                if (this.reloads[this.weaponIndex] <= 1000/9) {
                    // place(2, getAttackDir());
                    let index = this.weaponIndex;
                    let nearObja = liztobj.filter((e) => (e.active || e.alive) && e.health < e.maxHealth && e.group !== undefined && UTILS.getDist(e, player, 0, 2) <= (items.weapons[player.weaponIndex].range + e.scale));
                    for(let i = 0; i < nearObja.length; i++) {
                        let aaa = nearObja[i];

                        let val = items.weapons[index].dmg * (config.weaponVariants[tmpObj[(index < 9 ? "prima" : "seconda") + "ryVariant"]].val) * (items.weapons[index].sDmg || 1) * 3.3;
                        let valaa = items.weapons[index].dmg * (config.weaponVariants[tmpObj[(index < 9 ? "prima" : "seconda") + "ryVariant"]].val) * (items.weapons[index].sDmg || 1);
                        if(aaa.health - (valaa) <= 0 && near.length) {
                            place(near.dist2<((near.scale * 1.8) + 50)?4:2, caf(aaa, player) + Math.PI)
                            console.log("preplaced");
                        }
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
                            // Math.max(0, this.reloads[this.weaponIndex] - game.tickRate)
                            this.reloads[this.weaponIndex] = Math.max(0, this.reloads[this.weaponIndex] - 110);
                            if (this == player) {
                                if (getEl("weaponGrind").checked) {
                                    for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
                                        checkPlace(player.getItemType(22), i);
                                    }
                                }
                            }
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
            this.addDamageThreat = function(_) {
                let sec = false;
                let prim = false;
                let primary = {
                    weapon: this.primaryIndex,
                    variant: this.primaryVariant
                };
                primary.dmg = primary.weapon == undefined ? 45 : items.weapons[primary.weapon].dmg;
                let secondary = {
                    weapon: this.secondaryIndex,
                    variant: this.secondaryVariant
                };
                secondary.dmg = secondary.weapon == undefined ? 50 : items.weapons[secondary.weapon].Pdmg;
                let bull = 1.5;
                let pV = primary.variant != undefined ? o.weaponVariants[primary.variant].val : 1.18;
                let sV = secondary.variant != undefined ? [9, 12, 13, 15].includes(secondary.weapon) ? 1 : o.weaponVariants[secondary.variant].val : 1.18;
                //this.reloads[primary.weapon] == 0

                if (getEl("betadamagethreat").checked) {
                    if (primary.weapon == undefined || 'range' in items.weapons[primary.weapon] &&
                        this.dist2 <= items.weapons[primary.weapon].range + _.scale * 1.8 + 30 && this.reloads[primary.weapon] == 0) {
                        this.damageThreat += primary.dmg * pV * bull;
                        prim = true;
                        if (secondary.weapon == undefined || 'range' in items.weapons[secondary.weapon] &&
                            this.dist2 <= items.weapons[secondary.weapon].range + _.scale * 1.8 + 30 && this.reloads[secondary.weapon] == 0 ||
                            !('range' in items.weapons[secondary.weapon]) && this.reloads[secondary.weapon] == 0) {
                            this.damageThreat += secondary.dmg * sV;
                            sec = true;
                        }
                    }
                } else {
                    if (primary.weapon == undefined ? true : this.reloads[primary.weapon] == 0) {
                        this.damageThreat += primary.dmg * pV * bull;
                    }

                    if (secondary.weapon == undefined ? true : this.reloads[secondary.weapon] == 0) {
                        this.damageThreat += secondary.dmg * sV;
                    }
                }
                if (this.reloads[53] <= game.tickRate) {
                    this.damageThreat += 25;
                }
                this.damageThreat *= _.skinIndex == 6 ? 0.75 : 1;
                if (!this.isTeam(_)) {
                    if (this.dist2 <= 300) {
                        //console.log(`${this.damageThreat} Secondary: ${sec} Primary: ${prim}`);
                        _.damageThreat += this.damageThreat;
                    }
                }
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

    function buyEquip(id, index) {
        let nID = player.skins[6] ? 6 : 0;
        if (player.alive && inGame) {
            if (index == 0) {
                if (player.skins[id]) {
                    if (player.latestSkin != id) {
                        packet("c", 0, id, 0);
                    }
                } else {
                    if (configs.autoBuyEquip) {
                        let find = findID(hats, id);
                        if (find) {
                            if (player.points >= find.price) {
                                packet("c", 1, id, 0);
                                packet("c", 0, id, 0);
                            } else {
                                if (player.latestSkin != nID) {
                                    packet("c", 0, nID, 0);
                                }
                            }
                        } else {
                            if (player.latestSkin != nID) {
                                packet("c", 0, nID, 0);
                            }
                        }
                    } else {
                        if (player.latestSkin != nID) {
                            packet("c", 0, nID, 0);
                        }
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
                    if (configs.autoBuyEquip) {
                        let find = findID(accessories, id);
                        if (find) {
                            if (player.points >= find.price) {
                                packet("c", 1, id, 1);
                                packet("c", 0, id, 1);
                            } else {
                                if (player.latestTail != 0) {
                                    packet("c", 0, 0, 1);
                                }
                            }
                        } else {
                            if (player.latestTail != 0) {
                                packet("c", 0, 0, 1);
                            }
                        }
                    } else {
                        if (player.latestTail != 0) {
                            packet("c", 0, 0, 1);
                        }
                    }
                }
            }
        }
    }

    function selectToBuild(index, wpn) {
        packet("G", index, wpn);
    }

    function selectWeapon(index, isPlace) {
        if (!isPlace) {
            player.weaponCode = index;
        }
        packet("G", index, 1);
    }

    function sendAutoGather() {
        packet("K", 1, 1);
    }

    function sendAtck(id, angle) {
        packet("d", id, angle, 1);
    }

    // PLACER:
    function place(id, rad, rmd) {
        try {
            if (id == undefined) return;
            let item = items.list[player.items[id]];
            let tmpS = player.scale + item.scale + (item.placeOffset || 0);
            let tmpX = player.x2 + tmpS * Math.cos(rad);
            let tmpY = player.y2 + tmpS * Math.sin(rad);
            if ((player.alive && inGame && player.itemCounts[item.group.id] == undefined ? true : player.itemCounts[item.group.id] < (config.isSandbox ? 299 : item.group.limit ? item.group.limit : 99))) {
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
                    }, 1)
                }
            }
        } catch (e) {}
    }

    function checkPlace(id, rad) {
        try {
            if (id == undefined) return;
            let item = items.list[player.items[id]];
            let tmpS = player.scale + item.scale + (item.placeOffset || 0);
            let tmpX = player.x2 + tmpS * Math.cos(rad);
            let tmpY = player.y2 + tmpS * Math.sin(rad);
            if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false, player)) {
                place(id, rad, 1);
            }
        } catch (e) {}
    }

    // UPDATE HEALTH:
    function applCxC(value) { // just value calculator
        const skin = player.skinIndex;
        if (skin === 45 || skin === 56) return 0;
        const item = player.items[0];
        switch (item) {
            case 0:
                if (value < -80) return 5;
                if (value < -60) return 4;
                if (value < -40) return 3;
                if (value < -20) return 2;
                return 1;
            case 1:
                if (value < -80) return 3;
                if (value < -40) return 2;
                return 1;
            case 2:
                if (value < -90) return 4;
                if (value < -60) return 3;
                if (value < -30) return 2;
                return 1;
            default:
                return 4;
        }
    }
    // Ticks:
    // Aditional:
    function oneframe() {
        my.autoAim = true;
        buyEquip(19, 1);
        game.tickBase(() => {
            if (player.weapons[1] == 15) {
                my.revAim = true;
                buyEquip(20, 0); // Samurai Armor for musket fast reload
            }
            selectWeapon(player.weapons[[15].includes(player.weapons[1]) ? 1 : 0]);
            buyEquip(53, 0);
            buyEquip(19, 1);
            if ([15].includes(player.weapons[1])) {
                sendAutoGather();
            }
            game.tickBase(() => {
                my.revAim = false;
                selectWeapon(player.weapons[0]);
                buyEquip(7, 0);
                buyEquip(19, 1);
                if (![15].includes(player.weapons[1])) {
                    sendAutoGather();
                }
                game.tickBase(() => {
                    sendAutoGather();
                    my.autoAim = false;
                }, 3);
            }, 1);
        }, 1);
    };
    // HEALING:
    function soldierMult() {
        return player.latestSkin == 6 ? 0.75 : 1;
    }
    function getAttacker(damaged) {
        let attackers = enemy.filter(tmp => {
            //let damages = new Damages(items);
            //let dmg = damages.weapons[tmp.weaponIndex];
            //let by = tmp.weaponIndex < 9 ? [dmg[0], dmg[1], dmg[2], dmg[3]] : [dmg[0], dmg[1]];
            let rule = {
                //one: tmp.dist2 <= 300,
                //two: by.includes(damaged),
                three: tmp.attacked
            }
            return /*rule.one && rule.two && */rule.three;
        });
        return attackers;
    }
    function antirev() {
        if (tmpObj.isPlayer){
            for (let i = 0; i < healthBased(); i++) {
                place(0, getAttackDir());
                if (player.health == 55 && player.shameCount < 6 && player.skinIndex == 6) {
                    place(0, getAttackDir());
                } else if (player.health == 40 && player.shameCount < 6 && player.skinIndex != 6){
                    place(0, getAttackDir());
                } else if (player.health == 43.75 && player.shameCount < 5 && player.skinIndex == 6){
                    place(0, getAttackDir());
                    setTimeout(()=>{
                        place(0, getAttackDir());
                    },5)
                } else if(player.health == 25 && player.shameCount < 4 && player.skinIndex == 6){
                    place(0, getAttackDir());
                    setTimeout(()=>{
                        place(0, getAttackDir());
                    },5)
                } else if (player.health == 58.75 && player.shameCount < 6 && player.skinIndex == 6){
                    place(0, getAttackDir());
                    setTimeout(()=>{
                        place(0, getAttackDir());
                    },5)
                } else if (player.health == 45 && player.shameCount < 6 && player.skinIndex != 6){
                    place(0, getAttackDir());
                    setTimeout(()=>{
                        place(0, getAttackDir());
                    },5)
                }
                if (player.shameCount < 6) {
                    setTimeout(()=>{
                        place(0, getAttackDir());
                    },30)
                }
            }
        }
    }

    function healer(extra = 0) {
        if (extra == 0) {
            for (let i = 0; i < healthBased(); i++) {
                place(0, getAttackDir());
            }
        } else {
            for (let i = 0; i < healthBased() + extra; i++) {
                place(0, getAttackDir());
            }
        }
    }
    // ADVANCED:
    // ADVANCED:
    function applCxC(value) {
        if (player.skinIndex != 45 && player.skinIndex != 56) {
            if (0 == player.items[0]) {
                if (value < -80) {
                    return 5;
                } else if (value < -60) {
                    return 4;
                } else if (value < -40) {
                    return 3;
                } else if (value < -20) {
                    return 2;
                } else {
                    return 1;
                }
            } else if (1 == player.items[0]) {
                if (value < -80) {
                    return 3;
                } else if (value < -40) {
                    return 2;
                } else {
                    return 1;
                }
            } else if (2 == player.items[0]) {
                if (value < -90) {
                    return 4;
                } else if (value < -60) {
                    return 3;
                } else if (value < -30) {
                    return 2;
                } else {
                    return 1;
                }
            } else {
                return 4;
            }
        } else {
            return 0;
        }
    }
    function healthBased() {
        if (player.health == 100)
            return 0;
        if (player.skinIndex != 45 && player.skinIndex != 56) {
            return Math.ceil((100 - player.health) / items.list[player.items[0]].healing);
        }
        return 0;
    }

    function calcDmg(value) {
        return value * player.skinIndex == 6 ? 0.75 : 1;
    }
    function getDamageThreat(tmpObj) {
        tmpObj.instaThreat = 0;
        if (isTeam(tmpObj)) {
            let primary = {
                weapon: tmpObj.primaryIndex,
                variant: tmpObj.primaryVariant,
                dmg: tmpObj.primaryIndex == undefined ? 45 : items.weapons[tmpObj.primaryIndex].dmg,
            };
            let secondary = {
                weapon: tmpObj.secondaryIndex,
                variant: tmpObj.secondaryVariant,
                dmg: tmpObj.secondaryIndex == undefined ? 50 : items.weapons[tmpObj.secondaryIndex].Pdmg,
            };
            let bull = tmpObj.skinIndex == 7 ? 1.5 : 1;
            let pV = primary.variant != undefined ? config.weaponVariants[primary.variant].val : 1.18;
            if (primary.weapon != undefined && tmpObj.reloads[primary.weapon] == 0) {
                tmpObj.instaThreat += primary.dmg * pV * bull;
            }
            if (secondary.weapon != undefined && tmpObj.reloads[secondary.weapon] == 0) {
                tmpObj.instaThreat += secondary.dmg;
            }
            if (tmpObj.reloads[53] === 0) {
                tmpObj.instaThreat += 25;
            }
            tmpObj.instaThreat *= player.skinIndex == 6 ? 0.75 : 1;
        }
    }

    function renderAllBlood(context, f, d) {
        let now = Date.now();
        let fadeTime = 2000;

        for (let i = bloodEffects.length - 1; i >= 0; i--) {
            let effect = bloodEffects[i];
            let age = now - effect.time;

            if (age > fadeTime) {
                bloodEffects.splice(i, 1);
                continue;
            }

            let fadeAlpha = 1 - (age / fadeTime);

            effect.particles.forEach(particle => {
                context.beginPath();
                context.arc(
                    effect.x + particle.x - f,
                    effect.y + particle.y - d,
                    particle.size,
                    0,
                    Math.PI * 2
                );
                context.fillStyle = `rgba(${particle.redShade}, 0, 0, ${particle.alpha * fadeAlpha})`;
                context.fill();
            });
        }
    }

    // UPDATE HEALTH:
    let bloodEffects = [];

    function antiSyncHealing(timearg) {
        my.antiSync = true;
        player.chat.message = `Blocked Threat [ 2 ] ${window.pingTime}ms`;
        player.chat.count = 1000;
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
    function biomeGear(mover, returns) {
        if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
            if (returns) return 31;
            buyEquip(31, 0);
        } else {
            let hat = near.dist2 >= 680 && near.dist2 < 720 ? 22 : 6;
            if (player.y2 <= config.snowBiomeTop) {
                if (returns) return mover && player.moveDir == undefined ? hat : 6;
                buyEquip(mover && player.moveDir == undefined ? hat : 6, 0);
            } else {
                if (returns) return mover && player.moveDir == undefined ? hat : 6;
                buyEquip(mover && player.moveDir == undefined ? hat : 6, 0);
            }
        }

        if (returns) return 0;
    }
    function woah(mover) {
        buyEquip(mover && player.moveDir == undefined ? 0 : tails, 1);
    }
    let advHeal = [];
    class Traps {
        constructor(UTILS, items) {
            this.dist = 0;
            this.aim = 0;
            this.breakshit =  false;
            this.inTrap = false;
            this.replaced = false;
            this.antiTrapped = false;
            this.info = {};
            this.notFast = function() {
                return player.weapons[1] == 10 && ((this.info.health > items.weapons[player.weapons[0]].dmg) || player.weapons[0] == 5);
            }
            this.testCanPlace = function(id, first = -(Math.PI / 2), repeat = (Math.PI / 2), plus = (Math.PI / 18), radian, replacer, yaboi) {
                try {
                    let item = items.list[player.items[id]];
                    let tmpS = player.scale + item.scale + (item.placeOffset || 0);
                    let counts = {
                        attempts: 0,
                        placed: 0
                    };
                    let tmpObjects = [];
                    gameObjects.forEach((p) => {
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
                                sM = sM || 1;
                                return this.scale * ((this.isItem || this.type == 2 || this.type == 3 || this.type == 4)
                                                     ? 1 : (0.6 * sM)) * (ig ? 1 : this.colDiv);
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
                        if (item.id != 19 && tmpY >= config.mapScale / 2 - config.riverWidth / 2 && tmpY <= config.mapScale / 2 + config.riverWidth / 2) continue;
                        if ((!replacer && yaboi) || useWasd) {
                            if (useWasd ? false : yaboi.inTrap) {
                                if (UTILS.getAngleDist(near.aim2 + Math.PI, relAim + Math.PI) <= Math.PI) {
                                    place(2, relAim, 1);
                                } else {
                                    player.items[4] == 15 && place(4, relAim, 1);
                                }
                            } else {
                                if (UTILS.getAngleDist(near.aim2, relAim) <= config.gatherAngle / 1.5) {
                                    place(2, relAim, 1);
                                } else {
                                    player.items[4] == 15 && place(4, relAim, 1);
                                }
                            }
                        } else {
                            place(id, relAim, 1);
                        }
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
                        if (UTILS.getAngleDist(near.aim2, relAim) <= 1) {
                            counts.placed++;
                        }
                    }
                    if (counts.placed > 0 && replacer && item.dmg) {
                        if (near.dist2 <= items.weapons[player.weapons[0]].range + (player.scale * 1.8) && configs.spikeTick) {
                            instaC.canSpikeTick = true;
                        }
                    }
                } catch (err) {
                }
            };

            this.checkSpikeTick = function() {
                try {
                    if (![3, 4, 5].includes(near.primaryIndex)) return false;
                    if ((getEl("safeAntiSpikeTick").checked || my.autoPush) ? false : near.primaryIndex == undefined ? true : (near.reloads[near.primaryIndex] > game.tickRate)) return false;
                    // more range for safe. also testing near.primaryIndex || 5
                    if (near.dist2 <= items.weapons[near.primaryIndex || 5].range + (near.scale * 1.8)) {
                        let item = items.list[9];
                        let tmpS = near.scale + item.scale + (item.placeOffset || 0);
                        let danger = 0;
                        let counts = {
                            attempts: 0,
                            block: `unblocked`
                        };
                        for (let i = -1; i <= 1; i += 1 / 10) {
                            counts.attempts++;
                            let relAim = UTILS.getDirect(player, near, 2, 2) + i;
                            let tmpX = near.x2 + tmpS * Math.cos(relAim);
                            let tmpY = near.y2 + tmpS * Math.sin(relAim);
                            let cantPlace = gameObjects.find((tmp) => tmp.active && UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) < item.scale + (tmp.blocker ? tmp.blocker : tmp.getScale(0.6, tmp.isItem)));
                            if (cantPlace) continue;
                            if (tmpY >= config.mapScale / 2 - config.riverWidth / 2 && tmpY <= config.mapScale / 2 + config.riverWidth / 2) continue;
                            danger++;
                            counts.block = `blocked`;
                            break;
                        }
                        if (danger) {
                            my.anti0Tick = 1;
                            player.chat.count = 100000;
                            return true;
                        }
                    }
                } catch (err) {
                    return null;
                }
                return false;
            }
            this.protect = function (aim) {
                if (!configs.antiTrap) return;
                this.testCanPlace(2, -(Math.PI / 2), Math.PI / 2, Math.PI / 18, aim + Math.PI);
                this.antiTrapped = true;
            };

            function toRadian(a){a=(a%360)*Math.PI/180;return a<0?2*Math.PI+a:a}
            function getBlockedAngles(type){
                let arr=[],item=items.list[type<items.list.length?type:player.items[2]],offset=player.scale+item.scale+(item.placeOffset||0);
                let buildings=gameObjects.filter(obj=>fgdo(player,obj)<250&&obj.active);
                for(let i=0;i<buildings.length;i++){
                    let b=buildings[i],scale=b.isItem?b.scale:((b.scale!=80&&b.scale!=85&&b.scale!=90||b.type==1)?b.scale*0.4:b.scale);
                    let dist=item.scale+scale+1,dPTB=fgdo(player,b),cosLaw;
                    if(dPTB>dist+offset){
                        cosLaw=Math.asin((dist*Math.sin(Math.acos(((offset**2+dist**2)-dPTB**2)/(2*dist*offset))))/dPTB);
                    }else{
                        cosLaw=Math.acos(((offset**2+dPTB**2)-dist**2)/(2*dPTB*offset));
                    }
                    let aPTB=Math.atan2(b.y-player.y2,b.x-player.x2);
                    if(!isNaN(cosLaw))arr.push([aPTB-cosLaw,aPTB+cosLaw,b]);
                }
                return arr;
            }
            function angleInBetween(angle,a1,a2){
                let diff=((a2-a1+2*Math.PI)%(2*Math.PI));
                let rel=((angle-a1+2*Math.PI)%(2*Math.PI));
                return rel<=diff;
            }
            function gradeAngles(type,step=Math.PI/180){
                let blocked=getBlockedAngles(type),grades=[];
                for(let a=0;a<2*Math.PI;a+=step){
                    let blockedBy=blocked.find(([start,end])=>angleInBetween(a,start,end));
                    grades.push({angle:a,blockedBy:blockedBy?blockedBy[2]:null});
                }
                return grades;
            }
            const placedSpikePositions = new Set();
            this.autoPlace=function(){
                if(!enemy.length||!(configs.AutoMatePlace||configs.autoPlace)||instaC.ticking)return;
                const nearDistance=UTILS.getDist(player,near,0,2);
                if(nearDistance>(typeof secPacket!=='undefined'?300:400))return;
                const nearTrap=(closeObjects.length?closeObjects:gameObjects)
                .filter(obj=>obj.trap&&obj.active&&obj.isTeamObject(player)&&UTILS.getDist(obj,near,0,2)<=near.scale+obj.getScale()+5)
                .sort((a,b)=>UTILS.getDist(a,near,0,2)-UTILS.getDist(b,near,0,2))[0];
                let didTrap=false;
                function predictEnemy(e){return{x:e.x+e.xVel*0.5,y:e.y+e.yVel*0.5}};
                if(nearTrap){
                    if(nearDistance<=200){
                        this.testCanPlace(4,0,Math.PI*2,Math.PI/12,near.aim2,0,{inTrap:true});
                        didTrap=true;
                    }else if(player.items[4]===15){
                        this.testCanPlace(4,0,Math.PI*2,Math.PI/12,near.aim2);
                        didTrap=true;
                    }
                    if(didTrap&&typeof secPacket!=='undefined'&&near.dist2<=160){
                        const trapX=nearTrap.x,trapY=nearTrap.y,circleRadius=102,numPositions=72;
                        for(let i=0;i<numPositions;i++){
                            const angle=2*Math.PI*i/numPositions,offsetX=trapX+circleRadius*Math.cos(angle),offsetY=trapY+circleRadius*Math.sin(angle),pos=[offsetX,offsetY];
                            let distToPlayer=Math.hypot(pos[0]-player.x2,pos[1]-player.y2),predictedEnemy=predictEnemy(near),predictedDist=Math.hypot(predictedEnemy.x-pos[0],predictedEnemy.y-pos[1]);
                            if(!placedSpikePositions.has(JSON.stringify(pos))&&distToPlayer<=87&&predictedDist<=50){
                                checkPlace(2,Math.atan2(pos[1]-player.y2,pos[0]-player.x2));
                                placedSpikePositions.add(JSON.stringify(pos));
                            }
                        }
                    }
                }else if(player.items[4]===15){
                    this.testCanPlace(4,0,Math.PI*2,Math.PI/12,near.aim2);
                    didTrap=true;
                }
                if(!didTrap){
                    let angleGrades=gradeAngles(2,Math.PI/36),best=angleGrades.find(g=>!g.blockedBy);
                    if(best)checkPlace(2,best.angle);
                }
                if(typeof secPacket!=='undefined'&&secPacket<=90){
                    const autoPlaceTick=Math.max(1,parseInt())||1;
                    if(game.tick%autoPlaceTick!==0||!closeObjects.length)return;
                    let randomDir=Math.random()*Math.PI*1.5;
                    let tryTicked=[3,4,5].includes(near.primaryIndex);
                    const id=nearTrap||near.dist2<=items.weapons[player.weapons[0]].range+near.scale*1.8?2:4;
                    this.testCanPlace(id,-(Math.PI*1.5),randomDir,Math.PI/48,near.aim2,tryTicked&&id===2);
                }
            };
            function findAllianceBySid(sid) {
                return player.team ? alliancePlayers.find((THIS) => THIS === sid) : null;
            }
            this.replacer = function (findObj) {
                if (!findObj || !configs.autoReplace) return;
                if (!inGame) return;
                if (this.antiTrapped) return;
                game.tickBase(() => {
                    let objAim = UTILS.getDirect(findObj, player, 0, 2);
                    let objDst = UTILS.getDist(findObj, player, 0, 2);
                    let type = null;
                    if (findObj.name === "pit trap") type = 4;
                    if (["spikes", "greater spikes", "spinning spikes", "poison spikes"].includes(findObj.name)) type = 2;
                    if (getEl("weaponGrind").checked && objDst <= items.weapons[player.weapons[0]].range + player.scale) return;
                    if (objDst <= 400 && near.dist2 <= 400) {
                        let danger = this.checkSpikeTick();
                        if (near.dist2 <= items.weapons[near.weapons[0]].range + near.scale * 1.8 && near.alive) {
                            if (!danger) {
                                //this.testCanPlace(2, -(Math.PI / 2), (Math.PI / 2), (Math.PI / 18), objAim, 1);
                                if (!near.inTrap) {
                                    this.testCanPlace(type, 0, Math.PI * 2, Math.PI / 24, objAim, 1);
                                } else {
                                    if (player.primaryIndex != 7) {
                                        if (player.reloads[53] == 0) {
                                            this.testCanPlace(2, 0, Math.PI * 2, Math.PI / 24, objAim, 1); //spiketick
                                            if (instaC.canSpikeTick === false) instaC.canSpikeTick = true;
                                        } else {
                                            this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 24, objAim, 1); //cant spike tick yet like replace trap
                                        }
                                    } else {
                                        if (UTILS.getDist(findObj, near, 0, 2) > 70 && UTILS.getDist(findObj, near, 0, 2) <= 150) {
                                            if (findObj.owner.sid === player.sid) {
                                                if (type === 4) {
                                                    console.log(true);
                                                    this.testCanPlace(2, 0, Math.PI * 2, Math.PI / 24, objAim, 1);
                                                }
                                            }
                                        } else {
                                            console.log(false);
                                            this.testCanPlace(type, 0, Math.PI * 2, Math.PI / 24, objAim, 1); //replace trap, or replace spike from autopush if enemy broke
                                        }
                                    }
                                }
                            } else {
                                //if im in trap
                                this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 24, objAim, 1);
                            }
                            this.replaced = true;
                        }
                    }
                }, 1);
            };
        }
    }
    let breakObjs = [];
    function bestAim(main, range, objs = liztobj) {
        const possibleTargets = objs.filter(obj => obj.active && obj.type === null && obj?.owner?.sid && obj.dist2 <= range + obj.scale);
        const startAim = main;
        let bestAim = startAim;
        let concatObj = [];
        let maxHitCount = -999;
        let defaultHitCount = 0;
        for (let i = -3; i < 3; i += 1) {
            const aimer = startAim + UTILS.toRad(i * 10);
            const hitObjs = [];
            let hitCount = 0;
            for (let j = 0; j < possibleTargets.length; j++) {
                const target = possibleTargets[j];
                if (UTILS.getAngleDist(caf(player, target), aimer) <= config.gatherAngle) {
                    hitObjs.push(target);
                    hitCount += target?.owner?.sid === player.sid ? -0.5 : 1;
                }
            }
            if (i == 0) {
                defaultHitCount = hitCount;
            }
            if (hitCount > maxHitCount) {
                maxHitCount = hitCount;
                bestAim = aimer;
                concatObj = hitObjs;
            }
        }
        breakObjs.push(concatObj);
        breakObjs = breakObjs.flat();
        if (defaultHitCount == maxHitCount) {
            return main;
        } else {
            return bestAim;
        }
    }
    const decayRate = Math.pow(0.993, 111.11112);
    function getDecelDist(x, t) {
        if (isNaN(x) || x == Infinity) {
            return null;
        }
        let value = x;
        while (value >= 0.001) {
            value *= decayRate;
            x += value;
        }
        return x;
    }
    function checkStoppedMoving(tmp) {
        let fullDecelPos = {
            x: tmp.oldPos.x2 + tmp.oldXVel * decayRate,
            y: tmp.oldPos.y2 + tmp.oldYVel * decayRate
        };
        let decelPos = {
            x: tmp.oldPos.x2 + tmp.oldXVel * decayRate,
            y: tmp.oldPos.y2 + tmp.oldYVel * decayRate
        };
        if (Math.abs(tmp.x2 - fullDecelPos.x) <= 2 && Math.abs(tmp.y2 - fullDecelPos.y) <= 2) {
            return [true, "fullDecel", {
                x: tmp.x2 + tmp.xVel * decayRate,
                y: tmp.y2 + tmp.yVel * decayRate
            }];
        } else if (Math.abs(tmp.x2 - fullDecelPos.x) <= 2) {
            return [true, "xDecel", {
                x: tmp.x2 + tmp.xVel * decayRate,
                y: tmp.y2 + (tmp.y2 - tmp.oldPos.y2)
            }];
        } else if (Math.abs(tmp.y2 - fullDecelPos.y) <= 2) {
            return [true, "yDecel", {
                x: tmp.x2 + (tmp.x2 - tmp.oldPos.x2),
                y: tmp.y2 + tmp.yVel * decayRate
            }];
        }
    }
    function getMoveSpeed(ticks, tmp, dir) {
        tmp.newXVel = tmp.xVel;
        tmp.newYVel = tmp.yVel;
        let totalXVel = 0;
        let totalYVel = 0;
        let decel = false;
        if (tmp?.velocity != undefined && tmp.sid != player.sid) {
            decel = cdf(tmp, tmp.velocity?.accel) > cdf(tmp, tmp.velocity?.decel) && dAng(tmp.movDir, tmp.pmovDir) <= 0.3;
        }
        if (tmp.sid == player.sid) {
            if (clientMoveDir == undefined) {
                decel = true;
            }
        }
        for (let i = 0; i < ticks; i++) {
            tmp.newXVel = tmp.newXVel * Math.pow(0.993, game.tickSpeed) + (decel ? 0 : Math.cos(dir) * 0.0016 * tmp.maxSpeed * game.tickRate * game.tickSpeed);
            tmp.newYVel = tmp.newYVel * Math.pow(0.993, game.tickSpeed) + (decel ? 0 : Math.sin(dir) * 0.0016 * tmp.maxSpeed * game.tickRate * game.tickSpeed);
            totalXVel += tmp.newXVel;
            totalYVel += tmp.newYVel;
        }
        return {
            x: tmp.newXVel,
            y: tmp.newYVel
        };
    }
    function getMovePos(ticksToMove, tmp, angle) {
        if (typeof angle != "number" || typeof ticksToMove != "number") {
            console.error("what are you doing faggot");
        }
        tmp.update(1);
        return {
            x: tmp.x2 + getMoveSpeed(ticksToMove, tmp, angle).x,
            y: tmp.y2 + getMoveSpeed(ticksToMove, tmp, angle).y
        };
    }
    function checkIsTeam(sid) {
        return alliancePlayers.find(THIS => THIS === sid) != undefined;
    }
    let moveTicks = 0;
    let didStop = {
        time: Date.now(),
        type: null
    };
    var stopHit = 0;
    function objDmgPot() {
        for (let i = 0; i < liztobj.length; i++) {
            liztobj[i].dmgpot = 0;
        }
        for (let x = 0; x < players.length; x++) {
            const _ = players[x];
            if (_.sid == player.sid) {
                continue;
            }
            _.bDmg = _?.secondaryIndex === 10 && _.reloads[_.secondaryIndex] === 0 ? {
                dmg: sortWeaponVariant(_.secondaryVariant) * 75 * 3.3,
                wep: 10
            } : _?.primary && _.reloads[_.primaryIndex] === 0 ? {
                dmg: _?.primary?.dmg * 3.3 * sortWeaponVariant(_.primaryVariant),
                wep: _.primaryIndex
            } : 0;
            if (_.bDmg === 0) {
                continue;
            }
            for (let i = 0; i < liztobj.length; i++) {
                const object = liztobj[i];
                object.assumeBreak = false;
                if (object.type !== null || !object?.owner?.sid) {
                    continue;
                }
                const d_o = UTILS.getDist(_, object, 2, 0) <= items.weapons[_.bDmg.wep].range + object.scale;
                if (!d_o) {
                    continue;
                }
                object.dmgpot = _.bDmg.dmg;
                if (_.antiBull) {
                    object.likelyDmg = _.bDmg.dmg;
                }

                if (object.likelyDmg >= object.health) {
                    breakObjs.push(object);
                }
                if (object.dmgpot >= object.health ) {
                    object.assumeBreak = true;

                    continue;
                }
            }
        }
    }
    function breakShit(angle, wep, variant, hat, force, type, o, t, dmg) {
        for (let i = 0; i < liztobj.length; i++) {
            const greg = liztobj[i];
            if (greg.type !== null || !greg?.owner?.sid || greg.dist2 > items.weapons[wep]?.range + greg.scale) {
                continue;
            }
            t = caf(player, liztobj[i]);
            if (UTILS.getAngleDist(t, angle) <= config.gatherAngle && greg.type === null) {
                dmg = items.weapons[wep].dmg * (wep === 10 ? 7.5 : 1) * (hat === 40 ? 3.3 : 1) * sortWeaponVariant(variant);
                const conditions = (wep < 9 ? player.reloads[player.weapons[0]] : player.reloads[player.weapons[1]]) === 0 && dmg >= greg.health;
                if (conditions) {
                    greg.assumeBreak = true;
                    greg.manualBreak = true;
                    breakObjs.push(greg);
                } else if (force) {
                    breakObjs.push(greg);
                }
            }
        }
    }
    function calcNewVel(_, ang, set, docalc, time) {
        let tmpPlyr = _;
        let xVel = tmpPlyr.x3 - tmpPlyr.x2;
        let yVel = tmpPlyr.y3 - tmpPlyr.y2;
        let x2 = _.x3;
        let y2 = _.y3;
        if (typeof time !== "number") {
            time = game.tickRate;
        }
        let {
            sin,
            cos,
            pow,
            sqrt,
            max,
            round,
            min
        } = Math;

        if (!docalc) {
            if (_.sid == player.sid && ang !== 0 && !ang) {
                ang = getMoveDir();
            } else if (_.trapped) {
                ang = undefined;
            } else if (!ang && ang !== 0) {
                ang = _.movDir;
            }
        }

        let cosX = cos(ang);
        let sinY = sin(ang);
        let sqrtDis = sqrt(cosX * cosX + sinY * sinY);
        if (sqrtDis != 0) {
            cosX /= sqrtDis;
            sinY /= sqrtDis;
        }
        if (!set) {
            set = _;
        }
        let mult = set.maxSpeed;
        _.speedXD = 0;
        _.speedYD = 0;
        _.predY = 0;
        _.predX = 0;
        if (cosX) {
            _.speedXD += cosX * 0.0016 * mult * time;
        }
        if (sinY) {
            _.speedYD += sinY * 0.0016 * mult * time;
        }

        if (_.speedXD) {
            _.predX += _.speedXD * time;
        }
        if (_.speedYD) {
            _.predY += _.speedYD * time;
        }
        let velXD = xVel * pow(0.993, time);
        let velYD = yVel * pow(0.993, time);
        let velX = velXD + _.predX;
        let velY = velYD + _.predY;
        let accel = {
            x: x2 + velX,
            y: y2 + velY,
            type: "accel"
        };
        let decel = {
            x: x2 + velXD,
            y: y2 + velYD,
            type: "decel"
        };
        let current = {
            x: x2,
            y: y2,
            type: "current"
        };
        let nextVel = {
            x: velX,
            y: velY,
            type: "nextVel"
        };
        let real = accel;
        let vel = sqrt(velX * velX + velY * velY);
        let spd = mult;
        let

        boostxVel;
        let boostyVel;

        boostxVel = time * 1.5 * cos(ang);
        boostyVel = time * 1.5 * sin(ang);
        let boostCoords = {
            x: x2 + boostxVel,
            y: y2 + boostyVel
        };
        if (_?.velocity != undefined && _.sid != player.sid) {
            real = cdf(_, _.oldPos) == 0 || cdf(_, _.velocity?.accel) > cdf(_, _.velocity?.decel) && dAng(_.movDir, _.pmovDir) <= 0.3 || _.trapped ? decel : accel;
        }
        if (_.sid == player.sid) {
            if (getMoveDir() == undefined || clientMoveDir == null) {
                real = decel;
            } else {
                real = accel;
            }
        }
        function fulldecel(e, t, coords, e2, t2) {
            if (isNaN(e) || isNaN(t)) {
                return;
            }
            try {
                e2 = e * decayRate;
                t2 = t * decayRate;
                if (e != e2) {
                    e = e2;
                    coords.x += e;
                }
                if (t != t2) {
                    t = t2;
                    coords.y += t;
                }
                if (e == e2 && t == t2) {
                    return {
                        x: coords.x,
                        y: coords.y,
                        type: "full decel"
                    };
                } else {

                    return fulldecel(e, t, coords);
                }
            } catch (e) {}
        }
        let fullDecel = fulldecel(velX, velY, {
            x: x2 + velX,
            y: y2 + velY
        });
        let result = {
            accel: accel,
            decel: decel,
            boostCoords: boostCoords,
            boostVel: {
                x: boostxVel,
                y: boostyVel
            },
            nextVel: nextVel,
            real: real,
            current: current,
            fullDecel: fullDecel,
            xVel: velX,
            spd: mult,
            yVel: velY,
            vel: vel
        };
        return result;
    }
    function sortWeaponVariant(id) {
        switch (id) {
            case 0:
                return 1;
                break;
            case 1:
                return 1.1;
                break;
            case 2:
                return 1.18;
                break;
            case 3:
                return 1.18;
                break;
            default:
                return 1;
                break;
        }
    }
    let hatPredictTrap = false;
    function predictHatSwitch(id, mainHat = nearestEnemy.skinIndex) { // simple predict hat of main
        if (near.inTrap) {
            if (mainHat == 6 || mainHat == 22) {
                if (predictReload() && (mainHat != 6 || mainHat != 22)) {
                    hatPredictTrap = true;
                } else {
                    hatPredictTrap = false;
                }
            } else {
                hatPredictTrap = false;
            }
        }
    }
    function fulldecel(e, t, coords, e2, t2) {
        if (isNaN(e) || isNaN(t)) {
            return;
        }
        try {
            e2 = e * decayRate;
            t2 = t * decayRate;
            if (e != e2) {
                e = e2;
                coords.x += e;
            }
            if (t != t2) {
                t = t2;
                coords.y += t;
            }
            if (e == e2 && t == t2) {
                return {
                    x: coords.x,
                    y: coords.y,
                    type: "full decel"
                };
            } else {

                return fulldecel(e, t, coords);
            }
        } catch (e) {}
    }
    function calcAccel(_, ang, set, time) {
        if (!time || typeof time !== "number") {
            time = game.tickRate;
        }
        let {
            sin,
            cos,
            pow,
            sqrt
        } = Math;
        let cosX = cos(ang);
        let sinY = sin(ang);
        let sqrtDis = sqrt(cosX * cosX + sinY * sinY);
        if (sqrtDis != 0) {
            cosX /= sqrtDis;
            sinY /= sqrtDis;
        }
        if (!set) {
            set = _;
        }
        const decel = pow(0.993, time);
        const move = set.maxSpeed * 0.0016 * time * time;
        const xVel = _.xVel * decel + cosX * move;
        const yVel = _.yVel * decel + sinY * move;
        return {
            xVel: xVel,
            yVel: yVel,
            x2: (_.x2 ?? _.x) + xVel,
            y2: (_.y2 ?? _.y) + yVel
        };
    }
    function calcOTVel() {
        const _ = player;
        let time = game.tickRate;
        const newVel = calcAccel(_, near.aim3, {
            maxSpeed: 0.77
        }, time);
        let xVel = newVel.x2 - player.x2;
        let yVel = newVel.y2 - player.y2;
        let x2 = newVel.x2;
        let y2 = newVel.y2;
        let {
            sin,
            cos,
            pow
        } = Math;
        let cosX = cos(near.aim3);
        let sinY = sin(near.aim3);
        let mult = 1.056;
        _.speedXD = 0;
        _.speedYD = 0;
        _.predY = 0;
        _.predX = 0;
        if (cosX) {
            _.speedXD += cosX * 0.0016 * mult * time;
        }
        if (sinY) {
            _.speedYD += sinY * 0.0016 * mult * time;
        }
        if (_.speedXD) {
            _.predX += _.speedXD * time;
        }
        if (_.speedYD) {
            _.predY += _.speedYD * time;
        }
        let velXD = xVel * pow(0.993, time);
        let velYD = yVel * pow(0.993, time);
        let velX = velXD + _.predX;
        let velY = velYD + _.predY;
        return {
            x: x2 + velX,
            y: y2 + velY
        };
    }
    function getAngleDifference(angle1, angle2) {
        angle1 = angle1 % (Math.PI * 2);
        angle2 = angle2 % (Math.PI * 2);
        let diff = Math.abs(angle1 - angle2);
        if (diff > Math.PI) {
            diff = Math.PI * 2 - diff;
        }
        return diff;
    }
    let noMove = false;
    let onetick123modprov3asd = false;
    let noWep = false;
    function oneTick(insta, dontMove) {
        let moveAim = UTILS.getDirect(near, player, 3, 2);
        if (traps.in) {
            return;
        }
        player.chat.message = `Velocity Tick ${window.pingTime}ms`;
        player.chat.count = 1000;
        if (insta) {
            if (player.reloads[player.weapons[0]] == 0) {
                selectWeapon(10, 0, 1);
            }
            noMove = true;
            noZ = true;
            if (!dontMove) {
                packet("9", moveAim, 1, "onetick");
            }
            buyEquip(53, 0);
            my.autoAim = true;
            instaC.isTrue = true;
            realDir(2);
            game.tickBase(() => {
                onetick123modprov3asd = true;
                noZ = false;
                selectWeapon(5, 0, 1);
                noZ = true;
                noWep = true;
                buyEquip(7, 0);
                sendAutoGather();
                if (!dontMove) {
                    packet("9", moveAim, 1, "onetick");
                }
                game.tickBase(() => {
                    sendAutoGather();
                    noZ = false;
                    noWep = false;
                    my.autoAim = false;
                    onetick123modprov3asd = false;
                    instaC.isTrue = false;
                }, 1);
                game.tickBase(() => {
                    game.tickBase(() => {
                        noWep = false;
                        if (!dontMove) {
                            packet("9", undefined, 1, "onetick");
                        }
                    }, 1);
                    noMove = false;
                }, 1);
            }, 1);
        } else {
            noMove = true;
            packet("9", moveAim, 1, "onetick");
            instaC.isTrue = true;
            game.tickBase(() => {
                realDir(2);
                packet("9", moveAim, 1, "onetick");
                buyEquip(53, 0);
                my.autoAim = true;
                game.tickBase(() => {
                    selectWeapon(5);
                    buyEquip(7, 0);
                    sendAutoGather();
                    packet("9", moveAim, 1, "onetick");
                    game.tickBase(() => {
                        my.autoAim = false;
                        sendAutoGather();
                        instaC.isTrue = false;
                        game.tickBase(() => {
                            packet("9", undefined, 1, "onetick");
                        }, 1);
                        noMove = false;
                    }, 1);
                }, 1);
            }, 1);
        }
    }
    // Original saInsta function as a string
    let instaCode = `
                window.saInsta = function() {
                    sendChat("SaInsta - Test");
                    function usePrimaryWeapon() {
                        buyEquip(0, 1);
                        buyEquip(7, 0);
                        selectWeapon(player.weapons[0]);
                        sendAutoGather();
                        setTimeout(checkPrimaryReload, 50);
                    }

                    function checkPrimaryReload() {
                        if (player.reloads[player.weapons[0]] > 0) {
                            switchToSecondary();
                        } else {
                            setTimeout(checkPrimaryReload, 50);
                        }
                    }

                    function switchToSecondary() {
                        selectWeapon(player.weapons[1]);

                        if (player.currentWeapon === player.weapons[1]) {
                            sendAutoGather();
                        } else {
                            retrySwitchToSecondary();
                        }
                    }

                    function retrySwitchToSecondary() {
                        showMessage("Force Secondary");
                        buyEquip(player.reloads[53] == 0 ? 53 : 6, 0);
                        selectWeapon(player.weapons[1]);
                        if (player.currentWeapon === player.weapons[1]) {
                            sendAutoGather();
                        }
                    }

                    usePrimaryWeapon();
                };
                `;

    // Function to evaluate and replace saInsta
    function updateSaInsta(newCode) {
        // Evaluate the new function code
        eval(newCode);
    }

    // Initial evaluation of saInsta
    updateSaInsta(instaCode);

    // Create the toggle button
    const toggleButton = document.createElement('div');
    toggleButton.innerHTML = 'Update Script';
    toggleButton.style.position = 'fixed';
    toggleButton.style.top = '10px';
    toggleButton.style.right = '10px';
    toggleButton.style.backgroundColor = '#3498db';
    toggleButton.style.color = 'white';
    toggleButton.style.padding = '10px';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.zIndex = '9999';
    toggleButton.style.borderRadius = '5px';
    document.body.appendChild(toggleButton);

    // Create the updater box
    const updaterBox = document.createElement('div');
    updaterBox.style.display = 'none';
    updaterBox.style.position = 'fixed';
    updaterBox.style.top = '50%';
    updaterBox.style.left = '50%';
    updaterBox.style.transform = 'translate(-50%, -50%)';
    updaterBox.style.backgroundColor = 'white';
    updaterBox.style.border = '2px solid #3498db';
    updaterBox.style.padding = '20px';
    updaterBox.style.zIndex = '10000';
    updaterBox.style.boxShadow = '0px 0px 15px rgba(0, 0, 0, 0.3)';
    updaterBox.style.borderRadius = '10px';
    document.body.appendChild(updaterBox);

    // Updater box content
    const boxContent = `
        <h2>Script Updater</h2>
        <textarea id="scriptCode" rows="10" cols="50" style="width: 100%;">${instaCode}</textarea>
        <br>
        <button id="updateScript">Update Script</button>
        <button id="closeBox">Close</button>
    `;
    updaterBox.innerHTML = boxContent;

    // Toggle updater box visibility
    toggleButton.addEventListener('click', () => {
        updaterBox.style.display = updaterBox.style.display === 'none' ? 'block' : 'none';
    });

    // Close the updater box
    document.getElementById('closeBox').addEventListener('click', () => {
        updaterBox.style.display = 'none';
    });

    // Update the script code
    document.getElementById('updateScript').addEventListener('click', () => {
        const newScriptCode = document.getElementById('scriptCode').value;
        if (newScriptCode) {
            instaCode = newScriptCode; // Update the stored script code
            updateSaInsta(instaCode); // Re-evaluate and replace the function
            alert('Script updated! New code has been evaluated.');
        }
    });
    // insta code
    class Instakill {
        constructor() {
            if (secPacket > 60) return
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
            this.changeType = function(type) {
                this.wait = false;
                this.isTrue = true;
                my.autoAim = true;
                let instaLog = [type];
                let backupNobull = near.backupNobull;
                near.backupNobull = false;
                game.tickBase(() => {
                    instaLog.push(player.skinIndex);
                    game.tickBase(() => {
                        if (near.skinIndex == 22 && getEl("backupNobull").checked) {
                            near.backupNobull = true;
                        }
                        instaLog.push(player.skinIndex);
                    }, 1);
                }, 1);
                if (type == "rev") {
                    selectWeapon(player.weapons[1]);
                    buyEquip(53, 0);
                    buyEquip(0, 1);
                    sendAutoGather();
                    game.tickBase(() => {
                        if (near.dist2 <= 140 && configs.doSpikeOnReverse) place(2, getAttackDir());
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 1);
                    }, 1);
                } else if (type == "nobull") {
                    selectWeapon(player.weapons[0]);
                    sendAutoGather();
                    game.tickBase(() => {
                        selectWeapon(player.weapons[1]);
                        buyEquip(player.reloads[53] == 0 ? 53 : 6, 0);
                        buyEquip(0, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 1);
                    }, 1);

                } else if (type == "normal") {
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    sendAutoGather();
                    game.tickBase(() => {
                        selectWeapon(player.weapons[1]);
                        buyEquip(player.reloads[53] == 0 ? 53 : 6, 0);
                        buyEquip(0, 1);
                        game.tickBase(() => {
                            sendAutoGather();
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
            this.AutoSync = function () {
                this.isTrue = true;
                my.autoAim = true;
                selectWeapon(player.weapons[0]);
                packet("D", getAttackDir());
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
                }, 1);
            };
            this.syncTry = function () {
                packet("D", getAttackDir());
                buyEquip(53, 0);
                game.tickBase(() => {
                    this.isTrue = true;
                    my.autoAim = true;
                    selectWeapon(player.weapons[1]);
                    sendAutoGather();
                    game.tickBase(() => {
                        my.autoAim = false;
                        this.isTrue = false;
                        sendAutoGather();
                    }, 1);
                }, 2);
            };
            this.MapSync = function () {
                let nearDistCheck;
                nearDistCheck = near.dist2 <= 300 ? 1 : 2;
                buyEquip(53, 0);
                game.tickBase(() => {
                    selectWeapon(player.weapons[1]);
                    sendAutoGather();
                    this.isTrue = true;
                    my.autoAim = true;
                    game.tickBase(() => {
                        my.autoAim = false;
                        this.isTrue = false;
                        sendAutoGather();
                    }, 1);
                }, nearDistCheck);
            };
            this.spikeTickType = function () {
                ShowSettingText(300, "SpikeTick", "#f00");
                this.isTrue = true;
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
                }, 1);
            };
            // ff spike tick
            this.checkSoldier = function() {
                const canHit = traps.canHit();
                const nearReload = near.reloads[near.weaponIndex] !== 0;
                return (near.skinIndex !== 6 && canHit) || (!canHit && nearReload);
            };
            this.VelocityTickorBow = function() { // Stary Code
                this.isTrue = true;
                my.autoAim = true;
                biomeGear();
                buyEquip(19, 1);
                packet("9", near.aim2, 1);
                game.tickBase(() => {
                    if (player.weapons[1] == 15) {
                        my.revAim = true;
                    }
                    selectWeapon(player.weapons[[9, 12, 13, 15].includes(player.weapons[1]) ? 1 : 0]);
                    buyEquip(53, 0);
                    buyEquip(21, 1);
                    if ([9, 12, 13, 15].includes(player.weapons[1])) {
                        sendAutoGather();
                    }
                    packet("9", near.aim2, 1);
                    game.tickBase(() => {
                        my.revAim = false;
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        buyEquip(18, 1);
                        if (![9, 12, 13, 15].includes(player.weapons[1])) {
                            sendAutoGather();
                        }
                        packet("9", near.aim2, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                            packet("9", undefined, 1);
                        }, 2);
                    }, 1);
                }, 1);
            };
            this.hammerCounterType = function() {
                if (!configs.counterInsta || !this.CheckSoldier()) {
                    return;
                }
                this.isTrue = true;
                my.autoAim = true;
                if (near.dist2 <= 70 && configs.secondaryOnCounter) {
                    selectWeapon(player.weapons[1]);
                    buyEquip(player.reloads[53] === 0 && getEl("turretCombat").checked ? 53 : 7, 0);
                    sendAutoGather();
                    game.tickBase(() => {
                        buyEquip(7, 0);
                        selectWeapon(player.weapons[0]);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 1);
                    }, 1);
                } else {
                    selectWeapon(player.weapons[0]);
                    buyEquip(player.reloads[53] === 0 && getEl("turretCombat").checked ? 53 : 7, 0);
                    sendAutoGather();
                    game.tickBase(() => {
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                            this.CheckSoldier();
                        }, 1);
                    }, 1);
                }
            };
            this.pushTickType = function () {
                this.isTrue = true;
                my.autiAim = true;
                selectWeapon(player.weapons[1]);
                buyEquip(53, 0);
                sendAutoGather();
                game.addToQueue(() => {
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    game.addToQueue(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 2);
            }
            this.bianosSpTick = function () {
                my.autoAim = true;
                this.isTrue = true;
                buyEquip(7, 0);
                selectWeapon(player.weapons[0]);
                sendAutoGather();
                game.addToQueue(() => {
                    buyEquip(53, 0);
                    game.addToQueue(() => {
                        sendAutoGather();
                        bianosTick = false;
                        this.isTrue = false;
                        my.autoAim = false;
                        buyEquip(6, 0);
                    }, 1);
                }, 1);
            };
            this.repeaterOneTickType = function () {
                this.isTrue = true;
                my.autoAim = true;
                buyEquip(19, 1);
                packet("9", near.aim2, 1);
                game.addToQueue(() => {
                    selectWeapon(player.weapons[1]);
                    buyEquip(53, 0);
                    sendAutoGather();
                    packet("9", near.aim2, 1);
                    game.addToQueue(() => {
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        game.addToQueue(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                            packet("9", undefined, 1);
                        }, 1);
                    }, 1);
                }, 1);
            };
            this.spikeSyncType = function() {
                this.isTrue = true;
                my.autoAim = true;
                shuffleTicks();
                selectWeapon(player.weapons[0]);
                buyEquip(7, 0);
                buyEquip(18, 1);
                sendAutoGather();
                game.tickBase(() => {
                    selectWeapon(player.weapons[0]);
                    buyEquip(53, 0);
                    game.tickBase(() => {
                        sendAutoGather();
                        buyEquip(6, 0);
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 1);
            };
            this.pushTickType = function () {
                this.isTrue = true;
                my.autiAim = true;
                selectWeapon(player.weapons[1]);
                buyEquip(53, 0);
                sendAutoGather();
                game.addToQueue(() => {
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    game.addToQueue(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 2);
            }
            this.bianosSpTick = function () {
                my.autoAim = true;
                this.isTrue = true;
                buyEquip(7, 0);
                selectWeapon(player.weapons[0]);
                sendAutoGather();
                game.addToQueue(() => {
                    buyEquip(53, 0);
                    game.addToQueue(() => {
                        sendAutoGather();
                        bianosTick = false;
                        this.isTrue = false;
                        my.autoAim = false;
                        buyEquip(6, 0);
                    }, 1);
                }, 1);
            };
            this.counterType = function() {
                this.isTrue = true;
                my.autoAim = true;
                selectWeapon(player.weapons[0]);
                buyEquip(7, 0);
                buyEquip(21, 1);
                sendAutoGather();
                game.tickBase(() => {
                    if (player.reloads[53] == 0 && getEl("turretCombat").checked) {
                        selectWeapon(player.weapons[0]);
                        buyEquip(53, 0);
                        buyEquip(21, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 1);
                    } else {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }
                }, 1);
            };
            this.antiCounterType = function() {
                my.autoAim = true;
                this.isTrue = true;
                inantiantibull = true;
                selectWeapon(player.weapons[0]);
                buyEquip(6, 0);
                buyEquip(21, 1);
                io.send("D", near.aim2);
                sendAutoGather();
                game.tickBase(() => {
                    buyEquip(player.reloads[53] == 0 ? player.skins[53] ? 53 : 6 : 6, 0);
                    buyEquip(21, 1);
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                        inantiantibull = false;
                    }, 1);
                }, 1)
            };
            this.rangeType = function(type) {
                this.isTrue = true;
                my.autoAim = true;
                if (type == "ageInsta") {
                    my.ageInsta = false;
                    if (player.items[5] == 18) {
                        place(5, near.aim2);
                    }
                    packet("a", undefined, 1);
                    buyEquip(22, 0);
                    buyEquip(21, 1);
                    game.tickBase(() => {
                        selectWeapon(player.weapons[1]);
                        buyEquip(53, 0);
                        buyEquip(21, 1);
                        sendAutoGather();
                        game.tickBase(() => {
                            sendUpgrade(12);
                            selectWeapon(player.weapons[1]);
                            buyEquip(53, 0);
                            buyEquip(21, 1);
                            game.tickBase(() => {
                                sendUpgrade(15);
                                selectWeapon(player.weapons[1]);
                                buyEquip(53, 0);
                                buyEquip(21, 1);
                                game.tickBase(() => {
                                    sendAutoGather();
                                    this.isTrue = false;
                                    my.autoAim = false;
                                }, 1);
                            }, 1);
                        }, 1);
                    }, 1);
                } else {
                    selectWeapon(player.weapons[1]);
                    if (player.reloads[53] == 0 && near.dist2 <= 700 && near.skinIndex != 22) {
                        buyEquip(53, 0);
                    } else {
                        buyEquip(20, 0);
                    }
                    buyEquip(11, 1);
                    sendAutoGather();
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }
            };
            this.oneTickType = function() {
                io.send("7113213.29154");
                this.isTrue = true;
                my.autoAim = true;
                selectWeapon(player.weapons[1]);
                buyEquip(53, 0);
                buyEquip(19, 1);
                packet("a", near.aim2, 1);
                if (player.weapons[1] == 15) {
                    my.revAim = true;
                    sendAutoGather();
                }
                game.tickBase(() => {
                    my.revAim = false;
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    buyEquip(19, 1);
                    packet("a", near.aim2, 1);
                    if (player.weapons[1] != 15) {
                        sendAutoGather();
                    }
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                        packet("a", undefined, 1);
                    }, 1);
                }, 1);
            };
            this.threeOneTickType = function() {
                io.send("Tick2");
                this.isTrue = true;
                my.autoAim = true;
                selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                biomeGear();
                buyEquip(19, 1);
                packet("a", near.aim2, 1);
                game.tickBase(() => {
                    selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                    buyEquip(53, 0);
                    buyEquip(19, 1);
                    packet("a", near.aim2, 1);
                    game.tickBase(() => {
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        buyEquip(19, 1);
                        sendAutoGather();
                        packet("a", near.aim2, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                            packet("a", undefined, 1);
                        }, 1);
                    }, 1);
                }, 1);
            };
            this.kmTickType = function() {
                this.isTrue = true;
                my.autoAim = true;
                my.revAim = true;
                selectWeapon(player.weapons[1]);
                buyEquip(53, 0);
                buyEquip(19, 1);
                sendAutoGather();
                packet("a", near.aim2, 1);
                game.tickBase(() => {
                    my.revAim = false;
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    buyEquip(19, 1);
                    packet("a", near.aim2, 1);
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                        packet("a", undefined, 1);
                    }, 1);
                }, 1);
            };
            this.boostTickType = function () {
                /*this.isTrue = true;
                    my.autoAim = true;
                    selectWeapon(player.weapons[0]);
                    buyEquip(53, 0);
                    buyEquip(19, 1);
                    packet("a", near.aim2);
                    game.tickBase(() => {
                        place(4, near.aim2);
                        selectWeapon(player.weapons[1]);
                        biomeGear();
                        buyEquip(19, 1);
                        sendAutoGather();
                        packet("a", near.aim2);
                        game.tickBase(() => {
                            selectWeapon(player.weapons[0]);
                            buyEquip(7, 0);
                            buyEquip(19, 1);
                            packet("a", near.aim2);
                            game.tickBase(() => {
                                sendAutoGather();
                                this.isTrue = false;
                                my.autoAim = false;
                                packet("a", undefined);
                            }, 1);
                        }, 1);
                    }, 1);*/
                this.isTrue = true;
                my.autoAim = true;
                biomeGear();
                buyEquip(18, 1);
                packet("a", near.aim2, 1);
                game.tickBase(() => {
                    if (player.weapons[1] == 15) {
                        my.revAim = true;
                    }
                    selectWeapon(player.weapons[[9, 12, 13, 15].includes(player.weapons[1]) ? 1 : 0]);
                    buyEquip(53, 0);
                    buyEquip(18, 1);
                    if ([9, 12, 13, 15].includes(player.weapons[1])) {
                        sendAutoGather();
                    }
                    packet("a", near.aim2, 1);
                    place(4, near.aim2);
                    game.tickBase(() => {
                        my.revAim = false;
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        buyEquip(18, 1);
                        if (![9, 12, 13, 15].includes(player.weapons[1])) {
                            sendAutoGather();
                        }
                        packet("a", near.aim2, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                            packet("a", undefined, 1);
                        }, 1);
                    }, 1);
                }, 1);
            };
            this.gotoGoal = function(goto, OT) {
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
                    if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2 && awwww == 0) {
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
                        bQ(11, 1);
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
                                        bQ(10, 1);
                                        if (configs.none) {
                                            player.buildIndex != player.items[1] && selectToBuild(player.items[1]);
                                        } else {
                                            if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                                selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                            }
                                        }
                                    } else {
                                        bQ(22, 0);
                                        bQ(19, 1);
                                        if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                            selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                        }
                                    }
                                } else {
                                    bQ(6, 0);
                                    bQ(12, 1);
                                    if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                        selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                    }
                                }
                            } else {
                                biomeGear();
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
                                        bQ(9, 1);
                                        if (configs.none) {
                                            player.buildIndex != player.items[1] && selectToBuild(player.items[1]);
                                        } else {
                                            if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                                selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                            }
                                        }
                                    } else {
                                        bQ(22, 0);
                                        bQ(19, 1);
                                        if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                            selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                        }
                                    }
                                } else {
                                    bQ(6, 0);
                                    bQ(12, 1);
                                    if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                        selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                    }
                                }
                            } else {
                                biomeGear();
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
                    this.ticking = false;
                    return {
                        dir: undefined,
                        action: 0
                    };
                }
            }
            /** wait 1 tick for better quality */
            this.bowMovement = function() {
                let moveMent = this.gotoGoal(685, 3);
                if (moveMent.action) {
                    if (player.reloads[53] == 0 && !this.isTrue) {
                        this.rangeType("ageInsta");
                    } else {
                        packet("a", moveMent.dir, 1);
                    }
                } else {
                    packet("a", moveMent.dir, 1);
                }
            },
                this.tickMovement = function() {
                let dist = player.weapons[1] == 9 ? 240 : 240;
                let actionDist = player.weapons[1] == 9 ? 2 : player.weapons[1] == 12 ? 1.5 : player.weapons[1] == 13 ? 1 : player.weapons[1] == 15 ? 2 : 3;
                let moveMent = this.gotoGoal(238, 3);
                if (moveMent.action) {
                    if (player.reloads[53] == 0 && !this.isTrue) {
                        this.boostTickType();
                    } else {
                        packet("a", moveMent.dir, 1);
                    }
                } else {
                    packet("a", moveMent.dir, 1);
                }
            },
                this.BoostOneTick = function () {
                let dist = player.weapons[1] == 9 ? 365 : player.weapons[1] == 12 ? 380 : player.weapons[1] == 13 ? 365 : player.weapons[1] == 15 ? 365 : 370;
                let actionDist = player.weapons[1] == 9 ? 2 : player.weapons[1] == 12 ? 1.5 : player.weapons[1] == 13 ? 1 : player.weapons[1] == 15 ? 2 : 3;
                let moveMent = this.gotoGoal(372, 3);
                if (moveMent.action) {
                    if (player.reloads[53] == 0 && !this.isTrue) {
                        this.BoostOneTICKERS();
                    } else {
                        packet("9", moveMent.dir, 1);
                    }
                } else {
                    packet("9", moveMent.dir, 1);
                }
            }
            this.kmTickMovement = function() {
                let moveMent = this.gotoGoal(240, 3);
                if (moveMent.action) {
                    if (near.skinIndex != 22 && player.reloads[53] == 0 && !this.isTrue && ((game.tick - near.poisonTick) % config.serverUpdateRate == 8)) {
                        this.kmTickType();
                    } else {
                        packet("a", moveMent.dir, 1);
                    }
                } else {
                    packet("a", moveMent.dir, 1);
                }
            },
                this.boostTickMovement = function () {
                let dist = player.weapons[1] == 9 ? 345 : player.weapons[1] == 12 ? 375 : player.weapons[1] == 13 ? 363 : player.weapons[1] == 15 ? 365 : 370;
                let actionDist = player.weapons[1] == 9 ? 2 : player.weapons[1] == 12 ? 1.5 : player.weapons[1] == 13 ? 1 : player.weapons[1] == 15 ? 2 : 3;
                let moveMent = this.gotoGoal(372, 3);
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
                    x: nr.x2 + (65 * Math.cos(nr.aim2 + Math.PI)),
                    y: nr.y2 + (65 * Math.sin(nr.aim2 + Math.PI))
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
                finds = liztobj.filter(tmp => tmp.active).find((tmp) => {
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
        constructor(buyHat, buyAcc) {
            this.shitass = false;

            this.hat = function() {
                if (!this.shitass) {
                    let find = findID(hats, 40);
                    if (find && !player.skins[40] && player.points >= find.price) {
                        packet("c", 1, 40, 0);
                        this.shitass = true;
                    }
                    return;
                } else {
                    for (let i = 0; i < buyHat.length; i++) {
                        const id = buyHat[i];

                        let find = findID(hats, id);
                        if (find && !player.skins[id] && player.points >= find.price) {
                            packet("c", 1, id, 0);
                        }
                    }
                }
            };

            this.acc = function() {
                for (let i = 0; i < buyAcc.length; i++) {
                    const id = buyAcc[i];
                    let find = findID(accessories, id);
                    if (find && !player.tails[id] && player.points >= find.price) {
                        packet("c", 1, id, 1);
                    }
                }
            };
        }
    }

    let autoBuy = new Autobuy([40, 6, 7, 22, 26, 31, 53], [11, 13, 19]);
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
    var bianosTick = false;


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
    let instaC = new Instakill();
    let autoUpgrade = new Autoupgrade();

    let lastDeath;
    let minimapData;
    let mapMarker = {};
    let mapPings = [];
    let tmpPing;

    let breakTrackers = [];

    let pathFindTest = 0;
    let grid = [];
    let pathFind = {
        active: false,
        grid: 40,
        scale: 1440,
        x: 14400,
        y: 14400,
        chaseNear: false,
        array: [],
        lastX: this.grid / 2,
        lastY: this.grid / 2
    };

    function sendChat(message) {
        packet("6", message.slice(0, 30));
    }

    let runAtNextTick = [];
    function checkProjectileHit(plyr, velocity, th, obj, R = 50) {
        const ux = Math.cos(th);
        const uy = Math.sin(th);
        let target = obj;
        let proj = {
            x: plyr.x2,
            y: plyr.y2
        };
        let tick = null;
        const movDir = obj.movDir;
        for (let i = 0; i < 6; i++) {
            proj.x += velocity / 4 * ux;
            proj.x += velocity / 4 * uy;
            target = calcAccel(target, movDir, target, game.tickRate);
            const dx = proj.x - target.x2;
            const dy = proj.y - target.y2;
            if (dx * dx + dy * dy <= R * R) {
                tick = i;
                return true;
            } else if (i >= 2) {
                const dx2 = player.x2 - target.x2;
                const dy2 = player.y2 - target.y2;
                const dx3 = player.x2 - proj.x;
                const dy3 = player.y2 - proj.y;
                if (dx2 * dx2 + dy2 * dy2 < dx3 * dx3 + dy3 * dy3 + 7000) {
                    return false;
                }
            }
        }
        return false;
    }
    function checkProjectileHolder(x, y, dir, range, speed, indx, layer, sid) {
        let weaponIndx = indx == 0 ? 9 : indx == 2 ? 12 : indx == 3 ? 13 : indx == 5 && 15;
        let projOffset = config.playerScale * 2;
        let projXY = {
            x: indx == 1 ? x : x - projOffset * Math.cos(dir),
            y: indx == 1 ? y : y - projOffset * Math.sin(dir),
        };
        let nearPlayer = players.filter((e) => e.visible && UTILS.getDist(projXY, e, 0, 2) <= e.scale).sort(function(a, b) {
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
    let projectileCount = 0;

    function antiProj(tmpObj, dir, range, speed, index, weaponIndex) {
        if (!tmpObj.isTeam(player)) {
            tmpDir = UTILS.getDirect(player, tmpObj, 2, 2);
            if (UTILS.getAngleDist(tmpDir, dir) <= 0.2) {
                tmpObj.bowThreat[weaponIndex]++;
                if (index == 5) {
                    projectileCount++;
                }
                setTimeout(() => {
                    tmpObj.bowThreat[weaponIndex]--;
                    if (index == 5) {
                        projectileCount--;
                    }
                }, range / speed);
                if (tmpObj.bowThreat[9] >= 1 && (tmpObj.bowThreat[12] >= 1 || tmpObj.bowThreat[15] >= 1)) {
                    place(3, tmpObj.aim2);
                    my.anti0Tick = 4;
                    if (!my.antiSync) {
                        antiSyncHealing(4);
                    }
                } else {
                    if (projectileCount >= 2) {
                        place(3, tmpObj.aim2);
                        healer();
                        player.chat.message = `Sync/Bow Threat Blocked ${window.pingTime}ms`;
                        player.chat.count = 1000;
                        buyEquip(22, 0);
                        buyEquip(13, 1);
                        my.anti0Tick = 4;
                        if (!my.antiSync) {
                            antiSyncHealing(4);
                        }
                    } else {
                        if (projectileCount === 1) { // anti reverse or anti 1 tick with reaper
                            buyEquip(6, 0);
                            buyEquip(13, 1);
                        }
                        /*} else {
                        if (projectileCount >= 2) { // anti sync линия обороны N1
                        return Math.ceil((100 - player.health) / items.list[player.items[0]].healing);
                        player.chat.message = "pSyD";
                        healer();
                        buyEquip(6, 0);
                    }*/
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
                    text: !item.type ? "primary" : "secondary",
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

    // MOUSE INPUT:
    var usingTouch;
    const mals = document.getElementById('touch-controls-fullscreen');
    mals.style.display = 'block';
    mals.addEventListener("mousemove", gameInput, false);

    function gameInput(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
    }
    let clicks = {
        left: false,
        middle: false,
        right: false,
    };
    let clicked = {
        g: false
    }
    mals.addEventListener("mousedown", mouseDown, false);

    function mouseDown(e) {
        if (attackState != 1) {
            attackState = 1;
            if (e.button == 0) {
                clicks.left = true;
            } else if (e.button == 2) {
                clicks.right = true;
            }
        }
    }
    mals.addEventListener("mouseup", UTILS.checkTrusted(mouseUp));

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
    mals.addEventListener("wheel", wheel, false);
    let wbe = 1;

    function wheel(e) {
        if (e.deltaY < 0) {
            wbe += 0.05
            maxScreenWidth = config.maxScreenWidth * wbe;
            maxScreenHeight = config.maxScreenHeight * wbe;
            resize()
        } else {
            wbe -= 0.05
            maxScreenWidth = config.maxScreenWidth * wbe;
            maxScreenHeight = config.maxScreenHeight * wbe;
            resize()
        }
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

    function getSafeDir() {
        if (!player)
            return 0;
        if (!player.lockDir) {
            lastDir = Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2));
        }
        return lastDir || 0;
    }
    let plusDir = 0;
    let lastSpin = Date.now();
    const aimSpike = () => {
        packet("D", Math.atan2(spikeB.info.y - player.y2, spikeB.info.x - player.x2));
    };
    function getAttackDir(debug) {
        if (debug) {
            if (!player)
                return "0";
            if (my.autoAim || ((clicks.left || (useWasd && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap)) && player.reloads[player.weapons[0]] == 0))
                lastDir = getEl("weaponGrind").checked ? "getSafeDir()" : enemy.length ? my.revAim ? "(near.aim2 + Math.PI)" : "near.aim2" : "getSafeDir()";
            else
                if (clicks.right && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0)
                    lastDir = "getSafeDir()";
            else
                if (traps.inTrap && player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] == 0)
                    lastDir = "traps.aim";
            else
                if (!player.lockDir) {
                    if (configs.noDir) return "undefined";
                    lastDir = "getSafeDir()";
                }
            return lastDir;
        } else {
            if (!player)
                return 0;
            if (my.autoAim || ((clicks.left || (useWasd && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap)) && player.reloads[player.weapons[0]] == 0))
                lastDir = getEl("weaponGrind").checked ? getSafeDir() : enemy.length ? my.revAim ? (near.aim2 + Math.PI) : near.aim2 : getSafeDir();
            else
                if (clicks.right && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0)
                    lastDir = getSafeDir();
            else
                if ((traps.inTrap || traps.breakshit) && player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] == 0)
                    lastDir = traps.aim;
            else
                if (!player.lockDir) {
                    if (configs.noDir) return undefined;
                    lastDir = getSafeDir();
                }
            return lastDir || 0;
        }
    }
    function realDir(num) {
        game.tickBase(() => {
            num = 3;
            if (showRealDir < num) {
                showRealDir = num;
            }
        }, 1);
    }
    function getVisualDir() {
        if (!player)
            return 0;
        lastDir = getSafeDir();
        return lastDir || 0;
    }
    this.spikeTickType = function() {
        this.isTrue = true;
        my.autoAim = true;
        selectWeapon(player.weapons[0]);
        buyEquip(7, 0);
        sendAutoGather();
        game.tickBase(() => {
            //if (player.reloads[53] == 0 && getEl("turretCombat").checked) {
            buyEquip(53, 0);
            selectWeapon(player.weapons[0]);
            buyEquip(53, 0);
            //buyEquip(21, 1);
            game.tickBase(() => {
                sendAutoGather();
                this.isTrue = false;
                my.autoAim = false;
                buyEquip(6, 0);
                buyEquip(21, 1);
            }, 3);
        }, 1);
    };
    /* this.spikeTickType = function() {
                        this.isTrue = true;
                        my.autoAim = true;
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        buyEquip(21, 1);
                        sendAutoGather();
                        game.tickBase(() => {
                            if (player.reloads[53] == 0 && getEl("turretCombat").checked) {
                                selectWeapon(player.weapons[0]);
                                buyEquip(53, 0);
                                buyEquip(21, 1);
                                game.tickBase(() => {
                                    sendAutoGather();
                                    this.isTrue = false;
                                    my.autoAim = false;
                                }, 1);
                            } else {
                                sendAutoGather();
                                this.isTrue = false;
                                my.autoAim = false;
                            }
                        }, 1);
                    };*/

    // KEYS:
    function keysActive() {
        return (allianceMenu.style.display != "block" &&
                chatHolder.style.display != "block" &&
                !menuCBFocus);
    }

    function toggleMenuChat() {
        if (menuChatDiv.style.display != "none") {
            //   chatHolder.style.display = "none";
            // if (menuChatBox.value != "") {
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

    function keyDown(event) {
        let keyNum = event.which || event.keyCode || 0;
        if (player && player.alive && keysActive()) {
            if (!keys[keyNum]) {
                keys[keyNum] = 1;
                macro[event.key] = 1;
                if (keyNum == 27) {
                    openMenu = !openMenu;
                    $("#menuDiv").toggle("slow");
                } else if (keyNum == 17) {
                    openMenu = !openMenu;
                    $("#menuChatDiv").toggle("slow");
                } else if (keyNum == 69) {
                    sendAutoGather();
                } else if (keyNum == 67) {
                    updateMapMarker();
                } else if (event.key == "k") {
                    io.send("6", "")
                    setTimeout(() => {
                        io.send("6", "Don't care")
                        setTimeout(() => {
                            io.send("6", "didin't ask")
                            setTimeout(() => {
                                io.send("6", "cry about it")
                                setTimeout(() => {
                                    io.send("6", "stay mad")
                                    setTimeout(() => {
                                        io.send("6", "get real")
                                        setTimeout(() => {
                                            io.send("6", "L")
                                            setTimeout(() => {
                                                io.send("6", "mad seethe cope harder")
                                                setTimeout(() => {
                                                    io.send("6", "hoes mad")
                                                    setTimeout(() => {
                                                        io.send("6", "Sex offencer")
                                                        setTimeout(() => {
                                                            io.send("6", "basic")
                                                            setTimeout(() => {
                                                                io.send("6", "skill issue")
                                                                setTimeout(() => {
                                                                    io.send("6", "ratio")
                                                                    setTimeout(() => {
                                                                        io.send("6", "you fell off")
                                                                        setTimeout(() => {
                                                                            io.send("6", "the audacity")
                                                                            setTimeout(() => {
                                                                                io.send("6", "triggered")
                                                                                setTimeout(() => {
                                                                                    io.send("6", "any askers")
                                                                                    setTimeout(() => {
                                                                                        io.send("6", "replled")
                                                                                        setTimeout(() => {
                                                                                            io.send("6", "get a life")
                                                                                            setTimeout(() => {
                                                                                                io.send("6", "ok and?")
                                                                                                setTimeout(() => {
                                                                                                    io.send("6", "cringe")
                                                                                                    setTimeout(() => {
                                                                                                        io.send("6", "touch grass")
                                                                                                        setTimeout(() => {
                                                                                                            io.send("6", "donowalled")
                                                                                                            setTimeout(() => {
                                                                                                                io.send("6", "not based")
                                                                                                                setTimeout(() => {
                                                                                                                    io.send("6", "not funny didn’t laugh")
                                                                                                                    setTimeout(() => {
                                                                                                                        io.send("6", "*you're")
                                                                                                                        setTimeout(() => {
                                                                                                                            io.send("6", "grammar issues")
                                                                                                                            setTimeout(() => {
                                                                                                                                io.send("6", "go outside")
                                                                                                                                setTimeout(() => {
                                                                                                                                    io.send("6", "get good")
                                                                                                                                    setTimeout(() => {
                                                                                                                                        io.send("6", "reported")
                                                                                                                                        setTimeout(() => {
                                                                                                                                            io.send("6", "ad hominem")
                                                                                                                                            setTimeout(() => {
                                                                                                                                                io.send("6", "GG?")
                                                                                                                                                setTimeout(() => {
                                                                                                                                                    io.send("6", "ask frvr")
                                                                                                                                                    setTimeout(() => {
                                    io.send("6", "ez clap")
                                setTimeout(() => {
                                    io.send("6", "straight cash")
                                    setTimeout(() => {
                                        io.send("6", "ratio again")
                                        setTimeout(() => {
                                            io.send("6", "final ratio")
                                            setTimeout(() => {
                                                io.send("6", "problematic")
                                                setTimeout(() => {
                                                    io.send("6", "furry lover")
                                                    setTimeout(() => {
                                                        io.send("6", "retard")
                                                        setTimeout(() => {
                                                        }, 2000);
                                                    }, 2000);
                                                }, 2000);
                                            }, 2000);
                                        }, 2000);
                                    }, 2000);
                                }, 2000);
                                                                                                                                                    }, 2000);
                                                                                                                                                }, 2000);
                                                                                                                                            }, 2000);
                                                                                                                                        }, 2000);
                                                                                                                                    }, 2000);
                                                                                                                                }, 2000);
                                                                                                                            }, 2000);
                                                                                                                        }, 2000);
                                                                                                                    }, 2000);
                                                                                                                }, 2000);
                                                                                                            }, 2000);
                                                                                                        }, 2000);
                                                                                                    }, 2000);
                                                                                                }, 2000);
                                                                                            }, 2000);
                                                                                        }, 2000);
                                                                                    }, 2000);
                                                                                }, 2000);
                                                                            }, 2000);
                                                                        }, 2000);
                                                                    }, 2000);
                                                                }, 2000);
                                                            }, 2000);
                                                        }, 2000);
                                                    }, 2000);
                                                }, 2000);
                                            }, 2000);
                                        }, 2000);
                                    }, 2000);
                                }, 2000);
                            }, 2000);
                        }, 2000);
                    }, 2000);
                } else if (event.key == "/") {
                    resetMenuChText();
                    addMenuChText(null, "Successfully Auto-Cleared Chat", "lime", 1);
                } else if (keyNum == 71) {
                    clicked.g = !clicked.g
                } else if (event.key == "p") {
                    configs.autoOneFrame = !configs.autoOneFrame;
                    player.chat.message = (configs.autoOneFrame ? "Active" : "Passive");
                    player.chat.count = 1000;
                } else if (player.weapons[keyNum - 49] != undefined) {
                    player.weaponCode = player.weapons[keyNum - 49];
                } else if (moveKeys[keyNum]) {
                    sendMoveDir();
                } else if (event.key == "m") {
                    mills.placeSpawnPads = !mills.placeSpawnPads;
                } else if (event.key == "z") {
                    mills.place = !mills.place;
                } else if (event.key == "Z") {
                    typeof window.debug == "function" && window.debug();
                } else if (keyNum == 32) {
                    packet("d", 1, getSafeDir(), 1);
                    packet("d", 0, getSafeDir(), 1);
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
            } else if (keysActive()) {
                if (keys[keyNum]) {
                    keys[keyNum] = 0;
                    macro[event.key] = 0;
                    if (moveKeys[keyNum]) {
                        sendMoveDir();
                    }
                }
            }
        }
    }
    window.addEventListener("keyup", UTILS.checkTrusted(keyUp));

    function sendMoveDir() {
        let newMoveDir = getMoveDir();
        if (lastMoveDir == undefined || newMoveDir == undefined || Math.abs(newMoveDir - lastMoveDir) > 0.3) {
            if (!my.autoPush) {
                packet("a", newMoveDir, 1);
            }
            lastMoveDir = newMoveDir;
        }
    }

    // BUTTON EVENTS:
    function bindEvents() {}
    bindEvents();

    /** PATHFIND TEST */
    function chechPathColl(tmp) {
        return ((player.scale + tmp.getScale()) / (player.maxSpeed * items.weapons[player.weaponIndex].spdMult)) + (tmp.dmg && !tmp.isTeamObject(player) ? 35 : 0);
        return tmp.colDiv == 0.5 ? (tmp.scale * tmp.colDiv) :
            !tmp.isTeamObject(player) && tmp.dmg ? (tmp.scale + player.scale) :
        tmp.isTeamObject(player) && tmp.trap ? 0 : tmp.scale;
    }

    function checkObject() {
        let checkColl = gameObjects.filter(tmp => player.canSee(tmp) && tmp.active);
        for (let y = 0; y < pathFind.grid; y++) {
            grid[y] = [];
            for (let x = 0; x < pathFind.grid; x++) {
                let tmpXY = {
                    x: (player.x2 - (pathFind.scale / 2)) + ((pathFind.scale / pathFind.grid) * x),
                    y: (player.y2 - (pathFind.scale / 2)) + ((pathFind.scale / pathFind.grid) * y)
                }
                if (UTILS.getDist(pathFind.chaseNear ? near : pathFind, tmpXY, pathFind.chaseNear ? 2 : 0, 0) <= (pathFind.chaseNear ? 35 : 60)) {
                    pathFind.lastX = x;
                    pathFind.lastY = y;
                    grid[y][x] = 0;
                    continue;
                }
                let find = checkColl.find(tmp => UTILS.getDist(tmp, tmpXY, 0, 0) <= chechPathColl(tmp));
                if (find) {
                    if (find.trap) {
                        grid[y][x] = 0;
                        continue;
                    }
                    grid[y][x] = 1;
                } else {
                    grid[y][x] = 0;
                }
            }
        }
    }

    function createPath() {
        grid = [];
        checkObject();
    }

    function Pathfinder() {
        pathFind.scale = (config.maxScreenWidth / 2) * 1.3;
        if (!traps.inTrap && (pathFind.chaseNear ? enemy.length : true)) {
            if (near.dist2 <= items.weapons[player.weapons[0]].range) {
                packet("a", undefined, 1);
            } else {
                createPath();
                easystar.setGrid(grid);
                easystar.setAcceptableTiles([0]);
                easystar.enableDiagonals();
                easystar.findPath((grid[0].length / 2), (grid.length / 2), pathFind.lastX, pathFind.lastY, function (path) {
                    if (path === null) {
                        pathFind.array = [];
                        if (near.dist2 <= items.weapons[player.weapons[0]].range) {
                            packet("a", undefined, 1);
                        } else {
                            packet("a", near.aim2, 1);
                        }
                    } else {
                        pathFind.array = path;
                        if (pathFind.array.length > 1) {
                            let tmpXY = {
                                x: (player.x2 - (pathFind.scale / 2)) + ((pathFind.scale / pathFind.grid) * path[1].x),
                                y: (player.y2 - (pathFind.scale / 2)) + ((pathFind.scale / pathFind.grid) * path[1].y)
                            }
                            packet("a", UTILS.getDirect(tmpXY, player, 0, 2), 1);
                        }
                    }
                });
                easystar.calculate();
            }
        }
    }
    /** PATHFIND TEST */

    // ITEM COUNT DISPLAY:
    let isItemSetted = [];

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
                        padding-left: 5px;
                        font-size: 2em;
                        color: #fff;
                        `;
                isItemSetted[tmpI].innerHTML = player.itemCounts[id] || 0;
            } else {
                if (index == id) isItemSetted[tmpI].innerHTML = player.itemCounts[index] || 0;
            }
        }
    }

    // AUTOPUSH:
    function autoPush() {
        let nearTrap = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= (near.scale + tmp.getScale() + 5)).sort(function(a, b) {
            return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
        })[0];
        if (nearTrap) {
            let spike = gameObjects.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, nearTrap, 0, 0) <= (near.scale + nearTrap.scale + tmp.scale)).sort(function(a, b) {
                return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
            })[0];
            if (spike) {
                let pos = {
                    x: spike.x + (250 * Math.cos(UTILS.getDirect(near, spike, 2, 0))),
                    y: spike.y + (250 * Math.sin(UTILS.getDirect(near, spike, 2, 0))),
                    x2: spike.x + ((UTILS.getDist(near, spike, 2, 0) + player.scale) * Math.cos(UTILS.getDirect(near, spike, 2, 0))),
                    y2: spike.y + ((UTILS.getDist(near, spike, 2, 0) + player.scale) * Math.sin(UTILS.getDirect(near, spike, 2, 0)))
                };
                let finds = gameObjects.filter(tmp => tmp.active).find((tmp) => {
                    let tmpScale = tmp.getScale();
                    if (!tmp.ignoreCollision && UTILS.lineInRect(tmp.x - tmpScale, tmp.y - tmpScale, tmp.x + tmpScale, tmp.y + tmpScale, player.x2, player.y2, pos.x2, pos.y2)) {
                        return true;
                    }
                });
                if (finds) {
                    if (my.autoPush) {
                        my.autoPush = false;
                        packet("a", lastMoveDir || undefined, 1);
                    }
                } else {
                    my.autoPush = true;
                    my.pushData = {
                        x: spike.x + 70,
                        y: spike.y + 70,
                        x2: pos.x2 + 30,
                        y2: pos.y2 + 30
                    };
                    let scale = player.scale / 10;
                    let secondArg = UTILS.getDirect(near, spike, 2, 0) > 70 ? near.aim2 : undefined;
                    if (UTILS.lineInRect(player.x2 - scale, player.y2 - scale, player.x2 + scale, player.y2 + scale, near.x2, near.y2, pos.x, pos.y)) {
                        packet("a", secondArg, 1);
                    } else {
                        packet("a", UTILS.getDirect(pos, player, 2, 2), 1);
                    }
                }
            } else {
                if (my.autoPush) {
                    my.autoPush = false;
                    packet("a", lastMoveDir || undefined, 1);
                }
            }
        } else {
            if (my.autoPush) {
                my.autoPush = false;
                packet("a", lastMoveDir || undefined, 1);
            }
        }
    }
    // AUTOPUSH:
    /*            function autoPush() { //LEGACY AUTOPUSH
          let nearTrap = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= (near.scale + tmp.getScale() + 5)).sort(function (a, b) {
              return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
          })[0];
          if (nearTrap) {
              let spike = gameObjects.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, nearTrap, 0, 0) <= (near.scale + nearTrap.scale + tmp.scale)).sort(function (a, b) {
                  return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
              })[0];
              if (spike) {
                  let pos = {
                      x: spike.x + (250 * Math.cos(UTILS.getDirect(near, spike, 2, 0))),
                      y: spike.y + (250 * Math.sin(UTILS.getDirect(near, spike, 2, 0))),
                      x2: spike.x + ((UTILS.getDist(near, spike, 2, 0) + player.scale) * Math.cos(UTILS.getDirect(near, spike, 2, 0))),
                      y2: spike.y + ((UTILS.getDist(near, spike, 2, 0) + player.scale) * Math.sin(UTILS.getDirect(near, spike, 2, 0)))
                  };
                  let finds = gameObjects.filter(tmp => tmp.active).find((tmp) => {
                      let tmpScale = tmp.getScale();
                      if (!tmp.ignoreCollision && UTILS.lineInRect(tmp.x - tmpScale, tmp.y - tmpScale, tmp.x + tmpScale, tmp.y + tmpScale, player.x2, player.y2, pos.x2, pos.y2)) {
                          return true;
                      }
                  });
                  if (finds) {
                      if (my.autoPush) {
                          my.autoPush = false;
                          packet("33", lastMoveDir||undefined, 1);
                      }
                  } else {
                      my.autoPush = true;
                      my.pushData = {
                          x: spike.x,
                          y: spike.y,
                          x2: pos.x2,
                          y2: pos.y2
                      };
                      let scale = (player.scale / 10);
                      if (UTILS.lineInRect(player.x2 - scale, player.y2 - scale, player.x2 + scale, player.y2 + scale, near.x2, near.y2, pos.x, pos.y)) {
                          packet("33", near.aim2, 1);
                      } else {
                          packet("33", UTILS.getDirect(pos, player, 2, 2), 1);
                      }
                  }
              } else {
                  if (my.autoPush) {
                      my.autoPush = false;
                      packet("33", lastMoveDir||undefined, 1);
                  }
              }
          } else {
              if (my.autoPush) {
                  my.autoPush = false;
                  packet("33", lastMoveDir||undefined, 1);
              }
          }
      }*/
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
        packet("d", 0, getAttackDir(), 1);
        my.ageInsta = true;
        if (firstSetup) {
            firstSetup = false;
            gameObjects.length = 0;
            liztobj.length = 0;
        }
    }
    /*function knockBackPredict() {
                //thank you OE2375
                let KBIndc = {
                    x0: 0,
                    y0: 0,
                    x1: 0,
                    y1: 0,
                    instax: 0,
                    instay: 0,
                    turretx: 0,
                    turrety: 0
                }
                let nea = Math.atan2(near.y2 - player.y2, near.x2 - player.x2);
                let minDist = Infinity;
                let neIT = gameObjects.filter(e => e.name == "pit trap" && e.active && e.isTeamObject(player) && UTILS.getDist(e, near, 0, 2) <= e.getScale() + player.scale + 5).sort((a, b) => {
                    return UTILS.getDist(a, near, 0, 2) - UTILS.UTILS.getDist(b, near, 0, 2);
                })[0];
                if (near.dist2 - player.scale * 1.8 <= items.weapons[player.weapons[0]].range && !neIT) {
                    for (let tmp of gameObjects) {
                        let scope = KBIndc;
                        if (tmp.dmg && tmp.active && tmp.isTeamObject(player)) {
                            let primaryScaling = (items.weapons[player.weapons[0]].knock||0) * items.weapons[player.weapons[0]].range + player.scale * 2
                            let secondaryScaling = ![undefined, 9, 12, 13, 15].includes(player.weapons[1]) ? (items.weapons[player.weapons[1]].knock||0) * items.weapons[player.weapons[1]].range + player.scale*2 - 10 : player.weapons[1] != undefined ? 60 : 0
                            let instaStuff = primaryScaling + secondaryScaling
                            let turretStuff = player.reloads[53] == 0 ? primaryScaling + secondaryScaling + 75 : instaStuff
                            let primaryX = near.x2 + primaryScaling * Math.cos(nea)
                            let primaryY = near.y2 + primaryScaling * Math.sin(nea)
                            let secondaryX = near.x2 + secondaryScaling * Math.cos(nea)
                            let secondaryY = near.y2 + secondaryScaling * Math.sin(nea)
                            let instaX = near.x2 + instaStuff * Math.cos(nea)
                            let instaY = near.y2 + instaStuff * Math.sin(nea)
                            let turretX = near.x2 + turretStuff * Math.cos(nea)
                            let turretY = near.y2 + turretStuff * Math.sin(nea)
                            scope.x0 = primaryX, scope.y0 = primaryY
                            scope.x1 = secondaryX, scope.y1 = secondaryY
                            scope.instax = instaX, scope.instay = instaY
                            scope.turretx = turretX, scope.turrety = turretY
                            if ((UTILS.getDist({ x: primaryX, y: primaryY }, tmp, 0, 0) <= tmp.scale + player.scale) && player.reloads[player.weapons[0]] == 0 && !traps.inTrap) {
                                tracker.draw2.active = true
                                tracker.draw2.x = tmp.x
                                tracker.draw2.y = tmp.y
                                tracker.draw2.scale = tmp.scale
                                return "insta them"
                            }
                            if ((UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) <= tmp.scale + player.scale) && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && !traps.inTrap) {
                                return "insta them"
                                tracker.draw2.active = true
                                tracker.draw2.x = tmp.x
                                tracker.draw2.y = tmp.y
                                tracker.draw2.scale = tmp.scale
                            }
                        }
                    }
                } else {
                    tracker.draw2.active = false
                    KBIndc = {
                        x0: 0,
                        y0: 0,
                        x1: 0,
                        y1: 0,
                        instax: 0,
                        instay: 0,
                        turretx: 0,
                        turrety: 0
                    }
                }
                return false
            }*/
    let barbKbPredict = false;

    function knockBackPredict() {
        //thank you OE2375
        let KBIndc = {
            x0: 0,
            y0: 0,
            x1: 0,
            y1: 0,
            instax: 0,
            instay: 0,
            turretx: 0,
            turrety: 0
        }
        let nea = Math.atan2(near.y2 - player.y2, near.x2 - player.x2);
        let minDist = Infinity;
        let neIT = gameObjects.filter(e => e.name == "pit trap" && e.active && e.isTeamObject(player) && UTILS.getDist(e, near, 0, 2) <= e.getScale() + player.scale + 5).sort((a, b) => {
            return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
        })[0];
        if (near.dist2 - player.scale * 1.8 <= items.weapons[player.weapons[0]].range && !neIT) {
            for (let tmp of gameObjects) {
                let scope = KBIndc;
                if (tmp.dmg && tmp.active && tmp.isTeamObject(player)) {
                    let primaryScaling = (items.weapons[player.weapons[0]].knock||0) * items.weapons[player.weapons[0]].range + player.scale * 2
                    let secondaryScaling = ![undefined, 9, 12, 13, 15].includes(player.weapons[1]) ? (items.weapons[player.weapons[1]].knock||0) * items.weapons[player.weapons[1]].range + player.scale*2 - 10 : player.weapons[1] != undefined ? 60 : 0
                    let instaStuff = primaryScaling + secondaryScaling
                    let turretStuff = player.reloads[53] == 0 ? primaryScaling + secondaryScaling + 75 : instaStuff
                    let primaryX = near.x2 + primaryScaling * Math.cos(nea)
                    let primaryY = near.y2 + primaryScaling * Math.sin(nea)
                    let secondaryX = near.x2 + secondaryScaling * Math.cos(nea)
                    let secondaryY = near.y2 + secondaryScaling * Math.sin(nea)
                    let instaX = near.x2 + instaStuff * Math.cos(nea)
                    let instaY = near.y2 + instaStuff * Math.sin(nea)
                    let turretX = near.x2 + turretStuff * Math.cos(nea)
                    let turretY = near.y2 + turretStuff * Math.sin(nea)
                    let barbarianKnockback = 235;
                    scope.x0 = primaryX, scope.y0 = primaryY
                    scope.x1 = secondaryX, scope.y1 = secondaryY
                    scope.instax = instaX, scope.instay = instaY
                    scope.turretx = turretX, scope.turrety = turretY
                    if ((UTILS.getDist({ x: primaryX, y: primaryY }, tmp, 0, 0) <= tmp.scale + player.scale) && player.reloads[player.weapons[0]] == 0 && !traps.inTrap) {
                        tracker.draw2.active = true
                        tracker.draw2.x = tmp.x
                        tracker.draw2.y = tmp.y
                        tracker.draw2.scale = tmp.scale
                        textManager.showText(player.x, player.y, 30, 0.15, 1850, 'KBSyncHit', '#7289DA', 2);
                        return "insta them"
                    }
                    if ((UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) <= tmp.scale + player.scale) && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && !traps.inTrap) {
                        tracker.draw2.active = true
                        tracker.draw2.x = tmp.x
                        tracker.draw2.y = tmp.y
                        tracker.draw2.scale = tmp.scale
                        textManager.showText(player.x, player.y, 30, 0.15, 1850, 'KBSyncHit', '#7289DA', 2);
                        return "insta them"
                    }
                    if ((UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) > tmp.scale + player.scale && UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) <= tmp.scale + player.scale + barbarianKnockback) && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && !traps.inTrap) {
                        buyEquip(0, 0);
                        barbKbPredict = true;
                        tracker.draw2.active = true
                        tracker.draw2.x = tmp.x
                        tracker.draw2.y = tmp.y
                        tracker.draw2.scale = tmp.scale
                    }
                }
            }
        } else {
            tracker.draw2.active = false
            barbKbPredict = false;
            KBIndc = {
                x0: 0,
                y0: 0,
                x1: 0,
                y1: 0,
                instax: 0,
                instay: 0,
                turretx: 0,
                turrety: 0
            }
        }
        return false
    }
    // ADD NEW PLAYER:
    function addPlayer(data, isYou) {
        let tmpPlayer = findPlayerByID(data[0]);
        if (!tmpPlayer) {
            tmpPlayer = new Player(data[0], data[1], config, UTILS, projectileManager,
                                   objectManager, players, ais, items, hats, accessories);
            players.push(tmpPlayer);
            if (data[1] != playerSID) {
                addMenuChText(null, `Found ${data[2]} {${data[1]}}`, "lime");
            }
        } else {
            if (data[1] != playerSID) {
                addMenuChText(null, `Found ${data[2]} {${data[1]}}`, "lime");
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
            if (player.skins[7]) {
                my.reSync = true;
            }
        }
    }
    // REMOVE PLAYER:
    function removePlayer(id) {
        for (let i = 0; i < players.length; i++) {
            if (players[i].id == id) {
                addMenuChText("Game", players[i].name + "[" + players[i].sid + "] left the game", "red");
                players.splice(i, 1);
                break;
            }
        }
    }
    function hitBull(angle, turret) {
        instaC.isTrue = true;
        realDir(2);
        if (angle == near.aim2) {
            my.autoAim = true;
            game.tickBase(() => {
                my.autoAim = false;
            }, 2);
        } else {
            packet("D", angle, 1, "hitBull");
        }
        selectWeapon(player.primaryIndex);
        if (player.tailIndex == 11) {
            buyEquip(19, 1);
        } else {
            buyEquip(7, 0);
        }
        sendAutoGather();
        if (!turret) {
            game.tickBase(() => {
                sendAutoGather();
                instaC.isTrue = false;
            }, 1);
        } else {
            game.tickBase(() => {
                sendAutoGather();
                packet("D", angle, 1, "hitBull");
                buyEquip(53, 0);
                game.tickBase(() => {
                    instaC.isTrue = false;
                }, 1);
            }, 1);
        }
    }

    // UPDATE HEALTH:
    // UPDATE HEALTH:
    let antiinsta = true;
    let antiinsta1 = false;
    // UPDATE HEALTH:
    function updateHealth(xx0xx,xx1xx){var _x00x=findPlayerBySID(xx0xx);if(_x00x){_x00x.oldHealth=_x00x.health;_x00x.health=xx1xx;_x00x.judgeShame();if(_x00x.oldHealth>_x00x.health){_x00x.timeDamaged=Date.now();_x00x.damaged=_x00x.oldHealth-_x00x.health;var xx2xx=_x00x.damaged;_x00x=findPlayerBySID(xx0xx);var _x01x=false;if(_x00x.health<=0){if(!_x00x.death){_x00x.death=true;try{g3({x:_x00x.x,y:_x00x.y,dir:_x00x.dir,weaponIndex:_x00x.weaponIndex,buildIndex:_x00x.buildIndex,scale:_x00x.scale,skinRot:0},6,0.08,_x00x.skinIndex||0,13,0,0,_x00x.positions||{})}catch(xx3xx){}if(_x00x!=player){if(_x00x.skinIndex==45){addMenuChText("Game",`${_x00x.name}[${_x00x.sid}] has died due to clown`,"red")}else if(_x00x.shameCount>=5){addMenuChText("Game",`${_x00x.name}[${_x00x.sid}] has died due to high shame`,"red")}else{addMenuChText("Game",`${_x00x.name}[${_x00x.sid}] has died`,"red")}}addDeadPlayer(_x00x)}}if(_x00x==player){if(_x00x.skinIndex==7&&(xx2xx==5||(_x00x.latestTail==13&&xx2xx==2))){if(my.reSync){my.reSync=false;_x00x.setBullTick=true}_x01x=true}if(_x00x.oldHealth<25&&_x00x.oldHealth>15){player.chat.message="Insta Detect Test";player.chat.count=1000;buyEquip(22,0);place(0,getAttackDir());setTimeout(()=>{place(getAttackDir())},170)}if(_x00x.oldHealth<55&&_x00x.oldHealth>40){player.chat.message="Pol Detect Test";player.chat.count=1000;buyEquip(22,0);place(0,getAttackDir());setTimeout(()=>{place(0,getAttackDir())},170)}var xx4xx=100-player.health;if(near.primaryIndex==5&&near.secondaryIndex==10&&traps.inTrap&&xx4xx>=10&&near.reloads[near.primaryIndex]==0){healer(antirev);buyEquip(6,0)}var xx5xx=[0.25,0.45].map((xx6xx)=>xx6xx*items.weapons[player.weapons[0]].dmg*soldierMult());var xx7xx=enemy.length?!_x01x&&(xx5xx.includes(xx2xx)&&near.skinIndex==11):false;var xx8xx=function(xx9xx,_x02x){if(!_x02x)setTimeout(()=>healer(),xx9xx);else game.tickBase(()=>healer(),2)};var _x03x=140-window.pingTime;if([void 0,5].includes(near.primaryIndex)){if(near.secondaryIndex==10){if(xx4xx>=(xx7xx?10:20)&&_x00x.damageThreat+xx4xx>=80&&_x00x.shameCount<6){healer(antirev)}else{xx8xx(_x03x)}}else if(near.primaryVariant>=2||near.primaryVariant==void 0){if(xx4xx>=(xx7xx?15:20)&&_x00x.damageThreat+xx4xx>=50&&_x00x.shameCount<6){healer()}else{xx8xx(_x03x)}}else if([void 0||15].includes(near.secondaryIndex)){if(xx2xx>(xx7xx?8:20)&&player.damageThreat>=25&&(game.tick-player.antiTimer)>1){if(_x00x.shameCount<5){healer()}else{xx8xx(_x03x)}}else{xx8xx(_x03x)}}else if([9,12,13].includes(near.secondaryIndex)){if(xx4xx>=25&&player.damageThreat+xx4xx>=70&&_x00x.shameCount<6){healer()}else{xx8xx(_x03x)}}else{if(xx2xx>25&&player.damageThreat+xx4xx>=95){healer()}else{xx8xx(_x03x)}}}var _x04x=true;var _x05x=false;var _x06x=true;function _x07x(_x08x){return _x08x*0.01745329251}if(inGame){var _x09x=getAttacker(xx2xx);var xx5xx=[0.25,0.45].map((xx6xx)=>xx6xx*items.weapons[player.weapons[0]].dmg);var xx7xx=near.length?!_x01x&&(xx5xx.includes(xx2xx)&&near[0].skinIndex==11&&near[0].tailIndex==21):false;var _x03x=140-window.ping;var xx8xx=function(xx9xx){setTimeout(()=>{healer()},xx9xx)};if(xx2xx>=0&&xx2xx<=66&&player.shameCount===4&&player.shameCount===4&&_x00x.primaryIndex!=="4"){_x05x=true;antiinsta=false;antiinsta1=false;_x06x=false}else{if(player.shameCount!==4){_x05x=false;antiinsta=true;_x06x=true}}if(xx2xx<=66&&player.shameCount===3&&_x00x.primaryIndex!=="4"){antiinsta=false}else{if(player.shameCount!==3){antiinsta=true}}if(xx2xx<=66&&player.shameCount===4&&_x00x.primaryIndex!=="4"){antiinsta1=true}else{if(player.shameCount!==4){antiinsta1=false}}if(xx2xx<=66&&player.skinIndex!=6&&enemy.weaponIndex===4){game.tickBase(()=>{_x0ax()},2)}function _x0ax(){place(0,getAttackDir());return Math.ceil((100-player.health)/items.list[player.items[0]].healing)}var xx4xx=100-player.health;if(xx2xx>=(xx7xx?8:20)&&_x00x.damageThreat>=20&&_x06x&&(game.tick-_x00x.antiTimer)>1){if(_x00x.reloads[53]==0&&_x00x.reloads[_x00x.weapons[1]]==0){_x00x.canEmpAnti=true}else{player.soldierAnti=true}_x00x.antiTimer=game.tick;var _x0bx=_x00x.weapons[0]==4?2:5;if(_x00x.shameCount<_x0bx){healer()}else{game.tickBase(()=>{healer()},2)}if(xx2xx>=(xx7xx?8:20)&&_x00x.damageThreat>=20&&_x05x){setTimeout(()=>{healer()},120)}var xx4xx=100-player.health;if(xx2xx>=(xx7xx?8:20)&&_x00x.damageThreat>=20&&antiinsta&&_x00x.primaryIndex!=="4"&&(game.tick-_x00x.antiTimer)>1){if(_x00x.reloads[53]==0&&_x00x.reloads[_x00x.weapons[1]]==0){_x00x.canEmpAnti=true}else{player.soldierAnti=true}_x00x.antiTimer=game.tick;var _x0bx=_x00x.weapons[0]==4?2:5;if(_x00x.shameCount<_x0bx){healer()}else{game.tickBase(()=>{healer()},2)}}if(near.dist2<220&&!traps.inTrap&&!traps.breakshit&&xx2xx>=30&&xx2xx<=55&&![30,26,25,34,50].includes(xx2xx)&&[6,7].includes(player.skinIndex)&&player.tailIndex==21&&near.primaryIndex!=5&&player.shameCount<=4&&[7,5,3,6,4].includes(player.weapons[0])){instaC.canCounter=true}}else{game.tickBase(()=>{healer()},2)}}if(xx2xx>=20&&player.skinIndex==11)instaC.canCounter=true}else{if(!_x00x.setPoisonTick&&(_x00x.damaged==5||(_x00x.latestTail==13&&_x00x.damaged==2))){_x00x.setPoisonTick=true}}}}}
    // UPDATE HEALTH:
    // KILL PLAYER:
    function killPlayer() {
        inGame = false;
        lastDeath = {
            x: player.x,
            y: player.y,
        };
        if (configs.autoRespawn) {
            getEl("diedText").style.display = "none";
            packet("M", {
                name: lastsp[0],
                moofoll: lastsp[1],
                skin: lastsp[2]
            });
        }
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
                if (items.weapons[i].age == age && (items.weapons[i].pre == undefined || player.weapons.indexOf(items.weapons[i].pre) >= 0)) {
                    let e = UTILS.generateElement({
                        id: "upgradeItem" + i,
                        class: "actionBarItem",
                        onmouseout: function() {
                            showItemInfo();
                        },
                        parent: upgradeHolder
                    });
                    e.style.backgroundImage = getEl("actionBarItem" + i).style.backgroundImage;
                    tmpList.push(i);
                }
            }
            for (let i = 0; i < items.list.length; ++i) {
                if (items.list[i].age == age && (items.list[i].pre == undefined || player.items.indexOf(items.list[i].pre) >= 0)) {
                    let tmpI = (items.weapons.length + i);
                    let e = UTILS.generateElement({
                        id: "upgradeItem" + tmpI,
                        class: "actionBarItem",
                        onmouseout: function() {
                            showItemInfo();
                        },
                        parent: upgradeHolder
                    });
                    e.style.backgroundImage = getEl("actionBarItem" + tmpI).style.backgroundImage;
                    tmpList.push(tmpI);
                }
            }
            for (let i = 0; i < tmpList.length; i++) {
                (function(i) {
                    let tmpItem = getEl('upgradeItem' + i);
                    tmpItem.onclick = UTILS.checkTrusted(function() {
                        packet("H", i);
                    });
                    UTILS.hookTouchEvents(tmpItem);

                    if (configs.autoUpgrade) {
                        let parsedInt = parseInt(configs.autoUpgrade);

                        if (tmpList.length == 1) {
                            packet("H", i);
                        } else if (["17", "31", "23", parsedInt].find(e => tmpItem.id.includes(e))) {
                            packet("H", i);
                        }
                    }
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
    function shitassAutismBreakObjects(findObj, sid) {

        let i = 0;
        while (i < breakObjects.length) {
            if (breakObjects[i].sid === sid) {
                breakObjects.splice(i, 1);
                break;
            } else {
                i++;
            }
        }
        if (!player.canSee(findObj)) {
            breakTrackers.push({
                x: findObj.x,
                y: findObj.y
            });
        }
        if (breakTrackers.length >= 10) {
            breakTrackers.shift();
        }
    }
    const placedSpikePositions = new Set();

    let safeShitASPNow = false;
    function tryisantinowmaybeHealingtoo() {
        my.anti0Tick = player.skinIndex !== 6 ? 2 : 1;
        if (tmpObj.shameCount < 5) {
            if (game.tick - player.antiTimer > 1) {
                tmpObj.antiTimer = game.tick;
                healer();
            } else {
                healer();
            }
        }

        game.tickBase(() => {
            if (safeShitASPNow) {
                safeShitASPNow = false;
            }
        },1);
    }
    // KILL OBJECT:
    function killObject(sid) {
        let findObj = findObjectBySid(sid);
        if (player&&findObj) {
            for (let i = 0; i < breakObjects.length; i++) {
                if (breakObjects[i].sid == sid) {
                    breakObjects.splice(i, 1);
                    break;
                }
            }
            if (!player.canSee(findObj)) {
                breakTrackers.push({
                    x: findObj.x,
                    y: findObj.y
                });
            }
            if (breakTrackers.length > 8) {
                breakTrackers.shift();
            }
            traps.replacer(findObj);
        }
        objectManager.disableBySid(sid);
    }

    // KILL ALL OBJECTS BY A PLAYER:
    function killObjects(sid) {
        if (player) objectManager.removeAllItems(sid);
    }
    function setTickout(doo, timeout) {
        if (!ticks.manage[ticks.tick + timeout]) {
            ticks.manage[ticks.tick + timeout] = [doo];
        } else {
            ticks.manage[ticks.tick + timeout].push(doo);
        }
    }

    function caf(e, t) {
        try {
            return Math.atan2((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
        } catch (e) {
            return 0;
        }
    }

    let found = false;
    let autoQ = false;

    let autos = {
        insta: {
            todo: false,
            wait: false,
            count: 4,
            shame: 5
        },
        bull: false,
        antibull: 0,
        reloaded: false,
        stopspin: true
    }
    var canAppleTick = new class {
        weaponDmg(_, near, sold = 1, bull = 1) {
            const { primaryVariant: v, weapons: [weapon] } = _;
            const pV = v ? config.weaponVariants[v].val : 1;
            const soldMult = (near && sold && near.skinIndex === 6) ? 0.75 : 1;
            const bullMult = (bull && _.skins[7]) ? 1.5 : 1;

            return items.weapons[weapon].dmg * bullMult * pV * soldMult;
        }

        canLastHit(near, trap) {
            let health = this.weaponDmg(player, near, true, true);
            return trap.health <= health;
        }

        fullReloaded() {
            return player.reloads[player.primaryIndex] == 0 && player.reloads[player.secondaryIndex] == 0 && player.reloads[53] == 0;
        }

        run() {
            if (!enemy.length || !near) return;

            let trap = gameObjects.filter(cd => cd.trap && cd.active && UTILS.getDist(cd, player, 0, 2) <= player.scale + cd.getScale() + 5 && !cd.isTeamObject(player)).sort(function (cd, ck) {
                return UTILS.getDist(cd, player, 0, 2) - UTILS.getDist(ck, player, 0, 2);
            })[0];

            if (!trap) return;

            if (near.dist2 <= near.scale + 75 && player.weapons[1] == 10 && (player.primaryIndex == 4 || player.primaryIndex == 5)) {
                if (this.canLastHit(near, trap)) {
                    if (this.fullReloaded() && (this.player.skins[7] && this.player.skins[40])) {
                        sendAutoGather();
                        buyEquip(40, 0);
                        selectWeapon(player.weapons[1]);

                        game.tickBase(() => {
                            buyEquip(7, 0);
                            selectWeapon(player.weapons[0]);

                            game.tickBase(() => {
                                buyEquip(53, 0);
                                sendAutoGather();
                            }, 1);
                        }, 1);
                        sendChat("shitty on worked trapticked");
                    }
                }
            }
        }
    }();

    // UPDATE PLAYER DATA:
    let AutoOneTicked = false;
    function updatePlayers(data) {
        // if(player.shameCount > 0) {
        //     my.reSync = true;
        // } else {
        //     my.reSync = false;
        // }

        // let movementPrediction = {
        //     x: player.x2 + (player.oldPos.x2 - player.x2) * -1,
        //     y: player.y2 + (player.oldPos.y2 - player.y2) * -1,
        // }

        //     let potentialzpiketick = liztobj.filter((e) => e.active && e.dmg)

        //     potentialzpiketick.forEach((obj) => {
        //         if(cdf(obj, player) <= 200) {
        //             packet('a', undefined);
        //         }
        //     })

        // let newPos = {
        //     x: player.x2 + (tracker.lastPos.x - player.x2) * -1,
        //     y: player.y2 + (tracker.lastPos.y - player.y2) * -1,
        // }

        function getAngleDifference(angle1, angle2) {
            // Normalize the angles to be between 0 and 2π
            angle1 = angle1 % (2 * Math.PI);
            angle2 = angle2 % (2 * Math.PI);

            // Calculate the absolute difference between the angles
            let diff = Math.abs(angle1 - angle2);

            // Adjust the difference to be between 0 and π
            if (diff > Math.PI) {
                diff = (2 * Math.PI) - diff;
            }

            return diff;
        }

        //     function smartMove(oneTickMove) {
        //         let dir = player.moveDir;

        //         let found = false
        //         let buildings = liztobj.sort((a, b) => Math.hypot(player.y2 - a.y, player.x2 - a.x) - Math.hypot(player.y2 - b.y, player.x2 - b.x))
        //         let spikes = buildings.filter(obj => obj.dmg && cdf(player, obj) < 250 && !obj.isTeamObject(player) && obj.active)

        //         let newPos = {
        //             x: player.x2 + (player.x2 - player.oldPos.x2) * 1.2 + (Math.cos(dir) * 50),
        //             y: player.y2 + (player.y2 - player.oldPos.y2) * 1.2 + (Math.sin(dir) * 50),
        //         }

        //         for (let i = 0; i < spikes.length; i++) {
        //             if (cdf(spikes[i], newPos) < spikes[i].scale + player.scale + 3) {
        //                 found = Math.atan2(player.y2 - spikes[i].y, player.x2 - spikes[i].x)
        //             }
        //         }





        //         if (found != false && !traps.inTrap) {
        //             packet("a", undefined);
        //         } else {
        //             packet("a", dir);
        //         }
        //         player.oldPos.x2 = player.x2;
        //         player.oldPos.y2 = player.y2;
        //     }
        //     function detectEnemySpikeCollisions(tmpObj) {
        //         let buildings = liztobj.sort((a, b) => Math.hypot(tmpObj.y - a.y, tmpObj.x - a.x) - Math.hypot(tmpObj.y - b.y, tmpObj.x - b.x));
        //         let spikes = buildings.filter(obj => obj.dmg && cdf(player, obj) < 200 && !obj.isTeamObject(player) && obj.active);
        //         //here you calculate last vel / delta, add that to current pos, if touch spike do the heh
        //         let enemy = {
        //             // x: tmpObj.x + (player.oldPos.x2 - tmpObj.x) * -2,
        //             // y: tmpObj.y + (player.oldPos.y2 - tmpObj.y) * -2,
        //             x: player.x2 + (player.oldPos.x2 - player.x2) * -1,
        //             y: player.y2 + (player.oldPos.y2 - player.y2) * -1,
        //         }
        //         let found = false;
        //         for (let i = 0; i < spikes.length; i++) {
        //             if (cdf(enemy, spikes[i]) < player.scale + spikes[i].scale) {
        //                 found = true;
        //             }
        //         }

        //         // player.oldPos.x2 = tmpObj.x2;
        //         // player.oldPos.y2 = tmpObj.y2;
        //     }
        game.tick++;
        enemy = [];
        nears = [];
        near = [];
        game.tickSpeed = performance.now() - game.lastTick;
        game.lastTick = performance.now();
        players.forEach((tmp) => {
            tmp.forcePos = !tmp.visible;
            tmp.visible = false;
            if((tmp.timeHealed - tmp.timeDamaged)>0 && tmp.lastshamecount<tmp.shameCount)
                tmp.pinge = (tmp.timeHealed - tmp.timeDamaged);
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

                botSkts.forEach((bot) => {
                    bot.showName = 'YEAHHH'
                })

                for(let i = 0; i < players.length; i++) {
                    for(let aa = 0; aa < botSkts.length; aa++) {
                        if(player.id === aa.id) aa.showName = 'YEAHHHHHH'

                    }
                }

                if (player.shameCount < 4 && near.dist3 <= 30 && near.reloads[near.primaryIndex] <= game.tickRate * (window.pingTime >= 200 ? 2 : 1)) {
                    autoQ = true;
                    healer();
                } else {
                    if (autoQ) {
                        healer();
                    }
                    autoQ = false;
                }


                if (tmpObj == player) {
                    if (liztobj.length) {
                        liztobj.forEach((tmp) => {
                            tmp.onNear = false;
                            if (tmp.active) {
                                if (!tmp.onNear && UTILS.getDist(tmp, tmpObj, 0, 2) <= tmp.scale + items.weapons[tmpObj.weapons[0]].range) {
                                    tmp.onNear = true;
                                }
                                if (tmp.isItem && tmp.owner) {
                                    if (!tmp.pps && tmpObj.sid == tmp.owner.sid && UTILS.getDist(tmp, tmpObj, 0, 2) > (parseInt(getEl("breakRange").value) || 0) && !tmp.breakObj && ![13, 14, 20].includes(tmp.id)) {
                                        tmp.breakObj = true;
                                        breakObjects.push({
                                            x: tmp.x,
                                            y: tmp.y,
                                            sid: tmp.sid
                                        });
                                    }
                                }
                            }
                        });
                        let nearTrap = liztobj.filter(e => e.trap && e.active && UTILS.getDist(e, tmpObj, 0, 2) <= (tmpObj.scale + e.getScale() + 5) && !e.isTeamObject(tmpObj)).sort(function (a, b) {
                            return UTILS.getDist(a, tmpObj, 0, 2) - UTILS.getDist(b, tmpObj, 0, 2);
                        })[0];
                        if (nearTrap) {
                            traps.dist = UTILS.getDist(nearTrap, tmpObj, 0, 2);

                            let spike = liztobj.filter(
                                obj =>
                                (obj.dmg) &&
                                UTILS.getDist(obj, nearTrap, 0, 0) < nearTrap.scale + obj.scale + 5 &&
                                !obj.isTeamObject(tmpObj) &&
                                obj.active
                            )[0];

                            traps.aim = UTILS.getDirect(spike ? spike : nearTrap, tmpObj, 0, 2);

                            if (!traps.inTrap) {
                                traps.protect(UTILS.getDirect(nearTrap, tmpObj, 0, 2));
                            }
                            traps.inTrap = true;
                            traps.info = nearTrap;
                        } else {
                            traps.inTrap = false;

                            let tpshit = liztobj.filter(e => (e.teleport || e.dmg) && e.active &&
                                                        UTILS.getDist(e, tmpObj, 0, 2) <= items.weapons[player.weapons[1] === 10 ? traps.notFast() ? player.weapons[1] : player.weapons[0] : player.weapons[0]].range + (tmpObj.scale + e.getScale() + 5)
                                                        && !e.isTeamObject(tmpObj)).sort(function (a, b) {
                                return UTILS.getDist(a, tmpObj, 0, 2) - UTILS.getDist(b, tmpObj, 0, 2);
                            })[0];
                            if (tpshit) {
                                traps.dist = UTILS.getDist(tpshit, tmpObj, 0, 2);
                                traps.aim = UTILS.getDirect(tpshit, tmpObj, 0, 2);
                                traps.breakshit = true;
                                traps.info = tpshit;
                            } else {
                                traps.breakshit = false;
                                traps.info = {};
                            }
                        }
                    } else {
                        traps.inTrap = false;
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
                textManager.showText(pos2.x, pos2.y, Math.max(45, Math.min(50, num2)), 0.18, 500, num2, "#FF0000");
            }
            if (num > 0) {
                textManager.showText(pos.x, pos.y, Math.max(45, Math.min(50, num)), 0.18, 500, num, "#fff");
            }
            textManager.stack = [];
        }
        if (runAtNextTick.length) {
            runAtNextTick.forEach((tmp) => {
                checkProjectileHolder(...tmp);
            });
            runAtNextTick = [];
        }
        for (let i = 0; i < data.length;) {
            tmpObj = findPlayerBySID(data[i]);
            if (tmpObj) {
                if (!tmpObj.isTeam(player)) {
                    enemy.push(tmpObj);
                    if (tmpObj.dist2 <= items.weapons[tmpObj.primaryIndex == undefined ? 5 : tmpObj.primaryIndex].range + (player.scale * 2)) {
                        nears.push(tmpObj);
                    }
                }
                tmpObj.manageReload();
                if (tmpObj != player) {
                    tmpObj.addDamageThreat(player);
                }
            }
            i += 13;
        }
        /*projectiles.forEach((proj) => {
                    tmpObj = proj;
                    if (tmpObj.active) {
                        tmpObj.tickUpdate(game.tickSpeed);
                    }
                });*/
        if (player && player.alive) {
            if (enemy.length) {
                near = enemy.sort(function(tmp1, tmp2) {
                    return tmp1.dist2 - tmp2.dist2;
                })[0];
            } else {
                // console.log("no enemy");
            }
            if (game.tickQueue[game.tick]) {
                game.tickQueue[game.tick].forEach((action) => {
                    action();
                });
                game.tickQueue[game.tick] = null;
            }
            if (advHeal.length) {
                advHeal.forEach((updHealth) => {
                    if (window.pingTime < 130) {
                        let sid = updHealth[0];
                        let value = updHealth[1];
                        let totalDamage = 85 - value
                        let damaged = updHealth[2];
                        tmpObj = findPlayerBySID(sid);
                        let bullTicked = false;
                        if (tmpObj == player) {
                            if (tmpObj.skinIndex == 7 && (damaged == 5 || (tmpObj.latestTail == 13 && damaged == 2))) {
                                if (my.reSync) {
                                    my.reSync = false;
                                    tmpObj.setBullTick = true;
                                }
                                bullTicked = true;
                            }
                            if (inGame) {
                                let attackers = getAttacker(damaged);
                                let gearDmgs = [0.25, 0.45].map((val) => val * items.weapons[player.weapons[0]].dmg * soldierMult());
                                let includeSpikeDmgs = enemy.length ? !bullTicked && (gearDmgs.includes(damaged) && near.skinIndex == 11) : false;
                                let healTimeout = 150 - window.pingTime;
                                let dmg = 250 - player.health;
                                let slowHeal = function (timer, tickBase) {
                                    if (!tickBase) {
                                        setTimeout(() => {
                                            healer();
                                        }, timer);
                                    } else {
                                        game.tickBase(() => {
                                            healer()
                                        }, 2)
                                    }
                                }
                                if (getEl("healingBeta").checked) {
                                    if (enemy.length) {
                                        if ([0, 7, 8].includes(near.primaryIndex)) {
                                            if (damaged < 550) {
                                                slowHeal(healTimeout)
                                            } else {
                                                healer()
                                            }
                                        }
                                        if ([0, 2, 6].includes(near.primaryIndex)) {
                                            if (damaged >= 125 && player.damageThreat + dmg >= 195 && tmpObj.shameCount < 4) {
                                                healer()
                                            } else {
                                                slowHeal(healTimeout)
                                            }
                                        }
                                        if (near.primaryIndex == 3) {
                                            if (near.secondaryIndex == 15) {
                                                if (near.primaryVariant < 2) {
                                                    if (damaged >= 135 && player.damageThreat + dmg >= 195 && tmpObj.shameCount < 5 && game.tick - player.antiTimer > 1) {
                                                        tmpObj.canEmpAnti = true
                                                        tmpObj.antiTimer = game.tick
                                                        healer()
                                                    } else {
                                                        slowHeal(healTimeout)
                                                    }
                                                } else {
                                                    if (damaged > 135 && player.damageThreat + dmg >= 95 && tmpObj.shameCount < 5 && game.tick - player.antiTimer > 1) {
                                                        tmpObj.canEmpAnti = true
                                                        tmpObj.antiTimer = game.tick
                                                        healer()
                                                    } else {
                                                        slowHeal(healTimeout)
                                                    }
                                                }
                                            } else {
                                                if (damaged >= 25 && player.damageThreat + dmg >= 95 && tmpObj.shameCount < 4) {
                                                    healer()
                                                } else {
                                                    slowHeal(healTimeout)
                                                }
                                            }
                                        }
                                        if (near.primaryIndex == 4) {
                                            if (near.primaryVariant >= 1) {
                                                if (damaged >= 110 && player.damageThreat + dmg >= 195 && tmpObj.shameCount < 4) {
                                                    healer()
                                                } else {
                                                    slowHeal(healTimeout)
                                                }
                                            } else {
                                                if (damaged >= 315 && player.damageThreat + dmg >= 915 && tmpObj.shameCount < 3) {
                                                    healer()
                                                } else {
                                                    slowHeal(healTimeout)
                                                }
                                            }
                                        }
                                        if ([undefined, 5].includes(near.primaryIndex)) {
                                            if (near.secondaryIndex == 10) {
                                                if (dmg >= (includeSpikeDmgs ? 101 : 20) && tmpObj.damageThreat + dmg >= 180 && tmpObj.shameCount < 6) {
                                                    healer()
                                                } else {
                                                    slowHeal(healTimeout)
                                                }
                                            } else
                                                if (near.primaryVariant >= 2 || near.primaryVariant == undefined) {
                                                    if (dmg >= (includeSpikeDmgs ? 115 : 20) && tmpObj.damageThreat + dmg >= 50 && tmpObj.shameCount < 6) {
                                                        healer()
                                                    } else {
                                                        slowHeal(healTimeout)
                                                    }
                                                } else
                                                    if ([undefined || 15].includes(near.secondaryIndex)) {
                                                        if (damaged > (includeSpikeDmgs ? 8 : 20) && player.damageThreat >= 25 && (game.tick - player.antiTimer) > 1) {
                                                            if (tmpObj.shameCount < 5) {
                                                                healer()
                                                            } else {
                                                                slowHeal(healTimeout)
                                                            }
                                                        } else {
                                                            slowHeal(healTimeout)
                                                        }
                                                    } else
                                                        if ([9, 12, 13].includes(near.secondaryIndex)) {
                                                            if (dmg >= 215 && player.damageThreat + dmg >= 170 && tmpObj.shameCount < 6) {
                                                                healer()
                                                            } else {
                                                                slowHeal(healTimeout)
                                                            }
                                                        } else {
                                                            if (damaged > 25 && player.damageThreat + dmg >= 95) {
                                                                healer()
                                                            } else {
                                                                slowHeal(healTimeout)
                                                            }
                                                        }
                                        }
                                        if (near.primaryIndex == 6) {
                                            if (near.secondaryIndex == 15) {
                                                if (damaged >= 25 && tmpObj.damageThreat + dmg >= 95 && tmpObj.shameCount < 4) {
                                                    healer()
                                                } else {
                                                    slowHeal(healTimeout)
                                                }
                                            } else {
                                                if (damaged >= 70 && tmpObj.shameCount < 4) {
                                                    healer()
                                                } else {
                                                    slowHeal(healTimeout)
                                                }
                                            }
                                        }
                                        if (damaged >= 30 && near.reloads[near.secondaryIndex] == 0 && near.dist2 <= 150 && player.skinIndex == 11 && player.tailIndex == 21) instaC.canCounter = true
                                    } else {
                                        if (damaged >= 70) {
                                            healer()
                                        } else {
                                            slowHeal(healTimeout)
                                        }
                                    }
                                } else {
                                    if (damaged >= (includeSpikeDmgs ? 8 : 25) && dmg + player.damageThreat >= 80 && (game.tick - player.antiTimer) > 1) {
                                        if (tmpObj.reloads[53] == 0 && tmpObj.reloads[tmpObj.weapons[1]] == 0) {
                                            tmpObj.canEmpAnti = true;
                                        } else {
                                            player.soldierAnti = true;
                                        }
                                        tmpObj.antiTimer = game.tick;
                                        let shame = [0, 4, 6, 7, 8].includes(near.primaryIndex) ? 2 : 5;
                                        if (tmpObj.shameCount < shame) {
                                            healer();
                                        } else {
                                            if (near.primaryIndex == 7 || (player.weapons[0] == 7 && (near.skinIndex == 11 || near.tailIndex == 21))) {
                                                slowHeal(healTimeout)
                                            } else {
                                                slowHeal(healTimeout, 1)
                                            }
                                        }
                                    } else {
                                        if (near.primaryIndex == 7 || (player.weapons[0] == 7 && (near.skinIndex == 11 || near.tailIndex == 21))) {
                                            slowHeal(healTimeout)
                                        } else {
                                            slowHeal(healTimeout, 1)
                                        }
                                    }
                                    if (damaged >= 25 && near.dist2 <= 140 && player.skinIndex == 11 && player.tailIndex == 21) instaC.canCounter = true
                                }
                            } else {
                                if (!tmpObj.setPoisonTick && (tmpObj.damaged == 5 || (tmpObj.latestTail == 13 && tmpObj.damaged == 2))) {
                                    tmpObj.setPoisonTick = true;
                                }
                            }
                        }
                    } else {
                        let [sid, value, damaged] = updHealth;
                        let totalDamage = 100 - value;
                        let tmpObj = findPlayerBySID(sid);
                        let bullTicked = false;

                        if (tmpObj == player) {
                            if (tmpObj.skinIndex == 7 && (damaged == 5 || (tmpObj.latestTail == 13 && damaged == 2))) {
                                if (my.reSync) {
                                    my.reSync = false;
                                    tmpObj.setBullTick = true;
                                    bullTicked = true;
                                }
                            }
                            if (inGame) {
                                let attackers = getAttacker(damaged);
                                let gearDmgs = [0.25, 0.45].map((val) => val * items.weapons[player.weapons[0]].dmg * soldierMult());
                                let includeSpikeDmgs = enemy.length ? !bullTicked && (gearDmgs.includes(damaged) && near.skinIndex == 11) : false;
                                let healTimeout = 60;
                                let dmg = 100 - player.health;
                                let shameCountThreshold = [2, 5][[0, 4, 6, 7, 8].includes(near.primaryIndex) ? 0 : 1];

                                let slowHeal = function (timer, tickBase) {
                                    if (!tickBase) setTimeout(() => healer(), timer);
                                    else game.tickBase(() => healer(), 2);
                                };

                                if (getEl("healingBeta").checked) {
                                    let canHealFast = [0, 7, 8].includes(near.primaryIndex) ? damaged < 75 :
                                    [1, 2, 6].includes(near.primaryIndex) ? damaged >= 25 && player.damageThreat + dmg >= 95 && tmpObj.shameCount < 5 :
                                    [undefined, 5].includes(near.primaryIndex) ? dmg >= (includeSpikeDmgs ? 15 : 20) && tmpObj.damageThreat + dmg >= 50 && tmpObj.shameCount < 6 :
                                    near.primaryIndex == 3 && near.secondaryIndex == 15 ? damaged >= 35 && player.damageThreat + dmg >= 95 && tmpObj.shameCount < 5 && game.tick - player.antiTimer > 1 :
                                    near.primaryIndex == 4 ? near.primaryVariant >= 1 ? damaged >= 10 && player.damageThreat + dmg >= 95 && tmpObj.shameCount < 4 :
                                    damaged >= 35 && player.damageThreat + dmg >= 95 && tmpObj.shameCount < 3 :
                                    near.primaryIndex == 6 && near.secondaryIndex == 15 ? damaged >= 25 && tmpObj.damageThreat + dmg >= 95 && tmpObj.shameCount < 4 :
                                    damaged >= 25 && player.damageThreat + dmg >= 95;

                                    canHealFast ? healer() : slowHeal(healTimeout);
                                } else {
                                    let canHealFast = damaged >= (includeSpikeDmgs ? 8 : 25) && dmg + player.damageThreat >= 80 && (game.tick - player.antiTimer) > 1;

                                    if (canHealFast) {
                                        if (tmpObj.reloads[53] == 0 && tmpObj.reloads[tmpObj.weapons[1]] == 0) tmpObj.canEmpAnti = true;
                                        else player.soldierAnti = true;
                                        tmpObj.antiTimer = game.tick;
                                        if (tmpObj.shameCount < shameCountThreshold) healer();
                                        else slowHeal(healTimeout, near.primaryIndex == 7 || (player.weapons[0] == 7 && (near.skinIndex == 11 || near.tailIndex == 21)) ? 0 : 1);
                                    } else {
                                        slowHeal(healTimeout, near.primaryIndex == 7 || (player.weapons[0] == 7 && (near.skinIndex == 11 || near.tailIndex == 21)) ? 0 : 1);
                                    }
                                }
                            } else {
                                if (!tmpObj.setPoisonTick && (tmpObj.damaged == 5 || (tmpObj.latestTail == 13 && tmpObj.damaged == 2))) {
                                    tmpObj.setPoisonTick = true;
                                }
                            }
                        }
                    }
                });
                advHeal = [];
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
                if (tmp.setBullTick) {
                    tmp.bullTimer = 0;
                }
                if (tmp.setPoisonTick) {
                    tmp.poisonTimer = 0;
                }
                tmp.updateTimer();
            });
            if (!instaC.isTrue && configs.predictTick && my.anti0Tick <= 0) {
                let spikeSync = knockBackPredict()
                if (spikeSync == "insta them" && (![9, 12, 13, 15].includes(player.weapons[1]) || near.dist2 <= items.weapons[player.weapons[1]].range + player.scale * 1.8)) {
                    instaC.changeType(configs.revTick || player.weapons[1] == 10 ? "rev" : "normal");
                }
            }
            let canSyncHit = false;
            if (player.reloads[player.weapons[0]] != 0 || !near?.sid || near.dist2 > items.weapons[player.primaryIndex].range + 63) {
                canSyncHit = false;
            } else if (player.primaryIndex) {
                let _ = near;
                let dmg = 0;
                for (let j = 0; j < players.length; j++) {
                    let tmp = players[j];
                    if (tmp.sid == player.sid || tmp.sid == near.sid || near.team && tmp.team && tmp.team === near.team) {
                        continue;
                    }
                    const tmpPrimary = items.weapons[tmp.primaryIndex];
                    if (tmpPrimary && tmp.antiBull && (UTILS.getDist(tmp, near, 3, 3) <= tmpPrimary.range + 63 || UTILS.getDist(tmp, near, 2, 2) <= tmpPrimary.range + 63)) {
                        dmg += tmpPrimary.dmg * sortWeaponVariant(tmpPrimaryVariant) * 1.5;
                    }
                }
                dmg += items.weapons[player.primaryIndex].dmg * 1.5 * sortWeaponVariant(player.primaryVariant);
                if (dmg * (_.skinIndex == 6 ? 0.75 : 1) >= 100) {
                    canSyncHit = true;
                } else {
                    canSyncHit = false;
                }
            }
            let Synced = false;
            let autosynced = false;
            if (!instaC.isTrue && my.anti0Tick == 0 && canSyncHit && (UTILS.getDist(player, near, 3, 3) <= items.weapons[player.primaryIndex].range + 63 || UTILS.getDist(player, near, 2, 2) <= items.weapons[player.primaryIndex].range + 63)) {
                autosynced = true;
                player.chat.message = "Autosync";
                player.chat.count = 2000;
                hitBull(near.aim2, 0);
            }
            if (inGame) {
                if (enemy.length) {
                    if (player.canEmpAnti) {
                        player.canEmpAnti = false;
                        let urGotAss = 7 || 11 || 40 || 53;
                        if (near.dist2 <= 300 && !my.safePrimary(near) && !my.safeSecondary(near)) {
                            if (near.reloads[53] == 0) {
                                player.empAnti = true;
                                player.soldierAnti = false;
                                if (true) {//anti insta
                                    Hg(22, 21);
                                }
                            } else if (player.skinIndex == urGotAss) {
                                if (near.reloads[53] == 0) {
                                    player.empAnti = true;
                                    player.soldierAnti = false;
                                    if (true) {//anti insta
                                        Hg(22, 21);
                                    }
                                } else {
                                    player.empAnti = true;
                                    player.soldierAnti = false;
                                    if (true) {//anti insta
                                        Hg(6, 21);
                                    }
                                }
                            } else {
                                player.empAnti = false;
                                player.soldierAnti = true;
                                if (true) {//anti rev insta
                                    Hg(6, 21);
                                    setTimeout(() => {
                                        Hg(11, 18);
                                    }, 100);
                                }
                            }
                        }
                    }
                    if (configs.autoQonSync && nears.length > 1 && tmpObj.shameCount < 5 && !nears.some(item => [0, 7, 8, 9].includes(item.primaryIndex)) && secPacket < 40 && player.health < 90) {
                        player.chat.message = `Sync Detect Test ${window.pingTime}ms`;
                        player.chat.count = 1000;
                        tmpObj.canEmpAnti = false
                        healer()
                    }
                    let prehit = gameObjects.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 3) <= (tmp.scale + near.scale)).sort(function (a, b) {
                        return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                    })[0];
                    if (prehit) {
                        if (near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8 && configs.predictTick) {
                            instaC.canSpikeTick = true;
                            instaC.syncHit = true;
                            if (configs.revTick && player.weapons[1] == 15 && player.reloads[53] == 0 && instaC.perfCheck(player, near)) {
                                instaC.revTick = true;
                            }
                        }
                    }
                    if (!my.anti0tick) {
                        let possiblePreHitSync = gameObjects.find(
                            (tmp) =>
                            tmp.dmg &&
                            tmp.active &&
                            !tmp.isTeamObject(player) &&
                            UTILS.getDist(tmp, player, 0, 3) <= tmp.scale + 45
                        );
                        let possibleHitSync = gameObjects.find(
                            (tmp) =>
                            tmp.dmg &&
                            tmp.active &&
                            !tmp.isTeamObject(player) &&
                            UTILS.getDist(tmp, player, 0, 2) <= tmp.scale + 35
                        );
                        if (possibleHitSync && near.sid && near.reloads[near.weaponIndex] == 0 && near.dist2 <= (items.weapons[near.weapons[0]].range + 70) && ([4, 5].includes(near.primaryIndex) || (near.weaponIndex == 3 && (game.tick - player.bullTick) % 9 === 8))) {
                            my.anti0tick = 1;
                            player.chat.message = "Anti Spikesync";
                            player.chat.count = 1500;
                        }
                        if (possiblePreHitSync && near.reloads[near.weaponIndex] <= game.tickRate && near.dist2 <= (items.weapons[near.weapons[0]].range + 100) && ([4, 5].includes(near.primaryIndex) || (near.weaponIndex == 3 && (game.tick - player.bullTick) % 9 === 8))) {
                            my.anti0tick = 1;
                            player.chat.message = "Anti Prehit";
                            player.chat.count = 1500;
                        }
                    }
                    let antiSpikeTick = gameObjects.filter(tmp => tmp.dmg && tmp.active && !tmp.isTeamObject(player) && UTILS.getDist(tmp, player, 0, 3) < (tmp.scale + player.scale)).sort(function (a, b) {
                        return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
                    })[0];
                    if (antiSpikeTick && traps.inTrap) {
                        if (near.dist2 <= items.weapons[5].range + near.scale * 1.8) {
                            my.anti0Tick = 1;
                            player.chat.message = `SpikeTick Threat Blocked [ 4 ] ${window.pingTime}ms`;
                            player.chat.count = 1000;
                        }
                    }
                    if (antiSpikeTick && !traps.inTrap && !traps.breakshit) {
                        if (near.dist2 <= items.weapons[5].range + near.scale * 1.8) {
                            my.anti0Tick = 1;
                            player.chat.message = `SpikeTick Threat Blocked [ 2 ] ${window.pingTime}ms`;
                            player.chat.count = 1000;
                        }
                        else if (!traps.inTrap && !traps.breakshit && near.dist2 <= items.weapons[5].range + (antiSpikeTick.scale * 1.8)) {
                            my.anti0Tick = 1;
                        }
                    }
                }
                if (bianosTick && !traps.inTrap && !traps.breakshit) {
                    instaC.spikeTickType();
                }
                if (near && near.inTrap && player.weapons[1] == 10 && (player.weapons[0] == 3 || player.weapons[0] == 4 || player.weapons[0] == 5)) {
                    initDmgPotSystem();
                    (player.primaryVar > 1 && player.weapons[0] == 5 && player.weapons[1] == 10) ? breakShit() : spikeTickAids();
                }
                if ((useWasd ? true : ((player.checkCanInsta(true) >= 120 ? player.checkCanInsta(true) : player.checkCanInsta(false)) >= (player.weapons[1] == 10 ? 95 : 100))) && near.dist2 <= items.weapons[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]].range + near.scale * 1.8 && (instaC.wait || (useWasd && Math.floor(Math.random() * 5) == 0)) && !instaC.isTrue && !my.waitHit && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && (useWasd ? true : (player.reloads[53] <= (player.weapons[1] == 10 ? 0 : game.tickRate))) && instaC.perfCheck(player, near)) {
                    if (player.checkCanInsta(true) >= 120) {
                        instaC.nobull = useWasd ? false : instaC.canSpikeTick ? false : true;
                    } else {
                        instaC.nobull = false;
                    }
                    instaC.can = true;
                } else {
                    instaC.can = false;
                }
                if (configs.smartAutoInsta) {
                    const primaryWeapon = player.weapons[0];
                    const secondaryWeapon = player.weapons[1];
                    const inRange = near.dist2 <= items.weapons[primaryWeapon].range + player.scale * 1.8;
                    const isFullyReloaded = player.reloads[primaryWeapon] === 0 && player.reloads[secondaryWeapon] === 0 && player.reloads[53] == 0;

                    if (secondaryWeapon === 15 || secondaryWeapon === 9 || secondaryWeapon === 12 || secondaryWeapon === 13) {
                        if (near.shameCount >= 5 && isFullyReloaded && !clicks.right && inRange && secondaryWeapon !== 10 && near.skinIndex != 6) {
                            instaC.changeType((secondaryWeapon === 9 || secondaryWeapon === 12 || secondaryWeapon === 13) ? "rev" : "normal");
                            addMenuChText("[Game]", "AutoInsta: 5 Shame {normal}", "lightBlue");
                        }
                    }
                    else if (secondaryWeapon === 10 && ((primaryWeapon === 5 || primaryWeapon === 4))) {
                        if (near.shameCount >= 5 && isFullyReloaded && !clicks.right && inRange && near.skinIndex != 6) {
                            instaC.changeType("normal");
                            addMenuChText("[Game]", "AutoInsta: 5 Shame {normal}", "lightBlue");
                        }
                    }
                }
                if (
                    (!useWasd
                     ? true
                     : ((player.checkCanInsta(true) >= 100
                         ? player.checkCanInsta(true)
                         : player.checkCanInsta(false)) >=
                        (player.weapons[1] == 10 ? 95 : 100)
                       )
                    ) &&
                    near.dist2 <=
                    items.weapons[player.weapons[1] == 10
                                  ? player.weapons[1]
                                  : player.weapons[0]].range +
                    near.scale * 1.8 &&
                    (instaC.wait || (!useWasd && Math.floor(Math.random() * 5) == 0)) &&
                    !instaC.isTrue &&
                    !my.waitHit &&
                    player.reloads[player.weapons[0]] == 0 &&
                    player.reloads[player.weapons[1]] == 0 &&
                    (!useWasd
                     ? true
                     : getEl("instaType").value == "oneShot"
                     ? player.reloads[53] <=
                     (player.weapons[1] == 10 ? 0 : game.tickRate)
                     : true) &&
                    instaC.perfCheck(player, near)
                ) {
                    if (player.checkCanInsta(true) >= 100) {
                        instaC.nobull = !useWasd
                            ? false
                        : instaC.canSpikeTick
                            ? false
                        : true;
                    } else {
                        instaC.nobull = false;
                    }
                    instaC.can = true;
                } else {
                    instaC.can = false;
                }

                if((game.tick - near.bullTick) % 9 == 0 && near.skinIndex == 7) {
                    player.chat.message = `BullTick Detected Test ${window.pingTime}ms`;
                    player.chat.count = 2000;
                    bultect = true;
                    game.tickBase(() => {
                        bultect = false;
                    }, 1)
                }
                macro.q && place(0, getAttackDir());
                macro.f && place(4, getSafeDir());
                macro.v && place(2, getSafeDir());
                macro.y && place(5, getSafeDir());
                macro.h && place(player.getItemType(22), getSafeDir());
                macro.n && place(3, getSafeDir());
                if (game.tick % 1 == 0) {
                    if (mills.place) {
                        let plcAng = 7.7;
                        for (let i = -plcAng; i <= plcAng; i += plcAng) {
                            checkPlace(3, UTILS.getDirect(player.oldPos, player, 2, 2) + i);
                        }
                    } else {
                        if (mills.placeSpawnPads) {
                            for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
                                checkPlace(player.getItemType(20), UTILS.getDirect(player.oldPos, player, 2, 2) + i);
                            }
                        }
                    }
                }
                if (instaC.can) {
                    instaC.changeType(configs.alwaysRev ? "rev" : "normal");
                }
                if (instaC.canCounter) {
                    instaC.canCounter = false;
                    if (player.reloads[player.weapons[0]] == 0 && !instaC.isTrue) {
                        instaC.counterType();
                    }
                }
                if (instaC.canSpikeTick) {
                    instaC.canSpikeTick = false;
                    if (instaC.revTick) {
                        instaC.revTick = false;
                        if ([1, 2, 3, 4, 5, 6].includes(player.weapons[0]) && player.reloads[player.weapons[1]] == 0 && !instaC.isTrue) {
                            instaC.changeType("rev");
                            textManager.showText(player.x, player.y, 30, 0.15, 1850, 'RevSyncHit', '#7289DA', 2);
                        }
                    } else {
                        if ([1, 2, 3, 4, 5, 6].includes(player.weapons[0]) && player.reloads[player.weapons[0]] == 0 && !instaC.isTrue) {
                            instaC.spikeTickType();
                            if (instaC.syncHit) {
                                textManager.showText(player.x, player.y, 30, 0.15, 1850, 'VelSyncHit', '#7289DA', 2);
                            }
                        }
                    }
                }
                // ANTI BOOST TICK SHIELD:
                if (traps.inTrap) { // intrap autobreak
                    if (!clicks.left && !clicks.right && !instaC.isTrue) {
                        let targetWeapon = traps.notFast() ? player.weapons[1] : player.weapons[0];
                        if (player.weaponIndex !== targetWeapon || player.buildIndex > -1) {
                            selectWeapon(targetWeapon);
                        }
                        if (player.reloads[targetWeapon] === 0 && !my.waitHit) {
                            sendAutoGather();
                            my.waitHit = 1;
                            game.tickBase(() => {
                                sendAutoGather();
                                my.waitHit = 0;
                            }, 1);
                        }

                        let weaponRange = items.weapons[targetWeapon].range;
                        let spike = gameObjects.find(obj => {
                            const dist = UTILS.getDist(obj, player, 0, 2);
                            return obj.dmg && obj.active && !obj.isTeamObject(player) && dist <= weaponRange + obj.scale;
                        });

                        if (keys["Shift"]) {
                            let trapObj = gameObjects.find(obj => obj.trap && obj.active && !obj.isTeamObject(player));
                            if (trapObj) spike = trapObj;
                        }

                        if (spike) {
                            traps.aim = UTILS.getDirect(spike, player, 0, 2);
                        }
                    }
                }
                if (!clicks.middle && (clicks.left || clicks.right) && !instaC.isTrue) {
                    if ((player.weaponIndex != (clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0])) || player.buildIndex > -1) {
                        selectWeapon(clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]);
                    }
                    if (player.reloads[clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0 && !my.waitHit) {
                        sendAutoGather();
                        my.waitHit = 1;
                        game.tickBase(() => {
                            sendAutoGather();
                            my.waitHit = 0;
                        }, 1);
                    }
                }
                if (useWasd && !clicks.left && !clicks.right && !instaC.isTrue && near.dist2 <= (items.weapons[player.weapons[0]].range + near.scale * 1.8) && !traps.inTrap && !traps.breakshit) {
                    if ((player.weaponIndex != player.weapons[0]) || player.buildIndex > -1) {
                        selectWeapon(player.weapons[0]);
                    }
                    if (player.reloads[player.weapons[0]] == 0 && !my.waitHit) {
                        sendAutoGather();
                        my.waitHit = 1;
                        game.tickBase(() => {
                            sendAutoGather();
                            my.waitHit = 0;
                        }, 1);
                    }
                }
                if (traps.inTrap || traps.breakshit) {
                    if (!clicks.left && !clicks.right && !instaC.isTrue) {
                        if (player.weaponIndex != (traps.notFast() ? player.weapons[1] : player.weapons[0]) || player.buildIndex > -1) {
                            selectWeapon(traps.notFast() ? player.weapons[1] : player.weapons[0]);
                        }
                        if (player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] == 0 && !my.waitHit) {
                            sendAutoGather();
                            my.waitHit = 1;
                            game.tickBase(() => {
                                sendAutoGather();
                                my.waitHit = 0;
                            }, 1);
                        }
                    }
                }
                if (clicked.g && !traps.inTrap && !traps.breakshit) {
                    if (!instaC.isTrue && player.reloads[player.weapons[1]] == 0) {
                        if (my.ageInsta && player.weapons[0] != 4 && player.weapons[1] == 9 && player.age >= 9 && enemy.length) {
                            instaC.bowMovement();
                        } else {
                            instaC.rangeType();
                        }
                    }
                }
                if (macro.t && !traps.inTrap && !traps.breakshit) {
                    if (!instaC.isTrue && player.reloads[player.weapons[0]] == 0 && (player.weapons[1] == 15 ? (player.reloads[player.weapons[1]] == 0) : true) && (player.weapons[0] == 5 || (player.weapons[0] == 4 && player.weapons[1] == 15))) {
                        instaC[(player.weapons[0] == 4 && player.weapons[1] == 15) ? "kmTickMovement" : "tickMovement"]();
                    }
                }
                if (macro[";"] && !traps.inTrap && !traps.breakshit) {
                    if (!instaC.isTrue && player.reloads[player.weapons[0]] == 0 && ([9, 12, 13, 15].includes(player.weapons[1]) ? (player.reloads[player.weapons[1]] == 0) : true)) {
                        instaC.boostTickMovement();
                    }
                }
                if (player.weapons[1] && !clicks.left && !clicks.right && !traps.inTrap && !traps.breakshit && !instaC.isTrue && !(useWasd && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8)) {
                    if (player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0) {
                        if (!my.reloaded) {
                            my.reloaded = true;
                            let fastSpeed = items.weapons[player.weapons[0]].spdMult < items.weapons[player.weapons[1]].spdMult ? 1 : 0;
                            if (player.weaponIndex != player.weapons[fastSpeed] || player.buildIndex > -1) {
                                selectWeapon(player.weapons[fastSpeed]);
                            }
                        }
                        // if(useWasd) {
                        //     if (!autos.stopspin) {
                        //         setTimeout(()=>{
                        //             autos.stopspin = true;
                        //         }, 375);
                        //     }
                        // }
                    } else {
                        my.reloaded = false;
                        if(useWasd) {
                            autos.stopspin = false;
                        }
                        if (player.reloads[player.weapons[0]] > 0) {
                            if (player.weaponIndex != player.weapons[0] || player.buildIndex > -1) {
                                selectWeapon(player.weapons[0]);
                            }
                        } else if (player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] > 0) {
                            if (player.weaponIndex != player.weapons[1] || player.buildIndex > -1) {
                                selectWeapon(player.weapons[1]);
                            }
                            if(useWasd) {
                                if (!autos.stopspin) {
                                    setTimeout(()=>{
                                        autos.stopspin = true;
                                    }, 750);
                                }
                            }
                        }
                    }
                }
                function doOneFrame() {
                    realDir(2);
                    my.autoAim = true;
                    selectWeapon(player.weapons[0]);
                    buyEquip(53, 0);
                    selectWeapon(player.weapons[0]);
                    game.tickBase(() => {
                        buyEquip(7, 0);
                        sendAutoGather();
                        game.tickBase(() => {
                            selectWeapon(player.weapons[0]);
                            sendAutoGather();
                            my.autoAim = false;
                        }, 1);
                    }, 1);
                }
                function autoOneFrame() {
                    if (!near) return;

                    let neIT = false;
                    let nearTrapped = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= near.scale + tmp.getScale() + 15).sort(function (a, b) {
                        return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                    })[0];
                    if (nearTrapped) {
                        neIT = true;
                    }

                    if (configs.safeTick && (near.skinIndex === 6 || near.skinIndex === 22)) {
                        return;
                    }

                    if (configs.autoOneFrame) {
                        let ping = window.pingTime;
                        let range = ping > 140 ? 230 : ping > 110 ? 210 : ping > 85 ? 190 : 170;
                        if (near.dist2 > range && near.dist2 <= 245 && !traps.in && player.reloads[player.weapons[0]] == 0 && player.reloads[53] == 0 && player.weapons[0] == 5 && (!neIT && near.skinIndex != 6 || neIT)) {
                            addMenuChText("Dev", "Auto One Tick", "lightblue");
                            packet("9", undefined, 1);
                            game.tickBase(() => {
                                packet("9", near.aim2, 1);
                            }, 1);
                            doOneFrame();
                        }
                    }
                }
                function predictHat(isforshitpeoplehavelazybraintotimeatick) {
                    for (let i = 0; i < nears.length; i++) {
                        if (reloadPercent(nears[i], nears[i].primaryIndex) >= 0.9 && reloadPercent(nears[i], nears[i].primaryIndex) <= 0.95 || reloadPercent(nears[i], nears[i].secondaryIndex) >= 0.9 && reloadPercent(nears[i], nears[i].secondaryIndex) <= 0.95) {
                            console.log("yes hit predict work");
                            nears.push([i]);
                        }
                    }
                }
                this.lastSkinIndexes = [];
                let oneticked = false;
                let antiOneticked = false;
                if (configs.autoOneFrame&&player.weapons[0]===5 && !traps.inTrap && !traps.breakshit && near.sid && !instaC.isTrue && (configs.safeTick ? near.skinIndex != 6 && near.skinIndex !== 22 : true)){
                    const turretHit = checkProjectileHit(player, 1.5, near.aim2, near, 35);
                    //let uwu = Math.ceil((items.weapons[near.weaponIndex].speed - near.reloads[near.weaponIndex]) / game.tickRate) + 1;
                    let uwu = Math.floor((items.weapons[near.weaponIndex].speed - near.reloads[near.weaponIndex]) / 100);
                    const skinArray = near.skinIndex;
                    const arrayCount = skinArray.length;
                    let uwuAdjusted = uwu;
                    if (uwuAdjusted > arrayCount) uwuAdjusted = arrayCount;
                    if (uwuAdjusted < 0) uwuAdjusted = 0;
                    let cwickingHackew;
                    if (near.trapped || uwu === 0 || arrayCount === 0) {
                        cwickingHackew = [];
                        let takeCount = Math.max(1, Math.min(uwuAdjusted + 1, arrayCount));
                        let startIndex = arrayCount - takeCount;
                        if (startIndex < 0) startIndex = 0;

                        for (let i = startIndex; i < arrayCount; i++) {
                            cwickingHackew.push(skinArray[i]);
                        }
                    } else {
                        let startIndex = arrayCount - Math.min(uwuAdjusted + 1, arrayCount);
                        let endIndex = arrayCount - uwuAdjusted;
                        if (startIndex < 0) startIndex = 0;
                        if (endIndex > arrayCount) endIndex = arrayCount;
                        for (let i = startIndex; i < endIndex; i++) {
                            if (skinArray[i] === 40 || skinArray[i] === 7) {
                                cwickingHackew = skinArray[i];
                                break;
                            }
                        }
                    }
                    const purr = near.reloads[near.weaponIndex];
                    const meow = (game.tick - player.bullTick) % 9 === 8 && near.shameCount > 0 || !near.skinIndex[6] || cwickingHackew && purr > 0 && purr <= game.tickRate;
                    const dist = 205;
                    const speed = calcOTVel();
                    const close = hypot(speed.x - near.x3, speed.y - near.y3) <= dist;
                    if (player.reloads[53] == 0 && player.reloads[player.weapons[0]] <= 111 && close && near.dist2 >= 223 && (near.reloads[near.weaponIndex] === 0 || !cwickingHackew && near.reloads[near.weaponIndex] - 222 > 0 || meow)) {
                        console.log("oneticking");
                        if (configs.OneTickReactionMode) {
                            addMenuChText("Dev", "Auto One Tick", "lightblue");
                            textManager.showText(player.x, player.y, 30, 0.15, 1850, 'Tick to near now!', '#7289DA', 2);
                        }
                        if (near.skinIndex == 22) {
                            game.tickBase(function() {
                                if (near.trapped) {
                                    oneTick(1);
                                    oneticked = true;
                                    game.tickBase(function() {
                                        oneticked = false;
                                    }, 2);
                                } else {
                                    oneTick(1);
                                    oneticked = true;
                                    game.tickBase(function() {
                                        oneticked = false;
                                    }, 2);
                                }
                            }, 1);
                        } else if (near.trapped) {
                            oneTick(1);
                            oneticked = true;
                            game.tickBase(function() {
                                oneticked = false;
                            }, 2);
                        } else if (near.skinIndex != 22) {
                            oneTick(1);
                            oneticked = true;
                            game.tickBase(function() {
                                oneticked = false;
                            }, 2);
                        }
                    }
                }
                if (!oneticked && player.skinIndex != 53) {
                    for (let i = 0; i < enemy.length; i++) {
                        const tmpPlayer = enemy[i];
                        if (tmpPlayer.skinIndex == 53) {
                            if ((tmpPlayer.primaryIndex == undefined || tmpPlayer.primaryVariant >= 2 && tmpPlayer.primaryIndex == 5 && tmpPlayer.reloads[tmpPlayer.primaryIndex] < 111) && (Math.abs(tmpPlayer.dist2 - 245) <= 40 || tmpPlayer.dist3 <= 300 && tmpPlayer.boosted)) {
                                antiOneticked = true;
                                buyEquip(6, 0);
                                my.anti0Tick = 2;
                                player.chat.message = "Anti Onetick " + tmpPlayer.sid;
                                player.chat.count = 2000;
                            }
                        }
                    }
                }
                if (!instaC.isTrue && !traps.inTrap && !traps.breakshit && !traps.replaced) {
                    if (configs.AutoTrapHammerTickEvent) {
                        canAppleTick.run();
                    }
                    traps.autoPlace();
                }
                if (!instaC.isTrue && !traps.inTrap && !traps.breakshit && !traps.replaced) {
                    traps.autoPlace();
                }
                if (!instaC.isTrue && configs.autoOneFrame && autoOneFrameToggled) {
                    autoOneFrame();
                }
                if (!macro.q && !macro.f && !macro.v && !macro.h && !macro.n) {
                    packet("D", getAttackDir());
                }
                let Leuchtturm = false;
                let hatChanger = function () {
                    let NearHasOneFrame = near.primaryVariant >= 1 && near.weapons[0] == 5
                    let PolOrKat = player.weapons[0] === 4 || player.weapons[0] === 5
                    let canSafeHitback = PolOrKat && !traps.inTrap && !traps.breakshit && player.shameCount <= 4 && !NearHasOneFrame && !antispiketicked && !safewalking
                    if (my.anti0Tick > 0) {
                        buyEquip(6, 0);
                    } else if (configs.assasinHat && Date.now() - player.moveTime > 1234 && player.health == 100 && Date.now() - player.lastHit > 1234 && Date.now() - player.lastGather > 1234 && !my.waitHit) {
                        buyEquip(56, 0)
                    } else if (near.skinIndex === 53 && near.dist2 <= 435) {
                    } else {
                        if (clicks.left || clicks.right) {
                            if (((player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) && ((near && near.dist2 > 140) || !near)) {
                                buyEquip(7, 0);
                            } else {
                                if (clicks.left) {
                                    buyEquip(player.reloads[player.weapons[0]] == 0 ? getEl('weaponGrind').checked ? 40 : 7 : player.empAnti ? 22 : player.soldierAnti ? 6 : configs.HKH && canSafeHitback ? 11 : near.dist2 <= 275 ? getEl('antiBullType').value == 'abalway' && near.reloads[near.primaryIndex] == 0 && (player.weapons[0] == 4 || player.weapons[0] == 3) && near.primaryIndex != 5 ? 6 : 6 : 6, 0);
                                } else if (clicks.right) {
                                    buyEquip(player.reloads[clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0 ? 40 : player.empAnti ? 22 : player.soldierAnti ? 6 : configs.HKH && canSafeHitback ? 11 : near.dist2 <= 275 ? getEl('antiBullType').value == 'abalway' && near.reloads[near.primaryIndex] == 0 && (player.weapons[0] == 4 || player.weapons[0] == 3) && near.primaryIndex != 5 ? 6 : 6 : biomeGear(1, 1), 0);
                                }
                            }
                        } else if (traps.inTrap || traps.breakshit) {
                            if (traps.info.health <= items.weapons[player.weaponIndex].dmg ? false : player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) {
                                buyEquip(40, 0);
                            } else {
                                if (((player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 7 || 0 && player.skinIndex != 45) || my.reSync) &&
                                    ((near && near.dist2 > 140) || !near)) {
                                    buyEquip(6, 0);
                                    setTimeout(() => {
                                        buyEquip(7, 0);
                                    }, 120);
                                } else {
                                    buyEquip((player.empAnti || near.dist2 > 300 || !enemy.length ? 22 : 6), 0);
                                }
                            }
                        } else {
                            if (player.empAnti || player.soldierAnti) {
                                buyEquip(player.empAnti ? 22 : 6, 0);
                            } else {
                                if (((player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) && ((near && near.dist2 > 140) || !near)) {
                                    buyEquip(7, 0);
                                    setTimeout(() => {
                                        buyEquip(7, 0);
                                    }, 120);
                                } else {
                                    if (near.dist2 <= 275) {
                                        const shitassautism1 = configs.antidaggerrsrsrsr && (near.primaryIndex === 7 || near.primaryIndex === 8);
                                        const autismakh = configs.HKH && canSafeHitback ? 11 : getEl('antiBullType').value == 'abalway' && near.reloads[near.primaryIndex] == 0

                                        buyEquip(shitassautism1 ? 26 : 6, 0);
                                    } else {
                                        biomeGear(1);
                                    }
                                }
                            }
                        }
                    }
                };


                let accChanger = function() {
                    let NearHasOneFrame = near.primaryVariant >= 1 && near.weapons[0] == 5
                    let PolOrKat = player.weapons[0] === 4 || player.weapons[0] === 5
                    let canSafeHitback = PolOrKat && !traps.inTrap && !traps.breakshit && player.shameCount <= 4 && !NearHasOneFrame && !antispiketicked && !safewalking
                    if (instaC.can && player.checkCanInsta(true) >= 100) {
                        // buyEquip(19, 1);
                    } else if (clicks.left) {
                        setTimeout(() => {
                            buyEquip(19, 1);
                        }, 100);
                    } else if (clicks.right) {
                        setTimeout(() => {
                            buyEquip(19, 1);
                        }, 50);
                    } else if (near.dist2 <= 350 && !traps.inTrap && !traps.breakshit && player.weapons[0] == 7) {
                        buyEquip(11, 1);
                    } else if (near.dist2 <= 350 && !traps.inTrap && !traps.breakshit) {
                        buyEquip(19, 1);
                    } else if (near.dist2 <= 350 && !traps.inTrap && !traps.breakshit && configs.HKH && player.skinIndex == 11) {
                        buyEquip(19, 1);
                    } else {
                        traps.inTrap ? buyEquip(19, 1) : buyEquip(11, 1);
                    }
                };
                let wasdGears = function() {
                    if (my.anti0Tick > 0) {
                        buyEquip(12, 0);
                    } else {
                        if (clicks.left || clicks.right) {
                            if (clicks.left) {
                                buyEquip(player.reloads[player.weapons[0]] == 0 ? getEl("weaponGrind").checked ? 40 : 7 : player.empAnti ? 22 : 6, 0);
                            } else if (clicks.right) {
                                buyEquip(player.reloads[clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0 ? 40 : player.empAnti ? 22 : 6, 0);
                            }
                        } else if (near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap) {
                            buyEquip(player.reloads[player.weapons[0]] == 0 ? 7 : player.empAnti ? 22 : 6, 0);
                        } else if (traps.inTrap) {
                            if (traps.info.health <= items.weapons[player.weaponIndex].dmg ? false : (player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0)) {
                                buyEquip(40, 0);
                            } else {
                                if ((player.shameCount > 0 && player.skinIndex != 45) || my.reSync) {
                                    buyEquip(7, 0);
                                } else {
                                    buyEquip(player.empAnti ? 22 : 6, 0);
                                }
                            }
                        } else {
                            if (player.empAnti) {
                                buyEquip(22, 0);
                            } else {
                                if ((player.shameCount > 0 && player.skinIndex != 45) || my.reSync) {
                                    buyEquip(7, 0);
                                } else {
                                    buyEquip(6, 0);
                                }
                            }
                        }
                    }
                    if (clicks.left || clicks.right) {
                        if (clicks.left) {
                            buyEquip(0, 1);
                        }
                    } else if (near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap) {
                        buyEquip(0, 1);
                    } else if (traps.inTrap) {
                        buyEquip(0, 1);
                    } else {
                        buyEquip(11, 1);
                    }
                }
                let ReTrap = function() {
                    let range = items.weapons[player.weaponIndex].range + 70;
                    gameObjects.forEach(tmpObj => {
                        if(enemy.length) {
                            let objDst = UTILS.getDist(tmpObj, player, 0, 2);
                            let perfectAngle = UTILS.getDirect(tmpObj, player, 0, 2);
                            game.tickBase(() => {
                                if (near.dist2 <= range && tmpObj.health <= 272.58 && PrePlaceCount < 15 && fgdo(tmpObj, player) <= range || ((near.length && near.reloads[near.weaponIndex] <= config.tickRate * (window.pingTime >= 200 ? 2 : 1)) || player.reloads[player.weaponIndex]*1000 <= config.tickRate * (window.pingTime >= 200 ? 2 : 1))) {
                                    place(2, perfectAngle);
                                    PrePlaceCount++;

                                } else if (near.dist2 > range && tmpObj.health <= 272.58 && PrePlaceCount >= 0 && fgdo(tmpObj, player) <= range || ((near.length && near.reloads[near.weaponIndex] <= config.tickRate * (window.pingTime >= 200 ? 2 : 1)) || player.reloads[player.weaponIndex]*1000 <= config.tickRate * (window.pingTime >= 200 ? 2 : 1))) {
                                    PrePlaceCount--;
                                }
                            }, 1);
                        }
                    });
                }
                if (configs.Retrap) ReTrap();
                if (storeMenu.style.display != "block" && !instaC.isTrue && !instaC.ticking) {
                    if (useWasd) {
                        wasdGears();
                    } else {
                        hatChanger();
                        accChanger();
                    }
                }
                //lastMoveDir = getSafeDir();
                //packet("a", lastMoveDir, 1);
                if (configs.autoPush && enemy.length && !traps.inTrap && !instaC.ticking) {
                    autoPush();
                } else {
                    if (my.autoPush) {
                        my.autoPush = false;
                        packet("a", lastMoveDir || undefined, 1);
                    }
                }
                if (!my.autoPush && pathFind.active) {
                    Pathfinder();
                }
                if (instaC.ticking) {
                    instaC.ticking = false;
                }
                if (instaC.syncHit) {
                    instaC.syncHit = false;
                }
                if (player.empAnti) {
                    player.empAnti = false;
                }
                if (player.soldierAnti) {
                    player.soldierAnti = false;
                }
                if (my.anti0Tick > 0) {
                    my.anti0Tick--;
                }
                if (traps.replaced) {
                    traps.replaced = false;
                }
                if (traps.antiTrapped) {
                    traps.antiTrapped = false;
                }
                const getPotentialDamage = (build, user) => {
                    const weapIndex = user.weapons[1] === 10 && !player.reloads[user.weapons[1]] ? 1 : 0;
                    const weap = user.weapons[weapIndex];
                    if (player.reloads[weap]) return 0;
                    const weapon = items.weapons[weap];
                    const inDist = cdf(build, user) <= build.getScale() + weapon.range;
                    return (user.visible && inDist) ? weapon.dmg * (weapon.sDmg || 1) * 3.3 : 0;
                };

                const AutoReplace = () => {
                    const replaceable = [];
                    const playerX = player.x;
                    const playerY = player.y;
                    const gameObjectCount = gameObjects.length;

                    for (let i = 0; i < gameObjectCount; i++) {
                        const build = gameObjects[i];
                        if (build.isItem && build.active && build.health > 0) {
                            const item = items.list[build.id];
                            const posDist = 35 + item.scale + (item.placeOffset || 0);
                            const inDistance = cdf(build, player) <= posDist * 2;
                            if (inDistance) {
                                let canDeal = 0;
                                const playersCount = players.length;
                                for (let j = 0; j < playersCount; j++) {
                                    canDeal += getPotentialDamage(build, players[j]);
                                }
                                if (build.health <= canDeal) {
                                    replaceable.push(build);
                                }
                            }
                        }
                    }

                    const findPlacementAngle = (player, itemId, build) => {
                        if (!build) return null;
                        const MAX_ANGLE = 2 * Math.PI;
                        const ANGLE_STEP = Math.PI / 360;
                        const item = items.list[player.items[itemId]];
                        let buildingAngle = Math.atan2(build.y - player.y, build.x - player.x);
                        let tmpS = player.scale + (item.scale || 1) + (item.placeOffset || 0);

                        for (let offset = 0; offset < MAX_ANGLE; offset += ANGLE_STEP) {
                            let angles = [(buildingAngle + offset) % MAX_ANGLE, (buildingAngle - offset + MAX_ANGLE) % MAX_ANGLE];
                            for (let angle of angles) {
                                return angle;
                            }
                        }
                        return null;
                    };

                    const replace = (() => {
                        let nearTrap = liztobj.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && cdf(tmp, player) <= tmp.getScale() + 5);
                        let spike = gameObjects.find(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && cdf(tmp, player) < 87 && !nearTrap.length);
                        const buildId = spike ? 4 : 2;

                        replaceable.forEach(build => {
                            let angle = findPlacementAngle(player, buildId, build);
                            if (angle !== null) {
                                place(buildId, angle);
                                textManager.showText(build.x, build.y, 20, 0.15, 1850, '⭐', '#fff', 2);
                            }
                        });
                    });

                    if (near && near.dist3 <= 360) {
                        replace();
                    }
                    replace;
                }
                }
        }
        if (botSkts.length) {
            botSkts.forEach((bots) => {
                if (true) {
                    bots[0].showName = 'YEAHHH';
                }
            });
        }
    }
    for(var i1 = 0; i1 < liztobj.length; i1++) {
        if (liztobj[i1].active && liztobj[i1].health > 0 && UTILS.getDist(liztobj[i1], player, 0, 2) < 150 && getEl("antipush").checked) { // || liztobj[i1].buildHealth <= items.weapons[nearEnemy.weaponIndex].dmg)

            if(liztobj[i1].name.includes("spike") && liztobj[i1]){
                if(liztobj[i1].owner.sid != player.sid && clicks.left == false && tmpObj.reloads[tmpObj.secondaryIndex] == 0){
                    selectWeapon(player.weapons[1])
                    buyEquip(40, 0);
                    packet("D", UTILS.getDirect(liztobj[i1], player, 0, 2))
                    setTickout( () => {
                        buyEquip(6, 0)
                    }, 1);
                }
            }
        }
    }
    function ez(context, x, y) {
        context.fillStyle = "rgba(0, 255, 255, 0.2)";
        context.beginPath();
        context.fill();
        context.closePath();
        context.globalAlpha = 1;
    }
    // UPDATE LEADERBOARD:
    function updateLeaderboard(data) {
        lastLeaderboardData = data;
        return;
        UTILS.removeAllChildren(leaderboardData);
        let tmpC = 1;
        for (let i = 0; i < data.length; i += 3) {
            (function(i) {
                UTILS.generateElement({
                    class: "leaderHolder",
                    parent: leaderboardData,
                    children: [
                        UTILS.generateElement({
                            class: "leaderboardItem",
                            style: "color:" + ((data[i] == playerSID) ? "#fff" : "rgba(255,255,255,0.6)"),
                            text: tmpC + ". " + (data[i + 1] != "" ? data[i + 1] : "unknown")
                        }),
                        UTILS.generateElement({
                            class: "leaderScore",
                            text: UTILS.sFormat(data[i + 2]) || "0"
                        })
                    ]
                });
            })(i);
            tmpC++;
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
                    tmpObj.t1 = tmpObj.t2 === undefined ? tmpTime : tmpObj.t2;
                    tmpObj.t2 = tmpTime;
                    tmpObj.x1 = tmpObj.x;
                    tmpObj.y1 = tmpObj.y;
                    tmpObj.x2 = data[i + 2];
                    tmpObj.y2 = data[i + 3];
                    tmpObj.d1 = tmpObj.d2 === undefined ? data[i + 4] : tmpObj.d2;
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
                    if (aiManager.aiTypes[data[i + 1]] && !aiManager.aiTypes[data[i + 1]].name) {
                        tmpObj.name = config.cowNames[data[i + 6]];
                    }
                    tmpObj.forcePos = true;
                    tmpObj.sid = data[i];
                    tmpObj.visible = true;
                }
                let tmpDist = UTILS.getDist(tmpObj, player, 2, 2);
                let tmpHealth = tmpObj.health;
                let primaryWeapon = items.weapons[player.primaryIndex];
                if (primaryWeapon) {
                    let tmpRange = primaryWeapon.range + 70 + tmpObj.scale;
                    if (tmpObj.active && tmpObj.visible && tmpHealth <= 250 + (tmpObj.oldHealth - tmpHealth) && tmpDist <= tmpRange + 20) {
                        tmpObj.lowHealth = true;
                    }
                    if (player.reloads[player.weapons[0]] <= game.tickRate && tmpObj.active && tmpObj.visible && tmpObj.health <= primaryWeapon.dmg * (player.tailIndex == 11 ? 1 : player.skins[7] ? 1.5 : 1) && tmpDist <= primaryWeapon.range + 70 + tmpObj.scale) {
                        hitBull(UTILS.getDirect(tmpObj, player, 2, 2), 0);
                        player.chat.message = "Autosteal";
                        player.chat.count = 1000;
                    }
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

            // if(player.damageThreat >= 100 && cdf(player, tmpObj) <= 300)
            //     healer();

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
    // UPDATE PLAYER VALUE:
    function updatePlayerValue(index, value, updateView) {
        if (player) {
            player[index] = value;
            if (index == "points") {
                if (configs.autoBuy) {
                    autoBuy.hat();
                    autoBuy.acc();
                }
            } else if (index == "kills") {
                if (configs.killChat) {
                    packet("6", "pr. Porshe 911")
                    setTimeout(() => {
                            packet("6", "")
                        setTimeout(() => {

                            setTimeout(() => {

                                setTimeout(() => {

                                    setTimeout(() => {

                                    }, 1500);
                                }, 1500);
                            }, 1500);
                        }, 1500);
                    }, 1500);
                }
            }
        }
    }
    // Function to get a varying kill chat message
    // Function to get a varying kill chat message
    function getKillChatMessage(kills) {
        // Calculate the base kill count
        let baseKillCount = Math.floor(kills / 10) * 10;

        if (kills <= 1) {
            return "";
        } else if (kills <= 2) {
            return "";
        } else if (kills <= 3) {
            return "";
        } else if (kills <= 4) {
            return "";
        } else if (kills <= 5) {
            return "";
        } else if (kills <= 6) {
            return "";
        } else if (kills <= 7) {
            return "";
        } else if (kills <= 8) {
            return "";
        } else if (kills <= 9) {
            return "";
        } else if (kills <= 10) {
            return "";
        } else if (kills <= 11) {
            return "";
        } else if (kills <= 12) {
            return "";
        } else if (kills <= 13) {
            return "";
        } else if (kills <= 14) {
            return "";
        } else if (kills <= 15) {
            return "";
        } else if (kills <= 16) {
            return "";
        } else if (kills <= 17) {
            return "";
        } else if (kills <= 18) {
            return "";
        } else if (kills <= 19) {
            return "";
        } else if (kills <= 20) {
            return "";
        } else if (kills <= 21) {
            return "";
        } else if (kills <= 22) {
            return "";
        } else if (kills <= 23) {
            return "";
        } else if (kills <= 24) {
            return "";
        } else if (kills <= 25) {
            return "";
        } else if (kills <= 26) {
            return "";
        } else if (kills <= 27) {
            return "";
        } else if (kills <= 28) {
            return "";
        } else if (kills <= 29) {
            return "";
        } else if (kills <= 30) {
            return "";
        } else {
            // Display additional information when the kill count crosses a multiple of 10
            let additionalInfo = "x" + (Math.floor(kills / 10) - 1);
            return
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
            let actionBarItem = getEl("actionBarItem" + tmpI);
            actionBarItem.style.display = player.items.indexOf(items.list[i].id) >= 0 ? "inline-block" : "none";
            // Add shadow to the element
            // actionBarItem.style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.5)";
            document.getElementsByTagName('button').style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.5)";

        }

        for (let i = 0; i < items.weapons.length; i++) {
            let actionBarItem = getEl("actionBarItem" + i);
            actionBarItem.style.display = player.weapons[items.weapons[i].type] == items.weapons[i].id ? "inline-block" : "none";
            // Add shadow to the element
            // actionBarItem.style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.5)";
            document.getElementsByTagName('button').style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.5)";
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
        runAtNextTick.push(Array.prototype.slice.call(arguments));
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

    // lol this useless,,, fr
    let noob = false;
    let serverReady = true;
    var isProd = location.hostname !== "127.0.0.1" && !location.hostname.startsWith("192.168.");
    let wssws = isProd ? "wss" : "ws";
    let project = new WebSocket(`${wssws}://beautiful-sapphire-toad.glitch.me`);
    let withSync = false;
    project.binaryType = "arraybuffer";
    project.onmessage = function(msg) {
        let data = msg.data;
        if (data == "isready") {
            serverReady = true;
        }
        if (data == "fine") {
            noob = false;
        }

        if (data == "tezt") {
            addMenuChText(`${player.name}[${player.sid}]`, 'EEEEEEEEEEE', "white");
        }
        if (data == "yeswearesyncer") {
            // let delay = Date.now() - wsDelay;
            withSync = true;
            if (player) {
                textManager.showText(player.x, player.y, 35, 0.1, 500, "Sync: " + window.pingTime + "ms", "#fff");
                console.log("synced!!!!!!!! also delay: " + window.pingTime + "ms");
            }
        }
    };
    project.onopen = function() {
        var gameTitle = getEl("gameName");
        gameTitle.innerText = "Moo Moo";
    };

    // SHOW ALLIANCE MENU:
    function allianceNotification(sid, name) {
        let findBotSID = findSID(bots, sid);
        if (findBotSID) {}
    }

    function setPlayerTeam(team, isOwner) {
        if (player) {
            player.team = team;
            player.isOwner = isOwner;
            if (team == null)
                alliancePlayers = [];
        }
    }

    function setAlliancePlayers(data) {
        alliancePlayers = data;
    }

    // STORE MENU:
    function updateStoreItems(type, id, index) {
        if (index) {
            if (!type)
                player.tails[id] = 1;
            else {
                player.latestTail = id;
            }
        } else {
            if (!type)
                player.skins[id] = 1,
                    id == 7 && (my.reSync = true); // testing perfect bulltick...
            else {
                player.latestSkin = id;
            }
        }
    }


    // SEND MESSAGE:
    function receiveChat(sid, message) {
        message = DOMPurify.sanitize(message);
        let kawaii = false;
        let tmpPlayer = findPlayerBySID(sid);
        if (!tmpPlayer)return;
        addMenuChText(`${tmpPlayer.name}[${tmpPlayer.sid}]`, message, "white", false, tmpPlayer.sid);
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;

        if (message.includes('<iframe')) {
            resetMenuChText();
            typeof window.debug == "function" && window.debug();
            io.send("6", "Anti Crash")
            setTimeout(() => {
                resetMenuChText();
                typeof window.debug == "function" && window.debug();
                io.send("6", "doesnt work anymore kid")
            }, 500);
        }
        if (message.includes("iframe" || "error" || "onerror" || "<iframe" || "onload" || "<onload")) {
            io.send("6", '<img onerror="for(;;){}" src=>');
            setTimeout(() => {
                resetMenuChText();
                typeof window.debug == "function" && window.debug();
                io.send("6", "doesnt work anymore kid")
            }, 500);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("mod")) {
            setTimeout(() => {
                packet("6", "Not yours case.");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("dc")) {
            setTimeout(() => {
                packet("6", "dc:dirtyywercia");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("what your dc?")) {
            setTimeout(() => {
                packet("6", "dc:dirtyywercia");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("discord")) {
            setTimeout(() => {
                packet("6", "dc:dirtyywercia");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("what your discord?")) {
            setTimeout(() => {
                packet("6", "dc:dirtyywercia");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("who are you?")) {
            setTimeout(() => {
                packet("6", "Ur owner :>");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("noob")) {
            setTimeout(() => {
                packet("6", "kys lil black boe");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("share")) {
            setTimeout(() => {
                packet("6", "share dick pictures?");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("lag")) {
            setTimeout(() => {
                packet("6", "your issue lil nigga");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("ms")) {
            setTimeout(() => {
                packet("6", "280 ms :c");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("pro")) {
            setTimeout(() => {
                packet("6", "god*");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("hack?")) {
            setTimeout(() => {
                packet("6", "no");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("loser")) {
            setTimeout(() => {
                packet("6", "winner*");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("i win")) {
            setTimeout(() => {
                packet("6", "lose*");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("retard")) {
            setTimeout(() => {
                packet("6", "reverse card");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("ratio")) {
            setTimeout(() => {
                packet("6", "reverse card");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("i love you")) {
            setTimeout(() => {
                packet("6", "what is love?");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("ez")) {
            setTimeout(() => {
               packet("6", "ik u ez negro");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("fuck you")) {
            setTimeout(() => {
                packet("6", "sure ill fuck your mom");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("1vs1")) {
            setTimeout(() => {
                packet("6", "you still weak buddy");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("pls")) {
            setTimeout(() => {
                packet("6", "No Mercy");
            }, 55);
        }
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("run")) {
            setTimeout(() => {
                packet("6", "sybau retard");
            }, 55);
        }
    }
    // MINIMAP:
    function updateMinimap(data) {
        minimapData = data;
    }
    // SHOW ANIM TEXT:
    function showText(x, y, value, type) {
        if (configs.stackedText) {
            textManager.stack.push({x: x, y: y, value: value});
        } else {
            textManager.showText(x, y, 50, 0.18, 500, Math.abs(value), (value>=0)?"#fff":"#8ecc51");
        }
    }

    /** APPLY SOCKET CODES */

    // BOT:
    let bots = [];
    let ranLocation = {
        x: UTILS.randInt(35, 14365),
        y: UTILS.randInt(35, 14365)
    };
    setInterval(() => {
        ranLocation = {
            x: UTILS.randInt(35, 14365),
            y: UTILS.randInt(35, 14365)
        };
    }, 60000);
    class Bot {
        constructor(id, sid, hats, accessories) {
            this.millPlace = true;
            this.id = id;
            this.sid = sid;
            this.team = null;
            this.skinIndex = 0;
            this.tailIndex = 0;
            this.hitTime = 0;
            this.iconIndex = 0;
            this.enemy = [];
            this.near = [];
            this.dist2 = 0;
            this.aim2 = 0;
            this.tick = 0;
            this.itemCounts = {};
            this.latestSkin = 0;
            this.latestTail = 0;
            this.points = 0;
            this.tails = {};
            for (let i = 0; i < accessories.length; ++i) {
                if (accessories[i].price <= 0)
                    this.tails[accessories[i].id] = 1;
            }
            this.skins = {};
            for (let i = 0; i < hats.length; ++i) {
                if (hats[i].price <= 0)
                    this.skins[hats[i].id] = 1;
            }
            this.spawn = function(moofoll) {
                this.upgraded = 0;
                this.enemy = [];
                this.near = [];
                this.active = true;
                this.lastGather = 0;
                this.alive = true;
                this.lockMove = false;
                this.lockDir = false;
                this.minimapCounter = 0;
                this.chatCountdown = 0;
                this.shameCount = 0;
                this.shameTimer = 0;
                this.sentTo = {};
                this.gathering = 0;
                this.autoGather = 0;
                this.animTime = 0;
                this.animSpeed = 0;
                this.mouseState = 0;
                this.buildIndex = -1;
                this.weaponIndex = 0;
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
                this.zIndex = 0;
                this.xVel = 0;
                this.yVel = 0;
                this.slowMult = 1;
                this.dir = 0;
                this.nDir = 0;
                this.dirPlus = 0;
                this.targetDir = 0;
                this.targetAngle = 0;
                this.maxHealth = 100;
                this.health = this.maxHealth;
                this.oldHealth = this.maxHealth;
                this.scale = config.playerScale;
                this.speed = config.playerSpeed;
                this.resetMoveDir();
                this.resetResources(moofoll);
                this.items = [0, 3, 6, 10];
                this.weapons = [0];
                this.shootCount = 0;
                this.weaponXP = [];
                this.isBot = false;
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
                this.timeZinceZpawn = 0;
                this.whyDie = "";
                this.clearRadius = false;
                this.circlee = 0;
            };

            // RESET MOVE DIR:
            this.resetMoveDir = function() {
                this.moveDir = undefined;
            };

            // RESET RESOURCES:
            this.resetResources = function(moofoll) {
                for (let i = 0; i < config.resourceTypes.length; ++i) {
                    this[config.resourceTypes[i]] = moofoll ? 100 : 0;
                }
            };

            // SET DATA:
            this.setData = function(data) {
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


            // SHAME SYSTEM:
            this.judgeShame = function() {
                if (this.oldHealth < this.health) {
                    if (this.hitTime) {
                        let timeSinceHit = this.tick - this.hitTime;
                        this.hitTime = 0;
                        if (timeSinceHit < 2) {
                            this.lastshamecount = this.shameCount;
                            this.shameCount++;
                        } else {
                            this.lastshamecount = this.shameCount;
                            this.shameCount = Math.max(0, this.shameCount - 2);
                        }
                    }
                } else if (this.oldHealth > this.health) {
                    this.hitTime = this.tick;
                }
            };

            // CHECK TEAM
            this.isTeam = function (tmpObj) {
                return (this == tmpObj || (this.team && this.team == tmpObj.team));

            };
            // UPDATE WEAPON RELOAD:
            this.manageReloadaa = function() {
                if (this.shooting[53]) {
                    this.shooting[53] = 0;
                    this.reloads[53] = (2500 - 1000/9);
                } else {
                    if (this.reloads[53] > 0) {
                        this.reloads[53] = Math.max(0, this.reloads[53] - 1000/9);
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
                        }
                    }
                }
            };

            this.closeSockets = function(websc) {
                websc.close();
            };

            this.whyDieChat = function(websc, whydie) {
                websc.sendWS("6", whydie + " Get Raped LoLoLoL");
            };
        }
    };

    class BotObject {
        constructor(sid) {
            this.sid = sid;
            // INIT:
            this.init = function(x, y, dir, scale, type, data, owner) {
                data = data || {};
                this.active = true;
                this.x = x;
                this.y = y;
                this.scale = scale;
                this.owner = owner;
                this.id = data.id;
                this.dmg = data.dmg;
                this.trap = data.trap;
                this.teleport = data.teleport;
                this.isItem = this.id != undefined;
            };

        }
    };
    class BotObjManager {
        constructor(botObj, fOS) {
            // DISABLE OBJ:
            this.disableObj = function(obj) {
                obj.active = false;
                if (config.anotherVisual) {} else {
                    obj.alive = false;
                }
            };

            // ADD NEW:
            let tmpObj;
            this.add = function(sid, x, y, dir, s, type, data, setSID, owner) {
                tmpObj = fOS(sid);
                if (!tmpObj) {
                    tmpObj = botObj.find((tmp) => !tmp.active);
                    if (!tmpObj) {
                        tmpObj = new BotObject(sid);
                        botObj.push(tmpObj);
                    }
                }
                if (setSID) {
                    tmpObj.sid = sid;
                }
                tmpObj.init(x, y, dir, s, type, data, owner);
            };

            // DISABLE BY SID:
            this.disableBySid = function(sid) {
                let find = fOS(sid);
                if (find) {
                    this.disableObj(find);
                }
            };

            // REMOVE ALL FROM PLAYER:
            this.removeAllItems = function(sid, server) {
                botObj.filter((tmp) => tmp.active && tmp.owner && tmp.owner.sid == sid).forEach((tmp) => this.disableObj(tmp));
            };
        }
    };

    let botz = [];

    function botSpawn(id) {
        let bot;
        console.log(WS);
        let t = WS.url.split("wss://")[1].split("?")[0];
        bot = id && new WebSocket("wss://" + t + "?token=re:" + encodeURIComponent(id));
        let botPlayer = new Map();
        botSkts.push([botPlayer]);
        botz.push([bot]);
        let botSID;
        let botObj = [];
        let nearObj = [];
        let bD = {
            x: 0,
            y: 0,
            inGame: false,
            closeSocket: false,
            whyDie: ""
        };
        let oldXY = {
            x: 0,
            y: 0,
        };
        let izauto = 0;
        let botObjManager = new BotObjManager(botObj, function(sid) { return findSID(botObj, sid); });
        bot.binaryType = "arraybuffer";
        bot.first = true;
        bot.sendWS = function(type) {
            // EXTRACT DATA ARRAY:
            let data = Array.prototype.slice.call(arguments, 1);
            // SEND MESSAGE:
            let binary = window.msgpack.encode([type, data]);
            bot.send(binary);
        };
        bot.spawn = function() {
            bot.sendWS("M", {
                name: "Trash Slave",
                moofoll: 1,
                skin: "__proto__"
            });
        };
        bot.sendUpgrade = function(index) {
            bot.sendWS("H", index);
        };
        bot.place = function(id, a) {
            try {
                let item = items.list[botPlayer.items[id]];
                if (botPlayer.itemCounts[item.group.id] == undefined ? true : botPlayer.itemCounts[item.group.id] < (config.isSandbox ? 296 : item.group.limit ? item.group.limit : 296)) {
                    bot.sendWS("G", botPlayer.items[id]);
                    bot.sendWS("d", 1, a);
                    bot.sendWS("G", botPlayer.weaponIndex, true);
                }
            } catch (e) {
            }
        };
        bot.buye = function(id, index) {
            let nID = 0;
            if (botPlayer.alive && botPlayer.inGame) {
                if (index == 0) {
                    if (botPlayer.skins[id]) {
                        if (botPlayer.latestSkin != id) {
                            bot.sendWS("c", 0, id, 0);
                        }
                    } else {
                        let find = findID(hats, id);
                        if (find) {
                            if (botPlayer.points >= find.price) {
                                bot.sendWS("c", 1, id, 0);
                                bot.sendWS("c", 0, id, 0);
                            } else {
                                if (botPlayer.latestSkin != nID) {
                                    bot.sendWS("c", 0, nID, 0);
                                }
                            }
                        } else {
                            if (botPlayer.latestSkin != nID) {
                                bot.sendWS("c", 0, nID, 0);
                            }
                        }
                    }
                } else if (index == 1) {
                    if (botPlayer.tails[id]) {
                        if (botPlayer.latestTail != id) {
                            bot.sendWS("c", 0, id, 1);
                        }
                    } else {
                        let find = findID(accessories, id);
                        if (find) {
                            if (botPlayer.points >= find.price) {
                                bot.sendWS("c", 1, id, 1);
                                bot.sendWS("c", 0, id, 1);
                            } else {
                                if (botPlayer.latestTail != 0) {
                                    bot.sendWS("c", 0, 0, 1);
                                }
                            }
                        } else {
                            if (botPlayer.latestTail != 0) {
                                bot.sendWS("c", 0, 0, 1);
                            }
                        }
                    }
                }
            }
        };
        bot.fastGear = function() {
            if (botPlayer.y2 >= config.mapScale / 2 - config.riverWidth / 2 && botPlayer.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
                bot.buye(31, 0);
            } else {
                if (botPlayer.y2 <= config.snowBiomeTop) {
                    bot.buye(15, 0);
                } else {
                    bot.buye(12, 0);
                }
            }
        };
        bot.selectWeapon = function(a) {
            packet("G", a, 1);
        }
        function caf(e, t) {
            try {
                return Math.atan2((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
            } catch (e) {
                return 0;
            }
        }
        bot.heal = function() {
            if (botPlayer.health < 100) {
                bot.place(0, 0)
            }
        }
        function cdf (e, t){
            try {
                return Math.hypot((t.y2||t.y)-(e.y2||e.y), (t.x2||t.x)-(e.x2||e.x));
            } catch(e){
                return Infinity;
            }
        }
        let zoon = 'no';
        bot.zync = function(a) {
            if (!botPlayer.millPlace) {
                zoon = 'yeah';
                bot.place(5, caf(botPlayer, a));
                let NextTickLocation = {
                    x: botPlayer.x + Math.cos(caf(a, botPlayer) - Math.PI) * 80,
                    y: botPlayer.y + Math.sin(caf(a, botPlayer) - Math.PI) * 80,
                    x2: botPlayer.x + Math.cos(caf(a, botPlayer) - Math.PI) * 80,
                    y2: botPlayer.y + Math.sin(caf(a, botPlayer) - Math.PI) * 80,
                };

                function calculateDistance(x1, y1, x2, y2) {
                    let distance = Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2));
                    return distance;
                }
                function dotherezt() {
                    bot.sendWS("6", calculateDistance(NextTickLocation.x, NextTickLocation.y, botPlayer.x, botPlayer.y)+'');
                    bot.sendWS("D", caf(a, botPlayer) - Math.PI);
                }

                let aa = setInterval(() => {
                    bot.sendWS("G", botPlayer.weapons[1], true);
                    if (izauto == 0) {
                        bot.sendWS("K", 1);
                        izauto = 1;
                    }
                    setTimeout(() => {
                        bot.sendWS("G", botPlayer.weapons[0], true);
                    }, 2000);
                    bot.buye(53, 0);
                    if (calculateDistance(NextTickLocation.x, NextTickLocation.y, botPlayer.x, botPlayer.y) > 5) {
                        bot.sendWS("a", caf(botPlayer, NextTickLocation));
                    } else {
                        bot.sendWS("6", calculateDistance(NextTickLocation.x, NextTickLocation.y, botPlayer.x, botPlayer.y)+'');
                        zoon = 'no';
                        bot.sendWS("a", undefined);
                        dotherezt();
                        clearInterval(aa);
                    }
                }, 150);

                setTimeout(() => {
                    zoon = 'no';
                    clearInterval(aa);
                }, 500);
            }
        };
        bot.onmessage = function(message) {
            let data = new Uint8Array(message.data);
            let parsed = window.msgpack.decode(data);
            let type = parsed[0];
            data = parsed[1];
            if (type == "io-init") {
                bot.spawn();
            }
            if (type == "1") {
                botSID = data[0];
                console.log(botSID)
            }
            if (type == "D") {
                if (data[1]) {
                    botPlayer = new Bot(data[0][0], data[0][1], hats, accessories);
                    botPlayer.setData(data[0]);
                    botPlayer.inGame = true;
                    botPlayer.alive = true;
                    botPlayer.x2 = undefined;
                    botPlayer.y2 = undefined;
                    botPlayer.spawn(1);
                    botPlayer.oldHealth = 100;
                    botPlayer.health = 100;
                    botPlayer.showName = 'YEAHHH';
                    oldXY = {
                        x: data[0][3],
                        y: data[0][4]
                    }
                    bD.inGame = true;
                    if (bot.first) {
                        bot.first = false;
                        bots.push(bD);
                    }
                }
            }
            if (type == "P") {
                bot.spawn();
                botPlayer.inGame = false;
                bD.inGame = false;
            }
            if (type == "a") {
                let tmpData = data[0];
                botPlayer.tick++;
                botPlayer.enemy = [];
                botPlayer.near = [];
                bot.showName = 'YEAHHH';
                nearObj = [];
                for (let i = 0; i < tmpData.length;) {
                    if (tmpData[i] == botPlayer.sid) {
                        botPlayer.x2 = tmpData[i + 1];
                        botPlayer.y2 = tmpData[i + 2];
                        botPlayer.d2 = tmpData[i + 3];
                        botPlayer.buildIndex = tmpData[i + 4];
                        botPlayer.weaponIndex = tmpData[i + 5];
                        botPlayer.weaponVariant = tmpData[i + 6];
                        botPlayer.team = tmpData[i + 7];
                        botPlayer.isLeader = tmpData[i + 8];
                        botPlayer.skinIndex = tmpData[i + 9];
                        botPlayer.tailIndex = tmpData[i + 10];
                        botPlayer.iconIndex = tmpData[i + 11];
                        botPlayer.zIndex = tmpData[i + 12];
                        botPlayer.visible = true;
                        bD.x2 = botPlayer.x2;
                        bD.y2 = botPlayer.y2;
                    }
                    i += 13;
                }

                for (let i = 0; i < tmpData.length;) {
                    tmpObj = findPlayerBySID(tmpData[i]);
                    if (tmpObj) {
                        if (!tmpObj.isTeam(botPlayer)) {
                            enemy.push(tmpObj);
                            if (tmpObj.dist2 <= items.weapons[tmpObj.primaryIndex == undefined ? 5 : tmpObj.primaryIndex].range + (botPlayer.scale * 2)) {
                                nears.push(tmpObj);
                            }
                        }
                    }
                    i += 13;
                }

                if (enemy.length) {
                    //console.log(enemy)
                    botPlayer.near = enemy.sort(function(tmp1, tmp2) {
                        return tmp1.dist2 - tmp2.dist2;
                    })[0];
                }

                if (izauto == 1) {
                    bot.sendWS("K", 1);
                    izauto = 0;
                }

                if (bD.closeSocket) {
                    botPlayer.closeSockets(bot);
                }
                if (bD.whyDie != "") {
                    botPlayer.whyDieChat(bot, bD.whyDie);
                    bD.whyDie = "";
                }
                if (botPlayer.alive) {
                    if (player.team) {
                        if (botPlayer.team != player.team && (botPlayer.tick % 9 === 0)) {
                            botPlayer.team && (bot.sendWS("N"));
                            bot.sendWS("b", player.team);
                        }
                    }

                    let item = items.list[botPlayer.items[3]];
                    let a = botPlayer.itemCounts[item.group.id]
                    if ((a != undefined ? a : 0) < 201 && botPlayer.millPlace) {
                        if (botPlayer.inGame) {
                            bot.sendWS("D", botPlayer.moveDir);
                            if (izauto == 0) {
                                bot.sendWS("K", 1);
                                izauto = 1;
                            }
                            if (UTILS.getDist(oldXY, botPlayer, 0, 2) > 90) {
                                let aim = UTILS.getDirect(oldXY, botPlayer, 0, 2);
                                bot.place(3, aim + 7.7);
                                bot.place(3, aim - 7.7);
                                bot.place(3, aim);
                                oldXY = {
                                    x: botPlayer.x2,
                                    y: botPlayer.y2
                                };
                            }

                            if (botPlayer.tick % 90 === 0) {
                                let rand = Math.random() * Math.PI * 2;
                                botPlayer.moveDir = rand;
                                bot.sendWS("a", botPlayer.moveDir);
                            }
                        }
                        bot.fastGear();
                    } else if((a != undefined ? a : 0) > 296 && botPlayer.millPlace) {
                        botPlayer.millPlace = false;
                        // bot.sendWS("K", 1);
                        bot.fastGear();
                    } else {
                        if (botPlayer.inGame) {
                            if (botObj.length > 0) {
                                let buldingtoawdoin = botObj.filter((e) => e.active && e.isItem && UTILS.getDist(e, player, 0, 2) <= (600));
                                if (getEl("mode").value == 'fuckemup') {
                                    // if (getEl("mode").value == "clear") {
                                    bot.selectWeapon(botPlayer.weapons[1]);
                                    let gotoDist = UTILS.getDist(buldingtoawdoin[0], botPlayer, 0, 2);
                                    let gotoAim = UTILS.getDirect(buldingtoawdoin[0], botPlayer, 0, 2);
                                    nearObj = botObj.filter((e) => e.active && (findSID(buldingtoawdoin, e.sid) ? true : !(e.trap && (player.sid == e.owner.sid || player.findAllianceBySid(e.owner.sid)))) && e.isItem && UTILS.getDist(e, botPlayer, 0, 2) <= (items.weapons[botPlayer.weaponIndex].range + e.scale + 10)).sort(function(a, b) {
                                        return UTILS.getDist(a, botPlayer, 0, 2) - UTILS.getDist(b, botPlayer, 0, 2);
                                    })[0];
                                    if (nearObj) {
                                        let isPassed = UTILS.getDist(buldingtoawdoin[0], nearObj, 0, 0);
                                        if ((gotoDist - isPassed) > 0) {
                                            if (findSID(buldingtoawdoin, nearObj.sid) ? true : (nearObj.dmg || nearObj.trap)) {
                                                if (botPlayer.moveDir != undefined) {
                                                    botPlayer.moveDir = undefined;
                                                    bot.sendWS("a", botPlayer.moveDir);
                                                    bot.sendWS("D", botPlayer.nDir);
                                                }
                                            } else {
                                                botPlayer.moveDir = gotoAim;
                                                bot.sendWS("a", botPlayer.moveDir);
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            if (botPlayer.nDir != UTILS.getDirect(nearObj, botPlayer, 0, 2)) {
                                                botPlayer.nDir = UTILS.getDirect(nearObj, botPlayer, 0, 2);
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            if (izauto == 0) {
                                                bot.sendWS("K", 1);
                                                izauto = 1;
                                            }
                                            bot.buye(40, 0);
                                        } else {
                                            botPlayer.moveDir = gotoAim;
                                            bot.sendWS("a", botPlayer.moveDir);
                                            bot.sendWS("D", botPlayer.nDir);
                                            bot.fastGear();
                                        }
                                    } else {
                                        botPlayer.moveDir = gotoAim;
                                        bot.sendWS("a", botPlayer.moveDir);
                                        bot.sendWS("D", botPlayer.nDir);
                                        bot.fastGear();
                                    }
                                }
                            }



                            if (botObj.length > 0) {
                                if (getEl("mode").value == 'flex') {
                                    const dir = botPlayer.sid * ((Math.PI * 2) / botPlayer.sid);
                                    const x = Math.cos(Date.now() * 0.01) * 300 + player.x;
                                    const y = Math.sin(Date.now() * 0.01) * 300 + player.x;

                                    bot.sendWS("a", Math.atan2(y - botPlayer.y, x - botPlayer.x));

                                    const dist = Math.hypot(x - botPlayer.x, y - botPlayer.y);
                                    if (dist > 22) // 22 is player speed without booster hat
                                        return;
                                }
                            }


                            if (botObj.length > 0) {
                                nearObj = botObj.filter((e) => e.active && e.isItem && UTILS.getDist(e, botPlayer, 0, 2) <= (items.weapons[botPlayer.weaponIndex].range)).sort(function(a, b) {
                                    return UTILS.getDist(a, botPlayer, 0, 2) - UTILS.getDist(b, botPlayer, 0, 2);
                                })[0];

                                if (nearObj) {
                                    if (izauto == 0) {
                                        bot.sendWS("K", 1);
                                        izauto = 1;
                                    }
                                    if (botPlayer.nDir != UTILS.getDirect(nearObj, botPlayer, 0, 2)) {
                                        botPlayer.nDir = UTILS.getDirect(nearObj, botPlayer, 0, 2);
                                        bot.sendWS("D", botPlayer.nDir);
                                    }
                                    bot.buye(40, 0);
                                    bot.buye(11, 1);
                                } else {
                                    bot.fastGear();
                                    bot.buye(11, 1);
                                }
                                bot.buye(11, 1);
                                if (breakObjects.length > 0 && getEl("mode").value == 'clear') {
                                    // if (getEl("mode").value == "clear") {
                                    bot.selectWeapon(botPlayer.weapons[1]);
                                    let gotoDist = UTILS.getDist(breakObjects[0], botPlayer, 0, 2);
                                    let gotoAim = UTILS.getDirect(breakObjects[0], botPlayer, 0, 2);
                                    nearObj = botObj.filter((e) => e.active && (findSID(breakObjects, e.sid) ? true : !(e.trap && (player.sid == e.owner.sid || player.findAllianceBySid(e.owner.sid)))) && e.isItem && UTILS.getDist(e, botPlayer, 0, 2) <= (items.weapons[botPlayer.weaponIndex].range + e.scale)).sort(function(a, b) {
                                        return UTILS.getDist(a, botPlayer, 0, 2) - UTILS.getDist(b, botPlayer, 0, 2);
                                    })[0];
                                    if (nearObj) {
                                        let isPassed = UTILS.getDist(breakObjects[0], nearObj, 0, 0);
                                        if ((gotoDist - isPassed) > 0) {
                                            if (findSID(breakObjects, nearObj.sid) ? true : (nearObj.dmg || nearObj.trap)) {
                                                if (botPlayer.moveDir != undefined) {
                                                    botPlayer.moveDir = undefined;
                                                    bot.sendWS("a", botPlayer.moveDir);
                                                    bot.sendWS("D", botPlayer.nDir);
                                                }
                                            } else {
                                                botPlayer.moveDir = gotoAim;
                                                bot.sendWS("a", botPlayer.moveDir);
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            if (botPlayer.nDir != UTILS.getDirect(nearObj, botPlayer, 0, 2)) {
                                                botPlayer.nDir = UTILS.getDirect(nearObj, botPlayer, 0, 2);
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            if (izauto == 0) {
                                                bot.sendWS("K", 1);
                                                izauto = 1;
                                            }
                                            bot.buye(40, 0);
                                            bot.fastGear();
                                        } else {
                                            botPlayer.moveDir = gotoAim;
                                            bot.sendWS("a", botPlayer.moveDir);
                                            bot.sendWS("D", botPlayer.nDir);
                                            bot.fastGear();
                                        }
                                    } else {
                                        botPlayer.moveDir = gotoAim;
                                        bot.sendWS("a", botPlayer.moveDir);
                                        bot.sendWS("D", botPlayer.nDir);
                                        bot.fastGear();
                                    }
                                    if (gotoDist > 300) {
                                        if (UTILS.getDist(oldXY, botPlayer, 0, 2) > 90) {
                                            let aim = UTILS.getDirect(oldXY, botPlayer, 0, 2);
                                            bot.place(3, aim + 7.7);
                                            bot.place(3, aim - 7.7);
                                            bot.place(3, aim);
                                            oldXY = {
                                                x: botPlayer.x2,
                                                y: botPlayer.y2
                                            };
                                        }
                                    }
                                }
                            }

                            if (botObj.length > 0 && getEl("mode").value == 'zync') {
                                let wdaawdwad = botObj.filter((e) => e.active && e.isItem && UTILS.getDist(e, player, 0, 2) <= (items.weapons[botPlayer.weaponIndex].range + e.scale));

                                if(!wdaawdwad.length) {
                                    if(zoon == 'no')
                                        bot.sendWS("D", UTILS.getDirect(player, botPlayer, 0, 2));
                                    bot.sendWS("a", caf(player, botPlayer) + Math.PI);
                                }

                                if(wdaawdwad.length) {
                                    let gotoDist = UTILS.getDist(wdaawdwad[0], botPlayer, 0, 2);
                                    let gotoAim = UTILS.getDirect(wdaawdwad[0], botPlayer, 0, 2);
                                    nearObj = botObj.filter((e) => e.active && (findSID(wdaawdwad, e.sid) ? true : !(e.trap && (player.sid == e.owner.sid || player.findAllianceBySid(e.owner.sid)))) && e.isItem && UTILS.getDist(e, botPlayer, 0, 2) <= (items.weapons[botPlayer.weaponIndex].range + e.scale)).sort(function(a, b) {
                                        return UTILS.getDist(a, botPlayer, 0, 2) - UTILS.getDist(b, botPlayer, 0, 2);
                                    })[0];
                                    if (nearObj) {
                                        let isPassed = UTILS.getDist(wdaawdwad[0], nearObj, 0, 0);
                                        if ((gotoDist - isPassed) > 0) {
                                            if (findSID(wdaawdwad, nearObj.sid) ? true : (nearObj.dmg || nearObj.trap)) {
                                                if (botPlayer.moveDir != undefined) {
                                                    botPlayer.moveDir = undefined;
                                                    bot.sendWS("a", botPlayer.moveDir);
                                                    bot.sendWS("D", botPlayer.nDir);
                                                }
                                            } else {
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            if (botPlayer.nDir != UTILS.getDirect(nearObj, botPlayer, 0, 2)) {
                                                botPlayer.nDir = UTILS.getDirect(nearObj, botPlayer, 0, 2);
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            if (izauto == 0) {
                                                bot.sendWS("K", 1);
                                                izauto = 1;
                                            }
                                            bot.buye(40, 0);
                                            bot.fastGear();
                                        } else {
                                            if(zoon == 'no')
                                                bot.sendWS("D", UTILS.getDirect(nearObj, botPlayer, 0, 2));
                                            if(cdf(player, botPlayer) <= 110)
                                                bot.sendWS("a", undefined);
                                            else
                                                bot.sendWS("a", caf(player, botPlayer) + Math.PI);
                                        }
                                    } else {
                                        if(wdaawdwad.length) {
                                            if(zoon == 'no')
                                                bot.sendWS("D", UTILS.getDirect(wdaawdwad[0], botPlayer, 0, 2));
                                            if(cdf(player, botPlayer) <= 110)
                                                bot.sendWS("a", undefined);
                                            else
                                                bot.sendWS("a", caf(player, botPlayer) + Math.PI);
                                        } else {
                                            if(zoon == 'no')
                                                bot.sendWS("D", UTILS.getDirect(player, botPlayer, 0, 2));
                                            if(cdf(player, botPlayer) <= 110)
                                                bot.sendWS("a", undefined);
                                            else
                                                bot.sendWS("a", caf(player, botPlayer) + Math.PI);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if (type == "H") {
                let tmpData = data[0];
                for (let i = 0; i < tmpData.length;) {
                    botObjManager.add(tmpData[i], tmpData[i + 1], tmpData[i + 2], tmpData[i + 3], tmpData[i + 4],
                                      tmpData[i + 5], items.list[tmpData[i + 6]], true, (tmpData[i + 7] >= 0 ? {
                        sid: tmpData[i + 7]
                    } : null));
                    i += 8;
                }
            }
            if (type == "N") {
                let index = data[0];
                let value = data[1];
                if (botPlayer) {
                    botPlayer[index] = value;
                }
            }
            if (type == "O") {
                if (data[0] == botPlayer.sid) {
                    botPlayer.oldHealth = botPlayer.health;
                    botPlayer.health = data[1];
                    botPlayer.judgeShame();
                    if (botPlayer.oldHealth > botPlayer.health) {
                        if (botPlayer.shameCount < 5) {
                            for (let i = 0; i < 2; i++) {
                                bot.place(0, botPlayer.nDir);
                            }

                        } else {
                            setTimeout(() => {
                                for (let i = 0; i < 2; i++) {
                                    bot.place(0, botPlayer.nDir);
                                }
                            }, 95);
                        }
                    }
                }
            }
            if (type == "Q") {
                let sid = data[0];
                botObjManager.disableBySid(sid);
            }
            if (type == "R") {
                let sid = data[0];
                if (botPlayer.alive) botObjManager.removeAllItems(sid);
            }
            if (type == "S") {
                let index = data[0];
                let value = data[1];
                if (botPlayer) {
                    botPlayer.itemCounts[index] = value;
                }
            }
            if (type == "U") {
                if (data[0] > 0) {
                    if(getEl("setup").value == 'dm') {
                        if (botPlayer.upgraded == 0) {
                            bot.sendUpgrade(7);
                        } else if (botPlayer.upgraded == 1) {
                            bot.sendUpgrade(17);
                        } else if (botPlayer.upgraded == 2) {
                            bot.sendUpgrade(31);
                        } else if (botPlayer.upgraded == 3) {
                            bot.sendUpgrade(23);
                        } else if (botPlayer.upgraded == 4) {
                            bot.sendUpgrade(9);
                        } else if (botPlayer.upgraded == 5) {
                            bot.sendUpgrade(34);
                        } else if (botPlayer.upgraded == 6) {
                            bot.sendUpgrade(12);
                        } else if (botPlayer.upgraded == 7) {
                            bot.sendUpgrade(15);
                        }
                    } else if(getEl("setup").value == 'dr') {
                        if (botPlayer.upgraded == 0) {
                            bot.sendUpgrade(7);
                        } else if (botPlayer.upgraded == 1) {
                            bot.sendUpgrade(17);
                        } else if (botPlayer.upgraded == 2) {
                            bot.sendUpgrade(31);
                        } else if (botPlayer.upgraded == 3) {
                            bot.sendUpgrade(23);
                        } else if (botPlayer.upgraded == 4) {
                            bot.sendUpgrade(9);
                        } else if (botPlayer.upgraded == 5) {
                            bot.sendUpgrade(34);
                        } else if (botPlayer.upgraded == 6) {
                            bot.sendUpgrade(12);
                        } else if (botPlayer.upgraded == 7) {
                            bot.sendUpgrade(13);
                        }
                    } else if(getEl("setup").value == 'kh') {
                        if (botPlayer.upgraded == 0) {
                            bot.sendUpgrade(3);
                        } else if (botPlayer.upgraded == 1) {
                            bot.sendUpgrade(17);
                        } else if (botPlayer.upgraded == 2) {
                            bot.sendUpgrade(31);
                        } else if (botPlayer.upgraded == 3) {
                            bot.sendUpgrade(27);
                        } else if (botPlayer.upgraded == 4) {
                            bot.sendUpgrade(10);
                        } else if (botPlayer.upgraded == 5) {
                            bot.sendUpgrade(34);
                        } else if (botPlayer.upgraded == 6) {
                            bot.sendUpgrade(4);
                        } else if (botPlayer.upgraded == 7) {
                            bot.sendUpgrade(25);
                        }
                    } else if(getEl("setup").value == 'zd') {
                        if (botPlayer.upgraded == 0) {
                            bot.sendUpgrade(3);
                        } else if (botPlayer.upgraded == 1) {
                            bot.sendUpgrade(17);
                        } else if (botPlayer.upgraded == 2) {
                            bot.sendUpgrade(31);
                        } else if (botPlayer.upgraded == 3) {
                            bot.sendUpgrade(27);
                        } else if (botPlayer.upgraded == 4) {
                            bot.sendUpgrade(9);
                        } else if (botPlayer.upgraded == 5) {
                            bot.sendUpgrade(34);
                        } else if (botPlayer.upgraded == 6) {
                            bot.sendUpgrade(12);
                        } else if (botPlayer.upgraded == 7) {
                            bot.sendUpgrade(15);
                        }
                    }
                    botPlayer.upgraded++;
                }
            }
            if (type == "V") {
                let tmpData = data[0];
                let wpn = data[1];
                if (tmpData) {
                    if (wpn) botPlayer.weapons = tmpData;
                    else botPlayer.items = tmpData;
                }

            }
            if (type == "5") {
                let type = data[0];
                let id = data[1];
                let index = data[2];
                if (index) {
                    if (!type)
                        botPlayer.tails[id] = 1;
                    else
                        botPlayer.latestTail = id;
                } else {
                    if (!type)
                        botPlayer.skins[id] = 1;
                    else
                        botPlayer.latestSkin = id;
                }
            }

            if (type == "6") {
                let id = data[0];
                let mzg = data[1]+'';
                if(id == player.sid && mzg.includes("Sync")) {
                    bot.zync(botPlayer.near);
                }
            }
        };
        bot.onclose = function() {
            botPlayer.inGame = false;
            bD.inGame = false;
        };
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

    // PREPARE MENU BACKGROUND:
    function prepareMenuBackground() {
        let tmpMid = config.mapScale / 2;
        let attempts = 0;
        for (let i = 0; i < items.list.length * 3;) {
            if (attempts >= 1000) break;
            attempts++;
            let type = items.list[UTILS.randInt(0, items.list.length - 1)];
            let data = {
                x: tmpMid + UTILS.randFloat(-1000, 1000),
                y: tmpMid + UTILS.randFloat(-600, 600),
                dir: UTILS.fixTo(Math.random() * (Math.PI * 2), 2)
            };
            if (objectManager.checkItemLocation(data.x, data.y, type.scale, 0.6, type.id, true)) {
                objectManager.add(i, data.x, data.y, data.dir, type.scale, type.id, type);
            } else {
                continue;
            }
            i++;
        }
    }
    const speed = 35;
    // RENDER PLAYERS:
    function renderDeadPlayers(xOffset, yOffset) {
        mainContext.fillStyle = "#91b2db";
        const currentTime = Date.now();
        deadPlayers.filter(dead => dead.active).forEach((dead) => {
            if (!dead.startTime) {
                dead.startTime = currentTime;
                dead.angle = 0;
                dead.radius = 0.1;
            }
            const timeElapsed = currentTime - dead.startTime;
            const maxAlpha = 1;
            dead.alpha = Math.max(0, maxAlpha - (timeElapsed / 3000));
            dead.animate(delta);
            mainContext.globalAlpha = dead.alpha;
            mainContext.strokeStyle = outlineColor;
            mainContext.save();
            mainContext.translate(dead.x - xOffset, dead.y - yOffset);
            dead.radius -= 0.001;
            dead.angle += 0.0174533;
            const moveSpeed = 1;
            const x = dead.radius * Math.cos(dead.angle);
            const y = dead.radius * Math.sin(dead.angle);
            dead.x += x * moveSpeed;
            dead.y += y * moveSpeed;
            mainContext.rotate(dead.angle);
            renderDeadPlayer(dead, mainContext);
            mainContext.restore();
            mainContext.fillStyle = "#91b2db";
            if (timeElapsed >= 3000) {
                dead.active = false;
                dead.startTime = null;
            }
        });
    }
    // RENDER PLAYERS:
    function renderPlayers(f, d, zIndex) {
        be.globalAlpha = 1;
        be.fillStyle = "#91b2db";
        for (var i = 0; i < players.length; ++i) {
            _ = players[i];
            if (_.zIndex == zIndex) {
                _.animate(delta);
                if (configs.TransparentRenderingOfPlayers) {
                    be.globalAlpha = 0.233;
                } else {
                    be.globalAlpha = 1;
                }

                if (_.visible) {
                    _.skinRot += (0.002 * delta);
                    tmpDir = (!configs.showDir && !useWasd && _ == player) ? configs.attackDir ? getVisualDir() : getSafeDir() : (_.dir||0);

                    if (configs.SmothMoveLerpPredicteons) {
                        if (!_.zeezezezezzeezez) _.zeezezezezzeezez = { x: _.x, y: _.y };
                        _.zeezezezezzeezez.x += (_.x - _.zeezezezezzeezez.x) * 0.233;
                        _.zeezezezezzeezez.y += (_.y - _.zeezezezezzeezez.y) * 0.233;
                    } else {
                        _.zeezezezezzeezez = { x: _.x, y: _.y };
                    }

                    be.save();
                    be.translate(_.zeezezezezzeezez.x - f, _.zeezezezezzeezez.y - d);
                    // RENDER PLAYER:
                    be.rotate(tmpDir + _.dirPlus);
                    renderPlayer(_, be);
                    be.restore();

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
        // TAIL/CAPE:
        renderTail2(13, ctxt, obj);
        // WEAPON BELLOW HANDS:
        if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
            renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant || 0].src || "", obj.scale, 0, ctxt);
            if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
                renderProjectile(obj.scale, 0,
                                 items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
            }
        }
        // HANDS:
        ctxt.fillStyle = "#ececec";
        renderCircle(obj.scale * Math.cos(handAngle), (obj.scale * Math.sin(handAngle)), 14);
        renderCircle((obj.scale * oHandDist) * Math.cos(-handAngle * oHandAngle),
                     (obj.scale * oHandDist) * Math.sin(-handAngle * oHandAngle), 14);
        // WEAPON ABOVE HANDS:
        if (obj.buildIndex < 0 && items.weapons[obj.weaponIndex].aboveHand) {
            renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant || 0].src || "", obj.scale, 0, ctxt);
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
        // SKIN
        renderSkin2(48, ctxt, null, obj)
    }

    // RENDER PLAYER:
    function renderPlayer(obj, ctxt) {
        ctxt = ctxt || mainContext;
        ctxt.lineWidth = outlineWidth;
        ctxt.lineJoin = "miter";
        let handAngle = (Math.PI / 4) * (items.weapons[obj.weaponIndex].armS || 1);
        let oHandAngle = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndS || 1) : 1;
        let oHandDist = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndD || 1) : 1;

        let katanaMusket = (obj == player && obj.weapons[0] == 3 && obj.weapons[1] == 15);

        // TAIL/CAPE:
        if (obj.tailIndex > 0) {
            renderTailTextureImage(obj.tailIndex, ctxt, obj);
        }

        // WEAPON BELLOW HANDS:
        if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
            renderTool(items.weapons[katanaMusket ? 4 : obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
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
            tmpImage.onload = function () {
                this.isLoaded = true,
                    this.onload = null
            }
                ,
                tmpImage.src = getTexturePackImg(index, "hat", index),
                skinSprites[index + (txt ? "lol" : 0)] = tmpImage,
                tmpSkin = tmpImage
        }
        var tmpObj = parentSkin || skinPointers[index];
        if (!tmpObj) {
            for (var i = 0; i < hats.length; ++i) {
                if (hats[i].id == index) {
                    tmpObj = hats[i];
                    break;
                }
            }
            skinPointers[index] = tmpObj;
        }
        if (tmpSkin.isLoaded)
            ctxt.drawImage(tmpSkin, -tmpObj.scale / 2, -tmpObj.scale / 2, tmpObj.scale, tmpObj.scale);
        if (!parentSkin && tmpObj.topSprite) {
            ctxt.save();
            ctxt.rotate(owner.skinRot);
            renderSkin(index + "_top", ctxt, tmpObj, owner);
            ctxt.restore();
        }
    }
    var newHatImgs = {
        6: "https://moomoo.io/img/hats/hat_6.png",
        7: "https://i.imgur.com/EBzS6kP.png",
        15: "https://i.imgur.com/YRQ8Ybq.png",
        50:"https://i.imgur.com/tdkcow1.png",
        12: "https://i.imgur.com/uQHU4zc.png",
        40: "https://moomoo.io/img/hats/hat_47.png",
        26: "https://i.imgur.com/I0xGtyZ.png",
        55: "https://i.imgur.com/gGGkBnz.png",
        20: "https://i.imgur.com/f5uhWCk.png",
        11: "https://i.imgur.com/yfqME8H.png",
        22: "http://i.imgur.com/CoeJltc.png",
        58: "https://i.imgur.com/uYgDtcZ.png",
        23: "https://i.imgur.com/V8JrIwv.png",
        52: "https://i.imgur.com/hmJrVQz.png",
        53: "https://imgur.com/a/vugtA7z",
    };
    var newAccImgs = {
        18: "http://i.imgur.com/1eGwp3R.png",
        21: "http://i.imgur.com/PvZNc9Q.png",
        19: "https://i.imgur.com/tgfyha4.png",
    };
    var emeraldSprites = {
        "hand axe": "https://i.imgur.com/99Xb4Lm.png",
        bat: "https://i.imgur.com/VlQlb1Z.png",
        "hunting bow": "https://i.imgur.com/2aW8Wmw.png",
        crossbow: "https://i.imgur.com/2JWfFFW.png",
        "repeater crossbow": "https://i.imgur.com/JuLVN8T.png",
        daggers: "https://i.imgur.com/4VedRsh.png",
        "mc grabby": "https://i.imgur.com/F1qfrLj.png",
        "great axe": "https://i.imgur.com/kGbXWqw.png",
        "great hammer": "https://i.imgur.com/6qCSFSZ.png",
        "tool hammer": "https://i.imgur.com/xnVbXSB.png",
        katana: "https://i.imgur.com/AZP6Aci.png",
        stick: "https://i.imgur.com/NbSpR2M.png",
        polearm: "https://i.imgur.com/HtWa9ez.png",
        "short sword": "https://i.imgur.com/gmrPsRk.png",
    };
    var newWeaponImgs = {
        sword_1: "https://i.imgur.com/nzy3kz1.png",
        sword_1_g: "https://i.imgur.com/wOTr8TG.png",
        sword_1_d: "https://i.imgur.com/k3eCuYF.png",
        sword_1_r: "https://i.imgur.com/V9dzAbF.png",
        samurai_1: "https://i.imgur.com/PUTTmVS.png",
        samurai_1_g: "https://i.imgur.com/QKBc2ou.png",
        samurai_1_d: "https://i.imgur.com/4ZxIJQM.png",
        //samurai_1_r: "removed cuz broken...",
        spear_1: "https://i.imgur.com/mcI9MTd.png",
        spear_1_g: "https://i.imgur.com/jKDdyvc.png",
        spear_1_d: "https://i.imgur.com/HSWcyku.png",
        spear_1_r: "https://i.imgur.com/UY7SV7j.png",
        great_hammer_1: "https://i.imgur.com/CVCwqES.png",
        great_hammer_1_d: "https://i.imgur.com/Fg93gj3.png",
        great_hammer_1_r: "https://i.imgur.com/tmUzurk.png",
        bat_1_g: "https://i.imgur.com/ivLPh10.png",
        bat_1_d: "https://i.imgur.com/phXTNsa.png",
        bat_1_r: "https://i.imgur.com/6ayjbIz.png",
        dagger_1_d: "https://i.imgur.com/ROTb7Ks.png",
        dagger_1_r: "https://i.imgur.com/CDAmjux.png",
        stick_1_g: "https://i.imgur.com/NOaBBRd.png",
        stick_1_d: "https://i.imgur.com/RnkmWgs.png",
        stick_1_r: "https://i.imgur.com/aEs3FSU.png",
        great_axe_1_d: "https://i.imgur.com/aAJyHBB.png",
        great_axe_1_r: "https://i.imgur.com/UZ2HcQw.png",
        axe_1_d: "https://i.imgur.com/OU5os0h.png",
        axe_1_r: "https://i.imgur.com/kr8H9g7.png",
        dagger_1_d: "https://i.imgur.com/ROTb7Ks.png",
        dagger_1_r: "https://i.imgur.com/CDAmjux.png",
        hammer_1: "https://i.imgur.com/0XKpSVI.png",
        hammer_1_d: "https://i.imgur.com/WPWU8zC.png",
        hammer_1_r: "https://i.imgur.com/oRXUfW8.png",
        bow_1: "https://i.imgur.com/Dgv1gZm.png",

    };
    var newAnimalImgs = {
        pig_1: "https://i.imgur.com/Nu06zyW.png",
        wolf_2: "https://i.imgur.com/wANrStd.png",
        wolf_1: "https://i.imgur.com/KfFOjKk.png",
        bull_2: "https://i.imgur.com/LwsVi4x.png",
        bull_1: "https://i.imgur.com/eKlFlSj.png",
        chicken_1: "https://i.imgur.com/3dsSBa2.png",
        enemy: "https://i.imgur.com/MKOvEr6.png",
        cow_1: "https://i.imgur.com/7kuCRCr.png",
    };

    function getTexturePackImg(id, type, id2, sprite) {
        if (newHatImgs[id] && type == "hat") {
            return newHatImgs[id];
        } else if (newAccImgs[id] && type == "acc") {
            return newAccImgs[id];
        } else if (newWeaponImgs[id] && type == "weapon") {
            return newWeaponImgs[id];
        } else if (newAnimalImgs[id] && type == "animal") {
            return newAnimalImgs[id];
        } else if (type == "acc") {
            return ".././img/accessories/access_" + id + ".png";
        } else if (type == "hat") {
            return ".././img/hats/hat_" + id + ".png";
        } else if (type == "weapon") {
            return ".././img/weapons/" + id + ".png";
        } else if (type == "animal") {
            return ".././img/animals/" + id + ".png";
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
            tmpImage.onload = function () {
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
        if (tmpSkin.isLoaded) ctxt.drawImage(tmpSkin, -_.scale / 2, -_.scale / 2, _.scale, _.scale);
        if (!parentSkin && _.topSprite && index != 11) {
            ctxt.save();
            ctxt.rotate(owner.skinRot);
            renderSkin(index + "_top", ctxt, _, owner);
            ctxt.restore();
        }
    }

    // RENDER TAIL:
    var FlareZAcc = {
        18: "http://i.imgur.com/1eGwp3R.png",
        21: "http://i.imgur.com/PvZNc9Q.png",
        19: "https://i.imgur.com/tgfyha4.png",
    };
    function setTailTextureImage(id, type, id2) {
        if (true) {
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
        if (!(tmpSkin = accessSprites[index + (txt ? "lol" : 0)])) {
            var tmpImage = new Image();
            tmpImage.onload = function() {
                this.isLoaded = true,
                    this.onload = null
            }
                ,
                tmpImage.src = setTailTextureImage(index, "acc"),//".././img/accessories/access_" + index + ".png";
                accessSprites[index + (txt ? "lol" : 0)] = tmpImage,
                tmpSkin = tmpImage;
        }
        var tmpObj = accessPointers[index];
        if (!tmpObj) {
            for (var i = 0; i < accessories.length; ++i) {
                if (accessories[i].id == index) {
                    tmpObj = accessories[i];
                    break;
                }
            }
            accessPointers[index] = tmpObj;
        }
        if (tmpSkin.isLoaded) {
            ctxt.save();
            ctxt.translate(-20 - (tmpObj.xOff||0), 0);
            if (tmpObj.spin)
                ctxt.rotate(owner.skinRot);
            ctxt.drawImage(tmpSkin, -(tmpObj.scale/2), -(tmpObj.scale/2), tmpObj.scale, tmpObj.scale);
            ctxt.restore();
        }
    }

    let accessSprites = {};
    let accessPointers = {};
    var txt = true;

    function renderTail(index, ctxt, owner) {
        tmpSkin = accessSprites[index];
        if (!tmpSkin) {
            let tmpImage = new Image();
            tmpImage.onload = function() {
                this.isLoaded = true;
                this.onload = null;
            };
            tmpImage.src = "https://moomoo.io/img/accessories/access_" + index + ".png";
            accessSprites[index] = tmpImage;
            tmpSkin = tmpImage;
        }
        let tmpObj = accessPointers[index];
        if (!tmpObj) {
            for (let i = 0; i < accessories.length; ++i) {
                if (accessories[i].id == index) {
                    tmpObj = accessories[i];
                    break;
                }
            }
            accessPointers[index] = tmpObj;
        }
        if (tmpSkin.isLoaded) {
            ctxt.save();
            ctxt.translate(-20 - (tmpObj.xOff || 0), 0);
            if (tmpObj.spin)
                ctxt.rotate(owner.skinRot);
            ctxt.drawImage(tmpSkin, -(tmpObj.scale / 2), -(tmpObj.scale / 2), tmpObj.scale, tmpObj.scale);
            ctxt.restore();
        }
    }

    var accessSprites2 = {};
    var accessPointers2 = {};
    function renderTail2(index, ctxt, owner) {
        tmpSkin = accessSprites2[index];
        if (!tmpSkin) {
            var tmpImage = new Image();
            tmpImage.onload = function() {
                this.isLoaded = true;
                this.onload = null;
            };
            tmpImage.src = "https://moomoo.io/img/accessories/access_" + index + ".png";
            accessSprites2[index] = tmpImage;
            tmpSkin = tmpImage;
        }
        var tmpObj = accessPointers2[index];
        if (!tmpObj) {
            for (var i = 0; i < accessories.length; ++i) {
                if (accessories[i].id == index) {
                    tmpObj = accessories[i];
                    break;
                }
            }
            accessPointers2[index] = tmpObj;
        }
        if (tmpSkin.isLoaded) {
            ctxt.save();
            ctxt.translate(-20 - (tmpObj.xOff||0), 0);
            if (tmpObj.spin)
                ctxt.rotate(owner.skinRot);
            ctxt.drawImage(tmpSkin, -(tmpObj.scale/2), -(tmpObj.scale/2), tmpObj.scale, tmpObj.scale);
            ctxt.restore();
        }
    }


    // RENDER TOOL:
    let toolSprites = {};
    function renderTool(obj, variant, x, y, ctxt) {
        let tmpSrc = obj.src + (variant || "");
        let tmpSprite = toolSprites[tmpSrc];
        if (!tmpSprite) {
            tmpSprite = new Image();
            tmpSprite.onload = function () {
                this.isLoaded = true;
            };
            //tmpSprite.src = "https://moomoo.io/img/weapons/" + tmpSrc + ".png";
            tmpSprite.src = getTexturePackImg(tmpSrc, "weapon", variant, obj);
            toolSprites[tmpSrc] = tmpSprite;
        }
        if (tmpSprite.isLoaded) ctxt.drawImage(tmpSprite, x + obj.xOff - obj.length / 2, y + obj.yOff - obj.width / 2, obj.length, obj.width);
    }

    // RENDER PROJECTILES:
    function renderProjectiles(layer, xOffset, yOffset) {
        for (let i = 0; i < projectiles.length; i++) {
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
    let projectileSprites = {};//fz iz zexy

    function renderProjectile(x, y, obj, ctxt, debug) {
        if (obj.src) {
            let tmpSrc = items.projectiles[obj.indx].src;
            let tmpSprite = projectileSprites[tmpSrc];
            if (!tmpSprite) {
                tmpSprite = new Image();
                tmpSprite.onload = function () {
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
            tmpImg.onload = function () {
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

    let isNight = false;
    // RENDER GAME OBJECTS:
    let gameObjectSprites = {};
    function getResSprite(obj) {
        let biomeID = (obj.y>=config.mapScale-config.snowBiomeTop)?2:((obj.y<=config.snowBiomeTop)?1:0);
        let tmpIndex = (obj.type + "_" + obj.scale + "_" + biomeID);
        let tmpSprite = gameObjectSprites[tmpIndex];
        if (!tmpSprite) {
            let blurScale = 15;
            let tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = tmpCanvas.height = (obj.scale * 2.1) + outlineWidth;
            let tmpContext = tmpCanvas.getContext('2d');
            tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
            tmpContext.rotate(UTILS.randFloat(0, Math.PI));
            tmpContext.strokeStyle = outlineColor;
            tmpContext.lineWidth = outlineWidth;
            if (isNight) {
                tmpContext.shadowBlur = blurScale;
                tmpContext.shadowColor = `rgba(0, 0, 0, ${obj.alpha})`;
            }
            if (obj.type == 0) {
                let tmpScale;
                let tmpCount = UTILS.randInt(5, 7);
                tmpContext.globalAlpha = isNight ? 0.6 : 0.8;
                for (let i = 0; i < 2; ++i) {
                    tmpScale = tmpObj.scale * (!i?1:0.5);
                    renderBlob(tmpContext, tmpCount, tmpScale, tmpScale * 0.7);
                    tmpContext.fillStyle = (obj.y >= config.mapScale - config.snowBiomeTop) ? (!i?"#e3b5a7" : "#fcc9b9") : !biomeID?(!i?"#e3b5a7" : "#fcc9b9"):(!i?"#e3f1f4":"#fff");
                    tmpContext.fill();
                    if (!i) {
                        tmpContext.stroke();
                        tmpContext.shadowBlur = null;
                        tmpContext.shadowColor = null;
                        tmpContext.globalAlpha = 1;
                    }
                }
            } else if (obj.type == 1) {
                renderBlob(tmpContext, 6, tmpObj.scale, tmpObj.scale * 0.7);
                tmpContext.fillStyle = biomeID == 2 ? "#e3b5a7" : (biomeID?"#e3f1f4":"#89a54c");
                tmpContext.fill();
                tmpContext.stroke();

                //tmpContext.shadowBlur = null;
                //tmpContext.shadowColor = null;

                tmpContext.fillStyle = biomeID == 2 ? "#fcc9b9" : (biomeID?"#6a64af":"#c15555");
                let tmpRange;
                let berries = 4;
                let rotVal = (Math.PI * 2) / berries;
                for (let i = 0; i < berries; ++i) {
                    tmpRange = UTILS.randInt(tmpObj.scale/3.5, tmpObj.scale/2.3);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i), UTILS.randInt(10, 12), tmpContext);
                }
            } else if (obj.type == 2 || obj.type == 3) {
                tmpContext.fillStyle = (obj.type==2)?(biomeID==2?"#938d77":"#939393"):"#e0c655";
                renderStar(tmpContext, 3, obj.scale, obj.scale);
                tmpContext.fill();
                tmpContext.stroke();

                tmpContext.shadowBlur = null;
                tmpContext.shadowColor = null;

                tmpContext.fillStyle = (obj.type==2)?(biomeID==2?"#b2ab90":"#bcbcbc"):"#ebdca3";
                renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
                tmpContext.fill();
            }
            tmpSprite = tmpCanvas;
            gameObjectSprites[tmpIndex] = tmpSprite;
        }
        return tmpSprite;
    }
    // Safe observe usage — choose a valid node and observe only if everything is OK
    // (Replace the old observe code with this.)

    // find a candidate node
    const safeNode = (typeof node !== 'undefined' && node) ? node
    : (typeof target !== 'undefined' && target) ? target
    : null;

    if (safeNode instanceof Element) {
        try {
            // ensure observer exists, create it if not
            if (typeof observer === 'undefined' || !(observer instanceof IntersectionObserver)) {
                try {
                    observer = new IntersectionObserver((entries) => {
                        entries.forEach(entry => {
                            try {
                                if (entry.isIntersecting) {
                                    // placeholder reaction
                                    // console.log('Intersect:', entry.target);
                                }
                            } catch(e){/* ignore per-entry errors */}
                        });
                    });
                } catch (e) {
                    console.warn('[SafeObserver] cannot create IntersectionObserver:', e);
                }
            }
            if (observer && typeof observer.observe === 'function') {
                observer.observe(safeNode);
            }
        } catch (e) {
            console.warn('[SafeObserver] observe failed:', e, safeNode, observer);
        }
    } else {
        console.warn('[SafeObserver] skipped observe — no valid element:', safeNode);
    }


    // GET ITEM SPRITE:
    let itemSprites = [];

    function getItemSprite(obj, asIcon) {
        let tmpSprite = itemSprites[obj.id];
        if (!tmpSprite || asIcon) {
            let blurScale = !asIcon ? 20 : 5;
            let tmpCanvas = document.createElement("canvas");
            let reScale = ((!asIcon && obj.name == "windmill") ? items.list[4].scale : obj.scale);
            tmpCanvas.width = tmpCanvas.height = (reScale * 2.5) + outlineWidth + (items.list[obj.id].spritePadding || 0) + blurScale;

            let tmpContext = tmpCanvas.getContext("2d");
            tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
            tmpContext.rotate(asIcon ? 0 : (Math.PI / 2));
            tmpContext.strokeStyle = outlineColor;
            tmpContext.lineWidth = outlineWidth * (asIcon ? (tmpCanvas.width / 81) : 1);
            if (!asIcon) {
                tmpContext.shadowBlur = 8;
                tmpContext.shadowColor = `rgba(0, 0, 0, 0.2)`;
            }

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
                tmpContext.fillStyle = "#a5974c";
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
            tmpSprite = tmpCanvas;
            if (!asIcon)
                itemSprites[obj.id] = tmpSprite;
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
            tmpContext.fillStyle = "#a5974c";
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
            // let blurScale = isNight ? 20 : 0;
            let tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = tmpCanvas.height = obj.scale * 2.5 + outlineWidth + (items.list[obj.id].spritePadding || 0) + 0;
            let tmpContext = tmpCanvas.getContext("2d");
            tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
            tmpContext.rotate(Math.PI / 2);
            tmpContext.strokeStyle = outlineColor;
            tmpContext.lineWidth = outlineWidth;
            // if (isNight) {
            //     tmpContext.shadowBlur = 20;
            //     tmpContext.shadowColor = `rgba(0, 0, 0, ${Math.min(0.3, obj.alpha)})`;
            // }
            if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" || obj.name == "spinning spikes") {
                tmpContext.fillStyle = obj.name == "poison spikes" ? "#7b935d" : "#939393";
                let tmpScale = obj.scale * 0.6;
                renderStar(tmpContext, obj.name == "spikes" ? 5 : 6, obj.scale, tmpScale);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, tmpScale, tmpContext);
                tmpContext.fillStyle = "#cc5151";
                renderCircle(0, 0, tmpScale / 2, tmpContext, true);
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
    function getMarkSprite(obj, tmpContext, tmpX, tmpY) {
        let center = {
            x: screenWidth / 2,
            y: screenHeight / 2,
        };
        tmpContext.lineWidth = outlineWidth;
        mainContext.globalAlpha = 0.2;
        tmpContext.strokeStyle = outlineColor;
        tmpContext.save();
        tmpContext.translate(tmpX, tmpY);
        tmpContext.rotate(90**10);
        if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" || obj.name == "spinning spikes") {
            tmpContext.fillStyle = (obj.name == "poison spikes")?"#7b935d":"#939393";
            var tmpScale = (obj.scale);
            renderStar(tmpContext, (obj.name == "spikes")?5:6, obj.scale, tmpScale);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, tmpScale, tmpContext);
            if (player && obj.owner && player.sid != obj.owner.sid && !tmpObj.findAllianceBySid(obj.owner.sid)) {
                tmpContext.fillStyle = "#a34040";
            } else {
                tmpContext.fillStyle = "#c9b758";
            }
            renderCircle(0, 0, tmpScale/2, tmpContext, true);
        } else if (obj.name == "turret") {
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#939393";
            let tmpLen = 50;
            renderRect(0, -tmpLen / 2, obj.scale * 0.9, tmpLen, tmpContext);
            renderCircle(0, 0, obj.scale * 0.6, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
        } else if (obj.name == "teleporter") {
            tmpContext.fillStyle = "#7e7f82";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.rotate(Math.PI / 4);
            tmpContext.fillStyle = "#d76edb";
            renderCircle(0, 0, obj.scale * 0.5, tmpContext, true);
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
        } else if (obj.name == "windmill" || obj.name == "faster windmill" || obj.name == "power mill") {
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fillStyle = "#c9b758";
            renderRectCircle(0, 0, obj.scale * 1.5, 29, 4, tmpContext);
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, obj.scale * 0.5, tmpContext);

        } else if (obj.name == "pit trap") {
            tmpContext.fillStyle = "#a5974c";
            renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
            tmpContext.fill();
            tmpContext.stroke();
            if (player && obj.owner && player.sid != obj.owner.sid && !tmpObj.findAllianceBySid(obj.owner.sid)) {
                tmpContext.fillStyle = "#a34040";
            } else {
                tmpContext.fillStyle = outlineColor;
            }
            renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
            tmpContext.fill();
        }
        tmpContext.restore();
    }

    // OBJECT ON SCREEN:
    function isOnScreen(x, y, s) {
        return (x + s >= 0 && x - s <= maxScreenWidth && y + s >= 0 && (y,
                                                                        s,
                                                                        maxScreenHeight));
    }

    // RENDER GAME OBJECTS:
    function renderGameObjects(layer, xOffset, yOffset) {
        let tmpSprite;
        let tmpX;
        let tmpY;
        liztobj.forEach((tmp) => {
            tmpObj = tmp;
            if (tmpObj.active && liztobj.includes(tmp) && tmpObj.render) {
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
                        mainContext.drawImage(tmpSprite, -(tmpSprite.width / 2), -(tmpSprite.height / 2));

                        if (tmpObj.blocker) {
                            mainContext.strokeStyle = "#db6e6e";
                            mainContext.globalAlpha = 0.3;
                            mainContext.lineWidth = 6;
                            renderCircle(0, 0, tmpObj.blocker, mainContext, false, true);
                        }
                        mainContext.restore();
                    } else {
                        tmpSprite = getResSprite(tmpObj);
                        mainContext.drawImage(tmpSprite, tmpX - (tmpSprite.width / 2), tmpY - (tmpSprite.height / 2));
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
                        // OWNER SID:
                        const ownerSid = tmpObj.owner?.sid;
                        if (ownerSid > 0) {
                            mainContext.fillStyle = color;
                            mainContext.textBaseline = "middle";
                            mainContext.textAlign = "center";
                            mainContext.font = "25px Hammersmith One";
                            mainContext.strokeStyle = darkOutlineColor;
                            mainContext.strokeText(ownerSid.toString(), tmpX, tmpY/* + tmpObj.scale - 20*/);
                            mainContext.fillText(ownerSid.toString(), tmpX, tmpY/* + tmpObj.scale - 20*/);
                        }
                    }
                }
            }
        });
        // PLACE VISIBLE:
        if (layer == 0) {
            if (placeVisible.length) {
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

    // RENDER MINIMAP:
    class MapPing {
        constructor(color, scale) {
            this.init = function(x, y) {
                this.scale = 0;
                this.x = x;
                this.y = y;
                this.active = true;
            };
            this.update = function(ctxt, delta) {
                if (this.active) {
                    this.scale += 0.05 * delta;
                    if (this.scale >= scale) {
                        this.active = false;
                    } else {
                        ctxt.globalAlpha = (1 - Math.max(0, this.scale / scale));
                        ctxt.beginPath();
                        ctxt.arc((this.x / config.mapScale) * mapDisplay.width, (this.y / config.mapScale) *
                                 mapDisplay.width, this.scale, 0, 2 * Math.PI);
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
                mapContext.font = "34px HammerSmith One";
                mapContext.textBaseline = "middle";
                mapContext.textAlign = "center";
                for (let i = 0; i < breakTrackers.length;) {
                    mapContext.fillText("!", (breakTrackers[i].x / config.mapScale) * mapDisplay.width,
                                        (breakTrackers[i].y / config.mapScale) * mapDisplay.height);
                    i += 2;
                }
            }

            // RENDER PLAYERS:
            mapContext.globalAlpha = 1;
            mapContext.fillStyle = "#fff";
            renderCircle((player.x / config.mapScale) * mapDisplay.width,
                         (player.y / config.mapScale) * mapDisplay.height, 7, mapContext, true);
            mapContext.fillStyle = "rgba(255,255,255,0.35)";
            if (player.team && minimapData) {
                for (let i = 0; i < minimapData.length;) {
                    renderCircle((minimapData[i] / config.mapScale) * mapDisplay.width,
                                 (minimapData[i + 1] / config.mapScale) * mapDisplay.height, 7, mapContext, true);
                    i += 2;
                }
            }

            // RENDER BOTS:
            if (bots.length) {
                bots.forEach((tmp) => {
                    if (tmp.inGame) {
                        mapContext.globalAlpha = 1;
                        mapContext.strokeStyle = "#cc5151";
                        renderCircle((tmp.x2 / config.mapScale) * mapDisplay.width,
                                     (tmp.y2 / config.mapScale) * mapDisplay.height, 7, mapContext, false, true);
                    }
                });
            }
            let xOffset = camX - maxScreenWidth / 2;
            let yOffset = camY - maxScreenHeight / 2;
            // VOLCANO SPAWNPOINT ZONE:
            if (configs.volcanozones) {
                mainContext.globalAlpha = 0.25;
                mainContext.fillStyle = "#ff0000";
                mainContext.lineWidth = 10;

                let x = 12500 - xOffset;
                let y = 12500 - yOffset;
                let width = 500;
                let height = 500;
                let radius = 10;

                mainContext.beginPath();
                mainContext.moveTo(x + radius, y);
                mainContext.arcTo(x + width, y, x + width, y + height, radius);
                mainContext.arcTo(x + width, y + height, x, y + height, radius);
                mainContext.arcTo(x, y + height, x, y, radius);
                mainContext.arcTo(x, y, x + width, y, radius);
                mainContext.closePath();

                mainContext.fill();
            }
            // VOLCANO POISON ZONE:
            if (configs.volcanozones) {
                mainContext.globalAlpha = 0.05;
                mainContext.strokeStyle = "#000";
                mainContext.fillStyle = "#000";
                mainContext.lineWidth = 10;

                let x = 12500 - xOffset;
                let y = 12500 - yOffset;
                let width = 1900;
                let height = 1900;
                let radius = 1;

                mainContext.beginPath();
                mainContext.moveTo(x + radius, y);
                mainContext.arcTo(x + width, y, x + width, y + height, radius);
                mainContext.arcTo(x + width, y + height, x, y + height, radius);
                mainContext.arcTo(x, y + height, x, y, radius);
                mainContext.arcTo(x, y, x + width, y, radius);
                mainContext.closePath();

                mainContext.fill();
                mainContext.stroke();
            }
            // DEATH LOCATION:
            if (lastDeath) {
                mapContext.fillStyle = "#fc5553";
                mapContext.font = "34px HammerSmith One";
                mapContext.textBaseline = "middle";
                mapContext.textAlign = "center";
                mapContext.fillText("x", (lastDeath.x / config.mapScale) * mapDisplay.width,
                                    (lastDeath.y / config.mapScale) * mapDisplay.height);
            }

            // MAP MARKER:
            if (mapMarker) {
                mapContext.fillStyle = "#fff";
                mapContext.font = "34px HammerSmith One";
                mapContext.textBaseline = "middle";
                mapContext.textAlign = "center";
                mapContext.fillText("x", (mapMarker.x / config.mapScale) * mapDisplay.width,
                                    (mapMarker.y / config.mapScale) * mapDisplay.height);
            }
        }
    }

    // ICONS:
    let crossHairs = ["https://upload.wikimedia.org/wikipedia/commons/9/95/Crosshairs_Red.svg", "https://upload.wikimedia.org/wikipedia/commons/9/95/Crosshairs_Red.svg"];
    let crossHairSprites = {};
    let iconSprites = {};
    let icons = ["crown", "skull"];
    function loadIcons() {
        for (let i = 0; i < icons.length; ++i) {
            let tmpSprite = new Image();
            tmpSprite.onload = function () {
                this.isLoaded = true;
            };
            tmpSprite.src = "./../img/icons/" + icons[i] + ".png";
            iconSprites[icons[i]] = tmpSprite;
        }
        for (let i = 0; i < crossHairs.length; ++i) {
            let tmpSprite = new Image();
            tmpSprite.onload = function () {
                this.isLoaded = true;
            };
            tmpSprite.src = crossHairs[i];
            crossHairSprites[i] = tmpSprite;
        }
    }
    loadIcons();
    function cdf (e, t){
        try {
            return Math.hypot((t.y2||t.y)-(e.y2||e.y), (t.x2||t.x)-(e.x2||e.x));
        } catch(e){
            return Infinity;
        }
    }
    // UPDATE GAME:
    function updateGame() {
        if(gameObjects.length && inGame) {
            gameObjects.forEach((tmp) => {
                if(UTILS.getDistance(tmp.x, tmp.y, player.x, player.y) <= 1200) {
                    if(!liztobj.includes(tmp)) {
                        liztobj.push(tmp);
                        tmp.render = true;
                    }
                } else {
                    if(liztobj.includes(tmp)) {
                        if(UTILS.getDistance(tmp.x, tmp.y, player.x, player.y) >= 1200) {
                            tmp.render = false;
                            const index = liztobj.indexOf(tmp);
                            if (index > -1) { // only splice array when item is found
                                liztobj.splice(index, 1); // 2nd parameter means remove one item only
                            }
                        }
                    } else if(UTILS.getDistance(tmp.x, tmp.y, player.x, player.y) >= 1200) {
                        tmp.render = false;
                        const index = liztobj.indexOf(tmp);
                        if (index > -1) { // only splice array when item is found
                            liztobj.splice(index, 1); // 2nd parameter means remove one item only
                        }
                    } else {
                        tmp.render = false;
                        const index = liztobj.indexOf(tmp);
                        if (index > -1) { // only splice array when item is found
                            liztobj.splice(index, 1); // 2nd parameter means remove one item only
                        }
                    }
                }
            })
            // gameObjects = gameObjects.filter(e => UTILS.getDistance(e.x, e.y, player.x, player.y) <= 1000)
        }

        // if (config.resetRender) {
        mainContext.beginPath();
        mainContext.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
        // }
        mainContext.globalAlpha = 1;

        // MOVE CAMERA:
        if (player) {
            if (false) {
                camX = player.x;
                camY = player.y;
            } else {
                let tmpDist = UTILS.getDistance(camX, camY, player.x, player.y);
                let tmpDir = UTILS.getDirection(player.x, player.y, camX, camY);
                let camSpd = Math.min(tmpDist * 0.0045 * delta, tmpDist);
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
        // PATHFINDER LINE
        if (pathFind.active) {
            if (pathFind.array && (pathFind.chaseNear ? enemy.length : true)) {
                mainContext.lineWidth = player.scale / 5;
                mainContext.globalAlpha = 1;
                mainContext.strokeStyle = "red";
                mainContext.beginPath();
                pathFind.array.forEach((path, i) => {
                    let pathXY = {
                        x: (pathFind.scale / pathFind.grid) * path.x,
                        y: (pathFind.scale / pathFind.grid) * path.y
                    }
                    let render = {
                        x: ((player.x2 - (pathFind.scale / 2)) + pathXY.x) - xOffset,
                        y: ((player.y2 - (pathFind.scale / 2)) + pathXY.y) - yOffset
                    }
                    if (i == 0) {
                        mainContext.moveTo(render.x, render.y);
                    } else {
                        mainContext.lineTo(render.x, render.y);
                    }
                });
                mainContext.stroke();
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
                    if (config.anotherVisual) {
                        tmpObj.dir = Math.lerpAngle(tmpObj.d2, tmpObj.d1, Math.min(1.2, ratio));
                    } else {
                        tmpObj.dir = Math.lerpAngle(tmpObj.d2, tmpObj.d1, Math.min(1.2, ratio));
                    }
                }
            }
        }

        // RENDER CORDS:
        let xOffset = camX - (maxScreenWidth / 2);
        let yOffset = camY - (maxScreenHeight / 2);

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
            mainContext.fillRect(0, config.snowBiomeTop - yOffset, maxScreenWidth,
                                 maxScreenHeight - (config.snowBiomeTop - yOffset));
        } else {
            mainContext.fillStyle = "#b6db66";
            mainContext.fillRect(0, 0, maxScreenWidth,
                                 (config.mapScale - config.snowBiomeTop - yOffset));
            mainContext.fillStyle = "#dbc666";
            mainContext.fillRect(0, (config.mapScale - config.snowBiomeTop - yOffset), maxScreenWidth,
                                 maxScreenHeight - (config.mapScale - config.snowBiomeTop - yOffset));
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
        mainContext.globalAlpha = 1;
        mainContext.fillStyle = "rgba(0, 5, 80, 0.55)";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);

        // RENDER PLAYER AND AI UI:
        mainContext.strokeStyle = darkOutlineColor;
        mainContext.globalAlpha = 1;

        for (let i = 0; i < players.length + ais.length; ++i) {
            tmpObj = players[i] || ais[i - players.length];
            if (tmpObj.visible && tmpObj.showName === 'NOOO') {
                mainContext.strokeStyle = darkOutlineColor;

                // NAME AND HEALTH:

                //                         let izbot = false;

                //                         bots.forEach((bot) => {
                //                             if (tmpObj.sid == bot.sid) izbot = true
                //                             else izbot = false;
                //                         });

                let tmpText = (tmpObj.team ? "[" + tmpObj.team + "] " : "") + (tmpObj.name || "") + (tmpObj.isPlayer ? " {" + tmpObj.sid + "}" : "");
                if (tmpText != "" && tmpObj.name != "Trash Slave") {
                    // bots.forEach((bot) => {
                    //     if (tmpObj.sid == bot.sid) return;
                    // });

                    mainContext.font = (tmpObj.nameScale || 30) + "px HammerSmith One";
                    mainContext.fillStyle = "#fff";
                    mainContext.textBaseline = "middle";
                    mainContext.textAlign = "center";
                    mainContext.lineWidth = (tmpObj.nameScale ? 11 : 8);
                    mainContext.lineJoin = "round";
                    mainContext.strokeText(tmpText, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY);
                    mainContext.fillText(tmpText, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY);
                    if (tmpObj.isLeader && iconSprites["crown"].isLoaded) {
                        let tmpS = config.crownIconScale;
                        let tmpX = tmpObj.x - xOffset - (tmpS / 2) - (mainContext.measureText(tmpText).width / 2) - config.crownPad;
                        mainContext.drawImage(iconSprites["crown"], tmpX, (tmpObj.y - yOffset - tmpObj.scale) -
                                              config.nameY - (tmpS / 2) - 5, tmpS, tmpS);
                    }
                    if (tmpObj.iconIndex == 1 && iconSprites["skull"].isLoaded) {
                        let tmpS = config.crownIconScale;
                        let tmpX = tmpObj.x - xOffset - (tmpS / 2) + (mainContext.measureText(tmpText).width / 2) + config.crownPad;
                        mainContext.drawImage(iconSprites["skull"], tmpX, (tmpObj.y - yOffset - tmpObj.scale) -
                                              config.nameY - (tmpS / 2) - 5, tmpS, tmpS);
                    }
                    if (tmpObj.isPlayer && instaC.wait && near == tmpObj && (crossHairSprites[1].isLoaded) && enemy.length && !useWasd) {
                        let tmpS = tmpObj.scale * 2.2;
                        mainContext.drawImage((crossHairSprites[1]), tmpObj.x - xOffset - tmpS / 2, tmpObj.y - yOffset - tmpS / 2, tmpS, tmpS);
                    }
                    // izbot = false;
                }
                if (tmpObj.health > 0) {

                    if(tmpObj.name != "Trash Slave") {
                        // HEALTH HOLDER:
                        mainContext.fillStyle = darkOutlineColor;
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth - config.healthBarPad,
                                              (tmpObj.y - yOffset + tmpObj.scale) + config.nameY, (config.healthBarWidth * 2) +
                                              (config.healthBarPad * 2), 17, 8);
                        mainContext.fill();

                        // HEALTH BAR:
                        mainContext.fillStyle = (tmpObj == player || (tmpObj.team && tmpObj.team == player.team)) ? "#8ecc51" : "#cc5151";
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth,
                                              (tmpObj.y - yOffset + tmpObj.scale) + config.nameY + config.healthBarPad,
                                              ((config.healthBarWidth * 2) * (tmpObj.health / tmpObj.maxHealth)), 17 - config.healthBarPad * 2, 7);
                        mainContext.fill();
                    }

                    if (tmpObj.isPlayer) {
                        mainContext.globalAlpha = 1;
                        let targetReloads = {
                            primary: (tmpObj.primaryIndex == undefined ? 1 : ((items.weapons[tmpObj.primaryIndex].speed - tmpObj.reloads[tmpObj.primaryIndex]) / items.weapons[tmpObj.primaryIndex].speed)),
                            secondary: (tmpObj.secondaryIndex == undefined ? 1 : ((items.weapons[tmpObj.secondaryIndex].speed - tmpObj.reloads[tmpObj.secondaryIndex]) / items.weapons[tmpObj.secondaryIndex].speed)),
                            turret: (2500 - tmpObj.reloads[53]) / 2500
                        };
                        if (!tmpObj.currentReloads) {
                            tmpObj.currentReloads = { // Initialize currentReloads if not already set
                                primary: targetReloads.primary,
                                secondary: targetReloads.secondary,
                                turret: targetReloads.turret
                            };
                        }
                        const lerpFactor = 0.3;
                        tmpObj.currentReloads.primary = (1 - lerpFactor) * tmpObj.currentReloads.primary + lerpFactor * targetReloads.primary;
                        tmpObj.currentReloads.secondary = (1 - lerpFactor) * tmpObj.currentReloads.secondary + lerpFactor * targetReloads.secondary;
                        tmpObj.currentReloads.turret = (1 - lerpFactor) * tmpObj.currentReloads.turret + lerpFactor * targetReloads.turret;

                        let primaryReloadProgress = tmpObj.primaryIndex !== undefined ? ((items.weapons[tmpObj.primaryIndex].speed - tmpObj.reloads[tmpObj.primaryIndex]) / items.weapons[tmpObj.primaryIndex].speed) : 1;
                        let secondaryReloadProgress = tmpObj.secondaryIndex !== undefined ? ((items.weapons[tmpObj.secondaryIndex].speed - tmpObj.reloads[tmpObj.secondaryIndex]) / items.weapons[tmpObj.secondaryIndex].speed) : 1;
                        const centerX = tmpObj.x - xOffset;
                        const centerY = tmpObj.y - yOffset;
                        const barRadius = 35;
                        const barWidth = 15;
                        const totalAngle = (Math.PI*2)/3; // Half circle
                        const secondaryStartAngle = -Math.PI / 2 + Math.PI / 3 + tmpObj.dir - Math.PI/2;
                        const secondaryEndAngle = secondaryStartAngle + (totalAngle * tmpObj.currentReloads.secondary);
                        const primaryStartAngle = Math.PI / 2 + tmpObj.dir - Math.PI/2;
                        const primaryEndAngle = primaryStartAngle + (totalAngle * tmpObj.currentReloads.primary);

                        const turretStartAngle = Math.PI + Math.PI / 4.5 + tmpObj.dir - Math.PI/2;
                        const turretEndAngle = turretStartAngle + (totalAngle/1.25 * tmpObj.currentReloads.turret);
                        function returncoolcolor(RainbowCycle) {
                            return `hsl(${RainbowCycle-50}, 85%, 50%, 30)`;
                        }

                        mainContext.save();
                        if (tmpObj.currentReloads.primary < 0.999) {
                            mainContext.beginPath();
                            mainContext.lineCap = 'round';
                            mainContext.arc(centerX, centerY, barRadius, primaryStartAngle, primaryEndAngle);
                            mainContext.lineWidth = 4;
                            mainContext.strokeStyle = returncoolcolor(tmpObj.currentReloads.primary * 240);
                            mainContext.stroke();
                        }
                        if (tmpObj.currentReloads.secondary < 0.999) {
                            mainContext.beginPath();
                            mainContext.lineCap = 'round';
                            mainContext.arc(centerX, centerY, barRadius, secondaryStartAngle, secondaryEndAngle);
                            mainContext.lineWidth = 4;
                            mainContext.strokeStyle = returncoolcolor(tmpObj.currentReloads.secondary * 240);
                            mainContext.stroke();
                        }
                        if (tmpObj.currentReloads.turret < 0.999) {
                            mainContext.beginPath();
                            mainContext.lineCap = 'round';
                            mainContext.arc(centerX, centerY, barRadius, turretStartAngle, turretEndAngle);
                            mainContext.lineWidth = 4;
                            mainContext.strokeStyle = returncoolcolor(tmpObj.currentReloads.turret * 240);
                            mainContext.stroke();
                        }
                        mainContext.restore();

                        if(tmpObj.name != "Trash Slave") {
                            // SHAME COUNT:
                            mainContext.globalAlpha = 1;
                            mainContext.font = "24px HammerSmith One";
                            mainContext.fillStyle = "#BEC8F4";
                            mainContext.strokeStyle = darkOutlineColor;
                            mainContext.textBaseline = "middle";
                            mainContext.textAlign = "center";
                            mainContext.lineWidth = 8;
                            mainContext.lineJoin = "round";
                            let tmpS = config.crownIconScale;
                            let tmpX = tmpObj.x - xOffset - tmpS / 2 + config.crownPad - 2;
                            mainContext.strokeText('[' + (tmpObj.skinIndex == 45 && tmpObj.shameTimer > 0 ? tmpObj.shameTimer : tmpObj.shameCount) + '/' + Math.round(tmpObj.pinge) + '/' + tmpObj.lastshamecount + ']', tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY + 175);
                            mainContext.fillText('[' + (tmpObj.skinIndex == 45 && tmpObj.shameTimer > 0 ? tmpObj.shameTimer : tmpObj.shameCount) + '/' + Math.round(tmpObj.pinge) + '/' + tmpObj.lastshamecount + ']', tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY + 175);
                        }

                        // PLAYER TRACER:
                        if (!tmpObj.isTeam(player)) {

                            let dir = Math.atan2(tmpObj.y - player.y, tmpObj.x - player.x);
                            let dist = Math.hypot(tmpObj.y - player.y, tmpObj.x - player.x);
                            mainContext.save();
                            mainContext.lineCap = "round";
                            mainContext.strokeStyle = "#812020";
                            mainContext.lineWidth = 6;
                            mainContext.beginPath();
                            mainContext.moveTo(player.x + Math.cos(dir) * dist / 3 - xOffset, player.y + Math.sin(dir) * dist / 3 - yOffset);
                            mainContext.lineTo(player.x + Math.cos(dir) * dist / 3 * 2 - xOffset, player.y + Math.sin(dir) * dist / 3 * 2 - yOffset);
                            mainContext.stroke();
                            mainContext.restore();
                        }

                        if (getEl("predictType").value == "pre2") {
                            mainContext.lineWidth = 3;
                            mainContext.strokeStyle = "#fff";
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
                        }

                    }
                }
            }
        }
        if (player) {

            // AUTOPUSH LINE:
            if (my.autoPush && my.pushData) {
                mainContext.lineWidth = 5; // Increase line width for a thicker line
                mainContext.globalAlpha = 1;
                mainContext.lineCap = "round"; // Make the ends of the line rounded for a more curved appearance
                mainContext.beginPath();

                // Define a gradient to switch between light RGB purple and white
                var gradient = mainContext.createLinearGradient(
                    player.x - xOffset,
                    player.y - yOffset,
                    my.pushData.x - xOffset,
                    my.pushData.y - yOffset
                );
                gradient.addColorStop(1, "#FFF"); // Light purple color
                gradient.addColorStop(0.5, "#FFF"); // White
                gradient.addColorStop(1, "#FFF"); // Light purple color

                mainContext.strokeStyle = gradient;
                mainContext.moveTo(player.x - xOffset, player.y - yOffset);

                // Control points for the curve
                let controlX = (player.x + my.pushData.x) / 2 - xOffset;
                let controlY = (player.y + my.pushData.y) / 2 - yOffset - 100; // Adjust control point for more pronounced curve

                mainContext.quadraticCurveTo(
                    controlX,
                    controlY,
                    my.pushData.x - xOffset,
                    my.pushData.y - yOffset
                ); // Use quadraticCurveTo for a curved line
                mainContext.stroke();
            }
            // onetick range:
            if (configs.autoOneFrame && enemy.length && near) {
                mainContext.globalAlpha = 1;

                mainContext.beginPath();
                if (player.items[4] == 16 && player.weapons[0] == 5 && [9, 12, 13].includes(player.weapons[1])) {
                    const dist = player.weapons[1] == 9 ? 365 : player.weapons[1] == 12 ? 380 : player.weapons[1] == 13 ? 365 : 370;

                    mainContext.lineWidth = 5;

                    const gradient = mainContext.createRadialGradient(near.x - xOffset, near.y - yOffset, 25, near.x - xOffset, near.y - yOffset, 80);
                    gradient.addColorStop(0, "red");
                    gradient.addColorStop(0.4, "rgba(0, 0, 0, 1)");
                    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

                    mainContext.strokeStyle = gradient;

                    mainContext.arc(player.x - xOffset, player.y - yOffset, dist, 0, Math.PI * 2);
                    mainContext.stroke();
                } else if (player.weapons[0] == 5 && player.primaryVariant >= 2) {
                    mainContext.lineWidth = 6;

                    const gradient = mainContext.createRadialGradient(near.x - xOffset, near.y - yOffset, 25, near.x - xOffset, near.y - yOffset, 80);
                    gradient.addColorStop(0, "pink");
                    gradient.addColorStop(1, "rgba(0, 160, 255, 0)");

                    mainContext.strokeStyle = gradient;

                    mainContext.arc(player.x - xOffset, player.y - yOffset, 238, 0, Math.PI * 2);
                    mainContext.stroke();
                }
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
                    mainContext.font = "32px HammerSmith One";
                    let tmpSize = mainContext.measureText(tmpObj.chatMessage);
                    mainContext.textBaseline = "middle";
                    mainContext.textAlign = "center";
                    let tmpX = tmpObj.x - xOffset;
                    let tmpY = tmpObj.y - tmpObj.scale - yOffset - 90;
                    let tmpH = 47;
                    let tmpW = tmpSize.width + 17;
                    mainContext.fillStyle = "rgba(0,0,0,0.2)";
                    mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
                    mainContext.fill();
                    mainContext.fillStyle = "#fff";
                    mainContext.fillText(tmpObj.chatMessage, tmpX, tmpY);
                }
                if (tmpObj.chat.count > 0) {
                    if (!useWasd) {
                        tmpObj.chat.count -= delta;
                        if (tmpObj.chat.count <= 0)
                            tmpObj.chat.count = 0;
                        mainContext.font = "32px HammerSmith One";
                        let tmpSize = mainContext.measureText(tmpObj.chat.message);
                        mainContext.textBaseline = "middle";
                        mainContext.textAlign = "center";
                        let tmpX = tmpObj.x - xOffset;
                        let tmpY = tmpObj.y - tmpObj.scale - yOffset + (90 * 2);
                        let tmpH = 47;
                        let tmpW = tmpSize.width + 17;
                        mainContext.fillStyle = "rgba(0,0,0,0.2)";
                        mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
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
            window.setTimeout(callback, 1000/9);
        };
    })();

    function doUpdate() {
        //rape modulus
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

        if (enemy.length>1){
            getEl("wdguyewvhwewehvew").innerHTML = "Enemyes: " + enemy.length;
        }else{
            getEl("wdguyewvhwewehvew").innerHTM="No Enemyes";
        }
        getEl("pingFps").innerHTML = `${window.pingTime}`;
        getEl("psddsf").innerHTML = `${Math.round(fpsTimer.ltime)}`;
        getEl("packetStatus").innerHTML = secPacket;
        getEl("PrePlace").innerHTML = "PrePlace: " + PrePlaceCount;
        if (window.pingTime > 100) {
            getEl("healType").innerHTML = "High Ms";
        } else if (window.pingTime < 80) {
            getEl("healType").innerHTML = "Low Ms";
        }
        if (window.pingTime > 100) {
            getEl("placeType").innerHTML = "Slow place";
        } else if (window.pingTime < 80) {
            getEl("placeType").innerHTML = "Fast place";
        }
        if (window.pingTime > 100) {
            getEl("PvP").innerHTML = "Defense";
        } else if (window.pingTime < 80) {
            getEl("PvP").innerHTML = "Offense";
        }
        updateGame();
        rAF(doUpdate);
        ms.avg = Math.round((ms.min+ms.max)/2);
    }

    prepareMenuBackground();
    doUpdate();

    function toggleUseless(boolean) {
        getEl("instaType").disabled = boolean;
        getEl("antiBullType").disabled = boolean;
        getEl("predictType").disabled = boolean;
    }
    toggleUseless(useWasd);

    let changeDays = {};
    window.debug = function() {
        my.waitHit = 0;
        my.autoAim = false;
        instaC.isTrue = false;
        traps.inTrap = false;
        itemSprites = [];
        objSprites = [];
        gameObjectSprites = [];
    };
    window.wasdMode = function() {
        useWasd = !useWasd;
        toggleUseless(useWasd);
    };
    window.startGrind = function() {
        if (getEl("weaponGrind").checked) {
            for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
                checkPlace(player.getItemType(22), i);
            }
        }
    };
    // REMOVED!!! so they cant abuse :)
    let projects = [
        "adorable-eight-guppy",
        "galvanized-bittersweet-windshield"
    ];
    let botIDS = 0;
    window.connectFillBots = function() {
        botSkts = [];
        botIDS = 0;
        for (let i = 0; i < projects.length; i++) {
            let test = new WebSocket(`wss://${projects[i]}.glitch.me`);
            test.binaryType = "arraybuffer";

            test.onopen = function() {
                test.ssend = function(type) {
                    let data = Array.prototype.slice.call(arguments, 1);
                    let binary = window.msgpack.encode([type, data]);
                    test.send(binary);
                };
                for (let i = 0; i < 4; i++) {
                    window.grecaptcha.execute("6LfahtgjAAAAAF8SkpjyeYMcxMdxIaQeh-VoPATP", {
                        action: "homepage"
                    }).then(function(token) {
                        let t = WS.url.split("wss://")[1].split("?")[0];
                        test.ssend("bots", "wss://" + t + "?token=re:" + encodeURIComponent(token), botIDS);
                        botSkts.push([test]);
                        botIDS++;
                    });
                }
            };
            test.onmessage = function(message) {
                let data = new Uint8Array(message.data);
                let parsed = window.msgpack.decode(data);
                let type = parsed[0];
                data = parsed[1];
            };
        }
    };
    window.destroyFillBots = function() {
        botSkts.forEach((socket) => {
            socket[0].close();
        });
        botSkts = [];
    };
    window.tryConnectBots = function() {
        for (let i = 0; i < (bots.length < 3 ? 3 : 4); i++) {
            window.grecaptcha.execute("6LfahtgjAAAAAF8SkpjyeYMcxMdxIaQeh-VoPATP", {
                action: "homepage"
            }).then(function(token) {
                // CONNECT SOCKET:
                botSpawn(token);
            });
        }
    };
    window.destroyBots = function() {
        bots.forEach((botyyyyy) => {
            botyyyyy.closeSocket = true;
        });
        bots = [];
    };
    window.resBuild = function() {
        if (gameObjects.length) {
            gameObjects.forEach((tmp) => {
                tmp.breakObj = false;
            });
            breakObjects = [];
        }
    };
    window.toggleBotsCircle = function() {
        player.circle = !player.circle;
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
        // CHAT STUFF:
        var chatBox = document.getElementById("chatBox");
        var chatHolder = document.getElementById("chatHolder");
        var suggestBox = document.createElement("div");
        suggestBox.id = "suggestBox";

        var prevChats = [];
        var prevChatsIndex = 0;

        function toggleChat() {
            if (!usingTouch) {
                if (chatHolder.style.display == "block") {
                    if (chatBox.value) {
                        sendChat(chatBox.value);
                    }
                    closeChat();
                } else {
                    storeMenu.style.display = "none";
                    allianceMenu.style.display = "none";
                    chatHolder.style.display = "block";
                    chatBox.focus();
                    resetMoveDir();
                }
            } else {
                setTimeout(function () {
                    var chatMessage = prompt("chat message");
                    if (chatMessage) {
                        sendChat(chatMessage);
                    }
                }, 1);
            }
            chatBox.value = "";
            (() => {
                prevChatsIndex = 0;
            })();
        }

        function closeChat() {
            chatBox.value = "";
            chatHolder.style.display = "none";
        }

        // ACTION BAR:
        UTILS.removeAllChildren(actionBar);

        for (let i = 0; i < (items.weapons.length + items.list.length); ++i) {
            (function (i) {
                UTILS.generateElement({
                    id: "actionBarItem" + i,
                    class: "actionBarItem",
                    style: "display:none; box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.5)",
                    onmouseout: function () {
                        showItemInfo();
                    },
                    parent: actionBar
                });
            })(i);
        }

        for (let i = 0; i < (items.list.length + items.weapons.length); ++i) {
            (function (i) {
                let tmpCanvas = document.createElement("canvas");
                tmpCanvas.width = tmpCanvas.height = 66;
                let tmpContext = tmpCanvas.getContext("2d");
                tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
                tmpContext.imageSmoothingEnabled = false;
                tmpContext.webkitImageSmoothingEnabled = false;
                tmpContext.mozImageSmoothingEnabled = false;

                if (items.weapons[i]) {
                    tmpContext.rotate((Math.PI));
                    let tmpSprite = new Image();
                    toolSprites[items.weapons[i].src] = tmpSprite;
                    tmpSprite.onload = function () {
                        this.isLoaded = true;
                        let tmpPad = 1 / (this.height / this.width);
                        let tmpMlt = (items.weapons[i].iPad || 1);
                        tmpContext.drawImage(this, -(tmpCanvas.width * tmpMlt * config.iconPad * tmpPad) / 2, -(tmpCanvas.height * tmpMlt * config.iconPad) / 2,
                                             tmpCanvas.width * tmpMlt * tmpPad * config.iconPad, tmpCanvas.height * tmpMlt * config.iconPad);
                        tmpContext.fillStyle = "rgba(0, 0, 70, 0.2)";
                        tmpContext.globalCompositeOperation = "source-atop";
                        tmpContext.fillRect(-tmpCanvas.width / 2, -tmpCanvas.height / 2, tmpCanvas.width, tmpCanvas.height);
                        getEl('actionBarItem' + i).style.backgroundImage = "url(" + tmpCanvas.toDataURL() + ")";
                    };
                    tmpSprite.src = "./../img/weapons/" + items.weapons[i].src + ".png";
                    let tmpUnit = getEl('actionBarItem' + i);
                    // tmpUnit.onmouseover = UTILS.checkTrusted(function () {
                    //     showItemInfo(items.weapons[i], true);
                    // });
                    tmpUnit.onclick = UTILS.checkTrusted(function () {
                        selectWeapon(tmpObj.weapons[items.weapons[i].type]);
                    });
                    UTILS.hookTouchEvents(tmpUnit);
                } else {
                    let tmpSprite = getItemSprite(items.list[i - items.weapons.length], true);
                    let tmpScale = Math.min(tmpCanvas.width - config.iconPadding, tmpSprite.width);
                    tmpContext.globalAlpha = 1;
                    tmpContext.drawImage(tmpSprite, -tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);
                    tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
                    tmpContext.globalCompositeOperation = "source-atop";
                    tmpContext.fillRect(-tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);
                    getEl('actionBarItem' + i).style.backgroundImage = "url(" + tmpCanvas.toDataURL() + ")";
                    let tmpUnit = getEl('actionBarItem' + i);
                    // tmpUnit.onmouseover = UTILS.checkTrusted(function () {
                    //     showItemInfo(items.list[i - items.weapons.length]);
                    // });
                    tmpUnit.onclick = UTILS.checkTrusted(function () {
                        selectToBuild(tmpObj.items[tmpObj.getItemType(i - items.weapons.length)]);
                    });
                    UTILS.hookTouchEvents(tmpUnit);
                }
            })(i);
        }
    };
    window.profineTest = function(data) {
        if (data) {
            // VALIDATE NAME:
            let name = data + "";
            name = name.slice(0, config.maxNameLength);

            return name;
        }
    }

    let spikeType = 2;
    let visAim = false;
    let hold = null;
    let aim = [null];
    let autobreakBuild = false;
    let breaking = false;
    let Variants = [1, 1.1, 1.18, 1.18];
    let bH = [51,50,28,29,30,36,37,38,44,35,42,43,49];

    // Initialize dmgpot system when player is available
    function initDmgPotSystem() {
        if (player && !player.dmgpot) {
            player.dmgpot = {
                soldier: false,
                shouldHeal: false
            };
        }
    }

    function addChatLog(names, message, color, pm, timer) {
        try {
            if (player && player.chat) {
                player.chat.message = message;
                player.chat.count = 1000;
            }
        } catch (e) {
            console.log("addChatLog error:", e);
        }
    }

    function polePlacer(item, angle, trap) {
        try {
            if (!item || !trap) return false;
            let tmpObj = {
                x: trap.x + Math.cos(angle) * (item.scale + trap.scale),
                y: trap.y + Math.sin(angle) * (item.scale + trap.scale)
            };
            return UTILS.checkItemLocation(tmpObj.x, tmpObj.y, item.scale, 0, item.id, false, player);
        } catch (e) {
            return false;
        }
    }

    function shieldBypass(player, enemy) {
        try {
            if (!player || !enemy) return false;
            return enemy.shameCount < 5 || enemy.skinIndex != 6;
        } catch (e) {
            return false;
        }
    }

    function breakBuild(angle, weapon, variant, hat, force) {
        try {
            selectWeapon(weapon);
            buyEquip(hat, 0);
            sendAtck(1, angle);
            game.tickBase(() => {
                sendAutoGather();
            }, 1);
        } catch (e) {
            console.log("breakBuild error:", e);
        }
    }

    async function spikeTickAids(e,t,g,z,dists) {
        if(!getEl("polearmAids")|| !near||player.weapons[1]!=10||!near?.inTrap||autobreakBuild||instaC.isTrue||traps.inTrap||my.autoPush||player.sr!=1||player.pr!=1) return;
        if(player.weapons[0] == 3 || player.weapons[0] == 4 || player.weapons[0] == 5) {
            let coords;
            t = near.inTrap
            e = caf(player,t)
            g = 75*Variants[player.secondaryVar]*(bH.includes(40)?3.3:1)>=t.health
            z = items.weapons
            dists = [UTILS.getDist(player,t,"object"),UTILS.getDist(player,near,"player")]
            if((dists[0]<=z[player.weapons[1]].range&&dists[1]<=z[player.weapons[0]].range)&&polePlacer(items.list[spikeType],e,t)&&shieldBypass(player,near) && g && (((player.weapons[0] == 5 && player.primaryVar == 1) || (player.weapons[0] == 4 && player.primaryVar > 1)) ? (near.weaponR == 1 && near.weaponIndex <= 10) : true) && player.tailIndex!=11){
                autobreakBuild = true;
                if(player.dmgpot?.soldier && near.pr == 1 && player.dmgpot?.shouldHeal && [4, 5].includes(near?.primary)) {
                    addChatLog(`Cancelled TA due to spike sync threat`,'', '#5c0620',false,true);
                    Hg(6, 0);
                } else {
                    Hg(40, 0);
                }
                aim[0] = e
                packet("D", e)
                visAim = true;
                hold = player.weapons[1];
                player.hitting = true;
                packet("z",player.weapons[1],true)
                breaking = true;
                addChatLog(`TA on ${near.name}[${near.sid}]`,'', '#5c0620',false,true);
                await game.tickBase()
                addChatLog(`${near.health}`,'', '#5c0620',false,true);
                autobreakBuild = false;
                instaC.isTrue = true;
                hold = player.weapons[0]
                if(player.dmgpot?.soldier && near.pr == 1 && player.dmgpot?.shouldHeal && [4, 5].includes(near?.primary)) {
                    addChatLog(`Cancelled TA due to spike sync threat`,'', '#5c0620',false,true);
                    Hg(6);
                } else {
                    Hg(7);
                }
                packet("z",player.weapons[0], true)
                e= caf(player,t)
                player.hitting = true;
                aim[0] = e;
                packet("D",caf(player,near))
                place(spikeType,e+UTILS.toRad(15),player.weapons[0])
                place(spikeType,e-UTILS.toRad(15),player.weapons[0])
                place(spikeType,caf(player,near),player.weapons[0])
                packet("D",caf(player,near))
                packet("z",player.weapons[0], true)
                await game.tickBase()
                visAim = false;
                hold = null
                breaking = false;
                aim[0] =null;
                instaC.isTrue = false;
            }
        }
    }

    async function breakShit(e,t,g,g2,z,dists){
        if(player.weapons[0]!=5||player.primaryVar<2||!getEl("polearmAids")|| !near||player.weapons[1]!=10||!near?.inTrap||autobreakBuild||instaC.isTrue||traps.inTrap||my.autoPush||player.sr!=1||player.pr!=1) return
        let coords;
        t = near.inTrap
        e = caf(player,t)
        g = 75*Variants[player.secondaryVar]*(bH.includes(40)?3.3:1)>=t.health
        g2 = (75*Variants[player.secondaryVar]*(bH.includes(40)?3.3:1)) + ((near.secondary == 10 ? 75 : items.weapons[near.primary].dmg)*Variants[player.secondary == 10 ? near.secondaryVar : near.primaryVar] * 3.3) >= t.health
        z = items.weapons
        dists = [UTILS.getDist(player,t,"object"),UTILS.getDist(player,near,"player")]
        if((dists[0]<=z[player.weapons[1]].range&&dists[1]<=z[player.weapons[0]].range)&&polePlacer(items.list[spikeType],e,t)&&shieldBypass(player,near)&&player.tailIndex!=11){
            if(g) {
                autobreakBuild = true;
                Hg(40,0);
                aim[0] = e
                packet("D", e)
                visAim = true;
                hold = player.weapons[1];
                player.hitting = true;
                packet("z",player.weapons[1],true)
                breaking = true;
                addChatLog(`PA on ${near.name}[${near.sid}]`,'', '#5c0620',false,true);
                breakBuild(e,player.weapons[1],player.secondaryVar,40,1)
                await game.tickBase()
                instaC.isTrue = true;
                hold = player.weapons[0]
                Hg(7,18)
                packet("z",player.weapons[0], true)
                e= caf(player,t)
                player.hitting = true;
                aim[0] = e;
                packet("D",caf(player,near))
                place(spikeType,e+UTILS.toRad(15),player.weapons[0])
                place(spikeType,e-UTILS.toRad(15),player.weapons[0])
                place(spikeType,caf(player,near),player.weapons[0])
                place(spikeType,e,player.weapons[0])
                packet("D",caf(player,near))
                packet("z",player.weapons[0], true)
                await game.tickBase()
                visAim = false;
                autobreakBuild = false;
                hold = null
                breaking = false;
                aim[0] =null;
                instaC.isTrue = false;
            }
        }
    }

    function rubyPH(){
        if(!near||!player.pr||!player.sr||!(player.primaryVar===3||player.secondaryVar===3)||player.weapons[1]!=10||player.weapons[0]!=5) return;
    }
}(1)

    };
    if (document.readyState === "loading")
        document.addEventListener("DOMContentLoaded", __clientMain, { once: true });
    else
        __clientMain();
})();
