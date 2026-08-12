// ==UserScript==
// @name         ae86 real
// @icon         https://moomoo.io/
// @match        *://*.moomoo.io/*
// @match        https://mohmoh.eu/
// @run-at       document-start
// @grant        none
// @version      V0.2
// @description  I kill idiots with insta
// @author       Stary :3
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

    /* --- the "userscript manager detected" strip ------------------------ */
    // BEGIN page-guards (lifted verbatim by tools/build-ryn.js)
    // The bundle looks for a userscript manager and, if it finds one, draws a
    // red bar across the top of the page:
    //
    //     function ys(e) {
    //         if (document.getElementById("userscript-warning")) return;
    //         ...  i.id = "userscript-warning"; i.style.cssText = "...#c0392b..."
    //     }
    //
    // It is only a bar. Nothing else in the bundle reads it, no packet carries
    // it, and the server is never told -- ys() draws it and returns. It is also
    // unavoidable from here: the GM_* and unsafeWindow shims every script in
    // this repo installs are three of the four things ws() tests for, and the
    // fourth is an image probe against the extension's own files, which no page
    // script can influence.
    //
    // Its own first line is the way out. An element with that id already in the
    // document makes ys() a no-op, so put one there -- empty, hidden, and ours.
    // That is a guard rather than a removal: there is no flash of red to take
    // away afterwards, and it costs one div.
    function suppressWarningBanner() {
        if (typeof document == "undefined" || typeof document.createElement != "function") return;
        const WARNING = "userscript-warning";
        function plant() {
            const root = document.body || document.documentElement;
            if (!root || typeof root.appendChild != "function") return null;
            let mine = document.getElementById(WARNING);
            if (mine && mine.getAttribute("data-guard") !== "1") {
                // the bundle got there first -- the only case with anything to
                // remove, and the observer below is what makes that a flicker
                // rather than a permanent bar
                if (mine.parentNode) mine.parentNode.removeChild(mine);
                mine = null;
            }
            if (mine) {
                // Once there is a body, park it there: a div appended to <html>
                // before the parser reached <body> is odd, if harmless.
                if (document.body && mine.parentNode !== document.body) document.body.appendChild(mine);
                return mine;
            }
            const div = document.createElement("div");
            div.id = WARNING;
            div.setAttribute("data-guard", "1");
            div.style.display = "none";
            root.appendChild(div);
            return div;
        }
        // Ours can be taken away by anything that clears the body -- a mod
        // rebuilding the menu, the game's own DOM churn -- and the bundle's
        // 1.5s check would then find nothing in its way. Watching is cheap;
        // the bar is appended to document.body, so its direct children are the
        // whole of what needs watching.
        let watching = false;
        function watch() {
            if (watching || typeof MutationObserver != "function") return;
            const target = document.body;
            if (!target) return;
            watching = true;
            try { new MutationObserver(function() { plant(); }).observe(target, { childList: true }); }
            catch (e) { watching = false; }
        }
        function attempt() { plant(); watch(); }

        attempt();
        // At document-start there is no <html> yet -- in Chrome, document.body
        // AND document.documentElement are both null -- so the first attempt
        // has nothing to append to. Giving up there is exactly what let the bar
        // through: the guard ran once, found no document, and never tried
        // again. Keep trying until there is a body.
        if (!document.body && typeof setInterval == "function") {
            let tries = 0;
            const poll = setInterval(function() {
                attempt();
                if (watching || ++tries > 1000) clearInterval(poll);
            }, 10);
            if (typeof document.addEventListener == "function") {
                document.addEventListener("DOMContentLoaded", attempt);
                document.addEventListener("readystatechange", attempt);
            }
        }
    }

    /* --- getting past "Connecting..." ----------------------------------- */
    // Press ENTER GAME and the menu says "Connecting..." for ever, with no
    // error, no alert and no socket. It is not a mod bug and not a transport
    // bug. It is this, in the bundle:
    //
    //     function Fi() {
    //         !vi || ei || (ei = !0,
    //         Sa || pi ? ue && Lt("cf:" + ue) : ue ? Lt("cf:" + ue) : Lt())
    //     }
    //
    // `ue` is the Turnstile token and `ei` is "we already tried". On moomoo.io
    // the first branch is the live one, so if the token has not arrived when the
    // button is pressed, the whole statement is `ei = true` and nothing else --
    // no connect, and every press afterwards is a no-op because `ei` is set. The
    // click handler has already written "Connecting..." to the screen by then.
    // The dead end is latched: once pressed too early the tab can only be
    // reloaded. tools/probe-entry.js reproduces it against the shipped bundle
    // with no mod loaded at all.
    //
    // The token goes missing more easily than it looks. Turnstile refuses to
    // render into an element that is not laid out, and the bundle's renderer
    //
    //     const e = document.getElementById("turnstileWidget");
    //     if (!e || e.offsetParent === null) return !1;
    //
    // is polled every 150ms for 100 tries and then never again. A mod that lays
    // its menu over the page, hides the card the widget sits in, or is still
    // building at 15 seconds costs the page its captcha permanently.
    //
    // So: keep the widget rendering past the point the game gives up, and until
    // there is a token, do not let the press through to the handler that would
    // latch the dead end.
    const TURNSTILE_SITEKEY = "0x4AAAAAAAMYHI96GFiJzMmp";
    const TURNSTILE_API = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    const entryStats = { renders: 0, holds: 0 };
    // readToken/saveToken are parameters rather than closure references so that
    // this block can be lifted whole into a script that has no EXP core --
    // RYN carries its own client and its own token, and needed the same guard.
    function guardEntry(readToken, saveToken) {
        if (typeof window == "undefined" || typeof document == "undefined") return;
        let box = null, rendered = false, told = false, gaveUp = false;
        const started = Date.now();

        function haveToken() { try { return !!readToken(); } catch (e) { return false; } }

        function loadApi() {
            if (window.turnstile) return;
            try {
                if (document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) return;
                const s = document.createElement("script");
                s.src = TURNSTILE_API;
                s.async = true;
                (document.head || document.documentElement).appendChild(s);
            } catch (e) {}
        }

        // Somewhere visible and out of the way, used only when the game's own
        // widget cannot be rendered into. If the page's widget is laid out it is
        // left alone and the game solves it as usual.
        function ownHost() {
            const root = document.body || document.documentElement;
            if (!root) return null;
            box = document.createElement("div");
            box.id = "moo-turnstile-fallback";
            box.style.cssText = ["position:fixed", "right:12px", "bottom:12px", "z-index:2147483000",
                "background:rgba(0,0,0,.35)", "padding:6px", "border-radius:6px"].join(";");
            // The widget goes in a plain child, not in the fixed box itself:
            // offsetParent is null for a position:fixed element, and that is the
            // exact test the game uses to decide something is not laid out. No
            // reason to hand Cloudflare a target that reads as invisible by the
            // one measure known to matter here.
            const target = document.createElement("div");
            target.style.cssText = "width:300px;height:65px";
            box.appendChild(target);
            root.appendChild(box);
            return target;
        }

        function render() {
            if (rendered || !window.turnstile || typeof window.turnstile.render != "function") return;
            const page = document.getElementById("turnstileWidget");
            const usable = page && page.offsetParent !== null;
            // The game renders into its own widget the moment it can. Give it
            // six seconds of clear air before putting a second one on the page:
            // two widgets both work, but each solve is a round trip Cloudflare
            // did not need to be asked for.
            if (usable && (page.childElementCount > 0 || Date.now() - started < 6000)) return;
            const where = usable ? page : ownHost();
            if (!where) return;
            rendered = true;
            try {
                window.turnstile.render(where, {
                    sitekey: TURNSTILE_SITEKEY,
                    theme: "light",
                    callback: function(t) {
                        try {
                            if (typeof window.onGotTurnstileToken == "function") window.onGotTurnstileToken(t);
                            else saveToken(t);
                        } catch (e) { saveToken(t); }
                    },
                    "error-callback": function() {},
                    "expired-callback": function() {}
                });
                entryStats.renders++;
                console.info("[EXP] the page's Turnstile widget was not usable, so one was rendered "
                    + "bottom-right. Solve it and ENTER GAME will work.");
            } catch (e) {
                rendered = false;
                console.warn("[EXP] could not render Turnstile", e);
            }
        }

        function note(text) {
            if (told) return;
            told = true;
            try {
                const n = document.createElement("div");
                n.textContent = text;
                n.style.cssText = ["position:fixed", "left:50%", "bottom:16px", "transform:translateX(-50%)",
                    "z-index:2147483001", "background:#2c3e50", "color:#fff",
                    "font-family:Hammersmith One, sans-serif", "font-size:14px",
                    "padding:8px 14px", "border-radius:6px", "pointer-events:none"].join(";");
                (document.body || document.documentElement).appendChild(n);
                setTimeout(function() {
                    if (n.parentNode) n.parentNode.removeChild(n);
                    told = false;
                }, 4000);
            } catch (e) {}
        }

        // Capture on the document, so the press is stopped before it reaches the
        // button's own onclick -- which is where `ei` gets latched. Pointer and
        // touch go with it: the bundle hooks touch events onto the same button
        // and turns them into the same call.
        ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend"]
            .forEach(function(type) {
                try {
                    document.addEventListener(type, function(e) {
                        const btn = document.getElementById("enterGame");
                        if (!btn || !e.target) return;
                        if (e.target !== btn && !(btn.contains && btn.contains(e.target))) return;
                        if (haveToken()) return;
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        entryStats.holds++;
                        note(gaveUp
                            ? "Cloudflare check unavailable - reload, or allow challenges.cloudflare.com"
                            : "Waiting for the Cloudflare check. ENTER GAME will work as soon as it passes.");
                    }, true);
                } catch (e) {}
            });

        function tick() {
            if (haveToken()) {
                // the game does this in its own callback; doing it again costs
                // nothing and covers a mod that put the class back
                try {
                    const btn = document.getElementById("enterGame");
                    if (btn && btn.classList) btn.classList.remove("disabled");
                } catch (e) {}
                if (box && box.parentNode) { box.parentNode.removeChild(box); box = null; }
                return;
            }
            if (Date.now() - started > 120000) { gaveUp = true; return; }
            loadApi();
            render();
            setTimeout(tick, 500);
        }
        if (document.readyState === "loading" && typeof document.addEventListener == "function") {
            document.addEventListener("DOMContentLoaded", function() { setTimeout(tick, 500); });
        } else {
            setTimeout(tick, 500);
        }
    }

    // END page-guards
    // Both are page-level and idempotent, and both have to be in place before
    // the bundle's own timers run, so they go in here rather than in any one
    // script's boot.
    try { suppressWarningBanner(); } catch (e) {}
    try { if (window.MOO_ENTRY_GUARD !== false) guardEntry(token, function(t) { captchaToken = t; }); } catch (e) {}

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
        entryStats: function() { return { turnstileRenders: entryStats.renders, entryPressesHeld: entryStats.holds }; },
        nativeSend: nativeSend,
        PACKET_MAP: PACKET_MAP,
        // exposed for the test harness
        _internals: { buildTables, tag, hexToBytes, HEADER_LEN, MODE_SECURE, states }
    };
}
)();

/* Everything below touches the DOM, so it waits for the document. Only the
 * protocol shim above runs at document-start. */
function __ae86Boot() {

// The captcha moved from ALTCHA to Cloudflare Turnstile. #altcha_checkbox no
// longer exists, and Turnstile is not a checkbox that can be auto-clicked --
// the player solves it and the game enables its own Enter Game button. The
// old 10ms polling interval is gone with it.
//
// The block that removed the game's <script src="index-f3a4c1ad.js"> is also
// gone. This mod has no socket of its own: it hooks the one the game creates.
// Removing the game bundle would leave it with nothing to hook -- and the
// hard-coded build hash stopped matching long ago anyway.



document.addEventListener("keydown", function(event) {
    if (event.keyCode === 192) {
        const chatHolder = document.getElementById("gameUI");
        if (chatHolder) {
            const currentDisplay = chatHolder.style.display;
            chatHolder.style.display = currentDisplay === "none" ? "block" : "none";
        }
    }
});
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

function getEl(id) {
    return document.getElementById(id);
}
function showLoadingText(text) {
    mainMenu.style.display = "block";
    gameUI.style.display;
    menuCardHolder.style.display;
    diedText.style.display;
    loadingText.style.display;
    loadingText.innerHTML = text + "<a href='javascript:window.location.href=window.location.href' class='ytLink'>reload</a>";
}
let newFont = document.createElement("link");
newFont.rel = "stylesheet";
newFont.href = "https://fonts.googleapis.com/css?family=Ubuntu:700";
newFont.type = "text/css";
document.body.append(newFont);

// msgpack is bundled in the protocol shim at the top of this file now.
// The old rawgit.com CDN has been dead since 2019.

// AD REMOVAL -- guarded, because at document-start (and on pages that never
// had the card) getElementById returns null and an unguarded .remove() threw,
// which killed the whole script on its very first lines.
let adCardToRemove = document.getElementById("wideAdCard");
if (adCardToRemove) adCardToRemove.remove();
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
        killChat: true,
        autoBuy: false,
        alwaysFlipper: true,
        autoBuyEquip: true,
        autoPush: true,
        shouldHeal: true,
        autoOneFrame: true,
        doAutoBullSpam: true,
        doPingHeal: true,
        revTick: true,
        spikeTick: true,
        predictTick: true,
        autoPlace: true,
        autoReplace: true,
        autoPrePlace: true,
        OnlyHighMsOrWantOpPreplace: true,
        antiTrap: true,
        slowOT: true,
        attackDir: true,
        showDir: true,
        autoPrePlace: true,
        autoRespawn: true
    };
}

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
window.toggleNight = function() {};
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

let nightMode = document.createElement("div");
nightMode.id = "nightMode";
document.body.appendChild(nightMode);
HTML.set("nightMode");
HTML.setStyle(`
            display: none;
            position: absolute;
            pointer-events: none;
            background-color: rgb(0, 0, 100);
            opacity: 0;
            top: 0%;
            width: 100%;
            height: 100%;
            animation-duration: 5s;
            animation-name: night2;
            `);
HTML.resetHTML();
HTML.setCSS(`
            @keyframes night1 {
                from {opacity: 0;}
                to {opacity: 0.35;}
            }
            @keyframes night2 {
                from {opacity: 0.35;}
                to {opacity: 0;}
            }
            `);

let menuDiv = document.createElement("div");
menuDiv.id = "menuDiv";
document.body.appendChild(menuDiv);
HTML.set("menuDiv");
HTML.setStyle(`
            position: absolute;
            left: 20px;
            top: 20px;
            `);
HTML.resetHTML();
HTML.setCSS(`
.menuClass {
    font-family: "Montserrat Alternates";
    font-size: 12px;
    color: #fff;
    text-align: left;
    padding: 10px;
    padding-top: 7px;
    padding-bottom: 5px;
    width: 300px;
    background-color: rgba(0, 0, 0, 0.25); /* Transparenter Hintergrund */
    border-radius: 10px; /* Abgerundete Ecken */
    box-shadow: 0px 0px 20px rgba(0, 0, 0, 0.7); /* Stärkere Schattierung */
}

.menuC {
    display: none;
    font-family: "Montserrat Alternates";
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
    font-family: "Montserrat Alternates";
    font-size: 12px;
    text-align: center;
    background-color: rgb(25, 25, 25);
    color: #fff;
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
    font-family: "Montserrat Alternates";
    font-size: 12px;
    color: #000;
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

.Cselect {
    font-family: "Montserrat Alternates";
    font-size: 12px;
    border-radius: 4px;
    background-color: rgb(75, 75, 75);
    color: #fff;
    border: 1px solid #000;
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
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:active {
    background-color: rgb(230, 230, 230);
}

`);
HTML.startDiv({
    id: "menuHeadLine",
    class: "menuClass"
}, (html) => {
    html.add(``);
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
        html.button({
            class: "menuB",
            innerHTML: "Freeze Player",
            onclick: "window.freezePlayer()"
        });
        html.button({
            class: "menuB",
            innerHTML: "Dagger optiomazation",
            oneclick: "window.rushmode()"
        });
    });
    HTML.addDiv({
        id: "menuMain",
        style: "display: block",
        class: "menuC",
        appendID: "menuHeadLine"
    }, (html) => {
        html.newLine();
        html.add(`Auto-Grinder: `);
        html.checkBox({
            id: "weaponGrind",
            class: "checkB",
            onclick: "window.startGrind()"
        });
        html.newLine(2);
        html.add(`AutoHeal:`);
        html.checkBox({
            id: "healingBeta",
            class: "checkB",
            checked: true
        });
        html.newLine(2);
        html.add(`BESTANTISPIKETICK:`);
        html.checkBox({
            id: "BESTANTISPIKETICK",
            class: "checkB",
            checked: true
        });
        html.newLine(2);
        html.add(`best antitick ever:`);
        html.checkBox({
            id: "ANTITICK",
            class: "checkB",
            checked: true
        });
        html.newLine(2);
        html.add(`BackUp Antitick:`);
        html.checkBox({
            id: "antitick",
            class: "checkB",
            checked: true
        });
        html.newLine(2);
        html.add(` ASpin :`);
        html.checkBox({
            id: "spin",
            class: "checkB",
            value: "spin",
            checked: false
        });
        html.add(`SPINS SPIKES AND WINDMILS: `);
        html.select({
            id: "visualType", class: "Cselect", option: {
                "ae86": {
                    id: "ae86",
                    selected: true
                },
                "ueh": {
                    id: "ueh",
                }
            }
        });
        html.add(`Songs working ones`);
        html.select({
            id: "song", class: "Cselect", option: {
                "Dead Of night": {
                    id: "0",
                    selected: true
                },
                "none": {
                    id: "1",
                }
            }
        });
        html.newLine(2);
        html.add(`TryHardReplace:`);
        html.checkBox({
            id: "combatss",
            class: "checkB",
            checked: true
        });
        html.newLine(2);
        html.add(`Counter first:`);
        html.checkBox({
            id: "countertur",
            class: "checkB",
            checked: true
        });
        html.newLine(2);
        html.add(`counter Second:`);
        html.checkBox({
            id: "countersec",
            class: "checkB",
            checked: true
        });
        html.newLine();
        html.add("Soldier/barb: ");
        html.checkBox({
            id: "soldieranti",
            class: "checkB",
            checked: true
        });
        html.add(`Combat Hatchanger`);
        html.select({
            id: "combat", class: "Cselect", option: {
                "ae86": {
                    id: "ae",
                    selected: true
                },
                "bk": {
                    id: "bk86",
                },
                "lore": {
                    id: "lore",
                },
                "cosmic": {
                    id: "cosmic",
                },
                "emre": {
                    id: "emre",
                },
                "hisy": {
                    id: "hisy",
                },
                "EwV": {
                    id: "EwV",
                },
                "Totalew": {
                    id: "Totalew",
                },
                "WasdMode": {
                    id: "WasdMode",
                },
                "Oldae": {
                    id: "Oldae",
                },
                "TesterMode": {
                    id: "TesterMode",
                },
                "Jet": {
                    id: "Jet",
                },
                "fz1": {
                    id: "fz1",
                },
                "fz": {
                    id: "fz",
                },
                "zyenith": {
                    id: "zyenith",
                },
                "hans": {
                    id: "hans",
                },
                "Pixelz": {
                    id: "Pixelz",
                },
                "goofy": {
                    id: "goof",
                },
                "resp": {
                    id: "resp",
                },
                "Uncve": {
                    id: "Uncve",
                },
                "2yl": {
                    id: "2yl",
                }
            }
        });
        html.newLine(2);
        html.add(`Spike Tick:`);
        html.checkBox({
            id: "spiketick",
            class: "checkB",
            checked: true
        });
        html.newLine(2);
        html.add('Ms Replacer');
        html.select({
            id: "combats",
            class: "Cselect",
            option: {
                'NormalMsCrazy': {
                    id: 'NormalMs',
                },
                'Fz': {
                    id: 'FzTryMode',
                    selected: true
                },
            }
        });
        html.newLine();
        html.add(`Songs: `);
        html.select({
            id: "songy", class: "Cselect", option: {
                "EXECUTIONER - DJ FKU": {
                    id: "6"
                },
                "No Way (with Avi Snow)": {
                    id: "7"
                },
                "Give Up": {
                    id: "8"
                },
                "No Money": {
                    id: "9"
                },
                "In Love With A Ghost": {
                    id: "10"
                },
                "Retro Love": {
                    id: "11"
                },
                "One Of Us": {
                    id: "12"
                },
                "Stay The Night": {
                    id: "13"
                },
                "Cricket (we nice)": {
                    id: "14"
                },
                "Rally Up!": {
                    id: "15"
                },
                "Paradise - N3WPORT, Britt Lari": {
                    id: "16"
                },
                "The Path (Ft. Agassi)": {
                    id: "17"
                },
                "Find You There": {
                    id: "18"
                },
                "Initial D - No One Sleep In Tokyo": {
                    id: "14"
                },
                "UNSECRET & Noeni - Fallout": {
                    id: "15"
                },
                "V O E - Giants": {
                    id: "16"
                },
                "Neoni - Champion": {
                    id: "17"
                },
                "JPB & Mendum - Losing Control": {
                    id: "18"
                },
                "Into The Wild": {
                    id: "19"
                },
                "Only The Fallen": {
                    id: "20"
                },
                "What's The Problem?": {
                    id: "21"
                },
                "Heart My Heart": {
                    id: "22"
                },
                "Are You With Me": {
                    id: "23"
                },
                "Strobe - NIVIRO": {
                    id: "24"
                },
                "I Can Feel - Syn Cole": {
                    id: "25"
                },
                "Shine x Never Have I Felt This (VIP) Mashup": {
                    id: "26"
                },
                "NCS - Mortals": {
                    id: "27"
                },
                "NEFFEX - Desperate": {
                    id: "28"
                },
                "Royalty - Egzod, Maestro Chives, Neoni": {
                    id: "29",
                },
                "ROY KNOX - Your Poison": {
                    id: "30",
                    selected: true
                },
                "BackStreet boys": {
                    id: "31",
                },
            }
        });
    });
    html.newLine();
    html.add(`BrightnessType: `);
    html.select({
        id: "brightnesstype", class: "Cselect", option: {
            "Morning": {
                id: "fz",
                selected:true

            },
        }
    });
    HTML.addDiv({
        id: "menuMain",
        style: "display: block",
        class: "menuC",
        appendID: "menuHeadLine"
    }, (html) => {
        html.add(`Sync/Anti`);
        html.newLine(2);
        html.add(`SyncType: `);
        html.select({
            id: "syncType", class: "Cselect", option: {
                "InstaSync": {
                    id: "s1",
                },
                "BullHitSync": {
                    id: "s2",
                    selected: true
                }
            }
        });
        html.newLine();
        html.add("Sync: ");
        html.checkBox({
            id: "musketSync",
            class: "checkB",
            checked: false
        });
        html.newLine();
        html.add("Auto Sync On Second: ");
        html.checkBox({
            id: "autosyncsec",
            class: "checkB",
            checked: true
        });
        html.newLine();
        html.add("Auto Sync On Hited: ");
        html.checkBox({
            id: "autosyncHited",
            class: "checkB",
            checked: true
        });
        html.newLine();
        html.add("Anti Sync2: ");
        html.checkBox({
            id: "antisync",
            class: "checkB",
            checked: true
        });
        html.newLine();
        html.add("Emp Anti: ");
        html.checkBox({
            id: "SmartEmpSoldierAnti",
            class: "checkB",
            checked: false
        });
        html.newLine();
        html.add("Soldier anti: ");
        html.checkBox({
            id: "SmartEmpSoldierAnti",
            class: "checkB",
            checked: true
        });

        html.newLine(2);
        html.add("AntiKick:");
        html.checkBox({
            id: "antikick",
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
        html.add(`AutoPlacer Placement Tick: `);
        html.text({
            id: "autoPlaceTick",
            class: "customText",
            value: "2",
            size: "2em",
            maxLength: "1"
        });
        html.newLine();
        html.add(`Configs: `);
        html.selectMenu({
            id: "configsChanger",
            class: "Cselect",
            menu: configs
        });
        html.newLine();
        html.add(`InstaKill Type: `);
        html.select({
            id: "instaType",
            class: "Cselect",
            option: {
                AE86: {
                    id: "normal",
                    selected: true
                },
                revtick: {
                    id: "rev"
                }
            }
        });
        html.newLine();
        html.add(`AntiBull Type: `);
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
                    id: "abalway"
                }
            }
        });
        html.newLine();
        html.add(`Backup Nobull Insta: `);
        html.checkBox({
            id: "backupNobull",
            class: "checkB",
            checked: false
        });
        html.newLine();
        html.add(`Turret Gear Combat Assistance: `);
        html.checkBox({
            id: "turretCombat",
            class: "checkB",
            checked: true
        });
        html.newLine();
        html.add(`Safe AntiSpikeTick: `);
        html.checkBox({
            id: "safeAntiSpikeTick",
            class: "checkB",
            checked: true
        });
        html.newLine();
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
        html.button({
            class: "menuB",
            innerHTML: "Connect FBots",
            onclick: "window.connectFillBots()"
        });
        html.button({
            class: "menuB",
            innerHTML: "Disconnect FBots",
            onclick: "window.destroyFillBots()"
        });
        html.newLine();
        html.button({
            class: "menuB",
            innerHTML: "Reset Break Objects",
            onclick: "window.resBuild()"
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
        html.add(`Predict Movement Type: `);
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
        html.newLine(2);
        html.button({
            class: "menuB",
            innerHTML: "Toggle Fbots Circle",
            onclick: "window.toggleBotsCircle()"
        });
        html.newLine();
        html.add(`Circle Rad: `);
        html.text({
            id: "circleRad",
            class: "customText",
            value: "200",
            size: "3em",
            maxLength: "4"
        });
        html.newLine();
        html.add(`Rad Speed: `);
        html.text({
            id: "radSpeed",
            class: "customText",
            value: "0.1",
            size: "2em",
            maxLength: "3"
        });
        html.newLine();
        html.add(`Bot Zetup Type: `);
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
                "Zhort-Zword Muzket": {
                    id: "zd"
                }
            }
        });
        html.newLine(2);
        html.add(`Cross World: `);
        html.checkBox({
            id: "funni",
            class: "checkB"
        });
        html.newLine();
        html.add("Show Grid: ");
        html.checkBox({
            id: "gridshow",
            class: "checkB",
            checked: true
        });
        html.newLine();
        html.button({
            class: "menuB",
            innerHTML: "Toggle Another Visual",
            onclick: "window.toggleVisual()",
        });
        html.newLine();
    });
});

let menuChatDiv = document.createElement("div");
menuChatDiv.id = "menuChatDiv";
document.body.appendChild(menuChatDiv);
HTML.set("menuChatDiv");
HTML.setStyle(`
            `);
HTML.resetHTML();
HTML.setCSS(`
            `);
HTML.startDiv({id: "mChDiv", class: "chDiv"}, (html) => {
    HTML.addDiv({id: "mChMain", class: "chMainDiv", appendID: "mChDiv"}, (html) => {
    });
    html.text({id: "mChBox", class: "chMainBox", placeHolder: ``});
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
    text = `<plaintext>${text}`;
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
    addMenuChText(null, "", "white", 1) // chat history
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
            font: 0px Hammersmith One;
            bottom: 0px;
            left: 20x;
            `);
HTML.resetHTML();
HTML.setCSS(`
            .sizing {
                font-size: 0px;
            }
            .mod {
                font-size: 0px;
                display: inline-block;
            }
            `);
HTML.startDiv({
    id: "uehmod",
    class: "sizing"
}, (html) => {
    html.add(``);
    HTML.addDiv({
        id: "pingFps",
        class: "mod",
        appendID: "uehmod"
    }, (html) => {
        html.add("");
    });
    html.newLine();
    html.add("");
    HTML.addDiv({
        id: "",
        class: "mod",
        appendID: "uehmod"
    }, (html) => {
        html.add("");
    });
    html.newLine();
    html.add("");
    HTML.addDiv({
        id: "",
        class: "mod",
        appendID: "uehmod"
    }, (html) => {
        html.add("");
    });
    html.newLine();
    html.add(``);
    HTML.addDiv({
        id: "packetStatus",
        class: "mod",
        appendID: "uehmod"
    }, (html) => {
        html.add("");
    });
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

// Registered with the shim installed at document-start, which already owns
// WebSocket.prototype.send (the game captured that reference at load).
EXP.setHandler(function(message) {
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
        // Unframe: strips the MAC and turns the numeric opcode back into the
        // string name the rest of this client is written against.
        const parsed = EXP.unframe(this, message);
        if (!parsed) return EXP.nativeSend.call(this, message);

        const outgoing = applyOutgoing(parsed.type, parsed.args);
        if (outgoing) {
            EXP.send(this, outgoing.type, outgoing.data);

            // START COUNT:
            if (!firstSend.sec) {
                firstSend.sec = true;
                setTimeout(() => {
                    firstSend.sec = false;
                    secPacket = 0;
                }, secTime);
            }

            if (secPacket == 100) {
                addMenuChText("Warn", "Sending Too Many Packets", "#cc5151", 1);
            }

            secPacket++;
        }
    } else {
        EXP.nativeSend.call(this, message);
    }
});

// The client's outgoing packet rules. Mutates `data` in place; returns false
// to drop the packet. Shared by the socket hook and by packet(), so injected
// packets get exactly the same treatment as the game's own.
function applyOutgoing(type, data) {
        dontSend = false;

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
            data[0].name = data[0].name == "" ? "Botss" : data[0].name;
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
        } else if (type == "9") {
            if (data[1]) {
                if (player.moveDir == data[0]) {
                    dontSend = true;
                }
                player.moveDir = data[0];
            } else {
                dontSend = true;
            }
        }
        return dontSend ? false : { type: type, data: data };
}

function packet(type) {
    // EXTRACT DATA ARRAY:
    let data = Array.prototype.slice.call(arguments, 1);

    // Runs the same outgoing rules as the game's own packets, then frames.
    const outgoing = applyOutgoing(type, data);
    if (outgoing) EXP.send(WS, outgoing.type, outgoing.data);
}

function origPacket(type) {
    // EXTRACT DATA ARRAY:
    let data = Array.prototype.slice.call(arguments, 1);

    // Bypasses the outgoing rules, but still has to be framed.
    EXP.send(WS, type, data);
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
    // Maps the numeric opcode back to the string name this client uses.
    let parsed = EXP.receive(message.target || WS, message.data);
    if (!parsed) return;
    let type = parsed.type;
    let data = parsed.args;
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
        // Y: remProjectile, // 19: remProjectile,
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
// MINIMAP:
function updateMinimap(data) {
    minimapData = data;
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
//preplacer tests for better results
let preplaceDelay = {
    killObject: -1,
    gatherAnimation: -1,
    total: function() {
        return (new Date() - Math.abs(Math.trunc(this.killObject - this.gatherAnimation)));
    },
}
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

var camX, camY;
var tmpDir;
var skinColor = 0;
var selectColorIndex = 0;
var maxScreenWidth = config.maxScreenWidth * 1;
var maxScreenHeight = config.maxScreenHeight * 1;
var screenWidth, screenHeight;
var inGame = false;
var adContainer = document.getElementById("ad-container");
var mainMenu = document.getElementById("mainMenu");
$("#mainMenu").css({
    "background-color": "rgba(0, 0, 0, 0.5)",
    position: "absolute",
    width: "100%",
    height: "100%",
    "z-index": "10",
});
var gameTitle = document.getElementById("gameName");
var enterGameButton = document.getElementById("enterGame");
var promoImageButton = document.getElementById("promoImg");
promoImageButton.remove();
var promoImageHolder = document.getElementById("promoImgHolder");
$("#promoImgHolder").css({
    "text-align": "left",
    "font-size": "12px",
    "overflow-y": "scroll",
    //            "overflow-x": "scroll",
    "max-height": "100px",
    //            "max-width": "300px"
});
var menuText = document.getElementById("desktopInstructions");
menuText.innerHTML = `       `;
var partyButton = document.getElementById("partyButton");
var joinPartyButton = document.getElementById("joinPartyButton");
var settingsButton = document.getElementById("settingsButton");
var settingsButtonTitle = settingsButton.getElementsByTagName("span")[0];
var allianceButton = document.getElementById("allianceButton");
var wideAdCard = document.getElementById("wideAdCard");
var storeButton = document.getElementById("storeButton");
var chatButton = document.getElementById("chatButton");
var gameCanvas = document.getElementById("gameCanvas");
var mainContext = gameCanvas.getContext("2d");
var serverBrowser = document.getElementById("serverBrowser");
var nativeResolutionCheckbox = document.getElementById("nativeResolution");
var showPingCheckbox = document.getElementById("showPing");
var playMusicCheckbox = document.getElementById("playMusic");
var pingDisplay = document.getElementById("pingDisplay");
var shutdownDisplay = document.getElementById("shutdownDisplay");
var setupCard = document.getElementById("setupCard");
let menuContainer = document.getElementById("menuContainer");
var menuCardHolder = document.getElementById("menuCardHolder");
var guideCard = document.getElementById("guideCard");
var loadingText = document.getElementById("loadingText");
var gameUI = document.getElementById("gameUI");
var actionBar = document.getElementById("actionBar");
var resourceDisplay = document.getElementsByTagName("resDisplay");
var scoreDisplay = document.getElementById("scoreDisplay");
var foodDisplay = document.getElementById("foodDisplay");
var woodDisplay = document.getElementById("woodDisplay");
var stoneDisplay = document.getElementById("stoneDisplay");
var killCounter = document.getElementById("killCounter");
var leaderboard = document.getElementById("leaderboard");
var adCard = document.getElementById("adCard");
adCard.remove();
var leaderboardData = document.getElementById("leaderboardData");
var nameInput = document.getElementById("nameInput");
var itemInfoHolder = document.getElementById("itemInfoHolder");
var ageText = document.getElementById("ageText");
var ageBarBody = document.getElementById("ageBarBody");
var upgradeHolder = document.getElementById("upgradeHolder");
var upgradeCounter = document.getElementById("upgradeCounter");
var allianceMenu = document.getElementById("allianceMenu");
var allianceHolder = document.getElementById("allianceHolder");
var allianceManager = document.getElementById("allianceManager");
var mapDisplay = document.getElementById("mapDisplay");
var diedText = document.getElementById("diedText");
var skinColorHolder = document.getElementById("skinColorHolder");
var mapContext = mapDisplay.getContext("2d");
mapDisplay.width = 300;
mapDisplay.height = 300;
var storeMenu = getEl("storeMenu");
var storeHolder = getEl("storeHolder");
var noticationDisplay = getEl("noticationDisplay");
var outlineColor = "#525252";
var darkOutlineColor = "#3d3f42";
var outlineWidth = 5.5;
window.addEventListener("wheel", (event) => {
    const storeMenu = document.getElementById("storeMenu")
    const allianceMenu = document.getElementById("allianceMenu")
    if (storeMenu.style.display !== "none" || allianceMenu.style.display !== "none" || HTML.isVisible) return

    if (!player.alive || document.activeElement.tagName !== "BODY") return

})
let pixelDensity = 1;
let delta;
let now;
let lastUpdate = performance.now();
let mouseX = 0;
let mouseY = 0;
let waterMult = 1;
let waterPlus = 0;
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

let macro = {};
let mills = {
    place: 0,
    placeSpawnPads: 0
};
let lastDir;

let lastLeaderboardData = [];

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
    pingDisplay.innerText = "";
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
        this.init = function (x, y, scale, speed, life, text, color) {
            this.x = x;
            this.y = y;
            this.color = color;
            this.scale = scale;
            this.startScale = this.scale;
            this.maxScale = scale * 1.5;
            this.scaleSpeed = 0.7;
            this.speed = speed;
            this.life = life;
            this.text = text;
            this.acc = 1;
            this.alpha = 0;
            this.maxLife = life;
            this.ranX = UTILS.randFloat(-1, 1);
        };
        this.update = function (delta) {
            if (this.life) {
                this.life -= delta;
                if (config.anotherVisual) {
                    this.y -= this.speed * delta * this.acc;
                    this.acc -= delta / (this.maxLife / 2.5);
                    if (this.life <= 8) {
                        if (this.alpha > 0) {
                            this.alpha = Math.max(0, this.alpha - delta / 12);
                        }
                    } else if (this.alpha < 1) {
                        this.alpha = Math.min(1, this.alpha + delta / 64);
                    }
                    this.x += this.ranX;
                } else {
                    this.y -= this.speed * delta;
                }
                this.scale += this.scaleSpeed * delta;
                if (this.scale >= this.maxScale) {
                    this.scale = this.maxScale;
                    this.scaleSpeed *= -1;
                } else if (this.scale <= this.startScale) {
                    this.scale = this.startScale;
                    this.scaleSpeed = 0;
                }
                if (this.life <= 0) {
                    this.life = 0;
                }
            }
        };
        this.render = function (ctxt, xOff, yOff, value) {
            ctxt.lineWidth = 0xa;
            ctxt.fillStyle = this.color;
            ctxt.font = this.scale + "px " + (config.anotherVisual ? "Hammersmith One" : "Hammersmith One");
            if (config.anotherVisual) {
                ctxt.globalAlpha = this.alpha;
                ctxt.strokeStyle = "#3d3f42";
                ctxt.strokeText(this.text, this.x - xOff, this.y - yOff);
            }
            ctxt.fillText(this.text, this.x - xOff, this.y - yOff);
            ctxt.globalAlpha = 1;
        };
    }
}
;
class Textmanager {
    // TEXT MANAGER:
    constructor() {
        this.texts = [];
        this.stack = [];

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
            return (this.health <= 100);
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
        this.isReloaded = function(id = this.weaponIndex) {
            return this.reloads[id] <= 0;
        }
        // CHECK TEAM:
        this.isTeamObject = function(tmpObj) {
            return this.owner == null ? true : (this.owner && tmpObj.sid == this.owner.sid || tmpObj.findAllianceBySid(this.owner.sid));
        };
    }
}
function checkPotHit() {
    return player.isReloaded(player.weaponCode) || near.isReloaded(near.weapons[0]) || near.isReloaded(near.weapons[1]);
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
            name: "apple",
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
            name: "apple",
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
const isReloaded = () => player.reloads[player.weaponIndex] >= 1;
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
        this.backupNobull = true;
        this.circle = false;
        this.circleRad = 200;
        this.circleRadSpd = 0.1;
        this.cAngle = 0;
        // SPAWN:
        this.spawn = function(moofoll) {
            this.attacked = false;
            this.timeDamaged = 0;
            this.timeHealed = 100;
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
            this.weaponXP = [3000];
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
            this.BarbarianAnti = false;
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
            if (this.poisonTimer < 0) {
                this.setPoisonTick = false;
                this.poisonTick = game.tick - 1;
                this.poisonTimer = config.serverUpdateRate;
                plaguemask = true;
                setTimeout(() => {
                    plaguemask = false;
                }, 1000);
            } else if(this.poisonTimer >= 0) {
                plaguemask = false;
            }
        };
        this.update = function(delta) {
            if (this.sid == playerSID) {
                this.circleRad = parseInt(getEl("circleRad").value) || 0;
                this.circleRadSpd = parseFloat(getEl("radSpeed").value) || 0;
                this.cAngle += this.circleRadSpd;
            }
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
            this.lastshamecount = this.shameCount;
            if (this.oldHealth < this.health) {
                if (this.hitTime) {
                    let timeSinceHit = game.tick - this.hitTime;
                    this.lastHit = game.tick;
                    this.hitTime = 0;
                    if (timeSinceHit < 2) {
                        this.shameCount++;
                    } else {
                        this.shameCount = Math.max(0, this.shameCount - 2);
                    }
                }
            } else if (this.oldHealth > this.health) {
                this.hitTime = game.tick;
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
            if (this.reloads[this.weaponIndex] <= 1/20) {
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
        }
        // PREPLACER
        let closestBuild = [];
        function findTargetBuildToSpike(checkSpike, trapDistance, targetDistance, targetAngle) {
            if (!document.getElementById('sp').checked) return;
            if (!enemy.length && !configs.autoPrePlace) return;
            closestBuild = gameObjects.filter(obj => obj.active && obj.buildHealth)
                .sort((a, b) => UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2))[0];
            if (!closestBuild) return;
            checkSpike = 250;
            trapDistance = 250;
            targetDistance = UTILS.getDist(closestBuild, player, 0, 2);
            targetAngle = UTILS.getDirect(closestBuild, player, 0, 2);
            if (player.alive && targetDistance < checkSpike && near.dist2 < trapDistance &&
                !traps.inTrap && !instaC.isTrue && !instaC.canSpikeTick && !clicks.middle && !clicks.left) {
                if (closestBuild.buildHealth < items.weapons[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]].dmg * 2) {

                    if (document.getElementById('stype').value == "D") {
                        for (let i = 0; i < 6; i++) {
                            let angle = i + 45 * (i % 2 ? -1 : 1) / 180 * Math.PI + near.aim2;
                            checkPlace(2, i);
                        }
                    } else {
                        for (let i = 0; i < 4; i++) {
                            let angle = i + 45 * (i % 2 ? -1 : 1) / 180 * Math.PI + near.aim2;
                            checkPlace(2, i);
                        }
                    }
                    if (window.pingTime >= 10) {
                    }
                }
            }
        }

        this.preplacer = function () {
            if (traps.inTrap) return;
            if (!configs.autoPrePlace) return;

            const weaponRange = items.weapons[player.weaponIndex].range + 70;
            const rangeSquared = weaponRange ** 2;
            const { x2: playerX, y2: playerY } = player;

            const lowHealthGameObjects = gameObjects.filter(gameObject => {
                const { x2, y2, buildHealth } = gameObject;
                const distSquared = (x2 - playerX) ** 2 + (y2 - playerY) ** 2;
                return near && buildHealth <= 272.58 && distSquared <= rangeSquared;
            });

            if (lowHealthGameObjects.length > 0) {
                const { x2, y2 } = lowHealthGameObjects[0];
                const objAim = UTILS.getDirect({ x2, y2 }, player, 0, 2);
                const trapPlacementRadius = 70;

                let enemyVelocity = Math.sqrt(near.xVel * near.xVel + near.yVel * near.yVel);
                let enemyDirection = Math.atan2(near.yVel, near.xVel);

                let bestAngle = null;
                let bestDistance = Infinity;

                for (let i = 0; i < 360; i += 30) {
                    let simulatedAngle = UTILS.deg2rad(i);
                    let distance =
                        UTILS.getDist(near, player, 0, 2) +
                        enemyVelocity * Math.sin(enemyDirection) +
                        trapPlacementRadius;

                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestAngle = simulatedAngle;
                    }
                }
                if (window.pingTime >= 10) {
                }
                const trapPlacementTime = 5;
                const timeToBreak = (lowHealthGameObjects[0].buildHealth - player.damage) / (player.damagePerShot - lowHealthGameObjects[0].absorb);
                const enemyTimeToMoveOut = bestDistance / enemyVelocity;

                if (timeToBreak + trapPlacementTime <= enemyTimeToMoveOut) {
                    this.testCanPlace(4, bestAngle, bestAngle + Math.PI * 2, Math.PI / 24, objAim, trapPlacementRadius);
                }
            }
        };
        var retrappable = false;
        let preplaceSpam = false;
        function perfectReplace() {
            if (configs.autoPrePlace) return;

            if (enemy.length) {
                if (UTILS.getDist(near, player, 0, 2) < 540) {
                    let enmy = Math.atan2(near.y - player.y, near.x - player.x);

                    if (player.items[4] == 15) {
                        if (preplaceSpam[0] || instaC.canSpikeTick) {
                            place(preplaceSpam[1], enmy, 1);
                        } else if (retrappable) {
                            place(4, enmy);
                        } else {
                            for (let e = enmy - 2 * Math.PI; e < enmy + 2 * Math.PI * 1.5; e += Math.PI * 1.5 / 2) place(4, e);
                        }
                        retrappable = false;
                    }
                }
            }
        }
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
function Hg(e, t){
    buyEquip(e, 0);
    buyEquip(t, 1);
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
this.place = function(id, rad, priority = 2) {
    if (!player.alive || !inGame) return;
    if (id == 0) return actualPlace(id, rad);
    const objScale = items.list[id].scale + config.playerScale;
    placeQueue.push({
        position: {
            x: player.x3 + Math.cos(rad) * objScale,
            y: player.y3 + Math.sin(rad) * objScale,
            objScale: items.list[id].scale
        },
        angle: rad,
        expires: Date.now() + pingTime,
        id
    });
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
// SYNC:
function musketSync() {
    if (getEl("syncType").value === "s1") {
        var musketCheckbox = document.getElementById("musketSync");
        if (musketCheckbox && musketCheckbox.checked) {
            my.autoAim = true;
            selectWeapon(player.weapons[0]);
            buyEquip(7, 0);
            sendAutoGather();
            game.tickBase(() => {
                selectWeapon(player.weapons[1]);
                buyEquip(player.reloads[53] === 0 ? 53 : 6, 0);
                game.tickBase(() => {
                    sendAutoGather();
                    my.autoAim = false;
                }, 3);
            }, 2);
        }
    }
    if (getEl("syncType").value === "s2") {
        my.autoAim = true;
        selectWeapon(player.weapons[0]);
        buyEquip(7, 0);
        buyEquip(18, 0);
        sendAutoGather();
        game.tickBase(() => {
            sendAutoGather();
            my.autoAim = false;
        }, 1);
    }
}

// HEALING:
function soldierMult() {
    return player.latestSkin == 6 ? 0.75 : 1;
}

function getAttacker(damaged) {
    let attackers = enemy.filter(tmp => {
        let damages = new Damages(items);
        let dmg = damages.weapons[tmp.weaponIndex];
        let by = tmp.weaponIndex < 9 ? [dmg[0], dmg[1], dmg[2], dmg[3]] : [dmg[0], dmg[1]];
        let rule = {
            one: tmp.dist2 <= 300,
            two: by.includes(damaged),
            three: tmp.attacked
        }
        return rule.one && rule.two && rule.three;
    });
    return attackers;
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
let predictDamage = 0;
// UPDATE HEALTH:
let doEmpAntiInsta = false;
let judgeAtNextTick = false;
let nearSpike = [];

function updateHealth(sid, value) {
    tmpObj = findPlayerBySID(sid);
    if (tmpObj) {
        let tmpHealth = tmpObj.health;
        tmpObj.health = value;
        if (tmpHealth < tmpObj.health) {
            if (tmpObj.hitTime) {
                let timeSinceHit = Date.now() - tmpObj.hitTime;
                let tmpShame = tmpObj.shameCount;
                let tickiy = ticks.time.filter(e => e == "lag");
                let pingSince = Math.max(120, window.pingTime);
                tmpObj.hitTime = 0;
                if (timeSinceHit <= (tickiy.length >= 2 ? 120 : 120)) {
                    tmpObj.shameCount += 1;
                    if (instaC.isTrue) {
                        tmpObj.healSid = Math.min(3, tmpObj.healSid + 1);
                    }
                    if (tmpObj.shameCount > tmpObj.maxShame) {
                        tmpObj.maxShame = tmpObj.shameCount;
                    }
                } else {
                    tmpObj.shameCount = Math.max(0, tmpObj.shameCount - 2);
                    if (instaC.isTrue) {
                        tmpObj.healSid = Math.max(-1, tmpObj.healSid - 1);
                    }
                }
            }
        } else if (tmpHealth > tmpObj.health) {
            tmpObj.hitTime = Date.now();
            tmpObj.hitted = true;
            tmpObj.damaged = true;
            let damage = tmpHealth - tmpObj.health;
            if (tmpObj.skinIndex == 7 && (damage == 5 || (tmpObj.tailIndex == 13 && damage == 2))) {
                tmpObj.bTick = ticks.tick;
                if (tmpObj == player) {
                    my.reSync = false;
                }
            }
            //console.log(damage);
            if (tmpObj == player) {
                simpleAutoHealer(tmpObj, damage);
            }
        }
    }
}

let stopHealing = false;
function healIntrap(tmpObj, value) {
    var heal = function(amount, after) {
        setTickout(() => {
            for (let i = 0; i < applCxC(amount); i++) {
                place(0, getAttackDir());
            }
        }, after);
    };
    if (enemy.length) {
        heal(value, 2);
    } else {
        heal(value, 3);
    }
}
let backupAnti = [];
let hittedTime = Date.now();

function autoHealer(tmpObj, value) {
    let pingHeal = function() {
        return Math.max(0, 175 - window.pingTime);
    };
    let antiInsta = false;
    let findAttacker = undefined;
    if (true) {
        if (near.dist2 <= 300) {
            if (value >= 20 && (Date.now() - hittedTime >= 180 || Date.now() - hittedTime <= 60)) {
                if (tmpObj.shameCount < tmpObj.dangerShame) {
                    for (let i = 0; i < applCxC(value); i++) {
                        place(0, getAttackDir());
                        if (Date.now() - hittedTime >= 260) {
                            place(0, getAttackDir());
                        }
                    }
                    if (value >= 70) {
                        const heal = () => {
                            let times = player.items[0] === 1 ? 3 : 4;
                            for(let i = 0; i < times; i++) place(0, getAttackDir());
                        }
                        const slowHeal = () => {
                            setTimeout(()=>{
                                heal();
                            }, pingHeal())
                        }
                        slowHeal();
                    }
                } else {
                    setTickout(()=>{
                        for (let i = 0; i < applCxC(value); i++) {
                            place(0, getAttackDir());
                        }
                    }, 2);
                }
            } else {
                if (traps.inTrap) {
                    healIntrap(tmpObj, value);
                } else {
                    setTickout(()=>{
                        for (let i = 0; i < applCxC(value); i++) {
                            place(0, getAttackDir());
                        }
                    }, 2);
                }
            }
            if (player.skinIndex == 11) {
                if (value >= 30) {
                    instaC.isCounter = true;
                }
            }
            if (value >= 20) {
                hittedTime = Date.now();
                judgeAtNextTick = true;
            }
        } else {
            if (traps.inTrap) {
                healIntrap(tmpObj, value);
            } else {
                setTickout(()=>{
                    for (let i = 0; i < applCxC(value); i++) {
                        place(0, getAttackDir());
                    }
                }, 2);
            }
        }
    }
}
function simpleAutoHealer(tmpObj, value) {
    let antiInsta = false;
    let heal = tmpObj.health;
    let damage = tmpObj.maxHealth - heal;
    let findAttacker = undefined;
    if (nears.length) {
        if (value >= 20) {
            judgeAtNextTick = true;
        }
        for (let i = 0; i < nears.length; i++) {
            let nearEnemy = nears[i];
            let findAttacker = [];
            let checkAnti = value >= (tmpObj.skinIndex == 6 ? 25 : 10) && (nearEnemy.secondaryIndex == undefined || nearEnemy.primaryIndex == undefined ? true : nearEnemy.reloads[nearEnemy.primaryIndex] == 0);
            if (checkAnti) {
                antiInsta = true;
            }
        }
        if (antiInsta) {
            if (tmpObj.shameCount < tmpObj.dangerShame) {
                for (let i = 0; i < applCxC(value); i++) {
                    place(0, getAttackDir());
                }
            } else {
                setTickout(()=>{
                    for (let i = 0; i < applCxC(value); i++) {
                        place(0, getAttackDir());
                    }
                }, 2);
            }
        } else {
            if (traps.inTrap) {
                healIntrap(tmpObj, value);
            } else {
                setTickout(()=>{
                    for (let i = 0; i < applCxC(value); i++) {
                        place(0, getAttackDir());
                    }
                }, 2);
            }
        }
        if (player.skinIndex == 11) {
            if (value >= 30) {
                instaC.isCounter = true;
            }
        } else {
            if (tmpObj == player) {
                if (damage <= 30 && near.skinIndex == 11 && near.weapons[0] != 8 && near.weapons[0] != 7 && near.weapons[1] != 9 && near.skinIndex == 11 && player.reloads[player.weapons[0]] != 0) {
                    instaC.isAntiCounter = true;
                }
            }
        }
    } else {
        if (traps.inTrap) {
            healIntrap(tmpObj, value);
        } else {
            setTickout(()=>{
                for (let i = 0; i < applCxC(value); i++) {
                    place(0, getAttackDir());
                }
            }, 2);
        }
    }
}
function antiSyncHealing(timearg) {
    my.antiSync = true;
    let healAnti = setInterval(()=>{
        if (player.shameCount < 5) {
            place(0, getAttackDir());
        }
    }, 75);
    setTimeout(()=>{
        clearInterval(healAnti);
        setTimeout(()=>{
            my.antiSync = false;
        }, config.tickRate);
    }
               , config.tickRate * timearg);
}
// EQUIP HATS:
function biomeGear() {
    if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
        buyEquip(31, 0);
    } else {
        if (useWasd == undefined && (getEl("combat").value == "emre" || getEl("combat").value == "zyenith" || getEl("combat").value == "hans" || getEl("combat").value == "bk86" || getEl("combat").value == "Totalew" || getEl("combat").value == "fz" || getEl("combat").value == "EwV")) {
            buyEquip(getEl("combat").value == "EwV" || getEl("combat").value == "emre" ? 6 : 22, 0);
        } else {
            if (player.y2 <= config.snowBiomeTop) {
                buyEquip(15, 0);
            } else {
                buyEquip(12, 0);
            }
        }
    }
}
let advHeal = [];

function woah(mover) {
    buyEquip(mover && player.moveDir == undefined ? 0 : 11, 1);
}
let pingTime = 50;
let info = {};
function onUpdate() {
    const ticksClamp = Math.ceil(pingTime / 20);
    nearestGameObjects.sort((a, b) => Math.hypot(b.x - near.x3, b.y - near.y3) - Math.hypot(a.x - near.x3, a.y - near.y3)).forEach(obj => {
        if (near.dist2 > 180 ||
            Math.hypot(obj.x - player.x3, obj.y - player.y3) > config.playerScale + obj.scale) return;
        const angle = Math.atan2(obj.y - player.y3, obj.x - player.x3);
        const angles = traps.autoPlace(obj.sid, null, angle - Math.PI / 2, angle + Math.PI / 2, false, true);

        if (!angles?.length) return;

        const anglePerfect = angles.sort((a, b) => Math.abs(a - angle) - Math.abs(b - angle))[0];

        place(2, anglePerfect, 0);
    });
}
let spikeKT = function() {
    return player.weapons[1] == 10 && ((info.health > items.weapons[player.weapons[0]].dmg) || player.weapons[0] == 5);
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
                    traps.tempObjects = traps.tempObjects.filter(e => Math.hypot(x - e.x, y - e.y) > e.scale + tmpObj.scale);
                    placedThisTick = placedThisTick.filter(e => Math.hypot(x - e.x, y - e.y) > e.scale + tmpObj.scale);
                    if (preplacerObj && Math.hypot(preplacerObj.x - x, preplacerObj.y - y) < 90) preplacerObj = null;
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
let SD = 0;
let aimSpike = 0;
let nearestGameObjects = [];
let nearspiker = false;
class Traps {
    constructor(UTILS, items) {
        this.dist = 0;
        this.aim = 0;
        this.inTrap = false;
        this.replaced = false;
        this.antiTrapped = false;
        this.info = {};
        this.tempObjects = [];
        this.isReloaded = function(id = this.weaponIndex) {
            return this.reloads[id] <= 0;
        }
        this.generateAngles = function*(near2, itemId, noObj, start, end) {
            this.tempObjects = this.tempObjects.filter(e => e.timestamp < Date.now());
            let objScale = items.list[player.items[itemId || 4] || player.items[2]].scale + (items.list[player.items[itemId || 4] || player.items[2]].placeOffset || 0);
            const badObjects = nearestGameObjects.concat(this.tempObjects).filter(e => e.sid != noObj && Math.hypot(player.x3 - e.x, player.y3 - e.y) <= e.scale + objScale + config.playerScale).sort((a, b) => Math.atan2(a.y - player.y3, a.x - player.x3) - Math.atan2(b.y - player.y3, b.x - player.x3));
            const temp = this.transformPosition(0, objScale + config.playerScale, player.x3, player.y3);

            for (let i = start; i < end; ) {
                const obj = this.transformPosition(i, objScale + config.playerScale, player.x3, player.y3);
                const { x, y } = this.transformPosition(i, objScale + config.playerScale, player.x3, player.y3);
                const collider = badObjects.find(_ => Math.hypot(_.x - x, _.y - y) < _.scale + objScale);
                if (collider) {
                    const normal = Math.atan2(collider.y - player.y3, collider.x - player.x3);
                    const radius = collider.scale;
                    const edge = {
                        x: collider.x + Math.cos(normal + Math.PI / 2) * radius,
                        y: collider.y + Math.sin(normal + Math.PI / 2) * radius
                    }
                    const alpha = Math.atan2(edge.y - player.y3, edge.x - player.x3);
                    const beta = Math.atan2(
                        edge.y - player.y3 + objScale * Math.sin(Math.PI / 2 + alpha),
                        edge.x - player.x3 + objScale * Math.cos(Math.PI / 2 + alpha)
                    );
                    const dist = Math.abs(UTILS.getAngleDist(i, beta));

                    i += Math.max(dist, 0.00001);
                } else {
                    const endPoint = {
                        x: obj.x + Math.cos(i + Math.PI / 2) * objScale,
                        y: obj.y + Math.sin(i + Math.PI / 2) * objScale
                    }

                    const beta = Math.atan2(endPoint.y - player.y3, endPoint.x - player.x3) + Math.PI * 2;
                    i += Math.abs(UTILS.getAngleDist(i, beta));
                };

                if (badObjects.find(_ => Math.hypot(_.x - obj.x, _.y - obj.y) < _.scale + objScale)) continue;

                yield i;

                badObjects.push({ x, y, scale: objScale });
                this.tempObjects.push({ x, y, scale: objScale, timestamp: Date.now() + game.tickRate + window.pingTime / 2 + SD });
            }
        }
        this.notFast = function() {
            return player.weapons[1] == 10 && ((this.info.health > items.weapons[player.weapons[0]].dmg) || player.weapons[0] == 5);
        }
        this.testCanPlace = function (id, first = -(Math.PI / 2), repeat = (Math.PI / 2), plus = (Math.PI / 18), radian, replacer, yaboi) {
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
                    for (let i = -1; i <= 1; i += 1/10) {
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
                        player.chat.message = "Anti " + near.sid;
                        player.chat.count = 2000;
                        return true;
                    }
                }
            } catch (err) {
                return null;
            }
            return false;
        }
        this.protect = function(aim) {
            if (!configs.antiTrap) return;
            if (player.items[4]) {
                this.testCanPlace(2, -(Math.PI / 2), (Math.PI / 2), (Math.PI / 18), aim + Math.PI);
                this.antiTrapped = true;
            }
        };
        let placedSpikePositions = new Set();
        let placedTrapPositions = new Set();

        function isBroken() {

        }
        this.testPrePlace = function () {

        }
        function isPositionValid(x, y, objectRadius, gameObjects, walls) {
            const isInsideWall = checkCollisionWithWalls(x, y, objectRadius, walls);

            if (isInsideWall) {
                return false;
            }

            const isOverlapping = checkOverlapWithObjects(x, y, objectRadius, gameObjects);

            if (isOverlapping) {
                return false;
            }

            return true;
        }

        function checkCollisionWithWalls(x, y, radius, walls) {
            for (let i = 0; i < walls.length; i++) {
                const wall = walls[i];
                const dx = x - wall.x;
                const dy = y - wall.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance <= radius + wall.width / 2) {
                    return true;
                }
            }

            return false;
        }

        function checkOverlapWithObjects(x, y, radius, gameObjects) {
            for (let i = 0; i < gameObjects.length; i++) {
                const obj = gameObjects[i];
                if (obj.x - obj.radius <= x && x <= obj.x + obj.radius &&
                    obj.y - obj.radius <= y && y <= obj.y + obj.radius) {
                    return true;
                }
            }

            return false;
        }
        function findAllianceBySid(sid) {
            return player.team ? alliancePlayers.find((THIS)=>THIS === sid) : null;
        }
        function calculatePossibleTrapPositions(x, y, numPositions, objectRadius, gameObjects, walls) {
            const possiblePositions = [];

            const angleIncrement = (2 * Math.PI) / numPositions;

            for (let i = 0; i < numPositions; i++) {
                const angle = i * angleIncrement;
                const dx = x + objectRadius * Math.cos(angle);
                const dy = y + objectRadius * Math.sin(angle);

                if (isPositionValid(dx, dy, objectRadius, gameObjects, walls)) {
                    possiblePositions.push({ x: dx, y: dy });
                }
            }

            return possiblePositions;
        }
        this.checkKill = function(angle, inTrap) {
            const obj = this.transformPosition(angle, 50 + config.playerScale, player.x3, player.y3);
            const obj1 = this.transformPosition(angle, 45 + config.playerScale, player.x3, player.y3);
            const conditions = Math.hypot(obj1.x - near.x3, obj1.y - near.y3) < config.playerScale + 45 ||
                  (inTrap && near.dist3 < config.playerScale * 2 + 45);
            this.ez = conditions;

            return conditions;
        }
        this.autoPlace = function () {
            if (!configs.autoPlace) return;

            try {
                if (gameObjects.length) {
                    let nearTrap = gameObjects
                    .filter(e => e.trap && e.active && e.isTeamObject(player) && UTILS.getDist(e, near, 0, 2) <= (near.scale + e.getScale() + 5))
                    .sort((a, b) => UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2))[0];

                    const isNearTrap = Boolean(nearTrap);

                    if (near.dist3 <= 450) {
                        if (near.dist3 <= 200) {
                            this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 24, near.aim2, 0, { inTrap: isNearTrap });
                        } else if (player.items[4] === 15) {
                            this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 24, near.aim2);
                        }
                    }
                }
                const closestTrap = gameObjects
                .filter(e => e.trap && e.active)
                .sort((a, b) => UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2))
                .find(trap => {
                    const trapDist = Math.hypot(trap.y - near.y2, trap.x - near.x2);
                    return (
                        trap !== player &&
                        (player.sid === trap.owner.sid || findAllianceBySid(trap.owner.sid)) &&
                        trapDist <= 50
                    );
                });

                if (closestTrap && near.dist2 <= 160) {
                    placeSpikesAroundTrap(closestTrap.x, closestTrap.y);
                } else if (!closestTrap && near.dist2 <= 206) {
                    placedSpikePositions.clear();
                    placeTrapsAroundPlayer();
                }
            } catch (e) {
                console.log(e);
            }
        };
        function placeSpikesAroundTrap(trapX, trapY) {
            const circleRadius = 102;
            const numPositions = 64;
            const validPositions = [];

            for (let i = 0; i < numPositions; i++) {
                const angle = (2 * Math.PI * i) / numPositions;
                const offsetX = trapX + circleRadius * Math.cos(angle);
                const offsetY = trapY + circleRadius * Math.sin(angle);
                const position = [offsetX, offsetY];
                const distToPlayer = Math.hypot(position[0] - player.x2, position[1] - player.y2);

                if (
                    !placedSpikePositions.has(JSON.stringify(position)) &&
                    isPositionValid(position) &&
                    distToPlayer <= 87
                ) {
                    validPositions.push(position);
                }
            }
            validPositions.sort((a, b) => {
                const distA = Math.hypot(a[0] - player.x2, a[1] - player.y2);
                const distB = Math.hypot(b[0] - player.x2, b[1] - player.y2);
                return distA - distB;
            });

            for (const position of validPositions) {
                const angleToPlace = Math.atan2(position[1] - player.y2, position[0] - player.x2);
                checkPlace(2, angleToPlace);
                placedSpikePositions.add(JSON.stringify(position));
            }
        }

        function placeTrapsAroundPlayer() {
            const maxTrapsToPlace = 4;
            const trapRadius = 50;
            const trapPositions = calculatePossibleTrapPositions(player.x2, player.y2, trapRadius);
            let trapsPlaced = 0;

            trapPositions.sort((a, b) => {
                const distA = Math.hypot(a[0] - player.x2, a[1] - player.y2);
                const distB = Math.hypot(b[0] - player.x2, b[1] - player.y2);
                return distA - distB;
            });

            for (const position of trapPositions) {
                if (
                    trapsPlaced < maxTrapsToPlace &&
                    !placedTrapPositions.has(JSON.stringify(position)) &&
                    isPositionValid(position)
                ) {
                    const angleToPlace = Math.atan2(position[1] - player.y2, position[0] - player.x2);
                    checkPlace(4, angleToPlace);
                    placedTrapPositions.add(JSON.stringify(position));
                    trapsPlaced++;
                }
            }
        }


        function calculatePerfectAngle(x1, y1, x2, y2) {
            return Math.atan2(y2 - y1, x2 - x1);
        }

        // PREPLACER

        this.preplacer = function () {
            if (traps.inTrap) {
                return;
            }
            if (!configs.autoPrePlace) {
                return;
            }
            const weaponRange = items.weapons[player.weaponIndex].range + 70;
            const rangeSquared = weaponRange ** 2;
            const { x2: playerX, y2: playerY } = player;
            const lowHealthGameObjects = gameObjects.filter((gameObject) => {
                const { x2, y2, buildHealth } = gameObject;
                const distSquared = (x2 - playerX) ** 2 + (y2 - playerY) ** 2;
                return near && buildHealth <= 272.58 && distSquared <= rangeSquared;
            });
            if (lowHealthGameObjects.length > 0) {
                const { x2, y2 } = lowHealthGameObjects[0];
                const objAim = UTILS.getDirect(
                    {
                        x2,
                        y2,
                    },
                    player,
                    0,
                    2
                );
                let enemyVelocity = Math.sqrt(
                    near.xVel * near.xVel + near.yVel * near.yVel
                );
                let enemyDirection = Math.atan2(near.yVel, near.xVel);
                let bestAngle = null;
                let bestDistance = Infinity;
                for (let i = 0; i < 360; i += 30) {
                    let simulatedAngle = UTILS.deg2rad(i);
                    let distance =
                        UTILS.getDist(near, player, 0, 2) +
                        enemyVelocity * Math.sin(enemyDirection) +
                        70;
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestAngle = simulatedAngle;
                    }
                }
                const timeToBreak =
                      (lowHealthGameObjects[0].buildHealth - player.damage) /
                      (player.damagePerShot - lowHealthGameObjects[0].absorb);
                const enemyTimeToMoveOut = bestDistance / enemyVelocity;
                if (timeToBreak + 5 <= enemyTimeToMoveOut) {
                    this.testCanPlace(
                        4,
                        bestAngle,
                        bestAngle + Math.PI * 2,
                        Math.PI / 24,
                        objAim,
                        70
                    );
                }
            }
        };
        let spikePlaced;
        let spikSync;
        this.nearTrap = function () {
            return gameObjects.filter(
                (object) =>
                object.trap &&
                object.active &&
                UTILS.getDist(object, player, 0, 2) <=
                player.scale + object.getScale() + 5
            );
        };

        this.isEnemyInTrap = function (enemy) {
            let nearTraps = this.nearTrap();
            return nearTraps.some(
                (trap) =>
                UTILS.getDist(trap, enemy, 0, 2) <= trap.getScale() + near.scale
            );
        };

        this.replacer = function (findObj) {
            if (!findObj || !configs.autoReplace || !inGame || this.antiTrapped) return;
            game.tickBase(() => {
                let objAim = UTILS.getDirect(findObj, player, 0, 2);
                let objDst = UTILS.getDist(findObj, player, 0, 2);
                const canPlaceCondition = [4, 5].includes(player.weapons[0]) && near.dist2 <= items.weapons[near.primaryIndex || 5].range + (player.scale * 1.5) && player.reloads[player.weapons[0]] == 0;
                if (getEl("weaponGrind").checked && objDst <= items.weapons[player.weaponIndex].range + player.scale) return;
                if (objDst <= 400 && near.dist2 <= 400) {
                    if (canPlaceCondition) {
                        if (getEl("replaceType").value == "trap") {
                            this.testCanPlace(4, 0, (Math.PI * 2), (Math.PI / 24), objAim, 1);
                        } else if (getEl("replaceType").value == "spike") {
                            this.testCanPlace(2, -Math.PI/4, Math.PI/4, (Math.PI / 20), near.aim2, 1);
                            this.testCanPlace(2, objAim, 1);
                            instaC.canSpikeTick = true;
                        }
                    } else {
                        if (getEl("replaceType").value == "trap") {
                            this.testCanPlace(4, 0, (Math.PI * 2), (Math.PI / 24), objAim, 1);
                        } else if (getEl("replaceType").value == "spike") {
                            this.testCanPlace(2, -Math.PI/4, Math.PI/4, (Math.PI / 20), near.aim2, 1);
                            this.testCanPlace(2, objAim, 1);
                        }
                    }
                    this.replaced = true;
                }
            }, 1);
        }

        this.replacer1 = function(findObj) {
            if (!findObj || !configs.autoReplace) return;
            if (!inGame) return;
            if (this.antiTrapped) return;
            game.tickBase(() => {
                let objAim = UTILS.getDirect(findObj, player, 0, 2);
                let objDst = UTILS.getDist(findObj, player, 0, 2);
                if (configs.autoGrind && objDst <= items.weapons[player.weaponIndex].range + player.scale) return;
                if (objDst <= 400 && near.dist2 <= 400) {
                    let danger = this.checkSpikeTick();
                    if (!danger && near.dist2 <= items.weapons[near.primaryIndex || 5].range + (near.scale * 1.8)) {
                        //this.testCanPlace(2, -(Math.PI / 2), (Math.PI / 2), (Math.PI / 18), objAim, 1);
                        this.testCanPlace(2, 0, (Math.PI * 2), (Math.PI / 24), objAim, 1);
                    } else {
                        player.items[4] == 15 && this.testCanPlace(4, 0, (Math.PI * 2), (Math.PI / 24), objAim, 1);
                    }
                    this.replaced = true;
                }
            }, 1);
        }

        this.replacer = function(findObj) {
            if (!findObj || !configs.autoReplace) return;
            if (!inGame) return;
            if (this.antiTrapped) return;
            game.tickBase(() => {
                let objAim = UTILS.getDirect(findObj, player, 0, 2);
                let objDst = UTILS.getDist(findObj, player, 0, 2);
                if (getEl("weaponGrind").checked && objDst <= items.weapons[player.weaponIndex].range + player.scale) return;

                if(spikePlaced){
                    player.items[4] == 15 && this.testCanPlace(4, 0, (Math.PI * 2), (Math.PI / 24), objAim, 1);
                    spikePlaced = false;
                }
                if (near.dist2 <= 250 && !spikSync) {
                    for (let i = 0; i < 24; i++) {
                        let angle = (Math.PI * 2) * i / 24;
                        this.testCanPlace(2, angle, angle + (Math.PI / 24), (Math.PI / 24), objAim, 1);
                        spikePlaced = true;
                    }
                }
                if (objDst <= 250 && near.dist2 <= 250) {
                    let danger = this.checkSpikeTick();
                    if (!danger && near.dist3 <= items.weapons[near.primaryIndex || 5].range + (near.scale * 1.8)) {

                        this.testCanPlace(2, -(Math.PI / 2), (Math.PI / 2), (Math.PI / 18), objAim, 1)
                        for (let i = 0; i < 24; i++) {
                            let angle = (Math.PI * 2) * i / 24;
                            this.testCanPlace(2, angle, angle + (Math.PI / 24), (Math.PI / 24), objAim, 1);
                            this.testCanPlace(2, (Math.PI / 2), (Math.PI / 2), (Math.PI / 2), near, objAim, 1)
                            spikSync = true;

                        }
                    } else {
                        player.items[4] == 15 && this.testCanPlace(4, 0, (Math.PI * 2), (Math.PI / 24), objAim, 1);
                    }

                    this.replaced = true;
                }
            }, 1);
        };
        this.replacer = function(findObj) {
            if (!findObj || !configs.autoReplace) return;
            if (!inGame) return;
            if (this.antiTrapped) return;
            game.tickBase(() => {
                if (this.replaced) return;
                let objAim = UTILS.getDirect(findObj, player, 0, 2);
                let objDst = UTILS.getDist(findObj, player, 0, 2);
                if (objDst > player.scale * 2) return;
                let perfectAngle = Math.round(calculatePerfectAngle(findObj.x, findObj.y, player.x, player.y) / (Math.PI / 2)) * (Math.PI / 2);
                let canPlaceCondition = [4, 5].includes(player.weapons[0]) && near.dist2 <= items.weapons[near.primaryIndex || 5].range + (near.scale * 1.2) && player.reloads[player.weapons[0]] == 0;
                if (getEl("weaponGrind").checked && objDst <= items.weapons[player.weaponIndex].range + player.scale) return;
                let danger = this.checkSpikeTick();
                if (objDst <= 300) {
                    if (near.dist2 <= 70 && canPlaceCondition && configs.spikeTick) {
                        this.testCanPlace(2, -Math.PI/4, Math.PI/4, (Math.PI / 20), near.aim2, 1);
                        this.testCanPlace(4, -Math.PI/4, Math.PI/4, Math.PI/12, near.aim2+Math.PI, 1)
                    } else if (!danger && near.dist2 <= items.weapons[near.primaryIndex || 5].range + (near.scale * 1.8)) {
                        this.testCanPlace(2, 0, (Math.PI * 2), (Math.PI / 24), perfectAngle , 1);
                    } else {
                        if (player.items[4] == 15) {
                            this.testCanPlace(near.dist2 > 250 ? 4 : 2, 0, (Math.PI * 2), (Math.PI / 24), perfectAngle , 1);
                        }
                        this.replaced = true;
                    }
                }
            }, 1);
        };
        this.transformPosition = function(angle, step, x1, y1) {
            return {
                x: x1 + Math.cos(angle) * step,
                y: y1 + Math.sin(angle) * step
            }
        }
        this.replacer = function(obj) {
            const angle = Math.atan2(obj.y - player.y3, obj.x - player.x3);
            const angles = traps.autoPlace(obj.sid, null, angle - Math.PI / 3, angle + Math.PI / 3, true, true);
            const anglePerfect = angles.sort((a, b) => Math.abs(a - angle) - Math.abs(b - angle))[0];

            const tmpObj = Object.assign(obj, {
                x: player.x3 + Math.cos(anglePerfect) * 90,
                y: player.y3 + Math.sin(anglePerfect) * 90,
            });

            preplacerObj = tmpObj;
            preplacerObj.time = performance.now();

            if (!angles?.length) return;

            if (!inGame || getEl("weaponGrind").checked) return;
            if (near.dist2 > 180 || !near?.dist2) return;

            place(2, anglePerfect);
        };
    }
}
let preplacerObj;
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
                    buyEquip(0, 1);
                }, 1);
            }, 1);
        };
        this.counterType = function() {
            instaC.isTrue = true;
            my.autoAim = true;
            selectWeapon(player.weapons[0]);
            buyEquip(7, 0);
            buyEquip(getEl("combat").value == "ae" ? 0 : getEl("combat").value == "hans" ? 0 : 0, 1);
            sendAutoGather();
            setTickout(()=>{
                if ((getEl("countertur").checked && player.reloads[53] == 0 && player.skins[53]) || (getEl("countersec").checked && player.reloads[player.weapons[1]] == 0 && player.weapons[1])) {
                    if (getEl("countersec").checked && player.reloads[player.weapons[1]] == 0 && player.weapons[1]) {
                        selectWeapon(player.weapons[1]);
                    }
                    if (getEl("countertur").checked && player.reloads[53] == 0 && player.skins[53]) {
                        buyEquip(53, 0);
                    } else {
                        buyEquip(6, 0);
                    }
                    buyEquip(getEl("combat").value == "ae" ? 11 : getEl("combat").value == "hans" ? 0 : 0, 1);
                    setTickout(()=>{
                        sendAutoGather();
                        instaC.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                } else {
                    sendAutoGather();
                    instaC.isTrue = false;
                    my.autoAim = false;
                }
            }, 1);
        }
        let inantiantibull = false;
        this.antiCounterType = function() {
            my.autoAim = true;
            this.isTrue = true;
            inantiantibull = true;
            selectWeapon(player.weapons[0]);
            buyEquip(6, 0);
            buyEquip(0, 1);
            io.send("D", near.aim2);
            sendAutoGather();
            game.tickBase(() => {
                buyEquip(player.reloads[53] == 0 ? player.skins[53] ? 53 : 6 : 6, 0);
                buyEquip(0, 1);
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
                packet("9", undefined, 1);
                buyEquip(22, 0);
                buyEquip(0, 1);
                game.tickBase(() => {
                    selectWeapon(player.weapons[1]);
                    buyEquip(53, 0);
                    buyEquip(0, 1);
                    sendAutoGather();
                    game.tickBase(() => {
                        sendUpgrade(12);
                        selectWeapon(player.weapons[1]);
                        buyEquip(53, 0);
                        buyEquip(0, 1);
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
            io.send("");
            this.isTrue = true;
            my.autoAim = true;
            selectWeapon(player.weapons[1]);
            buyEquip(53, 0);
            buyEquip(0, 1);
            packet("9", near.aim2, 1);
            if (player.weapons[1] == 15) {
                my.revAim = true;
                sendAutoGather();
            }
            game.tickBase(() => {
                my.revAim = false;
                selectWeapon(player.weapons[0]);
                buyEquip(7, 0);
                buyEquip(0, 1);
                packet("9", near.aim2, 1);
                if (player.weapons[1] != 15) {
                    sendAutoGather();
                }
                game.tickBase(() => {
                    sendAutoGather();
                    this.isTrue = false;
                    my.autoAim = false;
                    packet("9", undefined, 1);
                }, 1);
            }, 1);
        };
        this.threeOneTickType = function() {
            io.send("");
            this.isTrue = true;
            my.autoAim = true;
            selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
            biomeGear();
            buyEquip(0, 1);
            packet("9", near.aim2, 1);
            game.tickBase(() => {
                selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                buyEquip(53, 0);
                buyEquip(0, 1);
                packet("9", near.aim2, 1);
                game.tickBase(() => {
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    buyEquip(0, 1);
                    sendAutoGather();
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
        this.kmTickType = function() {
            this.isTrue = true;
            my.autoAim = true;
            my.revAim = true;
            selectWeapon(player.weapons[1]);
            buyEquip(53, 0);
            buyEquip(0, 1);
            sendAutoGather();
            packet("9", near.aim2, 1);
            game.tickBase(() => {
                my.revAim = false;
                selectWeapon(player.weapons[0]);
                buyEquip(7, 0);
                buyEquip(0, 1);
                packet("9", near.aim2, 1);
                game.tickBase(() => {
                    sendAutoGather();
                    this.isTrue = false;
                    my.autoAim = false;
                    packet("9", undefined, 1);
                }, 1);
            }, 1);
        };
        this.boostTickType = function() {
            /*this.isTrue = true;
                        my.autoAim = true;
                        selectWeapon(player.weapons[0]);
                        buyEquip(53, 0);
                        buyEquip(11, 1);
                        packet("f", near.aim2);
                        game.tickBase(() => {
                            place(4, near.aim2);
                            selectWeapon(player.weapons[1]);
                            biomeGear();
                            buyEquip(11, 1);
                            sendAutoGather();
                            packet("f", near.aim2);
                            game.tickBase(() => {
                                selectWeapon(player.weapons[0]);
                                buyEquip(7, 0);
                                buyEquip(19, 1);
                                packet("f", near.aim2);
                                game.tickBase(() => {
                                    sendAutoGather();
                                    this.isTrue = false;
                                    my.autoAim = false;
                                    packet("f", undefined);
                                }, 1);
                            }, 1);
                        }, 1);*/
            this.isTrue = true;
            my.autoAim = true;
            biomeGear();
            buyEquip(11, 1);
            packet("9", near.aim2, 1);
            game.tickBase(() => {
                if (player.weapons[1] == 15) {
                    my.revAim = true;
                }
                selectWeapon(player.weapons[[9, 12, 13, 15].includes(player.weapons[1]) ? 1 : 0]);
                buyEquip(53, 0);
                buyEquip(11, 1);
                if ([9, 12, 13, 15].includes(player.weapons[1])) {
                    sendAutoGather();
                }
                packet("9", near.aim2, 1);
                place(4, near.aim2);
                game.tickBase(() => {
                    my.revAim = false;
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    buyEquip(0, 1);
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
            let bQ = function (wwww, awwww) {
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
                                    if (configs.slowOT) {
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
                                    bQ(0, 1);
                                    if (configs.slowOT) {
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
                    packet("9", moveMent.dir, 1);
                }
            } else {
                packet("9", moveMent.dir, 1);
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
                    packet("9", moveMent.dir, 1);
                }
            } else {
                packet("9", moveMent.dir, 1);
            }
        },
            this.kmTickMovement = function() {
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
        },
            this.boostTickMovement = function() {
            let dist = player.weapons[1] == 9 ? 365 : player.weapons[1] == 12 ? 380 : player.weapons[1] == 13 ? 365 : player.weapons[1] == 15 ? 365 : 370;
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
        this.hat = function() {
            buyHat.forEach((id) => {
                let find = findID(hats, id);
                if (find && !player.skins[id] && player.points >= find.price) packet("c", 1, id, 0);
            });
        };
        this.acc = function() {
            buyAcc.forEach((id) => {
                let find = findID(accessories, id);
                if (find && !player.tails[id] && player.points >= find.price) packet("c", 1, id, 1);
            });
        };
    }
};

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
let instaC = new Instakill();
let autoBuy = new Autobuy([40, 6, 7, 22, 53, 15, 31], [11, 21, 18, 13]);
let autoUpgrade = new Autoupgrade();

let lastDeath;
let minimapData;
let mapMarker = {};
let mapPings = [];
let tmpPing;

let breakTrackers = [];

let runAtNextTick = [];

function checkProjectileHolder(x, y, dir, range, speed, indx, layer, sid) {
    let weaponIndx = indx == 0 ? 9 : indx == 2 ? 12 : indx == 3 ? 13 : indx == 5 && 15;
    let projOffset = config.playerScale * 2;
    let projXY = {
        x: indx == 1 ? x : x - projOffset * Math.cos(dir),
        y: indx == 1 ? y : y - projOffset * Math.sin(dir),
    };
    let fixXY = function(tmpObj) {
        return {
            x2: UTILS.fixTo(tmpObj.x2, 2),
            y2: UTILS.fixTo(tmpObj.y2, 2),
        };
    };
    let nearPlayer = players.filter((e)=>e.visible && UTILS.getDist(projXY, e, 0, 2) <= e.scale).sort(function(a, b) {
        return (UTILS.getDist(projXY, a, 0, 2) - UTILS.getDist(projXY, b, 0, 2));
    })[0];
    if (nearPlayer) {
        nearPlayer.projDist = UTILS.getDist(projXY, nearPlayer, 0, 2);
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

// antiProj function with added anti-sync-healing codes
function antiProj(tmpObj, dir, range, speed, index, weaponIndex, indx, y, x) {
    let weaponIndx = indx == 0 ? 9 : indx == 2 ? 12 : indx == 3 ? 13 : indx == 5 && 15;
    let projOffset = config.playerScale * 2;
    let projXY = {
        x: indx == 1 ? x : x - projOffset * Math.cos(dir),
        y: indx == 1 ? y : y - projOffset * Math.sin(dir),
    };
    let fixXY = function(tmpObj) {
        return {
            x2: UTILS.fixTo(tmpObj.x2, 2),
            y2: UTILS.fixTo(tmpObj.y2, 2),
        };
    };
    let nearPlayer = players.filter((e)=>e.visible && UTILS.getDist(projXY, e, 0, 2) <= e.scale).sort(function(a, b) {
        return (UTILS.getDist(projXY, a, 0, 2) - UTILS.getDist(projXY, b, 0, 2));
    })[0];
    if (!tmpObj.isTeam(player)) {
        tmpDir = UTILS.getDirect(player, tmpObj, 2, 2);
        if (UTILS.getAngleDist(tmpDir, dir) <= 0.2) {
            tmpObj.bowThreat[weaponIndex]++;
            if (index == 5) {
                projectileCount++;
            }
            if (enemy) {
                let enemyIndex = enemy.index;
                if (index == 1 || index == 2 || index == 3 || index == 5 || index == 13 || index == 14 || index == 15) {
                    player.shooting[53] = 1;
                    setTimeout(() => {
                        player.shooting[53] = 0;
                    }, range / speed);
                }

                player.bowThreat[index]++;
                setTimeout(() => {
                    player.bowThreat[index]--;
                }, range / speed);
                if (player.bowThreat[9] >= 1 && player.bowThreat[12] >= 1 && player.bowThreat[15] >= 1 && nearPlayer.shooting[53]) {
                    buyEquip(6, 0);
                    place(3, tmpObj.aim2);
                    my.anti0Tick = 4;
                    if (!my.antiSync) {
                        antiSyncHealing(4);
                    }
                } else {
                    if (projectileCount >= 2) {
                        place(3, tmpObj.aim2);
                        my.anti0Tick = 4;
                        if (!my.antiSync) {
                            antiSyncHealing(4);
                        }
                    }
                }
            } else {
                player.anti0Tick = 0;
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
const mals = document.getElementById('touch-controls-fullscreen');
mals.style.display = 'block';
mals.addEventListener("mousemove", gameInput, false);
// TOUCH INPUT:
var usingTouch;
setUsingTouch(false);

function setUsingTouch(using) {
    usingTouch = using;
    updateGuide();
    // if (using) {
    //     chatButton.classList.add("mobile");
    // } else {
    //     chatButton.classList.remove("mobile");
    // }
}
function updateGuide() {
    if (usingTouch) {
        guideCard.classList.add("touch");
    } else {
        guideCard.classList.remove("touch");
    }
}
function gameInput(e) {
    e.preventDefault();
    e.stopPropagation();
    setUsingTouch(false);
    mouseX = e.clientX;
    mouseY = e.clientY;
}
let clicks = {
    left: false,
    middle: false,
    right: false,
    none: false,
};
let wsDelay = 0;

mals.addEventListener("mousedown", mouseDown, false);

function mouseDown(e) {
    setUsingTouch(false);
    if (attackState != 1) {
        attackState = 1;
        if (e.button == 0) {
            clicks.left = true;
        } else if (e.button == 1) {
            wsDelay = Date.now();
        } else if (e.button == 2) {
            clicks.right = true;
        }
    }
}
mals.addEventListener("mouseup", mouseUp, false);

function mouseUp(e) {
    setUsingTouch(false);
    if (attackState != 0) {
        attackState = 0;
        if (e.button == 0) {
            sendAtckState();
            clicks.left = false;
        } else if (e.button == 1) {
            clicks.middle = false;
        } else if (e.button == 2) {
            sendAtckState();
            clicks.right = false;
        }
    }
}
mals.addEventListener('wheel', wheel, false);

function wheel(e) {
    if (e.deltaY < 0) {
        my.reSync = true;
    } else {
        my.reSync = false;
    }
}


var controllingTouch = {
    id: -1,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
};
function sendAtckState() {
    if (player && player.alive) {
        io.send("F", attackState, player.buildIndex >= 0 ? getAttackDir() : null);
    }
}
// INPUT UTILS:
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

function getSafeDir() {
    if (!player)
        return 0;
    if (attackingTouch.id != -1) {
        lastDir = Math.atan2(attackingTouch.currentY - attackingTouch.startY, attackingTouch.currentX - attackingTouch.startX);
    } else if (!player.lockDir && !usingTouch) {
        lastDir = Math.atan2(mouseY - screenHeight / 2, mouseX - screenWidth / 2);
    }
    return UTILS.fixTo(lastDir || 0, 2);
}
var mouseAngle = Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2));
var attackingTouch = {
    id: -1,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
};
var hue = 0, bowr;
let lessDir = undefined;
let spinDir = 0;
let tickDir = 0;
let places = {
    slot0: false,
    slot2: false,
    slot4: false,
    slot5: false,
};
let plusDir = 0;
let lastSpin = Date.now();
function Lore(debug) {
    if (debug) {
        if (!player)
            return "0";
        let lastDir;
        if (my.autoAim || ((clicks.left || (useWasd && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap)) && player.reloads[player.weapons[0]] == 0))
            lastDir = getEl("weaponGrind").checked ? "getSafeDir()" : enemy.length ? my.revAim ? "(near.aim2 + Math.PI)" : "near.aim2" : "getSafeDir()";
        else if (clicks.right && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0)
            lastDir = getSafeDir();
        else if (traps.inTrap && player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] == 0)
            lastDir = traps.aim;
        else if (!player.lockDir)
            lastDir = getSafeDir();
        return lastDir;
    } else {
        if (!player)
            return 0;
        let lastDir;
        if (my.autoAim || ((clicks.left || (useWasd && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap)) && player.reloads[player.weapons[0]] == 0))
            lastDir = getEl("weaponGrind").checked ? getSafeDir() : enemy.length ? my.revAim ? (near.aim2 + Math.PI) : near.aim2 : getSafeDir();
        else if (clicks.right && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0)
            lastDir = getSafeDir();
        else if (traps.inTrap && player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] == 0)
            lastDir = traps.aim;
        else if (spinner == true) {
            if (Date.now() - lastSpin > 100) {
                lastSpin = Date.now();
                spinDir += (Math.PI * 2) / (9 / 4);
                if (spinDir > Math.PI * 2)
                    spinDir = 0;
            }
            lastDir = spinDir;
        } else {
            if (!player.lockDir) {
                if (useWasd) {
                    lastDir = getSafeDir();
                } else {
                    lastDir = getVisualDir();
                }
            }
        }
        return lastDir || 0;
    }
}
function safeAngle() {
    if (!player) return 0;
    if (my.autoAim || clicks.left) {
        return getEl("weaponGrind").checked ? (getSafeDir() || mouseAngle) : enemy.length ? near.aim2 : getSafeDir();
    } else if (clicks.right) {
        return getSafeDir();
    } else if (traps.in && player.reloads[traps.healths > items.weapons[player.weapons[0]].dmg && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) {
        return traps.aim;
    } else {
        if (!my.autoAim && !spinner && !clicks.right && !clicks.left && !traps.in) {
            return player.dir;
        } else {
            if (spinner) {
                spinDir += UTILS.toRad(120);
                return spinDir;
            } else {
                if (attackingTouch.id != -1) {
                    lastDir = Math.atan2(attackingTouch.currentY - attackingTouch.startY, attackingTouch.currentX - attackingTouch.startX);
                } else if (!player.lockDir && !usingTouch) {
                    lastDir = Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2));
                } else if (!places.slot0 && !places.slot2 && !places.slot4 && !places.slot5 && !my.autoAim && !spinner && !clicks.right && !clicks.left && !traps.in) {
                    player.lockDir = 1;
                }
                if (ticks.tick % 2 === 0) {
                    tickDir = UTILS.fixTo(lastDir || 0, 2);
                }
                return tickDir;
            }
        }
    }
}
function getAttackDir(debug) {
    if (debug) {
        if (!player) return 0;
        if (getEl("combat").value == "emre") {
            return safeAngle();
        }
        else
            return Lore();
        if (my.autoAim || ((clicks.left || (useWasd && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap)) && player.reloads[player.weapons[0]] == 0))
            lastDir = getEl("weaponGrind").checked ? "getSafeDir()" : enemy.length ? my.revAim ? "(near.aim2 + Math.PI)" : "near.aim2" : "getSafeDir()";
        else if (clicks.right && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0)
            lastDir = "getSafeDir()";
        else if (traps.inTrap && player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] == 0)
            lastDir = "traps.aim";
        else if (!player.lockDir) {
            if (configs.noDir) return "undefined";
            lastDir = "getSafeDir()";
        }
        return lastDir;
    } else {
        if (!player) return 0;
        if (getEl("combat").value == "emre") {
            return safeAngle();
        }
        if (my.autoAim || ((clicks.left || (useWasd && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap)) && player.reloads[player.weapons[0]] == 0))
            lastDir = getEl("weaponGrind").checked ? getSafeDir() : enemy.length ? my.revAim ? (near.aim2 + Math.PI) : near.aim2 : getSafeDir();
        else if (clicks.right && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0)
            lastDir = getSafeDir();
        else if (traps.inTrap && player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] == 0)
            lastDir = traps.aim;
        else if (spinner == true) {
            spinDir += (Math.PI * 2) / (9 / 4);
            return spinDir;
        } else {
            if (!player.lockDir) {
                if(useWasd) {
                    lastDir = lastDir;
                } else {
                    lastDir = getSafeDir();
                }
            }
        }
        return lastDir || 0;
    }
}

function getVisualDir() {
    if (!player)
        return 0;
    if (my.autoAim || ((clicks.left || (useWasd && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap)) && player.reloads[player.weapons[0]] == 0))
        lastDir = getEl("weaponGrind").checked ? getSafeDir() : enemy.length ? my.revAim ? (near.aim2 + Math.PI) : near.aim2 : getSafeDir();
    else if (clicks.right && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0)
        lastDir = getSafeDir();
    else if (traps.inTrap && player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] == 0)
        lastDir = traps.aim;
    else if (!player.lockDir) {
        lastDir = getSafeDir();
    }
    return lastDir || 0;
}
// Random Spin:
function spin() {// PPL code
    let random = [2, 3, 4, 5, 7, 3, 23, -1];
    setTickout(() => {
        spinner = true;
        setTickout(() => {
            spinner = false;
        }, random[Math.floor(Math.random() * (random.length + 1))]);
    }, 1);
}

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
function sendMapPing() {
    io.send("S", 1);
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
                $("#menuChatDiv").toggle();
            } else if (keyNum == 69) {
                sendAutoGather();
            } else if (keyNum == 67) {
                updateMapMarker();
            } else if (player.weapons[keyNum - 49] != undefined) {
                player.weaponCode = player.weapons[keyNum - 49];
            } else if (moveKeys[keyNum]) {
                sendMoveDir();
            } else if (event.key == "m") {
                mills.placeSpawnPads = !mills.placeSpawnPads;
            } else if (event.key == "T") {
                autoOneFrameToggled = !autoOneFrameToggled;
                const oneFrameStatus = autoOneFrameToggled ? "On" : "Off";
                textManager.showText(player.x2, player.y2, 20, 0, 2000, `OneFrame: ${oneFrameStatus}`);
            } else if (event.key === "x") {
                var musketCheckbox = document.getElementById("musketSync");
                if (musketCheckbox && musketCheckbox.checked) {
                    packet("6", "!Sync");
                }
            } else if (event.key == "p") {
                if(document.getElementById("songy").value > 5) {
                    toggleSong();
                }
                if(document.getElementById("songy").value == 1) {
                    cSp = !cSp;
                    cH()
                    console.log('Song #1')
                }
                if(document.getElementById("songy").value == 2) {
                    cSp = !cSp;
                    cH2()
                    console.log('Song #2')
                }

                if(document.getElementById("songy").value == 3) {
                    cSp = !cSp;
                    cH3()
                    console.log('Song #3')
                }

                if(document.getElementById("songy").value == 4) {
                    cSp = !cSp;
                    cH4()
                    console.log('Song #4')
                }
                if (getEl("combat").value == "ae") {
                    sendMapPing();
                }
            } else if (event.key == 'b') {
                clicks.middle = true;
            } else if (event.key == "z") {
                mills.place = !mills.place;
            } else if (event.key == "[") {
                typeof window.debug == "function" && window.debug();
            } else if (event.key == "'") {
                typeof window.toggleVisual == "function" && window.toggleVisual();
            } else if (event.key == "o") {
                typeof window.startGrind == "function" && window.startGrind();
            } else if (keyNum == 32) {
                packet("F", 1, getSafeDir(), 1);
                packet("F", 0, getSafeDir(), 1);
            } else if (event.key == ",") {
                io.send("6", 'syncon')
                project.send(JSON.stringify(["tezt", "ratio"]));
                // botSkts.push([botPlayer]);
                for(let i = 0; i < botz.length; i++) {
                    // if(botz[i][0]) {
                    botz[i][0].zync(near);
                    console.log(botz[i][0])
                }
                // project.send("tezt");
                // botSkts.forEach((bot) => {
                //     bot.zync();
                // })
                // io.send("S", 1)
            } else if (event.key == "o") {
                playSong();
            }
        }
    }
}
let song1 = new Audio("https://ncs.io/track/download/3db2d7b2-fe13-4063-a618-a29eca83f45f");
let Songs = [song1];
let songC1 = {
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
}
let songC = [songC1];
window.addEventListener("keyup", UTILS.checkTrusted(keyUp));
let Playing = false;
let currentPart = 0;
function playSong() {
    Playing = !Playing;
    if (Playing) {
        let Song = Songs[Number(getEl("song").value)];
        Song.play();
        Song.onended = function() {
            if (Playing) {
                Songs[Number(getEl("song").value)].play();
            }
        };
        Song.ontimeupdate = function(t) {
            let part = songC[Number(getEl("song").value)][getTime(Math.round(this.currentTime))];
            if (part && part !== currentPart) {
                currentPart = part;
                /*
                setTimeout(()=>{
                    sendChat(part);
                }, 1000);
                */
            }
        };
    } else {
        Songs[0].pause();
    }
}
function getTime(t) {
    let sec = Math.floor(t) % 60;
    let min = Math.floor(Math.floor(t) % 3600 / 60);
    sec < 10 && (sec = `0${sec}`)
    return min + ":" + sec;
}
// let yy = canvaz.height/2;

// let mouze = {
//     x: xx - mouzeX,
//     y: yy - mouzeY
// }

// let ingamecoorformodabow = {
//     x: player.x + mouze.x,
//     y: player.x + mouze.x
// }

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
                } else if (event.key == ",") {
                    player.sync = false;
                } else if (event.key == 'b') {
                    clicks.middle = false;
                }
            }
        }
    }
}


window.addEventListener("keyup", UTILS.checkTrusted(keyUp));

function sendMoveDir() {
    if(found) {
        packet("9", undefined, 1);
    } else {
        let newMoveDir = getMoveDir();
        if (lastMoveDir == undefined || newMoveDir == undefined || Math.abs(newMoveDir - lastMoveDir) > 0.3) {
            if (!my.autoPush && !found) {
                packet("9", newMoveDir, 1);
            }
            lastMoveDir = newMoveDir;
        }
    }
}

// BUTTON EVENTS:
function bindEvents() {}
bindEvents();
mapDisplay.onclick = UTILS.checkTrusted(function() {
    sendMapPing();
});
UTILS.hookTouchEvents(mapDisplay);

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
// UPDATE PLAYER ITEM VALUES:
function updateItemCountHTML(index=undefined) {
    for (let i = 0; i < items.list.length; ++i) {
        let id = items.list[i].group.id;
        let tmpI = items.weapons.length + i;
        if (!isItemSetted[tmpI]) {
            isItemSetted[tmpI] = document.createElement("div");
            isItemSetted[tmpI].id = "itemCount" + tmpI;
            document.getElementById("actionBarItem" + tmpI).appendChild(isItemSetted[tmpI]);
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
        if (getEl("combat").value == "ae") {
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
function toFancyTimeFormat(time) {
    let minutes = ~~((time % 3600) / 60);
    let seconds = ~~time % 60;
    if (seconds <= 9) seconds = `0${seconds}`;
    return `${minutes}:${seconds}`;
}
let song = {
    '0:13': 'Clean up gang with a hoover,',
    '0:15': 'pull up and sweep the street',
    '0:17': 'Told bae book Park Chinois,',
    '0:18': 'the bricks came cheap',
    '0:19': 'this week',
    '0:20': 'Brought out the glee',
    '0:21': 'this week,',
    '0:22': 'so somethin might end up',
    '0:23': 'on a tee this week',
    '0:24': 'Done studio time done the re',
    '0:25': 'this week,',
    '0:26': 'big bustdown',
    '0:27': "that ain't no Jesus piece",
    '0:28': 'No G17,G19 had the G17',
    '0:29': 'then the G19',
    '0:30': 'Had an old .44',
    '0:31': 'but the pin was weak,',
    '0:32': 'still gonna spin if need',
    '0:35': 'Sayin no smoke backstage,',
    '0:36': 'but bro still ask',
    '0:37': 'can we bring it please,',
    '0:38': 'or a ZK at least',
    '0:40': 'You could see me',
    '0:41': 'in tape with the Gs,',
    '0:42': 'bro just got in a',
    '0:43': 'striptape with the Gs',
    '0:44': "Get the drop it's go time,",
    '0:45': 'bro came out with the key',
    '0:47': 'Yo, 38 autos gang said',
    '0:48': 'we need more sweets',
    '0:50': 'Before Halloween,',
    '0:51': 'we was out playin',
    '0:52': 'trick or treat',
    '0:53': 'An opp boy swam and drowned,',
    '0:55': "he didn't kick his feet",
    '0:57': 'Heard that news',
    '0:58': 'I was right by the runaway,',
    '0:59': 'made me feel like bree',
    '1:00': 'This C comes like',
    '1:01': 'a pocket rocket,',
    '1:02': 'now the gang',
    '1:03': 'in central with C',
    '1:04': 'Had my case papers printed,',
    '1:05': 'now I got the monogram',
    '1:06': 'print on me',
    '1:07': 'Runnin throught bells,',
    '1:08': 'throwback run with the 12',
    '1:10': 'Whole 1 cover the scales,',
    '1:11': 'bine at the barbeque,',
    '1:12': 'better cover your girl',
    '1:14': "Hate when they're",
    '1:15': 'runnin their mouth,',
    '1:16': 'see them runnin for help',
    '1:17': "I'm in the Bando,",
    '1:18': 'but let me see my man again,',
    '1:19': "and I'll double the L",
    '1:21': 'We really leave shit drownin,',
    '1:22': "you ain't brought 3",
    '1:23': 'on an outin',
    '1:24': 'Shootouts in',
    '1:25': 'the oldest clothes,',
    '1:26': "you wouldn't believe",
    '1:27': 'these outfits',
    '1:28': 'Foot down no breaks,',
    '1:29': 'tryna leave everythin taped',
    '1:30': 'Asked bout the shotty,',
    '1:31': 'told them I got it',
    '1:32': 'from the farm,',
    '1:33': 'now they think I got from H',
    '1:34': 'Clean up gang with a hoover,',
    '1:36': 'pull up and sweep the street',
    '1:38': 'Told bae book Park Chinois,',
    '1:39': 'the bricks came cheap',
    '1:40': 'this week',
    '1:41': 'Brought out the glee',
    '1:42': 'this week,',
    '1:43': 'so somethin might end up',
    '1:44': 'on a tee this week',
    '1:45': 'Done studio time done the re',
    '1:46': 'this week,',
    '1:47': 'big bustdown',
    '1:48': "that ain't no Jesus piece",
    '1:49': 'No G17,G19 had the G17',
    '1:50': 'then the G19',
    '1:51': 'Had an old .44',
    '1:52': 'but the pin was weak,',
    '1:53': 'still gonna spin if need',
    '1:54': 'Sayin no smoke backstage,',
    '1:55': 'but bro still ask',
    '1:56': 'can we bring it please,',
    '1:57': 'or a ZK at least',
    '1:59': 'This opps in this',
    '2:00': "spliff's sativa,",
    '2:01': 'still put smoke in the whiz,',
    '2:02': 'Khalifa',
    '2:03': "Bad B don't wanna",
    '2:04': 'lock the smoke,',
    '2:05': 'I just gotta love her',
    '2:06': 'and leave her',
    '2:07': 'Yo, had the Liz',
    '2:08': 'come like Peter',
    '2:09': 'and the bujj like Cleveland',
    '2:10': 'This ice in my wrist says',
    '2:11': 'whole lotta money,',
    '2:12': "swear it's comin like BIA",
    '2:14': 'O14 me, Zee had the bruc',
    '2:15': 'back in a bruck down Kia',
    '2:16': "Now you'll find me in Venice,",
    '2:17': 'tryin some shellfish',
    '2:18': 'oh mama mia',
    '2:19': 'Old school I was',
    '2:20': 'hoppin out first,',
    '2:21': 'had bro sayin',
    '2:22': 'stop bein selfish',
    '2:23': 'Yo,',
    '2:24': 'now I just leave that stage,',
    '2:25': 'pullin strings like Elvis',
    '2:26': 'Ding dong on an outin,',
    '2:27': "would've been a loss",
    '2:28': 'if we found him',
    '2:29': "Can't record,",
    '2:30': 'need more points on the board',
    '2:31': 'Gang, tape it first,',
    '2:32': "then I'll give them an album",
    '2:33': 'Spoke to the yard man,',
    '2:34': 'wanna know the P for the .45,',
    '2:35': 'like Alhan',
    '2:36': 'Spoke to the runner,',
    '2:37': "said he's got more than a oner",
    '2:39': "and he's still counting",
    '2:40': 'Go get that car,',
    '2:41': 'congestion zone,',
    '2:42': 'gotta step with ours',
    '2:43': 'Pocket rocket,',
    '2:44': 'had it in a pouch',
    '2:45': 'next to the brush',
    '2:46': 'and the metro card',
    '2:47': 'Double R truck,',
    '2:48': 'stars in the roof,',
    '2:49': 'and we got a seperate star',
    '2:50': "Ain't done it in a Tesla yet,",
    '2:51': 'if we do thats lead',
    '2:52': 'in an electric car',
    '2:53': 'Clean up gang with a hoover,',
    '2:55': 'pull up and sweep the street',
    '2:57': 'Told bae book Park Chinois,',
    '2:58': 'the bricks came cheap',
    '2:59': 'this week',
    '3:00': 'Brought out the glee',
    '3:01': 'this week,',
    '3:02': 'so somethin might end up',
    '3:03': 'on a tee this week',
    '3:04': 'Done studio time done the re',
    '3:05': 'this week,',
    '3:06': 'big bustdown',
    '3:07': "that ain't no Jesus piece",
    '3:08': 'No G17,G19 had the G17',
    '3:09': 'then the G19',
    '3:10': 'Had an old .44',
    '3:11': 'but the pin was weak,',
    '3:12': 'still gonna spin if need',
    '3:13': 'Sayin no smoke backstage,',
    '3:14': 'but bro still ask',
    '3:15': 'can we bring it please,',
    '3:16': 'or a ZK at least',
    '3:19': '!End of song'
};

let cSp = false;

function sn(m) {
    sendChat(m);
}

function cH(){
    if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("We at the top again, now what?");
            }else{
                return;
            }
        }, 16000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Heavy lay the crown, but");
            }else{
                return;
            }
        }, 18000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Count us");
            }else{
                return;
            }
        }, 20000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Higher than the mountain");
            }else{
                return;
            }
        }, 21000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("And we be up here");
            }else{
                return;
            }
        }, 23000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("for the long run");
            }else{
                return;
            }
        }, 24000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Strap in for a long one");
            }else{
                return;
            }
        }, 25000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("We got everybody on one");
            }else{
                return;
            }
        }, 27000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Now you're coming at the king");
            }else{
                return;
            }
        }, 29000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("so you better not miss");
            }else{
                return;
            }
        }, 31000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("And we only get stronger");
            }else{
                return;
            }
        }, 33000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("With everthing I carry");
            }else{
                return;
            }
        }, 36000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("up on my back");
            }else{
                return;
            }
        }, 37000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("you should paint it up");
            }else{
                return;
            }
        }, 39000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("with a target");
            }else{
                return;
            }
        }, 41000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Why would you dare me to");
            }else{
                return;
            }
        }, 46000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("do it again?");
            }else{
                return;
            }
        }, 47000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Come get your spoiler up ahead");
            }else{
                return;
            }
        }, 50000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("We're taking over,");
            }else{
                return;
            }
        }, 53000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("We're taking over");
            }else{
                return;
            }
        }, 56000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Look at you come at my name,");
            }else{
                return;
            }
        }, 61000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("you 'oughta know by now,");
            }else{
                return;
            }
        }, 63000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("That We're Taking Over,");
            }else{
                return;
            }
        }, 66000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("We're Taking Over");
            }else{
                return;
            }
        }, 69000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Maybe you wonder what");
            }else{
                return;
            }
        }, 74000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("you're futures gonna be, but");
            }else{
                return;
            }
        }, 75000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I got it all locked up");
            }else{
                return;
            }
        }, 77000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Take a lap, now");
            }else{
                return;
            }
        }, 93000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Don't be mad, now");
            }else{
                return;
            }
        }, 95000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Run it back, run it back,");
            }else{
                return;
            }
        }, 97000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("run it back, now");
            }else{
                return;
            }
        }, 98000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I got bodies lining up,");
            }else{
                return;
            }
        }, 100000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("think you're dreaming");
            }else{
                return;
            }
        }, 101000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("of greatness?");
            }else{
                return;
            }
        }, 102000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Send you back home,");
            }else{
                return;
            }
        }, 103000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("let you wake up");
            }else{
                return;
            }
        }, 105000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Why would you dare me to");
            }else{
                return;
            }
        }, 110000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("do it again?");
            }else{
                return;
            }
        }, 111000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Come get your spoiler up ahead");
            }else{
                return;
            }
        }, 114000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("We're taking over,");
            }else{
                return;
            }
        }, 117000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("We're taking over");
            }else{
                return;
            }
        }, 120000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Look at you come at my name,");
            }else{
                return;
            }
        }, 125000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("you 'oughta know by now,");
            }else{
                return;
            }
        }, 127000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("That We're Taking Over,");
            }else{
                return;
            }
        }, 130000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("We're Taking Over");
            }else{
                return;
            }
        }, 133000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Maybe you wonder what");
            }else{
                return;
            }
        }, 138000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("you're futures gonna be, but");
            }else{
                return;
            }
        }, 140000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I got it all locked up");
            }else{
                return;
            }
        }, 141000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("After all, what still exists");
            }else{
                return;
            }
        }, 157000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("except for fights");
            }else{
                return;
            }
        }, 158000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Around me,");
            }else{
                return;
            }
        }, 160000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("the keyboard is clicking,");
            }else{
                return;
            }
        }, 161000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("the clock is ticking");
            }else{
                return;
            }
        }, 162000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Still not enough, let me");
            }else{
                return;
            }
        }, 164000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("protect your persistence");
            }else{
                return;
            }
        }, 165000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Do not worry about the future");
            }else{
                return;
            }
        }, 166000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("even if it's too late");
            }else{
                return;
            }
        }, 167000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Let out the fight,");
            }else{
                return;
            }
        }, 168000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("right at this moment");
            }else{
                return;
            }
        }, 169000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I got the heart of lion");
            }else{
                return;
            }
        }, 170000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I know the higher you climbing");
            }else{
                return;
            }
        }, 171000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("the harder you fall");
            }else{
                return;
            }
        }, 172000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I'm at the top of the mount");
            }else{
                return;
            }
        }, 173000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Too many bodies to count,");
            }else{
                return;
            }
        }, 174000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I've been through it all");
            }else{
                return;
            }
        }, 175000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I had to weather the storm");
            }else{
                return;
            }
        }, 176000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("to get to level I'm on");
            }else{
                return;
            }
        }, 178000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("That's how the legend was born");
            }else{
                return;
            }
        }, 179000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("All of my enemies already dead");
            }else{
                return;
            }
        }, 180000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I'm bored, I'm ready for more");
            }else{
                return;
            }
        }, 182000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("They know I'm ready for war");
            }else{
                return;
            }
        }, 183000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I told em");
            }else{
                return;
            }
        }, 184000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("We're Taking Over,");
            }else{
                return;
            }
        }, 185000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("We're Taking Over");
            }else{
                return;
            }
        }, 186000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Look at you come at my name,");
            }else{
                return;
            }
        }, 192000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("you 'oughta know by now,");
            }else{
                return;
            }
        }, 194000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("That We're Taking Over,");
            }else{
                return;
            }
        }, 197000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("We're Taking Over");
            }else{
                return;
            }
        }, 200000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Maybe you wonder what");
            }else{
                return;
            }
        }, 205000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("you're futures gonna be, but");
            }else{
                return;
            }
        }, 206000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I got it all locked up");
            }else{
                return;
            }
        }, 208000);
    }else{
        return;
    }
}
function cH2(){
    if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I love you so much");
            }else{
                return;
            }
        }, 13000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I am a registered s*x offender");
            }else{
                return;
            }
        }, 16000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I stuck my d*ck into a blender");
            }else{
                return;
            }
        }, 18000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Your mom is a transgender");
            }else{
                return;
            }
        }, 20000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I am a professional");
            }else{
                return;
            }
        }, 22000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("nude sender");
            }else{
                return;
            }
        }, 23000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("You know that I be dominating");
            }else{
                return;
            }
        }, 24000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("My c*ck and balls are rotating");
            }else{
                return;
            }
        }, 26000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Ice on my wrist,");
            }else{
                return;
            }
        }, 28000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I could go skating");
            }else{
                return;
            }
        }, 29000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Between thick thighs,");
            }else{
                return;
            }
        }, 30000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I'm suffocating");
            }else{
                return;
            }
        }, 31000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I have a huge f*cking c*ck");
            }else{
                return;
            }
        }, 32000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I nut inside of my sock");
            }else{
                return;
            }
        }, 34000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I walk around in crocks");
            }else{
                return;
            }
        }, 36000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("While my d*ck is harder");
            }else{
                return;
            }
        }, 38000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("than a rock");
            }else{
                return;
            }
        }, 39000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I f*ck b*tches in school");
            }else{
                return;
            }
        }, 40000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Cause you know");
            }else{
                return;
            }
        }, 42000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I'm fucking cool");
            }else{
                return;
            }
        }, 43000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I jump inside of my pool");
            }else{
                return;
            }
        }, 44000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I take a hit from juul");
            }else{
                return;
            }
        }, 46000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I don't actually smoke");
            }else{
                return;
            }
        }, 48000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("But it'd make your b*tch choke");
            }else{
                return;
            }
        }, 50000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Once I give someone a stroke");
            }else{
                return;
            }
        }, 52000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("My c*ck is hard like oak");
            }else{
                return;
            }
        }, 54000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("You know I'm dropping fire");
            }else{
                return;
            }
        }, 56000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("You could sing my songs");
            }else{
                return;
            }
        }, 58000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("the the choir");
            }else{
                return;
            }
        }, 590000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("They call me Quagmire");
            }else{
                return;
            }
        }, 60000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("No they don't but");
            }else{
                return;
            }
        }, 62000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("at least it rhymes");
            }else{
                return;
            }
        }, 63000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Ay!");
            }else{
                return;
            }
        }, 64000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Alright everyone,");
            }else{
                return;
            }
        }, 66000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("sing along for this next part!");
            }else{
                return;
            }
        }, 67000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I nutted inside you mooo-ooom");
            }else{
                return;
            }
        }, 72000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Yeah!");
            }else{
                return;
            }
        }, 76000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Ay!");
            }else{
                return;
            }
        }, 78000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I nutted inside you mooo-ooom");
            }else{
                return;
            }
        }, 80000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Woooh!");
            }else{
                return;
            }
        }, 84000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Alright, here we go!");
            }else{
                return;
            }
        }, 86000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I love you so much");
            }else{
                return;
            }
        }, 93000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("AY AY AY AY!");
            }else{
                return;
            }
        }, 94000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("You know I love being a s*xist");
            }else{
                return;
            }
        }, 96000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I eat p*ssy for breakfast");
            }else{
                return;
            }
        }, 98000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Ice on my necklace");
            }else{
                return;
            }
        }, 100000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I had s*x with my dentist");
            }else{
                return;
            }
        }, 102000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("My fanbase is getting bigger");
            }else{
                return;
            }
        }, 104000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Your hoe is a gold digger");
            }else{
                return;
            }
        }, 106000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("I wear Tommy Hilfiger");
            }else{
                return;
            }
        }, 108000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("While I pull on the trigger");
            }else{
                return;
            }
        }, 110000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Woah, woah, woah");
            }else{
                return;
            }
        }, 112000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("that was risky");
            }else{
                return;
            }
        }, 113000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("My b*tch just turned 60");
            }else{
                return;
            }
        }, 114000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("She knows my c*m is sticky");
            }else{
                return;
            }
        }, 116000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("But her p*ssy is squeaky");
            }else{
                return;
            }
        }, 118000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("like Mickey");
            }else{
                return;
            }
        }, 119000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("My lines are hotter");
            }else{
                return;
            }
        }, 120000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("than the stars");
            }else{
                return;
            }
        }, 121000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("When I'm dropping");
            }else{
                return;
            }
        }, 122000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("these crazy bars");
            }else{
                return;
            }
        }, 123000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("My c*m has filled jars");
            }else{
                return;
            }
        }, 124000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("And stained so many cars");
            }else{
                return;
            }
        }, 126000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Ay");
            }else{
                return;
            }
        }, 129000);
    }else{
        return;
    }
}
function cH3(){
    if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("As a child you would wait");
            }else{
                return;
            }
        }, 6000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("And watch from far away");
            }else{
                return;
            }
        }, 9000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("But you always knew");
            }else{
                return;
            }
        }, 12000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("that you'd be the one");
            }else{
                return;
            }
        }, 14000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("That work while they all play");
            }else{
                return;
            }
        }, 15000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("In youth you'd lay");
            }else{
                return;
            }
        }, 18000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Awake at night and scheme");
            }else{
                return;
            }
        }, 21000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Of all the things");
            }else{
                return;
            }
        }, 24000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("that you would change");
            }else{
                return;
            }
        }, 26000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("But it was just a dream");
            }else{
                return;
            }
        }, 27000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Here we are,");
            }else{
                return;
            }
        }, 31000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Don't turn away now");
            }else{
                return;
            }
        }, 33000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("We are the warriors");
            }else{
                return;
            }
        }, 37000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("that built this town");
            }else{
                return;
            }
        }, 39000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Here we are");
            }else{
                return;
            }
        }, 43000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Don't turn away now");
            }else{
                return;
            }
        }, 45000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("We are the warriors");
            }else{
                return;
            }
        }, 49000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("that built this town");
            }else{
                return;
            }
        }, 51000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("From dust");
            }else{
                return;
            }
        }, 55000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("The time will come");
            }else{
                return;
            }
        }, 57000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("When you'll have to rise");
            }else{
                return;
            }
        }, 58000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Above the best");
            }else{
                return;
            }
        }, 61000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("and prove yourself");
            }else{
                return;
            }
        }, 63000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Your spirit never dies");
            }else{
                return;
            }
        }, 64000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Farewell, I've gone");
            }else{
                return;
            }
        }, 67000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("to take my throne above");
            }else{
                return;
            }
        }, 71000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("But don't weep for me");
            }else{
                return;
            }
        }, 73000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("'Cause this will be");
            }else{
                return;
            }
        }, 75000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("The labor of my love");
            }else{
                return;
            }
        }, 77000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Here we are,");
            }else{
                return;
            }
        }, 80000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Don't turn away now");
            }else{
                return;
            }
        }, 82000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("We are the warriors");
            }else{
                return;
            }
        }, 86000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("that built this town");
            }else{
                return;
            }
        }, 89000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Here we are");
            }else{
                return;
            }
        }, 92000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Don't turn away now");
            }else{
                return;
            }
        }, 94000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("We are the warriors");
            }else{
                return;
            }
        }, 98000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("that built this town");
            }else{
                return;
            }
        }, 101000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("From dust");
            }else{
                return;
            }
        }, 104000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Here we are,");
            }else{
                return;
            }
        }, 129000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Don't turn away now");
            }else{
                return;
            }
        }, 132000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("We are the warriors");
            }else{
                return;
            }
        }, 136000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("that built this town");
            }else{
                return;
            }
        }, 138000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Here we are");
            }else{
                return;
            }
        }, 142000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Don't turn away now");
            }else{
                return;
            }
        }, 144000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("We are the warriors");
            }else{
                return;
            }
        }, 148000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("that built this town");
            }else{
                return;
            }
        }, 150000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("From dust");
            }else{
                return;
            }
        }, 154000);
    }else{
        return;
    }
}
function cH4(){
    if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Legends never die");
            }else{
                return;
            }
        }, 12000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("when the world is calling you");
            }else{
                return;
            }
        }, 16000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Can you hear them");
            }else{
                return;
            }
        }, 19000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("screaming out your name?");
            }else{
                return;
            }
        }, 21000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Legends never die");
            }else{
                return;
            }
        }, 25000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("they become a part of you");
            }else{
                return;
            }
        }, 29000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Every time you bleed");
            }else{
                return;
            }
        }, 33000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("for reaching greatness");
            }else{
                return;
            }
        }, 35000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Relentless you survive");
            }else{
                return;
            }
        }, 39000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("They never lose hope");
            }else{
                return;
            }
        }, 43000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("when everything's cold");
            }else{
                return;
            }
        }, 45000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("and the fighting's near");
            }else{
                return;
            }
        }, 47000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("It's deep in their bones");
            }else{
                return;
            }
        }, 50000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("they run into smoke");
            }else{
                return;
            }
        }, 52000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("when the fire is fierce");
            }else{
                return;
            }
        }, 54000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("'Oh pick yourself up, cause");
            }else{
                return;
            }
        }, 57000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Legends never die");
            }else{
                return;
            }
        }, 60000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("when the world is calling you");
            }else{
                return;
            }
        }, 64000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Can you hear them");
            }else{
                return;
            }
        }, 67000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("screaming out your name?");
            }else{
                return;
            }
        }, 69000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Legends never die");
            }else{
                return;
            }
        }, 74000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("they become a part of you");
            }else{
                return;
            }
        }, 77000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Every time you bleed");
            }else{
                return;
            }
        }, 81000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("for reaching greatness,");
            }else{
                return;
            }
        }, 83000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Legends never die");
            }else{
                return;
            }
        }, 87000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("They're written down");
            }else{
                return;
            }
        }, 91000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("in eternity");
            }else{
                return;
            }
        }, 92000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("But you'll never see");
            }else{
                return;
            }
        }, 94000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("the price it costs,");
            }else{
                return;
            }
        }, 97000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("the scars collected");
            }else{
                return;
            }
        }, 100000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("all their lives");
            }else{
                return;
            }
        }, 102000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("When everything's lost");
            }else{
                return;
            }
        }, 105000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("they pick up their hearts");
            }else{
                return;
            }
        }, 107000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("and avenge defeat");
            }else{
                return;
            }
        }, 109000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Before it all starts,");
            }else{
                return;
            }
        }, 112000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("they suffer through harm");
            }else{
                return;
            }
        }, 114000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("just to touch a dream");
            }else{
                return;
            }
        }, 115000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("'Oh pick yourself up, cause");
            }else{
                return;
            }
        }, 118000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Legends never die");
            }else{
                return;
            }
        }, 121000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("when the world is calling you");
            }else{
                return;
            }
        }, 125000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Can you hear them");
            }else{
                return;
            }
        }, 129000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("screaming out your name?");
            }else{
                return;
            }
        }, 130000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Legends never die");
            }else{
                return;
            }
        }, 135000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("they become a part of you");
            }else{
                return;
            }
        }, 139000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Every time you bleed");
            }else{
                return;
            }
        }, 143000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("for reaching greatness,");
            }else{
                return;
            }
        }, 145000);
        setTimeout(()=>{
            if(cSp && document.activeElement.id.toLowerCase() !== 'chatbox'){
                sn("Legends never die");
            }else{
                return;
            }
        }, 149000);
    }else{
        return;
    }
}
function cH5(){
    if(cSp){
        setTimeout(()=>{
            if(cSp){
                sn("No there ain't no stopping us.");
                setTimeout(()=>{
                    if(cSp){
                        sn("Fly without boarding pass.");
                        setTimeout(()=>{
                            if(cSp){
                                sn("Couldn't catch me");
                                setTimeout(()=>{
                                    if(cSp){
                                        sn("I be moving fast.");
                                        setTimeout(()=>{
                                            if(cSp){
                                                sn("Call me a shooting star.");
                                                setTimeout(()=>{
                                                    if(cSp){
                                                        sn("Lend all you are.");
                                                        setTimeout(()=>{
                                                            if(cSp){
                                                                sn("Flyin' up in a bar.");
                                                                setTimeout(()=>{
                                                                    if(cSp){
                                                                        sn("Wish on a star.");
                                                                        setTimeout(()=>{
                                                                            if(cSp){
                                                                                sn("Time to show' em");
                                                                                setTimeout(()=>{
                                                                                    if(cSp){
                                                                                        sn("who's in charge");
                                                                                        setTimeout(()=>{
                                                                                            if(cSp){
                                                                                                sn("Call me a shooting star.");
                                                                                                cH6()
                                                                                            }else{
                                                                                                return;
                                                                                            }
                                                                                        }, 3000);
                                                                                    }else{
                                                                                        return;
                                                                                    }
                                                                                }, 1000);
                                                                            }else{
                                                                                return;
                                                                            }
                                                                        }, 3000);
                                                                    }else{
                                                                        return;
                                                                    }
                                                                }, 2000);
                                                            }else{
                                                                return;
                                                            }
                                                        }, 2000);
                                                    }else{
                                                        return;
                                                    }
                                                }, 3000);
                                            }else{
                                                return;
                                            }
                                        }, 3000);
                                    }else{
                                        return;
                                    }
                                }, 1000);
                            }else{
                                return;
                            }
                        }, 3000);
                    }else{
                        return;
                    }
                }, 3000);
            }else{
                return;
            }
        }, 5000);
    }else{
        return;
    }
}
function cH6(){
    if(cSp){
        setTimeout(()=>{
            if(cSp){
                sn("Shootin' stars!");
                setTimeout(()=>{
                    if(cSp){
                        sn("Didn't even get to guns");
                        setTimeout(()=>{
                            if(cSp){
                                sn("I said I'm moving to fast!");
                                setTimeout(()=>{
                                    if(cSp){
                                        sn("Get to guns");
                                        setTimeout(()=>{
                                            if(cSp){
                                                sn("You lookin' at shooting star.");
                                                setTimeout(()=>{
                                                    if(cSp){
                                                        sn("Got more than a couple");
                                                        setTimeout(()=>{
                                                            if(cSp){
                                                                sn("of people going mad");
                                                                setTimeout(()=>{
                                                                    if(cSp){
                                                                        sn("I swear they're rooting hard.");
                                                                        setTimeout(()=>{
                                                                            if(cSp){
                                                                                sn("To the my be big in the game");
                                                                                setTimeout(()=>{
                                                                                    if(cSp){
                                                                                        sn("now she went and");
                                                                                        cH7()
                                                                                    }else{
                                                                                        return;
                                                                                    }
                                                                                }, 1000);
                                                                            }else{
                                                                                return;
                                                                            }
                                                                        }, 2000);
                                                                    }else{
                                                                        return;
                                                                    }
                                                                }, 600);
                                                            }else{
                                                                return;
                                                            }
                                                        }, 600);
                                                    }else{
                                                        return;
                                                    }
                                                }, 2000);
                                            }else{
                                                return;
                                            }
                                        }, 17000);
                                    }else{
                                        return;
                                    }
                                }, 2000);
                            }else{
                                return;
                            }
                        }, 26000);
                    }else{
                        return;
                    }
                }, 1000);
            }else{
                return;
            }
        }, 12000);
    }else{
        return;
    }
}
function cH7(){
    if(cSp){
        setTimeout(()=>{
            if(cSp){
                sn("got them breast implants.");
                setTimeout(()=>{
                    if(cSp){
                        sn("I said I'm moving to fast,");
                        setTimeout(()=>{
                            if(cSp){
                                sn("didn't even get to guns!");
                                setTimeout(()=>{
                                    if(cSp){
                                        sn("I'm ready to eat up track like");
                                        setTimeout(()=>{
                                            if(cSp){
                                                sn("I'm seated in a restaurant.");
                                                setTimeout(()=>{
                                                    if(cSp){
                                                        sn("If you had like swag like mine");
                                                        setTimeout(()=>{
                                                            if(cSp){
                                                                sn("you'd know it's best to flaunt.");
                                                                setTimeout(()=>{
                                                                    if(cSp){
                                                                        sn("We are, hey in");
                                                                        setTimeout(()=>{
                                                                            if(cSp){
                                                                                sn("because you aren't.");
                                                                                setTimeout(()=>{
                                                                                    if(cSp){
                                                                                        sn("Shining like Disney & Young.");
                                                                                        cH8()
                                                                                    }else{
                                                                                        return;
                                                                                    }
                                                                                }, 1000);
                                                                            }else{
                                                                                return;
                                                                            }
                                                                        }, 2000);
                                                                    }else{
                                                                        return;
                                                                    }
                                                                }, 2000);
                                                            }else{
                                                                return;
                                                            }
                                                        }, 2000);
                                                    }else{
                                                        return;
                                                    }
                                                }, 2000);
                                            }else{
                                                return;
                                            }
                                        }, 1500);
                                    }else{
                                        return;
                                    }
                                }, 2000);
                            }else{
                                return;
                            }
                        }, 2000);
                    }else{
                        return;
                    }
                }, 1000);
            }else{
                return;
            }
        }, 1000);
    }else{
        return;
    }
}
function cH8(){
    if(cSp){
        setTimeout(()=>{
            if(cSp){
                sn("Drop like Kings of Leon.");
                setTimeout(()=>{
                    if(cSp){
                        sn("Shooting stars");
                        setTimeout(()=>{
                            if(cSp){
                                sn("across the galaxy.");
                                setTimeout(()=>{
                                    if(cSp){
                                        sn("I stand out so");
                                        setTimeout(()=>{
                                            if(cSp){
                                                sn("don't be mad at me.");
                                                setTimeout(()=>{
                                                    if(cSp){
                                                        sn("Infiltration win my strategy.");
                                                        setTimeout(()=>{
                                                            if(cSp){
                                                                sn("When I turn up they");
                                                                setTimeout(()=>{
                                                                    if(cSp){
                                                                        sn("gonna just have to leave.");
                                                                        setTimeout(()=>{
                                                                            if(cSp){
                                                                                sn("Shooting stars");
                                                                                setTimeout(()=>{
                                                                                    if(cSp){
                                                                                        sn("across the galaxy.");
                                                                                        setTimeout(()=>{
                                                                                            if(cSp){
                                                                                                sn("I stand out so");
                                                                                                cH9()
                                                                                            }else{
                                                                                                return;
                                                                                            }
                                                                                        }, 3000);
                                                                                    }else{
                                                                                        return;
                                                                                    }
                                                                                }, 1000);
                                                                            }else{
                                                                                return;
                                                                            }
                                                                        }, 2000);
                                                                    }else{
                                                                        return;
                                                                    }
                                                                }, 2000);
                                                            }else{
                                                                return;
                                                            }
                                                        }, 3000);
                                                    }else{
                                                        return;
                                                    }
                                                }, 2000);
                                            }else{
                                                return;
                                            }
                                        }, 750);
                                    }else{
                                        return;
                                    }
                                }, 3000);
                            }else{
                                return;
                            }
                        }, 1000);
                    }else{
                        return;
                    }
                }, 2000);
            }else{
                return;
            }
        }, 2000);
    }else{
        return;
    }
}
function cH9(){
    if(cSp){
        setTimeout(()=>{
            if(cSp){
                sn("don't be mad at me.");
                setTimeout(()=>{
                    if(cSp){
                        sn("Infiltration win my strategy.");
                        setTimeout(()=>{
                            if(cSp){
                                sn("When I turn up they");
                                setTimeout(()=>{
                                    if(cSp){
                                        sn("gonna just have to leave.");
                                        setTimeout(()=>{
                                            if(cSp){
                                                sn("Yao, yao, yao");
                                                setTimeout(()=>{
                                                    if(cSp){
                                                        sn("Shoot, shoot, shoot");
                                                        setTimeout(()=>{
                                                            if(cSp){
                                                                sn("Yao, yao, yao");
                                                                setTimeout(()=>{
                                                                    if(cSp){
                                                                        sn("Shoot, shoot, shoot");
                                                                        setTimeout(()=>{
                                                                            if(cSp){
                                                                                sn("Yao, yao, yao");
                                                                                setTimeout(()=>{
                                                                                    if(cSp){
                                                                                        sn("Shootin', shootin', shootin'");
                                                                                        setTimeout(()=>{
                                                                                            if(cSp){
                                                                                                sn("Yao, yao, yao");
                                                                                                cH10()
                                                                                            }else{
                                                                                                return;
                                                                                            }
                                                                                        }, 2500);
                                                                                    }else{
                                                                                        return;
                                                                                    }
                                                                                }, 1000);
                                                                            }else{
                                                                                return;
                                                                            }
                                                                        }, 2500);
                                                                    }else{
                                                                        return;
                                                                    }
                                                                }, 1000);
                                                            }else{
                                                                return;
                                                            }
                                                        }, 2500);
                                                    }else{
                                                        return;
                                                    }
                                                }, 1000);
                                            }else{
                                                return;
                                            }
                                        }, 2500);
                                    }else{
                                        return;
                                    }
                                }, 1000);
                            }else{
                                return;
                            }
                        }, 3000);
                    }else{
                        return;
                    }
                }, 2000);
            }else{
                return;
            }
        }, 750);
    }else{
        return;
    }
}
function cH10(){
    if(cSp){
        setTimeout(()=>{
            if(cSp){
                sn("Shootin' shots!");
                setTimeout(()=>{
                    if(cSp){
                        sn("Shooting stars!");
                        setTimeout(()=>{
                            if(cSp){
                                sn("Shooting stars!");
                                setTimeout(()=>{
                                    if(cSp){
                                        sn("Shooting stars!");
                                        setTimeout(()=>{
                                            if(cSp){
                                                sn("Shooting stars!");
                                                setTimeout(()=>{
                                                    if(cSp){
                                                        sn("Didn't even get to guns");
                                                        setTimeout(()=>{
                                                            if(cSp){
                                                                sn("I said I'm moving to fast!");
                                                                setTimeout(()=>{
                                                                    if(cSp){
                                                                        sn("Get to guns");
                                                                        setTimeout(()=>{
                                                                            if(cSp){
                                                                                cH5()
                                                                            }else{
                                                                                return;
                                                                            }
                                                                        }, 48000);
                                                                    }else{
                                                                        return;
                                                                    }
                                                                }, 1000);
                                                            }else{
                                                                return;
                                                            }
                                                        }, 25000);
                                                    }else{
                                                        return;
                                                    }
                                                }, 1000);
                                            }else{
                                                return;
                                            }
                                        }, 2000);
                                    }else{
                                        return;
                                    }
                                }, 2000);
                            }else{
                                return;
                            }
                        }, 2000);
                    }else{
                        return;
                    }
                }, 7000);
            }else{
                return;
            }
        }, 1000);
    }else{
        return;
    }
}

var songs = [{
    name: "Magnetic - springs!",
    src: "https://ncs.io/track/download/dec55a22-b569-40ec-af12-14e2fc84e24e",
}, {
    name: "Party Pioneers - NOYSE, Rudeejay",
    src: "https://ncs.io/track/download/43175dd8-6fba-4990-8ce9-53ed40875b6d",
}, {
    name: "Overdose (feat. David Allen)",
    src: "https://ncs.io/track/download/239fe7c1-f41e-4752-9cd9-f901ac475b1b",
}, {
    name: "Without You (feat. Justin J. Moore)",
    src: "https://ncs.io/track/download/2b8ee650-e318-44ad-aefd-23bb5bbc4055",
}, {
    name: "Taking It Slow",
    src: "https://ncs.io/track/download/844c6d51-c790-48d1-a12f-a1445da3b876",
}, {
    name: "EXECUTIONER - DJ FKU",
    src: "https://ncs.io/track/download/6cd2e920-4901-448e-9630-dddaa78fc7cf",
}, {
    name: "No Way (with Avi Snow)",
    src: "https://ncs.io/track/download/27820630-b4cf-4efd-b415-7fce03e9496b",
}, {
    name: "Give Up",
    src: "https://ncs.io/track/download/4c4e1ee6-70a4-40df-b828-a49cd6679d90",
}, {
    name: "No Money",
    src: "https://ncs.io/track/download/0f180a25-f993-4f06-8d47-458eabda8bfb",
}, {
    name: "In Love With A Ghost",
    src: "https://ncs.io/track/download/4cb3441c-06e7-4043-aeae-3fc3327dfa15",
}, {
    name: "Retro Love",
    src: "https://ncs.io/track/download/ce215616-cc6a-48a0-8858-648d7ca59a93",
}, {
    name: "One Of Us",
    src: "https://ncs.io/track/download/8258cc92-5baa-401d-88ff-1f0579bebe3c",
}, {
    name: "Stay The Night",
    src: "https://ncs.io/track/download/46651099-664e-450b-b69f-387b0c2a0777",
}, {
    name: "Cricket (we nice)",
    src: "https://ncs.io/track/download/ac1b22fe-8612-4b99-82d3-7fe092f08e50",
}, {
    name: "Rally Up!",
    src: "https://ncs.io/track/download/1c0fe18b-deb2-48b0-99a6-33408c0afee4",
}, {
    name: "Paradise - N3WPORT, Britt Lari",
    src: "https://ncs.io/track/download/123309c0-b38d-4f57-bf64-686a9cc23c14",
}, {
    name: "The Path (Ft. Agassi)",
    src: "https://ncs.io/track/download/9c60ce88-5815-44e1-ae62-cdc05e78a7dc",
}, {
    name: "Find You There",
    src: "https://ncs.io/track/download/abea262f-ed52-49e7-945d-265eb004a2e7",
}, {
    name: "Into The Wild",
    src: "https://ncs.io/track/download/c0db4b25-f4c5-465e-bfa0-0dbb5f78543a",
},{
    name: "Only The Fallen",
    src: "https://ncs.io/track/download/85afa13b-df5d-4692-ba8c-e50890032770",
}, {
    name: "What's The Problem?",
    src: "https://ncs.io/track/download/61a3bd76-7606-45b6-bff9-f5a8a59bc554",
}, {
    name: "Heart My Heart",
    src: "https://ncs.io/track/download/77232930-1126-4189-933e-e2aff841eb1a",
}, {
    name: "Are You With Me",
    src: "https://ncs.io/track/download/23a602f5-2c32-4482-9f3a-d90a3e62c488",
}, {
    name: "Strobe - NIVIRO",
    src: "https://ncs.io/track/download/598a4b7b-7980-4d27-912e-81ca14fec7ca",
}, {
    name: "I Can Feel - Syn Cole",
    src: "https://ncs.io/track/download/49d4a22d-5bd4-48b5-b690-23f935073e26",
}, {
    name: "Shine x Never Have I Felt This (VIP) Mashup",
    src: "https://ncs.io/track/download/b4a5ea39-ab6f-4d35-a34b-1ad5d3efeead",
}, {
    name: "NCS - Mortals",
    src: "https://ncs.io/track/download/784a2ccc-5ace-48d1-8af1-9da55c383960",
}, {
    name: "NEFFEX - Desperate",
    src: "https://ncs.io/track/download/1f1b2fc1-9aea-41ee-99c4-0c72044f38ee",
}, {
    name: "Royalty - Egzod, Maestro Chives, Neoni",
    src: "https://ncs.io/track/download/2b08f7d9-4f5f-47bd-a608-07dec1f7eaa9",
}, {
    name: "ROY KNOX - Your Poison",
    src: "https://ncs.io/track/download/0f42c347-dce4-4173-9d61-4ec44d8a5c51",
}, {
    name: "BackStreet boys",
    src: "https://ncs.io/track/download/c80ab53d-847b-4046-bdf5-201c74f890aa",
}];
//Thanks To Staryyy For Making Song Chats
var converToJSDelay = (time) => {
    let newTime = time.split(":").reverse();
    time = 0;
    let convert = [6e4 * 60, 6e4, 1000, 1].reverse();
    newTime.forEach((b, c) => {
        time += b * convert[c];
    });
    return time;
};
songs.forEach(e => {
    let oldDatas = e.sync;
    e.sync = {};
    for (let time in oldDatas) {
        e.sync[converToJSDelay(time)] = oldDatas[time];
    }
});
let songchat1 = new Audio("https://cdn.discordapp.com/attachments/1065969963644506152/1079719316074790953/V_O_E_-_Giants_Extended_Mix_NCS_Release_1.mp3");
let isPlaying = false;
let singing = {
    timeouts: []
}
function toggleSong() {
    let id = document.getElementById("songy").value;
    if(id > 5) {
        if (!isPlaying) {
            songchat1.src = songs[id - 1].src;
            songchat1.play();
            for (let time in songs[id - 1].sync) {
                let message = songs[id - 1].sync[time];
                singing.timeouts.push(setTimeout(() => {
                    io.send("6", message);
                }, time));
            }
            isPlaying = true;
        } else {
            songchat1.pause();
            isPlaying = false;
        }
    }
}
let bboooo = 120120
document.addEventListener("keypress", function(e) {
    if (e.key === "C") {
        if(document.getElementById("songy").value > 5) {
            toggleSong();
        }
        if(document.getElementById("songy").value == 1) {
            cSp = !cSp;
            cH()
        }
        if(document.getElementById("songy").value == 2) {
            cSp = !cSp;
            cH2()
        }

        if(document.getElementById("songy").value == 3) {
            cSp = !cSp;
            cH3()
        }

        if(document.getElementById("songy").value == 4) {
            cSp = !cSp;
            cH4()
        }
        sendChat("");
    }
});
function sendChat(message) {
    packet("6", message.slice(0, 30));
}
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
var EasyStar = (function (modules) {
    var moduleCache = {};
    function require(moduleId) {
        if (moduleCache[moduleId]) return moduleCache[moduleId].exports;
        var module = (moduleCache[moduleId] = {
            i: moduleId,
            l: false,
            exports: {},
        });
        modules[moduleId].call(module.exports, module, module.exports, require);
        module.l = true;
        return module.exports;
    }
    require.m = modules;
    require.c = moduleCache;
    require.d = function (exports, name, getter) {
        if (!require.o(exports, name)) {
            Object.defineProperty(exports, name, {
                enumerable: true,
                get: getter,
            });
        }
    };
    require.r = function (exports) {
        if (typeof Symbol !== "undefined" && Symbol.toStringTag) {
            Object.defineProperty(exports, Symbol.toStringTag, {
                value: "Module",
            });
        }
        Object.defineProperty(exports, "__esModule", {
            value: true,
        });
    };
    require.t = function (value, mode) {
        if (mode & 1) value = require(value);
        if (mode & 8) return value;
        if (mode & 4 && typeof value === "object" && value && value.__esModule) return value;
        var ns = Object.create(null);
        require.r(ns);
        Object.defineProperty(ns, "default", {
            enumerable: true,
            value: value,
        });
        if (mode & 2 && typeof value != "string") {
        }
        for (var key in value) {
        }
        require.d(ns, key, function (key) {
            return value[key];
        }.bind(null, key));
        return ns;
    };
    require.n = function (module) {
        var getter = module && module.__esModule ? function getDefault() {
            return module.default;
        } : function getModuleExports() {
            return module;
        };
        require.d(getter, "f", getter);
        return getter;
    };
    require.o = function (object, property) {
        return Object.prototype.hasOwnProperty.call(object, property);
    };
    require.p = "/bin/";
    return require(require.s = 0);
})([
    function (module, exports, require) {
        const Node = require(1);
        const MinHeap = require(2);
        const EasyStar = {};
        module.exports = EasyStar;
        let instanceIdCounter = 1;
        EasyStar.Pathfinder = function () {
            let grid,
                acceptableTiles,
                enableSync = false,
                diagonalsEnabled = false,
                tileCosts = {},
                additionalCosts = {},
                directionalConditions = {},
                maxIterations = Number.MAX_VALUE,
                avoidingPoints = {},
                cornerCuttingEnabled = true,
                paths = {},
                pathQueue = [];
            this.setAcceptableTiles = function (tiles) {
                if (Array.isArray(tiles)) {
                    acceptableTiles = tiles;
                } else if (!isNaN(parseFloat(tiles)) && isFinite(tiles)) {
                    acceptableTiles = [tiles];
                }
            };
            this.enableSync = function () {
                enableSync = true;
            };
            this.disableSync = function () {
                enableSync = false;
            };
            this.enableDiagonals = function () {
                diagonalsEnabled = true;
            };
            this.disableDiagonals = function () {
                diagonalsEnabled = false;
            };
            this.setGrid = function (newGrid) {
                grid = newGrid;
                tileCosts = {};
                for (let row = 0; row < grid.length; row++) {
                    for (let col = 0; col < grid[0].length; col++) {
                        tileCosts[grid[row][col]] = 1;
                    }
                }
            };
            this.setTileCost = function (tile, cost) {
                if (acceptableTiles && !acceptableTiles.includes(tile)) {
                    throw new Error(`Tile ${tile} is not in the acceptableTiles list.`);
                }
                tileCosts[tile] = cost;
            };
            this.setAdditionalPointCost = function (x, y, cost) {
                additionalCosts[y] = additionalCosts[y] || {};
                additionalCosts[y][x] = cost;
            };
            this.removeAdditionalPointCost = function (x, y) {
                if (additionalCosts[y]) {
                    delete additionalCosts[y][x];
                }
            };
            this.removeAllAdditionalPointCosts = function () {
                additionalCosts = {};
            };
            this.setDirectionalCondition = function (x, y, directions) {
                directionalConditions[y] = directionalConditions[y] || {};
                directionalConditions[y][x] = directions;
            };
            this.removeAllDirectionalConditions = function () {
                directionalConditions = {};
            };
            this.setIterationsPerCalculation = function (iterations) {
                maxIterations = iterations;
            };
            this.avoidAdditionalPoint = function (x, y) {
                avoidingPoints[y] = avoidingPoints[y] || {};
                avoidingPoints[y][x] = true;
            };
            this.stopAvoidingAdditionalPoint = function (x, y) {
                if (avoidingPoints[y]) {
                    delete avoidingPoints[y][x];
                }
            };
            this.enableCornerCutting = function () {
                cornerCuttingEnabled = true;
            };
            this.disableCornerCutting = function () {
                cornerCuttingEnabled = false;
            };
            this.stopAvoidingAllAdditionalPoints = function () {
                avoidingPoints = {};
            };
            this.findPath = function (startX, startY, endX, endY, callback) {
                if (!acceptableTiles) {
                    throw new Error("You must call setAcceptableTiles() before findPath().");
                }
                if (!grid) {
                    throw new Error("You must call setGrid() before findPath().");
                }
                if (startX < 0 || startY < 0 || endX < 0 || endY < 0 || startX >= grid[0].length || startY >= grid.length || endX >= grid[0].length || endY >= grid.length) {
                    throw new Error("Start or end point is outside the scope of your grid.");
                }
                if (startX === endX && startY === endY) {
                    return callback([]);
                }
                const endTile = grid[endY][endX];
                if (!acceptableTiles.includes(endTile)) {
                    return callback(null);
                }
                const pathId = instanceIdCounter++;
                const pathFinder = {
                    openList: new MinHeap((a, b) => a.estimatedTotalCost - b.estimatedTotalCost),
                    isDone: false,
                    nodeMap: {},
                    startX,
                    startY,
                    endX,
                    endY,
                    callback,
                };
                pathFinder.openList.push(createNode(pathFinder, startX, startY, null, 0));
                paths[pathId] = pathFinder;
                pathQueue.push(pathId);

                return pathId;
            };
            this.cancelPath = function (pathId) {
                if (paths[pathId]) {
                    delete paths[pathId];
                    return true;
                }
                return false;
            };
            this.calculate = function () {
                if (pathQueue.length > 0 && grid && acceptableTiles) {
                    for (let i = 0; i < maxIterations; i++) {
                        if (pathQueue.length === 0) return;
                        if (enableSync) i = 0;
                        const pathId = pathQueue[0];
                        const pathFinder = paths[pathId];
                        if (pathFinder && !pathFinder.isDone) {
                            const currentNode = pathFinder.openList.pop();
                            if (currentNode) {
                                if (currentNode.x === pathFinder.endX && currentNode.y === pathFinder.endY) {
                                    const path = [];
                                    let node = currentNode;
                                    while (node) {
                                        path.push({ x: node.x, y: node.y });
                                        node = node.parent;
                                    }
                                    path.reverse();
                                    pathFinder.callback(path);
                                    pathFinder.isDone = true;
                                    delete paths[pathId];
                                    pathQueue.shift();
                                } else {
                                    expandNode(pathFinder, currentNode);
                                }
                            } else {
                                pathQueue.shift();
                            }
                        }
                    }
                }
            };
            function expandNode(pathFinder, node) {
                const directions = [
                    [0, -1], // up
                    [1, 0], // right
                    [0, 1], // down
                    [-1, 0], // left
                ];
                if (diagonalsEnabled) {
                    directions.push(
                        [-1, -1], // up-left
                        [1, -1], // up-right
                        [1, 1], // down-right
                        [-1, 1] // down-left
                    );
                }
                directions.forEach(([dx, dy]) => {
                    const newX = node.x + dx;
                    const newY = node.y + dy;
                    if (isValidTile(newX, newY, node, pathFinder)) {
                        const movementCost = (dx === 0 || dy === 0) ? 1 : 1.4;
                        const tileCost = getTileCost(newX, newY);
                        const totalCost = node.costSoFar + movementCost * tileCost;

                        let neighbor = getNode(pathFinder, newX, newY);
                        if (!neighbor) {
                            neighbor = createNode(pathFinder, newX, newY, node, totalCost);
                            pathFinder.openList.push(neighbor);
                        } else if (totalCost < neighbor.costSoFar) {
                            neighbor.parent = node;
                            neighbor.costSoFar = totalCost;
                            neighbor.estimatedTotalCost = totalCost + getHeuristic(newX, newY, pathFinder.endX, pathFinder.endY);
                            pathFinder.openList.updateItem(neighbor);
                        }
                    }
                });
            }
            function getTileCost(x, y) {
                let cost = tileCosts[grid[y][x]] || 1;
                if (additionalCosts[y] && additionalCosts[y][x] !== undefined) {
                    cost += additionalCosts[y][x];
                }
                return cost;
            }
            function getNode(pathFinder, x, y) {
                return pathFinder.nodeMap[`${x}-${y}`];
            }
            function createNode(pathFinder, x, y, parent, costSoFar) {
                const estimatedTotalCost = costSoFar + getHeuristic(x, y, pathFinder.endX, pathFinder.endY);
                const node = new Node(x, y, parent, costSoFar, estimatedTotalCost);
                pathFinder.nodeMap[`${x}-${y}`] = node;
                return node;
            }
            function isValidTile(x, y, fromNode, pathFinder) {
                if (x < 0 || y < 0 || x >= grid[0].length || y >= grid.length) return false;
                const tile = grid[y][x];
                if (!acceptableTiles.includes(tile)) return false;
                if (avoidingPoints[y] && avoidingPoints[y][x]) return false;
                if (directionalConditions[y] && directionalConditions[y][x]) {
                    const validDirections = directionalConditions[y][x];
                    const dx = x - fromNode.x;
                    const dy = y - fromNode.y;
                    if (!validDirections.includes(getDirection(dx, dy))) return false;
                }
                if (!cornerCuttingEnabled) {
                    if (x !== fromNode.x && y !== fromNode.y) {
                        if (
                            !acceptableTiles.includes(grid[fromNode.y][x]) ||
                            !acceptableTiles.includes(grid[y][fromNode.x])
                        ) {
                            return false;
                        }
                    }
                }
                return true;
            }
            function getDirection(dx, dy) {
                if (dx === 0 && dy === -1) return "up";
                if (dx === 1 && dy === 0) return "right";
                if (dx === 0 && dy === 1) return "down";
                if (dx === -1 && dy === 0) return "left";
                if (dx === -1 && dy === -1) return "up-left";
                if (dx === 1 && dy === -1) return "up-right";
                if (dx === 1 && dy === 1) return "down-right";
                if (dx === -1 && dy === 1) return "down-left";
            }
            function getHeuristic(x1, y1, x2, y2) {
                const dx = Math.abs(x1 - x2);
                const dy = Math.abs(y1 - y2);
                return dx + dy;
            }
        };
    },
    function (module, exports) {
        function Node(x, y, parent, costSoFar, estimatedTotalCost) {
            this.x = x;
            this.y = y;
            this.parent = parent;
            this.costSoFar = costSoFar;
            this.estimatedTotalCost = estimatedTotalCost;
        }
        module.exports = Node;
    },
    function (module, exports) {
        const MinHeap = (function () {
            function MinHeap(compare) {
                this.heap = [];
                this.compare = compare;
            }
            MinHeap.prototype.push = function (item) {
                this.heap.push(item);
                this.bubbleUp(this.heap.length - 1);
            };
            MinHeap.prototype.pop = function () {
                const result = this.heap[0];
                const end = this.heap.pop();
                if (this.heap.length > 0) {
                    this.heap[0] = end;
                    this.sinkDown(0);
                }
                return result;
            };
            MinHeap.prototype.size = function () {
                return this.heap.length;
            };
            MinHeap.prototype.updateItem = function (item) {
                const index = this.heap.indexOf(item);
                if (index !== -1) {
                    this.bubbleUp(index);
                    this.sinkDown(index);
                }
            };
            MinHeap.prototype.bubbleUp = function (n) {
                const element = this.heap[n];
                while (n > 0) {
                    const parentN = Math.floor((n + 1) / 2) - 1;
                    const parent = this.heap[parentN];
                    if (this.compare(element, parent) >= 0) {
                        break;
                    }
                    this.heap[parentN] = element;
                    this.heap[n] = parent;
                    n = parentN;
                }
            };
            MinHeap.prototype.sinkDown = function (n) {
                const length = this.heap.length;
                const element = this.heap[n];

                while (true) {
                    const child2N = (n + 1) * 2;
                    const child1N = child2N - 1;
                    let swap = null;

                    if (child1N < length) {
                        const child1 = this.heap[child1N];
                        if (this.compare(child1, element) < 0) {
                            swap = child1N;
                        }
                    }
                    if (child2N < length) {
                        const child2 = this.heap[child2N];
                        if (this.compare(child2, swap === null ? element : this.heap[child1N]) < 0) {
                            swap = child2N;
                        }
                    }
                    if (swap === null) break;

                    this.heap[n] = this.heap[swap];
                    this.heap[swap] = element;
                    n = swap;
                }
            };
            return MinHeap;
        })();
        module.exports = MinHeap;
    },
]);
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
let grid = [];
const easystar = new EasyStar.Pathfinder();
function Pathfinder() {
    pathFind.scale = (config.maxScreenWidth / 2) * 1.3;
    if (!traps.inTrap && (pathFind.chaseNear ? enemy.length : true)) {
        if (near.dist2 <= items.weapons[player.weapons[0]].range) {
            packet("9", undefined, 1);
        } else {
            createPath();
            easystar.setGrid(grid);
            easystar.setAcceptableTiles([0]);
            easystar.enableDiagonals();
            easystar.findPath((grid[0].length / 2), (grid.length / 2), pathFind.lastX, pathFind.lastY, function (path) {
                if (path === null) {
                    pathFind.array = [];
                    if (near.dist2 <= items.weapons[player.weapons[0]].range) {
                        packet("9", undefined, 1);
                    } else {
                        packet("9", near.aim2, 1);
                    }
                } else {
                    pathFind.array = path;
                    if (pathFind.array.length > 1) {
                        let tmpXY = {
                            x: (player.x2 - (pathFind.scale / 2)) + ((pathFind.scale / pathFind.grid) * path[1].x),
                            y: (player.y2 - (pathFind.scale / 2)) + ((pathFind.scale / pathFind.grid) * path[1].y)
                        }
                        packet("9", UTILS.getDirect(tmpXY, player, 0, 2), 1);
                    }
                }
            });
            easystar.calculate();
        }
    }
}
// AUTOPUSH:
var retrappable = false;
function doPathFind(afg1keg1, target) {
    let R = player;
    let N = gameObjects;
    let centerX = R.x + (target[0] - R.x) / 2;
    let centerY = R.y + (target[1] - R.y) / 2;
    const nearBuilds = N.filter(
        (e) => Math.hypot(e.y - centerY, e.x - centerX) < 800 && e.active
    );
    let block = 30,
        node = function (x, y, gScore) {
            this.x = x;
            this.y = y;
            this.g = gScore;
            this.type = nearBuilds.some((e) => {
                let exactScale =
                    /spike/.test(e.name) &&
                    R.sid != e.owner.sid &&
                    (R.team ? !e.isTeamObject(R) : true)
                ? e.scale + 50
                : e.scale;
                if (e.name == "pit trap") {
                    if (e.owner && (R.sid == e.owner.sid || e.isTeamObject(R))) {
                        return false;
                    }
                }
                if (
                    Math.hypot(e.y - y, e.x - x) < exactScale + block &&
                    Math.hypot(e.y - target[1], e.x - target[0]) >
                    exactScale + block &&
                    Math.hypot(e.y - R.y2, e.x - R.x2) > exactScale + block
                ) {
                    return true;
                }
                return false;
            })
                ? "wall"
            : "space";
        },
        myNode = new node(
            Math.round(R.x2 / block) * block,
            Math.round(R.y2 / block) * block,
            0
        ),
        targetNode = new node(
            Math.round(target[0] / block) * block,
            Math.round(target[1] / block) * block,
            0
        ),
        paths = [],
        foundset = [],
        currentTick = 0,
        endTick = 100,
        found = true;
    function positive(num) {
        return Math.abs(num);
    }
    while (
        !foundset.find((e) => {
            return Math.hypot(e.y - targetNode.y, e.x - targetNode.x) < block;
        })
    ) {
        currentTick++;
        if (currentTick >= endTick) {
            found = false;
            break;
        }
        let bestnode =
            currentTick === 1
        ? myNode
        : foundset
        .filter((e) => e.type == "space")
        .sort((a, b) => a.good - b.good)[0];
        for (let i = 0; i < 3; i++) {
            for (let o = 0; o < 3; o++) {
                if (i == 1 && o == 1) {
                    continue;
                }
                let x = bestnode.x + block * (-1 + i);
                let y = bestnode.y + block * (-1 + o);
                let n = new node(x, y, currentTick);
                let good =
                    positive(n.x - targetNode.x) +
                    positive(n.y - targetNode.y) / block -
                    currentTick;
                n.good = good;
                foundset.push(n);
            }
        }
        paths.push(bestnode);
    }
    return found ? paths : false;
}

// AUTOPUSH WITH PATH FINDING
function autoPush() {
    let nearTrap = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= (near.scale + tmp.getScale() + 15)).sort(function(a, b) {
        return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
    })[0];
    if (nearTrap) {
        let enemyboob = gameObjects.some(tmp => tmp.dmg && tmp.active && !tmp.isTeamObject(player) && UTILS.getDist(tmp, nearTrap, 0, 0) <= (near.scale + nearTrap.scale + tmp.scale + 5));
        if (enemyboob) {
            track.pushdata.autoPush = false;
            pathFind.active = false;
            pathFind.chaseNear = false;
            return;
        }
        let spike = gameObjects.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, nearTrap, 0, 0) <= (near.scale + nearTrap.scale + tmp.scale + 5)).sort(function(a, b) {
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
            if (2 == 1) {
                if (track.pushdata.autoPush) {
                    track.pushdata.autoPush = false;
                }
            } else {
                if (near.dist2 >= 110) {
                    track.pushdata.autoPush = false;
                    pathFind.active = true;
                    pathFind.chaseNear = true;
                } else if (near.dist2 <= 100) {
                    pathFind.active = false;
                    pathFind.chaseNear = false;
                    track.pushdata.autoPush = true;
                    track.pushdata.pushData = {
                        x: spike.x + Math.cos(30),
                        y: spike.y + Math.sin(30),
                        x2: pos.x2 + Math.cos(60),
                        y2: pos.y2 + Math.sin(60)
                    };
                    let angle = Math.atan2(near.y2 - spike.y, near.x2 - spike.x)
                    let point = {
                        x: near.x2 + Math.cos(angle) * 53,
                        y: near.y2 + Math.sin(angle) * 53,
                    }
                    let num = UTILS.getDist(near, spike, 2, 0);
                    let text = num.toString(10);
                    let scale = (player.scale / 10);
                    if (UTILS.getDist(near, spike, 2, 0) >= 105) {
                        if (UTILS.lineInRect(player.x2 - scale, player.y2 - scale, player.x2 + scale, player.y2 + scale, near.x2, near.y2, pos.x, pos.y)) {
                            io.send("9", near.aim2, 1);
                        } else {
                            io.send("9", UTILS.getDirect(pos, player, 2, 2), 1);
                        }
                    } else {
                        io.send("9", Math.atan2(point.y - player.y2, point.x - player.x2), 1);
                    }
                }
            }
        } else {
            track.pushdata.autoPush = false;
            pathFind.active = false;
            pathFind.chaseNear = false;
        }
    } else {
        track.pushdata.autoPush = false;
        pathFind.active = false;
        pathFind.chaseNear = false;
    }
}
let track = {
    hits: {
        waitHit: 0,
    },
    auto: {
        aim: false,
        revAim: false,
    },
    tick: {
        ageInsta: true,
        antiTick: false,
        antiSync: false,
    },
    force: {
        soldierspike: false,
        soldier: false,
    },
    dist: 0,
    trapAim: 0,
    inTrap: false,
    replaced: false,
    bullTick: 0,
    reloaded: false,
    antiTrapped: false,
    info: {},
    priorityPlace: [],
    place: [],
    safePrimary: function (tmpObj) {
        return [0, 8].includes(tmpObj.primaryIndex);
    },
    safeSecondary: function (tmpObj) {
        return [10, 11, 14].includes(tmpObj.secondaryIndex);
    },
    lastDir: 0,
    enemy: [],
    nears: [],
    near: [],
    people: [],
    nearestEnemy: undefined,
    pushdata: {
        autoPush: false,
        pushData: {}
    },
};

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
    loadingText.style.display = "none";
    menuCardHolder.style.display = "block";
    mainMenu.style.display = "none";
    keys = {};
    macro = {};
    playerSID = yourSID;
    attackState = 0;
    inGame = true;
    packet("F", 0, getAttackDir(), 1);
    my.ageInsta = true;
    if (firstSetup) {
        firstSetup = false;
        gameObjects.length = 0;
        liztobj.length = 0;
    }
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
function sortSecondaryAmmoDamage(weapon) {
    switch (weapon) {
        case 10:
            return 12
            break
        case 15:
            return 50
            break;
        case 9:
            return 25
            break;
        case 12:
            return 35
            break;
        case 13:
            return 30
            break;
        default:
            return 0
    }
}
function potdmg(tmpObj, t) {
    let d = t - tmpObj.health;
    if (d >= 100) {
    } else {
        if (player == tmpObj) {
            if (tmpObj.skinIndex == 7 && (Math.abs(d) == 5 || (tmpObj.latestTail == 13 && Math.abs(d) == 2))) {
                tmpObj.bullTick = game.tick
                if (my.reSync) {
                    my.reSync = false;
                }
            }
            dmgpotwowwowow();
        }
    }
}
function dmgpotwowwowow() {
    let potential = DmgPotWorkfrfrfr();
    if (nears.length) {
        addMenuChText("Dev", `Dmg potential: ${potential}`, "red");
        //  notif(`Dmg potential: ${potential}`)
        if (Math.round(player.health - potential <= 0)) {
            if ((player.health - (potential * player.skinIndex == 6 ? 0.75 : 1) >= 0)) {
                game.tickBase(() => {
                    heal();
                }, 2);
            } else {
                if(player.shameCount < 5) {
                    heal();
                } else {
                    game.tickBase(() => {
                        heal();
                    }, 2);
                }
            }
        } else {
            game.tickBase(() => {
                heal();
            }, 2);
        }
    } else {
        game.tickBase(() => {
            heal();
        }, 2);
    }
}
function heal() {
    for (let i = 0; i < Math.ceil((100 - player.health) / items.list[player.items[0]].healing); i++) {
        place(0, getAttackDir());
    }
}
function DmgPotWorkfrfrfr() {
    let predictedDamage = 0;
    let weapon1Dmg, weapon2Dmg;
    let weapon1Reload, weapon2Reload;
    for (let i = 0; i < nears.length; i++) {
        let singleIndividual = nears[i];
        weapon1Dmg = items.weapons[singleIndividual.weapons[0]].dmg * sortWeaponVariant(singleIndividual.weaponVariant);
        weapon2Dmg = singleIndividual.weapons[1] == 10 ? items.weapons[singleIndividual.weapons[1]].dmg : items.weapons[singleIndividual.weapons[1]].Pdmg;
        weapon1Reload = singleIndividual.reloads[singleIndividual.weapons[0]] == 0;
        weapon2Reload = singleIndividual.reloads[singleIndividual.weapons[1]] == 0;
        if (singleIndividual.primaryIndex !== undefined) {
            predictedDamage += weapon1Reload ? weapon1Dmg * 1.5 : 0;
        } else {
            predictedDamage += 45;
        }
        if (singleIndividual.secondaryIndex !== undefined) {
            predictedDamage += weapon2Reload ? weapon2Dmg : 0;
        } else {
            predictedDamage += 50;
        }
        predictedDamage += singleIndividual.reloads[53] == 0 ? 25 : 0;
    }
}
// UPDATE HEALTH:
function updateHealth(sid, value) {
    let tmpObj = findPlayerBySID(sid);
    let secondary = {
        weapon: this.secondaryIndex,
        variant: this.secondaryVariant
    };
    if (!tmpObj) return;

    let oldHealth = tmpObj.health;
    tmpObj.oldHealth = oldHealth;
    tmpObj.health = value;
    tmpObj.judgeShame();
    if (oldHealth > value) {
        tmpObj.timeDamaged = Date.now();
        if (tmpObj === near) {
            let damage = oldHealth - value;
            let shame = tmpObj.shameCount
            if (tmpObj.skinIndex === 7 && (damage === 5 || (tmpObj.latestTail === 13 && damage === 2))) {
                tmpObj.bullTick = game.tick;
            }
        }
        tmpObj.damaged = oldHealth - value;
        advHeal.push([sid, value, tmpObj.damaged]);
    } else if (tmpObj !== player) {
        tmpObj.maxShameCount = Math.max(tmpObj.maxShameCount, tmpObj.shameCount);
    }
    if (nears.length && tmpObj.shameCount <= 5 && nears.some(items => [9, 12, 13, 15].includes(secondary.weapon))) {
        if (near.reloads[near.secondaryIndex] == 0) {
            my.empAnti = true;
            my.soldierAnti = false;
            my.BarbarianAnti = false;
        } else {
            my.soldierAnti = true
            my.empAnti = false;
            my.BarbarianAnti = false;
        }
    }
}
let lastDmgPot = 0;
var placeQueue = [];
let placedThisTick = [];
function actualPlace(id, rad) {
    selectToBuild(player.items[id]);
    sendAtck(1, rad);
    selectWeapon(player.weaponCode);
}
function updateQueue() {
    placeQueue = placeQueue.filter(e => Date.now() < e.expires);
    placedThisTick = placedThisTick.filter(e => Date.now() < e.expires);

    const limited = Math.trunc((108 - packetsCount) / 3);
    let packetsCount = 0;
    placeQueue.sort(obj => obj.priority).splice(0, Math.min(4, limited)).forEach(obj => {
        if (nearestGameObjects.find(Cords => Math.hypot(obj.position.x - Cords.x, obj.position.y - Cords.y) < Cords.scale + obj.position.objScale) && obj.priority != 0) return;
        actualPlace(obj.id, obj.angle);

        placedThisTick.push({
            x: obj.position.x,
            y: obj.position.y,
            scale: obj.position.objScale,
            expires: game.tickRate * 2 + window.pingTime + SD
        });
    });
}

let lastPre = Date.now();

setInterval(() => {
    if ((Date.now() - player?.healTimestamp > 121 + SD - pingTime) && !player?.outhealed) {
        player.outhealed = true;
        healer(1);
    }

    if (!game.ticksResynced && Date.now() - game.tickResync <= 7) {
        game.ticksResynced = true;
        onUpdate();
    }

    if (configs.autoPrePlace && Date.now() - lastPre > 22) {
        lastPre = Date.now();

        nearestGameObjects.sort((a, b) => Math.hypot(b.x - near.x3, b.y - near.y3) - Math.hypot(a.x - near.x3, a.y - near.y3)).forEach(obj => {
            if (near.dist2 > 180 ||
                Math.hypot(obj.x - player.x3, obj.y - player.y3) > config.playerScale + obj.scale) return;

            const angle = Math.atan2(obj.y - player.y3, obj.x - player.x3);
            const angles = traps.autoPlace(obj.sid, null, angle - Math.PI / 2, angle + Math.PI / 2, false, true);

            if (!angles?.length) return;

            const anglePerfect = angles.sort((a, b) => Math.abs(a - angle) - Math.abs(b - angle))[0];

            place(2, anglePerfect, 0);
        });
    }
}, 1);
setInterval(() => packetsCount = 0, 1000);
let packetsCount = 0;
// KILL PLAYER:
var deathTextScale = 99999;
function hideAllWindows() {
    storeMenu.style.display = "none";
    allianceMenu.style.display = "none";
    closeChat();
}
function killPlayer() {
    inGame = false;
    try {
        factorem.refreshAds([2], true);
    } catch (e) {}
    gameUI.style.display = "none";
    hideAllWindows();
    lastDeath = {
        x: player.x,
        y: player.y,
    };
    loadingText.style.display = "none";
    diedText.style.display = "none";
    diedText.style.fontSize = "0px";
    deathTextScale = 0;
    setTimeout(function() {
        menuCardHolder.style.display = "block";
        mainMenu.style.display = "block";
        diedText.style.display = "none";
    }, (getEl("combat").value == "ae" || getEl("combat").value == "2yl") ? 0 : config.deathFadeout);
}
// UPDATE PLAYER ITEM VALUES:
function updateItemCounts(index, value) {
    if (player) {
        player.itemCounts[index] = value;
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
    if (age == config.maxAge) {
        ageText.innerHTML = "MAX AGE";
        ageBarBody.style.width = getEl("combat").value == "ae" ? "0%" : "100%";
    } else {
        !config.cowgame ? ageText.innerHTML = `AGE ${player.age}` : ageText.innerHTML = `AGE ${player.age}`;
        ageBarBody.style.width = (getEl("combat").value == "ae" ? "0" : (player.XP / player.maxXP) * 100) + "%";
    }
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
                tmpItem.onmouseover = function() {
                    if (items.weapons[i]) {
                        showItemInfo(items.weapons[i], true);
                    } else {
                        showItemInfo(items.list[i - items.weapons.length]);
                    }
                };
                tmpItem.onclick = UTILS.checkTrusted(function() {
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
function toR(e) {
    var n = (e * Math.PI / 180) % (2 * Math.PI);
    return n > Math.PI ? Math.PI - n : n
}
function toD(e) {
    var n = (e / Math.PI * 360) % 360;
    return n >= 360 ? n - 360 : n;
}
// KILL OBJECT:
function killObject(sid) {
    objectManager.disableBySid(sid);
    countLag(sid);
    let findObj = findObjectBySid(sid);
    if (findObj) {
        var objAim = UTILS.getDirect(findObj, player, 0, 2);
        var objDst = UTILS.getDist(findObj, player, 0, 2);
        let danger = checkSpikeTick(objAim, objDst);
        // AUTO REPLACE
        if (player.alive && near.enemys.length && configs.autoReplace) {
            nearinTrap = gameObjects.find(e => e.trap && e.active && UTILS.getDist(e, near.enemy, 0, 2) <= (near.enemy.scale + e.getScale() + 3) && !e.isTeamObject(near.enemy));
            if (near.dist <= 400) {
                if (objDst <= 400) {
                    let tmpCount = -1;
                    for (let i = 0; i <= Math.PI*2; i+= Math.PI/2) {
                        tmpCount++
                        if(tmpCount <= 1) {
                            if (near.nears.length && nearinTrap && tmpCount == 0) {
                                for (let a = 0; a <= Math.PI; a+= Math.PI) {
                                    checkPlace(2, objAim+a);
                                }
                            } else if (player.items[4] == 15) {
                                for (let b = i; b <= Math.PI*1.5; b+= Math.PI) {
                                    checkPlace(4, objAim+b);
                                }
                            }
                        } else if (player.items[4] == 15) {
                            checkPlace(4, objAim+i);
                        }
                    }
                }
            }
        }
    }
}

function countLag(sid) {
    if (preplcList.includes(sid)) console.log("PrePlace Lag: " + (performance.now() - timeList[preplcList.indexOf(sid)]));
}
let antiS = false;
let antiTick = false;
function canPlace(id, radian, tmpObj) {
    try {
        var item = items.list[id];
        var tmpS = (tmpObj.scale + item.scale + (item.placeOffset||0));
        var tmpX = tmpObj.x2 + (tmpS * Math.cos(radian));
        var tmpY = tmpObj.y2 + (tmpS * Math.sin(radian));
        return objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false, tmpObj);
    } catch(e) {
    }
}
function checkSpikeTick(objAim, objDst) {
    try {
        if (near.dist <= items.weapons[near.enemy.primaryIndex || 5].range + (near.enemy.scale * 1.8) && objDst <= 180) {
            let danger = 0;
            for (let i = -0.5; i <= 0.5; i += 1/5) {
                let relAim = UTILS.getDirect(player, near.enemy, 2, 2) + i;
                if (canPlace(7, relAim, near.enemy)) {
                    danger++;
                    break;
                }
            }
            if (danger) {
                buyEquip(6, 0);
                antiTick = true;
                return true;
            } else if (!antiTick && objDst <= 200 && near.nears.length && UTILS.getAngleDist(near.aim, objAim) <= Math.PI/2) instaC.spikeTickType();
        }
        return false;
    } catch (err) {
        return null;
    }
}
// KILL ALL OBJECTS BY A PLAYER:
function killObjects(sid) {
    if (player) objectManager.removeAllItems(sid);
}
function fgdo(a, b) {
    return Math.sqrt(Math.pow((b.y - a.y), 2) + Math.pow((b.x - a.x), 2));
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
function isTeam(tmpObj) {
    return (tmpObj == player || (tmpObj.team && tmpObj.team == player.team));
}
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
    if (!document.getElementById("enemyradar" + tmpObj.sid)) {
        let addRadar = document.createElement("div");
        addRadar.id = "enemyradar" + tmpObj.sid;
        document.body.append(addRadar);
        addRadar.style = `
                display: none;
                position: absolute;
                left: 0;
                top: 0;
                width: 0;
                height: 0;
                border-style: solid;
                border-width: 10px 0 10px 20px;
                border-color: transparent transparent transparent #fff;
                `;
        getEl("combat").value == "bk86" ?
            addRadar.style.color = "#000" :
        getEl("combat").value == "emre" ?
            addRadar.style.color = "#8ecc51" :
        addRadar.style.color = "#fff";
        getEl("combat").value == "bk86" ?
            addRadar.style.borderColor = "transparent transparent transparent #000" :
        getEl("combat").value == "emre" ?
            addRadar.style.borderColor = "transparent transparent transparent #8ecc51" :
        addRadar.style.borderColor = "transparent transparent transparent #fff";
    }
    if (document.getElementById("enemyradar" + tmpObj.sid)) {
        document.getElementById("enemyradar" + tmpObj.sid).style.left = tmpX + "px";
        document.getElementById("enemyradar" + tmpObj.sid).style.top = tmpY + "px";
        document.getElementById("enemyradar" + tmpObj.sid).style.display = !isTeam(tmpObj) ? "block" : "none";
        document.getElementById("enemyradar" + tmpObj.sid).style.opacity = alpha;
        document.getElementById("enemyradar" + tmpObj.sid).style.transform = "rotate(" + UTILS.toAng(rad) + "deg)";
    }
}

let waitTicks = [];
// UPDATE PLAYER DATA:
let nEy;
let plaguemask = true;
let placeableSpikes = [];
let placeableTraps = [];
let placeableSpikesPREDICTS = [];
let FT = 0;
let AutoOneTicked = false;
let lppc = 0, ntpp = false, lppc2 = 0, ntpp2 = false;
let boostspike = false;
let doAutoQ = false;
let spinner = false;
let DmgPotStuff = {
    predictedDamage: 0
};

function mgPotWorkfrfrfr() {
    DmgPotStuff.predictedDamage = 0;
    for (let i = 0; i < nears.length; i++) {
        let singleIndividual = nears[i];
        if (singleIndividual.primaryIndex != undefined) {
            if (singleIndividual.reloads[singleIndividual.weapons[0]] == 0) {
                DmgPotStuff.predictedDamage += items.weapons[singleIndividual.weapons[0]].dmg * sortWeaponVariant(singleIndividual.weaponVariant) * 1.5
            }
        } else {
            DmgPotStuff.predictedDamage += 45
        }
        if (singleIndividual.secondaryIndex != undefined) {
            if (singleIndividual.reloads[singleIndividual.weapons[1]] == 0) {
                if (items.weapons[singleIndividual.weapons[1]] == 10) {
                    DmgPotStuff.predictedDamage += items.weapons[singleIndividual.weapons[1]].dmg * sortWeaponVariant(singleIndividual.weaponVariant)
                } else {
                    DmgPotStuff.predictedDamage += items.weapons[singleIndividual.weapons[1]].Pdmg
                }
            }
        } else {
            DmgPotStuff.predictedDamage += 50
        }
        if (singleIndividual.reloads[53] == 0) {
            DmgPotStuff.predictedDamage += 25
        }
    }
    return DmgPotStuff.predictedDamage
}
const getDistance = (x1, y1, x2, y2) => {
    let dx = x2 - x1;
    let dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
};
const getPotentialDamage = (build, user) => {
    const weapIndex = user.weapons[1] === 10 && !player.reloads[user.weapons[1]] ? 1 : 0;
    const weap = user.weapons[weapIndex];
    if (player.reloads[weap]) return 0;
    const weapon = items.weapons[weap];
    const inDist = getDistance(build.x, build.y, user.x2, user.y2) <= build.getScale() + weapon.range;
    return (user.visible && inDist) ? weapon.dmg * (weapon.sDmg || 1) * 3.3 : 0;
};

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
            let tmpX = player.x + tmpS * Math.cos(angle);
            let tmpY = player.y + tmpS * Math.sin(angle);
            if (objectManager.customCheckItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false, player, build, gameObjects, UTILS, config)) {
                return angle;
            }
        }
    }
    return null;
};
const AutoReplace = () => {
    const replaceable = [];
    const playerX = player.x;
    const playerY = player.y;
    const gameObjectCount = gameObjects.length;
    for (let i = 0; i < gameObjectCount; i++) {
        const build = gameObjects[i];
        if (build.isItem && build.active && build.health > 0) {
            let potentialDamage = players.reduce((total, p) => total + getPotentialDamage(build, p), 0);
            if (build.health <= potentialDamage) {
                replaceable.push(build);
            }
        }
    }
    const replace = () => {
        let nearTrap = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && getDistance(tmp.x, tmp.y, playerX, playerY) <= tmp.getScale() + 5);
        let spike = gameObjects.find(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && getDistance(tmp.x, tmp.y, playerX, playerY) < 87 && !nearTrap.length);
        const buildId = spike ? 4 : 2;

        replaceable.forEach(build => {
            let angle = findPlacementAngle(player, buildId, build);
            if (angle !== null) {
                place(buildId, angle);
            }
        });
    };
    const replaceDelay = game.tickSpeed - (window.pingTime || 0) + (game.tickSpeed < 110 ? 5 : 0);
    if (near && near.dist2 <= 360) {
        setTimeout(replace, replaceDelay);
    }
};
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
//             packet("f", undefined);
//         } else {
//             packet("f", dir);
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
        /*
function preplaceTry(tmpObj) {
    if (!getEl("prp").checked) return
    let index = tmpObj.weaponIndex;
    let val = items.weapons[index].dmg * (config.weaponVariants[tmpObj[(index < 9 ? "prima" : "seconda") + "ryVariant"]].val) * (items.weapons[index].sDmg || 1) * (tmpObj.skinIndex == 40 ? 3.3 : 1);
    let nearObjs = gameObjects.filter(e => e.active && e.health <= val && UTILS.getDist(e, tmpObj, 0, 2) <= (items.weapons[tmpObj.weaponIndex].range + 60) && UTILS.getDist(e, player, 0, 2) < (config.playerScale + e.scale * 3) &&　UTILS.getDist(e, near.enemy, 0, 2) < (config.playerScale + e.scale * 3));
    nearObjs.forEach((e) => {
        let delay = Math.max(0, 112 - window.pingTime);
        let id = (nearinTrap || near.dist2 <= items.weapons[player.weapons[0]].range + (config.playerScale * 1.8) || player.items[4] != 15) ? 2 : 4;
        let aim = UTILS.getDirect(e, player, 0, 2);
        setTimeout(() => {
            prePlace(id, aim, player.sid);
        }, delay);
    });
};
*/
        let PrePlaceRate = 60;
        /*
setInterval(() => {
    if (getEl("prp").checked && !autos.instaing && near.enemys.length && near.dist <= 300) {
        if (player.reloads[player.weaponIndex] <= 1000 / 9) {
            PrePlacer(player);
        }
        for (let i = 0; i < near.enemys.length; i++) {
            let iii = near.enemys[i];
            if (iii.reloads[iii.weaponIndex] <= 1000 / 9) {
                PrePlacer(iii);
            }
        }
    }
}, PrePlaceRate); // Speed
*/

        let preSpeed = game.tickRate;
        let nearinTrap = false;
        function PrePlacer(TMPOBJ) {
            let Delay = Math.max(0, game.tickRate - window.pingTime);
            let index = TMPOBJ.weaponIndex;
            let val = items.weapons[index].dmg * (config.weaponVariants[TMPOBJ[(index < 9 ? "prima" : "seconda") + "ryVariant"]].val) * (items.weapons[index].sDmg || 1) * 3.3;
            let nearObjs = gameObjects.filter(tmp => tmp.active && tmp.health <= val && !(tmp.isTeamObject(player) && tmp.hideFromEnemy) && (UTILS.getDist(tmp, TMPOBJ, 0, 2) <= (items.weapons[TMPOBJ.weaponIndex].range + player.scale + tmp.scale)) && (UTILS.getDist(tmp, near.enemy, 0, 2) <= (config.playerScale*2 + tmp.scale * 2)));
            if (nearObjs.length) {
                let obj = nearObjs.sort(function(tmp1, tmp2) {
                    return UTILS.getDist(tmp1, player, 0, 2) - UTILS.getDist(tmp2, player, 0, 2);
                })[0];
                /*
        let FindTrap = gameObjects.find(e => e.trap && e.active && UTILS.getDist(e, TMPOBJ, 0, 2) <= (near.enemy.scale + e.getScale() + 3) && !e.isTeamObject(TMPOBJ));
        */
                let FindSpike = gameObjects.find(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, TMPOBJ, 0, 2) <= (tmp.scale + 70 + player.scale));
                let trap = FindSpike || traps.intrap || obj == nearinTrap;
                setTimeout(() => {
                    if (UTILS.getDist(obj, player, 0, 2) <= (player.scale*2 + obj.scale*2)) {
                        let objAim = UTILS.getDirect(obj, player, 0, 2);
                        if (trap) {
                            prePlace(4, objAim, obj);
                        } else {
                            prePlace(2, objAim, obj);
                        }
                    }
                }, Delay);
            }
        }
        function prePlace(id, rad, obj) {
            try {
                if (id == undefined) return;
                let item = items.list[player.items[id]];
                let tmpS = player.scale + item.scale + (item.placeOffset || 0);
                let counts = 0;
                for (let i = -Math.PI/2.2; i <= Math.PI/2.2; i += Math.PI/2.2) {
                    let tmpX = player.x2 + tmpS * Math.cos(rad+i);
                    let tmpY = player.y2 + tmpS * Math.sin(rad+i);
                    if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false, player, obj)) {
                        place(id, rad+i);
                        counts++;
                        drawMark(tmpX, tmpY, item.name, item.scale, rad, true, id, obj.sid);
                    }
                    if (counts >= 2) break;
                }
            } catch (e) {}
        }
        let Words = "";
        let Writing = false;
        let writeTimer = 0;
        function modWrite(showWords) {
            if (player && player.alive) {
                writeTimer = Date.now();
                Writing = true;
                Words = showWords;
            }
        }
        const drawList = [];
        const preplcList = [];
        const timeList = [];
        let lastPlc = 0;
        function drawMark(a, b, c, d, e, preplace, id, sid) {
            if (player && player.alive) {
                if (preplace) {
                    preplcList.push(sid);
                    timeList.push(performance.now());
                    game.tickBase(() => {
                        preplcList.shift();
                        timeList.shift();
                    }, 1);
                } else {
                    /*
            drawList.push({
                x: a,
                y: b,
                name: c,
                scale: d,
                dir: e
            });
            game.tickBase(() => {
                drawList.shift();
            }, 1);
            */
                }
            }
        }


        function cPrePlace(id, rad, obj) {
            try {
                if (id == undefined) return;
                let item = items.list[player.items[id]];
                let tmpS = player.scale + item.scale + (item.placeOffset || 0);
                let tmpX = player.x2 + tmpS * Math.cos(rad);
                let tmpY = player.y2 + tmpS * Math.sin(rad);
                if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false, player, obj)) {
                    return true;
                } else {
                    for (let i = -0.5; i <= 0.5; i += 1/5) {
                        let tmpX = player.x2 + tmpS * Math.cos(rad+i);
                        let tmpY = player.y2 + tmpS * Math.sin(rad+i);
                        if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false, player, obj)) {
                            return true;
                            break;
                        }
                    }
                }
            } catch (e) {}
        }
function updatePlayers(data) {
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

            if (player.shameCount < 4 && near.dist3 <= 300 && near.reloads[near.primaryIndex] <= game.tickRate * (window.pingTime >= 200 ? 2 : 1)) {
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
                    let nearTrap = liztobj.filter(e => e.trap && e.active && UTILS.getDist(e, tmpObj, 0, 2) <= (tmpObj.scale + e.getScale() + 25) && !e.isTeamObject(tmpObj)).sort(function(a, b) {
                        return UTILS.getDist(a, tmpObj, 0, 2) - UTILS.getDist(b, tmpObj, 0, 2);
                    })[0];
                    if (nearTrap) {
                        let spike = gameObjects.filter(obj => obj.dmg && cdf(tmpObj, obj) <= tmpObj.scale + nearTrap.scale/2 && !obj.isTeamObject(tmpObj) && obj.active)[0]
                        traps.dist = UTILS.getDist(nearTrap, tmpObj, 0, 2);
                        traps.aim = UTILS.getDirect(spike ? spike : nearTrap, tmpObj, 0, 2);

                        // traps.dist = UTILS.getDist(nearTrap, tmpObj, 0, 2);
                        // traps.aim = UTILS.getDirect(nearTrap, tmpObj, 0, 2);
                        traps.protect(caf(nearTrap, tmpObj) - Math.PI);
                        traps.inTrap = true;
                        traps.info = nearTrap;
                    } else {
                        traps.inTrap = false;
                        traps.info = {};
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
    let i = 0;
    if (configs.autoPrePlace && !autos.instaing && near.dist <= 300) {
        if (player.reloads[player.weaponIndex] <= 1000 / 9) {
            PrePlacer(player);
            let iii = near.enemys[i];
            if (iii.reloads[iii.weaponIndex] <= 1000 / 9) {
                PrePlacer(iii);
            }
        }
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
        textManager.stack.forEach((text, value, x, y) => {
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
        let value;
        let x;
        let y;
        if (num2 > 0) {
            textManager.showText(pos2.x, pos2.y, Math.max(45, Math.min(50, num2)), 0.18, 500, num2, "#8ecc51");
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
        getDamageThreat(tmpObj);
        i += 13;
    }
    /*projectiles.forEach((proj) => {
                    tmpObj = proj;
                    if (tmpObj.active) {
                        tmpObj.tickUpdate(game.tickSpeed);
                    }
                });*/
    if (player && player.alive) {
        // Spin for international.terrorist
        if (getEl("spin").checked && !(clicks.middle || clicks.left || clicks.right) && !my.waitHit && !traps.inTrap) {
            spinner = true;
        } else {
            spinner = false;
        }

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
                const [sid, value, damaged] = updHealth;
                let tmpObj = findPlayerBySID(sid);
                let bullTicked = false;
                if (tmpObj.health <= 0) {
                    if (!tmpObj.death) {
                        tmpObj.death = true;
                        if (tmpObj!= player) {
                            addMenuChText("", `${tmpObj.name} {${tmpObj.sid}} has died.`, "red");
                        }
                        addDeadPlayer(tmpObj);
                    }
                }
                if (tmpObj == player) {
                    if (tmpObj.skinIndex == 7 && (damaged == 5 || (tmpObj.latestTail == 13 && damaged == 2))) {
                        if (my.reSync) {
                            my.reSync = false;
                            tmpObj.setBullTick = true;
                        }
                        bullTicked = true;
                    }
                    if (inGame) {
                        const attackers = getAttacker(damaged);
                        const gearDmgs = [0.25, 0.45].map((val) => val * items.weapons[player.weapons[0]].dmg * soldierMult());
                        const includeSpikeDmgs =!bullTicked && gearDmgs.includes(damaged);
                        let healTimeout = 100;
                        const pingHealTimeout = 140 / 16;
                        const slowHeal = function(timer) {
                            setTimeout(() => {
                                healer();
                            }, 99);
                        }
                        if (config.idk) {
                            if (attackers.length) {
                                const by = attackers.filter((tmp) => {
                                    if (tmp.dist2 <= (tmp.weaponIndex < 9? 300 : 700)) {
                                        tmpDir = UTILS.getDirect(player, tmp, 2, 2);
                                        if (UTILS.getAngleDist(tmpDir, tmp.d2) <= Math.PI) {
                                            return tmp;
                                        }
                                    }
                                });
                                if (by.length) {
                                    const maxDamage = (includeSpikeDmgs? 10 : 10);
                                    if (damaged > maxDamage && (game.tick - tmpObj.antiTimer) > 1) {
                                        tmpObj.canEmpAnti = true;
                                        tmpObj.antiTimer = game.tick;
                                        let shame = 4;
                                        if (tmpObj.shameCount < shame) {
                                            tmpObj.canEmpAnti = true;
                                            healer();
                                            if (player.health == 25);
                                            healer();
                                            if (player.heatlh == 43.75);
                                            healer();
                                            if (player.health == 55);
                                            healer();
                                            if (player.health == 45);
                                            healer();
                                            if (player.health == 57.75);
                                            healer();
                                        } else if (tmpObj.shameCount >= shame && near.primaryIndex == (3 || 5)) {
                                            tmpObj.canEmpAnti = true;
                                            slowHeal(configs.doPingHeal? pingHealTimeout : healTimeout);
                                        } else {
                                            slowHeal(configs.doPingHeal? pingHealTimeout : healTimeout);
                                        }
                                    } else {
                                        slowHeal(configs.doPingHeal? pingHealTimeout : healTimeout);
                                    }
                                } else {
                                    slowHeal(configs.doPingHeal? pingHealTimeout : healTimeout);
                                }
                            } else {
                                slowHeal(configs.doPingHeal? pingHealTimeout : healTimeout);
                            }
                        } else {
                            if (damaged >= (includeSpikeDmgs? 8 : 20) && ((player.health) - tmpObj.damageThreat) <= 0 && (game.tick - tmpObj.antiTimer) > 1) {
                                tmpObj.canEmpAnti = true;
                                tmpObj.antiTimer = game.tick;
                                let shame = 5;
                                if (tmpObj.shameCount < shame) {
                                    healer();
                                } else {
                                    slowHeal(configs.doPingHeal? pingHealTimeout : healTimeout);
                                }
                            } else {
                                slowHeal(configs.doPingHeal? pingHealTimeout : healTimeout);
                            }
                        }
                        if (damaged >= 30 && player.skinIndex == 11) {
                            instaC.canCounter = true;
                        }
                    } else {
                        if (!tmpObj.setPoisonTick && (tmpObj.damaged == 5 || (tmpObj.latestTail == 13 && tmpObj.damaged == 2))) {
                            tmpObj.setPoisonTick = true;
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
        if (inGame) {
            if (enemy.length) {
                function ch(e) {
                    io.send("6", e.slice(0, 30));
                }
                function ch2(text, waitCount = 3000) {
                    player.chat.message = text;
                    player.chat.count = waitCount;
                }
                function ch3(text, time = 500, color = "#fff") {
                    textManager.showText(player.x2, player.y2, 30, 0.15, time, text, color, 2);
                }
                // Dir:
                function toDeg(a) {
                    return a / (Math.PI / 180)
                }
                // Angel:
                function angleDist(angle1, angle2) {
                    if(angle1 < 0) angle1 += Math.PI*2;
                    if(angle2 < 0) angle2 += Math.PI*2;
                    return Math.abs(angle1 - angle2);
                }
                function fixAngle(a) {
                    return (360 + (a % 360)) % 360;
                }
                function calcAngle(xs, ys, xe, ye) {
                    return Math.atan2(ye - ys, xe - xs);
                }
                // Dist:
                function getDistance(x1, y1, x2, y2) {
                    return Math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
                }
                // Synced:
                let Synced = {
                    SyncShotPri: 0,
                    SyncShotSec: 0,
                    bultect: false,
                }
                function isAlly(sid){
                    let _ = findPlayerByID(near);
                    _ = findPlayerBySID(sid)
                    if(!_){
                        return
                    }
                    if(player.sid == sid){
                        return true
                    }else if(_.team){
                        return _.team === player.team ? true : false
                    } else {
                        return false
                    }
                }
                function canSyncHit() {
                    let N = gameObjects;
                    let _ = findPlayerByID(near);
                    if(player.reloads[player.weapons[0]] != 1) return false;
                    if(near.dist2/1.56 > items.weapons[player.weapons[0]].range) return false;
                    let x = (_.velX || _.x2), y = (_.velY || _.y2);
                    let isEnemyTraped = false;
                    for(let i = 0; i < N.length; i++) {
                        if(N[i] && N[i].name == "pit trap" && N[i].active && (N[i].owner.sid == player.sid || isAlly(N[i].owner.sid)) && Math.hypot(N[i].y - _.y2, N[i].x - _.x2) < 70) {
                            isEnemyTraped = true;
                        }
                        if(N[i] && N[i].dmg && N[i].active && isEnemyTraped == false && (N[i].owner.sid == player.sid || isAlly(N[i].owner.sid))) {
                            if(Math.hypot(N[i].y - y, N[i].x - x) <= 35 + N[i].scale) {
                                return true;
                            }
                        }
                    }
                    if(_.health - (Math.round(items.weapons[player.weapons[0]].dmg * 1.5 * window.variantMulti(items.weapons[player.weapons[0]].variant) * (_.skinIndex == 6 ? .75 : 1))) <= 0) {
                        return true;
                    }
                    return false;
                }
                // Anti
                if (true) {

                    let edetect = false;
                    players.forEach(_ => {
                        if (_ == player) return;
                        let angle = calcAngle(player.x, player.y, _.x, _.y);
                        if (near && near.primaryVariant >= 1 && near.primaryIndex === 5 && near.dist2 < 350 && angleDist(
                            (angle), toDeg(arguments[2])) < 50 && getDistance(_.x, _.y, arguments[0], arguments[1]) < 130) {
                            edetect = true;
                        }
                    });
                    if (edetect && arguments[3] === 1400 && arguments[4] === 3.6) {
                        ch("AOT detect");
                        Hg(6, 21);
                        setTimeout(() => {
                            edetect = false;
                        }, 600);
                    }
                }
                // Auto Sync:
                if (true) {
                    // autoSync
                    if (getEl("autosyncsec").checked) {
                        if (Synced.SyncShotSec >= 1 && player.weapons[1] == 15) {
                            instaC.syncTry();
                            Synced.SyncShotSec = 0;
                        }
                        /*
                                    if (Synced.SyncShotPri >= 1 && near.dist2 <= (items.weapons[player.weapons[0]].range + near.scale * 1.8) && player.weapons[1] == 15) {
                                        instaC.syncTry("insta", 5);
                                        Synced.SyncShotPri = 0;
                                    }
                                    */
                    }
                    // autoHit:
                    if(getEl("autosyncHited").checked && canSyncHit() && !my.waitHit && near.dist2 <= 250 && !traps.inTrap) {
                        setTimeout(() => {
                            my.autoAim = true;
                            my.waitHit = true;
                            Hg(7, 18);
                            sendAutoGather();
                            // Add your custom logic or function calls here
                            setTimeout(() => {
                                my.autoAim = false;
                                my.waitHit = false;
                                sendAutoGather();
                            }, 1);
                        }, 1);
                        ch("sync :3");
                    }
                    // near bullTciked:
                    if((game.tick - near.bullTick) % 9 == 0 && near.skinIndex == 7) {
                        //Synced.bultect = true;
                        game.tickBase(() => {
                            //Synced.bultect = false;
                        }, 1)
                    }
                }
                // Anti Sync:
                if (player.syncThreats >= 2 && getEl("antisync").checked && !my.antiSync) {
                    ch("sync detect test");
                    antiSyncHealing(3);
                } else if (player.syncThreats >= 4 && !my.antiSync) {
                    ch("multibox stupid tactic");
                    antiSyncHealing(5);
                }
                // Anti Insta:
                if (player.canEmpAnti) {
                    player.canEmpAnti = false;
                    if (near.dist2 <= 300 && !my.safePrimary(near) && !my.safeSecondary(near)) {
                        if (near.reloads[53] == 0) {
                            player.empAnti = true;
                            player.soldierAnti = false;
                            if (getEl("SmartEmpSoldierAnti").checked) {//anti insta
                                Hg(22, 21);
                            }
                        } else {
                            player.empAnti = false;
                            player.soldierAnti = true;
                            if (getEl("SmartEmpSoldierAnti").checked) {//anti insta
                                Hg(6, 21);
                            }
                        }
                    }
                }
                let prehit = liztobj.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 3) <= (tmp.scale + near.scale)).sort(function(a, b) {
                    return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                })[0];
                if (prehit) {
                    if (near.dist3 <= items.weapons[player.weapons[0]].range + player.scale * 1.8 && configs.predictTick) {
                        instaC.canSpikeTick = true;
                        instaC.syncHit = true;
                        if (configs.revTick && player.weapons[1] == 15 && player.reloads[53] == 0 && instaC.perfCheck(player, near)) {
                            instaC.revTick = true;
                        }
                    }
                }
                let antiSpikeTick = gameObjects.filter(tmp => tmp.dmg && tmp.active && !tmp.isTeamObject(player) && UTILS.getDist(tmp, player, 0, 3) < (tmp.scale + player.scale)).sort(function(a, b) {
                    return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
                })[0];
                if (antiSpikeTick && !traps.inTrap) {
                    if (near.dist2 <= items.weapons[5].range + near.scale * 1.8) {
                        my.anti0Tick = 1;
                        player.chat.count = 2000;
                    }
                }
            }
            if (getEl("combat").value == 'bk86' && player.skins[53] && player.reloads[53] == 0 && near.skinIndex != 22 && !instaC.isTrue && near.health <= 25) {
                instaC.isTrue = true;
                buyEquip(53, 0);
                setTickout(() => {
                    instaC.isTrue = false;
                }, 1);
            }
            if ((useWasd ? true : ((player.checkCanInsta(true) >= 220 ? player.checkCanInsta(true) : player.checkCanInsta(false)) >= (player.weapons[1] == 10 ? 95 : 100))) && near.dist2 <= items.weapons[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]].range + near.scale * 1.8 && (instaC.wait || (useWasd && Math.floor(Math.random() * 5) == 0)) && !instaC.isTrue && !my.waitHit && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && (useWasd ? true : (player.reloads[53] <= (player.weapons[1] == 10 ? 0 : game.tickRate))) && instaC.perfCheck(player, near)) {
                if (player.checkCanInsta(true) >= 220) {
                    instaC.nobull = useWasd ? false : instaC.canSpikeTick ? false : true;
                } else {
                    instaC.nobull = false;
                }
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
            if (game.tick % 1 == 0) {
                if (mills.place) {
                    //let plcAng = 7.7
                    let plcAng = 15.7079632679 / 2;
                    for (let i = -plcAng; i <= plcAng; i += plcAng) {
                        checkPlace(3, UTILS.getDirect(player.oldPos, player, 2, 2) + i);
                    }
                } else {
                    if (mills.placeSpawnPads) {
                        for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
                            checkPlace(
                                player.getItemType(20),
                                UTILS.getDirect(player.oldPos, player, 2, 2) + i
                            );
                        }
                    }
                }
            }
            if (judgeAtNextTick) {
                judgeAtNextTick = false;
                if (getEl("soldieranti").checked && enemy.length && near.reloads[53] <= config.tickRate && (near.secondaryIndex != 10 && near.secondaryIndex != 11 && near.secondaryIndex != 14)) {
                    doEmpAntiInsta = true;
                }
            }
            if (instaC.can) {
                instaC.changeType(getEl("instaType").value == "rev" || player.weapons[1] == 10 ? "rev" : getEl("backupNobull").checked ? "nobull" : "normal");
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
                        chch(null, "[RevSyncHit]", "yellow");
                    }
                } else {
                    if ([1, 2, 3, 4, 5, 6].includes(player.weapons[0]) && player.reloads[player.weapons[0]] == 0 && !instaC.isTrue) {
                        instaC.spikeTickType();
                        if (instaC.syncHit) {
                            chch(null, "[SyncHit]", "yellow");
                        }
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
            if (useWasd && !clicks.left && !clicks.right && !instaC.isTrue && near.dist2 <= (items.weapons[player.weapons[0]].range + near.scale * 1.8) && !traps.inTrap) {
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

            if (traps.inTrap) {
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
            if (clicks.middle && !traps.inTrap) {
                if (!instaC.isTrue && player.reloads[player.weapons[1]] == 0) {
                    if (my.ageInsta && player.weapons[0] != 4 && player.weapons[1] == 9 && player.age >= 9 && enemy.length) {
                        instaC.bowMovement();
                    } else {
                        instaC.rangeType();
                    }
                }
            }
            if (macro.t && !traps.inTrap) {
                if (!instaC.isTrue && player.reloads[player.weapons[0]] == 0 && (player.weapons[1] == 15 ? (player.reloads[player.weapons[1]] == 0) : true) && (player.weapons[0] == 5 || (player.weapons[0] == 4 && player.weapons[1] == 15))) {
                    instaC[(player.weapons[0] == 4 && player.weapons[1] == 15) ? "kmTickMovement" : "tickMovement"]();
                }
            }
            if (macro.c && !traps.inTrap) {
                if (!instaC.isTrue && player.reloads[player.weapons[0]] == 0 && ([9, 12, 13, 15].includes(player.weapons[1]) ? (player.reloads[player.weapons[1]] == 0) : true)) {
                    instaC.boostTickMovement();
                }
            }
            let inbullspam = false;
            if (!instaC.canSpikeTick && !clicks.right && !clicks.left && configs.doAutoBullSpam) {
                if (near.dist2 <= (items.weapons[player.weapons[0]].range + near.scale * 1.8) && !traps.inTrap) {
                    inbullspam = true;
                    if (!my.waitHit && player.reloads[player.weapons[0]] == 0 && !instaC.can) {
                        my.waitHit = 1;
                        my.autoAim = true;
                        buyEquip(7, 0);
                        buyEquip(21, 1);
                        sendAutoGather();
                        game.tickBase(() => {
                            my.waitHit = 0;
                            sendAutoGather();
                            my.autoAim = false;
                            buyEquip(6, 0);
                            buyEquip(21, 1);
                        }, 1);
                    }
                    player.weaponCode = player.weapons[0];
                    if (player.weaponIndex != player.weapons[0]) {
                        selectWeapon(player.weapons[0]);
                    }
                } else {
                    my.autoAim = false;
                    inbullspam = false;
                }
            } else {
                inbullspam = false;
            }
            if (player.weapons[1] && !clicks.left && !clicks.right && !traps.inTrap && !instaC.isTrue && !(useWasd && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8)) {
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
            /* end shit */
            function doOneFrame() {
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
            /* end shit */
            function autoOneFrame() {
                let neIT = false;
                let nearTrapped = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= (near.scale + tmp.getScale() + 15))
                .sort(function(a, b) {
                    return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                })[0];

                if (nearTrapped) {
                    neIT = true;
                }

                if (configs.autoOneFrame) {
                    let ping = window.pingTime;
                    let range = (ping > 140) ? 230 : (ping > 110) ? 210 : (ping > 85) ? 190 : 170;
                    if (near.dist2 > range && near.dist2 <= 245 && !traps.inTrap && player.reloads[player.weapons[0]] == 0 && player.reloads[53] == 0 && player.weapons[0] == 5 && ((!neIT && near.skinIndex != 6) || neIT)) {
                        packet("9", undefined, 1);
                        game.tickBase(() => {
                            packet("9", near.aim2, 1);
                        }, 1);
                        doOneFrame();
                    }
                }
            }
            if (!instaC.isTrue && !traps.inTrap && !traps.replaced) {
                traps.autoPlace();
            }
            if (!instaC.isTrue && configs.autoOneFrame && autoOneFrameToggled) {
                autoOneFrame();
            }
            if (!macro.q && !macro.f && !macro.v && !macro.h && !macro.n) {
                packet("D", getAttackDir());
            }
            function safeWeapon1() {
                return (near.primaryIndex == 0 || near.primaryIndex == 6 || near.primaryIndex == 7 || near.primaryIndex == 8);
            }
            function safeWeapon2() {
                return (near.secondaryIndex == 9 || near.secondaryIndex == 10 || near.secondaryIndex == 11 || near.secondaryIndex == 14);
            }
            function changeHat(value) {
                if (value == "normal") {
                    if (my.anti0Tick > 0) {
                        buyEquip(6, 0);
                    } else {
                        if ((player.shameCount > 0 && (ticks.tick - player.bTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) {
                            buyEquip(7, 0);
                        } else {
                            if (getEl("combat").value == "ae" || getEl("combat").value == "Oldae" || getEl("combat").value == "WasdMode") {
                                buyEquip(6, 0)
                            } else if (getEl("combat").value == "fz" || getEl("combat").value == "Uncve" || getEl("combat").value == "TesterMode" || getEl("combat").value == "Totalew" || getEl("combat").value == "2yl" || getEl("combat").value == "resp") {
                                if (my.empAnti > 0 || doEmpAntiInsta) {
                                    buyEquip(22, 0);
                                } else {
                                    if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
                                        buyEquip(31, 0);
                                    } else {
                                        if (enemy.length) {
                                            if (near.dist2 <= items.weapons[near.primaryIndex ? near.primaryIndex : 5].range + player.scale * 3) {
                                                if (near.primaryIndex != undefined && near.reloads[near.primaryIndex] == 0 && near.secondaryIndex != undefined && near.reloads[near.secondaryIndex] == 0 && player.reloads[player.weapons[0]] <= config.tickRate && player.reloads[player.weapons[1]] == 0 && player.weapons[0] != 7 && player.weapons[0] != 8 && near.primaryIndex != 7 && near.primaryIndex != 8) {
                                                    buyEquip(11, 0);
                                                } else {
                                                    if (safeWeapon1() && safeWeapon2() && !getEl("combat").value == "TesterMode" && getEl("combat").value != "2yl" && getEl("combat").value != "resp") {
                                                        buyEquip(26, 0);
                                                    } else {
                                                        buyEquip(getEl("soldieranti").checked ? 6 : 26, 0);
                                                    }
                                                }
                                            } else {
                                                biomeGear();
                                            }
                                        } else {
                                            biomeGear();
                                        }
                                    }
                                }
                            } else if (getEl("combat").value == "bk86" || getEl("combat").value == "Pixelz" || getEl("combat").value == "Jet") {
                                if (my.empAnti > 0 || doEmpAntiInsta) {
                                    buyEquip(22, 0);
                                } else {
                                    if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
                                        buyEquip(31, 0);
                                    } else {
                                        if (enemy.length) {
                                            if (near.dist2 <= items.weapons[near.primaryIndex ? near.primaryIndex : 5].range + player.scale * 3) {
                                                if (configs.antiBull > 0 && player.weapons[0] != 7) {
                                                    buyEquip(11, 0);
                                                } else {
                                                    buyEquip(getEl("soldieranti").checked ? 6 : 26, 0);
                                                }
                                            } else {
                                                biomeGear();
                                            }
                                        } else {
                                            biomeGear();
                                        }
                                    }
                                }
                            } else if (getEl("combat").value == "emre") {
                                if (my.empAnti > 0 || doEmpAntiInsta) {
                                    buyEquip(22, 0);
                                } else {
                                    if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
                                        buyEquip(near.dist2 <= player.scale * 1.5 ? 6 : 31, 0);
                                    } else {
                                        if (enemy.length) {
                                            if (near.dist2 <= items.weapons[near.primaryIndex ? near.primaryIndex : 5].range + player.scale * 3) {
                                                if (configs.antiBull > 0 && (player.weapons[0] != 7 && player.weapons[0] != 8)) {
                                                    buyEquip(player.skins[11] ? 11 : 6, 0);
                                                } else {
                                                    buyEquip(6, 0);
                                                }
                                            } else {
                                                biomeGear();
                                            }
                                        } else {
                                            biomeGear();
                                        }
                                    }
                                }
                            } else {
                                if (my.empAnti > 0 || doEmpAntiInsta) {
                                    buyEquip(22, 0);
                                } else {
                                    if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
                                        buyEquip(31, 0);
                                    } else {
                                        if (enemy.length) {
                                            if (near.dist2 <= items.weapons[near.primaryIndex ? near.primaryIndex : 5].range + player.scale * 3) {
                                                if (configs.antiBull > 0 && player.weapons[0] != 7) {
                                                    buyEquip(11, 0);
                                                } else {
                                                    buyEquip(getEl("soldieranti").checked ? 6 : 26, 0);
                                                }
                                            } else {
                                                biomeGear();
                                            }
                                        } else {
                                            biomeGear();
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else if (value == "click") {
                    if (my.anti0Tick > 0) {
                        buyEquip(6, 0);
                    } else {
                        if ((player.shameCount > 0 && (ticks.tick - player.bTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) {
                            buyEquip(7, 0);
                        } else {
                            if (clicks.left && player.reloads[player.weapons[0]] == 0) {
                                buyEquip(getEl("weaponGrind").checked ? 40 : 7, 0)
                            } else if (clicks.right && player.reloads[(player.weapons[1] == 10) ? player.weapons[1] : player.weapons[0]] == 0) {
                                buyEquip(40, 0);
                                buyEquip(19, 1);
                            } else {
                                if (getEl("combat").value == "ae" || getEl("combat").value == "Oldae" || getEl("combat").value == "WasdMode" || getEl("combat").value == "resp") {
                                    buyEquip(6, 0);
                                } else if (getEl("combat").value == "fz" || getEl("combat").value == "Uncve" || getEl("combat").value == "TesterMode" || getEl("combat").value == "Totalew" || getEl("combat").value == "2yl" || getEl("combat").value == "Jet") {
                                    if (my.empAnti > 0 || doEmpAntiInsta) {
                                        buyEquip(22, 0);
                                    } else {
                                        if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
                                            buyEquip(31, 0);
                                        } else {
                                            if (near.dist2 <= 500) {
                                                if (safeWeapon1() && safeWeapon2() && getEl("combat").value != "TesterMode" || getEl("combat").value != "2yl" || getEl("combat").value != "Jet") {
                                                    buyEquip(6, 0);
                                                } else {
                                                    buyEquip(getEl("soldieranti").checked ? 6 : 26, 0);
                                                }
                                            } else {
                                                biomeGear();
                                            }
                                        }
                                    }
                                } else if (getEl("combat").value == "bk86") {
                                    if (my.empAnti > 0 || doEmpAntiInsta) {
                                        buyEquip(22, 0);
                                    } else {
                                        if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
                                            buyEquip(31, 0);
                                        } else {
                                            if (clicks.left && configs.antiBull > 0 && player.weapons[0] != 7) {
                                                buyEquip(11, 0);
                                            } else {
                                                buyEquip(getEl("soldieranti").checked ? 6 : 26, 0);
                                            }
                                        }
                                    }
                                } else if (getEl("combat").value == "emre") {
                                    if (my.empAnti > 0 || doEmpAntiInsta) {
                                        buyEquip(22, 0);
                                    } else {
                                        if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
                                            buyEquip(31, 0);
                                        } else {
                                            if (clicks.left && player.weapons[0] != 8) {
                                                buyEquip(configs.antiBull > 0 ? player.skins[11] ? 11 : 6 : 6, 0);
                                            } else {
                                                buyEquip(6, 0);
                                            }
                                        }
                                    }
                                } else {
                                    if (my.empAnti > 0 || doEmpAntiInsta) {
                                        buyEquip(22, 0);
                                    } else {
                                        if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
                                            buyEquip(31, 0);
                                        } else {
                                            if (clicks.left && configs.antiBull > 0 && player.weapons[0] != 7) {
                                                buyEquip(11, 0);
                                            } else {
                                                buyEquip(getEl("soldieranti").checked ? 6 : 26, 0);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else if (value == "trap") {
                    if(tmpObj != player && UTILS.getDistance(tmpObj.x, tmpObj.y, player.x, player.y) <= items.weapons[tmpObj.weaponIndex].range + 35) {
                        buyEquip(6, 0);
                    } else if (my.anti0Tick > 0) {
                        buyEquip(6, 0);
                    } else {
                        if ((player.shameCount > 0 && (ticks.tick - player.bTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) {
                            buyEquip(7, 0);
                        } else {
                            if (traps.healths > items.weapons[player.weapons[0]].dmg && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) {
                                buyEquip(40, 0);
                            } else {
                                if (getEl("combat").value == "fz" || getEl("combat").value == "Uncve" || getEl("combat").value == "Totalew") {
                                    if (my.empAnti > 0 || doEmpAntiInsta) {
                                        buyEquip(22, 0);
                                    } else {
                                        if (near.dist2 <= 300) {
                                            if ((safeWeapon1() && safeWeapon2()) || (near.primaryIndex == 5 && near.dist2 >= 175)) {
                                                buyEquip(26, 0);
                                            } else {
                                                buyEquip(getEl("soldieranti").checked ? 6 : 26, 0);
                                            }
                                        } else {
                                            biomeGear();
                                        }
                                    }
                                } else if (getEl("combat").value == "hans" || getEl("combat").value == "TesterMode" || getEl("combat").value == "2yl" || getEl("combat").value == "resp" || getEl("combat").value == "EwV") {
                                    if (my.empAnti > 0 || doEmpAntiInsta || near.secondaryIndex == 10 || (safeWeapon1() && safeWeapon2())) {
                                        buyEquip(getEl("combat").value == "resp" || getEl("combat").value == "2yl" ? 6 : 22, 0);
                                    } else {
                                        buyEquip(getEl("soldieranti").checked ? 6 : 26, 0);
                                    }
                                } else if (getEl("combat").value == "Pixelz") {
                                    if (my.empAnti > 0 || doEmpAntiInsta) {
                                        buyEquip(22, 0);
                                    } else {
                                        buyEquip(26, 0);
                                    }
                                } else if (getEl("combat").value == "Jet") {
                                    if (my.empAnti > 0 || doEmpAntiInsta) {
                                        buyEquip(22, 0);
                                    } else {
                                        buyEquip(26, 0);
                                    }
                                } else if (getEl("combat").value == "emre") {
                                    if (my.empAnti > 0 || doEmpAntiInsta) {
                                        buyEquip(22, 0);
                                    } else {
                                        if (traps.healths < items.weapons[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]].dmg) {
                                            buyEquip(6, 0);
                                        } else {
                                            if (enemy.length) {
                                                buyEquip(6, 0);
                                            } else {
                                                buyEquip(11, 0);
                                            }
                                        }
                                    }
                                } else {
                                    if (my.empAnti > 0 || doEmpAntiInsta || (near.dist2 > 300 && getEl("combat").value != "Oldae" && getEl("combat").value != "WasdMode" && getEl("combat").value != "ae")) {
                                        buyEquip(22, 0);
                                    } else {
                                        buyEquip(getEl("soldieranti").checked ? 6 : 26, 0);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            function changeAcc(value) {
                if (value == "normal") {
                    if (getEl("combat").value == "ae" || getEl("combat").value == "TesterMode" || getEl("combat").value == "Oldae" || getEl("combat").value == "WasdMode" || getEl("combat").value == "Totalew" || getEl("combat").value == "resp") {
                        buyEquip(near.dist2 < 350 ? 0 : 11, 1);
                    } else if (getEl("combat").value == "2yl") {
                        buyEquip(near.dist2 < 350 ? 0 : 11, 1);
                    } else {
                        if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
                            buyEquip(11, 1);
                        } else {
                            if (enemy.length) {
                                if (getEl("combat").value == "fz" || getEl("combat").value == "Uncve" || getEl("combat").value == "Jet") {
                                    if (near.dist2 <= items.weapons[near.primaryIndex ? near.primaryIndex : 5].range + player.scale * 3) {
                                        if (near.primaryIndex != undefined && near.reloads[near.primaryIndex] == 0 && near.secondaryIndex != undefined && near.reloads[near.secondaryIndex] == 0 && player.reloads[player.weapons[0]] <= config.tickRate && player.reloads[player.weapons[1]] == 0 && player.weapons[0] != 7 && player.weapons[0] != 8 && near.primaryIndex != 7 && near.primaryIndex != 8) {
                                            buyEquip(21, 1);
                                        } else {
                                            if (configs.antiBull > 0) {
                                                buyEquip(21, 1);
                                            } else {
                                                if ((ticks.tick - player.bTick) % config.serverUpdateRate === 0) {
                                                    buyEquip(13, 1);
                                                } else {
                                                    buyEquip(11, 1);
                                                }
                                            }
                                        }
                                    } else {
                                        buyEquip(11, 1);
                                    }
                                } else if (getEl("combat").value == "emre") {
                                    if (near.dist2 <= items.weapons[near.primaryIndex ? near.primaryIndex : 5].range + player.scale * 3) {
                                        if (configs.antiBull > 0) {
                                            buyEquip(player.tails[21] ? 21 : 0, 1);
                                        } else {
                                            if ((ticks.tick - player.bTick) % config.serverUpdateRate === 0) {
                                                buyEquip(13, 1);
                                            } else {
                                                buyEquip(near.dist2 <= 270 ? player.tails[21] ? 21 : 0 : 0, 1);
                                            }
                                        }
                                    } else {
                                        buyEquip(useWasd == undefined ? 0 : 11, 1);
                                    }
                                } else {
                                    if (near.dist2 <= items.weapons[near.primaryIndex ? near.primaryIndex : 5].range + player.scale * 3) {
                                        if (configs.antiBull > 0) {
                                            buyEquip(21, 1);
                                        } else {
                                            buyEquip(11, 1);
                                        }
                                    } else {
                                        buyEquip(11, 1);
                                    }
                                }
                            } else {
                                buyEquip(11, 1);
                            }
                        }
                    }
                } else if (value == "click") {
                    if (getEl("combat").value == "ae" || getEl("combat").value == "TesterMode" || getEl("combat").value == "Oldae" || getEl("combat").value == "WasdMode" || getEl("combat").value == "2yl" || getEl("combat").value == "resp") {
                        if (clicks.left) {
                            buyEquip(0, 1);
                        } else if (clicks.right) {
                            buyEquip(11, 1);
                        }
                    } else if (getEl("combat").value == "fz" || getEl("combat").value == "Uncve" || getEl("combat").value == "Totalew" || getEl("combat").value == "Jet") {
                        if (configs.antiBull > 0) {
                            buyEquip(21, 1);
                        } else {
                            if (clicks.left && player.reloads[player.weapons[0]] == 0) {
                                buyEquip(near.dist2 <= 300 ? 18 : 0, 1);
                            } else if (clicks.right && player.reloads[(player.weapons[1] == 10) ? player.weapons[1] : player.weapons[0]] == 0) {
                                buyEquip(getEl("combat").value == "Jet" ? near.dist2 <= 250 ? 21 : 11 : near.dist2 <= 300 ? 18 : 11, 1);
                            } else {
                                if ((ticks.tick - player.bTick) % config.serverUpdateRate === 0) {
                                    buyEquip(near.dist2 <= 500 ? 13 : 11, 1);
                                } else {
                                    buyEquip(11, 1);
                                }
                            }
                        }
                    } else if (getEl("combat").value == "emre") {
                        if (configs.antiBull > 0) {
                            buyEquip(player.tails[21] ? 21 : 0, 1);
                        } else {
                            if (clicks.left) {
                                buyEquip(player.reloads[player.weapons[0]] == 0 ? near.skinIndex == 11 ? 21 : 18 : 21, 1);
                            } else if (clicks.right) {
                                buyEquip(near.dist2 <= 300 ? 21 : 0, 1);
                            } else {
                                if ((ticks.tick - player.bTick) % config.serverUpdateRate === 0) {
                                    buyEquip(near.dist2 <= 650 ? 13 : 0, 1);
                                } else {
                                    buyEquip(11, 1);
                                }
                            }
                        }
                    } else {
                        buyEquip(0, 1);
                    }
                } else if (value == "trap") {
                    if (getEl("combat").value == "ae" || getEl("combat").value == "Oldae" || getEl("combat").value == "WasdMode" || getEl("combat").value == "resp") {
                        buyEquip(getEl("combat").value == "resp" || getEl("combat").value == "WasdMode" ? 21 : 0, 1)
                    } else if (getEl("combat").value == "TesterMode" || getEl("combat").value == "2yl") {
                        if (configs.waitHit || traps.healths > items.weapons[player.weapons[0]].dmg && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) {
                            buyEquip(getEl("combat").value == "2yl" ? 13 : 18, 1);
                        } else {
                            buyEquip(13, 1);
                        }
                    } else if (getEl("combat").value == "hans" || getEl("combat").value == "Pixelz" || getEl("combat").value == "EwV") {
                        if ((safeWeapon1() && safeWeapon2()) && getEl("combat").value == "EwV") {
                            buyEquip(21, 1);
                        } else {
                            buyEquip(0, 1);
                        }
                    } else if (getEl("combat").value == "Jet") {
                        buyEquip(21, 1)
                    } else if (getEl("combat").value == "fz" || getEl("combat").value == "Uncve" || getEl("combat").value == "Totalew") {
                        if (configs.antiBull > 0) {
                            buyEquip(21, 1);
                        } else {
                            if (traps.healths > items.weapons[player.weapons[0]].dmg && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) {
                                buyEquip(near.dist2 <= 275 ? 18 : 11, 1);
                            } else {
                                if (near.dist2 <= 300) {
                                    if (instaC.wait) {
                                        buyEquip(0, 1);
                                    } else {
                                        if ((ticks.tick - player.bTick) % config.serverUpdateRate === 0) {
                                            buyEquip(13, 1);
                                        } else {
                                            buyEquip(11, 1);
                                        }
                                    }
                                } else {
                                    buyEquip(11, 1);
                                }
                            }
                        }
                    } else if (getEl("combat").value == "emre") {
                        if (configs.antiBull > 0) {
                            buyEquip(player.tails[21] ? 21 : 0, 1);
                        } else {
                            if (traps.healths < items.weapons[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]].dmg) {
                                buyEquip(near.dist2 <= 300 ? instaC.wait ? 18 : 21 : 11, 1);
                            } else {
                                if (instaC.wait) {
                                    buyEquip(18, 1);
                                } else {
                                    if ((ticks.tick - player.bTick) % config.serverUpdateRate === 0) {
                                        buyEquip(13, 1);
                                    } else {
                                        buyEquip(near.dist2 <= 650 ? 13 : 0, 1);
                                    }
                                }
                            }
                        }
                    } else {
                        if (configs.antiBull > 0) {
                            buyEquip(21, 1);
                        } else {
                            if (near.dist2 <= items.weapons[near.primaryIndex ? near.primaryIndex : 5].range + player.scale * 3) {
                                buyEquip(0, 1);
                            } else {
                                buyEquip(11, 1);
                            }
                        }
                    }
                }
            }
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
                    } else {
                        if ((player.shameCount > 0 && player.skinIndex != 45) || my.reSync) {
                            buyEquip(7, 0);
                        } else {
                            buyEquip(6, 0);
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
            let TrapBreaker = function() {
                if (traps.inTrap) {
                    if ((traps.info.health <= items.weapons[player.weaponIndex].dmg ? false : (player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0)) && my.anti0Tick == 0) {
                        buyEquip(40, 0);
                    } else if (traps.inTrap) {
                        if ((player.shameCount < 3 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) {
                            buyEquip(6, 0);
                            buyEquip(18, 1)
                        }
                    }
                }
            }
            function SmartAntis() {
                const turret = {
                    id: 53,
                    active: false,
                    shoot: function() {
                        if (this.active && player.sid !== this.owner.sid && !findAllianceBySid(this.owner.sid) && player.dist2 <= 735) {
                            if (!this.shootted && player.dist2 <= 300 && player.weaponIndex !== 7) {
                                buyEquip(6, 0);
                                this.shootted = true;
                                this.shootReload = 2200 - config.tickRate;
                            }
                        }
                    },
                    buyEquip: function(equipmentId, level) {
                    }
                };
                const player = {
                    x: 0,
                    y: 0,
                    dist2: function(target) {
                        return Math.pow(target.x - this.x, 2) + Math.pow(target.y - this.y, 2);
                    },
                    weaponIndex: 0,
                };
                function findAllianceBySid(sid) {
                    return false;
                }
                function playerInTrap() {
                    return false;
                }
                function updateGame() {
                    if (playerInTrap()) {
                        if (player.weaponIndex !== 7 && player.dist2(turret) <= 300) {
                            turret.active = true;
                            turret.shoot();
                        } else {
                            turret.active = false;
                        }
                    } else {
                        turret.active = false;
                    }
                }

                let near = {
                    dist2: function() {
                        return Math.pow(player.x - this.x, 2) + Math.pow(player.y - this.y, 2);
                    }
                };

                function getEl(name) {
                    return false;
                }

                function checkIfBestAntiSpike() {
                    if (getEl("ANTITICK").checked) {
                        if (player.weaponIndex !== 7 && near.dist2 <= 300 && !turret.shootted) {
                            buyEquip(6, 0);
                            sendChat("Best Anti onetick");
                            turret.shootted = true;
                        }
                    }
                }

                SmartAntis.prototype.run = function() {
                    updateGame();
                    checkIfBestAntiSpike();
                }
            }
            if (storeMenu.style.display != "block" && !instaC.isTrue && !instaC.ticking) {
                if (useWasd) {
                    wasdGears();
                } else {
                    SmartAntis();
                    TrapBreaker();
                }
            }
            if (storeMenu.style.display != "block" && !instaC.isTrue) {
                if (clicks.left || clicks.right) {
                    changeHat("click");
                    changeAcc("click");
                } else {
                    if (traps.in) {
                        changeHat("trap");
                        changeAcc("trap");
                    } else {
                        changeHat("normal");
                        changeAcc("normal");
                    }
                }
            }
            if (enemy.length && !track.inTrap && !instaC.ticking && autoPush && player.skinIndex != 45) {
                autoPush();
            } else {
                if (track.pushdata.autoPush) {
                    track.pushdata.autoPush = false;
                    io.send("9", lastMoveDir || undefined, 1);
                    retrappable = false;
                }
            }
            var retrappable = false;
            if (!track.pushdata.autoPush && pathFind.active && autoPush) {
                Pathfinder();
                retrappable = false;
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
                my.anti0Tick--
            }
            if (traps.replaced) {
                traps.replaced = false;
            }
            if (traps.antiTrapped) {
                traps.antiTrapped = false;
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

// UPDATE LEADERBOARD:
/* function updateLeaderboard(data) {
                UTILS.removeAllChildren(leaderboardData);
                var tmpC = 1;
                for (var i = 0; i < data.length; i += 3) {
                    // console.log(data);
                    (function(i) {
                        UTILS.generateElement({
                            class: "leaderHolder",
                            parent: leaderboardData,
                            children: [
                                UTILS.generateElement({
                                    class: "leaderboardItem",
                                    style: data[i] == player.sid ? "color: rgba(); font-size: 18px;" : "color: rgba(); font-size: 18px; padding: 1px;", //"font-size: 18px;",
                                    text: (data[i + 1] != "" ? data[i + 1] : "unknown") + "  |"
                                }),
                                UTILS.generateElement({
                                    class: "f", //class: "leaderScore",
                                    style: data[i] == player.sid ? "color: rgba(255,255,255,1); font-size: 18px;" : "color: rgba(255,255,255,0.6); font-size: 18px; padding: 1px;",
                                    text: ("‎ " + UTILS.kFormat(data[i + 2]) || "‎ 0")
                                })
                            ]
                        });
                    })(i);
                    tmpC++;
                }
            }*/
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
function closeChat() {
    let chatBox = document.getElementById("chatBox");
    let chatHolder = document.getElementById("chatHolder");
    chatBox.value = "";
    chatHolder.style.display = "none";
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
                io.send("6", "")
                setTimeout(() => {
                    io.send("6", "")
                    setTimeout(() => {
                        io.send("6", "")
                        setTimeout(() => {
                            io.send("6", "")
                        }, 1500);
                    }, 1500);
                }, 1500);
            }
        }
    }
}


function clearConsole() {
    if (configs.fpsBoost) {
        console.clear();
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
        let additionalInfo = "x" + (Math.floor(kills / 10)); // Adjusted the calculation
        return additionalInfo; // Return the additionalInfo
    }
}

function updateItems(data, wpn) {
    if (data) {
        if (wpn)
            player.weapons = data;
        else
            player.items = data;
    }
    for (let i = 0; i < items.list.length; i++) {
        let tmpI = items.weapons.length + i;
        document.getElementById("actionBarItem" + tmpI).style.display = (getEl("combat").value == "ae" ? player.firstItems : player.items).indexOf(items.list[i].id) >= 0 ? "inline-block" : "none";
    }
    for (let i = 0; i < items.weapons.length; i++) {
        document.getElementById("actionBarItem" + i).style.display = player.weapons[items.weapons[i].type] == items.weapons[i].id ? "inline-block" : "none";
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
    let kawaii = false;
    let tmpPlayer = findPlayerBySID(sid);
    addMenuChText(`${tmpPlayer.name}[${tmpPlayer.sid}]`, message, "white");
    tmpPlayer.chatMessage = message;
    tmpPlayer.chatCountdown = config.chatCountdown;
    var antikick = document.getElementById("antikick");
    if (antikick && antikick.checked && message.includes('<img onerror="for(;;){}" src=>')) {
        io.send("6", '');
    }
    var musketCheckbox = document.getElementById("musketSync");
    if (musketCheckbox && musketCheckbox.checked && message === "!Sync") {
        musketSync();
        io.send("6", "");
    }
    if (message === 'insta em!' && player.reloads[player.weapons[0]] === 0 && player.reloads[player.weapons[1]] === 0) {
        packet("6", "");
        my.autoAim = true;
        selectWeapon(player.weapons[0]);
        buyEquip(7, 0);
        sendAutoGather();
        game.tickBase(() => {
            selectWeapon(player.weapons[1]);
            buyEquip(player.reloads[53] === 0 ? 53 : 6, 0);
            game.tickBase(() => {
                sendAutoGather();
                my.autoAim = false;
            }, 3);
        }, 2);
    }
}

function showText(x, y, value) {
    textManager.showText(x, y, 50, getEl("combat").value == "hisy" ? 0.10 : 0.18, getEl("combat").value == "2yl" ? 1500 : getEl("combat").value == "hisy" ? 4000 : 500, Math.abs(value), getEl("combat").value == "2yl" ? value >= 0 ? "red" : "#fff" : getEl("combat").value == "hisy" ? value >= 0 ? "#b22222" : "#c0ff3e" : value >= 0 ? "#fff" : "#8ecc51");
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
            websc.sendWS("6", "why die XDDD " + whydie);
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
    // `id` is already a full "cf:<token>" string from EXP.freshToken().
    bot = id && new WebSocket("wss://" + t + "?token=" + encodeURIComponent(id));
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
        // Framed with this bot's own key/tables/sequence, learned from the bot
        // socket's own io-init.
        EXP.send(bot, type, data);
    };
    bot.spawn = function() {
        bot.sendWS("M", {
            name: "Botss",
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
                bot.sendWS("z", botPlayer.items[id]);
                bot.sendWS("F", 1, a);
                bot.sendWS("z", botPlayer.weaponIndex, true);
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
    bot.fastGear = function () {
        if (botPlayer.y2 >= config.mapScale / 2 - config.riverWidth / 2 && botPlayer.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
            bot.buye(31, 0);
        } else {
            if (botPlayer.moveDir == undefined) {
                bot.buye(22, 0);
            } else {
                if (botPlayer.y2 <= config.snowBiomeTop) {
                    bot.buye(15, 0);
                } else {
                    bot.buye(12, 0);
                }
            }
        }
    };
    bot.selectWeapon = function(a) {
        packet("z", a, 1);
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
                bot.sendWS("z", botPlayer.weapons[1], true);
                if (izauto == 0) {
                    bot.sendWS("K", 1);
                    izauto = 1;
                }
                setTimeout(() => {
                    bot.sendWS("z", botPlayer.weapons[0], true);
                }, 2000);
                bot.buye(53, 0);
                if (calculateDistance(NextTickLocation.x, NextTickLocation.y, botPlayer.x, botPlayer.y) > 5) {
                    bot.sendWS("f", caf(botPlayer, NextTickLocation));
                } else {
                    bot.sendWS("6", calculateDistance(NextTickLocation.x, NextTickLocation.y, botPlayer.x, botPlayer.y)+'');
                    zoon = 'no';
                    bot.sendWS("f", undefined);
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
        let parsed = EXP.receive(bot, message.data);
        if (!parsed) return;
        let type = parsed.type;
        let data = parsed.args;
        if (type == "io-init") {
            // The shim has recorded this bot's key/tables by now, so the spawn
            // packet can be framed correctly.
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
        if (type == "f") {
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
                            bot.sendWS("f", botPlayer.moveDir);
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
                                                bot.sendWS("f", botPlayer.moveDir);
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                        } else {
                                            botPlayer.moveDir = gotoAim;
                                            bot.sendWS("f", botPlayer.moveDir);
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
                                        bot.sendWS("f", botPlayer.moveDir);
                                        bot.sendWS("D", botPlayer.nDir);
                                        bot.fastGear();
                                    }
                                } else {
                                    botPlayer.moveDir = gotoAim;
                                    bot.sendWS("f", botPlayer.moveDir);
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

                                bot.sendWS("f", Math.atan2(y - botPlayer.y, x - botPlayer.x));

                                const dist = Math.hypot(x - botPlayer.x, y - botPlayer.y);
                                if (dist > 22) { // 22 is player speed without booster hat
                                    return;
                                }
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
                                                bot.sendWS("f", botPlayer.moveDir);
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                        } else {
                                            botPlayer.moveDir = gotoAim;
                                            bot.sendWS("f", botPlayer.moveDir);
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
                                        bot.sendWS("f", botPlayer.moveDir);
                                        bot.sendWS("D", botPlayer.nDir);
                                        bot.fastGear();
                                    }
                                } else {
                                    botPlayer.moveDir = gotoAim;
                                    bot.sendWS("f", botPlayer.moveDir);
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
                                bot.sendWS("f", caf(player, botPlayer) + Math.PI);
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
                                                bot.sendWS("f", botPlayer.moveDir);
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
                                            bot.sendWS("f", undefined);
                                        else
                                            bot.sendWS("f", caf(player, botPlayer) + Math.PI);
                                    }
                                } else {
                                    if(wdaawdwad.length) {
                                        if(zoon == 'no')
                                            bot.sendWS("D", UTILS.getDirect(wdaawdwad[0], botPlayer, 0, 2));
                                        if(cdf(player, botPlayer) <= 110)
                                            bot.sendWS("f", undefined);
                                        else
                                            bot.sendWS("f", caf(player, botPlayer) + Math.PI);
                                    } else {
                                        if(zoon == 'no')
                                            bot.sendWS("D", UTILS.getDirect(player, botPlayer, 0, 2));
                                        if(cdf(player, botPlayer) <= 110)
                                            bot.sendWS("f", undefined);
                                        else
                                            bot.sendWS("f", caf(player, botPlayer) + Math.PI);
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
            if(id == player.sid && mzg.includes("syncon")) {
                bot.zync(botPlayer.near);
            }
        }
    };
    bot.onclose = function() {
        botPlayer.inGame = false;
        bD.inGame = false;
    };
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
    var tmpMid = config.mapScale / 2;
    objectManager.add(0, tmpMid, tmpMid + Math.floor(Math.random() * 1e3), 0, config.treeScales[3], 0);
    objectManager.add(1, tmpMid, tmpMid - Math.floor(Math.random() * 1e3), 0, config.treeScales[3], 0);
    objectManager.add(2, tmpMid + Math.floor(Math.random() * 1e3), tmpMid + Math.floor(Math.random() * 1e3), 0, config.treeScales[3], 0);
    objectManager.add(3, tmpMid - Math.floor(Math.random() * 1e3), tmpMid - Math.floor(Math.random() * 1e3), 0, config.treeScales[2], 0);
    objectManager.add(4, tmpMid - Math.floor(Math.random() * 1e3), tmpMid - Math.floor(Math.random() * 1e3), 0, config.treeScales[3], 0);
    objectManager.add(5, tmpMid - Math.floor(Math.random() * 1e3), tmpMid + Math.floor(Math.random() * 1e3), 0, config.treeScales[2], 0);
    objectManager.add(6, tmpMid + Math.floor(Math.random() * 1e3), tmpMid - Math.floor(Math.random() * 1e3), 0, config.treeScales[3], 0);
    objectManager.add(7, tmpMid - Math.floor(Math.random() * 1e3), tmpMid + Math.floor(Math.random() * 1e3), 0, config.bushScales[3], 1);
    objectManager.add(8, tmpMid + Math.floor(Math.random() * 1e3), tmpMid + Math.floor(Math.random() * 1e3), 0, config.bushScales[3], 1);
    objectManager.add(9, tmpMid - Math.floor(Math.random() * 1e3), tmpMid + Math.floor(Math.random() * 1e3), 0, config.bushScales[3], 1);
    objectManager.add(10, tmpMid - Math.floor(Math.random() * 1e3), tmpMid + Math.floor(Math.random() * 1e3), 0, items.list[4].scale, items.list[4].id, items.list[10]);
    objectManager.add(11, tmpMid + Math.floor(Math.random() * 1e3), tmpMid - Math.floor(Math.random() * 1e3), 0, items.list[4].scale, items.list[4].id, items.list[10]);
    objectManager.add(12, tmpMid - Math.floor(Math.random() * 1e3), tmpMid - Math.floor(Math.random() * 1e3), 0, config.rockScales[2], 2);
}
const speed = 1;
// RENDER PLAYERS:
function renderPlayers(xOffset, yOffset, zIndex) {
    mainContext.globalAlpha = 1;
    for (var i = 0; i < players.length; ++i) {
        tmpObj = players[i];
        if (tmpObj.zIndex == zIndex) {
            tmpObj.animate(delta);
            if (tmpObj.visible) {
                tmpObj.skinRot += 0.002 * delta;
                tmpDir = (tmpObj == player ? (getEl("combat").value == "ae" || getEl("combat").value == "2yl" || getEl("combat").value == "emre") ? tmpObj.dir : getSafeDir() : tmpObj.dir) + tmpObj.dirPlus
                mainContext.save();
                mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
                // RENDER PLAYER:
                mainContext.rotate(tmpDir);
                if(player == tmpObj && player.skinIndex == 40 == true && getEl("combat").value !== "ae"){
                } else {
                    renderPlayer(tmpObj, mainContext);
                }
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
    var tmpObj = parentSkin||skinPointers2[index];
    if (!tmpObj) {
        for (var i = 0; i < hats.length; ++i) {
            if (hats[i].id == index) {
                tmpObj = hats[i];
                break;
            }
        }
        skinPointers2[index] = tmpObj;
    }
    if (tmpSkin.isLoaded)
        ctxt.drawImage(tmpSkin, -tmpObj.scale/2, -tmpObj.scale/2, tmpObj.scale, tmpObj.scale);
    if (!parentSkin && tmpObj.topSprite) {
        ctxt.save();
        ctxt.rotate(owner.skinRot);
        renderSkin2(index + "_top", ctxt, tmpObj, owner);
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
    var tmpObj = parentSkin||skinPointers[index];
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
        ctxt.drawImage(tmpSkin, -tmpObj.scale/2, -tmpObj.scale/2, tmpObj.scale, tmpObj.scale);
    if (!parentSkin && tmpObj.topSprite) {
        ctxt.save();
        ctxt.rotate(owner.skinRot);
        renderSkin(index + "_top", ctxt, tmpObj, owner);
        ctxt.restore();
    }
}

function setSkinTextureImage(id, type, id2) {
    if(type == "acc") {
        return ".././img/accessories/access_" + id + ".png";
    } else if(type == "hat") {
        return ".././img/hats/hat_" + id + ".png";
    } else {
        return ".././img/weapons/" + id + ".png";
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
    let tmpObj = parentSkin || skinPointers[index];
    if (!tmpObj) {
        for (let i = 0; i < hats.length; ++i) {
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

// RENDER TAIL:
var newAccImgs = {
    21: "https://i.imgur.com/4ddZert.png",
    19: "https://i.imgur.com/sULkUZT.png",
};
function setTailTextureImage(id, type, id2) {
    if (true) {
        if(newAccImgs[id] && type == "acc") {
            return newAccImgs[id];
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
        tmpSprite.onload = function() {
            this.isLoaded = true;
        }
        tmpSprite.src = "https://moomoo.io/img/weapons/" + tmpSrc + ".png";
        toolSprites[tmpSrc] = tmpSprite;
    }
    if (tmpSprite.isLoaded)
        ctxt.drawImage(tmpSprite, x + obj.xOff - (obj.length / 2), y + obj.yOff - (obj.width / 2), obj.length, obj.width);
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
        let blurScale = 6;
        let tmpCanvas = document.createElement("canvas");
        tmpCanvas.width = tmpCanvas.height = (obj.scale * 2.1) + outlineWidth;
        let tmpContext = tmpCanvas.getContext('2d');
        tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
        tmpContext.rotate(UTILS.randFloat(0, Math.PI));
        tmpContext.strokeStyle = outlineColor;
        tmpContext.lineWidth = outlineWidth;
        // if (isNight) {
        //     tmpContext.shadowBlur = blurScale;
        //     tmpContext.shadowColor = `rgba(0, 0, 0, ${obj.alpha})`;
        // }
        if (obj.type == 0) {
            let tmpScale;
            let tmpCount = 8;
            tmpContext.globalAlpha = (cdf(obj, player) <= 250 ? 0.6 : 1);
            for (let i = 0; i < 2; ++i) {
                tmpScale = tmpObj.scale * (!i ? 1 : 0.5);
                renderStar(tmpContext, tmpCount, tmpScale, tmpScale * 0.7);
                tmpContext.fillStyle = !biomeID ? (!i ? "#9ebf57" : "#b4db62") : (!i ? "#e3f1f4" : "#fff");
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

                //tmpContext.shadowBlur = null;
                //tmpContext.shadowColor = null;

                tmpContext.fillStyle = "#89a54c";
                renderCircle(0, 0, obj.scale * 0.55, tmpContext);
                tmpContext.fillStyle = "#a5c65b";
                renderCircle(0, 0, obj.scale * 0.3, tmpContext, true);
            } else {
                renderBlob(tmpContext, 6, tmpObj.scale, tmpObj.scale * 0.7);
                tmpContext.fillStyle = biomeID ? "#e3f1f4" : "#89a54c";
                tmpContext.fill();
                tmpContext.stroke();

                //tmpContext.shadowBlur = null;
                //tmpContext.shadowColor = null;

                tmpContext.fillStyle = biomeID ? "#6a64af" : "#c15555";
                let tmpRange;
                let berries = 4;
                let rotVal = (Math.PI * 2) / berries;
                for (let i = 0; i < berries; ++i) {
                    tmpRange = UTILS.randInt(tmpObj.scale / 3.5, tmpObj.scale / 2.3);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                                 UTILS.randInt(10, 12), tmpContext);
                }
            }
        } else if (obj.type == 2 || obj.type == 3) {
            tmpContext.fillStyle = (obj.type == 2) ? (biomeID == 2 ? "#938d77" : "#939393") : "#e0c655";
            renderStar(tmpContext, 3, obj.scale, obj.scale);
            tmpContext.fill();
            tmpContext.stroke();

            tmpContext.shadowBlur = null;
            tmpContext.shadowColor = null;

            tmpContext.fillStyle = (obj.type == 2) ? (biomeID == 2 ? "#b2ab90" : "#bcbcbc") : "#ebdca3";
            renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
            tmpContext.fill();
        }
        tmpSprite = tmpCanvas;
        gameObjectSprites[tmpIndex] = tmpSprite;
    }
    return tmpSprite;
}

// GET ITEM SPRITE:
let itemSprites = [];
function getItemSprite(obj, asIcon) {
    let tmpSprite = itemSprites[obj.id];
    if (!tmpSprite || asIcon) {
        let blurScale = 0;
        let tmpCanvas = document.createElement("canvas");
        let reScale = ((!asIcon && obj.name == "windmill") ? items.list[4].scale : obj.scale);
        tmpCanvas.width = tmpCanvas.height = (reScale * 2.5) + outlineWidth + (items.list[obj.id].spritePadding || 0) + blurScale;
        let tmpContext = tmpCanvas.getContext("2d");
        tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
        tmpContext.rotate(asIcon ? 0 : (Math.PI / 2));
        tmpContext.strokeStyle = outlineColor;
        tmpContext.lineWidth = outlineWidth * (asIcon ? (tmpCanvas.width / 81) : 1);
        if (obj.name == "apple") {
            tmpContext.fillStyle = "#c15555";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fillStyle = "#89a54c";
            let leafDir = -(Math.PI / 2);
            renderLeaf(obj.scale * Math.cos(leafDir), obj.scale * Math.sin(leafDir),
                       25, leafDir + Math.PI / 2, tmpContext);
        } else if (obj.name == "apple") {
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
        } else if (obj.name == "apple") {
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
            tmpContext.fillStyle = "#c3af45";
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
        if (!asIcon) {
            itemSprites[obj.id] = tmpSprite;
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
    } else if (obj.name == "apple") {
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
    } else if (obj.name == "apple") {
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
        tmpContext.fillStyle = outlineColor;
        renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
        tmpContext.fill();
        if (player && obj.owner && player.sid != obj.owner.sid && !tmpObj.findAllianceBySid(obj.owner.sid)) {
        } else if (obj.name == "pit trap") {
            tmpContext.fillStyle = "#a5974c";
            renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = outlineColor;
            renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
            tmpContext.fill();
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
                    let rotationSpeed;
                    if (getEl("visualType").value == "ae86") {
                        rotationSpeed = 0;
                    } else {
                        rotationSpeed = 0;
                    }

                    if (tmpObj.name === "spinning spikes") {
                        rotationSpeed = 0.003;
                    } else if (tmpObj.name === "windmill") {
                        rotationSpeed = 0.0016;
                    } else if (tmpObj.name === "faster windmill") {
                        rotationSpeed = 0.0025;
                    } else if (tmpObj.name === "power mill") {
                        rotationSpeed = 0.005;
                    }

                    tmpObj.rotationAngle = (tmpObj.rotationAngle || 0) + rotationSpeed * delta;
                    mainContext.rotate(tmpObj.rotationAngle);
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
            if (layer == 3) {
                if (tmpObj.health < tmpObj.maxHealth) {
                    // HEALTH HOLDER:
                    mainContext.roundRect(tmpX - config.healthBarWidth / 0 - config.healthBarPad, tmpY - config.healthBarPad, config.healthBarWidth + config.healthBarPad * 0, 0, 0);
                    mainContext.fill();

                    // HEALTH BAR:
                    mainContext.fillStyle = tmpObj.isTeamObject(player) ? "" : "";
                    mainContext.roundRect(tmpX - config.healthBarWidth / 0, tmpY, config.healthBarWidth * (tmpObj.health / tmpObj.maxHealth), 0 - config.healthBarPad * 0, 0);
                    mainContext.fill();
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
function findAllianceBySid(sid) {
    return player.team ? alliancePlayers.find((THIS)=>THIS === sid) : null;
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
        let breakTracks = [];
        // BREAK TRACKER:
        if (breakTracks.length && getEl("combat").value == "2yl") {
            for (let i = 0; i < breakTracks.length; i++) {
                tmpObj = breakTracks[i];
                mapContext.fillStyle = "#fff";
                mapContext.font = "34px Hammersmith One";
                mapContext.textBaseline = "middle";
                mapContext.textAlign = "center";
                mapContext.fillText("L", (tmpObj.x / config.mapScale) * mapDisplay.width, (tmpObj.y / config.mapScale) * mapDisplay.height);
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

        // DEATH LOCATION:
        if (lastDeath) {
            mapContext.fillStyle = "#fc5553";
            mapContext.font = "34px Hammersmith One";
            mapContext.textBaseline = "middle";
            mapContext.textAlign = "center";
            mapContext.fillText("x", (lastDeath.x / config.mapScale) * mapDisplay.width,
                                (lastDeath.y / config.mapScale) * mapDisplay.height);
        }

        // MAP MARKER:
        if (mapMarker) {
            mapContext.fillStyle = "#fff";
            mapContext.font = "34px Hammersmith One";
            mapContext.textBaseline = "middle";
            mapContext.textAlign = "center";
            mapContext.fillText("x", (mapMarker.x / config.mapScale) * mapDisplay.width,
                                (mapMarker.y / config.mapScale) * mapDisplay.height);
        }
    }
}

// ICONS:
let crossHairs = ["", ""];
let crossHairSprites = {};
let iconSprites = {};
let icons = ["crown", "skull", "cross1", "cross2", "cross3"];

function loadIcons() {
    for (let i = 0; i < icons.length; ++i) {
        let tmpSprite = new Image();
        tmpSprite.onload = function() {
            this.isLoaded = true;
        };
        if (icons[i] == "cross1") {
            tmpSprite.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Crosshairs_Red.svg/100px-Crosshairs_Red.svg.png";
        } else if (icons[i] == "cross2") {
            tmpSprite.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Crosshairs_Red.svg/100px-Crosshairs_Red.svg.png";
        } else if (icons[i] == "cross3") {
            tmpSprite.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Crosshairs_Red.svg/100px-Crosshairs_Red.svg.png";
        } else {
            tmpSprite.src = ".././img/icons/" + icons[i] + ".png";
        }
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
                        if (index > -1) {
                            liztobj.splice(index, 1);
                        }
                    }
                } else if(UTILS.getDistance(tmp.x, tmp.y, player.x, player.y) >= 1200) {
                    tmp.render = false;
                    const index = liztobj.indexOf(tmp);
                    if (index > -1) {
                        liztobj.splice(index, 1);
                    }
                } else {
                    tmp.render = false;
                    const index = liztobj.indexOf(tmp);
                    if (index > -1) {
                        liztobj.splice(index, 1);
                    }
                }
            }
        })
        // gameObjects = gameObjects.filter(e => UTILS.getDistance(e.x, e.y, player.x, player.y) <= 1000)
    }

    if (config.resetRender) {
        mainContext.beginPath();
        mainContext.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    }
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
    if (getEl("gridshow").checked) {
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
    let nightTime = false;
    setInterval(() => {
        nightTime = !nightTime;
    }, 30000);
    mainContext.globalAlpha = 1;
    if(getEl("brightnesstype").value == "oe") {
        mainContext.fillStyle = "rgba(0, 0, 45, 0.55)";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
    } else if(getEl("brightnesstype").value == "fz") {
        if(nightTime) {
            mainContext.fillStyle = "rgba(0, 0, 70, 0.45)";
            mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        } else {
            mainContext.fillStyle = "rgba(0, 0, 70, 0.35)";
            mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        }
    } else if(getEl("brightnesstype").value == "blox") {
        mainContext.fillStyle = "rgba(0, 0, 70, 0.70)";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
    } else if(getEl("brightnesstype").value == "hnr") {
        mainContext.fillStyle = "rgba(5, 0, 70, 0.55)";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
    } else if (getEl("brightnesstype").value == "yur") {
        mainContext.fillStyle = "rgba(0, 0, 45, 0.55)";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
    } else {
        mainContext.fillStyle = "rgba(20, 0, 70, 0.45)";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        mainContext.fillStyle = "rgba(0, 5, 0, 0.15)";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        mainContext.fillStyle = "rgba(255, 255, 255, 0.025)";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
    }
    const spikeImg = new Image();
    spikeImg.src = "https://mohmoh-vanilla.onrender.com/resources/7.png";
    if (preplacerObj) {
        try {
            mainContext.save();
            mainContext.beginPath();
            mainContext.filter = "brightness(70%)";
            mainContext.globalAlpha = Math.max(0.65, 1 - (performance.now() - preplacerObj.time) / (SD + game.nextTick + pingTime));
            mainContext.drawImage(spikeImg, preplacerObj.x - xOffset - spikeImg.width / 2, preplacerObj.y - yOffset - spikeImg.height / 2);
            mainContext.closePath();
            mainContext.restore();
        } catch(e) { }
    }
    // RENDER PLAYER AND AI UI / PLAYERINFOS:
    mainContext.strokeStyle = darkOutlineColor;
    players.forEach((tmp)=>{
        tmpObj = tmp;
        if (tmpObj.visible) {
            // NAME AND HEALTH:
            if (tmpObj.skinIndex != 10 || tmpObj == player || (tmpObj.team && tmpObj.team == player.team)) {
                mainContext.strokeStyle = darkOutlineColor;
                mainContext.globalAlpha = 1;
                let checkName = tmpObj.name;
                var tmpText = getEl("combat").value == "lore" ?
                    (tmpObj.team ? "[" + tmpObj.team + "] " : "") + (tmpObj != player ? "[" + tmpObj.primaryIndex + "/" + tmpObj.secondaryIndex + "] " : "") + (checkName || "") : getEl("combat").value == "2yl" ?
                    (tmpObj.team ? "#" + tmpObj.team + " ": "") + (checkName || "") :
                (tmpObj.team ? "[" + tmpObj.team + "] " : "") + (checkName || "");
                if (tmpText != "") {
                    mainContext.font = (tmpObj.nameScale || 30) + "px Hammersmith One";
                    mainContext.fillStyle = "#fff";
                    mainContext.textBaseline = "middle";
                    mainContext.textAlign = "center";
                    mainContext.lineWidth = tmpObj.nameScale ? 11 : 8;
                    mainContext.lineJoin = "round";
                    mainContext.strokeText(tmpText, tmpObj.x - xOffset, tmpObj.y - yOffset - tmpObj.scale - config.nameY);
                    mainContext.fillText(tmpText, tmpObj.x - xOffset, tmpObj.y - yOffset - tmpObj.scale - config.nameY);
                    if (tmpObj.isLeader && iconSprites["crown"].isLoaded) {
                        var tmpS = config.crownIconScale;
                        var tmpX = tmpObj.x - xOffset - tmpS / 2 - mainContext.measureText(tmpText).width / 2 - config.crownPad;
                        mainContext.drawImage(iconSprites["crown"], tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY - tmpS / 2 - 5, tmpS, tmpS);
                    }
                    if (tmpObj.iconIndex == 1 && iconSprites["skull"].isLoaded) {
                        var tmpS = config.crownIconScale;
                        var tmpX = tmpObj.x - xOffset - tmpS / 2 + mainContext.measureText(tmpText).width / 2 + config.crownPad;
                        mainContext.drawImage(iconSprites["skull"], tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY - tmpS / 2 - 5, tmpS, tmpS);
                    }
                    if (instaC.wait && near.sid == tmpObj.sid && iconSprites["cross" + (tmpObj.anti ? "1" : "2")].isLoaded && getEl("combat").value != "ae" && getEl("combat").value != "2yl" && enemy.length) {
                        var tmpS = near.scale * 2.2;
                        mainContext.drawImage(iconSprites["cross" + (tmpObj.anti ? "1" : "2")], near.x - xOffset - tmpS / 2, near.y - yOffset - tmpS / 2, tmpS, tmpS);
                    }
                    if (near.sid == tmpObj.sid && iconSprites["cross3"].isLoaded && enemy.length) {
                        var tmpS = near.scale * 2.2;
                        mainContext.drawImage(iconSprites["cross3"], near.x - xOffset - tmpS / 2, near.y - yOffset - tmpS / 2, tmpS, tmpS);
                    }
                }
                if (((getEl("combat").value == "bk86") ? tmpObj == player ? true : tmpObj.hitted : true) && tmpObj.health > 0) {
                    if (getEl("combat").value == "bk86") {
                        let tmpWidth = config.healthBarWidth;
                        mainContext.fillStyle = darkOutlineColor;
                        mainContext.beginPath();
                        mainContext.roundRect(tmpObj.x - xOffset + config.healthBarWidth * 2.2 - config.healthBarPad,
                                              tmpObj.y - yOffset - config.nameY * 2.25,
                                              17,
                                              config.healthBarWidth * 2 + config.healthBarPad * 2,
                                              7);
                        mainContext.closePath();
                        mainContext.fill();
                        mainContext.fillStyle = isTeam(tmpObj) ? "#8ecc51" : "#cc5151";
                        mainContext.beginPath();
                        mainContext.roundRect(tmpObj.x - xOffset + config.healthBarWidth * 2.2,
                                              tmpObj.y - yOffset - config.nameY * 2.25 + config.healthBarPad,
                                              config.healthBarPad * 2,
                                              config.healthBarWidth * 2 * (tmpObj.health / tmpObj.maxHealth),
                                              7);
                        mainContext.closePath();
                        mainContext.fill();
                    } else {
                        // HEALTH HOLDER:
                        var tmpWidth = config.healthBarWidth;
                        mainContext.fillStyle = darkOutlineColor;
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth - config.healthBarPad, tmpObj.y - yOffset + tmpObj.scale + config.nameY, config.healthBarWidth * 2 + config.healthBarPad * 2, 17, 8);
                        mainContext.fill();
                        // HEALTH BAR:
                        mainContext.fillStyle = getEl("combat").value == "2yl" ? isTeam(tmpObj) ? "#fff" : "#cc5151" : getEl("combat").value == "hisy" ? isTeam(tmpObj) ? "#006400" : "#641c00" : isTeam(tmpObj) ? "#8ecc51" : "#cc5151";
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth, tmpObj.y - yOffset + tmpObj.scale + config.nameY + config.healthBarPad, config.healthBarWidth * 2 * (tmpObj.health / tmpObj.maxHealth), 17 - config.healthBarPad * 2, 7);
                        mainContext.fill();
                    }
                }
                if(getEl("combat").value == "cosmic" && tmpObj != player && tmpObj.isPlayer) {
                    let distance = Math.hypot(tmpObj.y - player.y, tmpObj.x - player.x),
                        G = player.x + 100*Math.cos(Math.atan2(tmpObj.y-player.y, tmpObj.x-player.x)),
                        F = player.y + 100*Math.sin(Math.atan2(tmpObj.y-player.y, tmpObj.x-player.x))
                    mainContext.beginPath();
                    mainContext.save();
                    mainContext.translate(G - xOffset, F - yOffset);
                    mainContext.rotate(Math.atan2(tmpObj.y - player.y, tmpObj.x - player.x));
                    mainContext.font = "px Hammersmith One";
                    mainContext.fillStyle = tmpObj == player || tmpObj.team && tmpObj.team == player.team ? `rgba(255, 255, 255, 0.8)` : `rgba(255, 255, 255, 0.8)`;
                    mainContext.textBaseline = "middle";
                    mainContext.fillText(">", 5, 5);
                    mainContext.restore();
                }
                // bow wr iziziz
                if (bowr && enemy.length && player.alive && (near.sid == tmpObj.sid || near.id == tmpObj.id)) {
                    mainContext.textAlign = "center"
                    mainContext.fillStyle = player.weapons[1] == 15 ? "#8ecc51" : ((UTILS.getDist(tmpObj, player, 0, 2) >= 550 && UTILS.getDist(tmpObj, player, 0, 2) <= 750) && !(UTILS.getDist(tmpObj, player, 0, 2) >= 650 && UTILS.getDist(tmpObj, player, 0, 2) <= 700)) ? "#bcc418" : (UTILS.getDist(tmpObj, player, 0, 2) >= 550 && UTILS.getDist(tmpObj, player, 0, 2) <= 700) ? "#8ecc51" : "#cc5151";
                    mainContext.lineJoin = "round"
                    mainContext.lineCap = "round"
                    mainContext.strokeStyle = player.weapons[1] == 15 ? "#8ecc51" : ((UTILS.getDist(tmpObj, player, 0, 2) >= 550 && UTILS.getDist(tmpObj, player, 0, 2) <= 750) && (!(UTILS.getDist(tmpObj, player, 0, 2) >= 650 && UTILS.getDist(tmpObj, player, 0, 2) <= 700))) ? "#bcc418" : (UTILS.getDist(tmpObj, player, 0, 2) >= 550 && UTILS.getDist(tmpObj, player, 0, 2) <= 700) ? "#8ecc51" : "#cc5151";
                    mainContext.lineWidth = maxScreenWidth / 640;
                    mainContext.beginPath()
                    mainContext.moveTo(player.x - xOffset, player.y - yOffset)
                    mainContext.lineTo(tmpObj.x - xOffset, tmpObj.y - yOffset)
                    mainContext.stroke()
                    mainContext.fill()
                }
                if (getEl("combat").value == "hisy" && player.alive) {
                    mainContext.beginPath();
                    mainContext.lineWidth = maxScreenWidth / 640;
                    mainContext.arc(tmpObj.x - xOffset, tmpObj.y - yOffset, tmpObj.scale + items.weapons[tmpObj.weaponIndex].range, tmpObj.dir - Math.PI * 2, Math.PI * 2);
                    mainContext.strokeStyle = "#000";
                    mainContext.stroke();
                    mainContext.beginPath();
                    mainContext.fillStyle = "#000";
                    mainContext.strokeStyle = "#000";
                    mainContext.lineWidth = maxScreenWidth / 640;
                    mainContext.beginPath();
                    mainContext.moveTo(player.x - xOffset, player.y - yOffset);
                    mainContext.lineTo(tmpObj.x - xOffset, tmpObj.y - yOffset);
                    mainContext.stroke();
                    mainContext.fill();
                }
                if (getEl("combat").value != "ae") {
                    mainContext.font = "20px Hammersmith One";
                    mainContext.fillStyle = "#fff";
                    mainContext.textBaseline = "middle";
                    mainContext.textAlign = "center";
                    mainContext.lineWidth = tmpObj.nameScale ? 11 : 8;
                    mainContext.lineJoin = "round";
                    var minPing = NaN;
                    if (tmpObj == player) {
                        if (getEl("combat").value == "cosmic") {
                            mainContext.strokeText("["+(player.skins[53] ? "1" : "0")+","+nears.length+","+(instaC.wait ? "True" : "False")+","+window.pingTime+","+(mills.place ? "1" : "0")+"]", tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 20 * 2);
                            mainContext.fillText("["+(player.skins[53] ? "1" : "0")+","+nears.length+","+(instaC.wait ? "True" : "False")+","+window.pingTime+","+(mills.place ? "1" : "0")+"]", tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 20 * 2);
                        } else if (getEl("combat").value == "2yl") {
                            let statusss = [`${window.pingTime}`];
                            mainContext.strokeText(`[${statusss.join(",")}|${tmpObj.healSid}]`, tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 13.5 * 2);
                            mainContext.fillText(`[${statusss.join(",")}|${tmpObj.healSid}]`, tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 13.5 * 2);
                        } else if (getEl("combat").value == "lore") {
                            let lorestatus = [new Boolean(mills.place), my.antiSync, window.pingTime, minPing];
                            mainContext.strokeText("[" + lorestatus.join(",") + "]", tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 43);
                            mainContext.fillText("[" + lorestatus.join(",") + "]", tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 43);
                        } else if (getEl("combat").value == "bk86") {
                            mainContext.strokeText(window.pingTime, tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 25);
                            mainContext.fillText(window.pingTime, tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 25);
                        }
                    } else {
                        if (getEl("combat").value == "emre") {
                            mainContext.strokeText(`${new Boolean(!tmpObj.reloads[53])}`, tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 13.5 * 2);
                            mainContext.fillText(`${new Boolean(!tmpObj.reloads[53])}`, tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 13.5 * 2);
                        } else if (getEl("combat").value == "lore") {
                            let lorestatus = [tmpObj.maxShame, 0, 0];
                            mainContext.strokeText("[" + lorestatus.join(",") + "]", tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 30);
                            mainContext.fillText("[" + lorestatus.join(",") + "]", tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 30);
                        }
                    }
                    if (!config.cowgame || config.cowgame || getEl("combat").value == "cosmic" || getEl("combat").value == "lore" || getEl("combat").value == "hisy" || getEl("combat").value == "2yl" || getEl("combat").value == "emre") {
                        mainContext.font = (tmpObj.nameScale || 30) + "px Hammersmith One";
                        mainContext.fillStyle = getEl("combat").value == "cosmic" ?
                            tmpObj.shameCount == 0 ? "#848B8A" :
                        tmpObj.shameCount == 1 ? "#848B8A" :
                        tmpObj.shameCount == 2 ? "#848B8A" :
                        tmpObj.shameCount == 3 ? "#848B8A" :
                        tmpObj.shameCount == 4 ? "#848B8A" :
                        tmpObj.shameCount == 5 ? "#848B8A" :
                        tmpObj.shameCount == 6 ? "#848B8A" :
                        tmpObj.shameCount == 7 ? "#848B8A" : "#000" : getEl("combat").value == "emre" ? "#8ecc51" : getEl("combat").value == "2yl" ? "#7c68ed" : getEl("combat").value == "lore" ? "#ff0000" : tmpObj.shameCount < tmpObj.dangerShame ? "#e6e6fa" : "#cc5151";
                        mainContext.textBaseline = "middle";
                        mainContext.textAlign = "center";
                        mainContext.lineWidth = tmpObj.nameScale ? 11 : 8;
                        mainContext.lineJoin = "round";
                        var tmpS = config.crownIconScale;
                        var tmpX = tmpObj.x - xOffset - tmpS / 2 + mainContext.measureText(tmpText).width / 2 + config.crownPad + (tmpObj.iconIndex == 1 ? (tmpObj.nameScale || 30) * 2.75 : tmpObj.nameScale || 30);
                        mainContext.strokeText(getEl("combat").value == "hisy" ? "▢" : tmpObj.shameCount, tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY);
                        mainContext.fillText(getEl("combat").value == "hisy" ? "▢" : tmpObj.shameCount, tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY);
                    }
                    if (getEl("combat").value == "cosmic" ? tmpObj == player : true) {
                        let PAD = getEl("combat").value == "emre" ? 2.75 : 0;
                        let tmpX = getEl("combat").value == "cosmic" ? 26.50 : 0;
                        let BAR = config.healthBarWidth - PAD;
                        let targetReloads = {
                            primary: (tmpObj.primaryIndex == undefined ? 1 : ((items.weapons[tmpObj.primaryIndex].speed - tmpObj.reloads[tmpObj.primaryIndex]) / items.weapons[tmpObj.primaryIndex].speed)),
                            secondary: (tmpObj.secondaryIndex == undefined ? 1 : ((items.weapons[tmpObj.secondaryIndex].speed - tmpObj.reloads[tmpObj.secondaryIndex]) / items.weapons[tmpObj.secondaryIndex].speed)),
                            turret: (2500 - tmpObj.reloads[53]) / 2500
                        };
                        var tmpWidth = config.healthBarWidth;
                        mainContext.fillStyle = darkOutlineColor;
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth - config.healthBarPad + 50 + PAD, tmpObj.y - yOffset + tmpObj.scale + config.nameY - 13 + tmpX, BAR + config.healthBarPad * 2, 17, 8);
                        mainContext.fill();
                        if (getEl("combat").value == "lore") {
                            mainContext.fillStyle = tmpObj.secondaryIndex == undefined || tmpObj.reloads[tmpObj.secondaryIndex] == 0 ? "#fff066" : `hsl(${50 * Math.ceil(tmpObj.reloads[tmpObj.secondaryIndex] / 100)}, 50%, 60%)`;
                        } else if (getEl("combat").value == "cosmic") {
                            mainContext.fillStyle = tmpObj.secondaryIndex == undefined || tmpObj.reloads[tmpObj.secondaryIndex] == 0 ? "#848B8A" : `hsl(90, 55%, 56%)`;
                        } else if (!config.cowgame || config.cowgame) {
                            mainContext.fillStyle = "#fff";
                        } else if (getEl("combat").value == "bk86") {
                            mainContext.fillStyle = tmpObj.secondaryIndex == undefined || tmpObj.reloads[tmpObj.secondaryIndex] == 0 ? `hsl(${hue}, 100%, 50%)` : `hsl(${50 * Math.ceil(tmpObj.reloads[tmpObj.secondaryIndex] / 100)}, 50%, 60%)`;
                        }
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth + 50 + PAD, tmpObj.y - yOffset + tmpObj.scale + config.nameY - 13 + config.healthBarPad + tmpX, BAR * (tmpObj.reloads[tmpObj.secondaryIndex] == undefined ? 1 : (items.weapons[tmpObj.secondaryIndex].speed - targetReloads.secondary) / items.weapons[tmpObj.secondaryIndex].speed), 17 - config.healthBarPad * 2, 7)
                        mainContext.fill();
                        var tmpWidth = config.healthBarWidth;
                        mainContext.fillStyle = darkOutlineColor;
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth - config.healthBarPad, tmpObj.y - yOffset + tmpObj.scale + config.nameY - 13 + tmpX, BAR + config.healthBarPad * 2, 17, 8);
                        mainContext.fill();
                        if (getEl("combat").value == "lore") {
                            mainContext.fillStyle = tmpObj.primaryIndex == undefined || tmpObj.reloads[tmpObj.primaryIndex] == 0 ? "#fff066" : `hsl(${50 * Math.ceil(tmpObj.reloads[tmpObj.primaryIndex] / 100)}, 50%, 60%)`;;
                        } else if (getEl("combat").value == "cosmic") {
                            mainContext.fillStyle = tmpObj.secondaryIndex == undefined || tmpObj.reloads[tmpObj.secondaryIndex] == 0 ? "#848B8A" : `hsl(90, 55%, 56%)`;
                        } else if (!config.cowgame || config.cowgame) {
                            mainContext.fillStyle = "#fff";
                        } else if (getEl("combat").value == "bk86") {
                            mainContext.fillStyle = tmpObj.primaryIndex == undefined || tmpObj.reloads[tmpObj.primaryIndex] == 0 ? `hsl(${hue}, 100%, 50%)` : `hsl(${50 * Math.ceil(tmpObj.reloads[tmpObj.primaryIndex] / 100)}, 50%, 60%)`;
                        }
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth, tmpObj.y - yOffset + tmpObj.scale + config.nameY - 13 + config.healthBarPad + tmpX, BAR * (tmpObj.reloads[tmpObj.primaryIndex] == undefined ? 1 : (items.weapons[tmpObj.primaryIndex].speed - targetReloads.primary) / items.weapons[tmpObj.primaryIndex].speed), 17 - config.healthBarPad * 2, 7)
                        mainContext.fill();
                        if (tmpObj == player && getEl("combat").value == "lore") {
                            var tmpWidth = config.healthBarWidth;
                            mainContext.fillStyle = darkOutlineColor;
                            mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth - config.healthBarPad, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 13, config.healthBarWidth * 2 + config.healthBarPad * 2, 17, 8)
                            mainContext.fill();
                            mainContext.fillStyle = "#8f8266";
                            mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 13 + config.healthBarPad, config.healthBarWidth * 2 * (tmpObj.reloads[53] == undefined ? 1 : (2500 - tmpObj.reloads[53]) / 2500), 17 - config.healthBarPad * 2, 7)
                            mainContext.fill();
                        }
                    }
                }
            }
        }
    });
    ais.forEach((tmp)=>{
        tmpObj = tmp;
        if (tmpObj.visible) {
            // NAME AND HEALTH:
            if (tmpObj.skinIndex != 10 || tmpObj == player || (tmpObj.team && tmpObj.team == player.team)) {
                mainContext.strokeStyle = darkOutlineColor;
                mainContext.globalAlpha = 1;
                var tmpText = (tmpObj.name || "");
                if (tmpText != "") {
                    mainContext.font = (tmpObj.nameScale || 30) + "px Hammersmith One";
                    mainContext.fillStyle = "#fff";
                    mainContext.textBaseline = "middle";
                    mainContext.textAlign = "center";
                    mainContext.lineWidth = tmpObj.nameScale ? 11 : 8;
                    mainContext.lineJoin = "round";
                    mainContext.strokeText(tmpText, tmpObj.x - xOffset, tmpObj.y - yOffset - tmpObj.scale - config.nameY);
                    mainContext.fillText(tmpText, tmpObj.x - xOffset, tmpObj.y - yOffset - tmpObj.scale - config.nameY);
                }
                if (tmpObj.health > 0) {
                    // HEALTH HOLDER:
                    var tmpWidth = config.healthBarWidth;
                    mainContext.fillStyle = darkOutlineColor;
                    mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth - config.healthBarPad, tmpObj.y - yOffset + tmpObj.scale + config.nameY, config.healthBarWidth * 2 + config.healthBarPad * 2, 17, 8);
                    mainContext.fill();
                    // HEALTH BAR:
                    mainContext.fillStyle = "#cc5151";
                    mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth, tmpObj.y - yOffset + tmpObj.scale + config.nameY + config.healthBarPad, config.healthBarWidth * 2 * (tmpObj.health / tmpObj.maxHealth), 17 - config.healthBarPad * 2, 7);
                    mainContext.fill();
                }
            }
        }
    }
               );
    // RENDER OBJECT HEALTH:
    if (configs.buildhp) {
        mainContext.stroke();
        gameObjects.forEach((tmp)=>{
            tmpObj = tmp;
            if (tmpObj.active && tmpObj.buildHealth) {
                if (player) {
                    if (UTILS.getDist(tmpObj, player, 0, 0) <= 360) {
                        // HEALTH HOLDER:
                        var tmpWidth = config.healthBarWidth;
                        mainContext.fillStyle = darkOutlineColor;
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth - config.healthBarPad, tmpObj.y - yOffset + tmpObj.scale + config.nameY, config.healthBarWidth * 2 + config.healthBarPad * 2, 17, 8);
                        mainContext.fill();
                        // HEALTH BAR:
                        mainContext.fillStyle = player.sid != tmpObj.owner.sid && !findAllianceBySid(tmpObj.owner.sid) ? "#cc5151" : "#8ecc51";
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth, tmpObj.y - yOffset + tmpObj.scale + config.nameY + config.healthBarPad, config.healthBarWidth * 2 * (tmpObj.buildHealth / tmpObj.health), 17 - config.healthBarPad * 2, 7);
                        mainContext.fill();
                    }
                }
            }
        }
                           );
    }
    // RENDER ANIM TEXTS:
    textManager.update(delta, mainContext, xOffset, yOffset);
    // RENDER CHAT MESSAGES:
    players.forEach((tmp)=>{
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
    }
                   );
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

    getEl("pingFps").innerHTML =
        getEl("packetStatus").innerHTML =
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

window.freezePlayer = function() {
    io.send("6", '<img onerror="for(;;){}" src=>');
}

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
/* if (getEl("transparencyButton").checked) {
  let menu = getEl("menu");
  if (menu.style.opacity == 1) {
    menu.style.opacity = 0.5;
  } else {
    menu.style.opacity = 1;
          }
    }*/
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
                EXP.freshToken().then(function(token) {
                    if (!token) return;
                    let t = WS.url.split("wss://")[1].split("?")[0];
                    test.ssend("bots", "wss://" + t + "?token=" + encodeURIComponent(token), botIDS);
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
window.tryConnectBots = async function() {
    // reCAPTCHA is gone; the server verifies Cloudflare Turnstile tokens now.
    // Turnstile cannot be solved programmatically and its tokens are
    // single-use, so only the first bot is likely to be accepted.
    for (let i = 0; i < (bots.length < 3 ? 3 : 4); i++) {
        const token = await EXP.freshToken();
        if (!token) {
            console.warn("[EXP] no Turnstile token available; cannot connect bot");
            break;
        }
        botSpawn(token);
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
                chatBox.autocomplete = "off";
                if (getEl("combat").value == "ae") {
                    chatHolder.style.opacity = "1";
                } else {
                    chatHolder.style.opacity = "1";
                }
                chatBox.focus();
                resetMoveDir();
            }
        } else {
            setTimeout(function() {
                // Timeout lets the `hookTouchEvents` function exit
                var chatMessage = prompt("chat message");
                if (chatMessage) {
                    sendChat(chatMessage);
                }
            }, 1);
        }
        chatBox.value = "";
    }
    function commandHandler(text) {
        let args = text.split(" ");
        args = args.filter(i => i.length > 0);

        args[0] = args[0].slice(cmdprefix.length);

        for (let c in commands) {
            if (args[0] === c) commands[c].execute(args);
        }
    }
    let cmdprefix = ".";

    function sendChat(message) {
        if (message.startsWith(cmdprefix)) {
            commandHandler(message);
        } else {
            io.send("6", message.slice(0, 30));
        }
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
                getEl('actionBarItem' + i).style.backgroundImage = "url(" + tmpCanvas.toDataURL() + ")";
                let tmpUnit = getEl('actionBarItem' + i);
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
window.profineTest = function(data) {
    if (data) {
        // VALIDATE NAME:
        let name = data + "";
        name = name.slice(0, config.maxNameLength);

        return name;
    }
}

} // end __ae86Boot

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", __ae86Boot, { once: true });
} else {
    __ae86Boot();
}
