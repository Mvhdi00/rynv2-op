// ==UserScript==
// @name         moomoo.io Mod Unpatcher
// @namespace    https://github.com/Mvhdi00/rynv2-op
// @version      2.0
// @description  Install this once, then run old/broken moomoo mods unchanged. Restores the transport the server now requires, fills in the environment those mods assume, and names whatever is left over.
// @author       -
// @match        *://*.moomoo.io/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

/* ===========================================================================
 * WHAT THIS IS
 *
 * moomoo changed its wire protocol. After the "io-init" handshake the server
 * expects, per connection:
 *
 *     [ 6-byte truncated HMAC-SHA256 | msgpack([opcode, args, seq]) ]
 *
 * where `opcode` is a numeric id drawn from a table shuffled with a
 * per-connection seed, and `seq` is a monotonic counter. Incoming packets
 * carry numeric opcodes from a second, independent table.
 *
 * Every mod written before that change speaks plain msgpack([name, args]) and
 * is therefore ignored by the server. This script sits underneath the mod and
 * translates, so the mod itself needs no edits.
 *
 * HOW TO USE
 *
 *   1. Install this script.
 *   2. Make sure it is ORDERED ABOVE the mod in your userscript manager.
 *      It must run first -- the game captures WebSocket.prototype.send once at
 *      load, and whoever holds that reference controls the traffic.
 *   3. Install the old mod unchanged and reload.
 *
 * WHAT IT HANDLES
 *
 * The protocol:
 *
 *   - the io-init handshake, opcode tables and HMAC framing        (any mod)
 *   - outgoing packet names, with the mod's generation auto-detected
 *   - incoming opcodes translated back into the names the mod expects
 *   - a stale or missing connect token on the socket URL, replaced with the
 *     live Cloudflare Turnstile one -- the usual cause of "stuck on Connecting"
 *
 * The environment those mods were written for and no longer get:
 *
 *   - window.msgpack (plus msgpack5 and the Encoder/Decoder shape), byte-
 *     identical to the game's, for every mod whose CDN @require died
 *   - unsafeWindow, GM_getValue/setValue/deleteValue/listValues, GM_addStyle,
 *     GM_setClipboard, GM_openInTab, GM_registerMenuCommand, GM_notification,
 *     GM_info and the promise-shaped GM.* namespace -- all undefined under
 *     "@grant none", and every one of them a ReferenceError that kills the
 *     whole script on the line that uses it
 *   - the ad and promo elements the game has since deleted, handed back as
 *     hidden placeholders so `getElementById("adCard").parentNode` stops
 *     throwing on line one. Add your own with window.UNPATCH_EXTRA_IDS.
 *   - window.WebSocket kept assignable: the bundle freezes it at boot, which
 *     silently disables any mod that wraps the constructor
 *   - a late mod is fine. The reference the game captured is ours either way,
 *     so a missing "@run-at document-start" in the mod is no longer fatal.
 *
 * And when something still breaks, it says what: every uncaught error is
 * matched against the failure modes this family of mods actually has and
 * reported in plain language. `unpatch.report()` prints everything the shim
 * did -- generation, packets framed, names it had to drop, shims used, errors
 * seen. That one line is usually enough to say what a mod needs.
 *
 * WHAT IT STILL CANNOT HANDLE
 *
 *   - mods that scrape the game bundle for its minified variable names. Those
 *     break on every rebuild and need a real edit; the report will say so.
 *   - anything the server changed in a packet's *payload*, as opposed to its
 *     name
 *
 * So: it fixes the protocol and the environment for you. It is not a guarantee
 * that any given mod will work -- but when one does not, it tells you why.
 * ======================================================================== */

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

    // Old mod packet names -> the names the current server uses. Applied on
    // the way out, before the opcode lookup.
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

    /* --- minimal msgpack ------------------------------------------------ */
    // Replaces the old `@require` of msgpack-lite from rawgit.com, which has
    // been offline since 2019 (so window.msgpack was undefined and every
    // encode/decode in this script threw).
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
        if (c < 0x80) return c;                       // positive fixint
        if (c >= 0xe0) return c - 256;                // negative fixint
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
            if (k !== "__proto__") out[k] = v;      // never let the wire touch the prototype
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

    /* --- opcode tables -------------------------------------------------- */
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

    /* --- HMAC-SHA256 ---------------------------------------------------- */
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

    /* --- per-socket protocol state -------------------------------------- */
    const states = new WeakMap();

    // Every socket gets a listener at construction time, because io-init
    // arrives before anything else attaches one.
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
        } catch (e) { /* not a handshake frame */ }
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

    /* --- framing -------------------------------------------------------- */

    // Turn what the game handed us back into a string-named packet.
    // Returns null if it cannot be parsed.
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

    // Frame and transmit a string-named packet. This shim owns the sequence
    // counter: it renumbers everything it sends, so packets the client injects
    // sit in the same monotonic run as the game's own.
    function send(sock, type, args) {
        if (!sock || sock.readyState !== 1) return false;
        const name = Object.prototype.hasOwnProperty.call(PACKET_MAP, type) ? PACKET_MAP[type] : type
          , st = states.get(sock);
        if (st && st.mode === MODE_SECURE) {
            const op = st.tables.c2s.enc[name];
            if (op === undefined) return false;     // server would drop it anyway
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

    // Decode an incoming frame into [stringName, args].
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

    /* --- captcha token -------------------------------------------------- */
    // The game moved from reCAPTCHA to Cloudflare Turnstile, and the token is
    // now prefixed "cf:". The bundle keeps the token in a closure, but it
    // publishes its callback on window, so we wrap the property before the
    // bundle installs it and copy the token as it comes through.
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
        // Fall back to reading the widget directly: if the page rendered and
        // solved it before our wrapper was in place, the callback never fired
        // for us and captchaToken would still be null.
        if (!captchaToken && window.turnstile && typeof window.turnstile.getResponse === "function") {
            try {
                const el = document.getElementById("turnstileWidget");
                captchaToken = (el ? window.turnstile.getResponse(el) : window.turnstile.getResponse()) || null;
            } catch (e) { /* no widget yet */ }
        }
        return captchaToken ? "cf:" + captchaToken : null;
    }

    // Ask Turnstile for a new token. Cloudflare treats tokens as single-use,
    // so reusing one for extra connections will usually be rejected -- this is
    // a best effort, not a guarantee.
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

    /* --- send trampoline ------------------------------------------------ */
    // The game captures WebSocket.prototype.send at bundle load. We install
    // this now so that captured reference is ours; the client installs its
    // real handler later via setHandler().
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
        // exposed for the test harness
        _internals: { buildTables, tag, hexToBytes, HEADER_LEN, MODE_SECURE, states }
    };
}
)();

/* ===========================================================================
 * Universal layer.
 *
 * Everything above is the transport (handshake, opcode tables, HMAC framing).
 * Everything below adapts an *unmodified* mod to it, without the mod knowing.
 *
 * How mods of this family are built, and where we sit:
 *
 *     WebSocket.prototype.nsend = WebSocket.prototype.send;   // saves ours
 *     WebSocket.prototype.send  = function (buf) {            // its own hook
 *         ...inspect/mutate plain msgpack...
 *         this.nsend(binary);                                 // back to ours
 *     };
 *
 * We run at document-start, so the reference the mod saves is ours, and the
 * reference the game captured at bundle load is ours too. That puts us on both
 * sides of the mod: we hand it plain msgpack going out and take plain msgpack
 * back, framing at the boundary. The mod never learns the wire changed.
 *
 * The transport was never the whole story, though. Every mod repaired by hand
 * in this project needed the same handful of non-protocol fixes as well, and
 * those are all here too: the "@grant none" holes, the page elements the game
 * removed, the dead CDN requires, the stale connect token, and the constructor
 * pin the bundle installs. What is left over gets named for you instead of
 * silently killing the script.
 * ======================================================================== */
const UNPATCH = (function () {
    "use strict";

    const hasWin = typeof window != "undefined";
    const hasDoc = typeof document != "undefined";

    /* --- what happened, so a failure is one line and not a whole file ---- */
    const log = {
        handshake: false,
        framed: 0,
        translatedIn: 0,
        dropped: [],          // packet names the server has no opcode for
        unframeable: 0,
        shims: [],            // environment holes filled
        placeholders: [],     // page elements the mod asked for that are gone
        urlFixes: 0,
        errors: []            // { message, diagnosis }
    };
    function noteShim(name) { if (log.shims.indexOf(name) === -1) log.shims.push(name); }

    /* --- packet vocabularies ------------------------------------------- */
    // 2019 generation -> current. Derived by matching call shapes against the
    // live bundle, not guessed; see the project README.
    const OLD_TO_NEW_OUT = {
        "sp": "M", "2": "D", "33": "9", "rmd": "e", "c": "F", "5": "z",
        "6": "H", "7": "K", "8": "L", "9": "N", "10": "b", "11": "P",
        "12": "Q", "13c": "c", "ch": "6", "14": "S", "pp": "0"
    };
    const NEW_TO_OLD_IN = {
        "A": "id", "B": "d",  "C": "1",  "D": "2",  "E": "4",  "a": "33",
        "G": "5",  "H": "6",  "I": "a",  "J": "aa", "K": "7",  "L": "8",
        "M": "sp", "N": "9",  "O": "h",  "P": "11", "Q": "12", "R": "13",
        "S": "14", "T": "15", "U": "16", "V": "17", "X": "18", "Y": "19",
        "Z": "20", "g": "ac", "1": "ad", "2": "an", "3": "st", "4": "sa",
        "5": "us", "6": "ch", "7": "mm", "8": "t",  "9": "p",  "0": "pp"
    };
    // Mods only a little behind: names that were renamed within this generation.
    const STRAGGLERS = { "f": "9", "a": "9", "d": "F", "G": "z", "13c": "c", "ch": "6", "pp": "0", "33": "9" };

    const OLD_TO_NEW_INV = {};
    Object.keys(OLD_TO_NEW_OUT).forEach(k => { OLD_TO_NEW_INV[OLD_TO_NEW_OUT[k]] = k; });

    const CURRENT_OUT = EXP._internals.C2S || ["M","D","9","e","F","z","H","K","L","N","b","P","Q","c","6","S","0"];

    /* --- generation detection ------------------------------------------ */
    // "old" and "current" share the names 6, 9, c, 2, 5, 7, 8 with different
    // meanings, so we cannot translate until we know which one we are talking
    // to. These names appear in exactly one generation, so the first time we
    // see any of them the question is settled. In practice the very first
    // packet a mod sends is its spawn -- "sp" (old) or "M" (current).
    const ONLY_OLD = ["sp", "ch", "33", "pp", "rmd", "13c", "10", "11", "12", "14"];
    const ONLY_NEW = ["M", "D", "e", "z", "b", "K", "L", "N", "S", "H", "Q", "P"];

    let generation = null;            // null | "old" | "current"

    function noteOutgoing(name) {
        if (generation) return;
        if (ONLY_OLD.indexOf(name) !== -1) {
            generation = "old";
            console.info("[unpatch] mod detected as 2019-generation (saw \"" + name + "\")");
        } else if (ONLY_NEW.indexOf(name) !== -1) {
            generation = "current";
            console.info("[unpatch] mod detected as current-generation (saw \"" + name + "\")");
        }
    }

    // mod name -> name the server wants
    function outName(name) {
        noteOutgoing(name);
        if (generation === "old" && Object.prototype.hasOwnProperty.call(OLD_TO_NEW_OUT, name))
            return OLD_TO_NEW_OUT[name];
        if (Object.prototype.hasOwnProperty.call(STRAGGLERS, name) && CURRENT_OUT.indexOf(name) === -1)
            return STRAGGLERS[name];
        return name;
    }
    // server name -> name the mod expects
    function inName(name) {
        if (generation === "old" && Object.prototype.hasOwnProperty.call(NEW_TO_OLD_IN, name))
            return NEW_TO_OLD_IN[name];
        return name;
    }
    // a current outgoing name, back into the mod's dialect
    function outNameToMod(name) {
        if (generation === "old" && Object.prototype.hasOwnProperty.call(OLD_TO_NEW_INV, name))
            return OLD_TO_NEW_INV[name];
        return name;
    }

    /* --- framing boundary ----------------------------------------------- */
    function toBytes(d) {
        if (d instanceof Uint8Array) return d;
        if (d instanceof ArrayBuffer) return new Uint8Array(d);
        if (ArrayBuffer.isView(d)) return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
        try { return Uint8Array.from(d); } catch (e) { return null; }
    }

    function isAlreadyFramed(sock, bytes) {
        const st = EXP.stateOf(sock);
        if (!st || st.mode !== 1 || bytes.length <= 6) return false;
        const want = EXP._internals.tag(st.key, bytes.subarray(6));
        for (let i = 0; i < 6; i++) if (want[i] !== bytes[i]) return false;
        return true;
    }

    let alreadyCurrentWarned = false;

    // Re-stamp an already-framed packet with our sequence number and re-sign
    // it. Returns the original bytes untouched if anything about it surprises
    // us -- a packet that goes out with the wrong number is recoverable, one
    // that does not go out at all is not.
    function renumber(sock, bytes) {
        const st = EXP.stateOf(sock);
        if (!st || st.mode !== 1) return bytes;
        try {
            const parsed = EXP.decode(bytes.subarray(6));
            if (!Array.isArray(parsed) || typeof parsed[0] !== "number") return bytes;
            parsed[2] = ++st.seq;
            const payload = EXP.encode(parsed)
                , frame = new Uint8Array(6 + payload.length);
            frame.set(EXP._internals.tag(st.key, payload), 0);
            frame.set(payload, 6);
            return frame;
        } catch (e) { return bytes; }
    }

    // Takes whatever a mod handed us and puts it on the wire correctly.
    function transmit(sock, data) {
        const bytes = toBytes(data);
        if (!bytes) return EXP.nativeSend.call(sock, data);
        if (!EXP.isSecure(sock)) return EXP.nativeSend.call(sock, bytes);
        log.handshake = true;
        if (isAlreadyFramed(sock, bytes)) {
            // The game frames its own packets -- `const n = ++Z.seq` in the
            // bundle -- and hands us the finished frame. Our own EXP.send has
            // a second, independent counter, so passing this through untouched
            // puts two numbering schemes on one socket and the moment a mod
            // injects anything the two collide. Renumber it into our run
            // instead: same opcode, same arguments, one sequence.
            //
            // For a game-only stream this is a no-op -- both counters start at
            // zero and step together -- so it costs nothing until it matters.
            // A mod that frames its own packets already speaks the current
            // protocol -- it does not need this shim, and stacking the two
            // means two independent sequence counters on one socket. Passing
            // the frame through untouched keeps it working, but say so once:
            // running the unpatcher under an already-repaired script is the
            // one configuration that is worse than not running it at all.
            if (!alreadyCurrentWarned && WebSocket.prototype.send !== shimSend) {
                alreadyCurrentWarned = true;
                console.warn("[unpatch] this mod already frames its own packets, so it does not need the "
                    + "unpatcher. Running both puts two sequence counters on one socket -- turn one of them off.");
            }
            return EXP.nativeSend.call(sock, renumber(sock, bytes));
        }
        try {
            const parsed = EXP.decode(bytes);
            if (Array.isArray(parsed) && typeof parsed[0] === "string") {
                const name = outName(parsed[0]);
                if (EXP.send(sock, name, parsed[1] === undefined ? [] : parsed[1])) {
                    log.framed++;
                } else {
                    if (log.dropped.indexOf(parsed[0]) === -1) log.dropped.push(parsed[0]);
                    console.warn('[unpatch] dropped unknown packet "' + parsed[0] + '"');
                }
                return;
            }
        } catch (e) { /* not plain msgpack */ }
        // Neither a frame nor msgpack. Raw garbage on an authenticated channel
        // gets the session dropped, so it stops here.
        log.unframeable++;
        console.warn("[unpatch] dropped an unframeable buffer (" + bytes.length + " bytes)");
    }

    /* --- send trampoline ------------------------------------------------ */
    const shimSend = WebSocket.prototype.send;   // installed by the transport
    let inModHook = false;

    function trampoline(data) {
        const current = WebSocket.prototype.send;
        if (current !== shimSend && !inModHook) {
            // A mod has installed its hook. It expects plain msgpack in its own
            // dialect, so unframe and rename before handing it over.
            const un = EXP.unframe(this, data);
            let give = data;
            if (un) {
                try { give = EXP.encode([outNameToMod(un.type), un.args]); } catch (e) {}
            }
            inModHook = true;
            try { return current.call(this, give); }
            finally { inModHook = false; }
        }
        return transmit(this, data);
    }
    EXP.setHandler(trampoline);

    // Mods save our send under one of these names and call it to bypass their
    // own hook. Pin them: a plain assignment would route those calls straight
    // back into the hook they are trying to skip.
    const passthrough = function (data) { return transmit(this, data); };
    ["nsend", "oldSend", "staticSend", "originalSend", "realSend"].forEach(function (alias) {
        try {
            Object.defineProperty(WebSocket.prototype, alias, {
                configurable: true,
                get: function () { return passthrough; },
                set: function () { /* keep ours */ }
            });
        } catch (e) {}
    });

    /* --- incoming ------------------------------------------------------- */
    // The game decodes with its own bundled codec straight off the raw event,
    // so rewriting every message would break it. A hook mod, though, always
    // attaches *after* the game has already set onmessage on that socket --
    // so a listener added once an onmessage exists is the mod's, and only
    // those get the rewritten copy.
    //
    // That rule misses one case: a full client replacement is the *first*
    // handler on its socket, because there is no game bundle underneath it, so
    // it gets mistaken for the game and handed raw numeric opcodes. Give it a
    // second, independent signal: a stack trace taken where the handler is
    // installed. A frame from an extension URL, or from a userscript manager's
    // wrapper, can only be a mod. This can only ever promote "game" to "mod"
    // on positive evidence -- a manager that injects without leaving a trace
    // (Violentmonkey's page mode) falls back to the ordering rule unchanged,
    // so nothing that worked before can start failing.
    const USERSCRIPT_FRAME = /(?:moz-extension|chrome-extension|safari-web-extension|safari-extension):\/\/|userscript\.html|\bGM_info\b/;
    function fromUserscript() {
        try {
            const s = new Error().stack;
            return typeof s == "string" && USERSCRIPT_FRAME.test(s);
        } catch (e) { return false; }
    }

    const hasOnMessage = new WeakSet();
    const wrapped = new WeakSet();     // never wrap the same listener twice
    let activeSocket = null;

    function translateForMod(sock, data) {
        const parsed = EXP.receive(sock, data);
        if (!parsed) return null;
        log.translatedIn++;
        return EXP.encode([inName(parsed.type), parsed.args]);
    }

    const addEL = WebSocket.prototype.addEventListener;
    WebSocket.prototype.addEventListener = function (type, fn, opts) {
        if (type !== "message" || typeof fn !== "function") return addEL.call(this, type, fn, opts);
        if (wrapped.has(fn)) return addEL.call(this, type, fn, opts);
        const sock = this
            , rewrite = hasOnMessage.has(this) || fromUserscript();
        const w = function (ev) {
            activeSocket = sock;
            try {
                if (!rewrite) return fn.call(this, ev);
                let translated = null;
                try { translated = translateForMod(sock, ev.data); } catch (e) {}
                if (translated === null) return fn.call(this, ev);
                return fn.call(this, { data: translated, target: sock, type: "message", origin: ev.origin });
            } finally { activeSocket = null; }
        };
        wrapped.add(w);
        return addEL.call(this, type, w, opts);
    };

    const desc = Object.getOwnPropertyDescriptor(WebSocket.prototype, "onmessage");
    if (desc && desc.set) {
        Object.defineProperty(WebSocket.prototype, "onmessage", {
            configurable: true,
            enumerable: desc.enumerable,
            get: desc.get,
            set: function (fn) {
                const sock = this;
                if (typeof fn === "function") {
                    const isGame = !hasOnMessage.has(sock) && !fromUserscript();
                    hasOnMessage.add(sock);
                    return desc.set.call(this, function (ev) {
                        activeSocket = sock;
                        try {
                            if (isGame) return fn.call(this, ev);   // the game's
                            let t = null;
                            try { t = translateForMod(sock, ev.data); } catch (e) {}
                            if (t === null) return fn.call(this, ev);
                            return fn.call(this, { data: t, target: sock, type: "message", origin: ev.origin });
                        } finally { activeSocket = null; }
                    });
                }
                return desc.set.call(this, fn);
            }
        });
    }

    /* --- window.msgpack -------------------------------------------------- */
    // Old mods `@require` msgpack-lite and reach for window.msgpack. Give them
    // one that speaks their dialect: numeric opcodes come back as the names
    // they were written against.
    const rawDecode = EXP.decode;
    function decodeForMod(data) {
        const parsed = rawDecode(data);
        if (activeSocket && Array.isArray(parsed) && typeof parsed[0] === "number") {
            const st = EXP.stateOf(activeSocket);
            if (st && st.mode === 1) {
                const name = st.tables.s2c.dec[parsed[0]];
                if (name !== undefined) return [inName(name), parsed[1]];
            }
        }
        return parsed;
    }
    // Three codec shapes turn up across this family: msgpack-lite's bare
    // { encode, decode }, msgpack5's factory call, and the game vendor's
    // { Encoder, Decoder } classes. They are all the same two functions, so
    // publish all three and no mod has to care which library it was written
    // against.
    function Codec() {}
    Codec.prototype.encode = EXP.encode;
    Codec.prototype.decode = decodeForMod;
    const codec = {
        encode: EXP.encode,
        decode: decodeForMod,
        Encoder: Codec,
        Decoder: Codec,
        createCodec: function () { return codec; }
    };
    if (hasWin) {
        window.msgpack = codec;
        try { if (!window.msgpack5) window.msgpack5 = function () { return codec; }; } catch (e) {}
        try { if (!window.MsgPack) window.MsgPack = codec; } catch (e) {}
        noteShim("msgpack");
    }

    /* --- the "@grant none" holes ----------------------------------------- */
    // Half of these mods were written against a granted sandbox and later saved
    // with "@grant none", which makes unsafeWindow and every GM_* function
    // undefined. Each use is then a ReferenceError, and a ReferenceError at the
    // top level stops the entire userscript -- so a mod looks completely dead
    // when one settings-storage call was all that actually broke.
    function define(name, value) {
        if (!hasWin) return;
        let already = false;
        try { already = typeof window[name] != "undefined"; } catch (e) {}
        if (already) return;
        try {
            Object.defineProperty(window, name, { configurable: true, writable: true, value: value });
            noteShim(name);
        } catch (e) {}
    }

    // Under "@grant none" a script runs in the page, so the page window IS
    // what unsafeWindow was asking for -- which is why this is a shim and not
    // a workaround.
    define("unsafeWindow", hasWin ? window : undefined);

    const PREFIX = "unpatch.gm:";
    const memory = {};
    function store() {
        try { return hasWin && window.localStorage ? window.localStorage : null; }
        catch (e) { return null; }          // storage blocked for this origin
    }
    function gmGet(key, fallback) {
        const s = store();
        let raw;
        if (s) { try { raw = s.getItem(PREFIX + key); } catch (e) {} }
        if (raw === null || raw === undefined) raw = memory[key];
        if (raw === null || raw === undefined) return fallback;
        try { return JSON.parse(raw); } catch (e) { return raw; }
    }
    function gmSet(key, value) {
        const raw = JSON.stringify(value === undefined ? null : value)
            , s = store();
        memory[key] = raw;
        if (s) { try { s.setItem(PREFIX + key, raw); } catch (e) {} }
    }
    function gmDelete(key) {
        const s = store();
        if (s) { try { s.removeItem(PREFIX + key); } catch (e) {} }
        delete memory[key];
    }
    function gmList() {
        const s = store()
            , out = Object.keys(memory);
        if (s) {
            try {
                for (let i = 0; i < s.length; i++) {
                    const k = s.key(i);
                    if (k && k.indexOf(PREFIX) === 0 && out.indexOf(k.slice(PREFIX.length)) === -1)
                        out.push(k.slice(PREFIX.length));
                }
            } catch (e) {}
        }
        return out;
    }

    define("GM_getValue", gmGet);
    define("GM_setValue", gmSet);
    define("GM_deleteValue", gmDelete);
    define("GM_listValues", gmList);
    define("GM_addStyle", function (css) {
        if (!hasDoc || typeof document.createElement != "function") return null;
        const el = document.createElement("style");
        el.textContent = css;
        const root = document.head || document.documentElement;
        if (root && typeof root.appendChild == "function") root.appendChild(el);
        return el;
    });
    define("GM_setClipboard", function (text) {
        try { return navigator.clipboard.writeText(String(text)); } catch (e) {}
    });
    define("GM_openInTab", function (url) {
        try { return window.open(url, "_blank"); } catch (e) { return null; }
    });
    define("GM_registerMenuCommand", function () { /* there is no manager menu to register into */ });
    define("GM_notification", function (opts) {
        console.info("[unpatch] mod notification:", opts && opts.text ? opts.text : opts);
    });
    define("GM_info", { script: { name: "unpatched mod", version: "0" }, scriptHandler: "MooUnpatcher" });
    // The promise-shaped GM.* namespace, for mods written against the newer API.
    define("GM", {
        getValue: function (k, d) { return Promise.resolve(gmGet(k, d)); },
        setValue: function (k, v) { return Promise.resolve(gmSet(k, v)); },
        deleteValue: function (k) { return Promise.resolve(gmDelete(k)); },
        listValues: function () { return Promise.resolve(gmList()); },
        setClipboard: function (t) { try { return navigator.clipboard.writeText(String(t)); } catch (e) {} },
        info: { script: { name: "unpatched mod", version: "0" }, scriptHandler: "MooUnpatcher" }
    });

    /* --- page furniture the mod expects and the page no longer has ------- */
    // Every mod of this era opens by tearing out the ads and the promo strip:
    //
    //     document.getElementById("adCard").parentNode.removeChild(...)
    //     document.getElementById("promoImgHolder").style.display = "none"
    //
    // moomoo has since removed most of those elements, so getElementById
    // returns null and the mod dies on its first line -- before it has drawn a
    // single menu. It is not a real dependency: the mod wants the thing gone,
    // and it already is.
    //
    // So for that closed list of ids only, hand back a real but hidden element.
    // Hiding it, removing it, or writing into it are all exactly the no-ops the
    // mod was asking for. Every other id still returns null, so feature tests
    // against ids the page really does have keep telling the truth -- including
    // at document-start, when everything is missing, because nothing on this
    // list is part of the game itself.
    const GONE_IDS = [
        "adCard", "promoImg", "promoImgHolder", "linksContainer1", "linksContainer2",
        "moomooio_728x90_home", "moomooio_300x250_home", "moomooio_160x600_home",
        "pre-content-container", "adsWrapper", "adBlockDetect",
        "ot-sdk-btn-floating", "ot-floating-button", "ot-floating-button__front",
        "ot-floating-button__back", "downloadButtonContainer",
        "mobileDownloadButtonContainer", "chromeIcon", "downloadBadge"
    ];
    try {
        if (hasWin && Array.isArray(window.UNPATCH_EXTRA_IDS)) {
            window.UNPATCH_EXTRA_IDS.forEach(function (id) {
                if (GONE_IDS.indexOf(id) === -1) GONE_IDS.push(id);
            });
        }
    } catch (e) {}

    const stubs = {};
    let attic = null;
    function stubFor(id) {
        if (Object.prototype.hasOwnProperty.call(stubs, id)) return stubs[id];
        if (!hasDoc || typeof document.createElement != "function") return null;
        if (!attic) {
            attic = document.createElement("div");
            attic.id = "unpatch-attic";
            attic.style.display = "none";
            const root = document.body || document.documentElement;
            if (root && typeof root.appendChild == "function") root.appendChild(attic);
        }
        const el = document.createElement("div");
        el.id = id;
        el.style.display = "none";
        // parented, so .parentNode.removeChild(el) and .parentElement.style
        // work too, rather than throwing one level further down
        if (attic && typeof attic.appendChild == "function") attic.appendChild(el);
        stubs[id] = el;
        log.placeholders.push(id);
        return el;
    }

    if (hasDoc && typeof document.getElementById == "function") {
        const rawById = document.getElementById.bind(document);
        try {
            document.getElementById = function (id) {
                const real = rawById(id);
                if (real) return real;
                if (GONE_IDS.indexOf(id) === -1) return real;
                return stubFor(id);
            };
            noteShim("removed page elements");
        } catch (e) { /* frozen document, nothing to be done */ }
    }

    /* --- keeping the constructor ours, and re-wrappable ------------------ */
    // The bundle hardens itself at boot:
    //
    //     const kn = window.WebSocket;                       // captured
    //     Object.defineProperty(window, "WebSocket",
    //         { value: kn, writable: false, configurable: false });
    //
    // That runs after us, so what it pins is our wrapper -- harmless for us,
    // fatal for the mod: any mod that wraps the constructor itself (to catch
    // the socket, read the connect URL, or keep a reference) is silently
    // ignored from then on, because the property no longer accepts writes.
    //
    // Installing it as a NON-CONFIGURABLE ACCESSOR turns that pin into a
    // TypeError, which the bundle already swallows in its own `catch {}`. The
    // property stays ours and stays assignable, so mods keep working and
    // nothing else in the page notices.
    //
    // The same accessor is where the connect URL gets repaired, and where the
    // sockets are remembered for the report.
    const seenSockets = [];
    let ctor = hasWin ? window.WebSocket : undefined;

    // The bundle builds its socket URL as
    //     "wss://" + host + "?token=" + encodeURIComponent("cf:" + turnstileToken)
    // A mod written against reCAPTCHA sends a token with no "cf:" prefix, or
    // no token at all, and the server closes the socket at once -- which from
    // the outside looks exactly like a mod stuck on "Connecting".
    // A captcha token is a credential, so it goes to the game server and
    // nowhere else. Mods in this family really do open sockets to third-party
    // hosts of their own (jester talks to a couple of glitch.me projects), and
    // appending the token to those would hand the user's Turnstile solve to
    // someone else's server. Two ways to qualify, both narrow:
    //   - the host is the page's own registrable domain or a subdomain of it
    //   - or the URL already carries a moomoo captcha token ("alt:", "re:" or
    //     "cf:"), which is unambiguous even on a private server
    function isGameSocket(text) {
        let host;
        try { host = new URL(text).hostname.toLowerCase(); } catch (e) { return false; }
        let page = "";
        try { page = (window.location.hostname || "").toLowerCase(); } catch (e) {}
        const domain = page.split(".").slice(-2).join(".");
        if (domain && (host === domain || host.slice(-(domain.length + 1)) === "." + domain)) return true;
        const found = /[?&]token=([^&]*)/.exec(text);
        if (!found) return false;
        let value = found[1];
        try { value = decodeURIComponent(found[1]); } catch (e) {}
        return /^(?:alt|re|cf):/.test(value);
    }

    function fixUrl(url) {
        let text;
        try { text = String(url); } catch (e) { return url; }
        if (!/^wss?:\/\//i.test(text)) return url;
        if (!isGameSocket(text)) return url;        // not ours to put a token on
        const tok = EXP.token();
        if (!tok) return url;                       // nothing better to offer
        const encoded = encodeURIComponent(tok);
        const found = /[?&]token=([^&]*)/.exec(text);
        if (found) {
            let decoded = found[1];
            try { decoded = decodeURIComponent(found[1]); } catch (e) {}
            if (decoded.indexOf("cf:") === 0) return text;      // already current
            log.urlFixes++;
            console.info("[unpatch] replaced a stale connect token on " + text.split("?")[0]);
            return text.replace(/([?&]token=)[^&]*/, "$1" + encoded);
        }
        log.urlFixes++;
        console.info("[unpatch] added the Turnstile token to " + text.split("?")[0]);
        return text + (text.indexOf("?") === -1 ? "?" : "&") + "token=" + encoded;
    }

    if (hasWin && typeof ctor == "function") {
        const inner = ctor;
        const Wrapped = function (url, protocols) {
            const fixed = fixUrl(url)
                , s = protocols === undefined ? new inner(fixed) : new inner(fixed, protocols);
            if (seenSockets.length < 32) seenSockets.push(s);
            return s;
        };
        Wrapped.prototype = inner.prototype;
        ["CONNECTING", "OPEN", "CLOSING", "CLOSED"].forEach(function (k) { Wrapped[k] = inner[k]; });
        ctor = Wrapped;
    }
    if (hasWin) {
        try {
            Object.defineProperty(window, "WebSocket", {
                configurable: false,
                enumerable: true,
                get: function () { return ctor; },
                set: function (v) { ctor = v; }
            });
            noteShim("WebSocket kept assignable");
        } catch (e) {
            console.warn("[unpatch] could not pin window.WebSocket", e);
        }
    }

    /* --- telling you what broke ------------------------------------------ */
    // The point of all this is that you stop having to read a mod line by line
    // to find out why it is dead. Whatever still throws gets matched against
    // the failure modes this family actually has, and named.
    const DIAGNOSES = [
        [/\b(unsafeWindow|GM_\w+|GM)\b is not defined/,
         function (m) {
             return "\"" + m[1] + "\" is a userscript-manager API that does not exist under \"@grant none\". "
                  + "The unpatcher shims it -- make sure it is ordered ABOVE the mod.";
         }],
        // "$" has no word boundary before it, so these two anchor on the start
        // of the message or a non-name character instead of \b.
        [/(?:^|\W)(?:\$|jQuery) is not defined/,
         function () { return "the mod's jQuery @require never loaded. Check that @require URL is still alive."; }],
        [/\bmsgpack5?\b is not defined/,
         function () { return "the mod's msgpack @require is dead (rawgit.com went offline in 2019). "
                            + "The unpatcher publishes window.msgpack -- order it above the mod."; }],
        [/Cannot read propert(?:y|ies) of (?:null|undefined) \(reading ['"]?([\w-]+)/,
         function (m) {
             return "the mod reached through something that is not there, for \"" + m[1] + "\". "
                  + "If it was a page element the game has removed, put its id in window.UNPATCH_EXTRA_IDS "
                  + "before the mod loads and it will get a hidden placeholder instead of null.";
         }],
        [/Cannot (?:assign to read only property|set property) ['"]?WebSocket/,
         function () { return "the game pinned window.WebSocket before the mod could wrap it. "
                            + "The unpatcher keeps it assignable -- order it above the mod."; }],
        [/(?:^|\W)([\w$]+) is not defined/,
         function (m) { return "the mod expects a global named \"" + m[1] + "\". Mods that scrape the game bundle "
                             + "for its minified variable names break on every rebuild, and that needs a real edit."; }]
    ];

    function diagnose(message) {
        if (!message) return null;
        for (let i = 0; i < DIAGNOSES.length; i++) {
            const m = DIAGNOSES[i][0].exec(message);
            if (m) return DIAGNOSES[i][1](m);
        }
        return null;
    }

    function record(message) {
        if (!message || log.errors.length >= 10) return;
        for (let i = 0; i < log.errors.length; i++) if (log.errors[i].message === message) return;
        const why = diagnose(message);
        log.errors.push({ message: message, diagnosis: why });
        console.warn("%c[unpatch]%c a script threw: " + message
            + (why ? "\n         -> " + why : "\n         -> not a failure mode the unpatcher knows about."),
            "color:#e74c3c;font-weight:bold", "color:inherit");
    }

    if (hasWin && typeof window.addEventListener == "function") {
        window.addEventListener("error", function (ev) {
            record(ev && ev.message ? String(ev.message) : (ev && ev.error ? String(ev.error) : ""));
        });
        window.addEventListener("unhandledrejection", function (ev) {
            const r = ev && ev.reason;
            record(r ? String(r.message || r) : "");
        });
    }

    // One line you can paste back instead of a whole mod file.
    function report() {
        let handshake = log.handshake;
        for (let i = 0; i < seenSockets.length && !handshake; i++)
            if (EXP.isSecure(seenSockets[i])) handshake = true;
        const out = {
            handshake: handshake,
            generation: generation,
            packetsFramed: log.framed,
            packetsTranslatedIn: log.translatedIn,
            unknownPacketNames: log.dropped.slice(),
            unframeableBuffers: log.unframeable,
            connectUrlFixes: log.urlFixes,
            shims: log.shims.slice(),
            placeholdersHandedOut: log.placeholders.slice(),
            errors: log.errors.slice()
        };
        console.info("[unpatch] report", out);
        return out;
    }

    const api = {
        generation: function () { return generation; },
        setGeneration: function (g) { generation = g; },
        outName: outName,
        inName: inName,
        transmit: transmit,
        report: report,
        diagnose: diagnose,
        fixUrl: fixUrl,
        goneIds: GONE_IDS,
        sockets: seenSockets,
        maps: { OLD_TO_NEW_OUT: OLD_TO_NEW_OUT, NEW_TO_OLD_IN: NEW_TO_OLD_IN, STRAGGLERS: STRAGGLERS }
    };
    try { if (hasWin) window.unpatch = api; } catch (e) {}
    return api;
}
)();

// A small console banner, because the whole point is that you install this and
// then install an old mod unchanged -- it should be obvious it is running, and
// obvious where to look when a mod still misbehaves.
console.info("%c[unpatch]%c active - transport, environment shims and boot diagnostics installed."
    + " Run unpatch.report() to see what it did.",
    "color:#8ecc51;font-weight:bold", "color:inherit");
