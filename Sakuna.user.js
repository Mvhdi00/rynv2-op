// ==UserScript==
// @name         Sakuna 44
// @match        *://*.moomoo.io/*
// @version      44.1
// @description  private
// @namespace    none
// @grant        none
// @run-at       document-start
// ==/UserScript==

/*
 * Changes against the original upload:
 *
 *   1. REMOVED: a block that used your logged-in Google session to read the
 *      home address and name saved on your account, plus a map tile of the
 *      place, and send all three to the author's socket. It was commented out
 *      in this build, and the socket it fed was never opened, but it was
 *      written and ready.
 *   2. REMOVED: a prompt asking for "Enter your Password" -- the label built
 *      out of String.fromCharCode so it would not show up in a search -- whose
 *      answer went to the same socket. Also commented out in this build.
 *   3. REMOVED: a payload sent every frame carrying your sid, position, ping,
 *      fps and page URL. This one was live, and only inert because `socket`
 *      is never assigned anywhere in the file.
 *   4. The transport. The server stopped accepting plain msgpack: packets are
 *      shuffled numeric opcodes now, framed under a truncated HMAC with a
 *      per-connection sequence number. See the EXP shim below.
 *   5. @run-at document-start. It was absent, so the script ran after the game
 *      bundle had already captured WebSocket.prototype.send -- the hook never
 *      saw a single packet. Only the shim runs at document-start; everything
 *      that touches the DOM waits for the document.
 *   6. Packet names are no longer scraped out of the game bundle by splitting
 *      its source on string literals. Those anchors are long gone, so every
 *      split returned undefined; and the names themselves were replaced by
 *      per-connection opcodes anyway.
 *   7. msgpack is bundled. The @require pointed at rawgit.com, which shut down
 *      in 2019, so window.msgpack was undefined and every encode/decode threw.
 *   8. ALTCHA replaced with Cloudflare Turnstile ("cf:" tokens). The old
 *      #altcha_checkbox no longer exists on the page.
 *   9. GM_getValue / GM_setValue replaced with localStorage: they were used
 *      under "@grant none", which makes them undefined.
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

// Packet names, fixed. The original read these out of the live game bundle
// by splitting its source on string literals -- data.split("keyup")[1] and
// friends -- which broke the moment the bundle changed. The shim turns these
// names into this connection's opcodes.
const code = {
    attack: "F",
    move: "9",
    upgrade: "H",
    gather: "K",
    select: "z",
    aim: "D",
    chat: "6",
    store: "c",
    spawn: "M",
    join: "P",
    kick: "Q",
    joinclan: "b",
    creatclan: "L",
    removeclan: "N",
    ping: "0",
};

// `hue` was declared on the same line as `code` in the original
// (`let code, hue = 0;`). Replacing the scraper took that line with it and
// left `hue` undeclared -- updateGame() reads it every frame, so the render
// loop threw on each tick and nothing of the mod drew.
let hue = 0;

/* Everything below touches the DOM, so it waits for the document. Only the
 * shim above runs at document-start. */
function __sakunaBoot() {
/*
    window.addEventListener("keydown", e => {
         if (e.key === "F12" || e.ctrlKey && e.shiftKey && e.key === "I" || e.ctrlKey && e.shiftKey && e.key === "C" || e.ctrlKey && (e.key === "U" || e.key === "u") || e.metaKey && e.altKey && e.key === "Dead") {
              e.preventDefault();
         }
    });
*/
let akeyboard = document.createElement('div');
akeyboard.id = "bkeyboard";
akeyboard.style = `
    display:block;
    overflow:hidden;
    position:fixed;
    bottom:1%;
    left:0;
    z-index:10;
    width:auto;
    height:auto;
 border-radius: 10px;
             `;
var deg=0,colors = [];

for (let i = 1; i <= 360; i++) {
    colors.push(`hsl(${i}, 100%, 50%, 50%)`);
}
akeyboard.innerHTML = `
<div class="keyboard">
   <div class="row">
        <div class="key" id="key27">Esc</div>
        <div class="key" id="key112">F1</div>
        <div class="key" id="key113">F2</div>
        <div class="key" id="key114">F3</div>
        <div class="key" id="key115">F4</div>
        <div class="key" id="key116">F5</div>
        <div class="key" id="key117">F6</div>
        <div class="key" id="key118">F7</div>
        <div class="key" id="key119">F8</div>
        <div class="key" id="key120">F9</div>
        <div class="key" id="key121">F10</div>
        <div class="key" id="key122">F11</div>
        <div class="key" id="key123">F12</div>
        <div class="key" >  </div>
        <div class="key" id="key44">PrtSc</div>
        <div class="key" id="key145">Scroll</div>
        <div class="key" id="key19">Pause</div>
    <div class="key" id="key0" style="width: 82px;">left</div>
    <div class="key" id="key2" style="width: 82px;">right</div>
</div>
<div class="row">
        <div class="key" id="key192">~</div>
        <div class="key" id="key49">1</div>
        <div class="key" id="key50">2</div>
        <div class="key" id="key51">3</div>
        <div class="key" id="key52">4</div>
        <div class="key" id="key53">5</div>
        <div class="key" id="key54">6</div>
        <div class="key" id="key55">7</div>
        <div class="key" id="key56">8</div>
        <div class="key" id="key57">9</div>
        <div class="key" id="key48">0</div>
        <div class="key" id="key189">-</div>
        <div class="key" id="key187">+</div>
        <div class="key" id="key8">Back</div>
        <div class="key" id="key45">Insert</div>
        <div class="key" id="key36">Home</div>
        <div class="key" id="key33">Page Up</div>
        <div class="key" id="key144">Num</div>
        <div class="key" id="key111">/</div>
        <div class="key" id="key106">*</div>
        <div class="key" id="key109">-</div>
  </div>
  <div class="row">
        <div class="key" id="key9">Tab</div>
        <div class="key" id="key81">Q</div>
        <div class="key" id="key87">W</div>
        <div class="key" id="key69">E</div>
        <div class="key" id="key82">R</div>
        <div class="key" id="key84">T</div>
        <div class="key" id="key89">Y</div>
        <div class="key" id="key85">U</div>
        <div class="key" id="key73">I</div>
        <div class="key" id="key79">O</div>
        <div class="key" id="key80">P</div>
        <div class="key" id="key219">[</div>
        <div class="key" id="key221">]</div>
        <div class="key" id="key220">&#92;</div>
        <div class="key" id="key46">Delete</div>
        <div class="key" id="key35">End</div>
        <div class="key" id="key34">Page Down</div>
        <div class="key" id="key103">7</div>
        <div class="key" id="key104">8</div>
        <div class="key" id="key105">9</div>
        <div class="key" id="key107">+</div>
  </div>
  <div class="row">
        <div class="key" id="key20">Caps Lock</div>
        <div class="key" id="key65">A</div>
        <div class="key" id="key83">S</div>
        <div class="key" id="key68">D</div>
        <div class="key" id="key70">F</div>
        <div class="key" id="key71">G</div>
        <div class="key" id="key72">H</div>
        <div class="key" id="key74">J</div>
        <div class="key" id="key75">K</div>
        <div class="key" id="key76">L</div>
        <div class="key" id="key186">;</div>
        <div class="key" id="key222">'</div>
        <div class="key" id="key13" style="width:82px;">Enter</div>
        <div class="key" >  </div>
        <div class="key" >  </div>
        <div class="key" >  </div>
        <div class="key" id="key100">4</div>
        <div class="key" id="key101">5</div>
        <div class="key" id="key102">6</div>
        <div class="key" id="key107">+</div>
  </div>
  <div class="row">
        <div class="key" id="key16"style="width:66px;">Shift</div>
        <div class="key" id="key90">Z</div>
        <div class="key" id="key88">X</div>
        <div class="key" id="key67">C</div>
        <div class="key" id="key86">V</div>
        <div class="key" id="key66">B</div>
        <div class="key" id="key78">N</div>
        <div class="key" id="key77">M</div>
        <div class="key" id="key188">,</div>
        <div class="key" id="key190">.</div>
        <div class="key" id="key191">/</div>
        <div class="key" id="key16"style="width:98px;">Shift</div>
        <div class="key" >  </div>
        <div class="key" id="key38">в†?</div>
        <div class="key" >  </div>
        <div class="key" id="key97">1</div>
        <div class="key" id="key98">2</div>
        <div class="key" id="key99">3</div>
        <div class="key" id="key13">Enter</div>
  </div>
  <div class="row">
        <div class="key" id="key17"style="width:55px;">Ctrl</div>
        <div class="key" id="key91"style="width:55px;">Win</div>
        <div class="key" id="key18"style="width:55px;">Alt</div>
        <div class="key" id="key32"style="width:301px;">Space</div>
        <div class="key" id="key18"style="width:55px;">Alt</div>
        <div class="key" id="key17"style="width:55px;">Ctrl</div>
        <div class="key" id="key37">в†?</div>
        <div class="key" id="key40">в†?</div>
        <div class="key" id="key39">в†?</div>
        <div class="key" id="key48"style="width:82px;">0</div>
        <div class="key" id="key190">.</div>
        <div class="key" id="key13">Enter</div>
  </div>
</div>
<style>
    .keyboard {
      display: block;
      width: auto;
      height: auto;
    }
    .row {
      display: flex;
    }

    .key {
      display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
      width: 40px;
      height: 40px;
      background: #fff0;
      border: 1px solid #fff;
      text-align: center;
      color:#fff;
      font-family: Arial, sans-serif;
      font-size: auto;
border-radius: 10px;
}
#touch-controls-fullscreen{
    z-index:11;
}
#allianceMenu, .gameButton, #storeMenu, #mainMenu, #gameUI{
    z-index:12;
}
</style>
  `;
document.body.prepend(akeyboard);
akeyboard.addEventListener("contextmenu", (event) => {
    event.preventDefault(); // з¦Ѓж­ўеЏійЌµй»ћж“Љзљ„йЃёе–?
});

akeyboard.addEventListener("mousedown", (event) => {
    if (event.button === 0 || event.button === 2) {
        event.preventDefault(); // з¦Ѓж­ўе·¦еЏійЌµй»ћж“Љзљ„й ђиЁ­иЎЊз‚є
    }
});
let Key=[];
document.addEventListener("mousedown", function(e) {
    if(document.getElementById("bkeyboard").style.display == "block"){
        document.getElementById("key"+e.button).style.background="#0005";
    }
});

document.addEventListener('mouseup', function(e) {
    if(document.getElementById("bkeyboard").style.display == "block"){
        document.getElementById("key"+e.button).style.background="#fff0";
    }
});
document.addEventListener("keydown", function(e) {
    if(document.getElementById("bkeyboard").style.display == "block"){
        document.getElementById("key"+e.keyCode).style.background="#0005";
    }
});
document.addEventListener('keyup', function(e) {
    if(document.getElementById("bkeyboard").style.display == "block"){
        document.getElementById("key"+e.keyCode).style.background="#fff0";
    }
});
akeyboard.style.display = 'none';

setInterval(()=>{
    akeyboard.style.display = false ? "block" : "none";
    if(akeyboard.style.display == "block"){
        for (let i = 0; i < document.getElementsByClassName("key").length; i++) {
            document.getElementsByClassName("key")[i].style.border = `1px solid hsla(${deg}, 100%, 50%, 100%)`;
            document.getElementsByClassName("key")[i].style.color = `hsla(${deg}, 100%, 50%, 100%)`;
        }
        colors.unshift(colors.pop());
        deg=(deg+1)%360;
        akeyboard.style.background = `linear-gradient(${deg}deg, ${colors.join(", ")})`;
    }

});
var musics=[
    {
        name: "Henceforth / зµђеџЋгЃ•гЃЏгЃ?(Cover)",
        src: ""
    }
]
let musicmenu = document.createElement('div')
musicmenu.innerHTML="<h1 id='MusicNmae' style='color: #fff;margin: 10px 0 0 10px;font: 40px Hammersmith One;'>Sakuna Mod Music</h1><br>"
musicmenu.innerHTML+=`<div id='musicmenuclose' style="font: 30px 'Hammersmith One';top: 5px;position: absolute;right: 20px;">вњ?</div>`
    for(let i=0;i<musics.length;i++){
        musicmenu.innerHTML+=`
  <h3 style="margin-top:15px;margin-left:2.5%">`+musics[i].name+`</h3>
  <audio style="width: 90%; margin-left: 2.5%; margin-top:10px;" src="`+musics[i].src+`" controls="" loop=""></audio><hr>
  `
    }
musicmenu.style = `
font-size: 20px;
user-select: none;
color: #fff;
display:none;
overflow:auto;
position:absolute;
top:55%;
left:45%;
margin-top:-400px;
margin-left:-350px;
z-index:1000000;
border:0 solid black;
width:800px;
height:600px;
border-radius:10px;
background: rgba(0, 0, 0, 0.8); /* дї®ж”№еђЋзљ„иѓЊж™Ї */
`;
document.body.prepend(musicmenu)
document.getElementById("musicmenuclose").addEventListener("click", (e)=>{
    musicmenu.style.display = 'none';
});
// `socket` and `serverIsOpen` drove the author's telemetry channel and are
// gone with it. Nothing else in the file ever assigned them.
let player, isGet = false;
let deadid = 0, PlayerName = [], playerdeadtime = [];
let chat = {
    list: [],
    time: Date.now(),
}

let PLAYERS = [];
let sends = {
    heal: {
        count: 0,
        max: 50,
    },
    place: {
        count: 0,
        max: 50,
    },
}
let lastPingTime, modping = 0, agmodping = 0, modpinglist = [], chat_ping_Interval, serverDebug = true, users = 0, cdc = 0, webconnection = false;
// `const originalSend = WebSocket.prototype.send` stood here. With the shim
// installed at document-start that captures the shim's trampoline, not the
// native method, and nothing calls it any more -- the bot socket frames
// through EXP.send now. Removed rather than left as a trap.
function getEl(id) {
    return document.getElementById(id);
}
window.oncontextmenu = function () {
    return false;
};


// `unsafeWindow` is undefined under "@grant none", so the original
// `window.config || unsafeWindow.config` threw a ReferenceError any time
// window.config was not set yet. At document-end it always was, so the || 
// short-circuited and nobody noticed; booting earlier made it throw, which
// killed the rest of the boot and left the game running with none of the
// mod on screen.
let config = window.config || (typeof unsafeWindow !== "undefined" ? unsafeWindow.config : undefined);

// CLIENT:
config.clientSendRate = 9; // Aim Packet Send Rate
config.serverUpdateRate = 9;

// UI:
config.deathFadeout = 0;

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
let botSkts = [];

// STORAGE:
let canStore;
if (typeof (Storage) !== "undefined") {
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
let gC = function (a, b) {
    try {
        let res = JSON.parse(getSavedVal(a));
        if (typeof res === "object") {
            return b;
        } else {
            return res;
        }
    } catch (e) {
        return b;
    }
};


function setCommands() {
    return {
        "help": {
            desc: "Show Commands",
            action: function (message) {
                for (let cmds in commands) {
                    addMenuChText("/" + cmds, commands[cmds].desc, "lime", 1);
                }
            }
        },
        "clear": {
            desc: "Clear Chats",
            action: function (message) {
                resetMenuChText();
            }
        },
        "debug": {
            desc: "Debug Mod For Development",
            action: function (message) {
                addDeadPlayer(player);
                addMenuChText("Debug", "Done", "#99ee99", 1);
            }
        },
        "play": {
            desc: "Play Music ( /play [link] )",
            action: function (message) {
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
            action: function (message) {
                window.leave();
            }
        },
    };
}

let commands = setCommands();

// MENU FUNCTIONS:
window.changeMenu = function () { };
window.debug = function () { };
window.toggleNight = function () { };
window.wasdMode = function () { };

// PAGE 1:
window.startGrind = function () { };

// PAGE 3:
window.connectFillBots = function () { };
window.
destroyFillBots = function () { };
window.tryConnectBots = function () { };
window.destroyBots = function () { };
window.resBuild = function () { };
window.toggleBotsCircle = function () { };
window.toggleVisual = function () { };

// SOME FUNCTIONS:
window.prepareUI = function () { };
window.leave = function () { };

// nah hahahahahhh why good ping
//window.ping = goodping ? 86 : 0;
function validateNumberInput(inputElement) {
    const min = parseFloat(inputElement.min);
    const max = parseFloat(inputElement.max);
    let value = parseFloat(inputElement.value);

    if (value < min) {
        inputElement.value = min;
    } else if (value > max) {
        inputElement.value = max;
    }
}

let Save = {
    check: [],
    text: [],
    select: [],
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
        Save.check.push({id: setting.id, checked: setting.checked});
    };
    div(setting) {
        let newText = `<div`;
        setting.id && (newText += ` id = ${setting.id}`);
        setting.style && (newText += ` style = ${setting.style.replaceAll(" ", "")}`);
        setting.class && (newText += ` class = ${setting.class}`);
        newText += `>`;
        setting.text && (newText += `${setting.text}`);
        newText += `</div>`;
        this.add(newText);
    };
    text(setting) {
        let newText = `<input type = "text"`;
        setting.id && (newText += ` id = ${setting.id}`);
        setting.style && (newText += ` style = ${setting.style.replaceAll(" ", "")}`);
        setting.class && (newText += ` class = ${setting.class}`);
        setting.size && (newText += ` size = ${setting.size}`);
        setting.maxLength && (newText += ` maxLength = ${setting.maxLength}`);
        setting.placeHolder && (newText += ` placeHolder = ${setting.placeHolder.replaceAll(" ", "&nbsp;")}`);
        newText += `>`;
        this.add(newText);
        Save.text.push({id: setting.id, value: setting.value});
    };
    textarea(setting) {
        let newText = `<textarea`;
        setting.id && (newText += ` id="${setting.id}"`);
        setting.style && (newText += ` style="${setting.style.replaceAll(" ", "")}"`);
        setting.class && (newText += ` class="${setting.class}"`);
        setting.rows && (newText += ` rows="${setting.rows}"`);
        setting.cols && (newText += ` cols="${setting.cols}"`);
        setting.maxLength && (newText += ` maxLength="${setting.maxLength}"`);
        setting.placeHolder && (newText += ` placeholder="${setting.placeHolder.replaceAll(" ", "&nbsp;")}"`);
        newText += `>`;
        newText += `</textarea>`;
        this.add(newText);
        Save.text.push({id: setting.id, value: setting.value});
    };
    number(setting) {
        let newText = `<input type = "number"`;
        setting.id && (newText += ` id = ${setting.id}`);
        setting.style && (newText += ` style = ${setting.style.replaceAll(" ", "")}`);
        setting.class && (newText += ` class = ${setting.class}`);
        setting.size && (newText += ` size = ${setting.size}`);
        setting.maxLength && (newText += ` maxLength = ${setting.maxLength}`);
        setting.placeHolder && (newText += ` placeHolder = ${setting.placeHolder.replaceAll(" ", "&nbsp;")}`);
        setting.min && (newText += ` min = ${setting.min}`);
        setting.max && (newText += ` max = ${setting.max}`);
        newText += `>`;
        this.add(newText);
        Save.text.push({id: setting.id, value: setting.value});
        setTimeout(()=>{
            getEl(setting.id).addEventListener("keydown", function(e){
                setTimeout(()=>{
                    validateNumberInput(this);
                });
            });
            getEl(setting.id).addEventListener("change", function(e){
                validateNumberInput(this);
            });

        },10);
    };
    select(setting) {
        let newSelect = `<select`;
        if (setting.id) {
            newSelect += ` id="${setting.id}"`;
        }
        if (setting.style) {
            newSelect += ` style="${setting.style}"`;
        }
        if (setting.class) {
            newSelect += ` class="${setting.class}"`;
        }
        newSelect += `>`;
        let select = false;
        if (Array.isArray(setting.option)) {
            setting.option.forEach(option => {
                newSelect += `<option value="${option.id}"`;
                if (option.selected) {
                    select = option.id;
                }
                newSelect += `>${option.name}</option>`;
            });
        }
        newSelect += `</select>`;
        this.add(newSelect);
        Save.select.push({id: setting.id, value: select});
    }
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
        window[setting.id + "Func"] = function () { };
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
            window[options + "Func"] = function () {
                setting.menu[options] = getEl("check_" + options).checked ? true : false;
                saveVal(options, setting.menu[options]);

                getEl("O_" + options).style.color = setting.menu[options] ? "#000" : "#fff";
                getEl("O_" + options).style.background = setting.menu[options] ? "#8ecc51" : "#cc5151";

                //getEl(setting.id).style.color = setting.menu[options] ? "#8ecc51" : "#cc5151";

            };
            this.checkBox({ id: "check_" + options, style: `display: ${i == 0 ? "inline-block" : "none"};`, class: "checkB", onclick: `window.${options + "Func"}()`, checked: setting.menu[options] });
            i++;
        }

        last = "check_" + getEl(setting.id).value.split("_")[1];
        window[setting.id + "Func"] = function () {
            getEl(last).style.display = "none";
            last = "check_" + getEl(setting.id).value.split("_")[1];
            getEl(last).style.display = "inline-block";

            getEl(setting.id).style.color = setting.menu[last.split("_")[1]] ? "#8ecc51" : "#fff";

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

let HTML = new Html();




let menuChatDiv = document.createElement("div");
menuChatDiv.id = "menuChatDiv";
document.body.appendChild(menuChatDiv);

let MenuNameText = `Sakuna Mod v44.5`;
let NameCount = 0;
let NameReverse = false;
let ModNL = MenuNameText.length;
getEl("MusicNmae").textContent = MenuNameText;

let openMenu = false;

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
    lastTick: Date.now()
};
let modConsole = [];

let dontSend = false;
let fpsTimer = {
    last: 0,
    time: 0,
    ltime: 0
}
let AssassinTime = Date.now();
let lastMoveDir = undefined;
let lastsp = ["cc", 1, "__proto__"];
let cansend = "sdsadad";
let stacktext = {};
function Text(text, color, hit, x, y){
    if(player.alive && getEl("showtext").checked){
        textManager.showText(player.x + (x||0), player.y + (y||0) + (hit? 100 : 0), 35, hit ? -0.1 : 0.1, 500, text, color);
        /* new Promise((resolve, reject) => {
            resolve({
                text: text,
            });
        }).then((e) => {
            if(!stacktext[color])stacktext[color] = [];
                stacktext[color].push(e.text);
            console.log(stacktext)
                setTimeout(() => {
                    if (stacktext[color].length > 0) {
                        textManager.showText(player.x + (x||0), player.y + (y||0) + (hit? 100 : 0), 35, hit ? -0.1 : 0.1, 500, stacktext[color].join(", "), color);
                        stacktext[color] = [];
                    }
                }, 10);
        });*/
    }
}
localStorage.setItem('ВЉГ„ВљВ’Г©ГљJГ¦', 'ВЉГ„ВљВ’Г©ГљJГ¦');
let sendpingtime = Date.now();
let isPingSend = false;
let gather = 0;
let startTime = 0;
// `dontSend` is the file's own flag, declared further up; the rules set it.
function applyOutgoing(type, data) {
    dontSend = false;
    if (secPacket > 120) {
        Text("Anti Kick", "#f00", 1);
        return false;
    }

            if (type == "6") {
                if (data[0]) {
                    // ANTI PROFANITY:
                    let profanity = ["cunt", "whore", "fuck", "shit", "faggot", "nigger", "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex", "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune", "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard",];
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
            } else if (type == code.move) {
                if (data[1]) {
                    if(getEl("movementassist").checked && data[0]){
                        let move = {
                            x: player.x2 + Math.cos(data[0]) * (player.scale + player.speed),
                            y: player.y2 + Math.sin(data[0]) * (player.scale + player.speed),
                        }
                        let hasNearSpikes = newGameObjects.filter(tmp => ((tmp.type == 1 && tmp.y >= config.mapScale - config.snowBiomeTop && getEl("movementassistcactus").checked) || (tmp.dmg && tmp.active && !tmp.isTeamObject(player))) && UTILS.getDist(tmp, move, 0,0) <= (player.scale + tmp.getScale()));
                        if(hasNearSpikes.length > 0) {
                            walkaim = null
                            data[0] = walkaim;
                            Text("Stop", "#ff0");
                        }
                    }
                    AssassinTime = Date.now();
                    player.moveDir = data[0];
                } else {
                    dontSend = true;
                }
            } else if (type == "M") {
                /*      // APPLY CYAN COLOR:
                            data[0].name = data[0].name == "" ? "unknown" : data[0].name;
                            data[0].moofoll = true;
                            data[0].skin = data[0].skin == 10 ? "__proto__" : data[0].skin;
                            lastsp = [data[0].name, data[0].moofoll, data[0].skin];*/
            } else if (type == code.ping) {
                if(isPingSend){
                    isPingSend = false;
                    lastPing = Date.now()
                } else {
                    dontSend = true;
                }
            } else if (type == code.gather) {
                gather = (gather + 1 ) % 2;
            } else if (type == code.aim) {
                if(my.lastDir == data[0]){
                    dontSend = true;
                }else {
                    my.lastDir = data[0];
                }
            } else if (type == code.attack) {
                my.lastDir = data[1];
            }
    if (dontSend) return false;
    if (!(type == sendList || ![code.attack, code.gather, code.move, code.aim, code.chat, code.ping].includes(type))) return false;
    secPacket++;
    sendList = null;
    return { type: type, data: data };
}

EXP.setHandler(function (message) {
    if (!WS) {
        startTime = Date.now();
        setInterval(() => {
            secPacket = 0;
        }, 1e3);
        game.lastTick = performance.now();
        WS = this;
        WS.addEventListener("message", function (msg) {
            getMessage(msg);
        });
        WS.addEventListener("close", (event) => {
            window.onbeforeunload = null;
            window.location.reload();
            WS = undefined;
        });
        isPingSend = true;
        packet(code.ping);
    }
    if (WS != this) {
        EXP.nativeSend.call(this, message);
        return;
    }
    // Unframe: drops the MAC and turns the numeric opcode back into the
    // string name the rest of this client is written against.
    const parsed = EXP.unframe(this, message);
    if (!parsed) return EXP.nativeSend.call(this, message);
    const outgoing = applyOutgoing(parsed.type, parsed.args);
    if (outgoing) EXP.send(this, outgoing.type, outgoing.data);
});

let sendList = null;
function packet(type) {
    try {
        let data = Array.prototype.slice.call(arguments, 1);
        sendList = type;
        const outgoing = applyOutgoing(type, data);
        if (outgoing && WS) EXP.send(WS, outgoing.type, outgoing.data);
    } catch (e) { console.log(`err:${e}`); }
}
window.leave = function () {
};

let io = {
    send: packet
};
function Spawn(){
    getEl("gameUI").style.display = "block";
    mainMenu.style.display = "none";
    packet(code.spawn, {
        name: getEl("nameInput").value,
        moofoll: true,
        skin: 0
    })
}
let token;

// The old code clicked #altcha_checkbox, an element the page no longer has,
// and stored tokens through GM_getValue / GM_setValue -- which are undefined
// under "@grant none", so those lines threw. Turnstile decides for itself
// whether a click is needed; the shim puts the widget on screen either way.
function rememberToken(t) {
    try {
        const list = JSON.parse(localStorage.getItem("sakuna_tokenlist") || "[]");
        if (!list.includes(t)) {
            list.push(t);
            localStorage.setItem("sakuna_tokenlist", JSON.stringify(list.slice(-20)));
        }
    } catch (e) {}
}

window.addEventListener("load", () => {
    const enter = document.getElementById("enterGame");
    if (enter) enter.innerText = "Generating Token";
    EXP.freshToken().then(function (t) {
        token = t;
        if (t) rememberToken(t);
        if (enter) enter.innerText = t ? "Enter Game" : "Verification failed";
    }).catch(function () {
        if (enter) enter.innerText = "Verification failed";
    });
});
let server = null;
fetch(`https://api${config.isSandbox ? "-sandbox" : ""}.moomoo.io/servers?v=1.26`).then(e => e.json()).then(async e => {
    const search = window.location.search.split("=")[1].split(":");
    server = e.find(item => item.region === search[0] && item.name === search[1]);
}).catch(e => {
    console.error("Failed to load server data with status code:", e)
});
let bot = [];
let isConnectBots = false;
let ConnectBotType = "none";
// дї®ж”№ connectBots е‡Ѕж•ё
async function connectBots() {
    if(isConnectBots){
        for(let i = 0; i < 100; i ++){
            if(isConnectBots){
                // EXP.freshToken() already hands back a full "cf:<token>";
                // the old "alt:" prefix is an ALTCHA token the server rejects.
                const botToken = await EXP.freshToken();
                if (!botToken) { console.warn("[sakuna] no captcha token, bot not connected"); break; }
                const ws = new WebSocket(`wss://${server.key}.${server.region}.moomoo.io/?token=${encodeURIComponent(botToken)}`);
                ws.binaryType = "arraybuffer";

                ws.onopen = async () => {
                    ConnectBotType = "open";
                    bot.push(ws);
                    console.log("Bot spwan:", bot.length);
                    ws.open = true;
                    await new Promise(r => setTimeout(r, 111));
                    if(isConnectBots){
                        ws.spwan();
                    } else {
                        ws.close();
                    }
                }
                ws.onerror = () => {
                    ws.open = false;
                    bot = bot.filter(item => item !== ws);
                    console.log("Bot error");
                    ConnectBotType = " none";
                };
                ws.onclose = () => {
                    ws.open = false;
                    bot = bot.filter(item => item !== ws);
                    console.log("Bot disconnected");
                    ConnectBotType = " none";
                };
                // Each bot negotiates its own io-init, so it carries its own
                // key, tables and sequence counter. EXP keeps them per socket.
                ws.emit = (type, ...args) => {
                    EXP.send(ws, type, args);
                };

                ws.spwan = () => {
                    ws.emit("M", {
                        name: "brww",
                        moofoll: true,
                        skin: 0
                    });

                }

                ws.selectToBuild = (index, wpn) => {
                    ws.emit(code.select, index, wpn);
                }

                ws.selectWeapon = (index, isPlace) => {
                    if (!isPlace) {
                        player.weaponCode = index;
                    }
                    ws.emit(code.select, index, 1);
                }

                ws.sendAutoGather = () => {
                    ws.emit(code.gather, 1);
                }

                ws.sendAtck = (id, angle) => {
                    ws.emit(code.attack, id, angle);
                }
                ws.place = (id, rad) => {
                    try {
                        if (id != undefined) {
                            ws.selectToBuild(ws.player.items[id]);
                            ws.sendAtck(1, rad);
                            ws.selectWeapon(ws.player.weaponCode, 1);
                        }
                    } catch (e) { }
                }
                ws.HealTime = Date.now();
                ws.heal = () => {
                    let amount = ws.player.health / items.list[ws.player.items[0]].healing;
                    for (let i = 0; i < amount; i++) {
                        ws.place(0, 0);
                    }

                }
                ws.onmessage = (message) => {
                    const parsed = EXP.receive(ws, message.data);
                    if (!parsed) return;
                    let type = parsed.type;
                    let data = parsed.args;

                    // дЅїз”Ё if-else ж›їд»Ј switch
                    if (type === 'A') { // setInitData (id)
                        // е€ќе§‹еЊ–ж•°жЌ®йЂ»иѕ‘

                    } else if (type === 'B') { // disconnect
                        // ж–­ејЂиїћжЋҐйЂ»иѕ‘

                    } else if (type === 'C') { // setupGame (1)
                        // жёёж€Џи®ѕзЅ®йЂ»иѕ‘
                        ws.sid = data[0];
                    } else if (type === 'D') { // addPlayer (2)
                        // ж·»еЉ зЋ©е®¶йЂ»иѕ‘
                        const Data = data[0], isYou = data[1];
                        let tmpPlayer = findPlayerByID(Data[0]);
                        if (!tmpPlayer) {
                            tmpPlayer = new Player(Data[0], Data[1], config, UTILS, projectileManager,
                                                   objectManager, players, ais, items, hats, accessories);
                            players.push(tmpPlayer);
                        }
                        let name = (Data[2] != "" ? Data[2] : "unknown");
                        if(!PlayerName[Data[1]]){
                            addMenuChText("Game", `Found {${Data[1]}}${name}`, "yellow");
                        } else if(PlayerName[Data[1]] != name){
                            addMenuChText("Game", `Change {${Data[1]}}${PlayerName[Data[1]]} to {${Data[1]}}${name}`, "yellow");
                        }
                        PlayerName[Data[1]] = name;
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
                        tmpPlayer.setData(Data);
                        if (isYou) {
                            ws.player = tmpPlayer;
                        }
                    } else if (type === 'E') { // removePlayer (4)
                        // з§»й™¤зЋ©е®¶йЂ»иѕ‘

                    } else if (type === 'a') { // updatePlayers (33)
                        // ж›ґж–°зЋ©е®¶зЉ¶жЂЃйЂ»иѕ‘

                    } else if (type === 'G') { // updateLeaderboard (5)
                        // ж›ґж–°жЋ’иЎЊж¦њйЂ»иѕ‘

                    } else if (type === 'H') { // loadGameObject (6)
                        // еЉ иЅЅжёёж€Џз‰©д»¶йЂ»иѕ‘
                    } else if (type === 'I') { // loadAI (a)
                        // еЉ иЅЅAIйЂ»иѕ‘

                    } else if (type === 'J') { // animateAI (aa)
                        // AIеЉЁз”»йЂ»иѕ‘

                    } else if (type === 'K') { // gatherAnimation (7)
                        // й‡‡й›†еЉЁз”»йЂ»иѕ‘

                    } else if (type === 'L') { // wiggleGameObject (8)
                        // з‰©д»¶ж™ѓеЉЁйЂ»иѕ‘

                    } else if (type === 'M') { // shootTurret (sp)
                        // з‚®еЎ”е°„е‡»йЂ»иѕ‘

                    } else if (type === 'N') { // updatePlayerValue (9)
                        // ж›ґж–°зЋ©е®¶ж•°еЂјйЂ»иѕ‘

                    } else if (type === 'O') { // updateHealth (h)
                        const sid = data[0], value = data[1];
                        if(sid == ws.player.sid){
                            if(getEl("lowheal").checked && value <= (ws.player.skinIndex === 6 ? 23 : 30) && ws.player.shameCount < 6 && Date.now() - ws.LowHealTime > 60){
                                ws.LowHealTime = Date.now();
                                ws.heal();
                            }
                        }
                    } else if (type === 'P') { // killPlayer (11)
                        // зЋ©е®¶ж­»дєЎй‡Ќз”џйЂ»иѕ‘
                        ws.spwan();

                    } else if (type === 'Q') { // killObject (12)
                        // й”ЂжЇЃз‰©д»¶йЂ»иѕ‘

                    } else if (type === 'R') { // killObjects (13)
                        // ж‰№й‡Џй”ЂжЇЃз‰©д»¶йЂ»иѕ‘

                    } else if (type === 'S') { // updateItemCounts (14)
                        // ж›ґж–°з‰©е“Ѓж•°й‡ЏйЂ»иѕ‘

                    } else if (type === 'T') { // updateAge (15)
                        // ж›ґж–°е№ґйѕ„йЂ»иѕ‘

                    } else if (type === 'U') { // updateUpgrades (16)
                        // ж›ґж–°еЌ‡зє§зЉ¶жЂЃйЂ»иѕ‘

                    } else if (type === 'V') { // updateItems (17)
                        // ж›ґж–°з‰©е“Ѓж ЏйЂ»иѕ‘

                    } else if (type === 'X') { // addProjectile (18)
                        // ж·»еЉ жЉ•е°„з‰©йЂ»иѕ‘

                    } else if (type === 'Y') { // remProjectile (19)
                        // з§»й™¤жЉ•е°„з‰©йЂ»иѕ‘

                    } else if (type === 'g') { // addAlliance (0)
                        // ж–°еўћиЃ”з›џйЂ»иѕ‘

                    } else if (type === '1') { // deleteAlliance
                        // е€ й™¤иЃ”з›џйЂ»иѕ‘

                    } else if (type === '2') { // allianceNotification (an)
                        // иЃ”з›џйЂљзџҐйЂ»иѕ‘

                    } else if (type === '3') { // setPlayerTeam (st)
                        // и®ѕзЅ®зЋ©е®¶йџдјЌйЂ»иѕ‘

                    } else if (type === '4') { // setAlliancePlayers (sa)
                        // и®ѕзЅ®иЃ”з›џж€ђе‘йЂ»иѕ‘

                    } else if (type === '5') { // updateStoreItems (us)
                        // ж›ґж–°е•†еє—з‰©е“ЃйЂ»иѕ‘

                    } else if (type === '6') { // receiveChat (ch)
                        // жЋҐж”¶иЃЉе¤©и®ЇжЃЇйЂ»иѕ‘

                    } else if (type === '7') { // updateMinimap (mm)
                        // ж›ґж–°е°Џењ°е›ѕйЂ»иѕ‘

                    } else if (type === '8') { // showText (t)
                        // жѕз¤єж–‡е­—йЂ»иѕ‘

                    } else if (type === '9') { // pingMap (p)
                        // ењ°е›ѕж ‡и®°йЂ»иѕ‘

                    } else if (type === '0') { // pingSocketResponse
                        // иїћзєїзЉ¶жЂЃе›ћеє”йЂ»иѕ‘

                    }
                };
                await new Promise(r => setTimeout(r, 300));
            }
        }
    } else {
        bot.forEach(e => {
            e.close();
        });
    }
}
function getMessage(message) {
    // Maps the numeric opcode back to the string name this client uses.
    let parsed = EXP.receive(message.target || WS, message.data);
    if (!parsed) return;
    let type = parsed.type;
    let data = parsed.args;
    let events = {
        A: setInitData, // id: setInitData,
        B: disconnect,
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
        g: addAlliance,
        1: deleteAlliance,
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
    isGet = true;

}

function disconnect(e){
    window.onbeforeunload = null;
    window.location.reload(true)
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
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
};

// GLOBAL VALUES:

let petals = [];
let allChats = [];

let ais = [];
let players = [];
let alliances = [];
let alliancePlayers = [];
let allianceNotifications = [];
let gameObjects = [];
let newGameObjects = [];
let projectiles = [];
let deadPlayers = [];

let breakObjects = [];

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
    rotate: 0,
    reSync: false,
    bullTick: 0,
    BTC: 0,
    anti0Tick: 0,
    antiSync: false,
    weapon: 0,
    safePrimary: function (tmpObj) {
        return [0, 8].includes(tmpObj.primaryIndex);
    },
    safeSecondary: function (tmpObj) {
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

// Five page elements torn down without a null check. The ad card, the promo
// image and the Google Ad Manager slot are absent whenever ads are blocked --
// which, for anyone running a userscript, is most of the time -- and
// #chatButton and #gameName have moved on too. The first null threw right
// here and everything after it in the boot never ran, so the game came up
// with none of the mod on screen. Each one is guarded now.
let gameName = getEl("gameName");
if (gameName) gameName.innerText = "";
let adCard = getEl("adCard");
if (adCard) adCard.remove();
let promoImageHolder = getEl("promoImgHolder");
if (promoImageHolder) promoImageHolder.remove();
let adBanner = document.getElementById("/21823819281/frvr-frvr-moomoo-display-banner-frvr_moomoo_728x90");
if (adBanner) adBanner.remove();
let chatButton = getEl("chatButton");
if (chatButton) chatButton.remove();
let gameCanvas = getEl("gameCanvas");
let mainContext = gameCanvas.getContext("2d");
let stream;
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
var allianceMenu = getEl("allianceMenu");
var allianceHolder = getEl("allianceHolder");
var allianceManager = getEl("allianceManager");
var noticationDisplay = getEl("noticationDisplay");
let mainMenu = getEl("mainMenu");
let diedText = getEl("diedText");
let screenWidth;
let screenHeight;
config.maxScreenHeight = 1620;
config.maxScreenWidth = 2970;
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
let lockdir = 0;
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
    39: [1, 0],
};
let attackState = 0;
let inGame = false;

let macro = {};
let mills = {
    x: undefined,
    y: undefined,
    size: function(size) {
        return size * 1.45;
    },
    dist: function(size) {
        return size * 1.8;
    },
    place: false,
    count: 0,
};
let lastDir, lastmove;

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
                x: type1 == 99 ? tmp1.pingX : type1 == 0 ? tmp1.x : type1 == 1 ? tmp1.x1 : type1 == 2 ? tmp1.x2 : type1 == 3 && tmp1.x3,
                y: type1 == 99 ? tmp1.pingY : type1 == 0 ? tmp1.y : type1 == 1 ? tmp1.y1 : type1 == 2 ? tmp1.y2 : type1 == 3 && tmp1.y3,
            };
            let tmpXY2 = {
                x: type2 == 99 ? tmp2.pingX : type2 == 0 ? tmp2.x : type2 == 1 ? tmp2.x1 : type2 == 2 ? tmp2.x2 : type2 == 3 && tmp2.x3,
                y: type2 == 99 ? tmp2.pingY : type2 == 0 ? tmp2.y : type2 == 1 ? tmp2.y1 : type2 == 2 ? tmp2.y2 : type2 == 3 && tmp2.y3,
            };
            return mathSQRT((tmpXY2.x -= tmpXY1.x) * tmpXY2.x + (tmpXY2.y -= tmpXY1.y) * tmpXY2.y);
        };
        this.getDirection = function (x1, y1, x2, y2) {
            return mathATAN2(y1 - y2, x1 - x2);
        };
        this.getDirect = function (tmp1, tmp2, type1, type2) {
            let tmpXY1 = {
                x: type1 == 99 ? tmp1.pingX : type1 == 0 ? tmp1.x : type1 == 1 ? tmp1.x1 : type1 == 2 ? tmp1.x2 : type1 == 3 && tmp1.x3,
                y: type1 == 99 ? tmp1.pingY : type1 == 0 ? tmp1.y : type1 == 1 ? tmp1.y1 : type1 == 2 ? tmp1.y2 : type1 == 3 && tmp1.y3,
            };
            let tmpXY2 = {
                x: type2 == 99 ? tmp2.pingX : type2 == 0 ? tmp2.x : type2 == 1 ? tmp2.x1 : type2 == 2 ? tmp2.x2 : type2 == 3 && tmp2.x3,
                y: type2 == 99 ? tmp2.pingY : type2 == 0 ? tmp2.y : type2 == 1 ? tmp2.y1 : type2 == 2 ? tmp2.y2 : type2 == 3 && tmp2.y3,
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
                { num: 1e3, string: "k" },
                { num: 1e6, string: "m" },
                { num: 1e9, string: "b" },
                { num: 1e12, string: "q" }
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
        this.hexToRgb = function (hex) {
            return hex.slice(1).match(/.{1,2}/g).map(g => parseInt(g, 16));
        };
        this.getRgb = function (r, g, b) {
            return [r / 255, g / 255, b / 255].join(", ");
        };
    }
};
class Animtext {
    // ANIMATED TEXT:
    constructor() {
        // INIT:
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

        // UPDATE:
        this.update = function (delta) {
            if (this.life) {
                this.life -= delta;
                if (config.anotherVisual) {
                    this.y -= this.speed * delta * this.acc;
                    this.acc -= delta / (this.maxLife / 2.5);
                    if (this.life <= 200) {
                        if (this.alpha > 0) {
                            this.alpha = Math.max(0, this.alpha - (delta / 300));
                        }
                    } else {
                        if (this.alpha < 1) {
                            this.alpha = Math.min(1, this.alpha + (delta / 100));
                        }
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

        // RENDER:
        this.render = function (ctxt, xOff, yOff) {
            ctxt.lineWidth = 10;
            ctxt.fillStyle = this.color;
            ctxt.font = this.scale + "px Hammersmith One";
            ctxt.globalAlpha = 1;
            ctxt.strokeStyle = "#000";
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
            this.shootReload = 2200 - (1000 / 9) * 2;
            this.shootted = 0;
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
            this.buildHealth = data.health;
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
            this.nearBreakType = false;
            this.nearBreak = false;
            this.nearBreakAim = undefined;
            this.nearBreakbuild = null;
            this.strokeStyle = outlineColor;
            this.lastStrokeStyle = outlineColor;
            this.ce = () => {
                try{
                    return this.owner.sid && !this.isTeamObject(player);
                } catch(e){}
                return false;
            }
            this.cp = () => {
                try{
                    return this.owner.sid && this.owner.sid === player.sid;
                } catch(e){}
                return false;
            }
            this.isEnemy = this.ce();
            this.isPlayer = this.cp();
            this.alpha = data.alpha || 1;
            this.maxAlpha = data.alpha || 1;
            this.damaged = 0;
        };

        // GET HIT:
        this.changeHealth = function (amount, doer) {
            this.health += amount;
            return (this.health <= 0);
        };

        // GET SCALE:
        this.getScale = function (sM, ig) {
            sM = sM || 1;
            return this.scale * (this.isItem || this.type == 2 || this.type == 3 || this.type == 4 ? 1 : 0.6 * sM) * (ig ? 1 : this.colDiv);
        };
        this.GS = function () {
            return this.scale * ((this.isItem || this.type == 2 || this.type == 3 || this.type == 4) ? 1 : 0.6) * this.colDiv + (((this.type == 1 && this.y >= config.mapScale - config.snowBiomeTop) || this.teleport || (this.isEnemy && (this.trap || this.dmg))) ? 35 + player.maxSpeed/1.5 : 0);
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
                if (config.anotherVisual) {
                    let d2 = UTILS.getAngleDist(this.lastDir, this.dir);
                    if (d2 > 0.01) {
                        this.dir += d2 / 5;
                    } else {
                        this.dir = this.lastDir;
                    }
                } else {
                    if (this.turnSpeed && this.dmg) {
                        this.dir += this.turnSpeed * delta;
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
            try{
                let tmp = findPlayerBySID(this.owner.sid);
                return (tmp == tmpObj || (tmpObj.team && tmp.team && tmp.team == tmpObj.team));
            }catch(e){}
            return null;
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
            platformHit: true,
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
            platformHit: true,
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
            platformHit: true,
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
            platformHit: true,
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
            platformHit: true,
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
            platformHit: true,
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
            platformHit: true,
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
            platformHit: true,
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
            platformHit: true,
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
            platformHit: true,
            trap: true,
            ignoreCollision: true,
            hideFromEnemy: true,
            canwalk: true,
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
            platformHit: true,
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
            platformHit: true,
            ignoreCollision: true,
            canwalk: true,
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
            platformHit: true,
            ignoreCollision: true,
            canwalk: true,
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
            platformHit: true,
            health: 400,
            ignoreCollision: true,
            canwalk: true,
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
            platformHit: true,
            ignoreCollision: true,
            canwalk: true,
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
            platformHit: true,
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
            index: function (id, myItems) {
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
            if (config.anotherVisual) {
            } else {
                obj.alive = false;
            }
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
        this.checkItemLocation = function (x, y, s, sM, indx, ignoreWater, placer) {
            let cantPlace = newGameObjects.find((tmp) => tmp.active && UTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
            if (cantPlace) return false;
            if (!ignoreWater && indx != 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) return false;
            return true;
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
                        this.active = false;
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
                tmpProj.time = Date.now();
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
            weightM: .8,
            speed: 95e-5,
            turnSpeed: .001,
            scale: 72,
            drop: ["food", 50]
        }, {
            id: 1,
            src: "pig_1",
            killScore: 200,
            health: 800,
            weightM: .6,
            speed: 85e-5,
            turnSpeed: .001,
            scale: 72,
            drop: ["food", 80]
        }, {
            id: 2,
            name: "Bull",
            src: "bull_2",
            hostile: !0,
            dmg: 20,
            killScore: 1e3,
            health: 1800,
            weightM: .5,
            speed: 94e-5,
            turnSpeed: 74e-5,
            scale: 78,
            viewRange: 800,
            chargePlayer: !0,
            drop: ["food", 100]
        }, {
            id: 3,
            name: "Bully",
            src: "bull_1",
            hostile: !0,
            dmg: 20,
            killScore: 2e3,
            health: 2800,
            weightM: .45,
            speed: .001,
            turnSpeed: 8e-4,
            scale: 90,
            viewRange: 900,
            chargePlayer: !0,
            drop: ["food", 400]
        }, {
            id: 4,
            name: "Wolf",
            src: "wolf_1",
            hostile: !0,
            dmg: 8,
            killScore: 500,
            health: 300,
            weightM: .45,
            speed: .001,
            turnSpeed: .002,
            scale: 84,
            viewRange: 800,
            chargePlayer: !0,
            drop: ["food", 200]
        }, {
            id: 5,
            name: "Quack",
            src: "chicken_1",
            killScore: 2e3,
            noTrap: !0,
            health: 300,
            weightM: .2,
            speed: .0018,
            turnSpeed: .006,
            scale: 70,
            drop: ["food", 100]
        }, {
            id: 6,
            name: "MOOSTAFA",
            nameScale: 50,
            src: "enemy",
            hostile: !0,
            dontRun: !0,
            fixedSpawn: !0,
            spawnDelay: 6e4,
            noTrap: !0,
            colDmg: 100,
            dmg: 40,
            killScore: 8e3,
            health: 18e3,
            weightM: .4,
            speed: 7e-4,
            turnSpeed: .01,
            scale: 80,
            spriteMlt: 1.8,
            leapForce: .9,
            viewRange: 1e3,
            hitRange: 210,
            hitDelay: 1e3,
            chargePlayer: !0,
            drop: ["food", 100]
        }, {
            id: 7,
            name: "Treasure",
            hostile: !0,
            nameScale: 35,
            src: "crate_1",
            fixedSpawn: !0,
            spawnDelay: 12e4,
            colDmg: 200,
            killScore: 5e3,
            health: 2e4,
            weightM: .1,
            speed: 0,
            turnSpeed: 0,
            scale: 70,
            spriteMlt: 1
        }, {
            id: 8,
            name: "MOOFIE",
            src: "wolf_2",
            hostile: !0,
            fixedSpawn: !0,
            dontRun: !0,
            hitScare: 4,
            spawnDelay: 3e4,
            noTrap: !0,
            nameScale: 35,
            dmg: 10,
            colDmg: 100,
            killScore: 3e3,
            health: 7e3,
            weightM: .45,
            speed: .0015,
            turnSpeed: .002,
            scale: 90,
            viewRange: 800,
            chargePlayer: !0,
            drop: ["food", 1e3]
        }, {
            id: 9,
            name: "рџ’ЂMOOFIE",
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
            name: "рџ’ЂWolf",
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
            name: "рџ’ЂBully",
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
            try{
                this.x = x;
                this.y = y;
                this.startX = x;//data.fixedSpawn ? x : null;
                this.startY = y;//data.fixedSpawn ? y : null;
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
            }catch(e){}
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
        this.spawn = function (moofoll) {
            this.attacked = false;
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
            this.shootDmg = 0;
            this.maxShame = 0;
            this.ShameList = {
                1: 0,
                2: 0,
                3: 0,
                4: 0,
                5: 0,
                6: 0,
                7: 0,
            };
            this.instaShamerotate = 0;
            this.showShame = 0;
            this.showShamerotate = 0;
            this.addmaxShameTime = Date.now();
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
            this.antiShame = 3;
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
        this.getItemType = function(age) {
            for (let i = 0; i < this.items.length; i++) {
                if (items.list[this.items[i]].age === age) {
                    return i;
                }
            }
            return 0;
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

        // UPDATE POISON TICK:
        this.updateTimer = function () {

            this.bullTimer -= 1;
            if (this.bullTimer <= 0) {
                this.setBullTick = false;
                //      this.bullTick = game.tick - 1;
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
            if (this.active) {

                // MOVE:

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
        this.startAnim = function (didHit, index) {
            this.animTime = this.animSpeed = items.weapons[index].speed;
            this.targetAngle = (didHit ? -config.hitAngle : -Math.PI);
            tmpRatio = 0;
            animIndex = 0;
        };

        // CAN SEE:
        this.canSee = function (other) {
            if (!other) return false;
            let dx = Math.abs(other.x - this.x) - other.scale;
            let dy = Math.abs(other.y - this.y) - other.scale;
            return dx <= (config.maxScreenWidth / 2) * 1.3 && dy <= (config.maxScreenHeight / 2) * 1.3;
        };

        // SHAME SYSTEM:
        this.judgeShame = function () {
            if (this.oldHealth < this.health) {
                if (this.hitTime) {
                    let timeSinceHit = game.tick - this.hitTime;
                    this.lastHit = game.tick;
                    this.hitTime = 0;
                    if (timeSinceHit < 2) {
                        this.shameCount++;
                        this.MaxshameCount = Math.max(this.MaxshameCount, this.shameCount);
                    } else {
                        this.shameCount = Math.max(0, this.shameCount - 2);
                    }
                }
            } else if (this.oldHealth > this.health) {
                this.hitTime = game.tick;
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
    packet(code.upgrade, index);
}

function storeEquip(id, index) {
    packet(code.store, 0, id, index);
}

function storeBuy(id, index) {
    packet(code.store, 1, id, index);
}
let antist = Date.now();
function checkAntiSpikeTick(){
    if(near.dist2 <= 180 && getEl("antispiketick").checked){
        if(emySpikeHit && !player.inTrap) return false;
        let val = 0;
        try{
            let pV = 1;
            pV = player.primaryVariant != undefined ? config.weaponVariants[player.primaryVariant].val : 1;
            let dmg = items.weapons[player.primaryIndex].dmg * pV * (items.weapons[player.primaryIndex].sDmg || 1) * 3.3;
            if(dmg > val){
                val = dmg;
            }
        }catch(e){}
        try{
            let sV = 1;
            sV = player.secondaryVariant != undefined ? config.weaponVariants[player.secondaryVariant].val : 1;
            let dmg = items.weapons[player.secondaryIndex].dmg * sV * (items.weapons[player.secondaryIndex].sDmg || 1) * 3.3;
            if(dmg > val){
                val = dmg;
            }
        }catch(e){}
        enemy.forEach((tmpObj)=>{
            if(tmpObj.dist2 <= 180){
                try{
                    let pV = 1;
                    pV = tmpObj.primaryVariant != undefined ? config.weaponVariants[tmpObj.primaryVariant].val : 1;
                    let dmg = items.weapons[tmpObj.primaryIndex].dmg * pV * (items.weapons[tmpObj.primaryIndex].sDmg || 1) * 3.3;
                    if(dmg > val){
                        val = dmg;
                    }
                }catch(e){}
                try{
                    if(tmpObj.secondaryIndex == 10){
                        let sV = 1;
                        sV = tmpObj.secondaryVariant != undefined ? config.weaponVariants[tmpObj.secondaryVariant].val : 1;
                        let dmg = items.weapons[tmpObj.secondaryIndex].dmg * sV * (items.weapons[tmpObj.secondaryIndex].sDmg || 1) * 3.3;
                        if(dmg > val){
                            val = dmg;
                        }
                    }
                }catch(e){}
                try{
                    let item = items.list[player.items[4]];
                    let tmpS = player.scale + item.scale + (item.placeOffset || 0);
                    let obj = gameObjects;
                    gameObjects.filter(tmp => tmp != player.inTrap);
                    const angles = Array.from({ length: 45 }, (_, i) => ({
                        positive: (tmpObj.aim2 + toRad(180)) + toRad(i * 5),
                        negative: (tmpObj.aim2 + toRad(180)) - toRad(i * 5)
                    }));

                    for (let { positive, negative } of angles) {
                        for (let angle of [positive, negative]) {
                            let tmpX = tmpObj.x2 + tmpS * Math.cos(angle);
                            let tmpY = tmpObj.y2 + tmpS * Math.sin(angle);
                            if(Math.hypot(player.y2 - tmpY, player.x2 - tmpX) <= (item.scale + player.scale) && objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, item.zIndex, player)){
                                if((tmpObj.primaryIndex == 5 || tmpObj.primaryIndex == 4 || !tmpObj.primaryIndex) && tmpObj.reloads[tmpObj.primaryIndex] <= 0){
                                    //         PrioritySoldier = Date.now();
                                    //            onlySoldier = Date.now();
                                    antist = Date.now();
                                }

                            }
                        }
                    }
                    gameObjects = obj;
                }catch(e){}
            }
        });
    }
    if(Date.now() - antist < 200){
        return false;
    }
    return true;
}
let onlySoldier = Date.now(), onlySoldierTime = 120, PrioritySoldier = Date.now(), onlyEmp = Date.now();
let UseHatid = 0,UseAccid = 0;
function UseHat(id) {
    let nID = player.skins[6] ? 6 : 0;
    UseHatid = id;
    if (player.alive && inGame) {
        if (player.skins[id]) {
            if (player.latestSkin != id) {
                packet(code.store, 0, id, 0);
            }
        } else {
            if (getEl("autobuyequip").checked && canbuyequip) {
                let find = findID(hats, id);
                if (find) {
                    if (player.points >= find.price) {
                        packet(code.store, 1, id, 0);
                        packet(code.store, 0, id, 0);
                    } else {
                        if (player.latestSkin != nID) {
                            packet(code.store, 0, nID, 0);
                        }
                    }
                } else {
                    if (player.latestSkin != nID) {
                        packet(code.store, 0, nID, 0);
                    }
                }
            } else {
                if (player.latestSkin != nID) {
                    packet(code.store, 0, nID, 0);
                }
            }
        }
    }
}

function UseAcc(id) {
    UseAccid = id;
    if (player.alive && inGame) {
        if (player.tails[id]) {
            if (player.tailIndex != id) {
                packet(code.store, 0, id, 1);
            }
        } else {
            if (getEl("autobuyequip").checked && canbuyequip) {
                let find = findID(accessories, id);
                if (find) {
                    if (player.points >= find.price) {
                        packet(code.store, 1, id, 1);
                        packet(code.store, 0, id, 1);
                    } else {
                        if (player.tailIndex != 0) {
                            packet(code.store, 0, 0, 1);
                        }
                    }
                } else {
                    if (player.tailIndex != 0) {
                        packet(code.store, 0, 0, 1);
                    }
                }
            } else {
                if (player.tailIndex != 0) {
                    packet(code.store, 0, 0, 1);
                }
            }
        }
    }
}

function selectToBuild(index, wpn) {
    packet(code.select, index, wpn);
}

function selectWeapon(index, isPlace) {
    if (!isPlace) {
        player.weaponCode = index;
    }
    if(caninsta){
        packet(code.select, index, 1);
    } else {
        packet(code.select, my.weapon, 1);
    }
}

function sendAutoGather() {
    packet(code.gather, 1);
}

function sendAtck(id, angle) {
    packet(code.attack, id, angle);
}

// HEALING:
function soldierMult() {
    return player.latestSkin == 6 ? 0.75 : 1;
}


function biomeGear(mover, returns) {
    if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
        if (returns) return 31;
        UseHat(31);
    } else {
        if (player.y2 <= config.snowBiomeTop) {
            if (returns) return mover && player.moveDir == undefined ? 22 : 15;
            UseHat(mover && player.moveDir == undefined ? 22 : 15);
        } else {
            if (returns) return mover && player.moveDir == undefined ? 22 : 12;
            UseHat(mover && player.moveDir == undefined ? 22 : 12);
        }
    }
    if (returns) return 0;
}

function woah(mover) {
    UseAcc(mover && player.moveDir == undefined ? 0 : 11, 1);
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
        this.notFast = function () {
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
                        getScale: function (sM, ig) {
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
                        getScale: function () {
                            return this.scale;
                        },
                    });
                    if (UTILS.getAngleDist(near.aim2, relAim) <= 1) {
                        counts.placed++;
                    }
                }
            } catch (err) {
            }
        };
        this.checkSpikeTick = function () {
            try {
                if (![3, 4, 5].includes(near.primaryIndex)) return false;
                if ((my.autoPush) ? false : near.primaryIndex == undefined ? true : (near.reloads[near.primaryIndex] > game.tickRate)) return false;
                near.primaryIndex || 5
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
                        Text("Anti Trap Spike" + near.sid, "#ff0");
                        return true;
                    }
                }
            } catch (err) {
                return null;
            }
            return false;
        }
        this.protect = function (aim) {
            if (player.items[4]) {
                this.testCanPlace(4, -(Math.PI / 2), (Math.PI / 2), (Math.PI / 18), aim + Math.PI);
                this.antiTrapped = true;
            }
        };

        function calculatePerfectAngle(x1, y1, x2, y2) {
            return Math.atan2(y2 - y1, x2 - x1);
        }
        function fgdo(a, b) {
            return Math.sqrt(Math.pow((b.y - a.y), 2) + Math.pow((b.x - a.x), 2));
        }

        function getDist(e, t) {
            try {
                return Math.hypot((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
            } catch (e) {
                return Infinity;
            }
        }
    }
};
function getItemPlaceLocation(e, t) {
    let item = items.list[player.items[e]];
    let tmpS = player.scale + item.scale + (item.placeOffset || 0);
    let tmpX = player.x2 + tmpS * Math.cos(t);
    let tmpY = player.y2 + tmpS * Math.sin(t);
    return {
        x: tmpX,
        y: tmpY
    }
}
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
        this.syncHit = false;
    }
};

class Autobuy {
    constructor(buyHat, buyAcc) {
        this.hat = function () {
            buyHat.forEach((id) => {
                let find = findID(hats, id);
                if (find && !player.skins[id] && player.points >= find.price) packet(code.store, 1, id, 0);
            });
        };
        this.acc = function () {
            buyAcc.forEach((id) => {
                let find = findID(accessories, id);
                if (find && !player.tails[id] && player.points >= find.price) packet(code.store, 1, id, 1);
            });
        };
    }
};

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
    };
};

class Damages {
    constructor(items) {
        // 0.75 1 1.125 1.5
        this.calcDmg = function (dmg, val) {
            return dmg * val;
        };
        this.getAllDamage = function (dmg) {
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
let autoBuy = new Autobuy([15, 31, 6, 7, 22, 12, 53, 20, 40], [11, 13, 19, 18, 21]);
let autoUpgrade = new Autoupgrade();
let ulist = [];
let minimapData;
let mapPings = [];
let tmpPing;
let pingDisplay = getEl("pingDisplay");
let LastPing = 0, antiDashPing = 0, chathighpingTime = Date.now();

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


function addCheck(label, id, checked, storage){
    let CHECKED = localStorage.getItem(id);
    let HTML = `<div class="checkbox_container">`;
    HTML += `<input type="checkbox" id="${id}" ${storage && CHECKED ? CHECKED === "true" ? "checked /" : "" : checked ? "checked /" : ""}>`;
    HTML += `<label for="${id}">${label}</label>`;
    HTML += `</div>`;
    setTimeout(()=>{
        const inputField = document.getElementById(id);
        inputField.addEventListener('change', () => {
            localStorage.setItem(id, inputField.checked);
            inputField.blur();
        },false);
    },10);
    return HTML;
}
function checkMM(id, inputField){
    let currentValue = parseInt(inputField.value);
    if (currentValue > inputField.max) {
        inputField.value = inputField.max;
    }
    if (currentValue < inputField.min) {
        inputField.value = inputField.min;
    }
    localStorage.setItem(id, parseInt(inputField.value));

}
function addNumber(label, id, value, max, min, storage){
    let VALUE = localStorage.getItem(id);
    let HTML = `<div class="number_container">`;
    HTML += `<input id="${id}" type="number" max="${max}" min="${min}" value="${VALUE && storage ? VALUE : value}">`;
    HTML += `<button id="${id}_increment" class="increment">+</button>`;
    HTML += `<button id="${id}_decrement" class="decrement">в€?</button>`;
    HTML += `<label for="${id}">${label}</label>`;
    HTML += `</div>`;
    setTimeout(()=>{
        const incrementButton = document.getElementById(`${id}_increment`);
        const decrementButton = document.getElementById(`${id}_decrement`);
        const inputField = document.getElementById(id);
        inputField.addEventListener('keydown', () => {
            checkMM(id, inputField);
        },false);
        inputField.addEventListener('change', () => {
            checkMM(id, inputField);
        },false);
        incrementButton.addEventListener('mousedown', () => {
            let currentValue = parseInt(inputField.value);
            if (currentValue < inputField.max) {
                inputField.value = currentValue + 1;
            }
            checkMM(id, inputField);
        });
        decrementButton.addEventListener('mousedown', () => {
            let currentValue = parseInt(inputField.value);
            if (currentValue > inputField.min) {
                inputField.value = currentValue - 1;
            }
            checkMM(id, inputField);
        });
    },10);
    return HTML;
}
function addTextarea(label, id, value, id2, checked, storage){
    let CHECKED = localStorage.getItem(id2);
    let HTML = `<div class="textarea_container">`;
    HTML += `<input type="checkbox" id="${id2}"  ${storage && CHECKED ? CHECKED === "true" ? "checked /" : "" : checked ? "checked /" : ""}>`;
    HTML += `<label for="${id2}">${label}</label>`;
    HTML += `<textarea id="${id}">`;
    HTML += `</textarea>`;
    HTML += `</div>`;
    setTimeout(()=>{
        let VALUE = localStorage.getItem(id);
        const inputField = document.getElementById(id);
        inputField.value = VALUE ? VALUE : value;
        inputField.addEventListener('change', () => {
            localStorage.setItem(id, inputField.value);
        },false);
        const inputCheck = document.getElementById(id2);
        inputCheck.addEventListener('change', () => {
            inputCheck.blur();
            localStorage.setItem(`${id2}`, inputCheck.checked);

        },false);
    },10);
    return HTML;
}
function addChat(label, id, value, maxlength, id2, value2, maxlength2, id3, value3, max, min){
    let HTML = `<div class="text_container">`;
    HTML += `<div class="text_container_box">`;
    HTML += `<input type="text" id="${id}" value="" maxlength="${maxlength}"class="text_left">`;
    HTML += `<input type="text" id="${id2}" value="" maxlength="${maxlength2}"class="text_right">`;
    HTML += `</div>`;
    let VALUE3 = localStorage.getItem(id3);
    HTML += `<input id="${id3}" type="number" max="${max}" min="${min}" value="${(VALUE3 || value3)}">`;
    HTML += `<button id="${id3}_increment" class="increment">+</button>`;
    HTML += `<button id="${id3}_decrement" class="decrement">в€?</button>`;
    HTML += `<span>${label}</span>`;
    HTML += `</div>`;
    setTimeout(()=>{
        let VALUE = localStorage.getItem(id);
        let VALUE2 = localStorage.getItem(id2);
        const inputField = document.getElementById(id);
        inputField.value = VALUE ? VALUE : value;
        inputField.addEventListener('keyup', () => {
            localStorage.setItem(id, inputField.value);
        },false);
        const inputField2 = document.getElementById(id2);
        inputField2.value = VALUE2 ? VALUE2 : value2;
        inputField2.addEventListener('keyup', () => {
            localStorage.setItem(id2, inputField2.value);
        },false);
        const incrementButton = document.getElementById(`${id3}_increment`);
        const decrementButton = document.getElementById(`${id3}_decrement`);
        const inputField3 = document.getElementById(id3);
        inputField3.addEventListener('keydown', () => {
            checkMM(id3, inputField3);
        },false);
        inputField3.addEventListener('change', () => {
            checkMM(id3, inputField3);
        },false);
        incrementButton.addEventListener('mousedown', () => {
            let currentValue = parseInt(inputField3.value);
            if (currentValue < inputField3.max) {
                inputField3.value = currentValue + 1;
            }
            checkMM(id3, inputField3);
        });
        decrementButton.addEventListener('mousedown', () => {
            let currentValue = parseInt(inputField3.value);
            if (currentValue > inputField3.min) {
                inputField3.value = currentValue - 1;
            }
            checkMM(id3, inputField3);
        });
    },10);
    return HTML;
}
function addSelect(label, id, option){
    let SELECTED = localStorage.getItem(id);
    let HTML = `<div class="select_container">`;
    HTML += `<select id="${id}">`;
    for(let i=0;i<option.length;i++){
        HTML += `<option value="${i}" ${SELECTED ? parseInt(SELECTED) === i ? "selected" : "" : option[i].select ? "selected" : ""}>${option[i].name}</option>`;
    }
    HTML += `</select>`;
    HTML += `<label for="${id}">${label}</label>`;
    HTML += `</div>`;
    setTimeout(()=>{
        const inputField = document.getElementById(id);
        inputField.addEventListener('change', () => {
            localStorage.setItem(id, inputField.value);
        },false);
    },10);
    return HTML;
}

const menu = document.createElement('div');
menu.className = "menu";
menu.id = "menu";
menu.innerHTML = `
    <style>
        .menu {
            position: fixed;
            display: flex;
            opacity: 1;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            height: 450px;
            width: 700px;
            background: #0008;
            border-radius: 10px;
            box-shadow: 0 0 10px #000;
            backdrop-filter: blur(0);
            z-index: 12345;
            transition: opacity .2s linear;
        }

        .menu-sidebar {
            left: 0;
            position: relative;
            width: 170px;
            height: 100%;
            background: #0005;
            border-radius: 10px 0 0 10px;
        }

        .menu-name {
            width: 100%;
            height: 50px;
            font: 26px Georgia;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #fff;
            text-shadow: 0 0 5px #6E6EFF, 0 0 7px #F000FF, 0 0 10px #85FF99;
            user-select: none;
        }

        .menu-setting {
            width: 100%;
            height: 380px;
            background: transparent;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            position: absolute;
        }

        .menu-setting::-webkit-scrollbar {
            width: 0 !important;
        }

        .menu-setting-item {
            min-height: 12.5%;
            background: #0005;
            border: 0;
            border-radius: 0;
            color: #BAFFEF;
            text-shadow: 0 0 5px #6E6EFF, 0 0 7px #F000FF, 0 0 10px #85FF99;
            font: 20px Arial;
        }

        .menu-setting-item:hover {
            background: #fff3;
        }

        .menu-setting-active {
            position: absolute;
            width: 100%;
            min-height: 12.5%;
            background: #f00;
            z-index: -1;
        }

        .menu-content {
            position: relative;
            width: 530px;
            height: 450px;
            scroll-snap-type: y mandatory;
            overflow-y: scroll;
            overflow-x: hidden;
            scroll-behavior: smooth;
            border-radius: 0 10px 10px 0;
        }

        .menu-content::-webkit-scrollbar {
            width: 0 !important;
        }

        .menu-content-item {
            width: 530px;
            height: 450px;
            position: relative;
            scroll-snap-stop: always;
            scroll-snap-align: start;
        }

        .menu-content-title {
            font: 26px Georgia;
            display: flex;
            align-items: center;
            color: #fff;
            text-shadow: 0 0 5px #6E6EFF, 0 0 7px #F000FF, 0 0 10px #85FF99;
            user-select: none;
            height: 50px;
            width: 100%;
            justify-content: center;
        }

        .menu-content-setting {
            height: 400px;
            width: 530px;
            background: #0003;
            position: absolute;
            display: flex;
            flex-wrap: wrap;
            flex-direction: row;
            align-content: flex-start;
            justify-content: space-evenly;
            overflow-y: scroll;
            overflow-x: hidden;

            &::-webkit-scrollbar {
                width: 10px !important;
            }

            &::-webkit-scrollbar-track {
                opacity: 0 !important;
            }

            &::-webkit-scrollbar-thumb {
                background-color: rgba(255, 255, 255, 0.1) !important;
                border-radius: 4px !important;
            }

            &::-webkit-scrollbar-thumb:hover {
                background-color: rgba(255, 255, 255, 0.5) !important;
            }

            &::-webkit-scrollbar-thumb:active {
                background-color: rgba(255, 255, 255, 0.9) !important;
            }

            &::-webkit-scrollbar-corner {
                background-color: rgba(255, 255, 255, 0.1) !important;
            }
        }

        .checkbox_container {
            font: 18px Arial;
            position: relative;
            width: 200px;
            height: 40px;
            background: rgba(30, 35, 65, 0.6);
            border-radius: 20px;
            display: flex;
            align-items: center;
            padding: 8px 25px;
            color: #fff;
            margin-top: 8px;
            transition: background 150ms cubic-bezier(0.24, 0, 0.5, 1);

            &:hover {
                background: rgba(30, 35, 65, 0.8);

            }

            input {
                opacity: 0;
                position: absolute;

                +label {
                    user-select: none;
                    font: 18px Arial;

                    &::before,
                    &::after {
                        content: "";
                        position: absolute;
                        transition: 150ms cubic-bezier(0.24, 0, 0.5, 1);
                        transform: translateY(-50%);
                        top: 50%;
                        right: 10px;
                        cursor: pointer;
                    }

                    &::before {
                        height: 30px;
                        width: 50px;
                        border-radius: 30px;
                        background: rgba(214, 214, 214, 0.434);
                    }

                    &::after {
                        height: 24px;
                        width: 24px;
                        border-radius: 60px;
                        right: 32px;
                        background: #fff;
                    }
                }

                &:checked {
                    &+label:before {
                        background: #5d68e2;
                        transition: all 150ms cubic-bezier(0, 0, 0, 0.1);
                    }

                    &+label:after {
                        right: 14px;
                    }
                }

                &:focus {
                    +label:before {
                        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.75);
                    }
                }

                &:disabled {
                    +label {

                        &:before,
                        &:after {
                            cursor: not-allowed
                        }

                        &:before {
                            background: #4f4f6a
                        }

                        &:after {
                            background: #909090
                        }
                    }
                }
            }
        }

        .number_container {
            font: 18px Arial;
            position: relative;
            width: 200px;
            height: 40px;
            background: rgba(30, 35, 65, 0.6);
            border-radius: 20px;
            display: flex;
            align-items: center;
            padding: 8px 25px;
            color: #fff;
            margin-top: 8px;
            transition: background 150ms cubic-bezier(0.24, 0, 0.5, 1);

            &:hover {
                background: rgba(30, 35, 65, 0.8);
            }

            label {
                font: 18px Arial;
                user-select: none;
            }

            input {
                position: absolute;
                width: 30px;
                height: 26px;
                transform: translateY(-50%);
                top: 50%;
                right: 30px;
                border: 0;
                border-radius: 30px 0 0 30px;
                text-align: center;
                font: 10px Arial;
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: textfield;
                background: rgba(255, 255, 255, 0.9);

                &:hover {
                    background: rgba(255, 255, 255, 0.97);
                }
            }

            input[type="number"]::-webkit-inner-spin-button {
                appearance: none;
            }

            button {
                border: 0;
                position: absolute;
                font: 8px Arial;
                right: 10px;
                width: 20px;
                height: 14px;
                display: flex;
                text-align: center;
                background: #fff8;

                &:hover {
                    background: #fff5;
                }
            }

            .increment {
                border-radius: 0 30px 0 0;
                transform: translateY(-50%);
                align-items: flex-start;

            }

            .decrement {
                border-radius: 0 0 30px 0;
                transform: translateY(50%);
                align-items: flex-end;
            }
        }

        .textarea_container {
            font: 18px Arial;
            position: relative;
            width: 200px;
            height: 64px;
            background: rgba(30, 35, 65, 0.6);
            border-radius: 20px;
            display: flex;
            align-items: flex-start;
            padding: 8px 25px;
            color: #fff;
            margin-top: 8px;
            transition: background 150ms cubic-bezier(0.24, 0, 0.5, 1);

            &:hover {
                background: rgba(30, 35, 65, 0.8);

            }

            input {
                opacity: 0;
                position: absolute;

                +label {
                    font: 18px Arial;
                    user-select: none;

                    &::before,
                    &::after {
                        content: "";
                        position: absolute;
                        transition: 150ms cubic-bezier(0.24, 0, 0.5, 1);
                        transform: translateY(-50%);
                        top: 20px;
                        right: 20px;
                        cursor: pointer;
                    }

                    &::before {
                        height: 30px;
                        width: 50px;
                        border-radius: 30px;
                        background: rgba(214, 214, 214, 0.434);
                    }

                    &::after {
                        height: 24px;
                        width: 24px;
                        border-radius: 60px;
                        right: 42px;
                        background: #fff;
                    }
                }

                &:checked {
                    &+label:before {
                        background: #5d68e2;
                        transition: all 150ms cubic-bezier(0, 0, 0, 0.1);
                    }

                    &+label:after {
                        right: 24px;
                    }
                }

                &:focus {
                    +label:before {
                        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.75);
                    }
                }

                &:disabled {
                    +label {

                        &:before,
                        &:after {
                            cursor: not-allowed
                        }

                        &:before {
                            background: #4f4f6a
                        }

                        &:after {
                            background: #909090
                        }
                    }
                }
            }

            textarea {
                position: absolute;
                width: 200px;
                height: 30px;
                top: 40px;
                border: 0;
                text-align: left;
                font: 12px Arial;
                background: rgba(255, 255, 255, 0.9);
                resize: none;

                &:hover {
                    background: rgba(255, 255, 255, 0.97);
                }

                &::-webkit-scrollbar {
                    width: 10px !important;
                }

                &::-webkit-scrollbar-track {
                    opacity: 0 !important;
                }

                &::-webkit-scrollbar-thumb {
                    background-color: rgba(255, 255, 255, 0.1) !important;
                    border-radius: 4px !important;
                }

                &::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(255, 255, 255, 0.5) !important;
                }

                &::-webkit-scrollbar-thumb:active {
                    background-color: rgba(255, 255, 255, 0.9) !important;
                }

                &::-webkit-scrollbar-corner {
                    background-color: rgba(255, 255, 255, 0.1) !important;
                }
            }
        }

        .select_container {
            font: 18px Arial;
            position: relative;
            width: 200px;
            height: 40px;
            background: rgba(30, 35, 65, 0.6);
            border-radius: 20px;
            display: flex;
            align-items: center;
            padding: 8px 25px;
            color: #fff;
            margin-top: 8px;
            transition: background 150ms cubic-bezier(0.24, 0, 0.5, 1);

            &:hover {
                background: rgba(30, 35, 65, 0.8);
            }

            label {
                font: 18px Arial;
                user-select: none;
            }

            select {
                position: absolute;
                width: 125px;
                height: 30px;
                transform: translateY(-50%);
                top: 50%;
                right: 10px;
                border: 0;
                border-radius: 30px;
                text-align: center;
                font: 10px Arial;
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: textfield;
                color: rgba(255, 255, 255, 0.9);
                background: rgba(100, 100, 100, 0.97);
                transition: 150ms cubic-bezier(0.24, 0, 0.5, 1);

                &:hover {
                    background: rgba(0, 200, 0, 0.97);
                }
            }

            option {
                background: rgba(100, 100, 100, 0.97);
                color: rgba(255, 255, 255, 0.97);
            }
        }

        .menu-logger-box {
            position: absolute;
            width: 510px;
            height: 360px;
            top: 0;
            left: 0;
            padding: 10px;
            overflow: auto;
            background: #0009;
        }

            &::-webkit-scrollbar {
                width: 10px !important;
            }

            &::-webkit-scrollbar-track {
                opacity: 0 !important;
            }

            &::-webkit-scrollbar-thumb {
                background-color: rgba(255, 255, 255, 0.1) !important;
                border-radius: 4px !important;
            }

            &::-webkit-scrollbar-thumb:hover {
                background-color: rgba(255, 255, 255, 0.5) !important;
            }

            &::-webkit-scrollbar-thumb:active {
                background-color: rgba(255, 255, 255, 0.9) !important;
            }

            &::-webkit-scrollbar-corner {
                background-color: rgba(255, 255, 255, 0.1) !important;
            }

        .text_container {
            font: 18px Arial;
            position: relative;
            width: 460px;
            height: 40px;
            background: rgba(30, 35, 65, 0.6);
            border-radius: 20px;
            display: flex;
            align-items: center;
            padding: 8px 25px;
            color: #fff;
            margin-top: 8px;
            transition: background 150ms cubic-bezier(0.24, 0, 0.5, 1);

            &:hover {
                background: rgba(30, 35, 65, 0.8);
            }

            span {
                font: 18px Arial;
                user-select: none;
            }

            input[type="number"] {
                position: absolute;
                width: 30px;
                height: 26px;
                transform: translateY(-50%);
                top: 50%;
                right: 30px;
                border: 0;
                border-radius: 30px 0 0 30px;
                text-align: center;
                font: 10px Arial;
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: textfield;
                background: rgba(255, 255, 255, 0.9);

                &:hover {
                    background: rgba(255, 255, 255, 0.97);
                }
            }

            input[type="number"]::-webkit-inner-spin-button {
                appearance: none;
            }

            button {
                border: 0;
                position: absolute;
                font: 8px Arial;
                right: 10px;
                width: 20px;
                height: 14px;
                display: flex;
                text-align: center;
                background: #fff8;

                &:hover {
                    background: #fff5;
                }
            }

            .increment {
                border-radius: 0 30px 0 0;
                transform: translateY(-50%);
                align-items: flex-start;

            }

            .decrement {
                border-radius: 0 0 30px 0;
                transform: translateY(50%);
                align-items: flex-end;
            }

            .text_container_box {
                position: absolute;
                display: flex;
                flex-direction: row;
                align-items: center;
                right: 70px;
                width: 365px;
                justify-content: space-around;

                .text_left {
                    width: 300px;
                    height: 30px;
                    font: 18px Arial;
                    border: 0;
                    border-radius: 30px;
                    text-align: left;
                }

                .text_right {
                    width: 30px;
                    height: 30px;
                    font: 18px Arial;
                    border: 0;
                    border-radius: 30px;
                    text-align: center;
                }
            }
        }
	.choose_container {
font: 18px Arial;
    position: relative;
    width: 450px;
    height: 80px;
    background: rgba(30, 35, 65, 0.6);
    border-radius: 20px;
    display: flex;
    padding: 8px 25px;
    color: #fff;
    margin-top: 8px;
    transition: background 150ms cubic-bezier(0.24, 0, 0.5, 1);
    align-items: flex-end;
    justify-content: space-evenly;
    &:hover{
	background: rgba(30, 35, 65, 0.8);
    }
	label {
        font: 18px Georgia;
        align-items: center;
        color: #fff;
        text-shadow: 0 0 5px #6E6EFF, 0 0 7px #F000FF, 0 0 10px #85FF99;
        user-select: none;
        position: absolute;
        left: 10px;
        top: 10px;
    }
      .choose{
                border: #f74040 4px solid;
      }
    button{
        min-width: 50px;
        min-height: 50px;
        border-radius: 50%;
        border: #40acf7 4px solid;
        position: relative;
transition: all 150ms cubic-bezier(0.24, 0, 0.5, 1);
background-size: cover;
background-repeat: no-repeat;
background-position: center;
		&:disabled{
        border: #6b6b6b 4px solid;
      }
  &:not(:disabled):hover {
    scale: 1.1;
        border: #24b11b 4px solid;
  }
    }
}
    </style>
<div class="menu-sidebar">
    <div id="menu_name" class="menu-name">Menu</div>
    <div class="menu-setting">
        <div id="menu-setting-active" class="menu-setting-active"></div>
        <button id="menu-main-setting" class="menu-setting-item">Main</button>
        <button id="menu-combat-setting" class="menu-setting-item">Combat</button>
        <button id="menu-heal-setting" class="menu-setting-item">Heal</button>
        <button id="menu-defense-setting" class="menu-setting-item">Defense</button>
        <button id="menu-place-setting" class="menu-setting-item">Place</button>
        <button id="menu-chat-setting" class="menu-setting-item">Chat</button>
        <button id="menu-sync-setting" class="menu-setting-item">Sync</button>
        <button id="menu-move-setting" class="menu-setting-item">Move</button>
        <button id="menu-upgrade-setting" class="menu-setting-item">Upgrade</button>
        <button id="menu-vision-setting" class="menu-setting-item">Vision</button>
        <button id="menu-hatmode-setting" class="menu-setting-item">Hat Mode</button>
        <button id="menu-logger-setting" class="menu-setting-item">Logger</button>
    </div>
</div>
<div class="menu-content">
    <div id="menu-main-content" class="menu-content-item">
        <div class="menu-content-title">Main</div>
        <div class="menu-content-setting">
            ${addCheck("Wapon Grind", "weaponGrind", false)}
            ${addCheck("Auto Respawn", "autorespawn", true, true)}
            ${addCheck("Auto Buy", "autobuy", true, true)}
            ${addCheck("Auto Buy Equip", "autobuyequip", true, true)}
            ${addCheck("Auto Cam", "autocam", false, true)}
            ${addCheck("Key Board", "keyboard", false, true)}
            ${addCheck("Spin", "spin", false, true)}
            ${addNumber("Spin Speed", "spinSpeed", 179, 360, -360, true)}
            ${addCheck("Auto Agree", "autoagree", true, true)}
            ${addCheck("AI Reply", "AIreply", false, true)}
            ${addTextarea("White List", "whitelist" , "GrIm ReApEr\nAckookisdMySon\ntWVWcWc\nbrww\nMoonrocks\nGin\nCuu Tui" , "Whitelist" , true, true)}
            ${addTextarea("Black List", "blacklist" , "unknown" , "Blacklist" , false, true)}
        </div>
    </div>
    <div id="menu-combat-content" class="menu-content-item">
        <div class="menu-content-title">Combat</div>
        <div class="menu-content-setting">
            ${addSelect("Insta Type", "instatype", [{name: "Insta", select: 1}, {name: "Reverse Insta"}, {name: "Reverse Insta(Boost)"}, {name: "One Tick"}, {name: "One Tick Insta"}, {name: "One Tick(Reverse)"}])}
            ${addCheck("Auto Bull Spam", "autobullspam", false, true)}
            ${addCheck("Spike Tick", "spiketick", true, true)}
            ${addCheck("Spike Tick(near)", "spiketicknear", true, true)}
            ${addCheck("Spike Tick(trap)", "spiketicktrap", false, true)}
            ${addCheck("Auto Hit", "autohit", true, true)}
            ${addCheck("Auto Tick", "autotick", false, true)}
            ${addCheck("Anti Bull", "antibull", false, true)}
            ${addCheck("Anti Bull Always", "antibullalways", false, true)}
            ${addCheck("Auto Break", "autobreak", true, true)}
            ${addCheck("Auto Break(All)", "autobreakall", true, true)}
            ${addNumber("Trap Tick Speed 1", "traptickSpeed1", 40, 120, 0, true)}
            ${addNumber("Trap Tick Speed 2", "traptickSpeed2", 40, 120, 0, true)}
        </div>
    </div>
    <div id="menu-heal-content" class="menu-content-item">
        <div class="menu-content-title">Heal</div>
        <div class="menu-content-setting">
            ${addCheck("Auto Heal", "autoheal", true, true)}
            ${addCheck("Anti Insta", "antiinsta", true, true)}
            ${addCheck("Low Heal", "lowheal", true, true)}
            ${addCheck("Near Spike", "nearspike", true, true)}
            ${addCheck("High Ping", "highping", true, true)}
            ${addCheck("Anti Bow Insta", "antibowinsta", true, true)}
        </div>
    </div>
    <div id="menu-defense-content" class="menu-content-item">
        <div class="menu-content-title">Defense</div>
        <div class="menu-content-setting">
            ${addCheck("Anti Spike Tick", "antispiketick", true, true)}
            ${addCheck("Priority Soldier", "PrioritySoldier", true, true)}
            ${addCheck("Anti Tick", "antitick", true, true)}
        </div>
    </div>
    <div id="menu-place-content" class="menu-content-item">
        <div class="menu-content-title">Place</div>
        <div class="menu-content-setting">
            ${addCheck("Auto Place", "autoplace", true, true)}
            ${addCheck("Auto Replace", "autoreplace", true, true)}
            ${addCheck("Pre Place", "preplace", true, true)}
            ${addCheck("Pre Place v2", "preplace2", true, true)}
            ${addCheck("Auto 4 Spike", "auto4spike", config.isSandbox ? true : false, true)}
            ${addCheck("Replace Trap", "retrap", true, true)}
            ${addCheck("Replace Spike", "respike", true, true)}
        </div>
    </div>
    <div id="menu-chat-content" class="menu-content-item">
        <div class="menu-content-title">Chat</div>
        <div class="menu-content-setting">
                ${addTextarea("Auto Reply", "autoreply", "isaac, >_< isaac is my son>_<\nhi, hi!\nhello, hello!!\nbrww,>_< brww is my son>_<", "AutoReply" , false, true)}
                ${addTextarea("Kill Chat", "killchat" , "oops! i kill {{sid}}{player}\n10\nkills:{kills}" , "KillChat" , true, true)}
                ${addTextarea("Insta Chat", "instachat" , "kiss\n10\n*;::;*" , "InstaChat" , false, true)}
                ${addTextarea("Player Leave Chat", "playerleavechat" , "{{sid}}{player} is leave" , "PlayerLeaveChat" , true, true)}
                ${addTextarea("Player Dead Chat", "playerdeadchat" , "{{sid}}{player} is dead\n0\n{player} get better pls" , "PlayerDeadChat" , true, true)}
                ${addTextarea("Anti Bow Chat", "antibowchat" , "bow insta? lol" , "AntiBowChat" , true)}
                ${addTextarea("While Chat", "whilechat" , "AFK.\n1000\nAFK..\n1000\nAFK...\n1000\nAFK..\n1000" , "WhileChat" , false, true)}
                ${addTextarea("High Ping Chat", "highpingchat" , "Ping: {ping} ms" , "HighPingChat" , false, true)}
                ${addTextarea("White List Chat", "whitelistchat" , "{{sid}}{player} is join {team}" , "WhitelistChat" , true, true)}
                ${addTextarea("Black List Chat", "blacklistchat" , "{{sid}}{player} wanted to join {team}\n1000/nbut {{sid}}{me} rejected" , "BlacklistChat" , true, true)}
                ${addChat("Chat", "Chat" , "Sakuna Mod v44.5" , 30, "ChatText" , "#" , 30, "ChatCount" , 3, 99, 0)}
                ${addChat("Clan", "Clan" , "Sakuna" , 7, "ClanText" , "#" , 7, "ClanCount" , 3, 99, 0)}
            </div>
        </div>
        <div id="menu-sync-content" class="menu-content-item">
            <div class="menu-content-title">Sync</div>
            <div class="menu-content-setting">
                ${addCheck("Sync Hit", "synchit", false, true)}
                ${addCheck("Sync Shoot", "syncshoot", false, true)}
                ${addCheck("Sync Insta", "syncinsta", true, true)}
                ${addCheck("Always Aim", "AlwaysAim", false)}
                ${addCheck("Aim Sync Follower", "AimSyncFollower", false, true)}
                ${addCheck("Aim To Follower", "AimToFollower", false, true)}
                ${addNumber("Dir", "AimToFollowerDir", 0, 360, -360, true)}
                ${addCheck("Player Sync", "togglePlayerSync", false)}
                ${addCheck("Web Sync(hit)", "websynchit", true, true)}
                ${addCheck("Web Sync(shoot)", "websyncshoot", true, true)}
                ${addCheck("Web Sync(insta)", "websyncinsta", true, true)}
                ${addCheck("Mod Sync(hit)", "modsynchit", true, true)}
                ${addCheck("Mod Sync(shoot)", "modsyncshoot", false, true)}
                ${addCheck("Mod Sync(insta)", "modsyncinsta", false, true)}
            </div>
        </div>
        <div id="menu-move-content" class="menu-content-item">
            <div class="menu-content-title">Move</div>
            <div class="menu-content-setting">
                ${addNumber("Sync Sid", "syncsid", 0, 50, 1)}
                ${addCheck("Player Follower", "togglePlayerFollower", false)}
                ${addCheck("Use Dir", "togglePlayerFollowerUseDir", false, true)}
                ${addNumber("Dir", "togglePlayerFollowerDir", 0, 360, -360, true)}
                ${addNumber("Dist", "togglePlayerFollowerDist", 0, 999, 0, true)}
                ${addCheck("Player Follower Enemy", "togglePlayerFollowerEnemy", false, true)}
                ${addCheck("Movement Assist", "movementassist", true, true)}
                ${addCheck("Auto Play", "autoPlay", false, true)}
                ${addCheck("Movement Assist(cactus)", "movementassistcactus", true, true)}
                ${addCheck("Auto Push", "autopush", true, true)}
                ${addCheck("Spike Tick Move", "spiketickmove", false, true)}
                ${addCheck("Retrap Move", "retrapmove", false, true)}
                ${addCheck("Enemy Move", "enemymove", false, true)}
                ${addCheck("Break Spike Move", "breakspikemove", false, true)}
                ${addSelect("Algorithm", "findPathType", [{name: "Jump Point Search", select: 1}])}
                ${addNumber("maxIterationCount", "maxIterationCount", 40, 9999, 0, true)}
            </div>
        </div>
        <div id="menu-upgrade-content" class="menu-content-item">
            <div class="menu-content-title">Upgrade</div>
            <div class="menu-content-setting">
                ${addUpgrade()}
            </div>
        </div>
        <div id="menu-vision-content" class="menu-content-item">
            <div class="menu-content-title">Vision</div>
            <div class="menu-content-setting">
                ${addNumber("Quality", "quality", 1080, 8640, 1, true)}
                ${addNumber("Smooth Level", "smoothlevel", 20, 999, 1, true)}
                ${addCheck("Full FPS", "fullfps", false, true)}
                ${addCheck("Ranbow Name", "ranbowname", true, true)}
                ${addCheck("Show Text", "showtext", true, true)}
                ${addCheck("Render Placers", "placeVis", true, true)}
                ${addCheck("Clown Turntable", "clownturntable", false, true)}
                ${addCheck("Wing", "wing", false, true)}
                ${addCheck("Mouse Tail", "mousetail", false, true)}
                ${addCheck("Weapon Tail", "weapontail", false, true)}
                ${addCheck("Player Tail", "playertail", false, true)}
            </div>
        </div>
        <div id="menu-hatmode-content" class="menu-content-item">
            <div class="menu-content-title">Hat Mode</div>
            <div class="menu-content-setting">
                ${addCheck("Bush Mode", "bushmode", false)}
                ${addCheck("Police Mode", "policemode", false)}
                ${addCheck("BW Mode", "blackandwhiteangelmode", false)}
                ${addCheck("All Hat Mode", "allhatmode", false)}
                ${addCheck("All Acc Mode", "allaccmode", false)}
                ${addCheck("Assassin Mode", "assassinmode", false)}
                ${addCheck("Always", "alwaysassassinmode", false)}
            </div>
        </div>
        <div id="menu-logger-content" class="menu-content-item">
            <div class="menu-content-title">Logger</div>
            <div class="menu-content-setting">
                <div id="logger" class="menu-logger-box">
                </div>
            </div>
        </div>
    </div>
    `;
document.body.append(menu);
var menuItems = ["main", "combat", "heal", "defense", "place", "chat", "sync", "move", "upgrade", "vision", "hatmode", "logger"];
var menu_content = document.querySelector(`[class="menu-content"]`);
let active = document.getElementById("menu-setting-active");
var menu_setting = document.querySelector(`[class="menu-setting"]`);
for (let i = 0; i < menuItems.length; i++) {
    document.getElementById("menu-" + menuItems[i] + "-setting").addEventListener("click", () => {
        menu_content.scrollTop = 450 * i;
    }, false);
}
document.querySelector('.menu-content').style.scrollBehavior = 'auto';
menu_content.scrollTop = parseInt(localStorage.getItem("menu_scrollTop"));
active.style.top = `${(1 - (menu_content.scrollHeight - menu_content.scrollTop) / menu_content.scrollHeight) * 47.5 * (menuItems.length)}px`
    document.querySelector('.menu-content').style.scrollBehavior = 'smooth';
menu.style.opacity = 0;
menu.style.display = 'none';
menu_content.addEventListener("scroll", () => {
    const scrollTop = menu_content.scrollTop;
    active.style.top = `${(1 - (menu_content.scrollHeight - menu_content.scrollTop) / menu_content.scrollHeight) * 47.5 * (menuItems.length)}px`
    localStorage.setItem("menu_scrollTop", scrollTop);
});
let menuChats = getEl("logger");
let menuCBFocus = false;
let menuChCounts = 0;

function addMenuChText(name, message, color, noTimer) {
    color = color || "white";

    let time = new Date();
    let min = time.getMinutes().toString().padStart(2, '0');
    let hour = time.getHours();
    let getAMPM = hour >= 12 ? "PM" : "AM";

    let text = ``;
    if (!noTimer) text += `[${(hour % 12 || 12)}:${min} ${getAMPM}]`;
    if (name) text += `${(!noTimer ? " - " : "") + name}`;
    if (message) text += `${(name ? ": " : !noTimer ? " - " : "") + message}\n`;

    const menu = document.createElement('div');
    menu.id = `menuChDisp${menuChCounts}`;
    menu.style.color = `${color}`;
    menu.textContent = text;

    menuChats.append(menu);

    menuChCounts++;
}

function resetMenuChText() {
    menuChats.innerHTML = ``;
    menuChCounts = 0;
    addMenuChText(null, "Chat '/help' for a list of chat commands", "Yellow", 1)
}
resetMenuChText();
function sendChat(message) {
    chat.list.push(message.slice(0, 30));
}

function textChat(value, replace, chatcount){
    let text = value.split('\n');
    if(!chatcount)chatcount = 0;
    if(text[chatcount]){
        try{
            if(replace){
                Object.entries(replace).forEach(([key, value]) => {
                    if(key == "{player}"){
                        text[chatcount] = text[chatcount].replaceAll(key, value ? value : "???");
                    } else {
                        text[chatcount] = text[chatcount].replaceAll(key, value);
                    }
                });
            }
        }catch(e){}
        sendChat(text[chatcount]);

        if(Number.isInteger(Number(text[chatcount + 1]))){
            setTimeout(()=>{
                textChat(value, replace ? replace : {}, chatcount + 2);
            },parseInt(text[chatcount + 1]));
        } else {
            chatcount = 0;
        }
        if(chatcount >= (text.length - 1))chatcount = 0;
    } else {
        chatcount = 0;
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
let scaleFillNative = 1;
let mX = 1;
let mY = 1;
let canvasX = 0;
let canvasY = 0;
function resize() {
    let quality = parseInt(getEl("quality").value);
    let screenHeight, screenWidth;

    screenHeight = quality;
    screenWidth = quality / window.innerHeight * window.innerWidth;
    scaleFillNative = Math.max(screenWidth / maxScreenWidth, screenHeight / maxScreenHeight) * pixelDensity;
    gameCanvas.height = screenHeight;
    gameCanvas.width = screenWidth;
    gameCanvas.style.width = window.innerWidth + "px";
    gameCanvas.style.height = window.innerHeight + "px";

    mainContext.setTransform(
        scaleFillNative, 0,
        0, scaleFillNative,
        (screenWidth * pixelDensity - (maxScreenWidth * scaleFillNative)) / 2,
        (screenHeight * pixelDensity - (maxScreenHeight * scaleFillNative)) / 2
    );
    scaleFillNative = Math.max(window.innerWidth / maxScreenWidth, window.innerHeight / maxScreenHeight) * pixelDensity;
    mX = (window.innerWidth * pixelDensity - maxScreenWidth * scaleFillNative) / 2;
    mY = (window.innerHeight * pixelDensity - maxScreenHeight * scaleFillNative) / 2;
    canvasX = (mouseX - mX) / scaleFillNative;
    canvasY = (mouseY - mY) / scaleFillNative;
}
resize();
getEl("quality").addEventListener("keyup", function(e){
    resize();
}, false);
getEl("quality").addEventListener("change", function(e){
    resize();
}, false);

var usingTouch;
const mals = document.getElementById('touch-controls-fullscreen');
mals.style.display = 'block';
mals.addEventListener("mousemove", gameInput, false);
mals.addEventListener("mouseenter", gameInput, false);
mals.addEventListener("mouseleave", gameInput, false);
window.addEventListener("mousemove", gameInput, false);
window.addEventListener("mouseenter", gameInput, false);
window.addEventListener("mouseleave", gameInput, false);
let clickmouse = [];
function mouseInput(e) {
    // ж›ґж–°жЊ‡й‡ќдЅЌзЅ®
}
function gameInput(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    canvasX = (mouseX - mX) / scaleFillNative;
    canvasY = (mouseY - mY) / scaleFillNative;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
}
let clicks = {
    left: false,
    middle: false,
    right: false,
};
mals.addEventListener("mousedown", mouseDown, false);
let coolball = [];
let moveXY = null;
function mouseDown(e) {
    if (attackState != 1) {
        attackState = 1;
        if(joinmenu.style.display === 'block'){
            joinmenu.style.display = 'none';
        } else if(menu.style.display == 'flex'){
            menu.style.opacity = 0;
            setTimeout(()=>{
                if(menu.style.opacity != 1){
                    menu.style.display = 'none';
                }
            },200);
        } else if(getEl("allianceMenu").style.display === 'block'){
            getEl("allianceMenu").style.display = 'none';
        } else if(getEl("storeMenu").style.display === 'block'){
            getEl("storeMenu").style.display = 'none';
        } else if (e.button == 0) {
            clicks.left = true;
            localStorage.setItem("left", "true");
        } else if (e.button == 1) {
            clicks.middle = true;
            localStorage.setItem("middle", "true");
        } else if (e.button == 4) {
            let xOffset = player.x - (maxScreenWidth / 2);
            let yOffset = player.y - (maxScreenHeight / 2);
            moveXY = {x: canvasX + xOffset, y: canvasY + yOffset};
            console.log(moveXY)
        } else if (e.button == 2) {
            clicks.right = true;
            localStorage.setItem("right", "true");
        }
    }
}
mals.addEventListener("mouseup", UTILS.checkTrusted(mouseUp));
localStorage.setItem("left", "false");
localStorage.setItem("middle", "false");
localStorage.setItem("right", "false");

function mouseUp(e) {
    if (attackState != 0) {
        attackState = 0;
        if (e.button == 0) {
            clicks.left = false;
            localStorage.setItem("left", "false");
        } else if (e.button == 1) {
            clicks.middle = false;
            localStorage.setItem("middle", "false");
        } else if (e.button == 2) {
            clicks.right = false;
            localStorage.setItem("right", "false");
        }
    }
}
mals.addEventListener("wheel", wheel, false);
let wbe = 1;

function wheel(e) {
    if (e.deltaY > 0) {
        wbe += 0.2;
    } else {
        wbe -= 0.2;
    }
}



let addHeight = 1;
let addWidth = 1;
function qaz() {
    if(maxScreenHeight > 57600 || maxScreenHeight < 0){
        maxScreenHeight = 1080;
        wbe = 1;
    }
    if(maxScreenWidth > 102400 || maxScreenWidth < 0){
        maxScreenWidth = 1920;
        wbe = 1;
    }
    let size = 1;
    if(getEl("autocam").checked && player && player.speed > -1){
        size = parseFloat(Math.min(1, player.speed/100).toFixed(1)) + 1;
    }
    if (maxScreenHeight != parseInt(config.maxScreenHeight * (wbe * size))) {
        maxScreenHeight += (parseInt(config.maxScreenHeight * (wbe * size)) - maxScreenHeight) / Math.max(1, getEl('smoothlevel').value) * delta / FPS60;
    }
    if (maxScreenWidth != parseInt(config.maxScreenWidth * (wbe * size))) {
        maxScreenWidth += (parseInt(config.maxScreenWidth * (wbe * size)) - maxScreenWidth) / Math.max(1, getEl('smoothlevel').value) * delta / FPS60;
    }
    resize();

}
// INPUT UTILS:
// ---- auto play ---------------------------------------------------------
// A port of the RYN client's AutoPlay module. It circles the nearest enemy
// at a fixed radius, stepping around the ring a fifth of a radian per tick,
// and flips the direction of travel when the next point on the ring is
// blocked by a building -- so it works its way around obstacles instead of
// walking into them.
//
// RYN runs this from postTick(), every tick, and hands the result to its own
// movement system with ModuleHandler.startMovement(). This script has no
// single movement authority to hand an override to -- it sends
// packet(code.move, ...) from a dozen places -- so tick() below does the
// send itself, once per game tick, through the script's own packet().
// (The first version hooked getMoveDir() instead, which the script only
// calls on key press and release, so it produced one direction and then sat
// there. That is why it did not behave like RYN's.)

// the checkbox only exists once the menu is built
function AUTOPLAY_BOX() {
    const box = getEl("autoPlay");
    return !!(box && box.checked);
}

const AUTOPLAY_RADIUS = 80;
const AUTOPLAY_SPEED = 0.2;
// RYN's clearance: the player's own radius. A point closer than
// (object scale + this) to a building is one you cannot stand on.
const AUTOPLAY_CLEARANCE = 35;

const sakAutoPlay = {
    direction: 1,

    reset() {
        this.direction = 1;
    },

    // RYN reads pos.future, falling back to pos.current. This script keeps
    // the previous server position in oldPos each tick, so the next position
    // by linear extrapolation is 2*x2 - oldPos.x2. Before a player's first
    // update oldPos is undefined, which is where the fallback comes in.
    future(p) {
        if (p.oldPos && typeof p.oldPos.x2 == "number" && typeof p.oldPos.y2 == "number") {
            return { x: p.x2 * 2 - p.oldPos.x2, y: p.y2 * 2 - p.oldPos.y2 };
        }
        return { x: p.x2, y: p.y2 };
    },

    blocked(x, y) {
        for (let i = 0; i < gameObjects.length; i++) {
            const obj = gameObjects[i];
            if (!obj.active) continue;
            // Pit traps never block. RYN skips item 15 outright, before any
            // other test, and the game agrees -- the pit trap is the one
            // building with ignoreCollision set. Treating them as walls made
            // this reverse direction constantly on a trapped map.
            if (obj.trap) continue;
            // An enemy's spikes are a damage problem, not a movement one.
            // RYN deliberately circles straight over them -- treating them
            // as walls is what pins you into a corner.
            if (obj.dmg && obj.owner && !obj.isTeamObject(player)) continue;
            if (Math.hypot(x - obj.x, y - obj.y) < obj.scale + AUTOPLAY_CLEARANCE) return true;
        }
        return false;
    },

    // The movement override for this tick, or undefined to leave movement
    // to whatever else the client wants to do with it.
    dir() {
        if (!AUTOPLAY_BOX()) return undefined;
        if (!player || !player.alive) return undefined;
        // your own keys win: getMoveDir() is the client's own reading of
        // what you are holding, and it is undefined when you hold nothing
        if (getMoveDir() !== undefined) return undefined;

        const target = (enemy.length ? near : null);
        if (!target) return undefined;
        if (typeof target.x2 != "number" || typeof target.y2 != "number") return undefined;

        // the ring geometry is done on predicted positions, the way RYN
        // does it, so we aim at where they are going rather than where they
        // were when the last packet landed
        const me = this.future(player);
        const en = this.future(target);

        const current = Math.atan2(me.y - en.y, me.x - en.x);
        let next = current + AUTOPLAY_SPEED * this.direction;
        let tx = en.x + Math.cos(next) * AUTOPLAY_RADIUS;
        let ty = en.y + Math.sin(next) * AUTOPLAY_RADIUS;

        if (this.blocked(tx, ty)) {
            this.direction *= -1;
            next = current + AUTOPLAY_SPEED * this.direction;
            tx = en.x + Math.cos(next) * AUTOPLAY_RADIUS;
            ty = en.y + Math.sin(next) * AUTOPLAY_RADIUS;
        }

        // but the bearing we actually walk is measured from where we are
        // now, not from the prediction -- again as RYN does it
        return Math.atan2(ty - player.y2, tx - player.x2);
    },
    // Once per game tick, the way RYN's postTick does it. Sends through the
    // script's own packet(), and only when the angle has actually moved, so
    // it does not spend the packet budget repeating itself.
    lastSent: undefined,
    tick() {
        const dir = this.dir();
        if (dir === undefined) {
            this.lastSent = undefined;
            return false;
        }
        if (this.lastSent === undefined || Math.abs(dir - this.lastSent) > 0.01) {
            this.lastSent = dir;
            packet(code.move, dir, 1);
        }
        return true;
    },
};

function getMoveDir() {
    let dx = 0;
    let dy = 0;
    for (let key in moveKeys) {
        let tmpDir = moveKeys[key];
        dx += !!keys[key] * tmpDir[0];
        dy += !!keys[key] * tmpDir[1];
    }
    const angle = Math.atan2(dy, dx);

    return dx == 0 && dy == 0 ? undefined : angle;
}

function getSafeDir() {
    if (!player)
        return 0;
    if (!player.lockDir) {
        if (!player.nearBreak) {
            lastDir = Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2));
        }
        else {
            lastDir = player.nearSpikeAim;
        }
    }
    return lastDir || 0;
}

function mouseAim(){
    return Math.atan2(mouseY - (window.innerHeight / 2), mouseX - (window.innerWidth / 2));
}

function getAttackDir() {
    if (!player)
        return 0;

    lastDir = mouseAim();

    if (my.autoAim) {
        lastDir = getEl("weaponGrind").checked ? mouseAim() : enemy.length ? (my.weapon == player.weapons[1]) ? near.aim4 : near.aim2 : mouseAim();
    } else if (attackType && player.reloads[attackType[1]] === 0 && (!getEl("AlwaysAim").checked || (getEl("AlwaysAim").checked && attackType[0] != "cm"))) {
        lastDir = attackType[2];
    } else if (getEl("AlwaysAim").checked) {
        let follower = findPlayerBySID(parseInt(getEl("syncsid").value));
        let aim = 0;
        if(follower){
            if(getEl("AimSyncFollower").checked){
                aim = follower.d2;
            } else if(getEl("AimToFollower").checked){
                aim = follower.aim2;
            }
        }
        lastDir = aim + toRad(getEl("AimToFollowerDir").value);
    } else if(player.lockDir){
        lastDir = lockdir;
    } else if(getEl("spin").checked){
        lastDir = toRad(my.rotate);
    }

    return lastDir || 0;
}

function getVisualDir() {
    if (!player)
        return 0;

    if (my.autoAim) {
        lastDir = getEl("weaponGrind").checked ? getSafeDir() : enemy.length ? my.revAim ? (near.aim2 + Math.PI) : near.aim2 : getSafeDir();
    } else if (clicks.right && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] === 0) {
        lastDir = getSafeDir();
    } else if (traps.inTrap && player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] === 0) {
        lastDir = traps.aim;
    } else if (!player.lockDir) {
        lastDir = getSafeDir();
    }
    return lastDir || 0;
}

// KEYS:
function keysActive() {
    return !(document.activeElement && document.activeElement.matches('input, textarea'));
}


function insta(e){
    if(caninsta && (!getEl("antispiketick").checked || (getEl("antispiketick").checked && checkAntiSpikeTick()))){
        if(e == 1){
            my.autoAim = true;
            caninsta = false;
            attackTime = Date.now();
            my.weapon = player.weapons[1];
            packet(code.aim, getAttackDir());
            selectWeapon(player.weapons[1]);
            UseHat(53);
            UseAcc(21);
            sendAutoGather();
            setTimeout(() => {
                attackTime = Date.now();
                my.weapon = player.weapons[0];
                packet(code.aim, getAttackDir());
                selectWeapon(player.weapons[0]);
                UseHat(7);
                UseAcc(21);
                setTimeout(() => {
                    caninsta = true;
                    my.autoAim = false;
                    sendAutoGather();
                }, 111);
            }, 111);
        } else if(e == 2){
            my.autoAim = true;
            caninsta = false;
            attackTime = Date.now();
            my.weapon = player.weapons[1];
            place(4, getAttackDir(), 1);
            packet(code.aim, getAttackDir());
            selectWeapon(player.weapons[1]);
            UseHat(53);
            UseAcc(21);
            sendAutoGather();
            setTimeout(() => {
                attackTime = Date.now();
                my.weapon = player.weapons[0];
                packet(code.aim, getAttackDir());
                selectWeapon(player.weapons[0]);
                UseHat(7);
                UseAcc(21);
                setTimeout(() => {
                    caninsta = true;
                    my.autoAim = false;
                    sendAutoGather();
                }, 111);
            }, 111);
        } else if(e == 3){
            my.autoAim = true;
            caninsta = false;
            attackTime = Date.now();
            my.weapon = player.weapons[0];
            packet(code.aim, getAttackDir());
            packet(code.move, getAttackDir(), 1);
            selectWeapon(player.weapons[0]);
            UseHat(53);
            UseAcc(21);
            game.tickBase(() => {
                attackTime = Date.now();
                my.weapon = player.weapons[0];
                packet(code.aim, getAttackDir());
                packet(code.move, getAttackDir(), 1);
                selectWeapon(player.weapons[0]);
                UseHat(7);
                UseAcc(21);
                sendAutoGather();
                setTimeout(() => {
                    packet(code.move, getMoveDir(), 1);
                    caninsta = true;
                    my.autoAim = false;
                    sendAutoGather();
                }, 111);
            }, 1);
        } else if(e == 4){
            my.autoAim = true;
            caninsta = false;
            attackTime = Date.now();
            my.weapon = player.weapons[0];
            packet(code.aim, getAttackDir());
            selectWeapon(player.weapons[0]);
            UseHat(53);
            UseAcc(21);
            setTimeout(() => {
                attackTime = Date.now();
                my.weapon = player.weapons[0];
                packet(code.aim, getAttackDir());
                selectWeapon(player.weapons[0]);
                UseHat(7);
                UseAcc(21);
                sendAutoGather();
                setTimeout(() => {
                    my.weapon = player.weapons[1];
                    packet(code.aim, getAttackDir());
                    selectWeapon(player.weapons[1]);
                    UseHat(20);
                    UseAcc(21);
                    setTimeout(() => {
                        caninsta = true;
                        my.autoAim = false;
                        sendAutoGather();
                    }, 111);
                }, 111);
            }, 111);
        } else if(e == 5){
            my.autoAim = true;
            caninsta = false;
            attackTime = Date.now();
            my.weapon = player.weapons[0];
            packet(code.aim, getAttackDir());
            selectWeapon(player.weapons[0]);
            UseHat(7);
            UseAcc(21);
            sendAutoGather();
            setTimeout(() => {
                my.weapon = player.weapons[0];
                packet(code.aim, getAttackDir());
                selectWeapon(player.weapons[0]);
                UseHat(53);
                UseAcc(21);
                sendAutoGather();
                setTimeout(() => {
                    caninsta = true;
                    my.autoAim = false;
                }, 111);
            }, 111);
        } else {
            my.autoAim = true;
            caninsta = false;
            attackTime = Date.now();
            my.weapon = player.weapons[0];
            packet(code.aim, getAttackDir());
            selectWeapon(player.weapons[0]);
            UseHat(7);
            UseAcc(21);
            sendAutoGather();
            setTimeout(() => {
                attackTime = Date.now();
                my.weapon = player.weapons[1];
                packet(code.aim, getAttackDir());
                selectWeapon(player.weapons[1]);
                UseHat(53);
                UseAcc(21);
                setTimeout(() => {
                    caninsta = true;
                    my.autoAim = false;
                    sendAutoGather();
                }, 111);
            },111);
        }
    }
}

let chatcrash = false, clanCrash = false;
function ReTryPro(space, chance) {
    let result = '';
    let characters = document.getElementById("Clan").value;
    let count = 0;
    for (let i = 0; i < characters.length; i++ ) {
        if(Math.floor(Math.random() * chance) == 1 && characters.charAt(i) != document.getElementById("ClanText").value/* && count < chance && characters.charAt(i) != " "*/) {
            result += document.getElementById("ClanText").value;
            count++
        } else {
            result += characters.charAt(i);
        }
    }
    return result;
}
function animate(space, chance) {
    let result = '';
    let characters = document.getElementById("Chat").value;
    if(space) {
        //       characters = characters.padStart((30 - characters.length) / 2 + characters.length)
        //   characters = characters.padEnd(30);
    }
    let count = 0;
    for (let i = 0; i < characters.length; i++ ) {
        if(Math.floor(Math.random() * chance) == 1 && characters.charAt(i) != document.getElementById("ChatText").value/* && count < chance && characters.charAt(i) != " "*/) {
            result += document.getElementById("ChatText").value;
            count++
        } else {
            result += characters.charAt(i);
        }
    }
    return result;
}

function BoostTick() {
    my.weapon = player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0];
    if(player.reloads[my.weapon] === 0){
        caninsta = false;
        place(4, getAttackDir(), 1);
        selectWeapon(my.weapon);
        setTimeout(()=>{
            selectWeapon(my.weapon);
            UseHat(40);
            sendAtck(1, mouseAim() + toRad(180));
            sendAtck(0, mouseAim() + toRad(180));
            setTimeout(()=>{
                caninsta = true;
            }, 120);
        },111);
    }
}
let TogglechatHolder = false;
let Isinsta = false;
let booms = [];
let chatHolderClose = false;
let bowinsta = 0;
let boinstaTime = Date.now(), bowinstas1;
let lastDeath;
let mapMarker = false;
let ramdonXY = false;
let nearobject = false;
let GoToMapMarker = false;
let GoToLastDeath = false;
let GoToRandomXY = false;
let GoToBuild = false;
let GoToAllBuild = false;
let GoToTeamBuild = false;
function setRamdonXY(){
    ramdonXY = {x:Random(35, 14375), y:Random(35, 14375)}
    Text(`x:${ramdonXY.x} y:${ramdonXY.y}`, "#ff0");
    if(ramdonXY.y >= config.mapScale / 2 - config.riverWidth / 2 && ramdonXY.y <= config.mapScale / 2 + config.riverWidth / 2 || UTILS.getDist(ramdonXY, {x: 7185, y: 13165}, 0, 0) < 1000){
        setRamdonXY();
    }
}
function keyDown(event) {
    if(document.activeElement != chatBox){
        chatBox.disabled = (!keysActive());
    }
    let keyNum = event.which || event.keyCode || 0;
    if (keyNum == 13 && chatHolder.style.display == "block") {
        EnaterChat();
        chatHolderClose = true;
    }

    if (player && player.alive) {
        if(keysActive()){
            if (!keys[keyNum]) {
                keys[keyNum] = 1;
                macro[event.key] = 1;
                if(keyNum == 40){
                    clanCrash = !clanCrash;
                }else if(keyNum == 38){
                    chatcrash = !chatcrash;
                } else if (event.key == "P") {
                    isConnectBots = !isConnectBots;
                    connectBots();
                } else if (keyNum == 190 && caninsta) {
                    let speed_1 = near.dist2/1.6;
                    let speed_2 = near.dist2/2.5;
                    let speed_3 = near.dist2/3.6;
                    my.autoAim = true;
                    caninsta = false;
                    packet(code.aim, getAttackDir());
                    selectWeapon(player.weapons[1]);
                    UseHat(53);
                    UseAcc(21);
                    sendAutoGather();
                    setTimeout(()=>{
                        packet(code.aim, getAttackDir());
                        sendUpgrade(12);
                        my.weapon = 12;
                        selectWeapon(my.weapon);
                        UseHat(53);
                        UseAcc(21);
                    }, (speed_1 - speed_2));
                    setTimeout(()=>{
                        packet(code.aim, getAttackDir());
                        sendUpgrade(15);
                        my.weapon = 15;
                        selectWeapon(my.weapon);
                        UseHat(53);
                        UseAcc(21);
                        setTimeout(() => {
                            caninsta = true;
                            my.autoAim = false;
                            sendAutoGather();
                        }, 120);
                    }, (speed_1 - speed_3));
                } else if (keyNum == 97) {
                    circlePlace(2, 0, 180, true, true);
                } else if (keyNum == 98) {
                    GoToLastDeath = false;
                    GoToRandomXY = false;
                    GoToMapMarker = !GoToMapMarker;
                    Text(`GoToMapMarker: ${GoToMapMarker}`, "#ff0")
                } else if (keyNum == 99) {
                    GoToMapMarker = false;
                    GoToRandomXY = false;
                    GoToLastDeath = !GoToLastDeath;
                    Text(`GoToLastDeath: ${GoToLastDeath}`, "#ff0")
                } else if (keyNum == 100) {
                    GoToMapMarker = false;
                    GoToLastDeath = false;
                    GoToRandomXY = !GoToRandomXY;
                    setRamdonXY();
                    Text(`GoToRandomXY: ${GoToRandomXY}`, "#ff0")
                } else if (keyNum == 101) {
                    GoToBuild = !GoToBuild;
                    GoToAllBuild = false;
                    GoToTeamBuild = false;
                    Text(`GoToBuild: ${GoToBuild}`, "#ff0")
                } else if (keyNum == 102) {
                    GoToBuild = false;
                    GoToTeamBuild = false;
                    GoToAllBuild = !GoToAllBuild;
                    Text(`GoToAllBuild: ${GoToAllBuild}`, "#ff0")
                } else if (keyNum == 103) {
                    GoToBuild = false;
                    GoToAllBuild = false;
                    GoToTeamBuild = !GoToTeamBuild;
                    Text(`GoToTeamBuild: ${GoToTeamBuild}`, "#ff0")
                } else if (keyNum == 69) {
                    sendAutoGather();
                } else if (keyNum == 82) {
                    localStorage.setItem("insta", "true");
                    Isinsta = !Isinsta;
                } else if (keyNum == 88) {
                    const dir = Math.atan2(mouseY - (window.innerHeight / 2), mouseX - (window.innerWidth / 2));
                    lockdir = dir;
                    player.lockDir = !player.lockDir;
                } else if (keyNum == 18) {
                } else if (keyNum == 67) {
                    updateMapMarker();
                } else if (player.weapons[keyNum - 49] != undefined) {
                    player.weaponCode = player.weapons[keyNum - 49];
                } else if (moveKeys[keyNum]) {
                    sendMoveDir();
                } else if (event.key == "z") {
                    mills.place = !mills.place;
                } else if (event.key == "Z") {
                    typeof window.debug == "function" && window.debug();
                } else if (keyNum == 32) {
                    sendAtck(1, mouseAim());
                    sendAtck(0, mouseAim());
                }
            }
        }
    }
}
window.addEventListener("keydown", UTILS.checkTrusted(keyDown));
function EnaterChat(){
    if (chatHolder.style.display == "block") {
        if (chatBox.value) {
            sendChat(chatBox.value);
        }
        chatBox.value = "";
        chatHolder.style.display = "none";
    } else {
        storeMenu.style.display = "none";
        allianceMenu.style.display = "none";
        chatHolder.style.display = "block";
        chatBox.focus();
    }
    chatBox.value = "";
}

function keyUp(event) {
    if(document.activeElement != chatBox){
        chatBox.disabled = !keysActive();
    }
    if(chatBox.disabled || chatHolderClose){
        chatHolder.style.display = 'none';
        setTimeout(()=>{
            chatHolder.style.display = 'none';
        },100);
        chatHolderClose = false;
    }

    if (player && player.alive) {
        let keyNum = event.which || event.keyCode || 0;
        if (keyNum == 45) {
        } else if (keysActive()) {
            if (keys[keyNum]) {
                keys[keyNum] = 0;
                macro[event.key] = 0;
                if (moveKeys[keyNum]) {
                    sendMoveDir();
                } else if (keyNum == 71) {
                    packet(code.move, getMoveDir(), 1);
                } else if (event.key == ",") {
                    player.sync = false;
                }
            }
        }
    }
}
window.addEventListener("keyup", UTILS.checkTrusted(keyUp));

function sendMoveDir() {
    let newMoveDir = getMoveDir();
    if (lastMoveDir == undefined || newMoveDir == undefined || Math.abs(newMoveDir - lastMoveDir) > 0.3) {
        packet(code.move, newMoveDir, 1);
        lastMoveDir = newMoveDir;
    }
}

// BUTTON EVENTS:
function bindEvents() { }
bindEvents();


/** PATHFIND TEST */


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
    my.ageInsta = true;
    if (firstSetup) {
        firstSetup = false;
        gameObjects.length = 0;
    }
}
let deadPing = 0;
// ADD NEW PLAYER:
function addPlayer(data, isYou) {
    let tmpPlayer = findPlayerByID(data[0]);
    if (!tmpPlayer) {
        tmpPlayer = new Player(data[0], data[1], config, UTILS, projectileManager,
                               objectManager, players, ais, items, hats, accessories);
        players.push(tmpPlayer);
    }
    let name = (data[2] != "" ? data[2] : "unknown");
    if(!PlayerName[data[1]]){
        addMenuChText("Game", `Found {${data[1]}}${name}`, "yellow");
    } else if(PlayerName[data[1]] != name){
        addMenuChText("Game", `Change {${data[1]}}${PlayerName[data[1]]} to {${data[1]}}${name}`, "yellow");
    }
    PlayerName[data[1]] = name;
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
        Text(`Dead Ping: ${deadPing}ms`, "#f00", 1);
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
            players.splice(i, 1);
            break;
        }
    }
}
function isTeam(tmpObj) {
    return (tmpObj == player || (tmpObj.team && tmpObj.team == player.team));
}
var spamCounts = 0;
// CHECK BULL SPAM:
document.title = "Sakuna Mod v44.5";

// KILL PLAYER:
function killPlayer() {
    petals = [];
    inGame = false;
    lastDeath = {
        x: player.x,
        y: player.y,
    };
    deadPing = window.pingTime;
    if(getEl("autorespawn").checked){
        Spawn();
    }
    document.title = "You Are Dead!";
    setTimeout(()=>{
        document.title = "Sakuna Mod v44.5";
    }, 1e3);
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

// UPDATE PLAYER ITEM VALUES:
function updateItemCounts(index, value) {
    if (player) {
        player.itemCounts[index] = value;
        updateItemCountDisplay(index);
    }
}

function addupgrade(age, list) {
    let Text = `<div class="choose_container">`;
    Text += `<label for="age_${age}">AGE ${age}</label>`;

    list.forEach((item) => {
        let background = null;
        let ID = item.itemAID ? item.itemAID : item.id;

        let upgradeMemory = JSON.parse(localStorage.getItem('upgradeMemory')) || {};
        let upgradememory = Array.isArray(upgradeMemory[age]) ? upgradeMemory[age] : [];
        const upgradememoryitem = upgradememory.filter(e => e.choose)[0];

        let choose = upgradememory.length > 0
            ? upgradememoryitem
                ? (upgradememoryitem.itemAID ? upgradememoryitem.itemAID : upgradememoryitem.id) == ID
                : false
            : [5, 17, 31, 23, 10, 38, 28, 25][age - 2] == ID;

        if (choose) {
            item.choose = true;
        }

        if (item.src) {
            background = "https://moomoo.io/img/weapons/" + item.src + ".png";
        } else {
            const s = document.createElement("canvas");
            const r = s.getContext("2d");
            let tmpSprite = getItemSprite(item, true);
            s.width = s.height = tmpSprite.width;
            if (tmpSprite) {
                r.clearRect(0, 0, s.width, s.height);
                r.drawImage(tmpSprite, 0, 0);
                background = s.toDataURL();
            }
        }

        Text += `<button id="update_${ID}" ${choose ? "class='choose'" : ""} style="background-image: url(${background})"></button>`;

        setTimeout(() => {
            getEl(`update_${ID}`).addEventListener("click", function (e) {
                if (ulist[age].some(a => (a.itemAID ? a.itemAID : a.id) == ID && a.choose)) {
                    ulist[age].forEach((a) => {
                        getEl(`update_${a.itemAID ? a.itemAID : a.id}`).className = "";
                        a.choose = false;
                    });
                } else {
                    ulist[age].forEach((a) => {
                        getEl(`update_${a.itemAID ? a.itemAID : a.id}`).className = a == item ? 'choose' : "";
                        a.choose = a == item ? true : false;
                        if (a.age == 2 && a.id !== 1 && a.id !== 3) {
                            ulist[8].forEach((b) => {
                                let BID = b.itemAID ? b.itemAID : b.id;
                                getEl(`update_${BID}`).className = b.pps ? 'choose' : "";
                                b.choose = b.pps ? true : false;
                            });
                        } else if (a.pre && a.id == ID) {
                            if (a.age == 8) {
                                ulist[a.pre == 9 ? 6 : 2].forEach((b) => {
                                    let BID = b.itemAID ? b.itemAID : b.id;
                                    getEl(`update_${BID}`).className = b.id == a.pre ? 'choose' : "";
                                    b.choose = b.id == a.pre ? true : false;
                                });
                                if (a.pre != 9) {
                                    ulist[9].forEach((b) => {
                                        let BID = b.itemAID ? b.itemAID : b.id;
                                        getEl(`update_${BID}`).className = b.id == 9 ? 'choose' : "";
                                        b.choose = b.id == 9 ? true : false;
                                    });
                                }
                            } else if (a.age == 9) {
                                ulist[6].forEach((b) => {
                                    let BID = b.itemAID ? b.itemAID : b.id;
                                    getEl(`update_${BID}`).className = b.id == 9 ? 'choose' : "";
                                    b.choose = b.id == 9 ? true : false;
                                });
                                ulist[8].forEach((b) => {
                                    let BID = b.itemAID ? b.itemAID : b.id;
                                    getEl(`update_${BID}`).className = (b.id == 12 && !b.pps) ? 'choose' : "";
                                    b.choose = (b.id == 12 && !b.pps) ? true : false;
                                });
                            }
                        }
                    });
                }
                localStorage.setItem('upgradeMemory', JSON.stringify(ulist));
                console.log(JSON.parse(localStorage.getItem('upgradeMemory')))
            });
        });
    });

    Text += `</div>`;
    return Text;
}

function addUpgrade(){
    let list = [...items.weapons, ...items.list]
    list.sort((a, b) => a.age - b.age);
    list.forEach((e)=>{
        if(!ulist[e.age])ulist[e.age] = [];
        ulist[e.age].push(e);
    });
    let Text = ``;
    ulist.forEach((e, a)=>{
        Text += addupgrade(a, e);
    });
    console.log(ulist)
    return Text;
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
let isChoose = false;

// UPDATE UPGRADES:
function updateUpgrades(points, age) {
    player.upgradePoints = points;
    player.upgrAge = age;
    if (points > 0) {
        try{
            ulist[age].forEach(a=> {
                if(a.choose){
                    isChoose = true;
                    packet(code.upgrade, (a.itemAID ? a.itemAID : a.id));
                }
            })
        }catch(e){}
        if(!isChoose){
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
                        packet(code.upgrade, i);
                    });
                    UTILS.hookTouchEvents(tmpItem);
                })(tmpList[i]);
            }
            if (tmpList.length) {
                upgradeHolder.style.display = "block";
                upgradeCounter.style.display = "block";
                upgradeCounter.innerHTML = "" + points + "";
            } else {
                upgradeHolder.style.display = "none";
                upgradeCounter.style.display = "none";
                showItemInfo();
            }
        }
    } else {
        upgradeHolder.style.display = "none";
        upgradeCounter.style.display = "none";
        showItemInfo();
    }
}

function findAllianceBySid(sid) {
    return player.team ? alliancePlayers.find((THIS) => THIS === sid) : null;
}
function caf(e, t) {
    try {
        return Math.atan2((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
    } catch (e) {
        return 0;
    }
}

let BreakBuild = [];
let pl = [];
let mark = [];
let placeCount = 0;
function checkspiketick(){
    let range = items.weapons[player.weapons[0]].range + 35;
    if(player.reloads[player.weapons[0]] === 0 && near.dist2 < 170 && near.dist2 < range && (getEl("spiketick").checked || getEl("spiketicktrap").checked || getEl("spiketicknear").checked) && player.weapons[0] != 8 && caninsta && Date.now() - player.intrapTime > 300){
        return true;
    }
    return false;
}
function angleDiff(a, b) {
    const fullCircle = 2 * Math.PI;
    let diff = Math.abs(a - b) % fullCircle;
    return diff > Math.PI ? fullCircle - diff : diff;
}
// PLACER:
function place(id, rad, rmd) {
    try {
        if (id != undefined) {
            let item = items.list[player.items[id]];
            let tmpS = player.scale + item.scale + (item.placeOffset || 0);
            let tmpX = player.x2 + tmpS * Math.cos(rad);
            let tmpY = player.y2 + tmpS * Math.sin(rad);
            if (getEl("placeVis").checked) {
                placeVisible.push({
                    x: tmpX,
                    y: tmpY,
                    name: item.name,
                    scale: item.scale,
                    dir: rad,
                    id: id,
                    time: Date.now(),
                    visScale: item.visScale
                });
            }
            if ((player.alive && inGame && player.itemCounts[item.group.id] == undefined ? true : player.itemCounts[item.group.id] < (config.isSandbox ? 299 : item.group.limit ? item.group.limit : 99))) {
                let counts = 3;
                selectToBuild(player.items[id]);
                sendAtck(1, rad);
                selectWeapon(player.weaponCode, 1);
                if(Date.now() - attackTime < window.pingTime){
                    sendAtck(1, getAttackDir());
                    sendAtck(0, getAttackDir());
                }
                hitTime = [tmpX, tmpY, Date.now()];
            }
        }
    } catch (e) { }
}


function checkPlace(id, rad) {
    try {
        if (id == undefined) return;
        let item = items.list[player.items[id]];
        let tmpS = player.scale + item.scale + (item.placeOffset || 0);
        let tmpX = player.x2 + tmpS * Math.cos(rad);
        let tmpY = player.y2 + tmpS * Math.sin(rad);
        if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, item.zIndex, player) && secPacket < 97) {
            place(id, rad, 1);
        }
    } catch (e) { }
}
let placelist = [];

let betaspiketick = false;
let retrapangle = 45;
function RETRAP(angle, emy){
    let pl = {
        x: player.x2 + Math.cos(angle) * emy.dist2,
        y: player.y2 + Math.sin(angle) * emy.dist2,
    }
    return UTILS.getDist(pl, emy, 0, 2) < 120
}
function rebuild(angle, id){
    let reTrap = getEl("retrap").checked && enemy.some((emy) => RETRAP(angle, emy)) && (player.inTrap || MoveType.toLowerCase().includes("push") || (!player.inTrap && !spikeTick && !betaspiketick));
    let reSpike = getEl("respike").checked && (near.dist2 < 100 || getEl("retrap").checked || !enemy.some((emy) => RETRAP(angle, emy)));
    return reTrap ? 4 : reSpike ? 2 : id;
}
let cpct = 0;
function circlePlace(id, rad, count, check, checkCanPlace, reBuild) {
    try {
        let item = items.list[player.items[id]];
        let tmpS = player.scale + item.scale + (item.placeOffset || 0);

        const angles = Array.from({ length: Math.max(1, count) }, (_, i) => ({
            positive: rad + toRad(i),
            negative: rad - toRad(i)
        }));

        for (let { positive, negative } of angles) {
            for (let angle of [positive, negative]) {
                let tmpX = player.x2 + tmpS * Math.cos(angle);
                let tmpY = player.y2 + tmpS * Math.sin(angle);
                let canPlace = !pl.some((tmp) => Math.hypot(tmp.y - tmpY, tmp.x - tmpX) <= (tmp.scale + item.scale) * (checkCanPlace? 1 : .5))
                if(canPlace) {
                    if ((check && objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, item.zIndex, player)) || !check){
                        if(reBuild){
                            id = rebuild(angle, id);
                        }
                        pl.push({ x: tmpX, y: tmpY, scale: item.scale });
                        place(id, angle, 1);
                    }
                }
            }
        }

    } catch (e) {
        console.error(e)
    }
}
function calculateAngle(a, b, c) {

    // дЅїз”Ёй¤еј¦е®љзђ†иЁ€з®—е¤ѕи§’ (е–®дЅЌпјљеј§еє?)
    const numerator = a*a + b*b - c*c;
    const denominator = 2 * a * b;
    const cosC = numerator / denominator;

    // иЁ€з®—еј§еє¦дё¦иЅ‰жЏ›з‚єи§’еє¦
    const angleRad = Math.acos(cosC);
    const angleDeg = angleRad * (180 / Math.PI);

    return {
        angle: angleRad,
    };
}
function nearBuild(array, id){
    if(array.length > 0){
        array.forEach(tmp =>{
            let aim = UTILS.getDirect(tmp, player, 0, 2);
            circlePlace(id, aim, 90, true, true, true)
        });
    }
}
function breakBuildPlace(){
    BreakBuild.forEach((tmp) => {
        if(Math.hypot(tmp.y - player.y2, tmp.x - player.x2) < 100){
            let aim = Math.atan2(tmp.y - player.y2, tmp.x - player.x2);
            circlePlace(near.distPing > 250 ? 4 : 2, aim, 1, true, false, true);
        }
    });
}
function autoPlace() {
    if (enemy.length && getEl("autoplace").checked && items.list[player.items[4]] && secPacket < 97) {
        if (newGameObjects.length) {

            let buildaim = BreakBuild.length > 0 ? Math.atan2(BreakBuild[0].y - player.y2, BreakBuild[0].x - player.x2) > 600 ? near.aim2 : Math.atan2(BreakBuild[0].y - player.y2, BreakBuild[0].x - player.x2) : near.aim2;
            if (near.distPing <= config.isSandbox ? 400 : 200) {
                let nearbuild = newGameObjects.filter(tmp => tmp.active && UTILS.getDist(tmp, player, 0, 2) < 135);
                if (near.distPing <= config.isSandbox ? 200 : 150) {
                    if(items.list[player.items[4]].id === 15){
                        if(near.inTrap){
                            let spike = items.list[player.items[2]];
                            let trap = items.list[player.items[4]];

                            let aim = Math.atan2(near.y2 - near.inTrap.y, near.x2 - near.inTrap.x);
                            let aim2 = Math.atan2(player.y2 - near.inTrap.y, player.x2 - near.inTrap.x);
                            let place = {
                                x: near.inTrap.x + Math.cos(aim) * (trap.scale + spike.scale*1.11 + (spike.placeOffset || 0)),
                                y: near.inTrap.y + Math.sin(aim) * (trap.scale + spike.scale*1.11 + (spike.placeOffset || 0))
                            }
                            let place2 = {
                                x: player.x2 + Math.cos(aim2) * (player.scale + spike.scale*1.11 + (spike.placeOffset || 0)),
                                y: player.y2 + Math.sin(aim2) * (player.scale + spike.scale*1.11 + (spike.placeOffset || 0))
                            }

                            let spikeaim = Math.atan2(place.y - player.y2, place.x - player.x2);
                            let S = (player.scale + spike.scale + (spike.placeOffset || 0));
                            let Spike = {
                                x: player.x2 + Math.cos(spikeaim) * S,
                                y: player.y2 + Math.sin(spikeaim) * S
                            }

                            if(Math.hypot(place.x - Spike.x, place.y - Spike.y) < 20){
                                circlePlace(2, spikeaim, 45, true, true, true);
                            } else {
                                if(config.isSandbox) {
                                    nearBuild(nearbuild, 2);
                                    circlePlace(2, aim2, 90, true, true, true);
                                } else {
                                    circlePlace(2, aim, 45, true, true, true);
                                }
                            }
                        } else {
                            if(config.isSandbox){
                                breakBuildPlace();
                                nearBuild(nearbuild, 4);
                                circlePlace(4, near.aimPing, 180, true, true, true);
                            } else {
                                circlePlace(4, near.aimPing, 10, true, true, true);
                            }
                        }
                    }
                } else if(items.list[player.items[4]].id === 15){
                    if(config.isSandbox){
                        breakBuildPlace();
                        circlePlace(4, near.aim2,180, true, true, true);
                        nearBuild(nearbuild, 4);
                    } else {
                        circlePlace(4, near.aim2, 1 , true, true, true);

                    }
                }
            }
        }
    }
};
let spikeTick = false;
// KILL OBJECT:
function killObject(sid) {

    let findObj = findObjectBySid(sid);
    objectManager.disableBySid(sid);
    if(findObj){
        try{
            if (player) {
                if (!player.canSee(findObj)) {
                    breakTrackers.push({
                        x: findObj.x,
                        y: findObj.y
                    });
                }
                if (breakTrackers.length > 8) {
                    breakTrackers.shift();
                }
            }
        }catch(e){}
        let objAim = Math.atan2(findObj.y - player.y2, findObj.x - player.x2);
        let objDist = Math.hypot(findObj.y - player.y2, findObj.x - player.x2);
        if(objDist <= 600){
            BreakBuild.push(findObj);
            BreakBuild = BreakBuild.filter(tmp => Math.hypot(player.pingX - tmp.x, player.pingY - tmp.y) <= 600).sort(function (a, b) {
                return UTILS.getDist(a, player, 0, 99) - UTILS.getDist(b, player, 0, 99);
            });
        }
        if(near.distPing <= 300 && objDist <= 300 && enemy.length){
            try{
                if(near.distPing <= (items.weapons[near.primaryIndex].range + 70)){
                    onlySoldier = Date.now();
                }
            }catch(e){}
            let range = items.weapons[player.weapons[0]].range + 70;
            let objnearDist = Math.hypot(findObj.y - near.y2, findObj.x - near.x2);

            if (objDist < 170 && objnearDist < 90 && objDist < range && getEl("spiketick").checked && checkspiketick()) {
                spikeTick = true;
                circlePlace(2, objAim, 90, true, true, true);
            }
            if(getEl("autoreplace").checked){
                let nearbuild = newGameObjects.filter(tmp => tmp.active && UTILS.getDist(tmp, player, 0, 2) < 135);
                breakBuildPlace();
                nearBuild(nearbuild, 4);
                circlePlace(4, near.aimPing, 180, true, true, true);
            }
        }
    }
}
// KILL ALL OBJECTS BY A PLAYER:
function killObjects(sid) {
    if(getEl("PlayerLeaveChat").checked){
        textChat(getEl("playerleavechat").value, { "{player}": PlayerName[sid], "{sid}": sid });
    }
    addMenuChText("Game", `{${sid}}${PlayerName[sid]} left the game`, "yellow");
    Text(`{${sid}}${PlayerName[sid]} left the game`, "#ff0");
    if (player) objectManager.removeAllItems(sid);
}
let AT = 'none';
let caninsta = true;
// UPDATE PLAYER DATA:
let PD = [];
let alertInterval;
let audioContext;

let DAMAGE;
let healDelay = 0;
let autoHit = false;
let reSync = false;
let antibullHit = false;
let needantiinsta = false;
let isGetHit = false;
// UPDATE HEALTH:
function updateHealth(sid, value) {
    tmpObj = findPlayerBySID(sid);
    if(value < 0){
        tmpObj.ShameList = {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
            6: 0,
            7: 0,
        };
        if(isNaN(playerdeadtime[sid]))playerdeadtime[sid] = 0;
        playerdeadtime[sid]++;
        deadid = sid;
        if(getEl("PlayerDeadChat").checked){
            textChat(getEl("playerdeadchat").value, { "{kills}": value, "{player}": PlayerName[deadid], "{sid}": deadid, "{deadtimes}": playerdeadtime[deadid] });
        }
        addMenuChText("Game", `{${deadid}}${PlayerName[deadid]} is dead`, "red");
        Text(`{${deadid}}${PlayerName[deadid]} is dead`, "#ff0");
    }
    if (tmpObj) {
        tmpObj.oldHealth = tmpObj.health;
        tmpObj.health = value;
        let d = tmpObj.oldHealth - tmpObj.health;
        if(d > 0){
            ShowText(tmpObj.x, tmpObj.y, Math.round(d), -d);
            healshowtext = {
                x: tmpObj.x,
                y:tmpObj.y,
                value: d,
                time: Date.now()
            };
        }

        if (tmpObj.oldHealth < tmpObj.health) {
            if(tmpObj === player){
            }
            if (tmpObj.hitTime) {
                let timeSinceHit = Date.now() - tmpObj.hitTime;
                let tmpShame = tmpObj.shameCount;
                let pingSince = Math.max(120, window.pingTime);
                tmpObj.hitTime = 0;
                tmpObj.ping = timeSinceHit <= 120 && timeSinceHit > 0 ? timeSinceHit : timeSinceHit - 120;
                if (timeSinceHit <= 120 && timeSinceHit > 0) {
                    tmpObj.shameCount += 1;
                    if (tmpObj.shameCount > tmpObj.maxShame) {
                        tmpObj.maxShame = tmpObj.shameCount;
                    }
                    if (tmpObj.maxShame > 7) {
                        tmpObj.maxShame = 7;
                    }
                } else {
                    if(tmpObj.shameCount < 8){
                        tmpObj.ShameList[tmpObj.shameCount]++;
                    }
                    tmpObj.shameCount = Math.max(0, tmpObj.shameCount - 2);
                    tmpObj.addmaxShameTime++;
                    player.BTC = player.shameCount;
                    if(tmpObj.addmaxShameTime > 5 && tmpObj.shameCount < tmpObj.maxShame){
                        tmpObj.maxShame--;
                        tmpObj.addmaxShameTime = 0;
                    }
                    if(tmpObj === player){
                        cananti = true;
                    }
                }
            }
        } else if (tmpObj.oldHealth > tmpObj.health) {
            tmpObj.hitTime = Date.now();
            tmpObj.hitted = true;
            tmpObj.damaged = true;

            if(tmpObj == player){
                let damage = tmpObj.oldHealth - tmpObj.health;
                DAMAGE = damage;
                if(getEl("antibull").checked){
                    if(damage > 50 && player.reloads[player.weapons[0]] === 0 && player.skinIndex == 11){
                        antibullHit = true;
                        packet(code.move, near.aimPing, 1)
                    }
                }
                if (AntiTimes > 0 && player.health < 76) {
                    if(antiinsta()[0]){
                        let amount = 100 / items.list[player.items[0]].healing;
                        for (let i = 0; i < amount; i++) {
                            place(0, mouseAim());
                        }
                        if(AntiTimes == 1){
                            Text("Anti Insta", "#f00");
                        } else {
                            Text("Anti Rev Insta", "#f00");
                        }
                    }
                    AntiTimes = 0;
                    AntiTime = Date.now();
                }
                if(getEl("lowheal").checked && Date.now() - AntiTime > (111 + window.pingTime) && player.health <= (player.skinIndex === 6 ? 23 : 30) && player.shameCount < 6 && Date.now() - LowHealTime > 60 && cananti){
                    LowHealTime = Date.now();
                    heal();
                    onlySoldier = Date.now();
                    Text("Low heal", "#ff5521");
                }
                if (tmpObj.skinIndex == 7 && (damage == 5 || (tmpObj.tailIndex == 13 && damage == 2))) {
                    player.bullTick = game.tick;
                    reSync = false;
                }
            }
            //                               console.log(damage);
        }
    }
}
let HealTime = Date.now(),
    AntiTime = Date.now(),
    AntiTimes = 0,
    lsatAntiTime = Date.now(),
    LowHealTime = Date.now(),
    AntiSpikeTime = Date.now(),
    PlaceTime = Date.now(),
    cananti = true;
let cht = Date.now();
let checkTime = 0;
let checklist = [];
let abush = true;
let hatlist = [];
let hatcount = 0;
let acclist = [];
let acccount = 0;
function funnyHat(){
    hatlist = [];
    try{
        if(assassin){
            hatlist.push(56);
        }
    }catch(e){}
    try{
        if(getEl("bushmode").checked){
            hatlist.push(10);
        }
    }catch(e){}
    try{
        if(getEl("policemode").checked){
            hatlist.push(8);
            hatlist.push(15);
        }
    }catch(e){}
    if(hatlist.length > 0){
        hatlist = hatlist.sort(function (a, b) { return a - b});
    }
    try{
        if(getEl("allhatmode").checked){
            hatlist = [];
            for(let i=1;i<hats.length;i++){
                hatlist.push(hats[i].id);
            }
        }
    }catch(e){}
    try{
        let hatid = false;
        if(hatlist.length > 0){
            if(hatlist[hatcount]){
                hatid = hatlist[hatcount];
            }
            hatcount++;
        }
        if(hatcount >= hatlist.length)hatcount = 0;
        return hatid;
    }catch(e){
        return false;
    }
}
function funnyAcc(){
    acclist = [];
    try{
        if(getEl("blackandwhiteangelmode").checked){
            acclist.push(13);
            acclist.push(19);
        }
    }catch(e){}
    if(acclist.length > 0){
        acclist = acclist.sort(function (a, b) { return a - b});
    }
    try{
        if(getEl("allaccmode").checked){
            acclist = [];
            for(let i=0;i<accessories.length;i++){
                acclist.push(accessories[i].id);
            }
        }
    }catch(e){}
    try{
        let accid = false;
        if(acclist.length > 0){
            if(acclist[acccount]){
                accid = acclist[acccount];
            }
            acccount++;
        }
        if(acccount >= acclist.length)acccount = 0;
        return accid;
    }catch(e){
        return false;
    }
}
let funnyhat = funnyHat();
let funnyacc = funnyAcc();


function AutoHatAcc(){
    if (storeMenu.style.display != "block" && caninsta) {
        let UseHatId = 0, UseAccId = 0;
        if(attackType && my.waitHit == 1){
            if(isticking){
                UseHatId = 6;
            } else if(Date.now() - onlyEmp < 120){
                UseHatId = 22;
            } else if((((Date.now() - PrioritySoldier < 300 && getEl("PrioritySoldier").checked) || !checkAntiSpikeTick() || (emySpikeHit && getEl("antispiketick").checked)) && (player.nearBreakType != "NearSpikes" || (!player.inTrap && player.nearBreakType === "NearSpikes")))){
                UseHatId = 6;
            } else if(attackType[0] == "cr"){
                UseHatId = 40;
            } else if(attackType[0] == "cl"){
                UseHatId = getEl("weaponGrind").checked ? 40 : 7;
            } else if(attackType[0] == "cm"){
                if(player.reloads[53] === 0 && near.dist2 <= 700 && near.skinIndex != 22 && player.skins[53]){
                    UseHatId = 53;
                } else {
                    UseHatId = 20;
                }
            } else if(attackType[0] == "nb" || attackType[0] == "bt"){
                UseHatId = 40;
            } else if(attackType[0] == "bs"){
                UseHatId = 7;
            }
        }else if(near && near.distPing < 300 && enemy.length){
            if(isticking){
                UseHatId = 6;
            } else if(Date.now() - onlyEmp < 120){
                UseHatId = 22;
            } else if((((Date.now() - PrioritySoldier < 300 && getEl("PrioritySoldier").checked) || !checkAntiSpikeTick() || (emySpikeHit && getEl("antispiketick").checked)) && (player.nearBreakType != "NearSpikes" || (!player.inTrap && player.nearBreakType === "NearSpikes")))){
                UseHatId = 6;
            } else if(Date.now() - onlyEmp < 100 || turretEmp > 0 || enemy.some((tmp) => Math.abs(UTILS.getDist(tmp, player, 2, 2) - 680) < 35 && (!tmp.secondaryIndex || tmp.secondaryIndex == 9))){
                UseHatId = 22;
            } else if(my.reSync) {
                UseHatId = 7;
            } else if(traps.inTrap && HasNearSpikes) {
                UseHatId = 6;
            } else if(antibull) {
                UseHatId = 11;
            } else if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2 && !player.zIndex) {
                UseHatId = 31;
            } else if(funnyhat) {
                UseHatId = funnyhat;
            } else {
                UseHatId = 6;
            }
        } else {
            if(Date.now() - onlySoldier < 100){
                UseHatId = 6;
            } else if(turretEmp > 0 || Date.now() - onlyEmp < 100 || enemy.some((tmp) => Math.abs(UTILS.getDist(tmp, player, 2, 2) - 680) < 35 && (!tmp.secondaryIndex || tmp.secondaryIndex == 9))){
                UseHatId = 22;
            } else if(my.reSync) {
                UseHatId = 7;
            } else if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2 && !player.zIndex) {
                UseHatId = 31;
            } else if(funnyhat) {
                UseHatId = funnyhat;
            } else if(player.moveDir == undefined && MoveType == 'none' && !attackType){
                UseHatId = 6;
            } else if (player.y2 <= config.snowBiomeTop) {
                UseHatId = 15;
            } else {
                UseHatId = 12;
            }
        }
        if(funnyacc) {
            UseAccId = funnyacc;
        } else {
            UseAccId = (((near && near.distPing < 300) || (attackType && (attackType[0] == "cl" || attackType[0] == "bs"))) && items.weapons[player.weapons[0]].dmg > 5) ? getEl("antibull").checked ? 21 : 19 : 11;
        }
        UseHat(UseHatId);
        UseAcc(UseAccId);
    }
}
let HoldTime = Date.now(), HasNearSpikes;
function HoldPlace(id){
    let item = items.list[player.items[id]];
    let tmpS = player.scale + item.scale + (item.placeOffset || 0);
    for(let i=0;i<360;i++){
        let angle = toRad(i);
        let tmpX = player.x2 + tmpS * Math.cos(angle);
        let tmpY = player.y2 + tmpS * Math.sin(angle);
        if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, item.zIndex, player) && placeCount < 4) {
            i+=Math.hypot(item.scale, item.scale)*1.1;
            place(id, angle, 1);
        }
    }
}
let assassin = false;
let isClose = false;
let HighPingCantAnti = false;
let HighPingHealTime = Date.now(), highPing = false,walkTime = Date.now(), lagPing = 0, isanti = false;
function check() {
    let Now = Date.now();
    if(player && player.health > 0){
        placeVisible = placeVisible.filter(item => (Now - item.time) <= 120);
        checklist.push(Now);
        checklist = checklist.filter(time => Now - time < 1e3);
        let hasNearSpikes = newGameObjects.some(tmp => ((tmp.type == 1 && tmp.y >= config.mapScale - config.snowBiomeTop && getEl("movementassistcactus").checked) || (tmp.dmg && tmp.active && !tmp.isTeamObject(player))) && UTILS.getDist(tmp, player, 0, 3) <= (player.scale*2 + tmp.getScale()));
        if(hasNearSpikes){
            if(!HasNearSpikes){
                //     Text("Near Spike", "#ff0");
                HasNearSpikes = true;
            }
            onlySoldier = Now;
        } else if(HasNearSpikes){
            HasNearSpikes = false;
        }
        if(player.skinIndex != 45){
            let needHeal = false;
            if (getEl("nearspike").checked && newGameObjects.length) {
                let spikedmg = 0;
                newGameObjects.forEach((tmp) => {
                    if (tmp.active) {
                        if (((tmp.type == 1 && tmp.y >= config.mapScale - config.snowBiomeTop && getEl("movementassistcactus").checked) || (tmp.dmg && tmp.active && !tmp.isTeamObject(player))) && Now - AntiSpikeTime > 60 && player.shameCount < 7 && Math.hypot(player.y3 - tmp.y, player.x3 - tmp.x) <= 140) {
                            spikedmg += tmp.dmg;
                        }
                    }
                });
                if(spikedmg >= player.health){
                    AntiSpikeTime = Now;
                    PrioritySoldier = Now;
                    onlySoldier = Now;
                    UseHat(6);
                    needHeal = true;
                    Text("Anti Spike: " + spikedmg, "#ff5521");
                }
            }
            if (AntiTimes > 0 && player.health < 76) {
                if(antiinsta()[0]){
                    needHeal = true;
                    if(AntiTimes == 1){
                        Text("Anti Insta", "#f00");
                    } else {
                        Text("Anti Rev Insta", "#f00");
                    }
                }
                AntiTimes = 0;
                AntiTime = Date.now();
            }

            if(Now - HoldQ < HoldQTime && getEl("antibowinsta").checked && Now - HoldTime > 60 && player.shameCount < 6){
                HoldTime = Now;
                needHeal = true;
                onlySoldier = Now;
                Text("Anti Bow Heal", "#fff");
            }
            if(macro.q && Now - HoldTime > 60){
                place(0, getAttackDir());
                HoldTime = Now;
                onlySoldier = Now;
                if(getEl("PrioritySoldier").checked){
                    PrioritySoldier = Now;
                }
            }

            if (getEl("autoheal").checked && Now - AntiTime > 120 && Now - player.hitTime > (120 - (getEl("highping").checked ? window.pingTime*.8 : 0)) && Now - HealTime > 120 && player.food >= (config.isSandbox ? 0 : player.items[0] === 0 ? 10 : player.items[0] === 1 ? 15 : 25) && player.health < (config.isSandbox ? 100 : 95) && player.skinIndex != 45) {
                HealTime = Now;
                needHeal = true;
                Text("Auto Heal", "#fff");
                cananti = true;
            }

            if(needHeal){
                heal();
            }
        }
        if(Date.now() - AntiTime > 300){
            AntiTimes = 0;
            needantiinsta = false;
        }
        if(WS !== undefined && performance.now() - game.lastTick > 1e4 && !isClose){
            WS.close();
            console.log("close")
            isClose = true;
        }
        bot.forEach(ws => {
            try{
                if (Now - ws.player.hitTime > 120 && Now - ws.HealTime > 120 && ws.player.health < 100) {
                    ws.HealTime = Now;
                    ws.heal();
                }
            }catch(e){}
        });
    }

}


let status = document.createElement("div");
status.id = "mainStatus";
document.getElementById("gameUI").appendChild(status);

let pinglist = [];
let agping = 0;
let inSandbox = window.location.host.includes("sandbox");
let eatFoodTime = Date.now();
let hc = 0;
function heal(e) {
    if (player.food >= (config.isSandbox ? 0 : player.items[0] === 0 ? 10 : player.items[0] === 1 ? 15 : 25) && player.health < (config.isSandbox ? 100 : 95) && player.skinIndex != 45) {
        eatFoodTime = Date.now();
        let amount = (100 - player.health) / items.list[player.items[0]].healing;
        let useAssassin = false;
        if(player.skins[56] && getEl("assassinmode").checked && (getEl("alwaysassassinmode").checked || Date.now() - AssassinTime > 1e3)){
            UseHat(6);
            useAssassin = true;
        }
        for (let i = 0; i < amount; i++) {
            place(0, mouseAim());
        }
        if(useAssassin){
            UseHat(56);
        }
    }
}
let IsSpikeTick = false;
let battack = null;
let hht = Date.now();
let turretEmp = 0;
let attackType = null;
let shootlist = [];
let hitlist = [];
let isMove = false, moveType = 'none';
let HaveMove = false;
let attackTime = Date.now();
let HatId = 0, AccId = 0;
let bownear = [];
let bowNear = [];
let chatTime = Date.now(),clanTime = Date.now();
let walkaim = undefined;
function checkShoot(checker, tmp){
    try{
        let range = checker.secondaryIndex == 10 ? 75 : 400;//checker.secondaryIndex == 15 ? 1400 : checker.secondaryIndex == 9 ? 1000 : (checker.secondaryIndex == 12 || checker.secondaryIndex == 13) ? 1200 : checker.secondaryIndex == 10 ? 75 : 0;
        let dist = UTILS.getDist(checker, tmp, 2, 2);
        if (dist <= range && player.reloads[checker.secondaryIndex] == 0) {
            let dmg = 0;
            if(checker.reloads[checker.secondaryIndex] == 0){
                dmg += items.weapons[checker.secondaryIndex].Pdmg
            }
            if(checker.reloads[53] == 0 && tmp.skinIndex != 22 && dist < 700){
                dmg += 25;
            }
            let canshoot = Math.round(dmg * .77);
            const angleToTarget = Math.atan2(tmp.y2 - checker.y2, tmp.x2 - checker.x2);
            newGameObjects.forEach((obj) => {
                if (obj.active) {
                    let distToObj = Math.hypot(checker.x2 - obj.x, checker.y2 - obj.y);
                    if (distToObj <= range && distToObj <= dist) {
                        const closestX = checker.x2 + Math.cos(angleToTarget) * distToObj;
                        const closestY = checker.y2 + Math.sin(angleToTarget) * distToObj;
                        const distToClosestPoint = Math.hypot(closestX - obj.x, closestY - obj.y);

                        if (distToClosestPoint <= (obj.scale + 20) && ((checker.zIndex && !obj.platformHit) || !checker.zIndex) && !obj.ignoreCollision) {
                            canshoot = 0;
                        }
                    }
                }
            });
            ais.forEach((animal) => {
                if (animal.visible) {
                    let distToObj = Math.hypot(checker.x2 - animal.x2, checker.y2 - animal.y2);
                    if (distToObj <= range && distToObj <= dist) {
                        const closestX = checker.x2 + Math.cos(angleToTarget) * distToObj;
                        const closestY = checker.y2 + Math.sin(angleToTarget) * distToObj;
                        const distToClosestPoint = Math.hypot(closestX - animal.x2, closestY - animal.y2);

                        if (distToClosestPoint <= (animal.scale + 20)) {
                            canshoot = 0;
                        }
                    }
                }
            });

            return canshoot;
        }
    }catch(e){}
    return 0;
}
function checkHit(checker, tmp){
    try{
        if (UTILS.getDist(checker, tmp, 2, 2) <= (items.weapons[checker.primaryIndex].range + 20) && checker.reloads[checker.primaryIndex] == 0) {
            let pV = checker.primaryVariant != undefined ? config.weaponVariants[checker.primaryVariant].val : 1;
            let dmg = Math.round(items.weapons[checker.primaryIndex].dmg * pV * 1.5 * .77);
            return dmg;
        }
    }catch(e){}
    return 0;
}
function calculateMeanAngle(anglesRad) {
    let sumX = 0, sumY = 0;

    anglesRad.forEach(angle => {
        sumX += Math.cos(angle);
        sumY += Math.sin(angle);
    });

    const meanX = sumX / anglesRad.length;
    const meanY = sumY / anglesRad.length;

    let meanAngle = Math.atan2(meanY, meanX);

    // зўєдїќи§’еє¦ењ? 0~2ПЂ зЇ„ењЌе…?
    if (meanAngle < 0) meanAngle += 2 * Math.PI;

    return meanAngle;
}

function autobreak(build, text) {
    if (build.length > 0) {
        const buildsByDirection = [];
        const angleStep = (2 * Math.PI) / 360; // 1еє¦е°Ќж‡‰зљ„еј§еє¦

        // йЃЌж­·ж‰Ђжњ‰ж–№еђ‘пј€0~2ПЂпј?
        for (let i = 0; i < 2 * Math.PI; i += angleStep) {
            const canBuild = [];
            const Break = {
                x: player.x3 + Math.cos(i) * 35,
                y: player.y3 + Math.sin(i) * 35
            };

            build.forEach(tmp => {
                const aim = UTILS.getDirect(tmp, Break, 0, 0); // еЃ‡иЁ­ getDirect иї”е›ћеј§еє¦
                if (angleDiff(i, aim) < Math.PI / 2) { // 90еє? = ПЂ/2
                    canBuild.push(tmp);
                }
            });

            buildsByDirection.push(canBuild);
        }

        if (buildsByDirection.length > 0) {
            // ж‰ѕе‡єжњЂе¤ље»єзЇ‰зљ„ж–№еђ‘
            const bestDirection = buildsByDirection.reduce((maxList, currentList) => currentList.length > maxList.length ? currentList : maxList, []);

            // жЊ‰иЎЂй‡ЏжЋ’еє?
            const sortedByHealth = [...bestDirection].sort((a, b) => a.health - b.health);

            // иЁ€з®—е№іеќ‡и§’еє¦
            const angles = sortedByHealth.map(tmp =>
                                              UTILS.getDirect(tmp, player, 0, 3)); // еЃ‡иЁ­ getDirect иї”е›ћеј§еє¦

            const meanAngle = calculateMeanAngle(angles);

            // ж›ґж–°зЋ©е®¶з‹Ђж…?
            battack = [
                player.x3 + Math.cos(meanAngle) * 70,
                player.y3 + Math.sin(meanAngle) * 70,
            ];
            player.nearBreakType = text;
            player.nearBreak = true;
            player.nearBreakAim = meanAngle;
            player.nearBreakbuild = sortedByHealth[0];
        }
    }
}
let emySpikeHit = false;
let emySpikes = [];
let autopushType = 'none';
let preplaceTime = Date.now(), autoplaceTime = Date.now();
let antibull = false;
let spiketickmoveType = 'none';
let lastPing = Date.now();
let pingDelay = [];
let isMoveBow = false;
function isOnScreen(x, y, s) {
    return (x + s >= 0 && x - s <= maxScreenWidth && y + s >= 0 && (y,
                                                                    s,
                                                                    maxScreenHeight));
}
let closestReachableEnd = null;
let path = [];
let isNavigablelist = [];
let cantFindpath = false;
let MoveType = "none";
let whileChat, whileChatcount = 0, whileChatTime = Date.now();
let preplace = [];
function updatePlayers(data) {
    try{
        if(typeof player.moveDir == 'number'){
            AssassinTime = Date.now();
        }
        assassin = (getEl("assassinmode").checked && (getEl("alwaysassassinmode").checked || currentTime - AssassinTime > 1e3));

        try{
            newGameObjects = gameObjects.filter(tmp => (Math.abs(tmp.x - player.x) < (maxScreenWidth/2 + tmp.getScale()) * (tmp.type? 2.5 : 1) && Math.abs(tmp.y - player.y) < (maxScreenHeight/2 + tmp.getScale()) * (tmp.type? 2.5 : 1)));
        } catch (e) {
        }

        my.rotate = (my.rotate + Math.max(-360, parseFloat(getEl("spinSpeed").value))) % 360;
        game.tick++;
        if(player.shameCount == 0 && (game.tick - player.bullTick) % 9 == 0){
            player.bullTick = game.tick;
        }
        if((game.tick - player.bullTick) >= 18 && player.shameCount > 0 && player.skinIndex != 45 && player.skins[7]){
            reSync = true;
        }
        shootlist = [];
        hitlist = [];
        enemy = [];
        nears = [];
        near = [];
        bownear = [];
        bowNear = [];
        turretEmp = 0;
        HaveMove = false;
        antibull = false;
        game.tickSpeed = performance.now() - game.lastTick;
        game.lastTick = performance.now();
        if(game.tick % (getEl("highping").checked ? 3 : 9) == 0){
            isPingSend = true;
            packet(code.ping);
        }
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
                tmpObj.xs = (tmpObj.x2 - tmpObj.oldPos.x2);
                tmpObj.ys = (tmpObj.y2 - tmpObj.oldPos.y2);
                tmpObj.speed = ~~(UTILS.getDist(tmpObj, tmpObj.oldPos, 2, 2));
                if(tmpObj.speed > 0){
                    tmpObj.aims = UTILS.getDirect(tmpObj, tmpObj.oldPos, 2, 2);
                }
                let gear = {
                    skin: findID(hats, this.skinIndex),
                    tail: findID(accessories, this.tailIndex)
                }
                let spdMult = 37 * ((tmpObj.weaponIndex != 0) ? items.weapons[tmpObj.weaponIndex].spdMult : 1) * ((hats.find(e => e.id == tmpObj.skinIndex && e.spdMult)) ? hats.find(e => e.id == tmpObj.skinIndex).spdMult : 1) * ((accessories.find(e => e.id == tmpObj.tailIndex && e.spdMult)) ? accessories.find(e => e.id == tmpObj.tailIndex).spdMult : 1) * ((tmpObj.y < config.snowBiomeTop) ? tmpObj.skinIndex == 15 ? 1 : .75 : 1);
                tmpObj.maxSpeed = ~~(spdMult);
                tmpObj.nx = tmpObj.x2 + Math.cos(tmpObj.aims)*100;
                tmpObj.ny = tmpObj.y2 + Math.sin(tmpObj.aims)*100;
                tmpObj.distn = Math.hypot(tmpObj.nx - player.x2, tmpObj.ny - player.y2)
                tmpObj.aimwalk = Math.atan2(tmpObj.ny - player.y2, tmpObj.nx - player.x2);
                tmpObj.x3 = (tmpObj.x2 + tmpObj.xs);
                tmpObj.y3 = (tmpObj.y2 + tmpObj.ys);
                tmpObj.pingaddX = (tmpObj.xs / game.tickSpeed * window.pingTime);
                tmpObj.pingaddY = (tmpObj.ys / game.tickSpeed * window.pingTime);
                tmpObj.pingX = tmpObj.x2 + tmpObj.pingaddX;
                tmpObj.pingY = tmpObj.y2 + tmpObj.pingaddY;
                tmpObj.aimPing = UTILS.getDirect(tmpObj, player, 99, 99);
                tmpObj.distPing = UTILS.getDist(tmpObj, player, 99, 99);
                tmpObj.dist2 = UTILS.getDist(tmpObj, player, 2, 2);
                tmpObj.aim2 = UTILS.getDirect(tmpObj, player, 2, 2);
                tmpObj.dist3 = UTILS.getDist(tmpObj, player, 3, 3);
                tmpObj.x4 = tmpObj.x2 + tmpObj.xs * (tmpObj.dist3 / (player.weapons[1] == 15 ? 3.6 : player.weapons[1] == 13 ? 2 : player.weapons[1] == 12 ? 2.5 : player.weapons[1] == 9 ? 1.6 : 1)) * (game.tickSpeed + window.pingTime);
                tmpObj.y4 = tmpObj.y2 + tmpObj.ys * (tmpObj.dist3 / (player.weapons[1] == 15 ? 3.6 : player.weapons[1] == 13 ? 2 : player.weapons[1] == 12 ? 2.5 : player.weapons[1] == 9 ? 1.6 : 1)) * (game.tickSpeed + window.pingTime);
                tmpObj.aim4 = Math.atan2(tmpObj.y4 - player.y3, tmpObj.x4 - player.x3);
                tmpObj.visible = true;
                tmpObj.GS = () => {return 35};
                tmpObj.inTrap = newGameObjects.filter(e => e.trap && e.active && UTILS.getDist(e, tmpObj, 0, 2) < 50 && !e.isTeamObject(tmpObj)).sort(function (a, b) {
                    return UTILS.getDist(a, tmpObj, 0, 2) - UTILS.getDist(b, tmpObj, 0, 2);
                })[0];
                if(tmpObj.inTrap){
                    tmpObj.intrapTime = Date.now();
                }
                tmpObj.update(game.tickSpeed);
                if(tmpObj == player){
                    if(isChoose){
                        isChoose = false;
                        let fastSpeed = player.weapons[1] && items.weapons[player.weapons[0]].spdMult < items.weapons[player.weapons[1]].spdMult ? 1 : 0;
                        selectWeapon(player.weapons[fastSpeed]);
                    }
                    if(player.skinIndex == 7){
                        UseBullTime = Date.now();
                    }
                }
                if (!tmpObj.isTeam(player)) {
                    enemy.push(tmpObj);
                    if(tmpObj.canshoot){
                        bowNear.push(tmpObj);
                    }
                    if (tmpObj.dist2 <= items.weapons[tmpObj.primaryIndex == undefined ? 5 : tmpObj.primaryIndex].range + (player.scale * 2)) {
                        nears.push(tmpObj);
                    }
                }
                tmpObj.aim3 = UTILS.getDirect(tmpObj, player, 3, 3);
                tmpObj.damageThreat = 0;
                if (tmpObj.skinIndex == 45 && tmpObj.shameTimer <= 0) {
                    tmpObj.addShameTimer();
                }
                if (tmpObj.oldSkinIndex == 45 && tmpObj.skinIndex != 45) {
                    tmpObj.shameTimer = 0;
                    tmpObj.shameCount = 0;
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
        battack = null;
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
        /*projectiles.forEach((proj) => {
    tmpObj = proj;
    if (tmpObj.active) {
        tmpObj.tickUpdate(game.tickSpeed);
    }
});*/
        if (player && player.alive) {
            if(clanCrash && Date.now() - clanTime > 500) {
                clanTime = Date.now();
                if(player.team){
                    packet(code.removeclan);
                }else{
                    packet(code.creatclan, ReTryPro(false,document.getElementById("ClanCount").value));
                }
            }
            if(chatcrash && Date.now() - chatTime > 700 && chat.list.length == 0) {
                chatTime = Date.now();
                sendChat(animate(true,document.getElementById("ChatCount").value))
            }
            if(getEl("WhileChat").checked && chat.list.length == 0){
                let text = getEl("whilechat").value.split('\n');

                if(text[whileChatcount + 1] && Date.now() - whileChatTime > parseInt(text[whileChatcount + 1])){
                    sendChat(text[whileChatcount]);
                    whileChatcount += 2;
                    whileChatTime = Date.now();
                    if(whileChatcount >= text.length)whileChatcount = 0;
                } else if(whileChatcount >= text.length){
                    whileChatcount = 0;
                }
            }
            if(chat.list.length > 0){
                if(Date.now() - chat.time > 700){
                    chat.time = Date.now();
                    packet(code.chat, chat.list[0]);
                    chat.list.shift();
                }
                try{
                    chat.list = chat.list.filter((item, index) => item !== chat.list[index - 1]);
                }catch(e){}
            }
            autoHit = false;
            if (enemy.length) {
                near = enemy.sort(function (tmp1, tmp2) {
                    return tmp1.dist2 - tmp2.dist2;
                })[0];
                enemy.forEach((tmpObj) => {
                    if(caninsta){
                        let hitcount = 0;
                        let hitDmg = checkHit(player, tmpObj);
                        if(hitDmg > 0){
                            hitcount++;
                            Object.keys(PLAYERS).forEach(sid => {
                                const playerData = PLAYERS[sid];
                                if (window.location.href === playerData.href && playerData.hit && parseInt(sid) !== parseInt(player.sid)) {
                                    let moduser = findPlayerBySID(sid);
                                    let hit = checkHit(moduser, tmpObj);
                                    if(hit > 0 && moduser.visible){
                                        hitDmg += hit;
                                        console.log(sid,hit, hitDmg)
                                        hitcount++;
                                    }
                                }
                            });
                        }
                        let shootDmg = checkShoot(player, tmpObj);
                        if(shootDmg > 0){
                            Object.keys(PLAYERS).forEach(sid => {
                                const playerData = PLAYERS[sid];
                                if (window.location.href === playerData.href && playerData.shoot && parseInt(sid) !== parseInt(player.sid)) {
                                    let moduser = findPlayerBySID(sid);
                                    let shoot = checkShoot(moduser, tmpObj);
                                    if(shoot > 0 && moduser.visible){
                                        shootDmg += shoot;
                                    }
                                }
                            });
                        }
                        let pV = player.primaryVariant != undefined ? config.weaponVariants[player.primaryVariant].val : 1;
                        if(getEl("modsyncinsta").checked && parseInt(hitDmg + shootDmg) >= 100 && parseInt(hitcount) > 1 && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0){
                            Text("Mod Insta: " + PlayerName[tmpObj.sid], "#f00", 1);
                            caninsta = false;
                            attackTime = Date.now();
                            my.weapon = player.weapons[0];
                            packet(code.aim, tmpObj.aim2);
                            selectWeapon(player.weapons[0]);
                            UseHat(7);
                            sendAtck(1, tmpObj.aim2);
                            game.tickBase(() => {
                                attackTime = Date.now();
                                my.weapon = player.weapons[1];
                                packet(code.aim, tmpObj.aim2);
                                selectWeapon(player.weapons[1]);
                                UseHat(53);
                                sendAtck(1, tmpObj.aim2);
                                game.tickBase(() => {
                                    sendAtck(0, tmpObj.aim2);
                                    caninsta = true;
                                },1);
                            }, 1);
                        } else if(getEl("modsynchit").checked && parseInt(hitDmg) >= 100 && player.reloads[player.weapons[0]] == 0){
                            Text("Mod Hit: " + PlayerName[tmpObj.sid], "#f00", 1);
                            caninsta = false;
                            attackTime = Date.now();
                            my.weapon = player.weapons[0];
                            packet(code.aim, tmpObj.aim2);
                            selectWeapon(player.weapons[0]);
                            UseHat(7);
                            sendAtck(1, tmpObj.aim2);
                            sendAtck(0, tmpObj.aim2);
                            game.tickBase(() => {
                                caninsta = true;
                            }, 1);
                        } else if(getEl("modsyncshoot").checked && parseInt(shootDmg) >= 100 && player.reloads[player.weapons[1]] == 0){
                            Text("Mod Shoot: " + PlayerName[tmpObj.sid], "#f00", 1);
                            try{
                                if(items.list[player.items[player.getItemType(7)]].zIndex){
                                    circlePlace(player.getItemType(7), tmpObj.aim2, 180, true, true);
                                }
                            }catch(e){}
                            caninsta = false;
                            attackTime = Date.now();
                            my.weapon = player.weapons[1];
                            packet(code.aim, tmpObj.aim4);
                            selectWeapon(player.weapons[1]);
                            UseHat(53);
                            sendAtck(1, tmpObj.aim4);
                            sendAtck(0, tmpObj.aim4);
                            game.tickBase(() => {
                                caninsta = true;
                            }, 1);
                        } else if(getEl("autohit").checked && !player.isTeam(tmpObj) && tmpObj.visible && tmpObj.health <= (items.weapons[player.weapons[0]].dmg * pV * (tmpObj.skinIndex === 6 ? .76 : 1)) && player.reloads[player.weapons[0]] === 0 && tmpObj.distPing <= (items.weapons[player.weapons[0]].range + tmpObj.scale)){
                            autoHit = true;
                        }

                    }
                });
            }
            if (bowNear.length) {
                bownear = bowNear.sort(function (tmp1, tmp2) {
                    return tmp1.dist2 - tmp2.dist2;
                })[0];
            }
            preplace = [];
            for (let i = 0; i < data.length;) {
                tmpObj = findPlayerBySID(data[i]);
                if (tmpObj) {
                    if (tmpObj.shooting[53]) {
                        tmpObj.shooting[53] = 0;
                        tmpObj.reloads[53] = (2500 - game.tickRate);
                    } else {
                        if (tmpObj.reloads[53] > 0) {
                            tmpObj.reloads[53] = Math.max(0, tmpObj.reloads[53] - game.tickRate);
                        }
                    }

                    if (tmpObj.gathering || tmpObj.shooting[1]) {
                        if (tmpObj.gathering) {
                            tmpObj.gathering = 0;
                            tmpObj.reloads[tmpObj.gatherIndex] = (items.weapons[tmpObj.gatherIndex].speed * (tmpObj.skinIndex == 20 ? 0.78 : 1));
                            tmpObj.attacked = true;
                        }
                        if (tmpObj.shooting[1]) {
                            tmpObj.shooting[1] = 0;
                            tmpObj.reloads[tmpObj.shootIndex] = (items.weapons[tmpObj.shootIndex].speed * (tmpObj.skinIndex == 20 ? 0.78 : 1));
                            tmpObj.attacked = true;
                        }
                    } else {
                        tmpObj.attacked = false;
                        if (tmpObj.buildIndex < 0) {
                            if (tmpObj.reloads[tmpObj.weaponIndex] > 0) {
                                tmpObj.reloads[tmpObj.weaponIndex] = Math.max(0, tmpObj.reloads[tmpObj.weaponIndex] - game.tickRate);
                                if (!tmpObj.isTeam(player)) {
                                    if ([3, 4, 5].includes(tmpObj.weaponIndex)) {
                                        if(getEl("antibull").checked && tmpObj.dist3 < (items.weapons[player.weapons[0]].range + tmpObj.scale)){
                                            if(!getEl("antibullalways").checked && tmpObj.reloads[tmpObj.weaponIndex] < game.tickRate){
                                                antibull = true;
                                            }
                                        }
                                    }
                                }
                                if (tmpObj == player) {
                                    if (getEl("weaponGrind").checked) {
                                        circlePlace(player.getItemType(7), mouseAim() + toRad(45), 45, true, true);
                                        circlePlace(player.getItemType(7), mouseAim() - toRad(45), 45, true, true);
                                    }
                                }


                            }
                        }
                    }
                    if (tmpObj != player) {
                        tmpObj.addDamageThreat(player);
                    }
                }
                i += 13;
            }
            if (game.tickQueue[game.tick]) {
                game.tickQueue[game.tick].forEach((action) => {
                    action();
                });
                game.tickQueue[game.tick] = null;

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
                if (tmp.setPoisonTick) {s
                tmp.poisonTimer = 0;
                                       }
                tmp.updateTimer();
            });
            IsSpikeTick = false;
            if(getEl("antibullalways").checked){
                antibull = true;
            }
            if (inGame) {
            // Auto play drives itself once per game tick, the way RYN runs
            // its module from postTick -- this script has no single movement
            // authority to hand an override to. Wrapped, because this is the
            // middle of the tick handler and a throw here would cost far
            // more than the feature is worth.
            try {
                sakAutoPlay.tick();
            } catch (autoPlayError) {
                console.error("[sakuna] auto play failed, leaving movement alone", autoPlayError);
            }
                if (enemy.length) {
                    if(getEl("spiketick").checked){
                        let emyinTrap = newGameObjects.filter(e => e.trap && e.active && UTILS.getDist(e, near, 0, 99) <= (near.scale + e.getScale() + 5) && !near.findAllianceBySid(e));
                        if(emyinTrap.length > 0){
                            IsSpikeTick = emyinTrap[0];
                        }
                    }
                    if (player.canEmpAnti) {
                        player.canEmpAnti = false;
                        if (near.distPing <= 300 && !my.safePrimary(near) && !my.safeSecondary(near)) {
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
                }
                if (newGameObjects.length) {
                    newGameObjects.filter((e)=>e.active && e.doUpdate).forEach((tmp)=>{
                        tmp.isEnemy = tmp.ce()
                        tmp.isPlayer = tmp.cp();
                        tmp.GS = function () {
                            return tmp.scale * ((tmp.isItem || tmp.type == 2 || tmp.type == 3 || tmp.type == 4) ? 1 : 0.6) * tmp.colDiv + (((tmp.type == 1 && tmp.y >= config.mapScale - config.snowBiomeTop) || tmp.teleport || (tmp.isEnemy && (tmp.trap || tmp.dmg))) ? (tmp.teleport ? player.maxSpeed*1.5 : 0) : 0);
                        };
                        if (tmp.shootted) {
                            tmp.shootted = 0;
                            tmp.shootReload = 2200 - game.tickSpeed;
                        } else {
                            if (tmp.shootReload > 0) {
                                tmp.shootReload = Math.max(0, tmp.shootReload - game.tickSpeed);
                                if (tmp.shootReload <= 0) {
                                    tmp.shootReload = 2200;
                                    if (!tmp.isTeamObject(player) && Math.hypot(player.pingY - tmp.y, player.pingX - tmp.x) <= 735) {
                                        turretEmp++;
                                    }
                                }
                            }
                        }
                    });
                }
                let emySpike = {
                    x: 0,
                    y: 0
                };
                emySpikeHit = false;
                emySpikes = [];
                enemy.forEach((tmpObj)=>{
                    let wr = (tmpObj.primaryIndex ? items.weapons[tmpObj.primaryIndex].range : 100 + 35);
                    newGameObjects.filter(tmp => (tmp.type == 1 && tmp.y >= config.mapScale - config.snowBiomeTop) || (tmp.dmg && tmp.active && !tmp.isTeamObject(player))).forEach((tmp)=>{
                        if(tmpObj.reloads[tmpObj.primaryIndex] <= game.tickSpeed && (tmpObj.primaryIndex == 5 || tmpObj.primaryIndex == 4 || tmpObj.primaryIndex == 3) && tmpObj.dist3 <= (player.scale + wr + tmp.scale)){
                            let dist = UTILS.getDist(player, tmp, 3, 0);
                            if(dist <= (wr + player.scale + tmp.scale)){
                                let emyHitSpike = {
                                    x: player.x3 + Math.cos(near.aim3 + toRad(180)) * dist,
                                    y: player.y3 + Math.sin(near.aim3 + toRad(180)) * dist
                                }
                                if(UTILS.getDist(emyHitSpike, tmp, 0, 0) <= (tmp.scale + player.scale)*1.1){
                                    emySpikes.push(tmp);
                                }
                            }
                        }
                    });
                });
                if(emySpikes.length > 0){
                    emySpikeHit = emySpikes;
                    emySpikes.forEach((tmp)=>{
                        emySpike.x += tmp.x;
                        emySpike.y += tmp.y;
                    });
                    emySpike.x /= emySpikes.length;
                    emySpike.y /= emySpikes.length;
                }
                path = [];
                isNavigablelist = [];
                walkaim = undefined;
                cantFindpath = false;
                let needmove = false;
                function move(){
                    if(!isMoveBow){
                        if(getEl("movementassist").checked){
                            let Spikes = newGameObjects.filter(tmp => ((tmp.type == 1 && tmp.y >= config.mapScale - config.snowBiomeTop && getEl("movementassistcactus").checked) || (tmp.dmg && tmp.active && !tmp.isTeamObject(player))) && UTILS.getDist(tmp, player, 0, 3) <= (tmp.getScale() + Math.min(items.weapons[player.weapons[0]].range, 75)))
                            .sort(function (a, b) {
                                return Math.hypot(player.y3 - a.y, player.x3 - a.x) - Math.hypot(player.y3 - b.y, player.x3 - b.x);
                            });

                            if(Spikes.length > 0){
                                let nearSpike = {
                                    x: 0,
                                    y: 0
                                };
                                let nearSpikes = Spikes.filter(tmp => UTILS.getDist(tmp, player, 0, 2) <= (tmp.getScale() + 40));
                                if(nearSpikes.length > 0){
                                    nearSpikes.forEach((tmp)=>{
                                        nearSpike.x += tmp.x;
                                        nearSpike.y += tmp.y;
                                    });
                                    nearSpike.x /= nearSpikes.length;
                                    nearSpike.y /= nearSpikes.length;
                                    walkaim = Math.atan2(player.y2 - nearSpike.y, player.x2 - nearSpike.x);
                                }


                                if(traps.inTrap){
                                    if(MoveType != 'move(in trap)'){
                                        MoveType = 'move(in trap)';
                                        Text("move(in trap)", "#ff0");
                                    }
                                    walkaim = Math.atan2(player.y3 - Spikes[0].y, player.x3 - Spikes[0].x);
                                    needmove = true;
                                } else if(emySpikeHit){
                                    if(MoveType != 'move(emy spike hit)'){
                                        MoveType = 'move(emy spike hit)';
                                        Text("move(emy spike hit)", "#ff0");
                                    }
                                    walkaim = Math.atan2(player.y3 - emySpike.y, player.x3 - emySpike.x);
                                    needmove = true;
                                } else if(walkaim){
                                    if(MoveType != 'move'){
                                        MoveType = 'move';
                                        Text("move", "#ff0");
                                    }
                                    needmove = true;
                                }
                                if(walkaim || getMoveDir()){
                                    let move = {
                                        x: player.x2 + Math.cos(walkaim || getMoveDir()) * (player.scale + player.speed),
                                        y: player.y2 + Math.sin(walkaim || getMoveDir()) * (player.scale + player.speed),
                                    }
                                    let hasNearSpikes = newGameObjects.filter(tmp => ((tmp.type == 1 && tmp.y >= config.mapScale - config.snowBiomeTop && getEl("movementassistcactus").checked) || (tmp.dmg && tmp.active && !tmp.isTeamObject(player))) && UTILS.getDist(tmp, move, 0,0) <= (player.scale + tmp.getScale()));
                                    if(hasNearSpikes.length > 0) {
                                        walkaim = null
                                        data[0] = walkaim;
                                        if(MoveType != 'stop'){
                                            Text("Stop", "#ff0");
                                        }
                                        MoveType = 'stop';
                                        needmove = true;
                                    }
                                }
                            } else if(MoveType != 'none'){
                                walkaim = getMoveDir();
                                MoveType = 'none';
                                needmove = true;
                            }
                        }

                        if (getEl("autopush").checked && near.distPing < 250 && !player.inTrap && ["push", "none"].some(keyword => MoveType.toLowerCase().includes(keyword))) {
                            let nearTrap = newGameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 99) <= (near.scale + tmp.getScale() + 5)).sort(function (a, b) {
                                return UTILS.getDist(a, near, 0, 3) - UTILS.getDist(b, near, 0, 3);
                            })[0];
                            if (nearTrap) {
                                let spike = newGameObjects.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, nearTrap, 0, 0) <= (near.scale + nearTrap.scale + tmp.scale)).sort(function (a, b) {
                                    return UTILS.getDist(a, near, 0, 3) - UTILS.getDist(b, near, 0, 3);
                                })[0];
                                if (spike) {
                                    let pos = {
                                        x: near.x2 + (70 * Math.cos(UTILS.getDirect(near, spike, 2, 0))),
                                        y: near.y2 + (70 * Math.sin(UTILS.getDirect(near, spike, 2, 0))),
                                    };
                                    let pos2 = {
                                        x: near.x2 + Math.cos(UTILS.getDirect(near, nearTrap, 2, 0)) * 35,
                                        y: near.y2 + Math.sin(UTILS.getDirect(near, nearTrap, 2, 0)) * 35
                                    };
                                    let isNearSpike = newGameObjects.some(tmp => tmp.dmg && tmp.active && !tmp.isTeamObject(player) && UTILS.getDist(tmp, pos, 0, 0) <= 90);
                                    if(!isNearSpike){
                                        let scale = player.scale/2;
                                        if(UTILS.getDist(spike, near, 0, 2) < (spike.scale + player.scale)){
                                            walkaim = undefined;
                                            needmove = true;
                                            MoveType = "Push Stop";
                                        } else if (UTILS.lineInRect(player.x2 - scale, player.y2 - scale, player.x2 + scale, player.y2 + scale, near.x2, near.y2, pos.x, pos.y)) {
                                            walkaim = UTILS.getDirect(spike, player, 0, 2);
                                            needmove = true;
                                            MoveType = "Push Enemy";
                                        } else {
                                            walkaim = UTILS.getDirect(pos, player, 0, 2);
                                            MoveType = "Push Walk";
                                            let PTF = {
                                                x: player.x2 + Math.cos(walkaim) * player.maxSpeed,
                                                y: player.y2 + Math.sin(walkaim) * player.maxSpeed,
                                            }
                                            if(Math.hypot(PTF.y - near.y2, PTF.x - near.x2) <= 60){
                                                let canWalk = [];
                                                for(let i=0; i<360;i++){
                                                    let PTFi = {
                                                        x: player.x2 + Math.cos(toRad(i)) * player.maxSpeed,
                                                        y: player.y2 + Math.sin(toRad(i)) * player.maxSpeed,
                                                    }
                                                    if(Math.hypot(PTFi.y - near.y2, PTFi.x - near.x2) > 70){
                                                        canWalk.push(PTFi);
                                                    }
                                                }
                                                if(canWalk.length > 0){
                                                    canWalk = canWalk.sort((a, b) => Math.hypot(a.y - pos.y, a.x - pos.x) - Math.hypot(b.y - pos.y, b.x - pos.x))[0];
                                                    path = findPath(canWalk);
                                                    walkaim = path[1] ? UTILS.getDirect(path[1], player, 0, 2) : Math.atan2(canWalk.y - player.y2, canWalk.x - player.x2);
                                                    MoveType = "Push Walk Aviod";
                                                }
                                            }
                                            needmove = true;
                                        }
                                    }
                                } else {
                                    if (MoveType.toLowerCase().includes("push")) {
                                        walkaim = getMoveDir();
                                        needmove = true;
                                        MoveType = 'none';
                                    }
                                }
                            } else {
                                if (MoveType.toLowerCase().includes("push")) {
                                    walkaim = getMoveDir();
                                    needmove = true;
                                    MoveType = 'none';
                                }
                            }
                        } else {
                            if (MoveType.toLowerCase().includes("push")) {
                                walkaim = getMoveDir();
                                needmove = true;
                                MoveType = 'none';
                            }
                        }
                        if(getEl("breakspikemove").checked && near.distPing < 300 && ["Break Spike", "none"].some(keyword => MoveType.toLowerCase().includes(keyword))){
                            let obj = newGameObjects.filter(tmp => (tmp.dmg || tmp.trap || tmp.doUpdate) && UTILS.getDist(tmp, near, 0, 2) < 300 && tmp.active && !tmp.isTeamObject(player)).sort(function (a, b) {
                                return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
                            })[0];
                            if(obj){
                                let rt = {
                                    x: obj.x + Math.cos(UTILS.getDirect(obj, near, 0, 2)) * 90,
                                    y: obj.y + Math.sin(UTILS.getDirect(obj, near, 0, 2)) * 90,
                                }
                                if(UTILS.getDist(rt, player, 0, 2) < Math.max(player.speed, player.maxSpeed/2)){
                                    walkaim = getMoveDir();
                                    needmove = true;
                                    MoveType = "Break Spike Stop";
                                } else {
                                    MoveType = "Break Spike";
                                    path = findPath(rt);
                                    walkaim = path[1] ? UTILS.getDirect(path[1], player, 0, 2) : Math.atan2(rt.y - player.y3, rt.x - player.x3)
                                    needmove = true;
                                }
                            } else if(MoveType.toLowerCase().includes("Break Spike")){
                                walkaim = getMoveDir();
                                needmove = true;
                                MoveType = 'none';
                            }
                        } else if(MoveType.toLowerCase().includes("Break Spike")){
                            walkaim = getMoveDir();
                            needmove = true;
                            MoveType = 'none';
                        }
                        if(getEl("spiketickmove").checked && near.distPing < 400 && ["Spike Hit", "none"].some(keyword => MoveType.toLowerCase().includes(keyword))){
                            let emy = enemy.filter(tmpObj => newGameObjects.some(tmp => tmp.dmg && tmpObj.distPing < 400 && UTILS.getDist(tmp, tmpObj, 0, 2) < (player.scale + items.weapons[player.weapons[0]].range + tmp.scale) && tmp.active && tmp.isTeamObject(player))).sort(function (a, b) {
                                return UTILS.getDist(a, player, 2, 2) - UTILS.getDist(b, player, 2, 2);
                            })[0];
                            if(emy){
                                let obj = newGameObjects.filter(tmp => tmp.dmg && UTILS.getDist(tmp, emy, 0, 2) < (player.scale + items.weapons[player.weapons[0]].range + tmp.scale) && tmp.active && tmp.isTeamObject(player)).sort(function (a, b) {
                                    return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
                                })[0];
                                let emyspike = newGameObjects.filter(tmp => tmp.dmg && UTILS.getDist(tmp, obj, 0, 2) < (player.scale + items.weapons[player.weapons[0]].range + tmp.scale) && tmp.active && !tmp.isTeamObject(player)).sort(function (a, b) {
                                    return UTILS.getDist(a, obj, 0, 0) - UTILS.getDist(b, obj, 0, 0);
                                })[0];
                                if(obj){
                                    let dir = UTILS.getDirect(emy, obj, 2, 0);
                                    let end = {
                                        x :emy.x2 + Math.cos(dir) * 70,
                                        y: emy.y2 + Math.sin(dir) * 70,
                                    }
                                    if(UTILS.getDist(end, player, 0, 2) > 25){
                                        path = findPath(end);
                                        walkaim = path[1] ? UTILS.getDirect(path[1], player, 0, 2) : Math.atan2(end.y - player.y3, end.x - player.x3)
                                    } else {
                                        walkaim = emy.aimPing;
                                    }
                                    needmove = true;
                                    MoveType = "Spike Hit";
                                } else if(MoveType.toLowerCase().includes("Spike Hit")){
                                    walkaim = getMoveDir();
                                    needmove = true;
                                    MoveType = 'none';
                                }
                            } else if(MoveType.toLowerCase().includes("Spike Hit")){
                                walkaim = getMoveDir();
                                needmove = true;
                                MoveType = 'none';
                            }
                        } else if(MoveType.toLowerCase().includes("Spike Hit")){
                            walkaim = getMoveDir();
                            needmove = true;
                            MoveType = 'none';
                        }
                        if(getEl("retrapmove").checked && near.distPing < 400 && near.inTrap && ["retrap", "none"].some(keyword => MoveType.toLowerCase().includes(keyword))){
                            let item = items.list[player.items[4]];
                            let tmpS = player.scale + item.scale - 10;
                            let spike = newGameObjects.filter(tmp => tmp.spike && UTILS.getDist(tmp, near, 0, 2) < 300 && tmp.active && tmp.isTeamObject(player)).sort(function (a, b) {
                                return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                            })[0];
                            let rt = {
                                x: near.inTrap.x + Math.cos(spike? UTILS.getDirect(near.inTrap, spike, 0, 0) : UTILS.getDirect(near, near.inTrap, 2, 0)) * tmpS,
                                y: near.inTrap.y + Math.sin(spike? UTILS.getDirect(near.inTrap, spike, 0, 0) : UTILS.getDirect(near, near.inTrap, 2, 0)) * tmpS,
                            }
                            if(UTILS.getDist(rt, player, 0, 2) < Math.max(player.speed, player.maxSpeed/2)){
                                walkaim = getMoveDir();
                                needmove = true;
                                MoveType = "ReTrap Stop";
                            } else {
                                MoveType = "ReTrap";
                                path = findPath(rt);
                                walkaim = path[1] ? UTILS.getDirect(path[1], player, 0, 2) : Math.atan2(rt.y - player.y3, rt.x - player.x3)
                                needmove = true;
                            }
                        } else if(MoveType.toLowerCase().includes("retrap")){
                            walkaim = getMoveDir();
                            needmove = true;
                            MoveType = 'none';
                        }
                        if(getEl("enemymove").checked && near.distPing < 400 && ["Enemy", "none"].some(keyword => MoveType.toLowerCase().includes(keyword))){
                            let obj = newGameObjects.filter(tmp => (tmp.trap || tmp.spike) && UTILS.getDist(tmp, player, 0, 2) < 400 && tmp.active && tmp.isTeamObject(player)).sort(function (a, b) {
                                return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                            })[0];
                            if(obj){
                                obj = {
                                    x: obj.x + Math.cos(UTILS.getDirect(near, obj, 2, 0)) * 85,
                                    y: obj.y + Math.sin(UTILS.getDirect(near, obj, 2, 0)) * 85,
                                }
                                if(UTILS.getDist(obj, player, 0, 2) < Math.max(player.speed, player.maxSpeed/2)){
                                    walkaim = getMoveDir();
                                    needmove = true;
                                    MoveType = "Enemy Stop";
                                } else {
                                    MoveType = "Enemy";
                                    path = findPath(obj);
                                    walkaim = path[1] ? UTILS.getDirect(path[1], player, 0, 2) : Math.atan2(obj.y - player.y3, obj.x - player.x3)
                                    needmove = true;
                                }
                            } else if(MoveType.toLowerCase().includes("Enemy")){
                                walkaim = getMoveDir();
                                needmove = true;
                                MoveType = 'none';
                            }
                        } else if(MoveType.toLowerCase().includes("Enemy")){
                            walkaim = getMoveDir();
                            needmove = true;
                            MoveType = 'none';
                        }
                        if(GoToTeamBuild && ["Team Build", "none"].some(keyword => MoveType.toLowerCase().includes(keyword))){
                            nearobject = gameObjects.filter(tmp => tmp.active && UTILS.getDist(tmp, player, 0, 2) < 700 && (tmp.owner ? (!tmp.pps && !tmp.spawnPoint && tmp.isTeamObject(player)) : false)).sort(function (a, b) {
                                return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
                            })[0];
                            if(nearobject){
                                nearobject = {
                                    x: nearobject.x + Math.cos(UTILS.getDirect(player, nearobject, 2, 0)) * (nearobject.scale + player.scale),
                                    y: nearobject.y + Math.sin(UTILS.getDirect(player, nearobject, 2, 0)) * (nearobject.scale + player.scale)
                                }
                                if(UTILS.getDist(player, nearobject, 2, 0) < Math.max(player.speed, player.maxSpeed/2)){
                                    walkaim = undefined;
                                    needmove = true;
                                    MoveType = "Team Build Stop";
                                } else {
                                    path = findPath(nearobject);
                                    if(path[1]){
                                        walkaim = UTILS.getDirect(path[1], player, 0, 2);
                                        needmove = true;
                                        isMove = true;
                                        MoveType = "Team Build";
                                    }
                                }
                            }
                        } else if(MoveType.toLowerCase().includes("Team Build")){
                            walkaim = getMoveDir();
                            needmove = true;
                            MoveType = 'none';
                        }

                        if(GoToAllBuild && ["All Build", "none"].some(keyword => MoveType.toLowerCase().includes(keyword))){
                            nearobject = gameObjects.filter(tmp => tmp.active && (tmp.owner ? (!tmp.pps || (!tmp.isTeamObject(player) && tmp.pps)) : false)).sort(function (a, b) {
                                return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
                            })[0];
                            if(nearobject){
                                nearobject = {
                                    x: nearobject.x + Math.cos(UTILS.getDirect(player, nearobject, 2, 0)) * (nearobject.scale + player.scale),
                                    y: nearobject.y + Math.sin(UTILS.getDirect(player, nearobject, 2, 0)) * (nearobject.scale + player.scale)
                                }
                                if(UTILS.getDist(player, nearobject, 2, 0) < Math.max(player.speed, player.maxSpeed/2)){
                                    walkaim = undefined;
                                    needmove = true;
                                    MoveType = "All Build Stop";
                                } else {
                                    path = findPath(nearobject);
                                    if(path[1]){
                                        walkaim = UTILS.getDirect(path[1], player, 0, 2);
                                        needmove = true;
                                        isMove = true;
                                        MoveType = "All Build";
                                    }
                                }
                            }
                        } else if(MoveType.toLowerCase().includes("All Build")){
                            walkaim = getMoveDir();
                            needmove = true;
                            MoveType = 'none';
                        }
                        if(GoToBuild && ["Near Build", "none"].some(keyword => MoveType.toLowerCase().includes(keyword))){
                            nearobject = gameObjects.filter(tmp => tmp.active && (tmp.owner ? tmp.owner.sid == player.sid : false) && !tmp.pps).sort(function (a, b) {
                                return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
                            })[0];
                            if(nearobject){
                                nearobject = {
                                    x: nearobject.x + Math.cos(UTILS.getDirect(player, nearobject, 2, 0)) * (nearobject.scale + player.scale),
                                    y: nearobject.y + Math.sin(UTILS.getDirect(player, nearobject, 2, 0)) * (nearobject.scale + player.scale)
                                }
                                if(UTILS.getDist(player, nearobject, 2, 0) < Math.max(player.speed, player.maxSpeed/2)){
                                    walkaim = undefined;
                                    needmove = true;
                                    MoveType = "Near Build Stop";
                                } else {
                                    path = findPath(nearobject);
                                    if(path[1]){
                                        walkaim = UTILS.getDirect(path[1], player, 0, 2);
                                        needmove = true;
                                        isMove = true;
                                        MoveType = "Near Build";
                                    }
                                }
                            }
                        } else if(MoveType.toLowerCase().includes("Near Build")){
                            walkaim = getMoveDir();
                            needmove = true;
                            MoveType = 'none';
                        }

                        if ((getEl("togglePlayerSync").checked || getEl("togglePlayerFollower").checked) && ["follower", "none"].some(keyword => MoveType.toLowerCase().includes(keyword))) {
                            try{
                                let follower = findPlayerBySID(parseInt(getEl("syncsid").value));
                                if(follower){
                                    HaveMove = true;
                                    let dir = ( getEl("togglePlayerFollowerUseDir").checked ? (follower.dir) : follower.aim2 + toRad(180));
                                    let emy = null;
                                    let d = 9999;
                                    if(getEl("togglePlayerFollowerEnemy").checked){
                                        players.forEach((tmpObj) => {
                                            if(!player.isTeam(tmpObj) && !follower.isTeam(tmpObj) && tmpObj.visible && tmpObj != player && d > Math.hypot(tmpObj.y2 - follower.y2, tmpObj.x2 - follower.x2)){
                                                d = Math.hypot(tmpObj.y2 - follower.y2, tmpObj.x2 - follower.x2);
                                                emy = tmpObj;
                                            }
                                        });
                                    }
                                    let dist = parseInt(getEl("togglePlayerFollowerDist").value);
                                    if(emy){
                                        dir = UTILS.getDirect(emy, follower, 2, 2);
                                        dist = Math.min(dist, d)
                                    }
                                    dir += toRad(getEl("togglePlayerFollowerDir").value);
                                    let end = {
                                        x :follower.x3 + Math.cos(dir) * dist,
                                        y: follower.y3 + Math.sin(dir) * dist,
                                    }
                                    let enddist = Math.hypot(end.y - player.y3, end.x - player.x3);
                                    if(enddist > 25){
                                        path = findPath(end);
                                        walkaim = path[1] ? UTILS.getDirect(path[1], player, 0, 2) : Math.atan2(end.y - player.y3, end.x - player.x3)
                                        MoveType = "Follower";
                                        let PTF = {
                                            x: player.x2 + Math.cos(walkaim) * player.maxSpeed,
                                            y: player.y2 + Math.sin(walkaim) * player.maxSpeed,
                                        }
                                        if(Math.hypot(PTF.y - follower.y3, PTF.x - follower.x3) <= dist){
                                            let canWalk = [];
                                            for(let i=0; i<360;i++){
                                                let PTFi = {
                                                    x: player.x2 + Math.cos(toRad(i)) * player.maxSpeed,
                                                    y: player.y2 + Math.sin(toRad(i)) * player.maxSpeed,
                                                }
                                                if(Math.hypot(PTFi.y - follower.y3, PTFi.x - follower.x3) > dist){
                                                    canWalk.push(PTFi);
                                                }
                                            }
                                            if(canWalk.length > 0){
                                                canWalk = canWalk.sort((a, b) => Math.hypot(a.y - end.y, a.x - end.x) - Math.hypot(b.y - end.y, b.x - end.x))[0];
                                                path = findPath(canWalk);
                                                walkaim = path[1] ? UTILS.getDirect(path[1], player, 0, 2) : Math.atan2(canWalk.y - player.y2, canWalk.x - player.x2);
                                                MoveType = "Follower Aviod";
                                            }
                                        }
                                        needmove = true;
                                    } else if(MoveType.toLowerCase().includes("follower")){
                                        walkaim = getMoveDir();
                                        needmove = true;
                                        MoveType = 'none';
                                    }
                                }
                            }catch(e){console.log(e)}
                        }
                        if(["goto", "none"].some(keyword => MoveType.toLowerCase().includes(keyword))){
                            if(GoToMapMarker && mapMarker){
                                if(UTILS.getDist(player, mapMarker, 2, 0) < player.maxSpeed){
                                    walkaim = undefined;
                                    needmove = true;
                                } else {
                                    path = findPath(mapMarker)
                                    if(path[1]){
                                        walkaim = UTILS.getDirect(path[1], player, 0, 2);
                                        needmove = true;
                                        isMove = true;
                                        MoveType = "GoToMapMarker";
                                    }
                                }
                            } else if(GoToLastDeath && lastDeath){
                                if(UTILS.getDist(player, lastDeath, 2, 0) < player.maxSpeed){
                                    walkaim = undefined;
                                    needmove = true;
                                    MoveType = "GoToLastDeath Stop";
                                } else {
                                    path = findPath(lastDeath)
                                    if(path[1]){
                                        walkaim = UTILS.getDirect(path[1], player, 0, 2);
                                        needmove = true;
                                        MoveType = "GoToLastDeath";
                                    }
                                }
                            } else if(GoToRandomXY && ramdonXY){
                                if(UTILS.getDist(player, ramdonXY, 2, 0) < player.maxSpeed){
                                    setRamdonXY();
                                } else {
                                    const isPositionWalkable = (XY) => {
                                        return gameObjects.some(obs =>UTILS.getDist(obs, ramdonXY, 0, 0) < (obs.GS() + player.scale) )};
                                    if(isPositionWalkable(ramdonXY)){
                                        setRamdonXY();
                                    }
                                    path = findPath(ramdonXY)
                                    if(path[1]){
                                        walkaim = UTILS.getDirect(path[1], player, 0, 2);
                                        needmove = true;
                                        MoveType = "GoToRandomXY";
                                    }
                                }
                            } else if(moveXY){
                                path = findPath(moveXY)
                                if(path[1]){
                                    walkaim = UTILS.getDirect(path[1], player, 0, 2);
                                    needmove = true;
                                    MoveType = "MouseXY";
                                }
                                if(UTILS.getDist(player, moveXY, 2, 0) < player.maxSpeed){
                                    moveXY = null;
                                    walkaim = getMoveDir();
                                    needmove = true;
                                }
                            } else if(MoveType.toLowerCase().includes("goto")){
                                walkaim = getMoveDir();
                                needmove = true;
                                MoveType = 'none';
                            }
                        } else if(MoveType.toLowerCase().includes("goto")){
                            walkaim = getMoveDir();
                            needmove = true;
                            MoveType = 'none';
                        }
                        if(needmove){
                            packet(code.move, walkaim, 1);
                        }
                    }
                }
                let channelMove = new MessageChannel();
                channelMove.port1.onmessage = move;
                channelMove.port2.postMessage("");
                if (getEl("togglePlayerSync").checked) {
                    let syncr = findPlayerBySID(parseInt(getEl("syncsid").value));
                    try{
                        packet(code.aim, syncr.d2);
                    }catch(e){}
                    try{
                        UseHat(syncr.skinIndex);
                    }catch(e){}
                    try{
                        UseAcc(syncr.tailIndex);
                    }catch(e){}
                    try{
                        selectWeapon(player.weapons[syncr.weaponIndex < 9 ? 0 : player.weapons[1] ? 1 : 0]);
                    }catch(e){}
                }else{
                    !mills.x && (mills.x = player.x2);
                    !mills.y && (mills.y = player.y2);
                    attackType = null;

                    if (newGameObjects.length) {
                        let nearTrap = newGameObjects.filter(e => e.trap && e.active && UTILS.getDist(e, player, 0, 2) <= (player.scale + e.getScale() + 5) && !e.isTeamObject(player)).sort(function (a, b) {
                            return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
                        })[0];

                        let nearSpike = newGameObjects.filter(e => (e.name == "spikes" || e.name == "greater spikes" || e.name == "spinning spikes" || e.name == "poison spikes") && e.active && !e.isTeamObject(player)).sort(function (a, b) {
                            return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
                        })[0];
                        if (nearTrap) {
                            traps.dist = UTILS.getDist(nearTrap, player, 0, 2);
                            traps.aim = UTILS.getDirect(nearTrap, player, 0, 2);
                            traps.inTrap = true;
                            traps.info = nearTrap;
                        } else {
                            traps.inTrap = false;
                            traps.info = {};
                        }

                        if (getEl("autobreak").checked && !(clicks.left || (localStorage.getItem("left") == "true") && getEl("websynchit").checked) && !clicks.right) {
                            player.nearBreak = false;
                            player.nearBreakType = "none";
                            let hasNearSpikes = newGameObjects.filter(tmp => tmp.dmg && tmp.active && !tmp.isTeamObject(player) && Math.hypot(player.y3 - tmp.y, player.x3 - tmp.x) < (tmp.scale + Math.min(items.weapons[player.weapons[0]].range, 75))).sort(function (a, b) {
                                return Math.hypot(player.y3 - a.y, player.x3 - a.x) - Math.hypot(player.y3 - b.y, player.x3 - b.x);
                            });

                            if(hasNearSpikes.length > 0){
                                autobreak(hasNearSpikes, "NearSpikes");
                            } else if(traps.inTrap){
                                player.nearBreakType = "inTrap";
                                player.nearBreak = true;
                                player.nearBreakAim = traps.aim;
                                player.nearBreakbuild = traps.info;
                            } else if(getEl("autobreakall").checked){
                                if(nearobject && (nearobject && (GoToTeamBuild || GoToAllBuild))){
                                    let build = newGameObjects
                                    .filter(tmp => (tmp.active && tmp.health && Math.hypot(player.pingY - tmp.y, player.pingX - tmp.x) < (tmp.scale + items.weapons[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]].range)))
                                    .sort(function (a, b) {
                                        return Math.hypot(player.pingY - a.y, player.pingX - a.x) - Math.hypot(player.pingY - b.y, player.pingX - b.x);
                                    });
                                    autobreak(build, "break all");
                                } else if(enemy.length > 0 && near.dist2 < 600 && ((player.reloads[player.weapons[1] == 10? player.weapons[1] : player.weapons[0]] === 0 && player.secondaryIndex) || !player.secondaryIndex)){
                                    let build = newGameObjects
                                    .filter(tmp => tmp.active && (cantFindpath || (!tmp.isTeamObject(player) || (tmp.isTeamObject(player) && !tmp.dmg && !tmp.trap))) && tmp.health && Math.hypot(player.pingY - tmp.y, player.pingX - tmp.x) < (tmp.scale + items.weapons[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]].range))
                                    .sort(function (a, b) {
                                        if (a.dmg && !b.dmg) return -1;
                                        if (!a.dmg && b.dmg) return 1;

                                        if (a.trap && !b.trap) return -1;
                                        if (!a.trap && b.trap) return 1;

                                        if (a.doUpdate && !b.doUpdate) return -1;
                                        if (!a.doUpdate && b.doUpdate) return 1;

                                        return Math.hypot(player.pingY - a.y, player.pingX - a.x) - Math.hypot(player.pingY - b.y, player.pingX - b.x);
                                    });
                                    autobreak(build, "emy break");
                                }else if((player.reloads[player.weapons[1] !== 10? player.weapons[1] : player.weapons[0]] === 0 && player.secondaryIndex) || !player.secondaryIndex){
                                    let build = newGameObjects
                                    .filter(tmp => (tmp.active && tmp.health && (!tmp.pps || (tmp.pps && ((closestReachableEnd && UTILS.getDist(player, closestReachableEnd, 2, 0) < 35) || player.speed < player.maxSpeed *.35))) && Math.hypot(player.pingY - tmp.y, player.pingX - tmp.x) < (tmp.scale + items.weapons[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]].range)))
                                    .sort(function (a, b) {
                                        return Math.hypot(player.pingY - a.y, player.pingX - a.x) - Math.hypot(player.pingY - b.y, player.pingX - b.x);
                                    });
                                    autobreak(build, "break");

                                }
                            }
                        } else {
                            player.nearBreak = false;
                            player.nearBreakType = "none";
                            traps.inTrap = false;
                        }
                    } else {
                        player.nearBreakType = "none";
                        traps.inTrap = false;
                        player.nearBreak = false;
                    }
                    try {
                        let objectDist = items.list[player.items[3]].scale * 2;
                        if (Math.hypot(player.y2 - mills.y, player.x2 - mills.x) > objectDist + 5) {
                            if (mills.place) {
                                let aim = Math.atan2(mills.y - player.y2, mills.x - player.x2)
                                place(3, aim + toRad(72), 1);
                                place(3, aim - toRad(72), 1);
                                place(3, aim, 1);
                            }
                            mills.x = player.x2;
                            mills.y = player.y2;
                        }
                    } catch (e) {}
                    /*
                        if (instaC.can) {
                            instaC.changeType(player.weapons[1] == 10 ? "rev" : instaC.nobull ? "nobull" : "normal");
                        }
                        */
                    pl = [];

                    if (near.distPing <= 400 && enemy.length && game.tick % 2 == 0) {
                        autoPlace();
                        autoplaceTime = Date.now();
                    }
                    let isHoldPlace = false;
                    if (macro.f) {
                        place(4, mouseAim(), 1);
                        isHoldPlace = true;
                    }
                    if (macro.v) {
                        place(2, mouseAim(), 1);
                        isHoldPlace = true;
                    }
                    if (macro.u && items.list[player.items[player.getItemType(9)]].spawnPoint) {
                        circlePlace(player.getItemType(9), 0, 180, true, true);
                        isHoldPlace = true;
                    }
                    if (macro.b && !items.list[player.items[player.getItemType(5)]].health) {
                        place(player.getItemType(5), mouseAim(), 1);
                        isHoldPlace = true;
                    }
                    if (macro.h) {
                        if(player.speed == 0){
                            place(player.getItemType(7), mouseAim() - toRad(45), 1);
                            place(player.getItemType(7), mouseAim() + toRad(45), 1);
                        } else {
                            place(player.getItemType(7), mouseAim(), 1);
                        }
                    }
                    if (macro.n) {
                        place(3, mouseAim(), 1);
                        isHoldPlace = true;
                    }
                    if (keys[71]) {
                        packet(code.move, ((enemy.length > 0 && near.dist2 < 600) ? near.aim2 : mouseAim()), 1);
                        place(4, ((enemy.length > 0 && near.dist2 < 600) ? near.aim2 : mouseAim()), 1);
                        place(2, ((enemy.length > 0 && near.dist2 < 600) ? near.aim2 : mouseAim()) + toRad(90), 1);
                        place(2, ((enemy.length > 0 && near.dist2 < 600) ? near.aim2 : mouseAim()) - toRad(90), 1);
                        isHoldPlace = true;
                    }
                    if(antiinsta()[0] && getEl("highping").checked && window.pingTime > 100 && player.skinIndex != 7 && player.skinIndex != 45){
                        place(0, mouseAim());
                    }
                    let canSpikeTick = false;
                    if(getEl("spiketicknear").checked){
                        enemy.forEach((tmpObj)=>{
                            if(player.reloads[player.weapons[0]] === 0) {
                                if(tmpObj.dist3 <= (items.weapons[player.weapons[0]].range + 35)) {
                                    newGameObjects.filter(tmp => (tmp.type == 1 && tmp.y >= config.mapScale - config.snowBiomeTop) || (tmp.dmg && tmp.active && !tmp.isTeamObject(tmpObj))).forEach((tmp)=>{
                                        let dist = UTILS.getDist(tmpObj, tmp, 3, 0);
                                        if(dist <= (tmp.scale + player.scale)*1.05){
                                            canSpikeTick = true;
                                        }
                                        if(dist <= (tmp.scale + player.scale/2 + items.weapons[player.weapons[0]].range) && !tmpObj.inTrap){
                                            let emyHitSpike = {
                                                x: tmpObj.x3 + Math.cos(tmpObj.aim3) * dist,
                                                y: tmpObj.y3 + Math.sin(tmpObj.aim3) * dist
                                            }
                                            if(UTILS.getDist(emyHitSpike, tmp, 0, 0) <= (tmp.scale + player.scale)){
                                                canSpikeTick = true;
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    }
                    if(player.nearBreak && player.nearBreakType == "NearSpikes"){
                        attackType = ["ns", player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0], player.nearBreakAim];
                        my.weapon = attackType[1];
                        selectWeapon(attackType[1]);
                        caninsta = false;
                        game.tickBase(() => {
                            caninsta = true;
                        },1);
                        if (player.reloads[attackType[1]] === 0) {
                            sendAtck(1, player.nearBreakAim);
                            attackTime = Date.now();
                            my.waitHit = 1;
                            UseHat(40);
                            game.tickBase(() => {
                                caninsta = true;
                                sendAtck(0, player.nearBreakAim);
                                my.waitHit = 0;
                                funnyhat = funnyHat();
                                funnyacc = funnyAcc();
                                AutoHatAcc();
                            }, 1);
                        }
                    } else {

                        if(getEl("spiketicktrap").checked && caninsta){
                            try{
                                let pV = player.primaryVariant != undefined ? config.weaponVariants[player.primaryVariant].val : 1;
                                let dmg = items.weapons[player.primaryIndex].dmg * pV * (items.weapons[player.primaryIndex].sDmg || 1) * 3.3;
                                if(player.secondaryIndex && player.secondaryIndex == 10){
                                    let sV = 1;
                                    sV = player.secondaryVariant != undefined ? config.weaponVariants[player.secondaryVariant].val : 1;
                                    dmg = items.weapons[player.secondaryIndex].dmg * sV * (items.weapons[player.secondaryIndex].sDmg || 1) * 3.3;
                                }
                                if(checkspiketick() && near.reloads[near.secondaryIndex && near.secondaryIndex == 10 ? near.secondaryIndex : near.primaryIndex] > 0 && near.reloads[near.secondaryIndex && near.secondaryIndex == 10 ? near.secondaryIndex : near.primaryIndex] < game.tickSpeed && near.inTrap.health <= dmg && player.reloads[player.weapons[1]] === 0 && player.reloads[player.weapons[0]] === 0 && near.dist3 < 110 && player.weapons[1] && player.weapons[1] == 10){
                                    setTimeout(() => {
                                        caninsta = false;
                                        my.autoAim = true;
                                        Text("Spike Tick(trap)", "#f00", 1);
                                        betaspiketick = true;
                                        attackTime = Date.now();
                                        my.weapon = player.weapons[1];
                                        packet(code.aim, getAttackDir());
                                        selectWeapon(player.weapons[1]);
                                        UseHat(53);
                                        sendAutoGather();
                                        setTimeout(() => {
                                            attackTime = Date.now();
                                            my.weapon = player.weapons[0];
                                            packet(code.aim, getAttackDir());
                                            selectWeapon(player.weapons[0]);
                                            UseHat(7);
                                            place(2, getAttackDir());
                                            game.tickBase(() => {
                                                betaspiketick = false;
                                                my.autoAim = false;
                                                caninsta = true;
                                                sendAutoGather();
                                            }, 1);
                                        },parseInt(getEl("traptickSpeed2").value));
                                    },parseInt(getEl("traptickSpeed1").value));
                                }
                            }catch(e){}
                        }
                        if(caninsta && player.reloads[player.weapons[0]] === 0 && canSpikeTick && player.nearBreakType != "NearSpikes"){
                            Text("Spike Tick(near spike)", "#f00", 1);
                            insta(5);
                        } else if(caninsta && player.reloads[player.weapons[0]] === 0 && spikeTick && player.nearBreakType != "NearSpikes" && checkAntiSpikeTick()){
                            Text("Spike Tick", "#f00", 1);
                            insta(5);
                        } else if(caninsta && player.reloads[player.weapons[0]] === 0 && antibullHit && player.nearBreakType != "NearSpikes" && checkAntiSpikeTick()){
                            Text("Anti Bull", "#f00", 1);
                            insta(5);
                            packet(code.move, getMoveDir(), 1);
                            Text("Auto Hit", "#f00", 1);
                            insta(5);
                        } else if(caninsta && player.reloads[player.weapons[0]] === 0 && player.weapons[0] == 5 && player.primaryVariant > 1 && near.skinIndex != 22 && near.skinIndex != 6 && getEl("autotick").checked && checkAntiSpikeTick() && player.reloads[53] === 0 && player.reloads[player.weapons[0]] === 0 && Math.abs(near.distPing - 210) < 30 && (!near.inTrap || (near.inTrap && near.reloads[near.secondaryIndex == 10 ? near.secondaryIndex : near.primaryIndex] > 0 && near.reloads[near.secondaryIndex == 10 ? near.secondaryIndex : near.primaryIndex] <= game.tickRate))){
                            Text("Auto Tick", "#f00", 1);
                            insta(3);
                        } else if(player.nearBreak && player.nearBreakType == "inTrap"){
                            let dmg = 0;
                            try{
                                let sV = 1;
                                sV = player.primaryVariant != undefined ? config.weaponVariants[player.primaryVariant].val : 1;
                                dmg += items.weapons[player.primaryIndex].dmg * sV * (items.weapons[player.primaryIndex].sDmg || 1);
                                sV = 1;
                                sV = player.secondaryVariant != undefined ? config.weaponVariants[player.secondaryVariant].val : 1;
                                dmg += items.weapons[player.secondaryIndex].dmg * sV * (items.weapons[player.secondaryIndex].sDmg || 1) * 3.3;
                            }catch(e){}
                            if(player.nearBreakbuild.health <= dmg && player.reloads[player.weapons[1]] === 0 && player.reloads[player.weapons[0]] === 0 && !near.inTrap && near.distPing < items.weapons[player.weapons[0]].range + 35 && player.weapons[1] && player.weapons[1] == 10){
                                my.autoAim = true;
                                caninsta = false;
                                attackTime = Date.now();
                                my.weapon = player.weapons[0];
                                packet(code.aim, getAttackDir());
                                selectWeapon(player.weapons[0]);
                                UseHat(20);
                                sendAutoGather();
                                game.tickBase(() => {
                                    my.autoAim = false;
                                    attackTime = Date.now();
                                    my.weapon = player.weapons[1];
                                    packet(code.aim, player.nearBreakAim);
                                    selectWeapon(player.weapons[1]);
                                    UseHat(40);
                                    game.tickBase(() => {
                                        caninsta = true;
                                        sendAutoGather();
                                    }, 1);
                                },1);
                            }else{
                                attackType = ["bt", player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0], player.nearBreakAim];
                                if ((player.weaponIndex != attackType[1]) || player.buildIndex > -1) {
                                    selectWeapon(attackType[1]);
                                }
                                if (player.reloads[attackType[1]] === 0 && !my.waitHit) {
                                    sendAtck(1, getAttackDir());
                                    attackTime = Date.now();
                                    my.waitHit = 1;
                                    game.tickBase(() => {
                                        sendAtck(0, getAttackDir());
                                        my.waitHit = 0;
                                    }, 1);
                                }
                            }
                        } else if (caninsta && (!isHoldPlace && (player.nearBreak || (player.reloads[player.weapons[0]] === 0 && (clicks.middle || (localStorage.getItem("middle") == "true") && getEl("websyncshoot").checked)) || (clicks.left || (localStorage.getItem("left") == "true") && getEl("websynchit").checked) || clicks.right || (!IsSpikeTick && (((getEl("autobullspam").checked) && items.weapons[player.weapons[0]].dmg > 5 && ((player.reloads[player.weapons[1]] === 0 && player.secondaryIndex) || !player.secondaryIndex) && near.distPing <= (items.weapons[player.weapons[0]].range + near.scale))))))) {
                            if(clicks.right){
                                attackType = ["cr", player.weapons[1] == 10? player.weapons[1] : player.weapons[0], mouseAim()];
                            } else if((clicks.left || (localStorage.getItem("left") == "true") && getEl("websynchit").checked)){
                                attackType = ["cl", player.weapons[0], mouseAim()];
                            } else if(player.nearBreak){
                                attackType = ["nb", (player.weapons[1] == 10 && player.reloads[player.weapons[0]] === 0) ? player.weapons[1] : player.weapons[0], player.nearBreakAim];
                            } else if((clicks.middle || (localStorage.getItem("middle") == "true") && getEl("websyncshoot").checked)){
                                attackType = ["cm", player.weapons[1], near.aim4];
                                try{
                                    if(items.list[player.items[player.getItemType(7)]].zIndex){
                                        circlePlace(player.getItemType(7), tmpObj.aim2, 180, true, true);
                                    }
                                }catch(e){}
                            } else {
                                attackType = ["bs", player.weapons[0], near.aimPing];
                            }
                            if ((player.weaponIndex != attackType[1]) || player.buildIndex > -1) {
                                selectWeapon(attackType[1]);
                            }
                            if (player.reloads[attackType[1]] === 0 && !my.waitHit) {
                                if(attackType[0] === "bs" || attackType[0] === "ah" || attackType[0] === "cm" || attackType[0] === "st" || (attackType[0] === "cl" && near.distPing <= (items.weapons[player.weapons[0]].range + near.scale))){
                                    my.autoAim = true;
                                }
                                sendAtck(1, getAttackDir());
                                attackTime = Date.now();
                                my.waitHit = 1;
                                game.tickBase(() => {
                                    sendAtck(0, getAttackDir());
                                    my.waitHit = 0;
                                    if((attackType[0] === "bs" || attackType[0] === "cm" || attackType[0] === "ah" || attackType[0] === "st" || attackType[0] === "cl") && caninsta){
                                        my.autoAim = false;
                                    }
                                }, 1);
                            }
                        }

                        if (player.weapons[1] && !attackType && my.waitHit === 0 && caninsta) {
                            if (player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0) {
                                let fastSpeed =items.weapons[player.weapons[0]].spdMult < items.weapons[player.weapons[1]].spdMult ? 1 : 0;
                                if (player.weaponIndex != player.weapons[fastSpeed] || player.buildIndex > -1) {
                                    if(!my.reloaded){
                                        selectWeapon(player.weapons[fastSpeed]);
                                    }
                                }
                                my.reloaded = true;
                            } else {
                                my.reloaded = false;
                                if (player.reloads[player.weapons[(player.weapons[1] && player.weapons[1] == 10) ? 1 : 0]] > 0) {
                                    if (player.weaponIndex != player.weapons[(player.weapons[1] && player.weapons[1] == 10) ? 1 : 0] || player.buildIndex > -1) {
                                        selectWeapon(player.weapons[(player.weapons[1] && player.weapons[1] == 10) ? 1 : 0]);
                                    }
                                } else if (player.reloads[player.weapons[(player.weapons[1] && player.weapons[1] == 10) ? 1 : 0]] == 0 && player.reloads[player.weapons[(player.weapons[1] && player.weapons[1] == 10) ? 0 : 1]] > 0) {
                                    if (player.weaponIndex != player.weapons[(player.weapons[1] && player.weapons[1] == 10) ? 0 : 1] || player.buildIndex > -1) {
                                        selectWeapon(player.weapons[(player.weapons[1] && player.weapons[1] == 10) ? 0 : 1]);
                                    }
                                }
                            }
                        }
                        if(my.waitHit === 0 && caninsta){
                            packet(code.aim, getAttackDir());
                        }

                        if (player.shameCount > 0 && player.skinIndex != 45 && player.skins[7] && ((game.tick - player.bullTick) % 9 == 0 || reSync)) {
                            my.reSync = true;
                        } else {
                            my.reSync = false;
                        }
                        funnyhat = funnyHat();
                        funnyacc = funnyAcc();
                        AutoHatAcc();
                    }
                }
                spikeTick = false;
                antibullHit = false;
                autoHit = false;
                Isinsta = false;
            }
        }
    }catch(e){
        console.error(e)
    }
}
let ar = false;
// UPDATE LEADERBOARD:
function updateLeaderboard(data) {
    lastLeaderboardData = data;
    let HTML = `Sakuna Mod<div id="leaderboardData">`;
    let tmpC = 0;
    for (let i = 0; i < data.length; i += 3) {
        tmpC++;
        HTML += `
            <div class="leaderHolder">
                <div class="leaderboardItem" style="color: ${(data[i] == playerSID) ? "rgba(255,255,0,0.6)" : "rgba(255,255,255,0.6)"};">
                    ${tmpC + ". {" + data[i] + "}" + (data[i + 1] != "" ? data[i + 1] : "unknown")}
                         </div>
                         <div class="leaderScore">
                     ${UTILS.sFormat(data[i + 2]) || "0"}
                </div>
            </div>`
            let name = (data[i + 1] != "" ? data[i + 1] : "unknown");
        if(!PlayerName[data[i]]){
            addMenuChText("Game", `Found {${data[i]}}${name}`, "yellow");
        } else if(PlayerName[data[i]] != name){
            addMenuChText("Game", `Change {${data[i]}}${PlayerName[data[i]]} to {${data[i]}}${name}`, "yellow");
        }
        PlayerName[data[i]] = name;
    }
    HTML += `</div>`
    getEl('leaderboard').innerHTML = HTML;
}
// LOAD GAME OBJECT:
function loadGameObject(data) {

    for (let i = 0; i < data.length;) {
        objectManager.add(data[i], data[i + 1], data[i + 2], data[i + 3], data[i + 4],
                          data[i + 5], items.list[data[i + 6]], true, (data[i + 7] >= 0 ? {
            sid: data[i + 7]
        } : null));
        try{
            BreakBuild = BreakBuild.filter(tmp => Math.hypot(data[i + 1] - tmp.x, data[i + 2] - tmp.y) > data[i + 4] && Math.hypot(player.x2 - tmp.x, player.y2 - tmp.y) <= 600).sort(function (a, b) {
                return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
            });
        }catch(e){}
        try{
            let tmpObj = findPlayerBySID(data[i + 7]);
            if(tmpObj ==player){
            }
        }catch(e){}
        try{
            let tmpObj = findPlayerBySID(data[i + 7]);
            if (tmpObj) {
                if (!tmpObj.isTeam(player)) {
                    if(Math.hypot(data[i + 1] - player.pingX, data[i + 2] - player.pingY) < 100 && [6, 7, 8, 9].includes(data[i + 6])){
                        PrioritySoldier = Date.now();
                        onlySoldier = Date.now();
                        UseHat(6);
                        place(0, getAttackDir());
                        Text("Anti Spike", "#00f");
                    }
                }
            }
        } catch(e){};
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
                try{
                    if (!aiManager.aiTypes[data[i + 1]].name)
                        tmpObj.name = config.cowNames[data[i + 6]];
                }catch(e){}
                tmpObj.forcePos = true;
                tmpObj.sid = data[i];
                tmpObj.visible = true;
            }
            tmpObj.inTrap = newGameObjects.filter(e => e.trap && e.active && UTILS.getDist(e, tmpObj, 0, 2) < 50 && !e.isTeamObject(tmpObj)).sort(function (a, b) {
                return UTILS.getDist(a, tmpObj, 0, 2) - UTILS.getDist(b, tmpObj, 0, 2);
            })[0];
            tmpObj.GS = () => {return tmpObj.scale + player.scale + player.maxSpeed};

            i += 7;
        }
    }
}

// ANIMATE AI:
function animateAI(sid) {
    tmpObj = findAIBySID(sid);
    if (tmpObj) tmpObj.startAnim();

}
let hitTime = Date.now();
function antiinsta(){
    let candead = false;
    let totally = 0;
    let list = [];
    let emyhit = 0;
    let val = 1;//((player.skinIndex == 6 && UseHatid == 6 && checkAntiSpikeTick() && caninsta && !player.inTrap) ? .77 : 1)
    try{
        enemy.forEach((tmpObj) => {
            let range = 400;
            let thiscanhit = false;
            try{
                range = items.weapons[tmpObj.primaryIndex].range + player.scale*2 + player.maxSpeed;
            }catch(e){}
            if(tmpObj.dist3 <= range){
                try{
                    if(tmpObj.primaryIndex){
                        if(tmpObj.reloads[tmpObj.primaryIndex] <= (game.tickRate + window.pingTime)) {
                            let pV = tmpObj.primaryVariant != undefined ? config.weaponVariants[tmpObj.primaryVariant].val : 1;
                            let dmg = Math.round(items.weapons[tmpObj.primaryIndex].dmg * pV * 1.5 * val);
                            totally = dmg;
                            list.push(dmg);
                            thiscanhit = true;
                        }
                    } else {
                        let dmg = Math.round(80 * val);
                        totally += dmg;
                        list.push(dmg);
                    }
                }catch(e){
                    let dmg = Math.round(80 * val);
                    totally += dmg;
                    list.push(dmg);
                }
                try{
                    if(tmpObj.secondaryIndex){
                        if(tmpObj.reloads[tmpObj.secondaryIndex] <= (game.tickRate + window.pingTime)) {
                            if(tmpObj.secondaryIndex == 10){
                                let pV = tmpObj.secondaryVariant != undefined ? config.weaponVariants[tmpObj.secondaryVariant].val : 1;
                                let dmg = Math.round(items.weapons[tmpObj.secondaryIndex].dmg * pV * val);
                                totally += dmg;
                                list.push(dmg);
                                thiscanhit = true;
                            } else {
                                let dmg = Math.round(items.weapons[tmpObj.secondaryIndex].Pdmg * ((player.skinIndex == 6 && checkAntiSpikeTick()) ? val : 1));
                                totally += dmg;
                                list.push(dmg);
                                thiscanhit = true;
                            }
                        }
                    } else if(tmpObj.primaryIndex != 0){
                        let dmg = Math.round(50 * val);
                        totally += dmg;
                        list.push(dmg);

                    }
                }catch(e){
                    if(tmpObj.primaryIndex != 0){
                        let dmg = Math.round(50 * val);
                        totally += dmg;
                        list.push(dmg);
                    }
                }
                try{
                    if(!tmpObj.shooting[53] && tmpObj.reloads[53] <= (game.tickRate + window.pingTime)){
                        let dmg = Math.round(25 * val);
                        totally += dmg;
                        list.push(dmg);

                    }
                }catch(e){
                    let dmg = Math.round(25 * val);
                    totally += dmg;
                    list.push(dmg);
                }
            }
            if(thiscanhit){
                emyhit++;
            }
        });
        if(emySpikeHit){
            emySpikeHit.forEach(e=>{
                totally += e.dmg;
            });
        }
        const listSum = list.reduce((sum, dmg) => sum + dmg, 0);
        if(totally >= Math.min(100, Math.max(player.health, player.oldHealth)) && player.shameCount < 7 && (emyhit > 1 || player.shameCount == 0 || player.shameCount != player.maxShame - 1)){
            candead = emyhit;
        }
        return [candead, list];
    }catch(e){
        return [false];
    }
    return [false];
}

// GATHER ANIMATION:
function gatherAnimation(sid, didHit, index) {
    tmpObj = findPlayerBySID(sid);
    if (tmpObj) {
        let range = items.weapons[index].range;
        try{
            range = items.weapons[tmpObj.primaryIndex].range;
        }catch(e){}
        if(!tmpObj.isTeam(player) && tmpObj.dist2 <= (range + 70)){
            let pV = 1;
            try{
                pV = index == tmpObj.primaryIndex ? tmpObj.primaryVariant != undefined ? config.weaponVariants[tmpObj.primaryVariant].val : 1 : 1;
            } catch(e){}
            AntiTimes = 1;
            AntiTime = Date.now();
            if (AntiTimes > 0 && player.health < 76) {
                if(antiinsta()[0]){
                    let amount = 100 / items.list[player.items[0]].healing;
                    for (let i = 0; i < amount; i++) {
                        place(0, mouseAim());
                    }
                    if(AntiTimes == 1){
                        Text("Anti Insta", "#f00");
                    } else {
                        Text("Anti Rev Insta", "#f00");
                    }
                }
                AntiTimes = 0;
                AntiTime = Date.now();
            }
            isGetHit = false;
            if(isticking == tmpObj){
                Text(`Anti One Tick: ${PlayerName[tmpObj.sid]}`, "#00f");
            }
            if(tmpObj.reloads[53] <= game.tickRate && tmpObj.reloads[53] != 1 && [3, 4, 5].includes(index) && tmpObj.reloads[tmpObj.secondaryIndex] == 0 && tmpObj.secondaryIndex == 15 && tmpObj.secondaryIndex != 10){
                onlyEmp = Date.now();
                Text("anti Emp", "#00f");
            } else {
                onlySoldier = Date.now();
                Text("anti", "#00f");
            }
        }
        tmpObj.startAnim(didHit, index);
        tmpObj.gatherIndex = index;
        tmpObj.gathering = 1;
        let syncr = findPlayerBySID(parseInt(getEl("syncsid").value));
        if(getEl("synchit").checked || getEl("togglePlayerSync").checked){
            let canSyncinsta = false;
            let size = (items.weapons[index].range + 35)
            try{
                size = (items.weapons[tmpObj.primaryIndex].range + 35);
                let dir = Math.atan2(near.x2 - tmpObj.x2, near.y2 - tmpObj.y2);
                let x = tmpObj.x2 + Math.cos(dir) * size;
                let y = tmpObj.y2 + Math.sin(dir) * size;
                let dist = Math.hypot(x - near.x2, y - near.y2);
                if(dist < size){
                    canSyncinsta = true;
                }
            }catch(e){}
            if(tmpObj != player && caninsta && tmpObj.isTeam(player) && canSyncinsta && [3, 4, 5].includes(index) && player.reloads[player.weapons[0]] == 0 && Math.hypot(tmpObj.pingX - near.pingX, tmpObj.pingY - near.pingY) <= size && near.distPing <= (items.weapons[player.weapons[0]].range + 35)){
                game.tickBase(() => {
                    if(getEl("synchit").checked){
                        Text("Sync Hit:" + PlayerName[near.sid], "#f00", 1);
                        my.autoAim = true;
                        caninsta = false;
                        attackTime = Date.now();
                        my.weapon = player.weapons[0];
                        selectWeapon(player.weapons[0]);
                        UseHat(7);
                        UseAcc(21);
                        sendAtck(1, getAttackDir());
                        sendAtck(0, getAttackDir());
                        my.waitHit = 1;
                        game.tickBase(() => {
                            my.waitHit = 0;
                            my.autoAim = false;
                            caninsta = true;
                        }, 1);
                    }
                },1);
            }else if(syncr === tmpObj && getEl("togglePlayerSync").checked){
                game.tickBase(() => {
                    sendAtck(1, syncr.d2);
                    sendAtck(0, syncr.d2);
                },1);
            }
        }
        if (didHit) {
            let tmpObjects = objectManager.hitObj;
            objectManager.hitObj = [];
            game.tickBase(() => {
                // refind
                tmpObj = findPlayerBySID(sid);
                let wval = 1;
                try{
                    wval = config.weaponVariants[tmpObj[(index < 9 ? "prima" : "seconda") + "ryVariant"]].val;
                }catch(e){}
                let val = items.weapons[index].dmg * wval * (items.weapons[index].sDmg || 1) * (tmpObj.skinIndex == 40 ? 3.3 : 1);
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
            tmpObj.damaged = Math.min(255, tmpObj.damaged + 60);
            objectManager.hitObj.push(tmpObj);
        }
    }
}

// SHOOT TURRET:
function shootTurret(sid, dir) {
    tmpObj = findObjectBySid(sid);
    if (tmpObj) {
        /*    projectiles.forEach((tmp)=>{
            if(tmp.x2 == tmpObj.x && tmp.y2 == tmpObj.y){
                tmp.tmpObj = findPlayerBySID(tmpObj.owner.sid);
            }
        });*/
        if (config.anotherVisual) {
            tmpObj.lastDir = dir;
        } else {
            tmpObj.dir = dir;
        }
        tmpObj.xWiggle += config.gatherWiggle * Math.cos(dir + Math.PI);
        tmpObj.yWiggle += config.gatherWiggle * Math.sin(dir + Math.PI);
        tmpObj.shootted = 1;
        if(getEl("lowheal").checked && Date.now() - AntiTime > (111 + window.pingTime) && player.health <= (player.skinIndex === 6 ? 23 : 30) && player.shameCount < 6 && Date.now() - LowHealTime > 60 && cananti){
            LowHealTime = Date.now();
            heal();
            onlySoldier = Date.now();
            Text("Low heal(turret)", "#ff5521");
        }
    }
}
var shopList = config.isSandbox?
    [
        [11, false],
        [6, true],
        [7, true],
        [22, true],
        [40, true],
        [15, true],
        [53, true],
        [31, true],
        [12, true],
        [20, true],
        [11, true],
        [26, true],
        [56, true],
        [19, false],
        [21, false],
        [18, false],
        [13, false],
    ]:
[
    [11, false],
    [40, true],
    [7, true],
    [12, true],
    [31, true],
    [15, true],
    [6, true],
    [53, true],
    [22, true],
    [11, true],
    [26, true],
    [56, true],
    [20, true],
];

let canbuyequip = false;
// UPDATE PLAYER VALUE:
function updatePlayerValue(index, value, updateView) {
    if (player) {
        player[index] = value;
        if (index == "points") {
            if (getEl("autobuy").checked) {
                if(shopList.length){
                    if(shopList[0][1] == true) {
                        hats.filter(e => e.id == shopList[0][0]).forEach(t => {
                            if(player.skins[t.id]){
                                shopList.shift();
                            } else if(player && player.points >= t.price) {
                                packet(code.store, 1, t.id, 0);
                            }
                        });
                    }else if(shopList[0][1] == false) {
                        accessories.filter(e => e.id == shopList[0][0]).forEach(t => {
                            if(player.tails[t.id]){
                                shopList.shift();
                            } else if(player && player.points >= t.price) {
                                packet(code.store, 1, t.id, 1);
                            }
                        });
                    }
                }
                if(!canbuyequip){
                    if(shopList.length == 0 || !shopList.length) {
                        canbuyequip = true;
                        console.log("buy All", shopList);
                        for(let i =1;i<57;i++){
                            if(!player.skins[i]){
                                shopList.push([i, true])
                            }
                        }
                        for(let i =1;i<22;i++){
                            if(!player.tails[i]){
                                shopList.push([i, false])
                            }
                        }
                    }
                }
            }
        } else if (index == "kills") {
            if (getEl("KillChat").checked) {
                setTimeout(()=>{
                    textChat(getEl("killchat").value, { "{kills}": value, "{player}": PlayerName[deadid], "{sid}": deadid });
                },10);
            }
        }
    }
}

// ADD PROJECTILE:
function addProjectile(x, y, dir, range, speed, indx, layer, sid) {
    projectileManager.addProjectile(x, y, dir, range, speed, indx, null, null, layer, inWindow).sid = sid;
    checkProjectileHolder(x, y, dir, range, speed, indx, layer, sid);
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
        antiProj(nearPlayer, dir, range, speed, indx, weaponIndx);

        if (indx == 1) {
            nearPlayer.shooting[53] = 1;
            //                     nearPlayer.reloads[53] = (2500 - game.tickRate);

        } else {
            try{
                projectiles.forEach((tmp)=>{
                    if(tmp.x2 == x && tmp.y2 == y){
                        tmp.tmpObj = nearPlayer;
                    }
                });
            }catch(e){}
            nearPlayer.shootIndex = weaponIndx;
            nearPlayer.shooting[1] = 1;
            if(nearPlayer == player){
                AssassinTime = Date.now();
            }
            //                        nearPlayer.reloads[weaponIndx] = (items.weapons[weaponIndx].speed * (nearPlayer.skinIndex == 20 ? 0.78 : 1));
        }
        if(caninsta){
            let canSyncinsta = false;
            try{
                let size = (items.weapons[nearPlayer.primaryIndex].range + 35)
                let dist = Math.hypot(near.x2 - nearPlayer.x2, near.y2 - nearPlayer.y2);
                if(dist < size){
                    canSyncinsta = true;
                }
            }catch(e){}
            if(getEl("syncinsta").checked && canSyncinsta && player.reloads[player.weapons[1]] == 0 && nearPlayer != player && player.reloads[player.weapons[0]] == 0 && nearPlayer.isTeam(player) && near.distPing <= (items.weapons[player.weapons[0]].range + 35)){
                game.tickBase(() => {
                    Text("Sync Insta: " + PlayerName[near.sid], "#f00", 1);
                    insta();
                },1);
            } else if (getEl("syncshoot").checked && nearPlayer != player && player.reloads[player.weapons[1]] == 0 && player.weapons[1] == 15) {
                if (nearPlayer.isTeam(player)) {
                    let syncrlist = [];
                    enemy.forEach((tmpObj) => {
                        let dist = Math.hypot(tmpObj.y2 - nearPlayer.y2, tmpObj.x2 - nearPlayer.x2);
                        let X = nearPlayer.x2 + Math.cos(dir) * dist;
                        let Y = nearPlayer.y2 + Math.sin(dir) * dist;
                        let range = Math.hypot(tmpObj.y2 - Y, tmpObj.x2 - X);
                        syncrlist.push([tmpObj, range]);
                    });
                    let syncr = syncrlist.sort(function (a, b) {
                        return a[1] - b[1]
                    })[0];
                    if(syncr){
                        try{
                            syncr = syncr[0];
                        }catch(e){}
                        if(caninsta){
                            game.tickBase(() => {
                                try{
                                    if(items.list[player.items[player.getItemType(7)]].zIndex){
                                        circlePlace(player.getItemType(7), syncr.aim2, 180, true, true);
                                    }
                                }catch(e){}
                                try{
                                    caninsta = false;
                                    my.weapon = player.weapons[1];
                                    selectWeapon(player.weapons[1]);
                                    UseHat(53);
                                    sendAtck(1, syncr.aim2);
                                    Text("Sync Test: " + PlayerName[syncr.sid], "#f00", 1);
                                    game.tickBase(() => {
                                        caninsta = true;
                                        sendAtck(0, syncr.aim2);
                                    },1);
                                }catch(e){}
                            },1);
                        }
                    }
                }
            } else if (getEl("togglePlayerSync").checked && indx !== 1) {
                let syncr = findPlayerBySID(parseInt(getEl("syncsid").value));
                if(syncr === nearPlayer){
                    game.tickBase(() => {
                        sendAtck(1, syncr.d2);
                        sendAtck(0, syncr.d2);
                    },1);
                }
            }
        }
    }
}

let projectileCount = 0;
let HoldQ = false, HoldQTime = 300;
let isticking = false;
function antiProj(tmpObj, dir, range, speed, index, weaponIndex) {
    if (!tmpObj.isTeam(player)) {
        let size = Math.hypot(tmpObj.x2 - player.x2, tmpObj.y2 - player.y2);
        let aim = tmpObj.aim2;
        let x = tmpObj.x2 + Math.cos(dir) * size;
        let y = tmpObj.y2 + Math.sin(dir) * size;
        let dist = Math.hypot(x - player.x2, y - player.y2);
        if ((dist <= player.scale*2 && size <= range)) {
            if (index == 1){
                AntiTimes = 2;
                if (AntiTimes > 0 && player.health < 76) {
                    if(antiinsta()[0]){
                        let amount = 100 / items.list[player.items[0]].healing;
                        for (let i = 0; i < amount; i++) {
                            place(0, mouseAim());
                        }
                        if(AntiTimes == 1){
                            Text("Anti Insta", "#f00");
                        } else {
                            Text("Anti Rev Insta", "#f00");
                        }
                    }
                    AntiTimes = 0;
                    AntiTime = Date.now();
                }
            }
            isGetHit = false;
            let isTick = (tmpObj.primaryIndex == 5 && tmpObj.primaryVariant > 1 && tmpObj.distPing < 400);
            if(index == 1 && isTick && getEl("antitick").checked){
                PrioritySoldier = Date.now();
                onlySoldier = Date.now();
                UseHat(6);
                isticking = tmpObj;
                setTimeout(()=>{
                    isticking = false;
                },200);
            }
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
                if(getEl("AntiBowChat").checked){
                    textChat(getEl("antibowchat").value);
                }
                place(3, aim);
                place(1, aim);
                let rx = player.x2 + Math.cos(aim + toRad(90)) * 70;
                let ry = player.y2 + Math.sin(aim + toRad(90)) * 70;
                let right = newGameObjects.some(tmp => tmp.active && !tmp.ignoreCollision && Math.hypot(tmp.y - ry, tmp.x - rx) <= (player.scale + tmp.scale));
                if(!right){
                    isMoveBow = true;
                    packet(code.move, aim + toRad(90), 1);
                } else {
                    let lx = player.x2 + Math.cos(aim - toRad(90)) * 70;
                    let ly = player.y2 + Math.sin(aim - toRad(90)) * 70;
                    let left = newGameObjects.some(tmp => tmp.active && !tmp.ignoreCollision && Math.hypot(tmp.y - ly, tmp.x - lx) <= (player.scale + tmp.scale));
                    if(!left){
                        isMoveBow = true;
                        packet(code.move, aim - toRad(90), 1);
                    } else {
                        let bx = player.x2 + Math.cos(aim + toRad(180)) * 70;
                        let by = player.y2 + Math.sin(aim + toRad(180)) * 70;
                        let back = newGameObjects.some(tmp => tmp.active && !tmp.ignoreCollision && Math.hypot(tmp.y - by, tmp.x - bx) <= (player.scale + tmp.scale));
                        if(!back){
                            isMoveBow = true;
                            packet(code.move, aim + toRad(180), 1);
                        }
                    }
                }
                setTimeout(()=>{
                    if(isMoveBow){
                        isMoveBow = false;
                        packet(code.move, getMoveDir(), 1);
                    }
                },(range / speed));
                HoldQ = Date.now();
                HoldQTime = (range / speed);
            } else if (projectileCount >= 2 && Date.now() - HoldQ > 100) {
                place(3, aim);
                place(3, aim + toRad(72));
                place(3, aim - toRad(72));
                place(1, aim);
                place(1, aim + toRad(90));
                place(1, aim - toRad(90));
                sendChat("sync?");
                HoldQ = Date.now();
                HoldQTime = (range / speed);
            }
        }
    }
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
let joinbar = document.createElement('div');
joinbar.id = "joinbar";
joinbar.innerHTML = `
<div id="joinbar">
    <div class="joinbar-box">
        <div class="joinbar-box-border"></div>
        <div class="joinbar-time-box">
            <div id="joinbar_time" class="joinbar-time"></div>
            <img id='joinbar_avatar' class="joinbar-avatar" src="https://yt3.googleusercontent.com/t9CcBvjTjs5D_sLZjtGkcfaTyiZCrx0nyOf7ekj3Fut9gZD76G00x12TK8Jg4czmBWjXcUtP9yE=s160-c-k-c0x00ffffff-no-rj">
            <div id='joinbar_name' class="joinbar-name">GrIm ReApEr</div>
            <div class="joinbar-apply">
                <span class="joinbar-apply-text">Join </span>
                <span id="joinbar_clan" class="joinbar-clan">brwwmod</span>
                <span class="joinbar-apply-text">Request</span>
                <span id="joinbar_timeText" class="joinbar-timeText">(10)</span>
            </div>
            <div class="joinbar-key">Y</div>
        </div>
    </div>
</div>

<style>
    #joinbar {
        position: fixed;
        z-index: 123456789;
    }

    .joinbar-box {
        position: fixed;
        top: 15px;
        left: 50%;
        transform: translateX(-50%);
        width: 580px;
        height: 100px;
        display: block;
        background: #29313c;
        border: 0 solid #fff;
    }

    .joinbar-time-box {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 574px;
        height: 94px;
        display: block;
        background: #29313c;
    }

    .joinbar-box-border {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 570px;
        height: 90px;
        display: block;
        background: transparent;
        border: 3px solid #fff5;
        z-index: 1;
    }

    .joinbar-box-border:hover {
        width: 580px;
        height: 100px;
        border: 2px solid #fff9;
    }

    .joinbar-time {
        position: fixed;
        top: 0;
        left: 0;
        width: 50%;
        height: 100%;
        display: block;
        background: #716339;
    }

            .joinbar-avatar {
                position: fixed;
                top: 50%;
                left: 0%;
                transform: translate(30%, -50%);
                width: 70px;
                height: 70px;
                border-radius: 50%;
            }

            .joinbar-name {
                position: fixed;
                top: 33%;
                left: 50%;
                transform: translate(-50%, -50%);
                font: 26px Helvetica;
                color: rgba(255, 255, 255, 0.8);
            }

            .joinbar-apply {
                position: fixed;
                top: 66%;
                left: 50%;
                transform: translate(-50%, -50%);
                font: 20px Helvetica;
                color: rgba(255, 255, 255, 0.8);
            }

            .joinbar-clan {
                color: rgb(130 200 255);
                font: 24px Helvetica;
                font-weight: 600;
            }

            .joinbar-apply-text {
                margin: -3px;
            }

            .joinbar-timeText {
                letter-spacing: 2px;
                font-weight: 550;
            }

            .joinbar-key {
                position: fixed;
                top: 50%;
                right: 1%;
                transform: translate(-50%, -50%);
                width: 36px;
                height: 30px;
                background: #f2f2f0;
                border-radius: 6px;
                display: flex;
                justify-content: center;
                align-items: center;
                font: 24px Helvetica;
                font-weight: 600;
            }
            </style>
`;
document.body.prepend(joinbar);
let joinmenu = document.createElement('div');
joinmenu.id = "joinmenu";
joinmenu.innerHTML = `
<div class="joinmenu-box">
  <div class="joinmenu-box-border"></div>
  <div class="joinmenu-box-top">
    <span class="joinmenu-TJR-text">Team Join Request</span>
    <div id="joinmenu_close" class="joinmenu-close">
      <span class="joinmenu-close-text">в­?</span>
      <span class="joinmenu-close-text">в­?</span>
      <span class="joinmenu-close-text">в­?</span>
      <span class="joinmenu-close-text">в­?</span>
    </div>
  </div>
  <div id="joinmenu_container" class="joinmenu-container">
  </div>
</div>
<style>
  #joinmenu {
    position: fixed;
    z-index: 123456789;
  }

  .joinmenu-box {
    user-select: none;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 800px;
    height: 500px;
    background: #3a404f;
    border-radius: 15px;
  }

  .joinmenu-box-border {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 780px;
    height: 480px;
    background: transparent;
    border-radius: 15px;
    border: 2px solid #fff5;
  }

  .joinmenu-box-top {
    position: fixed;
    top: 2%;
    left: 50%;
    transform: translateX(-50%);
    width: 720px;
    height: 60px;
    background: transparent;
    border-bottom: 2px solid #fff5;
  }

  .joinmenu-TJR-text {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font: 26px Georgia;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #d1bc92;
  }

  .joinmenu-close {
    position: fixed;
    top: 50%;
    right: 0;
    transform: translate(0%, -50%);
    width: 30px;
    height: 30px;
    background: transparent;
    color: #d1bc92;
  }

  .joinmenu-close-text {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    font: 50px Georgia;
    font-weight: 10;
    user-select: none;
    cursor: pointer;
  }

  .joinmenu-close:hover {
    color: #f5e9d2;
  }

  .joinmenu-close-text:nth-of-type(1) {
    transform: rotate(45deg);
  }

  .joinmenu-close-text:nth-of-type(2) {
    transform: rotate(135deg);
  }

  .joinmenu-close-text:nth-of-type(3) {
    transform: rotate(225deg);
  }

  .joinmenu-close-text:nth-of-type(4) {
    transform: rotate(315deg);
  }

  .joinmenu-container {
    position: fixed;
    top: 20%;
    left: 50%;
    transform: translateX(-50%);
    width: 720px;
    height: 360px;
    max-height: 360px;
    overflow-x: hidden;
    overflow-y: auto;
    padding-right: 10px;
  }

  .joinmenu-container::-webkit-scrollbar {
    width: 10px !important;
  }

  .joinmenu-container::-webkit-scrollbar-track {
    opacity: 0 !important;
  }

  .joinmenu-container::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.1) !important;
    border-radius: 4px !important;
  }

  .joinmenu-container::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.5) !important;
  }

  .joinmenu-container::-webkit-scrollbar-thumb:active {
    background-color: rgba(255, 255, 255, 0.9) !important;
  }

  .joinmenu-container::-webkit-scrollbar-corner {
    background-color: rgba(255, 255, 255, 0.1) !important;
  }

  .joinmenu-request {
    position: relative;
    top: 15%;
    left: 50%;
    width: 700px;
    height: 100px;
    border-radius: 5px;
    background: #475165;
    margin-bottom: 20px;
    border: 0;
    transform: translate(-50%, -50%);
  }

  .joinmenu-request:hover {
    border: 2px solid #fff5;
  }

  .joinmenu-request-avatar {
    position: absolute;
    top: 50%;
    left: 0%;
    transform: translate(30%, -50%);
    width: 70px;
    height: 70px;
    border-radius: 50%;
    pointer-events: none;
  }

  .joinmenu-request-text-box {
    position: absolute;
    top: 50%;
    left: 18%;
    transform: translate(0%, -50%);
    color: #ede5d5;
    height: 70px;
    width: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 6px;
  }

  .joinmenu-request-text {
    font: 20px Helvetica;
  }

  .joinmenu-request-clan {
    color: #41e2f0;
  }

  .joinmenu-request-button-box {
    position: absolute;
    top: 50%;
    right: 0;
    transform: translate(0%, -50%);
    font: 20px Georgia;
    color: #ede5d5;
    height: 70px;
    width: 180px;
    display: flex;
    align-items: center;
    justify-content: space-around;
  }

  @font-face {
    font-family: 'Material Icons';
    font-style: normal;
    font-weight: 400;
    src: url(https://fonts.gstatic.com/s/materialicons/v139/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2) format('woff2');
  }

  .joinmenu-request-button {
    font: 40px 'Material Icons';
    height: 50px;
    width: 50px;
    border-radius: 50%;
    background: #444b5b;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: 1000;
    border: 2px solid #fff3;
  }

  .joinmenu-request-button:hover {
    background: #515765;
    border: 2px solid #fff5;
  }

  .joinmenu-request-button.disagree {
    color: #ff6c3e;
  }

  .joinmenu-request-button.agree {
    color: #97eb88;
  }
</style>
`;
document.body.prepend(joinmenu);
joinbar.style.display = 'none';
joinmenu.style.display = 'none';
let joinbarTime = Date.now(), joinbarTimeleft = 10;
let requestlist = 0;

function addRequest(sid, name, clan){
    requestlist++;
    const requestMenu = document.createElement('div');
    requestMenu.className = "joinmenu-request";
    requestMenu.setAttribute('data-sid', sid);
    requestMenu.innerHTML = `
  <img id="joinmenu_avatar" class="joinmenu-request-avatar" src="https://yt3.googleusercontent.com/t9CcBvjTjs5D_sLZjtGkcfaTyiZCrx0nyOf7ekj3Fut9gZD76G00x12TK8Jg4czmBWjXcUtP9yE=s160-c-k-c0x00ffffff-no-rj" alt="User Avatar" />
  <div class="joinmenu-request-text-box">
    <div class="joinmenu-request-text">{${sid}}${name}</div>
    <div class="joinmenu-request-text">
      Request to join
      <span class="joinmenu-request-clan">${clan}</span>
    </div>
  </div>
  <div id="joinmenu_request_button_box" class="joinmenu-request-button-box">
    <div id="joinmenu_request_disagree${sid}" class="joinmenu-request-button disagree">&#xE14C;</div>
    <div id="joinmenu_request_agree${sid}" class="joinmenu-request-button agree">&#xE876;</div>
  </div>
`;
    document.getElementById("joinmenu_container").append(requestMenu);
    document.getElementById("joinmenu_request_disagree" + sid).addEventListener("click", function(e){
        JoinReq(sid, 0, requestMenu);
    });
    document.getElementById("joinmenu_request_agree" + sid).addEventListener("click", function(e){
        JoinReq(sid, 1, requestMenu);
    });
}
function JoinReq(sid, agree, element) {
    requestlist--;
    if(requestlist == 0){
        joinmenu.style.display = 'none';
    }
    element.remove();
    packet(code.join, sid , agree);
}
function setjoinbar(sid, name, clan){
    if(joinmenu.style.display == 'none'){
        joinbar.style.display = 'block';
        joinbarTime = Date.now();
        document.getElementById("joinbar_name").textContent = `{${sid}}${name}`;
        document.getElementById("joinbar_clan").textContent = clan;
    }
}
function joinbarrefreshLoop() {
    if(joinbar.style.display == 'block'){
        joinbarTimeleft = 100 - (Date.now() - joinbarTime) / 100;
        if(joinbarTimeleft > 0){
            document.getElementById("joinbar_timeText").textContent = `(${Math.max(0, ~~(joinbarTimeleft/10))})`;
            document.getElementById("joinbar_time").style.width = `${Math.max(0, joinbarTimeleft)}%`;
        } else {
            joinbar.style.display = 'none';
        }
    }
}
setInterval(()=>{
    joinbarrefreshLoop()
},20);
document.getElementById("joinmenu_close").addEventListener("click", function(e){
    joinmenu.style.display = 'none';
});
joinbar.addEventListener("click", function(e){
    joinmenu.style.display = 'block';
    joinbar.style.display = 'none';
});
window.addEventListener("keydown", function(e){
    if(keysActive()){
        if(e.keyCode == 89){
            if(joinmenu.style.display != 'block'){
                joinmenu.style.display = 'block';
                joinbar.style.display = 'none';
            }else {
                joinmenu.style.display = 'none';
            }
        } else if(e.keyCode == 9){
            e.preventDefault();
            if(musicmenu.style.display == 'block'){
                musicmenu.style.display = 'none';
            } else {
                musicmenu.style.display = 'block';
            }
        } else if (e.keyCode == 192) {
            if (document.getElementById("mainMenu").style.display == "block") {
                document.getElementById("mainMenu").style.display = "none";
            } else {
                document.getElementById("mainMenu").style.display = "block";
            }
        } else if(e.keyCode == 27){
            if(joinmenu.style.display == 'block'){
                joinmenu.style.display = 'none';
                joinbar.style.display = 'none';
            } else {
                if(menu.style.opacity != 1){
                    menu.style.display = 'flex';
                    setTimeout(()=>{
                        menu.style.opacity = 1;
                    },10);
                }else {
                    menu.style.opacity = 0;
                    setTimeout(()=>{
                        if(menu.style.opacity != 1){
                            menu.style.display = 'none';
                        }
                    },200);
                }
            }
        }
    }
});
function allianceNotification(sid, name) {
    name = (name != "" ? name : "unknown");

    if(!PlayerName[sid]){
        addMenuChText("Game", `Found {${sid}}${name}`, "yellow");
    } else if(PlayerName[sid] != name){
        addMenuChText("Game", `Change {${sid}}${PlayerName[sid]} to {${sid}}${name}`, "yellow");
    }
    PlayerName[sid] = name;

    allianceNotifications.push({
        sid: sid,
        name: name,
    });
    updateNotifications();
    noticationDisplay.style.display = "none";

    let wl = getEl("whitelist").value.split('\n').filter(item => item.trim() !== "");
    let bl = getEl("blacklist").value.split('\n').filter(item => item.trim() !== "");
    if(getEl("autoagree").checked && getEl("Blacklist").checked && bl.length > 0 && bl.some(blackName => name.includes(blackName.trim()))) {
        packet(code.join, sid, 0);
        if(getEl("BlacklistChat").checked){
            textChat(getEl("blacklistchat").value, { "{player}": name, "{team}": player.team, "{sid}": sid, "{me}": PlayerName[player.sid] });
        }
    } else if(getEl("autoagree").checked && getEl("Whitelist").checked && wl.length > 0 && wl.some(whiteName =>name.includes(whiteName.trim()))) {
        packet(code.join, sid, 1);
        if(getEl("WhitelistChat").checked){
            textChat(getEl("whitelistchat").value, { "{player}": name, "{team}": player.team, "{sid}": sid, "{me}": PlayerName[player.sid] });
        }
    } else if(getEl("autoagree").checked && !getEl("Whitelist").checked){
        packet(code.join, sid, 1);
        if(getEl("WhitelistChat").checked){
            textChat(getEl("whitelistchat").value, { "{player}": name, "{team}": player.team, "{sid}": sid, "{me}": PlayerName[player.sid] });
        }
    } else {
        addRequest(sid, name, player.team)
        setjoinbar(sid, name, player.team)
    }
}let kicklist = [];
function updateNotifications() {
    if (allianceNotifications[0]) {
        var tmpN = allianceNotifications[0];
        UTILS.removeAllChildren(noticationDisplay);
        noticationDisplay.style.display = "none";
        /*     if (getEl("autoagree").checked && !kicklist.includes(tmpN.sid)) {
                        aJoinReq(1);
                        addMenuChText("Game", tmpN.name + " joined [" + player.team + "]", "yellow");
                    }
                    if (getEl("autodisagree").checked) {
                        aJoinReq(0);
                    }*/
        UTILS.generateElement({
            class: "notificationText",
            text: "[" + tmpN.sid + "] " + tmpN.name,
            parent: noticationDisplay,
        });
        UTILS.generateElement({
            class: "notifButton",
            html: "<i class='material-icons' style='font-size:28px;color:#cc5151;'>&#xE14C;</i>",
            parent: noticationDisplay,
            onclick: function() {
                aJoinReq(0);
            },
            hookTouch: true,
        });
        UTILS.generateElement({
            class: "notifButton",
            html: "<i class='material-icons' style='font-size:28px;color:#8ecc51;'>&#xE876;</i>",
            parent: noticationDisplay,
            onclick: function() {
                aJoinReq(1);
            },
            hookTouch: true,
        });
    } else {
        noticationDisplay.style.display = "none";
    }
}

function addAlliance(data) {
    alliances.push(data);
    if (allianceMenu.style.display == "block"){
        showAllianceMenu();
    }
}

function setPlayerTeam(team, isOwner) {
    if (player) {
        player.team = team;
        player.isOwner = isOwner;
        if (team == null){
            alliancePlayers = [];
        }
        if (allianceMenu.style.display == "block"){
            showAllianceMenu();
        }
    }
}

function setAlliancePlayers(data) {
    alliancePlayers = data;
    if (allianceMenu.style.display == "block"){
        showAllianceMenu();
    }
}

function deleteAlliance(sid) {
    for (var i = alliances.length - 1; i >= 0; i--) {
        if (alliances[i].sid == sid){
            alliances.splice(i, 1);
        }
    }
    if (allianceMenu.style.display == "block"){
        showAllianceMenu();
    }
    allianceNotifications = [];
    updateNotifications();
}

function toggleAllianceMenu() {
    if (allianceMenu.style.display != "block") {
        showAllianceMenu();
    } else {
        allianceMenu.style.display = "none";
    }
}
function closeChat() {
    chatBox.value = "";
    chatHolder.style.display = "none";
}

function showAllianceMenu() {
    if (player && player.alive) {
        closeChat();
        storeMenu.style.display = "none";
        allianceMenu.style.display = "block";
        UTILS.removeAllChildren(allianceHolder);
        if (player.team) {
            for (var i = 0; i < alliancePlayers.length; i += 2) {
                (function(i) {
                    var tmp = UTILS.generateElement({
                        class: "allianceItem",
                        style: "color:" + (alliancePlayers[i] == player.sid ? "#fff" : "rgba(255,255,255,0.6)"),
                        text: "[" + alliancePlayers[i] + "] " + alliancePlayers[i + 1],
                        parent: allianceHolder,
                    });
                    if (player.isOwner && alliancePlayers[i] != player.sid) {
                        UTILS.generateElement({
                            class: "joinAlBtn",
                            text: "Kick",
                            onclick: function() {
                                kickFromClan(alliancePlayers[i]);
                            },
                            hookTouch: true,
                            parent: tmp,
                        });
                    }
                }
                )(i);
            }
        } else {
            if (alliances.length) {
                for (var i = 0; i < alliances.length; ++i) {
                    (function(i) {
                        var tmp = UTILS.generateElement({
                            class: "allianceItem",
                            style: "color:" + (alliances[i].sid == player.team ? "#fff" : "rgba(255,255,255,0.6)"),
                            text: alliances[i].sid,
                            parent: allianceHolder,
                        });
                        UTILS.generateElement({
                            class: "joinAlBtn",
                            text: "Join",
                            onclick: function() {
                                sendJoin(i);
                            },
                            hookTouch: true,
                            parent: tmp,
                        });
                    }
                    )(i);
                }
            } else {
                UTILS.generateElement({
                    class: "allianceItem",
                    text: "No Tribes Yet",
                    parent: allianceHolder,
                });
            }
        }
        UTILS.removeAllChildren(allianceManager);
        if (player.team) {
            UTILS.generateElement({
                class: "allianceButtonM",
                style: "width: 360px",
                text: player.isOwner ? "Delete Tribe" : "Leave Tribe",
                onclick: function() {
                    leaveAlliance();
                },
                hookTouch: true,
                parent: allianceManager,
            });
        } else {
            UTILS.generateElement({
                tag: "input",
                type: "text",
                id: "allianceInput",
                maxLength: 7,
                placeholder: "unique name",
                ontouchstart: function(ev) {
                    ev.preventDefault();
                    var newValue = prompt("unique name", ev.currentTarget.value);
                    ev.currentTarget.value = newValue.slice(0, 7);
                },
                parent: allianceManager,
            });
            UTILS.generateElement({
                tag: "div",
                class: "allianceButtonM",
                style: "width: 140px;",
                text: "Create!",
                onclick: function() {
                    createAlliance();
                },
                hookTouch: true,
                parent: allianceManager,
            });
        }
    }
}

function aJoinReq(sid, join) {
    packet(code.join, allianceNotifications[0].sid, join);
    allianceNotifications.splice(0, 1);
    updateNotifications();
}
function kickFromClan(sid) {
    packet(code.kick, sid);
    kicklist.push(sid);
}
function sendJoin(index) {
    packet(code.joinclan, alliances[index].sid);
}
function createAlliance() {
    packet(code.creatclan, getEl("allianceInput").value);
}
function leaveAlliance() {
    allianceNotifications = [];
    alliancePlayers = [];
    updateNotifications();
    if (allianceMenu.style.display == "block"){
        showAllianceMenu();
    }
    packet(code.removeclan);
}

// STORE MENU:
let UseBullTime = Date.now();
function updateStoreItems(type, id, index) {
    if (index) {
        if (!type){
            player.tails[id] = 1;
        } else {
            player.latestTail = id;
        }
    } else {
        if (!type){
            player.skins[id] = 1;
            id == 7 && (my.reSync = true); // testing perfect bulltick...
        } else {
            player.latestSkin = id;
            if(id == 7){
                UseBullTime = Date.now();
            }
        }
    }
}

function AIReply(message, name, time, server) {
    if(getEl("AIreply").checked){
        // GM_getValue / GM_setValue are undefined under "@grant none", so
        // these two lines threw every time an AI reply was attempted.
        let chatalist = [];
        try { chatalist = JSON.parse(localStorage.getItem("sakuna_chatalist") || "[]"); } catch (e) {}
        // е°‡з•¶е‰ЌзЋ©е®¶ж¶€жЃЇеЉ е…ҐиЁйЊ?(жЋ’й™¤з©єж¶€жЃ?)
        if (message.trim() !== "") {
            const newEntry = { name, chat: message.slice(0, 30), time, server };
            try { localStorage.setItem("sakuna_chatalist", JSON.stringify([...chatalist, newEntry].slice(-500))); } catch (e) {}
            chatalist.push(newEntry);
        }
        // жє–е‚™з•¶е‰Ќж¶€жЃЇзљ„и©ћеє?
        const messageWords = message.toLowerCase().split(/\s+/);
        // е»єз«‹е›ћи¦†еЂ™йЃёе€—иЎЁ
        let replylist = [];

        chatalist
            .sort((a, b) => b.time - a.time) // ж™‚й–“еЂ’еєЏжЋ’е€—
            .forEach((entry, i) => {
            const Words = entry.chat.toLowerCase().split(/\s+/).filter(w => w);
            if(messageWords.some(word => Words.includes(word))){
                for(let a = 1; a < 4;a++){
                    let chat = chatalist[i + a];
                    if(chat.time - entry.time < 3e4 && chat.name !== entry.name && chat.server === entry.server){
                        replylist.push(chat.chat);
                    }
                }
            }
        });
        let replyCandidates = [];

        if(replylist.length){
            replylist.forEach((entry, i) => {
                let list = {
                    chat: entry,
                    count: 0,
                }
                const Words = entry.toLowerCase().split(/\s+/).filter(w => w);
                replylist.forEach((ww, j) => {
                    const www = ww.toLowerCase().split(/\s+/).filter(w => w);
                    if(Words.some(word => www.includes(word)) && i !=j){
                        list.count++;
                    }
                });
                replyCandidates.push(list);
            });
            if(replyCandidates.length){
                replyCandidates = replyCandidates.sort((a, b) => b.count - a.count);
                replyCandidates = replyCandidates.filter(w => w.count >= replyCandidates[0].count);
                const reply = replyCandidates[Random(0, replyCandidates.length -1)].chat;
                console.log(reply);
                return reply;
            }
        }
        return "No reply yet";
    }
    return false;
}
// з®Ђж“ж–‡жњ¬з›ёдјјеє¦и®Ўз®—е‡Ѕж•°
function calculateSimilarity(str1, str2) {
    const words1 = new Set(str1.toLowerCase().split(/\W+/));
    const words2 = new Set(str2.toLowerCase().split(/\W+/));
    const intersection = [...words1].filter(x => words2.has(x)).length;
    const union = new Set([...words1, ...words2]).size;
    return union === 0 ? 0 : intersection / union;
}



let replyChat = "";
// SEND MESSAGE:
function receiveChat(sid, message) {
    let tmpPlayer = findPlayerBySID(sid);
    if (tmpPlayer) {
        if (getEl("togglePlayerSync").checked) {
            let syncr = findPlayerBySID(parseInt(getEl("syncsid").value));
            if(tmpPlayer === syncr){
                packet(code.chat, message);
            }
        }else if(getEl("AutoReply").checked && tmpPlayer != player && replyChat != message){
            let reply = getEl("autoreply").value.split('\n');
            let modRegex = new RegExp('mod', 'i');
            for (let i = 0; i < reply.length; i++) {
                let replys = reply[i].split(`, `);
                if (replys[0] && replys[1]) {
                    let regex = new RegExp(replys[0], 'i');

                    if (regex.test(message)) {
                        replyChat = message;
                        sendChat(replys[1]);
                    }
                }
            }
        }

        addMenuChText(`{${tmpPlayer.sid}}${tmpPlayer.name}`, message, "white");

        if (config.anotherVisual) {
            allChats.push(new addCh(tmpPlayer.x2, tmpPlayer.y2, message, tmpPlayer));
        } else {
            tmpPlayer.chatMessage = message
            tmpPlayer.chatCountdown = config.chatCountdown;
        }
    } else {
        addMenuChText(`${"Anonymous"} {null}`, message, "white");
    }
};

// MINIMAP:
function updateMinimap(data) {
    minimapData = data;
}
let healshowtext = {
    x: 0,
    y: 0,
    value: 0,
    time: 0
};

// SHOW ANIM TEXT:
function showText(x, y, value, type) {
    const timeDiff = Math.abs(Date.now() - healshowtext.time);
    const xDiff = Math.abs(healshowtext.x - x);
    const yDiff = Math.abs(healshowtext.y - y);
    const valueDiff = Math.abs(healshowtext.value - value);
    if (timeDiff > 1 && xDiff > 1 && yDiff > 1 && valueDiff > 1) {
        ShowText(x, y, value, type);
    }
}
let stack = {};
let damages = {};

function ShowText(x, y, value, type) {
    let abs = Math.abs(value);

    new Promise((resolve, reject) => {
        resolve({
            text: abs,
            index: value >= 0 ? "dmg" : "heal"
        });
    }).then((e) => {
        const key = `${x},${y}`;

        if (!stack[key]) {
            stack[key] = { dmg: 0, heal: 0 };
        }
        if (!damages[key]) {
            damages[key] = { dmg: 0, heal: 0 };
        }

        stack[key][e.index] += e.text;

        setTimeout(() => {
            if (stack[key].dmg > 0) {
                damages[key].dmg = stack[key].dmg;
                textManager.showText(x, y, 50, 0.18, 500, (type < 0 ? "-" : "") + stack[key].dmg, "#fff");
                stack[key].dmg = 0;
            }
            if (stack[key].heal > 0) {
                damages[key].heal = stack[key].heal;
                textManager.showText(x, y, 50, 0.18, 500, (type < 0 ? "-" : "") + stack[key].heal, type === -1 ? "#ee5551" : "#8ecc51");
                stack[key].heal = 0;
            }
        }, 10);
    });
}

/** APPLY SOCKET CODES */

// BOT:
let bots = [];
let ranLocation = {
    x: UTILS.randInt(35, 14365),
    y: UTILS.randInt(35, 14365)
};


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
        tmpOuter = outer + 1;
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

        /*mainContext.font = "20px Ubuntu";
    let tmpSize = mainContext.measureText("RIP Why Die");
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
    mainContext.strokeText("RIP Why Die", dead.x - xOffset, dead.y + (dead.scale * 1.5) - yOffset);
    mainContext.fillText("RIP Why Die", dead.x - xOffset, dead.y + (dead.scale * 1.5) - yOffset);
    mainContext.strokeText(dead.name, dead.x - xOffset, dead.y + (dead.scale * 1.5) + 20 - yOffset);
    mainContext.fillText(dead.name, dead.x - xOffset, dead.y + (dead.scale * 1.5) + 20 - yOffset);*/

        // same color in bundle
        mainContext.fillStyle = "#91b2db";

    });
}

// RENDER PLAYERS:
function renderPlayers(xOffset, yOffset, zIndex) {
    mainContext.globalAlpha = 1;
    mainContext.fillStyle = "#91b2db";
    for (var i = 0; i < players.length; ++i) {
        tmpObj = players[i];
        if (tmpObj.zIndex == zIndex) {
            if (tmpObj.visible) {
                tmpObj.animate(delta);
                tmpObj.skinRot += (0.002 * delta);
                tmpDir = (tmpObj.dir || 0);
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
    let oHandAngle = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndS || 1) : 1;
    let oHandDist = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndD || 1) : 1;

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

    ctxt.fillText("", 20, 5);

    ctxt.rotate(Math.PI / 2);
    ctxt.font = "30px Hammersmith One";
    ctxt.fillText("", -15, 15 / 2);
    ctxt.fillText("", 15, 15 / 2);

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
        renderTail(obj.tailIndex, ctxt, obj);
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
        ctxt.drawImage(tmpSkin, -tmpObj.scale / 2, -tmpObj.scale / 2, tmpObj.scale, tmpObj.scale);
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
        if (tmpObj.spin)
            ctxt.rotate(owner.skinRot);
        ctxt.drawImage(tmpSkin, -(tmpObj.scale / 2), -(tmpObj.scale / 2), tmpObj.scale, tmpObj.scale);
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
        }
        tmpSprite.src = "https://moomoo.io/img/weapons/" + tmpSrc + ".png";
        toolSprites[tmpSrc] = tmpSprite;
    }
    if (tmpSprite.isLoaded){
        ctxt.drawImage(tmpSprite, x + obj.xOff - (obj.length / 2), y + obj.yOff - (obj.width / 2), obj.length, obj.width);
    }
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
let projectileSprites = {};
function renderProjectile(x, y, obj, ctxt, debug) {
    if (obj.src) {
        obj.scale = 200;
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

// RENDER GAME OBJECTS:
let gameObjectSprites = {}, gameObjectSpritesdata = {},gameObjectSpritesColors = {}, lastgameObjectSpritesColors = {};
function getResSprite(obj) {
    let biomeID = (obj.y >= config.mapScale - config.snowBiomeTop) ? 2 : ((obj.y <= config.snowBiomeTop) ? 1 : 0);
    let tmpIndex = (obj.type + "_" + obj.scale + "_" + biomeID);
    let tmpSprite = gameObjectSprites[tmpIndex];
    if(!gameObjectSpritesdata[tmpIndex]){
        gameObjectSpritesdata[tmpIndex] = {
            rotate: UTILS.randFloat(0, Math.PI),
            tmpCount: UTILS.randInt(5, 7),
            tmpRange: UTILS.randInt(tmpObj.scale / 3.5, tmpObj.scale / 2.3),
            tmpRange2: UTILS.randInt(10, 12)
        };
    }
    let data = gameObjectSpritesdata[tmpIndex];
    /*    try{lastgameObjectSpritesColors[tmpIndex] = gameObjectSpritesColors[tmpIndex];}catch(e){}
    try{gameObjectSpritesColors[tmpIndex] = obj.strokeStyle;}catch(e){}
    let changeColor = false;
    try{if(gameObjectSpritesColors[tmpIndex] != lastgameObjectSpritesColors[tmpIndex])changeColor=true;}catch(e){}*/
    if (!tmpSprite/* || changeColor*/) {
        let blurScale = 15;
        let tmpCanvas = document.createElement("canvas");
        tmpCanvas.width = tmpCanvas.height = (obj.scale * 2.1) + outlineWidth;
        let tmpContext = tmpCanvas.getContext('2d');
        tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
        tmpContext.rotate(data.rotate);
        tmpContext.strokeStyle = obj.strokeStyle;
        tmpContext.lineWidth = outlineWidth;
        if (obj.type == 0) {
            let tmpScale;
            let tmpCount = data.tmpCount;
            tmpContext.globalAlpha = isNight ? 0.6 : 0.8;
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

                tmpContext.shadowBlur = null;
                tmpContext.shadowColor = null;

                tmpContext.fillStyle = "#89a54c";
                renderCircle(0, 0, obj.scale * 0.55, tmpContext);
                tmpContext.fillStyle = "#a5c65b";
                renderCircle(0, 0, obj.scale * 0.3, tmpContext, true);
            } else {
                renderBlob(tmpContext, 6, tmpObj.scale, tmpObj.scale * 0.7);
                tmpContext.fillStyle = biomeID ? "#e3f1f4" : "#89a54c";
                tmpContext.fill();
                tmpContext.stroke();

                tmpContext.shadowBlur = null;
                tmpContext.shadowColor = null;

                tmpContext.fillStyle = biomeID ? "#6a64af" : "#c15555";
                let tmpRange;
                let berries = 4;
                let rotVal = (Math.PI * 2) / berries;
                for (let i = 0; i < berries; ++i) {
                    tmpRange = data.tmpRange;
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                                 data.tmpRange2, tmpContext);
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
        } else {
            tmpContext.fillStyle = "#a5c65b";
            renderCircle(0, 0, obj.scale, tmpContext, true);

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
    const cacheKey = `${id}_${asIcon ? 1 : 0}_${colorKey}`; // еЊ…еђ«йўњи‰Іе’Ње›ѕж ‡зЉ¶жЂЃзљ„зј“е­й”?

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
        if (!asIcon){
            itemSprites[cacheKey] = tmpSprite;
            itemSpritesColors[cacheKey] = colorKey;
        }
    }
    return tmpSprite;
}
let objSprites = {}, objSpritesColors = {}, lastobjSpritesColors = {};
function getObjSprite(obj) {
    let tmpIndex = `${obj.id}`;
    let tmpSprite = itemSprites[tmpIndex];
    try{lastobjSpritesColors[tmpIndex] = objSpritesColors[tmpIndex];}catch(e){}
    try{objSpritesColors[tmpIndex] = obj.strokeStyle;}catch(e){}
    let changeColor = false;
    try{if(objSpritesColors[tmpIndex] != lastobjSpritesColors[tmpIndex])changeColor=true;}catch(e){}

    if (!tmpSprite || changeColor) {
        let blurScale = isNight ? 15 : 0;
        let tmpCanvas = document.createElement("canvas");
        tmpCanvas.width = tmpCanvas.height = obj.scale * 2.5 + outlineWidth + (items.list[obj.id].spritePadding || 0) + blurScale;
        let tmpContext = tmpCanvas.getContext("2d");
        tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
        tmpContext.rotate(Math.PI / 2);
        tmpContext.strokeStyle = obj.strokeStyle;
        tmpContext.lineWidth = outlineWidth;
        if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" || obj.name == "spinning spikes") {
            tmpContext.fillStyle = !0 ? "transparent" : obj.name == "poison spikes" ? "#7b935d" : "#939393";
            let tmpScale = obj.scale * 0.6;
            renderStar(tmpContext, obj.name == "spikes" ? 5 : 6, obj.scale, tmpScale);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = !0 ? "transparent" : "#a5974c";
            renderCircle(0, 0, tmpScale, tmpContext);
            tmpContext.fillStyle = "#cc5151";
            renderCircle(0, 0, tmpScale / 2, tmpContext, true);
        } else if (obj.name == "pit trap") {
            tmpContext.fillStyle = !0 ? "transparent" : "#a5974c";
            renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#cc5151";
            renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
            tmpContext.fill();
        }
        tmpSprite = tmpCanvas;
        objSprites[tmpIndex] = tmpSprite;
    }
    return tmpSprite;
}


// GET MARK SPRITE:
function getMarkSprite(obj, tmpContext, tmpX, tmpY, xOffset, yOffset, outlineColor = "#ff5733") {
    tmpContext.lineWidth = outlineWidth;
    tmpContext.globalAlpha = 0.5;
    tmpContext.fillStyle = "#ff5733"; // Fill color
    tmpContext.strokeStyle = outlineColor; // Outline color
    tmpContext.save();
    tmpContext.translate(tmpX, tmpY);
    tmpContext.rotate(obj.dir);

    // Replace existing conditions with code to draw filled circles
    if (
        obj.name == "wood wall" || obj.name == "stone wall" || obj.name == "castle wall" ||
        obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" || obj.name == "spinning spikes" ||
        obj.name == "mine" || obj.name == "sapling" || obj.name == "pit trap" || obj.name == "boost pad" ||
        obj.name == "turret" || obj.name == "platform" || obj.name == "healing pad" || obj.name == "spawn pad" ||
        obj.name == "blocker" || obj.name == "teleporter"
    ) {
        // Draw a filled circle with obj.scale as the radius
        tmpContext.beginPath();
        tmpContext.arc(0, 0, obj.scale, 0, 2 * Math.PI);
        tmpContext.fill();
        tmpContext.stroke(); // Draw the outline
    } else if (
        obj.name == "windmill" || obj.name == "faster windmill" || obj.name == "power mill"
    ) {
        // Draw a filled circle with a larger radius
        tmpContext.beginPath();
        tmpContext.arc(0, 0, obj.scale * 1.1, 0, 2 * Math.PI);
        tmpContext.fill();
        tmpContext.stroke(); // Draw the outline
    }

    // Add code to draw a filled circle using a custom function (e.g., renderCircle)
    renderCircle(tmpObj.x - xOffset, tmpObj.y - yOffset, tmpObj.getScale(0.6, true), mainContext, false, true);

    tmpContext.restore();
}


let invYAW_1 = {"0":-1.29774e+308,"1":-1.40154e+308,"2":-1.21039e+308,"3":-1.11012e+308,"4":-1.4526e+308,"5":-1.4127e+308,"6":-1.33884e+308,"7":-1.32535e+308,"8":-1.22508e+308,"9":-1.2421e+308,"10":-1.13773e+308,"11":-1.4538e+308,"12":-1.20573e+308,"13":-1.15828e+308,"14":-1.11838e+308,"15":-1.2832e+308,"16":-1.2433e+308,"17":-1.16944e+308,"18":-1.12954e+308,"19":-1.40755e+308,"20":-1.15948e+308,"21":-1.3243e+308,"22":-1.2844e+308,"23":-1.2445e+308,"24":-1.17064e+308,"25":-1.27444e+308,"26":-1.1138e+308,"27":-1.19119e+308,"28":-1.3255e+308,"29":-1.2856e+308,"30":-1.23815e+308,"31":-1.19825e+308,"32":-1.1549e+308,"33":-1.115e+308,"34":-1.2188e+308,"35":-1.3226e+308,"36":-1.10504e+308,"37":-1.23935e+308,"38":-1.34315e+308,"39":-1.1561e+308,"40":-1.1162e+308,"41":-1.3637e+308,"42":-1.14614e+308,"43":-1.10624e+308,"44":-1.26696e+308,"45":-1.7871e+308,"46":-1.18371e+308,"47":-1.2611e+308,"48":-1.27812e+308,"49":-1.14734e+308,"50":-1.7244e+308,"51":-1.26816e+308,"52":-1.1943e+308,"53":-1.18491e+308,"54":-1.2623e+308,"55":-1.21485e+308,"56":-1.17495e+308,"57":-1.30926e+308,"58":-1.29987e+308,"59":-1.22601e+308,"60":-1.18611e+308,"61":-1.6987e+308,"62":-1.21605e+308,"63":-1.23307e+308,"64":-1.1328e+308,"65":-1.11931e+308,"66":-1.22721e+308,"67":-1.33101e+308,"68":-1.6999e+308,"69":-1.66e+308,"70":-1.58614e+308,"71":-1.134e+308,"72":-1.15102e+308,"73":-1.25482e+308,"74":-1.741e+308,"75":-1.7011e+308,"76":-1.13167e+308,"77":-1.20151e+308,"78":-1.16161e+308,"79":-1.29592e+308,"80":-1.39972e+308,"81":-1.7422e+308,"82":-1.17277e+308,"83":-1.12532e+308,"84":-1.20271e+308,"85":-1.5716e+308,"86":-1.5317e+308,"87":-1.6355e+308,"88":-1.20977e+308,"89":-1.20038e+308,"90":-1.12652e+308,"91":-1.23032e+308,"92":-1.5728e+308,"93":-1.6766e+308,"94":-1.25087e+308,"95":-1.24148e+308,"96":-1.16762e+308,"97":-1.12772e+308,"98":-1.23152e+308,"99":-1.574e+308,"100":-1.6778e+308,"101":-1.28258e+308,"102":-1.24268e+308,"103":-1.4034e+308,"104":-1.5072e+308,"105":-1.6151e+308,"106":-1.18937e+308,"107":-1.20639e+308,"108":-1.10202e+308,"109":-1.27029e+308,"110":-1.4046e+308,"111":-1.5084e+308,"112":-1.11318e+308,"113":-1.21698e+308,"114":-1.14312e+308,"115":-1.10322e+308,"116":-1.4457e+308,"117":-1.5495e+308,"118":-1.5096e+308,"119":-1.11438e+308,"120":-1.21818e+308,"121":-1.3789e+308,"122":-1.339e+308,"123":-1.23873e+308,"124":-1.5507e+308,"125":-1.15548e+308,"126":-1.14199e+308,"127":-1.42e+308,"128":-1.3801e+308,"129":-1.488e+308,"130":-1.26634e+308,"131":-1.25695e+308,"132":-1.15668e+308,"133":-1.14319e+308,"134":-1.4212e+308,"135":-1.3813e+308,"136":-1.30744e+308,"137":-1.29805e+308,"138":-1.22419e+308,"139":-1.18429e+308,"140":-1.28809e+308,"141":-1.4224e+308,"142":-1.20484e+308,"143":-1.13098e+308,"144":-1.11749e+308,"145":-1.2518e+308,"146":-1.2119e+308,"147":-1.13804e+308,"148":-1.12865e+308,"149":-1.26296e+308,"150":-1.15859e+308,"151":-1.11869e+308,"152":-1.253e+308,"153":-1.24361e+308,"154":-1.13924e+308,"155":-1.12985e+308,"156":-1.19969e+308,"157":-1.15979e+308,"158":-1.2941e+308,"159":-1.2542e+308,"160":-1.18034e+308,"161":-1.17095e+308,"162":-1.27475e+308,"163":-1.40906e+308,"164":-1.1915e+308,"165":-1.2953e+308,"166":-1.10415e+308,"167":-1.21205e+308,"168":-1.7586e+308,"169":-1.1247e+308,"170":-1.11531e+308,"171":-1.21911e+308,"172":-1.32291e+308,"173":-1.10535e+308,"174":-1.21325e+308,"175":-1.7598e+308,"176":-1.1259e+308,"177":-1.43787e+308,"178":-1.36401e+308,"179":-1.14645e+308,"180":-1.380253e+308,"181":-1.24086e+308,"182":-1.34466e+308,"183":-1.15351e+308,"184":-1.26141e+308,"185":-1.6303e+308,"186":-1.7341e+308,"187":-1.28196e+308,"188":-1.26847e+308,"189":-1.1682e+308,"190":-1.18522e+308,"191":-1.26261e+308,"192":-1.6315e+308,"193":-1.5916e+308,"194":-1.30957e+308,"195":-1.30018e+308,"196":-1.22632e+308,"197":-1.18642e+308,"198":-1.6726e+308,"199":-1.6327e+308,"200":-1.7365e+308,"201":-1.1026e+308,"202":-1.23691e+308,"203":-1.22752e+308,"204":-1.5659e+308,"205":-1.6738e+308,"206":-1.7776e+308,"207":-1.58645e+308,"208":-1.13431e+308,"209":-1.5032e+308,"210":-1.607e+308,"211":-1.5671e+308,"212":-1.17188e+308,"213":-1.24927e+308,"214":-1.20182e+308,"215":-1.13551e+308,"216":-1.5044e+308,"217":-1.6082e+308,"218":-1.18247e+308,"219":-1.31678e+308,"220":-1.12563e+308,"221":-1.4376e+308,"222":-1.16312e+308,"223":-1.6493e+308,"224":-1.6094e+308,"225":-1.21008e+308,"226":-1.31798e+308,"227":-1.335e+308,"228":-1.4388e+308,"229":-1.36494e+308,"230":-1.12097e+308,"231":-1.25118e+308,"232":-1.24179e+308,"233":-1.20189e+308,"234":-1.4799e+308,"235":-1.44e+308,"236":-1.36614e+308,"237":-1.11807e+308,"238":-1.28289e+308,"239":-1.17852e+308,"240":-1.521e+308,"241":-1.4811e+308,"242":-1.28995e+308,"243":-1.15917e+308,"244":-1.14978e+308,"245":-1.3105e+308,"246":-1.4143e+308,"247":-1.19674e+308,"248":-1.27413e+308,"249":-1.11349e+308,"250":-1.19088e+308,"251":-1.2079e+308,"252":-1.3117e+308,"253":-1.4155e+308,"254":-1.19794e+308,"255":-1.30584e+308,"256":-1.11469e+308,"257":-1.21849e+308,"258":-1.3528e+308,"259":-1.3129e+308,"260":-1.23904e+308,"261":-1.37335e+308,"262":-1.1822e+308,"263":-1.25959e+308,"264":-1.2461e+308,"265":-1.354e+308,"266":-1.4578e+308,"267":-1.26665e+308,"268":-1.37455e+308,"269":-1.1834e+308,"270":-1.1435e+308,"271":-1.10015e+308,"272":-1.17754e+308,"273":-1.30775e+308,"274":-1.29836e+308,"275":-1.25846e+308,"276":-1.1846e+308,"277":-1.2884e+308,"278":-1.21454e+308,"279":-1.17464e+308,"280":-1.13129e+308,"281":-1.1178e+308,"282":-1.2257e+308,"283":-1.3295e+308,"284":-1.13835e+308,"285":-1.689e+308,"286":-1.20635e+308,"287":-1.1589e+308,"288":-1.119e+308,"289":-1.25331e+308,"290":-1.24392e+308,"291":-1.13955e+308,"292":-1.13016e+308,"293":-1.26447e+308,"294":-1.1601e+308,"295":-1.29441e+308,"296":-1.25451e+308,"297":-1.38882e+308,"298":-1.7272e+308,"299":-1.27506e+308,"300":-1.2012e+308,"301":-1.1613e+308,"302":-1.11795e+308,"303":-1.28212e+308,"304":-1.7683e+308,"305":-1.7284e+308,"306":-1.12501e+308,"307":-1.23291e+308,"308":-1.19301e+308,"309":-1.32322e+308,"310":-1.10566e+308,"311":-1.7695e+308,"312":-1.20007e+308,"313":-1.12621e+308,"314":-1.43818e+308,"315":-1.5989e+308,"316":-1.14676e+308,"317":-1.28107e+308,"318":-1.24117e+308,"319":-1.34497e+308,"320":-1.15382e+308,"321":-1.23121e+308,"322":-1.6001e+308,"323":-1.708e+308,"324":-1.28227e+308,"325":-1.26878e+308,"326":-1.19492e+308,"327":-1.15502e+308,"328":-1.4975e+308,"329":-1.21547e+308,"330":-1.7092e+308,"331":-1.10171e+308,"332":-1.26998e+308,"333":-1.19612e+308,"334":-1.5386e+308,"335":-1.6424e+308,"336":-1.21667e+308,"337":-1.14281e+308,"338":-1.10291e+308,"339":-1.62305e+308,"340":-1.5797e+308,"341":-1.5398e+308,"342":-1.11407e+308,"343":-1.21787e+308,"344":-1.35218e+308,"345":-1.3692e+308,"346":-1.473e+308,"347":-1.5809e+308,"348":-1.15517e+308,"349":-1.14168e+308,"350":-1.24958e+308,"351":-1.4103e+308,"352":-1.3704e+308,"353":-1.29654e+308,"354":-1.5821e+308,"355":-1.18278e+308,"356":-1.28658e+308,"357":-1.42089e+308,"358":-1.4115e+308,"359":-1.12947e+308};

let YAW_1 = invYAW_1;

function dir_1(dir) {
    return Math.atan2(Math.sin(dir), Math.cos(dir));
}

function FixInvisibleBuildings(rad) {
    if (rad == 0) return 0;
    var yaw = rad * 0.180 / Math.PI;
    var nonZeroYaw = yaw + 0.180;
    var reversedYaw = nonZeroYaw;
    var shiftedYaw = (0.360 + reversedYaw - 0.180) % 0.360;
    return Math.round(shiftedYaw * 1000) % 360;
};

let renderTime = Date.now();
let gameObjectsColors = {};
let lastgameObjectsColors = {};
const circleRadius = config.healthBarWidth / 2 + config.healthBarPad - 5;
const startAngle = Math.PI;
// RENDER GAME OBJECTS:
function renderGameObjects(layer, xOffset, yOffset) {
    let tmpSprite;
    let tmpX;
    let tmpY;
    for (let i = 0; i < newGameObjects.length; i++) {
        const tmp = newGameObjects[i];
        tmpObj = tmp;
        if (layer == 0) {
            tmpObj.update(delta);
        } else if (layer == 3 && tmpObj.alive) {
            if (tmpObj.health < tmpObj.maxHealth) {
                const remainingHealthPercentage = 1 - tmpObj.health / tmpObj.maxHealth;
                const endAngle = Math.PI + (remainingHealthPercentage * Math.PI * 2);


                mainContext.fillStyle = tmpObj.isTeamObject(player) ? "lightblue" : "#cc5151";
                mainContext.textBaseline = "middle";
                mainContext.textAlign = "center";
                mainContext.lineWidth = 0;
                mainContext.lineJoin = "round";

                mainContext.strokeStyle = "black";
                mainContext.lineWidth = 3;

                mainContext.strokeText(tmpObj.owner.sid, tmpObj.x - xOffset, tmpObj.y - yOffset + 3.5);
                mainContext.fillText(tmpObj.owner.sid, tmpObj.x - xOffset, tmpObj.y - yOffset + 3.5);
                // build health holder
                mainContext.beginPath();
                mainContext.arc(tmpObj.x - xOffset, tmpObj.y - yOffset, circleRadius, startAngle, endAngle, true);
                mainContext.strokeStyle = "black";
                mainContext.lineWidth = 8;
                mainContext.lineCap = 'round';
                mainContext.stroke();
                // build health
                mainContext.beginPath();
                mainContext.arc(tmpObj.x - xOffset, tmpObj.y - yOffset, circleRadius, startAngle, endAngle, true);
                mainContext.strokeStyle = tmpObj.isTeamObject(player) ? "#5f9ea0" : "#cc5151";
                mainContext.lineWidth = 4;
                mainContext.lineCap = 'round';
                mainContext.stroke();
            }
            if (UTILS.getDist(tmpObj, player, 0, 0) <= 720 && tmpObj.doUpdate) {
                // RELOAD HOLDER:
                mainContext.fillStyle = darkOutlineColor;
                mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth / 2 - config.healthBarPad, tmpObj.y - yOffset - config.healthBarPad + 13, config.healthBarWidth + config.healthBarPad * 2, 17, 8);
                mainContext.fill();
                // RELOAD BAR:
                mainContext.fillStyle = "#a5974c";
                mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth / 2, tmpObj.y - yOffset + 13, config.healthBarWidth * ((2200 - tmpObj.shootReload) / 2200), 17 - config.healthBarPad * 2, 7);
                mainContext.fill();
            }
        }
        if (!tmpObj.alive || tmpObj.layer !== layer) continue;
        tmpX = tmpObj.x + tmpObj.xWiggle - xOffset;
        tmpY = tmpObj.y + tmpObj.yWiggle - yOffset;
        mainContext.globalAlpha = 1;
        tmpObj.strokeStyle = tmpObj.isPlayer ? '#ff0' : tmpObj.isEnemy ? "#f00" : outlineColor;
        if (tmpObj.isItem) {
            /*    if ((tmpObj.dmg || tmpObj.trap) && !tmpObj.isTeamObject(player)) {
                        tmpSprite = getObjSprite(tmpObj);
                    } else {*/
            tmpSprite = getItemSprite(tmpObj);
            //}

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
}

function markObject(tmpObj, tmpX, tmpY) {
    getMarkSprite(tmpObj, mainContext, tmpX, tmpY);
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
    mapMarker = {x: player.x2, y:player.y2};
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
        if (GoToRandomXY && ramdonXY) {
            mapContext.fillStyle = "#ff0";
            mapContext.font = "34px Hammersmith One";
            mapContext.textBaseline = "middle";
            mapContext.textAlign = "center";
            mapContext.fillText("x", (ramdonXY.x / config.mapScale) * mapDisplay.width,
                                (ramdonXY.y / config.mapScale) * mapDisplay.height);
        }
        if ((GoToBuild || GoToTeamBuild || GoToAllBuild) && nearobject) {
            mapContext.fillStyle = "#ff0";
            mapContext.font = "34px Hammersmith One";
            mapContext.textBaseline = "middle";
            mapContext.textAlign = "center";
            mapContext.fillText("x", (nearobject.x / config.mapScale) * mapDisplay.width,
                                (nearobject.y / config.mapScale) * mapDisplay.height);
        }
        Object.keys(PLAYERS).forEach(sid => {
            const playerData = PLAYERS[sid];
            if (playerData.sid !== player.sid && window.location.href === playerData.href) {
                mapContext.globalAlpha = 1;
                mapContext.strokeStyle = "#cc5151";
                renderCircle((playerData.x / config.mapScale) * mapDisplay.width,
                             (playerData.y / config.mapScale) * mapDisplay.height, 7, mapContext, false, true);
            }
        });
    }
}

// ICONS:
let crossHairs = ["https://cdn.discordapp.com/attachments/1241762794404319383/1242838549179400282/UKbJ0Ug.webp?ex=664f4b18&is=664df998&hm=0737fbd60a9bade69e1dfb0c2ecc0bd5cca034e0e389b9c6a4f4e5dee84a02db&", "https://cdn.discordapp.com/attachments/1241762794404319383/1242838549179400282/UKbJ0Ug.webp?ex=664f4b18&is=664df998&hm=0737fbd60a9bade69e1dfb0c2ecc0bd5cca034e0e389b9c6a4f4e5dee84a02db&"];
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
    /*
                for (let i = 0; i < crossHairs.length; ++i) {
                    let tmpSprite = new Image();
                    tmpSprite.onload = function () {
                        this.isLoaded = true;
                    };
                    tmpSprite.src = crossHairs[i];
                    crossHairSprites[i] = tmpSprite;
                }
            */
}
loadIcons();

function toRad(angle) {
    return angle / 180 * Math.PI;
}
function toDeg(radians) {
    return radians * 180 / Math.PI;
}
function dist(x, y, x1, y1){
    Math.hypot(x - x1, y - y1);
}
function Random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
let rotate = 0;
let LeftTop = [],
    RightTop = [],
    LeftBottom = [],
    RightBottom = [],
    RightBottom2 = [],
    CHangeTime = Date.now(),
    ChangeSpeed = 500;
for(let i=0;i<16;i++){
    if(!LeftTop[i]) {
        LeftTop[i] = Random(2, 20);
    }
    if(!RightTop[i]) {
        RightTop[i] = Random(2, 20);
    }
    if(!LeftBottom[i]) {
        LeftBottom[i] = Random(2, 20);
    }
    if(!RightBottom[i]) {
        RightBottom[i] = Random(2, 10);
    }
    if(!RightBottom2[i]) {
        RightBottom2[i] = Random(12, 20);
    }
}

const pointer = {
    x: .5 * window.innerWidth,
    y: .5 * window.innerHeight,
    x2: .5 * window.innerWidth,
    y2: .5 * window.innerHeight,
}
const params = {
    pointsNumber: 20,
    widthFactor: .8,
    mouseThreshold: .9,
    spring: .4,
    friction: .5
};

const trail = new Array(params.pointsNumber);
for (let i = 0; i < params.pointsNumber; i++) {
    trail[i] = {
        x: pointer.x,
        y: pointer.y,
        dx: 0,
        dy: 0,
    }
}
const weaponpointer = {
    x: .5 * window.innerWidth,
    y: .5 * window.innerHeight,
    x2: .5 * window.innerWidth,
    y2: .5 * window.innerHeight,
}
const weaponparams = {
    pointsNumber: 20,
    widthFactor: .8,
    mouseThreshold: .9,
    spring: .4,
    friction: .5
};

const weapontrail = new Array(weaponparams.pointsNumber);
for (let i = 0; i < weaponparams.pointsNumber; i++) {
    weapontrail[i] = {
        x: weaponpointer.x,
        y: weaponpointer.y,
        dx: 0,
        dy: 0,
    }
}

const playerpointer = {
    x: .5 * window.innerWidth,
    y: .5 * window.innerHeight,
    x2: .5 * window.innerWidth,
    y2: .5 * window.innerHeight,
}
const playerparams = {
    pointsNumber: 20,
    widthFactor: 3.5,
    mouseThreshold: .9,
    spring: .4,
    friction: .5
};

const playertrail = new Array(playerparams.pointsNumber);
for (let i = 0; i < playerparams.pointsNumber; i++) {
    playertrail[i] = {
        x: playerpointer.x,
        y: playerpointer.y,
        dx: 0,
        dy: 0,
    }
}

let RDTime = Date.now();
const stars = new Array(1000);

function setstars(i){
    stars[i] = {
        x: Random(0, maxScreenWidth),
        y: Random(0, maxScreenHeight),
        d: 0,
        glow: true,
        s: Random(1, 2)/100,
        delay:Random(0, 1e3),
        t: Date.now()
    };

}

for(let i=0;i<stars.length;i++){
    setstars(i);
}

let checkAWT = Date.now();
function autowalk(x, y, range, scale){
    let canWalkList = [];
    let cantWalkList = [];
    let canWalkCount = 0;
    let maxCanWalkCount = 0;
    let bestAngle = null;
    let theBestAngleList = [];
    let theBestAngle = null;
    let marklist = [];
    let havebuild = false;
    newGameObjects.forEach((tmp) => {
        if(tmp.active){
            let dist = Math.hypot(x - tmp.x, y - tmp.y);
            if((dist - tmp.getScale() - scale) <= range){
                cantWalkList.push([tmp.x, tmp.y, tmp.getScale()]);
                havebuild = true;
            }
        }
    });
    for(let i = 0; i < 10; i++){
        for(let j = 0; j < 360; j++){
            let canWalk = true;
            let angle = (j + i*36)%360;
            if(cantWalkList.length > 0){
                for(let a = 0; a < cantWalkList.length; a++){
                    let dist = Math.hypot(x - cantWalkList[a][0], y - cantWalkList[a][1]);
                    if(Math.hypot((x + Math.cos(toRad(angle)) * dist) - cantWalkList[a][0], (y + Math.sin(toRad(angle)) * dist) - cantWalkList[a][1]) < (cantWalkList[a][2] + scale)){
                        canWalk = false;
                    }
                }
            };

            if(canWalk){
                canWalkList.push(angle);
                if(!marklist.includes(angle)){
                    marklist.push(angle)
                }
            } else {
                if(maxCanWalkCount < canWalkList.length){
                    maxCanWalkCount = canWalkList.length;
                    if(canWalkList.length > 0){
                        bestAngle = canWalkList[Math.floor(canWalkList.length/2)] || 0;
                    }
                }
                canWalkCount = 0;
                canWalkList = [];
            }
        }

        theBestAngleList.push(bestAngle);

    }
    let frequencyMap = {};
    let maxCount = 0;

    // з»џи®ЎжЇЏдёЄж•°е­—зљ„е‡єзЋ°йў‘зЋ?
    theBestAngleList.forEach(num => {
        frequencyMap[num] = (frequencyMap[num] || 0) + 1;
        if (frequencyMap[num] > maxCount) {
            maxCount = frequencyMap[num];
            theBestAngle = num;
        }
    });

    return [theBestAngle, marklist, havebuild];
}
let mouseUpdateTime = Date.now();

let ball = {
    count: 5,
    size: 10,
    speed: 1,
    rotate: 0,
    updateTime: Date.now()
}

let tail = new Array(10).fill(0);

let location = {
    x: null,
    y: null,
    x2: 0,
    y2: 0,
}
let
t_ = 0, num = 4000,
    a, __x, __y, _x, _y,
    _t_ = 1 /75;
var color = 360 * Math.random();

function drawPoint(x, y, rotateX, rotateY) {
    let radX = toRad(rotateX);
    let radY = toRad(rotateY);
    let dist = Math.hypot(x, y);
    let angleX = Math.atan2(0, x);
    let angleY = Math.atan2(y, 0);
    let x1 = x * Math.cos(angleX + radY);
    let y1 = y * Math.sin(angleY + radX);
    return {
        x: x1,
        y: y1
    }
}
let isR = Date.now();
let isL = Date.now();
let WRL = {};

/**
 * дЅїз”Ёеўћејєећ‹A*з®—жі•иї›иЎЊи·Їеѕ„и§„е€’пјЊж”ЇжЊЃеЉЁжЂЃйљњзўЌз»•иЎЊе’Њж™єиѓЅз»€з‚№йЂ‚й…Ќ
 * @param {Object} target - з›®ж ‡дЅЌзЅ® {x, y}
 * @param {Object} specialAvoidanceEnemy - йњЂи¦Ѓз‰№е€«и§„йЃїзљ„ж•Њдєє
 * @returns {Array} дјеЊ–еђЋзљ„и·Їеѕ„иЉ‚з‚№ж•°з»„
 */
function findPath(target, emy) {
    try {
        // ================== е€ќе§‹еЊ–й¶ж®? ==================
        // зЋ©е®¶е€ќе§‹дЅЌзЅ®пј€зЅ‘ж јеЇ№йЅђпј‰
        const playerStart = {
            x: Math.round(player.x3),
            y: Math.round(player.y3),
            collisionRadius: player.scale,
            movementSpeed: player.maxSpeed
        };

        // з›®ж ‡дЅЌзЅ®йў„е¤„зђ?
        const originalTarget = {
            x: Math.round(target.x),
            y: Math.round(target.y)
        };

        // и·Їеѕ„и®Ўз®—еџєзЎЂеЏ‚ж•°
        const initialDistance = UTILS.getDist(originalTarget, playerStart, 0, 0);
        const initialHeading = UTILS.getDirect(originalTarget, playerStart, 0, 0);
        const nodeGridSize = 35; // еЅ±е“Ќи·Їеѕ„зІѕеє¦дёЋжЂ§иѓЅ

        // =============== еЉЁжЂЃйљњзўЌз‰©е¤„зђ† ================
        // иЋ·еЏ–ењєж™Їдё­жњ‰ж•€йљњзўЌз‰©пј€еЊ…еђ«йњЂи¦Ѓз‰№ж®Ље¤„зђ†зљ„ж•Њдєєпј?
        const dynamicObstacles = newGameObjects.filter(e =>
                                                       e.active && !e.zIndex && !e.blocker &&
                                                       !e.spawnPoint && !e.healCol && !e.trap
                                                      );
        if(emy){
            let x = emy.x;
            let y = emy.y;
            emy.x = emy.x2;
            emy.y = emy.y2;
            dynamicObstacles.push(emy);
            emy.x = x;
            emy.y = y;
        }
        // ж·»еЉ е…·жњ‰дј¤е®іиѓЅеЉ›зљ„еЉЁз‰©дЅњдёєйљњзў?
        ais.forEach(animal => {
            if (animal.dmg && animal.visible & !animal.inTrap){
                let x = animal.x;
                let y = animal.y;
                animal.x = animal.x2;
                animal.y = animal.y2;
                dynamicObstacles.push(animal);
                animal.x = x;
                animal.y = y;
            }
        });

        // жЈЂжµ‹зЋ©е®¶дёЋз›®ж ‡иїћзєїдёЉзљ„йљњзўЌз‰©пј€з”ЁдєЋз»•иЎЊе†із­–пј?
        const obstaclesInPath = dynamicObstacles.filter(obs => {
            const projectedPoint = {
                x: playerStart.x + Math.cos(initialHeading) * UTILS.getDist(obs, playerStart, 0, 0),
                y: playerStart.y + Math.sin(initialHeading) * UTILS.getDist(obs, playerStart, 0, 0)
            };
            return UTILS.getDist(obs, projectedPoint, 0, 0) < (obs.GS() + playerStart.collisionRadius) &&
                UTILS.getDist(obs, playerStart, 0, 0) < (initialDistance + obs.GS());
        }).sort((a, b) => UTILS.getDist(a, playerStart, 0, 0) - UTILS.getDist(b, playerStart, 0, 0));

        const isEnemyNearSpike = dynamicObstacles.some(tmp =>
                                                       tmp.dmg &&
                                                       tmp.owner &&
                                                       tmp.active &&
                                                       !tmp.isTeamObject(player) &&
                                                       enemy.some(tmpEnemy => UTILS.getDist(tmpEnemy, tmp, 2, 0) < 300)
                                                      );
        if (obstaclesInPath.length > 0 || isEnemyNearSpike) {
            // ============== и·Їеѕ„и§„е€’ж ёеїѓйЂ»иѕ‘ ==============
            let plannedPath = [];

            // е…«ж–№еђ‘з§»еЉЁеђ‘й‡Џпј€ж”ЇжЊЃж–њеђ‘з§»еЉЁпј?
            const searchDirections = [
                { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
                { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
            ];

            // ============== и·Їеѕ„иЉ‚з‚№е®љд№‰ ==============
            class NavigationNode {
                constructor(x, y) {
                    this.x = x; // зЅ‘ж јXеќђж ‡
                    this.y = y; // зЅ‘ж јYеќђж ‡
                    this.actualCost = 0; // иµ·з‚№е€°еЅ“е‰ЌиЉ‚з‚№зљ„е®ћй™…д»Јд»·
                    this.heuristicCost = 0; // еЅ“е‰ЌиЉ‚з‚№е€°з›®ж ‡зљ„йў„дј°д»Јд»·
                    this.totalCost = 0; // жЂ»д»Јд»? (е®ћй™… + йў„дј°)
                    this.parent = null; // е›ћжєЇи·Їеѕ„зљ„з€¶иЉ‚з‚№
                }

                get identifier() {
                    return `${this.x}:${this.y}`;
                }
            }

            const Spikes = dynamicObstacles.filter(tmp => tmp.dmg && tmp.owner && tmp.active && !tmp.isTeamObject(player) && UTILS.getDist(player, tmp, 2, 0) < 250);
            const Enemy = enemy.filter(tmp => UTILS.getDist(player, tmp, 2, 2) < 250);

            // ============== ењ°еЅўеЏЇйЂљиї‡жЂ§жЈЂжµ? ==============
            const isNavigable = (x, y, hidespiketick) => {


                // иѕ№з•Ње®‰е…ЁжЈЂжµ?
                if (x < 0 || x > 14400 || y < 0 || y > 14400) return false;

                // еЉЁжЂЃе®‰е…Ёи·ќз¦»пј€иЂѓи™‘з§»еЉЁйЂџеє¦е’Њзў°ж’ћдЅ“з§Їпј‰
                if(dynamicObstacles.some(obs =>
                                         UTILS.getDist(obs, { x, y }, 0, 0) < (obs.GS() + playerStart.collisionRadius - playerStart.movementSpeed / 1.8)
                                        )){
                    return false;
                }
                /*          const isDangerous = Enemy.some(tmp => Spikes.some(tmpObj => {
                    return UTILS.lineInRect([tmp, {x,y}, tmpObj], 135) &&
                        UTILS.getDist(tmp, tmpObj, 2, 0) < 370 && UTILS.getDist(tmp, tmpObj, 2, 0) > UTILS.getDist(tmp, {x, y}, 2, 0) && UTILS.getDist(tmp, tmpObj, 2, 0) > UTILS.getDist({x, y}, tmpObj, 0, 0);
                })
                                              );

                if (isDangerous){
                    isNavigablelist.push({x, y});
                    return false;
                }*/
                return true;
            };


            // ============== A*з®—жі•е®ћзЋ° ==============
            const openSet = new PriorityQueue();
            const closedSet = new Map();
            let finalDestination = originalTarget;
            let farthestObstacle;
            try{
                farthestObstacle = {
                    x: playerStart.x + Math.cos(initialHeading) * (UTILS.getDist(obstaclesInPath.at(-1), playerStart, 0, 0) + obstaclesInPath.at(-1).GS()),
                    y: playerStart.y + Math.sin(initialHeading) * (UTILS.getDist(obstaclesInPath.at(-1), playerStart, 0, 0) + obstaclesInPath.at(-1).GS())
                };
                if(UTILS.getDist(farthestObstacle, playerStart, 0, 0) < initialDistance){
                    finalDestination = farthestObstacle;
                }
            }catch(e){}
            // и·Їеѕ„иµ·з‚№е¤„зђ†
            const startNode = new NavigationNode(
                Math.round(playerStart.x / nodeGridSize) * nodeGridSize,
                Math.round(playerStart.y / nodeGridSize) * nodeGridSize
            );

            // з»€з‚№е¤„зђ†йЂ»иѕ‘дјеЊ–
            const endNode = new NavigationNode(
                Math.round(finalDestination.x / nodeGridSize) * nodeGridSize,
                Math.round(finalDestination.y / nodeGridSize) * nodeGridSize
            );

            openSet.enqueue(startNode, 0);
            let searchSteps = 0;
            let closestNode = startNode; // и·џиёЄжњЂжЋҐиї‘з»€з‚№зљ„иЉ‚з‚?

            while (!openSet.isEmpty() && searchSteps < getEl("maxIterationCount").value) {
                searchSteps++;
                const currentNode = openSet.dequeue();

                // еЉЁжЂЃж›ґж–°жњЂиї‘иЉ‚з‚?
                if (UTILS.getDist(currentNode, endNode, 0, 0) < UTILS.getDist(closestNode, endNode, 0, 0)) {
                    closestNode = currentNode;
                }

                // е€°иѕѕз»€з‚№зљ„жќЎд»¶ж”ѕе®Ѕпј€е…Ѓи®ёдёЂе®љиЇЇе·®пј‰
                if (UTILS.getDist(currentNode, endNode, 0, 0) <= nodeGridSize*2) {
                    let pathNode = currentNode;
                    while (pathNode) {
                        plannedPath.unshift({ x: pathNode.x, y: pathNode.y });
                        pathNode = pathNode.parent;
                    }
                    break;
                }

                // й‚»еџџиЉ‚з‚№з”џж€ђ
                for (const dir of searchDirections) {
                    const neighborX = currentNode.x + dir.x * nodeGridSize;
                    const neighborY = currentNode.y + dir.y * nodeGridSize;

                    if (!isNavigable(neighborX, neighborY)) continue;

                    const neighborNode = new NavigationNode(neighborX, neighborY);
                    const nodeKey = neighborNode.identifier;

                    if (closedSet.has(nodeKey)) continue;

                    // д»Јд»·и®Ўз®—дјеЊ–пј€иЂѓи™‘ењ°еЅўйЈЋй™©пј?
                    const moveCost = (dir.x && dir.y) ? 1.414 : 1;
                    const tentativeCost = currentNode.actualCost + moveCost;

                    if (!closedSet.has(nodeKey) || tentativeCost < neighborNode.actualCost) {
                        neighborNode.actualCost = tentativeCost;
                        neighborNode.heuristicCost = Math.hypot(
                            (neighborNode.x - endNode.x) / nodeGridSize,
                            (neighborNode.y - endNode.y) / nodeGridSize
                        );
                        neighborNode.totalCost = neighborNode.actualCost + neighborNode.heuristicCost;
                        neighborNode.parent = currentNode;

                        openSet.enqueue(neighborNode, neighborNode.totalCost);
                        closedSet.set(nodeKey, true);
                    }
                }
            }

            let lastPath = null;
            // е¤„зђ†жњЄе€°иѕѕз»€з‚№зљ„жѓ…е†µ
            if (plannedPath.length === 0) {
                cantFindpath = true;
                let fallbackNode = closestNode;
                while (fallbackNode) {
                    lastPath = { x: fallbackNode.x, y: fallbackNode.y };
                    plannedPath.unshift({ x: fallbackNode.x, y: fallbackNode.y });
                    fallbackNode = fallbackNode.parent;
                }
                plannedPath.push(closestNode);
            }

            // ============== и·Їеѕ„еђЋдјеЊ? ==============
            plannedPath.push(originalTarget);

            // и·Їеѕ„еЋ‹зј©пј€з§»й™¤е†—дЅ™иЉ‚з‚№пј‰
            plannedPath = plannedPath.filter(point =>
                                             UTILS.getDist(point, player, 0, 0) > Math.max(playerStart.collisionRadius, playerStart.movementSpeed) ||
                                             point === playerStart || point === originalTarget
                                            );
            // ============== иµ·з‚№еЏЇйЂљиЎЊжЂ§жЈЂжџ? ==============
            let newStartNode = null;
            if (!isNavigable(startNode.x, startNode.y)) {
                const baseGridX = Math.round(startNode.x / nodeGridSize) * nodeGridSize;
                const baseGridY = Math.round(startNode.y / nodeGridSize) * nodeGridSize;
                const expansionPattern = [
                    { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
                    { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
                ];
                const maxExpansionLayers = 7; // еўће¤§ж‰©е±•е±‚ж•°

                // е€†е±‚ићєж—‹ж‰©е±•жђњзґў
                for (let layer = 1; layer <= maxExpansionLayers; layer++) {
                    const candidatePoints = expansionPattern.map(dir => ({
                        x: baseGridX + dir.dx * nodeGridSize * layer,
                        y: baseGridY + dir.dy * nodeGridSize * layer
                    }));

                    // жЊ‰жЋҐиї‘еє¦жЋ’еєЏеЂ™йЂ‰з‚№
                    candidatePoints.sort((a, b) =>
                                         UTILS.getDist(a, startNode, 0, 0) - UTILS.getDist(b, startNode, 0, 0)
                                        );

                    // дје…€жЈЂжџҐж›ґжЋҐиї‘еЋџз›®ж ‡зљ„з‚?
                    for (const point of candidatePoints) {
                        if (isNavigable(point.x, point.y)) {
                            newStartNode = point;
                            break;
                        }
                    }
                    if (newStartNode) break;
                }
            }
            if(newStartNode){
                plannedPath.unshift(playerStart);
            }
            plannedPath.unshift(playerStart);
            plannedPath = plannedPath.filter(point =>
                                             UTILS.getDist(point, playerStart, 0, 0) > nodeGridSize ||
                                             point === playerStart || point === originalTarget
                                            );

            return plannedPath;
        }

        // ж— йљњзўЌз‰©ж—¶зљ„з›ґзєїи·Їеѕ„
        return [playerStart, originalTarget];
    } catch (error) {
        console.error('и·Їеѕ„и§„е€’еј‚еёё:', error);
        return [player, target];
    }
}

// дје…€йџе€—е®ћзЋ°пј€дїќжЊЃдёЌеЏпј‰
class PriorityQueue {
    constructor() {
        this.elements = [];
    }

    enqueue(element, priority) {
        this.elements.push({ element, priority });
        this.sort();
    }

    dequeue() {
        return this.elements.shift().element;
    }

    sort() {
        this.elements.sort((a, b) => a.priority - b.priority);
    }

    isEmpty() {
        return this.elements.length === 0;
    }
}

function createHeartPoints(count, angle, size) {
    const points = [];
    // ж„›еїѓе°–з«ЇеЋџе§‹ж–№еђ‘з‚єж­Јдё‹ж–№ (270еє?)пјЊйњЂж—‹иЅ‰е€°з›®жЁ™и§’еє?
    const rotation = angle - (3 * Math.PI) / 2;

    // ж„›еїѓеЏѓж•ёж–№зЁ‹ж­ёдёЂеЊ–и™•зђ? (жњЂе¤§й•·еє¦з‚є 17)
    const normalize = 1 / 17;

    for (let i = 0; i < count; i++) {
        // еќ‡е‹»е€†дЅ€еЏѓж•ё t
        const t = (i * 2 * Math.PI) / count;

        // ж„›еїѓеЏѓж•ёж–№зЁ‹
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t)
        - 5 * Math.cos(2 * t)
        - 2 * Math.cos(3 * t)
        - Math.cos(4 * t);

        // зё®ж”ѕи‡іжЊ‡е®ље¤§е°?
        const scaledX = x * normalize * size;
        const scaledY = y * normalize * size;

        // ж—‹иЅ‰еє§жЁ™зі?
        const cosA = Math.cos(rotation);
        const sinA = Math.sin(rotation);
        const rotatedX = scaledX * cosA - scaledY * sinA;
        const rotatedY = scaledX * sinA + scaledY * cosA;

        points.push({ x: rotatedX, y: rotatedY });
    }

    return points;
}

const FPS60 = 1e3/60;

function updateGame() {
    hue = (hue + delta/FPS60) % 360;

    // MOVE CAMERA:
    if (player) {
        if (false) {
            camX = player.x;
            camY = player.y;
        } else {
            /*     let tmpDist = UTILS.getDistance(camX, camY, player.x, player.y);
                        let tmpDir = UTILS.getDirection(player.x, player.y, camX, camY);
                        let camSpd = Math.min(tmpDist * 0.01 * delta, tmpDist);
                        if (tmpDist > 0.05) {
                            camX += camSpd * Math.cos(tmpDir);
                            camY += camSpd * Math.sin(tmpDir);
                        } else {
                            camX = player.x;
                            camY = player.y;
                        }*/
            if(camX != player.x){
                camX += (player.x - camX) / Math.max(1, getEl('smoothlevel').value) * delta / FPS60;
            }
            if(camY != player.y){
                camY += (player.y - camY) / Math.max(1, getEl('smoothlevel').value) * delta / FPS60;

            }

        }
    } else {
        camX = config.mapScale / 2;
        camY = config.mapScale / 2;
    }
    let xOffset = camX - (maxScreenWidth / 2);
    let yOffset = camY - (maxScreenHeight / 2);
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
    // BETTER MOVE CAMERA:
    /*if (player) {
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
    }*/

    // RENDER CORDS:

    if (config.snowBiomeTop - yOffset <= 0 && config.mapScale - config.snowBiomeTop - yOffset >= maxScreenHeight) {
        mainContext.fillStyle = "#768f5a";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
    } else if (config.mapScale - config.snowBiomeTop - yOffset <= 0) {
        mainContext.fillStyle = "#8f815a";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
    } else if (config.snowBiomeTop - yOffset >= maxScreenHeight) {
        mainContext.fillStyle = "#a6a6be";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
    } else if (config.snowBiomeTop - yOffset >= 0) {
        mainContext.fillStyle = "#a6a6be";
        mainContext.fillRect(0, 0, maxScreenWidth, config.snowBiomeTop - yOffset);
        mainContext.fillStyle = "#768f5a";
        mainContext.fillRect(0, config.snowBiomeTop - yOffset, maxScreenWidth,
                             maxScreenHeight - (config.snowBiomeTop - yOffset));
    } else {
        mainContext.fillStyle = "#768f5a";
        mainContext.fillRect(0, 0, maxScreenWidth,
                             (config.mapScale - config.snowBiomeTop - yOffset));
        mainContext.fillStyle = "#8f815a";
        mainContext.fillRect(0, (config.mapScale - config.snowBiomeTop - yOffset), maxScreenWidth,
                             maxScreenHeight - (config.mapScale - config.snowBiomeTop - yOffset));
    }
    mainContext.fillStyle = "#bcaf6f";
    mainContext.fillRect(config.mapScale - 2000 - xOffset,config.mapScale - 2000 - yOffset, 2000, 2000);

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
        /*   let co = (maxScreenWidth + maxScreenHeight)/30;
                      for(let i=0;i<co;i++){
clickmouse.push([Random(0, maxScreenWidth), Random(0, maxScreenHeight), 0, rotate + i*(360/co)]);
  }

    for (let i = 0; i < clickmouse.length; i++) {
        if(clickmouse[i][2] <= 10){
            clickmouse[i][2]+=0.5;
            mainContext.lineWidth = 5;
            mainContext.globalAlpha = Math.max(0, 1 - (clickmouse[i][2]/10));
            mainContext.strokeStyle = `hsl(${clickmouse[i][3] + (clickmouse[i][2]*10)}, 100%, 50%)`;;
            mainContext.lineCap = "round";
            mainContext.beginPath();
            mainContext.arc(clickmouse[i][0], clickmouse[i][1], clickmouse[i][2]*7, 0, 2 * Math.PI);
            mainContext.stroke();
        }else{
            clickmouse.splice(i, 1);
        }
    }
*/
        // DEATH LOCATION:
        if (lastDeath) {
            mainContext.globalAlpha = 1;
            mainContext.fillStyle = "#fc5553";
            mainContext.font = "100px Hammersmith One";
            mainContext.textBaseline = "middle";
            mainContext.textAlign = "center";
            mainContext.fillText("x", lastDeath.x - xOffset, lastDeath.y - yOffset);
        }
        if (mapMarker) {
            mainContext.globalAlpha = 1;
            mainContext.fillStyle = "#e2ff0d";
            mainContext.font = "100px Hammersmith One";
            mainContext.textBaseline = "middle";
            mainContext.textAlign = "center";
            mainContext.fillText("x", mapMarker.x - xOffset, mapMarker.y - yOffset);
        }
        if (GoToRandomXY && ramdonXY) {
            mainContext.globalAlpha = 1;
            mainContext.fillStyle = "#51ace1";
            mainContext.font = "100px Hammersmith One";
            mainContext.textBaseline = "middle";
            mainContext.textAlign = "center";
            mainContext.fillText("x", ramdonXY.x - xOffset, ramdonXY.y - yOffset);
        }
        if ((GoToBuild || GoToTeamBuild || GoToAllBuild) && nearobject) {
            mainContext.globalAlpha = 1;
            mainContext.fillStyle = "#51ace1";
            mainContext.font = "100px Hammersmith One";
            mainContext.textBaseline = "middle";
            mainContext.textAlign = "center";
            mainContext.fillText("x", nearobject.x - xOffset, nearobject.y - yOffset);
        }

    }

    // RENDER DEAD PLAYERS:
    mainContext.shadowBlur = null;
    mainContext.shadowColor = null;
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
    mainContext.font = '15px Arial';
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
        if (config.mapScale - xOffset <= maxScreenWidth)
            tmpMin = maxScreenWidth - (config.mapScale - xOffset);
        mainContext.fillRect(tmpX, config.mapScale - yOffset,
                             (maxScreenWidth - tmpX) - tmpMin, maxScreenHeight - (config.mapScale - yOffset));
    }
    if(placeVisible.length > 0){
        mainContext.globalAlpha = 1;
        placeVisible.forEach((places) => {
            mainContext.save();
            mainContext.translate(places.x - xOffset, places.y - yOffset);
            mainContext.globalAlpha = places.name == "pit trap" ? 0.18 : 0.3;
            mainContext.rotate(places.dir);
            places.render = true;
            let A = getItemSprite(places);
            mainContext.drawImage(A, -(A.width / 2), -(A.height / 2));
            mainContext.restore();
        });
    }
    // RENDER DAY/NIGHT TIME:
    /*
    mainContext.globalAlpha = 0;
    mainContext.fillStyle = "rgba(0, 0, 70, 0.35)";
    mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
   */
    // RENDER PLAYER AND AI UI:
    mainContext.strokeStyle = "#000";
    mainContext.globalAlpha = 1;
    for (let i = 0; i < players.length + ais.length; ++i) {
        tmpObj = players[i] || ais[i - players.length];
        if (tmpObj.visible) {
            mainContext.strokeStyle = "#000";
            if(tmpObj.isPlayer){

            }
            // NAME AND HEALTH:
            let tmpText = (tmpObj.team ? "[" + tmpObj.team + "] " : "") + (tmpObj.isPlayer ? '{' + tmpObj.sid + '}' : '') + (tmpObj.name || "") + (tmpObj.isPlayer && tmpObj != player ?" " + Math.floor(UTILS.getDistance(tmpObj.x, tmpObj.y, player.x, player.y)) : '')
            if (tmpText != "") {
                if(ranbowName){
                    tmpObj.gradient = mainContext.createLinearGradient(
                        tmpObj.x - xOffset - (mainContext.measureText(tmpText).width),
                        (tmpObj.y - yOffset - tmpObj.scale) - config.nameY - (tmpObj.nameScale || 30),
                        tmpObj.x - xOffset + (mainContext.measureText(tmpText).width),
                        (tmpObj.y - yOffset - tmpObj.scale) - config.nameY + (mainContext.measureText(tmpText).width)  // еЉ е…Ґе°Ќи§’ж–№еђ‘
                    );

                    // ж·»еЉ жјёи®ЉйЎЏи‰І
                    if (!tmpObj.hue) tmpObj.hue = Random(0, 360);
                    tmpObj.hue = (tmpObj.hue + delta / FPS60) % 360;
                    for (let i = 0; i <= 100; i++) {
                        tmpObj.gradient.addColorStop(1 - (i / 100), `hsl(${tmpObj.hue + i}, 100%, 50%)`);
                    }
                }
                if(tmpObj === player){

                    if(getEl("wing").checked){
                        if(player.speed){
                            rotate = (rotate + (parseFloat(Math.min(1, player.speed/30).toFixed(1)) + 0.5) * delta / FPS60) % 90;
                        } else {
                            rotate = (rotate + 0.5 * delta / FPS60) % 90;

                        }
                        mainContext.strokeStyle = `#000`;
                        mainContext.fillStyle = `#1a1a1a`;
                        let wing = {
                            x: player.x - xOffset,
                            y: player.y - yOffset,
                            angle: -45,
                            dir: player.dir + Math.PI/2// - player.dirPlus
                        }

                        wing = {
                            x: player.x - xOffset,
                            y: player.y - yOffset,
                            angle: -45,
                            dir: player.dir + Math.PI/2// + player.dirPlus
                        }
                        mainContext.beginPath();
                        mainContext.moveTo(wing.x, wing.y);
                        mainContext.quadraticCurveTo(wing.x + Math.cos(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle+20))*75 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle+20))*75 , wing.x + Math.cos(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle))*150 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle))*150);
                        wing.x += Math.cos(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle))*150;
                        wing.y += Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle))*150;
                        wing.angle = 45;
                        mainContext.quadraticCurveTo(wing.x + Math.cos(wing.dir + toRad(Math.abs(rotate - 45) + 0))*75 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + 0))*75 , wing.x + Math.cos(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle))*150 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle))*150);
                        wing.x += Math.cos(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle))*150;
                        wing.y += Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle))*150;
                        wing.angle = 190;
                        mainContext.quadraticCurveTo(wing.x + Math.cos(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle + 45))*40 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle + 45))*40 , wing.x + Math.cos(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle)) * 70 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle)) * 70);
                        wing.x += Math.cos(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle)) * 70;
                        wing.y += Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle)) * 70;
                        wing.angle = 175;
                        mainContext.quadraticCurveTo(wing.x + Math.cos(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle + 45))*45 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle + 45))*45 , wing.x + Math.cos(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle)) * 70 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle)) * 70);
                        wing.x += Math.cos(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle)) * 70;
                        wing.y += Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle)) * 70;
                        wing.angle = 180;
                        mainContext.quadraticCurveTo(wing.x + Math.cos(wing.dir + toRad(Math.abs(rotate - 45) + -155))*40 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + -155))*40 , player.x - xOffset , player.y - yOffset);
                        mainContext.lineWidth = 3;
                        mainContext.stroke();
                        mainContext.fill();
                        wing = {
                            x: player.x - xOffset,
                            y: player.y - yOffset,
                            angle: -45,
                            dir: -player.dir - Math.PI/2// - player.dirPlus
                        }
                        mainContext.beginPath();
                        mainContext.moveTo(wing.x, wing.y);
                        mainContext.quadraticCurveTo(wing.x + Math.cos(wing.dir + toRad(180+Math.abs(rotate - 45) + wing.angle+20))*75 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle+20))*75 , wing.x + Math.cos(wing.dir + toRad(180+Math.abs(rotate - 45) + wing.angle))*150 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle))*150);
                        wing.x += Math.cos(wing.dir + toRad(180+Math.abs(rotate - 45) + wing.angle))*150;
                        wing.y += Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle))*150;
                        wing.angle = 45;
                        mainContext.quadraticCurveTo(wing.x + Math.cos(wing.dir + toRad(180+Math.abs(rotate - 45) + 0))*75 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + 0))*75 , wing.x + Math.cos(wing.dir + toRad(180+Math.abs(rotate - 45) + wing.angle))*150 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle))*150);
                        wing.x += Math.cos(wing.dir + toRad(180+Math.abs(rotate - 45) + wing.angle))*150;
                        wing.y += Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle))*150;
                        wing.angle = 190;
                        mainContext.quadraticCurveTo(wing.x + Math.cos(wing.dir + toRad(180+Math.abs(rotate - 45) + wing.angle + 45))*40 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle + 45))*40 , wing.x + Math.cos(wing.dir + toRad(180+Math.abs(rotate - 45) + wing.angle)) * 70 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle)) * 70);
                        wing.x += Math.cos(wing.dir + toRad(180+Math.abs(rotate - 45) + wing.angle)) * 70;
                        wing.y += Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle)) * 70;
                        wing.angle = 175;
                        mainContext.quadraticCurveTo(wing.x + Math.cos(wing.dir + toRad(180+Math.abs(rotate - 45) + wing.angle + 45))*45 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle + 45))*45 , wing.x + Math.cos(wing.dir + toRad(180+Math.abs(rotate - 45) + wing.angle)) * 70 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle)) * 70);
                        wing.x += Math.cos(wing.dir + toRad(180+Math.abs(rotate - 45) + wing.angle)) * 70;
                        wing.y += Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + wing.angle)) * 70;
                        wing.angle = 180;
                        mainContext.quadraticCurveTo(wing.x + Math.cos(wing.dir + toRad(180+Math.abs(rotate - 45) + -155))*40 , wing.y + Math.sin(wing.dir + toRad(Math.abs(rotate - 45) + -155))*40 , player.x - xOffset , player.y - yOffset);
                        mainContext.lineWidth = 3;
                        mainContext.stroke();
                        mainContext.fill();
                    }
                }

                mainContext.font = (tmpObj.nameScale || 30) + "px Hammersmith One";
                mainContext.strokeStyle = "#000";
                mainContext.fillStyle = ranbowName ? tmpObj.gradient : "#fff";
                mainContext.textBaseline = "middle";
                mainContext.textAlign = "center";
                mainContext.lineWidth = (tmpObj.nameScale ? 11 : 8);
                mainContext.lineJoin = "round";
                mainContext.strokeText(tmpText, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY);
                mainContext.fillText(tmpText, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY);
                mainContext.strokeStyle = "#fff";
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
            }
            if (tmpObj.health > 0) {
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

                if (tmpObj.isPlayer) {
                    mainContext.globalAlpha = 1;
                    mainContext.font = "30px Hammersmith One";
                    mainContext.fillStyle = "#ff0000";
                    mainContext.strokeStyle = "#000";
                    mainContext.textBaseline = "middle";
                    mainContext.textAlign = "center";
                    mainContext.lineWidth = 8;
                    mainContext.lineJoin = "round";
                    let tmpS = config.crownIconScale;
                    let tmpX = tmpObj.x - xOffset - tmpS / 2 + mainContext.measureText(tmpText).width / 2 + config.crownPad + (tmpObj.iconIndex == 1 ? 30 * 2.75 : 30);
                    mainContext.strokeText(tmpObj.shameCount + "/" + tmpObj.maxShame, tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY);
                    mainContext.fillText(tmpObj.shameCount + "/" + tmpObj.maxShame, tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY);
                    if(!(tmpObj == player || (tmpObj.team && tmpObj.team == player.team))){
                        mainContext.lineWidth = 1;
                        mainContext.font ="20px Hammersmith One";
                        mainContext.fillStyle = `hsl(60, 100%, 50%)`;
                        mainContext.strokeStyle = "#000";
                        mainContext.textBaseline = "middle";
                        mainContext.textAlign = "center";
                        mainContext.lineWidth = 5;
                        mainContext.lineJoin = "round";
                        mainContext.strokeText(`[${tmpObj.hitDmg}/${tmpObj.shootDmg}]`, tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 30);
                        mainContext.fillText(`[${tmpObj.hitDmg}/${tmpObj.shootDmg}]`, tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 30);

                    }
                    let reloads = {
                        primary: (tmpObj.primaryIndex == undefined ? 1 : ((items.weapons[tmpObj.primaryIndex].speed - tmpObj.reloads[tmpObj.primaryIndex]) / items.weapons[tmpObj.primaryIndex].speed)),
                        secondary: (tmpObj.secondaryIndex == undefined ? 1 : ((items.weapons[tmpObj.secondaryIndex].speed - tmpObj.reloads[tmpObj.secondaryIndex]) / items.weapons[tmpObj.secondaryIndex].speed)),
                        turret: (2500 - tmpObj.reloads[53]) / 2500
                    };
                    if (tmpObj.primaryIndex == undefined ? false : (tmpObj.reloads[tmpObj.primaryIndex] > 0)) {
                        mainContext.fillStyle = darkOutlineColor;
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth - config.healthBarPad,
                                              (tmpObj.y - yOffset + tmpObj.scale) + config.nameY - 13, config.healthBarWidth +
                                              (config.healthBarPad * 2) - 5, 17, 8);
                        mainContext.fill();
                        // PRIMARY RELOAD BAR:
                        mainContext.fillStyle = "gray";//#a5974c
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth,
                                              (tmpObj.y - yOffset + tmpObj.scale) + config.nameY - 13 + config.healthBarPad,
                                              (config.healthBarWidth * (reloads.primary >= 0.1 ? reloads.primary : 0.1)) - 5, 17 - config.healthBarPad * 2, 7);
                        mainContext.fill();
                    }
                    if (tmpObj.secondaryIndex == undefined ? false : (tmpObj.reloads[tmpObj.secondaryIndex] > 0)) {
                        mainContext.fillStyle = darkOutlineColor;
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarPad + 5,
                                              (tmpObj.y - yOffset + tmpObj.scale) + config.nameY - 13, (config.healthBarWidth - 5) +
                                              (config.healthBarPad * 2), 17, 8);
                        mainContext.fill();
                        // SECONDARY RELOAD BAR:
                        mainContext.fillStyle = "gray";//#a5974c
                        mainContext.roundRect(tmpObj.x - xOffset + 5,
                                              (tmpObj.y - yOffset + tmpObj.scale) + config.nameY - 13 + config.healthBarPad,
                                              (config.healthBarWidth * (reloads.secondary >= 0.1 ? reloads.secondary : 0.1)) - 5, 17 - config.healthBarPad * 2, 7);
                        mainContext.fill();
                    }
                    if(getEl("clownturntable").checked){
                        let showdir = tmpObj.shameCount * (360/8);
                        if(!tmpObj.showShamerotate)tmpObj.showShamerotate = 0;
                        if(tmpObj.showShamerotate != showdir){
                            tmpObj.showShamerotate += (showdir - tmpObj.showShamerotate) / 10 * delta / FPS60;
                        }
                        let instadir = tmpObj.maxShame * (360/8);
                        if(!tmpObj.instaShamerotate)tmpObj.instaShamerotate = 0;
                        if(tmpObj.instaShamerotate != instadir){
                            tmpObj.instaShamerotate += (instadir - tmpObj.instaShamerotate) / 10 * delta / FPS60;
                        }
                        mainContext.lineWidth = 4;
                        mainContext.globalAlpha = 1;
                        mainContext.lineCap = "round";
                        mainContext.strokeStyle = `rgba(255, 255, 255, 0.5)`;
                        mainContext.fillStyle = `rgba(255, ${tmpObj.skinIndex == 45 ? 0 : 255}, 0, 0.5)`;
                        mainContext.beginPath();
                        mainContext.arc(tmpObj.x - xOffset, tmpObj.y - yOffset, 70, 0, 2 * Math.PI);
                        mainContext.stroke();
                        mainContext.fill();
                        mainContext.font ="20px Hammersmith One";
                        let size = 18, dist = 50;
                        mainContext.fillStyle = `rgba(255, ${tmpObj.skinIndex == 45 ? 0 : 255}, 0, 0.5)`;
                        for(let i=0;i < 8;i++){
                            let x = tmpObj.x - xOffset + Math.cos(toRad(i*(360/8) - 90 - tmpObj.showShamerotate)) * dist;
                            let y = tmpObj.y - yOffset + Math.sin(toRad(i*(360/8) - 90 - tmpObj.showShamerotate)) * dist;
                            mainContext.beginPath();
                            mainContext.arc(x, y, size, 0, 2 * Math.PI);
                            mainContext.stroke();
                            mainContext.fill();
                        }
                        let x = tmpObj.x - xOffset + Math.cos(toRad(tmpObj.instaShamerotate - 90 - tmpObj.showShamerotate)) * dist;
                        let y = tmpObj.y - yOffset + Math.sin(toRad(tmpObj.instaShamerotate - 90 - tmpObj.showShamerotate)) * dist;
                        mainContext.fillStyle = `rgba(255, 0, 0, 0.5)`;
                        mainContext.beginPath();
                        mainContext.arc(x, y, size, 0, 2 * Math.PI);
                        mainContext.stroke();
                        mainContext.fill();
                        x = tmpObj.x - xOffset + Math.cos(toRad(- 90)) * dist;
                        y = tmpObj.y - yOffset + Math.sin(toRad(- 90)) * dist;
                        mainContext.fillStyle = `rgba(0, 0, 0, 0.5)`;
                        mainContext.beginPath();
                        mainContext.arc(x, y, size, 0, 2 * Math.PI);
                        mainContext.stroke();
                        mainContext.fill();

                        for(let i=0;i < 8;i++){
                            let x = tmpObj.x - xOffset + Math.cos(toRad(i*(360/8) - 90 - tmpObj.showShamerotate)) * dist;
                            let y = tmpObj.y - yOffset + Math.sin(toRad(i*(360/8) - 90 - tmpObj.showShamerotate)) * dist;
                            mainContext.fillStyle = "#fff";
                            mainContext.strokeStyle = "#000";
                            mainContext.strokeText(`${i}`, x, y);
                            mainContext.fillText(`${i}`, x, y);
                        }
                    }
                    Object.keys(PLAYERS).forEach(sid => {
                        const playerData = PLAYERS[sid];
                        if (player.sid !== playerData.sid && window.location.href === playerData.href && tmpObj.sid === playerData.sid) {
                            mainContext.globalAlpha = 1;
                            mainContext.font = "20px Hammersmith One";
                            mainContext.fillStyle = "#fff";
                            mainContext.strokeStyle = "#000";
                            mainContext.textBaseline = "middle";
                            mainContext.textAlign = "center";
                            mainContext.lineWidth = 5;
                            mainContext.lineJoin = "round";
                            mainContext.strokeText(`[${playerData.fps}|${playerData.Ping}|${playerData.ModPing}|44.5]`, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY - 30);
                            mainContext.fillText(`[${playerData.fps}|${playerData.Ping}|${playerData.ModPing}|44.5]`, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY - 30);
                            mainContext.globalAlpha = 1;
                        }
                    });
                    mainContext.lineWidth = 1;
                    mainContext.font ="20px Hammersmith One";
                    mainContext.fillStyle = `hsl(60, 100%, 50%)`;
                    mainContext.strokeStyle = "#000";
                    mainContext.textBaseline = "middle";
                    mainContext.textAlign = "center";
                    mainContext.lineWidth = 5;
                    mainContext.lineJoin = "round";
                    mainContext.strokeText(`${tmpObj.speed}/${tmpObj.maxSpeed}`, tmpObj.x - xOffset, tmpObj.y - yOffset);
                    mainContext.fillText(`${tmpObj.speed}/${tmpObj.maxSpeed}`, tmpObj.x - xOffset, tmpObj.y - yOffset);
                    mainContext.strokeText(`${"[" + (tmpObj.ping || 0) + "]"}`, tmpObj.x - xOffset, tmpObj.y - yOffset + 20);
                    mainContext.fillText(`${"[" + (tmpObj.ping || 0) + "]"}`, tmpObj.x - xOffset, tmpObj.y - yOffset + 20);
                }


            }
        }
    }

    if (player) {
        if(battack){
            mainContext.strokeStyle = "#000";
            mainContext.beginPath();
            mainContext.arc(battack[0] - xOffset, battack[1] - yOffset, 10, 0, 2 * Math.PI);
            mainContext.stroke();
        }

        if(emySpikes.length > 0){
            emySpikes.forEach((tmp) => {
                mainContext.lineWidth = 5;
                mainContext.globalAlpha = 1;
                mainContext.lineCap = "round";
                mainContext.strokeStyle = "#f00";
                mainContext.beginPath();
                mainContext.arc(tmp.x - xOffset, tmp.y - yOffset, emySpikes.scale, 0, 2 * Math.PI);
                mainContext.stroke();
            });
        }
        if(BreakBuild.length > 0){
            mainContext.lineWidth = 5;
            mainContext.globalAlpha = 1;
            mainContext.lineCap = "round";
            mainContext.strokeStyle = "#fff";
            BreakBuild.forEach((tmp) => {
                mainContext.beginPath();
                mainContext.arc(tmp.x - xOffset, tmp.y - yOffset, 5, 0, 2 * Math.PI);
                mainContext.stroke();
            });
        }
        if(typeof walkaim == 'number'){
            mainContext.lineWidth = 5;
            mainContext.globalAlpha = 1;
            mainContext.lineCap = "round";
            mainContext.strokeStyle = "#fff";
            mainContext.beginPath();
            mainContext.moveTo(player.x - xOffset, player.y - yOffset);
            mainContext.lineTo(player.x - xOffset + Math.cos(walkaim) * 100, player.y - yOffset + Math.sin(walkaim) * 100);
            mainContext.lineTo(player.x - xOffset + Math.cos(walkaim) * 100 + Math.cos(walkaim + toRad(150)) * 35 , player.y - yOffset + Math.sin(walkaim) * 100 + Math.sin(walkaim + toRad(150)) * 35);
            mainContext.lineTo(player.x - xOffset + Math.cos(walkaim) * 100, player.y - yOffset + Math.sin(walkaim) * 100);
            mainContext.lineTo(player.x - xOffset + Math.cos(walkaim) * 100 + Math.cos(walkaim - toRad(150)) * 35 , player.y - yOffset + Math.sin(walkaim) * 100 + Math.sin(walkaim - toRad(150)) * 35);
            mainContext.stroke();
        }

        if(getEl("playertail").checked){

            try{
                playertrail.forEach((p, pIdx) => {
                    const prev = pIdx === 0 ? player : playertrail[pIdx - 1];
                    const spring = pIdx === 0 ? .4 * playerparams.spring : playerparams.spring * delta / FPS60;
                    p.dx += (prev.x - p.x) * spring;
                    p.dy += (prev.y - p.y) * spring;
                    p.dx *= playerparams.friction;
                    p.dy *= playerparams.friction;
                    p.x += p.dx;
                    p.y += p.dy;
                });
            }catch(e){}
            try{
                mainContext.globalAlpha = 1;
                mainContext.lineCap = "round";
                mainContext.strokeStyle = `#fff`;
                mainContext.beginPath();
                mainContext.moveTo(playertrail[0].x - xOffset, playertrail[0].y - yOffset);
                mainContext.shadowColor = `hsl(60, 100%, 50%)`;
                mainContext.shadowBlur = 17.5;
                for (let i = 1; i < weapontrail.length - 1; i++) {
                    const xc = .5 * (playertrail[i].x + playertrail[i + 1].x);
                    const yc = .5 * (playertrail[i].y + playertrail[i + 1].y);
                    mainContext.quadraticCurveTo(playertrail[i].x - xOffset, playertrail[i].y - yOffset, xc - xOffset, yc - yOffset);
                    mainContext.lineWidth = playerparams.widthFactor * (playerparams.pointsNumber - i);
                    mainContext.stroke();
                }
            }catch(e){}
        }
        if(getEl("weapontail").checked){

            try{
                weaponpointer.x = player.x + Math.cos(player.dir + player.dirPlus) * 35 + Math.cos(player.dir + player.dirPlus + toRad([7, 9, 11, 12, 13, 15].includes(player.weaponIndex) ? 0 : 90)) * ([9, 12, 13].includes(player.weaponIndex) ? 68 : player.weaponIndex == 15 ? 125 : player.weaponIndex == 11 ? 10 : items.weapons[player.weaponIndex].range);
                weaponpointer.y = player.y + Math.sin(player.dir + player.dirPlus) * 35 + Math.sin(player.dir + player.dirPlus + toRad([7, 9, 11, 12, 13, 15].includes(player.weaponIndex) ? 0 : 90)) * ([9, 12, 13].includes(player.weaponIndex) ? 68 : player.weaponIndex == 15 ? 125 : player.weaponIndex == 11 ? 10 : items.weapons[player.weaponIndex].range);
                weapontrail.forEach((p, pIdx) => {
                    const prev = pIdx === 0 ? weaponpointer : weapontrail[pIdx - 1];
                    const spring = pIdx === 0 ? .4 * weaponparams.spring : weaponparams.spring * delta / FPS60;
                    p.dx += (prev.x - p.x) * spring;
                    p.dy += (prev.y - p.y) * spring;
                    p.dx *= weaponparams.friction;
                    p.dy *= weaponparams.friction;
                    p.x += p.dx;
                    p.y += p.dy;
                });
            }catch(e){}
            try{
                mainContext.globalAlpha = 1;
                mainContext.lineCap = "round";
                mainContext.strokeStyle = `#fff`;
                mainContext.beginPath();
                mainContext.moveTo(weapontrail[0].x - xOffset, weapontrail[0].y - yOffset);
                mainContext.shadowColor = `hsl(60, 100%, 50%)`;
                mainContext.shadowBlur = 5;
                for (let i = 1; i < weapontrail.length - 1; i++) {
                    const xc = .5 * (weapontrail[i].x + weapontrail[i + 1].x);
                    const yc = .5 * (weapontrail[i].y + weapontrail[i + 1].y);
                    mainContext.quadraticCurveTo(weapontrail[i].x - xOffset, weapontrail[i].y - yOffset, xc - xOffset, yc - yOffset);
                    mainContext.lineWidth = weaponparams.widthFactor * (weaponparams.pointsNumber - i);
                    mainContext.stroke();
                }
                /*            mainContext.lineTo((trail[trail.length - 1].x - mX) / scaleFillNative, (trail[trail.length - 1].y - mY) / scaleFillNative);
                        mainContext.stroke();*/
            }catch(e){}
        }
        if(getEl("mousetail").checked){
            try{
                trail.forEach((p, pIdx) => {
                    const prev = pIdx === 0 ? pointer : trail[pIdx - 1];
                    const spring = (pIdx === 0 ? .4 * params.spring : params.spring) * delta / FPS60;
                    p.dx += (prev.x - p.x) * spring;
                    p.dy += (prev.y - p.y) * spring;
                    p.dx *= params.friction;
                    p.dy *= params.friction;
                    p.x += p.dx;
                    p.y += p.dy;
                });
            }catch(e){}

            try{
                mainContext.globalAlpha = 1;
                mainContext.lineCap = "round";
                mainContext.strokeStyle = `#fff`;
                mainContext.beginPath();
                mainContext.moveTo((trail[0].x - mX) / scaleFillNative, (trail[0].y - mY) / scaleFillNative);
                mainContext.shadowColor = `hsl(60, 100%, 50%)`;
                mainContext.shadowBlur = 5;
                for (let i = 1; i < trail.length - 1; i++) {
                    const xc = .5 * (trail[i].x + trail[i + 1].x);
                    const yc = .5 * (trail[i].y + trail[i + 1].y);
                    mainContext.quadraticCurveTo((trail[i].x - mX) / scaleFillNative, (trail[i].y - mY) / scaleFillNative, (xc - mX) / scaleFillNative, (yc - mY) / scaleFillNative);
                    mainContext.lineWidth = params.widthFactor * (params.pointsNumber - i);
                    mainContext.stroke();
                }
                /*            mainContext.lineTo((trail[trail.length - 1].x - mX) / scaleFillNative, (trail[trail.length - 1].y - mY) / scaleFillNative);
                        mainContext.stroke();*/
            }catch(e){}
        }
        mainContext.shadowBlur = null;
        mainContext.shadowColor = null;

        mainContext.font ="20px Hammersmith One";
        mainContext.fillStyle = `hsl(60, 100%, 50%)`;
        mainContext.strokeStyle = "#000";
        mainContext.textBaseline = "middle";
        mainContext.textAlign = "center";
        mainContext.lineWidth = 5;
        mainContext.lineJoin = "round";
        mainContext.strokeText(`[${checkAntiSpikeTick()}/${antiinsta()}/${secPacket}]`, player.x - xOffset, player.y - yOffset + player.scale + config.nameY + 30);
        mainContext.fillText(`[${checkAntiSpikeTick()}/${antiinsta()}/${secPacket}]`, player.x - xOffset, player.y - yOffset + player.scale + config.nameY + 30);
        mainContext.strokeText(`[${UTILS.round(fpsTimer.ltime, 10)}/${window.pingTime}/${Date.now() - onlyEmp < 120 ? 1 : 0}/${Date.now() - onlySoldier < 120 ? 1 : 0}]`, player.x - xOffset, player.y - yOffset + player.scale + config.nameY + 55);
        mainContext.fillText(`[${UTILS.round(fpsTimer.ltime, 10)}/${window.pingTime}/${Date.now() - onlyEmp < 120 ? 1 : 0}/${Date.now() - onlySoldier < 120 ? 1 : 0}]`, player.x - xOffset, player.y - yOffset + player.scale + config.nameY + 55);
        mainContext.strokeText(`[${UseHatid} ${UseAccid}, ${player.nearBreakType}]`, player.x - xOffset, (player.y - yOffset - player.scale) - config.nameY - 30);
        mainContext.fillText(`[${UseHatid} ${UseAccid}, ${player.nearBreakType}]`, player.x - xOffset, (player.y - yOffset - player.scale) - config.nameY - 30);
        mainContext.strokeText(`[${MoveType}]`, player.x - xOffset, (player.y - yOffset - player.scale) - config.nameY + 30);
        mainContext.fillText(`[${MoveType}]`, player.x - xOffset, (player.y - yOffset - player.scale) - config.nameY + 30);
        mainContext.strokeStyle = "#0000";

        /*   booms.forEach((boom) => {
            if(boom[3] < boom[2]){
                booms = [];
            }
            boom[2] += boom[3]/300*fpsTimer.ltime;
        });*/
        try{
            //   path = findPath({x: canvasX + xOffset, y: canvasY + yOffset});
            if(path.length > 0) {
                path.forEach((e, i)=>{
                    if(i ==0){
                        mainContext.lineWidth = 5;
                        mainContext.globalAlpha = 1;
                        mainContext.lineCap = "round";
                        mainContext.strokeStyle = "#fff";
                        mainContext.beginPath();
                        mainContext.moveTo(e.x - xOffset, e.y - yOffset);
                    } else {
                        mainContext.lineTo(e.x - xOffset, e.y - yOffset);
                    }
                });
                mainContext.stroke();
                path.forEach((e, i)=>{
                    mainContext.beginPath();
                    mainContext.arc(e.x - xOffset, e.y - yOffset, 5, 0, 2 * Math.PI);
                    mainContext.stroke();
                });
                if(closestReachableEnd){
                    mainContext.strokeStyle = "#000";
                    mainContext.beginPath();
                    mainContext.arc(closestReachableEnd.x - xOffset, closestReachableEnd.y - yOffset, 5, 0, 2 * Math.PI);
                    mainContext.stroke();

                }
            }
        }catch(e){}
        //   path = findPath({x: canvasX + xOffset, y: canvasY + yOffset});
        const points = createHeartPoints(bot.length, mouseAim(), 200);
        if(points.length > 0) {
            points.forEach((e, i)=>{
                if(i ==0){
                    mainContext.lineWidth = 5;
                    mainContext.globalAlpha = 1;
                    mainContext.lineCap = "round";
                    mainContext.strokeStyle = "#fff";
                    mainContext.beginPath();
                    mainContext.moveTo(player.x + e.x - xOffset, player.y + e.y - yOffset);
                } else {
                    mainContext.lineTo(player.x + e.x - xOffset, player.y + e.y - yOffset);
                }
            });
            mainContext.stroke();
            points.forEach((e, i)=>{
                mainContext.beginPath();
                mainContext.arc(player.x + e.x - xOffset, player.y + e.y - yOffset, 5, 0, 2 * Math.PI);
                mainContext.stroke();
            });
        }
        try{
            if(isNavigablelist.length > 0) {
                isNavigablelist.forEach((e, i)=>{
                    mainContext.strokeStyle = "#f00";
                    mainContext.beginPath();
                    mainContext.arc(e.x - xOffset, e.y - yOffset, 5, 0, 2 * Math.PI);
                    mainContext.stroke();
                });
            }
        }catch(e){}

        mainContext.strokeStyle = "#000";
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
                if(tmpObj.AIChat){
                    tmpSize = mainContext.measureText(tmpObj.AIChat);
                    tmpX = tmpObj.x - xOffset;
                    tmpY = tmpObj.y - tmpObj.scale - yOffset - 140;
                    tmpH = 47;
                    tmpW = tmpSize.width + 17;
                    mainContext.fillStyle = "rgba(0,0,0,0.2)";
                    mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
                    mainContext.fill();
                    mainContext.fillStyle = "#fff";
                    mainContext.fillText(tmpObj.AIChat, tmpX, tmpY);
                }
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
                    mainContext.fillStyle = "rgba(180, 180, 180, 0.9)";
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
                mainContext.strokeStyle = "rgba(25, 25, 25, 0)";
                ch.y -= delta / 100;
            }
        });
    }

    mainContext.globalAlpha = 1;

    // RENDER MINIMAP:
    renderMinimap(delta);

    //test code

}
// UPDATE & ANIMATE:
window.rAF = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function (callback) {
        setTimeout(callback, 1000 / 9);
    };
})();
/*
window.rAF = function (callback) {
    console.log(callback)
    return ;
    };
*/
window.onload = ()=>{
    window.requestAFrame = function(callback) {
        return ;
    };
    requestAFrame = function(callback) {
        return ;
    };
    requestAnimFrame = function(callback) {
        return ;
    };

    window.requestAnimationFrame = function(callback) {
        return ;
    };
};
let fullFPS = getEl("fullfps").checked;
getEl("fullfps").addEventListener("change", function(e){
    fullFPS = this.checked;
});
let ranbowName = getEl("ranbowname").checked;
getEl("ranbowname").addEventListener("change", function(e){
    ranbowName = this.checked;
});

const channel = new MessageChannel();
let checktime = Date.now();
channel.port1.onmessage = doUpdate;


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
    qaz();
    try{
        updateGame();
    }catch(e){
        console.error(e);
    }
    if (document.getElementById("upgradeHolder").style.display == "block") {
        document.getElementById("mainStatus").style.display = "none";
    } else {
        document.getElementById("mainStatus").style.display = "block";
    }
    const updatePlayersTime = Math.round(now - game.lastTick)
    const currentTime = Date.now();
    const timeDiff = currentTime - startTime;
    const hours = Math.floor(timeDiff / 3600000);
    const minutes = Math.floor((timeDiff % 3600000) / 60000);
    const seconds = Math.floor((timeDiff % 60000) / 1000);

    // ж јејЏеЊ–ж€ђ XX:XX:XX
    const playTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    status.innerHTML = `
            <div id="statusInfo">
              <span>
                вњ? [FPS: ${UTILS.round(fpsTimer.ltime, 10)}] вњ?<br>
                вњ? [Ping: ${window.pingTime} ms | Average: ${agping}ms] вњ? <br>
                вњ? [Mod Ping: ${modping} ms | Average: ${agmodping}ms] вњ? <br>
                вњ? [Play Time: ${playTime}] вњ?<br>
                вњ? [send: ${secPacket}/120] вњ?<br>
                вњ? [${checklist.length} | ${updatePlayersTime}] вњ?<br>
                вњ? [Anti Insta: ${antiinsta()[0]}] вњ?<br>
              </span>
            </div>
            <style>
    #mainStatus {
        position: absolute;
        padding: 10px;
        left: 50%;
        -ms-transform: translateX(-50%);
        transform: translateX(-50%);
    }
    #statusInfo {
        font-family: 'Hammersmith One';
        text-align: center;
        display: inline-block;
        width: auto;
        color: #54F0A2;
        text-shadow: 0 0 10px #6E6EFF, 0 0 20px #F000FF, 0 0 30px #85FF99;
    }
</style>
        `;
    if(fullFPS){
        channel.port2.postMessage("");
    } else {
        rAF(doUpdate);
    }
}
doUpdate();

setInterval(()=>{
    check();
});
/*
setInterval(()=>{
    check();
});
*/



prepareMenuBackground();
function pingSocketResponse() {
    const e = Date.now() - lastPing;
    window.pingTime = e;
    pinglist.push(e);
    if (pinglist.length > 9) {
        pinglist.shift();
    }
    if(LastPing == 0)LastPing = e;
    let sum = pinglist.reduce((acc, val) => acc + val, 0);
    agping = ~~(sum / pinglist.length);
    if(e > LastPing*1.1 || e > antiDashPing){
        antiDashPing = LastPing;

    }
    pingDisplay.innerText = "Ping: " + e + "В ms";
    if(e > 100){
        if(getEl("HighPingChat").checked && Date.now() - chathighpingTime > 700 && chat.list.length == 0){
            chathighpingTime = Date.now();
            textChat(getEl("highpingchat").value, {"{ping}" : e});
        }

    }
    LastPing = e;
}
let Ss;


let changeDays = {};
window.debug = function () {
    wbe = 1;
    my.waitHit = 0;
    my.rotate = 0;
    my.autoAim = false;
    instaC.isTrue = false;
    player.lockDir = false;
    lastPing = Date.now();
    traps.inTrap = false;
    itemSprites = [];
    objSprites = [];
    caninsta = true;
    placeVisible = [];
    gameObjectSprites = {};
    attackTime = Date.now();
};

window.CG = function() {
    WS.close();
    console.log("close")
};
// The original wrote this assignment with no terminating semicolon, and the
// next non-comment token in the file was the "(" of a leftover Tampermonkey
// boilerplate IIFE. JavaScript therefore read the two as one expression --
//     window.CG = function () { WS.close(); ... }(function () {...})()
// -- and *called* the function on load, with WS still undefined. The empty
// boilerplate that caused it is dropped and the statement is terminated.
}

// DOMContentLoaded is not enough: the client below reads window.config on
// its first pass, and the game bundle publishes that when *it* runs, which
// can be well after the DOM is parsed. Wait for the game itself.
function __sakunaStart(waited) {
    waited = waited || 0;
    if (window.config && document.body) {
        __sakunaBootSafely();
        return;
    }
    if (waited > 30000) {
        console.error("[sakuna] the game never published window.config; not starting");
        return;
    }
    setTimeout(function () { __sakunaStart(waited + 50); }, 50);
}
__sakunaStart();

// If the boot throws partway, the game keeps running and the mod simply is
// not there -- which looks exactly like the script not being installed. Say
// so instead of failing silently.
function __sakunaBootSafely() {
    try {
        __sakunaBoot();
    } catch (e) {
        console.error("[sakuna] the mod failed to start:", e);
        throw e;
    }
}
