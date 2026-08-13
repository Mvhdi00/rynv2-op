(function() {
    'use strict';

    // Your code here...
})();// ==UserScript==
// @name          Balthazar priv
// @match         *://*.moomoo.io/*
// @author        none
// @icon          https://i.pinimg.com/736x/f9/be/a1/f9bea15b45243d5b85a7f48e568c6c6a.jpg
// @description   depicted with a scythe.
// @grant         none
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// @run-at       document-start
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

    function suppressWarningBanner() {
        if (typeof document == "undefined" || typeof document.createElement != "function") return;
        const WARNING = "userscript-warning";
        function plant() {
            const root = document.body || document.documentElement;
            if (!root || typeof root.appendChild != "function") return null;
            let mine = document.getElementById(WARNING);
            if (mine && mine.getAttribute("data-guard") !== "1") {
                if (mine.parentNode) mine.parentNode.removeChild(mine);
                mine = null;
            }
            if (mine) {
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

    const TURNSTILE_SITEKEY = "0x4AAAAAAAMYHI96GFiJzMmp";
    const TURNSTILE_API = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    const GAME_GIVES_UP = 16000;
    const entryStats = { renders: 0, holds: 0 };
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

        function ownHost() {
            const root = document.body || document.documentElement;
            if (!root) return null;
            box = document.createElement("div");
            box.id = "moo-turnstile-fallback";
            box.style.cssText = ["position:fixed", "right:12px", "bottom:12px", "z-index:2147483000",
                "background:rgba(0,0,0,.35)", "padding:6px", "border-radius:6px"].join(";");
            const target = document.createElement("div");
            target.style.cssText = "width:300px;height:65px";
            box.appendChild(target);
            root.appendChild(box);
            return target;
        }

        function render() {
            if (rendered || !window.turnstile || typeof window.turnstile.render != "function") return;
            const page = document.getElementById("turnstileWidget");
            if (page && page.childElementCount > 0) return;
            if (Date.now() - started < GAME_GIVES_UP) return;
            const where = page && page.offsetParent !== null ? page : ownHost();
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
                console.info("[EXP] the game stopped trying to render its Turnstile widget, so one was "
                    + "rendered " + (where === page ? "into the page's own widget"
                                                    : "bottom-right") + ". Solve it and ENTER GAME will work.");
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
            const page = document.getElementById("turnstileWidget");
            if (box && page && page.childElementCount > 0 && box.parentNode) {
                box.parentNode.removeChild(box);
                box = null;
            }
            if (haveToken()) {
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

    try { suppressWarningBanner(); } catch (e) {}
    try { if (window.MOO_ENTRY_GUARD !== false) guardEntry(token, function(t) { captchaToken = t; }); } catch (e) {}

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
        _internals: { buildTables, tag, hexToBytes, HEADER_LEN, MODE_SECURE, states }
    };
}
)();

const UNPATCH = (function () {
    "use strict";

    const hasWin = typeof window != "undefined";
    const hasDoc = typeof document != "undefined";

    const log = {
        handshake: false,
        framed: 0,
        translatedIn: 0,
        dropped: [],
        unframeable: 0,
        shims: [],
        placeholders: [],
        urlFixes: 0,
        errors: []
    };
    function noteShim(name) { if (log.shims.indexOf(name) === -1) log.shims.push(name); }

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
    const STRAGGLERS = { "f": "9", "a": "9", "d": "F", "G": "z", "13c": "c", "ch": "6", "pp": "0", "33": "9" };

    const OLD_TO_NEW_INV = {};
    Object.keys(OLD_TO_NEW_OUT).forEach(k => { OLD_TO_NEW_INV[OLD_TO_NEW_OUT[k]] = k; });

    const CURRENT_OUT = EXP._internals.C2S || ["M","D","9","e","F","z","H","K","L","N","b","P","Q","c","6","S","0"];

    const ONLY_OLD = ["sp", "ch", "33", "pp", "rmd", "13c", "10", "11", "12", "14"];
    const ONLY_NEW = ["M", "D", "e", "z", "b", "K", "L", "N", "S", "H", "Q", "P"];

    let generation = null;

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

    function outName(name) {
        noteOutgoing(name);
        if (generation === "old" && Object.prototype.hasOwnProperty.call(OLD_TO_NEW_OUT, name))
            return OLD_TO_NEW_OUT[name];
        if (Object.prototype.hasOwnProperty.call(STRAGGLERS, name) && CURRENT_OUT.indexOf(name) === -1)
            return STRAGGLERS[name];
        return name;
    }
    function inName(name) {
        if (generation === "old" && Object.prototype.hasOwnProperty.call(NEW_TO_OLD_IN, name))
            return NEW_TO_OLD_IN[name];
        return name;
    }
    function outNameToMod(name) {
        if (generation === "old" && Object.prototype.hasOwnProperty.call(OLD_TO_NEW_INV, name))
            return OLD_TO_NEW_INV[name];
        return name;
    }

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

    function transmit(sock, data) {
        const bytes = toBytes(data);
        if (!bytes) return EXP.nativeSend.call(sock, data);
        if (!EXP.isSecure(sock)) return EXP.nativeSend.call(sock, bytes);
        log.handshake = true;
        if (isAlreadyFramed(sock, bytes)) {
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
        } catch (e) {   }
        log.unframeable++;
        console.warn("[unpatch] dropped an unframeable buffer (" + bytes.length + " bytes)");
    }

    const shimSend = WebSocket.prototype.send;
    let inModHook = false;

    function trampoline(data) {
        const current = WebSocket.prototype.send;
        if (typeof current === "function" && current !== shimSend && !inModHook) {
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

    const passthrough = function (data) { return transmit(this, data); };
    ["nsend", "oldSend", "staticSend", "originalSend", "realSend"].forEach(function (alias) {
        try {
            Object.defineProperty(WebSocket.prototype, alias, {
                configurable: true,
                get: function () { return passthrough; },
                set: function () {   }
            });
        } catch (e) {}
    });

    let forceMod = false;
    try { forceMod = hasWin && window.UNPATCH_CLIENT === true; } catch (e) {}
    if (forceMod) noteShim("client-replacement mode");

    const USERSCRIPT_FRAME = /(?:moz-extension|chrome-extension|safari-web-extension|safari-extension):\/\/|userscript\.html|\bGM_info\b/;
    function fromUserscript() {
        if (forceMod) return true;
        try {
            const s = new Error().stack;
            return typeof s == "string" && USERSCRIPT_FRAME.test(s);
        } catch (e) { return false; }
    }

    const hasOnMessage = new WeakSet();
    const wrapped = new WeakSet();
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
                            if (isGame) return fn.call(this, ev);
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

    define("unsafeWindow", hasWin ? window : undefined);

    const PREFIX = "unpatch.gm:";
    const memory = {};
    function store() {
        try { return hasWin && window.localStorage ? window.localStorage : null; }
        catch (e) { return null; }
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
    define("GM_registerMenuCommand", function () {   });
    define("GM_notification", function (opts) {
        console.info("[unpatch] mod notification:", opts && opts.text ? opts.text : opts);
    });
    define("GM_info", { script: { name: "unpatched mod", version: "0" }, scriptHandler: "MooUnpatcher" });
    define("GM", {
        getValue: function (k, d) { return Promise.resolve(gmGet(k, d)); },
        setValue: function (k, v) { return Promise.resolve(gmSet(k, v)); },
        deleteValue: function (k) { return Promise.resolve(gmDelete(k)); },
        listValues: function () { return Promise.resolve(gmList()); },
        setClipboard: function (t) { try { return navigator.clipboard.writeText(String(t)); } catch (e) {} },
        info: { script: { name: "unpatched mod", version: "0" }, scriptHandler: "MooUnpatcher" }
    });

    let modBooting = false, tookOver = false;
    const pageLoops = [], modLoops = [];
    if (forceMod && hasWin && typeof window.requestAnimationFrame == "function"
        && window.UNPATCH_KEEP_GAME_RENDER !== true) {
        const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = function (fn) {
            if (typeof fn != "function") return raf(fn);
            if (pageLoops.indexOf(fn) !== -1) {
                if (tookOver) return 0;
                return raf(fn);
            }
            if (modLoops.indexOf(fn) === -1) {
                let mine = modBooting;
                if (!mine) {
                    try {
                        const st = new Error().stack;
                        mine = typeof st == "string" && USERSCRIPT_FRAME.test(st);
                    } catch (e) {}
                }
                const into = mine ? modLoops : pageLoops;
                if (into.length < 64) into.push(fn);
                if (!tookOver && modLoops.length && pageLoops.length) {
                    tookOver = true;
                    console.info("[unpatch] the mod brought its own game loop, so the bundle's "
                        + "renderer is being stopped -- otherwise it paints over the mod every frame. "
                        + "Set window.UNPATCH_KEEP_GAME_RENDER = true to leave it running.");
                }
            }
            return raf(fn);
        };
    }

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
        } catch (e) {   }
    }

    const seenSockets = [];
    let ctor = hasWin ? window.WebSocket : undefined;

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
        if (!isGameSocket(text)) return url;
        const tok = EXP.token();
        if (!tok) return url;
        const encoded = encodeURIComponent(tok);
        const found = /[?&]token=([^&]*)/.exec(text);
        if (found) {
            let decoded = found[1];
            try { decoded = decodeURIComponent(found[1]); } catch (e) {}
            if (decoded.indexOf("cf:") === 0) return text;
            log.urlFixes++;
            console.info("[unpatch] replaced a stale connect token on " + text.split("?")[0]);
            return text.replace(/([?&]token=)[^&]*/, "$1" + encoded);
        }
        log.urlFixes++;
        console.info("[unpatch] added the Turnstile token to " + text.split("?")[0]);
        return text + (text.indexOf("?") === -1 ? "?" : "&") + "token=" + encoded;
    }

    let inside = 0;
    function shield(fn) {
        const Shielded = function (url, protocols) {
            inside++;
            try {
                return protocols === undefined ? new fn(url) : new fn(url, protocols);
            } finally { inside--; }
        };
        try { Shielded.prototype = fn.prototype; } catch (e) {}
        ["CONNECTING", "OPEN", "CLOSING", "CLOSED"].forEach(function (k) {
            try { Shielded[k] = fn[k]; } catch (e) {}
        });
        try { Object.defineProperty(Shielded, "name", { value: fn.name, configurable: true }); } catch (e) {}
        Shielded.toString = function () { return Function.prototype.toString.call(fn); };
        return Shielded;
    }

    if (hasWin && typeof ctor == "function") {
        const inner = ctor;
        const Wrapped = function (url, protocols) {
            const fixed = fixUrl(url);
            if (inside === 0 && typeof ctor == "function" && ctor !== Wrapped) {
                return protocols === undefined ? new ctor(fixed) : new ctor(fixed, protocols);
            }
            const s = protocols === undefined ? new inner(fixed) : new inner(fixed, protocols);
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
                set: function (v) { ctor = typeof v == "function" ? shield(v) : v; }
            });
            noteShim("WebSocket kept assignable");
        } catch (e) {
            console.warn("[unpatch] could not pin window.WebSocket", e);
        }
    }

    const DIAGNOSES = [
        [/\b(unsafeWindow|GM_\w+|GM)\b is not defined/,
         function (m) {
             return "\"" + m[1] + "\" is a userscript-manager API that does not exist under \"@grant none\". "
                  + "The unpatcher shims it -- make sure it is ordered ABOVE the mod.";
         }],
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

    function report() {
        let entry = { turnstileRenders: 0, entryPressesHeld: 0 };
        try { if (typeof EXP.entryStats == "function") entry = EXP.entryStats(); } catch (e) {}
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
            turnstileRenders: entry.turnstileRenders,
            entryPressesHeld: entry.entryPressesHeld,
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
        modBooted: function () { modBooting = true; },
        goneIds: GONE_IDS,
        sockets: seenSockets,
        maps: { OLD_TO_NEW_OUT: OLD_TO_NEW_OUT, NEW_TO_OLD_IN: NEW_TO_OLD_IN, STRAGGLERS: STRAGGLERS }
    };
    try { if (hasWin) window.unpatch = api; } catch (e) {}
    return api;
}
)();

console.info("%c[unpatch]%c active - transport, environment shims and boot diagnostics installed."
    + " Run unpatch.report() to see what it did.",
    "color:#8ecc51;font-weight:bold", "color:inherit");

function __repairedBoot() {
    try { UNPATCH.modBooted(); } catch (e) {}
//<!--
// == Code Obfuscation ==
$("#foodDisplay, #woodDisplay, #stoneDisplay, #scoreDisplay, #allianceButton, #killCounter, #chatButton, #storeButton, #nameInput, #leaderboard").css({
  "background-color": "rgba(0, 0, 0, 0.6)",
  "box-shadow": "0 0 10px 5px rgba(0, 0, 0, 0.6)",
  "text-align": "center",
  transition: "transform 0.3s ease, box-shadow 0.3s ease",
  "border-radius": "12px",
  border: "2px solid #333"
});
    // ANTI ALTCHA
let altcha = document.getElementById("altcha");
let checkbox = document.getElementById("altcha_checkbox");
let enterGame = document.getElementById("enterGame");
let verifying = false;
let token = undefined;

if (enterGame) enterGame.innerHTML = "Verifying...";
let antiAltcha = setInterval(() => {
    if (!altcha) altcha = document.getElementById("altcha"), verifying = false
    if (!checkbox) checkbox = document.getElementById('altcha_checkbox'), verifying = false
    if (token !== undefined) {
        enterGame.innerHTML = "Enter Game";
        clearInterval(antiAltcha);
    }
    if (enterGame.classList.contains("disabled")) {
        if (verifying) return
        verifying = true;
        altcha.style.display = "none";
        checkbox.click();
        setTimeout(()=>{
            verifying = false;
            setTimeout(()=>{
                if (enterGame.classList.contains("disabled")) {
                    window.location.reload();
                }
            }, 5000);
        }, 1000);
    } else enterGame.innerHTML = "Enter Game";
    /*
    if (token !== undefined) {
        enterGame.classList.remove("disabled");
        enterGame.innerHTML = "Enter Game";
        clearInterval(antiAltcha);
    }
    */
}, 1000);

window.addEventListener("load", () => {
    if (!altcha) return
    altcha.addEventListener("statechange", getToken);
});

function getToken(e) { // FOR BOTS(BROKEN)
    var t;
    if (((t = e == null ? undefined : e.detail) == null ? undefined : t.state) === "verified") {
        token = e.detail.payload; // OMG I FINALLY KNOW THAT TOKEN DOESNT NEED TO BE CHANGE
    }
}

const PACKET_MAP = {

    "33": "9",
    // "7": "K",
    "ch": "6",
    "pp": "0",
    "13c": "c",


    "f": "9",
    "a": "9",
    "d": "F",
    "G": "z"
}

let originalSend = WebSocket.prototype.send;

WebSocket.prototype.send = new Proxy(originalSend, {
    apply: ((target, websocket, argsList) => {
        let decoded = msgpack.decode(new Uint8Array(argsList[0]));

        if (PACKET_MAP.hasOwnProperty(decoded[0])) {
            decoded[0] = PACKET_MAP[decoded[0]];
        }

        return target.apply(websocket, [msgpack.encode(decoded)]);
    })
});
$("#mapDisplay").css({
  "background-color": "rgba(0, 0, 0, 0.6)",
  transition: "transform 0.3s ease, box-shadow 0.3s ease",
  "border-radius": "12px",
  "box-shadow": "0 0 10px 5px rgba(0, 0, 0, 0.6)",
  border: "2px solid #333"
});
function addHoverEffect(_0x230262) {
  $(_0x230262).hover(function () {
    $(this).css({
      transform: "scale(1.05)",
      "box-shadow": "0 0 15px rgba(0, 0, 0, 0.8)"
    });
  }, function () {
    $(this).css({
      transform: "scale(1)",
      "box-shadow": "0 0 10px 5px rgba(0, 0, 0, 0.6)"
    });
  });
}
addHoverEffect("#foodDisplay");
addHoverEffect("#woodDisplay");
addHoverEffect("#stoneDisplay");
addHoverEffect("#scoreDisplay");
addHoverEffect("#allianceButton");
addHoverEffect("#killCounter");
addHoverEffect("#chatButton");
addHoverEffect("#storeButton");
addHoverEffect("#nameInput");
addHoverEffect("#leaderboard");
addHoverEffect("#mapDisplay");
(function () {
  'use strict';

  const _0x3b67ad = "\n        @import url('https://fonts.googleapis.com/css2?family=Exo:wght@400;700&display=swap');\n\n        #balthazar-menu {\n            position: fixed;\n            top: 50%;\n            left: 50%;\n            transform: translate(-50%, -50%) scale(0); /* Start hidden with scale effect */\n            width: 90%;\n            max-width: 600px;\n            background: rgba(20, 20, 20, 0.95);\n            color: #e0e0e0;\n            font-family: 'Exo', sans-serif;\n            border-radius: 20px;\n            box-shadow: 0 0 30px rgba(255, 0, 255, 0.8);\n            overflow-y: auto;\n            padding: 30px;\n            z-index: 10000;\n            transition: transform 0.5s ease-in-out, background-color 0.5s ease-in-out;\n            backdrop-filter: blur(15px);\n            border: 1px solid #8e24aa;\n        }\n\n        #balthazar-menu.show {\n            transform: translate(-50%, -50%) scale(1); /* Scale to full size */\n        }\n\n        #balthazar-menu::before {\n            content: '';\n            position: absolute;\n            top: 0;\n            left: 0;\n            width: 100%;\n            height: 100%;\n            background: radial-gradient(circle, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.8) 100%);\n            opacity: 0.3;\n            pointer-events: none;\n            z-index: -1;\n        }\n\n        #balthazar-menu h1 {\n            font-size: 2.5em;\n            color: #8e24aa; /* Neon purple color */\n            margin-bottom: 20px;\n            text-align: center;\n            cursor: default;\n            text-shadow: 0 0 20px rgba(142, 36, 170, 0.8);\n            letter-spacing: 2px;\n            position: relative;\n        }\n\n        #balthazar-menu .section {\n            display: flex;\n            justify-content: space-between;\n            align-items: center;\n            margin-bottom: 20px;\n            padding: 15px;\n            border-radius: 15px;\n            background: rgba(142, 36, 170, 0.15);\n            transition: background 0.3s ease, transform 0.3s ease;\n        }\n\n        #balthazar-menu .section:hover {\n            background: rgba(142, 36, 170, 0.25);\n            transform: scale(1.02);\n        }\n\n        #balthazar-menu .section label {\n            font-size: 1.2em;\n            color: #e0e0e0;\n            width: 60%;\n            cursor: default;\n        }\n\n        #balthazar-menu .section button.switch-btn {\n            font-size: 1.1em;\n            color: #e0e0e0;\n            background: #8e24aa;\n            border: none;\n            border-radius: 12px;\n            cursor: pointer;\n            transition: background-color 0.3s ease, color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease;\n            padding: 10px;\n            width: 30%;\n            text-align: center;\n            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);\n        }\n\n        #balthazar-menu .section button.switch-btn.disabled {\n            background: #555;\n            color: #cccccc;\n            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);\n            transform: scale(0.95);\n            opacity: 0.7;\n        }\n\n        #balthazar-menu .section button.switch-btn:active {\n            background: #6a1b9a;\n            transform: scale(0.9);\n        }\n\n        #balthazar-menu select.Cselect {\n            background: #444;\n            color: #e0e0e0;\n            border: 1px solid #8e24aa;\n            border-radius: 12px;\n            padding: 12px;\n            font-size: 1.2em;\n            cursor: pointer;\n            transition: background-color 0.3s ease, color 0.3s ease;\n            width: calc(100% - 20px);\n            margin-top: 5px;\n        }\n\n        #balthazar-menu select.Cselect:hover {\n            background: #555;\n        }\n\n        #balthazar-menu::-webkit-scrollbar {\n            width: 12px;\n        }\n\n        #balthazar-menu::-webkit-scrollbar-thumb {\n            background: #8e24aa;\n            border-radius: 10px;\n        }\n\n        #balthazar-menu::-webkit-scrollbar-track {\n            background: #2e2e2e;\n        }\n\n        #suggestions-box {\n            position: fixed;\n            top: 50%;\n            left: calc(50% + 620px); /* Adjusted for better alignment */\n            transform: translateY(-50%) scale(0); /* Start hidden with scale effect */\n            width: 250px;\n            background: rgba(30, 30, 30, 0.95);\n            color: #e0e0e0;\n            font-family: 'Exo', sans-serif;\n            border-radius: 15px;\n            box-shadow: 0 0 20px rgba(255, 0, 255, 0.6);\n            padding: 20px;\n            z-index: 10000;\n            transition: transform 0.5s ease-in-out, background-color 0.5s ease-in-out;\n            backdrop-filter: blur(10px);\n            border: 1px solid #8e24aa;\n        }\n\n        #suggestions-box.show {\n            transform: translateY(-50%) scale(1); /* Scale to full size */\n        }\n\n        #suggestions-box h2 {\n            font-size: 1.8em;\n            color: #8e24aa;\n            margin-bottom: 15px;\n            text-align: center;\n            text-shadow: 0 0 15px rgba(142, 36, 170, 0.8);\n        }\n\n        #suggestions-box p {\n            font-size: 1.1em;\n            margin-bottom: 10px;\n        }\n\n        #suggestions-box button {\n            background: #8e24aa;\n            color: #e0e0e0;\n            border: none;\n            border-radius: 10px;\n            padding: 10px;\n            cursor: pointer;\n            transition: background 0.3s ease;\n            font-size: 1em;\n            text-align: center;\n            width: 100%;\n        }\n\n        #suggestions-box button:hover {\n            background: #c2185b;\n        }\n\n        #balthazar-menu .question-mark {\n            position: absolute;\n            top: 15px;\n            right: 15px;\n            width: 32px;\n            height: 32px;\n            background: #8e24aa;\n            color: #fff;\n            border-radius: 50%;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            cursor: pointer;\n            font-size: 1.5em;\n            text-shadow: 0 0 10px rgba(255, 255, 255, 0.8);\n            transition: background 0.3s ease;\n        }\n\n        #balthazar-menu .question-mark:hover {\n            background: #c2185b;\n        }\n    ";
  const _0x5a42e2 = document.createElement("style");
  _0x5a42e2.innerHTML = _0x3b67ad;
  document.head.appendChild(_0x5a42e2);
  const _0x4693a1 = "\n        <div id=\"balthazar-menu\">\n            <div class=\"question-mark\">?</div>\n            <h1>BALTHAZAR</h1>\n            <div class=\"section\">\n                <label for=\"weaponGrind\">Weapon Grind:</label>\n                <button id=\"weaponGrindBtn\" class=\"switch-btn\">Disabled</button>\n                <input type=\"checkbox\" id=\"weaponGrind\" class=\"checkB\" style=\"display: none;\" />\n            </div>\n            <div class=\"section\">\n                <label for=\"antipush\">AntiPush:</label>\n                <button id=\"antipushBtn\" class=\"switch-btn\">Enabled</button>\n                <input type=\"checkbox\" id=\"antipush\" class=\"checkB\" checked style=\"display: none;\" />\n            </div>\n            <div class=\"section\">\n                <label for=\"healingBeta\">2v1 Heal:</label>\n                <button id=\"healingBetaBtn\" class=\"switch-btn\">Enabled</button>\n                <input type=\"checkbox\" id=\"healingBeta\" class=\"checkB\" checked style=\"display: none;\" />\n            </div>\n            <div class=\"section\">\n                <label for=\"antiBullType\">AntiBull:</label>\n                <select id=\"antiBullType\" class=\"Cselect\">\n                    <option value=\"noab\">Off</option>\n                    <option value=\"abreload\">Manual</option>\n                    <option value=\"abalway\" selected>Automatic</option>\n                </select>\n            </div>\n        </div>\n        <div id=\"suggestions-box\">\n            <h2>Suggestions</h2>\n            <p id=\"ai-suggestion\">Consider enabling Auto Save for better progress tracking.</p>\n            <button id=\"suggestion-action\">More Details</button>\n        </div>\n    ";
  const _0x3717d3 = document.createElement("div");
  _0x3717d3.innerHTML = _0x4693a1;
  document.body.appendChild(_0x3717d3);
  function _0x2d94bf() {
    const _0x2c7160 = document.getElementById("balthazar-menu");
    const _0x30adee = document.getElementById("suggestions-box");
    if (_0x2c7160.classList.contains("show")) {
      _0x2c7160.classList.remove("show");
      _0x30adee.classList.remove("show");
    } else {
      _0x2c7160.classList.add("show");
      _0x30adee.classList.add("show");
    }
  }
  function _0x6a1ff9(_0x5b96f1, _0x194ba2) {
    const _0x112b8b = document.getElementById(_0x194ba2);
    const _0x288633 = document.getElementById(_0x5b96f1);
    if (_0x112b8b.checked) {
      _0x288633.textContent = "Enabled";
      _0x288633.classList.remove("disabled");
    } else {
      _0x288633.textContent = "Disabled";
      _0x288633.classList.add("disabled");
    }
  }
  function _0x2b4349() {
    const _0x4bf5e9 = ["Consider checking out the latest updates!", "Enable more features for enhanced performance.", "Adjust settings for optimal results.", "Explore new functionalities for better experience.", "Don't forget to save your preferences!"];
    const _0x5dd0d2 = document.getElementById("ai-suggestion");
    _0x5dd0d2.textContent = _0x4bf5e9[Math.floor(Math.random() * _0x4bf5e9.length)];
  }
  document.addEventListener("keydown", _0x325d25 => {
    if (_0x325d25.key === "Escape") {
      _0x2d94bf();
    }
  });
  document.getElementById("weaponGrindBtn").addEventListener("click", () => {
    const _0x49561b = document.getElementById("weaponGrind");
    _0x49561b.checked = !_0x49561b.checked;
    _0x6a1ff9("weaponGrindBtn", "weaponGrind");
  });
  document.getElementById("antipushBtn").addEventListener("click", () => {
    const _0x3cdeca = document.getElementById("antipush");
    _0x3cdeca.checked = !_0x3cdeca.checked;
    _0x6a1ff9("antipushBtn", "antipush");
  });
  document.getElementById("healingBetaBtn").addEventListener("click", () => {
    const _0x2bb813 = document.getElementById("healingBeta");
    _0x2bb813.checked = !_0x2bb813.checked;
    _0x6a1ff9("healingBetaBtn", "healingBeta");
  });
  document.querySelector("#balthazar-menu .question-mark").addEventListener("click", () => {
    const _0x1f0daf = document.getElementById("suggestions-box");
    if (_0x1f0daf.classList.contains("show")) {
      _0x1f0daf.classList.remove("show");
    } else {
      _0x1f0daf.classList.add("show");
    }
  });
  document.getElementById("suggestion-action").addEventListener("click", () => {
    alert("Further actions or details can be added here.");
  });
  _0x6a1ff9("weaponGrindBtn", "weaponGrind");
  _0x6a1ff9("antipushBtn", "antipush");
  _0x6a1ff9("healingBetaBtn", "healingBeta");
  setInterval(_0x2b4349, 10000);
})();
document.getElementById("mainMenu").style.backgroundSize = "cover";
document.getElementById("mainMenu").style.backgroundPosition = "center";
document.getElementById("mainMenu").style.width = "100%";
document.getElementById("mainMenu").style.height = "100vh";
function getEl(_0x370e34) {
  return document.getElementById(_0x370e34);
}
(function (_0x5691ca) {
  let _0x7a9446 = document.createElement("link");
  _0x7a9446.rel = "stylesheet";
  _0x7a9446.href = "https://fonts.googleapis.com/css?family=Ubuntu:700";
  _0x7a9446.type = "text/css";
  document.body.append(_0x7a9446);
  let _0x260d10 = document.createElement("script");
  _0x260d10.src = "https://rawgit.com/kawanet/msgpack-lite/master/dist/msgpack.min.js";
  document.body.append(_0x260d10);
  window.oncontextmenu = function () {
    return false;
  };
  let _0x4ee004 = window.config;
  _0x4ee004.clientSendRate = 9;
  _0x4ee004.serverUpdateRate = 9;
  _0x4ee004.deathFadeout = 0;
  _0x4ee004.playerCapacity = 9999;
  _0x4ee004.isSandbox = window.location.hostname == "sandbox.moomoo.io";
  _0x4ee004.skinColors = ["#bf8f54", "#cbb091", "#896c4b", "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3", "#8bc373"];
  _0x4ee004.weaponVariants = [{
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
  _0x4ee004.anotherVisual = true;
  _0x4ee004.useWebGl = false;
  _0x4ee004.resetRender = true;
  function _0x2f2745(_0x362f31) {
    return new Promise(_0x14fb6b => {
      setTimeout(() => {
        _0x14fb6b();
      }, _0x362f31);
    });
  }
  let _0x393461 = [];
  let _0x54ffe3;
  if (typeof Storage !== "undefined") {
    _0x54ffe3 = true;
  }
  function _0x490421(_0x35960a, _0x380bd0) {
    if (_0x54ffe3) {
      localStorage.setItem(_0x35960a, _0x380bd0);
    }
  }
  function _0x2021e5(_0xa6be90) {
    if (_0x54ffe3) {
      localStorage.removeItem(_0xa6be90);
    }
  }
  function _0x54ec98(_0x4f9170) {
    if (_0x54ffe3) {
      return localStorage.getItem(_0x4f9170);
    }
    return null;
  }
  let _0x46e68f = function (_0x2e2f0f, _0x945e22) {
    try {
      let _0x3fc3b2 = JSON.parse(_0x54ec98(_0x2e2f0f));
      if (typeof _0x3fc3b2 === "object") {
        return _0x945e22;
      } else {
        return _0x3fc3b2;
      }
    } catch (_0x1bf6bf) {
      alert("dieskid");
      return _0x945e22;
    }
  };
  function _0x4fd6bd() {
    return {
      help: {
        desc: "Show Commands",
        action: function (_0x1f0b59) {
          for (let _0x4f03bb in _0x4ce0aa) {
            _0x5b6587("/" + _0x4f03bb, _0x4ce0aa[_0x4f03bb].desc, "Dark orchid", 1);
          }
        }
      },
      clear: {
        desc: "Clear Chats",
        action: function (_0x3c827c) {
          _0x1aecae();
        }
      },
      debug: {
        desc: "Debug Mod For Development",
        action: function (_0x50b232) {
          _0x2fcfa9(_0x547655);
          _0x5b6587("Debug", "Done", "#99ee99", 1);
        }
      },
      play: {
        desc: "Play Music ( /play [link] )",
        action: function (_0x2b8b23) {
          let _0x2f7f8d = _0x2b8b23.split(" ");
          if (_0x2f7f8d[1]) {
            let _0x46bb9f = new Audio(_0x2f7f8d[1]);
            _0x46bb9f.play();
          } else {
            _0x5b6587("Warn", "Enter Link ( /play [link] )", "#99ee99", 1);
          }
        }
      },
      bye: {
        desc: "Leave Game",
        action: function (_0x5e9d90) {
          window.leave();
        }
      }
    };
  }
  function _0x20b14e() {
    return {
      killChat: true,
      alwaysRev: true,
      autoBuy: true,
      autoBuyEquip: true,
      autoPush: false,
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
      autoRespawn: true
    };
  }
  ;
  let _0x4ce0aa = _0x4fd6bd();
  let _0x4f1036 = _0x20b14e();
  window.removeConfigs = function () {
    for (let _0x221a1f in _0x4f1036) {
      _0x2021e5(_0x221a1f, _0x4f1036[_0x221a1f]);
    }
  };
  for (let _0x41f6e9 in _0x4f1036) {
    _0x4f1036[_0x41f6e9] = _0x46e68f(_0x41f6e9, _0x4f1036[_0x41f6e9]);
  }
  let _0x56b6ee = document.createElement("style");
  _0x56b6ee.type = "text/css";
  _0x56b6ee.appendChild(document.createTextNode("\n.actionBarItem {\n    width: 50px; /* Smaller width */\n    height: 50px; /* Smaller height */\n    margin-right: 6px; /* Margin for spacing */\n    background-color: rgba(0, 0, 0, 0.6); /* Dark semi-transparent background */\n    border: 2px solid #333; /* Dark border for contrast */\n    border-radius: 0; /* No rounded corners */\n    display: inline-block;\n    cursor: pointer;\n    pointer-events: all;\n    box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.5); /* Subtle shadow */\n    transition: transform 0.3s ease, box-shadow 0.3s ease; /* Smooth transitions */\n    position: relative; /* For positioning any icons or text inside */\n    overflow: hidden; /* To ensure child elements fit within the box */\n}\n\n/* Hover Effects */\n.actionBarItem:hover {\n    transform: scale(1.05); /* Slightly enlarge on hover */\n    box-shadow: 0px 6px 12px rgba(0, 0, 0, 0.6); /* Enhanced shadow on hover */\n    background-color: rgba(0, 0, 0, 0.7); /* Darker background on hover */\n    border: 2px solid #555; /* Slightly lighter border on hover */\n}\n\n/* Active State */\n.actionBarItem:active {\n    transform: scale(0.95); /* Slightly reduce size on click */\n    box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.4); /* Reduced shadow on click */\n    background-color: rgba(0, 0, 0, 0.8); /* Even darker background when active */\n    border: 2px solid #555; /* Maintain lighter border on active */\n}\n\n/* Icon inside action bar item */\n.actionBarItem .icon {\n    width: 30px; /* Adjust width for smaller size */\n    height: 30px; /* Adjust height for smaller size */\n    position: absolute;\n    top: 50%;\n    left: 50%;\n    transform: translate(-50%, -50%); /* Center icon within the button */\n}\n\n/* Text inside action bar item (if needed) */\n.actionBarItem .text {\n    position: absolute;\n    bottom: 6px; /* Adjust based on icon size */\n    width: 100%;\n    text-align: center;\n    color: #fff; /* Text color */\n    font-size: 12px; /* Adjust font size for smaller size */\n}\n\n\n\n#ageBarContainer {\n    text-align: center;\n    display: flex;\n    flex-direction: column;\n    justify-content: center;\n}\n#ageText {\n    width: 100%;\n    margin-bottom: 10px;\n    text-align: center;\n    color: #fff;\n    font-size: 24px;\n}\n#ageBar {\n    background-color: rgba(0, 0, 0, 0.6);\n    border: 2px solid #333;\n    border-radius: 12px;\n    width: 340px;\n    height: 14px;\n    padding: 0;\n    margin: 0 auto; /* Center align the bar */\n    position: relative;\n    box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.6);\n}\n#ageBarBody {\n    background-color: #4caf50; /* Green color for the fill */\n    border-radius: 12px; /* Rounded corners */\n    width: 0%;\n    height: 100%;\n    transition: width 0.5s ease; /* Smooth transition for width */\n}\n\n"));
  document.head.appendChild(_0x56b6ee);
  window.changeMenu = function () {};
  window.debug = function () {};
  window.wasdMode = function () {};
  window.startGrind = function () {};
  window.connectFillBots = function () {};
  window.destroyFillBots = function () {};
  window.tryConnectBots = function () {};
  window.destroyBots = function () {};
  window.resBuild = function () {};
  window.toggleBotsCircle = function () {};
  window.toggleVisual = function () {};
  window.prepareUI = function () {};
  window.leave = function () {};
  window.ping = 0;
  class _0x531c85 {
    constructor(_0x2c142d, _0x140519) {
      this.inGame = false;
      this.lover = _0x2c142d + _0x140519;
      this.baby = "ae86";
      this.isBlack = 0;
      this.webSocket = undefined;
      this.checkBaby = function () {
        if (this.baby !== "ae86") {
          this.isBlack++;
        } else {
          this.isBlack--;
        }
        if (this.isBlack >= 1) {
          return "bl4cky";
        }
        return "noting for you";
      };
      this.x2 = 0;
      this.y2 = 0;
      this.chat = "Imagine playing this badass game XDDDDD";
      this.summon = function (_0x4b886f) {
        this.x2 = _0x4b886f.x;
        this.y2 = _0x4b886f.y;
        this.chat = _0x4b886f.name + " ur so bad XDDDD";
      };
      this.commands = function (_0x5e3568) {
        if (_0x5e3568 == "rv3link") {
          window.open("https://florr.io/");
        }
        if (_0x5e3568 == "woah") {
          window.open("https://www.youtube.com/watch?v=MO0AGukzj6M");
        }
        return _0x5e3568;
      };
      this.dayte = "11yearold";
      this.memeganoob = "69yearold";
      this.startDayteSpawn = function (_0x4cf8a6) {
        let _0x451736 = setInterval(() => {
          this.x2 = _0x4cf8a6.x + 20;
          this.y2 = _0x4cf8a6.y - 20;
          this.chat = "UR SO BAD LOL";
          if (_0x4cf8a6.name == "ae86") {
            this.chat = "omg ae86 go run";
            setTimeout(() => {
              this.inGame = false;
              clearInterval(_0x451736);
            }, 1000);
          }
        }, 1234);
      };
      this.AntiChickenModV69420 = function (_0x530eba) {
        return "!c!dc user " + _0x530eba.name;
      };
    }
  }
  ;
  class _0x18ff6c {
    constructor(_0x442259) {
      this.element = _0x442259;
    }
    add(_0x57ee1b) {
      if (!this.element) {
        return undefined;
      }
      this.element.innerHTML += _0x57ee1b;
    }
    newLine(_0x14376e) {
      let _0x36aee3 = "<br>";
      if (_0x14376e > 0) {
        _0x36aee3 = "";
        for (let _0x27b317 = 0; _0x27b317 < _0x14376e; _0x27b317++) {
          _0x36aee3 += "<br>";
        }
      }
      this.add(_0x36aee3);
    }
    checkBox(_0x2272bc) {
      let _0x1adeb6 = "<input type = \"checkbox\"";
      if (_0x2272bc.id) {
        _0x1adeb6 += " id = " + _0x2272bc.id;
      }
      if (_0x2272bc.style) {
        _0x1adeb6 += " style = " + _0x2272bc.style.replaceAll(" ", "");
      }
      if (_0x2272bc.class) {
        _0x1adeb6 += " class = " + _0x2272bc.class;
      }
      if (_0x2272bc.checked) {
        _0x1adeb6 += " checked";
      }
      if (_0x2272bc.onclick) {
        _0x1adeb6 += " onclick = " + _0x2272bc.onclick;
      }
      _0x1adeb6 += ">";
      this.add(_0x1adeb6);
    }
    text(_0x158cf0) {
      let _0x298d7b = "<input type = \"text\"";
      if (_0x158cf0.id) {
        _0x298d7b += " id = " + _0x158cf0.id;
      }
      if (_0x158cf0.style) {
        _0x298d7b += " style = " + _0x158cf0.style.replaceAll(" ", "");
      }
      if (_0x158cf0.class) {
        _0x298d7b += " class = " + _0x158cf0.class;
      }
      if (_0x158cf0.size) {
        _0x298d7b += " size = " + _0x158cf0.size;
      }
      if (_0x158cf0.maxLength) {
        _0x298d7b += " maxLength = " + _0x158cf0.maxLength;
      }
      if (_0x158cf0.value) {
        _0x298d7b += " value = " + _0x158cf0.value;
      }
      if (_0x158cf0.placeHolder) {
        _0x298d7b += " placeHolder = " + _0x158cf0.placeHolder.replaceAll(" ", "&nbsp;");
      }
      _0x298d7b += ">";
      this.add(_0x298d7b);
    }
    select(_0x9a1e7d) {
      let _0x33c94e = "<select";
      if (_0x9a1e7d.id) {
        _0x33c94e += " id = " + _0x9a1e7d.id;
      }
      if (_0x9a1e7d.style) {
        _0x33c94e += " style = " + _0x9a1e7d.style.replaceAll(" ", "");
      }
      if (_0x9a1e7d.class) {
        _0x33c94e += " class = " + _0x9a1e7d.class;
      }
      _0x33c94e += ">";
      for (let _0x584cfa in _0x9a1e7d.option) {
        _0x33c94e += "<option value = " + _0x9a1e7d.option[_0x584cfa].id;
        if (_0x9a1e7d.option[_0x584cfa].selected) {
          _0x33c94e += " selected";
        }
        _0x33c94e += ">" + _0x584cfa + "</option>";
      }
      _0x33c94e += "</select>";
      this.add(_0x33c94e);
    }
    button(_0x2bc7cb) {
      let _0x52947b = "<button";
      if (_0x2bc7cb.id) {
        _0x52947b += " id = " + _0x2bc7cb.id;
      }
      if (_0x2bc7cb.style) {
        _0x52947b += " style = " + _0x2bc7cb.style.replaceAll(" ", "");
      }
      if (_0x2bc7cb.class) {
        _0x52947b += " class = " + _0x2bc7cb.class;
      }
      if (_0x2bc7cb.onclick) {
        _0x52947b += " onclick = " + _0x2bc7cb.onclick;
      }
      _0x52947b += ">";
      if (_0x2bc7cb.innerHTML) {
        _0x52947b += _0x2bc7cb.innerHTML;
      }
      _0x52947b += "</button>";
      this.add(_0x52947b);
    }
    selectMenu(_0x50cf3f) {
      let _0x5be7ec = "<select";
      if (!_0x50cf3f.id) {
        alert("please put id skid");
        return;
      }
      window[_0x50cf3f.id + "Func"] = function () {};
      if (_0x50cf3f.id) {
        _0x5be7ec += " id = " + _0x50cf3f.id;
      }
      if (_0x50cf3f.style) {
        _0x5be7ec += " style = " + _0x50cf3f.style.replaceAll(" ", "");
      }
      if (_0x50cf3f.class) {
        _0x5be7ec += " class = " + _0x50cf3f.class;
      }
      _0x5be7ec += " onchange = window." + (_0x50cf3f.id + "Func") + "()";
      _0x5be7ec += ">";
      let _0x3a231f;
      let _0xf1b412 = 0;
      for (let _0x1810d5 in _0x50cf3f.menu) {
        _0x5be7ec += "<option value = " + ("option_" + _0x1810d5) + " id = " + ("O_" + _0x1810d5);
        if (_0x50cf3f.menu[_0x1810d5]) {
          _0x5be7ec += " checked";
        }
        _0x5be7ec += " style = \"color: " + (_0x50cf3f.menu[_0x1810d5] ? "#000" : "#fff") + "; background: " + (_0x50cf3f.menu[_0x1810d5] ? "#8ecc51" : "#cc5151") + ";\">" + _0x1810d5 + "</option>";
        _0xf1b412++;
      }
      _0x5be7ec += "</select>";
      this.add(_0x5be7ec);
      _0xf1b412 = 0;
      for (let _0x5d53c4 in _0x50cf3f.menu) {
        window[_0x5d53c4 + "Func"] = function () {
          _0x50cf3f.menu[_0x5d53c4] = getEl("check_" + _0x5d53c4).checked ? true : false;
          _0x490421(_0x5d53c4, _0x50cf3f.menu[_0x5d53c4]);
          getEl("O_" + _0x5d53c4).style.color = _0x50cf3f.menu[_0x5d53c4] ? "#000" : "#fff";
          getEl("O_" + _0x5d53c4).style.background = _0x50cf3f.menu[_0x5d53c4] ? "#8ecc51" : "#cc5151";
        };
        this.checkBox({
          id: "check_" + _0x5d53c4,
          style: "display: " + (_0xf1b412 == 0 ? "inline-block" : "none") + ";",
          class: "checkB",
          onclick: "window." + (_0x5d53c4 + "Func") + "()",
          checked: _0x50cf3f.menu[_0x5d53c4]
        });
        _0xf1b412++;
      }
      _0x3a231f = "check_" + getEl(_0x50cf3f.id).value.split("_")[1];
      window[_0x50cf3f.id + "Func"] = function () {
        getEl(_0x3a231f).style.display = "none";
        _0x3a231f = "check_" + getEl(_0x50cf3f.id).value.split("_")[1];
        getEl(_0x3a231f).style.display = "inline-block";
      };
    }
  }
  ;
  class _0x532003 {
    constructor() {
      this.element = null;
      this.action = null;
      this.divElement = null;
      this.startDiv = function (_0x357658, _0x40324a) {
        let _0x5a9e02 = document.createElement("div");
        if (_0x357658.id) {
          _0x5a9e02.id = _0x357658.id;
        }
        if (_0x357658.style) {
          _0x5a9e02.style = _0x357658.style;
        }
        if (_0x357658.class) {
          _0x5a9e02.className = _0x357658.class;
        }
        this.element.appendChild(_0x5a9e02);
        this.divElement = _0x5a9e02;
        let _0x209491 = new _0x18ff6c(_0x5a9e02);
        if (typeof _0x40324a == "function") {
          _0x40324a(_0x209491);
        }
      };
      this.addDiv = function (_0x1bb999, _0x429835) {
        let _0x318de9 = document.createElement("div");
        if (_0x1bb999.id) {
          _0x318de9.id = _0x1bb999.id;
        }
        if (_0x1bb999.style) {
          _0x318de9.style = _0x1bb999.style;
        }
        if (_0x1bb999.class) {
          _0x318de9.className = _0x1bb999.class;
        }
        if (_0x1bb999.appendID) {
          getEl(_0x1bb999.appendID).appendChild(_0x318de9);
        }
        this.divElement = _0x318de9;
        let _0x3dd75f = new _0x18ff6c(_0x318de9);
        if (typeof _0x429835 == "function") {
          _0x429835(_0x3dd75f);
        }
      };
    }
    set(_0x1be0d1) {
      this.element = getEl(_0x1be0d1);
      this.action = new _0x18ff6c(this.element);
    }
    resetHTML(_0x34457a) {
      if (_0x34457a) {
        this.element.innerHTML = "";
      } else {
        this.element.innerHTML = "";
      }
    }
    setStyle(_0x565f58) {
      this.element.style = _0x565f58;
    }
    setCSS(_0x258628) {
      this.action.add("<style>" + _0x258628 + "</style>");
    }
  }
  ;
  let _0x501bb3 = new _0x532003();
  let _0xb243ca = document.createElement("div");
  _0xb243ca.id = "menuDiv";
  document.body.appendChild(_0xb243ca);
  _0x501bb3.set("menuDiv");
  _0x501bb3.setStyle("position: absolute; left: -9999px; top: -9999px;");
  _0x501bb3.resetHTML();
  _0x501bb3.setCSS("#menuDiv { display: none; }");
  _0x501bb3.startDiv({
    id: "menuHeadLine",
    class: "menuClass"
  }, _0x52c9ab => {
    _0x52c9ab.add("");
    _0x52c9ab.button({
      id: "menuChanger",
      class: "material-icons",
      innerHTML: "sync",
      onclick: "window.changeMenu()"
    });
    _0x501bb3.addDiv({
      id: "menuButtons",
      style: "display: block; overflow-y: visible;",
      class: "menuC",
      appendID: "menuHeadLine"
    }, _0x5144c6 => {
      _0x5144c6.button({
        class: "menuB",
        innerHTML: "Debug",
        onclick: "window.debug()"
      });
    });
    _0x501bb3.addDiv({
      id: "menuMain",
      style: "display: block",
      class: "menuC",
      appendID: "menuHeadLine"
    }, _0x3c4051 => {
      _0x3c4051.button({
        class: "menuB",
        innerHTML: "Toggle Wasd Mode",
        onclick: "window.wasdMode()"
      });
      _0x3c4051.newLine();
      _0x3c4051.add("Ruby Farm:");
      _0x3c4051.checkBox({
        id: "weaponGrind",
        class: "checkB",
        onclick: "window.startGrind()"
      });
      _0x3c4051.newLine(2);
      _0x501bb3.addDiv({
        style: "font-size: 20px; color: #99ee99;",
        appendID: "menuMain"
      }, _0x33fc87 => {
        _0x33fc87.add("Settings:");
      });
      _0x3c4051.add("Push v4:");
      _0x3c4051.checkBox({
        id: "antipush",
        class: "checkB",
        checked: true
      });
      _0x3c4051.newLine();
      _0x3c4051.add("Anti heal:");
      _0x3c4051.checkBox({
        id: "healingBeta",
        class: "checkB",
        checked: true
      });
      _0x3c4051.newLine();
    });
    _0x501bb3.addDiv({
      id: "menuConfig",
      class: "menuC",
      appendID: "menuHeadLine"
    }, _0x6565c3 => {
      _0x6565c3.add("Placement Tick: ");
      _0x6565c3.text({
        id: "autoPlaceTick",
        class: "customText",
        value: "2",
        size: "2em",
        maxLength: "1"
      });
      _0x6565c3.newLine();
      _0x6565c3.add("Options: ");
      _0x6565c3.selectMenu({
        id: "configsChanger",
        class: "Cselect",
        menu: _0x4f1036
      });
      _0x6565c3.newLine();
      _0x6565c3.add("AntiBull: ");
      _0x6565c3.select({
        id: "antiBullType",
        class: "Cselect",
        option: {
          Disable: {
            id: "noab"
          },
          "When Reloaded": {
            id: "abreload"
          },
          Always: {
            id: "abalway",
            selected: true
          }
        }
      });
    });
    _0x501bb3.addDiv({
      id: "menuOther",
      class: "menuC",
      appendID: "menuHeadLine"
    }, _0x141a0e => {
      _0x141a0e.button({
        class: "menuB",
        innerHTML: "Connect Bots",
        onclick: "window.tryConnectBots()"
      });
      _0x141a0e.button({
        class: "menuB",
        innerHTML: "Disconnect Bots",
        onclick: "window.destroyBots()"
      });
      _0x141a0e.newLine();
      _0x141a0e.add("Break Objects Range: ");
      _0x141a0e.text({
        id: "breakRange",
        class: "customText",
        value: "390",
        size: "3em",
        maxLength: "4"
      });
      _0x141a0e.newLine();
      _0x141a0e.add("Render Movement: ");
      _0x141a0e.select({
        id: "predictType",
        class: "Cselect",
        option: {
          "Disable Render": {
            id: "disableRender",
            selected: true
          },
          "X/Y and 2": {
            id: "pre2"
          },
          "X/Y and 3": {
            id: "pre3"
          }
        }
      });
      _0x141a0e.newLine();
      _0x141a0e.add("Render Placers: ");
      _0x141a0e.checkBox({
        id: "placeVis",
        class: "checkB"
      });
      _0x141a0e.newLine();
      _0x141a0e.add("Bot Mode: ");
      _0x141a0e.select({
        id: "mode",
        class: "Cselect",
        option: {
          "Clear Building": {
            id: "clear",
            selected: true
          },
          Sync: {
            id: "zync"
          },
          Search: {
            id: "zearch"
          },
          "Clear Everything": {
            id: "fuckemup"
          },
          Flex: {
            id: "flex"
          }
        }
      });
      _0x141a0e.newLine();
      _0x141a0e.add("Bot Setup: ");
      _0x141a0e.select({
        id: "setup",
        class: "Cselect",
        option: {
          "Dagger Musket": {
            id: "dm",
            selected: true
          },
          "Katana Hammer": {
            id: "kh"
          },
          "Dagger Repeater-Crossbow": {
            id: "dr"
          },
          "Sword Muzket": {
            id: "zd"
          }
        }
      });
      _0x141a0e.newLine();
      _0x141a0e.button({
        class: "menuB",
        innerHTML: "Toggle Another Visual",
        onclick: "window.toggleVisual()"
      });
      _0x141a0e.newLine();
    });
  });
  function _0x3b9ad7(_0x5b9f7c) {
    let _0x57b570 = ~~(_0x5b9f7c % 3600 / 60);
    let _0xb60aa2 = ~~_0x5b9f7c % 60;
    if (_0xb60aa2 <= 9) {
      _0xb60aa2 = "0" + _0xb60aa2;
    }
    return _0x57b570 + ":" + _0xb60aa2;
  }
  let _0x1b14e4 = {
    "0:14": "https://www.youtube.com/watch?v=LsWACxHMWBI",
    "0:0": "https://www.youtube.com/watch?v=Fvblhv6Eke8&list=RDFvblhv6Eke8&start_radio=1",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": "",
    "0:0": ""
  };
  const _0x492f3d = new Audio("https://cdn.discordapp.com/attachments/1175772907931176991/1226210664393998346/Muti_Azer_Bulbul_-_Ille_de_Sen_Official_Video.mp3?ex=6623f0ac&is=66117bac&hm=c1cfee9f9083aae11297915714c4b682e0d163b603b5e7e7870d9eeae0acc464&");
  let _0x441cfa = false;
  let _0x2e8cd6 = "";
  function _0x4cf900() {
    if (!_0x441cfa) {
      _0x492f3d.play();
      _0x492f3d.ontimeupdate = function (_0x37f009) {
        let _0x2f4542 = _0x1b14e4[_0x3b9ad7(Math.round(this.currentTime | 0))];
        if (_0x2f4542 && _0x2f4542 !== _0x2e8cd6) {
          _0x2e8cd6 = _0x2f4542;
          _0x4bd292.send("6", _0x2f4542);
        }
      };
      _0x492f3d.onended = function () {
        if (_0x441cfa) {
          _0x492f3d.play();
        }
      };
      _0x441cfa = true;
    } else {
      _0x492f3d.pause();
      _0x441cfa = false;
    }
  }
  document.addEventListener("keypress", function (_0xa219e9) {
    if (_0xa219e9.key === "C") {
      _0x4cf900();
    }
  });
  let _0x255a00 = document.createElement("div");
  _0x255a00.id = "menuChatDiv";
  document.body.appendChild(_0x255a00);
  _0x501bb3.set("menuChatDiv");
  _0x501bb3.setStyle("\n\n            ");
  _0x501bb3.resetHTML();
  _0x501bb3.setCSS("\n\n            ");
  _0x501bb3.startDiv({
    id: "mChDiv",
    class: "chDiv"
  }, _0x473db4 => {
    _0x501bb3.addDiv({
      id: "mChMain",
      class: "chMainDiv",
      appendID: "mChDiv"
    }, _0x54b206 => {});
    _0x473db4.text({
      id: "mChBox",
      class: "chMainBox"
    });
  });
  let _0x5ced82 = getEl("mChMain");
  let _0x2dfbcc = getEl("mChBox");
  let _0x845539 = false;
  let _0x14c268 = 0;
  _0x2dfbcc.value = "";
  _0x2dfbcc.addEventListener("focus", () => {
    _0x845539 = true;
  });
  _0x2dfbcc.addEventListener("blur", () => {
    _0x845539 = false;
  });
  function _0x5b6587(_0x11f67c, _0x45aea4, _0x29ffff, _0x3c6bb5) {
    _0x501bb3.set("menuChatDiv");
    _0x29ffff = _0x29ffff || "white";
    let _0x45a605 = new Date();
    let _0x4304ab = _0x45a605.getMinutes();
    let _0x24144a = _0x45a605.getHours();
    let _0x2b7446 = "";
    if (!_0x3c6bb5) {
      _0x2b7446 += (_0x24144a < 10 ? "0" : "") + _0x24144a + ":" + ((_0x4304ab < 10 ? "0" : "") + _0x4304ab);
    }
    if (_0x11f67c) {
      _0x2b7446 += "" + ((!_0x3c6bb5 ? " - " : "") + _0x11f67c);
    }
    if (_0x45aea4) {
      _0x2b7446 += (_0x11f67c ? ": " : !_0x3c6bb5 ? " - " : "") + _0x45aea4 + "\n";
    }
    _0x501bb3.addDiv({
      id: "menuChDisp",
      style: "color: " + _0x29ffff,
      appendID: "mChMain"
    }, _0x233376 => {
      _0x233376.add(_0x2b7446);
    });
    _0x5ced82.scrollTop = _0x5ced82.scrollHeight;
    _0x14c268++;
  }
  function _0xc91fe1(_0x14899e, _0x308b5d, _0x500c04, _0x4db263) {
    _0x501bb3.set("menuChatDiv");
    _0x500c04 = _0x500c04 || "white";
    let _0x124dc7 = new Date();
    let _0x1ce455 = "";
    if (_0x308b5d) {
      _0x1ce455 += (_0x14899e ? ": " : !_0x4db263 ? "" : "") + _0x308b5d + "\n";
    }
    _0x501bb3.addDiv({
      id: "menuChDisp",
      style: "color: " + _0x500c04,
      appendID: "mChMain"
    }, _0x56baf4 => {
      _0x56baf4.add(_0x1ce455);
    });
    _0x5ced82.scrollTop = _0x5ced82.scrollHeight;
    _0x14c268++;
  }
  function _0x1aecae() {
    _0x5ced82.innerHTML = "";
    _0x14c268 = 0;
    _0x5b6587(null, "", "Pink", 1);
  }
  _0x1aecae();
  let _0x491d18 = 0;
  let _0x4f6678 = ["menuMain", "menuConfig", "menuOther"];
  window.changeMenu = function () {
    getEl(_0x4f6678[_0x491d18 % _0x4f6678.length]).style.display = "none";
    _0x491d18++;
    getEl(_0x4f6678[_0x491d18 % _0x4f6678.length]).style.display = "block";
  };
  let _0x242afa = document.createElement("div");
  _0x242afa.id = "status";
  getEl("gameUI").appendChild(_0x242afa);
  _0x501bb3.set("status");
  _0x501bb3.setStyle("\n            display: block;\n            position: absolute;\n            color: #ddd;\n            font: 15px HammerSmith One;\n            bottom: 215px;\n            left: 20px;\n            ");
  _0x501bb3.resetHTML();
  _0x501bb3.setCSS("\n            .sizing {\n                font-size: 15px;\n            }\n            .mod {\n                font-size: 15px;\n                display: inline-block;\n            }\n            ");
  _0x501bb3.startDiv({
    id: "uehmod",
    class: "sizing"
  }, _0x4cedbd => {
    _0x4cedbd.add("");
    _0x501bb3.addDiv({
      id: "pingFps",
      class: "mod",
      appendID: "uehmod"
    }, _0x27a317 => {
      _0x27a317.add("");
    });
    _0x4cedbd.newLine();
    _0x4cedbd.add("");
    _0x501bb3.addDiv({
      id: "packetStatus",
      class: "mod",
      appendID: "uehmod"
    }, _0x33d209 => {
      _0x33d209.add("");
    });
  });
  let _0x104338 = false;
  let _0x810ea2 = undefined;
  let _0x339ffe = undefined;
  let _0x50abc3 = false;
  let _0x54382c = 0;
  let _0x4f01e7 = 150;
  let _0x2051f8 = 1000;
  let _0xd98e59 = {
    sec: false
  };
  let _0x65cac6 = {
    tick: 0,
    tickQueue: [],
    tickBase: function (_0x407713, _0xf8c7bf) {
      if (this.tickQueue[this.tick + _0xf8c7bf]) {
        this.tickQueue[this.tick + _0xf8c7bf].push(_0x407713);
      } else {
        this.tickQueue[this.tick + _0xf8c7bf] = [_0x407713];
      }
    },
    tickRate: 1000 / _0x4ee004.serverUpdateRate,
    tickSpeed: 0,
    lastTick: performance.now()
  };
  let _0x4036e4 = [];
  let _0x34e653 = false;
  let _0x49984a = {
    last: 0,
    time: 0,
    ltime: 0
  };
  let _0x36ebb3 = undefined;
  let _0x1b0bdf = ["cc", 1, "__proto__"];
  WebSocket.prototype.nsend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (_0x39de24) {
    if (!_0x810ea2) {
      _0x810ea2 = this;
      _0x810ea2.addEventListener("message", function (_0x4480e0) {
        _0xa995fe(_0x4480e0);
      });
      _0x810ea2.addEventListener("close", _0x57c003 => {
        if (_0x57c003.code == 4001) {
          window.location.reload();
        }
      });
    }
    if (_0x810ea2 == this) {
      _0x34e653 = false;
      let _0x41cebc = new Uint8Array(_0x39de24);
      let _0x5a6c32 = window.msgpack.decode(_0x41cebc);
      let _0x17b49f = _0x5a6c32[0];
      _0x41cebc = _0x5a6c32[1];
      if (_0x17b49f == "6") {
        if (_0x41cebc[0]) {
          let _0x397732 = ["cunt", "whore", "fuck", "shit", "faggot", "nigger", "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex", "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune", "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard"];
          let _0x4a6ec8;
          _0x397732.forEach(_0x4f5e04 => {
            if (_0x41cebc[0].indexOf(_0x4f5e04) > -1) {
              _0x4a6ec8 = "";
              for (let _0x2fe227 = 0; _0x2fe227 < _0x4f5e04.length; ++_0x2fe227) {
                if (_0x2fe227 == 1) {
                  _0x4a6ec8 += String.fromCharCode(0);
                }
                _0x4a6ec8 += _0x4f5e04[_0x2fe227];
              }
              let _0xb2d567 = new RegExp(_0x4f5e04, "g");
              _0x41cebc[0] = _0x41cebc[0].replace(_0xb2d567, _0x4a6ec8);
            }
          });
          _0x41cebc[0] = _0x41cebc[0].slice(0, 30);
        }
      } else if (_0x17b49f == "L") {
        _0x41cebc[0] = _0x41cebc[0] + String.fromCharCode(0).repeat(7);
        _0x41cebc[0] = _0x41cebc[0].slice(0, 7);
      } else if (_0x17b49f == "M") {
        _0x41cebc[0].name = _0x41cebc[0].name == "" ? "unknown" : _0x41cebc[0].name;
        _0x41cebc[0].moofoll = true;
        _0x41cebc[0].skin = _0x41cebc[0].skin == 10 ? "__proto__" : _0x41cebc[0].skin;
        _0x1b0bdf = [_0x41cebc[0].name, _0x41cebc[0].moofoll, _0x41cebc[0].skin];
      } else if (_0x17b49f == "D") {
        if (_0xfd6795.lastDir == _0x41cebc[0] || [null, undefined].includes(_0x41cebc[0])) {
          _0x34e653 = true;
        } else {
          _0xfd6795.lastDir = _0x41cebc[0];
        }
      } else if (_0x17b49f == "F") {
        if (!_0x41cebc[2]) {
          _0x34e653 = true;
        } else if (![null, undefined].includes(_0x41cebc[1])) {
          _0xfd6795.lastDir = _0x41cebc[1];
        }
      } else if (_0x17b49f == "K") {
        if (!_0x41cebc[1]) {
          _0x34e653 = true;
        }
      } else if (_0x17b49f == "S") {
        _0x94d477.wait = !_0x94d477.wait;
        _0x34e653 = true;
      } else if (_0x17b49f == "f") {
        if (_0x41cebc[1]) {
          if (_0x547655.moveDir == _0x41cebc[0]) {
            _0x34e653 = true;
          }
          _0x547655.moveDir = _0x41cebc[0];
        } else {
          _0x34e653 = true;
        }
      }
      if (!_0x34e653) {
        let _0x33219c = window.msgpack.encode([_0x17b49f, _0x41cebc]);
        this.nsend(_0x33219c);
        if (!_0xd98e59.sec) {
          _0xd98e59.sec = true;
          setTimeout(() => {
            _0xd98e59.sec = false;
            _0x54382c = 0;
          }, _0x2051f8);
        }
        _0x54382c++;
      }
    } else {
      this.nsend(_0x39de24);
    }
  };
  function _0x48b469(_0xf4f07d) {
    let _0x4901d3 = Array.prototype.slice.call(arguments, 1);
    let _0x3c9237 = window.msgpack.encode([_0xf4f07d, _0x4901d3]);
    _0x810ea2.send(_0x3c9237);
  }
  function _0x5d62e2(_0x40f5d4) {
    let _0x26b23b = Array.prototype.slice.call(arguments, 1);
    let _0x3c9624 = window.msgpack.encode([_0x40f5d4, _0x26b23b]);
    _0x810ea2.nsend(_0x3c9624);
  }
  window.leave = function () {
    _0x5d62e2("kys", {
      "frvr is so bad": true,
      "sidney is too good": true,
      "dev are too weak": true
    });
  };
  let _0x4bd292 = {
    send: _0x48b469
  };
  function _0xa995fe(_0x33efc7) {
    let _0x3c44ff = new Uint8Array(_0x33efc7.data);
    let _0x24d7db = window.msgpack.decode(_0x3c44ff);
    let _0x128744 = _0x24d7db[0];
    _0x3c44ff = _0x24d7db[1];
    let _0x30a0a8 = {
      A: _0x4bd174,
      C: _0x5c30d7,
      D: _0x4af42a,
      E: _0xf0136d,
      a: _0x28f00c,
      G: _0x49407e,
      H: _0x3f3237,
      I: _0x288026,
      J: _0x4f944f,
      K: _0x1ef836,
      L: _0x1e8ce5,
      M: _0x3a3d62,
      N: _0x366792,
      O: _0x3649bc,
      P: _0x30af64,
      Q: _0x20a0ae,
      R: _0x549705,
      S: _0x59c08f,
      T: _0x3f3316,
      U: _0x1ed0e1,
      V: _0x21b8ad,
      X: _0x419a3c,
      Y: _0x4a0c8e,
      2: _0x117b83,
      3: _0x13cc6a,
      4: _0x1a0b4f,
      5: _0x2b8757,
      6: _0x33eabf,
      7: _0x57b603,
      8: _0x380f2c,
      9: _0x418722,
      0: _0x1ef610
    };
    if (_0x128744 == "io-init") {
      _0x339ffe = _0x3c44ff[0];
    } else if (_0x30a0a8[_0x128744]) {
      _0x30a0a8[_0x128744].apply(undefined, _0x3c44ff);
    }
  }
  Math.lerpAngle = function (_0x2a90d1, _0x5ea1a3, _0x6717b8) {
    let _0x3954fc = Math.abs(_0x5ea1a3 - _0x2a90d1);
    if (_0x3954fc > Math.PI) {
      if (_0x2a90d1 > _0x5ea1a3) {
        _0x5ea1a3 += Math.PI * 2;
      } else {
        _0x2a90d1 += Math.PI * 2;
      }
    }
    let _0x16c6e8 = _0x5ea1a3 + (_0x2a90d1 - _0x5ea1a3) * _0x6717b8;
    if (_0x16c6e8 >= 0 && _0x16c6e8 <= Math.PI * 2) {
      return _0x16c6e8;
    }
    return _0x16c6e8 % (Math.PI * 2);
  };
  CanvasRenderingContext2D.prototype.roundRect = function (_0x1cd556, _0x3af60b, _0xfcbdc4, _0x53e7da, _0x2b0a74) {
    if (_0xfcbdc4 < _0x2b0a74 * 2) {
      _0x2b0a74 = _0xfcbdc4 / 2;
    }
    if (_0x53e7da < _0x2b0a74 * 2) {
      _0x2b0a74 = _0x53e7da / 2;
    }
    if (_0x2b0a74 < 0) {
      _0x2b0a74 = 0;
    }
    this.beginPath();
    this.moveTo(_0x1cd556 + _0x2b0a74, _0x3af60b);
    this.arcTo(_0x1cd556 + _0xfcbdc4, _0x3af60b, _0x1cd556 + _0xfcbdc4, _0x3af60b + _0x53e7da, _0x2b0a74);
    this.arcTo(_0x1cd556 + _0xfcbdc4, _0x3af60b + _0x53e7da, _0x1cd556, _0x3af60b + _0x53e7da, _0x2b0a74);
    this.arcTo(_0x1cd556, _0x3af60b + _0x53e7da, _0x1cd556, _0x3af60b, _0x2b0a74);
    this.arcTo(_0x1cd556, _0x3af60b, _0x1cd556 + _0xfcbdc4, _0x3af60b, _0x2b0a74);
    this.closePath();
    return this;
  };
  function _0x301c5d() {
    _0x461765 = {};
    _0x4bd292.send("e");
  }
  let _0x17122a = [];
  let _0x1718bc = {
    tick: 0,
    delay: 0,
    time: [],
    manage: []
  };
  let _0x201ec2 = [];
  let _0x3c40e0 = [];
  let _0x44504d = [];
  let _0x3c8e13 = [];
  let _0x389d16 = [];
  let _0x4e7d72 = [];
  let _0x51a14e = [];
  let _0x65aa4d = [];
  let _0x206e14 = [];
  let _0x46c306 = [];
  let _0x547655;
  let _0x2f7569;
  let _0x3a3fd7;
  let _0x5b81e2 = [];
  let _0x1fd060 = [];
  let _0x151041 = [];
  let _0xfd6795 = {
    reloaded: false,
    waitHit: 0,
    autoAim: false,
    revAim: false,
    ageInsta: true,
    reSync: false,
    bullTick: 0,
    anti0Tick: 0,
    antiSync: false,
    safePrimary: function (_0x833628) {
      return [0, 8].includes(_0x833628.primaryIndex);
    },
    safeSecondary: function (_0x114ada) {
      return [10, 11, 14].includes(_0x114ada.secondaryIndex);
    },
    lastDir: 0,
    autoPush: false,
    pushData: {}
  };
  function _0x28234e(_0x5c54de, _0x32ee22) {
    return _0x5c54de.find(_0x51c626 => _0x51c626.id == _0x32ee22);
  }
  function _0x403e6a(_0x4e9455, _0x31818c) {
    return _0x4e9455.find(_0x54e31c => _0x54e31c.sid == _0x31818c);
  }
  function _0x24d0c1(_0x46ec7e) {
    return _0x28234e(_0x3c40e0, _0x46ec7e);
  }
  function _0x56d1d9(_0x11462a) {
    return _0x403e6a(_0x3c40e0, _0x11462a);
  }
  function _0x20cdd9(_0x10c3d7) {
    return _0x403e6a(_0x201ec2, _0x10c3d7);
  }
  function _0x4510e0(_0x23b82e) {
    return _0x403e6a(_0x4e7d72, _0x23b82e);
  }
  function _0x5b7968(_0x219fa9) {
    return _0x403e6a(_0x4e7d72, _0x219fa9);
  }
  let _0x5ba86b = getEl("gameName");
  if (_0x5ba86b) _0x5ba86b.innerText = "";
  let _0x2c43b3 = getEl("adCard");
  if (_0x2c43b3) _0x2c43b3.remove();
  let _0x24c29f = getEl("promoImgHolder");
  if (_0x24c29f) _0x24c29f.remove();
  let _0x5f2a45 = getEl("chatButton");
  if (_0x5f2a45) _0x5f2a45.remove();
  let _0x4851e7 = getEl("gameCanvas");
  let _0x3b5929 = _0x4851e7.getContext("2d");
  let _0x72ac7a = getEl("mapDisplay");
  let _0x36d201 = _0x72ac7a.getContext("2d");
  _0x72ac7a.width = 300;
  _0x72ac7a.height = 300;
  let _0x479724 = getEl("storeMenu");
  let _0x566274 = getEl("storeHolder");
  let _0x3dfc1d = getEl("upgradeHolder");
  let _0x4ffa3e = getEl("upgradeCounter");
  let _0x53cc64 = getEl("chatBox");
  _0x53cc64.autocomplete = "off";
  if (_0x53cc64) _0x53cc64.style.textAlign = "center";
  _0x53cc64.style.width = "18em";
  let _0x19c9b3 = getEl("chatHolder");
  let _0x318ea5 = getEl("actionBar");
  let _0x3a3428 = getEl("leaderboardData");
  let _0x59526a = getEl("itemInfoHolder");
  let _0x41b2d0 = getEl("menuCardHolder");
  let _0x31b061 = getEl("mainMenu");
  getEl("mainMenu").style.backgroundImage = "url('https://images-ext-1.discordapp.net/external/ULtFU7PgkI89yeasmgjcQ3h1BpsBwBilk5iA53SbrnQ/%3Fsize%3D4096/https/cdn.discordapp.com/banners/1174304881817964616/a_b1760555b7e4528d07dc057458229cfc.gif?width=992&height=496')";
  let _0x2b6d62 = getEl("diedText");
  let _0x3c4e85;
  let _0x3e9fd6;
  let _0x3d89ad = _0x4ee004.maxScreenWidth;
  let _0x47e786 = _0x4ee004.maxScreenHeight;
  let _0x56b695 = 1;
  let _0x4819c7;
  let _0x24c027;
  let _0x3336fe = performance.now();
  let _0xe46d09;
  let _0x5319f3;
  let _0xc22f37;
  let _0x11ec7b = 0;
  let _0x4bdd25 = 0;
  let _0x436875 = getEl("allianceMenu");
  let _0x16c383 = 1;
  let _0x1a6e50 = 0;
  let _0x2d70c1 = "#525252";
  let _0x32af65 = "#3d3f42";
  let _0x438f6d = 5.5;
  let _0x434568 = true;
  let _0x461765 = {};
  let _0x151b3b = {
    87: [0, -1],
    38: [0, -1],
    83: [0, 1],
    40: [0, 1],
    65: [-1, 0],
    37: [-1, 0],
    68: [1, 0],
    39: [1, 0]
  };
  let _0x537751 = 0;
  let _0x37b6ae = false;
  let _0x2126c4 = {};
  let _0x4e1a4e = {
    place: 0,
    placeSpawnPads: 0
  };
  let _0x259299;
  let _0x288e4f = [];
  let _0x1bf024 = true;
  window.onblur = function () {
    _0x1bf024 = false;
  };
  window.onfocus = function () {
    _0x1bf024 = true;
    if (_0x547655 && _0x547655.alive) {}
  };
  let _0x22e55e = {
    avg: 0,
    max: 0,
    min: 0,
    delay: 0
  };
  function _0x1ef610() {
    let _0x2e53b5 = window.pingTime;
    const _0x3dc335 = document.getElementById("pingDisplay");
    if (_0x3dc335) _0x3dc335.innerText = "1" + _0x2e53b5 + "ms";
    if (_0x2e53b5 > _0x22e55e.max || isNaN(_0x22e55e.max)) {
      _0x22e55e.max = _0x2e53b5;
    }
    if (_0x2e53b5 < _0x22e55e.min || isNaN(_0x22e55e.min)) {
      _0x22e55e.min = _0x2e53b5;
    }
  }
  let _0x4fcde6 = [];
  class _0x4d2239 {
    constructor() {
      let _0x495f6e = Math.abs;
      let _0x5b5304 = Math.cos;
      let _0xd5276a = Math.sin;
      let _0x1fea30 = Math.pow;
      let _0x435680 = Math.sqrt;
      let _0x5d4bba = Math.atan2;
      let _0x1a4c4d = Math.PI;
      let _0xa82153 = this;
      this.round = function (_0x1edf96, _0x4a62d4) {
        return Math.round(_0x1edf96 * _0x4a62d4) / _0x4a62d4;
      };
      this.toRad = function (_0x1c67dc) {
        return _0x1c67dc * (_0x1a4c4d / 180);
      };
      this.toAng = function (_0x6baa12) {
        return _0x6baa12 / (_0x1a4c4d / 180);
      };
      this.randInt = function (_0x2acaba, _0x574999) {
        return Math.floor(Math.random() * (_0x574999 - _0x2acaba + 1)) + _0x2acaba;
      };
      this.randFloat = function (_0x4ac6a8, _0x26711a) {
        return Math.random() * (_0x26711a - _0x4ac6a8 + 1) + _0x4ac6a8;
      };
      this.lerp = function (_0x276290, _0xe0b665, _0x449be6) {
        return _0x276290 + (_0xe0b665 - _0x276290) * _0x449be6;
      };
      this.decel = function (_0x5db73e, _0x1fa011) {
        if (_0x5db73e > 0) {
          _0x5db73e = Math.max(0, _0x5db73e - _0x1fa011);
        } else if (_0x5db73e < 0) {
          _0x5db73e = Math.min(0, _0x5db73e + _0x1fa011);
        }
        return _0x5db73e;
      };
      this.getDistance = function (_0x18aa42, _0x414439, _0x3b3bef, _0x517558) {
        return _0x435680((_0x3b3bef -= _0x18aa42) * _0x3b3bef + (_0x517558 -= _0x414439) * _0x517558);
      };
      this.getDist = function (_0x4ffa9d, _0x405934, _0x1858ce, _0x4a4587) {
        let _0x408417 = {
          x: _0x1858ce == 0 ? _0x4ffa9d.x : _0x1858ce == 1 ? _0x4ffa9d.x1 : _0x1858ce == 2 ? _0x4ffa9d.x2 : _0x1858ce == 3 && _0x4ffa9d.x3,
          y: _0x1858ce == 0 ? _0x4ffa9d.y : _0x1858ce == 1 ? _0x4ffa9d.y1 : _0x1858ce == 2 ? _0x4ffa9d.y2 : _0x1858ce == 3 && _0x4ffa9d.y3
        };
        let _0x4d5cd2 = {
          x: _0x4a4587 == 0 ? _0x405934.x : _0x4a4587 == 1 ? _0x405934.x1 : _0x4a4587 == 2 ? _0x405934.x2 : _0x4a4587 == 3 && _0x405934.x3,
          y: _0x4a4587 == 0 ? _0x405934.y : _0x4a4587 == 1 ? _0x405934.y1 : _0x4a4587 == 2 ? _0x405934.y2 : _0x4a4587 == 3 && _0x405934.y3
        };
        return _0x435680((_0x4d5cd2.x -= _0x408417.x) * _0x4d5cd2.x + (_0x4d5cd2.y -= _0x408417.y) * _0x4d5cd2.y);
      };
      this.getDirection = function (_0x16603b, _0x408cdb, _0x82fb38, _0x481de3) {
        return _0x5d4bba(_0x408cdb - _0x481de3, _0x16603b - _0x82fb38);
      };
      this.getDirect = function (_0x1be0a1, _0x35ad5b, _0x26cfe4, _0x57b825) {
        let _0x42da75 = {
          x: _0x26cfe4 == 0 ? _0x1be0a1.x : _0x26cfe4 == 1 ? _0x1be0a1.x1 : _0x26cfe4 == 2 ? _0x1be0a1.x2 : _0x26cfe4 == 3 && _0x1be0a1.x3,
          y: _0x26cfe4 == 0 ? _0x1be0a1.y : _0x26cfe4 == 1 ? _0x1be0a1.y1 : _0x26cfe4 == 2 ? _0x1be0a1.y2 : _0x26cfe4 == 3 && _0x1be0a1.y3
        };
        let _0x12ee97 = {
          x: _0x57b825 == 0 ? _0x35ad5b.x : _0x57b825 == 1 ? _0x35ad5b.x1 : _0x57b825 == 2 ? _0x35ad5b.x2 : _0x57b825 == 3 && _0x35ad5b.x3,
          y: _0x57b825 == 0 ? _0x35ad5b.y : _0x57b825 == 1 ? _0x35ad5b.y1 : _0x57b825 == 2 ? _0x35ad5b.y2 : _0x57b825 == 3 && _0x35ad5b.y3
        };
        return _0x5d4bba(_0x42da75.y - _0x12ee97.y, _0x42da75.x - _0x12ee97.x);
      };
      this.getAngleDist = function (_0x39fcc1, _0x472e35) {
        let _0x1720e8 = _0x495f6e(_0x472e35 - _0x39fcc1) % (_0x1a4c4d * 2);
        if (_0x1720e8 > _0x1a4c4d) {
          return _0x1a4c4d * 2 - _0x1720e8;
        } else {
          return _0x1720e8;
        }
      };
      this.isNumber = function (_0x453b43) {
        return typeof _0x453b43 == "number" && !isNaN(_0x453b43) && isFinite(_0x453b43);
      };
      this.isString = function (_0xb0e8db) {
        return _0xb0e8db && typeof _0xb0e8db == "string";
      };
      this.kFormat = function (_0x350e67) {
        if (_0x350e67 > 999) {
          return (_0x350e67 / 1000).toFixed(1) + "k";
        } else {
          return _0x350e67;
        }
      };
      this.sFormat = function (_0x4f807c) {
        let _0x1d1c38 = [{
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
        let _0x1ce9aa = _0x1d1c38.find(_0x3a1fd6 => _0x4f807c >= _0x3a1fd6.num);
        if (!_0x1ce9aa) {
          return _0x4f807c;
        }
        return (_0x4f807c / _0x1ce9aa.num).toFixed(1) + _0x1ce9aa.string;
      };
      this.capitalizeFirst = function (_0x91bdb4) {
        return _0x91bdb4.charAt(0).toUpperCase() + _0x91bdb4.slice(1);
      };
      this.fixTo = function (_0xa9686, _0x43fac7) {
        return parseFloat(_0xa9686.toFixed(_0x43fac7));
      };
      this.sortByPoints = function (_0x382c6c, _0x88d983) {
        return parseFloat(_0x88d983.points) - parseFloat(_0x382c6c.points);
      };
      this.lineInRect = function (_0x1be003, _0x3c934e, _0x4cca9e, _0x4a77f7, _0x5e9914, _0x408976, _0xee92fc, _0x2c660e) {
        let _0x2beac6 = _0x5e9914;
        let _0x43bf7b = _0xee92fc;
        if (_0x5e9914 > _0xee92fc) {
          _0x2beac6 = _0xee92fc;
          _0x43bf7b = _0x5e9914;
        }
        if (_0x43bf7b > _0x4cca9e) {
          _0x43bf7b = _0x4cca9e;
        }
        if (_0x2beac6 < _0x1be003) {
          _0x2beac6 = _0x1be003;
        }
        if (_0x2beac6 > _0x43bf7b) {
          return false;
        }
        let _0x452fa4 = _0x408976;
        let _0x255dd6 = _0x2c660e;
        let _0x2e4a66 = _0xee92fc - _0x5e9914;
        if (Math.abs(_0x2e4a66) > 1e-7) {
          let _0x1e8ace = (_0x2c660e - _0x408976) / _0x2e4a66;
          let _0x20003e = _0x408976 - _0x1e8ace * _0x5e9914;
          _0x452fa4 = _0x1e8ace * _0x2beac6 + _0x20003e;
          _0x255dd6 = _0x1e8ace * _0x43bf7b + _0x20003e;
        }
        if (_0x452fa4 > _0x255dd6) {
          let _0x59cdc8 = _0x255dd6;
          _0x255dd6 = _0x452fa4;
          _0x452fa4 = _0x59cdc8;
        }
        if (_0x255dd6 > _0x4a77f7) {
          _0x255dd6 = _0x4a77f7;
        }
        if (_0x452fa4 < _0x3c934e) {
          _0x452fa4 = _0x3c934e;
        }
        if (_0x452fa4 > _0x255dd6) {
          return false;
        }
        return true;
      };
      this.containsPoint = function (_0x4277ca, _0x501e96, _0x186625) {
        let _0x3f73b8 = _0x4277ca.getBoundingClientRect();
        let _0x5769e6 = _0x3f73b8.left + window.scrollX;
        let _0xd835c5 = _0x3f73b8.top + window.scrollY;
        let _0x1a5b17 = _0x3f73b8.width;
        let _0x1863f2 = _0x3f73b8.height;
        let _0x5ec0cf = _0x501e96 > _0x5769e6 && _0x501e96 < _0x5769e6 + _0x1a5b17;
        let _0xb60809 = _0x186625 > _0xd835c5 && _0x186625 < _0xd835c5 + _0x1863f2;
        return _0x5ec0cf && _0xb60809;
      };
      this.mousifyTouchEvent = function (_0x17dbcd) {
        let _0x4b92a1 = _0x17dbcd.changedTouches[0];
        _0x17dbcd.screenX = _0x4b92a1.screenX;
        _0x17dbcd.screenY = _0x4b92a1.screenY;
        _0x17dbcd.clientX = _0x4b92a1.clientX;
        _0x17dbcd.clientY = _0x4b92a1.clientY;
        _0x17dbcd.pageX = _0x4b92a1.pageX;
        _0x17dbcd.pageY = _0x4b92a1.pageY;
      };
      this.hookTouchEvents = function (_0x4d0e6d, _0xbbbaa0) {
        let _0x3f36a1 = !_0xbbbaa0;
        let _0x150096 = false;
        let _0x35f289 = false;
        _0x4d0e6d.addEventListener("touchstart", this.checkTrusted(_0xe96196), _0x35f289);
        _0x4d0e6d.addEventListener("touchmove", this.checkTrusted(_0x32bc09), _0x35f289);
        _0x4d0e6d.addEventListener("touchend", this.checkTrusted(_0x45ad94), _0x35f289);
        _0x4d0e6d.addEventListener("touchcancel", this.checkTrusted(_0x45ad94), _0x35f289);
        _0x4d0e6d.addEventListener("touchleave", this.checkTrusted(_0x45ad94), _0x35f289);
        function _0xe96196(_0x3c0d6c) {
          _0xa82153.mousifyTouchEvent(_0x3c0d6c);
          window.setUsingTouch(true);
          if (_0x3f36a1) {
            _0x3c0d6c.preventDefault();
            _0x3c0d6c.stopPropagation();
          }
          if (_0x4d0e6d.onmouseover) {
            _0x4d0e6d.onmouseover(_0x3c0d6c);
          }
          _0x150096 = true;
        }
        function _0x32bc09(_0x15f236) {
          _0xa82153.mousifyTouchEvent(_0x15f236);
          window.setUsingTouch(true);
          if (_0x3f36a1) {
            _0x15f236.preventDefault();
            _0x15f236.stopPropagation();
          }
          if (_0xa82153.containsPoint(_0x4d0e6d, _0x15f236.pageX, _0x15f236.pageY)) {
            if (!_0x150096) {
              if (_0x4d0e6d.onmouseover) {
                _0x4d0e6d.onmouseover(_0x15f236);
              }
              _0x150096 = true;
            }
          } else if (_0x150096) {
            if (_0x4d0e6d.onmouseout) {
              _0x4d0e6d.onmouseout(_0x15f236);
            }
            _0x150096 = false;
          }
        }
        function _0x45ad94(_0x1124f2) {
          _0xa82153.mousifyTouchEvent(_0x1124f2);
          window.setUsingTouch(true);
          if (_0x3f36a1) {
            _0x1124f2.preventDefault();
            _0x1124f2.stopPropagation();
          }
          if (_0x150096) {
            if (_0x4d0e6d.onclick) {
              _0x4d0e6d.onclick(_0x1124f2);
            }
            if (_0x4d0e6d.onmouseout) {
              _0x4d0e6d.onmouseout(_0x1124f2);
            }
            _0x150096 = false;
          }
        }
      };
      this.removeAllChildren = function (_0x376c63) {
        while (_0x376c63.hasChildNodes()) {
          _0x376c63.removeChild(_0x376c63.lastChild);
        }
      };
      this.generateElement = function (_0x3cb6ad) {
        let _0x195314 = document.createElement(_0x3cb6ad.tag || "div");
        function _0x4ae830(_0x5613a4, _0x2ca673) {
          if (_0x3cb6ad[_0x5613a4]) {
            _0x195314[_0x2ca673] = _0x3cb6ad[_0x5613a4];
          }
        }
        _0x4ae830("text", "textContent");
        _0x4ae830("html", "innerHTML");
        _0x4ae830("class", "className");
        for (let _0x2faf82 in _0x3cb6ad) {
          switch (_0x2faf82) {
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
          _0x195314[_0x2faf82] = _0x3cb6ad[_0x2faf82];
        }
        if (_0x195314.onclick) {
          _0x195314.onclick = this.checkTrusted(_0x195314.onclick);
        }
        if (_0x195314.onmouseover) {
          _0x195314.onmouseover = this.checkTrusted(_0x195314.onmouseover);
        }
        if (_0x195314.onmouseout) {
          _0x195314.onmouseout = this.checkTrusted(_0x195314.onmouseout);
        }
        if (_0x3cb6ad.style) {
          _0x195314.style.cssText = _0x3cb6ad.style;
        }
        if (_0x3cb6ad.hookTouch) {
          this.hookTouchEvents(_0x195314);
        }
        if (_0x3cb6ad.parent) {
          _0x3cb6ad.parent.appendChild(_0x195314);
        }
        if (_0x3cb6ad.children) {
          for (let _0x1c295f = 0; _0x1c295f < _0x3cb6ad.children.length; _0x1c295f++) {
            _0x195314.appendChild(_0x3cb6ad.children[_0x1c295f]);
          }
        }
        return _0x195314;
      };
      this.checkTrusted = function (_0x26cf6c) {
        return function (_0x4dd7f8) {
          if (_0x4dd7f8 && _0x4dd7f8 instanceof Event && (_0x4dd7f8 && typeof _0x4dd7f8.isTrusted == "boolean" ? _0x4dd7f8.isTrusted : true)) {
            _0x26cf6c(_0x4dd7f8);
          } else {}
        };
      };
      this.randomString = function (_0x3b2969) {
        let _0x5e4894 = "";
        let _0x52d1db = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let _0x28c18d = 0; _0x28c18d < _0x3b2969; _0x28c18d++) {
          _0x5e4894 += _0x52d1db.charAt(Math.floor(Math.random() * _0x52d1db.length));
        }
        return _0x5e4894;
      };
      this.countInArray = function (_0x1938ea, _0x4c9207) {
        let _0xc4ee8b = 0;
        for (let _0x225b53 = 0; _0x225b53 < _0x1938ea.length; _0x225b53++) {
          if (_0x1938ea[_0x225b53] === _0x4c9207) {
            _0xc4ee8b++;
          }
        }
        return _0xc4ee8b;
      };
      this.hexToRgb = function (_0x47c0e1) {
        return _0x47c0e1.slice(1).match(/.{1,2}/g).map(_0x3c5605 => parseInt(_0x3c5605, 16));
      };
      this.getRgb = function (_0x382040, _0x1f3bc0, _0x19b1d1) {
        return [_0x382040 / 255, _0x1f3bc0 / 255, _0x19b1d1 / 255].join(", ");
      };
    }
  }
  ;
  class _0x43ddbf {
    constructor() {
      this.init = function (_0x53765a, _0x5acccb, _0x46e154, _0x35e97d, _0x2ad2e2, _0x1e1aaf, _0x2c3fdc) {
        this.x = _0x53765a;
        this.y = _0x5acccb;
        this.color = _0x2c3fdc;
        this.scale = _0x46e154;
        this.startScale = this.scale;
        this.maxScale = _0x46e154 * 1.5;
        this.scaleSpeed = 0.7;
        this.speed = _0x35e97d;
        this.life = _0x2ad2e2;
        this.text = _0x1e1aaf;
        this.acc = 1;
        this.alpha = 0;
        this.maxLife = _0x2ad2e2;
        this.ranX = _0x1c7eec.randFloat(-1, 1);
      };
      this.update = function (_0x20f92c) {
        if (this.life) {
          this.life -= _0x20f92c;
          if (_0x4ee004.anotherVisual) {
            this.y -= this.speed * _0x20f92c * this.acc;
            this.acc -= _0x20f92c / (this.maxLife / 2.5);
            if (this.life <= 200) {
              if (this.alpha > 0) {
                this.alpha = Math.max(0, this.alpha - _0x20f92c / 300);
              }
            } else if (this.alpha < 1) {
              this.alpha = Math.min(1, this.alpha + _0x20f92c / 100);
            }
            this.x += this.ranX;
          } else {
            this.y -= this.speed * _0x20f92c;
          }
          this.scale += this.scaleSpeed * _0x20f92c;
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
      this.render = function (_0x44ed7d, _0x28d1c8, _0x51375c) {
        _0x44ed7d.lineWidth = 10;
        _0x44ed7d.fillStyle = this.color;
        _0x44ed7d.font = this.scale + "px " + (_0x4ee004.anotherVisual ? "Hammersmith One" : "Hammersmith One");
        if (_0x4ee004.anotherVisual) {
          _0x44ed7d.globalAlpha = this.alpha;
          _0x44ed7d.strokeStyle = _0x32af65;
          _0x44ed7d.strokeText(this.text, this.x - _0x28d1c8, this.y - _0x51375c);
        }
        _0x44ed7d.fillText(this.text, this.x - _0x28d1c8, this.y - _0x51375c);
        _0x44ed7d.globalAlpha = 1;
      };
    }
  }
  ;
  class _0x289032 {
    constructor() {
      this.texts = [];
      this.stack = [];
      this.update = function (_0x17bf69, _0x3f0561, _0x2629e2, _0xcf7579) {
        _0x3f0561.textBaseline = "middle";
        _0x3f0561.textAlign = "center";
        for (let _0x1657c0 = 0; _0x1657c0 < this.texts.length; ++_0x1657c0) {
          if (this.texts[_0x1657c0].life) {
            this.texts[_0x1657c0].update(_0x17bf69);
            this.texts[_0x1657c0].render(_0x3f0561, _0x2629e2, _0xcf7579);
          }
        }
      };
      this.showText = function (_0x312d7e, _0x133423, _0x415c81, _0x39b77f, _0x2d2688, _0x4f1e79, _0x5616a5) {
        let _0x4f2681;
        for (let _0xa760b2 = 0; _0xa760b2 < this.texts.length; ++_0xa760b2) {
          if (!this.texts[_0xa760b2].life) {
            _0x4f2681 = this.texts[_0xa760b2];
            break;
          }
        }
        if (!_0x4f2681) {
          _0x4f2681 = new _0x43ddbf();
          this.texts.push(_0x4f2681);
        }
        _0x4f2681.init(_0x312d7e, _0x133423, _0x415c81, _0x39b77f, _0x2d2688, _0x4f1e79, _0x5616a5);
      };
    }
  }
  class _0x3c40d1 {
    constructor(_0x4bb768) {
      this.sid = _0x4bb768;
      this.init = function (_0x5b7534, _0x57b118, _0xaff3fd, _0x45d02b, _0x59cb3b, _0x364b10, _0x2e1003) {
        _0x364b10 = _0x364b10 || {};
        this.sentTo = {};
        this.gridLocations = [];
        this.active = true;
        this.render = true;
        this.doUpdate = _0x364b10.doUpdate;
        this.x = _0x5b7534;
        this.y = _0x57b118;
        this.dir = _0xaff3fd;
        this.lastDir = _0xaff3fd;
        this.xWiggle = 0;
        this.yWiggle = 0;
        this.visScale = _0x45d02b;
        this.scale = _0x45d02b;
        this.type = _0x59cb3b;
        this.id = _0x364b10.id;
        this.owner = _0x2e1003;
        this.name = _0x364b10.name;
        this.isItem = this.id != undefined;
        this.group = _0x364b10.group;
        this.maxHealth = _0x364b10.health;
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
        this.colDiv = _0x364b10.colDiv || 1;
        this.blocker = _0x364b10.blocker;
        this.ignoreCollision = _0x364b10.ignoreCollision;
        this.dontGather = _0x364b10.dontGather;
        this.hideFromEnemy = _0x364b10.hideFromEnemy;
        this.friction = _0x364b10.friction;
        this.projDmg = _0x364b10.projDmg;
        this.dmg = _0x364b10.dmg;
        this.pDmg = _0x364b10.pDmg;
        this.pps = _0x364b10.pps;
        this.zIndex = _0x364b10.zIndex || 0;
        this.turnSpeed = _0x364b10.turnSpeed;
        this.req = _0x364b10.req;
        this.trap = _0x364b10.trap;
        this.healCol = _0x364b10.healCol;
        this.teleport = _0x364b10.teleport;
        this.boostSpeed = _0x364b10.boostSpeed;
        this.projectile = _0x364b10.projectile;
        this.shootRange = _0x364b10.shootRange;
        this.shootRate = _0x364b10.shootRate;
        this.shootCount = this.shootRate;
        this.spawnPoint = _0x364b10.spawnPoint;
        this.onNear = 0;
        this.breakObj = false;
        this.alpha = _0x364b10.alpha || 1;
        this.maxAlpha = _0x364b10.alpha || 1;
        this.damaged = 0;
      };
      this.changeHealth = function (_0x739257, _0x3d148e) {
        this.health += _0x739257;
        return this.health <= 0;
      };
      this.getScale = function (_0xf7eb5f, _0x48f873) {
        _0xf7eb5f = _0xf7eb5f || 1;
        return this.scale * (this.isItem || this.type == 2 || this.type == 3 || this.type == 4 ? 1 : _0xf7eb5f * 0.6) * (_0x48f873 ? 1 : this.colDiv);
      };
      this.visibleToPlayer = function (_0x439c1a) {
        return !this.hideFromEnemy || this.owner && (this.owner == _0x439c1a || this.owner.team && _0x439c1a.team == this.owner.team);
      };
      this.update = function (_0x2355b0) {
        if (this.active) {
          if (this.xWiggle) {
            this.xWiggle *= Math.pow(0.99, _0x2355b0);
          }
          if (this.yWiggle) {
            this.yWiggle *= Math.pow(0.99, _0x2355b0);
          }
          let _0x2d5f41 = _0x1c7eec.getAngleDist(this.lastDir, this.dir);
          if (_0x2d5f41 > 0.01) {
            this.dir += _0x2d5f41 / 5;
          } else {
            this.dir = this.lastDir;
          }
        } else if (this.alive) {
          this.alpha -= _0x2355b0 / (200 / this.maxAlpha);
          this.visScale += _0x2355b0 / (this.scale / 2.5);
          if (this.alpha <= 0) {
            this.alpha = 0;
            this.alive = false;
          }
        }
      };
      this.isTeamObject = function (_0x261534) {
        if (this.owner == null) {
          return true;
        } else {
          return this.owner && _0x261534.sid == this.owner.sid || _0x261534.findAllianceBySid(this.owner.sid);
        }
      };
    }
  }
  class _0x33827b {
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
      this.list = [{
        group: this.groups[0],
        name: "apple",
        desc: "restores 20 health when consumed",
        req: ["food", 10],
        consume: function (_0x5cf415) {
          return _0x5cf415.changeHealth(20, _0x5cf415);
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
        consume: function (_0x14cc4a) {
          return _0x14cc4a.changeHealth(40, _0x14cc4a);
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
        consume: function (_0x293dea) {
          if (_0x293dea.changeHealth(30, _0x293dea) || _0x293dea.health < 100) {
            _0x293dea.dmgOverTime.dmg = -10;
            _0x293dea.dmgOverTime.doer = _0x293dea;
            _0x293dea.dmgOverTime.time = 5;
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
        placeOffset: 2,
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
        itemAID: 22,
        shadow: {
          offsetX: 5,
          offsetY: 5,
          blur: 20,
          color: "rgba(0, 0, 0, 0.5)"
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
        index: function (_0x204f55, _0x367b02) {
          if ([0, 1, 2].includes(_0x204f55)) {
            return 0;
          } else if ([3, 4, 5].includes(_0x204f55)) {
            return 1;
          } else if ([6, 7, 8, 9].includes(_0x204f55)) {
            return 2;
          } else if ([10, 11, 12].includes(_0x204f55)) {
            return 3;
          } else if ([13, 14].includes(_0x204f55)) {
            return 5;
          } else if ([15, 16].includes(_0x204f55)) {
            return 4;
          } else if ([17, 18, 19, 21, 22].includes(_0x204f55)) {
            if ([13, 14].includes(_0x367b02)) {
              return 6;
            } else {
              return 5;
            }
          } else if (_0x204f55 == 20) {
            if ([13, 14].includes(_0x367b02)) {
              return 7;
            } else {
              return 6;
            }
          } else {
            return undefined;
          }
        }
      };
      for (let _0x1f1262 = 0; _0x1f1262 < this.list.length; ++_0x1f1262) {
        this.list[_0x1f1262].id = _0x1f1262;
        if (this.list[_0x1f1262].pre) {
          this.list[_0x1f1262].pre = _0x1f1262 - this.list[_0x1f1262].pre;
        }
      }
      if (typeof window !== "undefined") {
        function _0x3bafc7(_0x17c564) {
          for (let _0x5bbf06 = _0x17c564.length - 1; _0x5bbf06 > 0; _0x5bbf06--) {
            const _0xdb59a = Math.floor(Math.random() * (_0x5bbf06 + 1));
            [_0x17c564[_0x5bbf06], _0x17c564[_0xdb59a]] = [_0x17c564[_0xdb59a], _0x17c564[_0x5bbf06]];
          }
          return _0x17c564;
        }
      }
    }
  }
  class _0x48362d {
    constructor(_0x27f5c4, _0x52be5a, _0x19aca7, _0x1ea00e, _0x293b11, _0x1598da) {
      let _0x513741 = Math.floor;
      let _0x3669c1 = Math.abs;
      let _0x39f30a = Math.cos;
      let _0x55c2d1 = Math.sin;
      let _0x1df02b = Math.pow;
      let _0xf294cd = Math.sqrt;
      this.ignoreAdd = false;
      this.hitObj = [];
      this.disableObj = function (_0xb5929d) {
        _0xb5929d.active = false;
      };
      let _0x4b81f5;
      this.add = function (_0x3bc847, _0xa6ec97, _0x51a723, _0x13ec90, _0x1793ba, _0x1d8825, _0x3e22b0, _0x6541ef, _0x7830fc) {
        _0x4b81f5 = _0x4510e0(_0x3bc847);
        if (!_0x4b81f5) {
          _0x4b81f5 = _0x4e7d72.find(_0x1152b9 => !_0x1152b9.active);
          if (!_0x4b81f5) {
            _0x4b81f5 = new _0x27f5c4(_0x3bc847);
            _0x4e7d72.push(_0x4b81f5);
          }
        }
        if (_0x6541ef) {
          _0x4b81f5.sid = _0x3bc847;
        }
        _0x4b81f5.init(_0xa6ec97, _0x51a723, _0x13ec90, _0x1793ba, _0x1d8825, _0x3e22b0, _0x7830fc);
      };
      this.disableBySid = function (_0x2da0f8) {
        let _0x24a769 = _0x4510e0(_0x2da0f8);
        if (_0x24a769) {
          this.disableObj(_0x24a769);
        }
      };
      this.removeAllItems = function (_0x2f206b, _0x4676af) {
        _0x4e7d72.filter(_0xdeff30 => _0xdeff30.active && _0xdeff30.owner && _0xdeff30.owner.sid == _0x2f206b).forEach(_0x1e16e7 => this.disableObj(_0x1e16e7));
      };
      this.checkItemLocation = function (_0x58b5c0, _0x244434, _0x1807d0, _0x44eaee, _0x4333e4, _0x6421e2, _0x57df3e) {
        let _0xc4d9a9 = _0x52be5a.find(_0x21fbfc => _0x21fbfc.active && _0x19aca7.getDistance(_0x58b5c0, _0x244434, _0x21fbfc.x, _0x21fbfc.y) < _0x1807d0 + (_0x21fbfc.blocker ? _0x21fbfc.blocker : _0x21fbfc.getScale(_0x44eaee, _0x21fbfc.isItem)));
        if (_0xc4d9a9) {
          return false;
        }
        if (!_0x6421e2 && _0x4333e4 != 18 && _0x244434 >= _0x1ea00e.mapScale / 2 - _0x1ea00e.riverWidth / 2 && _0x244434 <= _0x1ea00e.mapScale / 2 + _0x1ea00e.riverWidth / 2) {
          return false;
        }
        return true;
      };
    }
  }
  class _0x3c1877 {
    constructor(_0x58866a, _0x70a416, _0x3028df, _0x4a7eb4, _0x1e76c5, _0x2869d5, _0x41a996) {
      this.init = function (_0x2b7b27, _0xb2d582, _0x5aea9f, _0x2015e7, _0x3b15b4, _0x128053, _0x5d1d41, _0xbc0783, _0x45db0f) {
        this.active = true;
        this.tickActive = true;
        this.indx = _0x2b7b27;
        this.x = _0xb2d582;
        this.y = _0x5aea9f;
        this.x2 = _0xb2d582;
        this.y2 = _0x5aea9f;
        this.dir = _0x2015e7;
        this.skipMov = true;
        this.speed = _0x3b15b4;
        this.dmg = _0x128053;
        this.scale = _0xbc0783;
        this.range = _0x5d1d41;
        this.r2 = _0x5d1d41;
        this.owner = _0x45db0f;
      };
      this.update = function (_0x191583) {
        if (this.active) {
          let _0x576400 = this.speed * _0x191583;
          if (!this.skipMov) {
            this.x += _0x576400 * Math.cos(this.dir);
            this.y += _0x576400 * Math.sin(this.dir);
            this.range -= _0x576400;
            if (this.range <= 0) {
              this.x += this.range * Math.cos(this.dir);
              this.y += this.range * Math.sin(this.dir);
              _0x576400 = 1;
              this.range = 0;
              this.active = false;
            }
          } else {
            this.skipMov = false;
          }
        }
      };
      this.tickUpdate = function (_0x9fa38c) {
        if (this.tickActive) {
          let _0x4f1475 = this.speed * _0x9fa38c;
          if (!this.skipMov) {
            this.x2 += _0x4f1475 * Math.cos(this.dir);
            this.y2 += _0x4f1475 * Math.sin(this.dir);
            this.r2 -= _0x4f1475;
            if (this.r2 <= 0) {
              this.x2 += this.r2 * Math.cos(this.dir);
              this.y2 += this.r2 * Math.sin(this.dir);
              _0x4f1475 = 1;
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
  class _0x3ed642 {
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
  class _0x2b219e {
    constructor(_0x1e06c7, _0x38a24a, _0x570fd4, _0xa64db5, _0x4c85e6, _0x5c9163, _0x4d4f74, _0x17f444, _0x388126) {
      this.addProjectile = function (_0x2c40c0, _0x17b797, _0x54d29d, _0x3bf861, _0x410d85, _0x2f2c6f, _0x18c412, _0x29ceff, _0x28d6ed, _0x493a65) {
        let _0x31bdc7 = _0x5c9163.projectiles[_0x2f2c6f];
        let _0x4dec0c;
        for (let _0x33b815 = 0; _0x33b815 < _0x38a24a.length; ++_0x33b815) {
          if (!_0x38a24a[_0x33b815].active) {
            _0x4dec0c = _0x38a24a[_0x33b815];
            break;
          }
        }
        if (!_0x4dec0c) {
          _0x4dec0c = new _0x1e06c7(_0x570fd4, _0xa64db5, _0x4c85e6, _0x5c9163, _0x4d4f74, _0x17f444, _0x388126);
          _0x4dec0c.sid = _0x38a24a.length;
          _0x38a24a.push(_0x4dec0c);
        }
        _0x4dec0c.init(_0x2f2c6f, _0x2c40c0, _0x17b797, _0x54d29d, _0x410d85, _0x31bdc7.dmg, _0x3bf861, _0x31bdc7.scale, _0x18c412);
        _0x4dec0c.ignoreObj = _0x29ceff;
        _0x4dec0c.layer = _0x28d6ed || _0x31bdc7.layer;
        _0x4dec0c.inWindow = _0x493a65;
        _0x4dec0c.src = _0x31bdc7.src;
        return _0x4dec0c;
      };
    }
  }
  ;
  class _0x3e6ac1 {
    constructor(_0x3005ea, _0x5e44ca, _0x7f1fe6, _0x1ca483, _0x520558, _0xd5a54c, _0x5f362d, _0x1bad40, _0x2f5382) {
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
      }];
      this.spawn = function (_0x4922c2, _0x532179, _0x2ff3c4, _0x2f7b43) {
        let _0x309e7c = _0x3005ea.find(_0x36d455 => !_0x36d455.active);
        if (!_0x309e7c) {
          _0x309e7c = new _0x5e44ca(_0x3005ea.length, _0x520558, _0x7f1fe6, _0x1ca483, _0x5f362d, _0xd5a54c, _0x1bad40, _0x2f5382);
          _0x3005ea.push(_0x309e7c);
        }
        _0x309e7c.init(_0x4922c2, _0x532179, _0x2ff3c4, _0x2f7b43, this.aiTypes[_0x2f7b43]);
        return _0x309e7c;
      };
    }
  }
  ;
  class _0x1bd689 {
    constructor(_0x20447c, _0x1b4379, _0x239532, _0x290cb1, _0x1425af, _0x45d385, _0x1eefdb, _0x3affa9) {
      this.sid = _0x20447c;
      this.isAI = true;
      this.nameIndex = _0x1425af.randInt(0, _0x45d385.cowNames.length - 1);
      this.init = function (_0x4cdd80, _0x2c259d, _0xf4af61, _0x2c3d4c, _0x173a7b) {
        this.x = _0x4cdd80;
        this.y = _0x2c259d;
        this.startX = _0x173a7b.fixedSpawn ? _0x4cdd80 : null;
        this.startY = _0x173a7b.fixedSpawn ? _0x2c259d : null;
        this.xVel = 0;
        this.yVel = 0;
        this.zIndex = 0;
        this.dir = _0xf4af61;
        this.dirPlus = 0;
        this.showName = "aaa";
        this.index = _0x2c3d4c;
        this.src = _0x173a7b.src;
        if (_0x173a7b.name) {
          this.name = _0x173a7b.name;
        }
        this.weightM = _0x173a7b.weightM;
        this.speed = _0x173a7b.speed;
        this.killScore = _0x173a7b.killScore;
        this.turnSpeed = _0x173a7b.turnSpeed;
        this.scale = _0x173a7b.scale;
        this.maxHealth = _0x173a7b.health;
        this.leapForce = _0x173a7b.leapForce;
        this.health = this.maxHealth;
        this.chargePlayer = _0x173a7b.chargePlayer;
        this.viewRange = _0x173a7b.viewRange;
        this.drop = _0x173a7b.drop;
        this.dmg = _0x173a7b.dmg;
        this.hostile = _0x173a7b.hostile;
        this.dontRun = _0x173a7b.dontRun;
        this.hitRange = _0x173a7b.hitRange;
        this.hitDelay = _0x173a7b.hitDelay;
        this.hitScare = _0x173a7b.hitScare;
        this.spriteMlt = _0x173a7b.spriteMlt;
        this.nameScale = _0x173a7b.nameScale;
        this.colDmg = _0x173a7b.colDmg;
        this.noTrap = _0x173a7b.noTrap;
        this.spawnDelay = _0x173a7b.spawnDelay;
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
      let _0x2526d9 = 0;
      let _0x2eb108 = 0;
      this.animate = function (_0x29a64b) {
        if (this.animTime > 0) {
          this.animTime -= _0x29a64b;
          if (this.animTime <= 0) {
            this.animTime = 0;
            this.dirPlus = 0;
            _0x2526d9 = 0;
            _0x2eb108 = 0;
          } else if (_0x2eb108 == 0) {
            _0x2526d9 += _0x29a64b / (this.animSpeed * _0x45d385.hitReturnRatio);
            this.dirPlus = _0x1425af.lerp(0, this.targetAngle, Math.min(1, _0x2526d9));
            if (_0x2526d9 >= 1) {
              _0x2526d9 = 1;
              _0x2eb108 = 1;
            }
          } else {
            _0x2526d9 -= _0x29a64b / (this.animSpeed * (1 - _0x45d385.hitReturnRatio));
            this.dirPlus = _0x1425af.lerp(0, this.targetAngle, Math.max(0, _0x2526d9));
          }
        }
      };
      this.startAnim = function () {
        this.animTime = this.animSpeed = 600;
        this.targetAngle = Math.PI * 0.8;
        _0x2526d9 = 0;
        _0x2eb108 = 0;
      };
    }
  }
  ;
  class _0x3ccd17 {
    constructor(_0x106044, _0x3d2886, _0x33dbc6, _0x45413c) {
      this.x = _0x106044;
      this.y = _0x3d2886;
      this.alpha = 0;
      this.active = true;
      this.alive = false;
      this.chat = _0x33dbc6;
      this.owner = _0x45413c;
    }
  }
  ;
  class _0x3b8393 {
    constructor(_0x2bd118, _0x1660f8, _0xc51da5, _0x22630d, _0x297acb, _0x407002, _0xf55d6a, _0x39ce44, _0x37726e) {
      this.x = _0x2bd118;
      this.y = _0x1660f8;
      this.lastDir = _0xc51da5;
      this.dir = _0xc51da5 + Math.PI;
      this.buildIndex = _0x22630d;
      this.weaponIndex = _0x297acb;
      this.weaponVariant = _0x407002;
      this.skinColor = _0xf55d6a;
      this.scale = _0x39ce44;
      this.visScale = 0;
      this.name = _0x37726e;
      this.alpha = 1;
      this.active = true;
      this.animate = function (_0x54c59b) {
        let _0x21cd76 = _0x1c7eec.getAngleDist(this.lastDir, this.dir);
        if (_0x21cd76 > 0.01) {
          this.dir += _0x21cd76 / 20;
        } else {
          this.dir = this.lastDir;
        }
        if (this.visScale < this.scale) {
          this.visScale += _0x54c59b / (this.scale / 2);
          if (this.visScale >= this.scale) {
            this.visScale = this.scale;
          }
        }
        this.alpha -= _0x54c59b / 30000;
        if (this.alpha <= 0) {
          this.alpha = 0;
          this.active = false;
        }
      };
    }
  }
  ;
  class _0x591fa1 {
    constructor(_0x2470ef, _0xdbe244, _0x42bfed, _0x4987e3, _0xcaa67b, _0x198d63, _0xb70861, _0x4b85b2, _0x591aa5, _0x3e51cf, _0x39380c, _0x3f1e22, _0x4bb282, _0x58e8ce) {
      this.id = _0x2470ef;
      this.sid = _0xdbe244;
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
      this.showName = "NOOO";
      this.tails = {};
      for (let _0x3a8a1f = 0; _0x3a8a1f < _0x39380c.length; ++_0x3a8a1f) {
        if (_0x39380c[_0x3a8a1f].price <= 0) {
          this.tails[_0x39380c[_0x3a8a1f].id] = 1;
        }
      }
      this.skins = {};
      for (let _0x788371 = 0; _0x788371 < _0x3e51cf.length; ++_0x788371) {
        if (_0x3e51cf[_0x788371].price <= 0) {
          this.skins[_0x3e51cf[_0x788371].id] = 1;
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
      this.spawn = function (_0x47c901) {
        this.attacked = false;
        this.timeDamaged = 0;
        this.timeHealed = 0;
        this.pinge = 0;
        this.millPlace = "NOOO";
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
        this.scale = _0x42bfed.playerScale;
        this.speed = _0x42bfed.playerSpeed;
        this.resetMoveDir();
        this.resetResources(_0x47c901);
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
      this.resetResources = function (_0x198279) {
        for (let _0x1143a6 = 0; _0x1143a6 < _0x42bfed.resourceTypes.length; ++_0x1143a6) {
          this[_0x42bfed.resourceTypes[_0x1143a6]] = _0x198279 ? 100 : 0;
        }
      };
      this.getItemType = function (_0x50a5cc) {
        let _0x2c765c = this.items.findIndex(_0x1f0bd5 => _0x1f0bd5 == _0x50a5cc);
        if (_0x2c765c != -1) {
          return _0x2c765c;
        } else {
          return _0x591aa5.checkItem.index(_0x50a5cc, this.items);
        }
      };
      this.setData = function (_0x233e94) {
        this.id = _0x233e94[0];
        this.sid = _0x233e94[1];
        this.name = _0x233e94[2];
        this.x = _0x233e94[3];
        this.y = _0x233e94[4];
        this.dir = _0x233e94[5];
        this.health = _0x233e94[6];
        this.maxHealth = _0x233e94[7];
        this.scale = _0x233e94[8];
        this.skinColor = _0x233e94[9];
      };
      this.updateTimer = function () {
        this.bullTimer -= 1;
        if (this.bullTimer <= 0) {
          this.setBullTick = false;
          this.bullTick = _0x65cac6.tick - 1;
          this.bullTimer = _0x42bfed.serverUpdateRate;
        }
        this.poisonTimer -= 1;
        if (this.poisonTimer <= 0) {
          this.setPoisonTick = false;
          this.poisonTick = _0x65cac6.tick - 1;
          this.poisonTimer = _0x42bfed.serverUpdateRate;
        }
      };
      this.update = function (_0x11c008) {
        if (this.active) {
          let _0x2dfa46 = {
            skin: _0x28234e(_0x3e51cf, this.skinIndex),
            tail: _0x28234e(_0x39380c, this.tailIndex)
          };
          let _0x5387d1 = (this.buildIndex >= 0 ? 0.5 : 1) * (_0x591aa5.weapons[this.weaponIndex].spdMult || 1) * (_0x2dfa46.skin ? _0x2dfa46.skin.spdMult || 1 : 1) * (_0x2dfa46.tail ? _0x2dfa46.tail.spdMult || 1 : 1) * (this.y <= _0x42bfed.snowBiomeTop ? _0x2dfa46.skin && _0x2dfa46.skin.coldM ? 1 : _0x42bfed.snowSpeed : 1) * this.slowMult;
          this.maxSpeed = _0x5387d1;
        }
      };
      let _0x20fca1 = 0;
      let _0x3ca0f8 = 0;
      this.animate = function (_0x365123) {
        if (this.animTime > 0) {
          this.animTime -= _0x365123;
          if (this.animTime <= 0) {
            this.animTime = 0;
            this.dirPlus = 0;
            _0x20fca1 = 0;
            _0x3ca0f8 = 0;
          } else if (_0x3ca0f8 == 0) {
            _0x20fca1 += _0x365123 / (this.animSpeed * _0x42bfed.hitReturnRatio);
            this.dirPlus = _0x4987e3.lerp(0, this.targetAngle, Math.min(1, _0x20fca1));
            if (_0x20fca1 >= 1) {
              _0x20fca1 = 1;
              _0x3ca0f8 = 1;
            }
          } else {
            _0x20fca1 -= _0x365123 / (this.animSpeed * (1 - _0x42bfed.hitReturnRatio));
            this.dirPlus = _0x4987e3.lerp(0, this.targetAngle, Math.max(0, _0x20fca1));
          }
        }
      };
      this.startAnim = function (_0x428866, _0x19d6bd) {
        this.animTime = this.animSpeed = _0x591aa5.weapons[_0x19d6bd].speed;
        this.targetAngle = _0x428866 ? -_0x42bfed.hitAngle : -Math.PI;
        _0x20fca1 = 0;
        _0x3ca0f8 = 0;
      };
      this.canSee = function (_0x26e1eb) {
        if (!_0x26e1eb) {
          return false;
        }
        let _0x8940d4 = Math.abs(_0x26e1eb.x - this.x) - _0x26e1eb.scale;
        let _0x2b9661 = Math.abs(_0x26e1eb.y - this.y) - _0x26e1eb.scale;
        return _0x8940d4 <= _0x42bfed.maxScreenWidth / 2 * 1.3 && _0x2b9661 <= _0x42bfed.maxScreenHeight / 2 * 1.3;
      };
      this.judgeShame = function () {
        this.lastshamecount = this.shameCount;
        if (this.oldHealth < this.health) {
          if (this.hitTime) {
            let _0x1fc3ca = _0x65cac6.tick - this.hitTime;
            this.lastHit = _0x65cac6.tick;
            this.hitTime = 0;
            if (_0x1fc3ca < 2) {
              this.shameCount++;
            } else {
              this.shameCount = Math.max(0, this.shameCount - 2);
            }
          }
        } else if (this.oldHealth > this.health) {
          this.hitTime = _0x65cac6.tick;
        }
      };
      this.addShameTimer = function () {
        this.shameCount = 0;
        this.shameTimer = 30;
        let _0xb8dca6 = setInterval(() => {
          this.shameTimer--;
          if (this.shameTimer <= 0) {
            clearInterval(_0xb8dca6);
          }
        }, 1000);
      };
      this.isTeam = function (_0x5a9979) {
        return this == _0x5a9979 || this.team && this.team == _0x5a9979.team;
      };
      this.findAllianceBySid = function (_0x252a58) {
        if (this.team) {
          return _0x3c8e13.find(_0x99aa05 => _0x99aa05 === _0x252a58);
        } else {
          return null;
        }
      };
      this.checkCanInsta = function (_0x30b32d) {
        let _0x166a75 = 0;
        if (this.alive && _0x37b6ae) {
          let _0x59d95d = {
            weapon: this.weapons[0],
            variant: this.primaryVariant,
            dmg: this.weapons[0] == undefined ? 0 : _0x591aa5.weapons[this.weapons[0]].dmg
          };
          let _0x52dee2 = {
            weapon: this.weapons[1],
            variant: this.secondaryVariant,
            dmg: this.weapons[1] == undefined ? 0 : _0x591aa5.weapons[this.weapons[1]].Pdmg
          };
          let _0x8e96b1 = this.skins[7] && !_0x30b32d ? 1.5 : 1;
          let _0x35271c = _0x59d95d.variant != undefined ? _0x42bfed.weaponVariants[_0x59d95d.variant].val : 1;
          if (_0x59d95d.weapon != undefined && this.reloads[_0x59d95d.weapon] == 0) {
            _0x166a75 += _0x59d95d.dmg * _0x35271c * _0x8e96b1;
          }
          if (_0x52dee2.weapon != undefined && this.reloads[_0x52dee2.weapon] == 0) {
            _0x166a75 += _0x52dee2.dmg;
          }
          if (this.skins[53] && this.reloads[53] <= (_0x547655.weapons[1] == 10 ? 0 : _0x65cac6.tickRate) && _0x151041.skinIndex != 22) {
            _0x166a75 += 25;
          }
          _0x166a75 *= _0x151041.skinIndex == 6 ? 0.75 : 1;
          return _0x166a75;
        }
        return 0;
      };
      this.manageReload = function () {
        if (this.shooting[53]) {
          this.shooting[53] = 0;
          this.reloads[53] = 2500 - _0x65cac6.tickRate;
        } else if (this.reloads[53] > 0) {
          this.reloads[53] = Math.max(0, this.reloads[53] - _0x65cac6.tickRate);
        }
        if (this.reloads[this.weaponIndex] <= 1000 / 9) {
          let _0x2c98fd = this.weaponIndex;
          let _0xbb692a = _0x51a14e.filter(_0x315513 => (_0x315513.active || _0x315513.alive) && _0x315513.health < _0x315513.maxHealth && _0x315513.group !== undefined && _0x4987e3.getDist(_0x315513, _0x547655, 0, 2) <= _0x591aa5.weapons[_0x547655.weaponIndex].range + _0x315513.scale);
          for (let _0x273c46 = 0; _0x273c46 < _0xbb692a.length; _0x273c46++) {
            let _0x5eb72f = _0xbb692a[_0x273c46];
            let _0x336532 = _0x591aa5.weapons[_0x2c98fd].dmg * _0x42bfed.weaponVariants[_0x3a3fd7[(_0x2c98fd < 9 ? "prima" : "seconda") + "ryVariant"]].val * (_0x591aa5.weapons[_0x2c98fd].sDmg || 1) * 3.3;
            let _0x59ad7d = _0x591aa5.weapons[_0x2c98fd].dmg * _0x42bfed.weaponVariants[_0x3a3fd7[(_0x2c98fd < 9 ? "prima" : "seconda") + "ryVariant"]].val * (_0x591aa5.weapons[_0x2c98fd].sDmg || 1);
            if (_0x5eb72f.health - _0x59ad7d <= 0 && _0x151041.length) {
              _0x39dd86(_0x151041.dist2 < _0x151041.scale * 1.8 + 50 ? 4 : 2, _0x651014(_0x5eb72f, _0x547655) + Math.PI);
              console.log("preplaced");
            }
          }
        }
        if (this.gathering || this.shooting[1]) {
          if (this.gathering) {
            this.gathering = 0;
            this.reloads[this.gatherIndex] = _0x591aa5.weapons[this.gatherIndex].speed * (this.skinIndex == 20 ? 0.78 : 1);
            this.attacked = true;
          }
          if (this.shooting[1]) {
            this.shooting[1] = 0;
            this.reloads[this.shootIndex] = _0x591aa5.weapons[this.shootIndex].speed * (this.skinIndex == 20 ? 0.78 : 1);
            this.attacked = true;
          }
        } else {
          this.attacked = false;
          if (this.buildIndex < 0) {
            if (this.reloads[this.weaponIndex] > 0) {
              this.reloads[this.weaponIndex] = Math.max(0, this.reloads[this.weaponIndex] - 110);
              if (this == _0x547655) {
                if (getEl("weaponGrind").checked) {
                  for (let _0x2ef2ef = 0; _0x2ef2ef < Math.PI * 2; _0x2ef2ef += Math.PI / 2) {
                    _0x21e105(_0x547655.getItemType(22), _0x2ef2ef);
                  }
                }
              }
              if (this.reloads[this.primaryIndex] == 0 && this.reloads[this.weaponIndex] == 0) {
                this.antiBull++;
                _0x65cac6.tickBase(() => {
                  this.antiBull = 0;
                }, 1);
              }
            }
          }
        }
      };
      let _0x5d99ab = [];
      function _0x4be7bb(_0x3ea266, _0x3c6d99, _0x6e6c65, _0x4caa4c) {
        if (!document.getElementById("sp").checked) {
          return;
        }
        if (!_0x5b81e2.length) {
          return;
        }
        _0x5d99ab = _0x4e7d72.filter(_0x238db7 => _0x238db7.active && _0x238db7.buildHealth).sort((_0x33c629, _0x56fabd) => _0x4987e3.getDist(_0x33c629, _0x547655, 0, 2) - _0x4987e3.getDist(_0x56fabd, _0x547655, 0, 2))[0];
        if (!_0x5d99ab) {
          return;
        }
        _0x3ea266 = 250;
        _0x3c6d99 = 250;
        _0x6e6c65 = _0x4987e3.getDist(_0x5d99ab, _0x547655, 0, 2);
        _0x4caa4c = _0x4987e3.getDirect(_0x5d99ab, _0x547655, 0, 2);
        if (_0x547655.alive && _0x6e6c65 < _0x3ea266 && _0x151041.dist2 < _0x3c6d99 && !_0x4319f3.in && !_0x94d477.isTrue && !_0x94d477.canSpikeTick && !_0x54660b.middle && !_0x54660b.left) {
          if (_0x5d99ab.buildHealth < _0x591aa5.weapons[_0x547655.weapons[1] == 10 ? _0x547655.weapons[1] : _0x547655.weapons[0]].dmg * 2) {
            if (document.getElementById("stype").value == "D") {
              for (let _0x2bfe16 = 0; _0x2bfe16 < 6; _0x2bfe16++) {
                let _0x47a3c8 = _0x2bfe16 + (_0x2bfe16 % 2 ? -1 : 1) * 45 / 180 * Math.PI + _0x151041.aim2;
                _0x21e105(2, _0x2bfe16);
              }
            } else {
              for (let _0x257e67 = 0; _0x257e67 < 4; _0x257e67++) {
                let _0x442eb2 = _0x257e67 + (_0x257e67 % 2 ? -1 : 1) * 45 / 180 * Math.PI + _0x151041.aim2;
                _0x21e105(2, _0x257e67);
              }
            }
          }
        }
      }
      this.preplacer = function () {
        if (_0x4319f3.inTrap) {
          return;
        }
        if (!_0x4f1036.autoPrePlace) {
          return;
        }
        const _0x1aa156 = _0x591aa5.weapons[_0x547655.weaponIndex].range + 70;
        const _0x5079b5 = _0x1aa156 ** 2;
        const {
          x2: _0x3bdad8,
          y2: _0x525079
        } = _0x547655;
        const _0x5ebb44 = _0x4e7d72.filter(_0x253ce2 => {
          const {
            x2: _0x4565e0,
            y2: _0x5aec17,
            buildHealth: _0x2face8
          } = _0x253ce2;
          const _0x235740 = (_0x4565e0 - _0x3bdad8) ** 2 + (_0x5aec17 - _0x525079) ** 2;
          return _0x151041 && _0x2face8 <= 272.58 && _0x235740 <= _0x5079b5;
        });
        if (_0x5ebb44.length > 0) {
          const {
            x2: _0x1d23eb,
            y2: _0x258aa2
          } = _0x5ebb44[0];
          const _0x3c5157 = _0x4987e3.getDirect({
            x2: _0x1d23eb,
            y2: _0x258aa2
          }, _0x547655, 0, 2);
          const _0x1bbd50 = 70;
          let _0x13d3f8 = Math.sqrt(_0x151041.xVel * _0x151041.xVel + _0x151041.yVel * _0x151041.yVel);
          let _0x28db1f = Math.atan2(_0x151041.yVel, _0x151041.xVel);
          let _0x318010 = null;
          let _0x5a431b = Infinity;
          for (let _0x2843af = 0; _0x2843af < 360; _0x2843af += 30) {
            let _0x12353d = _0x4987e3.deg2rad(_0x2843af);
            let _0x362622 = _0x4987e3.getDist(_0x151041, _0x547655, 0, 2) + _0x13d3f8 * Math.sin(_0x28db1f) + _0x1bbd50;
            if (_0x362622 < _0x5a431b) {
              _0x5a431b = _0x362622;
              _0x318010 = _0x12353d;
            }
          }
          const _0x20a836 = 5;
          const _0x325c27 = (_0x5ebb44[0].buildHealth - _0x547655.damage) / (_0x547655.damagePerShot - _0x5ebb44[0].absorb);
          const _0x2b1d29 = _0x5a431b / _0x13d3f8;
          if (_0x325c27 + _0x20a836 <= _0x2b1d29) {
            this.testCanPlace(4, _0x318010, _0x318010 + Math.PI * 2, Math.PI / 24, _0x3c5157, _0x1bbd50);
          }
        }
      };
      this.addDamageThreat = function (_0x3cd114) {
        let _0x3fa7a9 = {
          weapon: this.primaryIndex,
          variant: this.primaryVariant
        };
        _0x3fa7a9.dmg = _0x3fa7a9.weapon == undefined ? 45 : _0x591aa5.weapons[_0x3fa7a9.weapon].dmg;
        let _0x34bfb4 = {
          weapon: this.secondaryIndex,
          variant: this.secondaryVariant
        };
        _0x34bfb4.dmg = _0x34bfb4.weapon == undefined ? 75 : _0x591aa5.weapons[_0x34bfb4.weapon].Pdmg;
        let _0x37a251 = 1.5;
        let _0x3b14a5 = _0x3fa7a9.variant != undefined ? _0x42bfed.weaponVariants[_0x3fa7a9.variant].val : 1.18;
        let _0x3a84f8 = _0x34bfb4.variant != undefined ? [9, 12, 13, 15].includes(_0x34bfb4.weapon) ? 1 : _0x42bfed.weaponVariants[_0x34bfb4.variant].val : 1.18;
        if (_0x3fa7a9.weapon == undefined ? true : this.reloads[_0x3fa7a9.weapon] == 0) {
          this.damageThreat += _0x3fa7a9.dmg * _0x3b14a5 * _0x37a251;
        }
        if (_0x34bfb4.weapon == undefined ? true : this.reloads[_0x34bfb4.weapon] == 0) {
          this.damageThreat += _0x34bfb4.dmg * _0x3a84f8;
        }
        if (this.reloads[53] <= _0x65cac6.tickRate) {
          this.damageThreat += 25;
        }
        this.damageThreat *= _0x3cd114.skinIndex == 6 ? 0.75 : 1;
        if (!this.isTeam(_0x3cd114)) {
          if (this.dist2 <= 300) {
            _0x3cd114.damageThreat += this.damageThreat;
          }
        }
      };
    }
  }
  ;
  function _0x4bcf53(_0x3db6aa) {
    _0x547655.reloads[_0x3db6aa] = 0;
    _0x48b469("H", _0x3db6aa);
  }
  function _0x69827c(_0x48f5a8, _0x29159a) {
    _0x48b469("c", 0, _0x48f5a8, _0x29159a);
  }
  function _0x1bb5ca(_0x2de6ce, _0x5ac323) {
    _0x48b469("c", 1, _0x2de6ce, _0x5ac323);
  }
  function _0x2c609b(_0x41f791, _0x58fb12) {
    let _0x148577 = _0x547655.skins[6] ? 6 : 0;
    if (_0x547655.alive && _0x37b6ae) {
      if (_0x58fb12 == 0) {
        if (_0x547655.skins[_0x41f791]) {
          if (_0x547655.latestSkin != _0x41f791) {
            _0x48b469("c", 0, _0x41f791, 0);
          }
        } else if (_0x4f1036.autoBuyEquip) {
          let _0xa60baf = _0x28234e(_0x2037c7, _0x41f791);
          if (_0xa60baf) {
            if (_0x547655.points >= _0xa60baf.price) {
              _0x48b469("c", 1, _0x41f791, 0);
              _0x48b469("c", 0, _0x41f791, 0);
            } else if (_0x547655.latestSkin != _0x148577) {
              _0x48b469("c", 0, _0x148577, 0);
            }
          } else if (_0x547655.latestSkin != _0x148577) {
            _0x48b469("c", 0, _0x148577, 0);
          }
        } else if (_0x547655.latestSkin != _0x148577) {
          _0x48b469("c", 0, _0x148577, 0);
        }
      } else if (_0x58fb12 == 1) {
        if (_0x50abc3 && _0x41f791 != 11 && _0x41f791 != 0) {
          if (_0x547655.latestTail != 0) {
            _0x48b469("c", 0, 0, 1);
          }
          return;
        }
        if (_0x547655.tails[_0x41f791]) {
          if (_0x547655.latestTail != _0x41f791) {
            _0x48b469("c", 0, _0x41f791, 1);
          }
        } else if (_0x4f1036.autoBuyEquip) {
          let _0xfb4c9e = _0x28234e(_0x3cc681, _0x41f791);
          if (_0xfb4c9e) {
            if (_0x547655.points >= _0xfb4c9e.price) {
              _0x48b469("c", 1, _0x41f791, 1);
              _0x48b469("c", 0, _0x41f791, 1);
            } else if (_0x547655.latestTail != 0) {
              _0x48b469("c", 0, 0, 1);
            }
          } else if (_0x547655.latestTail != 0) {
            _0x48b469("c", 0, 0, 1);
          }
        } else if (_0x547655.latestTail != 0) {
          _0x48b469("c", 0, 0, 1);
        }
      }
    }
  }
  function _0x1c7944(_0x4aa0be, _0x2702a3) {
    _0x48b469("z", _0x4aa0be, _0x2702a3);
  }
  function _0x10e7fc(_0x380fd4, _0x1b0c9b) {
    if (!_0x1b0c9b) {
      _0x547655.weaponCode = _0x380fd4;
    }
    _0x48b469("z", _0x380fd4, 1);
  }
  function _0x1079cb() {
    _0x48b469("K", 1, 1);
  }
  function _0x437338(_0x42947f, _0x4cf15d) {
    _0x48b469("F", _0x42947f, _0x4cf15d, 1);
  }
  function _0x39dd86(_0x37affa, _0x21d809, _0x57c8e7) {
    try {
      if (_0x37affa == undefined) {
        return;
      }
      let _0x2553a6 = _0x146f01.list[_0x547655.items[_0x37affa]];
      let _0x2b1649 = _0x547655.scale + _0x2553a6.scale + (_0x2553a6.placeOffset || 0);
      let _0x1d90c4 = _0x547655.x2 + _0x2b1649 * Math.cos(_0x21d809);
      let _0x2e32fc = _0x547655.y2 + _0x2b1649 * Math.sin(_0x21d809);
      if (_0x547655.alive && _0x37b6ae && _0x547655.itemCounts[_0x2553a6.group.id] == undefined ? true : _0x547655.itemCounts[_0x2553a6.group.id] < (_0x4ee004.isSandbox ? 299 : _0x2553a6.group.limit ? _0x2553a6.group.limit : 99)) {
        _0x1c7944(_0x547655.items[_0x37affa]);
        _0x437338(1, _0x21d809);
        _0x10e7fc(_0x547655.weaponCode, 1);
        if (_0x57c8e7 && getEl("placeVis").checked) {
          _0x4fcde6.push({
            x: _0x1d90c4,
            y: _0x2e32fc,
            name: _0x2553a6.name,
            scale: _0x2553a6.scale,
            dir: _0x21d809
          });
          _0x65cac6.tickBase(() => {
            _0x4fcde6.shift();
          }, 1);
        }
      }
    } catch (_0x51ad8b) {}
  }
  function _0x21e105(_0x50e0bb, _0x252883) {
    try {
      if (_0x50e0bb == undefined) {
        return;
      }
      let _0x1adc79 = _0x146f01.list[_0x547655.items[_0x50e0bb]];
      let _0x50e58b = _0x547655.scale + _0x1adc79.scale + (_0x1adc79.placeOffset || 0);
      let _0x46222c = _0x547655.x2 + _0x50e58b * Math.cos(_0x252883);
      let _0x2a1d21 = _0x547655.y2 + _0x50e58b * Math.sin(_0x252883);
      if (_0x238b23.checkItemLocation(_0x46222c, _0x2a1d21, _0x1adc79.scale, 0.6, _0x1adc79.id, false, _0x547655)) {
        _0x39dd86(_0x50e0bb, _0x252883, 1);
      }
    } catch (_0x8ecc5a) {}
  }
  function _0x3e4925() {
    if (_0x547655.latestSkin == 6) {
      return 0.75;
    } else {
      return 1;
    }
  }
  function _0x38fef7() {
    if (_0x547655.health == 100) {
      return 0;
    }
    if (_0x547655.skinIndex != 45 && _0x547655.skinIndex != 56) {
      return Math.ceil((100 - _0x547655.health) / _0x146f01.list[_0x547655.items[0]].healing);
    }
    return 0;
  }
  function _0x5b837e(_0x47ab5f) {
    let _0x1f036a = _0x5b81e2.filter(_0x4f0510 => {
      let _0x1d6f76 = {
        three: _0x4f0510.attacked
      };
      return _0x1d6f76.three;
    });
    return _0x1f036a;
  }
  function _0x5e95a6() {
    for (let _0x34b99a = 0; _0x34b99a < _0x38fef7(); _0x34b99a++) {
      _0x39dd86(0, _0x58dcd1());
    }
  }
  function _0xca8428(_0x114365) {
    _0xfd6795.antiSync = true;
    let _0x5d70e2 = setInterval(() => {
      if (_0x547655.shameCount < 5) {
        _0x39dd86(0, _0x58dcd1());
      }
    }, 75);
    setTimeout(() => {
      clearInterval(_0x5d70e2);
      setTimeout(() => {
        _0xfd6795.antiSync = false;
      }, _0x65cac6.tickRate);
    }, _0x65cac6.tickRate);
  }
  function _0x299cb5(_0x145341) {
    if (_0x547655.health == 100) {
      return 0;
    }
    if (_0x547655.skinIndex != 45 && _0x547655.skinIndex != 56) {
      return Math.ceil(_0x145341 / _0x146f01.list[_0x547655.items[0]].healing);
    }
    return 0;
  }
  function _0x3b6da1(_0x2e6c74) {
    if (_0x2e6c74 * _0x547655.skinIndex == 6) {
      return 0.75;
    } else {
      return 1;
    }
  }
  function _0x293109(_0x525205, _0x477570) {
    if (_0x547655.y2 >= _0x4ee004.mapScale / 2 - _0x4ee004.riverWidth / 2 && _0x547655.y2 <= _0x4ee004.mapScale / 2 + _0x4ee004.riverWidth / 2) {
      if (_0x477570) {
        return 31;
      }
      _0x2c609b(31, 0);
    } else if (_0x547655.y2 <= _0x4ee004.snowBiomeTop) {
      if (_0x477570) {
        if (_0x525205 && _0x547655.moveDir == undefined) {
          return 6;
        } else {
          return 15;
        }
      }
      _0x2c609b(_0x525205 && _0x547655.moveDir == undefined ? 6 : 15, 0);
    } else {
      if (_0x477570) {
        if (_0x525205 && _0x547655.moveDir == undefined) {
          return 6;
        } else {
          return 12;
        }
      }
      _0x2c609b(_0x525205 && _0x547655.moveDir == undefined ? 6 : 12, 0);
    }
    if (_0x477570) {
      return 0;
    }
  }
  let _0x312fd = [];
  let _0x1f152f = {};
  let _0x7a5737 = function () {
    return _0x547655.weapons[1] == 10 && (_0x1f152f.health > _0x146f01.weapons[_0x547655.weapons[0]].dmg || _0x547655.weapons[0] == 5);
  };
  let _0x164623 = 0;
  let _0x314bc9 = false;
  class _0x4d235d {
    constructor(_0xe697ce, _0xcdfb4a) {
      this.dist = 0;
      this.aim = 0;
      this.inTrap = false;
      this.replaced = false;
      this.antiTrapped = false;
      this.info = {};
      this.notFast = function () {
        return _0x547655.weapons[1] == 10 && (this.info.health > _0xcdfb4a.weapons[_0x547655.weapons[0]].dmg || _0x547655.weapons[0] == 5);
      };
      this.testCanPlace = function (_0x4f6a41, _0x2c8e3c = -(Math.PI / 2), _0x3d8e31 = Math.PI / 2, _0x74c2f6 = Math.PI / 18, _0x302c24, _0x452798, _0x18931a) {
        try {
          let _0x410cfc = _0xcdfb4a.list[_0x547655.items[_0x4f6a41]];
          let _0x5f0cdd = _0x547655.scale + _0x410cfc.scale + (_0x410cfc.placeOffset || 0);
          let _0x5d025f = {
            attempts: 0,
            placed: 0
          };
          let _0x48ab21 = [];
          _0x51a14e.forEach(_0x1eccd3 => {
            _0x48ab21.push({
              x: _0x1eccd3.x,
              y: _0x1eccd3.y,
              active: _0x1eccd3.active,
              blocker: _0x1eccd3.blocker,
              scale: _0x1eccd3.scale,
              isItem: _0x1eccd3.isItem,
              type: _0x1eccd3.type,
              colDiv: _0x1eccd3.colDiv,
              getScale: function (_0x34f486, _0x4b8cb6) {
                _0x34f486 = _0x34f486 || 1;
                return this.scale * (this.isItem || this.type == 2 || this.type == 3 || this.type == 4 ? 1 : _0x34f486 * 0.6) * (_0x4b8cb6 ? 1 : this.colDiv);
              }
            });
          });
          for (let _0x1afd90 = _0x2c8e3c; _0x1afd90 < _0x3d8e31; _0x1afd90 += _0x74c2f6) {
            _0x5d025f.attempts++;
            let _0x5596b1 = _0x302c24 + _0x1afd90;
            let _0x8b4a47 = _0x547655.x2 + _0x5f0cdd * Math.cos(_0x5596b1);
            let _0x56dc32 = _0x547655.y2 + _0x5f0cdd * Math.sin(_0x5596b1);
            let _0x3249db = _0x48ab21.find(_0xf23a9 => _0xf23a9.active && _0xe697ce.getDistance(_0x8b4a47, _0x56dc32, _0xf23a9.x, _0xf23a9.y) < _0x410cfc.scale + (_0xf23a9.blocker ? _0xf23a9.blocker : _0xf23a9.getScale(0.6, _0xf23a9.isItem)));
            if (_0x3249db) {
              continue;
            }
            if (_0x410cfc.id != 18 && _0x56dc32 >= _0x4ee004.mapScale / 2 - _0x4ee004.riverWidth / 2 && _0x56dc32 <= _0x4ee004.mapScale / 2 + _0x4ee004.riverWidth / 2) {
              continue;
            }
            if (!_0x452798 && _0x18931a) {
              if (_0x18931a.inTrap) {
                if (_0xe697ce.getAngleDist(_0x151041.aim2 + Math.PI, _0x5596b1 + Math.PI) <= Math.PI * 1.3) {
                  _0x39dd86(2, _0x5596b1, 1);
                } else if (_0x547655.items[4] == 15) {
                  _0x39dd86(4, _0x5596b1, 1);
                }
              } else if (_0xe697ce.getAngleDist(_0x151041.aim2, _0x5596b1) <= _0x4ee004.gatherAngle / 2.6) {
                _0x39dd86(2, _0x5596b1, 1);
              } else if (_0x547655.items[4] == 15) {
                _0x39dd86(4, _0x5596b1, 1);
              }
            } else {
              _0x39dd86(_0x4f6a41, _0x5596b1, 1);
            }
            _0x48ab21.push({
              x: _0x8b4a47,
              y: _0x56dc32,
              active: true,
              blocker: _0x410cfc.blocker,
              scale: _0x410cfc.scale,
              isItem: true,
              type: null,
              colDiv: _0x410cfc.colDiv,
              getScale: function () {
                return this.scale;
              }
            });
            if (_0xe697ce.getAngleDist(_0x151041.aim2, _0x5596b1) <= 1) {
              _0x5d025f.placed++;
            }
          }
          if (_0x5d025f.placed > 0 && _0x452798 && _0x410cfc.dmg) {
            if (_0x151041.dist2 <= _0xcdfb4a.weapons[_0x547655.weapons[0]].range + _0x547655.scale * 1.8 && _0x4f1036.spikeTick) {
              _0x94d477.canSpikeTick = true;
            }
          }
        } catch (_0x5b1bef) {}
      };
      this.checkSpikeTick = function () {
        try {
          if (![3, 4, 5].includes(_0x151041.primaryIndex)) {
            return false;
          }
          if (_0xfd6795.autoPush ? false : _0x151041.primaryIndex == undefined ? true : _0x151041.reloads[_0x151041.primaryIndex] > _0x65cac6.tickRate) {
            return false;
          }
          if (_0x151041.dist2 <= _0xcdfb4a.weapons[_0x151041.primaryIndex || 5].range + _0x151041.scale * 1.8) {
            let _0x5ae281 = _0xcdfb4a.list[9];
            let _0x6884ff = _0x151041.scale + _0x5ae281.scale + (_0x5ae281.placeOffset || 0);
            let _0x168437 = 0;
            let _0x33617d = {
              attempts: 0,
              block: "unblocked"
            };
            for (let _0xfd6e97 = -1; _0xfd6e97 <= 1; _0xfd6e97 += 1 / 10) {
              _0x33617d.attempts++;
              let _0x28c77f = _0xe697ce.getDirect(_0x547655, _0x151041, 2, 2) + _0xfd6e97;
              let _0x55b1fb = _0x151041.x2 + _0x6884ff * Math.cos(_0x28c77f);
              let _0x24a0e6 = _0x151041.y2 + _0x6884ff * Math.sin(_0x28c77f);
              let _0x1464dc = _0x51a14e.find(_0x226be8 => _0x226be8.active && _0xe697ce.getDistance(_0x55b1fb, _0x24a0e6, _0x226be8.x, _0x226be8.y) < _0x5ae281.scale + (_0x226be8.blocker ? _0x226be8.blocker : _0x226be8.getScale(0.6, _0x226be8.isItem)));
              if (_0x1464dc) {
                continue;
              }
              if (_0x24a0e6 >= _0x4ee004.mapScale / 2 - _0x4ee004.riverWidth / 2 && _0x24a0e6 <= _0x4ee004.mapScale / 2 + _0x4ee004.riverWidth / 2) {
                continue;
              }
              _0x168437++;
              _0x33617d.block = "blocked";
              break;
            }
            if (_0x168437) {
              _0xfd6795.anti0Tick = 1;
              if (spikes.near && getEl("atSpike").checked && !_0x2d5dbc.insta.wait && !antispiketick) {
                spikes.aim = C.getDirection(spikes.near.x, spikes.near.y, E.x, E.y);
                spikes.dist = C.getDistance(spikes.near.x, spikes.near.y, E.x, E.y);
                let _0x1f7188 = spikes.dist - 25 < R.weapons[E.weapons[1] == 10 ? E.weapons[1] : E.weapons[0]].range + 100;
                let _0x257ff8 = spikes.dist - 25 < R.weapons[E.weapons[1] == 10 ? E.weapons[1] : E.weapons[0]].range + 35;
                if (_0x1f7188) {
                  spikes.nearSpike = true;
                  if (spikes.nearSpike && spikes.dist - 20 >= 65 && Date.now() - stopCD > 500) {
                    stopCD = Date.now();
                    ee.send("f", null);
                  }
                  if (_0x257ff8) {
                    _0x1982a2("");
                    spikes.nearBreak = true;
                  } else {
                    spikes.nearBreak = false;
                  }
                } else {
                  spikes.nearSpike = false;
                  spikes.nearBreak = false;
                }
              } else {
                spikes.nearSpike = false;
                spikes.nearBreak = false;
              }
              return true;
            }
          }
        } catch (_0xa8706) {
          return null;
        }
        return false;
      };
      function _0x366911(_0x3aa113, _0x355f41) {
        try {
          return Math.hypot((_0x355f41.y2 || _0x355f41.y) - (_0x3aa113.y2 || _0x3aa113.y), (_0x355f41.x2 || _0x355f41.x) - (_0x3aa113.x2 || _0x3aa113.x));
        } catch (_0x2dc9a0) {
          return Infinity;
        }
      }
      this.protect = function (_0x4c0ac8) {
        if (!_0x4f1036.antiTrap) {
          return;
        }
        if (_0x366911(_0x151041, _0x547655) > _0x366911(_0x151041, _0x4319f3.info)) {
          for (let _0x20b371 = -(Math.PI / 2); _0x20b371 < Math.PI / 2; _0x20b371 += Math.PI / 18) {
            _0x21e105(2, _0x151041.aim2 + _0x20b371);
          }
        } else if (_0x366911(_0x151041, _0x4319f3.info) > _0x366911(_0x151041, _0x547655)) {
          for (let _0x48d906 = -(Math.PI / 2); _0x48d906 < Math.PI / 2; _0x48d906 += Math.PI / 18) {
            _0x21e105(4, _0x151041.aim2 + _0x48d906);
          }
        }
      };
      this.autoPlace = function () {
        if (_0x5b81e2.length && _0x4f1036.autoPlace && !_0x94d477.ticking) {
          if (_0x65cac6.tick % (Math.max(1, parseInt(getEl("autoPlaceTick").value)) || 1) === 0) {
            if (_0x51a14e.length) {
              let _0x2082b8 = {
                inTrap: false
              };
              let _0x231bf7 = _0x51a14e.filter(_0x3e8b23 => _0x3e8b23.trap && _0x3e8b23.active && _0x3e8b23.isTeamObject(_0x547655) && _0xe697ce.getDist(_0x3e8b23, _0x151041, 0, 2) <= _0x151041.scale + _0x3e8b23.getScale() + 5).sort(function (_0x178ce6, _0x404e0a) {
                return _0xe697ce.getDist(_0x178ce6, _0x151041, 0, 2) - _0xe697ce.getDist(_0x404e0a, _0x151041, 0, 2);
              })[0];
              if (_0x231bf7) {
                _0x2082b8.inTrap = true;
              } else {
                _0x2082b8.inTrap = false;
              }
              if (_0x151041.dist3 <= 450) {
                if (_0x151041.dist2 <= 200) {
                  this.testCanPlace(2, 0, Math.PI * 2, Math.PI / 24, _0x151041.aim2);
                } else if (_0x547655.items[4] == 15) {
                  this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 24, _0x151041.aim2);
                }
              }
            } else if (_0x151041.dist3 <= 450) {
              if (_0x547655.items[4] == 15) {
                this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 24, _0x151041.aim2);
              }
            }
          }
        }
      };
      this.replacer = function (_0x4cece1) {
        if (!_0x4cece1 || !_0x4f1036.autoReplace) {
          return;
        }
        if (!_0x37b6ae) {
          return;
        }
        if (this.antiTrapped) {
          return;
        }
        _0x65cac6.tickBase(() => {
          let _0x3698c2 = _0xe697ce.getDirect(_0x4cece1, _0x547655, 0, 2);
          let _0x119e44 = _0xe697ce.getDist(_0x4cece1, _0x547655, 0, 2);
          if (getEl("weaponGrind").checked && _0x119e44 <= _0xcdfb4a.weapons[_0x547655.weaponIndex].range + _0x547655.scale) {
            return;
          }
          if (_0x119e44 <= 400 && _0x151041.dist2 <= 400) {
            let _0x532c11 = this.checkSpikeTick();
            if (!_0x532c11 && _0x151041.dist3 <= _0xcdfb4a.weapons[_0x151041.primaryIndex || 5].range + _0x151041.scale * 1.8) {
              this.testCanPlace(2, -(Math.PI / 2), Math.PI / 2, Math.PI / 18, _0x3698c2, 1);
              this.testCanPlace(2, 0, Math.PI * 2, Math.PI / 24, _0x3698c2, 1);
            } else if (_0x547655.items[4] == 15) {
              this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 24, _0x3698c2, 1);
            }
            this.replaced = true;
          }
        }, 1);
      };
    }
  }
  ;
  class _0x2e632e {
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
      this.changeType = function (_0x1ab0ec) {
        this.wait = false;
        this.isTrue = true;
        _0xfd6795.autoAim = true;
        let _0xf33680 = [_0x1ab0ec];
        if (_0x1ab0ec == "rev") {
          _0x48b469("6", "");
          _0x10e7fc(_0x547655.weapons[1]);
          _0x2c609b(53, 0);
          _0x2c609b(21, 1);
          _0x1079cb();
          _0x65cac6.tickBase(() => {
            _0x10e7fc(_0x547655.weapons[0]);
            _0x2c609b(7, 0);
            _0x2c609b(18, 1);
            _0x65cac6.tickBase(() => {
              _0x1079cb();
              this.isTrue = false;
              _0xfd6795.autoAim = false;
            }, 1);
          }, 1);
        } else if (_0x1ab0ec == "nobull") {
          _0x10e7fc(_0x547655.weapons[0]);
          _0x2c609b(7, 0);
          _0x1079cb();
          setTimeout(() => {
            _0x10e7fc(_0x547655.weapons[1]);
            _0x2c609b(_0x547655.reloads[53] == 0 ? 53 : 6, 0);
            setTimeout(() => {
              _0x1079cb();
              this.isTrue = false;
              _0xfd6795.autoAim = false;
            }, 255);
          }, 105);
        } else if (_0x1ab0ec == "normal") {
          _0x10e7fc(_0x547655.weapons[0]);
          _0x2c609b(7, 0);
          _0x1079cb();
          setTimeout(() => {
            _0x10e7fc(_0x547655.weapons[1]);
            _0x2c609b(_0x547655.reloads[53] == 0 ? 53 : 6, 0);
            setTimeout(() => {
              _0x1079cb();
              this.isTrue = false;
              _0xfd6795.autoAim = false;
            }, 255);
          }, 100);
        } else {
          setTimeout(() => {
            this.isTrue = false;
            _0xfd6795.autoAim = false;
          }, 50);
        }
      };
      this.spikeTickType = function () {
        _0x1982a2("");
        function _0x28b5a2(_0x50b618, _0x523f72) {
          const _0x541bb6 = _0x2ab6eb();
          _0x28b5a2 = function (_0x1e7ff4, _0x158e80) {
            _0x1e7ff4 = _0x1e7ff4 - 428;
            let _0x5bdb4a = _0x541bb6[_0x1e7ff4];
            return _0x5bdb4a;
          };
          return _0x28b5a2(_0x50b618, _0x523f72);
        }
        const _0x16f04a = _0x28b5a2;
        function _0x2ab6eb() {
          const _0x3c324f = ["isTrue", "457564gCvaSV", "10885830MiQKSV", "weapons", "    ", "tickBase", "5080FVGhcW", "2682NqHuOF", "3rkOQDg", "1960ijtPVr", "send", "getDirect", "986276xcsTAD", "11264ueamRE", "999429zeDXOx", "1503516UpKOdB", "25BlUGnX"];
          _0x2ab6eb = function () {
            return _0x3c324f;
          };
          return _0x2ab6eb();
        }
        (function (_0x279fc0, _0x154b7c) {
          const _0x39e00c = _0x28b5a2;
          const _0xf6b039 = _0x279fc0();
          while (true) {
            try {
              const _0x24e2d3 = -parseInt(_0x39e00c(437)) / 1 + parseInt(_0x39e00c(435)) / 2 * (parseInt(_0x39e00c(431)) / 3) + -parseInt(_0x39e00c(441)) / 4 * (parseInt(_0x39e00c(439)) / 5) + parseInt(_0x39e00c(442)) / 6 + parseInt(_0x39e00c(438)) / 7 + -parseInt(_0x39e00c(429)) / 8 * (-parseInt(_0x39e00c(430)) / 9) + -parseInt(_0x39e00c(432)) / 10 * (parseInt(_0x39e00c(436)) / 11);
              if (_0x24e2d3 === _0x154b7c) {
                break;
              } else {
                _0xf6b039.push(_0xf6b039.shift());
              }
            } catch (_0x17798c) {
              _0xf6b039.push(_0xf6b039.shift());
            }
          }
        })(_0x2ab6eb, 939373);
        let _0x24c4d6 = _0x1c7eec[_0x16f04a(434)](_0x3a3fd7, _0x547655, 0, 2);
        let _0x14f017 = 4;
        this[_0x16f04a(440)] = true;
        _0xfd6795.autoAim = true;
        _0x4bd292[_0x16f04a(433)]("6", _0x16f04a(444));
        _0x10e7fc(_0x547655[_0x16f04a(443)][0]);
        _0x2c609b(7, 0);
        _0x2c609b(21, 1);
        _0x1079cb();
        _0x65cac6[_0x16f04a(428)](() => {
          const _0x315bd4 = _0x16f04a;
          _0x10e7fc(_0x547655[_0x315bd4(443)][0]);
          _0x2c609b(53, 0);
          _0x2c609b(21, 1);
          _0x65cac6[_0x315bd4(428)](() => {
            _0x1079cb();
            this.isTrue = false;
            _0xfd6795.autoAim = false;
          }, 1);
        }, 1);
      };
      this.counterType = function () {
        this.isTrue = true;
        _0xfd6795.autoAim = true;
        _0x10e7fc(_0x547655.weapons[0]);
        _0x2c609b(7, 0);
        _0x2c609b(21, 1);
        _0x1079cb();
        _0x65cac6.tickBase(() => {
          const _0x3407f9 = getEl("turretCombat");
          if (_0x547655.reloads && _0x547655.reloads[53] === 0 && _0x3407f9 && _0x3407f9.checked) {
            _0x10e7fc(_0x547655.weapons[0]);
            _0x2c609b(53, 0);
            _0x2c609b(21, 1);
            _0x65cac6.tickBase(() => {
              _0x1079cb();
              this.isTrue = false;
              _0xfd6795.autoAim = false;
            }, 1);
          } else {
            _0x1079cb();
            this.isTrue = false;
            _0xfd6795.autoAim = false;
          }
        }, 1);
      };
      this.antiCounterType = function () {
        _0xfd6795.autoAim = true;
        this.isTrue = true;
        inantiantibull = true;
        _0x10e7fc(_0x547655.weapons[0]);
        _0x2c609b(6, 0);
        _0x2c609b(21, 1);
        _0x4bd292.send("", _0x151041.aim2);
        _0x1079cb();
        _0x65cac6.tickBase(() => {
          _0x2c609b(_0x547655.reloads[53] == 0 ? _0x547655.skins[53] ? 53 : 6 : 6, 0);
          _0x2c609b(21, 1);
          _0x65cac6.tickBase(() => {
            _0x1079cb();
            this.isTrue = false;
            _0xfd6795.autoAim = false;
            inantiantibull = false;
          }, 1);
        }, 1);
      };
      this.rangeType = function (_0x2be81f) {
        this.isTrue = true;
        _0xfd6795.autoAim = true;
        if (_0x2be81f == "ageInsta") {
          _0x1982a2("");
          _0xfd6795.ageInsta = false;
          if (_0x547655.items[5] == 18) {
            _0x39dd86(5, _0x151041.aim2);
          }
          _0x48b469("f", undefined, 1);
          _0x2c609b(22, 0);
          _0x2c609b(21, 1);
          _0x65cac6.tickBase(() => {
            _0x10e7fc(_0x547655.weapons[1]);
            _0x2c609b(53, 0);
            _0x2c609b(21, 1);
            _0x1079cb();
            _0x65cac6.tickBase(() => {
              _0x4bcf53(12);
              _0x10e7fc(_0x547655.weapons[1]);
              _0x2c609b(53, 0);
              _0x2c609b(21, 1);
              _0x65cac6.tickBase(() => {
                _0x4bcf53(15);
                _0x10e7fc(_0x547655.weapons[1]);
                _0x2c609b(53, 0);
                _0x2c609b(21, 1);
                _0x65cac6.tickBase(() => {
                  _0x1079cb();
                  this.isTrue = false;
                  _0xfd6795.autoAim = false;
                }, 1);
              }, 1);
            }, 1);
          }, 1);
        } else {
          _0x10e7fc(_0x547655.weapons[1]);
          if (_0x547655.reloads[53] == 0 && _0x151041.dist2 <= 700 && _0x151041.skinIndex != 22) {
            _0x2c609b(53, 0);
          } else {
            _0x2c609b(20, 0);
          }
          _0x2c609b(11, 1);
          _0x1079cb();
          _0x65cac6.tickBase(() => {
            _0x1079cb();
            this.isTrue = false;
            _0xfd6795.autoAim = false;
          }, 1);
        }
      };
      this.oneTickType = function () {
        _0x4bd292.send("");
        this.isTrue = true;
        _0xfd6795.autoAim = true;
        _0x10e7fc(_0x547655.weapons[1]);
        _0x2c609b(53, 0);
        _0x2c609b(19, 1);
        _0x48b469("f", _0x151041.aim2, 1);
        if (_0x547655.weapons[1] == 15) {
          _0xfd6795.revAim = true;
          _0x1079cb();
        }
        _0x65cac6.tickBase(() => {
          _0xfd6795.revAim = false;
          _0x10e7fc(_0x547655.weapons[0]);
          _0x2c609b(7, 0);
          _0x2c609b(19, 1);
          _0x48b469("f", _0x151041.aim2, 1);
          if (_0x547655.weapons[1] != 15) {
            _0x1079cb();
          }
          _0x65cac6.tickBase(() => {
            _0x1079cb();
            this.isTrue = false;
            _0xfd6795.autoAim = false;
            _0x48b469("f", undefined, 1);
          }, 1);
        }, 1);
      };
      this.threeOneTickType = function () {
        _0x4bd292.send("");
        this.isTrue = true;
        _0xfd6795.autoAim = true;
        _0x10e7fc(_0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0]);
        _0x293109();
        _0x2c609b(19, 1);
        _0x48b469("f", _0x151041.aim2, 1);
        _0x65cac6.tickBase(() => {
          _0x10e7fc(_0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0]);
          _0x2c609b(53, 0);
          _0x2c609b(19, 1);
          _0x48b469("f", _0x151041.aim2, 1);
          _0x65cac6.tickBase(() => {
            _0x10e7fc(_0x547655.weapons[0]);
            _0x2c609b(7, 0);
            _0x2c609b(19, 1);
            _0x1079cb();
            _0x48b469("f", _0x151041.aim2, 1);
            _0x65cac6.tickBase(() => {
              _0x1079cb();
              this.isTrue = false;
              _0xfd6795.autoAim = false;
              _0x48b469("f", undefined, 1);
            }, 1);
          }, 1);
        }, 1);
      };
      this.kmTickType = function () {
        this.isTrue = true;
        _0xfd6795.autoAim = true;
        _0xfd6795.revAim = true;
        _0x10e7fc(_0x547655.weapons[1]);
        _0x2c609b(53, 0);
        _0x2c609b(19, 1);
        _0x1079cb();
        _0x48b469("f", _0x151041.aim2, 1);
        _0x65cac6.tickBase(() => {
          _0xfd6795.revAim = false;
          _0x10e7fc(_0x547655.weapons[0]);
          _0x2c609b(7, 0);
          _0x2c609b(19, 1);
          _0x48b469("f", _0x151041.aim2, 1);
          _0x65cac6.tickBase(() => {
            _0x1079cb();
            this.isTrue = false;
            _0xfd6795.autoAim = false;
            _0x48b469("f", undefined, 1);
          }, 1);
        }, 1);
      };
      this.boostTickType = function () {
        this.isTrue = true;
        _0xfd6795.autoAim = true;
        _0x293109();
        _0x2c609b(19, 1);
        _0x48b469("f", _0x151041.aim2, 1);
        _0x65cac6.tickBase(() => {
          if (_0x547655.weapons[1] == 15) {
            _0xfd6795.revAim = true;
          }
          _0x10e7fc(_0x547655.weapons[[9, 12, 13, 15].includes(_0x547655.weapons[1]) ? 1 : 0]);
          _0x2c609b(53, 0);
          _0x2c609b(19, 1);
          if ([9, 12, 13, 15].includes(_0x547655.weapons[1])) {
            _0x1079cb();
          }
          _0x48b469("f", _0x151041.aim2, 1);
          _0x39dd86(4, _0x151041.aim2);
          _0x65cac6.tickBase(() => {
            _0xfd6795.revAim = false;
            _0x10e7fc(_0x547655.weapons[0]);
            _0x2c609b(7, 0);
            _0x2c609b(19, 1);
            if (![9, 12, 13, 15].includes(_0x547655.weapons[1])) {
              _0x1079cb();
            }
            _0x48b469("f", _0x151041.aim2, 1);
            _0x65cac6.tickBase(() => {
              _0x1079cb();
              this.isTrue = false;
              _0xfd6795.autoAim = false;
              _0x48b469("f", undefined, 1);
            }, 1);
          }, 1);
        }, 1);
      };
      this.gotoGoal = function (_0x1f6d30, _0x1349ea) {
        let _0x3cf407 = _0x1eabb1 => _0x1eabb1 * _0x4ee004.playerScale;
        let _0x2ea114 = {
          a: _0x1f6d30 - _0x1349ea,
          b: _0x1f6d30 + _0x1349ea,
          c: _0x1f6d30 - _0x3cf407(1),
          d: _0x1f6d30 + _0x3cf407(1),
          e: _0x1f6d30 - _0x3cf407(2),
          f: _0x1f6d30 + _0x3cf407(2),
          g: _0x1f6d30 - _0x3cf407(4),
          h: _0x1f6d30 + _0x3cf407(4)
        };
        let _0x136e3f = function (_0x3792ef, _0x20c5e2) {
          if (_0x547655.y2 >= _0x4ee004.mapScale / 2 - _0x4ee004.riverWidth / 2 && _0x547655.y2 <= _0x4ee004.mapScale / 2 + _0x4ee004.riverWidth / 2 && _0x20c5e2 == 0) {
            _0x2c609b(31, 0);
          } else {
            _0x2c609b(_0x3792ef, _0x20c5e2);
          }
        };
        if (_0x5b81e2.length) {
          let _0x82762 = _0x151041.dist2;
          this.ticking = true;
          if (_0x82762 >= _0x2ea114.a && _0x82762 <= _0x2ea114.b) {
            _0x136e3f(22, 0);
            _0x136e3f(11, 1);
            if (_0x547655.weaponIndex != _0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0] || _0x547655.buildIndex > -1) {
              _0x10e7fc(_0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0]);
            }
            return {
              dir: undefined,
              action: 1
            };
          } else {
            if (_0x82762 < _0x2ea114.a) {
              if (_0x82762 >= _0x2ea114.g) {
                if (_0x82762 >= _0x2ea114.e) {
                  if (_0x82762 >= _0x2ea114.c) {
                    _0x136e3f(40, 0);
                    _0x136e3f(10, 1);
                    if (_0x4f1036.none) {
                      if (_0x547655.buildIndex != _0x547655.items[1]) {
                        _0x1c7944(_0x547655.items[1]);
                      }
                    } else if (_0x547655.weaponIndex != _0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0] || _0x547655.buildIndex > -1) {
                      _0x10e7fc(_0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0]);
                    }
                  } else {
                    _0x136e3f(22, 0);
                    _0x136e3f(19, 1);
                    if (_0x547655.weaponIndex != _0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0] || _0x547655.buildIndex > -1) {
                      _0x10e7fc(_0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0]);
                    }
                  }
                } else {
                  _0x136e3f(6, 0);
                  _0x136e3f(12, 1);
                  if (_0x547655.weaponIndex != _0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0] || _0x547655.buildIndex > -1) {
                    _0x10e7fc(_0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0]);
                  }
                }
              } else {
                _0x293109();
                _0x136e3f(11, 1);
                if (_0x547655.weaponIndex != _0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0] || _0x547655.buildIndex > -1) {
                  _0x10e7fc(_0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0]);
                }
              }
              return {
                dir: _0x151041.aim2 + Math.PI,
                action: 0
              };
            } else if (_0x82762 > _0x2ea114.b) {
              if (_0x82762 <= _0x2ea114.h) {
                if (_0x82762 <= _0x2ea114.f) {
                  if (_0x82762 <= _0x2ea114.d) {
                    _0x136e3f(40, 0);
                    _0x136e3f(9, 1);
                    if (_0x4f1036.none) {
                      if (_0x547655.buildIndex != _0x547655.items[1]) {
                        _0x1c7944(_0x547655.items[1]);
                      }
                    } else if (_0x547655.weaponIndex != _0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0] || _0x547655.buildIndex > -1) {
                      _0x10e7fc(_0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0]);
                    }
                  } else {
                    _0x136e3f(22, 0);
                    _0x136e3f(19, 1);
                    if (_0x547655.weaponIndex != _0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0] || _0x547655.buildIndex > -1) {
                      _0x10e7fc(_0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0]);
                    }
                  }
                } else {
                  _0x136e3f(6, 0);
                  _0x136e3f(12, 1);
                  if (_0x547655.weaponIndex != _0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0] || _0x547655.buildIndex > -1) {
                    _0x10e7fc(_0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0]);
                  }
                }
              } else {
                _0x293109();
                _0x136e3f(11, 1);
                if (_0x547655.weaponIndex != _0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0] || _0x547655.buildIndex > -1) {
                  _0x10e7fc(_0x547655.weapons[[10, 14].includes(_0x547655.weapons[1]) ? 1 : 0]);
                }
              }
              return {
                dir: _0x151041.aim2,
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
      };
      this.bowMovement = function () {
        let _0x4748ee = this.gotoGoal(685, 3);
        if (_0x4748ee.action) {
          if (_0x547655.reloads[53] == 0 && !this.isTrue) {
            this.rangeType("ageInsta");
          } else {
            _0x48b469("f", _0x4748ee.dir, 1);
          }
        } else {
          _0x48b469("f", _0x4748ee.dir, 1);
        }
      };
      this.tickMovement = function () {
        let _0x58ea9e = _0x547655.weapons[1] == 9 ? 240 : 240;
        let _0x5e4aed = _0x547655.weapons[1] == 9 ? 2 : _0x547655.weapons[1] == 12 ? 1.5 : _0x547655.weapons[1] == 13 ? 1 : _0x547655.weapons[1] == 15 ? 2 : 3;
        let _0x419c65 = this.gotoGoal(238, 3);
        if (_0x419c65.action) {
          if (_0x547655.reloads[53] == 0 && !this.isTrue) {
            this.boostTickType();
          } else {
            _0x48b469("f", _0x419c65.dir, 1);
          }
        } else {
          _0x48b469("f", _0x419c65.dir, 1);
        }
      };
      this.kmTickMovement = function () {
        let _0x5ceb5b = this.gotoGoal(240, 3);
        if (_0x5ceb5b.action) {
          if (_0x151041.skinIndex != 22 && _0x547655.reloads[53] == 0 && !this.isTrue && (_0x65cac6.tick - _0x151041.poisonTick) % _0x4ee004.serverUpdateRate == 8) {
            this.kmTickType();
          } else {
            _0x48b469("f", _0x5ceb5b.dir, 1);
          }
        } else {
          _0x48b469("f", _0x5ceb5b.dir, 1);
        }
      };
      this.boostTickMovement = function () {
        let _0x22b530 = _0x547655.weapons[1] == 9 ? 365 : _0x547655.weapons[1] == 12 ? 380 : _0x547655.weapons[1] == 13 ? 365 : _0x547655.weapons[1] == 15 ? 365 : 370;
        let _0x22c7b8 = _0x547655.weapons[1] == 9 ? 2 : _0x547655.weapons[1] == 12 ? 1.5 : _0x547655.weapons[1] == 13 ? 1 : _0x547655.weapons[1] == 15 ? 2 : 3;
        let _0x3a90b6 = this.gotoGoal(372, 3);
        if (_0x3a90b6.action) {
          if (_0x547655.reloads[53] == 0 && !this.isTrue) {
            this.boostTickType();
          } else {
            _0x48b469("f", _0x3a90b6.dir, 1);
          }
        } else {
          _0x48b469("f", _0x3a90b6.dir, 1);
        }
      };
      this.perfCheck = function (_0xf63db2, _0x5abbf6) {
        if (_0x5abbf6.weaponIndex == 11 && _0x1c7eec.getAngleDist(_0x5abbf6.aim2 + Math.PI, _0x5abbf6.d2) <= _0x4ee004.shieldAngle) {
          return false;
        }
        if (![9, 12, 13, 15].includes(_0x547655.weapons[1])) {
          return true;
        }
        let _0x40f6ba = {
          x: _0x5abbf6.x2 + Math.cos(_0x5abbf6.aim2 + Math.PI) * 65,
          y: _0x5abbf6.y2 + Math.sin(_0x5abbf6.aim2 + Math.PI) * 65
        };
        if (_0x1c7eec.lineInRect(_0xf63db2.x2 - _0xf63db2.scale, _0xf63db2.y2 - _0xf63db2.scale, _0xf63db2.x2 + _0xf63db2.scale, _0xf63db2.y2 + _0xf63db2.scale, _0x40f6ba.x, _0x40f6ba.y, _0x40f6ba.x, _0x40f6ba.y)) {
          return true;
        }
        let _0x2318a8 = _0x201ec2.filter(_0x5dc041 => _0x5dc041.visible).find(_0x40cb62 => {
          if (_0x1c7eec.lineInRect(_0x40cb62.x2 - _0x40cb62.scale, _0x40cb62.y2 - _0x40cb62.scale, _0x40cb62.x2 + _0x40cb62.scale, _0x40cb62.y2 + _0x40cb62.scale, _0x40f6ba.x, _0x40f6ba.y, _0x40f6ba.x, _0x40f6ba.y)) {
            return true;
          }
        });
        if (_0x2318a8) {
          return false;
        }
        _0x2318a8 = _0x51a14e.filter(_0x42b936 => _0x42b936.active).find(_0x1459a3 => {
          let _0x324747 = _0x1459a3.getScale();
          if (!_0x1459a3.ignoreCollision && _0x1c7eec.lineInRect(_0x1459a3.x - _0x324747, _0x1459a3.y - _0x324747, _0x1459a3.x + _0x324747, _0x1459a3.y + _0x324747, _0x40f6ba.x, _0x40f6ba.y, _0x40f6ba.x, _0x40f6ba.y)) {
            return true;
          }
        });
        if (_0x2318a8) {
          return false;
        }
        return true;
      };
    }
  }
  ;
  class _0x3267e2 {
    constructor(_0x3e6d0c, _0x5abd61) {
      this.hat = function () {
        _0x3e6d0c.forEach(_0x190475 => {
          let _0x5e85d2 = _0x28234e(_0x2037c7, _0x190475);
          if (_0x5e85d2 && !_0x547655.skins[_0x190475] && _0x547655.points >= _0x5e85d2.price) {
            _0x48b469("c", 1, _0x190475, 0);
          }
        });
      };
      this.acc = function () {
        _0x5abd61.forEach(_0x26a882 => {
          let _0x1f2d13 = _0x28234e(_0x3cc681, _0x26a882);
          if (_0x1f2d13 && !_0x547655.tails[_0x26a882] && _0x547655.points >= _0x1f2d13.price) {
            _0x48b469("c", 1, _0x26a882, 1);
          }
        });
      };
    }
  }
  ;
  class _0x2d49a4 {
    constructor() {
      this.sb = function (_0x33c5bf) {
        _0x33c5bf(3);
        _0x33c5bf(17);
        _0x33c5bf(31);
        _0x33c5bf(23);
        _0x33c5bf(9);
        _0x33c5bf(38);
      };
      this.kh = function (_0x216aef) {
        _0x216aef(3);
        _0x216aef(17);
        _0x216aef(31);
        _0x216aef(23);
        _0x216aef(10);
        _0x216aef(38);
        _0x216aef(4);
        _0x216aef(25);
      };
      this.pb = function (_0x28fed4) {
        _0x28fed4(5);
        _0x28fed4(17);
        _0x28fed4(32);
        _0x28fed4(23);
        _0x28fed4(9);
        _0x28fed4(38);
      };
      this.ph = function (_0x373b98) {
        _0x373b98(5);
        _0x373b98(17);
        _0x373b98(32);
        _0x373b98(23);
        _0x373b98(10);
        _0x373b98(38);
        _0x373b98(28);
        _0x373b98(25);
      };
      this.db = function (_0x55768b) {
        _0x55768b(7);
        _0x55768b(17);
        _0x55768b(31);
        _0x55768b(23);
        _0x55768b(9);
        _0x55768b(34);
      };
    }
  }
  ;
  class _0x42f561 {
    constructor(_0x686057) {
      this.calcDmg = function (_0x25582e, _0x3c33fc) {
        return _0x25582e * _0x3c33fc;
      };
      this.getAllDamage = function (_0xffe37a) {
        return [this.calcDmg(_0xffe37a, 0.75), _0xffe37a, this.calcDmg(_0xffe37a, 1.125), this.calcDmg(_0xffe37a, 1.5)];
      };
      this.weapons = [];
      for (let _0xb20972 = 0; _0xb20972 < _0x686057.weapons.length; _0xb20972++) {
        let _0x1d782c = _0x686057.weapons[_0xb20972];
        let _0x39005f = _0x1d782c.name.split(" ").length <= 1 ? _0x1d782c.name : _0x1d782c.name.split(" ")[0] + "_" + _0x1d782c.name.split(" ")[1];
        this.weapons.push(this.getAllDamage(_0xb20972 > 8 ? _0x1d782c.Pdmg : _0x1d782c.dmg));
        this[_0x39005f] = this.weapons[_0xb20972];
      }
    }
  }
  let _0x389e5a = [];
  let _0x1c7eec = new _0x4d2239();
  let _0x146f01 = new _0x33827b();
  let _0x238b23 = new _0x48362d(_0x3c40d1, _0x4e7d72, _0x1c7eec, _0x4ee004);
  let _0xd2ad23 = new _0x3ed642();
  let _0x2037c7 = _0xd2ad23.hats;
  let _0x3cc681 = _0xd2ad23.accessories;
  let _0x49cea1 = new _0x2b219e(_0x3c1877, _0x65aa4d, _0x3c40e0, _0x201ec2, _0x238b23, _0x146f01, _0x4ee004, _0x1c7eec);
  let _0x5df1e6 = new _0x3e6ac1(_0x201ec2, _0x1bd689, _0x3c40e0, _0x146f01, null, _0x4ee004, _0x1c7eec);
  let _0x443fcc = new _0x289032();
  let _0x4319f3 = new _0x4d235d(_0x1c7eec, _0x146f01);
  let _0x94d477 = new _0x2e632e();
  let _0x3aa97e = new _0x3267e2([6, 7, 22, 12, 53, 40, 15, 31, 20], [11, 13, 19, 18, 21]);
  let _0x3ce909 = new _0x2d49a4();
  let _0x5f2ccd;
  let _0x5be014;
  let _0x524c78 = {};
  let _0x131176 = [];
  let _0x35b83a;
  let _0x216572 = [];
  let _0x57afbd = 0;
  let _0x5dd08b = [];
  let _0x4a49de = {
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
  function _0x1982a2(_0x10eefe) {
    _0x48b469("6", _0x10eefe.slice(0, 30));
  }
  let _0x26efb0 = [];
  function _0x4658aa(_0x503193, _0x5b4bd6, _0xf0980, _0x115185, _0x2778d9, _0x2819aa, _0x26d0ca, _0x180b1e) {
    let _0x1fda00 = _0x2819aa == 0 ? 9 : _0x2819aa == 2 ? 12 : _0x2819aa == 3 ? 13 : _0x2819aa == 5 && 15;
    let _0x29e2ae = _0x4ee004.playerScale * 2;
    let _0x55207f = {
      x: _0x2819aa == 1 ? _0x503193 : _0x503193 - _0x29e2ae * Math.cos(_0xf0980),
      y: _0x2819aa == 1 ? _0x5b4bd6 : _0x5b4bd6 - _0x29e2ae * Math.sin(_0xf0980)
    };
    let _0x2475d8 = _0x3c40e0.filter(_0x48d8cf => _0x48d8cf.visible && _0x1c7eec.getDist(_0x55207f, _0x48d8cf, 0, 2) <= _0x48d8cf.scale).sort(function (_0x5eacc1, _0x1aa215) {
      return _0x1c7eec.getDist(_0x55207f, _0x5eacc1, 0, 2) - _0x1c7eec.getDist(_0x55207f, _0x1aa215, 0, 2);
    })[0];
    if (_0x2475d8) {
      if (_0x2819aa == 1) {
        _0x2475d8.shooting[53] = 1;
      } else {
        _0x2475d8.shootIndex = _0x1fda00;
        _0x2475d8.shooting[1] = 1;
        _0x2ea9f9(_0x2475d8, _0xf0980, _0x115185, _0x2778d9, _0x2819aa, _0x1fda00);
      }
    }
  }
  let _0x5a33f7 = 0;
  function _0x2ea9f9(_0x172efe, _0xf282c8, _0x37cc05, _0x37ab70, _0x18e7b8, _0x11872a) {
    if (!_0x172efe.isTeam(_0x547655)) {
      _0xc22f37 = _0x1c7eec.getDirect(_0x547655, _0x172efe, 2, 2);
      if (_0x1c7eec.getAngleDist(_0xc22f37, _0xf282c8) <= 0.2) {
        _0x172efe.bowThreat[_0x11872a]++;
        if (_0x18e7b8 == 5) {
          _0x5a33f7++;
        }
        setTimeout(() => {
          _0x172efe.bowThreat[_0x11872a]--;
          if (_0x18e7b8 == 5) {
            _0x5a33f7--;
          }
        }, _0x37cc05 / _0x37ab70);
        if (_0x172efe.bowThreat[9] >= 1 && (_0x172efe.bowThreat[12] >= 1 || _0x172efe.bowThreat[15] >= 1)) {
          _0x39dd86(1, _0x172efe.aim2);
          _0xfd6795.anti0Tick = 4;
          if (!_0xfd6795.antiSync) {
            _0xca8428(4);
          }
        } else if (_0x5a33f7 >= 2) {
          _0x39dd86(1, _0x172efe.aim2);
          _0xfd6795.anti0Tick = 4;
          if (!_0xfd6795.antiSync) {
            _0xca8428(4);
          }
        }
      }
    }
  }
  function _0x3f4e7d(_0x423666, _0x542b3a, _0x243b89) {
    if (_0x547655 && _0x423666) {
      _0x1c7eec.removeAllChildren(_0x59526a);
      _0x59526a.classList.add("visible");
      _0x1c7eec.generateElement({
        id: "itemInfoName",
        text: _0x1c7eec.capitalizeFirst(_0x423666.name),
        parent: _0x59526a
      });
      _0x1c7eec.generateElement({
        id: "itemInfoDesc",
        text: _0x423666.desc,
        parent: _0x59526a
      });
      if (_0x243b89) {} else if (_0x542b3a) {
        _0x1c7eec.generateElement({
          class: "itemInfoReq",
          text: !_0x423666.type ? "primary" : "secondary",
          parent: _0x59526a
        });
      } else {
        for (let _0x59ed6a = 0; _0x59ed6a < _0x423666.req.length; _0x59ed6a += 2) {
          _0x1c7eec.generateElement({
            class: "itemInfoReq",
            html: _0x423666.req[_0x59ed6a] + "<span class='itemInfoReqVal'> x" + _0x423666.req[_0x59ed6a + 1] + "</span>",
            parent: _0x59526a
          });
        }
        if (_0x423666.group.limit) {
          _0x1c7eec.generateElement({
            class: "itemInfoLmt",
            text: (_0x547655.itemCounts[_0x423666.group.id] || 0) + "/" + (_0x4ee004.isSandbox ? 99 : _0x423666.group.limit),
            parent: _0x59526a
          });
        }
      }
    } else {
      _0x59526a.classList.remove("visible");
    }
  }
  window.addEventListener("resize", _0x1c7eec.checkTrusted(_0x2b4572));
  function _0x2b4572() {
    _0x3c4e85 = window.innerWidth;
    _0x3e9fd6 = window.innerHeight;
    let _0xd677ba = Math.max(_0x3c4e85 / _0x3d89ad, _0x3e9fd6 / _0x47e786) * _0x56b695;
    _0x4851e7.width = _0x3c4e85 * _0x56b695;
    _0x4851e7.height = _0x3e9fd6 * _0x56b695;
    _0x4851e7.style.width = _0x3c4e85 + "px";
    _0x4851e7.style.height = _0x3e9fd6 + "px";
    _0x3b5929.setTransform(_0xd677ba, 0, 0, _0xd677ba, (_0x3c4e85 * _0x56b695 - _0x3d89ad * _0xd677ba) / 2, (_0x3e9fd6 * _0x56b695 - _0x47e786 * _0xd677ba) / 2);
  }
  _0x2b4572();
  var _0x4ea428;
  const _0x490897 = document.getElementById("touch-controls-fullscreen");
  if (_0x490897) _0x490897.style.display = "block";
  _0x490897.addEventListener("mousemove", _0x1a8973, false);
  function _0x1a8973(_0xa1583b) {
    _0x11ec7b = _0xa1583b.clientX;
    _0x4bdd25 = _0xa1583b.clientY;
  }
  let _0x54660b = {
    left: false,
    middle: false,
    right: false
  };
  _0x490897.addEventListener("mousedown", _0x195eb0, false);
  function _0x195eb0(_0x54f2e8) {
    if (_0x537751 != 1) {
      _0x537751 = 1;
      if (_0x54f2e8.button == 0) {
        _0x54660b.left = true;
      } else if (_0x54f2e8.button == 1) {
        _0x54660b.middle = true;
      } else if (_0x54f2e8.button == 2) {
        _0x54660b.right = true;
      }
    }
  }
  _0x490897.addEventListener("mouseup", _0x1c7eec.checkTrusted(_0x423229));
  function _0x423229(_0x317a4e) {
    if (_0x537751 != 0) {
      _0x537751 = 0;
      if (_0x317a4e.button == 0) {
        _0x54660b.left = false;
      } else if (_0x317a4e.button == 1) {
        _0x54660b.middle = false;
      } else if (_0x317a4e.button == 2) {
        _0x54660b.right = false;
      }
    }
  }
  _0x490897.addEventListener("wheel", _0x4eb67a, false);
  function _0x4eb67a(_0x307405) {
    if (_0x307405.deltaY < 0) {
      wbe += 0.005;
      _0x3d89ad = _0x4ee004.maxScreenWidth * wbe;
      _0x47e786 = _0x4ee004.maxScreenHeight * wbe;
      _0x2b4572();
    } else {
      wbe -= 0.005;
      _0x3d89ad = _0x4ee004.maxScreenWidth * wbe;
      _0x47e786 = _0x4ee004.maxScreenHeight * wbe;
      _0x2b4572();
    }
  }
  function _0x2fd1a0() {
    let _0x3189ce = 0;
    let _0x2d0c4e = 0;
    for (let _0x389571 in _0x151b3b) {
      let _0x1b1df0 = _0x151b3b[_0x389571];
      _0x3189ce += !!_0x461765[_0x389571] * _0x1b1df0[0];
      _0x2d0c4e += !!_0x461765[_0x389571] * _0x1b1df0[1];
    }
    if (_0x3189ce == 0 && _0x2d0c4e == 0) {
      return undefined;
    } else {
      return Math.atan2(_0x2d0c4e, _0x3189ce);
    }
  }
  function _0x141e1c() {
    if (!_0x547655) {
      return 0;
    }
    if (!_0x547655.lockDir) {
      _0x259299 = Math.atan2(_0x4bdd25 - _0x3e9fd6 / 2, _0x11ec7b - _0x3c4e85 / 2);
    }
    return _0x259299 || 0;
  }
  let _0x5924ca = 0;
  let _0x83ae57 = Date.now();
  function _0x58dcd1(_0x36d3ef) {
    if (_0x36d3ef) {
      if (!_0x547655) {
        return "0";
      }
      if (_0xfd6795.autoAim || (_0x54660b.left || _0x50abc3 && _0x151041.dist2 <= _0x146f01.weapons[_0x547655.weapons[0]].range + _0x151041.scale * 1.8 && !_0x4319f3.inTrap) && _0x547655.reloads[_0x547655.weapons[0]] == 0) {
        _0x259299 = getEl("weaponGrind").checked ? "getSafeDir()" : _0x5b81e2.length ? _0xfd6795.revAim ? "(near.aim2 + Math.PI)" : "near.aim2" : "getSafeDir()";
      } else if (_0x54660b.right && _0x547655.reloads[_0x547655.weapons[1] == 10 ? _0x547655.weapons[1] : _0x547655.weapons[0]] == 0) {
        _0x259299 = "getSafeDir()";
      } else if (_0x4319f3.inTrap && _0x547655.reloads[_0x4319f3.notFast() ? _0x547655.weapons[1] : _0x547655.weapons[0]] == 0) {
        _0x259299 = "traps.aim";
      } else if (!_0x94d477.isTrue && _0x314bc9 && _0x547655.reloads[_0x7a5737() ? _0x547655.weapons[1] : _0x547655.weapons[0]] == 0) {
        _0x259299 = "aimSpike";
      } else if (!_0x547655.lockDir) {
        if (_0x4f1036.noDir) {
          return "undefined";
        }
        _0x259299 = "getSafeDir()";
      }
      return _0x259299;
    } else {
      if (!_0x547655) {
        return 0;
      }
      if (_0xfd6795.autoAim || (_0x54660b.left || _0x50abc3 && _0x151041.dist2 <= _0x146f01.weapons[_0x547655.weapons[0]].range + _0x151041.scale * 1.8 && !_0x4319f3.inTrap) && _0x547655.reloads[_0x547655.weapons[0]] == 0) {
        _0x259299 = getEl("weaponGrind").checked ? _0x141e1c() : _0x5b81e2.length ? _0xfd6795.revAim ? _0x151041.aim2 + Math.PI : _0x151041.aim2 : _0x141e1c();
      } else if (_0x54660b.right && _0x547655.reloads[_0x547655.weapons[1] == 10 ? _0x547655.weapons[1] : _0x547655.weapons[0]] == 0) {
        _0x259299 = _0x141e1c();
      } else if (_0x4319f3.inTrap && _0x547655.reloads[_0x4319f3.notFast() ? _0x547655.weapons[1] : _0x547655.weapons[0]] == 0) {
        _0x259299 = _0x4319f3.aim;
      } else if (!_0x94d477.isTrue && _0x314bc9 && _0x547655.reloads[_0x7a5737() ? _0x547655.weapons[1] : _0x547655.weapons[0]] == 0) {
        _0x259299 = _0x164623;
      } else if (!_0x547655.lockDir) {
        if (_0x4f1036.noDir) {
          return undefined;
        }
        _0x259299 = _0x141e1c();
      }
      return _0x259299 || 0;
    }
  }
  function _0x31c621() {
    if (!_0x547655) {
      return 0;
    }
    _0x259299 = _0x141e1c();
    return _0x259299 || 0;
  }
  function _0x4e2c77() {
    return _0x436875.style.display != "block" && _0x19c9b3.style.display != "block" && !_0x845539;
  }
  function _0x223cdb() {
    if (_0x255a00.style.display != "none") {
      let _0x5a6c5d = function (_0x746a4) {
        return {
          found: _0x746a4.startsWith("/") && _0x4ce0aa[_0x746a4.slice(1).split(" ")[0]],
          fv: _0x4ce0aa[_0x746a4.slice(1).split(" ")[0]]
        };
      };
      let _0xb3b0ce = _0x5a6c5d(_0x2dfbcc.value);
      if (_0xb3b0ce.found) {
        if (typeof _0xb3b0ce.fv.action === "function") {
          _0xb3b0ce.fv.action(_0x2dfbcc.value);
        }
      } else {
        _0x1982a2(_0x2dfbcc.value);
      }
      _0x2dfbcc.value = "";
      _0x2dfbcc.blur();
    } else if (_0x845539) {
      _0x2dfbcc.blur();
    } else {
      _0x2dfbcc.focus();
    }
  }
  function _0x5cd167(_0x9c2ef5) {
    let _0x16bab0 = _0x9c2ef5.which || _0x9c2ef5.keyCode || 0;
    if (_0x547655 && _0x547655.alive && _0x4e2c77()) {
      if (!_0x461765[_0x16bab0]) {
        _0x461765[_0x16bab0] = 1;
        _0x2126c4[_0x9c2ef5.key] = 1;
        if (_0x16bab0 == 27) {
          _0x104338 = !_0x104338;
          $("#menuDiv").toggle();
          $("#menuChatDiv").toggle();
        } else if (_0x16bab0 == 69) {
          _0x1079cb();
        } else if (_0x16bab0 == 66) {
          _0x94d477.syncTry();
        } else if (_0x16bab0 == 67) {
          _0x418232();
        } else if (_0x547655.weapons[_0x16bab0 - 49] != undefined) {
          _0x547655.weaponCode = _0x547655.weapons[_0x16bab0 - 49];
        } else if (_0x151b3b[_0x16bab0]) {
          _0x3b22c3();
        } else if (_0x9c2ef5.key == "0") {
          _0x4bd292.send("6", "");
        } else if (_0x9c2ef5.key == "C") {
          syncChat(getEl("songs").value);
        } else if (_0x9c2ef5.key == "/") {
          _0x1aecae();
          if (typeof window.debug == "function") {
            window.debug();
          }
          _0x4bd292.send("6", "");
        } else if (_0x9c2ef5.key == "m") {
          _0x4e1a4e.placeSpawnPads = !_0x4e1a4e.placeSpawnPads;
        } else if (_0x9c2ef5.key == "z") {
          _0x4e1a4e.place = !_0x4e1a4e.place;
        } else if (_0x9c2ef5.key == "Z") {
          if (typeof window.debug == "function") {
            window.debug();
          }
        } else if (_0x16bab0 == 32) {
          _0x48b469("F", 1, _0x141e1c(), 1);
          _0x48b469("F", 0, _0x141e1c(), 1);
        }
      }
    }
  }
  addEventListener("keydown", _0x1c7eec.checkTrusted(_0x5cd167));
  function _0x51af21(_0x2787b6) {
    if (_0x547655 && _0x547655.alive) {
      let _0x57d338 = _0x2787b6.which || _0x2787b6.keyCode || 0;
      if (_0x57d338 == 13) {
        _0x223cdb();
      } else if (_0x4e2c77()) {
        if (_0x461765[_0x57d338]) {
          _0x461765[_0x57d338] = 0;
          _0x2126c4[_0x2787b6.key] = 0;
          if (_0x151b3b[_0x57d338]) {
            _0x3b22c3();
          }
        }
      }
    }
  }
  window.addEventListener("keyup", _0x1c7eec.checkTrusted(_0x51af21));
  function _0x3b22c3() {
    if (_0x5b0f84) {
      _0x48b469("f", undefined, 1);
    } else {
      let _0x246027 = _0x2fd1a0();
      if (_0x36ebb3 == undefined || _0x246027 == undefined || Math.abs(_0x246027 - _0x36ebb3) > 0.3) {
        if (!_0xfd6795.autoPush && !_0x5b0f84) {
          _0x48b469("f", _0x246027, 1);
        }
        _0x36ebb3 = _0x246027;
      }
    }
  }
  function _0x4ec01a() {}
  _0x4ec01a();
  function _0x58dc17(_0x372e19) {
    return (_0x547655.scale + _0x372e19.getScale()) / (_0x547655.maxSpeed * _0x146f01.weapons[_0x547655.weaponIndex].spdMult) + (_0x372e19.dmg && !_0x372e19.isTeamObject(_0x547655) ? 35 : 0);
    if (_0x372e19.colDiv == 0.5) {
      return _0x372e19.scale * _0x372e19.colDiv;
    } else if (!_0x372e19.isTeamObject(_0x547655) && _0x372e19.dmg) {
      return _0x372e19.scale + _0x547655.scale;
    } else if (_0x372e19.isTeamObject(_0x547655) && _0x372e19.trap) {
      return 0;
    } else {
      return _0x372e19.scale;
    }
  }
  function _0x3a9cd5() {
    let _0xfbe6a4 = _0x4e7d72.filter(_0x100a21 => _0x547655.canSee(_0x100a21) && _0x100a21.active);
    for (let _0x3f04b5 = 0; _0x3f04b5 < _0x4a49de.grid; _0x3f04b5++) {
      _0x5dd08b[_0x3f04b5] = [];
      for (let _0x2b90e4 = 0; _0x2b90e4 < _0x4a49de.grid; _0x2b90e4++) {
        let _0x167778 = {
          x: _0x547655.x2 - _0x4a49de.scale / 2 + _0x4a49de.scale / _0x4a49de.grid * _0x2b90e4,
          y: _0x547655.y2 - _0x4a49de.scale / 2 + _0x4a49de.scale / _0x4a49de.grid * _0x3f04b5
        };
        if (_0x1c7eec.getDist(_0x4a49de.chaseNear ? _0x151041 : _0x4a49de, _0x167778, _0x4a49de.chaseNear ? 2 : 0, 0) <= (_0x4a49de.chaseNear ? 35 : 60)) {
          _0x4a49de.lastX = _0x2b90e4;
          _0x4a49de.lastY = _0x3f04b5;
          _0x5dd08b[_0x3f04b5][_0x2b90e4] = 0;
          continue;
        }
        let _0x5dd4b8 = _0xfbe6a4.find(_0x420410 => _0x1c7eec.getDist(_0x420410, _0x167778, 0, 0) <= _0x58dc17(_0x420410));
        if (_0x5dd4b8) {
          if (_0x5dd4b8.trap) {
            _0x5dd08b[_0x3f04b5][_0x2b90e4] = 0;
            continue;
          }
          _0x5dd08b[_0x3f04b5][_0x2b90e4] = 1;
        } else {
          _0x5dd08b[_0x3f04b5][_0x2b90e4] = 0;
        }
      }
    }
  }
  function _0x53d2ee() {
    _0x5dd08b = [];
    _0x3a9cd5();
  }
  function _0x497598() {
    _0x4a49de.scale = _0x4ee004.maxScreenWidth / 2 * 1.3;
    if (!_0x4319f3.inTrap && (_0x4a49de.chaseNear ? _0x5b81e2.length : true)) {
      if (_0x151041.dist2 <= _0x146f01.weapons[_0x547655.weapons[0]].range) {
        _0x48b469("f", undefined, 1);
      } else {
        _0x53d2ee();
        easystar.setGrid(_0x5dd08b);
        easystar.setAcceptableTiles([0]);
        easystar.enableDiagonals();
        easystar.findPath(_0x5dd08b[0].length / 2, _0x5dd08b.length / 2, _0x4a49de.lastX, _0x4a49de.lastY, function (_0x2f91ca) {
          if (_0x2f91ca === null) {
            _0x4a49de.array = [];
            if (_0x151041.dist2 <= _0x146f01.weapons[_0x547655.weapons[0]].range) {
              _0x48b469("f", undefined, 1);
            } else {
              _0x48b469("f", _0x151041.aim2, 1);
            }
          } else {
            _0x4a49de.array = _0x2f91ca;
            if (_0x4a49de.array.length > 1) {
              let _0x439780 = {
                x: _0x547655.x2 - _0x4a49de.scale / 2 + _0x4a49de.scale / _0x4a49de.grid * _0x2f91ca[1].x,
                y: _0x547655.y2 - _0x4a49de.scale / 2 + _0x4a49de.scale / _0x4a49de.grid * _0x2f91ca[1].y
              };
              _0x48b469("f", _0x1c7eec.getDirect(_0x439780, _0x547655, 0, 2), 1);
            }
          }
        });
        easystar.calculate();
      }
    }
  }
  function _0x4bebcb() {
    let _0x4f0372 = _0x51a14e.filter(_0x21911e => _0x21911e.trap && _0x21911e.active && _0x21911e.isTeamObject(_0x547655)).map(_0x21b765 => ({
      obj: _0x21b765,
      dist: _0x1c7eec.getDist(_0x21b765, _0x151041, 0, 2)
    })).filter(_0x53878f => _0x53878f.dist <= _0x151041.scale + _0x53878f.obj.getScale() + 5).sort((_0x515f3f, _0x14155d) => _0x515f3f.dist - _0x14155d.dist)[0]?.obj;
    if (_0x4f0372) {
      let _0x15b72d = _0x51a14e.filter(_0xe73310 => _0xe73310.dmg && _0xe73310.active && _0xe73310.isTeamObject(_0x547655)).map(_0x14ff1c => ({
        obj: _0x14ff1c,
        dist: _0x1c7eec.getDist(_0x14ff1c, _0x4f0372, 0, 0)
      })).filter(_0x1d5e82 => _0x1d5e82.dist <= _0x151041.scale + _0x4f0372.scale + _0x1d5e82.obj.scale).sort((_0x6f87aa, _0x58d494) => _0x6f87aa.dist - _0x58d494.dist)[0]?.obj;
      if (_0x15b72d) {
        let _0x25e0db = Math.atan2(_0x151041.y2 - _0x15b72d.y, _0x151041.x2 - _0x15b72d.x);
        _0xfd6795.autoPush = true;
        _0xfd6795.pushData = {
          x: _0x15b72d.x + Math.cos(_0x25e0db),
          y: _0x15b72d.y + Math.sin(_0x25e0db),
          x2: _0x547655.x2 + 30,
          y2: _0x547655.y2 + 30
        };
        let _0x8e5e05 = {
          x: _0x151041.x2 + Math.cos(_0x25e0db) * 30,
          y: _0x151041.y2 + Math.sin(_0x25e0db) * 60
        };
        let _0x267da4 = Math.atan2(_0x8e5e05.y - _0x547655.y2, _0x8e5e05.x - _0x547655.x2);
        _0x48b469("f", _0x267da4, 1);
      } else if (_0xfd6795.autoPush) {
        _0xfd6795.autoPush = false;
        _0x48b469("f", _0x36ebb3 || undefined, 1);
      }
    } else if (_0xfd6795.autoPush) {
      _0xfd6795.autoPush = false;
      _0x48b469("f", _0x36ebb3 || undefined, 1);
    }
  }
  function _0x2fcfa9(_0x10fb93) {
    _0x206e14.push(new _0x3b8393(_0x10fb93.x, _0x10fb93.y, _0x10fb93.dir, _0x10fb93.buildIndex, _0x10fb93.weaponIndex, _0x10fb93.weaponVariant, _0x10fb93.skinColor, _0x10fb93.scale, _0x10fb93.name));
  }
  function _0x4bd174(_0x1b34b7) {
    _0x44504d = _0x1b34b7.teams;
  }
  function _0x5c30d7(_0x1db53b) {
    _0x461765 = {};
    _0x2126c4 = {};
    _0x2f7569 = _0x1db53b;
    _0x537751 = 0;
    _0x37b6ae = true;
    _0x48b469("F", 0, _0x58dcd1(), 1);
    _0xfd6795.ageInsta = true;
    if (_0x434568) {
      _0x434568 = false;
      _0x4e7d72.length = 0;
      _0x51a14e.length = 0;
    }
  }
  function _0x4af42a(_0x2cfeef, _0x4d7112) {
    let _0x6d0ae2 = _0x24d0c1(_0x2cfeef[0]);
    if (!_0x6d0ae2) {
      _0x6d0ae2 = new _0x591fa1(_0x2cfeef[0], _0x2cfeef[1], _0x4ee004, _0x1c7eec, _0x49cea1, _0x238b23, _0x3c40e0, _0x201ec2, _0x146f01, _0x2037c7, _0x3cc681);
      _0x3c40e0.push(_0x6d0ae2);
      if (_0x2cfeef[1] != _0x2f7569) {
        _0x5b6587(null, "Found " + _0x2cfeef[2] + " {" + _0x2cfeef[1] + "}", "Purple");
      }
    } else if (_0x2cfeef[1] != _0x2f7569) {
      _0x5b6587(null, "Found " + _0x2cfeef[2] + " {" + _0x2cfeef[1] + "}", "Purple");
    }
    _0x6d0ae2.spawn(_0x4d7112 ? true : null);
    _0x6d0ae2.visible = false;
    _0x6d0ae2.oldPos = {
      x2: undefined,
      y2: undefined
    };
    _0x6d0ae2.x2 = undefined;
    _0x6d0ae2.y2 = undefined;
    _0x6d0ae2.x3 = undefined;
    _0x6d0ae2.y3 = undefined;
    _0x6d0ae2.setData(_0x2cfeef);
    if (_0x4d7112) {
      if (!_0x547655) {
        window.prepareUI(_0x6d0ae2);
      }
      _0x547655 = _0x6d0ae2;
      _0xe46d09 = _0x547655.x;
      _0x5319f3 = _0x547655.y;
      _0xfd6795.lastDir = 0;
      _0x21b8ad();
      _0x3f3316();
      updateItemCountDisplay();
      if (_0x547655.skins[7]) {
        _0xfd6795.reSync = true;
      }
    }
  }
  function _0xf0136d(_0x125366) {
    for (let _0xf6cddd = 0; _0xf6cddd < _0x3c40e0.length; _0xf6cddd++) {
      if (_0x3c40e0[_0xf6cddd].id == _0x125366) {
        _0x5b6587("Game", _0x3c40e0[_0xf6cddd].name + "[" + _0x3c40e0[_0xf6cddd].sid + "] left the game", "Carmine");
        _0x3c40e0.splice(_0xf6cddd, 1);
        break;
      }
    }
  }
  function _0x3649bc(_0x20c823, _0x8fb460) {
    _0x3a3fd7 = _0x56d1d9(_0x20c823);
    if (_0x3a3fd7) {
      _0x3a3fd7.oldHealth = _0x3a3fd7.health;
      _0x3a3fd7.health = _0x8fb460;
      _0x3a3fd7.judgeShame();
      if (_0x3a3fd7.oldHealth > _0x3a3fd7.health) {
        _0x3a3fd7.damaged = _0x3a3fd7.oldHealth - _0x3a3fd7.health;
        _0x312fd.push([_0x20c823, _0x8fb460, _0x3a3fd7.damaged]);
      }
    }
  }
  function _0x30af64() {
    _0x37b6ae = false;
    _0x5f2ccd = {
      x: _0x547655.x,
      y: _0x547655.y
    };
    if (_0x4f1036.autoRespawn) {
      getEl("diedText").style.display = "none";
      _0x48b469("M", {
        name: _0x1b0bdf[0],
        moofoll: _0x1b0bdf[1],
        skin: _0x1b0bdf[2]
      });
    }
  }
  function _0x59c08f(_0x5cf264, _0x365934) {
    if (_0x547655) {
      _0x547655.itemCounts[_0x5cf264] = _0x365934;
      updateItemCountDisplay(_0x5cf264);
    }
  }
  function _0x3f3316(_0x356a57, _0x487230, _0x5c87c1) {
    if (_0x356a57 != undefined) {
      _0x547655.XP = _0x356a57;
    }
    if (_0x487230 != undefined) {
      _0x547655.maxXP = _0x487230;
    }
    if (_0x5c87c1 != undefined) {
      _0x547655.age = _0x5c87c1;
    }
  }
  function _0x1ed0e1(_0x1a69ba, _0x3d9912) {
    _0x547655.upgradePoints = _0x1a69ba;
    _0x547655.upgrAge = _0x3d9912;
    if (_0x1a69ba > 0) {
      _0x389e5a.length = 0;
      _0x1c7eec.removeAllChildren(_0x3dfc1d);
      for (let _0x5a7a23 = 0; _0x5a7a23 < _0x146f01.weapons.length; ++_0x5a7a23) {
        if (_0x146f01.weapons[_0x5a7a23].age == _0x3d9912 && (_0x146f01.weapons[_0x5a7a23].pre == undefined || _0x547655.weapons.indexOf(_0x146f01.weapons[_0x5a7a23].pre) >= 0)) {
          let _0x1e9415 = _0x1c7eec.generateElement({
            id: "upgradeItem" + _0x5a7a23,
            class: "actionBarItem",
            onmouseout: function () {
              _0x3f4e7d();
            },
            parent: _0x3dfc1d
          });
          _0x1e9415.style.backgroundImage = getEl("actionBarItem" + _0x5a7a23).style.backgroundImage;
          _0x389e5a.push(_0x5a7a23);
        }
      }
      for (let _0x4bda1b = 0; _0x4bda1b < _0x146f01.list.length; ++_0x4bda1b) {
        if (_0x146f01.list[_0x4bda1b].age == _0x3d9912 && (_0x146f01.list[_0x4bda1b].pre == undefined || _0x547655.items.indexOf(_0x146f01.list[_0x4bda1b].pre) >= 0)) {
          let _0x52d95c = _0x146f01.weapons.length + _0x4bda1b;
          let _0x28394c = _0x1c7eec.generateElement({
            id: "upgradeItem" + _0x52d95c,
            class: "actionBarItem",
            onmouseout: function () {
              _0x3f4e7d();
            },
            parent: _0x3dfc1d
          });
          _0x28394c.style.backgroundImage = getEl("actionBarItem" + _0x52d95c).style.backgroundImage;
          _0x389e5a.push(_0x52d95c);
        }
      }
      for (let _0x5324da = 0; _0x5324da < _0x389e5a.length; _0x5324da++) {
        (function (_0x509260) {
          let _0x3bc3b8 = getEl("upgradeItem" + _0x509260);
          _0x3bc3b8.onclick = _0x1c7eec.checkTrusted(function () {
            _0x48b469("H", _0x509260);
          });
          _0x1c7eec.hookTouchEvents(_0x3bc3b8);
        })(_0x389e5a[_0x5324da]);
      }
      if (_0x389e5a.length) {
        _0x3dfc1d.style.display = "block";
        _0x4ffa3e.style.display = "block";
        _0x4ffa3e.innerHTML = "SELECT ITEMS (" + _0x1a69ba + ")";
      } else {
        _0x3dfc1d.style.display = "none";
        _0x4ffa3e.style.display = "none";
        _0x3f4e7d();
      }
    } else {
      _0x3dfc1d.style.display = "none";
      _0x4ffa3e.style.display = "none";
      _0x3f4e7d();
    }
  }
  function _0x3f48ea(_0x4b3676, _0x57c198) {
    const _0x4d8fd0 = _0xf0305e();
    _0x3f48ea = function (_0x1583a6, _0x47e2d2) {
      _0x1583a6 = _0x1583a6 - 223;
      let _0xf820b6 = _0x4d8fd0[_0x1583a6];
      return _0xf820b6;
    };
    return _0x3f48ea(_0x4b3676, _0x57c198);
  }
  (function (_0x5d39cd, _0x135225) {
    const _0x2a0009 = _0x3f48ea;
    const _0x23bc12 = _0x5d39cd();
    while (true) {
      try {
        const _0x558f25 = -parseInt(_0x2a0009(225)) / 1 + parseInt(_0x2a0009(239)) / 2 + -parseInt(_0x2a0009(224)) / 3 * (-parseInt(_0x2a0009(237)) / 4) + parseInt(_0x2a0009(227)) / 5 + parseInt(_0x2a0009(229)) / 6 + -parseInt(_0x2a0009(223)) / 7 * (parseInt(_0x2a0009(236)) / 8) + parseInt(_0x2a0009(231)) / 9 * (parseInt(_0x2a0009(230)) / 10);
        if (_0x558f25 === _0x135225) {
          break;
        } else {
          _0x23bc12.push(_0x23bc12.shift());
        }
      } catch (_0x2b6839) {
        _0x23bc12.push(_0x23bc12.shift());
      }
    }
  })(_0xf0305e, 145791);
  function _0xf0305e() {
    const _0x153118 = ["send", "  ", "8YphnCx", "527168azlACX", "#cc0000", "23220HlBCcl", "1815317jBsgzR", "6DhJSqX", "184841nQOhDp", "showText", "118660MudszC", "aim2", "267342lmZHhF", "23700YNYyAX", "936IuVCJX", "getDirect", "    "];
    _0xf0305e = function () {
      return _0x153118;
    };
    return _0xf0305e();
  }
  function _0x319c35() {
    const _0x5a7950 = _0x3f48ea;
    let _0x5bbccd = 4;
    let _0x39edde = _0x1c7eec[_0x5a7950(232)](_0x3a3fd7, _0x547655, 0, 2);
    _0x2c609b(7, 0);
    _0x2c609b(18, 1);
    _0x10e7fc(_0x547655.weapons[0]);
    _0x4bd292[_0x5a7950(234)]("F", 1, _0x151041[_0x5a7950(228)]);
    _0x443fcc[_0x5a7950(226)](_0x547655.x2, _0x547655.y2, 30, 0.1, 1850, _0x5a7950(235), _0x5a7950(238), 2);
    _0x39dd86(2, _0x39edde);
    _0x39dd86(2, _0x151041[_0x5a7950(228)]);
    for (let _0x3d07b3 = 0; _0x3d07b3 < _0x5bbccd; _0x3d07b3++) {
      _0x4bd292[_0x5a7950(234)]("6", _0x5a7950(233));
      _0x21e105(2, _0x151041[_0x5a7950(228)] - 90 + _0x3d07b3 * 45);
    }
    _0x58aab9(() => {
      _0x2c609b(53, 0);
      _0x2c609b(21, 1);
      _0x58aab9(() => {
        const _0x506c68 = _0x3f48ea;
        _0x4bd292[_0x506c68(234)]("F", 0, _0x151041[_0x506c68(228)]);
        _0x2c609b(6, 0);
      }, 3);
    }, 1);
  }
  (function (_0x5a6a77, _0xf90a2a) {
    const _0x4b2765 = _0x2b94fc;
    const _0x544550 = _0x5a6a77();
    while (true) {
      try {
        const _0x4aaabe = parseInt(_0x4b2765(495)) / 1 * (-parseInt(_0x4b2765(482)) / 2) + parseInt(_0x4b2765(490)) / 3 + -parseInt(_0x4b2765(502)) / 4 + parseInt(_0x4b2765(488)) / 5 * (-parseInt(_0x4b2765(479)) / 6) + -parseInt(_0x4b2765(475)) / 7 * (-parseInt(_0x4b2765(487)) / 8) + -parseInt(_0x4b2765(491)) / 9 * (-parseInt(_0x4b2765(500)) / 10) + parseInt(_0x4b2765(498)) / 11;
        if (_0x4aaabe === _0xf90a2a) {
          break;
        } else {
          _0x544550.push(_0x544550.shift());
        }
      } catch (_0x559dba) {
        _0x544550.push(_0x544550.shift());
      }
    }
  })(_0x1e8527, 495072);
  const _0x50bb8c = (_0x22d1ee, _0x1c988d) => {
    const _0x46af5b = _0x2b94fc;
    const _0x3f65b0 = _0x1c988d.weapons[1] === 10 && !_0x547655.reloads[_0x1c988d.weapons[1]] ? 1 : 0;
    const _0x573b04 = _0x1c988d[_0x46af5b(506)][_0x3f65b0];
    if (_0x547655[_0x46af5b(503)][_0x573b04]) {
      return 0;
    }
    const _0x5ed118 = _0x146f01[_0x46af5b(506)][_0x573b04];
    const _0x496ed6 = _0xd428f7(_0x22d1ee, _0x1c988d) <= _0x22d1ee[_0x46af5b(496)]() + _0x5ed118[_0x46af5b(497)];
    if (_0x1c988d[_0x46af5b(504)] && _0x496ed6) {
      return _0x5ed118[_0x46af5b(499)] * (_0x5ed118[_0x46af5b(480)] || 1) * 3.3;
    } else {
      return 0;
    }
  };
  const _0x46e8c4 = () => {
    const _0x506117 = _0x2b94fc;
    const _0x271943 = [];
    const _0x572469 = _0x547655.x;
    const _0x5ba534 = _0x547655.y;
    const _0x1cfa2b = _0x4e7d72[_0x506117(492)];
    for (let _0x5e303c = 0; _0x5e303c < _0x1cfa2b; _0x5e303c++) {
      const _0x25267b = _0x4e7d72[_0x5e303c];
      if (_0x25267b[_0x506117(493)] && _0x25267b[_0x506117(508)] && _0x25267b.health > 0) {
        const _0x4b5200 = _0x146f01[_0x506117(501)][_0x25267b.id];
        const _0x4bb93a = 35 + _0x4b5200[_0x506117(505)] + (_0x4b5200[_0x506117(483)] || 0);
        const _0x5d8c65 = _0xd428f7(_0x25267b, _0x547655) <= _0x4bb93a * 2;
        if (_0x5d8c65) {
          let _0x54e66d = 0;
          const _0x48e84e = _0x3c40e0[_0x506117(492)];
          for (let _0x3f45bb = 0; _0x3f45bb < _0x48e84e; _0x3f45bb++) {
            _0x54e66d += _0x50bb8c(_0x25267b, _0x3c40e0[_0x3f45bb]);
          }
          if (_0x25267b.health <= _0x54e66d) {
            _0x271943[_0x506117(478)](_0x25267b);
          }
        }
      }
    }
    const _0xf1d49b = (_0x111ea5, _0x1e5d1c, _0x1e423c) => {
      const _0x5993dc = _0x506117;
      if (!_0x1e423c) {
        return null;
      }
      const _0x4ba42a = Math.PI * 2;
      const _0x34115a = Math.PI / 360;
      const _0x330030 = _0x146f01[_0x5993dc(501)][_0x111ea5[_0x5993dc(484)][_0x1e5d1c]];
      let _0x411b1d = Math.atan2(_0x1e423c.y - _0x111ea5.y, _0x1e423c.x - _0x111ea5.x);
      let _0x2f087a = _0x111ea5[_0x5993dc(505)] + (_0x330030[_0x5993dc(505)] || 1) + (_0x330030[_0x5993dc(483)] || 0);
      for (let _0x5e5978 = 0; _0x5e5978 < _0x4ba42a; _0x5e5978 += _0x34115a) {
        let _0x1eb26c = [(_0x411b1d + _0x5e5978) % _0x4ba42a, (_0x411b1d - _0x5e5978 + _0x4ba42a) % _0x4ba42a];
        for (let _0x405bc5 of _0x1eb26c) {
          return _0x405bc5;
        }
      }
      return null;
    };
    const _0x2cdcf9 = () => {
      const _0x28264f = _0x506117;
      let _0x5594a1 = _0x51a14e[_0x28264f(494)](_0x2d2e6b => _0x2d2e6b[_0x28264f(489)] && _0x2d2e6b[_0x28264f(508)] && _0x2d2e6b[_0x28264f(481)](_0x547655) && _0xd428f7(_0x2d2e6b, _0x547655) <= _0x2d2e6b[_0x28264f(496)]() + 5);
      let _0x15ddde = _0x4e7d72[_0x28264f(477)](_0x286a27 => _0x286a27.dmg && _0x286a27[_0x28264f(508)] && _0x286a27.isTeamObject(_0x547655) && _0xd428f7(_0x286a27, _0x547655) < 87 && !_0x5594a1[_0x28264f(492)]);
      const _0x230a7b = _0x15ddde ? 4 : 2;
      _0x271943[_0x28264f(485)](_0x4dbea1 => {
        const _0x3c1480 = _0x28264f;
        let _0x55c8f4 = _0xf1d49b(_0x547655, _0x230a7b, _0x4dbea1);
        if (_0x55c8f4 !== null) {
          _0x39dd86(_0x230a7b, _0x55c8f4);
          if (_0x230a7b == 4) {
            _0x443fcc.showText(_0x547655.x2, _0x547655.y2, 30, 0.15, 1850, "  ", _0x3c1480(486), 2);
          } else if (_0x230a7b == 2) {
            _0x443fcc[_0x3c1480(507)](_0x547655.x2, _0x547655.y2, 30, 0.15, 1850, "  ", _0x3c1480(486), 2);
          }
        }
      });
    };
    if (_0x151041 && _0x151041[_0x506117(476)] <= 360) {
      _0x2cdcf9();
    }
    _0x2cdcf9;
  };
  function _0x2b94fc(_0x5dc488, _0x142e0c) {
    const _0x21e974 = _0x1e8527();
    _0x2b94fc = function (_0x58987c, _0x3c7a2a) {
      _0x58987c = _0x58987c - 475;
      let _0x221b32 = _0x21e974[_0x58987c];
      return _0x221b32;
    };
    return _0x2b94fc(_0x5dc488, _0x142e0c);
  }
  function _0x1e8527() {
    const _0x50921c = ["#444444", "136mVzjEH", "5dSOfcP", "trap", "1860297HuBgTp", "36rYSJjS", "length", "isItem", "filter", "51DpHCEa", "getScale", "range", "450329wOtNEr", "dmg", "1835530UjnEkx", "list", "1718844BEDDAB", "reloads", "visible", "scale", "weapons", "showText", "active", "100527oZMABi", "dist3", "find", "push", "1948866XWDNrH", "sDmg", "isTeamObject", "15286bMiZeV", "placeOffset", "items", "forEach"];
    _0x1e8527 = function () {
      return _0x50921c;
    };
    return _0x1e8527();
  }
  function _0x20a0ae(_0x3e7e55) {
    let _0x1f8cab = _0x4510e0(_0x3e7e55);
    _0x238b23.disableBySid(_0x3e7e55);
    _0x46e8c4();
    if (_0x547655) {
      for (let _0x352079 = 0; _0x352079 < _0x46c306.length; _0x352079++) {
        if (_0x46c306[_0x352079].sid == _0x3e7e55) {
          _0x46c306.splice(_0x352079, 1);
          break;
        }
      }
      if (!_0x547655.canSee(_0x1f8cab)) {
        _0x216572.push({
          x: _0x1f8cab.x,
          y: _0x1f8cab.y
        });
      }
      if (_0x216572.length > 8) {
        _0x216572.shift();
      }
      _0x4319f3.replacer(_0x1f8cab);
    }
    let _0x431e91 = _0x151041;
    let _0x301866 = _0x547655;
    let _0xd17054 = _0xd428f7(_0x301866, _0x431e91);
    let _0x3bc761 = _0x651014(_0x301866, _0x431e91);
    let _0x335a2b = Math.atan2(_0x1f8cab.y - _0x547655.y2, _0x1f8cab.x - _0x547655.x2);
    let _0x6b6e3a = Math.hypot(_0x1f8cab.y - _0x547655.y2, _0x1f8cab.x - _0x547655.x2);
    let _0x21d7cc = [0, 0];
    let _0x1b4f2a = function (_0x27e675, _0x3ea9d0) {
      _0x21e105(_0x27e675, _0x3ea9d0);
    };
    var _0x5d2d40 = _0xa15a2f;
    (function (_0x132078, _0x53a784) {
      var _0x18071c = _0xa15a2f;
      var _0x190da8 = _0x132078();
      while (true) {
        try {
          var _0x17939c = -parseInt(_0x18071c(389)) / 1 * (parseInt(_0x18071c(384)) / 2) + -parseInt(_0x18071c(386)) / 3 * (parseInt(_0x18071c(391)) / 4) + -parseInt(_0x18071c(392)) / 5 * (parseInt(_0x18071c(383)) / 6) + -parseInt(_0x18071c(390)) / 7 * (parseInt(_0x18071c(387)) / 8) + -parseInt(_0x18071c(382)) / 9 + parseInt(_0x18071c(385)) / 10 + parseInt(_0x18071c(393)) / 11;
          if (_0x17939c === _0x53a784) {
            break;
          } else {
            _0x190da8.push(_0x190da8.shift());
          }
        } catch (_0x21201c) {
          _0x190da8.push(_0x190da8.shift());
        }
      }
    })(_0x395adb, 944262);
    function _0x395adb() {
      var _0x1882ca = ["10358290zJMcMn", "186OEqAyT", "322344OrmXCQ", "weapons", "1811219cCdovw", "259qVCKTe", "7120JcioIi", "5OmKvjS", "58568620sXeFaY", "reloads", "14137506pNYEUK", "2596398FFBWIz", "2xnoiVa"];
      _0x395adb = function () {
        return _0x1882ca;
      };
      return _0x395adb();
    }
    function _0xa15a2f(_0x4f1005, _0x4c9bfd) {
      var _0xe9d6fb = _0x395adb();
      _0xa15a2f = function (_0x2a1e55, _0x149977) {
        _0x2a1e55 = _0x2a1e55 - 382;
        var _0x2b1540 = _0xe9d6fb[_0x2a1e55];
        return _0x2b1540;
      };
      return _0xa15a2f(_0x4f1005, _0x4c9bfd);
    }
    if (_0x6b6e3a <= 200 && _0x57057a(_0x547655, _0x3a3fd7) <= 168 && _0x3a3fd7 != _0x547655 && _0x547655[_0x5d2d40(394)][_0x547655[_0x5d2d40(388)][0]] == 0) {
      _0x319c35();
    }
  }
  function _0x549705(_0x3cb99f) {
    if (_0x547655) {
      _0x238b23.removeAllItems(_0x3cb99f);
    }
  }
  function _0x58aab9(_0x22a23, _0x4229ec) {
    if (!_0x1718bc.manage[_0x1718bc.tick + _0x4229ec]) {
      _0x1718bc.manage[_0x1718bc.tick + _0x4229ec] = [_0x22a23];
    } else {
      _0x1718bc.manage[_0x1718bc.tick + _0x4229ec].push(_0x22a23);
    }
  }
  function _0x651014(_0x3fb69c, _0x52f256) {
    try {
      return Math.atan2((_0x52f256.y2 || _0x52f256.y) - (_0x3fb69c.y2 || _0x3fb69c.y), (_0x52f256.x2 || _0x52f256.x) - (_0x3fb69c.x2 || _0x3fb69c.x));
    } catch (_0x4b1c15) {
      return 0;
    }
  }
  let _0x5b0f84 = false;
  let _0x4b9715 = false;
  let _0x2d5dbc = {
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
  };
  function _0x28f00c(_0x502948) {
    if (_0x547655.shameCount > 0) {
      _0xfd6795.reSync = true;
    } else {
      _0xfd6795.reSync = false;
    }
    function _0x428b2b(_0x4474c7, _0x3263ba) {
      _0x4474c7 = _0x4474c7 % (Math.PI * 2);
      _0x3263ba = _0x3263ba % (Math.PI * 2);
      let _0x3f2c25 = Math.abs(_0x4474c7 - _0x3263ba);
      if (_0x3f2c25 > Math.PI) {
        _0x3f2c25 = Math.PI * 2 - _0x3f2c25;
      }
      return _0x3f2c25;
    }
    _0x65cac6.tick++;
    _0x5b81e2 = [];
    _0x1fd060 = [];
    _0x151041 = [];
    _0x65cac6.tickSpeed = performance.now() - _0x65cac6.lastTick;
    _0x65cac6.lastTick = performance.now();
    _0x3c40e0.forEach(_0x3438b7 => {
      _0x3438b7.forcePos = !_0x3438b7.visible;
      _0x3438b7.visible = false;
      if (_0x3438b7.timeHealed - _0x3438b7.timeDamaged > 0 && _0x3438b7.lastshamecount < _0x3438b7.shameCount) {
        _0x3438b7.pinge = _0x3438b7.timeHealed - _0x3438b7.timeDamaged;
      }
    });
    for (let _0xaf75ab = 0; _0xaf75ab < _0x502948.length;) {
      _0x3a3fd7 = _0x56d1d9(_0x502948[_0xaf75ab]);
      if (_0x3a3fd7) {
        _0x3a3fd7.t1 = _0x3a3fd7.t2 === undefined ? _0x65cac6.lastTick : _0x3a3fd7.t2;
        _0x3a3fd7.t2 = _0x65cac6.lastTick;
        _0x3a3fd7.oldPos.x2 = _0x3a3fd7.x2;
        _0x3a3fd7.oldPos.y2 = _0x3a3fd7.y2;
        _0x3a3fd7.x1 = _0x3a3fd7.x;
        _0x3a3fd7.y1 = _0x3a3fd7.y;
        _0x3a3fd7.x2 = _0x502948[_0xaf75ab + 1];
        _0x3a3fd7.y2 = _0x502948[_0xaf75ab + 2];
        _0x3a3fd7.x3 = _0x3a3fd7.x2 + (_0x3a3fd7.x2 - _0x3a3fd7.oldPos.x2);
        _0x3a3fd7.y3 = _0x3a3fd7.y2 + (_0x3a3fd7.y2 - _0x3a3fd7.oldPos.y2);
        _0x3a3fd7.d1 = _0x3a3fd7.d2 === undefined ? _0x502948[_0xaf75ab + 3] : _0x3a3fd7.d2;
        _0x3a3fd7.d2 = _0x502948[_0xaf75ab + 3];
        _0x3a3fd7.dt = 0;
        _0x3a3fd7.buildIndex = _0x502948[_0xaf75ab + 4];
        _0x3a3fd7.weaponIndex = _0x502948[_0xaf75ab + 5];
        _0x3a3fd7.weaponVariant = _0x502948[_0xaf75ab + 6];
        _0x3a3fd7.team = _0x502948[_0xaf75ab + 7];
        _0x3a3fd7.isLeader = _0x502948[_0xaf75ab + 8];
        _0x3a3fd7.oldSkinIndex = _0x3a3fd7.skinIndex;
        _0x3a3fd7.oldTailIndex = _0x3a3fd7.tailIndex;
        _0x3a3fd7.skinIndex = _0x502948[_0xaf75ab + 9];
        _0x3a3fd7.tailIndex = _0x502948[_0xaf75ab + 10];
        _0x3a3fd7.iconIndex = _0x502948[_0xaf75ab + 11];
        _0x3a3fd7.zIndex = _0x502948[_0xaf75ab + 12];
        _0x3a3fd7.visible = true;
        _0x3a3fd7.update(_0x65cac6.tickSpeed);
        _0x3a3fd7.dist2 = _0x1c7eec.getDist(_0x3a3fd7, _0x547655, 2, 2);
        _0x3a3fd7.aim2 = _0x1c7eec.getDirect(_0x3a3fd7, _0x547655, 2, 2);
        _0x3a3fd7.dist3 = _0x1c7eec.getDist(_0x3a3fd7, _0x547655, 3, 3);
        _0x3a3fd7.aim3 = _0x1c7eec.getDirect(_0x3a3fd7, _0x547655, 3, 3);
        _0x3a3fd7.damageThreat = 0;
        if (_0x3a3fd7.skinIndex == 45 && _0x3a3fd7.shameTimer <= 0) {
          _0x3a3fd7.addShameTimer();
        }
        if (_0x3a3fd7.oldSkinIndex == 45 && _0x3a3fd7.skinIndex != 45) {
          _0x3a3fd7.shameTimer = 0;
          _0x3a3fd7.shameCount = 0;
          if (_0x3a3fd7 == _0x547655) {
            _0x5e95a6();
          }
        }
        _0x393461.forEach(_0x13f52a => {
          _0x13f52a.showName = "YEAHHH";
        });
        for (let _0x4ec061 = 0; _0x4ec061 < _0x3c40e0.length; _0x4ec061++) {
          for (let _0x13aae2 = 0; _0x13aae2 < _0x393461.length; _0x13aae2++) {
            if (_0x547655.id === _0x13aae2.id) {
              _0x13aae2.showName = "YEAHHHHHH";
            }
          }
        }
        if (_0x547655.shameCount < 4 && _0x151041.dist3 <= 300 && _0x151041.reloads[_0x151041.primaryIndex] <= _0x65cac6.tickRate * (window.pingTime >= 200 ? 2 : 1)) {
          _0x4b9715 = true;
          _0x5e95a6();
        } else {
          if (_0x4b9715) {
            _0x5e95a6();
          }
          _0x4b9715 = false;
        }
        if (_0x3a3fd7 == _0x547655) {
          if (_0x51a14e.length) {
            _0x51a14e.forEach(_0x438262 => {
              _0x438262.onNear = false;
              if (_0x438262.active) {
                if (!_0x438262.onNear && _0x1c7eec.getDist(_0x438262, _0x3a3fd7, 0, 2) <= _0x438262.scale + _0x146f01.weapons[_0x3a3fd7.weapons[0]].range) {
                  _0x438262.onNear = true;
                }
                if (_0x438262.isItem && _0x438262.owner) {
                  if (!_0x438262.pps && _0x3a3fd7.sid == _0x438262.owner.sid && _0x1c7eec.getDist(_0x438262, _0x3a3fd7, 0, 2) > (parseInt(getEl("breakRange").value) || 0) && !_0x438262.breakObj && ![13, 14, 20].includes(_0x438262.id)) {
                    _0x438262.breakObj = true;
                    _0x46c306.push({
                      x: _0x438262.x,
                      y: _0x438262.y,
                      sid: _0x438262.sid
                    });
                  }
                }
              }
            });
            let _0x4cddd3 = _0x51a14e.filter(_0x2106c8 => _0x2106c8.trap && _0x2106c8.active && _0x1c7eec.getDist(_0x2106c8, _0x3a3fd7, 0, 2) <= _0x3a3fd7.scale + _0x2106c8.getScale() + 25 && !_0x2106c8.isTeamObject(_0x3a3fd7)).sort(function (_0x142e6a, _0x55e7b3) {
              return _0x1c7eec.getDist(_0x142e6a, _0x3a3fd7, 0, 2) - _0x1c7eec.getDist(_0x55e7b3, _0x3a3fd7, 0, 2);
            })[0];
            if (_0x4cddd3) {
              let _0x46887e = _0x4e7d72.filter(_0x486538 => _0x486538.dmg && _0xd428f7(_0x3a3fd7, _0x486538) <= _0x3a3fd7.scale + _0x4cddd3.scale / 2 && !_0x486538.isTeamObject(_0x3a3fd7) && _0x486538.active)[0];
              _0x4319f3.dist = _0x1c7eec.getDist(_0x4cddd3, _0x3a3fd7, 0, 2);
              _0x4319f3.aim = _0x1c7eec.getDirect(_0x46887e ? _0x46887e : _0x4cddd3, _0x3a3fd7, 0, 2);
              _0x4319f3.protect(_0x651014(_0x4cddd3, _0x3a3fd7) - Math.PI);
              _0x4319f3.inTrap = true;
              _0x4319f3.info = _0x4cddd3;
            } else {
              _0x4319f3.inTrap = false;
              _0x4319f3.info = {};
            }
            function _0x32cfe4(_0x573237, _0x1d4e4c) {
              const _0x3df09e = _0x3287a9();
              _0x32cfe4 = function (_0x46ee4f, _0x38a941) {
                _0x46ee4f = _0x46ee4f - 215;
                let _0x3f45a5 = _0x3df09e[_0x46ee4f];
                return _0x3f45a5;
              };
              return _0x32cfe4(_0x573237, _0x1d4e4c);
            }
            function _0x3287a9() {
              const _0x33c598 = ["active", "8NFvDoe", "getDist", "1119nDyFxw", "189028atfbQV", "isTrue", "312KkOAnL", "1751495NyzGyK", "4444029GJFNrp", "filter", "getDirect", "name", "isTeamObject", "greater spikes", "6041750fBQkfd", "poison spikes", "482225sQBQAW", "1946484IUFqzP", "13436JdYIei", "sort"];
              _0x3287a9 = function () {
                return _0x33c598;
              };
              return _0x3287a9();
            }
            const _0x111b67 = _0x32cfe4;
            (function (_0x43b17f, _0x6c7ee9) {
              const _0x7a776f = _0x32cfe4;
              const _0x104af2 = _0x43b17f();
              while (true) {
                try {
                  const _0x28ba36 = -parseInt(_0x7a776f(215)) / 1 + parseInt(_0x7a776f(225)) / 2 + -parseInt(_0x7a776f(231)) / 3 * (-parseInt(_0x7a776f(226)) / 4) + parseInt(_0x7a776f(224)) / 5 + parseInt(_0x7a776f(234)) / 6 * (parseInt(_0x7a776f(232)) / 7) + parseInt(_0x7a776f(229)) / 8 * (-parseInt(_0x7a776f(216)) / 9) + -parseInt(_0x7a776f(222)) / 10;
                  if (_0x28ba36 === _0x6c7ee9) {
                    break;
                  } else {
                    _0x104af2.push(_0x104af2.shift());
                  }
                } catch (_0x4fe809) {
                  _0x104af2.push(_0x104af2.shift());
                }
              }
            })(_0x3287a9, 877351);
            let _0x49a47c = _0x4e7d72[_0x111b67(217)](_0x546fa4 => (_0x546fa4[_0x111b67(219)] == "spikes" || _0x546fa4[_0x111b67(219)] == _0x111b67(221) || _0x546fa4.name == "spinning spikes" || _0x546fa4.name == _0x111b67(223)) && _0x546fa4[_0x111b67(228)] && _0x1c7eec[_0x111b67(230)](_0x546fa4, _0x3a3fd7, 0, 2) <= 145 && !_0x546fa4[_0x111b67(220)](_0x3a3fd7))[_0x111b67(227)](function (_0x485e52, _0x3b52c5) {
              const _0x48d3de = _0x111b67;
              return _0x1c7eec[_0x48d3de(230)](_0x485e52, _0x3a3fd7, 0, 2) - _0x1c7eec[_0x48d3de(230)](_0x3b52c5, _0x3a3fd7, 0, 2);
            })[0];
            if (_0x49a47c && !_0x94d477[_0x111b67(233)]) {
              _0x164623 = _0x1c7eec[_0x111b67(218)](_0x49a47c, _0x547655, 0, 2);
              _0x314bc9 = true;
              _0x1f152f = _0x49a47c;
            } else {
              _0x314bc9 = false;
              _0x1f152f = {};
            }
          } else {
            _0x4319f3.inTrap = false;
            _0x314bc9 = false;
          }
        }
        if (_0x3a3fd7.weaponIndex < 9) {
          _0x3a3fd7.primaryIndex = _0x3a3fd7.weaponIndex;
          _0x3a3fd7.primaryVariant = _0x3a3fd7.weaponVariant;
        } else if (_0x3a3fd7.weaponIndex > 8) {
          _0x3a3fd7.secondaryIndex = _0x3a3fd7.weaponIndex;
          _0x3a3fd7.secondaryVariant = _0x3a3fd7.weaponVariant;
        }
      }
      _0xaf75ab += 13;
    }
    if (_0x443fcc.stack.length) {
      let _0x4982a4 = [];
      let _0x4f6cf5 = [];
      let _0x16ef00 = 0;
      let _0x4c33a6 = 0;
      let _0xf50780 = {
        x: null,
        y: null
      };
      let _0x49ec66 = {
        x: null,
        y: null
      };
      _0x443fcc.stack.forEach(_0x447f15 => {
        if (_0x447f15.value >= 0) {
          if (_0x16ef00 == 0) {
            _0xf50780 = {
              x: _0x447f15.x,
              y: _0x447f15.y
            };
          }
          _0x16ef00 += Math.abs(_0x447f15.value);
        } else {
          if (_0x4c33a6 == 0) {
            _0x49ec66 = {
              x: _0x447f15.x,
              y: _0x447f15.y
            };
          }
          _0x4c33a6 += Math.abs(_0x447f15.value);
        }
      });
      if (_0x4c33a6 > 0) {
        _0x443fcc.showText(_0x49ec66.x, _0x49ec66.y, Math.max(45, Math.min(50, _0x4c33a6)), 0.18, 500, _0x4c33a6, "#8ecc51");
      }
      if (_0x16ef00 > 0) {
        _0x443fcc.showText(_0xf50780.x, _0xf50780.y, Math.max(45, Math.min(50, _0x16ef00)), 0.18, 500, _0x16ef00, "#fff");
      }
      _0x443fcc.stack = [];
    }
    if (_0x26efb0.length) {
      _0x26efb0.forEach(_0x4c415d => {
        _0x4658aa(..._0x4c415d);
      });
      _0x26efb0 = [];
    }
    for (let _0x2d1a4a = 0; _0x2d1a4a < _0x502948.length;) {
      _0x3a3fd7 = _0x56d1d9(_0x502948[_0x2d1a4a]);
      if (_0x3a3fd7) {
        if (!_0x3a3fd7.isTeam(_0x547655)) {
          _0x5b81e2.push(_0x3a3fd7);
          if (_0x3a3fd7.dist2 <= _0x146f01.weapons[_0x3a3fd7.primaryIndex == undefined ? 5 : _0x3a3fd7.primaryIndex].range + _0x547655.scale * 2) {
            _0x1fd060.push(_0x3a3fd7);
          }
        }
        _0x3a3fd7.manageReload();
        if (_0x3a3fd7 != _0x547655) {
          _0x3a3fd7.addDamageThreat(_0x547655);
        }
      }
      _0x2d1a4a += 13;
    }
    if (_0x547655 && _0x547655.alive) {
      if (_0x5b81e2.length) {
        _0x151041 = _0x5b81e2.sort(function (_0x38c345, _0x52ec08) {
          return _0x38c345.dist2 - _0x52ec08.dist2;
        })[0];
      } else {}
      if (_0x65cac6.tickQueue[_0x65cac6.tick]) {
        _0x65cac6.tickQueue[_0x65cac6.tick].forEach(_0x170b49 => {
          _0x170b49();
        });
        _0x65cac6.tickQueue[_0x65cac6.tick] = null;
      }
      function _0x1c5001() {
        const _0x4428d3 = ["damageThreat", "primaryIndex", "setPoisonTick", "2651700zcPkiT", "reSync", "105622wkHfJC", "setBullTick", "tick", "secondaryIndex", "tickBase", "skinIndex", "reloads", "2257409LFaoNr", "weapons", "tailIndex", "soldierAnti", "48kcEasC", "600962HdBGsi", "4eXatBA", "shameCount", "dist2", "primaryVariant", "forEach", "1971594nsHAJN", "length", "damaged", "2midBrc", "includes", "healingBeta", "2512440cdoVGL", "checked", "canCounter", "317529DGXQHc", "health", "1110xBMfrF", "pingTime", "latestTail", "antiTimer", "map", "canEmpAnti"];
        _0x1c5001 = function () {
          return _0x4428d3;
        };
        return _0x1c5001();
      }
      const _0xea00d2 = _0x25055f;
      function _0x25055f(_0x1fb189, _0x418327) {
        const _0x4a0a3f = _0x1c5001();
        _0x25055f = function (_0x3ac0c3, _0x358338) {
          _0x3ac0c3 = _0x3ac0c3 - 354;
          let _0x1af26c = _0x4a0a3f[_0x3ac0c3];
          return _0x1af26c;
        };
        return _0x25055f(_0x1fb189, _0x418327);
      }
      (function (_0x23bc38, _0x383cd6) {
        const _0xc75c7d = _0x25055f;
        const _0x40cadd = _0x23bc38();
        while (true) {
          try {
            const _0x42d791 = parseInt(_0xc75c7d(364)) / 1 * (parseInt(_0xc75c7d(355)) / 2) + parseInt(_0xc75c7d(361)) / 3 * (parseInt(_0xc75c7d(356)) / 4) + parseInt(_0xc75c7d(367)) / 5 + -parseInt(_0xc75c7d(381)) / 6 + parseInt(_0xc75c7d(390)) / 7 + parseInt(_0xc75c7d(354)) / 8 * (-parseInt(_0xc75c7d(370)) / 9) + -parseInt(_0xc75c7d(372)) / 10 * (parseInt(_0xc75c7d(383)) / 11);
            if (_0x42d791 === _0x383cd6) {
              break;
            } else {
              _0x40cadd.push(_0x40cadd.shift());
            }
          } catch (_0x573cfd) {
            _0x40cadd.push(_0x40cadd.shift());
          }
        }
      })(_0x1c5001, 363677);
      if (_0x312fd[_0xea00d2(362)]) {
        _0x312fd[_0xea00d2(360)](_0x54d2f6 => {
          const _0x516a84 = _0xea00d2;
          if (window[_0x516a84(373)] < 150) {
            let _0x147a3b = _0x54d2f6[0];
            let _0x4a5c78 = _0x54d2f6[1];
            let _0x2c731e = 100 - _0x4a5c78;
            let _0x5bff44 = _0x54d2f6[2];
            _0x3a3fd7 = _0x56d1d9(_0x147a3b);
            let _0x14bd09 = false;
            if (_0x3a3fd7 == _0x547655) {
              if (_0x3a3fd7.skinIndex == 7 && (_0x5bff44 == 5 || _0x3a3fd7[_0x516a84(374)] == 13 && _0x5bff44 == 2)) {
                if (_0xfd6795[_0x516a84(382)]) {
                  _0xfd6795[_0x516a84(382)] = false;
                  _0x3a3fd7.setBullTick = true;
                }
                _0x14bd09 = true;
              }
              if (_0x37b6ae) {
                let _0x1a0695 = _0x5b837e(_0x5bff44);
                let _0x391d79 = [0.25, 0.45][_0x516a84(376)](_0x3ed935 => _0x3ed935 * _0x146f01[_0x516a84(391)][_0x547655[_0x516a84(391)][0]].dmg * _0x3e4925());
                let _0x40f906 = _0x5b81e2[_0x516a84(362)] ? !_0x14bd09 && _0x391d79.includes(_0x5bff44) && _0x151041[_0x516a84(388)] == 11 : false;
                let _0x1d001e = 140 - window[_0x516a84(373)];
                let _0x2d7b1e = 100 - _0x547655.health;
                let _0x2fdec4 = function (_0x3062cb, _0x24a2e2) {
                  const _0x5c7291 = _0x516a84;
                  if (!_0x24a2e2) {
                    setTimeout(() => {
                      _0x5e95a6();
                    }, _0x3062cb);
                  } else {
                    _0x65cac6[_0x5c7291(387)](() => {
                      _0x5e95a6();
                    }, 2);
                  }
                };
                if (getEl(_0x516a84(366))[_0x516a84(368)]) {
                  if (_0x5b81e2[_0x516a84(362)]) {
                    if ([0, 7, 8][_0x516a84(365)](_0x151041[_0x516a84(379)])) {
                      if (_0x5bff44 < 75) {
                        _0x2fdec4(_0x1d001e);
                      } else {
                        _0x5e95a6();
                      }
                    }
                    if ([1, 2, 6].includes(_0x151041.primaryIndex)) {
                      if (_0x5bff44 >= 25 && _0x547655.damageThreat + _0x2d7b1e >= 95 && _0x3a3fd7[_0x516a84(357)] < 5) {
                        _0x5e95a6();
                      } else {
                        _0x2fdec4(_0x1d001e);
                      }
                    }
                    if (_0x151041.primaryIndex == 3) {
                      if (_0x151041[_0x516a84(386)] == 15) {
                        if (_0x151041.primaryVariant < 2) {
                          if (_0x5bff44 >= 35 && _0x547655[_0x516a84(378)] + _0x2d7b1e >= 95 && _0x3a3fd7[_0x516a84(357)] < 5 && _0x65cac6[_0x516a84(385)] - _0x547655[_0x516a84(375)] > 1) {
                            _0x3a3fd7[_0x516a84(377)] = true;
                            _0x3a3fd7[_0x516a84(375)] = _0x65cac6[_0x516a84(385)];
                            _0x5e95a6();
                          } else {
                            _0x2fdec4(_0x1d001e);
                          }
                        } else if (_0x5bff44 > 35 && _0x547655[_0x516a84(378)] + _0x2d7b1e >= 95 && _0x3a3fd7[_0x516a84(357)] < 5 && _0x65cac6[_0x516a84(385)] - _0x547655[_0x516a84(375)] > 1) {
                          _0x3a3fd7[_0x516a84(377)] = true;
                          _0x3a3fd7[_0x516a84(375)] = _0x65cac6.tick;
                          _0x5e95a6();
                        } else {
                          _0x2fdec4(_0x1d001e);
                        }
                      } else if (_0x5bff44 >= 25 && _0x547655[_0x516a84(378)] + _0x2d7b1e >= 95 && _0x3a3fd7[_0x516a84(357)] < 4) {
                        _0x5e95a6();
                      } else {
                        _0x2fdec4(_0x1d001e);
                      }
                    }
                    if (_0x151041[_0x516a84(379)] == 4) {
                      if (_0x151041[_0x516a84(359)] >= 1) {
                        if (_0x5bff44 >= 10 && _0x547655[_0x516a84(378)] + _0x2d7b1e >= 95 && _0x3a3fd7[_0x516a84(357)] < 4) {
                          _0x5e95a6();
                        } else {
                          _0x2fdec4(_0x1d001e);
                        }
                      } else if (_0x5bff44 >= 35 && _0x547655.damageThreat + _0x2d7b1e >= 95 && _0x3a3fd7[_0x516a84(357)] < 3) {
                        _0x5e95a6();
                      } else {
                        _0x2fdec4(_0x1d001e);
                      }
                    }
                    if ([undefined, 5].includes(_0x151041[_0x516a84(379)])) {
                      if (_0x151041[_0x516a84(386)] == 10) {
                        if (_0x2d7b1e >= (_0x40f906 ? 10 : 20) && _0x3a3fd7.damageThreat + _0x2d7b1e >= 80 && _0x3a3fd7[_0x516a84(357)] < 6) {
                          _0x5e95a6();
                        } else {
                          _0x2fdec4(_0x1d001e);
                        }
                      } else if (_0x151041[_0x516a84(359)] >= 2 || _0x151041[_0x516a84(359)] == undefined) {
                        if (_0x2d7b1e >= (_0x40f906 ? 15 : 20) && _0x3a3fd7.damageThreat + _0x2d7b1e >= 50 && _0x3a3fd7[_0x516a84(357)] < 6) {
                          _0x5e95a6();
                        } else {
                          _0x2fdec4(_0x1d001e);
                        }
                      } else if ([undefined || 15][_0x516a84(365)](_0x151041[_0x516a84(386)])) {
                        if (_0x5bff44 > (_0x40f906 ? 8 : 20) && _0x547655.damageThreat >= 25 && _0x65cac6[_0x516a84(385)] - _0x547655[_0x516a84(375)] > 1) {
                          if (_0x3a3fd7[_0x516a84(357)] < 5) {
                            _0x5e95a6();
                          } else {
                            _0x2fdec4(_0x1d001e);
                          }
                        } else {
                          _0x2fdec4(_0x1d001e);
                        }
                      } else if ([9, 12, 13].includes(_0x151041[_0x516a84(386)])) {
                        if (_0x2d7b1e >= 25 && _0x547655[_0x516a84(378)] + _0x2d7b1e >= 70 && _0x3a3fd7[_0x516a84(357)] < 6) {
                          _0x5e95a6();
                        } else {
                          _0x2fdec4(_0x1d001e);
                        }
                      } else if (_0x5bff44 > 25 && _0x547655[_0x516a84(378)] + _0x2d7b1e >= 95) {
                        _0x5e95a6();
                      } else {
                        _0x2fdec4(_0x1d001e);
                      }
                    }
                    if (_0x151041.primaryIndex == 6) {
                      if (_0x151041[_0x516a84(386)] == 15) {
                        if (_0x5bff44 >= 25 && _0x3a3fd7[_0x516a84(378)] + _0x2d7b1e >= 95 && _0x3a3fd7[_0x516a84(357)] < 4) {
                          _0x5e95a6();
                        } else {
                          _0x2fdec4(_0x1d001e);
                        }
                      } else if (_0x5bff44 >= 70 && _0x3a3fd7[_0x516a84(357)] < 4) {
                        _0x5e95a6();
                      } else {
                        _0x2fdec4(_0x1d001e);
                      }
                    }
                    if (_0x5bff44 >= 30 && _0x151041[_0x516a84(389)][_0x151041[_0x516a84(386)]] == 0 && _0x151041[_0x516a84(358)] <= 150 && _0x547655[_0x516a84(388)] == 11 && _0x547655[_0x516a84(392)] == 21) {
                      _0x94d477[_0x516a84(369)] = true;
                    }
                  } else if (_0x5bff44 >= 70) {
                    _0x5e95a6();
                  } else {
                    _0x2fdec4(_0x1d001e);
                  }
                } else {
                  if (_0x5bff44 >= (_0x40f906 ? 8 : 25) && _0x2d7b1e + _0x547655[_0x516a84(378)] >= 80 && _0x65cac6[_0x516a84(385)] - _0x547655[_0x516a84(375)] > 1) {
                    if (_0x3a3fd7[_0x516a84(389)][53] == 0 && _0x3a3fd7[_0x516a84(389)][_0x3a3fd7[_0x516a84(391)][1]] == 0) {
                      _0x3a3fd7.canEmpAnti = true;
                    } else {
                      _0x547655[_0x516a84(393)] = true;
                    }
                    _0x3a3fd7[_0x516a84(375)] = _0x65cac6[_0x516a84(385)];
                    let _0x3b1022 = [0, 4, 6, 7, 8][_0x516a84(365)](_0x151041[_0x516a84(379)]) ? 2 : 5;
                    if (_0x3a3fd7[_0x516a84(357)] < _0x3b1022) {
                      _0x5e95a6();
                    } else if (_0x151041[_0x516a84(379)] == 7 || _0x547655[_0x516a84(391)][0] == 7 && (_0x151041[_0x516a84(388)] == 11 || _0x151041[_0x516a84(392)] == 21)) {
                      _0x2fdec4(_0x1d001e);
                    } else {
                      _0x2fdec4(_0x1d001e, 1);
                    }
                  } else if (_0x151041[_0x516a84(379)] == 7 || _0x547655[_0x516a84(391)][0] == 7 && (_0x151041[_0x516a84(388)] == 11 || _0x151041[_0x516a84(392)] == 21)) {
                    _0x2fdec4(_0x1d001e);
                  } else {
                    _0x2fdec4(_0x1d001e, 1);
                  }
                  if (_0x5bff44 >= 25 && _0x151041[_0x516a84(358)] <= 140 && _0x547655[_0x516a84(388)] == 11 && _0x547655.tailIndex == 21) {
                    _0x94d477[_0x516a84(369)] = true;
                  }
                }
              } else if (!_0x3a3fd7[_0x516a84(380)] && (_0x3a3fd7[_0x516a84(363)] == 5 || _0x3a3fd7[_0x516a84(374)] == 13 && _0x3a3fd7[_0x516a84(363)] == 2)) {
                _0x3a3fd7[_0x516a84(380)] = true;
              }
            }
          } else {
            let [_0x1336ba, _0x4a7407, _0x5b0db5] = _0x54d2f6;
            let _0x4056f0 = 100 - _0x4a7407;
            let _0xcfe453 = _0x56d1d9(_0x1336ba);
            let _0x104ae3 = false;
            if (_0xcfe453 == _0x547655) {
              if (_0xcfe453.skinIndex == 7 && (_0x5b0db5 == 5 || _0xcfe453[_0x516a84(374)] == 13 && _0x5b0db5 == 2)) {
                if (_0xfd6795[_0x516a84(382)]) {
                  _0xfd6795[_0x516a84(382)] = false;
                  _0xcfe453[_0x516a84(384)] = true;
                  _0x104ae3 = true;
                }
              }
              if (_0x37b6ae) {
                let _0x28bbc8 = _0x5b837e(_0x5b0db5);
                let _0x6b3348 = [0.25, 0.45][_0x516a84(376)](_0x26e305 => _0x26e305 * _0x146f01[_0x516a84(391)][_0x547655.weapons[0]].dmg * _0x3e4925());
                let _0x452bf3 = _0x5b81e2[_0x516a84(362)] ? !_0x104ae3 && _0x6b3348[_0x516a84(365)](_0x5b0db5) && _0x151041[_0x516a84(388)] == 11 : false;
                let _0x32548a = 60;
                let _0x1c5d34 = 100 - _0x547655[_0x516a84(371)];
                let _0x3f31de = [2, 5][[0, 4, 6, 7, 8][_0x516a84(365)](_0x151041[_0x516a84(379)]) ? 0 : 1];
                let _0x2952ff = function (_0x1c4c27, _0x3c5708) {
                  const _0x474d52 = _0x516a84;
                  if (!_0x3c5708) {
                    setTimeout(() => _0x5e95a6(), _0x1c4c27);
                  } else {
                    _0x65cac6[_0x474d52(387)](() => _0x5e95a6(), 2);
                  }
                };
                if (getEl(_0x516a84(366))[_0x516a84(368)]) {
                  let _0x594787 = [0, 7, 8].includes(_0x151041[_0x516a84(379)]) ? _0x5b0db5 < 75 : [1, 2, 6][_0x516a84(365)](_0x151041[_0x516a84(379)]) ? _0x5b0db5 >= 25 && _0x547655[_0x516a84(378)] + _0x1c5d34 >= 95 && _0xcfe453[_0x516a84(357)] < 5 : [undefined, 5][_0x516a84(365)](_0x151041.primaryIndex) ? _0x1c5d34 >= (_0x452bf3 ? 15 : 20) && _0xcfe453[_0x516a84(378)] + _0x1c5d34 >= 50 && _0xcfe453[_0x516a84(357)] < 6 : _0x151041[_0x516a84(379)] == 3 && _0x151041[_0x516a84(386)] == 15 ? _0x5b0db5 >= 35 && _0x547655[_0x516a84(378)] + _0x1c5d34 >= 95 && _0xcfe453[_0x516a84(357)] < 5 && _0x65cac6[_0x516a84(385)] - _0x547655.antiTimer > 1 : _0x151041[_0x516a84(379)] == 4 ? _0x151041[_0x516a84(359)] >= 1 ? _0x5b0db5 >= 10 && _0x547655.damageThreat + _0x1c5d34 >= 95 && _0xcfe453[_0x516a84(357)] < 4 : _0x5b0db5 >= 35 && _0x547655[_0x516a84(378)] + _0x1c5d34 >= 95 && _0xcfe453.shameCount < 3 : _0x151041[_0x516a84(379)] == 6 && _0x151041.secondaryIndex == 15 ? _0x5b0db5 >= 25 && _0xcfe453[_0x516a84(378)] + _0x1c5d34 >= 95 && _0xcfe453[_0x516a84(357)] < 4 : _0x5b0db5 >= 25 && _0x547655[_0x516a84(378)] + _0x1c5d34 >= 95;
                  if (_0x594787) {
                    _0x5e95a6();
                  } else {
                    _0x2952ff(_0x32548a);
                  }
                } else {
                  let _0x46d430 = _0x5b0db5 >= (_0x452bf3 ? 8 : 25) && _0x1c5d34 + _0x547655[_0x516a84(378)] >= 80 && _0x65cac6[_0x516a84(385)] - _0x547655.antiTimer > 1;
                  if (_0x46d430) {
                    if (_0xcfe453[_0x516a84(389)][53] == 0 && _0xcfe453[_0x516a84(389)][_0xcfe453[_0x516a84(391)][1]] == 0) {
                      _0xcfe453[_0x516a84(377)] = true;
                    } else {
                      _0x547655.soldierAnti = true;
                    }
                    _0xcfe453[_0x516a84(375)] = _0x65cac6[_0x516a84(385)];
                    if (_0xcfe453.shameCount < _0x3f31de) {
                      _0x5e95a6();
                    } else {
                      _0x2952ff(_0x32548a, _0x151041[_0x516a84(379)] == 7 || _0x547655[_0x516a84(391)][0] == 7 && (_0x151041.skinIndex == 11 || _0x151041[_0x516a84(392)] == 21) ? 0 : 1);
                    }
                  } else {
                    _0x2952ff(_0x32548a, _0x151041[_0x516a84(379)] == 7 || _0x547655.weapons[0] == 7 && (_0x151041[_0x516a84(388)] == 11 || _0x151041[_0x516a84(392)] == 21) ? 0 : 1);
                  }
                }
              } else if (!_0xcfe453.setPoisonTick && (_0xcfe453[_0x516a84(363)] == 5 || _0xcfe453[_0x516a84(374)] == 13 && _0xcfe453.damaged == 2)) {
                _0xcfe453.setPoisonTick = true;
              }
            }
          }
        });
        _0x312fd = [];
      }
      _0x3c40e0.forEach(_0x1897e5 => {
        if (!_0x1897e5.visible && _0x547655 != _0x1897e5) {
          _0x1897e5.reloads = {
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
        if (_0x1897e5.setBullTick) {
          _0x1897e5.bullTimer = 0;
        }
        if (_0x1897e5.setPoisonTick) {
          _0x1897e5.poisonTimer = 0;
        }
        _0x1897e5.updateTimer();
      });
      if (_0x37b6ae) {
        if (_0x5b81e2.length) {
          if (_0x547655.canEmpAnti) {
            _0x547655.canEmpAnti = false;
            if (_0x151041.dist2 <= 300 && !_0xfd6795.safePrimary(_0x151041) && !_0xfd6795.safeSecondary(_0x151041)) {
              if (_0x151041.reloads[53] == 0) {
                _0x547655.empAnti = true;
                _0x547655.soldierAnti = false;
              } else {
                _0x547655.empAnti = false;
                _0x547655.soldierAnti = true;
              }
            }
          }
          let _0x153f75 = _0x51a14e.filter(_0x2cb227 => _0x2cb227.dmg && _0x2cb227.active && _0x2cb227.isTeamObject(_0x547655) && _0x1c7eec.getDist(_0x2cb227, _0x151041, 0, 3) <= _0x2cb227.scale + _0x151041.scale).sort(function (_0x448c90, _0x5745d4) {
            return _0x1c7eec.getDist(_0x448c90, _0x151041, 0, 2) - _0x1c7eec.getDist(_0x5745d4, _0x151041, 0, 2);
          })[0];
          if (_0x153f75) {
            if (_0x151041.dist3 <= _0x146f01.weapons[_0x547655.weapons[0]].range + _0x547655.scale * 1.8 && _0x4f1036.predictTick) {
              _0x94d477.canSpikeTick = true;
              _0x94d477.syncHit = true;
              if (_0x4f1036.revTick && _0x547655.weapons[1] == 15 && _0x547655.reloads[53] == 0 && _0x94d477.perfCheck(_0x547655, _0x151041)) {
                _0x94d477.revTick = true;
              }
            }
          }
          let _0xc6b7c1 = _0x51a14e.filter(_0x2358a0 => _0x2358a0.dmg && _0x2358a0.active && !_0x2358a0.isTeamObject(_0x547655) && _0x1c7eec.getDist(_0x2358a0, _0x547655, 0, 3) < _0x2358a0.scale + _0x547655.scale).sort(function (_0x36f3cb, _0x348309) {
            return _0x1c7eec.getDist(_0x36f3cb, _0x547655, 0, 2) - _0x1c7eec.getDist(_0x348309, _0x547655, 0, 2);
          })[0];
          if (_0xc6b7c1 && !_0x4319f3.inTrap) {
            if (_0x151041.dist3 <= _0x146f01.weapons[5].range + _0x151041.scale * 1.8) {
              _0xfd6795.anti0Tick = 1;
            }
          }
        }
        if ((_0x50abc3 ? true : (_0x547655.checkCanInsta(true) >= 100 ? _0x547655.checkCanInsta(true) : _0x547655.checkCanInsta(false)) >= (_0x547655.weapons[1] == 10 ? 95 : 100)) && _0x151041.dist2 <= _0x146f01.weapons[_0x547655.weapons[1] == 10 ? _0x547655.weapons[1] : _0x547655.weapons[0]].range + _0x151041.scale * 1.8 && (_0x94d477.wait || _0x50abc3 && Math.floor(Math.random() * 5) == 0) && !_0x94d477.isTrue && !_0xfd6795.waitHit && _0x547655.reloads[_0x547655.weapons[0]] == 0 && _0x547655.reloads[_0x547655.weapons[1]] == 0 && (_0x50abc3 ? true : _0x547655.reloads[53] <= (_0x547655.weapons[1] == 10 ? 0 : _0x65cac6.tickRate)) && _0x94d477.perfCheck(_0x547655, _0x151041)) {
          if (_0x547655.checkCanInsta(true) >= 100) {
            _0x94d477.nobull = _0x50abc3 ? false : _0x94d477.canSpikeTick ? false : true;
          } else {
            _0x94d477.nobull = false;
          }
          _0x94d477.can = true;
        } else {
          _0x94d477.can = false;
        }
        if (_0x2126c4.q) {
          _0x39dd86(0, _0x58dcd1());
        }
        if (_0x2126c4.f) {
          _0x39dd86(4, _0x141e1c());
        }
        if (_0x2126c4.v) {
          _0x39dd86(2, _0x141e1c());
        }
        if (_0x2126c4.y) {
          _0x39dd86(5, _0x141e1c());
        }
        if (_0x2126c4.h) {
          _0x39dd86(_0x547655.getItemType(22), _0x141e1c());
        }
        if (_0x2126c4.n) {
          _0x39dd86(3, _0x141e1c());
        }
        if (_0x65cac6.tick % 1 == 0) {
          if (_0x4e1a4e.place) {
            let _0x4a2cbc = 7.7;
            for (let _0x3cd720 = -_0x4a2cbc; _0x3cd720 <= _0x4a2cbc; _0x3cd720 += _0x4a2cbc) {
              _0x21e105(3, _0x1c7eec.getDirect(_0x547655.oldPos, _0x547655, 2, 2) + _0x3cd720);
            }
          } else if (_0x4e1a4e.placeSpawnPads) {
            for (let _0x4b8b12 = 0; _0x4b8b12 < Math.PI * 2; _0x4b8b12 += Math.PI / 2) {
              _0x21e105(_0x547655.getItemType(20), _0x1c7eec.getDirect(_0x547655.oldPos, _0x547655, 2, 2) + _0x4b8b12);
            }
          }
        }
        if (_0x94d477.can) {
          _0x94d477.changeType(_0x4f1036.alwaysRev ? "rev" : "normal");
        }
        if (_0x94d477.canCounter) {
          _0x94d477.canCounter = false;
          if (_0x547655.reloads[_0x547655.weapons[0]] == 0 && !_0x94d477.isTrue) {
            _0x94d477.counterType();
          }
        }
        if (_0x94d477.canSpikeTick) {
          _0x94d477.canSpikeTick = false;
          if (_0x94d477.revTick) {
            _0x94d477.revTick = false;
            if ([1, 2, 3, 4, 5, 6].includes(_0x547655.weapons[0]) && _0x547655.reloads[_0x547655.weapons[1]] == 0 && !_0x94d477.isTrue) {
              _0x94d477.changeType("rev");
              _0xc91fe1(null, "[RevSyncHit]", "yellow");
            }
          } else if ([1, 2, 3, 4, 5, 6].includes(_0x547655.weapons[0]) && _0x547655.reloads[_0x547655.weapons[0]] == 0 && !_0x94d477.isTrue) {
            _0x94d477.spikeTickType();
            if (_0x94d477.syncHit) {
              _0xc91fe1(null, "[SyncHit]", "yellow");
            }
          }
        }
        if (!_0x54660b.middle && (_0x54660b.left || _0x54660b.right) && !_0x94d477.isTrue) {
          if (_0x547655.weaponIndex != (_0x54660b.right && _0x547655.weapons[1] == 10 ? _0x547655.weapons[1] : _0x547655.weapons[0]) || _0x547655.buildIndex > -1) {
            _0x10e7fc(_0x54660b.right && _0x547655.weapons[1] == 10 ? _0x547655.weapons[1] : _0x547655.weapons[0]);
          }
          if (_0x547655.reloads[_0x54660b.right && _0x547655.weapons[1] == 10 ? _0x547655.weapons[1] : _0x547655.weapons[0]] == 0 && !_0xfd6795.waitHit) {
            _0x1079cb();
            _0xfd6795.waitHit = 1;
            _0x65cac6.tickBase(() => {
              _0x1079cb();
              _0xfd6795.waitHit = 0;
            }, 1);
          }
        }
        if (_0x50abc3 && !_0x54660b.left && !_0x54660b.right && !_0x94d477.isTrue && _0x151041.dist2 <= _0x146f01.weapons[_0x547655.weapons[0]].range + _0x151041.scale * 1.8 && !_0x4319f3.inTrap) {
          if (_0x547655.weaponIndex != _0x547655.weapons[0] || _0x547655.buildIndex > -1) {
            _0x10e7fc(_0x547655.weapons[0]);
          }
          if (_0x547655.reloads[_0x547655.weapons[0]] == 0 && !_0xfd6795.waitHit) {
            _0x1079cb();
            _0xfd6795.waitHit = 1;
            _0x65cac6.tickBase(() => {
              _0x1079cb();
              _0xfd6795.waitHit = 0;
            }, 1);
          }
        }
        if (_0x4319f3.inTrap) {
          if (!_0x54660b.left && !_0x54660b.right && !_0x94d477.isTrue) {
            if (_0x547655.weaponIndex != (_0x4319f3.notFast() ? _0x547655.weapons[1] : _0x547655.weapons[0]) || _0x547655.buildIndex > -1) {
              _0x10e7fc(_0x4319f3.notFast() ? _0x547655.weapons[1] : _0x547655.weapons[0]);
            }
            if (_0x547655.reloads[_0x4319f3.notFast() ? _0x547655.weapons[1] : _0x547655.weapons[0]] == 0 && !_0xfd6795.waitHit) {
              _0x1079cb();
              _0xfd6795.waitHit = 1;
              _0x65cac6.tickBase(() => {
                _0x1079cb();
                _0xfd6795.waitHit = 0;
              }, 1);
            }
          }
        }
        var _0x13a762 = _0x58c3f1;
        function _0x58c3f1(_0xbb6c09, _0x4310db) {
          var _0x521751 = _0x543caf();
          _0x58c3f1 = function (_0x59de41, _0x448a96) {
            _0x59de41 = _0x59de41 - 303;
            var _0x22a3a4 = _0x521751[_0x59de41];
            return _0x22a3a4;
          };
          return _0x58c3f1(_0xbb6c09, _0x4310db);
        }
        (function (_0xef02cd, _0x3af897) {
          var _0x1377b4 = _0x58c3f1;
          var _0x30162c = _0xef02cd();
          while (true) {
            try {
              var _0x1c44bf = parseInt(_0x1377b4(320)) / 1 + -parseInt(_0x1377b4(318)) / 2 * (parseInt(_0x1377b4(315)) / 3) + -parseInt(_0x1377b4(303)) / 4 + -parseInt(_0x1377b4(306)) / 5 * (-parseInt(_0x1377b4(304)) / 6) + parseInt(_0x1377b4(319)) / 7 * (parseInt(_0x1377b4(311)) / 8) + -parseInt(_0x1377b4(310)) / 9 * (parseInt(_0x1377b4(314)) / 10) + parseInt(_0x1377b4(308)) / 11 * (parseInt(_0x1377b4(316)) / 12);
              if (_0x1c44bf === _0x3af897) {
                break;
              } else {
                _0x30162c.push(_0x30162c.shift());
              }
            } catch (_0x5c072c) {
              _0x30162c.push(_0x30162c.shift());
            }
          }
        })(_0x543caf, 122020);
        function _0x543caf() {
          var _0x1b5100 = ["buildIndex", "2714JfzkhT", "97573pqNooa", "126624bAArBS", "weapons", "423796hgKKSB", "306vFdqgX", "tickBase", "1660LUDKSV", "waitHit", "142945tjDcKY", "reloads", "242226TgTxBR", "88hjrSfl", "left", "weaponIndex", "20JWoUIo", "177vNaNeJ", "60FtpPbF"];
          _0x543caf = function () {
            return _0x1b5100;
          };
          return _0x543caf();
        }
        if (_0x314bc9) {
          if (!_0x54660b[_0x13a762(312)] && !_0x54660b.right && !_0x94d477.isTrue) {
            if (_0x547655[_0x13a762(313)] != (_0x7a5737() ? _0x547655[_0x13a762(321)][1] : _0x547655.weapons[0]) || _0x547655[_0x13a762(317)] > -1) {
              _0x10e7fc(_0x7a5737() ? _0x547655[_0x13a762(321)][1] : _0x547655[_0x13a762(321)][0]);
            }
            if (_0x547655[_0x13a762(309)][_0x7a5737() ? _0x547655[_0x13a762(321)][1] : _0x547655[_0x13a762(321)][0]] == 0 && !_0xfd6795.waitHit) {
              _0x1079cb();
              _0xfd6795.waitHit = 1;
              _0x65cac6[_0x13a762(305)](() => {
                var _0x3db907 = _0x13a762;
                _0x1079cb();
                _0xfd6795[_0x3db907(307)] = 0;
              }, 1);
            }
          }
        }
        if (_0x54660b.middle && !_0x4319f3.inTrap) {
          if (!_0x94d477.isTrue && _0x547655.reloads[_0x547655.weapons[1]] == 0) {
            if (_0xfd6795.ageInsta && _0x547655.weapons[0] != 4 && _0x547655.weapons[1] == 9 && _0x547655.age >= 9 && _0x5b81e2.length) {
              _0x94d477.bowMovement();
            } else {
              _0x94d477.rangeType();
            }
          }
        }
        if (_0x2126c4.t && !_0x4319f3.inTrap) {
          if (!_0x94d477.isTrue && _0x547655.reloads[_0x547655.weapons[0]] == 0 && (_0x547655.weapons[1] == 15 ? _0x547655.reloads[_0x547655.weapons[1]] == 0 : true) && (_0x547655.weapons[0] == 5 || _0x547655.weapons[0] == 4 && _0x547655.weapons[1] == 15)) {
            _0x94d477[_0x547655.weapons[0] == 4 && _0x547655.weapons[1] == 15 ? "kmTickMovement" : "tickMovement"]();
          }
        }
        if (_0x2126c4["."] && !_0x4319f3.inTrap) {
          if (!_0x94d477.isTrue && _0x547655.reloads[_0x547655.weapons[0]] == 0 && ([9, 12, 13, 15].includes(_0x547655.weapons[1]) ? _0x547655.reloads[_0x547655.weapons[1]] == 0 : true)) {
            _0x94d477.boostTickMovement();
          }
        }
        if (_0x547655.weapons[1] && !_0x54660b.left && !_0x54660b.right && !_0x4319f3.inTrap && !_0x94d477.isTrue && (!_0x50abc3 || !(_0x151041.dist2 <= _0x146f01.weapons[_0x547655.weapons[0]].range + _0x151041.scale * 1.8))) {
          if (_0x547655.reloads[_0x547655.weapons[0]] == 0 && _0x547655.reloads[_0x547655.weapons[1]] == 0) {
            if (!_0xfd6795.reloaded) {
              _0xfd6795.reloaded = true;
              let _0x2adc88 = _0x146f01.weapons[_0x547655.weapons[0]].spdMult < _0x146f01.weapons[_0x547655.weapons[1]].spdMult ? 1 : 0;
              if (_0x547655.weaponIndex != _0x547655.weapons[_0x2adc88] || _0x547655.buildIndex > -1) {
                _0x10e7fc(_0x547655.weapons[_0x2adc88]);
              }
            }
          } else {
            _0xfd6795.reloaded = false;
            if (_0x50abc3) {
              _0x2d5dbc.stopspin = false;
            }
            if (_0x547655.reloads[_0x547655.weapons[0]] > 0) {
              if (_0x547655.weaponIndex != _0x547655.weapons[0] || _0x547655.buildIndex > -1) {
                _0x10e7fc(_0x547655.weapons[0]);
              }
            } else if (_0x547655.reloads[_0x547655.weapons[0]] == 0 && _0x547655.reloads[_0x547655.weapons[1]] > 0) {
              if (_0x547655.weaponIndex != _0x547655.weapons[1] || _0x547655.buildIndex > -1) {
                _0x10e7fc(_0x547655.weapons[1]);
              }
              if (_0x50abc3) {
                if (!_0x2d5dbc.stopspin) {
                  setTimeout(() => {
                    _0x2d5dbc.stopspin = true;
                  }, 750);
                }
              }
            }
          }
        }
        if (!_0x94d477.isTrue && !_0x4319f3.inTrap && !_0x4319f3.replaced) {
          _0x4319f3.autoPlace();
        }
        if (!_0x2126c4.q && !_0x2126c4.f && !_0x2126c4.v && !_0x2126c4.h && !_0x2126c4.n) {
          _0x48b469("D", _0x58dcd1());
        }
        let _0x2ecefd = function () {
          if (_0xfd6795.anti0Tick > 0) {
            _0x2c609b(6, 0);
          } else if (_0x54660b.left || _0x54660b.right) {
            if (_0x547655.shameCount > 0 && (_0x65cac6.tick - _0x547655.bullTick) % _0x4ee004.serverUpdateRate === 0 && _0x547655.skinIndex != 45 || _0xfd6795.reSync) {
              _0x2c609b(7, 0);
              _0x2c609b(18, 1);
            } else if (_0x54660b.left) {
              _0x2c609b(_0x547655.reloads[_0x547655.weapons[0]] == 0 ? getEl("weaponGrind").checked ? 40 : 7 : _0x547655.empAnti ? 22 : _0x547655.soldierAnti ? 6 : getEl("antiBullType").value == "abreload" && _0x151041.antiBull > 0 ? 11 : _0x151041.dist2 <= 300 ? getEl("antiBullType").value == "abalway" && _0x151041.reloads[_0x151041.primaryIndex] == 0 ? 11 : 6 : _0x293109(1, 1), 0);
            } else if (_0x54660b.right) {
              _0x2c609b(_0x547655.reloads[_0x54660b.right && _0x547655.weapons[1] == 10 ? _0x547655.weapons[1] : _0x547655.weapons[0]] == 0 ? 40 : _0x547655.empAnti ? 22 : _0x547655.soldierAnti ? 6 : getEl("antiBullType").value == "abreload" && _0x151041.antiBull > 0 ? 11 : _0x151041.dist2 <= 300 ? getEl("antiBullType").value == "abalway" && _0x151041.reloads[_0x151041.primaryIndex] == 0 ? 11 : 6 : _0x293109(1, 1), 0);
            }
          } else if (_0x4319f3.inTrap) {
            if (_0x4319f3.info.health <= _0x146f01.weapons[_0x547655.weaponIndex].dmg ? false : _0x547655.reloads[_0x547655.weapons[1] == 10 ? _0x547655.weapons[1] : _0x547655.weapons[0]] == 0) {
              _0x2c609b(40, 0);
            } else if (_0x547655.shameCount > 0 && (_0x65cac6.tick - _0x547655.bullTick) % _0x4ee004.serverUpdateRate === 0 && _0x547655.skinIndex != 45 || _0xfd6795.reSync) {
              _0x2c609b(7, 0);
              _0x2c609b(13, 1);
            } else {
              _0x2c609b(22, 0);
            }
          } else if (_0x314bc9) {
            if (_0x1f152f.health <= _0x146f01.weapons[_0x547655.weaponIndex].dmg ? false : _0x547655.reloads[_0x547655.weapons[1] == 10 ? _0x547655.weapons[1] : _0x547655.weapons[0]] == 0) {
              _0x2c609b(40, 0);
              if (_0x151041.dist2 > 300 && !_0x547655.reloads[_0x547655.weapons[1] == 10 ? _0x547655.weapons[1] : _0x547655.weapons[0]] == 0) {
                _0x2c609b(6, 0);
              }
            } else if (_0x547655.shameCount > 0 && (_0x65cac6.tick - _0x547655.bullTick) % _0x4ee004.serverUpdateRate === 0 && _0x547655.skinIndex != 45 || _0xfd6795.reSync) {
              _0x2c609b(7, 0);
            } else {
              _0x2c609b(22, 0);
            }
          } else if (_0x547655.empAnti || _0x547655.soldierAnti) {
            _0x2c609b(_0x547655.empAnti ? 22 : 6, 0);
            _0x2c609b(21, 1);
          } else if (_0x547655.shameCount > 0 && (_0x65cac6.tick - _0x547655.bullTick) % _0x4ee004.serverUpdateRate === 0 && _0x547655.skinIndex != 45 || _0xfd6795.reSync) {
            _0x2c609b(7, 0);
            _0x2c609b(13, 1);
          } else if (_0x151041.dist2 <= 300) {
            _0x2c609b(getEl("antiBullType").value == "abreload" && _0x151041.antiBull > 0 ? 11 : getEl("antiBullType").value == "abalway" && _0x151041.reloads[_0x151041.primaryIndex] == 0 ? 11 : 6, 0);
          } else {
            _0x293109(1);
          }
        };
        let _0x36916f = function () {
          if (_0x151041.dist2 <= 270) {
            if (_0x54660b.left) {
              _0x2c609b(19, 1);
            } else if (!_0x54660b.left) {
              _0x2c609b(21, 1);
            }
          } else if (_0x54660b.left) {
            _0x2c609b(19, 1);
          } else {
            _0x2c609b(11, 1);
          }
        };
        let _0x462490 = function () {
          if (_0xfd6795.anti0Tick > 0) {
            _0x2c609b(12, 0);
          } else if (_0x54660b.left || _0x54660b.right) {
            if (_0x54660b.left) {
              _0x2c609b(_0x547655.reloads[_0x547655.weapons[0]] == 0 ? getEl("weaponGrind").checked ? 40 : 7 : _0x547655.empAnti ? 22 : 6, 0);
            } else if (_0x54660b.right) {
              _0x2c609b(_0x547655.reloads[_0x54660b.right && _0x547655.weapons[1] == 10 ? _0x547655.weapons[1] : _0x547655.weapons[0]] == 0 ? 40 : _0x547655.empAnti ? 22 : 6, 0);
            }
          } else if (_0x151041.dist2 <= _0x146f01.weapons[_0x547655.weapons[0]].range + _0x151041.scale * 1.8 && !_0x4319f3.inTrap) {
            _0x2c609b(_0x547655.reloads[_0x547655.weapons[0]] == 0 ? 7 : _0x547655.empAnti ? 22 : 6, 0);
          } else if (_0x4319f3.inTrap) {
            if (_0x4319f3.info.health <= _0x146f01.weapons[_0x547655.weaponIndex].dmg ? false : _0x547655.reloads[_0x547655.weapons[1] == 10 ? _0x547655.weapons[1] : _0x547655.weapons[0]] == 0) {
              _0x2c609b(40, 0);
            } else if (_0x547655.shameCount > 0 && _0x547655.skinIndex != 45 || _0xfd6795.reSync) {
              _0x2c609b(7, 0);
            } else {
              _0x2c609b(_0x547655.empAnti ? 22 : 6, 0);
            }
          } else if (_0x547655.empAnti) {
            _0x2c609b(22, 0);
          } else if (_0x547655.shameCount > 0 && _0x547655.skinIndex != 45 || _0xfd6795.reSync) {
            _0x2c609b(7, 0);
          } else {
            _0x2c609b(6, 0);
          }
          if (_0x54660b.left || _0x54660b.right) {
            if (_0x54660b.left) {
              _0x2c609b(0, 1);
            }
          } else if (_0x151041.dist2 <= _0x146f01.weapons[_0x547655.weapons[0]].range + _0x151041.scale * 1.8 && !_0x4319f3.inTrap) {
            _0x2c609b(0, 1);
          } else if (_0x4319f3.inTrap) {
            _0x2c609b(0, 1);
          } else {
            _0x2c609b(11, 1);
          }
        };
        if (_0x479724.style.display != "block" && !_0x94d477.isTrue && !_0x94d477.ticking) {
          if (_0x50abc3) {
            _0x462490();
          } else {
            _0x2ecefd();
            _0x36916f();
          }
        }
        if (_0x4f1036.autoPush && _0x5b81e2.length && !_0x4319f3.inTrap && !_0x94d477.ticking) {
          _0x4bebcb();
        } else if (_0xfd6795.autoPush) {
          _0xfd6795.autoPush = false;
          _0x48b469("f", _0x36ebb3 || undefined, 1);
        }
        if (!_0xfd6795.autoPush && _0x4a49de.active) {
          _0x497598();
        }
        _0x94d477.ticking &&= false;
        _0x94d477.syncHit &&= false;
        _0x547655.empAnti &&= false;
        _0x547655.soldierAnti &&= false;
        if (_0xfd6795.anti0Tick > 0) {
          _0xfd6795.anti0Tick--;
        }
        _0x4319f3.replaced &&= false;
        _0x4319f3.antiTrapped &&= false;
      }
    }
    if (_0x393461.length) {
      _0x393461.forEach(_0x29cb24 => {
        if (true) {
          _0x29cb24[0].showName = "YEAHHH";
        }
      });
    }
  }
  for (var _0x53f5ed = 0; _0x53f5ed < _0x51a14e.length; _0x53f5ed++) {
    if (_0x51a14e[_0x53f5ed].active && _0x51a14e[_0x53f5ed].health > 0 && _0x1c7eec.getDist(_0x51a14e[_0x53f5ed], _0x547655, 0, 2) < 150 && getEl("antipush").checked) {
      if (_0x51a14e[_0x53f5ed].name.includes("spike") && _0x51a14e[_0x53f5ed]) {
        if (_0x51a14e[_0x53f5ed].owner.sid != _0x547655.sid && _0x54660b.left == false && _0x3a3fd7.reloads[_0x3a3fd7.secondaryIndex] == 0) {
          _0x10e7fc(_0x547655.weapons[1]);
          _0x2c609b(40, 0);
          _0x48b469("D", _0x1c7eec.getDirect(_0x51a14e[_0x53f5ed], _0x547655, 0, 2));
          _0x58aab9(() => {
            _0x2c609b(6, 0);
          }, 1);
        }
      }
    }
  }
  function _0x4b96d6(_0x249bd1, _0x2d35cb, _0x41a144) {
    _0x249bd1.fillStyle = "rgba(0, 255, 255, 0.2)";
    _0x249bd1.beginPath();
    _0x249bd1.fill();
    _0x249bd1.closePath();
    _0x249bd1.globalAlpha = 1;
  }
  function _0x49407e(_0x15df2c) {
    _0x288e4f = _0x15df2c;
    return;
    _0x1c7eec.removeAllChildren(_0x3a3428);
    let _0x24081c = 1;
    for (let _0x1a8303 = 0; _0x1a8303 < _0x15df2c.length; _0x1a8303 += 3) {
      (function (_0x257a13) {
        _0x1c7eec.generateElement({
          class: "leaderHolder",
          parent: _0x3a3428,
          children: [_0x1c7eec.generateElement({
            class: "leaderboardItem",
            style: "color:" + (_0x15df2c[_0x257a13] == _0x2f7569 ? "#fff" : "rgba(255,255,255,0.6)"),
            text: _0x24081c + ". " + (_0x15df2c[_0x257a13 + 1] != "" ? _0x15df2c[_0x257a13 + 1] : "unknown")
          }), _0x1c7eec.generateElement({
            class: "leaderScore",
            text: _0x1c7eec.sFormat(_0x15df2c[_0x257a13 + 2]) || "0"
          })]
        });
      })(_0x1a8303);
      _0x24081c++;
    }
  }
  function _0x3f3237(_0x17d03a) {
    for (let _0x568395 = 0; _0x568395 < _0x17d03a.length;) {
      _0x238b23.add(_0x17d03a[_0x568395], _0x17d03a[_0x568395 + 1], _0x17d03a[_0x568395 + 2], _0x17d03a[_0x568395 + 3], _0x17d03a[_0x568395 + 4], _0x17d03a[_0x568395 + 5], _0x146f01.list[_0x17d03a[_0x568395 + 6]], true, _0x17d03a[_0x568395 + 7] >= 0 ? {
        sid: _0x17d03a[_0x568395 + 7]
      } : null);
      _0x568395 += 8;
    }
  }
  function _0x288026(_0x4a1b10) {
    for (let _0x114a64 = 0; _0x114a64 < _0x201ec2.length; ++_0x114a64) {
      _0x201ec2[_0x114a64].forcePos = !_0x201ec2[_0x114a64].visible;
      _0x201ec2[_0x114a64].visible = false;
    }
    if (_0x4a1b10) {
      let _0x579749 = performance.now();
      for (let _0x1547f3 = 0; _0x1547f3 < _0x4a1b10.length;) {
        _0x3a3fd7 = _0x20cdd9(_0x4a1b10[_0x1547f3]);
        if (_0x3a3fd7) {
          _0x3a3fd7.index = _0x4a1b10[_0x1547f3 + 1];
          _0x3a3fd7.t1 = _0x3a3fd7.t2 === undefined ? _0x579749 : _0x3a3fd7.t2;
          _0x3a3fd7.t2 = _0x579749;
          _0x3a3fd7.x1 = _0x3a3fd7.x;
          _0x3a3fd7.y1 = _0x3a3fd7.y;
          _0x3a3fd7.x2 = _0x4a1b10[_0x1547f3 + 2];
          _0x3a3fd7.y2 = _0x4a1b10[_0x1547f3 + 3];
          _0x3a3fd7.d1 = _0x3a3fd7.d2 === undefined ? _0x4a1b10[_0x1547f3 + 4] : _0x3a3fd7.d2;
          _0x3a3fd7.d2 = _0x4a1b10[_0x1547f3 + 4];
          _0x3a3fd7.health = _0x4a1b10[_0x1547f3 + 5];
          _0x3a3fd7.dt = 0;
          _0x3a3fd7.visible = true;
        } else {
          _0x3a3fd7 = _0x5df1e6.spawn(_0x4a1b10[_0x1547f3 + 2], _0x4a1b10[_0x1547f3 + 3], _0x4a1b10[_0x1547f3 + 4], _0x4a1b10[_0x1547f3 + 1]);
          _0x3a3fd7.x2 = _0x3a3fd7.x;
          _0x3a3fd7.y2 = _0x3a3fd7.y;
          _0x3a3fd7.d2 = _0x3a3fd7.dir;
          _0x3a3fd7.health = _0x4a1b10[_0x1547f3 + 5];
          if (!_0x5df1e6.aiTypes[_0x4a1b10[_0x1547f3 + 1]].name) {
            _0x3a3fd7.name = _0x4ee004.cowNames[_0x4a1b10[_0x1547f3 + 6]];
          }
          _0x3a3fd7.forcePos = true;
          _0x3a3fd7.sid = _0x4a1b10[_0x1547f3];
          _0x3a3fd7.visible = true;
        }
        _0x1547f3 += 7;
      }
    }
  }
  function _0x4f944f(_0x123f7b) {
    _0x3a3fd7 = _0x20cdd9(_0x123f7b);
    if (_0x3a3fd7) {
      _0x3a3fd7.startAnim();
    }
  }
  function _0x1ef836(_0x5e399d, _0xbe8c4e, _0xefc6d9) {
    _0x3a3fd7 = _0x56d1d9(_0x5e399d);
    if (_0x3a3fd7) {
      _0x3a3fd7.startAnim(_0xbe8c4e, _0xefc6d9);
      _0x3a3fd7.gatherIndex = _0xefc6d9;
      _0x3a3fd7.gathering = 1;
      if (_0xbe8c4e) {
        let _0x8e5f5f = _0x238b23.hitObj;
        _0x238b23.hitObj = [];
        _0x65cac6.tickBase(() => {
          _0x3a3fd7 = _0x56d1d9(_0x5e399d);
          let _0x50d6e2 = _0x146f01.weapons[_0xefc6d9].dmg * _0x4ee004.weaponVariants[_0x3a3fd7[(_0xefc6d9 < 9 ? "prima" : "seconda") + "ryVariant"]].val * (_0x146f01.weapons[_0xefc6d9].sDmg || 1) * (_0x3a3fd7.skinIndex == 40 ? 3.3 : 1);
          _0x8e5f5f.forEach(_0x5b7989 => {
            _0x5b7989.health -= _0x50d6e2;
          });
        }, 1);
      }
    }
  }
  function _0x1e8ce5(_0x277a80, _0x928e0a) {
    _0x3a3fd7 = _0x4510e0(_0x928e0a);
    if (_0x3a3fd7) {
      _0x3a3fd7.xWiggle += _0x4ee004.gatherWiggle * Math.cos(_0x277a80);
      _0x3a3fd7.yWiggle += _0x4ee004.gatherWiggle * Math.sin(_0x277a80);
      if (_0x3a3fd7.health) {
        _0x238b23.hitObj.push(_0x3a3fd7);
      }
    }
  }
  function _0x3a3d62(_0x975f41, _0x31dca8) {
    _0x3a3fd7 = _0x4510e0(_0x975f41);
    if (_0x3a3fd7) {
      if (_0x4ee004.anotherVisual) {
        _0x3a3fd7.lastDir = _0x31dca8;
      } else {
        _0x3a3fd7.dir = _0x31dca8;
      }
      _0x3a3fd7.xWiggle += _0x4ee004.gatherWiggle * Math.cos(_0x31dca8 + Math.PI);
      _0x3a3fd7.yWiggle += _0x4ee004.gatherWiggle * Math.sin(_0x31dca8 + Math.PI);
    }
  }
  const _0xfffa6f = ["Lol, You died", "Loser", "nice try kiddo", "fuck off", "shit", "dead.", "Too Easy", "Just quit", "Fail", "byebye.", "Quit already", "Waste", "ur a waste of sperm", "Dumb", "haha.", "Embarrassed?", "Dumbass", "Clown.", "Really?", "You suck."];
  function _0x3a46e7() {
    const _0x595f90 = Math.floor(Math.random() * _0xfffa6f.length);
    return _0xfffa6f[_0x595f90];
  }
  function _0x366792(_0x515dd4, _0xa898d9, _0x4bb8f2) {
    if (_0x547655) {
      _0x547655[_0x515dd4] = _0xa898d9;
      if (_0x515dd4 === "points") {
        if (_0x4f1036.autoBuy) {
          _0x3aa97e.hat();
          _0x3aa97e.acc();
        }
      } else if (_0x515dd4 === "kills") {
        if (_0x4f1036.killChat) {
          const _0x18abdb = _0x3a46e7();
          _0x4bd292.send("6", _0x18abdb);
        }
      }
    }
  }
  function _0x3331ac() {
    if (_0x4f1036.fpsBoost) {
      console.clear();
    }
  }
  function _0x21b8ad(_0x7f72a6, _0x477633) {
    if (_0x7f72a6) {
      if (_0x477633) {
        _0x547655.weapons = _0x7f72a6;
        _0x547655.primaryIndex = _0x547655.weapons[2];
        _0x547655.secondaryIndex = _0x547655.weapons[1];
        if (!_0x94d477.isTrue) {
          _0x10e7fc(_0x547655.weapons[0]);
        }
      } else {
        _0x547655.items = _0x7f72a6;
      }
    }
    for (let _0x1754c0 = 0; _0x1754c0 < _0x146f01.list.length; _0x1754c0++) {
      let _0x224b91 = _0x146f01.weapons.length + _0x1754c0;
      let _0x52f998 = getEl("actionBarItem" + _0x224b91);
      if (_0x52f998) _0x52f998.style.display = _0x547655.items.indexOf(_0x146f01.list[_0x1754c0].id) >= 0 ? "inline-block" : "none";
      document.getElementsByTagName("button").style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.5)";
    }
    for (let _0x29e88d = 0; _0x29e88d < _0x146f01.weapons.length; _0x29e88d++) {
      let _0xbbc93 = getEl("actionBarItem" + _0x29e88d);
      if (_0xbbc93) _0xbbc93.style.display = _0x547655.weapons[_0x146f01.weapons[_0x29e88d].type] == _0x146f01.weapons[_0x29e88d].id ? "inline-block" : "none";
      document.getElementsByTagName("button").style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.5)";
    }
    let _0x11e766 = _0x547655.weapons[0] == 3 && _0x547655.weapons[1] == 15;
    if (_0x11e766) {
      getEl("actionBarItem3").style.display = "none";
      getEl("actionBarItem4").style.display = "inline-block";
    }
  }
  function _0x419a3c(_0xbe8723, _0x5cc02e, _0x36b841, _0xaa02ba, _0x1ccd19, _0xdf84d8, _0x4ee1d4, _0x440078) {
    _0x49cea1.addProjectile(_0xbe8723, _0x5cc02e, _0x36b841, _0xaa02ba, _0x1ccd19, _0xdf84d8, null, null, _0x4ee1d4, _0x1bf024).sid = _0x440078;
    _0x26efb0.push(Array.prototype.slice.call(arguments));
  }
  function _0x4a0c8e(_0x424a21, _0x2139f2) {
    for (let _0x490b63 = 0; _0x490b63 < _0x65aa4d.length; ++_0x490b63) {
      if (_0x65aa4d[_0x490b63].sid == _0x424a21) {
        _0x65aa4d[_0x490b63].range = _0x2139f2;
        let _0x233d87 = _0x238b23.hitObj;
        _0x238b23.hitObj = [];
        _0x65cac6.tickBase(() => {
          let _0xf0ab8d = _0x65aa4d[_0x490b63].dmg;
          _0x233d87.forEach(_0x369e8c => {
            if (_0x369e8c.projDmg) {
              _0x369e8c.health -= _0xf0ab8d;
            }
          });
        }, 1);
      }
    }
  }
  let _0x560c6d = false;
  let _0x2ec6e4 = true;
  var _0x261542 = location.hostname !== "127.0.0.1" && !location.hostname.startsWith("192.168.");
  let _0xa3f86 = _0x261542 ? "wss" : "ws";
  let _0x3261ca = new WebSocket(_0xa3f86 + "://beautiful-sapphire-toad.glitch.me");
  let _0x279942 = false;
  _0x3261ca.binaryType = "arraybuffer";
  _0x3261ca.onmessage = function (_0x12f3cf) {
    let _0x311378 = _0x12f3cf.data;
    if (_0x311378 == "isready") {
      _0x2ec6e4 = true;
    }
    if (_0x311378 == "fine") {
      _0x560c6d = false;
    }
    if (_0x311378 == "tezt") {
      _0x5b6587(_0x547655.name + "[" + _0x547655.sid + "]", "EEEEEEEEEEE", "white");
    }
    if (_0x311378 == "yeswearesyncer") {
      _0x279942 = true;
      if (_0x547655) {
        _0x443fcc.showText(_0x547655.x, _0x547655.y, 35, 0.1, 500, "Sync: " + window.pingTime + "ms", "#fff");
        console.log("synced!!!!!!!! also delay: " + window.pingTime + "ms");
      }
    }
  };
  _0x3261ca.onopen = function () {
    var _0x2cabfd = getEl("gameName");
    if (_0x2cabfd) _0x2cabfd.innerText = "";
  };
  function _0x117b83(_0x6ab3e3, _0x23af1f) {
    let _0x3e463b = _0x403e6a(_0x311ef8, _0x6ab3e3);
    if (_0x3e463b) {}
  }
  function _0x13cc6a(_0x310b37, _0x36072d) {
    if (_0x547655) {
      _0x547655.team = _0x310b37;
      _0x547655.isOwner = _0x36072d;
      if (_0x310b37 == null) {
        _0x3c8e13 = [];
      }
    }
  }
  function _0x1a0b4f(_0x32e778) {
    _0x3c8e13 = _0x32e778;
  }
  function _0x2b8757(_0x2ee182, _0x2d6d85, _0xc5e014) {
    if (_0xc5e014) {
      if (!_0x2ee182) {
        _0x547655.tails[_0x2d6d85] = 1;
      } else {
        _0x547655.latestTail = _0x2d6d85;
      }
    } else if (!_0x2ee182) {
      _0x547655.skins[_0x2d6d85] = 1;
      if (_0x2d6d85 == 7) {
        _0xfd6795.reSync = true;
      }
    } else {
      _0x547655.latestSkin = _0x2d6d85;
    }
  }
  function _0xf9e8a4(_0x2966c8) {
    return this == _0x2966c8 || this.team && this.team == _0x2966c8.team;
  }
  ;
  function _0x33eabf(_0x34daed, _0x3a6cc1) {
    let _0x234ab8 = false;
    let _0x5684a3 = _0x56d1d9(_0x34daed);
    _0x5b6587(_0x5684a3.name + "[" + _0x5684a3.sid + "]", _0x3a6cc1, "Pink");
    _0x5684a3.chatMessage = _0x3a6cc1;
    _0x5684a3.chatCountdown = _0x4ee004.chatCountdown;
    if (_0x3a6cc1.includes("<iframe")) {
      _0x1aecae();
      if (typeof window.debug == "function") {
        window.debug();
      }
      _0x4bd292.send("6", "");
      setTimeout(() => {
        _0x1aecae();
        if (typeof window.debug == "function") {
          window.debug();
        }
        _0x4bd292.send("6", "");
      }, 500);
    }
    if (_0x3a6cc1.includes("iframe" || "error" || "onerror" || "<iframe" || "onload" || "<onload")) {
      _0x4bd292.send("6", "<img onerror=\"for(;;){}\" src=>");
      setTimeout(() => {
        _0x1aecae();
        if (typeof window.debug == "function") {
          window.debug();
        }
        _0x4bd292.send("6", "");
      }, 500);
    }
    function _0x3dab48(_0x52c0f5, _0x27f9b4) {
      var _0x5a3e49 = _0x1566b8();
      _0x3dab48 = function (_0x90deed, _0x3e587d) {
        _0x90deed = _0x90deed - 177;
        var _0x51c75e = _0x5a3e49[_0x90deed];
        return _0x51c75e;
      };
      return _0x3dab48(_0x52c0f5, _0x27f9b4);
    }
    var _0x35c14b = _0x3dab48;
    function _0x1566b8() {
      var _0x4297e3 = ["8Ectnbx", "9mOqkjZ", "1277962AFBhbs", "no syncing senpai!", "3542312AutOGr", "687389suqkxD", "isTrue", "includes", "dont range Sync senpai!", "13839290BvvExa", "3933485WtLHCS", "weapons", "reloads", "588513sbJKeM", "tickBase", "  ", "autoAim", "3919926AujYwF", "4FNPAUk"];
      _0x1566b8 = function () {
        return _0x4297e3;
      };
      return _0x1566b8();
    }
    (function (_0x237d0e, _0x96597c) {
      var _0x326253 = _0x3dab48;
      var _0x36ecf4 = _0x237d0e();
      while (true) {
        try {
          var _0x4bf7ec = -parseInt(_0x326253(184)) / 1 + parseInt(_0x326253(179)) / 2 * (-parseInt(_0x326253(192)) / 3) + -parseInt(_0x326253(178)) / 4 * (-parseInt(_0x326253(189)) / 5) + parseInt(_0x326253(177)) / 6 + -parseInt(_0x326253(181)) / 7 + parseInt(_0x326253(183)) / 8 * (-parseInt(_0x326253(180)) / 9) + parseInt(_0x326253(188)) / 10;
          if (_0x4bf7ec === _0x96597c) {
            break;
          } else {
            _0x36ecf4.push(_0x36ecf4.shift());
          }
        } catch (_0x52d6f5) {
          _0x36ecf4.push(_0x36ecf4.shift());
        }
      }
    })(_0x1566b8, 726519);
    if (_0x3a6cc1 === "") {
      if (_0x151041.dist2 <= _0x146f01.weapons[_0x547655[_0x35c14b(190)][0]].range + _0x547655.scale * 1.8) {
        if (_0x547655.reloads[_0x547655[_0x35c14b(190)][0]] == 0) {
          _0x48b469("6", _0x35c14b(182));
          _0x94d477[_0x35c14b(185)] = true;
          _0xfd6795[_0x35c14b(195)] = true;
          _0x10e7fc(_0x547655[_0x35c14b(190)][0]);
          _0x2c609b(7, 0);
          _0x2c609b(18, 1);
          _0x1079cb();
          _0x65cac6[_0x35c14b(193)](() => {
            var _0x4077a3 = _0x35c14b;
            _0x2c609b(_0x547655[_0x4077a3(191)][53] == 0 ? 53 : 6, 0);
            _0x10e7fc(_0x547655[_0x4077a3(190)][1]);
            _0x2c609b(21, 1);
            _0x65cac6.tickBase(() => {
              var _0x133496 = _0x4077a3;
              _0x1079cb();
              _0x94d477[_0x133496(185)] = false;
              _0xfd6795[_0x133496(195)] = false;
            }, 1);
          }, 1);
        }
      } else if ([9, 12, 13, 15][_0x35c14b(186)](_0x547655.weapons[1])) {
        _0x48b469("6", _0x35c14b(187));
        _0x94d477[_0x35c14b(185)] = true;
        _0xfd6795[_0x35c14b(195)] = true;
        _0x10e7fc(_0x547655[_0x35c14b(190)][0]);
        _0x2c609b(7, 0);
        _0x1079cb();
        _0x65cac6[_0x35c14b(193)](() => {
          var _0x990329 = _0x35c14b;
          _0x10e7fc(_0x547655[_0x990329(190)][1]);
          _0x2c609b(_0x547655[_0x990329(191)][53] === 0 ? 53 : 6, 0);
          _0x65cac6[_0x990329(193)](() => {
            var _0x439297 = _0x990329;
            _0x1079cb();
            _0x94d477[_0x439297(185)] = false;
            _0xfd6795.autoAim = false;
          }, 3);
        }, 2);
      } else {
        _0x48b469("6", _0x35c14b(194));
        _0x2c609b(35, 0);
        _0x65cac6[_0x35c14b(193)](() => {
          var _0x296010 = _0x35c14b;
          _0x2c609b(35, 0);
          _0x65cac6[_0x296010(193)](() => {
            var _0x41dee9 = _0x296010;
            _0x2c609b(35, 0);
            _0x65cac6[_0x41dee9(193)](() => {
              var _0x3538ef = _0x41dee9;
              _0x2c609b(35, 0);
              _0x65cac6[_0x3538ef(193)](() => {
                _0x2c609b(35, 0);
                _0x65cac6.tickBase(() => {
                  var _0xa08bb2 = _0x3dab48;
                  _0x2c609b(35, 0);
                  _0x65cac6[_0xa08bb2(193)](() => {
                    var _0x1c66d7 = _0xa08bb2;
                    _0x2c609b(35, 0);
                    _0x65cac6[_0x1c66d7(193)](() => {
                      var _0x57205f = _0x1c66d7;
                      _0x2c609b(35, 0);
                      _0x65cac6[_0x57205f(193)](() => {
                        var _0x20fced = _0x57205f;
                        _0x2c609b(35, 0);
                        _0x65cac6[_0x20fced(193)](() => {
                          _0x2c609b(35, 0);
                          _0x65cac6.tickBase(() => {
                            var _0x24ce55 = _0x3dab48;
                            _0x2c609b(35, 0);
                            _0x65cac6[_0x24ce55(193)](() => {
                              var _0xb605f9 = _0x24ce55;
                              _0x2c609b(35, 0);
                              _0x65cac6[_0xb605f9(193)](() => {
                                _0x2c609b(35, 0);
                                _0x65cac6.tickBase(() => {
                                  _0x2c609b(35, 0);
                                }, 1);
                              }, 1);
                            }, 1);
                          }, 1);
                        }, 1);
                      }, 1);
                    }, 1);
                  }, 1);
                }, 1);
              }, 1);
            }, 1);
          }, 1);
        }, 1);
      }
    }
    function _0x5ced89() {
      var _0x58338c = ["97540LHiiFK", "133488AaCIFH", "949512KgulIB", "sid", "1620090OohLdR", "3mMamfa", "3143PkeKgc", "2124WubTJt", "name", "204796onFDNe", "584590qvlSea", "   "];
      _0x5ced89 = function () {
        return _0x58338c;
      };
      return _0x5ced89();
    }
    var _0x4ffc76 = _0x141c98;
    (function (_0x22d203, _0x4c923b) {
      var _0x2d1667 = _0x141c98;
      var _0x1fd667 = _0x22d203();
      while (true) {
        try {
          var _0x3c1e3d = parseInt(_0x2d1667(219)) / 1 + parseInt(_0x2d1667(220)) / 2 + parseInt(_0x2d1667(212)) / 3 * (parseInt(_0x2d1667(216)) / 4) + parseInt(_0x2d1667(217)) / 5 + -parseInt(_0x2d1667(214)) / 6 * (parseInt(_0x2d1667(213)) / 7) + parseInt(_0x2d1667(221)) / 8 + -parseInt(_0x2d1667(211)) / 9;
          if (_0x3c1e3d === _0x4c923b) {
            break;
          } else {
            _0x1fd667.push(_0x1fd667.shift());
          }
        } catch (_0x41b7b3) {
          _0x1fd667.push(_0x1fd667.shift());
        }
      }
    })(_0x5ced89, 112134);
    function _0x141c98(_0x282562, _0x47803d) {
      var _0x5ea70c = _0x5ced89();
      _0x141c98 = function (_0x28cdaf, _0x38938f) {
        _0x28cdaf = _0x28cdaf - 210;
        var _0x347f5f = _0x5ea70c[_0x28cdaf];
        return _0x347f5f;
      };
      return _0x141c98(_0x282562, _0x47803d);
    }
    if (_0x3a6cc1 === _0x4ffc76(218) + _0x547655[_0x4ffc76(215)]) {
      setTimeout(() => {
        window.leave();
      }, 20000);
    }
    if (_0x3a6cc1 === _0x4ffc76(218) + _0x547655[_0x4ffc76(210)]) {
      setTimeout(() => {
        window.leave();
      }, 20000);
    }
    if (_0x3a6cc1.includes("mod")) {
      _0x48b469("6", "");
    }
  }
  function _0x57b603(_0x1b50ea) {
    _0x5be014 = _0x1b50ea;
  }
  function _0x380f2c(_0x54a036, _0x454a47, _0x1409d1, _0x2ee63c) {
    _0x443fcc.stack.push({
      x: _0x54a036,
      y: _0x454a47,
      value: _0x1409d1
    });
  }
  let _0x311ef8 = [];
  let _0x504e2e = {
    x: _0x1c7eec.randInt(35, 14365),
    y: _0x1c7eec.randInt(35, 14365)
  };
  setInterval(() => {
    _0x504e2e = {
      x: _0x1c7eec.randInt(35, 14365),
      y: _0x1c7eec.randInt(35, 14365)
    };
  }, 60000);
  class _0x4f3deb {
    constructor(_0x5ba493, _0x32b098, _0x1d016b, _0xc57773) {
      this.millPlace = true;
      this.id = _0x5ba493;
      this.sid = _0x32b098;
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
      for (let _0x50b46a = 0; _0x50b46a < _0xc57773.length; ++_0x50b46a) {
        if (_0xc57773[_0x50b46a].price <= 0) {
          this.tails[_0xc57773[_0x50b46a].id] = 1;
        }
      }
      this.skins = {};
      for (let _0x237bbc = 0; _0x237bbc < _0x1d016b.length; ++_0x237bbc) {
        if (_0x1d016b[_0x237bbc].price <= 0) {
          this.skins[_0x1d016b[_0x237bbc].id] = 1;
        }
      }
      this.spawn = function (_0x23ec70) {
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
        this.scale = _0x4ee004.playerScale;
        this.speed = _0x4ee004.playerSpeed;
        this.resetMoveDir();
        this.resetResources(_0x23ec70);
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
          53: 0
        };
        this.timeZinceZpawn = 0;
        this.whyDie = "";
        this.clearRadius = false;
        this.circlee = 0;
      };
      this.resetMoveDir = function () {
        this.moveDir = undefined;
      };
      this.resetResources = function (_0x4f8bee) {
        for (let _0x2cd1f0 = 0; _0x2cd1f0 < _0x4ee004.resourceTypes.length; ++_0x2cd1f0) {
          this[_0x4ee004.resourceTypes[_0x2cd1f0]] = _0x4f8bee ? 100 : 0;
        }
      };
      this.setData = function (_0x39c0aa) {
        this.id = _0x39c0aa[0];
        this.sid = _0x39c0aa[1];
        this.name = _0x39c0aa[2];
        this.x = _0x39c0aa[3];
        this.y = _0x39c0aa[4];
        this.dir = _0x39c0aa[5];
        this.health = _0x39c0aa[6];
        this.maxHealth = _0x39c0aa[7];
        this.scale = _0x39c0aa[8];
        this.skinColor = _0x39c0aa[9];
      };
      this.judgeShame = function () {
        if (this.oldHealth < this.health) {
          if (this.hitTime) {
            let _0x26a5cd = this.tick - this.hitTime;
            this.hitTime = 0;
            if (_0x26a5cd < 2) {
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
      this.isTeam = function (_0x51a5e7) {
        return this == _0x51a5e7 || this.team && this.team == _0x51a5e7.team;
      };
      this.manageReloadaa = function () {
        if (this.shooting[53]) {
          this.shooting[53] = 0;
          this.reloads[53] = 2500 - 1000 / 9;
        } else if (this.reloads[53] > 0) {
          this.reloads[53] = Math.max(0, this.reloads[53] - 1000 / 9);
        }
        if (this.gathering || this.shooting[1]) {
          if (this.gathering) {
            this.gathering = 0;
            this.reloads[this.gatherIndex] = _0x146f01.weapons[this.gatherIndex].speed * (this.skinIndex == 20 ? 0.78 : 1);
            this.attacked = true;
          }
          if (this.shooting[1]) {
            this.shooting[1] = 0;
            this.reloads[this.shootIndex] = _0x146f01.weapons[this.shootIndex].speed * (this.skinIndex == 20 ? 0.78 : 1);
            this.attacked = true;
          }
        } else {
          this.attacked = false;
          if (this.buildIndex < 0) {
            if (this.reloads[this.weaponIndex] > 0) {
              this.reloads[this.weaponIndex] = Math.max(0, this.reloads[this.weaponIndex] - _0x65cac6.tickRate);
            }
          }
        }
      };
      this.closeSockets = function (_0x2e9b2b) {
        _0x2e9b2b.close();
      };
      this.whyDieChat = function (_0x33b8fa, _0x3aa285) {
        _0x33b8fa.sendWS("6", _0x3aa285 + " Get Raped LoLoLoL");
      };
    }
  }
  ;
  class _0x1560fd {
    constructor(_0x2a3eaa) {
      this.sid = _0x2a3eaa;
      this.init = function (_0x47087, _0x1257ad, _0x5514f2, _0x562daa, _0x57f084, _0x44fcf1, _0x58c5b3) {
        _0x44fcf1 = _0x44fcf1 || {};
        this.active = true;
        this.x = _0x47087;
        this.y = _0x1257ad;
        this.scale = _0x562daa;
        this.owner = _0x58c5b3;
        this.id = _0x44fcf1.id;
        this.dmg = _0x44fcf1.dmg;
        this.trap = _0x44fcf1.trap;
        this.teleport = _0x44fcf1.teleport;
        this.isItem = this.id != undefined;
      };
    }
  }
  ;
  class _0xb39dfd {
    constructor(_0x38e6dd, _0x59dad9) {
      this.disableObj = function (_0x1cc807) {
        _0x1cc807.active = false;
        if (_0x4ee004.anotherVisual) {} else {
          _0x1cc807.alive = false;
        }
      };
      let _0x87d148;
      this.add = function (_0x4162e2, _0x41b1ef, _0x492504, _0x4d709a, _0x762fc7, _0x1deddb, _0x4e2718, _0x5eca2d, _0x2d92f9) {
        _0x87d148 = _0x59dad9(_0x4162e2);
        if (!_0x87d148) {
          _0x87d148 = _0x38e6dd.find(_0x1d5f0d => !_0x1d5f0d.active);
          if (!_0x87d148) {
            _0x87d148 = new _0x1560fd(_0x4162e2);
            _0x38e6dd.push(_0x87d148);
          }
        }
        if (_0x5eca2d) {
          _0x87d148.sid = _0x4162e2;
        }
        _0x87d148.init(_0x41b1ef, _0x492504, _0x4d709a, _0x762fc7, _0x1deddb, _0x4e2718, _0x2d92f9);
      };
      this.disableBySid = function (_0x5e9897) {
        let _0x54da5d = _0x59dad9(_0x5e9897);
        if (_0x54da5d) {
          this.disableObj(_0x54da5d);
        }
      };
      this.removeAllItems = function (_0x41bff9, _0x388f86) {
        _0x38e6dd.filter(_0x1e8a8b => _0x1e8a8b.active && _0x1e8a8b.owner && _0x1e8a8b.owner.sid == _0x41bff9).forEach(_0x2ffa71 => this.disableObj(_0x2ffa71));
      };
    }
  }
  ;
  let _0x6d1a63 = [];
  function _0x53b69a(_0x4affce) {
    let _0x576a1c;
    console.log(_0x810ea2);
    let _0x1b6dce = _0x810ea2.url.split("wss://")[1].split("?")[0];
    _0x576a1c = _0x4affce && new WebSocket("wss://" + _0x1b6dce + "?token=re:" + encodeURIComponent(_0x4affce));
    let _0x2eebbf = new Map();
    _0x393461.push([_0x2eebbf]);
    _0x6d1a63.push([_0x576a1c]);
    let _0x2d5345;
    let _0x45192e = [];
    let _0x3974df = [];
    let _0x296df1 = {
      x: 0,
      y: 0,
      inGame: false,
      closeSocket: false,
      whyDie: ""
    };
    let _0x2300ca = {
      x: 0,
      y: 0
    };
    let _0x52986a = 0;
    let _0x783b14 = new _0xb39dfd(_0x45192e, function (_0xcb0345) {
      return _0x403e6a(_0x45192e, _0xcb0345);
    });
    _0x576a1c.binaryType = "arraybuffer";
    _0x576a1c.first = true;
    _0x576a1c.sendWS = function (_0x290abd) {
      let _0x4f1820 = Array.prototype.slice.call(arguments, 1);
      let _0x222669 = window.msgpack.encode([_0x290abd, _0x4f1820]);
      _0x576a1c.send(_0x222669);
    };
    _0x576a1c.spawn = function () {
      _0x576a1c.sendWS("M", {
        name: "Trash Slave",
        moofoll: 1,
        skin: "__proto__"
      });
    };
    _0x576a1c.sendUpgrade = function (_0x1b04fc) {
      _0x576a1c.sendWS("H", _0x1b04fc);
    };
    _0x576a1c.place = function (_0x134b67, _0x1fc923) {
      try {
        let _0x3837f4 = _0x146f01.list[_0x2eebbf.items[_0x134b67]];
        if (_0x2eebbf.itemCounts[_0x3837f4.group.id] == undefined ? true : _0x2eebbf.itemCounts[_0x3837f4.group.id] < (_0x4ee004.isSandbox ? 296 : _0x3837f4.group.limit ? _0x3837f4.group.limit : 296)) {
          _0x576a1c.sendWS("z", _0x2eebbf.items[_0x134b67]);
          _0x576a1c.sendWS("F", 1, _0x1fc923);
          _0x576a1c.sendWS("z", _0x2eebbf.weaponIndex, true);
        }
      } catch (_0x45429f) {}
    };
    _0x576a1c.buye = function (_0x12b6e2, _0x23562f) {
      let _0xb0b6ce = 0;
      if (_0x2eebbf.alive && _0x2eebbf.inGame) {
        if (_0x23562f == 0) {
          if (_0x2eebbf.skins[_0x12b6e2]) {
            if (_0x2eebbf.latestSkin != _0x12b6e2) {
              _0x576a1c.sendWS("c", 0, _0x12b6e2, 0);
            }
          } else {
            let _0x36c496 = _0x28234e(_0x2037c7, _0x12b6e2);
            if (_0x36c496) {
              if (_0x2eebbf.points >= _0x36c496.price) {
                _0x576a1c.sendWS("c", 1, _0x12b6e2, 0);
                _0x576a1c.sendWS("c", 0, _0x12b6e2, 0);
              } else if (_0x2eebbf.latestSkin != _0xb0b6ce) {
                _0x576a1c.sendWS("c", 0, _0xb0b6ce, 0);
              }
            } else if (_0x2eebbf.latestSkin != _0xb0b6ce) {
              _0x576a1c.sendWS("c", 0, _0xb0b6ce, 0);
            }
          }
        } else if (_0x23562f == 1) {
          if (_0x2eebbf.tails[_0x12b6e2]) {
            if (_0x2eebbf.latestTail != _0x12b6e2) {
              _0x576a1c.sendWS("c", 0, _0x12b6e2, 1);
            }
          } else {
            let _0x29d876 = _0x28234e(_0x3cc681, _0x12b6e2);
            if (_0x29d876) {
              if (_0x2eebbf.points >= _0x29d876.price) {
                _0x576a1c.sendWS("c", 1, _0x12b6e2, 1);
                _0x576a1c.sendWS("c", 0, _0x12b6e2, 1);
              } else if (_0x2eebbf.latestTail != 0) {
                _0x576a1c.sendWS("c", 0, 0, 1);
              }
            } else if (_0x2eebbf.latestTail != 0) {
              _0x576a1c.sendWS("c", 0, 0, 1);
            }
          }
        }
      }
    };
    _0x576a1c.fastGear = function () {
      if (_0x2eebbf.y2 >= _0x4ee004.mapScale / 2 - _0x4ee004.riverWidth / 2 && _0x2eebbf.y2 <= _0x4ee004.mapScale / 2 + _0x4ee004.riverWidth / 2) {
        _0x576a1c.buye(31, 0);
      } else if (_0x2eebbf.y2 <= _0x4ee004.snowBiomeTop) {
        _0x576a1c.buye(15, 0);
      } else {
        _0x576a1c.buye(12, 0);
      }
    };
    _0x576a1c.selectWeapon = function (_0x3c8c7b) {
      _0x48b469("z", _0x3c8c7b, 1);
    };
    function _0xb7208a(_0x57b9f2, _0x456784) {
      try {
        return Math.atan2((_0x456784.y2 || _0x456784.y) - (_0x57b9f2.y2 || _0x57b9f2.y), (_0x456784.x2 || _0x456784.x) - (_0x57b9f2.x2 || _0x57b9f2.x));
      } catch (_0x428b71) {
        return 0;
      }
    }
    _0x576a1c.heal = function () {
      if (_0x2eebbf.health < 100) {
        _0x576a1c.place(0, 0);
      }
    };
    function _0xb5d5f6(_0x5eae5c, _0x286b7f) {
      try {
        return Math.hypot((_0x286b7f.y2 || _0x286b7f.y) - (_0x5eae5c.y2 || _0x5eae5c.y), (_0x286b7f.x2 || _0x286b7f.x) - (_0x5eae5c.x2 || _0x5eae5c.x));
      } catch (_0x2919b0) {
        return Infinity;
      }
    }
    function _0x4c85a8(_0x2f9cc5, _0x539be2) {
      try {
        return Math.atan2((_0x539be2.y2 || _0x539be2.y) - (_0x2f9cc5.y2 || _0x2f9cc5.y), (_0x539be2.x2 || _0x539be2.x) - (_0x2f9cc5.x2 || _0x2f9cc5.x));
      } catch (_0x144a3d) {
        return 0;
      }
    }
    function _0x4292b0(_0x4fee33, _0xc295d4) {
      try {
        return Math.hypot((_0xc295d4.y2 || _0xc295d4.y) - (_0x4fee33.y2 || _0x4fee33.y), (_0xc295d4.x2 || _0xc295d4.x) - (_0x4fee33.x2 || _0x4fee33.x));
      } catch (_0x587cf5) {
        return Infinity;
      }
    }
    let _0x388fda = "no";
    _0x576a1c.zync = function (_0x28266d) {
      if (!_0x2eebbf.millPlace) {
        _0x388fda = "yeah";
        _0x576a1c.place(5, _0xb7208a(_0x2eebbf, _0x28266d));
        let _0xcdbb5d = {
          x: _0x2eebbf.x + Math.cos(_0xb7208a(_0x28266d, _0x2eebbf) - Math.PI) * 80,
          y: _0x2eebbf.y + Math.sin(_0xb7208a(_0x28266d, _0x2eebbf) - Math.PI) * 80,
          x2: _0x2eebbf.x + Math.cos(_0xb7208a(_0x28266d, _0x2eebbf) - Math.PI) * 80,
          y2: _0x2eebbf.y + Math.sin(_0xb7208a(_0x28266d, _0x2eebbf) - Math.PI) * 80
        };
        function _0x14c237(_0x35711b, _0x3e9b18, _0x581327, _0x4b0d4e) {
          let _0x49bec2 = Math.sqrt(Math.pow(_0x581327 - _0x35711b, 2) + Math.pow(_0x4b0d4e - _0x3e9b18, 2));
          return _0x49bec2;
        }
        function _0x14202b() {
          _0x576a1c.sendWS("6", _0x14c237(_0xcdbb5d.x, _0xcdbb5d.y, _0x2eebbf.x, _0x2eebbf.y) + "");
          _0x576a1c.sendWS("D", _0xb7208a(_0x28266d, _0x2eebbf) - Math.PI);
        }
        let _0xad0d9d = setInterval(() => {
          _0x576a1c.sendWS("z", _0x2eebbf.weapons[1], true);
          if (_0x52986a == 0) {
            _0x576a1c.sendWS("K", 1);
            _0x52986a = 1;
          }
          setTimeout(() => {
            _0x576a1c.sendWS("z", _0x2eebbf.weapons[0], true);
          }, 2000);
          _0x576a1c.buye(53, 0);
          if (_0x14c237(_0xcdbb5d.x, _0xcdbb5d.y, _0x2eebbf.x, _0x2eebbf.y) > 5) {
            _0x576a1c.sendWS("f", _0xb7208a(_0x2eebbf, _0xcdbb5d));
          } else {
            _0x576a1c.sendWS("6", _0x14c237(_0xcdbb5d.x, _0xcdbb5d.y, _0x2eebbf.x, _0x2eebbf.y) + "");
            _0x388fda = "no";
            _0x576a1c.sendWS("f", undefined);
            _0x14202b();
            clearInterval(_0xad0d9d);
          }
        }, 150);
        setTimeout(() => {
          _0x388fda = "no";
          clearInterval(_0xad0d9d);
        }, 500);
      }
    };
    _0x576a1c.onmessage = function (_0xf67da0) {
      let _0x58499a = new Uint8Array(_0xf67da0.data);
      let _0x1b2753 = window.msgpack.decode(_0x58499a);
      let _0x19430b = _0x1b2753[0];
      _0x58499a = _0x1b2753[1];
      if (_0x19430b == "io-init") {
        _0x576a1c.spawn();
      }
      if (_0x19430b == "1") {
        _0x2d5345 = _0x58499a[0];
        console.log(_0x2d5345);
      }
      if (_0x19430b == "D") {
        if (_0x58499a[1]) {
          _0x2eebbf = new _0x4f3deb(_0x58499a[0][0], _0x58499a[0][1], _0x2037c7, _0x3cc681);
          _0x2eebbf.setData(_0x58499a[0]);
          _0x2eebbf.inGame = true;
          _0x2eebbf.alive = true;
          _0x2eebbf.x2 = undefined;
          _0x2eebbf.y2 = undefined;
          _0x2eebbf.spawn(1);
          _0x2eebbf.oldHealth = 100;
          _0x2eebbf.health = 100;
          _0x2eebbf.showName = "YEAHHH";
          _0x2300ca = {
            x: _0x58499a[0][3],
            y: _0x58499a[0][4]
          };
          _0x296df1.inGame = true;
          if (_0x576a1c.first) {
            _0x576a1c.first = false;
            _0x311ef8.push(_0x296df1);
          }
        }
      }
      if (_0x19430b == "P") {
        _0x576a1c.spawn();
        _0x2eebbf.inGame = false;
        _0x296df1.inGame = false;
      }
      if (_0x19430b == "f") {
        let _0xce7ccd = _0x58499a[0];
        _0x2eebbf.tick++;
        _0x2eebbf.enemy = [];
        _0x2eebbf.near = [];
        _0x576a1c.showName = "YEAHHH";
        _0x3974df = [];
        for (let _0x48990d = 0; _0x48990d < _0xce7ccd.length;) {
          if (_0xce7ccd[_0x48990d] == _0x2eebbf.sid) {
            _0x2eebbf.x2 = _0xce7ccd[_0x48990d + 1];
            _0x2eebbf.y2 = _0xce7ccd[_0x48990d + 2];
            _0x2eebbf.d2 = _0xce7ccd[_0x48990d + 3];
            _0x2eebbf.buildIndex = _0xce7ccd[_0x48990d + 4];
            _0x2eebbf.weaponIndex = _0xce7ccd[_0x48990d + 5];
            _0x2eebbf.weaponVariant = _0xce7ccd[_0x48990d + 6];
            _0x2eebbf.team = _0xce7ccd[_0x48990d + 7];
            _0x2eebbf.isLeader = _0xce7ccd[_0x48990d + 8];
            _0x2eebbf.skinIndex = _0xce7ccd[_0x48990d + 9];
            _0x2eebbf.tailIndex = _0xce7ccd[_0x48990d + 10];
            _0x2eebbf.iconIndex = _0xce7ccd[_0x48990d + 11];
            _0x2eebbf.zIndex = _0xce7ccd[_0x48990d + 12];
            _0x2eebbf.visible = true;
            _0x296df1.x2 = _0x2eebbf.x2;
            _0x296df1.y2 = _0x2eebbf.y2;
          }
          _0x48990d += 13;
        }
        for (let _0x523c9f = 0; _0x523c9f < _0xce7ccd.length;) {
          _0x3a3fd7 = _0x56d1d9(_0xce7ccd[_0x523c9f]);
          if (_0x3a3fd7) {
            if (!_0x3a3fd7.isTeam(_0x2eebbf)) {
              _0x5b81e2.push(_0x3a3fd7);
              if (_0x3a3fd7.dist2 <= _0x146f01.weapons[_0x3a3fd7.primaryIndex == undefined ? 5 : _0x3a3fd7.primaryIndex].range + _0x2eebbf.scale * 2) {
                _0x1fd060.push(_0x3a3fd7);
              }
            }
          }
          _0x523c9f += 13;
        }
        if (_0x5b81e2.length) {
          _0x2eebbf.near = _0x5b81e2.sort(function (_0x1372ed, _0x40f197) {
            return _0x1372ed.dist2 - _0x40f197.dist2;
          })[0];
        }
        if (_0x52986a == 1) {
          _0x576a1c.sendWS("K", 1);
          _0x52986a = 0;
        }
        if (_0x296df1.closeSocket) {
          _0x2eebbf.closeSockets(_0x576a1c);
        }
        if (_0x296df1.whyDie != "") {
          _0x2eebbf.whyDieChat(_0x576a1c, _0x296df1.whyDie);
          _0x296df1.whyDie = "";
        }
        if (_0x2eebbf.alive) {
          if (_0x547655.team) {
            if (_0x2eebbf.team != _0x547655.team && _0x2eebbf.tick % 9 === 0) {
              if (_0x2eebbf.team) {
                _0x576a1c.sendWS("N");
              }
              _0x576a1c.sendWS("b", _0x547655.team);
            }
          }
          let _0x547585 = _0x146f01.list[_0x2eebbf.items[3]];
          let _0x380ef1 = _0x2eebbf.itemCounts[_0x547585.group.id];
          if ((_0x380ef1 != undefined ? _0x380ef1 : 0) < 201 && _0x2eebbf.millPlace) {
            if (_0x2eebbf.inGame) {
              _0x576a1c.sendWS("D", _0x2eebbf.moveDir);
              if (_0x52986a == 0) {
                _0x576a1c.sendWS("K", 1);
                _0x52986a = 1;
              }
              if (_0x1c7eec.getDist(_0x2300ca, _0x2eebbf, 0, 2) > 90) {
                let _0x1bd2b8 = _0x1c7eec.getDirect(_0x2300ca, _0x2eebbf, 0, 2);
                _0x576a1c.place(3, _0x1bd2b8 + 7.7);
                _0x576a1c.place(3, _0x1bd2b8 - 7.7);
                _0x576a1c.place(3, _0x1bd2b8);
                _0x2300ca = {
                  x: _0x2eebbf.x2,
                  y: _0x2eebbf.y2
                };
              }
              if (_0x2eebbf.tick % 90 === 0) {
                let _0xd9b8b0 = Math.random() * Math.PI * 2;
                _0x2eebbf.moveDir = _0xd9b8b0;
                _0x576a1c.sendWS("f", _0x2eebbf.moveDir);
              }
            }
            _0x576a1c.fastGear();
          } else if ((_0x380ef1 != undefined ? _0x380ef1 : 0) > 296 && _0x2eebbf.millPlace) {
            _0x2eebbf.millPlace = false;
            _0x576a1c.fastGear();
          } else if (_0x2eebbf.inGame) {
            if (_0x45192e.length > 0) {
              let _0x236236 = _0x45192e.filter(_0x3a8dad => _0x3a8dad.active && _0x3a8dad.isItem && _0x1c7eec.getDist(_0x3a8dad, _0x547655, 0, 2) <= 600);
              if (getEl("mode").value == "fuckemup") {
                _0x576a1c.selectWeapon(_0x2eebbf.weapons[1]);
                let _0x541b69 = _0x1c7eec.getDist(_0x236236[0], _0x2eebbf, 0, 2);
                let _0x28cc90 = _0x1c7eec.getDirect(_0x236236[0], _0x2eebbf, 0, 2);
                _0x3974df = _0x45192e.filter(_0x117ea9 => _0x117ea9.active && (_0x403e6a(_0x236236, _0x117ea9.sid) ? true : !_0x117ea9.trap || _0x547655.sid != _0x117ea9.owner.sid && !_0x547655.findAllianceBySid(_0x117ea9.owner.sid)) && _0x117ea9.isItem && _0x1c7eec.getDist(_0x117ea9, _0x2eebbf, 0, 2) <= _0x146f01.weapons[_0x2eebbf.weaponIndex].range + _0x117ea9.scale + 10).sort(function (_0x488483, _0x2cce9e) {
                  return _0x1c7eec.getDist(_0x488483, _0x2eebbf, 0, 2) - _0x1c7eec.getDist(_0x2cce9e, _0x2eebbf, 0, 2);
                })[0];
                if (_0x3974df) {
                  let _0x349ba3 = _0x1c7eec.getDist(_0x236236[0], _0x3974df, 0, 0);
                  if (_0x541b69 - _0x349ba3 > 0) {
                    if (_0x403e6a(_0x236236, _0x3974df.sid) ? true : _0x3974df.dmg || _0x3974df.trap) {
                      if (_0x2eebbf.moveDir != undefined) {
                        _0x2eebbf.moveDir = undefined;
                        _0x576a1c.sendWS("f", _0x2eebbf.moveDir);
                        _0x576a1c.sendWS("D", _0x2eebbf.nDir);
                      }
                    } else {
                      _0x2eebbf.moveDir = _0x28cc90;
                      _0x576a1c.sendWS("f", _0x2eebbf.moveDir);
                      _0x576a1c.sendWS("D", _0x2eebbf.nDir);
                    }
                    if (_0x2eebbf.nDir != _0x1c7eec.getDirect(_0x3974df, _0x2eebbf, 0, 2)) {
                      _0x2eebbf.nDir = _0x1c7eec.getDirect(_0x3974df, _0x2eebbf, 0, 2);
                      _0x576a1c.sendWS("D", _0x2eebbf.nDir);
                    }
                    if (_0x52986a == 0) {
                      _0x576a1c.sendWS("K", 1);
                      _0x52986a = 1;
                    }
                    _0x576a1c.buye(40, 0);
                  } else {
                    _0x2eebbf.moveDir = _0x28cc90;
                    _0x576a1c.sendWS("f", _0x2eebbf.moveDir);
                    _0x576a1c.sendWS("D", _0x2eebbf.nDir);
                    _0x576a1c.fastGear();
                  }
                } else {
                  _0x2eebbf.moveDir = _0x28cc90;
                  _0x576a1c.sendWS("f", _0x2eebbf.moveDir);
                  _0x576a1c.sendWS("D", _0x2eebbf.nDir);
                  _0x576a1c.fastGear();
                }
              }
            }
            if (_0x45192e.length > 0) {
              if (getEl("mode").value == "flex") {
                const _0x56b3f6 = _0x2eebbf.sid * (Math.PI * 2 / _0x2eebbf.sid);
                const _0x625181 = Math.cos(Date.now() * 0.01) * 300 + _0x547655.x;
                const _0x19f468 = Math.sin(Date.now() * 0.01) * 300 + _0x547655.x;
                _0x576a1c.sendWS("f", Math.atan2(_0x19f468 - _0x2eebbf.y, _0x625181 - _0x2eebbf.x));
                const _0x37db30 = Math.hypot(_0x625181 - _0x2eebbf.x, _0x19f468 - _0x2eebbf.y);
                if (_0x37db30 > 22) {
                  return;
                }
              }
            }
            if (_0x45192e.length > 0) {
              _0x3974df = _0x45192e.filter(_0x297e2c => _0x297e2c.active && _0x297e2c.isItem && _0x1c7eec.getDist(_0x297e2c, _0x2eebbf, 0, 2) <= _0x146f01.weapons[_0x2eebbf.weaponIndex].range).sort(function (_0x5364cc, _0x2d6784) {
                return _0x1c7eec.getDist(_0x5364cc, _0x2eebbf, 0, 2) - _0x1c7eec.getDist(_0x2d6784, _0x2eebbf, 0, 2);
              })[0];
              if (_0x3974df) {
                if (_0x52986a == 0) {
                  _0x576a1c.sendWS("K", 1);
                  _0x52986a = 1;
                }
                if (_0x2eebbf.nDir != _0x1c7eec.getDirect(_0x3974df, _0x2eebbf, 0, 2)) {
                  _0x2eebbf.nDir = _0x1c7eec.getDirect(_0x3974df, _0x2eebbf, 0, 2);
                  _0x576a1c.sendWS("D", _0x2eebbf.nDir);
                }
                _0x576a1c.buye(40, 0);
                _0x576a1c.buye(11, 1);
              } else {
                _0x576a1c.fastGear();
                _0x576a1c.buye(11, 1);
              }
              _0x576a1c.buye(11, 1);
              if (_0x46c306.length > 0 && getEl("mode").value == "clear") {
                _0x576a1c.selectWeapon(_0x2eebbf.weapons[1]);
                let _0x4c11bf = _0x1c7eec.getDist(_0x46c306[0], _0x2eebbf, 0, 2);
                let _0x5b2234 = _0x1c7eec.getDirect(_0x46c306[0], _0x2eebbf, 0, 2);
                _0x3974df = _0x45192e.filter(_0x43bc27 => _0x43bc27.active && (_0x403e6a(_0x46c306, _0x43bc27.sid) ? true : !_0x43bc27.trap || _0x547655.sid != _0x43bc27.owner.sid && !_0x547655.findAllianceBySid(_0x43bc27.owner.sid)) && _0x43bc27.isItem && _0x1c7eec.getDist(_0x43bc27, _0x2eebbf, 0, 2) <= _0x146f01.weapons[_0x2eebbf.weaponIndex].range + _0x43bc27.scale).sort(function (_0x15b146, _0x4e605c) {
                  return _0x1c7eec.getDist(_0x15b146, _0x2eebbf, 0, 2) - _0x1c7eec.getDist(_0x4e605c, _0x2eebbf, 0, 2);
                })[0];
                if (_0x3974df) {
                  let _0x57b647 = _0x1c7eec.getDist(_0x46c306[0], _0x3974df, 0, 0);
                  if (_0x4c11bf - _0x57b647 > 0) {
                    if (_0x403e6a(_0x46c306, _0x3974df.sid) ? true : _0x3974df.dmg || _0x3974df.trap) {
                      if (_0x2eebbf.moveDir != undefined) {
                        _0x2eebbf.moveDir = undefined;
                        _0x576a1c.sendWS("f", _0x2eebbf.moveDir);
                        _0x576a1c.sendWS("D", _0x2eebbf.nDir);
                      }
                    } else {
                      _0x2eebbf.moveDir = _0x5b2234;
                      _0x576a1c.sendWS("f", _0x2eebbf.moveDir);
                      _0x576a1c.sendWS("D", _0x2eebbf.nDir);
                    }
                    if (_0x2eebbf.nDir != _0x1c7eec.getDirect(_0x3974df, _0x2eebbf, 0, 2)) {
                      _0x2eebbf.nDir = _0x1c7eec.getDirect(_0x3974df, _0x2eebbf, 0, 2);
                      _0x576a1c.sendWS("D", _0x2eebbf.nDir);
                    }
                    if (_0x52986a == 0) {
                      _0x576a1c.sendWS("K", 1);
                      _0x52986a = 1;
                    }
                    _0x576a1c.buye(40, 0);
                    _0x576a1c.fastGear();
                  } else {
                    _0x2eebbf.moveDir = _0x5b2234;
                    _0x576a1c.sendWS("f", _0x2eebbf.moveDir);
                    _0x576a1c.sendWS("D", _0x2eebbf.nDir);
                    _0x576a1c.fastGear();
                  }
                } else {
                  _0x2eebbf.moveDir = _0x5b2234;
                  _0x576a1c.sendWS("f", _0x2eebbf.moveDir);
                  _0x576a1c.sendWS("D", _0x2eebbf.nDir);
                  _0x576a1c.fastGear();
                }
                if (_0x4c11bf > 300) {
                  if (_0x1c7eec.getDist(_0x2300ca, _0x2eebbf, 0, 2) > 90) {
                    let _0x3ab08a = _0x1c7eec.getDirect(_0x2300ca, _0x2eebbf, 0, 2);
                    _0x576a1c.place(3, _0x3ab08a + 7.7);
                    _0x576a1c.place(3, _0x3ab08a - 7.7);
                    _0x576a1c.place(3, _0x3ab08a);
                    _0x2300ca = {
                      x: _0x2eebbf.x2,
                      y: _0x2eebbf.y2
                    };
                  }
                }
              }
            }
            if (_0x45192e.length > 0 && getEl("mode").value == "zync") {
              let _0x52bbd7 = _0x45192e.filter(_0x3e1b36 => _0x3e1b36.active && _0x3e1b36.isItem && _0x1c7eec.getDist(_0x3e1b36, _0x547655, 0, 2) <= _0x146f01.weapons[_0x2eebbf.weaponIndex].range + _0x3e1b36.scale);
              if (!_0x52bbd7.length) {
                if (_0x388fda == "no") {
                  _0x576a1c.sendWS("D", _0x1c7eec.getDirect(_0x547655, _0x2eebbf, 0, 2));
                }
                _0x576a1c.sendWS("f", _0xb7208a(_0x547655, _0x2eebbf) + Math.PI);
              }
              if (_0x52bbd7.length) {
                let _0x1b1476 = _0x1c7eec.getDist(_0x52bbd7[0], _0x2eebbf, 0, 2);
                let _0x45956f = _0x1c7eec.getDirect(_0x52bbd7[0], _0x2eebbf, 0, 2);
                _0x3974df = _0x45192e.filter(_0x45789c => _0x45789c.active && (_0x403e6a(_0x52bbd7, _0x45789c.sid) ? true : !_0x45789c.trap || _0x547655.sid != _0x45789c.owner.sid && !_0x547655.findAllianceBySid(_0x45789c.owner.sid)) && _0x45789c.isItem && _0x1c7eec.getDist(_0x45789c, _0x2eebbf, 0, 2) <= _0x146f01.weapons[_0x2eebbf.weaponIndex].range + _0x45789c.scale).sort(function (_0x264bcb, _0x2893b6) {
                  return _0x1c7eec.getDist(_0x264bcb, _0x2eebbf, 0, 2) - _0x1c7eec.getDist(_0x2893b6, _0x2eebbf, 0, 2);
                })[0];
                if (_0x3974df) {
                  let _0x402320 = _0x1c7eec.getDist(_0x52bbd7[0], _0x3974df, 0, 0);
                  if (_0x1b1476 - _0x402320 > 0) {
                    if (_0x403e6a(_0x52bbd7, _0x3974df.sid) ? true : _0x3974df.dmg || _0x3974df.trap) {
                      if (_0x2eebbf.moveDir != undefined) {
                        _0x2eebbf.moveDir = undefined;
                        _0x576a1c.sendWS("f", _0x2eebbf.moveDir);
                        _0x576a1c.sendWS("D", _0x2eebbf.nDir);
                      }
                    } else {
                      _0x576a1c.sendWS("D", _0x2eebbf.nDir);
                    }
                    if (_0x2eebbf.nDir != _0x1c7eec.getDirect(_0x3974df, _0x2eebbf, 0, 2)) {
                      _0x2eebbf.nDir = _0x1c7eec.getDirect(_0x3974df, _0x2eebbf, 0, 2);
                      _0x576a1c.sendWS("D", _0x2eebbf.nDir);
                    }
                    if (_0x52986a == 0) {
                      _0x576a1c.sendWS("K", 1);
                      _0x52986a = 1;
                    }
                    _0x576a1c.buye(40, 0);
                    _0x576a1c.fastGear();
                  } else {
                    if (_0x388fda == "no") {
                      _0x576a1c.sendWS("D", _0x1c7eec.getDirect(_0x3974df, _0x2eebbf, 0, 2));
                    }
                    if (_0x4292b0(_0x547655, _0x2eebbf) <= 110) {
                      _0x576a1c.sendWS("f", undefined);
                    } else {
                      _0x576a1c.sendWS("f", _0xb7208a(_0x547655, _0x2eebbf) + Math.PI);
                    }
                  }
                } else if (_0x52bbd7.length) {
                  if (_0x388fda == "no") {
                    _0x576a1c.sendWS("D", _0x1c7eec.getDirect(_0x52bbd7[0], _0x2eebbf, 0, 2));
                  }
                  if (_0x4292b0(_0x547655, _0x2eebbf) <= 110) {
                    _0x576a1c.sendWS("f", undefined);
                  } else {
                    _0x576a1c.sendWS("f", _0xb7208a(_0x547655, _0x2eebbf) + Math.PI);
                  }
                } else {
                  if (_0x388fda == "no") {
                    _0x576a1c.sendWS("D", _0x1c7eec.getDirect(_0x547655, _0x2eebbf, 0, 2));
                  }
                  if (_0x4292b0(_0x547655, _0x2eebbf) <= 110) {
                    _0x576a1c.sendWS("f", undefined);
                  } else {
                    _0x576a1c.sendWS("f", _0xb7208a(_0x547655, _0x2eebbf) + Math.PI);
                  }
                }
              }
            }
          }
        }
      }
      if (_0x19430b == "H") {
        let _0x53c5f7 = _0x58499a[0];
        for (let _0x29df96 = 0; _0x29df96 < _0x53c5f7.length;) {
          _0x783b14.add(_0x53c5f7[_0x29df96], _0x53c5f7[_0x29df96 + 1], _0x53c5f7[_0x29df96 + 2], _0x53c5f7[_0x29df96 + 3], _0x53c5f7[_0x29df96 + 4], _0x53c5f7[_0x29df96 + 5], _0x146f01.list[_0x53c5f7[_0x29df96 + 6]], true, _0x53c5f7[_0x29df96 + 7] >= 0 ? {
            sid: _0x53c5f7[_0x29df96 + 7]
          } : null);
          _0x29df96 += 8;
        }
      }
      if (_0x19430b == "N") {
        let _0x490981 = _0x58499a[0];
        let _0x39f17a = _0x58499a[1];
        if (_0x2eebbf) {
          _0x2eebbf[_0x490981] = _0x39f17a;
        }
      }
      if (_0x19430b == "O") {
        if (_0x58499a[0] == _0x2eebbf.sid) {
          _0x2eebbf.oldHealth = _0x2eebbf.health;
          _0x2eebbf.health = _0x58499a[1];
          _0x2eebbf.judgeShame();
          if (_0x2eebbf.oldHealth > _0x2eebbf.health) {
            if (_0x2eebbf.shameCount < 5) {
              for (let _0x2538bd = 0; _0x2538bd < 2; _0x2538bd++) {
                _0x576a1c.place(0, _0x2eebbf.nDir);
              }
            } else {
              setTimeout(() => {
                for (let _0x46da50 = 0; _0x46da50 < 2; _0x46da50++) {
                  _0x576a1c.place(0, _0x2eebbf.nDir);
                }
              }, 95);
            }
          }
        }
      }
      if (_0x19430b == "Q") {
        let _0x558c3f = _0x58499a[0];
        _0x783b14.disableBySid(_0x558c3f);
      }
      if (_0x19430b == "R") {
        let _0x3ac336 = _0x58499a[0];
        if (_0x2eebbf.alive) {
          _0x783b14.removeAllItems(_0x3ac336);
        }
      }
      if (_0x19430b == "S") {
        let _0x445c78 = _0x58499a[0];
        let _0x296dad = _0x58499a[1];
        if (_0x2eebbf) {
          _0x2eebbf.itemCounts[_0x445c78] = _0x296dad;
        }
      }
      if (_0x19430b == "U") {
        if (_0x58499a[0] > 0) {
          if (getEl("setup").value == "dm") {
            if (_0x2eebbf.upgraded == 0) {
              _0x576a1c.sendUpgrade(7);
            } else if (_0x2eebbf.upgraded == 1) {
              _0x576a1c.sendUpgrade(17);
            } else if (_0x2eebbf.upgraded == 2) {
              _0x576a1c.sendUpgrade(31);
            } else if (_0x2eebbf.upgraded == 3) {
              _0x576a1c.sendUpgrade(23);
            } else if (_0x2eebbf.upgraded == 4) {
              _0x576a1c.sendUpgrade(9);
            } else if (_0x2eebbf.upgraded == 5) {
              _0x576a1c.sendUpgrade(34);
            } else if (_0x2eebbf.upgraded == 6) {
              _0x576a1c.sendUpgrade(12);
            } else if (_0x2eebbf.upgraded == 7) {
              _0x576a1c.sendUpgrade(15);
            }
          } else if (getEl("setup").value == "dr") {
            if (_0x2eebbf.upgraded == 0) {
              _0x576a1c.sendUpgrade(7);
            } else if (_0x2eebbf.upgraded == 1) {
              _0x576a1c.sendUpgrade(17);
            } else if (_0x2eebbf.upgraded == 2) {
              _0x576a1c.sendUpgrade(31);
            } else if (_0x2eebbf.upgraded == 3) {
              _0x576a1c.sendUpgrade(23);
            } else if (_0x2eebbf.upgraded == 4) {
              _0x576a1c.sendUpgrade(9);
            } else if (_0x2eebbf.upgraded == 5) {
              _0x576a1c.sendUpgrade(34);
            } else if (_0x2eebbf.upgraded == 6) {
              _0x576a1c.sendUpgrade(12);
            } else if (_0x2eebbf.upgraded == 7) {
              _0x576a1c.sendUpgrade(13);
            }
          } else if (getEl("setup").value == "kh") {
            if (_0x2eebbf.upgraded == 0) {
              _0x576a1c.sendUpgrade(3);
            } else if (_0x2eebbf.upgraded == 1) {
              _0x576a1c.sendUpgrade(17);
            } else if (_0x2eebbf.upgraded == 2) {
              _0x576a1c.sendUpgrade(31);
            } else if (_0x2eebbf.upgraded == 3) {
              _0x576a1c.sendUpgrade(27);
            } else if (_0x2eebbf.upgraded == 4) {
              _0x576a1c.sendUpgrade(10);
            } else if (_0x2eebbf.upgraded == 5) {
              _0x576a1c.sendUpgrade(34);
            } else if (_0x2eebbf.upgraded == 6) {
              _0x576a1c.sendUpgrade(4);
            } else if (_0x2eebbf.upgraded == 7) {
              _0x576a1c.sendUpgrade(25);
            }
          } else if (getEl("setup").value == "zd") {
            if (_0x2eebbf.upgraded == 0) {
              _0x576a1c.sendUpgrade(3);
            } else if (_0x2eebbf.upgraded == 1) {
              _0x576a1c.sendUpgrade(17);
            } else if (_0x2eebbf.upgraded == 2) {
              _0x576a1c.sendUpgrade(31);
            } else if (_0x2eebbf.upgraded == 3) {
              _0x576a1c.sendUpgrade(27);
            } else if (_0x2eebbf.upgraded == 4) {
              _0x576a1c.sendUpgrade(9);
            } else if (_0x2eebbf.upgraded == 5) {
              _0x576a1c.sendUpgrade(34);
            } else if (_0x2eebbf.upgraded == 6) {
              _0x576a1c.sendUpgrade(12);
            } else if (_0x2eebbf.upgraded == 7) {
              _0x576a1c.sendUpgrade(15);
            }
          }
          _0x2eebbf.upgraded++;
        }
      }
      if (_0x19430b == "V") {
        let _0xd40280 = _0x58499a[0];
        let _0x587bd8 = _0x58499a[1];
        if (_0xd40280) {
          if (_0x587bd8) {
            _0x2eebbf.weapons = _0xd40280;
          } else {
            _0x2eebbf.items = _0xd40280;
          }
        }
      }
      if (_0x19430b == "5") {
        let _0x49d61d = _0x58499a[0];
        let _0x27bb38 = _0x58499a[1];
        let _0x4c3343 = _0x58499a[2];
        if (_0x4c3343) {
          if (!_0x49d61d) {
            _0x2eebbf.tails[_0x27bb38] = 1;
          } else {
            _0x2eebbf.latestTail = _0x27bb38;
          }
        } else if (!_0x49d61d) {
          _0x2eebbf.skins[_0x27bb38] = 1;
        } else {
          _0x2eebbf.latestSkin = _0x27bb38;
        }
      }
      if (_0x19430b == "6") {
        let _0x207310 = _0x58499a[0];
        let _0x50e1c8 = _0x58499a[1] + "";
        if (_0x207310 == _0x547655.sid && _0x50e1c8.includes("Sync")) {
          _0x576a1c.zync(_0x2eebbf.near);
        }
      }
    };
    _0x576a1c.onclose = function () {
      _0x2eebbf.inGame = false;
      _0x296df1.inGame = false;
    };
  }
  function _0x4addc9(_0x367330, _0x2cd841, _0x585b9a, _0x63793f, _0x340c3d) {
    let _0x4e8927 = _0x367330 + _0x585b9a * Math.cos(_0x63793f);
    let _0xeeac89 = _0x2cd841 + _0x585b9a * Math.sin(_0x63793f);
    let _0x11a660 = _0x585b9a * 0.4;
    _0x340c3d.moveTo(_0x367330, _0x2cd841);
    _0x340c3d.beginPath();
    _0x340c3d.quadraticCurveTo((_0x367330 + _0x4e8927) / 2 + _0x11a660 * Math.cos(_0x63793f + Math.PI / 2), (_0x2cd841 + _0xeeac89) / 2 + _0x11a660 * Math.sin(_0x63793f + Math.PI / 2), _0x4e8927, _0xeeac89);
    _0x340c3d.quadraticCurveTo((_0x367330 + _0x4e8927) / 2 - _0x11a660 * Math.cos(_0x63793f + Math.PI / 2), (_0x2cd841 + _0xeeac89) / 2 - _0x11a660 * Math.sin(_0x63793f + Math.PI / 2), _0x367330, _0x2cd841);
    _0x340c3d.closePath();
    _0x340c3d.fill();
    _0x340c3d.stroke();
  }
  function _0x2eb1e2(_0x77e3a0, _0x3534f2, _0x1cb8e2, _0x506fa0, _0x4ca01b, _0x36ab02) {
    _0x506fa0 = _0x506fa0 || _0x3b5929;
    _0x506fa0.beginPath();
    _0x506fa0.arc(_0x77e3a0, _0x3534f2, _0x1cb8e2, 0, Math.PI * 2);
    if (!_0x36ab02) {
      _0x506fa0.fill();
    }
    if (!_0x4ca01b) {
      _0x506fa0.stroke();
    }
  }
  function _0x4bf0fe(_0xc2d9f4, _0x1b005d, _0x6a0595, _0x597837, _0x539eb1, _0x3305f9) {
    _0x597837 = _0x597837 || _0x3b5929;
    _0x597837.beginPath();
    _0x597837.arc(_0xc2d9f4, _0x1b005d, _0x6a0595, 0, Math.PI * 2);
    if (!_0x3305f9) {
      _0x597837.fill();
    }
    if (!_0x539eb1) {
      _0x597837.stroke();
    }
  }
  function _0x372d18(_0x390e8b, _0x2b10cd, _0xe7ab65, _0x1aa1bc) {
    let _0x48d427 = Math.PI / 2 * 3;
    let _0x4d3b0f;
    let _0x557210;
    let _0x4dcce9 = Math.PI / _0x2b10cd;
    _0x390e8b.beginPath();
    _0x390e8b.moveTo(0, -_0xe7ab65);
    for (let _0x42e3e4 = 0; _0x42e3e4 < _0x2b10cd; _0x42e3e4++) {
      _0x4d3b0f = Math.cos(_0x48d427) * _0xe7ab65;
      _0x557210 = Math.sin(_0x48d427) * _0xe7ab65;
      _0x390e8b.lineTo(_0x4d3b0f, _0x557210);
      _0x48d427 += _0x4dcce9;
      _0x4d3b0f = Math.cos(_0x48d427) * _0x1aa1bc;
      _0x557210 = Math.sin(_0x48d427) * _0x1aa1bc;
      _0x390e8b.lineTo(_0x4d3b0f, _0x557210);
      _0x48d427 += _0x4dcce9;
    }
    _0x390e8b.lineTo(0, -_0xe7ab65);
    _0x390e8b.closePath();
  }
  function _0x306cca(_0x4fbdef, _0x500ee3, _0x467ca5, _0x5f413f) {
    let _0xc2ddd1 = Math.PI / 2 * 3;
    let _0x27808e;
    let _0x1391f5;
    let _0x3be784 = Math.PI / _0x500ee3;
    _0x4fbdef.beginPath();
    _0x4fbdef.moveTo(0, -_0x467ca5);
    for (let _0x110114 = 0; _0x110114 < _0x500ee3; _0x110114++) {
      _0x27808e = Math.cos(_0xc2ddd1) * _0x467ca5;
      _0x1391f5 = Math.sin(_0xc2ddd1) * _0x467ca5;
      _0x4fbdef.lineTo(_0x27808e, _0x1391f5);
      _0xc2ddd1 += _0x3be784;
      _0x27808e = Math.cos(_0xc2ddd1) * _0x5f413f;
      _0x1391f5 = Math.sin(_0xc2ddd1) * _0x5f413f;
      _0x4fbdef.lineTo(_0x27808e, _0x1391f5);
      _0xc2ddd1 += _0x3be784;
    }
    _0x4fbdef.lineTo(0, -_0x467ca5);
    _0x4fbdef.closePath();
  }
  function _0x174b77(_0x19f5ae, _0x518e65, _0x1deb19, _0x298227, _0x3eb424, _0x4b8e10, _0x170b6b) {
    if (!_0x170b6b) {
      _0x3eb424.fillRect(_0x19f5ae - _0x1deb19 / 2, _0x518e65 - _0x298227 / 2, _0x1deb19, _0x298227);
    }
    if (!_0x4b8e10) {
      _0x3eb424.strokeRect(_0x19f5ae - _0x1deb19 / 2, _0x518e65 - _0x298227 / 2, _0x1deb19, _0x298227);
    }
  }
  function _0x46f604(_0x1c077b, _0x5e3696, _0x55ed5f, _0x584ed9, _0xd9e684, _0x466f84, _0x5748a0) {
    if (!_0x5748a0) {
      _0xd9e684.fillRect(_0x1c077b - _0x55ed5f / 2, _0x5e3696 - _0x584ed9 / 2, _0x55ed5f, _0x584ed9);
    }
    if (!_0x466f84) {
      _0xd9e684.strokeRect(_0x1c077b - _0x55ed5f / 2, _0x5e3696 - _0x584ed9 / 2, _0x55ed5f, _0x584ed9);
    }
  }
  function _0x356869(_0x43cd4e, _0xcf822a, _0x3bf8c0, _0x28e05e, _0x419216, _0xc724a2, _0x20b66e, _0x3fa0bc) {
    _0xc724a2.save();
    _0xc724a2.translate(_0x43cd4e, _0xcf822a);
    _0x419216 = Math.ceil(_0x419216 / 2);
    for (let _0x1318ae = 0; _0x1318ae < _0x419216; _0x1318ae++) {
      _0x174b77(0, 0, _0x3bf8c0 * 2, _0x28e05e, _0xc724a2, _0x20b66e, _0x3fa0bc);
      _0xc724a2.rotate(Math.PI / _0x419216);
    }
    _0xc724a2.restore();
  }
  function _0x5b83f1(_0x14f813, _0x2920f1, _0x3fb6ab, _0x19784a) {
    let _0x372807 = Math.PI / 2 * 3;
    let _0x3d97c9;
    let _0x4be54a;
    let _0x5c9841 = Math.PI / _0x2920f1;
    let _0x347abf;
    _0x14f813.beginPath();
    _0x14f813.moveTo(0, -_0x19784a);
    for (let _0x7a9314 = 0; _0x7a9314 < _0x2920f1; _0x7a9314++) {
      _0x347abf = _0x1c7eec.randInt(_0x3fb6ab + 0.9, _0x3fb6ab * 1.2);
      _0x14f813.quadraticCurveTo(Math.cos(_0x372807 + _0x5c9841) * _0x347abf, Math.sin(_0x372807 + _0x5c9841) * _0x347abf, Math.cos(_0x372807 + _0x5c9841 * 2) * _0x19784a, Math.sin(_0x372807 + _0x5c9841 * 2) * _0x19784a);
      _0x372807 += _0x5c9841 * 2;
    }
    _0x14f813.lineTo(0, -_0x19784a);
    _0x14f813.closePath();
  }
  function _0x56fa98(_0x25d104, _0x4bfa0c) {
    _0x4bfa0c = _0x4bfa0c || _0x3b5929;
    let _0x4693f2 = _0x25d104 * (Math.sqrt(3) / 2);
    _0x4bfa0c.beginPath();
    _0x4bfa0c.moveTo(0, -_0x4693f2 / 2);
    _0x4bfa0c.lineTo(-_0x25d104 / 2, _0x4693f2 / 2);
    _0x4bfa0c.lineTo(_0x25d104 / 2, _0x4693f2 / 2);
    _0x4bfa0c.lineTo(0, -_0x4693f2 / 2);
    _0x4bfa0c.fill();
    _0x4bfa0c.closePath();
  }
  function _0x3dbb87() {}
  const _0x325a67 = 1;
  function _0x5cbdc2(_0x200c24, _0x3cf823) {
    _0x3b5929.fillStyle = "#91b2db";
    const _0x9455a2 = Date.now();
    _0x206e14.filter(_0x332584 => _0x332584.active).forEach(_0x39a136 => {
      if (!_0x39a136.startTime) {
        _0x39a136.startTime = _0x9455a2;
        _0x39a136.angle = 0;
        _0x39a136.radius = 0.1;
      }
      const _0x1c921b = _0x9455a2 - _0x39a136.startTime;
      const _0x22b242 = 1;
      _0x39a136.alpha = Math.max(0, _0x22b242 - _0x1c921b / 3000);
      _0x39a136.animate(_0x4819c7);
      _0x3b5929.globalAlpha = _0x39a136.alpha;
      _0x3b5929.strokeStyle = _0x2d70c1;
      _0x3b5929.save();
      _0x3b5929.translate(_0x39a136.x - _0x200c24, _0x39a136.y - _0x3cf823);
      _0x39a136.radius -= 0.001;
      _0x39a136.angle += 0.0174533;
      const _0x260cbe = 1;
      const _0x1d65d4 = _0x39a136.radius * Math.cos(_0x39a136.angle);
      const _0x117f2a = _0x39a136.radius * Math.sin(_0x39a136.angle);
      _0x39a136.x += _0x1d65d4 * _0x260cbe;
      _0x39a136.y += _0x117f2a * _0x260cbe;
      _0x3b5929.rotate(_0x39a136.angle);
      _0x324afc(_0x39a136, _0x3b5929);
      _0x3b5929.restore();
      _0x3b5929.fillStyle = "#91b2db";
      if (_0x1c921b >= 3000) {
        _0x39a136.active = false;
        _0x39a136.startTime = null;
      }
    });
  }
  function _0x2e89d8(_0x42707c, _0x526ef1, _0x142dba) {
    _0x3b5929.globalAlpha = 1;
    _0x3b5929.fillStyle = "#91b2db";
    for (var _0x351204 = 0; _0x351204 < _0x3c40e0.length; ++_0x351204) {
      _0x3a3fd7 = _0x3c40e0[_0x351204];
      if (_0x3a3fd7.zIndex == _0x142dba) {
        _0x3a3fd7.animate(_0x4819c7);
        if (_0x3a3fd7.visible) {
          _0x3a3fd7.skinRot += _0x4819c7 * 0.002;
          _0xc22f37 = !_0x4f1036.showDir && !_0x50abc3 && _0x3a3fd7 == _0x547655 ? _0x4f1036.attackDir ? _0x31c621() : _0x141e1c() : _0x3a3fd7.dir || 0;
          _0x3b5929.save();
          _0x3b5929.translate(_0x3a3fd7.x - _0x42707c, _0x3a3fd7.y - _0x526ef1);
          _0x3b5929.rotate(_0xc22f37 + _0x3a3fd7.dirPlus);
          _0xc6abf8(_0x3a3fd7, _0x3b5929);
          _0x3b5929.restore();
        }
      }
    }
  }
  function _0x324afc(_0x514c64, _0x51c9aa) {
    _0x51c9aa = _0x51c9aa || _0x3b5929;
    _0x51c9aa.lineWidth = _0x438f6d;
    _0x51c9aa.lineJoin = "miter";
    let _0xeace0 = Math.PI / 4 * (_0x146f01.weapons[_0x514c64.weaponIndex].armS || 1);
    let _0x4617ce = _0x514c64.buildIndex < 0 ? _0x146f01.weapons[_0x514c64.weaponIndex].hndS || 1 : 1;
    let _0x54bbd4 = _0x514c64.buildIndex < 0 ? _0x146f01.weapons[_0x514c64.weaponIndex].hndD || 1 : 1;
    _0x51c9aa.globalAlpha = 0;
    if (_0x514c64.buildIndex < 0 && !_0x146f01.weapons[_0x514c64.weaponIndex].aboveHand) {
      _0x3cf089(_0x146f01.weapons[_0x514c64.weaponIndex], _0x4ee004.weaponVariants[_0x514c64.weaponVariant].src, _0x514c64.scale, 0, _0x51c9aa);
      if (_0x146f01.weapons[_0x514c64.weaponIndex].projectile !== undefined && !_0x146f01.weapons[_0x514c64.weaponIndex].hideProjectile) {
        _0x4a32cb(_0x514c64.scale, 0, _0x146f01.projectiles[_0x146f01.weapons[_0x514c64.weaponIndex].projectile], _0x3b5929);
      }
    }
    _0x51c9aa.fillStyle = "rgba(0, 0, 0, 0)";
    _0x2eb1e2(_0x514c64.scale * Math.cos(_0xeace0), _0x514c64.scale * Math.sin(_0xeace0), 14, _0x51c9aa);
    _0x2eb1e2(_0x514c64.scale * _0x54bbd4 * Math.cos(-_0xeace0 * _0x4617ce), _0x514c64.scale * _0x54bbd4 * Math.sin(-_0xeace0 * _0x4617ce), 14, _0x51c9aa);
    if (_0x514c64.buildIndex < 0 && _0x146f01.weapons[_0x514c64.weaponIndex].aboveHand) {
      _0x3cf089(_0x146f01.weapons[_0x514c64.weaponIndex], _0x4ee004.weaponVariants[_0x514c64.weaponVariant || 0].src || "", _0x514c64.scale, 0, _0x51c9aa);
      if (_0x146f01.weapons[_0x514c64.weaponIndex].projectile !== undefined && !_0x146f01.weapons[_0x514c64.weaponIndex].hideProjectile) {
        _0x4a32cb(_0x514c64.scale, 0, _0x146f01.projectiles[_0x146f01.weapons[_0x514c64.weaponIndex].projectile], _0x3b5929);
      }
    }
    if (_0x514c64.buildIndex < 0 && _0x146f01.weapons[_0x514c64.weaponIndex].aboveHand) {
      _0x3cf089(_0x146f01.weapons[_0x514c64.weaponIndex], _0x4ee004.weaponVariants[_0x514c64.weaponVariant].src, _0x514c64.scale, 0, _0x51c9aa);
      if (_0x146f01.weapons[_0x514c64.weaponIndex].projectile !== undefined && !_0x146f01.weapons[_0x514c64.weaponIndex].hideProjectile) {
        _0x4a32cb(_0x514c64.scale, 0, _0x146f01.projectiles[_0x146f01.weapons[_0x514c64.weaponIndex].projectile], _0x3b5929);
      }
    }
    _0x51c9aa.fillStyle = "rgba(0, 0, 0, 0)";
    _0x2eb1e2(0, 0, _0x514c64.scale, _0x51c9aa);
    if (_0x514c64.skinIndex > 0) {
      _0x51c9aa.rotate(Math.PI / 2);
      _0x586ad0(_0x514c64.skinIndex, _0x51c9aa, null, _0x514c64);
    }
    _0x51c9aa.globalAlpha = 1;
  }
  function _0xc6abf8(_0x30688f, _0x3274ae) {
    _0x3274ae = _0x3274ae || _0x3b5929;
    _0x3274ae.lineWidth = _0x438f6d;
    _0x3274ae.lineJoin = "miter";
    let _0x365f9c = Math.PI / 4 * (_0x146f01.weapons[_0x30688f.weaponIndex].armS || 1);
    let _0xbd5a02 = _0x30688f.buildIndex < 0 ? _0x146f01.weapons[_0x30688f.weaponIndex].hndS || 1 : 1;
    let _0x57b57c = _0x30688f.buildIndex < 0 ? _0x146f01.weapons[_0x30688f.weaponIndex].hndD || 1 : 1;
    let _0x3afde8 = _0x30688f == _0x547655 && _0x30688f.weapons[0] == 3 && _0x30688f.weapons[1] == 15;
    if (_0x30688f.tailIndex > 0) {
      _0x20eba2(_0x30688f.tailIndex, _0x3274ae, _0x30688f);
    }
    if (_0x30688f.buildIndex < 0 && !_0x146f01.weapons[_0x30688f.weaponIndex].aboveHand) {
      _0x3cf089(_0x146f01.weapons[_0x3afde8 ? 4 : _0x30688f.weaponIndex], _0x4ee004.weaponVariants[_0x30688f.weaponVariant].src, _0x30688f.scale, 0, _0x3274ae);
      if (_0x146f01.weapons[_0x30688f.weaponIndex].projectile != undefined && !_0x146f01.weapons[_0x30688f.weaponIndex].hideProjectile) {
        _0x4a32cb(_0x30688f.scale, 0, _0x146f01.projectiles[_0x146f01.weapons[_0x30688f.weaponIndex].projectile], _0x3b5929);
      }
    }
    _0x3274ae.fillStyle = _0x4ee004.skinColors[_0x30688f.skinColor];
    _0x2eb1e2(_0x30688f.scale * Math.cos(_0x365f9c), _0x30688f.scale * Math.sin(_0x365f9c), 14);
    _0x2eb1e2(_0x30688f.scale * _0x57b57c * Math.cos(-_0x365f9c * _0xbd5a02), _0x30688f.scale * _0x57b57c * Math.sin(-_0x365f9c * _0xbd5a02), 14);
    if (_0x30688f.buildIndex < 0 && _0x146f01.weapons[_0x30688f.weaponIndex].aboveHand) {
      _0x3cf089(_0x146f01.weapons[_0x30688f.weaponIndex], _0x4ee004.weaponVariants[_0x30688f.weaponVariant].src, _0x30688f.scale, 0, _0x3274ae);
      if (_0x146f01.weapons[_0x30688f.weaponIndex].projectile != undefined && !_0x146f01.weapons[_0x30688f.weaponIndex].hideProjectile) {
        _0x4a32cb(_0x30688f.scale, 0, _0x146f01.projectiles[_0x146f01.weapons[_0x30688f.weaponIndex].projectile], _0x3b5929);
      }
    }
    if (_0x30688f.buildIndex >= 0) {
      var _0x382230 = _0x5e1edc(_0x146f01.list[_0x30688f.buildIndex]);
      _0x3274ae.drawImage(_0x382230, _0x30688f.scale - _0x146f01.list[_0x30688f.buildIndex].holdOffset, -_0x382230.width / 2);
    }
    _0x2eb1e2(0, 0, _0x30688f.scale, _0x3274ae);
    if (_0x30688f.skinIndex > 0) {
      _0x3274ae.rotate(Math.PI / 2);
      _0x586ad0(_0x30688f.skinIndex, _0x3274ae, null, _0x30688f);
    }
  }
  var _0x2c79db = {};
  var _0x2ca50e = {};
  function _0x3aff28(_0x38bee7, _0x4e7889, _0x3dbef1, _0x575e80) {
    _0x3d157b = _0x2c79db[_0x38bee7];
    if (!_0x3d157b) {
      var _0x472b3d = new Image();
      _0x472b3d.onload = function () {
        this.isLoaded = true;
        this.onload = null;
      };
      _0x472b3d.src = "https://moomoo.io/img/hats/hat_" + _0x38bee7 + ".png";
      _0x2c79db[_0x38bee7] = _0x472b3d;
      _0x3d157b = _0x472b3d;
    }
    var _0x29899c = _0x3dbef1 || _0x2ca50e[_0x38bee7];
    if (!_0x29899c) {
      for (var _0x16d769 = 0; _0x16d769 < _0x2037c7.length; ++_0x16d769) {
        if (_0x2037c7[_0x16d769].id == _0x38bee7) {
          _0x29899c = _0x2037c7[_0x16d769];
          break;
        }
      }
      _0x2ca50e[_0x38bee7] = _0x29899c;
    }
    if (_0x3d157b.isLoaded) {
      _0x4e7889.drawImage(_0x3d157b, -_0x29899c.scale / 2, -_0x29899c.scale / 2, _0x29899c.scale, _0x29899c.scale);
    }
    if (!_0x3dbef1 && _0x29899c.topSprite) {
      _0x4e7889.save();
      _0x4e7889.rotate(_0x575e80.skinRot);
      _0x3aff28(_0x38bee7 + "_top", _0x4e7889, _0x29899c, _0x575e80);
      _0x4e7889.restore();
    }
  }
  function _0x586ad0(_0x47c314, _0x4d05cb, _0x161aaa, _0x3ba3dd) {
    if (!(_0x3d157b = _0x221c74[_0x47c314 + (_0x38f548 ? "lol" : 0)])) {
      var _0x28bf98 = new Image();
      _0x28bf98.onload = function () {
        this.isLoaded = true;
        this.onload = null;
      };
      _0x28bf98.src = _0x3b5aca(_0x47c314, "hat", _0x47c314);
      _0x221c74[_0x47c314 + (_0x38f548 ? "lol" : 0)] = _0x28bf98;
      _0x3d157b = _0x28bf98;
    }
    var _0x3e0181 = _0x161aaa || _0x4562f1[_0x47c314];
    if (!_0x3e0181) {
      for (var _0x1dace = 0; _0x1dace < _0x2037c7.length; ++_0x1dace) {
        if (_0x2037c7[_0x1dace].id == _0x47c314) {
          _0x3e0181 = _0x2037c7[_0x1dace];
          break;
        }
      }
      _0x4562f1[_0x47c314] = _0x3e0181;
    }
    if (_0x3d157b.isLoaded) {
      _0x4d05cb.drawImage(_0x3d157b, -_0x3e0181.scale / 2, -_0x3e0181.scale / 2, _0x3e0181.scale, _0x3e0181.scale);
    }
    if (!_0x161aaa && _0x3e0181.topSprite) {
      _0x4d05cb.save();
      _0x4d05cb.rotate(_0x3ba3dd.skinRot);
      _0x3d936d(_0x47c314 + "_top", _0x4d05cb, _0x3e0181, _0x3ba3dd);
      _0x4d05cb.restore();
    }
  }
  var _0x975d5 = {
    7: "https://i.imgur.com/vAOzlyY.png",
    15: "https://i.imgur.com/YRQ8Ybq.png",
    40: "https://i.imgur.com/Xzmg27N.png",
    26: "https://i.imgur.com/I0xGtyZ.png",
    55: "https://i.imgur.com/uYgDtcZ.png",
    20: "https://i.imgur.com/f5uhWCk.png"
  };
  function _0x3b5aca(_0x4a7e63, _0x1af0b5, _0x4616f0) {
    if (true) {
      if (_0x975d5[_0x4a7e63] && _0x1af0b5 == "hat") {
        return _0x975d5[_0x4a7e63];
      } else if (_0x1af0b5 == "acc") {
        return ".././img/accessories/access_" + _0x4a7e63 + ".png";
      } else if (_0x1af0b5 == "hat") {
        return ".././img/hats/hat_" + _0x4a7e63 + ".png";
      } else {
        return ".././img/weapons/" + _0x4a7e63 + ".png";
      }
    } else if (_0x1af0b5 == "acc") {
      return ".././img/accessories/access_" + _0x4a7e63 + ".png";
    } else if (_0x1af0b5 == "hat") {
      return ".././img/hats/hat_" + _0x4a7e63 + ".png";
    } else {
      return ".././img/weapons/" + _0x4a7e63 + ".png";
    }
  }
  let _0x221c74 = {};
  let _0x4562f1 = {};
  let _0x3d157b;
  function _0x3d936d(_0x2c9bdb, _0x211744, _0xa047d9, _0x11c653) {
    _0x3d157b = _0x221c74[_0x2c9bdb];
    if (!_0x3d157b) {
      let _0x249ac2 = new Image();
      _0x249ac2.onload = function () {
        this.isLoaded = true;
        this.onload = null;
      };
      _0x249ac2.src = "https://moomoo.io/img/hats/hat_" + _0x2c9bdb + ".png";
      _0x221c74[_0x2c9bdb] = _0x249ac2;
      _0x3d157b = _0x249ac2;
    }
    let _0x310e36 = _0xa047d9 || _0x4562f1[_0x2c9bdb];
    if (!_0x310e36) {
      for (let _0x3b653c = 0; _0x3b653c < _0x2037c7.length; ++_0x3b653c) {
        if (_0x2037c7[_0x3b653c].id == _0x2c9bdb) {
          _0x310e36 = _0x2037c7[_0x3b653c];
          break;
        }
      }
      _0x4562f1[_0x2c9bdb] = _0x310e36;
    }
    if (_0x3d157b.isLoaded) {
      _0x211744.drawImage(_0x3d157b, -_0x310e36.scale / 2, -_0x310e36.scale / 2, _0x310e36.scale, _0x310e36.scale);
    }
    if (!_0xa047d9 && _0x310e36.topSprite) {
      _0x211744.save();
      _0x211744.rotate(_0x11c653.skinRot);
      _0x3d936d(_0x2c9bdb + "_top", _0x211744, _0x310e36, _0x11c653);
      _0x211744.restore();
    }
  }
  var _0x18d6c8 = {
    21: "https://i.imgur.com/4ddZert.png",
    19: "https://i.imgur.com/sULkUZT.png"
  };
  function _0x304f7e(_0x57c5e2, _0x5946a4, _0x2eec81) {
    if (true) {
      if (_0x18d6c8[_0x57c5e2] && _0x5946a4 == "acc") {
        return _0x18d6c8[_0x57c5e2];
      } else if (_0x5946a4 == "acc") {
        return ".././img/accessories/access_" + _0x57c5e2 + ".png";
      } else if (_0x5946a4 == "hat") {
        return ".././img/hats/hat_" + _0x57c5e2 + ".png";
      } else {
        return ".././img/weapons/" + _0x57c5e2 + ".png";
      }
    } else if (_0x5946a4 == "acc") {
      return ".././img/accessories/access_" + _0x57c5e2 + ".png";
    } else if (_0x5946a4 == "hat") {
      return ".././img/hats/hat_" + _0x57c5e2 + ".png";
    } else {
      return ".././img/weapons/" + _0x57c5e2 + ".png";
    }
  }
  function _0x20eba2(_0x5303cf, _0x216c21, _0x55b2f0) {
    if (!(_0x3d157b = _0x3ac04a[_0x5303cf + (_0x38f548 ? "lol" : 0)])) {
      var _0x5a4ee7 = new Image();
      _0x5a4ee7.onload = function () {
        this.isLoaded = true;
        this.onload = null;
      };
      _0x5a4ee7.src = _0x304f7e(_0x5303cf, "acc");
      _0x3ac04a[_0x5303cf + (_0x38f548 ? "lol" : 0)] = _0x5a4ee7;
      _0x3d157b = _0x5a4ee7;
    }
    var _0x14d89a = _0x53a288[_0x5303cf];
    if (!_0x14d89a) {
      for (var _0x422557 = 0; _0x422557 < _0x3cc681.length; ++_0x422557) {
        if (_0x3cc681[_0x422557].id == _0x5303cf) {
          _0x14d89a = _0x3cc681[_0x422557];
          break;
        }
      }
      _0x53a288[_0x5303cf] = _0x14d89a;
    }
    if (_0x3d157b.isLoaded) {
      _0x216c21.save();
      _0x216c21.translate(-20 - (_0x14d89a.xOff || 0), 0);
      if (_0x14d89a.spin) {
        _0x216c21.rotate(_0x55b2f0.skinRot);
      }
      _0x216c21.drawImage(_0x3d157b, -(_0x14d89a.scale / 2), -(_0x14d89a.scale / 2), _0x14d89a.scale, _0x14d89a.scale);
      _0x216c21.restore();
    }
  }
  let _0x3ac04a = {};
  let _0x53a288 = {};
  var _0x38f548 = true;
  function _0x583504(_0xeefa15, _0x264413, _0x2bd447) {
    _0x3d157b = _0x3ac04a[_0xeefa15];
    if (!_0x3d157b) {
      let _0x2d4cbc = new Image();
      _0x2d4cbc.onload = function () {
        this.isLoaded = true;
        this.onload = null;
      };
      _0x2d4cbc.src = "https://moomoo.io/img/accessories/access_" + _0xeefa15 + ".png";
      _0x3ac04a[_0xeefa15] = _0x2d4cbc;
      _0x3d157b = _0x2d4cbc;
    }
    let _0x569ed6 = _0x53a288[_0xeefa15];
    if (!_0x569ed6) {
      for (let _0x64be51 = 0; _0x64be51 < _0x3cc681.length; ++_0x64be51) {
        if (_0x3cc681[_0x64be51].id == _0xeefa15) {
          _0x569ed6 = _0x3cc681[_0x64be51];
          break;
        }
      }
      _0x53a288[_0xeefa15] = _0x569ed6;
    }
    if (_0x3d157b.isLoaded) {
      _0x264413.save();
      _0x264413.translate(-20 - (_0x569ed6.xOff || 0), 0);
      if (_0x569ed6.spin) {
        _0x264413.rotate(_0x2bd447.skinRot);
      }
      _0x264413.drawImage(_0x3d157b, -(_0x569ed6.scale / 2), -(_0x569ed6.scale / 2), _0x569ed6.scale, _0x569ed6.scale);
      _0x264413.restore();
    }
  }
  var _0x1efddb = {};
  var _0x535235 = {};
  function _0x316cbe(_0x3e4814, _0x163e5e, _0x3ef82b) {
    _0x3d157b = _0x1efddb[_0x3e4814];
    if (!_0x3d157b) {
      var _0x481038 = new Image();
      _0x481038.onload = function () {
        this.isLoaded = true;
        this.onload = null;
      };
      _0x481038.src = "https://moomoo.io/img/accessories/access_" + _0x3e4814 + ".png";
      _0x1efddb[_0x3e4814] = _0x481038;
      _0x3d157b = _0x481038;
    }
    var _0x435401 = _0x535235[_0x3e4814];
    if (!_0x435401) {
      for (var _0x11344a = 0; _0x11344a < _0x3cc681.length; ++_0x11344a) {
        if (_0x3cc681[_0x11344a].id == _0x3e4814) {
          _0x435401 = _0x3cc681[_0x11344a];
          break;
        }
      }
      _0x535235[_0x3e4814] = _0x435401;
    }
    if (_0x3d157b.isLoaded) {
      _0x163e5e.save();
      _0x163e5e.translate(-20 - (_0x435401.xOff || 0), 0);
      if (_0x435401.spin) {
        _0x163e5e.rotate(_0x3ef82b.skinRot);
      }
      _0x163e5e.drawImage(_0x3d157b, -(_0x435401.scale / 2), -(_0x435401.scale / 2), _0x435401.scale, _0x435401.scale);
      _0x163e5e.restore();
    }
  }
  let _0x472414 = {};
  function _0x3cf089(_0x4d510f, _0x2954dc, _0x13bf58, _0x43ea61, _0x32974c) {
    let _0x3ef89f = _0x4d510f.src + (_0x2954dc || "");
    let _0x1fd529 = _0x472414[_0x3ef89f];
    if (!_0x1fd529) {
      _0x1fd529 = new Image();
      _0x1fd529.onload = function () {
        this.isLoaded = true;
      };
      _0x1fd529.src = "https://moomoo.io/img/weapons/" + _0x3ef89f + ".png";
      _0x472414[_0x3ef89f] = _0x1fd529;
    }
    if (_0x1fd529.isLoaded) {
      _0x32974c.drawImage(_0x1fd529, _0x13bf58 + _0x4d510f.xOff - _0x4d510f.length / 2, _0x43ea61 + _0x4d510f.yOff - _0x4d510f.width / 2, _0x4d510f.length, _0x4d510f.width);
    }
  }
  function _0x4cc9d6(_0x5133cf, _0x3a512a, _0xcb08e8) {
    for (let _0x508b19 = 0; _0x508b19 < _0x65aa4d.length; _0x508b19++) {
      _0x3a3fd7 = _0x65aa4d[_0x508b19];
      if (_0x3a3fd7.active && _0x3a3fd7.layer == _0x5133cf && _0x3a3fd7.inWindow) {
        _0x3a3fd7.update(_0x4819c7);
        if (_0x3a3fd7.active && _0xbeb465(_0x3a3fd7.x - _0x3a512a, _0x3a3fd7.y - _0xcb08e8, _0x3a3fd7.scale)) {
          _0x3b5929.save();
          _0x3b5929.translate(_0x3a3fd7.x - _0x3a512a, _0x3a3fd7.y - _0xcb08e8);
          _0x3b5929.rotate(_0x3a3fd7.dir);
          _0x4a32cb(0, 0, _0x3a3fd7, _0x3b5929, 1);
          _0x3b5929.restore();
        }
      }
    }
    ;
  }
  let _0xef9c85 = {};
  function _0x4a32cb(_0x2797a8, _0x1dd4b8, _0x462cba, _0x50b06d, _0x4e316d) {
    if (_0x462cba.src) {
      let _0x1bbb83 = _0x146f01.projectiles[_0x462cba.indx].src;
      let _0x3c0f63 = _0xef9c85[_0x1bbb83];
      if (!_0x3c0f63) {
        _0x3c0f63 = new Image();
        _0x3c0f63.onload = function () {
          this.isLoaded = true;
        };
        _0x3c0f63.src = "https://moomoo.io/img/weapons/" + _0x1bbb83 + ".png";
        _0xef9c85[_0x1bbb83] = _0x3c0f63;
      }
      if (_0x3c0f63.isLoaded) {
        _0x50b06d.drawImage(_0x3c0f63, _0x2797a8 - _0x462cba.scale / 2, _0x1dd4b8 - _0x462cba.scale / 2, _0x462cba.scale, _0x462cba.scale);
      }
    } else if (_0x462cba.indx == 1) {
      _0x50b06d.fillStyle = "#939393";
      _0x2eb1e2(_0x2797a8, _0x1dd4b8, _0x462cba.scale, _0x50b06d);
    }
  }
  let _0x4a8f42 = {};
  function _0x47f114(_0x129f55, _0x4ffc7b) {
    let _0x40b14e = _0x129f55.index;
    let _0x2ff7bf = _0x4a8f42[_0x40b14e];
    if (!_0x2ff7bf) {
      let _0x527b15 = new Image();
      _0x527b15.onload = function () {
        this.isLoaded = true;
        this.onload = null;
      };
      _0x527b15.src = "https://moomoo.io/img/animals/" + _0x129f55.src + ".png";
      _0x2ff7bf = _0x527b15;
      _0x4a8f42[_0x40b14e] = _0x2ff7bf;
    }
    if (_0x2ff7bf.isLoaded) {
      let _0x3008d4 = _0x129f55.scale * 1.2 * (_0x129f55.spriteMlt || 1);
      _0x4ffc7b.drawImage(_0x2ff7bf, -_0x3008d4, -_0x3008d4, _0x3008d4 * 2, _0x3008d4 * 2);
    }
  }
  function _0x47e67f(_0x1e07c8, _0x3b0068, _0x238d15, _0x187f42) {
    let _0x2fc37f = _0x4ee004.riverWidth + _0x187f42;
    let _0x2b4240 = _0x4ee004.mapScale / 2 - _0x3b0068 - _0x2fc37f / 2;
    if (_0x2b4240 < _0x47e786 && _0x2b4240 + _0x2fc37f > 0) {
      _0x238d15.fillRect(0, _0x2b4240, _0x3d89ad, _0x2fc37f);
    }
  }
  let _0x286718 = {};
  function _0x103cdd(_0x18ecc4) {
    let _0x48c3eb = _0x18ecc4.y >= _0x4ee004.mapScale - _0x4ee004.snowBiomeTop ? 2 : _0x18ecc4.y <= _0x4ee004.snowBiomeTop ? 1 : 0;
    let _0x76ccf5 = _0x18ecc4.type + "_" + _0x18ecc4.scale + "_" + _0x48c3eb;
    let _0xfe9a45 = _0x286718[_0x76ccf5];
    if (!_0xfe9a45) {
      let _0x140c62 = 6;
      let _0x19d03b = document.createElement("canvas");
      _0x19d03b.width = _0x19d03b.height = _0x18ecc4.scale * 2.1 + _0x438f6d;
      let _0xe6c611 = _0x19d03b.getContext("2d");
      _0xe6c611.translate(_0x19d03b.width / 2, _0x19d03b.height / 2);
      _0xe6c611.rotate(_0x1c7eec.randFloat(0, Math.PI));
      _0xe6c611.strokeStyle = _0x2d70c1;
      _0xe6c611.lineWidth = _0x438f6d;
      if (_0x18ecc4.type == 0) {
        let _0xc56d36;
        let _0x1efa17 = 8;
        _0xe6c611.globalAlpha = _0xd428f7(_0x18ecc4, _0x547655) <= 250 ? 0.6 : 1;
        for (let _0x1c27b8 = 0; _0x1c27b8 < 2; ++_0x1c27b8) {
          _0xc56d36 = _0x3a3fd7.scale * (!_0x1c27b8 ? 1 : 0.5);
          _0x372d18(_0xe6c611, _0x1efa17, _0xc56d36, _0xc56d36 * 0.7);
          _0xe6c611.fillStyle = !_0x48c3eb ? !_0x1c27b8 ? "#9ebf57" : "#b4db62" : !_0x1c27b8 ? "#e3f1f4" : "#fff";
          _0xe6c611.fill();
          if (!_0x1c27b8) {
            _0xe6c611.stroke();
            _0xe6c611.shadowBlur = null;
            _0xe6c611.shadowColor = null;
            _0xe6c611.globalAlpha = 1;
          }
        }
      } else if (_0x18ecc4.type == 1) {
        if (_0x48c3eb == 2) {
          _0xe6c611.fillStyle = "#606060";
          _0x372d18(_0xe6c611, 6, _0x18ecc4.scale * 0.3, _0x18ecc4.scale * 0.71);
          _0xe6c611.fill();
          _0xe6c611.stroke();
          _0xe6c611.fillStyle = "#89a54c";
          _0x2eb1e2(0, 0, _0x18ecc4.scale * 0.55, _0xe6c611);
          _0xe6c611.fillStyle = "#a5c65b";
          _0x2eb1e2(0, 0, _0x18ecc4.scale * 0.3, _0xe6c611, true);
        } else {
          _0x5b83f1(_0xe6c611, 6, _0x3a3fd7.scale, _0x3a3fd7.scale * 0.7);
          _0xe6c611.fillStyle = _0x48c3eb ? "#e3f1f4" : "#89a54c";
          _0xe6c611.fill();
          _0xe6c611.stroke();
          _0xe6c611.fillStyle = _0x48c3eb ? "#6a64af" : "#c15555";
          let _0x3b24f7;
          let _0x1453f6 = 4;
          let _0x571449 = Math.PI * 2 / _0x1453f6;
          for (let _0x122d8d = 0; _0x122d8d < _0x1453f6; ++_0x122d8d) {
            _0x3b24f7 = _0x1c7eec.randInt(_0x3a3fd7.scale / 3.5, _0x3a3fd7.scale / 2.3);
            _0x2eb1e2(_0x3b24f7 * Math.cos(_0x571449 * _0x122d8d), _0x3b24f7 * Math.sin(_0x571449 * _0x122d8d), _0x1c7eec.randInt(10, 12), _0xe6c611);
          }
        }
      } else if (_0x18ecc4.type == 2 || _0x18ecc4.type == 3) {
        _0xe6c611.fillStyle = _0x18ecc4.type == 2 ? _0x48c3eb == 2 ? "#938d77" : "#939393" : "#e0c655";
        _0x372d18(_0xe6c611, 3, _0x18ecc4.scale, _0x18ecc4.scale);
        _0xe6c611.fill();
        _0xe6c611.stroke();
        _0xe6c611.shadowBlur = null;
        _0xe6c611.shadowColor = null;
        _0xe6c611.fillStyle = _0x18ecc4.type == 2 ? _0x48c3eb == 2 ? "#b2ab90" : "#bcbcbc" : "#ebdca3";
        _0x372d18(_0xe6c611, 3, _0x18ecc4.scale * 0.55, _0x18ecc4.scale * 0.65);
        _0xe6c611.fill();
      }
      _0xfe9a45 = _0x19d03b;
      _0x286718[_0x76ccf5] = _0xfe9a45;
    }
    return _0xfe9a45;
  }
  let _0x31e236 = [];
  function _0x5e1edc(_0x3eff52, _0x464e41) {
    let _0x1202ae = _0x31e236[_0x3eff52.id];
    if (!_0x1202ae || _0x464e41) {
      let _0x13513e = !_0x464e41 ? 20 : 5;
      let _0x1818e5 = document.createElement("canvas");
      let _0x11ab79 = !_0x464e41 && _0x3eff52.name == "windmill" ? _0x146f01.list[4].scale : _0x3eff52.scale;
      _0x1818e5.width = _0x1818e5.height = _0x11ab79 * 2.5 + _0x438f6d + (_0x146f01.list[_0x3eff52.id].spritePadding || 0) + _0x13513e;
      let _0x462817 = _0x1818e5.getContext("2d");
      _0x462817.translate(_0x1818e5.width / 2, _0x1818e5.height / 2);
      _0x462817.rotate(_0x464e41 ? 0 : Math.PI / 2);
      _0x462817.strokeStyle = _0x2d70c1;
      _0x462817.lineWidth = _0x438f6d * (_0x464e41 ? _0x1818e5.width / 81 : 1);
      if (!_0x464e41) {
        _0x462817.shadowBlur = 8;
        _0x462817.shadowColor = "rgba(0, 0, 0, 0.2)";
      }
      if (_0x3eff52.name == "apple") {
        _0x462817.fillStyle = "#c15555";
        _0x2eb1e2(0, 0, _0x3eff52.scale, _0x462817);
        _0x462817.fillStyle = "#89a54c";
        let _0x23260d = -(Math.PI / 2);
        _0x4addc9(_0x3eff52.scale * Math.cos(_0x23260d), _0x3eff52.scale * Math.sin(_0x23260d), 25, _0x23260d + Math.PI / 2, _0x462817);
      } else if (_0x3eff52.name == "cookie") {
        _0x462817.fillStyle = "#cca861";
        _0x2eb1e2(0, 0, _0x3eff52.scale, _0x462817);
        _0x462817.fillStyle = "#937c4b";
        let _0x30ffaa = 4;
        let _0x1ee103 = Math.PI * 2 / _0x30ffaa;
        let _0xc90652;
        for (let _0x3971b0 = 0; _0x3971b0 < _0x30ffaa; ++_0x3971b0) {
          _0xc90652 = _0x1c7eec.randInt(_0x3eff52.scale / 2.5, _0x3eff52.scale / 1.7);
          _0x2eb1e2(_0xc90652 * Math.cos(_0x1ee103 * _0x3971b0), _0xc90652 * Math.sin(_0x1ee103 * _0x3971b0), _0x1c7eec.randInt(4, 5), _0x462817, true);
        }
      } else if (_0x3eff52.name == "cheese") {
        _0x462817.fillStyle = "#f4f3ac";
        _0x2eb1e2(0, 0, _0x3eff52.scale, _0x462817);
        _0x462817.fillStyle = "#c3c28b";
        let _0x5de638 = 4;
        let _0x3790f1 = Math.PI * 2 / _0x5de638;
        let _0xca2846;
        for (let _0x2b339b = 0; _0x2b339b < _0x5de638; ++_0x2b339b) {
          _0xca2846 = _0x1c7eec.randInt(_0x3eff52.scale / 2.5, _0x3eff52.scale / 1.7);
          _0x2eb1e2(_0xca2846 * Math.cos(_0x3790f1 * _0x2b339b), _0xca2846 * Math.sin(_0x3790f1 * _0x2b339b), _0x1c7eec.randInt(4, 5), _0x462817, true);
        }
      } else if (_0x3eff52.name == "wood wall" || _0x3eff52.name == "stone wall" || _0x3eff52.name == "castle wall") {
        _0x462817.fillStyle = _0x3eff52.name == "castle wall" ? "#83898e" : _0x3eff52.name == "wood wall" ? "#a5974c" : "#939393";
        let _0x1a8eb9 = _0x3eff52.name == "castle wall" ? 4 : 3;
        _0x372d18(_0x462817, _0x1a8eb9, _0x3eff52.scale * 1.1, _0x3eff52.scale * 1.1);
        _0x462817.fill();
        _0x462817.stroke();
        _0x462817.fillStyle = _0x3eff52.name == "castle wall" ? "#9da4aa" : _0x3eff52.name == "wood wall" ? "#c9b758" : "#bcbcbc";
        _0x372d18(_0x462817, _0x1a8eb9, _0x3eff52.scale * 0.65, _0x3eff52.scale * 0.65);
        _0x462817.fill();
      } else if (_0x3eff52.name == "spikes" || _0x3eff52.name == "greater spikes" || _0x3eff52.name == "poison spikes" || _0x3eff52.name == "spinning spikes") {
        let _0x2728c6 = "#4caf50";
        let _0x577fe1 = "rgba(0, 100, 0, 0.8)";
        let _0x599f3a = "#004d00";
        let _0x154eef = _0x3eff52.scale * 0.6;
        _0x462817.fillStyle = _0x2728c6;
        _0x372d18(_0x462817, _0x3eff52.name == "spikes" ? 5 : 6, _0x3eff52.scale, _0x154eef);
        _0x462817.fill();
        _0x462817.strokeStyle = _0x599f3a;
        _0x462817.lineWidth = 3;
        _0x462817.stroke();
        _0x462817.shadowBlur = 10;
        _0x462817.shadowColor = "rgba(0, 100, 0, 0.5)";
        _0x462817.fill();
        _0x462817.stroke();
        _0x462817.shadowBlur = 0;
        _0x462817.fillStyle = _0x2728c6;
        _0x2eb1e2(0, 0, _0x154eef, _0x462817);
        _0x462817.fill();
        _0x462817.fillStyle = _0x577fe1;
        _0x2eb1e2(0, 0, _0x154eef / 2, _0x462817, true);
        _0x462817.shadowBlur = 5;
        _0x462817.shadowColor = "rgba(0, 100, 0, 0.3)";
        _0x462817.fill();
        _0x462817.stroke();
        _0x462817.shadowBlur = 0;
        _0x462817.lineWidth = 1;
      } else if (_0x3eff52.name == "windmill" || _0x3eff52.name == "faster windmill" || _0x3eff52.name == "power mill") {
        _0x462817.fillStyle = "#a5974c";
        _0x2eb1e2(0, 0, _0x11ab79, _0x462817);
        _0x462817.fillStyle = "#c9b758";
        _0x356869(0, 0, _0x11ab79 * 1.5, 29, 4, _0x462817);
        _0x462817.fillStyle = "#a5974c";
        _0x2eb1e2(0, 0, _0x11ab79 * 0.5, _0x462817);
      } else if (_0x3eff52.name == "mine") {
        _0x462817.fillStyle = "#939393";
        _0x372d18(_0x462817, 3, _0x3eff52.scale, _0x3eff52.scale);
        _0x462817.fill();
        _0x462817.stroke();
        _0x462817.fillStyle = "#bcbcbc";
        _0x372d18(_0x462817, 3, _0x3eff52.scale * 0.55, _0x3eff52.scale * 0.65);
        _0x462817.fill();
      } else if (_0x3eff52.name == "sapling") {
        for (let _0x280cd3 = 0; _0x280cd3 < 2; ++_0x280cd3) {
          let _0x2604a4 = _0x3eff52.scale * (!_0x280cd3 ? 1 : 0.5);
          _0x372d18(_0x462817, 7, _0x2604a4, _0x2604a4 * 0.7);
          _0x462817.fillStyle = !_0x280cd3 ? "#9ebf57" : "#b4db62";
          _0x462817.fill();
          if (!_0x280cd3) {
            _0x462817.stroke();
          }
        }
      } else if (_0x3eff52.name == "pit trap") {
        let _0x3a3562 = "#6a994e";
        let _0x41e390 = "rgba(0, 100, 0, 0.8)";
        let _0x25beba = "#004d00";
        let _0x10313a = _0x3eff52.scale * 1.1;
        let _0x2c4da0 = _0x3eff52.scale * 0.65;
        _0x462817.fillStyle = _0x3a3562;
        _0x372d18(_0x462817, 3, _0x10313a, _0x10313a);
        _0x462817.fill();
        _0x462817.strokeStyle = _0x25beba;
        _0x462817.lineWidth = 3;
        _0x462817.stroke();
        _0x462817.shadowBlur = 10;
        _0x462817.shadowColor = "rgba(0, 100, 0, 0.5)";
        _0x462817.fill();
        _0x462817.stroke();
        _0x462817.shadowBlur = 0;
        _0x462817.fillStyle = _0x41e390;
        _0x372d18(_0x462817, 3, _0x2c4da0, _0x2c4da0);
        _0x462817.fill();
        _0x462817.shadowBlur = 5;
        _0x462817.shadowColor = "rgba(0, 100, 0, 0.3)";
        _0x462817.fill();
        _0x462817.stroke();
        _0x462817.shadowBlur = 0;
        _0x462817.lineWidth = 1;
      } else if (_0x3eff52.name == "boost pad") {
        _0x462817.fillStyle = "#7e7f82";
        _0x174b77(0, 0, _0x3eff52.scale * 2, _0x3eff52.scale * 2, _0x462817);
        _0x462817.fill();
        _0x462817.stroke();
        _0x462817.fillStyle = "#dbd97d";
        _0x56fa98(_0x3eff52.scale * 1, _0x462817);
      } else if (_0x3eff52.name == "turret") {
        _0x462817.fillStyle = "#a5974c";
        _0x2eb1e2(0, 0, _0x3eff52.scale, _0x462817);
        _0x462817.fill();
        _0x462817.stroke();
        _0x462817.fillStyle = "#939393";
        let _0x24e969 = 50;
        _0x174b77(0, -_0x24e969 / 2, _0x3eff52.scale * 0.9, _0x24e969, _0x462817);
        _0x2eb1e2(0, 0, _0x3eff52.scale * 0.6, _0x462817);
        _0x462817.fill();
        _0x462817.stroke();
      } else if (_0x3eff52.name == "platform") {
        _0x462817.fillStyle = "#cebd5f";
        let _0x35c9b3 = 4;
        let _0x30cc17 = _0x3eff52.scale * 2;
        let _0x3d0c87 = _0x30cc17 / _0x35c9b3;
        let _0x267f25 = -(_0x3eff52.scale / 2);
        for (let _0x1f41cf = 0; _0x1f41cf < _0x35c9b3; ++_0x1f41cf) {
          _0x174b77(_0x267f25 - _0x3d0c87 / 2, 0, _0x3d0c87, _0x3eff52.scale * 2, _0x462817);
          _0x462817.fill();
          _0x462817.stroke();
          _0x267f25 += _0x30cc17 / _0x35c9b3;
        }
      } else if (_0x3eff52.name == "healing pad") {
        _0x462817.fillStyle = "#7e7f82";
        _0x174b77(0, 0, _0x3eff52.scale * 2, _0x3eff52.scale * 2, _0x462817);
        _0x462817.fill();
        _0x462817.stroke();
        _0x462817.fillStyle = "#db6e6e";
        _0x356869(0, 0, _0x3eff52.scale * 0.65, 20, 4, _0x462817, true);
      } else if (_0x3eff52.name == "spawn pad") {
        _0x462817.fillStyle = "#7e7f82";
        _0x174b77(0, 0, _0x3eff52.scale * 2, _0x3eff52.scale * 2, _0x462817);
        _0x462817.fill();
        _0x462817.stroke();
        _0x462817.fillStyle = "#71aad6";
        _0x2eb1e2(0, 0, _0x3eff52.scale * 0.6, _0x462817);
      } else if (_0x3eff52.name == "blocker") {
        _0x462817.fillStyle = "#7e7f82";
        _0x2eb1e2(0, 0, _0x3eff52.scale, _0x462817);
        _0x462817.fill();
        _0x462817.stroke();
        _0x462817.rotate(Math.PI / 4);
        _0x462817.fillStyle = "#db6e6e";
        _0x356869(0, 0, _0x3eff52.scale * 0.65, 20, 4, _0x462817, true);
      } else if (_0x3eff52.name == "teleporter") {
        _0x462817.fillStyle = "#7e7f82";
        _0x2eb1e2(0, 0, _0x3eff52.scale, _0x462817);
        _0x462817.fill();
        _0x462817.stroke();
        _0x462817.rotate(Math.PI / 4);
        _0x462817.fillStyle = "#d76edb";
        _0x2eb1e2(0, 0, _0x3eff52.scale * 0.5, _0x462817, true);
      }
      _0x1202ae = _0x1818e5;
      if (!_0x464e41) {
        _0x31e236[_0x3eff52.id] = _0x1202ae;
      }
    }
    return _0x1202ae;
  }
  function _0x1cec78(_0x44b76b, _0x105dd4, _0x11e1cd) {
    let _0x48f93a = _0x3b5929;
    let _0x58d974 = _0x44b76b.name == "windmill" ? _0x146f01.list[4].scale : _0x44b76b.scale;
    _0x48f93a.save();
    _0x48f93a.translate(_0x105dd4, _0x11e1cd);
    _0x48f93a.rotate(_0x44b76b.dir);
    _0x48f93a.strokeStyle = _0x2d70c1;
    _0x48f93a.lineWidth = _0x438f6d;
    if (_0x44b76b.name == "apple") {
      _0x48f93a.fillStyle = "#c15555";
      _0x2eb1e2(0, 0, _0x44b76b.scale, _0x48f93a);
      _0x48f93a.fillStyle = "#89a54c";
      let _0x2e1a86 = -(Math.PI / 2);
      _0x4addc9(_0x44b76b.scale * Math.cos(_0x2e1a86), _0x44b76b.scale * Math.sin(_0x2e1a86), 25, _0x2e1a86 + Math.PI / 2, _0x48f93a);
    } else if (_0x44b76b.name == "cookie") {
      _0x48f93a.fillStyle = "#cca861";
      _0x2eb1e2(0, 0, _0x44b76b.scale, _0x48f93a);
      _0x48f93a.fillStyle = "#937c4b";
      let _0x5b06b7 = 4;
      let _0x489e1e = Math.PI * 2 / _0x5b06b7;
      let _0x211d87;
      for (let _0x3d8d0b = 0; _0x3d8d0b < _0x5b06b7; ++_0x3d8d0b) {
        _0x211d87 = _0x1c7eec.randInt(_0x44b76b.scale / 2.5, _0x44b76b.scale / 1.7);
        _0x2eb1e2(_0x211d87 * Math.cos(_0x489e1e * _0x3d8d0b), _0x211d87 * Math.sin(_0x489e1e * _0x3d8d0b), _0x1c7eec.randInt(4, 5), _0x48f93a, true);
      }
    } else if (_0x44b76b.name == "cheese") {
      _0x48f93a.fillStyle = "#f4f3ac";
      _0x2eb1e2(0, 0, _0x44b76b.scale, _0x48f93a);
      _0x48f93a.fillStyle = "#c3c28b";
      let _0xf584b7 = 4;
      let _0x1ddd0b = Math.PI * 2 / _0xf584b7;
      let _0x5a5008;
      for (let _0x4c2a09 = 0; _0x4c2a09 < _0xf584b7; ++_0x4c2a09) {
        _0x5a5008 = _0x1c7eec.randInt(_0x44b76b.scale / 2.5, _0x44b76b.scale / 1.7);
        _0x2eb1e2(_0x5a5008 * Math.cos(_0x1ddd0b * _0x4c2a09), _0x5a5008 * Math.sin(_0x1ddd0b * _0x4c2a09), _0x1c7eec.randInt(4, 5), _0x48f93a, true);
      }
    } else if (_0x44b76b.name == "wood wall" || _0x44b76b.name == "stone wall" || _0x44b76b.name == "castle wall") {
      _0x48f93a.fillStyle = _0x44b76b.name == "castle wall" ? "#83898e" : _0x44b76b.name == "wood wall" ? "#a5974c" : "#939393";
      let _0x2e11b1 = _0x44b76b.name == "castle wall" ? 4 : 3;
      _0x372d18(_0x48f93a, _0x2e11b1, _0x44b76b.scale * 1.1, _0x44b76b.scale * 1.1);
      _0x48f93a.fill();
      _0x48f93a.stroke();
      _0x48f93a.fillStyle = _0x44b76b.name == "castle wall" ? "#9da4aa" : _0x44b76b.name == "wood wall" ? "#c9b758" : "#bcbcbc";
      _0x372d18(_0x48f93a, _0x2e11b1, _0x44b76b.scale * 0.65, _0x44b76b.scale * 0.65);
      _0x48f93a.fill();
    } else if (_0x44b76b.name == "spikes" || _0x44b76b.name == "greater spikes" || _0x44b76b.name == "poison spikes" || _0x44b76b.name == "spinning spikes") {
      _0x48f93a.fillStyle = _0x44b76b.name == "poison spikes" ? "#7b935d" : "#939393";
      let _0x47fac7 = _0x44b76b.scale * 0.6;
      _0x372d18(_0x48f93a, _0x44b76b.name == "spikes" ? 5 : 6, _0x44b76b.scale, _0x47fac7);
      _0x48f93a.fill();
      _0x48f93a.stroke();
      _0x48f93a.fillStyle = "#a5974c";
      _0x2eb1e2(0, 0, _0x47fac7, _0x48f93a);
      _0x48f93a.fillStyle = "#c9b758";
      _0x2eb1e2(0, 0, _0x47fac7 / 2, _0x48f93a, true);
    } else if (_0x44b76b.name == "windmill" || _0x44b76b.name == "faster windmill" || _0x44b76b.name == "power mill") {
      _0x48f93a.fillStyle = "#a5974c";
      _0x2eb1e2(0, 0, _0x58d974, _0x48f93a);
      _0x48f93a.fillStyle = "#c9b758";
      _0x356869(0, 0, _0x58d974 * 1.5, 29, 4, _0x48f93a);
      _0x48f93a.fillStyle = "#a5974c";
      _0x2eb1e2(0, 0, _0x58d974 * 0.5, _0x48f93a);
    } else if (_0x44b76b.name == "mine") {
      _0x48f93a.fillStyle = "#939393";
      _0x372d18(_0x48f93a, 3, _0x44b76b.scale, _0x44b76b.scale);
      _0x48f93a.fill();
      _0x48f93a.stroke();
      _0x48f93a.fillStyle = "#bcbcbc";
      _0x372d18(_0x48f93a, 3, _0x44b76b.scale * 0.55, _0x44b76b.scale * 0.65);
      _0x48f93a.fill();
    } else if (_0x44b76b.name == "sapling") {
      for (let _0x36a835 = 0; _0x36a835 < 2; ++_0x36a835) {
        let _0x1c71a4 = _0x44b76b.scale * (!_0x36a835 ? 1 : 0.5);
        _0x372d18(_0x48f93a, 7, _0x1c71a4, _0x1c71a4 * 0.7);
        _0x48f93a.fillStyle = !_0x36a835 ? "#9ebf57" : "#b4db62";
        _0x48f93a.fill();
        if (!_0x36a835) {
          _0x48f93a.stroke();
        }
      }
    } else if (_0x44b76b.name == "pit trap") {
      _0x48f93a.fillStyle = "#a5974c";
      _0x372d18(_0x48f93a, 3, _0x44b76b.scale * 1.1, _0x44b76b.scale * 1.1);
      _0x48f93a.fill();
      _0x48f93a.stroke();
      _0x48f93a.fillStyle = _0x2d70c1;
      _0x372d18(_0x48f93a, 3, _0x44b76b.scale * 0.65, _0x44b76b.scale * 0.65);
      _0x48f93a.fill();
    } else if (_0x44b76b.name == "boost pad") {
      _0x48f93a.fillStyle = "#7e7f82";
      _0x174b77(0, 0, _0x44b76b.scale * 2, _0x44b76b.scale * 2, _0x48f93a);
      _0x48f93a.fill();
      _0x48f93a.stroke();
      _0x48f93a.fillStyle = "#dbd97d";
      _0x56fa98(_0x44b76b.scale * 1, _0x48f93a);
    } else if (_0x44b76b.name == "turret") {
      _0x48f93a.fillStyle = "#a5974c";
      _0x2eb1e2(0, 0, _0x44b76b.scale, _0x48f93a);
      _0x48f93a.fill();
      _0x48f93a.stroke();
      _0x48f93a.fillStyle = "#939393";
      let _0x2d67db = 50;
      _0x174b77(0, -_0x2d67db / 2, _0x44b76b.scale * 0.9, _0x2d67db, _0x48f93a);
      _0x2eb1e2(0, 0, _0x44b76b.scale * 0.6, _0x48f93a);
      _0x48f93a.fill();
      _0x48f93a.stroke();
    } else if (_0x44b76b.name == "platform") {
      _0x48f93a.fillStyle = "#cebd5f";
      let _0x528e54 = 4;
      let _0x1ff26b = _0x44b76b.scale * 2;
      let _0x28b018 = _0x1ff26b / _0x528e54;
      let _0x48608f = -(_0x44b76b.scale / 2);
      for (let _0x1a2270 = 0; _0x1a2270 < _0x528e54; ++_0x1a2270) {
        _0x174b77(_0x48608f - _0x28b018 / 2, 0, _0x28b018, _0x44b76b.scale * 2, _0x48f93a);
        _0x48f93a.fill();
        _0x48f93a.stroke();
        _0x48608f += _0x1ff26b / _0x528e54;
      }
    } else if (_0x44b76b.name == "healing pad") {
      _0x48f93a.fillStyle = "#7e7f82";
      _0x174b77(0, 0, _0x44b76b.scale * 2, _0x44b76b.scale * 2, _0x48f93a);
      _0x48f93a.fill();
      _0x48f93a.stroke();
      _0x48f93a.fillStyle = "#db6e6e";
      _0x356869(0, 0, _0x44b76b.scale * 0.65, 20, 4, _0x48f93a, true);
    } else if (_0x44b76b.name == "spawn pad") {
      _0x48f93a.fillStyle = "#7e7f82";
      _0x174b77(0, 0, _0x44b76b.scale * 2, _0x44b76b.scale * 2, _0x48f93a);
      _0x48f93a.fill();
      _0x48f93a.stroke();
      _0x48f93a.fillStyle = "#71aad6";
      _0x2eb1e2(0, 0, _0x44b76b.scale * 0.6, _0x48f93a);
    } else if (_0x44b76b.name == "blocker") {
      _0x48f93a.fillStyle = "#7e7f82";
      _0x2eb1e2(0, 0, _0x44b76b.scale, _0x48f93a);
      _0x48f93a.fill();
      _0x48f93a.stroke();
      _0x48f93a.rotate(Math.PI / 4);
      _0x48f93a.fillStyle = "#db6e6e";
      _0x356869(0, 0, _0x44b76b.scale * 0.65, 20, 4, _0x48f93a, true);
    } else if (_0x44b76b.name == "teleporter") {
      _0x48f93a.fillStyle = "#7e7f82";
      _0x2eb1e2(0, 0, _0x44b76b.scale, _0x48f93a);
      _0x48f93a.fill();
      _0x48f93a.stroke();
      _0x48f93a.rotate(Math.PI / 4);
      _0x48f93a.fillStyle = "#d76edb";
      _0x2eb1e2(0, 0, _0x44b76b.scale * 0.5, _0x48f93a, true);
    }
    _0x48f93a.restore();
  }
  let _0x1a50c8 = [];
  function _0x141f9b(_0x89533f) {
    let _0x12c323 = _0x1a50c8[_0x89533f.id];
    if (!_0x12c323) {
      let _0x478302 = document.createElement("canvas");
      _0x478302.width = _0x478302.height = _0x89533f.scale * 2.5 + _0x438f6d + (_0x146f01.list[_0x89533f.id].spritePadding || 0) + 0;
      let _0x11863a = _0x478302.getContext("2d");
      _0x11863a.translate(_0x478302.width / 2, _0x478302.height / 2);
      _0x11863a.rotate(Math.PI / 2);
      _0x11863a.strokeStyle = _0x2d70c1;
      _0x11863a.lineWidth = _0x438f6d;
      if (_0x89533f.name == "spikes" || _0x89533f.name == "greater spikes" || _0x89533f.name == "poison spikes" || _0x89533f.name == "spinning spikes") {
        _0x11863a.fillStyle = _0x89533f.name == "poison spikes" ? "#7b935d" : "#939393";
        let _0x50f75c = _0x89533f.scale * 0.6;
        _0x372d18(_0x11863a, _0x89533f.name == "spikes" ? 5 : 6, _0x89533f.scale, _0x50f75c);
        _0x11863a.fill();
        _0x11863a.strokeStyle = "rgba(255, 0, 0, 0.8)";
        _0x11863a.lineWidth = 3;
        _0x11863a.stroke();
        _0x11863a.shadowBlur = 15;
        _0x11863a.shadowColor = "rgba(255, 0, 0, 0.7)";
        _0x11863a.fill();
        _0x11863a.stroke();
        _0x11863a.shadowBlur = 0;
        _0x11863a.fillStyle = "#a5974c";
        _0x2eb1e2(0, 0, _0x50f75c, _0x11863a);
        _0x11863a.fillStyle = "#cc5151";
        _0x2eb1e2(0, 0, _0x50f75c / 2, _0x11863a, true);
        _0x11863a.shadowBlur = 5;
        _0x11863a.shadowColor = "rgba(255, 0, 0, 0.5)";
        _0x11863a.fill();
        _0x11863a.stroke();
        _0x11863a.shadowBlur = 0;
        _0x11863a.lineWidth = 1;
      } else if (_0x89533f.name == "pit trap") {
        _0x11863a.fillStyle = "#a5974c";
        let _0x4f2f84 = _0x89533f.scale * 1.1;
        let _0x291b3b = _0x89533f.scale * 0.65;
        _0x372d18(_0x11863a, 3, _0x4f2f84, _0x4f2f84);
        _0x11863a.fill();
        _0x11863a.strokeStyle = "rgba(255, 0, 0, 0.8)";
        _0x11863a.lineWidth = 3;
        _0x11863a.stroke();
        _0x11863a.shadowBlur = 15;
        _0x11863a.shadowColor = "rgba(255, 0, 0, 0.7)";
        _0x11863a.fill();
        _0x11863a.stroke();
        _0x11863a.shadowBlur = 0;
        _0x11863a.fillStyle = "#cc5151";
        _0x372d18(_0x11863a, 3, _0x291b3b, _0x291b3b);
        _0x11863a.fill();
        _0x11863a.shadowBlur = 5;
        _0x11863a.shadowColor = "rgba(255, 0, 0, 0.5)";
        _0x11863a.fill();
        _0x11863a.stroke();
        _0x11863a.shadowBlur = 0;
        _0x11863a.lineWidth = 1;
      }
      _0x12c323 = _0x478302;
      _0x1a50c8[_0x89533f.id] = _0x12c323;
    }
    return _0x12c323;
  }
  function _0x1f3ed2(_0x56c485, _0x6bd781, _0x119526, _0x4a7dfc) {
    let _0x573185 = {
      x: _0x3c4e85 / 2,
      y: _0x3e9fd6 / 2
    };
    _0x6bd781.lineWidth = _0x438f6d;
    _0x3b5929.globalAlpha = 0.2;
    _0x6bd781.strokeStyle = _0x2d70c1;
    _0x6bd781.save();
    _0x6bd781.translate(_0x119526, _0x4a7dfc);
    _0x6bd781.rotate(34867844010000000000);
    if (_0x56c485.name == "spikes" || _0x56c485.name == "greater spikes" || _0x56c485.name == "poison spikes" || _0x56c485.name == "spinning spikes") {
      _0x6bd781.fillStyle = _0x56c485.name == "poison spikes" ? "#7b935d" : "#939393";
      var _0x1c3991 = _0x56c485.scale;
      _0x372d18(_0x6bd781, _0x56c485.name == "spikes" ? 5 : 6, _0x56c485.scale, _0x1c3991);
      _0x6bd781.fill();
      _0x6bd781.stroke();
      _0x6bd781.fillStyle = "#a5974c";
      _0x2eb1e2(0, 0, _0x1c3991, _0x6bd781);
      if (_0x547655 && _0x56c485.owner && _0x547655.sid != _0x56c485.owner.sid && !_0x3a3fd7.findAllianceBySid(_0x56c485.owner.sid)) {
        _0x6bd781.fillStyle = "#a34040";
      } else {
        _0x6bd781.fillStyle = "#c9b758";
      }
      _0x2eb1e2(0, 0, _0x1c3991 / 2, _0x6bd781, true);
    } else if (_0x56c485.name == "turret") {
      _0x2eb1e2(0, 0, _0x56c485.scale, _0x6bd781);
      _0x6bd781.fill();
      _0x6bd781.stroke();
      _0x6bd781.fillStyle = "#939393";
      let _0x2f6223 = 50;
      _0x174b77(0, -_0x2f6223 / 2, _0x56c485.scale * 0.9, _0x2f6223, _0x6bd781);
      _0x2eb1e2(0, 0, _0x56c485.scale * 0.6, _0x6bd781);
      _0x6bd781.fill();
      _0x6bd781.stroke();
    } else if (_0x56c485.name == "teleporter") {
      _0x6bd781.fillStyle = "#7e7f82";
      _0x2eb1e2(0, 0, _0x56c485.scale, _0x6bd781);
      _0x6bd781.fill();
      _0x6bd781.stroke();
      _0x6bd781.rotate(Math.PI / 4);
      _0x6bd781.fillStyle = "#d76edb";
      _0x2eb1e2(0, 0, _0x56c485.scale * 0.5, _0x6bd781, true);
    } else if (_0x56c485.name == "platform") {
      _0x6bd781.fillStyle = "#cebd5f";
      let _0x42eadf = 4;
      let _0x1dde4a = _0x56c485.scale * 2;
      let _0x5d54cc = _0x1dde4a / _0x42eadf;
      let _0x19cb8a = -(_0x56c485.scale / 2);
      for (let _0x1c4343 = 0; _0x1c4343 < _0x42eadf; ++_0x1c4343) {
        _0x174b77(_0x19cb8a - _0x5d54cc / 2, 0, _0x5d54cc, _0x56c485.scale * 2, _0x6bd781);
        _0x6bd781.fill();
        _0x6bd781.stroke();
        _0x19cb8a += _0x1dde4a / _0x42eadf;
      }
    } else if (_0x56c485.name == "healing pad") {
      _0x6bd781.fillStyle = "#7e7f82";
      _0x174b77(0, 0, _0x56c485.scale * 2, _0x56c485.scale * 2, _0x6bd781);
      _0x6bd781.fill();
      _0x6bd781.stroke();
      _0x6bd781.fillStyle = "#db6e6e";
      _0x356869(0, 0, _0x56c485.scale * 0.65, 20, 4, _0x6bd781, true);
    } else if (_0x56c485.name == "spawn pad") {
      _0x6bd781.fillStyle = "#7e7f82";
      _0x174b77(0, 0, _0x56c485.scale * 2, _0x56c485.scale * 2, _0x6bd781);
      _0x6bd781.fill();
      _0x6bd781.stroke();
      _0x6bd781.fillStyle = "#71aad6";
      _0x2eb1e2(0, 0, _0x56c485.scale * 0.6, _0x6bd781);
    } else if (_0x56c485.name == "blocker") {
      _0x6bd781.fillStyle = "#7e7f82";
      _0x2eb1e2(0, 0, _0x56c485.scale, _0x6bd781);
      _0x6bd781.fill();
      _0x6bd781.stroke();
      _0x6bd781.rotate(Math.PI / 4);
      _0x6bd781.fillStyle = "#db6e6e";
      _0x356869(0, 0, _0x56c485.scale * 0.65, 20, 4, _0x6bd781, true);
    } else if (_0x56c485.name == "windmill" || _0x56c485.name == "faster windmill" || _0x56c485.name == "power mill") {
      _0x6bd781.fillStyle = "#a5974c";
      _0x2eb1e2(0, 0, _0x56c485.scale, _0x6bd781);
      _0x6bd781.fillStyle = "#c9b758";
      _0x356869(0, 0, _0x56c485.scale * 1.5, 29, 4, _0x6bd781);
      _0x6bd781.fillStyle = "#a5974c";
      _0x2eb1e2(0, 0, _0x56c485.scale * 0.5, _0x6bd781);
    } else if (_0x56c485.name == "pit trap") {
      _0x6bd781.fillStyle = "#a5974c";
      _0x372d18(_0x6bd781, 3, _0x56c485.scale * 1.1, _0x56c485.scale * 1.1);
      _0x6bd781.fill();
      _0x6bd781.stroke();
      if (_0x547655 && _0x56c485.owner && _0x547655.sid != _0x56c485.owner.sid && !_0x3a3fd7.findAllianceBySid(_0x56c485.owner.sid)) {
        _0x6bd781.fillStyle = "#a34040";
      } else {
        _0x6bd781.fillStyle = _0x2d70c1;
      }
      _0x372d18(_0x6bd781, 3, _0x56c485.scale * 0.65, _0x56c485.scale * 0.65);
      _0x6bd781.fill();
    }
    _0x6bd781.restore();
  }
  function _0xbeb465(_0x5f0033, _0x295aca, _0x1e2b82) {
    return _0x5f0033 + _0x1e2b82 >= 0 && _0x5f0033 - _0x1e2b82 <= _0x3d89ad && _0x295aca + _0x1e2b82 >= 0 && (_0x295aca, _0x1e2b82, _0x47e786);
  }
  function _0x2ea6ec(_0x25613f, _0x506cae, _0x433bc4) {
    let _0x533550;
    let _0x45db43;
    let _0x223a01;
    _0x51a14e.forEach(_0xac7b6d => {
      _0x3a3fd7 = _0xac7b6d;
      if (_0x3a3fd7.active && _0x51a14e.includes(_0xac7b6d) && _0x3a3fd7.render) {
        _0x45db43 = _0x3a3fd7.x + _0x3a3fd7.xWiggle - _0x506cae;
        _0x223a01 = _0x3a3fd7.y + _0x3a3fd7.yWiggle - _0x433bc4;
        if (_0x25613f == 0) {
          _0x3a3fd7.update(_0x4819c7);
        }
        _0x3b5929.globalAlpha = _0x3a3fd7.alpha;
        if (_0x3a3fd7.layer == _0x25613f && _0xbeb465(_0x45db43, _0x223a01, _0x3a3fd7.scale + (_0x3a3fd7.blocker || 0))) {
          if (_0x3a3fd7.isItem) {
            if ((_0x3a3fd7.dmg || _0x3a3fd7.trap) && !_0x3a3fd7.isTeamObject(_0x547655)) {
              _0x533550 = _0x141f9b(_0x3a3fd7);
            } else {
              _0x533550 = _0x5e1edc(_0x3a3fd7);
            }
            _0x3b5929.save();
            _0x3b5929.translate(_0x45db43, _0x223a01);
            _0x3b5929.rotate(_0x3a3fd7.dir);
            if (!_0x3a3fd7.active) {
              _0x3b5929.scale(_0x3a3fd7.visScale / _0x3a3fd7.scale, _0x3a3fd7.visScale / _0x3a3fd7.scale);
            }
            _0x3b5929.drawImage(_0x533550, -(_0x533550.width / 2), -(_0x533550.height / 2));
            if (_0x3a3fd7.blocker) {
              _0x3b5929.strokeStyle = "#db6e6e";
              _0x3b5929.globalAlpha = 0.3;
              _0x3b5929.lineWidth = 6;
              _0x2eb1e2(0, 0, _0x3a3fd7.blocker, _0x3b5929, false, true);
            }
            _0x3b5929.restore();
          } else {
            _0x533550 = _0x103cdd(_0x3a3fd7);
            _0x3b5929.drawImage(_0x533550, _0x45db43 - _0x533550.width / 2, _0x223a01 - _0x533550.height / 2);
          }
        }
        if (_0x25613f == 3 && !_0x50abc3) {
          if (_0x3a3fd7.health < _0x3a3fd7.maxHealth) {
            _0x3b5929.fillStyle = "rgba(0, 0, 0, 0)";
            _0x3b5929.roundRect(_0x45db43 - _0x4ee004.healthBarWidth / 2 - _0x4ee004.healthBarPad, _0x223a01 - _0x4ee004.healthBarPad, _0x4ee004.healthBarWidth + _0x4ee004.healthBarPad * 2, 17, 8);
            _0x3b5929.fill();
            _0x3b5929.fillStyle = "rgba(0, 0, 0, 0)";
            _0x3b5929.roundRect(_0x45db43 - _0x4ee004.healthBarWidth / 2, _0x223a01, _0x4ee004.healthBarWidth * (_0x3a3fd7.health / _0x3a3fd7.maxHealth), 17 - _0x4ee004.healthBarPad * 2, 7);
            _0x3b5929.fill();
          }
        }
      }
    });
    if (_0x25613f == 0) {
      if (_0x4fcde6.length) {
        _0x4fcde6.forEach(_0x5dee52 => {
          _0x45db43 = _0x5dee52.x - _0x506cae;
          _0x223a01 = _0x5dee52.y - _0x433bc4;
          _0x2c6d88(_0x5dee52, _0x45db43, _0x223a01);
        });
      }
    }
  }
  function _0x2c6d88(_0x1f6436, _0x3c7500, _0x4ad1ef) {
    _0x1f3ed2(_0x1f6436, _0x3b5929, _0x3c7500, _0x4ad1ef);
  }
  class _0x20bc17 {
    constructor(_0x6a5c4d, _0x2067a7) {
      this.init = function (_0x4c9224, _0x464a90) {
        this.scale = 0;
        this.x = _0x4c9224;
        this.y = _0x464a90;
        this.active = true;
      };
      this.update = function (_0x47f8ef, _0x482739) {
        if (this.active) {
          this.scale += _0x482739 * 0.05;
          if (this.scale >= _0x2067a7) {
            this.active = false;
          } else {
            _0x47f8ef.globalAlpha = 1 - Math.max(0, this.scale / _0x2067a7);
            _0x47f8ef.beginPath();
            _0x47f8ef.arc(this.x / _0x4ee004.mapScale * _0x72ac7a.width, this.y / _0x4ee004.mapScale * _0x72ac7a.width, this.scale, 0, Math.PI * 2);
            _0x47f8ef.stroke();
          }
        }
      };
      this.color = _0x6a5c4d;
    }
  }
  function _0x418722(_0x10837c, _0x301efc) {
    _0x35b83a = _0x131176.find(_0x229b5d => !_0x229b5d.active);
    if (!_0x35b83a) {
      _0x35b83a = new _0x20bc17("#fff", _0x4ee004.mapPingScale);
      _0x131176.push(_0x35b83a);
    }
    _0x35b83a.init(_0x10837c, _0x301efc);
  }
  function _0x418232() {
    _0x524c78.x = _0x547655.x;
    _0x524c78.y = _0x547655.y;
  }
  function _0x533a44(_0x52c95c) {
    if (_0x547655 && _0x547655.alive) {
      _0x36d201.clearRect(0, 0, _0x72ac7a.width, _0x72ac7a.height);
      _0x36d201.lineWidth = 4;
      for (let _0x517455 = 0; _0x517455 < _0x131176.length; ++_0x517455) {
        _0x35b83a = _0x131176[_0x517455];
        _0x36d201.strokeStyle = _0x35b83a.color;
        _0x35b83a.update(_0x36d201, _0x52c95c);
      }
      _0x36d201.globalAlpha = 1;
      _0x36d201.fillStyle = "#ff0000";
      if (_0x216572.length) {
        _0x36d201.fillStyle = "#abcdef";
        _0x36d201.font = "34px HammerSmith One";
        _0x36d201.textBaseline = "middle";
        _0x36d201.textAlign = "center";
        for (let _0x332e91 = 0; _0x332e91 < _0x216572.length;) {
          _0x36d201.fillText("!", _0x216572[_0x332e91].x / _0x4ee004.mapScale * _0x72ac7a.width, _0x216572[_0x332e91].y / _0x4ee004.mapScale * _0x72ac7a.height);
          _0x332e91 += 2;
        }
      }
      _0x36d201.globalAlpha = 1;
      _0x36d201.fillStyle = "#fff";
      _0x2eb1e2(_0x547655.x / _0x4ee004.mapScale * _0x72ac7a.width, _0x547655.y / _0x4ee004.mapScale * _0x72ac7a.height, 7, _0x36d201, true);
      _0x36d201.fillStyle = "rgba(255,255,255,0.35)";
      if (_0x547655.team && _0x5be014) {
        for (let _0x41dd42 = 0; _0x41dd42 < _0x5be014.length;) {
          _0x2eb1e2(_0x5be014[_0x41dd42] / _0x4ee004.mapScale * _0x72ac7a.width, _0x5be014[_0x41dd42 + 1] / _0x4ee004.mapScale * _0x72ac7a.height, 7, _0x36d201, true);
          _0x41dd42 += 2;
        }
      }
      if (_0x311ef8.length) {
        _0x311ef8.forEach(_0x120922 => {
          if (_0x120922.inGame) {
            _0x36d201.globalAlpha = 1;
            _0x36d201.strokeStyle = "#cc5151";
            _0x2eb1e2(_0x120922.x2 / _0x4ee004.mapScale * _0x72ac7a.width, _0x120922.y2 / _0x4ee004.mapScale * _0x72ac7a.height, 7, _0x36d201, false, true);
          }
        });
      }
      if (_0x5f2ccd) {
        _0x36d201.fillStyle = "#fc5553";
        _0x36d201.font = "34px HammerSmith One";
        _0x36d201.textBaseline = "middle";
        _0x36d201.textAlign = "center";
        _0x36d201.fillText("x", _0x5f2ccd.x / _0x4ee004.mapScale * _0x72ac7a.width, _0x5f2ccd.y / _0x4ee004.mapScale * _0x72ac7a.height);
      }
      if (_0x524c78) {
        _0x36d201.fillStyle = "#fff";
        _0x36d201.font = "34px HammerSmith One";
        _0x36d201.textBaseline = "middle";
        _0x36d201.textAlign = "center";
        _0x36d201.fillText("x", _0x524c78.x / _0x4ee004.mapScale * _0x72ac7a.width, _0x524c78.y / _0x4ee004.mapScale * _0x72ac7a.height);
      }
    }
  }
  let _0xb58589 = ["https://cdn.discordapp.com/attachments/1175772907931176991/1226209968051453962/Pngtreeskull_icon_logo_vector_illuatration_7964583.png?ex=6623f006&is=66117b06&hm=d34a6c712d3a3185a4ee966a72d839f54206d72f81a42439800706c9a6069715&", "https://cdn.discordapp.com/attachments/1175772907931176991/1226209968051453962/Pngtreeskull_icon_logo_vector_illuatration_7964583.png?ex=6623f006&is=66117b06&hm=d34a6c712d3a3185a4ee966a72d839f54206d72f81a42439800706c9a6069715&"];
  let _0x43cac5 = {};
  let _0x882c13 = {};
  let _0x57c1bb = ["crown", "skull"];
  function _0x9065a9() {
    for (let _0x2d0f3a = 0; _0x2d0f3a < _0x57c1bb.length; ++_0x2d0f3a) {
      let _0x2785b6 = new Image();
      _0x2785b6.onload = function () {
        this.isLoaded = true;
      };
      _0x2785b6.src = "./../img/icons/" + _0x57c1bb[_0x2d0f3a] + ".png";
      _0x882c13[_0x57c1bb[_0x2d0f3a]] = _0x2785b6;
    }
    for (let _0x31aab9 = 0; _0x31aab9 < _0xb58589.length; ++_0x31aab9) {
      let _0x2911b3 = new Image();
      _0x2911b3.onload = function () {
        this.isLoaded = true;
      };
      _0x2911b3.src = _0xb58589[_0x31aab9];
      _0x43cac5[_0x31aab9] = _0x2911b3;
    }
  }
  _0x9065a9();
  function _0x57057a(_0x5ea0a8, _0x4fa56f) {
    try {
      return Math.hypot((_0x4fa56f.y2 || _0x4fa56f.y) - (_0x5ea0a8.y2 || _0x5ea0a8.y), (_0x4fa56f.x2 || _0x4fa56f.x) - (_0x5ea0a8.x2 || _0x5ea0a8.x));
    } catch (_0x263b3e) {
      return Infinity;
    }
  }
  function _0x13d2d3(_0x3c745b, _0x1ceb74) {
    try {
      return Math.atan2((_0x1ceb74.y2 || _0x1ceb74.y) - (_0x3c745b.y2 || _0x3c745b.y), (_0x1ceb74.x2 || _0x1ceb74.x) - (_0x3c745b.x2 || _0x3c745b.x));
    } catch (_0x188598) {
      return 0;
    }
  }
  function _0xd428f7(_0x359c32, _0x23a57c) {
    try {
      return Math.hypot((_0x23a57c.y2 || _0x23a57c.y) - (_0x359c32.y2 || _0x359c32.y), (_0x23a57c.x2 || _0x23a57c.x) - (_0x359c32.x2 || _0x359c32.x));
    } catch (_0x22b3d6) {
      return Infinity;
    }
  }
  function _0x3ba26d() {
    if (_0x4e7d72.length && _0x37b6ae) {
      _0x4e7d72.forEach(_0x59a51d => {
        if (_0x1c7eec.getDistance(_0x59a51d.x, _0x59a51d.y, _0x547655.x, _0x547655.y) <= 1200) {
          if (!_0x51a14e.includes(_0x59a51d)) {
            _0x51a14e.push(_0x59a51d);
            _0x59a51d.render = true;
          }
        } else if (_0x51a14e.includes(_0x59a51d)) {
          if (_0x1c7eec.getDistance(_0x59a51d.x, _0x59a51d.y, _0x547655.x, _0x547655.y) >= 1200) {
            _0x59a51d.render = false;
            const _0x353dbc = _0x51a14e.indexOf(_0x59a51d);
            if (_0x353dbc > -1) {
              _0x51a14e.splice(_0x353dbc, 1);
            }
          }
        } else if (_0x1c7eec.getDistance(_0x59a51d.x, _0x59a51d.y, _0x547655.x, _0x547655.y) >= 1200) {
          _0x59a51d.render = false;
          const _0x154cb0 = _0x51a14e.indexOf(_0x59a51d);
          if (_0x154cb0 > -1) {
            _0x51a14e.splice(_0x154cb0, 1);
          }
        } else {
          _0x59a51d.render = false;
          const _0x42c2f9 = _0x51a14e.indexOf(_0x59a51d);
          if (_0x42c2f9 > -1) {
            _0x51a14e.splice(_0x42c2f9, 1);
          }
        }
      });
    }
    _0x3b5929.beginPath();
    _0x3b5929.clearRect(0, 0, _0x4851e7.width, _0x4851e7.height);
    _0x3b5929.globalAlpha = 1;
    if (_0x547655) {
      if (false) {
        _0xe46d09 = _0x547655.x;
        _0x5319f3 = _0x547655.y;
      } else {
        let _0x4d14b8 = _0x1c7eec.getDistance(_0xe46d09, _0x5319f3, _0x547655.x, _0x547655.y);
        let _0x1a0482 = _0x1c7eec.getDirection(_0x547655.x, _0x547655.y, _0xe46d09, _0x5319f3);
        let _0x3ab8b5 = Math.min(_0x4d14b8 * 0.0045 * _0x4819c7, _0x4d14b8);
        if (_0x4d14b8 > 0.05) {
          _0xe46d09 += _0x3ab8b5 * Math.cos(_0x1a0482);
          _0x5319f3 += _0x3ab8b5 * Math.sin(_0x1a0482);
        } else {
          _0xe46d09 = _0x547655.x;
          _0x5319f3 = _0x547655.y;
        }
      }
    } else {
      _0xe46d09 = _0x4ee004.mapScale / 2 + _0x4ee004.riverWidth;
      _0x5319f3 = _0x4ee004.mapScale / 2;
    }
    if (_0x4a49de.active) {
      if (_0x4a49de.array && (_0x4a49de.chaseNear ? _0x5b81e2.length : true)) {
        _0x3b5929.lineWidth = _0x547655.scale / 5;
        _0x3b5929.globalAlpha = 1;
        _0x3b5929.strokeStyle = "red";
        _0x3b5929.beginPath();
        _0x4a49de.array.forEach((_0x5dbc44, _0x267132) => {
          let _0x508403 = {
            x: _0x4a49de.scale / _0x4a49de.grid * _0x5dbc44.x,
            y: _0x4a49de.scale / _0x4a49de.grid * _0x5dbc44.y
          };
          let _0x513a24 = {
            x: _0x547655.x2 - _0x4a49de.scale / 2 + _0x508403.x - _0x11bc43,
            y: _0x547655.y2 - _0x4a49de.scale / 2 + _0x508403.y - _0x599d15
          };
          if (_0x267132 == 0) {
            _0x3b5929.moveTo(_0x513a24.x, _0x513a24.y);
          } else {
            _0x3b5929.lineTo(_0x513a24.x, _0x513a24.y);
          }
        });
        _0x3b5929.stroke();
      }
    }
    let _0x37ebc5 = _0x24c027 - 1000 / _0x4ee004.serverUpdateRate;
    let _0x2d67cf;
    for (let _0x1e9664 = 0; _0x1e9664 < _0x3c40e0.length + _0x201ec2.length; ++_0x1e9664) {
      _0x3a3fd7 = _0x3c40e0[_0x1e9664] || _0x201ec2[_0x1e9664 - _0x3c40e0.length];
      if (_0x3a3fd7 && _0x3a3fd7.visible) {
        if (_0x3a3fd7.forcePos) {
          _0x3a3fd7.x = _0x3a3fd7.x2;
          _0x3a3fd7.y = _0x3a3fd7.y2;
          _0x3a3fd7.dir = _0x3a3fd7.d2;
        } else {
          let _0x14a6f5 = _0x3a3fd7.t2 - _0x3a3fd7.t1;
          let _0x3d079a = _0x37ebc5 - _0x3a3fd7.t1;
          let _0x10a5e1 = _0x3d079a / _0x14a6f5;
          let _0x2fde28 = 170;
          _0x3a3fd7.dt += _0x4819c7;
          let _0x481c37 = Math.min(1.7, _0x3a3fd7.dt / _0x2fde28);
          _0x2d67cf = _0x3a3fd7.x2 - _0x3a3fd7.x1;
          _0x3a3fd7.x = _0x3a3fd7.x1 + _0x2d67cf * _0x481c37;
          _0x2d67cf = _0x3a3fd7.y2 - _0x3a3fd7.y1;
          _0x3a3fd7.y = _0x3a3fd7.y1 + _0x2d67cf * _0x481c37;
          if (_0x4ee004.anotherVisual) {
            _0x3a3fd7.dir = Math.lerpAngle(_0x3a3fd7.d2, _0x3a3fd7.d1, Math.min(1.2, _0x10a5e1));
          } else {
            _0x3a3fd7.dir = Math.lerpAngle(_0x3a3fd7.d2, _0x3a3fd7.d1, Math.min(1.2, _0x10a5e1));
          }
        }
      }
    }
    let _0x11bc43 = _0xe46d09 - _0x3d89ad / 2;
    let _0x599d15 = _0x5319f3 - _0x47e786 / 2;
    if (_0x4ee004.snowBiomeTop - _0x599d15 <= 0 && _0x4ee004.mapScale - _0x4ee004.snowBiomeTop - _0x599d15 >= _0x47e786) {
      _0x3b5929.fillStyle = "#b6db66";
      _0x3b5929.fillRect(0, 0, _0x3d89ad, _0x47e786);
    } else if (_0x4ee004.mapScale - _0x4ee004.snowBiomeTop - _0x599d15 <= 0) {
      _0x3b5929.fillStyle = "#dbc666";
      _0x3b5929.fillRect(0, 0, _0x3d89ad, _0x47e786);
    } else if (_0x4ee004.snowBiomeTop - _0x599d15 >= _0x47e786) {
      _0x3b5929.fillStyle = "#fff";
      _0x3b5929.fillRect(0, 0, _0x3d89ad, _0x47e786);
    } else if (_0x4ee004.snowBiomeTop - _0x599d15 >= 0) {
      _0x3b5929.fillStyle = "#fff";
      _0x3b5929.fillRect(0, 0, _0x3d89ad, _0x4ee004.snowBiomeTop - _0x599d15);
      _0x3b5929.fillStyle = "#b6db66";
      _0x3b5929.fillRect(0, _0x4ee004.snowBiomeTop - _0x599d15, _0x3d89ad, _0x47e786 - (_0x4ee004.snowBiomeTop - _0x599d15));
    } else {
      _0x3b5929.fillStyle = "#b6db66";
      _0x3b5929.fillRect(0, 0, _0x3d89ad, _0x4ee004.mapScale - _0x4ee004.snowBiomeTop - _0x599d15);
      _0x3b5929.fillStyle = "#dbc666";
      _0x3b5929.fillRect(0, _0x4ee004.mapScale - _0x4ee004.snowBiomeTop - _0x599d15, _0x3d89ad, _0x47e786 - (_0x4ee004.mapScale - _0x4ee004.snowBiomeTop - _0x599d15));
    }
    if (!_0x434568) {
      _0x16c383 += _0x1a6e50 * _0x4ee004.waveSpeed * _0x4819c7;
      if (_0x16c383 >= _0x4ee004.waveMax) {
        _0x16c383 = _0x4ee004.waveMax;
        _0x1a6e50 = -1;
      } else if (_0x16c383 <= 1) {
        _0x16c383 = _0x1a6e50 = 1;
      }
      _0x3b5929.globalAlpha = 1;
      _0x3b5929.fillStyle = "#dbc666";
      _0x47e67f(_0x11bc43, _0x599d15, _0x3b5929, _0x4ee004.riverPadding);
      _0x3b5929.fillStyle = "#91b2db";
      _0x47e67f(_0x11bc43, _0x599d15, _0x3b5929, (_0x16c383 - 1) * 250);
    }
    _0x3b5929.globalAlpha = 1;
    _0x3b5929.strokeStyle = _0x2d70c1;
    _0x5cbdc2(_0x11bc43, _0x599d15);
    _0x3b5929.globalAlpha = 1;
    _0x3b5929.strokeStyle = _0x2d70c1;
    _0x2ea6ec(-1, _0x11bc43, _0x599d15);
    _0x3b5929.globalAlpha = 1;
    _0x3b5929.lineWidth = _0x438f6d;
    _0x4cc9d6(0, _0x11bc43, _0x599d15);
    _0x2e89d8(_0x11bc43, _0x599d15, 0);
    _0x3b5929.globalAlpha = 1;
    for (let _0x2fb480 = 0; _0x2fb480 < _0x201ec2.length; ++_0x2fb480) {
      _0x3a3fd7 = _0x201ec2[_0x2fb480];
      if (_0x3a3fd7.active && _0x3a3fd7.visible) {
        _0x3a3fd7.animate(_0x4819c7);
        _0x3b5929.save();
        _0x3b5929.translate(_0x3a3fd7.x - _0x11bc43, _0x3a3fd7.y - _0x599d15);
        _0x3b5929.rotate(_0x3a3fd7.dir + _0x3a3fd7.dirPlus - Math.PI / 2);
        _0x47f114(_0x3a3fd7, _0x3b5929);
        _0x3b5929.restore();
      }
    }
    _0x2ea6ec(0, _0x11bc43, _0x599d15);
    _0x4cc9d6(1, _0x11bc43, _0x599d15);
    _0x2ea6ec(1, _0x11bc43, _0x599d15);
    _0x2e89d8(_0x11bc43, _0x599d15, 1);
    _0x2ea6ec(2, _0x11bc43, _0x599d15);
    _0x2ea6ec(3, _0x11bc43, _0x599d15);
    _0x3b5929.fillStyle = "#000";
    _0x3b5929.globalAlpha = 0.09;
    if (_0x11bc43 <= 0) {
      _0x3b5929.fillRect(0, 0, -_0x11bc43, _0x47e786);
    }
    if (_0x4ee004.mapScale - _0x11bc43 <= _0x3d89ad) {
      let _0x5d53b5 = Math.max(0, -_0x599d15);
      _0x3b5929.fillRect(_0x4ee004.mapScale - _0x11bc43, _0x5d53b5, _0x3d89ad - (_0x4ee004.mapScale - _0x11bc43), _0x47e786 - _0x5d53b5);
    }
    if (_0x599d15 <= 0) {
      _0x3b5929.fillRect(-_0x11bc43, 0, _0x3d89ad + _0x11bc43, -_0x599d15);
    }
    if (_0x4ee004.mapScale - _0x599d15 <= _0x47e786) {
      let _0x18e015 = Math.max(0, -_0x11bc43);
      let _0x2c52f7 = 0;
      if (_0x4ee004.mapScale - _0x11bc43 <= _0x3d89ad) {
        _0x2c52f7 = _0x3d89ad - (_0x4ee004.mapScale - _0x11bc43);
      }
      _0x3b5929.fillRect(_0x18e015, _0x4ee004.mapScale - _0x599d15, _0x3d89ad - _0x18e015 - _0x2c52f7, _0x47e786 - (_0x4ee004.mapScale - _0x599d15));
    }
    _0x3b5929.globalAlpha = 1;
    _0x3b5929.fillStyle = "rgba(0, 5, 80, 0.55)";
    _0x3b5929.fillRect(0, 0, _0x3d89ad, _0x47e786);
    _0x3b5929.strokeStyle = _0x32af65;
    _0x3b5929.globalAlpha = 1;
    for (let _0x4d279d = 0; _0x4d279d < _0x3c40e0.length + _0x201ec2.length; ++_0x4d279d) {
      _0x3a3fd7 = _0x3c40e0[_0x4d279d] || _0x201ec2[_0x4d279d - _0x3c40e0.length];
      if (_0x3a3fd7.visible && _0x3a3fd7.showName === "NOOO") {
        _0x3b5929.strokeStyle = _0x32af65;
        let _0x4ef6b1 = (_0x3a3fd7.team ? "[" + _0x3a3fd7.team + "] " : "") + (_0x3a3fd7.name || "");
        if (_0x4ef6b1 != "" && _0x3a3fd7.name != "Trash Slave") {
          _0x3b5929.strokeStyle = _0x32af65;
          _0x3b5929.font = (_0x3a3fd7.nameScale || 30) + "px HammerSmith One";
          _0x3b5929.fillStyle = "#fff";
          _0x3b5929.textBaseline = "middle";
          _0x3b5929.textAlign = "center";
          _0x3b5929.lineWidth = _0x3a3fd7.nameScale ? 11 : 8;
          _0x3b5929.lineJoin = "round";
          _0x3b5929.strokeText(_0x4ef6b1, _0x3a3fd7.x - _0x11bc43, _0x3a3fd7.y - _0x599d15 - _0x3a3fd7.scale - _0x4ee004.nameY);
          _0x3b5929.fillText(_0x4ef6b1, _0x3a3fd7.x - _0x11bc43, _0x3a3fd7.y - _0x599d15 - _0x3a3fd7.scale - _0x4ee004.nameY);
          if (_0x3a3fd7.isLeader && _0x882c13.crown.isLoaded) {
            let _0x1168d2 = _0x4ee004.crownIconScale;
            let _0x5585c7 = _0x3a3fd7.x - _0x11bc43 - _0x1168d2 / 2 - _0x3b5929.measureText(_0x4ef6b1).width / 2 - _0x4ee004.crownPad;
            _0x3b5929.drawImage(_0x882c13.crown, _0x5585c7, _0x3a3fd7.y - _0x599d15 - _0x3a3fd7.scale - _0x4ee004.nameY - _0x1168d2 / 2 - 5, _0x1168d2, _0x1168d2);
          }
          if (_0x3a3fd7.iconIndex == 1 && _0x882c13.skull.isLoaded) {
            let _0x352900 = _0x4ee004.crownIconScale;
            let _0x444f88 = _0x3a3fd7.x - _0x11bc43 - _0x352900 / 2 + _0x3b5929.measureText(_0x4ef6b1).width / 2 + _0x4ee004.crownPad;
            _0x3b5929.drawImage(_0x882c13.skull, _0x444f88, _0x3a3fd7.y - _0x599d15 - _0x3a3fd7.scale - _0x4ee004.nameY - _0x352900 / 2 - 5, _0x352900, _0x352900);
          }
          if (_0x3a3fd7.isPlayer && _0x94d477.wait && _0x151041 == _0x3a3fd7 && _0x43cac5[1].isLoaded && _0x5b81e2.length && !_0x50abc3) {
            let _0x22f5ed = _0x3a3fd7.scale * 2.2;
            _0x3b5929.drawImage(_0x43cac5[1], _0x3a3fd7.x - _0x11bc43 - _0x22f5ed / 2, _0x3a3fd7.y - _0x599d15 - _0x22f5ed / 2, _0x22f5ed, _0x22f5ed);
          }
        }
        if (_0x3a3fd7.health > 0) {
          if (_0x3a3fd7.name != "Trash Slave") {
            _0x3b5929.fillStyle = _0x32af65;
            _0x3b5929.strokeStyle = "#333";
            _0x3b5929.lineWidth = 2;
            _0x3b5929.beginPath();
            _0x3b5929.roundRect(_0x3a3fd7.x - _0x11bc43 - _0x4ee004.healthBarWidth - _0x4ee004.healthBarPad, _0x3a3fd7.y - _0x599d15 + _0x3a3fd7.scale + _0x4ee004.nameY, _0x4ee004.healthBarWidth * 2 + _0x4ee004.healthBarPad * 2, 20, 10);
            _0x3b5929.stroke();
            _0x3b5929.fillStyle = "#1a1a1a";
            _0x3b5929.fill();
            const _0x4326da = _0x3a3fd7.health / _0x3a3fd7.maxHealth;
            const _0x58b55f = _0x4ee004.healthBarWidth * 2 * _0x4326da;
            const _0x471114 = _0x3b5929.createLinearGradient(_0x3a3fd7.x - _0x11bc43 - _0x4ee004.healthBarWidth, _0x3a3fd7.y - _0x599d15 + _0x3a3fd7.scale + _0x4ee004.nameY + _0x4ee004.healthBarPad, _0x3a3fd7.x - _0x11bc43 - _0x4ee004.healthBarWidth + _0x58b55f, _0x3a3fd7.y - _0x599d15 + _0x3a3fd7.scale + _0x4ee004.nameY + _0x4ee004.healthBarPad);
            _0x471114.addColorStop(0, "#cc5151");
            _0x471114.addColorStop(1, "#8ecc51");
            _0x3b5929.fillStyle = _0x471114;
            _0x3b5929.beginPath();
            _0x3b5929.roundRect(_0x3a3fd7.x - _0x11bc43 - _0x4ee004.healthBarWidth, _0x3a3fd7.y - _0x599d15 + _0x3a3fd7.scale + _0x4ee004.nameY + _0x4ee004.healthBarPad, _0x58b55f, 16 - _0x4ee004.healthBarPad * 2, 8);
            _0x3b5929.fill();
            _0x3b5929.fillStyle = "rgba(0, 0, 0, 0.3)";
            _0x3b5929.beginPath();
            _0x3b5929.roundRect(_0x3a3fd7.x - _0x11bc43 - _0x4ee004.healthBarWidth, _0x3a3fd7.y - _0x599d15 + _0x3a3fd7.scale + _0x4ee004.nameY + _0x4ee004.healthBarPad + 2, _0x58b55f, 16 - _0x4ee004.healthBarPad * 2, 8);
            _0x3b5929.fill();
          }
          if (_0x3a3fd7.isPlayer) {
            _0x3b5929.globalAlpha = 1;
            let _0x400607 = {
              primary: _0x3a3fd7.primaryIndex == undefined ? 1 : (_0x146f01.weapons[_0x3a3fd7.primaryIndex].speed - _0x3a3fd7.reloads[_0x3a3fd7.primaryIndex]) / _0x146f01.weapons[_0x3a3fd7.primaryIndex].speed,
              secondary: _0x3a3fd7.secondaryIndex == undefined ? 1 : (_0x146f01.weapons[_0x3a3fd7.secondaryIndex].speed - _0x3a3fd7.reloads[_0x3a3fd7.secondaryIndex]) / _0x146f01.weapons[_0x3a3fd7.secondaryIndex].speed,
              turret: (2500 - _0x3a3fd7.reloads[53]) / 2500
            };
            if (!_0x3a3fd7.currentReloads) {
              _0x3a3fd7.currentReloads = {
                primary: _0x400607.primary,
                secondary: _0x400607.secondary,
                turret: _0x400607.turret
              };
            }
            const _0xd2c8ce = 0.3;
            _0x3a3fd7.currentReloads.primary = (1 - _0xd2c8ce) * _0x3a3fd7.currentReloads.primary + _0xd2c8ce * _0x400607.primary;
            _0x3a3fd7.currentReloads.secondary = (1 - _0xd2c8ce) * _0x3a3fd7.currentReloads.secondary + _0xd2c8ce * _0x400607.secondary;
            _0x3a3fd7.currentReloads.turret = (1 - _0xd2c8ce) * _0x3a3fd7.currentReloads.turret + _0xd2c8ce * _0x400607.turret;
            let _0x4625a8 = _0x3a3fd7.primaryIndex !== undefined ? (_0x146f01.weapons[_0x3a3fd7.primaryIndex].speed - _0x3a3fd7.reloads[_0x3a3fd7.primaryIndex]) / _0x146f01.weapons[_0x3a3fd7.primaryIndex].speed : 1;
            let _0x1a3bea = _0x3a3fd7.secondaryIndex !== undefined ? (_0x146f01.weapons[_0x3a3fd7.secondaryIndex].speed - _0x3a3fd7.reloads[_0x3a3fd7.secondaryIndex]) / _0x146f01.weapons[_0x3a3fd7.secondaryIndex].speed : 1;
            const _0x2a5a1a = _0x3a3fd7.x - _0x11bc43;
            const _0x6731c5 = _0x3a3fd7.y - _0x599d15;
            const _0x424da0 = 35;
            const _0x185ea7 = 15;
            const _0x4dab8f = Math.PI * 2 / 3;
            const _0xbc6115 = -Math.PI / 2 + Math.PI / 3 + _0x3a3fd7.dir - Math.PI / 2;
            const _0x33c276 = _0xbc6115 + _0x4dab8f * _0x3a3fd7.currentReloads.secondary;
            const _0x276f3c = Math.PI / 2 + _0x3a3fd7.dir - Math.PI / 2;
            const _0x42e367 = _0x276f3c + _0x4dab8f * _0x3a3fd7.currentReloads.primary;
            const _0x3fa687 = Math.PI + Math.PI / 4.5 + _0x3a3fd7.dir - Math.PI / 2;
            const _0x35c764 = _0x3fa687 + _0x4dab8f / 1.25 * _0x3a3fd7.currentReloads.turret;
            function _0x2c919f(_0x587ac3) {
              return "#d6d6d6";
            }
            _0x3b5929.save();
            if (_0x3a3fd7.currentReloads.primary < 0.999) {
              _0x3b5929.beginPath();
              _0x3b5929.lineCap = "";
              _0x3b5929.arc;
              _0x3b5929.lineWidth = 4;
              _0x3b5929.strokeStyle;
              _0x3b5929.stroke();
            }
            if (_0x3a3fd7.currentReloads.secondary < 0.999) {
              _0x3b5929.beginPath();
              _0x3b5929.lineCap = "";
              _0x3b5929.arc;
              _0x3b5929.lineWidth = 4;
              _0x3b5929.strokeStyle;
              _0x3b5929.stroke();
            }
            if (_0x3a3fd7.currentReloads.turret < 0.999) {
              _0x3b5929.beginPath();
              _0x3b5929.lineCap = "";
              _0x3b5929.arc;
              _0x3b5929.lineWidth = 4;
              _0x3b5929.strokeStyle;
              _0x3b5929.stroke();
            }
            _0x3b5929.restore();
            if (_0x3a3fd7.name != "unknown") {
              _0x3b5929.globalAlpha = 1;
              _0x3b5929.font = "24px Arial";
              _0x3b5929.fillStyle = "#FFFFFF";
              _0x3b5929.strokeStyle = "#000000";
              _0x3b5929.textBaseline = "middle";
              _0x3b5929.textAlign = "center";
              _0x3b5929.lineWidth = 6;
              _0x3b5929.lineJoin = "round";
              _0x3b5929.shadowColor = "rgba(0, 0, 0, 0.5)";
              _0x3b5929.shadowBlur = 4;
              _0x3b5929.shadowOffsetX = 2;
              _0x3b5929.shadowOffsetY = 2;
              let _0x214bd9 = _0x4ee004.crownIconScale;
              let _0x354f53 = _0x3a3fd7.x - _0x11bc43 - _0x214bd9 / 2 + _0x4ee004.crownPad - 2;
              let _0x300ee1 = "[" + (_0x3a3fd7.skinIndex == 45 && _0x3a3fd7.shameTimer > 0 ? _0x3a3fd7.shameTimer : _0x3a3fd7.shameCount) + "]";
              let _0x292df4 = _0x3a3fd7.y - _0x599d15 - _0x3a3fd7.scale - _0x4ee004.nameY + 175;
              _0x3b5929.strokeText(_0x300ee1, _0x354f53, _0x292df4);
              _0x3b5929.fillText(_0x300ee1, _0x354f53, _0x292df4);
              _0x3b5929.shadowColor = "transparent";
              _0x3b5929.shadowBlur = 0;
              _0x3b5929.shadowOffsetX = 0;
              _0x3b5929.shadowOffsetY = 0;
            }
            if (!_0x3a3fd7.isTeam(_0x547655)) {
              let _0x19315b = {
                x: _0x3c4e85 / 2,
                y: _0x3e9fd6 / 2
              };
              let _0x20aed7 = Math.min(1, _0x1c7eec.getDistance(0, 0, _0x547655.x - _0x3a3fd7.x, (_0x547655.y - _0x3a3fd7.y) * (16 / 9)) * 100 / (_0x4ee004.maxScreenHeight / 2) / _0x19315b.y);
              let _0x14c9e7 = _0x19315b.y * _0x20aed7;
              let _0x2b9952 = _0x14c9e7 * Math.cos(_0x1c7eec.getDirect(_0x3a3fd7, _0x547655, 0, 0));
              let _0x5a6ce9 = _0x14c9e7 * Math.sin(_0x1c7eec.getDirect(_0x3a3fd7, _0x547655, 0, 0));
              _0x3b5929.save();
              _0x3b5929.translate(_0x547655.x - _0x11bc43 + _0x2b9952, _0x547655.y - _0x599d15 + _0x5a6ce9);
              _0x3b5929.rotate(_0x3a3fd7.aim2 + Math.PI / 2);
              let _0x39b298 = 255 - _0x3a3fd7.sid * 2;
              _0x3b5929.fillStyle = "rgba(" + _0x39b298 + ", " + _0x39b298 + ", " + _0x39b298 + ", 0)";
              _0x3b5929.globalAlpha = 0;
              let _0x46fb1e = function (_0x3c9db2, _0x2d4b5d) {
                _0x2d4b5d = _0x2d4b5d || _0x3b5929;
                let _0x51b1ec = _0x3c9db2 * (Math.sqrt(3) / 2);
                _0x2d4b5d.beginPath();
                _0x2d4b5d.moveTo(0, -_0x51b1ec / 1.5);
                _0x2d4b5d.lineTo(-_0x3c9db2 / 2, _0x51b1ec / 2);
                _0x2d4b5d.lineTo(_0x3c9db2 / 2, _0x51b1ec / 2);
                _0x2d4b5d.lineTo(0, -_0x51b1ec / 1.5);
                _0x2d4b5d.fill();
                _0x2d4b5d.closePath();
              };
              _0x46fb1e(25, _0x3b5929);
              _0x3b5929.restore();
            }
            if (getEl("predictType").value == "pre2") {
              _0x3b5929.lineWidth = 3;
              _0x3b5929.strokeStyle = "rgba(204, 81, 81, 0)";
              _0x3b5929.globalAlpha = 0;
              _0x3b5929.beginPath();
              let _0x1e0928 = {
                x: _0x3a3fd7.x2 - _0x11bc43,
                y: _0x3a3fd7.y2 - _0x599d15
              };
              _0x3b5929.moveTo(_0x3a3fd7.x - _0x11bc43, _0x3a3fd7.y - _0x599d15);
              _0x3b5929.lineTo(_0x1e0928.x, _0x1e0928.y);
              _0x3b5929.stroke();
            } else if (getEl("predictType").value == "pre3") {
              _0x3b5929.lineWidth = 3;
              _0x3b5929.strokeStyle = "rgba(204, 81, 81, 0)";
              _0x3b5929.globalAlpha = 0;
              _0x3b5929.beginPath();
              let _0x2a5531 = {
                x: _0x3a3fd7.x3 - _0x11bc43,
                y: _0x3a3fd7.y3 - _0x599d15
              };
              _0x3b5929.moveTo(_0x3a3fd7.x - _0x11bc43, _0x3a3fd7.y - _0x599d15);
              _0x3b5929.lineTo(_0x2a5531.x, _0x2a5531.y);
              _0x3b5929.stroke();
            }
          }
        }
      }
    }
    if (_0x547655) {}
    if (_0xfd6795.autoPush) {
      _0x3b5929.lineWidth = 2;
      _0x3b5929.globalAlpha = 1;
      _0x3b5929.lineJoin = "round";
      _0x3b5929.lineCap = "round";
      const _0x2e45a2 = 12;
      const _0x5ce6f6 = 20;
      const _0x405ede = _0x547655.x2 - _0x11bc43;
      const _0x4f0f42 = _0x547655.y2 - _0x599d15;
      const _0x3d198c = _0x151041.x2 - _0x11bc43;
      const _0xcb9ed = _0x151041.y2 - _0x599d15;
      const _0x15dd33 = _0xfd6795.pushData.x - _0x11bc43;
      const _0x409707 = _0xfd6795.pushData.y - _0x599d15;
      const _0x5a0509 = _0x3b5929.createLinearGradient(_0x405ede, _0x4f0f42, _0x3d198c, _0xcb9ed);
      _0x5a0509.addColorStop(0, "rgba(100, 100, 100, 0.7)");
      _0x5a0509.addColorStop(1, "rgba(200, 200, 200, 0.7)");
      _0x3b5929.strokeStyle = _0x5a0509;
      _0x3b5929.beginPath();
      _0x3b5929.moveTo(_0x405ede, _0x4f0f42);
      _0x3b5929.lineTo(_0x3d198c, _0xcb9ed);
      _0x3b5929.stroke();
      const _0x257fd2 = _0x3b5929.createLinearGradient(_0x3d198c, _0xcb9ed, _0x15dd33, _0x409707);
      _0x257fd2.addColorStop(0, "rgba(200, 200, 200, 0.7)");
      _0x257fd2.addColorStop(1, "rgba(100, 100, 100, 0.7)");
      _0x3b5929.strokeStyle = _0x257fd2;
      _0x3b5929.beginPath();
      _0x3b5929.moveTo(_0x3d198c, _0xcb9ed);
      _0x3b5929.lineTo(_0x15dd33, _0x409707);
      _0x3b5929.stroke();
      _0x3b5929.beginPath();
      _0x3b5929.arc(_0x405ede, _0x4f0f42, _0x2e45a2, 0, Math.PI * 2);
      _0x3b5929.fillStyle = "green";
      _0x3b5929.fill();
      _0x3b5929.lineWidth = 2;
      _0x3b5929.strokeStyle = "darkgreen";
      _0x3b5929.stroke();
      _0x3b5929.beginPath();
      _0x3b5929.arc(_0x3d198c, _0xcb9ed, _0x2e45a2, 0, Math.PI * 2);
      _0x3b5929.fillStyle = "red";
      _0x3b5929.fill();
      _0x3b5929.lineWidth = 2;
      _0x3b5929.strokeStyle = "darkred";
      _0x3b5929.stroke();
      _0x3b5929.beginPath();
      _0x3b5929.arc(_0x15dd33, _0x409707, _0x2e45a2, 0, Math.PI * 2);
      _0x3b5929.fillStyle = "blue";
      _0x3b5929.fill();
      _0x3b5929.lineWidth = 2;
      _0x3b5929.strokeStyle = "darkblue";
      _0x3b5929.stroke();
      _0x3b5929.font = "bold 18px Arial";
      _0x3b5929.textAlign = "center";
      _0x3b5929.textBaseline = "middle";
      _0x3b5929.shadowColor = "rgba(0, 0, 0, 0.5)";
      _0x3b5929.shadowBlur = 5;
      _0x3b5929.fillStyle = "green";
      _0x3b5929.fillText("Me", _0x405ede, _0x4f0f42 - _0x2e45a2 - _0x5ce6f6);
      _0x3b5929.fillStyle = "red";
      _0x3b5929.fillText("Enemy", _0x3d198c, _0xcb9ed - _0x2e45a2 - _0x5ce6f6);
      _0x3b5929.fillStyle = "blue";
      _0x3b5929.fillText("Spike", _0x15dd33, _0x409707 - _0x2e45a2 - _0x5ce6f6);
      _0x3b5929.shadowColor = "transparent";
    }
    const _0x4a6972 = "#ffcc00";
    _0x443fcc.update(_0x4819c7, _0x3b5929, _0x11bc43, _0x599d15);
    _0x3c40e0.forEach(_0x1ded30 => {
      if (_0x1ded30.visible) {
        if (_0x1ded30.chatCountdown > 0) {
          _0x1ded30.chatCountdown -= _0x4819c7;
          if (_0x1ded30.chatCountdown <= 0) {
            _0x1ded30.chatCountdown = 0;
          }
          _0x3b5929.font = "32px 'Exo', sans-serif";
          const _0x311d21 = _0x3b5929.measureText(_0x1ded30.chatMessage);
          const _0x2a1ccb = _0x1ded30.x - _0x11bc43;
          const _0x21a17a = _0x1ded30.y - _0x1ded30.scale - _0x599d15 - 90;
          const _0x6fe757 = 50;
          const _0x231fbf = _0x311d21.width + 20;
          _0x3b5929.fillStyle = "rgba(0, 0, 0, 0.6)";
          _0x3b5929.roundRect(_0x2a1ccb - _0x231fbf / 2, _0x21a17a - _0x6fe757 / 2, _0x231fbf, _0x6fe757, 8);
          _0x3b5929.fill();
          _0x3b5929.fillStyle = "#fff";
          _0x3b5929.shadowColor = "#000";
          _0x3b5929.shadowBlur = 10;
          _0x3b5929.fillText(_0x1ded30.chatMessage, _0x2a1ccb, _0x21a17a);
          _0x3b5929.shadowBlur = 0;
        }
        if (_0x1ded30.chat.count > 0) {
          if (!_0x50abc3) {
            _0x1ded30.chat.count -= _0x4819c7;
            if (_0x1ded30.chat.count <= 0) {
              _0x1ded30.chat.count = 0;
            }
            _0x3b5929.font = "32px 'Exo', sans-serif";
            const _0x546516 = _0x3b5929.measureText(_0x1ded30.chat.message);
            const _0x453f65 = _0x1ded30.x - _0x11bc43;
            const _0x5a4fc2 = _0x1ded30.y - _0x1ded30.scale - _0x599d15 + 180;
            const _0x36bacd = 50;
            const _0x2ff633 = _0x546516.width + 20;
            _0x3b5929.fillStyle = "rgba(0, 0, 0, 0.6)";
            _0x3b5929.roundRect(_0x453f65 - _0x2ff633 / 2, _0x5a4fc2 - _0x36bacd / 2, _0x2ff633, _0x36bacd, 8);
            _0x3b5929.fill();
            _0x3b5929.fillStyle = "#ffffffcc";
            _0x3b5929.shadowColor = "#000";
            _0x3b5929.shadowBlur = 10;
            _0x3b5929.fillText(_0x1ded30.chat.message, _0x453f65, _0x5a4fc2);
            _0x3b5929.shadowBlur = 0;
            _0x3b5929.strokeStyle = _0x4a6972;
            _0x3b5929.lineWidth = 3;
            _0x3b5929.roundRect(_0x453f65 - _0x2ff633 / 2, _0x5a4fc2 - _0x36bacd / 2, _0x2ff633, _0x36bacd, 8);
            _0x3b5929.stroke();
          } else {
            _0x1ded30.chat.count = 0;
          }
        }
      }
    });
    _0x17122a.filter(_0x5c0a1c => _0x5c0a1c.active).forEach(_0xca63c0 => {
      if (!_0xca63c0.alive) {
        if (_0xca63c0.alpha <= 1) {
          _0xca63c0.alpha += _0x4819c7 / 250;
          if (_0xca63c0.alpha >= 1) {
            _0xca63c0.alpha = 1;
            _0xca63c0.alive = true;
          }
        }
      } else {
        _0xca63c0.alpha -= _0x4819c7 / 5000;
        if (_0xca63c0.alpha <= 0) {
          _0xca63c0.alpha = 0;
          _0xca63c0.active = false;
        }
      }
      if (_0xca63c0.active) {
        _0x3b5929.font = "20px 'Exo', sans-serif";
        const _0xe04fa2 = _0x3b5929.measureText(_0xca63c0.chat);
        const _0xe39a1e = _0xca63c0.x - _0x11bc43;
        const _0x4fef6f = _0xca63c0.y - _0x599d15 - 90;
        const _0x5f1296 = 40;
        const _0x5eca95 = _0xe04fa2.width + 20;
        _0x3b5929.globalAlpha = _0xca63c0.alpha;
        _0x3b5929.fillStyle = _0xca63c0.owner.isTeam(_0x547655) ? "#8ecc51" : "#cc5151";
        _0x3b5929.strokeStyle = "#000";
        _0x3b5929.lineWidth = 2;
        _0x3b5929.strokeText(_0xca63c0.owner.name, _0xe39a1e, _0x4fef6f - 45);
        _0x3b5929.fillText(_0xca63c0.owner.name, _0xe39a1e, _0x4fef6f - 45);
        _0x3b5929.fillStyle = "#333";
        _0x3b5929.strokeStyle = _0x4a6972;
        _0x3b5929.lineWidth = 3;
        _0x3b5929.roundRect(_0xe39a1e - _0x5eca95 / 2, _0x4fef6f - _0x5f1296 / 2, _0x5eca95, _0x5f1296, 8);
        _0x3b5929.stroke();
        _0x3b5929.fill();
        _0x3b5929.fillStyle = "#fff";
        _0x3b5929.strokeStyle = "#000";
        _0x3b5929.strokeText(_0xca63c0.chat, _0xe39a1e, _0x4fef6f);
        _0x3b5929.fillText(_0xca63c0.chat, _0xe39a1e, _0x4fef6f);
        _0xca63c0.y -= _0x4819c7 / 100;
      }
    });
    _0x3b5929.globalAlpha = 1;
    _0x533a44(_0x4819c7);
  }
  window.requestAnimFrame = function () {
    return null;
  };
  window.rAF = function () {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function (_0x5e3eb2) {
      window.setTimeout(_0x5e3eb2, 1000 / 9);
    };
  }();
  function _0x44c79c() {
    _0x24c027 = performance.now();
    _0x4819c7 = _0x24c027 - _0x3336fe;
    _0x3336fe = _0x24c027;
    let _0x2baecc = performance.now();
    let _0x1ceb3f = _0x2baecc - _0x49984a.last;
    if (_0x1ceb3f >= 1000) {
      _0x49984a.ltime = _0x49984a.time * (1000 / _0x1ceb3f);
      _0x49984a.last = _0x2baecc;
      _0x49984a.time = 0;
    }
    _0x49984a.time++;
    _0x3ba26d();
    rAF(_0x44c79c);
    _0x22e55e.avg = Math.round((_0x22e55e.min + _0x22e55e.max) / 2);
  }
  _0x3dbb87();
  _0x44c79c();
  function _0x1bd9ad(_0x4cec73) {
    getEl("instaType").disabled = _0x4cec73;
    getEl("antiBullType").disabled = _0x4cec73;
    getEl("predictType").disabled = _0x4cec73;
  }
  _0x1bd9ad(_0x50abc3);
  let _0x25fce0 = {};
  window.debug = function () {
    _0xfd6795.waitHit = 0;
    _0xfd6795.autoAim = false;
    _0x94d477.isTrue = false;
    _0x4319f3.inTrap = false;
    _0x31e236 = [];
    _0x1a50c8 = [];
    _0x286718 = [];
  };
  window.wasdMode = function () {
    _0x50abc3 = !_0x50abc3;
    _0x1bd9ad(_0x50abc3);
  };
  window.startGrind = function () {
    if (getEl("weaponGrind").checked) {
      for (let _0x269e40 = 0; _0x269e40 < Math.PI * 2; _0x269e40 += Math.PI / 2) {
        _0x21e105(_0x547655.getItemType(22), _0x269e40);
      }
    }
  };
  let _0x6fee6e = ["adorable-eight-guppy", "galvanized-bittersweet-windshield"];
  let _0xecb2a1 = 0;
  window.connectFillBots = function () {
    _0x393461 = [];
    _0xecb2a1 = 0;
    for (let _0x408692 = 0; _0x408692 < _0x6fee6e.length; _0x408692++) {
      let _0x215a71 = new WebSocket("wss://" + _0x6fee6e[_0x408692] + ".glitch.me");
      _0x215a71.binaryType = "arraybuffer";
      _0x215a71.onopen = function () {
        _0x215a71.ssend = function (_0x2d5c21) {
          let _0x3fe80e = Array.prototype.slice.call(arguments, 1);
          let _0x3c13e9 = window.msgpack.encode([_0x2d5c21, _0x3fe80e]);
          _0x215a71.send(_0x3c13e9);
        };
        for (let _0x2e55e1 = 0; _0x2e55e1 < 4; _0x2e55e1++) {
          window.grecaptcha.execute("6LfahtgjAAAAAF8SkpjyeYMcxMdxIaQeh-VoPATP", {
            action: "homepage"
          }).then(function (_0x4f1b8c) {
            let _0x330089 = _0x810ea2.url.split("wss://")[1].split("?")[0];
            _0x215a71.ssend("bots", "wss://" + _0x330089 + "?token=re:" + encodeURIComponent(_0x4f1b8c), _0xecb2a1);
            _0x393461.push([_0x215a71]);
            _0xecb2a1++;
          });
        }
      };
      _0x215a71.onmessage = function (_0x5f26dd) {
        let _0x31daa2 = new Uint8Array(_0x5f26dd.data);
        let _0x6bcbd0 = window.msgpack.decode(_0x31daa2);
        let _0x980e12 = _0x6bcbd0[0];
        _0x31daa2 = _0x6bcbd0[1];
      };
    }
  };
  window.destroyFillBots = function () {
    _0x393461.forEach(_0x2b522e => {
      _0x2b522e[0].close();
    });
    _0x393461 = [];
  };
  window.tryConnectBots = function () {
    for (let _0x5801f1 = 0; _0x5801f1 < (_0x311ef8.length < 3 ? 3 : 4); _0x5801f1++) {
      window.grecaptcha.execute("6LfahtgjAAAAAF8SkpjyeYMcxMdxIaQeh-VoPATP", {
        action: "homepage"
      }).then(function (_0xfa0784) {
        _0x53b69a(_0xfa0784);
      });
    }
  };
  window.destroyBots = function () {
    _0x311ef8.forEach(_0x5b3c73 => {
      _0x5b3c73.closeSocket = true;
    });
    _0x311ef8 = [];
  };
  window.resBuild = function () {
    if (_0x4e7d72.length) {
      _0x4e7d72.forEach(_0x43a5d2 => {
        _0x43a5d2.breakObj = false;
      });
      _0x46c306 = [];
    }
  };
  window.toggleBotsCircle = function () {
    _0x547655.circle = !_0x547655.circle;
  };
  window.toggleVisual = function () {
    _0x4ee004.anotherVisual = !_0x4ee004.anotherVisual;
    _0x4e7d72.forEach(_0x2b4534 => {
      if (_0x2b4534.active) {
        _0x2b4534.dir = _0x2b4534.lastDir;
      }
    });
  };
  window.prepareUI = function (_0x163065) {
    _0x2b4572();
    var _0x4d18c6 = document.getElementById("chatBox");
    var _0x581c44 = document.getElementById("chatHolder");
    var _0x262d55 = document.createElement("div");
    _0x262d55.id = "suggestBox";
    var _0x3043b8 = [];
    var _0x5c28c9 = 0;
    function _0x34b979() {
      if (!_0x4ea428) {
        if (_0x581c44.style.display == "block") {
          if (_0x4d18c6.value) {
            _0x1982a2(_0x4d18c6.value);
          }
          _0x493b61();
        } else {
          _0x479724.style.display = "none";
          _0x436875.style.display = "none";
          _0x581c44.style.display = "block";
          _0x4d18c6.focus();
          _0x301c5d();
        }
      } else {
        setTimeout(function () {
          var _0x12b704 = prompt("chat message");
          if (_0x12b704) {
            _0x1982a2(_0x12b704);
          }
        }, 1);
      }
      _0x4d18c6.value = "";
      (() => {
        _0x5c28c9 = 0;
      })();
    }
    function _0x493b61() {
      _0x4d18c6.value = "";
      _0x581c44.style.display = "none";
    }
    _0x1c7eec.removeAllChildren(_0x318ea5);
    for (let _0x1fdd09 = 0; _0x1fdd09 < _0x146f01.weapons.length + _0x146f01.list.length; ++_0x1fdd09) {
      (function (_0xc48a54) {
        _0x1c7eec.generateElement({
          id: "actionBarItem" + _0xc48a54,
          class: "actionBarItem",
          style: "display:none; box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.5)",
          onmouseout: function () {
            _0x3f4e7d();
          },
          parent: _0x318ea5
        });
      })(_0x1fdd09);
    }
    for (let _0x37df47 = 0; _0x37df47 < _0x146f01.list.length + _0x146f01.weapons.length; ++_0x37df47) {
      (function (_0x53e3e2) {
        let _0x5e6c7e = document.createElement("canvas");
        _0x5e6c7e.width = _0x5e6c7e.height = 66;
        let _0x3b3111 = _0x5e6c7e.getContext("2d");
        _0x3b3111.translate(_0x5e6c7e.width / 2, _0x5e6c7e.height / 2);
        _0x3b3111.imageSmoothingEnabled = false;
        _0x3b3111.webkitImageSmoothingEnabled = false;
        _0x3b3111.mozImageSmoothingEnabled = false;
        if (_0x146f01.weapons[_0x53e3e2]) {
          _0x3b3111.rotate(Math.PI);
          let _0x27f285 = new Image();
          _0x472414[_0x146f01.weapons[_0x53e3e2].src] = _0x27f285;
          _0x27f285.onload = function () {
            this.isLoaded = true;
            let _0x4609ce = 1 / (this.height / this.width);
            let _0x3f4307 = _0x146f01.weapons[_0x53e3e2].iPad || 1;
            _0x3b3111.drawImage(this, -(_0x5e6c7e.width * _0x3f4307 * _0x4ee004.iconPad * _0x4609ce) / 2, -(_0x5e6c7e.height * _0x3f4307 * _0x4ee004.iconPad) / 2, _0x5e6c7e.width * _0x3f4307 * _0x4609ce * _0x4ee004.iconPad, _0x5e6c7e.height * _0x3f4307 * _0x4ee004.iconPad);
            _0x3b3111.fillStyle = "rgba(0, 0, 70, 0.2)";
            _0x3b3111.globalCompositeOperation = "source-atop";
            _0x3b3111.fillRect(-_0x5e6c7e.width / 2, -_0x5e6c7e.height / 2, _0x5e6c7e.width, _0x5e6c7e.height);
            getEl("actionBarItem" + _0x53e3e2).style.backgroundImage = "url(" + _0x5e6c7e.toDataURL() + ")";
          };
          _0x27f285.src = "./../img/weapons/" + _0x146f01.weapons[_0x53e3e2].src + ".png";
          let _0x44f8fb = getEl("actionBarItem" + _0x53e3e2);
          _0x44f8fb.onclick = _0x1c7eec.checkTrusted(function () {
            _0x10e7fc(_0x163065.weapons[_0x146f01.weapons[_0x53e3e2].type]);
          });
          _0x1c7eec.hookTouchEvents(_0x44f8fb);
        } else {
          let _0x42ff68 = _0x5e1edc(_0x146f01.list[_0x53e3e2 - _0x146f01.weapons.length], true);
          let _0xb8f19b = Math.min(_0x5e6c7e.width - _0x4ee004.iconPadding, _0x42ff68.width);
          _0x3b3111.globalAlpha = 1;
          _0x3b3111.drawImage(_0x42ff68, -_0xb8f19b / 2, -_0xb8f19b / 2, _0xb8f19b, _0xb8f19b);
          _0x3b3111.fillStyle = "rgba(0, 0, 70, 0.1)";
          _0x3b3111.globalCompositeOperation = "source-atop";
          _0x3b3111.fillRect(-_0xb8f19b / 2, -_0xb8f19b / 2, _0xb8f19b, _0xb8f19b);
          getEl("actionBarItem" + _0x53e3e2).style.backgroundImage = "url(" + _0x5e6c7e.toDataURL() + ")";
          let _0x13d81c = getEl("actionBarItem" + _0x53e3e2);
          _0x13d81c.onclick = _0x1c7eec.checkTrusted(function () {
            _0x1c7944(_0x163065.items[_0x163065.getItemType(_0x53e3e2 - _0x146f01.weapons.length)]);
          });
          _0x1c7eec.hookTouchEvents(_0x13d81c);
        }
      })(_0x37df47);
    }
  };
  window.profineTest = function (_0xd0f5be) {
    if (_0xd0f5be) {
      let _0x454746 = _0xd0f5be + "";
      _0x454746 = _0x454746.slice(0, _0x4ee004.maxNameLength);
      return _0x454746;
    }
  };
})(1);
if (window.location.hostname.includes("moomoo.io") || window.location.hostname.includes("sandbox.moomoo.io") || window.location.hostname.includes("dev.moomoo.io")) {
  (() => {
    'use strict';

    const _0x4a4b15 = {
      PER_MINUTE: 1000,
      PER_SECOND: 80
    };
    const _0x1ad3d9 = new Set(["pp", "rmd"]);
    const _0x2c414b = new Set(["5", "c", "33", "2", "7", "13c"]);
    class _0x3fcdd9 {
      constructor() {
        this.resetRateLimit();
      }
      resetRateLimit() {
        this.packetHistory = new Map();
        this.packetQueue = [];
        this.lastSent = Date.now();
      }
      isRateLimited(_0x1cd72e) {
        const _0x102824 = new Uint8Array(_0x1cd72e);
        if (Date.now() - this.lastSent > _0x4a4b15.PER_MINUTE) {
          this.resetRateLimit();
        }
        const _0x4f806f = _0x102824[0];
        if (!_0x1ad3d9.has(_0x4f806f)) {
          if (this.packetHistory.has(_0x4f806f) && (_0x4f806f === "2" || _0x4f806f === "33") && this.packetHistory.get(_0x4f806f)[0] === _0x102824[1]) {
            return true;
          }
          if (this.packetQueue.length > _0x4a4b15.PER_SECOND) {
            return _0x2c414b.has(_0x4f806f) || this.packetQueue.push(_0x1cd72e);
          }
          this.packetQueue.push({
            type: _0x4f806f,
            data: _0x102824.slice(1)
          });
          this.packetHistory.set(_0x4f806f, _0x102824.slice(1));
        }
        return false;
      }
    }
    const _0x56daa2 = new _0x3fcdd9();
    WebSocket.prototype.send = new Proxy(WebSocket.prototype.send, {
      apply(_0x5ae057, _0x2e10b9, _0x5eac29) {
        if (!_0x2e10b9.messageListenerSet) {
          _0x2e10b9.addEventListener("message", _0x101b9d => {
            if (_0x56daa2.packetQueue.length) {
              const _0x208073 = new Uint8Array(_0x101b9d.data);
              if (_0x208073[0] === 51) {
                _0x2e10b9.send(_0x56daa2.packetQueue[0]);
                _0x56daa2.packetQueue.shift();
              }
            }
          });
          _0x2e10b9.messageListenerSet = true;
        }
        if (!_0x56daa2.isRateLimited(_0x5eac29)) {
          return Reflect.apply(_0x5ae057, _0x2e10b9, _0x5eac29);
        }
      }
    });
  })();
}
;
(async () => {
  unsafeWindow.weaponVariantProgress = true;
  document.addEventListener("DOMContentLoaded", () => {
    const _0x2c9dfa = document.createElement("style");
    _0x2c9dfa.innerText = "\n\t\t.weaponVariantBar {\n\t\t\tmargin-top: 63px;\n\t\t\theight: 3px;\n\t\t\tborder-radius: 4px;\n\t\t}\n\n\t\t@media only screen and (max-width: 896px) {\n\t\t\t.weaponVariantBar {\n\t\t\t\tmargin-top: 41px;\n\t\t\t}\n\t\t}\n\t\t";
    document.head.appendChild(_0x2c9dfa);
  });
  let _0x47d486 = false;
  let _0x5430f8;
  let _0xd395c8 = {};
  let _0xf975c5;
  let _0x3ac902 = {};
  let _0x1dac79 = {};
  let _0x3c8127 = 0;
  let _0x19b2f2 = 0;
  await new Promise(async _0x573065 => {
    let {
      send: _0x48384c
    } = WebSocket.prototype;
    WebSocket.prototype.send = function (..._0x2bba32) {
      _0x48384c.apply(this, _0x2bba32);
      this.send = _0x48384c;
      this.iosend = function (..._0x5071eb) {
        const [_0xa7510e, ..._0x247a57] = _0x5071eb;
        this.send(new Uint8Array(Array.from(msgpack.encode([_0xa7510e, _0x247a57]))));
      };
      if (!_0x47d486) {
        _0x47d486 = true;
        this.addEventListener("message", _0xdca6d => {
          if (!_0xdca6d.origin.includes("moomoo.io") && unsafeWindow.privateServer) {
            return;
          }
          const [_0x8870e9, _0x1d9302] = msgpack.decode(new Uint8Array(_0xdca6d.data));
          switch (_0x8870e9) {
            case OLDPACKETCODE.RECEIVE["1"]:
              _0x5430f8 = _0x1d9302[0];
              break;
            case OLDPACKETCODE.RECEIVE["2"]:
              if (_0x1d9302[1]) {
                _0xd395c8 = {};
                const _0x2d2d56 = localStorage.getItem("moofoll");
                _0x3ac902 = {
                  food: _0x2d2d56 ? 100 : 0,
                  stone: _0x2d2d56 ? 100 : 0,
                  wood: _0x2d2d56 ? 100 : 0,
                  points: _0x2d2d56 ? 100 : 0
                };
                for (let _0x291bd8 = 0; _0x291bd8 < 16; _0x291bd8++) {
                  _0x1c609e("#variantBar" + _0x291bd8).then(_0x39b7b1 => {
                    _0x39b7b1.style.width = "0%";
                  });
                }
              }
            case OLDPACKETCODE.RECEIVE["6"]:
              for (var _0x292609 = 0; _0x292609 < _0x1d9302[0].length; _0x292609 += 8) {
                if (_0x1d9302[0][_0x292609 + 7] === _0x5430f8) {
                  if (_0x1d9302[0][_0x292609 + 6] === 10) {
                    _0x3c8127 += 1;
                    _0x1dac79[_0x1d9302[0][_0x292609]] = 1;
                  } else if (_0x1d9302[0][_0x292609 + 6] === 11) {
                    _0x3c8127 += 1.5;
                    _0x1dac79[_0x1d9302[0][_0x292609]] = 1.5;
                  } else if (_0x1d9302[0][_0x292609 + 6] === 12) {
                    _0x3c8127 += 2;
                    _0x1dac79[_0x1d9302[0][_0x292609]] = 2;
                  }
                }
              }
              break;
            case OLDPACKETCODE.RECEIVE["12"]:
              if (_0x1dac79[_0x1d9302[0]] != null) {
                _0x3c8127 -= _0x1dac79[_0x1d9302[0]];
                delete _0x1dac79[_0x1d9302[0]];
              }
              break;
            case OLDPACKETCODE.RECEIVE["33"]:
              for (let _0x3091cd = 0; _0x3091cd < _0x1d9302[0].length; _0x3091cd += 13) {
                if (_0x1d9302[0][_0x3091cd] === _0x5430f8) {
                  _0xf975c5 = _0x1d9302[0][_0x3091cd + 5];
                  if (_0xd395c8[_0xf975c5] < unsafeWindow.config.weaponVariants[_0x1d9302[0][_0x3091cd + 6]].xp) {
                    _0xd395c8[_0xf975c5] = unsafeWindow.config.weaponVariants[_0x1d9302[0][_0x3091cd + 6]].xp;
                    _0x802449(_0xf975c5);
                  } else if (_0xd395c8[_0xf975c5] >= unsafeWindow.config.weaponVariants[_0x1d9302[0][_0x3091cd + 6] + 1]?.xp) {
                    _0xd395c8[_0xf975c5] -= _0xd395c8[_0xf975c5] - unsafeWindow.config.weaponVariants[_0x1d9302[0][_0x3091cd + 6] + 1].xp + 100;
                    _0x802449(_0xf975c5);
                  }
                  break;
                }
              }
              break;
            case OLDPACKETCODE.RECEIVE["9"]:
              if (_0x1d9302[0] === "kills") {
                break;
              }
              const _0x208d9f = _0xf975c5;
              if (_0xd395c8[_0x208d9f] == null) {
                _0xd395c8[_0x208d9f] = 0;
              }
              const _0x44ea4e = _0x1d9302[1] - _0x3ac902[_0x1d9302[0]];
              if (_0x44ea4e > 0) {
                if (_0x1d9302[0] === "points" && [Math.ceil(_0x3c8127), Math.floor(_0x3c8127)].includes(_0x44ea4e) && Date.now() - _0x19b2f2 > 800) {
                  _0x19b2f2 = Date.now();
                  _0x3ac902[_0x1d9302[0]] = _0x1d9302[1];
                  _0x802449(_0x208d9f);
                  break;
                } else if (_0x1d9302[0] === "points" && _0x44ea4e >= 100) {
                  _0x3ac902[_0x1d9302[0]] = _0x1d9302[1];
                  _0x802449(_0x208d9f);
                  break;
                }
                _0xd395c8[_0x208d9f] += _0x44ea4e;
              }
              _0x3ac902[_0x1d9302[0]] = _0x1d9302[1];
              _0x802449(_0x208d9f);
              break;
          }
        });
      }
      _0x573065(this);
    };
  });
  function _0x1c609e(_0x47a1c8) {
    return new Promise(_0x39f908 => {
      if (document.querySelector(_0x47a1c8)) {
        return _0x39f908(document.querySelector(_0x47a1c8));
      }
      const _0x4580dc = new MutationObserver(_0x5c829c => {
        if (document.querySelector(_0x47a1c8)) {
          _0x39f908(document.querySelector(_0x47a1c8));
          _0x4580dc.disconnect();
        }
      });
      _0x4580dc.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }
  for (let _0x6f90d = 0; _0x6f90d < 16; _0x6f90d++) {
    _0x1c609e("#actionBarItem" + _0x6f90d).then(_0x316707 => {
      const _0x23e797 = document.createElement("div");
      _0x23e797.id = "variantBar" + _0x6f90d;
      _0x23e797.className = "weaponVariantBar";
      _0x316707.appendChild(_0x23e797);
    });
  }
  function _0x802449(_0x310d0c) {
    let _0x5966f2;
    let _0x25902f;
    if (_0xd395c8[_0x310d0c] >= 12000) {
      _0x5966f2 = "none";
      _0x25902f = 0;
    } else if (_0xd395c8[_0x310d0c] >= 7000) {
      _0x5966f2 = "rgb(255, 113, 111)";
      _0x25902f = (_0xd395c8[_0x310d0c] - 7000) / 5000 * 100;
    } else if (_0xd395c8[_0x310d0c] >= 3000) {
      _0x5966f2 = "rgb(134, 181, 255)";
      _0x25902f = (_0xd395c8[_0x310d0c] - 3000) / 4000 * 100;
    } else if (_0xd395c8[_0x310d0c] >= 0) {
      _0x5966f2 = "rgb(247, 207, 69)";
      _0x25902f = _0xd395c8[_0x310d0c] / 3000 * 100;
    }
    document.getElementById("variantBar" + _0x310d0c).style.width = _0x25902f + "%";
    document.getElementById("variantBar" + _0x310d0c).style.backgroundColor = _0x5966f2;
  }
})();
(async () => {
  unsafeWindow.reloadTimer = true;
  let _0x33370f = [300, 400, 400, 300, 300, 700, 300, 100, 400, 600, 400, 0, 700, 230, 700, 1500];
  let _0x4fe3ea = ["hammer_1", "axe_1", "great_axe_1", "sword_1", "samurai_1", "spear_1", "bat_1", "dagger_1", "stick_1", "bow_1", "great_hammer_1", "shield_1", "crossbow_1", "crossbow_2", "grab_1", "musket_1"];
  var _0x1b7886;
  var _0x7e2681;
  var _0x599572 = false;
  var _0x45146b = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var _0x15f029;
  var _0x321773;
  var _0x20cc8c;
  const _0x10e0cb = document.createElement("div");
  _0x10e0cb.id = "reloadTimer1";
  _0x10e0cb.className = "resourceDisplay";
  _0x10e0cb.innerText = "0";
  const _0x5391fe = document.createElement("div");
  _0x5391fe.id = "reloadTimer2";
  _0x5391fe.className = "resourceDisplay";
  _0x5391fe.innerText = "-";
  await new Promise(async _0x376611 => {
    let {
      send: _0x1b7a51
    } = WebSocket.prototype;
    WebSocket.prototype.send = function (..._0x12ada7) {
      _0x1b7a51.apply(this, _0x12ada7);
      this.send = _0x1b7a51;
      this.addEventListener("message", _0x569c3c => {
        if (!_0x569c3c.origin.includes("moomoo.io") && unsafeWindow.privateServer) {
          return;
        }
        const [_0x3c1fb0, _0x517f26] = msgpack.decode(new Uint8Array(_0x569c3c.data));
        switch (_0x3c1fb0) {
          case OLDPACKETCODE.RECEIVE["1"]:
            _0x599572 = true;
            _0x7e2681 = _0x517f26[0];
            break;
          case OLDPACKETCODE.RECEIVE["11"]:
            _0x599572 = false;
            _0x45146b = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            break;
          case OLDPACKETCODE.RECEIVE["7"]:
            if (_0x517f26[0] == _0x7e2681) {
              _0x45146b[_0x517f26[2]] = _0x33370f[_0x517f26[2]];
            }
            break;
          case OLDPACKETCODE.RECEIVE["18"]:
            if ([1000, 1200, 1400].includes(_0x517f26[3])) {
              let _0x246f5f;
              switch (_0x517f26[5]) {
                case 0:
                  _0x246f5f = 9;
                  break;
                case 2:
                  _0x246f5f = 12;
                  break;
                case 3:
                  _0x246f5f = 13;
                  break;
                case 5:
                  _0x246f5f = 15;
                  break;
                default:
                  _0x246f5f = null;
              }
              let _0x58a88b = _0x517f26[0] - Math.cos(_0x517f26[2]) * 35;
              let _0x373592 = _0x517f26[1] - Math.sin(_0x517f26[2]) * 35;
              if (Math.sqrt((_0x58a88b -= _0x1b7886.x) * _0x58a88b + (_0x373592 -= _0x1b7886.y) * _0x373592) <= 70) {
                _0x45146b[_0x246f5f] = _0x33370f[_0x246f5f];
              }
            }
            break;
        }
      });
      _0x376611(this);
    };
  });
  function _0x3afef9() {
    _0x15f029 = Date.now();
    _0x321773 = _0x15f029 - _0x20cc8c;
    _0x20cc8c = _0x15f029;
    if (_0x599572 && _0x1b7886) {
      if (_0x1b7886.buildIndex == -1) {
        _0x45146b[_0x1b7886.weaponIndex] = Math.max(0, _0x45146b[_0x1b7886.weaponIndex] - _0x321773);
      }
      if (_0x1b7886.weapons[0] != null) {
        _0x10e0cb.style.backgroundImage = "url(../img/weapons/" + _0x4fe3ea[_0x1b7886.weapons[0]] + ".png)";
        _0x10e0cb.innerText = _0x45146b[_0x1b7886.weapons[0]];
      }
      if (_0x1b7886.weapons[1] != null) {
        _0x5391fe.style.backgroundImage = "url(../img/weapons/" + _0x4fe3ea[_0x1b7886.weapons[1]] + ".png)";
        _0x5391fe.style.backgroundColor = "rgba(0, 0, 0, 0.25)";
        _0x5391fe.innerText = _0x45146b[_0x1b7886.weapons[1]];
      } else {
        _0x5391fe.style.backgroundImage = null;
        _0x5391fe.style.backgroundColor = null;
        _0x5391fe.innerText = "-";
      }
    }
    unsafeWindow.requestAnimationFrame(_0x3afef9);
  }
  _0x20cc8c = Date.now();
  unsafeWindow.requestAnimationFrame(_0x3afef9);
  function _0x586337(_0x43e186) {
    return new Promise(_0x1f7159 => {
      if (document.querySelector(_0x43e186)) {
        return _0x1f7159(document.querySelector(_0x43e186));
      }
      const _0x5b8419 = new MutationObserver(_0x159488 => {
        if (document.querySelector(_0x43e186)) {
          _0x1f7159(document.querySelector(_0x43e186));
          _0x5b8419.disconnect();
        }
      });
      _0x5b8419.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }
  const _0x187eb6 = Symbol("minimapCounter");
  Object.defineProperty(Object.prototype, "minimapCounter", {
    get() {
      return this[_0x187eb6];
    },
    set(_0x271e64) {
      this[_0x187eb6] = _0x271e64;
      if (this.isPlayer === true && this.sid === _0x7e2681) {
        _0x1b7886 = this;
      }
    },
    configurable: true
  });
  _0x586337("#topInfoHolder").then(_0x473669 => {
    const _0xd1bf65 = document.createElement("style");
    _0xd1bf65.innerHTML = "\n        #reloadTimer1 {\n            right: 0px;\n            margin-top: 65px;\n            color: #fff;\n            font-size: 28px;\n            background-color: rgba(0, 0, 0, 0.25);\n            -webkit-border-radius: 4px;\n            -moz-border-radius: 4px;\n            border-radius: 4px;\n        }\n\n        #reloadTimer2 {\n            right: 0px;\n            margin-top: 120px;\n            color: #fff;\n            font-size: 28px;\n            -webkit-border-radius: 4px;\n            -moz-border-radius: 4px;\n            border-radius: 4px;\n        }\n        ";
    document.head.appendChild(_0xd1bf65);
    _0x473669.appendChild(_0x10e0cb);
    _0x473669.appendChild(_0x5391fe);
  });
})();
function findID(_0x5c69fd, _0x472f2e) {
  return _0x5c69fd.find(_0x447fa2 => _0x447fa2.id == _0x472f2e);
}
function findSID(_0x114185, _0xb124e2) {
  return _0x114185.find(_0x39791f => _0x39791f.sid == _0xb124e2);
}
function findPlayerByID(_0x15ad09) {
  return findID(players, _0x15ad09);
}
function findPlayerBySID(_0x3ad8f3) {
  return findSID(players, _0x3ad8f3);
}
function findAIBySID(_0x15bd89) {
  return findSID(ais, _0x15bd89);
}
function findObjectBySid(_0x4bb3f3) {
  return findSID(gameObjects, _0x4bb3f3);
}
function findProjectileBySid(_0x35e0e8) {
  return findSID(gameObjects, _0x35e0e8);
}
let gameName = getEl("gameName");
if (gameName) gameName.innerText = "!!";
let adCard = getEl("adCard");
if (adCard) adCard.remove();
let promoImageHolder = getEl("promoImgHolder");
if (promoImageHolder) promoImageHolder.remove();
let chatButton = getEl("chatButton");
if (chatButton) chatButton.remove();
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
getEl("mainMenu").style.backgroundImage = "url('https://tse4.mm.bing.net/th?id=OIP.hQgq0pUmX6a5BI7TXgmm7QHaEK&pid=Api&P=0&h=220')";
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
  39: [1, 0]
};
let attackState = 0;
let inGame = false;
let macro = {};
let lastDir;
let lastLeaderboardData = [];
let inWindow = true;
window.onblur = function () {
  inWindow = false;
};
window.onfocus = function () {
  inWindow = true;
  if (player && player.alive) {}
};
let ms = {
  avg: 0,
  max: 0,
  min: 0,
  delay: 0
};
function pingSocketResponse() {
  let _0x5a06a6 = window.pingTime;
  const _0x17eb94 = document.getElementById("pingDisplay");
  if (_0x17eb94) _0x17eb94.innerText = "Ping: " + _0x5a06a6 + " ms`";
  if (_0x5a06a6 > ms.max || isNaN(ms.max)) {
    ms.max = _0x5a06a6;
  }
  if (_0x5a06a6 < ms.min || isNaN(ms.min)) {
    ms.min = _0x5a06a6;
  }
}
let placeVisible = [];
(function () {
  'use strict';

  let _0x1a9936 = true;
  const _0x2d3333 = document.createElement("div");
  _0x2d3333.id = "music-menu";
  document.body.appendChild(_0x2d3333);
  const _0x418e63 = document.createElement("button");
  _0x418e63.textContent = "Biad";
  _0x2d3333.appendChild(_0x418e63);
  const _0x28d1bb = document.createElement("button");
  _0x28d1bb.textContent = "Falling";
  _0x2d3333.appendChild(_0x28d1bb);
  const _0x2100b9 = document.createElement("button");
  _0x2100b9.textContent = "Lonely_Way";
  _0x2d3333.appendChild(_0x2100b9);
  const _0x131e8e = document.createElement("button");
  _0x131e8e.textContent = "Rezz - Edge";
  _0x2d3333.appendChild(_0x131e8e);
  const _0x562adb = document.createElement("button");
  _0x562adb.textContent = "Fale Music";
  _0x2d3333.appendChild(_0x562adb);
  _0x418e63.addEventListener("click", () => {
    _0x22de31("https://cdn.discordapp.com/attachments/1016399895885795368/1087483201666174976/Burn_It_All_Down_ft._PVRIS_Worlds_2021_-_League_of_Legends.mp3");
  });
  _0x28d1bb.addEventListener("click", () => {
    _0x22de31("https://cdn.discordapp.com/attachments/1016399895885795368/1087483669217812510/Rival_-_Falling_with_CRVN__NCS_Release_.mp3");
  });
  _0x2100b9.addEventListener("click", () => {
    _0x22de31("https://cdn.discordapp.com/attachments/1016399895885795368/1087487659867385866/Rival_-_Lonely_Way_ft._Caravn__Official_Lyric_Video_.mp3");
  });
  _0x131e8e.addEventListener("click", () => {
    _0x22de31("https://cdn.discordapp.com/attachments/1016399895885795368/1087487963790843944/REZZ_-_Edge.mp3");
  });
  _0x562adb.addEventListener("click", () => {
    _0x22de31("music.mp3");
  });
  document.addEventListener("keydown", _0x3704aa => {
    if (_0x3704aa.key === "m") {
      _0x1a9936 = !_0x1a9936;
      if (_0x1a9936) {
        _0x2d3333.classList.add("slide-in");
        _0x2d3333.classList.remove("slide-out");
      } else {
        _0x2d3333.classList.remove("slide-in");
        _0x2d3333.classList.add("slide-out");
      }
    }
  });
  function _0x22de31(_0x281113) {
    const _0x37a688 = document.querySelector("#music");
    if (_0x37a688) {
      _0x37a688.pause();
      _0x37a688.remove();
    }
    const _0x473cc6 = document.createElement("audio");
    _0x473cc6.id = "music";
    _0x473cc6.src = _0x281113;
    _0x473cc6.loop = true;
    _0x473cc6.play();
    document.body.appendChild(_0x473cc6);
  }
  GM_addStyle("\n#music-menu {\nposition: fixed;\ntop: 20px;\nleft: 20px;\nbackground-color: #1c1c1c;\ncolor: #fff;\nborder: 2px solid #7f7f7f;\npadding: 20px;\ndisplay: block;\nz-index: 999;\nborder-radius: 10px;\nbox-shadow: 0px 0px 20px #7f7f7f;\nopacity: 0;\ntransition: opacity 0.5s, transform 0.5s;\ntransform: translateY(-100%);\nfont-family: 'Helvetica Neue', sans-serif;\nfont-size: 20px;\n}\n           #music-menu.slide-in {\n        opacity: 1;\n        transform: translateY(0);\n    }\n\n    #music-menu.slide-out {\n        opacity: 0;\n        transform: translateY(-100%);\n    }\n\n    #music-menu h2 {\n        margin: 0 0 20px;\n        font-size: 24px;\n        text-align: center;\n        text-shadow: 2px 2px 5px rgba(0,0,0,0.5);\n    }\n\n    #music-menu button {\n        display: block;\n        margin: 20px auto;\n        background-color: #1abc9c;\n        color: #fff;\n        border: none;\n        padding: 10px;\n        border-radius: 5px;\n        cursor: pointer;\n        transition: background-color 0.3s;\n        text-shadow: 2px 2px 5px rgba(0,0,0,0.5);\n    }\n\n    #music-menu button:hover {\n        background-color: #16a085;\n    }\n");
})();
let PrePlaceCount;
let nameColor = "#ffffff";
let enemyNameColor = "#ffffff";
let reloadBarColor = "";
let healthBarColor = "";
let shameBarColor = "";
let enemyHealthBarColor = "#782F44";
let damageTextColor = "#782F44";
let healTextColor = "#60478D";
let myObjectHealth = "";
let enemyObjectHealth = "#ff6363";
let autoPushLine = "#ffffff";
document.addEventListener("keydown", function (_0x1ad05c) {
  if (_0x1ad05c.keyCode === 9) {
    const _0x305634 = document.getElementById("menuChatDiv");
    if (_0x305634) {
      const _0x13ef43 = _0x305634.style.display;
      if (_0x305634) _0x305634.style.display = _0x13ef43 === "none" ? "block" : "none";
    }
  }
  if (_0x1ad05c.keyCode === 192) {
    const _0x38ed54 = document.getElementById("gameUI");
    if (_0x38ed54) {
      const _0xf39bb0 = _0x38ed54.style.display;
      if (_0x38ed54) _0x38ed54.style.display = _0xf39bb0 === "none" ? "block" : "none";
    }
  }
  if (_0x1ad05c.keyCode === 99) {
    const _0x74c653 = document.getElementById("gameCanvas");
    if (_0x74c653) {
      const _0x1c227a = _0x74c653.style.display;
      if (_0x74c653) _0x74c653.style.display = _0x1c227a === "none" ? "block" : "none";
    }
  }
});
function getRandomRGBColor() {
  const _0x10dc29 = Math.floor(Math.random() * 256);
  const _0x54a9d8 = Math.floor(Math.random() * 256);
  const _0x363b72 = Math.floor(Math.random() * 256);
  return "rgb(" + _0x10dc29 + ", " + _0x54a9d8 + ", " + _0x363b72 + ")";
}
function getRandomBrightRGBColor() {
  const _0x3ea0f3 = Math.floor(Math.random() * 128) + 128;
  const _0x40d172 = Math.floor(Math.random() * 128) + 128;
  const _0x154543 = Math.floor(Math.random() * 128) + 128;
  return "rgb(" + _0x3ea0f3 + ", " + _0x40d172 + ", " + _0x154543 + ")";
}
function getRandomRainbowishColor() {
  const _0x32e407 = Math.floor(Math.random() * 360);
  const _0x1a85d5 = "100%";
  const _0x17365a = "50%";
  return "hsl(" + _0x32e407 + ", " + _0x1a85d5 + ", " + _0x17365a + ")";
}
setInterval(() => window.follmoo && follmoo(), 10);
window.location.native_resolution = true;
var autoreloadloop;
var autoreloadenough = 0;
autoreloadloop = setInterval(function () {
  if (autoreloadenough < 200) {
    if (document.getElementById("loadingText").innerHTML == "disconnected<a href=\"javascript:window.location.href=window.location.href\" class=\"ytLink\">reload</a>") {
      document.title = "Reloading";
      clearInterval(autoreloadloop);
      setTimeout(function () {
        document.title = "Moo Moo";
      }, 1000);
      location.reload();
    }
    autoreloadenough++;
  } else if (autoreloadenough >= 300) {
    clearInterval(autoreloadloop);
    document.title = "Reloaded";
    setTimeout(function () {
      document.title = "Moo Moo";
    }, 1000);
  }
}, 50);
let useHack = true;
let log = console.log;
let testMode = window.location.hostname == "127.0.0.1";
let imueheua = false;
let circleScale = 1.5;
let namechanger = false;
let inantiantibull = false;
let spin = {
  degree: 45,
  toggle: false,
  angle: 0
};
function receiveChat(_0x2d1e16, _0x2ae79f) {
  if (/img/i.test(_0x2ae79f)) {
    return;
  }
  if (/iframe/i.test(_0x2ae79f)) {
    return;
  }
  if (/ZOV/i.test(_0x2ae79f)) {
    return;
  }
  let _0x968fb1 = false;
  let _0x19f8fa = findPlayerBySID(_0x2d1e16);
  addMenuChText($tmpPlayer.name)[$tmpPlayer.sid];
  _0x2ae79f;
  "white";
  _0x19f8fa.chatMessage = _0x2ae79f;
  _0x19f8fa.chatCountdown = config.chatCountdown;
}
document.addEventListener("keydown", function (e) {
  var typing = document.activeElement &&
      /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
  if (typing) return;
  if (e.keyCode == 68) {
    storeEquip(0, 1);
    setTimeout(() => {
      place(inv.boostPad);
      setTimeout(() => {
        weapon("secondary");
        storeEquip(53, 0);
        hit(true);
        setTimeout(() => {
          weapon("primary");
          storeEquip(7, 0);
          setTimeout(() => {
            storeEquip(6, 0);
            setTimeout(() => {
              hit(false);
              storeEquip(11, 1);
            }, 80);
          }, 255);
        }, 140);
      }, 1.5);
    }, 150);
  }
});

;
function receiveChat(_0x363828, _0x303e3c) {
  if (/img/i.test(_0x303e3c)) {
    return;
  }
  if (/iframe/i.test(_0x303e3c)) {
    return;
  }
  if (/ZOV/i.test(_0x303e3c)) {
    return;
  }
  let _0x4b7f36 = false;
  let _0x54ee48 = findPlayerBySID(_0x363828);
  addMenuChText($tmpPlayer.name[$tmpPlayer.sid], _0x303e3c, "white");
  _0x54ee48.chatMessage = _0x303e3c;
  _0x54ee48.chatCountdown = config.chatCountdown;
}
let biomemap = false;
let canvas = document.getElementById("gameCanvas");
let ctx = canvas.getContext("2d");
function map() {
  if (getEl("biomemap").checked) {
    ctx.beginPath();
    for (let _0x3371cd = 0; _0x3371cd <= 1; _0x3371cd++) {
      $("#mapDisplay").css({
        background: "url('https://i.imgur.com/fgFsQJp.png')"
      });
    }
  }
  window.requestAnimFrame(map);
}
map();
let keys1 = {};
addEventListener("keydown", function (_0x18ebec) {
  if (!keys[_0x18ebec.keyCode]) {
    keys[_0x18ebec.keyCode] = true;
    if (_0x18ebec.keyCode == 0) {
      biomemap = !biomemap;
    }
  }
});
window.addEventListener("keyup", function (_0x33832d) {
  keys[_0x33832d.keyCode] &&= false;
});
let pingdisplay = false;
let canvas2 = document.getElementById("gameCanvas");
let ctx2 = canvas2.getContext("2d");
function display() {
  if (getEl("pingdisplay").checked) {
    ctx.beginPath();
    for (let _0x357bdb = 0; _0x357bdb <= 1; _0x357bdb++) {
      let _0x3d3b63 = document.createElement("div");
      _0x3d3b63 = document.getElementById("pingDisplay");
      _0x3d3b63.style.top = "13px";
      _0x3d3b63.style.fontSize = "15px";
      _0x3d3b63.style.display = "block";
      _0x3d3b63.style.left = "730px";
      document.body.append(_0x3d3b63);
    }
  }
  window.requestAnimFrame(display);
}
display();
let keys2 = {};
addEventListener("keydown", function (_0x33fbf9) {
  if (!keys[_0x33fbf9.keyCode]) {
    keys[_0x33fbf9.keyCode] = true;
    if (_0x33fbf9.keyCode == 0) {
      pingdisplay = !pingdisplay;
    }
  }
});
window.addEventListener("keyup", function (_0x5bc977) {
  keys[_0x5bc977.keyCode] &&= false;
});
const localTexture = [{
  creationDate: 1539776483046,
  description: "",
  groupId: "",
  id: "Redirect_1539776483046",
  name: "Halloween",
  objectType: "rule",
  pairs: [{
    destination: "https://i.imgur.com/GB4qvv0.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_23.png"
    }
  }, {
    destination: "https://i.imgur.com/A3HllcC.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_46.png"
    }
  }, {
    destination: "https://i.imgur.com/IB4iBZm.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_10.png"
    }
  }, {
    destination: "https://i.imgur.com/ABHSOd9.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_48.png"
    }
  }, {
    destination: "https://i.imgur.com/cvb9q8g.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_4.png"
    }
  }, {
    destination: "https://i.imgur.com/gGGkBnz.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_27.png"
    }
  }, {
    destination: "https://i.imgur.com/GB4qvv0.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_23.png"
    }
  }, {
    destination: "https://i.imgur.com/A3HllcC.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_46.png"
    }
  }, {
    destination: "https://i.imgur.com/IB4iBZm.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_10.png"
    }
  }, {
    destination: "https://i.imgur.com/ABHSOd9.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_48.png"
    }
  }, {
    destination: "https://i.imgur.com/cvb9q8g.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_4.png"
    }
  }, {
    destination: "https://i.imgur.com/gGGkBnz.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_27.png"
    }
  }, {
    destination: "https://i.imgur.com/GB4qvv0.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_23.png"
    }
  }, {
    destination: "https://i.imgur.com/A3HllcC.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_46.png"
    }
  }, {
    destination: "https://i.imgur.com/IB4iBZm.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_10.png"
    }
  }, {
    destination: "https://i.imgur.com/ABHSOd9.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_48.png"
    }
  }, {
    destination: "https://i.imgur.com/cvb9q8g.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_4.png"
    }
  }, {
    destination: "https://i.imgur.com/gGGkBnz.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_27.png"
    }
  }, {
    destination: "https://i.imgur.com/GB4qvv0.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_23.png"
    }
  }, {
    destination: "https://i.imgur.com/A3HllcC.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_46.png"
    }
  }, {
    destination: "https://i.imgur.com/IB4iBZm.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_10.png"
    }
  }, {
    destination: "https://i.imgur.com/ABHSOd9.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_48.png"
    }
  }, {
    destination: "https://i.imgur.com/cvb9q8g.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_4.png"
    }
  }, {
    destination: "https://i.imgur.com/gGGkBnz.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_27.png"
    }
  }],
  ruleType: "Redirect",
  status: "Active"
}, {
  creationDate: 1537058120972,
  description: "",
  groupId: "",
  id: "Redirect_1537058120972",
  name: "Texture Pack Sandbox - Ruby",
  objectType: "rule",
  pairs: [{
    destination: "https://i.imgur.com/CDAmjux.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/dagger_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/UY7SV7j.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/spear_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/tmUzurk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/great_hammer_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/oRXUfW8.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/hammer_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/6ayjbIz.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/bat_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/vxLZW0S.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/samurai_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/UZ2HcQw.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/great_axe_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/kr8H9g7.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/axe_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/V9dzAbF.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/sword_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/aEs3FSU.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/stick_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/DRzBdFX.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/grab_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/7kbtWfk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/grab_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/wV42LEE.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/grab_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/CDAmjux.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/dagger_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/UY7SV7j.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/spear_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/tmUzurk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/great_hammer_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/oRXUfW8.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/hammer_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/6ayjbIz.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/bat_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/vxLZW0S.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/samurai_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/UZ2HcQw.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/great_axe_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/kr8H9g7.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/axe_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/V9dzAbF.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/sword_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/aEs3FSU.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/stick_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/DRzBdFX.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/grab_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/7kbtWfk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/grab_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/wV42LEE.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/grab_1_r.png"
    }
  }],
  ruleType: "Redirect",
  status: "Active"
}, {
  creationDate: 1537030341343,
  description: "",
  groupId: "",
  id: "Redirect_1537030341343",
  name: "Texture Pack Private - Ruby",
  objectType: "rule",
  pairs: [{
    destination: "https://i.imgur.com/CDAmjux.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/dagger_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/UY7SV7j.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/spear_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/tmUzurk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/great_hammer_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/oRXUfW8.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/hammer_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/6ayjbIz.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/bat_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/vxLZW0S.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/samurai_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/UZ2HcQw.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/great_axe_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/kr8H9g7.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/axe_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/V9dzAbF.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/sword_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/aEs3FSU.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/stick_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/DRzBdFX.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/grab_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/7kbtWfk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/grab_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/wV42LEE.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/grab_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/CDAmjux.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/dagger_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/UY7SV7j.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/spear_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/tmUzurk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/great_hammer_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/oRXUfW8.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/hammer_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/6ayjbIz.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/bat_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/vxLZW0S.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/samurai_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/UZ2HcQw.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/great_axe_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/kr8H9g7.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/axe_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/V9dzAbF.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/sword_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/aEs3FSU.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/stick_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/DRzBdFX.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/grab_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/7kbtWfk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/grab_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/wV42LEE.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/grab_1_r.png"
    }
  }],
  ruleType: "Redirect",
  status: "Active"
}, {
  creationDate: 1536927560373,
  description: "",
  groupId: "",
  id: "Redirect_1536927560373",
  name: "Texture Pack - Ruby",
  objectType: "rule",
  pairs: [{
    destination: "https://i.imgur.com/CDAmjux.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/dagger_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/UY7SV7j.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/spear_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/tmUzurk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/great_hammer_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/oRXUfW8.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/hammer_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/6ayjbIz.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/bat_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/vxLZW0S.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/samurai_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/UZ2HcQw.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/great_axe_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/kr8H9g7.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/axe_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/V9dzAbF.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/sword_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/aEs3FSU.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/stick_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/DRzBdFX.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/grab_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/7kbtWfk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/grab_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/wV42LEE.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/grab_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/CDAmjux.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/dagger_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/UY7SV7j.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/spear_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/tmUzurk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/great_hammer_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/oRXUfW8.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/hammer_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/6ayjbIz.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/bat_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/vxLZW0S.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/samurai_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/UZ2HcQw.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/great_axe_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/kr8H9g7.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/axe_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/V9dzAbF.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/sword_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/aEs3FSU.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/stick_1_r.png"
    }
  }, {
    destination: "https://i.imgur.com/DRzBdFX.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/grab_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/7kbtWfk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/grab_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/wV42LEE.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/grab_1_r.png"
    }
  }],
  ruleType: "Redirect",
  status: "Active"
}, {
  creationDate: 1530619393230,
  description: "",
  groupId: "",
  id: "Redirect_1530619393230",
  name: "Texture Pack Sandbox - Weapons - Part 2",
  objectType: "rule",
  pairs: [{
    destination: "https://i.imgur.com/DVjCdwI.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/crossbow_2_d.png"
    }
  }, {
    destination: "https://i.imgur.com/DVjCdwI.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/crossbow_2_d.png"
    }
  }, {
    destination: "https://i.imgur.com/qu7HHT5.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/bow_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/qu7HHT5.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/bow_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/HSWcyku.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/spear_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/HSWcyku.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/spear_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/TRqDlgX.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/crossbow_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/TRqDlgX.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/crossbow_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/OU5os0h.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/axe_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/OU5os0h.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/axe_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/aAJyHBB.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/great_axe_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/aAJyHBB.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/great_axe_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/WPWU8zC.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/hammer_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/WPWU8zC.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/hammer_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/Fg93gj3.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/great_hammer_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/Fg93gj3.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/great_hammer_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/hSqLP3t.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/shield_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/hSqLP3t.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/shield_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/4ZxIJQM.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/samurai_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/4ZxIJQM.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/samurai_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/h5jqSRp.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/sword_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/h5jqSRp.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/sword_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/wOTr8TG.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/sword_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/QKBc2ou.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/samurai_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/wOTr8TG.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/sword_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/QKBc2ou.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/samurai_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/jKDdyvc.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/spear_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/jKDdyvc.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/spear_1_g.png"
    }
  }],
  ruleType: "Redirect",
  status: "Active"
}, {
  creationDate: 1530619364482,
  description: "",
  groupId: "",
  id: "Redirect_1530619364482",
  name: "Texture Pack Sandbox - Weapons - Part 1",
  objectType: "rule",
  pairs: [{
    destination: "https://i.imgur.com/DTd8Xl6.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/stick_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/DTd8Xl6.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/stick_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/RnkmWgs.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/stick_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/RnkmWgs.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/stick_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/ROTb7Ks.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/dagger_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/ROTb7Ks.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/dagger_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/ivLPh10.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/bat_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/ivLPh10.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/bat_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/phXTNsa.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/bat_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/phXTNsa.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/bat_1_d.png"
    }
  }],
  ruleType: "Redirect",
  status: "Active"
}, {
  creationDate: 1530619326443,
  description: "",
  groupId: "",
  id: "Redirect_1530619326443",
  name: "Texture Pack Sandbox - Hats",
  objectType: "rule",
  pairs: [{
    destination: "https://i.imgur.com/pe3Yx3F.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_40.png"
    }
  }, {
    destination: "https://i.imgur.com/in5H6vw.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_18.png"
    }
  }, {
    destination: "https://i.imgur.com/4ddZert.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/accessories/access_21.png"
    }
  }, {
    destination: "https://i.imgur.com/sULkUZT.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/accessories/access_19.png"
    }
  }, {
    destination: "https://i.imgur.com/gJY7sM6.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_9.png"
    }
  }, {
    destination: "https://i.imgur.com/uYgDtcZ.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_16.png"
    }
  }, {
    destination: "https://i.imgur.com/JPMqgSc.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_31.png"
    }
  }, {
    destination: "https://i.imgur.com/vAOzlyY.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_7.png"
    }
  }, {
    destination: "https://i.imgur.com/YRQ8Ybq.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_15.png"
    }
  }, {
    destination: "https://i.imgur.com/EwkbsHN.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_13.png"
    }
  }, {
    destination: "https://i.imgur.com/yfqME8H.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_11.png"
    }
  }, {
    destination: "https://i.imgur.com/f5uhWCk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_20.png"
    }
  }, {
    destination: "https://i.imgur.com/yfqME8H.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_11_p.png"
    }
  }, {
    destination: "https://i.imgur.com/V8JrIwv.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_14_p.png"
    }
  }, {
    destination: "https://i.imgur.com/V8JrIwv.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_14.png"
    }
  }, {
    destination: "https://i.imgur.com/s7Cxc9y.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_14_top.png"
    }
  }, {
    destination: "https://i.imgur.com/s7Cxc9y.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_11_top.png"
    }
  }, {
    destination: "https://i.imgur.com/pe3Yx3F.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_40.png"
    }
  }, {
    destination: "https://i.imgur.com/in5H6vw.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_18.png"
    }
  }, {
    destination: "https://i.imgur.com/gJY7sM6.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_9.png"
    }
  }, {
    destination: "https://i.imgur.com/4ddZert.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/accessories/access_21.png"
    }
  }, {
    destination: "https://i.imgur.com/sULkUZT.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/accessories/access_19.png"
    }
  }, {
    destination: "https://i.imgur.com/vAOzlyY.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_7.png"
    }
  }, {
    destination: "https://i.imgur.com/uYgDtcZ.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_16.png"
    }
  }, {
    destination: "https://i.imgur.com/JPMqgSc.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_31.png"
    }
  }, {
    destination: "https://i.imgur.com/YRQ8Ybq.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_15.png"
    }
  }, {
    destination: "https://i.imgur.com/EwkbsHN.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_13.png"
    }
  }, {
    destination: "https://i.imgur.com/yfqME8H.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_11.png"
    }
  }, {
    destination: "https://i.imgur.com/f5uhWCk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_20.png"
    }
  }, {
    destination: "https://i.imgur.com/yfqME8H.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_11_p.png"
    }
  }, {
    destination: "https://i.imgur.com/V8JrIwv.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_14_p.png"
    }
  }, {
    destination: "https://i.imgur.com/V8JrIwv.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_14.png"
    }
  }, {
    destination: "https://i.imgur.com/s7Cxc9y.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_11_top.png"
    }
  }, {
    destination: "https://i.imgur.com/s7Cxc9y.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_14_top.png"
    }
  }, {
    destination: "https://i.imgur.com/I0xGtyZ.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_26.png"
    }
  }, {
    destination: "https://i.imgur.com/I0xGtyZ.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_26.png"
    }
  }, {
    destination: "https://i.imgur.com/hmJrVQz.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_52.png"
    }
  }, {
    destination: "https://i.imgur.com/hmJrVQz.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_52.png"
    }
  }],
  ruleType: "Redirect",
  status: "Active"
}, {
  creationDate: 1530619290416,
  description: "",
  groupId: "",
  id: "Redirect_1530619290416",
  name: "Texture Pack Sandbox - Animals",
  objectType: "rule",
  pairs: [{
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/bull_2.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animal"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/wolf_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/wolf_2.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/wolf_2.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/cow_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/pig_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/chicken_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/bull_2.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/bull_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/wolf_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/cow_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/pig_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/chicken_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/enemy.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/enemy.png"
    }
  }],
  ruleType: "Redirect",
  status: "Active"
}, {
  creationDate: 1526664529663,
  description: "",
  groupId: "",
  id: "Redirect_1526664529663",
  name: "Texture Pack Private - Weapons - Part 2",
  objectType: "rule",
  pairs: [{
    destination: "https://i.imgur.com/DVjCdwI.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/crossbow_2_d.png"
    }
  }, {
    destination: "https://i.imgur.com/DVjCdwI.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/crossbow_2_d.png"
    }
  }, {
    destination: "https://i.imgur.com/qu7HHT5.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/bow_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/qu7HHT5.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/bow_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/HSWcyku.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/spear_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/HSWcyku.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/spear_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/TRqDlgX.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/crossbow_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/TRqDlgX.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/crossbow_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/OU5os0h.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/axe_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/OU5os0h.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/axe_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/aAJyHBB.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/great_axe_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/aAJyHBB.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/great_axe_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/WPWU8zC.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/hammer_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/WPWU8zC.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/hammer_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/Fg93gj3.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/great_hammer_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/Fg93gj3.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/great_hammer_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/hSqLP3t.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/shield_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/hSqLP3t.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/shield_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/4ZxIJQM.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/samurai_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/4ZxIJQM.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/samurai_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/h5jqSRp.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/sword_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/h5jqSRp.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/sword_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/wOTr8TG.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/sword_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/QKBc2ou.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/samurai_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/wOTr8TG.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/sword_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/QKBc2ou.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/samurai_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/jKDdyvc.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/spear_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/jKDdyvc.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/spear_1_g.png"
    }
  }],
  ruleType: "Redirect",
  status: "Active"
}, {
  creationDate: 1526664492125,
  description: "",
  groupId: "",
  id: "Redirect_1526664492125",
  name: "Texture Pack - Weapons - Part 2",
  objectType: "rule",
  pairs: [{
    destination: "https://i.imgur.com/TRqDlgX.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/crossbow_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/TRqDlgX.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/crossbow_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/OU5os0h.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/axe_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/OU5os0h.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/axe_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/aAJyHBB.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/great_axe_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/aAJyHBB.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/great_axe_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/WPWU8zC.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/hammer_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/WPWU8zC.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/hammer_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/Fg93gj3.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/great_hammer_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/Fg93gj3.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/great_hammer_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/4ZxIJQM.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/samurai_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/4ZxIJQM.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/samurai_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/hSqLP3t.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/shield_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/hSqLP3t.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/shield_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/h5jqSRp.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/sword_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/h5jqSRp.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/sword_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/wOTr8TG.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/sword_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/QKBc2ou.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/samurai_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/wOTr8TG.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/sword_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/QKBc2ou.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/samurai_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/jKDdyvc.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/spear_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/jKDdyvc.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/spear_1_g.png"
    }
  }],
  ruleType: "Redirect",
  status: "Active"
}, {
  creationDate: 1514047471157,
  description: "",
  groupId: "",
  id: "Redirect_1514047471157",
  name: "Texture Pack Private - Animals",
  objectType: "rule",
  pairs: [{
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/animals/bull_2.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/animals/bull_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/animals/wolf_1.png"
    }
  }, {
    destination: "https://i.imgur.com/wANrStd.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/animals/wolf_2.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/animals/wolf_2.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/animals/cow_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/animals/pig_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/animals/chicken_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/animals/bull_2.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/animals/bull_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/animals/wolf_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/animals/cow_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/animals/pig_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/animals/chicken_1.png"
    }
  }, {
    destination: "https://i.imgur.com/MKOvEr6.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/animals/enemy.png"
    }
  }, {
    destination: "https://i.imgur.com/MKOvEr6.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/animals/enemy.png"
    }
  }],
  ruleType: "Redirect",
  status: "Active"
}, {
  creationDate: 1514046266836,
  description: "",
  groupId: "",
  id: "Redirect_1514046266836",
  name: "Texture Pack - Animals",
  objectType: "rule",
  pairs: [{
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/bull_2.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/bull_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/wolf_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/wolf_2.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/wolf_2.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/cow_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/pig_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/chicken_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/bull_2.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/bull_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/wolf_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/cow_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/pig_1.png"
    }
  }, {
    destination: "",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/chicken_1.png"
    }
  }, {
    destination: "https://i.imgur.com/MKOvEr6.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/enemy.png"
    }
  }, {
    destination: "https://i.imgur.com/MKOvEr6.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/animals/enemy.png"
    }
  }],
  ruleType: "Redirect",
  status: "Active"
}, {
  creationDate: 1509892380958,
  description: "",
  groupId: "",
  id: "Redirect_1509892380958",
  name: "Texture Pack Private - Weapons - Part 1",
  objectType: "rule",
  pairs: [{
    destination: "https://i.imgur.com/DTd8Xl6.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/stick_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/DTd8Xl6.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/stick_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/RnkmWgs.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/stick_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/RnkmWgs.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/stick_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/ROTb7Ks.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/dagger_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/ROTb7Ks.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/dagger_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/ivLPh10.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/bat_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/ivLPh10.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/bat_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/phXTNsa.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/weapons/bat_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/phXTNsa.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/weapons/bat_1_d.png"
    }
  }],
  ruleType: "Redirect",
  status: "Active"
}, {
  creationDate: 1509804753627,
  description: "",
  groupId: "",
  id: "Redirect_1509804753627",
  name: "Texture Pack - Weapons - Part 1",
  objectType: "rule",
  pairs: [{
    destination: "https://i.imgur.com/DTd8Xl6.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/stick_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/DTd8Xl6.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/stick_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/RnkmWgs.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/stick_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/RnkmWgs.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/stick_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/ivLPh10.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/bat_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/ivLPh10.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/bat_1_g.png"
    }
  }, {
    destination: "https://i.imgur.com/phXTNsa.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/bat_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/phXTNsa.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/bat_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/ROTb7Ks.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/dagger_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/ROTb7Ks.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/dagger_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/qu7HHT5.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/bow_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/qu7HHT5.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/bow_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/DVjCdwI.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/crossbow_2_d.png"
    }
  }, {
    destination: "https://i.imgur.com/DVjCdwI.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/crossbow_2_d.png"
    }
  }, {
    destination: "https://i.imgur.com/HSWcyku.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/spear_1_d.png"
    }
  }, {
    destination: "https://i.imgur.com/HSWcyku.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/weapons/spear_1_d.png"
    }
  }],
  ruleType: "Redirect",
  status: "Active"
}, {
  creationDate: 1508326116062,
  description: "",
  groupId: "",
  id: "Redirect_1508326116062",
  name: "Texture Pack Private - Hats",
  objectType: "rule",
  pairs: [{
    destination: "https://i.imgur.com/pe3Yx3F.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/hats/hat_40.png"
    }
  }, {
    destination: "https://i.imgur.com/in5H6vw.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/hats/hat_18.png"
    }
  }, {
    destination: "https://i.imgur.com/4ddZert.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/accessories/access_21.png"
    }
  }, {
    destination: "https://i.imgur.com/sULkUZT.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/accessories/access_19.png"
    }
  }, {
    destination: "https://i.imgur.com/gJY7sM6.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/hats/hat_9.png"
    }
  }, {
    destination: "https://i.imgur.com/uYgDtcZ.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/hats/hat_16.png"
    }
  }, {
    destination: "https://i.imgur.com/JPMqgSc.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/hats/hat_31.png"
    }
  }, {
    destination: "https://i.imgur.com/vAOzlyY.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/hats/hat_7.png"
    }
  }, {
    destination: "https://i.imgur.com/YRQ8Ybq.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/hats/hat_15.png"
    }
  }, {
    destination: "https://i.imgur.com/EwkbsHN.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/hats/hat_13.png"
    }
  }, {
    destination: "https://i.imgur.com/yfqME8H.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/hats/hat_11.png"
    }
  }, {
    destination: "https://i.imgur.com/f5uhWCk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/hats/hat_20.png"
    }
  }, {
    destination: "https://i.imgur.com/yfqME8H.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/hats/hat_11_p.png"
    }
  }, {
    destination: "https://i.imgur.com/V8JrIwv.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/hats/hat_14_p.png"
    }
  }, {
    destination: "https://i.imgur.com/V8JrIwv.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/hats/hat_14.png"
    }
  }, {
    destination: "https://i.imgur.com/s7Cxc9y.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/hats/hat_14_top.png"
    }
  }, {
    destination: "https://i.imgur.com/s7Cxc9y.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/hats/hat_11_top.png"
    }
  }, {
    destination: "https://i.imgur.com/pe3Yx3F.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/hats/hat_40.png"
    }
  }, {
    destination: "https://i.imgur.com/in5H6vw.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/hats/hat_18.png"
    }
  }, {
    destination: "https://i.imgur.com/gJY7sM6.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/hats/hat_9.png"
    }
  }, {
    destination: "https://i.imgur.com/4ddZert.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/accessories/access_21.png"
    }
  }, {
    destination: "https://i.imgur.com/sULkUZT.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/accessories/access_19.png"
    }
  }, {
    destination: "https://i.imgur.com/vAOzlyY.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/hats/hat_7.png"
    }
  }, {
    destination: "https://i.imgur.com/uYgDtcZ.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/hats/hat_16.png"
    }
  }, {
    destination: "https://i.imgur.com/JPMqgSc.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/hats/hat_31.png"
    }
  }, {
    destination: "https://i.imgur.com/YRQ8Ybq.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/hats/hat_15.png"
    }
  }, {
    destination: "https://i.imgur.com/EwkbsHN.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/hats/hat_13.png"
    }
  }, {
    destination: "https://i.imgur.com/yfqME8H.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/hats/hat_11.png"
    }
  }, {
    destination: "https://i.imgur.com/f5uhWCk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/hats/hat_20.png"
    }
  }, {
    destination: "https://i.imgur.com/yfqME8H.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/hats/hat_11_p.png"
    }
  }, {
    destination: "https://i.imgur.com/V8JrIwv.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/hats/hat_14_p.png"
    }
  }, {
    destination: "https://i.imgur.com/V8JrIwv.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/hats/hat_14.png"
    }
  }, {
    destination: "https://i.imgur.com/s7Cxc9y.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/hats/hat_11_top.png"
    }
  }, {
    destination: "https://i.imgur.com/s7Cxc9y.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/hats/hat_14_top.png"
    }
  }, {
    destination: "https://i.imgur.com/I0xGtyZ.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/hats/hat_26.png"
    }
  }, {
    destination: "https://i.imgur.com/I0xGtyZ.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/hats/hat_26.png"
    }
  }, {
    destination: "https://i.imgur.com/hmJrVQz.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "http://dev.moomoo.io/img/hats/hat_52.png"
    }
  }, {
    destination: "https://i.imgur.com/hmJrVQz.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: "https://dev.moomoo.io/img/hats/hat_52.png"
    }
  }],
  ruleType: "Redirect",
  status: "Active"
}, {
  creationDate: 1507417062355,
  description: "",
  groupId: "",
  id: "Redirect_1507417062355",
  name: "Texture Pack - Hats",
  objectType: "rule",
  pairs: [{
    destination: "https://i.imgur.com/pe3Yx3F.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_40.png"
    }
  }, {
    destination: "https://i.imgur.com/4ddZert.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/accessories/access_21.png"
    }
  }, {
    destination: "https://i.imgur.com/sULkUZT.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/accessories/access_19.png"
    }
  }, {
    destination: "https://i.imgur.com/in5H6vw.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_18.png"
    }
  }, {
    destination: "https://i.imgur.com/gJY7sM6.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_9.png"
    }
  }, {
    destination: "https://i.imgur.com/vAOzlyY.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_7.png"
    }
  }, {
    destination: "https://i.imgur.com/uYgDtcZ.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_16.png"
    }
  }, {
    destination: "https://i.imgur.com/JPMqgSc.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_31.png"
    }
  }, {
    destination: "https://i.imgur.com/YRQ8Ybq.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_15.png"
    }
  }, {
    destination: "https://i.imgur.com/EwkbsHN.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_13.png"
    }
  }, {
    destination: "https://i.imgur.com/yfqME8H.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_11.png"
    }
  }, {
    destination: "https://i.imgur.com/f5uhWCk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_20.png"
    }
  }, {
    destination: "https://i.imgur.com/yfqME8H.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_11_p.png"
    }
  }, {
    destination: "https://i.imgur.com/V8JrIwv.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_14_p.png"
    }
  }, {
    destination: "https://i.imgur.com/V8JrIwv.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_14.png"
    }
  }, {
    destination: "https://i.imgur.com/s7Cxc9y.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_14_top.png"
    }
  }, {
    destination: "https://i.imgur.com/s7Cxc9y.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_11_top.png"
    }
  }, {
    destination: "https://i.imgur.com/pe3Yx3F.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_40.png"
    }
  }, {
    destination: "https://i.imgur.com/vAOzlyY.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_7.png"
    }
  }, {
    destination: "https://i.imgur.com/uYgDtcZ.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_16.png"
    }
  }, {
    destination: "https://i.imgur.com/gJY7sM6.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_9.png"
    }
  }, {
    destination: "https://i.imgur.com/JPMqgSc.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_31.png"
    }
  }, {
    destination: "https://i.imgur.com/4ddZert.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/accessories/access_21.png"
    }
  }, {
    destination: "https://i.imgur.com/sULkUZT.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/accessories/access_19.png"
    }
  }, {
    destination: "https://i.imgur.com/YRQ8Ybq.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_15.png"
    }
  }, {
    destination: "https://i.imgur.com/EwkbsHN.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_13.png"
    }
  }, {
    destination: "https://i.imgur.com/yfqME8H.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_11.png"
    }
  }, {
    destination: "https://i.imgur.com/in5H6vw.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_18.png"
    }
  }, {
    destination: "https://i.imgur.com/f5uhWCk.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_20.png"
    }
  }, {
    destination: "https://i.imgur.com/yfqME8H.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_11_p.png"
    }
  }, {
    destination: "https://i.imgur.com/V8JrIwv.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_14_p.png"
    }
  }, {
    destination: "https://i.imgur.com/V8JrIwv.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_14.png"
    }
  }, {
    destination: "https://i.imgur.com/s7Cxc9y.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_11_top.png"
    }
  }, {
    destination: "https://i.imgur.com/s7Cxc9y.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_14_top.png"
    }
  }, {
    destination: "https://i.imgur.com/I0xGtyZ.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_26.png"
    }
  }, {
    destination: "https://i.imgur.com/I0xGtyZ.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_26.png"
    }
  }, {
    destination: "https://i.imgur.com/hmJrVQz.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_52.png"
    }
  }, {
    destination: "https://i.imgur.com/hmJrVQz.png",
    source: {
      key: "Url",
      operator: "Contains",
      value: ".././img/hats/hat_52.png"
    }
  }],
  ruleType: "Redirect",
  status: "Active"
}];
//-->
}

(function __repairedBootStart(tries) {
    tries = tries || 0;
    var page = document.readyState !== "loading" && document.getElementById("gameUI");
    var bundle = window.loadedScript === true || document.readyState === "complete";
    if ((!page || !bundle) && tries < 400) {
        return setTimeout(function () { __repairedBootStart(tries + 1); }, 50);
    }
    __repairedBoot();
})();
