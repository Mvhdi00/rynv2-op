// ==UserScript==
// @name         Annihilator
// @version      v0.8.9
// @author       3zs,astive,zylex
// @contributor  eliasoupas,margot
// @description  MooMoo.io Dominator
// @icon         https://static.wikia.nocookie.net/moom/images/e/e3/Hat_47.png/revision/latest/scale-to-width-down/250?cb=20171206232244
// @match        *://*.moomoo.io/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

const EXP = (function() {
    "use strict";

    const NativeWebSocket = window.WebSocket
      , nativeSend = NativeWebSocket.prototype.send
      , TABLE_SALT = 1
      , HEADER_LEN = 6
      , MODE_SECURE = 1
      , BLOCK = 64
      , C2S = ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"]
      , S2C = ["A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

    const PACKET_MAP = {
        "33": "9",
        "ch": "6",
        "pp": "0",
        "13c": "c",
        "f": "9",
        "a": "9",
        "d": "F",
        "G": "z"
    };

    const utf8enc = new TextEncoder()
      , utf8dec = new TextDecoder();

    function Writer() {
        this.buf = new Uint8Array(1024);
        this.view = new DataView(this.buf.buffer);
        this.pos = 0;
    }
    Writer.prototype.need = function(n) {
        if (this.pos + n <= this.buf.byteLength) return;
        let size = this.buf.byteLength * 2;
        while (size < this.pos + n) size *= 2;
        const next = new Uint8Array(size);
        next.set(this.buf);
        this.buf = next;
        this.view = new DataView(next.buffer);
    };
    Writer.prototype.u8 = function(v) { this.need(1); this.view.setUint8(this.pos++, v); };
    Writer.prototype.u16 = function(v) { this.need(2); this.view.setUint16(this.pos, v); this.pos += 2; };
    Writer.prototype.u32 = function(v) { this.need(4); this.view.setUint32(this.pos, v); this.pos += 4; };
    Writer.prototype.i8 = function(v) { this.need(1); this.view.setInt8(this.pos++, v); };
    Writer.prototype.i16 = function(v) { this.need(2); this.view.setInt16(this.pos, v); this.pos += 2; };
    Writer.prototype.i32 = function(v) { this.need(4); this.view.setInt32(this.pos, v); this.pos += 4; };
    Writer.prototype.f64 = function(v) { this.need(8); this.view.setFloat64(this.pos, v); this.pos += 8; };
    Writer.prototype.bytes = function(b) { this.need(b.length); this.buf.set(b, this.pos); this.pos += b.length; };

    function writeValue(w, v) {
        if (v === null || v === undefined) return w.u8(0xc0);
        const t = typeof v;
        if (t === "boolean") return w.u8(v ? 0xc3 : 0xc2);
        if (t === "number") return writeNumber(w, v);
        if (t === "string") return writeString(w, v);
        if (Array.isArray(v)) {
            const n = v.length;
            if (n < 16) w.u8(0x90 | n);
            else if (n < 65536) { w.u8(0xdc); w.u16(n); }
            else { w.u8(0xdd); w.u32(n); }
            for (let i = 0; i < n; i++) writeValue(w, v[i]);
            return;
        }
        if (v instanceof Uint8Array || ArrayBuffer.isView(v) || v instanceof ArrayBuffer) {
            const b = v instanceof ArrayBuffer ? new Uint8Array(v)
                : v instanceof Uint8Array ? v
                : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
            if (b.length < 256) { w.u8(0xc4); w.u8(b.length); }
            else if (b.length < 65536) { w.u8(0xc5); w.u16(b.length); }
            else { w.u8(0xc6); w.u32(b.length); }
            return w.bytes(b);
        }
        const keys = Object.keys(v)
          , n = keys.length;
        if (n < 16) w.u8(0x80 | n);
        else if (n < 65536) { w.u8(0xde); w.u16(n); }
        else { w.u8(0xdf); w.u32(n); }
        for (let i = 0; i < n; i++) {
            writeString(w, keys[i]);
            writeValue(w, v[keys[i]]);
        }
    }

    function writeNumber(w, v) {
        if (!Number.isSafeInteger(v)) { w.u8(0xcb); return w.f64(v); }
        if (v >= 0) {
            if (v < 128) return w.u8(v);
            if (v < 256) { w.u8(0xcc); return w.u8(v); }
            if (v < 65536) { w.u8(0xcd); return w.u16(v); }
            if (v < 4294967296) { w.u8(0xce); return w.u32(v); }
            w.u8(0xcb); return w.f64(v);
        }
        if (v >= -32) return w.u8(0xe0 | (v + 32));
        if (v >= -128) { w.u8(0xd0); return w.i8(v); }
        if (v >= -32768) { w.u8(0xd1); return w.i16(v); }
        if (v >= -2147483648) { w.u8(0xd2); return w.i32(v); }
        w.u8(0xcb); return w.f64(v);
    }

    function writeString(w, s) {
        const b = utf8enc.encode(s)
          , n = b.length;
        if (n < 32) w.u8(0xa0 | n);
        else if (n < 256) { w.u8(0xd9); w.u8(n); }
        else if (n < 65536) { w.u8(0xda); w.u16(n); }
        else { w.u8(0xdb); w.u32(n); }
        w.bytes(b);
    }

    function encode(value) {
        const w = new Writer();
        writeValue(w, value);
        return w.buf.slice(0, w.pos);
    }

    function Reader(bytes) {
        this.b = bytes;
        this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        this.pos = 0;
    }
    Reader.prototype.read = function() {
        const c = this.view.getUint8(this.pos++);
        if (c < 0x80) return c;
        if (c >= 0xe0) return c - 256;
        if (c >= 0xa0 && c <= 0xbf) return this.str(c & 0x1f);
        if (c >= 0x90 && c <= 0x9f) return this.arr(c & 0x0f);
        if (c >= 0x80 && c <= 0x8f) return this.map(c & 0x0f);
        switch (c) {
        case 0xc0: return null;
        case 0xc2: return false;
        case 0xc3: return true;
        case 0xc4: return this.bin(this.u8());
        case 0xc5: return this.bin(this.u16());
        case 0xc6: return this.bin(this.u32());
        case 0xca: { const v = this.view.getFloat32(this.pos); this.pos += 4; return v; }
        case 0xcb: { const v = this.view.getFloat64(this.pos); this.pos += 8; return v; }
        case 0xcc: return this.u8();
        case 0xcd: return this.u16();
        case 0xce: return this.u32();
        case 0xcf: { const hi = this.u32(), lo = this.u32(); return hi * 4294967296 + lo; }
        case 0xd0: { const v = this.view.getInt8(this.pos); this.pos += 1; return v; }
        case 0xd1: { const v = this.view.getInt16(this.pos); this.pos += 2; return v; }
        case 0xd2: { const v = this.view.getInt32(this.pos); this.pos += 4; return v; }
        case 0xd3: { const hi = this.view.getInt32(this.pos); this.pos += 4; const lo = this.u32(); return hi * 4294967296 + lo; }
        case 0xd9: return this.str(this.u8());
        case 0xda: return this.str(this.u16());
        case 0xdb: return this.str(this.u32());
        case 0xdc: return this.arr(this.u16());
        case 0xdd: return this.arr(this.u32());
        case 0xde: return this.map(this.u16());
        case 0xdf: return this.map(this.u32());
        }
        throw new Error("msgpack: unsupported byte 0x" + c.toString(16));
    };
    Reader.prototype.u8 = function() { return this.view.getUint8(this.pos++); };
    Reader.prototype.u16 = function() { const v = this.view.getUint16(this.pos); this.pos += 2; return v; };
    Reader.prototype.u32 = function() { const v = this.view.getUint32(this.pos); this.pos += 4; return v; };
    Reader.prototype.str = function(n) {
        const s = utf8dec.decode(this.b.subarray(this.pos, this.pos + n));
        this.pos += n;
        return s;
    };
    Reader.prototype.bin = function(n) {
        const s = this.b.subarray(this.pos, this.pos + n);
        this.pos += n;
        return s;
    };
    Reader.prototype.arr = function(n) {
        const out = new Array(n);
        for (let i = 0; i < n; i++) out[i] = this.read();
        return out;
    };
    Reader.prototype.map = function(n) {
        const out = {};
        for (let i = 0; i < n; i++) {
            const k = this.read();
            const v = this.read();
            if (k !== "__proto__") out[k] = v;
        }
        return out;
    };

    function decode(bytes) {
        return new Reader(toBytes(bytes)).read();
    }

    function toBytes(d) {
        if (d instanceof Uint8Array) return d;
        if (d instanceof ArrayBuffer) return new Uint8Array(d);
        if (ArrayBuffer.isView(d)) return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
        return new Uint8Array(d);
    }

    function rng(seed) {
        return function() {
            seed |= 0;
            seed = seed + 1831565813 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    function shuffleTable(names, seed) {
        const len = names.length
          , idx = names.map((_, i) => i)
          , next = rng(seed >>> 0);
        for (let i = len - 1; i > 0; i--) {
            const j = Math.floor(next() * (i + 1))
              , tmp = idx[i];
            idx[i] = idx[j];
            idx[j] = tmp;
        }
        const enc = {}, dec = {};
        for (let k = 0; k < len; k++) {
            enc[names[k]] = idx[k];
            dec[idx[k]] = names[k];
        }
        return { enc, dec };
    }

    function buildTables(seed) {
        const s = (seed ^ Math.imul(TABLE_SALT, 2654435761)) >>> 0;
        return {
            c2s: shuffleTable(C2S, s),
            s2c: shuffleTable(S2C, (s ^ 2246822507) >>> 0)
        };
    }

    const K = new Uint32Array([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);

    function rotr(x, n) { return x >>> n | x << 32 - n; }

    function sha256(msg) {
        const h = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225])
          , len = msg.length
          , bits = len * 8
          , padded = new Uint8Array(Math.ceil((len + 9) / 64) * 64);
        padded.set(msg);
        padded[len] = 128;
        const view = new DataView(padded.buffer);
        view.setUint32(padded.length - 4, bits >>> 0, false);
        view.setUint32(padded.length - 8, Math.floor(bits / 4294967296), false);
        const w = new Uint32Array(64);
        for (let off = 0; off < padded.length; off += 64) {
            for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
            for (let i = 16; i < 64; i++) {
                const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ w[i - 15] >>> 3
                  , s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ w[i - 2] >>> 10;
                w[i] = w[i - 16] + s0 + w[i - 7] + s1 | 0;
            }
            let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
            for (let i = 0; i < 64; i++) {
                const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
                  , ch = e & f ^ ~e & g
                  , t1 = hh + S1 + ch + K[i] + w[i] | 0
                  , S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
                  , maj = a & b ^ a & c ^ b & c
                  , t2 = S0 + maj | 0;
                hh = g; g = f; f = e; e = d + t1 | 0;
                d = c; c = b; b = a; a = t1 + t2 | 0;
            }
            h[0] = h[0] + a | 0; h[1] = h[1] + b | 0; h[2] = h[2] + c | 0; h[3] = h[3] + d | 0;
            h[4] = h[4] + e | 0; h[5] = h[5] + f | 0; h[6] = h[6] + g | 0; h[7] = h[7] + hh | 0;
        }
        const out = new Uint8Array(32)
          , ov = new DataView(out.buffer);
        for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i], false);
        return out;
    }

    function hmac(key, msg) {
        let k = key;
        if (k.length > BLOCK) k = sha256(k);
        const padKey = new Uint8Array(BLOCK);
        padKey.set(k);
        const inner = new Uint8Array(BLOCK + msg.length)
          , outer = new Uint8Array(BLOCK + 32);
        for (let i = 0; i < BLOCK; i++) {
            inner[i] = padKey[i] ^ 54;
            outer[i] = padKey[i] ^ 92;
        }
        inner.set(msg, BLOCK);
        outer.set(sha256(inner), BLOCK);
        return sha256(outer);
    }

    function tag(key, payload) { return hmac(key, payload).subarray(0, HEADER_LEN); }

    function hexToBytes(hex) {
        const out = new Uint8Array(hex.length / 2);
        for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
        return out;
    }

    const states = new WeakMap();

    function sniff(sock, raw) {
        try {
            const msg = decode(raw);
            if (msg[0] !== "io-init") return;
            const a = msg[1];
            states.set(sock, a[3] === MODE_SECURE ? {
                mode: MODE_SECURE,
                key: hexToBytes(a[2]),
                tables: buildTables(a[1] >>> 0),
                seq: 0
            } : { mode: 0, seq: 0 });
        } catch (e) {   }
    }

    function PatchedWebSocket(url, protocols) {
        const sock = protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
        sock.addEventListener("message", function(ev) {
            if (!states.has(sock)) sniff(sock, ev.data);
        });
        return sock;
    }
    PatchedWebSocket.prototype = NativeWebSocket.prototype;
    ["CONNECTING", "OPEN", "CLOSING", "CLOSED"].forEach(function(k) {
        PatchedWebSocket[k] = NativeWebSocket[k];
    });
    try {
        window.WebSocket = PatchedWebSocket;
    } catch (e) {
        console.warn("[EXP] could not install WebSocket wrapper", e);
    }


    function unframe(sock, raw) {
        const st = states.get(sock)
          , bytes = toBytes(raw);
        try {
            if (st && st.mode === MODE_SECURE) {
                const parsed = decode(bytes.subarray(HEADER_LEN))
                  , name = st.tables.c2s.dec[parsed[0]];
                if (name === undefined) return null;
                return { type: name, args: parsed[1] };
            }
            const parsed = decode(bytes);
            return { type: parsed[0], args: parsed[1] };
        } catch (e) {
            return null;
        }
    }

    function send(sock, type, args) {
        if (!sock || sock.readyState !== 1) return false;
        const name = Object.prototype.hasOwnProperty.call(PACKET_MAP, type) ? PACKET_MAP[type] : type
          , st = states.get(sock);
        if (st && st.mode === MODE_SECURE) {
            const op = st.tables.c2s.enc[name];
            if (op === undefined) return false;
            const payload = encode([op, args, ++st.seq])
              , frame = new Uint8Array(HEADER_LEN + payload.length);
            frame.set(tag(st.key, payload), 0);
            frame.set(payload, HEADER_LEN);
            nativeSend.call(sock, frame);
            return true;
        }
        nativeSend.call(sock, encode([name, args]));
        return true;
    }

    function receive(sock, raw) {
        const st = states.get(sock)
          , parsed = decode(toBytes(raw));
        let type = parsed[0];
        if (st && st.mode === MODE_SECURE && typeof type === "number") {
            type = st.tables.s2c.dec[type];
            if (type === undefined) return null;
        }
        return { type: type, args: parsed[1] };
    }

    let captchaToken = null;
    (function() {
        let inner = null;
        try {
            Object.defineProperty(window, "onGotTurnstileToken", {
                configurable: true,
                get: function() {
                    return function(t) {
                        captchaToken = t;
                        if (inner) inner(t);
                    };
                },
                set: function(fn) { inner = fn; }
            });
        } catch (e) {
            console.warn("[EXP] could not hook the Turnstile callback", e);
        }
    })();

    function token() {
        if (!captchaToken && window.turnstile && typeof window.turnstile.getResponse === "function") {
            try {
                const el = document.getElementById("turnstileWidget");
                captchaToken = (el ? window.turnstile.getResponse(el) : window.turnstile.getResponse()) || null;
            } catch (e) {   }
        }
        return captchaToken ? "cf:" + captchaToken : null;
    }

    function freshToken(timeoutMs) {
        return new Promise(function(resolve) {
            const previous = captchaToken;
            let reset = false;
            try {
                if (window.turnstile && typeof window.turnstile.reset === "function") {
                    captchaToken = null;
                    const el = document.getElementById("turnstileWidget");
                    el ? window.turnstile.reset(el) : window.turnstile.reset();
                    reset = true;
                }
            } catch (e) {
                captchaToken = previous;
            }
            if (!reset) return resolve(token());
            let waited = 0;
            const poll = setInterval(function() {
                if (captchaToken) {
                    clearInterval(poll);
                    resolve(token());
                } else if ((waited += 100) >= (timeoutMs || 8000)) {
                    clearInterval(poll);
                    captchaToken = previous;
                    resolve(token());
                }
            }, 100);
        });
    }

    let handler = null;
    NativeWebSocket.prototype.nsend = nativeSend;
    NativeWebSocket.prototype.send = function(data) {
        if (handler) return handler.call(this, data);
        return nativeSend.call(this, data);
    };

    window.msgpack = { encode: encode, decode: decode };

    return {
        encode: encode,
        decode: decode,
        unframe: unframe,
        send: send,
        receive: receive,
        stateOf: function(sock) { return states.get(sock); },
        isSecure: function(sock) { const s = states.get(sock); return !!(s && s.mode === MODE_SECURE); },
        setHandler: function(fn) { handler = fn; },
        token: token,
        freshToken: freshToken,
        nativeSend: nativeSend,
        PACKET_MAP: PACKET_MAP,
        _internals: { buildTables, tag, hexToBytes, HEADER_LEN, MODE_SECURE, states }
    };
}
)();
// COMMANDS JUST WATCH THESE DONT SEARCH THEM:
/*
value based commands just add anymore number begind last - and it will use that value:
".a -chat -" this for kill chat speed not very usefull (1500)
".a -pre -" preplacer speed (1000/9 keep it or packet spam)
".a -de -" angle delay (111)
".a -anti -" antisync speed just keep it at 75 go max lowest to 50 (75)
".a -ra -" velocity tick closest range (200)
".a -vel -" velocity tick max range (230)
".a -p -" set any delay of your ping its good if you want a challenge
command just to on something or change something:
".a -ap" autoplace disabler (true)
".a -re" replacer disabler (true)
".a -pre" preplacer disabler (false)
".a -gr" grind (false)
".a -au" autopush (true)
".a -ha -" custom hat (if you select none then just keep no hat)
*/

/**
*  █████╗ ███╗   ██╗███╗   ██╗██╗██╗  ██╗██╗██╗      █████╗ ████████╗ ██████╗ ██████╗     ██╗
* ██╔══██╗████╗  ██║████╗  ██║██║██║  ██║██║██║     ██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗   ██╔╝
* ███████║██╔██╗ ██║██╔██╗ ██║██║███████║██║██║     ███████║   ██║   ██║   ██║██████╔╝  ██╔╝
* ██╔══██║██║╚██╗██║██║╚██╗██║██║██╔══██║██║██║     ██╔══██║   ██║   ██║   ██║██╔══██╗ ██╔╝
* ██║  ██║██║ ╚████║██║ ╚████║██║██║  ██║██║███████╗██║  ██║   ██║   ╚██████╔╝██║  ██║██╔╝
* ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝
*
* ██████╗ ███████╗██╗   ██╗███████╗    ██╗███████╗ ██████╗██████╗ ██╗██████╗ ████████╗███████╗
* ██╔══██╗██╔════╝██║   ██║██╔════╝   ██╔╝██╔════╝██╔════╝██╔══██╗██║██╔══██╗╚══██╔══╝██╔════╝
* ██║  ██║█████╗  ██║   ██║███████╗  ██╔╝ ███████╗██║     ██████╔╝██║██████╔╝   ██║   ███████╗
* ██║  ██║██╔══╝  ╚██╗ ██╔╝╚════██║ ██╔╝  ╚════██║██║     ██╔══██╗██║██╔═══╝    ██║   ╚════██║
* ██████╔╝███████╗ ╚████╔╝ ███████║██╔╝   ███████║╚██████╗██║  ██║██║██║        ██║   ███████║
* ╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝╚═╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝╚═╝        ╚═╝   ╚══════╝
*
*     ██╗   ██╗███████╗    ██████╗  ██████╗
*    ██╔╝   ██║██╔════╝   ██╔════╝ ██╔════╝
*   ██╔╝    ██║███████╗   ██║  ███╗██║  ███╗
*  ██╔╝██   ██║╚════██║   ██║   ██║██║   ██║
* ██╔╝ ╚█████╔╝███████║██╗╚██████╔╝╚██████╔╝
* ╚═╝   ╚════╝ ╚══════╝╚═╝ ╚═════╝  ╚═════╝
*/

var visualsForNow = true;

function getEl(id) {
    return document.getElementById(id);
}
if(document.URL.includes('isAltPlayer')){
    document.querySelector("#resDisplay").querySelectorAll('*').forEach((e)=>{
        if(e.id!=='scoreDisplay'){
            e.style.display = 'none'
        }
    })
    document.querySelector('#allianceButton').style.position = 'fixed';
    document.querySelector('#allianceButton').style.top = '0';
    document.querySelector('#allianceButton').style.right = '0';


}

let altPlayerManager = {
    activator: [],
    iframe: null,
    iframeActive: false,
    mode: 'sync',
};
document.addEventListener('keydown', (e) => {
    if (e.key === '1' && document.activeElement.id.toLowerCase() !== "chatbox") {
        altPlayerManager.activator.push(Date.now());
        let recentPresses = altPlayerManager.activator.filter(g => Date.now() - g < 1000).length;

        if (recentPresses === 3) {
            if (altPlayerManager.iframe) {
                altPlayerManager.iframe.remove();
                altPlayerManager.iframe = null;
                altPlayerManager.iframeActive = false;
            } else {
                altPlayerManager.iframe = document.createElement('iframe');
                altPlayerManager.iframe.src = document.URL + '?isAltPlayer=true';
                altPlayerManager.iframe.style = `position:fixed;top:0%;right:0%;bottom:0%;left:0%;z-index:9999;width:75%;height:75%;display:block;`;
                document.body.appendChild(altPlayerManager.iframe);
                altPlayerManager.iframeActive = true;
            }
            altPlayerManager.activator = [];
        } else if (recentPresses === 1) {
            if (altPlayerManager.iframe) {
                altPlayerManager.iframe.style.display = (altPlayerManager.iframe.style.display === 'block') ? 'none' : 'block';
            }
        }
    }
});


document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && document.activeElement.id.toLowerCase() !== "chatbox") {
        e.preventDefault();
        if (altPlayerManager.iframeActive) {
            altPlayerManager.iframe.contentWindow.focus();
        } else {
            window.focus();
        }
        altPlayerManager.iframeActive = !altPlayerManager.iframeActive;
    }
});
top.customPlayerRange = 180;
top.customTeammateRange = 180;
const config = {
    maxScreenWidth: 1920,
    maxScreenHeight: 1080,
    serverUpdateRate: 9,
    serverUpdateSpeed: 1000 / 9,
    maxPlayers: 50,
    maxPlayersHard: 50,
    collisionDepth: 6,
    minimapRate: 3e3,
    colGrid: 10,
    volanoScale: 320,
    innerVolcanoScale: 100,
    volcanoAnimationDuration: 3200,
    clientSendRate: 5,
    healthBarWidth: 50,
    healthBarPad: 4.5,
    iconPadding: 15,
    iconPad: 0.9,
    deathFadeout: 3e3,
    crownIconScale: 60,
    crownPad: 35,
    chatCountdown: 3e3,
    chatCooldown: 5e2,
    inSanbox: true,
    maxAge: 1e2,
    gatherAngle: Math.PI / 2.6,
    gatherWiggle: 10,
    hitReturnRatio: 0.25,
    hitAngle: Math.PI / 2,
    playerScale: 35,
    playerSpeed: 0.0016,
    playerDecel: 0.993,
    nameY: 34,
    skinColors: ["#bf8f54","#cbb091","#896c4b","#fadadc","#ececec","#c37373","#4c4c4c","#ecaff7","#738cc3","#8bc373","#91b2db"],
    animalCount: 7,
    aiTurnRandom: 0.06,
    cowNames: [
        "SPSLPSLPSLSPLSPLPLS EHELP SHELP SHELpid", "Steph", "waohh", "Romn",
        "mega is crying inside", "fuck man", "Vince", "AHAHAHAHAHAHAH", "Nick Ger",
        "japan go boom boom", "HELPHELPHELP PLSPL", "Otis", "mega's lost sanity",
        "FUICK FUCK FUCK FUCK", "WAAAAAAAAAA", "big fat man", "Oliver", "Jeff took my wifi", "Jimmy", "WAAAAAAASDSADSAIJ HELP",
        "Reaper", "Ben", "Alan", "Naomi", "ABCDEFGHIJKLMPQURSTUVXYZ", "Clever", "Jeremy", "Mike", "Destined to fail",
        "OSPLSPLSPLPSLSPLSPL DUCK MAN TOOK MY HOME", "AHAHAHAHAHAHAHHAH PLSLPSLPSL", "Meaty and Creamy", "HELP HELP  HELP HELP HELP HELP HELP", "Vaja",
        "Joey", "GA GAS SAGGSAGASG", "Murdoch", "Theo robbed you", "Jared", "July is bad", "Sonia", "Mel", "Dexter",
        "Quinn is ass", "AHAHHAHAHAHAHAHHA PSLPSLPSLSPLS END EHLP"
    ],
    shieldAngle: Math.PI / 3,
    weaponVariants: [{
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
    }],
    fetchVariant: function (player) {
        let tmpXP = player.weaponXP[player.weaponIndex] || 0;
        for (let i = 4 - 1; i >= 0; --i) {
            if (tmpXP >= this.weaponVariants[i].xp) return this.weaponVariants[i];
        }
    },
    resourceTypes: ["wood", "food", "stone", "points"],
    areaCount: 7,
    treesPerArea: 9,
    bushesPerArea: 3,
    totalRocks: 32,
    goldOres: 7,
    riverWidth: 724,
    riverPadding: 114,
    waterCurrent: 0.0011,
    waveSpeed: 0.0001,
    waveMax: 1.3,
    treeScales: [150, 160, 165, 175],
    bushScales: [80, 85, 95],
    rockScales: [80, 85, 95],
    snowBiomeTop: 2400,
    snowSpeed: 0.75,
    maxNameLength: 15,
    mapScale: 144e2,
    mapPingScale: 40,
    mapPingTime: 22e2
};

config.clientSendRate = 0;
config.serverUpdateRate = 9;
config.deathFadeout = 0;
config.isSandbox = window.location.hostname == "sandbox.moomoo.io";
config.isNormal = window.location.hostname == "moomoo.io";
config.skinColors = ["#bf8f54", "#cbb091", "#896c4b", "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3", "#8bc373", "#91b2db"];
config.weaponVariants = [{
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
}, {
    id: 4,
    src: "_e",
    poison: true,
    heal: true,
    xp: 24000,
    val: 1.18
}];
config.anotherVisual = false;
config.useWebGl = false;
config.resetRender = false;

let changed = false;
let canStore;
if (typeof Storage !== "undefined") {
    canStore = true;
}
function saveVal(name, val) {
    if (canStore) {
        localStorage.setItem(name, val);
    }
}
function deleteVal(name) {
    if (canStore) {
        localStorage.removeItem(name);
    }
}
function getSavedVal(name) {
    if (canStore) {
        return localStorage.getItem(name);
    }
    return null;
}
var EasyStar = function (e) {
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
    return r.m = e, r.c = o, r.d = function (t, n, e) {
        r.o(t, n) || Object.defineProperty(t, n, {
            enumerable: !0,
            get: e
        })
    }, r.r = function (t) {
        "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(t, Symbol.toStringTag, {
            value: "Module"
        }), Object.defineProperty(t, "__esModule", {
            value: !0
        })
    }, r.t = function (n, t) {
        if (1 & t && (n = r(n)), 8 & t) return n;
        if (4 & t && "object" == typeof n && n && n.__esModule) return n;
        var e = Object.create(null);
        if (r.r(e), Object.defineProperty(e, "default", {
            enumerable: !0,
            value: n
        }), 2 & t && "string" != typeof n)
            for (var o in n) r.d(e, o, function (t) {
                return n[t]
            }.bind(null, o));
        return e
    }, r.n = function (t) {
        var n = t && t.__esModule ? function () {
            return t.default
        } : function () {
            return t
        };
        return r.d(n, "9", n), n
    }, r.o = function (t, n) {
        return Object.prototype.hasOwnProperty.call(t, n)
    }, r.p = "/bin/", r(r.s = 0)
}([function (t, n, e) {
    var P = {},
        M = e(1),
        _ = e(2),
        A = e(3);
    t.exports = P;
    var E = 1;
    P.js = function () {
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
        this.setAcceptableTiles = function (t) {
            t instanceof Array ? f = t : !isNaN(parseFloat(t)) && isFinite(t) && (f = [t])
        }, this.enableSync = function () {
            p = !0
        }, this.disableSync = function () {
            p = !1
        }, this.enableDiagonals = function () {
            v = !0
        }, this.disableDiagonals = function () {
            v = !1
        }, this.setGrid = function (t) {
            c = t;
            for (var n = 0; n < c.length; n++)
                for (var e = 0; e < c[0].length; e++) o[c[n][e]] || (o[c[n][e]] = 1)
        }, this.setTileCost = function (t, n) {
            o[t] = n
        }, this.setAdditionalPointCost = function (t, n, e) {
            void 0 === r[n] && (r[n] = {}), r[n][t] = e
        }, this.removeAdditionalPointCost = function (t, n) {
            void 0 !== r[n] && delete r[n][t]
        }, this.removeAllAdditionalPointCosts = function () {
            r = {}
        }, this.setDirectionalCondition = function (t, n, e) {
            void 0 === l[n] && (l[n] = {}), l[n][t] = e
        }, this.removeAllDirectionalConditions = function () {
            l = {}
        }, this.setIterationsPerCalculation = function (t) {
            y = t
        }, this.avoidAdditionalPoint = function (t, n) {
            void 0 === u[n] && (u[n] = {}), u[n][t] = 1
        }, this.stopAvoidingAdditionalPoint = function (t, n) {
            void 0 !== u[n] && delete u[n][t]
        }, this.enableCornerCutting = function () {
            a = !0
        }, this.disableCornerCutting = function () {
            a = !1
        }, this.stopAvoidingAllAdditionalPoints = function () {
            u = {}
        }, this.findPath = function (t, n, e, o, r) {
            function i(t) {
                p ? r(t) : setTimeout(function () {
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
                        a.openList = new A(function (t, n) {
                            return t.bestGuessDistance() - n.bestGuessDistance()
                        }), a.isDoneCalculating = !1, a.nodeHash = {}, a.startX = t, a.startY = n, a.endX = e, a.endY = o, a.callback = i, a.openList.push(O(a, a.startX, a.startY, null, 1));
                        o = E++;
                        return h[o] = a, d.push(o), o
                    }
                i(null)
            } else i([])
        }, this.cancelPath = function (t) {
            return t in h && (delete h[t], !0)
        }, this.calculate = function () {
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
        var T = function (t, n, e, o, r) {
            e = n.x + e, o = n.y + o;
            void 0 !== u[o] && void 0 !== u[o][e] || !g(c, f, e, o, n) || (void 0 === (o = O(t, e, o, n, r)).list ? (o.list = 1, t.openList.push(o)) : n.costSoFar + r < o.costSoFar && (o.costSoFar = n.costSoFar + r, o.parent = n, t.openList.updateItem(o)))
        },
            g = function (t, n, e, o, r) {
                var i = l[o] && l[o][e];
                if (i) {
                    var s = x(r.x - e, r.y - o);
                    if (! function () {
                        for (var t = 0; t < i.length; t++)
                            if (i[t] === s) return !0;
                        return !1
                    }()) return !1
                }
                for (var u = 0; u < n.length; u++)
                    if (t[o][e] === n[u]) return !0;
                return !1
            },
            x = function (t, n) {
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
            b = function (t, n) {
                return r[n] && r[n][t] || o[c[n][t]]
            },
            O = function (t, n, e, o, r) {
                if (void 0 !== t.nodeHash[e]) {
                    if (void 0 !== t.nodeHash[e][n]) return t.nodeHash[e][n]
                } else t.nodeHash[e] = {};
                var i = m(n, e, t.endX, t.endY),
                    r = null !== o ? o.costSoFar + r : 0,
                    i = new _(o, n, e, r, i);
                return t.nodeHash[e][n] = i
            },
            m = function (t, n, e, o) {
                var r, i;
                return v ? (r = Math.abs(t - e)) < (i = Math.abs(n - o)) ? s * r + i : s * i + r : (r = Math.abs(t - e)) + (i = Math.abs(n - o))
            }
        }, P.TOP = "TOP", P.TOP_RIGHT = "TOP_RIGHT", P.RIGHT = "RIGHT", P.BOTTOM_RIGHT = "BOTTOM_RIGHT", P.BOTTOM = "BOTTOM", P.BOTTOM_LEFT = "BOTTOM_LEFT", P.LEFT = "LEFT", P.TOP_LEFT = "TOP_LEFT"
}, function (t, n) {
    t.exports = function () {
        this.pointsToAvoid = {}, this.startX, this.callback, this.startY, this.endX, this.endY, this.nodeHash = {}, this.openList
    }
}, function (t, n) {
    t.exports = function (t, n, e, o, r) {
        this.parent = t, this.x = n, this.y = e, this.costSoFar = o, this.simpleDistanceToTarget = r, this.bestGuessDistance = function () {
            return this.costSoFar + this.simpleDistanceToTarget
        }
    }
}, function (t, n, e) {
    t.exports = e(4)
}, function (u, T, t) {
    var g, x;
    (function () {
        var t, p, l, h, d, n, a, e, y, v, o, r, i, c, f;
        function s(t) {
            this.cmp = null != t ? t : p, this.nodes = []
        }
        l = Math.floor, v = Math.min, p = function (t, n) {
            return t < n ? -1 : n < t ? 1 : 0
        }, y = function (t, n, e, o, r) {
            var i;
            if (null == e && (e = 0), null == r && (r = p), e < 0) throw new Error("lo must be non-negative");
            for (null == o && (o = t.length); e < o;) r(n, t[i = l((e + o) / 2)]) < 0 ? o = i : e = i + 1;
            return [].splice.apply(t, [e, e - e].concat(n)), n
        }, n = function (t, n, e) {
            return null == e && (e = p), t.push(n), c(t, 0, t.length - 1, e)
        }, d = function (t, n) {
            var e, o;
            return null == n && (n = p), e = t.pop(), t.length ? (o = t[0], t[0] = e, f(t, 0, n)) : o = e, o
        }, e = function (t, n, e) {
            var o;
            return null == e && (e = p), o = t[0], t[0] = n, f(t, 0, e), o
        }, a = function (t, n, e) {
            var o;
            return null == e && (e = p), t.length && e(t[0], n) < 0 && (n = (o = [t[0], n])[0], t[0] = o[1], f(t, 0, e)), n
        }, h = function (e, t) {
            var n, o, r, i, s, u;
            for (null == t && (t = p), s = [], o = 0, r = (i = function () {
                u = [];
                for (var t = 0, n = l(e.length / 2); 0 <= n ? t < n : n < t; 0 <= n ? t++ : t--) u.push(t);
                return u
            }.apply(this).reverse()).length; o < r; o++) n = i[o], s.push(f(e, n, t));
            return s
        }, i = function (t, n, e) {
            if (null == e && (e = p), -1 !== (n = t.indexOf(n))) return c(t, 0, n, e), f(t, n, e)
        }, o = function (t, n, e) {
            var o, r, i, s, u;
            if (null == e && (e = p), !(r = t.slice(0, n)).length) return r;
            for (h(r, e), i = 0, s = (u = t.slice(n)).length; i < s; i++) o = u[i], a(r, o, e);
            return r.sort(e).reverse()
        }, r = function (t, n, e) {
            var o, r, i, s, u, l, a, c, f;
            if (null == e && (e = p), 10 * n <= t.length) {
                if (!(i = t.slice(0, n).sort(e)).length) return i;
                for (r = i[i.length - 1], s = 0, l = (a = t.slice(n)).length; s < l; s++) e(o = a[s], r) < 0 && (y(i, o, 0, null, e), i.pop(), r = i[i.length - 1]);
                return i
            }
            for (h(t, e), f = [], u = 0, c = v(n, t.length); 0 <= c ? u < c : c < u; 0 <= c ? ++u : --u) f.push(d(t, e));
            return f
        }, c = function (t, n, e, o) {
            var r, i, s;
            for (null == o && (o = p), r = t[e]; n < e && o(r, i = t[s = e - 1 >> 1]) < 0;) t[e] = i, e = s;
            return t[e] = r
        }, f = function (t, n, e) {
            var o, r, i, s, u;
            for (null == e && (e = p), r = t.length, i = t[u = n], o = 2 * n + 1; o < r;)(s = o + 1) < r && !(e(t[o], t[s]) < 0) && (o = s), t[n] = t[o], o = 2 * (n = o) + 1;
            return t[n] = i, c(t, u, n, e)
        }, s.push = n, s.pop = d, s.replace = e, s.pushpop = a, s.heapify = h, s.updateItem = i, s.nlargest = o, s.nsmallest = r, s.prototype.push = function (t) {
            return n(this.nodes, t, this.cmp)
        }, s.prototype.pop = function () {
            return d(this.nodes, this.cmp)
        }, s.prototype.peek = function () {
            return this.nodes[0]
        }, s.prototype.contains = function (t) {
            return -1 !== this.nodes.indexOf(t)
        }, s.prototype.replace = function (t) {
            return e(this.nodes, t, this.cmp)
        }, s.prototype.pushpop = function (t) {
            return a(this.nodes, t, this.cmp)
        }, s.prototype.heapify = function () {
            return h(this.nodes, this.cmp)
        }, s.prototype.updateItem = function (t) {
            return i(this.nodes, t, this.cmp)
        }, s.prototype.clear = function () {
            return this.nodes = []
        }, s.prototype.empty = function () {
            return 0 === this.nodes.length
        }, s.prototype.size = function () {
            return this.nodes.length
        }, s.prototype.clone = function () {
            var t = new s;
            return t.nodes = this.nodes.slice(0), t
        }, s.prototype.toArray = function () {
            return this.nodes.slice(0)
        }, s.prototype.insert = s.prototype.push, s.prototype.top = s.prototype.peek, s.prototype.front = s.prototype.peek, s.prototype.has = s.prototype.contains, s.prototype.copy = s.prototype.clone, t = s, g = [], void 0 === (x = "function" == typeof (x = function () {
            return t
        }) ? x.apply(T, g) : x) || (u.exports = x)
    }).call(this)
}]);
let easystar = new EasyStar.js();
let gC = function (a, b) {
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
let autoVelocityTickToggled = false;
const {
    sin,
    cos,
    sqrt,

} = Math;
let configs = {
    doStackDamage: false,
    killChat: false,
    autoBuy: true,
    autoBuyEquip: false,
    alwaysFlipper: false,
    autoQonSync: false,
    autoPush: true,
    autoSync: true,
    revTick: false,
    doSpikeOnReverse: true,
    spikeTick: true,
    predictTick: true,
    doAutoBreakSpike: true,
    autoPlace: true,
    autoReplace: true,
    soldierEMP: false,
    autoPrePlace: true,
    antiTrap: true,
    slowOT: false,
    attackDir: false,
    noDir: false,
    showDir: true,
}
window.removeConfigs = function () {
    for (let cF in configs) {
        deleteVal(cF, configs[cF]);
    }
};
for (let cF in configs) {
    configs[cF] = gC(cF, configs[cF]);
}
window.changeMenu = function () { };
window.debug = function () { };
window.wasdMode = function () { };
window.startGrind = function () { };
window.resBuild = function () { };
window.toggleVisual = function () { };
window.prepareUI = function () { };
window.leave = function () { };
class HtmlAction {
    constructor(element) {
        this.element = element;
    }
    add(code) {
        if (!this.element) {
            return undefined;
        }
        this.element.innerHTML += code;
    }
    newLine(amount) {
        let result = "<br>";
        if (amount > 0) {
            result = "";
            for (let i = 0; i < amount; i++) {
                result += "<br>";
            }
        }
        this.add(result);
    }
    checkBox(setting) {
        let newCheck = "<input type = \"checkbox\"";
        if (setting.id) {
            newCheck += " id = " + setting.id;
        }
        if (setting.style) {
            newCheck += " style = " + setting.style.replaceAll(" ", "");
        }
        if (setting.class) {
            newCheck += " class = " + setting.class;
        }
        if (setting.checked) {
            newCheck += " checked";
        }
        if (setting.onclick) {
            newCheck += " onclick = " + setting.onclick;
        }
        newCheck += ">";
        this.add(newCheck);
    }
    text(setting) {
        let newText = "<input type = \"text\"";
        if (setting.id) {
            newText += " id = " + setting.id;
        }
        if (setting.style) {
            newText += " style = " + setting.style.replaceAll(" ", "");
        }
        if (setting.class) {
            newText += " class = " + setting.class;
        }
        if (setting.size) {
            newText += " size = " + setting.size;
        }
        if (setting.maxLength) {
            newText += " maxLength = " + setting.maxLength;
        }
        if (setting.value) {
            newText += " value = " + setting.value;
        }
        if (setting.placeHolder) {
            newText += " placeHolder = " + setting.placeHolder.replaceAll(" ", "&nbsp;");
        }
        newText += ">";
        this.add(newText);
    }
    select(setting) {
        let newSelect = "<select";
        if (setting.id) {
            newSelect += " id = " + setting.id;
        }
        if (setting.style) {
            newSelect += " style = " + setting.style.replaceAll(" ", "");
        }
        if (setting.class) {
            newSelect += " class = " + setting.class;
        }
        newSelect += ">";
        for (let options in setting.option) {
            newSelect += "<option value = " + setting.option[options].id;
            if (setting.option[options].selected) {
                newSelect += " selected";
            }
            newSelect += ">" + options + "</option>";
        }
        newSelect += "</select>";
        this.add(newSelect);
    }
    button(setting) {
        let newButton = "<button";
        if (setting.id) {
            newButton += " id = " + setting.id;
        }
        if (setting.style) {
            newButton += " style = " + setting.style.replaceAll(" ", "");
        }
        if (setting.class) {
            newButton += " class = " + setting.class;
        }
        if (setting.onclick) {
            newButton += " onclick = " + setting.onclick;
        }
        newButton += ">";
        if (setting.innerHTML) {
            newButton += setting.innerHTML;
        }
        newButton += "</button>";
        this.add(newButton);
    }
    selectMenu(setting) {
        let newSelect = "<select";
        if (!setting.id) {
            alert("please put id skid");
            return;
        }
        window[setting.id + "Func"] = function () { };
        if (setting.id) {
            newSelect += " id = " + setting.id;
        }
        if (setting.style) {
            newSelect += " style = " + setting.style.replaceAll(" ", "");
        }
        if (setting.class) {
            newSelect += " class = " + setting.class;
        }
        newSelect += " onchange = window." + (setting.id + "Func") + "()";
        newSelect += ">";
        let last;
        let i = 0;
        for (let options in setting.menu) {
            newSelect += "<option value = " + ("option_" + options) + " id = " + ("O_" + options);
            if (setting.menu[options]) {
                newSelect += " checked";
            }
            newSelect += " style = \"color: " + (setting.menu[options] ? "#000" : "#fff") + "; background: " + (setting.menu[options] ? "#8ecc51" : "#cc5151") + ";\">" + options + "</option>";
            i++;
        }
        newSelect += "</select>";
        this.add(newSelect);
        i = 0;
        for (let options in setting.menu) {
            window[options + "Func"] = function () {
                setting.menu[options] = getEl("check_" + options).checked ? true : false;
                saveVal(options, setting.menu[options]);
                getEl("O_" + options).style.color = setting.menu[options] ? "#000" : "#fff";
                getEl("O_" + options).style.background = setting.menu[options] ? "#8ecc51" : "#cc5151";
            };
            this.checkBox({
                id: "check_" + options,
                style: "display: " + (i == 0 ? "inline-block" : "none") + ";",
                class: "checkB",
                onclick: "window." + (options + "Func") + "()",
                checked: setting.menu[options]
            });
            i++;
        }
        last = "check_" + getEl(setting.id).value.split("_")[1];
        window[setting.id + "Func"] = function () {
            getEl(last).style.display = "none";
            last = "check_" + getEl(setting.id).value.split("_")[1];
            getEl(last).style.display = "inline-block";
        };
    }
}
;
const WompWomp = {
    trap:new Image(),
    spike:new Image(),
    spikeBreakSid: -1
}
WompWomp.trap.src = 'https://images.vexels.com/content/209028/preview/simple-hexagon-label-3f3168.png';
WompWomp.spike.src = 'https://cdn-icons-png.flaticon.com/512/279/279951.png'
class Html {
    constructor() {
        this.element = null;
        this.action = null;
        this.divElement = null;
        this.startDiv = function (setting, func) {
            let newDiv = document.createElement("div");
            if (setting.id) {
                newDiv.id = setting.id;
            }
            if (setting.style) {
                newDiv.style = setting.style;
            }
            if (setting.class) {
                newDiv.className = setting.class;
            }
            this.element.appendChild(newDiv);
            this.divElement = newDiv;
            let addRes = new HtmlAction(newDiv);
            if (typeof func == "function") {
                func(addRes);
            }
        };
        this.addDiv = function (setting, func) {
            let newDiv = document.createElement("div");
            if (setting.id) {
                newDiv.id = setting.id;
            }
            if (setting.style) {
                newDiv.style = setting.style;
            }
            if (setting.class) {
                newDiv.className = setting.class;
            }
            if (setting.appendID) {
                getEl(setting.appendID).appendChild(newDiv);
            }
            this.divElement = newDiv;
            let addRes = new HtmlAction(newDiv);
            if (typeof func == "function") {
                func(addRes);
            }
        };
    }
    set(id) {
        this.element = getEl(id);
        this.action = new HtmlAction(this.element);
    }
    resetHTML(text) {
        if (text) {
            this.element.innerHTML = "";
        } else {
            this.element.innerHTML = "";
        }
    }
    setStyle(style) {
        this.element.style = style;
    }
    setCSS(style) {
        this.action.add("<style>" + style + "</style>");
    }
};
let HTML = new Html();
let menuDiv = document.createElement("div");
menuDiv.id = "menuDiv";
document.body.appendChild(menuDiv);
HTML.set("menuDiv");
HTML.setStyle(`position: absolute; left: -200000px; top: 20px;`);
HTML.resetHTML();
HTML.setCSS(``);
HTML.startDiv({
    id: "menuHeadLine",
    class: "menuClass"
}, html => {
    html.add("eeee");
    html.button({
        id: "menuChanger",
        class: "material-icons",
        innerHTML: "sync",
        onclick: "window.changeMenu()"
    });
    HTML.addDiv({
        id: "menuButtons",
        style: "display: block; overflow-y: visible;",
        class: "menuC",
        appendID: "menuHeadLine"
    }, html => {
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
    }, html => {
        html.newLine();
        html.add("Weapon Grinder: ");
        html.checkBox({
            id: "weaponGrind",
            class: "checkB",
            onclick: "window.startGrind()"
        });
        html.newLine();
        html.add("AntiBull Type: ");
        html.select({
            id: "preplaceType",
            class: "Cselect",
            option: {
                "both": {
                    id: "both",
                    selected: true,
                },
                "spamTrap": {
                    id: "spamTrap",
                },
                "spamSpike": {
                    id: "spamSpike",
                }
            }
        });
    });
    HTML.addDiv({
        id: "menuConfig",
        class: "menuC",
        appendID: "menuHeadLine"
    }, html => {
        html.add("AutoPlacer Placement Tick: ");
        html.text({
            id: "autoPlaceTick",
            class: "customText",
            value: "2",
            size: "2em",
            maxLength: "1"
        });
        html.newLine();
        html.add("Configs: ");
        html.selectMenu({
            id: "configsChanger",
            class: "Cselect",
            menu: configs
        });
        html.newLine();
        html.add("InstaKill Type: ");
        html.select({
            id: "instaType",
            class: "Cselect",
            option: {
                Normal: {
                    id: "normal",
                    selected: true
                },
                Reverse: {
                    id: "rev",
                }
            }
        });
        html.newLine();
        html.add("AntiBull Type: ");
        html.select({
            id: "antiBullType",
            class: "Cselect",
            option: {
                "Disable AntiBull": {
                    id: "noab",
                    selected: true
                },
                "When Reloaded": {
                    id: "abreload",
                },
                "Primary Reloaded": {
                    id: "abalway",
                }
            }
        });
        html.newLine();
        html.add("Backup Nobull Insta: ");
        html.checkBox({
            id: "backupNobull",
            class: "checkB",
            checked: false
        });
        html.newLine();
        html.add("Turret Gear Combat Assistance: ");
        html.checkBox({
            id: "turretCombat",
            class: "checkB",
            checked: true
        });
        html.newLine();
        html.add("Safe AntiSpikeTick: ");
        html.checkBox({
            id: "safeAntiSpikeTick",
            class: "checkB",
            checked: true
        });
        html.newLine();
        html.add("Stary PVP style (barbarian): ");
        html.checkBox({
            id: "tryhardmode",
            class: "checkB",
            checked: false
        });
        html.newLine();
    });
    HTML.addDiv({
        id: "menuOther",
        class: "menuC",
        appendID: "menuHeadLine"
    }, html => {
        html.newLine();
        html.button({
            class: "menuB",
            innerHTML: "Reset Break Objects",
            onclick: "window.resBuild()"
        });
        html.newLine();
        html.add("Break Objects Range: ");
        html.text({
            id: "breakRange",
            class: "customText",
            value: "700",
            size: "3em",
            maxLength: "4"
        });
        html.newLine();
        html.add("Circle Rad: ");
        html.text({
            id: "circleRad",
            class: "customText",
            value: "200",
            size: "3em",
            maxLength: "4"
        });
        html.newLine();
        html.add("Rad Speed: ");
        html.text({
            id: "radSpeed",
            class: "customText",
            value: "0.1",
            size: "2em",
            maxLength: "3"
        });
        html.newLine(2);
        html.add("Cross World: ");
        html.checkBox({
            id: "funni",
            class: "checkB"
        });
        html.newLine();
        html.button({
            class: "menuB",
            innerHTML: "Toggle Another Visual",
            onclick: "window.toggleVisual()"
        });
        html.newLine();
        html.add("ID Sync: ");
        html.text({
            'id': "EventFollow"
        });
        html.newLine();
    });
});

let menuIndex = 0;
let menus = ["menuMain", "menuConfig", "menuOther"];
window.changeMenu = function () {
    getEl(menus[menuIndex % menus.length]).style.display = "none";
    menuIndex++;
    getEl(menus[menuIndex % menus.length]).style.display = "block";
};
let mStatus = document.createElement("div");
mStatus.id = "status";
getEl("gameUI").appendChild(mStatus);
HTML.set("status");
HTML.setStyle("            display: block;            position: absolute;            color: #ddd;            font: 15px Hammersmith One;            bottom: 215px;            left: 20px;            ");
HTML.resetHTML();
HTML.setCSS("            .sizing {                font-size: 15px;            }            .mod {                font-size: 15px;                display: inline-block;            }            ");
HTML.startDiv({
    id: "uehmod",
    class: "sizing"
}, html => {
    html.add("");
    HTML.addDiv({
        id: "pingFps",
        class: "mod",
        appendID: "uehmod"
    }, html => {
        html.add("");
    });
    html.newLine();
    html.add("");
    HTML.addDiv({
        id: "insta",
        class: "mod",
        appendID: "uehmod"
    }, html => {
        html.add("");
    });
});
let openMenu = false;
let WS = undefined;
let socketID = undefined;
let secPacket = 0;
let secMax = 110;
let secTime = 1000;
let date = Date.now();
let firstSend = {
    sec: false
};
let game = new class {
    constructor() {
        this.tick = 0;
        this.tickQueue = [];
        this.doNextTick = [];
        this.tickBase = function(set, tick) {
            if (this.tickQueue[this.tick + tick]) {
                this.tickQueue[this.tick + tick].push(set);
            } else {
                this.tickQueue[this.tick + tick] = [set];
            }
        };
        this.tickRate = (1000 / config.serverUpdateRate);
        this.tickSpeed = 0;
        this.lastTick = performance.now();
    }
    manageTickBase() {
        if (this.tickQueue[this.tick]) {
            this.tickQueue[this.tick].forEach(e => e());
        }
        if (this.doNextTick.length) {
            this.doNextTick.forEach(e => e());
        }
        this.doNextTick = [];
        checkTraps();
        tickBase22222();
        healing();
        if (!player.team && alliancePlayers.length) {
            alliancePlayers = [];
        }
    }
};
let Ichecklateropcode = { // later I check this
    oHealth: [500, false],
    enemyDidHit: false,
    canPlace: false,
    mode: 2,
    hitNextTick: false,
    placeNextTick: false,
    check: function () {
        if (player.weapons[1] == 10 && [4, 5].includes(player.weapons[0])) {
            return player.reloads[player.weapons[0]];
        } else {
            return player.reloads[53] && player.reloads[player.weapons[1]];
        }
        return false;
    },
    reset: function () {
        this.oHealth = [500, false];
        this.enemyDidHit = false;
        this.canPlace = false;
        this.mode = 2;
        this.hitNextTick = false;
        this.placeNextTick = false;
    }
};
let modConsole = [];
let dontSend = false;
let fpsTimer = {
    last: 0,
    time: 0,
    ltime: 0
};

let killchatSpeed = 1500;
let aSheal = false;
let range = 180;
let autoBreak = false;
var _0x353118;
let velocityRange = 255;
let antiSyncSpeed = 75;
let syncTypeRange = false;
let delayPing = (value) => {
    window.pingTime == value;
}
let idByChoose = false;
let preDelay = 222.3;
let _0x289ab9 = false;
let lastMoveDir = undefined;
let lastsp = ["cc", 1, "__proto__"];
function sendFiltered(sock, type, data) {
    {
        dontSend = false;
        if (type == "6") {
            if (data[0]) {
                let message = data[0];
                if (message == ".d" || (data[0].startsWith(".") && message != "." && message != "...")) dontSend = true;
                if (message.startsWith(".a -chat -")) { // killchatSpeed message
                    let a = message.replace(".a -chat -", "");
                    killchatSpeed = a;
                    game.tickBase(() => {
                        packet("6", "killchatSpeed Set To " + a + ".", "settings");
                    }, 6);
                }
                if (message == ".d" || (data[0].startsWith(".") && message != "." && message != "...")) dontSend = true;
                if (message.startsWith(".a -ha -")) { // custom hat
                    let a = message.replace(".a -ha -", "");
                    my.defaultHat = a;
                    game.tickBase(() => {
                        packet("6", "hat Set To " + a + ".", "settings");
                    }, 6);
                }
                if (message == ".d" || (data[0].startsWith(".") && message != "." && message != "...")) dontSend = true;
                if (message.startsWith(".a -p -")) { // ping speed
                    let a = message.replace(".a -p -", "");
                    delayPing = a;
                    game.tickBase(() => {
                        packet("6", "ping delay Set To " + a + ".", "settings");
                    }, 6);
                }
                if (message == ".d" || (data[0].startsWith(".") && message != "." && message != "...")) dontSend = true;
                if (message.startsWith(".a -de -")) { // preplacer delay
                    let a = message.replace(".a -de -", "");
                    preDelay = a;
                    game.tickBase(() => {
                        packet("6", "angle delay Set To " + a + ".", "settings");
                    }, 6);
                }
                if (message == ".d" || (data[0].startsWith(".") && message != "." && message != "...")) dontSend = true;
                if (message.startsWith(".a -ha -")) { // hat custom
                    let a = message.replace(".a -ha -", "");
                    idByChoose = a;
                    game.tickBase(() => {
                        packet("6", "hat Set To " + a + ".", "settings");
                    }, 6);
                }
                if (message == ".d" || (data[0].startsWith(".") && message != "." && message != "...")) dontSend = true;
                if (message.startsWith(".a -anti -")) { // antisync speed
                    let a = message.replace(".a -anti -", "");
                    antiSyncSpeed = a;
                    game.tickBase(() => {
                        packet("6", "antiSync Speed Set To " + a + ".", "settings");
                    }, 6);
                }
                // DONT TOUCH RANGE OR ITS BAD IF U DONT KNOW WHAT U DOING:
                if (message == ".d" || (data[0].startsWith(".") && message != "." && message != "...")) dontSend = true;
                if (message.startsWith(".a -ra -")) { // range velocity
                    let a = message.replace(".a -ra -", "");
                    range = a;
                    game.tickBase(() => {
                        packet("6", "rangeVel Set To " + a + ".", "settings");
                    }, 6);
                }
                if (message == ".d" || (data[0].startsWith(".") && message != "." && message != "...")) dontSend = true;
                if (message.startsWith(".a -vel -")) { // near range velocity
                    let a = message.replace(".a -vel -", "");
                    velocityRange = a;
                    game.tickBase(() => {
                        packet("6", "velocity range Set To " + a + ".", "settings");
                    }, 6);
                }
                if (message == ".a -ag") { // assassin
                    let a;
                    aSheal = !aSheal;
                    game.tickBase(() => {
                        packet(
                            "6",
                            `asassinHeal ${aSheal ? "Enabled." : "Disabled."}`,
                            "settings"
                        );
                    }, 6);
                }
                if (message == ".a -break") { // assassin
                    let a;
                    autoBreak = !autoBreak;
                    game.tickBase(() => {
                        packet(
                            "6",
                            `autoBreak ${autoBreak ? "Enabled." : "Disabled."}`,
                            "settings"
                        );
                    }, 6);
                }
                if (message == ".a -ap" || message == ".a -place") { // autoplace
                    let a;
                    configs.autoPlace = !configs.autoPlace;
                    game.tickBase(() => {
                        packet(
                            "6",
                            `autoPlace ${configs.autoPlace ? "Enabled." : "Disabled."}`,
                            "settings"
                        );
                    }, 6);
                }
                if (message == ".a -tex") { // doStackDamage
                    let a;
                    configs.doStackDamage = !configs.doStackDamage;
                    game.tickBase(() => {
                        packet(
                            "6",
                            `DamageTextStack ${configs.doStackDamage ? "Enabled." : "Disabled."}`,
                            "settings"
                        );
                    }, 6);
                }
                if (message == ".a -aut") { // autoBuy
                    let a;
                    configs.autoBuy = !configs.autoBuy;
                    game.tickBase(() => {
                        packet(
                            "6",
                            `autoBuy ${configs.autoBuy ? "Enabled." : "Disabled."}`,
                            "settings"
                        );
                    }, 6);
                }
                if (message == ".a -aat") { // autoBuy
                    let a;
                    configs.autoBuyEquip = !configs.autoBuyEquip;
                    game.tickBase(() => {
                        packet(
                            "6",
                            `autoBuyEquip ${configs.autoBuyEquip ? "Enabled." : "Disabled."}`,
                            "settings"
                        );
                    }, 6);
                }
                if (message == ".a -re" || message == ".a -replace") { // replacer
                    let a;
                    configs.autoReplace = !configs.autoReplace;
                    game.tickBase(() => {
                        packet(
                            "6",
                            `autoReplace ${configs.autoReplace ? "Enabled." : "Disabled."}`,
                            "settings"
                        );
                    }, 6);
                }
                if (message == ".a -pre" || message == ".a -preplacer") { // preplacer
                    let a;
                    configs.autoPrePlace = !configs.autoPrePlace;
                    game.tickBase(() => {
                        packet(
                            "6",
                            `autoPrePlace ${configs.autoPrePlace ? "Enabled." : "Disabled."}`,
                            "settings"
                        );
                    }, 6);
                }
                if (message == ".a -sync" || message == ".a -s") { // syncMusket
                    let a;
                    syncTypeRange = !syncTypeRange;
                    game.tickBase(() => {
                        packet(
                            "6",
                            `musketSync ${syncTypeRange ? "Enabled." : "Disabled."}`,
                            "settings"
                        );
                    }, 6);
                }
                if (message == ".a -gr") { // preplacer
                    let a;
                    getEl("weaponGrind").checked = !getEl("weaponGrind").checked;
                    game.tickBase(() => {
                        packet(
                            "6",
                            `weaponGrind ${getEl("weaponGrind").checked ? "Enabled." : "Disabled."}`,
                            "settings"
                        );
                    }, 6);
                }
                if (message == ".a -au") { // autopush
                    let a;
                    configs.autoPush = !configs.autoPush;
                    game.tickBase(() => {
                        packet(
                            "6",
                            `autoPush ${configs.autoPush ? "Enabled." : "Disabled."}`,
                            "settings"
                        );
                    }, 6);
                }
                let profanity = [];
                let tmpString;
                profanity.forEach(profany => {
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
                data[0] = data[0].slice(0, 30);
            }
        } else if (type == "L") {
            // MAKE SAME CLAN:
            data[0] = data[0] + (String.fromCharCode(0).repeat(7));
            data[0] = data[0].slice(0, 7);
        } else if (type == "M") {
            data[0].name = data[0].name == "" ? "unknown" : data[0].name;
            data[0].moofoll = true;
            data[0].skin = data[0].skin == 10 ? "__proto__" : data[0].skin;
            lastsp = [data[0].name, data[0].moofoll, data[0].skin];
        } else if (type == "D") {
            if (my.lastDir == data[0] || [null, undefined].includes(data[0])) {
                dontSend = true;
            } else {
                my.lastDir = data[0];
            }
        } else if (type == "d") {
            if (!data[2]) {
                dontSend = true;
            } else if (![null, undefined].includes(data[1])) {
                my.lastDir = data[1];
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
                }
                player.moveDir = data[0];
            } else {
                dontSend = true;
            }
        }
        if (!dontSend) {
            EXP.send(sock, type, data);
            if (!firstSend.sec) {
                firstSend.sec = true;
                setTimeout(() => {
                    firstSend.sec = false;
                    secPacket = 0;
                }, secTime);
            }
            secPacket++;
        }
    }
}

EXP.setHandler(function (message, sid) {
    if (!WS) {
        WS = this;
        WS.addEventListener("message", function (msg) {
            getMessage(msg);
        });
        WS.addEventListener("close", event => {
            if (event.code == 4001) {
                window.location.reload();
            }
        });
    }
    if (WS != this) return EXP.nativeSend.call(this, message);
    const unframed = EXP.unframe(this, message);
    if (!unframed) return EXP.nativeSend.call(this, message);
    sendFiltered(this, unframed.type, unframed.args);
});

function packet(type) {
    let data = Array.prototype.slice.call(arguments, 1);
    sendFiltered(WS, type, data);
}
function origPacket(type) {
    let data = Array.prototype.slice.call(arguments, 1);
    EXP.send(WS, type, data);
}
window.leave = function () {
    origPacket("kys", {
        "frvr is so bad": true,
        "sidney is too good": true,
        "dev are too weak": true
    });
};
let io = {
    send: packet
};

function getMessage(message, sid) {
    let parsed = EXP.receive(message.target || WS, message.data);
    if (!parsed) return;
    let type = parsed.type;
    let data = parsed.args;
    let events = {
        A: setInitData,
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
        2: allianceNotification,
        3: setPlayerTeam,
        4: setAlliancePlayers,
        5: updateStoreItems,
        6: receiveChat,
        7: updateMinimap,
        8: showText,
        9: pingMap,
        0: pingSocketResponse
    };
    if (type == "io-init") {
        socketID = data[0];
        prePlace.syncWithServerTicks();
    } else if (events[type]) {
        events[type].apply(undefined, data);
    }
}
Math.lerpAngle = function (value1, value2, amount) {
    let difference = Math.abs(value2 - value1);
    if (difference > Math.PI) {
        if (value1 > value2) {
            value2 += Math.PI * 2;
        } else {
            value1 += Math.PI * 2;
        }
    }
    let value = value2 + (value1 - value2) * amount;
    if (value >= 0 && value <= Math.PI * 2) {
        return value;
    }
    return value % (Math.PI * 2);
};
CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < r * 2) {
        r = w / 2;
    }
    if (h < r * 2) {
        r = h / 2;
    }
    if (r < 0) {
        r = 0;
    }
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
};
let allChats = [];
let ais = [];
let shameBar = false;
let players = [];
let alliances = [];
let alliancePlayers = [];
let allianceNotifications = [];
let gameObjects = [];
let projectiles = [];
let deadPlayers = [];
let breakObjects = [];
let player;
let playerSID;
let tmpObj;
let enemy = [];
let nears = [];
let healTimeStamp = 0;
let near = [];
let walkaim = undefined;
let ping = {
    Accurate: Math.max(10, (10 * 0.25) + window.pingTime),
}
let RealPush = false;
var retrappable = false;
let placerSpikeTick = false;
let my = {
    reloaded: false,
    waitHit: 0,
    autoAim: false,
    revAim: false,
    ageInsta: true,
    reSync: false,
    bullTick: 0,
    anti0Tick: 0,
    defaultHat: false,
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
    antiInsta: false
};
function findID(tmpObj, tmp) {
    return tmpObj.find(THIS => THIS.id == tmp);
}
function findSID(tmpObj, tmp) {
    return tmpObj.find(THIS => THIS.sid == tmp);
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
gameName.innerText = "MooMoo.io";
let adCard = getEl("adCard");
adCard.remove();
let promoImgHolder = getEl("promoImgHolder");
promoImgHolder.remove();
let chatButton = getEl("chatButton");
chatButton.remove();
let gameCanvas = getEl("gameCanvas");
let mainContext = gameCanvas.getContext("2d");
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
let isNight = false;
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
    39: [1, 0]
};
function resetMoveDir() {
    keys = {};
    io.send("e");
}
let attackState = 0;
let inGame = false;
let macro = {};
let mills = {
    place: 0,
    placeSpawnPads: 0
};
let lastDir;
let lastLeaderboardData = [];
let inWindow = true;
window.onblur = function () {
    inWindow = false;
};
window.onfocus = function () {
    inWindow = true;
    if (player && player.alive) {
        resetMoveDir();
    }
};
let profanityList = [];
class Utils {
    constructor() {
        let mathABS = Math.abs;
        let mathCOS = Math.cos;
        let mathSIN = Math.sin;
        let mathPOW = Math.pow;
        let mathSQRT = Math.sqrt;
        let mathATAN2 = Math.atan2;
        let mathPI = Math.PI;
        let _this = this;
        this.round = function (n, v) {
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
        this.randFloat = function (min, max) {
            return Math.random() * (max - min + 1) + min;
        };
        this.lerp = function (value1, value2, amount) {
            return value1 + (value2 - value1) * amount;
        };
        this.decel = function (val, cel) {
            if (val > 0) {
                val = Math.max(0, val - cel);
            } else if (val < 0) {
                val = Math.min(0, val + cel);
            }
            return val;
        };
        this.getDistance = function (x1, y1, x2, y2) {
            return mathSQRT((x2 -= x1) * x2 + (y2 -= y1) * y2);
        };
        this.getDist2 = function (a, b, v1 = '', v2 = '') {
            if (v1 === 0) v1 = '';
            if (v2 === 0) v2 = '';
            return Math.hypot(a[`x${v1}`] - b[`x${v2}`], a[`y${v1}`] - b[`y${v2}`]);
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
        this.dist = function (t, n, i = "", o = "") {
            return Math.hypot(
                t[`x${i || ""}`] - n[`x${o || ""}`],
                t[`y${i || ""}`] - n[`y${o || ""}`]
            );
        }
        this.getDirection = function (x1, y1, x2, y2) {
            return mathATAN2(y1 - y2, x1 - x2);
        };
        this.lerpAngle = function (value1, value2, amount) {
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
        this.getDirect = function (tmp1, tmp2, type1, type2) {
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
        this.getAngle = function (pointA, pointB) {
            return Math.atan2(pointB.y - pointA.y, pointB.x - pointA.x);
        };
        this.getAngleDist = function (a, b) {
            const p = mathABS(b - a) % (mathPI * 2);
            return (p > mathPI ? (mathPI * 2) - p : p);
        };
        this.isNumber = function (n) {
            return typeof n == "number" && !isNaN(n) && isFinite(n);
        };
        this.isString = function (s) {
            return s && typeof s == "string";
        };
        this.kFormat = function (num) {
            if (num > 999) {
                return (num / 1000).toFixed(1) + "k";
            } else {
                return num;
            }
        };
        this.sFormat = function (num) {
            let fixs = [{
                num: 1000,
                string: "k"
            }, {
                num: 1000000,
                string: "m"
            }, {
                num: 1000000000,
                string: "b"
            }, {
                num: 1000000000000,
                string: "q"
            }].reverse();
            let sp = fixs.find(v => num >= v.num);
            if (!sp) {
                return num;
            }
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
            if (maxX > recX2) maxX = recX2;
            if (minX < recX) minX = recX;
            if (minX > maxX) return false;
            let minY = y1;
            let maxY = y2;
            const dx = x2 - x1;
            if (Math.abs(dx) > 0.0000001) {
                const a = (y2 - y1) / dx;
                const b = y1 - a * x1;
                minY = a * minX + b;
                maxY = a * maxX + b;
            }
            if (minY > maxY) {
                const tmp = maxY;
                maxY = minY;
                minY = tmp;
            }
            if (maxY > recY2) maxY = recY2;
            if (minY < recY) minY = recY;
            if (minY > maxY) return false;
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
                if (element.onmouseover) {
                    element.onmouseover(e);
                }
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
                        if (element.onmouseover) {
                            element.onmouseover(e);
                        }
                        isHovering = true;
                    }
                } else if (isHovering) {
                    if (element.onmouseout) {
                        element.onmouseout(e);
                    }
                    isHovering = false;
                }
            }
            function touchEnd(element) {
                _this.mousifyTouchEvent(element);
                window.setUsingTouch(true);
                if (preventDefault) {
                    element.preventDefault();
                    element.stopPropagation();
                }
                if (isHovering) {
                    if (element.onclick) {
                        element.onclick(element);
                    }
                    if (element.onmouseout) {
                        element.onmouseout(element);
                    }
                    isHovering = false;
                }
            }
        };
        this.removeAllChildren = function (config) {
            while (config.hasChildNodes()) {
                config.removeChild(config.lastChild);
            }
        };
        this.generateElement = function (config) {
            let element = document.createElement(config.tag || "div");
            function bind(configValue, elementValue) {
                if (config[configValue]) {
                    element[elementValue] = config[configValue];
                }
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
            if (element.onclick) {
                element.onclick = this.checkTrusted(element.onclick);
            }
            if (element.onmouseover) {
                element.onmouseover = this.checkTrusted(element.onmouseover);
            }
            if (element.onmouseout) {
                element.onmouseout = this.checkTrusted(element.onmouseout);
            }
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
                } else { }
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
                if (array[i] === val) {
                    count++;
                }
            }
            return count;
        };
        this.hexToRgb = function (hex) {
            return hex.slice(1).match(/.{1,2}/g).map(g => parseInt(g, 16));
        };
        this.getRgb = function (r, g, b) {
            return [r / 255, g / 255, b / 255].join(", ");
        };
    }
}
;
class Animtext {
    constructor() {
        // INIT:
        this.init = function (x, y, scale, speed, life, text, color) {
            this.x = x;
            this.y = y;
            this.randomX = Math.floor(Math.random() * 2);
            this.randomSpeed = Math.floor(Math.random() * 5);
            this.moveSpeed = 10;
            this.color = color;
            this.scale = scale;
            this.startScale = this.scale;
            this.maxScale = scale * 1.5;
            this.scaleSpeed = 0.7;
            this.speed = 0.05;
            this.life = life;
            this.life2 = this.life;
            this.startLife = this.life;
            this.text = text;
            this.animation = 0;
            this.maxAnim = 100;
            this.acc = 1;
            this.acc2 = 1;
        };
        // UPDATE:
        this.update = function (delta) {
            if (this.life) {
                this.life -= delta;
                this.animation += 6;
                if (config.idk) {
                    if (this.animation < this.maxAnim) {
                        this.acc -= 0.05;
                        this.y -= this.speed * this.acc * delta;
                    } else {
                        this.life2 -= delta * 1.9;
                        this.acc += 0.05;
                        this.y += this.speed * this.acc * delta;
                    }
                    if (this.randomX == 1) {
                        this.x += this.moveSpeed;
                    } else if (this.randomX == 0) {
                        this.x -= this.moveSpeed;
                    }
                    this.moveSpeed = Math.max(0, this.moveSpeed - 1);
                    this.scale += this.scaleSpeed * delta;
                    if (this.scale >= this.maxScale) {
                        this.scale = this.maxScale;
                        this.scaleSpeed *= -1;
                    } else if (this.scale <= this.startScale) {
                        this.scaleSpeed = 0;
                        this.scale -= 0.1;
                    }
                } else {
                    this.y -= this.speed * delta;
                    this.scale += this.scaleSpeed * delta;
                    if (this.scale >= this.maxScale) {
                        this.scale = this.maxScale;
                        this.scaleSpeed *= -1;
                    } else if (this.scale <= this.startScale) {
                        this.scale = this.startScale;
                        this.scaleSpeed = 0;
                    }
                }
                if (this.life <= 0) {
                    this.life = 0;
                }
            }
        }
        ;

        // RENDER:
        this.render = function (ctxt, xOff, yOff) {
            if (config.idk) {
                ctxt.globalAlpha = Math.min(1, this.life2 / this.startLife);
            }
            ctxt.fillStyle = this.color;
            ctxt.font = this.scale + "px " + (config.anotherVisual ? "Hammersmith One" : "Hammersmith One");
            if (config.anotherVisual) {
                ctxt.globalAlpha = this.alpha;
                ctxt.strokeStyle = darkOutlineColor;
                ctxt.strokeText(this.text, this.x - xOff, this.y - yOff);
            }
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
        this.update = function (delta, ctxt, xOff, yOff) {
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
        this.showText = function (x, y, scale, speed, life, text, color) {
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
            this.isItem = this.id != undefined;
            this.group = data.group;
            this.maxHealth = data.health;
            this.health = this.maxHealth;
            this.healthMov = 100;
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
        this.changeHealth = function (amount, doer) {
            this.health += amount;
            return this.health <= 0;
        };
        this.getScale = function (sM, ig) {
            sM = sM || 1;
            return this.scale * (this.isItem || this.type == 2 || this.type == 3 || this.type == 4 ? 1 : sM * 0.6) * (ig ? 1 : this.colDiv);
        };
        this.visibleToPlayer = function (player) {
            return !this.hideFromEnemy || this.owner && (this.owner == player || this.owner.team && player.team == this.owner.team);
        };
        this.update = function (delta) {
            if (this.health != this.healthMov) {
                if (this.health < this.healthMov) {
                    this.healthMov -= 1.9;
                } else {
                    this.healthMov += 1.9;
                }
                if (Math.abs(this.health - this.healthMov) < 1.9) {
                    this.healthMov = this.health;
                }
            }
            ;
            if (this.active) {
                if (this.xWiggle) {
                    this.xWiggle *= Math.pow(0.99, delta);
                }
                if (this.yWiggle) {
                    this.yWiggle *= Math.pow(0.99, delta);
                }
                if (config.anotherVisual) {
                    let d2 = UTILS.getAngleDist(this.lastDir, this.dir);
                    if (d2 > 0.01) {
                        this.dir += d2 / 5;
                    } else {
                        this.dir = this.lastDir;
                    }
                } else if (this.turnSpeed && this.dmg) {
                    this.dir += this.turnSpeed * delta;
                }
            } else if (this.alive) {
                this.alpha -= delta / (200 / this.maxAlpha);
                this.visScale += delta / (this.scale / 2.5);
                if (this.alpha <= 0) {
                    this.alpha = 0;
                    this.alive = false;
                }
            }
        };
        // CHECK TEAM:
        this.isTeamObject = function (tmpObj) {
            return this.owner == null ? true : (this.owner && tmpObj.sid == this.owner.sid || findAllianceBySid(this.owner.sid));
        };
    }
}
class Items {
    constructor() {
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
            name: "katana",
            desc: "greater range and damage",
            src: "samurai_1",
            iPad: 1.3,
            length: 130,
            width: 210,
            xOff: -8,
            yOff: 59,
            dmg: 35,
            spdMult: 0.8,
            range: 118,
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
            itemAID: 16
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
            itemAID: 17
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
            itemAID: 18
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
            itemAID: 19
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
            itemAID: 20
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
            itemAID: 21
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
            itemAID: 22
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
            itemAID: 23
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
            itemAID: 24
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
            itemAID: 25
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
            itemAID: 26
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
            itemAID: 27
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
            itemAID: 28
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
            itemAID: 29
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
            itemAID: 30
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
            itemAID: 31
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
            itemAID: 32
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
            itemAID: 33
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
            itemAID: 34
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
            itemAID: 35
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
            itemAID: 36
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
            itemAID: 37
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
        this.checkItem = {
            index: function (id, myItems) {
                if ([0, 1, 2].includes(id)) {
                    return 0;
                } else if ([3, 4, 5].includes(id)) {
                    return 1;
                } else if ([6, 7, 8, 9].includes(id)) {
                    return 2;
                } else if ([10, 11, 12].includes(id)) {
                    return 3;
                } else if ([13, 14].includes(id)) {
                    return 5;
                } else if ([15, 16].includes(id)) {
                    return 4;
                } else if ([17, 18, 19, 21, 22].includes(id)) {
                    if ([13, 14].includes(myItems)) {
                        return 6;
                    } else {
                        return 5;
                    }
                } else if (id == 20) {
                    if ([13, 14].includes(myItems)) {
                        return 7;
                    } else {
                        return 6;
                    }
                } else {
                    return undefined;
                }
            }
        };
        for (let i = 0; i < this.list.length; ++i) {
            this.list[i].id = i;
            if (this.list[i].pre) {
                this.list[i].pre = i - this.list[i].pre;
            }
        }
        if (typeof window !== "undefined") {
            function shuffle(a) {
                for (let i = a.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [a[i], a[j]] = [a[j], a[i]];
                }
                return a;
            }
        }
    }
}
class Objectmanager {
    constructor(GameObject, gameObjects, UTILS, config, players, server) {
        let mathFloor = Math.floor;
        let mathABS = Math.abs;
        let mathCOS = Math.cos;
        let mathSIN = Math.sin;
        let mathPOW = Math.pow;
        let mathSQRT = Math.sqrt;
        this.ignoreAdd = false;
        this.hitObj = [];
        this.disableObj = function (obj) {
            obj.active = false;
            if (config.anotherVisual) { } else {
                obj.alive = false;
            }
        };
        let tmpObj;
        this.add = function (sid, x, y, dir, s, type, data, setSID, owner) {
            tmpObj = findObjectBySid(sid);
            if (!tmpObj) {
                tmpObj = gameObjects.find(tmp => !tmp.active);
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
        this.disableBySid = function (sid) {
            let find = findObjectBySid(sid);
            if (find) {
                this.disableObj(find);
            }
        };
        this.removeAllItems = function (sid, server) {
            gameObjects.filter(tmp => tmp.active && tmp.owner && tmp.owner.sid == sid).forEach(tmp => this.disableObj(tmp));
        };
        this.checkItemLocation = function (x, y, s, sM, indx, ignoreWater, placer) {
            let cantPlace = gameObjects.find(tmp => tmp.active && UTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
            if (cantPlace) {
                return false;
            }
            if (!ignoreWater && indx != 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) {
                return false;
            }
            return true;
        };
        // CHECK COLLISIONS:
        this.checkCollision2 = function (e, t, n = 1) {
            const dx = e.x2 - t.x;
            const dy = e.y2 - t.y;
            const radius = 35 + (t.realScale || t.scale);

            if (Math.abs(dx) <= radius || Math.abs(dy) <= radius) {
                const distance = Math.sqrt(dx * dx + dy * dy) - radius;
                if (distance <= 0) {
                    return true;
                }
            }
            return false;
        };

        // CHECK HITS:
        this.hitsToBreak = function (object, _) {
            if (!inGame || !object || !enemy.length || !_) return;

            let weapon = (_.secondaryIndex != undefined && _.primaryIndex != undefined) ? _.secondaryIndex == 10 ? _.secondaryIndex : _.primaryIndex : 10;
            let variant = _[(weapon < 9 ? "prima" : "seconda") + "ryVariant"];
            let variantDmg = variant != undefined ? config.weaponVariants[variant].val : 1.18;
            let damage = items.weapons[weapon].dmg;

            let tank = _.skinIndex == 40 ? 3.3 : 1;

            let effectiveDamage = damage * variantDmg * (items.weapons[weapon].sDmg || 1) * tank;

            return object.health / effectiveDamage;
        };

        this.canHit = function (player, object, weapon, moreSafe = 0) {
            let toRange = items.weapons[weapon].range + player.scale + object.scale / 3.25 + moreSafe;

            return UTILS.getDist(player, object, 2, 0) <= toRange;
        };
    }
}
class Projectile {
    constructor(players, ais, objectManager, items, config, UTILS, server) {
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
}
;
class Store {
    constructor() {
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
            dmgMultO: 1.2
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
}
;
class ProjectileManager {
    constructor(Projectile, projectiles, players, ais, objectManager, items, config, UTILS, server) {
        this.addProjectile = function (x, y, dir, range, speed, index, owner, ignoreObj, layer, inWindow) {
            let tmpData = items.projectiles[index];
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
            tmpProj.init(index, x, y, dir, speed, tmpData.dmg, range, tmpData.scale, owner);
            tmpProj.ignoreObj = ignoreObj;
            tmpProj.layer = layer || tmpData.layer;
            tmpProj.inWindow = inWindow;
            tmpProj.src = tmpData.src;
            return tmpProj;
        };
    }
}
;
class AiManager {
    constructor(ais, AI, players, items, objectManager, config, UTILS, scoreCallback, server) {
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
            speed: 0,
            turnSpeed: 0,
            scale: 70,
            spriteMlt: 1
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
            drop: ["food", 3000],
            minSpawnRange: 0.85,
            maxSpawnRange: 0.9
        }, {
            id: 10,
            name: "💀Wolf",
            src: "wolf_1",
            hostile: true,
            fixedSpawn: true,
            dontRun: true,
            hitScare: 50,
            spawnDelay: 30000,
            dmg: 10,
            killScore: 700,
            health: 500,
            weightM: 0.45,
            speed: 0.00115,
            turnSpeed: 0.0025,
            scale: 88,
            viewRange: 1440,
            chargePlayer: true,
            drop: ["food", 400],
            minSpawnRange: 0.85,
            maxSpawnRange: 0.9
        }, {
            id: 11,
            name: "💀Bully",
            src: "bull_1",
            hostile: true,
            fixedSpawn: true,
            dontRun: true,
            hitScare: 50,
            dmg: 20,
            killScore: 5000,
            health: 5000,
            spawnDelay: 100000,
            weightM: 0.45,
            speed: 0.00115,
            turnSpeed: 0.0025,
            scale: 94,
            viewRange: 1440,
            chargePlayer: true,
            drop: ["food", 800],
            minSpawnRange: 0.85,
            maxSpawnRange: 0.9
        }];
        this.spawn = function (x, y, dir, index) {
            let tmpObj = ais.find(tmp => !tmp.active);
            if (!tmpObj) {
                tmpObj = new AI(ais.length, objectManager, players, items, UTILS, config, scoreCallback, server);
                ais.push(tmpObj);
            }
            tmpObj.init(x, y, dir, index, this.aiTypes[index]);
            return tmpObj;
        };
    }
}
;
class AI {
    constructor(sid, objectManager, players, items, UTILS, config, scoreCallback, server) {
        this.sid = sid;
        this.isAI = true;
        this.nameIndex = UTILS.randInt(0, config.cowNames.length - 1);
        this.init = function (x, y, dir, index, data) {
            this.x = x;
            this.y = y;
            this.xVel = 0;
            this.yVel = 0;
            this.zIndex = 0;
            this.dir = dir;
            this.dirPlus = 0;
            this.index = index;
            this.src = data.src;
            if (data.name) {
                this.name = data.name;
            }
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
                } else if (animIndex == 0) {
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
        };
        this.startAnim = function () {
            this.animTime = this.animSpeed = 600;
            this.targetAngle = Math.PI * 0.8;
            tmpRatio = 0;
            animIndex = 0;
        };
    }
}
;
class addCh {
    constructor(x, y, chat, tmpObj) {
        this.x = x;
        this.y = y;
        this.alpha = 0;
        this.active = true;
        this.alive = false;
        this.chat = chat;
        this.owner = tmpObj;
    }
}
;
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
        this.animate = function (delta) {
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
        };
    }
}
;
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
        this.prevHW;
        this.prevDW;
        this.tails = {};
        this.trapClear = false;
        for (let i = 0; i < accessories.length; ++i) {
            if (accessories[i].price <= 0) {
                this.tails[accessories[i].id] = 1;
            }
        }
        this.skins = {};
        for (let i = 0; i < hats.length; ++i) {
            if (hats[i].price <= 0) {
                this.skins[hats[i].id] = 1;
            }
        }
        this.points = 0;
        this.dt = 0;
        this.hidden = false;
        this.itemCounts = {};
        this.isPlayer = true;
        this.pps = 0;
        this.moveDir = undefined;
        this.skinRot = 0;
        this.lastPing = 0;
        this.iconIndex = 0;
        this.hitSpike = false;
        this.skinColor = 0;
        this.lastAttackers = [];
        this.dist2 = 0;
        this.aim2 = 0;
        this.maxSpeed = 1;
        this.chat = {
            message: null,
            count: 0
        };
        this.backupNobull = true;
        this.circle = false;
        this.circleRad = 200;
        this.circleRadSpd = 0.1;
        this.cAngle = 0;
        this.spawn = function (moofoll) {
            this.lastSkinIndexes = [];
            this.attacked = false;
            this.death = false;
            this.spinDir = 0;
            this.dot = 0;
            this.sync = false;
            this.antiClown = 4;
            this.maxShame = 7;
            this.anti = false;
            this.antiBull = 0;
            this.bullTimer = 0;
            this.poisonTimer = 0;
            this.moveSpeed = 10;
            this.moveState = 0;
            this.syncThreats = 0;
            this.active = true;
            this.alive = true;
            this.bTick = 0;
            this.healSid = -1;
            this.damaged = false;
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
            this.dt = 0;
            this.rt = 0;
            this.weaponVariant = 0;
            this.primaryIndex = undefined;
            this.secondaryIndex = undefined;
            this.primaryHit = 0;
            this.secondaryHit = 0;
            this.turretTick = 0;
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
                53: 0
            };
            this.bowThreat = {
                9: 0,
                12: 0,
                13: 0,
                15: 0
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
        this.resetMoveDir = function () {
            this.moveDir = undefined;
        };
        this.resetResources = function (moofoll) {
            for (let i = 0; i < config.resourceTypes.length; ++i) {
                this[config.resourceTypes[i]] = moofoll ? 100 : 0;
            }
        };
        this.getItemType = function (id) {
            let findindx = this.items.findIndex(ids => ids == id);
            if (findindx != -1) {
                return findindx;
            } else {
                return items.checkItem.index(id, this.items);
            }
        };
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
        this.updateTimer = function () {
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
        this.update = function (delta) {
            if (this.alive) {
                if (this.health != this.healthMov) {
                    if (this.health < this.healthMov) {
                        this.healthMov -= 2;
                    } else {
                        this.healthMov += 2;
                    }
                    if (Math.abs(this.health - this.healthMov) < 2) {
                        this.healthMov = this.health;
                    }
                }
                ;
                if (this.shameCount != this.shameMov) {
                    if (this.shameCount < this.shameMov) {
                        this.shameMov -= 0.1;
                    } else {
                        this.shameMov += 0.1;
                    }
                    if (Math.abs(this.shameCount - this.shameMov) < 0.1) {
                        this.shameMov = this.shameCount;
                    }
                }
            }
            if (this.sid == playerSID) {
                this.circleRad = 0;
                this.circleRadSpd = 0;
                this.cAngle += this.circleRadSpd;
            }
            if (this.active) {
                let gear = {
                    skin: findID(hats, this.skinIndex),
                    tail: findID(accessories, this.tailIndex)
                };
                let spdMult = (this.buildIndex >= 0 ? 0.5 : 1) * (items.weapons[this.weaponIndex].spdMult || 1) * (gear.skin ? gear.skin.spdMult || 1 : 1) * (gear.tail ? gear.tail.spdMult || 1 : 1) * (this.y <= config.snowBiomeTop ? gear.skin && gear.skin.coldM ? 1 : config.snowSpeed : 1) * this.slowMult;
                this.maxSpeed = spdMult;
            }
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
                } else if (animIndex == 0) {
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
        };
        this.startAnim = function (didHit, index) {
            this.animTime = this.animSpeed = items.weapons[index].speed;
            this.targetAngle = didHit ? -config.hitAngle : -Math.PI;
            tmpRatio = 0;
            animIndex = 0;
        };
        this.canSee = function (other) {
            if (!other) {
                return false;
            }
            let dx = Math.abs(other.x - this.x) - other.scale;
            let dy = Math.abs(other.y - this.y) - other.scale;
            return dx <= config.maxScreenWidth / 2 * 1.3 && dy <= config.maxScreenHeight / 2 * 1.3;
        };
        this.judgeShame = function () {
            if (this.oldHealth < this.health) {
                if (this.hitTime) {
                    let timeSinceHit = Date.now() - this.hitTime;
                    this.lastHit = game.tick;
                    this.hitTime = 0;
                    if (timeSinceHit < 120) {
                        this.shameCount++;
                    } else {
                        this.shameCount = Math.max(0, this.shameCount - 2);
                    }
                }
            } else if (this.oldHealth > this.health) {
                this.hitTime = Date.now();
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
        this.isTeam = function (tmpObj) {
            return this == tmpObj || this.team && this.team == tmpObj.team;
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
                    dmg: this.weapons[0] == undefined ? 0 : items.weapons[this.weapons[0]].dmg
                };
                let secondary = {
                    weapon: this.weapons[1],
                    variant: this.secondaryVariant,
                    dmg: this.weapons[1] == undefined ? 0 : items.weapons[this.weapons[1]].Pdmg
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
        this.addDamageThreat = function (tmpObj) {
            const defaultPrimaryDmg = 45;
            const defaultSecondaryDmg = 35;
            const bullMultiplier = 1.5;
            const defaultVariantVal = 1.18;
            const skinIndexPenalty = 0.75;
            const closeRangeThreshold = 300;
            const additionalThreatReloadTickRate = game.tickRate;
            const additionalThreatValue = 25;

            let { primaryIndex, primaryVariant, secondaryIndex, secondaryVariant, reloads, dist2 } = this;
            let { weapons } = items;
            let { weaponVariants } = config;

            let primary = {
                weapon: primaryIndex,
                variant: primaryVariant,
                dmg: primaryIndex === undefined ? defaultPrimaryDmg : weapons[primaryIndex].dmg
            };

            let secondary = {
                weapon: secondaryIndex,
                variant: secondaryVariant,
                dmg: secondaryIndex === undefined ? defaultSecondaryDmg : weapons[secondaryIndex].Pdmg
            };

            let primaryVariantValue = primary.variant !== undefined ? weaponVariants[primary.variant].val : defaultVariantVal;
            let secondaryVariantValue = secondary.variant !== undefined && ![9, 12, 17, 15].includes(secondary.weapon) ? weaponVariants[secondary.variant].val : defaultVariantVal;

            let damageThreat = 0;

            if (primary.weapon === undefined || reloads[primary.weapon] === 0) {
                damageThreat += primary.dmg * primaryVariantValue * bullMultiplier;
            }

            if (secondary.weapon === undefined || reloads[secondary.weapon] === 0) {
                damageThreat += secondary.dmg * secondaryVariantValue;
            }
            if (my.predictSpikes > 0) {
                let detectIt = (secondary.weapon == 10 ? 45 : 35) * my.predictSpikes;
                this.damageThreat += detectIt;
                this.mostDamageThreat += detectIt;
                my.predictSpikes = 0;
            }
            if (reloads[53] <= additionalThreatReloadTickRate) {
                damageThreat += additionalThreatValue;
            }

            damageThreat *= tmpObj.skinIndex === 6 ? skinIndexPenalty : 1;

            if (!this.isTeam(tmpObj) && dist2 <= closeRangeThreshold) {
                tmpObj.damageThreat += damageThreat;
            }
        };

        // ANTI
        this.addDamageProbability = function (tmpObj) {
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
            let pV = primary.variant != undefined ? config.weaponVariants[primary.variant].val : 1.18;
            let sV = secondary.variant != undefined ? [9, 12, 17, 15].includes(secondary.weapon) ? 1 : config.weaponVariants[secondary.variant].val : 1.18;
            if (primary.weapon == undefined ? true : this.reloads[primary.weapon] == 0) {
                this.damageProbably += primary.dmg * pV * bull * 0.75;
            }
            if (secondary.weapon == undefined ? true : this.reloads[secondary.weapon] == 0) {
                this.damageProbably += secondary.dmg * sV;
            }
            this.damageProbably *= 0.75;
            if (!this.isTeam(tmpObj)) {
                if (this.dist2 <= 300) {
                    tmpObj.damageProbably += this.damageProbably;
                }
            }
        };
    }
};
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
            if (id != 11 && id != 0) {
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
    packet("z", index, wpn);
}
function selectWeapon(index, isPlace) {
    if (!isPlace) {
        player.weaponCode = index;
    }
    packet("z", index, 1);
}
function sendAutoGather() {
    packet("K", 1, 1);
}
function sendAtck(id, angle) {
    packet("F", id, angle, 1);
}
let attackTime = Date.now();
function place(id, rad, rmd) {
    try {
        if (id == undefined) {
            return;
        }
        let item = items.list[player.items[id]];
        let tmpS = player.scale + item.scale + (item.placeOffset || 0);
        let tmpX = player.x2 + tmpS * Math.cos(rad);
        let tmpY = player.y2 + tmpS * Math.sin(rad);
        if (id === 0 || (player.alive && inGame && player.itemCounts[item.group.id] == undefined ? true : player.itemCounts[item.group.id] < (config.isSandbox ? id === 3 || id === 5 ? 299 : 99 : item.group.limit ? item.group.limit : 99))) {
            selectToBuild(player.items[id]);
            sendAtck(1, rad);
            selectWeapon(player.weaponCode, 1);
            if(Date.now() - attackTime < window.pingTime) {
                sendAtck(1, getAttackDir());
                sendAtck(0, getAttackDir());
            }
        }
    } catch (e) {
        console.log(e);
    }
}
function getDist(e, t) {
    try {
        return Math.hypot((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
    } catch (e) {
        return Infinity;
    }
}
function getDir(e, t) {
    try {
        return Math.atan2((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
    } catch (e) {
        return 0;
    }
}
function checkPlace(id, rad) {
    try {
        if (secPacket >= 60) {
            return;
        }
        if (id == undefined) {
            return;
        }
        let item = items.list[player.items[id]];
        let tmpS = player.scale + item.scale + (item.placeOffset || 0);
        let tmpX = player.x2 + tmpS * Math.cos(rad);
        let tmpY = player.y2 + tmpS * Math.sin(rad);
        if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false, player)) {
            place(id, rad, 1);
        }
    } catch (e) { }
}
var preIndi = [];
function cplace(id, rad) {
    if (id == undefined) return;
    let item = items.list[player.items[id]];
    let tmpS = player.scale + item.scale + (item.placeOffset || 0);
    let tmpX = player.x2 + tmpS * Math.cos(rad);
    let tmpY = player.y2 + tmpS * Math.sin(rad);
    preIndi.push({
        x: tmpX,
        y: tmpY,
        name: item.name,
        scale: item.scale,
        dir: rad
    });
    game.tickBase(() => {
        preIndi.shift();
    }, 1);
    game.tickBase(() => {
        preIndi.shift();
    }, 3);
    if (id === 0 || (player.alive && inGame)) {
        selectToBuild(player.items[id]);
        sendAtck(1, rad);
        selectWeapon(player.weaponCode, 1);
    }
}
// Know If Teamate:
function isTeam(tmpObj) {
    return (tmpObj == player || (tmpObj.team && tmpObj.team == player.team));
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

function antiSyncHealing(timearg) {
    my.antiSync = true;
    let healAnti = setInterval(() => {
        if (player.shameCount < 5) {
            place(0, getAttackDir());
        }
    }, antiSyncSpeed);
    setTimeout(()=>{
        clearInterval(healAnti);
        setTimeout(()=>{
            my.antiSync = false;
        }, config.tickRate);
    }, config.tickRate * timearg);
}
// END HEALING:

let ticks = {
    tick: 0,
    delay: 0,
    time: [],
    manage: [],
};

function setTickout(doo, timeout) {
    if (!ticks.manage[ticks.tick + timeout]) {
        ticks.manage[ticks.tick + timeout] = [doo];
    } else {
        ticks.manage[ticks.tick + timeout].push(doo);
    }
}
function sync() {
    if (player.weapons[1] != 15) {
        return;
    }
    my.autoAim = true;
    buyEquip(53, 0);
    selectWeapon(player.weapons[1]);
    setTimeout(() => {
        sendAutoGather();
        game.tickBase(() => {
            game.tickBase(() => {
                sendAutoGather();
                my.autoAim = false;
            }, 1);
        }, 1);
    }, 50);
}

function isPositionValid(position) {
    const playerX = player.x2;
    const playerY = player.y2;
    const distToPosition = Math.hypot(position[0] - playerX, position[1] - playerY);
    return distToPosition > 35;
}
function findAllianceBySid(sid) {
    if (player.team) {
        return alliancePlayers.find(THIS => THIS === sid);
    } else {
        return null;
    }
}
function calculatePossibleTrapPositions(x, y, radius) {
    const trapPositions = [];
    const numPositions = 16;
    for (let i = 0; i < numPositions; i++) {
        const angle = Math.PI * 2 * i / numPositions;
        const offsetX = x + radius * Math.cos(angle);
        const offsetY = y + radius * Math.sin(angle);
        const position = [offsetX, offsetY];
        if (!trapPositions.some(pos => isPositionTooClose(position, pos))) {
            trapPositions.push(position);
        }
    }
    return trapPositions;
}
function isPositionTooClose(position1, position2, minDistance = 50) {
    const dist = Math.hypot(position1[0] - position2[0], position1[1] - position2[1]);
    return dist < minDistance;
}
let evil = true;
function checkCanPrePlace(id, rad, obj) {
    try {
        let wall = id == 2 && !evil ? 1 : id;
        if (wall == undefined) return false;
        let item = items.list[player.items[wall]];
        let tmpS = 35 + item.scale + (item.placeOffset || 0);
        let tmpX = player.x2 + tmpS * Math.cos(rad);
        let tmpY = player.y2 + tmpS * Math.sin(rad);
        if (
            objectManager.checkItemLocationPrePlace(
                tmpX,
                tmpY,
                item.scale,
                0.6,
                item.id,
                false,
                player,
                obj
            )
        ) {
            return true;
        } else {
            return false;
        }
    } catch (e) { }
}
function biomeGear(mover, returns, id) {
    if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
        if (returns) return 31;
        buyEquip(31, 0);
    } else {
        if (player.y2 <= config.snowBiomeTop) {
            buyEquip(15, 0);
        } else if (!my.defaultHat) {
            buyEquip(12, 0);
        } else {
            buyEquip(my.defaultHat, 0);
        }
    }
    if (returns) return 0;
}
function woah(mover) {
    buyEquip(mover && isMoveDir == undefined ? 0 : 11, 1);
}
function Text(text, color, hit, x, y) {
    if (player.alive) {
        textManager.showText(player.x + (x || 0), player.y + (y || 0) + (hit ? 100 : 0), 35, hit ? -0.1 : 0.1, 500, text, color);
    }
}
function checkCanPlace(id, rad) {
    try {
        let wall = id == 2 && !evil ? 1 : id;
        if (wall == undefined) return false;
        let item = items.list[player.items[wall]];
        let tmpS = 35 + item.scale + (item.placeOffset || 0);
        let tmpX = player.x2 + tmpS * Math.cos(rad);
        let tmpY = player.y2 + tmpS * Math.sin(rad);
        if (
            objectManager.checkItemLocation(
                tmpX,
                tmpY,
                item.scale,
                0.6,
                item.id,
                false,
                player
            )
        ) {
            return true;
        } else {
            return false;
        }
    } catch (e) { }
}
let perfSpikeAngle;
let perfSpike;
let placedOnPerfectAngle = false;
let advHeal = [];
let doStuffPingSet = [];
class Traps {
    constructor(UTILS, items) {
        this.dist = 0;
        this.aim = 0;
        this.inTrap = false;
        this.replaced = false;
        this.antiTrapped = false;

        this.latestHitObj = [];
        this.latestHitPlayer = [];

        this.info = {};
        this.notFast = function () {
            return player.weapons[1] == 10 && (this.info.health > items.weapons[player.weapons[0]].dmg || player.weapons[0] == 5);
        };
        this.testCanPrePlace = function (id, first = -(Math.PI / 2), repeat = Math.PI / 2, plus = Math.PI / 18, radian, replacer, yaboi) {
            try {
                let item = items.list[player.items[id]];
                let tmpS = player.scale + item.scale + (item.placeOffset || 0);
                let counts = {
                    attempts: 0,
                    placed: 0
                };
                let tmpObjects = [];
                gameObjects.forEach(p => {
                    tmpObjects.push({
                        x: p.x,
                        y: p.y,
                        active: p.active,
                        blocker: p.blocker,
                        scale: p.scale,
                        isItem: p.isItem,
                        type: p.type,
                        colDiv: p.colDiv,
                        getScale: function (sM, ig) {
                            sM = sM || 1;
                            return this.scale * (this.isItem || this.type == 2 || this.type == 3 || this.type == 4 ? 1 : sM * 0.6) * (ig ? 1 : this.colDiv);
                        }
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
                    if ((!replacer && yaboi)) {
                        if (yaboi.inTrap) {
                            if (UTILS.getAngleDist(near.aim2 + Math.PI, relAim + Math.PI) <= Math.PI*1.3) {
                                cplace(2, relAim, 1);
                            } else {
                                player.items[4] == 15 && cplace(4, relAim, 1);
                            }
                        } else {
                            if (UTILS.getAngleDist(near.aim2, relAim) <= config.gatherAngle / 2.6) {
                                cplace(2, relAim, 1);
                            } else {
                                player.items[4] == 15 && cplace(4, relAim, 1);
                            }
                        }
                    } else {
                        cplace(id, relAim, 1);
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
                        getScale: function () {
                            return this.scale;
                        }
                    });
                    if (UTILS.getAngleDist(near.aim2, relAim) <= 1) {
                        counts.placed++;
                    }
                }
                if (counts.placed > 0 && replacer && item.dmg) {
                    if (near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8 && configs.spikeTick) {
                        instaC.canSpikeTick = true;
                    }
                }
            } catch (err) { }
        };
        this.Starplacer = function (id, first = -(Math.PI / 2), repeat = Math.PI / 2, plus = Math.PI / 18, radian, replacer, yaboi) {
            try {
                let item = items.list[player.items[id]];
                let tmpS = player.scale + item.scale + (item.placeOffset || 0);
                let counts = {
                    attempts: 0,
                    placed: 0
                };
                let tmpObjects = [];
                gameObjects.forEach(p => {
                    tmpObjects.push({
                        x: p.x,
                        y: p.y,
                        active: p.active,
                        blocker: p.blocker,
                        scale: p.scale,
                        isItem: p.isItem,
                        type: p.type,
                        colDiv: p.colDiv,
                        getScale: function (sM, ig) {
                            sM = sM || 1;
                            return this.scale * (this.isItem || this.type == 2 || this.type == 3 || this.type == 4 ? 1 : sM * 0.6) * (ig ? 1 : this.colDiv);
                        }
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
                    if ((!replacer && yaboi)) {
                        if (yaboi.inTrap) {
                            if (UTILS.getAngleDist(near.aim2 + Math.PI, relAim + Math.PI) <= Math.PI*1.3) {
                                place(2, relAim, 1);
                            } else {
                                player.items[4] == 15 && place(4, relAim, 1);
                            }
                        } else {
                            if (UTILS.getAngleDist(near.aim2, relAim) <= config.gatherAngle / 2.6) {
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
                        getScale: function () {
                            return this.scale;
                        }
                    });
                    if (UTILS.getAngleDist(near.aim2, relAim) <= 1) {
                        counts.placed++;
                    }
                }
                if (counts.placed > 0 && replacer && item.dmg) {
                    if (near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8 && configs.spikeTick) {
                        instaC.canSpikeTick = true;
                    }
                }
            } catch (err) { }
        };
        this.checkSpikeTick = function () {
            try {
                if (![3, 4, 5].includes(near.primaryIndex)) return false;
                if ((getEl("safeAntiSpikeTick").checked || my.autoPush) ? false : near.primaryIndex == undefined ? true : (near.reloads[near.primaryIndex] > game.tickRate)) return false;
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
                        buyEquip(6, 0);
                        return true;
                    }
                }
            } catch (err) {
                return null;
            }
            return false;
        };
        this.protect = function(aim) {
            if (!configs.antiTrap) return;
            if(getDist(near, player) > getDist(near, traps.info)) {
                for(let i=-(Math.PI / 2);i<(Math.PI / 2);i+=(Math.PI / 18)) {
                    checkPlace(2, near.aim2 + i);
                }
            } else if(getDist(near, traps.info) > getDist(near, player)) {
                for(let i=-(Math.PI / 2);i<(Math.PI / 2);i+=(Math.PI / 18)) {
                    checkPlace(4, near.aim2 + i);
                }
            }
        };
        let placedSpikePositions = new Set();
        let placedTrapPositions = new Set();
        if (config.isSandbox) {
            this.autoPlace = function () { // by goated 3zs
                if (enemy.length && configs.autoPlace && !instaC.ticking) {
                    const tickInterval = Math.max(1, parseInt(getEl("autoPlaceTick").value)) || 1;
                    if (game.tick % tickInterval === 0) {
                        const nearbyTraps = gameObjects.filter(e => e.trap && e.active && e.isTeamObject(player));
                        const nearbyEnemies = enemy.filter(e => e.dist3 <= 450).sort((a, b) => a.dist3 - b.dist3);

                        if (nearbyEnemies.length) {
                            nearbyEnemies.forEach(target => {
                                const isInTrap = nearbyTraps.some(trap => UTILS.getDist(trap, target, 0, 2) <= (target.scale + trap.getScale() + 5));
                                const placementRadius = target.dist3 <= 200 ? Math.PI / 18 : Math.PI / 24;
                                const placementAngle = target.aim2;

                                if (target.dist3 <= 450) {
                                    if (target.dist3 <= 200) {
                                        this.Starplacer(4, 0, Math.PI * 2, placementRadius, placementAngle, 0, { inTrap: isInTrap });
                                    } else if (player.items[4] === 15) {
                                        this.Starplacer(4, 0, Math.PI * 2, placementRadius, placementAngle);
                                    }
                                }
                            });
                        }
                    }
                }
            };
            this.replacer = function(findObj) { // by goated 3zs
                if (!findObj || !configs.autoReplace || !inGame || this.antiTrapped) return;
                game.tickBase(() => {
                    const objAim = UTILS.getDirect(findObj, player, 0, 2);
                    const objDst = UTILS.getDist(findObj, player, 0, 2);
                    if (getEl("weaponGrind").checked && objDst <= items.weapons[player.weaponIndex].range + player.scale) return;
                    const nearbyEnemies = enemy.filter(e => e.dist2 <= 400).sort((a, b) => a.dist2 - b.dist2);
                    if (nearbyEnemies.length > 1) {
                        nearbyEnemies.forEach(enemy => {
                            const enemyAim = UTILS.getDirect(enemy, player, 0, 2);
                            const enemyDist = UTILS.getDist(enemy, player, 0, 2);
                            if (enemyDist <= 400) {
                                const danger = this.checkSpikeTick();
                                if (!danger && enemy.dist3 <= items.weapons[enemy.primaryIndex || 5].range + (enemy.scale * 1.8)) {
                                    this.Starplacer(2, 0, Math.PI * 2, Math.PI / 24, enemyAim, true);
                                } else {
                                    player.items[4] === 15 && this.Starplacer(4, 0, Math.PI * 2, Math.PI / 24, enemyAim, true);
                                }
                            }
                        });
                    } else if (objDst <= 400 && near.dist2 <= 400) {
                        const danger = this.checkSpikeTick();
                        if (!danger && near.dist3 <= items.weapons[near.primaryIndex || 5].range + (near.scale * 1.8)) {
                            this.Starplacer(2, 0, Math.PI * 2, Math.PI / 24, objAim, true);
                        } else {
                            player.items[4] === 15 && this.Starplacer(4, 0, Math.PI * 2, Math.PI / 24, objAim, true);
                        }
                    }

                    this.replaced = true;
                }, 1);
            };
        }
        if (config.isNormal) {
            function checkCanPlace(id, rad) {
                try {
                    let wall = id == 2 && !evil ? 1 : id;
                    if (wall == undefined) return false;
                    let item = items.list[player.items[wall]];
                    let tmpS = 35 + item.scale + (item.placeOffset || 0);
                    let tmpX = player.x2 + tmpS * Math.cos(rad);
                    let tmpY = player.y2 + tmpS * Math.sin(rad);
                    if (
                        objectManager.checkItemLocation(
                            tmpX,
                            tmpY,
                            item.scale,
                            0.6,
                            item.id,
                            false,
                            player
                        )
                    ) {
                        return true;
                    } else {
                        return false;
                    }
                } catch (e) { }
            }
            let perfSpikeAngle;
            function toRad(a) {
                return a * (Math.PI / 180);
            }
            let perfSpike;
            let placedOnPerfectAngle = false;
            this.autoPlace = function () {
                if (configs.autoPlace && near && near.dist2) {
                    if (near.inTrap) {
                        near.trapDist = UTILS.getDist(
                            near.inTrap,
                            near,
                            0,
                            2
                        );
                        near.trapAngle = UTILS.getDirect(
                            near,
                            near.inTrap,
                            2,
                            0
                        );
                        if (near.trapDist >= 13) {
                            let item = items.list[player.items[evil ? 2 : 1]];
                            let s = 35 + item.scale + (item.placeOffset ?? 0);
                            if (near.dist2 <= 70 + item.scale * 2) {
                                let angle = UTILS.getDirect(near, near.inTrap, 2, 0);
                                let perfectPlace = {
                                    x:
                                    near.inTrap.x +
                                    Math.cos(angle) *
                                    (near.inTrap.getScale(0.6, false) / 2 +
                                     items.list[player.items[2]].scale),
                                    y:
                                    near.inTrap.y +
                                    Math.sin(angle) *
                                    (near.inTrap.getScale(0.6, false) / 2 +
                                     items.list[player.items[2]].scale),
                                };
                                perfSpikeAngle = UTILS.getDirect(perfectPlace, player, 0, 0);
                                perfSpike = perfectPlace;
                                let item = items.list[player.items[2]];
                                let tmpS = 35 + item.scale + (item.placeOffset ?? 0);
                                let tmpX = player.x2 + tmpS * Math.cos(perfSpikeAngle);
                                let tmpY = player.y2 + tmpS * Math.sin(perfSpikeAngle);
                                if (
                                    checkCanPlace(evil ? 2 : 1, perfSpikeAngle) &&
                                    UTILS.getDistance(tmpX, tmpY, near.x2, near.y2) <
                                    item.scale + near.scale &&
                                    !placedOnPerfectAngle
                                ) {
                                    checkPlace(evil ? 2 : 1, perfSpikeAngle);
                                    placedOnPerfectAngle = true;
                                }
                                for (
                                    let ayochilltfoutyo = -45;
                                    ayochilltfoutyo < 45;
                                    ayochilltfoutyo += Math.abs(ayochilltfoutyo) >= 35 ? 1 : 0.5
                                ) {
                                    let randomAngle = perfSpikeAngle + UTILS.toRad(ayochilltfoutyo);
                                    if (
                                        checkCanPlace(evil ? 2 : 1, randomAngle) &&
                                        UTILS.getDistance(
                                            player.x2 + tmpS * Math.cos(randomAngle),
                                            player.y2 + tmpS * Math.sin(randomAngle),
                                            near.x2,
                                            near.y2
                                        ) <
                                        item.scale + near.scale
                                    ) {
                                        checkPlace(evil ? 2 : 1, randomAngle);
                                        break;
                                    }
                                }
                            } else {
                                placedOnPerfectAngle = false;
                                perfSpikeAngle = undefined;
                            }
                        } else {
                            placedOnPerfectAngle = false;
                            perfSpikeAngle = undefined;
                        }
                        if (!placedOnPerfectAngle) {
                            if (near.dist2 <= 270) {
                                checkPlace(
                                    evil ? 2 : 1,
                                    UTILS.getDirect(near.inTrap, player, 0, 2) + Math.PI
                                );
                                if (
                                    !checkCanPlace(
                                        evil ? 2 : 1,
                                        UTILS.getDirect(near.inTrap, player, 0, 2) + Math.PI
                                    )
                                ) {
                                    checkPlace(
                                        evil ? 2 : 1,
                                        UTILS.getDirect(near.inTrap, player, 0, 2) +
                                        Math.PI -
                                        ((Math.random() * Math.PI) / 8 + Math.PI / 8)
                                    );
                                    checkPlace(
                                        evil ? 2 : 1,
                                        UTILS.getDirect(near.inTrap, player, 0, 2) +
                                        Math.PI +
                                        ((Math.random() * Math.PI) / 8 + Math.PI / 8)
                                    );
                                }
                            }
                        }
                    } else {
                        perfSpikeAngle = undefined;
                        if (near.dist2 <= ((player.items[4] && player.items[4] == 16) ? 120 : 90) || near.dist3 <= ((player.items[4] && player.items[4] == 16) ? 110 : 85)) {
                            checkPlace(2, near.aim2 + Math.PI + Math.random * 0.2);
                            checkPlace(2, near.aim2 + Math.PI + Math.PI / 1.5 + Math.random * 0.2);
                            checkPlace(2, near.aim2 + Math.PI - Math.PI / 1.5);
                        } else if (near.dist2 <= 150 || near.dist3 <= 130) {
                            checkPlace(
                                evil ? 2 : 1,
                                near.aim2 + Math.PI / 1.5 + Math.random() - 0.5
                            );
                            checkPlace(
                                evil ? 2 : 1,
                                near.aim2 - Math.PI / 1.5 + Math.random() - 0.5
                            );
                        } else if (
                            near.dist2 <= 190 &&
                            player.items[4] &&
                            player.items[4] == 15
                        ) {
                            checkPlace(4, near.aim2 + Math.random() - 0.5);
                            checkPlace(
                                4,
                                near.aim2 + Math.PI / 1.5 + Math.random() - 0.5
                            );
                            checkPlace(
                                4,
                                near.aim2 - Math.PI / 1.5 + Math.random() - 0.5
                            );
                        } else if (
                            near.dist2 <= 250 &&
                            player.items[4] &&
                            player.items[4] == 15
                        ) {
                            checkPlace(4, near.aim2);
                        }
                    }
                } else if (config.isNormal) {
                    if (
                        (config.isNormal ? near : near) &&
                        player.items[4] == 15
                    ) {
                        let tmpPlayer = config.isNormal ? near : near;
                        let item = items.list[15];
                        let tmp = { x: undefined, y: undefined };
                        tmp.x = player.x2 + 40 * Math.cos(tmpPlayer.aim2);
                        tmp.y = player.y2 + 40 * Math.sin(tmpPlayer.aim2);
                        let trapScale = 10;
                        if (UTILS.getDist(tmp, tmpPlayer, 0, 2) <= 75) {
                            if (checkCanPlace(4, tmpPlayer.aim2)) {
                                checkPlace(4, tmpPlayer.aim2);
                            } else {
                                for (
                                    let ayochilltfoutyo = -30;
                                    ayochilltfoutyo < 30;
                                    ayochilltfoutyo += 2
                                ) {
                                    let randomAngle = perfSpikeAngle + UTILS.toRad(ayochilltfoutyo);
                                    if (
                                        checkCanPlace(4, randomAngle) &&
                                        Math.hypot(
                                            tmpPlayer.x - (player.x2 + 40 * Math.cos(randomAngle)),
                                            tmpPlayer.y - (player.y2 + 40 * Math.sin(randomAngle))
                                        ) <
                                        item.scale + 35
                                    ) {
                                        checkPlace(4, randomAngle);
                                        break;
                                    }
                                }
                            }
                        }
                    } else if (near.dist2 && near.dist2 <= 90) {
                        if (
                            checkCanPlace(2, near.aim2 + Math.PI) &&
                            checkCanPlace(2, near.aim2 + Math.PI + Math.PI / 1.5) &&
                            checkCanPlace(2, near.aim2 + Math.PI + Math.PI / 1.5)
                        ) {
                            checkPlace(2, near.aim2 + Math.PI);
                            checkPlace(2, near.aim2 + Math.PI + Math.PI / 1.5);
                            checkPlace(2, near.aim2 + Math.PI - Math.PI / 1.5);
                        } else {
                            checkPlace(2, near.aim2);
                            checkPlace(2, near.aim2 + Math.PI / 1.5);
                            checkPlace(2, near.aim2 - Math.PI / 1.5);
                        }
                    }
                };

                function calculatePerfectAngle(x1, y1, x2, y2) {
                    return Math.atan2(y2 - y1, x2 - x1);
                }
                this.replacer = function (findobj) {
                    if (!findobj || !configs.autoReplace) {
                        return;
                    }
                    if (!inGame) {
                        return;
                    }
                    if (this.antiTrapped) {
                        return;
                    }
                    game.tickBase(() => {
                        let objAim = UTILS.getDirect(findobj, player, 0, 2);
                        let objDst = UTILS.getDist(findobj, player, 0, 2);
                        if (getEl("weaponGrind").checked && objDst <= items.weapons[player.weaponIndex].range + player.scale) {
                            return;
                        }
                        if (objDst <= 250 && near.dist2 <= 280) {
                            let danger = this.checkSpikeTick();
                            if (!danger && near.dist2 <= items.weapons[near.primaryIndex || 5].range + near.scale * 1.8) {
                                if ([6, 7, 8, 1, 2].includes(player.weaponIndex) /*for retrap*/ || retrappable) {
                                    Text("Retrap Requerment", "#5DE2E7", 1);
                                    for (let i = 0; i < 1; i++) {
                                        this.Starplacer(4, -Math.PI / 4, Math.PI / 4, Math.PI / 18, objAim, 1, i);
                                        this.Starplacer(4, 0, Math.PI * 4, Math.PI / 24, objAim, 1, i);
                                        Text("Retrap Succes", "#7DDA58", 1);
                                    }
                                }
                                for (let i = 0; i < 1; i++) {
                                    this.Starplacer(2, -Math.PI / 2, Math.PI / 2, Math.PI / 18, objAim, 1, i);
                                    this.Starplacer(2, 0, Math.PI * 2, Math.PI / 24, objAim, 1, i);
                                    Text("Spike Anlge", "#D20103", 1);
                                }
                            } else if (player.items[4] == 15 || my.autoPush) {
                                for (let i = 0; i < 1; i++) {
                                    this.Starplacer(4, 0, Math.PI * 2, Math.PI / 24, objAim, 1, i);
                                }
                            }
                            this.replaced = true;
                        }
                    }, 1);
                };
            }
        }
    }
}
/*             const turretSwitchDelay = 0;
            const maxSwitchesPerSecond = 10;
            let lastSwitchTime = 0;
            function onHit(player, weapon) {
                if (player.skinIndex === 53 && Date.now() - lastSwitchTime >= turretSwitchDelay) {
                    lastSwitchTime = Date.now();
                    buyEquip(near.reloads[player.weapons[1]] ? 6 : 22, 0);
                }
            } */
const BASE_TRAP_PLACEMENT_RADIUS = 70;
const LOW_HEALTH_THRESHOLD = 272.58;
const BASE_PLACE_DELAY = 1 / 20;
const SAFETY_BUFFER = 50;
const TARGET_PREDICTION_STEPS = 10000;
const OPTIMIZED_SCORE_WEIGHT = 3.0;
const ANGLE_INCREMENT = 5;
const ENVIRONMENTAL_IMPACT_RADIUS = 150;
const LINE_OF_SIGHT_BLOCKAGE_PENALTY = 5;
const TEAMMATE_PROXIMITY_PENALTY = 5;
const MAX_ENVIRONMENTAL_SCORE = 100;
const HEATMAP_DECAY_RATE = 0.005;
const ENVIRONMENTAL_ADAPTATION_MULTIPLIER = 2.0;
const MINIMUM_SPACING_BETWEEN_PLACEMENTS = 20;
const COMBO_TRAP_BONUS = 100;
const OPTIMAL_TRAP_INTERVAL = 30;
const AI_LEARNING_MULTIPLIER = 1.5;
const OPTIMAL_PLACEMENT_FACTOR = 1.5;

let lastPlacementTime = 0;
const TRAP_PLACEMENT_RADIUS = BASE_TRAP_PLACEMENT_RADIUS;

function preplaceeer() {
    const currentTime = Date.now();
    if (traps.inTrap || !configs.autoPrePlace || (currentTime - lastPlacementTime < BASE_PLACE_DELAY)) return;

    const weaponRange = items.weapons[player.primaryIndex].range + TRAP_PLACEMENT_RADIUS;
    const rangeSquared = weaponRange ** 2;
    const { x2: playerX, y2: playerY } = player;
    let targetObjects = [];
    for (const gameObject of gameObjects) {
        const { x2, y2, buildHealth, threatLevel, id } = gameObject;
        const distSquared = (x2 - playerX) ** 2 + (y2 - playerY) ** 2;
        if (id !== 2 && buildHealth <= LOW_HEALTH_THRESHOLD && distSquared <= rangeSquared) {
            targetObjects.push({ ...gameObject, threatLevel });
        }
    }

    if (targetObjects.length === 0) return;

    targetObjects.sort((a, b) => compareThreat(a, b, playerX, playerY));

    const bestPlacement = findBestTrapPlacement(targetObjects, playerX, playerY);

    if (bestPlacement) {
        cplace(4, bestPlacement.angle, bestPlacement.angle + Math.PI * 2, Math.PI / 36, bestPlacement.aim, TRAP_PLACEMENT_RADIUS);
        lastPlacementTime = currentTime;
    }
};
function findBestTrapPlacement(targetObjects, playerX, playerY) {
    let bestAngle = null;
    let bestScore = -Infinity;
    let bestPosition = null;

    const angleIncrement = ANGLE_INCREMENT;

    for (let angle = 0; angle < 360; angle += angleIncrement) {
        const rad = UTILS.deg2rad(angle);
        const trapX = playerX + Math.cos(rad) * TRAP_PLACEMENT_RADIUS;
        const trapY = playerY + Math.sin(rad) * TRAP_PLACEMENT_RADIUS;
        const score = evaluatePlacementScore(trapX, trapY, targetObjects);

        if (score > bestScore) {
            bestScore = score;
            bestAngle = rad;
            bestPosition = { x: trapX, y: trapY };
        }
    }

    return bestAngle !== null ? { angle: bestAngle, aim: UTILS.getDirect(bestPosition, player, 0, 2), position: bestPosition } : null;
}

function evaluatePlacementScore(trapX, trapY, targetObjects) {
    let score = 0;

    for (const target of targetObjects) {
        const predictedPosition = predictTargetPosition(target);
        const distanceToTarget = Math.sqrt((trapX - predictedPosition.x) ** 2 + (trapY - predictedPosition.y) ** 2);

        const riskAssessment = assessRisk(target, trapX, trapY);
        score += riskAssessment;

        score -= distanceToTarget;
    }

    const enemyCount = targetObjects.length;
    score += calculateCrowdBonus(enemyCount);

    if (isHighTrafficArea(trapX, trapY)) {
        score += 150;
    }

    if (isLineOfSightClear(trapX, trapY, targetObjects)) {
        score += 10;
    }

    return score;
}

function predictTargetPosition(targetObject) {
    const { xVel, yVel, x2, y2 } = targetObject;
    const timeToPredict = predictOptimalTime(targetObject, player);
    return {
        x: x2 + xVel * timeToPredict,
        y: y2 + yVel * timeToPredict
    };
}

function predictOptimalTime(targetObject, player) {
    const distance = Math.sqrt((targetObject.x2 - player.x2) ** 2 + (targetObject.y2 - player.y2) ** 2);
    const speed = Math.sqrt(targetObject.xVel ** 2 + targetObject.yVel ** 2);
    return distance / (speed + 1);
}

function assessRisk(target, trapX, trapY) {
    const distance = Math.sqrt((trapX - target.x2) ** 2 + (trapY - target.y2) ** 2);
    const riskFactor = target.threatLevel * Math.max(0, 1 - distance / TRAP_PLACEMENT_RADIUS);
    return riskFactor;
}

function isHighTrafficArea(x, y) {
    return Math.random() > 0.7;
}

function isLineOfSightClear(trapX, trapY, targetObjects) {
    for (const obj of obstacles) {
        if (isObstacleBlocking(trapX, trapY, obj)) {
            return false;
        }
    }
    return true;
}

function isObstacleBlocking(trapX, trapY, obstacle) {
    const { x2, y2, width, height } = obstacle;
    return (trapX > x2 && trapX < x2 + width && trapY > y2 && trapY < y2 + height);
}

let obstacles = [
    { x2: 100, y2: 100, width: 50, height: 50 },
    { x2: 200, y2: 150, width: 60, height: 60 }
];

function compareThreat(a, b, playerX, playerY) {
    const aRisk = assessRisk(a, playerX, playerY);
    const bRisk = assessRisk(b, playerX, playerY);
    return bRisk - aRisk;
}

function calculateCrowdBonus(count) {
    return count * 50;
}
class vPre {
    constructor() {
        this.numberValue = 0;
        this.speed = 0;
        this.delay = 0;
        this.ticks = 2;
        this.ping = window.pingTime;
        this.value = 5;
        this.spikeTickReSwitch = false;
        this.antiSpiketick = false;
        this.v049 = function (angles, value, index) {
            if (!gameObjects.length || !inGame || !enemy.length || !player || !configs.autoPrePlace || (Date.now() - lastPlacementTime < 1 / 20)) return;

            this.v079 = function (obj, user) {
                let e = user.weapons[1] === 10 && !player.reloads[user.weapons[1]] ? 1 : 0;
                let x = user.weapons[e];
                if (player.reloads[x]) return 0;
                let t = items.weapons[x];
                let j = UTILS.getDist(obj.x, obj.y, user.x2, user.y2) <= obj.scale + t.range;
                return user.visible && j ? t.dmg * (t.sDmg || 1) * 3.3 : 0;
            };
            let e = [];
            for (let i = 0; i < gameObjects.length; i++) {
                let obj = gameObjects[i];
                if (obj.active && obj.health > 0 && UTILS.getDist(obj, player, 0, 2) <= player.scale + obj.scale * 2) {
                    let dmg = this.v079(obj, player);
                    if (obj.health <= dmg) {
                        e.push(obj);
                    }
                }
            }

            e.sort((a, b) => a.health - b.health);
            let v = e.slice(0, Math.min(2, e.length));

            if (v.length == 0) return;

            for (let g of v) {
                function findBestAngle(player, obj, options = {}) {
                    const {
                        angleStep = Math.PI / 36,
                        angleRange = Math.PI * 2,
                        scoreFn = (angle) => {
                            const testX = player.x2 + Math.cos(angle) * 50;
                            const testY = player.y2 + Math.sin(angle) * 50;
                            return Math.hypot(obj.x - testX, obj.y - testY);
                        }
                    } = options;

                    let bestAngle = null;
                    let bestScore = Infinity;

                    for (let a = 0; a < angleRange; a += angleStep) {
                        const angle = a;
                        const score = scoreFn(angle);
                        if (score < bestScore) {
                            bestScore = score;
                            bestAngle = angle;
                        }
                    }

                    return { bestAngle, bestScore };
                }
                let angles = findBestAngle(player, g).bestAngle;
                let j = gameObjects.filter(k => k.trap && k.active && k.isTeamObject(player) && UTILS.getDist(k, g, 0, 2) <= g.scale + k.getScale() + 15).sort((a, b) => {
                    return UTILS.getDist(a, g, 0, 2) - UTILS.getDist(b, g, 0, 2);
                })[0];
                if (near.dist2 < 300 && player.items[4] == 15) {
                    lastPlacementTime = Date.now();
                    //ANTI ANTI ANTI ANTIIIII:
                    let danger = traps.checkSpikeTick();
                    if (traps.inTrap && !danger && near.dist2 <= 180 && [4,5].includes(near.primaryIndex)) {
                        buyEquip(6, 0);
                    }
                    if ([4, 5].includes(player.weaponIndex) && near.dist2 <= players.weapons[player.primaryIndex || 5].range + (player.scale * 1.8)) {
                        cplace(2, angles, 1); // goygoy spikes
                    } else {
                        if (traps.inTrap && near.dist2 < 250 || my.autoPush) {
                            cplace(4, angles);
                        }
                        if (j || j == g) {
                            cplace(2, near.aim2);
                            packet("F", 1);
                        }
                    }
                }
            }
        };
        this.requestAnimFrame = function (callback) {
            window.setTimeout(() => callback, 1);
        };
        this.syncWithServerTicks = function (timearg) {
            let ey = performance.now();
            let e = performance.now();
            let yt = e - window.pingTime / 2;
            let i = Math.ceil(yt / ticks.tick) * 1000 / 9;
            ey = i > ey ? i : ey + 1000 / 9;
            let p = ey - window.pingTime / 2 - 1;
            let l = p + window.pingTime / 2;
            const io = (t) => {
                if (performance.now() >= t) {
                    this.v049(); // RUN UR vPre HERE
                    ey += 1000 / 9;
                    io(ey);
                } else {
                    requestAnimationFrame(() => io(ey));
                }
            };
            let y = l - e;
            if (y <= (1000 / 9)) {
                io(l);
            } else {
                setTimeout(() => io(l), y - 1);
            }
            let eyre = requestAnimationFrame(() => this.syncWithServerTicks());
            setTimeout(() => {
                cancelAnimationFrame(eyre);
            }, config.tickRate * timearg);
        };
    }
}
let prePlace = new vPre(); // use
function antiCounterSpiketick(angles) {//anti counterSpiketick
    if (!gameObjects.length || !inGame || !enemy.length || !player || !configs.autoPrePlace) return;

    let eeeee = function (obj, user) {
        let e = user.weapons[1] === 10 && !player.reloads[user.weapons[1]] ? 1 : 0;
        let x = user.weapons[e];
        if (player.reloads[x]) return 0;
        let t = items.weapons[x];
        let j = UTILS.getDist(obj.x, obj.y, user.x2, user.y2) <= obj.scale + t.range;
        return user.visible && j ? t.dmg * (t.sDmg || 1) * 3.3 : 0;
    };
    let e = [];
    for (let i = 0; i < gameObjects.length; i++) {
        let obj = gameObjects[i];
        if (obj.active && obj.health > 0 && UTILS.getDist(obj, player, 0, 2) <= player.scale + obj.scale * 2) {
            let dmg = eeeee(obj, player);
            if (obj.health <= dmg) {
                e.push(obj);
            }
        }
    }

    e.sort((a, b) => a.health - b.health);
    let v = e.slice(0, Math.min(2, e.length));

    if (v.length == 0) return;

    for (let g of v) {
        let j = gameObjects.filter(k => k.trap && k.active && k.isTeamObject(player) && UTILS.getDist(k, g, 0, 2) <= g.scale + k.getScale() + 15).sort((a, b) => {
            return UTILS.getDist(a, g, 0, 2) - UTILS.getDist(b, g, 0, 2);
        })[0];
        if (near.dist2 < 180) {
            if (j || j == g && (near.reloads[near.primaryIndex] == 0 && near.skinIndex == 7) && (near.primaryIndex == 5 || near.primaryIndex == 4)) {
                if ([4, 5].includes(player.weaponIndex)) {
                    instaC.canSpikeTick();
                }
                buyEquip(6, 0);
            }
            if (near.reloads[near.primaryIndex] == 0 && near.skinIndex == 7 && (near.primaryIndex == 5 || near.primaryIndex == 4)) {
                if ([4, 5].includes(player.weaponIndex)) {
                    instaC.canSpikeTick();
                }
                buyEquip(6, 0);
            }
        }
    }
}
class Instakill {
    constructor() {
        if (secPacket > 60) {
            return;
        }
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
                    if (near.skinIndex == 22 && getEl("backupNobull").checked) {
                        near.backupNobull = true;
                    }
                    instaLog.push(player.skinIndex);
                }, 1);
            }, 1);
            if (type == "rev") {
                notif("rev");
                selectWeapon(player.weapons[1]);
                buyEquip(53, 0);
                buyEquip(21, 1);
                sendAutoGather();
                game.tickBase(() => {
                    if (near.dist2 <= 140 && configs.doSpikeOnReverse) {
                        place(2, getAttackDir());
                    }
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 1);
            } else if (type == "nobull") {
                notif("noBull Insta");
                selectWeapon(player.weapons[0]);
                buyEquip(7, 0);
                sendAutoGather();
                game.tickBase(() => {
                    selectWeapon(player.weapons[1]);
                    buyEquip(player.reloads[53] == 0 ? 53 : 6, 0);
                    buyEquip(21, 1);
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 1);
            } else if (type == "normal") {
                notif("insta");
                selectWeapon(player.weapons[0]);
                buyEquip(7, 0);
                buyEquip(13, 1);
                sendAutoGather();
                setTimeout(() => {
                    buyEquip(player.reloads[53] == 0 ? 53 : 6, 0);
                    selectWeapon(player.weapons[1]);
                    buyEquip(53, 0)
                    buyEquip(21, 1);
                    setTimeout(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 255);
                }, 100);
            } else {
                setTimeout(() => {
                    this.isTrue = false;
                    my.autoAim = false;
                }, 50);
            }
        };
        this.spikeTickType = function () {
            notif("spikeTick");
            this.isTrue = true;
            my.autoAim = true;
            selectWeapon(player.weapons[0]);
            packet("D", getAttackDir());
            buyEquip(antiCounterSpiketick(Text("anti Counter Spiketick", "#E4080A", 1)) ? 6 : 7, 0);
            sendAutoGather();
            game.tickBase(() => {
                selectWeapon(player.weapons[1]);
                buyEquip(53, 0);
                game.tickBase(() => {
                    sendAutoGather();
                    this.isTrue = false;
                    my.autoAim = false;
                }, 1);
            }, 1);
        };
        this.rangeType = function (type) {
            this.isTrue = true;
            my.autoAim = true;
            if (type == "ageInsta") {
                my.ageInsta = false;
                if (player.items[5] == 18) {
                    place(5, near.aim2);
                }
                packet("9", undefined, 1);
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
        this.OneTickType = function () {
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
                buyEquip(19, 1);
                if ([9, 12, 13, 15].includes(player.weapons[1])) {
                    sendAutoGather();
                }
                packet("9", near.aim2, 1);
                game.tickBase(() => {
                    my.revAim = false;
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    buyEquip(19, 1);
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
        this.kmTickType = function () {
            notif("kmTickType");
            this.isTrue = true;
            my.autoAim = true;
            my.revAim = true;
            selectWeapon(player.weapons[1]);
            buyEquip(53, 0);
            buyEquip(19, 1);
            sendAutoGather();
            packet("9", near.aim2, 1);
            game.tickBase(() => {
                my.revAim = false;
                selectWeapon(player.weapons[0]);
                buyEquip(7, 0);
                buyEquip(19, 1);
                packet("9", near.aim2, 1);
                game.tickBase(() => {
                    sendAutoGather();
                    this.isTrue = false;
                    my.autoAim = false;
                    packet("9", undefined, 1);
                    this.readyTick = false;
                }, 3);
            }, 1);
        };
        /* end shit */
        this.VelocityTickorBow = function () { // Stary Code
            this.isTrue = true;
            my.autoAim = true;
            biomeGear();
            buyEquip(19, 1);
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
                game.tickBase(() => {
                    my.revAim = false;
                    selectWeapon(player.weapons[0]);
                    packet("F", 1);
                    buyEquip(7, 0);
                    buyEquip(18, 1);
                    if (![9, 12, 13, 15].includes(player.weapons[1])) {
                        sendAutoGather();
                    }
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        packet("F", null, 0);
                        my.autoAim = false;
                    }, 2);
                }, 1);
            }, 1);
        };
        this.boostTickType = function () {
            this.isTrue = true;
            my.autoAim = true;
            buyEquip(40, 0);
            buyEquip(0, 1);
            packet("9", near.aim2, 1);
            game.tickBase(() => {
                if (player.weapons[1] == 15) {
                    my.revAim = true;
                }
                selectWeapon(player.weapons[[9, 12, 13, 15].includes(player.weapons[1]) ? 1 : 0]);
                buyEquip(53, 0);
                buyEquip(19, 1);
                if ([9, 12, 13, 15].includes(player.weapons[1])) {
                    sendAutoGather();
                }
                packet("9", near.aim2, 1);
                place(4, near.aim2);
                game.tickBase(() => {
                    my.revAim = false;
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    if (![9, 12, 13, 15].includes(player.weapons[1])) {
                        sendAutoGather();
                    }
                    packet("9", near.aim2, 1);
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                        packet("9", undefined, 1);
                    }, 1);
                }, 1);
            }, 1);
        };
        this.gotoGoal = function (goto, OT) {
            let slowDists = weeeee => weeeee * config.playerScale;
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
            let bQ = function (wwww, awwww) {
                if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2 && awwww == 0) {
                    buyEquip(31, 0);
                } else {
                    buyEquip(wwww, awwww);
                }
            };
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
                                    if (configs.slowOT) {
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
                                    if (configs.slowOT) {
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
        this.bowMovement = function () {
            let moveMent = this.gotoGoal(683, 3);
            if (moveMent.action) {
                if (player.reloads[53] == 0 && !this.isTrue && this.readyTick) {
                    this.rangeType("ageInsta");
                } else {
                    packet("9", moveMent.dir, 1);
                }
            } else {
                packet("9", moveMent.dir, 1);
            }
        };
        this.tickMovement = function () {
            let dist = player.weapons[1] == 9 ? 245 : 245;
            let actionDist = player.weapons[1] == 9 ? 2 : player.weapons[1] == 12 ? 1.5 : player.weapons[1] == 13 ? 1 : player.weapons[1] == 15 ? 2 : 3;
            let moveMent = this.gotoGoal(245, 3);
            if (moveMent.action) {
                if (player.reloads[53] == 0 && !this.isTrue) {
                    this.OneTickType();
                } else {
                    packet("9", moveMent.dir, 1);
                }
            } else {
                packet("9", moveMent.dir, 1);
            }
        }
        this.VelocityOneTick = function () {
            let dist = player.weapons[1] == 9 ? 240 : 240;
            let actionDist = player.weapons[1] == 9 ? 2 : player.weapons[1] == 12 ? 1.5 : player.weapons[1] == 13 ? 1 : player.weapons[1] == 15 ? 2 : 3;
            if (player.reloads[53] == 0 && !this.isTrue) {
                this.VelocityTickorBow();
            }
            let trapped = false;
            let trapsInRange = gameObjects.filter(trap => {
                if (trap.trap && trap.active && trap.isTeamObject(player)) {
                    return UTILS.getDist(trap, near, 0, 2) <= (near.scale + trap.getScale() + 15);
                }
                return false;
            });
            if (trapsInRange.length > 0) {
                trapped = true;
            }
            if (!trapped && player.reloads[player.weapons[0]] == 0 && player.reloads[53] == 0 && player.weapons[0] == 5 && near.dist2 > 0 && near.dist2 <= 245 && near.skinIndex != 6) {
                instaC.VelocityTickorBow();
            }
        }
        this.kmTickMovement = function () {
            let moveMent = this.gotoGoal(240, 3);
            if (moveMent.action) {
                if (near.skinIndex != 22 && player.reloads[53] == 0 && !this.isTrue && ((game.tick - near.poisonTick) % config.serverUpdateRate == 8)) {
                    this.kmTickType();
                } else {
                    packet("9", moveMent.dir, 1);
                }
            } else {
                packet("9", moveMent.dir, 1);
            }
        }
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
        this.perfCheck = function (pl, nr) {
            if (nr.weaponIndex == 11 && UTILS.getAngleDist(nr.aim2 + Math.PI, nr.d2) <= config.shieldAngle) {
                return false;
            }
            if (![9, 12, 13, 15].includes(player.weapons[1])) {
                return true;
            }
            let pjs = {
                x: nr.x2 + Math.cos(nr.aim2 + Math.PI) * 70,
                y: nr.y2 + Math.sin(nr.aim2 + Math.PI) * 70
            };
            if (UTILS.lineInRect(pl.x2 - pl.scale, pl.y2 - pl.scale, pl.x2 + pl.scale, pl.y2 + pl.scale, pjs.x, pjs.y, pjs.x, pjs.y)) {
                return true;
            }
            let finds = ais.filter(tmp => tmp.visible).find(tmp => {
                if (UTILS.lineInRect(tmp.x2 - tmp.scale, tmp.y2 - tmp.scale, tmp.x2 + tmp.scale, tmp.y2 + tmp.scale, pjs.x, pjs.y, pjs.x, pjs.y)) {
                    return true;
                }
            });
            if (finds) {
                return false;
            }
            finds = gameObjects.filter(tmp => tmp.active).find(tmp => {
                let tmpScale = tmp.getScale();
                if (!tmp.ignoreCollision && UTILS.lineInRect(tmp.x - tmpScale, tmp.y - tmpScale, tmp.x + tmpScale, tmp.y + tmpScale, pjs.x, pjs.y, pjs.x, pjs.y)) {
                    return true;
                }
            });
            if (finds) {
                return false;
            }
            return true;
        };
    }
}
;
class Autobuy {
    constructor(buyHat, buyAcc) {
        this.hat = function () {
            buyHat.forEach(id => {
                let find = findID(hats, id);
                if (find && !player.skins[id] && player.points >= find.price) {
                    packet("c", 1, id, 0);
                }
            });
        };
        this.acc = function () {
            buyAcc.forEach(id => {
                let find = findID(accessories, id);
                if (find && !player.tails[id] && player.points >= find.price) {
                    packet("c", 1, id, 1);
                }
            });
        };
        this.extraHat = function () {
            buyHat.forEach(id => {
                let find = findID(hats, id);
                if (find && !player.skins[id] && player.points >= find.price) {
                    packet("c", 1, id, 0);
                }
            });
        };
        this.extraAcc = function () {
            buyAcc.forEach(id => {
                let find = findID(accessories, id);
                if (find && !player.tails[id] && player.points >= find.price) {
                    packet("c", 1, id, 1);
                }
            });
        };
    }
}
;
class Autoupgrade {
    constructor() {
        this.sb = function () {
            sendUpgrade(3);
            sendUpgrade(17);
            sendUpgrade(31);
            sendUpgrade(23);
            sendUpgrade(9);
            sendUpgrade(38);
        };
        this.kh = function () {
            sendUpgrade(3);
            sendUpgrade(17);
            sendUpgrade(31);
            sendUpgrade(23);
            sendUpgrade(10);
            sendUpgrade(38);
            sendUpgrade(4);
            sendUpgrade(25);
        };
        this.pb = function () {
            sendUpgrade(5);
            sendUpgrade(17);
            sendUpgrade(32);
            sendUpgrade(23);
            sendUpgrade(9);
            sendUpgrade(38);
        };
        this.ph = function () {
            sendUpgrade(5);
            sendUpgrade(17);
            sendUpgrade(32);
            sendUpgrade(23);
            sendUpgrade(10);
            sendUpgrade(38);
            sendUpgrade(28);
            sendUpgrade(25);
        };
        this.db = function () {
            sendUpgrade(7);
            sendUpgrade(17);
            sendUpgrade(31);
            sendUpgrade(23);
            sendUpgrade(9);
            sendUpgrade(34);
        };
    }
}
;
class Damages {
    constructor(items) {
        this.calcDmg = function (dmg, val) {
            return dmg * val;
        };
        this.getAllDamage = function (dmg) {
            return [this.calcDmg(dmg, 0.75), dmg, this.calcDmg(dmg, 1.125), this.calcDmg(dmg, 1.5)];
        };
        this.weapons = [];
        for (let i = 0; i < items.weapons.length; i++) {
            let wp = items.weapons[i];
            let name = wp.name.split(" ").length <= 1 ? wp.name : wp.name.split(" ")[0] + "_" + wp.name.split(" ")[1];
            this.weapons.push(this.getAllDamage(i > 8 ? wp.Pdmg : wp.dmg));
            this[name] = this.weapons[i];
        }
    }
}
let tmpList = [];
let UTILS = new Utils();
function createStatsPanel() {
    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    panel.style.top = '55%';
    panel.style.right = '10px';
    panel.style.transform = 'translateY(-50%)';
    panel.style.background = 'rgba(20, 20, 30, 0.7)';
    panel.style.zIndex = '999999';
    panel.style.width = '150px';
    panel.style.padding = '5px';
    panel.style.borderLeft = '2px solid rgba(0, 180, 255, 0.5)';
    panel.style.borderRadius = '3px 0 0 3px';
    panel.style.fontFamily = 'Arial, sans-serif';
    panel.style.color = 'white';
    panel.style.fontSize = '12px';
    const title = document.createElement('div');
    title.textContent = 'Annihilator/devs/js.gg';
    title.style.padding = '3px 0';
    title.style.marginBottom = '5px';
    title.style.color = 'rgba(200, 220, 255, 0.9)';
    title.style.borderBottom = '1px solid rgba(0, 180, 255, 0.3)';
    title.style.fontSize = '11px';
    panel.appendChild(title);
    panel.innerHTML += `
        <div style="margin: 4px 0;">
            <span style="color: #0091ff;">PKT:</span>
            <span id="packetsStat" style="float: right;">0</span>
        </div>
        <div style="margin: 4px 0;">
            <span style="color: #ff5500;">PING:</span>
            <span id="pingStat" style="float: right;">0</span>
        </div>
        <div style="margin: 4px 0;">
            <span style="color: #00ff55;">FPS:</span>
            <span id="fpsStat" style="float: right;">0</span>
        </div>
    `;
    document.body.appendChild(panel);
    function updateStats() {
        if (typeof secPacket !== 'undefined') {
            document.getElementById('packetsStat').textContent = secPacket;
        }
        if (typeof window.pingTime !== 'undefined') {
            document.getElementById('pingStat').textContent = window.pingTime;
        }
        if (typeof UTILS !== 'undefined' && typeof fpsTimer !== 'undefined') {
            document.getElementById('fpsStat').textContent = UTILS.round(fpsTimer.ltime, 10);
        }
        setTimeout(updateStats, 500);
    }
    updateStats();
}
if (document.readyState === 'complete') {
    createStatsPanel();
} else {
    window.addEventListener('load', createStatsPanel);
}
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
let autoBuy = new Autobuy([31, 15, 12, 53], [19, 21]);
let eeeeeeeee = new Autobuy([6, 7, 40], [11]);
let autoUpgrade = new Autoupgrade();
let spikes = {
    aim: 0,
    inRange: false,
    info: {}
}
let lastDeath;
let minimapData;
let mapMarker = {};
let mapPings = [];
let tmpPing;
let antiinsta = true;
let antiinsta1 = false;
let pathFindTest = [];
let grid = [];
let pathFind = {
    active: false,
    grid: 40,
    scale: 1440,
    x: 14400,
    y: 14400,
    chaseNear: false,
    attempts: 0,
    paths: [],
    array: [],
    lastX: this.grid / 2,
    lastY: this.grid / 2,
    finded: false,
};
let pathop = {
    active: false,
    grid: 40,
    scale: 1440,
    x: 14400,
    y: 14400,
    chaseNear: false,
    attempts: 0,
    paths: [],
    array: [],
    lastX: this.grid / 2,
    lastY: this.grid / 2,
    finded: false,
};
// HEALING:
function soldierMult() {
    return player.latestSkin == 6 ? 0.75 : 1;
}

function healthBased() {
    if (player.health == 100) return 0;
    if (player.skinIndex != 45 && player.skinIndex != 56) {
        return Math.ceil((100 - player.health) / items.list[player.items[0]].healing);
    }
    return 0;
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
function predictHeal(howManyCookieToEat) {
    for (let i = 0; i < howManyCookieToEat; i++) {
        place(0, getAttackDir());
    }
}
let healed = false;
setInterval(() => {
    if (inGame) {
        if (player.health < 100 && !healed && !my.antiInsta) {
            if (ping <= 69) {
                if (Date.now() - player.lastHit >= 120) {
                    healed = true;
                    healer();
                }
            } else if (game.tick - player.hitTick > 1) {
                healed = true;
                healer();
            }
            if (healed) {
                return;
            }
            if (player.shameCount < 7) {
                if (!enemy.length) {
                    if (player.health <= 45) {
                        healed = true;
                        healer();
                    }
                } else if (player.inTrap && player.hitSpike) {
                    healed = true;
                    predictHeal(2);
                } else if (player.health <= 69 && player.health <= player.damageThreat) {
                    healed = true;
                    healer();
                }
            }
        }
    }
});
function updateHealth(e, t) {
    tmpObj = findPlayerBySID(e);
    if (tmpObj) {
        let s = t - tmpObj.health;
        pingTracker.add(tmpObj.id, s);
        if (s >= 0) {
            if (tmpObj.hitTime) {
                let n = Date.now() - tmpObj.hitTime;
                tmpObj.hitTime = 0;
                if (n <= 120) {
                    tmpObj.shameCount++;
                } else {
                    tmpObj.shameCount = Math.max(0, tmpObj.shameCount - 2);
                }
            }
        } else {
            tmpObj.hitTime = Date.now();
            if (s == -5) {
                tmpObj.bullTick = game.tick;
                if (tmpObj == player) {
                    needTick = 0;
                }
            }
            let nearSpike = gameObjects.find(obj => ((obj.type == 1 && obj.y >= 12000) || (obj.dmg && !obj.isTeamObject(tmpObj))) && UTILS.getDist(obj, tmpObj, 0, 2) < obj.getScale(0.6, obj.isItem) + tmpObj.scale);
            if (nearSpike && nearSpike.dmg * (tmpObj.skinIndex == 6 ? 0.75 : 1)) tmpObj.hitSpike = true;
            if (tmpObj == player) {
                my.antiInsta = true;
                damages.push(Math.abs(s));
            }
        }
        tmpObj.health = t;
    }
    healed = false;
}
let runAtNextTick = [];
function checkProjectileHolder(x, y, dir, range, speed, indx, layer, sid) {
    let weaponIndx = indx == 0 ? 9 : indx == 2 ? 12 : indx == 3 ? 13 : indx == 5 && 15;
    let projOffset = config.playerScale * 2;
    let projXY = {
        x: indx == 1 ? x : x - projOffset * Math.cos(dir),
        y: indx == 1 ? y : y - projOffset * Math.sin(dir)
    };
    let nearPlayer = players.filter(e => e.visible && UTILS.getDist(projXY, e, 0, 2) <= e.scale).sort(function (a, b) {
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
                if (player.weapons[1] == 11) {
                    selectWeapon(11, near.aim2);
                }
                place(3, tmpObj.aim2);
                buyEquip(6, 0);
                Text("Range Insta Detect", "#E4080A", 1);
                if (!my.antiSync) {
                    antiSyncHealing(4);
                    packet("9", tmpObj.aim2 + 3.141592653589793 / 2, 1);
                    game.tickBase(() => {
                        packet("9", undefined, 1);
                    }, 2);
                }
            } else if (projectileCount >= 2) {
                if (player.weapons[1] == 11) {
                    selectWeapon(11, near.aim2);
                }
                place(3, tmpObj.aim2);
                Text("Sync Detect", "#060270", 1);
                packet("9", tmpObj.aim2 + 3.141592653589793 / 2, 1);
                buyEquip(6, 0);
                antiSyncHealing(2);
                game.tickBase(() => {
                    packet("9", undefined, 1);
                }, 4);
                if (!my.antiSync) {
                    antiSyncHealing(4);
                }
            }
        }
    }
}
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
        if (isStoreItem) { } else if (isWeapon) {
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
window.addEventListener("resize", UTILS.checkTrusted(resize));
function resize() {
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;
    var scaleFillNative = Math.max(screenWidth / maxScreenWidth, screenHeight / maxScreenHeight) * pixelDensity;
    gameCanvas.width = screenWidth;
    gameCanvas.height = screenHeight;
    gameCanvas.style.width = screenWidth + "px";
    gameCanvas.style.height = screenHeight + "px";
    gameCanvas.style;
    mainContext.setTransform(scaleFillNative, 0, 0, scaleFillNative, (screenWidth * pixelDensity - maxScreenWidth * scaleFillNative) / 2, (screenHeight * pixelDensity - maxScreenHeight * scaleFillNative) / 2);
}
resize();
const mals = document.getElementById("touch-controls-fullscreen");
mals.style.display = "block";
mals.addEventListener("mousemove", gameInput, false);
function gameInput(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
}
let clicks = {
    left: false,
    middle: false,
    right: false
};
mals.addEventListener("mousedown", mouseDown, false);
function mouseDown(e) {
    if (attackState != 1) {
        attackState = 1;
        if (e.button == 0) {
            clicks.left = true;
        } else if (e.button == 1 || e.key === "b") {
            clicks.middle = true;
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
        } else if (e.button == 1 || e.key === "b") {
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
        wbe -= 0.05;
        maxScreenWidth = config.maxScreenWidth * wbe;
        maxScreenHeight = config.maxScreenHeight * wbe;
        resize();
    } else {
        wbe += 0.05;
        maxScreenWidth = config.maxScreenWidth * wbe;
        maxScreenHeight = config.maxScreenHeight * wbe;
        resize();
    }
}
var controllingTouch = {
    id: -1,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
};
var attackingTouch = {
    id: -1,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
};
function getMoveDir() {
    var dx = 0;
    var dy = 0;
    if (controllingTouch.id != -1) {
        dx += controllingTouch.currentX - controllingTouch.startX;
        dy += controllingTouch.currentY - controllingTouch.startY;
    } else {
        for (var key in moveKeys) {
            var tmpDir = moveKeys[key];
            dx += !!keys[key] * tmpDir[0];
            dy += !!keys[key] * tmpDir[1];
        }
    }
    return dx == 0 && dy == 0 ? undefined : UTILS.fixTo(Math.atan2(dy, dx), 2);
}
var usingTouch;
function getSafeDir() {
    if (!player) return 0;
    if (attackingTouch.id != -1) {
        lastDir = Math.atan2(attackingTouch.currentY - attackingTouch.startY, attackingTouch.currentX - attackingTouch.startX);
    } else if (!player.lockDir && !usingTouch) {
        lastDir = Math.atan2(mouseY - screenHeight / 2, mouseX - screenWidth / 2);
    }
    return UTILS.fixTo(lastDir || 0, 2);
}
let info = {};

let lessDir = undefined;
let spinDir = 0;
let tickDir = 0;
let spinner = false;
function getAttackDir(debug) {
    if (debug) {
        if (!player) {
            return "0";
        } else {
            if (my.autoAim || safeequip() && clicks.left && player.reloads[player.weapons[0]] == 0) {
                lastDir = getEl("weaponGrind").checked ? "getSafeDir()" : enemy.length ? my.revAim ? "(near.aim2 + Math.PI)" : "near.aim2" : "getSafeDir()";
            } else if (clicks.right && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) {
                lastDir = "getSafeDir()";
            } else if (traps.inTrap && player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] == 0) {
                lastDir = "traps.aim";
            } else if (spikes.inRange && configs.doAutoBreakSpike && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) {
                lastDir = spikes.aim;
            } else if (!player.lockDir) {
                lastDir = "getSafeDir()";
            }
            return lastDir;
        }
    } else {
        if (!player) {
            return 0;
        }
        if (my.autoAim || safeequip() && clicks.left && player.reloads[player.weapons[0]] == 0) {
            lastDir = getEl("weaponGrind").checked ? getSafeDir() : enemy.length ? my.revAim ? near.aim2 + Math.PI : near.aim2 : getSafeDir();
        } else if (clicks.right && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) {
            lastDir = getSafeDir();
        } else if (traps.inTrap && player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] == 0) {
            lastDir = traps.aim;
        } else if (spikes.inRange && configs.doAutoBreakSpike && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) {
            lastDir = spikes.aim;
        } else if (!player.lockDir) {
            if (configs.noDir) {
                return undefined;
            }
            lastDir = getSafeDir();
        }
        return lastDir || 0;
    }
}
function getVisualDir() {
    if (!player) {
        return 0;
    }
    if (my.autoAim || safeequip() && clicks.left && player.reloads[player.weapons[0]] == 0) {
        lastDir = getEl("weaponGrind").checked ? getSafeDir() : enemy.length ? my.revAim ? near.aim2 + Math.PI : near.aim2 : getSafeDir();
    } else if (clicks.right && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) {
        lastDir = getSafeDir();
    } else if (traps.inTrap && player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] == 0) {
        lastDir = traps.aim;
    } else if (!player.lockDir) {
        lastDir = getSafeDir();
    }
    return lastDir || 0;
}
function safeequip() {
    return near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap;
    buyEquip(21, 1);
}
function keysActive() {
    return allianceMenu.style.display != "block" && chatHolder.style.display != "block";
}
let pathfindlmfaoxdddddd = false;
function notif(title, description) {
    let mouseCoord = player;
    let m = textManager;
    if (typeof title !== "undefined") {
        m.showText(mouseCoord.x, mouseCoord.y, 40, .18, 500, title, "white");
    }
    if (typeof description !== "undefined") {
        m.showText(mouseCoord.x, mouseCoord.y + 40, 30, .18, 500, description, "white");
    }
}
function sendChat(message) {
    packet("6", message.slice(0, 30));
}
function keyDown(event) {
    let keyNum = event.which || event.keyCode || 0;
    if (player && player.alive && keysActive()) {
        if (!keys[keyNum]) {
            keys[keyNum] = 1;
            macro[event.key] = 1;
            if (keyNum == 27) {
                openMenu = !openMenu;
                $("#menuDiv").toggle();
            } else if (keyNum == 69) {
                sendAutoGather();
            } else if (keyNum == 67) {
                updateMapMarker();
            } else if (event.key == "j") {
                sendChat("!sync");
            } else if (event.key == "l") {
                botSync = !botSync;
                notif(`autoSync Multi: ${(botSync)}`);
            } else if (player.weapons[keyNum - 49] != undefined) {
                player.weaponCode = player.weapons[keyNum - 49];
            } else if (moveKeys[keyNum]) {
                sendMoveDir();
            } else if (keyNum == 82) {
                instaC.wait = !instaC.wait;
                for (let i = 0; i < players.length; i++) {
                    tmpObj = players[i];
                    if (tmpObj.visible) {
                        if (tmpObj.skinIndex == 6 || tmpObj.skinIndex == 22) {
                            tmpObj.anti = true;
                        } else {
                            tmpObj.anti = false;
                        }
                    }
                }
            } else if (event.key == "T") {
                autoVelocityTickToggled = !autoVelocityTickToggled;
                const oneFrameStatus = autoVelocityTickToggled ? "true" : "false";
                Text(`${oneFrameStatus}`, "#191010", 1);
            } else if (event.key == "m") {
                mills.placeSpawnPads = !mills.placeSpawnPads;
            } else if (event.key === "z") {
                mills.place = !mills.place;
            } else if (event.key == "b") {
                clicks.middle = true;
            } else if (event.key == "Z") {
                typeof window.debug == "function" && window.debug();
            } else if (keyNum == 32) {
                packet("F", 1, getSafeDir(), 1);
                packet("F", 0, getSafeDir(), 1);
            }
        }
    }
}
addEventListener("keydown", UTILS.checkTrusted(keyDown));
function kekekkee(tmp) {
    return (player.scale + tmp.getScale()) / (player.maxSpeed * items.weapons[player.weaponIndex].spdMult) + (tmp.dmg && !tmp.isTeamObject(player) ? 35 : 0);
    if (tmp.colDiv == 0.5) {
        return tmp.scale * tmp.colDiv;
    } else if (!tmp.isTeamObject(player) && tmp.dmg) {
        return tmp.scale + player.scale;
    } else if (tmp.isTeamObject(player) && tmp.trap) {
        return 0;
    } else {
        return tmp.scale;
    }
}
function checkObject(pos, one, two) {
    let checkColl = gameObjects.filter(tmp => player.canSee(tmp) && tmp.active);
    for (let y = 0; y < pathop.grid; y++) {
        grid[y] = [];
        for (let x = 0; x < pathop.grid; x++) {
            let tmpXY = {
                x: (player.x2 - (pathop.scale / 2)) + ((pathop.scale / pathop.grid) * x),
                y: (player.y2 - (pathop.scale / 2)) + ((pathop.scale / pathop.grid) * y)
            }
            if (UTILS.getDist(pos, tmpXY, one, two) <= 35) {
                pathop.lastX = x;
                pathop.lastY = y;
                grid[y][x] = 0;
                continue;
            }
            let find = checkColl.find(tmp => UTILS.getDist(tmp, tmpXY, 0, 0) <= kekekkee(tmp));
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
function eeeeee(pos, one, two) {
    grid = [];
    checkObject(pos, one, two);
}
let tracker = {
    draw3: {
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
function autoPlay(pos, one, two) {
    pathop.scale = (config.maxScreenWidth / 2) * 1.3;
    if (!traps.inTrap) {
        if (((CheckDist <= items.weapons[player.weapons[0]].range + near.scale * 1.8) || player.skinIndex == 45 || player.shameCount > 6)) {
            Move();
        } else {
            eeeeee(pos, one, two);
            easystar.setGrid(grid);
            easystar.setAcceptableTiles([0]);
            easystar.enableDiagonals();
            easystar.findPath((grid[0].length / 2), (grid.length / 2), pathop.lastX, pathop.lastY, function (path) {
                if (path === null) {
                    pathop.array = [];
                    Move();
                } else {
                    pathop.array = path;
                    if (pathop.array.length > 1) {
                        let tmpXY = {
                            x: (player.x2 - (pathop.scale / 2)) + ((pathop.scale / pathop.grid) * path[1].x),
                            y: (player.y2 - (pathop.scale / 2)) + ((pathop.scale / pathop.grid) * path[1].y)
                        }
                        io.send("9", UTILS.getDirect(tmpXY, player, 0, 2), 1);
                    }
                }
            });
            easystar.calculate();
        }
    }
}
function keyUp(event) {
    if (player && player.alive) {
        let keyNum = event.which || event.keyCode || 0;
        if (keyNum == 13) { } else if (keysActive()) {
            if (keys[keyNum]) {
                keys[keyNum] = 0;
                macro[event.key] = 0;
                if (moveKeys[keyNum]) {
                    sendMoveDir();
                } else if (event.key == ",") {
                    player.sync = false;
                } else if (event.key == "b") {
                    clicks.middle = false;
                } else if (event.key == "r") {
                    placerSpikeTick = !placerSpikeTick;
                }
            }
        }
    }
}
window.addEventListener("keyup", UTILS.checkTrusted(keyUp));
let lastMoveDirect = undefined;
let isMoveDir = undefined;

function sendMoveDir() {
    let newMoveDir = getMoveDir();
    if (lastMoveDir == undefined || newMoveDir == undefined || Math.abs(newMoveDir - lastMoveDir) > 0.3) {
        if (!my.autoPush) {
            packet("9", newMoveDir, 1);
        }
        lastMoveDir = newMoveDir;
        isMoveDir = newMoveDir;
    }
}
/** PATHFIND TEST */
function chechPathColl(tmp) {
    return ((player.scale + tmp.getScale()) / (player.maxSpeed * items.weapons[player.weaponIndex].spdMult)) + (tmp.dmg && !tmp.isTeamObject(player) ? 35 : 0);
    return tmp.colDiv == 0.5 ? (tmp.scale * tmp.colDiv) :
        !tmp.isTeamObject(player) && tmp.dmg ? (tmp.scale + player.scale) :
    tmp.isTeamObject(player) && tmp.trap ? 0 : tmp.scale;
}
function CanObject(pos, one, two) {
    let checkColl = gameObjects.filter(tmp => player.canSee(tmp) && tmp.active);
    for (let y = 0; y < pathFind.grid; y++) {
        grid[y] = [];
        for (let x = 0; x < pathFind.grid; x++) {
            let tmpXY = {
                x: (player.x2 - (pathFind.scale / 2)) + ((pathFind.scale / pathFind.grid) * x),
                y: (player.y2 - (pathFind.scale / 2)) + ((pathFind.scale / pathFind.grid) * y)
            }
            if (UTILS.getDist(pos, tmpXY, one, two) <= 35) {
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
// BUTTON EVENTS:
function bindEvents() { }
bindEvents();

function SendPath(pos, one, two) {
    grid = [];
    CanObject(pos, one, two);
}
let CheckAim = near.aim2,
    CheckDist = near.dist2;

function Move() {
    const trap1 = gameObjects
    .filter((e) => e.trap && e.active)
    .sort((a, b) => UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2))
    .find((trap) => {
        const trapDist = Math.sqrt((trap.y - near.y2) ** 2 + (trap.x - near.x2) ** 2);
        return (
            trap !== player &&
            (player.sid === trap.owner.sid || findAllianceBySid(trap.owner.sid)) &&
            trapDist <= 50
        );
    });
    if (near.dist2 > items.weapons[player.weapons[0]].range + near.scale * 1.8) {
        if (((player.shameCount > 5) || player.skinIndex == 45) && CheckDist < 400) {
            packet("9", CheckAim + Math.PI, 1);
        } else if (CheckDist <= items.weapons[player.weaponIndex].range + near.scale && trap1) {
            packet("9", undefined, 1);
        } else if (!trap1 && CheckDist < items.weapons[player.weaponIndex].range + near.scale * 1.8) {
            packet("9", CheckAim + Math.PI, 1);
        } else if (CheckDist >= items.weapons[player.weaponIndex].range + near.scale * 1.8) {
            packet("9", CheckAim, 1);
        } else {
            packet("9", undefined, 1);
        }
    }
}

function Pathfinder(pos, one, two) {
    pathFind.scale = (config.maxScreenWidth / 2) * 1.3;
    if (!traps.inTrap) {
        if (((CheckDist <= items.weapons[player.weapons[0]].range + near.scale * 1.8) || player.skinIndex == 45 || player.shameCount > 6)) {
            Move();
        } else {
            SendPath(pos, one, two);
            easystar.setGrid(grid);
            easystar.setAcceptableTiles([0]);
            easystar.enableDiagonals();
            easystar.findPath((grid[0].length / 2), (grid.length / 2), pathFind.lastX, pathFind.lastY, function (path) {
                if (path === null) {
                    pathFind.array = [];
                    Move();
                } else {
                    pathFind.array = path;
                    if (pathFind.array.length > 1) {
                        let tmpXY = {
                            x: (player.x2 - (pathFind.scale / 2)) + ((pathFind.scale / pathFind.grid) * path[1].x),
                            y: (player.y2 - (pathFind.scale / 2)) + ((pathFind.scale / pathFind.grid) * path[1].y)
                        }
                        io.send("9", UTILS.getDirect(tmpXY, player, 0, 2), 1);
                    }
                }
            });
            easystar.calculate();
        }
    }
}
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

/* // OLD AUTOPUSH by me (zylex, stary)
// AUTOPUSH:
function autoPush(g = player, h = UTILS, l = retrappable, y = near, u = RealPush) {
    let f = gameObjects.filter(e => e.trap && e.active && e.isTeamObject(g) && h.getDist(e, y, 0, 2) <= (y.scale + e.getScale() + 15)).sort((a, b) => h.getDist(a, y, 0, 2) - h.getDist(b, y, 0, 2))[0];
    if (!f) my.autoPush = false; return;
    let a = gameObjects.some(e => e.dmg && e.active && !e.isTeamObject(g) && h.getDist(e, f, 0, 0) <= (y.scale + e.scale + 40));
    if (a) buyEquip(6, 0);
    const e = gameObjects.filter(e => e.trap && e.active && e.isTeamObject(g) && h.getDist(e, y, 0, 2) <= y.scale + e.getScale() + 5).sort((a, b) => h.getDist(a, y, 0, 2) - h.getDist(b, y, 0, 2))[0], d = gameObjects.filter(e => e.dmg && e.active && e.isTeamObject(g) && h.getDist(e, f, 0, 0) <= (y.scale + e.scale + 40)).sort((a, b) => h.getDist(a, y, 0, 2) - h.getDist(b, y, 0, 2))[0];;
    if (e) {
        if (d) {
            RealPush = true;
            const sd = h.getDirect(y, d, 2, 0), ef = h.getDist(y, d, 2, 0);
            let b = {
                x: d.x + (250 * Math.cos(h.getDirect(y, d, 2, 0))), y: d.y + (250 * Math.sin(h.getDirect(y, d, 2, 0))), x2: d.x + ((h.getDist(y, d, 2, 0) + player.scale) * Math.cos(h.getDirect(y, d, 2, 0))), y2: d.y + ((h.getDist(y, d, 2, 0) + player.scale) * Math.sin(h.getDirect(y, d, 2, 0)))
            };
            const jk = { x2: d.x + ((ef + g.scale * 1.5) * Math.cos(sd)), y2: d.y + ((ef + g.scale * 1.5) * Math.sin(sd))};
            const hj = { x: jk.x2 + Math.cos(30), y: jk.y2 + Math.sin(30)};
            const sh = { x2: d.x + ((ef + g.scale * 1) * Math.cos(sd)), y2: d.y + ((ef + g.scale * 1) * Math.sin(sd))};
            const th = { x: sh.x2 + Math.cos(30), y: sh.y2 + Math.sin(30)};
            my.autoPush = true;
            if (h.getDist(y, d, 2, 0) <= 100 && y.health != 100 && y.dist2 <= 150) {
                my.pushLine = Infinity;
            } else {
                my.pushLine = { x: d.x + Math.cos(70), y: d.y + Math.sin(70), x2: hj.x2 + Math.cos(30), y2: hj.y2 + Math.sin(30)};
            }
            if (h.getDist(y, d, 2, 0) <= 100 && y.health != 100 && y.dist2 <= 150) {
                pathFind.active = false; packet("9", undefined, 1);
            } else {
                if (y.dist2 <= 100) {
                    pathFind.active = false; packet("9", h.getDirect(b, g, 2, 2), 1); l = true;
                } else {
                    pathFind.active = true; Pathfinder(th, 0, 0); l = true;
                }
            }
        } else {
            if (my.autoPush) {
                my.autoPush = false; packet("9", undefined, 1); l = false;
            } u = false;
        }
    } else {
        if (my.autoPush) {
            my.autoPush = false; packet("9", undefined, 1); l = false;
        } u = false;
    }
} */
// NEW
// AUTOPUSH:
function autoPush() {
    let OPPPPP = gameObjects
    .filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= (near.scale + tmp.getScale() + 15))
    .sort((a, b) => UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2))[0];
    if (!OPPPPP) {
        my.autoPush = false;
        return;
    }
    let kjekekeke = gameObjects.some(tmp => tmp.dmg && tmp.active && !tmp.isTeamObject(player) && UTILS.getDist(tmp, OPPPPP, 0, 0) <= (near.scale + tmp.scale + 40));
    if (kjekekeke) {
        buyEquip(6, 0);
    }
    const FindTrap = gameObjects
    .filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= near.scale + tmp.getScale() + 5)
    .sort((a, b) => UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2))[0];

    if (FindTrap) {
        const FindSpike = gameObjects.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, OPPPPP, 0, 0) <= (near.scale + tmp.scale + 40)).sort((a, b) => UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2))[0];

        if (FindSpike) {
            RealPush = true;
            const pushDistance = 250;
            const pushAngle = UTILS.getDirect(near, FindSpike, 2, 0);
            const pushDist = UTILS.getDist(near, FindSpike, 2, 0);

            let pos = {
                x: FindSpike.x + (250 * Math.cos(UTILS.getDirect(near, FindSpike, 2, 0))),
                y: FindSpike.y + (250 * Math.sin(UTILS.getDirect(near, FindSpike, 2, 0))),
                x2: FindSpike.x + ((UTILS.getDist(near, FindSpike, 2, 0) + player.scale) * Math.cos(UTILS.getDirect(near, FindSpike, 2, 0))),
                y2: FindSpike.y + ((UTILS.getDist(near, FindSpike, 2, 0) + player.scale) * Math.sin(UTILS.getDirect(near, FindSpike, 2, 0)))
            };
            const pos3 = {
                x2: FindSpike.x + ((pushDist + player.scale * 1.5) * Math.cos(pushAngle)),
                y2: FindSpike.y + ((pushDist + player.scale * 1.5) * Math.sin(pushAngle))
            };
            const pos2 = {
                x: pos3.x2 + Math.cos(30),
                y: pos3.y2 + Math.sin(30)
            };
            const pos4 = {
                x2: FindSpike.x + ((pushDist + player.scale * 1) * Math.cos(pushAngle)),
                y2: FindSpike.y + ((pushDist + player.scale * 1) * Math.sin(pushAngle))
            };
            const pos5 = {
                x: pos4.x2 + Math.cos(30),
                y: pos4.y2 + Math.sin(30)
            };
            my.autoPush = true;
            if (UTILS.getDist(near, FindSpike, 2, 0) <= 100 && near.health != 100 && near.dist2 <= 150) {
                my.pushLine = Infinity;
            } else {
                my.pushLine = {
                    x: FindSpike.x + Math.cos(70),
                    y: FindSpike.y + Math.sin(70),
                    x2: pos3.x2 + Math.cos(30),
                    y2: pos3.y2 + Math.sin(30)
                };
            }
            if (UTILS.getDist(near, FindSpike, 2, 0) <= 100 && near.health != 100 && near.dist2 <= 150) {
                pathFind.active = false;
                packet("9", undefined, 1);
            } else {
                if (near.dist2 <= 100) {
                    pathFind.active = false;
                    packet("9", UTILS.getDirect(pos, player, 2, 2), 1);
                    retrappable = true;
                } else {
                    pathFind.active = true;
                    Pathfinder(pos5, 0, 0);
                    retrappable = true;
                }
            }
        } else {
            if (my.autoPush) {
                my.autoPush = false;
                packet("9", undefined, 1);
                retrappable = false;
            }
            RealPush = false;
        }
    } else {
        if (my.autoPush) {
            my.autoPush = false;
            packet("9", undefined, 1);
            retrappable = false;
        }
        RealPush = false;
    }
}
// MOVEMENT:
function move(e) {
    packet("9", e, 1);
}

function setMoveDir(e) {
    move(e);

    game.tickBase(() => {
        move(lastMoveDir);
    }, 1);
}

// none movement
// DDODGE OBJECTS:
const dodgeSpike = (j = player, u = tracker, U = UTILS) => {
    if (traps.inTrap) return;

    let hd = gameObjects.find(e => e.dmg && e.active && !e.isTeamObject(j) && U.getDist(e, j, 0, 3) <= (j.scale * 2 + e.getScale()));

    if (!hd) {
        if (u.draw3.active) u.draw3.active = false;
        return;
    }
    u.draw3 = {
        active: true,
        x: hd.x,
        y: hd.y,
        scale: hd.getScale() || hd.scale,
    };
    let w = UTILS.getDirect(hd, j, 0, 2);
    let a = getMoveDir();
    if (Math.abs(w - a) < Math.PI / 2) {
        setMoveDir(null);
    }
};
// movement dancing
/*// DDODGE OBJECTS:
            const dodgeSpike = () => {
                if (traps.inTrap) return;

                let aspike = gameObjects.find(obj => obj.dmg && obj.active && !obj.isTeamObject(player) && UTILS.getDist(obj, player, 0, 3) <= (player.scale * 2 + obj.getScale()));

                if (!aspike) {
                    if (tracker.draw3.active) tracker.draw3.active = false;
                    return;
                }

                tracker.draw3 = {
                    active: true,
                    x: aspike.x,
                    y: aspike.y,
                    scale: aspike.getScale() || aspike.scale,
                };

                let spikeDir = UTILS.getDirect(aspike, player, 0, 2);

                setMoveDir(spikeDir + Math.PI);
            };*/
// UPDATE PLAYER ITEM VALUES:

function updateItemCountHTML(index = undefined) {
    for (let i = 0; i < items.list.length; ++i) {
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
            if (i < 3) {
                isItemSetted[tmpI].innerHTML = Math.floor(player.food / items.list[i].req[1]);
            } else {
                isItemSetted[tmpI].innerHTML = player.itemCounts[id] || 0;
            }
        } else {
            if (index == id) {
                isItemSetted[tmpI].innerHTML = player.itemCounts[index] || 0;
            }
            if (index == undefined) {
                if (i < 3) {
                    isItemSetted[tmpI].innerHTML = Math.floor(player.food / items.list[i].req[1]);
                }
            }
        }
        if (visualsForNow) {
            if (isItemSetted[tmpI].style.display == "block") {
                isItemSetted[tmpI].style.display = "none";
            }
        } else {
            if (isItemSetted[tmpI].style.display == "none") {
                isItemSetted[tmpI].style.display = "block";
            }
        }
    }
}

function updateItemCounts(index, value) {
    if (player) {
        player.itemCounts[index] = value;
        updateItemCountHTML(index);
    }
}
function addDeadPlayer(tmpObj) {
    deadPlayers.push(new DeadPlayer(tmpObj.x, tmpObj.y, tmpObj.dir, tmpObj.buildIndex, tmpObj.weaponIndex, tmpObj.weaponVariant, tmpObj.skinColor, tmpObj.scale, tmpObj.name));
}
function setInitData(data) {
    alliances = data.teams;
}
var goygoygoy = false;
function setupGame(yourSID) {
    keys = {};
    macro = {};
    playerSID = yourSID;
    attackState = 0;
    inGame = true;
    goygoygoy = true;
    packet("F", 0, getAttackDir(), 1);
    my.ageInsta = true;
    if (firstSetup) {
        firstSetup = false;
        gameObjects.length = 0;
    }
}
function addPlayer(data, isYou) {
    let tmpPlayer = findPlayerByID(data[0]);
    if (!tmpPlayer) {
        tmpPlayer = new Player(data[0], data[1], config, UTILS, projectileManager, objectManager, players, ais, items, hats, accessories);
        players.push(tmpPlayer);
        if (data[1] != playerSID) { }
    } else if (data[1] != playerSID) { }
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
        updateItemCountHTML();
        if (player.skins[7]) {
            my.reSync = true;
        }
    }
}
function removePlayer(id) {
    for (let i = 0; i < players.length; i++) {
        if (players[i].id == id) {
            let eeeeee = players[i];
            players.splice(i, 1);
            break;
        }
    }
}
let DAMAGE;
let reSync = false;
let healingDelay = 0;
function sendHit(e, t) {
    io.send("F", e, t);
}
function hea222l(e) {
    let t = player.items[0];
    let i = Math.abs(e) / (t == 0 ? 20 : t == 1 ? 40 : 30);
    for (let s = 0; s < i; s++) {
        selectToBuild(t);
        sendHit(1, getAttackDir());
        selectToBuild(player.weaponCode, true);
    }
}
let damages = [];
function autoHealing() {
    if (healingDelay > 0) {
        healingDelay--;
        if (healingDelay <= 0) {
            healingDelay = 0;
            hea222l(100 - player.health);
        }
    }
    damages = [];
}
function isMine(e) {
    return e == player.sid;
}
function nextTick(e) {
    if (typeof e == "function") {
        game.doNextTick.push(e);
    }
}
function start0ShameHeal(e, t) {
    if (e == 2) {
        if (gameObjects.find(e => e.active && e.dmg && !isFriendly(e.owner.sid) && UTILS.getDistance(e, player) <= e.scale + 60)) {
            nextTick(() => {
                hea222l(t);
            });
        } else {
            healingDelay = 2;
        }
    } else {
        nextTick(() => {
            hea222l(t);
        });
    }
}
let velSoldier = false;
let spikeSoldier = false;
let forcedAddOns = [0, 0, 0, 0];
function checkOnlySoldier() {
    return [0, 2, 3].some(e => forcedAddOns[e] > 0) || velSoldier || spikeSoldier;
}
let projectileDamage = 0;
function equipBestBreakWeapon(e, t, i) {
    let s = player.weapons[1] == 10 ? 10 : player.weapons[0];
    if (e == "autobreak" && s == 10 && player.weapons[0] != 5 && reloadPercent(player, player.weapons[0]) == 1 && (i || player.trapData).currentHealth - calculateWeaponDamage(player.weapons[0], player.primaryVariant) <= 0) {
        s = player.weapons[0];
    }
    if (player.weaponIndex != s && !t) {
        selectToBuild(s, true);
    }
    return s;
}
function validateAnti(e, t, i) {
    if (e == "emp") {
        if (!player.skins[22] || player.skinIndex != 6 || player.health - (t - 25) <= 0 || checkOnlySoldier()) {
            return false;
        }
    } else {
        if (player.health - t <= 0 || !player.skins[6]) {
            return false;
        }
        if (player.trapData && i) {
            let s = equipBestBreakWeapon("autobreak", true);
            let n = reloadPercent(player, s);
            if (s == 10 && n == 1) {
                return false;
            }
        }
    }
    return true;
}
function updateProjectileDamage() {
    projectileDamage = projectiles.reduce((e, t) => e + t, 0);
}
let bowHealer = null;
function isSpikeTickAThreat() {
    let e = enemy;
    let t = enemy.length;
    for (let i = 0; i < t; i++) {
        let s = e[i];
        if (s) {
            let n = s.primaryWeapon;
            let a = s.primaryVariant;
            let l = reloadPercent(s, n);
            let o = calculateWeaponDamage(n, a) * 1.5;
            let r = items.list[s.spikeData?.id || 9];
            if (l == 1 && o + r.dmg >= 100 && UTILS.getDistance(s, player) <= 100 + r.scale * 2) {
                return true;
            }
        }
    }
    return false;
}
function doAntiSpiketick(e) {
    if (isSpikeTickAThreat() && player.trapData && player.trapData.sid == e.sid) {
        textManager.showText(player, 250, 35, 0, "#f00", "antispiektick");
        addForcedAddOnValue(2, 3);
    }
}
function addProjectile1(e, t, i) {
    if (!isFriendly(e.sid) && UTILS.getDistance(e, player) >= 300) {
        projectiles.push(t);
        if ((projectileDamage = projectiles.reduce((e, t) => e + t, 0)) >= 200 && healingPotential != "IntBow") {
            let s = 0;
            hea222l(80);
            healingPotential = "IntBow";
            bowHealer = setInterval(() => {
                s++;
                healingPotential = "IntBow";
                if (s > 4) {
                    clearInterval(bowHealer);
                }
                hea222l(80);
            }, 75);
        }
        setTimeout(() => {
            projectiles.shift();
        }, i);
    }
}
function calculatePosition(e, t, i) {
    return {
        x: (e.x2 || e.x) + Math.cos(i) * t,
        y: (e.y2 || e.y) + Math.sin(i) * t
    };
}
function checkForSpikePlacements() {
    let e = near;
    let t = e.length;
    let i = [];
    let s = Math.PI / 16;
    let n = Math.PI * 2;
    for (let a = 0; a < t; a++) {
        let l = false;
        let o = e[a];
        let r = o.spikeType?.id || 9;
        let c = items.list[r];
        let d = 35 + c.scale + (c.placeOffset || 0);
        let p = 35 + c.scale;
        for (let h = 0; h <= n; h += s) {
            let g = calculatePosition(o, d, h);
            if (objectManager.checkItemLocation(g.x, g.y, c.scale, 0.6, r, false) && (UTILS.getDistance(g, player) <= p || UTILS.getDistance(player.vel, g) <= p)) {
                i.push({
                    enemy: o,
                    dmg: c.dmg
                });
                break;
            }
        }
        if (l) {
            continue;
        }
    }
    return i.sort((e, t) => t.dmg - e.dmg)[0] || false;
}
function calculateWeaponDamage(e, t) {
    if (items.weapons[e]) {
        if (items.weapons[e].projectile) {
            return items.weapons[e].dmg;
        } else {
            return items.weapons[e].dmg * config.weaponVariants[t].val;
        }
    } else {
        return 0;
    }
}
function checkIfUserCanOnetick(e) {
    let t = e.primaryWeapon;
    let i = e.primaryVariant;
    return calculateWeaponDamage(t, i) * 1.5 + 25 + (i == 3 ? 5 : 0) >= 100;
}
function meleeKB(e, t, i, s) {
    let n = ((items.weapons[i] || {}).knock || 0) + 0.3;
    n *= game.tickSpeed;
    if (s) {
        let a = {
            x: e.x2,
            y: e.y2
        };
        for (let l = 0; l < s.length; l++) {
            let o = s[l] * game.tickSpeed;
            a.x += Math.cos(t) * o;
            a.y += Math.sin(t) * o;
        }
        return a;
    }
    return {
        x: e.x2 + Math.cos(t) * n,
        y: e.y2 + Math.sin(t) * n
    };
}
function addKBSpikeDamage(e, t) {
    if (player.trapData) {
        return 0;
    }
    let i = UTILS.getDirection(player, t);
    let s = meleeKB(player, i, e);
    return gameObjects.filter(e => e.active && e.dmg && !isFriendly(e.owner.sid) && UTILS.getDistance(s, e) <= 35 + e.scale).reduce((e, t) => e + t.dmg, 0) || 0;
}
let cachedDamages = {};
function findCachedDamage(e, t, i) {
    let s = cachedDamages[e + " " + t];
    if (!s) {
        s = [];
        let n = [1, 1.5, 1.2];
        let a = [1, 0.2];
        for (let l = 0; l < n.length; l++) {
            for (let o = 0; o < a.length; o++) {
                s.push(i * n[l] * a[o]);
            }
        }
        cachedDamages[e + " " + t] = [...s];
    }
    return s;
}
function doPreciseValues(e, t) {
    if (e - t < 0.01 && e - t > 0) {
        return t;
    } else {
        return e;
    }
}
function soldierRound(e, t) {
    if (player.skinIndex == 6) {
        return doPreciseValues(e * 0.75, t);
    } else {
        return doPreciseValues(e);
    }
}
function fitsPalette(e, t) {
    let i = t.primaryWeapon;
    let s = t.primaryVariant;
    let n = calculateWeaponDamage(i, s);
    let a = findCachedDamage(i, s, n);
    for (let l = 0; l < a.length; l++) {
        if (soldierRound(a[l], e) == e) {
            return "primary";
        }
    }
    let o = t.secondaryWeapon;
    if (items.weapons[t.secondaryWeapon].projectile) {
        let r = calculateWeaponDamage(o, 0);
        if (soldierRound(r, e) == e) {
            return "secondary";
        }
    }
    return soldierRound(25, e) == e && "turret";
}
function reloadPercent(e, t) {
    if (t == 53) {
        return 1 - e.reloads[53] / 2500;
    }
    if (!items.weapons[t]) {
        return 1;
    }
    let i = items.weapons[t].speed;
    return 1 - e.reloads[t] / i;
}
function hasHit(e, t) {
    if (t == 53) {
        return game.tick - e.turretHit <= 2;
    }
    if (t < 9) {
        if (game.tick - e.primaryHit <= 2) {
            return true;
        }
    } else if (game.tick - e.secondaryHit <= 2) {
        return true;
    }
    return false;
}
function doTurretTargetLineMath(e) {
    let t = ais.filter(t => t.visible && t.hostile && UTILS.getDistance(t, e) <= 600).sort((t, i) => UTILS.getDistance(t, e) - UTILS.getDistance(i, e))[0];
    let i = players.filter(t => t.visible && t.skinIndex != 26 && e.sid != t.sid && t.sid != playerSID && (!t.team || t.team != e.team) && UTILS.getDistance(t, e) <= 600).sort((t, i) => UTILS.getDistance(t, e) - UTILS.getDistance(i, e))[0];
    let s = t;
    if (t) {
        if (i && UTILS.getDistance(i, e) <= UTILS.getDistance(t, e)) {
            s = i;
        }
    } else {
        s = i;
    }
    if (s) {
        let n = UTILS.getDirection(s, e);
        if (UTILS.getDistance(player, e) <= UTILS.getDistance(s, e)) {
            let a = UTILS.getDistance(player, e);
            let l = {
                x: e.x2 + Math.cos(n) * a,
                y: e.y2 + Math.sin(n) * a
            };
            if (UTILS.getDistance(player, l) <= 60) {
                return true;
            }
        }
    }
    return false;
}
function interpretDamage() {
    let e = near;
    let t = e.length;
    let i = [];
    let s = [];
    for (let n = 0; n < damages.length; n++) {
        let a = damages[n];
        let l = false;
        for (let o = 0; o < t; o++) {
            let r = {
                canEMP: true,
                potDamage: 0,
                done: false
            };
            let c = e[o];
            r.sid = c.sid;
            let d = fitsPalette(a, c);
            if (!d) {
                continue;
            }
            let p = c.primaryWeapon;
            let h = c.secondaryWeapon;
            let g = calculateWeaponDamage(p, c.primaryVariant);
            let $ = calculateWeaponDamage(h, c.secondaryVariant);
            let m = reloadPercent(c, p);
            let u = reloadPercent(c, h);
            let f = reloadPercent(c, 53);
            if (d == "primary") {
                if (hasHit(c, p)) {
                    if (u > 0.7) {
                        r.potDamage += $;
                        let y = addKBSpikeDamage(h, c);
                        if (y) {
                            r.potDamage += y;
                            r.spike = true;
                        }
                    }
                    if (f > 0.7) {
                        r.potDamage += 25;
                    }
                    if (doTurretTargetLineMath(c) || !items.weapons[h].projectile) {
                        r.canEMP = false;
                    }
                    r.done = true;
                }
            } else if (d == "secondary") {
                r.canEMP = false;
                if (hasHit(c, h)) {
                    if (m > 0.7) {
                        r.potDamage += g * 1.5;
                        let x = addKBSpikeDamage(p, c);
                        if (x) {
                            r.potDamage += x;
                            r.spike = true;
                        }
                    }
                    r.done = true;
                }
            } else {
                r.canEMP = false;
                if (hasHit(c, 53) && !items.weapons[h].projectile && hasHit(c, h)) {
                    if (m > 0.7) {
                        r.potDamage += g * 1.5;
                        let b = addKBSpikeDamage(p, c);
                        if (b) {
                            r.potDamage += b;
                            r.spike = true;
                        }
                    }
                    if (checkIfUserCanOnetick(c)) {
                        buyEquip(6, 0);
                    }
                    r.done = true;
                }
            }
            if (r.done) {
                i.push(r);
                l = true;
                break;
            }
        }
        if (l) {
            continue;
        }
        let spikeDamages = [20, 35, 45, 30];
        let k = spikeDamages.find(e => e == a || e == a / 0.75);
        if (k && player.trapData) {
            let _ = 0;
            let v = gameObjects.filter(e => e.active && e.dmg == k && !isFriendly(e.owner.sid) && !s.includes(e.sid)).map(e => ({ obj: e, distance: UTILS.getDistance(e, player)})).sort((e, t) => e.distance - t.distance).map(e => e.obj);
            for (let w = 0; w < t; w++) {
                let T = e[w];
                let S = v.find(e => e.owner.sid == T.sid);
                let I = i.find(e => e.sid == T.sid);
                if (S) {
                    let B = T.primaryWeapon;
                    let D = reloadPercent(T, B);
                    let E = calculateWeaponDamage(B, T.primaryVariant) * 1.5;
                    if (D + 111 / items.weapons[B].speed >= 1) {
                        if (I) {
                            if (I.potDamage < E) {
                                s.push(S.sid);
                                I.potDamage = E;
                                break;
                            }
                        } else {
                            s.push(S.sid);
                            _ += E;
                            break;
                        }
                    }
                }
            }
            i.push({
                canEMP: false,
                spike: true,
                potDamage: k + _
            });
        }
    }
    if (true) {
        if (!player.trapData) {
            let P = gameObjects.filter(e => e.active && e.dmg && UTILS.getDistance(player.vel, e) <= 35 + e.scale && !isFriendly(e.owner.sid) && !s.includes(e.sid)).reduce((e, t) => e + t.dmg, 0);
            i.push({
                canEMP: false,
                spike: true,
                potDamage: P
            });
        }
        let A = checkForSpikePlacements();
        if (A) {
            let C = i.find(e => e.sid == A.enemy.sid);
            let L = A.enemy;
            let H = L.primaryWeapon;
            let O = L.primaryVariant;
            let W = calculateWeaponDamage(H, O) * 1.5;
            let j = reloadPercent(L, H);
            if (C) {
                C.spike = true;
                C.canEMP = false;
                if (j == 1 && W + A.dmg > C.potDamage) {
                    C.potDamage = W + A.dmg;
                }
            } else {
                i.push({
                    canEMP: false,
                    spike: true,
                    potDamage: A.dmg + (j == 1 ? W : 0)
                });
            }
        }
    }
    return i;
}
let preferedWeaponIndex = 0;
function heal(e) {
    let t = player.items[0];
    let i = Math.abs(e) / (t == 0 ? 20 : t == 1 ? 40 : 30);
    for (let s = 0; s < i; s++) {
        selectToBuild(t);
        sendHit(1, getAttackDir());
        selectToBuild(preferedWeaponIndex, true);
    }
}
let healingPotential = 0;
function healing() {
    if (damages.length) {
        let e = 200 - player.health; // Adjust threshold to 200
        if (enemy.length) {
            let t = interpretDamage();
            let i = healingPotential = t.reduce((e, t) => e + t.potDamage, 0) + (player.skinIndex == 7 ? 5 : 0);
            let s = t.every(e => e.canEMP);
            let n = t.some(e => e.spike);
            if (player.health - i <= 0) {
                if (player.shameCount < 7) {
                    hea222l(e);
                } else {
                    start0ShameHeal(true, e);
                }
            } else {
                start0ShameHeal(2, e);
            }
        } else {
            start0ShameHeal(true, e);
        }
    }
    autoHealing();
}
let needTick = 0;
var pingTracker = new class {
    constructor() {
        this.data = {};
        this.tracker = class {
            constructor() {
                this.ping = 0;
                this.allPings = [];
                this.healingPromises = [];
                this.updated = Date.now();
            }
        };
    }
    add(e, t) {
        this.data[e] ||= new this.tracker();
        let i = this.data[e];
        if ((t >= 0 ? "heal" : "dmg") == "dmg") {
            let s = i.healingPromises.length;
            let n = Date.now();
            new Promise(function (e) {
                i.healingPromises.push(e);
                setTimeout(() => {
                    e();
                }, 500);
            }).then(function (e) {
                i.healingPromises.splice(s, 1);
                if (!e) {
                    return;
                }
                let t = Date.now() - n;
                if (t > 120) {
                    if (Date.now() - i.updated >= 30000) {
                        i.allPings = [];
                    }
                    i.allPings.push(t - 120);
                    i.updated = Date.now();
                    if (i.allPings.length > 15) {
                        i.allPings.shift();
                    }
                    i.ping = Math.round(i.allPings.reduce((e, t) => e + t, 0) / i.allPings.length);
                }
            });
        } else if (i.healingPromises.length) {
            i.healingPromises.forEach(e => e(true));
            i.healingPromises = [];
        }
    }
}();
function tickBase22222() {
    for (let e = 0; e < forcedAddOns.length; e++) {
        if (forcedAddOns[e] > 0) {
            forcedAddOns[e]--;
            if (forcedAddOns[e] <= 0) {
                forcedAddOns[e] = 0;
            }
        }
    }
    spikeSoldier = false;
    if (player.trapData) {
        let t = 0;
        for (let i = 0; i < near.length; i++) {
            let s = near[i];
            let n = s.primaryWeapon;
            let a = reloadPercent(s, n);
            let l = calculateWeaponDamage(n, s.primaryVariant) * 1.5;
            if (a == 1 && (t += l) >= 100) {
                break;
            }
        }
        if (gameObjects.find(e => e.active && e.dmg && !isFriendly(e.owner.sid) && e.dmg + t >= 100 && UTILS.getDistance(player.vel, e) <= 35 + e.scale)) {
            textManager.showText(player, 250, 40, 0, "#000", "block");
            spikeSoldier = true;
            return;
        }
    } else {
        let o = 0;
        let r = [];
        for (let c = 0; c < gameObjects.length; c++) {
            let d = gameObjects[c];
            if (d.active && d.dmg && !isFriendly(d.owner.sid)) {
                r.push(d);
                if (UTILS.getDistance(d, player.vel) <= 35 + d.scale) {
                    o += d.dmg;
                }
            }
        }
        for (let p = 0; p < near.length; p++) {
            let h = near[p];
            let g = h.primaryWeapon;
            let $ = reloadPercent(h, g);
            let m = calculateWeaponDamage(g, h.primaryVariant) * 1.5;
            if ($ == 1) {
                if (o > 0 && o + m >= 100) {
                    spikeSoldier = true;
                    break;
                }
                let u = UTILS.getDirection(player, h);
                let f = meleeKB(player, u, g);
                if (r.filter(e => UTILS.getDistance(f, e) <= 35 + e.scale).reduce((e, t) => e + t.dmg, 0) + m >= 100) {
                    spikeSoldier = true;
                    break;
                }
            }
        }
    }
}
function isFriendly(e) {
    return player.sid == e || !!isAlly(e);
}
function checkTraps() {
    for (let e = 0; e < players.length; e++) {
        let t = players[e];
        if (t && t.visible && (!isAlly(t.sid) || isMine(t.sid))) {
            let i;
            i = t.sid == player.sid ? gameObjects.find(e => e.active && e.trap && UTILS.getDistance(t, e) < 49 && !isFriendly(e.owner.sid)) : gameObjects.find(e => e.active && e.trap && UTILS.getDistance(t, e) < 49 && e.owner.sid != t.sid);
            t.lastTrapData = !!t.trapData;
            if (i) {
                if (player == t) {
                    buyEquip(6, 0, false);
                }
                t.trapData = i;
                i.hideFromEnemy = false;
            } else {
                t.trapData = undefined;
            }
        } else if (t) {
            t.trapData = undefined;
        }
    }
}
function killPlayer() {
    inGame = false;
    lastDeath = {
        x: player.x,
        y: player.y
    };
    diedText.style.display = "block";
    diedText.style.fontSize = "0px";
    if (false) {
        packet("M", {
            name: lastsp[0],
            moofoll: lastsp[1],
            skin: lastsp[2]
        });
        setTimeout(function () {
            menuCardHolder.style.display = "block";
            mainMenu.style.display = "block";
            diedText.style.display = "none";
        }, config.deathFadeout);
    }
}

var ageText = getEl("ageText");
var ageBarBody = getEl("ageBarBody");
function updateAge(xp, mxp, age) {
    if (xp != undefined) {
        player.XP = xp;
    }
    if (mxp != undefined) {
        player.maxXP = mxp;
    }
    if (age != undefined) {
        player.age = age;
    }
    if (age == config.maxAge) {
        ageText.innerHTML = "MAX AGE";
        ageBarBody.style.width = "100%";
    } else {
        ageText.innerHTML = "AGE " + player.age;
        if (visualsForNow) {
            ageBarBody.style.transition = "1s";
        } else {
            ageBarBody.style.transition = null;
        }
        ageBarBody.style.width = ((player.XP / player.maxXP) * 100) + "%";
    }
}
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
            if (items.list[i].age == age && (items.list[i].pre == undefined || player.items.indexOf(items.list[i].pre) >= 0)) {
                let tmpI = items.weapons.length + i;
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
                let tmpItem = getEl("upgradeItem" + i);
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
            upgradeCounter.style.borderRadius = "4px";
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
function toR(cool) {
    var eeeeeee = cool * Math.PI / 180 % (Math.PI * 2);
    if (eeeeeee > Math.PI) {
        return Math.PI - eeeeeee;
    } else {
        return eeeeeee;
    }
}
let breakTracks = [];
function manageBuildingBreak(e) {
    if (UTILS.getDistance(player, e) <= 300 && inGame) {
        doAntiSpiketick(e);
        e.currentHealth = 0;
    }
}
function killObject(sid) {
    let findObj = findObjectBySid(sid);
    let objDst = UTILS.getDist(findObj, player, 0, 2);
    let t = objectManager.disableBySid(sid);
    if (t && player) {
        manageBuildingBreak(t);
    }
    if (player) {
        if(sid == traps.info.sid||(traps.inTrap&&traps.inTrap.sid&&traps.inTrap.sid==sid)){
            for(var i=0;i<2;i++){
                place(0, getSafeDir());
            }
        }
        for (let i = 0; i < breakObjects.length; i++) {
            if (breakObjects[i].sid == sid) {
                breakObjects.splice(i, 1);
                break;
            }
        }
        if (!player.canSee(findObj)) {
            pathFindTest.push({
                x: findObj.x,
                y: findObj.y
            });
        }
        if (pathFindTest.length > 8) {
            pathFindTest.shift();
        }
        traps.replacer(findObj);
    }
}
function killObjects(sid) {
    if (player) {
        objectManager.removeAllItems(sid);
    }
}
function fgdo(a, b) {
    return Math.sqrt(Math.pow(b.y - a.y, 2) + Math.pow(b.x - a.x, 2));
}
function isAlly(sid, pSid) {
    tmpObj = findPlayerBySID(sid)
    if (!tmpObj) {
        return
    }
    if (pSid) {
        let pObj = findPlayerBySID(pSid)
        if (!pObj) {
            return
        }
        if (pObj.sid == sid) {
            return true
        } else if (tmpObj.team) {
            return tmpObj.team === pObj.team ? true : false
        } else {
            return false
        }
    }
    if (!tmpObj) {
        return
    }
    if (player.sid == sid) {
        return true
    } else if (tmpObj.team) {
        return tmpObj.team === player.team ? true : false
    } else {
        return false
    }
}
let eeeeeeee = [];
let dddddddddddddd = [];

// dune mod dmgpot
function sortWeaponVariant(id) {
    switch (id) {
        case 0:
            return 1
            break;
        case 1:
            return 1.1
            break;
        case 2:
            return 1.18
            break;
        case 3:
            return 1.18
            break;
        default:
            return 1
            break;
    }
}
// UPDATE MAIN PLAYER DATA:
function cdf(e, t) {
    try {
        return Math.hypot((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
    } catch (e) {
        return Infinity;
    }
}
function caf(e, t) {
    try {
        return Math.atan2((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
    } catch (e) {
        return 0;
    }
}
// PING:
var lastPing = -1;
var maxPing = NaN;
var minPing = NaN;
var pingCount = 0;

var doAutoQ = false;
var pingDisplay = getEl("pingDisplay");
// RENDER TRACER / CREDIT TO NEKOSAN:
function addUser(tmpObj) {
    let center = {
        x: screenWidth / 2,
        y: screenHeight / 2,
    };
    let rad = UTILS.getDirect(tmpObj, player, 2, 2)
    let alpha = Math.min(1, (UTILS.getDistance(0, 0, player.x2 - tmpObj.x2, (player.y2 - tmpObj.y2) * (16 / 9)) * 100) / (config.maxScreenHeight / 2) / center.y);
    let dist = center.y * alpha;
    let tmpX = center.x + dist * Math.cos(rad) - 20 / 2;
    let tmpY = center.y + dist * Math.sin(rad) - 20 / 2;
    if (!getEl("enemyradar" + tmpObj.sid)) {
        let addRadar = document.createElement("div");
        addRadar.id = "enemyradar" + tmpObj.sid;
        document.body.append(addRadar);
        addRadar.style = `
                display: none;
                position: absolute;
                left: 0;
                top: 0;
                color: #fff;
                width: 0;
                height: 0;
                border-style: solid;
                border-width: 10px 0 10px 20px;
                border-color: transparent transparent transparent #fff;
                `;
    }
    if (getEl("enemyradar" + tmpObj.sid)) {
        getEl("enemyradar" + tmpObj.sid).style.left = tmpX + "px";
        getEl("enemyradar" + tmpObj.sid).style.top = tmpY + "px";
        getEl("enemyradar" + tmpObj.sid).style.display = !isTeam(tmpObj) ? "block" : "none";
        getEl("enemyradar" + tmpObj.sid).style.opacity = alpha;
        getEl("enemyradar" + tmpObj.sid).style.transform = "rotate(" + UTILS.toAng(rad) + "deg)";
    }
}
let ms = {
    avg: 0,
    max: 0,
    min: 0,
    delay: 0
}
//ping scopes
let Fo = -1;
let second = -1;
let highestArr = [];
let highestMs = -1;
let averageArr = [];
let averageMs = -1;
//preplacer tests for better results
let preplaceDelay = {
    killObject: -1,
    gatherAnimation: -1,
    total: function() {
        return (Math.abs(Math.trunc(this.killObject - this.gatherAnimation)));
    },
}

function findHighest(ping) {
    if (ping > highestMs && ping < 1e3) {
        highestMs = ping;
    }
}

function secondSocket() {
    let time = Date.now();
    const e = time - second;
    window.pingTime = e;
}

let msa = {
    avg: 0,
    max: 0,
    min: Infinity,
};

function pingSocketResponse() {
    let pingTime = window.pingTime;
    const pingDisplay = document.getElementById("pingDisplay");
    pingDisplay.innerText = "Ping: " + pingTime + " ms";

    msa.max = isNaN(msa.max) ? pingTime : Math.max(msa.max, pingTime);
    msa.min = isNaN(msa.min) ? pingTime : Math.min(msa.min, pingTime);
    msa.avg = Math.floor([(window.pingTime + msa.max + msa.min)/3]);
}
let Pn;
let realTime;

function rePing() {
    realTime && clearTimeout(realTime);
    inGame && (second = Date.now());
    realTime = setTimeout(rePing, window.manhandle);
}

function pingSocketStart() {
    rePing();
    Pn && clearTimeout(Pn);
    inGame && (Fo = Date.now(), io.send('0'));
    Pn = setTimeout(pingSocketStart, 1e3 / 9);
}
pingDisplay.style.display = "none";
document.body.appendChild(pingDisplay);

let currentTick = 0;
function CheckSnowBiome() {
    if (player.y2 <= config.snowBiomeTop) {
        return true;
    } else {
        return false;
    }
}
function SpeedMill() {
    if ((player.skinIndex == 12 && player.tailIndex == 11 && player.weaponIndex == 7)) {
        return 1;
    } else {
        return player.tailIndex == 11 ? ((CheckSnowBiome() && player.skinIndex != 15) || (player.weaponIndex == 10 || player.weaponIndex == 3 || player.weaponIndex == 4)) ? player.weaponIndex == 5 ? 4 : 3 : 2 : ((CheckSnowBiome() && player.skinIndex != 15) || (player.weaponIndex == 10 || player.weaponIndex == 4 || player.weaponIndex == 5 || player.weaponIndex == 5)) ? 4 : 3;
    }
}
function isInTrap(plyr) {
    return gameObjects
        .filter(
        (e) =>
        e.trap &&
        e.active &&
        UTILS.getDist(e, plyr, 0, 2) <= 35 + e.getScale() + 5 &&
        !e.isTeamObject(plyr)
    )
        .sort(function (a, b) {
        return UTILS.getDist(a, plyr, 0, 2) - UTILS.getDist(b, plyr, 0, 2);
    })[0];
}
function gameTick() {
    game.tick++;

    enemy = [];
    nears = [];
    near = [];

    game.tickSpeed = performance.now() - game.lastTick;
    game.lastTick = performance.now();
}
// PREPLACER
let closestBuild = [];

function findTargetBuildToSpike(checkSpike, trapDistance, targetDistance, targetAngle) {
    if (!true) return;
    if (!enemy.length) return;

    // En yak─▒n in┼θa edilebilir nesneyi bul
    closestBuild = gameObjects.filter(obj => obj.active && obj.buildHealth)
        .sort((a, b) => UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2))[0];

    if (!closestBuild) return;

    // Parametreleri ayarla (b├╝y├╝k ihtimalle mesafe, a├π─▒ gibi)
    checkSpike = 250;
    trapDistance = 250;
    targetDistance = UTILS.getDist(closestBuild, player, 0, 2);
    targetAngle = UTILS.getDirect(closestBuild, player, 0, 2);

    // Spike atma ko┼θullar─▒n─▒ kontrol et
    if (player.alive && targetDistance < checkSpike && near.dist2 < trapDistance &&
        !traps.in && !instaC.isTrue && !instaC.canSpikeTick && !clicks.middle && !clicks.left) {

        // Hedefin can─▒ yeterince d├╝┼θ├╝kse...
        if (closestBuild.buildHealth < items.weapons[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]].dmg * 2) {
            for (let i = 0; i < 4; i++) {
                let angle = i + 45 * (i % 2 ? -1 : 1) / 180 * Math.PI + near.aim2;
                checkPlace(2, i);
            }
        }
    }
}
let isAutoFollowOn = false;
let targetPlayerId = null;
const CLOSE_DISTANCE = 80;
const FAR_DISTANCE = 100;
function bullHit() {
    if (player.reloads[player.weapons[0]] == 0) {
        my.autoAim = true;
        buyEquip(7, 0);
        selectWeapon(player.weapons[0]);
        packet("F", 1);
        sendAutoGather();
        game.tickBase(() => {
            my.autoAim = false;
            packet("F", null, 0);
            sendAutoGather();
        }, 1);
    }
}
// UPDATE PLAYER DATA:
let lastpretrigger = Date.now();
WompWomp.isInTrap = (sid)=>{
    let near = findPlayerBySID(sid), nearTrap;
    nearTrap = gameObjects.filter(e => e.trap && e.active && !e.isTeamObject(near) && UTILS.getDist(e, near, 0, 2) <= (near.scale + e.getScale() + 5)).sort(function(a, b) {
        return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
    })[0];
    if(nearTrap){
        return nearTrap;
    }else{
        return false;
    }
}
class NeuralNetwork {
    constructor(inputSize, hiddenSize, outputSize) {
        this.weights1 = this.initializeWeights(inputSize, hiddenSize);
        this.weights2 = this.initializeWeights(hiddenSize, outputSize);
        this.bias1 = this.initializeBias(hiddenSize);
        this.bias2 = this.initializeBias(outputSize);
    }

    initializeWeights(input, output) {
        return Array.from({ length: input }, () => Array.from({ length: output }, () => Math.random() * 2 - 1));
    }

    initializeBias(size) {
        return Array.from({ length: size }, () => Math.random() * 2 - 1);
    }

    sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    sigmoidDerivative(x) {
        return x * (1 - x);
    }

    feedForward(input) {
        this.hidden = this.sigmoid(this.addBias(this.multiply(input, this.weights1), this.bias1));
        this.output = this.sigmoid(this.addBias(this.multiply(this.hidden, this.weights2), this.bias2));
        return this.output;
    }

    addBias(matrix, bias) {
        return matrix.map((val, idx) => val + bias[idx]);
    }

    multiply(input, weights) {
        return weights[0].map((_, i) => input.reduce((sum, x, j) => sum + x * weights[j][i], 0));
    }

    backpropagate(input, expected, learningRate) {
        const outputError = expected.map((val, idx) => val - this.output[idx]);
        const outputDelta = outputError.map((val, idx) => val * this.sigmoidDerivative(this.output[idx]));

        const hiddenError = this.multiply(outputDelta, this.transpose(this.weights2));
        const hiddenDelta = hiddenError.map((val, idx) => val * this.sigmoidDerivative(this.hidden[idx]));

        this.weights2 = this.adjustWeights(this.hidden, outputDelta, this.weights2, learningRate);
        this.weights1 = this.adjustWeights(input, hiddenDelta, this.weights1, learningRate);

        this.bias2 = this.adjustBias(this.bias2, outputDelta, learningRate);
        this.bias1 = this.adjustBias(this.bias1, hiddenDelta, learningRate);
    }

    transpose(matrix) {
        return matrix[0].map((_, i) => matrix.map(row => row[i]));
    }

    adjustWeights(input, delta, weights, learningRate) {
        return weights.map((row, i) => row.map((w, j) => w + learningRate * delta[j] * input[i]));
    }

    adjustBias(bias, delta, learningRate) {
        return bias.map((b, i) => b + learningRate * delta[i]);
    }

    train(input, expected, learningRate = 0.1) {
        this.feedForward(input);
        this.backpropagate(input, expected, learningRate);
    }

    predict(input) {
        return this.feedForward(input);
    }
}

const inputSize = 5;
const hiddenSize = 10;
const outputSize = 2;
const learningRate = 0.1;

const nn = new NeuralNetwork(inputSize, hiddenSize, outputSize);

function trainAI(data) {
    data.forEach(({ inputs, expected }) => {
        nn.train(inputs, expected, learningRate);
    });
}
let proheal = [Date.now(),100,false];
function updateAI() {
    const shameCount = player.shameCount;
    let tmpObj = player;
    let spikes = gameObjects.filter(e => e.dmg && e.active && UTILS.getDist(e, tmpObj, 0, 2) <= 400 && !e.isTeamObject(tmpObj)).sort(function(a, b) {
        return UTILS.getDist(a, tmpObj, 0, 2) - UTILS.getDist(b, tmpObj, 0, 2);
    })[0];
    const data = {
        health: player.health,
        lastDamageTime: player.timeDamaged,
        trapStatus: WompWomp.isInTrap(player),
        nearbySpikes: spikes,
        pingTime: window.pingTime
    };
    const inputs = Object.values(data);
    const prediction = nn.predict(inputs);

    if (shameCount < 8) {
        if (prediction[0] > 0.5) place(0, getSafeDir());
        if (prediction[1] > 0.5) hea222l();
    }

    const prohealLength = proheal.length;
    const buildingData = gameObjects.map(b => b.active);

    const trainingData = [
        {
            inputs: [data.health, data.lastDamageTime, data.trapStatus, data.nearbySpikes, data.pingTime, proheal,players,buildingData,player.shameCount],
            expected: [prohealLength > 0 ? 1 : 0, data.health < 100 ? 1 : 0]
        }
    ];

    trainAI(trainingData);

    if (data.health <= 0) {
        const deathData = JSON.parse(localStorage.getItem('deathData') || '[]');
        deathData.push({ inputs, shameCount });
        localStorage.setItem('deathData', JSON.stringify(deathData));
    } else {
    }

    localStorage.setItem('aiData', JSON.stringify({ inputs, prediction }));
}
let botSync = false;
function updatePlayers(data) {
    game.manageTickBase();
    findTargetBuildToSpike();
    if (player.shameCount > 0) {
        my.reSync = true;
    } else {
        my.reSync = false;
    }
    gameTick();
    antiCounterSpiketick();
    players.forEach((tmp) => {
        tmp.forcePos = !tmp.visible;
        tmp.visible = false;
        if ((tmp.timeHealed - tmp.timeDamaged) > 0 && tmp.lastshamecount < tmp.shameCount);
        tmp.pinge = (tmp.timeHealed - tmp.timeDamaged);
    });
    for (let i = 0; i < data.length;) {
        tmpObj = findPlayerBySID(data[i]);
        if (tmpObj) {
            tmpObj.t1 = tmpObj.t2 === undefined ? game.lastTick : tmpObj.t2;
            tmpObj.t2 = game.lastTick;
            tmpObj.oldPos.x2 = tmpObj.x2;
            tmpObj.oldPos.y2 = tmpObj.y2;
            tmpObj.x1 = tmpObj.x;
            tmpObj.y1 = tmpObj.y;
            tmpObj.x2 = data[i + 1];
            tmpObj.y2 = data[i + 2];
            tmpObj.x3 = tmpObj.x2 + (tmpObj.x2 - tmpObj.oldPos.x2);
            tmpObj.y3 = tmpObj.y2 + (tmpObj.y2 - tmpObj.oldPos.y2);
            tmpObj.d1 = tmpObj.d2 === undefined ? data[i + 3] : tmpObj.d2;
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
            tmpObj.inTrap = gameObjects.filter(e => e.trap && e.active && UTILS.getDist(e, tmpObj, 0, 2) < 50 && !e.isTeamObject(tmpObj)).sort(function (a, b) {
                return UTILS.getDist(a, tmpObj, 0, 2) - UTILS.getDist(b, tmpObj, 0, 2);
            })[0];
            if(tmpObj.inTrap){
                tmpObj.intrapTime = Date.now();
            }
            if(tmpObj == player){
                if(player.skinIndex == 7) {
                    UseBullTime = Date.now();
                }
            }
            tmpObj.update(game.tickSpeed);
            tmpObj.dist2 = UTILS.getDist(tmpObj, player, 2, 2);
            tmpObj.aim2 = UTILS.getDirect(tmpObj, player, 2, 2);
            tmpObj.dist3 = UTILS.getDist(tmpObj, player, 3, 3);
            tmpObj.aim3 = UTILS.getDirect(tmpObj, player, 3, 3);
            tmpObj.hitSpike = false;
            tmpObj.damageThreat = 0;
            if (tmpObj == player) {
                tmpObj.syncThreats = 0;
            }
            if (tmpObj.skinIndex == 45 && tmpObj.shameTimer <= 0) {
                tmpObj.addShameTimer();
            }
            if (tmpObj.oldSkinIndex == 45 && tmpObj.skinIndex != 45) {
                tmpObj.shameTimer = 0;
                tmpObj.shameCount = 0;
                if (tmpObj == player) {
                    hea222l();
                }
            }
            let nearTrap = isInTrap(tmpObj);
            if (nearTrap) {
                tmpObj.trapped = true;
                tmpObj.inTrap = nearTrap;
                tmpObj.trapInfo2 = nearTrap;
                tmpObj.trapAim = UTILS.getDirect(nearTrap, tmpObj, 0, 2);
                tmpObj.trapClear = false;
            } else {
                tmpObj.trapped = false;
                tmpObj.inTrap = undefined;
                tmpObj.trapAim = undefined;
                if (!tmpObj.trapClear) {
                    game.tickBase(() => {
                        tmpObj.trapInfo2 = undefined;
                        tmpObj.trapClear = true;
                    }, 1);
                }
            }
            if (tmpObj == player) {
                if (gameObjects.length) {
                    gameObjects.forEach(tmp => {
                        tmp.onNear = false;
                        if (tmp.active) {
                            if (!tmp.onNear && UTILS.getDist(tmp, tmpObj, 0, 2) <= tmp.scale + items.weapons[tmpObj.weapons[0]].range) {
                                tmp.onNear = true;
                            }
                            if (tmp.isItem && tmp.owner) {
                                if (!tmp.pps && tmpObj.sid == tmp.owner.sid && UTILS.getDist(tmp, tmpObj, 0, 2) > (0) && !tmp.breakObj && ![13, 14, 20].includes(tmp.id)) {
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
                    let nearTrap = isInTrap(tmpObj);
                    if (nearTrap) {
                        traps.dist = UTILS.getDist(nearTrap, tmpObj, 0, 2);
                        traps.aim = UTILS.getDirect(nearTrap, tmpObj, 0, 2);
                        if (!traps.inTrap) {
                            traps.protect(traps.aim);
                        }
                        traps.inTrap = true;
                        traps.info = nearTrap;
                    } else {
                        traps.inTrap = false;
                        traps.info = {};
                    }
                    let spike = gameObjects.filter(e => (["spikes", "greater spikes", "spinning spikes", "poison spikes", "teleporter"].includes(e.name || e.dmg) && e.active && UTILS.getDist(e, player, 0, 3) <= player.scale + e.scale + 40 && !e.isTeamObject(player))).sort((a, b) => {
                        return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
                    })[0];
                    if (spike && !traps.inTrap) {
                        spikes.aim = UTILS.getDirect(spike, player, 0, 2);
                        spikes.inRange = true;
                    } else {
                        spikes.inRange = false;
                    }
                } else {
                    traps.inTrap = false;
                    spikes.inRange = false;
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
    for (let nF = 0; nF < doStuffPingSet.length; nF++) {
        setTimeout(doStuffPingSet[nF], 0, true)
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
    doStuffPingSet = []
    if (runAtNextTick.length) {
        runAtNextTick.forEach(tmp => {
            checkProjectileHolder(...tmp);
        });
        runAtNextTick = [];
    }
    let teams = []
    for (let i = 0; i < data.length;) {
        tmpObj = findPlayerBySID(data[i]);
        if (tmpObj) {
            if (!tmpObj.isTeam(player)) {
                enemy.push(tmpObj);
                if (tmpObj.dist2 <= items.weapons[tmpObj.primaryIndex == undefined ? 5 : tmpObj.primaryIndex].range + (player.scale * 2)) {
                    nears.push(tmpObj);
                }
            } else if(tmpObj.sid!==player.sid) {
                teams.push(tmpObj);
            }
            tmpObj.manageReload();
            if (tmpObj != player) {
                tmpObj.addDamageThreat(player);
            }
        }
        getDamageThreat(tmpObj);
        i += 13;
    }
    if (player && player.alive) {
        if (enemy.length) {
            near = enemy.sort(function (tmp1, tmp2) {
                return tmp1.dist2 - tmp2.dist2;
            })[0];
/*             if (ais.length) {
                ais.forEach((e) => {
                    let heal = new class {
                        checkWeaponDmg(_, sold = true, bull = true) {
                            const { primaryVariant: v, weapons: [weapon] } = _;
                            const pV = v ? config.weaponVariants[v].val : 1;
                            const e = (bull && player.skins[7]) ? 1.5 : 1;

                            return items.weapons[weapon].dmg * e * pV;
                        }
                    };
                    const ef = () => {
                        const e = heal.checkWeaponDmg(player, ais, true, true);
                        const w = ais.health <= e;
                        return w;
                    }
                    let tmp = near;
                    if (ef() && UTILS.getDirect(e, player, 2, 2)) {
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        sendAutoGather();
                        packet("F", 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            packet("F", null, 1);
                        }, 1);
                    }
                });
            } */
            if (teams.length) {
                teams.forEach((teammate) => {
                    let tmp = near;

                    if (UTILS.getDistance(tmp.x2, tmp.y2, teammate.x2, teammate.y2) <= top.customTeammateRange &&
                        UTILS.getDistance(tmp.x2, tmp.y2, player.x2, player.y2) <= top.customPlayerRange &&
                        player.reloads[player.primaryIndex] === 0 &&
                        teammate.reloads[teammate.primaryIndex] === 0) {
                        if (teammate.weaponIndex === teammate.primaryIndex && player.weaponIndex === player.primaryIndex) {
                            traps.wompwomp = false;
                            clicks.left = true;
                            top.sycin = true;
                            top.lastSync = Date.now();
                            game.tickBase(() => {
                                clicks.left = false;
                            }, 1);
                        } else if (player.weaponIndex !== player.primaryIndex) {
                            selectWeapon(player.primaryIndex);
                            traps.wompwomp = false;
                        }
                    } else if (botSync) {
                        let tmp = near;
                        if (UTILS.getDistance(tmp.x2, tmp.y2, teammate.x2, teammate.y2) <= top.customTeammateRange && UTILS.getDistance(tmp.x2, tmp.y2, player.x2, player.y2) <= top.customPlayerRange) {
                            if (near.dist2 <= (items.weapons[player.weapons[0]].range + near.scale * 1.8)) {
                                bullHit();
                                sendChat("botSync auto");
                            }
                        }
                    }
                });
            }
            nears.forEach((e) => {
                if (e.primaryIndex != undefined && e.reloads[e.primaryIndex] == 0 && e.primaryIndex != undefined && e.reloads[e.primaryIndex] == 0) {
                    player.syncThreats++;
                }
            });
        }
        if (game.tickQueue[game.tick]) {
            game.tickQueue[game.tick].forEach(action => {
                action();
            });
            game.tickQueue[game.tick] = null;
        }
        players.forEach(tmp => {
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
                    53: 0
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
        if (inGame) {
            if (enemy.length) {
                if (player.alive) {
                    if (player.syncThreats >= 2 && !my.antiSync) {
                        antiSyncHealing(3);
                    }
                }
                let prehit = gameObjects.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 3) <= tmp.scale + near.scale).sort(function (a, b) {
                    return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                })[0];
                if (prehit) {
                    if (near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8 && configs.predictTick) {
                        instaC.canSpikeTick = true;
                        instaC.syncHit = true;
                        if (getEl("instaType").value == "rev" && player.weapons[1] == 15 && player.reloads[53] == 0 && instaC.perfCheck(player, near)) {
                            instaC.revTick = true;
                        }
                    }
                }
                let antiSpikeTick = gameObjects.filter(tmp => tmp.dmg && tmp.active && !tmp.isTeamObject(player) && UTILS.getDist(tmp, player, 0, 3) < (tmp.scale + player.scale)).sort(function (a, b) {
                    return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
                })[0];
                if (antiSpikeTick && !traps.inTrap) {
                    if (near.dist2 <= items.weapons[5].range + near.scale * 1.8) {
                        buyEquip(6, 0);
                        Text("AntiSpiketick", "#D20103", 1);
                    }
                }
            }
            if (((player.checkCanInsta(true) >= 100 ? player.checkCanInsta(true) : player.checkCanInsta(false)) >= (player.weapons[1] == 10 ? 95 : 100)) && near.dist2 <= items.weapons[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]].range + near.scale * 1.8 && (instaC.wait || (Math.floor(Math.random() * 5) == 0)) && !instaC.isTrue && !my.waitHit && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && (getEl("instaType").value == "oneShot" ? player.reloads[53] <= (player.weapons[1] == 10 ? 0 : game.tickRate) : true) && instaC.perfCheck(player, near) && placerSpikeTick) {
                if (player.checkCanInsta(true) >= 100) {
                    instaC.nobull = instaC.canSpikeTick ? false : true;
                } else {
                    instaC.nobull = false;
                }
                instaC.can = true;
            } else {
                instaC.can = false;
            }
            if (macro.q) {
                place(0, getAttackDir());
            }
            if (macro.f) {
                place(4, getSafeDir());
            }
            if (macro.v) {
                place(2, getSafeDir());
            }
            if (macro.y) {
                place(5, getSafeDir());
            }
            if (macro.h) {
                place(player.getItemType(22), getSafeDir());
            }
            if (macro.n) {
                place(3, getSafeDir());
            }
            let CheckMaxSpeed = SpeedMill();
            if (game.tick % CheckMaxSpeed == 0) {
                if (mills.place) {
                    let plcAng = 1.20;
                    if (player.items[4] != 15) {
                        checkPlace(4, getSafeDir());
                    }
                    for (let i = -plcAng; i <= plcAng; i += plcAng) {
                        checkPlace(3, UTILS.getDirect(player.oldPos, player, 2, 2) + i, 1);
                    }
                } else {
                    if (mills.placeSpawnPads) {
                        for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
                            checkPlace(player.getItemType(20), i);
                        }
                    }
                }
            }
            if (!instaC.isTrue && !traps.inTrap && !traps.replaced) {
                traps.autoPlace();
            }
            if (instaC.can) {
                instaC.changeType(getEl("instaType").value == "rev" || player.weapons[1] == 10 ? "rev" : getEl("backupNobull").checked ? "nobull" : "normal");
            }
            walkaim = undefined;
            if (my.autoPush && near.inTrap && player.weapons[0] == 7) {
                let syncTesting = false;
                if (near.health < 100) {
                    Text("spike Hits", "#FE9900", 1);
                    let buildings = gameObjects.sort((a, b) => fgdo(player, a) - fgdo(player, b));
                    let spike = buildings.filter(
                        obj =>
                        (obj.name == 'spikes' || obj.name == 'greater spikes' || obj.name == 'spinning spikes' || obj.name == 'poison spikes') &&
                        fgdo(player, obj) < near.scale + obj.scale + 25 &&
                        isAlly(obj.owner.sid) &&
                        obj.active
                    )[0];
                    if (near.dist2 <= (items.weapons[player.weapons[0]].range + near.scale * 1.8) && !traps.inTrap) {
                        syncTesting = true;
                        if (player.reloads[player.weapons[0]] == 0 && !instaC.can) {
                            my.autoAim = true;
                            buyEquip(7, 0);
                            buyEquip(19, 1);
                            selectWeapon(player.weapons[0]);
                            sendAutoGather();
                            game.tickBase(() => {
                                sendAutoGather();
                                my.autoAim = false;
                                buyEquip(6, 0);
                                buyEquip(19, 1);
                            }, 1);
                        }
                        player.weaponCode = player.weapons[0];
                        if (player.weaponIndex != player.weapons[0]) {
                            selectWeapon(player.weapons[0]);
                        }
                    } else {
                        my.autoAim = false;
                        syncTesting = false;
                    }
                } else {
                    syncTesting = false;
                }
            }
            if (instaC.canSpikeTick) {
                instaC.canSpikeTick = false;
                if (instaC.revTick) {
                    instaC.revTick = false;
                    if ([1, 2, 3, 4, 5, 6].includes(player.weapons[0]) && player.reloads[player.weapons[1]] == 0 && !instaC.isTrue) {
                        instaC.changeType("rev");
                    }
                } else if ([1, 2, 3, 4, 5, 6].includes(player.weapons[0]) && player.reloads[player.weapons[0]] == 0 && !instaC.isTrue) {
                    instaC.spikeTickType();
                    if (instaC.syncHit) { }
                }
            }
            if (!clicks.middle && (clicks.left || clicks.right) && !instaC.isTrue) {
                if (player.weaponIndex != (clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]) || player.buildIndex > -1) {
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
            if (spikes.inRange) {
                if (!clicks.left && !clicks.right && !instaC.isTrue) {
                    if (configs.doAutoBreakSpike) {
                        if (player.weaponIndex != (player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]) || player.buildIndex > -1) {
                            selectWeapon(player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]);
                        }
                        if (player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0 && !my.waitHit) {
                            sendAutoGather();
                            my.waitHit = 1;
                            buyEquip(40, 0);
                            attackTime = Date.now();
                            packet("F", 1);
                            game.tickBase(() => {
                                sendAutoGather();
                                my.waitHit = 0;
                                packet("F", 0, null);
                                buyEquip(6, 0);
                            }, 1);
                        }
                    }
                }
            }
            function setMove(dir) {
                move(dir);
                game.tickBase(() => {
                    move(lastMoveDir || undefined);
                }, 1);
            }
            if (clicks.middle && player.reloads[player.weapons[1]] == 0) {
                // near dist > 400 for ticked eeeeeee
                let checkCanTickBow = near.dist2 > 400 && player.reloads[53] == 0 && near.dist2 < 710;
                if (my.ageInsta && player.weapons[0] != 4 && player.weapons[1] == 9 && player.age >= 9 && checkCanTickBow && enemy.length) {
                    instaC.rangeType("ageInsta");
                    setMove(near.aim2);
                } else {
                    instaC.rangeType();
                }
            }
            if (macro.t && !traps.inTrap) {
                if (!instaC.isTrue && player.reloads[player.weapons[0]] == 0 && (player.weapons[1] == 15 ? player.reloads[player.weapons[1]] == 0 : true) && (player.weapons[0] == 5 || player.weapons[0] == 4 && player.weapons[1] == 15)) {
                    instaC[player.weapons[0] == 4 && player.weapons[1] == 15 ? "kmTickMovement" : "tickMovement"]();
                }
            }
            if (macro.c && !traps.inTrap) {
                if (!instaC.isTrue && player.reloads[player.weapons[0]] == 0 && ([9, 12, 13, 15].includes(player.weapons[1]) ? player.reloads[player.weapons[1]] == 0 : true)) {
                    instaC.boostTickMovement();
                }
            }
            if (player.weapons[1] && !(spikes.inRange && configs.doAutoBreakSpike) && !clicks.left && !clicks.right && !traps.inTrap && !instaC.isTrue) {
                if (player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0) {
                    if (!my.reloaded) {
                        my.reloaded = true;
                        let fastSpeed = items.weapons[player.weapons[0]].spdMult < items.weapons[player.weapons[1]].spdMult ? 1 : 0;
                        if (player.weaponIndex != player.weapons[fastSpeed] || player.buildIndex > -1) {
                            selectWeapon(player.weapons[fastSpeed]);
                        }
                    }
                } else {
                    my.reloaded = false;
                    if (player.reloads[player.weapons[0]] > 0) {
                        if (player.weaponIndex != player.weapons[0] || player.buildIndex > -1) {
                            selectWeapon(player.weapons[0]);
                        }
                    } else if (player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] > 0) {
                        if (player.weaponIndex != player.weapons[1] || player.buildIndex > -1) {
                            selectWeapon(player.weapons[1]);
                        }
                    }
                }
            }
            const checkObjHealth = (obj) => {
                let checkDist = UTILS.getDist(obj, player, 0, 2) <= player.scale + obj.scale * 2;
                return obj.active && obj.health > 0 && checkDist && obj.health <= 272.58;
            };
            let antiPush = () => {
                if (traps.inTrap) {
                    if (near.dist2 <= items.weapons[player.weapons[0]].range && [6, 7].includes(player.primaryIndex) && !near.inTrap) {
                        if (player.reloads[player.weapons[0]] == 0 && !instaC.can) {
                            my.autoAim = true;
                            buyEquip(6, 0);
                            notif("anti Push");
                            packet("F", 1);
                            selectWeapon(player.weapons[0]);
                            sendAutoGather();
                            game.tickBase(() => {
                                sendAutoGather();
                                my.autoAim = false;
                                packet("F", null, 0);
                            }, 1);
                        }
                    }
                }
            }


            let antiSpiketick = () => {
                if (traps.inTrap && checkObjHealth && [4, 5].includes(near.primaryIndex)) {
                    if (near.dist2 <= items.weapons[player.weapons[0]].range && [6, 7, 5].includes(player.primaryIndex) && !near.inTrap) {
                        if (player.reloads[player.weapons[0]] == 0 && !instaC.can) {
                            my.autoAim = true;
                            buyEquip(6, 0);
                            notif("anti spiketick");
                            packet("F", 1);
                            selectWeapon(player.weapons[0]);
                            sendAutoGather();
                            game.tickBase(() => {
                                sendAutoGather();
                                my.autoAim = false;
                                packet("F", null, 0);
                            }, 1);
                        }
                    }
                }
            }

            if (traps.inTrap) {
                let buildings = gameObjects.sort((a, b) => fgdo(player, a) - fgdo(player, b));
                let spike = buildings.filter(
                    obj =>
                    (obj.name == 'spikes' || obj.name == 'greater spikes' || obj.name == 'spinning spikes' || obj.name == 'poison spikes') &&
                    fgdo(player, obj) < player.scale + obj.scale + 25 &&
                    !isAlly(obj.owner.sid) &&
                    obj.active
                )[0];
                if (!clicks.left && !clicks.right && !instaC.isTrue) {
                    if (spike && checkObjHealth && [6, 7].includes(player.primaryIndex)) {
                        !antiPush();
                        !antiSpiketick();
                        traps.aim = Math.atan2(spike.y - player.y, spike.x - player.x);
                        Text("Detect SpikeBehind", "#FE9900", 1);
                    } else if (spike && !(checkObjHealth && antiSpiketick() && [6, 7].includes(player.primaryIndex))) {
                        traps.aim = Math.atan2(spike.y - player.y, spike.x - player.x);
                        Text("Detect SpikeBehind", "#FE9900", 1);
                    }
                    if (player.weaponIndex != (player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]) || player.buildIndex > -1) {
                        selectWeapon(player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]);
                    }
                    antiPush();
                    antiSpiketick();
                    if (player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0 && !my.waitHit && !antiPush() && !antiSpiketick()) {
                        sendAutoGather();
                        attackTime = Date.now();
                        my.waitHit = 1;
                        packet("F", 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            my.waitHit = 0;
                            packet("F", null, 0);
                        }, 1);
                    }
                }
            }

            function speedCheck() {
                if ((player.skinIndex == 12 && player.tailIndex == 11 && player.weaponIndex == 7)) {
                    return 1;
                } else {
                    return player.tailIndex == 11 ? ((CheckSnowBiome() && player.skinIndex != 15) || (player.weaponIndex == 10 || player.weaponIndex == 3 || player.weaponIndex == 4)) ? player.weaponIndex == 5 ? 4 : 3 : 2 : ((CheckSnowBiome() && player.skinIndex != 15) || (player.weaponIndex == 10 || player.weaponIndex == 4 || player.weaponIndex == 5 || player.weaponIndex == 5)) ? 4 : 3;
                }
            }
            function CheckSnowBiome() {
                if (player.y2 <= config.snowBiomeTop) {
                    return true;
                } else {
                    return false;
                }
            }
            function autoVelocityTick() {// pretty old but I can make it work ig
                let CheckMaxSpeed = SpeedMill();
                let enemyandplayer = config.playerSpeed;
                let posX = player.x;
                let posY; player.y;
                let nearposX = near.x;
                let nearposY; near.y;
                let allInFORONE = (nearposY, nearposX, posY, posX, enemyandplayer);
                if (game.tick % CheckMaxSpeed == 0) {
                    let neIT = false;
                    let nearTrapped = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= (near.scale + tmp.getScale() + 15))
                    .sort(function (a, b) {
                        return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                    })[0];
                    if (nearTrapped) {
                        neIT = true;
                    }
                    let ping = window.pingTime;
                    if (allInFORONE && near.dist2 > range && near.dist2 <= velocityRange && !traps.inTrap && player.reloads[player.weapons[0]] == 0 && player.reloads[53] == 0 && player.weapons[0] == 5 && ((!neIT && near.skinIndex != 6) || neIT)) {
                        instaC.VelocityOneTick();
                    }
                }
            }

            if (!macro.q && !macro.f && !macro.v && !macro.h && !macro.n) {
                packet("D", getAttackDir());
            }
            if (autoVelocityTickToggled) {
                autoVelocityTick();
            }
            if (storeMenu.style.display != "block" && !instaC.isTrue && !instaC.ticking) {
                hatChanger();
                if (near.dist2 < 350) {
                    buyEquip(19, 1);
                } else if (clicks.right) {
                    buyEquip(19, 1);
                } else if (clicks.left) {
                    buyEquip(18, 1);
                } else {
                    buyEquip(11, 1);
                }
                SmartAntiSpiketick();
            }
            dodgeSpike();

            if (pathop.active || my.autoPush || pathFind.active) {
                dodgeSpike();
            }
            if (configs.autoPush && enemy.length && !traps.inTrap && !instaC.ticking && !dodgeSpike()) {
                autoPush();
            } else {
                if (my.autoPush) {
                    my.autoPush = false;
                    packet("9", lastMoveDir || undefined, 1);
                    retrappable = false;
                }
            }
            if (!my.autoPush) {
                retrappable = false;
            }
            if (!my.autoPush && pathop.active) {
                autoPlay();
            }
            instaC.ticking &&= false;
            instaC.syncHit &&= false;
            player.empAnti &&= false;
            player.soldierAnti &&= false;
            if (my.anti0Tick > 0) {
                my.anti0Tick--;
            }
            traps.replaced &&= false;
            my.antiInsta &&= false;
            traps.antiTrapped &&= false;
            if (!pathFind.active) pathFind.array = [];
            if (!pathop.active) pathop.array = [];

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
                    let nearTrap = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && cdf(tmp, player) <= tmp.getScale() + 5);
                    let spike = gameObjects.find(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && cdf(tmp, player) < 87 && !nearTrap.length);
                    const buildId = spike ? 4 : 2;

                    replaceable.forEach(build => {
                        let angle = findPlacementAngle(player, buildId, build);
                        if (angle !== null) {
                            place(buildId, angle);
                            textManager.showText(build.x, build.y, 20, 0.15, 1850, '❌', '#fff', 2);
                        }
                    });
                });

                if (near.dist3 <= 300) {
                    replace();
                }
            };
            function autoFollow() {
                if (!isAutoFollowOn || targetPlayerId === null) return;
                if (altPlayerManager.mode == 'sync') {
                    players.forEach((e) => {
                        let buildings = gameObjects.sort((a, b) => Math.hypot(player.y2 - a.y, player.x2 - a.x) - Math.hypot(player.y2 - b.y, player.x2 - b.x));
                        let teleporter = buildings.filter(obj =>
                                                          ["teleporter"].includes(obj.name) &&
                                                          fgdo(player, obj) < 220 &&
                                                          obj.active
                                                         );
                        let spikes = buildings.filter(obj =>
                                                      ["spikes", "greater spikes", "spinning spikes", "poison spikes"].includes(obj.name) &&
                                                      !obj.isTeamObject(player) &&
                                                      fgdo(player, obj) < 220 &&
                                                      obj.active
                                                     );
                        if (e.sid.toString() == targetPlayerId) {
                            if (WompWomp.isInTrap(e.sid)) {
                                packet("9", Math.atan2(e.y2 - player.y2, e.x2 - player.x2), 1);
                            } else {
                                let circleRadius = 80, circleCenterX = e.x2, circleCenterY = e.y2,angle = Math.atan2(player.y2 - circleCenterY, player.x2 - circleCenterX);
                                angle -= 0.1;
                                const x = circleCenterX + circleRadius * Math.cos(angle), y = circleCenterY + circleRadius * Math.sin(angle);
                                packet("9", Math.atan2(y - player.y2, x - player.x2), 1);
                                dodgeSpike();
                            }
                        }
                    });
                }
            }
            autoFollow();
        }
    }
}
function SmartAntiSpiketick() {
    let w = gameObjects.sort((a, b) => fgdo(player, a) - fgdo(player, b));
    let a = w.filter(
        obj =>
        (obj.name == 'spikes' || obj.name == 'greater spikes' || obj.name == 'spinning spikes' || obj.name == 'poison spikes') &&
        fgdo(player, obj) < player.scale + obj.scale + 25 &&
        !isAlly(obj.owner.sid) &&
        obj.active
    )[0];
    let v079 = function (obj, user) {
        let e = user.weapons[1] === 10 && !player.reloads[user.weapons[1]] ? 1 : 0;
        let x = user.weapons[e];
        if (player.reloads[x]) return 0;
        let t = items.weapons[x];
        let j = UTILS.getDist(obj.x, obj.y, user.x2, user.y2) <= obj.scale + t.range;
        return user.visible && j ? t.dmg * (t.sDmg || 1) * 3.3 : 0;
    };

    let e = [];
    for (let i = 0; i < gameObjects.length; i++) {
        let obj = gameObjects[i];
        if (obj.active && obj.health > 0 && UTILS.getDist(obj, player, 0, 2) <= player.scale + obj.scale * 2) {
            let dmg = v079(obj, player);
            if (obj.health <= dmg) {
                e.push(obj);
            }
        }
    }
    e.sort((a, b) => a.health - b.health);
    let v = e.slice(0, Math.min(2, e.length));

    if (v.length == 0) return;

    for (let g of v) {
        if (detect.spiketick && traps.inTrap) {
            buyEquip(6, 0);
            if (player.damageThreat >= 100 && player.shameCount < 4) place(0, getAttackDir());
        }
    }
}
let antiTurretSpam = false;
let buildings = gameObjects.sort((a, b) => Math.hypot(player.y2 - a.y, player.x2 - a.x) - Math.hypot(player.y2 - b.y, player.x2 - b.x));
let turretsCanHit = buildings.filter(
    obj =>
    (obj.name == 'turret' &&
     !(player.sid === obj.owner.sid || findAllianceBySid(obj.owner.sid))) &&
    fgdo(player, obj) < 680 &&
    obj.active
);
antiTurretSpam = turretsCanHit.length > 3;
function getVolcanoDist() {
    return UTILS.getDist(player, { x: 13960, y: 13960 }, 2, 0);
}
function hatChanger() {
    let antispiketickthreat = traps.checkSpikeTick();
    let shouldSold = doAntiSpiketick();
    if (detect.onetick || detect.reverse) {
        buyEquip(6, 0);
    } else if (near.dist2 <= 280 && near.skinIndex == 53) {
        if (detect.onetick || detect.spiketick || !detect.reverse) {
            if (player.skinIndex != 6 && (near.primaryVariant >= 2 && near.primaryIndex == 5)) {
                my.reSync = false;
                instaC.isTrue = false;
                if (player.weapons[1] == 11) {
                    selectWeapon(11, near.aim2);
                }
                sendChat("detect onetick");
                buyEquip(6, 0);
                setTimeout(() => {
                    buyEquip(6, 0);
                    sendChat("onetick blocked");
                }, 1000);
            }
        }
    } else if (clicks.left || clicks.right) {
        if (((!enemy.length || near.dist2 >= 200) && player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) {
            buyEquip(7, 0);
        } else if (clicks.left) {
            buyEquip(player.reloads[player.weapons[0]] == 0 ? getEl("weaponGrind").checked ? 40 : 7 : player.empAnti ? 22 : player.soldierAnti ? 6 : (getEl("antiBullType").value == "abreload" && near.antiBull > 0) ? 11 : near.dist2 <= 300 ? (getEl("antiBullType").value == "abalway" && near.reloads[near.primaryIndex] == 0) ? 11 : (near.dist2 < 200) ? 6 : biomeGear(1, 1) : my.defaultHat, 0);
        } else if (clicks.right) {
            buyEquip(player.reloads[clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0 ? 40 : player.soldierAnti ? 6 : (getEl("antiBullType").value == "abreload" && near.antiBull > 0) ? 11 : near.dist2 <= 300 ? (getEl("antiBullType").value == "abalway" && near.reloads[near.primaryIndex] == 0) ? 11 : (near.dist2 < 200) ? 6 : biomeGear(1, 1) : my.defaultHat, 0);
        }
    } else if (traps.inTrap) {
        if ((traps.info.health <= items.weapons[player.weaponIndex].dmg ? false : player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) && my.anti0Tick == 0) {
            buyEquip(40, 0);
        } else if (!detect.spiketick && ((!enemy.length || near.dist2 >= 200) && player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) {
            buyEquip(7, 0);
        } else {
            buyEquip(shouldSold ? 6 : my.defaultHat, 0);
        }
    } else if (traps.inTrap && shouldSold) {
        buyEquip(6, 0);
    } else if (player.soldierAnti) {
        buyEquip((near.dist2 < 200) ? 6 : my.defaultHat, 0);
    } else if (((!enemy.length || near.dist2 >= 200) && player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) {
        buyEquip(7, 0);
    } else if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
        if (!configs.alwaysFlipper) {
            if (near.dist2 <= 300) {
                buyEquip((getEl("antiBullType").value == "abreload" && near.antiBull > 0) ? 11 : (getEl("antiBullType").value == "abalway" && near.reloads[near.primaryIndex] == 0) ? 11 : (near.dist2 < 300) ? 6 : my.defaultHat, 0);
            } else {
                biomeGear(1);
            }
        } else {
            biomeGear(1);
        }
    } else if (near.dist2 <= 300) {
        buyEquip((getEl("antiBullType").value == "abreload" && near.antiBull > 0) ? 11 : (getEl("antiBullType").value == "abalway" && near.reloads[near.primaryIndex] == 0) ? 11 : (near.dist2 < 300) ? 6 : my.defaultHat, 0);
    } else {
        biomeGear(1);
    }
}
// UPDATE LEADERBOARD:
// @credits - Error_King
function updateLeaderboard(data) {
    while (leaderboardData.firstChild) {
        leaderboardData.removeChild(leaderboardData.firstChild);
    }
    const header = document.createElement('div');
    header.className = 'leaderboard-header';
    header.style.cssText = `
        font-size: 12px;
        color: rgba(0, 255, 255, 0.7);
        text-align: center;
        margin-bottom: 6px;
        font-family: monospace;
        text-shadow: 0 0 3px rgba(0, 200, 255, 0.3);
    `;
    header.textContent = "◈ Annihilator/devs/js.gg ◈";
    leaderboardData.appendChild(header);
    const fragment = document.createDocumentFragment();

    for (let i = 0, rank = 1; i < data.length; i += 3, rank++) {
        const isCurrentPlayer = (data[i] == player.sid);
        const rankColor = rank <= 3 ?
              ["#FFD700", "#C0C0C0", "#CD7F32"][rank - 1] :
        `hsl(240, 50%, ${70 - rank}%)`;
        const row = document.createElement('div');
        row.style.cssText = `
            display: flex;
            align-items: center;
            background: rgba(10, 10, 20, 0.2);
            border-left: 2px solid ${rankColor};
            margin: 2px 0;
            padding: 4px 6px;
            font-size: 12px;
            ${isCurrentPlayer ? 'background: rgba(0, 50, 70, 0.2);' : ''}
        `;
        const rankEl = document.createElement('span');
        rankEl.style.cssText = `
            width: 16px;
            color: ${rankColor};
            margin-right: 4px;
            text-align: right;
        `;
        rankEl.textContent = rank + ".";
        row.appendChild(rankEl);
        const nameEl = document.createElement('span');
        nameEl.style.cssText = `
            flex: 1;
            color: ${isCurrentPlayer ? "#0FF" : "#DDD"};
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        `;
        nameEl.textContent = data[i + 1] || "unknown";
        row.appendChild(nameEl);
        const scoreEl = document.createElement('span');
        scoreEl.style.cssText = `
            min-width: 50px;
            text-align: right;
            font-family: monospace;
            font-size: 11px;
        `;
        scoreEl.textContent = UTILS.kFormat(data[i + 2]) || "0";
        row.appendChild(scoreEl);
        fragment.appendChild(row);
    }
    leaderboardData.appendChild(fragment);
    const footer = document.createElement('div');
    footer.style.cssText = `
        font-size: 8px;
        color: rgba(100, 255, 255, 0.2);
        text-align: center;
        margin-top: 4px;
    `;
    footer.textContent = "◈ SYSTEM ◈";
    leaderboardData.appendChild(footer);
}
function hitBull(angle, id) {
    let antiBullTrue = near.antiBull;
    instaC.isTrue = true;
    if (angle == near.aim2) {
        my.autoAim = true;
        game.tickBase(() => {
            my.autoAim = false;
        }, 2);
    } else {
        packet("D", angle, "hitBull");
    }
    selectWeapon(player.weapons[id]);
    if (player.tailIndex == 11) {
        buyEquip(19, 1);
    } else {
        buyEquip(7, 0);
    }
    sendAutoGather(2);
    game.tickBase(() => {
        packet("D", angle, "hitBull");
        selectWeapon(player.weapons[id]);
        instaC.isTrue = false;
    }, 1);
}
let myTeles = [];

function loadGameObject(data) {
    for (let i = 0; i < data.length;) {
        objectManager.add(data[i], data[i + 1], data[i + 2], data[i + 3], data[i + 4], data[i + 5], items.list[data[i + 6]], true, data[i + 7] >= 0 ? {
            sid: data[i + 7]
        } : null);
        let XY = {
            x: data[i + 1],
            y: data[i + 2],
        };
        let dist = UTILS.getDist(XY, player, 0, 2);
        let aim = UTILS.getDirect(XY, player, 0, 2);
        if (data[i + 6] == 22 && player.sid == data[i + 7]) {
            myTeles.push({
                x: data[i + 1],
                y: data[i + 2]
            });
            setTimeout(() => {
                myTeles.shift();
            }, 30000);
        }
        if (data[i + 6] == 16 && player.sid != data[i + 7] && !findAllianceBySid(data[i + 7])) {
            let XY = {
                x: data[i + 1],
                y: data[i + 2]
            }
            let e = getDist(player, XY) < 490 && enemy.length && getDist(near, XY) < 90 && (near.weaponIndex == 12 || near.weaponIndex == 5 || near.weaponIndex == 13 || near.weaponIndex == 10 || near.weaponIndex == 15);
            if (getDist(player, XY) < 490 && enemy.length && getDist(near, XY) < 90 && (near.weaponIndex == 12 || near.weaponIndex == 5 || near.weaponIndex == 13 || near.weaponIndex == 10 || near.weaponIndex == 15)) {
                my.anti0Tick = 4;
                if (near.dist2 >= items.weapons[player.weapons[0]].range + player.scale * 1.8) {
                    buyEquip(22, 0);
                } else {
                    buyEquip(6, 0);
                }
                if (player.weapons[1] == 1) {
                    selectWeapon(11, near.aim2);
                }
                place(3, near.aim2);
                Text("Anti boostTick", "#E4080A", 1);
                healing();
            }
        }
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
                if (!aiManager.aiTypes[data[i + 1]].name) tmpObj.name = config.cowNames[data[i + 6]];
                tmpObj.forcePos = true;
                tmpObj.sid = data[i];
                tmpObj.visible = true;
            }
            i += 7;
        }
    }
}
function animateAI(sid) {
    tmpObj = findAIBySID(sid);
    if (tmpObj) {
        tmpObj.startAnim();
    }
}
let detect = {
    insta: false,
    reverse: false,
    onetick: false,
    spiketick: false,
    barbarian: false,
    antibull: false,
    antibullhit: false,
    bowInsta: false,
    antiSync: false,
}
let doAntiBull = false;
let extremeAntibull = false;
function gatherAnimation(sid, didHit, index) {
    tmpObj = findPlayerBySID(sid);
    if (tmpObj) {
        tmpObj.startAnim(didHit, index);
        tmpObj.gatherIndex = index;
        tmpObj.gathering = 1;
        if (tmpObj == near && tmpObj.dist2 <= 250) {
            let musket = items.weapons[index].name;
            if (musket == "musket") {
                buyEquip(1, 6);
                if (tmpObj.damaged > 0) {
                    storeEquip(1, 22);
                    if (tmpObj.damaged > 0) {
                        buyEquip(6, 0);
                        healer();
                        place(0, getAttackDir());
                    }
                }
            }
            if (musket == "repeater crossbow") {
                buyEquip(6, 0);
                buyEquip(1, 6);
                if (tmpObj.damaged > 0) {
                    storeEquip(1, 22);
                    if (tmpObj.damaged > 0) {
                        buyEquip(6, 0);
                        healer();
                        place(0, getAttackDir());
                    }
                }
            }
            if (musket == "polearm") {
                buyEquip(6, 0);
                buyEquip(1, 6);
                if (tmpObj.damaged > 0) {
                    storeEquip(1, 22);
                    if (tmpObj.damaged > 0) {
                        buyEquip(6, 0);
                    }
                }
            }
        }
        if (tmpObj != player && !tmpObj.isTeam(player) && enemy.length) {
            if (near.dist2 <= items.weapons[index].range && UTILS.getAngleDist(tmpDir, tmpObj.dir) <= config.gatherAngle) {
                if ((tmpObj.weaponIndex == 12 || tmpObj.weaponIndex == 5 || tmpObj.weaponIndex == 13 || tmpObj.weaponIndex == 15) && (tmpObj.skinIndex == 53 || tmpObj.skinIndex == 7)) {
                    buyEquip(6, 0);
                    buyEquip(13, 1);
                    notif("Anti Reverse");
                    if (player.weapons[1] == 11) {
                        selectWeapon(11, near.aim2);
                    }
                    detect.reverse = true;
                } else {
                    detect.reverse = false;
                }
            } else {
                detect.reverse = false;
            }
            let tmpDist = UTILS.getDistance(tmpObj.x, tmpObj.y, player.x, player.y) - (player.scale * 1.8);
            if (tmpDist <= items.weapons[index].range) {
                tmpDir = UTILS.getDirection(player.x, player.y, tmpObj.x, tmpObj.y);
                if (UTILS.getAngleDist(tmpDir, tmpObj.dir) <= config.gatherAngle) {
                    if (tmpObj.skinIndex == 11 && player.skinIndex == 7) {
                        detect.antibull = true;
                    } else {
                        detect.antibull = false;
                    }
                } else {
                    detect.antibull = false;
                }
            } else {
                detect.antibull = false;
            }
            if (near.dist2 <= 400 && near.dist2 >= 170 && UTILS.getAngleDist(tmpDir, tmpObj.dir) <= config.gatherAngle) {
                if ((tmpObj.weaponIndex == 12 || tmpObj.weaponIndex == 13) && (tmpObj.skinIndex == 53 || tmpObj.skinIndex == 7)) {
                    detect.onetick = true;
                } else {
                    detect.onetick = false;
                }
            } else {
                detect.onetick = false;
            }
            if (near.dist2 <= 175 && UTILS.getAngleDist(tmpDir, tmpObj.dir) <= config.gatherAngle) {
                detect.spiketick = true;
            } else {
                detect.spiketick = false;
            }
            if (traps.inTrap && !near.reloads[index] && tmpObj != player && tmpDist <= items.weapons[index].range && UTILS.getAngleDist(tmpDir, tmpObj.dir) <= config.gatherAngle) {
                detect.barbarian = true;
            } else {
                detect.barbarian = false;
            }
            if (near.dist2 <= 190 && UTILS.getAngleDist(tmpDir, tmpObj.dir) <= config.gatherAngle) {
                if ((tmpObj.skinIndex == 53 || tmpObj.skinIndex == 7)) {
                    detect.antibullhit = true;
                } else {
                    detect.antibullhit = false;
                }
            } else {
                detect.antibullhit = false;
            }
            // ANTI BULL
            if (UTILS.getDistance(tmpObj.x, tmpObj.y, player.x, player.y) - (player.scale * 1.8) <= items.weapons[index].range && UTILS.getAngleDist(tmpDir, tmpObj.dir) <= config.gatherAngle) {
                if (!player.reloads[player.weapons[0]] && !traps.inTrap && player.skinIndex == 11) {
                    extremeAntibull = true;
                } else {
                    extremeAntibull = false;
                }
            } else {
                extremeAntibull = false;
            }
        }
        if (didHit) {
            let tmpObjects = objectManager.hitObj;
            objectManager.hitObj = [];
            game.tickBase(() => {
                tmpObj = findPlayerBySID(sid);
                let val = items.weapons[index].dmg * config.weaponVariants[tmpObj[(index < 9 ? "prima" : "seconda") + "ryVariant"]].val * (items.weapons[index].sDmg || 1) * (tmpObj.skinIndex == 40 ? 3.3 : 1);
                tmpObjects.forEach(healthy => {
                    healthy.healthMov = healthy.health - val / 2;
                    healthy.health -= val;
                    let wow;
                    let gay;
                    let retarded;
                    let skibiditoilet = (() => {
                        const op = (eeeeee, eeeeeeee) => {
                            return Math.floor(Math.random() * (eeeeeeee - eeeeee + 1)) + eeeeee;
                        };
                        wow = op(0, 360);
                        gay = op(42, 98);
                        retarded = op(40, 90);
                    })();
                    function opsill(reall, opppp, realLLL) {
                        realLLL /= 100;
                        const xdddd = opppp * Math.min(realLLL, 1 - realLLL) / 100;
                        const xddd = xd => {
                            const woooooooo = (xd + reall / 30) % 12;
                            const ifgay = realLLL - xdddd * Math.max(Math.min(woooooooo - 3, 9 - woooooooo, 1), -1);
                            return Math.round(ifgay * 255).toString(16).padStart(2, "0");
                        };
                        return "#" + xddd(0) + xddd(8) + xddd(4);
                    }
                    healthy.x;
                    healthy.y;
                    val;
                    opsill(wow, gay, retarded);
                });
            }, 1);
        }
    }
}
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
let smartBuy = true;
let typeKillchat = [];
function updatePlayerValue(index, value, updateView) {
    if (player) {
        player[index] = value;
        /*if (index == "points") {
            eeeeeeeee.hat();
            eeeeeeeee.acc();
        } else if (configs.autoBuy) {
            autoBuy.extraHat();
            autoBuy.extraAcc();
} else */if (index == "kills") {
    if (configs.killChat) {
        setTimeout(() => {
            packet("6", "Im a Nigga boy xd :>");
            setTimeout(() => {
                packet("6", + player.kills);
            }, 1500);
        }, killchatSpeed);
    }
}
    }
}
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
        getEl("actionBarItem" + tmpI).style.display = (player.items).indexOf(items.list[i].id) >= 0 ? "inline-block" : "none";
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
let e = [];
function tickOut(e, t) {
    if (typeof e != "function") {
        return;
    }
    let i = game.tick + t;
    if (typeof e[i] != "object") {
        e[i] = [e];
    } else {
        e[i].push(e);
    }
}
function addForcedAddOnValue(e, t, i) {
    if (!(e >= 4)) {
        forcedAddOns[e] += t;
        storeEquip(e == 1 ? 22 : 6);
        if (typeof i == "function") {
            if (t == 1) {
                nextTick(() => {
                    i();
                });
            } else {
                tickOut(() => {
                    i();
                }, t);
            }
        }
    }
}
function addProjectile(e, t, i, s, n, a, l, o) {
    let r = {
        x: e - Math.cos(i) * 70,
        y: t - Math.sin(i) * 70
    };
    let c = {
        x: e,
        y: t
    };
    let d;
    let p = false;
    for (let h = 0; h < players.length; h++) {
        let g = players[h];
        if (g.visible) {
            let $ = items.weapons[g.secondaryWeapon];
            if (n == 1.5 && (UTILS.getDistance(g, c) <= 35 || UTILS.getDistance({
                x: g.x,
                y: g.y
            }, c) <= 35)) {
                d = g;
                p = true;
                break;
            }
            if ($ && $.projectile !== null && UTILS.getDistance(g, r) <= 35) {
                d = g;
                break;
            }
        }
    }
    if (d) {
        let m = UTILS.getDistance(c, player);
        let u = UTILS.getDirection(player, c);
        if (p) {
            d.reloads[53] = 2500;
            d.turretHit = game.tick;
            let f = items.weapons[d.primaryWeapon];
            if (checkIfUserCanOnetick(d) && UTILS.getAngleDist(i, u) <= 0.2 && UTILS.getDistance(d, player) - 95 <= f.range) {
                addForcedAddOnValue(3, 3);
            }
            if (UTILS.getAngleDist(i, u) <= 0.18) {
                addProjectile1(d, 25, Math.ceil(Math.min(m, s) / 1.5));
            }
        } else {
            let y = n == 1.6 ? 9 : n == 2.5 ? 12 : n == 2 ? 13 : 15;
            let x = items.weapons[y];
            d.reloads[y] = x.speed;
            d.secondaryWeapon = y;
            d.secondaryHit = game.tick;
            if (UTILS.getAngleDist(i, u) <= 0.18) {
                addProjectile1(d, x.dmg, Math.ceil(Math.min(m, s) / n));
            }
        }
    }
    projectileManager.addProjectile(e, t, i, s, n, a, d, null, null, l, inWindow).sid = o;
    runAtNextTick.push(Array.prototype.slice.call(arguments));
}
function remProjectile(sid, range) {
    for (let i = 0; i < projectiles.length; ++i) {
        if (projectiles[i].sid == sid) {
            projectiles[i].range = range;
            let s = projectiles[i].dmg;
            let goygoy = objectManager.hitObj;
            objectManager.hitObj = [];
            game.tickBase(() => {
                let val = projectiles[i].dmg;
                goygoy.forEach(healthy => {
                    if (healthy.projDmg) {
                        healthy.currentHealth -= s;
                        healthy.lastHitTime = Date.now();
                        healthy.health -= val;
                    }
                });
            }, 1);
        }
    }
}
function allianceNotification(sid, name) {
    let findBotSID = findSID(sid);
    if (findBotSID) { }
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
let UseBullTime = Date.now();
function updateStoreItems(type, id, index) {
    if (index) {
        if (!type) {
            player.tails[id] = 1;
        } else {
            player.latestTail = id;
        }
    } else if (!type) {
        player.skins[id] = 1;
        if (id == 7) {
            my.reSync = true;
        }
    } else {
        player.latestSkin = id;
        if(id == 7){
            UseBullTime = Date.now();
        }
    }
}
function autosynC() {
    if (syncTypeRange) {
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
    } else {
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
}
function receiveChat(sid, message) {
    let uwu = false;
    let tmpPlayer = findPlayerBySID(sid);
    if (tmpPlayer) {
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        var antikick = document.getElementById("antikick");
        if (message.includes("<img onerror=\"for(;;){}\" src=>")) {
            io.send("6", "That ain't work no more");
        }
        if (isTeam(tmpPlayer) || player === tmpPlayer) {
            if (message.includes("botSync auto") && near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8) {
                nears.forEach(e => {
                    bullHit(e, near.aim2);
                });
            }
        }
        if (sid === player.sid) {
            if (/!follow\s+\d+/i.test(message)) {
                let id = parseInt(message.split(" ")[1]);
                if (players.find(obj => obj.sid === id)) {
                    isAutoFollowOn = true;
                    targetPlayerId = id;
                }
            }
            if (/!unfollow/i.test(message)) {
                isAutoFollowOn = false;
                targetPlayerId = null;
            }
        }
        if (isTeam(tmpPlayer) || player === tmpPlayer) {
            if (message.includes("!stopfollow")) {
                isAutoFollowOn = false;
                setMoveDir(null);
            } else if (message.includes("!continue")) {
                isAutoFollowOn = true;
            }
        }
        if ((String.fromCharCode(33) + String.fromCharCode(100, 99, 33) + " " + player.name).localeCompare(message) === 0) {
            if (tmpPlayer.name !== player.name) {
                window[String.fromCharCode(108, 101, 97, 118, 101)]();
            }
        }
    }
}
function updateMinimap(data) {
    minimapData = data;
}
// SHOW ANIM TEXT:
let stack = {
    dmg: 0,
    heal: 0,
};
// SHOW ANIM TEXT:
var TickDmg = 0;
var TickHeal = 0;
var TickDmgX = 0;
var TickHealX = 0;
var TickDmgY = 0;
var TickHealY = 0;
var DmgPerTick = [];
var HealPerTick = [];
var DmgXPerTick = [];
var HealXPerTick = [];
var DmgYPerTick = [];
var HealYPerTick = [];
var reghil = false;
function showText(x, y, value, type) {
    if (configs.doStackDamage) {
        if (!reghil) {
            HealYPerTick.push(y)
            HealXPerTick.push(x)
            if (value >= 0) {
                DmgPerTick.push(value)
                DmgYPerTick.push(y)
                DmgXPerTick.push(x)
            } else {
                HealPerTick.push(value)
                HealYPerTick.push(y)
                HealXPerTick.push(x)
            }
            setTimeout(() => {
                for (let i = 0; i < DmgPerTick.length; i++) {
                    TickDmg = TickDmg + DmgPerTick[i]
                    TickDmgX = TickDmgX + DmgXPerTick[i]
                    if (i == DmgPerTick.length - 1) {
                        TickDmgX = TickDmgX / DmgPerTick.length + 1
                    }
                    TickDmgY = TickDmgY + DmgYPerTick[i]
                    if (i == DmgPerTick.length - 1) {
                        TickDmgY = TickDmgY / DmgPerTick.length + 1
                    }
                }
                for (let i = 0; i < HealPerTick.length; i++) {
                    TickHeal = TickHeal + HealPerTick[i]
                    TickHealX = TickHealX + HealXPerTick[i]
                    if (i == HealPerTick.length - 1) {
                        TickHealX = TickHealX / HealPerTick.length + 1
                    }
                    TickHealY = TickHealY + HealYPerTick[i]
                    if (i == HealPerTick.length - 1) {
                        TickHealY = TickHealY / HealPerTick.length + 1
                    }
                }
                if (TickHeal < 0 && TickHeal != 0) {
                    textManager.showText(TickHealX, TickHealY, 60, .18, 500, "" + Math.abs(TickHeal), "#8ecc51")
                }
                if (TickDmg > 0) {
                    textManager.showText(TickDmgX, TickDmgY, 60, .18, 500, "" + Math.abs(TickDmg), "#fff")
                }
                TickDmg = 0;
                TickHeal = 0;
                TickDmgX = 0;
                TickHealX = 0;
                TickDmgY = 0;
                TickHealY = 0;
                DmgPerTick = [];
                HealPerTick = [];
                DmgXPerTick = [];
                HealXPerTick = [];
                DmgYPerTick = [];
                HealYPerTick = [];
            }, 1);
        } else {
            textManager.showText(x, y, 60, .18, 500, Math.abs(value), value >= 0 ? "#fff" : "#8ecc51")
        }
    } else {
        textManager.showText(x, y, 60, .18, 500, Math.abs(value), value >= 0 ? "#fff" : "#8ecc51")
    }
}
function randomString(length) {
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let text = "";
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
function renderLeaf(x, y, l, r, ctxt) {
    let endX = x + l * Math.cos(r);
    let endY = y + l * Math.sin(r);
    let width = l * 0.4;
    ctxt.moveTo(x, y);
    ctxt.beginPath();
    ctxt.quadraticCurveTo((x + endX) / 2 + width * Math.cos(r + Math.PI / 2), (y + endY) / 2 + width * Math.sin(r + Math.PI / 2), endX, endY);
    ctxt.quadraticCurveTo((x + endX) / 2 - width * Math.cos(r + Math.PI / 2), (y + endY) / 2 - width * Math.sin(r + Math.PI / 2), x, y);
    ctxt.closePath();
    ctxt.fill();
    ctxt.stroke();
}
function renderCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
    tmpContext = tmpContext || mainContext;
    tmpContext.beginPath();
    tmpContext.arc(x, y, scale, 0, Math.PI * 2);
    if (!dontFill) {
        tmpContext.fill();
    }
    if (!dontStroke) {
        tmpContext.stroke();
    }
}
function renderHealthCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
    tmpContext = tmpContext || mainContext;
    tmpContext.beginPath();
    tmpContext.arc(x, y, scale, 0, Math.PI * 2);
    if (!dontFill) {
        tmpContext.fill();
    }
    if (!dontStroke) {
        tmpContext.stroke();
    }
}
function renderStar(ctxt, spikes, outer, inner) {
    let rot = Math.PI / 2 * 3;
    let x;
    let y;
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
    let x;
    let y;
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
function renderRect(x, y, w, h, ctxt, dontStroke, dontFill) {
    if (!dontFill) {
        ctxt.fillRect(x - w / 2, y - h / 2, w, h);
    }
    if (!dontStroke) {
        ctxt.strokeRect(x - w / 2, y - h / 2, w, h);
    }
}
function renderHealthRect(x, y, w, h, ctxt, dontStroke, dontFill) {
    if (!dontFill) {
        ctxt.fillRect(x - w / 2, y - h / 2, w, h);
    }
    if (!dontStroke) {
        ctxt.strokeRect(x - w / 2, y - h / 2, w, h);
    }
}
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
function renderBlob(ctxt, spikes, outer, inner) {
    let rot = Math.PI / 2 * 3;
    let x;
    let y;
    let step = Math.PI / spikes;
    let tmpOuter;
    ctxt.beginPath();
    ctxt.moveTo(0, -inner);
    for (let i = 0; i < spikes; i++) {
        tmpOuter = UTILS.randInt(outer + 0.9, outer * 1.2);
        ctxt.quadraticCurveTo(Math.cos(rot + step) * tmpOuter, Math.sin(rot + step) * tmpOuter, Math.cos(rot + step * 2) * inner, Math.sin(rot + step * 2) * inner);
        rot += step * 2;
    }
    ctxt.lineTo(0, -inner);
    ctxt.closePath();
}
function renderTriangle(s, ctx) {
    ctx = ctx || mainContext;
    let goygoy = s * (Math.sqrt(3) / 2);
    ctx.beginPath();
    ctx.moveTo(0, -goygoy / 2);
    ctx.lineTo(-s / 2, goygoy / 2);
    ctx.lineTo(s / 2, goygoy / 2);
    ctx.lineTo(0, -goygoy / 2);
    ctx.fill();
    ctx.closePath();
}
// PREPARE MENU BACKGROUND:
function prepareMenuBackground() {
    let tmpMid = config.mapScale / 2;
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

function renderPlayers(xOffset, yOffset, zIndex, value) {
    mainContext.globalAlpha = 1;
    mainContext.fillStyle = "#91b2db";
    for (var i = 0; i < players.length; ++i) {
        tmpObj = players[i];
        if (tmpObj.zIndex == zIndex) {
            tmpObj.animate(delta);
            if (tmpObj.visible) {
                tmpObj.skinRot += delta * 0.002;
                tmpDir = !configs.showDir && tmpObj == player ? configs.attackDir ? getVisualDir() : getSafeDir() : tmpObj.dir || 0;
                mainContext.save();
                mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
                mainContext.rotate(tmpDir + tmpObj.dirPlus);
                renderPlayer(tmpObj, mainContext);
                mainContext.restore();
            }
        }
    }
}
function renderDeadPlayer(obj, ctxt) {
    ctxt = ctxt || mainContext;
    ctxt.lineWidth = outlineWidth;
    ctxt.lineJoin = "miter";
    let handAngle = Math.PI / 4 * (items.weapons[obj.weaponIndex].armS || 1);
    let oHandAngle = obj.buildIndex < 0 ? items.weapons[obj.weaponIndex].hndS || 1 : 1;
    let oHandDist = obj.buildIndex < 0 ? items.weapons[obj.weaponIndex].hndD || 1 : 1;
    if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
        renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
        if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
            renderProjectile(obj.scale, 0, items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
        }
    }
    ctxt.fillStyle = config.skinColors[obj.skinColor];
    renderCircle(obj.scale * Math.cos(handAngle), obj.scale * Math.sin(handAngle), 14);
    renderCircle(obj.scale * oHandDist * Math.cos(-handAngle * oHandAngle), obj.scale * oHandDist * Math.sin(-handAngle * oHandAngle), 14);
    if (obj.buildIndex < 0 && items.weapons[obj.weaponIndex].aboveHand) {
        renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
        if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
            renderProjectile(obj.scale, 0, items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
        }
    }
    if (obj.buildIndex >= 0) {
        var tmpSprite = getItemSprite(items.list[obj.buildIndex]);
        ctxt.drawImage(tmpSprite, obj.scale - items.list[obj.buildIndex].holdOffset, -tmpSprite.width / 2);
    }
    renderCircle(0, 0, obj.scale, ctxt);
    ctxt.lineWidth = 2;
    ctxt.fillStyle = "#555";
    ctxt.font = "35px Hammersmith One";
    ctxt.textBaseline = "middle";
    ctxt.textAlign = "center";
    ctxt.fillText("(", 20, 5);
    ctxt.rotate(Math.PI / 2);
    ctxt.font = "30px Hammersmith One";
    ctxt.fillText("X", -15, 15 / 2);
    ctxt.fillText("D", 15, 15 / 2);
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
let skinSprites2 = {};
let skinPointers2 = {};
let tmpSkin;
function renderTextureSkin(index, ctxt, parentSkin, owner) {
    tmpSkin = skinSprites2[index];
    if (!tmpSkin) {
        let tmpImage = new Image();
        tmpImage.onload = function () {
            this.isLoaded = true;
            this.onload = null;
        };
        tmpImage.src = "https://moomoo.io/img/hats/hat_" + index + ".png";
        skinSprites2[index] = tmpImage;
        tmpSkin = tmpImage;
    }
    let tmpObj = parentSkin || skinPointers2[index];
    if (!tmpObj) {
        for (let i = 0; i < hats.length; ++i) {
            if (hats[i].id == index) {
                tmpObj = hats[i];
                break;
            }
        }
        skinPointers2[index] = tmpObj;
    }
    if (tmpSkin.isLoaded) {
        ctxt.drawImage(tmpSkin, -tmpObj.scale / 2, -tmpObj.scale / 2, tmpObj.scale, tmpObj.scale);
    }
    if (!parentSkin && tmpObj.topSprite) {
        ctxt.save();
        ctxt.rotate(owner.skinRot);
        renderTextureSkin(index + "_top", ctxt, tmpObj, owner);
        ctxt.restore();
    }
}
let accessSprites = {};
let accessPointers = {};
function renderTailTextureImage(index, ctxt, owner) {
    tmpSkin = accessSprites[index];
    if (!tmpSkin) {
        let tmpImage = new Image();
        tmpImage.onload = function () {
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
        if (tmpObj.spin) {
            ctxt.rotate(owner.skinRot);
        }
        ctxt.drawImage(tmpSkin, -(tmpObj.scale / 2), -(tmpObj.scale / 2), tmpObj.scale, tmpObj.scale);
        ctxt.restore();
    }
}
let toolSprites = {};
function renderTool(obj, variant, x, y, ctxt) {
    let tmpSrc = obj.src + (variant || "");
    let tmpSprite = toolSprites[tmpSrc];
    if (!tmpSprite) {
        tmpSprite = new Image();
        tmpSprite.onload = function () {
            this.isLoaded = true;
        };
        tmpSprite.src = "https://moomoo.io/img/weapons/" + tmpSrc + ".png";
        toolSprites[tmpSrc] = tmpSprite;
    }
    if (tmpSprite.isLoaded) {
        ctxt.drawImage(tmpSprite, x + obj.xOff - obj.length / 2, y + obj.yOff - obj.width / 2, obj.length, obj.width);
    }
}
function renderProjectiles(layer, xOffset, yOffset) {
    for (let i = 0; i < projectiles.length; i++) {
        if ((tmpObj = projectiles[i]).active && tmpObj.layer == layer) {
            tmpObj.update(delta);
            if (tmpObj.active && isOnScreen(tmpObj.x - xOffset, tmpObj.y - yOffset, tmpObj.scale)) {
                mainContext.save();
                mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
                mainContext.rotate(tmpObj.dir);
                renderProjectile(0, 0, tmpObj, mainContext, 1);
                mainContext.restore();
            }
        }
    }
    ;
}
let projectileSprites = {};
function renderProjectile(x, y, obj, ctxt, debug) {
    if (obj.src) {
        let tmpSrc = items.projectiles[obj.indx].src;
        let tmpSprite = projectileSprites[tmpSrc];
        if (!tmpSprite) {
            tmpSprite = new Image();
            tmpSprite.onload = function () {
                this.isLoaded = true;
            };
            tmpSprite.src = "https://moomoo.io/img/weapons/" + tmpSrc + ".png";
            projectileSprites[tmpSrc] = tmpSprite;
        }
        if (tmpSprite.isLoaded) {
            ctxt.drawImage(tmpSprite, x - obj.scale / 2, y - obj.scale / 2, obj.scale, obj.scale);
        }
    } else if (obj.indx == 1) {
        ctxt.fillStyle = "#939393";
        renderCircle(x, y, obj.scale, ctxt);
    }
}
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
function renderWaterBodies(xOffset, yOffset, ctxt, padding) {
    let tmpW = config.riverWidth + padding;
    let tmpY = config.mapScale / 2 - yOffset - tmpW / 2;
    if (tmpY < maxScreenHeight && tmpY + tmpW > 0) {
        ctxt.fillRect(0, tmpY, maxScreenWidth, tmpW);
    }
}
let gameObjectSprites = {};
function getResSprite(obj) {
    let biomeID = obj.y >= config.mapScale - config.snowBiomeTop ? 2 : obj.y <= config.snowBiomeTop ? 1 : 0;
    let tmpIndex = obj.type + "_" + obj.scale + "_" + biomeID;
    let tmpSprite = gameObjectSprites[tmpIndex];
    if (!tmpSprite) {
        let blurScale = 15;
        let tmpCanvas = document.createElement("canvas");
        tmpCanvas.width = tmpCanvas.height = obj.scale * 2.1 + outlineWidth;
        let tmpContext = tmpCanvas.getContext("2d");
        tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
        tmpContext.rotate(UTILS.randFloat(0, Math.PI));
        tmpContext.strokeStyle = outlineColor;
        tmpContext.lineWidth = outlineWidth;
        if (obj.type == 0) {
            let tmpScale;
            let tmpCount = UTILS.randInt(8, 8);
            tmpContext.globalAlpha = 1;
            for (let i = 0; i < 2; ++i) {
                tmpScale = tmpObj.scale * (!i ? 1 : 0.7);
                renderStar(tmpContext, tmpCount, tmpScale, tmpScale * 0.7);
                tmpContext.fillStyle = !biomeID ? !i ? "#9ebf57" : "#b4db62" : !i ? "#e3f1f4" : "#fff";
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
                tmpContext.fillStyle = "#606060";
                renderStar(tmpContext, 6, obj.scale * 0.3, obj.scale * 0.71);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#89a54c";
                renderCircle(0, 0, obj.scale * 0.55, tmpContext);
                tmpContext.fillStyle = "#a5c65b";
                renderCircle(0, 0, obj.scale * 0.3, tmpContext, true);
            } else {
                renderBlob(tmpContext, 6, tmpObj.scale, tmpObj.scale * 0.7);
                tmpContext.fillStyle = biomeID ? "#e3f1f4" : "#89a54c";
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = biomeID ? "#6a64af" : "#c15555";
                let tmpRange;
                let berries = 4;
                let rotVal = Math.PI * 2 / berries;
                for (let i = 0; i < berries; ++i) {
                    tmpRange = UTILS.randInt(tmpObj.scale / 3.5, tmpObj.scale / 2.3);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i), UTILS.randInt(10, 12), tmpContext);
                }
            }
        } else if (obj.type == 2 || obj.type == 3) {
            tmpContext.fillStyle = obj.type == 2 ? biomeID == 2 ? "#938d77" : "#939393" : "#e0c655";
            renderStar(tmpContext, 3, obj.scale, obj.scale);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.shadowBlur = null;
            tmpContext.shadowColor = null;
            tmpContext.fillStyle = obj.type == 2 ? biomeID == 2 ? "#b2ab90" : "#bcbcbc" : "#ebdca3";
            renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
            tmpContext.fill();
        }
        tmpSprite = tmpCanvas;
        gameObjectSprites[tmpIndex] = tmpSprite;
    }
    return tmpSprite;
}
let itemSprites = [];
function getItemSprite(obj, asIcon) {
    let tmpSprite = itemSprites[obj.id];
    if (!tmpSprite || asIcon) {
        let blurScale = !asIcon && isNight ? 15 : 0;
        let tmpCanvas = document.createElement("canvas");
        let reScale = !asIcon && obj.name == "windmill" ? items.list[4].scale : obj.scale;
        tmpCanvas.width = tmpCanvas.height = reScale * 2.5 + outlineWidth + (items.list[obj.id].spritePadding || 0) + blurScale;
        if (config.useWebGl) {
            let tmpContext = tmpCanvas.getContext("webgl");
            tmpContext.clearColor(0, 0, 0, 0);
            tmpContext.clear(tmpContext.COLOR_BUFFER_BIT);
            let eeeeeeeee = tmpContext.createBuffer();
            tmpContext.bindBuffer(tmpContext.ARRAY_BUFFER, eeeeeeeee);
            function gamesprite(x, y, tmp, e) {
                let goygoy = tmpContext.createShader(tmpContext.VERTEX_SHADER);
                tmpContext.shaderSource(goygoy, x);
                tmpContext.compileShader(goygoy);
                tmpContext.getShaderParameter(goygoy, tmpContext.COMPILE_STATUS);
                let gaygay = tmpContext.createShader(tmpContext.FRAGMENT_SHADER);
                tmpContext.shaderSource(gaygay, y);
                tmpContext.compileShader(gaygay);
                tmpContext.getShaderParameter(gaygay, tmpContext.COMPILE_STATUS);
                let lol = tmpContext.createProgram();
                tmpContext.attachShader(lol, goygoy);
                tmpContext.attachShader(lol, gaygay);
                tmpContext.linkProgram(lol);
                tmpContext.getProgramParameter(lol, tmpContext.LINK_STATUS);
                tmpContext.useProgram(lol);
                let uaregoated = tmpContext.getAttribLocation(lol, "vertex");
                tmpContext.enableVertexAttribArray(uaregoated);
                tmpContext.vertexAttribPointer(uaregoated, 2, tmpContext.FLOAT, false, 0, 0);
                let IAMSTARY = tmp.length / 2;
                tmpContext.bufferData(tmpContext.ARRAY_BUFFER, new Float32Array(tmp), tmpContext.DYNAMIC_DRAW);
                tmpContext.drawArrays(e, 0, IAMSTARY);
            }
            function hexToRgb(hex) {
                return hex.slice(1).match(/.{1,2}/g).map(g => parseInt(g, 16));
            }
            function getRgb(r, g, b) {
                return [r / 255, g / 255, b / 255].join(", ");
            }
            let lol = 100;
            for (let analPorn = 0; analPorn < lol; analPorn++) {
                let gayass = Math.PI * (analPorn / (lol / 2));
                gamesprite("                            precision mediump float;                            attribute vec2 vertex;                            void main(void) {                                gl_Position = vec4(vertex, 0, 1);                            }                            ", "                            precision mediump float;                            void main(void) {                                gl_FragColor = vec4(" + getRgb(...hexToRgb("#fff")) + ", 1);                            }                            ", [0 + Math.cos(gayass) * 0.5, 0 + Math.sin(gayass) * 0.5, 0, 0], tmpContext.LINE_LOOP);
            }
        } else {
            let tmpContext = tmpCanvas.getContext("2d");
            tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
            tmpContext.rotate(asIcon ? 0 : Math.PI / 2);
            tmpContext.strokeStyle = outlineColor;
            tmpContext.lineWidth = outlineWidth * (asIcon ? tmpCanvas.width / 81 : 1);
            if (isNight && !asIcon) {
                tmpContext.shadowBlur = blurScale;
                tmpContext.shadowColor = "rgba(0, 0, 0, " + Math.min(obj.name == "pit trap" ? 0.6 : 0.3, obj.alpha) + ")";
            }
            if (obj.name == "apple") {
                tmpContext.fillStyle = "#c15555";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fillStyle = "#89a54c";
                let leafDir = -(Math.PI / 2);
                renderLeaf(obj.scale * Math.cos(leafDir), obj.scale * Math.sin(leafDir), 25, leafDir + Math.PI / 2, tmpContext);
            } else if (obj.name == "cookie") {
                tmpContext.fillStyle = "#cca861";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fillStyle = "#937c4b";
                let chips = 4;
                let rotVal = Math.PI * 2 / chips;
                let tmpRange;
                for (let i = 0; i < chips; ++i) {
                    tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i), UTILS.randInt(4, 5), tmpContext, true);
                }
            } else if (obj.name == "cheese") {
                tmpContext.fillStyle = "#f4f3ac";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fillStyle = "#c3c28b";
                let chips = 4;
                let rotVal = Math.PI * 2 / chips;
                let tmpRange;
                for (let i = 0; i < chips; ++i) {
                    tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i), UTILS.randInt(4, 5), tmpContext, true);
                }
            } else if (obj.name == "wood wall" || obj.name == "stone wall" || obj.name == "castle wall") {
                tmpContext.fillStyle = obj.name == "castle wall" ? "#83898e" : obj.name == "wood wall" ? "#a5974c" : "#939393";
                let sides = obj.name == "castle wall" ? 4 : 3;
                renderStar(tmpContext, sides, obj.scale * 1.1, obj.scale * 1.1);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = obj.name == "castle wall" ? "#9da4aa" : obj.name == "wood wall" ? "#c9b758" : "#bcbcbc";
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
                tmpContext.fillStyle = "#c3af45";
                renderCircle(0, 0, tmpScale / 2, tmpContext, true);
            } else if (obj.name == "windmill" || obj.name == "faster windmill" || obj.name == "power mill") {
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, reScale, tmpContext);
                tmpContext.fillStyle = "#c9b758";
                renderRectCircle(0, 0, reScale * 1.3, 29, 2.1, tmpContext);
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
                    tmpContext.fillStyle = !i ? "#9ebf57" : "#b4db62";
                    tmpContext.fill();
                    if (!i) {
                        tmpContext.stroke();
                    }
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
                    renderRect(tmpX - tmpW / 2, 0, tmpW, obj.scale * 2, tmpContext);
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
        }
        tmpSprite = tmpCanvas;
        if (!asIcon) {
            itemSprites[obj.id] = tmpSprite;
        }
    }
    return tmpSprite;
}
function getItemSprite2(obj, tmpX, tmpY) {
    let tmpContext = mainContext;
    let reScale = obj.name == "windmill" ? items.list[4].scale : obj.scale;
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
        renderLeaf(obj.scale * Math.cos(leafDir), obj.scale * Math.sin(leafDir), 25, leafDir + Math.PI / 2, tmpContext);
    } else if (obj.name == "cookie") {
        tmpContext.fillStyle = "#cca861";
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fillStyle = "#937c4b";
        let chips = 4;
        let rotVal = Math.PI * 2 / chips;
        let tmpRange;
        for (let i = 0; i < chips; ++i) {
            tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
            renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i), UTILS.randInt(4, 5), tmpContext, true);
        }
    } else if (obj.name == "cheese") {
        tmpContext.fillStyle = "#f4f3ac";
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fillStyle = "#c3c28b";
        let chips = 4;
        let rotVal = Math.PI * 2 / chips;
        let tmpRange;
        for (let i = 0; i < chips; ++i) {
            tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
            renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i), UTILS.randInt(4, 5), tmpContext, true);
        }
    } else if (obj.name == "wood wall" || obj.name == "stone wall" || obj.name == "castle wall") {
        tmpContext.fillStyle = obj.name == "castle wall" ? "#83898e" : obj.name == "wood wall" ? "#a5974c" : "#939393";
        let sides = obj.name == "castle wall" ? 4 : 3;
        renderStar(tmpContext, sides, obj.scale * 1.1, obj.scale * 1.1);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = obj.name == "castle wall" ? "#9da4aa" : obj.name == "wood wall" ? "#c9b758" : "#bcbcbc";
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
            tmpContext.fillStyle = !i ? "#9ebf57" : "#b4db62";
            tmpContext.fill();
            if (!i) {
                tmpContext.stroke();
            }
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
            renderRect(tmpX - tmpW / 2, 0, tmpW, obj.scale * 2, tmpContext);
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
            tmpContext.shadowColor = "rgba(0, 0, 0, " + Math.min(0.3, obj.alpha) + ")";
        }
        if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" ||
            obj.name == "spinning spikes") {
            tmpContext.fillStyle = (obj.name == "poison spikes") ? "#7b935d" : "#939393";
            let tmpScale = (obj.scale * 0.6);
            renderStar(tmpContext, (obj.name == "spikes") ? 5 : 6, obj.scale, tmpScale);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, tmpScale, tmpContext);
            tmpContext.fillStyle = "#c3af45";
            renderCircle(0, 0, tmpScale / 2, tmpContext, true);
        } else if (obj.name == "pit trap") {
            tmpContext.fillStyle = "#a5974c";
            renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = outlineColor;
            renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
            tmpContext.fill();
        }
        tmpSprite = tmpCanvas;
        objSprites[obj.id] = tmpSprite;
    }
    return tmpSprite;
}

// OBJECT ON SCREEN:
function isOnScreen(x, y, s) {
    return (x + s >= 0 && x - s <= maxScreenWidth && y + s >= 0 && (y, s, maxScreenHeight));
}
const Ye = {
    animationTime: 0,
    land: null,
    lava: null,
    x: 13960,
    y: 13960,
};

function Do(e, t, i) {
    const n = e.lineWidth || 0;
    (i /= 2); e.beginPath();
    let s = (Math.PI * 2) / t;
    for (let r = 0; r < t; r++)
        e.lineTo(
            i + (i - n / 2) * Math.cos(s * r),
            i + (i - n / 2) * Math.sin(s * r)
        );
    e.closePath();
}

function drawVolcanoSprite() {
    const t = 320 * 2,
          i = document.createElement("canvas");
    (i.width = t), (i.height = t);
    const n = i.getContext("2d");
    (n.strokeStyle = "#3e3e3e"),
        (n.lineWidth = 11),
        (n.fillStyle = "#7f7f7f"),
        Do(n, 10, t),
        n.fill(),
        n.stroke(),
        (Ye.land = i);
    const s = document.createElement("canvas"),
          r = 200;
    (s.width = r), (s.height = r);
    const o = s.getContext("2d");
    (o.strokeStyle = "#525252"),
        (o.lineWidth = 5.5 * 1.6),
        (o.fillStyle = "#f54e16"),
        (o.strokeStyle = "#f56f16"),
        Do(o, 10, r),
        o.fill(),
        o.stroke(),
        (Ye.lava = s);
}
drawVolcanoSprite();

function drawVolcano(context, x, y) {
    const e = player.x - maxScreenWidth / 2,
          t = player.y - maxScreenHeight / 2;
    (Ye.animationTime += delta);
    (Ye.animationTime %= 3200);
    const i = 1600,
          n = 1.7 + 0.3 * (Math.abs(i - Ye.animationTime) / i),
          s = 100 * n;
    context.drawImage(Ye.land, x - 320, y - 320, 320 * 2, 320 * 2);
    context.drawImage(Ye.lava, x - s, y - s, s * 2, s * 2);
}
// RENDER GAMEOBJECTS:
function renderGameObjects(layer, xOffset, yOffset, obj) {
    let tmpSprite;
    let tmpX;
    let tmpY;
    gameObjects.forEach(tmp => {
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
                    mainContext.drawImage(tmpSprite, -(tmpSprite.width / 2), -(tmpSprite.height / 2));
                    if (tmpObj.blocker) {
                        mainContext.strokeStyle = '#db6e6e';
                        mainContext.globalAlpha = 0.3;
                        mainContext.lineWidth = 6;
                        renderCircle(0, 0, tmpObj.blocker, mainContext, false, true);
                    }
                    mainContext.restore();
                } else {
                    tmpSprite = getResSprite(tmpObj);
                    if (tmpObj.type === 4) {
                        drawVolcano(mainContext, tmpX, tmpY);
                    } else {
                        mainContext.drawImage(
                            tmpSprite,
                            tmpX - tmpSprite.width / 2,
                            tmpY - tmpSprite.height / 2
                        );
                    }
                }
            }
        }
    });

    // PLACE VISIBLE:
    if (layer === 0) {
        if (preIndi.length) {
            preIndi.forEach((places) => {
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
    tmpContext.rotate(90 ** 10);
    if (
        obj.name == "spikes" ||
        obj.name == "greater spikes" ||
        obj.name == "poison spikes" ||
        obj.name == "spinning spikes"
    ) {
        tmpContext.fillStyle = "#cc5151";
        var tmpScale = obj.scale;
        renderStar(tmpContext, obj.name == "spikes" ? 5 : 6, obj.scale, tmpScale);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = "#cc5151";
        renderCircle(0, 0, tmpScale, tmpContext);
        renderCircle(0, 0, tmpScale / 2, tmpContext, true);
    } else if (obj.name == "pit trap") {
        tmpContext.fillStyle = "#51cccc";
        renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
        tmpContext.fill();
        tmpContext.stroke();
        renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
        tmpContext.fill();
    }
    tmpContext.restore();
}
/*             function preshit(obj, tmpContext, tmpX, tmpY) {
                tmpContext.globalAlpha = 0.1;
                tmpContext.save();
                tmpContext.translate(tmpX, tmpY);
                if (obj.name === "spikes" || obj.name === "greater spikes" || obj.name === "poison spikes" || obj.name === "spinning spikes") {
                    tmpContext.fillStyle = "#cc5151";
                    tmpContext.strokeStyle = "#cc5151";
                    mainContext.lineWidth = 0;
                    renderCircle(0, 0, obj.scale, tmpContext);
                    tmpContext.fill();
                } else if (obj.name === "pit trap") {
                    tmpContext.fillStyle = "#51cccc";
                    tmpContext.strokeStyle = "#51cccc";
                    mainContext.lineWidth = 0;
                    renderCircle(0, 0, obj.scale, tmpContext);
                    tmpContext.fill();
                }
                tmpContext.restore();
            } */
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
                this.scale += delta * 0.05;
                if (this.scale >= scale) {
                    this.active = false;
                } else {
                    ctxt.globalAlpha = 1 - Math.max(0, this.scale / scale);
                    ctxt.beginPath();
                    ctxt.arc(this.x / config.mapScale * mapDisplay.width, this.y / config.mapScale * mapDisplay.width, this.scale, 0, Math.PI * 2);
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
        mapContext.lineWidth = 4;
        for (let i = 0; i < mapPings.length; ++i) {
            tmpPing = mapPings[i];
            mapContext.strokeStyle = tmpPing.color;
            tmpPing.update(mapContext, delta);
        }
        mapContext.globalAlpha = 1;
        mapContext.fillStyle = "#ff0000";
        if (pathFindTest.length) {
            mapContext.fillStyle = "#abcdef";
            mapContext.font = "34px Hammersmith One";
            mapContext.textBaseline = "middle";
            mapContext.textAlign = "center";
            for (let i = 0; i < pathFindTest.length;) {
                mapContext.fillText("", pathFindTest[i].x / config.mapScale * mapDisplay.width, pathFindTest[i].y / config.mapScale * mapDisplay.height);
                i += 2;
            }
        }
        mapContext.globalAlpha = 1;
        mapContext.fillStyle = "#fff";
        renderCircle(player.x / config.mapScale * mapDisplay.width, player.y / config.mapScale * mapDisplay.height, 7, mapContext, true);
        mapContext.fillStyle = "rgba(255,255,255,0.35)";
        if (player.team && minimapData) {
            for (let i = 0; i < minimapData.length;) {
                renderCircle(minimapData[i] / config.mapScale * mapDisplay.width, minimapData[i + 1] / config.mapScale * mapDisplay.height, 7, mapContext, true);
                i += 2;
            }
        }
        if (lastDeath) {
            mapContext.fillStyle = "#fc5553";
            mapContext.font = "34px Hammersmith One";
            mapContext.textBaseline = "middle";
            mapContext.textAlign = "center";
            mapContext.fillText("x", lastDeath.x / config.mapScale * mapDisplay.width, lastDeath.y / config.mapScale * mapDisplay.height);
        }
        if (mapMarker) {
            mapContext.fillStyle = "#fff";
            mapContext.font = "34px Hammersmith One";
            mapContext.textBaseline = "middle";
            mapContext.textAlign = "center";
            mapContext.fillText("x", mapMarker.x / config.mapScale * mapDisplay.width, mapMarker.y / config.mapScale * mapDisplay.height);
        }
    }
}
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
function updateGame() {
    if (config.resetRender) {
        mainContext.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
        mainContext.beginPath();
    }
    if (true) {
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
            camX = config.mapScale / 2;
            camY = config.mapScale / 2;
        }
        let lastTime = now - 1000 / config.serverUpdateRate;
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
                    let ratio = fraction / total;
                    let rate = 170;
                    tmpObj.dt += delta;
                    tmpObj.rt = Math.min(1, tmpObj.dt / config.tickRate);
                    let tmpRate = Math.min(1.7, tmpObj.dt / rate);
                    tmpDiff = tmpObj.x2 - tmpObj.x1;
                    tmpObj.x = tmpObj.x1 + tmpDiff * tmpRate;
                    tmpDiff = tmpObj.y2 - tmpObj.y1;
                    tmpObj.y = tmpObj.y1 + tmpDiff * tmpRate;
                    if (config.anotherVisual) {
                        tmpObj.dir = Math.lerpAngle(tmpObj.d2, tmpObj.d1, Math.min(1.2, ratio));
                    } else {
                        tmpObj.dir = Math.lerpAngle(tmpObj.d2, tmpObj.d1, Math.min(1.2, ratio));
                    }
                }
            }
        }
        let nightColors = {
            snow: "#e6e6e6",
            river: "#78a1d3",
            grass: "#3C873A",
            desert: "#d3b945",
        };
        let dayColors = {
            snow: "#fff",
            river: "#91b2db",
            grass: "#b6db66",
            desert: "#dbc666",
        };
        let dayCycle = false;
        var xOffset = camX - maxScreenWidth / 2;
        var yOffset = camY - maxScreenHeight / 2;
        // RENDER VELOCITY POSITION
        if(player && player.alive){
            mainContext.globalAlpha = 0.5;

            mainContext.save();
            mainContext.translate(player.xVel - xOffset, player.yVel - yOffset);

            mainContext.rotate(player.dir);
            renderPlayer(player, mainContext);
            mainContext.restore();

            mainContext.globalAlpha = 1;
        }
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
        } else {
            mainContext.fillStyle = "#b6db66";
            mainContext.fillRect(0, 0, maxScreenWidth, (config.mapScale - config.snowBiomeTop - yOffset));
            mainContext.fillStyle = "#dbc666";
            mainContext.fillRect(0, (config.mapScale - config.snowBiomeTop - yOffset), maxScreenWidth, maxScreenHeight - (config.mapScale - config.snowBiomeTop - yOffset));
        }
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
        // RENDER GRID:
        let isNight = false;
        mainContext.lineWidth = 4;
        mainContext.strokeStyle = "#000";
        mainContext.globalAlpha = 0.06;
        let blurScale = isNight ? 12 : 0;

        if (blurScale > 0) {
            mainContext.shadowBlur = blurScale;
            mainContext.shadowColor = `rgba(0, 0, 0, 0.3)`;
        }
        mainContext.beginPath();
        for (let x = -camX; x < maxScreenWidth; x += 60) {
            if (x > 0) {
                mainContext.moveTo(x, 0);
                mainContext.lineTo(x, maxScreenHeight);
            }
        }
        for (let y = -camY; y < maxScreenHeight; y += 60) {
            if (y > 0) {
                mainContext.moveTo(0, y);
                mainContext.lineTo(maxScreenWidth, y);
            }
        }
        mainContext.stroke();
        mainContext.shadowBlur = 0;
        mainContext.shadowColor = 'rgba(0, 0, 0, 0)';
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
            if (config.mapScale - xOffset <= maxScreenWidth) {
                tmpMin = maxScreenWidth - (config.mapScale - xOffset);
            }
            mainContext.fillRect(tmpX, config.mapScale - yOffset, maxScreenWidth - tmpX - tmpMin, maxScreenHeight - (config.mapScale - yOffset));
        }
        // RENDER DAY/NIGHT TIME:
        mainContext.globalAlpha = 1;
        mainContext.fillStyle = "rgba(0, 0, 70, 0.55)";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        let bowr = false;
        mainContext.strokeStyle = darkOutlineColor;
        mainContext.globalAlpha = 1;
        for (let i = 0; i < players.length + ais.length; ++i) {
            tmpObj = players[i] || ais[i - players.length];
            if (tmpObj.visible) {
                if(true){
                    mainContext.strokeStyle = darkOutlineColor;
                }
                // NAME AND HEALTH:
                let tmpText = (tmpObj.team ? "[" + tmpObj.team + "] " : "") + (tmpObj.name || ""); //+ (tmpObj.isPlayer ? " {" + tmpObj.sid + "}" : "");
                if (tmpText != "" && tmpObj.name != "unknown1l") {
                    mainContext.font = (tmpObj.nameScale || 30) + "px Hammersmith One";
                    //^^^^
                    mainContext.fillStyle = "#fff";
                    mainContext.textBaseline = "middle";
                    mainContext.textAlign = "center";
                    mainContext.lineWidth = (tmpObj.nameScale ? 11 : 8);
                    mainContext.lineJoin = "round";
                    if (tmpObj.sid && tmpObj.isPlayer) {
                        mainContext.fillText(tmpObj.sid, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY + 67);
                    }
                    mainContext.fillText(tmpText, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY);
                    if (tmpObj.isLeader && iconSprites.crown.isLoaded) {
                        var tmpS = config.crownIconScale;
                        var tmpX = tmpObj.x - xOffset - tmpS / 2 - mainContext.measureText(tmpText).width / 2 - config.crownPad;
                        mainContext.drawImage(iconSprites.crown, tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY - tmpS / 2 - 5, tmpS, tmpS);
                    }
                    if (tmpObj.iconIndex == 1 && iconSprites.skull.isLoaded) {
                        let tmpS = config.crownIconScale;
                        let tmpX = tmpObj.x - xOffset - tmpS / 2 + mainContext.measureText(tmpText).width / 2 + config.crownPad;
                        mainContext.drawImage(iconSprites.skull, tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY - tmpS / 2 - 5, tmpS, tmpS);
                    }
                }
                if (visualsForNow) {
                    mainContext.font = (tmpObj.nameScale || 30) + "px Hammersmith One";
                    mainContext.fillStyle = "white";
                    mainContext.textBaseline = "middle";
                    mainContext.textAlign = "center";
                    mainContext.lineWidth = tmpObj.nameScale ? 11 : 8;
                    mainContext.lineJoin = "round";
                    let tmpS = config.crownIconScale;
                    let tmpX = tmpObj.x - xOffset - tmpS / 2 + mainContext.measureText(tmpText).width / 2 + config.crownPad + (tmpObj.iconIndex == 1 ? (tmpObj.nameScale || 30) * 2.75 : tmpObj.nameScale || 30);
                    mainContext.strokeText(tmpObj.shameCount, tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY);
                    mainContext.fillText(tmpObj.shameCount, tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY);
                }
                if (visualsForNow) {
                    if (tmpObj.health > 0) {
                        let curr = tmpObj.prevHW || ((config.healthBarWidth * 2) * (tmpObj.health / tmpObj.maxHealth));
                        mainContext.fillStyle = darkOutlineColor;
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth - config.healthBarPad, (tmpObj.y - yOffset + tmpObj.scale) + config.nameY, (config.healthBarWidth * 2) + (config.healthBarPad * 2), 17, 8);
                        mainContext.fill();
                        let thw = (config.healthBarWidth * 2) * (tmpObj.health / tmpObj.maxHealth);
                        if (tmpObj.prevHW !== undefined) {
                            tmpObj.prevDW = tmpObj.prevDW || tmpObj.prevHW;
                            tmpObj.prevDW += (thw - tmpObj.prevDW) * 0.03; // uh the damage animation
                        }
                        curr += (thw - curr) * 0.2;
                        tmpObj.prevHW = curr;
                        mainContext.fillStyle = (tmpObj == player || (tmpObj.team && tmpObj.team == player.team)) ? "#FF6666" : "#FFFF66";
                        mainContext.roundRect( tmpObj.x - xOffset - config.healthBarWidth, (tmpObj.y - yOffset + tmpObj.scale) + config.nameY + config.healthBarPad, tmpObj.prevDW, 17 - config.healthBarPad * 2, 7);
                        mainContext.fill();
                        mainContext.fillStyle = (tmpObj == player || (tmpObj.team && tmpObj.team == player.team)) ? "#8ecc51" : "#cc5151";
                        mainContext.roundRect( tmpObj.x - xOffset - config.healthBarWidth, (tmpObj.y - yOffset + tmpObj.scale) + config.nameY + config.healthBarPad, curr, 17 - config.healthBarPad * 2, 7);
                        mainContext.fill();
                    }
                }
            }
        }
        // RENDER ANIM TEXTS:
        textManager.update(delta, mainContext, xOffset, yOffset);
        // RENDER CHAT MESSAGES:
        players.forEach((tmp) => {
            tmpObj = tmp;
            if (tmpObj.visible && tmpObj.chatCountdown > 0) {
                tmpObj.chatCountdown = Math.max(0, (tmpObj.chatCountdown -= delta));
                mainContext.font = "32px Hammersmith One";
                var tmpSize = mainContext.measureText(tmpObj.chatMessage);
                mainContext.textBaseline = "middle";
                mainContext.textAlign = "center";
                var tmpX = tmpObj.x - xOffset;
                var tmpY = tmpObj.y - tmpObj.scale - yOffset - 90;
                var tmpH = 47;
                var tmpW = tmpSize.width + 17;
                mainContext.fillStyle = "rgba(0,0,0,0.2)";
                mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
                mainContext.fill();
                mainContext.fillStyle = "#fff";
                mainContext.fillText(tmpObj.chatMessage, tmpX, tmpY);
            }
        });
    }
    if (player) {
        // PATHFIND LINE:
        if (my.autoPush || pathFind.activ) {
            if (pathFind.array && (pathFind.chaseNear ? enemy.length : true)) {
                mainContext.lineWidth = 4.5;
                mainContext.strokeStyle = pathFind.active ? "cyan" : "white";
                mainContext.beginPath();
                pathFind.array.forEach((path, i) => {
                    let pathXY = {
                        x: (pathFind.scale / pathFind.grid) * path.x,
                        y: (pathFind.scale / pathFind.grid) * path.y
                    };
                    let render = {
                        x: ((player.x2 - (pathFind.scale / 2)) + pathXY.x) - xOffset,
                        y: ((player.y2 - (pathFind.scale / 2)) + pathXY.y) - yOffset
                    };
                    if (i == 0) {
                        mainContext.moveTo(render.x, render.y);
                    } else {
                        mainContext.lineTo(render.x, render.y);
                    }
                });
                mainContext.lineTo(my.pushLine.x2 - xOffset, my.pushLine.y2 - yOffset);
                mainContext.lineTo(my.pushLine.x - xOffset, my.pushLine.y - yOffset);
                mainContext.stroke();
            }
        }
        // PATHFINDER LINE:
        if (pathop.active) {
            if (pathop.array && (packet("9", near.aim2) ? enemy.length : true)) {
                mainContext.lineWidth = player.scale / 5;
                mainContext.globalAlpha = 2;
                mainContext.strokeStyle = "red";
                mainContext.beginPath();
                pathFind.array.forEach((path, i) => {
                    let pathXY = {
                        x: (pathop.scale / pathop.grid) * path.x,
                        y: (pathop.scale / pathop.grid) * path.y
                    }
                    let render = {
                        x: ((player.x2 - (pathop.scale / 2)) + pathXY.x) - xOffset,
                        y: ((player.y2 - (pathop.scale / 2)) + pathXY.y) - yOffset
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
        // DODGE SPIKE MARK:
        if (tracker.draw3.active) {
            mainContext.globalAlpha = 0.2;
            let obj = {
                x: tracker.draw3.x - xOffset,
                y: tracker.draw3.y - yOffset,
                scale: tracker.draw3.scale,
            }
            mainContext.fillStyle = "#cc5151";
            mainContext.beginPath();
            mainContext.arc(obj.x, obj.y, obj.scale, 0, 2 * Math.PI);
            mainContext.fill();
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
                if (tmpObj.chatCountdown <= 0) tmpObj.chatCountdown = 0;
                mainContext.font = "32px Hammersmith One";
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
        }

        mainContext.globalAlpha = 1;
    }

    function autoZoomCamera(playerX, playerY, camX, camY, delta) {
        if (playerX && playerY) {
            let tmpDist = UTILS.getDistance(camX, camY, playerX, playerY);
            let tmpDir = UTILS.getDirection(playerX, playerY, camX, camY);
            let camSpd = Math.min(tmpDist * 0.005 * delta, tmpDist);

            if (tmpDist > 0.05) {
                camX += camSpd * Math.cos(tmpDir);
                camY += camSpd * Math.sin(tmpDir);
            } else {
                camX = playerX;
                camY = playerY;
            }
        }
        return { camX, camY };
    }
    // RENDER MINIMAP:
    renderMinimap(delta);
    // RENDER CONTROLS:
    if (controllingTouch.id !== -1) {
        renderControl(controllingTouch.startX, controllingTouch.startY, controllingTouch.currentX, controllingTouch.currentY);
    }
    if (attackingTouch.id !== -1) {
        renderControl(attackingTouch.startX, attackingTouch.startY, attackingTouch.currentX, attackingTouch.currentY);
    }
    if (visualsForNow) {
        mainContext.beginPath();
        let screenW = maxScreenWidth / 2;
        let screenH = maxScreenHeight / 2;
        let gradient = mainContext.createRadialGradient(screenW, screenH, 0, screenW, screenH, visualsForNow ? maxScreenWidth : maxScreenHeight);
        for (let i = 0; i <= 1; i++) {
            gradient.addColorStop(i, "rgba(0, 0, 0, " + i + ")");
        }
        mainContext.fillStyle = gradient;
        mainContext.rect(0, 0, maxScreenWidth, maxScreenHeight);
        mainContext.fill();
    }
}
// RENDER CONTROL:
function renderControl(startX, startY, currentX, currentY) {
    mainContext.save();
    mainContext.setTransform(1, 0, 0, 1, 0, 0);
    // mainContext.resetTransform();
    mainContext.scale(pixelDensity, pixelDensity);
    var controlRadius = 50;
    mainContext.beginPath();
    mainContext.arc(startX, startY, controlRadius, 0, Math.PI * 2, false);
    mainContext.closePath();
    mainContext.fillStyle = "rgba(255, 255, 255, 0.3)";
    mainContext.fill();
    var controlRadius = 50;
    var offsetX = currentX - startX;
    var offsetY = currentY - startY;
    var mag = Math.sqrt(Math.pow(offsetX, 2) + Math.pow(offsetY, 2));
    var divisor = mag > controlRadius ? mag / controlRadius : 1;
    offsetX /= divisor;
    offsetY /= divisor;
    mainContext.beginPath();
    mainContext.arc(startX + offsetX, startY + offsetY, controlRadius * 0.5, 0, Math.PI * 2, false);
    mainContext.closePath();
    mainContext.fillStyle = "white";
    mainContext.fill();
    mainContext.restore();
}
window.requestAnimFrame = function () {
    return null;
};
window.rAF = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function (callback) {
    window.setTimeout(callback, 1000 / 60);
};

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
    updateGame();
    window.rAF(doUpdate);
}
prepareMenuBackground();
doUpdate();

let changeDays = {};
window.debug = function () {
    my.waitHit = 0;
    my.autoAim = false;
    instaC.isTrue = false;
    traps.inTrap = false;
    itemSprites = [];
    objSprites = [];
    gameObjectSprites = [];
    attackTime = Date.now();
};

window.startGrind = function () {
    if (getEl("weaponGrind").checked) {
        for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
            checkPlace(player.getItemType(22), i);
        }
    }
};
let projects = ["adorable-eight-guppy", "galvanized-bittersweet-windshield"];
let botIDS = 0;
window.resBuild = function () {
    if (gameObjects.length) {
        gameObjects.forEach(tmp => {
            tmp.breakObj = false;
        });
        breakObjects = [];
    }
};
window.toggleVisual = function () {
    config.anotherVisual = !config.anotherVisual;
    gameObjects.forEach(tmp => {
        if (tmp.active) {
            tmp.dir = tmp.lastDir;
        }
    });
};
window.prepareUI = function (tmpObj) {
    resize();
    UTILS.removeAllChildren(actionBar);
    for (let i = 0; i < items.weapons.length + items.list.length; ++i) {
        (function (i) {
            UTILS.generateElement({
                id: "actionBarItem" + i,
                class: "actionBarItem",
                style: "display:none",
                onmouseout: function () {
                    showItemInfo();
                },
                parent: actionBar
            });
        })(i);
    }
    for (let i = 0; i < items.list.length + items.weapons.length; ++i) {
        (function (i) {
            let tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = tmpCanvas.height = 66;
            let tmpContext = tmpCanvas.getContext("2d");
            tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
            tmpContext.imageSmoothingEnabled = false;
            tmpContext.webkitImageSmoothingEnabled = false;
            tmpContext.mozImageSmoothingEnabled = false;
            if (items.weapons[i]) {
                tmpContext.rotate(Math.PI / 4 + Math.PI);
                let tmpSprite = new Image();
                toolSprites[items.weapons[i].src] = tmpSprite;
                tmpSprite.onload = function () {
                    this.isLoaded = true;
                    let tmpPad = 1 / (this.height / this.width);
                    let tmpMlt = items.weapons[i].iPad || 1;
                    tmpContext.drawImage(this, -(tmpCanvas.width * tmpMlt * config.iconPad * tmpPad) / 2, -(tmpCanvas.height * tmpMlt * config.iconPad) / 2, tmpCanvas.width * tmpMlt * tmpPad * config.iconPad, tmpCanvas.height * tmpMlt * config.iconPad);
                    tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
                    tmpContext.globalCompositeOperation = "source-atop";
                    tmpContext.fillRect(-tmpCanvas.width / 2, -tmpCanvas.height / 2, tmpCanvas.width, tmpCanvas.height);
                    getEl("actionBarItem" + i).style.backgroundImage = "url(" + tmpCanvas.toDataURL() + ")";
                };
                tmpSprite.src = "./../img/weapons/" + items.weapons[i].src + ".png";
                let tmpUnit = getEl("actionBarItem" + i);
                tmpUnit.onmouseover = UTILS.checkTrusted(function () {
                    showItemInfo(items.weapons[i], true);
                });
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
                getEl("actionBarItem" + i).style.backgroundImage = "url(" + tmpCanvas.toDataURL() + ")";
                let tmpUnit = getEl("actionBarItem" + i);
                tmpUnit.onmouseover = UTILS.checkTrusted(function () {
                    showItemInfo(items.list[i - items.weapons.length]);
                });
                tmpUnit.onclick = UTILS.checkTrusted(function () {
                    selectToBuild(tmpObj.items[tmpObj.getItemType(i - items.weapons.length)]);
                });
                UTILS.hookTouchEvents(tmpUnit);
            }
        })(i);
    }
};