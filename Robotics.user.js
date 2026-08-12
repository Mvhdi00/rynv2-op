// ==UserScript==
// @name        Robotics Official
// @match       *://*.moomoo.io/*
// @grant       none
// @version     v5.5.7
// @author      Yurio, Oe, Brt3726 And Phalynxi
// @description best mod trust
// @run-at      document-start
// ==/UserScript==

/*
 * Changes against the original upload:
 *
 *   1. A bare "a" sat between @description and ==/UserScript==. That line is
 *      not a comment, so it is executable code: the script threw
 *      "ReferenceError: a is not defined" on its very first statement and
 *      nothing below it ever ran.
 *   2. @run-at document-start added. The hook replaces
 *      WebSocket.prototype.send, and the game captures that reference when its
 *      bundle loads -- installing afterwards hooks nothing. The body is
 *      deferred to DOMContentLoaded, since it touches the DOM at load.
 *   3. The EXP shim below (same one the External Client, AE86 and Aurora use)
 *      supplies the transport the current server needs, and window.msgpack,
 *      which this script used everywhere but never defined or @require'd.
 */

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

/* The body below reads the DOM at load (document.head, getElementById), so it
 * waits for the document. The shim above is already installed by then, which
 * is the part that had to beat the game bundle. */
function __robotisBoot() {

function getEl(id) {
	return document.getElementById(id);
}

class Altcha {
	static get threads() { return navigator.hardwareConcurrency || 8; }

	static {
		const s = document.createElement("style");
		s.innerHTML = "altcha-widget,#altcha{display:none!important;visibility:hidden!important}.altcha-toast{position:fixed;top:20px;right:20px;padding:10px 18px;border-radius:6px;font:600 14px/1.4 system-ui,sans-serif;color:#fff;z-index:999999;pointer-events:none;animation:altchaIn .2s ease,altchaOut .3s ease 2s forwards;box-shadow:0 4px 12px rgba(0,0,0,.3)}.altcha-toast--info{background:#3b82f6}.altcha-toast--success{background:#22c55e}.altcha-toast--error{background:#ef4444}@keyframes altchaIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}@keyframes altchaOut{to{opacity:0;transform:translateY(-10px)}}";
		document.head.appendChild(s);

		const workerCode = `importScripts('https://cdn.jsdelivr.net/npm/js-sha256@0.9.0/build/sha256.min.js');
onmessage=({data:{salt,challenge,start,end}})=>{
for(let i=start;i<=end;i++){
if(sha256(salt+i)===challenge)return postMessage({found:true,n:i});
}
postMessage({found:false});
};`;
		// ALTCHA is gone -- the game verifies Cloudflare Turnstile now, which is
		// not a proof-of-work challenge and cannot be solved here. This solver
		// therefore never fires. Spin the worker pool up lazily instead of
		// eagerly allocating one worker per core (and fetching sha256 from a
		// CDN) for something that will not run.
		const blobUrl = URL.createObjectURL(new Blob([workerCode], { type: "text/javascript" }));
		Altcha._blobUrl = blobUrl;
		Object.defineProperty(Altcha, "_pool", {
			configurable: true,
			get() {
				const pool = Array.from({ length: Altcha.threads }, () => new Worker(Altcha._blobUrl));
				Object.defineProperty(Altcha, "_pool", { value: pool, configurable: true, writable: true });
				return pool;
			}
		});
		Altcha._solving = false;
		Altcha._lastSig = null;

		const check = (n) => {
			if (n.id === "altcha" || n.tagName === "ALTCHA-WIDGET") Altcha._solveElement(n);
			const found = n.querySelectorAll?.("altcha-widget,#altcha");
			if (found?.length) found.forEach(e => Altcha._solveElement(e));
		};
		new MutationObserver(m => m.forEach(x => x.addedNodes.forEach(check)))
			.observe(document, { childList: true, subtree: true });
		new MutationObserver(m => m.forEach(x => x.attributeName === "challengejson" && Altcha._solveElement(x.target)))
			.observe(document, { attributes: true, subtree: true, attributeFilter: ["challengejson"] });
		document.querySelectorAll("altcha-widget,#altcha").forEach(e => Altcha._solveElement(e));
	}

	static async generate(challenge) {
		const w = Altcha.threads;
		const max = parseInt(challenge?.maxnumber) || 1e6;
		const chunk = Math.ceil(max / w);
		const t0 = performance.now();

		const result = await new Promise((resolve, reject) => {
			let done = false, pending = w;
			Altcha._pool.forEach((worker, i) => {
				const start = i * chunk, end = Math.min(max - 1, (i + 1) * chunk - 1);
				worker.onmessage = ({ data }) => {
					if (done) return;
					if (data.found) { done = true; resolve({ n: data.n, t: performance.now() - t0 }); }
					else if (--pending === 0) reject(new Error("Not found"));
				};
				worker.postMessage({ salt: challenge.salt, challenge: challenge.challenge, start, end });
			});
		});

		return btoa(JSON.stringify({
			algorithm: challenge.algorithm || "SHA-256",
			challenge: challenge.challenge,
			salt: challenge.salt,
			number: result.n,
			signature: challenge.signature,
			took: Math.round(result.t),
		}));
	}

	static async _solveElement(e) {
		if (Altcha._solving) return;
		let j = e.getAttribute("challengejson") || e.dataset?.challengejson;
		if (!j) {
			const u = e.getAttribute("challengeurl");
			if (!u || e.dataset?.f) return;
			try { new URL(u, location.href); } catch { return; }
			e.dataset.f = "1";
			try {
				const res = await fetch(u);
				if (!res.ok) { e.dataset.f = "0"; return; }
				j = JSON.stringify(await res.json());
				e.setAttribute("challengejson", j);
			} catch { e.dataset.f = "0"; return; }
			e.dataset.f = "0";
		}
		let p;
		try { p = JSON.parse(j); } catch { return; }
		if (!p.salt || !p.challenge || p.signature === Altcha._lastSig) return;

		Altcha._solving = true;
		try {
			const payload = await Altcha.generate(p);
			Altcha._lastSig = p.signature;
			e.dispatchEvent(new CustomEvent("statechange", { bubbles: true, detail: { state: "verified", payload } }));

			const inp = e.querySelector('input[name="altcha"]') || document.querySelector('input[name="altcha"]')
				|| e.querySelector('input[type="hidden"]') || document.querySelector('input[type="hidden"]');
			if (inp) {
				inp.value = payload;
				inp.dispatchEvent(new Event("input", { bubbles: true }));
				setTimeout(() => inp.dispatchEvent(new Event("change", { bubbles: true })), 100);
			} else {
				let parent = e;
				for (let i = 0; i < 5 && parent; i++) {
					const any = parent.querySelector("input");
					if (any) { any.value = payload; any.dispatchEvent(new Event("input", { bubbles: true })); any.dispatchEvent(new Event("change", { bubbles: true })); break; }
					parent = parent.parentElement;
				}
				if (!parent) {
					const inp2 = document.createElement("input");
					inp2.name = "altcha"; inp2.type = "hidden"; inp2.value = payload;
					e.appendChild(inp2);
				}
			}
		} catch {
		} finally {
			Altcha._solving = false;
		}
	}
}

function isChatActive() {
	const active = document.activeElement;
	if (!active) return false;
	const id = active.id;
	return (
		id === "ChatInPut" ||
		id === "ChatSearch" ||
		id === "chatBox" ||
		id === "allianceInput" ||
		id === "mChBox"
	);
}

const PackTextures = {
	hats: {
		7: "https://i.imgur.com/vAOzlyY.png",
		12: "https://i.imgur.com/VSUId2s.png",
		13: "https://i.imgur.com/EwkbsHN.png",
		11: "https://i.imgur.com/yfqME8H.png",
		"11_p": "https://i.imgur.com/yfqME8H.png",
		"11_top": "https://i.imgur.com/s7Cxc9y.png",
		9: "https://i.imgur.com/1nY34aL.png",
		18: "https://i.imgur.com/in5H6vw.png",
		40: "https://i.imgur.com/AVOqAll.png",
		6: "https://i.imgur.com/vM9Ri8g.png",
		20: "https://i.imgur.com/f5uhWCk.png",
		23: "https://i.imgur.com/B9AcmcN.png",
		15: "https://i.imgur.com/YRQ8Ybq.png",
		8: "https://i.imgur.com/WHJch5H.png",
		31: "https://i.imgur.com/JPMqgSc.png",
	},
	accessories: {
		21: "https://i.imgur.com/4ddZert.png",
		18: "https://i.imgur.com/0rmN7L9.png",
		19: "https://i.imgur.com/Qyxy7IB.png",
	},
	weapons: {
		samurai_1_g: "https://i.imgur.com/h3nF00S.png",
		samurai_1_d: "https://i.imgur.com/xxvYtUT.png",
		samurai_1_r: "https://i.imgur.com/1G64fMe.png",

		sword_1_g: "https://i.imgur.com/urXBRpw.png",
		sword_1_d: "https://i.imgur.com/k4H1VyQ.png",
		sword_1_r: "https://i.imgur.com/V9dzAbF.png",

		spear_1_g: "https://i.imgur.com/WWfm7zT.png",
		spear_1_d: "https://i.imgur.com/5nPGXKb.png",
		spear_1_r: "https://i.imgur.com/UY7SV7j.png",

		great_axe_1_d: "https://i.imgur.com/vdTDWcn.png",
		great_axe_1_r: "https://i.imgur.com/UZ2HcQw.png",

		axe_1_d: "https://i.imgur.com/ufkQAa6.png",
		axe_1_r: "https://i.imgur.com/kr8H9g7.png",

		dagger_1_d: "https://i.imgur.com/KCufsmG.png",
		dagger_1_r: "https://i.imgur.com/CDAmjux.png",

		hammer_1_g: "https://i.imgur.com/WPWU8zC.png",
		hammer_1_d: "https://i.imgur.com/rlMQeG0.png",
		hammer_1_r: "https://i.imgur.com/oRXUfW8.png",

		great_hammer_1_g: "https://i.imgur.com/mleFosh.png",
		great_hammer_1_d: "https://i.imgur.com/yn7fqMO.png",
		great_hammer_1_r: "https://i.imgur.com/tmUzurk.png",

		bat_1_g: "https://i.imgur.com/ivLPh10.png",
		bat_1_d: "https://i.imgur.com/phXTNsa.png",
		bat_1_r: "https://i.imgur.com/6ayjbIz.png",

		stick_1_g: "https://i.imgur.com/NOaBBRd.png",
		stick_1_d: "https://i.imgur.com/H5wGqQR.png",
		stick_1_r: "https://i.imgur.com/uTDGDDy.png",

		bow_1_d: "https://i.imgur.com/qu7HHT5.png",
		bow_1_r: "https://i.imgur.com/Oneg3oF.png",

		crossbow_1_d: "https://i.imgur.com/TRqDlgX.png",
		crossbow_1_r: "https://i.imgur.com/EVesBtw.png",

		crossbow_2_d: "https://i.imgur.com/DVjCdwI.png",
		crossbow_2_r: "https://i.imgur.com/z4CyaXk.png",

		musket_1_g: "https://i.imgur.com/mAW9JAW.png",
		musket_1_d: "https://i.imgur.com/jwH99zm.png",
		musket_1_r: "https://i.imgur.com/jPE54IT.png",

		shield_1_g: "https://i.imgur.com/zYP8eVL.png",
		shield_1_d: "https://i.imgur.com/hSqLP3t.png",
		shield_1_r: "https://i.imgur.com/SNFV2dc.png",

		grab_1_g: "https://i.imgur.com/DRzBdFX.png",
		grab_1_d: "https://i.imgur.com/7kbtWfk.png",
		grab_1_r: "https://i.imgur.com/wV42LEE.png",
	},
};

const textureCache = new Map();

function getTexture(id, type) {
	let url = null;
	if (type === "hat") url = PackTextures.hats[id];
	else if (type === "acc") url = PackTextures.accessories[id];
	else if (type === "weapons") url = PackTextures.weapons[id];

	if (!url) return null;
	if (textureCache.has(url)) return textureCache.get(url);

	const img = new Image();
	img.crossOrigin = "anonymous";
	img.src = url;
	textureCache.set(url, img);
	return img;
}

const originalSrcDesc = Object.getOwnPropertyDescriptor(Image.prototype, "src");

Object.defineProperty(Image.prototype, "src", {
	get() {
		return originalSrcDesc.get.call(this);
	},
	set(value) {
		try {
			const paths = {
				"/hats/": { type: "hat", prefix: "hat_" },
				"/accessories/": { type: "acc", prefix: "access_" },
				"/weapons/": { type: "weapons", prefix: "/weapons/" },
			};

			for (const [path, { type, prefix }] of Object.entries(paths)) {
				if (value.includes(path)) {
					let id = value.split(prefix)[1]?.replace(".png", "");
					if (type === "hat" && id.includes("_"))
						id = id.split("_")[0] + "_" + id.split("_")[1];

					const replacement = getTexture(id, type);
					if (replacement) {
						value = replacement.src;
					}
					break;
				}
			}
		} catch (e) {
			console.warn("Texture pack error:", e);
		}

		return originalSrcDesc.set.call(this, value);
	},
	configurable: true,
});

function preloadTextures() {
	Object.keys(PackTextures.hats).forEach((id) => getTexture(id, "hat"));
	Object.keys(PackTextures.accessories).forEach((id) => getTexture(id, "acc"));
	Object.keys(PackTextures.weapons).forEach((id) => getTexture(id, "weapons"));
}

preloadTextures();

let clickedElements = {
	color: false,
};

const tryClickElements = () => {
	if (!clickedElements.color) {
		const colorElement = document.querySelector(
			"#skinColorHolder > div:nth-child(7)",
		);
		if (colorElement) {
			colorElement.click();
			clickedElements.color = true;
		}
	}

	if (!clickedElements.color) {
		setTimeout(tryClickElements, 500);
	}
};

setTimeout(tryClickElements, 1000);

let serverID;
const delayWorker = `
let timeouts = {};
let intervals = {};

self.onmessage = (e) => {
const { type, id, delay } = e.data;

if (type === "setTimeout") {
    timeouts[id] = setTimeout(() => {
    self.postMessage({ type: "timeout", id });
    delete timeouts[id];
    }, delay);
}

else if (type === "clearTimeout") {
    if (timeouts[id]) {
    clearTimeout(timeouts[id]);
    delete timeouts[id];
    }
}

else if (type === "setInterval") {
    intervals[id] = setInterval(() => {
    self.postMessage({ type: "interval", id });
    }, delay);
}

else if (type === "clearInterval") {
    if (intervals[id]) {
    clearInterval(intervals[id]);
    delete intervals[id];
    }
}
};
`;

const delayWorkerBlob = new Blob([delayWorker], { type: "application/javascript" });
const worker1 = new Worker(URL.createObjectURL(delayWorkerBlob));

let nextId = 0;
const workerList = {};

function workerSetTimeout(fn, delay) {
	const id = nextId++;
	workerList[id] = fn;
	worker1.postMessage({ type: "setTimeout", id, delay });
	return id;
}

function workerClearTimeout(id) {
	worker1.postMessage({ type: "clearTimeout", id });
	delete workerList[id];
}

function workerSetInterval(fn, delay) {
	const id = nextId++;
	workerList[id] = fn;
	worker1.postMessage({ type: "setInterval", id, delay });
	return id;
}

function workerClearInterval(id) {
	worker1.postMessage({ type: "clearInterval", id });
	delete workerList[id];
}

worker1.onmessage = (e) => {
	const { type, id } = e.data;
	if (!workerList[id]) return;

	if (type === "timeout") {
		workerList[id]();
		delete workerList[id];
	} else if (type === "interval") {
		workerList[id]();
	}
};

// CONFIG:
const config = {
	// RENDER:
	maxScreenWidth: 1920,
	maxScreenHeight: 1080,

	// SERVER:
	serverUpdateRate: 9,
	maxPlayers: 40,
	maxPlayersHard: 50,
	collisionDepth: 6,
	minimapRate: 3000,

	// COLLISIONS:
	colGrid: 10,

	// CLIENT:
	clientSendRate: 5,

	// UI:
	healthBarWidth: 50,
	healthBarPad: 4.5,
	iconPadding: 15,
	iconPad: 0.9,
	deathFadeout: 3000,
	crownIconScale: 60,
	crownPad: 35,

	// CHAT:
	chatCountdown: 3000,
	chatCooldown: 500,

	// SANDBOX:
	isSandbox: window.location.hostname == "sandbox.moomoo.io" ? true : false,

	// PLAYER:
	maxAge: 100,
	gatherAngle: Math.PI / 2.6,
	gatherWiggle: 10,
	hitReturnRatio: 0.25,
	hitAngle: Math.PI / 2,
	playerScale: 35,
	playerSpeed: 0.0016,
	playerDecel: 0.993,
	nameY: 34,

	// CUSTOMIZATION:
	skinColors: [
		"#bf8f54",
		"#cbb091",
		"#896c4b",
		"#fadadc",
		"#ececec",
		"#c37373",
		"#4c4c4c",
		"#ecaff7",
		"#738cc3",
		"#8bc373",
	],

	// ANIMALS:
	animalCount: 7,
	aiTurnRandom: 0.06,
	cowNames: [
		"Sid",
		"Steph",
		"Bmoe",
		"Romn",
		"Jononthecool",
		"Fiona",
		"Vince",
		"Nathan",
		"Nick",
		"Flappy",
		"Ronald",
		"Otis",
		"Pepe",
		"Mc Donald",
		"Theo",
		"Fabz",
		"Oliver",
		"Jeff",
		"Jimmy",
		"Helena",
		"Reaper",
		"Ben",
		"Alan",
		"Naomi",
		"XYZ",
		"Clever",
		"Jeremy",
		"Mike",
		"Destined",
		"Stallion",
		"Allison",
		"Meaty",
		"Sophia",
		"Vaja",
		"Joey",
		"Pendy",
		"Murdoch",
		"Theo",
		"Jared",
		"July",
		"Sonia",
		"Mel",
		"Dexter",
		"Quinn",
		"Milky",
	],

	// WEAPONS:
	shieldAngle: Math.PI / 3,
	weaponVariants: [
		{
			id: 0,
			src: "",
			xp: 0,
			val: 1,
		},
		{
			id: 1,
			src: "_g",
			xp: 3000,
			val: 1.1,
		},
		{
			id: 2,
			src: "_d",
			xp: 7000,
			val: 1.18,
		},
		{
			id: 3,
			src: "_r",
			poison: true,
			xp: 12000,
			val: 1.18,
		},
	],
	fetchVariant: function (player) {
		let tmpXP = player.weaponXP[player.weaponIndex] || 0;
		for (let i = config.weaponVariants.length - 1; i >= 0; --i) {
			if (tmpXP >= config.weaponVariants[i].xp) {
				return config.weaponVariants[i];
			}
		}
	},

	// NATURE:
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
	rockScales: [80, 85, 90],

	// BIOME DATA:
	snowBiomeTop: 2400,
	snowSpeed: 0.75,

	// DATA:
	maxNameLength: 15,

	// MAP:
	mapScale: 14400,
	mapPingScale: 40,
	mapPingTime: 2200,

	// VOLCANO:
	volcanoScale: 320,
	innerVolcanoScale: 100,
	volcanoAnimalStrength: 2,
	volcanoAnimationDuration: 3200,
	volcanoAggressionRadius: 1440,
	volcanoAggressionPercentage: 0.2,
	volcanoDamagePerSecond: -1,
	volcanoLocationX: 14400 - 440,
	volcanoLocationY: 14400 - 440,
};
window.config = config;

// RECORDING SYSTEM
let recMediaRecorder = null;
let recChunks = [];
let recIsRecording = false;
let recRecordings = [];
let recStartTime = 0;
let recTimerInterval = null;
let recSettings = {
	mode: localStorage.getItem("rec_mode") || "game",
	fps: parseInt(localStorage.getItem("rec_fps")) || 60,
	quality: parseInt(localStorage.getItem("rec_quality")) || 8000000,
	autoSave: localStorage.getItem("rec_autoSave") === "true",
	volume: parseFloat(localStorage.getItem("rec_volume") ?? "1"),
};

function recSaveSetting(key, val) {
	recSettings[key] = val;
	localStorage.setItem("rec_" + key, val);
}

function recGetMimeType() {
	const types = [
		"video/webm;codecs=vp9,opus",
		"video/webm;codecs=vp9",
		"video/webm;codecs=vp8,opus",
		"video/webm;codecs=vp8",
		"video/webm",
	];
	for (const t of types) {
		if (MediaRecorder.isTypeSupported(t)) return t;
	}
	return "";
}

function recFormatTime(ms) {
	const s = Math.floor(ms / 1000);
	const m = Math.floor(s / 60);
	const h = Math.floor(m / 60);
	const pad = (n) => String(n).padStart(2, "0");
	if (h > 0) return `${pad(h)}:${pad(m % 60)}:${pad(s % 60)}`;
	return `${pad(m)}:${pad(s % 60)}`;
}

// UIS:
const UIS = {
	ads: {
		adCard: getEl("adCard"),
		adContainer: getEl("ad-container"),
		promoImg: getEl("promoImg"),
		promoImageHolder: getEl("promoImgHolder"),
		wideAdCard: getEl("wideAdCard"),
	},
	buttons: {
		store: getEl("storeButton"),
		alliance: getEl("allianceButton"),
		chat: getEl("chatButton"),
		enterGame: getEl("enterGame"),
		altchaCheckBox: getEl("altcha_checkbox"),
		partyButton: getEl("partyButton"),
		joinB: getEl("joinPartyButton"),
		settingsButton: getEl("settingsButton"),
		settingsButtonTitle:
			getEl("settingsButton").getElementsByTagName("span")[0],
	},
	resources: {
		food: getEl("foodDisplay"),
		wood: getEl("woodDisplay"),
		stone: getEl("stoneDisplay"),
		score: getEl("scoreDisplay"),
		kill: getEl("killCounter"),
	},
	global: {
		// i made this since im to lazy to make catagorize for them
		menuText: getEl("desktopInstructions"),
		setupCard: getEl("setupCard"),
		guideCard: getEl("guideCard"),
		gameUI: getEl("gameUI"),
		gameName: getEl("gameName"),
		mainMenu: getEl("mainMenu"),
		storeMenu: getEl("storeMenu"),
		nameInput: getEl("nameInput"),
		gameCanvas: getEl("gameCanvas"),
		gameContext: getEl("gameCanvas").getContext("2d"),
		mapDisplay: getEl("mapDisplay"),
		mapContext: getEl("mapDisplay").getContext("2d"),
		shutdownDisplay: getEl("shutdownDisplay"),
		pingDisplay: getEl("pingDisplay"),
		loadingText: getEl("loadingText"),
		diedText: getEl("diedText"),
		ageText: getEl("ageText"),
		ageBarBody: getEl("ageBarBody"),
		allianceMenu: getEl("allianceMenu"),
		allianceManager: getEl("allianceManager"),
		notificationDisplay: getEl("noticationDisplay"),
		leaderboardData: getEl("leaderboardData"),
		actionBar: getEl("actionBar"),
		playMusic: getEl("playMusic"),
		upgradeCounter: getEl("upgradeCounter"),
		chatBox: getEl("chatBox"),
		altcha: getEl("altcha"),
	},
	holder: {
		menuCardHolder: getEl("menuCardHolder"),
		itemInfoHolder: getEl("itemInfoHolder"),
		upgradeHolder: getEl("upgradeHolder"),
		allianceHolder: getEl("allianceHolder"),
		skinColorHolder: getEl("skinColorHolder"),
		storeHolder: getEl("storeHolder"),
		chatHolder: getEl("chatHolder"),
	},
	server: {
		serverBrowser: getEl("serverBrowser"),
		nativeResolutionOption: getEl("nativeResolution"),
		showPingOption: getEl("showPing"),
	},
};
let menuText = UIS.global.menuText;
let setupCard = UIS.global.setupCard;
let guideCard = UIS.global.guideCard;
let gameName = UIS.global.gameName;
let gameUI = UIS.global.gameUI;
let mainMenu = UIS.global.mainMenu;
let storeMenu = UIS.global.storeMenu;
let nameInput = UIS.global.nameInput;
let gameCanvas = UIS.global.gameCanvas;
let gameContext = UIS.global.gameContext;
let mapDisplay = UIS.global.mapDisplay;
let mapContext = UIS.global.mapContext;
let shutdownDisplay = UIS.global.shutdownDisplay;
let pingDisplay = UIS.global.pingDisplay;
let loadingText = UIS.global.loadingText;
let diedText = UIS.global.diedText;
let ageText = UIS.global.ageText;
let ageBarBody = UIS.global.ageBarBody;
let allianceMenu = UIS.global.allianceMenu;
let allianceManager = UIS.global.allianceManager;
let notificationDisplay = UIS.global.notificationDisplay;
let leaderboardData = UIS.global.leaderboardData;
let actionBar = UIS.global.actionBar;
let upgradeCounter = UIS.global.upgradeCounter;
let chatBox = UIS.global.chatBox;
let altcha = UIS.global.altcha;

// BUTTON:
let storeButton = UIS.buttons.store;
let allianceButton = UIS.buttons.alliance;
let chatButton = UIS.buttons.chat;
let enterGameButton = UIS.buttons.enterGame;
let altchaButton = UIS.buttons.altchaCheckBox;
let partyButton = UIS.buttons.partyButton;
let joinB = UIS.buttons.joinB;
let settingsButton = UIS.buttons.settingsButton;
let settingsButtonTitle = UIS.buttons.settingsButtonTitle;

chatButton.remove();
enterGameButton.active = true;
enterGameButton.disabled = false;
enterGameButton.classList.remove("disabled");

// Ensure enter game button is always active
Object.defineProperty(enterGameButton, 'disabled', {
	get: () => false,
	set: () => { }
});

enterGameButton.addEventListener('click', () => {
	enterGameButton.disabled = false;
	enterGameButton.classList.remove("disabled");
});

// RESOURCE:
let foodDisplay = UIS.resources.food;
let woodDisplay = UIS.resources.wood;
let stoneDisplay = UIS.resources.stone;
let scoreDisplay = UIS.resources.score;
let killCounter = UIS.resources.kill;

// ADS:
let adCard = UIS.ads.adCard;
let adContainer = UIS.ads.adContainer;
let promoImg = UIS.ads.promoImg;
let promoImageHolder = UIS.ads.promoImageHolder;
let wideAdCard = UIS.ads.wideAdCard;
let ads = Object.values(UIS.ads);
promoImg?.remove();
adCard?.remove();
wideAdCard?.remove();
getEl("partyButton")?.remove();
getEl("joinPartyButton")?.remove();
getEl("linksContainer2")?.remove();

// HOLDER:
let menuCardHolder = UIS.holder.menuCardHolder;
let itemInfoHolder = UIS.holder.itemInfoHolder;
let upgradeHolder = UIS.holder.upgradeHolder;
let allianceHolder = UIS.holder.allianceHolder;
let skinColorHolder = UIS.holder.skinColorHolder;
let storeHolder = UIS.holder.storeHolder;
let chatHolder = UIS.holder.chatHolder;

// SETTING:
let serverBrowser = UIS.server.serverBrowser;
let nativeResolutionOption = UIS.server.nativeResolutionOption;
let showPingOption = UIS.server.showPingOption;

// CTX || CONTEXT:
let mainContext = gameCanvas.getContext("2d");

// GAME UI;
function hover(html) {
	html.style.transition = "opacity 0.5s ease, transform 0.3s ease";
	html.style.transform = "scale(1)";
	html.onmouseover = function () {
		html.style.opacity = "1";
		html.style.transform = "scale(1.05)";
	};
	html.onmouseout = function () {
		html.style.opacity = "1";
		html.style.transform = "scale(1)";
	};
}
let coolFont = document.createElement("link");
coolFont.href =
	"https://fonts.googleapis.com/css2?family=Lilita+One&display=swap";
coolFont.rel = "stylesheet";
document.head.appendChild(coolFont);
gameName.innerHTML = "MooMoo";
gameName.style.cssText = `
font-size: 100px;
font-family: 'Lilita One', sans-serif;
background: linear-gradient(135deg, #a78bfa 0%, #6366f1 40%, #38bdf8 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
background-clip: text;
text-shadow: none;
filter: drop-shadow(0 4px 12px rgba(99,102,241,0.3));
transition: opacity 0.5s ease;
`;
promoImageHolder?.append(document.getElementById("skinColorHolder"));
document.getElementById("skinColorHolder").style.cssText = `
        display: flex;
        justify-content: center;
        gap: 10px;
        align-items: center;
        flex-wrap: nowrap;
        padding: 10px;
        background-color: rgba(0, 0, 0, 0.25);
        border-radius: 8px;`;

let serverMenu = document.createElement("div");
serverMenu.id = "serverMenu";
serverMenu.style.cssText = `
    position: fixed;
    top: 77%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 280px;
    opacity: 0;
    height: auto;
    max-height: 200px;
    overflow-y: auto;
    background: rgba(10, 6, 24, 0.6);
    backdrop-filter: blur(16px) saturate(150%);
    -webkit-backdrop-filter: blur(16px) saturate(150%);
    border: 1px solid rgba(139,92,246,0.15);
    padding: 0 10px 10px;
    border-radius: 14px;
    color: #fff;
    font-family: 'Inter', Arial, sans-serif;
    z-index: 1000;
    box-shadow: 0 8px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04);
    transition: opacity 0.3s ease-in-out;
    scrollbar-width: thin;
    scrollbar-color: rgba(139,92,246,0.4) transparent;
    margin-top: 15px;
`;
document.body.appendChild(serverMenu);
let serverTitle = document.createElement("div");
serverTitle.textContent = "SERVERS";
serverTitle.style.cssText = `
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: rgba(165,180,252,0.6);
        text-align: center;
        padding: 12px 0 6px;
        border-bottom: 1px solid rgba(139,92,246,0.12);
        margin-bottom: 4px;`;
serverMenu.appendChild(serverTitle);
let buttonContainer = document.createElement("div");
buttonContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 15px;
        padding: 10px;`;
serverMenu.appendChild(buttonContainer);

let largestServerButton = document.createElement("button");
largestServerButton.textContent = "Join Active Server";
largestServerButton.style.cssText = `
        background-color: #007bff;
        border: none;
        color: white;
        padding: 8px 10px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.3s;`;
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
// priv + WS proxy
const PRIV_PRIMARY = "wss://tw-moo-privateserver.onrender.com/server";
const PRIV_FALLBACK = "ws://localhost:1234/server";
let privActive = false;
let privUrl = PRIV_PRIMARY;

// The game bundle pins window.WebSocket (writable: false, configurable: false),
// so this assignment fails. Wrapped rather than relying on a silent no-op --
// note the consequence: with the property pinned, the private-server redirect
// does not take effect.
const NativeWS = window.WebSocket;
try {
	window.WebSocket = new Proxy(NativeWS, {
		construct(Target, args) {
			if (privActive) args[0] = privUrl;
			return new Target(...args);
		}
	});
} catch (e) {
	console.warn("[Robotics] window.WebSocket is pinned; the private-server proxy is inactive", e);
}

const probe = (url, timeout = 5000) => new Promise((res, rej) => {
	const ws = new NativeWS(url);
	const t = setTimeout(() => { ws.close(); rej(); }, timeout);
	ws.addEventListener("open", () => { clearTimeout(t); ws.close(); res(url); });
	ws.addEventListener("error", () => { clearTimeout(t); rej(); });
});

let testServerButton = document.createElement("button");
testServerButton.textContent = "Test Server: OFF";
testServerButton.style.cssText = `
	background: #1a1a2e;
	border: 1px solid #3a0060;
	color: #9b6dff;
	padding: 8px 10px;
	border-radius: 4px;
	cursor: pointer;
	font-weight: 700;
	letter-spacing: 0.5px;
	transition: background 0.2s, color 0.2s, border-color 0.2s, box-shadow 0.2s;`;

testServerButton.addEventListener("click", async () => {
	if (privActive) {
		privActive = false;
		testServerButton.textContent = "Test Server: OFF";
		testServerButton.style.background = "#1a1a2e";
		testServerButton.style.color = "#9b6dff";
		testServerButton.style.borderColor = "#3a0060";
		testServerButton.style.boxShadow = "";
		return;
	}

	testServerButton.disabled = true;
	config.isPrivate = false
	testServerButton.textContent = "Probing...";

	try {
		await probe(PRIV_PRIMARY);
		privUrl = PRIV_PRIMARY;
	} catch {
		try {
			await probe(PRIV_FALLBACK);
			privUrl = PRIV_FALLBACK;
		} catch {
			testServerButton.disabled = false;
			config.isPrivate = true
			testServerButton.textContent = "Test Server: OFF";
			alert("Both servers unreachable.");
			return;
		}
	}

	privActive = true;
	testServerButton.disabled = false;
	testServerButton.textContent = "Test Server: ON";
	testServerButton.style.background = "linear-gradient(135deg, #3b0066, #6a00ff)";
	testServerButton.style.color = "#fff";
	testServerButton.style.borderColor = "#8f2fff";
	testServerButton.style.boxShadow = "0 0 12px rgba(143,47,255,0.45)";
});
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
        }`;
buttonContainer.appendChild(largestServerButton);
buttonContainer.appendChild(testServerButton);
document.head.appendChild(style);
window.regionsName = {
	"eu-west": "Frankfurt",
	gb: "London",
	"us-east": "Miami",
	"us-west": "Silicon Valley",
	au: "Sydney",
	sg: "Singapore",
	saopaulo: "São Paulo",
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
	await Promise.all(
		servers.map(async (server) => {
			let requestPingUrl = `https://${server.key}.${server.region}.moomoo.io/ping/`;
			let startTime = Date.now();
			try {
				await fetch(requestPingUrl);
				server.ping = Date.now() - startTime;
			} catch (error) {
				server.ping = Infinity;
			}
		}),
	);

	return servers;
}
async function updateServers() {
	let servers = await getServers();
	let serversByRegion = {};
	servers.forEach((server) => {
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
	gameServers.childNodes.forEach((box) => {
		existingBoxes[box.dataset.serverKey] = box;
	});
	sortedServers.forEach((server) => {
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
		let colorPlc =
			server.playerCount >= 25
				? "red"
				: server.playerCount >= 15
					? "orange"
					: "green";
		let pingColor =
			server.ping < 150
				? "green"
				: server.ping < 400
					? "orange"
					: server.ping < 5000
						? "red"
						: "black";

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

updateServers();
let allServerPingInterval = workerSetInterval(updateServers, 5000);

promoImageHolder && hover(promoImageHolder);
hover(setupCard);
guideCard.remove();
(() => {
	let bgCanvas = document.getElementById("robotics-bg-canvas");
	if (!bgCanvas) {
		bgCanvas = document.createElement("canvas");
		bgCanvas.id = "robotics-bg-canvas";
		mainMenu.appendChild(bgCanvas);
	}
	bgCanvas.style.cssText = "position:absolute;inset:0;z-index:-1;";

	const ctx = bgCanvas.getContext("2d");
	let W = 0, H = 0;
	let mouseX = 0.5, mouseY = 0.5;
	let rafId = null;

	const PARTICLE_COUNT = 120;
	const CONNECT_DIST = 140;
	const SHAPE_COUNT = 12;
	let particles = [];
	let shapes = [];


	const LAYERS = [
		{ speed: 0.15, size: [1, 2.2], alpha: 0.25, parallax: 30 },
		{ speed: 0.35, size: [1.8, 3.2], alpha: 0.45, parallax: 18 },
		{ speed: 0.6, size: [2.8, 4.5], alpha: 0.7, parallax: 8 },
	];

	function lerp(a, b, t) { return a + (b - a) * t; }

	function hslColor(t) {
		const cycle = t * 0.00004;
		const phase = cycle % 1;
		let h, s, l;
		if (phase < 0.33) {
			const p = phase / 0.33;
			h = lerp(270, 230, p);
			s = lerp(70, 65, p);
			l = lerp(12, 10, p);
		} else if (phase < 0.66) {
			const p = (phase - 0.33) / 0.33;
			h = lerp(230, 180, p);
			s = lerp(65, 60, p);
			l = lerp(10, 11, p);
		} else {
			const p = (phase - 0.66) / 0.34;
			h = lerp(180, 270, p);
			s = lerp(60, 70, p);
			l = lerp(11, 12, p);
		}
		return `hsl(${h},${s}%,${l}%)`;
	}

	function accentColor(t, alpha) {
		const cycle = t * 0.00004;
		const phase = cycle % 1;
		let h;
		if (phase < 0.33) h = lerp(270, 230, phase / 0.33);
		else if (phase < 0.66) h = lerp(230, 180, (phase - 0.33) / 0.33);
		else h = lerp(180, 270, (phase - 0.66) / 0.34);
		return `hsla(${h},80%,65%,${alpha})`;
	}

	function initParticles() {
		particles = [];
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			const layerIdx = i < 30 ? 0 : i < 75 ? 1 : 2;
			const layer = LAYERS[layerIdx];
			particles.push({
				x: Math.random() * W,
				y: Math.random() * H,
				vx: (Math.random() - 0.5) * layer.speed,
				vy: (Math.random() - 0.5) * layer.speed,
				r: layer.size[0] + Math.random() * (layer.size[1] - layer.size[0]),
				alpha: layer.alpha,
				parallax: layer.parallax,
				pulse: Math.random() * Math.PI * 2,
				pulseSpeed: 0.01 + Math.random() * 0.02,
				layer: layerIdx,
			});
		}
	}

	function initShapes() {
		shapes = [];
		for (let i = 0; i < SHAPE_COUNT; i++) {
			shapes.push({
				x: Math.random() * W,
				y: Math.random() * H,
				vx: (Math.random() - 0.5) * 0.2,
				vy: (Math.random() - 0.5) * 0.2,
				size: 10 + Math.random() * 25,
				rotation: Math.random() * Math.PI * 2,
				rotSpeed: (Math.random() - 0.5) * 0.008,
				type: Math.random() < 0.5 ? "triangle" : "diamond",
				alpha: 0.06 + Math.random() * 0.08,
				parallax: 12 + Math.random() * 15,
			});
		}
	}

	function resize() {
		W = bgCanvas.width = window.innerWidth;
		H = bgCanvas.height = window.innerHeight;
		initParticles();
		initShapes();
	}

	function drawBackground(t) {
		ctx.fillStyle = hslColor(t);
		ctx.fillRect(0, 0, W, H);

		const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.05, W / 2, H / 2, H * 0.9);
		vig.addColorStop(0, "rgba(5,8,20,0)");
		vig.addColorStop(1, "rgba(0,0,0,0.8)");
		ctx.fillStyle = vig;
		ctx.fillRect(0, 0, W, H);
	}

	function drawParticles(t) {
		for (const p of particles) {
			p.x += p.vx;
			p.y += p.vy;
			p.pulse += p.pulseSpeed;
			if (p.x < -10) p.x = W + 10;
			if (p.x > W + 10) p.x = -10;
			if (p.y < -10) p.y = H + 10;
			if (p.y > H + 10) p.y = -10;
		}

		for (let i = 0; i < particles.length; i++) {
			const a = particles[i];
			if (a.layer === 0) continue;
			const ax = a.x + (mouseX - 0.5) * a.parallax;
			const ay = a.y + (mouseY - 0.5) * a.parallax;
			for (let j = i + 1; j < particles.length; j++) {
				const b = particles[j];
				if (b.layer === 0) continue;
				if (Math.abs(a.layer - b.layer) > 1) continue;
				const bx = b.x + (mouseX - 0.5) * b.parallax;
				const by = b.y + (mouseY - 0.5) * b.parallax;
				const dx = bx - ax;
				const dy = by - ay;
				const d = Math.sqrt(dx * dx + dy * dy);
				if (d > CONNECT_DIST) continue;
				const lineAlpha = (1 - d / CONNECT_DIST) * 0.15 * Math.min(a.alpha, b.alpha);
				ctx.strokeStyle = accentColor(t, lineAlpha);
				ctx.lineWidth = 0.6;
				ctx.beginPath();
				ctx.moveTo(ax, ay);
				ctx.lineTo(bx, by);
				ctx.stroke();
			}
		}

		for (const p of particles) {
			const glow = 0.5 + 0.5 * Math.sin(p.pulse);
			const px = p.x + (mouseX - 0.5) * p.parallax;
			const py = p.y + (mouseY - 0.5) * p.parallax;
			const drawAlpha = p.alpha * (0.6 + glow * 0.4);

			if (p.r > 3) {
				const halo = ctx.createRadialGradient(px, py, 0, px, py, p.r * 5);
				halo.addColorStop(0, accentColor(t, drawAlpha * 0.3));
				halo.addColorStop(1, "rgba(0,0,0,0)");
				ctx.beginPath();
				ctx.arc(px, py, p.r * 5, 0, Math.PI * 2);
				ctx.fillStyle = halo;
				ctx.fill();
			}

			ctx.beginPath();
			ctx.arc(px, py, p.r * (0.8 + glow * 0.2), 0, Math.PI * 2);
			ctx.fillStyle = accentColor(t, drawAlpha);
			ctx.fill();
		}
	}

	function drawShapes(t) {
		for (const s of shapes) {
			s.x += s.vx;
			s.y += s.vy;
			s.rotation += s.rotSpeed;
			if (s.x < -50) s.x = W + 50;
			if (s.x > W + 50) s.x = -50;
			if (s.y < -50) s.y = H + 50;
			if (s.y > H + 50) s.y = -50;

			const sx = s.x + (mouseX - 0.5) * s.parallax;
			const sy = s.y + (mouseY - 0.5) * s.parallax;

			ctx.save();
			ctx.translate(sx, sy);
			ctx.rotate(s.rotation);
			ctx.strokeStyle = accentColor(t, s.alpha);
			ctx.lineWidth = 1;
			ctx.beginPath();

			if (s.type === "triangle") {
				for (let i = 0; i < 3; i++) {
					const a = (Math.PI * 2 / 3) * i - Math.PI / 2;
					const px = Math.cos(a) * s.size;
					const py = Math.sin(a) * s.size;
					i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
				}
				ctx.closePath();
			} else {
				ctx.moveTo(0, -s.size);
				ctx.lineTo(s.size * 0.6, 0);
				ctx.lineTo(0, s.size);
				ctx.lineTo(-s.size * 0.6, 0);
				ctx.closePath();
			}

			ctx.stroke();
			ctx.restore();
		}
	}



	function frame(t) {
		if (typeof inGame !== 'undefined' && inGame) {
			rafId = requestAnimationFrame(frame);
			return;
		}
		drawBackground(t);
		drawShapes(t);
		drawParticles(t);

		rafId = requestAnimationFrame(frame);
	}

	window.addEventListener("mousemove", (e) => {
		mouseX = e.clientX / window.innerWidth;
		mouseY = e.clientY / window.innerHeight;
	}, { passive: true });

	window.addEventListener("resize", resize, { passive: true });

	resize();
	rafId = requestAnimationFrame(frame);

	window.bgAnim = {
		stop() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } },
		start() { if (!rafId && !(typeof inGame !== 'undefined' && inGame)) rafId = requestAnimationFrame(frame); },
	};
})();

nameInput.style.cssText = `
    width: 300px;
    height: 50px;
    border: 1px solid rgba(139,92,246,0.3);
    border-radius: 10px;
    background: rgba(15,10,30,0.6);
    color: #fff;
    font-size: 16px;
    font-family: 'Inter', 'Lilita One', sans-serif;
    padding: 0 16px;
    margin: 0;
    outline: none;
    box-sizing: border-box;
    backdrop-filter: blur(8px);
    transition: border-color 0.2s, box-shadow 0.2s;
    display: flex;
    align-items: center;
`;
nameInput.placeholder = "Enter Username";
enterGameButton.style.cssText = `
    width: 95px;
    height: 50px;
    margin-left: 12px;
    border-radius: 10px;
    box-sizing: border-box;
    `;
enterGameButton.innerHTML = "Play!";
promoImageHolder &&
	(promoImageHolder.style.cssText += `
        width: auto;
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgba(0, 0, 0, 0);
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0px 4px 15px rgba(0, 0, 0, 0);
        margin-bottom: 20px;
        `);
setupCard.style.cssText += `
        background: rgba(15, 10, 30, 0.55);
        backdrop-filter: blur(18px) saturate(160%);
        -webkit-backdrop-filter: blur(18px) saturate(160%);
        box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06);
        border: 1px solid rgba(139,92,246,0.15);
        display: flex;
        flex-direction: row;
        gap: 12px;
        width: auto;
        height: auto;
        padding: 10px 20px;
        border-radius: 16px;
        margin-bottom: 25px;
        margin-left: 0;
        align-items: center;
        justify-content: center;
        `;

gameName.style.cssText = `
        font-size: 170px;
        margin-bottom: 30px;
        font-family: 'Lilita One', sans-serif;
        background: linear-gradient(135deg, #a78bfa 0%, #6366f1 40%, #38bdf8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        text-shadow: none;
        filter: drop-shadow(0 4px 12px rgba(99,102,241,0.3));
        animation: gameTitlePulse 4s ease-in-out infinite;
        opacity: 0;
        transition: opacity 0.5s ease;
        `;
workerSetTimeout(() => {
	gameName.style.opacity = "1";
	setupCard.style.opacity = "1";
	guideCard.style.opacity = "1";
	promoImageHolder && (promoImageHolder.style.opacity = "1");
	serverMenu.style.opacity = "1";
}, 2000);
document.getElementById("loadingText").innerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>

        .progress-container {
            top: 80%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.5);
            width: 75%;
            background-color: gray;
            border-radius: 25px;
            overflow: hidden;
            height: 90px;
            position: relative;
        }
        .progress-bar {
            width: 0%;
            margin-top: 5px;
            margin-left: 5px;
            height: 80%;
            background-color: #fff;
            border-radius: 25px;
            animation: loading 1.2s linear forwards;
            position: relative;
        }
        @keyframes loading {
            from { width: 0%; }
            to { width: 100%; }
        }
        .progress-text {
            position: absolute;
            top: 50%;
            font-size: 50px;
            left: 50%;
            transform: translate(-50%, -50%);
            color: black;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="progress-container">
        <div class="progress-bar">
            <div class="progress-text" id="progressText">Loading...</div>
        </div>
    </div>
</body>
</html>
    `;

let newFont = document.createElement("link");
newFont.rel = "stylesheet";
newFont.href = "https://fonts.googleapis.com/css?family=Ubuntu:700";
newFont.type = "text/css";
document.body.append(newFont);

window.oncontextmenu = function () {
	return false;
};

// VISUAL:
config.anotherVisual = false;
config.useWebGl = false;
config.resetRender = false;

// STORAGE:
let canStore = typeof Storage !== "undefined";
function saveVal(name, val) {
	if (canStore) localStorage.setItem(name, val);
}
function deleteVal(name) {
	if (canStore) localStorage.removeItem(name);
}
function getSavedVal(name) {
	if (canStore) return localStorage.getItem(name);
	return null;
}

function loadToggle(id, def = false) {
	const v = localStorage.getItem("feature:" + id);
	return v === null ? def : v === "1";
}
function saveToggle(id, val) {
	localStorage.setItem("feature:" + id, val ? "1" : "0");
}
function loadSliderValue(id, def = 0) {
	const v = localStorage.getItem("slider:" + id);
	return v === null ? def : parseFloat(v);
}
function saveSliderValue(id, val) {
	localStorage.setItem("slider:" + id, val);
}

class HtmlAction {
	constructor(element) {
		this.element = element;
	}
	add(code) {
		if (!this.element) return undefined;
		this.element.innerHTML += code;
	}
	newLine(amount) {
		let result = `<br>`;
		if (amount > 0) {
			result = ``;
			for (let i = 0; i < amount; i++) {
				result += `<br>`;
			}
		}
		this.add(result);
	}
	checkBox(setting) {
		let newCheck = `<input type = "checkbox"`;
		setting.id && (newCheck += ` id = ${setting.id}`);
		setting.style &&
			(newCheck += ` style = ${setting.style.replaceAll(" ", "")}`);
		setting.class && (newCheck += ` class = ${setting.class}`);
		setting.checked && (newCheck += ` checked`);
		setting.onclick && (newCheck += ` onclick = ${setting.onclick}`);
		newCheck += `>`;
		this.add(newCheck);
	}
	text(setting) {
		let newText = `<input type = "text"`;
		setting.id && (newText += ` id = ${setting.id}`);
		setting.style &&
			(newText += ` style = ${setting.style.replaceAll(" ", "")}`);
		setting.class && (newText += ` class = ${setting.class}`);
		setting.size && (newText += ` size = ${setting.size}`);
		setting.maxLength && (newText += ` maxLength = ${setting.maxLength}`);
		setting.value && (newText += ` value = ${setting.value}`);
		setting.placeHolder &&
			(newText += ` placeHolder = ${setting.placeHolder.replaceAll(" ", "&nbsp;")}`);
		newText += `>`;
		this.add(newText);
	}
	select(setting) {
		let newSelect = `<select`;
		setting.id && (newSelect += ` id = ${setting.id}`);
		setting.style &&
			(newSelect += ` style = ${setting.style.replaceAll(" ", "")}`);
		setting.class && (newSelect += ` class = ${setting.class}`);
		newSelect += `>`;
		for (let options in setting.option) {
			newSelect += `<option value = ${setting.option[options].id}`;
			setting.option[options].selected && (newSelect += ` selected`);
			newSelect += `>${options}</option>`;
		}
		newSelect += `</select>`;
		this.add(newSelect);
	}
	button(setting) {
		let newButton = `<button`;
		setting.id && (newButton += ` id = ${setting.id}`);
		setting.style &&
			(newButton += ` style = ${setting.style.replaceAll(" ", "")}`);
		setting.class && (newButton += ` class = ${setting.class}`);
		setting.onclick && (newButton += ` onclick = ${setting.onclick}`);
		newButton += `>`;
		setting.innerHTML && (newButton += setting.innerHTML);
		newButton += `</button>`;
		this.add(newButton);
	}
	selectMenu(setting) {
		let newSelect = `<select`;
		if (!setting.id) {
			alert("please put id skid");
			return;
		}
		window[setting.id + "Func"] = function () { };
		setting.id && (newSelect += ` id = ${setting.id}`);
		setting.style &&
			(newSelect += ` style = ${setting.style.replaceAll(" ", "")}`);
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
			window[options + "Func"] = function () {
				setting.menu[options] = getEl("check_" + options).checked
					? true
					: false;
				saveVal(options, setting.menu[options]);

				getEl("O_" + options).style.color = setting.menu[options]
					? "#000"
					: "#fff";
				getEl("O_" + options).style.background = setting.menu[options]
					? "#8ecc51"
					: "#cc5151";

				//getEl(setting.id).style.color = setting.menu[options] ? "#8ecc51" : "#cc5151";
			};
			this.checkBox({
				id: "check_" + options,
				style: `display: ${i == 0 ? "inline-block" : "none"};`,
				class: "checkB",
				onclick: `window.${options + "Func"}()`,
				checked: setting.menu[options],
			});
			i++;
		}

		last = "check_" + getEl(setting.id).value.split("_")[1];
		window[setting.id + "Func"] = function () {
			getEl(last).style.display = "none";
			last = "check_" + getEl(setting.id).value.split("_")[1];
			getEl(last).style.display = "inline-block";

			//getEl(setting.id).style.color = setting.menu[last.split("_")[1]] ? "#8ecc51" : "#fff";
		};
	}
}
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
	}
	set(id) {
		this.element = getEl(id);
		this.action = new HtmlAction(this.element);
	}
	resetHTML(text) {
		if (text) {
			this.element.innerHTML = ``;
		} else {
			this.element.innerHTML = ``;
		}
	}
	setStyle(style) {
		this.element.style = style;
	}
	setCSS(style) {
		this.action.add(`<style>` + style + `</style>`);
	}
}

class UI {
	constructor() {
		this.content = "";
	}

	append(html) {
		this.content += html;
	}

	Text(text, size = "16px", color = "white") {
		this.append(
			`<span style="font-size: ${size}; color: ${color};">${text}</span>`,
		);
	}

	newLine(num = 1) {
		this.append("<br>".repeat(num));
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
			styleElement = document.createElement("style");
			styleElement.id = id;
			document.head.appendChild(styleElement);
		}
		styleElement.textContent = style;
	}

	BoxF(name, description, id, config = {}) {
		const checkedStatus = localStorage.getItem(id) === "true";
		const hasOptions = config.option && config.options;

		const iconMap = [
			[/place|build|wall|spike|trap|mill|turret/i, 'construction'],
			[/break|destroy/i, 'hardware'],
			[/auto|bot|ai|play/i, 'smart_toy'],
			[/shield|defend|anti|safe|protect|counter/i, 'shield'],
			[/buy|hat|gear|equip/i, 'shopping_bag'],
			[/sync|tick|insta|hit/i, 'bolt'],
			[/push|knock|kb/i, 'open_with'],
			[/walk|move|path/i, 'directions_walk'],
			[/render|visual|show|dir|camera/i, 'visibility'],
			[/chat|kill|msg/i, 'chat'],
			[/respawn|heal|health/i, 'favorite'],
			[/follow|target/i, 'gps_fixed'],
			[/animal|trap animal/i, 'pets'],
			[/ping|map/i, 'location_on'],
			[/grind|xp|weapon/i, 'military_tech'],
			[/flipper|water/i, 'pool'],
			[/accept|party/i, 'group'],
			[/song|music/i, 'music_note'],
			[/proj|dodge/i, 'track_changes'],
		];
		let icon = 'tune';
		for (const [re, ic] of iconMap) { if (re.test(name)) { icon = ic; break; } }

		const subId = `${id}-sub`;

		// Build custom dropdown HTML (no native <select>)
		const optHtml = hasOptions ? (() => {
			const entries = Object.entries(config.options);
			const stored = localStorage.getItem(`${id}-selected`);
			const initial = entries.find(([, o]) => o.id === stored) || entries.find(([, o]) => o.selected) || entries[0];
			const initialLabel = initial ? initial[0] : '';
			const initialVal = initial ? initial[1].id : '';
			return `
      <div id="${subId}" class="opt-sub">
        <div class="opt-sub-inner">
          <div class="opt-sub-label">Mode</div>
          <div class="opt-custom-dd" id="${id}-dd" data-value="${initialVal}">
            <div class="opt-dd-display">
              <span class="opt-dd-label">${initialLabel}</span>
              <span class="opt-dd-arrow material-icons">expand_more</span>
            </div>
            <div class="opt-dd-list">
              ${entries.map(([n, o]) => `<div class="opt-dd-item${o.id === initialVal ? ' selected' : ''}" data-value="${o.id}">${n}</div>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
		})() : '';

		const chevronHtml = hasOptions
			? `<div class="opt-chevron" data-sub="${subId}">›</div>`
			: '';

		const rowHtml = `
    <div id="${id}" class="opt-row">
      <div class="opt-icon"><span class="material-icons">${icon}</span></div>
      <div class="opt-text">
        <div class="opt-name">${name}</div>
        <div class="opt-desc">${description}</div>
      </div>
      ${chevronHtml}
      <label class="opt-switch">
        <input type="checkbox" ${checkedStatus ? 'checked' : ''} />
        <div class="opt-switch-track"></div>
        <div class="opt-switch-thumb"></div>
      </label>
    </div>
    ${optHtml}
    `;
		this.append(rowHtml);

		workerSetTimeout(() => {
			const row = document.getElementById(id);
			if (!row) return;
			const checkbox = row.querySelector('input[type="checkbox"]');
			if (checkbox) {
				configs[id] = checkedStatus;
				checkbox.addEventListener('change', (e) => {
					localStorage.setItem(id, e.target.checked);
					configs[id] = e.target.checked;
				});
			}
			if (hasOptions) {
				const chevron = row.querySelector('.opt-chevron');
				const sub = document.getElementById(subId);
				if (chevron && sub) {
					chevron.addEventListener('click', () => {
						const isOpen = sub.classList.toggle('open');
						chevron.classList.toggle('open', isOpen);
						row.style.borderRadius = isOpen ? '14px 14px 0 0' : '';
					});
				}
				// Custom dropdown logic
				const dd = document.getElementById(`${id}-dd`);
				if (dd) {
					const display = dd.querySelector('.opt-dd-display');
					const list = dd.querySelector('.opt-dd-list');
					const labelEl = dd.querySelector('.opt-dd-label');
					const arrow = dd.querySelector('.opt-dd-arrow');
					// restore stored
					const stored = localStorage.getItem(`${id}-selected`);
					if (stored) {
						const item = list.querySelector(`[data-value="${stored}"]`);
						if (item) { labelEl.textContent = item.textContent; dd.dataset.value = stored; options[id] = stored; }
					} else {
						options[id] = dd.dataset.value;
					}
					const closeDD = () => {
						dd.classList.remove('open');
						arrow.style.transform = '';
						list.style.maxHeight = '0';
						list.style.opacity = '0';
						list.style.pointerEvents = 'none';
					};
					display.addEventListener('click', (e) => {
						e.stopPropagation();
						const isOpen = dd.classList.toggle('open');
						arrow.style.transform = isOpen ? 'rotate(180deg)' : '';
						if (isOpen) {
							if (list.parentElement !== dd) {
								dd.appendChild(list);
							}
							list.style.position = 'absolute';
							list.style.top = '100%';
							list.style.left = '0';
							list.style.width = '100%';
							list.style.maxHeight = '240px';
							list.style.opacity = '1';
							list.style.pointerEvents = 'auto';
							list.style.overflowY = 'auto';
							// close others
							document.querySelectorAll('.opt-custom-dd.open').forEach(o => { if (o !== dd) { o.classList.remove('open'); o.querySelector('.opt-dd-arrow').style.transform = ''; } });
						} else {
							list.style.maxHeight = '0';
							list.style.opacity = '0';
							list.style.pointerEvents = 'none';
						}
					});
					list.querySelectorAll('.opt-dd-item').forEach(item => {
						item.addEventListener('click', (e) => {
							e.stopPropagation();
							const val = item.dataset.value;
							labelEl.textContent = item.textContent;
							dd.dataset.value = val;
							list.querySelectorAll('.opt-dd-item').forEach(i => i.classList.toggle('selected', i === item));
							localStorage.setItem(`${id}-selected`, val);
							options[id] = val;
							closeDD();
							arrow.style.transform = '';
						});
					});
					document.addEventListener('click', closeDD);
				}
			}
		}, 100);
	}

	// Hat/Acc picker box, usage: BoxHat(name, desc, id, "hat"|"acc", withToggle?)
	BoxHat(name, description, id, mode = "hat", withToggle = false) {
		const stored = localStorage.getItem(`hatpick-${id}`);
		const initId = stored ? parseInt(stored) : (mode === 'hat' ? 7 : 21);
		const toggleStored = localStorage.getItem(`hattoggle-${id}`);
		const initToggle = toggleStored === null ? true : toggleStored === 'true';

		// Animated hat definitions (IDs >= 1000)
		const ANIM_HATS = [
			{ id: 1001, name: "Police Hat" },
			{ id: 1002, name: "Animal Hat" },
		];
		const ANIM_FRAMES = {
			1001: [8, 15],
			1002: [28, 29, 30, 36, 37, 38, 44],
		};

		const rowHtml = `
    <div id="${id}-row" class="opt-row">
      <div class="opt-icon"><span class="material-icons">checkroom</span></div>
      <div class="opt-text">
        <div class="opt-name">${name}</div>
        <div class="opt-desc">${description}</div>
      </div>
      ${withToggle ? `<label class="opt-switch" id="${id}-toggle-wrap">
        <input type="checkbox" id="${id}-toggle" ${initToggle ? 'checked' : ''}>
        <div class="opt-switch-track"></div>
        <div class="opt-switch-thumb"></div>
      </label>` : ''}
      <button class="hat-picker-btn" id="${id}-hpbtn">
        <img id="${id}-hpimg" src="https://moomoo.io/img/hats/hat_${initId}.png" onerror="this.src='';this.style.display='none'">
        <span class="hat-picker-btn-name" id="${id}-hpname">—</span>
      </button>
    </div>`;
		this.append(rowHtml);

		workerSetTimeout(() => {
			const btn = document.getElementById(`${id}-hpbtn`);
			const img = document.getElementById(`${id}-hpimg`);
			const nameEl = document.getElementById(`${id}-hpname`);
			if (!btn) return;

			// Animated hat frame counter
			let animFrame = 0;
			let animInterval = null;

			const hatUrl = (hid) => `https://moomoo.io/img/hats/hat_${hid}${[11, 14, 53].includes(hid) ? '_p' : ''}.png`;

			const getBaseList = () => mode === 'hat' ? (window.hats || store?.hats || []) : (window.accessories || store?.accessories || []);
			const getList = () => mode === 'hat' ? [...getBaseList(), ...ANIM_HATS] : getBaseList();

			const getImg = (hid, frame = 0) => {
				if (hid >= 1000 && ANIM_FRAMES[hid]) {
					const frames = ANIM_FRAMES[hid];
					return hatUrl(frames[frame % frames.length]);
				}
				return hatUrl(hid);
			};

			const stopAnim = () => { clearInterval(animInterval); animInterval = null; };
			const startAnim = (hid) => {
				stopAnim();
				if (hid >= 1000 && ANIM_FRAMES[hid]) {
					animFrame = 0;
					animInterval = setInterval(() => {
						animFrame++;
						img.src = getImg(hid, animFrame);
					}, 500);
				}
			};

			const setVal = (hid, doSave = true) => {
				const list = getList();
				const entry = list.find(h => h.id === hid);
				img.src = getImg(hid, 0);
				img.style.display = '';
				nameEl.textContent = entry ? entry.name : '—';
				if (doSave) localStorage.setItem(`hatpick-${id}`, hid);
				window[`hatpick_${id}`] = hid;
				startAnim(hid);
			};
			setVal(initId, false);

			// Toggle wiring
			if (withToggle) {
				const toggleEl = document.getElementById(`${id}-toggle`);
				if (toggleEl) {
					window[`hattoggle_${id}`] = initToggle;
					toggleEl.addEventListener('change', () => {
						window[`hattoggle_${id}`] = toggleEl.checked;
						localStorage.setItem(`hattoggle-${id}`, toggleEl.checked);
					});
				}
			}

			btn.addEventListener('click', () => {
				const list = getList();
				const cur = window[`hatpick_${id}`] ?? initId;

				const modal = document.createElement('div');
				modal.className = 'hat-picker-modal';
				modal.innerHTML = `
          <div class="hat-picker-panel">
            <div class="hat-picker-header">
              <span class="hat-picker-title">${name}</span>
              <span class="hat-picker-close">&times;</span>
            </div>
            <div class="hat-picker-grid" id="${id}-hpgrid"></div>
          </div>`;
				document.body.appendChild(modal);

				const grid = modal.querySelector(`#${id}-hpgrid`);

				// Animate cards for animated hats
				const cardAnims = new Map();
				const renderGrid = (items) => {
					grid.innerHTML = items.map(h => `
            <div class="hat-card${h.id === cur ? ' active' : ''}" data-id="${h.id}">
              <img id="${id}-card-${h.id}" src="${getImg(h.id, 0)}" onerror="this.style.display='none'">
              <div class="hat-card-name">${h.name}</div>
            </div>`).join('');

					// Start card animations for animated hats
					items.forEach(h => {
						if (h.id >= 1000 && ANIM_FRAMES[h.id]) {
							let f = 0;
							const iv = setInterval(() => {
								f++;
								const el = document.getElementById(`${id}-card-${h.id}`);
								if (el) el.src = getImg(h.id, f);
							}, 500);
							cardAnims.set(h.id, iv);
						}
					});

					grid.querySelectorAll('.hat-card').forEach(card => {
						card.addEventListener('click', () => {
							setVal(parseInt(card.dataset.id));
							closeModal();
						});
					});
				};

				const closeModal = () => {
					cardAnims.forEach(iv => clearInterval(iv));
					cardAnims.clear();
					modal.classList.remove('open');
					setTimeout(() => modal.remove(), 350);
				};

				if (list.length || ANIM_HATS.length) {
					renderGrid(list.length ? list : ANIM_HATS);
				} else {
					grid.innerHTML = `<div style="color:rgba(255,255,255,0.4);padding:20px;text-align:center;font-family:Inter,sans-serif;font-size:13px;">No items found — join a game first</div>`;
				}

				modal.querySelector('.hat-picker-close').addEventListener('click', closeModal);
				modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
				requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('open')));
			});
		}, 150);
	}

	renderDropdown(options) {
		let dropdownHtml = '<select class="dropdown-menu">';
		for (const [optionName, optionConfig] of Object.entries(options)) {
			const selected = optionConfig.selected ? "selected" : "";
			dropdownHtml += `<option value="${optionConfig.id}" ${selected}>${optionName}</option>`;
		}
		dropdownHtml += "</select>";
		return dropdownHtml;
	}

	initializeDropdown(boxId, options) {
		const dropdown = document.querySelector(`#${boxId} .dropdown-menu`);
		if (dropdown) {
			dropdown.addEventListener("change", (event) => {
				const selectedOption = event.target.value;
				for (const [name, config] of Object.entries(options)) {
					config.selected = config.id === selectedOption;
					localStorage.setItem(config.id, config.selected);
				}
			});
			Object.entries(options).forEach(([name, config]) => {
				const storedSelected = localStorage.getItem(config.id) === "true";
				config.selected = storedSelected;

				const optionElement = dropdown.querySelector(
					`option[value="${config.id}"]`,
				);
				if (optionElement) {
					optionElement.selected = storedSelected;
				}
			});
		}
	}
}

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
                to {opacity: 0.45;}
            }
            @keyframes night2 {
                from {opacity: 0.45;}
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
            display: none;
            `);
HTML.resetHTML();
HTML.setCSS(`
        .leaderboardItem {
    float: left;
    display: inline-block;
    font-size: 13px;
    text-align: center;
    max-width: max-content;
    position: relative;
    left: 50%;
    transform: translateX(-50%);
    text-shadow: -1.1px -1.1px 0 #000, 1.1px -1.1px 0 #000, -1.1px 1.1px 0 #000, 1.1px 1.1px 0 #000;
    font-family: Ubuntu, sans-serif;
    margin-top: 1.2px;
}

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
            .Cselect {
                -webkit-border-radius: 4px;
                -moz-border-radius: 4px;
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
                -webkit-border-radius: 4px;
                -moz-border-radius: 4px;
                border-radius: 4px;
            }
            ::-webkit-scrollbar-thumb:active {
                background-color: rgb(230, 230, 230);
            }
            `);

let menuuss = document.createElement("div");
menuuss.id = "modmenus";
document.body.appendChild(menuuss);

UI.addStyle("modmenus-styles", `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  @import url('https://fonts.googleapis.com/icon?family=Material+Icons');

  #modmenus {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.95);
    width: 1100px;
    height: 700px;
    background: rgba(8, 8, 16, 0.88);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 22px;
    box-shadow: 0 40px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05);
    font-family: 'Inter', sans-serif;
    color: #fff;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.34,1.4,0.64,1), visibility 0.22s;
  }

  .menu-main-header {
    display: flex;
    align-items: center;
    height: 50px;
    min-height: 50px;
    padding: 0 20px;
    background: linear-gradient(135deg, rgba(20,16,40,0.98) 0%, rgba(10,8,24,0.98) 100%);
    border-bottom: 1px solid rgba(99,102,241,0.15);
    position: relative;
    flex-shrink: 0;
    gap: 10px;
  }

  .menu-main-title {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 3px;
    text-transform: uppercase;
    background: linear-gradient(90deg, #a78bfa, #6366f1, #818cf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: none;
    filter: drop-shadow(0 0 8px rgba(99,102,241,0.4));
  }

  .menu-main-ver {
    font-size: 11px;
    font-weight: 500;
    color: rgba(165,180,252,0.45);
    letter-spacing: 0.5px;
  }

  .menu-main-header .content-close {
    margin-left: auto;
  }

  .menu-main-body {
    display: flex;
    flex-direction: row;
    flex: 1;
    overflow: hidden;
  }

  #modmenus.open  { visibility: visible; opacity: 1; transform: translate(-50%, -50%) scale(1); }
  #modmenus.closed { visibility: hidden; opacity: 0; transform: translate(-50%, -50%) scale(0.95); }

  /* ── Sidebar ── */
  #modmenus-sidebar {
    width: 96px;
    min-width: 96px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 22px 0 16px;
    gap: 6px;
    background: rgba(255,255,255,0.025);
    border-right: 1px solid rgba(255,255,255,0.055);
  }

  .sidebar-logo {
    font-size: 22px;
    color: rgba(255,255,255,0.18);
    margin-bottom: 14px;
  }

  .tab-btn {
    width: 72px;
    height: 66px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 14px;
    color: rgba(255,255,255,0.35);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    transition: all 0.16s ease;
    outline: none;
  }

  .tab-btn .material-icons { font-size: 26px; }
  .tab-btn .tab-label { font-size: 10px; font-weight: 500; letter-spacing: 0.4px; text-transform: uppercase; }

  .tab-btn:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.75); border-color: rgba(255,255,255,0.08); }

  .tab-btn.active {
    background: rgba(99,102,241,0.18);
    color: #a5b4fc;
    border-color: rgba(99,102,241,0.3);
    box-shadow: 0 0 14px rgba(99,102,241,0.18);
  }

  /* ── Content ── */
  #modmenus-content { flex: 1; height: 100%; display: flex; flex-direction: column; overflow: hidden; }

  .content-header {
    padding: 20px 28px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.055);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .content-title { font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.85); letter-spacing: 0.3px; }

  .content-close {
    width: 32px; height: 32px;
    border-radius: 9px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.4);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px;
    transition: all 0.14s ease;
  }
  .content-close:hover { background: rgba(239,68,68,0.18); color: #fca5a5; border-color: rgba(239,68,68,0.25); }

  .content-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 18px 24px;
    scrollbar-width: thin;
    scrollbar-color: rgba(139,92,246,0.45) rgba(255,255,255,0.03);
  }
  .content-scroll::-webkit-scrollbar { width: 6px; }
  .content-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 3px; }
  .content-scroll::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.45); border-radius: 3px; }
  .content-scroll::-webkit-scrollbar-thumb:hover { background: rgba(139,92,246,0.65); }

  .content-scroll-wrap {
    flex: 1;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Search ── */
  .search-bar { margin-bottom: 16px; }
  .search-input {
    width: 100%; height: 42px;
    box-sizing: border-box;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 11px;
    color: #fff;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    padding: 0 16px;
    outline: none;
    transition: all 0.14s ease;
  }
  .search-input::placeholder { color: rgba(255,255,255,0.2); }
  .search-input:focus { border-color: rgba(99,102,241,0.35); background: rgba(99,102,241,0.05); box-shadow: 0 0 0 3px rgba(99,102,241,0.08); }

  /* ── Tab ── */
  .tab-content { display: none; }
  .tab-content.active { display: block; animation: fadeUp 0.18s ease; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  @keyframes gameTitlePulse { 0%,100% { filter: drop-shadow(0 4px 12px rgba(99,102,241,0.3)); } 50% { filter: drop-shadow(0 4px 20px rgba(139,92,246,0.5)); } }

  /* ── Option row ── */
  .opt-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 18px;
    margin-bottom: 7px;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.055);
    border-radius: 14px;
    transition: background 0.14s, border-color 0.14s;
    cursor: default;
  }
  .opt-row:hover { background: rgba(255,255,255,0.045); border-color: rgba(255,255,255,0.09); }

  .opt-icon {
    width: 44px; height: 44px;
    border-radius: 12px;
    background: rgba(99,102,241,0.12);
    border: 1px solid rgba(99,102,241,0.18);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    color: #a5b4fc;
    font-size: 22px;
  }

  .opt-text { flex: 1; min-width: 0; }
  .opt-name { font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.88); line-height: 1.2; }
  .opt-desc { font-size: 12px; color: rgba(255,255,255,0.32); margin-top: 3px; line-height: 1.4; }

  /* ── Toggle switch ── */
  .opt-switch {
    position: relative;
    width: 50px; height: 28px;
    flex-shrink: 0;
    cursor: pointer;
  }
  .opt-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
  .opt-switch-track {
    position: absolute;
    inset: 0;
    border-radius: 14px;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.1);
    transition: background 0.2s, border-color 0.2s;
  }
  .opt-switch-thumb {
    position: absolute;
    top: 4px; left: 4px;
    width: 18px; height: 18px;
    border-radius: 50%;
    background: rgba(255,255,255,0.5);
    transition: transform 0.2s cubic-bezier(0.34,1.4,0.64,1), background 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
  }
  .opt-switch input:checked ~ .opt-switch-track { background: rgba(99,102,241,0.7); border-color: rgba(99,102,241,0.5); }
  .opt-switch input:checked ~ .opt-switch-thumb { transform: translateX(22px); background: #fff; }

  /* ── Expand chevron ── */
  .opt-chevron {
    width: 30px; height: 30px;
    border-radius: 8px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.35);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    font-size: 17px;
    transition: all 0.15s ease;
    user-select: none;
  }
  .opt-chevron:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }
  .opt-chevron.open { color: #a5b4fc; border-color: rgba(99,102,241,0.3); background: rgba(99,102,241,0.1); transform: rotate(90deg); }

  /* ── Sub-options panel ── */
  .opt-sub {
    display: grid;
    grid-template-rows: 0fr;
    margin-top: -7px;
    margin-bottom: 0;
    background: rgba(14, 14, 28, 0.75);
    border: 1px solid rgba(99,102,241,0.18);
    border-top: none;
    border-radius: 0 0 14px 14px;
    overflow: visible;
    transition: grid-template-rows 0.28s cubic-bezier(0.4,0,0.2,1),
                margin-bottom 0.28s cubic-bezier(0.4,0,0.2,1),
                opacity 0.22s ease;
    opacity: 0;
    pointer-events: none;
  }
  .opt-sub > * { min-height: 0; }
  .opt-sub.open {
    grid-template-rows: 1fr;
    margin-bottom: 7px;
    opacity: 1;
    pointer-events: auto;
  }
  .opt-sub-inner {
    padding: 12px 18px 14px 78px;
    overflow: visible;
  }
  .opt-sub-label { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(165,180,252,0.5); margin-bottom: 8px; }

  /* ── Custom dropdown ── */
  .opt-custom-dd {
    position: relative;
    user-select: none;
  }
  .opt-dd-display {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 40px;
    padding: 0 14px;
    background: rgba(10,10,24,0.8);
    border: 1px solid rgba(99,102,241,0.25);
    border-radius: 10px;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  }
  .opt-dd-display:hover { border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.08); }
  .opt-custom-dd.open .opt-dd-display { border-color: rgba(99,102,241,0.7); box-shadow: 0 0 0 3px rgba(99,102,241,0.12); border-radius: 10px 10px 0 0; }
  .opt-dd-label { font-size: 13px; color: #c7d2fe; font-family: 'Inter', sans-serif; font-weight: 500; }
  .opt-dd-arrow { font-size: 18px; color: #a5b4fc; transition: transform 0.22s cubic-bezier(0.4,0,0.2,1); }
  .opt-dd-list {
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    background: rgba(10,10,24,0.97);
    border: 1px solid rgba(99,102,241,0.3);
    border-radius: 10px;
    overflow: hidden;
    max-height: 0;
    opacity: 0;
    pointer-events: none;
    transition: max-height 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease;
    z-index: 999999;
    box-shadow: 0 12px 28px rgba(0,0,0,0.7);
  }
  .opt-custom-dd.open .opt-dd-list { max-height: 240px; opacity: 1; pointer-events: auto; overflow-y: auto; }
  .opt-dd-item {
    padding: 11px 14px;
    font-size: 13px;
    color: rgba(255,255,255,0.75);
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    border-left: 3px solid transparent;
    transition: background 0.14s, color 0.14s, border-color 0.14s;
  }
  .opt-dd-item:hover { background: rgba(99,102,241,0.1); color: #c7d2fe; border-left-color: rgba(99,102,241,0.4); }
  .opt-dd-item.selected { background: rgba(99,102,241,0.15); color: #a5b4fc; border-left-color: #6366f1; font-weight: 600; }
  .opt-dd-list::-webkit-scrollbar { width: 4px; }
  .opt-dd-list::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.4); border-radius: 2px; }

  /* ── Hat picker modal ── */
  .hat-picker-modal {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(6px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
    z-index: 100000;
  }
  .hat-picker-modal.open { opacity: 1; pointer-events: auto; }
  .hat-picker-panel {
    width: min(560px, 92vw);
    max-height: 72vh;
    display: flex;
    flex-direction: column;
    border-radius: 18px;
    background: rgba(8,8,20,0.97);
    border: 1px solid rgba(99,102,241,0.2);
    box-shadow: 0 28px 60px rgba(0,0,0,0.85);
    overflow: hidden;
    opacity: 0;
    transform: translateY(18px) scale(0.97);
    transition: opacity 0.3s ease, transform 0.35s cubic-bezier(0.34,1.2,0.64,1);
  }
  .hat-picker-modal.open .hat-picker-panel { opacity: 1; transform: translateY(0) scale(1); }
  .hat-picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(99,102,241,0.06);
    flex-shrink: 0;
  }
  .hat-picker-title { font-size: 14px; font-weight: 700; color: #a5b4fc; letter-spacing: 0.2px; font-family: 'Inter', sans-serif; }
  .hat-picker-close { font-size: 22px; color: rgba(255,255,255,0.5); cursor: pointer; line-height: 1; transition: color 0.15s, transform 0.15s; padding: 0 2px; }
  .hat-picker-close:hover { color: #fca5a5; transform: scale(1.2); }
  .hat-picker-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 8px;
    padding: 14px;
    overflow-y: auto;
    flex: 1;
    align-content: start;
  }
  .hat-picker-grid::-webkit-scrollbar { width: 4px; }
  .hat-picker-grid::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.4); border-radius: 2px; }
  .hat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 10px 6px 8px;
    border-radius: 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    cursor: pointer;
    transition: background 0.18s, border-color 0.18s, transform 0.2s;
    gap: 6px;
  }
  .hat-card:hover { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.35); transform: translateY(-2px); }
  .hat-card.active { background: rgba(99,102,241,0.18); border-color: #6366f1; box-shadow: inset 0 0 14px rgba(99,102,241,0.2); }
  .hat-card img { width: 44px; height: 44px; image-rendering: pixelated; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6)); }
  .hat-card-name { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.65); text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'Inter', sans-serif; }

  /* Hat picker trigger button */
  .hat-picker-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: rgba(10,10,24,0.8);
    border: 1px solid rgba(99,102,241,0.25);
    border-radius: 10px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    min-width: 160px;
  }
  .hat-picker-btn:hover { border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.08); box-shadow: 0 0 0 3px rgba(99,102,241,0.08); }
  .hat-picker-btn img { width: 28px; height: 28px; image-rendering: pixelated; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); flex-shrink: 0; }
  .hat-picker-btn-name { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px; font-family: 'Inter', sans-serif; }

  .tab-content > span { display: none; }

  /* ── Keybind list ── */
  .keybind-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px 0;
  }
  .keybind-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 13px 18px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px;
    transition: background 0.15s;
  }
  .keybind-row:hover { background: rgba(255,255,255,0.07); }
  .keybind-action {
    font-size: 14px;
    color: rgba(255,255,255,0.85);
    font-family: 'Inter', sans-serif;
  }
  kbd.keybind-key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 46px;
    padding: 6px 14px;
    background: rgba(99,102,241,0.15);
    border: 1px solid rgba(99,102,241,0.35);
    border-radius: 9px;
    color: #a5b4fc;
    font-size: 13px;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    user-select: none;
  }
  kbd.keybind-key:hover { background: rgba(99,102,241,0.28); border-color: rgba(99,102,241,0.6); }
  kbd.keybind-key.listening {
    background: rgba(239,68,68,0.2);
    border-color: rgba(239,68,68,0.6);
    color: #fca5a5;
    animation: keybindPulse 0.8s ease infinite;
  }
  @keyframes keybindPulse {
    0%,100% { opacity: 1; } 50% { opacity: 0.5; }
  }
  .keybind-hint {
    font-size: 12px;
    color: rgba(255,255,255,0.3);
    text-align: center;
    margin-top: 10px;
    font-family: 'Inter', sans-serif;
  }
  .keybind-row.keybind-fixed { opacity: 0.55; }
  .keybind-fixed-key { cursor: default !important; }
  .keybind-fixed-key:hover { background: rgba(99,102,241,0.15) !important; border-color: rgba(99,102,241,0.35) !important; }
`);

UI.addStyle("checkbox-styles", ``);
UI.addStyle("checkbox-styles", ``);

UI.addStyle("rec-styles", `
  /* ── Recording Tab ── */
  .rec-section { margin-bottom: 12px; }
  .rec-section-title {
    font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px;
    color: rgba(255,255,255,0.35); margin-bottom: 6px; padding-left: 2px;
  }
  .rec-row {
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px; padding: 7px 10px; margin-bottom: 4px; min-height: 30px;
  }
  .rec-row-label { font-size: 11px; color: rgba(255,255,255,0.7); }
  .rec-select {
    background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1);
    color: #ddd; padding: 4px 8px; border-radius: 6px; font-size: 10px;
    cursor: pointer; min-width: 90px; text-align: right; outline: none;
  }
  .rec-select option { background: #1a1a2e; color: #ddd; }
  .rec-btn-row { display: flex; gap: 6px; margin-bottom: 6px; }
  .rec-btn {
    flex: 1; padding: 7px; border: none; border-radius: 6px; cursor: pointer;
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;
    transition: all 0.2s; color: #fff;
  }
  .rec-btn-start {
    background: rgba(99,102,241,0.25); border: 1px solid rgba(99,102,241,0.4);
  }
  .rec-btn-start:hover { background: rgba(99,102,241,0.4); }
  .rec-btn-start.recording {
    background: rgba(239,68,68,0.3); border-color: rgba(239,68,68,0.5);
    animation: recPulseBtn 1.5s infinite;
  }
  .rec-btn-stop {
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  }
  .rec-btn-stop:hover { background: rgba(255,255,255,0.12); }
  @keyframes recPulseBtn {
    0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
    50% { box-shadow: 0 0 12px 2px rgba(239,68,68,0.3); }
  }
  .rec-status {
    text-align: center; font-size: 10px; color: rgba(255,255,255,0.4);
    margin-bottom: 8px; min-height: 14px;
  }
  .rec-status.active { color: #ef4444; font-weight: 600; }
  .rec-slider-wrap { width: 100%; }
  .rec-slider-header { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .rec-slider-val { font-size: 10px; color: #fff; }
  .rec-slider {
    -webkit-appearance: none; width: 100%; height: 4px; border-radius: 4px;
    background: #333; outline: none; margin: 0; border: none;
  }
  .rec-slider::-webkit-slider-thumb {
    -webkit-appearance: none; height: 14px; width: 14px; border-radius: 50%;
    background: #6366f1; cursor: pointer; border: none; box-shadow: 0 0 6px rgba(99,102,241,0.5);
    margin-top: -5px;
  }
  .rec-switch { position: relative; width: 32px; height: 16px; display: inline-block; }
  .rec-switch input { opacity: 0; width: 0; height: 0; }
  .rec-switch-slider {
    position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
    background: #333; transition: 0.3s; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);
  }
  .rec-switch-slider:before {
    position: absolute; content: ""; height: 12px; width: 12px; left: 1px; bottom: 1px;
    background: #888; transition: 0.3s; border-radius: 50%;
  }
  .rec-switch input:checked + .rec-switch-slider { background: #6366f1; }
  .rec-switch input:checked + .rec-switch-slider:before { transform: translateX(16px); background: #fff; }

  /* Recordings list */
  .rec-list { display: flex; flex-direction: column; gap: 4px; }
  .rec-item {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;
  }
  .rec-item-info { display: flex; flex-direction: column; gap: 1px; }
  .rec-item-name { font-size: 11px; color: #fff; font-weight: 600; }
  .rec-item-meta { font-size: 9px; color: rgba(255,255,255,0.4); }
  .rec-item-actions { display: flex; gap: 4px; }
  .rec-item-btn {
    padding: 4px 10px; border: none; border-radius: 5px; font-size: 9px; font-weight: 600;
    cursor: pointer; transition: 0.2s; text-transform: uppercase;
  }
  .rec-item-btn.preview { background: rgba(99,102,241,0.2); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.3); }
  .rec-item-btn.preview:hover { background: rgba(99,102,241,0.35); }
  .rec-item-btn.save { background: rgba(34,197,94,0.15); color: #86efac; border: 1px solid rgba(34,197,94,0.25); }
  .rec-item-btn.save:hover { background: rgba(34,197,94,0.3); }
  .rec-item-btn.del { background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid rgba(239,68,68,0.2); }
  .rec-item-btn.del:hover { background: rgba(239,68,68,0.3); }
  .rec-empty {
    text-align: center; padding: 18px 0; color: rgba(255,255,255,0.25);
    font-size: 10px; font-style: italic;
  }

  /* Preview modal */
  .rec-preview-modal {
    position: fixed; inset: 0; z-index: 1000001; background: rgba(0,0,0,0.85);
    display: flex; align-items: center; justify-content: center;
    animation: recFadeIn 0.2s ease;
  }
  @keyframes recFadeIn { from { opacity: 0; } to { opacity: 1; } }
  .rec-preview-panel {
    background: #141420; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
    overflow: hidden; max-width: 80vw; max-height: 80vh; display: flex; flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,0.8);
  }
  .rec-preview-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 16px; background: rgba(0,0,0,0.3);
  }
  .rec-preview-title { font-size: 13px; color: #fff; font-weight: 600; }
  .rec-preview-close {
    cursor: pointer; font-size: 20px; color: rgba(255,255,255,0.5);
    transition: 0.2s; line-height: 1;
  }
  .rec-preview-close:hover { color: #fff; }
  .rec-preview-panel video {
    max-width: 80vw; max-height: calc(80vh - 50px); outline: none; background: #000;
  }

  /* REC overlay indicator */
  #rec-overlay {
    position: fixed; top: 14px; right: 14px; z-index: 999998;
    display: none; align-items: center; gap: 8px;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
    padding: 6px 14px 6px 10px; border-radius: 20px;
    border: 1px solid rgba(239,68,68,0.3);
    pointer-events: none; user-select: none;
  }
  #rec-overlay.active { display: flex; }
  #rec-overlay-dot {
    width: 10px; height: 10px; border-radius: 50%; background: #ef4444;
    animation: recDotPulse 1s infinite;
  }
  @keyframes recDotPulse {
    0%,100% { opacity: 1; box-shadow: 0 0 4px #ef4444; }
    50% { opacity: 0.4; box-shadow: 0 0 8px #ef4444; }
  }
  #rec-overlay-text { font-size: 11px; font-weight: 700; color: #ef4444; letter-spacing: 1px; }
  #rec-overlay-time { font-size: 11px; color: rgba(255,255,255,0.6); font-family: monospace; }
`);
UI.InnerHtml("modmenus", (ui) => {
	ui.append(`
    <div class="menu-main-header">
      <span class="menu-main-title">ROBOTICS</span>
      <span class="menu-main-ver">v5.5.6</span>
      <div class="content-close" id="menu-close-btn">&times;</div>
    </div>
    <div class="menu-main-body">
      <div id="modmenus-sidebar">
        <span class="sidebar-logo">⬡</span>
        <button class="tab-btn" data-tab="offensive" title="Offense">
          <span class="material-icons">gavel</span>
          <span class="tab-label">Offense</span>
        </button>
        <button class="tab-btn" data-tab="defensive" title="Defense">
          <span class="material-icons">shield</span>
          <span class="tab-label">Defense</span>
        </button>
        <button class="tab-btn" data-tab="render" title="Visual">
          <span class="material-icons">visibility</span>
          <span class="tab-label">Visual</span>
        </button>
        <button class="tab-btn" data-tab="bots" title="Bots">
          <span class="material-icons">smart_toy</span>
          <span class="tab-label">Bots</span>
        </button>
        <button class="tab-btn" data-tab="keybind" title="Keybinds">
          <span class="material-icons">keyboard</span>
          <span class="tab-label">Keys</span>
        </button>
        <button class="tab-btn" data-tab="others" title="Others">
          <span class="material-icons">tune</span>
          <span class="tab-label">More</span>
        </button>
        <button class="tab-btn" data-tab="record" title="Record">
          <span class="material-icons">videocam</span>
          <span class="tab-label">Record</span>
        </button>
      </div>
      <div id="modmenus-content">
        <div class="content-header">
          <span class="content-title">Abyss</span>
        </div>
        <div class="content-scroll-wrap">
          <div class="content-scroll" id="modmenus-scroll"></div>
        </div>
      </div>
    </div>
  `);
});

UI.InnerHtml("modmenus-scroll", (ui) => {
	const addSearchBar = (dc) => {
		dc.append(`
      <div class="search-bar">
        <input type="text" placeholder="Search..." class="search-input" />
      </div>
    `);
	};

	ui.TabContent("offensive", (dc) => {
		addSearchBar(dc);
		dc.BoxF(
			"Auto Placer",
			"Places Item For you such as spike and Traps",
			"autoPlace",
		);
		dc.BoxF("Auto Replacer", "Auto Replace Buildings", "autoReplace");
		dc.BoxF("Preplacer", "Advanced Placing Obj", "autoPrePlace", {
			option: true,
			options: {
				"Spike Tick Type": { id: "spike" },
				"Retrap Type": { id: "retrap", selected: true },
			},
		});
		dc.BoxF(
			"Auto Push",
			"Pushes enemies to spike when they in trap",
			"autoPush",
		);
		dc.BoxF("Reverse Insta", "Always reverse insta", "revInsta");
		dc.BoxF(
			"Spike On Reverse",
			"Place spike when reverse instaing and close to enemy",
			"doSpikeOnReverse",
		);
		dc.BoxF(
			"Auto Play",
			"Pathfinds to nearest enemy. Doesnt really work well",
			"autoPlay",
		);
		dc.BoxF(
			"Zero Frame",
			"Automatically smart one tick the nearest enemy",
			"zeroFrame",
		);
		dc.BoxF(
			"VelTick",
			"Automatically velTick the nearest enemy",
			"velTick",
		);
		dc.BoxF(
			"Spike Tick",
			"Spike and hit together when enemy break out of trap and also syncs with breaking trap to spike sync people",
			"spikeTick",
		);
		dc.BoxF("KB Tick", "Knocks back enemy into spike", "predictTick");
		dc.BoxF(
			"Slow One Tick",
			"Select wall when polearm ticking to slow down",
			"slowOT",
		);
		dc.BoxF("Turret Combat", "Uses turret when spike ticking", "turretCombat");
		dc.newLine(2);
		/* dc.BoxF("Musket Sync", "Sync with players when you have musket", "secondarySync", {
				input: idk make it cut off at 30 characters,
		});*/
		dc.BoxF(
			"Primary Sync",
			"Sync with players using this mod with primary",
			"serverSync",
		);
		dc.BoxF("Shame Grind", "Hit trapped enemy with great hammer + spike gear to gain shame", "shameGrind");
	});

	ui.TabContent("defensive", (dc) => {
		addSearchBar(dc);
		dc.BoxF("Auto buy", "Buys hats and accessories automatically", "autoBuy");
		dc.BoxF("Anti 1 tick", "Forces soldier when detects 1 tick", "anti1tick");
		dc.BoxF(
			"Auto Q on sync",
			"Heals as fast as possible when you may be synced",
			"autoQonSync",
		);
		dc.BoxF(
			"Hammer breaker",
			"Use hammer when breaking",
			"hammerBreakerOptimisation",
		);
		dc.BoxF("Safe Walk", "Avoids spikes", "safeWalk", {
			option: true,
			options: {
				"Move Away": { id: "move", selected: true },
				Stop: { id: "stop" },
			},
		});
		dc.BoxF(
			"Anti Trap",
			"Places traps or spikes behind you when in trap",
			"antiTrap",
		);
		dc.BoxF(
			"Extra Anti Spike Tick",
			"Uses knock back prediction and trap health to soldier and heal too. Must have this to survive better",
			"safeAntiSpikeTick",
		);
		dc.BoxF(
			"Spike Breaker",
			"Auto break enemy spikes in range",
			"breakSpikeSwitch",
		);
		dc.BoxF(
			"Projectile Dodge",
			"Automatically dodges incoming projectiles using escape rectangles",
			"projectileDodge",
		);
		dc.BoxF(
			"Anti Trap",
			"Automatically attempts to escape from traps",
			"antiTrapSwitch",
		);
		dc.BoxF(
			"Obstacle Breaker",
			"Auto break objects near the trap enemy is in",
			"breakAroundSwitch",
		);
		dc.BoxF(
			"Trap Breaker",
			"Auto break enemy traps even if you are not in them",
			"breakTrapSwitch",
		);
		dc.BoxF(
			"Turret type Breaker",
			"Auto break enemy turret/tp/blocked in range",
			"breakTTBSwitch",
		);
		dc.BoxF(
			"Break All",
			"Auto break all buildings. Note: disables avoid ur own buildings breaker",
			"breakAllSwitch",
		);
		dc.BoxF(
			"Counter Insta",
			"Spike gear and hit when enemy hit you",
			"antiBullType",
			{
				option: true,
				options: {
					Predict: { id: "abreload" },
					Always: { id: "abalway", selected: true },
				},
			},
		);
		dc.BoxF(
			"Anti Boost Spike",
			"Places spikes around you when enemy uses boost pads toward you",
			"antiBoost",
		);
	});
	ui.TabContent("render", (dc) => {
		addSearchBar(dc);
		dc.BoxF("Smoother Camera", "Makes camera move slower", "CAmera");
		dc.BoxF("Render Direction", "Shows real direction", "renderDir", {
			option: true,
			options: {
				"When Auto Aim": { id: "attackDir" },
				Always: { id: "alwaysDir" },
				"No Dir": { id: "noDir" },
			},
		});
		dc.BoxF("Render Placers", "Show placing positions", "placeVis");
		dc.BoxF("Render Placer Calculations", "Visualise angle range arcs used by the placer", "placeCalcVis");
		dc.BoxF("Become Florr", "Florr.io", "florr");
		dc.BoxF("KB Prediction", "Show knockback trajectory arrows", "kbVisuals");
	});
	ui.TabContent("bots", (dc) => {
		addSearchBar(dc);
		dc.BoxF("Bot Auto Heal", "Heals bot when it takes damage", "botAutoHeal");
		dc.BoxF("Bot Auto Break", "Bot breaks enemy buildings when trapped", "botAutoBreak");
		dc.BoxF("Bot Obstacle Break", "Bot breaks objects blocking its path", "botObstacleBreak");
		dc.BoxF("Bot Auto Place", "Bot places spikes/traps using AutoPlacer angles", "botAutoPlace");
		dc.BoxF("Bot Auto Hat", "Bot switches hats automatically for combat", "botAutoHat");
		dc.BoxF("Bot Auto Push", "Bot pushes enemies into spikes", "botAutoPushToggle");
		dc.BoxF("Bot Auto Buy", "Bot buys hats and accessories when it has points", "botAutoBuy");
		dc.BoxF("Bot Replacer", "Bot replaces destroyed buildings", "botReplacer");
		dc.BoxF("Bot Sync Hit", "Bot syncs hits with main player", "botSyncHit");
		dc.BoxF("Auto Sync Kill", "Bots + player sync attack when combined dmg can kill", "autoSyncKill");
		dc.BoxF("Bot Anti Insta", "Bot equips soldier when enemy is about to insta", "botAntiInsta");


		dc.BoxF("Bot Loadout", "Select bot weapon and item upgrade path", "botLoadout", {
			option: true,
			options: {
				"Katana Hammer": { id: "KH", selected: true },
				"Polearm Hammer": { id: "PH" },
				"Daggers Hammer": { id: "DH" },
				"Bat Hammer": { id: "BH" },
				"Stick Hammer": { id: "SH" },
				"Sword Musket": { id: "SM" },
				"Polearm Musket": { id: "PM" },
				"Daggers Musket": { id: "DM" },
				"Polearm Bow": { id: "PB" },
				"Polearm Bow Crossbow": { id: "PBC" },
			},
		});
		dc.BoxF("Bot Mode", "Select bot behaviour mode", "botModeToggle", {
			option: true,
			options: {
				"Combat": { id: "combat", selected: true },
				"Circle": { id: "circle" },
				"Follow": { id: "follow" },
				"Mouse Move": { id: "mousemove" },
				"Mills": { id: "mills" },
				"Idle": { id: "idle" },
			},
		});
		dc.BoxF("Bot Preplacer", "Bot preplaces spikes/traps on breakable objects using MoveSim", "botPreplace");
	});
	ui.TabContent("keybind", (dc) => {
		addSearchBar(dc);
		dc.append(`<div class="keybind-list" id="keybind-list">
      <div class="keybind-row"><span class="keybind-action">Auto Mill</span><kbd class="keybind-key" data-action="autoMill" data-key="z">z</kbd></div>
      <div class="keybind-row"><span class="keybind-action">Trap Type</span><kbd class="keybind-key" data-action="trapType" data-key="f">f</kbd></div>
      <div class="keybind-row"><span class="keybind-action">Spike Type</span><kbd class="keybind-key" data-action="spikeType" data-key="v">v</kbd></div>
      <div class="keybind-row"><span class="keybind-action">Mill Type</span><kbd class="keybind-key" data-action="millType" data-key="n">n</kbd></div>
      <div class="keybind-row"><span class="keybind-action">Turret Type</span><kbd class="keybind-key" data-action="turretType" data-key="h">h</kbd></div>
      <div class="keybind-row"><span class="keybind-action">Stone / Sapling</span><kbd class="keybind-key" data-action="stoneSapling" data-key="y">y</kbd></div>
      <div class="keybind-row"><span class="keybind-action">1 Tick (hold)</span><kbd class="keybind-key" data-action="oneTick" data-key="t">t</kbd></div>
      <div class="keybind-row"><span class="keybind-action">Boost Tick (hold)</span><kbd class="keybind-key" data-action="boostTick" data-key=".">.</kbd></div>
      <div class="keybind-row"><span class="keybind-action">Boost Spike (hold)</span><kbd class="keybind-key" data-action="boostSpike" data-key="l">l</kbd></div>
      <div class="keybind-row keybind-fixed"><span class="keybind-action">Pause Auto (10s)</span><kbd class="keybind-key keybind-fixed-key">Shift</kbd></div>
      <div class="keybind-row keybind-fixed"><span class="keybind-action">Bull Spam</span><kbd class="keybind-key keybind-fixed-key">LMB</kbd></div>
      <div class="keybind-row keybind-fixed"><span class="keybind-action">Break Building</span><kbd class="keybind-key keybind-fixed-key">RMB</kbd></div>
      <div class="keybind-row keybind-fixed"><span class="keybind-action">Bow Spam</span><kbd class="keybind-key keybind-fixed-key">MMB</kbd></div>
      <div class="keybind-row keybind-fixed"><span class="keybind-action">Resync Bull Tick</span><kbd class="keybind-key keybind-fixed-key">Scroll ↑</kbd></div>
      <div class="keybind-row keybind-fixed"><span class="keybind-action">Cancel Resync</span><kbd class="keybind-key keybind-fixed-key">Scroll ↓</kbd></div>
      <div class="keybind-row keybind-fixed"><span class="keybind-action">Play Song (case-sensitive)</span><kbd class="keybind-key keybind-fixed-key">C</kbd></div>
      <div class="keybind-row keybind-fixed"><span class="keybind-action">Record (start/stop)</span><kbd class="keybind-key keybind-fixed-key">U</kbd></div>
    </div>
    <div class="keybind-hint">Click a highlighted key to rebind it</div>`);
	});
	ui.TabContent("others", (dc) => {
		addSearchBar(dc);
		dc.BoxF("Kill Chat", "Sends message when you kill someone", "killChat");
		dc.BoxF(
			"Weapon Grind",
			"Auto place turret type item around you",
			"weaponGrind",
		);
		dc.BoxF(
			"Auto Respawn",
			"Respawns when you die automatically",
			"autoRespawn",
		);
		dc.BoxF(
			"Always Flipper",
			"Equips flipper when in water more",
			"alwaysFlipper",
		);
		dc.BoxF(
			"Auto Accept",
			"Adds players into your party asap when they request to join",
			"autoAccept",
		);
		dc.BoxF(
			"Ping Map",
			"Pings the map when you press r or click it",
			"allowPing",
		);
		dc.BoxF(
			"Player Follow",
			"Follows the targetted player around",
			"playerFollow",
		);
		dc.BoxF("Trap Animals", "Traps animals automatically", "trapAnimals");
		dc.BoxF("Funni Hats :)", "Changes hat when not near players", "hatType");
		dc.BoxHat("Funni Hat", "Hat to equip when Funni Hats is active", "funniHat", "hat", true);

		/*"Park Chinois": {
						id: "0",
				},
				"Gas Gas Gas": {
						id: "1",
				},
				"Verbatim": {
						id: "2"
				},
				"Dead of night": {
						id: "3"
				},
				"I see a dreamer": {
						id: "4"
				},
				"Sailor Song": {
						id: "5",
				},
				"My ordinary life": {
						id: "6",
				},
				"Dont Stand So Close": {
						id: "7",
				},
				"Everything is awesome": {
						id: "8",
				},
				"Candles on fire": {
						id: "9",
				},
				"Enemy": {
						id: "10",
				},
				"SUS": {
						id: "11",
				},
				"Scopin": {
						id: "12",
				},
				"GIGACHAD": {
						id: "13",
				},
				"Shape of you": {
						id: "14",
				},
				"laplace recommendation": {
						id: "15",
				},
				"The nights": {
						id: "16",
						slected: true
				},
				"Cradles": {
						id: "17",
				},*/
	});

	// ── Record Tab ──
	ui.TabContent("record", (dc) => {
		dc.append(`
		<div class="rec-section">
			<div class="rec-section-title">Recording</div>
			<div class="rec-status" id="rec-status-text">Press U to start recording</div>
			<div class="rec-btn-row">
				<button class="rec-btn rec-btn-start" id="rec-start-btn" onclick="window.recToggle()">Record</button>
				<button class="rec-btn rec-btn-stop" id="rec-stop-btn" onclick="window.recStop()">Stop</button>
			</div>
		</div>
		<div class="rec-section">
			<div class="rec-section-title">Settings</div>
			<div class="rec-row">
				<span class="rec-row-label">Source</span>
				<select class="rec-select" id="rec-mode-select" onchange="window.recSetMode(this.value)">
					<option value="game" ${recSettings.mode === 'game' ? 'selected' : ''}>Game (Tab)</option>
					<option value="full" ${recSettings.mode === 'full' ? 'selected' : ''}>Screen</option>
				</select>
			</div>
			<div class="rec-row">
				<span class="rec-row-label">FPS</span>
				<select class="rec-select" id="rec-fps-select" onchange="window.recSetFps(this.value)">
					<option value="30" ${recSettings.fps === 30 ? 'selected' : ''}>30 FPS</option>
					<option value="60" ${recSettings.fps === 60 ? 'selected' : ''}>60 FPS</option>
					<option value="120" ${recSettings.fps === 120 ? 'selected' : ''}>120 FPS</option>
					<option value="144" ${recSettings.fps === 144 ? 'selected' : ''}>144 FPS</option>
				</select>
			</div>
			<div class="rec-row">
				<span class="rec-row-label">Bitrate</span>
				<select class="rec-select" id="rec-bitrate-select" onchange="window.recSetBitrate(this.value)">
					<option value="2000000" ${recSettings.quality === 2000000 ? 'selected' : ''}>2 Mbps</option>
					<option value="5000000" ${recSettings.quality === 5000000 ? 'selected' : ''}>5 Mbps</option>
					<option value="8000000" ${recSettings.quality === 8000000 ? 'selected' : ''}>8 Mbps</option>
					<option value="15000000" ${recSettings.quality === 15000000 ? 'selected' : ''}>15 Mbps</option>
					<option value="20000000" ${recSettings.quality === 20000000 ? 'selected' : ''}>20 Mbps</option>
				</select>
			</div>
			<div class="rec-row" style="flex-direction:column;align-items:stretch;gap:8px;">
				<div class="rec-slider-header">
					<span class="rec-row-label">Volume</span>
					<span class="rec-slider-val" id="rec-vol-display">${Math.round(recSettings.volume * 100)}%</span>
				</div>
				<input type="range" class="rec-slider" min="0" max="1" step="0.01" value="${recSettings.volume}"
					oninput="window.recSetVol(this.value)"
					style="background: linear-gradient(to right, #6366f1 ${recSettings.volume * 100}%, #333 ${recSettings.volume * 100}%)">
			</div>
			<div class="rec-row">
				<span class="rec-row-label">Auto Save</span>
				<label class="rec-switch">
					<input type="checkbox" ${recSettings.autoSave ? 'checked' : ''} onchange="window.recSetAutoSave(this.checked)">
					<span class="rec-switch-slider"></span>
				</label>
			</div>
		</div>
		<div class="rec-section">
			<div class="rec-section-title">Recordings</div>
			<div class="rec-list" id="rec-list-container">
				<div class="rec-empty">No recordings yet — press U to start</div>
			</div>
		</div>
		`);
	});
});

// Tab switching + close button init
workerSetTimeout(() => {
	const menu = document.getElementById("modmenus");
	const scroll = document.getElementById("modmenus-scroll");
	if (!menu || !scroll) return;

	// Move all tab-content divs into the scroll container
	const allTabs = menu.querySelectorAll(".tab-content");
	allTabs.forEach(t => scroll.appendChild(t));

	const btns = menu.querySelectorAll(".tab-btn");
	function activateTab(id) {
		btns.forEach(b => b.classList.toggle("active", b.dataset.tab === id));
		allTabs.forEach(t => t.classList.toggle("active", t.id === id));
		const title = menu.querySelector(".content-title");
		if (title) {
			const btn = menu.querySelector(`.tab-btn[data-tab="${id}"]`);
			title.textContent = btn ? (btn.querySelector(".tab-label")?.textContent || "Abyss") : "Abyss";
		}
	}

	btns.forEach(btn => {
		btn.addEventListener("click", () => activateTab(btn.dataset.tab));
	});

	// Close button
	const closeBtn = document.getElementById("menu-close-btn");
	if (closeBtn) {
		closeBtn.addEventListener("click", () => {
			menu.classList.add("closed");
			menu.classList.remove("open");
		});
	}

	if (btns.length) activateTab(btns[0].dataset.tab);



	// keybind rebind: maps UI action name to key in keydownActions
	const keybindActionMap = {
		autoMill: (key, oldKey) => { keydownActions[key] = keydownActions[oldKey]; delete keydownActions[oldKey]; },
		trapType: (key, oldKey) => { keydownActions[key] = keydownActions[oldKey]; delete keydownActions[oldKey]; },
		spikeType: (key, oldKey) => { keydownActions[key] = keydownActions[oldKey]; delete keydownActions[oldKey]; },
		millType: (key, oldKey) => { keydownActions[key] = keydownActions[oldKey]; delete keydownActions[oldKey]; },
		turretType: (key, oldKey) => { keydownActions[key] = keydownActions[oldKey]; delete keydownActions[oldKey]; },
		stoneSapling: (key, oldKey) => { keydownActions[key] = keydownActions[oldKey]; delete keydownActions[oldKey]; },
		oneTick: (key, oldKey) => { keydownActions[key] = keydownActions[oldKey]; delete keydownActions[oldKey]; },
		boostTick: (key, oldKey) => { keydownActions[key] = keydownActions[oldKey]; delete keydownActions[oldKey]; },
		boostSpike: (key, oldKey) => { keydownActions[key] = keydownActions[oldKey]; delete keydownActions[oldKey]; },
	};

	document.querySelectorAll('.keybind-key[data-key]').forEach(kbd => {
		const action = kbd.dataset.action;
		const stored = localStorage.getItem('kb_' + action);
		if (stored && stored !== kbd.dataset.key) {
			// Remap in keydownActions from old key to stored key
			if (keybindActionMap[action] && keydownActions[kbd.dataset.key]) {
				keybindActionMap[action](stored, kbd.dataset.key);
			}
			kbd.textContent = stored;
			kbd.dataset.key = stored;
		}

		kbd.addEventListener('click', () => {
			if (kbd.classList.contains('listening')) return;
			const prevKey = kbd.dataset.key;
			kbd.classList.add('listening');
			kbd.textContent = '…';
			const onKey = (e) => {
				e.preventDefault();
				e.stopPropagation();
				const newKey = e.key === ' ' ? 'Space' : e.key;
				// Remap in keydownActions
				if (keybindActionMap[action] && keydownActions[prevKey]) {
					keybindActionMap[action](newKey, prevKey);
				}
				kbd.textContent = newKey;
				kbd.dataset.key = newKey;
				kbd.classList.remove('listening');
				localStorage.setItem('kb_' + action, newKey);
				document.removeEventListener('keydown', onKey, true);
			};
			document.addEventListener('keydown', onKey, true);
		});
	});

	const botToggleMap = {
		botAutoBreak: (v) => { configs.botAutoBreak = v; },
		botObstacleBreak: (v) => { configs.botObstacleBreak = v; },
		botAutoPlace: (v) => { configs.botAutoPlace = v; },
		botAutoHat: (v) => { configs.botAutoHat = v; },
		botAutoPushToggle: (v) => { if (window.bottics) bottics.forEach(b => { b._autoPushEnabled = v; }); },
		botAutoBuy: (v) => { configs.botAutoBuy = v; },
		botReplacer: (v) => { if (window.bottics) bottics.forEach(b => { b.replacerToggle = v; }); },
		botSyncHit: (v) => { if (window.bottics) bottics.forEach(b => { b.syncing = v; }); },
		botAntiInsta: (v) => { configs.botAntiInsta = v; },
		botPreplace: (v) => { configs.botPreplace = v; },
	};
	Object.entries(botToggleMap).forEach(([id, fn]) => {
		const row = document.getElementById(id);
		if (!row) return;
		const cb = row.querySelector('input[type="checkbox"]');
		if (!cb) return;
		// Apply initial stored value
		fn(cb.checked);
		cb.addEventListener('change', (e) => fn(e.target.checked));
	});
	Object.entries(botToggleMap).forEach(([id, fn]) => {
		const row = document.getElementById(id);
		if (!row) return;
		const cb = row.querySelector('input[type="checkbox"]');
		if (!cb) return;
		// Apply initial stored value
		fn(cb.checked);
		cb.addEventListener('change', (e) => fn(e.target.checked));
	});
}, 200);

let menuChatDiv = document.createElement("div");
menuChatDiv.id = "menuChatDiv";
document.body.appendChild(menuChatDiv);

HTML.set("menuChatDiv");
HTML.setStyle(`
    position: absolute;
    display: block;
    left: 14px;
    top: 14px;
    z-index: 20;
    opacity: 0;
    transition: opacity 0.4s ease;
    pointer-events: none;
`);
HTML.resetHTML();

HTML.setCSS(`
    #ageBar, .gameButton, #leaderboard, .resourceDisplay, #mapDisplay, #allianceHolder, #allianceInput, .allianceButtonM, #storeHolder, #ChatBodyBox, .storeTab, #chatBox, .actionBarItem, #PlayerLogBoard, .uiElement, #mChDiv, .chMainBox {
        background-color: rgba(0, 0, 0, 0.25);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
        border-radius: 8px;
    }

    .actionBarItem {
        background-size: cover;
        background-position: center;
        border-radius: 10px;
    }

    #ageBar {
        margin-bottom: 5px;
    }

    #leaderboard {
        width: 230px;
    }

    #foodDisplay, #woodDisplay, #stoneDisplay, #killCounter, #scoreDisplay {
        line-height: 30px;
        background-size: 32px;
        background-position: center top 5px;
        padding: 30px 10px 0 10px;
        font-size: 20px;
    }

    #foodDisplay { bottom: 160px }
    #woodDisplay { bottom: 90px }

    #mChDiv {
        width: 420px;
        height: 270px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.05);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
    }

    .chDiv {
        color: #fff;
        font-family: "Ubuntu", sans-serif;
    }

    .chHeader {
        height: 34px;
        display: flex;
        align-items: center;
        padding: 0 10px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: rgba(255,255,255,0.9);
        border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    .chMainWrap {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        padding: 8px;
    }

    .chMainDiv {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding-right: 4px;
        color: rgba(255,255,255,0.94);
        font-size: 12px;
        line-height: 1.35;
        word-break: break-word;
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,0.18) transparent;
    }

    .chMainDiv::-webkit-scrollbar {
        width: 6px;
    }

    .chMainDiv::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.18);
        border-radius: 999px;
    }

    .chMessage {
        margin-bottom: 3px;
        padding: 2px 0;
    }

    .chMainBoxWrap {
        margin-top: 7px;
        flex-shrink: 0;
    }

    .chMainBox {
        width: 100%;
        height: 32px;
        padding: 0 10px;
        border: 1px solid rgba(255,255,255,0.05);
        color: #fff;
        font-family: "Ubuntu", sans-serif;
        font-size: 12px;
        outline: none;
        box-sizing: border-box;
    }

    .chMainBox::placeholder {
        color: rgba(255,255,255,0.4);
    }

    .chMainBox:focus {
        border-color: rgba(255,255,255,0.12);
    }

    .chTime {
        color: rgba(255,255,255,0.45);
        margin-right: 4px;
    }

    .chName {
        color: #bfb6ff;
        font-weight: 600;
        margin-right: 4px;
    }

    .chText {
        color: #ffffff;
    }
    #foodDisplay,
    #woodDisplay,
    #stoneDisplay,
    #killCounter,
    #scoreDisplay {
        height: 60px;
        line-height: 24px;
        padding: 40px 10px 6px 10px;
        font-size: 20px;
        background-size: 32px;
        background-position: center top 6px;
        box-sizing: border-box;
    }
    #mChCmdHelper {
      border: 1px solid rgba(255,255,255,0.05);
`);

HTML.startDiv({ id: "mChDiv", class: "chDiv" }, () => {
	HTML.addDiv(
		{ id: "mChHeader", class: "chHeader", appendID: "mChDiv" },
		() => { }
	);

	getEl("mChHeader").innerText = "Robotis Chat";

	HTML.addDiv(
		{ id: "mChWrap", class: "chMainWrap", appendID: "mChDiv" },
		() => { }
	);

	HTML.addDiv(
		{ id: "mChMain", class: "chMainDiv", appendID: "mChWrap" },
		() => { }
	);

	HTML.addDiv(
		{ id: "mChInputWrap", class: "chMainBoxWrap", appendID: "mChWrap" },
		(html) => {
			html.text({
				id: "mChBox",
				class: "chMainBox",
				placeHolder: `Type a message or press Enter`,
			});
		}
	);
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

function ChText(name, message, color = "white", noTimer) {
	const autoScroll =
		menuChats.scrollTop + menuChats.clientHeight >= menuChats.scrollHeight - 2;

	const row = document.createElement("div");
	row.className = "chMessage";
	row.id = "menuChDisp" + menuChCounts;
	row.style.color = color;

	const frag = document.createDocumentFragment();

	if (!noTimer) {
		const time = new Date();
		const hour = time.getHours();
		const min = String(time.getMinutes()).padStart(2, "0");
		const ampm = hour >= 12 ? "PM" : "AM";

		const timeSpan = document.createElement("span");
		timeSpan.className = "chTime";
		timeSpan.textContent = `[${hour % 12 || 12}:${min} ${ampm}] `;
		frag.appendChild(timeSpan);
	}

	if (name) {
		const nameSpan = document.createElement("span");
		nameSpan.className = "chName";
		nameSpan.textContent = name + ": ";
		frag.appendChild(nameSpan);
	}

	if (message) {
		const msgSpan = document.createElement("span");
		msgSpan.className = "chText";
		msgSpan.textContent = message;
		frag.appendChild(msgSpan);
	}

	row.appendChild(frag);
	menuChats.appendChild(row);

	if (menuChats.children.length > 2000) {
		menuChats.removeChild(menuChats.firstChild);
	}

	if (autoScroll) {
		menuChats.scrollTop = menuChats.scrollHeight;
	}

	menuChCounts++;
}

function resetMenuChText() {
	menuChats.innerHTML = ``;
	menuChCounts = 0;
}

resetMenuChText();

// --- chat fade logic ---
let chatFadeTimer = null;
const chatEl = menuChatDiv;

function chatShow() {
	chatEl.style.opacity = "1";
	chatEl.style.pointerEvents = "auto";
	if (chatFadeTimer) { clearTimeout(chatFadeTimer); chatFadeTimer = null; }
}
function chatScheduleHide() {
	if (chatFadeTimer) clearTimeout(chatFadeTimer);
	chatFadeTimer = setTimeout(() => {
		chatEl.style.opacity = "0";
		chatEl.style.pointerEvents = "none";
		chatFadeTimer = null;
	}, 3000);
}

chatEl.addEventListener("mouseenter", () => {
	chatShow();
});
chatEl.addEventListener("mouseleave", () => {
	if (!menuCBFocus) chatScheduleHide();
});
menuChatBox.addEventListener("focus", () => {
	menuCBFocus = true;
	chatShow();
});
menuChatBox.addEventListener("blur", () => {
	menuCBFocus = false;
	chatScheduleHide();
});

// patch ChText to flash on new message
const origChText = ChText;
ChText = function (name, message, color, noTimer) {
	origChText(name, message, color, noTimer);
	chatShow();
	chatScheduleHide();
};
menuChatBox.setAttribute("autocomplete", "off");
menuChatBox.setAttribute("autocorrect", "off");
menuChatBox.setAttribute("autocapitalize", "off");
menuChatBox.setAttribute("spellcheck", "false");
menuChatBox.setAttribute("data-form-type", "other");
menuChatBox.name = "robotis-chat-input";
menuChatBox.type = "text";

const cmdState = {
	lastMsg: "",
	suggestionIndex: -1,
	suggestions: [],
	helperEl: null,
};

const variantArgs = ["stone", "gold", "diamond", "ruby"];

const cmds = [
	{
		name: "!login",
		usage: "!login tinysweet",
		fill() {
			return "!login tinysweet";
		},
	},
	{
		name: "!setup",
		usage: "!setup",
		fill() {
			return "!setup";
		},
	},
	{
		name: "!tp",
		usage: "!tp {SID}",
		fill() {
			const players = getTpTargets();
			return players.length ? `!tp ${players[0].sid}` : "!tp ";
		}
	},
	{
		name: "!v",
		usage: "!v <stone/gold/diamond/ruby>",
		fill() {
			return "!v ";
		},
	},
	{
		name: "!variant",
		usage: "!variant <stone/gold/diamond/ruby>",
		fill() {
			return "!variant ";
		},
	},
];

function getEnemySidValue(obj) {
	if (!obj) return null;
	return obj.sid;
}

function getEnemyNameValue(obj) {
	if (!obj) return "Unknown";
	return obj.name`SID ${getEnemySidValue(obj) ?? "?"}`;
}

function getTpTargets() {
	const list = [];

	if (!lastLeaderboardData || !Array.isArray(lastLeaderboardData)) return list;

	for (let i = 0; i < lastLeaderboardData.length; i += 3) {
		const sid = lastLeaderboardData[i];
		const name = lastLeaderboardData[i + 1];
		const score = lastLeaderboardData[i + 2];

		// Skip yourself
		if (sid == player?.sid) continue;

		list.push({
			sid: sid,
			name: name
		});
	}

	return list;
}

function sanitizeCmdInput(value) {
	if (!value) return "";

	let out = value.replace(/^\s+/, "");

	if (!out.startsWith("!")) return out;

	const firstSpace = out.indexOf(" ");

	if (firstSpace === -1) {
		return out.toLowerCase();
	}

	const cmd = out.slice(0, firstSpace).toLowerCase();
	const rest = out.slice(firstSpace);

	return cmd + rest;
}

function ensureCmdHelper() {
	if (cmdState.helperEl && cmdState.helperEl.isConnected) return cmdState.helperEl;

	const el = document.createElement("div");
	el.id = "mChCmdHelper";
	el.style.display = "none";
	el.style.marginTop = "6px";
	el.style.padding = "6px 8px";
	el.style.borderRadius = "8px";
	el.style.backgroundColor = "rgba(0, 0, 0, 0.25)";
	el.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.5)";
	el.style.fontFamily = '"Ubuntu", sans-serif';
	el.style.fontSize = "11px";
	el.style.color = "white";
	el.style.lineHeight = "1.35";
	el.style.pointerEvents = "auto";
	el.style.border = "1px solid rgba(255,255,255,0.05)";

	const wrap = getEl("mChWrap");
	wrap.insertBefore(el, getEl("mChInputWrap"));
	cmdState.helperEl = el;
	return el;
}

function hideCmdHelper() {
	const el = ensureCmdHelper();
	el.style.display = "none";
	el.innerHTML = "";
	cmdState.suggestions = [];
	cmdState.suggestionIndex = -1;
}

function makeVariantSuggestions(baseCmd, typedArg = "") {
	const q = typedArg.toLowerCase();
	return variantArgs
		.filter((v) => !q || v.startsWith(q))
		.map((v) => ({
			label: `${baseCmd} ${v}`,
			preview: "Variant",
			value: `${baseCmd} ${v}`,
		}));
}

function getCmdSuggestions(value) {
	if (!value || !value.startsWith("!")) return [];

	const lower = value.toLowerCase();
	const endsWithSpace = /\s$/.test(lower);
	const trimmedRight = lower.trimEnd();
	const parts = trimmedRight.split(/\s+/);
	const cmd = parts[0] || "";
	const arg = parts.length > 1 ? parts.slice(1).join(" ") : "";

	if (!endsWithSpace && parts.length === 1) {
		return cmds
			.filter((c) => c.name.startsWith(cmd))
			.map((c) => ({
				label: c.name,
				preview: c.usage,
				value: c.fill(),
			}));
	}

	if (cmd === "!login") {
		return [
			{
				label: "!login tinysweet",
				preview: "Default password",
				value: "!login tinysweet",
			},
		];
	}

	if (cmd === "!tp") {
		const typedArg = parts.length > 1
			? parts.slice(1).join(" ").toLowerCase()
			: "";

		const targets = getTpTargets();

		const filtered = typedArg
			? targets.filter(t =>
				t.name.toLowerCase().includes(typedArg) ||
				String(t.sid).includes(typedArg)
			)
			: targets;

		return filtered.slice(0, 10).map(t => ({
			label: `!tp ${t.name}`,
			preview: `SID ${t.sid}`,
			value: `!tp ${t.sid}`
		}));
	}

	if (cmd === "!setup") {
		return [
			{
				label: "!setup",
				preview: "Run setup",
				value: "!setup",
			},
		];
	}

	if (cmd === "!v" || cmd === "!variant") {
		return makeVariantSuggestions(cmd, arg);
	}

	return [];
}

function renderCmdHelper() {
	const el = ensureCmdHelper();
	const suggestions = cmdState.suggestions;

	if (!suggestions.length || !menuCBFocus || !menuChatBox.value.startsWith("!")) {
		hideCmdHelper();
		return;
	}

	el.innerHTML = "";

	const value = menuChatBox.value.toLowerCase().trim();
	if (value.startsWith("!tp") && suggestions.length > 0) {
		const header = document.createElement("div");
		header.textContent = "Select Player:";
		header.style.color = "rgba(255,255,255,0.6)";
		header.style.fontSize = "10px";
		header.style.marginBottom = "4px";
		header.style.fontWeight = "600";
		el.appendChild(header);

		for (let i = 0; i < suggestions.length; i++) {
			const s = suggestions[i];
			const row = document.createElement("div");
			row.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 3px 6px;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.15s ease;
        opacity: ${i === cmdState.suggestionIndex ? "1" : "0.78"};
        background: ${i === cmdState.suggestionIndex ? "rgba(255,255,255,0.08)" : "transparent"};
      `;

			row.onmouseenter = () => {
				cmdState.suggestionIndex = i;
				renderCmdHelper();
			};

			row.onclick = () => {
				menuChatBox.value = s.value;
				updateCmdSuggestions();
				const len = menuChatBox.value.length;
				menuChatBox.setSelectionRange(len, len);
				menuChatBox.focus();
			};

			const left = document.createElement("span");
			left.textContent = s.label;
			left.style.color = i === cmdState.suggestionIndex ? "#d4ccff" : "white";
			left.style.fontWeight = i === cmdState.suggestionIndex ? "700" : "500";

			const right = document.createElement("span");
			right.textContent = s.preview || "";
			right.style.color = "rgba(255,255,255,0.42)";
			right.style.fontSize = "10px";

			row.appendChild(left);
			row.appendChild(right);
			el.appendChild(row);
		}
	} else {
		for (let i = 0; i < suggestions.length; i++) {
			const s = suggestions[i];
			const row = document.createElement("div");
			row.style.display = "flex";
			row.style.alignItems = "center";
			row.style.justifyContent = "space-between";
			row.style.gap = "10px";
			row.style.padding = "2px 0";
			row.style.opacity = i === cmdState.suggestionIndex ? "1" : "0.78";

			const left = document.createElement("span");
			left.textContent = (i === cmdState.suggestionIndex ? "› " : "") + s.label;
			left.style.color = i === cmdState.suggestionIndex ? "#d4ccff" : "white";
			left.style.fontWeight = i === cmdState.suggestionIndex ? "700" : "500";

			const right = document.createElement("span");
			right.textContent = s.preview || "";
			right.style.color = "rgba(255,255,255,0.42)";
			right.style.fontSize = "10px";

			row.appendChild(left);
			row.appendChild(right);
			el.appendChild(row);
		}
	}

	el.style.display = "block";
}

function updateCmdSuggestions() {
	cmdState.suggestions = getCmdSuggestions(menuChatBox.value);
	cmdState.suggestionIndex = cmdState.suggestions.length ? 0 : -1;
	renderCmdHelper();
}

function applySelectedCmdSuggestion() {
	if (!cmdState.suggestions.length || cmdState.suggestionIndex < 0) return false;

	const selected = cmdState.suggestions[cmdState.suggestionIndex];
	menuChatBox.value = selected.value;
	updateCmdSuggestions();

	const len = menuChatBox.value.length;
	menuChatBox.setSelectionRange(len, len);
	return true;
}

menuChatBox.addEventListener("input", () => {
	const before = menuChatBox.value;
	const start = menuChatBox.selectionStart ?? before.length;

	const after = sanitizeCmdInput(before);
	if (before !== after) {
		menuChatBox.value = after;
		const nextPos = Math.min(after.length, start);
		menuChatBox.setSelectionRange(nextPos, nextPos);
	}

	updateCmdSuggestions();
});

menuChatBox.addEventListener("keydown", (e) => {
	const hasSuggestions = cmdState.suggestions.length > 0;

	if (e.key === "Tab") {
		if (hasSuggestions) {
			e.preventDefault();
			applySelectedCmdSuggestion();
		}
		return;
	}

	if (e.key === "ArrowDown") {
		if (hasSuggestions) {
			e.preventDefault();
			cmdState.suggestionIndex =
				(cmdState.suggestionIndex + 1) % cmdState.suggestions.length;
			renderCmdHelper();
		}
		return;
	}

	if (e.key === "ArrowUp") {
		if (hasSuggestions && menuChatBox.value.startsWith("!")) {
			e.preventDefault();
			cmdState.suggestionIndex--;
			if (cmdState.suggestionIndex < 0) {
				cmdState.suggestionIndex = cmdState.suggestions.length - 1;
			}
			renderCmdHelper();
			return;
		}

		if (!menuChatBox.value.trim() && cmdState.lastMsg) {
			e.preventDefault();
			menuChatBox.value = sanitizeCmdInput(cmdState.lastMsg);
			updateCmdSuggestions();
			const len = menuChatBox.value.length;
			menuChatBox.setSelectionRange(len, len);
		}
		return;
	}

	if (e.key === "ArrowRight") {
		if (hasSuggestions && menuChatBox.value.startsWith("!")) {
			e.preventDefault();
			applySelectedCmdSuggestion();
		}
		return;
	}

	if (e.key === "Enter") {
		menuChatBox.value = sanitizeCmdInput(menuChatBox.value);
		cmdState.lastMsg = menuChatBox.value;
		hideCmdHelper();
	}
});

menuChatBox.addEventListener("blur", () => {
	setTimeout(() => {
		if (!menuCBFocus) hideCmdHelper();
	}, 10);
});

document.body.addEventListener("click", (event) => {
	const tabBtn = event.target.closest(".tab-btn");
	if (tabBtn) {
		const tabName = tabBtn.dataset.tab;
		document.querySelectorAll("#modmenus-sidebar .tab-btn").forEach((btn) => {
			btn.classList.remove("active");
		});
		document.querySelectorAll(".tab-content").forEach((content) => {
			content.classList.remove("active");
		});
		tabBtn.classList.add("active");
		const selectedContent = document.getElementById(tabName);
		if (selectedContent) {
			selectedContent.classList.add("active");
		}
	}
});

document.body.addEventListener("input", (event) => {
	if (event.target && event.target.classList.contains("search-input")) {
		const searchText = event.target.value.toLowerCase();
		const tabContent = event.target.closest(".tab-content");
		if (tabContent) {
			const textElements = tabContent.querySelectorAll("span");
			textElements.forEach((textElement) => {
				const isVisible = textElement.textContent
					.toLowerCase()
					.includes(searchText);
				textElement.style.display = isVisible ? "" : "none";
			});
		}
	}
});

document.body.addEventListener("input", (event) => {
	if (event.target && event.target.classList.contains("search-input")) {
		const searchText = event.target.value.toLowerCase();
		const tabContent = event.target.closest(".tab-content");
		if (tabContent) {
			const boxFContainers = tabContent.querySelectorAll(".checkbox-container");
			boxFContainers.forEach((container) => {
				const nameElement = container.querySelector(".checkbox-name");
				if (nameElement) {
					const isVisible = nameElement.textContent
						.toLowerCase()
						.includes(searchText);
					container.style.display = isVisible ? "" : "none";
				}
			});
		}
	}
});

const defaultTab = document.getElementById("offensive");
const defaultButton = document.querySelector(
	'#modmenus-sidebar .tab-btn[data-tab="offensive"]',
);
if (defaultTab) defaultTab.classList.add("active");
if (defaultButton) defaultButton.classList.add("active");
function isC(id) {
	// for checking if the ids is checked or not so use it oe
	let checkVal = localStorage.getItem(id) === "true";
	let optionVal = localStorage.getItem(`${id}-selected`);
	return {
		checked: checkVal,
		options: {
			value: optionVal,
		},
	};
}
let configs = {};
let options = {};
let WS = undefined;
let socketID = undefined;

let secPacket = 0;
let secMax = 110;
let secTime = 1000;
let firstSend = {
	sec: false,
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
	tickRate: 1000 / config.serverUpdateRate,
	tickSpeed: 0,
	lastTick: performance.now(),
};
let projectileTick = [];
let modConsole = [];

let dontSend = false;
let fpsTimer = {
	last: 0,
	time: 0,
	ltime: 0,
};
let lastsp = ["cc", 1, "__proto__"];

let privateAutoLogin = false;
let privateAutoLoginSent = false;

// Registered with the shim installed at document-start, which already owns
// WebSocket.prototype.send (the game captured that reference at load).
EXP.setHandler(function (message) {
	if (!WS) {
		WS = this;
		WS.addEventListener("message", function (msg) {
			getMessage(msg);
		});
		WS.addEventListener("close", (event) => {
			window.location.reload();
		});

		// Auto-login for private server (main player initial connection).
		// This used to wrap nsend and msgpack-decode the outgoing buffer
		// looking for the spawn packet; outgoing frames are not plain msgpack
		// any more, so the trigger moved into applyOutgoing(), which already
		// has the decoded packet name.
		privateAutoLogin = !!(WS.url && WS.url.includes('tw-moo-privateserver.onrender.com'));
	}
	if (WS == this) {
		// Unframe: strips the MAC and turns the numeric opcode back into the
		// string name the rest of this client is written against.
		const unframed = EXP.unframe(this, message);
		if (!unframed) return EXP.nativeSend.call(this, message);

		const outgoing = applyOutgoing(unframed.type, unframed.args);
		if (outgoing) {
			EXP.send(this, outgoing.type, outgoing.data);
			// START COUNT:
			if (!firstSend.sec) {
				firstSend.sec = true;
				workerSetTimeout(() => {
					firstSend.sec = false;
					secPacket = 0;
				}, secTime);
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

		if (privateAutoLogin && type === "M" && !privateAutoLoginSent) {
			privateAutoLoginSent = true;
			setTimeout(() => {
				packet("6", "!login tinysweet");
				setTimeout(() => packet("6", "!setup"), 1000);
			}, 1000);
		}
		/*hmm create party packet = "L" with data of an array with length 1 which is party name with \x00\x00...(8 \x00 s). Replace the ones at the front with the party name.
				hmm accept player join packet = "P" with data of an array with length 2. First item is accepted player sid, second is either 0 or 1 where 0 means decline and 1 means accept
				kick player is packet "Q" with data of the kicked player sid
				join party packet is "b" with data of \x00\x00\x00\x00... (8 \x00). Replace each of the \x00 at the front with the party name.
				when someone wants to join ur party, receives "2" with data thats an array of
				*/
		// SEND MESSAGE:
		if (type == "6") {
			let message = data[0];

			if (message) {
				profanityList.forEach((profany) => {
					let reg = new RegExp(profany, "g");
					message = message.replace(reg, (match) => {
						return (
							(message.length == 30
								? match[0].toUpperCase()
								: match[0] + "\x00") + match.slice(1)
						);
					});
				});

				// FIX CHAT:
				data[0] = message.slice(0, 30);
			}
		} else if (type == "L") {
			// MAKE SAME CLAN:
			data[0] = data[0] + String.fromCharCode(0).repeat(7);
			data[0] = data[0].slice(0, 7);
		} else if (type == "M") {
			// APPLY CYAN COLOR:
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
			} else {
				if (data[1] == 1) {
					my.autoGathering = !my.autoGathering;
				}
			}
		} else if (type == "S") {
			if (!data[1]) {
				dontSend = true;
			}
		} else if (type == "9") {
			if (data[1]) {
				if (player.moveDir == data[0]) {
					dontSend = true;
				} else {
					player.moveDir = data[0];
				}
			} else {
				dontSend = true;
			}
		} else if (type == "0") {
			if (!data[0] || secPacket > 60) {
				dontSend = true;
			} else {
				sentPingTime = Date.now();
			}
		} else if (type == "P") {
			if (!data[2]) {
				playersJoining.shift();
			} else {
				playersJoining.filter((e) => e != data[0]);
			}
		} else if (type == "e") {
			if (!data[0]) {
				dontSend = true;
			} else {
				player.moveDir = undefined;
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

let packetEvents = {
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
	g: addAlliance,
	1: deleteAlliance,
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

function getMessage(message) {
	// Maps the numeric opcode back to the string name this client uses.
	let parsed = EXP.receive(message.target || WS, message.data);
	if (!parsed) return;
	let type = parsed.type;
	let data = parsed.args;
	if (type == "io-init") {
		socketID = data[0];
	} else {
		if (packetEvents[type]) {
			packetEvents[type].apply(undefined, data);
			//!["a", "I", "0"].includes(type) && console.log("received", type, data)
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
	let value = value2 + (value1 - value2) * amount;
	if (value >= 0 && value <= Math.PI * 2) return value;
	return value % (Math.PI * 2);
};

// REOUNDED RECTANGLE:
CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
	if (w < 2 * r) r = w / 2;
	if (h < 2 * r) r = h / 2;
	if (r < 0) r = 0;
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

// VOLCANO:
let xof = undefined;
let yof = undefined;
let volcano = {
	animationTime: 0,
	land: null,
	lava: null,
	x: config.volcanoLocationX,
	y: config.volcanoLocationY,
};
let debugStop = false;
let kbIndc = {
	mex: 0, mey: 0,
	x0: 0, y0: 0,
	x1: 0, y1: 0,
	instax: 0, instay: 0,
	turretx: 0, turrety: 0,
	hitPri: false, hitInsta: false,
};

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
let near = {};
let targetPlayer = undefined;
let ping = {
	min: 0,
	max: 0,
	avg: 0,
};

let my = {
	healed: false,
	reloaded: false,
	waitHit: 0,
	autoAim: false,
	revAim: false,
	ageInsta: true,
	reSync: false,
	bullTick: true,
	anti0Tick: 0,
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
	autoGathering: false,
	forceStop: false,
};

let testRender = {};

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

const musicTracks = [
	{
		name: "Heilung: Alfadhirhaiti",
		url: "https://www.youtube.com/watch?v=S251dfQYXck",
		lyrics: [
			[23350, `Draupnir`],
			[31230, `Geri Freki`],
			[40710, `Sleipnir`],
			[59120, `Gugnir`],
			[102270, `Haegolae Haegolae Haegolae`],
			[104000, `Wiju Bi Gojze`],
			[106580, `Gaegogae Gaegogae Gaegogae`],
			[108500, `Ginu Gahelija`],
			[111190, `Haegolae Haegolae Haegolae`],
			[113000, `Wiju Bi Gojze`],
			[115910, `Gaegogae Gaegogae Gaegogae`],
			[117500, `Ginu Gahelija`],
			[120520, `Haegolae Haegolae Haegolae`],
			[122500, `Wiju Bi Gojze`],
			[125110, `Gaegogae Gaegogae Gaegogae`],
			[127500, `Ginu Gahelija`],
			[129820, `Haegolae Haegolae Haegolae`],
			[132000, `Wiju Bi Gojze`],
			[134480, `Gaegogae Gaegogae Gaegogae`],
			[136500, `Ginu Gahelija`],
			[139110, `Haegolae Haegolae Haegolae`],
			[141500, `Wiju Bi Gojze`],
			[143820, `Gaegogae Gaegogae Gaegogae`],
			[145500, `Ginu Gahelija`],
			[148470, `Haegolae Haegolae Haegolae`],
			[151000, `Wiju Bi Gojze`],
			[153080, `Gaegogae Gaegogae Gaegogae`],
			[155500, `Ginu Gahelija`],
			[157780, `Haegolae Haegolae Haegolae`],
			[160000, `Wiju Bi Gojze`],
			[162390, `Gaegogae Gaegogae Gaegogae`],
			[164500, `Ginu Gahelija`],
			[167120, `Haegolae Haegolae Haegolae`],
			[169500, `Wiju Bi Gojze`],
			[171760, `Gaegogae Gaegogae Gaegogae`],
			[173500, `Ginu Gahelija`],
			[176380, `Haegolae Haegolae Haegolae`],
			[178500, `Wiju Bi Gojze`],
			[181030, `Gaegogae Gaegogae Gaegogae`],
			[183500, `Ginu Gahelija`],
			[232460, `Haugen Maunen`],
			[238450, `Ok Alfadhir heitir`],
			[247000, `Fimbulthulur Fjoelnir`],
			[250310, `Udhur Ulfroegni`],
			[253090, `Thekkur Thudur`],
			[255510, `Onski Ofnir`],
			[257700, `Rognir Raudhir`],
			[260070, `Grimnir Goendlir`],
			[262330, `Hlefreyr Hangatyr`],
			[264770, `Njolstapi Naudhvindir`],
			[268270, `Jolfudhr Jafnhaur`],
			[271130, `Atridhir Alfadhir`],
			[274610, `Sidgrani Sigfadhir`],
			[278150, `Dughirgjafi Dresvarpir`],
			[282170, `Bileygur Biflidhi`],
			[285840, `Margvisir Midhvitnis`],
			[289200, `Londungr Launhirdir`],
			[292640, `Yggr ok Yungir`],
			[342970, `Fimbulthulur Fjoelnir`],
			[346010, `Udhur Ulfroegni`],
			[348920, `Thekkur Thudur`],
			[351400, `Onski Ofnir`],
			[353650, `Rognir Raudhir`],
			[355980, `Grimnir Goendlir`],
			[358300, `Hlefreyr Hangatyr`],
			[360610, `Njolstapi Naudhvindir`],
			[364080, `Jolfudhr Jafnhaur`],
			[367340, `Atridhir Alfadhir`],
			[370540, `Sidgrani Sigfadhir`],
			[373960, `Dughirgjafi Dresvarpir`],
			[378080, `Bileygur Biflidhi`],
			[381590, `Margvisir Midhvitnis`],
			[385100, `Londungr Launhirdir`],
			[388600, `Yggr ok Yungir`],
			[438820, `Fimbulthulur Fjoelnir`],
			[441990, `Udhur Ulfroegni`],
			[444940, `Thekkur Thudur`],
			[447270, `Onski Ofnir`],
			[449580, `Rognir Raudhir`],
			[451920, `Grimnir Goendlir`],
			[454210, `Hlefreyr Hangatyr`],
			[456570, `Njolstapi Naudhvindir`],
			[460040, `Jolfudhr Jafnhaur`],
			[463240, `Atridhir Alfadhir`],
			[466440, `Sidgrani Sigfadhir`],
			[469870, `Dughirgjafi Dresvarpir`],
			[474020, `Bileygur Biflidhi`],
			[477670, `Margvisir Midhvitnis`],
			[481050, `Londungr Launhirdir`],
			[484520, `Yggr ok Yungir`],
			[535130, `Fimbulthulur Fjoelnir`],
			[537820, `Udhur Ulfroegni`],
			[540720, `Thekkur Thudur`],
			[543190, `Onski Ofnir`],
			[545490, `Rognir Raudhir`],
			[547840, `Grimnir Goendlir`],
			[550100, `Hlefreyr Hangatyr`],
			[552330, `Njolstapi Naudhvindir`],
			[555970, `Jolfudhr Jafnhaur`],
			[559000, `Atridhir Alfadhir`],
			[562180, `Sidgrani Sigfadhir`],
			[566060, `Dughirgjafi Dresvarpir`],
			[569900, `Bileygur Biflidhi`],
			[573410, `Margvisir Midhvitnis`],
			[576980, `Londungr Launhirdir`],
			[580430, `Yggr ok Yungir`],
		],
	},
	{
		name: "Three Days Grace: So Called Life",
		url: "https://www.youtube.com/watch?v=7SBCCSF5p7Q",
		lyrics: [
			[24880, `Can't laugh, can't cry,`],
			[26500, `can't live, can't die`],
			[28010, `Can't do anything anymore`],
			[36970, `Can't love, can't breathe,`],
			[38500, `can't talk, can't sleep`],
			[40010, `But I can't seem to stay`],
			[41500, `awake anymore`],
			[49800, `What a time to be alive`],
			[52700, `Such a waste of fucking`],
			[54200, `time`],
			[54060, `Oh, give me something`],
			[56000, `to take the edge off`],
			[58800, `Something to kick`],
			[60300, `the night off`],
			[61880, `Something to keep`],
			[63300, `my mind off`],
			[64720, `This so called life`],
			[66520, `Oh, give me something`],
			[68500, `to take the edge off`],
			[70860, `Something to kick`],
			[72300, `the night off`],
			[73850, `Something to keep`],
			[75300, `my mind off`],
			[76720, `This so called life`],
			[78890, `Feels like I wanna jump,`],
			[80200, `wanna scream, wanna run`],
			[81990, `Wanna fucking put a`],
			[83500, `chainsaw through the wall`],
			[90950, `Feels like I'm living`],
			[92500, `in a world where`],
			[94350, `everybody's all for none`],
			[96000, `and none for all`],
			[103690, `What a time to be alive`],
			[106770, `Such a waste of fucking`],
			[108200, `time`],
			[108560, `Oh, give me something`],
			[112840, `to take the edge off`],
			[115860, `Something to kick`],
			[117300, `the night off`],
			[118870, `Something to keep`],
			[120300, `my mind off`],
			[121720, `This so called life`],
			[123600, `Oh, give me something`],
			[127870, `to take the edge off`],
			[130870, `Something to kick`],
			[132300, `the night off`],
			[133870, `Something to keep`],
			[135300, `my mind off`],
			[136750, `This so called life`],
			[139070, `What a time to be alive`],
			[142730, `What a time to be alive`],
			[145700, `What a time to be alive`],
			[148710, `Such a waste of fucking`],
			[150100, `time`],
			[159990, `Feels like I wanna jump,`],
			[163000, `wanna scream, wanna run`],
			[166000, `Wanna fucking put a`],
			[168000, `chainsaw through the wall`],
			[171600, `Oh, give me something`],
			[174590, `Oh, give me something`],
			[177610, `Oh, give me something`],
			[181820, `to take the edge off`],
			[184840, `Something to kick`],
			[186200, `the night off`],
			[187870, `Something to keep`],
			[189300, `my mind off`],
			[190750, `This so called life`],
			[192600, `Oh, give me something`],
			[196870, `to take the edge off`],
			[199870, `Something to kick`],
			[201200, `the night off`],
			[202750, `Something to keep`],
			[204100, `my mind off`],
			[205750, `This so called life`],
		]
	},
	{
		name: "Three Days Grace: I Am Machine",
		url: "https://www.youtube.com/watch?v=A63h2Fl05AQ",
		lyrics: [
			[16300, `Here's to being human`],
			[19510, `All the pain and sufferin'`],
			[22560, `There's beauty in the bleedin'`],
			[25740, `At least you feel somethin'`],
			[28950, `I wish I knew what it was like`],
			[32100, `To care enough to carry on`],
			[35360, `I wish I knew what it was like`],
			[38550, `To find a place where I belong,`],
			[40500, `but`],
			[41960, `I am machine`],
			[43180, `I never sleep,`],
			[44500, `I keep my eyes wide open`],
			[48360, `I am machine`],
			[49580, `A part of me wishes`],
			[51000, `I could just feel somethin'`],
			[54700, `I am machine`],
			[55930, `I never sleep`],
			[57500, `until I fix what's broken`],
			[61130, `I am machine`],
			[62350, `A part of me wishes`],
			[64000, `I could just feel somethin'`],
			[107570, `Here's to being human`],
			[110720, `Takin' it for granted`],
			[113750, `The highs and lows of livin'`],
			[116930, `To getting second chances`],
			[120150, `I wish I knew what it was like`],
			[123370, `To care about what's right or wrong`],
			[126590, `I wish someone could help me find`],
			[129880, `Find a place where I belong,`],
			[131500, `but`],
			[133200, `I am machine`],
			[134330, `I never sleep,`],
			[136000, `I keep my eyes wide open`],
			[139520, `I am machine`],
			[140760, `A part of me wishes`],
			[142500, `I could just feel somethin'`],
			[145960, `I am machine`],
			[147150, `I never sleep`],
			[149000, `until I fix what's broken`],
			[152360, `I am machine`],
			[153540, `A part of me wishes`],
			[155500, `I could just feel somethin'`],
			[158580, `It wasn't supposed to be this way`],
			[201950, `We were meant to feel the pain`],
			[205170, `I don't like what I am becoming`],
			[209540, `Wish I could just feel somethin'`],
			[240300, `I am machine`],
			[241540, `I never sleep,`],
			[243500, `I keep my eyes wide open`],
			[246760, `I am machine`],
			[247930, `A part of me wishes`],
			[250000, `I could just feel somethin'`],
			[253160, `I am machine`],
			[254350, `I never sleep`],
			[256500, `until I fix what's broken`],
			[259560, `I am machine`],
			[260730, `A part of me wishes`],
			[263000, `I could just feel somethin'`],
		],
	},
	{
		name: "Three Days Grace: Time of Dying",
		url: "https://www.youtube.com/watch?v=pMDcYX2wRSg",
		lyrics: [
			[15060, `On the ground I lay`],
			[17220, `Motionless in pain`],
			[19730, `I can see my life`],
			[22050, `Flashing before my eyes`],
			[24430, `Did I fall asleep?`],
			[26900, `Is this all a dream?`],
			[29310, `Wake me up`],
			[31210, `I'm living a nightmare`],
			[34710, `I will not die`],
			[37210, `I will not die`],
			[39630, `I will survive`],
			[44380, `I will not die`],
			[46680, `I'll wait here for you`],
			[48840, `I feel alive`],
			[51640, `When you're beside me`],
			[53490, `I will not die`],
			[56560, `I'll wait here for you`],
			[58860, `In my time of dying`],
			[105790, `On this bed I lay`],
			[108120, `Losing everything`],
			[110490, `I can see my life`],
			[112790, `Passing me by`],
			[115500, `Was it all too much`],
			[119190, `Or just not enough?`],
			[120740, `Wake me up`],
			[121880, `I'm living a nightmare`],
			[124900, `I will not die`],
			[127390, `I will not die`],
			[130340, `I will survive`],
			[134980, `I will not die`],
			[137860, `I'll wait here for you`],
			[139620, `I feel alive`],
			[142560, `When you're beside me`],
			[144720, `I will not die`],
			[147190, `I'll wait here for you`],
			[148860, `In my time of dying`],
			[209280, `I will not die`],
			[211450, `I'll wait here for you`],
			[213480, `I feel alive`],
			[216390, `When you're beside me`],
			[218590, `I will not die`],
			[221130, `I'll wait here for you`],
			[223350, `In my time of dying`],
			[227710, `I will not die`],
			[230970, `I'll wait here for you`],
			[232990, `I will not die`],
			[236000, `When you're beside me`],
			[237900, `I will not die`],
			[240690, `I'll wait here for you`],
			[242580, `In my time of dying`],
		],
	},
	{
		name: "Charlie Kirk Anthem",
		url: "https://www.youtube.com/watch?v=I0RC2Z-V1I0",
		lyrics: [
			[13670, `He stood unshaken,`],
			[15500, `a voice in the storm`],
			[21010, `A man of conviction,`],
			[23500, `a heart reborn`],
			[28430, `He spoke the truth`],
			[31000, `when the cost was high`],
			[35520, `He lived for Jesus,`],
			[38000, `unafraid to die`],
			[46030, `We are Charlie Kirk,`],
			[48500, `we carry the flame`],
			[52710, `We'll fight for the Gospel,`],
			[55500, `we'll honor his name`],
			[60240, `We are Charlie Kirk,`],
			[63000, `his courage, our own`],
			[67380, `Together unbroken,`],
			[70000, `we'll make Heaven known`],
			[86400, `A husband, a father,`],
			[89000, `his family held near`],
			[93680, `A home built on scripture,`],
			[96500, `on faith, without fear`],
			[100580, `The world tried to silence`],
			[103500, `but his voice remains`],
			[108450, `In us, it echoes,`],
			[111000, `in Christ, it sustains`],
			[118340, `We are Charlie Kirk,`],
			[121000, `we carry the flame`],
			[125190, `We'll fight for the Gospel,`],
			[128500, `we'll honor his name`],
			[132540, `We are Charlie Kirk,`],
			[135500, `his courage, our own`],
			[139610, `Together unbroken,`],
			[142500, `we'll make Heaven known`],
			[146790, `The battle is raging,`],
			[149500, `the darkness will fall`],
			[153860, `We rise with his spirit,`],
			[156500, `we answer the call`],
			[161130, `The truth is eternal,`],
			[163500, `the cross is our guide`],
			[168320, `With God as our captain,`],
			[171000, `we march side by side`],
			[177240, `We are Charlie Kirk,`],
			[180000, `we carry the flame`],
			[184480, `We'll fight for the Gospel,`],
			[187500, `we'll honor his name`],
			[191740, `We are Charlie Kirk,`],
			[194500, `his courage, our own`],
			[198680, `Together unbroken,`],
			[201500, `we'll make Heaven known`],
			[206240, `We are Charlie Kirk`],
			[210640, `Forever alive`],
			[213490, `We are Charlie Kirk`],
			[217090, `With God, we will rise`],
		],
	},
	{
		name: "Metallica - Creeping Death",
		url: "https://www.youtube.com/watch?v=QF-JbjTwCwY",
		lyrics: [
			[56340, `Slaves, Hebrews born to serve`],
			[59300, `To the Pharaoh`],
			[61300, `Heed, to his every word`],
			[64010, `Live in fear`],
			[66220, `Faith of the unknown one`],
			[68730, `The deliverer`],
			[70600, `Wait, something must be done`],
			[73680, `Four hundred years`],
			[85270, `So let it be written`],
			[87650, `So let it be done`],
			[90200, `I'm sent here by the`],
			[92500, `chosen one`],
			[94930, `So let it be written`],
			[97240, `So let it be done`],
			[99560, `To kill the first-born`],
			[101500, `Pharaoh son`],
			[103190, `I'm creeping death`],
			[113480, `Now, let my people go`],
			[116400, `Land of Goshen`],
			[118390, `Go, I will be with thee`],
			[121160, `Bush of fire`],
			[122740, `Blood, running red and strong`],
			[125890, `Down the Nile`],
			[127790, `Plague, darkness three days`],
			[130000, `long`],
			[130830, `Hail to fire`],
			[142100, `So let it be written`],
			[144860, `So let it be done`],
			[147190, `I'm sent here by the`],
			[149500, `chosen one`],
			[151980, `So let it be written`],
			[154190, `So let it be done`],
			[156340, `To kill the first-born`],
			[158500, `Pharaoh son`],
			[160200, `I'm creeping death`],
			[239310, `Die by my hand (die)`],
			[242790, `I creep across the land (die)`],
			[245510, `Killing first-born man (die)`],
			[249320, `Die by my hand (die)`],
			[253000, `I creep across the land (die)`],
			[255730, `Killing first born man (die)`],
			[266750, `I rule the midnight air`],
			[269700, `The destroyer`],
			[271330, `Born, I shall soon be there`],
			[274430, `Deadly mass`],
			[275950, `I creep the steps and floor`],
			[279220, `Final darkness`],
			[281060, `Blood, lambs blood`],
			[282500, `painted door`],
			[283800, `I shall pass`],
			[295990, `So let it be written`],
			[298150, `So let it be done`],
			[300480, `I'm sent here by the`],
			[303000, `chosen one`],
			[305590, `So let it be written`],
			[307750, `So let it be done`],
			[310040, `To kill the first-born`],
			[312000, `Pharaoh son`],
			[313540, `I'm creeping death`],
		],
	},
	{
		name: "Seether - Careless Whisper",
		url: "https://www.youtube.com/watch?v=7KTg8WdWk_o",
		lyrics: [
			[30550, `I feel so unsure`],
			[37040, `As I take your hand`],
			[38500, `and lead you to the dance floor`],
			[45310, `As the music dies`],
			[48730, `Something in your eyes`],
			[51960, `Calls to mind a silver screen`],
			[55450, `And all its sad goodbyes`],
			[59850, `I'm never gonna dance again`],
			[62500, `'Cause guilty feet`],
			[63500, `have got no rhythm`],
			[66760, `Though it's easy to pretend`],
			[69700, `I know you're not a fool`],
			[73400, `I should have known better`],
			[74800, `than to cheat a friend`],
			[76960, `And waste the chance`],
			[78500, `that I'd been given`],
			[81080, `So I'm never gonna dance again`],
			[84070, `The way I dance with you`],
			[86820, `I'm never gonna dance again`],
			[87320, `'Cause guilty feet`],
			[87800, `have got no rhythm`],
			[88270, `Though it's easy to pretend`],
			[88760, `I know you're not a fool`],
			[89140, `Time can never mend`],
			[94560, `The careless whispers`],
			[96000, `of a good friend`],
			[102510, `To the heart and mind`],
			[106260, `Ignorance is kind`],
			[109380, `There's no comfort in the truth`],
			[112860, `Pain is all you'll find`],
			[117250, `I'm never gonna dance again`],
			[119830, `'Cause guilty feet`],
			[121000, `have got no rhythm`],
			[124040, `Though it's easy to pretend`],
			[127000, `I know you're not a fool`],
			[159280, `Tonight the music`],
			[160500, `seems so loud`],
			[162940, `I wish that we`],
			[164000, `could lose this crowd`],
			[166590, `Maybe it's better this way`],
			[170030, `We'd hurt each other`],
			[171500, `with things we want to say`],
			[173680, `We could have been`],
			[175000, `so good together`],
			[177110, `We could have lived`],
			[178500, `this dance forever`],
			[180960, `Now, who's gonna`],
			[182500, `dance with me?`],
			[187150, `Please stay`],
			[188860, `I'm never gonna dance again`],
			[191520, `'Cause guilty feet`],
			[192800, `have got no rhythm`],
			[195750, `Though it's easy to pretend`],
			[198630, `I know you're not a fool`],
		],
	},
	{
		name: "Scorpions - Still Loving You",
		url: "https://www.youtube.com/watch?v=7pOr3dBFAeY",
		lyrics: [
			[22088, `Time`],
			[24447, `It needs time`],
			[27005, `To win back your love again`],
			[30752, `I will be there`],
			[35583, `I will be there`],
			[41489, `Love`],
			[43425, `Only love`],
			[45825, `Can bring back your love`],
			[46825, `someday`],
			[49792, `I will be there`],
			[54396, `I will be there`],
			[82718, `Fight`],
			[84764, `Babe, I'll fight`],
			[87201, `To win back your love again`],
			[111170, `I will be there`],
			[115837, `I will be there`],
			[121718, `Love`],
			[123544, `Only love`],
			[126112, `Can bring down the wall`],
			[127112, `someday`],
			[130016, `I will be there`],
			[134598, `I will be there`],
			[141333, `If we'd go again`],
			[144890, `All the way from the start`],
			[150547, `I would try to change`],
			[154197, `The things that killed our`],
			[155197, `love`],
			[159590, `Pride has built a wall, so`],
			[160590, `strong`],
			[164032, `That I can't get through`],
			[166490, `Is there really no chance`],
			[171609, `To start once again?`],
			[174867, `I'm loving you`],
			[178687, `Try`],
			[180707, `Baby, try`],
			[183204, `To trust in my love again`],
			[187096, `I will be there`],
			[191668, `I will be there`],
			[196996, `Love`],
			[199212, `Our love`],
			[201623, `Just shouldn't be thrown`],
			[202623, `away`],
			[205401, `I will be there`],
			[209871, `I will be there`],
			[216658, `If we'd go again`],
			[220151, `All the way from the start`],
			[225644, `I would try to change`],
			[229000, `The things that killed our`],
			[230000, `love`],
			[234372, `Pride has built a wall, so`],
			[235372, `strong`],
			[238802, `That I can't get through`],
			[241281, `Is there really no chance`],
			[246215, `To start once again?`],
			[252074, `If we'd go again`],
			[255432, `All the way from the start`],
			[260895, `I would try to change`],
			[264210, `The things that killed our`],
			[265210, `love`],
			[269214, `Yes, I've hurt your pride`],
			[270214, `and I know`],
			[273703, `What you've been through`],
			[276164, `You should give me a chance`],
			[281189, `This can't be the end`],
			[284245, `I'm still loving you`],
			[292961, `I'm still loving you`],
			[301519, `I'm still loving you`],
			[308104, `I need your love`],
			[310199, `I'm still loving you`],
			[315936, `Still loving you, baby`],
			[318910, `Hoo!`],
			[335028, `I'm still loving you`],
			[341604, `I need your love`],
			[343695, `I'm still loving you`],
			[349940, `I need your love`],
			[352118, `Hoo!`],
			[358181, `I need your love`],
		],
	},
	{
		name: "Vizzen & Protolizard - Heaven Knows",
		url: "https://ncs.io/track/download/a75d47db-0083-4548-8487-d72fc572dd73",
		lyrics: [
			[18326, "What does it mean to be"],
			[19226, "happy?"],
			[20996, "'Cause it looks like we all"],
			[21896, "don't know"],
			[23802, "Glass half full or empty"],
			[26635, "Man, we're just putting on"],
			[27535, "a show"],
			[29643, "Try to look to the heavens"],
			[32009, "To tell us things that we"],
			[32909, "beg to know"],
			[35134, "Like what did this all"],
			[36034, "mean, if there's no"],
			[36934, "tomorrow"],
			[40167, "Oh, you know I tried to"],
			[41067, "find a purpose in my life"],
			[46490, "To drive me, to guard me"],
			[48602, "Oh doctor, I feel dead"],
			[49402, "inside"],
			[71346, "To drive me, to guard me"],
			[73929, "Oh doctor, I feel dead"],
			[74729, "ins-"],
			[114292, "Try to look to the heavens"],
			[116913, "To tell us things that we"],
			[117813, "beg to know"],
			[120234, "Like what did this all"],
			[121134, "mean, if there's no"],
			[122034, "tomorrow"],
			[136160, "Oh, you know I tried to"],
			[137060, "find a purpose in my life"],
			[141950, "To drive me, to guard me"],
			[144217, "Oh doctor, I feel dead"],
			[145017, "inside"],
		],
	},
	{
		name: "Guns N' Roses - November Rain",
		url: "https://www.youtube.com/watch?v=8x23ajWSHyo",
		lyrics: [
			[74160, `When I look into your eyes`],
			[77850, `I can see a love restrained`],
			[87300, `But darling, when I hold you`],
			[90190, `Don't you know I feel the same?`],
			[94860, `Yeah`],
			[99930, `Nothing lasts forever`],
			[102560, `And we both know hearts can`],
			[103560, `change`],
			[111790, `And it's hard to hold a`],
			[112790, `candle`],
			[114930, `In the cold November rain`],
			[124300, `We've been through this such`],
			[125300, `a long, long time`],
			[127330, `Just trying to kill the`],
			[128330, `pain, oh yeah`],
			[135340, `But lovers always come and`],
			[136340, `lovers always go`],
			[138350, `And no one's really sure who's`],
			[139350, `letting go today`],
			[144010, `Walking away`],
			[147770, `If we could take the time to`],
			[148770, `lay it on the line`],
			[150690, `I could rest my head just`],
			[151690, `knowing that you were mine`],
			[156290, `All mine`],
			[161400, `So if you want to love me`],
			[164450, `Then darling, don't refrain`],
			[173740, `Or I'll just end up walking`],
			[176650, `In the cold November rain`],
			[183930, `Do you need some time on`],
			[184930, `your own?`],
			[190080, `Do you need some time all`],
			[191080, `alone?`],
			[195740, `Ooh, everybody needs some`],
			[196740, `time on their own`],
			[201840, `Ooh, don't you know you need`],
			[202840, `some time all alone?`],
			[210030, `I know it's hard to keep an`],
			[211030, `open heart`],
			[215780, `When even friends seem out`],
			[216780, `to harm you`],
			[221990, `But if you could heal a`],
			[222990, `broken heart`],
			[227870, `Wouldn't time be out to`],
			[228870, `charm you?`],
			[231490, `Oh, oh, oh, oh, oh`],
			[283570, `Sometimes I need some time`],
			[284570, `on my own`],
			[289890, `Sometimes I need some time`],
			[290890, `all alone`],
			[295470, `Ooh, everybody needs some`],
			[296470, `time on their own`],
			[301720, `Ooh, don't you know you need`],
			[302720, `some time all alone?`],
			[337790, `And when your fears subside`],
			[340690, `And shadows still remain,`],
			[341690, `oh yeah`],
			[350060, `I know that you can love me`],
			[352850, `When there's no one left to`],
			[353850, `blame`],
			[362040, `So never mind the darkness`],
			[365160, `We still can find a way`],
			[374180, `Nothing lasts forever`],
			[376860, `Even cold November rain`],
			[451300, `You're not the only one`],
			[454100, `You're not the only one`],
			[456550, `Don't you think that you`],
			[457550, `need somebody?`],
			[459250, `Don't you think that you`],
			[460250, `need someone?`],
			[461950, `Everybody needs somebody`],
			[464480, `You're not the only one`],
			[467160, `You're not the only one`],
			[469840, `Don't you think that you`],
			[470840, `need somebody?`],
			[472610, `Don't you think that you`],
			[473610, `need someone?`],
			[475100, `Everybody needs somebody`],
			[477710, `You're not the only one`],
			[480320, `You're not the only one`],
			[482970, `Don't you think that you`],
			[483970, `need somebody?`],
			[485490, `Don't you think that you`],
			[486490, `need someone?`],
			[488210, `Everybody needs somebody`],
			[490810, `You're not the only one`],
			[493260, `You're not the only one`],
			[496030, `Don't you think that you`],
			[497030, `need somebody?`],
			[498780, `Don't you think that you`],
			[499780, `need someone?`],
			[501350, `Everybody needs somebody`]
		],
	},
	{
		name: "Evanescence - Tourniquet",
		url: "https://www.youtube.com/watch?v=sONn94Bc694",
		lyrics: [
			[40040, `I tried to kill the pain`],
			[44480, `But only brought more`],
			[45480, `(So much more)`],
			[49440, `I lay dying`],
			[51520, `And I'm pouring crimson`],
			[52520, `regret and betrayal`],
			[58860, `I'm dying, praying,`],
			[59860, `bleeding and screaming`],
			[68320, `Am I too lost to be saved`],
			[72980, `Am I too lost?`],
			[77620, `My God my tourniquet`],
			[80940, `Return to me salvation`],
			[87020, `My God my tourniquet`],
			[90280, `Return to me salvation`],
			[96440, `Do You remember me?`],
			[101120, `Lost for so long`],
			[105870, `Will You be on the`],
			[106870, `other side?`],
			[110320, `Or will You forget me?`],
			[115260, `I'm dying, praying,`],
			[116260, `bleeding and screaming`],
			[124700, `Am I too lost to be saved`],
			[129360, `Am I too lost?`],
			[134060, `My God my tourniquet`],
			[137320, `Return to me salvation`],
			[143360, `My God my tourniquet`],
			[146740, `Return to me salvation`],
			[156280, `(Return to me salvation)`],
			[169040, `(I want to die)`],
			[171640, `My God my tourniquet`],
			[174940, `Return to me salvation`],
			[180940, `My God my tourniquet`],
			[184300, `Return to me salvation`],
			[190440, `My wounds cry for the grave`],
			[194870, `My soul cries for`],
			[195870, `deliverance`],
			[199570, `Will I be denied Christ`],
			[205070, `Tourniquet`],
			[206540, `My suicide`],
			[211920, `(Return to me salvation)`],
			[221000, `(Return to me salvation)`]
		],
	},
	{
		name: "Judas Priest - Painkiller",
		url: "https://www.youtube.com/watch?v=kO_EdmtR5Ck",
		lyrics: [
			[26660, `Faster than a bullet`],
			[29100, `Terrifying scream`],
			[31250, `Enraged and full of anger`],
			[33190, `He's half man and half`],
			[34190, `machine`],
			[35940, `Rides the Metal Monster`],
			[38370, `Breathing smoke and fire`],
			[40670, `Closing in with vengeance`],
			[41670, `soaring high`],
			[45310, `He`],
			[46510, `Is`],
			[47640, `The Painkiller`],
			[49970, `This`],
			[51140, `Is`],
			[52250, `The Painkiller`],
			[54440, `Planets devastated`],
			[56910, `Mankind's on its knees`],
			[59040, `A saviour comes from out the`],
			[60040, `skies`],
			[61280, `In answer to their pleas`],
			[63630, `Through boiling clouds of`],
			[64630, `thunder`],
			[66200, `Blasting bolts of steel`],
			[68650, `Evils going under deadly`],
			[69650, `wheels`],
			[73210, `He`],
			[74380, `Is`],
			[75450, `The Painkiller`],
			[77870, `This`],
			[79040, `Is`],
			[80170, `The Painkiller`],
			[101120, `Faster than a laser bullet`],
			[105720, `Louder than an atom bomb`],
			[110570, `Chromium-plated boiling`],
			[111570, `metal`],
			[115140, `Brighter than a thousand`],
			[116140, `suns`],
			[216370, `Flying high on rapture`],
			[218640, `Stronger, free and brave`],
			[220950, `Nevermore encaptured`],
			[222700, `They've been brought back`],
			[223700, `from the grave`],
			[225430, `With mankind resurrected`],
			[227710, `Forever to survive`],
			[230090, `Returns from Armageddon to`],
			[231090, `the skies`],
			[234940, `He`],
			[236070, `Is`],
			[237150, `The Painkiller`],
			[239660, `This`],
			[240800, `Is`],
			[241890, `The Painkiller`],
			[244240, `Wings`],
			[245450, `Of`],
			[246560, `Steel`],
			[247160, `Painkiller`],
			[248860, `Deadly`],
			[251200, `Wheels`],
			[251850, `Painkiller`],
			[281520, `He`],
			[282570, `Is`],
			[283720, `The Painkiller`],
			[286140, `This`],
			[287270, `Is`],
			[288400, `The Painkiller`],
			[290750, `He`],
			[291910, `Is`],
			[293060, `The Painkiller`],
			[295390, `This`],
			[296520, `Is`],
			[297730, `The Painkiller`],
			[300130, `Pain`],
			[301210, `Pain`],
			[302430, `Killer`],
			[303530, `Killer`],
			[304750, `Pain`],
			[305850, `Pain`],
			[307050, `Killer`],
			[308170, `Killer`],
			[323390, `Pain`],
			[332810, `Can't`],
			[334190, `Stop`],
			[335540, `The Painkiller`],
			[358000, `Pain`]
		],
	},
	{
		name: "Eminem: Mockingbird",
		url: "https://github.com/oe2735/music/raw/refs/heads/main/Eminem_-_Mockingbird_(Hydr0.org).mp3",
		lyrics: [
			[2500, `Yeah`],
			[4660, `I know sometimes`],
			[6069, `Things may not always make`],
			[7694, `sense to you right now`],
			[10280, `But hey`],
			[11950, `What Daddy always tell you?`],
			[13956, `Straighten up, little soldier`],
			[16466, `Stiffen up that upper lip`],
			[19223, `What you cryin' about?`],
			[21145, `You got me`],
			[22300, `Hailie, I know you`],
			[22990, `miss your mom,`],
			[23812, `and I know you miss your dad`],
			[25230, `When I'm gone, but I'm tryin'`],
			[26202, `to give you the life`],
			[26988, `that I never had`],
			[28300, `I can see you're sad,`],
			[28992, `even when you smile,`],
			[30016, `even when you laugh`],
			[31106, `I can see it in your eyes,`],
			[32590, `deep inside you wanna cry`],
			[33960, `'Cause you're scared,`],
			[34686, `I ain't there, Daddy's wit'`],
			[35379, `you in your prayers`],
			[36623, `No more cryin',`],
			[37405, `wipe them tears,`],
			[38246, `Daddys here no more nightmares`],
			[39615, `We gon' pull together`],
			[40569, `through it, we gon' do it`],
			[41752, `Lainie, Uncles crazy, aint he?`],
			[43044, `Yeah, but he loves you, girl,`],
			[44353, `and you better know it`],
			[45323, `We're all we got in this world`],
			[46579, `when it spins, when it swirls`],
			[48098, `When it whirls, when it twirls`],
			[49552, `two little beautiful girls`],
			[51028, `Lookin' puzzled, in a daze,`],
			[52361, `I know it's confusin' you`],
			[53903, `Daddy's always on the move,`],
			[55245, `Mama's always on the news`],
			[56575, `I try to keep you sheltered`],
			[57715, `from it, but somehow it seems`],
			[59082, `The harder that I try`],
			[59969, `to do that, the more`],
			[60864, `it backfires on me`],
			[61833, `All the things growin' up`],
			[63335, `as Daddy that he had to see`],
			[64708, `Daddy don't want you to see,`],
			[66154, `but you see just as`],
			[67046, `much as he did`],
			[67926, `We did not plan it to be`],
			[68888, `this way, your mother and me`],
			[70435, `But things have got`],
			[71106, `so bad between us, I don't`],
			[72044, `see us ever bein' together`],
			[73793, `ever again, like we used to`],
			[75468, `be when we was teenagers`],
			[76593, `But then, of course,`],
			[77523, `everything always happens`],
			[78831, `for a reason, I guess it was`],
			[80170, `never meant to be`],
			[81453, `But it's just somethin we have`],
			[82548, `no control over, and that's`],
			[83668, `what destiny is`],
			[84602, `But no more worries,`],
			[86073, `rest your head and go to sleep`],
			[87303, `Maybe one day we'll wake up`],
			[88708, `and thisll all just be a dream`],
			[90204, `Now hush, little baby,`],
			[92111, `don't you cry`],
			[93499, `Everything's gonna be alright`],
			[94800, `Stiffen that upper lip up,`],
			[96705, `little lady, I told ya`],
			[98402, `Daddy's here to hold ya`],
			[99801, `through the night`],
			[101108, `I know Mommy's not here`],
			[102407, `right now and we dont know why`],
			[104610, `We feel how we feel inside`],
			[106486, `It may seem a little`],
			[107675, `crazy, pretty baby`],
			[109571, `But I promise Mama's`],
			[111158, `gon' be alright`],
			[112282, `Heh, it's funny`],
			[113205, `I remember back one year when`],
			[114970, `Daddy had no money`],
			[116155, `Mommy wrapped the Christmas`],
			[116999, `presents up and stuck 'em`],
			[118014, `under the tree and said`],
			[119100, `some of 'em were from me cause`],
			[120211, `Daddy couldn't buy 'em`],
			[121540, `Ill never forget that Chrismas`],
			[122940, `I sat up the whole night`],
			[124229, `crying cause Daddy felt`],
			[125658, `like a bum see Daddy had a job`],
			[126494, `But his job was to keep the`],
			[128128, `food on the table for`],
			[129196, `you and Mom and at the time,`],
			[131111, `every house that we lived in`],
			[132514, `Either kept gettin`],
			[133400, `broken into and robbed or`],
			[134869, `shot up on the block`],
			[136000, `And your Mom was savin'`],
			[137162, `money for you in a jar`],
			[138696, `Tryin to start a piggy bank`],
			[139884, `for you so you could`],
			[140750, `go to college`],
			[141465, `Almost had a thousand dollars`],
			[142736, `til someone broke in`],
			[144261, `and stole it an I know it hurt`],
			[145577, `so bad it broke`],
			[146341, `your Mama's heart`],
			[147420, `And it seemed like everything`],
			[148366, `was just startin to fall apart`],
			[150200, `Mom and Dad was arguin' a lot`],
			[151856, `So Mama moved back on to`],
			[153313, `Chalmers in the flat,`],
			[154425, `one-bedroom apartment`],
			[155880, `And Dad moved back to the`],
			[157000, `other side of 8 Mile on Novara`],
			[158457, `And that's when Daddy went`],
			[159775, `to California with his CD`],
			[161518, `And met Dr. Dre, and flew`],
			[162489, `you and Mama out to see me`],
			[164118, `But Daddy had to work,`],
			[165668, `you and Mama had to leave me`],
			[167119, `Then you started seein`],
			[168026, `Daddy on the TV`],
			[169041, `And Mama didn't like it`],
			[170491, `And you and Lainie were`],
			[171657, `too young to understand it`],
			[172886, `Papa was a rolling stone,`],
			[174245, `Mama developed a habit`],
			[175658, `And it all happened too fast`],
			[177078, `for either one o us to grab it`],
			[178465, `I'm just sorry you were there`],
			[179870, `an had to witness it firsthand`],
			[181304, `'Cause all I ever wanted to do`],
			[182669, `was just make you proud`],
			[184025, `Now I'm sittin' in this`],
			[185275, `empty house just reminiscin'`],
			[187070, `Lookin' at your baby pictures,`],
			[188546, `it just trips me out`],
			[189473, `To see how much you both`],
			[190526, `have grown, it's almost like`],
			[191481, `you're sisters now`],
			[192969, `Wow, guess you pretty much are`],
			[194732, `and Daddy's still here`],
			[195851, `Lainie, I'm talkin' to you too`],
			[197500, `Daddy's still here`],
			[198829, `I like the sound of that, yeah`],
			[200125, `its got a ring to it, dont it?`],
			[201722, `Shh, Mama's only gone`],
			[203030, `for the moment`],
			[203962, `Now hush, little baby,`],
			[205482, `don't you cry`],
			[207053, `Everything's gonna be alright`],
			[208832, `Stiffen that upper lip up,`],
			[210235, `little lady, I told ya`],
			[211972, `Daddy's here to hold ya`],
			[213332, `through the night`],
			[214487, `I know Mommy's not here`],
			[215875, `right now and we dont know why`],
			[218281, `We feel how we feel inside`],
			[220129, `It may seem a little`],
			[221169, `crazy, pretty baby`],
			[223155, `But I promise Mama's`],
			[224627, `gon' be alright`],
			[225865, `And if you ask me to, Daddy's`],
			[227328, `gonna buy you a mockingbird`],
			[229718, `I'ma give you the world`],
			[231082, `I'ma buy a diamond ring`],
			[233000, `for you, I'ma sing for you`],
			[234532, `I'll do anything for you`],
			[236016, `to see you smile`],
			[237228, `And if that mockingbird don't`],
			[238843, `sing and that ring don't shine`],
			[240982, `I'ma break that birdie's neck`],
			[242699, `I'll go back to the`],
			[243868, `jeweler who sold it to ya`],
			[245633, `And make him eat every carat,`],
			[247342, `don't Fuck with Dad`],
			[248564, `(Haha)`],
		],
	},
	{
		name: "The Neighborhood: Sweater Weather",
		url: "https://github.com/oe2735/music/raw/refs/heads/main/The_Neighboorhood_-_Sweater_Weather_(Hydr0.org).mp3",
		lyrics: [
			[20957, "And all I am is a man"],
			[24559, "I want the world in my hands"],
			[28200, "I hate the beach"],
			[30535, "But I stand in California"],
			[33901, "with my toes in the sand"],
			[36100, "Use the sleeves of my sweater"],
			[38119, "Let's have an adventure"],
			[40288, "Head in the clouds"],
			[41600, "but my gravity centered"],
			[44140, "Touch my neck"],
			[45844, "and I'll touch yours"],
			[47931, "You in those little"],
			[49358, "high waisted shorts, oh"],
			[52969, "She knows what I think about"],
			[55400, "And what I think about"],
			[56800, "One love, two mouths"],
			[58913, "One love, one house"],
			[60607, "No shirt, no blouse"],
			[62627, "Just us, you find out"],
			[64384, "Nothing that I wouldn't wanna"],
			[65400, "tell you about, no"],
			[67000, "'Cause it's too cold"],
			[71187, "For you here"],
			[73917, "And now, so let me hold"],
			[78878, "Both your hands in"],
			[81500, "the holes of my sweater"],
			[83666, "And if I may just take"],
			[84600, "your breath away"],
			[85633, "I don't mind if there's"],
			[86521, "not much to say"],
			[87546, "Sometimes the silence"],
			[88333, "guides a mind"],
			[89468, "To move to a place so far away"],
			[91969, "The goosebumps start to raise"],
			[93402, "The minute that my left hand"],
			[94222, "meets your waist"],
			[95900, "And then I watch your face"],
			[97300, "Put my finger on your tongue"],
			[98100, "'cause you love to taste, yeah"],
			[100053, "These hearts adore, everyone"],
			[101600, "the other beats hardest for"],
			[103200, "Inside this place is warm"],
			[105200, "Outside it starts to pour"],
			[107945, "Coming down"],
			[109001, "One love, two mouths"],
			[111128, "One love, one house"],
			[112974, "No shirt, no blouse"],
			[114827, "Just us, you find out"],
			[116573, "Nothing that I wouldn't wanna"],
			[117363, "tell you about, no, no, no"],
			[121456, "'Cause it's too cold"],
			[125367, "For you here"],
			[128136, "And now, so let me hold"],
			[133068, "Both your hands in"],
			[135730, "the holes of my sweater"],
			[137000, "'Cause it's too cold"],
			[141000, "For you here"],
			[143643, "And now, so let me hold"],
			[148544, "Both your hands in"],
			[151275, "the holes of my sweater"],
			[153503, "Whoa, whoa, whoa"],
			[166200, "Whoa, whoa, whoa"],
			[173900, "Whoa, whoa, whoa"],
			[181651, "Whoa, whoa, whoa"],
			[189360, "Whoa, whoa, whoa"],
			[197069, "Whoa, whoa, whoa"],
			[202500, "'Cause it's too cold"],
			[206658, "For you here"],
			[209372, "And now, so let me hold"],
			[214380, "Both your hands in"],
			[217034, "the holes of my sweater"],
			[218300, "It's too cold"],
			[222133, "For you here"],
			[224871, "And now, let me hold"],
			[229934, "Both your hands in"],
			[232466, "the holes of my sweater"],
			[235598, "And it's too cold,"],
			[237606, "it's too cold"],
			[240600, "The holes of my sweater"],
		],
	},
	{
		name: "Eminem: Rap God",
		url: "https://github.com/oe2735/music/raw/refs/heads/main/Eminem%20-%20Rap%20God%20(Explicit)%20%5BXbGs_qK2PQA%5D.mp3",
		lyrics: [
			[869, `Look,`],
			[2000, `I was gonna go easy on`],
			[2700, `you not to hurt your feelings`],
			[4571, `But I'm only goin' to get`],
			[6729, `this one chance`],
			[9600, `Something's wrong,`],
			[10300, `I can feel it`],
			[11500, `Just a feelin' I've got, like`],
			[14400, `somethings about to happen`],
			[15885, `but I don't know what`],
			[17674, `If that means what`],
			[18369, `I think it means,`],
			[19215, `we're in trouble, big trouble`],
			[20924, `And if he is as bananas as you`],
			[21858, `say, I'm not takin any chances`],
			[24337, `ur just what the doc ordered`],
			[25692, `I'm beginnin' to feel`],
			[26904, `like a Rap God, Rap God`],
			[28870, `All my people from the front`],
			[30261, `to the back nod, back nod`],
			[32046, `Now, who thinks their arms are`],
			[33094, `long enough to slap box,`],
			[34805, `slap box?`],
			[35380, `They said I rap like a`],
			[36093, `robot, so call me Rap-bot`],
			[37624, `But for me to rap like a`],
			[38500, `computer it mus be in my genes`],
			[40059, `I got a laptop in`],
			[40805, `my back pocket`],
			[41681, `My pen'll go off when I`],
			[42496, `half-cock it, got a fat knot`],
			[43528, `from that rap profit`],
			[44915, `Made a livin' and a killin off`],
			[45748, `it, ever since Bill Clinton`],
			[46998, `was still in office`],
			[47873, `With Monica Lewinsky`],
			[48595, `feelin' on his nut sack`],
			[49858, `I'm an MC still as honest, but`],
			[51014, `as rude and as`],
			[51717, `indecent as all hell`],
			[52606, `Syllables, skill-a-holic`],
			[53804, `(kill 'em all with)`],
			[54442, `This flippity dippity-hippity`],
			[55162, `hip-hop, you dont really wanna`],
			[56254, `get into a pissin' match`],
			[57251, `With this rappity brat, packin`],
			[58105, `a MAC in the back of the Ac',`],
			[59491, `backpack rap crap,`],
			[60298, `yap-yap, yackety-yack`],
			[61261, `And at the exact same time, I`],
			[62058, `attempt these lyrical acrobat`],
			[63120, `stunts while im practicin that`],
			[64296, `I'll still be able to break a`],
			[65356, `Motherfucking table over the`],
			[66025, `back of a couple of Faggots and`],
			[66706, `crack it in half`],
			[67499, `Only realized it was ironic, I`],
			[68904, `was signed to aftermath`],
			[70283, `after the fact`],
			[71388, `How could I not blow?`],
			[72231, `All I do is drop F-bombs,`],
			[73299, `feel my wrath of attack`],
			[74203, `Rappers are havin' a rough`],
			[75074, `time period, here's a maxi pad`],
			[76666, `It's actually disastrously bad`],
			[78226, `for the wack while I'm`],
			[79000, `masterfully constructin' this`],
			[80222, `masterpiece`],
			[80944, `'Cause I'm beginnin' to feel`],
			[82017, `like a Rap God, Rap God`],
			[84032, `All my people from the front`],
			[85572, `to the back nod, back nod`],
			[87142, `Now, who thinks their arms are`],
			[88403, `long enough to slap box,`],
			[89586, `slap box?`],
			[90400, `Let me show u maintainin' this`],
			[91696, `shit aint that hard, that hard`],
			[93500, `Everybody want the key and the`],
			[94455, `secret to rap immortality`],
			[95700, `like I have got`],
			[96890, `Well, to be truthful the`],
			[97569, `blueprint's, simply rage and`],
			[98765, `youthful exuberance`],
			[99532, `Everybody loves to root for a`],
			[100600, `nuisance, hit the Earth`],
			[101500, `like an asteroid`],
			[102105, `Did nothin' but shoot for`],
			[103002, `the Moon since (pew)`],
			[104200, `MCs get taken to school with`],
			[105400, `this music 'cause I use it as`],
			[106600, `a vehicle to, "Bus the rhyme"`],
			[107898, `Now I lead a new school`],
			[108634, `full of students`],
			[109600, `Me? I'm a product of Rakim,`],
			[110984, `Lakim Shabazz, 2Pac, N.W.A,`],
			[113125, `Cube, hey Doc, Ren`],
			[114341, `Yella, Eazy, thank you,`],
			[115046, `they got Slim`],
			[115797, `Inspired enough to one day`],
			[117043, `grow up, blow up and`],
			[117859, `be in a position`],
			[119182, `To meet Run-D.M.C.,`],
			[120060, `and induct them into`],
			[120957, `the Motherfucking`],
			[121683, `Rock n Roll Hall of Fame even`],
			[123400, `though I'll walk in the church`],
			[124400, `and burst in a ball of flames`],
			[125700, `Only Hall of Fame I'll be`],
			[126600, `inducted in is the alcohol of`],
			[128108, `fame on the wall of (shame)`],
			[129769, `You fags think it's all a game`],
			[131300, `'til I walk a flock of flames`],
			[133169, `Off a plank and, tell me what`],
			[134400, `in the Fuck are you thinkin'?`],
			[135892, `Little gay lookin' boy,`],
			[136766, `so gay I can barely say it`],
			[138058, `with a straight face,`],
			[138700, `lookin' boy (haha)`],
			[139400, `You're witnessin' a mass-occur`],
			[140200, `like you're watchin' a church`],
			[140800, `gatherin' take place,`],
			[141826, `lookin' boy`],
			[142800, `"Oy vey, that boy's gay",`],
			[144300, `that's all they say,`],
			[145100, `lookin' boy`],
			[145750, `You get a thumbs up, pat on`],
			[146500, `the back and a way to go from`],
			[147600, `your label every day,`],
			[148400, `lookin' boy`],
			[149100, `Hey, lookin' boy,`],
			[149700, `what you say, lookin' boy?`],
			[150568, `I get a, hell yeah from Dre,`],
			[151600, `lookin' boy`],
			[152222, `I'ma work for everythin I have`],
			[153600, `never asked nobody for shit,`],
			[154569, `get outta my face, lookin' boy`],
			[155500, `Basically, boy, you're never`],
			[156217, `gonna be capable of keepin' up`],
			[157541, `with the same pace,`],
			[158120, `lookin' boy, 'cause`],
			[158926, `I'm beginnin' to feel`],
			[159869, `like a Rap God, Rap God`],
			[161833, `All my people from the front`],
			[163240, `to the back nod, back nod`],
			[164998, `The way I'm racin' around the`],
			[166100, `track, call me NASCAR, NASCAR`],
			[168353, `Dale Earnhardt of the trailer`],
			[169400, `park, the White Trash God`],
			[170735, `Kneel before General Zod,`],
			[172270, `this planet's Krypton,`],
			[173131, `no, Asgard, Asgard`],
			[174696, `So you'll be Thor,`],
			[175589, `and I'll be Odin, you rodent,`],
			[177098, `I'm omnipotent`],
			[178400, `Let off, then I'm reloadin',`],
			[179689, `immediately with these`],
			[180700, `bombs I'm totin'`],
			[181800, `And I should not be woken`],
			[183200, `I'm the walkin' dead,`],
			[183969, `but I'm just a talkin' head,`],
			[185300, `a zombie floatin', but I got`],
			[186900, `your mom deepthroating`],
			[188030, `I'm out my Ramen Noodle, we`],
			[189700, `have nothin' in common, poodle`],
			[191142, `I'm a Doberman,`],
			[191900, `pinch yourself in the arm`],
			[192947, `and pay homage, pupil`],
			[194603, `It's me, my honesty's brutal`],
			[196940, `But it's honestly futile if I`],
			[198600, `don't utilize what I do though`],
			[200054, `For good, at least`],
			[200844, `once in a while`],
			[201495, `So I wanna make sure somewhere`],
			[202500, `in this chicken scratch I`],
			[203200, `scribble and doodle`],
			[204052, `enough rhymes`],
			[204750, `To maybe try to help get some`],
			[205989, `people through tough times`],
			[207200, `But I gotta keep a few`],
			[207940, `punchlines just in case 'cause`],
			[209300, `even you unsigned`],
			[210200, `Rappers are hungry lookin'`],
			[211269, `at me like it's lunchtime`],
			[212800, `I know there was a time where`],
			[213727, `once I was king of`],
			[215000, `the underground`],
			[215569, `But I still rap like I'm`],
			[216269, `on my Pharoahe Monch grind`],
			[217600, `So I crunch rhymes, but`],
			[218652, `sometimes when you combine`],
			[220169, `Appeal with the`],
			[220700, `skin color of mine`],
			[221765, `You get too big and here they`],
			[222700, `come tryin' to censor`],
			[223700, `you like that one line`],
			[224800, `I said on, I'm back from`],
			[225959, `The Mathers LP 1 when`],
			[226969, `I tried to say I'll take seven`],
			[228500, `kids from Columbine`],
			[229996, `Put 'em all in a line, add an`],
			[230900, `AK-47, a revolver and a .9`],
			[233600, `See if I get away with it now`],
			[234729, `that I ain't as big as I was,`],
			[236100, `but I'm`],
			[236747, `Morphin' into an immortal,`],
			[238243, `comin' through the portal`],
			[239259, `You're stuck in a time`],
			[240150, `warp from 2004 though`],
			[241570, `And I don't know what the`],
			[242495, `Fuck that you rhyme for`],
			[243700, `You're pointless as Rapunzel`],
			[244801, `with Fuckin' cornrows`],
			[246500, `You write normal?`],
			[247159, `Fuck bein' normal`],
			[248300, `And I just bought a new`],
			[248822, `raygun from the future`],
			[250061, `Just to come and shoot u, like`],
			[251200, `when Fabolous made Ray J mad`],
			[252681, `'Cause Fab said he looked like`],
			[253570, `a fag at Mayweather's pad`],
			[254347, `singin' to a man while`],
			[255086, `he played piano`],
			[256200, `Man, oh man, that was a 24-7`],
			[257800, `special on the cable channel`],
			[259427, `So Ray J went straight to the`],
			[260300, `radio station, the very next`],
			[261500, `day, "Hey Fab, I'ma kill you"`],
			[263300, `Lyrics comin' at you at`],
			[263974, `supersonic speed`],
			[265269, `Uh, summa-lumma, dooma-lumma,`],
			[266400, `you assumin' I'm a human`],
			[267400, `What I gotta do to get it`],
			[268012, `through to you? I'm superhuman`],
			[268835, `Innovative and I'm made of`],
			[269800, `rubber so that anythin you say`],
			[270749, `is ricochetin' off of me, and`],
			[271540, `it'll glue to you and I'm`],
			[272192, `devastatin', more than ever`],
			[273013, `demonstratin', how to give a`],
			[273815, `Motherfuckin audience a feelin`],
			[274623, `like it's levitatin'`],
			[275527, `Never fadin' and I know the`],
			[276240, `haters are forever waitin' for`],
			[277200, `the day that they can say I`],
			[277880, `fell off, theyll be celebratin`],
			[278548, `Cause I know the way to get em`],
			[279345, `motivated, I make elevatin'`],
			[280300, `music, you make elevator music`],
			[282083, `"Oh, hes too mainstream", well`],
			[283404, `that's what they do when they`],
			[284300, `get jealous, they confuse it`],
			[285349, `"It's not hip-hop, it's pop"`],
			[286795, `'cause I found a`],
			[287479, `hella way to fuse it`],
			[288601, `With rock, shock rap with Doc,`],
			[290291, `throw on "Lose Yourself"`],
			[290983, `and make 'em lose it`],
			[291840, `I don't know how to make songs`],
			[292759, `like that, I don't know`],
			[293900, `what words to use`],
			[295000, `Let me know when it occurs to`],
			[295938, `you while I'm rippin' any one`],
			[296842, `of these verses that versus u`],
			[298032, `Its curtains, Im inadvertently`],
			[299001, `hurtin' you, how many`],
			[299832, `verses I gotta murder to`],
			[301169, `Prove that if you were half as`],
			[302346, `nice, your songs, you could`],
			[303364, `sacrifice virgins too?`],
			[304499, `Ugh, school flunky,`],
			[306139, `pill junkie, but look at the`],
			[307613, `accolades this skills brung me`],
			[309365, `Full of myself,`],
			[310078, `but still hungry`],
			[311300, `I bully myself 'cause I make`],
			[312340, `me do what I put my mind to`],
			[314000, `And I'm a million leagues`],
			[315700, `above you, ill when I`],
			[316963, `speak in tongues`],
			[317690, `But it's still`],
			[318405, `tongue-in-cheek, Fuck you`],
			[319299, `I'm drunk, so, Satan, take the`],
			[321000, `Fucking wheel, I'ma sleep`],
			[322100, `in the front seat`],
			[322800, `Bumpin' Heavy D and the Boyz,`],
			[324213, `still "Chunky but Funky"`],
			[326081, `But in my head`],
			[326818, `there's somethin' I can feel`],
			[327900, `tuggin' and strugglin'`],
			[329252, `Angels fight with devils and`],
			[330867, `here's what they want from me`],
			[332900, `They're askin' me to eliminate`],
			[333900, `some of the women hate`],
			[334700, `But if you take into`],
			[335400, `consideration the bitter`],
			[336213, `hatred I have, then you may be`],
			[337300, `a little patient, and more`],
			[338115, `sympathetic to the situation`],
			[339588, `And understand the`],
			[340207, `discrimination`],
			[341700, `But Fuck it, life's handin you`],
			[343240, `lemons? Make lemonade then`],
			[344500, `But if I cant batter the women`],
			[346000, `How the Fuck am I supposed`],
			[346834, `to bake 'em a cake, then?`],
			[348300, `Don't mistake him for Satan`],
			[349285, `It's a fatal mistake if you`],
			[350269, `think I need to be overseas`],
			[351533, `and take a vacation`],
			[352717, `To trip a broad, and make`],
			[353800, `her fall on her face and`],
			[355148, `Don't be a retard, be a king?`],
			[356976, `Think not, why be a king`],
			[359100, `when you can be a God?`],
		],
	},
	{
		name: "The Kid Laroi: Stay",
		url: "https://github.com/oe2735/music/raw/refs/heads/main/The%20Kid%20LAROI,%20Justin%20Bieber%20-%20STAY%20(Official%20Video)%20%5BkTJczUoc26U%5D.mp3",
		lyrics: [
			[30600, "I do the same"],
			[31500, "thing I told you that"],
			[32399, "I never would"],
			[33325, "I told you I'd change,"],
			[34347, "even when I knew I never could"],
			[36018, "I know that I can't"],
			[37133, "find nobody else as good as u"],
			[38797, "I need you to stay,"],
			[39822, "need you to stay, hey (oh)"],
			[42100, "I get drunk,"],
			[42869, "wake up,"],
			[43755, "I'm wasted still"],
			[44922, "I realize the time"],
			[46235, "that I wasted here"],
			[47700, "I feel like"],
			[48511, "you can't feel the way I feel"],
			[50479, "Oh, I'll be Fucked up"],
			[51699, "if you can't be right here"],
			[53128, "Oh, ooh-woah"],
			[54500, "(oh, ooh-woah, ooh-woah)"],
			[55948, "Oh, ooh-woah"],
			[57416, "(oh, ooh-woah, ooh-woah)"],
			[58774, "Oh, ooh-woah"],
			[59900, "(oh, ooh-woah, ooh-woah)"],
			[61387, "Oh, I'll be Fucked up"],
			[62959, "if you can't be right here"],
			[64384, "I do the same"],
			[65500, "thing I told you that"],
			[66141, "I never would"],
			[67188, "I told you I'd change,"],
			[68218, "even when I knew I never could"],
			[69909, "I know that I can't"],
			[70925, "find nobody else as good as u"],
			[72730, "I need you to stay,"],
			[73869, "need you to stay, hey"],
			[75800, "I do the same"],
			[76800, "thing I told you that"],
			[77600, "I never would"],
			[78467, "I told you I'd change,"],
			[79539, "even when I knew I never could"],
			[81217, "I know that I can't"],
			[82353, "find nobody else as good as u"],
			[84004, "I need you to stay,"],
			[85260, "need you to stay, hey"],
			[87106, "When I'm away from you,"],
			[88438, "I miss your touch (ooh)"],
			[90057, "You're the reason"],
			[90762, "I believe in love"],
			[92876, "It's been difficult"],
			[93817, "for me to trust (ooh)"],
			[95653, "And I'm afraid that"],
			[96320, "I'ma Fuck it up"],
			[98560, "Ain't no way"],
			[99133, "that I can leave you stranded"],
			[101364, "'Cause you ain't ever"],
			[102100, "left me empty-handed"],
			[104129, "And you know that I know that"],
			[105810, "I can't live without you"],
			[107823, "So, baby, stay"],
			[109657, "Oh, ooh-woah"],
			[111013, "(oh, ooh-woah, ooh-woah)"],
			[112382, "Oh, ooh-woah"],
			[113799, "(oh, ooh-woah, ooh-woah)"],
			[115300, "Oh, ooh-woah"],
			[116585, "(oh, ooh-woah, ooh-woah)"],
			[117900, "I'll be Fucked up"],
			[119500, "if you can't be right here"],
			[120900, "I do the same"],
			[121900, "thing I told you that"],
			[122800, "I never would"],
			[123535, "I told you I'd change,"],
			[124625, "even when I knew I never could"],
			[126351, "I know that I can't"],
			[127624, "find nobody else as good as u"],
			[129142, "I need you to stay,"],
			[130318, "need you to stay, hey"],
			[132319, "I do the same"],
			[133150, "thing I told you that"],
			[134000, "I never would"],
			[134775, "I told you I'd change,"],
			[135978, "even when I knew I never could"],
			[137614, "I know that I can't"],
			[138753, "find nobody else as good as u"],
			[140407, "I need you to stay,"],
			[141500, "need you to stay, hey"],
			[148700, "Woah-oh"],
			[151991, "I need you to stay,"],
			[152856, "need you to stay, hey"],
		],
	},
	{
		name: "The Weeknd: Blinding Lights",
		url: "https://github.com/oe2735/music/raw/refs/heads/main/The_Weekend_-_Blinding_lights_(Hydr0.org).mp3",
		lyrics: [
			[13769, "Yeah"],
			[27492, "I've been tryna call"],
			[30043, "I've been on my own"],
			[31269, "for long enough"],
			[32800, "Maybe you can show me"],
			[34169, "how to love, maybe"],
			[38547, "I'm goin' through withdrawals"],
			[41241, "You don't even have"],
			[42242, "to do too much"],
			[44119, "You can turn me on"],
			[45082, "with just a touch, baby"],
			[49691, "I look around and"],
			[50693, "Sin City's cold and empty"],
			[53121, "(oh)"],
			[53705, "No one's around to judge me"],
			[55880, "(oh)"],
			[56304, "I can't see clearly"],
			[57923, "when you're gone"],
			[60842, "I said, ooh,"],
			[63645, "I'm blinded by the lights"],
			[66841, "No, I can't sleep until"],
			[68631, "I feel your touch"],
			[72172, "I said, ooh,"],
			[75230, "I'm drowning in the night"],
			[78004, "Oh, when I'm like this,"],
			[79852, "you're the one I trust"],
			[82123, "(Hey, hey, hey)"],
			[94469, "I'm running out of time"],
			[97366, "'Cause I can see the"],
			[98220, "sun light up the sky"],
			[100225, "So I hit the road"],
			[101202, "in overdrive, baby, oh"],
			[107000, "The city's cold and empty"],
			[109269, "(oh)"],
			[109807, "No one's around to judge me"],
			[111900, "(oh)"],
			[112512, "I can't see clearly"],
			[114015, "when you're gone"],
			[117000, "I said, ooh,"],
			[120076, "I'm blinded by the lights"],
			[122981, "No, I can't sleep until"],
			[124924, "I feel your touch"],
			[128169, "I said, ooh,"],
			[131200, "I'm drowning in the night"],
			[134146, "Oh, when I'm like this,"],
			[136011, "you're the one I trust"],
			[139600, "I'm just walking by to"],
			[140696, "let you know"],
			[141769, "(by to let you know)"],
			[142300, "I could never say it"],
			[143354, "on the phone"],
			[144489, "(say it on the phone)"],
			[145500, "Will never let you"],
			[147000, "go this time"],
			[150014, "(ooh)"],
			[150696, "I said, ooh,"],
			[153888, "I'm blinded by the lights"],
			[156600, "No, I can't sleep until"],
			[158606, "I feel your touch"],
			[161000, "(Hey, hey, hey)"],
			[172000, "(Hey, hey, hey)"],
			[184369, "I said, ooh,"],
			[187500, "I'm blinded by the lights"],
			[190269, "No, I can't sleep until"],
			[192304, "I feel your touch"],
		],
	},
	{
		name: "The Walters: I Love You So",
		url: "https://github.com/oe2735/music/raw/refs/heads/main/The_Walters_-_I_Love_You_So_(Hydr0.org).mp3",
		lyrics: [
			[1250, "I just need someone in my life"],
			[3969, "to give it structure"],
			[7200, "To handle all the selfish ways"],
			[9369, "I'd spend my time without her"],
			[13600, "You're everything I want,"],
			[14953, "but I can't deal"],
			[16533, "with all your lovers"],
			[20151, "You're saying I'm the one,"],
			[21507, "but it's your actions"],
			[23234, "that speak louder"],
			[26700, "Giving me love when you are"],
			[28854, "down and need another"],
			[32722, "I've gotta get away an"],
			[34300, "let you go, Ive gotta get over"],
			[38915, "But I love you so"],
			[42756, "(ooh-ooh-ooh)"],
			[45312, "I love you so (ooh-ooh-ooh)"],
			[51631, "I love you so (ooh-ooh-ooh)"],
			[57929, "I love you so"],
			[62500, "I'm gonna pack my things"],
			[65933, "and leave you behind"],
			[68850, "This feeling's old,"],
			[70642, "and I know that"],
			[72567, "I've made up my mind"],
			[75079, "I hope you feel what I felt"],
			[78529, "when you shattered my soul"],
			[81332, "'Cause you were cruel,"],
			[83000, "and I'm a fool,"],
			[85000, "so please, let me go"],
			[89569, "But I love you so"],
			[92745, "(please, let me go)"],
			[95978, "I love you so"],
			[99107, "(please, let me go)"],
			[102223, "I love you so"],
			[106295, "(please, let me go)"],
			[108659, "I love you so"],
			[118169, "Ooh-ooh-ooh"],
			[124500, "Ooh-ooh-ooh-ooh"],
			[130696, "Ooh-ooh-ooh"],
			[137195, "Ooh-ooh-ooh-ooh"],
		],
	},
	{
		name: "Edward Maya, ft. Vika Jigulina: Stereo Hearts",
		url: "https://github.com/oe2735/music/raw/refs/heads/main/Edward_Maya_ft._Vika_Jigulina_-_Stereo_love_(Hydr0.org).mp3",
		lyrics: [
			[4200, "When you gonna stop"],
			[5770, "breaking my heart?"],
			[11700, "I don't wanna be another one"],
			[19300, "Paying for the"],
			[20400, "things I never done"],
			[25969, "Don't let go,"],
			[27573, "don't let go to my love"],
			[49300, "I think I found the one"],
			[51007, "that'll hold my heart"],
			[56869, "I wanna feel your heart,"],
			[58686, "we're in love tonight"],
			[60500, "I can fix all those lies"],
			[62860, "Oh baby, baby, I run,"],
			[64568, "but I'm running to you"],
			[66696, "You won't see me cry,"],
			[68569, "I'm hiding inside"],
			[70373, "My heart is in pain,"],
			[72111, "but I'm smiling for you"],
			[76000, "Can I get to your soul?"],
			[77777, "Can you get to my flow?"],
			[79696, "Can we promise we wont let go?"],
			[83500, "All the things that I need,"],
			[85469, "all the things that you need"],
			[87168, "You can make it feel so real"],
			[91022, "'Cause you can't deny,"],
			[92708, "you've blown my mind"],
			[94637, "When I touch your body,"],
			[96430, "I feel I'm losing control"],
			[98358, "'Cause you can't deny,"],
			[100096, "you've blown my mind"],
			[102162, "When I see you baby,"],
			[103906, "I just don't wanna let go"],
			[106752, "(Oohh)"],
			[109942, "When you gonna stop"],
			[111609, "breaking my heart?"],
			[117469, "I don't wanna be another one"],
			[139966, "I think I found the one"],
			[141800, "that'll hold my heart"],
			[147606, "I wanna feel your heart,"],
			[149379, "we're in love tonight"],
			[151169, "I can fix all those lies"],
			[153526, "Oh baby, baby, I run,"],
			[155288, "but I'm running to you"],
			[157479, "You won't see me cry,"],
			[159310, "I'm hiding inside"],
			[161190, "My heart is in pain,"],
			[162868, "but I'm smiling for you"],
			[165000, "Oh baby, I'll try"],
			[166755, "to make the things right"],
			[168688, "I need you more than air"],
			[170305, "when I'm not with you"],
			[172653, "Please don't ask me why,"],
			[174385, "just kiss me this time"],
			[176300, "My only dream"],
			[178000, "is about you and I"],
		],
	},
	{
		name: "Yung Kai: Blue",
		url: "https://github.com/oe2735/music/raw/refs/heads/main/yung_kai_-_yung_kai_-_blue_Official_Music_Video_(Hydr0.org).mp3",
		lyrics: [
			[19318, "Your morning eyes,"],
			[21690, "I could stare"],
			[22958, "like watching stars"],
			[26200, "I could walk you by,"],
			[29696, "and Ill tell without a thought"],
			[32416, "You'd be mine,"],
			[34571, "would you mind"],
			[36518, "if I took your hand tonight?"],
			[40574, "Know you're all"],
			[41864, "that I want this life"],
			[48134, "I'll imagine we fell in love"],
			[50879, "I'll nap under"],
			[51726, "moonlight skies with you"],
			[54768, "I think I'll picture us,"],
			[56408, "you with the waves"],
			[58250, "The ocean's colors"],
			[60042, "on your face"],
			[61898, "I'll leave my heart"],
			[63676, "with your air"],
			[66316, "So let me fly with you"],
			[69469, "Will you be forever with me?"],
			[107151, "My love will always"],
			[109128, "stay by you"],
			[112900, "I'll keep it safe,"],
			[115200, "so don't you worry a thing"],
			[117969, "I'll tell you I love you more"],
			[121831, "It's stuck with you forever,"],
			[125319, "so promise you won't let it go"],
			[128498, "I'll trust the universe"],
			[130962, "will always bring me to you"],
			[136721, "I'll imagine we fell in love"],
			[139397, "I'll nap under"],
			[140288, "moonlight skies with you"],
			[143052, "I think I'll picture us,"],
			[145012, "you with the waves"],
			[146847, "The ocean's colors"],
			[148625, "on your face"],
			[150609, "I'll leave my heart"],
			[152350, "with your air"],
			[154900, "So let me fly with you"],
			[158400, "Will you be forever with me?"],
		],
	},
	{
		name: "Lil Nas X: Industry Baby",
		url: "https://github.com/oe2735/music/raw/refs/heads/main/Lil_Nas_X_Jack_Harlow_-_INDUSTRY_BABY_(Hydr0.org).mp3",
		lyrics: [
			[4596, `D-D-Daytrip took it to ten`],
			[5869, `(hey!)`],
			[6764, `Baby back, ayy,`],
			[8203, `couple racks, ayy`],
			[9792, `Couple Grammys on him`],
			[11426, `Couple plaques, ayy`],
			[13125, `That's a fact, ayy`],
			[14795, `Throw it back, ayy,`],
			[16246, `throw it back, ayy`],
			[17876, `And this one is`],
			[18712, `for the champions`],
			[21139, `I ain't lost since I began,`],
			[23400, `yeah`],
			[24000, `Funny how you said it`],
			[24880, `was the end, yeah`],
			[27360, `Then I went did it again, yeah`],
			[30624, `I told you long ago`],
			[32965, `on the road`],
			[34156, `I got what they waiting for`],
			[36994, `I don't run from nothing, dawg`],
			[39463, `Get your soldiers,`],
			[40686, `tell 'em I ain't laying low`],
			[43555, `You was never really`],
			[44553, `rooting for me anyway`],
			[46808, `When I'm back up at the top,`],
			[48011, `I wanna hear you say`],
			[49870, `He dont run from nothing, dawg`],
			[52281, `Get your soldiers,`],
			[53501, `tell em that the break is over`],
			[56079, `(uh)`],
			[56300, `Need to, uh,`],
			[57200, `need to get this album done`],
			[58537, `Need a couple number ones`],
			[60113, `Need a plaque on every song`],
			[61816, `Need me like one`],
			[62574, `with Nicki now`],
			[63406, `Tell a rap Nigga`],
			[64142, `I don't see ya (hah)`],
			[64968, `I'm a pop Nigga`],
			[65685, `like Bieber (hah)`],
			[66548, `I don't Fuck Bitches,`],
			[67286, `I'm queer (hah)`],
			[68160, `But these Niggas`],
			[68780, `Bitches like Madea,`],
			[69367, `yeah, yeah, yeah, ayy`],
			[71580, `Oh, let do it`],
			[73089, `I ain't fall off,`],
			[73765, `I jus aint release my new Shit`],
			[76252, `I blew up,`],
			[76887, `now everybody tryna sue me`],
			[79368, `You call me Nas,`],
			[80182, `but the hood call me Doobie`],
			[82062, `And this one is`],
			[82700, `for the champions`],
			[85085, `I ain't lost since I began,`],
			[87400, `yeah`],
			[88000, `Funny how you said`],
			[88767, `it was the end, yeah`],
			[91362, `Then I went did it again, yeah`],
			[94618, `I told you long ago`],
			[96972, `on the road`],
			[98241, `I got what they waiting for`],
			[101235, `I don't run from nothing, dawg`],
			[103400, `Get your soldiers,`],
			[104592, `tell 'em I ain't laying low`],
			[107666, `You was never really`],
			[108696, `rooting for me anyway`],
			[110213, `(ooh, ooh)`],
			[110783, `When I'm back up at the top,`],
			[111949, `I wanna hear you say`],
			[113300, `(ooh, ooh)`],
			[113916, `He dont run from nothing, dawg`],
			[116107, `Get your soldiers,`],
			[117319, `tell em that the break is over`],
			[121000, `(yeah)`],
			[121890, `My track record so clean,`],
			[123869, `they couldn't wait`],
			[124644, `to just bash me`],
			[125479, `I must be getting too flashy,`],
			[126896, `y'all shouldn't have`],
			[127525, `let the world gas me (woo)`],
			[128492, `It's too late 'cause`],
			[129446, `I'm here to stay and`],
			[130211, `these girls know that Im nasty`],
			[131300, `(mm)`],
			[131900, `I sent her back to`],
			[132696, `her boyfriend with`],
			[133284, `my handprint on her ass cheek`],
			[136308, `City talking, we taking notes`],
			[137966, `Tell 'em all to`],
			[138581, `keep making posts`],
			[139478, `Wish he could,`],
			[140033, `but he can't get close`],
			[141049, `OG so proud of me that he`],
			[142554, `choking up while`],
			[143487, `he making toasts`],
			[144463, `I'm the type that`],
			[145076, `you can't control,`],
			[145796, `said I would then I made it so`],
			[147969, `I don't clear up rumors (ayy),`],
			[149612, `where's y'all sense of humor?`],
			[150777, `(Ayy)`],
			[151169, `I'm done making jokes 'cause`],
			[152300, `they got old like baby boomers`],
			[153971, `Turned my haters to consumers,`],
			[155444, `I make vets feel`],
			[156100, `like they juniors (juniors)`],
			[156969, `Say your time is coming soon,`],
			[158497, `but just like Oklahoma (mm)`],
			[160800, `Mine is coming sooner (mm),`],
			[162400, `I'm just a late bloomer (mm)`],
			[164000, `I didn't peak in high school,`],
			[164985, `I'm still out here`],
			[165800, `getting cuter (woo)`],
			[167164, `All these social`],
			[167767, `networks and computers`],
			[168965, `Got these pussies walking`],
			[170169, `'round like they ain't losers`],
			[171505, `I told you long ago`],
			[173712, `on the road`],
			[174991, `I got what they waiting for`],
			[176700, `(I got what they waiting for)`],
			[178109, `I don't run from nothing, dawg`],
			[180227, `Get your soldiers,`],
			[181498, `tell 'em I ain't laying low`],
			[184098, `You was never really`],
			[185307, `rooting for me anyway`],
			[186666, `(ooh, ooh)`],
			[187458, `When I'm back up at the top,`],
			[188718, `I wanna hear you say`],
			[189696, `(ooh, ooh)`],
			[190326, `He dont run from nothing, dawg`],
			[193013, `Get your soldiers,`],
			[194304, `tell em that the break is over`],
			[198000, `(yeah)`],
			[202444, `I'm the industry baby, mmm`],
			[204555, `(yeah)`],
			[208888, `I'm the industry baby (yeah)`],
		],
	},
	{
		name: "Powfu: Death Bed",
		url: "https://github.com/oe2735/music/raw/refs/heads/main/Powfu_beabadoobee_-_death_bed_coffee_for_your_head_(Hydr0.org).mp3",
		lyrics: [
			[100, "Don't stay awake for too long"],
			[3191, "Don't go to bed"],
			[5514, "I'll make a cup of coffee"],
			[7158, "for your head"],
			[8867, "I'll get you up and going"],
			[10537, "out of bed"],
			[12069, "Yeah, I dont wanna fall asleep"],
			[14395, "I don't wanna pass away"],
			[16132, "I've been thinking"],
			[16964, "of our future"],
			[17819, "Cause Ill never see those days"],
			[19581, "I don't know why"],
			[20300, "this has happened,"],
			[21169, "but I probably deserve it"],
			[22700, "I tried to do my best,"],
			[24216, "but you know that"],
			[25214, "I'm not perfect"],
			[26354, "I've been praying"],
			[27097, "for forgiveness,"],
			[27931, "you've been praying"],
			[28628, "for my health"],
			[29500, "When I leave this earth,"],
			[30829, "hoping youll find someone else"],
			[32706, "Cause, yeah, were still young,"],
			[34232, "theres so much we haven't done"],
			[36175, "Getting married,"],
			[36843, "start a family,"],
			[37767, "watch your husband"],
			[38491, "with his son"],
			[39544, "I wish it could be me,"],
			[41012, "but I wont make it of this bed"],
			[42648, "I hope I go to heaven,"],
			[44284, "so I see you once again"],
			[46446, "My life was kindda short,"],
			[47660, "but I got so many blessings"],
			[49825, "Happy you were mine,"],
			[50969, "it sucks that it's all ending"],
			[53399, "Don't stay awake for too long"],
			[56507, "Don't go to bed"],
			[58893, "I'll make a cup of coffee"],
			[60529, "for your head"],
			[62299, "I'll get you up and going"],
			[63875, "out of bed, yeah"],
		],
	},
	{
		name: "Ed Sheeran: Shape Of You",
		url: "https://github.com/oe2735/music/raw/refs/heads/main/Ed_Sheeran_-_Shape_of_You_(Hydr0.org).mp3",
		lyrics: [
			[9932, "The club isn't the"],
			[10541, "best place to find a lover"],
			[11993, "So the bar is where I go"],
			[14804, "Me and my friends at"],
			[15739, "the table doing shots"],
			[16766, "Drinking fast and then"],
			[17807, "we talk slow"],
			[19811, "Come over and start up"],
			[20705, "a conversation with just me"],
			[22328, "And trust me I'll"],
			[23023, "give it a chance now"],
			[24491, "Take my hand, stop,"],
			[25571, "put Van the Man on the jukebox"],
			[27131, "And then we start to dance,"],
			[28640, "and now I'm singing like"],
			[29671, "Girl, you know"],
			[30587, "I want your love"],
			[32163, "Your love was handmade"],
			[33297, "for somebody like me"],
			[35444, "Come on now, follow my lead"],
			[37227, "I may be crazy, don't mind me"],
			[39364, "Say, boy, let's"],
			[40271, "not talk too much"],
			[42178, "Grab on my waist"],
			[43064, "and put that body on me"],
			[45319, "Come on now, follow my lead"],
			[46864, "Come, come on now,"],
			[47705, "follow my lead"],
			[50638, "I'm in love with"],
			[51332, "the shape of you"],
			[53147, "We push and pull"],
			[53804, "like a magnet do"],
			[55774, "Although my heart"],
			[56427, "is falling too"],
			[58193, "I'm in love with your body"],
			[60855, "And last night you"],
			[61509, "were in my room"],
			[63160, "And now my bedsheets"],
			[63980, "smell like you"],
			[65010, "Every day discovering"],
			[66300, "something brand new"],
			[68273, "I'm in love with your body"],
		],
	},
	{
		name: "Blacklite District: Wishing Dead",
		url: "https://github.com/cx0-peo/songs/raw/refs/heads/main/Blacklite%20District%20-%20Wishing%20Dead%20(Official%20Music%20Video).mp3",
		lyrics: [
			[12570, "Let it go"],
			[13620, "You should wait and see"],
			[15620, "'Cause you never know"],
			[16840, "Where you're gonna be"],
			[18660, "You should take it slow"],
			[20270, "Let's not jump ahead"],
			[21790, "You could watch it grow"],
			[23680, "Instead of wishing dead"],
			[25000, "Let-let, let it go"],
			[26000, "You should wait and see"],
			[28000, "'Cause you never know"],
			[30000, "Where you're gonna be"],
			[31000, "You should take it slow"],
			[33000, "Let's not jump ahead"],
			[34800, "You could watch it grow"],
			[35900, "Instead of wishing dead"],
		],
	},
	{
		name: "Chris Grey: Let The World Burn",
		url: "https://github.com/cx0-peo/songs/raw/refs/heads/main/Chris%20Grey%20-%20LET%20THE%20WORLD%20BURN%20(Official%20Lyric%20Video)%20(1).mp3",
		lyrics: [
			[5210, "Lost in the fog"],
			[8520, "I fear that there's still"],
			[8550, "Further to fall"],
			[13680, "It's dangerous 'cause"],
			[13710, "I want it all"],
			[19170, "And I don't think I care"],
			[19200, "What it costs"],
			[24270, "I shouldn't have fallen"],
			[24300, "In love"],
			[27170, "Look what it made me"],
			[27200, "Become"],
			[29500, "I let you get too close"],
			[31240, "Just to wake up alone"],
			[44960, "I'd let the world burn"],
			[47720, "Let the world burn for you"],
			[50640, "This is how it always had"],
			[50670, "To end"],
			[53260, "If I can't have you then"],
			[53290, "No one can"],
			[55910, "I'd let it burn"],
		],
	},
	{
		name: "Blacklite District: Back Into Darkness",
		url: "https://github.com/cx0-peo/songs/raw/refs/heads/main/Blacklite%20District%20-%20Back%20into%20Darkness%20(2).mp3",
		lyrics: [
			[13290, "You give and you give"],
			[14000, "Just to get there and fall"],
			[16420, "You take and you take"],
			[18000, "And for nothing at all"],
			[19440, "You run and you run"],
			[21000, "Straight into the wall"],
			[51380, "You fall"],
			[53000, "Back into darkness again"],
			[54850, "Realize you can only"],
			[56500, "Wish it's pretend"],
			[57820, "No lie"],
			[59000, "You're in it deep this time"],
			[60200, "My friend"],
		],
	},
	{
		name: "2hollis: Poster Boy",
		url: "https://github.com/cx0-peo/songs/raw/refs/heads/main/2hollis%20-%20poster%20boy%20(official%20audio).mp3",
		lyrics: [
			[35640, "Trash the ploy"],
			[36200, "Turn myself into a poster boy"],
			[39630, "L-l-live by the sword"],
			[41100, "Make myself turn two to four"],
			[44080, "I-i-i know you want it"],
			[46100, "Oh you Fucking got it"],
			[47920, "Running away"],
			[51140, "i-i-i-i'm running 'round"],
			[52200, "Push it down"],
			[53420, "Fuck, you think we going out?"],
			[55530, "You so wrong, you so dumb"],
			[57710, "We take our time"],
			[58200, "We don't rush"],
			[60840, "Y-y-y-you drive me-"],
			[61300, "Drive me- drive me crazy"],
			[65080, "What would it take"],
			[66350, "To call you my baby"],
		],
	},
	{
		name: "Atba' al namrood",
		url: "https://github.com/Phalynxi/moosic/raw/refs/heads/main/Al-Namrood%20-%20Atba'a%20Al-Namrood_%D8%A3%D8%AA%D8%A8%D8%A7%D8%B9%20%D8%A7%D9%84%D9%86%D9%85%D8%B1%D9%88%D8%AF%20%5BgtOYL4cqg2A%5D.mp3",
		lyrics: [
			[0, "Twisted minds do not believe in words"],
			[7250, "Shattered souls suffer from a limited view"],
			[14500, "Death is coming and bridge of failure faded"],
			[21750, "It has no end, the results of war and blood"],
			[29000, "He has sold his soul for power and governance"],
			[36250, "Where is the Exit?"],
			[43500, "But the fear of death does not hide your destiny"],
		],
	},
	{
		name: "Metallica: Master of Puppets",
		url: "https://www.youtube.com/watch?v=uRyAIyq53FY",
		lyrics: [
			[60800, `End of passion play,`],
			[61600, `crumbling away`],
			[65000, `I’m your source of`],
			[66000, `self-destruction`],
			[69200, `Veins that pump with fear,`],
			[70000, `sucking darkest clear`],
			[73600, `Leading on your death’s`],
			[74600, `construction`],
			[77800, `Taste me you will see`],
			[80100, `More is all you need`],
			[82100, `You’re dedicated to`],
			[84300, `How I’m killing you`],
			[90400, `Come crawling faster`],
			[95200, `Obey your master`],
			[99800, `Your life burns faster`],
			[104300, `Obey your master`],
			[106900, `Master`],
			[108100, `Master of puppets`],
			[108900, `I’m pulling your strings`],
			[111100, `Twisting your mind`],
			[111900, `and smashing your dreams`],
			[115000, `Blinded by me,`],
			[115800, `you can’t see a thing`],
			[118700, `Just call my name,`],
			[119500, `’cause I’ll hear you scream`],
			[122000, `Master`],
			[123100, `Master`],
			[124200, `Just call my name,`],
			[125000, `’cause I’ll hear you scream`],
			[128100, `Master`],
			[129300, `Master`],
			[140700, `Needlework the way,`],
			[141500, `never you betray`],
			[144900, `Life of death becoming`],
			[145900, `clearer`],
			[149300, `Pain monopoly,`],
			[150100, `ritual misery`],
			[153400, `Chop your breakfast on a`],
			[154400, `mirror`],
			[157700, `Taste me you will see`],
			[160000, `More is all you need`],
			[161900, `You’re dedicated to`],
			[164200, `How I’m killing you`],
			[170400, `Come crawling faster`],
			[175100, `Obey your master`],
			[179800, `Your life burns faster`],
			[184500, `Obey your master`],
			[187000, `Master`],
			[188100, `Master of puppets`],
			[188900, `I’m pulling your strings`],
			[192100, `Twisting your mind`],
			[192900, `and smashing your dreams`],
			[196100, `Blinded by me,`],
			[196900, `you can’t see a thing`],
			[198900, `Just call my name,`],
			[199700, `’cause I’ll hear you scream`],
			[202400, `Master`],
			[203400, `Master`],
			[204600, `Just call my name,`],
			[205400, `’cause I’ll hear you scream`],
			[208500, `Master`],
			[209700, `Master`],
			[211100, `Master, master`],
			[320100, `Master`],
			[321200, `Master`],
			[322300, `Where’s the dreams`],
			[323100, `that I’ve been after?`],
			[324800, `Master, master`],
			[326900, `You promised only lies`],
			[329200, `Laughter, laughter`],
			[330000, `All I hear or see`],
			[330800, `is laughter`],
			[333900, `Laughter, laughter`],
			[336100, `Laughing at my cries`],
			[341800, `Fix me`],
			[409000, `Hell is worth all that,`],
			[409800, `natural habitat`],
			[413200, `Just a rhyme`],
			[414000, `without a reason`],
			[417400, `Never-ending maze,`],
			[418200, `drift on numbered days`],
			[421700, `Now your life`],
			[422500, `is out of season`],
			[425900, `I will occupy`],
			[428100, `I will help you die`],
			[430200, `I will run through you`],
			[432400, `Now I rule you too`],
			[438600, `Come crawling faster`],
			[443100, `Obey your master`],
			[447600, `Your life burns faster`],
			[452200, `Obey your master`],
			[454600, `Master`],
			[455700, `Master of puppets`],
			[456500, `I’m pulling your strings`],
			[459800, `Twisting your mind`],
			[460600, `and smashing your dreams`],
			[463700, `Blinded by me,`],
			[464500, `you can’t see a thing`],
			[466500, `Just call my name,`],
			[467300, `’cause I’ll hear you scream`],
			[469800, `Master`],
			[471000, `Master`],
			[472100, `Just call my name,`],
			[472900, `’cause I’ll hear you scream`],
			[475900, `Master`],
			[477100, `Master`],
		],
	},
	{
		name: "Disturbed: Down with the Sickness",
		url: "https://www.youtube.com/watch?v=09LTT0xwdfw",
		lyrics: [
			[4500, `Can you feel that?`],
			[9800, `Ah, shit`],
			[20700, `Oh, ah, ah, ah, ah`],
			[31300, `Oh, ah, ah, ah, ah`],
			[34200, `oh, oh, oh, oh, oh, oh`],
			[42900, `Drowning deep in my sea`],
			[43900, `of loathing`],
			[48300, `Broken your servant I kneel`],
			[52600, `(Will you give in to me?)`],
			[53900, `It seems what's left of`],
			[54900, `my human side`],
			[58100, `Is slowly changing in me`],
			[63400, `(Will you give in to me?)`],
			[64700, `Looking at my own reflection`],
			[68100, `When suddenly it changes`],
			[71000, `Violently it changes (oh no)`],
			[75000, `There is no turning back now`],
			[78700, `You've woken up the`],
			[79700, `demon in me`],
			[85900, `Get up, come on get down`],
			[86900, `with the sickness`],
			[88600, `Get up, come on get down`],
			[89600, `with the sickness`],
			[91300, `Get up, come on get down`],
			[92300, `with the sickness`],
			[93700, `Open up your hate, and`],
			[94700, `let it flow into me`],
			[96600, `Get up, come on get down`],
			[97600, `with the sickness`],
			[99000, `You mother get up come on`],
			[100000, `get down with the sickness`],
			[101700, `You fucker get up come on`],
			[102700, `get down with the sickness`],
			[104500, `Madness is the gift, that`],
			[105500, `has been given to me`],
			[112400, `I can see inside you,`],
			[113400, `the sickness is rising`],
			[117400, `Don't try to deny what`],
			[118400, `you feel`],
			[122000, `(Will you give in to me?)`],
			[123300, `It seems that all that`],
			[124300, `was good has died`],
			[127500, `And is decaying in me`],
			[132800, `(Will you give in to me?)`],
			[134000, `It seems you're having`],
			[135000, `some trouble`],
			[137300, `In dealing with these`],
			[138300, `changes`],
			[140200, `Living with these`],
			[141200, `changes (oh no)`],
			[144200, `The world is a scary place`],
			[147400, `Now that you've woken up`],
			[148400, `the demon in me`],
			[155400, `Get up, come on get down`],
			[156400, `with the sickness`],
			[157900, `Get up, come on get down`],
			[158900, `with the sickness`],
			[160600, `Get up, come on get down`],
			[161600, `with the sickness`],
			[163100, `Open up your hate, and`],
			[164100, `let it flow into me`],
			[165900, `Get up, come on get down`],
			[166900, `with the sickness`],
			[168200, `You mother get up come on`],
			[169200, `get down with the sickness`],
			[171000, `You fucker get up come on`],
			[172000, `get down with the sickness`],
			[173700, `Madness is the gift, that`],
			[174700, `has been given to me`],
			[180600, `(And when I dream)`],
			[186000, `(And when I dream)`],
			[191500, `Oh, ah, ah, ah, ah`],
			[192700, `Get up, come on get down`],
			[193700, `with the sickness`],
			[195400, `Get up, come on get down`],
			[196400, `with the sickness`],
			[198000, `Get up, come on get down`],
			[199000, `with the sickness`],
			[200600, `Open up your hate, and`],
			[201600, `let it flow into me`],
			[203300, `Get up, come on get down`],
			[204300, `with the sickness`],
			[205600, `You mother get up come on`],
			[206600, `get down with the sickness`],
			[208400, `You fucker get up come on`],
			[209400, `get down with the sickness`],
			[211200, `Madness has now come`],
			[212200, `over me`],
		],
	},
	{
		name: "Avenged Sevenfold: Nightmare",
		url: "https://www.youtube.com/watch?v=94bGzWyHbu0",
		lyrics: [
			[61100, `Nightmare!`],
			[64930, `(Now your nightmare comes`],
			[65930, `to life)`],
			[70210, `Dragged you down below`],
			[71190, `Down to the devil's show`],
			[73680, `To be his guest forever`],
			[75490, `Peace of mind is less than`],
			[76490, `never`],
			[77750, `Hate to twist your mind`],
			[79430, `But God ain't on your side`],
			[81190, `An old acquaintance severed`],
			[82940, `Burn the world, your last`],
			[83940, `endeavor`],
			[84980, `Flesh is burning, you can`],
			[85980, `smell it in the air`],
			[87730, `'Cause men like you have`],
			[88730, `such an easy soul to steal`],
			[92160, `So stand in line while they`],
			[93160, `ink numbers in your head`],
			[95110, `You're now a slave until`],
			[96110, `the end of time here`],
			[97700, `Nothing stops the madness`],
			[98700, `turning, yearning`],
			[100410, `Pull the trigger`],
			[101670, `You should have known the`],
			[102670, `price of evil`],
			[108900, `And it hurts to know that`],
			[109900, `you belong here, yeah`],
			[115880, `Ooh, it's your fuckin'`],
			[116880, `nightmare`],
			[122700, `(While your nightmare comes`],
			[123700, `to life)`],
			[127390, `Can't wake up in sweat`],
			[129150, `'Cause it ain't over yet`],
			[130750, `Still dancing with your`],
			[131750, `demons`],
			[132660, `Victim of your own creation`],
			[134770, `Beyond the will to fight`],
			[136380, `Where all that's wrong is`],
			[137380, `right`],
			[138540, `Where hate don't need a`],
			[139540, `reason`],
			[140130, `Loathing self-assassination`],
			[142430, `You've been lied to just`],
			[143430, `to rape you of your sight`],
			[145100, `And now they have the nerve`],
			[146100, `to tell you how to feel`],
			[149450, `So sedated as they`],
			[150450, `medicate your brain`],
			[152380, `And while you slowly go`],
			[153380, `insane, they tell you`],
			[154790, `Given with the best`],
			[155790, `intentions`],
			[156720, `Help you with your`],
			[157720, `complications"`],
			[159140, `You should have known the`],
			[160140, `price of evil`],
			[166300, `And it hurts to know that`],
			[167300, `you belong here, yeah`],
			[173650, `No one to call, everybody`],
			[174650, `to fear`],
			[180840, `Your tragic fate is`],
			[181840, `looking so clear, yeah`],
			[188110, `Ooh, it's your fuckin'`],
			[189110, `nightmare`],
			[248890, `Fight (fight)`],
			[250400, `Not to fail (fail)`],
			[251840, `Not to fall (fall)`],
			[253680, `Or you'll end up like the`],
			[254680, `others`],
			[256250, `Die (die)`],
			[257620, `Die again (die)`],
			[259340, `Drenched in sin (sin)`],
			[261220, `With no respect for another`],
			[274740, `Down (down)`],
			[275990, `Feel the fire (fire)`],
			[277850, `Feel the hate (hate)`],
			[279460, `Your pain is what we`],
			[280460, `desire`],
			[282140, `Lost (lost)`],
			[283360, `Hit the wall (wall)`],
			[285170, `Watch you crawl (crawl)`],
			[286950, `Such a replaceable liar`],
			[290990, `And I know you hear their`],
			[291990, `voices`],
			[295400, `(Calling from above)`],
			[298350, `And I know they may seem`],
			[299350, `real`],
			[303700, `(These signals of love)`],
			[305470, `But our life's made up of`],
			[306470, `choices`],
			[310200, `(Some without appeal)`],
			[312270, `They took for granted,`],
			[313270, `your soul`],
			[316620, `And it's ours now to steal`],
			[321350, `(As your nightmare comes`],
			[322350, `to life)`],
			[327400, `You should have known the`],
			[328400, `price of evil`],
			[334100, `And it hurts to know that`],
			[335100, `you belong here, yeah`],
			[341730, `No one to call, everybody`],
			[342730, `to fear`],
			[348840, `Your tragic fate is`],
			[349840, `looking so clear, yeah`],
			[356100, `Ooh, it's your fuckin'`],
			[357100, `nightmare`],
		],
	},
	{
		name: "Avenged Sevenfold: So Far Away",
		url: "https://www.youtube.com/watch?v=A7ry4cx6HfY",
		lyrics: [
			[1800, `Never feared for anything,`],
			[2800, `never chained but never free`],
			[7700, `I tried to heal the broken`],
			[8700, `love with all I could`],
			[13800, `Lived a life so endlessly`],
			[14800, `saw beyond what others see`],
			[20200, `I tried to heal the broken`],
			[21200, `love with all I could`],
			[26600, `Will you stay`],
			[29600, `Will you stay away forever`],
			[33100, `How do I live without the`],
			[34100, `ones I love?`],
			[39000, `Time still turns the pages`],
			[40000, `of the book its burned`],
			[45400, `Place and time always on my`],
			[46400, `mind`],
			[51400, `I have so much to say but`],
			[52400, `you're so far away`],
			[58800, `Plans of what our futures`],
			[59800, `hold`],
			[61500, `Foolish lies of growing old`],
			[64400, `It seems we're so`],
			[65400, `invincible`],
			[67100, `The truth is so cold`],
			[71000, `A final song, a last request`],
			[73800, `A perfect chapter laid to`],
			[74800, `rest`],
			[76900, `Now and then I try to find`],
			[77900, `a place in my mind`],
			[83400, `Where you can stay you can`],
			[84400, `stay awake forever`],
			[89900, `How do I live without the`],
			[90900, `ones I love?`],
			[95700, `Time still turns the pages`],
			[96700, `of the book its burned`],
			[102200, `Place and time always on my`],
			[103200, `mind`],
			[108200, `I have so much to say but`],
			[109200, `you're so far away`],
			[114900, `Sleep tight, I'm not afraid`],
			[121000, `The ones that we love are`],
			[122000, `here with me`],
			[127500, `Lay away a place for me`],
			[128500, `'cause as soon as I'm done`],
			[135900, `I'll be on my way to live`],
			[136900, `eternally`],
			[172200, `How do I live without the`],
			[173200, `ones I love?`],
			[177800, `Time still turns the pages`],
			[178800, `of the book its burned`],
			[184600, `Place and time always on my`],
			[185600, `mind`],
			[190200, `And the light you left`],
			[191200, `remains but it's so hard to stay`],
			[196700, `When I have so much to say`],
			[197700, `and you're so far away`],
			[268700, `I love you, you were ready`],
			[271800, `The pain is strong and`],
			[272800, `urges rise`],
			[281900, `But I'll see you when He`],
			[282900, `lets me`],
			[284900, `Your pain is gone, your`],
			[285900, `hands are tied`],
			[294200, `So far away and I need you`],
			[295200, `to know`],
			[307100, `So far away and I need you`],
			[308100, `to need you to know`],
		],
	},
	{
		name: "Avicii - The Nights",
		url: "https://www.youtube.com/watch?v=UtF6Jej8yb4",
		lyrics: [
			[3200, "Once upon a younger year"],
			[4895, "When all our shadows"],
			[5960, "disappeared"],
			[6805, "The animals inside"],
			[8017, "came out to play"],
			[10754, "Went face to face"],
			[11482, "with all our fears"],
			[12731, "Learned our lessons"],
			[13646, "through the tears"],
			[14428, "Made memories we knew"],
			[15761, "would never fade"],
			[17794, "One day, my father,"],
			[19150, "he told me,"],
			[19864, "Son, don't let it slip away"],
			[22065, "He took me in his arms,"],
			[23325, "I heard him say"],
			[25869, "When you get older,"],
			[26778, "your wild heart will"],
			[28002, "live for younger days"],
			[29788, "Think of me if"],
			[30689, "ever you're afraid"],
			[32988, "He said,"],
			[33654, "One day,"],
			[34508, "you'll leave this world behind"],
			[36777, "So live a life"],
			[38205, "you will remember"],
			[40695, "My father told me when"],
			[42318, "I was just a child"],
			[44429, "These are the nights"],
			[45729, "that never die"],
			[47686, "My father told me"],
			[79400, "When thunderclouds"],
			[80349, "start pouring down"],
			[81219, "Light a fire"],
			[81992, "they can't put out"],
			[83286, "Carve your name"],
			[83917, "into those shining stars"],
			[86457, "He said,"],
			[87010, "Go venture far"],
			[87841, "beyond the shores"],
			[88876, "Don't forsake this"],
			[89746, "life of yours"],
			[90527, "I'll guide you home"],
			[91493, "no matter where you are"],
			[93932, "One day, my father,"],
			[95309, "he told me,"],
			[96018, "Son, don't let it slip away"],
			[98247, "When I was just a kid,"],
			[99549, "I heard him say"],
			[101853, "When you get older,"],
			[103150, "your wild heart"],
			[104064, "will live for younger days"],
			[106088, "Think of me if"],
			[106947, "ever you're afraid"],
			[109229, "He said,"],
			[109656, "One day,"],
			[110614, "you'll leave this world behind"],
			[113017, "So live a life"],
			[114356, "you will remember"],
			[116823, "My father told me when"],
			[118283, "I was just a child"],
			[120576, "These are the nights"],
			[121980, "that never die"],
			[124003, "My father told me"],
			[136169, "These are the nights"],
			[137292, "that never die"],
			[139361, "My father told me"],
			[163736, "Oh~"],
			[169915, "My father told me"],
		],
	},
	{
		name: "Initial D - Gas Gas Gas",
		url: "https://www.youtube.com/watch?v=atuFSv2bLa8",
		lyrics: [
			[17000, "Ahhhhh"],
			[19954, "gas,"],
			[20720, "Gas,"],
			[21509, "gas"],
			[24000, "Ahhhhh"],
			[28432, "Do you like"],
			[29789, "My car?"],
			[31489, "my car"],
			[33067, "m y  c a r"],
			[53120, "Guess you're ready"],
			[54234, "Cause I'm waiting for you"],
			[55956, "It's gonna be so exciting!"],
			[59140, "Got this feeling"],
			[60397, "Really deep in my soul"],
			[62309, "Let's get out, I wanna go"],
			[63983, "Come along, get it on!"],
			[65956, "Gonna take my car"],
			[67536, "Gonna sit in"],
			[69106, "Gona drive along til I get you"],
			[71770, "Cause I'm crazy, hot and ready"],
			[73609, "But you'll like it!"],
			[74894, "I wanna race for you!"],
			[76739, "(Shall I go now?)"],
			[78426, "Gas Gas Gas!"],
			[79661, "I'm gonna step on the gas"],
			[81378, "Tonight I'll fly!"],
			[82900, "And be your lover"],
			[84218, "Yeah yeah yeah!"],
			[85933, "I'll be so quick as a flash"],
			[87594, "And I'll be your hero"],
			[90462, "Gas Gas Gas!"],
			[92184, "I'm gonna run as a flash"],
			[93930, "Tonight I'll fight!"],
			[95561, "To be the winner"],
			[96766, "Yeah yeah yeah!"],
			[98475, "I'm gonna step on the gas"],
			[100093, "And you'll see the big show!"],
			[115553, "Don't be lazy"],
			[116577, "Cause I'm burning for you"],
			[118431, "It's like a hot sensation!"],
			[121661, "Got this power"],
			[122805, "That is taking me out"],
			[124524, "Yes, I've got a crush on you"],
			[126383, "Ready, now"],
			[127324, "Ready, go!"],
			[128283, "Gonna take my car"],
			[129837, "Gonna sit in"],
			[131431, "Gona drive along til I get you"],
			[134033, "Cause I'm crazy, hot and ready"],
			[135838, "But you'll like it!"],
			[137299, "I wanna race for you!"],
			[139000, "Shall I go now?"],
			[140495, "Gas Gas Gas!"],
			[141981, "I'm gonna step on the gas"],
			[143616, "Tonight I'll fly!"],
			[145350, "And be your lover"],
			[146554, "Yeah yeah yeah!"],
			[148246, "I'll be so quick as a flash"],
			[149886, "And I'll be your hero"],
			[152696, "Gas Gas Gas!"],
			[154549, "I'm gonna run as a flash"],
			[156175, "Tonight I'll fight!"],
			[157747, "To be the winner"],
			[158965, "Yeah yeah yeah!"],
			[160813, "I'm gonna step on the gas"],
			[162436, "And you'll see the big show!"],
			[190357, "Guess you're ready"],
			[191319, "Cause I'm waiting for you"],
			[193338, "It's gonna be so exciting!"],
			[196258, "Got this feeling"],
			[197534, "Really deep in my soul"],
			[199240, "Let's get out, I wanna go"],
			[201109, "Come along, get it on"],
			[203124, "Gonna take my car"],
			[206184, "Do you like my car?"],
			[208904, "Cause I'm crazy, hot and ready"],
			[210626, "But you'll like it!"],
			[212057, "I wanna race for you!"],
			[213833, "Shall I go now?"],
			[216846, "Gas Gas Gas!"],
			[218433, "I'm gonna step on the gas"],
			[220052, "Tonight I'll fly!"],
			[221687, "And be your lover"],
			[222927, "Yeah yeah yeah!"],
			[224791, "I'll be so quick as a flash"],
			[226348, "And I'll be your hero"],
			[229497, "Gas Gas Gas!"],
			[230955, "I'm gonna run as a flash"],
			[232590, "Tonight I'll fight!"],
			[234096, "To be the winner"],
			[235462, "Yeah yeah yeah!"],
			[237258, "I'm gonna step on the gas"],
			[238816, "And you'll see the big show!"],
			[242147, "Gas Gas Gas!"],
			[244960, "Yeah yeah yeah!"],
			[248228, "Gas Gas Gas!"],
			[251217, "And you'll see the big show!"],
		],
	},
	{
		name: "Ruth B - Dandelions",
		url: "https://www.youtube.com/watch?v=5gg17XXXiNo",
		lyrics: [
			[12262, "Maybe it's the way you"],
			[13658, "say my name"],
			[18179, "Maybe it's the way you"],
			[19909, "play your game"],
			[23413, "But it's so good,"],
			[25263, "I've never known"],
			[26444, "anybody like you"],
			[29395, "But it's so good,"],
			[31377, "I've never dreamed"],
			[32581, "of nobody like you"],
			[36052, "And I've heard of a love"],
			[38112, "that comes once in a lifetime"],
			[42952, "And I'm pretty sure that"],
			[44197, "you are that love of mine"],
			[48426, "'Cause"],
			[49149, "I'm in a field of dandelions"],
			[52165, "Wishing on every one"],
			[54328, "that you'd be mine,"],
			[58249, "mine"],
			[60742, "And I see forever"],
			[62970, "in your eyes"],
			[64612, "I feel okay when I"],
			[66752, "see you smile,"],
			[70601, "smile"],
			[73029, "Wishing on dandelions"],
			[74563, "all of the time"],
			[76054, "Praying to God that"],
			[77225, "one day you'll be mine"],
			[79069, "Wishing on dandelions"],
			[80697, "all of the time,"],
			[82231, "all of the time"],
			[85965, "I think that you"],
			[87070, "are the one for me"],
			[91994, "'Cause it gets so"],
			[92369, "hard to breathe"],
			[97220, "When you're looking at me,"],
			[98988, "I've never felt so"],
			[100361, "alive and free"],
			[103448, "When you're looking at me,"],
			[105249, "I've never felt so happy"],
			[109930, "And I've heard of a love"],
			[111902, "that comes once in a lifetime"],
			[116665, "And I'm pretty sure that"],
			[117986, "you are that love of mine"],
			[122308, "'Cause"],
			[123135, "I'm in a field of dandelions"],
			[126030, "Wishing on every one"],
			[128050, "that you'd be mine,"],
			[131823, "mine"],
			[134401, "And I see forever"],
			[136962, "in your eyes"],
			[138340, "I feel okay when I"],
			[140597, "see you smile,"],
			[144420, "smile"],
			[147113, "Wishing on dandelions"],
			[148588, "all of the time"],
			[149911, "Praying to God that"],
			[151384, "one day you'll be mine"],
			[153038, "Wishing on dandelions"],
			[154526, "all of the time"],
			[155979, "All of the time"],
			[159832, "Dandelion,"],
			[160821, "into the wind you go"],
			[162930, "Won't you let"],
			[164150, "my darling know?"],
			[166029, "Dandelion,"],
			[167097, "into the wind you go"],
			[169038, "Won't you let"],
			[169975, "my darling know?"],
			[171700, "That"],
			[173969, "I'm in a field of dandelions"],
			[176822, "Wishing on every one that"],
			[179183, "you'd be mine,"],
			[182976, "mine"],
			[185325, "And I see forever"],
			[187536, "in your eyes"],
			[189051, "I feel okay when I"],
			[191232, "see you smile,"],
			[195272, "smile"],
			[197665, "Wishing on dandelions"],
			[199124, "all of the time"],
			[200537, "Praying to God that"],
			[201771, "one day you'll be mine"],
			[203741, "Wishing on dandelions"],
			[205284, "all of the time,"],
			[206818, "all of the time"],
			[210608, "I'm in a field of dandelions"],
			[213827, "Wishing on every one that"],
			[216100, "you'd be mine,"],
			[219909, "mine"],
		],
	},
	{
		name: "Sub Urban - Cradles",
		url: "https://www.youtube.com/watch?v=KBtk5FUeJbk",
		lyrics: [
			[12757, "I live inside my own"],
			[15758, "world of make-believe"],
			[18587, "Kids screaming"],
			[20238, "in their cradles,"],
			[22040, "profanities"],
			[24702, "I see the world through eyes"],
			[27215, "covered in ink and bleach"],
			[30746, "Cross out the ones who heard"],
			[33242, "my cries and watched me weep"],
			[36700, "I love everything"],
			[39742, "Fire's spreading"],
			[41193, "all around my room"],
			[43257, "My world's so bright"],
			[44664, "It's hard to breathe"],
			[46165, "but that's alright"],
			[47436, "Hush Shh"],
			[72704, "Tape my eyes open"],
			[74621, "to force reality"],
			[76696, "(oh, no no)"],
			[78525, "Why can't you just let me"],
			[80876, "eat my weight in glee"],
			[84737, "I live inside my own"],
			[87595, "world of make-believe"],
			[90622, "Kids screaming"],
			[91974, "in their cradles,"],
			[93934, "profanities"],
			[96731, "Some days I feel skinnier"],
			[99084, "than all the other days"],
			[102780, "Sometimes I can't tell"],
			[104407, "if my body belongs to me"],
			[108800, "I love everything"],
			[111452, "Fire's spreading"],
			[112835, "all around my room"],
			[115108, "My world's so bright"],
			[116547, "It's hard to breathe"],
			[118155, "but that's alright"],
			[119402, "Hush Shh"],
			[144344, "I wanna taste your content"],
			[146703, "Hold your breath and"],
			[148365, "feel the tension"],
			[150024, "Devils hide behind redemption"],
			[152745, "Honesty is a"],
			[154330, "one-way gate to hell"],
			[156300, "I wanna taste consumption"],
			[159100, "Breathe faster to waste oxygen"],
			[162090, "Hear the children sing aloud"],
			[164628, "It's music 'til the"],
			[166425, "wick burns out"],
			[167776, "Hush"],
			[180700, "Just wanna be"],
			[181627, "care free lately,"],
			[184477, "yeah"],
			[185000, "Just kicking up daisies"],
			[188225, "Got one too many"],
			[189336, "quarters in my pockets"],
			[191585, "Count 'em like the four-leaf"],
			[193231, "clovers in my locket"],
			[195292, "Untied laces, yeah"],
			[198507, "Just tripping on daydreams"],
			[201160, "Got dirty little lullabies"],
			[203140, "playing on repeat"],
			[204662, "Might as well just rot around"],
			[206200, "the nursery and count sheep"],
		],
	},
	{
		name: "Kord Hell - Scopin",
		url: "https://www.youtube.com/watch?v=VXaq77GiyEo",
		lyrics: [
			[2732, "I got that gauge 38"],
			[3934, "and that four-five Glock"],
			[5066, "Deep in the bushes, see"],
			[5954, "I'm scopin' with that red dot"],
			[7532, "I got that, I got that,"],
			[8784, "I got that four-five Glock"],
			[9905, "Deep in the bushes, see"],
			[10848, "I'm scopin' with that red dot"],
			[12486, "I got that gauge 38"],
			[13583, "and that four-five Glock"],
			[14860, "Deep in the bushes, see"],
			[15688, "I'm scopin' with that red dot"],
			[17365, "I got that, I got that,"],
			[18203, "I got that, I got that"],
			[19522, "I, I, I, I"],
			[30581, "Scopin' with that red dot"],
			[39267, "Deep in the bushes, see"],
			[40266, "I'm scopin' with that red dot"],
			[41762, "I got that gauge 38"],
			[43041, "and that four-five Glock"],
			[44272, "Deep in the bushes, see"],
			[45270, "I'm scopin' with that red dot"],
			[46746, "I got that, I got that,"],
			[47901, "I got that four-five Glock"],
			[49176, "Deep in the bushes, see"],
			[50071, "I'm scopin' with that red dot"],
			[51587, "I got that gauge 38"],
			[52684, "and that four-five Glock"],
			[53830, "Deep in the bushes, see"],
			[54965, "I'm scopin' with that red dot"],
			[56433, "I got that, I got that,"],
			[57588, "I got that four-five Glock"],
			[58831, "Deep in the bushes, see I'm"],
			[59823, "scopin' with that red dot"],
			[69768, "Scopin' with that red dot"],
			[78434, "Deep in the bushes, see"],
			[79314, "I'm scopin' with that red dot"],
			[81811, "Scopin' with that red dot"],
			[84108, "Scopin', scopin'"],
			[84779, "with that red dot"],
			[86825, "Scopin' with that red dot"],
			[88363, "Deep in the bushes, see"],
			[89175, "I'm scopin' with that red dot"],
			[91900, "Scopin' with that red dot"],
			[93989, "Scopin', scopin'"],
			[94560, "with that red dot"],
			[96801, "Scopin' with that red dot"],
			[97969, "Deep in the bushes, see"],
			[99088, "I'm scopin' with that red dot"],
		],
	},
	{
		name: "The Living Tombstone - My Ordinary Life",
		url: "https://www.youtube.com/watch?v=9Zj0JOHJR-s",
		lyrics: [
			[29252, "They tell me keep it simple,"],
			[30570, "I tell them take it slow"],
			[31904, "I feed and water an idea,"],
			[33362, "so I let it grow"],
			[34596, "I tell them take it easy,"],
			[35829, "they laugh and tell me no"],
			[37143, "It's cool, but I dont see them"],
			[38277, "laughin' at my money, though"],
			[39705, "They spittin' facts at me,"],
			[41002, "Im spittin' tracks, catch me?"],
			[42366, "Im spinnin gold out my records"],
			[43847, "know you can't combat me"],
			[45121, "They tell me, Jesus walks,"],
			[46289, "I tell them, money talks"],
			[47504, "Bling got me chill, 'cause im"],
			[48915, "living in an icebox"],
			[50551, "They tell me I've been sleepin"],
			[51669, "I say im wide awake"],
			[52885, "Tracks hot and ready so they,"],
			[54230, "call me Mr. Easy-Bake"],
			[55574, "They say the grass is greener,"],
			[56962, "I think my grass is dank"],
			[58122, "Drivin' with a drank on an"],
			[59514, "empty tank to the bank"],
			[61220, "Do you feel me? Take a look,"],
			[62413, "inside my brain"],
			[63644, "The people always different,"],
			[64569, "but it always feels the same"],
			[66009, "That's the real me, pop the"],
			[67614, "champagne"],
			[68586, "The haters wanna hurt me,"],
			[69775, "and im laughin' at the pain"],
			[72107, "Stayin' still, eyes closed"],
			[74235, "Let the world just pass me by,"],
			[77245, "Pain pills, nice clothes"],
			[79611, "If I fall, I think I'll fly"],
			[82366, "Touch me, Midas"],
			[84691, "Make me part of your design"],
			[87629, "None to, guide us"],
			[89943, "I feel fear"],
			[91005, "for the very last time"],
			[114272, "They tell me that im special,"],
			[115274, "I smile and shake my head"],
			[116527, "I'll give them stories to tell,"],
			[117793, "friends bout the things I said"],
			[119228, "They tell me im so humble,"],
			[120424, "I say im turning red"],
			[121833, "They let me lie to them"],
			[122856, "and dont feel like"],
			[123662, "they've been misled"],
			[124661, "They give so much to me,"],
			[125733, "Im losing touch, get me?"],
			[127113, "Served on a silver platter,"],
			[128150, "ask for seconds,"],
			[129043, "they just let me"],
			[129909, "They tell me im a god,"],
			[131044, "Im lost in the facade"],
			[132378, "Six feet off the ground at all"],
			[133453, "times, I think im feelin' odd"],
			[135203, "No matter what I make,"],
			[136306, "they never see mistakes"],
			[137493, "Makin' so much bread,"],
			[138562, "I don't care that"],
			[139300, "they're just fake"],
			[140468, "They tell me they're below me,"],
			[141579, "I act like im above"],
			[142638, "The people blend together,"],
			[143686, "but I'd be lost"],
			[144496, "without their love"],
			[145775, "Can you heal me?"],
			[146578, "Have I gained too much?"],
			[148125, "When you become untouchable,"],
			[149228, "you're unable to touch"],
			[150882, "Is there a real me?"],
			[151910, "Pop the champagne"],
			[153164, "It hurts me just to think,"],
			[154310, "and I don't do pain"],
			[156397, "Stayin' still, eyes closed,"],
			[158726, "Let the world just pass me by"],
			[161741, "Pain pills, nice clothes,"],
			[164232, "If I fall, I think I'll fly"],
			[167202, "Touch me, Midas,"],
			[169509, "Make me part of your design,"],
			[172527, "None to guide us,"],
			[174481, "I feel fear"],
			[175555, "for the very last time"],
			[177913, "Lay still, restless,"],
			[180073, "Losing sleep while"],
			[181003, "I lose my mind"],
			[182800, "All thrill, no stress,"],
			[185234, "All my muses left behind"],
			[188339, "World is below,"],
			[190847, "So high up, im near-divine"],
			[193805, "Lean in, let go,"],
			[195774, "I feel fear"],
			[196752, "for the very last time"],
		],
	},
	{
		name: "Marina - Bubblegum Bitch",
		url: "https://www.youtube.com/watch?v=n3M4GrEEQTI",
		lyrics: [
			[14000, "I've got a figure"],
			[14710, "like a pin-up"],
			[15803, "Got a figure like a doll"],
			[17428, "Don't care if you"],
			[18091, "think I'm dumb"],
			[18948, "I don't care at all"],
			[20369, "Candy bear, sweetie pie"],
			[21912, "I wanna be adored"],
			[23489, "I'm the girl you'd die for"],
			[26797, "I'll chew you up and"],
			[28353, "I'll spit you out"],
			[29885, "'Cause that's what young love"],
			[31243, "is all about"],
			[32897, "So pull me closer"],
			[34457, "and kiss me hard"],
			[35823, "I'm gonna pop your"],
			[37003, "bubblegum heart"],
			[38684, "I'm Miss Sugar Pink,"],
			[40104, "liquor, liquor lips"],
			[41614, "Hit me with your sweet love"],
			[43110, "Steal me with a kiss"],
			[44756, "I'm Miss Sugar Pink,"],
			[46175, "liquor, liquor lips"],
			[47645, "I'm gonna be your"],
			[49368, "bubblegum Bitch"],
			[50850, "I'm gonna be your"],
			[52241, "bubblegum Bitch"],
			[60048, "Queentex, latex,"],
			[61433, "I'm your wonder maid"],
			[62908, "Life gave me some lemons,"],
			[64119, "so I made some lemonade"],
			[66088, "Soda pop, soda pop,"],
			[67439, "baby here I come"],
			[68992, "Straight to number one"],
			[72315, "Oh, Dear diary, I met a boy"],
			[75314, "He made my doll heart"],
			[76714, "light up with joy"],
			[78347, "Oh, Dear diary, we fell apart"],
			[81224, "Welcome to the life"],
			[82184, "of Electra Heart"],
			[84233, "I'm Miss Sugar Pink,"],
			[85724, "liquor, liquor lips"],
			[87192, "Hit me with your sweet love"],
			[88753, "Steal me with a kiss"],
			[90297, "I'm Miss Sugar Pink,"],
			[91787, "liquor, liquor lips"],
			[93254, "I'm gonna be your"],
			[94813, "bubblegum Bitch"],
			[96370, "I'm gonna be your"],
			[97863, "bubblegum Bitch"],
			[99490, "I think I want your-,"],
			[101317, "your American tan"],
			[104129, "Oh, oh, oh"],
			[105700, "I think you're gonna"],
			[107266, "be my biggest fan"],
			[110427, "Oh, oh, oh"],
			[123868, "I'm Miss Sugar Pink,"],
			[125300, "liquor, liquor lips"],
			[126826, "Hit me with your sweet love"],
			[128235, "Steal me with a kiss"],
			[129795, "I'm Miss Sugar Pink,"],
			[131218, "liquor, liquor lips"],
			[132789, "I'm gonna be your"],
			[134310, "bubblegum Bitch"],
			[135910, "I'm gonna be your"],
			[137327, "bubblegum Bitch"],
			[139100, "I'm Miss Sugar Pink,"],
			[140388, "liquor, liquor lips"],
			[142042, "Hit me with your sweet love"],
			[143344, "Steal me with a kiss"],
			[145000, "I'm Miss Sugar Pink,"],
			[146309, "liquor, liquor lips"],
			[147998, "I'm gonna be your"],
			[149525, "bubblegum Bitch"],
			[151000, "I'm gonna be your"],
			[152518, "bubblegum Bitch"],
		],
	},
	{
		name: "Nyan Cat!",
		url: "https://fine.sunproxy.net/file/eUdQUWE0dFhKa2Z3WGxyQkVHRmk0Uzd5eVlzaExoWW9NNUFicTA4VSs3aEptTFhkNWk0L3VwN2FIWmhZQms3V2lxRmkvd2RsTzNXUEgyRkEvS3hoYXNXcHFHU0VoUGxqM01obzIyZ3A1d1U9/NYAN_CAT_-_Nyan_Cat_Original_Mix_(Hydr0.org).mp3",
		lyrics: [
			[8822, "Nyan nyan nyan nyan nyan nyan"],
			[9502, "nyan nyan nyan nyan nyan nyan"],
			[10182, "nyan nyan nyan nyan nyan"],
			[10862, "nyan nyan nyan nyan"],
			[11542, "Nyan nyan nyan nyan nyan nyan"],
			[12222, "nyan nyan nyan nyan nyan nyan"],
			[12902, "nyan nyan nyan nyan nyan"],
			[13582, "nyan nyan nyan nyan"],
			[14262, "Nyan nyan nyan nyan nyan nyan"],
			[14942, "nyan nyan nyan nyan nyan nyan"],
			[15622, "nyan nyan nyan nyan nyan"],
			[16302, "nyan nyan nyan nyan"],
			[16982, "Nyan nyan nyan nyan nyan nyan"],
			[17662, "nyan nyan nyan nyan nyan nyan"],
			[18342, "nyan nyan nyan nyan nyan"],
			[19022, "nyan nyan nyan nyan"],
			[19702, "Nyan nyan nyan nyan nyan nyan"],
			[20382, "nyan nyan nyan nyan nyan nyan"],
			[21062, "nyan nyan nyan nyan nyan"],
			[21742, "nyan nyan nyan nyan"],
			[22422, "Nyan nyan nyan nyan nyan nyan"],
			[23102, "nyan nyan nyan nyan nyan nyan"],
			[23782, "nyan nyan nyan nyan nyan"],
			[24462, "nyan nyan nyan nyan"],
			[25142, "Nyan nyan nyan nyan nyan nyan"],
			[25822, "nyan nyan nyan nyan nyan nyan"],
			[26502, "nyan nyan nyan nyan nyan"],
			[27182, "nyan nyan nyan nyan"],
			[27862, "Nyan nyan nyan nyan nyan nyan"],
			[28542, "nyan nyan nyan nyan nyan nyan"],
			[29222, "nyan nyan nyan nyan nyan"],
			[29902, "nyan nyan nyan nyan"],
			[30582, "Nyan nyan nyan nyan nyan nyan"],
			[31262, "nyan nyan nyan nyan nyan nyan"],
			[31942, "nyan nyan nyan nyan nyan"],
			[32622, "nyan nyan nyan nyan"],
			[33302, "Nyan nyan nyan nyan nyan nyan"],
			[33982, "nyan nyan nyan nyan nyan nyan"],
			[34662, "nyan nyan nyan nyan nyan"],
			[35342, "nyan nyan nyan nyan"],
			[36022, "Nyan nyan nyan nyan nyan nyan"],
			[36702, "nyan nyan nyan nyan nyan nyan"],
			[37382, "nyan nyan nyan nyan nyan"],
			[38062, "nyan nyan nyan nyan"],
			[38742, "Nyan nyan nyan nyan nyan nyan"],
			[39422, "nyan nyan nyan nyan nyan nyan"],
			[40102, "nyan nyan nyan nyan nyan"],
			[40782, "nyan nyan nyan nyan"],
			[41462, "Nyan nyan nyan nyan nyan nyan"],
			[42142, "nyan nyan nyan nyan nyan nyan"],
			[42822, "nyan nyan nyan nyan nyan"],
			[43502, "nyan nyan nyan nyan"],
			[44182, "Nyan nyan nyan nyan nyan nyan"],
			[44862, "nyan nyan nyan nyan nyan nyan"],
			[45542, "nyan nyan nyan nyan nyan"],
			[46222, "nyan nyan nyan nyan"],
			[46902, "Nyan nyan nyan nyan nyan nyan"],
			[47582, "nyan nyan nyan nyan nyan nyan"],
			[48262, "nyan nyan nyan nyan nyan"],
			[48942, "nyan nyan nyan nyan"],
			[49622, "Nyan nyan nyan nyan nyan nyan"],
			[50302, "nyan nyan nyan nyan nyan nyan"],
			[50982, "nyan nyan nyan nyan nyan"],
			[51662, "nyan nyan nyan nyan"],
			[52342, "Nyan nyan nyan nyan nyan nyan"],
			[53022, "nyan nyan nyan nyan nyan nyan"],
			[53702, "nyan nyan nyan nyan nyan"],
			[54382, "nyan nyan nyan nyan"],
			[55062, "Nyan nyan nyan nyan nyan nyan"],
			[55742, "nyan nyan nyan nyan nyan nyan"],
			[56422, "nyan nyan nyan nyan nyan"],
			[57102, "nyan nyan nyan nyan"],
			[57782, "Nyan nyan nyan nyan nyan nyan"],
			[58462, "nyan nyan nyan nyan nyan nyan"],
			[59142, "nyan nyan nyan nyan nyan"],
			[59822, "nyan nyan nyan nyan"],
			[60502, "Nyan nyan nyan nyan nyan nyan"],
			[61182, "nyan nyan nyan nyan nyan nyan"],
			[61862, "nyan nyan nyan nyan nyan"],
			[62542, "nyan nyan nyan nyan"],
			[63222, "Nyan nyan nyan nyan nyan nyan"],
			[63902, "nyan nyan nyan nyan nyan nyan"],
			[64582, "nyan nyan nyan nyan nyan nyan"],
			[65262, "nyan nyan nyan Nyan nyan nyan"],
			[65942, "nyan nyan nyan nyan nyan nyan"],
			[66622, "nyan nyan nyan nyan nyan nyan"],
			[67302, "nyan nyan nyan nyan nyan nyan"],
			[67982, "nyan nyan nyan nyan"],
			[68662, "Nyan nyan nyan nyan nyan nyan"],
			[69342, "nyan nyan nyan nyan nyan nyan"],
			[70022, "nyan nyan nyan nyan nyan"],
			[70702, "nyan nyan nyan nyan"],
			[71382, "Nyan nyan nyan nyan nyan nyan"],
			[72062, "nyan nyan nyan nyan nyan nyan"],
			[72742, "nyan nyan nyan nyan nyan"],
			[73422, "nyan nyan nyan nyan"],
			[74102, "Nyan nyan nyan nyan nyan nyan"],
			[74782, "nyan nyan nyan nyan nyan nyan"],
			[75462, "nyan nyan nyan nyan nyan"],
			[76142, "nyan nyan nyan nyan"],
			[76822, "Nyan nyan nyan nyan nyan nyan"],
			[77502, "nyan nyan nyan nyan nyan nyan"],
			[78182, "nyan nyan nyan nyan nyan"],
			[78862, "nyan nyan nyan nyan"],
			[79542, "Nyan nyan nyan nyan nyan nyan"],
			[80222, "nyan nyan nyan nyan nyan nyan"],
			[80902, "nyan nyan nyan nyan nyan"],
			[81582, "nyan nyan nyan nyan"],
			[82262, "Nyan nyan nyan nyan nyan nyan"],
			[82942, "nyan nyan nyan nyan nyan nyan"],
			[83622, "nyan nyan nyan nyan nyan"],
			[84302, "nyan nyan nyan nyan"],
			[84982, "Nyan nyan nyan nyan nyan nyan"],
			[85662, "nyan nyan nyan nyan nyan nyan"],
			[86342, "nyan nyan nyan nyan nyan"],
			[87022, "nyan nyan nyan nyan"],
			[87702, "Nyan nyan nyan nyan nyan nyan"],
			[88382, "nyan nyan nyan nyan nyan nyan"],
			[89062, "nyan nyan nyan nyan nyan"],
			[89742, "nyan nyan nyan nyan"],
			[90422, "Nyan nyan nyan nyan nyan nyan"],
			[91102, "nyan nyan nyan nyan nyan nyan"],
			[91782, "nyan nyan nyan nyan nyan"],
			[92462, "nyan nyan nyan nyan"],
			[93142, "Nyan nyan nyan nyan nyan nyan"],
			[93822, "nyan nyan nyan nyan nyan nyan"],
			[94502, "nyan nyan nyan nyan nyan"],
			[95182, "nyan nyan nyan nyan"],
			[95862, "Nyan nyan nyan nyan nyan nyan"],
			[96542, "nyan nyan nyan nyan nyan nyan"],
			[97222, "nyan nyan nyan nyan nyan"],
			[97902, "nyan nyan nyan nyan"],
			[98582, "Nyan nyan nyan nyan nyan nyan"],
			[99262, "nyan nyan nyan nyan nyan nyan"],
			[99942, "nyan nyan nyan nyan nyan"],
			[100622, "nyan nyan nyan nyan"],
			[101302, "Nyan nyan nyan nyan nyan nyan"],
			[101982, "nyan nyan nyan nyan nyan nyan"],
			[102662, "nyan nyan nyan nyan nyan"],
			[103342, "nyan nyan nyan nyan"],
			[104022, "Nyan nyan nyan nyan nyan nyan"],
			[104702, "nyan nyan nyan nyan nyan nyan"],
			[105382, "nyan nyan nyan nyan nyan"],
			[106062, "nyan nyan nyan nyan"],
			[106742, "Nyan nyan nyan nyan nyan nyan"],
			[107422, "nyan nyan nyan nyan nyan nyan"],
			[108102, "nyan nyan nyan nyan nyan"],
			[108782, "nyan nyan nyan nyan"],
			[109462, "Nyan nyan nyan nyan nyan nyan"],
			[110142, "nyan nyan nyan nyan nyan nyan"],
			[110822, "nyan nyan nyan nyan nyan"],
			[111502, "nyan nyan nyan nyan"],
			[112182, "Nyan nyan nyan nyan nyan nyan"],
			[112862, "nyan nyan nyan nyan nyan nyan"],
			[113542, "nyan nyan nyan nyan nyan"],
			[114222, "nyan nyan nyan nyan"],
			[114902, "Nyan nyan nyan nyan nyan nyan"],
			[115582, "nyan nyan nyan nyan nyan nyan"],
			[116262, "nyan nyan nyan nyan nyan"],
			[116942, "nyan nyan nyan nyan"],
			[117622, "Nyan nyan nyan nyan nyan nyan"],
			[118302, "nyan nyan nyan nyan nyan nyan"],
			[118982, "nyan nyan nyan nyan nyan"],
			[119662, "nyan nyan nyan nyan"],
			[120342, "Nyan nyan nyan nyan nyan nyan"],
			[121022, "nyan nyan nyan nyan nyan nyan"],
			[121702, "nyan nyan nyan nyan nyan"],
			[122382, "nyan nyan nyan nyan"],
			[123062, "Nyan nyan nyan nyan nyan nyan"],
			[123742, "nyan nyan nyan nyan nyan nyan"],
			[124422, "nyan nyan nyan nyan nyan"],
			[125102, "nyan nyan nyan nyan"],
			[125782, "Nyan nyan nyan nyan nyan nyan"],
			[126462, "nyan nyan nyan nyan nyan nyan"],
			[127142, "nyan nyan nyan nyan nyan"],
			[127822, "nyan nyan nyan nyan"],
			[128502, "Nyan nyan nyan nyan nyan nyan"],
			[129182, "nyan nyan nyan nyan nyan nyan"],
			[129862, "nyan nyan nyan nyan nyan"],
			[130542, "nyan nyan nyan nyan"],
			[131222, "Nyan nyan nyan nyan nyan nyan"],
			[131902, "nyan nyan nyan nyan nyan nyan"],
			[132582, "nyan nyan nyan nyan nyan"],
			[133262, "nyan nyan nyan nyan"],
			[133942, "Nyan nyan nyan nyan nyan nyan"],
			[134622, "nyan nyan nyan nyan nyan nyan"],
			[135302, "nyan nyan nyan nyan nyan"],
			[135982, "nyan nyan nyan nyan"],
			[136662, "Nyan nyan nyan nyan nyan nyan"],
			[137342, "nyan nyan nyan nyan nyan nyan"],
			[138022, "nyan nyan nyan nyan nyan"],
			[138702, "nyan nyan nyan nyan"],
			[139382, "Nyan nyan nyan nyan nyan nyan"],
			[140062, "nyan nyan nyan nyan nyan nyan"],
			[140742, "nyan nyan nyan nyan nyan"],
			[141422, "nyan nyan nyan nyan"],
			[142102, "Nyan nyan nyan nyan nyan nyan"],
			[142782, "nyan nyan nyan nyan nyan nyan"],
			[143462, "nyan nyan nyan nyan nyan"],
			[144142, "nyan nyan nyan nyan"],
			[144822, "Nyan nyan nyan nyan nyan nyan"],
			[145502, "nyan nyan nyan nyan nyan nyan"],
			[146182, "nyan nyan nyan nyan nyan"],
			[146862, "nyan nyan nyan nyan"],
			[147542, "Nyan nyan nyan nyan nyan nyan"],
			[148222, "nyan nyan nyan nyan nyan nyan"],
			[148902, "nyan nyan nyan nyan nyan"],
			[149582, "nyan nyan nyan nyan"],
			[150262, "Nyan nyan nyan nyan nyan nyan"],
			[150942, "nyan nyan nyan nyan nyan nyan"],
			[151622, "nyan nyan nyan nyan nyan"],
			[152302, "nyan nyan nyan nyan"],
			[152982, "Nyan nyan nyan nyan nyan nyan"],
			[153662, "nyan nyan nyan nyan nyan nyan"],
			[154342, "nyan nyan nyan nyan nyan"],
			[155022, "nyan nyan nyan nyan"],
			[155702, "Nyan nyan nyan nyan nyan nyan"],
			[156382, "nyan nyan nyan nyan nyan nyan"],
			[157062, "nyan nyan nyan nyan nyan"],
			[157742, "nyan nyan nyan nyan"],
			[158422, "Nyan nyan nyan nyan nyan nyan"],
			[159102, "nyan nyan nyan nyan nyan nyan"],
			[159782, "nyan nyan nyan nyan nyan"],
			[160462, "nyan nyan nyan nyan"],
			[161142, "Nyan nyan nyan nyan nyan nyan"],
			[161822, "nyan nyan nyan nyan nyan nyan"],
			[162502, "nyan nyan nyan nyan nyan"],
			[163182, "nyan nyan nyan nyan"],
			[163862, "Nyan nyan nyan nyan nyan nyan"],
			[164542, "nyan nyan nyan nyan nyan nyan"],
			[165222, "nyan nyan nyan nyan nyan"],
			[165902, "nyan nyan nyan nyan"],
			[166582, "Nyan nyan nyan nyan nyan nyan"],
			[167262, "nyan nyan nyan nyan nyan nyan"],
			[167942, "nyan nyan nyan nyan nyan"],
			[168622, "nyan nyan nyan nyan"],
			[169302, "Nyan nyan nyan nyan nyan nyan"],
			[169982, "nyan nyan nyan nyan nyan nyan"],
			[170662, "nyan nyan nyan nyan nyan"],
			[171342, "nyan nyan nyan nyan"],
			[172022, "Nyan nyan nyan nyan nyan nyan"],
			[172702, "nyan nyan nyan nyan nyan nyan"],
			[173382, "nyan nyan nyan nyan nyan"],
			[174062, "nyan nyan nyan nyan"],
			[174742, "Nyan nyan nyan nyan nyan nyan"],
			[175422, "nyan nyan nyan nyan nyan nyan"],
			[176102, "nyan nyan nyan nyan nyan"],
			[176782, "nyan nyan nyan nyan"],
			[177462, "Nyan nyan nyan nyan nyan nyan"],
			[178142, "nyan nyan nyan nyan nyan nyan"],
			[178822, "nyan nyan nyan nyan nyan"],
			[179502, "nyan nyan nyan nyan"],
			[180182, "Nyan nyan nyan nyan nyan nyan"],
			[180862, "nyan nyan nyan nyan nyan nyan"],
			[181542, "nyan nyan nyan nyan nyan"],
			[182222, "nyan nyan nyan nyan"],
			[182902, "Nyan nyan nyan nyan nyan nyan"],
			[183582, "nyan nyan nyan nyan nyan nyan"],
			[184262, "nyan nyan nyan nyan nyan"],
			[184942, "nyan nyan nyan nyan"],
			[185622, "Nyan nyan nyan nyan nyan nyan"],
			[186302, "nyan nyan nyan nyan nyan nyan"],
			[186982, "nyan nyan nyan nyan nyan"],
			[187662, "nyan nyan nyan nyan"],
			[188342, "Nyan nyan nyan nyan nyan nyan"],
			[189022, "nyan nyan nyan nyan nyan nyan"],
			[189702, "nyan nyan nyan nyan nyan"],
			[190382, "nyan nyan nyan nyan"],
			[191062, "Nyan nyan nyan nyan nyan nyan"],
			[191742, "nyan nyan nyan nyan nyan nyan"],
			[192422, "nyan nyan nyan nyan nyan"],
			[193102, "nyan nyan nyan nyan"],
			[193782, "Nyan nyan nyan nyan nyan nyan"],
			[194462, "nyan nyan nyan nyan nyan nyan"],
			[195142, "nyan nyan nyan nyan nyan"],
			[195822, "nyan nyan nyan nyan"],
			[196502, "Nyan nyan nyan nyan nyan nyan"],
			[197182, "nyan nyan nyan nyan nyan nyan"],
			[197862, "nyan nyan nyan nyan nyan"],
			[198542, "nyan nyan nyan nyan"],
			[199222, "Nyan nyan nyan nyan nyan nyan"],
			[199902, "nyan nyan nyan nyan nyan nyan"],
			[200582, "nyan nyan nyan nyan nyan"],
			[201262, "nyan nyan nyan nyan"],
			[201942, "Nyan nyan nyan nyan nyan nyan"],
			[202622, "nyan nyan nyan nyan nyan nyan"],
			[203302, "nyan nyan nyan nyan nyan"],
			[203982, "nyan nyan nyan nyan"],
			[204662, "Nyan nyan nyan nyan nyan nyan"],
			[205342, "nyan nyan nyan nyan nyan nyan"],
			[206022, "nyan nyan nyan nyan nyan"],
			[206702, "nyan nyan nyan nyan"],
			[207382, "Nyan nyan nyan nyan nyan nyan"],
			[208062, "nyan nyan nyan nyan nyan nyan"],
			[208742, "nyan nyan nyan nyan nyan"],
			[209422, "nyan nyan nyan nyan"],
			[210102, "Nyan nyan nyan nyan nyan nyan"],
			[210782, "nyan nyan nyan nyan nyan nyan"],
			[211462, "nyan nyan nyan nyan nyan"],
			[212142, "nyan nyan nyan nyan"],
			[212822, "Nyan nyan nyan nyan nyan nyan"],
			[213502, "nyan nyan nyan nyan nyan nyan"],
			[214182, "nyan nyan nyan nyan nyan"],
			[214862, "nyan nyan nyan nyan"],
			[215542, "Nyan nyan nyan nyan nyan nyan"],
			[216222, "nyan nyan nyan nyan nyan nyan"],
			[216902, "nyan nyan nyan nyan nyan"],
			[217582, "nyan nyan nyan nyan"],
			[218262, "Nyan nyan nyan nyan nyan nyan"],
			[218942, "nyan nyan nyan nyan nyan nyan"],
			[219622, "nyan nyan nyan nyan nyan"],
			[220302, "nyan nyan nyan nyan"],
			[220982, "Nyan nyan nyan nyan nyan nyan"],
			[221662, "nyan nyan nyan nyan nyan nyan"],
			[222342, "nyan nyan nyan nyan nyan"],
			[223022, "nyan nyan nyan nyan"],
			[223702, "Nyan nyan nyan nyan nyan nyan"],
			[224382, "nyan nyan nyan nyan nyan nyan"],
			[225062, "nyan nyan nyan nyan nyan"],
		],
	},
	{
		name: "Olly Murs - That Girl",
		url: "https://www.youtube.com/watch?v=3q2IXr6fjh0",
		lyrics: [
			[100, "There's a girl,"],
			[1850, "but I let her get away"],
			[5603, "It's all my fault,"],
			[7299, "'cause pride got in the way"],
			[11100, "And I'd be lying if I said,"],
			[13670, "I was okay"],
			[16302, "About that girl,"],
			[18048, "the one I let get away"],
			[21405, "I keep saying no"],
			[23774, "This can't be the way"],
			[24647, "it was supposed to be"],
			[26511, "I keep saying no"],
			[29001, "There's gotta be a way"],
			[30008, "to get you close to me"],
			[32506, "Now I know, you gotta speak up"],
			[34169, "if you want somebody"],
			[36250, "Can't let them get away, oh no"],
			[38961, "You don't wanna end up sorry"],
			[41714, "The way that I'm feeling"],
			[42544, "every day"],
			[44444, "No, no, no, no"],
			[47076, "There's no hope for"],
			[47869, "the broken heart"],
			[49300, "(Don't you know?)"],
			[50000, "No, no, no, no"],
			[52214, "There's no hope for the broken"],
			[54400, "There's a girl,"],
			[55700, "but I let her get away"],
			[59477, "It's my fault,"],
			[61223, "'cause I said I needed space"],
			[64729, "And I've been torturing myself"],
			[67693, "night and day"],
			[70212, "About that girl,"],
			[72038, "the one I let get away"],
			[74945, "I keep saying no"],
			[77514, "This can't be the way"],
			[78598, "it was supposed to be"],
			[80422, "I keep saying no"],
			[83000, "There's gotta be"],
			[83869, "a way to get you,"],
			[84582, "gotta be a way to"],
			[85569, "get you close to me"],
			[86872, "You gotta speak up"],
			[87956, "if you want somebody"],
			[90131, "Can't let them get away, oh no"],
			[92873, "You don't wanna end up sorry"],
			[95511, "The way that I'm feeling"],
			[96483, "every day"],
			[98400, "No, no, no, no"],
			[101013, "There's no hope for"],
			[101869, "the broken heart"],
			[103078, "(Don't you know?)"],
			[103720, "No, no, no, no"],
			[106231, "There's no hope for the broken"],
			[109167, "No hope for me (no)"],
			[111647, "No hope 'cause I'm broken"],
			[114509, "No room to breathe (no)"],
			[116899, "And I got no one to blame"],
			[119836, "No home for me (no)"],
			[122369, "No home 'cause I'm broken"],
			[124458, "About that girl,"],
			[125800, "the one I let get away"],
			[129316, "So, you better speak up"],
			[131969, "if you want somebody"],
			[133349, "You can't let them get away,"],
			[134900, "oh no, no"],
			[136002, "You don't wanna end up sorry"],
			[138300, "(oh, no)"],
			[138800, "The way that I'm feeling"],
			[139649, "every day"],
			[141569, "No, no, no, no"],
			[144076, "There's no home for"],
			[145185, "the broken heart"],
			[146333, "(Don't you know?)"],
			[147000, "No, no, no, no"],
			[149338, "There's no home for the broken"],
			[151377, "Oh, you don't wanna"],
			[153224, "lose that love"],
			[154507, "It's only gonna hurt too much"],
			[156406, "(I'm telling you)"],
			[157600, "you don't wanna lose that love"],
			[159880, "It's only gonna hurt too much"],
			[161876, "(I'm telling you)"],
			[162189, "you don't wanna lose that love"],
			[165335, "'Cause there's no home"],
			[166294, "for the broken"],
			[167479, "About that girl,"],
			[169222, "the one I let get away"],
		],
	},
	{
		name: "Rachie - My R",
		url: "https://www.youtube.com/watch?v=oX7kvYrL6lQ",
		lyrics: [
			[726, "Just as I was about"],
			[1718, "to take my shoes"],
			[3397, "Off of the rooftop,"],
			[4459, "there I see"],
			[5614, "A girl with braided hair"],
			[6280, "here before me"],
			[8003, "Despite myself,"],
			[8575, "I go and scream"],
			[10355, "Hey, don't do it, please!"],
			[21521, "Whoa, wait a minute,"],
			[22117, "what did I just say?"],
			[23911, "I couldn't care less,"],
			[24873, "either way"],
			[26169, "To be honest,"],
			[26569, "I was somewhat pissed"],
			[28400, "This was an opportunity missed"],
			[30718, "The girl with braided hair"],
			[31474, "told me her woes"],
			[32943, "You've probably"],
			[33581, "heard it all before"],
			[35222, "I really thought that"],
			[35837, "he might be the one"],
			[37462, "But then he told me"],
			[38630, "he was done"],
			[39757, "For God's sake, please!"],
			[41508, "Are you serious?"],
			[42755, "I just can't believe"],
			[44095, "That for some stupid reason,"],
			[45893, "you got here before me"],
			[48643, "Are you upset"],
			[50613, "'cause you can't have"],
			[51663, "what you wanted?"],
			[53226, "You're lucky that you've never"],
			[55218, "gotten robbed of anything"],
			[57953, "I'm feeling better,"],
			[58696, "thank you for listening"],
			[60075, "The girl with braided hair"],
			[61775, "then disappeared"],
			[67152, "Alright, today's the day,"],
			[68325, "or so I thought"],
			[69642, "Just as I took both"],
			[70510, "of my shoes off"],
			[71790, "There was but a girl,"],
			[72587, "short as can be"],
			[74112, "Despite myself,"],
			[74828, "I go and scream"],
			[76370, "The petite girl"],
			[77224, "told me her woes"],
			[78625, "You've probably"],
			[79243, "heard it all before"],
			[80955, "Everyone ignores me,"],
			[82075, "everyone steals"],
			[83262, "I dont fit in with anyone here"],
			[85529, "For God's sake, please!"],
			[87343, "Are you serious?"],
			[88279, "I just can't believe"],
			[89779, "That for some stupid reason"],
			[91719, "you got here before me"],
			[94464, "'Cause even so,"],
			[96450, "you're still loved"],
			[97115, "by everyone at home"],
			[98918, "There's always dinner"],
			[100325, "waiting on the table, you know"],
			[103757, "I'm hungry, said the girl"],
			[104601, "as she shed a tear"],
			[105627, "The girl short as can be"],
			[107543, "then disappeared"],
			[109315, "And like that,"],
			[110147, "there was someone every day"],
			[112847, "I listened to their tale,"],
			[115157, "I made them turn away"],
			[117385, "And yet there was no one"],
			[118733, "who would do this for me"],
			[120713, "No way I could"],
			[122072, "let out all this pain"],
			[135795, "For the very first time,"],
			[136931, "there I see"],
			[138108, "Someone with the"],
			[139069, "same pains as me"],
			[140341, "Having done this"],
			[141118, "time and time again"],
			[142617, "She wore a yellow cardigan"],
			[145025, "I just wanna stop the"],
			[146098, "scars that grow"],
			[147311, "Every time that I go home"],
			[149552, "That's why I"],
			[150169, "came up here instead"],
			[151770, "That's what the girl"],
			[152744, "in the cardigan said"],
			[154081, "Whoa, wait a minute,"],
			[154778, "what did I just say?"],
			[156399, "I couldn't care less,"],
			[157517, "either way"],
			[158658, "But in the moment"],
			[159686, "I just screamed"],
			[160875, "Something that I"],
			[161727, "could not believe"],
			[163286, "Hey, don't do it, please!"],
			[167744, "Ah, what to do?"],
			[169493, "I can't stop this girl,"],
			[170949, "oh this is new"],
			[172104, "For once, I think I've"],
			[173527, "bitten of more than I can chew"],
			[176711, "But even so,"],
			[178622, "please just go away,"],
			[180055, "so I can't see"],
			[181274, "Your pitiful expression"],
			[183165, "is just too much for me"],
			[185835, "I guess today is"],
			[186971, "just not my day"],
			[188125, "She looked away from me"],
			[189247, "and then she disappeared"],
			[192869, "There's no one here today,"],
			[193800, "I guess it's time"],
			[195297, "It's just me, myself and I"],
			[197578, "There is no one"],
			[198243, "who can interfere"],
			[199852, "No one to get in my way here"],
			[202142, "Taking off my yellow cardigan"],
			[204442, "Watching my braids"],
			[205400, "all come undone"],
			[206661, "This petite girl,"],
			[207265, "short as can be"],
			[209033, "Is gonna jump now and be free"],
		],
	},
	{
		name: "OMI - Cheerleader",
		url: "https://www.youtube.com/watch?v=jGflUbPQfW8",
		lyrics: [
			[16000, "When I need motivation"],
			[18499, "My one solution is my queen"],
			[20823, "'Cause she stay strong,"],
			[22645, "yeah, yeah"],
			[23913, "She is always in my corner"],
			[26010, "Right there when I want her"],
			[27943, "All these other"],
			[28976, "girls are tempting"],
			[29926, "But I'm empty when you're gone"],
			[31900, "And they say"],
			[32921, "Do you need me?"],
			[34785, "Do you think I'm pretty?"],
			[35994, "Do I make you feel"],
			[37344, "like cheating?"],
			[38369, "And I'm like no,"],
			[39121, "not really 'cause"],
			[40644, "Oh, I think that I found"],
			[42981, "myself a cheerleader"],
			[45346, "She is always right there"],
			[47033, "when I need her"],
			[48811, "Oh, I think that I found"],
			[51063, "myself a cheerleader"],
			[53371, "She is always right there"],
			[55216, "when I need her"],
			[56668, "She walks like a model"],
			[59222, "She grants my wishes"],
			[60467, "like a genie in a bottle,"],
			[63335, "yeah, yeah"],
			[64427, "'Cause I'm the wizard of love"],
			[66706, "And I got the magic wand"],
			[68500, "All these other"],
			[69659, "girls are tempting"],
			[70643, "But I'm empty when you're gone"],
			[72495, "And they say"],
			[73662, "Do you need me?"],
			[75256, "Do you think I'm pretty?"],
			[76798, "Do I make you feel"],
			[78084, "like cheating?"],
			[78900, "And I'm like no,"],
			[79867, "not really 'cause"],
			[81345, "Oh, I think that I found"],
			[83703, "myself a cheerleader"],
			[86008, "She is always right there"],
			[87626, "when I need her"],
			[89418, "Oh, I think that I found"],
			[91696, "myself a cheerleader"],
			[94047, "She is always right there"],
			[95740, "when I need her"],
			[129222, "Hmm, she gives me love"],
			[130696, "and affection,"],
			[132352, "baby, did I mention?"],
			[134354, "You're the only girl for me,"],
			[136032, "no, I don't need a next one"],
			[138410, "Mama loves you too,"],
			[139717, "she thinks I made"],
			[140544, "the right selection"],
			[142387, "Now all that's left to do"],
			[143674, "is just for me to"],
			[144850, "pop the question"],
			[146471, "Oh, I think that I found"],
			[148861, "myself a cheerleader"],
			[151169, "She is always right there"],
			[152728, "when I need her"],
			[154508, "Oh, I think that I found"],
			[156830, "myself a cheerleader"],
			[159145, "She is always right there"],
			[160952, "when I need her"],
		],
	},
	{
		name: "BWO - Sunshine In The Rain",
		url: "https://www.youtube.com/watch?v=m_91WI9Ea2w",
		lyrics: [
			[14200, "When I'm in Berlin,"],
			[15676, "you're off to London"],
			[17826, "When I'm in New York,"],
			[19439, "you're doing Rome"],
			[21600, "All those crazy nights"],
			[23224, "we spend together"],
			[25408, "As voices on the phone"],
			[29207, "Wishing we could"],
			[30332, "be more telepathic"],
			[33004, "Tired of the nights"],
			[34371, "I sleep alone"],
			[36677, "Wishing we could"],
			[37698, "redirect the traffic"],
			[40395, "And find ourselves a home"],
			[44155, "Can you feel the"],
			[45190, "raindrops in the desert?"],
			[47750, "Have you seen the"],
			[49010, "sunrays in the dark?"],
			[51500, "Do you feel my love"],
			[53132, "when I'm not present"],
			[55326, "Standing by your side"],
			[56933, "while miles apart?"],
			[59034, "Sunshine in the rain,"],
			[60889, "love is still the same"],
			[62823, "Sunshine in the rain"],
			[66500, "Sunshine in the rain,"],
			[68424, "love is still the same"],
			[70274, "Sunshine in the rain"],
			[74247, "Even if we call"],
			[75647, "the highest power"],
			[77901, "We can only do one town a time"],
			[81588, "Words are not enough,"],
			[83133, "action speaks louder"],
			[85400, "Second time around"],
			[89001, "Can you feel the"],
			[90299, "raindrops in the desert?"],
			[92837, "Have you seen the"],
			[93940, "sunrays in the dark?"],
			[96544, "Do you feel my love"],
			[98202, "when I'm not present"],
			[100317, "Standing by your side"],
			[101931, "while miles apart?"],
			[104089, "Sunshine in the rain,"],
			[105910, "love is still the same"],
			[107816, "Sunshine in the rain"],
			[109713, "(Sunshine in the rain)"],
			[111589, "Sunshine in the rain,"],
			[113387, "love is still the same"],
			[115290, "Sunshine in the rain"],
			[117229, "(Sunshine in the rain)"],
			[133469, "When I'm in Berlin,"],
			[135747, "you're off to London"],
			[137695, "When I'm in New York,"],
			[139409, "you're doing Rome"],
			[141500, "All those crazy nights"],
			[143219, "we spend together"],
			[145319, "As voices on the phone"],
			[149323, "Can you feel the"],
			[150213, "raindrops in the desert?"],
			[152791, "Have you seen the"],
			[153964, "sunrays in the dark?"],
			[156576, "Do you feel my love"],
			[158165, "when I'm not present"],
			[160411, "Standing by your side"],
			[161935, "while miles apart?"],
			[163979, "Sunshine in the rain,"],
			[165850, "love is still the same"],
			[167768, "Sunshine in the rain"],
			[169605, "(Sunshine in the rain)"],
			[171529, "Sunshine in the rain,"],
			[173447, "love is still the same"],
			[175305, "Sunshine in the rain"],
			[177295, "(Sunshine in the rain)"],
			[179101, "Can you feel the"],
			[180251, "raindrops in the desert?"],
			[182749, "Have you seen the"],
			[183974, "sunrays in the dark?"],
			[186509, "Do you feel my love"],
			[188113, "when I'm not present"],
			[190251, "Standing by your side"],
			[191846, "while miles apart?"],
			[193926, "Sunshine in the rain,"],
			[195913, "love is still the same"],
			[197747, "Sunshine in the rain"],
			[199639, "(sunshine in the rain)"],
			[201565, "Sunshine in the rain,"],
			[203376, "love is still the same"],
			[205369, "Sunshine in the rain"],
		],
	},
	{
		name: "Post Malone - Circles",
		url: "https://www.youtube.com/watch?v=wXhTHyIgQ_U",
		lyrics: [
			[32944, "We couldn't turn around"],
			[36655, "'Til we were upside down"],
			[40486, "I'll be the bad guy now"],
			[44400, "But know I ain't too proud"],
			[48222, "I couldn't be there"],
			[52400, "Even when I tried"],
			[56052, "You don't believe it"],
			[59850, "We do this every time"],
			[61700, "Seasons change and"],
			[63030, "our love went cold"],
			[65657, "Feed the flame 'cause"],
			[66815, "we can't let go"],
			[69480, "Run away,"],
			[70393, "but we're running in circles"],
			[73303, "Run away, run away"],
			[75707, "I dare you to do something"],
			[79469, "I'm waiting on you again"],
			[82869, "So I don't take the blame"],
			[84825, "Run away,"],
			[85774, "but we're running in circles"],
			[88717, "Run away, run away, run away"],
			[92500, "Let go"],
			[94369, "I got a feeling that"],
			[95726, "it's time to let go"],
			[99469, "I say so"],
			[102081, "I knew that this was doomed"],
			[103671, "from the get-go"],
			[106543, "You thought that it was"],
			[107463, "special, special"],
			[110069, "But it was just the Sex,"],
			[111805, "though, the Sex, though"],
			[113890, "And I still hear the echoes"],
			[116380, "(the echoes)"],
			[117500, "I got a feeling that it's time"],
			[119400, "to let it go, let it go"],
			[123420, "Seasons change and"],
			[124483, "our love went cold"],
			[127155, "Feed the flame"],
			[128056, "'cause we can't let go"],
			[131042, "Run away,"],
			[131953, "but we're running in circles"],
			[134844, "Run away, run away"],
			[137078, "I dare you to do something"],
			[140928, "I'm waiting on you again"],
			[144396, "So I don't take the blame"],
			[146380, "Run away,"],
			[147700, "but we're running in circles"],
			[150295, "Run away, run away, run away"],
			[154193, "Maybe you don't understand"],
			[155795, "what I'm going through"],
			[157969, "It's only me"],
			[159888, "What you got to lose?"],
			[161853, "Make up your mind, tell me"],
			[163240, "What are you gonna do?"],
			[165595, "It's only me"],
			[167420, "Let it go"],
			[169481, "Seasons change and"],
			[170628, "our love went cold"],
			[173296, "Feed the flame"],
			[174285, "'cause we can't let go"],
			[177132, "Run away,"],
			[178091, "but we're running in circles"],
			[180999, "Run away, run away"],
			[183200, "I dare you to do something"],
			[187000, "I'm waiting on you again"],
			[190420, "So I don't take the blame"],
			[192551, "Run away,"],
			[193479, "but we're running in circles"],
			[196456, "Run away, run away, run away"],
		],
	},
	{
		name: "Lady Gaga - Poker Face",
		url: "https://www.youtube.com/watch?v=bESGLojNYSo",
		lyrics: [
			[7500, "Mum-mum-mum-mah"],
			[11666, "Mum-mum-mum-mah"],
			[15600, "Mum-mum-mum-mah"],
			[19696, "Mum-mum-mum-mah"],
			[23555, "Mum-mum-mum-mah"],
			[24654, "I wanna hold 'em like"],
			[25721, "they do in Texas, please (Woo)"],
			[28369, "Fold 'em, let 'em hit me,"],
			[29648, "raise it, baby, stay with me"],
			[31440, "(I love it)"],
			[32330, "LoveGame intuition,"],
			[33677, "play the cards with"],
			[34691, "spades to start"],
			[36000, "And after he's been hooked,"],
			[37399, "I'll play the one"],
			[38376, "that's on his heart"],
			[40569, "Oh, woah-oh, oh, oh"],
			[42973, "Oh-oh-oh-oh-oh-oh"],
			[44350, "I'll get him hot,"],
			[45600, "show him what I've got"],
			[48313, "Oh, woah-oh, oh, oh"],
			[51103, "Oh-oh-oh-oh-oh-oh"],
			[52335, "I'll get him hot,"],
			[54114, "show him what I've got"],
			[56715, "Can't read my, can't read my"],
			[58586, "No, he cant read my poker face"],
			[62427, "(She's got me like nobody)"],
			[64748, "Can't read my, can't read my"],
			[66620, "No, he cant read my poker face"],
			[70553, "(She's got me like nobody)"],
			[72792, "P-p-p-poker face,"],
			[74156, "f-f-fuck her face"],
			[76000, "(Mum-mum-mum-mah)"],
			[76878, "P-p-p-poker face,"],
			[78270, "f-f-fuck her face"],
			[79882, "(Mum-mum-mum-mah)"],
			[80951, "I wanna roll with him,"],
			[82369, "a hard pair we will be (Woo)"],
			[84700, "A little gamblin' is fun"],
			[86898, "when you're with me"],
			[88696, "(I love it, woo)"],
			[89345, "Russian roulette is"],
			[90169, "not the same without a gun"],
			[92655, "And baby, when it's love,"],
			[93849, "if its not rough, it isnt fun,"],
			[96153, "fun"],
			[96969, "Oh, woah-oh, oh, oh"],
			[98623, "Oh-oh-oh-oh-oh-oh"],
			[100808, "I'll get him hot,"],
			[102286, "show him what I've got"],
			[104800, "Oh, woah-oh, oh, oh"],
			[106841, "Oh-oh-oh-oh-oh-oh"],
			[109069, "I'll get him hot,"],
			[110444, "show him what I've got"],
			[113124, "Can't read my, can't read my"],
			[115048, "No, he cant read my poker face"],
			[118922, "(She's got me like nobody)"],
			[121193, "Can't read my, can't read my"],
			[123087, "No, he cant read my poker face"],
			[126995, "(She's got me like nobody)"],
			[129214, "P-p-p-poker face,"],
			[130687, "f-f-fuck her face"],
			[132394, "(Mum-mum-mum-mah)"],
			[133428, "P-p-p-poker face,"],
			[134758, "f-f-fuck her face"],
			[136258, "(Mum-mum-mum-mah)"],
			[140777, "(Mum-mum-mum-mah)"],
			[144900, "I won't tell you"],
			[145900, "that I love you"],
			[147000, "Kiss or hug you"],
			[147869, "'Cause I'm bluffin'"],
			[148584, "with my muffin"],
			[149637, "I'm not lyin',"],
			[150541, "I'm just stunnin' with"],
			[151899, "my love-glue-gunnin'"],
			[153500, "Just like a chick"],
			[154405, "in the casino"],
			[155661, "Take your bank"],
			[156475, "before I pay you out"],
			[157978, "I promise this, promise this"],
			[159982, "Check this hand"],
			[160596, "'cause I'm marvelous"],
			[161676, "Can't read my, can't read my"],
			[163451, "No, he cant read my poker face"],
			[167334, "(She's got me like nobody)"],
			[169544, "Can't read my, can't read my"],
			[171555, "No, he cant read my poker face"],
			[175397, "(She's got me like nobody)"],
			[177627, "Can't read my, can't read my"],
			[179652, "No, he cant read my poker face"],
			[183462, "(She's got me like nobody)"],
			[185724, "Can't read my, can't read my"],
			[187648, "No, he cant read my poker face"],
			[191486, "(She's got me like nobody)"],
			[193770, "Can't read my, can't read my"],
			[195740, "No, he cant read my poker face"],
			[199606, "(She's got me like nobody)"],
			[201869, "Can't read my, can't read my"],
			[203808, "No, he cant read my poker face"],
			[207635, "(She's got me like nobody)"],
			[209869, "P-p-p-poker face,"],
			[211395, "f-f-fuck her face"],
			[213869, "P-p-p-poker face,"],
			[215401, "f-f-fuck her face"],
			[216222, "(She's got me like nobody)"],
			[217868, "P-p-p-poker face,"],
			[219458, "f-f-fuck her face"],
			[220967, "(Mum-mum-mum-mah)"],
			[222124, "P-p-p-poker face,"],
			[223549, "f-f-fuck her face"],
		],
	},
	{
		name: "Sam Gellaitry - Assumptions",
		url: "https://www.youtube.com/watch?v=T9Ybj8nrtQw",
		lyrics: [
			[60400, "If it's love that you want,"],
			[62769, "I'll give my everything"],
			[67800, "And have I made the"],
			[68886, "right assumption?"],
			[70819, "Do you feel the same?"],
			[75756, "If it's love that you want,"],
			[78300, "I'll give my everything"],
			[83100, "And have I made the"],
			[84030, "right assumption?"],
			[86063, "Do you feel the same?"],
			[121469, "If it's love that you want,"],
			[124024, "I'll give my everything"],
			[128900, "And have I made the"],
			[129850, "right assumption?"],
			[131661, "Do you feel the same?"],
			[136600, "If it's love that you want,"],
			[139287, "I'll give my everything"],
			[143969, "And have I made the"],
			[144889, "right assumption?"],
			[146972, "Do you feel the same?"],
			[167728, "Love that you want,"],
			[169667, "I'll give my everything"],
			[174469, "And have I made the"],
			[175474, "right assumption?"],
			[177398, "Do you feel the same?"],
			[182400, "If it's love that you want,"],
			[184800, "I'll give my everything"],
			[189696, "And have I made the"],
			[190600, "right assumption?"],
			[192745, "Do you feel the same?"],
		],
	},
	{
		name: "Sia - Cheap Thrills",
		url: "https://www.youtube.com/watch?v=31crA53Dgu0",
		lyrics: [
			[10883, "Come on, come on,"],
			[11732, "turn the radio on"],
			[13421, "It's Friday night"],
			[14510, "and I won't be long"],
			[15944, "Gotta do my hair,"],
			[17139, "put my make up on"],
			[18888, "It's Friday night"],
			[19863, "and I won't be long"],
			[21292, "'Til I hit the dance floor,"],
			[23064, "hit the dance floor"],
			[24248, "I got all I need"],
			[26786, "No, I ain't got cash,"],
			[28124, "I ain't got cash"],
			[29483, "But I got you, baby"],
			[31969, "Baby, I don't need dollar"],
			[34169, "bills to have fun tonight"],
			[35923, "(I love cheap thrills)"],
			[37252, "Baby, I don't need dollar"],
			[39407, "bills to have fun tonight"],
			[41295, "(I love cheap thrills)"],
			[43000, "I don't need no money"],
			[48275, "As long as I can feel the beat"],
			[53758, "I don't need no money"],
			[59077, "As long as I keep dancing"],
			[64400, "Come on, come on,"],
			[65400, "turn the radio on"],
			[66926, "It's Saturday"],
			[68000, "and I won't be long"],
			[69500, "Gotta paint my nails,"],
			[70724, "put my high heels on"],
			[72339, "It's Saturday"],
			[73368, "and I won't be long"],
			[74727, "'Til I hit the dance floor,"],
			[76609, "hit the dance floor"],
			[77854, "I got all I need"],
			[80163, "No, I ain't got cash,"],
			[81645, "I ain't got cash"],
			[83017, "But I got you, baby"],
			[85524, "Baby, I don't need dollar"],
			[87653, "bills to have fun tonight"],
			[89498, "(I love cheap thrills)"],
			[91031, "Baby, I don't need dollar"],
			[92982, "bills to have fun tonight"],
			[94845, "(I love cheap thrills)"],
			[96494, "I don't need no money"],
			[102000, "As long as I can feel the beat"],
			[107400, "I don't need no money"],
			[112699, "As long as I keep dancing"],
			[121700, "(I love cheap thrills)"],
			[127200, "(I love cheap thrills)"],
			[128820, "I don't need no money"],
			[134086, "As long as I can feel the beat"],
			[139501, "I don't need no money"],
			[144800, "As long as I keep dancing"],
			[149069, "(Oh, oh, oh)"],
			[150300, "Baby, I don't need dollar"],
			[152138, "bills to have fun tonight"],
			[154025, "(I love cheap thrills)"],
			[155500, "Baby, I don't need dollar"],
			[157360, "bills to have fun tonight"],
			[159213, "(I love cheap thrills)"],
			[160736, "I don't need no money"],
			[166313, "As long as I can feel the beat"],
			[171761, "I don't need no money"],
			[177068, "As long as I keep dancing"],
			[182600, "La, la, la, la, la, la, la"],
			[186969, "(I love cheap thrills)"],
			[188169, "La, la, la, la, la, la, la"],
			[191869, "(I love cheap thrills)"],
			[193200, "La, la, la, la, la, la, la"],
			[196700, "(I love cheap thrills)"],
			[198708, "La, la, la, la, la, la, la"],
			[202137, "(I love cheap thrills)"],
		],
	},
	{
		name: "ATC - Around The World",
		url: "https://www.youtube.com/watch?v=4O86JJHoiRg",
		lyrics: [
			[8000, "The kisses of the sun"],
			[10147, "were sweet, I didn't blink"],
			[11527, "I let it in my eyes"],
			[13736, "like an exotic dream"],
			[15121, "The radio playing songs"],
			[17420, "that I have never heard"],
			[18690, "I don't know what to say,"],
			[21036, "oh, not another word"],
			[22326, "Just la la la la la,"],
			[24696, "it goes around the world"],
			[26049, "Just la la la la la,"],
			[28404, "it's all around the world"],
			[29673, "Just la la la la la,"],
			[32012, "and everybody's singing"],
			[33520, "La la la la la,"],
			[35631, "and now the bells are ringing"],
			[37125, "La la la la la,"],
			[39296, "la la la la la la la,"],
			[40765, "la la la la la,"],
			[42868, "la la la la la la la"],
			[44444, "La la la la la,"],
			[46483, "la la la la la la la,"],
			[48049, "la la la la la,"],
			[50102, "la la la la la la la"],
			[66222, "Inside an empty room,"],
			[68365, "my inspiration flows"],
			[69703, "Now wait to hear the tune,"],
			[71970, "around my head it goes"],
			[73363, "The magic melody,"],
			[75643, "you want to sing with me"],
			[76953, "Just la la la la la,"],
			[79244, "the music is the key"],
			[80618, "And now the night is gone,"],
			[82896, "still it goes on and on"],
			[84569, "So deep inside of me,"],
			[86569, "I long to set it free"],
			[87798, "I don't know what to do,"],
			[90148, "just can't explain to you"],
			[91520, "I don't know what to say,"],
			[93719, "oh, not another word"],
			[95102, "Just la la la la la,"],
			[97370, "it goes around the world"],
			[98686, "Just la la la la la,"],
			[100998, "it's all around the world"],
			[102346, "Just la la la la la,"],
			[104654, "and everybody's singing"],
			[106265, "La la la la la,"],
			[108335, "and now the bells are ringing"],
			[109934, "La la la la la,"],
			[111990, "la la la la la la la,"],
			[113570, "la la la la la,"],
			[115638, "la la la la la la la"],
			[117158, "La la la la la,"],
			[119243, "la la la la la la la,"],
			[120760, "la la la la la,"],
			[122783, "la la la la la la la"],
			[140666, "The kisses of the sun"],
			[141800, "kisses of the sun,"],
			[143170, "of the sun, of the sun"],
			[146269, "Around, around, around,"],
			[148656, "around, around, around,"],
			[151500, "around the world"],
			[155651, "La la la la la,"],
			[157368, "it goes around the world"],
			[158756, "Just la la la la la,"],
			[160996, "it's all around the world"],
			[162378, "Just la la la la la,"],
			[164677, "and everybody's singing"],
			[166255, "La la la la la,"],
			[168325, "and now the bells are ringing"],
			[169839, "La la la la la,"],
			[171969, "la la la la la la la,"],
			[173548, "la la la la la,"],
			[175599, "la la la la la la la"],
			[176854, "La la la la la,"],
			[179229, "la la la la la la la,"],
			[180845, "la la la la la,"],
			[182973, "la la la la la la la"],
			[184457, "La la la la la,"],
			[186209, "la la la la la la la"],
			[188100, "La la la la la,"],
			[190191, "la la la la la la la,"],
			[191725, "La la la la la,"],
			[193897, "la la la la la la la"],
			[195401, "La la la la la,"],
			[197444, "la la la la la la la"],
		],
	},
	{
		name: "Edward Sharpe - Home",
		url: "https://www.youtube.com/watch?v=DHEOF_rcND8",
		lyrics: [
			[18904, "Alabama, Arkansas"],
			[21420, "I do love my ma and pa"],
			[23135, "Not that way that"],
			[24222, "I do love you"],
			[27329, "Well, holy moly, me oh my"],
			[29568, "You're the apple of my eye"],
			[31750, "Girl, I've never"],
			[32802, "loved one like you"],
			[35957, "Man, oh man,"],
			[36756, "you're my best friend"],
			[38000, "I scream it to"],
			[38852, "the nothingness"],
			[40696, "There aint nothing that I need"],
			[44250, "Well, hot and heavy,"],
			[45575, "pumpkin pie"],
			[46620, "Chocolate candy,"],
			[47712, "Jesus Christ"],
			[48843, "Ain't nothing please"],
			[50100, "me more than you"],
			[52800, "Oh, home, let me come home"],
			[57269, "Home is wherever I'm with you"],
			[61250, "Oh, home, let me come home"],
			[65835, "Home is wherever I'm with you"],
			[84969, "La, la, la, la, take me home"],
			[90069, "(Daddy) Mother, Im coming home"],
			[114200, "I'll follow you into the park"],
			[116453, "Through the jungle,"],
			[117525, "through the dark"],
			[118687, "Girl, I never"],
			[119678, "loved one like you (hey)"],
			[122943, "Moats and boats and waterfalls"],
			[125210, "Alleyways and pay phone calls"],
			[127420, "I've been everywhere"],
			[129200, "(hey) with you"],
			[130569, "That's true,"],
			[131696, "laugh until we think we'll die"],
			[133869, "Barefoot on a summer night"],
			[135918, "Never could be sweeter"],
			[137469, "than with you (hey)"],
			[140200, "And in the streets"],
			[141174, "you run a-free"],
			[142452, "Like it's only you and me"],
			[144654, "Geez, you're something to see"],
			[148395, "Oh, home, let me come home"],
			[153334, "Home is wherever I'm with you"],
			[157269, "Oh, home, let me come home"],
			[161840, "Home is wherever I'm with you"],
			[181000, "La, la, la, la, take me home"],
			[186532, "(Daddy) Mother, Im coming home"],
			[193933, "Jade"],
			[194859, "Alexander"],
			[196300, "Do you remember that day"],
			[197379, "you fell out of my window?"],
			[198899, "I sure do, you came"],
			[199956, "jumping out after me"],
			[202000, "Well, you fell on the concrete"],
			[204123, "nearly broke your ass"],
			[205117, "And you were bleedin'"],
			[206015, "all over the place"],
			[206983, "And I rushed you out to the"],
			[208067, "hospital, you remember that?"],
			[209311, "Yes, I do"],
			[210300, "Well, theres something I never"],
			[211270, "told you about that night"],
			[212757, "What didn't you tell me?"],
			[214222, "While you were sitting in the"],
			[215200, "backseat smoking a cigarette"],
			[217038, "You thought was gonna"],
			[217847, "be your last"],
			[219500, "I was falling deep,"],
			[221192, "deeply in love with you"],
			[223400, "And I never told you"],
			[224800, "'til just now"],
			[225901, "Aww"],
			[227545, "Oh, home, let me come home"],
			[231988, "Home is wherever I'm with you"],
			[235866, "Oh, home, let me come home"],
			[240696, "Home is where I'm"],
			[242000, "alone with you"],
			[244780, "Home, let me come home"],
			[249397, "Home is wherever I'm with you"],
			[253686, "Oh, home, yes, I am home"],
			[258716, "Home is when I'm"],
			[260275, "alone with you"],
			[263289, "Alabama, Arkansas"],
			[267569, "I do love my ma and pa"],
			[271618, "Moats and boats and waterfalls"],
			[275960, "Alleyways and pay phone calls"],
			[284569, "Home is when"],
			[285600, "I'm alone with you"],
			[293000, "Home is when"],
			[294081, "I'm alone with you"],
		],
	},
	{
		name: "NCS - MATAFAKA",
		url: "https://ncs.io/track/download/73f99b09-2aab-4e7f-b3d2-384093a92d7f",
		lyrics: [
			[27769, "Matafaka, matafaka"],
			[48000, "Matafaka, matafaka"],
			[90696, "Uh, thank God that"],
			[91960, "the brother's on the rise now"],
			[93777, "Endless celebrations"],
			[94772, "all at my house"],
			[96300, "Levitatin' now I'm"],
			[96935, "super duper fly now"],
			[98696, "Lemon boy but they"],
			[99560, "see why I reside now"],
			[100900, "Put the time in while you"],
			[102064, "always yellin' time out"],
			[103700, "Fa critic 'cause I"],
			[104218, "know I'm comin' wit it"],
			[105761, "You were sittin"],
			[106387, "you were wishin,"],
			[106939, "I was handlin' my business"],
			[108300, "Now I got the ball like"],
			[109300, "Harry Potter playin' Quidditch"],
			[110625, "And my nuts are so humongous"],
			[111722, "you would think that"],
			[112514, "Hagrid's in it"],
			[113200, "Ah man, I'm all bad,"],
			[114721, "yeah I'm all bad"],
			[115888, "Workin' for that whip, yeah"],
			[116989, "that what you call that"],
			[118202, "I'ma blow up in the summer"],
			[119437, "have 'em yellin', \"Fall back\""],
			[120643, "And I've always been ahead"],
			[121978, "like an effin ball cap"],
			[123304, "Man, I came in the"],
			[124329, 'game like, "Woah"'],
			[125331, "Gotta couple chains on"],
			[126412, "me 'cause I like gold"],
			[127747, "They told me I'm the best,"],
			[128733, 'and I told \'em, "I know"'],
			[130350, "'Cause when I'm in your"],
			[131188, "town every ticket I sold"],
			[133589, "Yeah, they sayin' I'm"],
			[134808, "the man, facts bro"],
			[136591, "A lot of haters, tell"],
			[137706, "me where they at though"],
			[138864, "I'm the new pop all"],
			[140018, "I do is rap dough"],
			[141365, '"Want me on your song?"'],
			[142492, "Throw a couple stacks yo"],
			[144500, "Everybody wanna"],
			[145336, "do the same thing"],
			[146754, "That's why we ain't"],
			[148081, "on the same page"],
			[149348, "Do my own thing,"],
			[150200, "and I maintain"],
			[151764, "Flow like water so"],
			[152842, "I'm goin' mainstream"],
			[155308, "I'm goin' mainstream"],
			[156888, "Flow like water so"],
			[157848, "I'm goin' mainstream"],
			[160095, "Yeah, I'm goin' mainstream"],
			[161840, "Flow like water so"],
			[163000, "I'm goin' mainstream"],
			[165600, "I'm going mainstream"],
			[168300, "Mainstream"],
			[172000, "Flow like water so"],
			[173064, "I'm goin' mainstream"],
			[177000, "Yup"],
			[183615, "I'm goin' mainstream"],
			[186930, "Damn"],
			[192115, "Flow like water so"],
			[193132, "I'm goin' mainstream"],
			[196813, "Wooh"],
			[203444, "I'm goin' mainstream"],
			[212400, "Flow like water so"],
			[213421, "I'm goin' mainstream"],
			[215000, "They sayin' I'm"],
			[215696, "the man, facts bro"],
			[217369, "A lot of haters, tell"],
			[218700, "me where they at though"],
			[220000, "I'm the new pop all"],
			[221080, "I do is rap dough"],
			[222233, '"Want me on your song?"'],
			[223270, "Throw a couple stacks yo"],
			[225138, "Everybody wanna"],
			[226185, "do the same thing"],
			[227662, "That's why we ain't"],
			[228949, "on the same page"],
			[230224, "Do my own thing,"],
			[231500, "and I maintain"],
			[232585, "Flow like water so"],
			[233700, "I'm goin' mainstream"],
			[236488, "I'm goin' mainstream"],
			[237842, "Flow like water so"],
			[238658, "I'm goin' mainstream"],
			[240700, "Yeah, I'm goin' mainstream"],
			[242696, "Flow like water so"],
			[243800, "I'm goin' mainstream"],
			[246489, "I'm goin' mainstream"],
			[249308, "Mainstream"],
			[252903, "Flow like water so"],
			[253917, "I'm goin' mainstream"],
		],
	},
	{
		name: "Yungatina - 7 Weeks 3 Days",
		lyrics: [
			[15469, "When we met, I just knew"],
			[18004, "That I already loved you,"],
			[19907, "true, true"],
			[22551, "I didn't even get it why"],
			[26231, "Why you gotta stare"],
			[27544, "with those eyes?"],
			[30013, "I'm right across"],
			[30735, "the dance floor"],
			[32735, "Like it was just last night"],
			[37240, "I didn't even get it why"],
			[41076, "Why you gotta say goodbye?"],
			[44700, "I should have called"],
			[45400, "him by his last name"],
			[47333, "It's been seven weeks"],
			[48800, "and three days"],
			[52110, "I should have called"],
			[52836, "him by his last name"],
			[55555, "It's been seven weeks"],
			[56950, "and three days"],
			[59519, "I should have called"],
			[60300, "him by his last name"],
			[62100, "It's been seven weeks"],
			[63700, "and three days"],
			[66830, "I should have called"],
			[67542, "him by his last name"],
			[70615, "It's been seven weeks"],
			[71693, "and three days"],
			[74500, "Boy, I let you in"],
			[76969, "You didn't even have to knock"],
			[81629, "An extra key on the first day"],
			[85519, "I know the sheets"],
			[86166, "by the first date"],
			[89000, "We really made somethin'"],
			[91869, "A miracle that most won't see"],
			[96345, "But it meant a lot to me"],
			[100109, "I don't get why you"],
			[101018, "had to leave"],
			[103768, "I should have called"],
			[104521, "him by his last name"],
			[106400, "It's been seven weeks"],
			[107973, "and three days"],
			[111125, "I should have called"],
			[111856, "him by his last name"],
			[114923, "It's been seven weeks"],
			[116039, "and three days"],
			[118539, "I should have called"],
			[119300, "him by his last name"],
			[121400, "It's been seven weeks"],
			[122790, "and three days"],
			[125950, "I should have called"],
			[126769, "him by his last name"],
			[129588, "It's been seven weeks"],
			[130772, "and three days"],
			[133396, "All my friends say, fuck you!"],
			[136060, "But I can't even help"],
			[137459, "but love you"],
			[140736, "And even though you"],
			[141636, "run me out dry"],
			[144400, "I still think you're"],
			[145200, "a decent guy, why?"],
			[162979, "I should have called"],
			[163662, "him by his last name"],
			[165500, "It's been seven weeks"],
			[166881, "and three days"],
			[170180, "I should have called"],
			[170973, "him by his last name"],
			[173911, "It's been seven weeks"],
			[175137, "and three days"],
			[177631, "I should have called"],
			[178249, "him by his last name"],
			[181276, "It's been seven weeks"],
			[182558, "and three days"],
			[184969, "I should have called"],
			[185700, "him by his last name"],
			[187900, "It's been seven weeks"],
			[189150, "and three days, days"],
		],
	},
	{
		name: "ABBA - Gimme Gimme Gimme",
		lyrics: [
			[36154, "Half past twelve"],
			[38000, "And I'm watchin' the late show"],
			[39927, "in my flat, all alone"],
			[41861, "How I hate to spend"],
			[42969, "the evening on my own"],
			[46500, "Autumn winds"],
			[47863, "Blowin' outside the window"],
			[49851, "as I look around the room"],
			[51900, "And it makes me so depressed"],
			[53607, "to see the gloom"],
			[57000, "There's not a soul out there"],
			[60844, "No one to hear my prayer"],
			[68506, "Gimme, gimme, gimme"],
			[69925, "a man after midnight"],
			[72489, "Won't somebody help me"],
			[74042, "chase these shadows away?"],
			[76630, "Gimme, gimme, gimme"],
			[78054, "a man after midnight"],
			[80310, "Take me through the darkness"],
			[81940, "to the break of the day"],
			[104666, "Movie stars"],
			[106200, "Find the end of the rainbow"],
			[108198, "with a fortune to win"],
			[109961, "It's so different from"],
			[111291, "the world I'm living in"],
			[114765, "Tired of TV"],
			[116600, "I open the window"],
			[118221, "and I gaze into the night"],
			[120176, "But there's nothing"],
			[121208, "there to see, no one in sight"],
			[125400, "There's not a soul out there"],
			[129180, "No one to hear my prayer"],
			[136897, "Gimme, gimme, gimme"],
			[138365, "a man after midnight"],
			[140688, "Won't somebody help me"],
			[142380, "chase these shadows away?"],
			[144997, "Gimme, gimme, gimme"],
			[146500, "a man after midnight"],
			[148517, "Take me through the darkness"],
			[150330, "to the break of the day"],
			[153273, "Gimme, gimme, gimme"],
			[154461, "a man after midnight"],
			[161278, "Gimme, gimme, gimme"],
			[162487, "a man after midnight"],
			[220555, "There's not a soul out there"],
			[224478, "No one to hear my prayer"],
			[232240, "Gimme, gimme, gimme"],
			[233628, "a man after midnight"],
			[236180, "Won't somebody help me"],
			[237630, "chase these shadows away?"],
			[240256, "Gimme, gimme, gimme"],
			[241650, "a man after midnight"],
			[243998, "Take me through the darkness"],
			[245584, "to the break of the day"],
			[248150, "Gimme, gimme, gimme"],
			[249645, "a man after midnight"],
			[251905, "Won't somebody help me"],
			[253531, "chase these shadows away?"],
			[256205, "Gimme, gimme, gimme"],
			[257617, "a man after midnight"],
			[259823, "Take me through the darkness"],
			[261543, "to the break of the day"],
		],
	},
	{
		name: "One Direction - What Makes You Beautiful",
		lyrics: [
			[6755, "You're insecure,"],
			[8671, "don't know what for"],
			[10589, "You're turnin' heads"],
			[11748, "when you walk through the door"],
			[14387, "Don't need makeup"],
			[16391, "to cover up (Huh)"],
			[18249, "Bein' the way"],
			[19524, "that you are is enough"],
			[22869, "Everyone else in the"],
			[24627, "room can see it"],
			[26577, "Everyone else but you"],
			[29762, "Baby, you light up my world"],
			[31726, "like nobody else"],
			[33550, "The way that you flip your"],
			[35237, "hair gets me overwhelmed"],
			[37467, "But when you smile at the"],
			[39032, "ground, it ain't hard to tell"],
			[41259, "You don't know, oh-oh,"],
			[43862, "you dont know you're beautiful"],
			[45827, "If only you saw what I can see"],
			[48987, "You'll understand why"],
			[50300, "I want you so desperately"],
			[52731, "Right now I'm looking"],
			[54185, "at you and I can't believe"],
			[56701, "You don't know, oh-oh,"],
			[59238, "you dont know you're beautiful"],
			[61866, "oh-oh"],
			[63040, "Thats what makes you beautiful"],
			[68069, "So c-come on, you got it wrong"],
			[72002, "To prove I'm right,"],
			[73153, "I put it in a song"],
			[75794, "I don't know why"],
			[77767, "you're being shy"],
			[79744, "And turn away when"],
			[81014, "I look into your eyes"],
			[84196, "Everyone else in the"],
			[86069, "room can see it"],
			[88046, "Everyone else but you"],
			[91195, "Baby, you light up my"],
			[92809, "world like nobody else"],
			[95065, "The way that you flip your"],
			[96730, "hair gets me overwhelmed"],
			[98762, "But when you smile at the"],
			[100486, "ground, it ain't hard to tell"],
			[102677, "You don't know, oh-oh,"],
			[105315, "you dont know you're beautiful"],
			[107248, "If only you saw what I can see"],
			[110359, "You'll understand why"],
			[111673, "I want you so desperately"],
			[114054, "Right now I'm looking"],
			[115584, "at you and I can't believe"],
			[118040, "You don't know, oh-oh,"],
			[120610, "you dont know you're beautiful"],
			[123285, "oh-oh"],
			[124440, "Thats what makes you beautiful"],
			[127023, "Na, na-na-na, na-na-na, na, na"],
			[130275, "Na, na-na-na, na-na"],
			[134269, "Na, na-na-na, na-na-na, na, na"],
			[137947, "Na, na-na-na, na-na"],
			[141065, "Baby, you light up my world"],
			[143125, "like nobody else"],
			[144946, "The way that you flip your"],
			[146769, "hair gets me overwhelmed"],
			[148797, "But when you smile at the"],
			[150449, "ground, it ain't hard to tell"],
			[152684, "(You don't know, oh-oh)"],
			[155257, "You dont know you're beautiful"],
			[156666, "Baby, you light up my world"],
			[158415, "like nobody else"],
			[160242, "The way that you flip your"],
			[162099, "hair Cmon gets me overwhelmed"],
			[164116, "But when you smile at the"],
			[165735, "ground, it ain't hard to tell"],
			[167975, "You don't know, oh-oh,"],
			[170595, "you dont know you're beautiful"],
			[172614, "If only you saw what I can see"],
			[175609, "You'll understand why"],
			[177025, "I want you so desperately"],
			[179459, "Right now I'm looking"],
			[180956, "at you and I can't believe"],
			[183277, "You don't know oh-oh,"],
			[185983, "you dont know you're beautiful"],
			[188557, "oh-oh"],
			[189807, "You dont know you're beautiful"],
			[192498, "oh-oh"],
			[193665, "Thats what makes you beautiful"],
		],
	},
	{
		name: "The Coconut Song",
		url: "https://www.youtube.com/watch?v=PKQPey6L42M",
		lyrics: [
			[300, "La la la, la la la la,"],
			[2238, "la la la la la la"],
			[3847, "La la la, la la la la,"],
			[5872, "la la la la la la"],
			[7549, "La la la, la la la la,"],
			[9376, "la la la la la la"],
			[11039, "La la la, la la la la,"],
			[13054, "la la la la la la"],
			[14624, "KO KO NUT"],
			[16210, "KO KO KO KO NUT"],
			[17620, "(kokonut)"],
			[18469, "KO KO NUT"],
			[19697, "KO KO KO KO KO NUT"],
			[20974, "(kokonut)"],
			[21913, "KO KO NUT"],
			[23181, "KO KO KO KO KO NUT"],
			[24576, "(kokonut)"],
			[25476, "KO KO NUT"],
			[26701, "KO KO KO KO KO NUT"],
			[28647, "The kokonut nut"],
			[30081, "Is a giant nut"],
			[31813, "If you eat too much..."],
			[33417, "You'll get VERY fat!!!"],
			[35291, "Now"],
			[35958, "The kokonut nut"],
			[37331, "Is a big big nut"],
			[38895, "But this delicious nut..."],
			[40908, "Is NOT a nut!!!"],
			[42719, "It's a koko fruit"],
			[44502, "(It's a koko fruit)"],
			[46268, "Of the koko tree"],
			[47969, "(Of the koko tree)"],
			[49835, "From the koko palm family"],
			[52607, "La la la la la"],
			[53940, "There are so many uses"],
			[55274, "Of the kokonut tree"],
			[57242, "You can build a bigger"],
			[58512, "House for the family"],
			[60656, "All you need is to"],
			[62333, "Find the kokonut man"],
			[64737, "If he cuts the tree..."],
			[66302, "I get the fruits free!!!"],
			[68421, "It's a koko fruit"],
			[69966, "(It's a koko fruit)"],
			[71725, "Of the koko tree"],
			[73555, "(Of the koko tree)"],
			[75320, "From the koko palm family"],
			[78193, "La la la la la"],
			[79695, "KO KO NUT"],
			[81110, "KO KO KO KO KO NUT"],
			[82697, "(kokonut)"],
			[83559, "KO KO NUT"],
			[84605, "KO KO KO KO KO NUT"],
			[86567, "The kokonut bark for"],
			[88286, "the kitchen floor"],
			[89676, "If you save some of it..."],
			[91561, "You can build a door"],
			[93401, "Now"],
			[94110, "The kokonut trunk"],
			[95293, "Do not throw this junk"],
			[97138, "If you save some of it..."],
			[98638, "You'll have a second floor!!!"],
			[101111, "The kokonut wood"],
			[102480, "Is very good"],
			[104428, "It can stand 20 years..."],
			[106121, "If you pray it wood!!! :D"],
			[107809, "Now"],
			[108400, "The kokonut root"],
			[109821, "To tell you the truth"],
			[111387, "You can throw it..."],
			[112719, "Or use it as firewood!!!"],
			[115338, "The kokonut leaves"],
			[117128, "Good shade it gives"],
			[119053, "For the roof..."],
			[119975, "For the walls up"],
			[120928, "against the theives!!!"],
			[122441, "Now"],
			[123073, "The kokonut fruit"],
			[124486, "Says my relatives"],
			[126029, "Makes good cannon balls..."],
			[128202, "Up against the thieves!!!"],
			[129928, "It's a kokofruit"],
			[131557, "(It's a koko fruit)"],
			[133410, "Of the koko tree"],
			[135216, "(Of the koko tree)"],
			[137017, "From the koko palm family"],
			[139702, "La la la la la"],
			[141221, "The kokonut nut"],
			[142560, "Is a giant nut"],
			[144156, "If you eat too much..."],
			[145809, "You'll get very fat!!!"],
			[147732, "Now"],
			[148402, "The kokonut nut"],
			[149549, "Is a big big nut"],
			[151303, "But this delicious nut..."],
			[153317, "Is not a nut!!!"],
			[154817, "The kokonut nut"],
			[156762, "Is a giant nut"],
			[158314, "If you eat too much..."],
			[160037, "You'll get very fat!!!"],
			[161888, "Now"],
			[162400, "The kokonut nut"],
			[163918, "Is a big big nut"],
			[165493, "But this delicious nut..."],
			[167340, "Is not a nut!!!"],
			[168950, "It's a koko fruit"],
			[170888, "(It's a koko fruit)"],
			[172653, "Of the koko tree"],
			[174400, "(Of the koko tree)"],
			[176200, "From the koko palm family"],
			[178924, "La la la la la"],
			[180196, "It's a koko fruit"],
			[181669, "(It's a koko fruit)"],
			[183408, "Of the koko tree"],
			[185268, "(Of the koko tree)"],
			[186990, "From the koko palm family"],
			[189803, "La la la la la la"],
			[191000, "It's a koko fruit"],
			[192319, "(It's a koko fruit)"],
			[194359, "Of the koko tree"],
			[196295, "(Of the koko tree)"],
			[197913, "From the cocopalm familyyyyyyy"],
			[202400, "La la la la la la la la la"],
			[205269, "la la la la la la"],
			[206900, "la la la la la"],
			[208630, "Hooray"],
		],
	},
	{
		name: "The Neighbourhood - Sweater Weather",
		lyrics: [
			[20957, "And all I am is a man"],
			[24559, "I want the world in my hands"],
			[28200, "I hate the beach"],
			[30535, "But I stand in California"],
			[33901, "with my toes in the sand"],
			[36100, "Use the sleeves of my sweater"],
			[38119, "Let's have an adventure"],
			[40288, "Head in the clouds"],
			[41600, "but my gravity centered"],
			[44140, "Touch my neck"],
			[45844, "and I'll touch yours"],
			[47931, "You in those little"],
			[49358, "high waisted shorts, oh"],
			[52969, "She knows what I think about"],
			[55400, "And what I think about"],
			[56800, "One love, two mouths"],
			[58913, "One love, one house"],
			[60607, "No shirt, no blouse"],
			[62627, "Just us, you find out"],
			[64384, "Nothing that I wouldn't wanna"],
			[65400, "tell you about, no"],
			[67000, "'Cause it's too cold"],
			[71187, "For you here"],
			[73917, "And now, so let me hold"],
			[78878, "Both your hands in"],
			[81500, "the holes of my sweater"],
			[83666, "And if I may just take"],
			[84600, "your breath away"],
			[85633, "I don't mind if there's"],
			[86521, "not much to say"],
			[87546, "Sometimes the silence"],
			[88333, "guides a mind"],
			[89468, "To move to a place so far away"],
			[91969, "The goosebumps start to raise"],
			[93402, "The minute that my left hand"],
			[94222, "meets your waist"],
			[95900, "And then I watch your face"],
			[97300, "Put my finger on your tongue"],
			[98100, "'cause you love to taste, yeah"],
			[100053, "These hearts adore, everyone"],
			[101600, "the other beats hardest for"],
			[103200, "Inside this place is warm"],
			[105200, "Outside it starts to pour"],
			[107945, "Coming down"],
			[109001, "One love, two mouths"],
			[111128, "One love, one house"],
			[112974, "No shirt, no blouse"],
			[114827, "Just us, you find out"],
			[116573, "Nothing that I wouldn't wanna"],
			[117363, "tell you about, no, no, no"],
			[121456, "'Cause it's too cold"],
			[125367, "For you here"],
			[128136, "And now, so let me hold"],
			[133068, "Both your hands in"],
			[135730, "the holes of my sweater"],
			[137000, "'Cause it's too cold"],
			[141000, "For you here"],
			[143643, "And now, so let me hold"],
			[148544, "Both your hands in"],
			[151275, "the holes of my sweater"],
			[153503, "Whoa, whoa, whoa"],
			[166200, "Whoa, whoa, whoa"],
			[173900, "Whoa, whoa, whoa"],
			[181651, "Whoa, whoa, whoa"],
			[189360, "Whoa, whoa, whoa"],
			[197069, "Whoa, whoa, whoa"],
			[202500, "'Cause it's too cold"],
			[206658, "For you here"],
			[209372, "And now, so let me hold"],
			[214380, "Both your hands in"],
			[217034, "the holes of my sweater"],
			[218300, "It's too cold"],
			[222133, "For you here"],
			[224871, "And now, let me hold"],
			[229934, "Both your hands in"],
			[232466, "the holes of my sweater"],
			[235598, "And it's too cold,"],
			[237606, "it's too cold"],
			[240600, "The holes of my sweater"],
		],
	},
	{
		name: "Tung Tung Tung Sahur - Ratatung",
		url: "https://www.youtube.com/watch?v=TZAdoZy6y34",
		lyrics: [
			[1, "Tung"],
			[748, "Ratata ta tung"],
			[2525, "Ratata ta tung"],
			[4461, "Ratata ta tung tung tung SAHUR"],
			[8293, "Ratata ta tung (hey)"],
			[10300, "Ratata ta tung (hey)"],
			[12090, "Ratata ta tung tung tung SAHUR"],
			[15995, "Ratata ta tung (hey)"],
			[17897, "Ratata ta tung (hey)"],
			[19800, "Ratata ta tung tung tung SAHUR"],
			[23200, "Crank it up,"],
			[23867, "here's my master plan,"],
			[25200, "Steal the crown like"],
			[25969, "a wanted man,"],
			[26993, "Pa pa pa pa da pa"],
			[29200, "Tralelero Tralala"],
			[30933, "Every hit is a battle won,"],
			[32841, "Drop that sound like"],
			[33700, "a smoking gun,"],
			[34939, "Pa pa pa pa da pa"],
			[36602, "Tralelero Tralala"],
			[39269, "Can you feel it now,"],
			[40947, "Rising through the crowd,"],
			[42826, "I'm the one they play"],
			[44444, "when the world gets loud!"],
			[46369, "Hey!"],
			[47000, "Ratata ta tung (hey)"],
			[48610, "Ratata ta tung (hey)"],
			[50422, "Ratata ta tung tung tung SAHUR"],
			[54406, "Ratata ta tung (hey)"],
			[56330, "Ratata ta tung (hey)"],
			[58206, "Ratata ta tung tung tung SAHUR"],
			[61600, "No..."],
			[62400, "I don't like boring verses..."],
			[64600, "So follow me!"],
			[66969, "Tralalero Tralala"],
			[69328, "Pa pa pa pa pa da pa pa"],
			[71238, "Tralalero Tralala"],
			[73088, "Pa pa pa pa pa da pa pa"],
			[75000, "Tralalero Tralala"],
			[76500, "Hey!"],
			[77666, "Can you feel it now,"],
			[79400, "Rising through the crowd,"],
			[81300, "I'm the one they play"],
			[82732, "when the world gets loud!"],
			[84817, "Hey!"],
			[85565, "Ratata ta tung (hey)"],
			[87013, "Ratata ta tung (hey)"],
			[89019, "Ratata ta tung tung tung SAHUR"],
			[92700, "Ratata ta tung (hey)"],
			[94640, "Ratata ta tung (hey)"],
			[96590, "Ratata ta tung tung tung SAHUR"],
			[100398, "Ratata ta tung (hey)"],
			[102367, "Ratata ta tung (hey)"],
			[104353, "Ratata ta tung tung tung SAHUR"],
			[108210, "Ratata ta tung (hey)"],
			[110035, "Ratata ta tung (hey)"],
			[112012, "Ratata ta tung tung tung SAHUR"],
		],
	},
	{
		name: "Quadeca - Candles On Fire",
		lyrics: [
			[24800, "Woke up feeling mad today"],
			[26300, "Bitch, im ugly, but"],
			[26900, "I act like Timmy Chalamet, uh"],
			[28666, "I hate these motherfuckers"],
			[29400, "so, so much"],
			[30221, "Why I keep on tryna get em"],
			[31100, "all to validate me?"],
			[32600, "Its no help, im living like,"],
			[33500, "Oh well"],
			[34359, "Like my English teacher said,"],
			[35083, "had to show em, I dont tell"],
			[36170, "I show em I dont fail,"],
			[37100, "they knowin me so well"],
			[38114, "I been catchin all the shade"],
			[39007, "they've been throwin im, Odell"],
			[41000, "Turn the cameras on"],
			[42311, "Quick water break"],
			[43005, "in the marathon"],
			[44242, "Walk in your room"],
			[45000, "and I set the mood"],
			[45883, "They aint gotta light the"],
			[46569, "Motherfuckin candles on fire"],
			[48500, "Cant see without da cameras on"],
			[50049, "Without a platform"],
			[50800, "to be standin on, uh"],
			[52369, "All this baggage"],
			[52971, "going over they heads"],
			[53817, "So I keep it underneath"],
			[54725, "how I carry on, ooh"],
			[56647, "Im goin crazy"],
			[58024, "Too hot for Milan,"],
			[58852, "had to add the AC (Woo)"],
			[60035, "Guess whats gettin"],
			[60696, "to em lately?"],
			[61916, "They been takin shots at a boy"],
			[63100, "I just say Cheese!"],
			[64154, "I smell the green,"],
			[64669, "thats synesthesia"],
			[65332, "Growin up, im already"],
			[66100, "too old for Chris D'Elia"],
			[67245, "They tryna run they mouth,"],
			[68169, "checkin in on that big career"],
			[69242, "and look, its nada"],
			[70202, "Voila, it disappeared, ok, ayy"],
			[72006, "These sparks are fickle"],
			[72830, "and simple-minded"],
			[73590, "Flashlight in the dark"],
			[74501, "how people gon get behind em"],
			[75500, "I never killed my ego,"],
			[76447, "its trippin on psilocybin"],
			[77453, "That Shit'll kill me inside if"],
			[78367, "they hear it and never mind-it"],
			[79546, "Ive been gassed up, thats why"],
			[80750, "they dont hold a candle to me"],
			[81958, "Masked up way before"],
			[82747, "it was a standard duty"],
			[83811, "Back up, I came in this Shit"],
			[85295, "Put my sticks in the ground so"],
			[86367, "I sorry but you cant remove me"],
			[88241, "Turn the cameras on"],
			[89447, "Quick water break"],
			[90095, "in the marathon"],
			[91402, "Walk in your room"],
			[92122, "and I set the mood"],
			[93200, "They aint gotta light the"],
			[94000, "Motherfuckin candles on fire"],
			[95634, "Cant see without da cameras on"],
			[97305, "Without a platform"],
			[98000, "to be standin on, uh"],
			[99511, "All this baggage"],
			[100207, "going over they heads"],
			[100981, "So I keep it underneath"],
			[101830, "how I carry on, ooh"],
			[107300, "They put the red dot"],
			[107958, "right back on his head"],
			[109466, "In fact, it never left"],
			[110527, "Fuck a gold plaque,"],
			[111249, "I want platinum instead, uh"],
			[113200, "It wont matter no less"],
			[114573, "All my nights sleepless,"],
			[115363, "but my dreams still vivid"],
			[116629, "Hole getting deeper,"],
			[117342, "but the team still winnin"],
			[118586, "Let me look around,"],
			[119163, "like will you please love me?"],
			[120491, "End up in the ground,"],
			[121124, "will they still think of me"],
			[122411, "Where they stil feel something"],
			[123396, "Aint nobody laughing,"],
			[124186, "but it still feels funny to me"],
			[125621, "Its all a game, all these"],
			[126461, "people just a number to me"],
			[127550, "And what could it be?"],
			[128369, "No matter how I feel you could"],
			[129422, "bet I give em somethin to see"],
			[130681, "Whats the price of"],
			[131292, "living comfortably?"],
			[132098, "All these numbers mind numbing"],
			[132822, "to me, its nothin to me"],
			[134266, "Get my pants tailored"],
			[135111, "with the big pockets"],
			[136033, "I dont give em much room"],
			[136966, "when they Shit talkin, ayy"],
			[139300, "Turn the cameras on"],
			[140666, "Quick water break"],
			[141500, "in the marathon"],
			[142615, "Walk in your room"],
			[143306, "and I set the mood"],
			[144334, "They aint gotta light the"],
			[145121, "Motherfuckin candles on fire"],
			[146819, "Cant see without da cameras on"],
			[148460, "Without a platform"],
			[149221, "to be standin on, uh"],
			[150747, "All this baggage"],
			[151395, "going over they heads"],
			[152229, "So I keep it underneath"],
			[153003, "how I carry on, ooh"],
			[155313, "Turn the cameras on"],
			[158388, "Walk in your room"],
			[159059, "and I set the mood"],
			[160060, "They aint gotta light the"],
			[160644, "Motherfuckin candles on fire"],
			[163265, "Cameras on"],
			[164276, "Without a platform"],
			[164968, "to be standing on"],
			[166336, "All this baggage"],
			[167039, "going over they heads"],
			[167882, "So I keep it underneath"],
			[168792, "how I carry on, ooh"],
			[174644, "The route up the ice ridge"],
			[175560, "was hard but safe"],
			[177296, "Boyson could watch the"],
			[178419, "avalanches go by and"],
			[180230, "even enjoy the view"],
		],
	},
	{
		name: "Justin Bieber - Stay",
		lyrics: [
			[30600, "I do the same"],
			[31500, "thing I told you that"],
			[32399, "I never would"],
			[33325, "I told you I'd change,"],
			[34347, "even when I knew I never could"],
			[36018, "I know that I can't"],
			[37133, "find nobody else as good as u"],
			[38797, "I need you to stay,"],
			[39822, "need you to stay, hey (oh)"],
			[42100, "I get drunk,"],
			[42869, "wake up,"],
			[43755, "I'm wasted still"],
			[44922, "I realize the time"],
			[46235, "that I wasted here"],
			[47700, "I feel like"],
			[48511, "you can't feel the way I feel"],
			[50479, "Oh, I'll be fucked up"],
			[51699, "if you can't be right here"],
			[53128, "Oh, ooh-woah"],
			[54500, "(oh, ooh-woah, ooh-woah)"],
			[55948, "Oh, ooh-woah"],
			[57416, "(oh, ooh-woah, ooh-woah)"],
			[58774, "Oh, ooh-woah"],
			[59900, "(oh, ooh-woah, ooh-woah)"],
			[61387, "Oh, I'll be fucked up"],
			[62959, "if you can't be right here"],
			[64384, "I do the same"],
			[65500, "thing I told you that"],
			[66141, "I never would"],
			[67188, "I told you I'd change,"],
			[68218, "even when I knew I never could"],
			[69909, "I know that I can't"],
			[70925, "find nobody else as good as u"],
			[72730, "I need you to stay,"],
			[73869, "need you to stay, hey"],
			[75800, "I do the same"],
			[76800, "thing I told you that"],
			[77600, "I never would"],
			[78467, "I told you I'd change,"],
			[79539, "even when I knew I never could"],
			[81217, "I know that I can't"],
			[82353, "find nobody else as good as u"],
			[84004, "I need you to stay,"],
			[85260, "need you to stay, hey"],
			[87106, "When I'm away from you,"],
			[88438, "I miss your touch (ooh)"],
			[90057, "You're the reason"],
			[90762, "I believe in love"],
			[92876, "It's been difficult"],
			[93817, "for me to trust (ooh)"],
			[95653, "And I'm afraid that"],
			[96320, "I'ma fuck it up"],
			[98560, "Ain't no way"],
			[99133, "that I can leave you stranded"],
			[101364, "'Cause you ain't ever"],
			[102100, "left me empty-handed"],
			[104129, "And you know that I know that"],
			[105810, "I can't live without you"],
			[107823, "So, baby, stay"],
			[109657, "Oh, ooh-woah"],
			[111013, "(oh, ooh-woah, ooh-woah)"],
			[112382, "Oh, ooh-woah"],
			[113799, "(oh, ooh-woah, ooh-woah)"],
			[115300, "Oh, ooh-woah"],
			[116585, "(oh, ooh-woah, ooh-woah)"],
			[117900, "I'll be fucked up"],
			[119500, "if you can't be right here"],
			[120900, "I do the same"],
			[121900, "thing I told you that"],
			[122800, "I never would"],
			[123535, "I told you I'd change,"],
			[124625, "even when I knew I never could"],
			[126351, "I know that I can't"],
			[127624, "find nobody else as good as u"],
			[129142, "I need you to stay,"],
			[130318, "need you to stay, hey"],
			[132319, "I do the same"],
			[133150, "thing I told you that"],
			[134000, "I never would"],
			[134775, "I told you I'd change,"],
			[135978, "even when I knew I never could"],
			[137614, "I know that I can't"],
			[138753, "find nobody else as good as u"],
			[140407, "I need you to stay,"],
			[141500, "need you to stay, hey"],
			[148700, "Woah-oh"],
			[151991, "I need you to stay,"],
			[152856, "need you to stay, hey"],
		],
	},
	{
		name: "The Rare Occasions - Notion (Sped Up)",
		lyrics: [
			[9932, "Sure, it's a calming notion,"],
			[12416, "perpetual in motion"],
			[15056, "But I don't need the comfort"],
			[17680, "of any lies"],
			[20399, "For I have seen the ending,"],
			[22898, "and there is no ascending"],
			[25952, "Ri"],
			[26622, "Rii"],
			[27168, "Riii"],
			[27743, "Riii"],
			[28371, "Riiiise"],
			[30646, "Oh, back when I was younger,"],
			[33277, "was told by other youngsters"],
			[35861, "That my end will be torture"],
			[38422, "beneath the earth"],
			[41042, "'Cause I don't see what they see,"],
			[43707, "when death is staring at me"],
			[46361, "I see a window,"],
			[47150, "a limit,"],
			[47774, "to live it,"],
			[48337, "or not at all"],
			[75021, "If you could pull the lever"],
			[77533, "to carry on forever"],
			[80149, "Would your life even"],
			[81883, "matter anymore?"],
			[85414, "Sure, it's a calming notion,"],
			[87982, "perpetual in motion"],
			[90878, "But it's not"],
			[91625, "what"],
			[92168, "you"],
			[92746, "signed"],
			[93366, "up"],
			[94665, "for"],
			[107215, "I'm sure there won't"],
			[108481, "always be sunshine"],
			[112456, "But there's this momentary beam"],
			[115801, "of light"],
			[117407, "You don't have to wait"],
			[118400, "those salty decades"],
			[119935, "To get through the gate,"],
			[121020, "it's all in front of your face"],
			[122609, "I'm sure there won't"],
			[124303, "always be sunshine"],
			[128335, "I'm sure"],
			[129280, "there won't always be sunshine"],
			[133414, "But there's this momentary beam"],
			[136886, "of light"],
			[138210, "I could-could cross the ocean"],
			[140617, "in a fit of devotion"],
			[143351, "For every shining second,"],
			[145923, "this fragile body beckons"],
			[148660, "You think you're owed it better"],
			[151008, "believing ancient letters"],
			[153887, "Sure, it's a calming notion,"],
			[156736, "but it's a lie"],
			[157414, "but it's a liee"],
			[157958, "but it's a lieee"],
		],
	},
	{
		name: "Civilian - Close Call",
		lyrics: [
			[4969, "I just gotta let you know"],
			[7100, "Ever since you called me"],
			[9100, "Im tearing up my schedule"],
			[11069, "Cause I've been thinking"],
			[11844, "about you all week"],
			[13516, "When I get you alone"],
			[15100, "I don't feel loved like"],
			[15915, "I say I do"],
			[17801, "Cause he's calling your phone"],
			[19460, "I'm dodging bullets"],
			[20305, "the shape of you"],
			[22322, "Close call"],
			[23488, "I hope you never call me again"],
			[26418, "And so far"],
			[27789, "We're farther gone than"],
			[29174, "where we began"],
			[30800, "I'll let these memories fade"],
			[32800, "But I don't wanna forget"],
			[35303, "I'll never be your best"],
			[37501, "I'm letting you go"],
			[43700, "I should've known"],
			[44238, "it would end up like this"],
			[45600, "Late night body"],
			[46421, "to somebody I'd miss"],
			[47821, "Don't say you need"],
			[48777, "time for yourself"],
			[49956, "You mean somebody else"],
			[51700, "I know these days"],
			[54081, "I feel like I'm better alone"],
			[56946, "Sweet escape to me babe"],
			[59598, "I'm letting you go"],
			[61226, "Ill let these memories fade"],
			[63500, "So you can leave"],
			[64362, "my mind in peace"],
			[65774, "We made it one week"],
			[66539, "Want a piece of my mind"],
			[67764, "Baby do this on me"],
			[68758, "cause darling"],
			[70100, "When I get you alone"],
			[71695, "I don't feel loved"],
			[72509, "like I say I do"],
			[74500, "Cause he's calling your phone"],
			[76125, "I'm dodging bullets"],
			[76920, "in the shape of you"],
			[78934, "Close call"],
			[80069, "I hope you never call me again"],
			[83038, "And so far"],
			[84443, "We're farther gone than"],
			[85899, "where we began"],
			[87469, "I'll let these memories fade"],
			[89705, "But I don't wanna forget"],
			[91984, "I'll never be your best"],
			[94169, "I'm letting you go"],
			[96356, "Slow down (slow down)"],
			[97400, "let go (let go)"],
			[98600, "I won't call back like an echo"],
			[100437, "I could change my mind"],
			[101425, "like presto (presto)"],
			[102608, "But my heads held high"],
			[103647, "and my stress low"],
			[105000, "Alright let's go"],
			[107300, "Imma sign off like XO"],
			[109569, "You had a shot at this"],
			[110800, "A close call I'm"],
			[111300, "the one you'll miss"],
			[112600, "So come on now"],
			[122369, "Girl I really thought"],
			[122900, "I met my match"],
			[124122, "But without you and I"],
			[125001, "stroke it off like that"],
			[126128, "Baby now Im cutting a lit fuse"],
			[128476, "I see you in hindsight"],
			[129366, "it's all in my rearview"],
			[130769, "Our better days bind us"],
			[131769, "let it fade behind us"],
			[132844, "Tore us apart quicker"],
			[133852, "than get away drivers"],
			[135200, "I've been running"],
			[136000, "from the day I knew"],
			[137195, "I'm dodging bullets"],
			[138007, "the shape of you"],
			[140005, "Close call"],
			[141256, "I hope you never call me again"],
			[144125, "And so far"],
			[145504, "We're farther gone than"],
			[147030, "where we began"],
			[148433, "I'll let these memories fade"],
			[150816, "But I don't wanna forget"],
			[153060, "I'll never be your best"],
			[155240, "I'm letting you go"],
		],
	},
	{
		name: "Pharmacist - North Memphis",
		lyrics: [
			[11200, "Pharmacist motherfucker"],
			[12500, "Project Pat don't give a fu-"],
			[18400, "Project Pat don't give a fuck"],
			[25485, "North Memphis nigga,"],
			[26436, "North Memphis nigga"],
			[27505, "North Memphis,"],
			[28271, "North Memphis nigga"],
			[29729, "Project Pat don't give a fuck"],
			[31117, "North Memphis nigga,"],
			[32182, "North Memphis nigga"],
			[33275, "North Memphis-"],
			[33984, "North Memphis nigga"],
			[35500, "The definition of a player"],
			[37392, "A nigga that play hoes"],
			[38543, "to make the ends meet"],
			[39696, "You gotta know the game,"],
			[40700, "how it's played,"],
			[41446, "it's all about thinkin' deep"],
			[42521, "Sum' gonna cross you out,"],
			[44000, "sum' gonna smoke you out"],
			[45420, "But you can talk yo' ass"],
			[46475, "off my Glock,"],
			[47100, "I'm breakin' somethin' off"],
			[48262, "Proper, I kick it at"],
			[49514, "right up where the players at"],
			[51116, "Bumpin', pimpin', smokin' sess"],
			[52604, "with Dre and Ray-Ray"],
			[53599, "in that mask"],
			[54252, "We love to see these niggas"],
			[55460, "sweat up on our bitch you see"],
			[56901, "Drizzay hit them,"],
			[57608, "baby, then we vampin'"],
			[58579, "with them dead G's"],
			[59969, "North Memphis niggas,"],
			[60856, "North Memphis niggas"],
			[61917, "North Memphis,"],
			[62692, "North Memphis niggas"],
			[64094, "Project Pat don't give a fuck"],
			[65560, "North Memphis niggas,"],
			[66595, "North Memphis niggas"],
			[67687, "North Memphis,"],
			[68412, "North Memphis niggas"],
			[69838, "Project Pat don't give a fuck"],
			[72700, "Pharmacist motherfucker"],
		],
	},
	{
		name: "Maroon 5 - Payphone",
		lyrics: [
			[179, "I'm at a payphone,"],
			[2091, "trying to call home"],
			[4345, "All of my change,"],
			[5709, "I spent on you"],
			[8651, "Where have the times gone?"],
			[10780, "Baby, it's all wrong"],
			[13016, "Where are the plans"],
			[14361, "we made for two?"],
			[17905, "Yeah, I,"],
			[18857, "I know it's hard to remember"],
			[21112, "the people we used to be"],
			[23271, "It's even harder to picture"],
			[25527, "that youre not here next to me"],
			[27705, "You say it's too late"],
			[28656, "to make it,"],
			[29949, "but is it too late to try?"],
			[32095, "And in our time that u wasted,"],
			[33719, "all of our bridges burned down"],
			[36374, "I've wasted my nights,"],
			[38617, "you turned out the lights"],
			[40828, "Now I'm paralyzed"],
			[42992, "Still stuck in that time"],
			[45198, "when we called it love"],
			[47360, "But even the sun"],
			[49492, "sets in paradise"],
			[52516, "I'm at a payphone,"],
			[54431, "trying to call home"],
			[56638, "All of my change,"],
			[58048, "I spent on you"],
			[61013, "Where have the times gone?"],
			[63149, "Baby, it's all wrong"],
			[65297, "Where are the plans"],
			[66710, "we made for two?"],
			[69731, "If happy-ever-afters did exist"],
			[74013, "I would still be"],
			[75175, "holding you like this"],
			[78365, "All those fairy tales"],
			[79794, "are full of shit"],
			[82735, "One more fucking love song,"],
			[84695, "I'll be sick,"],
			[87219, "oh, yeah"],
			[88809, "U turned your back on tomorrow"],
			[90918, "'cause you forgot yesterday"],
			[92930, "I gave you my love to borrow,"],
			[95180, "but you just gave it away"],
			[97559, "You can't expect me to be fine"],
			[99757, "I don't expect you to care"],
			[101831, "I know I said it before, but"],
			[103585, "all of our bridges burned down"],
			[106288, "I've wasted my nights,"],
			[108424, "you turned out the lights"],
			[110645, "Now I'm paralyzed (oh)"],
			[112876, "Still stuck in that time"],
			[115055, "when we called it love"],
			[117183, "But even the sun"],
			[119321, "sets in paradise"],
			[122100, "I'm at a payphone,"],
			[124275, "trying to call home"],
			[126435, "All of my change,"],
			[127888, "I spent on you"],
			[130200, "(oh-oh)"],
			[131000, "Where have the times gone?"],
			[132988, "Baby, it's all wrong"],
			[135184, "Where are the plans"],
			[136400, "we made for two?"],
			[138900, "(Yeah)"],
			[139590, "If happy-ever-afters did exist"],
			[143818, "I would still be"],
			[144927, "holding you like this"],
			[148219, "And all those fairy tales"],
			[149631, "are full of shit"],
			[152597, "One more fucking love song,"],
			[154488, "I'll be sick"],
			[156952, "Now I'm at a payphone"],
			[158984, "Man, fuck that shit"],
			[160307, "I be out spendin' all this"],
			[161280, "money while you sittin' 'round"],
			[162546, "Wondering why it wasn't"],
			[163519, "you who came up from nothin'"],
			[164602, "Made it from the bottom,"],
			[165388, "now when you see me im stuntin"],
			[166969, "And all of my cars start"],
			[167813, "with the push of a button"],
			[169057, "Telling me I changed since I"],
			[170000, "blew up or whatever u call it"],
			[171414, "Switched the number to my"],
			[172309, "phone so u never could call it"],
			[173612, "Don't need my name on my shirt"],
			[174775, "you can tell that I'm ballin'"],
			[175811, "Swish, what a shame,"],
			[176920, "coulda got picked"],
			[178085, "Had a really good game,"],
			[179208, "but you missed your last shot"],
			[180237, "So you talk about who"],
			[181177, "you see at the top"],
			[182055, "Or what you could've saw,"],
			[182951, "but sad to say, it's over for"],
			[184500, "Phantom pulled up,"],
			[185226, "valet opened doors"],
			[186771, "Wished I'd go away,"],
			[187383, "got what you was looking for"],
			[188867, "Now it's me who they want"],
			[190069, "So you can go and take that"],
			[191008, "little piece of shit with you"],
			[191889, "I'm at a payphone,"],
			[194064, "trying to call home"],
			[196260, "All of my change,"],
			[197507, "I spent on you"],
			[200700, "Where have the times gone?"],
			[202788, "Baby, it's all wrong"],
			[204942, "Where are the plans"],
			[206321, "we made for two?"],
			[209188, "If happy-ever-afters did exist"],
			[213603, "I would still be"],
			[214822, "holding you like this"],
			[217947, "And all these fairy tales"],
			[219502, "are full of shit"],
			[222418, "One more fucking love song,"],
			[224266, "I'll be sick"],
			[226662, "Now I'm at a payphone"],
		],
	},
	{
		name: "Passenger - Let Her Go",
		url: "https://www.youtube.com/watch?v=8a1eG-Y0u6Y",
		lyrics: [
			[12510, `Well, you only need the light`],
			[13510, `when it's burning low`],
			[16310, `Only miss the sun when it`],
			[17310, `starts to snow`],
			[19690, `Only know you love her when`],
			[20690, `you let her go`],
			[25880, `Only know you've been high`],
			[26880, `when you're feeling low`],
			[29710, `Only hate the road when`],
			[30710, `you're missing home`],
			[33230, `Only know you love her when`],
			[34230, `you let her go`],
			[39390, `And you let her go`],
			[53420, `Staring at the bottom of`],
			[54420, `your glass`],
			[56170, `Hoping one day you'll make`],
			[57170, `a dream last`],
			[59380, `Dreams come slow and go`],
			[60380, `so fast`],
			[106620, `You see her when you close`],
			[107620, `your eyes`],
			[109360, `Maybe one day you'll`],
			[110360, `understand why`],
			[112680, `Everything you touch`],
			[113680, `surely dies`],
			[118830, `But you only need the light`],
			[119830, `when it's burning low`],
			[122630, `Only miss the sun when it`],
			[123630, `starts to snow`],
			[125900, `Only know you love her when`],
			[126900, `you let her go`],
			[132200, `Only know you've been high`],
			[133200, `when you're feeling low`],
			[135870, `Only hate the road when`],
			[136870, `you're missing home`],
			[139130, `Only know you love her when`],
			[140130, `you let her go`],
			[146520, `Staring at the ceiling in`],
			[147520, `the dark`],
			[149040, `Same old empty feeling in`],
			[150040, `your heart`],
			[152140, `'Cause love comes slow and`],
			[153140, `it goes so fast`],
			[199410, `Well, you see her when you`],
			[200410, `fall asleep`],
			[201780, `But never to touch and`],
			[202780, `never to keep`],
			[205050, `'Cause you loved her too much`],
			[206050, `and dived too deep`],
			[212060, `Well, you only need the light`],
			[213060, `when it's burning low`],
			[215800, `Only miss the sun when it`],
			[216800, `starts to snow`],
			[219120, `Only know you love her when`],
			[220120, `you let her go`],
			[225190, `Only know you've been high`],
			[226190, `when you're feeling low`],
			[229110, `Only hate the road when`],
			[230110, `you're missing home`],
			[232430, `Only know you love her when`],
			[233430, `you let her go`],
			[238660, `And you let her go`],
			[245320, `And you let her go`],
			[251940, `Well, you let her go`],
			[305120, `Well, you only need the light`],
			[306120, `when it's burning low`],
			[308840, `Only miss the sun when it`],
			[309840, `starts to snow`],
			[312230, `Only know you love her when`],
			[313230, `you let her go`],
			[318220, `Only know you've been high`],
			[319220, `when you're feeling low`],
			[322210, `Only hate the road when`],
			[323210, `you're missing home`],
			[325620, `Only know you love her when`],
			[326620, `you let her go`],
			[331900, `Well, you only need the light`],
			[332900, `when its burning low`],
			[336040, `Only miss the sun when it`],
			[337040, `starts to snow`],
			[339750, `Only know you love her when`],
			[340750, `you let her go`],
			[346550, `Only know you've been high`],
			[347550, `when you're feeling low`],
			[350690, `Only hate the road when`],
			[351690, `you're missing home`],
			[354290, `Only know you love her when`],
			[355290, `you let her go`],
			[401390, `And you let her go`],
		],
	},
	{
		name: "Busta Rhymes - Taking Everything",
		lyrics: [
			[811, "Yeah! Yeah! Yeah! Yeah!"],
			[3062, "Let's go! Let's go!"],
			[4300, "Let's go! Let's go!"],
			[5969, "Yeah! Yeah! Yeah! Yeah!"],
			[8300, "Let's go! Let's go!"],
			[9583, "Let's go! Let's go!"],
			[11464, "Yeah! Yeah! Yeah!"],
			[14149, "You ain't courageous enough,"],
			[15300, "most of you probably fold"],
			[16728, "You ain't willin' to face"],
			[17727, "the challenge acquire the gold"],
			[19395, "We only here to just retrieve"],
			[20486, "what you probably stole"],
			[22091, "Yeah! Yeah! Yeah! Yeah!"],
			[23228, "Yeah! Yeah! Yeah! Yeah!"],
			[24784, "You see steel, sharpen steel"],
			[26068, "when it's time for the go"],
			[27407, "We here to create such"],
			[28300, "a ruckus we all on a roll"],
			[30099, "To every challenge in the eye,"],
			[31361, "we don't play with the soul"],
			[32700, "No matter what you was told,"],
			[33800, "every rat find a hole"],
			[35455, "See it don't matter"],
			[36100, "what you thought"],
			[37000, "(Yeah! Yeah! Yeah!)"],
			[38029, "We takin' everything we want"],
			[39467, "(Whoa! Whoa! Whoa!)"],
			[40600, "Now don't forget it,"],
			[41383, "better know we come to get it"],
			[42791, "And we wit' it and"],
			[43587, "there's nothing better,"],
			[44499, "hope you know to play a sport"],
			[46112, "See it don't matter"],
			[46826, "what you thought"],
			[47686, "(Yeah! Yeah! Yeah!)"],
			[48757, "We takin' everything we want"],
			[50152, "(Whoa! Whoa! Whoa!)"],
			[51384, "Now don't forget it,"],
			[52129, "better know we come to get it"],
			[53545, "And we wit' it and"],
			[54247, "there's nothing better,"],
			[55194, "hope you know to play a sport"],
			[56688, "See all the greatness when"],
			[57660, "we come when the story is told"],
			[59390, "Can't put a timeline"],
			[60123, "on greatness it never gets old"],
			[61962, "Come get the scope when"],
			[62948, "we hot and you not"],
			[64182, "And we pull up and we come in"],
			[65559, "takin' everything you got, ugh"],
			[77969, "See it don't matter"],
			[78600, "what you thought"],
			[79400, "(Yeah! Yeah! Yeah!)"],
			[80600, "We takin' everything we want"],
			[82128, "(Whoa! Whoa! Whoa!)"],
			[83306, "Now don't forget it,"],
			[84008, "better know we come to get it"],
			[85400, "And we wit' it"],
			[86168, "and there's nothing better,"],
			[87072, "hope you know to play a sport"],
			[90200, "(Yeah! Yeah! Yeah!)"],
			[92800, "(Whoa! Whoa! Whoa!)"],
			[95460, "(Yeah! Yeah! Yeah!)"],
			[99169, "No matter what you thought,"],
			[100200, "you better believe we comin'"],
			[101900, "And if you thought"],
			[102500, "that we was playin',"],
			[103300, "let me show you something"],
			[104723, "So then we jump"],
			[105500, "and we swoop"],
			[106157, "and we dodge every bullet"],
			[107465, "It dont matter where they pull"],
			[108500, "up when they try to pull it"],
			[111200, "(Yeah! Yeah! Yeah!)"],
			[113666, "(Whoa! Whoa! Whoa!)"],
			[116853, "(Yeah! Yeah! Yeah!)"],
			[120796, "Better know we on the clock"],
			[122000, "and it's time to go (Yeah!)"],
			[123500, "Everything is tactical,"],
			[124500, "now enjoy the show (Yeah!)"],
			[126237, "Then we skip"],
			[126800, "and we bounce"],
			[127587, "and we hop"],
			[128100, "out of every situation"],
			[129392, "Best believe that"],
			[130212, "it's time to blow"],
			[131300, "See it don't matter"],
			[131900, "what you thought"],
			[132800, "(Yeah! Yeah! Yeah!)"],
			[133986, "We takin' everything we want"],
			[135446, "(Whoa! Whoa! Whoa!)"],
			[136666, "Now don't forget it,"],
			[137300, "better know we come to get it"],
			[138855, "And we wit' it"],
			[139400, "and there's nothing better,"],
			[140485, "hope you know to play a sport"],
			[150000, "Hah! Hah! Hah! Hah!"],
			[152700, "You know the heat melt,"],
			[153300, "better wear your seat belt"],
			[154500, "and strap up"],
			[155369, "You know we get a little crazy"],
			[156300, "every single time we ack up"],
			[157800, "I know that the way you see"],
			[158700, "us doin' it to 'em"],
			[159300, "I think you really,"],
			[159869, "really need to shack up"],
			[160600, "Yeah! Yeah! Yeah! Yeah!"],
			[168100, "Let's go! Let's go!"],
			[169400, "Let's go! Let's go!"],
			[173900, "See it don't matter"],
			[174600, "what you thought"],
			[175400, "(Yeah! Yeah! Yeah!)"],
			[176574, "We takin' everything we want"],
			[178100, "(Whoa! Whoa! Whoa!)"],
			[179300, "Now don't forget it,"],
			[180000, "better know we come to get it"],
			[181300, "And we wit' it"],
			[182000, "and there's nothing better,"],
			[183102, "hope you know to play a sport"],
			[184600, "See it don't matter"],
			[185300, "what you thought"],
			[186258, "(Yeah! Yeah! Yeah!)"],
			[187369, "We takin' everything we want"],
			[188817, "(Whoa! Whoa! Whoa!)"],
			[189900, "Now don't forget it,"],
			[190781, "better know we come to get it"],
			[192000, "And we wit' it"],
			[192852, "and there's nothing better,"],
			[193800, "hope you know to play a sport"],
		],
	},
	{
		name: "Italo Brothers - My Life is a Party",
		url: "https://www.youtube.com/watch?v=F7GeEAP4wcI",
		lyrics: [
			[1900, "I say, hey, you say, ho"],
			[5220, "Let's turn it up"],
			[5620, "and here we go"],
			[9830, "New York, LA, Berlin,"],
			[10230, "say, hey"],
			[16790, "To Tokyo, Rio de Janeiro,"],
			[17190, "here we go, go"],
			[24650, "Hello, hello"],
			[28050, "Can you just feel it,"],
			[28450, "are you ready to go?"],
			[31610, "Hello, hello"],
			[35590, "Do you receive my echo?"],
			[38730, "My life is a party,"],
			[39130, "my home is the club"],
			[42890, "I party like a rock star,"],
			[43290, "dance until I drop"],
			[46150, "My life is a party,"],
			[46550, "my home is the club"],
			[50520, "My stage is the dance floor,"],
			[50920, "party never stops"],
			[53810, "My life is a party,"],
			[54210, "my home is the club"],
			[57930, "I party like a rock star,"],
			[58330, "dance until I drop"],
			[61300, "My life is a party,"],
			[61700, "my home is the club"],
			[65380, "My stage is the dance floor,"],
			[65780, "party never stops"],
			[69160, "And I say, hey,"],
			[69560, "you say, ho"],
			[72750, "Let's turn it up"],
			[73150, "and here we go"],
			[76720, "I say, hey,"],
			[77120, "you say, ho"],
			[80360, "You spin me 'round"],
			[80760, "like a yo-yo"],
			[84710, "DC, Paris Bel-Air,"],
			[85110, "say, yeah"],
			[91880, "To Monaco, Santo Domingo,"],
			[92280, "here we go, go"],
			[99860, "Hello, hello"],
			[102980, "Can you just feel it,"],
			[103380, "are you ready to go?"],
			[106840, "Hello, hello"],
			[110580, "Do you receive my echo?"],
			[113720, "My life is a party,"],
			[114120, "my home is the club"],
			[117860, "I party like a rock star,"],
			[118260, "dance until I drop"],
			[121160, "My life is a party,"],
			[121560, "my home is the club"],
			[125320, "My stage is the dance floor,"],
			[125720, "party never stops"],
			[129060, "And I say, hey,"],
			[129460, "you say, ho"],
			[132860, "Let's turn it up"],
			[133260, "and here we go"],
			[136840, "I say, hey,"],
			[137240, "you say, ho"],
			[140180, "You spin me 'round"],
			[140580, "like a yo-yo"],
			[159740, "Hello, hello"],
			[162890, "Can you just feel it,"],
			[163290, "are you ready to go?"],
			[166730, "Hello, hello"],
			[170450, "Do you receive my echo?"],
			[173680, "My life is a party,"],
			[174080, "my home is the club"],
			[177850, "I party like a rock star,"],
			[178250, "dance until I drop"],
			[181240, "My life is a party,"],
			[181640, "my home is the club"],
			[185330, "My stage is the dance floor,"],
			[185730, "party never stops"],
			[189190, "And I say, hey,"],
			[189590, "you say, ho"],
			[192860, "Let's turn it up"],
			[193260, "and here we go"],
			[196860, "I say, hey,"],
			[197260, "you say, ho"],
			[200370, "You spin me 'round"],
			[200770, "like a yo-yo"],
		],
	},
	{
		name: "Devil May Cry 5 - Devils Never Cry",
		url: "https://www.youtube.com/watch?v=JUaBL5lpPdI",
		lyrics: [
			[26000, `Bless me with your gift of`],
			[27000, `light`],
			[29990, `Righteous cause on judgement`],
			[30990, `night`],
			[32870, `Feel the sorrow the light`],
			[33870, `has swallowed`],
			[35240, `Feel the freedom like no`],
			[36240, `tomorrow`],
			[51970, `Stepping forth a cure for`],
			[52970, `our soul's demise`],
			[55780, `Reap the tears of victim's`],
			[56780, `cries`],
			[58000, `Yearning more to hear the`],
			[59000, `suffer of a`],
			[61670, `Of a demon as i put it`],
			[62670, `under`],
			[64340, `Killed before,a time to`],
			[65340, `kill them all`],
			[68360, `Passed down the righteous law`],
			[70670, `Serve a justice that dwells`],
			[71670, `in me`],
			[73870, `Lifeless corpse as far the`],
			[74870, `eye can see`],
			[79870, `The eye can see`],
			[82120, `The eye can see`],
			[87890, `The eye can see`],
			[89970, `Bless me with the leaf off`],
			[90970, `of the tree`],
			[96270, `On it, i see the freedom`],
			[97270, `reign`],
			[102080, `We are falling,the light is`],
			[103080, `calling`],
			[108990, `Tears inside me calm me down`],
			[114980, `Midnight calling mist of`],
			[115980, `resolving`],
			[122120, `Crown me with the pure green`],
			[123120, `leaf`],
			[127870, `Praise to my father,blessed`],
			[128870, `by the water`],
			[134920, `Black night,dark sky,the`],
			[135920, `Devil's cry`],
			[140980, `Bless me with the (life of`],
			[141980, `vengeance, a passive test)`],
			[144230, `Leaf off of the tree (until`],
			[145230, `the gravel I will rest)`],
			[147780, `On it, I see (engage the`],
			[148780, `pressure until it crumbles)`],
			[150200, `The freedom reign (the`],
			[151200, `existence of black souls)`],
			[154080, `We are falling (onward to a`],
			[155080, `sacred battlefield)`],
			[156970, `The light is calling (where`],
			[157970, `limits are revealed)`],
			[160780, `Tears inside me (tools of`],
			[161780, `steel,in rage they conquer)`],
			[163960, `Calm me down (weed out the`],
			[164960, `killing of victim's stalker)`],
			[166890, `Midnight calling (the powers`],
			[167890, `proven to end the madness)`],
			[169880, `Mist of resolving (upon I`],
			[170880, `take it to end the savage)`],
			[172730, `Crown me with the (the rays`],
			[173730, `of light a truth of meaning)`],
			[176050, `Pure green leaf (to my`],
			[177050, `father the blood is pleading)`],
			[179760, `Bless me with the (a justice`],
			[180760, `rage for all to feel)`],
			[182890, `Leaf off of the tree (with`],
			[183890, `innocent hatred squeals)`],
			[185890, `On it, I see (the gore of`],
			[186890, `evil seems to satisfy)`],
			[188890, `The freedom reign (when`],
			[189880, `slain a maimed and pacified)`],
			[192030, `Praise to my father, Bless`],
			[193030, `by the water`],
			[198760, `Black night,dark sky,the`],
			[199760, `Devil's cry`],
		],
	},
];

const audios = musicTracks.map(() => null);

let musicMenuOpen = false;
let currentAudio = null;
let currentTrackIndex = -1;
let ytApiReady = false;
let ytApiLoading = false;
let ytPlayer = null;
let ytAudio = null;
let ytTick = 0;
let ytApiCallbacks = [];
let autoChatLyrics = true;
let musicDrag = { active: false, dx: 0, dy: 0 };
let musicStatusEl = null;
let musicTimeEl = null;
let musicDurEl = null;
let musicSeekEl = null;
let musicScrub = false;
let musicNowPlayingEl = null;
let musicLyricEl = null;

class SongPlayer {
	constructor() {
		this.songs = musicTracks.map((track, i) => ({
			name: track.name || `Track ${i + 1}`,
			url: track.url || null,
			lyrics: (track.lyrics || []).slice(),
			index: 0,
		}));
		this.playing = false;
		this.currentSong = -1;
		this.currentTime = 0;
		this.lastUpdate = 0;
		this.updateInterval = null;
		this.lastSentTime = -1000;
	}

	sendLyric(text) {
		if (!text || !keysActive) return;
		const msg = String(text).trim().slice(0, 30);
		if (msg) packet("6", msg);
	}

	playSong(id) {
		if (id < 0 || id >= this.songs.length) return;

		if (this.playing && this.currentSong === id) return;

		if (this.playing) {
			this.stopLyrics();
		}

		this.currentSong = id;
		this.currentTime = 0;
		this.songs[id].index = 0;
		this.lastSentTime = -1000;
		this.playing = true;
		this.lastUpdate = Date.now();

		if (this.updateInterval) clearInterval(this.updateInterval);

		this.updateInterval = setInterval(() => {
			if (!this.playing) return;

			// Check if audio is paused
			if (currentAudio) {
				if (currentAudio._type === "youtube") {
					if (
						ytPlayer &&
						ytPlayer.getPlayerState &&
						ytPlayer.getPlayerState() !== 1
					)
						return;
				} else if (currentAudio.paused) {
					return;
				}
			}

			const now = Date.now();
			const delta = now - this.lastUpdate;
			this.lastUpdate = now;
			this.currentTime += delta;

			if (!autoChatLyrics) return;

			const song = this.songs[this.currentSong];
			if (!song || !song.lyrics) return;

			const lyric = song.lyrics[song.index];
			if (lyric) {
				const time = lyric[0];
				const text = lyric[1];

				if (
					this.currentTime >= time - 150 &&
					this.currentTime - this.lastSentTime > 500
				) {
					this.sendLyric(text);
					this.lastSentTime = this.currentTime;
					song.index++;

					if (musicLyricEl) {
						const lyricText = musicLyricEl.querySelector("#musicLyricText");
						if (lyricText) {
							lyricText.textContent = text;
						} else {
							musicLyricEl.textContent = text;
						}
						musicLyricEl.style.animation = "none";
						musicLyricEl.offsetHeight;
						musicLyricEl.style.animation = "lyricPulse 0.3s ease-out";
					}
					if (typeof window.updateActiveLyricInList === "function") {
						window.updateActiveLyricInList(this.currentTime);
					}
				}
			} else if (song.index >= song.lyrics.length) {
				// No more lyrics, but keep playing
			}
		}, 50);
	}

	stopLyrics() {
		this.playing = false;
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
		this.currentTime = 0;
		this.lastSentTime = -1000;
		if (this.currentSong >= 0 && this.songs[this.currentSong]) {
			this.songs[this.currentSong].index = 0;
		}
	}

	syncTime(audioTime) {
		this.currentTime = audioTime * 1000;
		this.lastUpdate = Date.now();

		if (this.currentSong >= 0 && this.songs[this.currentSong]) {
			const song = this.songs[this.currentSong];
			song.index = 0;
			while (
				song.index < song.lyrics.length &&
				song.lyrics[song.index][0] <= this.currentTime
			) {
				song.index++;
			}
		}
	}

	reset() {
		this.stopLyrics();
		this.currentSong = -1;
		if (musicLyricEl) {
			const lyricText = musicLyricEl.querySelector("#musicLyricText");
			if (lyricText) {
				lyricText.textContent = "♪ No lyrics";
			} else {
				musicLyricEl.textContent = "♪ No lyrics";
			}
		}
	}
}

const songPlayer = new SongPlayer();

function isYouTubeUrl(url) {
	return /youtube\.com\/watch\?v=|youtu\.be\//i.test(String(url || ""));
}

function getYouTubeId(url) {
	try {
		const u = new URL(String(url));
		if (u.hostname.includes("youtu.be")) {
			return u.pathname.replace("/", "").trim() || null;
		}
		if (u.searchParams.has("v")) return u.searchParams.get("v");
	} catch (_) { }
	const m = String(url || "").match(/(?:v=|\/)([a-zA-Z0-9_-]{6,})/);
	return m ? m[1] : null;
}

function ensureYouTubeApi(cb) {
	if (ytApiReady) return cb();
	if (ytApiLoading) {
		ytApiCallbacks.push(cb);
		return;
	}
	ytApiLoading = true;
	ytApiCallbacks.push(cb);
	const prev = window.onYouTubeIframeAPIReady;
	window.onYouTubeIframeAPIReady = () => {
		ytApiReady = true;
		ytApiLoading = false;
		if (typeof prev === "function") prev();
		const cbs = ytApiCallbacks.slice();
		ytApiCallbacks = [];
		cbs.forEach((fn) => {
			try {
				fn();
			} catch (e) {
				console.error("YT API callback error:", e);
			}
		});
	};
	const s = document.createElement("script");
	s.src = "https://www.youtube.com/iframe_api";
	s.onerror = () => {
		ytApiLoading = false;
		setMusicStatus("Failed to load YouTube API");
		ytApiCallbacks = [];
	};
	document.head.appendChild(s);
	setTimeout(() => {
		if (!ytApiReady && ytApiLoading) {
			ytApiLoading = false;
			setMusicStatus("YouTube API timeout");
			ytApiCallbacks = [];
		}
	}, 10000);
}

function ensureYouTubePlayer(videoId, onReady) {
	const holderId = "musicYoutubeHolder";
	let holder = document.getElementById(holderId);
	if (!holder) {
		holder = document.createElement("div");
		holder.id = holderId;
		holder.style.position = "fixed";
		holder.style.left = "-9999px";
		holder.style.top = "-9999px";
		holder.style.width = "200px";
		holder.style.height = "200px";
		holder.style.opacity = "0";
		holder.style.pointerEvents = "none";
		document.body.appendChild(holder);
	}
	if (!ytAudio) {
		ytAudio = {
			_type: "youtube",
			pause() {
				if (ytPlayer) ytPlayer.pauseVideo();
			},
			play() {
				if (ytPlayer) ytPlayer.playVideo();
			},
			load() { },
			get currentTime() {
				return ytPlayer ? ytPlayer.getCurrentTime() : 0;
			},
			set currentTime(v) {
				if (ytPlayer) ytPlayer.seekTo(Math.max(0, v || 0), true);
			},
			get duration() {
				return ytPlayer ? ytPlayer.getDuration() : 0;
			},
			get paused() {
				if (!ytPlayer || !window.YT || !window.YT.PlayerState) return true;
				return ytPlayer.getPlayerState() !== window.YT.PlayerState.PLAYING;
			},
		};
	}
	if (ytPlayer) {
		try {
			ytPlayer.loadVideoById(videoId);
		} catch (e) {
			console.error("YT loadVideoById error:", e);
			setMusicStatus("Failed to load video");
			return;
		}
		if (typeof onReady === "function") onReady();
		return;
	}
	ytPlayer = new YT.Player(holderId, {
		height: "200",
		width: "200",
		videoId,
		playerVars: {
			autoplay: 1,
			controls: 0,
			disablekb: 1,
			fs: 0,
			iv_load_policy: 3,
			modestbranding: 1,
			rel: 0,
			playsinline: 1,
			origin: window.location.origin,
		},
		events: {
			onReady: () => {
				if (typeof onReady === "function") onReady();
			},
			onStateChange: (ev) => {
				if (currentAudio !== ytAudio) return;
				if (ev.data === YT.PlayerState.PLAYING) {
					setMusicStatus("");
					startLyrics(currentTrackIndex);
					syncLyrics();
				} else if (ev.data === YT.PlayerState.ENDED) {
					stopMusic();
				} else if (ev.data === YT.PlayerState.BUFFERING) {
					setMusicStatus("Buffering...");
				} else if (ev.data === YT.PlayerState.UNSTARTED) {
					setTimeout(() => {
						if (
							ytPlayer &&
							ytPlayer.getPlayerState &&
							ytPlayer.getPlayerState() === -1
						) {
							setMusicStatus("Video unavailable");
						}
					}, 3000);
				}
			},
			onError: (ev) => {
				const errCodes = {
					2: "Invalid video ID",
					5: "HTML5 player error",
					100: "Video not found",
					101: "Embedding disabled",
					150: "Embedding disabled",
				};
				const msg = errCodes[ev.data] || `YouTube error ${ev.data}`;
				console.error("YouTube player error:", ev.data, msg);
				setMusicStatus(msg);
			},
		},
	});
}

function startYtTicker() {
	if (ytTick) clearInterval(ytTick);
	ytTick = setInterval(() => {
		if (currentAudio !== ytAudio) return;
		if (!musicTimeEl) return;
		const sec = ytAudio.currentTime || 0;
		const mm = String(Math.floor(sec / 60)).padStart(2, "0");
		const ss = String(Math.floor(sec % 60)).padStart(2, "0");
		musicTimeEl.textContent = `${mm}:${ss}`;
		if (musicSeekEl && !musicScrub) musicSeekEl.value = String(sec);
		if (musicDurEl) {
			const dur = ytAudio.duration || 0;
			const dmm = String(Math.floor(dur / 60)).padStart(2, "0");
			const dss = String(Math.floor(dur % 60)).padStart(2, "0");
			musicDurEl.textContent = `${dmm}:${dss}`;
		}
		if (musicSeekEl) {
			const max = Math.max(0, ytAudio.duration || 0);
			if (musicSeekEl.max !== String(max)) musicSeekEl.max = String(max);
		}
	}, 250);
}

function stopYtTicker() {
	if (ytTick) clearInterval(ytTick);
	ytTick = 0;
}

function getStore(key) {
	try {
		return localStorage.getItem(key);
	} catch (_) {
		return null;
	}
}

function setStore(key, value) {
	try {
		localStorage.setItem(key, value);
	} catch (_) { }
}

function getTrackLabel(track, index) {
	if (track && track.name && String(track.name).trim()) return track.name;
	const url = track && track.url ? String(track.url) : "";
	if (url) {
		let base = url.split("/").pop() || "";
		base = base.split("?")[0];
		base = base.replace(/\.[a-z0-9]+$/i, "");
		base = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
		if (base) return base;
	}
	return `Track ${index + 1}`;
}

function setMusicStatus(text) {
	if (musicStatusEl) musicStatusEl.textContent = text || "";
}

function parseLrc(text) {
	if (!text) return [];
	const lines = String(text).split(/\r?\n/);
	const out = [];
	for (const line of lines) {
		const matches = line.match(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g);
		if (!matches) continue;
		const lyric = line.replace(/\[[^\]]+\]/g, "").trim();
		if (!lyric) continue;
		const lower = lyric.toLowerCase();
		if (lower.startsWith("ti:")) continue;
		if (lower.startsWith("ar:")) continue;
		if (lower.startsWith("al:")) continue;
		if (lower.startsWith("by:")) continue;
		if (lower.startsWith("offset:")) continue;
		if (lower.includes(" - ") && matches.length === 1) continue;
		if (lower.includes("official") || lower.includes("lyrics")) continue;
		for (const tag of matches) {
			const m = tag.match(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/);
			if (!m) continue;
			const mm = parseInt(m[1], 10) || 0;
			const ss = parseInt(m[2], 10) || 0;
			const msRaw = m[3] ? m[3] : "0";
			const ms =
				msRaw.length === 3
					? parseInt(msRaw, 10)
					: parseInt(msRaw.padEnd(3, "0"), 10);
			const delay = mm * 60000 + ss * 1000 + ms;
			if (lyric) out.push({ chat: lyric, delay });
		}
	}
	out.sort((a, b) => a.delay - b.delay);
	return out;
}

function stopMusic() {
	songPlayer.reset();
	setMusicStatus("");
	if (musicTimeEl) musicTimeEl.textContent = "00:00";
	if (musicSeekEl) musicSeekEl.value = "0";
	if (musicNowPlayingEl) musicNowPlayingEl.textContent = "";
	if (musicLyricEl) {
		const lyricText = musicLyricEl.querySelector("#musicLyricText");
		if (lyricText) {
			lyricText.textContent = "♪ No lyrics";
		} else {
			musicLyricEl.textContent = "♪ No lyrics";
		}
	}
	stopYtTicker();
	currentTrackIndex = -1;
	if (currentAudio) {
		if (currentAudio._type === "youtube") {
			if (ytPlayer) {
				ytPlayer.stopVideo();
			}
		} else {
			currentAudio.pause();
			currentAudio.currentTime = 0;
		}
		currentAudio = null;
	}
}

function startLyrics(index) {
	songPlayer.playSong(index);
}

function syncLyrics() {
	if (currentAudio && !currentAudio.paused) {
		songPlayer.syncTime(currentAudio.currentTime);
	}
}

function playMusic(index) {
	stopMusic();
	currentTrackIndex = index;
	if (typeof window.updateMusicDropdown === "function") {
		window.updateMusicDropdown(index);
	}
	let audio = audios[index];
	const track = musicTracks[index];
	if (!track || !track.url) {
		setMusicStatus("Missing track URL");
		return;
	}
	if (isYouTubeUrl(track.url)) {
		const videoId = getYouTubeId(track.url);
		if (!videoId) {
			setMusicStatus("Invalid YouTube URL");
			return;
		}
		setMusicStatus("Loading...");
		ensureYouTubeApi(() => {
			ensureYouTubePlayer(videoId, () => {
				currentAudio = ytAudio;
				startYtTicker();
				if (ytPlayer) ytPlayer.playVideo();
			});
		});
		return;
	}
	if (!audio) {
		audio = new Audio(track.url);
		audio.loop = false;
		audio.preload = "auto";
		audios[index] = audio;
	}
	currentAudio = audio;
	setMusicStatus("Loading...");
	audio.load();
	audio.volume = 0.6;
	audio.muted = false;
	audio.onwaiting = () => {
		if (currentAudio === audio) setMusicStatus("Buffering...");
	};
	audio.onstalled = () => {
		if (currentAudio === audio) setMusicStatus("Buffering...");
	};
	audio.onplaying = () => {
		if (currentAudio === audio) {
			setMusicStatus("");
			if (typeof window.updatePlayButton === "function")
				window.updatePlayButton();
		}
	};
	audio.onplay = () => {
		if (currentAudio === audio) {
			startLyrics(index);
			syncLyrics();
			if (typeof window.updatePlayButton === "function")
				window.updatePlayButton();
		}
	};
	audio.onpause = () => {
		if (currentAudio === audio) {
			if (typeof window.updatePlayButton === "function")
				window.updatePlayButton();
		}
	};
	audio.onseeked = () => {
		if (currentAudio === audio) syncLyrics();
	};
	audio.onloadedmetadata = () => {
		if (currentAudio !== audio) return;
		if (musicSeekEl) musicSeekEl.max = String(Math.max(0, audio.duration || 0));
		if (musicDurEl) {
			const sec = audio.duration || 0;
			const mm = String(Math.floor(sec / 60)).padStart(2, "0");
			const ss = String(Math.floor(sec % 60)).padStart(2, "0");
			musicDurEl.textContent = `${mm}:${ss}`;
		}
	};
	audio.oncanplay = () => {
		if (currentAudio === audio) setMusicStatus("");
	};
	audio.ontimeupdate = () => {
		if (currentAudio !== audio) return;
		if (!musicTimeEl) return;
		const sec = audio.currentTime || 0;
		const mm = String(Math.floor(sec / 60)).padStart(2, "0");
		const ss = String(Math.floor(sec % 60)).padStart(2, "0");
		musicTimeEl.textContent = `${mm}:${ss}`;
		if (musicSeekEl && !musicScrub) musicSeekEl.value = String(sec);
	};
	audio.onerror = () => {
		if (currentAudio === audio) setMusicStatus("Failed to load audio");
	};
	audio.play().catch(() => {
		if (currentAudio === audio) setMusicStatus("Playback blocked");
	});
}

function buildMusicMenu() {
	let menu = document.getElementById("musicMenu");
	if (menu) return menu;

	const style = document.createElement("style");
	style.textContent = `
    @keyframes lyricPulse {
      0% { transform: scale(1.05); opacity: 1; }
      100% { transform: scale(1); opacity: 0.9; }
    }
    @keyframes musicMenuIn {
      0% { opacity: 0; transform: translateY(-10px) scale(0.95); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes musicMenuOut {
      0% { opacity: 1; transform: translateY(0) scale(1); }
      100% { opacity: 0; transform: translateY(-10px) scale(0.95); }
    }
    #musicMenu {
      background: linear-gradient(135deg, rgba(30, 25, 40, 0.95) 0%, rgba(20, 15, 30, 0.98) 100%);
      border: 1px solid rgba(160, 100, 255, 0.3);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(160, 100, 255, 0.1);
      backdrop-filter: blur(10px);
    }
    #musicMenu.show { animation: musicMenuIn 0.25s ease-out forwards; }
    #musicMenu.hide { animation: musicMenuOut 0.2s ease-in forwards; }
    #musicMenuHeader {
      background: linear-gradient(90deg, rgba(160, 100, 255, 0.2) 0%, transparent 100%);
      padding: 10px 12px;
      margin: -12px -12px 12px -12px;
      border-radius: 12px 12px 0 0;
      border-bottom: 1px solid rgba(160, 100, 255, 0.2);
      cursor: move;
      font-weight: bold;
      color: #a6f;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #musicMenuHeader::before {
      content: "♪";
      font-size: 18px;
    }
    #musicNowPlaying {
      color: #b8f;
      font-size: 11px;
      margin-top: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 0.8;
    }
    #musicLyric {
      color: #fff;
      font-size: 13px;
      min-height: 20px;
      padding: 8px 12px;
      margin: 8px 0;
      background: rgba(160, 100, 255, 0.1);
      border-radius: 6px;
      text-align: center;
      font-style: italic;
      cursor: pointer;
      transition: background 0.35s ease;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    #musicLyric:hover {
      background: rgba(160, 100, 255, 0.2);
    }
    #musicLyricText {
      flex: 1;
      text-align: center;
    }
    #musicLyricExpand {
      font-size: 10px;
      color: #a6f;
      transition: transform 0.2s;
      flex-shrink: 0;
    }
    #musicLyric.expanded #musicLyricExpand {
      transform: rotate(180deg);
    }
    #musicLyricsPanel {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease-out;
      margin: 0 -4px;
    }
    #musicLyricsPanel.expanded {
      max-height: 200px;
    }
    #musicLyricsList {
      max-height: 200px;
      overflow-y: auto;
      background: rgba(20, 20, 30, 0.6);
      border-radius: 6px;
      padding: 4px;
      margin-bottom: 8px;
    }
    #musicLyricsList::-webkit-scrollbar {
      width: 6px;
    }
    #musicLyricsList::-webkit-scrollbar-track {
      background: rgba(160, 100, 255, 0.1);
      border-radius: 3px;
    }
    #musicLyricsList::-webkit-scrollbar-thumb {
      background: rgba(160, 100, 255, 0.3);
      border-radius: 3px;
    }
    #musicLyricsList::-webkit-scrollbar-thumb:hover {
      background: rgba(160, 100, 255, 0.5);
    }
    .lyricLine {
      padding: 6px 10px;
      margin: 2px 0;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      color: #888;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .lyricLine:hover {
      background: rgba(160, 100, 255, 0.2);
      color: #fff;
    }
    .lyricLine.active {
      background: rgba(160, 100, 255, 0.3);
      color: #a6f;
      font-weight: 500;
    }
    .lyricLine .lyricTime {
      font-size: 10px;
      color: #666;
      min-width: 36px;
    }
    .lyricLine.active .lyricTime {
      color: #a6f;
    }
    .customDropdown {
      position: relative;
      width: 100%;
      margin-top: 8px;
    }
    .dropdownSelected {
      background: rgba(40, 35, 60, 0.8);
      border: 1px solid rgba(160, 100, 255, 0.3);
      border-radius: 6px;
      color: #fff;
      padding: 10px 12px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      justify-content: space-between;
      align-items: center;
      user-select: none;
    }
    .dropdownSelected:hover {
      border-color: rgba(160, 100, 255, 0.5);
      background: rgba(50, 45, 70, 0.8);
    }
    .dropdownSelected.open {
      border-color: rgba(160, 100, 255, 0.7);
      border-radius: 6px 6px 0 0;
    }
    .dropdownArrow {
      transition: transform 0.2s;
      font-size: 10px;
      color: #a6f;
    }
    .dropdownSelected.open .dropdownArrow {
      transform: rotate(180deg);
    }
    .dropdownOptions {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: rgba(30, 25, 45, 0.98);
      border: 1px solid rgba(160, 100, 255, 0.5);
      border-top: none;
      border-radius: 0 0 6px 6px;
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.25s ease-out;
      z-index: 100;
    }
    .dropdownOptions.open {
      max-height: 240px;
      overflow-y: auto;
    }
    .dropdownOptions::-webkit-scrollbar {
      width: 6px;
    }
    .dropdownOptions::-webkit-scrollbar-track {
      background: rgba(160, 100, 255, 0.1);
    }
    .dropdownOptions::-webkit-scrollbar-thumb {
      background: rgba(160, 100, 255, 0.3);
      border-radius: 3px;
    }
    .dropdownOption {
      padding: 10px 12px;
      cursor: pointer;
      transition: all 0.15s;
      color: #aaa;
      font-size: 13px;
      border-bottom: 1px solid rgba(160, 100, 255, 0.1);
    }
    .dropdownOption:last-child {
      border-bottom: none;
    }
    .dropdownOption:hover {
      background: rgba(160, 100, 255, 0.2);
      color: #fff;
    }
    .dropdownOption.selected {
      background: rgba(160, 100, 255, 0.15);
      color: #a6f;
    }
    .musicBtn {
      background: linear-gradient(135deg, rgba(160, 100, 255, 0.3) 0%, rgba(130, 80, 200, 0.3) 100%);
      border: 1px solid rgba(160, 100, 255, 0.4);
      border-radius: 6px;
      color: #fff;
      padding: 8px 16px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
      font-weight: 500;
    }
    .musicBtn:hover {
      background: linear-gradient(135deg, rgba(160, 100, 255, 0.5) 0%, rgba(130, 80, 200, 0.5) 100%);
      border-color: rgba(160, 100, 255, 0.6);
      transform: translateY(-1px);
    }
    .musicBtn:active {
      transform: translateY(0);
    }
    .musicBtn.stop {
      background: linear-gradient(135deg, rgba(255, 100, 100, 0.3) 0%, rgba(200, 80, 80, 0.3) 100%);
      border-color: rgba(255, 100, 100, 0.4);
    }
    .musicBtn.stop:hover {
      background: linear-gradient(135deg, rgba(255, 100, 100, 0.5) 0%, rgba(200, 80, 80, 0.5) 100%);
      border-color: rgba(255, 100, 100, 0.6);
    }
    #musicSeek {
      -webkit-appearance: none;
      appearance: none;
      height: 6px;
      background: rgba(160, 100, 255, 0.2);
      border-radius: 3px;
      cursor: pointer;
    }
    #musicSeek::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      background: linear-gradient(135deg, #b8f 0%, #a6f 100%);
      border-radius: 50%;
      cursor: pointer;
      transition: transform 0.1s;
    }
    #musicSeek::-webkit-slider-thumb:hover {
      transform: scale(1.2);
    }
    #musicStatus {
      color: #fa8;
      font-size: 11px;
      min-height: 16px;
    }
    .musicCheckLabel {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #aaa;
      font-size: 12px;
      cursor: pointer;
      padding: 6px 0;
      transition: color 0.2s;
    }
    .musicCheckLabel:hover { color: #fff; }
    .musicCheckLabel input {
      accent-color: #a6f;
    }
  `;
	document.head.appendChild(style);

	menu = document.createElement("div");
	menu.id = "musicMenu";
	menu.style.position = "fixed";
	menu.style.left = "20px";
	menu.style.top = "90px";
	menu.style.zIndex = "10002";
	menu.style.display = "none";
	menu.style.width = "340px";
	menu.style.padding = "12px";
	menu.style.cursor = "default";

	menu.innerHTML = `
    <div id="musicMenuHeader">Music Player</div>
    <div id="musicNowPlaying"></div>
    <div class="customDropdown">
      <div class="dropdownSelected" id="musicDropdownBtn">
        <span id="musicDropdownText">Select a track...</span>
        <span class="dropdownArrow">▼</span>
      </div>
      <div class="dropdownOptions" id="musicDropdownOptions"></div>
    </div>
    <div id="musicLyric" title="Click to expand lyrics">
      <span id="musicLyricText">♪ No lyrics</span>
      <span id="musicLyricExpand">▼</span>
    </div>
    <div id="musicLyricsPanel">
      <div id="musicLyricsList"></div>
    </div>
    <div style="display:flex; gap:8px; margin-top:8px;">
      <div id="musicPlay" class="musicBtn" style="flex:1;">▶ Play</div>
      <div id="musicStop" class="musicBtn stop" style="flex:1;">■ Stop</div>
    </div>
    <div id="musicStatus" style="margin-top:8px;"></div>
    <div style="display:flex; align-items:center; gap:10px; margin-top:8px;">
      <span id="musicTime" style="color:#a6f; font-size:12px; min-width:40px;">00:00</span>
      <input id="musicSeek" type="range" min="0" max="0" step="0.01" value="0" style="flex:1;">
      <span id="musicDur" style="color:#888; font-size:12px; min-width:40px;">00:00</span>
    </div>
    <label class="musicCheckLabel" style="margin-top:10px;">
      <input id="musicAutoChat" type="checkbox" checked />
      <span>Auto-chat lyrics</span>
    </label>
    <div style="color:#666; font-size:10px; margin-top:4px;">Press U to toggle menu</div>
  `;

	document.body.appendChild(menu);

	const savedPos = getStore("musicMenuPos");
	if (savedPos) {
		try {
			const pos = JSON.parse(savedPos);
			if (typeof pos.x === "number" && typeof pos.y === "number") {
				menu.style.left = `${pos.x}px`;
				menu.style.top = `${pos.y}px`;
			}
		} catch (_) { }
	}

	musicNowPlayingEl = menu.querySelector("#musicNowPlaying");
	musicLyricEl = menu.querySelector("#musicLyric");

	const header = menu.querySelector("#musicMenuHeader");
	header.addEventListener("mousedown", (e) => {
		musicDrag.active = true;
		const rect = menu.getBoundingClientRect();
		musicDrag.dx = e.clientX - rect.left;
		musicDrag.dy = e.clientY - rect.top;
	});
	document.addEventListener("mousemove", (e) => {
		if (!musicDrag.active) return;
		const x = Math.max(
			10,
			Math.min(window.innerWidth - 20, e.clientX - musicDrag.dx),
		);
		const y = Math.max(
			10,
			Math.min(window.innerHeight - 20, e.clientY - musicDrag.dy),
		);
		menu.style.left = `${x}px`;
		menu.style.top = `${y}px`;
	});
	document.addEventListener("mouseup", () => {
		if (!musicDrag.active) return;
		musicDrag.active = false;
		setStore(
			"musicMenuPos",
			JSON.stringify({
				x: parseInt(menu.style.left, 10) || 20,
				y: parseInt(menu.style.top, 10) || 90,
			}),
		);
	});

	const dropdownBtn = menu.querySelector("#musicDropdownBtn");
	const dropdownText = menu.querySelector("#musicDropdownText");
	const dropdownOptions = menu.querySelector("#musicDropdownOptions");
	const lyricsPanel = menu.querySelector("#musicLyricsPanel");
	const lyricsList = menu.querySelector("#musicLyricsList");
	let dropdownOpen = false;
	let selectedTrackIndex = 0;

	// Build dropdown options
	// Sort tracks alphabetically while preserving original indices
	const sortedTracks = musicTracks
		.map((track, i) => ({ track, originalIndex: i }))
		.sort((a, b) => a.track.name.localeCompare(b.track.name));

	sortedTracks.forEach(({ track, originalIndex }) => {
		const opt = document.createElement("div");
		opt.className = "dropdownOption";
		opt.textContent = track.name;
		opt.dataset.index = originalIndex;
		opt.addEventListener("click", () => {
			selectedTrackIndex = originalIndex;
			dropdownText.textContent = track.name;
			document
				.querySelectorAll(".dropdownOption")
				.forEach((o) => o.classList.remove("selected"));
			opt.classList.add("selected");
			closeDropdown();
			playMusic(originalIndex);
			const playBtn = document.querySelector("#musicPlay");
			if (playBtn) playBtn.textContent = "⏸ Pause";
		});
		dropdownOptions.appendChild(opt);
	});

	function closeDropdown() {
		dropdownOpen = false;
		dropdownBtn.classList.remove("open");
		dropdownOptions.classList.remove("open");
	}

	dropdownBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		dropdownOpen = !dropdownOpen;
		dropdownBtn.classList.toggle("open", dropdownOpen);
		dropdownOptions.classList.toggle("open", dropdownOpen);
	});

	document.addEventListener("click", (e) => {
		if (!dropdownOptions.contains(e.target) && e.target !== dropdownBtn) {
			closeDropdown();
		}
	});

	// Lyrics panel expand/collapse
	musicLyricEl.addEventListener("click", () => {
		lyricsPanel.classList.toggle("expanded");
		musicLyricEl.classList.toggle("expanded");
	});

	function updateLyricsList(trackIndex) {
		lyricsList.innerHTML = "";
		const track = musicTracks[trackIndex];
		if (!track || !track.lyrics || !track.lyrics.length) {
			lyricsList.innerHTML =
				'<div style="padding:12px;color:#666;text-align:center;font-size:12px;">No lyrics available</div>';
			return;
		}
		track.lyrics.forEach((line, i) => {
			const div = document.createElement("div");
			div.className = "lyricLine";
			div.dataset.index = i;
			div.dataset.time = line[0];
			const timeMs = line[0];
			const timeSec = Math.floor(timeMs / 1000);
			const mins = Math.floor(timeSec / 60);
			const secs = timeSec % 60;
			div.innerHTML = `<span class="lyricTime">${mins}:${secs.toString().padStart(2, "0")}</span><span>${line[1]}</span>`;
			div.addEventListener("click", () => {
				const seekTime = timeMs / 1000 - 0.5;
				if (currentAudio && typeof currentAudio.currentTime !== "undefined") {
					currentAudio.currentTime = seekTime;
				} else if (ytPlayer && typeof ytPlayer.seekTo === "function") {
					ytPlayer.seekTo(seekTime, true);
				}
			});
			lyricsList.appendChild(div);
		});
	}

	window.updateActiveLyricInList = function (timeMs) {
		const lines = lyricsList.querySelectorAll(".lyricLine");
		let activeIndex = -1;
		const track = musicTracks[currentTrackIndex];
		if (!track || !track.lyrics) return;
		for (let i = track.lyrics.length - 1; i >= 0; i--) {
			if (timeMs >= track.lyrics[i][0]) {
				activeIndex = i;
				break;
			}
		}
		lines.forEach((line, i) => {
			line.classList.toggle("active", i === activeIndex);
		});
		if (activeIndex >= 0 && lyricsPanel.classList.contains("expanded")) {
			const activeLine = lines[activeIndex];
			if (activeLine) {
				activeLine.scrollIntoView({ behavior: "smooth", block: "center" });
			}
		}
	};

	// Update dropdown text when track changes
	window.updateMusicDropdown = function (index) {
		if (musicTracks[index]) {
			dropdownText.textContent = musicTracks[index].name;
			selectedTrackIndex = index;
			document.querySelectorAll(".dropdownOption").forEach((o, i) => {
				o.classList.toggle("selected", i === index);
			});
			updateLyricsList(index);
		}
	};

	musicStatusEl = menu.querySelector("#musicStatus");
	musicTimeEl = menu.querySelector("#musicTime");
	musicDurEl = menu.querySelector("#musicDur");
	musicSeekEl = menu.querySelector("#musicSeek");

	if (musicTimeEl) musicTimeEl.textContent = "00:00";
	if (musicDurEl) musicDurEl.textContent = "00:00";
	if (musicSeekEl) {
		musicSeekEl.max = "0";
		musicSeekEl.value = "0";
		const onScrubStart = () => {
			musicScrub = true;
		};
		const onScrubEnd = () => {
			musicScrub = false;
		};
		musicSeekEl.addEventListener("pointerdown", onScrubStart);
		musicSeekEl.addEventListener("pointerup", onScrubEnd);
		musicSeekEl.addEventListener("pointercancel", onScrubEnd);
		musicSeekEl.addEventListener("input", () => {
			if (!currentAudio) return;
			const v = parseFloat(musicSeekEl.value);
			if (!Number.isFinite(v)) return;
			currentAudio.currentTime = Math.max(0, v);
			syncLyrics();
		});
	}

	const playBtn = menu.querySelector("#musicPlay");

	function updatePlayButton() {
		if (!currentAudio) {
			playBtn.textContent = "▶ Play";
			return;
		}
		if (currentAudio._type === "youtube") {
			if (
				ytPlayer &&
				ytPlayer.getPlayerState &&
				ytPlayer.getPlayerState() === 1
			) {
				playBtn.textContent = "⏸ Pause";
			} else {
				playBtn.textContent = "▶ Play";
			}
		} else {
			if (currentAudio.paused) {
				playBtn.textContent = "▶ Play";
			} else {
				playBtn.textContent = "⏸ Pause";
			}
		}
	}

	window.updatePlayButton = updatePlayButton;

	playBtn.addEventListener("click", () => {
		if (currentAudio) {
			if (currentAudio._type === "youtube") {
				if (ytPlayer) {
					if (ytPlayer.getPlayerState && ytPlayer.getPlayerState() === 1) {
						ytPlayer.pauseVideo();
					} else {
						ytPlayer.playVideo();
					}
				}
			} else {
				if (currentAudio.paused) {
					currentAudio.play();
				} else {
					currentAudio.pause();
				}
			}
			updatePlayButton();
		} else {
			if (musicNowPlayingEl) {
				musicNowPlayingEl.textContent = `Now Playing: ${getTrackLabel(musicTracks[selectedTrackIndex], selectedTrackIndex)}`;
			}
			playMusic(selectedTrackIndex);
		}
	});
	menu.querySelector("#musicStop").addEventListener("click", () => {
		stopMusic();
		updatePlayButton();
	});
	menu.querySelector("#musicAutoChat").addEventListener("change", (e) => {
		autoChatLyrics = e.target.checked;
	});

	return menu;
}

document.addEventListener("keydown", (e) => {
	if (isChatActive()) return;
	if (e.key === "C") {
		const menu = buildMusicMenu();
		musicMenuOpen = !musicMenuOpen;
		if (musicMenuOpen) {
			menu.style.display = "block";
			menu.classList.remove("hide");
			menu.classList.add("show");
		} else {
			menu.classList.remove("show");
			menu.classList.add("hide");
			setTimeout(() => {
				if (!musicMenuOpen) menu.style.display = "none";
			}, 200);
		}
	}
});

// RECORDING ENGINE
(() => {
	// REC overlay indicator
	const recOverlay = document.createElement("div");
	recOverlay.id = "rec-overlay";
	recOverlay.innerHTML = `<div id="rec-overlay-dot"></div><span id="rec-overlay-text">REC</span><span id="rec-overlay-time">00:00</span>`;
	document.body.appendChild(recOverlay);

	function recUpdateOverlayTime() {
		const el = document.getElementById("rec-overlay-time");
		if (el && recIsRecording) {
			el.textContent = recFormatTime(Date.now() - recStartTime);
		}
	}

	function recUpdateTabUI() {
		const statusEl = document.getElementById("rec-status-text");
		const startBtn = document.getElementById("rec-start-btn");
		if (statusEl) {
			if (recIsRecording) {
				statusEl.textContent = "Recording... " + recFormatTime(Date.now() - recStartTime);
				statusEl.className = "rec-status active";
			} else {
				statusEl.textContent = "Press U to start recording";
				statusEl.className = "rec-status";
			}
		}
		if (startBtn) {
			if (recIsRecording) {
				startBtn.textContent = "Recording...";
				startBtn.classList.add("recording");
			} else {
				startBtn.textContent = "Record";
				startBtn.classList.remove("recording");
			}
		}
	}

	function recRenderList() {
		const container = document.getElementById("rec-list-container");
		if (!container) return;
		if (recRecordings.length === 0) {
			container.innerHTML = `<div class="rec-empty">No recordings yet — press U to start</div>`;
			return;
		}
		container.innerHTML = recRecordings.map((r, i) => `
			<div class="rec-item">
				<div class="rec-item-info">
					<div class="rec-item-name">Replay_${i + 1}.webm</div>
					<div class="rec-item-meta">${r.size} MB &middot; ${r.duration} &middot; ${r.mode === 'game' ? 'Canvas' : 'Screen'}</div>
				</div>
				<div class="rec-item-actions">
					<button class="rec-item-btn preview" onclick="window.recPreview(${i})">Play</button>
					<button class="rec-item-btn save" onclick="window.recSave(${i})">Save</button>
					<button class="rec-item-btn del" onclick="window.recDelete(${i})">✕</button>
				</div>
			</div>
		`).join("");
	}

	window.recSetMode = (v) => recSaveSetting("mode", v);
	window.recSetFps = (v) => recSaveSetting("fps", parseInt(v));
	window.recSetBitrate = (v) => recSaveSetting("quality", parseInt(v));
	window.recSetAutoSave = (v) => recSaveSetting("autoSave", v);
	window.recSetVol = (v) => {
		recSaveSetting("volume", parseFloat(v));
		const display = document.getElementById("rec-vol-display");
		if (display) display.textContent = Math.round(v * 100) + "%";
		const slider = document.querySelector(".rec-slider");
		if (slider) {
			const pct = v * 100;
			slider.style.background = `linear-gradient(to right, #6366f1 ${pct}%, #333 ${pct}%)`;
		}
	};

	async function recStartRecording() {
		if (recIsRecording) return;
		let stream;
		let usedFallback = false;
		if (recSettings.mode === "game") {
			const canvas = document.getElementById("gameCanvas");
			if (!canvas) return;
			// Test if canvas is origin-clean
			let canvasClean = false;
			try { canvas.toDataURL(); canvasClean = true; } catch (e) { canvasClean = false; }

			if (canvasClean) {
				stream = canvas.captureStream(recSettings.fps);
			} else {
				// Canvas tainted by cross-origin textures — use screen capture with preferCurrentTab
				console.warn("[Rec] Canvas tainted, using screen capture (preferCurrentTab)");
				try {
					stream = await navigator.mediaDevices.getDisplayMedia({
						video: { frameRate: recSettings.fps },
						audio: true,
						preferCurrentTab: true,
					});
					usedFallback = true;
				} catch (e) {
					return;
				}
			}
		} else {
			try {
				stream = await navigator.mediaDevices.getDisplayMedia({
					video: { frameRate: recSettings.fps },
					audio: true,
				});
			} catch (e) {
				return;
			}
		}

		const mimeType = recGetMimeType();
		if (!mimeType) {
			console.warn("[Rec] No supported video MIME type found");
			return;
		}

		recChunks = [];
		recMediaRecorder = new MediaRecorder(stream, {
			mimeType,
			videoBitsPerSecond: recSettings.quality,
		});

		recMediaRecorder.ondataavailable = (e) => {
			e.data.size > 0 && recChunks.push(e.data);
		};

		recMediaRecorder.onstop = () => {
			const blob = new Blob(recChunks, { type: "video/webm" });
			const elapsed = Date.now() - (recMediaRecorder._recStart || recStartTime || Date.now());
			const duration = recFormatTime(Math.max(0, elapsed));
			recRecordings.push({
				url: URL.createObjectURL(blob),
				blob,
				size: (blob.size / 1024 / 1024).toFixed(1),
				mode: recSettings.mode,
				duration,
				timestamp: Date.now(),
			});

			recIsRecording = false;
			clearInterval(recTimerInterval);
			recTimerInterval = null;
			recOverlay.classList.remove("active");
			recUpdateTabUI();
			recRenderList();

			if (recSettings.autoSave) {
				window.recSave(recRecordings.length - 1);
			}

			// Stop all tracks if screen capture or fallback
			if (recSettings.mode === "full" || usedFallback) {
				stream.getTracks().forEach((t) => t.stop());
			}
		};

		const localStartTime = Date.now();
		recStartTime = localStartTime;
		recMediaRecorder._recStart = localStartTime;
		recMediaRecorder.start();
		recIsRecording = true;

		// Show overlay
		recOverlay.classList.add("active");

		// Timer updates
		recTimerInterval = setInterval(() => {
			recUpdateOverlayTime();
			recUpdateTabUI();
		}, 500);

		recUpdateTabUI();
	}

	function recStopRecording() {
		if (!recIsRecording || !recMediaRecorder) return;
		recMediaRecorder.stop();
	}

	window.recToggle = () => {
		if (recIsRecording) recStopRecording();
		else recStartRecording();
	};
	window.recStop = () => recStopRecording();

	window.recSave = (i) => {
		if (!recRecordings[i]) return;
		const a = document.createElement("a");
		a.href = recRecordings[i].url;
		a.download = `replay-${recRecordings[i].timestamp || Date.now()}.webm`;
		a.click();
	};

	window.recDelete = (i) => {
		if (!recRecordings[i]) return;
		URL.revokeObjectURL(recRecordings[i].url);
		recRecordings.splice(i, 1);
		recRenderList();
	};

	window.recPreview = (i) => {
		if (!recRecordings[i]) return;
		// Remove existing preview modal if any
		const existing = document.querySelector(".rec-preview-modal");
		if (existing) existing.remove();

		const modal = document.createElement("div");
		modal.className = "rec-preview-modal";
		modal.innerHTML = `
			<div class="rec-preview-panel">
				<div class="rec-preview-header">
					<span class="rec-preview-title">Replay_${i + 1}.webm</span>
					<span class="rec-preview-close">&times;</span>
				</div>
				<video controls autoplay src="${recRecordings[i].url}" volume="${recSettings.volume}"></video>
			</div>
		`;
		document.body.appendChild(modal);

		const video = modal.querySelector("video");
		if (video) video.volume = recSettings.volume;

		const closeModal = () => {
			if (video) video.pause();
			modal.remove();
		};
		modal.querySelector(".rec-preview-close").addEventListener("click", closeModal);
		modal.addEventListener("click", (e) => {
			if (e.target === modal) closeModal();
		});
		document.addEventListener("keydown", function escHandler(e) {
			if (e.key === "Escape") {
				closeModal();
				document.removeEventListener("keydown", escHandler);
			}
		});
	};

	// U key to toggle recording
	document.addEventListener("keydown", (e) => {
		if (isChatActive()) return;
		if (e.key === "u" || e.key === "U") {
			if (recIsRecording) recStopRecording();
			else recStartRecording();
		}
	});
})();

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

// Team recognition function for bots
function isTeamMember(player, sid) {
	if (player && player.sid === sid) return true;
	if (!player || !player.team || sid < 0) return false;

	// Check alliance players
	for (let i = 0; i < alliancePlayers.length; i += 2) {
		if (alliancePlayers[i] === sid) return true;
	}

	// Check if same team as main player
	if (player.team && sid >= 0) {
		// Find the player with this sid to check team
		const targetPlayer = findPlayerBySID(sid);
		if (targetPlayer && targetPlayer.team === player.team) return true;
	}

	return false;
}

const botNameWords = [
	"Tenebris", "Noctifer", "Vexillum", "Malachar", "Seraphex", "Duskborn", "Voidmere",
	"Khaeros", "Zephyral", "Mordecai", "Abyssion", "Noctivex", "Pyrrhion", "Valdris",
	"Eclipsar", "Umbraex", "Solferion", "Dreadmor", "Vaelthorn", "Noxveil", "Caligon",
	"Stygian", "Morbael", "Vexathor", "Duskrael", "Nocturnis", "Abaddon", "Zephyrix",
	"Malveron", "Seravex", "Khaelion", "Voidthorn", "Pyraxis", "Umbravex", "Dreadnox",
	"Ecliptor", "Noctavis", "Valderon", "Malarix", "Seraphon", "Abyssex", "Zephyron",
	"Mordaxis", "Vexalion", "Duskmore", "Caligorn", "Stygior", "Noxveron", "Vaeltrix",
	"Solferax", "Pyrrhex", "Umbralion", "Khaevorn", "Morbivex", "Eclipvorn", "Noctisar",
	"Dreadaxis", "Valdrix", "Seravorn", "Abyssorn", "Zephyrax", "Malvaxis", "Voidrael",
];

function getRandomBotName() {
	return botNameWords[Math.floor(Math.random() * botNameWords.length)];
}

class AltSolver {
	constructor() {
		this.cores = Math.min(16, navigator.hardwareConcurrency || 8);
		this.workers = [];
		this.url = null;
	}

	init() {
		if (this.workers.length) return;
		const code = `importScripts('https://cdn.jsdelivr.net/npm/js-sha256@0.9.0/build/sha256.min.js'); let c,s; onmessage=e=>{ if(e.data.init){({challenge:c,salt:s}=e.data); postMessage(1); return;} for(let i=e.data.a;i<=e.data.b;i++) if(sha256(s+i)===c) return postMessage(i); postMessage(0); };`;
		this.url = URL.createObjectURL(new Blob([code]));
		for (let i = 0; i < this.cores; i++)
			this.workers.push(new Worker(this.url));
	}

	async getChallenge() {
		return fetch("https://api.moomoo.io/verify").then((r) => r.json());
	}

	solve({ challenge, salt, maxnumber }) {
		this.init();
		const size = Math.ceil(maxnumber / this.cores);
		let done = 0,
			solved = false,
			t0 = performance.now();

		return new Promise((res, rej) => {
			this.workers.forEach((w, i) => {
				w.onmessage = (e) => {
					if (e.data === 1)
						w.postMessage({
							a: i * size,
							b: Math.min(maxnumber, (i + 1) * size - 1),
						});
					else if (e.data && !solved) {
						solved = true;
						res({
							challenge,
							salt,
							maxnumber,
							number: e.data,
							took: ((performance.now() - t0) / 1e3).toFixed(2),
						});
						this.cleanup();
					} else if (++done === this.workers.length && !solved) {
						rej("not solved");
						this.cleanup();
					}
				};
				w.onerror = rej;
				w.postMessage({ init: 1, challenge, salt });
			});
		});
	}

	cleanup() {
		this.workers.forEach((w) => w.terminate());
		this.workers.length = 0;
		URL.revokeObjectURL(this.url);
		this.url = null;
	}

	static payload(d, s) {
		return btoa(
			JSON.stringify({
				algorithm: "SHA-256",
				challenge: d.challenge,
				salt: d.salt,
				number: s.number,
				signature: d.signature || null,
				took: s.took,
			}),
		);
	}

	async generate() {
		const d = await this.getChallenge();
		const s = await this.solve(d);
		return (this.code = `alt:${AltSolver.payload(d, s)}`);
	}
}
// Handle chat commands
function mouseCoord() {
	return Math.atan2(mouseY - screenHeight / 2, mouseX - screenWidth / 2);
}
function mouseWorldPos() {
	return {
		x: player.x + (mouseX - screenWidth / 2),
		y: player.y + (mouseY - screenHeight / 2),
	};
}
function mouseAimAngle() {
	const cx = screenWidth / 2;
	const cy = screenHeight / 2;
	return Math.atan2(mouseY - cy, mouseX - cx);
}
let mainSocket;
class WebsocketBot extends WebSocket {
	constructor(...args) {
		super(...args);
		this.binaryType = "arraybuffer";

		if (!mainSocket) {
			mainSocket = this;
			document.ws = this;
			this.isBot = false;
			this.addEventListener("message", async (e) => {
				let data;
				try {
					const buf =
						e.data instanceof Blob
							? new Uint8Array(await e.data.arrayBuffer())
							: new Uint8Array(e.data);
					const decoded = EXP.receive(this, buf);
					if (!decoded) return;
					data = [decoded.type, ...(Array.isArray(decoded.args) ? decoded.args : [decoded.args])];
				} catch {
					return;
				}
				if (!data) return;
			});
		}
	}

	send(m) {
		return super.send(m);
	}
}

try {
	window.WebSocket = WebsocketBot;
} catch (e) {
	console.warn("[Robotics] window.WebSocket is pinned; WebsocketBot not installed", e);
}
var bottics = [];
async function botConnect() {
	console.log(WS);

	// AltSolver mints "alt:<payload>" ALTCHA tokens, which the server no longer
	// accepts -- it wants a Cloudflare Turnstile token ("cf:" prefix). Those are
	// single-use, so ask the widget for a fresh one per bot. Best effort:
	// Turnstile decides whether it hands one over.
	let token = await EXP.freshToken();
	if (!token) {
		console.warn("[Robotics] no Turnstile token available; cannot connect bot");
		return;
	}

	let region = mainSocket.url.split("/")[2];
	let actualHost = region;

	if (region.includes(":")) {
		const [regionName, code] = region.split(":");
		actualHost = `sgs-${code.toLowerCase()}.${regionName}.moomoo.io`;
	} else if (region === "sandbox.moomoo.io") {
		actualHost = "sandbox.moomoo.io";
	}

	let url = `wss://${actualHost}/?token=${encodeURIComponent(token)}`;
	console.log(`Bot connecting to: ${url}`);

	let BOTSID;
	let client = new WebSocket(url);

	let nearObjects;
	//
	let altMovement = {
		movements: [
			0,
			// Right (D)
			Math.PI / 4,
			// Down-Right (S + D)
			Math.PI / 2,
			// Down (S)
			(Math.PI * 3) / 4,
			// Down-Left (S + A)
			Math.PI,
			// Left (A)  (same as -Math.PI)
			(Math.PI * -3) / 4,
			// Up-Left (W + A)
			-Math.PI / 2,
			// Up (W)
			-Math.PI / 4, // Up-Right (W + D)
		],
		aimToYaw: (num) => {
			const tol = (Math.PI * 23) / 180; // ≈ 0.401 rad
			if (Math.abs(num - 0) <= tol) {
				return 0;
			} else if (Math.abs(num - Math.PI / 4) <= tol) {
				return Math.PI / 4;
			} else if (Math.abs(num - Math.PI / 2) <= tol) {
				return Math.PI / 2;
			} else if (Math.abs(num - (Math.PI * 3) / 4) <= tol) {
				return (Math.PI * 3) / 4;
			} else if (Math.abs(Math.abs(num) - Math.PI) <= tol) {
				return Math.PI;
			} else if (Math.abs(num - (Math.PI * -3) / 4) <= tol) {
				return (Math.PI * -3) / 4;
			} else if (Math.abs(num - -Math.PI / 2) <= tol) {
				return -Math.PI / 2;
			} else if (Math.abs(num - -Math.PI / 4) <= tol) {
				return -Math.PI / 4;
			} else {
				return null;
			}
		},
	};

	client.game = {
		tick: 0,
		tickQueue: [],
		tickBase: function (set, tick) {
			if (this.tickQueue[this.tick + tick]) {
				this.tickQueue[this.tick + tick].push(set);
			} else {
				this.tickQueue[this.tick + tick] = [set];
			}
		},
		tickRate: 1000 / config.serverUpdateRate,
		tickSpeed: 0,
		lastTick: performance.now(),
	};
	// Config:
	client.lastPos = { x: 0, y: 0 };
	client.stuckTicks = 0;
	client.breaking = false;
	client.bullTick = 0;
	client.sweepDir = 1;
	client.sweepYTarget = null;
	client.healCooldown = 0;
	client.ping = 0;
	client.lastPing = -1;
	client.firstOpen = false;
	client.botCount; // the bot num
	client.inGame = false;
	client.mills = {
		active: true,
		x: null,
		y: null,
		count: 0,
	};
	client.autoBreakToggle = true;
	client.autoHealToggle = true;
	client.autoPlaceToggle = true;
	client.replacerToggle = true;
	client.autoHatToggle = true;
	client.reloaded = false;
	client.hitting = false;
	client.syncing = false;
	client.synchit = false;
	// All Players/AI:
	client.Bot = {};
	let Bot = null;
	client.players = [];
	client.ais = [];
	client.enemy = [];
	client.near = {};
	client.waitHit = 0;

	// Functions:
	client.lastMoveDir = null;
	client.lastMoveTime = 0;
	client.moveMinDelta = 0.18;
	client.moveMinInterval = 60;

	client.move = function (dir) {
		const now = performance.now();

		if (dir == null) {
			if (client.lastMoveDir != null) {
				client.lastMoveDir = null;
				client.lastMoveTime = now;
				client.sendWS("9", undefined);
			}
			return;
		}

		// first move
		if (client.lastMoveDir == null) {
			client.lastMoveDir = dir;
			client.lastMoveTime = now;
			client.sendWS("9", dir);
			return;
		}

		const delta = Math.abs(UTILS.getAngleDist(client.lastMoveDir, dir));

		if (
			delta > client.moveMinDelta ||
			now - client.lastMoveTime > client.moveMinInterval
		) {
			client.lastMoveDir = dir;
			client.lastMoveTime = now;
			client.sendWS("9", dir);
		}
	};

	client.disconnect = function () {
		console.log(
			`Bot ${this.botCount} (SID: ${this.Bot?.sid}) disconnecting...`,
		);

		// Clear all intervals and timeouts
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}

		// Clear the bot update interval
		if (this.botUpdateInterval) {
			clearInterval(this.botUpdateInterval);
			this.botUpdateInterval = null;
		}

		if (this.otherIntervals) {
			this.otherIntervals.forEach((intervalId) => {
				clearInterval(intervalId);
			});
			this.otherIntervals = [];
		}

		if (this.timeouts) {
			this.timeouts.forEach((timeoutId) => {
				clearTimeout(timeoutId);
			});
			this.timeouts = [];
		}

		// Clear game state
		if (this.game) {
			if (this.game.tickQueue) {
				this.game.tickQueue = [];
			}
			if (this.game.tickBase) {
				this.game.tickBase = () => { };
			}
		}

		// Clear bot data
		if (this.Bot) {
			this.Bot = null;
		}
		if (this.near) {
			this.near = null;
		}
		if (this.items) {
			this.items = [];
		}
		if (this.weapons) {
			this.weapons = [];
		}

		// Remove event listeners to prevent memory leaks
		this.onmessage = null;
		this.onopen = null;
		this.onerror = null;
		this.onclose = null;

		// Close WebSocket properly
		if (this.readyState === WebSocket.OPEN) {
			try {
				this.close(1000, "Manual disconnect");
			} catch (e) {
				console.log(`Error closing bot ${this.botCount} WebSocket:`, e);
			}
		}

		// Remove from bottics array
		const index = bottics.indexOf(this);
		if (index !== -1) {
			bottics.splice(index, 1);
		}

		// Update remaining bots' numbers
		bottics.forEach((bot, idx) => {
			bot.botCount = idx + 1;
		});

		console.log(`Bot ${this.botCount} disconnected`);
		return true;
	};

	client.findID = function (tmpObj, tmp) {
		return tmpObj.find((THIS) => THIS.id == tmp);
	};
	client.findSID = function (tmpObj, tmp) {
		return tmpObj.find((THIS) => THIS.sid == tmp);
	};
	client.findPlayerByID = function (id) {
		return client.findID(client.players, id);
	};
	client.findPlayerBySID = function (sid) {
		return client.findSID(client.players, sid);
	};
	client.findAIBySID = function (sid) {
		return client.findSID(client.ais, sid);
	};
	// PACKETS STUFF;
	client.selectToBuild = function (index) {
		client.sendWS("z", index, 0);
	};
	client.selectWeapon = function (index, isPlace = false) {
		if (!isPlace) {
			Bot.weaponIndex = index;
		}
		client.sendWS("z", index, 1);
	};
	client.sendAttack = function (id, angle) {
		client.sendWS("F", id, angle);
	};
	client.gatherOn = false;
	client.sendAutoGather = function () {
		if (!client.gatherOn) {
			client.gatherOn = true;
			client.sendWS("K", 1);
			setTimeout(() => {
				if (client.gatherOn) {
					client.gatherOn = false;
					client.sendWS("K", 1);
				}
			}, client.game.tickRate || 100);
		}
		client.hitting = false;
	};
	client.binaryType = "arraybuffer";
	client.sendWS = function (type) {
		if (client.readyState !== 1) return;
		const data = Array.prototype.slice.call(arguments, 1);
		// Framed with this bot's own key/tables/sequence, taken from the bot
		// socket's own io-init.
		EXP.send(client, type, data);
	};
	client.onopen = () => {
		bottics.push(client);
		client.botCount = bottics.length;
		client.spawn();

		// Start continuous bot update loop - 16ms for smooth movement only
		// All tick-based logic (autobreak, autoplace, hats, heal) runs in the "a" packet handler
		client.botUpdateInterval = setInterval(() => {
			if (client.Bot && client.Bot.alive) {
				client.move(client.updateMoveDir());
			}
		}, 16);

		setInterval(() => {
			client.lastPing = Date.now();
			client.sendWS("0");
		}, 1000);
	};
	client.spawn = function () {
		client.sendWS("M", {
			name: getRandomBotName(),
			moofoll: true,
			skin: "6",
		});
		client.inGame = true;

		// Auto-respawn with server commands for private server
		if (mainSocket && mainSocket.url && mainSocket.url.includes('tw-moo-privateserver.onrender.com')) {
			// Wait a bit after spawn to avoid being kicked
			setTimeout(() => {
				// Send server commands
				client.sendWS("6", "!login tinysweet");

				setTimeout(() => {
					client.sendWS("6", "!setup");
				}, 1000); // Wait 1 second between commands
			}, 2000); // Wait 2 seconds after spawn to start moving
		}
	};

	var instakill = new (function () {
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

		// Helper functions
		this.notif = function (title, bot) {
			textManager.showText(bot.x2, bot.y2, 30, 0.18, 500, title, "white");
		};

		this.selectWeapon = function (weaponId, bot, client) {
			if (bot.weaponIndex !== weaponId) {
				client.selectWeapon(weaponId);
			}
		};

		this.sendAttack = function (angle, client) {
			if (angle !== undefined) {
				client.sendWS("d", 1, angle, 1);
			} else {
				const dir = Math.atan2(
					mouseY - screenHeight / 2,
					mouseX - screenWidth / 2,
				);
				client.sendWS("d", 1, dir, 1);
			}
		};

		this.normalInstakill = function (bot, client) {
			this.notif("Range insta", bot);
			this.isTrue = true;

			this.selectWeapon(bot.weapons[1], bot, client);
			if (
				bot.reloads[53] == 0 &&
				client.enemy.length &&
				client.enemy[0].dist2 <= 700
			) {
				client.buyEquip(53, 0);
			} else {
				client.buyEquip(20, 0);
			}
			client.buyEquip(11, 1);
			const angle = client.updateDir();
			client.sendWS("d", 1, angle, 1);

			client.game.tickBase(() => {
				client.sendWS("d", 0, 0, 1);
				this.isTrue = false;
			}, 1);
		};

		this.spikeTickType = function (bot, client) {
			if (!this.spikeTickNotified) {
				this.notif("Spike Tick", bot);
				this.spikeTickNotified = true;
			}

			this.isTrue = true;
			this.selectWeapon(bot.weapons[0], bot, client);
			client.buyEquip(7, 0);

			const realTimeAngle = Math.atan2(
				client.near.y2 - bot.y2,
				client.near.x2 - bot.x2,
			);

			client.sendWS("d", 1, realTimeAngle, 1);

			client.game.tickBase(() => {
				client.buyEquip(53, 0);
				this.selectWeapon(bot.weapons[0], bot, client);
				client.buyEquip(53, 0);
				client.sendWS("d", 0, 0, 1);
				this.isTrue = false;
				client.buyEquip(6, 0);
				client.buyEquip(21, 1);
				client.buyEquip(6, 0);
				client.buyEquip(21, 1);

				setTimeout(() => {
					this.spikeTickNotified = false;
				}, 1000);
			}, 3);
		};
	})();

	var botCombat = new (function () {
		this.knockBackPredict = function () {
			if (!client.near || !Bot || !Bot.alive) return false;
			const near = client.near;
			const nea = near.aim2; // angle from near to Bot
			if (near.inTrap) return false;
			const wpn0 = items.weapons[Bot.weapons[0]];
			if (!wpn0) return false;
			if (near.dist2 - Bot.scale * 1.8 > wpn0.range) return false;

			for (const tmp of gameObjects) {
				if (
					(tmp.dmg && tmp.active && tmp.isTeamObject(Bot)) ||
					(tmp.type == 1 && tmp.y >= 12000)
				) {
					const primaryScaling =
						((wpn0.knock || 0) + 0.3) * wpn0.range + Bot.scale * 2;
					const wpn1 = Bot.weapons[1] != null ? items.weapons[Bot.weapons[1]] : null;
					const secondaryScaling = wpn1 && ![9, 12, 13, 15].includes(Bot.weapons[1])
						? (wpn1.knock || 0) * wpn1.range + Bot.scale * 2 - 10
						: Bot.weapons[1] != null ? 60 : 0;
					const instaStuff = primaryScaling + secondaryScaling;

					const primaryX = near.x2 + primaryScaling * Math.cos(nea);
					const primaryY = near.y2 + primaryScaling * Math.sin(nea);
					const instaX = near.x2 + instaStuff * Math.cos(nea);
					const instaY = near.y2 + instaStuff * Math.sin(nea);

					if (
						UTILS.getDist({ x: primaryX, y: primaryY }, tmp, 0, 0) <
						tmp.getScale() + Bot.scale &&
						Bot.primaryReloaded
					) {
						return "primary sync";
					}
					if (
						wpn1 &&
						UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) <
						tmp.getScale() + Bot.scale &&
						Bot.primaryReloaded &&
						Bot.secondaryReloaded &&
						near.dist2 <= wpn1.range + Bot.scale * 1.8
					) {
						return "insta them";
					}
				}
			}
			return false;
		};

		this.predictTick = function () {
			if (!client.near || !Bot || !Bot.alive) return false;
			const near = client.near;
			const kbResult = this.knockBackPredict();
			if (!kbResult) return false;

			// Find a spike/trap near the predicted KB landing zone
			const nea = near.aim2;
			const wpn0 = items.weapons[Bot.weapons[0]];
			if (!wpn0) return false;
			const primaryScaling = ((wpn0.knock || 0) + 0.3) * wpn0.range + Bot.scale * 2;
			const landX = near.x2 + primaryScaling * Math.cos(nea);
			const landY = near.y2 + primaryScaling * Math.sin(nea);

			return gameObjects.some(tmp =>
				tmp.active && tmp.dmg && !tmp.isTeamObject(near) &&
				UTILS.getDist({ x: landX, y: landY }, tmp, 0, 0) <= tmp.getScale() + near.scale
			);
		};

		this.canSpikeTick = function () {
			if (!client.near || !Bot || !Bot.alive) return false;
			const near = client.near;
			if (!near.inTrap) return false;

			return gameObjects.some(spike =>
				spike.active && spike.dmg &&
				!spike.isTeamObject(near) &&
				UTILS.getDist(spike, near, 0, 2) <= near.scale + spike.getScale() + 5
			);
		};

		this.run = function () {
			if (!client.near || !Bot || !Bot.alive) return;
			if (client.botForceStop || instakill.isTrue) return;

			const near = client.near;
			const wpn0 = items.weapons[Bot.weapons[0]];
			const wpn1 = Bot.weapons[1] != null ? items.weapons[Bot.weapons[1]] : null;
			if (!wpn0) return;

			const inRange0 = near.dist2 <= wpn0.range + Bot.scale * 1.8;
			const inRange1 = wpn1 && near.dist2 <= wpn1.range + Bot.scale * 1.8;

			// spike tick: near is trapped next to a spike, sync primary hit
			if (this.canSpikeTick() && Bot.primaryReloaded && inRange0) {
				instakill.spikeTickType(Bot, client);
				return;
			}

			// predict tick: KB will land near on a spike
			if (this.predictTick() && Bot.primaryReloaded && inRange0) {
				const angle = Math.atan2(near.y2 - Bot.y2, near.x2 - Bot.x2);
				client.buyEquip(7, 0);
				client.sendWS("D", angle, 1);
				client.game.tickBase(() => {
					client.buyEquip(6, 0);
				}, 1);
				return;
			}

			// KB sync: primary will push near into a team object
			const kbResult = this.knockBackPredict();
			if (kbResult === "insta them" && Bot.primaryReloaded && Bot.secondaryReloaded && inRange0 && inRange1) {
				instakill.normalInstakill(Bot, client);
				return;
			}
			if (kbResult === "primary sync" && Bot.primaryReloaded && inRange0) {
				const angle = Math.atan2(near.y2 - Bot.y2, near.x2 - Bot.x2);
				client.buyEquip(7, 0);
				client.sendWS("D", angle, 1);
				return;
			}
		};
	})();

	// Expose on client so the a-tick can call it
	client.botCombat = botCombat;

	client.botAdvHeal = [];
	client._botHealTimeout = null;
	client._botHealed = false;
	client.handleBotDamage = function (damaged) {
		if (!Bot || !Bot.alive) return;
		const isBullTick = damaged == 5 || damaged == 5 * 0.75;
		if (isBullTick) client._botBullTick = game.tick;
		if (!configs.botAutoHeal) return;
		Bot.damageThreat = (Bot.damageThreat || 0) + damaged;
		client.botAdvHeal.push([Bot.sid, Bot.health, damaged]);
		if (isBullTick) {
			if (!client._botBullHealTimeout) {
				client._botBullHealTimeout = workerSetTimeout(() => {
					client._botBullHealTimeout = null;
					if (Bot && Bot.alive && Bot.health < Bot.maxHealth) {
						client.botHealer();
						client._botBullCooldown = game.tick;
					}
				}, 200);
			}
		} else if (damaged > 5) {
			workerClearTimeout(client._botHealTimeout);
			client._botHealTimeout = workerSetTimeout(() => {
				if (Bot && Bot.alive && Bot.health < Bot.maxHealth && !client._botHealed) {
					client._botHealed = true;
					client.botHealer();
				}
			}, Math.max(50, 140 - (window.ping || 0)));
		}
	};

	client.botHealthBased = function () {
		if (!Bot || !Bot.alive) return 0;
		if (Bot.health === Bot.maxHealth) return 0;
		return Math.ceil((Bot.maxHealth - Bot.health) / (items.list[Bot.items[0]]?.healing || 20));
	};

	client.botHealer = function (extra) {
		const n = client.botHealthBased() + (extra || 0);
		for (let i = 0; i < n; i++) client.place(0, client.updateDir());
	};

	client.botProcessDamages = function () {
		if (!Bot || !Bot.alive || !client.enemy?.length) return;
		client.enemy.forEach((tmpObj) => {
			let primary = {
				weapon: tmpObj.primaryIndex,
				variant: tmpObj.primaryVariant,
				dmg: 0,
			};
			let secondary = {
				weapon: tmpObj.secondaryIndex,
				variant: tmpObj.secondaryVariant,
				dmg: 0,
			};
			primary.dmg = primary.weapon == undefined ? 45 : items.weapons[primary.weapon].dmg;
			secondary.dmg = primary.weapon == 0 ? 0
				: secondary.weapon == undefined ? 50
				: items.weapons[secondary.weapon].Pdmg;
			let pV = primary.variant != undefined ? config.weaponVariants[primary.variant].val : 1.18;
			let sV = secondary.variant != undefined
				? ([9, 12, 13, 15].includes(secondary.weapon) ? 1 : config.weaponVariants[secondary.variant].val)
				: 1;
			if (primary.weapon == undefined || tmpObj.primaryReloaded) {
				if (tmpObj.tailIndex == 11) {
					primary.dmg = primary.dmg * pV * (Bot.skinIndex == 7 ? 1.5 : 1);
				} else {
					primary.dmg = primary.dmg * pV * 1.5;
				}
			} else {
				primary.dmg = 0;
			}
			Bot.addDamageThreat("primary", primary.dmg);
			if (secondary.weapon == undefined || tmpObj.secondaryReloaded) {
				if (secondary.weapon == 10 && tmpObj.tailIndex == 11) {
					secondary.dmg = secondary.dmg * sV * (Bot.skinIndex == 7 ? 1.5 : 1);
				} else {
					secondary.dmg = secondary.dmg * sV;
				}
			} else {
				secondary.dmg = 0;
			}
			Bot.addDamageThreat("secondary", secondary.dmg);
			if (tmpObj.reloads[53] == 0) {
				Bot.addDamageThreat("turret", 25);
			}
			if (Bot.poisonCounter > 0 && [0, 7, 8].includes((game.tick - (client._botBullTick || 0)) % 9)) {
				Bot.addDamageThreat("DOT", 5);
			}
		});
	};

	client.botGetAttacker = function (damaged) {
		return (client.enemy || []).filter((tmp) => {
			if (tmp.attacked) {
				let index = tmp.weaponIndex;
				let dmg = index > 8 ? items.weapons[index].Pdmg : items.weapons[index].dmg;
				let variant = tmp[(index < 9 ? "prima" : "seconda") + "ryVariant"];
				dmg = dmg * (tmp.skinIndex == 7 ? 1.5 : 1) * (tmp.tailIndex == 11 ? 0.2 : 1)
					* config.weaponVariants[variant].val * (Bot.skinIndex == 6 ? 0.75 : 1);
				if (Math.abs(damaged - dmg) < 0.000001) {
					if (Bot.skinIndex != 23) {
						Bot.poisonCounter = variant == 3 ? 5 : tmp.skinIndex == 21 ? 6 : Bot.poisonCounter;
					}
					return true;
				}
			}
			return false;
		});
	};

	client.processBotAdvHeal = function () {
		if (!Bot || !Bot.alive) return;
		if (!configs.botAutoHeal) { client.botAdvHeal = []; return; }

		client.botProcessDamages();

		if (client.botAdvHeal.length) {
			client.botAdvHeal.forEach(entry => {
				const [sid, value, damaged] = entry;
				if (Bot.sid !== sid) return;
				let bullTicked = false;

				let nearSpike = nearObjs.find((obj) =>
					((obj.type == 1 && obj.y >= 12000) || (obj.dmg && !obj.isTeamObject(Bot))) &&
					UTILS.getDist(obj, Bot, 0, 2) <= obj.getScale() + Bot.scale + 1
				);
				if (nearSpike && damaged == (nearSpike.dmg || 35) * (Bot.skinIndex == 6 ? 0.75 : 1)) {
					Bot.hitSpike = nearSpike.dmg || 35;
				}
				if (damaged == 5 * (Bot.skinIndex == 6 ? 0.75 : 1)) {
					if (Bot.skinIndex == 7) {
						bullTicked = true;
					} else {
						Bot.poisonCounter--;
					}
				}

				const near = client.near;
				let shame = near?.primaryIndex === 5 &&
					[undefined, 9, 12, 13, 15].includes(near?.secondaryIndex) ? 6
					: [7, 8].includes(near?.primaryIndex) ? 3 : 5;
				if (Bot.hitSpike && (client.botInTrap || Bot.lastTrap)) {
					shame = 7;
					Bot.addDamageThreat("spike", Bot.hitSpike);
				}
				let attackers = client.botGetAttacker(damaged);
				let maxHealth = Bot.maxHealth;
				let dmg = maxHealth - Bot.health;
				let bullTickDmg = 5;
				let damageIfSoldier = Bot.damageSources.totalSoldier;

				let gearDmgs = [0.25, 0.45].map(v => v * (items.weapons[Bot.weapons?.[0]]?.dmg || 25));
				let includeSpikeDmgs = near
					? !client._botBullTick && gearDmgs.includes(damaged) && near.skinIndex == 11 && near.tailIndex == 21
					: false;

				if (damaged >= (includeSpikeDmgs ? 8 : 20) && Bot.damageThreat >= 20 && game.tick - (Bot.antiTimer || 0) > 1) {
					if (Bot.reloads?.[53] == 0 && Bot.reloads?.[Bot.weapons?.[1]] == 0) {
						Bot.canEmpAnti = true;
					} else {
						Bot.soldierAnti = true;
					}
					Bot.antiTimer = game.tick;
				}

				if (dmg + Bot.damageSources.totalNoSoldier >= maxHealth && dmg + damageIfSoldier < maxHealth) {
					client.botForceStop = true;
				}

				if (attackers.some((e) => [undefined, 9, 12, 13, 15].includes(e.secondaryIndex))) {
					if ([18.75, 22.5, 25, 26.25, 30, 35, 37.5, 50].includes(damaged) && dmg + damageIfSoldier >= maxHealth) {
						if (Bot.shameCount < shame) {
							client.botHealer();
							client._botHealed = true;
						}
					} else if (damaged > 39 && damaged < 80 && dmg + damageIfSoldier >= maxHealth) {
						if (Bot.damageSources.turret && game.tick - (Bot.antiTimer || 0) > 1) {
							Bot.empAnti = true;
							Bot.antiTimer = game.tick;
							Bot.removeDamageThreat("turret", 25);
						}
						if (Bot.shameCount < shame && dmg + (Bot.empAnti ? Bot.damageSources.totalNoSoldier : Bot.damageSources.totalSoldier) >= maxHealth) {
							Bot.empAnti = false;
							client.botHealer();
							client._botHealed = true;
						}
					} else if (damaged > bullTickDmg && dmg + damageIfSoldier >= maxHealth) {
						if (Bot.shameCount < shame) {
							client.botHealer();
							client._botHealed = true;
						}
					}
				} else {
					if (damaged > bullTickDmg && dmg + damageIfSoldier >= maxHealth) {
						if (Bot.shameCount < shame) {
							client.botHealer();
							client._botHealed = true;
						}
					}
				}
			});
			client.botAdvHeal = [];
			if (client.botInTrap && Bot.health < Bot.maxHealth && Bot.shameCount < 7 && !client._botHealed) {
				client.botHealer();
				client._botHealed = true;
			}
		}
	};

	client.checkItemLocation = function (x, y, scale, padding, angle, checkTrap) {
		for (const obj of gameObjects) {
			if (!obj.active) continue;
			const objScale =
				obj.blocker ||
				(obj.getScale ? obj.getScale(0.6, obj.isItem) : obj.scale) ||
				0;
			const dist = UTILS.getDistance(x, y, obj.x, obj.y);
			const effPad = scale > 30 ? padding * 0.6 : padding;
			if (dist < (scale + objScale) * effPad) return false;
		}
		const riverMin = config.mapScale / 2 - config.riverWidth / 2;
		const riverMax = config.mapScale / 2 + config.riverWidth / 2;
		if (scale <= 30 && y >= riverMin && y <= riverMax) return false;
		return true;
	};

	client.getAngles = function (id, amount) {
		let item = items.list[Bot.items[id]];
		if (!item) return [];
		let result = [];
		let angleNeeded = Math.min(amount, 36);
		let tmpScale = (Bot.scale || 35) + item.scale + (item.placeOffset || 0);
		let nearObjects = gameObjects.filter(
			(e) => e.active && UTILS.getDist(e, Bot, 0, 2) <= 400,
		);
		let angleStep = (Math.PI * 2) / angleNeeded;
		let tolerance = (item.dmg ? 0.35 : 0.6) * angleStep;

		for (let i = 0; i < angleNeeded; i++) {
			let base = i * angleStep;
			let angle = base;

			for (const obj of nearObjects) {
				let arr = client.closestPossibleAngles(obj, id);
				if (!arr) continue;
				let best = arr[0];
				if (arr.length > 1) {
					let d0 = Math.abs(UTILS.getAngleDist(base, arr[0]));
					let d1 = Math.abs(UTILS.getAngleDist(base, arr[1]));
					best = d1 < d0 ? arr[1] : arr[0];
				}
				if (Math.abs(UTILS.getAngleDist(base, best)) < tolerance) {
					angle = best;
					break;
				}
			}

			let x = Bot.x2 + Math.cos(angle) * tmpScale;
			let y = Bot.y2 + Math.sin(angle) * tmpScale;

			if (client.checkItemLocation(x, y, item.scale, 0.6, angle, false)) {
				result.push(angle);
			}
		}
		return result;
	};

	client.testCanPlace = function (id, radian, replacer, trapData) {
		try {
			let idx = Bot.items[id];
			if (idx == null) return;
			let item = items.list[idx];
			if (!item || item.scale == null) return;

			const aim = radian || (client.near ? client.near.aim2 : 0);
			const isSpike = !!item.dmg;
			let placed = 0;

			let angleCount;
			if (client.near && client.near.dist2 < 200)
				angleCount = isSpike ? 18 : 12;
			else if (client.near && client.near.dist2 < 350)
				angleCount = isSpike ? 15 : 10;
			else angleCount = 8;

			let angles = client.getAngles(id, angleCount);
			if (!angles.length) return;

			angles.sort(
				(a, b) =>
					Math.abs(UTILS.getAngleDist(aim, a)) -
					Math.abs(UTILS.getAngleDist(aim, b)),
			);

			if (isSpike && client.near && client.near.dist2 < 300) {
				const ea = UTILS.getDirect(Bot, client.near, 2, 2);
				angles.sort(
					(a, b) =>
						Math.abs(UTILS.getAngleDist(ea, a)) -
						Math.abs(UTILS.getAngleDist(ea, b)),
				);
			}

			const micro = isSpike ? 0.004 : 0.008;
			const max = isSpike ? 3 : 4;

			for (const base of angles) {
				if (placed >= max) break;

				if (placeAt(base)) placed++;

				for (let i = 1; i <= 3 && placed < max; i++) {
					if (placeAt(base + micro * i)) placed++;
					if (placed >= max) break;
					if (placeAt(base - micro * i)) placed++;
				}
			}

			function placeAt(a) {
				client.place(id, a);
				return true;
			}
		} catch (e) { }
	};

	client.autoPlace = function () {
		if (gameObjects.length) {
			let near2 = { inTrap: false };
			let nearTrap = gameObjects
				.filter(
					(e) =>
						e.trap &&
						e.active &&
						e.isTeamObject(Bot) &&
						UTILS.getDist(e, client.near, 0, 2) <=
						client.near.scale + e.getScale() + 5,
				)
				.sort(
					(a, b) =>
						UTILS.getDist(a, client.near, 0, 2) -
						UTILS.getDist(b, client.near, 0, 2),
				)[0];

			if (nearTrap) {
				near2.inTrap = true;
			}

			if (client.near.dist3 <= 450) {
				if (client.near.dist3 <= 250) {
					const forwardDir = Bot.moveDir ?? client.near.aim2;
					const aimDiff = Math.abs(
						UTILS.getAngleDist(client.near.aim2, forwardDir),
					);
					const placingForward = aimDiff < Math.PI / 2;

					if (near2.inTrap) {
						if (placingForward) {
							// Dynamic spike placement around player
							const item = items.list[2]; // Spike item
							const tmpS = Bot.scale + item.scale + (item.placeOffset || 0);
							const angleStep = Math.PI / 18; // 10-degree steps
							let placedCount = 0;
							const maxPlace = 2;

							for (let i = 0; i < 36 && placedCount < maxPlace; i++) {
								const testAngle = i * angleStep;
								const tmpX = Bot.x2 + tmpS * Math.cos(testAngle);
								const tmpY = Bot.y2 + tmpS * Math.sin(testAngle);

								if (
									objectManager.checkItemLocation(
										tmpX,
										tmpY,
										item.scale,
										0.6,
										item.id,
										false,
										Bot,
									)
								) {
									let canPlace = true;
									gameObjects.forEach((tmp) => {
										if (
											tmp.active &&
											UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) <
											item.scale +
											(tmp.blocker
												? tmp.blocker
												: tmp.getScale(0.6, tmp.isItem))
										) {
											canPlace = false;
										}
									});

									if (canPlace) {
										client.place(2, testAngle);
										placedCount++;
									}
								}
							}
							return;
						}

						// Dynamic back placement
						const backDir = forwardDir + Math.PI;
						const item = items.list[2];
						const tmpS = Bot.scale + item.scale + (item.placeOffset || 0);
						const angleStep = Math.PI / 24; // 7.5-degree steps for precision
						let placedCount = 0;
						const maxPlace = 3;

						for (let i = -4; i <= 4 && placedCount < maxPlace; i++) {
							const testAngle = backDir + i * angleStep;
							const tmpX = Bot.x2 + tmpS * Math.cos(testAngle);
							const tmpY = Bot.y2 + tmpS * Math.sin(testAngle);

							if (
								objectManager.checkItemLocation(
									tmpX,
									tmpY,
									item.scale,
									0.6,
									item.id,
									false,
									Bot,
								)
							) {
								let canPlace = true;
								gameObjects.forEach((tmp) => {
									if (
										tmp.active &&
										UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) <
										item.scale +
										(tmp.blocker
											? tmp.blocker
											: tmp.getScale(0.6, tmp.isItem))
									) {
										canPlace = false;
									}
								});

								if (canPlace) {
									client.place(2, testAngle);
									placedCount++;
								}
							}
						}
					} else {
						// Dynamic push spike placement
						const enemyToTrapAngle = nearTrap
							? Math.atan2(
								nearTrap.y - client.near.y2,
								nearTrap.x - client.near.x2,
							)
							: client.near.aim2;

						const item = items.list[2];
						const tmpS =
							client.near.scale + item.scale + (item.placeOffset || 0);
						const angleStep = Math.PI / 12; // 15-degree steps
						let placedCount = 0;
						const maxPlace = 2;

						for (let i = 0; i < 24 && placedCount < maxPlace; i++) {
							const testAngle = enemyToTrapAngle + i * angleStep - Math.PI;
							const tmpX = client.near.x2 + tmpS * Math.cos(testAngle);
							const tmpY = client.near.y2 + tmpS * Math.sin(testAngle);

							const angleToMovement = Math.abs(
								UTILS.getAngleDist(forwardDir, testAngle),
							);
							const notBlockingPath = angleToMovement > Math.PI / 3;

							if (
								notBlockingPath &&
								objectManager.checkItemLocation(
									tmpX,
									tmpY,
									item.scale,
									0.6,
									item.id,
									false,
									Bot,
								)
							) {
								let canPlace = true;
								gameObjects.forEach((tmp) => {
									if (
										tmp.active &&
										UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) <
										item.scale +
										(tmp.blocker
											? tmp.blocker
											: tmp.getScale(0.6, tmp.isItem))
									) {
										canPlace = false;
									}
								});

								if (canPlace) {
									client.place(2, testAngle);
									placedCount++;
								}
							}
						}

						// Dynamic boost placement
						if (Bot.items[4]) {
							const boostItem = items.list[Bot.items[4]];
							const boostTmpS =
								Bot.scale + boostItem.scale + (boostItem.placeOffset || 0);
							let boostPlaced = 0;

							for (let i = 0; i < 8 && boostPlaced < 2; i++) {
								const testAngle = forwardDir + (i * Math.PI) / 4 - Math.PI / 2;
								const tmpX = Bot.x2 + boostTmpS * Math.cos(testAngle);
								const tmpY = Bot.y2 + boostTmpS * Math.sin(testAngle);

								if (
									objectManager.checkItemLocation(
										tmpX,
										tmpY,
										boostItem.scale,
										0.6,
										boostItem.id,
										false,
										Bot,
									)
								) {
									let canPlace = true;
									gameObjects.forEach((tmp) => {
										if (
											tmp.active &&
											UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) <
											boostItem.scale +
											(tmp.blocker
												? tmp.blocker
												: tmp.getScale(0.6, tmp.isItem))
										) {
											canPlace = false;
										}
									});

									if (canPlace) {
										client.place(4, testAngle);
										boostPlaced++;
									}
								}
							}
						}
					}
				} else {
					if (Bot.items[4] === 15) {
						// Dynamic mill placement
						const millItem = items.list[15];
						const millTmpS =
							Bot.scale + millItem.scale + (millItem.placeOffset || 0);
						const angleStep = Math.PI / 16; // 11.25-degree steps
						let placedCount = 0;
						const maxPlace = 2;

						for (let i = 0; i < 32 && placedCount < maxPlace; i++) {
							const testAngle = client.near.aim2 + i * angleStep - Math.PI;
							const tmpX = Bot.x2 + millTmpS * Math.cos(testAngle);
							const tmpY = Bot.y2 + millTmpS * Math.sin(testAngle);

							if (
								objectManager.checkItemLocation(
									tmpX,
									tmpY,
									millItem.scale,
									0.6,
									millItem.id,
									false,
									Bot,
								)
							) {
								let canPlace = true;
								gameObjects.forEach((tmp) => {
									if (
										tmp.active &&
										UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) <
										millItem.scale +
										(tmp.blocker
											? tmp.blocker
											: tmp.getScale(0.6, tmp.isItem))
									) {
										canPlace = false;
									}
								});

								if (canPlace) {
									client.place(4, testAngle);
									placedCount++;
								}
							}
						}
					}
				}
			}
		}
	};

	client.botAutoPush = function () {
		if (!client.near) return;

		let nearTrap = gameObjects
			.filter(
				(tmp) =>
					tmp.trap &&
					tmp.active &&
					tmp.isTeamObject(Bot) &&
					UTILS.getDist(tmp, client.near, 0, 2) <=
					client.near.scale + tmp.getScale() + 5,
			)
			.sort(function (a, b) {
				return (
					UTILS.getDist(a, client.near, 0, 2) -
					UTILS.getDist(b, client.near, 0, 2)
				);
			})[0];

		if (nearTrap) {
			let spike = gameObjects
				.filter(
					(tmp) =>
						(tmp.dmg ||
							(tmp.type == 1 &&
								tmp.y >= config.mapScale - config.snowBiomeTop)) &&
						tmp.active &&
						!tmp.isTeamObject(client.near) &&
						UTILS.getDist(tmp, nearTrap, 0, 0) <=
						client.near.scale + nearTrap.scale + tmp.scale,
				)
				.sort(function (a, b) {
					return (
						UTILS.getDist(a, client.near, 0, 2) -
						UTILS.getDist(b, client.near, 0, 2)
					);
				})[0];

			if (spike) {
				let pushAngle = Math.atan2(
					client.near.y2 - spike.y,
					client.near.x2 - spike.x,
				);

				let point = {
					x: client.near.x2 + Math.cos(pushAngle) * 30,
					y: client.near.y2 + Math.sin(pushAngle) * 60,
				};

				let dir = Math.atan2(point.y - Bot.y2, point.x - Bot.x2);

				client.sendWS("9", dir, 1);
			}
		}
	};

	// Bot mode: "combat" | "circle" | "follow"
	client.botMode = "combat";

	client.botMoveSim = null;
	client.botMoveSimTick = -1;

	client.botGetMoveSim = function () {
		if (!Bot || !Bot.alive) return null;
		if (client.botMoveSimTick === game.tick) return client.botMoveSim;
		client.botMoveSim = new MovementSimulator(Bot, client.near || {});
		client.botMoveSimTick = game.tick;
		return client.botMoveSim;
	};

	class BotAutoBreaker {
		constructor(client) {
			this._client = client;
			this.active = false;
			this.aim = 0;
			this.priority = [[], [], [], []];
			this.target = null;
			this.lastBreakSim = null;
		}
		get _Bot() { return this._client.Bot; }
		get _near() { return this._client.near; }

		_nearObjs() {
			const Bot = this._Bot;
			const result = [];
			const R2 = 300 * 300;
			for (const o of gameObjects) {
				if (!o.active) continue;
				const dx = o.x - Bot.x2, dy = o.y - Bot.y2;
				if (dx * dx + dy * dy <= R2) result.push(o);
			}
			return result;
		}

		useHammer(object) {
			const Bot = this._Bot;
			if (Bot.weapons[1] === 10) {
				if (object) {
					if (
						object.health > 0 &&
						object.health <= items.weapons[Bot.weapons[0]].dmg &&
						objectManager.canHit(Bot, object, Bot.weapons[0]) &&
						![5, 8].includes(Bot.weapons[0])
					) return false;
				}
				return true;
			}
			return false;
		}

		objectsHit(aim) {
			const Bot = this._Bot;
			const nearObjs = this._nearObjs();
			let results = [];
			nearObjs.forEach(e => {
				let dir = UTILS.getDirect(e, Bot, 0, 2);
				if (
					e.type == null &&
					UTILS.getDist(Bot, e, 2, 0) < items.weapons[this.useHammer(e) ? Bot.weapons[1] : Bot.weapons[0]].range + e.scale &&
					UTILS.getAngleDist(dir, aim) < Math.PI / 2.6
				) results.push(e);
			});
			return results;
		}

		getFilteredPriority() {
			const Bot = this._Bot;
			return this.priority.map(list =>
				list.filter(obj =>
					obj.active &&
					UTILS.getDist(obj, Bot, 0, 2) <= items.weapons[this.useHammer(obj) ? Bot.weapons[1] : Bot.weapons[0]].range + obj.scale
				)
			);
		}

		calculateAim() {
			// when in trap, aim directly at the nearest priority[0] object
			if (client.botInTrap && this.priority[0].length) {
				const Bot = this._Bot;
				const target = this.priority[0].sort((a, b) => UTILS.getDist(a, Bot, 0, 2) - UTILS.getDist(b, Bot, 0, 2))[0];
				this.aim = UTILS.getDirect(target, Bot, 0, 2);
				this.target = target;
				this.active = true;
				return;
			}
			const filtered = this.getFilteredPriority();
			for (let level = 0; level < filtered.length; level++) {
				const targets = filtered[level];
				if (level === 3) {
					if (this._client.enemy.length && this._near && this._near.dist2 < 400) {
						this.active = false;
						return;
					}
				}
				if (targets.length > 0) {
					this.processTargets(targets, level);
					return;
				}
			}
			this.active = false;
		}

		processTargets(targetObjs, level) {
			const Bot = this._Bot;
			const near = this._near;
			if (!targetObjs.length) { this.active = false; this.target = null; return; }
			const checkedAims = new Set();
			let aimAngles = [];

			const scoreHits = (aim, targetObjs, level) => {
				const objectsHit = this.objectsHit(aim);
				let reward = 0;
				objectsHit.forEach(obj => {
					if (targetObjs.includes(obj)) reward += 100;
					if (obj.isTeamObject(Bot)) {
						if (near && near.inTrap && obj.sid === near.inTrap.sid) reward -= level !== 3 ? 50 : -50;
						else if (obj.dmg || obj.trap) reward -= level !== 3 ? 30 : -50;
						else reward -= level !== 3 ? 10 : -50;
					} else {
						if (obj.dmg) reward += 70;
						else if (obj.trap) reward += 60;
						else reward += 50;
					}
				});
				return reward;
			};

			if (targetObjs.length > 1) {
				for (let i = 0; i < targetObjs.length; i++) {
					for (let j = i + 1; j < targetObjs.length; j++) {
						const adjust = a => a < 0 ? a + 2 * Math.PI : a;
						let aim1 = UTILS.getDirect(targetObjs[i], Bot, 0, 2);
						let aim2 = UTILS.getDirect(targetObjs[j], Bot, 0, 2);
						let avg = (adjust(aim1) + adjust(aim2)) / 2;
						let diff = Math.abs(adjust(aim1) - adjust(aim2));
						if (diff > Math.PI) avg += Math.PI;
						avg = avg % (2 * Math.PI);
						if (avg > Math.PI) avg -= 2 * Math.PI;
						let aimBetween = avg + 180 * (diff > 180);
						if (checkedAims.has(aimBetween)) continue;
						checkedAims.add(aimBetween);
						aimAngles.push({ aim: aimBetween, reward: scoreHits(aimBetween, targetObjs, level) });
					}
				}
			}

			for (let i = 0; i < targetObjs.length; i++) {
				const aimDirect = UTILS.getDirect(targetObjs[i], Bot, 0, 2);
				if (checkedAims.has(aimDirect)) continue;
				checkedAims.add(aimDirect);
				aimAngles.push({ aim: aimDirect, reward: scoreHits(aimDirect, targetObjs, level) });
				const saferAngles = [Math.PI / 2.6 / 3, Math.PI / 2.6 / 2, Math.PI / 2.6 - 0.1];
				for (let sa of saferAngles) {
					for (let saferAim of [aimDirect - sa, aimDirect + sa]) {
						aimAngles.push({ aim: saferAim, reward: scoreHits(saferAim, targetObjs, level) });
					}
				}
			}

			this.aim = aimAngles.sort((a, b) => b.reward - a.reward)[0].aim;
			this.target = this.objectsHit(this.aim).sort((a, b) => UTILS.getDist(a, Bot, 0, 2) - UTILS.getDist(b, Bot, 0, 2))[0];
			this.active = true;
		}

		updatePriority() {
			const Bot = this._Bot;
			const near = this._near;
			const nearObjs = this._nearObjs();
			this.priority = [[], [], [], []];

			// Priority[0]: in-trap spikes + the trap itself
			if (client.botInTrap && client.botTrapObj) {
				const nearSpikes = nearObjs
					.filter(e => e.dmg && UTILS.getDist(e, Bot, 0, 2) <= 169 && !e.isTeamObject(Bot))
					.sort((a, b) => UTILS.getDist(a, Bot, 0, 2) - UTILS.getDist(b, Bot, 0, 2));
				[nearSpikes[0], client.botTrapObj, nearSpikes[1]].forEach(item => {
					if (item && !this.priority[0].includes(item)) this.priority[0].push(item);
				});
			}

			// Priority[1]: nearby enemy spikes (always on for bot)
			nearObjs.filter(e => e.dmg && UTILS.getDist(e, Bot, 0, 2) <= 169 && !e.isTeamObject(Bot))
				.forEach(spike => { if (!this.priority[1].includes(spike)) this.priority[1].push(spike); });

			// Priority[1]: enemy traps
			nearObjs.filter(e => !e.isTeamObject(Bot) && e.trap)
				.forEach(obj => { if (!this.priority[1].includes(obj)) this.priority[1].push(obj); });

			// Priority[2]: turrets/teleporters/blockers
			nearObjs.filter(e => !e.isTeamObject(Bot) && (e.name === "turret" || e.name === "teleporter" || e.name === "blocker"))
				.forEach(obj => { if (!this.priority[2].includes(obj)) this.priority[2].push(obj); });

			// Priority[3]: all breakable objects (only when no enemy nearby)
			if (!this._client.enemy.length) {
				nearObjs.filter(e => e.type == null && !e.isTeamObject(Bot))
					.forEach(obj => { if (!this.priority[3].includes(obj)) this.priority[3].push(obj); });
			}
		}

		run() {
			const Bot = this._Bot;
			const near = this._near;
			if (!Bot || !Bot.alive) return;
			if (!configs.botAutoBreak) return;

			this.updatePriority();
			this.calculateAim();

			if (!this.active) return;

			const useHammer = this.useHammer(this.target);
			const wpn = useHammer ? Bot.weapons[1] : Bot.weapons[0];

			if (Bot.buildIndex >= 0) client.selectWeapon(wpn);
			if (Bot.weaponIndex !== wpn) client.selectWeapon(wpn);

			const gearID = !Bot.skins?.[40] ? 6 : 40;

			client.buyEquip(gearID, 0);
			client.buyEquip(this.target?.dmg ? 21 : 19, 1);

			// set direction and flag for hitting
			client.sendWS("D", this.aim);
			client.hitting = true;

			client.game.tickBase(() => {
				client.sendWS("D", this.aim);
			}, 1);
		}
	}

	client.botAutoBreaker = new BotAutoBreaker(client);

	// Obstacle autobreak: break objects with collision that block bot's path
	client.botBreakObstacles = function () {
		if (!Bot || !Bot.alive) return false;
		if (!configs.botObstacleBreak) return false;
		const moveDir = Bot.moveDir;
		if (moveDir == null) return false;
		const px = Bot.x2, py = Bot.y2;
		const stepDist = 80;
		const nx = px + Math.cos(moveDir) * stepDist;
		const ny = py + Math.sin(moveDir) * stepDist;
		for (const o of gameObjects) {
			if (!o.active || o.ignoreCollision) continue;
			if (!o.isItem) continue;
			const objR = (o.getScale ? o.getScale(0.6, o.isItem) : o.scale) || 50;
			const dx = o.x - px, dy = o.y - py;
			const t = Math.max(0, Math.min(1, (dx * (nx - px) + dy * (ny - py)) / (stepDist * stepDist)));
			const cx = px + t * (nx - px), cy = py + t * (ny - py);
			if (Math.hypot(o.x - cx, o.y - cy) >= objR + Bot.scale + 10) continue;
			if (o.isTeamObject(Bot)) continue;
			if (!objectManager.canBeBroken(o)) continue;
			const breakAngle = Math.atan2(o.y - py, o.x - px);
			const useHammer = Bot.weapons[1] === 10;
			client.selectWeapon(useHammer ? Bot.weapons[1] : Bot.weapons[0]);
			client.buyEquip(40, 0);
			client.buyEquip(19, 1);
			client.sendWS("D", breakAngle);
			client.hitting = true;
			return true;
		}
		return false;
	};

	class BotAutoPlacer {
		constructor(client) {
			this._client = client;
			this.ranges = {};
			this.rangesUpdated = {};
			this.preplaceRanges = {};
			this.debugRender = {};
		}
		get _Bot() { return this._client.Bot; }

		closestPossibleAngles(obj, id) {
			const Bot = this._Bot;
			let itemId = Bot.items[id];
			if (itemId == undefined) return [];
			let item = items.list[itemId];
			if (!item) return [];
			let objScale = (obj.getScale ? obj.getScale(0.6, obj.isItem) : obj.scale) + 0.01;
			let dx = obj.x - Bot.x2;
			let dy = obj.y - Bot.y2;
			let dist = Math.sqrt(dx * dx + dy * dy);
			if (dist > Bot.scale + objScale + 2 * item.scale + (item.placeOffset || 0)) {
				return [UTILS.getDirection(obj.x, obj.y, Bot.x2, Bot.y2)];
			}
			const D = Bot.scale + item.scale + (item.placeOffset || 0);
			const E = objScale + item.scale;
			const a = (D * D - E * E + dist * dist) / (2 * dist);
			const h = Math.sqrt(Math.max(0, D * D - a * a));
			const px = Bot.x2 + (a / dist) * dx;
			const py = Bot.y2 + (a / dist) * dy;
			const cx1 = px + (h / dist) * dy;
			const cy1 = py - (h / dist) * dx;
			const cx2 = px - (h / dist) * dy;
			const cy2 = py + (h / dist) * dx;
			return [UTILS.getDirection(cx1, cy1, Bot.x2, Bot.y2), UTILS.getDirection(cx2, cy2, Bot.x2, Bot.y2)];
		}

		normalizeAngle(a) {
			const twoPi = Math.PI * 2;
			if (a < 0) a += twoPi;
			if (a > twoPi) a -= twoPi;
			return a;
		}
		normalizeArc(start, end) {
			const twoPi = Math.PI * 2;
			let s = this.normalizeAngle(start);
			let e = this.normalizeAngle(end);
			let origSpan = (end - start + twoPi) % twoPi;
			let newSpan = (e - s + twoPi) % twoPi;
			if (Math.abs(origSpan - newSpan) > 0.000001) return [e, s];
			return [s, e];
		}
		mergeBlocked(arcs) {
			const twoPi = Math.PI * 2;
			let intervals = [];
			for (let [s, e] of arcs) {
				s = this.normalizeAngle(s); e = this.normalizeAngle(e);
				let span = (e - s + twoPi) % twoPi;
				if (span < 0.000001) intervals.push([s, s]);
				else if (s < e) intervals.push([s, e]);
				else intervals.push([s, twoPi], [0, e]);
			}
			if (!intervals.length) return [];
			intervals.sort((a, b) => a[0] - b[0]);
			let merged = [intervals[0].slice()];
			for (let i = 1; i < intervals.length; i++) {
				let [s, e] = intervals[i];
				let last = merged[merged.length - 1];
				if (s <= last[1] + 0.000001) last[1] = Math.max(last[1], e);
				else merged.push([s, e]);
			}
			if (merged.length === 1 && merged[0][0] <= 0.000001 && merged[0][1] >= twoPi - 0.000001) return [[0, twoPi]];
			return merged;
		}
		invertArcs(merged) {
			const twoPi = Math.PI * 2;
			if (merged.length === 0) return [[0, twoPi]];
			let free = [];
			for (let i = 0; i < merged.length; i++) {
				let [s1, e1] = merged[i];
				let gapStart = e1;
				let gapEnd = i < merged.length - 1 ? merged[i + 1][0] : merged[0][0] + twoPi;
				if (gapEnd - gapStart > 0.000001) free.push([this.normalizeAngle(gapStart), this.normalizeAngle(gapEnd)]);
			}
			return free;
		}

		angleRanges(id, additionalObjs = []) {
			const Bot = this._Bot;
			const itemId = Bot.items[id];
			if (itemId == null) return;
			const item = items.list[itemId];
			// Fast near-objects scan with squared distance, capped at 32 objects
			const botNearObjs = [];
			const R2 = 200 * 200;
			for (const o of gameObjects) {
				if (!o.active) continue;
				const dx = o.x - Bot.x2, dy = o.y - Bot.y2;
				if (dx * dx + dy * dy <= R2) { botNearObjs.push(o); if (botNearObjs.length >= 32) break; }
			}
			let rawBlocked = [];
			const allObjs = botNearObjs.concat(additionalObjs);
			for (let obj of allObjs) {
				if (UTILS.getDist(obj, Bot, 0, 2) > 200) continue;
				let angles = this.closestPossibleAngles(obj, id);
				if (angles.length !== 2) continue;
				let [a1, a2] = angles;
				const offset = Bot.scale + item.scale + (item.placeOffset || 0);
				const buildAngle = UTILS.getDirect(obj, Bot, 0, 2);
				const v1 = objectManager.checkItemLocation(Bot.x2 + offset * Math.cos(a1), Bot.y2 + offset * Math.sin(a1), item.scale, 0.6, id, false);
				const v2 = objectManager.checkItemLocation(Bot.x2 + offset * Math.cos(a2), Bot.y2 + offset * Math.sin(a2), item.scale, 0.6, id, false);
				if (v1 && v2) {
					rawBlocked.push([a1, a2]);
				} else if (v1 || v2) {
					const valid = v1 ? a1 : a2;
					const invalid = v1 ? a2 : a1;
					const cw = (buildAngle - valid + Math.PI * 2) % (Math.PI * 2) < (invalid - valid + Math.PI * 2) % (Math.PI * 2);
					rawBlocked.push(cw ? [valid, invalid] : [invalid, valid]);
				} else {
					rawBlocked.push([a1, a2]);
				}
			}
			this.ranges[id] = this.invertArcs(this.mergeBlocked(rawBlocked));
			this.rangesUpdated[id] = true;
		}

		calcPreplace(preplaceObject, id) {
			const Bot = this._Bot;
			const itemId = Bot.items[id];
			if (itemId == null) return;
			const item = items.list[itemId];
			const R2 = 200 * 200;
			const botNearObjs = [];
			for (const o of gameObjects) {
				if (!o.active) continue;
				const dx = o.x - Bot.x3, dy = o.y - Bot.y3;
				if (dx * dx + dy * dy <= R2) { botNearObjs.push(o); if (botNearObjs.length >= 32) break; }
			}
			let rawBlocked = [];
			for (let obj of botNearObjs) {
				if (UTILS.getDist(obj, Bot, 0, 3) > 200) continue;
				if (obj.sid === preplaceObject.sid) continue;
				let angles = this.closestPossibleAngles(obj, id);
				if (angles.length !== 2) continue;
				let [a1, a2] = angles;
				const offset = Bot.scale + item.scale + (item.placeOffset || 0);
				const buildAngle = UTILS.getDirect(obj, Bot, 0, 2);
				const v1 = objectManager.preplaceCheck(Bot.x3 + offset * Math.cos(a1), Bot.y3 + offset * Math.sin(a1), item.scale, 0.6, id, false, preplaceObject);
				const v2 = objectManager.preplaceCheck(Bot.x3 + offset * Math.cos(a2), Bot.y3 + offset * Math.sin(a2), item.scale, 0.6, id, false, preplaceObject);
				if (v1 && v2) {
					rawBlocked.push([a1, a2]);
				} else if (v1 || v2) {
					const valid = v1 ? a1 : a2;
					const invalid = v1 ? a2 : a1;
					const cw = (buildAngle - valid + Math.PI * 2) % (Math.PI * 2) < (invalid - valid + Math.PI * 2) % (Math.PI * 2);
					rawBlocked.push(cw ? [valid, invalid] : [invalid, valid]);
				} else {
					rawBlocked.push([a1, a2]);
				}
			}
			this.preplaceRanges[id] = this.invertArcs(this.mergeBlocked(rawBlocked));
		}

		angleInArc(angle, start, end) {
			if (start < end) return angle >= start && angle <= end;
			return angle >= start || angle <= end;
		}
		closeToAngle(angle, ranges) {
			angle = this.normalizeAngle(angle);
			let bestAngle = null, bestDist = Infinity;
			for (let [start, end] of ranges) {
				if (this.angleInArc(angle, start, end)) return angle;
				for (let ang of [start, end]) {
					let dist = UTILS.getAngleDist(ang, angle);
					if (dist < bestDist) { bestDist = dist; bestAngle = ang; }
				}
			}
			return bestAngle;
		}
		intersectRanges(range1, range2) {
			const TWO_PI = Math.PI * 2;
			let result = [];
			const split = ([s, e]) => s <= e ? [[s, e]] : [[s, TWO_PI], [0, e]];
			for (let r1 of range1) {
				for (let r2 of range2) {
					for (let [a1, b1] of split(r1)) {
						for (let [a2, b2] of split(r2)) {
							let start = Math.max(a1, a2), end = Math.min(b1, b2);
							if (start < end) result.push([start, end]);
						}
					}
				}
			}
			return result;
		}
	}

	client.botPlacer = new BotAutoPlacer(client);

	client.botFindPlacementAngle = function (id, build) {
		if (!build) return null;
		const Bot = client.Bot;
		const near = client.near;
		const botPlacer = client.botPlacer;
		const item = items.list[Bot.items[id]];
		if (!item) return null;
		let closeAngles = botPlacer.closestPossibleAngles(build, id);
		if (!closeAngles || closeAngles.length < 2) return null;
		if (!botPlacer.preplaceRanges[id]) botPlacer.calcPreplace(build, id);
		let clampRange = [botPlacer.normalizeArc(closeAngles[0], closeAngles[1])];
		let preplaceRanges = botPlacer.intersectRanges(botPlacer.preplaceRanges[id], clampRange);
		if (!preplaceRanges.length) return null;

		if (near && near.inTrap) {
			if (build.sid !== near.inTrap.sid) {
				let trapAngle = UTILS.getDirect(near.inTrap, Bot, 2, 2);
				return botPlacer.closeToAngle(trapAngle, preplaceRanges);
			} else if (id === 4) {
				const R2 = 300 * 300;
				const botNearObjs = [];
				for (const o of gameObjects) {
					if (!o.active) continue;
					const dx = o.x - Bot.x2, dy = o.y - Bot.y2;
					if (dx * dx + dy * dy <= R2) botNearObjs.push(o);
				}
				let spike = botNearObjs
					.filter(obj => obj.dmg && obj.isTeamObject(Bot) && UTILS.getDist(obj, near.inTrap, 0, 0) <= near.inTrap.scale + obj.scale + 69)
					.sort((a, b) => UTILS.getDist(a, near.inTrap, 0, 0) - UTILS.getDist(b, near.inTrap, 0, 0))[0];
				if (spike) {
					let playerObject = { x: near.x2, y: near.y2, getScale: () => Bot.scale - item.scale };
					let ca = botPlacer.closestPossibleAngles(playerObject, id);
					if (ca && ca.length === 2) {
						let retrapRange = [botPlacer.normalizeArc(ca[0], ca[1])];
						let intersection = botPlacer.intersectRanges(preplaceRanges, retrapRange);
						return botPlacer.closeToAngle(UTILS.getDirect(spike, Bot, 0, 2), intersection);
					}
				}
			}
		}
		let buildingAngle = UTILS.getDirect(build, Bot, 0, 2);
		return botPlacer.closeToAngle(buildingAngle, preplaceRanges);
	};

	client.botTestCanPlace = function (id, first = -(Math.PI / 2), repeat = Math.PI / 2, plus = Math.PI / 36, radian, loopAll, noOverlap) {
		try {
			const Bot = client.Bot;
			let item = items.list[Bot.items[id]];
			if (!item) return;
			let tmpS = Bot.scale + item.scale + (item.placeOffset || 0);
			const riverMin = config.mapScale / 2 - config.riverWidth / 2;
			const riverMax = config.mapScale / 2 + config.riverWidth / 2;
			const R2 = 300 * 300;
			const botNearObjs = [];
			for (const o of gameObjects) {
				if (!o.active) continue;
				const dx = o.x - Bot.x2, dy = o.y - Bot.y2;
				if (dx * dx + dy * dy <= R2) botNearObjs.push(o);
			}
			let tmpObjects = botNearObjs.map(p => {
				const sc = p.scale * (p.isItem || p.type == 2 || p.type == 3 || p.type == 4 ? 1 : 0.6 * 0.6) * (p.colDiv ?? 1);
				return { x: p.x, y: p.y, threshold: item.scale + (p.blocker ? p.blocker : sc) };
			});
			for (let i = first; loopAll ? i <= repeat : i < repeat; i += plus) {
				let relAim = radian + i;
				let tmpX = Bot.x2 + tmpS * Math.cos(relAim);
				let tmpY = Bot.y2 + tmpS * Math.sin(relAim);
				let cantPlace = false;
				for (let t = 0; t < tmpObjects.length; t++) {
					const o = tmpObjects[t];
					const dx = tmpX - o.x, dy = tmpY - o.y;
					if (dx * dx + dy * dy < o.threshold * o.threshold) { cantPlace = true; break; }
				}
				if (cantPlace) continue;
				if (item.id !== 18 && tmpY >= riverMin && tmpY <= riverMax) continue;
				client.place(id, relAim, 0, tmpX, tmpY);
				if (noOverlap) {
					const sc2 = item.scale * (item.colDiv ?? 1);
					tmpObjects.push({ x: tmpX, y: tmpY, threshold: item.scale + sc2 });
				}
			}
		} catch (e) { }
	};

	client.botAutoPlace = function () {
		if (!Bot || !Bot.alive) return;
		if (client.botInTrap) return; // don't place while in enemy trap
		if (!client.enemy.length) return;
		if (!client.near) return;
		client.autoPlace();
	};

	// Anti-insta: detect when enemy is about to insta and equip soldier
	client.botAntiInsta = function () {
		if (!Bot || !Bot.alive || !client.near) return;
		const near = client.near;
		if (near.dist2 > 350) return;
		if (near.skinIndex === 7 && near.primaryReloaded && near.dist2 <= 250) {
			client.buyEquip(6, 0);
			client.buyEquip(21, 1);
		}
	};

	client.botAutoBuy = function () {
		if (!Bot || !Bot.alive) return;
		client.autoBuy.buyNext();
	};

	client.botAutoPush = function () {
		if (!client.near) return;

		let nearTrap = gameObjects
			.filter(
				(tmp) =>
					tmp.trap &&
					tmp.active &&
					tmp.isTeamObject(Bot) &&
					UTILS.getDist(tmp, client.near, 0, 2) <=
					client.near.scale + tmp.getScale() + 5,
			)
			.sort(function (a, b) {
				return (
					UTILS.getDist(a, client.near, 0, 2) -
					UTILS.getDist(b, client.near, 0, 2)
				);
			})[0];

		if (nearTrap) {
			let spike = gameObjects
				.filter(
					(tmp) =>
						(tmp.dmg ||
							(tmp.type == 1 &&
								tmp.y >= config.mapScale - config.snowBiomeTop)) &&
						tmp.active &&
						!tmp.isTeamObject(client.near) &&
						UTILS.getDist(tmp, nearTrap, 0, 0) <=
						client.near.scale + nearTrap.scale + tmp.scale,
				)
				.sort(function (a, b) {
					return (
						UTILS.getDist(a, client.near, 0, 2) -
						UTILS.getDist(b, client.near, 0, 2)
					);
				})[0];

			if (spike) {
				let pushAngle = Math.atan2(
					client.near.y2 - spike.y,
					client.near.x2 - spike.x,
				);

				let point = {
					x: client.near.x2 + Math.cos(pushAngle) * 30,
					y: client.near.y2 + Math.sin(pushAngle) * 60,
				};

				let dir = Math.atan2(point.y - Bot.y2, point.x - Bot.x2);

				client.sendWS("9", dir, 1);
			}
		}
	};

	client.replacer = function (findObj) {
		if (!client.enemy.length || !client.near) return;
		if (client.near.dist2 > 600) return;

		if (!findObj || !client.near) return;

		const objDist = UTILS.getDist(findObj, Bot, 0, 2);
		if (objDist > 350) return;

		const enemyToObjDist = UTILS.getDist(findObj, client.near, 0, 2);
		if (enemyToObjDist > 400) return;

		const enemyAngle = UTILS.getDirect(client.near, Bot, 2, 2);

		if (findObj && findObj.health < 280) {
			const spikePriorities = [9, 8, 7, 6];
			let spikeSlot = -1;

			for (const itemID of spikePriorities) {
				spikeSlot = Bot.items.findIndex((slotID) => slotID === itemID);
				if (spikeSlot !== -1) break;
			}

			if (spikeSlot !== -1 && client.near.dist2 <= 350) {
				// Dynamic spike placement around broken object
				const item = items.list[Bot.items[spikeSlot]];
				const tmpS = findObj.scale + item.scale + (item.placeOffset || 0);
				const angleStep = Math.PI / 16; // 11.25-degree steps
				let placedCount = 0;
				const maxPlace = 2;

				for (let i = 0; i < 32 && placedCount < maxPlace; i++) {
					const testAngle = i * angleStep;
					const tmpX = findObj.x + tmpS * Math.cos(testAngle);
					const tmpY = findObj.y + tmpS * Math.sin(testAngle);

					const angleToEnemy = Math.abs(
						UTILS.getAngleDist(enemyAngle, testAngle),
					);
					const goodForEnemy = angleToEnemy < Math.PI / 2;

					if (
						goodForEnemy &&
						objectManager.checkItemLocation(
							tmpX,
							tmpY,
							item.scale,
							0.6,
							item.id,
							false,
							Bot,
						)
					) {
						let canPlace = true;
						gameObjects.forEach((tmp) => {
							if (
								tmp.active &&
								UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) <
								item.scale +
								(tmp.blocker ? tmp.blocker : tmp.getScale(0.6, tmp.isItem))
							) {
								canPlace = false;
							}
						});

						if (canPlace) {
							client.place(spikeSlot, testAngle);
							placedCount++;
						}
					}
				}

				if (client.near.dist2 <= 180 && instakill) {
					instakill.canSpikeTick = true;
					setTimeout(() => {
						if (instakill.canSpikeTick) {
							instakill.spikeTickType(Bot, client);
							instakill.canSpikeTick = false;
						}
					}, 0);
				}
				return;
			}
		}

		if (objDist <= 300 && client.near.dist2 <= 450) {
			const weaponRange =
				items.weapons[client.near.primaryIndex || 5]?.range || 0;
			const canEnemyHit =
				enemyToObjDist <= weaponRange + client.near.scale * 1.8;

			if (canEnemyHit) {
				const trapPriorities = [15, 12, 11, 10];
				let trapSlot = -1;

				for (const itemID of trapPriorities) {
					trapSlot = Bot.items.findIndex((slotID) => slotID === itemID);
					if (trapSlot !== -1) break;
				}

				if (trapSlot !== -1) {
					// Dynamic trap placement around object
					const item = items.list[Bot.items[trapSlot]];
					const tmpS = findObj.scale + item.scale + (item.placeOffset || 0);
					const angleStep = Math.PI / 12; // 15-degree steps
					let placedCount = 0;
					const maxPlace = 1;

					for (let i = 0; i < 24 && placedCount < maxPlace; i++) {
						const testAngle = enemyAngle + i * angleStep - Math.PI;
						const tmpX = findObj.x + tmpS * Math.cos(testAngle);
						const tmpY = findObj.y + tmpS * Math.sin(testAngle);

						if (
							objectManager.checkItemLocation(
								tmpX,
								tmpY,
								item.scale,
								0.6,
								item.id,
								false,
								Bot,
							)
						) {
							let canPlace = true;
							gameObjects.forEach((tmp) => {
								if (
									tmp.active &&
									UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) <
									item.scale +
									(tmp.blocker
										? tmp.blocker
										: tmp.getScale(0.6, tmp.isItem))
								) {
									canPlace = false;
								}
							});

							if (canPlace) {
								client.place(trapSlot, testAngle);
								placedCount++;
							}
						}
					}
				}
			}
		}
	};

	// AutoBuy:
	client.AutoBuy = class {
		constructor(items) {
			this.items = items;
		}
		buyNext() {
			for (const [id, type] of this.items) {
				const find = type == 0 ? findID(hats, id) : findID(accessories, id);
				const isOwned = type == 0 ? Bot.skins[id] : Bot.tails[id];
				if (!find || isOwned) continue;
				if (Bot.points >= find.price) {
					client.sendWS("c", 1, id, type);
					return;
				}
				return;
			}
		}
	};
	client.autoBuy = new client.AutoBuy([
		[11, 1],
		[40, 0],
		[6, 0],
		[7, 0],
		[31, 0],
		[15, 0],
		[19, 1],
		[22, 0],
		[53, 0],
		[12, 0],
		[20, 0],
		[10, 0],
		[56, 0],
		[21, 1],
		[11, 0],
		[26, 0],
		[18, 1],
		[13, 1],
	]);
	// BuyEquip Or autoHatAcc:
	client.buyEquip = function (id, index, extra = 0) {
		let nID = extra;
		if (Bot.alive) {
			if (index == 0) {
				if (client._botSentHat == null) client._botSentHat = Bot.skins[id] ? id : nID;
				if (Bot.skins[id]) {
					if (Bot.latestSkin != id) {
						client.sendWS("c", 0, id, 0);
					}
				} else {
					let find = findID(hats, id);
					if (find) {
						if (Bot.points >= find.price) {
							client.sendWS("c", 1, id, 0);
							client.sendWS("c", 0, id, 0);
						} else if (Bot.latestSkin != nID) {
							client.sendWS("c", 0, nID, 0);
						}
					} else if (Bot.latestSkin != nID) {
						client.sendWS("c", 0, nID, 0);
					}
				}
			} else if (index == 1) {
				if (client._botSentTail == null) client._botSentTail = Bot.tails[id] ? id : 0;
				if (Bot.tails[id]) {
					if (Bot.latestTail != id) {
						client.sendWS("c", 0, id, 1);
					}
				} else {
					let find = findID(accessories, id);
					if (find) {
						if (Bot.points >= find.price) {
							client.sendWS("c", 1, id, 1);
							client.sendWS("c", 0, id, 1);
						} else if (Bot.latestTail != 0) {
							client.sendWS("c", 0, 0, 1);
						}
					} else if (Bot.latestTail != 0) {
						client.sendWS("c", 0, 0, 1);
					}
				}
			}
		}
	};
	// Bot biomeGear
	client.botBiomeGear = function (mover, returns) {
		if (Bot.inWater) {
			if (returns) return 31;
			client.buyEquip(31, 0);
		} else {
			if (Bot.y2 <= config.snowBiomeTop) {
				const hat = mover && (Bot.moveDir == null || Bot.antiTurretSpam) ? 22 : 15;
				if (returns) return hat;
				client.buyEquip(hat, 0);
			} else {
				const hat = mover && (Bot.moveDir == null || Bot.antiTurretSpam) ? 22 : 12;
				if (returns) return hat;
				client.buyEquip(hat, 0);
			}
		}
		if (returns) return 0;
	};

	client.scheduleTimeouts = {};
	client.scheduleAction = function (actions, delay = 0, tag = "default") {
		const nextTick = client.game.lastTick + client.game.tickRate;
		const sendTime = nextTick - (client.ping > 0 ? client.ping : client.game.tickRate / 2) / 2;
		const timing = sendTime - performance.now() + delay;
		if (client.scheduleTimeouts[tag]) workerClearTimeout(client.scheduleTimeouts[tag]);
		client.scheduleTimeouts[tag] = workerSetTimeout(() => {
			delete client.scheduleTimeouts[tag];
			actions();
		}, Math.max(0, timing));
	};

	client.hatChanger = function () {
		const near = client.near;
		const autoBreaker = client.botAutoBreaker;

		if (client.botForceStop) {
			client.buyEquip(Bot.empAnti ? 22 : 6, 0);
			client.accChanger();
			return;
		}
		if (Bot.empAnti) {
			client.buyEquip(22, 0);
			client.accChanger();
			return;
		}

		const bullTick = !client.botInTrap && Bot.shameCount > 1 && Bot.health > 5 && !Bot.empAnti && (game.tick - (client._botBullCooldown || 0)) > 3;

		if (clicks.left || clicks.right) {
			if (clicks.left) {
				client.buyEquip(
					Bot.primaryReloaded
						? configs.weaponGrind ? 40 : 7
						: near && near.dist2 <= 300 ? 6 : client.botBiomeGear(1, 1) || 6,
					0
				);
			} else {
				client.buyEquip(
					Bot.primaryReloaded && Bot.skinIndex !== 40 ? 40
						: near && near.dist2 <= 300 ? 6 : client.botBiomeGear(1, 1) || 6,
					0
				);
			}
		} else if (autoBreaker.active) {
			const useHammer = autoBreaker.useHammer(autoBreaker.target);
			const wpn = useHammer ? Bot.weapons[1] : Bot.weapons[0];
			if (
				autoBreaker.target &&
				autoBreaker.target.health > items.weapons[wpn].dmg * (items.weapons[wpn].sDmg || 1) &&
				Bot[(wpn < 9 ? "primary" : "secondary") + "Reloaded"]
			) {
				client.buyEquip(40, 0);
			} else {
				client.buyEquip(bullTick ? 7 : (near && near.dist2 <= 300 ? 6 : 22), 0);
			}
		} else {
			if (Bot.antiTurretSpam) {
				client.buyEquip(22, 0);
			} else if (bullTick) {
				client.buyEquip(7, 0);
			} else if (near && near.dist2 <= 300) {
				client.buyEquip(6, 0);
			} else {
				client.botBiomeGear(1);
			}
		}
		client.accChanger();
	};

	client.accChanger = function () {
		const near = client.near;
		if (
			Bot.weapons[0] !== 8 &&
			((client.botInTrap) || (clicks.left) || (near && near.dist2 < 300))
		) {
			client.buyEquip(configs.antiBullType ? 21 : 19, 1);
		} else {
			client.buyEquip(11, 1);
		}
	};
	//placesad:
	client.place = function (id, angle, type, tmpX, tmpY) {
		try {
			if (id == null) return;
			let item = items.list[Bot.items[id]];
			if (!item) return;
			const limit = config.isSandbox ? (id === 3 || id === 5 ? 299 : 99) : (item.group.limit || 99);
			const count = Bot.itemCounts[item.group.id];
			if (count == null || count < limit) {
				client.sendWS("z", Bot.items[id]);
				client.sendWS("F", 1, angle);
				client.sendWS("F", 0, angle);
				client.sendWS("z", Bot.weaponIndex, true);
			}
		} catch (e) { }
	};

	client.checkPlace = function (id, rad, tmpX, tmpY) {
		try {
			if (id == null) return;
			let item = items.list[Bot.items[id]];
			if (!item) return;
			if (!tmpX || !tmpY) {
				let tmpS = Bot.scale + item.scale + (item.placeOffset || 0);
				tmpX = Bot.x2 + tmpS * Math.cos(rad);
				tmpY = Bot.y2 + tmpS * Math.sin(rad);
			}
			if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false, Bot)) {
				client.place(id, rad, 0, tmpX, tmpY);
			}
		} catch (e) { }
	};

	client.preplacer = function () {
		if (!Bot || !Bot.alive) return;
		if (!configs.botPreplace) return;
		if (!client.near || client.near.dist2 > 269) return;

		const tick = client.game.tick;
		if (client.botPreplaceTick === tick) return;
		client.botPreplaceTick = tick;

		const near = client.near;
		const botPlacer = client.botPlacer;

		const replaceable = [];
		for (const obj of gameObjects) {
			if (!obj.active) continue;
			if (UTILS.getDist(obj, Bot, 0, 2) > 200) continue;
			if (obj.isTeamObject(Bot) && obj.hideFromEnemy) continue;
			if (!objectManager.canBeBroken || !objectManager.canBeBroken(obj)) continue;
			const hits = objectManager.hitsToBreak ? objectManager.hitsToBreak(obj, near) : Infinity;
			if (hits <= 4) {
				obj.hitsToBreak = hits;
				replaceable.push(obj);
			}
		}
		if (!replaceable.length) return;
		replaceable.sort((a, b) => a.hitsToBreak - b.hitsToBreak);

		if (!client.preplaceSimTick || client.preplaceSimTick !== game.tick) {
			const sim = new MovementSimulator(Bot, near);
			sim.continueTick(game.tickRate, Bot.moveDir, false);
			client.preplaceSimX = sim.x;
			client.preplaceSimY = sim.y;
			client.preplaceSimTick = game.tick;
		}
		const predX = client.preplaceSimX;
		const predY = client.preplaceSimY;

		if (!client.preplaceRangeTick || client.preplaceRangeTick !== game.tick) {
			client.preplaceRangeCache = {};
			client.preplaceRangeTick = game.tick;
		}

		const origX2 = Bot.x2, origY2 = Bot.y2;
		const origX3 = Bot.x3, origY3 = Bot.y3;
		Bot.x2 = predX; Bot.y2 = predY;
		Bot.x3 = predX; Bot.y3 = predY;

		let found = 0;
		for (const build of replaceable) {
			if (found > 2) break;

			const buildId = near.inTrap && ((options.autoPrePlace === "spike" && Bot.primaryReloaded) || build.sid !== near.inTrap.sid) ? 2 : 4;

			if (near.inTrap && build.sid === near.inTrap.sid && buildId === 4) {
				client.sendWS("z", Bot.items[buildId]);
				const step = Math.PI / 8;
				for (let a = 0; a < Math.PI * 2; a += step) client.sendWS("F", 1, a);
				client.sendWS("z", Bot.weaponIndex, true);
				found++;
				continue;
			}

			const cacheKey = `${build.sid}_${buildId}`;
			if (!client.preplaceRangeCache[cacheKey]) {
				botPlacer.calcPreplace(build, buildId);
				client.preplaceRangeCache[cacheKey] = botPlacer.preplaceRanges[buildId];
			} else {
				botPlacer.preplaceRanges[buildId] = client.preplaceRangeCache[cacheKey];
			}

			let angle = client.botFindPlacementAngle(buildId, build);
			let usedId = buildId;

			if (angle === null) {
				const fallbackId = buildId === 2 ? 4 : 2;
				const fbKey = `${build.sid}_${fallbackId}`;
				if (!client.preplaceRangeCache[fbKey]) {
					botPlacer.calcPreplace(build, fallbackId);
					client.preplaceRangeCache[fbKey] = botPlacer.preplaceRanges[fallbackId];
				} else {
					botPlacer.preplaceRanges[fallbackId] = client.preplaceRangeCache[fbKey];
				}
				angle = client.botFindPlacementAngle(fallbackId, build);
				usedId = fallbackId;
			}

			if (angle === null) continue;
			client.place(usedId, angle, 1);
			found++;
		}

		Bot.x2 = origX2; Bot.y2 = origY2;
		Bot.x3 = origX3; Bot.y3 = origY3;
	};

	client.autoReplacer = function (building, immediate = false) {
		if (!building || building.active === false) return;
		if (!client.near || client.near.dist2 > 300) return;
		if (!configs.botReplacer) return;

		const near = client.near;
		const botPlacer = client.botPlacer;
		const breakDir = UTILS.getDirect(building, Bot, 0, 2);

		const tick = client.game.tick;
		if (client.replacerRangeTick !== tick) {
			botPlacer.rangesUpdated[2] = false;
			botPlacer.rangesUpdated[4] = false;
			botPlacer.angleRanges(2);
			botPlacer.angleRanges(4);
			client.replacerRangeTick = tick;
		}
		const r2 = botPlacer.ranges[2];
		const r4 = botPlacer.ranges[4];

		const doPlace = () => {
			if (near.escaped) {
				if (r4?.length) client.place(4, botPlacer.closeToAngle(near.aim2, r4));
				client.checkPlace(4, near.aim2);
				client.checkPlace(4, near.aim2 + Math.PI / 12);
				client.checkPlace(4, near.aim2 - Math.PI / 12);
			} else if (client.botInTrap && UTILS.getDist(Bot, client.botTrapObj || building, 2, 0) <= 169) {
				const trapDir = UTILS.getDirect(client.botTrapObj || building, Bot, 0, 2);
				if (r2?.length) client.place(2, botPlacer.closeToAngle(trapDir, r2));
			} else {
				if (r4?.length) {
					const candidates = r4.map(([s, e]) => {
						const span = (e - s + Math.PI * 2) % (Math.PI * 2);
						const mid = botPlacer.normalizeAngle(s + span / 2);
						return { ang: mid, dist: UTILS.getAngleDist(mid, breakDir) };
					});
					candidates.sort((a, b) => a.dist - b.dist);
					for (const { ang } of candidates) client.place(4, ang);
				}
				if (r2?.length) client.place(2, botPlacer.closeToAngle(breakDir, r2));
			}
		};

		if (immediate) doPlace();
		else client.scheduleAction(doPlace, 0, `breplace_${building.sid}`);
	};
	client.autoMill = function () {
		if (client.breaking) return;
		if (!configs.botMills && options.botModeToggle !== "mills") return;
		if (client.stuckTicks > 2) return;
		const ox = Bot.oldPos?.x ?? Bot.x2, oy = Bot.oldPos?.y ?? Bot.y2;
		const baseDir = Math.atan2(oy - Bot.y2, ox - Bot.x2);
		const spread = 1.4;
		const angles = [-spread, 0, spread];
		for (let i = 0; i < angles.length; i++) {
			client.place(3, baseDir + angles[i]);
		}
	};
	//AHHHHHH
	client.optimisingAutoReloadFunction = function (weaponIndex) {
		return Bot.reloads[weaponIndex] > 0;
	};
	client.optimisingAutoReloadFunction_2 = function (weaponIndex) {
		return Bot.weaponIndex != weaponIndex || Bot.buildIndex > -1;
	};

	client.botSafeWalk = function (dir) {
		if (dir == null) return dir;
		if (!configs.safeWalk) return dir;
		const px = Bot.x2, py = Bot.y2;
		const speed = Bot.speed || config.playerSpeed;
		const lookDist = speed * 3 + Bot.scale;
		const nx = px + Math.cos(dir) * lookDist;
		const ny = py + Math.sin(dir) * lookDist;
		for (const obj of gameObjects) {
			if (!obj.active) continue;
			if (!(obj.dmg && !obj.isTeamObject(Bot)) && !(obj.type == 1 && obj.y >= 12000)) continue;
			const spikeR = obj.getScale ? obj.getScale() : obj.scale;
			const collisionR = spikeR + Bot.scale;
			if (UTILS.getDistance(nx, ny, obj.x, obj.y) <= collisionR) {
				const spikeDir = Math.atan2(obj.y - py, obj.x - px);
				const angleDiff = Math.abs(((dir - spikeDir) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
				if (angleDiff < Math.PI / 2) {
					return null;
				}
			}
		}
		return dir;
	};

	client.followPlayer = function () {
		if (!player || !Bot || !Bot.alive) return undefined;

		const SAFE_DIST = 100;
		const MIN_DIST = 100;
		const MAX_DIST = 100;

		const dx = player.x2 - Bot.x2;
		const dy = player.y2 - Bot.y2;
		const dist = Math.hypot(dx, dy);

		if (dist < MIN_DIST) {
			return Math.atan2(-dy, -dx);
		}

		if (dist > MAX_DIST) {
			return Math.atan2(dy, dx);
		}
	};

	client.isInRiver = function () {
		if (!Bot) return false;
		const riverMin = config.mapScale / 2 - config.riverWidth / 2;
		const riverMax = config.mapScale / 2 + config.riverWidth / 2;
		return Bot.y2 >= riverMin && Bot.y2 <= riverMax;
	};

	client.botPath = new (class BotCreatePath {
		constructor() {
			this.grid = [];
			this.baseGrid = [];
			this.foundPath = false;
			this.cachedBlockers = [];
			this.cacheKey = "";
			this.baseKey = "";
			this.lastGameObjectCount = -1;
			this.lastBotScale = -1;
		}
		getPaths(pos) {
			return [
				{ x: pos.x + 1, y: pos.y }, { x: pos.x + 1, y: pos.y + 1 },
				{ x: pos.x, y: pos.y + 1 }, { x: pos.x - 1, y: pos.y + 1 },
				{ x: pos.x - 1, y: pos.y }, { x: pos.x - 1, y: pos.y - 1 },
				{ x: pos.x, y: pos.y - 1 }, { x: pos.x + 1, y: pos.y - 1 },
			];
		}
		getScore(pos1, pos2) { return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y); }
		dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
		isRelevantBlocker(obj, Bot) {
			if (!obj) return false;
			if (!obj.isTeamObject(Bot) && (obj.dmg || obj.trap)) return true;
			if (!obj.ignoreCollision || obj.name === "teleporter") return true;
			return false;
		}
		makeBlockerCacheKey(Bot) {
			const px = (Bot.x2 ?? Bot.x3 ?? Bot.x ?? 0) | 0;
			const py = (Bot.y2 ?? Bot.y3 ?? Bot.y ?? 0) | 0;
			return gameObjects.length + "|" + px + "|" + py + "|" + (Bot.scale | 0);
		}
		rebuildBlockerCache(Bot) {
			this.cachedBlockers = [];
			for (let i = 0; i < gameObjects.length; i++) {
				const obj = gameObjects[i];
				if (!obj || !this.isRelevantBlocker(obj, Bot)) continue;
				const x = obj.x, y = obj.y;
				if (x == null || y == null) continue;
				this.cachedBlockers.push({ x, y, r: obj.getScale(0.6, obj.isItem) + Bot.scale });
			}
			this.cacheKey = this.makeBlockerCacheKey(Bot);
			this.lastGameObjectCount = gameObjects.length;
			this.lastBotScale = Bot.scale;
		}
		ensureBlockerCache(Bot) {
			const nextKey = this.makeBlockerCacheKey(Bot);
			if (this.cacheKey !== nextKey || this.lastGameObjectCount !== gameObjects.length || this.lastBotScale !== Bot.scale) {
				this.rebuildBlockerCache(Bot);
			}
		}
		stampCircle(grid, worldX, worldY, radius, centX, centY, griScale) {
			const gx = Math.round((worldX - centX) / griScale);
			const gy = Math.round((worldY - centY) / griScale);
			const cellRadius = Math.ceil(radius / griScale);
			const minY = Math.max(0, gy - cellRadius), maxY = Math.min(PF.gridSize - 1, gy + cellRadius);
			const minX = Math.max(0, gx - cellRadius), maxX = Math.min(PF.gridSize - 1, gx + cellRadius);
			const rr = radius * radius;
			for (let y = minY; y <= maxY; y++) {
				const wy = centY + griScale * y, dy = wy - worldY, dy2 = dy * dy;
				for (let x = minX; x <= maxX; x++) {
					const wx = centX + griScale * x, dx = wx - worldX;
					if (dx * dx + dy2 < rr) grid[y][x] = 1;
				}
			}
		}
		makeBaseGridKey(centX, centY, griScale, Bot) {
			const snap = griScale * 2;
			return Math.round(centX / snap) + "|" + Math.round(centY / snap) + "|" + griScale + "|" + Bot.scale + "|" + this.cacheKey;
		}
		buildBaseGrid(centX, centY, griScale, Bot) {
			this.ensureBlockerCache(Bot);
			this.baseGrid = new Array(PF.gridSize);
			const minPos = Bot.scale, maxPos = config.mapScale - Bot.scale;
			for (let y = 0; y < PF.gridSize; y++) {
				const row = new Uint8Array(PF.gridSize);
				const wy = centY + griScale * y;
				for (let x = 0; x < PF.gridSize; x++) {
					const wx = centX + griScale * x;
					if (wx < minPos || wx > maxPos || wy < minPos || wy > maxPos) row[x] = 1;
				}
				this.baseGrid[y] = row;
			}
			for (let i = 0; i < this.cachedBlockers.length; i++) {
				const obj = this.cachedBlockers[i];
				this.stampCircle(this.baseGrid, obj.x, obj.y, obj.r, centX, centY, griScale);
			}
			this.baseKey = this.makeBaseGridKey(centX, centY, griScale, Bot);
		}
		ensureBaseGrid(centX, centY, griScale, Bot) {
			this.ensureBlockerCache(Bot);
			const nextKey = this.makeBaseGridKey(centX, centY, griScale, Bot);
			if (this.baseKey !== nextKey || !this.baseGrid.length) this.buildBaseGrid(centX, centY, griScale, Bot);
		}
		cloneBaseGrid() {
			this.grid = new Array(PF.gridSize);
			for (let i = 0; i < PF.gridSize; i++) this.grid[i] = this.baseGrid[i].slice();
		}
		init(Bot, near, delPos, type) {
			let goalPos = { x: 0, y: 0 }, bestDist = Infinity;
			const centX = Math.round(Bot.x3 ?? Bot.x2 ?? Bot.x) - (PF.scale / 2);
			const centY = Math.round(Bot.y3 ?? Bot.y2 ?? Bot.y) - (PF.scale / 2);
			const griScale = PF.scale / PF.gridSize;
			const targetX = near.x2 - delPos.x, targetY = near.y2 - delPos.y;
			this.ensureBaseGrid(centX, centY, griScale, Bot);
			this.cloneBaseGrid();
			const botX = Bot.x2 ?? Bot.x3 ?? Bot.x;
			const botY = Bot.y2 ?? Bot.y3 ?? Bot.y;
			const botR2 = Bot.scale * Bot.scale;
			const nearX = near.x2 ?? near.x, nearY = near.y2 ?? near.y;
			const nearBlockR = near.scale + Bot.scale, nearBlockR2 = nearBlockR * nearBlockR;
			const targetR = griScale + 10, targetR2 = targetR * targetR;
			for (let i = 0; i < PF.gridSize; i++) {
				const posY = centY + griScale * i;
				for (let i2 = 0; i2 < PF.gridSize; i2++) {
					const posX = centX + griScale * i2;
					if (this.dist2(posX, posY, botX, botY) <= botR2) { this.grid[i][i2] = 0; continue; }
					const tdist2 = this.dist2(posX, posY, targetX, targetY);
					if (tdist2 <= targetR2) {
						if (tdist2 < bestDist) { bestDist = tdist2; goalPos = { x: i2, y: i }; }
						this.grid[i][i2] = 0; continue;
					}
					if (type === "auto push" && this.dist2(posX, posY, nearX, nearY) <= nearBlockR2) {
						this.grid[i][i2] = 1;
					}
				}
			}
			this.foundPath = false;
			const start = { x: Math.round(PF.gridSize / 2), y: Math.round(PF.gridSize / 2) };
			if (this.grid[start.y]?.[start.x] === 1) return { start: null, goal: null };
			if (bestDist === Infinity) return { start: null, goal: null };
			if (this.grid[goalPos.y]?.[goalPos.x] === 1) {
				const neighbors = this.getPaths(goalPos);
				let freeNeighbor = null;
				for (let i = 0; i < neighbors.length; i++) {
					const pos = neighbors[i];
					if (pos.x >= 0 && pos.y >= 0 && pos.x < PF.gridSize && pos.y < PF.gridSize && this.grid[pos.y]?.[pos.x] === 0) {
						freeNeighbor = pos; break;
					}
				}
				if (freeNeighbor) goalPos = freeNeighbor;
				else return { start: null, goal: null };
			}
			return { start, goal: goalPos };
		}
		calc(Bot, near, delPos, type) {
			const data = this.init(Bot, near, delPos, type);
			if (!data.start || !data.goal) return { paths: [], attempts: 0 };
			const start = data.goal, goal = data.start;
			let search = { x: start.x, y: start.y };
			const paths = [{ x: search.x, y: search.y, score: this.getScore(search, goal), seek: 0, hop: 0, start: true }];
			let searchPaths = this.getPaths(search);
			if (this.grid[start.y][start.x] === 1 || this.grid[goal.y][goal.x] === 1) return { paths: [], attempts: 0 };
			const visited = new Uint8Array(PF.gridSize * PF.gridSize);
			const idx = (x, y) => y * PF.gridSize + x;
			visited[idx(search.x, search.y)] = 1;
			for (let i = 0; i < searchPaths.length; i++) {
				const sp = searchPaths[i];
				if (sp.x < 0 || sp.y < 0 || sp.x > PF.gridSize - 1 || sp.y > PF.gridSize - 1) continue;
				if (this.grid[sp.y][sp.x] === 1) continue;
				const id = idx(sp.x, sp.y);
				if (visited[id]) continue;
				visited[id] = 1;
				paths.push({ x: sp.x, y: sp.y, score: this.getScore(sp, goal), seek: 0, hop: 1 });
			}
			const foundPaths = [];
			let i = 0;
			const startTime = performance.now();
			const griScale = PF.scale / PF.gridSize;
			while (performance.now() - startTime <= 1 && i < 500) {
				if (this.foundPath || (search.x === goal.x && search.y === goal.y)) {
					if (!this.foundPath) {
						this.foundPath = true;
						foundPaths.push({ x: Bot.x2 - (PF.scale / 2) + griScale * search.x, y: Bot.y2 - (PF.scale / 2) + griScale * search.y });
					}
					let nearPath = null;
					for (let j = 0; j < paths.length; j++) {
						const a = paths[j];
						if ((a.seek === 1 || a.start) && Math.abs(a.x - search.x) <= 1 && Math.abs(a.y - search.y) <= 1) {
							if (!nearPath || a.hop < nearPath.hop) nearPath = a;
						}
					}
					if (nearPath) {
						search = { x: nearPath.x, y: nearPath.y };
						nearPath.seek = 2;
						foundPaths.push({ x: Bot.x2 - (PF.scale / 2) + griScale * search.x, y: Bot.y2 - (PF.scale / 2) + griScale * search.y });
						if (nearPath.start) break;
					} else break;
				} else {
					let nearPath = null;
					for (let j = 0; j < paths.length; j++) {
						const a = paths[j];
						if (a.seek === 0 && (!nearPath || a.score < nearPath.score)) nearPath = a;
					}
					if (nearPath) {
						search = { x: nearPath.x, y: nearPath.y };
						nearPath.seek = 1;
						searchPaths = this.getPaths(search);
						const hop = nearPath.hop + 1;
						for (let j = 0; j < searchPaths.length; j++) {
							const sp = searchPaths[j];
							if (sp.x < 0 || sp.y < 0 || sp.x > PF.gridSize - 1 || sp.y > PF.gridSize - 1) continue;
							if (this.grid[sp.y][sp.x] === 1) continue;
							const id = idx(sp.x, sp.y);
							if (visited[id]) continue;
							visited[id] = 1;
							paths.push({ x: sp.x, y: sp.y, score: this.getScore(sp, goal), seek: 0, hop });
						}
					} else break;
				}
				i++;
			}
			return { paths: foundPaths, attempts: i };
		}
	})();

	client.updateMoveDir = function (debug) {
		if (debug) return debug;
		if (!client.Bot || !client.Bot.alive) return undefined;
		const Bot = client.Bot;

		// Bot mode: mousemove
		if (options.botModeToggle === "mousemove") {
			const mpos = typeof mouseWorldPos === "function" ? mouseWorldPos() : mouseWorldPos;
			if (!mpos || typeof mpos.x !== "number") return undefined;
			const dx = mpos.x - Bot.x2, dy = mpos.y - Bot.y2;
			const dist = Math.hypot(dx, dy);
			if (dist < 30) return undefined;
			return Math.atan2(dy, dx);
		}

		// Bot mode: follow
		if (client.botMode === "follow" || options.botModeToggle === "follow") {
			if (!player || !player.alive) return undefined;
			const dx = player.x2 - Bot.x2, dy = player.y2 - Bot.y2;
			const dist = Math.hypot(dx, dy);
			if (dist < 80) return undefined;
			return Math.atan2(dy, dx);
		}

		// Bot mode: circle
		if (client.botMode === "circle" || options.botModeToggle === "circle") {
			if (!player || !player.alive) return undefined;
			const orbitR = 160;
			const dx = Bot.x2 - player.x2, dy = Bot.y2 - player.y2;
			const currentAngle = Math.atan2(dy, dx);
			const targetAngle = currentAngle + 0.12; // orbit speed
			const tx = player.x2 + Math.cos(targetAngle) * orbitR;
			const ty = player.y2 + Math.sin(targetAngle) * orbitR;
			return Math.atan2(ty - Bot.y2, tx - Bot.x2);
		}

		// Bot mode: idle
		if (options.botModeToggle === "idle") return undefined;

		if (client.synchit && client.syncMoveDir != null) return client.syncMoveDir;

		const borderDir = client.isAtBorder();
		if (borderDir !== undefined) { Bot.moveDir = borderDir; return borderDir; }

		const px = Bot.x2, py = Bot.y2;
		const lastX = client.lastPos?.x ?? px, lastY = client.lastPos?.y ?? py;
		const moveDist = Math.hypot(px - lastX, py - lastY);
		client.lastPos = { x: px, y: py };
		const speedMult = Bot.spdMult || 1;
		if (moveDist < Math.max(1.5, 2.2 * speedMult)) client.stuckTicks++;
		else client.stuckTicks = 0;

		if (client.breaking && Bot.moveDir !== undefined) return Bot.moveDir;

		// Circle mode
		if (configs.botCircle) {
			const i = bottics.indexOf(client), n = bottics.length;
			const ang = (2 * Math.PI * i) / n;
			const mainPlayer = window.player || player;
			if (!mainPlayer || !mainPlayer.alive) { Bot.moveDir = undefined; return undefined; }
			const tx = mainPlayer.x2 + 400 * Math.cos(ang), ty = mainPlayer.y2 + 400 * Math.sin(ang);
			Bot.moveDir = Math.atan2(ty - py, tx - px);
			return Bot.moveDir;
		}

		// mills mode: wander with pathfinder, non-intersecting sectors per bot
		if (configs.botMills || options.botModeToggle === "mills") {
			const idx = bottics.indexOf(client);
			const n = Math.max(1, bottics.length);
			const sectorAngle = (2 * Math.PI * idx) / n;
			const sectorSpread = (Math.PI * 2) / n;
			if (!client.millsTarget || client.stuckTicks > 4 ||
				UTILS.getDist(Bot, client.millsTarget, 2, 0) < 60) {
				const margin = 200, mapS = config.mapScale;
				const angle = sectorAngle + (Math.random() - 0.5) * sectorSpread * 0.8;
				const radius = (mapS / 2 - margin) * (0.4 + Math.random() * 0.5);
				client.millsTarget = {
					x2: Math.max(margin, Math.min(mapS - margin, mapS / 2 + Math.cos(angle) * radius)),
					y2: Math.max(margin, Math.min(mapS - margin, mapS / 2 + Math.sin(angle) * radius)),
				};
				client.stuckTicks = 0;
			}
			if (typeof PF !== "undefined") {
				try {
					const result = client.botPath.calc(Bot, client.millsTarget, { x: 0, y: 0 }, "combat");
					if (result.paths && result.paths.length > 1) {
						const next = result.paths[result.paths.length - 2];
						Bot.moveDir = Math.atan2(next.y - py, next.x - px);
						return Bot.moveDir;
					}
				} catch (_) { }
			}
			Bot.moveDir = Math.atan2(client.millsTarget.y2 - py, client.millsTarget.x2 - px);
			let closestOb = null, closestDist = Infinity;
			for (let i = 0; i < gameObjects.length; i++) {
				const obj = gameObjects[i];
				if (!obj.active || obj.ignoreCollision) continue;
				if (obj.isTeamObject(Bot) && (obj.name === "windmill" || obj.name === "faster windmill" || obj.name === "power mill")) continue;
				const d = UTILS.getDist(obj, Bot, 0, 2);
				const orad = (obj.getScale ? obj.getScale(0.6, obj.isItem) : obj.scale || 0) + Bot.scale + 15;
				if (d < orad && d < closestDist) { closestDist = d; closestOb = obj; }
			}
			if (closestOb) {
				const objAngle = Math.atan2(closestOb.y - py, closestOb.x - px);
				const angleDiff = ((Bot.moveDir - objAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
				const steerAmount = Math.min(Math.PI / 2, (closestOb.scale || 50) / closestDist * 1.5);
				Bot.moveDir = objAngle + (angleDiff >= 0 ? 1 : -1) * (Math.PI / 2 + steerAmount);
			}
			Bot.moveDir = client.botSafeWalk(Bot.moveDir);
			return Bot.moveDir;
		}

		// autoplay / combat: pathfind to nearest enemy
		if (options.botModeToggle === "combat" || options.botModeToggle === "autoplay" || !options.botModeToggle) {
			if (client.enemy.length && client.near) {
				const near = client.near;
				const wpnRange = Bot.weapons[0] != null ? (items.weapons[Bot.weapons[0]]?.range || 110) : 110;
				const engageDist = wpnRange + Bot.scale + near.scale - 10;
				const distToEnemy = UTILS.getDist(near, Bot, 2, 2);

				if (distToEnemy <= engageDist * 0.7) {
					// too close: strafe sideways
					const perp = UTILS.getDirect(near, Bot, 2, 2) + Math.PI / 2;
					Bot.moveDir = perp;
					return perp;
				}

				// Use CreatePath if PF is available
				if (typeof PF !== "undefined") {
					try {
						const result = client.botPath.calc(Bot, near, { x: 0, y: 0 }, "combat");
						if (result.paths && result.paths.length > 1) {
							const nextStep = result.paths[result.paths.length - 2];
							const dir = Math.atan2(nextStep.y - py, nextStep.x - px);
							Bot.moveDir = dir;
							return dir;
						}
					} catch (e) { }
				}

				// Fallback: direct path
				const dir = Math.atan2(near.y2 - py, near.x2 - px);
				Bot.moveDir = dir;
				return dir;
			} else {
				if (!Bot.moveDir || client.stuckTicks > 3) {
					Bot.moveDir = Math.random() * Math.PI * 2 - Math.PI;
					client.stuckTicks = 0;
				}
				return Bot.moveDir;
			}
		}

		const mainPlayer = window.player || player;
		if (!mainPlayer || !mainPlayer.alive) { Bot.moveDir = undefined; return undefined; }
		const dxp = mainPlayer.x2 - px, dyp = mainPlayer.y2 - py;
		const distp = Math.hypot(dxp, dyp);
		const minDist = 70 * speedMult, maxDist = 140 * speedMult;
		if (distp > minDist && distp < maxDist) { Bot.moveDir = undefined; return undefined; }
		const tx = distp <= minDist ? mainPlayer.x2 - dxp * 2 : mainPlayer.x2;
		const ty = distp <= minDist ? mainPlayer.y2 - dyp * 2 : mainPlayer.y2;
		let dir = Math.atan2(ty - py, tx - px);
		const LOOK = 250;
		const cosD = Math.cos(dir), sinD = Math.sin(dir);
		let steerOb = null, steerT = Infinity;
		for (let o = 0; o < gameObjects.length; o++) {
			const ob = gameObjects[o];
			if (!ob.active || ob.ignoreCollision) continue;
			if (ob.isTeamObject(Bot) && (ob.ignoreCollision || ob.name === "windmill" || ob.name === "faster windmill" || ob.name === "power mill")) continue;
			const orad = (ob.getScale ? ob.getScale(0.6, ob.isItem) : ob.scale || 0) + Bot.scale + 8;
			const odx = ob.x - px, ody = ob.y - py;
			const od2 = odx * odx + ody * ody;
			if (od2 > LOOK * LOOK) continue;
			const proj = odx * cosD + ody * sinD;
			if (proj < 0 || proj > LOOK) continue;
			const perp = Math.abs(odx * sinD - ody * cosD);
			if (perp < orad && proj < steerT) {
				steerT = proj;
				steerOb = ob;
			}
		}
		if (steerOb) {
			const od = Math.sqrt((steerOb.x - px) ** 2 + (steerOb.y - py) ** 2);
			if (steerOb.dmg && !steerOb.isTeamObject(Bot) && od < (steerOb.scale || 30) + Bot.scale + 15) {
				Bot.moveDir = undefined;
				return undefined;
			}
			const odir = Math.atan2(steerOb.y - py, steerOb.x - px);
			const cross = cosD * (steerOb.y - py) - sinD * (steerOb.x - px);
			const steerSide = cross >= 0 ? -1 : 1;
			const urgency = Math.max(0.3, Math.min(1.0, 1 - steerT / LOOK));
			dir = odir + steerSide * (Math.PI / 2.5 + urgency * 0.3);
		}
		if (client._smoothDir != null) {
			let diff = dir - client._smoothDir;
			while (diff > Math.PI) diff -= Math.PI * 2;
			while (diff < -Math.PI) diff += Math.PI * 2;
			dir = client._smoothDir + diff * 0.35;
		}
		client._smoothDir = dir;
		Bot.moveDir = client.botSafeWalk(dir);
		return Bot.moveDir;
	};

	client.isAtBorder = function () {
		const BORDER = 14700;
		const SAFE = 500;

		if (!Bot) return undefined;

		const x = Bot.x2;
		const y = Bot.y2;

		if (x >= BORDER) return Math.PI;
		if (x <= SAFE) return 0;
		if (y >= BORDER) return -Math.PI / 2;
		if (y <= SAFE) return Math.PI / 2;

		return undefined;
	};

	client.breakObstacles = function () {
		if (!Bot || !Bot.alive) return false;

		const px = Bot.x2;
		const py = Bot.y2;
		const breakableTypes = [2, 3];

		for (let i = 0; i < gameObjects.length; i++) {
			const o = gameObjects[i];
			if (!o.active || o.ignoreCollision) continue;
			if (!o.owner) continue;
			if (!breakableTypes.includes(o.itemID)) continue;

			const dx = o.x - px;
			const dy = o.y - py;
			const dist = Math.hypot(dx, dy);

			const objR = (o.getScale ? o.getScale(0.6, o.isItem) : o.scale) || 50;
			const minDist = objR + Bot.scale + 15;

			if (dist < minDist) {
				if (!client.breaking) {
					client.breaking = true;
				}

				const breakAngle = client.updateDir();
				if (breakAngle !== undefined) {
					client.selectWeapon(Bot.weapons[0]);
					client.buyEquip(40, 0);
					client.buyEquip(19, 1);
					client.sendWS("d", 1, breakAngle, 1);
					Bot.moveDir = breakAngle;
					return true;
				}

				return true;
			}
		}

		client.breaking = false;
		return false;
	};

	client.predictAim = function (target) {
		if (!target || !Bot || !Bot.alive) return null;
		const wpn = Bot.weapons[0] != null ? items.weapons[Bot.weapons[0]] : null;

		// melee: aim directly at predicted position
		// Use x3/y3 (server-extrapolated next pos) as velocity source
		const vx = (target.x3 ?? target.x2) - target.x2;
		const vy = (target.y3 ?? target.y2) - target.y2;

		if (!wpn || !wpn.projSpd) {
			// Melee: lead by 1 tick of enemy movement
			const px = target.x2 + vx;
			const py = target.y2 + vy;
			return Math.atan2(py - Bot.y2, px - Bot.x2);
		}

		// Projectile weapon: iterative intercept solve
		// t = dist / projSpeed (in game units per tick)
		const projSpd = wpn.projSpd; // units per ms
		const tickMs = client.game.tickRate || 113;
		// convert to units per tick
		const projSpdPerTick = projSpd * (tickMs / 1000);

		let px = target.x2, py = target.y2;
		// 4 iterations converges well
		for (let i = 0; i < 4; i++) {
			const dx = px - Bot.x2, dy = py - Bot.y2;
			const dist = Math.sqrt(dx * dx + dy * dy);
			const ticks = dist / projSpdPerTick;
			px = target.x2 + vx * ticks;
			py = target.y2 + vy * ticks;
		}

		return Math.atan2(py - Bot.y2, px - Bot.x2);
	};

	client.updateDir = function (debug) {
		if (debug != null) return debug;

		if (client.breaking) {
			for (const obj of gameObjects) {
				if (!obj.active || obj.ignoreCollision) continue;
				const dx = obj.x - Bot.x2;
				const dy = obj.y - Bot.y2;
				if (Math.abs(dx) > 180 || Math.abs(dy) > 180) continue;

				const objR =
					(obj.getScale ? obj.getScale(0.6, obj.isItem) : obj.scale) || 50;
				const minDist = objR + Bot.scale + 15;
				if (Math.hypot(dx, dy) < minDist) {
					return Math.atan2(dy, dx);
				}
			}
			return;
		}

		if (
			(client.syncing || client.synchit || instakill.isTrue) &&
			client.enemy.length &&
			client.near
		) {
			return client.predictAim(client.near) ?? UTILS.getDirect(client.near, Bot, 2, 2);
		}

		if (client.holdRight) {
			const m = typeof mouseWorldPos === "function" ? mouseWorldPos() : mouseWorldPos;
			if (m && typeof m.x === "number" && typeof m.y === "number") {
				return Math.atan2(m.y - Bot.y2, m.x - Bot.x2);
			}
		}

		if (client.enemy.length && client.near) {
			return client.predictAim(client.near) ?? UTILS.getDirect(client.near, Bot, 2, 2);
		}

		return UTILS.getDirect(player, Bot, 0, 2);
	};

	client.syncHit = function () {
		if (!Bot || !Bot.alive) {
			client.synchit = false;
			return;
		}

		if (!client.enemy.length) {
			client.synchit = false;
			return;
		}

		client.synchit = true;

		const primaryWeapon = Bot.weapons[0];

		if (Bot.reloads[primaryWeapon] > 0) {
			client.synchit = false;
			return;
		}

		if (Bot.weaponIndex !== primaryWeapon || Bot.buildIndex > -1) {
			client.selectWeapon(primaryWeapon);
		}

		client.buyEquip(7, 0);
		client.buyEquip(21, 1);

		const angle = client.updateDir();
		client.sendWS("d", 1, angle);

		client.game.tickBase(() => {
			client.synchit = false;
		}, 1);
	};

	client.checkSelection = function () {
		if (!client.inGame || !Bot || !Bot.alive) return;

		const primary = Bot.weapons[0];
		const secondary = Bot.weapons[1];

		if (
			secondary !== undefined &&
			Bot.weaponIndex === secondary &&
			Bot.reloads[secondary] === 0
		) {
			client.selectWeapon(primary);
		}
	};

	client.onmessage = function (message) {
		let parsed = EXP.receive(client, message.data);
		if (!parsed) return;
		let type = parsed.type;
		let data = parsed.args;
		// SetupGame:
		if (type == "C") {
			BOTSID = data[0];
			if (!client.firstOpen) {
				textManager.showText(
					player.x,
					player.y - 40,
					26,
					0,
					3000,
					`Bot [${client.botCount}] Has Been Connected with a sid of {${BOTSID}}`,
					"orange",
				);
				client.firstOpen = true;
			}
		}
		// PingSocketResponse:
		if (type == "0") {
			let pingTime = Date.now() - client.lastPing;
			client.ping = pingTime;
		}

		// KillPlayer:
		if (type == "P") {
			client.inGame = false;

			// Auto-respawn for private server
			if (mainSocket && mainSocket.url && mainSocket.url.includes('tw-moo-privateserver.onrender.com')) {
				// Wait before respawning to avoid being kicked
				setTimeout(() => {
					if (!client.inGame) {
						client.spawn();
					}
				}, 3000); // Wait 3 seconds before respawning
			} else {
				// Normal respawn for other servers
				setTimeout(() => {
					if (!client.inGame) {
						client.spawn();
					}
				}, 1000); // Wait 1 second for normal servers
			}
		}
		// AddPlayer:
		if (type == "D") {
			let isYou = data[1];
			data = data[0];

			let tmpPlayer = client.findPlayerByID(data[0]);
			if (!tmpPlayer) {
				tmpPlayer = new Player(
					data[0],
					data[1],
					config,
					UTILS,
					projectileManager,
					objectManager,
					client.players,
					client.ais,
					items,
					hats,
					accessories,
				);
				client.players.push(tmpPlayer);
			}

			const savedPlayer = window.player;

			tmpPlayer.spawn(null);
			tmpPlayer.visible = false;
			tmpPlayer.oldPos = { x2: undefined, y2: undefined };
			tmpPlayer.x2 = undefined;
			tmpPlayer.y2 = undefined;
			tmpPlayer.x3 = undefined;
			tmpPlayer.y3 = undefined;
			tmpPlayer.setData(data);

			if (isYou) {
				window.player = savedPlayer;
				client.Bot = tmpPlayer;
				Bot = client.Bot;
				Bot.isBot = true;
			}
		}
		// RemovePlayer:
		if (type == "E") {
			for (let i = 0; i < client.players.length; i++) {
				if (client.players[i].id == data[0]) {
					client.players.splice(i, 1);
					break;
				}
			}
		}
		// ChatUpdates:
		if (type === "6") {
			const sid = data[0];
			const msg = data[1];

			if (sid === Bot?.sid) return;
			if (typeof msg !== "string") return;

			const clean = msg.trim();
			if (!clean) return;

			if (sid === player.sid) {
				client.sendWS("6", clean);
			}
		}
		// UpdatePlayers:
		if (type == "a") {
			client.lastUpdateTime = client.lastUpdateTime || 0;
			const now = performance.now();

			if (now - client.lastUpdateTime < 33) {
				return;
			}
			client.lastUpdateTime = now;
			data = data[0];
			client.enemy = [];
			client.players.forEach((tmp) => {
				if (tmp.updated) tmp.updated = false;
			});
			client.botInTrap = false;
			client.botTrapObj = null;

			if (Bot && Bot.alive) {
				for (let thing in Bot.damageSources) Bot.damageSources[thing] = 0;
				Bot.damageThreat = 0;
				client.botForceStop = false;
				for (let i = 0; i < gameObjects.length; i++) {
					const t = gameObjects[i];
					if (!t?.active || !t.owner) continue;

					const isTrap = t.trap || (t.group && t.group.id === 5);
					if (!isTrap) continue;
					if (!isTeamMember(t.owner)) continue;

					const dx = t.x - Bot.x2;
					const dy = t.y - Bot.y2;
					const dist = Math.hypot(dx, dy);

					const trapRadius = t?.scale;

					if (dist <= trapRadius + 50) {
						client.botInTrap = true;
						client.botTrapObj = t;
						break;
					}
				}
			}

			for (let i = 0; i < data.length;) {
				tmpObj = client.findPlayerBySID(data[i]);
				if (tmpObj) {
					tmpObj.t1 = tmpObj.t2 == undefined ? client.game.lastTick : tmpObj.t2;
					tmpObj.t2 = client.game.lastTick;
					tmpObj.oldPos.x2 = tmpObj.x2;
					tmpObj.oldPos.y2 = tmpObj.y2;
					tmpObj.x1 = tmpObj.x;
					tmpObj.y1 = tmpObj.y;
					tmpObj.x2 = data[i + 1];
					tmpObj.y2 = data[i + 2];
					tmpObj.x3 = tmpObj.x2 + (tmpObj.x2 - tmpObj.oldPos.x2);
					tmpObj.y3 = tmpObj.y2 + (tmpObj.y2 - tmpObj.oldPos.y2);
					tmpObj.d1 = tmpObj.d2 == undefined ? data[i + 3] : tmpObj.d2;
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
					if (tmpObj.update) tmpObj.update(client.game.tickSpeed);
					tmpObj.dist2 = UTILS.getDist(tmpObj, Bot, 2, 2);
					tmpObj.aim2 = UTILS.getDirect(tmpObj, Bot, 2, 2);
					tmpObj.dist3 = UTILS.getDist(tmpObj, Bot, 3, 3);
					tmpObj.aim3 = UTILS.getDirect(tmpObj, Bot, 3, 3);
					if (tmpObj.skinIndex == 45 && tmpObj.shameTimer <= 0) {
						tmpObj.addShameTimer?.();
					}
					if (tmpObj.oldSkinIndex == 45 && tmpObj.skinIndex != 45) {
						tmpObj.shameTimer = 0;
						tmpObj.shameCount = 0;
					}
					if (tmpObj.weaponIndex < 9) {
						tmpObj.primaryIndex = tmpObj.weaponIndex;
						tmpObj.primaryVariant = tmpObj.weaponVariant;
					} else {
						tmpObj.secondaryIndex = tmpObj.weaponIndex;
						tmpObj.secondaryVariant = tmpObj.weaponVariant;
					}
					if (tmpObj.manageReload) tmpObj.manageReload();
					if (!tmpObj.isTeam(Bot) && tmpObj.sid !== Bot.sid) {
						client.enemy.push(tmpObj);
					}
				}
				i += 13;
			}
			// Also consider the main player as a potential enemy (they're not in client.players)
			if (player && player.alive && player.x2 != null) {
				if (!player.isTeam?.(Bot) && !(Bot.team && player.team && Bot.team === player.team)) {
					player.dist2 = UTILS.getDist(player, Bot, 2, 2);
					player.aim2 = UTILS.getDirect(player, Bot, 2, 2);
					client.enemy.push(player);
				}
			}

			if (client.inGame || Bot.alive) {
				client.autoMill();

				// Set near FIRST so autoplace/autobreak have a valid target
				if (client.enemy.length) {
					client.near = client.enemy.sort(
						(a, b) => a.dist2 - b.dist2,
					)[0];
				} else {
					client.near = null;
				}

				client.processBotAdvHeal();
				if (configs.botAutoBreak) {
					client.botAutoBreaker.run();
				}
				if (configs.botAutoPlace) {
					client.botAutoPlace();
				}
				if (configs.botPreplace) {
					client.preplacer();
				}
				if (configs.botReplacer && client.near && client.near.dist2 <= 300) {
					for (let i = 0; i < gameObjects.length; i++) {
						const obj = gameObjects[i];
						if (!obj.active || !obj.isTeamObject(Bot)) continue;
						if (UTILS.getDist(obj, Bot, 0, 2) > 200) continue;
						const htb = objectManager.hitsToBreak(obj, client.near);
						if (htb <= 2) {
							client.autoReplacer(obj, htb === 1);
							break;
						}
					}
				}

				if (configs.botObstacleBreak) client.botBreakObstacles();
				if (configs.botAutoBuy) client.botAutoBuy();
				if (client.game.tickQueue[client.game.tick]) {
					client.game.tickQueue[client.game.tick].forEach((action) => {
						action();
					});
					client.game.tickQueue[client.game.tick] = null;
				}
				if (player.team) {
					if (Bot.team != player.team && client.game.tick % 9 == 0) {
						Bot.team && client.sendWS("N");
						client.sendWS("b", player.team);
					}
				}
				if (
					!client.botInTrap &&
					configs.botAutoHat &&
					!client.synchit &&
					!client.breaking
				) {
					client.hatChanger();
				}

				if (configs.autoSyncKill && client.near && client.near.health > 0 && !instakill?.isTrue) {
					const enemy = client.near;
					const soldierDef = enemy.skinIndex == 6 ? 0.75 : 1;
					let totalDmg = 0;
					const readyParticipants = [];
					const pWpn = items.weapons[player?.weapons?.[0]];
					if (pWpn && player?.alive && player.reloads?.[player.weapons[0]] == 0) {
						const pDist = UTILS.getDist(player, enemy, 0, 2);
						if (pDist <= pWpn.range + enemy.scale * 1.8) {
							const pVar = player.primaryVariant != null ? config.weaponVariants[player.primaryVariant].val : 1;
							totalDmg += pWpn.dmg * pVar * (player.skinIndex == 7 || player.skins?.[7] ? 1.5 : 1);
							readyParticipants.push({ type: "player" });
						}
					}
					bottics.forEach(bc => {
						if (!bc.Bot || !bc.Bot.alive) return;
						const bw = items.weapons[bc.Bot.weapons?.[0]];
						if (!bw || bc.Bot.reloads?.[bc.Bot.weapons[0]] != 0) return;
						const bDist = UTILS.getDist(bc.Bot, enemy, 2, 2);
						if (bDist > bw.range + enemy.scale * 1.8) return;
						const bVar = bc.Bot.primaryVariant != null ? config.weaponVariants[bc.Bot.primaryVariant].val : 1;
						totalDmg += bw.dmg * bVar * (bc.Bot.skinIndex == 7 ? 1.5 : 1);
						readyParticipants.push({ type: "bot", bc });
					});
					totalDmg *= soldierDef;
					if (totalDmg >= enemy.health && readyParticipants.length >= 2) {
						readyParticipants.forEach(p => {
							if (p.type === "player") {
								const aimAngle = enemy.aim2 ?? Math.atan2(enemy.y2 - player.y2, enemy.x2 - player.x2);
								storeEquip(7, 0);
								storeEquip(21, 1);
								selectWeapon(player.weapons[0]);
								packet("D", aimAngle);
								if (!my.autoGathering) sendAutoGather();
							} else {
								const bc = p.bc;
								const bAngle = Math.atan2(enemy.y2 - bc.Bot.y2, enemy.x2 - bc.Bot.x2);
								bc.selectWeapon(bc.Bot.weapons[0]);
								bc.buyEquip(7, 0);
								bc.buyEquip(21, 1);
								bc.sendWS("D", bAngle);
								bc.hitting = true;
							}
						});
						game.tickBase(() => {
							readyParticipants.forEach(p => {
								if (p.type === "player") storeEquip(6, 0);
								else p.bc.buyEquip(6, 0);
							});
						}, 1);
					}
				}

				if (client.holdLeft || client.holdRight) client.hitting = true;
				if (client.hitting && !client.syncing) {
					if (!client.near && !client.holdLeft && !client.holdRight && !client.breaking && !client.botAutoBreaker?.active) {
						client.hitting = false;
					} else {
						client.sendAutoGather();
					}
				}
				if (Bot.weapons[1] && !client.botAutoBreaker?.active) {
					if (
						Bot.reloads[Bot.weapons[0]] == 0 &&
						Bot.reloads[Bot.weapons[1]] == 0
					) {
						if (!client.reloaded) {
							client.reloaded = true;
							// If holding right-click and has hammer, stay on hammer
							if (client.holdRight && Bot.weapons[1] === 10) {
								if (Bot.weaponIndex != Bot.weapons[1] || Bot.buildIndex > -1) {
									client.selectWeapon(Bot.weapons[1]);
								}
							} else {
								let fastSpeed =
									items.weapons[Bot.weapons[0]].spdMult <
										items.weapons[Bot.weapons[1]].spdMult
										? 1
										: 0;
								if (
									Bot.weaponIndex != Bot.weapons[fastSpeed] ||
									Bot.buildIndex > -1
								) {
									client.selectWeapon(Bot.weapons[fastSpeed]);
								}
							}
						}
					} else {
						client.reloaded = false;
						// If holding right-click and has hammer, prioritize hammer
						if (client.holdRight && Bot.weapons[1] === 10) {
							if (client.optimisingAutoReloadFunction(Bot.weapons[1])) {
								if (client.optimisingAutoReloadFunction_2(Bot.weapons[1])) {
									client.selectWeapon(Bot.weapons[1]);
								}
							}
						} else if (client.optimisingAutoReloadFunction(Bot.weapons[0])) {
							if (client.optimisingAutoReloadFunction_2(Bot.weapons[0])) {
								client.selectWeapon(Bot.weapons[0]);
							}
						} else if (client.optimisingAutoReloadFunction(Bot.weapons[1])) {
							if (client.optimisingAutoReloadFunction_2(Bot.weapons[1])) {
								client.selectWeapon(Bot.weapons[1]);
							}
						}
					}
				}
				client.checkSelection();

				if (client.near?.inTrap) {
					const nearTrap = client.near.inTrap;
					let spike = gameObjects
						.filter(
							(tmp) =>
								(tmp.dmg ||
									(tmp.type == 1 &&
										tmp.y >= config.mapScale - config.snowBiomeTop)) &&
								tmp.active &&
								!tmp.isTeamObject(client.near) &&
								UTILS.getDist(tmp, nearTrap, 0, 0) <=
								client.near.scale + nearTrap.scale + tmp.scale,
						)
						.sort(function (a, b) {
							return (
								UTILS.getDist(a, client.near, 0, 2) -
								UTILS.getDist(b, client.near, 0, 2)
							);
						})[0];

					if (spike) {
						let pushAngle = Math.atan2(
							client.near.y2 - spike.y,
							client.near.x2 - spike.x,
						);

						let point = {
							x: client.near.x2 + Math.cos(pushAngle) * 30,
							y: client.near.y2 + Math.sin(pushAngle) * 60,
						};

						let dir = Math.atan2(point.y - Bot.y2, point.x - Bot.x2);

						client.sendWS("9", dir, 1);
					}
				}

				// Bot defensive placement around themselves
				if (Bot.items[4]) {
					const trapItem = items.list[Bot.items[4]];
					const tmpS = Bot.scale + trapItem.scale + (trapItem.placeOffset || 0);
					const angleStep = Math.PI / 6; // 30-degree steps for coverage
					let placedCount = 0;
					const maxPlace = 3;

					for (let i = 0; i < 12 && placedCount < maxPlace; i++) {
						const testAngle = i * angleStep;
						const tmpX = Bot.x2 + tmpS * Math.cos(testAngle);
						const tmpY = Bot.y2 + tmpS * Math.sin(testAngle);

						if (
							objectManager.checkItemLocation(
								tmpX,
								tmpY,
								trapItem.scale,
								0.6,
								trapItem.id,
								false,
								Bot,
							)
						) {
							let canPlace = true;
							gameObjects.forEach((tmp) => {
								if (
									tmp.active &&
									UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) <
									trapItem.scale +
									(tmp.blocker
										? tmp.blocker
										: tmp.getScale(0.6, tmp.isItem))
								) {
									canPlace = false;
								}
							});

							if (canPlace) {
								client.place(Bot.items.indexOf(4), testAngle);
								placedCount++;
							}
						}
					}
				}

				if (client.syncing && Bot.weapons[1]) {
					const botIndex = bottics.indexOf(client);
					const totalBots = bottics.length;
					const spreadAngle = (2 * Math.PI * botIndex) / totalBots;
				} else {
					// Run bot combat intelligence (KB predict, spike tick, auto insta)
					if (client.near && !instakill.isTrue && !client.botForceStop) {
						client.botCombat.run();
					}
					// Skip aim override when autobreaker is active
					if (!client.botAutoBreaker?.active) {
						const aimAngle = client.updateDir();
						client.sendWS("D", aimAngle);
					}
				}

				client.syncing = false;
			} else {
				// Run bot combat intelligence (KB predict, spike tick, auto insta)
				if (client.near && !instakill.isTrue && !client.botForceStop) {
					client.botCombat.run();
				}
				if (!client.botAutoBreaker?.active) {
					const aimAngle = client.updateDir();
					client.sendWS("D", aimAngle);
				}
			}

			client.move(client.updateMoveDir());
		}

		// LoadGameObjects:
		if (type == "H") {
			let tmpData = data[0];
			for (let i = 0; i < tmpData.length;) {
				if (!gameObjects.some((e) => e.active && e.sid == tmpData[i])) {
					objectManager.add(
						tmpData[i],
						tmpData[i + 1],
						tmpData[i + 2],
						tmpData[i + 3],
						tmpData[i + 4],
						tmpData[i + 5],
						items.list[tmpData[i + 6]],
						true,
						tmpData[i + 7] >= 0 ? { sid: tmpData[i + 7] } : null,
					);
				}
				i += 8;
			}
		}
		// WiggleGameObjects:
		if (type == "L") {
			// uh none since it will bug
			// planning to add max wiggle on objects dw;
		}
		// ShootTurret:
		if (type == "M") {
			//
		}
		// AddProjectile:
		if (type == "X") {
			const x = data[0],
				y = data[1],
				dir = data[2],
				range = data[3],
				speed = data[4],
				indx = data[5],
				layer = data[6],
				sid = data[7];
			projectileManager.addProjectile(
				x,
				y,
				dir,
				range,
				speed,
				indx,
				null,
				null,
				layer,
				inWindow,
			).sid = sid;
			let weaponIndx =
				indx == 0 ? 9 : indx == 2 ? 12 : indx == 3 ? 13 : indx == 5 && 15;
			let projOffset = config.playerScale * 2;
			let projXY = {
				x: indx == 1 ? x : x - projOffset * Math.cos(dir),
				y: indx == 1 ? y : y - projOffset * Math.sin(dir),
			};
			let nearPlayer = client.players
				.filter((e) => e.visible && UTILS.getDist(projXY, e, 0, 2) <= e.scale)
				.sort(function (a, b) {
					return (
						UTILS.getDist(projXY, a, 0, 2) - UTILS.getDist(projXY, b, 0, 2)
					);
				})[0];
			if (nearPlayer && !nearPlayer.updated) {
				if (indx == 1) {
					nearPlayer.shooting[53] = 1;
				} else {
					nearPlayer.shootIndex = weaponIndx;
					nearPlayer.shooting[1] = 1;
				}
			}
		}
		// KillObject:
		if (type == "Q") {
			const findObj = findObjectBySid(data[0]);
			objectManager.disableBySid(data[0]);

			if (configs.botReplacer) {
				client.autoReplacer(findObj, true);
			}
		}
		// KillObjects:
		if (type == "R") {
			if (Bot) {
				objectManager.removeAllItems(data[0]);
			}
		}
		// Gather Animation:
		if (type == "K") {
			tmpObj = client.findPlayerBySID(data[0]);
			if (tmpObj) {
				tmpObj.gatherIndex = data[2];
				tmpObj.startAnim(data[1], data[2]);
				tmpObj.gathering = 1;
			}
		}
		if (type == "I") {
			data = data[0];
			if (Bot && Bot.alive) {
				if (!client._botHealed && Bot.health < Bot.maxHealth && !client._botBullHealTimeout) {
					if (Bot.empAnti && client._botSentHat != 22) {
						Bot.addDamageThreat?.("turret", 25);
					}
					if (client.hitting && client.enemy?.length) {
						client.enemy.forEach(e => {
							if (e.dist2 <= (items.weapons[Bot.weaponIndex]?.range || 100) + Bot.scale * 1.8) {
								const wpnDmg = items.weapons[Bot.weaponIndex]?.dmg || 0;
								Bot.addDamageThreat?.("counter", wpnDmg * (client._botSentHat == 7 ? 1.5 : 1) * (client._botSentTail == 11 ? 0.2 : 1) * getCounter(e.skinIndex, e.tailIndex));
							}
						});
					}
					let threat = client._botSentHat == 6 ? (Bot.damageSources?.totalSoldier || 0) : (Bot.damageSources?.totalNoSoldier || 0);
					if (Bot.health <= threat && Bot.shameCount <= 5) {
						client.botHealer();
						client._botHealed = true;
					}
				}
				if (data) {
					for (let i = 0; i < data.length; i += 7) {
						const aiIdx = data[i + 1];
						const aiType = aiManager.aiTypes?.[aiIdx];
						if (!aiType || !aiType.hostile || !aiType.dmg) continue;
						const dist = Math.hypot(data[i + 2] - Bot.x2, data[i + 3] - Bot.y2);
						if (dist <= (aiType.hitRange || aiType.scale || 50) + Bot.scale + 10) {
							Bot.addDamageThreat?.("AI", aiType.dmg);
						}
					}
					if (!client._botHealed && Bot.health < Bot.maxHealth && !client._botBullHealTimeout) {
						let threat = client._botSentHat == 6 ? (Bot.damageSources?.totalSoldier || 0) : (Bot.damageSources?.totalNoSoldier || 0);
						if (Bot.health <= threat && Bot.shameCount <= 5) {
							client.botHealer();
							client._botHealed = true;
						}
					}
				}
				Bot.empAnti = false;
				Bot.soldierAnti = false;
				client._botSentHat = null;
				client._botSentTail = null;
				client._botHealed = false;
			}
		}
		// AnimateAI:
		if (type == "J") {
			data = data[0];
		}
		// UpdatePlayerValue:
		if (type == "N") {
			if (Bot) {
				Bot[data[0]] = data[1];
				if (data[0] == "points") {
					client.autoBuy.buyNext();
				}
			}
		}
		// UpdateHealth:
		if (type === "O") {
			const sid = data[0];
			const value = data[1];
			const obj = client.players.find((p) => p.sid === sid);
			if (obj) {
				const old = obj.health;
				obj.oldHealth = old;
				obj.health = value;
				obj.judgeShame?.();
				if (obj === Bot && old > value) {
					client.handleBotDamage(old - value);
				}
			}
		}
		// UpdateItemCounts:
		if (type == "S") {
			if (Bot) {
				Bot.itemCounts[data[0]] = data[1];
			}
		}
		// UpdateAge:
		if (type == "T") {
			if (data[0] != undefined) {
				Bot.XP = data[0];
			}
			if (data[1] != undefined) {
				Bot.maxXP = data[1];
			}
			if (data[2] != undefined) {
				Bot.age = data[2];
			}
		}
		// UpdateUpgrades:
		if (type == "U") {
			Bot.upgradePoints = data[0];
			Bot.upgrAge = data[1];
			if (Bot.upgradePoints > 0) {
				const loadouts = {
					KH: { weapons: [3, 10, 4], items: [17, 31, 27, 38, 25] },
					PH: { weapons: [5, 10], items: [17, 31, 23, 38, 28, 25] },
					DH: { weapons: [7, 10], items: [17, 31, 23, 38, 28, 25] },
					BH: { weapons: [6, 10], items: [17, 31, 23, 38, 28, 25] },
					SH: { weapons: [8, 10], items: [17, 31, 23, 38, 28, 25] },
					SM: { weapons: [3, 9, 12, 15], items: [17, 31, 23, 38] },
					PM: { weapons: [5, 9, 12, 15], items: [17, 31, 23, 38] },
					DM: { weapons: [7, 9, 12, 15], items: [17, 31, 23, 38] },
					PB: { weapons: [5, 9], items: [17, 31, 23, 38] },
					PBC: { weapons: [5, 10, 12, 13], items: [17, 31, 23, 38] },
				};

				const loadout = loadouts[options.botLoadout] || loadouts.KH;

				// Upgrade weapons
				loadout.weapons.forEach(id => {
					if (items.weapons[id] && items.weapons[id].age === Bot.upgrAge && Bot.upgradePoints) {
						client.sendWS("H", id);
					}
				});

				// Upgrade items
				loadout.items.forEach(id => {
					if (!Bot.items[id] && Bot.upgrAge < 10 && Bot.upgradePoints) {
						client.sendWS("H", id);
					}
				});
			}
		}
		// UpdateItems:
		if (type == "V") {
			if (data[0]) {
				if (data[1]) {
					Bot.weapons = data[0];
					Bot.primaryIndex = Bot.weapons[0];
					Bot.secondaryIndex = Bot.weapons[1];
				} else {
					Bot.items = data[0];
				}
			}
		}
		// UpdateStoreItems:
		if (type == "5") {
			let type = data[0];
			let id = data[1];
			let index = data[2];
			if (index) {
				if (!type) {
					Bot.tails[id] = 1;
				} else {
					Bot.latestTail = id;
				}
			} else if (!type) {
				Bot.skins[id] = 1;
			} else {
				Bot.latestSkin = id;
			}
		}
	};
}

function disconnectBot() {
	if (!bottics || bottics.length === 0) {
		console.log("No bots connected to disconnect");
		return false;
	}

	const lastBot = bottics[bottics.length - 1];
	const botNumber = lastBot.botCount;

	// Clear all intervals and timeouts
	if (lastBot.pingInterval) {
		clearInterval(lastBot.pingInterval);
		lastBot.pingInterval = null;
	}

	if (lastBot.otherIntervals) {
		lastBot.otherIntervals.forEach((intervalId) => {
			clearInterval(intervalId);
		});
		lastBot.otherIntervals = [];
	}

	if (lastBot.timeouts) {
		lastBot.timeouts.forEach((timeoutId) => {
			clearTimeout(timeoutId);
		});
		lastBot.timeouts = [];
	}

	// Clear game state
	if (lastBot.game) {
		if (lastBot.game.tickQueue) {
			lastBot.game.tickQueue = [];
		}
		if (lastBot.game.tickBase) {
			lastBot.game.tickBase = () => { };
		}
	}

	// Clear bot data
	if (lastBot.Bot) {
		lastBot.Bot = null;
	}
	if (lastBot.near) {
		lastBot.near = null;
	}
	if (lastBot.items) {
		lastBot.items = [];
	}
	if (lastBot.weapons) {
		lastBot.weapons = [];
	}

	// Remove event listeners to prevent memory leaks
	if (lastBot.onmessage) {
		lastBot.onmessage = null;
	}
	if (lastBot.onopen) {
		lastBot.onopen = null;
	}
	if (lastBot.onerror) {
		lastBot.onerror = null;
	}
	if (lastBot.onclose) {
		lastBot.onclose = null;
	}

	// Close WebSocket properly
	if (
		lastBot.readyState === WebSocket.OPEN ||
		lastBot.readyState === WebSocket.CONNECTING
	) {
		try {
			lastBot.close(1000, "Manual disconnect");
		} catch (e) {
			console.log(`Error closing bot ${botNumber} WebSocket:`, e);
		}
	}

	// Remove from bottics array
	bottics.pop();

	// Update remaining bots' numbers
	bottics.forEach((bot, index) => {
		bot.botCount = index + 1;
	});

	console.log(
		`Bot ${botNumber} disconnected. ${bottics.length} bots remaining.`,
	);
	return true;
}

// Separate keydown handler for bot controls
document.addEventListener("keydown", (event) => {
	if (isChatActive()) return;
	if (event.keyCode === 187) { // = key
		botConnect();
		event.preventDefault();
	} else if (event.keyCode === 189) { // - key
		disconnectBot();
		event.preventDefault();
	}
});

let macro = {};
window.nospikeMode = false;
let antiBoostCd = 0;
let mills = {
	place: 0,
	placeSpawnPads: 0,
	old: {
		x: 0,
		y: 0,
	},
	spawnDist: 124,
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
let profanityList = [
	"cunt",
	"whore",
	"fuck",
	"shit",
	"faggot",
	"nigger",
	"nigga",
	"dick",
	"vagina",
	"minge",
	"cock",
	"rape",
	"cum",
	"sex",
	"tits",
	"penis",
	"clit",
	"pussy",
	"meatcurtain",
	"jizz",
	"prune",
	"douche",
	"wanker",
	"damn",
	"bitch",
	"dick",
	"fag",
	"bastard",
];

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

		let self = this;

		// GLOBAL UTILS:
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
			return Math.floor(Math.random() * (max - min)) + min;
		};
		this.randFloat = function (min, max) {
			return Math.random() * (max - min) + min;
		};
		this.collisionDetection = function (obj1, obj2, scale) {
			return mathSQRT((obj1.x - obj2.x) ** 2 + (obj1.y - obj2.y) ** 2) < scale;
		};
		this.lerp = function (value1, value2, amount) {
			return value1 + (value2 - value1) * amount;
		};
		this.decel = function (val, cel) {
			if (val > 0) val = Math.max(0, val - cel);
			else if (val < 0) val = Math.min(0, val + cel);
			return val;
		};
		this.getDistance = function (x1, y1, x2, y2) {
			return mathSQRT((x2 -= x1) * x2 + (y2 -= y1) * y2);
		};
		this.getDist = function (tmp1, tmp2, type1, type2) {
			let tmpXY1 = {
				x:
					type1 == 0
						? tmp1.x
						: type1 == 1
							? tmp1.x1
							: type1 == 2
								? tmp1.x2
								: type1 == 3 && tmp1.x3,
				y:
					type1 == 0
						? tmp1.y
						: type1 == 1
							? tmp1.y1
							: type1 == 2
								? tmp1.y2
								: type1 == 3 && tmp1.y3,
			};
			let tmpXY2 = {
				x:
					type2 == 0
						? tmp2.x
						: type2 == 1
							? tmp2.x1
							: type2 == 2
								? tmp2.x2
								: type2 == 3 && tmp2.x3,
				y:
					type2 == 0
						? tmp2.y
						: type2 == 1
							? tmp2.y1
							: type2 == 2
								? tmp2.y2
								: type2 == 3 && tmp2.y3,
			};
			return mathSQRT(
				(tmpXY2.x -= tmpXY1.x) * tmpXY2.x + (tmpXY2.y -= tmpXY1.y) * tmpXY2.y,
			);
		};
		this.findMiddlePoint = function (tmp1, tmp2, type1, type2) {
			// Helper function to get the correct coordinates
			const getCoords = (obj, type) => {
				switch (type) {
					case 0:
						return { x: obj.x, y: obj.y };
					case 1:
						return { x: obj.x1, y: obj.y1 };
					case 2:
						return { x: obj.x2, y: obj.y2 };
					case 3:
						return { x: obj.x3, y: obj.y3 };
					default:
						throw new Error("Invalid type");
				}
			};

			const tmpXY1 = getCoords(tmp1, type1);
			const tmpXY2 = getCoords(tmp2, type2);

			return {
				x: (tmpXY1.x + tmpXY2.x) / 2,
				y: (tmpXY1.y + tmpXY2.y) / 2,
			};
		};
		this.fgdo = function (a, b) {
			return Math.sqrt(Math.pow(b.y - a.y, 2) + Math.pow(b.x - a.x, 2));
		};
		this.getDirection = function (x1, y1, x2, y2) {
			//direction of x1,y1 from x2,y2
			return mathATAN2(y1 - y2, x1 - x2);
		};
		this.getDirect = function (tmp1, tmp2, type1, type2) {
			// direction of tmp1 from tmp2
			let tmpXY1 = {
				x:
					type1 == 0
						? tmp1.x
						: type1 == 1
							? tmp1.x1
							: type1 == 2
								? tmp1.x2
								: type1 == 3 && tmp1.x3,
				y:
					type1 == 0
						? tmp1.y
						: type1 == 1
							? tmp1.y1
							: type1 == 2
								? tmp1.y2
								: type1 == 3 && tmp1.y3,
			};
			let tmpXY2 = {
				x:
					type2 == 0
						? tmp2.x
						: type2 == 1
							? tmp2.x1
							: type2 == 2
								? tmp2.x2
								: type2 == 3 && tmp2.x3,
				y:
					type2 == 0
						? tmp2.y
						: type2 == 1
							? tmp2.y1
							: type2 == 2
								? tmp2.y2
								: type2 == 3 && tmp2.y3,
			};
			return mathATAN2(tmpXY1.y - tmpXY2.y, tmpXY1.x - tmpXY2.x);
		};
		this.getAngleDist = function (a, b) {
			let p = mathABS(b - a) % (mathPI * 2);
			return p > mathPI ? mathPI * 2 - p : p;
		};
		this.isNumber = function (n) {
			return typeof n == "number" && !isNaN(n) && isFinite(n);
		};
		this.isString = function (s) {
			return s && typeof s == "string";
		};
		this.kFormat = function (num) {
			return num > 999 ? (num / 1000).toFixed(1) + "k" : num;
		};
		this.sFormat = function (num) {
			let fixs = [
				{ num: 1e3, string: "k" },
				{ num: 1e6, string: "m" },
				{ num: 1e9, string: "b" },
				{ num: 1e12, string: "q" },
			].reverse();
			let sp = fixs.find((v) => num >= v.num);
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
			if (maxX > recX2) maxX = recX2;
			if (minX < recX) minX = recX;
			if (minX > maxX) return false;
			let minY = y1;
			let maxY = y2;
			let dx = x2 - x1;
			if (Math.abs(dx) > 0.000001) {
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
			// let passive = window.Modernizr.passiveeventlisteners ? {passive: true} : false;
			let passive = false;
			element.addEventListener(
				"touchstart",
				this.checkTrusted(touchStart),
				passive,
			);
			element.addEventListener(
				"touchmove",
				this.checkTrusted(touchMove),
				passive,
			);
			element.addEventListener(
				"touchend",
				this.checkTrusted(touchEnd),
				passive,
			);
			element.addEventListener(
				"touchcancel",
				this.checkTrusted(touchEnd),
				passive,
			);
			element.addEventListener(
				"touchleave",
				this.checkTrusted(touchEnd),
				passive,
			);

			function touchStart(e) {
				self.mousifyTouchEvent(e);
				window.setUsingTouch(true);
				if (preventDefault) {
					e.preventDefault();
					e.stopPropagation();
				}
				if (element.onmouseover) element.onmouseover(e);
				isHovering = true;
			}

			function touchMove(e) {
				self.mousifyTouchEvent(e);
				window.setUsingTouch(true);
				if (preventDefault) {
					e.preventDefault();
					e.stopPropagation();
				}
				if (self.containsPoint(element, e.pageX, e.pageY)) {
					if (!isHovering) {
						if (element.onmouseover) element.onmouseover(e);
						isHovering = true;
					}
				} else {
					if (isHovering) {
						if (element.onmouseout) element.onmouseout(e);
						isHovering = false;
					}
				}
			}

			function touchEnd(e) {
				self.mousifyTouchEvent(e);
				window.setUsingTouch(true);
				if (preventDefault) {
					e.preventDefault();
					e.stopPropagation();
				}
				if (isHovering) {
					if (element.onclick) element.onclick(e);
					if (element.onmouseout) element.onmouseout(e);
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
				if (config[configValue]) element[elementValue] = config[configValue];
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
			if (element.onclick) element.onclick = this.checkTrusted(element.onclick);
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
				if (
					ev &&
					ev instanceof Event &&
					(ev && typeof ev.isTrusted == "boolean" ? ev.isTrusted : true)
				) {
					callback(ev);
				} else {
					//console.error("Event is not trusted.", ev);
				}
			};
		};
		this.randomString = function (length) {
			let text = "";
			let possible =
				"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
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
		this.hexToRgb = function (hex) {
			return hex
				.slice(1)
				.match(/.{1,2}/g)
				.map((g) => parseInt(g, 16));
		};
		this.getRgb = function (r, g, b) {
			return [r / 255, g / 255, b / 255].join(", ");
		};
	}
}
class Animtext {
	// ANIMATED TEXT:
	constructor() {
		// INIT:
		this.init = function (x, y, scale, speed, life, text, color) {
			this.x = x;
			this.y = y;
			this.color = color;
			this.scale = scale * 3.5;
			this.weight = 50;
			this.startScale = this.scale * 1.2;
			this.maxScale = 1.5 * scale;
			this.minScale = 0.5 * scale;
			this.scaleSpeed = 0.7;
			this.speed = speed;
			this.speedMax = speed;
			this.life = life;
			this.maxLife = life;
			this.text = text;
			this.movSpeed = speed;
		};

		// UPDATE:
		this.update = function (delta) {
			if (this.life) {
				this.life -= delta;
				if (this.scaleSpeed != -0.35) {
					this.y -= this.speed * delta;
					// (this.x += this.speed * delta);
				} else {
					this.y -= this.speed * delta;
				}
				this.scale -= 0.8;
				// this.scale > 0.35 && (this.scale = Math.max(this.scale, this.startScale));
				// this.speed < this.speedMax && (this.speed -= this.speedMax * .0075);
				if (this.scale >= this.maxScale) {
					this.scale = this.maxScale;
					this.scaleSpeed *= -0.5;
					this.speed = this.speed * 0.75;
				}
				this.life <= 0 && (this.life = 0);
			}
		};

		// RENDER:
		this.render = function (ctxt, xOff, yOff) {
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
}
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
			this.isItem = this.id != undefined;
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
			this.reloads = this.shootRate;
			this.spawnPoint = data.spawnPoint;
			this.onNear = 0;
			this.breakObj = false;
			this.alpha = data.alpha || 1;
			this.maxAlpha = data.alpha || 1;
			this.fadingIn = false;
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
			return this.health <= 0;
		};

		// GET SCALE:
		this.getScale = function (sM = 1, ig) {
			return (
				this.scale *
				(this.isItem || this.type == 2 || this.type == 3 || this.type == 4
					? 1
					: 0.6 * sM) *
				(ig ? 1 : this.colDiv)
			);
		};

		// VISIBLE TO PLAYER:
		this.visibleToPlayer = function (player) {
			return (
				!this.hideFromEnemy ||
				(this.owner &&
					(this.owner == player ||
						(this.owner.team && player.team == this.owner.team)))
			);
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
			} else if (this.fadingOut) {
				const t = 1 - Math.pow(0.982, delta);
				this.alpha += (0 - this.alpha) * t;
				if (this.alpha < 0.01) {
					this.alpha = 0;
					this.alive = false;
					this.fadingOut = false;
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

		this.tickAlpha = function (delta) {
			if (this.fadingIn) {
				const t = 1 - Math.pow(0.985, delta);
				this.alpha += (this.maxAlpha - this.alpha) * t;
				if (this.maxAlpha - this.alpha < 0.01) {
					this.alpha = this.maxAlpha;
					this.fadingIn = false;
				}
			}
		};

		// team check :sob:
		this.isTeamObject = function (tmpObj) {
			if (
				this.owner == null ||
				tmpObj.sid == this.owner.sid ||
				(tmpObj.sid == player.sid && alliancePlayers.includes(this.owner.sid))
			)
				return true;
			let ownerPlayer = findPlayerBySID(this.owner.sid);
			if (ownerPlayer) return ownerPlayer.isTeam(tmpObj);
		};
	}
}

class Items {
	constructor() {
		// ITEM GROUPS:
		this.groups = [
			{
				id: 0,
				name: "food",
				layer: 0,
			},
			{
				id: 1,
				name: "walls",
				place: true,
				limit: 30,
				layer: 0,
			},
			{
				id: 2,
				name: "spikes",
				place: true,
				limit: 15,
				layer: 0,
			},
			{
				id: 3,
				name: "mill",
				place: true,
				limit: 7,
				layer: 1,
			},
			{
				id: 4,
				name: "mine",
				place: true,
				limit: 1,
				layer: 0,
			},
			{
				id: 5,
				name: "trap",
				place: true,
				limit: 6,
				layer: -1,
			},
			{
				id: 6,
				name: "booster",
				place: true,
				limit: 12,
				layer: -1,
			},
			{
				id: 7,
				name: "turret",
				place: true,
				limit: 2,
				layer: 1,
			},
			{
				id: 8,
				name: "watchtower",
				place: true,
				limit: 12,
				layer: 1,
			},
			{
				id: 9,
				name: "buff",
				place: true,
				limit: 4,
				layer: -1,
			},
			{
				id: 10,
				name: "spawn",
				place: true,
				limit: 1,
				layer: -1,
			},
			{
				id: 11,
				name: "sapling",
				place: true,
				limit: 2,
				layer: 0,
			},
			{
				id: 12,
				name: "blocker",
				place: true,
				limit: 3,
				layer: -1,
			},
			{
				id: 13,
				name: "teleporter",
				place: true,
				limit: 2,
				layer: -1,
			},
		];

		// PROJECTILES:
		this.projectiles = [
			{
				indx: 0,
				layer: 0,
				src: "arrow_1",
				dmg: 25,
				speed: 1.6,
				scale: 103,
				range: 1000,
			},
			{
				indx: 1,
				layer: 1,
				dmg: 25,
				speed: 1.5,
				scale: 20,
				range: 600,
			},
			{
				indx: 0,
				layer: 0,
				src: "arrow_1",
				dmg: 35,
				speed: 2.5,
				scale: 103,
				range: 1200,
			},
			{
				indx: 0,
				layer: 0,
				src: "arrow_1",
				dmg: 30,
				speed: 2,
				scale: 103,
				range: 1200,
			},
			{
				indx: 1, //idk what this is
				layer: 1,
				dmg: 16,
				scale: 20,
			},
			{
				indx: 0,
				layer: 0,
				src: "bullet_1",
				dmg: 50,
				speed: 3.6,
				scale: 160,
				range: 1400,
			},
		];

		// WEAPONS:
		this.weapons = [
			{
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
				speed: 300,
			},
			{
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
				speed: 400,
			},
			{
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
				speed: 400,
			},
			{
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
				speed: 300,
			},
			{
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
				speed: 300,
			},
			{
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
				speed: 700,
			},
			{
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
				speed: 300,
			},
			{
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
				speed: 100,
			},
			{
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
				speed: 400,
			},
			{
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
				speed: 600,
			},
			{
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
				speed: 400,
			},
			{
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
				spdMult: 0.7,
			},
			{
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
				speed: 700,
			},
			{
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
				speed: 230,
			},
			{
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
				speed: 700,
			},
			{
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
				speed: 1500,
			},
		];

		// ITEMS:
		this.list = [
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
			},
			{
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
				itemAID: 38,
			},
		];

		// CHECK ITEM ID:
		this.checkItem = {
			index: function (id, myItems) {
				return [0, 1, 2].includes(id)
					? 0
					: [3, 4, 5].includes(id)
						? 1
						: [6, 7, 8, 9].includes(id)
							? 2
							: [10, 11, 12].includes(id)
								? 3
								: [13, 14].includes(id)
									? 5
									: [15, 16].includes(id)
										? 4
										: [17, 18, 19, 21, 22].includes(id)
											? [13, 14].includes(myItems)
												? 6
												: 5
											: id == 20
												? [13, 14].includes(myItems)
													? 7
													: 6
												: undefined;
			},
		};

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
	constructor(GameObject, gameObjects, UTILS, config) {
		let mathFloor = Math.floor,
			mathABS = Math.abs,
			mathCOS = Math.cos,
			mathSIN = Math.sin,
			mathPOW = Math.pow,
			mathSQRT = Math.sqrt,
			tmpX,
			tmpY,
			tmpS = config.mapScale / config.colGrid;

		this.ignoreAdd = false;
		this.hitObj = [];
		this.grids = {};

		// DISABLE OBJ:
		this.disableObj = function (obj) {
			obj.active = false;
			obj.breakTime = Date.now();
			obj.startFadeOut();
			this.removeObjGrid(obj);
		};

		this.setObjectGrids = function (obj) {
			let objX = Math.min(config.mapScale, Math.max(0, obj.x));
			let objY = Math.min(config.mapScale, Math.max(0, obj.y));
			for (let x = 0; x < config.colGrid; ++x) {
				tmpX = x * tmpS;
				for (let y = 0; y < config.colGrid; ++y) {
					tmpY = y * tmpS;
					if (objX + obj.scale >= tmpX && objX - obj.scale <= tmpX + tmpS && objY + obj.scale >= tmpY && objY - obj.scale <= tmpY + tmpS) {
						if (!this.grids[x + "_" + y]) {
							this.grids[x + "_" + y] = [];
						}
						this.grids[x + "_" + y].push(obj);
						obj.gridLocations.push(x + "_" + y);
					}
				}
			}
		};

		// REMOVE OBJECT FROM GRID:
		this.removeObjGrid = function (obj) {
			let tmpIndx;
			for (let i = 0; i < obj.gridLocations.length; ++i) {
				tmpIndx = this.grids[obj.gridLocations[i]].indexOf(obj);
				if (tmpIndx >= 0) {
					this.grids[obj.gridLocations[i]].splice(tmpIndx, 1);
				}
			}
		};

		let tmpArray = [];
		let tmpGrid;
		this.getGridArrays = function (xPos, yPos, s) {
			tmpX = mathFloor(xPos / tmpS);
			tmpY = mathFloor(yPos / tmpS);
			tmpArray.length = 0;
			try {
				if (this.grids[tmpX + "_" + tmpY]) {
					tmpArray.push(this.grids[tmpX + "_" + tmpY]);
				}
				if (xPos + s >= (tmpX + 1) * tmpS) {
					// RIGHT
					tmpGrid = this.grids[tmpX + 1 + "_" + tmpY];
					if (tmpGrid) {
						tmpArray.push(tmpGrid);
					}
					if (tmpY && yPos - s <= tmpY * tmpS) {
						// TOP RIGHT
						tmpGrid = this.grids[tmpX + 1 + "_" + (tmpY - 1)];
						if (tmpGrid) {
							tmpArray.push(tmpGrid);
						}
					} else {
						if (yPos + s >= (tmpY + 1) * tmpS) {
							// BOTTOM RIGHT
							tmpGrid = this.grids[tmpX + 1 + "_" + (tmpY + 1)];
							if (tmpGrid) {
								tmpArray.push(tmpGrid);
							}
						}
					}
				}
				if (tmpX && xPos - s <= tmpX * tmpS) {
					// LEFT
					tmpGrid = this.grids[tmpX - 1 + "_" + tmpY];
					if (tmpGrid) {
						tmpArray.push(tmpGrid);
					}
					if (tmpY && yPos - s <= tmpY * tmpS) {
						// TOP LEFT
						tmpGrid = this.grids[tmpX - 1 + "_" + (tmpY - 1)];
						if (tmpGrid) {
							tmpArray.push(tmpGrid);
						}
					} else {
						if (yPos + s >= (tmpY + 1) * tmpS) {
							// BOTTOM LEFT
							tmpGrid = this.grids[tmpX - 1 + "_" + (tmpY + 1)];
							if (tmpGrid) {
								tmpArray.push(tmpGrid);
							}
						}
					}
				}
				if (yPos + s >= (tmpY + 1) * tmpS) {
					// BOTTOM
					tmpGrid = this.grids[tmpX + "_" + (tmpY + 1)];
					if (tmpGrid) {
						tmpArray.push(tmpGrid);
					}
				}
				if (tmpY && yPos - s <= tmpY * tmpS) {
					// TOP
					tmpGrid = this.grids[tmpX + "_" + (tmpY - 1)];
					if (tmpGrid) {
						tmpArray.push(tmpGrid);
					}
				}
			} catch (e) { }
			return tmpArray;
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
			this.setObjectGrids(tmpObj);
			// Fade in on placement
			tmpObj.alpha = 0;
			tmpObj.fadingIn = true;
		};

		// DISABLE BY SID:
		this.disableBySid = function (sid) {
			let find = findObjectBySid(sid);
			if (find) {
				this.disableObj(find);
			}
		};

		// REMOVE ALL FROM PLAYER:
		this.removeAllItems = function (sid) {
			gameObjects
				.filter((tmp) => tmp.active && tmp.owner && tmp.owner.sid == sid)
				.forEach((tmp) => this.disableObj(tmp));
		};

		// CHECK IF PLACABLE:
		this.checkItemLocation = function (x, y, s, sM, indx, ignoreWater) {
			let cantPlace = nearObjs.find(
				(tmp) =>
					UTILS.getDistance(x, y, tmp.x, tmp.y) <
					s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)),
			);
			if (cantPlace) return false;
			if (
				!ignoreWater &&
				indx != 18 &&
				y >= config.mapScale / 2 - config.riverWidth / 2 &&
				y <= config.mapScale / 2 + config.riverWidth / 2
			)
				return false;
			return true;
		};

		this.preplaceCheck = function (x, y, s, sM, indx, ignoreWater, object) {
			let cantPlace = nearObjs.find(
				(tmp) =>
					tmp.sid != object.sid &&
					UTILS.getDistance(x, y, tmp.x, tmp.y) <
					s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)),
			);
			if (cantPlace) return false;
			if (
				!ignoreWater &&
				indx != 18 &&
				y >= config.mapScale / 2 - config.riverWidth / 2 &&
				y <= config.mapScale / 2 + config.riverWidth / 2
			)
				return false;
			return UTILS.getDistance(x, y, object.x, object.y) <= s + object.scale;
		};

		this.canBeBroken = function (object) {
			if (!inGame || !object || !enemy.length) return;

			const useHammer = autoBreak.useHammer(object);

			const playerWeapon = player.weapons[useHammer ? 1 : 0];
			const isPlayerPrimary = playerWeapon < 9;

			const playerVariant = isPlayerPrimary
				? player.primaryVariant
				: player.secondaryVariant;

			const playerVariantDmg =
				playerVariant !== undefined
					? config.weaponVariants[playerVariant].val
					: 1;

			const playerReloaded = isPlayerPrimary
				? player.primaryReloaded
				: player.secondaryReloaded;

			let enemyWeapon = 10;
			if (
				near.secondaryIndex !== undefined &&
				near.primaryIndex !== undefined
			) {
				enemyWeapon =
					near.secondaryIndex === 10 &&
						(object.health > items.weapons[near.primaryIndex].dmg ||
							near.primaryIndex === 5)
						? near.secondaryIndex
						: near.primaryIndex;
			}

			const isEnemyPrimary = enemyWeapon < 9;

			const enemyVariant =
				near.secondaryIndex !== undefined && near.primaryIndex !== undefined
					? isEnemyPrimary
						? near.primaryVariant
						: near.secondaryVariant
					: 3;

			const enemyVariantDmg = config.weaponVariants[enemyVariant].val;

			const enemyReloaded = isEnemyPrimary
				? near.primaryReloaded
				: near.secondaryReloaded;

			const playerDamage = items.weapons[playerWeapon].dmg;
			const enemyDamage = items.weapons[enemyWeapon].dmg;

			const tank = 3.3;
			let damageThreat = 0;

			if (enemyReloaded && this.canHit(near, object, enemyWeapon)) {
				damageThreat +=
					enemyDamage *
					tank *
					enemyVariantDmg *
					(items.weapons[enemyWeapon].sDmg || 1);
			}

			if (
				playerReloaded &&
				(clicks.right ||
					(autoBreak.active &&
						(autoBreak.priority[0].includes(object) ||
							autoBreak.priority[1].includes(object) ||
							autoBreak.priority[2].includes(object))))
			) {
				damageThreat +=
					playerDamage *
					tank *
					playerVariantDmg *
					(items.weapons[playerWeapon].sDmg || 1);
			}

			return object.health <= damageThreat;
		};

		this.hitsToBreak = function (object, who) {
			if (!inGame || !object || !who) return;
			let weapon = autoBreak.useHammer(object, who) ? who.weapons[1] : who.weapons[0];
			let variant = who[(weapon < 9 ? "prima" : "seconda") + "ryVariant"];
			let variantDmg = variant != undefined ? config.weaponVariants[variant].val : 1.18;
			let damage = items.weapons[weapon]?.dmg;
			let hasTank = !!who.skins?.[40];
			let effectiveDamage = damage * (hasTank ? 3.3 : 1) * variantDmg * (items.weapons[weapon]?.sDmg || 1);
			return Math.ceil(object.health / effectiveDamage);
		};

		this.canHit = function (player, object, weapon, moreSafe = 0) {
			return (
				UTILS.getDist(player, object, 2, 0) <=
				items.weapons[weapon].range + object.scale + moreSafe
			);
		};

		this.checkCollision = function (obj1, obj2, delta = 1) {
			let x1 = obj1.x2 ? obj1.x2 : obj1.x;
			let y1 = obj1.y2 ? obj1.y2 : obj1.y;
			let x2 = obj2.x2 ? obj2.x2 : obj2.x;
			let y2 = obj2.y2 ? obj2.y2 : obj2.y;

			let dx = x1 - x2;
			let dy = y1 - y2;
			let tmpLen = obj1.scale + obj2.scale;
			if (mathABS(dx) <= tmpLen || mathABS(dy) <= tmpLen) {
				tmpLen = obj1.scale + obj2.getScale ? obj2.getScale() : obj2.scale;
				let tmpInt = mathSQRT(dx * dx + dy * dy) - tmpLen;
				if (tmpInt <= 0) {
					if (!obj2.ignoreCollision) {
						/*let tmpDir = UTILS.getDirection(x1, y1, x2, y2);
												let tmpDist = UTILS.getDistance(x1, y1, x2, y2);
												if (obj2.isPlayer) {
														tmpInt = tmpInt * -1 / 2;
														obj1.simX += mathCOS(tmpDir) * tmpInt;
														obj1.simY += mathSIN(tmpDir) * tmpInt;
														obj2.simX -= mathCOS(tmpDir) * tmpInt;
														obj2.simY -= mathSIN(tmpDir) * tmpInt;
												} else {
														obj1.simX = obj2.simX + tmpLen * mathCOS(tmpDir);
														obj1.simY = obj2.simY + tmpLen * mathSIN(tmpDir);
														obj1.xVel *= 0.75;
														obj1.yVel *= 0.75;
												}*/
						if (
							obj2.dmg &&
							(obj2.isAI ||
								!obj2.isTeamObject(obj1) ||
								(obj2.type == 1 && obj2.y >= 12000))
						) {
							obj1.addDamageThreat("others", obj2.dmg);
							/*let tmpSpd = 1.5 * obj2.weightM||1;
														obj1.xVel += mathCOS(tmpDir) * tmpSpd;
														obj1.yVel += mathSIN(tmpDir) * tmpSpd;*/
							if (obj2.pDmg && obj1.skin != 23) {
								obj1.poisonCounter = 5;
							}
							if (obj1.colDmg && obj2.health) {
								obj2.health -= obj1.colDmg;
							}
						}
					} else if (obj2.trap && !obj1.noTrap && !obj2.isTeamObject(obj1)) {
						obj1.lockMove = true;
						obj2.hideFromEnemy = false;
						obj1.inTrap = obj2;
					} else if (obj2.healCol) {
						obj1.healCol = obj2.healCol;
					} /* else if (obj2.boostSpeed) {
                        obj1.xVel += delta * obj2.boostSpeed * (obj2.weightM||1) * mathCOS(obj2.dir);
                        obj1.yVel += delta * obj2.boostSpeed * (obj2.weightM||1) * mathSIN(obj2.dir);
                    } else if (obj2.teleport) {
                        obj1.simX = UTILS.randInt(0, config.mapScale);
                        obj1.simY = UTILS.randInt(0, config.mapScale);
                    }*/
					return true;
				}
			}
			return false;
		};
	}
}
class Projectile {
	constructor(players, ais, objectManager, items, config, UTILS) {
		// INIT:
		this.init = function (indx, x, y, dir, spd, dmg, rng, scl) {
			this.active = true;
			this.tickActive = true;
			this.indx = indx;
			this.startX = x;
			this.startY = y;
			this.x = x;
			this.y = y;
			this.dir = dir;
			this.skipMov = true;
			this.speed = spd;
			this.dmg = dmg;
			this.scale = scl;
			this.range = rng;
			this.x2 = x;
			this.y2 = y;
			this.r2 = rng;
			this.owner = undefined;
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
}
class Store {
	constructor() {
		// STORE HATS:
		this.hats = [
			{
				id: 45,
				name: "Shame!",
				dontSell: true,
				price: 0,
				scale: 120,
				desc: "hacks are for winners",
			},
			{
				id: 51,
				name: "Moo Cap",
				price: 0,
				scale: 120,
				desc: "coolest mooer around",
			},
			{
				id: 50,
				name: "Apple Cap",
				price: 0,
				scale: 120,
				desc: "apple farms remembers",
			},
			{
				id: 28,
				name: "Moo Head",
				price: 0,
				scale: 120,
				desc: "no effect",
			},
			{
				id: 29,
				name: "Pig Head",
				price: 0,
				scale: 120,
				desc: "no effect",
			},
			{
				id: 30,
				name: "Fluff Head",
				price: 0,
				scale: 120,
				desc: "no effect",
			},
			{
				id: 36,
				name: "Pandou Head",
				price: 0,
				scale: 120,
				desc: "no effect",
			},
			{
				id: 37,
				name: "Bear Head",
				price: 0,
				scale: 120,
				desc: "no effect",
			},
			{
				id: 38,
				name: "Monkey Head",
				price: 0,
				scale: 120,
				desc: "no effect",
			},
			{
				id: 44,
				name: "Polar Head",
				price: 0,
				scale: 120,
				desc: "no effect",
			},
			{
				id: 35,
				name: "Fez Hat",
				price: 0,
				scale: 120,
				desc: "no effect",
			},
			{
				id: 42,
				name: "Enigma Hat",
				price: 0,
				scale: 120,
				desc: "join the enigma army",
			},
			{
				id: 43,
				name: "Blitz Hat",
				price: 0,
				scale: 120,
				desc: "hey everybody i'm blitz",
			},
			{
				id: 49,
				name: "Bob XIII Hat",
				price: 0,
				scale: 120,
				desc: "like and subscribe",
			},
			{
				id: 57,
				name: "Pumpkin",
				price: 50,
				scale: 120,
				desc: "Spooooky",
			},
			{
				id: 8,
				name: "Bummle Hat",
				price: 100,
				scale: 120,
				desc: "no effect",
			},
			{
				id: 2,
				name: "Straw Hat",
				price: 500,
				scale: 120,
				desc: "no effect",
			},
			{
				id: 15,
				name: "Winter Cap",
				price: 600,
				scale: 120,
				desc: "allows you to move at normal speed in snow",
				coldM: 1,
			},
			{
				id: 5,
				name: "Cowboy Hat",
				price: 1000,
				scale: 120,
				desc: "no effect",
			},
			{
				id: 4,
				name: "Ranger Hat",
				price: 2000,
				scale: 120,
				desc: "no effect",
			},
			{
				id: 18,
				name: "Explorer Hat",
				price: 2000,
				scale: 120,
				desc: "no effect",
			},
			{
				id: 31,
				name: "Flipper Hat",
				price: 2500,
				scale: 120,
				desc: "have more control while in water",
				watrImm: true,
			},
			{
				id: 1,
				name: "Marksman Cap",
				price: 3000,
				scale: 120,
				desc: "increases arrow speed and range",
				aMlt: 1.3,
			},
			{
				id: 10,
				name: "Bush Gear",
				price: 3000,
				scale: 160,
				desc: "allows you to disguise yourself as a bush",
			},
			{
				id: 48,
				name: "Halo",
				price: 3000,
				scale: 120,
				desc: "no effect",
			},
			{
				id: 6,
				name: "Soldier Helmet",
				price: 4000,
				scale: 120,
				desc: "reduces damage taken but slows movement",
				spdMult: 0.94,
				dmgMult: 0.75,
			},
			{
				id: 23,
				name: "Anti Venom Gear",
				price: 4000,
				scale: 120,
				desc: "makes you immune to poison",
				poisonRes: 1,
			},
			{
				id: 13,
				name: "Medic Gear",
				price: 5000,
				scale: 110,
				desc: "slowly regenerates health over time",
				healthRegen: 3,
			},
			{
				id: 9,
				name: "Miners Helmet",
				price: 5000,
				scale: 120,
				desc: "earn 1 extra gold per resource",
				extraGold: 1,
			},
			{
				id: 32,
				name: "Musketeer Hat",
				price: 5000,
				scale: 120,
				desc: "reduces cost of projectiles",
				projCost: 0.5,
			},
			{
				id: 7,
				name: "Bull Helmet",
				price: 6000,
				scale: 120,
				desc: "increases damage done but drains health",
				healthRegen: -5,
				dmgMultO: 1.5,
				spdMult: 0.96,
			},
			{
				id: 22,
				name: "Emp Helmet",
				price: 6000,
				scale: 120,
				desc: "turrets won't attack but you move slower",
				antiTurret: 1,
				spdMult: 0.7,
			},
			{
				id: 12,
				name: "Booster Hat",
				price: 6000,
				scale: 120,
				desc: "increases your movement speed",
				spdMult: 1.16,
			},
			{
				id: 26,
				name: "Barbarian Armor",
				price: 8000,
				scale: 120,
				desc: "knocks back enemies that attack you",
				dmgK: 0.6,
			},
			{
				id: 21,
				name: "Plague Mask",
				price: 10000,
				scale: 120,
				desc: "melee attacks deal poison damage",
				poisonDmg: 5,
				poisonTime: 6,
			},
			{
				id: 46,
				name: "Bull Mask",
				price: 10000,
				scale: 120,
				desc: "bulls won't target you unless you attack them",
				bullRepel: 1,
			},
			{
				id: 14,
				name: "Windmill Hat",
				topSprite: true,
				price: 10000,
				scale: 120,
				desc: "generates points while worn",
				pps: 1.5,
			},
			{
				id: 11,
				name: "Spike Gear",
				topSprite: true,
				price: 10000,
				scale: 120,
				desc: "deal damage to players that damage you",
				dmg: 0.45,
			},
			{
				id: 53,
				name: "Turret Gear",
				topSprite: true,
				price: 10000,
				scale: 120,
				desc: "you become a walking turret",
				turret: {
					proj: 1,
					range: 700,
					rate: 2500,
				},
				spdMult: 0.7,
			},
			{
				id: 20,
				name: "Samurai Armor",
				price: 12000,
				scale: 120,
				desc: "increased attack speed and fire rate",
				atkSpd: 0.78,
			},
			{
				id: 58,
				name: "Dark Knight",
				price: 12000,
				scale: 120,
				desc: "restores health when you deal damage",
				healD: 0.4,
			},
			{
				id: 27,
				name: "Scavenger Gear",
				price: 15000,
				scale: 120,
				desc: "earn double points for each kill",
				kScrM: 2,
			},
			{
				id: 40,
				name: "Tank Gear",
				price: 15000,
				scale: 120,
				desc: "increased damage to buildings but slower movement",
				spdMult: 0.3,
				bDmg: 3.3,
			},
			{
				id: 52,
				name: "Thief Gear",
				price: 15000,
				scale: 120,
				desc: "steal half of a players gold when you kill them",
				goldSteal: 0.5,
			},
			{
				id: 55,
				name: "Bloodthirster",
				price: 20000,
				scale: 120,
				desc: "Restore Health when dealing damage. And increased damage",
				healD: 0.25,
				dmgMultO: 1.2,
			},
			{
				id: 56,
				name: "Assassin Gear",
				price: 20000,
				scale: 120,
				desc: "Go invisible when not moving. Can't eat. Increased speed",
				noEat: true,
				spdMult: 1.1,
				invisTimer: 1000,
			},
		];

		// STORE ACCESSORIES:
		this.accessories = [
			{
				id: 12,
				name: "Snowball",
				price: 1000,
				scale: 105,
				xOff: 18,
				desc: "no effect",
			},
			{
				id: 9,
				name: "Tree Cape",
				price: 1000,
				scale: 90,
				desc: "no effect",
			},
			{
				id: 10,
				name: "Stone Cape",
				price: 1000,
				scale: 90,
				desc: "no effect",
			},
			{
				id: 3,
				name: "Cookie Cape",
				price: 1500,
				scale: 90,
				desc: "no effect",
			},
			{
				id: 8,
				name: "Cow Cape",
				price: 2000,
				scale: 90,
				desc: "no effect",
			},
			{
				id: 11,
				name: "Monkey Tail",
				price: 2000,
				scale: 97,
				xOff: 25,
				desc: "Super speed but reduced damage",
				spdMult: 1.35,
				dmgMultO: 0.2,
			},
			{
				id: 17,
				name: "Apple Basket",
				price: 3000,
				scale: 80,
				xOff: 12,
				desc: "slowly regenerates health over time",
				healthRegen: 1,
			},
			{
				id: 6,
				name: "Winter Cape",
				price: 3000,
				scale: 90,
				desc: "no effect",
			},
			{
				id: 4,
				name: "Skull Cape",
				price: 4000,
				scale: 90,
				desc: "no effect",
			},
			{
				id: 5,
				name: "Dash Cape",
				price: 5000,
				scale: 90,
				desc: "no effect",
			},
			{
				id: 2,
				name: "Dragon Cape",
				price: 6000,
				scale: 90,
				desc: "no effect",
			},
			{
				id: 1,
				name: "Super Cape",
				price: 8000,
				scale: 90,
				desc: "no effect",
			},
			{
				id: 7,
				name: "Troll Cape",
				price: 8000,
				scale: 90,
				desc: "no effect",
			},
			{
				id: 14,
				name: "Thorns",
				price: 10000,
				scale: 115,
				xOff: 20,
				desc: "no effect",
			},
			{
				id: 15,
				name: "Blockades",
				price: 10000,
				scale: 95,
				xOff: 15,
				desc: "no effect",
			},
			{
				id: 20,
				name: "Devils Tail",
				price: 10000,
				scale: 95,
				xOff: 20,
				desc: "no effect",
			},
			{
				id: 16,
				name: "Sawblade",
				price: 12000,
				scale: 90,
				spin: true,
				xOff: 0,
				desc: "deal damage to players that damage you",
				dmg: 0.15,
			},
			{
				id: 13,
				name: "Angel Wings",
				price: 15000,
				scale: 138,
				xOff: 22,
				desc: "slowly regenerates health over time",
				healthRegen: 3,
			},
			{
				id: 19,
				name: "Shadow Wings",
				price: 15000,
				scale: 138,
				xOff: 22,
				desc: "increased movement speed",
				spdMult: 1.1,
			},
			{
				id: 18,
				name: "Blood Wings",
				price: 20000,
				scale: 178,
				xOff: 26,
				desc: "restores health when you deal damage",
				healD: 0.2,
			},
			{
				id: 21,
				name: "Corrupt X Wings",
				price: 20000,
				scale: 178,
				xOff: 26,
				desc: "deal damage to players that damage you",
				dmg: 0.25,
			},
		];
	}
}
class ProjectileManager {
	constructor(
		Projectile,
		projectiles,
		players,
		ais,
		objectManager,
		items,
		config,
		UTILS,
	) {
		this.addProjectile = function (x, y, dir, range, speed, indx, layer) {
			let tmpData = items.projectiles[indx];
			let tmpProj;
			for (let i = 0; i < projectiles.length; ++i) {
				if (!projectiles[i].active) {
					tmpProj = projectiles[i];
					break;
				}
			}
			if (!tmpProj) {
				tmpProj = new Projectile(
					players,
					ais,
					objectManager,
					items,
					config,
					UTILS,
				);
				tmpProj.sid = projectiles.length;
				projectiles.push(tmpProj);
			}
			tmpProj.init(indx, x, y, dir, speed, tmpData.dmg, range, tmpData.scale);
			tmpProj.layer = layer || tmpData.layer;
			tmpProj.src = tmpData.src;
			return tmpProj;
		};
	}
}
class AiManager {
	// AI MANAGER:
	constructor(
		ais,
		AI,
		players,
		items,
		objectManager,
		config,
		UTILS,
		scoreCallback,
		server,
	) {
		// AI TYPES:
		this.aiTypes = [
			{
				id: 0,
				src: "cow_1",
				killScore: 150,
				health: 500,
				weightM: 0.8,
				speed: 0.00095,
				turnSpeed: 0.001,
				scale: 72,
				drop: ["food", 50],
			},
			{
				id: 1,
				src: "pig_1",
				killScore: 200,
				health: 800,
				weightM: 0.6,
				speed: 0.00085,
				turnSpeed: 0.001,
				scale: 72,
				drop: ["food", 80],
			},
			{
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
				drop: ["food", 100],
			},
			{
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
				drop: ["food", 400],
			},
			{
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
				drop: ["food", 200],
			},
			{
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
				drop: ["food", 100],
			},
			{
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
				drop: ["food", 100],
			},
			{
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
				spriteMlt: 1.0,
			},
			{
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
				drop: ["food", 1000],
			},
			{
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
			},
			{
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
				drop: ["food", 400],
			},
			{
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
				drop: ["food", 800],
			},
		];

		// SPAWN AI:
		this.spawn = function (x, y, dir, index) {
			let tmpObj = ais.find((tmp) => !tmp.active);
			if (!tmpObj) {
				tmpObj = new AI(
					ais.length,
					objectManager,
					players,
					items,
					UTILS,
					config,
					scoreCallback,
					server,
				);
				ais.push(tmpObj);
			}
			tmpObj.init(x, y, dir, index, this.aiTypes[index]);
			return tmpObj;
		};
	}
}
class AI {
	constructor(
		sid,
		objectManager,
		players,
		items,
		UTILS,
		config,
		scoreCallback,
		server,
	) {
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
			this.inTrap = false;
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
						this.dirPlus = UTILS.lerp(
							0,
							this.targetAngle,
							Math.min(1, tmpRatio),
						);
						if (tmpRatio >= 1) {
							tmpRatio = 1;
							animIndex = 1;
						}
					} else {
						tmpRatio -= delta / (this.animSpeed * (1 - config.hitReturnRatio));
						this.dirPlus = UTILS.lerp(
							0,
							this.targetAngle,
							Math.max(0, tmpRatio),
						);
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

		this.update = function (delta) {
			let closeObjs = [];
			let already = new Set();
			objectManager.getGridArrays(this.x2, this.y2, this.scale).forEach((arr) => {
				arr.forEach((obj) => {
					if (obj.active && !already.has(obj.sid)) {
						already.add(obj.sid);
						closeObjs.push(obj);
					}
				});
			});
			let hitObjects = closeObjs.filter(
				(e) => UTILS.getDist(e, this, 0, 2) <= this.scale + e.getScale() + 2,
			);
			if (!this.noTrap) {
				let nearTrap = hitObjects.filter((e) => e.trap)[0];
				this.inTrap = nearTrap;
				if (nearTrap) nearTrap.hideFromEnemy = false;
				if (
					configs.trapAnimals &&
					!this.inTrap &&
					UTILS.getDist(tmpObj, player, 2, 2) <=
					player.scale + this.scale + items.list[player.items[4]]?.scale - 5
				) {
					if (!autoPlace.rangesUpdated[4]) autoPlace.angleRanges(4);
					place(
						4,
						autoPlace.closeToAngle(
							UTILS.getDirect(tmpObj, player, 2, 2),
							autoPlace.ranges[4],
						),
					);
				}
			}
			if (this.colDmg && hitObjects.some((e) => e.dmg)) {
				let objectsHit = objectManager.hitObj;
				objectManager.hitObj = [];
				objectsHit.forEach((healthy) => {
					healthy.health -= this.colDmg;
				});
			}
		};
	}
}

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
}
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
class DeadPlayer {
	constructor(
		x,
		y,
		dir,
		buildIndex,
		weaponIndex,
		weaponVariant,
		skinColor,
		scale,
		name,
	) {
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

class MovementSimulator {
	constructor(player, near) {
		this.startX = player.x2;
		this.startY = player.y2;
		this.x = this.startX;
		this.y = this.startY;
		this.scale = player.scale;
		this.startSlowMult = player.slowMult;
		this.slowMult = this.startSlowMult;
		this.skinIndex = player.skinIndex;
		this.tailIndex = player.tailIndex;
		this.startxVel = player.xVel;
		this.startyVel = player.yVel;
		this.xVel = this.startxVel;
		this.yVel = this.startyVel;
		this.weaponIndex = player.weaponIndex;
		this.sid = player.sid;
		this.team = player.team;
		this.startTick = game.tick;
		this.tick = this.startTick;
		this.startZ = player.zIndex;
		this.zIndex = this.startZ;
		this.near = {
			x: near?.x2,
			y: near?.y2,
			scale: near?.scale
		};
	}
	continueTick(delta, moveDir, firstTick) {
		this.tick++;
		//calculate everything without using any of the starting values
		if (!firstTick) {
			//this thing is only calculated once per tick, and im calculating in player.update so for the first tick here, we dont need to calculate it.
			if (this.slowMult < 1) {
				this.slowMult += 0.0008 * delta;
				if (this.slowMult > 1) {
					this.slowMult = 1;
				}
			}
		}
		// skinIndex and tailIndex being 0 are not in the array but they have spdMult of 1
		let hat = findID(hats, this.skinIndex) || {};
		let tail = findID(accessories, this.tailIndex) || {};
		let spdMult = (items.weapons[this.weaponIndex].spdMult || 1) * (hat.spdMult || 1) * (tail.spdMult || 1) * (this.y <= config.snowBiomeTop ? (hat.coldM ? 1 : config.snowSpeed) : 1) * this.slowMult;
		if (this.y >= config.mapScale / 2 - config.riverWidth / 2 && this.y <= config.mapScale / 2 + config.riverWidth / 2) {
			if (hat.watrImm) {
				spdMult *= 0.75;
				this.xVel += config.waterCurrent * 0.4 * delta;
			} else {
				spdMult *= 0.33;
				this.xVel += config.waterCurrent * delta;
			}
		}
		let xVel = moveDir != undefined ? Math.cos(moveDir) : 0;
		let yVel = moveDir != undefined ? Math.sin(moveDir) : 0;
		let length = Math.sqrt(xVel * xVel + yVel * yVel);
		if (length != 0) {
			xVel /= length;
			yVel /= length;
		}
		if (xVel) this.xVel += xVel * config.playerSpeed * spdMult * delta;
		if (yVel) this.yVel += yVel * config.playerSpeed * spdMult * delta;
		this.zIndex = 0;
		let tmpSpeed = UTILS.getDistance(0, 0, this.xVel * delta, this.yVel * delta);
		let depth = Math.min(4, Math.max(1, Math.round(tmpSpeed / 40)));
		let tMlt = 1 / depth;
		let gotTrapped = false;
		let gotTp = false;
		let hitSpikes = [];
		let already = new Set();
		for (let i = 0; i < depth; ++i) {
			if (this.xVel) this.x += this.xVel * delta * tMlt;
			if (this.yVel) this.y += this.yVel * delta * tMlt;
			let tmpList = objectManager.getGridArrays(this.x, this.y, this.scale);
			for (let x = 0; x < tmpList.length; ++x) {
				for (let y = 0; y < tmpList[x].length; ++y) {
					let object = tmpList[x][y];
					if (!object.active || already.has(object.sid)) {
						continue;
					}
					already.add(object.sid);
					let dx = this.x - object.x;
					let dy = this.y - object.y;
					let tmpLen = this.scale + object.scale;
					if (Math.abs(dx) <= tmpLen || Math.abs(dy) <= tmpLen) {
						tmpLen = this.scale + object.getScale();
						let tmpInt = Math.sqrt(dx * dx + dy * dy) - tmpLen;
						if (tmpInt <= 0) {
							if (!object.ignoreCollision) {
								let tmpDir = UTILS.getDirection(this.x, this.y, object.x, object.y);
								this.x = object.x + tmpLen * Math.cos(tmpDir);
								this.y = object.y + tmpLen * Math.sin(tmpDir);
								this.xVel *= 0.75;
								this.yVel *= 0.75;
								if ((object.type == 1 && object.y >= 12000) || (object.dmg && !object.isTeamObject(this))) {
									this.xVel += 1.5 * Math.cos(tmpDir);
									this.yVel += 1.5 * Math.sin(tmpDir);
									hitSpikes.push(object);
								}
							} else if (object.trap && !object.isTeamObject(this)) {
								gotTrapped = true;
							} else if (object.boostSpeed) {
								this.xVel += tMlt * object.boostSpeed * Math.cos(object.dir);
								this.yVel += tMlt * object.boostSpeed * Math.sin(object.dir);
							} else if (object.teleport) {
								gotTp = true;
							}
							if (object.zIndex > this.zIndex) this.zIndex = object.zIndex;
						}
					}
				}
			}
			let near = this.near;
			let dx = this.x - near.x;
			let dy = this.y - near.y;
			let tmpLen = this.scale + near.scale;
			if (Math.abs(dx) <= tmpLen || Math.abs(dy) <= tmpLen) {
				tmpLen = this.scale * 2;
				let tmpInt = Math.sqrt(dx * dx + dy * dy) - tmpLen;
				if (tmpInt <= 0) {
					let tmpDir = UTILS.getDirection(this.x, this.y, near.x, near.y)
					tmpInt = (tmpInt * -1) / 2
					this.x += tmpInt * Math.cos(tmpDir)
					this.y += tmpInt * Math.sin(tmpDir)
					this.near.x -= tmpInt * Math.cos(tmpDir)
					this.near.y -= tmpInt * Math.sin(tmpDir)
				}
			}
		}

		/*//check players
		let near = this.near;
		let dx = this.x - near.x;
		let dy = this.y - near.y;
		let tmpLen = this.scale + near.scale;
		if (Math.abs(dx) <= tmpLen || Math.abs(dy) <= tmpLen) {
				tmpLen = this.scale*2;
				let tmpInt = Math.sqrt(dx * dx + dy * dy) - tmpLen;
				if (tmpInt <= 0) {
						let tmpDir = UTILS.getDirection(this.x, this.y, near.x, near.y)
						tmpInt = (tmpInt * -1) / 2
						this.x += tmpInt * Math.cos(tmpDir)
						this.y += tmpInt * Math.sin(tmpDir)
						this.near.x -= tmpInt * Math.cos(tmpDir)
						this.near.y -= tmpInt * Math.sin(tmpDir)
				}
		}
		near = this.near;
		dx = this.x - near.x;
		dy = this.y - near.y;
		tmpLen = this.scale + near.scale;
		if (Math.abs(dx) <= tmpLen || Math.abs(dy) <= tmpLen) {
				tmpLen = this.scale*2;
				let tmpInt = Math.sqrt(dx * dx + dy * dy) - tmpLen;
				if (tmpInt <= 0) {
						let tmpDir = UTILS.getDirection(this.x, this.y, near.x, near.y)
						tmpInt = (tmpInt * -1) / 2
						this.x += tmpInt * Math.cos(tmpDir)
						this.y += tmpInt * Math.sin(tmpDir)
						this.near.x -= tmpInt * Math.cos(tmpDir)
						this.near.y -= tmpInt * Math.sin(tmpDir)
				}
		}
*/
		if (this.xVel) {
			this.xVel *= Math.pow(config.playerDecel, delta);
			if (this.xVel <= 0.01 && this.xVel >= -0.01) this.xVel = 0;
		}
		if (this.yVel) {
			this.yVel *= Math.pow(config.playerDecel, delta);
			if (this.yVel <= 0.01 && this.yVel >= -0.01) this.yVel = 0;
		}

		if (this.x - this.scale < 0) this.x = this.scale;
		else if (this.x + this.scale > config.mapScale) this.x = config.mapScale - this.scale;
		if (this.y - this.scale < 0) this.y = this.scale;
		else if (this.y + this.scale > config.mapScale) this.y = config.mapScale - this.scale;

		return [gotTrapped, gotTp, hitSpikes];
	}
	spikeKB(spike) {
		let x = this.x;
		let y = this.y;
		let xVel = this.xVel;
		let yVel = this.yVel;
		let objX = spike.x;
		let objY = spike.y;
		let objScale = spike.getScale();
	}
}

class Player {
	constructor(
		id,
		sid,
		config,
		UTILS,
		projectileManager,
		objectManager,
		players,
		ais,
		items,
		hats,
		accessories,
		server,
		scoreCallback,
		iconCallback,
	) {
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
		this.pingPredict = -1;
		this.inWater = false;
		this.tails = { 0: 1 };
		this.antiTurretSpam = false;
		for (let i = 0; i < accessories.length; ++i) {
			if (accessories[i].price <= 0) this.tails[accessories[i].id] = 1;
		}
		this.skins = { 0: 1 };
		for (let i = 0; i < hats.length; ++i) {
			if (hats[i].price <= 0) this.skins[hats[i].id] = 1;
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
		this.hitSpike = 0;
		this.iconIndex = 0;
		this.skinColor = 0;
		this.dist2 = 0;
		this.aim2 = 0;
		this.chat = {
			message: null,
			count: 0,
		};
		//this.backupNobull = true;
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
			this.lastshamecount = 0;
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
			this.x2 = 0;
			this.y2 = 0;
			this.zIndex = 0;
			this.x3 = 0;
			this.y3 = 0;
			this.slowMult = 1;
			this.dir = 0;
			this.dirPlus = 0;
			this.targetAngle = 0;
			this.maxHealth = 100;
			this.health = this.maxHealth;
			this.oldHealth = this.maxHealth;
			this.damaged = 0;
			this.scale = config.playerScale;
			this.speed = config.playerSpeed;
			this.moveDir = undefined;
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
			this.primaryReloaded = true;
			this.secondaryReloaded = true;
			this.bowThreat = {
				9: 0,
				12: 0,
				13: 0,
				15: 0,
			};
			this.damageSources = {
				primary: 0,
				secondary: 0,
				turret: 0,
				projectile: 0,
				spike: 0,
				DOT: 0,
				counter: 0,
				AI: 0,
				totalNoSoldier: 0,
				totalSoldier: 0,
				sum: 0,
			};
			this.inTrap = undefined;
			this.lastTrap = false;
			this.escaped = false;
			this.empAnti = false;
			this.canEmpAnti = false;
			this.soldierAnti = false;
			this.needTick = 0;
			this.antiTimer = 2;
			this.healCol = 0;
			this.moveDist = 0;
			updateWeaponXPBars();
		};

		// RESET RESOURCES:
		this.resetResources = function (moofoll) {
			for (let i = 0; i < config.resourceTypes.length; ++i) {
				this[config.resourceTypes[i]] = moofoll ? 100 : 0;
			}
		};

		// ADD ITEM:
		this.getItemType = function (id) {
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

		this.update = function (delta) {
			if (!this.alive) return;
			// MOVE:
			this.noMovTimer += delta;
			if (this.moveDist) this.noMovTimer = 0;
			if (this.slowMult < 1) {
				this.slowMult += 0.0008 * delta;
				if (this.slowMult > 1) {
					this.slowMult = 1;
				}
			}
			let collideObjects = [];
			let already = new Set();
			objectManager.getGridArrays(this.x2, this.y2, this.scale + 1).forEach((arr) => {
				arr.forEach((obj) => {
					if (obj.active && !already.has(obj.sid)) {
						already.add(obj.sid);
						collideObjects.push(obj);
					}
				});
			});

			let hitObjects = collideObjects.filter(
				(e) => UTILS.getDist(e, this, 0, 2) <= this.scale + e.getScale() + 2,
			);
			let nearTrap = hitObjects.filter(
				(e) => e.trap && !e.isTeamObject(this),
			)[0];
			if (nearTrap) nearTrap.hideFromEnemy = false;
			this.lastTrap = this.inTrap;
			this.inTrap = nearTrap;
			this.escaped = !this.inTrap && this.lastTrap;
			if (this.inTrap) {
				this.xVel = 0;
				this.yVel = 0;
			} else {
				this.xVel = (this.x2 - this.oldPos.x2) / delta;
				this.yVel = (this.y2 - this.oldPos.y2) / delta;
				if (this.xVel) {
					this.xVel *= Math.pow(config.playerDecel, delta);
					if (this.xVel <= 0.01 && this.xVel >= -0.01) this.xVel = 0;
				}
				if (this.yVel) {
					this.yVel *= Math.pow(config.playerDecel, delta);
					if (this.yVel <= 0.01 && this.yVel >= -0.01) this.yVel = 0;
				}
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
				} else {
					if (animIndex == 0) {
						tmpRatio += delta / (this.animSpeed * config.hitReturnRatio);
						this.dirPlus = UTILS.lerp(
							0,
							this.targetAngle,
							Math.min(1, tmpRatio),
						);
						if (tmpRatio >= 1) {
							tmpRatio = 1;
							animIndex = 1;
						}
					} else {
						tmpRatio -= delta / (this.animSpeed * (1 - config.hitReturnRatio));
						this.dirPlus = UTILS.lerp(
							0,
							this.targetAngle,
							Math.max(0, tmpRatio),
						);
					}
				}
			}
		};

		// GATHER ANIMATION:
		this.startAnim = function (didHit, index) {
			this.animTime = this.animSpeed = items.weapons[index].speed;
			this.targetAngle = didHit ? -config.hitAngle : -Math.PI;
			tmpRatio = 0;
			animIndex = 0;
		};

		// CAN SEE:
		this.canSee = function (other) {
			if (!other) return false;
			let dx = Math.abs(other.x - this.x) - other.scale;
			let dy = Math.abs(other.y - this.y) - other.scale;
			return (
				dx <= (config.maxScreenWidth / 2) * 1.3 &&
				dy <= (config.maxScreenHeight / 2) * 1.3
			);
		};

		// SHAME SYSTEM:
		this.judgeShame = function () {
			this.lastshamecount = this.shameCount;
			if (this.oldHealth < this.health) {
				if (this.hitTime) {
					let timeSinceHit = Date.now() - this.hitTime;
					this.hitTime = 0;
					if (timeSinceHit < 120) {
						this.shameCount++;
						if (this.canPredictPing) {
							this.canPredictPing = false;
							this.pingPredict = timeSinceHit - ping.min;
						}
					} else {
						this.shameCount = Math.max(0, this.shameCount - 2);
					}
				}
			} else if (this.oldHealth > this.health) {
				let now = Date.now();
				if (now - this.lastHit > 300 && this.sid != player.sid) {
					this.canPredictPing = true;
				}
				this.hitTime = now;
				this.lastHit = now;
			}
		};
		this.addShameTimer = function () {
			this.shameCount = 0;
			this.shameTimer = 30;
			let interval = workerSetInterval(() => {
				this.shameTimer--;
				if (this.shameTimer <= 0) {
					workerClearInterval(interval);
				}
			}, 1000);
		};

		// CHECK TEAM:
		this.isTeam = function (tmpObj) {
			return (
				this.sid == tmpObj.sid ||
				(this.sid == player.sid && alliancePlayers.includes(tmpObj.sid)) ||
				(tmpObj.sid == player.sid && alliancePlayers.includes(this.sid)) ||
				(this.team != null && tmpObj.team != null && this.team == tmpObj.team)
			);
		};

		this.checkCanInsta = function (nobull) {
			let totally = 0;
			if (this.alive && inGame) {
				let primary = {
					weapon: this.weapons[0],
					variant: this.primaryVariant,
					dmg:
						this.weapons[0] == undefined
							? 0
							: items.weapons[this.weapons[0]].dmg,
				};
				let secondary = {
					weapon: this.weapons[1],
					variant: this.secondaryVariant,
					dmg:
						this.weapons[1] == undefined
							? 0
							: items.weapons[this.weapons[1]].Pdmg,
				};
				let bull = this.skins[7] && !nobull ? 1.5 : 1;
				let pV =
					primary.variant != undefined
						? config.weaponVariants[primary.variant].val
						: 1;
				if (primary.weapon != undefined && this.primaryReloaded) {
					totally += primary.dmg * pV * bull;
				}
				if (secondary.weapon != undefined && this.secondaryReloaded) {
					totally += secondary.dmg;
				}
				if (
					this.skins[53] &&
					this.reloads[53] <= (player.weapons[1] == 10 ? 0 : game.tickRate) &&
					near.skinIndex != 22
				) {
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
				this.reloads[53] = 2500 - game.tickRate;
			} else {
				if (this.reloads[53] > 0) {
					this.reloads[53] = Math.max(0, this.reloads[53] - game.tickRate);
				}
			}
			if (this.gathering || this.shooting[1]) {
				if (this.gathering) {
					this.gathering = 0;
					this.reloads[this.gatherIndex] =
						items.weapons[this.gatherIndex].speed *
						(this.skinIndex == 20 ? 0.78 : 1);
					this.attacked = true;
				}
				if (this.shooting[1]) {
					this.shooting[1] = 0;
					this.reloads[this.shootIndex] =
						items.weapons[this.shootIndex].speed *
						(this.skinIndex == 20 ? 0.78 : 1);
					this.attacked = true;
				}
			} else {
				this.attacked = false;
				if (this.buildIndex < 0) {
					if (this.reloads[this.weaponIndex] > 0) {
						this.reloads[this.weaponIndex] = Math.max(
							0,
							this.reloads[this.weaponIndex] - game.tickRate,
						);
						if (
							this.reloads[this.weapons[0]] == 0 &&
							this.reloads[this.weaponIndex] == 0
						) {
							this.antiBull++;
							game.tickBase(() => {
								this.antiBull = 0;
							}, 1);
						}
					}
				}
			}
			if (this.weaponIndex < 9) {
				this.primaryReloaded =
					this.reloads[this.weaponIndex] <=
					game.tickRate * Math.floor(ping.avg / game.tickRate);
			} else {
				this.secondaryReloaded =
					this.reloads[this.weaponIndex] <=
					game.tickRate * Math.floor(ping.avg / game.tickRate);
			}
		};

		// FOR ANTI INSTA:
		this.addDamageThreat = function (type, damage) {
			this.damageSources[type] += damage;
			// animal threat counts at half weight
			this.damageSources.sum += type === "others" ? damage * 0.5 : damage;
			this.damageSources.totalNoSoldier =
				this.damageSources.sum -
				Math.min(
					this.damageSources.primary,
					this.damageSources.secondary + this.damageSources.turret,
				);
			this.damageSources.totalSoldier =
				this.damageSources.totalNoSoldier * 0.75;
		};
		this.removeDamageThreat = function (type, damage) {
			if (!damage) {
				// Undo the weighted contribution before zeroing
				const weighted = type === "others" ? this.damageSources[type] * 0.5 : this.damageSources[type];
				this.damageSources.sum -= weighted;
				this.damageSources[type] = 0;
			} else {
				let before = this.damageSources[type];
				this.damageSources[type] = Math.max(0, this.damageSources[type] - damage);
				let after = this.damageSources[type];
				let diff = before - after;
				this.damageSources.sum -= type === "others" ? diff * 0.5 : diff;
			}
			this.damageSources.totalNoSoldier =
				this.damageSources.sum -
				Math.min(
					this.damageSources.primary,
					this.damageSources.secondary + this.damageSources.turret,
				);
			this.damageSources.totalSoldier =
				this.damageSources.totalNoSoldier * 0.75;
		};

		this.processDamages = function () {
			/* just noting down some stuff:
						plague mask gives poison for 6 ticks
						bull helmet affects great hammer secondary too
						ruby gives poison for 5 ticks
						plague mask + ruby gives poison for 5 ticks
						poison and bull tick happen on the same tick
						*/
			nears.forEach((tmpObj) => {
				let primary = {
					weapon: tmpObj.primaryIndex,
					variant: tmpObj.primaryVariant,
					dmg: 0,
				};
				let secondary = {
					weapon: tmpObj.secondaryIndex,
					variant: tmpObj.secondaryVariant,
					dmg: 0,
				};
				primary.dmg =
					primary.weapon == undefined ? 45 : items.weapons[primary.weapon].dmg;
				secondary.dmg =
					primary.weapon == 0
						? 0
						: secondary.weapon == undefined
							? 50
							: items.weapons[secondary.weapon].Pdmg;
				let pV =
					primary.variant != undefined
						? config.weaponVariants[primary.variant].val
						: 1.18;
				let sV =
					secondary.variant != undefined
						? [9, 12, 13, 15].includes(secondary.weapon)
							? 1
							: config.weaponVariants[secondary.variant].val
						: 1;
				if (primary.weapon == undefined || tmpObj.primaryReloaded) {
					if (tmpObj.tailIndex == 11) {
						primary.dmg = primary.dmg * pV * (player.skinIndex == 7 ? 1.5 : 1);
					} else {
						primary.dmg = primary.dmg * pV * 1.5;
					}
				} else {
					primary.dmg = 0;
				}
				this.addDamageThreat("primary", primary.dmg);
				if (secondary.weapon == undefined || tmpObj.secondaryReloaded) {
					if (secondary.weapon == 10 && tmpObj.tailIndex == 11) {
						secondary.dmg =
							secondary.dmg * sV * (player.skinIndex == 7 ? 1.5 : 1);
					} else {
						secondary.dmg = secondary.dmg * sV;
					}
				} else {
					secondary.dmg = 0;
				}
				this.addDamageThreat("secondary", secondary.dmg);
				if (tmpObj.reloads[53] == 0) {
					this.addDamageThreat("turret", 25);
				}
				if (
					this.poisonCounter > 0 &&
					[0, 7, 8].includes((game.tick - my.bullTick) % 9)
				) {
					this.addDamageThreat("DOT", 5);
				}
			});
		};
	}
}

// SOME CODES:
function sendUpgrade(index) {
	player.reloads[index] = 0;
	packet("H", index);
}

function storeBuy(id, index) {
	packet("c", 1, id, index);
}

let sent = {
	hat: null,
	tail: null,
	weapon: null,
};
function storeEquip(id, index) {
	let nID = player.skins[6] ? 6 : 0;
	if (player.alive && inGame) {
		if (index == 0) {
			if (player.skins[id]) {
				if (sent.hat == null) sent.hat = id;
				if (player.latestSkin != id) {
					packet("c", 0, id, 0);
				}
			} else {
				if (sent.hat == null) sent.hat = nID;
				if (player.latestSkin != nID) {
					packet("c", 0, nID, 0);
				}
			}
		} else if (index == 1) {
			if (player.tails[id]) {
				if (sent.tail == null) sent.tail = id;
				if (player.latestTail != id) {
					packet("c", 0, id, 1);
				}
			} else {
				if (sent.tail == null) sent.tail = 0;
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
	sent.weapon = index;
}

function sendAutoGather(debug) {
	packet("K", 1, debug ? 2 : 1);
}

function resetMoveDir() {
	packet("e");
}

function sendAtck(id, angle) {
	packet("F", id, angle, 1);
}

function place(id, rad, type, tmpX, tmpY) {
	try {
		if (id == undefined) return;
		let item = items.list[player.items[id]];
		if (
			id === 0 ||
			(player.alive &&
				inGame &&
				(player.itemCounts[item.group.id] == undefined ||
					player.itemCounts[item.group.id] <
					(config.isPrivate
						? Infinity
						: config.isSandbox
							? id === 3 || id === 5
								? 299
								: 99
							: item.group.limit || 99)))
		) {
			selectToBuild(player.items[id]);
			sendAtck(1, rad);
			selectWeapon(player.weaponCode, 1);
			if (configs.placeVis) {
				if (!tmpX || !tmpY) {
					let tmpS = player.scale + item.scale + (item.placeOffset || 0);
					tmpX = player.x2 + tmpS * Math.cos(rad);
					tmpY = player.y2 + tmpS * Math.sin(rad);
				}
				let targetArray = type ? preplaceVisible : placeVisible;
				targetArray.push({
					x: tmpX,
					y: tmpY,
					name: item.name,
					scale: item.scale,
					dir: rad,
				});
				workerSetTimeout(() => {
					targetArray.shift();
				}, 111);
			}
		}
	} catch (e) {
		console.log(e);
	}
}

function checkPlace(id, rad, tmpX, tmpY) {
	try {
		if (id == undefined) return;
		let item = items.list[player.items[id]];
		if (!tmpX || !tmpY) {
			let tmpS = player.scale + item?.scale + (item?.placeOffset || 0);
			tmpX = player.x2 + tmpS * Math.cos(rad);
			tmpY = player.y2 + tmpS * Math.sin(rad);
		}
		if (
			objectManager.checkItemLocation(
				tmpX,
				tmpY,
				item.scale,
				0.6,
				item.id,
				false,
			)
		) {
			place(id, rad, 0, tmpX, tmpY);
		}
	} catch (e) { }
}

// HEALING:
function healthBased() {
	if (player.health == player.maxHealth) return 0;
	return Math.ceil(
		(player.maxHealth - player.health) / items.list[player.items[0]].healing,
	);
}

function getAttacker(damaged) {
	let attackers = nears.filter((tmp) => {
		if (tmp.attacked) {
			let index = tmp.weaponIndex;
			let dmg =
				index > 8 ? items.weapons[index].Pdmg : items.weapons[index].dmg;
			let variant = tmp[(index < 9 ? "prima" : "seconda") + "ryVariant"];
			dmg =
				dmg *
				(tmp.skinIndex == 7 ? 1.5 : 1) *
				(tmp.tailIndex == 11 ? 0.2 : 1) *
				config.weaponVariants[variant].val *
				(player.skinIndex == 6 ? 0.75 : 1);
			if (Math.abs(damaged - dmg) < 0.000001) {
				if (player.skinIndex != 23) {
					player.poisonCounter =
						variant == 3 ? 5 : tmp.skinIndex == 21 ? 6 : player.poisonCounter;
				}
				return true;
			}
		}
		return false;
	});
	return attackers;
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
	let healAnti = workerSetInterval(() => {
		if (player.shameCount < 5) {
			place(0, getAttackDir());
		}
	}, 75);
	workerSetTimeout(() => {
		workerClearInterval(healAnti);
		workerSetTimeout(() => {
			my.antiSync = false;
		}, game.tickRate);
	}, game.tickRate);
}
let aCounter = 0;

// Restore funniHat selection from localStorage so game logic can read it immediately
; (function () {
	const s = localStorage.getItem('hatpick-funniHat');
	window.hatpick_funniHat = s ? parseInt(s) : 12;
	const t = localStorage.getItem('hattoggle-funniHat');
	window.hattoggle_funniHat = t === null ? true : t === 'true';
})();

// Resolve animated hat IDs to a real moomoo hat ID
function resolveHatId(hid) {
	if (hid === 1001) { aCounter = (aCounter + 1) % 2; return [8, 15][aCounter]; }
	if (hid === 1002) { const a = [28, 29, 30, 36, 37, 38, 44]; aCounter = (aCounter + 1) % a.length; return a[aCounter]; }
	return hid;
}

function getFunniHat() {
	return window.hatpick_funniHat ?? 12;
}

function biomeGear(mover, returns) {
	if (player.inWater) {
		if (returns) return 31;
		storeEquip(31, 0);
	} else {
		if (configs.hatType && window.hattoggle_funniHat !== false) {
			const hid = resolveHatId(getFunniHat());
			if (returns) return hid;
			storeEquip(hid, 0);
		} else {
			if (player.y2 <= config.snowBiomeTop) {
				if (returns)
					return mover && (player.moveDir == null || player.antiTurretSpam)
						? 22
						: 15;
				storeEquip(
					mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : 15,
					0,
				);
			} else {
				if (returns)
					return mover && (player.moveDir == null || player.antiTurretSpam)
						? 22
						: 12;
				storeEquip(
					mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : 12,
					0,
				);
			}
		}
	}
	if (returns) return 0;
}

function woah(mover) {
	storeEquip(mover && player.moveDir == undefined ? 0 : 11, 1);
}

let advHeal = [];

class Traps {
	constructor(UTILS, items) {
		this.inTrap = false;
	}
}

//some autobreaking system I made. It can definitely be improved more.
//some improvements will be making it calculate with predicted player coordinates instead of x2 and y2 as the game calculates movement before attack. NOT x3 y3 cuz those are dumb predictions and very not accurate. But can use the movement simulator instead
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
			if (e.type == null && UTILS.getDist(player, e, 2, 0) < items.weapons[this.useHammer(e) ? player.weapons[1] : player.weapons[0]].range + e.scale && UTILS.getAngleDist(dir, aim) < Math.PI / 2.6) {
				results.push(e);
			}
		});
		return results; // Return all hittable objects
	}

	getFilteredPriority() {
		const filteredPriority = this.priority.map(list => list.filter(obj => obj.active && UTILS.getDist(obj, player, 0, 2) <= items.weapons[this.useHammer(obj) ? player.weapons[1] : player.weapons[0]].range + obj.scale));
		return filteredPriority;
	}

	calculateAim() {
		const filteredPriority = this.getFilteredPriority();

		// Loop through priority levels from [0] to [3]
		for (let level = 0; level < filteredPriority.length; level++) {
			const targets = filteredPriority[level];

			if (level == 3) {
				if (enemy.length && near.dist2 < 400) {
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
		if (!targetObjs.length) {
			this.active = false;
			this.target = null;
			return; // No targets, no aim
		}

		const checkedAims = new Set(); // To avoid redundant aim checks

		//basically, for multiple objects, we check aim towards each one, and aim between each one. This is enough to find the best angle to hit as many as possible. But doesnt account for if you want to avoid any objects.
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
						if (targetObjs.includes(obj)) reward += 100;
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
					if (targetObjs.includes(obj)) reward += 100;
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
			this.target = this.objectsHit(this.aim).sort((a, b) => UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2))[0];
			this.active = true;

			return;
		}

		let aimAngles = [];
		// Check for single target
		//basically check a few angles around the direct aim too to find some angles to avoid hitting ur own stuff
		const target = targetObjs[0];
		const aimDirect = UTILS.getDirect(targetObjs[0], player, 0, 2);
		let objectsHit = this.objectsHit(aimDirect)
		let reward = 0;

		objectsHit.forEach((obj) => {
			if (targetObjs.includes(obj)) reward += 100;
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
					if (targetObjs.includes(obj)) reward += 100;
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
		this.target = this.objectsHit(this.aim).sort((a, b) => UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2))[0];
		this.active = true;
		return;
	}

	useHammer(object) {
		if (configs.hammerBreakerOptimisation && player.weapons[1] == 10) {
			if (object) {
				if (object.health > 0 && object.health <= items.weapons[player.weapons[0]].dmg && objectManager.canHit(player, object, player.weapons[0]) && ![5, 8].includes(player.weapons[0])) return false;
			}
			return true;
		}
		return false;
	}
}

//was planning to make some kind of new autoplacer but unfortunately not finished too. This is implemented in preplacer tho for some angle calculations. But not used in any combat related stuff other than that
//uses geometry and stuff to find some closest possible angles. No need to use prediction as placers use x2 and y2 in the game code. But for preplacer since its placing next tick need to use predicted coordinates. (something calculated by movementSimulator that I made will be better than x3 y3)
class AutoPlacer {
	constructor() {
		this.additionalObjs = [];
		this.ranges = {};
		this.rangesUpdated = {};
		this.preplaceRanges = {};
		this.debugRender = {};
		this.replaced = true;
		this.antiTrapped = false;
		this.radObjs = [];
		this._angleList = new Map();
		this._angleListTick = 0;
		this.preplaces = [[], []];
		this.replaceSpam = new Map();
		this._preplaced = new Set();
	}
	tryPlaceAngle(id, angle) {
		if (this._angleListTick !== game.tick) { this._angleList.clear(); this._angleListTick = game.tick; }
		const key = (angle * 1000 | 0) + "_" + id;
		const count = this._angleList.get(key) || 0;
		if (count >= 4) return false;
		this._angleList.set(key, count + 1);
		place(id, angle);
		return true;
	}

	closestPossibleAngles(obj, id) {
		const itemId = player.items[id];
		if (!itemId) return;
		const item = items.list[itemId];
		const px = player.x2, py = player.y2;
		const objScale = obj.getScale(0.6, obj.isItem) + 0.01;
		const dx = obj.x - px, dy = obj.y - py;
		const dist2 = dx * dx + dy * dy;
		const dist = Math.sqrt(dist2);
		const threshold = player.scale + objScale + 2 * item.scale + item.placeOffset;

		if (dist > threshold) return [Math.atan2(dy, dx)];

		const D = player.scale + item.scale + item.placeOffset;
		const E = objScale + item.scale;
		const invDist = 1 / dist;
		const a = (D * D - E * E + dist2) * 0.5 * invDist;
		const h2 = D * D - a * a;
		if (h2 <= 0) return [Math.atan2(dy, dx)];
		const h = Math.sqrt(h2);
		const aInv = a * invDist, hInv = h * invDist;
		const px_base = px + aInv * dx, py_base = py + aInv * dy;
		const hdy = hInv * dy, hdx = hInv * dx;

		return [
			Math.atan2(py_base - hdx - py, px_base + hdy - px),
			Math.atan2(py_base + hdx - py, px_base - hdy - px),
		];
	}

	normalizeAngle(a) {
		const twoPi = 6.283185307179586;
		return a < 0 ? a + twoPi : (a > twoPi ? a - twoPi : a);
	}

	// Straight-line distance between two {x,y} objects
	dist(a, b) {
		const dx = a.x - b.x, dy = a.y - b.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	// Project a point from pos along angle by length
	addDir(pos, angle, length) {
		return { x: pos.x + Math.cos(angle) * length, y: pos.y + Math.sin(angle) * length };
	}

	// Shortest angular distance between two angles
	angleDist(a, b) {
		const p = Math.abs(b - a) % 6.283185307179586;
		return p > Math.PI ? 6.283185307179586 - p : p;
	}

	// True if angle is within gap of any angle in a free-arc list
	isAngleFree(angle, ranges, gap = 0) {
		for (let i = 0; i < ranges.length; i++) {
			const [s, e] = ranges[i];
			const na = this.normalizeAngle(angle);
			if (na >= s - gap && na <= e + gap) return true;
		}
		return false;
	}

	// Urgency score for a breakable object: lower = more urgent
	// Accounts for material (stone/gold/diamond/ruby), soldier/tank gear
	urgencyScore(obj, who) {
		const hits = objectManager.hitsToBreak ? (objectManager.hitsToBreak(obj, who) ?? Infinity) : Infinity;
		// Weight by distance: closer = more urgent
		const d = UTILS.getDist(obj, player, 0, 2);
		return hits + d * 0.01;
	}

	// Predicted range check: will enemy be in weapon range next tick?
	inPredictedRange(who, weaponRange) {
		const spd = Math.hypot(who.xVel || 0, who.yVel || 0);
		return (who.dist2 - spd) <= weaponRange;
	}
	normalizeArc(start, end) {
		const twoPi = 6.283185307179586;
		const s = start < 0 ? start + twoPi : (start > twoPi ? start - twoPi : start);
		const e = end < 0 ? end + twoPi : (end > twoPi ? end - twoPi : end);
		const origSpan = (end - start + twoPi) % twoPi;
		const newSpan = (e - s + twoPi) % twoPi;
		return Math.abs(origSpan - newSpan) > 0.000001 ? [e, s] : [s, e];
	}

	mergeBlocked(arcs) {
		const twoPi = 6.283185307179586;
		if (!arcs.length) return [];
		const intervals = [];
		for (let i = 0; i < arcs.length; i++) {
			let s = arcs[i][0], e = arcs[i][1];
			s = s < 0 ? s + twoPi : (s > twoPi ? s - twoPi : s);
			e = e < 0 ? e + twoPi : (e > twoPi ? e - twoPi : e);
			const span = (e - s + twoPi) % twoPi;
			if (span < 0.000001) {
				intervals.push([s, s]);
			} else if (s < e) {
				intervals.push([s, e]);
			} else {
				intervals.push([s, twoPi], [0, e]);
			}
		}
		intervals.sort((a, b) => a[0] - b[0]);
		const merged = [intervals[0]];
		for (let i = 1; i < intervals.length; i++) {
			const s = intervals[i][0], e = intervals[i][1];
			const last = merged[merged.length - 1];
			if (s <= last[1] + 0.000001) {
				last[1] = e > last[1] ? e : last[1];
			} else {
				merged.push([s, e]);
			}
		}
		return merged.length === 1 && merged[0][0] <= 0.000001 && merged[0][1] >= twoPi - 0.000001 ? [[0, twoPi]] : merged;
	}
	invertArcs(merged) {
		const twoPi = 6.283185307179586;
		if (!merged.length) return [[0, twoPi]];
		const free = [];
		for (let i = 0; i < merged.length; i++) {
			const gapStart = merged[i][1];
			const gapEnd = i < merged.length - 1 ? merged[i + 1][0] : merged[0][0] + twoPi;
			if (gapEnd - gapStart > 0.000001) {
				const s = gapStart < 0 ? gapStart + twoPi : (gapStart > twoPi ? gapStart - twoPi : gapStart);
				const e = gapEnd < 0 ? gapEnd + twoPi : (gapEnd > twoPi ? gapEnd - twoPi : gapEnd);
				free.push([s, e]);
			}
		}
		return free;
	}

	angleRanges(id, additionalObjs = []) {
		const itemId = player.items[id];
		if (!itemId) return;
		const item = items.list[itemId];
		const offset = player.scale + item.scale + (item.placeOffset || 0);
		const px = player.x2, py = player.y2;
		const twoPi = 6.283185307179586;
		const rawBlocked = [];
		const totalLen = nearObjs.length + additionalObjs.length;

		for (let i = 0; i < totalLen; i++) {
			const obj = i < nearObjs.length ? nearObjs[i] : additionalObjs[i - nearObjs.length];
			const dx = obj.x - px, dy = obj.y - py;
			if (dx * dx + dy * dy > 40000) continue;

			const angles = this.closestPossibleAngles(obj, id);
			if (!angles || angles.length !== 2) continue;

			const a1 = angles[0], a2 = angles[1];
			const cos1 = Math.cos(a1), sin1 = Math.sin(a1);
			const cos2 = Math.cos(a2), sin2 = Math.sin(a2);
			const v1 = objectManager.checkItemLocation(px + offset * cos1, py + offset * sin1, item.scale, 0.6, id, false);
			const v2 = objectManager.checkItemLocation(px + offset * cos2, py + offset * sin2, item.scale, 0.6, id, false);

			if (v1 && v2) {
				rawBlocked.push([a1, a2]);
			} else if (v1 || v2) {
				const valid = v1 ? a1 : a2;
				const invalid = v1 ? a2 : a1;
				const buildAngle = Math.atan2(dy, dx);
				const cw = (buildAngle - valid + twoPi) % twoPi < (invalid - valid + twoPi) % twoPi;
				rawBlocked.push(cw ? [valid, invalid] : [invalid, valid]);
			} else {
				rawBlocked.push([a1, a2]);
			}
		}
		this.ranges[id] = this.invertArcs(this.mergeBlocked(rawBlocked));
		this.rangesUpdated[id] = true;
	}

	calcPreplace(preplaceObject, id) {
		const itemId = player.items[id];
		if (!itemId) return;
		const item = items.list[itemId];
		const offset = player.scale + item.scale + (item.placeOffset || 0);
		const px = player.x3, py = player.y3;
		const twoPi = 6.283185307179586;
		const rawBlocked = [];
		const preSid = preplaceObject.sid;

		for (let i = 0; i < nearObjs.length; i++) {
			const obj = nearObjs[i];
			if (obj.sid === preSid) continue;
			const dx = obj.x - px, dy = obj.y - py;
			if (dx * dx + dy * dy > 40000) continue;

			const angles = this.closestPossibleAngles(obj, id);
			if (!angles || angles.length !== 2) continue;

			const a1 = angles[0], a2 = angles[1];
			const cos1 = Math.cos(a1), sin1 = Math.sin(a1);
			const cos2 = Math.cos(a2), sin2 = Math.sin(a2);
			const v1 = objectManager.preplaceCheck(px + offset * cos1, py + offset * sin1, item.scale, 0.6, id, false, preplaceObject);
			const v2 = objectManager.preplaceCheck(px + offset * cos2, py + offset * sin2, item.scale, 0.6, id, false, preplaceObject);

			if (v1 && v2) {
				rawBlocked.push([a1, a2]);
			} else if (v1 || v2) {
				const valid = v1 ? a1 : a2;
				const invalid = v1 ? a2 : a1;
				const buildAngle = Math.atan2(dy, dx);
				const cw = (buildAngle - valid + twoPi) % twoPi < (invalid - valid + twoPi) % twoPi;
				rawBlocked.push(cw ? [valid, invalid] : [invalid, valid]);
			} else {
				rawBlocked.push([a1, a2]);
			}
		}
		this.preplaceRanges[id] = this.invertArcs(this.mergeBlocked(rawBlocked));
	}

	angleInArc(angle, start, end) {
		// normalized angles assumed
		if (start < end) {
			return angle >= start && angle <= end;
		} else {
			// wrap-around arc
			return angle >= start || angle <= end;
		}
	}

	closeToAngle(angle, ranges) {
		const twoPi = 6.283185307179586;
		angle = angle < 0 ? angle + twoPi : (angle > twoPi ? angle - twoPi : angle);
		let bestAngle = null;
		let bestDist = Infinity;

		for (let i = 0; i < ranges.length; i++) {
			const start = ranges[i][0], end = ranges[i][1];
			const inArc = start < end ? (angle >= start && angle <= end) : (angle >= start || angle <= end);
			if (inArc) return angle;

			let d1 = Math.abs(start - angle);
			if (d1 > Math.PI) d1 = twoPi - d1;
			if (d1 < bestDist) {
				bestDist = d1;
				bestAngle = start;
			}

			let d2 = Math.abs(end - angle);
			if (d2 > Math.PI) d2 = twoPi - d2;
			if (d2 < bestDist) {
				bestDist = d2;
				bestAngle = end;
			}
		}
		return bestAngle;
	}

	intersectRanges(range1, range2) {
		const TWO_PI = 6.283185307179586;
		const result = [];

		for (let i = 0; i < range1.length; i++) {
			const s1 = range1[i][0], e1 = range1[i][1];
			const wrap1 = s1 > e1;
			const parts1 = wrap1 ? [[s1, TWO_PI], [0, e1]] : [[s1, e1]];

			for (let j = 0; j < range2.length; j++) {
				const s2 = range2[j][0], e2 = range2[j][1];
				const wrap2 = s2 > e2;
				const parts2 = wrap2 ? [[s2, TWO_PI], [0, e2]] : [[s2, e2]];

				for (let k = 0; k < parts1.length; k++) {
					const a1 = parts1[k][0], b1 = parts1[k][1];
					for (let l = 0; l < parts2.length; l++) {
						const a2 = parts2[l][0], b2 = parts2[l][1];
						const start = a1 > a2 ? a1 : a2;
						const end = b1 < b2 ? b1 : b2;
						if (start < end) result.push([start, end]);
					}
				}
			}
		}
		return result;
	}

	testCanPlace(id, first = -1.5707963267948966, repeat = 1.5707963267948966, plus = 0.08726646259971647, radian, loopAll, noOverlap, special) {
		try {
			const item = items.list[player.items[id]];
			if (!item) return;
			const tmpS = player.scale + item.scale + (item.placeOffset || 0);
			const riverMin = config.mapScale / 2 - config.riverWidth / 2;
			const riverMax = config.mapScale / 2 + config.riverWidth / 2;
			const checkRiver = item.id !== 18;
			const px = player.x2, py = player.y2;
			const itemScale = item.scale;
			const itemColDiv = item.colDiv ?? 1;

			const blockers = [];
			for (let t = 0; t < nearObjs.length; t++) {
				const p = nearObjs[t];
				const sc = p.scale * (p.isItem || p.type == 2 || p.type == 3 || p.type == 4 ? 1 : 0.36) * (p.colDiv ?? 1);
				const thr = itemScale + (p.blocker ? p.blocker : sc);
				blockers[t] = { x: p.x, y: p.y, thr2: thr * thr };
			}

			const noOverlapThr2 = noOverlap ? (itemScale * 2 * itemColDiv) ** 2 : 0;
			const checkSpike = (special === 1 || special === 2) && item.dmg && configs.spikeTick;
			const spikeThresh2 = checkSpike ? (player.scale + itemScale) ** 2 : 0;
			const nearX = checkSpike ? near.x2 : 0, nearY = checkSpike ? near.y2 : 0;

			const tryAngle = (relAim) => {
				const cos = Math.cos(relAim), sin = Math.sin(relAim);
				const tmpX = px + tmpS * cos, tmpY = py + tmpS * sin;
				if (checkRiver && tmpY >= riverMin && tmpY <= riverMax) return false;
				for (let t = 0; t < blockers.length; t++) {
					const o = blockers[t];
					const dx = tmpX - o.x, dy = tmpY - o.y;
					if (dx * dx + dy * dy < o.thr2) return false;
				}
				if (!objectManager.checkItemLocation(tmpX, tmpY, itemScale, 0.6, item.id, false)) return false;
				place(id, relAim, 0, tmpX, tmpY);
				if (noOverlap) blockers.push({ x: tmpX, y: tmpY, thr2: noOverlapThr2 });
				if (special === 1) this.preplaces[0].push({ x: tmpX, y: tmpY, scale: itemScale });
				if (checkSpike) {
					const sdx = nearX - tmpX, sdy = nearY - tmpY;
					if (sdx * sdx + sdy * sdy < spikeThresh2) instaC.canSpikeTick = true;
				}
				if (special === 2 && item.dmg && targetPlayer?.isTeam(player)) {
					player.isLeader ? packet("Q", targetPlayer.sid) : packet("N");
				}
				if (special === 3) autoBreak.priority[2].push({ x: tmpX, y: tmpY, scale: 45, health: 200 });
				return true;
			};

			// Geometric intersection: fast-path for first placement (non-loopAll only)
			if (near && !loopAll) {
				const dx = near.x2 - px, dy = near.y2 - py;
				const dist2 = dx * dx + dy * dy;
				const dist = Math.sqrt(dist2);
				const D = tmpS;
				const E = near.scale + itemScale;

				if (dist <= D + E && dist > 0) {
					const invDist = 1 / dist;
					const a = (D * D - E * E + dist2) * 0.5 * invDist;
					const h2 = D * D - a * a;

					if (h2 > 0) {
						const h = Math.sqrt(h2);
						const aInv = a * invDist, hInv = h * invDist;
						const px_base = px + aInv * dx, py_base = py + aInv * dy;
						const hdy = hInv * dy, hdx = hInv * dx;

						const angle1 = Math.atan2(py_base - hdx - py, px_base + hdy - px);
						const angle2 = Math.atan2(py_base + hdx - py, px_base - hdy - px);

						// Try both intersection points — don't return, let spiral run too
						if (angle1 >= radian + first && angle1 <= radian + repeat) tryAngle(angle1);
						if (angle2 >= radian + first && angle2 <= radian + repeat) tryAngle(angle2);
					}
				}
			}

			const end = loopAll ? repeat : repeat - plus * 0.001;
			const steps = Math.round((end - first) / plus);
			const half = steps >> 1;
			const base = radian + first;

			for (let s = 0; s <= half; s++) {
				tryAngle(base + (half + s) * plus);
				if (s > 0) tryAngle(base + (half - s) * plus);
			}
			if ((steps & 1) === 0) tryAngle(radian + end);
		} catch (err) { }
	}

	createObj(item, direct) {
		const offset = player.scale + item.scale + (item.placeOffset || 0);
		return {
			id: item.id,
			dir: direct,
			scale: item.scale,
			colDiv: item.colDiv,
			x: player.x2 + offset * Math.cos(direct),
			y: player.y2 + offset * Math.sin(direct),
			getScale: function (sM, ig) { return this.scale * (ig ? 1 : this.colDiv); },
		};
	}

	radCalc(obj, direct, item, type) {
		const offset = player.scale + item.scale + (item.placeOffset || 0);
		const objScale = obj.getScale(0.6, obj.isItem);
		const px = player.x2, py = player.y2;
		const dx = obj.x - px, dy = obj.y - py;
		const dist2 = dx * dx + dy * dy;
		const combined = objScale + item.scale;
		const combined2 = combined * combined;

		const checkPreplace = (preObj) => {
			const pScale = preObj.scale;
			const px = preObj.x, py = preObj.y;
			for (let i = 0; i < this.preplaces[1].length; i++) {
				const p = this.preplaces[1][i];
				const pdx = p.x - px, pdy = p.y - py;
				const thr = p.scale + pScale;
				if (pdx * pdx + pdy * pdy < thr * thr) return false;
			}
			for (let i = 0; i < this.preplaces[0].length; i++) {
				const p = this.preplaces[0][i];
				const pdx = p.x - px, pdy = p.y - py;
				const thr = p.scale + pScale;
				if (pdx * pdx + pdy * pdy < thr * thr) return false;
			}
			return objectManager.checkItemLocation(px, py, pScale, 0.6, preObj.id, false);
		};

		if (dist2 >= combined2) {
			if (type) return [];
			const preObj = this.createObj(item, direct);
			if (!checkPreplace(preObj)) return [];
			this.preplaces[1].push(preObj);
			return [direct];
		}

		const dist = Math.sqrt(dist2);
		const D = offset, E = combined;
		const a = (D * D - E * E + dist2) / (2 * dist);
		const h2 = D * D - a * a;
		if (h2 < 0) return [];
		const h = Math.sqrt(h2);
		const baseAngle = Math.atan2(dy, dx);
		const spread = Math.atan2(h, a);
		const angle1 = baseAngle + spread, angle2 = baseAngle - spread;

		const result = [];
		const preObj1 = this.createObj(item, angle1);
		if (checkPreplace(preObj1)) {
			this.preplaces[1].push(preObj1);
			result.push(angle1);
		}
		const preObj2 = this.createObj(item, angle2);
		if (checkPreplace(preObj2)) {
			this.preplaces[1].push(preObj2);
			result.push(angle2);
		}
		return result;
	}

	checkSpikeTick() {
		if (!configs.safeAntiSpikeTick || !enemy.length) return false;

		if (near.dist2 <= 200) {
			if (
				player.escaped ||
				(player.inTrap && objectManager.canBeBroken(player.inTrap))
			) {
				if (player.escaped) my.anti0Tick = 2;
				let damage = [13, 15].includes(near.secondaryIndex) ? 35 : 45;
				if (
					!(
						[9, 12, 13, 15].includes(near.secondaryIndex) &&
						near.secondaryReloaded
					)
				) {
					player.addDamageThreat("spike", damage);
				}
				player.chat.message = `Break trap tick detected by ${near.sid} ${near.name}`;
				player.chat.count = 223;
				game.tickBase(() => {
					if (
						!(
							[9, 12, 13, 15].includes(near.secondaryIndex) &&
							near.secondaryReloaded
						)
					) {
						player.addDamageThreat("spike", damage);
					}
				}, 1);
			}
		}
		if (near.dist2 <= 200) {
			if (!player.inTrap) {
				if (near.primaryReloaded) {
					let spikeSet = new Set();
					for (let tmp of nearObjs) {
						if (
							(tmp.dmg && tmp.active && !tmp.isTeamObject(player)) ||
							(tmp.type == 1 && tmp.y >= 12000)
						) {
							let nea = Math.atan2(player.y2 - near.y2, player.x2 - near.x2);
							let primaryKB =
								(items.weapons[near.weapons[0]].knock || 0) *
								items.weapons[near.weapons[0]].range +
								player.scale * 2;
							let secondaryKB = ![undefined, 9, 12, 13, 15].includes(
								near.weapons[1],
							)
								? (items.weapons[near.weapons[1]].knock || 0) *
								items.weapons[near.weapons[1]].range +
								player.scale * 2
								: 60;
							let turretKB = 50;

							let totalKB = primaryKB + secondaryKB + turretKB;
							let steps = 24;
							let stepKB = totalKB / steps;
							let skipDistance = 35;

							for (let i = 1; i <= steps; i++) {
								let traveledDist = stepKB * i;
								if (traveledDist < skipDistance) continue;

								let stepX = player.x2 + stepKB * i * Math.cos(nea);
								let stepY = player.y2 + stepKB * i * Math.sin(nea);

								kbIndc.mex = stepX;
								kbIndc.mey = stepY;

								let distToSpike = UTILS.getDist(
									{ x: stepX, y: stepY },
									tmp,
									0,
									0,
								);

								if (distToSpike <= tmp.getScale() + player.scale * 1.5) {
									spikeSet.add(tmp.sid);
								}
							}
						}
					}
					if (spikeSet.size) {
						spikeSet.forEach((sid) => {
							player.addDamageThreat("spike", findObjectBySid(sid).dmg || 35);
						});
					}
					if ([3, 4, 5].includes(near.primaryIndex) && spikeSet.size) {
						my.anti0Tick = 1;
						player.chat.message = `PaS detected by ${near.sid} ${near.name}`;
						player.chat.count = 112;
					}
				}
			}
		}
	}

	protect(aim) {
		if (!configs.antiTrap) return;
		this.testCanPlace(4, -(Math.PI / 2), Math.PI / 2, Math.PI / 6, aim + Math.PI, true);
		this.testCanPlace(2, -(Math.PI / 3), Math.PI / 3, Math.PI / 6, aim + Math.PI, true);
		this.antiTrapped = true;
	}

	autoPlace(type, id, id2, reasonhaha) {
		if (!enemy.length || !configs.autoPlace) return;
		if (type == 0) {
			if (!id) return;
			const itemId = player.items[id];
			if (!itemId) return;
			const item = items.list[itemId];
			const itemId2 = id2 ? player.items[id2] : null;
			const item2 = itemId2 ? items.list[itemId2] : null;

			this.radObjs = nearObjs;
			if (this.radObjs.length) {
				for (let i = 0; i < this.radObjs.length; i++) {
					const obj = this.radObjs[i];
					const direct = UTILS.getDirect(obj, player, 0, 2);
					const placeAngles = this.radCalc(obj, direct, item);
					if (placeAngles.length) {
						for (let j = 0; j < placeAngles.length; j++) place(id, placeAngles[j]);
					} else if (item2) {
						const placeAngles2 = this.radCalc(obj, direct, item2);
						for (let j = 0; j < placeAngles2.length; j++) place(id2, placeAngles2[j]);
					}
				}
			} else {
				const aim = near.aim2;
				for (let i = 0; i < 6.283185307179586; i += 1.5707963267948966) checkPlace(id, aim + i);
			}
		} else if (type == 1) {
			if (!id) return;
			const itemId = player.items[id];
			if (!itemId) return;
			const item = items.list[itemId];

			this.radObjs = nearObjs.filter((obj) => {
				if (obj.isTeamObject(player)) {
					if (id == 4 ? obj.dmg : obj.trap) {
						return UTILS.getDist(obj, near, 0, 2) < 500;
					}
				}
			});

			if (this.radObjs.length) {
				for (let i = 0; i < this.radObjs.length; i++) {
					const obj = this.radObjs[i];
					const direct = UTILS.getDirect(obj, player, 0, 2);
					const placeAngles = this.radCalc(obj, direct, item, 1);
						for (let j = 0; j < placeAngles.length; j++) place(id, placeAngles[j]);
				}
			}

			if (reasonhaha) {
				this.autoPlace(type, id2, id, false);
			} else if (this.preplaces[1].length < 1) {
					this.autoPlace(0, id2, id);
			}
		}
	}

autoReplace(building) {
	if (!enemy.length || near.dist2 > 300 || !configs.autoReplace || this.replaced || configs.weaponGrind) return;
	(() => {
		this.rangesUpdated[2] = false;
		this.rangesUpdated[4] = false;
		const breakDist = UTILS.getDist(building, player, 0, 2);
		if (breakDist > 300) return;
		if (!this.rangesUpdated[2]) this.angleRanges(2);
		if (!this.rangesUpdated[4]) this.angleRanges(4);

		const breakDir = UTILS.getDirect(building, player, 0, 2);
		const sid = building.sid;
		this.replaced = true;

		const hits = objectManager.hitsToBreak ? (objectManager.hitsToBreak(building, near) ?? Infinity) : Infinity;
		const enemyWpn = items.weapons[near.primaryIndex];
		const predictedInRange = enemyWpn ? this.inPredictedRange(near, enemyWpn.range + building.scale) : true;
		if (hits > 3 && !predictedInRange) return;

		const canSpikeTick =
			configs.spikeTick &&
			!instaC.isTrue &&
			!instaC.spikeTickFired &&
			instaC.spikeTickAngle != null &&
			instaC.spikeTickTrap?.sid === building.sid &&
			near.dist2 <= 300 &&
			player.primaryReloaded &&
			my.anti0Tick <= 0 &&
			!player.empAnti &&
			!my.forceStop &&
			player.weapons[0] != 8 &&
			player.tailIndex != 11;

		if (canSpikeTick) {
			instaC.spikeTickFired = true;
			instaC.canSpikeTick = true;
			place(2, instaC.spikeTickAngle);
			game.tickBase(() => {
				if (instaC.canSpikeTick) instaC.spikeTickType();
				instaC.canSpikeTick = false;
				instaC.spikeTickAngle = null;
				instaC.spikeTickTrap = null;
			}, 0);
			return;
		}

		if (near.escaped) {
			let escSlot = (sid == near.lastTrap?.sid && [4, 5].includes(player.weapons[0]) && player.primaryReloaded && !my.autoPush) ? 2 : 4;
			if (configs.shameGrind && near.shameCount <= 5) escSlot = 4;
			const escRanges = this.ranges[escSlot];
			if (escRanges?.length) {
				place(escSlot, this.closeToAngle(near.aim2, escRanges));
			}
			checkPlace(escSlot, near.aim2);
			checkPlace(escSlot, near.aim2 + 0.17);
			checkPlace(escSlot, near.aim2 - 0.17);
			return;
		}

		if (near.inTrap && UTILS.getDist(player, near.inTrap, 0, 0) <= 169) {
			let replSlot = 2;
			if (configs.shameGrind && near.shameCount <= 5) replSlot = 4;
			const replRanges = this.ranges[replSlot];
			const trapDir = UTILS.getDirect(near.inTrap, player, 0, 2);
			if (replRanges?.length) {
				place(replSlot, this.closeToAngle(trapDir, replRanges));
			}
			return;
		}

		if (player.escaped && sid == player.lastTrap?.sid) {
			const r4 = this.ranges[4];
			if (r4?.length) {
				const randAngle = UTILS.randFloat(0, 6.283185307179586);
				place(4, this.closeToAngle(randAngle, r4));
				place(4, this.closeToAngle(randAngle + Math.PI, r4));
			}
			return;
		}

		const r4 = this.ranges[4];
		if (r4?.length) {
			place(4, this.closeToAngle(breakDir, r4));
			checkPlace(4, breakDir);
		}
	})();
}

findPlacementAngle(id, build) {
	if (!build) return null;
	const item = items.list[player.items[id]];
	if (!item) return null;
	let closeAngles = this.closestPossibleAngles(build, id);
	if (closeAngles.length < 2) return null;
	if (!this.preplaceRanges[id]) this.calcPreplace(build, id);
	let clampRange = [this.normalizeArc(closeAngles[0], closeAngles[1])];
	let preplaceRanges = this.intersectRanges(this.preplaceRanges[id], clampRange);
	if (!preplaceRanges.length) return null;
	if (near.inTrap) {
		if (build.sid != near.inTrap.sid) {
			return this.closeToAngle(UTILS.getDirect(near.inTrap, player, 0, 2), preplaceRanges);
		} else if (id == 4) {
			let spike = nearObjs
				.filter(obj => obj.dmg && obj.isTeamObject(player) && UTILS.getDist(obj, near.inTrap, 0, 0) <= near.inTrap.scale + obj.scale + 69)
				.sort((a, b) => UTILS.getDist(a, near.inTrap, 0, 0) - UTILS.getDist(b, near.inTrap, 0, 0))[0];
			if (spike) {
				let playerObj = { x: near.x2, y: near.y2, getScale: () => player.scale - item.scale };
				let ca = this.closestPossibleAngles(playerObj, id);
				if (ca.length == 2) {
					let retrapRange = [this.normalizeArc(ca[0], ca[1])];
					let intersection = this.intersectRanges(preplaceRanges, retrapRange);
					if (intersection.length) return this.closeToAngle(UTILS.getDirect(spike, player, 0, 2), intersection);
				}
			}
		}
	}
	return this.closeToAngle(UTILS.getDirect(build, player, 0, 2), preplaceRanges);
}

preplacer() {
	if (near.dist2 > 269 || !configs.autoPrePlace) return;
	if (!items.weapons[near.primaryIndex]) return;

	let best = null;

	for (let i = 0; i < nearObjs.length; i++) {
		const obj = nearObjs[i];
		if (!obj.isItem) continue;
		if (obj.isTeamObject(player) && obj.hideFromEnemy && !autoBreak.priority[1].includes(obj)) continue;
		if (!objectManager.canBeBroken(obj)) continue;
		if (UTILS.getDist(obj, player, 0, 2) > 200) continue;

		const hits = objectManager.hitsToBreak(obj, near) ?? Infinity;
		if (hits > 2) continue;

		const score =
			hits * 100000 +
			UTILS.getDist(obj, near, 0, 2) * 10 +
			this.urgencyScore(obj, near);

		if (!best || score < best.score) best = { obj, hits, score };
	}

	if (!best) return;

	if (this._ppSimTick !== game.tick) {
		const sim = new MovementSimulator(player);
		sim.continueTick(game.tickRate, player.moveDir, true);
		sim.continueTick(game.tickRate, player.moveDir, false);
		this._ppSimX = sim.x;
		this._ppSimY = sim.y;
		this._ppSimTick = game.tick;
		this._ppRangeCache = {};
	}

	const obj = best.obj;
	const hits = best.hits;

	if (
		configs.spikeTick &&
		!instaC.isTrue &&
		!instaC.spikeTickFired &&
		instaC.spikeTickAngle != null &&
		instaC.spikeTickTrap?.sid === obj.sid &&
		near.dist2 <= 300 &&
		player.primaryReloaded &&
		my.anti0Tick <= 0 &&
		!player.empAnti &&
		!my.forceStop &&
		player.weapons[0] != 8 &&
		player.tailIndex != 11 &&
		hits <= 1
	) {
		instaC.spikeTickFired = true;
		instaC.canSpikeTick = true;
		place(2, instaC.spikeTickAngle, 1);
		game.tickBase(() => {
			if (instaC.canSpikeTick) instaC.spikeTickType();
			instaC.canSpikeTick = false;
			instaC.spikeTickAngle = null;
			instaC.spikeTickTrap = null;
		}, 0);
		return;
	}

	let buildId;
	if (configs.shameGrind && near.inTrap) {
		buildId = near.shameCount > 5 ? 2 : 4;
	} else {
		buildId = near.inTrap && !my.autoPush && ((options.autoPrePlace == "spike" && player.primaryReloaded) || obj.sid != near.inTrap?.sid) ? 2 : 4;
	}

	const ox2 = player.x2, oy2 = player.y2, ox3 = player.x3, oy3 = player.y3;
	player.x2 = this._ppSimX;
	player.y2 = this._ppSimY;
	player.x3 = this._ppSimX;
	player.y3 = this._ppSimY;

	const ck = obj.sid + "_" + buildId;
	if (!this._ppRangeCache[ck]) {
		this.calcPreplace(obj, buildId);
		this._ppRangeCache[ck] = this.preplaceRanges[buildId];
	} else {
		this.preplaceRanges[buildId] = this._ppRangeCache[ck];
	}

	let angle = this.findPlacementAngle(buildId, obj);
	let usedId = buildId;

	if (angle == null && hits <= 1) {
		const fb = buildId === 2 ? 4 : 2;
		const fbk = obj.sid + "_" + fb;
		if (!this._ppRangeCache[fbk]) {
			this.calcPreplace(obj, fb);
			this._ppRangeCache[fbk] = this.preplaceRanges[fb];
		} else {
			this.preplaceRanges[fb] = this._ppRangeCache[fbk];
		}
		angle = this.findPlacementAngle(fb, obj);
		usedId = fb;
	}

	player.x2 = ox2;
	player.y2 = oy2;
	player.x3 = ox3;
	player.y3 = oy3;

	if (angle != null) {
		place(usedId, angle, 1);
	}
}
}


// ============================================================
// PATHFINDER — Web Worker, waypoint-based, velocity-aware
// Algorithm: deterministic waypoint search (perp bypass pts + 6-angle fallback)
// Trigger: G key → pathfind to current cursor world position
// Protocol: main sends snapshot → worker runs physics → returns best path + preview coords
// ============================================================

const PATHFINDER_WORKER_SRC = `
'use strict';

// Physics constants injected per message
let CFG;

// Simulate one server tick — logic mirrors MovementSimulator.continueTick
let shouldRAHHHHHHHHHHH = true;
function simulateTick(s, moveDir, objs, delta) {
    // slowMult decays back to 1 over time (same rate as server)
    if (s.slowMult < 1) {
        s.slowMult += 0.0008 * delta;
        if (s.slowMult > 1) s.slowMult = 1;
    }

    // Effective speed multiplier (baseSpdMult already includes hat/tail/weapon/snow)
    let spdMult = s.baseSpdMult * s.slowMult;

    // River / water biome (matches continueTick)
    if (CFG.riverHalfWidth > 0) {
        const rc = CFG.mapScale / 2;
        if (s.y >= rc - CFG.riverHalfWidth && s.y <= rc + CFG.riverHalfWidth) {
            if (s.waterImm) { spdMult *= 0.75; s.xVel += CFG.waterCurrent * 0.4 * delta; }
            else            { spdMult *= 0.33; s.xVel += CFG.waterCurrent * delta; }
        }
    }

    // Apply movement (guard with if(dx)/if(dy) matching server behaviour)
    if (moveDir !== null && moveDir !== undefined) {
        const dx = Math.cos(moveDir), dy = Math.sin(moveDir);
        if (dx) s.xVel += dx * CFG.playerSpeed * spdMult * delta;
        if (dy) s.yVel += dy * CFG.playerSpeed * spdMult * delta;
    }

    // Depth-based sub-step collision (already set is outside loop — matches server)
    let hitBad = false; // set true if player hits a trap or teleport
    const tmpSpd = Math.sqrt(s.xVel * s.xVel + s.yVel * s.yVel) * delta;
    const depth  = Math.min(4, Math.max(1, Math.round(tmpSpd / 40)));
    const tMlt   = 1 / depth;
    const already = new Set();

    for (let d = 0; d < depth; d++) {
        if (s.xVel) s.x += s.xVel * delta * tMlt;
        if (s.yVel) s.y += s.yVel * delta * tMlt;
        for (let i = 0; i < objs.length; i++) {
            const obj = objs[i];
            if (already.has(obj.sid)) continue;
            const ox = s.x - obj.x, oy = s.y - obj.y;
            const tLen = s.scale + obj.objScale;
            if (!(Math.abs(ox) <= tLen || Math.abs(oy) <= tLen)) continue;
            already.add(obj.sid);
            if (Math.sqrt(ox * ox + oy * oy) <= tLen) {
                if (!obj.ignoreCollision) {
                    const ang = Math.atan2(oy, ox);
                    s.x = obj.x + tLen * Math.cos(ang);
                    s.y = obj.y + tLen * Math.sin(ang);
                    s.xVel *= 0.75; s.yVel *= 0.75;
                    // Cactus (type=1 in snow) or spike (dmg, not team) — matches continueTick
                    if ((obj.type === 1 && obj.y >= 12000) || (obj.dmg && !obj.isTeam) && shouldRAHHHHHHHHHHH) {
                        s.xVel += 1.5 * Math.cos(ang);
                        s.yVel += 1.5 * Math.sin(ang);
					} else if (!shouldRAHHHHHHHHHHH) {
						hitBad = true;
					}
                } else if ((obj.trap && !obj.isTeam) || obj.teleport) {
                    hitBad = true; // beam search will discard paths through these
                } else if (obj.boostSpeed) {
                    s.xVel += tMlt * obj.boostSpeed * Math.cos(obj.dir);
                    s.yVel += tMlt * obj.boostSpeed * Math.sin(obj.dir);
                }
            }
        }
    }

    // Deceleration
    if (s.xVel) { s.xVel *= Math.pow(CFG.playerDecel, delta); if (Math.abs(s.xVel) < 0.01) s.xVel = 0; }
    if (s.yVel) { s.yVel *= Math.pow(CFG.playerDecel, delta); if (Math.abs(s.yVel) < 0.01) s.yVel = 0; }

    // Map bounds
    const mx = CFG.mapScale - s.scale;
    s.x = Math.max(s.scale, Math.min(mx, s.x));
    s.y = Math.max(s.scale, Math.min(mx, s.y));
    return hitBad;
}

// Simulate near enemy (coasts on its own velocity, no input)
function simulateNearTick(n, objs, delta) {
    const tmpSpd = Math.sqrt(n.xVel * n.xVel + n.yVel * n.yVel) * delta;
    const depth  = Math.min(4, Math.max(1, Math.round(tmpSpd / 40)));
    const tMlt   = 1 / depth;
    const already = new Set();
    for (let d = 0; d < depth; d++) {
        if (n.xVel) n.x += n.xVel * delta * tMlt;
        if (n.yVel) n.y += n.yVel * delta * tMlt;
        for (let i = 0; i < objs.length; i++) {
            const obj = objs[i];
            if (obj.ignoreCollision || already.has(obj.sid)) continue;
            const ox = n.x - obj.x, oy = n.y - obj.y;
            const tLen = n.scale + obj.objScale;
            if (Math.abs(ox) > tLen && Math.abs(oy) > tLen) continue;
            already.add(obj.sid);
            if (Math.sqrt(ox * ox + oy * oy) <= tLen) {
                const ang = Math.atan2(oy, ox);
                n.x = obj.x + tLen * Math.cos(ang);
                n.y = obj.y + tLen * Math.sin(ang);
                n.xVel *= 0.75; n.yVel *= 0.75;
            }
        }
    }
    if (n.xVel) { n.xVel *= Math.pow(CFG.playerDecel, delta); if (Math.abs(n.xVel) < 0.01) n.xVel = 0; }
    if (n.yVel) { n.yVel *= Math.pow(CFG.playerDecel, delta); if (Math.abs(n.yVel) < 0.01) n.yVel = 0; }
    const mx = CFG.mapScale - n.scale;
    n.x = Math.max(n.scale, Math.min(mx, n.x));
    n.y = Math.max(n.scale, Math.min(mx, n.y));
}

// Push two players apart if overlapping
function resolvePlayerCollision(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    const minDist = a.scale + b.scale;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist && dist > 0) {
        const nx = dx / dist, ny = dy / dist;
        const push = (minDist - dist) * 0.5;
        a.x += nx * push; a.y += ny * push;
        b.x -= nx * push; b.y -= ny * push;
        a.xVel *= 0.75; a.yVel *= 0.75;
    }
}

// ---- Beam search helpers ----
function dist2D(a, b) { const dx = a.x-b.x, dy = a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }
function cloneState(s) {
    return {x: s.x, y: s.y, xVel: s.xVel, yVel: s.yVel, scale: s.scale,
            baseSpdMult: s.baseSpdMult, slowMult: s.slowMult, waterImm: s.waterImm};
}
function cloneNear(n) { return n ? {x: n.x, y: n.y, xVel: n.xVel, yVel: n.yVel, scale: n.scale} : null; }

const ARRIVE_THRESH = 69;  // within this world-unit dist of target = arrived
const BEAM_WIDTH    = 400;   // max beams kept per tick (safety cap for grid selection)
const GRID_SIZE     = 100;   // spatial grid cell size for beam diversity (world units)

self.onmessage = function(e) {
    CFG = e.data.cfg;
    const {objs, target, maxTicks, delta} = e.data;
    const ip = e.data.player;
    const iN = e.data.near;

    if (dist2D(ip, target) < ARRIVE_THRESH) {
        self.postMessage({path: [], score: 0, waypoints: [], ticksUsed: 0});
        return;
    }

    // Each beam: { state, near, path[], sumDist }
    // sumDist = cumulative sum of dist(pos, target) at each tick.
    // Lower sumDist = got close to target faster overall.
    let beams = [{state: cloneState(ip), near: cloneNear(iN), path: [], sumDist: 0}];

    let bestPath = null, bestTicks = Infinity, bestSumDist = Infinity;
    // Fallback: track the single closest approach in case target is never reached
    let closestPath = [], closestDist = dist2D(ip, target), closestSumDist = 0;

    tickLoop:
    for (let tick = 0; tick < maxTicks; tick++) {
        const candidates = [];

        for (let bi = 0; bi < beams.length; bi++) {
            const {state, near, path, sumDist} = beams[bi];

            // 25 directions in [targetDir - PI/2, targetDir + PI/2] + velocity direction
            // Recomputed each tick from this beam's current position
            const targetDir = Math.atan2(target.y - state.y, target.x - state.x);
            const dirs = [];
            for (let k = -12; k <= 12; k++) dirs.push(targetDir + k * (Math.PI / 16));
            // Preserve momentum: add current velocity direction so fast-moving beams
            // can continue through gaps without being forced to recompute angle
            const spd = Math.sqrt(state.xVel * state.xVel + state.yVel * state.yVel);
            if (spd > 0.05) dirs.push(Math.atan2(state.yVel, state.xVel));

            for (let di = 0; di < dirs.length; di++) {
                const ns = cloneState(state);
                const nn = cloneNear(near);
                if (simulateTick(ns, dirs[di], objs, delta)) continue; // hit trap/teleport
                if (nn) { simulateNearTick(nn, objs, delta); resolvePlayerCollision(ns, nn); }

                const d      = dist2D(ns, target);
                const newPath = path.concat(dirs[di]);
                const newSum  = sumDist + d;

                // Track closest approach for fallback
                if (d < closestDist) { closestDist = d; closestPath = newPath; closestSumDist = newSum; }

                if (d < ARRIVE_THRESH) {
                    // Primary: fewest ticks. Tiebreak: lowest cumulative dist (fastest approach)
                    if (newPath.length < bestTicks ||
                        (newPath.length === bestTicks && newSum < bestSumDist)) {
                        bestPath = newPath.slice(); bestTicks = newPath.length; bestSumDist = newSum;
                    }
                } else {
                    candidates.push({state: ns, near: nn, path: newPath, score: d, sumDist: newSum});
                }
            }
        }

        // All beams in this tick processed — stop if any path arrived (tick+1 can't be shorter)
        if (bestPath) break tickLoop;

        // Grid-based beam selection: one beam per GRID_SIZE cell, best sumDist wins.
        // This guarantees spatial diversity — beams exploring different routes around
        // obstacles land in different cells and both survive, unlike distance-sorted dedup
        // where the greedy "closest to target" beam always kills the exploratory one.
        const cellMap = new Map();
        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            const key = Math.floor(c.state.x / GRID_SIZE) * 100003 +
                        Math.floor(c.state.y / GRID_SIZE);
            const ex = cellMap.get(key);
            // Within a cell, keep the beam with the lowest cumulative distance
            // (i.e. the one that approached the target fastest over its whole path)
            if (!ex || c.sumDist < ex.sumDist) cellMap.set(key, c);
        }
        beams = [...cellMap.values()];
        // Safety cap: if too many occupied cells, trim to BEAM_WIDTH by score
        if (beams.length > BEAM_WIDTH) {
            beams.sort((a, b) => a.score - b.score);
            beams = beams.slice(0, BEAM_WIDTH);
        }
        if (!beams.length) break;
    }

    const finalPath = bestPath || closestPath;
    if (!finalPath.length) {
        self.postMessage({path: [], score: Infinity, waypoints: [], ticksUsed: 0});
        return;
    }

    // Re-simulate best path to build overlay waypoints
    const waypoints = [];
    const sv = cloneState(ip);
    const sn = cloneNear(iN);
    for (let i = 0; i < finalPath.length; i++) {
        simulateTick(sv, finalPath[i], objs, delta);
        if (sn) { simulateNearTick(sn, objs, delta); resolvePlayerCollision(sv, sn); }
        waypoints.push({x: sv.x, y: sv.y});
    }

    self.postMessage({
        path:      finalPath,
        score:     bestPath ? bestSumDist : closestDist,
        waypoints,
        ticksUsed: finalPath.length
    });
};
`

// ---- Worker lifecycle ----
let _pathfinderWorker = null;
let pathfinderExecuting = false; // true while a found path is being replayed via tickBase
const pathfinderRender = { target: null, waypoints: [] };

function getPathfinderWorker() {
	if (_pathfinderWorker) return _pathfinderWorker;
	const blob = new Blob([PATHFINDER_WORKER_SRC], { type: 'application/javascript' });
	_pathfinderWorker = new Worker(URL.createObjectURL(blob));
	_pathfinderWorker.onmessage = function (e) {
		const { path, score, waypoints, ticksUsed } = e.data;
		if (!path || !player || !player.alive) return;
		console.log(`%c[Pathfinder] ${ticksUsed} ticks, resting dist=${score.toFixed(1)} | path=[${path.map(d => d === null ? 'stop' : (d * 180 / Math.PI).toFixed(0) + '\xb0').join(', ')}]`, 'color: orange; font-weight: bold');
		pathfinderRender.waypoints = waypoints;
		executePathfinderPath(path);
	};
	_pathfinderWorker.onerror = function (e) {
		console.error('[Pathfinder] Worker error:', e.message, 'line', e.lineno);
		pathfinderExecuting = false;
	};
	return _pathfinderWorker;
}

// ---- State snapshot & serialisation ----
function serializeForPathfinder() {
	const hat = findID(hats, player.skinIndex);
	const tail = findID(accessories, player.tailIndex);
	const weapon = items.weapons[player.weaponIndex] || items.weapons[0];
	const buildPenalty = (player.buildIndex >= 0) ? 0.5 : 1;
	// baseSpdMult excludes slowMult so the worker can decay it per-tick accurately
	const baseSpdMult = buildPenalty *
		(weapon.spdMult || 1) *
		(hat ? (hat.spdMult || 1) : 1) *
		(tail ? (tail.spdMult || 1) : 1) *
		(player.y2 <= config.snowBiomeTop ? (hat && hat.coldM ? 1 : config.snowSpeed) : 1);

	const playerState = {
		x: player.x2, y: player.y2,
		xVel: player.xVel, yVel: player.yVel,
		scale: player.scale || 35,
		baseSpdMult,
		slowMult: player.slowMult != null ? player.slowMult : 1,
		waterImm: !!(hat && hat.watrImm),
	};

	let nearState = null;
	if (typeof near !== 'undefined' && near && near.alive) {
		nearState = { x: near.x2, y: near.y2, xVel: near.xVel || 0, yVel: near.yVel || 0, scale: near.scale || 35 };
	}

	const seen = new Set();
	const objects = [];
	let midPoint = UTILS.findMiddlePoint(player, mousePos, 2, 0);
	const grids = objectManager.getGridArrays(midPoint.x, midPoint.y, UTILS.getDistance(player.x2, player.y2, mousePos.x, mousePos.y));
	for (let gx = 0; gx < grids.length; gx++) {
		for (let gy = 0; gy < grids[gx].length; gy++) {
			const obj = grids[gx][gy];
			if (!obj.active || seen.has(obj.sid)) continue;
			seen.add(obj.sid);
			objects.push({
				x: obj.x, y: obj.y, sid: obj.sid,
				objScale: obj.getScale(),
				ignoreCollision: !!obj.ignoreCollision,
				boostSpeed: obj.boostSpeed || 0,
				dir: obj.dir || 0,
				dmg: obj.dmg || 0,
				type: obj.type || 0,
				isTeam: !!obj.isTeamObject(player),
				trap: !!obj.trap,
				teleport: !!obj.teleport,
			});
		}
	}

	return { playerState, nearState, objects };
}

// ---- Trigger pathfinding ----
let _pathfinderTarget = null;

function triggerPathFinder(targetX, targetY, shouldRAHHHHHHHHHHHH) {
	if (!player || !player.alive) return;
	shouldRAHHHHHHHHHHH = !!shouldRAHHHHHHHHHHHH;
	_pathfinderTarget = { x: targetX, y: targetY };
	pathfinderRender.target = _pathfinderTarget;
	pathfinderRender.waypoints = [];
	_pathfinderDispatch();
}

function _pathfinderDispatch() {
	if (!player || !player.alive || !_pathfinderTarget) return;
	// arrived — stop
	if (Math.hypot(player.x2 - _pathfinderTarget.x, player.y2 - _pathfinderTarget.y) < 69) {
		_pathfinderTarget = null;
		pathfinderRender.target = null;
		pathfinderRender.waypoints = [];
		return;
	}
	if (pathfinderExecuting) return;
	pathfinderExecuting = true;
	const { playerState, nearState, objects } = serializeForPathfinder();
	getPathfinderWorker().postMessage({
		player: playerState,
		near: nearState,
		objs: objects,
		target: _pathfinderTarget,
		maxTicks: 60,
		maxIter: 2000,
		delta: game.tickRate - 0.2,
		cfg: {
			playerSpeed: config.playerSpeed || 0.0016,
			playerDecel: config.playerDecel || 0.993,
			mapScale: config.mapScale || 14400,
			riverHalfWidth: (config.riverWidth || 0) / 2,
			waterCurrent: config.waterCurrent || 0,
		}
	});
}

// ---- Execute: send first direction, re-dispatch next tick with fresh state ----
function executePathfinderPath(path) {
	pathfinderExecuting = false;
	if (!player || !player.alive || !_pathfinderTarget) return;
	if (path && path.length > 0) {
		packet('9', path[0], 1);
	}
	// re-dispatch next tick — fresh serialize picks up current hat/speed/position
	game.tickBase(() => _pathfinderDispatch(), 1);
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
		this.baseGrid = [];
		this.foundPath = false;

		this.cachedBlockers = [];
		this.cacheKey = "";
		this.baseKey = "";

		this.lastGameObjectCount = -1;
		this.lastPlayerScale = -1;
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
		return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
	}

	getObjX(obj) {
		return obj.x2 ?? obj.x3 ?? obj.x;
	}

	getObjY(obj) {
		return obj.y2 ?? obj.y3 ?? obj.y;
	}

	dist2(ax, ay, bx, by) {
		const dx = ax - bx;
		const dy = ay - by;
		return dx * dx + dy * dy;
	}

	isRelevantBlocker(obj) {
		if (!obj) return false;
		// passable: no collision or explicitly ignored
		if (obj.ignoreCollision) return false;
		// enemy dmg/trap objects are always blockers (gaps in spike walls are deadly)
		if (!obj.isTeamObject(player) && (obj.dmg || obj.trap)) return true;
		// team objects: passable (we can walk through our own stuff)
		if (obj.isTeamObject(player)) return false;
		// everything else with real collision is a blocker
		return true;
	}

	makeBlockerCacheKey() {
		let count = gameObjects.length;
		let px = (player.x2 ?? player.x3 ?? player.x ?? 0) | 0;
		let py = (player.y2 ?? player.y3 ?? player.y ?? 0) | 0;
		let ps = player.scale | 0;
		return count + "|" + px + "|" + py + "|" + ps;
	}

	rebuildBlockerCache() {
		this.cachedBlockers = [];

		for (let i = 0; i < gameObjects.length; i++) {
			const obj = gameObjects[i];
			if (!obj || !this.isRelevantBlocker(obj)) continue;

			const x = this.getObjX(obj);
			const y = this.getObjY(obj);
			if (x == null || y == null) continue;

			this.cachedBlockers.push({
				x,
				y,
				r: obj.getScale(0.6, obj.isItem) + player.scale
			});
		}

		this.cacheKey = this.makeBlockerCacheKey();
		this.lastGameObjectCount = gameObjects.length;
		this.lastPlayerScale = player.scale;
	}

	ensureBlockerCache() {
		const nextKey = this.makeBlockerCacheKey();
		if (
			this.cacheKey !== nextKey ||
			this.lastGameObjectCount !== gameObjects.length ||
			this.lastPlayerScale !== player.scale
		) {
			this.rebuildBlockerCache();
		}
	}

	stampCircle(grid, worldX, worldY, radius, centX, centY, griScale) {
		const gx = Math.round((worldX - centX) / griScale);
		const gy = Math.round((worldY - centY) / griScale);
		const cellRadius = Math.ceil(radius / griScale);

		const minY = Math.max(0, gy - cellRadius);
		const maxY = Math.min(PF.gridSize - 1, gy + cellRadius);
		const minX = Math.max(0, gx - cellRadius);
		const maxX = Math.min(PF.gridSize - 1, gx + cellRadius);

		const rr = radius * radius;

		for (let y = minY; y <= maxY; y++) {
			const wy = centY + griScale * y;
			const dy = wy - worldY;
			const dy2 = dy * dy;

			for (let x = minX; x <= maxX; x++) {
				const wx = centX + griScale * x;
				const dx = wx - worldX;
				if (dx * dx + dy2 <= rr) {
					grid[y][x] = 1;
				}
			}
		}
	}

	makeBaseGridKey(centX, centY, griScale) {
		const snap = griScale * 2;
		const sx = Math.round(centX / snap);
		const sy = Math.round(centY / snap);
		return sx + "|" + sy + "|" + griScale + "|" + player.scale + "|" + this.cacheKey;
	}

	buildBaseGrid(centX, centY, griScale) {
		this.ensureBlockerCache();

		this.baseGrid = new Array(PF.gridSize);

		const minPos = player.scale;
		const maxPos = config.mapScale - player.scale;

		for (let y = 0; y < PF.gridSize; y++) {
			const row = new Uint8Array(PF.gridSize);
			const wy = centY + griScale * y;

			for (let x = 0; x < PF.gridSize; x++) {
				const wx = centX + griScale * x;
				if (wx < minPos || wx > maxPos || wy < minPos || wy > maxPos) {
					row[x] = 1;
				}
			}

			this.baseGrid[y] = row;
		}

		for (let i = 0; i < this.cachedBlockers.length; i++) {
			const obj = this.cachedBlockers[i];
			this.stampCircle(this.baseGrid, obj.x, obj.y, obj.r, centX, centY, griScale);
		}

		this.baseKey = this.makeBaseGridKey(centX, centY, griScale);
	}

	ensureBaseGrid(centX, centY, griScale) {
		this.ensureBlockerCache();

		const nextKey = this.makeBaseGridKey(centX, centY, griScale);
		if (this.baseKey !== nextKey || !this.baseGrid.length) {
			this.buildBaseGrid(centX, centY, griScale);
		}
	}

	cloneBaseGrid() {
		this.grid = new Array(PF.gridSize);
		for (let i = 0; i < PF.gridSize; i++) {
			this.grid[i] = this.baseGrid[i].slice();
		}
	}

	init(delPos, reFind, type) {
		let goalPos = { x: 0, y: 0 };
		let bestDist = Infinity;

		const centX = Math.round(player.x3) - (PF.scale / 2);
		const centY = Math.round(player.y3) - (PF.scale / 2);
		const griScale = PF.scale / PF.gridSize;

		const overScale = [griScale - 10, griScale + 10];
		const targetX = near.x2 - delPos.x;
		const targetY = near.y2 - delPos.y;

		this.ensureBaseGrid(centX, centY, griScale);
		this.cloneBaseGrid();

		const playerX = player.x2 ?? player.x3 ?? player.x;
		const playerY = player.y2 ?? player.y3 ?? player.y;
		const playerR2 = player.scale * player.scale;

		const nearX = near.x2 ?? near.x;
		const nearY = near.y2 ?? near.y;
		const nearBlockR = near.scale + player.scale;
		const nearBlockR2 = nearBlockR * nearBlockR;

		const targetR = overScale[1];
		const targetR2 = targetR * targetR;

		for (let i = 0; i < PF.gridSize; i++) {
			const posY = centY + griScale * i;

			for (let i2 = 0; i2 < PF.gridSize; i2++) {
				const posX = centX + griScale * i2;

				if (this.dist2(posX, posY, playerX, playerY) <= playerR2) {
					this.grid[i][i2] = 0;
					continue;
				}

				const tdist2 = this.dist2(posX, posY, targetX, targetY);
				if (tdist2 <= targetR2) {
					if (tdist2 < bestDist) {
						bestDist = tdist2;
						goalPos = { x: i2, y: i };
					}
					this.grid[i][i2] = 0;
					continue;
				}

				if (type == "auto push") {
					if (this.dist2(posX, posY, nearX, nearY) <= nearBlockR2) {
						this.grid[i][i2] = 1;
						continue;
					}
				}
			}
		}

		this.foundPath = false;

		const start = {
			x: Math.round(PF.gridSize / 2),
			y: Math.round(PF.gridSize / 2)
		};

		if (this.grid[start.y]?.[start.x] === 1) {
			return { start: null, goal: null };
		}

		if (bestDist === Infinity) {
			return { start: null, goal: null };
		}

		if (this.grid[goalPos.y]?.[goalPos.x] === 1) {
			const neighbors = this.getPaths(goalPos);
			let freeNeighbor = null;

			for (let i = 0; i < neighbors.length; i++) {
				const pos = neighbors[i];
				if (
					pos.x >= 0 &&
					pos.y >= 0 &&
					pos.x < PF.gridSize &&
					pos.y < PF.gridSize &&
					this.grid[pos.y]?.[pos.x] === 0
				) {
					freeNeighbor = pos;
					break;
				}
			}

			if (freeNeighbor) {
				goalPos = freeNeighbor;
			} else {
				return { start: null, goal: null };
			}
		}

		return { start, goal: goalPos };
	}

	calc(delPos, reFind, type) {
		const data = this.init(delPos, reFind, type);
		if (!data.start || !data.goal) {
			return { paths: [], attempts: 0 };
		}

		const start = data.goal;
		const goal = data.start;

		let search = {
			x: start.x,
			y: start.y
		};

		const paths = [{
			x: search.x,
			y: search.y,
			score: this.getScore(search, goal),
			seek: 0,
			hop: 0,
			start: true
		}];

		let searchPaths = this.getPaths(search);

		if (this.grid[start.y][start.x] == 1 || this.grid[goal.y][goal.x] == 1) {
			return { paths: [], attempts: 0 };
		}

		const visited = new Uint8Array(PF.gridSize * PF.gridSize);
		const idx = (x, y) => y * PF.gridSize + x;
		visited[idx(search.x, search.y)] = 1;

		for (let i = 0; i < searchPaths.length; i++) {
			const searchPath = searchPaths[i];

			if (
				searchPath.x < 0 ||
				searchPath.y < 0 ||
				searchPath.x > PF.gridSize - 1 ||
				searchPath.y > PF.gridSize - 1
			) {
				continue;
			}

			if (this.grid[searchPath.y][searchPath.x] == 1) continue;

			const id = idx(searchPath.x, searchPath.y);
			if (visited[id]) continue;
			visited[id] = 1;

			paths.push({
				x: searchPath.x,
				y: searchPath.y,
				score: this.getScore(searchPath, goal),
				seek: 0,
				hop: 1
			});
		}

		const foundPaths = [];
		let i = 0;
		const startTime = performance.now();

		while (performance.now() - startTime <= 1 && i < 500) {
			if (this.foundPath || (search.x == goal.x && search.y == goal.y)) {
				if (!this.foundPath) {
					this.foundPath = true;
					foundPaths.push({
						x: player.x2 - (PF.scale / 2) + (PF.scale / PF.gridSize) * search.x,
						y: player.y2 - (PF.scale / 2) + (PF.scale / PF.gridSize) * search.y
					});
				}

				let nearPath = null;
				for (let j = 0; j < paths.length; j++) {
					const a = paths[j];
					if ((a.seek == 1 || a.start) && Math.abs(a.x - search.x) <= 1 && Math.abs(a.y - search.y) <= 1) {
						if (!nearPath || a.hop < nearPath.hop) {
							nearPath = a;
						}
					}
				}

				if (nearPath) {
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
				let nearPath = null;
				for (let j = 0; j < paths.length; j++) {
					const a = paths[j];
					if (a.seek == 0) {
						if (!nearPath || a.score < nearPath.score) {
							nearPath = a;
						}
					}
				}

				if (nearPath) {
					search = {
						x: nearPath.x,
						y: nearPath.y
					};
					nearPath.seek = 1;

					searchPaths = this.getPaths(search);

					const hop = nearPath.hop + 1;
					for (let j = 0; j < searchPaths.length; j++) {
						const searchPath = searchPaths[j];

						if (
							searchPath.x < 0 ||
							searchPath.y < 0 ||
							searchPath.x > PF.gridSize - 1 ||
							searchPath.y > PF.gridSize - 1
						) {
							continue;
						}

						if (this.grid[searchPath.y][searchPath.x] == 1) continue;

						const id = idx(searchPath.x, searchPath.y);
						if (visited[id]) continue;
						visited[id] = 1;

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

			i++;
		}

		return {
			paths: foundPaths,
			attempts: i
		};
	}
}

function isPositionSafe(x, y, options = {}) {
	const {
		checkAllSpikes = false, // false = only check own/ally spikes, true = check all spikes
		ownSpikeDistance = 83, // Safe distance from own/ally spikes
		enemySpikeDistance = 103, // Safe distance from enemy spikes
		checkEnemy = true, // Whether to check enemy distance
		enemyDistance = 75, // Safe distance from nearest enemy
	} = options;

	if (
		x < player.scale ||
		x > config.mapScale - player.scale ||
		y < player.scale ||
		y > config.mapScale - player.scale
	)
		return false;

	for (let obj of nearObjs) {
		if (obj.trap || obj.dmg) continue;

		let requiredDistance = obj.scale + 35;
		let distance = UTILS.getDistance(x, y, obj.x, obj.y);

		if (distance < requiredDistance) {
			return false;
		}
	}

	// Get spikes based on filter mode (more strict check for spikes)
	let allSpikes = checkAllSpikes
		? nearObjs.filter((object) => object.dmg)
		: nearObjs.filter((object) => object.dmg && object.isTeamObject(player));

	// Check distance from spikes with specific distances
	for (let spike of allSpikes) {
		let isMySpike = spike.isTeamObject(player);
		let safeDistance = isMySpike ? ownSpikeDistance : enemySpikeDistance;
		let distance = UTILS.getDistance(x, y, spike.x, spike.y);

		if (distance < safeDistance) {
			return false;
		}
	}

	// Check distance from nearest enemy
	if (checkEnemy) {
		let distance = UTILS.getDistance(x, y, near.x3, near.y3);
		if (distance < enemyDistance) {
			return false;
		}
	}

	return true;
}

function findSafePath(startX, startY, endX, endY, options = {}) {
	const {
		gridSpacing = 35,
		maxRange = 800,
		maxNodes = 300,
		safetyOptions = {}, // Options to pass to isPositionSafe
	} = options;

	// Helper to get grid key
	const getKey = (x, y) =>
		`${Math.round(x / gridSpacing) * gridSpacing},${Math.round(y / gridSpacing) * gridSpacing}`;

	// Helper to get neighbors
	const getNeighbors = (x, y) => {
		let neighbors = [];
		for (let dx = -gridSpacing; dx <= gridSpacing; dx += gridSpacing) {
			for (let dy = -gridSpacing; dy <= gridSpacing; dy += gridSpacing) {
				if (dx === 0 && dy === 0) continue;
				let nx = x + dx;
				let ny = y + dy;
				if (UTILS.getDistance(startX, startY, nx, ny) <= maxRange) {
					neighbors.push({ x: nx, y: ny });
				}
			}
		}
		return neighbors;
	};

	// A* algorithm
	let openSet = [
		{
			x: startX,
			y: startY,
			g: 0,
			h: UTILS.getDistance(startX, startY, endX, endY),
			f: 0,
			parent: null,
		},
	];
	let closedSet = new Set();
	let allNodes = new Map();

	allNodes.set(getKey(startX, startY), openSet[0]);

	while (openSet.length > 0) {
		// Get node with lowest f score
		openSet.sort((a, b) => a.f - b.f);
		let current = openSet.shift();
		let currentKey = getKey(current.x, current.y);

		// Check if we reached the goal
		if (UTILS.getDistance(current.x, current.y, endX, endY) < gridSpacing * 2) {
			// Reconstruct path
			let path = [];
			let node = current;
			while (node) {
				path.unshift({ x: node.x, y: node.y });
				node = node.parent;
			}
			return path;
		}

		closedSet.add(currentKey);

		// Check neighbors
		let neighbors = getNeighbors(current.x, current.y);
		for (let neighbor of neighbors) {
			let neighborKey = getKey(neighbor.x, neighbor.y);

			if (closedSet.has(neighborKey)) continue;

			// Skip unsafe positions using provided safety options
			if (!isPositionSafe(neighbor.x, neighbor.y, safetyOptions)) continue;

			let g =
				current.g +
				UTILS.getDistance(current.x, current.y, neighbor.x, neighbor.y);
			let h = UTILS.getDistance(neighbor.x, neighbor.y, endX, endY);
			let f = g + h;

			let existingNode = allNodes.get(neighborKey);
			if (!existingNode || g < existingNode.g) {
				let newNode = {
					x: neighbor.x,
					y: neighbor.y,
					g,
					h,
					f,
					parent: current,
				};
				allNodes.set(neighborKey, newNode);

				if (!existingNode) {
					openSet.push(newNode);
				}
			}
		}

		// Prevent infinite loop
		if (closedSet.size > maxNodes) break;
	}

	return null; // No path found
}
/*
				const makeWorker = (fn) => {
						let blobURL = URL.createObjectURL(
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
										const minDist = 35 * 2;
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
										if (configs.autoPush) {
												my.autoPush = true;
												packet("9", Math.atan2(resolveData.y, resolveData.x), 1);
										}
								}
						} else {
								PF.active = false;
								PF.paths = [];
								if (UTILS.getDist(player, my.pushData, 2, 2) > 69) {
										if (my.autoPush) {
												my.autoPush = false;
										}
								}
						}
				};*/

let agentTarget = {};

class Instakill {
	constructor() {
		this.wait = false;
		this.can = false;
		this.isTrue = false;
		this.nobull = false;
		this.ticking = false;
		this.canSpikeTick = false;
		this.spikeTickAngle = null;
		this.spikeTickFired = false;
		this.spikeTickTrap = null;
		this.canMusketSync = false;
		this.startTick = false;
		this.readyTick = false;
		this.canCounter = false;
		this.revTick = false;
		this.syncHit = false;
		this.velTickActive = false;
		this.shameGrinding = false;

		this.velTickType = function () {
			try {
				if (this.isTrue) return;
				if (!player || !player.alive || !inGame) return;
				if (!near || !near.alive || !enemy.length) return;
				if (!player.skins[53]) return;
				if (player.reloads?.[53] > 0) return;
				if (my.autoPush) return;

				const now = Date.now();
				const targetSid = near.sid;

				const ping = window.pingTime ?? window.ping ?? 0;
				const tickMs = 1000 / (game.tickRate || 9);

				const getAim = (baseLeadTicks) => {
					if (!near || near.sid !== targetSid) return null;
					const vx0 = near.x1 != null ? near.x2 - near.x1 : 0;
					const vy0 = near.y1 != null ? near.y2 - near.y1 : 0;
					const s0 = Math.hypot(vx0, vy0);
					const pxNow = player.x2;
					const pyNow = player.y2;
					const pvx0 = this._velTickLastPx != null ? pxNow - this._velTickLastPx : 0;
					const pvy0 = this._velTickLastPy != null ? pyNow - this._velTickLastPy : 0;
					this._velTickLastPx = pxNow;
					this._velTickLastPy = pyNow;
					const ps0 = Math.hypot(pvx0, pvy0);
					if (this._velTickVx == null) { this._velTickVx = vx0; this._velTickVy = vy0; }
					else { const a = s0 > 0.35 ? 0.55 : 0.35; this._velTickVx = this._velTickVx * (1 - a) + vx0 * a; this._velTickVy = this._velTickVy * (1 - a) + vy0 * a; }
					if (this._velTickPVx == null) { this._velTickPVx = pvx0; this._velTickPVy = pvy0; }
					else { const a = ps0 > 0.35 ? 0.65 : 0.35; this._velTickPVx = this._velTickPVx * (1 - a) + pvx0 * a; this._velTickPVy = this._velTickPVy * (1 - a) + pvy0 * a; }
					const leadTicks = Math.max(0, Math.min(10, Math.round((baseLeadTicks || 0) + ping / tickMs)));
					if (s0 < 0.01 && ps0 < 0.01) return near.aim2;
					const shooterX = pxNow + (this._velTickPVx || 0) * leadTicks;
					const shooterY = pyNow + (this._velTickPVy || 0) * leadTicks;
					const predX = near.x2 + (this._velTickVx || 0) * leadTicks;
					const predY = near.y2 + (this._velTickVy || 0) * leadTicks;
					return Math.atan2(predY - shooterY, predX - shooterX);
				};

				if (!items?.weapons || player.weapons?.[0] === undefined) return;
				const weaponInfo = items.weapons[player.weapons[0]];
				if (!weaponInfo) return;

				const distToEnemy = near.dist2 !== undefined ? near.dist2 : UTILS.getDist(player, near, 0, 2);
				const triggerRange = weaponInfo.range + near.scale * 1.8;
				const outerRange = triggerRange + 30;

				if (distToEnemy > outerRange) return;

				const ex = near.x2, ey = near.y2;
				const px = player.x2, py = player.y2;
				const evx = near.x1 != null ? ex - near.x1 : 0;
				const evy = near.y1 != null ? ey - near.y1 : 0;
				const pvx = this._velTickLastPx != null ? px - this._velTickLastPx : 0;
				const pvy = this._velTickLastPy != null ? py - this._velTickLastPy : 0;
				const dx = px - ex, dy = py - ey;
				const dist = Math.hypot(dx, dy) || 1;
				const enemyClosing = (evx * dx + evy * dy) / dist > 0.5;
				const playerClosing = (pvx * dx + pvy * dy) / dist > 0.5;
				const inRange = distToEnemy <= triggerRange;

				if (!inRange && !enemyClosing && !playerClosing) return;

				if (!this.canKillPrimary()) return;

				this.isTrue = true;
				my.autoAim = true;

				if (distToEnemy <= triggerRange) packet("9", undefined, 1);
				const isAlt = [10, 14].includes(player.weapons[1]);
				const tickWeapon = player.weapons[isAlt ? 1 : 0];
				selectWeapon(tickWeapon);
				biomeGear();
				storeEquip(11, 1);
				packet("9", getAim(3) ?? near.aim2, 1);
				game.tickBase(() => {
					selectWeapon(tickWeapon);
					storeEquip(53, 0);
					storeEquip(11, 1);
					packet("9", getAim(2) ?? near.aim2, 1);
					game.tickBase(() => {
						selectWeapon(player.weapons[0]);
						storeEquip(7, 0);
						storeEquip(19, 1);
						if (!my.autoGathering) sendAutoGather();
						packet("9", getAim(1) ?? near.aim2, 1);
						game.tickBase(() => {
							if (!my.autoGathering) sendAutoGather();
							this.isTrue = false;
							my.autoAim = false;
							packet("9", undefined, 1);
						}, 1);
					}, 1);
				}, 1);
			} catch (err) {
				this.isTrue = false;
				my.autoAim = false;
				packet("9", undefined, 1);
			}
		};

		this.changeType = function (type) {
			this.wait = false;
			this.isTrue = true;
			my.autoAim = true;
			if (type == "rev") {
				selectWeapon(player.weapons[1]);
				storeEquip(53, 0);
				sendAutoGather();
				setTimeout(() => {
					selectWeapon(player.weapons[0]);
					storeEquip(7, 0);
					setTimeout(() => {
						sendAutoGather();
						this.isTrue = false;
						my.autoAim = false;
					}, 95 + 126);
				}, 95 + 1);
			} else if (type == "nobull") {
				selectWeapon(player.weapons[0]);
				storeEquip(7, 0);
				sendAutoGather();
				setTimeout(() => {
					selectWeapon(player.weapons[1]);
					storeEquip(player.reloads[53] == 0 ? 53 : 6, 0);
					setTimeout(() => {
						sendAutoGather();
						this.isTrue = false;
						my.autoAim = false;
					}, 95 + 126);
				}, 95 + 1);
			} else if (type == "normal") {
				selectWeapon(player.weapons[0]);
				storeEquip(7, 0);
				sendAutoGather();
				setTimeout(() => {
					selectWeapon(player.weapons[1]);
					storeEquip(player.reloads[53] == 0 ? 53 : 6, 0);
					setTimeout(() => {
						sendAutoGather();
						this.isTrue = false;
						my.autoAim = false;
					}, 95 + 126);
				}, 95 + 1);
				/*
								selectWeapon(player.weapons[0]);
								storeEquip(7, 0);
								if (!my.autoGathering) sendAutoGather();
								game.tickBase(() => {
										selectWeapon(player.weapons[1]);
										storeEquip((player.reloads[53] == 0 && near.skinIndex != 22) ? 53 : 6, 0);
										game.tickBase(() => {
												this.isTrue = false;
												my.autoAim = false;
										}, 1);
								}, 1);*/
			} else {
				workerSetTimeout(() => {
					this.isTrue = false;
					my.autoAim = false;
				}, 50);
			}
		};
		this.spikeTickType = function (type) {
			this.isTrue = true;
			my.autoAim = true;
			selectWeapon(player.weapons[0]);
			if (type == "rev" && player.reloads[53] == 0) {
				storeEquip(53, 0);
				game.tickBase(() => {
					storeEquip(7, 0);
					if (!my.autoGathering) sendAutoGather();
					game.tickBase(() => {
						this.isTrue = false;
						my.autoAim = false;
					}, 1);
				}, 1);
			} else {
				storeEquip(7, 0);
				if (!my.autoGathering) sendAutoGather();
				game.tickBase(() => {
					if (player.reloads[53] == 0 && configs.turretCombat) {
						storeEquip(53, 0);
						game.tickBase(() => {
							this.isTrue = false;
							my.autoAim = false;
						}, 1);
					} else {
						this.isTrue = false;
						my.autoAim = false;
					}
				}, 1);
			}
		};
		this.shameGrindType = function () {
			this.isTrue = true;
			this.shameGrinding = true;
			my.autoAim = true;
			selectWeapon(player.weapons[1]);
			storeEquip(near.shameCount > 5 ? 40 : 7, 0);
			storeEquip(21, 1);
			if (!my.autoGathering) sendAutoGather();
			game.tickBase(() => {
				this.shameGrinding = false;
				storeEquip(6, 0);
				game.tickBase(() => {
					this.isTrue = false;
					my.autoAim = false;
				}, 1);
			}, 1);
		};
		this.counterType = function () {
			this.isTrue = true;
			my.autoAim = true;
			selectWeapon(player.weapons[0]);
			storeEquip(7, 0);
			storeEquip(21, 1);
			if (!my.autoGathering) sendAutoGather();
			game.tickBase(() => {
				if (player.reloads[53] == 0 && configs.turretCombat) {
					selectWeapon(player.weapons[0]);
					storeEquip(53, 0);
					storeEquip(21, 1);
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
		this.rangeType = function (type) {
			this.isTrue = true;
			my.aimTarget = true;
			if (type == "ageInsta") {
				my.ageInsta = false;
				if (player.items[5] == 18) {
					autoPlace.testCanPlace(5, 0, Math.PI * 2, Math.PI / 3, near.aim2, true);
				}
				packet("9", undefined, 1);
				storeEquip(53, 0);
				game.tickBase(() => {
					selectWeapon(player.weapons[1]);
					storeEquip(53, 0);
					if (!my.autoGathering) sendAutoGather();
					game.tickBase(() => {
						sendUpgrade(12);
						selectWeapon(player.weapons[1]);
						storeEquip(53, 0);
						game.tickBase(() => {
							sendUpgrade(15);
							selectWeapon(player.weapons[1]);
							storeEquip(53, 0);
							game.tickBase(() => {
								this.isTrue = false;
								my.aimTarget = false;
								this.ticking = false;
							}, 3);
						}, 1);
					}, 1);
				}, 2);
			} else {
				selectWeapon(player.weapons[1]);
				if (
					player.reloads[53] == 0 &&
					near.dist2 <= 700 &&
					near.skinIndex != 22
				) {
					storeEquip(53, 0);
				} else {
					storeEquip(20, 0);
				}
				if (!my.autoGathering) sendAutoGather();
				game.tickBase(() => {
					this.isTrue = false;
					my.aimTarget = false;
				}, 1);
			}
		};
		this.musketSync = function () {
			if (player.weapons[1] != 15) return;
			this.isTrue = true;
			my.autoAim = true;
			if (player.items[5] == 18)
				autoPlace.testCanPlace(5, 0, Math.PI * 2, Math.PI / 3, near.aim2, true);
			storeEquip(53, 0);
			selectWeapon(player.weapons[1]);
			if (!my.autoGathering) sendAutoGather();
			game.tickBase(() => {
				this.isTrue = false;
				my.autoAim = false;
			}, 1);
		};
		this.canKillPrimary = function () {
			const pw = items.weapons[player.weapons[0]];
			if (!near || !pw || player.reloads[player.weapons[0]] != 0) return false;
			if ((near.dist2 ?? UTILS.getDist(player, near, 0, 2)) > pw.range + near.scale * 1.8) return false;
			const s = near.skinIndex == 6;
			const dmg = pw.dmg * (player.primaryVariant != null ? config.weaponVariants[player.primaryVariant].val : 1) * (player.skins[7] ? 1.5 : 1) * (s ? 0.75 : 1) + (player.skins[53] && player.reloads[53] <= game.tickRate && near.skinIndex != 22 ? (s ? 19 : 25) : 0);
			return near.health <= dmg;
		};
		this.zeroFrameType = function () {
			try {
				const canKill = () => this.canKillPrimary();

				const canStart =
					!this.isTrue &&
					configs.zeroFrame &&
					player &&
					player.alive &&
					inGame &&
					near &&
					near.alive &&
					enemy.length &&
					!my.autoPush &&
					canKill();
				if (!canStart) return;

				const now = Date.now();
				if (this.zeroFrameCdUntil && now < this.zeroFrameCdUntil) return;

				const finalDistCheck = near.dist2 !== undefined ? near.dist2 : UTILS.getDist(player, near, 0, 2);
				const weaponRange = items.weapons[player.weapons[0]].range + near.scale * 1.8;

				if (finalDistCheck > weaponRange) {
					packet("9", near.aim2, 1);
					return;
				}

				this.zeroFrameCdUntil = now + (player.inTrap ? 1500 : 5000);
				if (typeof notif === "function") notif("One Tick");
				if (typeof this.setInstaType === "function") this.setInstaType("One Tick");
				this.lastTarget = near?.name || "Unknown";

				this.isTrue = true;
				my.autoAim = true;
				selectWeapon(
					player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0],
				);
				storeEquip(11, 1);
				packet("9", simPredictAngle(near, 3), 1);
				game.tickBase(() => {
					selectWeapon(
						player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0],
					);
					storeEquip(53, 0);
					storeEquip(11, 1);
					packet("9", simPredictAngle(near, 2), 1);
					game.tickBase(() => {
						selectWeapon(player.weapons[0]);
						storeEquip(7, 0);
						storeEquip(19, 1);
						if (!my.autoGathering) sendAutoGather();
						packet("9", simPredictAngle(near, 1), 1);
						game.tickBase(() => {
							this.isTrue = false;
							my.autoAim = false;
							packet("9", undefined, 1);
						}, 1);
					}, 1);
				}, 1);
			} catch (err) {
				console.log("Zero Frame Error:", err);
				this.isTrue = false;
				my.autoAim = false;
				packet("9", undefined, 1);
			}
		};
		this.primaryKillType = function () {
			const canKillWithTurret = () => {
				if (!near || player.reloads[53] == 0) return false;
				const turretDamage = near.skinIndex === 6 ? 19 : 25;
				return near.dist2 <= 700 && near.health <= turretDamage;
			};
			if (canKillWithTurret()) {
				storeEquip(53, 0);
			}
		};
		this.oneTickType = function () {
			this.isTrue = true;
			this.ticking = true;
			my.aimTarget = true;
			packet("9", near.aim2, 1);
			game.tickBase(() => {
				if (player.weapons[1] == 15) {
					my.revAim = true;
				}
				selectWeapon(
					player.weapons[
					[9, 10, 12, 13, 15].includes(player.weapons[1]) ? 1 : 0
					],
				);
				storeEquip(53, 0);
				if ([9, 12, 13, 15].includes(player.weapons[1])) {
					if (!my.autoGathering) sendAutoGather();
				}
				game.tickBase(() => {
					my.revAim = false;
					selectWeapon(player.weapons[0]);
					storeEquip(7, 0);
					if (!my.autoGathering) sendAutoGather();
					packet("9", near.aim2, 1);
					game.tickBase(() => {
						this.isTrue = false;
						this.ticking = false;
						my.aimTarget = false;
						this.goTickThem = false;
						packet("9", undefined, 1);
					}, 1);
				}, 1);
			}, 1);
		};
		this.threeOneTickType = function () {
			this.isTrue = true;
			my.autoAim = true;
			selectWeapon(
				player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0],
			);
			storeEquip(11, 1);
			packet("9", targetPlayer?.aim2, 1);
			game.tickBase(() => {
				selectWeapon(
					player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0],
				);
				storeEquip(53, 0);
				storeEquip(11, 1);
				packet("9", targetPlayer?.aim2, 1);
				game.tickBase(() => {
					selectWeapon(player.weapons[0]);
					storeEquip(7, 0);
					storeEquip(19, 1);
					if (!my.autoGathering) sendAutoGather();
					packet("9", targetPlayer?.aim2, 1);
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
			storeEquip(53, 0);
			game.tickBase(() => {
				my.revAim = false;
				selectWeapon(player.weapons[0]);
				storeEquip(7, 0);
				if (!my.autoGathering) sendAutoGather();
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
			this.isTrue = true;
			my.aimTarget = true;

			// Calculate predicted position with velocity
			let aimAngle = targetPlayer?.aim2;
			let boostAngle = targetPlayer?.aim2; // Angle for boost placement

			if (targetPlayer && targetPlayer.visible) {
				const velX = targetPlayer.x2 - targetPlayer.x;
				const velY = targetPlayer.y2 - targetPlayer.y;
				const enemySpeed = Math.hypot(velX, velY);

				if (enemySpeed > 0.1) {
					// Get projectile speed for prediction
					let weapon = items.weapons[player.weapons[1]];
					let projectileSpeed = weapon ? (weapon.projSpd || weapon.speed || 500) : 500;

					// Predict enemy position
					const currentDist = Math.hypot(targetPlayer.x2 - player.x2, targetPlayer.y2 - player.y2);
					const timeToHit = currentDist / projectileSpeed;

					const predX = targetPlayer.x2 + velX * timeToHit * 50;
					const predY = targetPlayer.y2 + velY * timeToHit * 50;

					// Movement angle: towards the boost (so you move through it)
					aimAngle = Math.atan2(targetPlayer.y2 - player.y2, targetPlayer.x2 - player.x2);

					// Boost angle: place boost towards CURRENT enemy position (not predicted)
					// This ensures boost is placed towards where enemy is now
					const distToEnemy = Math.hypot(targetPlayer.x2 - player.x2, targetPlayer.y2 - player.y2);
					const boostDistance = Math.min(distToEnemy * 0.6, 100); // 60% of distance, max 100 units

					// Position boost along the path to CURRENT enemy position
					const enemyAngle = Math.atan2(targetPlayer.y2 - player.y2, targetPlayer.x2 - player.x2);
					const boostX = player.x2 + Math.cos(enemyAngle) * boostDistance;
					const boostY = player.y2 + Math.sin(enemyAngle) * boostDistance;

					// Angle from player to boost position (same as enemyAngle)
					boostAngle = enemyAngle;
				}
			}

			packet("9", aimAngle, 1);
			game.tickBase(() => {
				if (player.weapons[1] == 15) {
					my.revAim = true;
				}
				selectWeapon(
					player.weapons[[9, 12, 13, 15].includes(player.weapons[1]) ? 1 : 0],
				);
				storeEquip(53, 0);
				if ([9, 12, 13, 15].includes(player.weapons[1])) {
					if (!my.autoGathering) sendAutoGather();
				}
				place(4, boostAngle); // Place boost towards predicted position
				game.tickBase(() => {
					my.revAim = false;
					selectWeapon(player.weapons[0]);
					storeEquip(7, 0);
					if (!my.autoGathering) sendAutoGather();
					game.tickBase(() => {
						this.isTrue = false;
						my.aimTarget = false;
						packet("9", undefined, 1);
						this.goTickThem = false;
					}, 1);
				}, 1);
			}, 1);
		};
		this.gotoGoal = function (goto, OT) {
			let slowDists = (weeeee) => weeeee * player.scale;
			let goal = {
				a: goto - OT,
				b: goto + OT,
				c: goto - slowDists(1),
				d: goto + slowDists(1),
				e: goto - slowDists(2),
				f: goto + slowDists(2),
				g: goto - slowDists(4),
				h: goto + slowDists(4),
			};
			let bQ = function (wwww, awwww) {
				if (player.inWater && awwww == 0) {
					storeEquip(31, 0);
				} else {
					storeEquip(wwww, awwww);
				}
			};
			if (enemy.length) {
				let dst = targetPlayer?.dist2 || near.dist2;
				this.ticking = true;
				if (dst >= goal.a && dst <= goal.b) {
					bQ(0, 0);
					if (
						player.weaponIndex !=
						player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0] ||
						player.buildIndex > -1
					) {
						selectWeapon(
							player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0],
						);
					}
					return {
						dir: undefined,
						action: 1,
					};
				} else {
					if (dst < goal.a) {
						if (dst >= goal.g) {
							if (dst >= goal.e) {
								if (dst >= goal.c) {
									bQ(40, 0);
									bQ(0, 1);
									if (configs.slowOT) {
										player.buildIndex != player.items[1] &&
											selectToBuild(player.items[1]);
									} else {
										if (
											player.weaponIndex !=
											player.weapons[
											[10, 14].includes(player.weapons[1]) ? 1 : 0
											] ||
											player.buildIndex > -1
										) {
											selectWeapon(
												player.weapons[
												[10, 14].includes(player.weapons[1]) ? 1 : 0
												],
											);
										}
									}
								} else {
									bQ(22, 0);
									bQ(0, 1);
									if (
										player.weaponIndex !=
										player.weapons[
										[10, 14].includes(player.weapons[1]) ? 1 : 0
										] ||
										player.buildIndex > -1
									) {
										selectWeapon(
											player.weapons[
											[10, 14].includes(player.weapons[1]) ? 1 : 0
											],
										);
									}
								}
							} else {
								bQ(6, 0);
								bQ(0, 1);
								if (
									player.weaponIndex !=
									player.weapons[
									[10, 14].includes(player.weapons[1]) ? 1 : 0
									] ||
									player.buildIndex > -1
								) {
									selectWeapon(
										player.weapons[
										[10, 14].includes(player.weapons[1]) ? 1 : 0
										],
									);
								}
							}
						} else {
							biomeGear(1);
							bQ(11, 1);
							if (
								player.weaponIndex !=
								player.weapons[
								[10, 14].includes(player.weapons[1]) ? 1 : 0
								] ||
								player.buildIndex > -1
							) {
								selectWeapon(
									player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0],
								);
							}
						}
						return {
							dir: targetPlayer?.aim2 + Math.PI,
							action: 0,
						};
					} else if (dst > goal.b) {
						if (dst <= goal.h) {
							if (dst <= goal.f) {
								if (dst <= goal.d) {
									bQ(40, 0);
									bQ(0, 1);
									if (configs.slowOT) {
										player.buildIndex != player.items[1] &&
											selectToBuild(player.items[1]);
									} else {
										if (
											player.weaponIndex !=
											player.weapons[
											[10, 14].includes(player.weapons[1]) ? 1 : 0
											] ||
											player.buildIndex > -1
										) {
											selectWeapon(
												player.weapons[
												[10, 14].includes(player.weapons[1]) ? 1 : 0
												],
											);
										}
									}
								} else {
									bQ(22, 0);
									bQ(0, 1);
									if (
										player.weaponIndex !=
										player.weapons[
										[10, 14].includes(player.weapons[1]) ? 1 : 0
										] ||
										player.buildIndex > -1
									) {
										selectWeapon(
											player.weapons[
											[10, 14].includes(player.weapons[1]) ? 1 : 0
											],
										);
									}
								}
							} else {
								bQ(6, 0);
								bQ(0, 1);
								if (
									player.weaponIndex !=
									player.weapons[
									[10, 14].includes(player.weapons[1]) ? 1 : 0
									] ||
									player.buildIndex > -1
								) {
									selectWeapon(
										player.weapons[
										[10, 14].includes(player.weapons[1]) ? 1 : 0
										],
									);
								}
							}
						} else {
							biomeGear(1);
							bQ(11, 1);
							if (
								player.weaponIndex !=
								player.weapons[
								[10, 14].includes(player.weapons[1]) ? 1 : 0
								] ||
								player.buildIndex > -1
							) {
								selectWeapon(
									player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0],
								);
							}
						}
						return {
							dir: targetPlayer?.aim2,
							action: 0,
						};
					}
					return {
						dir: undefined,
						action: 0,
					};
				}
			} else {
				this.ticking = false;
				return {
					dir: undefined,
					action: 0,
				};
			}
		};
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
		};
		this.tickMovement = function () {
			this.ticking = true;
			let moveMent = this.gotoGoal(
				[10, 14].includes(player.weapons[1]) && player.y2 > config.snowBiomeTop
					? 243
					: player.weapons[1] == 15
						? 270
						: player.y2 <= config.snowBiomeTop
							? [10, 14].includes(player.weapons[1])
								? 233
								: 231
							: 240,
				3,
			);
			if (moveMent.action) {
				if (near.skinIndex != 22 && player.reloads[53] == 0 && !this.isTrue) {
					this.oneTickType();
				} else {
					packet("9", moveMent.dir, 1);
				}
			} else {
				packet("9", moveMent.dir, 1);
			}
		};
		this.goTickThem = false;
		this.boostTickMovement = function () {
			let dist =
				player.weapons[1] == 9
					? 365
					: player.weapons[1] == 12
						? 380
						: player.weapons[1] == 13
							? 365
							: player.weapons[1] == 15
								? 365
								: 370;
			let moveMent = this.gotoGoal(372, 20);
			if (moveMent.action) {
				if (player.reloads[53] == 0 && !this.isTrue) {
					this.boostTickType();
				} else {
					packet("9", moveMent.dir, 1);
				}
			} else {
				packet("9", moveMent.dir, 1);
			}
		};
		/** wait 1 tick for better quality */
		this.perfCheck = function (pl, nr) {
			if (
				nr.weaponIndex == 11 &&
				UTILS.getAngleDist(nr.aim2 + Math.PI, nr.d2) <= config.shieldAngle
			)
				return false;
			if (![9, 12, 13, 15].includes(player.weapons[1])) return true;
			let pjs = {
				x: nr.x2 + 70 * Math.cos(nr.aim2 + Math.PI),
				y: nr.y2 + 70 * Math.sin(nr.aim2 + Math.PI),
			};
			if (
				UTILS.lineInRect(
					pl.x2 - pl.scale,
					pl.y2 - pl.scale,
					pl.x2 + pl.scale,
					pl.y2 + pl.scale,
					pjs.x,
					pjs.y,
					pjs.x,
					pjs.y,
				)
			) {
				return true;
			}
			let finds = ais
				.filter((tmp) => tmp.visible)
				.find((tmp) => {
					if (
						UTILS.lineInRect(
							tmp.x2 - tmp.scale,
							tmp.y2 - tmp.scale,
							tmp.x2 + tmp.scale,
							tmp.y2 + tmp.scale,
							pjs.x,
							pjs.y,
							pjs.x,
							pjs.y,
						)
					) {
						return true;
					}
				});
			if (finds) return false;
			finds = gameObjects
				.filter((tmp) => tmp.active)
				.find((tmp) => {
					let tmpScale = tmp.getScale();
					if (
						!tmp.ignoreCollision &&
						UTILS.lineInRect(
							tmp.x - tmpScale,
							tmp.y - tmpScale,
							tmp.x + tmpScale,
							tmp.y + tmpScale,
							pjs.x,
							pjs.y,
							pjs.x,
							pjs.y,
						)
					) {
						return true;
					}
				});
			if (finds) return false;
			return true;
		};
	}
}

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
				//do this in updatPlayers
				game.tickBase(() => {
					storeBuy(id, type); // Buy the item
					if (id == 7 && type == 0) my.reSync = true;
				}, 1);
				return; // Stop after attempting to buy one item
			}
			return; // Stop if the item couldn't be bought (not enough points)
		}
	}
}

class Autoupgrade {
	constructor() {
		this.sb = function (upg) {
			upg(3);
			upg(17);
			upg(31);
			upg(23);
			upg(9);
			upg(38);
		};
		this.kh = function (upg) {
			upg(3);
			upg(17);
			upg(31);
			upg(23);
			upg(10);
			upg(38);
			upg(4);
			upg(25);
		};
		this.pb = function (upg) {
			upg(5);
			upg(17);
			upg(32);
			upg(23);
			upg(9);
			upg(38);
		};
		this.ph = function (upg) {
			upg(5);
			upg(17);
			upg(32);
			upg(23);
			upg(10);
			upg(38);
			upg(28);
			upg(25);
		};
		this.db = function (upg) {
			upg(7);
			upg(17);
			upg(31);
			upg(23);
			upg(9);
			upg(34);
		};
		/* old functions */
		this.km = function (upg) {
			upg(7);
			upg(17);
			upg(31);
			upg(23);
			upg(10);
			upg(38);
			upg(4);
			upg(15);
		};
	}
}

class Damages {
	constructor(items) {
		// 0.75 1 1.125 1.5
		this.calcDmg = function (dmg, val) {
			return dmg * val;
		};
		this.getAllDamage = function (dmg) {
			return [
				this.calcDmg(dmg, 0.75),
				dmg,
				this.calcDmg(dmg, 1.125),
				this.calcDmg(dmg, 1.5),
			];
		};
		this.weapons = [];
		for (let i = 0; i < items.weapons.length; i++) {
			let wp = items.weapons[i];
			let name =
				wp.name.split(" ").length <= 1
					? wp.name
					: wp.name.split(" ")[0] + "_" + wp.name.split(" ")[1];
			this.weapons.push(this.getAllDamage(i > 8 ? wp.Pdmg : wp.dmg));
			this[name] = this.weapons[i];
		}
	}
}

class detectProj {
	constructor() {
		this.active = false;
		this.isDodging = false;
		this.dodgeAngle = null;
		this.shieldHeld = false;
		this.shieldHeldUntil = 0;
	}

	// squared dist from point to segment
	seg2(px, py, ax, ay, bx, by) {
		const abx = bx - ax, aby = by - ay;
		const len2 = abx * abx + aby * aby;
		if (len2 < 0.0001) { const dx = px - ax, dy = py - ay; return dx * dx + dy * dy; }
		const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / len2));
		const cx = ax + abx * t - px, cy = ay + aby * t - py;
		return cx * cx + cy * cy;
	}

	// build danger descriptor — returns null if proj can't reach player
	makeDanger(p, px, py, pr) {
		const x = p.x2 ?? p.x ?? 0, y = p.y2 ?? p.y ?? 0;
		const spd = p.speed;
		if (!spd || spd <= 0) return null;
		const vx = Math.cos(p.dir) * spd, vy = Math.sin(p.dir) * spd;
		const dist = p.r2 ?? p.range ?? spd * 20;
		const ex = x + Math.cos(p.dir) * dist, ey = y + Math.sin(p.dir) * dist;
		const r = (p.scale ?? 8) + pr;
		// quick reject: does the full path even come close?
		if (this.seg2(px, py, x, y, ex, ey) > r * r) return null;
		// reject if proj is moving away (dot product of proj->player vs proj dir)
		const tx = px - x, ty = py - y;
		if (tx * vx + ty * vy < -r * spd) return null;
		// time until closest approach
		const along = Math.max(0, (tx * vx + ty * vy) / (spd * spd));
		const timeToHit = Math.max(0, along - r / spd);
		return { x, y, ex, ey, vx, vy, spd, r, timeToHit, dir: p.dir };
	}

	dangers(projectiles, player) {
		const px = player.x2 ?? player.x, py = player.y2 ?? player.y;
		const pr = player.scale ?? 20;
		const out = [];
		for (let i = 0; i < projectiles.length; i++) {
			const p = projectiles[i];
			if (!p || !p.active) continue;
			if (p.sid != null && p.sid === player.sid) continue;
			const d = this.makeDanger(p, px, py, pr);
			if (d) out.push(d);
		}
		// sort by urgency (soonest hit first)
		out.sort((a, b) => a.timeToHit - b.timeToHit);
		return out;
	}

	// Score a dodge angle: higher = better. Uses perpendicular geometry, not physics sim.
	scoreAngle(angle, dlist, px, py, pr, spd) {
		// project movement direction onto each danger
		const mx = Math.cos(angle), my = Math.sin(angle);
		let score = 0;
		for (let i = 0; i < dlist.length; i++) {
			const d = dlist[i];
			// perpendicular component of our movement relative to proj direction
			const perp = mx * (-Math.sin(d.dir)) + my * Math.cos(d.dir);
			// how far we move perp in one tick (rough)
			const clearance = Math.abs(perp) * spd * 113;
			// weight by urgency (closer = more important)
			const urgency = 1 / (1 + d.timeToHit * 0.01);
			score += clearance * urgency;
			// penalize moving toward proj source
			const toSrc = Math.atan2(d.y - py, d.x - px);
			const dot = mx * Math.cos(toSrc) + my * Math.sin(toSrc);
			if (dot > 0.5) score -= urgency * 200;
		}
		// penalize map edges
		const mapSize = typeof config !== 'undefined' ? config.mapScale : 14400;
		const margin = 300;
		const nx = px + mx * 60, ny = py + my * 60;
		const border = Math.min(nx, ny, mapSize - nx, mapSize - ny);
		if (border < margin) score -= (margin - border) * 2;
		return score;
	}

	bestEscape(dlist, player) {
		const px = player.x2 ?? player.x, py = player.y2 ?? player.y;
		const pr = player.scale ?? 20;
		const spd = (player.speed ?? 0.0016) * (player.slowMult ?? 1);
		const samples = 24;
		let best = null, bestScore = -Infinity;
		for (let i = 0; i < samples; i++) {
			const a = (Math.PI * 2 * i) / samples;
			const s = this.scoreAngle(a, dlist, px, py, pr, spd);
			if (s > bestScore) { bestScore = s; best = a; }
		}
		if (best === null) return null;
		// refine ±15° in 3° steps
		const step = Math.PI / 60;
		for (let d = -5; d <= 5; d++) {
			if (d === 0) continue;
			const a = best + d * step;
			const s = this.scoreAngle(a, dlist, px, py, pr, spd);
			if (s > bestScore) { bestScore = s; best = a; }
		}
		return best;
	}

	run(projectiles, player) {
		if (!projectiles || !player || !player.alive) {
			this.active = this.isDodging = false;
			this.dodgeAngle = null;
			if (this.shieldHeld) {
				this.shieldHeld = false;
				if (player) { selectWeapon(player.weapons[0]); packet("D", lastDir ?? 0); }
			}
			return;
		}

		if (this.dodgePausedUntil && performance.now() < this.dodgePausedUntil) {
			this.active = this.isDodging = false;
			this.dodgeAngle = null;
			return;
		}

		const dlist = this.dangers(projectiles, player);
		const now = performance.now();
		const tickRate = typeof game !== 'undefined' ? game.tickRate : 113;

		if (!dlist.length) {
			if (this.shieldHeld && now >= this.shieldHeldUntil) {
				this.shieldHeld = false;
				selectWeapon(player.weapons[0]);
				packet("D", lastDir ?? 0);
			}
			this.active = this.isDodging = false;
			this.dodgeAngle = null;
			return;
		}

		this.active = true;
		const mostUrgent = dlist[0];

		if (player.weapons[1] == 11) {
			if (!this.shieldHeld) {
				this.shieldHeld = true;
				selectWeapon(player.weapons[1]);
			}
			// face the incoming proj
			packet("D", mostUrgent.dir + Math.PI);
			const holdUntil = now + (mostUrgent.timeToHit) + tickRate * 2;
			if (holdUntil > this.shieldHeldUntil) this.shieldHeldUntil = holdUntil;
			this.isDodging = true;
			this.dodgeAngle = this.bestEscape(dlist, player);
			if (this.dodgeAngle !== null) packet("9", this.dodgeAngle, 1);
			return;
		}

		if (this.shieldHeld) {
			this.shieldHeld = false;
			selectWeapon(player.weapons[0]);
			packet("D", lastDir ?? 0);
		}

		this.isDodging = true;
		this.dodgeAngle = this.bestEscape(dlist, player);
		if (this.dodgeAngle !== null) packet("9", this.dodgeAngle, 1);
	}

	// Called immediately when a projectile spawns — zero-latency reaction
	onProjSpawn(x, y, dir, range, speed, indx, sid) {
		if (!player || !player.alive || !inGame) return;
		if (sid === player.sid) return;
		if (this.dodgePausedUntil && performance.now() < this.dodgePausedUntil) return;

		const px = player.x2 ?? player.x, py = player.y2 ?? player.y;
		const pr = player.scale ?? 20;
		const projData = items.projectiles?.[indx];
		const projScale = (projData?.scale ?? 8) + pr;

		// check if this proj path hits us
		const ex = x + Math.cos(dir) * range, ey = y + Math.sin(dir) * range;
		if (this.seg2(px, py, x, y, ex, ey) > projScale * projScale) return;

		// proj is heading for us — react immediately
		this.active = true;
		this.isDodging = true;

		if (player.weapons[1] == 11) {
			// shield: face the proj (dir + PI = where it's coming from)
			if (!this.shieldHeld) {
				this.shieldHeld = true;
				selectWeapon(player.weapons[1]);
			}
			packet("D", dir + Math.PI);
			const tickRate = typeof game !== 'undefined' ? game.tickRate : 113;
			const timeToHit = Math.max(0, (Math.hypot(px - x, py - y) - projScale)) / speed;
			this.shieldHeldUntil = performance.now() + timeToHit + tickRate * 2;
		}

		// compute best escape angle immediately
		const d = { x, y, ex, ey, vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed, spd: speed, r: projData?.scale ?? 8, timeToHit: Math.max(0, Math.hypot(px - x, py - y) / speed), dir };
		const spd = (player.speed ?? 0.0016) * (player.slowMult ?? 1);
		this.dodgeAngle = this.scoreAngle ? this.bestEscape([d], player) : (dir + Math.PI);
		if (this.dodgeAngle !== null) packet("9", this.dodgeAngle, 1);
	}

	render(ctx, offset) {
		if (!this.isDodging || this.dodgeAngle === null || !player || !player.alive) return;
		const px = player.x2 - offset.x, py = player.y2 - offset.y;
		const ex = player.x2 + Math.cos(this.dodgeAngle) * 80 - offset.x;
		const ey = player.y2 + Math.sin(this.dodgeAngle) * 80 - offset.y;
		const as = 15;
		ctx.save();
		ctx.strokeStyle = "#00ff00";
		ctx.lineWidth = 5;
		ctx.lineCap = 'round';
		ctx.globalAlpha = 1.0;
		ctx.beginPath();
		ctx.moveTo(px, py);
		ctx.lineTo(ex, ey);
		ctx.moveTo(ex, ey);
		ctx.lineTo(ex - Math.cos(this.dodgeAngle - Math.PI / 6) * as, ey - Math.sin(this.dodgeAngle - Math.PI / 6) * as);
		ctx.moveTo(ex, ey);
		ctx.lineTo(ex - Math.cos(this.dodgeAngle + Math.PI / 6) * as, ey - Math.sin(this.dodgeAngle + Math.PI / 6) * as);
		ctx.stroke();
		ctx.fillStyle = "#00ff00";
		ctx.globalAlpha = 0.2;
		ctx.beginPath();
		ctx.arc(ex, ey, 30, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
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
let detectProjectile = new detectProj();
let projectileManager = new ProjectileManager(
	Projectile,
	projectiles,
	players,
	ais,
	objectManager,
	items,
	config,
	UTILS,
);
let aiManager = new AiManager(
	ais,
	AI,
	players,
	items,
	objectManager,
	config,
	UTILS,
);
let textManager = new Textmanager();

let traps = new Traps(UTILS, items);
let autoBreak = new AutoBreaker();
let autoPlace = new AutoPlacer();
let instaC = new Instakill();
let autoBuy = new Autobuy([
	[11, 1],
	[40, 0],
	[6, 0],
	[7, 0],
	[31, 0],
	[15, 0],
	[19, 1],
	[22, 0],
	[53, 0],
	[12, 0],
	[20, 0],
	[10, 0],
	[56, 0],
	[21, 1],
	[11, 0],
	[26, 0],
	[18, 1],
	[13, 1],
]);
let autoUpgrade = new Autoupgrade();
let createPath = new CreatePath();

let lastDeath;
let minimapData;
let mapMarker = {};
let mapPings = [];
let tmpPing;

let breakTrackers = [];

let grid = [];

let singCooldown = 0;
let lastSendTime = Date.now();

function sendChat(message, special) {
	if (special) {
		if (Date.now() - singCooldown > 0) {
			packet("6", message);
			lastSendTime = Date.now();
		}
	} else {
		workerSetTimeout(
			() => {
				packet("6", message);
				lastSendTime = Date.now();
				singCooldown = Date.now() + 2000;
			},
			569 - Date.now() + lastSendTime,
		);
	}
}

function checkProjectileHolder(x, y, dir, range, speed, indx, layer, sid) {
	let weaponIndx =
		indx == 0 ? 9 : indx == 2 ? 12 : indx == 3 ? 13 : indx == 5 && 15;
	let projOffset = player.scale * 2;
	let projXY = {
		x: indx == 1 ? x : x - projOffset * Math.cos(dir),
		y: indx == 1 ? y : y - projOffset * Math.sin(dir),
	};
	let nearPlayer = players
		.filter((e) => e.visible && UTILS.getDist(projXY, e, 0, 2) <= e.scale)
		.sort(function (a, b) {
			return UTILS.getDist(projXY, a, 0, 2) - UTILS.getDist(projXY, b, 0, 2);
		})[0];

	if (nearPlayer) {
		if (indx == 1) {
			nearPlayer.shooting[53] = 1;
		} else {
			nearPlayer.shootIndex = weaponIndx;
			nearPlayer.shooting[1] = 1;
		}
		antiProj(nearPlayer, dir, range, speed, indx, weaponIndx);
	} else {
		let nearTurret = nearObjs
			.filter((e) => UTILS.getDist(projXY, e, 0, 0) <= e.scale)
			.sort((a, b) => {
				return UTILS.getDist(projXY, a, 0, 0) - UTILS.getDist(projXY, b, 0, 0);
			})[0];
	}
}
let musketCount = 0;
let projectile = {
	count: 0,
	dmg: 0,
};
function antiProj(tmpObj, dir, range, speed, index, weaponIndex) {
	if (!tmpObj.isTeam(player) && !tmpObj.sid == near.sid) {
		tmpDir = UTILS.getDirect(player, tmpObj, 2, 2);
		if (UTILS.getAngleDist(tmpDir, dir) <= 0.3) {
			if (index == 1) {
				if (tmpObj.sid == near.sid) {
					projectile.count++;
					projectile.dmg += items.projectiles[index].dmg;
				}
			} else {
				tmpObj.bowThreat[weaponIndex]++;
				if (index == 5) musketCount++;
				projectile.dmg += items.projectiles[index].dmg;
				projectile.count++;
			}
			workerSetTimeout(() => {
				if (index != 1) tmpObj.bowThreat[weaponIndex]--;
				musketCount--;
				if (projectile.count > 0) {
					projectile.count--;
					projectile.dmg -= items.projectiles[index].dmg;
				}
			}, range / speed);
			if (tmpObj.bowThreat[9] >= 1 || tmpObj.bowThreat[12] >= 1) {
				checkPlace(3, tmpObj.aim2);
				checkPlace(1, tmpObj.aim2);
				my.anti0Tick = 4;
				player.chat.message = `anti bow insta by ${tmpObj.sid} ${tmpObj.name}`;
				player.chat.count = 445;
				predictHeal(1);
			} else {
				if (musketCount >= 2 || projectile.count >= 4) {
					if (player.weapons[1] == 11) {
						selectWeapon(player.weapons[1]);
					}
					checkPlace(3, tmpObj.aim2);
					checkPlace(1, tmpObj.aim2);
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
			parent: itemInfoHolder,
		});
		UTILS.generateElement({
			id: "itemInfoDesc",
			text: item.desc,
			parent: itemInfoHolder,
		});
		if (isStoreItem) {
		} else if (isWeapon) {
			UTILS.generateElement({
				class: "itemInfoReq",
				text: !item.type ? "primary" : "secondary",
				parent: itemInfoHolder,
			});
		} else {
			for (let i = 0; i < item.req.length; i += 2) {
				UTILS.generateElement({
					class: "itemInfoReq",
					html:
						item.req[i] +
						"<span class='itemInfoReqVal'> x" +
						item.req[i + 1] +
						"</span>",
					parent: itemInfoHolder,
				});
			}
			if (item.group.limit) {
				UTILS.generateElement({
					class: "itemInfoLmt",
					text:
						(player.itemCounts[item.group.id] || 0) +
						"/" +
						(config.isSandbox ? 99 : item.group.limit),
					parent: itemInfoHolder,
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
	let scaleFillNative =
		Math.max(screenWidth / maxScreenWidth, screenHeight / maxScreenHeight) *
		pixelDensity;
	gameCanvas.width = screenWidth * pixelDensity;
	gameCanvas.height = screenHeight * pixelDensity;
	gameCanvas.style.width = screenWidth + "px";
	gameCanvas.style.height = screenHeight + "px";
	mainContext.setTransform(
		scaleFillNative,
		0,
		0,
		scaleFillNative,
		(screenWidth * pixelDensity - maxScreenWidth * scaleFillNative) / 2,
		(screenHeight * pixelDensity - maxScreenHeight * scaleFillNative) / 2,
	);
}
resize();
let touchCountrols = getEl("touch-controls-fullscreen");
// MOUSE INPUT:
touchCountrols.addEventListener("mousemove", gameInput, false);

function gameInput(e) {
	mouseX = e.clientX;
	mouseY = e.clientY;
}
let clicks = {
	left: false,
	middle: false,
	right: false,
};
touchCountrols.addEventListener("mousedown", mouseDown, false);

function mouseDown(e) {
	if (attackState != 1) {
		attackState = 1;
		if (e.button == 0) {
			clicks.left = true;
			if (bottics.length > 0) {
				bottics.forEach(bc => {
					if (!bc.Bot || !bc.Bot.alive) return;
					bc.holdLeft = true;
					const angle = bc.near
						? Math.atan2(bc.near.y2 - bc.Bot.y2, bc.near.x2 - bc.Bot.x2)
						: mouseAimAngle();
					bc.sendWS("D", angle);
					bc.hitting = true;
					bc.buyEquip(bc.Bot.primaryReloaded ? 7 : 6, 0);
					bc.buyEquip(21, 1);
				});
			}
		} else if (e.button == 1) {
			if (keys[16]) {
				let old = targetPlayer?.sid;
				targetPlayer = players.filter(tmp => tmp.visible && tmp.sid != player.sid).sort((a, b) => UTILS.getDist(mousePos, a, 0, 2) - UTILS.getDist(mousePos, b, 0, 2))[0];
				if (targetPlayer?.sid == old) {
					targetPlayer = undefined;
				}
			} else {
				clicks.middle = true;
				if (bottics.length > 0) {
					const fallbackAngle = mouseAimAngle();
					bottics.forEach(bc => {
						if (!bc.Bot || !bc.Bot.alive) return;
						const wpn1 = bc.Bot.weapons[1];
						if (wpn1 == null) return;
						const closestEnemy = bc.enemy?.length
							? bc.enemy.slice().sort((a, b) => UTILS.getDist(a, bc.Bot, 2, 2) - UTILS.getDist(b, bc.Bot, 2, 2))[0]
							: null;
						const angle = closestEnemy
							? Math.atan2(closestEnemy.y2 - bc.Bot.y2, closestEnemy.x2 - bc.Bot.x2)
							: fallbackAngle;
						bc.selectWeapon(wpn1);
						bc.sendWS("D", angle);
						bc.hitting = true;
						bc.game.tickBase(() => {
							bc.selectWeapon(bc.Bot.weapons[0]);
						}, 2);
					});
				}
			}
		} else if (e.button == 2) {
			clicks.right = true;
			if (bottics.length > 0) {
				const mAngle = mouseAimAngle();
				bottics.forEach(bc => {
					if (!bc.Bot || !bc.Bot.alive) return;
					bc.holdRight = true;
					bc.sendWS("D", mAngle);
					bc.hitting = true;
					bc.buyEquip(40, 0);
					bc.buyEquip(21, 1);
				});
			}
		}
	}
}
touchCountrols.addEventListener("mouseup", UTILS.checkTrusted(mouseUp));

function mouseUp(e) {
	if (attackState != 0) {
		attackState = 0;
		if (e.button == 0) {
			clicks.left = false;
			bottics.forEach(bc => { bc.holdLeft = false; });
		} else if (e.button == 1) {
			clicks.middle = false;
		} else if (e.button == 2) {
			clicks.right = false;
			bottics.forEach(bc => { bc.holdRight = false; });
		}
	}
}
touchCountrols.addEventListener("wheel", wheel, false);

let wbe = 1.25;
let wbeTarget = 1.25;
const wbeMin = 0.45;
const wbeSmooth = 0.12;

function updateSmoothZoom() {
	if (Math.abs(wbe - wbeTarget) > 0.001) {
		wbe += (wbeTarget - wbe) * wbeSmooth;
		maxScreenWidth = config.maxScreenWidth * wbe;
		maxScreenHeight = config.maxScreenHeight * wbe;
		resize();
	}
	requestAnimationFrame(updateSmoothZoom);
}
requestAnimationFrame(updateSmoothZoom);

function wheel(e) {
	e.preventDefault();
	const delta = e.deltaY > 0 ? 0.15 : -0.15;
	wbeTarget = Math.min(2.5, Math.max(wbeMin, wbeTarget + delta));
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
	return (
		near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8
	);
}

let mousePos = {};

function getMouseWorldPos() {
	const rect = gameCanvas.getBoundingClientRect();

	const canvasX = (mouseX - rect.left) * (gameCanvas.width / rect.width);
	const canvasY = (mouseY - rect.top) * (gameCanvas.height / rect.height);

	const scaleFillNative =
		Math.max(screenWidth / maxScreenWidth, screenHeight / maxScreenHeight) *
		pixelDensity;

	const tx =
		(screenWidth * pixelDensity - maxScreenWidth * scaleFillNative) / 2;
	const ty =
		(screenHeight * pixelDensity - maxScreenHeight * scaleFillNative) / 2;

	const localX = (canvasX - tx) / scaleFillNative;
	const localY = (canvasY - ty) / scaleFillNative;

	mousePos = {
		x: camX + localX - maxScreenWidth / 2,
		y: camY + localY - maxScreenHeight / 2,
	};
}

function getSafeDir() {
	// THANK U BRT
	if (!player) return 0;
	if (!player.lockDir) {
		return UTILS.getDirect(mousePos, player, 0, 0); //use player rendered coordinates which is x, y instead of x2, y2 which is tick coordinates to be accurate with render
	}
	return lastDir || 0;
}

function simPredictAngle(target, leadTicks) {
	if (!target || !player) return target?.aim2 ?? 0;
	try {
		const sim = new MovementSimulator(target, player);
		for (let i = 0; i < (leadTicks || 1); i++) {
			sim.continueTick(delta || 16, target.moveDir, i === 0);
		}
		return Math.atan2(sim.y - player.y2, sim.x - player.x2);
	} catch (_) {
		return target.aim2;
	}
}

function simPredictPos(target, leadTicks) {
	if (!target || !player) return { x: target?.x2 ?? target?.x, y: target?.y2 ?? target?.y };
	try {
		const sim = new MovementSimulator(target, player);
		for (let i = 0; i < (leadTicks || 1); i++) {
			sim.continueTick(delta || 16, target.moveDir, i === 0);
		}
		return { x: sim.x, y: sim.y };
	} catch (_) {
		return { x: target.x2 ?? target.x, y: target.y2 ?? target.y };
	}
}

function getAttackDir() {
	if (!player) return 0;
	if (my.aimTarget && targetPlayer) {
		// Get enemy speed from velocity magnitude
		let enemySpeed = Math.sqrt(targetPlayer.xVel * targetPlayer.xVel + targetPlayer.yVel * targetPlayer.yVel);
		let enemyMoveDir = enemySpeed > 0.001 ?
			Math.atan2(targetPlayer.yVel, targetPlayer.xVel) :
			targetPlayer?.aim2;

		// If enemy is barely moving, just aim at current position
		if (enemySpeed < 0.01) {
			let dx = targetPlayer.x2 - player.x2;
			let dy = targetPlayer.y2 - player.y2;
			lastDir = Math.atan2(dy, dx);
			console.log(`Enemy barely moving (${enemySpeed.toFixed(3)}), aiming directly`);

			// Clear predicted position when not moving
			if (my.predictedPos) my.predictedPos.active = false;
			return lastDir;
		}

		// Get speed multipliers from enemy equipment
		let speedMultiplier = 1;
		if (targetPlayer.skinIndex && items.list[targetPlayer.skinIndex] && items.list[targetPlayer.skinIndex].spdMult) {
			speedMultiplier *= items.list[targetPlayer.skinIndex].spdMult;
		}
		if (targetPlayer.tailIndex && items.list[targetPlayer.tailIndex] && items.list[targetPlayer.tailIndex].spdMult) {
			speedMultiplier *= items.list[targetPlayer.tailIndex].spdMult;
		}

		// Apply speed multiplier to enemy velocity
		let adjustedXVel = targetPlayer.xVel * speedMultiplier;
		let adjustedYVel = targetPlayer.yVel * speedMultiplier;

		// Get actual projectile speed from weapon data
		let weapon = items.weapons[player.weaponIndex];
		let projectileSpeed = weapon.projSpd || weapon.speed || 500;

		// Calculate distance to enemy
		let dx = targetPlayer.x2 - player.x2;
		let dy = targetPlayer.y2 - player.y2;
		let distance = Math.sqrt(dx * dx + dy * dy);

		// Use game's actual tick delta (113ms) for accurate prediction
		let tickDelta = 113 / 1000; // Convert to seconds

		// Calculate how many ticks projectile will take to reach enemy
		let ticksToHit = distance / (projectileSpeed * tickDelta);
		let timeToHit = ticksToHit * tickDelta;

		// Predict enemy position using adjusted velocity (use time in seconds, not ticks)
		let predictedX = targetPlayer.x2 + adjustedXVel * timeToHit;
		let predictedY = targetPlayer.y2 + adjustedYVel * timeToHit;

		// Only update ghost position if it changed significantly (performance optimization)
		let needsUpdate = !my.predictedPos ||
			Math.abs(predictedX - my.predictedPos.targetX) > 5 ||
			Math.abs(predictedY - my.predictedPos.targetY) > 5;

		if (needsUpdate) {
			if (!my.predictedPos) {
				my.predictedPos = { x: predictedX, y: predictedY, active: true, targetX: predictedX, targetY: predictedY, fadeOut: false };
			} else {
				my.predictedPos.targetX = predictedX;
				my.predictedPos.targetY = predictedY;
				my.predictedPos.active = true;
				my.predictedPos.fadeOut = false;

				// Instant update (no interpolation for performance)
				my.predictedPos.x = predictedX;
				my.predictedPos.y = predictedY;
			}
		}

		// Aim at the ghost position
		let aimX = my.predictedPos.x;
		let aimY = my.predictedPos.y;
		let predDx = aimX - player.x2;
		let predDy = aimY - player.y2;
		let aimAngle = Math.atan2(predDy, predDx);
		lastDir = aimAngle;
	} else {
		// Start fadeout when not aiming
		if (my.predictedPos && my.predictedPos.active) {
			my.predictedPos.active = false;
			my.predictedPos.fadeOut = true;
		}

		if (my.autoAim) {
			lastDir = configs.weaponGrind
				? getSafeDir()
				: enemy.length
					? my.revAim
						? simPredictAngle(near, 1) + Math.PI
						: simPredictAngle(near, 1)
					: getSafeDir();
		} else if (isNearPlayer && clicks.left) {
			lastDir =
				enemy.length &&
					near.dist2 <= items.weapons[player.weaponIndex].range + player.scale * 2
					? near.aim2
					: getSafeDir();
		} else if (clicks.right) {
			lastDir = getSafeDir();
		} else if (
			autoBreak.active &&
			player[
			(autoBreak.useHammer(autoBreak.target) ? "secondary" : "primary") +
			"Reloaded"
			]
		) {
			lastDir = autoBreak.aim;
		} else if (!player.lockDir) {
			if (configs.renderDir && options.renderDir == "noDir") return undefined;
			lastDir = getSafeDir();
		}
	}
	return lastDir || 0;
}

function getVisualDir() {
	if (!player) return 0;
	if (my.aimTarget && targetPlayer) {
		lastDir = targetPlayer?.aim2;
	} else if (my.autoAim) {
		lastDir = configs.weaponGrind
			? getSafeDir()
			: enemy.length
				? my.revAim
					? near.aim2 + Math.PI
					: near.aim2
				: getSafeDir();
	} else if (isNearPlayer && clicks.left) {
		lastDir =
			enemy.length &&
				near.dist2 <= items.weapons[player.weaponIndex].range + player.scale * 2
				? near.aim2
				: getSafeDir();
	} else if (clicks.right) {
		lastDir = getSafeDir();
	} else if (
		autoBreak.active &&
		player[
		(autoBreak.useHammer(autoBreak.target) ? "secondary" : "primary") +
		"Reloaded"
		]
	) {
		lastDir = autoBreak.aim;
	} else if (!player.lockDir) {
		lastDir = getSafeDir();
	}
	return lastDir || 0;
}

// KEYS:
function keysActive() {
	return allianceMenu.style.display != "block" && !menuCBFocus;
}

let commands = {
	help: [
		"Show Commands",
		function () {
			for (let cmds in commands) {
				ChText("/" + cmds, commands[cmds][0], "lime", 1);
			}
		},
	],
	clear: [
		"Clear Chats",
		function () {
			resetMenuChText();
		},
	],
	debug: [
		"Debug Mod For Development",
		function () {
			addDeadPlayer(player);
			ChText("Debug", "Done", "#99ee99", 1);
		},
	],
	play: [
		"Play Music ( /play [link] )",
		function (message) {
			let link = message.split(" ");
			if (link[1]) {
				let audio = new Audio(link[1]);
				audio.play();
			} else {
				ChText("Warn", "Enter Link ( /play [link] )", "#99ee99", 1);
			}
		},
	],
	bye: [
		"Leave Game",
		function () {
			window.leave();
		},
	],
};

function toggleMenuChat() {
	let message = menuChatBox.value;
	if (menuCBFocus && message != "") {
		let command = message.slice(1).split(" ")[0];
		if (message.startsWith("/") && commands[command]) {
			commands[command][1](message);
		} else {
			sendChat(message);
		}
		menuChatBox.value = "";
		menuChatBox.blur();
	} else {
		menuChatBox[menuCBFocus ? "blur" : "focus"]();
	}
}

let debugTimeout;

let keydownActions = {
	Escape: () => {
		let menu = document.getElementById("modmenus");
		if (menu.classList.contains("open")) {
			menu.classList.add("closed");
			menu.classList.remove("open");
		} else {
			menu.classList.add("open");
			menu.classList.remove("closed");
			menu.style.display = "flex";
			const firstBtn = menu.querySelector(".tab-btn");
			if (firstBtn && !menu.querySelector(".tab-btn.active")) firstBtn.click();
		}
	},
	c: () => {
		// c key
		updateMapMarker();
	},
	g: () => {
		// g key
		getMouseWorldPos();
		if (_pathfinderTarget) {
			// toggle off
			_pathfinderTarget = null;
			pathfinderRender.target = null;
			pathfinderRender.waypoints = [];
		} else {
			triggerPathFinder(mousePos.x, mousePos.y);
		}
	},
	e: () => {
		// e key
		sendAutoGather(1);
	},
	q: () => {
		// q key
		selectWeapon(player.weaponCode);
	},
	m: () => {
		// m key
		mills.placeSpawnPads = !mills.placeSpawnPads;
		if (mills.placeSpawnPads) {
			autoPlace.testCanPlace(
				player.getItemType(20),
				0,
				Math.PI * 1.5,
				Math.PI / 2,
				getMoveDir() || 0,
				true,
			);
			mills.old = {
				x: player.x2,
				y: player.y2,
			};
		}
	},
	z: () => {
		// z key
		mills.place = !mills.place;
	},
	x: () => {
		// x key
		player.lockDir = !player.lockDir;
	},
	Z: () => {
		// capital Z key
		window.debug();
	},
	" ": () => {
		// space key
		packet("F", 1, getSafeDir(), 1);
		packet("F", 0, getSafeDir(), 1);
	},
	",": () => {
		// , key
		player.sync = true;
		//sendChat(getEl("testInput2").value);
	},
	Shift: () => {
		workerClearTimeout(debugTimeout);
		debugStop = true;
		debugTimeout = workerSetTimeout(() => {
			debugStop = false;
		}, 10000);
		detectProjectile.dodgePausedUntil = performance.now() + 10000;
	},
	r: () => {
		// r key
		instaC.wait = !instaC.wait;
		if (!configs.allowPing) packet("S", 1);
	},
	l: () => {
		// l key
		if (!targetPlayer?.visible) {
			targetPlayer = players
				.filter((e) => e.visible && e.sid != player.sid)
				.sort((a, b) => a.dist2 - b.dist2)[0];
		}
	},
	t: () => {
		// t key
		instaC.oneTickType();
	},
	k: () => {
		// k key - toggle nospike mode
		window.nospikeMode = !window.nospikeMode;
		if (typeof notif === "function") {
			notif(window.nospikeMode ? "Nospike Mode ON" : "Nospike Mode OFF");
		}
	},
	".": () => {
		// . key
		if (!targetPlayer?.visible) {
			targetPlayer = enemy
				.filter((e) => e.visible)
				.sort((a, b) => a.dist2 - b.dist2)[0];
		}
	},
};

function keyDown(event) {
	let keyNum = event.which || event.keyCode || 0;
	if (player && player.alive && keysActive()) {
		if (!keys[keyNum]) {
			keys[keyNum] = 1;
			macro[event.key] = 1;
			if (player.weapons[keyNum - 49] != undefined) {
				player.weaponCode = player.weapons[keyNum - 49];
			} else {
				keydownActions[event.key]?.();
			}
		}
	}
}
addEventListener("keydown", UTILS.checkTrusted(keyDown));

function keyUp(event) {
	if (player && player.alive) {
		let keyNum = event.which || event.keyCode || 0;
		if (keyNum == 13) {
			event.preventDefault();
			event.stopImmediatePropagation(); // prevent game from handling it
			toggleMenuChat();
			resetMoveDir();
			macro = {};
			keys = {};
		} else if (keyNum == 27) {
			menuChatBox.blur();
		}
		if (keysActive()) {
			if (keys[keyNum]) {
				keys[keyNum] = 0;
				macro[event.key] = 0;
				if (event.key == ",") {
					player.sync = false;
				}
			}
		}
	}
}
addEventListener("keyup", UTILS.checkTrusted(keyUp), true); //NOTE: THIS TRUE IS VERY IMPORTANT DO NOT DELETE IT UNLESS U KNOW WHAT U ARE DOING

function sendMoveDir() {
	if (
		instaC.ticking ||
		macro.l ||
		my.autoPush ||
		detectProjectile.isDodging ||
		(configs.autoPlay && PF.finded)
	) {
		safeWalk();
		return;
	}

	let newMoveDir;
	if (configs.playerFollow) {
		if (targetPlayer) {
			if (targetPlayer.dist2 >= (configs.serverSync ? 10 : 135)) {
				newMoveDir = targetPlayer?.aim2;
			} else {
				newMoveDir = undefined;
			}
		}
	} else {
		newMoveDir = wasdDir;
	}
	packet("9", newMoveDir, 1);
	safeWalk();
}

// ITEM COUNT DISPLAY:
let isItemSetted = [];
let itemCounter = [];

let length;

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
			count = Math.min(limit, E.itemCounts[realIndex - 18] || 0);
		} else if (realIndex <= 15) {
			let reload =
				E.reloads[realIndex] == 0
					? R.weapons[realIndex].speed
					: E.reloads[realIndex];
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

			updateCounter(
				counter.getContext("2d"),
				limit,
				count,
				realIndex <= 15,
				realIndex,
			);
		}
	}
};

function updateCounter(ctx, max, current, isWeapon, ID) {
	let R = items;
	let E = player;

	ctx.clearRect(-100, -100, 1000, 1000); // clear the canvas before drawing

	if (isWeapon) {
		let targetReloads = {
			primary:
				E.primaryIndex === undefined
					? 1
					: (R.weapons[E.primaryIndex].speed - E.reloads[E.primaryIndex]) /
					R.weapons[E.primaryIndex].speed,
			secondary:
				E.secondaryIndex === undefined
					? 1
					: (R.weapons[E.secondaryIndex].speed - E.reloads[E.secondaryIndex]) /
					R.weapons[E.secondaryIndex].speed,
		};

		if (!E.currentReloads) {
			E.currentReloads = {
				primary: targetReloads.primary,
				secondary: targetReloads.secondary,
			};
		}

		const lerpFactor = 0.1;
		E.currentReloads.primary =
			(1 - lerpFactor) * E.currentReloads.primary +
			lerpFactor * targetReloads.primary;
		E.currentReloads.secondary =
			(1 - lerpFactor) * E.currentReloads.secondary +
			lerpFactor * targetReloads.secondary;

		let weapon = ID;
		let primaryInd = weapon == E.primaryIndex;

		if (E.reloads[weapon] != 0) {
			ctx.beginPath();
			ctx.lineWidth = 10;
			ctx.strokeStyle = "#FFFFFF";
			ctx.arc(
				10,
				10,
				60,
				0,
				Math.PI *
				2 *
				(primaryInd ? E.currentReloads.primary : E.currentReloads.secondary) *
				-1,
			);
			ctx.stroke();
		}
	} else {
		ctx.beginPath();
		ctx.lineWidth = 10;
		ctx.strokeStyle = "#FFFFFF";
		ctx.arc(0, 0, 60, 0, Math.PI * 2 * (current / max));
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
			if (index == id)
				isItemSetted[tmpI].innerHTML = player.itemCounts[index] || 0;
		}
	}
}
// sim N ticks forward with stop-input after tick 1 (coasting to a halt)
// lookahead is dynamic: enough ticks to cover full velocity bleed
let safeWalkSimCache = { tick: -1, frames: null };

function getSafeWalkSim() {
	if (safeWalkSimCache.tick === game.tick) return safeWalkSimCache.frames;
	const dt = game.tickRate;

	// How many ticks until velocity is negligible (<1 unit/tick)?
	// vel decays by 0.993^dt each tick. Solve: vel * (0.993^dt)^n < 1
	const decelPerTick = Math.pow(config.playerDecel, dt);
	const vel0 = Math.hypot(player.xVel || 0, player.yVel || 0) * dt;
	// n = ceil(log(1/vel0) / log(decelPerTick)), min 4, max 16
	const LOOKAHEAD = vel0 > 1
		? Math.min(16, Math.max(4, Math.ceil(Math.log(1 / vel0) / Math.log(decelPerTick))))
		: 4;

	const sim = new MovementSimulator(player);
	const frames = [];

	for (let t = 0; t < LOOKAHEAD; t++) {
		const dir = t === 0 ? player.moveDir : undefined;
		const [, , hitSpikes] = sim.continueTick(dt, dir, t === 0);
		frames.push({ x: sim.x, y: sim.y, hitSpikes: [...hitSpikes] });
	}

	safeWalkSimCache = { tick: game.tick, frames };
	return frames;
}

function willIntersectWithSpike(spike) {
	const frames = getSafeWalkSim();
	// Extra margin accounts for ping delay + velocity not yet reflected in server state
	const pingMargin = (ping.avg || 0) * (player.speed || config.playerSpeed) * 1.35 * 2;
	const collisionDist = player.scale + spike.getScale() + pingMargin;
	for (const f of frames) {
		if (f.hitSpikes.includes(spike)) return true;
		if (UTILS.getDistance(f.x, f.y, spike.x, spike.y) <= collisionDist) return true;
	}
	return false;
}

function antiSpike() {
	const antiSpikeTick = nearObjs.find(
		(e) =>
			((e.type == 1 && e.y >= 12000) || (e.dmg && !e.isTeamObject(player))) &&
			UTILS.getDist(e, player, 0, 3) <= e.getScale() + player.scale + 1,
	);

	if (antiSpikeTick) {
		player.addDamageThreat("spike", antiSpikeTick.dmg || 35);
	}
	if (!enemy.length) return;
	autoPlace.checkSpikeTick();

	if (
		antiSpikeTick &&
		near.primaryReloaded &&
		[3, 4, 5].includes(near.primaryIndex) &&
		near.dist2 < 210
	) {
		if (player.inTrap) {
			if (
				!player[(player.weaponIndex < 9 ? "primary" : "secondary") + "Reloaded"]
			) {
				my.anti0Tick = 1;
				player.chat.message = `Anti SpikeTick by ${near.sid} (${near.name}`;
				player.chat.count = 112;
			}
		} else {
			my.anti0Tick = 2;
			player.chat.message = `Anti SpikeTick by ${near.sid} (${near.name})`;
			player.chat.count = 223;
		}
	}
}
function lineInCircle(x, y, x2, y2, circleX, circleY, scale) {
	let lineVec = { x: x2 - x, y: y2 - y };
	let lineToCircleVec = { x: circleX - x, y: circleY - y };

	let projection =
		(lineToCircleVec.x * lineVec.x + lineToCircleVec.y * lineVec.y) /
		(lineVec.x * lineVec.x + lineVec.y * lineVec.y);
	let closestPoint = {
		x: x + projection * lineVec.x,
		y: y + projection * lineVec.y,
	};

	if (
		closestPoint.x >= Math.min(x, x2) &&
		closestPoint.x <= Math.max(x, x2) &&
		closestPoint.y >= Math.min(y, y2) &&
		closestPoint.y <= Math.max(y, y2)
	) {
		return (
			UTILS.getDistance(closestPoint.x, closestPoint.y, circleX, circleY) <
			scale
		);
	}
}
function canAutoPush(pushPositions) {
	if (
		lineInCircle(
			player.x2,
			player.y2,
			pushPositions.x2,
			pushPositions.y2,
			near.x3,
			near.y3,
			35,
		)
	)
		return false;
	for (let object of nearObjs) {
		if (!object.dmg) continue;

		if (!object.isTeamObject(player)) {
			if (
				lineInCircle(
					player.x2,
					player.y2,
					pushPositions.x2,
					pushPositions.y2,
					object.x,
					object.y,
					35 + object.getScale(0.6, object.isItem),
				)
			) {
				return false;
			}
		} else {
			if (
				lineInCircle(
					player.x2,
					player.y2,
					pushPositions.x2,
					pushPositions.y2,
					object.x,
					object.y,
					object.getScale(0.6, object.isItem) * 0.75,
				)
			) {
				return false;
			}
		}
	}

	return true;
}
const tryAutoPush = () => {
	if (
		debugStop ||
		!configs.autoPush ||
		!enemy.length ||
		!near.inTrap?.isTeamObject(player) ||
		player.inTrap ||
		near.hitSpike
	) {
		PF.active = false;
		if (my.autoPush) {
			my.autoPush = false;
			packet("9", player.moveDir, 1);
		}
		return;
	}
	let nearTrap = near.inTrap;
	let spikes = nearObjs.filter(
		(obj) =>
			((obj.active && obj.dmg && !obj.isTeamObject(near)) ||
				(obj.type == 1 && obj.y >= 12000)) &&
			UTILS.getDist(obj, nearTrap, 0, 0) <
			obj.scale + nearTrap.scale + near.scale / 2,
	);
	if (!spikes.length) {
		PF.active = false;
		if (my.autoPush) {
			my.autoPush = false;
			packet("9", player.moveDir, 1);
		}
		return;
	}
	let points = [];
	for (let i = 0; i < spikes.length; i++) {
		let spike1 = spikes[i];

		for (let j = i + 1; j < spikes.length; j++) {
			let spike2 = spikes[j];

			// Optional: skip if too far to ever matter
			let maxDist = spike1.scale + spike2.scale + near.scale;
			if (UTILS.getDist(spike1, spike2, 0, 0) > maxDist) continue;

			let midPoint = UTILS.findMiddlePoint(spike1, spike2, 0, 0);

			let min = Math.min(spike1.scale, spike2.scale);
			let minSpike = spike1.scale === min ? spike1 : spike2;

			let spikeMid = UTILS.getDist(minSpike, midPoint, 0, 0);

			if (spikeMid <= 30 + min) {
				let scale =
					min - ((spikeMid - min) / (spikeMid + near.scale - min - 1)) * min;
				points.push({
					x: midPoint.x,
					y: midPoint.y,
					scale,
				});
			}
		}
	}
	for (let spike of spikes) {
		points.push({
			x: spike.x,
			y: spike.y,
			scale: spike.scale,
		});
	}

	for (let point of points) {
		let posX =
			point.x +
			point.scale *
			Math.cos(Math.atan2(nearTrap.y - point.y, nearTrap.x - point.x));
		let posY =
			point.y +
			point.scale *
			Math.sin(Math.atan2(nearTrap.y - point.y, nearTrap.x - point.x));
		my.pushData = {
			x: posX,
			y: posY,
			x2:
				posX +
				(UTILS.getDistance(posX, posY, near.x3, near.y3) + 35) *
				Math.cos(UTILS.getDirection(near.x3, near.y3, posX, posY)),
			y2:
				posY +
				(UTILS.getDistance(posX, posY, near.x3, near.y3) + 35) *
				Math.sin(UTILS.getDirection(near.x3, near.y3, posX, posY)),
		};
		let mySpikeDir = UTILS.getDirect(point, player, 0, 3);
		if (canAutoPush(my.pushData)) {
			let autoPushAngle = UTILS.getDirect(my.pushData, player, 2, 3);
			my.autoPush = true;
			packet("9", autoPushAngle, 1);
			PF.active = false;
			return;
		} else {
			let safePath = findSafePath(
				player.x3,
				player.y3,
				my.pushData.x2,
				my.pushData.y2,
				{
					safetyOptions: {
						checkAllSpikes: false,
						ownSpikeDistance: 83,
						checkEnemy: true,
						enemyDistance: 75,
					},
				},
			);
			if (safePath && safePath.length > 1) {
				PF.paths = safePath;
				PF.active = true;
				my.autoPush = true;
				// Follow the safe path
				let nextPoint = safePath[1]; // Skip first point (current position)
				let moveToAngle = UTILS.getDirect(nextPoint, player, 0, 3);
				packet("9", moveToAngle, 1);
				return;
			}
		}
	}
	PF.active = false;
	if (my.autoPush) {
		my.autoPush = false;
		packet("9", player.moveDir, 1);
	}
	return;

	/*//direction of spike from near player
		let spikeDir = UTILS.getDirect(point, near, 0, 2);
		//direction of spike from trap
		let trapSpikeDir = UTILS.getDirect(point, near.inTrap, 0, 0);
		//middle of trap and spike
		let trapSpikeMid = UTILS.findMiddlePoint(point, near.inTrap, 0, 0)
		my.pushData = {
				x: point.x,
				y: point.y
		}

		/*let decelScale;
		let decel;
		let diffDir;
		let diffCheck;
		let pathScale;
		let pushType;

		//angle difference between angle of spike from trap and angle of spike from near player
		let diff = UTILS.getAngleDist(trapSpikeDir, spikeDir);

		/*if (diff > 0.3) {
				// direction of trap from me
				let myTrapDir = UTILS.getDirect(near.inTrap, player, 0, 2);
				// direction of trap from enemy
				let trapDir = UTILS.getDirect(near.inTrap, near, 0, 2);
				// distance of trap from enemy
				let trapDist = UTILS.getDist(near.inTrap, near, 0, 2);

				decelScale = near.scale * 1.5;
				decel = Math.max(near.scale / 2, (near.scale + decelScale) - trapDist);
				diffDir = trapDir;
				diffCheck = UTILS.getAngleDist(myTrapDir, trapDir) < 0.4;
				pathScale = decelScale;
				pushType = 1;

		} else {
		// direction of spike from me
		let mySpikeDir = UTILS.getDirect(point, player, 0, 2);
		// direction of spike from enemy
		let spikeDist = UTILS.getDist(point, near, 0, 2);

		decelScale = near.scale * 1.5;
		decel = Math.max(near.scale / 2, (point.scale + near.scale + decelScale) - spikeDist);
		diffDir = spikeDir;
		diffCheck = UTILS.getAngleDist(mySpikeDir, near.aim2) < Math.PI / 3;
		pathScale = null;
		pushType = 0;

		//}

		/*let serializableBuilds = builds.map(building => ({
						x: building.x,
						y: building.y,
						scale: building.scale
				}));

				worker.postMessage([{x: player.x2, y: player.y2}, {x: toX, y: toY}, serializableBuilds, {x: near.x2, y: near.y2}, true]);*/
	/*if (near.dist2 <= decelScale * 2 && diffCheck) {
				PF.active = false;
				PF.paths = [];
				my.pushData.x2 = near.x2 - Math.cos(diffDir) * decel;
				my.pushData.y2 = near.y2 - Math.sin(diffDir) * decel;
				let dir = UTILS.getDirect(my.pushData, player, 2, 2);
				packet("9", dir, 1);
				my.autoPush = true;
		} else {
				let toX = Math.cos(diffDir) * 69;
				let toY = Math.sin(diffDir) * 69;
				let result = createPath.calc({ x: toX, y: toY }, false, "auto push");
				PF.paths = result.paths;
				PF.attempts = result.attempts;
				if (PF.paths.length > 0) {
						PF.active = true;
						let dir = UTILS.getDirect(PF.paths[1], player, 0, 2);
						packet("9", dir, 1);
						my.autoPush = true;
						my.pushData.x2 = near.x2 - toX;
						my.pushData.y2 = near.y2 - toY;
				} else {
						let result = createPath.calc({ x: toX, y: toY }, true, "auto push");
						PF.paths = result.paths;
						PF.attempts = result.attempts;
						if (PF.paths.length > 0) {
								PF.active = true;
								let dir = UTILS.getDirect(PF.paths[1], player, 0, 2);
								packet("9", dir, 1);
								my.autoPush = true;
								my.pushData.x2 = near.x2 - toX;
								my.pushData.y2 = near.y2 - toY;
						} else {
								my.autoPush = false;
						}
						my.autoPush = false;
				}
		}*/
};
/*end of pathfinder*/
//best sync using a glitch server ig
// WebSocket variable
let socket = null;
const serverURL = "ws://localhost:6767"; // Change this to your server URL if different
let playersInServer = [];
let syncersInServer = [];
// Function to open WebSocket connection
function openSocket() {
	if (!socket || socket.readyState === WebSocket.CLOSED) {
		socket = new WebSocket(serverURL);

		socket.addEventListener("open", () => {
			console.log("WebSocket connection established.");
		});
		socket.addEventListener("message", (event) => {
			// Handle different data types properly
			if (event.data instanceof Blob) {
				event.data.text().then(text => {
					try {
						const data = JSON.parse(text);
						handleWebSocketMessage(data);
					} catch (e) {
						console.warn("Failed to parse WebSocket message:", e);
					}
				}).catch(err => {
					console.warn("Failed to read Blob data:", err);
				});
			} else if (event.data instanceof ArrayBuffer) {
				// Handle ArrayBuffer data (convert to text first)
				try {
					const text = new TextDecoder().decode(event.data);
					const data = JSON.parse(text);
					handleWebSocketMessage(data);
				} catch (e) {
					console.warn("Failed to parse WebSocket message:", e);
				}
			} else if (typeof event.data === "string") {
				// Handle string data directly
				try {
					const data = JSON.parse(event.data);
					handleWebSocketMessage(data);
				} catch (e) {
					console.warn("Failed to parse WebSocket message:", e);
				}
			} else {
				// Skip other data types (likely binary game data)
				return;
			}
		});

		function handleWebSocketMessage(data) {
			if (data.action === "update") {
				if (data._0x32b == "a") {
					packet("H", 69);
				}
				let otherPlayersData = data.filter(
					(playerData) => playerData.sid !== player.sid,
				);
				playersInServer = otherPlayersData.map((playerData) => playerData.sid);
				syncersInServer = otherPlayersData
					.filter((playerData) => playerData.sync)
					.map((playerData) => playerData.sid);
			}

			if (data.action == "listClients") {
				// Handle the listClients response
				console.log("Connected clients:", data.data);
			}
		}

		socket.addEventListener("close", () => {
			console.log("WebSocket connection closed. Idk why");
		});
	}
}

// Function to send player and nearby enemy information to the server
function sendPlayerInfo() {
	if (socket && socket.readyState === WebSocket.OPEN) {
		if (!serverID) {
			// Regular expression to match the 'server' parameter
			const match = window.location.href.match(/[?&]server=([^&]+)/);

			if (match && match[1]) {
				serverID = decodeURIComponent(match[1]);
			}
		}
		const playerInfo = {
			action: "update",
			data: {
				sid: player.sid, // Your player's unique session ID
				name: player.name,
				server: serverID, // Your server ID
				sync: configs.serverSync, // Sync state
				ping,
				x2: player.x2, // Player's x position
				y2: player.y2, // Player's y position
			},
		};
		//socket.send(JSON.stringify(playerInfo));
	} else {
		//openSocket();
	}
}

workerSetInterval(() => {
	if (inGame) {
		sendPlayerInfo();
		let now = Date.now();
		for (let i = 0; i < gameObjects.length; i++) {
			let obj = gameObjects[i];
			if (obj.type == null && !obj.active && now - obj.breakTime > 5000) {
				gameObjects.splice(i, 1);
				i--;
			}
		}
		for (let i = 0; i < deadPlayers.length; i++) {
			if (!deadPlayers[i].active) {
				deadPlayers.splice(i, 1);
				i--;
			}
		}
	}
}, 20000);

let randomLoopInterval;

function knockBackPredict() {
	let nea = near.aim2;
	let minDist = Infinity;
	let neIT = near.inTrap;
	let inWeaponRange = near.dist2 - player.scale * 1.8 <= items.weapons[player.weapons[0]].range;
	if (
		near.dist2 <= 400 &&
		!neIT
	) {
		for (let tmp of gameObjects) {
			let scope = kbIndc;

			if (
				(tmp.dmg && tmp.active && tmp.isTeamObject(player)) ||
				(tmp.type == 1 && tmp.y >= 12000)
			) {
				let primaryScaling =
					((items.weapons[player.weapons[0]].knock || 0) + 0.3) *
					items.weapons[player.weapons[0]].range +
					player.scale * 2;
				let secondaryScaling = ![undefined, 9, 12, 13, 15].includes(
					player.weapons[1],
				)
					? (items.weapons[player.weapons[1]].knock || 0) *
					items.weapons[player.weapons[1]].range +
					player.scale * 2 -
					10
					: player.weapons[1] != undefined
						? 60
						: 0;
				let instaStuff = primaryScaling + secondaryScaling;
				let turretStuff =
					player.reloads[53] == 0
						? primaryScaling + secondaryScaling + 75
						: instaStuff;
				let primaryX = near.x2 + primaryScaling * Math.cos(nea);
				let primaryY = near.y2 + primaryScaling * Math.sin(nea);
				let secondaryX = near.x2 + secondaryScaling * Math.cos(nea);
				let secondaryY = near.y2 + secondaryScaling * Math.sin(nea);
				let instaX = near.x2 + instaStuff * Math.cos(nea);
				let instaY = near.y2 + instaStuff * Math.sin(nea);
				let turretX = near.x2 + turretStuff * Math.cos(nea);
				let turretY = near.y2 + turretStuff * Math.sin(nea);
				scope.x0 = primaryX; scope.y0 = primaryY;
				scope.x1 = secondaryX; scope.y1 = secondaryY;
				scope.instax = instaX; scope.instay = instaY;
				scope.turretx = turretX; scope.turrety = turretY;
				//So, primary means primary weapon hit knock back, same for secondary, insta means primary + secondary. turret means primary + secondary + turret
				let priHit = UTILS.getDist({ x: primaryX, y: primaryY }, tmp, 0, 0) < tmp.getScale() + player.scale;
				let instaHit = UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) < tmp.getScale() + player.scale;
				if (priHit) scope.hitPri = true;
				if (instaHit) scope.hitInsta = true;
				if (inWeaponRange) {
					if (priHit && player.primaryReloaded) {
						return "primary sync";
					}
					if (
						instaHit &&
						player.primaryReloaded &&
						player.secondaryReloaded &&
						near.dist2 <=
						items.weapons[player.weapons[1]].range + player.scale * 1.8
					) {
						return "insta them";
					}
				}
			}
		}
	} else {
		kbIndc.x0 = 0; kbIndc.y0 = 0;
		kbIndc.x1 = 0; kbIndc.y1 = 0;
		kbIndc.instax = 0; kbIndc.instay = 0;
		kbIndc.turretx = 0; kbIndc.turrety = 0;
		kbIndc.hitPri = false; kbIndc.hitInsta = false;
	}
	return false;
}

function drawCircles(_, f, d) {
	if (!player || !player.alive) return;
	if (!(configs.zeroFrame || configs.velTick) || !near || !near.alive) return;

	const ctx = document.getElementById("gameCanvas").getContext("2d");
	const wpn = player.weapons[0] != null ? items.weapons[player.weapons[0]] : null;

	const canKillReal = () => {
		if (!wpn || !near) return false;
		const variant = player[(player.weapons[0] < 9 ? "prima" : "seconda") + "ryVariant"];
		const variantMult = variant != null ? config.weaponVariants[variant].val : 1.18;
		// velTick doesn't care about soldier helmet
		const soldierMult = (configs.velTick && !configs.zeroFrame) ? 1 : (near.skinIndex === 6 ? 0.75 : 1);
		const baseDmg = wpn.dmg * variantMult * 1.5 * soldierMult;
		if (configs.velTick) return near.health <= baseDmg + baseDmg + baseDmg * 1.5;
		return near.health <= baseDmg + (near.skinIndex === 6 ? 19 : 25);
	};

	const canKillNoSoldier = () => {
		if (!wpn || !near) return false;
		const variant = player[(player.weapons[0] < 9 ? "prima" : "seconda") + "ryVariant"];
		const variantMult = variant != null ? config.weaponVariants[variant].val : 1.18;
		const baseDmg = wpn.dmg * variantMult * 1.5;
		if (configs.velTick) return near.health <= baseDmg + baseDmg + baseDmg * 1.5;
		return near.health <= baseDmg + 25;
	};

	// 1=green(in range+killable), 2=yellow(killable w/o soldier, out of range),
	// 3=orange(in range, only killable w/o soldier), 4=blue(killable real, out of range), 0=red
	const resolveCol = (s) => {
		if (s === 1) return { r: 34, g: 197, b: 94 }; // green
		if (s === 2) return { r: 255, g: 220, b: 0 }; // yellow
		if (s === 3) return { r: 255, g: 140, b: 0 }; // orange
		if (s === 4) return { r: 80, g: 180, b: 255 }; // blue
		return { r: 239, g: 68, b: 68 }; // red
	};

	const getState = (inRange) => {
		const real = canKillReal();
		const noSol = canKillNoSoldier();
		if (configs.velTick && !configs.zeroFrame) {
			if (inRange && noSol) return 1; // green
			if (!inRange && noSol) return 2; // yellow
			return 0;                        // red
		}
		if (inRange && real) return 1;
		if (!inRange && noSol) return 2;
		if (inRange && noSol) return 3;
		if (!inRange && real) return 4;
		return 0;
	};

	if (configs.velTick && !configs.zeroFrame) {
		const range = wpn ? wpn.range + near.scale * 1.8 : 200;

		const pred = simPredictPos(near, 1);
		if (drawCircles._vex == null) { drawCircles._vex = pred.x; drawCircles._vey = pred.y; }
		const lerpA = Math.min(1, (delta || 16) / 60);
		drawCircles._vex += (pred.x - drawCircles._vex) * lerpA;
		drawCircles._vey += (pred.y - drawCircles._vey) * lerpA;

		const ox = drawCircles._vex - f;
		const oy = drawCircles._vey - d;
		const dist = UTILS.getDistance(player.x, player.y, drawCircles._vex, drawCircles._vey);
		const hit = dist <= range;
		const state = getState(hit);

		const now2 = performance.now();
		if (drawCircles._lastStateV !== state) {
			drawCircles._transStartV = now2;
			drawCircles._lastStateV = state;
		}
		const elapsed = now2 - (drawCircles._transStartV || now2);
		const tp = Math.min(1, elapsed / 220);
		const ease = tp < 0.5 ? 2 * tp * tp : -1 + (4 - 2 * tp) * tp;

		const from = resolveCol(drawCircles._lastStateV ?? state);
		const to = resolveCol(state);
		const cr = Math.round(from.r + (to.r - from.r) * ease);
		const cg = Math.round(from.g + (to.g - from.g) * ease);
		const cb = Math.round(from.b + (to.b - from.b) * ease);
		const col = `${cr},${cg},${cb}`;

		ctx.save();
		ctx.shadowBlur = hit ? 28 : 14;
		ctx.shadowColor = `rgba(${col},1)`;
		ctx.strokeStyle = `rgba(${col},0.9)`;
		ctx.lineWidth = hit ? 4 : 3;
		ctx.beginPath();
		ctx.arc(ox, oy, range, 0, Math.PI * 2);
		ctx.stroke();

		ctx.globalAlpha = 0.3;
		ctx.lineWidth = hit ? 10 : 7;
		ctx.beginPath();
		ctx.arc(ox, oy, range, 0, Math.PI * 2);
		ctx.stroke();
		ctx.globalAlpha = 1;
		ctx.restore();
		return;
	}

	const ox = player.x - f;
	const oy = player.y - d;
	const range = wpn ? wpn.range + near.scale * 1.8 : 200;

	const dist = UTILS.getDistance(player.x, player.y, near.x2 ?? near.x, near.y2 ?? near.y);
	const hit = dist <= range;
	const state = getState(hit);

	const now2 = performance.now();
	if (drawCircles._lastState !== state) {
		drawCircles._transStart = now2;
		drawCircles._lastState = state;
	}
	const elapsed = now2 - (drawCircles._transStart || now2);
	const tp = Math.min(1, elapsed / 220);
	const ease = tp < 0.5 ? 2 * tp * tp : -1 + (4 - 2 * tp) * tp;

	const from = resolveCol(drawCircles._lastState ?? state);
	const to = resolveCol(state);
	const cr = Math.round(from.r + (to.r - from.r) * ease);
	const cg = Math.round(from.g + (to.g - from.g) * ease);
	const cb = Math.round(from.b + (to.b - from.b) * ease);
	const col = `${cr},${cg},${cb}`;

	let px2 = near.x - f, py2 = near.y - d;
	try {
		const sim = new MovementSimulator(near, player);
		sim.continueTick(delta || 16, near.moveDir, false);
		px2 = sim.x - f;
		py2 = sim.y - d;
	} catch (_) { }

	ctx.save();

	ctx.shadowBlur = hit ? 28 : 14;
	ctx.shadowColor = `rgba(${col},1)`;
	ctx.strokeStyle = `rgba(${col},0.9)`;
	ctx.lineWidth = hit ? 4 : 3;
	ctx.beginPath();
	ctx.arc(ox, oy, range, 0, Math.PI * 2);
	ctx.stroke();

	ctx.globalAlpha = 0.3;
	ctx.lineWidth = hit ? 10 : 7;
	ctx.beginPath();
	ctx.arc(ox, oy, range, 0, Math.PI * 2);
	ctx.stroke();
	ctx.globalAlpha = 1;

	if (wpn) {
		ctx.shadowBlur = 0;
		ctx.globalAlpha = 0.22;
		ctx.strokeStyle = "#fff";
		ctx.lineWidth = 1.2;
		ctx.setLineDash([4, 6]);
		ctx.beginPath();
		ctx.arc(ox, oy, wpn.range, 0, Math.PI * 2);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.globalAlpha = 1;
	}

	ctx.shadowBlur = 8;
	ctx.shadowColor = `rgba(${col},0.7)`;
	ctx.strokeStyle = `rgba(${col},${hit ? 0.75 : 0.4})`;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(ox, oy);
	ctx.lineTo(px2, py2);
	ctx.stroke();

	ctx.shadowBlur = hit ? 18 : 8;
	ctx.shadowColor = `rgba(${col},1)`;
	ctx.fillStyle = `rgba(${col},${hit ? 1 : 0.65})`;
	ctx.beginPath();
	ctx.arc(px2, py2, hit ? 6 : 4, 0, Math.PI * 2);
	ctx.fill();

	ctx.restore();
}

// ADD DEAD PLAYER:
function addDeadPlayer(tmpObj) {
	deadPlayers.push(
		new DeadPlayer(
			tmpObj.x,
			tmpObj.y,
			tmpObj.dir,
			tmpObj.buildIndex,
			tmpObj.weaponIndex,
			tmpObj.weaponVariant,
			tmpObj.skinColor,
			tmpObj.scale,
			tmpObj.name,
		),
	);
}

/** APPLY SOCKET CODES */

// SET INIT DATA:
function setInitData(data) {
	//console.log("setInitData", data);
	// data = { teams: [{sid: "nameOfParty", owner: ownerSID}, {sid: "nameOfParty", owner: ownerSID}]}
	data.teams.forEach((obj) => {
		alliances.push(obj);
	});
}

// SETUP GAME:
function setupGame(yourSID) {
	keys = {};
	macro = {};
	playerSID = yourSID;
	attackState = 0;
	inGame = true;
	serverMenu.style.display = "none";
	window.bgAnim?.stop();
	packet("F", 0, getAttackDir(), 1);
	my.ageInsta = true;
	if (firstSetup) {
		firstSetup = false;
		gameObjects.length = 0;
		workerSetInterval(() => {
			packet("0", 1);
		}, 1000);
		let max = setTimeout(() => { }, 0);

		for (let i = 0; i <= max; i++) {
			clearTimeout(i);
			clearInterval(i);
		}
	}
	pingDisplay.style.display = "block";
	updateWeaponXPBars();
	workerClearInterval(allServerPingInterval);

	if (!document.getElementById("uehmod")) {
		const styleEl = document.createElement("style");
		styleEl.textContent = `
.sizing { font-size: 15px; }
#uehmod { position: fixed; left: 165px; bottom: 20px; width: 140px; padding: 8px; background-color: rgba(0, 0, 0, 0.25); box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5); border-radius: 8px; display: flex; flex-direction: column; gap: 6px; }
.stats-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
.stats-label { color: #cfcfcf; }
.stats-value { color: #ffffff; font-weight: 700; }
.stats-group { display: flex; flex-direction: column; gap: 6px; }
.stats-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 4px 0; }
`;
		document.head.appendChild(styleEl);
		const ueh = document.createElement("div");
		ueh.id = "uehmod";
		ueh.className = "sizing";
		ueh.innerHTML = `
  <div class="stats-group">
    <div class="stats-row">
      <span class="stats-label">PING</span>
      <span id="pingFps" class="stats-value">-</span>
    </div>
    <div class="stats-row">
      <span class="stats-label">FPS</span>
      <span id="fpsCounter" class="stats-value">-</span>
    </div>
  </div>
  <div class="stats-divider"></div>
  <div class="stats-group">
    <div class="stats-row">
      <span class="stats-label">PACKET</span>
      <span id="packetStatus" class="stats-value">-</span>
    </div>
  </div>
`;
		document.body.appendChild(ueh);
	}
}

// ADD NEW PLAYER:
function addPlayer(data, isYou) {
	let tmpPlayer = findPlayerByID(data[0]);
	if (!tmpPlayer) {
		tmpPlayer = new Player(
			data[0],
			data[1],
			config,
			UTILS,
			projectileManager,
			objectManager,
			players,
			ais,
			items,
			hats,
			accessories,
		);
		players.push(tmpPlayer);
		if (data[1] != playerSID) {
			ChText("Game", `Encountered ${data[2]} {${data[1]}}.`, "lightblue");
		}
	} else {
		if (data[1] != playerSID) {
			ChText("Game", `Encountered ${data[2]} {${data[1]}}.`, "lightblue");
		}
	}
	tmpPlayer.spawn(isYou ? true : null);
	tmpPlayer.visible = false;
	tmpPlayer.oldPos = {
		x2: undefined,
		y2: undefined,
	};
	tmpPlayer.x2 = undefined;
	tmpPlayer.y2 = undefined;
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

let healTimeout;

// UPDATE HEALTH:
function updateHealth(sid, value) {
	tmpObj = findPlayerBySID(sid);
	if (tmpObj) {
		tmpObj.oldHealth = tmpObj.health;
		tmpObj.health = value;
		tmpObj.maxHealth = Math.max(tmpObj.health, tmpObj.maxHealth);
		tmpObj.judgeShame();
		if (tmpObj.oldHealth > tmpObj.health) {
			tmpObj.damaged = tmpObj.oldHealth - tmpObj.health;
			// poison tick = exactly 5 dmg, not from a direct hit (shameCount unchanged)
			if (tmpObj.damaged === 5 && tmpObj.shameCount === tmpObj.lastshamecount) {
				tmpObj.lastPoisonAtMs = Date.now();
			}
			advHeal.push([sid, value, tmpObj.damaged]);
			workerClearTimeout(healTimeout);
			healTimeout = workerSetTimeout(() => {
				if (player.health < player.maxHealth && !my.healed) {
					my.healed = true;
					healer();
				}
			}, Math.max(50, 140 - (window.ping || 0)));
		}
	}
}

let pingTracker = [];
let sentPingTime = 0;

function pingSocketResponse() {
	let currentPing = Date.now() - sentPingTime;
	pingTracker.push(currentPing);

	if (pingTracker.length > 10) {
		pingTracker.shift(); // Remove the oldest entry
	}

	calcPing(pingTracker);
}

function calcPing(values) {
	if (values.length === 0) return 0;

	let sorted = [...values].sort((a, b) => a - b);
	let mid = Math.floor(sorted.length / 2);

	if (sorted.length % 2 === 0) {
		// Even number of elements – average the two middle values
		ping.avg = (sorted[mid - 1] + sorted[mid]) / 2;
	} else {
		// Odd number – return the middle value
		ping.avg = sorted[mid];
	}
	ping.min = sorted[0];
	ping.max = sorted[sorted.length - 1];
}

// KILL PLAYER:
function killPlayer() {
	my.autoGathering = false;
	inGame = false;
	window.bgAnim?.start();
	lastDeath = {
		x: player.x,
		y: player.y,
	};
	game.tickBase(() => {
		if (configs.autoRespawn) {
			packet("M", {
				name: lastsp[0],
				moofoll: lastsp[1],
				skin: lastsp[2],
			});

			// Auto-login for private server
			if (mainSocket && mainSocket.url && mainSocket.url.includes('tw-moo-privateserver.onrender.com' || 'localhost')) {
				packet("6", "!login tinysweet");

				setTimeout(() => {
					packet("6", "!setup");
				}, 5);
			}
		}
	}, 5);
	// must use setTimeout here not worker cuz need to sync with the normal setTimeout
	setTimeout(() => {
		if (inGame) {
			menuCardHolder.style.display = "none";
			mainMenu.style.display = "none";
			diedText.style.display = "none";
		} else {
			startRenderLoop();
			removeSnowflakes();
			allServerPingInterval = workerSetInterval(updateServers, 5000);
		}
	}, config.deathFadeout);
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
	if (xp != undefined) player.XP = xp;
	if (mxp != undefined) player.maxXP = mxp;
	if (age != undefined) player.age = age;
}

// UPDATE UPGRADES:
function updateUpgrades(points, age) {
	player.upgradePoints = points;
	player.upgrAge = age;
	if (points > 0) {
		tmpList.length = 0;
		UTILS.removeAllChildren(upgradeHolder);
		for (let i = 0; i < items.weapons.length; ++i) {
			if (
				items.weapons[i].age == age &&
				(items.weapons[i].pre == undefined ||
					player.weapons.indexOf(items.weapons[i].pre) >= 0)
			) {
				let e = UTILS.generateElement({
					id: "upgradeItem" + i,
					class: "actionBarItem",
					onmouseout: function () {
						showItemInfo();
					},
					parent: upgradeHolder,
				});
				e.style.backgroundImage = getEl(
					"actionBarItem" + i,
				).style.backgroundImage;
				tmpList.push(i);
			}
		}
		for (let i = 0; i < items.list.length; ++i) {
			if (
				items.list[i].age == age &&
				(items.list[i].pre == undefined ||
					player.items.indexOf(items.list[i].pre) >= 0)
			) {
				let tmpI = items.weapons.length + i;
				let e = UTILS.generateElement({
					id: "upgradeItem" + tmpI,
					class: "actionBarItem",
					onmouseout: function () {
						showItemInfo();
					},
					parent: upgradeHolder,
				});
				e.style.backgroundImage = getEl(
					"actionBarItem" + tmpI,
				).style.backgroundImage;
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

// KILL OBJECT:
function killObject(sid) {
	let findObj = findObjectBySid(sid);
	objectManager.disableBySid(sid);
	if (findObj && inGame) {
		if (!player.canSee(findObj)) {
			breakTrackers.push({ x: findObj.x, y: findObj.y });
		}
		if (breakTrackers.length > 8) {
			breakTrackers.shift();
		}
		if (
			configs.spikeTick &&
			!instaC.isTrue &&
			player.weapons[0] != 8 &&
			player.tailIndex != 11 &&
			instaC.spikeTickAngle != null &&
			!instaC.spikeTickFired &&
			instaC.spikeTickTrap &&
			instaC.spikeTickTrap.sid === sid &&
			near && near.dist2 <= 300 &&
			player.primaryReloaded &&
			my.anti0Tick <= 0 &&
			!player.empAnti &&
			!my.forceStop
		) {
			instaC.spikeTickFired = true;
			place(2, instaC.spikeTickAngle);
			instaC.spikeTickType();
			instaC.spikeTickAngle = null;
			instaC.spikeTickTrap = null;
		} else {
			instaC.spikeTickAngle = null;
			instaC.spikeTickTrap = null;
		}
		autoPlace.replaced = false;
		autoPlace.autoReplace(findObj, true);
	}
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
let hatChanger = function () {
	if (my.forceStop) {
		return storeEquip(player.empAnti ? 22 : player.soldierAnti ? 6 : 6, 0);
	}
	if (my.anti0Tick > 0) {
		return storeEquip(6, 0);
	}
	if (instaC.shameGrinding) {
		storeEquip(near.shameCount > 5 ? 40 : 7, 0);
		storeEquip(21, 1);
	} else if (player.empAnti) {
		storeEquip(22, 0);
	} else if (player.soldierAnti) {
		storeEquip(6, 0);
	} else {
		let bullTick = canBullTick();
		if (clicks.left || clicks.right) {
			if (clicks.left) {
				storeEquip(player.primaryReloaded ? configs.weaponGrind ? 40 : 7 : player.tailIndex == 11 ? 7 : player.antiTurretSpam ? 22 : (configs.antiBullType && options.antiBullType == "abreload" && near.antiBull > 0) ? 11 : near.dist2 <= 300 ? (configs.antiBullType && options.antiBullType == "abalway" && near.primaryReloaded) ? 11 : 6 : biomeGear(1, 1), 0);
			} else if (clicks.right) {
				storeEquip(player[(autoBreak.useHammer() ? "secondary" : "primary") + "Reloaded"] && sent.hat != 40 ? 40 : player.antiTurretSpam ? 22 : (configs.antiBullType && options.antiBullType == "abreload" && near.antiBull > 0) ? 11 : near.dist2 <= 300 ? (configs.antiBullType && options.antiBullType == "abalway" && near.primaryReloaded) ? 11 : 6 : biomeGear(1, 1), 0);
			}
		} else if (autoBreak.active) {
			let weapon = autoBreak.useHammer(autoBreak.target) ? player.weapons[1] : player.weapons[0]
			if (autoBreak.target?.health > items.weapons[weapon].dmg * (items.weapons[weapon].sDmg || 1) && player[(weapon < 9 ? "primary" : "secondary") + "Reloaded"]) {
				storeEquip(40, 0);
			} else {
				if (bullTick) {
					storeEquip(7, 0);
				} else {
					storeEquip((near.dist2 > 300 || !enemy.length) ? 22 : 6, 0);
				}
			}
		}
		if (
			configs.hatType &&
			window.hattoggle_funniHat !== false &&
			player.noMovTimer >= 1000 &&
			player.health == 100 &&
			isNaN(wasdDir)
		) {
			storeEquip(resolveHatId(getFunniHat()), 0);
		} else {
			if (player.antiTurretSpam) {
				storeEquip(22, 0);
			} else {
				if (bullTick) {
					storeEquip(7, 0);
				} else {
					if (player.inWater) {
						if (!configs.alwaysFlipper) {
							if (near.dist2 <= 300) {
								storeEquip(
									configs.antiBullType &&
										options.antiBullType == "abreload" &&
										near.antiBull > 0
										? 11
										: configs.antiBullType &&
											options.antiBullType == "abalway" &&
											near.primaryReloaded
											? 11
											: 6,
									0,
								);
							} else {
								biomeGear(1);
							}
						} else {
							biomeGear(1);
						}
					} else {
						if (near.dist2 <= 300 && !macro.l) {
							storeEquip(
								configs.antiBullType &&
									options.antiBullType == "abreload" &&
									near.antiBull > 0
									? 11
									: configs.antiBullType &&
										options.antiBullType == "abalway" &&
										near.primaryReloaded
										? 11
										: 6,
								0,
							);
						} else {
							biomeGear(1);
						}
					}
				}
			}
		}
	};
};

let accChanger = function () {
	if (instaC.shameGrinding) return;
	if (player.weapons[0] != 8 && ((near.hitSpike && near.inTrap) || (my.autoPush && UTILS.getDist(player, my.pushData, 2, 2) <= 169) || clicks.left || near.dist2 < 300)) { //if bull spamming or near enemy when your primary weapon is not stick, and when ur not close to your auto push goto coordinates
		if (configs.antiBullType) {
			storeEquip(21, 1)
		} else {
			storeEquip(19, 1)
		}
	} else {
		storeEquip(11, 1);
	}
};

function canBullTick() {
	if (player.inTrap && player.hitSpike) return false;
	if (my.reSync) return true;
	if (
		!instaC.isTrue &&
		player.shameCount > 0 &&
		my.anti0Tick <= 0 &&
		!player.empAnti &&
		!my.forceStop &&
		player.skinIndex != 45 &&
		player.health > 5 &&
		player.poisonCounter <= 0 &&
		player.damageSources.sum < 95
	) {
		if ([8, 0].includes((game.tick - my.bullTick) % 9) || player.needTick > 2) {
			if (!autoBreak.active) player.needTick++;
			return true;
		}
	}
	return false;
}

let triedAngles = new Set();
let lastTickTime = performance.now();
// Map of timeout IDs keyed by a tag so each preplace slot gets its own timer
const scheduleTimeouts = {};
function scheduleAction(actions, delay = 0, tag = "default") {
	// use ping.min for tightest arrival window
	let nextTick = lastTickTime + game.tickRate;
	let sendTime = nextTick - (ping.min > 0 ? ping.min : ping.avg) / 2;
	let timing = sendTime - performance.now() + delay;

	if (scheduleTimeouts[tag]) workerClearTimeout(scheduleTimeouts[tag]);
	scheduleTimeouts[tag] = workerSetTimeout(() => {
		delete scheduleTimeouts[tag];
		actions();
	}, Math.max(0, timing));
}

let wasdDir = getMoveDir();

// UPDATE PLAYER DATA:
function updatePlayers(data) {
	// let predictor = new MovementSimulator(player);
	// predictor.continueTick(113, player.moveDir, 1);
	game.tickSpeed = performance.now() - game.lastTick;
	game.lastTick = performance.now();
	lastTickTime = game.lastTick - (ping.min > 0 ? ping.min : ping.avg) / 2;
	game.tick++;
	enemy.length = 0;
	nears.length = 0;
	nearObjs.length = 0;
	players.forEach((tmp) => {
		tmp.forcePos = !tmp.visible;
		tmp.visible = false;
	});
	getMouseWorldPos();
	wasdDir = getMoveDir();
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
			tmpObj.x3 = tmpObj.x2 * 2 - tmpObj.oldPos.x2;
			tmpObj.y3 = tmpObj.y2 * 2 - tmpObj.oldPos.y2;
			tmpObj.moveDist = UTILS.getDist(tmpObj, tmpObj, 2, 3);
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
			tmpObj.inWater =
				tmpObj.y2 >= config.mapScale / 2 - config.riverWidth / 2 &&
				tmpObj.y2 <= config.mapScale / 2 + config.riverWidth / 2;
			tmpObj.dist2 = UTILS.getDist(tmpObj, player, 2, 2);
			tmpObj.aim2 = UTILS.getDirect(tmpObj, player, 2, 2);
			tmpObj.mouseDist = UTILS.getDist(mousePos, player, 0, 2);
			tmpObj.hitSpike = 0;
			if (tmpObj.skinIndex == 45 && tmpObj.shameTimer <= 0) {
				tmpObj.addShameTimer();
			}
			if (tmpObj.oldSkinIndex == 45 && tmpObj.skinIndex != 45) {
				tmpObj.shameTimer = 0;
				tmpObj.shameCount = 0;
				if (tmpObj.sid == player.sid) {
					healer();
					my.healed = true;
				}
			}
			tmpObj.update(113);
			if (tmpObj.sid == player.sid) {
				let already = new Set();
				objectManager.getGridArrays(tmpObj.x2, tmpObj.y2, 696).forEach((arr) => {
					arr.forEach((obj) => {
						if (obj.active && !already.has(obj.sid)) {
							already.add(obj.sid);
							if (UTILS.getDist(obj, player, 0, 2) <= 696) nearObjs.push(obj);
						}
					});
				});
				for (let thing in tmpObj.damageSources) {
					tmpObj.damageSources[thing] = 0;
				}
				let turretsCanHit = 0;
				nearObjs.forEach((tmp) => {
					tmp.onNear = false;
					if (tmp.active) {
						/*if (!tmp.onNear && UTILS.getDist(tmp, tmpObj, 0, 2) <= tmp.scale + items.weapons[tmpObj.weapons[0]].range) {
														tmp.onNear = true;
												}*/
						if (tmp.name == "turret") {
							if (!tmp.isTeamObject(tmpObj)) {
								turretsCanHit++;
								if (tmp.reloads <= ping.max) {
									tmpObj.addDamageThreat("projectile", 25);
								}
							}
							if (tmp.reloads <= 0) {
								tmp.reloads = 2200;
							} else {
								tmp.reloads -= game.tickRate;
							}
						}
					}
				});
				tmpObj.antiTurretSpam = turretsCanHit >= 5;
				let nearSpikes = nearObjs
					.filter(
						(e) =>
							e.dmg &&
							UTILS.getDist(e, player, 0, 2) <= 169 &&
							!e.isTeamObject(tmpObj),
					)
					.sort(function (a, b) {
						return (
							UTILS.getDist(a, tmpObj, 0, 2) - UTILS.getDist(b, tmpObj, 0, 2)
						);
					});
				if (player.inTrap) {
					let aimToTrap = UTILS.getDirect(player.inTrap, player, 0, 2);
					if (!autoPlace.antiTrapped) {
						autoPlace.protect(aimToTrap);
					}
					[nearSpikes[0], player.inTrap, nearSpikes[1]].forEach((item) => {
						if (item && !autoBreak.priority[0].includes(item)) {
							autoBreak.priority[0].push(item);
						}
					});
				} else {
					traps.antiTrapped = false;
				}
				if (configs.breakSpikeSwitch) {
					nearSpikes.forEach((spike) => {
						if (!autoBreak.priority[1].includes(spike)) {
							autoBreak.priority[1].push(spike);
						}
					});
				}
				if (configs.breakTrapSwitch) {
					let traps = nearObjs.filter((e) => !e.isTeamObject(player) && e.trap && e.active);
					traps.forEach((obj) => {
						if (!autoBreak.priority[1].includes(obj)) {
							autoBreak.priority[1].push(obj);
						}
					});
				}
				if (configs.breakTTBSwitch) {
					let turretTp = nearObjs.filter(
						(e) =>
							!e.isTeamObject(player) &&
							(e.name == "turret" ||
								e.name == "teleporter" ||
								e.name == "blocker"),
					);
					turretTp.forEach((obj) => {
						if (!autoBreak.priority[2].includes(obj)) {
							autoBreak.priority[2].push(obj);
						}
					});
				}
				if (configs.breakAllSwitch) {
					nearObjs.forEach((obj) => {
						if (obj.type == null && !autoBreak.priority[3].includes(obj)) {
							autoBreak.priority[3].push(obj);
						}
					});
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

	// Update projectile detection and dodge system
	try {
		detectProjectile.run(projectiles, player);
	} catch (error) {
		console.error("Error in detectProjectile.run():", error);
	}

	if (projectileTick.length) {
		projectileTick.forEach((tmp) => {
			checkProjectileHolder(...tmp);
		});
		projectileTick = [];
	}

	projectiles.forEach((tmp) => {
		tmp.tickUpdate(game.tickSpeed);
	});

	if (!my.killPrimaryActive) my.killPrimaryActive = false;

	for (let i = 0; i < data.length;) {
		tmpObj = findPlayerBySID(data[i]);
		if (tmpObj) {
			if (!tmpObj.isTeam(player)) {
				enemy.push(tmpObj);
				if (
					tmpObj.dist2 <=
					items.weapons[
						tmpObj.primaryIndex == undefined ? 5 : tmpObj.primaryIndex
					].range +
					player.scale * 2 +
					69
				) {
					nears.push(tmpObj);
				}
			}
			tmpObj.manageReload();
		}
		i += 13;
	}
	if (player && player.alive) {
		near = {};
		if (enemy.length) {
			near = enemy.sort(function (tmp1, tmp2) {
				return tmp1.dist2 - tmp2.dist2;
			})[0];
		}

		if (
			enemy.length &&
			!instaC.isTrue
		) {
			if (configs.zeroFrame) {
				instaC.zeroFrameType();
			} else if (configs.velTick) {
				instaC.velTickType();
			}
			instaC.primaryKillType();
		}

		workerClearTimeout(scheduleTimeouts["default"]);
		if (game.tickQueue[game.tick]) {
			game.tickQueue[game.tick].forEach((action) => {
				action();
			});
			game.tickQueue[game.tick] = null;
		}

		antiSpike();
		player.processDamages();
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
				let nearSpike = nearObjs.find(
					(obj) =>
						((obj.type == 1 && obj.y >= 12000) ||
							(obj.dmg && !obj.isTeamObject(tmpObj))) &&
						UTILS.getDist(obj, tmpObj, 0, 2) <=
						obj.getScale() + tmpObj.scale + 1,
				);
				if (
					nearSpike &&
					damaged == (nearSpike.dmg || 35) * (tmpObj.skinIndex == 6 ? 0.75 : 1)
				)
					tmpObj.hitSpike = nearSpike.dmg || 35;
				if (damaged == 5 * (tmpObj.skinIndex == 6 ? 0.75 : 1)) {
					my.bullTick = game.tick;
					if (tmpObj.sid == player.sid) {
						tmpObj.needTick = 0;
						if (my.reSync) {
							my.reSync = false;
						}
						if (tmpObj.skinIndex == 7) {
							bullTicked = true;
						} else {
							tmpObj.poisonCounter--;
						}
					}
				}
				if (tmpObj.sid == player.sid) {
					if (inGame) {
						let shame =
							near.primaryIndex == 5 &&
								[undefined, 9, 12, 13, 15].includes(near.secondaryIndex)
								? 6
								: [7, 8].includes(near.primaryIndex)
									? 3
									: 5;
						if (tmpObj.hitSpike && (tmpObj.inTrap || tmpObj.lastTrap)) {
							shame = 7;
							tmpObj.addDamageThreat("spike", tmpObj.hitSpike);
						}
						let attackers = getAttacker(damaged);
						let maxHealth = player.maxHealth;
						let dmg = maxHealth - player.health;
						let bullTickDmg = 5;
						let damageIfSoldier = tmpObj.damageSources.totalSoldier;

						let gearDmgs = [0.25, 0.45].map(v => v * items.weapons[player.weapons[0]].dmg);
						let includeSpikeDmgs = near.length
							? !my.bullTick && gearDmgs.includes(damaged) && near.skinIndex == 11 && near.tailIndex == 21
							: false;
						let autoheal = false;

						if (damaged >= 0 && damaged <= 66 && tmpObj.shameCount === 4 && player.primaryIndex !== "4") {
							autoheal = configs.autoHeal;
						}

						if (
							dmg + tmpObj.damageSources.totalNoSoldier >= maxHealth &&
							dmg + damageIfSoldier < maxHealth
						) {
							my.forceStop = true;
						}
						if (
							damaged >= (includeSpikeDmgs ? 8 : 20) &&
							tmpObj.damageThreat >= 20 &&
							game.tick - tmpObj.antiTimer > 1
						) {
							if (tmpObj.reloads[53] == 0 && tmpObj.reloads[tmpObj.weapons[1]] == 0) {
								tmpObj.canEmpAnti = true;
							} else {
								tmpObj.soldierAnti = true;
							}
							tmpObj.antiTimer = game.tick;
						}
						if (
							attackers.some((near) =>
								[undefined, 9, 12, 13, 15].includes(near.secondaryIndex),
							)
						) {
							if (
								[18.75, 22.5, 25, 26.25, 30, 35, 37.5, 50].includes(damaged) &&
								dmg + damageIfSoldier >= maxHealth
							) {
								if (tmpObj.shameCount < shame) {
									healer();
									my.healed = true;
								}
							} else if (
								damaged > 39 &&
								damaged < 80 &&
								dmg + damageIfSoldier >= maxHealth
							) {
								if (
									tmpObj.damageSources.turret &&
									game.tick - tmpObj.antiTimer > 1
								) {
									tmpObj.empAnti = true;
									tmpObj.antiTimer = game.tick;
									tmpObj.removeDamageThreat("turret", 25);
								}
								if (
									tmpObj.shameCount < shame &&
									dmg +
									(tmpObj.empAnti
										? tmpObj.damageSources.totalNoSoldier
										: tmpObj.damageSources.totalSoldier) >=
									maxHealth
								) {
									tmpObj.empAnti = false;
									healer();
									my.healed = true;
								}
							} else if (
								damaged > bullTickDmg &&
								dmg + damageIfSoldier >= maxHealth
							) {
								if (tmpObj.shameCount < shame) {
									healer();
									my.healed = true;
								}
							}
						} else {
							if (damaged > bullTickDmg && dmg + damageIfSoldier >= maxHealth) {
								if (tmpObj.shameCount < shame) {
									healer();
									my.healed = true;
								}
							}
						}
						if (autoheal && configs.autoHeal && !my.healed) {
							game.tickBase(() => {
								healer();
							}, 2);
							my.healed = true;
						}
						if (
							damaged >= 20 &&
							player.skinIndex == 11 &&
							attackers.length &&
							near.weaponIndex != near.secondaryIndex
						)
							instaC.canCounter = true;
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
				tmp.primaryReloaded = true;
				tmp.secondaryReloaded = true;
			}
		});
		if (inGame) {
			if (enemy.length) {
				if (player.canEmpAnti) {
					player.canEmpAnti = false;
					if (near && near.dist2 !== undefined && near.dist2 <= 300) {
						if (near.reloads[53] == 0) {
							player.empAnti = true;
							player.soldierAnti = false;
						} else {
							player.empAnti = false;
							player.soldierAnti = true;
						}
					}
				}
				autoPlace.preplaces[0] = [];
				autoPlace.preplaces[1] = [];
				autoPlace.rangesUpdated[2] = false;
				autoPlace.rangesUpdated[4] = false;
				if (my.autoPush) {
					if (near.dist2 <= 169) {
						autoPlace.autoPlace(0, 2, 4);
					} else if (near.dist2 > 222) {
						autoPlace.autoPlace(0, 4, 2);
					}
				} else {
					if (near.dist2 <= 222) {
						if (near.inTrap) {
							autoPlace.autoPlace(0, 2, 4);
						} else if (near.escaped) {
							autoPlace.autoPlace(0, 4, 2);
						} else {
							autoPlace.autoPlace(1, 2, 4, true);
						}
					} else {
						if (near.dist2 > 269 && near.dist2 < 400) {
							autoPlace.autoPlace(0, 4, 2);
						} else if (near.dist2 <= 269) {
							autoPlace.autoPlace(1, 4, 2, true);
						}
					}
				}
				if (
					!instaC.isTrue &&
					configs.spikeTick &&
					player.weapons[0] != 8 &&
					player.tailIndex != 11
				) {
					if (near.inTrap) {
						if (!autoPlace.rangesUpdated[2]) autoPlace.angleRanges(2);
						const r2 = autoPlace.ranges[2];
						if (r2?.length) {
							// Place spike directly at trap position for accurate kill
							const ang = UTILS.getDirect(near.inTrap, player, 0, 2);
							instaC.spikeTickAngle = ang;
							instaC.spikeTickFired = false;
							instaC.spikeTickTrap = near.inTrap;
						}
						if (near.hitSpike) {
							let nearReload = near.reloads[
								near.secondaryIndex == 10 ? near.secondaryIndex : near.primaryIndex
							];
							if (
								items.weapons[player.weapons[0]].speed < nearReload ||
								nearReload < ping.min
							) {
								instaC.canSpikeTick = true;
							}
						}
					}
				}
				if (configs.anti1tick) {
					enemy.forEach((tmpObj) => {
						if (tmpObj.primaryIndex == 5 && tmpObj.primaryVariant >= 2) {
							if (tmpObj.dist2 >= 169 && tmpObj.dist2 <= 269) {
								if (tmpObj.skinIndex == 53) {
									my.anti0Tick = 2;
									predictHeal(1);
									player.chat.message = `Anti 1 tick by ${tmpObj.sid} ${tmpObj.name}`;
									player.chat.count = 334;
								}
							}
						}
					});
				}
				if (
					nears.length > 1 &&
					nears.some((tmpObj) =>
						[undefined, 3, 4, 5].includes(tmpObj.primaryIndex),
					) &&
					secPacket < 60
				) {
					if (configs.autoQonSync && player.shameCount < 5) {
						my.anti0Tick = 1;
						predictHeal(2);
						player.chat.message = `sync detect test`;
						player.chat.count = 112;
					}
				}
				if (configs.serverSync && syncersInServer.length && nears.length) {
					nears.forEach((tmpObj) => {
						syncersInServer.forEach((sid) => {
							if (tmpObj.sid == sid) return;
							let myDist = tmpObj.dist3;
							let syncer = findPlayerBySID(sid);
							if (!syncer) return;
							let syncerDist = UTILS.getDist(syncer, tmpObj, 3, 3);
							if (
								myDist <=
								player.scale * 1.8 + items.weapons[player.weapons[0]].range &&
								syncerDist <=
								player.scale * 1.8 +
								items.weapons[syncer.primaryIndex || 5].range &&
								player.primaryReloaded &&
								syncer.primaryReloaded
							) {
								instaC.spikeTickType();
							}
						});
					});
				}
				if (
					!instaC.isTrue &&
					configs.predictTick &&
					my.anti0Tick <= 0 &&
					!player.empAnti &&
					!my.forceStop &&
					!near.inTrap &&
					player.tailIndex != 11
				) {
					let spikeSync = knockBackPredict();
					if (
						spikeSync == "insta them" &&
						(![9, 12, 13, 15].includes(player.weapons[1]) ||
							near.dist2 <=
							items.weapons[player.weapons[1]].range + player.scale * 1.8)
					) {
						instaC.changeType("rev");
					}
					if (spikeSync == "primary sync") {
						instaC.spikeTickType("rev");
					}
					let prehit = nearObjs
						.filter(
							(tmp) =>
								tmp.dmg &&
								tmp.isTeamObject(player) &&
								UTILS.getDist(tmp, near, 0, 3) <= tmp.scale + near.scale,
						)
						.sort(function (a, b) {
							return (
								UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2)
							);
						})[0];
					if (prehit) {
						if (
							near.dist2 <=
							items.weapons[player.weapons[0]].range + player.scale * 1.8
						) {
							instaC.canSpikeTick = true;
						}
					}
				}
				tryAutoPush();
				if (!my.autoPush && !debugStop && !player.inTrap && !detectProjectile.isDodging && configs.autoPlay && enemy.length && near.dist2 < PF.scale / 2) {
					let result = createPath.calc(
						{
							x: Math.cos(near.aim2 + Math.PI / 2) * (near.scale * 2),
							y: Math.sin(near.aim2 + Math.PI / 2) * (near.scale * 2),
						},
						false,
						"follow",
					);
					PF.paths = result.paths;
					PF.attempts = result.attempts;
					if (PF.paths.length > 0) {
						PF.finded = true;
						//  player.lastStop.active = false;
						let dir = UTILS.getDirect(PF.paths[1], player, 0, 2);
						packet("9", dir, 1);
					} else {
						result = createPath.calc({ x: 0, y: 0 }, true, "follow");
						PF.paths = result.paths;
						PF.attempts = result.attempts;
						if (PF.paths.length > 0) {
							PF.finded = true;
							// player.lastStop.active = false;
							let dir = UTILS.getDirect(PF.paths[1], player, 0, 2);
							packet("9", dir, 1);
						} else {
							console.log(1)
							PF.finded = false;
							packet("9", player.moveDir, 1);
						}
					}
				} else {
					PF.finded = false;
				}
				if (configs.breakAroundSwitch) {
					if (near.inTrap) {
						let objs = nearObjs.filter(
							(e) =>
								UTILS.getDist(e, near.inTrap, 0, 0) < 200 &&
								!(e.dmg && e.isTeamObject(player)) &&
								e.sid != near.inTrap.sid,
						);
						objs.forEach((obj) => {
							if (!autoBreak.priority[1].includes(obj)) {
								autoBreak.priority[1].push(obj);
							}
						});
					}
				}
			} else {
				my.autoPush = false;
				PF.active = false;
				PF.finded = false;
			}
			if (
				near.dist2 <=
				items.weapons[
					player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]
				].range +
				near.scale * 1.8 &&
				instaC.wait &&
				!instaC.isTrue &&
				!my.waitHit &&
				player.primaryReloaded &&
				player.secondaryReloaded &&
				instaC.perfCheck(player, near)
			) {
				const canKill = () => {
					const pw = items.weapons[player.weapons[0]], sw = items.weapons[player.weapons[1]];
					if (!near || !pw || !sw) return false;
					if (player.reloads[player.weapons[0]] != 0 || player.reloads[player.weapons[1]] != 0) return false;
					if ((near.dist2 ?? UTILS.getDist(player, near, 0, 2)) > pw.range + near.scale * 1.8) return false;
					const s = near.skinIndex == 6;
					const dmg = (pw.dmg * (player.primaryVariant != null ? config.weaponVariants[player.primaryVariant].val : 1) * (player.skins[7] ? 1.5 : 1) + (sw.Pdmg ?? sw.dmg) * (player.secondaryVariant != null ? config.weaponVariants[player.secondaryVariant].val : 1)) * (s ? 0.75 : 1) + (player.skins[53] && player.reloads[53] <= game.tickRate && near.skinIndex != 22 ? (s ? 19 : 25) : 0);
					return near.health <= dmg;
				};
				instaC.can = canKill();
			} else {
				instaC.can = false;
			}
			if (configs.antiBoost && near.dist2 <= 500 && antiBoostCd <= 0) {
				const evx = near.xVel || 0, evy = near.yVel || 0;
				const espd = Math.hypot(evx, evy) * game.tickRate;
				if (espd > 50) {
					const dx = player.x2 - near.x2, dy = player.y2 - near.y2;
					const dot = evx * dx + evy * dy;
					if (dot > 0) {
						const awayFromEnemy = Math.atan2(player.y2 - near.y2, player.x2 - near.x2);
						place(2, awayFromEnemy);
						place(2, awayFromEnemy + Math.PI / 5);
						place(2, awayFromEnemy - Math.PI / 5);
						place(2, awayFromEnemy + Math.PI / 2);
						place(2, awayFromEnemy - Math.PI / 2);
						antiBoostCd = 4;
					}
				}
			}
			if (antiBoostCd > 0) antiBoostCd--;
			macro.q && place(0, getAttackDir());
			macro.f && place(4, getSafeDir());
			macro.v && place(2, getSafeDir());
			macro.y && place(5, getSafeDir());
			macro.h && place(player.getItemType(22), getSafeDir());
			macro.n && place(3, getSafeDir());
			if (macro.g) {
				if (!autoPlace.rangesUpdated[2]) autoPlace.angleRanges(2);
				console.log(autoPlace.ranges[2]);
				autoPlace.debugRender[50] = autoPlace.ranges[2];
			} else if (configs.placeCalcVis && inGame && enemy.length) {
				// Collect world-space render data from radCalc geometry
				autoPlace.debugRender = {};
				// Free angle arcs centered on player (abstract overview)
				if (!autoPlace.rangesUpdated[2]) autoPlace.angleRanges(2);
				if (!autoPlace.rangesUpdated[4]) autoPlace.angleRanges(4);
				if (autoPlace.ranges[2]?.length) autoPlace.debugRender[50] = autoPlace.ranges[2];
				if (autoPlace.ranges[4]?.length) autoPlace.debugRender[70] = autoPlace.ranges[4];
			} else {
				autoPlace.debugRender = {};
			}
			if (macro.l) {
				if (targetPlayer) {
					//if (!configs.hatType || options.hatType != "ag") {
					packet("9", targetPlayer.aim2, 1);
					if (targetPlayer.dist2 > 225) {
						if (player.items[4] == 16) {
							place(4, targetPlayer.aim2);
						}
					} else {
						const j = (targetPlayer.dist2 <= 75 ? 82.5 : 78.7135) * (Math.PI / 180);
						for (let e = -1; e <= 1; e++) {
							checkPlace(2, (targetPlayer.dist2 <= 75 ? targetPlayer.aim2 : targetPlayer.aim2 + Math.PI) + e * j);
						}
						if (targetPlayer.dist2 <= 75) {
							checkPlace(2, targetPlayer.aim2 + Math.PI);
						}
					}
					//}
				}
			}

			sendMoveDir();
			if (mills.place) {
				let item = items.list[player.items[3]];
				if (
					UTILS.getDist(mills.old, player, 0, 2) >= item.scale * 2 + 6 &&
					!isNaN(wasdDir)
				) {
					let dir = wasdDir + Math.PI;
					if (macro.f && player.items[4] == 16) {
						place(3, dir + 1.4);
						place(3, dir - 1.4);
					} else {
						let tmpS =
							player.scale +
							item.scale +
							(items.list[player.items[3]].placeOffset || 0);
						let tmpX = player.x2 + tmpS * Math.cos(dir);
						let tmpY = player.y2 + tmpS * Math.sin(dir);
						let otherAngles = autoPlace.closestPossibleAngles(
							{
								x: tmpX,
								y: tmpY,
								getScale: function () {
									return item.scale;
								},
							},
							3,
						);
						place(3, dir);
						place(3, otherAngles[0]);
						place(3, otherAngles[1]);
					}
					mills.old = {
						x: player.x2,
						y: player.y2,
					};
					sendAtck(0, getAttackDir());
				}
			}
			/*
						if (mills.placeSpawnPads) {
								if (UTILS.getDist(mills.old, player, 0, 2) > mills.spawnDist) {
										autoPlace.testCanPlace(player.getItemType(20), 0, Math.PI * 1.5, Math.PI / 2, UTILS.getDirect(mills.old, player, 0, 2), true)
										mills.old = {
												x: player.x2,
												y: player.y2
										}
								}
						}*/
			if (mills.placeSpawnPads && !isNaN(wasdDir)) {
				let item = items.list[player.items[player.getItemType(20)]];
				let CanPlace = false;
				for (let angle = -Math.PI / 2; angle <= Math.PI / 2; angle += Math.PI) {
					let testAngle = wasdDir + angle;
					let tmpS = player.scale + item.scale + (item.placeOffset || 0);
					let tmpX = player.x2 + tmpS * Math.cos(testAngle);
					let tmpY = player.y2 + tmpS * Math.sin(testAngle);
					if (
						objectManager.checkItemLocation(
							tmpX,
							tmpY,
							item.scale,
							0.6,
							item.id,
							false,
						)
					) {
						CanPlace = true;
					}
				}
				if (CanPlace) {
					autoPlace.testCanPlace(
						player.getItemType(20),
						0,
						Math.PI * 2,
						Math.PI / 2,
						wasdDir,
					);
				}
			}
			if (
				instaC.can &&
				my.anti0Tick <= 0 &&
				!player.empAnti &&
				!my.forceStop &&
				secPacket < 69
			) {
				instaC.changeType(
					configs.revInsta || player.weapons[1] == 10 ? "rev" : "normal",
				);
			}
			if (instaC.canCounter && my.anti0Tick <= 0 && secPacket < 69) {
				instaC.canCounter = false;
				if (player.primaryReloaded && !instaC.isTrue) {
					instaC.counterType();
				}
			}
			if (
				configs.shameGrind &&
				near.inTrap &&
				player.weapons[1] == 10 &&
				player.secondaryVariant >= 1 &&
				player.secondaryReloaded &&
				!instaC.isTrue &&
				near.dist2 <= items.weapons[10].range + player.scale * 1.8
			) {
				instaC.shameGrindType();
			}
			if (
				instaC.canSpikeTick &&
				my.anti0Tick <= 0 &&
				!player.empAnti &&
				!my.forceStop &&
				secPacket < 69
			) {
				instaC.canSpikeTick = false;
				if (
					player.primaryReloaded &&
					!instaC.isTrue &&
					near.dist2 <=
					items.weapons[player.weapons[0]].range + player.scale * 1.8
				) {
					instaC.spikeTickType();
				}
			}
			if (instaC.canMusketSync) {
				instaC.canMusketSync = false;
				if (player.secondaryReloaded && !instaC.isTrue) {
					instaC.musketSync();
				}
			}
			autoBreak.calculateAim();
			if (player.empAnti || my.forceStop) {
				if (my.autoGathering) {
					sendAutoGather();
				}
			} else {
				if (
					!clicks.middle &&
					!clicks.left &&
					!clicks.right &&
					!instaC.isTrue &&
					!autoBreak.active &&
					my.autoGathering
				) {
					sendAutoGather();
				}
				if (!clicks.middle && (clicks.left || clicks.right) && !instaC.isTrue) {
					if (
						player.weaponIndex !=
						(clicks.right && autoBreak.useHammer()
							? player.weapons[1]
							: player.weapons[0]) ||
						player.buildIndex > -1
					) {
						selectWeapon(
							clicks.right && autoBreak.useHammer()
								? player.weapons[1]
								: player.weapons[0],
						);
					}
					if (
						player[
						(clicks.right && autoBreak.useHammer()
							? "secondary"
							: "primary") + "Reloaded"
						] &&
						!my.waitHit &&
						!my.autoGathering
					) {
						sendAutoGather();
						my.waitHit = 1;
						game.tickBase(() => {
							my.waitHit = 0;
						}, 1);
					}
				}
				if (autoBreak.active) {
					if (!clicks.left && !clicks.right && !instaC.isTrue && !(configs.shameGrind && near.inTrap && player.weapons[1] == 10 && !player.inTrap && autoBreak.target?.sid === near.inTrap?.sid)) {
						let weapon = autoBreak.useHammer(autoBreak.target)
							? player.weapons[1]
							: player.weapons[0];
						if (player.weaponIndex != weapon || player.buildIndex > -1) {
							selectWeapon(weapon);
						}
						if (
							player[(weapon < 9 ? "primary" : "secondary") + "Reloaded"] &&
							!my.waitHit &&
							!my.autoGathering
						) {
							sendAutoGather();
							my.waitHit = 1;
							game.tickBase(() => {
								my.waitHit = 0;
							}, 1);
						}
					}
				}
			}
			if (clicks.middle && !player.inTrap) {
				if (!instaC.isTrue && player.secondaryReloaded) {
					if (
						my.ageInsta &&
						player.weapons[0] != 4 &&
						player.weapons[1] == 9 &&
						player.age >= 9 &&
						enemy.length
					) {
						if (!targetPlayer?.visible) {
							targetPlayer = enemy.sort(
								(a, b) =>
									UTILS.getDist(a, mousePos, 2, 0) -
									UTILS.getDist(b, mousePos, 2, 0),
							)[0];
						}
						instaC.bowMovement();
					} else {
						targetPlayer = enemy.sort(
							(a, b) =>
								UTILS.getDist(a, mousePos, 2, 0) -
								UTILS.getDist(b, mousePos, 2, 0),
						)[0];
						instaC.rangeType();
					}
				}
			}
			if (macro.t && !player.inTrap) {
				if (
					!instaC.isTrue &&
					player.primaryReloaded &&
					(player.weapons[1] != 15 || player.secondaryReloaded) &&
					(player.weapons[0] == 5 ||
						(player.weapons[0] == 4 && player.weapons[1] == 15))
				) {
					instaC["newTickMovement"]();
				}
			}
			if (!macro.t && !instaC.isTrue && instaC.ticking) {
				instaC.ticking = false;
			}
			if (macro["."] && !player.inTrap) {
				if (
					!instaC.isTrue &&
					player.primaryReloaded &&
					(![9, 12, 13, 15].includes(player.weapons[1]) ||
						player.secondaryReloaded)
				) {
					instaC["boostTickMovement"]();
				}
			}
			if (
				player.weapons[1] &&
				!clicks.left &&
				!clicks.right &&
				!player.inTrap &&
				!instaC.isTrue &&
				!autoBreak.active
			) {
				if (player.primaryReloaded && player.secondaryReloaded) {
					if (!my.reloaded) {
						my.reloaded = true;
						let fastSpeed =
							items.weapons[player.weapons[0]].spdMult <
								items.weapons[player.weapons[1]].spdMult
								? 1
								: 0;
						if (
							player.weaponIndex != player.weapons[fastSpeed] ||
							player.buildIndex > -1
						) {
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
			if (
				storeMenu.style.display != "block" &&
				!instaC.isTrue &&
				!instaC.ticking
			) {
				hatChanger();
				accChanger();
			}
			if (configs.autoPrePlace) {
				autoPlace.preplaceRanges = {};
				autoPlace.preplacer();
			}
			if (configs.autoReplace && enemy.length && near.dist2 <= 300) {
				for (let i = 0; i < nearObjs.length; i++) {
					const obj = nearObjs[i];
					if (!obj.active || !obj.isTeamObject(player)) continue;
					const htb = objectManager.hitsToBreak(obj, near);
					if (htb <= 2) {
						autoPlace.replaced = false;
						autoPlace.autoReplace(obj, htb === 1);
						break;
					}
				}
			}
			if (playersJoining.length && game.tick % 10 == 0 && configs.autoAccept) {
				packet("P", playersJoining[0], 1);
				UTILS.removeAllChildren(notificationDisplay);
			}
			instaC.syncHit = false;
			autoBreak.priority = [[], [], [], []];
			my.anti0Tick--;
			if (configs.weaponGrind) {
				autoPlace.testCanPlace(
					player.getItemType(22),
					0,
					Math.PI * 2,
					Math.PI / 2,
					0,
					false,
					true,
					3,
				);
			}
			autoPlace.replaced = false;
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
		y: null,
	};
	let pos2 = {
		x: null,
		y: null,
	};
	textManager.stack.forEach((text) => {
		if (text.value >= 0) {
			if (num == 0)
				pos = {
					x: text.x,
					y: text.y,
				};
			num += Math.abs(text.value);
		} else {
			if (num2 == 0)
				pos2 = {
					x: text.x,
					y: text.y,
				};
			num2 += Math.abs(text.value);
		}
	});
	if (num2 > 0) {
		textManager.showText(
			pos2.x,
			pos2.y,
			Math.max(45, Math.min(50, num2)),
			0.18,
			500,
			num2,
			"#8ecc51",
		);
	}
	if (num > 0) {
		textManager.showText(
			pos.x,
			pos.y,
			Math.max(45, Math.min(50, num)),
			0.18,
			500,
			num,
			"#fff",
		);
	}
	textManager.stack = [];
}

// UPDATE LEADERBOARD:
let leaderboardElement = document.getElementById("leaderboard");
let textNode = leaderboardElement.firstChild;
if (textNode.nodeType === 3 && textNode.textContent === "Leaderboard") {
	leaderboardElement.removeChild(textNode);
}
function updateLeaderboard(data) {
	lastLeaderboardData = data;
	UTILS.removeAllChildren(leaderboardData);
	let tmpC = 1;
	let maxScore = data[2];

	for (let i = 0; i < data.length; i += 3) {
		(function (i) {
			let score = data[i + 2];
			let percentage = (score / maxScore) * 100;

			let leaderHolder = document.createElement("div");
			leaderHolder.className = "leaderHolder";
			leaderHolder.style = `
                background-color: rgba(0, 0, 0, 0.45);
                height: 20px;
                border-radius: 5px;
                margin-bottom: 5px;
            `;
			leaderboardData.appendChild(leaderHolder);
			let sid = data[i];

			let leaderboardItem = document.createElement("div");
			leaderboardItem.className = "leaderboardItem";
			leaderboardItem.style = `
                color: ${sid == player?.sid ? "#fffb95" : syncersInServer.includes(sid) ? "#FF0000" : playersInServer.includes(sid) ? "#00ff00" : "#fff"};
            `;
			leaderboardItem.textContent = `${data[i + 1]}: ${UTILS.sFormat(score) || "0"}`;
			leaderHolder.appendChild(leaderboardItem);

			let leaderProsBar = document.createElement("div");
			leaderProsBar.id = `leaderProsBar-${data[i]}`;
			leaderProsBar.className = "leaderProgressBar";
			leaderProsBar.style = `
                margin-bottom: 5px;
                display: block;
                height: 20px;
                border-radius: 5px;
                background-color: #94e484;
                width: ${percentage}% ;
                transition: width 0.5s ease-in-out;
            `;
			leaderHolder.appendChild(leaderProsBar);
			if (leaderProsBar.style.width) {
				let currentWidth = parseFloat(leaderProsBar.style.width);
				let newWidth = `${percentage}%`;
				leaderProsBar.style.width = newWidth;
			} else {
				leaderProsBar.style.width = `${percentage}%`;
			}
		})(i);
		tmpC++;
	}
}

// LOAD GAME OBJECT:
function loadGameObject(data) {
	for (let i = 0; i < data.length;) {
		objectManager.add(
			data[i],
			data[i + 1],
			data[i + 2],
			data[i + 3],
			data[i + 4],
			data[i + 5],
			items.list[data[i + 6]],
			true,
			data[i + 7] >= 0
				? {
					sid: data[i + 7],
				}
				: null,
		);
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
												autoPlace.protect(aim);
										}
								}
						}*/
		i += 8;
	}
}

// ADD AI:
let lastDist = null;
let lastAgentDir = null;
function normCoord(val) {
	return val / 14400 - 1; // transforms 0..14400 -> -1..1
}
let skinCounter = {
	11: 0.45,
};
let tailCounter = {
	16: 0.15,
	21: 0.25,
};

let lastTick = 0;

function getCounter(skinIndex, tailIndex) {
	const skin = skinCounter[skinIndex];
	const tail = tailCounter[tailIndex];

	if (skin != null && tail != null) return skin + tail;
	if (skin != null) return skin + 0.25;
	if (tail != null) return tail + 0.45;
	return 0.45;
}

function loadAI(data) {
	if (!player) return;
	if (!my.healed && player.health < player.maxHealth) {
		if (player.empAnti && sent.hat != 22) {
			player.addDamageThreat("turret", 25);
		}
		if (my.autoGathering) {
			nears.forEach((e) => {
				if (UTILS.getAngleDist(getAttackDir(), e.aim2) <= config.gatherAngle && e.dist2 <= items.weapons[player.weaponIndex].range + player.scale * 1.8) {
					player.addDamageThreat("counter", items.weapons[sent.weapon || player.weaponIndex].dmg * (sent.hat == 7 ? 1.5 : 1) * (sent.tail == 11 ? 0.2 : 1) * getCounter(e.skinIndex, e.tailIndex));
				}
			})
			/*if (damageThreat >= player.maxHealth && player.damageSources.counter) {
				sendAutoGather();
				player.removeDamageThreat("counter");
			}*/
		}
		let damageThreat = (sent.hat == 6 ? player.damageSources.totalSoldier : player.damageSources.totalNoSoldier);
		if (player.health <= damageThreat && player.shameCount <= 5) {
			healer();
			my.healed = true;
		}
	}
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
				tmpObj = aiManager.spawn(
					data[i + 2],
					data[i + 3],
					data[i + 4],
					data[i + 1],
				);
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
			tmpObj.update();
			i += 7;
		}
	}
	// animal damage threat
	if (!my.healed && player.health < player.maxHealth) {
		ais.forEach((ai) => {
			if (!ai.visible || !ai.hostile || !ai.dmg) return;
			const dist = UTILS.getDist(ai, player, 0, 2);
			if (dist <= (ai.hitRange || ai.scale + 5) + player.scale) {
				player.addDamageThreat("AI", ai.dmg);
			}
		});
		let damageThreat = (sent.hat == 6 ? player.damageSources.totalSoldier : player.damageSources.totalNoSoldier);
		if (player.health <= damageThreat && player.shameCount <= 5) {
			healer();
			my.healed = true;
		}
	}
	if (!macro.q && !macro.f && !macro.v && !macro.h && !macro.n) {
		packet("D", getAttackDir());
	}
	player.empAnti = false;
	player.soldierAnti = false;
	autoPlace.rangesUpdated = {};
	sent = { hat: null, tail: null, weapon: null };
	my.forceStop = false;
	my.healed = false;
}

// ANIMATE AI:
function animateAI(sid) {
	tmpObj = findAIBySID(sid);
	if (tmpObj) {
		tmpObj.startAnim();
		let tmpObjects = objectManager.hitObj;
		if (tmpObjects.length) {
			objectManager.hitObj = [];
			let dmg = tmpObj.dmg * 5;
			game.tickBase(() => {
				tmpObjects.forEach((healthy) => {
					healthy.health -= dmg;
				});
			}, 1);
		}
	}
}

// GATHER ANIMATION:
function gatherAnimation(sid, didHit, index) {
	let tmpObj = findPlayerBySID(sid);
	if (tmpObj) {
		tmpObj.startAnim(didHit, index);
		tmpObj.gatherIndex = index;
		tmpObj.gathering = 1;
		tmpObj.noMovTimer = 0;
		if (didHit) {
			let tmpObjects = objectManager.hitObj;
			objectManager.hitObj = [];
			let weaponXP = (items.weapons[index].gather || 1) + 4;
			game.tickBase(() => {
				let val =
					items.weapons[index].dmg *
					config.weaponVariants[
						tmpObj[(index < 9 ? "prima" : "seconda") + "ryVariant"]
					].val *
					(items.weapons[index].sDmg || 1) *
					(tmpObj.skinIndex == 40 ? 3.3 : 1);
				tmpObjects.forEach((healthy) => {
					if (healthy.health) {
						healthy.health -= val;
					} else if (healthy.type == 3 && tmpObj.sid == player.sid) {
						player.weaponXP[index] = (player.weaponXP[index] || 0) + weaponXP;
						updateWeaponXPBars();
					}
				});
			}, 1);
		}
	}
}

// WIGGLE GAME OBJECT:
function wiggleGameObject(dir, sid) {
	const o = findObjectBySid(sid);
	if (!o) return;

	const a = config.gatherWiggle;
	const ix = a * Math.cos(dir);
	const iy = a * Math.sin(dir);

	const shouldSpin = o.pps || o.id === 9;

	if (!o._wig)
		o._wig = {
			vx: 0,
			vy: 0,
			spin: 0,
			spinSpeed: 0,
			maxSpeed: 0.2,
			hitCount: 0,
		};

	if (!shouldSpin && o._wig.spinSpeed > 0) {
		o._wig.spin = 0;
		o._wig.spinSpeed = 0;
		o._wig.hitCount = 0;
	}

	o._wig.vx += ix * 0.75;
	o._wig.vy += iy * 0.75;

	if (shouldSpin) {
		o._wig.spinSpeed = Math.min(
			(o._wig.spinSpeed || 0) + 0.03,
			o._wig.maxSpeed,
		);
		o._wig.lastHitTime = Date.now();
		o._wig.hitCount = (o._wig.hitCount || 0) + 1;
	}

	objectManager.hitObj.push(o);
}
function updateWiggles(dt = 1) {
	const k = 0.12,
		damp = 0.85;

	for (const o of gameObjects || []) {
		const w = o?._wig;
		if (!w) continue;

		w.vx *= damp;
		w.vy *= damp;

		const shouldSpin = o.pps || o.id === 9;

		if (w.spinSpeed !== undefined && shouldSpin) {
			const timeSinceHit = Date.now() - (w.lastHitTime || 0);
			const decelDelay = 300 + (w.hitCount || 0) * 150;

			if (timeSinceHit > decelDelay) {
				const decel = w.spinSpeed < 0.05 ? 0.98 : 0.995;
				w.spinSpeed *= decel;
				if (w.spinSpeed < 0.005) {
					w.spinSpeed = 0;
					w.hitCount = 0;
				}
			}

			w.spin = (w.spin || 0) + w.spinSpeed * dt;
			o.angle = (o.angle || 0) + w.spinSpeed * dt;
		} else if (w.spinSpeed > 0) {
			w.spin = 0;
			w.spinSpeed = 0;
			w.hitCount = 0;
			o.angle = 0;
		}

		if (w) {
			w.vx *= 0.85;
			w.vy *= 0.85;
			o.xWiggle = (o.xWiggle || 0) + w.vx * dt;
			o.yWiggle = (o.yWiggle || 0) + w.vy * dt;
			if (Math.abs(o.xWiggle) < 0.01) o.xWiggle = 0;
			if (Math.abs(o.yWiggle) < 0.01) o.yWiggle = 0;
		}
		if (shouldSpin) {
			if (o.xWiggle) o.xWiggle *= Math.pow(0.99, dt * 0.1);
			if (o.yWiggle) o.yWiggle *= Math.pow(0.99, dt * 0.1);
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
		tmpObj.reloads = tmpObj.shootRate;
	}
}

// UPDATE PLAYER VALUE:
function updatePlayerValue(index, value, updateView) {
	if (player) {
		let diff = value - player[index];
		player[index] = value;
		if (index == "points") {
			if (configs.autoBuy) {
				autoBuy.buyNext();
			}
		} else if (index == "kills") {
			if (configs.killChat) {
				if (!configs.autoPlay) {
					sendChat("Robotis Winn");
				} else {
					sendChat("Robot kill u");
				}
			}
		} else {
			if (diff > 0) {
				game.tickBase(() => {
					player.weaponXP[player.weaponIndex] =
						(player.weaponXP[player.weaponIndex] || 0) + diff;
					updateWeaponXPBars();
				}, 1);
			}
			player[index] = value;
		}
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
				selectWeapon(
					player.weaponIndex < 9 ||
						[9, 12, 13, 15].includes(player.secondaryIndex)
						? player.primaryIndex
						: player.secondaryIndex,
				);
			}
		} else {
			player.items = data;
		}
	}
	for (let i = 0; i < items.list.length; i++) {
		let tmpI = items.weapons.length + i;
		getEl("actionBarItem" + tmpI).style.display =
			player.items.indexOf(items.list[i].id) >= 0 ? "inline-block" : "none";
	}
	for (let i = 0; i < items.weapons.length; i++) {
		getEl("actionBarItem" + i).style.display =
			player.weapons[items.weapons[i].type] == items.weapons[i].id
				? "inline-block"
				: "none";
	}
}

// ADD PROJECTILE:
function addProjectile(x, y, dir, range, speed, indx, layer, sid) {
	projectileManager.addProjectile(x, y, dir, range, speed, indx, layer).sid =
		sid;
	projectileTick.push(Array.prototype.slice.call(arguments));
	try { detectProjectile.onProjSpawn(x, y, dir, range, speed, indx, sid); } catch (e) { }
}

// REMOVE PROJECTILE:
function remProjectile(sid, range) {
	for (let i = 0; i < projectiles.length; ++i) {
		if (projectiles[i].sid == sid) {
			projectiles[i].range = range;
			projectiles[i].r2 = range;
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
	shutdownDisplay.innerHTML = `Server restarting in ${time}s`;
}
// a new party is created
function addAlliance(data) {
	//console.log("addAlliance", data);
	// data = {sid: "nameOfParty", owner: sidOfOwner}
	// note nameOfParty will be 7 letters long, with blank bytes at the end if name is less than 7 letters
	alliances.push(data);
}

// a party is deleted
function deleteAlliance(sid) {
	//console.log("deleteAlliance", sid);
	alliances = alliances.filter((e) => e.sid != sid);
}

let playersJoining = [];
let lastAcceptTime = 0;
// SHOW ALLIANCE MENU:
function allianceNotification(sid, name) {
	playersJoining.push(sid);
}

function setPlayerTeam(team, isOwner) {
	//console.log("setPlayerTeam", team, isOwner);
	if (player) {
		player.team = team;
		player.isOwner = isOwner;
		if (team == null || team == undefined) {
			alliancePlayers.length = 0;
		}
	}
}

function setAlliancePlayers(data) {
	// data = [sid1, name1, sid2, name2, ...]
	//console.log("setAlliancePlayers", data);
	alliancePlayers.length = 0;
	for (let i = 0; i < data.length; i += 2) {
		alliancePlayers.push(data[i]);
	}
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
			player.skins[id] = 1;
		} else {
			player.latestSkin = id;
		}
	}
}

// SEND MESSAGE:
function receiveChat(sid, message) {
	let tmpPlayer = findPlayerBySID(sid);
	if (tmpPlayer) {
		ChText(
			`${tmpPlayer.name} {${tmpPlayer.sid}}`,
			message,
			tmpPlayer == player || (tmpPlayer.team && tmpPlayer.team == player.team)
				? "#8ecc51"
				: "#fff",
		);
		tmpPlayer.chatMessage = message;
		tmpPlayer.chatCountdown = config.chatCountdown;
		/*if (tmpPlayer.team == player.team && message == getEl("testInput2").value) {
						instaC.canMusketSync = true;
				}*/
	}
}

// MINIMAP:
function updateMinimap(data) {
	minimapData = data;
}

// SHOW ANIM TEXT:
function showText(x, y, value, type) {
	textManager.showText(
		x,
		y,
		50,
		0.18,
		500,
		Math.abs(value),
		value >= 0 ? "#fff" : "#8ecc51",
	);
}
function showSettingText(life, setting) {
	textManager.showText(
		player.x,
		player.y,
		player.scale,
		0.1,
		life,
		setting,
		"#fff",
	);
}

// RENDER LEAF:
function renderLeaf(x, y, l, r, ctxt) {
	let endX = x + l * Math.cos(r);
	let endY = y + l * Math.sin(r);
	let width = l * 0.4;
	ctxt.moveTo(x, y);
	ctxt.beginPath();
	ctxt.quadraticCurveTo(
		(x + endX) / 2 + width * Math.cos(r + Math.PI / 2),
		(y + endY) / 2 + width * Math.sin(r + Math.PI / 2),
		endX,
		endY,
	);
	ctxt.quadraticCurveTo(
		(x + endX) / 2 - width * Math.cos(r + Math.PI / 2),
		(y + endY) / 2 - width * Math.sin(r + Math.PI / 2),
		x,
		y,
	);
	ctxt.closePath();
	ctxt.fill();
	ctxt.stroke();
}

if (configs.autoPlay || my.autoPush) {
	mainContext.globalAlpha = 1;
	for (let i = 0; i < PF.paths.length; i++) {
		let path = PF.paths[i]; let posX = path.x - xOffset;
		let posY = path.y - yOffset;

		mainContext.beginPath();
		mainContext.fillStyle = `rgb(${(i + 1) / PF.paths.length * 85}, ${(i + 1) / PF.paths.length * 127.5}, ${(i + 1) / PF.paths.length * 225})`;
		mainContext.arc(posX, posY, 10, 0, Math.PI * 2);
		mainContext.fill();
	}
}

function renderPathFinder(ctx, offset) {
	try {
		if (PF.active) {
			ctx.lineWidth = 6;
			ctx.globalAlpha = 1;
			ctx.beginPath();
			ctx.strokeStyle = "#00ffff";
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
				ctx.moveTo(
					PF.paths[PF.paths.length - 1].x - offset.x,
					PF.paths[PF.paths.length - 1].y - offset.y,
				);
				ctx.lineTo(my.pushData.x - offset.x, my.pushData.y - offset.y);
				ctx.stroke();
			}
		} else if (my.autoPush) {
			ctx.lineWidth = 6;
			ctx.globalAlpha = 1;
			ctx.beginPath();
			ctx.strokeStyle = "#fff";
			ctx.moveTo(player.x - offset.x, player.y - offset.y);
			ctx.lineTo(my.pushData.x2 - offset.x, my.pushData.y2 - offset.y);
			ctx.lineTo(my.pushData.x - offset.x, my.pushData.y - offset.y);
			ctx.stroke();
		} else if (PF.finded) {
			ctx.globalAlpha = 1;
			ctx.lineWidth = 6;
			ctx.beginPath();
			ctx.strokeStyle = "#00ffff";
			ctx.moveTo(player.x - offset.x, player.y - offset.y);
			for (let i = 0; i < PF.paths.length; i++) {
				let path = PF.paths[i];
				if (path) {
					ctx.lineTo(path.x - offset.x, path.y - offset.y);
				}
			}
			ctx.stroke();
		}
	} catch (e) {
		console.error(e);
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
	let rot = (Math.PI / 2) * 3;
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
	let rot = (Math.PI / 2) * 3;
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
	if (!dontFill) ctxt.fillRect(x - w / 2, y - h / 2, w, h);
	if (!dontStroke) ctxt.strokeRect(x - w / 2, y - h / 2, w, h);
}

function renderHealthRect(x, y, w, h, ctxt, dontStroke, dontFill) {
	if (!dontFill) ctxt.fillRect(x - w / 2, y - h / 2, w, h);
	if (!dontStroke) ctxt.strokeRect(x - w / 2, y - h / 2, w, h);
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
	let rot = (Math.PI / 2) * 3;
	let x, y;
	let step = Math.PI / spikes;
	let tmpOuter;
	ctxt.beginPath();
	ctxt.moveTo(0, -inner);
	for (let i = 0; i < spikes; i++) {
		tmpOuter = UTILS.randInt(outer + 0.9, outer * 1.2);
		ctxt.quadraticCurveTo(
			Math.cos(rot + step) * tmpOuter,
			Math.sin(rot + step) * tmpOuter,
			Math.cos(rot + step * 2) * inner,
			Math.sin(rot + step * 2) * inner,
		);
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
	/*let tmpMid = config.mapScale / 2;
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
		objectManager.add(12, tmpMid - 400, tmpMid - 450, 0, config.rockScales[2], 2);*/
}
const speed = 35;

// RENDER PLAYERS:
function renderDeadPlayers(xOffset, yOffset) {
	mainContext.fillStyle = "#91b2db";
	deadPlayers
		.filter((dead) => dead.active)
		.forEach((dead) => {
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

			mainContext.font = "bold 15px Ubuntu";
			mainContext.textBaseline = "middle";
			mainContext.textAlign = "center";
			const tx = dead.x - xOffset;
			const ty1 = dead.y + dead.scale * 1.5 - yOffset;
			const ty2 = ty1 + 18;

			mainContext.shadowColor = "rgba(0,0,0,0.7)";
			mainContext.shadowBlur = 4;
			mainContext.fillStyle = "#ff6b6b";
			mainContext.fillText("got clapped", tx, ty1);
			mainContext.fillStyle = "#fff";
			mainContext.fillText(dead.name, tx, ty2);
			mainContext.shadowBlur = 0;
		});
}

function normalizeAngle(angle) {
	while (angle > Math.PI) angle -= Math.PI * 2;
	while (angle < -Math.PI) angle += Math.PI * 2;
	return angle;
}

// RENDER PLAYERS:
function renderPlayers(xOffset, yOffset, zIndex) {
	mainContext.globalAlpha = 1;
	mainContext.fillStyle = "#91b2db";
	for (let i = 0; i < players.length; ++i) {
		tmpObj = players[i];
		if (tmpObj.zIndex == zIndex) {
			tmpObj.animate(delta);
			if (tmpObj.visible) {
				tmpObj.skinRot += 0.002 * delta;
				var targetDir;
				if (tmpObj == player && configs.renderDir) {
					var rd = options.renderDir;
					if (rd == "noDir") targetDir = getSafeDir();
					else if (rd == "attackDir") targetDir = getVisualDir();
					else if (rd == "alwaysDir") targetDir = getVisualDir();
					else targetDir = tmpObj.dir || 0;
				} else {
					targetDir = tmpObj.dir || 0;
				}

				if (tmpObj.smoothDir === undefined) {
					tmpObj.smoothDir = targetDir;
					tmpObj.smoothDirVelocity = 0;
				}

				var smoothingFactor = tmpObj == player && configs.autoSpin ? 1 : 0.1;
				var angleDifference = normalizeAngle(targetDir - tmpObj.smoothDir);

				tmpObj.smoothDir += angleDifference * smoothingFactor;

				tmpObj.smoothDir = normalizeAngle(tmpObj.smoothDir);

				tmpDir = tmpObj.smoothDir;
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
	let handAngle = (Math.PI / 4) * (items.weapons[obj.weaponIndex].armS || 1);
	let oHandAngle =
		obj.buildIndex < 0 ? items.weapons[obj.weaponIndex].hndS || 1 : 1;
	let oHandDist =
		obj.buildIndex < 0 ? items.weapons[obj.weaponIndex].hndD || 1 : 1;

	// WEAPON BELLOW HANDS:
	if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
		renderTool(
			items.weapons[obj.weaponIndex],
			config.weaponVariants[obj.weaponVariant].src,
			obj.scale,
			0,
			ctxt,
		);
		if (
			items.weapons[obj.weaponIndex].projectile != undefined &&
			!items.weapons[obj.weaponIndex].hideProjectile
		) {
			renderProjectile(
				obj.scale,
				0,
				items.projectiles[items.weapons[obj.weaponIndex].projectile],
				mainContext,
			);
		}
	}

	// HANDS:
	ctxt.fillStyle = config.skinColors[obj.skinColor];
	renderCircle(
		obj.scale * Math.cos(handAngle),
		obj.scale * Math.sin(handAngle),
		14,
	);
	renderCircle(
		obj.scale * oHandDist * Math.cos(-handAngle * oHandAngle),
		obj.scale * oHandDist * Math.sin(-handAngle * oHandAngle),
		14,
	);

	// WEAPON ABOVE HANDS:
	if (obj.buildIndex < 0 && items.weapons[obj.weaponIndex].aboveHand) {
		renderTool(
			items.weapons[obj.weaponIndex],
			config.weaponVariants[obj.weaponVariant].src,
			obj.scale,
			0,
			ctxt,
		);
		if (
			items.weapons[obj.weaponIndex].projectile != undefined &&
			!items.weapons[obj.weaponIndex].hideProjectile
		) {
			renderProjectile(
				obj.scale,
				0,
				items.projectiles[items.weapons[obj.weaponIndex].projectile],
				mainContext,
			);
		}
	}

	// BUILD ITEM:
	if (obj.buildIndex >= 0) {
		let tmpSprite = getItemSprite(items.list[obj.buildIndex]);
		ctxt.drawImage(
			tmpSprite,
			obj.scale - items.list[obj.buildIndex].holdOffset,
			-tmpSprite.width / 2,
		);
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
	ctxt.fillText("X", -15, 15 / 2);
	ctxt.fillText("D", 15, 15 / 2);
}

// RENDER PLAYER:
function renderPlayer(obj, ctxt) {
	ctxt = ctxt || mainContext;
	ctxt.lineWidth = outlineWidth;
	ctxt.lineJoin = "miter";
	let handAngle = (Math.PI / 4) * (items.weapons[obj.weaponIndex].armS || 1);
	let oHandAngle =
		obj.buildIndex < 0 ? items.weapons[obj.weaponIndex].hndS || 1 : 1;
	let oHandDist =
		obj.buildIndex < 0 ? items.weapons[obj.weaponIndex].hndD || 1 : 1;

	let katanaMusket =
		obj == players && obj.weapons[0] == 3 && obj.weapons[1] == 15;

	// TAIL/CAPE:
	if (obj.tailIndex > 0) {
		renderTail(obj.tailIndex, ctxt, obj);
	}

	// WEAPON BELLOW HANDS:
	if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
		renderTool(
			items.weapons[katanaMusket ? 4 : obj.weaponIndex],
			config.weaponVariants[obj.weaponVariant].src,
			obj.scale,
			0,
			ctxt,
		);
		if (
			items.weapons[obj.weaponIndex].projectile != undefined &&
			!items.weapons[obj.weaponIndex].hideProjectile
		) {
			renderProjectile(
				obj.scale,
				0,
				items.projectiles[items.weapons[obj.weaponIndex].projectile],
				mainContext,
			);
		}
	}

	// HANDS:
	ctxt.fillStyle = config.skinColors[obj.skinColor];
	renderCircle(
		obj.scale * Math.cos(handAngle),
		obj.scale * Math.sin(handAngle),
		14,
	);
	renderCircle(
		obj.scale * oHandDist * Math.cos(-handAngle * oHandAngle),
		obj.scale * oHandDist * Math.sin(-handAngle * oHandAngle),
		14,
	);

	// WEAPON ABOVE HANDS:
	if (obj.buildIndex < 0 && items.weapons[obj.weaponIndex].aboveHand) {
		renderTool(
			items.weapons[obj.weaponIndex],
			config.weaponVariants[obj.weaponVariant].src,
			obj.scale,
			0,
			ctxt,
		);
		if (
			items.weapons[obj.weaponIndex].projectile != undefined &&
			!items.weapons[obj.weaponIndex].hideProjectile
		) {
			renderProjectile(
				obj.scale,
				0,
				items.projectiles[items.weapons[obj.weaponIndex].projectile],
				mainContext,
			);
		}
	}

	// BUILD ITEM:
	if (obj.buildIndex >= 0) {
		let tmpSprite = getItemSprite(items.list[obj.buildIndex]);
		ctxt.drawImage(
			tmpSprite,
			obj.scale - items.list[obj.buildIndex].holdOffset,
			-tmpSprite.width / 2,
		);
	}

	// BODY:
	renderCircle(0, 0, obj.scale, ctxt);

	// SKIN:
	if (obj.skinIndex > 0) {
		ctxt.rotate(Math.PI / 2);
		renderSkin(obj.skinIndex, ctxt, null, obj);
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
		ctxt.drawImage(
			tmpSkin,
			-tmpObj.scale / 2,
			-tmpObj.scale / 2,
			tmpObj.scale,
			tmpObj.scale,
		);
	if (!parentSkin && tmpObj.topSprite) {
		ctxt.save();
		ctxt.rotate(owner.skinRot);
		renderSkin(index + "_top", ctxt, tmpObj, owner);
		ctxt.restore();
	}
}

// RENDER TAIL:
let accessSprites = {};
let accessPointers = {};
function renderTail(index, ctxt, owner) {
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
		if (tmpObj.spin) ctxt.rotate(owner.skinRot);
		ctxt.drawImage(
			tmpSkin,
			-(tmpObj.scale / 2),
			-(tmpObj.scale / 2),
			tmpObj.scale,
			tmpObj.scale,
		);
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
		tmpSprite.src = "https://moomoo.io/img/weapons/" + tmpSrc + ".png";
		toolSprites[tmpSrc] = tmpSprite;
	}
	if (tmpSprite.isLoaded)
		ctxt.drawImage(
			tmpSprite,
			x + obj.xOff - obj.length / 2,
			y + obj.yOff - obj.width / 2,
			obj.length,
			obj.width,
		);
}

// RENDER PROJECTILES:
function renderProjectiles(layer, xOffset, yOffset) {
	for (let i = 0; i < projectiles.length; i++) {
		tmpObj = projectiles[i];
		if (tmpObj.active && tmpObj.layer == layer) {
			tmpObj.update(delta);
			if (
				tmpObj.active &&
				isOnScreen(tmpObj.x - xOffset, tmpObj.y - yOffset, tmpObj.scale)
			) {
				mainContext.save();
				mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
				mainContext.rotate(tmpObj.dir);
				renderProjectile(0, 0, tmpObj, mainContext, 1);
				mainContext.restore();
			}
		}
	}
}

// RENDER PROJECTILE:
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
		if (tmpSprite.isLoaded)
			ctxt.drawImage(
				tmpSprite,
				x - obj.scale / 2,
				y - obj.scale / 2,
				obj.scale,
				obj.scale,
			);
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
	let tmpY = config.mapScale / 2 - yOffset - tmpW / 2;
	if (tmpY < maxScreenHeight && tmpY + tmpW > 0) {
		ctxt.fillRect(0, tmpY, maxScreenWidth, tmpW);
	}
}

// RENDER GAME OBJECTS:
let gameObjectSprites = {};
function getResSprite(obj) {
	let biomeID =
		obj.y >= config.mapScale - config.snowBiomeTop
			? 2
			: obj.y <= config.snowBiomeTop
				? 1
				: 0;
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
		if (isNight) {
			tmpContext.shadowBlur = blurScale;
			tmpContext.shadowColor = `rgba(0, 0, 0, 0.7)`;
		}
		if (obj.type == 0) {
			let tmpScale;
			let tmpCount = UTILS.randInt(5, 7);
			tmpContext.globalAlpha = isNight ? 0.6 : 0.8;
			for (let i = 0; i < 2; ++i) {
				tmpScale = tmpObj.scale * (!i ? 1 : 0.5);
				renderStar(tmpContext, tmpCount, tmpScale, tmpScale * 0.7);
				tmpContext.fillStyle = !biomeID
					? !i
						? "#9ebf57"
						: "#b4db62"
					: !i
						? "#e3f1f4"
						: "#fff";
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
					renderCircle(
						tmpRange * Math.cos(rotVal * i),
						tmpRange * Math.sin(rotVal * i),
						UTILS.randInt(10, 12),
						tmpContext,
					);
				}
			}
		} else if (obj.type == 2 || obj.type == 3) {
			tmpContext.fillStyle =
				obj.type == 2 ? (biomeID == 2 ? "#938d77" : "#939393") : "#e0c655";
			renderStar(tmpContext, 3, obj.scale, obj.scale);
			tmpContext.fill();
			tmpContext.stroke();

			tmpContext.shadowBlur = null;
			tmpContext.shadowColor = null;

			tmpContext.fillStyle =
				obj.type == 2 ? (biomeID == 2 ? "#b2ab90" : "#bcbcbc") : "#ebdca3";
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
		let blurScale = !asIcon && isNight ? 15 : 0;
		let tmpCanvas = document.createElement("canvas");
		let reScale = obj.scale;
		tmpCanvas.width = tmpCanvas.height =
			reScale * 2.5 +
			outlineWidth +
			(items.list[obj.id].spritePadding || 0) +
			blurScale;
		if (config.useWebGl) {
			let gl = tmpCanvas.getContext("webgl");
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);

			let buffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

			function render(vs, fs, vertice, type) {
				let vShader = gl.createShader(gl.VERTEX_SHADER);
				gl.shaderSource(vShader, vs);
				gl.compileShader(vShader);
				gl.getShaderParameter(vShader, gl.COMPILE_STATUS);

				let fShader = gl.createShader(gl.FRAGMENT_SHADER);
				gl.shaderSource(fShader, fs);
				gl.compileShader(fShader);
				gl.getShaderParameter(fShader, gl.COMPILE_STATUS);

				let program = gl.createProgram();
				gl.attachShader(program, vShader);
				gl.attachShader(program, fShader);
				gl.linkProgram(program);
				gl.getProgramParameter(program, gl.LINK_STATUS);
				gl.useProgram(program);

				let vertex = gl.getAttribLocation(program, "vertex");
				gl.enableVertexAttribArray(vertex);
				gl.vertexAttribPointer(vertex, 2, gl.FLOAT, false, 0, 0);

				let vertices = vertice.length / 2;
				gl.bufferData(
					gl.ARRAY_BUFFER,
					new Float32Array(vertice),
					gl.DYNAMIC_DRAW,
				);
				gl.drawArrays(type, 0, vertices);
			}

			let max = 100;
			for (let i = 0; i < max; i++) {
				let radian = Math.PI * (i / (max / 2));
				render(
					`
                            precision mediump float;
                            attribute vec2 vertex;
                            void main(void) {
                                gl_Position = vec4(vertex, 0, 1);
                            }
                            `,
					`
                            precision mediump float;
                            void main(void) {
                                gl_FragColor = vec4(${UTILS.getRgb(...UTILS.hexToRgb("#fff"))}, 1);
                            }
                            `,
					[0 + Math.cos(radian) * 0.5, 0 + Math.sin(radian) * 0.5, 0, 0],
					gl.LINE_LOOP,
				);
			}
		} else {
			let tmpContext = tmpCanvas.getContext("2d");
			tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
			tmpContext.rotate(asIcon ? 0 : Math.PI / 2);
			tmpContext.strokeStyle = outlineColor;
			tmpContext.lineWidth = outlineWidth * (asIcon ? tmpCanvas.width / 81 : 1);
			if (isNight && !asIcon) {
				tmpContext.shadowBlur = blurScale;
				tmpContext.shadowColor = `rgba(0, 0, 0, ${obj.name == "pit trap" ? 0.6 : 0.3})`;
			}
			if (obj.name == "apple") {
				tmpContext.fillStyle = "#c15555";
				renderCircle(0, 0, reScale, tmpContext);
				tmpContext.fillStyle = "#89a54c";
				let leafDir = -(Math.PI / 2);
				renderLeaf(
					reScale * Math.cos(leafDir),
					reScale * Math.sin(leafDir),
					25,
					leafDir + Math.PI / 2,
					tmpContext,
				);
			} else if (obj.name == "cookie") {
				tmpContext.fillStyle = "#cca861";
				renderCircle(0, 0, reScale, tmpContext);
				tmpContext.fillStyle = "#937c4b";
				let chips = 4;
				let rotVal = (Math.PI * 2) / chips;
				let tmpRange;
				for (let i = 0; i < chips; ++i) {
					tmpRange = UTILS.randInt(reScale / 2.5, reScale / 1.7);
					renderCircle(
						tmpRange * Math.cos(rotVal * i),
						tmpRange * Math.sin(rotVal * i),
						UTILS.randInt(4, 5),
						tmpContext,
						true,
					);
				}
			} else if (obj.name == "cheese") {
				tmpContext.fillStyle = "#f4f3ac";
				renderCircle(0, 0, reScale, tmpContext);
				tmpContext.fillStyle = "#c3c28b";
				let chips = 4;
				let rotVal = (Math.PI * 2) / chips;
				let tmpRange;
				for (let i = 0; i < chips; ++i) {
					tmpRange = UTILS.randInt(reScale / 2.5, reScale / 1.7);
					renderCircle(
						tmpRange * Math.cos(rotVal * i),
						tmpRange * Math.sin(rotVal * i),
						UTILS.randInt(4, 5),
						tmpContext,
						true,
					);
				}
			} else if (
				obj.name == "wood wall" ||
				obj.name == "stone wall" ||
				obj.name == "castle wall"
			) {
				tmpContext.fillStyle =
					obj.name == "castle wall"
						? "#83898e"
						: obj.name == "wood wall"
							? "#a5974c"
							: "#939393";
				let sides = obj.name == "castle wall" ? 4 : 3;
				renderStar(tmpContext, sides, reScale * 1.1, reScale * 1.1);
				tmpContext.fill();
				tmpContext.stroke();
				tmpContext.fillStyle =
					obj.name == "castle wall"
						? "#9da4aa"
						: obj.name == "wood wall"
							? "#c9b758"
							: "#bcbcbc";
				renderStar(tmpContext, sides, reScale * 0.65, reScale * 0.65);
				tmpContext.fill();
			} else if (
				obj.name == "spikes" ||
				obj.name == "greater spikes" ||
				obj.name == "poison spikes" ||
				obj.name == "spinning spikes"
			) {
				const isPlayer = obj.owner && obj.owner.sid === player?.sid;
				const isTeam = obj.owner && !isPlayer && obj.isTeamObject && obj.isTeamObject(player);
				tmpContext.fillStyle = (isPlayer || isTeam) ? "#86A7D8" : (obj.isTeamObject && !obj.isTeamObject(player)) ? "#D99292" : "#939393";
				let tmpScale = reScale * 0.6;
				renderStar(tmpContext, obj.name == "spikes" ? 5 : 6, reScale, tmpScale);
				tmpContext.fill();
				tmpContext.stroke();
				tmpContext.fillStyle = "#a5974c";
				renderCircle(0, 0, tmpScale, tmpContext);
				tmpContext.fillStyle = "#c9b758";
				renderCircle(0, 0, tmpScale / 2, tmpContext, true);
			} else if (
				obj.name == "windmill" ||
				obj.name == "faster windmill" ||
				obj.name == "power mill"
			) {
				tmpContext.fillStyle = "#a5974c";
				renderCircle(0, 0, reScale, tmpContext);
				tmpContext.fillStyle = "#c9b758";
				renderRectCircle(0, 0, reScale * 1.5, 29, 4, tmpContext);
				tmpContext.fillStyle = "#a5974c";
				renderCircle(0, 0, reScale * 0.5, tmpContext);
			} else if (obj.name == "mine") {
				tmpContext.fillStyle = "#939393";
				renderStar(tmpContext, 3, reScale, reScale);
				tmpContext.fill();
				tmpContext.stroke();
				tmpContext.fillStyle = "#bcbcbc";
				renderStar(tmpContext, 3, reScale * 0.55, reScale * 0.65);
				tmpContext.fill();
			} else if (obj.name == "sapling") {
				for (let i = 0; i < 2; ++i) {
					let tmpScale = reScale * (!i ? 1 : 0.5);
					renderStar(tmpContext, 7, tmpScale, tmpScale * 0.7);
					tmpContext.fillStyle = !i ? "#9ebf57" : "#b4db62";
					tmpContext.fill();
					if (!i) tmpContext.stroke();
				}
			} else if (obj.name == "pit trap") {
				tmpContext.fillStyle = "#a5974c";
				renderStar(tmpContext, 3, reScale * 1.1, reScale * 1.1);
				tmpContext.fill();
				tmpContext.stroke();
				tmpContext.fillStyle = outlineColor;
				renderStar(tmpContext, 3, reScale * 0.65, reScale * 0.65);
				tmpContext.fill();
			} else if (obj.name == "boost pad") {
				tmpContext.fillStyle = "#7e7f82";
				renderRect(0, 0, reScale * 2, reScale * 2, tmpContext);
				tmpContext.fill();
				tmpContext.stroke();
				tmpContext.fillStyle = "#dbd97d";
				renderTriangle(reScale * 1, tmpContext);
			} else if (obj.name == "turret") {
				tmpContext.fillStyle = "#a5974c";
				renderCircle(0, 0, reScale, tmpContext);
				tmpContext.fill();
				tmpContext.stroke();
				tmpContext.fillStyle = "#939393";
				let tmpLen = 50;
				renderRect(0, -tmpLen / 2, reScale * 0.9, tmpLen, tmpContext);
				renderCircle(0, 0, reScale * 0.6, tmpContext);
				tmpContext.fill();
				tmpContext.stroke();
			} else if (obj.name == "platform") {
				tmpContext.fillStyle = "#cebd5f";
				let tmpCount = 4;
				let tmpS = reScale * 2;
				let tmpW = tmpS / tmpCount;
				let tmpX = -(reScale / 2);
				for (let i = 0; i < tmpCount; ++i) {
					renderRect(tmpX - tmpW / 2, 0, tmpW, reScale * 2, tmpContext);
					tmpContext.fill();
					tmpContext.stroke();
					tmpX += tmpS / tmpCount;
				}
			} else if (obj.name == "healing pad") {
				tmpContext.fillStyle = "#7e7f82";
				renderRect(0, 0, reScale * 2, reScale * 2, tmpContext);
				tmpContext.fill();
				tmpContext.stroke();
				tmpContext.fillStyle = "#db6e6e";
				renderRectCircle(0, 0, reScale * 0.65, 20, 4, tmpContext, true);
			} else if (obj.name == "spawn pad") {
				tmpContext.fillStyle = "#7e7f82";
				renderRect(0, 0, reScale * 2, reScale * 2, tmpContext);
				tmpContext.fill();
				tmpContext.stroke();
				tmpContext.fillStyle = "#71aad6";
				renderCircle(0, 0, reScale * 0.6, tmpContext);
			} else if (obj.name == "blocker") {
				tmpContext.fillStyle = "#7e7f82";
				renderCircle(0, 0, reScale, tmpContext);
				tmpContext.fill();
				tmpContext.stroke();
				tmpContext.rotate(Math.PI / 4);
				tmpContext.fillStyle = "#db6e6e";
				renderRectCircle(0, 0, reScale * 0.65, 20, 4, tmpContext, true);
			} else if (obj.name == "teleporter") {
				tmpContext.fillStyle = "#7e7f82";
				renderCircle(0, 0, reScale, tmpContext);
				tmpContext.fill();
				tmpContext.stroke();
				tmpContext.rotate(Math.PI / 4);
				tmpContext.fillStyle = "#d76edb";
				renderCircle(0, 0, reScale * 0.5, tmpContext, true);
			}
		}
		tmpSprite = tmpCanvas;
		if (!asIcon) itemSprites[obj.id] = tmpSprite;
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
		renderLeaf(
			obj.scale * Math.cos(leafDir),
			obj.scale * Math.sin(leafDir),
			25,
			leafDir + Math.PI / 2,
			tmpContext,
		);
	} else if (obj.name == "cookie") {
		tmpContext.fillStyle = "#cca861";
		renderCircle(0, 0, obj.scale, tmpContext);
		tmpContext.fillStyle = "#937c4b";
		let chips = 4;
		let rotVal = (Math.PI * 2) / chips;
		let tmpRange;
		for (let i = 0; i < chips; ++i) {
			tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
			renderCircle(
				tmpRange * Math.cos(rotVal * i),
				tmpRange * Math.sin(rotVal * i),
				UTILS.randInt(4, 5),
				tmpContext,
				true,
			);
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
			renderCircle(
				tmpRange * Math.cos(rotVal * i),
				tmpRange * Math.sin(rotVal * i),
				UTILS.randInt(4, 5),
				tmpContext,
				true,
			);
		}
	} else if (
		obj.name == "wood wall" ||
		obj.name == "stone wall" ||
		obj.name == "castle wall"
	) {
		tmpContext.fillStyle =
			obj.name == "castle wall"
				? "#83898e"
				: obj.name == "wood wall"
					? "#a5974c"
					: "#939393";
		let sides = obj.name == "castle wall" ? 4 : 3;
		renderStar(tmpContext, sides, obj.scale * 1.1, obj.scale * 1.1);
		tmpContext.fill();
		tmpContext.stroke();
		tmpContext.fillStyle =
			obj.name == "castle wall"
				? "#9da4aa"
				: obj.name == "wood wall"
					? "#c9b758"
					: "#bcbcbc";
		renderStar(tmpContext, sides, obj.scale * 0.65, obj.scale * 0.65);
		tmpContext.fill();
	} else if (
		obj.name == "spikes" ||
		obj.name == "greater spikes" ||
		obj.name == "poison spikes" ||
		obj.name == "spinning spikes"
	) {
		const isPlayer = obj.owner && obj.owner.sid === player?.sid;
		const isTeam = obj.owner && !isPlayer && obj.isTeamObject && obj.isTeamObject(player);
		tmpContext.fillStyle = (isPlayer || isTeam) ? "#86A7D8" : (obj.isTeamObject && !obj.isTeamObject(player)) ? "#D99292" : "#939393";
		let tmpScale = obj.scale * 0.6;
		renderStar(tmpContext, obj.name == "spikes" ? 5 : 6, obj.scale, tmpScale);
		tmpContext.fill();
		tmpContext.stroke();
		tmpContext.fillStyle = "#a5974c";
		renderCircle(0, 0, tmpScale, tmpContext);
		tmpContext.fillStyle = "#c9b758";
		renderCircle(0, 0, tmpScale / 2, tmpContext, true);
	} else if (
		obj.name == "windmill" ||
		obj.name == "faster windmill" ||
		obj.name == "power mill"
	) {
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
		tmpCanvas.width = tmpCanvas.height =
			obj.scale * 2.5 +
			outlineWidth +
			(items.list[obj.id].spritePadding || 0) +
			blurScale;
		let tmpContext = tmpCanvas.getContext("2d");
		tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
		tmpContext.rotate(Math.PI / 2);
		tmpContext.strokeStyle = outlineColor;
		tmpContext.lineWidth = outlineWidth;
		if (isNight) {
			tmpContext.shadowBlur = blurScale;
			tmpContext.shadowColor = `rgba(0, 0, 0, 0.3)`;
		}
		if (
			obj.name == "spikes" ||
			obj.name == "greater spikes" ||
			obj.name == "poison spikes" ||
			obj.name == "spinning spikes"
		) {
			const isPlayer = obj.owner && obj.owner.sid === player?.sid;
			const isTeam = obj.owner && !isPlayer && obj.isTeamObject && obj.isTeamObject(player);
			tmpContext.fillStyle = (isPlayer || isTeam) ? "#86A7D8" : (obj.isTeamObject && !obj.isTeamObject(player)) ? "#D99292" : "#939393";
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
	} else if (
		obj.name == "wood wall" ||
		obj.name == "stone wall" ||
		obj.name == "castle wall"
	) {
		let sides = obj.name == "castle wall" ? 4 : 3;
		renderHealthStar(tmpContext, sides, obj.scale * 1.1, obj.scale * 1.1);
		tmpContext.stroke();
	} else if (
		obj.name == "spikes" ||
		obj.name == "greater spikes" ||
		obj.name == "poison spikes" ||
		obj.name == "spinning spikes"
	) {
		let tmpScale = obj.scale * 0.6;
		renderHealthStar(
			tmpContext,
			obj.name == "spikes" ? 5 : 6,
			obj.scale,
			tmpScale,
		);
		tmpContext.stroke();
	} else if (
		obj.name == "windmill" ||
		obj.name == "faster windmill" ||
		obj.name == "power mill"
	) {
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
		renderHealthRect(
			0,
			0,
			obj.scale * 2,
			obj.scale * 2,
			tmpContext,
			false,
			true,
		);
	} else if (obj.name == "turret") {
		renderHealthCircle(0, 0, obj.scale, tmpContext, false, true);
	} else if (obj.name == "platform") {
		renderHealthRect(
			0,
			0,
			obj.scale * 2,
			obj.scale * 2,
			tmpContext,
			false,
			true,
		);
	} else if (obj.name == "healing pad") {
		renderHealthRect(
			0,
			0,
			obj.scale * 2,
			obj.scale * 2,
			tmpContext,
			false,
			true,
		);
	} else if (obj.name == "spawn pad") {
		renderHealthRect(
			0,
			0,
			obj.scale * 2,
			obj.scale * 2,
			tmpContext,
			false,
			true,
		);
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
	return (
		x + s >= 0 &&
		x - s <= maxScreenWidth &&
		y + s >= 0 &&
		(y, s, maxScreenHeight)
	);
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
	let XOffset = xof;
	let YOffset = yof;
	volcano.animationTime += delta;
	volcano.animationTime %= config.volcanoAnimationDuration;
	let halfAnimationDuration = config.volcanoAnimationDuration / 2;
	let lavaScaleFactor =
		1.7 +
		0.3 *
		(Math.abs(halfAnimationDuration - volcano.animationTime) /
			halfAnimationDuration);
	let finalLavaScale = config.innerVolcanoScale * lavaScaleFactor;
	mainContext.drawImage(
		volcano.land,
		volcano.x - config.volcanoScale - XOffset,
		volcano.y - config.volcanoScale - YOffset,
		config.volcanoScale * 2,
		config.volcanoScale * 2,
	);
	mainContext.drawImage(
		volcano.lava,
		volcano.x - finalLavaScale - XOffset,
		volcano.y - finalLavaScale - YOffset,
		finalLavaScale * 2,
		finalLavaScale * 2,
	);
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
			// update + tickAlpha each object exactly once, on its own layer pass
			if (layer == tmpObj.layer) {
				tmpObj.update(delta);
				tmpObj.tickAlpha(delta);
			}

			if (
				tmpObj.layer == layer &&
				isOnScreen(tmpX, tmpY, tmpObj.scale + (tmpObj.blocker || 0))
			) {
				if (tmpObj.isItem) {
					if ((tmpObj.dmg || tmpObj.trap) && !tmpObj.isTeamObject(player)) {
						tmpSprite = getObjSprite(tmpObj);
					} else {
						tmpSprite = getItemSprite(tmpObj);
					}

					mainContext.save();
					mainContext.translate(tmpX, tmpY);
					mainContext.rotate(tmpObj.dir + (tmpObj.angle || 0));
					if (!tmpObj.active) {
						mainContext.scale(
							tmpObj.visScale / tmpObj.scale,
							tmpObj.visScale / tmpObj.scale,
						);
					}
					// tmpObj.alpha lerps 0 to maxAlpha, use directly
					mainContext.globalAlpha = tmpObj.alpha;
					if (tmpObj.reloads <= 0) {
						mainContext.globalAlpha = 0.2 * (tmpObj.alpha / tmpObj.maxAlpha);
					}
					mainContext.drawImage(
						tmpSprite,
						-(tmpSprite.width / 2),
						-(tmpSprite.height / 2),
					);

					if (tmpObj.blocker) {
						mainContext.strokeStyle = "#db6e6e";
						mainContext.globalAlpha = 0.3 * (tmpObj.alpha / tmpObj.maxAlpha);
						mainContext.lineWidth = 6;
						renderCircle(0, 0, tmpObj.blocker, mainContext, false, true);
					}
					mainContext.restore();
				} else {
					if (tmpObj.type == 4) {
						renderVolcano();
					} else {
						tmpSprite = getResSprite(tmpObj);
						// alpha lerps 0 to maxAlpha, use directly
						mainContext.globalAlpha = tmpObj.alpha;
						mainContext.drawImage(
							tmpSprite,
							tmpX - tmpSprite.width / 2,
							tmpY - tmpSprite.height / 2,
						);
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
		if (preplaceVisible.length) {
			preplaceVisible.forEach((places) => {
				tmpX = places.x - xOffset;
				tmpY = places.y - yOffset;
				markPreplace(places, tmpX, tmpY);
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
					ctxt.globalAlpha = 1 - Math.max(0, this.scale / scale);
					ctxt.beginPath();
					ctxt.arc(
						(this.x / config.mapScale) * mapDisplay.width,
						(this.y / config.mapScale) * mapDisplay.width,
						this.scale,
						0,
						2 * Math.PI,
					);
					ctxt.stroke();
				}
			}
		};
		this.color = color;
	}
}
function pingMap(x, y) {
	tmpPing = mapPings.find((pings) => !pings.active);
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
				mapContext.fillText(
					"!",
					(breakTrackers[i].x / config.mapScale) * mapDisplay.width,
					(breakTrackers[i].y / config.mapScale) * mapDisplay.height,
				);
				i += 2;
			}
		}

		// RENDER PLAYERS:
		mapContext.globalAlpha = 1;
		mapContext.fillStyle = "#fff";
		renderCircle(
			(player.x / config.mapScale) * mapDisplay.width,
			(player.y / config.mapScale) * mapDisplay.height,
			7,
			mapContext,
			true,
		);
		mapContext.fillStyle = "rgba(255,255,255,0.35)";
		if (player.team && minimapData) {
			for (let i = 0; i < minimapData.length;) {
				renderCircle(
					(minimapData[i] / config.mapScale) * mapDisplay.width,
					(minimapData[i + 1] / config.mapScale) * mapDisplay.height,
					7,
					mapContext,
					true,
				);
				i += 2;
			}
		}

		// DEATH LOCATION:
		if (lastDeath) {
			mapContext.fillStyle = "#fc5553";
			mapContext.font = "34px Hammersmith One";
			mapContext.textBaseline = "middle";
			mapContext.textAlign = "center";
			mapContext.fillText(
				"x",
				(lastDeath.x / config.mapScale) * mapDisplay.width,
				(lastDeath.y / config.mapScale) * mapDisplay.height,
			);
		}

		// MAP MARKER:
		if (mapMarker) {
			mapContext.fillStyle = "#fff";
			mapContext.font = "34px Hammersmith One";
			mapContext.textBaseline = "middle";
			mapContext.textAlign = "center";
			mapContext.fillText(
				"x",
				(mapMarker.x / config.mapScale) * mapDisplay.width,
				(mapMarker.y / config.mapScale) * mapDisplay.height,
			);
		}
		bottics.forEach((c) => {
			if (
				c &&
				c.inGame &&
				c.Bot &&
				c.Bot.alive &&
				typeof c.Bot.x2 === "number" &&
				typeof c.Bot.y2 === "number" &&
				c.Bot.x2 > 0 &&
				c.Bot.y2 > 0
			) {
				const mapX = (c.Bot.x2 / config.mapScale) * mapDisplay.width;
				const mapY = (c.Bot.y2 / config.mapScale) * mapDisplay.height;
				mapContext.fillStyle = "white";
				mapContext.globalAlpha = 0.4;
				mapContext.beginPath();
				mapContext.arc(mapX, mapY, 7, 0, Math.PI * 2);
				mapContext.fill();
			}
		});
	}
}

let crossHair =
	"https://upload.wikimedia.org/wikipedia/commons/9/95/Crosshairs_Red.svg";
let crossHairSprites;
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
	let tmpSprite = new Image();
	tmpSprite.onload = function () {
		this.isLoaded = true;
	};
	tmpSprite.src = crossHair;
	crossHairSprites = tmpSprite;
	/*
		for (let i = 0; i < crossHairs.length; ++i) {
				let tmpSprite = new Image();
				tmpSprite.onload = function() {
						this.isLoaded = true;
				};
				tmpSprite.src = crossHairs[i];
				crossHairSprites[i] = tmpSprite;
		}*/
}
loadIcons();

function seePoint(point) {
	let deltaX = Math.abs(point.x - player.x) - point.scale;
	let deltaY = Math.abs(point.y - player.y) - point.scale;
	let maxVisibleWidth = (maxScreenWidth / 2) * 1.3;
	let maxVisibleHeight = (maxScreenHeight / 2) * 1.3;
	return deltaX <= maxVisibleWidth && deltaY <= maxVisibleHeight;
}
// COASTLINE MAKER:
function ShorePath(startX, startY, endX, distance, float) {
	this.startX = startX;
	this.startY = startY;
	this.endX = endX;
	this.distance = distance;
	this.float = float;

	this.amountPaths = Math.ceil(this.endX / this.distance);

	this.path = new Map();

	this.generate = function () {
		for (let i = 1; i <= this.amountPaths; i += 1) {
			const offsetY = i % 2 === 0 ? this.distance : 0;
			const x = this.startX + this.distance * (i - 1);
			const randomOffsetY = Math.floor(Math.random() * (45 - 10)) + 10;
			const y =
				this.startY +
				((this.float === "down" ? offsetY : -offsetY) +
					(i % 2 === 0
						? Math.random() < 0.55
							? randomOffsetY
							: -randomOffsetY
						: 0));

			this.path.set(i, [x, y, offsetY, randomOffsetY]);
		}
	};

	this.render = function (color, xOffset, yOffset) {
		const path = Array.from(this.path.values());
		if (!player?.active || !player?.alive) return;

		for (let i = 1; i < path.length; i++) {
			const oldPoint = path[i - 1];
			const currentPoint = path[i];

			if (
				!seePoint({
					x: oldPoint[0],
					y: oldPoint[1],
					scale: 10,
				})
			)
				continue;

			if (
				!seePoint({
					x: currentPoint[0],
					y: currentPoint[1],
					scale: 10,
				})
			)
				continue;

			const pointOffset = this.distance / 2;
			const sidePoint1 = [
				oldPoint[0] - pointOffset / 2,
				oldPoint[1] + (oldPoint[2] === 0 ? pointOffset : -pointOffset),
			];
			const sidePoint2 = [
				currentPoint[0] + pointOffset * 1.15,
				currentPoint[1] + pointOffset * 1.2,
			];
			const sidePoint3 = [
				currentPoint[0] + pointOffset * 1.35,
				currentPoint[1] - pointOffset * 1.15,
			];
			const sidePoint4 = [
				currentPoint[0] - pointOffset * 1.35,
				currentPoint[1] + pointOffset * 1.15,
			];

			mainContext.save();
			mainContext.fillStyle = color;
			mainContext.lineCap = "round";
			mainContext.lineJoin = "round";
			mainContext.beginPath();
			mainContext.moveTo(oldPoint[0] - xOffset, oldPoint[1] - yOffset);
			mainContext.lineTo(
				oldPoint[0] + this.distance * 2 - xOffset,
				this.startY - yOffset,
			);
			mainContext.lineTo(currentPoint[0] - xOffset, currentPoint[1] - yOffset);
			mainContext.fill();
			mainContext.beginPath();
			mainContext.moveTo(oldPoint[0] - xOffset, oldPoint[1] - yOffset);
			mainContext.bezierCurveTo(
				sidePoint1[0] - xOffset,
				sidePoint1[1] - yOffset,
				sidePoint2[0] - xOffset,
				sidePoint2[1] - yOffset,
				currentPoint[0] + (currentPoint[3] >= 10 ? 3.5 : 1) - xOffset,
				currentPoint[1] - yOffset,
			);
			mainContext.fill();
			mainContext.beginPath();
			mainContext.moveTo(currentPoint[0] - xOffset, currentPoint[1] - yOffset);
			mainContext.bezierCurveTo(
				sidePoint2[0] - xOffset,
				sidePoint2[1] - yOffset,
				sidePoint3[0] - xOffset,
				sidePoint3[1] - yOffset,
				currentPoint[0] + this.distance * 2 - xOffset,
				this.startY - yOffset,
			);
			mainContext.fill();
			mainContext.restore();
		}
	};

	return this.generate();
}

const snowPath = new ShorePath(
	-maxScreenWidth,
	config.snowBiomeTop - 1,
	config.mapScale + maxScreenWidth * 2,
	50,
	"down",
);
const desertPath = new ShorePath(
	-maxScreenWidth,
	config.mapScale - config.snowBiomeTop + 1,
	config.mapScale + maxScreenWidth * 2,
	50,
	"up",
);

let removeSnowflakes = () => {
	let snowflakes = document.querySelectorAll(".snowflake");
	snowflakes.forEach((snowflake) => snowflake.remove());
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
let nightModeState = {
	// Ueh logic of making beutiful stars
	isEnabled: false,
	overlay: { opacity: 0, r: 0, g: 0, b: 0 },
	starField: [],
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
					posX: offsetX * scaleMultiplier + UTILS.randFloat(0, maxScreenWidth),
					posY: offsetY * scaleMultiplier + UTILS.randFloat(0, maxScreenHeight),
					size: UTILS.randFloat(2, 6),
					transparency: 0,
					visible: true,
					brightening: true,
					color: `rgb(255, 255, ${UTILS.randInt(0, 255)})`,
				});
			}
		} else {
			starSpawnTimer += delta;
		}
	}

	nightModeState.starField = nightModeState.starField.filter(
		(star) => star.visible,
	);

	for (let i = 0; i < nightModeState.starField.length; i++) {
		let star = nightModeState.starField[i];

		if (star.brightening) {
			star.transparency = Math.min(1, star.transparency + 0.02);
			if (star.transparency >= 1) star.brightening = false;
		} else {
			star.transparency = Math.max(0, star.transparency - 0.02);
			if (star.transparency <= 0) star.visible = false;
		}

		let renderStar = (mainContext, size) => {
			mainContext.beginPath();
			mainContext.moveTo(0, -size);
			for (let i = 1; i < 8; i++) {
				let angle = (Math.PI / 4) * i;
				let radius = i % 2 === 0 ? size : size / 2;
				mainContext.lineTo(Math.sin(angle) * radius, -Math.cos(angle) * radius);
			}
			mainContext.closePath();
		};

		mainContext.save();
		mainContext.globalAlpha = star.transparency;
		mainContext.translate(
			star.posX - offsetX * star.scaleMultiplier,
			star.posY - offsetY * star.scaleMultiplier,
		);
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
		nightMode.style.opacity = 0.45;
		nightMode.style.display = "block";
	} else {
		nightMode.style.animationName = "night2";
		nightMode.style.opacity = 0;
		workerSetTimeout(() => {
			nightMode.style.display = "none";
		}, 1000 * parseFloat(nightMode.style.animationDuration));
	}
}

let changeDays = workerSetInterval(() => {
	if (!nightStateTime || Date.now() - nightStateTime >= 240000) {
		nightState = !nightState;
		nightStateTime = Date.now();
		toggleDay_NightMode();
	}
}, 1000);

window.toggleNight = function () {
	workerClearInterval(changeDays);
	toggleDay_NightMode();
	nightState = !nightState;
	nightStateTime = Date.now();
};

function startDayNightCycle() {
	if (changeDays) return;

	changeDays = workerSetInterval(() => {
		if (!nightStateTime || Date.now() - nightStateTime >= 240000) {
			nightState = !nightState;
			nightStateTime = Date.now();
			toggleDay_NightMode();
		}
	}, 1000);
}

function stopDayNightCycle() {
	if (!changeDays) return;
	workerClearInterval(changeDays);
	changeDays = null;
}

function updateGame() {
	itemCount();
	updateWiggles();
	if (config.resetRender) {
		config.resetRender = false;
		mainContext.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
		mainContext.beginPath();
	}
	let original1 = {
		width: 1920,
		height: 1080
	}
	if (configs.CAmera) {
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
			maxScreenWidth = config.maxScreenWidth;
			maxScreenHeight = config.maxScreenHeight;
			camX = Math.max(540, Math.min(13840, config.mapScale / 2));
			camY = Math.max(200, Math.min(14240, config.mapScale / 2));
			resize();
		}
	} else {
		if (player) {
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
	// SNOW MAUHAHA:

	if (player && player.y < config.snowBiomeTop) {
		snowflakeContainer.style.display = "block";
		let snowing = snowflakeContainer.querySelectorAll('.snowflake').length;
		if (snowing < 55) {
			let snowS = createSnowflake();
			if (Math.random() > 0.7) {
				snowS.classList.add("fast-fall");
			}
			snowflakeContainer.appendChild(snowS);
		}
	} else {
		removeSnowflakes();
		snowflakeContainer.style.display = "none";
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

	// RENDER PROJECTILE DETECTION:
	detectProjectile.render(mainContext, { x: xOffset, y: yOffset });

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
	} if (config.mapScale - xOffset <= maxScreenWidth) {
		let tmpY = Math.max(0, -yOffset);
		mainContext.fillRect(config.mapScale - xOffset, tmpY, maxScreenWidth - (config.mapScale - xOffset), maxScreenHeight - tmpY);
	} if (yOffset <= 0) {
		mainContext.fillRect(-xOffset, 0, maxScreenWidth + xOffset, -yOffset);
	} if (config.mapScale - yOffset <= maxScreenHeight) {
		let tmpX = Math.max(0, -xOffset);
		let tmpMin = 0;
		if (config.mapScale - xOffset <= maxScreenWidth) {
			tmpMin = maxScreenWidth - (config.mapScale - xOffset);
		}
		mainContext.fillRect(tmpX, config.mapScale - yOffset,
			(maxScreenWidth - tmpX) - tmpMin, maxScreenHeight - (config.mapScale - yOffset));
	}

	if (!window.markLayer) {
		window.markLayer = document.createElement('canvas');
		window.markLayer.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:1;";
		document.getElementById("gameCanvas").parentNode.insertBefore(window.markLayer, document.getElementById("gameCanvas").nextSibling);
		window.markCtx = window.markLayer.getContext('2d', { alpha: true });
	}

	const mCan = window.markLayer;
	const mCtx = window.markCtx;

	if (mCan.width !== gameCanvas.width || mCan.height !== gameCanvas.height) {
		mCan.width = gameCanvas.width;
		mCan.height = gameCanvas.height;
	}

	mCtx.setTransform(1, 0, 0, 1, 0, 0);
	mCtx.clearRect(0, 0, mCan.width, mCan.height);

	const scale = Math.max(screenWidth / maxScreenWidth, screenHeight / maxScreenHeight) * pixelDensity;
	mCtx.setTransform(scale, 0, 0, scale, (screenWidth * pixelDensity - maxScreenWidth * scale) / 2, (screenHeight * pixelDensity - maxScreenHeight * scale) / 2);

	const zoomFactor = (window.config?.zoom || 1.5) / 1.5;
	const viewRange = 1200 * zoomFactor;
	const textRangeSq = 90000;

	mCtx.font = "bold 16px Hammersmith One";
	mCtx.textAlign = "center";
	mCtx.textBaseline = "middle";

	for (let i = 0, len = gameObjects.length; i < len; i++) {
		const obj = gameObjects[i];
		if (!obj?.active || !obj?.isItem) continue;

		const dx = obj.x - (player?.x || 0);
		const dy = obj.y - (player?.y || 0);

		if (dx > viewRange || dx < -viewRange || dy > viewRange || dy < -viewRange) continue;

		const dSq = dx * dx + dy * dy;
		const fX = (obj.x - xOffset) + (obj.xWiggle || 0);
		const fY = (obj.y - yOffset) + (obj.yWiggle || 0);

		if (dSq < textRangeSq) {
			mCtx.globalAlpha = 1 - (dSq / textRangeSq);
			mCtx.lineWidth = 4;
			mCtx.strokeStyle = "rgba(0,0,0,0.6)";
			mCtx.strokeText(objectManager.hitsToBreak(obj, player), fX, fY);
			mCtx.fillStyle = "#fff";
			mCtx.fillText(objectManager.hitsToBreak(obj, player), fX, fY);
		}
	}

	// RENDER DAY/NIGHT TIME:
	mainContext.globalAlpha = 1;
	mainContext.fillStyle = "rgba(0, 0, 70, 0.35)";
	mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);

	// RENDER PLAYER AND AI UI:
	mainContext.strokeStyle = darkOutlineColor;
	mainContext.globalAlpha = 1;
	for (let i = 0; i < players.length + ais.length; ++i) {
		tmpObj = players[i] || ais[i - players.length];
		if (tmpObj.visible) {
			mainContext.strokeStyle = darkOutlineColor;

			// NAME AND HEALTH:
			if (tmpObj.skinIndex != 10 || (tmpObj.team && tmpObj.team == player.team)) {
				let tmpText = (tmpObj.team ? "[" + tmpObj.team + "] " : "") + (tmpObj.name || "") + (tmpObj.isPlayer ? " {" + tmpObj.sid + "}" : "");
				if (tmpText != "") {
					mainContext.font = (tmpObj.nameScale || 30) + "px Hammersmith One";
					mainContext.fillStyle = tmpObj.isPlayer ? syncersInServer.includes(tmpObj.sid) ? "#FF0000" : playersInServer.includes(tmpObj.sid) ? "#00ff00" : "#fff" : "#fff";
					mainContext.textBaseline = "middle";
					mainContext.textAlign = "center";
					mainContext.lineWidth = (tmpObj.nameScale ? 11 : 8);
					mainContext.lineJoin = "round";
					mainContext.strokeText(tmpText, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY);
					mainContext.fillText(tmpText, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY);
					if (tmpObj.isLeader && iconSprites["crown"].isLoaded) {
						let tmpS = config.crownIconScale;
						let tmpX = tmpObj.x - xOffset - (tmpS / 2) - (mainContext.measureText(tmpText).width / 2) - config.crownPad;
						mainContext.drawImage(iconSprites["crown"], tmpX, (tmpObj.y - yOffset - tmpObj.scale)
							- config.nameY - (tmpS / 2) - 5, tmpS, tmpS);
					}
					if (tmpObj.iconIndex == 1 && iconSprites["skull"].isLoaded) {
						let tmpS = config.crownIconScale;
						let tmpX = tmpObj.x - xOffset - (tmpS / 2) + (mainContext.measureText(tmpText).width / 2) + config.crownPad;
						mainContext.drawImage(iconSprites["skull"], tmpX, (tmpObj.y - yOffset - tmpObj.scale)
							- config.nameY - (tmpS / 2) - 5, tmpS, tmpS);
					}
					if (tmpObj.isPlayer && instaC.wait && near.sid == tmpObj.sid && enemy.length) {
						let tmpS = tmpObj.scale * 2.2;
						mainContext.drawImage(crossHairSprites, tmpObj.x - xOffset - tmpS / 2, tmpObj.y - yOffset - tmpS / 2, tmpS, tmpS);
					}
					if (tmpObj.isPlayer && tmpObj.sid == targetPlayer?.sid) {
						let tmpS = tmpObj.scale * 2.2;
						let angle = performance.now() * 0.002;
						mainContext.save();
						mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset); // move origin to center
						mainContext.rotate(angle);                                    // rotate around center
						mainContext.drawImage(crossHairSprites, -tmpS / 2, -tmpS / 2, tmpS, tmpS); // draw centered
						mainContext.restore();
					}
				}
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
					mainContext.fillStyle = (tmpObj.sid == player.sid || (tmpObj.team && tmpObj.team == player.team)) ? "#FF6666" : "#FFFF66";
					mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth, (tmpObj.y - yOffset + tmpObj.scale) + config.nameY + config.healthBarPad, tmpObj.prevDW, 17 - config.healthBarPad * 2, 7);
					mainContext.fill();
					mainContext.fillStyle = (tmpObj.sid == player.sid || (tmpObj.team && tmpObj.team == player.team)) ? "#8ecc51" : "#cc5151";
					mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth, (tmpObj.y - yOffset + tmpObj.scale) + config.nameY + config.healthBarPad, curr, 17 - config.healthBarPad * 2, 7);
					mainContext.fill();
					if (tmpObj.isPlayer) {

						mainContext.globalAlpha = 1;

						// UNDER TEXT:
						mainContext.globalAlpha = 1;
						mainContext.font = "20px Hammersmith One";
						mainContext.fillStyle = "#fff";
						mainContext.strokeStyle = darkOutlineColor;
						mainContext.textBaseline = "middle";
						mainContext.textAlign = "center";
						mainContext.lineWidth = 8;
						mainContext.lineJoin = "round";
						let text = [];
						if (tmpObj.sid == player.sid) {
							text = [player.health, UTILS.fixTo(tmpObj.damageSources.totalSoldier, 2), UTILS.fixTo(tmpObj.damageSources.totalNoSoldier, 2)];
							mainContext.strokeText("[" + text.join(",") + "]", tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 13.5 * 2);
							mainContext.fillText("[" + text.join(",") + "]", tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 13.5 * 2);
						} else {
							text = [tmpObj.primaryIndex, (tmpObj.secondaryIndex || 0), tmpObj.pingPredict];
							mainContext.strokeText("[" + text.join(",") + "]", tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 13.5 * 2);
							mainContext.fillText("[" + text.join(",") + "]", tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 13.5 * 2);
						}

						// SHAME COUNT:
						mainContext.globalAlpha = 1;
						mainContext.font = "30px Hammersmith One";
						mainContext.fillStyle = "#fff";
						mainContext.strokeStyle = darkOutlineColor;
						mainContext.textBaseline = "middle";
						mainContext.textAlign = "center";
						mainContext.lineWidth = 8;
						mainContext.lineJoin = "round";
						let tmpS = config.crownIconScale;
						let tmpX = tmpObj.x - xOffset - tmpS / 2 + mainContext.measureText(tmpText).width / 2 + config.crownPad + (tmpObj.iconIndex == 1 ? 30 * 2.75 : 30);
						mainContext.strokeText(tmpObj.skinIndex == 45 && tmpObj.shameTimer > 0 ? tmpObj.shameTimer : tmpObj.shameCount, tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY);
						mainContext.fillText(tmpObj.skinIndex == 45 && tmpObj.shameTimer > 0 ? tmpObj.shameTimer : tmpObj.shameCount, tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY);
						if (tmpObj.sid == player.sid) {
							// Abstract arc overview: free angle ranges centered on player
							for (let radius in autoPlace.debugRender) {
								autoPlace.debugRender[radius].forEach(range => {
									const r = parseInt(radius);
									const colors = { 50: "#00ff88", 70: "#00aaff" };
									const col = colors[r] || "#fff";
									mainContext.save();
									mainContext.globalAlpha = 0.5;
									mainContext.strokeStyle = col;
									mainContext.lineWidth = 2;
									mainContext.beginPath();
									mainContext.arc(tmpObj.x - xOffset, tmpObj.y - yOffset, r, range[0], range[1]);
									mainContext.stroke();
									mainContext.restore();
								});
							}

							if (configs.placeCalcVis && inGame) {
								const ctx = mainContext;
								const px = player.x2 - xOffset;
								const py = player.y2 - yOffset;

								nearObjs.forEach(obj => {
									if (UTILS.getDist(obj, player, 0, 2) > 150) return;
									const ox = obj.x - xOffset;
									const oy = obj.y - yOffset;
									const objScale = obj.getScale(0.6, obj.isItem);

									// Thin red ring: actual object collision radius
									ctx.save();
									ctx.globalAlpha = 0.5;
									ctx.strokeStyle = "#ff4444";
									ctx.lineWidth = 1;
									ctx.beginPath();
									ctx.arc(ox, oy, objScale, 0, Math.PI * 2);
									ctx.stroke();
									ctx.restore();

									[[player.items[2], "#00ff88"], [player.items[4], "#44aaff"]].forEach(([itemId, col]) => {
										if (itemId == null) return;
										const item = items.list[itemId];
										const combinedScale = objScale + item.scale;
										const placeR = player.scale + item.scale + (item.placeOffset || 0);
										const dx = obj.x - player.x2;
										const dy = obj.y - player.y2;
										const dist = Math.sqrt(dx * dx + dy * dy);
										const direct = Math.atan2(dy, dx);

										if (dist < combinedScale) {
											// Dashed combined-scale ring: the "push-out" boundary
											ctx.save();
											ctx.globalAlpha = 0.2;
											ctx.strokeStyle = col;
											ctx.lineWidth = 1;
											ctx.setLineDash([4, 6]);
											ctx.beginPath();
											ctx.arc(ox, oy, combinedScale, 0, Math.PI * 2);
											ctx.stroke();
											ctx.setLineDash([]);
											ctx.restore();

											const calc = Math.acos(Math.min(1, dist / combinedScale));
											[-calc, calc].forEach(offset => {
												const angle = direct + offset;
												const dotX = px + placeR * Math.cos(angle);
												const dotY = py + placeR * Math.sin(angle);

												// search ray: player to candidate placement
												ctx.save();
												ctx.globalAlpha = 0.45;
												ctx.strokeStyle = col;
												ctx.lineWidth = 1;
												ctx.setLineDash([3, 5]);
												ctx.beginPath();
												ctx.moveTo(px, py);
												ctx.lineTo(dotX, dotY);
												ctx.stroke();
												ctx.setLineDash([]);
												ctx.restore();

												// Candidate placement dot
												ctx.save();
												ctx.globalAlpha = 1;
												ctx.fillStyle = col;
												ctx.beginPath();
												ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
												ctx.fill();
												ctx.restore();
											});
										} else {
											// Direct placement: just a dot at the direct angle
											const dotX = px + placeR * Math.cos(direct);
											const dotY = py + placeR * Math.sin(direct);
											ctx.save();
											ctx.globalAlpha = 0.6;
											ctx.fillStyle = col;
											ctx.beginPath();
											ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
											ctx.fill();
											ctx.restore();
										}
									});
								});

								// committed placements this tick: yellow dashed rings
								autoPlace.preplaces[1].forEach(p => {
									ctx.save();
									ctx.globalAlpha = 0.6;
									ctx.strokeStyle = "#ffcc00";
									ctx.lineWidth = 1.5;
									ctx.setLineDash([4, 4]);
									ctx.beginPath();
									ctx.arc(p.x - xOffset, p.y - yOffset, p.scale, 0, Math.PI * 2);
									ctx.stroke();
									ctx.setLineDash([]);
									ctx.restore();
								});
							}
						}

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
							let renderTracer = function (s, ctx) {
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

		renderPathFinder(mainContext, { x: xOffset, y: yOffset })
		detectProjectile.render(mainContext, { x: xOffset, y: yOffset })
		if (player.alive) {
			drawCircles(tmpObj, xOffset, yOffset)
			if (configs.kbVisuals && near && near.alive && enemy.length && (kbIndc.hitPri || kbIndc.hitInsta)) {
				let kb = kbIndc;
				const ex = near.x2 - xOffset, ey = near.y2 - yOffset;
				const col = "#ffffff";
				const drawKBLine = (wx, wy, alpha, w) => {
					if (!wx && !wy) return;
					const sx = wx - xOffset, sy = wy - yOffset;
					mainContext.save();
					mainContext.globalAlpha = alpha;
					mainContext.strokeStyle = col;
					mainContext.lineWidth = w;
					mainContext.setLineDash([6, 4]);
					mainContext.beginPath();
					mainContext.moveTo(ex, ey);
					mainContext.lineTo(sx, sy);
					mainContext.stroke();
					mainContext.setLineDash([]);
					const ang = Math.atan2(sy - ey, sx - ex);
					const ah = 9;
					mainContext.fillStyle = col;
					mainContext.beginPath();
					mainContext.moveTo(sx, sy);
					mainContext.lineTo(sx - ah * Math.cos(ang - 0.35), sy - ah * Math.sin(ang - 0.35));
					mainContext.lineTo(sx - ah * Math.cos(ang + 0.35), sy - ah * Math.sin(ang + 0.35));
					mainContext.closePath();
					mainContext.fill();
					mainContext.globalAlpha = alpha * 0.4;
					mainContext.beginPath();
					mainContext.arc(sx, sy, player.scale * 0.5, 0, Math.PI * 2);
					mainContext.stroke();
					mainContext.restore();
				};
				if (kb.hitPri) drawKBLine(kb.x0, kb.y0, 0.35, 1.5);
				if (kb.hitInsta) drawKBLine(kb.instax, kb.instay, 0.5, 2);
			}
			mainContext.globalAlpha = 1;
			mainContext.fillStyle = "#fff";
			mainContext.strokeStyle = "#000";
			renderCircle(my.pushData.x2 - xOffset, my.pushData.y2 - yOffset, 20);
			if (testRender.x) {
				renderCircle(testRender.x - xOffset, testRender.y - yOffset, 20);
			}
		}

		if (pathfinderRender.waypoints.length > 0 || pathfinderRender.target) {
			const ctx = mainContext;
			ctx.save();
			ctx.globalAlpha = 1;
			ctx.lineJoin = 'round';
			ctx.lineCap = 'round';
			const PF_COLOR = 'rgba(255, 165, 0, 0.9)'; // orange
			const R = 35;
			const HEAD = 12;
			const HEAD_A = Math.PI / 6;

			function drawPfArrow(x1, y1, x2, y2, lw) {
				const angle = Math.atan2(y2 - y1, x2 - x1);
				ctx.beginPath(); ctx.strokeStyle = PF_COLOR; ctx.lineWidth = lw;
				ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
				ctx.beginPath(); ctx.fillStyle = PF_COLOR;
				ctx.moveTo(x2, y2);
				ctx.lineTo(x2 - HEAD * Math.cos(angle - HEAD_A), y2 - HEAD * Math.sin(angle - HEAD_A));
				ctx.lineTo(x2 - HEAD * Math.cos(angle + HEAD_A), y2 - HEAD * Math.sin(angle + HEAD_A));
				ctx.closePath(); ctx.fill();
			}

			// Draw predicted path waypoints and arrows
			for (let i = 0; i < pathfinderRender.waypoints.length; i++) {
				const wp = pathfinderRender.waypoints[i];
				const wx = wp.x - xOffset, wy = wp.y - yOffset;
				if (i < pathfinderRender.waypoints.length - 1) {
					const wp2 = pathfinderRender.waypoints[i + 1];
					drawPfArrow(wx, wy, wp2.x - xOffset, wp2.y - yOffset, 2.5);
				}
				ctx.beginPath(); ctx.arc(wx, wy, R, 0, Math.PI * 2);
				ctx.strokeStyle = PF_COLOR; ctx.lineWidth = 2.5; ctx.stroke();
			}

			// Draw target crosshair
			if (pathfinderRender.target) {
				const tx = pathfinderRender.target.x - xOffset;
				const ty = pathfinderRender.target.y - yOffset;
				const CS = 18;
				ctx.strokeStyle = PF_COLOR; ctx.lineWidth = 2.5;
				ctx.beginPath(); ctx.moveTo(tx - CS, ty); ctx.lineTo(tx + CS, ty); ctx.stroke();
				ctx.beginPath(); ctx.moveTo(tx, ty - CS); ctx.lineTo(tx, ty + CS); ctx.stroke();
				ctx.beginPath(); ctx.arc(tx, ty, CS * 0.6, 0, Math.PI * 2); ctx.stroke();
			}

			ctx.restore();
		}

		// FUNNY:
		if (petals.length && configs.florr) {

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

					let cD = function (r, g, b, dmg) {
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
			if (tmpObj.chat.count > 0) {
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
				mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
				mainContext.fill();
				mainContext.fillStyle = "#ffffff99";
				mainContext.fillText(tmpObj.chat.message, tmpX, tmpY);
			} else {
				tmpObj.chat.count = 0;
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

	mainContext.globalAlpha = 1;

	// RENDER MINIMAP:
	renderMinimap(delta);
}
window.requestAnimFrame = function () {
	return null;
};
window.rAF = (function () {
	return (
		window.requestAnimationFrame ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		function (callback) {
			workerSetTimeout(callback, 1000 / 60);
		}
	);
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
	pingDisplay.innerHTML = `Ping: ${pingTracker[pingTracker.length - 1]} FPS: ${UTILS.round(fpsTimer.ltime, 10)} Packets: ${secPacket}`;
	const pingEl = document.getElementById("pingFps");
	const fpsEl = document.getElementById("fpsCounter");
	const pktEl = document.getElementById("packetStatus");
	if (pingEl) pingEl.textContent = pingTracker[pingTracker.length - 1] ?? "-";
	if (fpsEl) fpsEl.textContent = UTILS.round(fpsTimer.ltime, 10);
	if (pktEl) pktEl.textContent = secPacket;
	updateGame();
	rAF(doUpdate);
}
prepareMenuBackground();
doUpdate();

window.debug = function () {
	workerClearTimeout(debugTimeout);
	PF.paths.length = 0;
	my.waitHit = 0;
	my.autoAim = false;
	instaC.isTrue = false;
	autoBreak.active = false;
	my.anti0Tick = 0;
	my.shameAttempts = 0;
	player.antiTimer = 2;
	my.bullTick = 0;
	my.reSync = true;
	itemSprites.length = 0;
	objSprites.length = 0;
	gameObjectSprites.length = 0;
	debugStop = true;
	debugTimeout = workerSetTimeout(() => {
		debugStop = false;
	}, 5000);
	game.tick = 0;
	petals.length = 0;
	for (let i = 0; i < 5; i++) {
		petals.push(new Petal(player.x, player.y));
	}
	config.resetRender = true;
	placeVisible.length = 0;
	preplaceVisible.length = 0;
	console.clear();
	console.log(alliancePlayers, alliances);
};

window.toggleVisual = function () {
	config.anotherVisual = !config.anotherVisual;
	gameObjects.forEach((tmp) => {
		if (tmp.active) {
			tmp.dir = tmp.lastDir;
		}
	});
};
function addWeaponXPBar(parentEl) {
	let barWrap = document.createElement("div");
	barWrap.style.cssText = `
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 5px;
    background: rgba(0,0,0,0.35);
    border-radius: 3px;
    overflow: hidden;
    `;

	let bar = document.createElement("div");
	bar.style.cssText = `
    height: 100%;
    width: 0%;
    transition: width 0.15s linear;
    `;

	barWrap.appendChild(bar);
	parentEl.appendChild(barWrap);

	return bar;
}
function getWeaponXPPercent(xp) {
	if (xp < 3000) return xp / 3000;
	if (xp < 7000) return xp / 7000;
	if (xp < 12000) return xp / 12000;
	return 1;
}
function updateWeaponXPBars() {
	for (let i = 0; i < items.weapons.length; i++) {
		let el = getEl("actionBarItem" + i);
		if (!el) continue;
		let bar = el._xpBar;
		if (!bar) continue;

		let xp = player.weaponXP[i] || 0;
		let pct = getWeaponXPPercent(xp);
		bar.style.width = pct * 100 + "%";
		bar.style.backgroundColor =
			xp < 3000 ? "#f7cf45" : xp < 7000 ? "#6d92cd" : "#be5455";
	}
}
window.prepareUI = function (tmpObj) {
	resize();
	// ACTION BAR:
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
				parent: actionBar,
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
					tmpContext.drawImage(
						this,
						-(tmpCanvas.width * tmpMlt * config.iconPad * tmpPad) / 2,
						-(tmpCanvas.height * tmpMlt * config.iconPad) / 2,
						tmpCanvas.width * tmpMlt * tmpPad * config.iconPad,
						tmpCanvas.height * tmpMlt * config.iconPad,
					);
					tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
					tmpContext.globalCompositeOperation = "source-atop";
					tmpContext.fillRect(
						-tmpCanvas.width / 2,
						-tmpCanvas.height / 2,
						tmpCanvas.width,
						tmpCanvas.height,
					);
					getEl("actionBarItem" + i).style.backgroundImage =
						"url(" + tmpCanvas.toDataURL() + ")";
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
				tmpUnit.style.position = "relative";
				let bar = addWeaponXPBar(tmpUnit);
				tmpUnit._xpBar = bar;
			} else {
				let tmpSprite = getItemSprite(
					items.list[i - items.weapons.length],
					true,
				);
				let tmpScale = Math.min(
					tmpCanvas.width - config.iconPadding,
					tmpSprite.width,
				);
				tmpContext.globalAlpha = 1;
				tmpContext.drawImage(
					tmpSprite,
					-tmpScale / 2,
					-tmpScale / 2,
					tmpScale,
					tmpScale,
				);
				tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
				tmpContext.globalCompositeOperation = "source-atop";
				tmpContext.fillRect(-tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);
				getEl("actionBarItem" + i).style.backgroundImage =
					"url(" + tmpCanvas.toDataURL() + ")";
				let tmpUnit = getEl("actionBarItem" + i);
				tmpUnit.onmouseover = UTILS.checkTrusted(function () {
					showItemInfo(items.list[i - items.weapons.length]);
				});
				tmpUnit.onclick = UTILS.checkTrusted(function () {
					selectToBuild(
						tmpObj.items[tmpObj.getItemType(i - items.weapons.length)],
					);
				});
				UTILS.hookTouchEvents(tmpUnit);
			}
		})(i);
	}
};
window.toggleNight();

} // end __robotisBoot

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", __robotisBoot, { once: true });
} else {
    __robotisBoot();
}
