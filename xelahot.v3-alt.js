// ==UserScript==
// @name         xelahot
// @author       bluckguy,astive
// @version      3
// @match        *://*.moomoo.io/*
// @icon         https://pbs.twimg.com/profile_images/1366245884921536515/rnBpE7M9_400x400.jpg
// @description  dominate cowgame
// @grant        none
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

(function () {
  "use strict";

  if (window.__mooShim) return;

  var SALT = 1;
  var SIG_BYTES = 6;
  var ENCRYPTED_MODE = 1;

  var C2S = ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"];
  var S2C = ["A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

  function utf8Len(str) {
    var n = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length && (str.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { n += 4; i++; }
      else n += 3;
    }
    return n;
  }

  function Writer() {
    this.buf = new Uint8Array(1024);
    this.view = new DataView(this.buf.buffer);
    this.pos = 0;
  }
  Writer.prototype.need = function (n) {
    if (this.pos + n <= this.buf.length) return;
    var size = this.buf.length;
    while (size < this.pos + n) size *= 2;
    var next = new Uint8Array(size);
    next.set(this.buf);
    this.buf = next;
    this.view = new DataView(next.buffer);
  };
  Writer.prototype.u8 = function (v) { this.need(1); this.view.setUint8(this.pos++, v); };
  Writer.prototype.u16 = function (v) { this.need(2); this.view.setUint16(this.pos, v); this.pos += 2; };
  Writer.prototype.u32 = function (v) { this.need(4); this.view.setUint32(this.pos, v); this.pos += 4; };
  Writer.prototype.i8 = function (v) { this.need(1); this.view.setInt8(this.pos++, v); };
  Writer.prototype.i16 = function (v) { this.need(2); this.view.setInt16(this.pos, v); this.pos += 2; };
  Writer.prototype.i32 = function (v) { this.need(4); this.view.setInt32(this.pos, v); this.pos += 4; };
  Writer.prototype.f64 = function (v) { this.need(8); this.view.setFloat64(this.pos, v); this.pos += 8; };
  Writer.prototype.bytes = function (b) { this.need(b.length); this.buf.set(b, this.pos); this.pos += b.length; };

  Writer.prototype.str = function (s) {
    var n = utf8Len(s);
    if (n < 32) this.u8(0xa0 | n);
    else if (n < 256) { this.u8(0xd9); this.u8(n); }
    else if (n < 65536) { this.u8(0xda); this.u16(n); }
    else { this.u8(0xdb); this.u32(n); }
    this.need(n);
    var p = this.pos;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) this.buf[p++] = c;
      else if (c < 0x800) {
        this.buf[p++] = 0xc0 | (c >> 6);
        this.buf[p++] = 0x80 | (c & 63);
      } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
        c = ((c & 1023) << 10) + (s.charCodeAt(++i) & 1023) + 0x10000;
        this.buf[p++] = 0xf0 | (c >> 18);
        this.buf[p++] = 0x80 | ((c >> 12) & 63);
        this.buf[p++] = 0x80 | ((c >> 6) & 63);
        this.buf[p++] = 0x80 | (c & 63);
      } else {
        this.buf[p++] = 0xe0 | (c >> 12);
        this.buf[p++] = 0x80 | ((c >> 6) & 63);
        this.buf[p++] = 0x80 | (c & 63);
      }
    }
    this.pos = p;
  };

  Writer.prototype.write = function (v) {
    if (v === null || v === undefined) return this.u8(0xc0);

    var t = typeof v;
    if (t === "boolean") return this.u8(v ? 0xc3 : 0xc2);

    if (t === "number") {
      if (Number.isSafeInteger(v)) {
        if (v >= 0) {
          if (v < 128) return this.u8(v);
          if (v < 256) { this.u8(0xcc); return this.u8(v); }
          if (v < 65536) { this.u8(0xcd); return this.u16(v); }
          if (v < 4294967296) { this.u8(0xce); return this.u32(v); }
          this.u8(0xcf); this.u32(Math.floor(v / 4294967296)); return this.u32(v >>> 0);
        }
        if (v >= -32) return this.u8(0xe0 | (v + 32));
        if (v >= -128) { this.u8(0xd0); return this.i8(v); }
        if (v >= -32768) { this.u8(0xd1); return this.i16(v); }
        if (v >= -2147483648) { this.u8(0xd2); return this.i32(v); }
        this.u8(0xd3); this.i32(Math.floor(v / 4294967296)); return this.u32(v >>> 0);
      }
      this.u8(0xcb);
      return this.f64(v);
    }

    if (t === "string") return this.str(v);

    if (v instanceof Uint8Array || ArrayBuffer.isView(v)) {
      var b = v instanceof Uint8Array ? v : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
      if (b.length < 256) { this.u8(0xc4); this.u8(b.length); }
      else if (b.length < 65536) { this.u8(0xc5); this.u16(b.length); }
      else { this.u8(0xc6); this.u32(b.length); }
      return this.bytes(b);
    }

    if (Array.isArray(v)) {
      if (v.length < 16) this.u8(0x90 | v.length);
      else if (v.length < 65536) { this.u8(0xdc); this.u16(v.length); }
      else { this.u8(0xdd); this.u32(v.length); }
      for (var i = 0; i < v.length; i++) this.write(v[i]);
      return;
    }

    var keys = Object.keys(v);
    if (keys.length < 16) this.u8(0x80 | keys.length);
    else if (keys.length < 65536) { this.u8(0xde); this.u16(keys.length); }
    else { this.u8(0xdf); this.u32(keys.length); }
    for (var k = 0; k < keys.length; k++) {
      this.str(keys[k]);
      this.write(v[keys[k]]);
    }
  };

  function encode(value) {
    var w = new Writer();
    w.write(value);
    return w.buf.slice(0, w.pos);
  }

  function Reader(bytes) {
    this.b = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = 0;
  }
  Reader.prototype.str = function (n) {
    var out = "", chunk = [], end = this.pos + n;
    while (this.pos < end) {
      var f = this.b[this.pos++], cp;
      if (!(f & 0x80)) cp = f;
      else if ((f & 0xe0) === 0xc0) cp = ((f & 31) << 6) | (this.b[this.pos++] & 63);
      else if ((f & 0xf0) === 0xe0) cp = ((f & 15) << 12) | ((this.b[this.pos++] & 63) << 6) | (this.b[this.pos++] & 63);
      else {
        cp = ((f & 7) << 18) | ((this.b[this.pos++] & 63) << 12) | ((this.b[this.pos++] & 63) << 6) | (this.b[this.pos++] & 63);
        if (cp > 0xffff) {
          cp -= 0x10000;
          chunk.push(0xd800 | (cp >>> 10));
          cp = 0xdc00 | (cp & 1023);
        }
      }
      chunk.push(cp);
      if (chunk.length >= 4096) { out += String.fromCharCode.apply(String, chunk); chunk.length = 0; }
    }
    if (chunk.length) out += String.fromCharCode.apply(String, chunk);
    return out;
  };
  Reader.prototype.read = function () {
    var h = this.b[this.pos++], i, n, out;

    if (h < 0x80) return h;
    if (h >= 0xe0) return h - 256;
    if (h >= 0xa0 && h < 0xc0) return this.str(h - 0xa0);
    if (h >= 0x90 && h < 0xa0) { n = h - 0x90; out = new Array(n); for (i = 0; i < n; i++) out[i] = this.read(); return out; }
    if (h >= 0x80 && h < 0x90) { n = h - 0x80; out = {}; for (i = 0; i < n; i++) { var k = this.read(); out[k] = this.read(); } return out; }

    switch (h) {
      case 0xc0: return null;
      case 0xc2: return false;
      case 0xc3: return true;
      case 0xc4: n = this.b[this.pos++]; return this.bin(n);
      case 0xc5: n = this.view.getUint16(this.pos); this.pos += 2; return this.bin(n);
      case 0xc6: n = this.view.getUint32(this.pos); this.pos += 4; return this.bin(n);
      case 0xca: out = this.view.getFloat32(this.pos); this.pos += 4; return out;
      case 0xcb: out = this.view.getFloat64(this.pos); this.pos += 8; return out;
      case 0xcc: return this.b[this.pos++];
      case 0xcd: out = this.view.getUint16(this.pos); this.pos += 2; return out;
      case 0xce: out = this.view.getUint32(this.pos); this.pos += 4; return out;
      case 0xcf: out = this.view.getUint32(this.pos) * 4294967296 + this.view.getUint32(this.pos + 4); this.pos += 8; return out;
      case 0xd0: return this.view.getInt8(this.pos++);
      case 0xd1: out = this.view.getInt16(this.pos); this.pos += 2; return out;
      case 0xd2: out = this.view.getInt32(this.pos); this.pos += 4; return out;
      case 0xd3: out = this.view.getInt32(this.pos) * 4294967296 + this.view.getUint32(this.pos + 4); this.pos += 8; return out;
      case 0xd9: n = this.b[this.pos++]; return this.str(n);
      case 0xda: n = this.view.getUint16(this.pos); this.pos += 2; return this.str(n);
      case 0xdb: n = this.view.getUint32(this.pos); this.pos += 4; return this.str(n);
      case 0xdc: n = this.view.getUint16(this.pos); this.pos += 2; out = new Array(n); for (i = 0; i < n; i++) out[i] = this.read(); return out;
      case 0xdd: n = this.view.getUint32(this.pos); this.pos += 4; out = new Array(n); for (i = 0; i < n; i++) out[i] = this.read(); return out;
      case 0xde: n = this.view.getUint16(this.pos); this.pos += 2; out = {}; for (i = 0; i < n; i++) { var k2 = this.read(); out[k2] = this.read(); } return out;
      case 0xdf: n = this.view.getUint32(this.pos); this.pos += 4; out = {}; for (i = 0; i < n; i++) { var k3 = this.read(); out[k3] = this.read(); } return out;

      case 0xd4: return this.ext(1);
      case 0xd5: return this.ext(2);
      case 0xd6: return this.ext(4);
      case 0xd7: return this.ext(8);
      case 0xd8: return this.ext(16);
      case 0xc7: n = this.b[this.pos++]; return this.ext(n);
      case 0xc8: n = this.view.getUint16(this.pos); this.pos += 2; return this.ext(n);
      case 0xc9: n = this.view.getUint32(this.pos); this.pos += 4; return this.ext(n);
    }
    throw new Error("msgpack: unknown byte 0x" + h.toString(16));
  };
  Reader.prototype.bin = function (n) {
    var out = this.b.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  };
  Reader.prototype.ext = function (n) {
    var type = this.view.getInt8(this.pos);
    this.pos += 1 + n;
    return { __ext: type };
  };

  function decode(bytes) {
    return new Reader(bytes).read();
  }

  function rng(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 1831565813) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(alphabet, seed) {
    var n = alphabet.length;
    var idx = alphabet.map(function (_, i) { return i; });
    var next = rng(seed >>> 0);
    for (var i = n - 1; i > 0; i--) {
      var j = Math.floor(next() * (i + 1));
      var tmp = idx[i];
      idx[i] = idx[j];
      idx[j] = tmp;
    }
    var enc = {}, dec = {};
    for (var k = 0; k < n; k++) {
      enc[alphabet[k]] = idx[k];
      dec[idx[k]] = alphabet[k];
    }
    return { enc: enc, dec: dec };
  }

  function tablesFor(seed) {
    var mixed = (seed ^ Math.imul(SALT, 2654435761)) >>> 0;
    return {
      c2s: shuffle(C2S, mixed),
      s2c: shuffle(S2C, (mixed ^ 2246822507) >>> 0),
    };
  }

  var K = new Uint32Array([
    1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221,
    3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580,
    3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
    2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895,
    666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037,
    2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
    430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779,
    1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298,
  ]);

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256(input) {
    var h = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
    var len = input.length;
    var bits = len * 8;
    var padded = new Uint8Array(Math.ceil((len + 9) / 64) * 64);
    padded.set(input);
    padded[len] = 0x80;

    var view = new DataView(padded.buffer);
    view.setUint32(padded.length - 4, bits >>> 0, false);
    view.setUint32(padded.length - 8, Math.floor(bits / 4294967296), false);

    var w = new Uint32Array(64);
    for (var off = 0; off < padded.length; off += 64) {
      for (var i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
      for (i = 16; i < 64; i++) {
        var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }

    var out = new Uint8Array(32);
    var ov = new DataView(out.buffer);
    for (var j = 0; j < 8; j++) ov.setUint32(j * 4, h[j], false);
    return out;
  }

  var BLOCK = 64;

  function hmac(key, msg) {
    var k = key;
    if (k.length > BLOCK) k = sha256(k);
    var padded = new Uint8Array(BLOCK);
    padded.set(k);

    var inner = new Uint8Array(BLOCK + msg.length);
    var outer = new Uint8Array(BLOCK + 32);
    for (var i = 0; i < BLOCK; i++) {
      inner[i] = padded[i] ^ 0x36;
      outer[i] = padded[i] ^ 0x5c;
    }
    inner.set(msg, BLOCK);
    outer.set(sha256(inner), BLOCK);
    return sha256(outer);
  }

  function sign(key, frame) {
    return hmac(key, frame).subarray(0, SIG_BYTES);
  }

  function unhex(hex) {
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }

  var sessions = new WeakMap();

  function toBytes(data) {
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return null;
  }

  function inbound(socket, raw) {
    var bytes = toBytes(raw);
    if (!bytes) return raw;

    var frame;
    try { frame = decode(bytes); } catch (e) { return raw; }
    if (!Array.isArray(frame) || frame.length < 2) return raw;

    var type = frame[0];
    var args = frame[1];

    if (type === "io-init") {
      var session = null;
      if (args && args[3] === ENCRYPTED_MODE) {
        session = { key: unhex(args[2]), tables: tablesFor(args[1] >>> 0), seq: 0 };
      }
      sessions.set(socket, session);

      if (session) {
        var patched = args.slice();
        patched[3] = 0;
        return encode(["io-init", patched]).buffer;
      }
      return raw;
    }

    var s = sessions.get(socket);
    if (!s || typeof type !== "number") return raw;

    var name = s.tables.s2c.dec[type];
    if (name === undefined) return raw;

    return encode([name, args]).buffer;
  }

  function outbound(socket, data) {
    var s = sessions.get(socket);
    if (!s) return data;

    var bytes = toBytes(data);
    if (!bytes) return data;

    var frame;
    try { frame = decode(bytes); } catch (e) { return data; }
    if (!Array.isArray(frame) || typeof frame[0] !== "string") return data;

    var opcode = s.tables.c2s.enc[frame[0]];
    if (opcode === undefined) return null;

    var payload = encode([opcode, frame[1], ++s.seq]);
    var out = new Uint8Array(SIG_BYTES + payload.length);
    out.set(sign(s.key, payload), 0);
    out.set(payload, SIG_BYTES);
    return out;
  }

  var nativeSend = WebSocket.prototype.send;

  WebSocket.prototype.send = function (data) {
    var out = outbound(this, data);
    if (out === null) return;
    return nativeSend.call(this, out);
  };

  function wrapListener(socket, fn) {
    if (typeof fn !== "function") return fn;
    if (fn.__mooWrapped) return fn.__mooWrapped;
    var wrapped = function (event) {
      var rewritten = inbound(socket, event.data);
      if (rewritten === event.data) return fn.call(this, event);

      var view = Object.create(event);
      Object.defineProperty(view, "data", { value: rewritten, enumerable: true });
      return fn.call(this, view);
    };
    fn.__mooWrapped = wrapped;
    return wrapped;
  }

  var nativeAdd = WebSocket.prototype.addEventListener;
  var nativeRemove = WebSocket.prototype.removeEventListener;

  WebSocket.prototype.addEventListener = function (type, fn, opts) {
    return nativeAdd.call(this, type, type === "message" ? wrapListener(this, fn) : fn, opts);
  };
  WebSocket.prototype.removeEventListener = function (type, fn, opts) {
    return nativeRemove.call(this, type, type === "message" && fn && fn.__mooWrapped ? fn.__mooWrapped : fn, opts);
  };

  var onmessage = Object.getOwnPropertyDescriptor(WebSocket.prototype, "onmessage");
  Object.defineProperty(WebSocket.prototype, "onmessage", {
    configurable: true,
    enumerable: true,
    get: function () {
      var fn = onmessage.get.call(this);
      return (fn && fn.__mooOriginal) || fn;
    },
    set: function (fn) {
      var wrapped = wrapListener(this, fn);
      if (wrapped && wrapped !== fn) wrapped.__mooOriginal = fn;
      return onmessage.set.call(this, wrapped);
    },
  });

  window.__mooShim = {
    encode: encode,
    decode: decode,
    tablesFor: tablesFor,
    sign: sign,
    sha256: sha256,
    session: function (socket) { return sessions.get(socket); },
  };

  if (!window.msgpack) {
    window.msgpack = {
      encode: encode,
      decode: function (d) { return decode(toBytes(d) || d); },
    };
  }
})();


(function (start) {
  var started = false;
  function ready() {
    return !!document.body && typeof window.$ === "function";
  }
  function go() {
    if (started || !ready()) return;
    started = true;
    if (observer) observer.disconnect();
    start();
  }
  var observer = window.MutationObserver
    ? new MutationObserver(go)
    : null;
  if (observer) observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", go);
  window.addEventListener("load", go);
  go();
})(function () {

// VERIFY
// @credits/visuals - Error_King
// @Credits/Visuals - Error_King

let safewalking = false;
let Leuchtturm = false;
let antispiketicked = false;
let autoOneFrameToggled = false;
const {
    sin,
    cos,
    sqrt,
    min
} = Math;
let RealPush = false;
setInterval(()=>{

},3500);

let useHack = true;
let testMode = window.location.hostname == "127.0.0.1";
console.clear();
let imueheua = false;
// VERIFY
// @credits/visuals - Error_King

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
        return r.d(n, "9", n), n
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
let { maxScreenWidth, maxScreenHeight } = config;
let { moveTo, lineTo } = CanvasRenderingContext2D.prototype;

CanvasRenderingContext2D.prototype.moveTo = function(x, y) {
    if (this.globalAlpha !== 0.06) {
        return moveTo.call(this, x, y);
    }
};
CanvasRenderingContext2D.prototype.lineTo = function(x, y) {
    if (this.globalAlpha !== 0.06) {
        return lineTo.call(this, x, y);
    }
};

!function(run) {
    if (!run) return;
    let codes = {
        setup: () => {
            "use strict";
            let newFont = document.createElement("link");
            newFont.rel = "stylesheet";
            newFont.href = "https://fonts.googleapis.com/css?family=Ubuntu:700";
            newFont.type = "text/css";
            document.body.append(newFont);
            let min = document.createElement("script");
            min.src = "data:text/javascript,";
            document.body.append(min);
        },
        main: () => {
            "use strict";
            /*let scriptTags = document.getElementsByTagName("script");
      for (let i = 0; i < scriptTags.length; i++) {
          if (scriptTags[i].src.includes("bundle.js")) {
              scriptTags[i].remove();
              break;
          }
      }*/


            window.oncontextmenu = function() {
                return false;
            };
            let config = window.config;
            // CLIENT:
            config.clientSendRate = 0; // Aim Packet Send Rate
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
                    stackedText: true,
                    HKH: true,
                    names: true,
                    ok: true, // testing
                    // autoOneFrame: true, //working on
                    smartAutoInsta: true, // cool ig who added that
                    autobullspam: false,
                    noantispike: false, // its barbarian hat in antispike , didnt test realy , i dont want to xd
                    killChat: true,
                    autoBuy: true,
                    autoBuyEquip: true,
                    autoPush: true, // so good but sometimes stops on lucky angle
                    revTick: true,
                    spikeTickHelper: true, // on test , and still working on but ts will be op
                    spikeTick: true, // good i think, packet system making the spiketick op
                    predictTick: true,
                    autoPlace: true, // working on
                    autoReplace: true, // working on
                    antiTrap: true, // so bad
                    slowOT: false,
                    attackDir: false,
                    noDir: true,
                    showDir: true,
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
            window.wasdMode = function() {};

            // PAGE 1:
            window.startGrind = function() {};

            // PAGE 3:

            window.resBuild = function() {};
            window.toggleVisual = function() {};

            // SOME FUNCTIONS:
            window.prepareUI = function() {};
            window.leave = function() {};

            // nah hahahahahhh why good ping
            window.ping = imueheua ? 86 : 0;

            class deadfuturechickenmodrevival {
                constructor(flarez, lore) {
                    this.inGame = false;
                    this.lover = flarez + lore;
                    this.baby = "ae86";
                    this.isBlack = 0;
                    this.webSocket = undefined;
                    this.checkBaby = function () {
                        this.baby !== "ae86" ? this.isBlack++ : this.isBlack--;
                        if (this.isBlack >= 1) return "bl4cky";
                        return "noting for you";
                    };
                    this.x2 = 0;
                    this.y2 = 0;
                    this.chat = "nOOB";
                    this.summon = function (tmpObj) {
                        this.x2 = tmpObj.x;
                        this.y2 = tmpObj.y;
                        this.chat = tmpObj.name + " ur so bad XDDDD";
                    };
                    this.commands = function (cmd) {
                        cmd == "rv3link" && window.open("https://florr.io/");
                        cmd == "woah" && window.open("https://www.youtube.com/watch?v=MO0AGukzj6M");
                        return cmd;
                    };
                    this.dayte = "11yearold";
                    this.memeganoob = "69yearold";
                    this.startDayteSpawn = function (tmpObj) {
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
                    this.AntiChickenModV69420 = function (tmpObj) {
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
                        this.checkBox({id: "check_" + options, style: `display: ${i == 0 ? "inline-block" : "none"};`, class: "checkB", onclick: `window.${options + "Func"}()`, checked: setting.menu[options]});
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
            (function() {
                'use strict';

                // Menu configuration
                const MenuConfig = {
                    toggleKey: 'Escape',
                    defaultTheme: 'hologreen',
                    version: 'xelahot.v1',
                    author: 'Error_King,Bluckguy',
                    credits: '@Visual - Error_King'
                };
                let menuVisible = false;
                let currentTab = 'combat';
                let currentTheme = MenuConfig.defaultTheme;
                let featureStates = {
                    weaponGrind: false,
                    healingBeta: true,
                    antipush: true,
                    instaType: 'oneShot',
                    antiBullType: 'noab',
                    backupNobull: true,
                    turretCombat: true,
                    safeAntiSpikeTick: true
                };
                let currentPlayingID = null;
                let currentButton = null;
                let player = null;

                // Background overlay element
                let backgroundOverlay = null;

                //Music
                // @visuals/Credits - Error_King
                const musicList = [{
                    name: "Just like me",
                    url: "https://youtu.be/BeqEAs1WNWg?si=nrJsguAsLolFQSx2"
                }, {
                    name: "party girl",
                    url: "https://youtu.be/s5AoSQeYmzU?si=90DM0X1oMbcUy4oQ"
                }, {
                    name: "xxxtenacions songs",
                    url: "https://youtu.be/szScXOEkkFw?si=YT_S3dFKod4BzlJ6"
                }, {
                    name: "Skilla baby",
                    url: "https://youtu.be/O5uEKJ4YXGI?si=Rtk7HnE2SAeTCRYU"
                }, {
                    name: "Embrace it",
                    url: "https://youtu.be/AcatRdNlaoc?si=dfcC-rLEU0TsnvEh"
                }, {
                    name: "honey pie",
                    url: "https://youtu.be/lBrp7v4PE0c?si=apBfr_4hYWsIZKkk"
                }, {
                    name: "suavemente",
                    url: "https://youtu.be/S8i64rSAVIo?si=bncmpsVj2O1RJE01"
                }, {
                    name: "funk",
                    url: "https://youtu.be/XcI5AwfjDzA?si=Zy3kLF18k7IP8zEP"
                }, {
                    name: "z beta",
                    url: "https://youtu.be/W_kxsPzH3PE?si=aueeNn5bcNdJBURY"
                }, {
                    name: "shonci - CHEGOU 3",
                    url: "https://www.youtube.com/embed/jMcV_OP8LSw"
                }, {
                    name: "Benzz - Je Mappelle",
                    url: "https://www.youtube.com/embed/_83AOaZ3Iyg"
                }, {
                    name: "whine in brazil",
                    url: "https://www.youtube.com/embed/D89m9DTylN8"
                }];
                const megaStyles = `
    /* Background Overlay */
    .menu-background-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0);
        z-index: 99998;
        pointer-events: none;
        transition: background 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .menu-background-overlay.visible {
        background: rgba(0, 0, 0, 0.7);
        pointer-events: auto;
    }
    .menu-background-overlay.visible::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at center, transparent 0%, rgba(0, 80, 0, 0.15) 100%);
        pointer-events: none;
    }

    /* Base Menu Container */
    .mod-menu-container {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 700px;
        height: 500px;
        background: rgba(15, 35, 15, 0.95);
        border-radius: 15px;
        box-shadow: 0 0 30px rgba(100, 255, 100, 0.3),
                    0 0 60px rgba(50, 200, 50, 0.2),
                    0 0 90px rgba(0, 150, 0, 0.1);
        border: 2px solid rgba(100, 255, 100, 0.5);
        backdrop-filter: blur(10px);
        z-index: 99999;
        display: none;
        overflow: hidden;
        font-family: 'Rajdhani', 'Agency FB', Arial, sans-serif;
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.95);
    }
    .mod-menu-container.visible {
        display: block;
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
    }
    .menu-header {
        height: 60px;
        background: linear-gradient(90deg, rgba(0,80,0,0.8) 0%, rgba(50,200,50,0.6) 50%, rgba(0,80,0,0.8) 100%);
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 25px;
        border-bottom: 1px solid rgba(100, 255, 100, 0.3);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    }
    .menu-title {
        color: #90ff90;
        font-size: 24px;
        font-weight: bold;
        text-shadow: 0 0 10px rgba(100, 255, 100, 0.7),
                     0 0 20px rgba(50, 200, 50, 0.5);
        letter-spacing: 2px;
    }
    .menu-version {
        color: rgba(100, 255, 100, 0.7);
        font-size: 14px;
        font-style: italic;
    }
    .menu-content {
        display: flex;
        height: calc(100% - 120px);
    }
    .menu-tabs {
        width: 180px;
        background: rgba(10, 30, 10, 0.7);
        border-right: 1px solid rgba(50, 150, 50, 0.3);
        padding: 20px 0;
        overflow-y: auto;
    }
    .tab-button {
        display: block;
        width: 100%;
        padding: 12px 25px;
        color: rgba(200, 255, 200, 0.8);
        background: transparent;
        border: none;
        text-align: left;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
    }
    .tab-button:hover {
        background: rgba(0, 150, 0, 0.3);
        color: #90ff90;
    }
    .tab-button.active {
        background: rgba(50, 200, 50, 0.3);
        color: #90ff90;
        font-weight: bold;
    }
    .tab-button.active::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        width: 3px;
        background: #90ff90;
        box-shadow: 0 0 10px #90ff90;
    }
    .tab-content {
        flex: 1;
        padding: 25px;
        overflow-y: auto;
    }
    .tab-pane {
        display: none;
    }
    .tab-pane.active {
        display: block;
        animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .feature-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 15px;
    }
    .feature-item {
        background: rgba(20, 40, 20, 0.6);
        border-radius: 8px;
        padding: 15px;
        border: 1px solid rgba(50, 200, 50, 0.2);
        transition: all 0.3s ease;
    }
    .feature-item:hover {
        background: rgba(30, 70, 30, 0.7);
        border-color: rgba(100, 255, 100, 0.4);
        transform: translateY(-3px);
        box-shadow: 0 5px 15px rgba(0, 150, 0, 0.2);
    }
    .feature-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    }
    .feature-title {
        color: #70ff70;
        font-size: 16px;
        font-weight: bold;
    }
    .toggle-switch {
        position: relative;
        display: inline-block;
        width: 50px;
        height: 24px;
    }
    .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    .toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(100, 150, 100, 0.3);
        transition: .4s;
        border-radius: 24px;
        border: 1px solid rgba(100, 255, 100, 0.3);
    }
    .toggle-slider:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 2px;
        background: rgba(200, 255, 200, 0.8);
        transition: .4s;
        border-radius: 50%;
    }
    input:checked + .toggle-slider {
        background: rgba(100, 255, 100, 0.5);
        box-shadow: 0 0 10px rgba(100, 255, 100, 0.5);
    }
    input:checked + .toggle-slider:before {
        transform: translateX(25px);
        background: #90ff90;
        box-shadow: 0 0 10px #90ff90;
    }
    .menu-footer {
        height: 60px;
        background: linear-gradient(90deg, rgba(0,80,0,0.8) 0%, rgba(0,150,0,0.6) 50%, rgba(0,80,0,0.8) 100%);
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 25px;
        border-top: 1px solid rgba(50, 150, 50, 0.3);
    }
    .menu-author {
        color: rgba(100, 255, 100, 0.7);
        font-size: 14px;
    }
    .menu-close {
        background: rgba(200, 50, 50, 0.3);
        color: rgba(255, 100, 100, 0.9);
        border: 1px solid rgba(255, 100, 100, 0.5);
        border-radius: 5px;
        padding: 5px 15px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .menu-close:hover {
        background: rgba(200, 50, 50, 0.5);
        color: #ff5555;
    }
    .cyber-grid {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background:
            linear-gradient(rgba(50, 200, 50, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(50, 200, 50, 0.05) 1px, transparent 1px);
        background-size: 20px 20px;
        pointer-events: none;
        z-index: -1;
    }
    .glow-effect {
        position: absolute;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
        background: radial-gradient(circle at center, rgba(100, 255, 100, 0.1) 0%, transparent 70%);
        pointer-events: none;
        z-index: -1;
    }
    @keyframes pulse {
        0% { box-shadow: 0 0 5px rgba(100, 255, 100, 0.5); }
        50% { box-shadow: 0 0 20px rgba(100, 255, 100, 0.8); }
        100% { box-shadow: 0 0 5px rgba(100, 255, 100, 0.5); }
    }
    .pulse-animation {
        animation: pulse 2s infinite;
    }
    .Cselect {
        background: rgba(20, 40, 20, 0.8);
        border: 1px solid rgba(100, 255, 100, 0.5);
        color: #90ff90;
        padding: 5px 10px;
        border-radius: 5px;
        margin-left: 10px;
    }
    .Cselect option {
        background: rgba(10, 30, 10, 0.9);
        color: #90ff90;
    }
    @media (max-width: 768px) {
        .mod-menu-container {
            width: 95%;
            height: 80%;
        }
        .menu-content {
            flex-direction: column;
        }
        .menu-tabs {
            width: 100%;
            height: auto;
            display: flex;
            overflow-x: auto;
            padding: 0;
        }
        .tab-button {
            padding: 10px 15px;
            white-space: nowrap;
        }
        .tab-button.active::before {
            width: 100%;
            height: 3px;
            top: auto;
            bottom: 0;
        }
    }
    .corner-decoration {
        position: absolute;
        width: 30px;
        height: 30px;
        border-color: rgba(100, 255, 100, 0.5);
        border-style: solid;
        border-width: 0;
    }
    .corner-tl {
        top: 10px;
        left: 10px;
        border-top-width: 2px;
        border-left-width: 2px;
    }
    .corner-tr {
        top: 10px;
        right: 10px;
        border-top-width: 2px;
        border-right-width: 2px;
    }
    .corner-bl {
        bottom: 10px;
        left: 10px;
        border-bottom-width: 2px;
        border-left-width: 2px;
    }
    .corner-br {
        bottom: 10px;
        right: 10px;
        border-bottom-width: 2px;
        border-right-width: 2px;
    }
    .status-indicator {
        position: absolute;
        top: 15px;
        right: 15px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #00ff00;
        box-shadow: 0 0 10px #00ff00;
    }
    ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    ::-webkit-scrollbar-track {
        background: rgba(10, 30, 10, 0.3);
        border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb {
        background: rgba(50, 200, 50, 0.5);
        border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
        background: rgba(100, 255, 100, 0.7);
    }
    .feature-tooltip {
        position: relative;
        display: inline-block;
    }
    .feature-tooltip .tooltip-text {
        visibility: hidden;
        width: 200px;
        background: rgba(10, 30, 10, 0.9);
        color: #fff;
        text-align: center;
        border-radius: 6px;
        padding: 10px;
        position: absolute;
        z-index: 1;
        bottom: 125%;
        left: 50%;
        transform: translateX(-50%);
        opacity: 0;
        transition: opacity 0.3s;
        border: 1px solid rgba(50, 200, 50, 0.5);
        box-shadow: 0 0 15px rgba(0, 150, 0, 0.3);
        font-size: 14px;
        line-height: 1.4;
    }
    .feature-tooltip:hover .tooltip-text {
        visibility: visible;
        opacity: 1;
    }
    .holographic-line {
        position: absolute;
        height: 1px;
        width: 100%;
        background: linear-gradient(90deg, transparent, rgba(100, 255, 100, 0.5), transparent);
        box-shadow: 0 0 10px rgba(100, 255, 100, 0.3);
    }
    .holographic-line.top {
        top: 60px;
    }
    .holographic-line.bottom {
        bottom: 60px;
    }
    .keybind-display {
        position: absolute;
        bottom: 15px;
        left: 25px;
        color: rgba(100, 255, 100, 0.7);
        font-size: 12px;
    }
    .feature-item.warning {
        border-color: rgba(255, 150, 0, 0.5);
    }
    .feature-item.warning .feature-title {
        color: #ffaa00;
    }
    .feature-item.danger {
        border-color: rgba(255, 50, 50, 0.5);
    }
    .feature-item.danger .feature-title {
        color: #ff5555;
    }
    .feature-item.premium {
        background: rgba(50, 100, 50, 0.7);
        border-color: rgba(100, 255, 100, 0.5);
    }
    .feature-item.premium .feature-title {
        color: #70ff70;
        text-shadow: 0 0 10px rgba(100, 255, 100, 0.5);
    }
    .section-header {
        color: #70ff70;
        font-size: 18px;
        margin: 20px 0 15px 0;
        padding-bottom: 5px;
        border-bottom: 1px solid rgba(50, 200, 50, 0.3);
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    .feature-description {
        color: rgba(180, 255, 180, 0.7);
        font-size: 13px;
        margin-top: 5px;
        line-height: 1.4;
    }
    .music-item {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
        gap: 10px;
    }
    .music-button {
        flex: 1;
        padding: 10px;
        background: rgba(20, 40, 20, 0.8);
        color: #90ff90;
        border: 1px solid rgba(100, 255, 100, 0.5);
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 14px;
        text-align: left;
    }
    .music-button:hover {
        background: rgba(30, 70, 30, 0.7);
        transform: translateY(-2px);
        box-shadow: 0 0 10px rgba(100, 255, 100, 0.3);
    }
    .music-button.playing {
        background: rgba(50, 200, 50, 0.5);
        color: #70ff70;
        text-shadow: 0 0 5px rgba(100, 255, 100, 0.7);
    }
    .music-stop-button {
        width: 50px;
        padding: 10px;
        background: rgba(200, 50, 50, 0.3);
        color: rgba(255, 100, 100, 0.9);
        border: 1px solid rgba(255, 100, 100, 0.5);
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 14px;
    }
    .music-stop-button:hover {
        background: rgba(200, 50, 50, 0.5);
        color: #ff5555;
    }
    .holographic-scanline {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: repeating-linear-gradient(
            to bottom,
            transparent,
            transparent 3px,
            rgba(100, 255, 100, 0.05) 3px,
            rgba(100, 255, 100, 0.05) 6px
        );
        pointer-events: none;
        z-index: -1;
        animation: scan 8s linear infinite;
    }
    @keyframes scan {
        from { background-position: 0 0; }
        to { background-position: 0 100%; }
    }
    .holographic-glare {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(
            135deg,
            rgba(100, 255, 100, 0.1) 0%,
            transparent 50%,
            rgba(100, 255, 100, 0.1) 100%
        );
        pointer-events: none;
        z-index: -1;
    }
    .holographic-data-stream {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: -1;
        overflow: hidden;
    }
    .data-bit {
        position: absolute;
        color: rgba(100, 255, 100, 0.3);
        font-size: 12px;
        font-family: monospace;
        animation: dataFall linear infinite;
    }
    @keyframes dataFall {
        from { transform: translateY(-100%); }
        to { transform: translateY(100vh); }
    }
    `;

                function createModMenu() {
                    // Create background overlay first
                    backgroundOverlay = document.createElement('div');
                    backgroundOverlay.className = 'menu-background-overlay';
                    document.body.appendChild(backgroundOverlay);

                    const styleElement = document.createElement('style');
                    styleElement.textContent = megaStyles;
                    document.head.appendChild(styleElement);
                    const tag = document.createElement('script');
                    tag.src = "https://www.youtube.com/iframe_api";
                    const firstScriptTag = document.getElementsByTagName('script')[0];
                    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                    const menuContainer = document.createElement('div');
                    menuContainer.className = 'mod-menu-container theme-hologreen';
                    menuContainer.id = 'modMenu';
                    menuContainer.innerHTML = `
            <div class="cyber-grid"></div>
            <div class="glow-effect"></div>
            <div class="holographic-scanline"></div>
            <div class="holographic-glare"></div>
            <div class="holographic-data-stream" id="dataStream"></div>
            <div class="corner-decoration corner-tl"></div>
            <div class="corner-decoration corner-tr"></div>
            <div class="corner-decoration corner-bl"></div>
            <div class="corner-decoration corner-br"></div>
            <div class="holographic-line top"></div>
            <div class="holographic-line bottom"></div>
            <div class="status-indicator"></div>
        `;
                    const header = document.createElement('div');
                    header.className = 'menu-header';
                    header.innerHTML = `
            <div class="menu-title">Xelahot.menu.js</div>
            <div class="menu-version">${MenuConfig.version}</div>
        `;
                    menuContainer.appendChild(header);
                    const content = document.createElement('div');
                    content.className = 'menu-content';
                    const tabs = document.createElement('div');
                    tabs.className = 'menu-tabs';
                    tabs.innerHTML = `
            <button class="tab-button active" data-tab="combat">COMBAT</button>
            <button class="tab-button" data-tab="music">MUSIC</button>
        `;
                    content.appendChild(tabs);
                    const tabContent = document.createElement('div');
                    tabContent.className = 'tab-content';
                    const combatTab = createTab('combat', 'active', [
                        createFeatureItem('weaponGrind', 'Weapon Grinder', 'Toggle weapon grinding feature', '', false, 0, 'window.startGrind()'),
                        createFeatureItem('healingBeta', 'New Healing Beta', 'Enable the new healing system', '', true),
                        createFeatureItem('antipush', 'AntiPush', 'Prevents being pushed by other players', '', true),
                        createSelectItem('instaType', 'InstaKill Type', {
                            "OneShot": {id: "oneShot", selected: true},
                            "Spammer": {id: "spammer"}
                        }),
                        createSelectItem('preplacerType', 'preplacerType', {
                            "preplacerspike": {id: "preplacerspike", selected: true},
                            "preplacertrap": {id: "preplacertrap"}
                        }),
                        createSelectItem('antiBullType', 'AntiBull Type', {
                            "Disable AntiBull": {id: "noab", selected: true},
                            "When Reloaded": {id: "abreload"},
                            "Primary Reloaded": {id: "abalway"}
                        }),
                        createFeatureItem('backupNobull', 'Backup Nobull Insta', 'Fallback no-bull instant kill', '', true),
                        createFeatureItem('turretCombat', 'Turret Gear Combat Assistance', 'Helps with turret combat', '', true),
                        createFeatureItem('safeAntiSpikeTick', 'Safe AntiSpikeTick', 'Prevents spike damage', '', true)
                    ]);
                    tabContent.appendChild(combatTab);
                    //music tab
                    //@visuals/credits - Error_King
                    const musicTab = createTab('music', '', [
                        createMusicSection()
                    ]);
                    tabContent.appendChild(musicTab);
                    content.appendChild(tabContent);
                    menuContainer.appendChild(content);
                    const footer = document.createElement('div');
                    footer.className = 'menu-footer';
                    footer.innerHTML = `
            <div class="menu-author">Created by ${MenuConfig.author}</div>
            <button class="menu-close">CLOSE MENU</button>
        `;
                    menuContainer.appendChild(footer);
                    const playerContainer = document.createElement('div');
                    playerContainer.id = 'musicPlayer';
                    playerContainer.style.position = 'fixed';
                    playerContainer.style.bottom = '0';
                    playerContainer.style.right = '0';
                    playerContainer.style.width = '0';
                    playerContainer.style.height = '0';
                    document.body.appendChild(playerContainer);
                    document.body.appendChild(menuContainer);
                    setupEventListeners();
                    initDataStream();
                    window.onYouTubeIframeAPIReady = function() {
                        player = new YT.Player('musicPlayer', {
                            height: '0',
                            width: '0',
                            videoId: '',
                            playerVars: { 'autoplay': 1, 'controls': 0, 'mute': 0 },
                            events: {
                                'onReady': onPlayerReady
                            }
                        });
                    };
                    function onPlayerReady(event) {
                        console.log('YouTube Player is ready');
                    }
                }
                function createTab(id, activeClass, contentElements) {
                    const tab = document.createElement('div');
                    tab.className = `tab-pane ${activeClass} ${id}-tab`;
                    tab.id = `${id}-tab`;
                    contentElements.forEach(el => tab.appendChild(el));
                    return tab;
                }
                function createFeatureItem(id, title, description, specialClass = '', isChecked = false, sliderValue = 50, onclick = '') {
                    const feature = document.createElement('div');
                    feature.className = `feature-item ${specialClass}`;
                    const featureId = id.toLowerCase().replace(/\s+/g, '-');
                    feature.innerHTML = `
            <div class="feature-header">
                <div class="feature-tooltip">
                    <span class="feature-title">${title}</span>
                    <span class="tooltip-text">${description}</span>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="${id}" ${isChecked ? 'checked' : ''} ${onclick ? `onclick="${onclick}"` : ''}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="feature-description">${description}</div>
        `;

                    return feature;
                }
                function createSelectItem(id, title, options) {
                    const container = document.createElement('div');
                    container.className = 'feature-item';
                    const select = document.createElement('select');
                    select.className = 'Cselect';
                    select.id = id;
                    for (const [text, config] of Object.entries(options)) {
                        const option = document.createElement('option');
                        option.value = config.id;
                        option.textContent = text;
                        if (config.selected) option.selected = true;
                        select.appendChild(option);
                    }
                    container.innerHTML = `
            <div class="feature-header">
                <div class="feature-tooltip">
                    <span class="feature-title">${title}</span>
                </div>
            </div>
        `;
                    container.querySelector('.feature-header').appendChild(select);
                    return container;
                }
                function createMusicSection() {
                    const section = document.createElement('div');
                    section.className = 'feature-list';
                    const header = document.createElement('div');
                    header.className = 'section-header';
                    header.textContent = 'Visuals/Credits: Error_King';
                    section.appendChild(header);
                    musicList.forEach(music => {
                        const musicItem = document.createElement('div');
                        musicItem.className = 'music-item';
                        const musicButton = document.createElement('button');
                        musicButton.className = 'music-button';
                        musicButton.textContent = music.name + ' (Play)';
                        const stopButton = document.createElement('button');
                        stopButton.className = 'music-stop-button';
                        stopButton.textContent = 'Stop';
                        stopButton.addEventListener('click', () => {
                            if (currentPlayingID) {
                                player.stopVideo();
                                currentPlayingID = null;
                                if (currentButton) {
                                    currentButton.textContent = currentButton.textContent.replace(' (Playing)', ' (Play)');
                                    currentButton.classList.remove('playing');
                                }
                            }
                        });
                        musicButton.addEventListener('click', () => {
                            if (currentPlayingID && currentButton) {
                                player.stopVideo();
                                currentButton.textContent = currentButton.textContent.replace(' (Playing)', ' (Play)');
                                currentButton.classList.remove('playing');
                            }
                            const videoID = extractVideoID(music.url);
                            if (videoID) {
                                player.loadVideoById(videoID);
                                player.playVideo();
                                currentPlayingID = videoID;
                                currentButton = musicButton;
                                musicButton.textContent = music.name + ' (Playing)';
                                musicButton.classList.add('playing');
                            }
                        });
                        musicItem.appendChild(musicButton);
                        musicItem.appendChild(stopButton);
                        section.appendChild(musicItem);
                    });
                    return section;
                }
                function extractVideoID(url) {
                    const videoIDMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                    return videoIDMatch ? videoIDMatch[1] : null;
                }
                function setupEventListeners() {
                    document.addEventListener('keydown', (e) => {
                        if (e.key === MenuConfig.toggleKey) {
                            toggleMenu();
                        }
                    });
                    document.querySelectorAll('.tab-button').forEach(button => {
                        button.addEventListener('click', () => {
                            const tabId = button.getAttribute('data-tab');
                            switchTab(tabId);
                        });
                    });
                    document.querySelector('.menu-close').addEventListener('click', toggleMenu);
                    document.getElementById('weaponGrind')?.addEventListener('change', (e) => {
                        featureStates.weaponGrind = e.target.checked;
                    });
                    document.getElementById('healingBeta')?.addEventListener('change', (e) => {
                        featureStates.healingBeta = e.target.checked;
                    });
                    document.getElementById('antipush')?.addEventListener('change', (e) => {
                        featureStates.antipush = e.target.checked;
                    });
                    document.getElementById('backupNobull')?.addEventListener('change', (e) => {
                        featureStates.backupNobull = e.target.checked;
                    });
                    document.getElementById('turretCombat')?.addEventListener('change', (e) => {
                        featureStates.turretCombat = e.target.checked;
                    });
                    document.getElementById('safeAntiSpikeTick')?.addEventListener('change', (e) => {
                        featureStates.safeAntiSpikeTick = e.target.checked;
                    });
                    document.getElementById('instaType')?.addEventListener('change', (e) => {
                        featureStates.instaType = e.target.value;
                    });
                    document.getElementById('antiBullType')?.addEventListener('change', (e) => {
                        featureStates.antiBullType = e.target.value;
                    });
                }
                function toggleMenu() {
                    const menu = document.getElementById('modMenu');
                    menuVisible = !menuVisible;

                    if (menuVisible) {
                        // Show menu with animations
                        backgroundOverlay.classList.add('visible');
                        menu.classList.add('visible');

                        // Add slight delay to pointer events to prevent accidental clicks during animation
                        backgroundOverlay.style.pointerEvents = 'none';
                        setTimeout(() => {
                            backgroundOverlay.style.pointerEvents = 'auto';
                        }, 400);
                    } else {
                        // Hide menu with animations
                        backgroundOverlay.classList.remove('visible');
                        menu.classList.remove('visible');

                        // Immediately disable pointer events when closing
                        backgroundOverlay.style.pointerEvents = 'none';
                    }
                }
                function switchTab(tabId) {
                    document.querySelectorAll('.tab-button').forEach(button => {
                        button.classList.remove('active');
                        if (button.getAttribute('data-tab') === tabId) {
                            button.classList.add('active');
                        }
                    });
                    document.querySelectorAll('.tab-pane').forEach(pane => {
                        pane.classList.remove('active');
                        if (pane.id === `${tabId}-tab`) {
                            pane.classList.add('active');
                        }
                    });
                    currentTab = tabId;
                }
                function initDataStream() {
                    const dataStream = document.getElementById('dataStream');
                    if (!dataStream) return;
                    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
                    function createDataBit() {
                        const bit = document.createElement('div');
                        bit.className = 'data-bit';
                        bit.textContent = chars.charAt(Math.floor(Math.random() * chars.length));
                        bit.style.left = Math.random() * 100 + '%';
                        bit.style.animationDuration = (Math.random() * 5 + 3) + 's';
                        bit.style.animationDelay = (Math.random() * -5) + 's';
                        dataStream.appendChild(bit);
                        setTimeout(() => {
                            bit.remove();
                        }, 8000);
                    }
                    for (let i = 0; i < 30; i++) {
                        createDataBit();
                    }
                    setInterval(createDataBit, 300);
                }
                createModMenu();

            })();
            let HTML = new Html();
            let menuDiv = document.createElement("div");
            menuDiv.id = "menuDiv";
            document.body.appendChild(menuDiv);
            HTML.set("menuDiv");
            HTML.setStyle(`position: absolute; left: -9999px; top: -9999px;`);
            HTML.resetHTML();
            HTML.setCSS(`#menuDiv { display: none; }`);
            HTML.startDiv({id: "menuHeadLine", class: "menuClass"}, (html) => {
                html.add(`Mod:`);
                html.button({id: "menuChanger", class: "material-icons", innerHTML: `sync`, onclick: "window.changeMenu()"});
                HTML.addDiv({id: "menuButtons", style: "display: block; overflow-y: visible;", class: "menuC", appendID: "menuHeadLine"}, (html) => {
                    html.button({class: "menuB", innerHTML: "Debug", onclick: "window.debug()"});
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
                    html.add(`New Healing Beta:`);
                    html.checkBox({id: "healingBeta", class: "checkB", checked: true});
                    html.newLine();
                });
                html.add(`AntiPush`);
                html.checkBox({
                    id: "antipush",
                    class: "checkB",
                    checked: true
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
                    html.add(`Backup Nobull Insta: `);
                    html.checkBox({id: "backupNobull", class: "checkB", checked: true});
                    html.newLine();
                    html.add(`Turret Gear Combat Assistance: `);
                    html.checkBox({id: "turretCombat", class: "checkB", checked: true});
                    html.newLine();
                    html.add(`Safe AntiSpikeTick: `);
                    html.checkBox({id: "safeAntiSpikeTick", class: "checkB", checked: true});
                    html.newLine();
                });
                HTML.addDiv({id: "menuOther", class: "menuC", appendID: "menuHeadLine"}, (html) => {
                    html.button({class: "menuB", innerHTML: "Connect Bots", onclick: "window.tryConnectBots()"});
                    html.button({class: "menuB", innerHTML: "Disconnect Bots", onclick: "window.destroyBots()"});
                    html.newLine();
                    html.button({class: "menuB", innerHTML: "Connect FBots", onclick: "window.connectFillBots()"});
                    html.button({class: "menuB", innerHTML: "Disconnect FBots", onclick: "window.destroyFillBots()"});
                    html.newLine();
                    html.button({class: "menuB", innerHTML: "Reset Break Objects", onclick: "window.resBuild()"});
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
                    html.checkBox({id: "placeVis", class: "checkB", checked: false});
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
                    html.button({class: "menuB", innerHTML: "Toggle Fbots Circle", onclick: "window.toggleBotsCircle()"});
                    html.newLine();
                    html.add(`Circle Rad: `);
                    html.text({id: "circleRad", class: "customText", value: "200", size: "3em", maxLength: "4"});
                    html.newLine();
                    html.add(`Rad Speed: `);
                    html.text({id: "radSpeed", class: "customText", value: "0.1", size: "2em", maxLength: "3"});
                    html.newLine(2);
                    html.add(`Cross World: `);
                    html.checkBox({id: "funni", class: "checkB", checked: true});

                    html.newLine();
                    html.button({class: "menuB", innerHTML: "Toggle Another Visual", onclick: "window.toggleVisual()"});
                    html.newLine();
                });
            });


            const playerMenu = document.createElement('div');
            playerMenu.id = 'playerDisplay';
            playerMenu.style = `
    position: fixed;
    width: 200px;
    height: 200px;
    background: #00000040;
    right: 15px;
    bottom: 33vh;
    border-radius: 5px;
`;
            playerMenu.innerHTML = `
    <canvas id="playerDisplayCanvas" width="260" height="260" style="position: relative;filter: brightness(0.6);width: 260px;height: 260px;left: -30px;top: -30px;"></canvas>
    <p id="nameLabel" style="position: absolute;width: 100%;margin: 0;top: 130px;text-align: center;color: white;font-size: larger;">Name: </p>
    <p id="primaryLabel" style="position: absolute;width: 100%;margin: 0;top: 150px;text-align: center;color: white;font-size: larger;">Primary: </p>
    <p id="secondaryLabel" style="position: absolute;width: 100%;margin: 0;top: 170px;text-align: center;color: white;font-size: larger;">Secondary: </p>
`;
            document.querySelector('#gameUI').append(playerMenu);

            const displayCanvas = playerMenu.querySelector('canvas');
            const displayCtx = displayCanvas.getContext('2d');
            const nameLabel = playerMenu.querySelector('#nameLabel');
            const primaryLabel = playerMenu.querySelector('#primaryLabel');
            const secondaryLabel = playerMenu.querySelector('#secondaryLabel');
            let menuState = 'open', isAnimating = false, menuActive = true;
            let lastPrimary, lastSecondary, lastName;
            function updatePlayerDisplay() {
                const displayPlayer = near;
                if(!displayPlayer?.active || !menuActive) {
                    if(menuState == 'open' && !isAnimating) {
                        isAnimating = true;
                        playerMenu.animate([
                            //{ right: "15px", opacity: 1 },
                            { right: "-215px", opacity: 0 }
                        ], { duration: 200, fill: 'forwards' }).onfinish = () => {
                            playerMenu.style.display = 'none';
                            menuState = 'closed';
                            isAnimating = false;
                        };
                    }
                    return;
                }
                if(menuState == 'closed') {
                    isAnimating = true;
                    playerMenu.style.display = '';
                    playerMenu.animate([
                        { right: "15px", opacity: 1 },
                        //{ right: "-215px", opacity: 0 }
                    ], { duration: 200, fill: 'forwards' }).onfinish = () => {
                        menuState = 'open';
                        isAnimating = false;
                    };
                }

                if(lastName != displayPlayer?.name) {
                    lastName = displayPlayer?.name;
                    nameLabel.innerText = `Name: ${lastName}`
    }
                if(lastPrimary != displayPlayer?.primaryIndex) {
                    lastPrimary = displayPlayer?.primaryIndex;
                    primaryLabel.innerText = `Primary: ${items?.weapons[lastPrimary]?.name}`
    }
                if(lastSecondary != displayPlayer?.secondaryIndex) {
                    lastSecondary = displayPlayer?.secondaryIndex;
                    secondaryLabel.innerText = `Secondary: ${items?.weapons[lastSecondary]?.name}`
    }

                displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
                displayCtx.save();
                displayCtx.translate(displayCanvas.width/2, displayCanvas.height/2.5);
                displayCtx.scale(.6, .6);

                displayCtx.save();
                // RENDER PLAYER:
                displayCtx.rotate((displayPlayer.dir ?? 0) + displayPlayer.dirPlus);
                renderPlayer(displayPlayer, displayCtx);
                displayCtx.restore();

                // BORDER
                displayCtx.fillStyle = "#3d3f42";
                const width = config.healthBarWidth * 1.6 + config.healthBarPad * 2;
                displayCtx.roundRect(-width/2, displayPlayer.scale - config.healthBarPad + config.nameY, width, 18, 10);
                displayCtx.fill();
                // HEALTH BAR
                displayCtx.fillStyle = "#cc5151";
                displayCtx.roundRect(config.healthBarPad-width/2, displayPlayer.scale + config.nameY, config.healthBarWidth * 1.6 * (displayPlayer.health / displayPlayer.maxHealth), 18 - config.healthBarPad * 2, 18);
                displayCtx.fill();

                displayCtx.restore();
            }

            let menuChatDiv = document.createElement("div");
            menuChatDiv.id = "menuChatDiv";
            document.body.appendChild(menuChatDiv);
            HTML.set("menuChatDiv");
            HTML.setStyle(`
            position: absolute;
            display: none;
            left: 0px;
            top: 0px;
            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.65);
            `);
            HTML.resetHTML();
            HTML.setCSS(`
            .chDiv{
                color: #fff;
                padding: 5px;
                width: 340px;
                height: 280px;
                background-color: rgba(0, 0, 0, 0.35);
            }
            .chMainDiv{
                font-family: "Ubuntu";
                font-size: 12px;
                max-height: 235px;
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
                width: 335px;
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

            function addMenuChText(name, message, color, noTimer) {
                HTML.set("menuChatDiv");
                color = color||"white";

                let time = new Date();
                let min = time.getMinutes();
                let hour = time.getHours();

                let getAMPM = hour >= 12 ? "PM" : "AM";
                let text = ``;
                // if (!noTimer) text += `[${(hour % 12) + ":" + min + " " + getAMPM}]`;
                if (name) text += `${(!noTimer ? " - " : "") + name}`;
                if (message) text += `${(name ? ": " : !noTimer ? " - " : "") + message}\n`;

                HTML.addDiv({id: "menuChDisp" + menuChCounts, style: `color: ${color}`, appendID: "mChMain"}, (html) => {
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
            font: 15px Hammersmith One;
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
            HTML.startDiv({id: "uehmod", class: "sizing"}, (html) => {
                html.add(`Ping: `);
                HTML.addDiv({id: "pingFps", class: "mod", appendID: "uehmod"}, (html) => {
                    html.add("None");
                });
                html.newLine();
                html.add(`Packet: `);
                HTML.addDiv({id: "packetStatus", class: "mod", appendID: "uehmod"}, (html) => {
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
            WebSocket.prototype.send = function (message) {
                if (!WS) {
                    WS = this;
                    WS.addEventListener("message", function (msg) {
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
                    } else if (type == "14") {
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
                    A: setInitData,
                    //B: disconnect,
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
                    //Y: remProjectile,
                    //Z: serverShutdownNotice,
                    //0: addAlliance,
                    //1: deleteAlliance,
                    2: allianceNotification,
                    3: setPlayerTeam,
                    4: setAlliancePlayers,
                    5: updateStoreItems,
                    6: receiveChat,
                    7: updateMinimap,
                    8: showText,
                    9: pingMap,
                    //0: pingSocketResponse,
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

            let petals = [];
            let allChats = [];

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

            let gameName = getEl("gameName");
            if (gameName) gameName.innerText = "";
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
            if (chatBox) chatBox.style.textAlign = "center";
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
                39: [1, 0],
            };
            let attackState = 0;
            let inGame = false;

            let macro = {};
            let pads = {placeSpawnPads:0};
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
                            x: type1 == 0 ? tmp1.x : type1 == 1 ? tmp1.x1 : type1 == 2 ? tmp1.x2 : type1 == 3 && tmp1.x3,
                            y: type1 == 0 ? tmp1.y : type1 == 1 ? tmp1.y1 : type1 == 2 ? tmp1.y2 : type1 == 3 && tmp1.y3,
                        };
                        let tmpXY2 = {
                            x: type2 == 0 ? tmp2.x : type2 == 1 ? tmp2.x1 : type2 == 2 ? tmp2.x2 : type2 == 3 && tmp2.x3,
                            y: type2 == 0 ? tmp2.y : type2 == 1 ? tmp2.y1 : type2 == 2 ? tmp2.y2 : type2 == 3 && tmp2.y3,
                        };
                        return mathSQRT((tmpXY2.x -= tmpXY1.x) * tmpXY2.x + (tmpXY2.y -= tmpXY1.y) * tmpXY2.y);
                    };
                    this.getDirection = function (x1, y1, x2, y2) {
                        return mathATAN2(y1 - y2, x1 - x2);
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
                    this.update = function(delta) {
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
                    this.render = function(ctxt, xOff, yOff) {
                        ctxt.lineWidth = 10;
                        ctxt.fillStyle = this.color;
                        ctxt.font = this.scale + "px " + (config.anotherVisual ? "Ubuntu" : "Hammersmith One");
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
                        for(let i = 0; i < this.texts.length; ++i) {
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
                    this.checkCollision2 = function(entity1, entity2) {
                        let deltaX = entity1.x2 - entity2.x;
                        let deltaY = entity1.y2 - entity2.y;
                        let collisionRadius = 35 + (entity2.realScale ? entity2.realScale : entity2.scale);
                        if (Math.abs(deltaX) <= collisionRadius || Math.abs(deltaY) <= collisionRadius) {
                            collisionRadius = 35 + (entity2.getScale ? entity2.getScale() : entity2.scale);
                            let distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY) - collisionRadius;
                            if (distance <= 0) {
                                if (entity2.zIndex > entity1.zIndex) {
                                    entity2.zIndex = entity1.zIndex;
                                }
                                return true;
                            }
                        }
                        return false;
                    }
                    this.customCheckItemLocation = (x, y, s, sM, indx, ignoreWater, placer, ignoreId, gameObjects, UTILS, config) => { // xela code
                        let cantPlace = gameObjects.find(
                            tmp =>
                            tmp.active &&
                            tmp.x !== ignoreId.x &&
                            tmp.y !== ignoreId.y &&
                            tmp.id !== ignoreId.id &&
                            UTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem))
                        );
                        if (cantPlace) return false;
                        if (!ignoreWater && indx != 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) return false;
                        return true;
                    };
                }
            }
            this.replaceable = (idkdude) => { // testiiinggg // own code lelelelle
                let maxSteps = Math.PI;
                let ut = [];
                let ht;
                let stepIncrement = Math.PI / 12;
                let radius = player.list[15].scale + 30;
                for (let i = 0; i < ut.length; i++) {
                    let obj = ut[i];
                    if (obj && player.getDist(obj, ht, 0, 2) <= 160) {
                        for (let angle = 0; angle <= maxSteps; angle += stepIncrement) {
                            let pos = player.calculatePosition(obj, radius, angle);
                            if (objectManager.checkItemLocation(pos.x, pos.y, 52, 0.6, false, false, idkdude) ||
                                (pos = player.calculatePosition(obj, radius, angle + maxSteps),
                                 objectManager.checkItemLocation(pos.x, pos.y, 52, 0.6, false, false, idkdude))) {
                                return true;
                            }
                        }
                    }
                }
                return false;
            }
            this.aboutToBroke = function(itemObj) {
                if (!inGame || !itemObj || enemy.length === 0) return false;
                let useHammerClick = this.useHammer(itemObj);
                let currentWeaponIndex = player.weapons[useHammerClick ? 1 : 0];
                let playerWeaponType = currentWeaponIndex < 9 ? "primaryVariant" : "secondaryVariant";
                let playerVariantId = player[playerWeaponType];
                let playerVariantMulti = playerVariantId !== undefined ?
                    config.weaponVariants[playerVariantId].val : 1;
                let playerWeaponDamage = items.weapons[currentWeaponIndex].dmg;
                let enemyWeaponIndex;
                if (near.secondaryIndex !== undefined && near.primaryIndex !== undefined) {
                    if (near.secondaryIndex === 10 &&
                        (itemObj.health > items.weapons[near.weapons[0]].dmg || near.primaryIndex === 5)) {
                        enemyWeaponIndex = near.secondaryIndex;
                    } else {
                        enemyWeaponIndex = near.primaryIndex;
                    }
                } else {
                    enemyWeaponIndex = 10;
                }
                let enemyWeaponType = enemyWeaponIndex < 9 ? "primaryVariant" : "secondaryVariant";
                let enemyVariantId = near[enemyWeaponType];
                let enemyVariantMulti = config.weaponVariants[enemyVariantId].val;
                let enemyWeaponDamage = items.weapons[enemyWeaponIndex].dmg;
                const damageMultiplier = 3.3;
                const specialDamageMultiplier = items.weapons[currentWeaponIndex].sDmg || 1;
                let totalDamage = 0;
                let enemyCanAttack = near.reloads[enemyWeaponIndex] === 0 &&
                    this.canHit(near, itemObj, enemyWeaponIndex, 24);
                if (enemyCanAttack) {
                    totalDamage += enemyWeaponDamage * damageMultiplier * enemyVariantMulti * specialDamageMultiplier;
                }
                let playerCanAttack = player.reloads[currentWeaponIndex] === 0 &&
                    (clicks.right || traps.inTrap);
                if (playerCanAttack) {
                    totalDamage += playerWeaponDamage * damageMultiplier * playerVariantMulti * specialDamageMultiplier;
                }
                return itemObj.health <= totalDamage;
            };
            this.checkItemLocationPrePlace = function (x, y, s, sM, indx, ignoreWater, placer, objToIgnore) {
                let cantPlace = liztobj.find((tmp) => tmp.sid != objToIgnore.sid && tmp.active && UTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
                if (cantPlace) return false;
                if (!ignoreWater && indx != 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) return false;
                return true;
            };
            this.preplaceCheck = function (x, y, s, sM, indx, ignoreWater, object) {
                let cantPlace = gameObjects.find((tmp) => tmp.sid != object.sid && UTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
                if (cantPlace) return false;
                if (!ignoreWater && indx != 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) return false;
                return UTILS.getDistance(x, y, object.x, object.y) <= s + object.scale;
            };
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
                        this.lastHealTick = 0;
                        this.lastShameDecay = 0;
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
                        if (this.sid == playerSID) {
                            this.circleRad = parseInt(getEl("circleRad").value)||0;
                            this.circleRadSpd = parseFloat(getEl("radSpeed").value)||0;
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
                    this.judgeShame = function () {
                        if (this.oldHealth < this.health) {
                            let healAmount = this.health - this.oldHealth;
                            if (this.hitTime) {
                                let timeSinceHit = game.tick - this.hitTime;
                                this.lastHit = game.tick;
                                this.hitTime = 0;
                                if (timeSinceHit < 2) {
                                    if (healAmount > 20) {
                                        this.shameCount += Math.min(3, Math.floor(healAmount / 15));
                                    } else {
                                        this.shameCount++;
                                    }
                                } else if (timeSinceHit < 5) {
                                    if (healAmount > 30) {
                                        this.shameCount += 2;
                                    } else {
                                        this.shameCount = Math.max(0, this.shameCount - 1);
                                    }
                                } else {
                                    this.shameCount = Math.max(0, this.shameCount - 2);
                                }
                            } else if (healAmount > 35 && game.tick - this.lastHealTick < 10) {
                                this.shameCount += 2;
                            }
                            this.lastHealTick = game.tick;
                        } else if (this.oldHealth > this.health) {
                            this.hitTime = game.tick;
                            if (this.shameCount > 0 && game.tick - this.lastShameDecay > 15) {
                                this.shameCount = Math.max(0, this.shameCount - 1);
                                this.lastShameDecay = game.tick;
                            }
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
                        if (this.reloads[this.weaponIndex] <= 1000/9) {
                            let index = this.weaponIndex;
                            let nearObja = liztobj.filter((e) => (e.active || e.alive) && e.health < e.maxHealth && e.group !== undefined && UTILS.getDist(e, player, 0, 2) <= (items.weapons[player.weaponIndex].range + e.scale));
                            for(let i = 0; i < nearObja.length; i++) {
                                let aaa = nearObja[i];
                                let val = items.weapons[index].dmg * (config.weaponVariants[tmpObj[(index < 9 ? "prima" : "seconda") + "ryVariant"]].val) * (items.weapons[index].sDmg || 1) * 3.3;
                                let valaa = items.weapons[index].dmg * (config.weaponVariants[tmpObj[(index < 9 ? "prima" : "seconda") + "ryVariant"]].val) * (items.weapons[index].sDmg || 1);
                                if(aaa.health - (valaa) <= 0 && near.length) {
                                    place(near.dist2<((near.scale * 1.8) + 50)?4:2, caf(aaa, player) + Math.PI);
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
                    this.addDamageThreat = function(enemy) {
                        let damageThreat = 0;
                        const bullMultiplier = 1.5;
                        const defaultPrimaryDmg = 45;
                        const defaultSecondaryDmg = 50;
                        const defaultVariantVal = 1.18;
                        let primary = {
                            weapon: this.primaryIndex,
                            variant: this.primaryVariant,
                            dmg: this.primaryIndex === undefined ? defaultPrimaryDmg : items.weapons[this.primaryIndex].dmg
                        };
                        let secondary = {
                            weapon: this.secondaryIndex,
                            variant: this.secondaryVariant,
                            dmg: this.secondaryIndex === undefined ? defaultSecondaryDmg : items.weapons[this.secondaryIndex].Pdmg
                        };
                        let pV = primary.variant !== undefined ? config.weaponVariants[primary.variant].val : defaultVariantVal;
                        let sV = secondary.variant !== undefined ?
                            ([9, 12, 13, 15].includes(secondary.weapon) ? 1 : config.weaponVariants[secondary.variant].val) :
                        defaultVariantVal;
                        const cxcValue = enemy.health !== undefined ? enemy.health - enemy.maxHealth : 0;
                        const primaryCxC = applCxC(cxcValue, this.skinIndex, primary.weapon);
                        const secondaryCxC = applCxC(cxcValue, this.skinIndex, secondary.weapon);
                        if (!configs.ok.checked) {
                            if (primary.weapon === undefined ||
                                ('range' in items.weapons[primary.weapon] &&
                                 this.dist2 <= items.weapons[primary.weapon].range + enemy.scale * 1.8 + 30 &&
                                 this.reloads[primary.weapon] === 0)) {
                                damageThreat += (primary.dmg * pV * bullMultiplier) + primaryCxC;
                            }
                            if (secondary.weapon === undefined ||
                                ('range' in items.weapons[secondary.weapon] &&
                                 this.dist2 <= items.weapons[secondary.weapon].range + enemy.scale * 1.8 + 30 &&
                                 this.reloads[secondary.weapon] === 0) ||
                                !('range' in items.weapons[secondary.weapon]) && this.reloads[secondary.weapon] === 0) {
                                damageThreat += (secondary.dmg * sV) + secondaryCxC;
                            }
                        } else {
                            if (primary.weapon === undefined || this.reloads[primary.weapon] === 0) {
                                damageThreat += (primary.dmg * pV * bullMultiplier) + primaryCxC;
                            }
                            if (secondary.weapon === undefined || this.reloads[secondary.weapon] === 0) {
                                damageThreat += (secondary.dmg * sV) + secondaryCxC;
                            }
                        }
                        if (this.reloads[53] === 0) {
                            damageThreat += 25;
                        }
                        if (enemy.my && enemy.my.predictSpikes > 0) {
                            let spikeDmg = (secondary.weapon === 10 ? 45 : 35) * enemy.my.predictSpikes;
                            damageThreat += spikeDmg;
                            if (this.mostDamageThreat !== undefined) {
                                this.mostDamageThreat += spikeDmg;
                            }
                            enemy.my.predictSpikes = 0;
                        }
                        if (enemy.poisonCounter > 0) {
                            damageThreat += 5;
                        }
                        if (enemy.projectile && enemy.projectile.count) {
                            damageThreat += enemy.projectile.dmg;
                        }
                        if (enemy.skinIndex === 6) {
                            let applyReduction = true;
                            if (typeof instaC !== 'undefined' && instaC.isTrue) {
                                applyReduction = false;
                            }
                            if (applyReduction) {
                                damageThreat *= 0.75;
                            }
                        }
                        if (!this.isTeam(enemy) && this.dist2 <= 300) {
                            enemy.damageThreat += damageThreat;
                            if (this.mostDamageThreat !== undefined) {
                                this.mostDamageThreat = Math.max(this.mostDamageThreat, damageThreat);
                            }
                        }
                        if (this.damageProbably !== undefined) {
                            this.damageProbably = 0;
                            if (this.reloads[primary.weapon] === 0) {
                                this.damageProbably += (primary.dmg * pV * bullMultiplier * 0.75) + primaryCxC;
                            }
                            if (this.reloads[secondary.weapon] === 0) {
                                this.damageProbably += (secondary.dmg * sV) + secondaryCxC;
                            }
                            this.damageProbably *= 0.75;
                            if (!this.isTeam(enemy) && this.dist2 <= 300 && enemy.damageProbably !== undefined) {
                                enemy.damageProbably += this.damageProbably;
                            }
                        }
                        return damageThreat;
                    };
                }
            };
            function caf(e, t) {
                try {
                    return Math.atan2(
                        (t.y2 || t.y) - (e.y2 || e.y),
                        (t.x2 || t.x) - (e.x2 || e.x)
                    );
                } catch (e) {
                    return 0;
                }
            }
            function toRad(angle) {
                return (angle * Math.PI) / 180;
            }
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
                                        //setTimeout(()=>{
                                        packet("c", 1, id, 0);
                                        //setTimeout(()=>{
                                        packet("c", 0, id, 0);
                                        //}, 120);
                                        //}, 120);
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
                                        // setTimeout(()=>{
                                        packet("c", 0, id, 1);
                                        //}, 120);
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
            let phantom = [];
            function FastPlace(id, rad) {
                try {
                    const Render = true ? 1 : 0;
                    place(id, rad, Render);
                } catch (e) {}
            }
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
            function normalizeAngle(angle) {
                const PI2 = Math.PI * 2;
                return ((angle % PI2) + PI2) % PI2;
            }
            function getQuadrant(angle) {
                const normalized = normalizeAngle(angle);
                if (normalized < Math.PI / 2) return 1;
                if (normalized < Math.PI) return 2;
                if (normalized < 3 * Math.PI / 2) return 3;
                return 4;
            }
            function inBetween(angle, range) {
                const [start, end] = range;
                const normalizedAngle = normalizeAngle(angle);
                const normalizedStart = normalizeAngle(start);
                const normalizedEnd = normalizeAngle(end);
                if (normalizedStart <= normalizedEnd) {
                    return normalizedAngle >= normalizedStart && normalizedAngle <= normalizedEnd;
                }
                return normalizedAngle >= normalizedStart || normalizedAngle <= normalizedEnd;
            }
            function mergeAngleRanges(ranges) {
                if (!ranges.length) return [];
                const normalized = ranges
                .filter(r => r.length >= 2)
                .map(r => ({
                    start: normalizeAngle(r[0]),
                    end: normalizeAngle(r[1]),
                    data: r.slice(2)
                }))
                .sort((a, b) => a.start - b.start);
                const merged = [normalized[0]];
                for (let i = 1; i < normalized.length; i++) {
                    const current = normalized[i];
                    const last = merged[merged.length - 1];
                    if (inBetween(current.start, [last.start, last.end]) ||
                        inBetween(current.end, [last.start, last.end]) ||
                        inBetween(last.start, [current.start, current.end])) {
                        last.end = normalizeAngle(Math.max(
                            last.end < last.start ? last.end + Math.PI * 2 : last.end,
                            current.end < current.start ? current.end + Math.PI * 2 : current.end
                        ));
                        last.data.push(...current.data);
                    } else {
                        merged.push(current);
                    }
                }
                return merged.map(r => [r.start, r.end, ...r.data]);
            }
            function calculateObjectAngles(building, itemId) {
                const item = items.list[itemId < items.list.length ? itemId : player.items[2]];
                const tmpS = player.scale + item.scale + (item.placeOffset || 0);
                let scale;
                if (!building.isItem) {
                    if ((building.scale !== 80 && building.scale !== 85 && building.scale !== 90) || building.type === 1) {
                        scale = building.scale * 0.4;
                    } else {
                        scale = building.scale;
                    }
                } else {
                    scale = building.scale;
                }
                const dist = item.scale + scale + 1;
                const dPTB = UTILS.getDist(player, building, 0, 2);
                let cosLaw;
                if (dPTB > dist + tmpS) {
                    cosLaw = Math.acos((tmpS * tmpS + dist * dist - dPTB * dPTB) / (2 * dist * tmpS));
                    cosLaw = Math.asin((dist * Math.sin(cosLaw)) / dPTB);
                } else {
                    cosLaw = Math.acos((tmpS * tmpS + dPTB * dPTB - dist * dist) / (2 * dPTB * tmpS));
                }
                if (isNaN(cosLaw)) return null;
                const aPTB = Math.atan2(building.y - player.y2, building.x - player.x2);
                return [aPTB - cosLaw, aPTB + cosLaw, building];
            }
            function makeAng(build, id) {
                const buildings = gameObjects.filter(obj =>
                                                     UTILS.getDist(player, obj, 0, 2) < 250 && obj.active
                                                    );
                const fullAng = buildings
                .map(b => calculateObjectAngles(b, id))
                .filter(angles => angles !== null);
                if (!fullAng.length) return [[0, 0.0001]];
                let merged = fullAng;
                for (let i = 0; i < 3; i++) {
                    merged = mergeAngleRanges(merged);
                }
                for (let i = 0; i < merged.length; i++) {
                    if (!checkPlace(id, merged[i][0]) || !checkPlace(id, merged[i][1])) {
                        return false;
                    }
                }
                return merged;
            }
            function makeAngles(building, type) {
                const item = items.list[type];
                const offset = player.scale + item.scale + (item.placeOffset || 0);
                const buildings = building.filter(obj =>
                                                  UTILS.getDist(player, obj, 0, 2) < player.scale + item.scale + obj.scale + 50 && obj.active
                                                 );
                const allAngles = buildings
                .map(b => {
                    let scale;
                    if (!b.isItem) {
                        if ((b.scale !== 80 && b.scale !== 85 && b.scale !== 90) || b.type === 1) {
                            scale = b.scale * 0.4;
                        } else {
                            scale = b.scale;
                        }
                    } else {
                        scale = b.scale;
                    }
                    const dist = item.scale + scale + 1;
                    const dPTB = UTILS.getDist(player, b, 0, 2);
                    let cosLaw;
                    if (dPTB > dist + offset) {
                        cosLaw = Math.acos((offset * offset + dist * dist - dPTB * dPTB) / (2 * dist * offset));
                        cosLaw = Math.asin((dist * Math.sin(cosLaw)) / dPTB);
                    } else {
                        cosLaw = Math.acos((offset * offset + dPTB * dPTB - dist * dist) / (2 * dPTB * offset));
                    }
                    if (isNaN(cosLaw)) return null;
                    const aPTB = Math.atan2(b.y - player.y2, b.x - player.x2);
                    return [aPTB - cosLaw, aPTB + cosLaw, b];
                })
                .filter(angles => angles !== null);
                if (!allAngles.length) return [[0, 0.0001]];
                let merged = allAngles;
                for (let i = 0; i < 3; i++) {
                    merged = mergeAngleRanges(merged);
                }
                for (let i = 0; i < merged.length; i++) {
                    if (!checkPlace(type, merged[i][0]) || !checkPlace(type, merged[i][1])) {
                        return false;
                    }
                }
                return merged;
            }
            let brokenObj = [];
            function calculatePosition(origin, distance, angle) {
                return {
                    x: origin.x2 + distance * Math.cos(angle),
                    y: origin.y2 + distance * Math.sin(angle)
                };
            }
            function validateAngle(angle, resultsArray) {
                const spikeId = player.items[2];
                const trapId = 15;
                const spikeItem = items.list[spikeId];
                const trapItem = items.list[trapId];
                const spikeDist = player.scale + spikeItem.scale + (spikeItem.placeOffset || 0);
                const trapDist = player.scale + trapItem.scale + (trapItem.placeOffset || 0);
                const angleResult = {
                    angle: angle,
                    trap: false,
                    spike: false,
                    prioritization: 0,
                    pos: {},
                    brokenDist: Infinity,
                    enemyDist: Infinity,
                };
                const trapPos = calculatePosition(player, trapDist, angle);
                if (objectManager.checkItemLocation(trapPos.x, trapPos.y, trapItem.scale, 0.6, trapId, false)) {
                    angleResult.trap = true;
                    angleResult.pos.trap = { ...trapPos, scale: trapItem.scale };
                }
                const spikePos = calculatePosition(player, spikeDist, angle);
                if (objectManager.checkItemLocation(spikePos.x, spikePos.y, spikeItem.scale, 0.6, spikeId, false)) {
                    angleResult.spike = true;
                    angleResult.prioritization++;
                    angleResult.pos.spike = { ...spikePos, scale: spikeItem.scale, dmg: spikeItem.dmg };
                }
                if (angleResult.spike || angleResult.trap) {
                    const targetPos = angleResult.pos.spike || angleResult.pos.trap;
                    if (brokenObj.length > 0) {
                        const nearestBroken = brokenObj.reduce((nearest, obj) => {
                            const dist = UTILS.getDistance(obj, targetPos);
                            return dist < UTILS.getDistance(nearest, targetPos) ? obj : nearest;
                        });
                        angleResult.brokenDist = UTILS.getDistance(nearestBroken, targetPos);
                    }
                    angleResult.enemyDist = UTILS.getDistance(near.Enemy, targetPos);
                    if (angleResult.brokenDist <= angleResult.enemyDist) {
                        angleResult.prioritization++;
                    }
                    resultsArray.push(angleResult);
                }
            }
            function findAngles(offset = 0) {
                const depthInput = 16;
                const dualAngleEnabled = true;
                const step = Math.PI / depthInput;
                const spikeId = player.items[2];
                const trapId = 15;
                const spikeItem = items.list[spikeId];
                const trapItem = items.list[trapId];
                const validAngles = [];
                for (let angle = 0; angle <= Math.PI * 2; angle += step) {
                    validateAngle(angle + offset, validAngles);
                }
                if (dualAngleEnabled && game.closeObjects) {
                    const maxScale = Math.max(spikeItem.scale, trapItem.scale);
                    const nearbyObjects = game.closeObjects.filter(obj =>
                                                                   obj.active && UTILS.getDistance(obj, player) <= player.scale + maxScale + obj.scale
                                                                  );
                    for (let k = 0; k < nearbyObjects.length; k++) {
                        const current = nearbyObjects[k];
                        const next = nearbyObjects[(k + 1) % nearbyObjects.length];
                        if (current && next) {
                            let angle1 = normalizeAngle(UTILS.getDirection(current, player));
                            let angle2 = normalizeAngle(UTILS.getDirection(next, player));
                            let midAngle = (angle1 + angle2) / 2;
                            if (Math.abs(angle1 - angle2) > Math.PI) {
                                midAngle = normalizeAngle(midAngle + Math.PI);
                            }
                            validateAngle(midAngle, validAngles);
                        }
                    }
                }
                return validAngles.sort((a, b) => {
                    if (b.prioritization !== a.prioritization) return b.prioritization - a.prioritization;
                    if (a.brokenDist !== b.brokenDist) return a.brokenDist - b.brokenDist;
                    return a.enemyDist - b.enemyDist;
                });
            }














            let bestMonkeys = 0;
            // UPDATE HEALTH:
            let ticks = {
                tick: 0,
                delay: 0,
                time: [],
                manage: [],
            };
            let backupAnti = [];
            let hittedTime = Date.now();
            let stopHealing = false;
            function setTickout(doo, timeout) {
                if (!ticks.manage[ticks.tick + timeout]) {
                    ticks.manage[ticks.tick + timeout] = [doo];
                } else {
                    ticks.manage[ticks.tick + timeout].push(doo);
                }
            }
            // UPDATE HEALTH:
            let doEmpAntiInsta = false;
            let judgeAtNextTick = false;





            function antirev() {
                if (!tmpObj.isPlayer) return;
                const attackDir = getAttackDir();
                const health = player.health;
                const shameCount = player.shameCount;
                const skinIndex = player.skinIndex;
                const isSoldier = skinIndex === 6;
                let placements = 1;
                if (isSoldier) {
                    if ((health === 55 || health === 58.75) && shameCount < 4) {
                        placements = health === 58.75 ? 2 : 1;
                    } else if (health === 43.75 && shameCount < 3) {
                        placements = 2;
                    } else if (health === 25 && shameCount < 2) {
                        placements = 2;
                    }
                } else {
                    if (health === 40 && shameCount < 4) {
                        placements = 1;
                    } else if (health === 45 && shameCount < 4) {
                        placements = 2;
                    }
                }
                const cxcBonus = applCxC(player.health - 100, player.weapons[0]);
                const iterations = Math.min(healthBased(), 1000);
                for (let i = 0; i < iterations; i++) {
                    place(0, attackDir);
                    if (placements > 1) {
                        place(0, attackDir);
                    }
                }
            }
            function applCxC(value, weaponIndex = 0) {
                if (player.skinIndex === 45 || player.skinIndex === 56) return 0;
                if (typeof value !== 'number' || isNaN(value)) return 0;

                switch (weaponIndex) {
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
            let bullTicked = false;
            function checkFastHealDefault(damaged, tmpObj) {
                const weaponDmg = items.weapons[player.weapons[0]]?.dmg || 0;
                const gearDmgs = [0.25, 0.45].map(val => val * weaponDmg * soldierMult());
                const includeSpikeDmgs = enemy.length > 0 &&
                      !bullTicked &&
                      gearDmgs.includes(damaged) &&
                      near.skinIndex === 11;
                const minDamage = includeSpikeDmgs ? 8 : 25;
                const healthDeficit = 100 - player.health;
                const totalThreat = healthDeficit + player.damageThreat;
                const ticksSinceAnti = game.tick - player.antiTimer;
                return damaged >= minDamage &&
                    totalThreat >= 80 &&
                    ticksSinceAnti > 1;
            }
            function checkFastHeal(near, damaged, tmpObj, shameCountThreshold = 5) {
                if (!near || !tmpObj) return false;
                const healthDeficit = 100 - player.health;
                const totalThreat = player.damageThreat + healthDeficit;
                const cxcValue = applCxC(player.health - 100, player.weapons[0]);
                const weaponDmg = items.weapons[player.weapons[0]]?.dmg || 0;
                const gearDmgs = [0.25, 0.45].map(val => val * weaponDmg * soldierMult());
                const ticksSinceAnti = game.tick - player.antiTimer;
                const primary = near.primaryIndex;
                const secondary = near.secondaryIndex;
                if ([0, 7, 8].includes(primary)) {
                    return damaged < 75;
                }
                if ([1, 2, 6].includes(primary)) {
                    return damaged >= 25 &&
                        totalThreat >= 95 &&
                        tmpObj.shameCount < 5;
                }
                if ([undefined, 5].includes(primary)) {
                    const spikeAdjustment = gearDmgs.includes(damaged) && near.skinIndex === 11 ? 15 : 20;
                    return healthDeficit >= spikeAdjustment &&
                        tmpObj.damageThreat + healthDeficit >= 50 &&
                        tmpObj.shameCount < 6;
                }
                if (primary === 3 && secondary === 15) {
                    return damaged >= 35 &&
                        totalThreat >= 95 &&
                        tmpObj.shameCount < 5 &&
                        ticksSinceAnti > 1;
                }
                if (primary === 4) {
                    const variant = near.primaryVariant || 0;
                    if (variant >= 1) {
                        return damaged >= 10 &&
                            totalThreat >= 95 &&
                            tmpObj.shameCount < 4;
                    } else {
                        return damaged >= 35 &&
                            totalThreat >= 95 &&
                            tmpObj.shameCount < 3;
                    }
                }
                if (primary === 6 && secondary === 15) {
                    return damaged >= 25 &&
                        tmpObj.damageThreat + healthDeficit >= 95 &&
                        tmpObj.shameCount < 4;
                }
                return damaged >= 25 &&
                    totalThreat >= 95 &&
                    cxcValue >= 2;
            }
            function handleFastHeal(tmpObj, shameCountThreshold = 5) {
                if (!tmpObj) return;
                const weapon1 = tmpObj.weapons?.[1];
                const canEmpAnti = tmpObj.reloads?.[53] === 0 &&
                      weapon1 !== undefined &&
                      tmpObj.reloads?.[weapon1] === 0;

                if (canEmpAnti) {
                    tmpObj.canEmpAnti = true;
                } else {
                    player.soldierAnti = true;
                }
                tmpObj.antiTimer = game.tick;
                if (tmpObj.shameCount < shameCountThreshold) {
                    healer();
                } else {
                    const counterValue = shouldCounter(near, player);
                    antirev(60, counterValue);
                }
            }
            function shouldCounter(near, player) {
                if (!near || !player) return 1;
                const nearIsBow = near.primaryIndex === 7;
                const playerIsBow = player.weapons?.[0] === 7;
                const nearIsSpecial = near.skinIndex === 11 || near.tailIndex === 21;
                return nearIsBow || (playerIsBow && nearIsSpecial) ? 0 : 1;
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
            /*function getAttacker(damaged) {
                if (!enemy || !Array.isArray(enemy)) return [];
                return enemy.filter(tmp => {
                    if (!tmp) return false;
                    const isAttacking = tmp.attacked ||
                          tmp.isAttacking ||
                          (tmp.dist2 !== undefined && tmp.dist2 < 200) ||
                          (tmp.damageThreat !== undefined && tmp.damageThreat > 0);

                    return isAttacking;
                });
            }*/
            // HEALING:


            const pingHeal = () => Math.max(10, (9 * 0.25) + (window.pingTime || 0));

            // Calculate soldier multiplier
            function soldierMult() {
                return player.skinIndex === 6 ? 1.0 : 0.75;
            }

            function healthBased() {
                if (!player || !player.alive) return 0;
                const playerHealth = player.health;
                const skinIndex = player.skinIndex;
                if (playerHealth === 100 || skinIndex === 45 || skinIndex === 56) {
                    return 0;
                }
                const currentItemIndex = player.items?.[0];
                if (currentItemIndex === undefined) return 0;
                const currentItem = items.list?.[currentItemIndex];
                if (!currentItem || !currentItem.healing) {
                    return 0;
                }
                const effectiveHealing = currentItem.healing * soldierMult();
                const remainingHealth = 100 - playerHealth;
                const itemsNeeded = Math.ceil(remainingHealth / effectiveHealing);
                return Math.max(0, itemsNeeded);
            }
            this.getHealThreshold = function() {
                const shame = this.shameCount || 0;
                if (shame >= 10) return 99;
                if (shame >= 8) return 95;
                if (shame >= 7) return 90;
                if (shame >= 5) return 80;
                if (shame >= 3) return 70;
                return 60;
            };

            this.getCriticalThreshold = function() {
                const shame = this.shameCount || 0;
                if (shame >= 9) return 70;
                if (shame >= 7) return 60;
                if (shame >= 5) return 45;
                if (shame >= 3) return 35;
                return 30;
            };

            this.getHealDelay = function() {
                return Math.min(200, (this.shameCount || 0) * 30);
            };

            this.shouldDelayHeal = function() {
                return (this.shameCount || 0) > 2;
            };
            function initiateHealing() {
                const interval = setInterval(() => {
                    const healingAmount = healthBased();
                    const healingItem = items.list[player.items[0]];
                    if (healingAmount > 0) {
                        const effectiveHealing = healingItem.healing * soldierMult();
                        player.health += effectiveHealing;
                        if (player.health > 100) {
                            player.health = 100;
                            clearInterval(interval);
                        }
                    } else {
                        clearInterval(interval);
                    }
                }, 1);
            }



            function autoHeal() {
                if (!player || !player.alive || !inGame) return;
                if (player.health === 100 && (!enemy || !enemy.length)) return;
                const shame = player.shameCount || 0;
                let healThreshold = 75;
                if (shame >= 5) healThreshold = 90;
                else if (shame >= 3) healThreshold = 85;
                else if (shame >= 1) healThreshold = 80;
                if (near && near.dist2 <= 300) {
                    healThreshold = shame >= 3 ? 85 : 60;
                }
                if (player.health < healThreshold && player.health < 100) {
                    if (shame >= 5) {
                        game.tickBase(() => healer());
                    } else {
                        healer1();
                    }
                }
            }
            function healer(extra = 0) {
                if (!player || !player.alive) return;
                const baseHeal = healthBased();
                if (baseHeal <= 0 && extra <= 0) return;
                const totalHeal = baseHeal + extra;
                const shame = player.shameCount || 0;
                const attackDir = getAttackDir();
                if (shame > 0) {
                    const shameDelay = Math.min(150, shame * 25);
                    const healSpacing = Math.max(15, 50 - (shame * 3));
                    for (let i = 0; i < totalHeal; i++) {
                        setTimeout(() => {
                            if (player && player.alive && player.health < 100) {
                                place(0, attackDir);
                            }
                        }, i * healSpacing + shameDelay);
                    }
                } else {
                    for (let i = 0; i < totalHeal; i++) {
                        place(0, attackDir);
                    }
                }
            }
            function healer1() {
                if (!player || !player.alive) return 0;
                place(0, getAttackDir());
                const currentItem = items.list?.[player.items?.[0]];
                if (!currentItem || !currentItem.healing) return 0;
                const effectiveHealing = currentItem.healing * soldierMult();
                return Math.ceil((100 - player.health) / effectiveHealing);
            }
            function antiSyncHealing() {
                if (!my || !player) return;
                my.antiSync = true;
                const shame = player.shameCount || 0;
                const attackDir = getAttackDir();
                const healInterval = setInterval(() => {
                    if (!player || !player.alive || player.health >= 100) {
                        clearInterval(healInterval);
                        return;
                    }
                    if (shame < 5) {
                        place(0, attackDir);
                    }
                }, 25);
                setTimeout(() => {
                    clearInterval(healInterval);
                    setTimeout(() => {
                        if (my) my.antiSync = false;
                    }, game.tickRate || 0);
                }, game.tickRate || 0);
            }
            function antiSyncHealing1() {
                if (!my || !player) return;
                my.antiSync = true;
                const attackDir = getAttackDir();
                const healInterval = setInterval(() => {
                    if (!player || !player.alive || player.health >= 100) {
                        clearInterval(healInterval);
                        return;
                    }
                    if ((player.shameCount || 0) === 0) {
                        place(0, attackDir);
                    }
                }, 75);
                setTimeout(() => {
                    clearInterval(healInterval);
                    setTimeout(() => {
                        if (my) my.antiSync = false;
                    }, game.tickRate || 0);
                }, game.tickRate || 0);
            }
            function predictHeal(count = 1) {
                if (!player || !player.alive) return;
                const attackDir = getAttackDir();
                const healCount = Math.min(count, 10); // Cap at 10 to prevent spam
                for (let i = 0; i < healCount; i++) {
                    place(0, attackDir);
                }
            }

            function spikeHealing(sid, value) {
                let tmpObj = findPlayerBySID(sid);
                if (!tmpObj) return;
                tmpObj.oldHealth = tmpObj.health;
                let d = value - tmpObj.health;
                tmpObj.health = value;
                let date = Date.now();
                if (tmpObj.oldHealth < tmpObj.health) {
                    tmpObj.judgeShame(d, date);
                    if (instaC && instaC.isTrue) {
                        if (tmpObj.shameCount > tmpObj.maxShameCount) {
                            tmpObj.healSid = Math.min(3, tmpObj.healSid + 1);
                        } else {
                            tmpObj.healSid = Math.max(-1, tmpObj.healSid - 1);
                        }
                    }
                    const isAlly = id => alliancePlayers.includes(id);
                    const GetangleSpike = (a, b) => Math.sqrt(Math.pow((b.y - a.y2), 2) + Math.pow((b.x - a.x2), 2));
                    const spikes = gameObjects.filter(obj =>
                                                      ["spikes", "greater spikes", "spinning spikes", "poison spikes"].includes(obj.name) &&
                                                      GetangleSpike(player, obj) < player.scale + obj.scale + 50 &&
                                                      !isAlly(obj.owner.sid) &&
                                                      obj.active
                                                     );
                    const direction = Math.atan2(player.y2 - near.y2, player.x2 - near.x2);
                    const newPos = {
                        x: player.x + Math.cos(direction) * 35,
                        y: player.y2 + Math.sin(direction) * 35,
                    };
                    if (GetangleSpike(spikes, player) <= 200 && near.dist2 <= 250) {
                        if (near.reloads[near.primaryIndex] ||
                            (near.reloads[near.secondaryIndex] && near.reloads[53] === 0 && items.weapons[near.secondaryIndex])) {
                            for (const spike of spikes) {
                                if (GetangleSpike(spike, newPos) < player.scale + spike.scale && (!my.inTrap || my.inTrap)) {
                                    buyEquip(6, 0);
                                    player.soldierAnti = true;
                                    break;
                                }
                            }
                        } else {
                            if (tmpObj.shameCount > 5) {
                                heal(value, pingHeal());
                            } else {
                                if (player.health <= 55 & player.health <= 45 && tmpObj.shameCount <= 5) {
                                    setTimeout(() => heal(tmpObj, value, 111), 111);
                                    buyEquip(6, 0);
                                } else {
                                    setTimeout(() => heal(tmpObj, value, 111), 111);
                                }
                            }
                        }
                    }
                }
                const pingHeal = () => Math.max(10, (9 * 0.25) + window.pingTime);
                const heal = (amount, after) => {
                    setTickout(() => {
                        for (let i = 0; i < applCxC(amount); i++) {
                            place(0, getAttackDir());
                        }
                    }, after);
                };

                if (traps.inTrap) {
                    heal(value, enemy.length ? 2 : 3);
                } else {
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
                                        const times = player.items[0] === 1 ? 3 : 4;
                                        for (let i = 0; i < times; i++) place(0, getAttackDir());
                                    };
                                    const slowHeal = () => {
                                        setTimeout(() => {
                                            heal();
                                        }, pingHeal());
                                    };
                                    slowHeal();
                                }
                            } else {
                                setTickout(() => {
                                    for (let i = 0; i < applCxC(value); i++) {
                                        place(0, getAttackDir());
                                    }
                                }, 2);
                            }
                        } else {
                            heal(enemy.length ? value : value, enemy.length ? 2 : 3);
                        }
                        if (player.skinIndex === 11 && value >= 30) {
                            instaC.isCounter = true;
                        }
                        if (value >= 20) {
                            hittedTime = Date.now();
                            judgeAtNextTick = true;
                        }
                    } else {
                        heal(enemy.length ? value : value, enemy.length ? 2 : 3);
                    }
                }
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
            function woah(mover) {
                buyEquip(mover && player.moveDir == undefined ? 0 : 11, 1);
            }
            function cdf (e, t){
                try {
                    return Math.hypot((t.y2||t.y)-(e.y2||e.y), (t.x2||t.x)-(e.x2||e.x));
                } catch(e){
                    return Infinity;
                }
            }


            function HKH () {
                my.autoAim = true;
                sendAutoGather();
                buyEquip(53, 0);
                selectWeapon(player.weapons[1]);
                game.tickBase(() => {
                    buyEquip(7, 0);
                    selectWeapon(player.weapons[0]);
                    game.tickBase(() => {
                        sendAutoGather();
                        my.autoAim = false;
                    }, 1);
                }, 1);
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
                            if (replacer && item.dmg) {
                                if (near.dist2 <= items.weapons[player.weapons[0]].range + (player.scale * 1.8) && configs.spikeTick) {
                                    instaC.canSpikeTick = true;
                                }
                            }
                        } catch (err) {
                        }
                    };
                    let testMode = window.location.hostname == "1";
                    let autoQ = false;
                    function idk(tmpObj) {
                        let buildings = liztobj.sort(
                            (a, b) =>
                            Math.hypot(tmpObj.y - a.y, tmpObj.x - a.x) -
                            Math.hypot(tmpObj.y - b.y, tmpObj.x - b.x)
                        );
                        let spikes = buildings.filter(
                            (obj) =>
                            obj.dmg &&
                            cdf(player, obj) < 200 &&
                            !obj.isTeamObject(player) &&
                            obj.active
                        );
                        let enemy = {
                            x: player.x2 + (player.oldPos.x2 - player.x2) * -1,
                            y: player.y2 + (player.oldPos.y2 - player.y2) * -1,
                        };
                        let found = false;
                        for (let i = 0; i < spikes.length; i++) {
                            if (cdf(enemy, spikes[i]) < player.scale + spikes[i].scale) {
                                found = true;
                            }
                        }
                        spikeHealing(spikes);
                    }

                    this.checkSpikeTick = function() {
                        try {
                            if (![3, 4, 5].includes(near.primaryIndex)) return false;
                            if (getEl("safeAntiSpikeTick").checked && this.inTrap && near.dist2 <= items.weapons[near.primaryIndex || 5].range + near.scale && [3, 4, 5].includes(near.primaryIndex) && this.info.health <= items.weapons[player.weaponIndex].dmg * (config.weaponVariants[tmpObj[(player.weaponIndex < 9 ? "prima" : "seconda") + "ryVariant"]].val) * (items.weapons[player.weaponIndex].sDmg || 1) * 3.3) return true
                            near.primaryIndex || 5
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
                                    return true;
                                }
                            }
                        } catch (err) {
                            return null;
                        }
                        return false;
                    }

                    let autos = {
                        insta: {
                            todo: false,
                            wait: false,
                            count: 4,
                            shame: 5,
                        },
                        bull: false,
                        antibull: 0,
                        reloaded: false,
                        stopspin: true,
                    };
                    let stopCD = Date.now();
                    this.protect = function (aim) {
                        if (!configs.antiTrap) return;
                        if (player.items[4]) {
                            this.testCanPlace(2, -(Math.PI / 2), (Math.PI / 2), (Math.PI / 12), aim + Math.PI);
                            this.antiTrapped = true;
                        }
                    };
                    let antist = Date.now();
                    function checkAntiSpikeTick(){
                        if(near.dist2 <= 180){
                            if(idk && !player.inTrap) return false;
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
                    UTILS.deg2rad = function (degrees) {
                        return degrees * (Math.PI / 180);
                    }
                    function calculatePerfectAngle(x1, y1, x2, y2) {
                        return Math.atan2(y2 - y1, x2 - x1);
                    }
                    function getEnemyVelocity(near) {
                        return Math.sqrt(near.xVel * near.xVel + near.yVel * near.yVel);
                    }

                    function getEnemyDirection(near) {
                        return Math.atan2(near.yVel, near.xVel);
                    }
                    function isPositionValid(position) {
                        const playerX = player.x2;
                        const playerY = player.y2;
                        const distToPosition = Math.hypot(position[0] - playerX, position[1] - playerY);
                        return distToPosition > 35;
                    }
                    this.unsafeGameObjects = {
                        near: [],
                        near350: [],
                        spikes: [],
                    };

                    function n(e) {
                        return e && e.isBuffer && e
                    }

                    function calculatePossibleTrapPositions(x, y, radius) {
                        const trapPositions = [];
                        const numPositions = 8;
                        for (let i = 0; i < numPositions; i++) {
                            const angle = (2 * Math.PI * i) / numPositions;
                            const offsetX = x + radius * Math.cos(angle);
                            const offsetY = y + radius * Math.sin(angle);
                            const position = [offsetX, offsetY];
                            if (!trapPositions.some((pos) => isPositionTooClose(position, pos))) {
                                trapPositions.push(position);
                            }
                        }
                        return trapPositions;
                    }
                    function isPositionTooClose(position1, position2, minDistance = 50) {
                        const dist = Math.hypot(position1[0] - position2[0], position1[1] - position2[1]);
                        return dist < minDistance;
                    }

                    function dotProduct(vector1, vector2) {
                        return vector1.x * vector2.x + vector1.y * vector2.y;
                    }

                    function magnitude(vector) {
                        return Math.sqrt(vector.x * vector.x + vector.y * vector.y);
                    }
                    function vectorDifference(point1, point2) {
                        return {
                            x: point2.x - point1.x,
                            y: point2.y - point1.y
                        };
                    }
                    function calculateAngleUsingDotProduct(point1, point2) {
                        let diffVector = vectorDifference(point1, point2);
                        let playerDirection = {
                            x: Math.cos(player.dir),
                            y: Math.sin(player.dir)
                        };
                        let dotProd = dotProduct(playerDirection, diffVector);
                        let magnitudeProd = magnitude(playerDirection) * magnitude(diffVector);
                        let cosTheta = dotProd / magnitudeProd;
                        let dynamicAngle = Math.acos(cosTheta);
                        dynamicAngle *= 180 / Math.PI;
                        if (dynamicAngle < 0) dynamicAngle += 360;
                        return dynamicAngle;
                    }
                    function caf(e, t) {
                        try {
                            return Math.atan2((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
                        } catch (e) {
                            return 0;
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
                    /*



                    bluckguys chaotic autoplacer with graded angles startttttt



                    */

                    function toRadian(degrees) {
                        const normalized = (degrees % 360) * Math.PI / 180;
                        return normalized < 0 ? 2 * Math.PI + normalized : normalized;
                    }
                    function angleInBetween(angle, start, end) {
                        const diff = ((end - start + 2 * Math.PI) % (2 * Math.PI));
                        const relative = ((angle - start + 2 * Math.PI) % (2 * Math.PI));
                        return relative <= diff;
                    }
                    function trapArrays() {
                        if (!enemy || !enemy.length || !near) return [];
                        const angles = [];
                        const velocityFactor = 0.5;
                        const enemyX = near.x + (near.xVel || 0) * velocityFactor;
                        const enemyY = near.y + (near.yVel || 0) * velocityFactor;
                        const gridSize = 8;
                        const trapRadius = 50;
                        for (let i = 0; i < gridSize; i++) {
                            const angle = (2 * Math.PI * i) / gridSize;
                            const futureX = enemyX + Math.cos(angle) * trapRadius;
                            const futureY = enemyY + Math.sin(angle) * trapRadius;
                            const trapAngle = Math.atan2(futureY - player.y2, futureX - player.x2);
                            angles.push(trapAngle);
                        }

                        return angles;
                    }
                    function calcTrapArray() {
                        if (!enemy || !enemy.length || !near) return [];
                        const optimalAngles = [];
                        const velocityFactor = 0.4;
                        const enemyPredictedX = near.x + (near.xVel || 0) * velocityFactor;
                        const enemyPredictedY = near.y + (near.yVel || 0) * velocityFactor;
                        const gridPoints = 12;
                        const velMagnitude = Math.sqrt(
                            (near.xVel || 0) * (near.xVel || 0) +
                            (near.yVel || 0) * (near.yVel || 0)
                        );
                        const ellipseX = 60 + velMagnitude * 2;
                        const ellipseY = 40 + velMagnitude * 2;
                        for (let i = 0; i < gridPoints; i++) {
                            const baseAngle = (2 * Math.PI * i) / gridPoints;
                            const gridX = enemyPredictedX + ellipseX * Math.cos(baseAngle);
                            const gridY = enemyPredictedY + ellipseY * Math.sin(baseAngle);
                            const angleToGrid = Math.atan2(gridY - player.y2, gridX - player.x2);
                            optimalAngles.push(angleToGrid);
                        }
                        return optimalAngles;
                    }
                    function spikeToTrap(trap) {
                        if (!trap || !player) return 0;
                        return Math.atan2(trap.y - player.y2, trap.x - player.x2);
                    }
                    function calcSpikeAngle(trap) {
                        if (!trap || !player) return 0;
                        const trapCenterX = trap.x;
                        const trapCenterY = trap.y;
                        const spikePositions = [];
                        const numSpikes = 8;
                        const spikeRadius = 45;
                        for (let i = 0; i < numSpikes; i++) {
                            const angle = (2 * Math.PI * i) / numSpikes;
                            const spikeX = trapCenterX + spikeRadius * Math.cos(angle);
                            const spikeY = trapCenterY + spikeRadius * Math.sin(angle);
                            const spikeAngle = Math.atan2(spikeY - player.y2, spikeX - player.x2);
                            spikePositions.push(spikeAngle);
                        }
                        return spikePositions.length > 0 ? spikePositions[0] :
                        Math.atan2(trapCenterY - player.y2, trapCenterX - player.x2);
                    }
                    function validPos(pos1, pos2, minDistance = 15) {
                        if (!pos1 || !pos2 || pos1.length < 2 || pos2.length < 2) return false;
                        const dx = pos1[0] - pos2[0];
                        const dy = pos1[1] - pos2[1];
                        return Math.sqrt(dx * dx + dy * dy) < minDistance;
                    }
                    function possibleTraps(x, y, radius) {
                        const trapPositions = [];
                        const numPositions = 8;
                        for (let i = 0; i < numPositions; i++) {
                            const degrees = (360 * i) / numPositions;
                            const angle = toRadian(degrees);
                            const offsetX = x + radius * Math.cos(angle);
                            const offsetY = y + radius * Math.sin(angle);
                            const position = [offsetX, offsetY];
                            if (!trapPositions.some(pos => validPos(position, pos))) {
                                trapPositions.push(position);
                            }
                        }
                        return trapPositions;
                    }
                    function findBestTrapAngle(availableAngles, trapAngles) {
                        if (!availableAngles || !availableAngles.length) return 0;
                        if (!trapAngles || !trapAngles.length) return availableAngles[0];
                        let bestAngle = availableAngles[0];
                        let minDiff = Math.PI * 2;
                        for (const availableAngle of availableAngles) {
                            for (const trapAngle of trapAngles) {
                                const diff = Math.abs(availableAngle - trapAngle);
                                if (diff < minDiff) {
                                    minDiff = diff;
                                    bestAngle = availableAngle;
                                }
                            }
                        }
                        return bestAngle;
                    }
                    function findClosestAngle(availableAngles, targetAngles) {
                        if (!availableAngles || !availableAngles.length) return 0;
                        if (!targetAngles || !targetAngles.length) return availableAngles[0];
                        let bestAngle = availableAngles[0];
                        let minDiff = Math.PI * 2;
                        for (const availableAngle of availableAngles) {
                            for (const targetAngle of targetAngles) {
                                const diff = Math.abs(availableAngle - targetAngle);
                                if (diff < minDiff) {
                                    minDiff = diff;
                                    bestAngle = availableAngle;
                                }
                            }
                        }
                        return bestAngle;
                    }
                    function calcPredictScore(angle, enemy, velX, velY, type) {
                        if (!player || !enemy || !items.list) return 0;
                        const item = items.list[type < items.list.length ? type : player.items[type]];
                        if (!item) return 0;
                        const placementDist = player.scale + item.scale + (item.placeOffset || 0);
                        const placementX = player.x2 + placementDist * Math.cos(angle);
                        const placementY = player.y2 + placementDist * Math.sin(angle);
                        const predictTime = type === 4 ? 0.5 : 0.3;
                        const enemyFutureX = enemy.x + velX * predictTime;
                        const enemyFutureY = enemy.y + velY * predictTime;
                        const futureDist = Math.hypot(
                            placementX - enemyFutureX,
                            placementY - enemyFutureY
                        );
                        return 1 / (futureDist + 1);
                    }
                    function getBlockedAngles(type) {
                        if (!player || !items.list || !gameObjects) return [];
                        const arr = [];
                        const item = items.list[type < items.list.length ? type : player.items[2]];
                        if (!item) return [];
                        const offset = player.scale + item.scale + (item.placeOffset || 0);
                        const buildings = gameObjects.filter(obj =>
                                                             obj && obj.active && fgdo(player, obj) < 250
                                                            );
                        for (const building of buildings) {
                            if (!building) continue;
                            const isItem = building.isItem || false;
                            let scale = building.scale || 0;
                            if (!isItem) {
                                const isSpecialScale = scale === 80 || scale === 85 || scale === 90;
                                scale = (isSpecialScale && building.type !== 1) ? scale : scale * 0.4;
                            }
                            const dist = item.scale + scale + 1;
                            const dPTB = fgdo(player, building);
                            let cosLaw;
                            if (dPTB > dist + offset) {
                                const innerAngle = Math.acos(((offset ** 2 + dist ** 2) - dPTB ** 2) / (2 * dist * offset));
                                cosLaw = Math.asin((dist * Math.sin(innerAngle)) / dPTB);
                            } else {
                                cosLaw = Math.acos(((offset ** 2 + dPTB ** 2) - dist ** 2) / (2 * dPTB * offset));
                            }
                            const aPTB = Math.atan2(building.y - player.y2, building.x - player.x2);
                            if (!isNaN(cosLaw)) {
                                arr.push([aPTB - cosLaw, aPTB + cosLaw, building]);
                            }
                        }
                        return arr;
                    }
                    function gradeAngles(type, step = Math.PI / 180) {
                        const blocked = getBlockedAngles(type);
                        const grades = [];
                        for (let angle = 0; angle < 2 * Math.PI; angle += step) {
                            const blockedBy = blocked.find(([start, end]) => angleInBetween(angle, start, end));
                            grades.push({
                                angle: angle,
                                blockedBy: blockedBy ? blockedBy[2] : null
                            });
                        }
                        return grades;
                    }
                    function checkAngles(type, usePackets = false) {
                        if (!player || !player.alive || !inGame || !items.list) return null;
                        const item = items.list[type < items.list.length ? type : player.items[type]];
                        if (!item) return null;
                        const blockedAngles = getBlockedAngles(type);
                        const step = Math.PI / 36;
                        let enemyVelX = 0;
                        let enemyVelY = 0;
                        if (enemy && enemy.length && near) {
                            enemyVelX = near.xVel || 0;
                            enemyVelY = near.yVel || 0;
                        }
                        if (!usePackets) {
                            const availableAngles = [];
                            for (let angle = 0; angle < 2 * Math.PI; angle += step) {
                                let isBlocked = false;
                                for (const [start, end, obstacle] of blockedAngles) {
                                    if (angleInBetween(angle, start, end)) {
                                        isBlocked = true;
                                        break;
                                    }
                                }
                                if (!isBlocked) {
                                    if (enemy && enemy.length && type === 4) {
                                        const predictiveAngle = Math.atan2(
                                            near.y + enemyVelY * 0.3 - player.y2,
                                            near.x + enemyVelX * 0.3 - player.x2
                                        );
                                        const angleDiff = Math.abs(angle - predictiveAngle);
                                        if (angleDiff < Math.PI / 6) {
                                            availableAngles.unshift(angle);
                                            continue;
                                        }
                                    }
                                    availableAngles.push(angle);
                                }
                            }
                            if (availableAngles.length > 0) {
                                let bestAngle = availableAngles[0];
                                if (type === 4 && enemy && enemy.length) {
                                    const trapAngles = trapArrays();
                                    if (trapAngles.length > 0) {
                                        bestAngle = findBestTrapAngle(availableAngles, trapAngles);
                                    }
                                }
                                if (type === 2 && enemy && enemy.length) {
                                    const objects = closeObjects && closeObjects.length ? closeObjects : gameObjects;
                                    const nearTrap = objects
                                    .filter(obj =>
                                            obj && obj.trap && obj.active &&
                                            obj.isTeamObject && obj.isTeamObject(player) &&
                                            UTILS.getDist(obj, near, 0, 2) <= near.scale + obj.getScale() + 5
                                           )[0];
                                    if (nearTrap) {
                                        bestAngle = spikeToTrap(nearTrap);
                                    }
                                }
                                checkPlace(type, bestAngle);
                                return bestAngle;
                            }
                            return null;
                        } else {
                            if (!window.blockedAngleHistory) {
                                window.blockedAngleHistory = new Map();
                            }
                            if (!window.blockedAngleHistory.has(type)) {
                                window.blockedAngleHistory.set(type, new Set());
                            }
                            const previouslyBlocked = window.blockedAngleHistory.get(type);
                            const currentlyBlocked = new Set();
                            const newlyAvailableAngles = [];
                            for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 12) {
                                let isBlocked = false;
                                for (const [start, end, obstacle] of blockedAngles) {
                                    if (angleInBetween(angle, start, end)) {
                                        isBlocked = true;
                                        break;
                                    }
                                }
                                if (isBlocked) {
                                    currentlyBlocked.add(angle);
                                } else if (previouslyBlocked.has(angle)) {
                                    newlyAvailableAngles.push(angle);
                                }
                            }
                            window.blockedAngleHistory.set(type, currentlyBlocked);
                            if (newlyAvailableAngles.length > 0) {
                                let bestNewAngle = newlyAvailableAngles[0];
                                if (enemy && enemy.length && near) {
                                    if (type === 4) {
                                        const trapArrayAngles = calcTrapArray();
                                        if (trapArrayAngles.length > 0) {
                                            bestNewAngle = findClosestAngle(newlyAvailableAngles, trapArrayAngles);
                                        }
                                    }
                                    if (type === 2) {
                                        const objects = closeObjects && closeObjects.length ? closeObjects : gameObjects;
                                        const nearTrap = objects
                                        .filter(obj => obj && obj.trap && obj.active && obj.isTeamObject && obj.isTeamObject(player))[0];
                                        if (nearTrap && UTILS.getDist(near, nearTrap, 0, 2) <= near.scale + nearTrap.getScale()) {
                                            bestNewAngle = calcSpikeAngle(nearTrap);
                                        }
                                    }
                                    newlyAvailableAngles.sort((a, b) => {
                                        const scoreA = calcPredictScore(a, near, enemyVelX, enemyVelY, type);
                                        const scoreB = calcPredictScore(b, near, enemyVelX, enemyVelY, type);
                                        return scoreB - scoreA;
                                    });
                                    bestNewAngle = newlyAvailableAngles[0];
                                }
                                checkPlace(type, bestNewAngle);
                                return bestNewAngle;
                            }
                            return null;
                        }
                    }
                    this.autoPlace = function() {
                        if (!enemy || !enemy.length || !near || !player) return;
                        if (!(configs.AutoMatePlace || configs.autoPlace)) return;
                        if (instaC && instaC.ticking) return;
                        const nearDistance = UTILS.getDist(player, near, 0, 2);
                        const maxDistance = typeof secPacket !== 'undefined' ? 300 : 400;
                        if (nearDistance > maxDistance) return;
                        const objects = closeObjects && closeObjects.length ? closeObjects : gameObjects;
                        const nearTrap = objects
                        .filter(obj =>
                                obj && obj.trap && obj.active &&
                                obj.isTeamObject && obj.isTeamObject(player) &&
                                UTILS.getDist(obj, near, 0, 2) <= near.scale + obj.getScale() + 5
                               )
                        .sort((a, b) => UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2))[0];
                        let didTrap = false;
                        const predictEnemy = (e) => ({
                            x: e.x + (e.xVel || 0) * 0.5,
                            y: e.y + (e.yVel || 0) * 0.5
                        });
                        if (nearTrap) {
                            if (nearDistance <= 200) {
                                this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 24, near.aim2, 0, { inTrap: true });
                                didTrap = true;
                            } else if (player.items && player.items[4] === 15) {
                                this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 24, near.aim2);
                                didTrap = true;
                            }
                            if (didTrap && typeof secPacket !== 'undefined' && near.dist2 <= 160) {
                                const trapX = nearTrap.x;
                                const trapY = nearTrap.y;
                                const circleRadius = 102;
                                const numPositions = 72;
                                if (!window.placedSpikePositions) {
                                    window.placedSpikePositions = new Set();
                                }
                                for (let i = 0; i < numPositions; i++) {
                                    const angle = 2 * Math.PI * i / numPositions;
                                    const offsetX = trapX + circleRadius * Math.cos(angle);
                                    const offsetY = trapY + circleRadius * Math.sin(angle);
                                    const pos = [offsetX, offsetY];
                                    const posKey = JSON.stringify(pos);
                                    const distToPlayer = Math.hypot(pos[0] - player.x2, pos[1] - player.y2);
                                    const predictedEnemy = predictEnemy(near);
                                    const predictedDist = Math.hypot(predictedEnemy.x - pos[0], predictedEnemy.y - pos[1]);
                                    if (!window.placedSpikePositions.has(posKey) && distToPlayer <= 87 && predictedDist <= 50) {
                                        checkPlace(2, Math.atan2(pos[1] - player.y2, pos[0] - player.x2));
                                        window.placedSpikePositions.add(posKey);
                                    }
                                }
                            }
                        } else if (player.items && player.items[4] === 15) {
                            this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 24, near.aim2);
                            didTrap = true;
                        }
                        if (!didTrap) {
                            const angleGrades = gradeAngles(2, Math.PI / 36);
                            const best = angleGrades.find(g => !g.blockedBy);
                            if (best) {
                                checkPlace(2, best.angle);
                            }
                        }
                        if (typeof secPacket !== 'undefined' && secPacket <= 90) {
                            if (!closeObjects || !closeObjects.length) return;
                            const randomDir = Math.random() * Math.PI * 1.5;
                            const tryTicked = [3, 4, 5].includes(near.primaryIndex);
                            const weaponRange = items.weapons && player.weapons && items.weapons[player.weapons[0]] ?
                                  items.weapons[player.weapons[0]].range : 0;
                            const isInRange = near.dist2 <= weaponRange + near.scale * 1.8;
                            const id = nearTrap || isInRange ? 2 : 4;
                            const placementAngle = checkAngles(id, tryTicked && id === 2);
                            if (placementAngle !== null) {
                                this.testCanPlace(id, -(Math.PI * 1.5), randomDir, Math.PI / 12, placementAngle, tryTicked && id === 2);
                            } else {
                                this.testCanPlace(id, -(Math.PI * 1.5), randomDir, Math.PI / 12, near.aim2, tryTicked && id === 2);
                            }
                        }
                    };
                    const serverTickRate = 1000 / 9;

                    class TickSync {
                        constructor() {
                            this.C_TICK_DEL = serverTickRate;
                            this.lastTick = performance.now();
                            this.perfectTickTime = Date.now();
                            this.isRunning = false;
                            this.lastAutoPlace = 0;
                            this.autoPlaceCooldown = 1.67;
                            this.autoPlaceCounter = 0;
                            this.animationFrameId = null;
                            this.lastFrameTime = performance.now();
                            this.lastAngleCheck = 0;
                            this.angleCheckCooldown = 0.5;
                            this.blockedAngles = [];
                            this.availableAngles = [];
                            this.lastAngleUpdate = 0;
                            this.cachedPlayer = null;
                            this.cachedTrapType = null;
                            this.pingTime = 0;
                            this.secPacketCache = false;
                        }

                        get playerAngle() {
                            return window.player?.angle || 0;
                        }

                        get shouldBlock() {
                            return typeof secPacket !== 'undefined' && secPacket >= 90;
                        }

                        calculateNextTick() {
                            const now = performance.now();
                            const serverTime = now - this.pingTime * 0.5;
                            const nextTick = Math.ceil(serverTime / this.C_TICK_DEL) * this.C_TICK_DEL;
                            return Math.max(nextTick, now + this.C_TICK_DEL);
                        }

                        updateBlockedAngles() {
                            const now = performance.now();
                            if (now - this.lastAngleUpdate < this.angleCheckCooldown) return;

                            try {
                                const trapType = window.player?.items?.[2] || 0;
                                if (trapType === this.cachedTrapType && this.availableAngles.length > 0) return;

                                const graded = gradeAngles(trapType, Math.PI / 45);
                                this.blockedAngles.length = 0;
                                this.availableAngles.length = 0;

                                for (let i = 0; i < graded.length; i++) {
                                    const grade = graded[i];
                                    if (grade.blockedBy) {
                                        this.blockedAngles.push(grade.angle);
                                    } else {
                                        this.availableAngles.push(grade.angle);
                                    }
                                }

                                this.cachedTrapType = trapType;
                                this.lastAngleUpdate = now;
                            } catch (e) {}
                        }

                        canPlaceAtAngle(angle) {
                            const radAngle = angle * Math.PI / 180;
                            const PI2 = Math.PI * 2;
                            const threshold = Math.PI / 90;

                            for (let i = 0; i < this.blockedAngles.length; i++) {
                                const diff = Math.abs(((radAngle - this.blockedAngles[i] + Math.PI) % PI2) - Math.PI);
                                if (diff < threshold) return false;
                            }

                            if (this.availableAngles.length > 0) {
                                let minDiff = Infinity;
                                for (let i = 0; i < this.availableAngles.length; i++) {
                                    const diff = Math.abs(((radAngle - this.availableAngles[i] + Math.PI) % PI2) - Math.PI);
                                    if (diff < minDiff) minDiff = diff;
                                }
                                return minDiff < Math.PI / 18;
                            }

                            return this.blockedAngles.length === 0;
                        }

                        getOptimalAngle() {
                            if (this.availableAngles.length === 0) return this.playerAngle;
                            return this.availableAngles[0] * 180 / Math.PI;
                        }

                        shouldExecuteAutoPlace() {
                            if (traps?.intrap) return false;
                            if (traps?.info?.health < 1) return true;
                            return false;
                        }

                        executeAutoPlace() {
                            if (this.shouldBlock) return;

                            this.updateBlockedAngles();
                            const currentAngle = this.playerAngle;
                            const canPlace = this.canPlaceAtAngle(currentAngle);

                            if (!canPlace) {
                                const optimalAngle = this.getOptimalAngle();
                                if (window.player && Math.abs(optimalAngle - currentAngle) > 0.1) {
                                    const originalAngle = currentAngle;
                                    window.player.angle = optimalAngle;

                                    if (traps?.autoPlace) {
                                        traps.autoPlace();
                                    }

                                    setTimeout(() => {
                                        if (window.player) {
                                            window.player.angle = originalAngle;
                                        }
                                    }, 16);

                                    return;
                                }
                            } else {
                                if (traps?.autoPlace) {
                                    traps.autoPlace();
                                }
                            }

                            const now = performance.now();
                            ticks.time.push(now);
                            if (ticks.time.length > 50) {
                                ticks.time.shift();
                            }
                            this.perfectTickTime += this.C_TICK_DEL;
                        }

                        start() {
                            if (this.isRunning) return;

                            this.isRunning = true;
                            this.lastTick = performance.now();
                            this.perfectTickTime = Date.now();
                            this.lastAutoPlace = 0;
                            this.autoPlaceCounter = 0;
                            this.lastFrameTime = performance.now();
                            this.lastAngleUpdate = 0;
                            this.blockedAngles.length = 0;
                            this.availableAngles.length = 0;
                            this.pingTime = window.pingTime || 0;

                            const frameLoop = () => {
                                if (!this.isRunning) return;

                                const now = performance.now();
                                this.pingTime = window.pingTime || 0;
                                this.secPacketCache = this.shouldBlock;

                                if (!this.secPacketCache) {
                                    const elapsed = now - this.lastTick;
                                    if (elapsed >= this.C_TICK_DEL) {
                                        this.lastTick += this.C_TICK_DEL;
                                        if (this.lastTick < now - this.C_TICK_DEL * 2) {
                                            this.lastTick = now;
                                        }
                                    }

                                    if (now - this.lastAutoPlace >= this.autoPlaceCooldown) {
                                        if (this.shouldExecuteAutoPlace()) {
                                            this.executeAutoPlace();
                                            this.lastAutoPlace = now;
                                            this.autoPlaceCounter = (this.autoPlaceCounter + 1) % 11;
                                        }
                                    }
                                }

                                this.updateBlockedAngles();
                                this.lastFrameTime = now;
                                this.animationFrameId = requestAnimationFrame(frameLoop);
                            };

                            this.animationFrameId = requestAnimationFrame(frameLoop);
                        }

                        stop() {
                            this.isRunning = false;
                            if (this.animationFrameId) {
                                cancelAnimationFrame(this.animationFrameId);
                                this.animationFrameId = null;
                            }
                        }
                    }

                    const tickSync = new TickSync();

                    function initTickSystem() {
                        tickSync.start();
                    }

                    function monitorTickPerformance() {
                        setInterval(() => {
                            if (ticks.time.length > 1) {
                                let sum = 0;
                                const len = Math.min(10, ticks.time.length);
                                for (let i = ticks.time.length - len; i < ticks.time.length - 1; i++) {
                                    sum += ticks.time[i + 1] - ticks.time[i];
                                }
                                const avgTick = sum / (len - 1);
                                ticks.delay = Math.abs(avgTick - serverTickRate);
                            }
                        }, 5000);
                    }

                    initTickSystem();
                    monitorTickPerformance();

                    window.TickSystem = {
                        sync: tickSync,
                        start: () => tickSync.start(),
                        stop: () => tickSync.stop(),
                        getTickRate: () => serverTickRate,
                        getCurrentTick: () => Math.floor((performance.now() - tickSync.lastTick) / serverTickRate),
                        setCooldown: (ms) => {
                            tickSync.autoPlaceCooldown = ms;
                        },
                        getFrameRateInfo: () => {
                            const now = performance.now();
                            const frameTime = now - tickSync.lastFrameTime;
                            return {
                                frameTime: frameTime,
                                fps: frameTime > 0 ? Math.round(1000 / frameTime) : 0,
                                autoPlaceInterval: tickSync.autoPlaceCooldown,
                                autoPlaceFPS: Math.round(1000 / tickSync.autoPlaceCooldown),
                                health: traps?.info?.health || window.player?.health || 100,
                                inTrap: !!(traps?.intrap),
                                blockedAnglesCount: tickSync.blockedAngles.length,
                                availableAnglesCount: tickSync.availableAngles.length
                            };
                        },
                        getBlockedAngles,
                        gradeAngles,
                        getCurrentAnglesInfo: () => ({
                            blockedAngles: tickSync.blockedAngles,
                            availableAngles: tickSync.availableAngles
                        })
                    };

                    tickSync.autoPlaceCooldown = 1.67;
                    let placerSpikeTick = false;
                    let placeableSpikes = [];

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
                    // preplacers
                    class Combat {
                        constructor(UTILS, items) {
                            this.findSpikeHit = {
                                x: 0,
                                y: 0,
                                spikePosX: 0,
                                spikePosY: 0,
                                canHit: false,
                                spikes: [],
                            };
                            this.spikesNearEnemy = [];

                            this.doSpikeHit = function () {
                                if (enemy.length) {
                                    let nTrap = gameObjects.find((e) => e.active && 'pit trap' == e.name && e.isTeamObject(player) && UTILS.getDistance(e.x, e.y, near.x2, near.y2) <= 50);
                                    let knocked = 0.3 + (items.weapons[player.weapons[0]].knock || 0)
                                    let dirs = Math.atan2(
                                        near.y2 - player.y2,
                                        near.x2 - player.x2
                                    )
                                    let iXy = {
                                        x: near.x2 + knocked * Math.cos(dirs) * 224,
                                        y: near.y2 + knocked * Math.sin(dirs) * 224,
                                    }
                                    if (near.dist2 < items.weapons[player.weapons[0]].range + 70 && !nTrap && near) {
                                        this.findSpikeHit.x = iXy.x
                                        this.findSpikeHit.y = iXy.y
                                    }
                                    this.findSpikeHit.spikes = gameObjects.filter((e) => e.active && e.dmg && e.owner.sid == player.sid && UTILS.getDistance(e.x, e.y, iXy.x, iXy.y) <= 35 + e.scale)
                                    for (let i = 0; i < this.findSpikeHit.spikes.length; i++) {
                                        let obj = this.findSpikeHit.spikes[i];

                                        const pSdist = UTILS.getDist(player, obj, 0, 0);
                                        const nSdist = UTILS.getDist(near, obj, 0, 0);
                                        const nSdist2 = UTILS.getDist(obj, near, 0, 0);
                                        if (pSdist > nSdist && nSdist2 < (35 + obj.scale + player.scale) && ((player.primaryDmg >= 35 && player.skinIndex != 6) || player.primaryDmg >= 51)) {
                                            if (obj && !nTrap && near && near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8 && player.reloads[player.weapons[0]] == 0) {
                                                this.findSpikeHit.canHit = true;
                                                this.findSpikeHit.spikePosX = obj.x;
                                                this.findSpikeHit.spikePosY = obj.y;

                                                if (this.findSpikeHit.canHit) {
                                                    instaC.canSpikeTick = true;
                                                    instaC.syncHit = true;
                                                    if (configs.revTick && player.weapons[1] == 15 && player.reloads[53] == 0 && instaC.perfCheck(player, near)) {
                                                        instaC.revTick = true;
                                                    }
                                                }
                                                smartTick(() => {
                                                    smartTick(() => {
                                                        this.findSpikeHit.spikePosX = 0;
                                                        this.findSpikeHit.spikePosY = 0;
                                                        this.findSpikeHit.canHit = false;
                                                    })
                                                })
                                            }
                                        } else {
                                            this.findSpikeHit.spikePosX = 0;
                                            this.findSpikeHit.spikePosY = 0;
                                            this.findSpikeHit.canHit = false;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    let doStuffPingSet = [];
                    function smartTick(tick) {
                        doStuffPingSet.push(tick);
                    }


                    let closeObjects=[];
                    function calculateConfidenceScore(angle, enemyVelocity, distanceToPlayer) {
                        const angleDiff = Math.abs(angle - enemyVelocity * Math.cos(Math.atan2(near.yVel, near.xVel)));
                        const confidenceScore = 1 - (angleDiff / distanceToPlayer);
                        return Math.max(0, Math.min(1, confidenceScore));
                    }
                    let spikSync;
                    let spikeSync = false;
                    let spikePlaced = false;
                    function calculateFastAngle(x1, y1, x2, y2) {
                        return Math.atan2(y2 - y1, x2 - x1);
                    }
                    function spikeTickPlace(id, radian) {
                        var item = items.list[player.items[id]];
                        if (checkPlace(id, radian) && item.dmg) {
                            if (enemy.length && enemy.find(e => e.skinIndex != 6 && getDist(player.buildItemPosition(items.list[player.items[2]], radian), e) <= 35 + items.list[player.items[2]].scale)) {
                                placerSpikeTick = true;
                            }
                        }
                    }
                    this.getItemPlaceLocation = function(obj, dir) {
                        let item = items.list[player.items[obj]];
                        let tmpS = player.scale + item.scale + (item.placeOffset || 0);
                        let tmpX = player.x + tmpS * Math.cos(dir);
                        let tmpY = player.y + tmpS * Math.sin(dir);
                        return { x: tmpX, y: tmpY };
                    };
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

                    let autodrinking = false;
                    let PrePlaceCount = false;
                    this.angles = this.angles || [];
                    this.replacer = function(findObj) {
                        if (!findObj || !configs.autoReplace) return;
                        if (!inGame) return;
                        if (this.antiTrapped) return;
                        game.tickBase(() => {
                            if (this.replaced) return;
                            let weaponIdx = player.weaponIndex,
                                weaponType = player.weapons[0],
                                primaryIdx = near.primaryIndex || 5,
                                playerScale = player.scale,
                                nearScale = near.scale,
                                weaponRange = items.weapons[weaponIdx].range,
                                primaryRange = items.weapons[primaryIdx].range,
                                reloads = player.reloads[weaponType];
                            let objAim = UTILS.getDirect(findObj, player, 0, 2),
                                objDst = UTILS.getDist(findObj, player, 0, 2),
                                dist2 = near.dist2,
                                dist3 = near.dist3,
                                aim2 = near.aim2,
                                health = near.health,
                                skinIdx = near.skinIndex;
                            let danger = this.checkSpikeTick(),
                                spikeSync = !danger || skinIdx != 6 || this.isEnemyInTrap(near),
                                isSpike = dist3 <= primaryRange + (nearScale * 1.8) && spikeSync;
                            let perfectAngle = typeof calculatePerfectAngle === "function"
                            ? Math.round(calculatePerfectAngle(findObj.x, findObj.y, player.x, player.y) / (Math.PI / 2)) * (Math.PI / 2)
                            : Math.atan2(findObj.y - player.y, findObj.x - player.x);
                            let canPlaceCondition = [4, 5].includes(weaponType) && dist2 <= primaryRange + (nearScale * 1.2) && reloads == 0;
                            if ((getEl("weaponGrind") && getEl("weaponGrind").checked && objDst <= weaponRange + playerScale) ||
                                (configs.weaponGrinder && objDst <= weaponRange + playerScale)) return;
                            if (typeof spikePlaced !== "undefined" && spikePlaced) {
                                if (player.items[4] == 15) this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 12, objAim, 1);
                                spikePlaced = false;
                            }
                            if (typeof spikSync !== "undefined" && dist2 <= 250 && !spikSync) {
                                for (let w = 0; w < 24; w++) {
                                    let angle = (Math.PI * 2) * w / 12;
                                    this.testCanPlace(2, angle, angle + (Math.PI / 12), (Math.PI / 12), objAim, 1);
                                    spikePlaced = true;
                                }
                            }
                            if (objDst <= 300) {
                                if (dist2 <= 70 && canPlaceCondition && configs.spikeTick) {
                                    this.testCanPlace(2, -Math.PI / 4, Math.PI / 4, (Math.PI / 16), aim2, getAttackDir(), 1);
                                    this.testCanPlace(4, -Math.PI / 4, Math.PI / 4, Math.PI / 12, aim2 + Math.PI, 1);
                                } else if (!danger && dist2 <= primaryRange + (nearScale * 1.8)) {
                                    this.testCanPlace(2, 0, (Math.PI * 2), (Math.PI / 24), perfectAngle, 1);
                                } else {
                                    if (player.items[4] == 15) {
                                        this.testCanPlace(dist2 > 250 ? 4 : 2, 0, (Math.PI * 2), (Math.PI / 12), perfectAngle, 1);
                                    }
                                    this.replaced = true;
                                }
                                return;
                            }
                        }, 1);
                    }
                }
            };
            // PREEEPLLACCERRR , ofc i skid
            var preplaceHandler = (() => {
                let cachedObjs = null;
                let lastCache = -1;
                let allowedAngles = [];
                let angleLimits = [];
                let ms = {
                    avg: 0,
                    max: 0,
                    min: 0,
                    delay: 0
                };

                const fixAngle = (ang) => {
                    const fullCircle = Math.PI * 2;
                    return ((ang % fullCircle) + fullCircle) % fullCircle;
                };

                const getObjectAngles = (targetObj, slotIndex) => {
                    const itemSlot = player.items[slotIndex];
                    if (itemSlot == null) return [];

                    const itemInfo = items.list[itemSlot];
                    const playerX = player.x2;
                    const playerY = player.y2;
                    const objX = targetObj.x;
                    const objY = targetObj.y;
                    const objSize = targetObj.getScale(0.6, targetObj.isItem) + 0.69;
                    const diffX = objX - playerX;
                    const diffY = objY - playerY;
                    const distance = Math.sqrt(diffX * diffX + diffY * diffY);

                    if (distance > player.scale + objSize + 2 * itemInfo.scale + itemInfo.placeOffset) {
                        return [UTILS.getDirect(objX, objY, playerX, playerY)];
                    }

                    const radius1 = player.scale + itemInfo.scale + itemInfo.placeOffset;
                    const radius2 = objSize + itemInfo.scale;
                    const aVal = (radius1 * radius1 - radius2 * radius2 + distance * distance) / (2 * distance);
                    const hVal = Math.sqrt(Math.max(0, radius1 * radius1 - aVal * aVal));
                    const px = playerX + (aVal / distance) * diffX;
                    const py = playerY + (aVal / distance) * diffY;
                    const firstX = px + (hVal / distance) * diffY;
                    const firstY = py - (hVal / distance) * diffX;
                    const secondX = px - (hVal / distance) * diffY;
                    const secondY = py + (hVal / distance) * diffX;

                    return [
                        UTILS.getDirection(firstX, firstY, playerX, playerY),
                        UTILS.getDirection(secondX, secondY, playerX, playerY)
                    ];
                };

                const combineArcs = (arcList) => {
                    const fullCircle = Math.PI * 2;
                    const arcSegments = [];

                    for (let [startA, endA] of arcList) {
                        startA = fixAngle(startA);
                        endA = fixAngle(endA);
                        const span = (endA - startA + fullCircle) % fullCircle;

                        if (span < 0.000001) {
                            arcSegments.push([startA, startA]);
                        } else if (startA < endA) {
                            arcSegments.push([startA, endA]);
                        } else {
                            arcSegments.push([startA, fullCircle], [0, endA]);
                        }
                    }

                    if (arcSegments.length === 0) return [];

                    arcSegments.sort((a, b) => a[0] - b[0]);
                    const combined = [arcSegments[0].slice()];

                    for (let i = 1; i < arcSegments.length; i++) {
                        const [curStart, curEnd] = arcSegments[i];
                        const lastSegment = combined[combined.length - 1];

                        if (curStart <= lastSegment[1] + 0.000001) {
                            lastSegment[1] = Math.max(lastSegment[1], curEnd);
                        } else {
                            combined.push([curStart, curEnd]);
                        }
                    }

                    if (combined.length === 1 && combined[0][0] <= 0.000001 && combined[0][1] >= fullCircle - 0.000001) {
                        return [[0, fullCircle]];
                    }

                    return combined;
                };

                const getFreeArcs = (combinedArcs) => {
                    const fullCircle = Math.PI * 2;

                    if (combinedArcs.length === 0) return [[0, fullCircle]];

                    const freeSpaces = [];
                    for (let i = 0; i < combinedArcs.length; i++) {
                        const [blockStart, blockEnd] = combinedArcs[i];
                        const freeStart = blockEnd;
                        const freeEnd = i < combinedArcs.length - 1 ? combinedArcs[i + 1][0] : combinedArcs[0][0] + fullCircle;

                        if (freeEnd - freeStart > 0.000001) {
                            freeSpaces.push([fixAngle(freeStart), fixAngle(freeEnd)]);
                        }
                    }
                    return freeSpaces;
                };

                const getNearObjects = () => {
                    return gameObjects.filter((e) =>
                                              (e.active || e.alive) &&
                                              e.health < e.maxHealth &&
                                              e.group !== undefined &&
                                              UTILS.getDist(e, player, 0, 2) <= (items.weapons[player.weaponIndex].range + e.scale)
                                             );
                };

                const updateAngleLimits = (slotIndex) => {
                    const itemSlot = player.items[slotIndex];
                    if (itemSlot == null) {
                        angleLimits = [];
                        return;
                    }

                    const itemInfo = items.list[itemSlot];
                    const blockedAngles = [];
                    const nearbyObjects = getNearObjects().filter(obj => UTILS.getDist(obj, player, 0, 2) <= 200);

                    for (const obj of nearbyObjects) {
                        const possibleAngles = getObjectAngles(obj, slotIndex);
                        if (possibleAngles.length !== 2) continue;

                        const [ang1, ang2] = possibleAngles;
                        const placeOffset = player.scale + itemInfo.scale + (itemInfo.placeOffset || 0);
                        const objAngle = UTILS.getDirect(obj, player, 0, 2);

                        const testPlacement = (testAng) => {
                            const testX = player.x2 + placeOffset * Math.cos(testAng);
                            const testY = player.y2 + placeOffset * Math.sin(testAng);
                            return objectManager.checkItemLocation(testX, testY, itemInfo.scale, 0.6, slotIndex, false);
                        };

                        const result1 = testPlacement(ang1);
                        const result2 = testPlacement(ang2);

                        if (result1 && result2) {
                            blockedAngles.push([ang1, ang2]);
                        } else if (result1 || result2) {
                            const validAng = result1 ? ang1 : ang2;
                            const invalidAng = result1 ? ang2 : ang1;
                            const clockwise = (objAngle - validAng + Math.PI * 2) % (Math.PI * 2) <
                                  (invalidAng - validAng + Math.PI * 2) % (Math.PI * 2);

                            if (clockwise) {
                                blockedAngles.push([validAng, invalidAng]);
                            } else {
                                blockedAngles.push([invalidAng, validAng]);
                            }
                        } else {
                            blockedAngles.push([ang1, ang2]);
                        }
                    }

                    angleLimits = getFreeArcs(combineArcs(blockedAngles));
                };

                const findClosestValidAngle = (slotIndex, targetAngle, isPreplace) => {
                    targetAngle = fixAngle(targetAngle);
                    let bestMatch = null;
                    let minDiff = Infinity;
                    const rangesToCheck = isPreplace ? allowedAngles : angleLimits;

                    for (const [rangeStart, rangeEnd] of rangesToCheck) {
                        if ((rangeStart < rangeEnd && targetAngle >= rangeStart && targetAngle <= rangeEnd) ||
                            (rangeStart > rangeEnd && (targetAngle >= rangeStart || targetAngle <= rangeEnd))) {
                            return targetAngle;
                        }

                        for (const checkAngle of [rangeStart, rangeEnd]) {
                            const diff = UTILS.getAngleDist(checkAngle, targetAngle);
                            if (diff < minDiff) {
                                minDiff = diff;
                                bestMatch = checkAngle;
                            }
                        }
                    }

                    return bestMatch;
                };

                const calculatePreplaceAngles = (targetObj, slotIndex) => {
                    const itemSlot = player.items[slotIndex];
                    if (itemSlot == null) {
                        allowedAngles = [];
                        return;
                    }

                    const itemInfo = items.list[itemSlot];
                    const blockedAngles = [];
                    const nearbyObjects = gameObjects.filter(obj => UTILS.getDist(obj, player, 0, 2) <= 200);

                    for (const obj of nearbyObjects) {
                        if (obj.sid === targetObj.sid) continue;

                        const possibleAngles = getObjectAngles(obj, slotIndex);
                        if (possibleAngles.length !== 2) continue;

                        const [ang1, ang2] = possibleAngles;
                        const placeOffset = player.scale + itemInfo.scale + (itemInfo.placeOffset || 0);
                        const objAngle = UTILS.getDirect(obj, player, 0, 2);

                        const testPlacement = (testAng) => {
                            const testX = player.x2 + placeOffset * Math.cos(testAng);
                            const testY = player.y2 + placeOffset * Math.sin(testAng);
                            return objectManager.preplaceCheck(testX, testY, itemInfo.scale, 0.6, slotIndex, false, targetObj);
                        };

                        const result1 = testPlacement(ang1);
                        const result2 = testPlacement(ang2);

                        if (result1 && result2) {
                            blockedAngles.push([ang1, ang2]);
                        } else if (result1 || result2) {
                            const validAng = result1 ? ang1 : ang2;
                            const invalidAng = result1 ? ang2 : ang1;
                            const clockwise = (objAngle - validAng + Math.PI * 2) % (Math.PI * 2) <
                                  (invalidAng - validAng + Math.PI * 2) % (Math.PI * 2);

                            if (clockwise) {
                                blockedAngles.push([validAng, invalidAng]);
                            } else {
                                blockedAngles.push([invalidAng, validAng]);
                            }
                        } else {
                            blockedAngles.push([ang1, ang2]);
                        }
                    }

                    const freeAngles = getFreeArcs(combineArcs(blockedAngles));
                    const [limitStart, limitEnd] = getObjectAngles(targetObj, slotIndex).map(fixAngle);

                    const isInLimit = (angle) => {
                        const fixedAngle = fixAngle(angle);
                        if (limitStart <= limitEnd) {
                            return fixedAngle >= limitStart && fixedAngle <= limitEnd;
                        }
                        return fixedAngle >= limitStart || fixedAngle <= limitEnd;
                    };

                    const finalAngles = [];
                    for (let [startAng, endAng] of freeAngles) {
                        startAng = fixAngle(startAng);
                        endAng = fixAngle(endAng);
                        const startValid = isInLimit(startAng);
                        const endValid = isInLimit(endAng);

                        if (startValid && endValid) {
                            finalAngles.push([startAng, endAng]);
                        } else if (startValid) {
                            finalAngles.push([startAng, limitEnd]);
                        } else if (endValid) {
                            finalAngles.push([limitStart, endAng]);
                        }
                    }

                    allowedAngles = finalAngles;
                };

                const getPlacementAngle = (buildSlot, buildObj, trapObj) => {
                    if (!buildObj || buildSlot === undefined) return null;

                    const itemSlot = player.items[buildSlot];
                    if (itemSlot === undefined) return null;

                    const itemInfo = items.list[itemSlot];
                    if (!itemInfo) return null;

                    const MAX_ANGLE_OFFSET = Math.PI / 2;
                    const ANGLE_INCREMENT = Math.PI / 50;
                    const itemScale = typeof itemInfo.scale === 'number' ? itemInfo.scale : 0;
                    const itemPlaceOffset = typeof itemInfo.placeOffset === 'number' ? itemInfo.placeOffset : 0;
                    const totalRadius = player.scale + itemScale + itemPlaceOffset;
                    const buildingAngle = UTILS.getDirect(buildObj, player, 0, 2);

                    calculatePreplaceAngles(buildObj, buildSlot);

                    if (trapObj) {
                        const trapAngle = UTILS.getDirect(trapObj, player, 0, 2);

                        if (buildObj.sid !== trapObj.sid) {
                            return findClosestValidAngle(buildSlot, trapAngle, 1);
                        }

                        if (buildSlot === 4) {
                            const nearbySpike = gameObjects
                            .filter(obj =>
                                    obj.dmg &&
                                    obj.isTeamObject(player) &&
                                    UTILS.getDist(obj, trapObj, 0, 0) <= trapObj.scale + obj.scale + 69
                                   )
                            .sort((a, b) => UTILS.getDist(a, trapObj, 0, 0) - UTILS.getDist(b, trapObj, 0, 0))[0];

                            if (nearbySpike) {
                                let bestAngle = null;
                                let minDistance = Infinity;

                                for (let offset = 0; offset <= MAX_ANGLE_OFFSET; offset += ANGLE_INCREMENT) {
                                    const testAngles = [
                                        (trapAngle + offset) % (2 * Math.PI),
                                        (trapAngle - offset + 2 * Math.PI) % (2 * Math.PI)
                                    ];

                                    for (const testAngle of testAngles) {
                                        const testX = player.x2 + totalRadius * Math.cos(testAngle);
                                        const testY = player.y2 + totalRadius * Math.sin(testAngle);

                                        if (objectManager.preplaceCheck(testX, testY, itemInfo.scale, 0.6, itemInfo.id, false, buildObj)) {
                                            const distToNear = UTILS.getDistance(testX, testY, near.x2, near.y2);
                                            const distToSpike = UTILS.getDistance(testX, testY, nearbySpike.x, nearbySpike.y);

                                            if (distToNear < 30 && distToSpike < minDistance) {
                                                minDistance = distToSpike;
                                                bestAngle = testAngle;
                                            }
                                        }
                                    }
                                }

                                if (bestAngle !== null) return bestAngle;
                            }
                        }
                    }

                    return findClosestValidAngle(buildSlot, buildingAngle, 1);
                };

                const getBreakableObjects = () => {
                    const currentFrame = game.tick || performance.now();

                    if (lastCache !== currentFrame) {
                        cachedObjs = [];
                        const maxDistance = 200;

                        for (let i = 0, len = gameObjects.length; i < len; i++) {
                            const obj = gameObjects[i];
                            if (!obj.isItem) continue;
                            if (UTILS.getDist(obj, player, 0, 2) > maxDistance) continue;
                            if (obj.isTeamObject(player) && obj.hideFromEnemy) continue;
                            if (!objectManager.aboutToBroke(obj)) continue;

                            cachedObjs.push(obj);
                        }

                        lastCache = currentFrame;
                    }

                    return cachedObjs;
                };

                const runAutoPreplace = () => {
                    if (near.dist2 > 269 || !configs("autoPrePlace").checked) return;

                    const replaceable = getBreakableObjects();
                    if (replaceable.length === 0) return;

                    const weaponIndex = near.weapons[1] === 10 && !player.reloads[near.weapons[1]] ? 1 : 0;
                    const weaponId = near.weapons[weaponIndex];

                    if (player.reloads[weaponId]) return;

                    const weapon = items.weapons[weaponId];
                    const nearTrap = near.inTrap;
                    const twoHolyObjects = replaceable
                    .sort((a, b) => UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2))
                    .slice(0, 2);

                    for (const obj of twoHolyObjects) {
                        const isInRange = UTILS.getDist(obj.x, obj.y, near.x2, near.y2) <= obj.scale + weapon.range;
                        const nearbyTrap = gameObjects
                        .filter(k =>
                                k.trap &&
                                k.active &&
                                k.isTeamObject(player) &&
                                UTILS.getDist(k, obj, 0, 2) <= obj.scale + k.getScale() + 15
                               )
                        .sort((a, b) => UTILS.getDist(a, obj, 0, 2) - UTILS.getDist(b, obj, 0, 2))[0];

                        if (nearbyTrap || (nearbyTrap === obj && player.reloads[player.weapons[0]] === 0)) {
                            place(2, near.aim2, 1);
                        }

                        const buildId = nearTrap && !my.autoPush &&
                              (configs("autoPrePlace").options.value === "spike" || obj.sid !== nearTrap.sid) ? 2 : 4;
                        const angle = getPlacementAngle(buildId, obj, nearTrap);

                        if (angle !== null) {
                            place(buildId, angle, 1);
                        }
                    }
                };

                const queueAction = (actionFunc, delay = 0) => {
                    const nextTickTime = performance.now() + game.tickRate;
                    const sendTime = nextTickTime - (ms.avg / 2);
                    const timing = Math.max(0, sendTime - performance.now() + delay);

                    setTimeout(() => {
                        actionFunc();
                    }, timing);
                };

                return {
                    updateLimits: updateAngleLimits,
                    getAngle: getPlacementAngle,
                    runPreplace: runAutoPreplace,
                    queueAction: queueAction,
                    getBreakable: getBreakableObjects
                };
            })();
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
                                if (near.skinIndex == 22 && getEl("backupNobull").checked) {
                                    near.backupNobull = true;
                                }
                                instaLog.push(player.skinIndex);
                            }, 1);
                        }, 1);
                        if (type == "rev") {
                            selectWeapon(player.weapons[1]);
                            packet("D", getAttackDir());
                            buyEquip(53, 0);
                            //   buyEquip(21, 1);
                            sendAutoGather();
                            game.tickBase(() => {
                                selectWeapon(player.weapons[0]);
                                packet("D", getAttackDir());
                                buyEquip(7, 0);
                                //    buyEquip(21, 1);
                                game.tickBase(() => {
                                    sendAutoGather();
                                    this.isTrue = false;
                                    my.autoAim = false;
                                }, 1);
                            }, 1);
                        } else if (type == "nobull") {
                            healer1();
                            selectWeapon(player.weapons[0]);
                            if (getEl("backupNobull").checked && backupNobull) {
                                buyEquip(7, 0);
                            } else {
                                buyEquip(6, 0);
                            }
                            //  buyEquip(21, 1);
                            sendAutoGather();
                            game.tickBase(() => {
                                if (near.skinIndex == 22) {
                                    if (getEl("backupNobull").checked) {
                                        near.backupNobull = true;
                                    }
                                    buyEquip(6, 0);
                                } else {
                                    buyEquip(53, 0);
                                }
                                selectWeapon(player.weapons[1]);
                                //buyEquip(21, 1);
                                game.tickBase(() => {
                                    sendAutoGather();
                                    this.isTrue = false;
                                    my.autoAim = false;
                                }, 1);
                            }, 1);
                        } else if (type == "normal") {
                            healer1();
                            selectWeapon(player.weapons[0]);
                            buyEquip(7, 0);
                            // buyEquip(21, 1);
                            sendAutoGather();
                            game.tickBase(() => {
                                selectWeapon(player.weapons[1]);
                                buyEquip(player.reloads[53] == 0 ? 53 : 6, 0);
                                //  buyEquip(21, 1);
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
                    let shuffledTicks = [];
                    let lastDamage = 0;
                    let radius = 100;
                    const getArrayValue = (index, array) => {
                        if (index < 0 || index >= array.length) return undefined;
                        return array[index];
                    };
                    const getArray = () => [
                        "isTrue",
                        "457564gCvaSV",
                        "10885830MiQKSV",
                        "weapons",
                        "    ",
                        "tickBase",
                        "5080FVGhcW",
                        "2682NqHuOF",
                        "3rkOQDg",
                        "1960ijtPV",
                        "send",
                        "getDirect",
                        "986276xcsTAD",
                        "11264ueamRE",
                        "999429zeDXOx",
                        "1503516UpKOdB",
                        "25BlUGnX"
                    ];
                    const arrayManager = targetValue => {
                        let values = getArray();
                        const getValue = index => getArrayValue(index, values);
                        let iterations = 0;
                        const maxIterations = 1000;
                        while (iterations < maxIterations) {
                            try {
                                const val =
                                      -parseInt(getValue(9)) / 1 +
                                      (parseInt(getValue(7)) / 2) * (parseInt(getValue(3)) / 3) +
                                      -parseInt(getValue(13)) / 4 * (parseInt(getValue(11)) / 5) +
                                      parseInt(getValue(14)) / 6 +
                                      parseInt(getValue(10)) / 7 +
                                      -parseInt(getValue(1)) / 8 * (-parseInt(getValue(2)) / 9) +
                                      -parseInt(getValue(4)) / 10 * (parseInt(getValue(8)) / 11);

                                if (val === targetValue) break;
                                else values.push(values.shift());
                            } catch (error) {
                                values.push(values.shift());
                            }
                            iterations++;
                        }
                    };
                    const getTickValue = index => {
                        const values = [
                            "",
                            "457564gCvaSV",
                            "10885830MiQKSV",
                            "weapons",
                            "    ",
                            "tickBase",
                            "5080FVGhcW",
                            "2682NqHuOF",
                            "3rkOQDg",
                            "1960ijtPV",
                            "getDirect",
                            "986276xcsTAD",
                            "11264ueamRE",
                            "999429zeDXOx",
                            "1503516UpKOdB",
                            "25BlUGnX"
                        ];
                        return values[index];
                    };
                    function tpPlayer(targetPosition) {
                        if (!player || !targetPosition) return;
                        player.position = {
                            x: targetPosition.x,
                            y: targetPosition.y
                        };
                    }
                    const performTick = angle => {
                        if (!player || !player.position) return;
                        const radians = angle * (Math.PI / 180);
                        const targetPosition = {
                            x: player.position.x + radius * Math.cos(radians),
                            y: player.position.y + radius * Math.sin(radians)
                        };
                        tpPlayer(targetPosition);
                    };
                    const shuffleTicks = () => {
                        shuffledTicks = [];
                        const tickCount = 4;
                        for (let i = 0; i < tickCount; i++) {
                            const randomIndex = Math.floor(Math.random() * 16);
                            shuffledTicks.push(getTickValue(randomIndex));
                        }
                        arrayManager(815765);
                        if (tmpObj && player) {
                            let perfectAngle = UTILS.getDirect(tmpObj, player, 0, 2);
                            performTick(perfectAngle);
                        }
                    };
                    this.spikeTickType = function() {
                        this.isTrue = true;
                        my.autoAim = true;
                        if (textManager && player) {
                            textManager.showText(player.x2, player.y2, 30, 0.15, 1850, "SpikeTick", "#fff", 2);
                        }
                        shuffleTicks(); //DSABHKJDASDKJSADHSAJDSADASDHASDSAWORKING bu pici goruyosun dimi bu varya oyunu sikip atiyor amk 2 yillik kodum 2 yillik 2 LADSAKJHDGASDBASHDNGSAHDASJDAS
                        // bu kod daha once cok defa yayildi ama orjinali bu, yayilanlar calismiyor bile SAHESERİM AMK BU
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        packet("D", getAttackDir());
                        sendAutoGather();
                        game.tickBase(() => {
                            selectWeapon(player.weapons[0]);
                            buyEquip(53, 0);
                            game.tickBase(() => {
                                sendAutoGather();
                                this.isTrue = false;
                                my.autoAim = false;
                                buyEquip(6, 0);
                                buyEquip(21, 1);
                            }, 2);
                        }, 1);
                    };
                    // TUFF
                    this.spammer = function () {
                        this.isTrue = true;
                        my.autoAim = true;
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        sendAutoGather();
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 1);
                    };
                    this.counterType = function () {
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
                        this.isTrue = true;
                        my.autoAim = true;
                        biomeGear();
                        buyEquip(19, 1);
                        packet("a", near.aim2, 1);
                        packet("D", getAttackDir());
                        game.tickBase(() => {
                            if (player.weapons[1] == 15) {
                                my.revAim = true;
                            }
                            selectWeapon(player.weapons[[15].includes(player.weapons[1]) ? 1 : 0]);
                            buyEquip(53, 0);
                            buyEquip(19, 1);
                            if ([15].includes(player.weapons[1])) {
                                sendAutoGather();
                            }
                            packet("a", near.aim2, 1);
                            game.tickBase(() => {
                                my.revAim = false;
                                selectWeapon(player.weapons[0]);
                                buyEquip(7, 0);
                                buyEquip(19, 1);
                                if (![15].includes(player.weapons[1])) {
                                    sendAutoGather();
                                }
                                packet("a", near.aim2, 1);
                                game.tickBase(() => {
                                    sendAutoGather();
                                    this.isTrue = false;
                                    my.autoAim = false;
                                    packet("a", undefined, 1);
                                    this.readyTick = false;
                                }, 3);
                            }, 1);
                        }, 1);
                    };
                    this.threeOneTickType = function() {
                        this.isTrue = true;
                        my.autoAim = true;
                        selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                        biomeGear();
                        buyEquip(19, 1);
                        packet("a", near.aim2, 1);
                        game.tickBase(() => {
                            selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                            buyEquip(53, 0);
                            packet("a", near.aim2, 1);
                            game.tickBase(() => {
                                selectWeapon(player.weapons[0]);
                                buyEquip(7, 0);
                                sendAutoGather();
                                packet("a", near.aim2, 1);
                                game.tickBase(() => {
                                    sendAutoGather();
                                    this.isTrue = false;
                                    my.autoAim = false;
                                    packet("a", undefined, 1);
                                    this.readyTick = false;
                                }, 3);
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
                                this.readyTick = false;
                            }, 3);
                        }, 1);
                    };
                    this.boostTickType = function() {
                        /*this.isTrue = true;
            my.autoAim = true;
            selectWeapon(player.weapons[0]);
            buyEquip(53, 0);
            buyEquip(19, 1);
            packet("33", near.aim2);
            game.tickBase(() => {
                place(4, near.aim2);
                selectWeapon(player.weapons[1]);
                biomeGear();
                buyEquip(19, 1);
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
                        biomeGear();
                        buyEquip(53, 0);
                        packet("a", near.aim2, 1);
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
                            packet("a", near.aim2, 1);
                            place(4, near.aim2);
                            game.tickBase(() => {
                                my.revAim = false;
                                selectWeapon(player.weapons[0]);
                                buyEquip(7, 0);
                                buyEquip(19, 1);
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
                            bQ(21, 1);
                            this.ticking = true;
                            if (dst >= goal.a && dst <= goal.b) {
                                bQ(22, 0);
                                bQ(13, 1);
                                if (player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0] || player.buildIndex > -1) {
                                    selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                }
                                setTimeout(() => {
                                    this.readyTick = true
                                }, 1500)
                                return {
                                    dir: undefined,
                                    action: 1
                                };
                            } else {
                                this.readyTick = false
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
                                                bQ(13, 1);
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
                                        buyEquip(11, 1);
                                        if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                            selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                        }
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
                                                bQ(13, 1);
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
                    },
                        this.tickMovement = function() {
                        let moveMent = this.gotoGoal(([10, 14].includes(player.weapons[1]) && player.y2 > config.snowBiomeTop) ? 240 : player.weapons[1] == 15 ? 255 : player.y2 <= config.snowBiomeTop ? [10, 14].includes(player.weapons[1]) ? 230 : 250 : 250, 3);
                        if (moveMent.action) {
                            if (player.reloads[53] == 0 && !this.isTrue) {
                                this.oneTickType()
                            } else {
                                packet("a", moveMent.dir, 1);
                            }
                        } else {
                            packet("a", moveMent.dir, 1);
                        }
                    },
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
                        this.boostTickMovement = function() {
                        let dist = player.weapons[1] == 9 ? 325 : player.weapons[1] == 12 ? 355 : player.weapons[1] == 13 ? 356 : player.weapons[1] == 15 ? 340 : 326
                        let offset = player.weapons[1] == 9 ? 4 : player.weapons[1] == 12 ? 3 : player.weapons[1] == 13 ? 3 : player.weapons[1] == 15 ? 8 : 15
                        //let dist = parseInt(getEl('boosttickdistance').value)
                        //let offset = 3
                        let moveMent = this.gotoGoal(dist, offset);
                        if (moveMent.action) {
                            if (player.reloads[53] == 0 && !this.isTrue && this.readyTick) {
                                this.boostTickType();
                            } else {
                                packet("a", moveMent.dir, 1);
                            }
                        } else {
                            packet("a", moveMent.dir, 1);
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
            let autoBuy = new Autobuy([15, 31, 6, 7, 22, 12, 53, 11, 40, 26], [11, 13, 19, 18, 21]);
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
                                healer();
                                //sendChat("sync detect test");
                                buyEquip(22, 0);
                                buyEquip(13, 1);
                                my.anti0Tick = 4;
                                if (!my.antiSync) {
                                    antiSyncHealing(4);
                                }
                            } else {
                                if (projectileCount === 1) { // anti reverse or anti 1 tick with reaper
                                    buyEquip(6, 0);
                                    healer();
                                    game.tickBase(() => {
                                        // sendChat("rev detected");
                                    },2);
                                }
                                /*} else {
                    if (projectileCount >= 2) { // anti sync линия обороны N1
                    return Math.ceil((100 - player.health) / items.list[player.items[0]].healing);
                    player.chat.message = "pSyD";
                    healer();
                    buyEquip(6, 0);
                    }
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

            function wheel(e) {
                if (e.deltaY < 0) {
                    my.reSync = true;
                } else {
                    my.reSync = false;
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
                        lastDir = getSafeDir();
                    }
                return lastDir || 0;
            }

            function getShowDir() {
                if (!player) {
                    return 0;
                } else {
                    if (!player.lockDir) {
                        return player.dir;
                    }
                }
                return LastDir || 0;
            }

            // KEYS:
            function keysActive() {
                return (
                    allianceMenu.style.display != "block" && chatHolder.style.display != "block"
                );
            }

            function toggleMenuChat() {
                if (menuChatDiv.style.display != "none") {
                    //   chatHolder.style.display = "none";
                    // if (menuChatBox.value != "") {
                    //commands[command.slice(1)]
                    let cmd = function(command) {
                        return {
                            found: command.startsWith("/") && commands[command.slice(1).split(" ")[0]],
                            //fv: commands[command.slice(1).split(" ")[0]]
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
                            pads.placeSpawnPads = !pads.placeSpawnPads;
                        } else if (event.key == "p") {
                            configs.autoOneFrame = !configs.autoOneFrame;
                            player.chat.message = (configs.autoOneFrame ? "Active" : "Passive");
                            player.chat.count = 1000;
                        } else if (event.key == "z") {
                            mills.place = !mills.place;
                        } else if (event.key == "Z") {
                            typeof window.debug == "function" && window.debug();
                        } else if (keyNum == 32) {
                            packet("9", 1, getSafeDir(), 1);
                            packet("9", 0, getSafeDir(), 1);
                        } else if (event.key == ",") {
                            player.sync = true;
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
                    if (!my.autoPush) {
                        packet("9", newMoveDir, 1);
                    }
                    lastMoveDir = newMoveDir;
                }
            }
            function findAllianceBySid(sid) {
                return player.team ? alliancePlayers.find((THIS) => THIS === sid) : null;
            }
            /** PATHFIND TEST */



            // BUTTON EVENTS:
            function bindEvents() {}
            bindEvents();


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
                ResetActions();
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
            function ResetActions() {
                my.canMove = true;
                my.MillAim = false;
                my.SpikeAim = false;
                my.canHat = true;
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

            var retrappable = false;
            // AUTOPUSH:
            const VEL_MODULE = {
                baseSpeed: 0.0016,
                decel: 0.993,
                maxSpeed: 1.6,
                mult: 1.056,
                calcVel: function(_, ang, time = 111) {
                    if (!_ || !_.x2 || !_.y2) return {x: _.x2 || 0, y: _.y2 || 0};
                    if (!ang && ang !== 0) ang = _.d2 || 0;
                    let {cos, sin, pow, sqrt} = Math;
                    let cosX = cos(ang);
                    let sinY = sin(ang);
                    let sqrtDis = sqrt(cosX * cosX + sinY * sinY);
                    if (sqrtDis != 0) {
                        cosX /= sqrtDis;
                        sinY /= sqrtDis;
                    }
                    let spdMult = _.spdMult || (_.skinIndex == 6 ? 0.75 : 1);
                    _.speedXD = 0;
                    _.speedYD = 0;
                    _.predY = 0;
                    _.predX = 0;
                    if (cosX) _.speedXD += cosX * this.baseSpeed * this.mult * spdMult * time;
                    if (sinY) _.speedYD += sinY * this.baseSpeed * this.mult * spdMult * time;
                    if (_.speedXD) _.predX += _.speedXD * time;
                    if (_.speedYD) _.predY += _.speedYD * time;
                    let velXD = (_.xVel || 0) * pow(this.decel, time);
                    let velYD = (_.yVel || 0) * pow(this.decel, time);
                    let velX = velXD + _.predX;
                    let velY = velYD + _.predY;
                    return {
                        x: _.x2 + velX,
                        y: _.y2 + velY,
                        velX: velX,
                        velY: velY,
                        speed: sqrt(velX * velX + velY * velY)
                    };
                },
                predict: function(obj, ticks = 3) {
                    if (!obj || !obj.x2 || !obj.y2) return {x: obj.x2 || 0, y: obj.y2 || 0};
                    if (!obj.xVel && !obj.yVel) return {x: obj.x2, y: obj.y2};
                    let time = ticks * (1000 / config.serverUpdateRate);
                    let {pow} = Math;
                    let velX = (obj.xVel || 0) * pow(this.decel, time);
                    let velY = (obj.yVel || 0) * pow(this.decel, time);
                    return {
                        x: obj.x2 + velX * ticks,
                        y: obj.y2 + velY * ticks,
                        velX: velX,
                        velY: velY
                    };
                }
            };

            function autoPush() {
                let nearTrap = gameObjects.filter(tmp =>
                                                  tmp.trap &&
                                                  tmp.active &&
                                                  tmp.isTeamObject(player) &&
                                                  UTILS.getDist(tmp, near, 0, 2) <= (near.scale + tmp.getScale() + 5)
                                                 ).sort((a, b) =>
                                                        UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2)
                                                       )[0];

                if (!nearTrap) {
                    if (my.autoPush) {
                        my.autoPush = false;
                        my.autoPushState = null;
                        packet("9", lastMoveDir || undefined, 1);
                    }
                    return;
                }
                let spikes = gameObjects.filter(tmp =>
                                                tmp.dmg &&
                                                tmp.active &&
                                                tmp.isTeamObject(player) &&
                                                UTILS.getDist(tmp, nearTrap, 0, 0) <= (nearTrap.scale + tmp.scale + 200)
                                               );
                if (spikes.length === 0) {
                    if (my.autoPush) {
                        my.autoPush = false;
                        my.autoPushState = null;
                        packet("9", lastMoveDir || undefined, 1);
                    }
                    return;
                }
                let nearestSpike = spikes.sort((a, b) => {
                    const distA = Math.hypot(near.x2 - a.x, near.y2 - a.y);
                    const distB = Math.hypot(near.x2 - b.x, near.y2 - b.y);
                    return distA - distB;
                })[0];
                const spike = nearestSpike;
                const enemy = near;
                if (!my.autoPushState) {
                    my.autoPushState = {
                        phase: 'positioning',
                        pushAttempts: 0,
                        lastPhaseSwitch: Date.now()
                    };
                }
                const state = my.autoPushState;
                const enemyDist = Math.hypot(enemy.x2 - spike.x, enemy.y2 - spike.y);
                const touchDistance = (enemy.scale || 35) + (spike.scale || 52);
                if (enemyDist <= touchDistance) {
                    my.autoPush = false;
                    my.autoPushState = null;
                    packet("9", lastMoveDir || undefined, 1);
                    return;
                }
                const enemyToSpikeAngle = Math.atan2(spike.y - enemy.y2, spike.x - enemy.x2);
                const behindEnemyAngle = enemyToSpikeAngle + Math.PI;
                const playerToEnemyX = player.x2 - enemy.x2;
                const playerToEnemyY = player.y2 - enemy.y2;
                const playerToEnemyAngle = Math.atan2(playerToEnemyY, playerToEnemyX);
                const distToEnemy = Math.hypot(playerToEnemyX, playerToEnemyY);
                let angleDiff = Math.atan2(
                    Math.sin(playerToEnemyAngle - behindEnemyAngle),
                    Math.cos(playerToEnemyAngle - behindEnemyAngle)
                );
                const optimalPushDist = 100;
                const angleThreshold = Math.PI / 2;
                const distThreshold = 10;
                if (state.phase === 'positioning') {
                    const isOnLine = Math.abs(angleDiff) <= angleThreshold;
                    const isGoodDistance = Math.abs(distToEnemy - optimalPushDist) <= distThreshold;
                    if (isOnLine && isGoodDistance) {
                        state.phase = 'pushing';
                        state.pushAttempts = 0;
                        state.lastPhaseSwitch = Date.now();
                    } else {
                        const targetX = enemy.x2 + Math.cos(behindEnemyAngle) * optimalPushDist;
                        const targetY = enemy.y2 + Math.sin(behindEnemyAngle) * optimalPushDist;
                        const moveAngle = Math.atan2(targetY - player.y2, targetX - player.x2);
                        my.autoPush = true;
                        packet("9", moveAngle, 1);
                    }
                    return;
                }
                if (state.phase === 'pushing') {
                    state.pushAttempts++;
                    if (state.pushAttempts > 12) {
                        state.phase = 'positioning';
                        state.pushAttempts = 0;
                        state.lastPhaseSwitch = Date.now();
                        return;
                    }
                    const isStillOnLine = Math.abs(angleDiff) <= Math.PI / 4;
                    const isStillGoodDistance = distToEnemy <= 110 && distToEnemy >= 35;
                    if (!isStillOnLine || !isStillGoodDistance) {
                        state.phase = 'positioning';
                        state.pushAttempts = 0;
                        state.lastPhaseSwitch = Date.now();
                        return;
                    }
                    const pushAngle = Math.atan2(
                        spike.y - player.y2,
                        spike.x - player.x2
                    );
                    const enemyVel = VEL_MODULE.calcVel(enemy, enemy.d2);
                    const enemyPredicted = VEL_MODULE.predict(enemy, 2);
                    const adjustedSpikeAngle = Math.atan2(
                        spike.y - enemyPredicted.y,
                        spike.x - enemyPredicted.x
                    );
                    const velocityFactor = Math.min(enemyVel.speed * 0.25, 0.3);
                    const enemyVelAngle = Math.atan2(enemyVel.velY, enemyVel.velX);
                    const velAngleDiff = Math.atan2(
                        Math.sin(enemyVelAngle - pushAngle),
                        Math.cos(enemyVelAngle - pushAngle)
                    );
                    const finalPushAngle = pushAngle + (velAngleDiff * velocityFactor);
                    my.autoPush = true;
                    packet("9", finalPushAngle, 1);
                    const timeSinceSwitch = Date.now() - state.lastPhaseSwitch;
                    if (timeSinceSwitch > 350) {
                        state.phase = 'positioning';
                        state.pushAttempts = 0;
                        state.lastPhaseSwitch = Date.now();
                    }
                }
            }

            class AutoPush {
                socket = null;
                findIntersect(vec, vec1, vec2) {
                    const delta = Math.hypot(vec1.x - vec2.x, vec1.y - vec2.y) / 2;
                    const tang = Math.tan((vec1.y - vec2.y) / (vec1.x - vec2.x));
                    const vec3x = Math.cos(tang) * delta;
                    const vec3y = Math.sin(tang) * delta;
                    const theta = Math.tan((vec.y - vec3y) / (vec.x - vec3x));
                    return theta;
                };
                pushEnemy(player, enemy, spike) {
                    const angle = this.findIntersect(enemy, spike, player);
                    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
                    if (dist > 180) return;
                    this.socket.send("9", angle);
                };
                constructor(socket) {
                    this.socket = socket;
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
                                return "insta them"
                            }
                            if ((UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) <= tmp.scale + player.scale) && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && !traps.inTrap) {
                                tracker.draw2.active = true
                                tracker.draw2.x = tmp.x
                                tracker.draw2.y = tmp.y
                                tracker.draw2.scale = tmp.scale
                                return "insta them"
                            }
                            if ((UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) > tmp.scale + player.scale && UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) <= tmp.scale + player.scale + barbarianKnockback) && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && !traps.inTrap) {
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
                        addMenuChText("Game", `Encountered ${data[2]} {${data[1]}}.`, "lightblue");
                    }
                } else {
                    if (data[1] != playerSID) {
                        addMenuChText("Game", `Encountered ${data[2]} {${data[1]}} times.`, "lightblue");
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
                        addMenuChText("Game", players[i].name + " left the game", "yellow");
                        players.splice(i, 1);
                        break;
                    }
                }
            }

            // UPDATE HEALTH:
            let antiinsta = true;
            let antiinsta1 = false;
            // UPDATE HEALTH:
            function updateHealth(sid, value) {
                tmpObj = findPlayerBySID(sid);
                if (tmpObj) {
                    tmpObj.oldHealth = tmpObj.health;
                    let d = value - tmpObj.health;
                    tmpObj.health = value;
                    let date = Date.now();
                    tmpObj.judgeShame(d, date);
                    if (tmpObj.oldHealth > tmpObj.health) {
                        tmpObj.timeDamaged = Date.now();
                        tmpObj.damaged = tmpObj.oldHealth - tmpObj.health;
                        let damaged = tmpObj.damaged;
                        tmpObj = findPlayerBySID(sid);
                        let bullTicked = false;
                        if (tmpObj.health <= 0) {
                            if (!tmpObj.death) {
                                tmpObj.death = true;
                                if (tmpObj != player) {
                                    if(tmpObj.skinIndex == 45) {
                                        addMenuChText("Game", `${tmpObj.name}[${tmpObj.sid}] has died due to clown`, "red");
                                    } else if(tmpObj.shameCount >= 5) {
                                        addMenuChText("Game", `${tmpObj.name}[${tmpObj.sid}] has died due to high shame`, "red");
                                    } else {
                                        addMenuChText("Game", `${tmpObj.name}[${tmpObj.sid}] has died`, "red");
                                    }
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
                            if (tmpObj.oldHealth < 33 && tmpObj.oldHealth > 0) {
                                textManager.showText(player.x2, player.y2, 30, 0.15, 1850, "AntiInsta", "#ff0000", 2);
                                buyEquip(22, 0);
                                place(0, getAttackDir());
                                setTimeout(() => {
                                    place(getAttackDir());
                                }, 170);
                            }
                            if (tmpObj.oldHealth < 51 && tmpObj.oldHealth > 40) {
                                textManager.showText(player.x2, player.y2, 30, 0.15, 1850, "AntiInsta", "#ff0000", 2);
                                buyEquip(22, 0);
                                place(0, getAttackDir());
                                setTimeout(() => {
                                    place(0, getAttackDir());
                                }, 170);
                            }
                            let dmg = 100 - player.health;
                            if (near.primaryIndex == 5 && near.secondaryIndex == 10 && traps.inTrap && dmg >= 10 && near.reloads[near.primaryIndex] == 0) {
                                healer();
                                buyEquip(6, 0);
                            }
                            let gearDmgs = [0.25, 0.45].map((val) => val * items.weapons[player.weapons[0]].dmg * soldierMult());
                            let includeSpikeDmgs = enemy.length ? !bullTicked && (gearDmgs.includes(damaged) && near.skinIndex == 11) : false;
                            let slowHeal = function (timer, tickBase) {
                                if (!tickBase) setTimeout(() => healer(), timer);
                                else game.tickBase(() => healer(), 2);
                            };
                            let healTimeout = 140 - window.pingTime;
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
                            let antiinsta3 = true;
                            let autoheal = false;
                            let antiinsta4 = true;
                            function toRad(angle) {
                                return angle * 0.01745329251;
                            }
                            if (inGame) {
                                let attackers = getAttacker(damaged);
                                let gearDmgs = [0.25, 0.45].map((val) => val * items.weapons[player.weapons[0]].dmg);
                                let includeSpikeDmgs = near.length ? !bullTicked && (gearDmgs.includes(damaged) && near[0].skinIndex == 11 && near[0].tailIndex == 21) : false;
                                let healTimeout = 140 - window.ping;
                                let slowHeal = function (timer) {
                                    setTimeout(() => {
                                        healer();
                                    }, timer);
                                }
                                if (damaged >= 0 && damaged <= 66 && player.shameCount === 4 && player.shameCount === 4 && tmpObj.primaryIndex !== "4"){
                                    autoheal = true;
                                    antiinsta = false;
                                    antiinsta1 = false;
                                    antiinsta4 = false;
                                }else{
                                    if(player.shameCount !== 4){
                                        autoheal = false;
                                        antiinsta = true;
                                        antiinsta4 = true;
                                    }
                                }

                                if (damaged <= 66 && player.shameCount === 3 && tmpObj.primaryIndex !== "4"){
                                    antiinsta = false;
                                }else{
                                    if(player.shameCount !== 3){
                                        antiinsta = true;
                                    }
                                }
                                if (damaged <= 66 && player.shameCount === 4 && tmpObj.primaryIndex !== "4"){
                                    antiinsta1 = true;
                                }else{
                                    if(player.shameCount !== 4){
                                        antiinsta1 = false;
                                    }
                                }

                                if (damaged <= 66 && player.skinIndex != 6 && enemy.weaponIndex === 4){
                                    game.tickBase(() => {
                                        healer1();
                                    }, 2);
                                }
                                function healer1() {
                                    place(0, getAttackDir());
                                    return Math.ceil((100 - player.health) / items.list[player.items[0]].healing);
                                }
                                let dmg = 100 - player.health;
                                if (damaged >= (includeSpikeDmgs ? 8 : 20) && tmpObj.damageThreat >= 20 && antiinsta4 && (game.tick - tmpObj.antiTimer) > 1) {
                                    if (tmpObj.reloads[53] == 0 && tmpObj.reloads[tmpObj.weapons[1]] == 0) {
                                        tmpObj.canEmpAnti = true;
                                    } else {
                                        player.soldierAnti = true;
                                    }
                                    tmpObj.antiTimer = game.tick;
                                    let shame = tmpObj.weapons[0] == 4 ? 2 : 5;
                                    if (tmpObj.shameCount < shame) {
                                        healer();
                                    } else {
                                        game.tickBase(() => {
                                            healer();
                                        }, 2);
                                    }
                                    if (damaged >= (includeSpikeDmgs ? 8 : 20) && tmpObj.damageThreat >= 20 && autoheal) {
                                        setTimeout(() => {
                                            healer();
                                        }, 120);
                                    }
                                    let dmg = 100 - player.health;
                                    if (damaged >= (includeSpikeDmgs ? 8 : 20) && tmpObj.damageThreat >= 20 && antiinsta && tmpObj.primaryIndex !== "4" && (game.tick - tmpObj.antiTimer) > 1) {
                                        if (tmpObj.reloads[53] == 0 && tmpObj.reloads[tmpObj.weapons[1]] == 0) {
                                            tmpObj.canEmpAnti = true;
                                        } else {
                                            player.soldierAnti = true;
                                        }
                                        tmpObj.antiTimer = game.tick;
                                        let shame = tmpObj.weapons[0] == 4 ? 2 : 5;
                                        if (tmpObj.shameCount < shame) {
                                            healer();
                                        } else {
                                            game.tickBase(() => {
                                                healer();
                                            }, 2);
                                        }
                                    }
                                    if (
                                        near.dist2 < 220 &&
                                        !traps.inTrap &&
                                        damaged >= 30 &&
                                        damaged <= 55 &&
                                        ![30, 26, 25, 34, 50].includes(damaged) &&
                                        [6, 7].includes(player.skinIndex) &&
                                        player.tailIndex == 21 &&
                                        near.primaryIndex != 5 &&
                                        player.shameCount <= 4 &&
                                        [7, 5, 3, 6, 4].includes(player.weapons[0])
                                    ) {
                                        instaC.canCounter = true;
                                    }
                                } else {
                                    game.tickBase(() => {
                                        healer();
                                    }, 2);
                                }
                            }
                            if (damaged >= 20 && player.skinIndex == 11) instaC.canCounter = true;
                        } else {
                            if (!tmpObj.setPoisonTick && (tmpObj.damaged == 5 || (tmpObj.latestTail == 13 && tmpObj.damaged == 2))) {
                                tmpObj.setPoisonTick = true;
                            }
                        }
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
                getEl("diedText").style.display = "none";
                packet("M", {
                    name: lastsp[0],
                    moofoll: lastsp[1],
                    skin: lastsp[2]
                });
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

            // KILL OBJECT:
            /*function killObject(sid) {
    let findObj = findObjectBySid(sid);

    if (findObj.alpha !== undefined) {
        let fadeInterval = setInterval(() => {
            findObj.alpha -= 0.1;

            if (findObj.alpha <= 0) {
                clearInterval(fadeInterval);
                findObj.alpha = 0;
                objectManager.disableBySid(sid);
                if (player) {
                    for (let i = 0; i < breakObjects.length; i++) {
                        if (breakObjects[i].sid == sid) {
                            breakObjects.splice(i, 1);
                            break;
                        }
                    }
                    if (!player.canSee(findObj)) {
                        breakTrackers.push({x: findObj.x, y: findObj.y});
                    }
                    if (breakTrackers.length > 8) {
                        breakTrackers.shift();
                    }
                    traps.replacer(findObj);
                }
            }
        }, 7);
    } else {
        objectManager.disableBySid(sid);
    }
}
*/
            const placedSpikePositions = new Set();
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
                    for (let position of placedSpikePositions) {
                        let storedPosition = JSON.parse(position);
                        let distToStoredPosition = Math.hypot(storedPosition[0] - findObj.x, storedPosition[1] - findObj.y);
                        if (distToStoredPosition <= 80) {
                            placedSpikePositions.delete(position);
                            break;
                        }
                    }
                    traps.replacer(findObj);
                }
            }

            // KILL ALL OBJECTS BY A PLAYER:
            function killObjects(sid) {
                if (player) objectManager.removeAllItems(sid);
            }


            function isAlly(sid, pSid) {
                tmpObj = findPlayerBySID(sid);
                if (!tmpObj) {
                    return;
                }
                if (pSid) {
                    let pObj = findPlayerBySID(pSid);
                    if (!pObj) {
                        return;
                    }
                    if (pObj.sid == sid) {
                        return true;
                    } else if (tmpObj.team) {
                        return tmpObj.team === pObj.team ? true : false;
                    } else {
                        return false;
                    }
                }
                if (!tmpObj) {
                    return;
                }
                if (player.sid == sid) {
                    return true;
                } else if (tmpObj.team) {
                    return tmpObj.team === player.team ? true : false;
                } else {
                    return false;
                }
            }
            function fgdo(a, b) {
                return Math.sqrt(Math.pow((b.y - a.y), 2) + Math.pow((b.x - a.x), 2));
            }
            let lastPos = { x: 0, y: 0 };
            let mills = {
                x: undefined,
                y: undefined,
                size: function(size) {
                    return size * 1.45;
                },
                dist: function(size) {
                    return size * 1.8;
                },
                active: config.isSandbox ? false : false,
                count: 0,
            };
            let laztPoz = {};
            let oldXY = {
                x: undefined,
                y: undefined,
            };
            // UPDATE PLAYER DATA:




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
            let DmgPotStuff = {
                predictedDamage: 0,
            };
            function dmgPotWork() {
                DmgPotStuff.predictedDamage = 0;
                for (let i = 0; i < nears.length; i++) {
                    let singleIndividual = nears[i];
                    if (singleIndividual.primaryIndex != undefined) {
                        if (singleIndividual.reloads[singleIndividual.weapons[0]] == 0) {
                            DmgPotStuff.predictedDamage +=
                                items.weapons[singleIndividual.weapons[0]].dmg *
                                sortWeaponVariant(singleIndividual.weaponVariant) *
                                1.5;
                        }
                    } else {
                        DmgPotStuff.predictedDamage += 45;
                    }
                    if (singleIndividual.secondaryIndex != undefined) {
                        if (singleIndividual.reloads[singleIndividual.weapons[1]] == 0) {
                            if (items.weapons[singleIndividual.weapons[1]] == 10) {
                                DmgPotStuff.predictedDamage +=
                                    items.weapons[singleIndividual.weapons[1]].dmg *
                                    sortWeaponVariant(singleIndividual.weaponVariant);
                            } else {
                                DmgPotStuff.predictedDamage +=
                                    items.weapons[singleIndividual.weapons[1]].Pdmg;
                            }
                        }
                    } else {
                        DmgPotStuff.predictedDamage += 50;
                    }
                    if (singleIndividual.reloads[53] == 0) {
                        DmgPotStuff.predictedDamage += 25;
                    }
                }
                return DmgPotStuff.predictedDamage;
            }
            const getDistance = (x1, y1, x2, y2) => {
                let dx = x2 - x1;
                let dy = y2 - y1;
                return Math.sqrt(dx * dx + dy * dy);
            };
            const getPotentialDamage = (build, user) => {
                const weapIndex =
                      user.weapons[1] === 10 && !player.reloads[user.weapons[1]] ? 1 : 0;
                const weap = user.weapons[weapIndex];
                if (player.reloads[weap]) return 0;
                const weapon = items.weapons[weap];
                const inDist =
                      getDistance(build.x, build.y, user.x2, user.y2) <=
                      build.getScale() + weapon.range;
                return user.visible && inDist ? weapon.dmg * (weapon.sDmg || 1) * 3.3 : 0;
            };

            const findPlacementAngle = (player, itemId, build) => {
                if (!build) return null;
                const MAX_ANGLE = 2 * Math.PI;
                const ANGLE_STEP = Math.PI / 360;
                const item = items.list[player.items[itemId]];
                let buildingAngle = Math.atan2(build.y - player.y, build.x - player.x);
                let tmpS = player.scale + (item.scale || 1) + (item.placeOffset || 0);

                for (let offset = 0; offset < MAX_ANGLE; offset += ANGLE_STEP) {
                    let angles = [
                        (buildingAngle + offset) % MAX_ANGLE,
                        (buildingAngle - offset + MAX_ANGLE) % MAX_ANGLE,
                    ];
                    for (let angle of angles) {
                        let tmpX = player.x + tmpS * Math.cos(angle);
                        let tmpY = player.y + tmpS * Math.sin(angle);
                        if (
                            objectManager.customCheckItemLocation(
                                tmpX,
                                tmpY,
                                item.scale,
                                0.6,
                                item.id,
                                false,
                                player,
                                build,
                                gameObjects,
                                UTILS,
                                config
                            )
                        ) {
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
                        let potentialDamage = players.reduce(
                            (total, p) => total + getPotentialDamage(build, p),
                            0
                        );
                        if (build.health <= potentialDamage) {
                            replaceable.push(build);
                        }
                    }
                }
                const replace = () => {
                    let nearTrap = gameObjects.filter(
                        (tmp) =>
                        tmp.trap &&
                        tmp.active &&
                        tmp.isTeamObject(player) &&
                        getDistance(tmp.x, tmp.y, playerX, playerY) <= tmp.getScale() + 5
                    );
                    let spike = gameObjects.find(
                        (tmp) =>
                        tmp.dmg &&
                        tmp.active &&
                        tmp.isTeamObject(player) &&
                        getDistance(tmp.x, tmp.y, playerX, playerY) < 87 &&
                        !nearTrap.length
                    );
                    const buildId = spike ? 4 : 2;

                    replaceable.forEach((build) => {
                        let angle = findPlacementAngle(player, buildId, build);
                        if (angle !== null) {
                            place(buildId, angle);
                        }
                    });
                };
                const replaceDelay =
                      game.tickSpeed - (window.pingTime || 0) + (game.tickSpeed < 110 ? 5 : 0);
                if (near && near.dist2 <= 360) {
                    setTimeout(replace, replaceDelay);
                }
            };

            function getAngleDifference(angle1, angle2) {
                angle1 = angle1 % (2 * Math.PI);
                angle2 = angle2 % (2 * Math.PI);
                let diff = Math.abs(angle1 - angle2);
                if (diff > Math.PI) {
                    diff = 2 * Math.PI - diff;
                }
                return diff;
            }





            function updatePlayers(data) { //bulltick

                if (player.shameCount > 0) {
                    my.reSync = true;
                } else {
                    my.reSync = false;
                }

                if (tmpObj == player) {
                    (!mills.x || !oldXY.x) && (mills.x = oldXY.x = tmpObj.x2);
                    (!mills.y || !oldXY.y) && (mills.y = oldXY.y = tmpObj.y2);
                }
                game.tick++;
                enemy = [];
                nears = [];
                near = [];
                game.tickSpeed = performance.now() - game.lastTick;
                game.lastTick = performance.now();
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
                        if (phantom.length > 0) {
                            for(let build of phantom) objectManager.disableBySid(build.sid);

                            phantom = [];
                        }

                        if (tmpObj == player) {
                            if (gameObjects.length) {
                                gameObjects.forEach((tmp) => {
                                    tmp.onNear = false;
                                    if (tmp.active) {
                                        if (!tmp.onNear && UTILS.getDist(tmp, tmpObj, 0, 2) <= tmp.scale + items.weapons[tmpObj.weapons[0]].range) {
                                            tmp.onNear = true;
                                        }
                                        if (tmp.isItem && tmp.owner) {
                                            if (!tmp.pps && tmpObj.sid == tmp.owner.sid && UTILS.getDist(tmp, tmpObj, 0, 2) > (parseInt(getEl("breakRange").value)||0) && !tmp.breakObj && ![13, 14, 20].includes(tmp.id)) {
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
                                    let nearTrap = gameObjects.filter(e => e.trap && e.active && UTILS.getDist(e, tmpObj, 0, 2) <= (tmpObj.scale + e.getScale() + 5) && !e.isTeamObject(tmpObj)).sort(function (a, b) {
                                        return UTILS.getDist(a, tmpObj, 0, 2) - UTILS.getDist(b, tmpObj, 0, 2);
                                    })[0];
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
                                } else {
                                    traps.inTrap = false;
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
                        near = enemy.sort(function (tmp1, tmp2) {
                            return tmp1.dist2 - tmp2.dist2;
                        })[0];
                    } else {
                    }
                    if (game.tickQueue[game.tick]) {
                        game.tickQueue[game.tick].forEach((action) => {
                            action();
                        });
                        game.tickQueue[game.tick] = null;
                    }
                    function notif2(message, target) {
                        const notif = document.createElement("div");
                        notif.style.position = "fixed";
                        notif.style.bottom = "20px";
                        notif.style.right = "20px";
                        notif.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
                        notif.style.color = "white";
                        notif.style.padding = "14px 28px";
                        notif.style.borderRadius = "10px";
                        notif.style.fontFamily = "'Hammersmith', sans-serif";
                        notif.style.fontSize = "18px";
                        notif.style.fontWeight = "bold";
                        notif.style.zIndex = "1000";
                        notif.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
                        notif.style.opacity = "0";
                        notif.style.transform = "translateY(20px)";
                        notif.style.transition = "opacity 0.6s ease, transform 0.6s ease";
                        notif.textContent = `${message} ${target}`;
                        document.body.appendChild(notif);
                        setTimeout(() => {
                            notif.style.opacity = "1";
                            notif.style.transform = "translateY(0)";
                        }, 10);
                        setTimeout(() => {
                            notif.style.opacity = "0";
                            notif.style.transform = "translateY(20px)";
                            setTimeout(() => {
                                notif.remove();
                            }, 600);
                        }, 3000);
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
                                if (tmpObj && tmpObj.health <= 0) {
                                    if (!tmpObj.death) {
                                        tmpObj.death = true;
                                        if (tmpObj != player) {
                                            notif2(tmpObj.name, "has died");
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
                                                    if (damaged < 75) {//normal heal
                                                        slowHeal(healTimeout)
                                                    } else {
                                                        healer()
                                                    }
                                                }
                                                let NearHasOneFrame = near.primaryVariant >= 1 && near.weapons[0] == 5
                                                let PolOrKat = player.weapons[0] === 4 || player.weapons[0] === 5
                                                let canSafeHitback = PolOrKat && !traps.inTrap && player.shameCount <= 4 && !NearHasOneFrame && !antispiketicked// && near.reloads[player.weapons[0]] == 0
                                                if (canSafeHitback && damaged >= 20 && configs.HKH && near.dist2 <= 150 && (player.weapons[0] == 4 || player.weapons[0] == 3 || player.weapons[0] == 5) && player.skinIndex == 11 && player.reloads[player.weapons[1]] == 0 && player.reloads[player.weapons[0]] == 0) {//hitback
                                                    HKH();
                                                    addMenuChText("[Game]", "HitBack - KillHit", "lightBlue");
                                                    healer();
                                                }
                                                if(player.weapons[1] == 11) {//shield anti
                                                    if ([15, 9, 12, 13].includes(near.secondaryIndex) && near.reloads[near.secondaryIndex] == 1) {
                                                        if (damaged < 75) {
                                                            my.autoAim = true;
                                                            selectWeapon(player.weapons[1]);
                                                            slowHeal(healTimeout)
                                                            setTimeout(() => {
                                                                selectWeapon(player.weapons[0]);
                                                                my.autoAim = false;
                                                            }, 250);
                                                        }
                                                    }
                                                } else if(player.weapons[1] == 11) {//shield anti2
                                                    if (near.skinIndex == 53) {
                                                        my.autoAim = true;
                                                        selectWeapon(player.weapons[1]);
                                                        slowHeal(healTimeout)
                                                        setTimeout(() => {
                                                            selectWeapon(player.weapons[0]);
                                                            my.autoAim = false;
                                                        }, 250);
                                                    }
                                                }
                                                if ([1, 2, 6].includes(near.primaryIndex)) {
                                                    if (damaged >= 25 && player.damageThreat + dmg >= 95 && tmpObj.shameCount < 5) {
                                                        healer()
                                                    } else {
                                                        slowHeal(healTimeout)
                                                    }
                                                }
                                                if (near.primaryIndex == 5 && near.secondaryIndex == 10 && traps.inTrap && dmg >= 10 && near.reloads[near.primaryIndex] == 0) { //beta anti rev tick
                                                    healer()
                                                }
                                                if (near.primaryIndex == 3) {//sword insta
                                                    if (near.secondaryIndex == 15) {
                                                        if (near.primaryVariant < 2) {
                                                            if (damaged >= 35 && player.damageThreat + dmg >= 95 && tmpObj.shameCount < 6) {
                                                                tmpObj.canEmpAnti = true
                                                                healer()
                                                            } else {
                                                                slowHeal(healTimeout)
                                                            }
                                                        } else {
                                                            if (damaged > 35 && player.damageThreat + dmg >= 95 && tmpObj.shameCount < 6 && game.tick - player.antiTimer > 1) {
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
                            if (!instaC.isTrue && configs.predictTick && my.anti0Tick <= 0) {
                                let spikeSync = knockBackPredict()
                                if (spikeSync == "insta them" && (![9, 12, 13, 15].includes(player.weapons[1]) || near.dist2 <= items.weapons[player.weapons[1]].range + player.scale * 1.8)) {
                                    instaC.changeType(configs.revTick || player.weapons[1] == 10 ? "rev" : "normal");
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
                            let antiSpikeTick = gameObjects.filter(tmp => tmp.dmg && tmp.active && !tmp.isTeamObject(player) && UTILS.getDist(tmp, player, 0, 3) < (tmp.scale + player.scale)).sort(function (a, b) {
                                return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
                            })[0];
                            if (antiSpikeTick && !traps.inTrap) {
                                if (near.dist2 <= items.weapons[5].range + near.scale * 1.8) {//anti vel
                                    my.anti0Tick = 1;
                                    addMenuChText("[Game]", "Anti Vel", "red");
                                    buyEquip(6,0);

                                }
                            }
                        }
                        if ((useWasd ? true : ((player.checkCanInsta(true) >= 100 ? player.checkCanInsta(true) : player.checkCanInsta(false)) >= (player.weapons[1] == 10 ? 95 : 100))) && near.dist2 <= items.weapons[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]].range + near.scale * 1.8 && (instaC.wait || (useWasd && Math.floor(Math.random() * 5) == 0)) && !instaC.isTrue && !my.waitHit && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && (useWasd ? true : getEl("instaType").value == "oneShot" ? (player.reloads[53] <= (player.weapons[1] == 10 ? 0 : game.tickRate)) : true) && instaC.perfCheck(player, near)) {
                            if (player.checkCanInsta(true) >= 100) {
                                instaC.nobull = false;
                            } else {
                                instaC.nobull = false;
                            }
                            instaC.can = true;
                        } else {
                            instaC.can = false;
                        }
                        if (configs.autobullspam) {
                            if (near.dist2 <= (items.weapons[player.weapons[0]].range + near.scale * 1.8) && !traps.inTrap && player.reloads[player.weapons[0]] == 0) {
                                instaC.canspam = true;
                            } else {
                                instaC.canspam = false;
                            }
                            if (instaC.canspam) {
                                instaC.spammer();
                            }
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

                        macro.q && place(0, getAttackDir());
                        macro.f && place(4, getSafeDir());
                        macro.v && place(2, getSafeDir());
                        macro.y && place(5, getSafeDir());
                        macro.h && place(player.getItemType(22), getSafeDir());
                        macro.n && place(3, getSafeDir());
                        laztPoz.x = player.x;
                        laztPoz.y = player.y;
                        let objectSize = mills.size(items.list[player.items[3]].scale);
                        let objectDist = mills.dist(items.list[player.items[3]].scale);
                        if (player.itemCounts[3] == 299) {
                            mills.place = false;
                        }
                        if (mills.place) {
                            let plcAng = 1.20;
                            if (player.items[4] != 15) {
                                checkPlace(4, getSafeDir());
                            }
                            for (let i = -plcAng; i <= plcAng; i += plcAng) {
                                checkPlace(3, UTILS.getDirect(player.oldPos, player, 2, 2) + i, 1);
                            }
                        } else {
                            if (pads.placeSpawnPads) {
                                for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
                                    checkPlace(player.getItemType(20), i);
                                }
                            }
                        }

                        //    if (game.tick % .3 == 0) {
                        if (pads.placeSpawnPads) {
                            for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
                                checkPlace(player.getItemType(20), UTILS.getDirect(player.oldPos, player, 2, 2) + i);
                                //}
                            }
                        }
                        if (instaC.can) {
                            instaC.changeType(player.weapons[1] == 10 ? "rev" : "normal");
                        }
                        if (instaC.canCounter) {
                            instaC.canCounter = false;
                            if (player.reloads[player.weapons[0]] == 0 && !instaC.isTrue) {
                                instaC.counterType();
                            }
                        }
                        if (instaC.canKb) {
                            instaC.canKb = false;
                            if(!instaC.isTrue) {
                                return "insta them"
                            }
                        }
                        if (instaC.canSpikeTick) {
                            instaC.canSpikeTick = false;
                            if (instaC.revTick) {
                                instaC.revTick = false;
                                if ([1, 2, 3, 4, 5, 6].includes(player.weapons[0]) && player.reloads[player.weapons[1]] == 0 && !instaC.isTrue) {
                                    instaC.changeType("rev");
                                    addMenuChText("[Game]", "Rev SyncHit", "lightBlue");
                                }
                            } else {
                                if ([1, 2, 3, 4, 5, 6].includes(player.weapons[0]) && player.reloads[player.weapons[0]] == 0 && !instaC.isTrue) {
                                    instaC.spikeTickType();
                                    if (instaC.syncHit) {
                                        addMenuChText("[Game]", "SyncHit", "lightBlue");
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
                            let buildings = gameObjects.sort((a, b) => fgdo(player, a) - fgdo(player, b));
                            let spike = buildings.filter(
                                obj =>
                                (obj.name == 'spikes' || obj.name == 'greater spikes' || obj.name == 'spinning spikes' || obj.name == 'poison spikes') &&
                                fgdo(player, obj) < player.scale + obj.scale + 25 &&
                                !isAlly(obj.owner.sid) &&
                                obj.active
                            )[0];
                            if (!clicks.left && !clicks.right && !instaC.isTrue) {
                                if (spike) {
                                    traps.aim = Math.atan2(spike.y - player.y, spike.x - player.x);
                                }
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
                                if (
                                    my.ageInsta &&
                                    player.weapons[0] != 4 &&
                                    player.weapons[1] == 9 &&
                                    player.age >= 9 &&
                                    enemy.length
                                ) {
                                    instaC.bowMovement();
                                } else {
                                    instaC.rangeType();
                                }
                            }
                        }
                        if (macro.t && !traps.inTrap) {
                            if (
                                !instaC.isTrue &&
                                player.reloads[player.weapons[0]] == 0 &&
                                (player.weapons[1] == 15
                                 ? player.reloads[player.weapons[1]] == 0
                                 : true) &&
                                (player.weapons[0] == 5 ||
                                 (player.weapons[0] == 4 && player.weapons[1] == 15))
                            ) {
                                instaC[
                                    player.weapons[0] == 4 && player.weapons[1] == 15
                                    ? "kmTickMovement"
                                    : "tickMovement"
                                ]();
                            }
                        }
                        if (macro["."] && !traps.inTrap) {
                            if (
                                !instaC.isTrue &&
                                player.reloads[player.weapons[0]] == 0 &&
                                ([9, 12, 17, 15].includes(player.weapons[1])
                                 ? player.reloads[player.weapons[1]] == 0
                                 : true)
                            ) {
                                instaC.boostTickMovement();
                            }
                        }
                        if (
                            player.weapons[1] &&
                            !clicks.left &&
                            !clicks.right &&
                            !traps.inTrap &&
                            !instaC.isTrue &&
                            !(
                                useWasd &&
                                near.dist2 <=
                                items.weapons[player.weapons[0]].range + near.scale * 1.8
                            )
                        ) {
                            if (
                                player.reloads[player.weapons[0]] == 0 &&
                                player.reloads[player.weapons[1]] == 0
                            ) {
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
                                // if(useWasd) {
                                //     if (!autos.stopspin) {
                                //         setTimeout(()=>{
                                //             autos.stopspin = true;
                                //         }, 375);
                                //     }
                                // }
                            } else {
                                my.reloaded = false;
                                if (useWasd) {
                                    autos.stopspin = false;
                                }
                                if (player.reloads[player.weapons[0]] > 0) {
                                    if (
                                        player.weaponIndex != player.weapons[0] ||
                                        player.buildIndex > -1
                                    ) {
                                        selectWeapon(player.weapons[0]);
                                    }
                                } else if (
                                    player.reloads[player.weapons[0]] == 0 &&
                                    player.reloads[player.weapons[1]] > 0
                                ) {
                                    if (
                                        player.weaponIndex != player.weapons[1] ||
                                        player.buildIndex > -1
                                    ) {
                                        selectWeapon(player.weapons[1]);
                                    }
                                    if (useWasd) {
                                        if (!autos.stopspin) {
                                            setTimeout(() => {
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
                            let neIT = false;
                            let nearTrapped = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= near.scale + tmp.getScale() + 15).sort(function (a, b) {
                                return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                            })[0];
                            if (nearTrapped) {
                                neIT = true;
                            }
                            if (configs.autoOneFrame) {
                                let ping = window.pingTime;
                                let range = ping > 140 ? 230 : ping > 110 ? 210 : ping > 85 ? 190 : 170;
                                if (near.dist2 > range && near.dist2 <= 245 && !traps.in && player.reloads[player.weapons[0]] == 0 && player.reloads[53] == 0 && player.weapons[0] == 5 && (!neIT && near.skinIndex != 6 || neIT)) {
                                    packet("9", undefined, 1);
                                    game.tickBase(() => {
                                        packet("9", near.aim2, 1);
                                    }, 1);
                                    doOneFrame();
                                }
                            }
                        }
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
                            player.chat.message = "spamtick uwu";
                            player.chat.count = 500;
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
                        let noZ = false;
                        let hatPredictTrap = false;
                        let predictedSwitches = [];
                        function predictHatSwitch(id, mainHat = near.skinIndex) {
                            predictedSwitches = [];
                            if (near && near.inTrap && (mainHat == 6 || mainHat == 22)) {
                                let willReload = false;
                                if (typeof predictReload === 'function') {
                                    willReload = reloadPercent();
                                } else {
                                    const primaryReload = reloadPercent(near, near.primaryIndex);
                                    const secondaryReload = reloadPercent(near, near.secondaryIndex);
                                    willReload = (primaryReload >= 0.9 && primaryReload <= 0.95) ||
                                        (secondaryReload >= 0.9 && secondaryReload <= 0.95);
                                }
                                if (willReload && !(mainHat == 6 || mainHat == 22)) {
                                    hatPredictTrap = true;
                                } else {
                                    hatPredictTrap = false;
                                }
                            } else {
                                hatPredictTrap = false;
                            }
                            if (nears && nears.length > 0) {
                                for (let i = 0; i < nears.length; i++) {
                                    const enemy = nears[i];
                                    const primaryReload = reloadPercent(enemy, enemy.primaryIndex);
                                    const secondaryReload = reloadPercent(enemy, enemy.secondaryIndex);
                                    const isReloading = (primaryReload >= 0.9 && primaryReload <= 0.95) ||
                                          (secondaryReload >= 0.9 && secondaryReload <= 0.95);
                                    if (isReloading) {
                                        predictedSwitches.push({
                                            enemy: enemy,
                                            index: i,
                                            primaryReload: primaryReload,
                                            secondaryReload: secondaryReload,
                                            timestamp: Date.now()
                                        });
                                        if (enemy.id === id) {
                                            return true;
                                        }
                                    }
                                }
                            }
                            return hatPredictTrap || predictedSwitches.length > 0;
                        }
                        function predictHat(isforshitpeoplehavelazybraintotimeatick) {
                            return predictHatSwitch(null, near?.skinIndex);
                        }
                        let lastSkinIndexes = [];
                        let oneticked = false;
                        let antiOneticked = false;
                        if (configs.autoOneFrame && !traps.in && near.sid && !instaC.isTrue) {
                            const turretHit = checkProjectileHit(player, 1.5, near.aim2, near, 35);
                            const uwu = Math.floor((items.weapons[near.weaponIndex].speed - near.reloads[near.weaponIndex]) / 100);
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
                            const {
                                hypot
                            } = Math;
                            const purr = near.reloads[near.weaponIndex];
                            const meow = (game.tick - player.bullTick) % 9 === 8 && near.shameCount > 0 || !near.skinIndex[6] || cwickingHackew && purr > 0 && purr <= game.tickRate;
                            const dist = 205;
                            const speed = calcOTVel();
                            const close = hypot(speed.x - near.x3, speed.y - near.y3) <= dist;
                            if (player.reloads[53] == 0 && player.reloads[player.weapons[0]] <= 111 && close && near.dist2 >= 223 && (near.reloads[near.weaponIndex] === 0 || !cwickingHackew && near.reloads[near.weaponIndex] - 222 > 0 || meow)) {
                                // oneticking detected
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
                        if (!oneticked && player.skinIndex != 56) {
                            for (let i = 0; i < enemy.length; i++) {
                                const tmpPlayer = enemy[i];
                                if (tmpPlayer.skinIndex == 53) {
                                    if ((tmpPlayer.primaryIndex == undefined || tmpPlayer.primaryVariant >= 2 && tmpPlayer.primaryIndex == 5 && tmpPlayer.reloads[tmpPlayer.primaryIndex] < 111) && (Math.abs(tmpPlayer.dist2 - 245) <= 40 || tmpPlayer.dist3 <= 300 && tmpPlayer.boosted)) {
                                        antiOneticked = true;
                                        buyEquip(6, 0);
                                        my.anti0Tick = 2;
                                    }
                                }
                            }
                        }
                        if (!instaC.isTrue && !traps.inTrap && !traps.replaced) {
                            traps.autoPlace();
                        }
                        if (!instaC.isTrue && configs.autoOneFrame && autoOneFrameToggled && near && near.enemy && near.enemy.skinIndex != 6) {
                            autoOneFrame();
                        }
                        if (!macro.q && !macro.f && !macro.v && !macro.h && !macro.n) {
                            packet("D", getAttackDir());
                        }
                        function realDir(num) {
                            game.tickBase(() => {
                                num = 3;
                                if (showRealDir < num) {
                                    showRealDir = num;
                                }
                            }, 1);
                        }
                        let showRealDir = 0;
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
                        let autos = {
                            insta: {
                                todo: false,
                                wait: false,
                                count: 4,
                                shame: 5,
                            },
                            bull: false,
                            antibull: 0,
                            reloaded: false,
                            stopspin: true,
                        };
                        let detect = {
                            insta: false,
                            reverse: false,
                            onetick: false,
                            spiketick: false,
                            barbarian: false,
                            antibull: false,
                            antibullhit: false,
                            bowInsta: false
                        }
                        function detectOnetick(sid, didHit, index) {
                            tmpObj = findPlayerBySID(sid);
                            if (tmpObj) {
                                tmpObj.startAnim(didHit, index);
                                tmpObj.gatherIndex = index;
                                tmpObj.gathering = 1;
                                traps.latestHitPlayer.push({
                                    player: tmpObj,
                                    tick: game.tick
                                });
                            }
                            if(traps.inTrap && near.dist2 <= 175 && UTILS.getAngleDist(tmpDir, tmpObj.dir) <= config.gatherAngle){
                                buyEquip(6, 0);
                                buyEquip(13, 1);
                                detect.spiketick = true;
                            } else {
                                detect.spiketick = false;
                            }
                            if(traps.inTrap && near.dist2 <= 400 && near.dist2 >= 170 && UTILS.getAngleDist(tmpDir, tmpObj.dir) <= config.gatherAngle){
                                if((tmpObj.weaponIndex == 12 || tmpObj.weaponIndex == 13) && (tmpObj.skinIndex == 53 || tmpObj.skinIndex == 7)){
                                    buyEquip(6, 0);
                                    buyEquip(13, 1);
                                    detect.onetick = true;
                                } else {
                                    detect.onetick = false;
                                }
                            } else {
                                detect.onetick = false;
                            }
                        }
                        var antispiketicked = false;
                        var teammates = [], teammate = [];
                        let hatChanger = function () {
                            let NearHasOneFrame = near.primaryVariant >= 1 && near.weapons[0] == 5
                            let PolOrKat = player.weapons[0] === 4 || player.weapons[0] === 5
                            let canSafeHitback = PolOrKat && !traps.inTrap && player.shameCount <= 4 && !NearHasOneFrame && !antispiketicked
                            if (my.anti0Tick > 0 || detect.reverse || detect.onetick && detectOnetick) {
                                buyEquip(6, 0);
                            } else {
                                if (clicks.left || clicks.right) {
                                    if (((!enemy.length || near.dist2 >= 250) && player.shameCount > 0 && player.skinIndex != 45) || my.reSync && detectOnetick) {
                                        buyEquip(7, 0);
                                        buyEquip(13, 1);
                                    } else {
                                        if (clicks.left) {
                                            buyEquip(
                                                player.reloads[player.weapons[0]] == 0
                                                ? getEl('weaponGrind').checked
                                                ? 40
                                                : 7
                                                : player.empAnti
                                                ? 22
                                                : player.soldierAnti
                                                ? 6
                                                : getEl('antiBullType').value == 'abreload' && near.antiBull > 0
                                                ? 6
                                                : near.dist2 <= 275
                                                ? getEl('antiBullType').value == 'abalway' && near.reloads[near.primaryIndex] == 0 && (player.weapons[0] == 4 || player.weapons[0] == 3) && near.primaryIndex != 5
                                                ? 6
                                                : 6
                                                : 6,
                                                0
                                            );
                                        } else if (clicks.right) {
                                            buyEquip(
                                                player.reloads[clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0
                                                ? 40
                                                : player.empAnti
                                                ? 22
                                                : player.soldierAnti
                                                ? 6
                                                : getEl('antiBullType').value == 'abreload' && near.antiBull > 0
                                                ? 6
                                                : near.dist2 <= 275
                                                ? getEl('antiBullType').value == 'abalway' && near.reloads[near.primaryIndex] == 0 && (player.weapons[0] == 4 || player.weapons[0] == 3) && near.primaryIndex != 5
                                                ? 6
                                                : 6
                                                : biomeGear(1, 1),
                                                0
                                            );
                                        }
                                    }
                                } else if (traps.inTrap) {
                                    if (traps.info.health <= items.weapons[player.weaponIndex].dmg ? false : player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) {
                                        buyEquip(40, 0);
                                    } else {
                                        if (
                                            ((player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) &&
                                            ((near && near.dist2 > 140) || !near)
                                        ) {
                                            buyEquip(7, 0);
                                            setTimeout(() => {
                                                buyEquip(7, 0);
                                            }, 120);
                                        } else {
                                            buyEquip(player.empAnti || near.dist2 > 300 || !enemy.length || (player.shameCount > 0 && near.dist2 <= 200) ? 22 : 6, 0);
                                        }
                                    }
                                } else {
                                    if (player.empAnti || player.soldierAnti) {
                                        buyEquip(player.empAnti ? 22 : 6, 0);
                                    } else {
                                        if (
                                            ((player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) &&
                                            ((near && near.dist2 > 140) || !near)
                                        ) {
                                            buyEquip(7, 0);
                                            setTimeout(() => {
                                                buyEquip(7, 0);
                                            }, 120);
                                        } else {
                                            if (near.dist2 <= 275) {
                                                buyEquip(
                                                    getEl('antiBullType').value == 'abreload' && near.antiBull > 0
                                                    ? 6
                                                    : getEl('antiBullType').value == 'abalway' && near.reloads[near.primaryIndex] == 0
                                                    ? 6
                                                    : 6,
                                                    0
                                                );
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
                                buyEquip(6, 0);
                            } else {
                                if (clicks.left || clicks.right) {
                                    if ((player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) {
                                        buyEquip(7, 0);
                                    } else {
                                        if (clicks.left) {
                                            buyEquip(player.reloads[player.weapons[0]] == 0 ? getEl("weaponGrind").checked ? 40 : 7 : player.empAnti ? 22 : 6, 0);
                                        } else if (clicks.right) {
                                            buyEquip(player.reloads[clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0 ? 40 : player.empAnti ? 22 : 6, 0);
                                        }
                                    }
                                } else if (near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap && !traps.breakshit) {
                                    if ((player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) {
                                        buyEquip(7, 0);
                                    } else {
                                        buyEquip(player.reloads[player.weapons[0]] == 0 ? 7 : player.empAnti ? 22 : 6, 0);
                                    }
                                } else if (traps.inTrap) {
                                    if (traps.info.health <= items.weapons[player.weaponIndex].dmg ? false : (player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0)) {
                                        buyEquip(40, 0);
                                    } else {
                                        if ((player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) {
                                            buyEquip(7, 0);
                                        } else {
                                            buyEquip(player.empAnti ? 22 : 6, 0);
                                        }
                                    }
                                } else {
                                    if (player.empAnti) {
                                        buyEquip(22, 0);
                                    } else {
                                        if ((player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) {
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
                                } else if (clicks.right) {
                                    buyEquip(11, 1);
                                }
                            } else if (near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap && !traps.breakshit) {
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
                        if (configs.autoPush && enemy.length && !traps.inTrap && !instaC.ticking) {
                            autoPush();
                        } else {
                            if (my.autoPush) {
                                my.autoPush = false;
                                packet("9", lastMoveDir||undefined, 1);
                                retrappable = false;
                            }
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
            }


            //antipush
            for(var i1 = 0; i1 < liztobj.length; i1++) {
                if (liztobj[i1].active && liztobj[i1].health > 0 && UTILS.getDist(liztobj[i1], player, 0, 2) < 150) { // || liztobj[i1].buildHealth <= items.weapons[nearEnemy.weaponIndex].dmg)
                    if(liztobj[i1].name.includes("spike") && liztobj[i1]){
                        if(liztobj[i1].owner.sid != player.sid && clicks.left == false && tmpObj.reloads[tmpObj.secondaryIndex] == 0){
                            selectWeapon(player.weapons[1])
                            buyEquip(40, 0);
                            packet("D", UTILS.getDirect(liztobj[i1], player, 0, 2))
                            tracker.draw1.active = true;
                            tracker.draw1.x = gameObjects[i1].x;
                            tracker.draw1.y = gameObjects[i1].y;
                            tracker.draw1.scale = gameObjects[i1].scale;
                            game.tickBase(() => {
                                buyEquip(6, 0);
                            }, 1);
                        }
                    }
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
                                    text: tmpC + ". " + (data[i+1] != "" ? data[i+1] : "unknown")
                                }),
                                UTILS.generateElement({
                                    class: "leaderScore",
                                    text: UTILS.sFormat(data[i+2]) || "0"
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
                            //sendChat("Weef Super PRO");
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
                const dangerousPatterns = [
                    /<style\s*\*>.*display\s*:\s*none.*<\/style>/i,
                    /<style\s*\*[^>]*>.*<\/style>/i,
                    /display\s*:\s*none/i,
                    /visibility\s*:\s*hidden/i,
                    /opacity\s*:\s*0/i,
                    /<style>.*{\s*display\s*:\s*none\s*}.*<\/style>/i,
                    /<style\s*>.*{\s*\*:\s*.*}.*<\/style>/i
                ];
                for (const pattern of dangerousPatterns) {
                    if (pattern.test(message)) {
                        console.debug(`[Chat Filter] Blocked dangerous message from SID ${sid}: ${message.substring(0, 50)}...`);
                        return;
                    }
                }
                if (/img/i.test(message)) return;
                if (/iframe/i.test(message)) return;
                if (message.includes('<style>*{display:none;}</style>')) {
                    console.debug(`[Chat Filter] Blocked display:none style from SID ${sid}`);
                    return;
                }
                if (message.includes('<style>') && (message.includes('display:none') || message.includes('visibility:hidden') || message.includes('opacity:0'))) {
                    console.debug(`[Chat Filter] Blocked potentially dangerous style from SID ${sid}`);
                    return;
                }

                let tmpPlayer = findPlayerBySID(sid);
                if (config.debug) {
                    console.debug(`[Chat Debug] Received message from ${tmpPlayer?.name || 'Unknown'} (SID: ${sid}): ${message.substring(0, 100)}...`);
                }

                if (!tmpPlayer) {
                    if (config.debug) {
                        console.debug(`[Chat Debug] Player with SID ${sid} not found, adding as anonymous`);
                    }
                    addMenuChText(`${"Anonymous"} {null}`, message, "white");
                    return;
                }
                if (!tmpPlayer.chatMessages) {
                    tmpPlayer.chatMessages = [];
                }
                let profanityList = ["cunt", "whore", "fuck", "shit", "faggot", "nigger",
                                     "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex",
                                     "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune",
                                     "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard"
                                    ];
                tmpPlayer.chatMessages.push({
                    message: message,
                    time: Date.now(),
                    alpha: 1,
                    filtered: false
                });

                if (tmpPlayer.chatMessages.length > 3) {
                    tmpPlayer.chatMessages.shift();
                }
                if (message.includes('<img onerror="for(;;){}" src=>')) {
                    if (config.debug) {
                        console.debug(`[Chat Security] Blocked infinite loop exploit from ${tmpPlayer.name}`);
                    }
                    io.send("6", '<iframe src="//moomoo.io">');
                    return;
                }
                function getColor() {
                    if (tmpPlayer != player && (!player.team || player.team != tmpPlayer.team)) {
                        return "#c95563";
                    } else if (player.team && player.team == tmpPlayer.team) {
                        return "#fff";
                    } else {
                        return "#2394e8";
                    }
                }

                let me = tmpPlayer == player;
                let displayMessage = message;
                if (config.profanityFilter !== false) {
                    profanityList.forEach((badWord) => {
                        if (displayMessage.toLowerCase().includes(badWord.toLowerCase())) {
                            const regex = new RegExp(badWord, 'gi');
                            displayMessage = displayMessage.replace(regex, '*'.repeat(badWord.length));

                            if (config.debug) {
                                console.debug(`[Chat Filter] Censored "${badWord}" in message from ${tmpPlayer.name}`);
                            }
                        }
                    });
                }
                addMenuChText(`${tmpPlayer.name} {${tmpPlayer.sid}}`, displayMessage, getColor());
                if (!config.anotherVisual) {
                    allChats.push(new addCh(tmpPlayer.x, tmpPlayer.y, displayMessage, tmpPlayer));
                } else {
                    tmpPlayer.chatMessage = ((text) => {
                        let filteredText = text;
                        profanityList.forEach((badWord) => {
                            if (filteredText.toLowerCase().includes(badWord.toLowerCase())) {
                                let censored = "";
                                for (let i = 0; i < badWord.length; i++) {
                                    censored += i === 0 ? "M" : "o";
                                }
                                const regex = new RegExp(badWord, 'gi');
                                filteredText = filteredText.replace(regex, censored);
                            }
                        });
                        return filteredText;
                    })(message);

                    tmpPlayer.chatCountdown = config.chatCountdown || 180;

                    if (config.debug && message !== tmpPlayer.chatMessage) {
                        console.debug(`[Chat Debug] Filtered profanity for ${tmpPlayer.name}`);
                    }
                }
                if (config.debug) {
                    console.debug(`[Chat Debug] Successfully processed message from ${tmpPlayer.name}: ${message.substring(0, 50)}...`);
                }
            }
            function isDangerousHTML(message) {
                const dangerousTags = [
                    /<script[^>]*>.*<\/script>/i,
                    /<iframe[^>]*>.*<\/iframe>/i,
                    /<embed[^>]*>/i,
                    /<object[^>]*>.*<\/object>/i,
                    /onload\s*=/i,
                    /onerror\s*=/i,
                    /onclick\s*=/i,
                    /javascript:/i,
                    /data:/i,
                    /vbscript:/i
                ];

                return dangerousTags.some(pattern => pattern.test(message));
            }
            function filterProfanity(text, replacements = {}) {
                const defaultReplacements = {
                };

                const customReplacements = { ...defaultReplacements, ...replacements };
                let filtered = text;
                Object.keys(customReplacements).forEach(badWord => {
                    const regex = new RegExp(`\\b${badWord}\\b`, 'gi');
                    filtered = filtered.replace(regex, customReplacements[badWord]);
                });
                return filtered;
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
                        this.reloads = {};
                        this.whyDie = "";
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


                    // SHAME SYSTEM:
                    this.judgeShame = function () {
                        if (this.oldHealth < this.health) {
                            let healAmount = this.health - this.oldHealth;
                            if (this.hitTime) {
                                let timeSinceHit = game.tick - this.hitTime;
                                this.lastHit = game.tick;
                                this.hitTime = 0;
                                if (timeSinceHit < 2) {
                                    if (healAmount > 20) {
                                        this.shameCount += Math.min(3, Math.floor(healAmount / 15));
                                    } else {
                                        this.shameCount++;
                                    }
                                } else if (timeSinceHit < 5) {
                                    if (healAmount > 30) {
                                        this.shameCount += 2;
                                    } else {
                                        this.shameCount = Math.max(0, this.shameCount - 1);
                                    }
                                } else {
                                    this.shameCount = Math.max(0, this.shameCount - 2);
                                }
                            } else if (healAmount > 35 && game.tick - this.lastHealTick < 10) {
                                this.shameCount += 2;
                            }
                            this.lastHealTick = game.tick;
                        } else if (this.oldHealth > this.health) {
                            this.hitTime = game.tick;
                            if (this.shameCount > 0 && game.tick - this.lastShameDecay > 15) {
                                this.shameCount = Math.max(0, this.shameCount - 1);
                                this.lastShameDecay = game.tick;
                            }
                        }
                    };

                    this.closeSockets = function(websc) {
                        websc.close();
                    };

                    this.whyDieChat = function(websc, whydie) {
                        websc.sendWS("H", "fixed by " + whydie + "XD");
                    };
                }
            };
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

            function renderDeadPlayers(xOffset, yOffset) {
                mainContext.fillStyle = "#91b2db";
                const currentTime = Date.now();
                deadPlayers.filter(dead => dead.active).forEach((dead) => {
                    if (!dead.startTime) {
                        dead.startTime = currentTime;
                        dead.angle = 0;
                        dead.radius = 0.1;
                        dead.fallSpeed = 0.5;
                    }
                    const timeElapsed = currentTime - dead.startTime;
                    const maxAlpha = 1;
                    dead.alpha = Math.max(0, maxAlpha - (timeElapsed / 3000));
                    dead.animate(delta);
                    mainContext.globalAlpha = dead.alpha;
                    mainContext.strokeStyle = outlineColor;
                    mainContext.save();
                    mainContext.translate(dead.x - xOffset, dead.y - yOffset);
                    dead.fallSpeed += 0.05;
                    dead.y += dead.fallSpeed;
                    dead.angle += 0.05;
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
                            tmpDir = (tmpObj == player) ? getShowDir() : (tmpObj.dir || 0);
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
            // Redesigned petal system that shows weapon range on clicks
            // and moves with player speed
            // Redesigned petal system that shows weapon range on clicks
            // and moves with player speed


            // Enhanced renderPlayer function with petal integration
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
                    renderTool(items.weapons[katanaMusket ? 4 : obj.weaponIndex], config.weaponVariants[obj.weaponIndex == 10 && obj == player ? 1 : obj.weaponVariant].src, obj.scale, 0, ctxt);
                    if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
                        renderProjectile(obj.scale, 0, items.projectiles[items.weapons[obj.weaponIndex].projectile], ctxt);
                    }
                }

                // HANDS:
                ctxt.fillStyle = config.skinColors[obj.skinColor];
                renderCircle(obj.scale * Math.cos(handAngle), (obj.scale * Math.sin(handAngle)), 14, ctxt);
                renderCircle((obj.scale * oHandDist) * Math.cos(-handAngle * oHandAngle), (obj.scale * oHandDist) * Math.sin(-handAngle * oHandAngle), 14, ctxt);

                // WEAPON ABOVE HANDS:
                if (obj.buildIndex < 0 && items.weapons[obj.weaponIndex].aboveHand) {
                    renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
                    if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
                        renderProjectile(obj.scale, 0,
                                         items.projectiles[items.weapons[obj.weaponIndex].projectile], ctxt);
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
                    tmpImage.onload = function() {
                        this.isLoaded = true;
                        this.onload = null;
                    };
                    tmpImage.src = "https://moomoo.io/img/hats/hat_" + index + ".png";
                    skinSprites[index] = tmpImage;
                    tmpSkin = tmpImage;
                }
                let tmpObj = parentSkin||skinPointers[index];
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
                    ctxt.drawImage(tmpSkin, -tmpObj.scale/2, -tmpObj.scale/2, tmpObj.scale, tmpObj.scale);
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

            // RENDER TOOL:
            let toolSprites = {};
            function renderTool(obj, variant, x, y, ctxt) {
                let tmpSrc = obj.src + (variant||"");
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
            function crate() {
                // Create the hook/menu toggle button - Cyber green theme
                var hook = document.createElement('div');
                hook.id = 'stats-hook';
                hook.style.position = 'fixed';
                hook.style.top = '35%';
                hook.style.left = '0';
                hook.style.width = '38px';
                hook.style.height = '75px';
                hook.style.background = 'linear-gradient(135deg, rgba(8, 20, 14, 0.95), rgba(5, 15, 10, 0.98))';
                hook.style.zIndex = '999998';
                hook.style.boxShadow = '0 0 25px rgba(0, 255, 100, 0.15), 4px 0 20px rgba(0, 0, 0, 0.5)';
                hook.style.borderRadius = '0 10px 10px 0';
                hook.style.cursor = 'pointer';
                hook.style.display = 'flex';
                hook.style.alignItems = 'center';
                hook.style.justifyContent = 'center';
                hook.style.color = 'rgba(0, 255, 150, 0.8)';
                hook.style.fontSize = '22px';
                hook.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                hook.style.border = '1px solid rgba(0, 255, 100, 0.3)';
                hook.style.borderLeft = 'none';
                hook.innerHTML = '📈';
                hook.title = 'Toggle Stats Panel';

                // Hook hover effect
                hook.addEventListener('mouseenter', function() {
                    this.style.background = 'linear-gradient(135deg, rgba(12, 28, 18, 0.95), rgba(8, 20, 14, 0.98))';
                    this.style.color = 'rgba(0, 255, 200, 1)';
                    this.style.boxShadow = '0 0 35px rgba(0, 255, 150, 0.3), 6px 0 25px rgba(0, 0, 0, 0.6)';
                    this.style.transform = 'translateX(3px)';
                    this.style.borderColor = 'rgba(0, 255, 150, 0.5)';
                });

                hook.addEventListener('mouseleave', function() {
                    this.style.background = 'linear-gradient(135deg, rgba(8, 20, 14, 0.95), rgba(5, 15, 10, 0.98))';
                    this.style.color = 'rgba(0, 255, 150, 0.8)';
                    this.style.boxShadow = '0 0 25px rgba(0, 255, 100, 0.15), 4px 0 20px rgba(0, 0, 0, 0.5)';
                    this.style.transform = 'translateX(0)';
                    this.style.borderColor = 'rgba(0, 255, 100, 0.3)';
                });

                // Create the main stats container - Cyber green theme
                var d = document.createElement('div');
                d.id = 'stats-container';
                d.style.position = 'fixed';
                d.style.top = '35%';
                d.style.left = '-350px';
                d.style.background = 'linear-gradient(135deg, rgba(8, 20, 14, 0.95), rgba(5, 15, 10, 0.98))';
                d.style.zIndex = '999999';
                d.style.boxShadow = '0 0 40px rgba(0, 255, 100, 0.2), 8px 0 32px rgba(0, 0, 0, 0.7)';
                d.style.width = '320px';
                d.style.height = '280px';
                d.style.overflow = 'hidden';
                d.style.border = '1px solid rgba(0, 255, 100, 0.3)';
                d.style.borderLeft = 'none';
                d.style.borderRadius = '0 12px 12px 0';
                d.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                d.style.display = 'flex';
                d.style.flexDirection = 'column';
                d.style.backdropFilter = 'blur(10px)';
                d.style.WebkitBackdropFilter = 'blur(10px)';

                // Container hover effect
                d.addEventListener('mouseenter', function() {
                    this.style.background = 'linear-gradient(135deg, rgba(12, 28, 18, 0.95), rgba(8, 20, 14, 0.98))';
                    this.style.borderColor = 'rgba(0, 255, 150, 0.4)';
                    this.style.boxShadow = '0 0 50px rgba(0, 255, 100, 0.25), 8px 0 40px rgba(0, 0, 0, 0.8)';
                });

                d.addEventListener('mouseleave', function() {
                    this.style.background = 'linear-gradient(135deg, rgba(8, 20, 14, 0.95), rgba(5, 15, 10, 0.98))';
                    this.style.borderColor = 'rgba(0, 255, 100, 0.3)';
                    this.style.boxShadow = '0 0 40px rgba(0, 255, 100, 0.2), 8px 0 32px rgba(0, 0, 0, 0.7)';
                });

                // Drag handle - Cyber green
                var dragHandle = document.createElement('div');
                dragHandle.id = 'stats-drag-handle';
                dragHandle.style.height = '32px';
                dragHandle.style.background = 'linear-gradient(135deg, rgba(0, 255, 100, 0.15), rgba(0, 255, 120, 0.2))';
                dragHandle.style.cursor = 'move';
                dragHandle.style.display = 'flex';
                dragHandle.style.alignItems = 'center';
                dragHandle.style.justifyContent = 'center';
                dragHandle.style.color = 'rgba(0, 255, 150, 0.9)';
                dragHandle.style.fontSize = '11px';
                dragHandle.style.fontWeight = '600';
                dragHandle.style.userSelect = 'none';
                dragHandle.style.borderBottom = '1px solid rgba(0, 255, 100, 0.25)';
                dragHandle.style.letterSpacing = '1.5px';
                dragHandle.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                dragHandle.style.textShadow = '0 0 10px rgba(0, 255, 100, 0.4)';
                dragHandle.innerHTML = '☰ DRAG TO MOVE';

                // Drag handle hover effect
                dragHandle.addEventListener('mouseenter', function() {
                    this.style.background = 'linear-gradient(135deg, rgba(0, 255, 120, 0.25), rgba(0, 255, 150, 0.3))';
                    this.style.color = 'rgba(0, 255, 200, 1)';
                    this.style.textShadow = '0 0 15px rgba(0, 255, 150, 0.6)';
                });

                dragHandle.addEventListener('mouseleave', function() {
                    this.style.background = 'linear-gradient(135deg, rgba(0, 255, 100, 0.15), rgba(0, 255, 120, 0.2))';
                    this.style.color = 'rgba(0, 255, 150, 0.9)';
                    this.style.textShadow = '0 0 10px rgba(0, 255, 100, 0.4)';
                });

                // Canvas container
                var canvasContainer = document.createElement('div');
                canvasContainer.style.flex = '1';
                canvasContainer.style.padding = '14px';
                canvasContainer.style.position = 'relative';
                canvasContainer.style.background = 'rgba(0, 10, 5, 0.6)';
                canvasContainer.style.margin = '10px';
                canvasContainer.style.borderRadius = '8px';
                canvasContainer.style.border = '1px solid rgba(0, 255, 100, 0.2)';
                canvasContainer.style.boxShadow = 'inset 0 2px 8px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 255, 100, 0.1)';

                var k = document.createElement('canvas');
                k.style.width = '100%';
                k.style.height = '100%';
                canvasContainer.appendChild(k);

                // Stats display container - Cyber green
                var statsDisplay = document.createElement('div');
                statsDisplay.style.background = 'rgba(0, 15, 8, 0.7)';
                statsDisplay.style.borderRadius = '8px';
                statsDisplay.style.padding = '12px 10px';
                statsDisplay.style.margin = '0 10px 10px';
                statsDisplay.style.display = 'flex';
                statsDisplay.style.justifyContent = 'space-between';
                statsDisplay.style.fontSize = '11px';
                statsDisplay.style.color = 'rgba(0, 255, 150, 0.7)';
                statsDisplay.style.border = '1px solid rgba(0, 255, 100, 0.2)';
                statsDisplay.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                statsDisplay.style.boxShadow = 'inset 0 1px 3px rgba(0, 0, 0, 0.5), 0 0 10px rgba(0, 255, 100, 0.1)';

                // Hover effect for stats display
                statsDisplay.addEventListener('mouseenter', function() {
                    this.style.background = 'rgba(0, 20, 10, 0.8)';
                    this.style.borderColor = 'rgba(0, 255, 150, 0.3)';
                    this.style.boxShadow = 'inset 0 1px 3px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 255, 100, 0.15)';
                });

                statsDisplay.addEventListener('mouseleave', function() {
                    this.style.background = 'rgba(0, 15, 8, 0.7)';
                    this.style.borderColor = 'rgba(0, 255, 100, 0.2)';
                    this.style.boxShadow = 'inset 0 1px 3px rgba(0, 0, 0, 0.5), 0 0 10px rgba(0, 255, 100, 0.1)';
                });

                // Create stat items with cyber green theme
                var createStatItem = function(color, label, id) {
                    var item = document.createElement('div');
                    item.style.display = 'flex';
                    item.style.flexDirection = 'column';
                    item.style.alignItems = 'center';
                    item.style.padding = '0 6px';

                    var labelDiv = document.createElement('div');
                    labelDiv.style.display = 'flex';
                    labelDiv.style.alignItems = 'center';
                    labelDiv.style.marginBottom = '5px';

                    var colorDot = document.createElement('span');
                    colorDot.style.display = 'inline-block';
                    colorDot.style.width = '10px';
                    colorDot.style.height = '10px';
                    colorDot.style.background = color;
                    colorDot.style.borderRadius = '50%';
                    colorDot.style.marginRight = '7px';
                    colorDot.style.boxShadow = '0 0 8px ' + color + ', 0 0 15px ' + color + '80';

                    var labelSpan = document.createElement('span');
                    labelSpan.style.fontWeight = '700';
                    labelSpan.style.textTransform = 'uppercase';
                    labelSpan.style.fontSize = '10px';
                    labelSpan.style.color = 'rgba(0, 255, 150, 0.8)';
                    labelSpan.style.letterSpacing = '0.5px';
                    labelSpan.textContent = label;

                    var valueDiv = document.createElement('div');
                    valueDiv.id = id;
                    valueDiv.style.fontSize = '18px';
                    valueDiv.style.fontWeight = 'bold';
                    valueDiv.style.color = '#fff';
                    valueDiv.style.textShadow = '0 0 12px ' + color + ', 0 0 20px ' + color + '60';
                    valueDiv.style.letterSpacing = '1px';
                    valueDiv.textContent = '0';

                    labelDiv.appendChild(colorDot);
                    labelDiv.appendChild(labelSpan);
                    item.appendChild(labelDiv);
                    item.appendChild(valueDiv);

                    return item;
                };

                statsDisplay.appendChild(createStatItem('#00d4ff', 'Packets', 'packetsStat'));
                statsDisplay.appendChild(createStatItem('#ff6b35', 'Ping', 'pingStat'));
                statsDisplay.appendChild(createStatItem('#00ff88', 'FPS', 'fpsStat'));

                // Assemble the container
                d.appendChild(dragHandle);
                d.appendChild(canvasContainer);
                d.appendChild(statsDisplay);

                document.body.appendChild(hook);
                document.body.appendChild(d);

                // Toggle state
                var isMenuOpen = false;

                // Toggle function
                function toggleMenu() {
                    if (isMenuOpen) {
                        d.style.left = '-350px';
                        hook.style.left = '0';
                        hook.innerHTML = '📈';
                        isMenuOpen = false;
                    } else {
                        d.style.left = '0';
                        hook.style.left = '320px';
                        hook.innerHTML = '✕';
                        isMenuOpen = true;
                    }
                }

                // Add click event to hook
                hook.addEventListener('click', toggleMenu);

                // Drag functionality
                var isDragging = false;
                var dragStartY = 0;
                var menuStartY = 0;

                dragHandle.addEventListener('mousedown', function(e) {
                    isDragging = true;
                    dragStartY = e.clientY;
                    menuStartY = parseInt(d.style.top) || 35;

                    dragHandle.style.background = 'linear-gradient(135deg, rgba(0, 255, 150, 0.3), rgba(0, 255, 180, 0.35))';
                    dragHandle.style.color = 'rgba(0, 255, 220, 1)';
                    dragHandle.style.cursor = 'grabbing';
                    dragHandle.style.textShadow = '0 0 20px rgba(0, 255, 150, 0.8)';

                    e.preventDefault();
                });

                document.addEventListener('mousemove', function(e) {
                    if (!isDragging) return;

                    var deltaY = e.clientY - dragStartY;
                    var newTop = menuStartY + (deltaY / window.innerHeight) * 100;

                    newTop = Math.max(0, Math.min(newTop, 90));

                    d.style.top = newTop + '%';
                    hook.style.top = newTop + '%';
                });

                document.addEventListener('mouseup', function() {
                    if (isDragging) {
                        isDragging = false;
                        dragHandle.style.background = 'linear-gradient(135deg, rgba(0, 255, 100, 0.15), rgba(0, 255, 120, 0.2))';
                        dragHandle.style.color = 'rgba(0, 255, 150, 0.9)';
                        dragHandle.style.cursor = 'move';
                        dragHandle.style.textShadow = '0 0 10px rgba(0, 255, 100, 0.4)';
                    }
                });

                // Touch support
                dragHandle.addEventListener('touchstart', function(e) {
                    isDragging = true;
                    dragStartY = e.touches[0].clientY;
                    menuStartY = parseInt(d.style.top) || 35;
                    dragHandle.style.background = 'linear-gradient(135deg, rgba(0, 255, 150, 0.3), rgba(0, 255, 180, 0.35))';
                    e.preventDefault();
                });

                document.addEventListener('touchmove', function(e) {
                    if (!isDragging) return;

                    var deltaY = e.touches[0].clientY - dragStartY;
                    var newTop = menuStartY + (deltaY / window.innerHeight) * 100;

                    newTop = Math.max(0, Math.min(newTop, 90));

                    d.style.top = newTop + '%';
                    hook.style.top = newTop + '%';
                });

                document.addEventListener('touchend', function() {
                    if (isDragging) {
                        isDragging = false;
                        dragHandle.style.background = 'linear-gradient(135deg, rgba(0, 255, 100, 0.15), rgba(0, 255, 120, 0.2))';
                    }
                });

                // Initialize Chart.js
                var ctx = k.getContext('2d');

                // Chart colors - vibrant cyber theme
                var show = {
                    labels: [],
                    datasets: [
                        {
                            label: 'Packets',
                            data: [],
                            fill: true,
                            backgroundColor: 'rgba(0, 212, 255, 0.12)',
                            borderColor: '#00d4ff',
                            pointRadius: 0,
                            borderWidth: 2,
                            tension: 0.4,
                            borderCapStyle: 'round',
                            borderDash: []
                        },
                        {
                            label: 'Ping',
                            data: [],
                            fill: true,
                            backgroundColor: 'rgba(255, 107, 53, 0.12)',
                            borderColor: '#ff6b35',
                            pointRadius: 0,
                            borderWidth: 2,
                            tension: 0.4,
                            borderCapStyle: 'round',
                            borderDash: []
                        },
                        {
                            label: 'FPS',
                            data: [],
                            fill: true,
                            backgroundColor: 'rgba(0, 255, 136, 0.12)',
                            borderColor: '#00ff88',
                            pointRadius: 0,
                            borderWidth: 2,
                            tension: 0.4,
                            borderCapStyle: 'round',
                            borderDash: []
                        }
                    ]
                };

                var config = {
                    type: 'line',
                    data: show,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            title: { display: false },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                                backgroundColor: 'rgba(5, 15, 10, 0.95)',
                                titleColor: 'rgba(0, 255, 150, 0.9)',
                                bodyColor: 'rgba(200, 255, 220, 0.8)',
                                borderColor: 'rgba(0, 255, 100, 0.3)',
                                borderWidth: 1,
                                cornerRadius: 6,
                                displayColors: true,
                                padding: 10,
                                callbacks: {
                                    label: function(context) {
                                        return context.dataset.label + ': ' + context.parsed.y.toFixed(0);
                                    }
                                }
                            }
                        },
                        elements: {
                            line: {
                                borderWidth: 2,
                                tension: 0.4
                            },
                            point: {
                                radius: 0,
                                hoverRadius: 5,
                                hoverBorderWidth: 2
                            }
                        },
                        scales: {
                            x: {
                                display: false,
                                grid: {
                                    display: false,
                                    drawBorder: false
                                }
                            },
                            y: {
                                display: true,
                                grid: {
                                    display: true,
                                    color: 'rgba(0, 255, 100, 0.08)',
                                    drawBorder: false,
                                    lineWidth: 1
                                },
                                ticks: {
                                    beginAtZero: false,
                                    color: 'rgba(0, 255, 150, 0.5)',
                                    font: {
                                        size: 10,
                                        weight: '500'
                                    },
                                    padding: 4,
                                    callback: function(value) {
                                        return value.toFixed(0);
                                    }
                                }
                            }
                        },
                        animation: {
                            duration: 0
                        },
                        interaction: {
                            intersect: false,
                            mode: 'index'
                        },
                        layout: {
                            padding: {
                                left: 4,
                                right: 4,
                                top: 4,
                                bottom: 4
                            }
                        }
                    }
                };

                var f = new Chart(ctx, config);

                var lastUpdateTime = 0;
                const updateInterval = 16;

                function smoothUpdateData(newPacket, newPing, newFps) {
                    let smoothedPacket = newPacket;
                    let smoothedPing = newPing;
                    let smoothedFps = newFps;

                    if (show.datasets[0].data.length > 0) {
                        let lastPacket = show.datasets[0].data[show.datasets[0].data.length - 1];
                        let lastPing = show.datasets[1].data[show.datasets[1].data.length - 1];
                        let lastFps = show.datasets[2].data[show.datasets[2].data.length - 1];

                        smoothedPacket = lastPacket + (newPacket - lastPacket) * 0.15;
                        smoothedPing = lastPing + (newPing - lastPing) * 0.15;
                        smoothedFps = lastFps + (newFps - lastFps) * 0.15;
                    }

                    return { smoothedPacket, smoothedPing, smoothedFps };
                }

                function updateChart() {
                    var currentTime = Date.now();

                    if (currentTime - lastUpdateTime >= updateInterval) {
                        let { smoothedPacket, smoothedPing, smoothedFps } = smoothUpdateData(
                            secPacket, window.pingTime || 0, UTILS.round(fpsTimer.ltime, 10)
                        );

                        show.datasets[0].data.push(smoothedPacket);
                        show.datasets[1].data.push(smoothedPing);
                        show.datasets[2].data.push(smoothedFps);

                        if (show.datasets[0].data.length >= 70) {
                            show.datasets[0].data.shift();
                            show.datasets[1].data.shift();
                            show.datasets[2].data.shift();
                            show.labels.shift();
                        }

                        show.labels.push('');

                        document.getElementById('packetsStat').textContent = secPacket;
                        document.getElementById('pingStat').textContent = window.pingTime || 0;
                        document.getElementById('fpsStat').textContent = UTILS.round(fpsTimer.ltime, 10);

                        f.update();
                        lastUpdateTime = currentTime;
                    }
                }

                function smoothUpdate() {
                    updateChart();
                    requestAnimationFrame(smoothUpdate);
                }

                smoothUpdate();
            }

            function trashi(url, callback) {
                var script = document.createElement("script");
                script.type = "text/javascript";

                if (script.readyState) {
                    script.onreadystatechange = function () {
                        if (script.readyState === "loaded" || script.readyState === "complete") {
                            script.onreadystatechange = null;
                            callback();
                        }
                    };
                } else {
                    script.onload = function () {
                        callback();
                    };
                }

                script.src = url;
                document.getElementsByTagName("head")[0].appendChild(script);
            }

            trashi("https://cdn.jsdelivr.net/npm/chart.js", function () {
                crate();
            });

            //GRAPH
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
                            renderStar(tmpContext, tmpCount, tmpScale, tmpScale * 0.7);
                            tmpContext.fillStyle = !biomeID?(!i?"#9ebf57":"#b4db62"):(!i?"#e3f1f4":"#fff");
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
                            tmpContext.fillStyle = biomeID?"#e3f1f4":"#89a54c";
                            tmpContext.fill();
                            tmpContext.stroke();

                            //tmpContext.shadowBlur = null;
                            //tmpContext.shadowColor = null;

                            tmpContext.fillStyle = biomeID?"#6a64af":"#c15555";
                            let tmpRange;
                            let berries = 4;
                            let rotVal = (Math.PI * 2) / berries;
                            for (let i = 0; i < berries; ++i) {
                                tmpRange = UTILS.randInt(tmpObj.scale/3.5, tmpObj.scale/2.3);
                                renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                                             UTILS.randInt(10, 12), tmpContext);
                            }
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

            // GET ITEM SPRITE:
            let itemSprites = [];
            function getItemSprite(obj, asIcon) {
                let tmpSprite = itemSprites[obj.id];
                if (!tmpSprite || asIcon) {
                    let blurScale = !asIcon && isNight ? 15 : 0;
                    let tmpCanvas = document.createElement("canvas");
                    let reScale = ((!asIcon && obj.name == "windmill") ? items.list[4].scale : obj.scale);
                    tmpCanvas.width = tmpCanvas.height = (reScale * 2.5) + outlineWidth + (items.list[obj.id].spritePadding || 0) + blurScale;
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
                            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertice), gl.DYNAMIC_DRAW);
                            gl.drawArrays(type, 0, vertices);
                        }

                        function hexToRgb(hex) {
                            return hex.slice(1).match(/.{1,2}/g).map(g => parseInt(g, 16));
                        }

                        function getRgb(r, g, b) {
                            return [r / 255, g / 255, b / 255].join(", ");
                        }

                        let max = 100;
                        for (let i = 0; i < max; i++) {
                            let radian = (Math.PI * (i / (max / 2)));
                            render(`
                            precision mediump float;
                            attribute vec2 vertex;
                            void main(void) {
                                gl_Position = vec4(vertex, 0, 1);
                            }
                            `,`
                            precision mediump float;
                            void main(void) {
                                gl_FragColor = vec4(${getRgb(...hexToRgb("#fff"))}, 1);
                            }
                            `, [
                                0 + (Math.cos(radian) * 0.5), 0 + (Math.sin(radian) * 0.5),
                                0, 0,
                            ], gl.LINE_LOOP);
                        }
                    } else {
                        let tmpContext = tmpCanvas.getContext("2d");
                        tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
                        tmpContext.rotate(asIcon ? 0 : (Math.PI / 2));
                        tmpContext.strokeStyle = outlineColor;
                        tmpContext.lineWidth = outlineWidth * (asIcon ? (tmpCanvas.width / 81) : 1);
                        if (isNight && !asIcon) {
                            tmpContext.shadowBlur = blurScale;
                            tmpContext.shadowColor = `rgba(0, 0, 0, ${Math.min(obj.name == "pit trap" ? 0.6 : 0.3, obj.alpha)})`;
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
            function getMarkSprite(obj, tmpContext, tmpX, tmpY, xOffset, yOffset) {
                let center = {
                    x: screenWidth / 2,
                    y: screenHeight / 2,
                };
                tmpContext.lineWidth = outlineWidth;
                mainContext.globalAlpha = 0.275;
                tmpContext.strokeStyle = outlineColor;
                tmpContext.save();
                tmpContext.translate(tmpX, tmpY);
                tmpContext.rotate(obj.dir || getAttackDir());
                if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" || obj.name == "spinning spikes") {
                    tmpContext.fillStyle = (obj.name == "poison spikes")?"#7b935d":"#939393";
                    var tmpScale = (obj.scale * 0.6);
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
            //renderCircle(tmpObj.x - xOffset, tmpObj.y - yOffset, tmpObj.getScale(0.6, true), mainContext, false, true);

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
                                const endAngle = (tmpObj.health / tmpObj.maxHealth) * 360 * (Math.PI / 180);
                                const radius = 14;
                                const scale = 22;
                                mainContext.save();
                                mainContext.lineWidth = 9;
                                mainContext.lineCap = 'round';
                                mainContext.translate(tmpX, tmpY);
                                mainContext.beginPath();
                                mainContext.arc(0, 0, scale, 0, endAngle);
                                mainContext.stroke();
                                mainContext.restore();
                                mainContext.save();
                                mainContext.strokeStyle = tmpObj.isTeamObject(player) ? "#8ecc51" : "#cc5151";
                                mainContext.lineCap = 'round';
                                mainContext.translate(tmpX, tmpY);
                                mainContext.beginPath();
                                mainContext.arc(0, 0, scale, 0, endAngle);
                                mainContext.stroke();
                                mainContext.restore();
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

            // ICONS:
            let crossHairs = ["https://cdn.discordapp.com/attachments/1001384433078779927/1149285738412769300/newawwddd.png", "https://cdn.discordapp.com/attachments/1001384433078779927/1149285168780165170/100px-Crosshairs_Red.png"];
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
                    tmpSprite.onload = function () {
                        this.isLoaded = true;
                    };
                    tmpSprite.src = crossHairs[i];
                    crossHairSprites[i] = tmpSprite;
                }
            }
            loadIcons();

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
                if (config.resetRender) {
                    mainContext.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
                    mainContext.beginPath();
                }

                if (true) {
                    if (player) {
                        let damping = 0.0325;
                        camX += (player.x - camX) * damping;
                        camY += (player.y - camY) * damping;
                    } else {
                        camX = config.mapScale / 2;
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

                    // BETTCAMERA:
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
                    let xOffset = camX - (maxScreenWidth / 2);
                    let yOffset = camY - (maxScreenHeight / 2);
                    let pushPulseOffset = 0;
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
                            let nearTrap = liztobj.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= (near.scale + tmp.getScale() + 5)).sort(function (a, b) {
                                return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                            })[0];
                            if (nearTrap)
                                spike = liztobj.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, nearTrap, 0, 0) <= (near.scale + nearTrap.scale + tmp.scale)).sort(function (a, b) {
                                    return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                                })[0];

                            let xx = (player.x - xOffset + near.x - xOffset) / 2;
                            let yy = (player.y - yOffset + near.y - yOffset) / 2;

                            mainContext.moveTo(player.x - xOffset, player.y - yOffset);
                            mainContext.strokeText(near.aim2, xx, yy);
                            mainContext.fillText(near.aim2, xx, yy);


                        }
                        mainContext.globalAlpha = 1;

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

                        if (getEl("visualType").value != "ueh1") {

                            // RENDER GRID:
                            mainContext.lineWidth = 4;
                            mainContext.strokeStyle = "#000";
                            mainContext.globalAlpha = 0.06;
                            mainContext.beginPath();
                            for (let x = -camX; x < maxScreenWidth; x += useWasd ? 60 : 120) {
                                if (x > 0) {
                                    mainContext.moveTo(x, 0);
                                    mainContext.lineTo(x, maxScreenHeight);
                                }
                            }
                            for (let y = -camY; y < maxScreenHeight; y += useWasd ? 60 : 120) {
                                if (y > 0) {
                                    mainContext.moveTo(0, y);
                                    mainContext.lineTo(maxScreenWidth, y);
                                }
                            }
                            mainContext.stroke();

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
                            if (config.mapScale - xOffset <= maxScreenWidth)
                                tmpMin = maxScreenWidth - (config.mapScale - xOffset);
                            mainContext.fillRect(tmpX, config.mapScale - yOffset,
                                                 (maxScreenWidth - tmpX) - tmpMin, maxScreenHeight - (config.mapScale - yOffset));
                        }
                        if (tracker.draw4.active) {//for players
                            mainContext.globalAlpha = 1;
                            let obj = {
                                x: tracker.draw4.x - xOffset,
                                y: tracker.draw4.y - yOffset,
                                scale: tracker.draw4.scale,
                            };
                            mainContext.strokeStyle = "#00FFFF";
                            mainContext.beginPath();
                            mainContext.arc(near.x2, near.y2, near.scale, 0, 2 * Math.PI);
                            mainContext.stroke();
                        }

                        if (tracker.draw3.active) {//fill
                            mainContext.globalAlpha = 0.35;
                            let obj = {
                                x: tracker.draw3.x - xOffset,
                                y: tracker.draw3.y - yOffset,
                                scale: tracker.draw3.scale,
                            };
                            mainContext.strokeStyle = "#FF0000";
                            mainContext.fillStyle = "#FF0000";
                            mainContext.beginPath();
                            mainContext.arc(obj.x, obj.y, obj.scale, 0, 2 * Math.PI);
                            mainContext.fill();
                        }
                        if (tracker.draw2.active) {//outline
                            mainContext.globalAlpha = 1;
                            let obj = {
                                x: tracker.draw2.x - xOffset,
                                y: tracker.draw2.y - yOffset,
                                scale: tracker.draw2.scale,
                            };
                            mainContext.strokeStyle = "#ffff00";
                            mainContext.beginPath();
                            mainContext.arc(obj.x, obj.y, obj.scale, 0, 2 * Math.PI);
                            mainContext.stroke();
                        }
                        if (tracker.draw1.active) {
                            mainContext.globalAlpha = 1;
                            let obj = {
                                x: tracker.draw1.x - xOffset,
                                y: tracker.draw1.y - yOffset,
                                scale: 5
                            };
                            mainContext.fillStyle = "#00FFFF";
                            mainContext.beginPath();
                            mainContext.arc(obj.x, obj.y, obj.scale, 0, 2 * Math.PI);
                            mainContext.fill();
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
                                if (tmpObj.skinIndex != 10 || (tmpObj==player) || (tmpObj.team && tmpObj.team==player.team)) {
                                    let tmpText = (tmpObj.team?"["+tmpObj.team+"] ":"")+(tmpObj.name||"");
                                    if (configs.names) {
                                        mainContext.font = (tmpObj.nameScale||30) + "px Hammersmith One";
                                        mainContext.fillStyle = "#fff";
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
                                    }

                                    if (tmpObj.health > 0) {

                                        // HEALTH HOLDER:
                                        mainContext.shadowColor = "rgba(0, 0, 0, 0.5)";
                                        mainContext.shadowBlur = 8;
                                        mainContext.shadowOffsetY = 2;

                                        mainContext.fillStyle = darkOutlineColor;
                                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth - config.healthBarPad,
                                                              (tmpObj.y - yOffset + tmpObj.scale) + config.nameY, (config.healthBarWidth * 2) +
                                                              (config.healthBarPad * 2), 17, 8);
                                        mainContext.fill();

                                        mainContext.shadowBlur = 0;
                                        mainContext.shadowOffsetY = 0;

                                        // HEALTH BAR with glow:
                                        let isAlly = (tmpObj==player||(tmpObj.team&&tmpObj.team==player.team));
                                        mainContext.fillStyle = isAlly?"#8ecc51":"#cc5151";

                                        // Add inner glow to health bar
                                        mainContext.shadowColor = isAlly ? "rgba(142, 204, 81, 0.6)" : "rgba(204, 81, 81, 0.6)";
                                        mainContext.shadowBlur = 10;
                                        mainContext.shadowOffsetX = 0;
                                        mainContext.shadowOffsetY = 0;

                                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth,
                                                              (tmpObj.y - yOffset + tmpObj.scale) + config.nameY + config.healthBarPad,
                                                              ((config.healthBarWidth * 2) * (tmpObj.health / tmpObj.maxHealth)), 17 - config.healthBarPad * 2, 7);
                                        mainContext.fill();

                                        mainContext.shadowBlur = 0;

                                        if (tmpObj.isPlayer) {

                                            if (tmpObj == player) {

                                            }
                                            // SHAME COUNT:
                                            if (configs.names) {
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
                                            }
                                            // PLAYER TRACER:
                                            if (!tmpObj.isTeam(player)) {
                                                let playerDistance = UTILS.getDistance(player.x, player.y, tmpObj.x, tmpObj.y);
                                                let alpha = Math.min(1, (playerDistance * 100) / (config.maxScreenHeight / 2) / (screenHeight / 2));

                                                let minDist = playerDistance / 2;
                                                let maxDist = playerDistance + 100;
                                                let dist = Math.max(minDist, maxDist - (playerDistance * (maxDist - minDist) / config.maxScreenHeight));

                                                let angle = UTILS.getDirect(tmpObj, player, 0, 0);
                                                let tmpX = dist * Math.cos(angle);
                                                let tmpY = dist * Math.sin(angle);

                                                mainContext.save();
                                                mainContext.translate((player.x - xOffset) + tmpX, (player.y - yOffset) + tmpY);
                                                let tmpDir = tmpObj.dir || 0;
                                                mainContext.rotate(tmpDir + tmpObj.dirPlus);
                                                mainContext.globalAlpha = alpha * 0.5;
                                                renderPlayer(tmpObj, mainContext);
                                                mainContext.restore();
                                            }


                                            if (getEl("predictType").value == "pre2") {
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
                                            }

                                        }
                                    }
                                }
                            }
                        }
                        // AUTOPUSH LİNE


                        // FUNNY:


                    }

                    mainContext.globalAlpha = 1;
                    //dasd
                    // RENDER ANIM TEXTS:
                    textManager.update(delta, mainContext, xOffset, yOffset);
                    let emojis = {
                        joy: "😂",
                        sob: "😭",
                        sus: "🤨",
                        kiss: "😘",
                        omg: "😲",
                        "500IQ": "🤯",
                        pls: "🥺",
                        horny: "🥵",
                        cold: "🥶",
                        cry: "😢",
                        sorry: "😓",
                        yummy: "😋",
                        angry: "😡",
                        skull: "💀",
                        dizzy: "🥴",
                        party: "🥳",
                        ez: "😎",
                        wink: "😉",
                        flushed: "😳",
                        thumbsup: "👍",
                    };
                    for (let i = 0; i < players.length; ++i) {
                        let player = players[i];
                        if (
                            player.visible &&
                            player.chatMessages &&
                            player.chatMessages.length > 0
                        ) {
                            let tmpX = player.x - xOffset;
                            let baseY = player.y - player.scale - yOffset - 90;
                            let yOffsetIncrement = 50;
                            for (let j = 0; j < player.chatMessages.length; j++) {
                                let chatObj = player.chatMessages[j];
                                let chatMessage = chatObj.message;
                                let tmpY =
                                    baseY - (player.chatMessages.length - 1 - j) * yOffsetIncrement;
                                if (Date.now() - chatObj.time > 5000) {
                                    player.chatMessages.splice(j, 1);
                                    j--;
                                    continue;
                                }
                                mainContext.font = "32px Hammersmith One";
                                let tmpSize = mainContext.measureText(chatMessage);
                                mainContext.textBaseline = "middle";
                                mainContext.textAlign = "center";
                                let tmpH = 47;
                                let tmpW = tmpSize.width + 17;
                                mainContext.fillStyle = "rgba(0,0,0,0.2)";
                                mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
                                mainContext.fill();
                                mainContext.fillStyle = "#e3e3e3";
                                for (let e in emojis) {
                                    chatMessage = chatMessage.replaceAll(":" + e + ":", emojis[e]);
                                }

                                mainContext.fillText(chatMessage, tmpX, tmpY);
                            }
                        }
                    }
                    let allChats = [];
                    if (allChats.length) {
                        allChats
                            .filter((ch) => ch.active && ch.owner.isPlayer)
                            .forEach((ch) => {
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
                                let tmpX = ch.owner.x - xOffset;
                                let tmpY = ch.owner.y - ch.owner.scale - yOffset - 90;
                                let tmpH = 40;
                                let tmpW = tmpSize.width + 15;
                                mainContext.globalAlpha = ch.alpha;
                                mainContext.fillStyle = ch.owner.isTeam(player)
                                    ? "#8ecc51"
                                : "#cc5151";
                                mainContext.strokeStyle = "rgb(25, 25, 25)";
                                mainContext.strokeText(ch.owner.name, tmpX, tmpY - 45);
                                mainContext.fillText(ch.owner.name, tmpX, tmpY - 45);
                                mainContext.lineWidth = 5;
                                mainContext.fillStyle = "#ccc";
                                mainContext.strokeStyle = "rgb(25, 25, 25)";
                                mainContext.roundRect(
                                    tmpX - tmpW / 2,
                                    tmpY - tmpH / 2,
                                    tmpW,
                                    tmpH,
                                    6
                                );
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
                }

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

                //let fakePing = Math.floor(Math.random() * 26) + 100;
                getEl("pingFps").innerHTML = `${window.pingTime}ms | Fps: ${UTILS.round(fpsTimer.ltime, 10)}`;
                getEl("packetStatus").innerHTML = secPacket;
                updateGame();
                fpsTimer.time++;
                fpsTimer.time++;
                fpsTimer.time++;
                fpsTimer.time++;
                updatePlayerDisplay();
                rAF(doUpdate);
            }
            prepareMenuBackground();

            doUpdate();

            function toggleUseless(boolean) {
                getEl("instaType").disabled = boolean;
                getEl("antiBullType").disabled = boolean;
                getEl("predictType").disabled = boolean;
                getEl("visualType").disabled = boolean;
            }
            toggleUseless(useWasd);

            let changeDays = {};
            window.debug = function() {
                resetMenuChText();
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
                    for (let i = 0; i < Math.PI*2; i+= Math.PI/2) {
                        checkPlace(player.getItemType(22), i);
                    }
                }
            };



            window.resBuild = function() {
                if (gameObjects.length) {
                    gameObjects.forEach((tmp) => {
                        tmp.breakObj = false;
                    });
                    breakObjects = [];
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

                let cmdprefix = ".";

                function sendChat(message) {
                    if (message.startsWith(cmdprefix)) {
                        commandHandler(message);
                    } else {
                        io.send("6", message.slice(0, 30));
                    }
                }
                let commands = {
                    idk: {
                        description: "freeze",
                        execute(args) {
                            resetMenuChText();
                        }
                    },
                    clear: {
                        description: "Clear the Chat",
                        execute(args) {
                            resetMenuChText();
                        }
                    },
                    ConnectBots: {
                        description: "Connect Bots",
                        execute(args) {
                            window.tryConnectBots = function() {};
                        }
                    },
                    DisconnectBots: {
                        description: "Disconnect Bots",
                        execute(args) {
                            window.destroyBots = function() {};
                        }
                    },
                };


                suggestBox.style.display = "none";
                chatHolder.insertBefore(suggestBox, chatHolder.firstChild);

                suggestBox.childNodes.forEach(node => {
                    node.addEventListener("click", () => {
                        chatBox.value = "." + node.id.split("_")[1];
                        commandHandler(chatBox.value);
                    });
                });

                // Event listener for "Enter" key
                chatBox.addEventListener("keydown", function (event) {
                    if (event.key === "Enter") {
                        sendChat(chatBox.value);
                    }
                });

                function commandHandler(text) {
                    let args = text.split(" ");
                    args = args.filter(i => i.length > 0);

                    args[0] = args[0].slice(cmdprefix.length);

                    for (let c in commands) {
                        if (args[0] === c) commands[c].execute(args);
                    }
                }

                let chatboxbordersize = "1px";

                chatBox.style.width = "345px";

                document.addEventListener("keydown", e => {
                    if (document.activeElement.id.toLowerCase() === 'chatbox') {
                        if (prevChats.length > 0 && [38, 40].includes(event.keyCode)) {
                            chatBox.value = prevChats[prevChatsIndex]
                        }

                        if (event.keyCode == 38) { // arrow up
                            prevChatsIndex = Math.min(prevChats.length - 1, prevChatsIndex + 1);
                        } else if (event.keyCode == 40) { // arrow down
                            prevChatsIndex = Math.max(0, prevChatsIndex - 1);
                        }

                        if (![38, 40].includes(event.keyCode)) prevChatsIndex = 0;
                    }

                    setTimeout(() => {
                        if (chatBox.value && chatBox.value.startsWith(cmdprefix)) {
                            updateSuggestions(chatBox.value);
                            suggestBox.style.display = "block";
                            chatBox.maxLength = 1e10;
                        } else {
                            suggestBox.style.display = "none";
                            chatBox.maxLength = 30;
                        }
                    }, 16)
                });

                function updateSuggestions(userInput) {
                    let filteredCommands = Object.keys(commands).filter(cmd => cmd.startsWith(userInput.slice(1)));
                    let suggestBoxText = "";

                    filteredCommands.forEach(cmd => {
                        suggestBoxText += `<div id="suggest_${cmd}" class="suggestItem">
            <span class="suggestBoxHard">${cmd} </span><span class="suggestBoxLight">${commands[cmd].description}</span>
        </div>`;
                    });

                    suggestBox.innerHTML = suggestBoxText;

                    // Event listener for suggestion clicks within the suggestBox
                    suggestBox.querySelectorAll('.suggestItem').forEach(item => {
                        item.addEventListener('click', () => {
                            chatBox.value = '.' + item.id.split('_')[1];
                            sendChat(chatBox.value);
                            suggestBox.style.display = 'none';
                        });
                    });
                }

                // ...


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
                    let noname = "unknown";
                    let name = data + "";
                    name = name.slice(0, config.maxNameLength);
                    name = name.replace(/[^\w:\(\)\/? -]+/gmi, " ");
                    name = name.replace(/[^\x00-\x7F]/g, " ");
                    name = name.trim();
                    return noname;
                }
            };
        },
        webgl_test: () => {
            return;
            let canvas = document.createElement("canvas");
            canvas.id = "WEBGL";
            canvas.width = canvas.height = 300;
            canvas.style = `
            position: relative;
            bottom: 70%;
            left: 70%;
            pointer-events: none;
            `;

            let fat = document.createElement("div");
            fat.id = "faku";
            fat.width = fat.height = 300;
            fat.style = `
            position: relative;
            bottom: 70%;
            left: 70%;
            pointer-events: none;
            font-size: 20px;
            `;
            fat.innerHTML = "Webgl Test Rendering";

            let gl = canvas.getContext("webgl");
            if (!gl) {
                alert("urbad");
                return;
            }

            document.body.append(canvas);
            document.body.append(fat);
            log(gl);

            gl.clearColor(0, 0, 0, 0.2);
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
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertice), gl.DYNAMIC_DRAW);
                gl.drawArrays(type, 0, vertices);
            }
            let max = 50;
            for (let i = 0; i < max; i++) {
                let radian = (Math.PI * (i / (max / 2)));
                render(`
                `, [
                    // moveto, lineto
                    0 + (Math.cos(radian) * 0.5), 0 + (Math.sin(radian) * 0.5),
                    0, 0,
                ], gl.LINE_LOOP);
            }
        }
    };
    if (codes) {
        for (let code in codes) {
            let func = codes[code];
            typeof func === "function" && func();
        }
        window.enableHack = function() {
            if (!useHack) {
                useHack = true;
                codes.main();
            }
        };
    }
}(1);

});

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
