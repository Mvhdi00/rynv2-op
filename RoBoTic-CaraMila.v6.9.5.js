// ==UserScript==
// @name        RoBoTic CaraMila
// @match       *://*.moomoo.io/*
// @grant       none
// @run-at      document-start
// @version     v6.9.5
// @author      Remaked by Opskills
// @description Mod With Try Out Bundle Testing real
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

function __carBoot() {


/*
Welcome all the skidders
Just some suggestions to what u can improve on
Make a projectile detection system. I was thinking of creating rectangles of how far each projectile can travel, and do some velocity calculations to try to get out of the rectangles. This idea may be good, may be bad just some random idea I have
Make some kind of simulator for hits to break with the autobreaker. Rn it uses hammer + tank, or primary without tank when fast breaking. But I think primary + tank should be considered as well. And have some scenarios where u attempt to break slower if u can get spike ticked (ur in trap, enemy push u to spike, and sync their attack with ur tank break to tick). In these scenarios u can either try to wait one tick (stop all breaks and hat hat switching and wear soldier) or break with soldier. Both has pros and cons obviously. I think if its possible to survive (like without soldier, u can break the spike within 2 no soldier hits), then do soldier break. If not try to wait one tick and break. Ofc u can also make prediction system to guess if they will sync hit with ur tank and then do accordingly.
Make a new autoplacing system. Rn its still using old ueh stuff. But u can finish up my spike kb simulator and use my op angle calculator to make better placers. Angle calculator gives u the exact angles u can place in. Since placing is done before movement server side, x2 y2 gives accurate placement coordinates. (or the most accurate cuz of the rounding stuff)
new idea for anti retrap: do function selectToBuild with a trap. So ur gonna be holding a trap, then sendAtck in like 50 angles. This ensures that a lot of angles are checked while sending very little packets. And the pain point of anti retrap is to place something somewhere after breaking out of trap. So even if only one trap placed, its still prevents u from being retrapped.
I feel like preplacer should be autoplacer just with one building ignored and packet is sent delayed so that it gets to the server right after the next server side tick update. Replacer should be the same thing unless for certain scenarios like anti retrap. So i feel like its just putting one logic into 3 things. But I may be wrong ofc with no testing and stuff.
Movement simulator from my testing is pretty accurate. At least for immediate next tick predictions based on movement packet sent. It can be used for pathfinding, more accurate safewalk, more accurate preplacer, more accurate healing.
Can add animal logic on the heal too so u dont die to animals cuz it doesnt want to shame at all costs and right now it doesnt use naimals when calculating damage threat.
Good luck and enjoy coding
*/



const GONE_IDS = [
    "adCard", "ad-container", "wideAdCard", "promoImg", "promoImgHolder",
    "linksContainer1", "linksContainer2", "moomooio_728x90_home",
    "moomooio_300x250_home", "moomooio_160x600_home", "pre-content-container",
    "adsWrapper", "adBlockDetect", "ot-sdk-btn-floating", "ot-floating-button",
    "downloadButtonContainer", "mobileDownloadButtonContainer", "chromeIcon"
];
const goneStubs = {};
function getEl(id) {
    let el = document.getElementById(id);
    if (el) return el;
    if (GONE_IDS.indexOf(id) === -1) return el;
    if (!goneStubs[id]) {
        let attic = document.getElementById("caramila-attic");
        if (!attic) {
            attic = document.createElement("div");
            attic.id = "caramila-attic";
            attic.style.display = "none";
            (document.body || document.documentElement).appendChild(attic);
        }
        const stub = document.createElement("div");
        stub.id = id;
        stub.style.display = "none";
        attic.appendChild(stub);
        goneStubs[id] = stub;
    }
    return goneStubs[id];
}

/*
* Credits:
*
* UEHEHEH: A huge thanks for their  tech. since It's been incredibly helpful! - oe (wait since when did i say that)
*
* Visuals and Combats Mechanics:
*   - Yurio
*   - Rim
*   - Oe
*   - Brt3726
*
* Testers and Bug Reports:
*   - Laplace/Gowog
*   - Wat
*   - Savior
*   - Zen
*/


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

const blob = new Blob([delayWorker], { type: 'application/javascript' });
const worker1 = new Worker(URL.createObjectURL(blob));

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
    maxPlayersHard: this.maxPlayers + 10,
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
    skinColors: ["#bf8f54", "#cbb091", "#896c4b",
        "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3",
        "#8bc373"],

    // ANIMALS:
    animalCount: 7,
    aiTurnRandom: 0.06,
    cowNames: ["Sid", "Steph", "Bmoe", "Romn", "Jononthecool", "Fiona", "Vince", "Nathan", "Nick", "Flappy", "Ronald", "Otis", "Pepe", "Mc Donald", "Theo", "Fabz", "Oliver", "Jeff", "Jimmy", "Helena", "Reaper",
        "Ben", "Alan", "Naomi", "XYZ", "Clever", "Jeremy", "Mike", "Destined", "Stallion", "Allison", "Meaty", "Sophia", "Vaja", "Joey", "Pendy", "Murdoch", "Theo", "Jared", "July", "Sonia", "Mel", "Dexter", "Quinn", "Milky"],

    // WEAPONS:
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
        for (let i = weaponVariants.length - 1; i >= 0; --i) {
            if (tmpXP >= weaponVariants[i].xp) {
                return weaponVariants[i];
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
        settingsButtonTitle: getEl("settingsButton").getElementsByTagName('span')[0],
    },
    resources: {
        food: getEl("foodDisplay"),
        wood: getEl("woodDisplay"),
        stone: getEl("stoneDisplay"),
        score: getEl("scoreDisplay"),
        kill: getEl("killCounter"),
    },
    global: {// i made this since im to lazy to make catagorize for them
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
        altcha: getEl("altcha")
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
let playMusic = UIS.global.playMusic;
let upgradeCounter = UIS.global.upgradeCounter;
let chatBox = UIS.global.chatBox;
let altcha = UIS.global.altcha;

// BUTTON:
let storeButton = UIS.buttons.store;
let allianceButton = UIS.buttons.alliance;
let chatButton = UIS.buttons.chat;
let enterGameButton = UIS.buttons.enterGame;
let altchaButton = UIS.buttons.altchaCheckBox
let partyButton = UIS.buttons.partyButton;
let joinB = UIS.buttons.joinB;
let settingsButton = UIS.buttons.settingsButton;
let settingsButtonTitle = UIS.buttons.settingsButtonTitle;

chatButton.remove();

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
        function hover(element) {
            element.style.opacity = '0';
            element.style.transition = 'opacity 0.6s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
            element.style.transform = 'scale(1)';

            element.addEventListener('mouseenter', () => {
                element.style.opacity = '1';
                element.style.transform = 'scale(1.03)';
            });

            element.addEventListener('mouseleave', () => {
                element.style.transform = 'scale(1)';
            });
        }

        const coolFont = document.createElement('link');
        coolFont.href = "https://fonts.googleapis.com/css2?family=Lilita+One&family=Poppins:wght@400;600;700&display=swap";
        coolFont.rel = "stylesheet";
        document.head.appendChild(coolFont);

        if (altcha) altcha.style.display = 'none';

        let annoyingAltchaStuff = setInterval(() => {
            if (!altcha || !altchaButton) return clearInterval(annoyingAltchaStuff);
            altchaButton.click();
            let verifyStateHTML = altcha.querySelector(".altcha-label span");
            if (verifyStateHTML) {
                let brokenAltcha = verifyStateHTML.textContent.trim() === "Verified" && enterGameButton.classList.contains("disabled");
                if (brokenAltcha) {
                    location.reload();
                }
                if (inGame) {
                    clearInterval(annoyingAltchaStuff);
                }
            }
        }, 1000);

        guideCard.remove();

        mainMenu.style.cssText = `
            background: transparent;
            backdrop-filter: none;
            border: none;
            box-shadow: none;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 30px;
        `;

        let nameContainer = document.createElement('div');
        nameContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 20px;
        `;
        gameName.parentElement.insertBefore(nameContainer, gameName);
        nameContainer.appendChild(gameName);

        gameName.innerHTML = "MooMoo";
        gameName.style.cssText = `
            opacity: 0;
            font-size: 140px;
            font-family: 'Lilita One', sans-serif;
            background: linear-gradient(135deg, #ffffff 0%, #a8daff 50%, #ffffff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            filter: drop-shadow(0 4px 20px rgba(168, 218, 255, 0.5)) drop-shadow(0 0 40px rgba(255, 255, 255, 0.3));
            transition: opacity 0.8s ease, transform 0.5s ease;
            letter-spacing: -5px;
            margin: 0;
            padding: 0;
        `;

        let tagline = document.createElement('div');
        tagline.innerHTML = "🐮 Farm, Dominate & Conquer";
        tagline.style.cssText = `
            font-family: 'Poppins', sans-serif;
            font-size: 18px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.7);
            margin-top: -10px;
            letter-spacing: 2px;
            opacity: 0;
            transition: opacity 0.8s ease 0.3s;
        `;
        nameContainer.appendChild(tagline);

        let inputCard = document.createElement('div');
        inputCard.style.cssText = `
            background: linear-gradient(145deg, rgba(15, 15, 30, 0.95), rgba(25, 25, 45, 0.95));
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 24px;
            padding: 35px 40px;
            box-shadow: 0 12px 48px rgba(0, 0, 0, 0.7), 0 0 80px rgba(168, 218, 255, 0.15);
            display: flex;
            flex-direction: column;
            gap: 25px;
            min-width: 500px;
            opacity: 0;
            transition: opacity 0.8s ease 0.2s;
        `;

        setupCard.parentElement.insertBefore(inputCard, setupCard);

        let inputSection = document.createElement('div');
        inputSection.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
        `;
        inputCard.appendChild(inputSection);

        (function () {
            const widget = getEl("turnstileWidget");
            if (!widget) return;
            const holder = document.createElement("div");
            holder.style.cssText = "display:flex;justify-content:center;width:100%;min-height:65px;";
            widget.style.display = "";
            holder.appendChild(widget);
            inputCard.appendChild(holder);

            let tries = 0;
            const settle = setInterval(function () {
                if (widget.childElementCount > 0 || ++tries > 60) return clearInterval(settle);
                if (tries < 12) return;
                if (!window.turnstile || typeof window.turnstile.render != "function") return;
                try {
                    window.turnstile.render(widget, {
                        sitekey: "0x4AAAAAAAMYHI96GFiJzMmp",
                        theme: "light",
                        callback: window.onGotTurnstileToken,
                        "error-callback": window.onTurnstileError,
                        "expired-callback": window.onTurnstileExpired
                    });
                    clearInterval(settle);
                } catch (e) {}
            }, 250);
        })();

        nameInput.style.cssText = `
            flex: 1;
            height: 58px;
            font-size: 17px;
            padding: 0 24px;
            border-radius: 16px;
            border: 2px solid rgba(255, 255, 255, 0.15);
            background: rgba(255, 255, 255, 0.08);
            color: white;
            font-family: 'Poppins', sans-serif;
            font-weight: 500;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            outline: none;
        `;
        nameInput.placeholder = "Enter your username...";
        nameInput.addEventListener("focus", () => {
            nameInput.style.borderColor = "rgba(100, 200, 255, 0.8)";
            nameInput.style.background = "rgba(255, 255, 255, 0.12)";
            nameInput.style.boxShadow = "0 0 0 4px rgba(100, 200, 255, 0.2), 0 8px 24px rgba(100, 200, 255, 0.3)";
            nameInput.style.transform = "translateY(-2px)";
        });
        nameInput.addEventListener("blur", () => {
            nameInput.style.borderColor = "rgba(255, 255, 255, 0.15)";
            nameInput.style.background = "rgba(255, 255, 255, 0.08)";
            nameInput.style.boxShadow = "none";
            nameInput.style.transform = "translateY(0)";
        });

        enterGameButton.style.cssText = `
            width: 120px;
            height: 58px;
            font-size: 18px;
            font-weight: 700;
            border-radius: 16px;
            border: none;
            background: linear-gradient(135deg, #00d9ff 0%, #0099ff 100%);
            color: white;
            cursor: pointer;
            font-family: 'Poppins', sans-serif;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 8px 24px rgba(0, 153, 255, 0.4);
            position: relative;
            overflow: hidden;
        `;
        enterGameButton.innerHTML = 'Play!';

        let buttonShine = document.createElement('div');
        buttonShine.style.cssText = `
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
            transition: left 0.5s;
        `;
        enterGameButton.appendChild(buttonShine);

        enterGameButton.addEventListener("mouseenter", () => {
            enterGameButton.style.transform = "translateY(-3px) scale(1.05)";
            enterGameButton.style.boxShadow = "0 12px 32px rgba(0, 153, 255, 0.6)";
            buttonShine.style.left = "100%";
        });
        enterGameButton.addEventListener("mouseleave", () => {
            enterGameButton.style.transform = "translateY(0) scale(1)";
            enterGameButton.style.boxShadow = "0 8px 24px rgba(0, 153, 255, 0.4)";
        });

        inputSection.appendChild(nameInput);
        inputSection.appendChild(enterGameButton);

        let divider = document.createElement('div');
        divider.style.cssText = `
            width: 100%;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
        `;
        inputCard.appendChild(divider);

        let skinSection = document.createElement('div');
        skinSection.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 15px;
            width: 100%;
        `;

        let skinLabel = document.createElement('div');
        skinLabel.innerHTML = '🎨 Choose Your Skin Color';
        skinLabel.style.cssText = `
            font-family: 'Poppins', sans-serif;
            font-size: 15px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.9);
            text-align: center;
            letter-spacing: 0.5px;
        `;
        skinSection.appendChild(skinLabel);

        skinColorHolder.style.cssText = `
            display: flex;
            justify-content: center;
            gap: 12px;
            align-items: center;
            flex-wrap: wrap;
            padding: 0;
            background: transparent;
            border-radius: 0;
        `;

        skinColorHolder.querySelectorAll('.skinColorItem').forEach((item, index) => {
            item.style.cssText = `
                width: 42px;
                height: 42px;
                border-radius: 12px;
                border: 3px solid rgba(255, 255, 255, 0.2);
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                opacity: 0;
                animation: fadeInScale 0.5s ease forwards;
                animation-delay: ${index * 0.05}s;
            `;

            item.addEventListener('mouseenter', () => {
                item.style.transform = 'translateY(-5px) scale(1.15)';
                item.style.borderColor = 'rgba(255, 255, 255, 0.8)';
                item.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.4), 0 0 20px rgba(255, 255, 255, 0.3)';
            });

            item.addEventListener('mouseleave', () => {
                item.style.transform = 'translateY(0) scale(1)';
                item.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                item.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            });
        });

        skinSection.appendChild(skinColorHolder);
        inputCard.appendChild(skinSection);

        setupCard.style.display = 'none';
        promoImageHolder.style.display = 'none';

        let styleSheet = document.createElement('style');
        styleSheet.textContent = `
            @keyframes fadeInScale {
                from {
                    opacity: 0;
                    transform: scale(0.8);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }

            @keyframes float {
                0%, 100% {
                    transform: translateY(0px);
                }
                50% {
                    transform: translateY(-10px);
                }
            }
        `;
        document.head.appendChild(styleSheet);

        let serverMenu = document.createElement("div");
        serverMenu.id = "serverMenu";
        serverMenu.style.cssText = `
            position: fixed;
            top: 50%;
            right: 40px;
            transform: translateY(-50%);
            width: 340px;
            opacity: 0;
            max-height: 650px;
            overflow: hidden;
            background: linear-gradient(145deg, rgba(15, 15, 30, 0.98), rgba(25, 25, 45, 0.98));
            backdrop-filter: blur(20px);
            padding: 0;
            border-radius: 20px;
            color: #fff;
            font-family: 'Poppins', sans-serif;
            z-index: 1000;
            box-shadow: 0 12px 48px rgba(0, 0, 0, 0.7), 0 0 80px rgba(168, 218, 255, 0.15);
            border: 1px solid rgba(255, 255, 255, 0.15);
            transition: opacity 0.5s ease-in-out, transform 0.5s ease;
        `;
        document.body.appendChild(serverMenu);

        let serverHeader = document.createElement("div");
        serverHeader.innerHTML = "🌍 Server Browser";
        serverHeader.style.cssText = `
            font-size: 20px;
            font-weight: 700;
            padding: 24px;
            background: linear-gradient(135deg, rgba(0, 153, 255, 0.3), rgba(0, 217, 255, 0.3));
            border-radius: 20px 20px 0 0;
            text-align: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            letter-spacing: 0.5px;
        `;
        serverMenu.appendChild(serverHeader);

        let buttonContainer = document.createElement("div");
        buttonContainer.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            padding: 20px;
            background: rgba(0, 0, 0, 0.2);
        `;
        serverMenu.appendChild(buttonContainer);

        let testServerButton = document.createElement("button");
        testServerButton.innerHTML = "🧪 Empty<br/>Server";
        testServerButton.style.cssText = `
            background: linear-gradient(135deg, #10b981, #059669);
            border: none;
            color: white;
            padding: 16px;
            border-radius: 12px;
            cursor: pointer;
            font-family: 'Poppins', sans-serif;
            font-weight: 600;
            font-size: 13px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);
            line-height: 1.4;
        `;
        testServerButton.addEventListener("mouseenter", () => {
            testServerButton.style.transform = "translateY(-3px)";
            testServerButton.style.boxShadow = "0 8px 24px rgba(16, 185, 129, 0.6)";
        });
        testServerButton.addEventListener("mouseleave", () => {
            testServerButton.style.transform = "translateY(0)";
            testServerButton.style.boxShadow = "0 4px 16px rgba(16, 185, 129, 0.4)";
        });
        testServerButton.addEventListener("click", async () => {
            let servers = await getServers();
            let testServer = servers.filter(server => server.playerCount === 0)
            .sort((a, b) => a.ping - b.ping)[0];

            if (testServer) {
                window.location.href = `${location.protocol}//${location.hostname}/?server=${testServer.region}:${testServer.name}`;
            } else {
                showNotification("No empty servers found!", "error");
            }
        });
        buttonContainer.appendChild(testServerButton);

        let largestServerButton = document.createElement("button");
        largestServerButton.innerHTML = "🔥 Active<br/>Server";
        largestServerButton.style.cssText = `
            background: linear-gradient(135deg, #0099ff, #0066cc);
            border: none;
            color: white;
            padding: 16px;
            border-radius: 12px;
            cursor: pointer;
            font-family: 'Poppins', sans-serif;
            font-weight: 600;
            font-size: 13px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 16px rgba(0, 153, 255, 0.4);
            line-height: 1.4;
        `;
        largestServerButton.addEventListener("mouseenter", () => {
            largestServerButton.style.transform = "translateY(-3px)";
            largestServerButton.style.boxShadow = "0 8px 24px rgba(0, 153, 255, 0.6)";
        });
        largestServerButton.addEventListener("mouseleave", () => {
            largestServerButton.style.transform = "translateY(0)";
            largestServerButton.style.boxShadow = "0 4px 16px rgba(0, 153, 255, 0.4)";
        });
        largestServerButton.addEventListener("click", async () => {
            let servers = await getServers();
            let largestServer = servers.sort((a, b) => {
                if (a.playerCount === b.playerCount) return a.ping - b.ping;
                return b.playerCount - a.playerCount;
            })[0];

            if (largestServer) {
                window.location.href = `${location.protocol}//${location.hostname}/?server=${largestServer.region}:${largestServer.name}`;
            } else {
                showNotification("No servers available!", "error");
            }
        });
        buttonContainer.appendChild(largestServerButton);

        let gameServers = document.createElement("div");
        gameServers.id = "game_servers";
        gameServers.style.cssText = `
            max-height: 450px;
            overflow-y: auto;
            padding: 15px 20px 20px 20px;
        `;
        serverMenu.appendChild(gameServers);

        let style = document.createElement("style");
        style.innerHTML = `
            #game_servers::-webkit-scrollbar {
                width: 6px;
            }
            #game_servers::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 10px;
            }
            #game_servers::-webkit-scrollbar-thumb {
                background: linear-gradient(180deg, rgba(0, 153, 255, 0.6), rgba(16, 185, 129, 0.6));
                border-radius: 10px;
            }
            #game_servers::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(180deg, rgba(0, 153, 255, 0.8), rgba(16, 185, 129, 0.8));
            }


            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateX(20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            .server-box {
                animation: slideIn 0.3s ease forwards;
            }
        `;
        document.head.appendChild(style);

        window.regionsName = {
            "eu-west": "🇩🇪 Frankfurt",
            "gb": "🇬🇧 London",
            "us-east": "🇺🇸 Miami",
            "us-west": "🇺🇸 Silicon Valley",
            "au": "🇦🇺 Sydney",
            "sg": "🇸🇬 Singapore",
            "saopaulo": "🇧🇷 São Paulo"
        };

        function showNotification(message, type = "info") {
            const notification = document.createElement("div");
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 16px 28px;
                background: ${type === "error" ? "linear-gradient(135deg, #ef4444, #dc2626)" : "linear-gradient(135deg, #10b981, #059669)"};
                color: white;
                border-radius: 12px;
                font-family: 'Poppins', sans-serif;
                font-weight: 600;
                z-index: 10000;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
                animation: slideIn 0.3s ease;
            `;
            document.body.appendChild(notification);
            setTimeout(() => {
                notification.style.opacity = "0";
                notification.style.transform = "translateX(100px)";
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }

        async function getServers() {
            let currentMode = location.host.replace(/\.moomoo\.io/, "");
            let apiBase = /(sandbox|dev)/.test(currentMode)
                ? `https://api-${currentMode}.moomoo.io`
                : "https://api.moomoo.io";

            let servers = null;
            for (const version of ["1.27", ""]) {
                try {
                    let response = await fetch(apiBase + "/servers" + (version ? "?v=" + version : ""));
                    if (!response.ok) continue;
                    let data = await response.json();
                    if (Array.isArray(data) && data.length) { servers = data; break; }
                } catch (error) { /* try the next shape */ }
            }
            if (!servers) {
                console.error("[caramila] could not load the server list from " + apiBase +
                    "/servers -- the browser will be empty. If the game itself still lists " +
                    "servers, the version parameter has moved again.");
                return [];
            }

            await Promise.all(servers.map(async server => {
                let pingHost = `${server.key}.${server.region}.moomoo.io`;
                if (server.port) pingHost += ":" + server.port;
                let requestPingUrl = `https://${pingHost}/ping`;
                let startTime = Date.now();
                try {
                    await fetch(requestPingUrl);
                    server.ping = Date.now() - startTime;
                } catch (error) {
                    server.ping = 999;
                }
            }));
            return servers;
        }

        async function updateServers() {
            let servers = await getServers();

            servers.sort((a, b) => {
                if (a.ping === b.ping) return b.playerCount - a.playerCount;
                return a.ping - b.ping;
            });

            let existingBoxes = {};
            gameServers.querySelectorAll('[data-server-key]').forEach(box => {
                existingBoxes[box.dataset.serverKey] = box;
            });

            servers.forEach((server, index) => {
                let key = `${server.region}:${server.name}`;
                let serverBox = existingBoxes[key];

                if (!serverBox) {
                    serverBox = document.createElement("div");
                    serverBox.className = "server-box";
                    serverBox.dataset.serverKey = key;
                    serverBox.style.cssText = `
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04));
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 12px;
                        margin-bottom: 10px;
                        padding: 14px 16px;
                        transition: all 0.3s ease;
                        cursor: pointer;
                        animation-delay: ${index * 0.05}s;
                        opacity: 0;
                    `;

                    serverBox.addEventListener("mouseenter", () => {
                        serverBox.style.background = "linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08))";
                        serverBox.style.transform = "translateX(5px)";
                        serverBox.style.borderColor = "rgba(0, 153, 255, 0.5)";
                    });

                    serverBox.addEventListener("mouseleave", () => {
                        serverBox.style.background = "linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))";
                        serverBox.style.transform = "translateX(0)";
                        serverBox.style.borderColor = "rgba(255, 255, 255, 0.1)";
                    });

                    gameServers.appendChild(serverBox);
                    setTimeout(() => serverBox.style.opacity = "1", 50);
                }

                let playerColor = server.playerCount >= 25 ? "#ff4444" : server.playerCount >= 15 ? "#ffa500" : "#44ff44";
                let pingColor = server.ping < 100 ? "#44ff44" : server.ping < 200 ? "#88ff44" : server.ping < 400 ? "#ffa500" : "#ff4444";

                serverBox.innerHTML = `
                    <div style="flex: 1; font-size: 13px; font-weight: 600;">
                        ${window.regionsName[server.region] || server.region} ${server.name}
                        <div style="font-size: 11px; opacity: 0.7; margin-top: 3px; font-weight: 500;">
                            <span style="color: ${playerColor};">${server.playerCount}</span>/${server.playerCapacity} players
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="color: ${pingColor}; font-size: 12px; font-weight: 600;">${server.ping}ms</span>
                        <button class="join-btn" style="
                            background: linear-gradient(135deg, #0099ff, #0066cc);
                            border: none;
                            color: white;
                            padding: 8px 16px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 12px;
                            font-weight: 600;
                            transition: all 0.2s ease;
                            box-shadow: 0 2px 8px rgba(0, 153, 255, 0.3);
                            font-family: 'Poppins', sans-serif;
                        ">Join</button>
                    </div>
                `;

                let joinBtn = serverBox.querySelector(".join-btn");
                joinBtn.addEventListener("mouseenter", () => {
                    joinBtn.style.transform = "scale(1.05)";
                    joinBtn.style.boxShadow = "0 4px 12px rgba(0, 153, 255, 0.5)";
                });
                joinBtn.addEventListener("mouseleave", () => {
                    joinBtn.style.transform = "scale(1)";
                    joinBtn.style.boxShadow = "0 2px 8px rgba(0, 153, 255, 0.3)";
                });
                joinBtn.onclick = (e) => {
                    e.stopPropagation();
                    window.location.href = `${location.protocol}//${location.hostname}/?server=${server.region}:${server.name}`;
                };

                serverBox.onclick = () => {
                    window.location.href = `${location.protocol}//${location.hostname}/?server=${server.region}:${server.name}`;
                };
            });
        }

        setInterval(updateServers, 5000);
        updateServers();

        setTimeout(() => {
            gameName.style.opacity = '1';
            tagline.style.opacity = '1';
            inputCard.style.opacity = '1';
            serverMenu.style.opacity = '1';
            serverMenu.style.transform = 'translateY(-50%)';
        }, 300);

        document.getElementById('loadingText').innerHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    margin: 0;
                    font-family: 'Poppins', sans-serif;
                }
                .progress-container {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 450px;
                    background: linear-gradient(145deg, rgba(15, 15, 30, 0.98), rgba(25, 25, 45, 0.98));
                    backdrop-filter: blur(20px);
                    border-radius: 24px;
                    overflow: hidden;
                    padding: 10px;
                    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.7), 0 0 80px rgba(168, 218, 255, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                }
                .progress-bar {
                    width: 0%;
                    height: 60px;
                    background: linear-gradient(90deg, #0099ff, #00d9ff, #0099ff);
                    background-size: 200% 100%;
                    border-radius: 18px;
                    animation: loading 2s ease-in-out forwards, shimmer 2s infinite;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 0 30px rgba(0, 153, 255, 0.6);
                }
                @keyframes loading {
                    from { width: 0%; }
                    to { width: 100%; }
                }
                @keyframes shimmer {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .progress-text {
                    color: white;
                    font-weight: 700;
                    font-size: 18px;
                    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
                    letter-spacing: 1px;
                }
            </style>
        </head>
        <body>
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-text">🐮 Loading MooMoo...</div>
                </div>
            </div>
        </body>
        </html>
        `;

        "use strict";
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

        const FONT_AWESOME = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        const link = document.createElement('link');
        link.rel = 'stylesheet1';
        link.href = FONT_AWESOME;
        document.head.appendChild(link);

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
                setting.style && (newCheck += ` style = ${setting.style.replaceAll(" ", "")}`);
                setting.class && (newCheck += ` class = ${setting.class}`);
                setting.checked && (newCheck += ` checked`);
                setting.onclick && (newCheck += ` onclick = ${setting.onclick}`);
                newCheck += `>`;
                this.add(newCheck);
            }
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
            }
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
            }
            selectMenu(setting) {
                let newSelect = `<select`;
                if (!setting.id) {
                    return;
                }
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
                        getEl("O_" + options).style.color = setting.menu[options] ? "#000" : "#fff";
                        getEl("O_" + options).style.background = setting.menu[options] ? "#8ecc51" : "#cc5151";
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
                window[setting.id + "Func"] = function () {
                    getEl(last).style.display = "none";
                    last = "check_" + getEl(setting.id).value.split("_")[1];
                    getEl(last).style.display = "inline-block";
                };
            }
        }

        const strictSoldier = document.getElementById("strict soldier");

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
                this.append(`<div id="${tabId}" class="tab-panel">${ui.content}</div>`);
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
            <div class="control">
                <label class="switch">
                    <input type="checkbox" id="${id}" ${checkedStatus ? "checked" : ""}>
                    <span class="slider"></span>
                </label>
                <span>${name}</span>
                ${optionsHtml}
            </div>
            `;
                this.append(boxHtml);
                setTimeout(() => {
                    const checkbox = document.getElementById(id);
                    if (checkbox) {
                        configs[id] = checkedStatus;
                        checkbox.addEventListener("change", (event) => {
                            const isChecked = event.target.checked;
                            localStorage.setItem(id, isChecked);
                            configs[id] = isChecked;
                        });
                    }
                    if (config.option) {
                        const dropdown = document.getElementById(`${id}-dropdown`);
                        if (dropdown) {
                            dropdown.addEventListener("change", (event) => {
                                const selectedOption = event.target.value;
                                localStorage.setItem(`${id}-selected`, selectedOption);
                                options[id] = selectedOption;
                            });
                            const storedSelected = localStorage.getItem(`${id}-selected`);
                            if (storedSelected) {
                                const selectedOption = dropdown.querySelector(`option[value="${storedSelected}"]`);
                                if (selectedOption) {
                                    selectedOption.selected = true;
                                    options[id] = storedSelected;
                                }
                            }
                        }
                    }
                }, 100);
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
            display: none;
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

        `);

const MENU_HTML = `
<div id="customMenu" class="dark-theme">
    <div id="starfield"></div>

    <!-- TOP HORIZONTAL NAVIGATION -->
    <div class="menu-top-nav" id="menuHeader">
        <div class="nav-header">
            <div class="header-logo">
                <i class="fas fa-crosshairs"></i>
                <h2 class="menu-title">☾ CaraMila</h2>
            </div>
            <div class="header-actions">
                <button class="icon-btn" id="minimizeBtn" title="Minimize"><i class="fas fa-minus"></i></button>
                <button class="icon-btn" id="themeToggle" title="Toggle Theme"><i class="fas fa-circle"></i></button>
                <button class="icon-btn close-btn" id="closeBtn" title="Close"><i class="fas fa-times"></i></button>
            </div>
        </div>

        <!-- HORIZONTAL TABS -->
        <div id="menuItems" class="horizontal-tabs">
            <div class="menu-item active" data-tab="offensive"><span>OFFENSIVE</span></div>
            <div class="menu-item" data-tab="defensive"><span>DEFENSIVE</span></div>
            <div class="menu-item" data-tab="visuals"><span>VISUALS</span></div>
            <div class="menu-item" data-tab="bots"><span>BOTS</span></div>
            <div class="menu-item" data-tab="keybinds"><span>KEYBINDS</span></div>
            <div class="menu-item" data-tab="misc"><span>MISC</span></div>
            <div class="menu-item" data-tab="settings"><span>SETTINGS</span></div>
        </div>
    </div>

    <!-- MAIN CONTENT AREA -->
    <div id="tabContent" class="menu-content-area">
        <!-- Tabs injected by UI.InnerHtml -->
    </div>

    <!-- RESIZE HANDLE -->
    <div class="resize-handle"></div>
</div>
`;

document.body.insertAdjacentHTML('beforeend', MENU_HTML);


function generateStarfield() {
    const starfield = document.getElementById('starfield');
    if (!starfield) return;
    const starCount = 60;
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.width = Math.random() * 2 + 0.5 + 'px';
        star.style.height = star.style.width;
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 3 + 's';
        star.style.animationDuration = (Math.random() * 2 + 2.5) + 's';
        starfield.appendChild(star);
    }
}
setTimeout(generateStarfield, 100);


const STYLES = `
:root {
    --bg-base: rgba(8, 12, 24, 0.95);
    --bg-panel: rgba(12, 18, 35, 0.92);
    --bg-card: rgba(15, 22, 40, 0.6);
    --bg-line: rgba(20, 28, 48, 0.5);

    --primary: #00e5ff;
    --primary-dim: rgba(0, 229, 255, 0.12);

    --text-main: #e4e8f0;
    --text-muted: #9aa5c0;
    --text-secondary: #6b7590;

    --border-color: rgba(100, 120, 160, 0.25);
    --border-accent: rgba(0, 229, 255, 0.15);
}

#customMenu.light-theme {
    --bg-base: rgba(245, 245, 250, 0.98);
    --bg-panel: rgba(250, 250, 255, 0.95);
    --bg-card: rgba(240, 245, 255, 0.8);
    --bg-line: rgba(230, 240, 250, 0.7);
    --primary: #0088cc;
    --primary-dim: rgba(0, 136, 204, 0.12);
    --text-main: #1a1a2e;
    --text-muted: #4a5568;
    --text-secondary: #718096;
    --border-color: rgba(100, 150, 200, 0.2);
    --border-accent: rgba(0, 136, 204, 0.15);
}

#starfield {
    position: absolute; top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none; overflow: hidden; z-index: 0;
}
.star {
    position: absolute; background: #d4dce8; border-radius: 50%;
    animation: twinkle linear infinite;
}
#customMenu.light-theme .star { background: #a0a8c0; }
@keyframes twinkle {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 0.8; transform: scale(1.1); }
}

#customMenu {
    position: fixed; top: 50%; left: 50%;
    width: 1020px; height: 680px;
    background: linear-gradient(135deg, rgba(12, 18, 35, 0.95) 0%, rgba(15, 22, 42, 0.92) 100%);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border-color);
    border-radius: 0 30px 30px 30px;
    font-family: 'Poppins', 'Inter', sans-serif;
    color: var(--text-main); overflow: hidden;
    opacity: 1; visibility: visible;
    z-index: 9999; display: flex; flex-direction: column;
    user-select: none; transform: translate(-50%, -50%);
}
#customMenu.light-theme {
    background: linear-gradient(135deg, rgba(250, 250, 255, 0.98) 0%, rgba(245, 248, 255, 0.95) 100%);
}
#customMenu.hidden { opacity: 0; visibility: hidden; pointer-events: none; }
#customMenu.minimized { height: auto; }
#customMenu.minimized .menu-content-area { display: none; }

.menu-top-nav {
    display: flex; flex-direction: column;
    background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 100%);
    border-bottom: 1px solid var(--border-color);
    z-index: 10; cursor: grab; cursor: -webkit-grab; transition: background 0.4s;
}
#customMenu.light-theme .menu-top-nav {
    background: linear-gradient(180deg, rgba(200,220,255,0.1) 0%, rgba(150,200,255,0.05) 100%);
}
.menu-top-nav:active { cursor: grabbing; }

.nav-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 18px 28px;
    border-bottom: 1px solid rgba(100, 120, 160, 0.15);
}
.header-logo { display: flex; align-items: center; gap: 14px; flex: 1; }
.header-logo i { color: var(--primary); font-size: 26px; animation: float 3s ease-in-out infinite; }
@keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-2px); }
}
.menu-title { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.8px; color: var(--primary); }
.header-actions { display: flex; gap: 10px; }

.icon-btn {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    color: var(--text-muted); width: 40px; height: 40px; border-radius: 0;
    cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; font-size: 16px;
}
.icon-btn:hover { background: rgba(0,229,255,0.1); border-color: var(--primary); color: var(--primary); transform: scale(1.05); }
.close-btn:hover { background: rgba(255,50,50,0.12); border-color: #ff6b6b; color: #ff6b6b; }

.horizontal-tabs {
    display: flex; overflow-x: auto; overflow-y: hidden;
    align-items: center; scroll-behavior: smooth;
    border-bottom: 1px solid var(--border-color);
}
.horizontal-tabs::-webkit-scrollbar { height: 4px; }
.horizontal-tabs::-webkit-scrollbar-thumb { background: rgba(0,229,255,0.25); }

.menu-item {
    padding: 14px 20px; cursor: pointer; font-size: 11px; font-weight: 700;
    color: var(--text-muted); display: flex; align-items: center;
    white-space: nowrap; flex-shrink: 0; transition: all 0.25s;
    position: relative; background: transparent; border: none;
    letter-spacing: 1px; text-transform: uppercase;
}
.menu-item::after {
    content: ''; position: absolute; bottom: -1px; left: 0; right: 0;
    height: 2px; background: var(--primary);
    transform: scaleX(0); transition: transform 0.3s ease; transform-origin: center;
}
.menu-item:hover { color: var(--text-main); }
.menu-item:hover::after { transform: scaleX(1); }
.menu-item.active { color: var(--primary); }
.menu-item.active::after { transform: scaleX(1); }

/* --- CONTENT AREA: grid layout so sections sit side by side --- */
.menu-content-area {
    flex: 1; padding: 28px 32px;
    overflow-y: auto; overflow-x: hidden;
    background: rgba(0,0,0,0.15);
    display: grid; grid-template-columns: 1fr 1fr; gap: 30px;
    align-content: start;
}
#customMenu.light-theme .menu-content-area { background: rgba(0,0,0,0.02); }
.menu-content-area::-webkit-scrollbar { width: 6px; }
.menu-content-area::-webkit-scrollbar-thumb { background: rgba(0,229,255,0.15); }
.menu-content-area::-webkit-scrollbar-thumb:hover { background: rgba(0,229,255,0.3); }

/* --- TAB PANELS: display:contents so grid flows through --- */
.tab-panel { display: none; }
.tab-panel.active { display: contents; }

/* --- SECTIONS --- */
.section-container { display: contents; }

.section {
    background: transparent; border: none; border-radius: 0;
    padding: 0; box-shadow: none;
    /* each section takes one grid column */
    display: flex; flex-direction: column;
}

.section h3 {
    margin: 0 0 12px 0; font-size: 11px; font-weight: 700;
    color: var(--text-muted); text-transform: uppercase; letter-spacing: 1.2px;
}

/* --- CONFIG LINES (from BoxF) --- */
.control, .config-line {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.02);
    gap: 18px; transition: all 0.25s;
}
#customMenu.light-theme .control,
#customMenu.light-theme .config-line { border-bottom: 1px solid rgba(0,0,0,0.03); }
.control:last-child, .config-line:last-child { border-bottom: none; }
.control:hover, .config-line:hover {
    background: rgba(0,229,255,0.05);
    padding-left: 6px; padding-right: 6px;
    margin-left: -6px; margin-right: -6px;
}

.control-info, .config-info {
    display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0;
}
.control-name, .config-name {
    font-size: 13px; font-weight: 600; color: var(--text-main); letter-spacing: 0.2px;
}
.control-desc, .config-desc {
    font-size: 11px; color: var(--text-secondary); line-height: 1.3; opacity: 0.8;
}
.control-right, .config-control {
    display: flex; align-items: center; gap: 10px; flex-shrink: 0;
}

/* --- TOGGLE SWITCH --- */
.switch { position: relative; width: 44px; height: 24px; display: inline-block; flex-shrink: 0; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider {
    position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%);
    border-radius: 50px; transition: all 0.35s cubic-bezier(0.4,0,0.2,1);
    border: 1px solid rgba(255,255,255,0.1);
}
#customMenu.light-theme .slider {
    background: linear-gradient(135deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.02) 100%);
    border: 1px solid rgba(0,0,0,0.1);
}
.slider:before {
    position: absolute; content: ""; height: 18px; width: 18px;
    left: 2px; bottom: 3px; background: white; border-radius: 50%;
    transition: all 0.35s cubic-bezier(0.4,0,0.2,1);
}
#customMenu.light-theme .slider:before { background: #1a1a2e; }
input:checked + .slider {
    background: linear-gradient(135deg, var(--primary) 0%, rgba(0,229,255,0.6) 100%);
    border-color: var(--primary);
}
input:checked + .slider:before { transform: translateX(20px); }

/* --- DROPDOWN --- */
.custom-select {
    background: linear-gradient(135deg, rgba(0,229,255,0.05) 0%, rgba(0,229,255,0.02) 100%);
    color: var(--text-main); border: 1px solid var(--border-accent);
    border-radius: 0; padding: 7px 11px; font-size: 11px;
    font-family: 'Poppins', sans-serif; font-weight: 500;
    outline: none; cursor: pointer; min-width: 130px; transition: all 0.25s;
}
.custom-select:hover { border-color: var(--primary); background: rgba(0,229,255,0.08); }
.custom-select:focus { border-color: var(--primary); background: rgba(0,229,255,0.12); color: var(--primary); }
.custom-select option { background: var(--bg-panel); color: var(--text-main); }

/* --- OPACITY SLIDER --- */
.minimal {
    width: 100%; max-width: 180px; height: 3px; border-radius: 0;
    background: linear-gradient(90deg, rgba(0,229,255,0.15) 0%, rgba(0,229,255,0.08) 100%);
    outline: none; -webkit-appearance: none; appearance: none;
}
.minimal::-webkit-slider-thumb {
    -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%;
    background: linear-gradient(135deg, var(--primary) 0%, rgba(0,229,255,0.7) 100%);
    cursor: pointer; border: 1.5px solid rgba(255,255,255,0.2);
}

/* --- SECTION PARAGRAPHS --- */
.section p {
    font-size: 12px; color: var(--text-secondary); line-height: 1.5;
    background: rgba(0,229,255,0.03); padding: 12px;
    border-left: 2px solid var(--border-accent); margin: 6px 0;
}

/* --- RESIZE HANDLE --- */
.resize-handle {
    position: absolute; bottom: 0; right: 0; width: 20px; height: 20px;
    cursor: se-resize;
    background: linear-gradient(135deg, transparent 50%, rgba(0,229,255,0.15) 50%);
    border-radius: 0 0 30px 0;
}
.resize-handle:hover { background: linear-gradient(135deg, transparent 50%, rgba(0,229,255,0.3) 50%); }

/* --- CHAT --- */
#menuChatDiv {
    position: absolute; display: block; left: 160px; bottom: 20px;
    width: 400px; font-family: "Gotham SSm", "Ubuntu", "Segoe UI", sans-serif; z-index: 9998;
}
.chMainBox {
    width: 260px; background: rgba(0,0,0,0.35); color: #fff; border-radius: 4px;
    font-family: "Gotham SSm", "Ubuntu", "Segoe UI", sans-serif;
    border: none; outline: none; padding: 5px; box-sizing: border-box;
    transition: background 0.15s ease;
}
.chMainBox:focus { background: rgba(0,0,0,0.5); }
.chMainDiv { height: 150px; overflow-y: auto; margin-bottom: 10px; background: rgba(0,0,0,0.2); border-radius: 4px; padding: 8px; }
.chDiv { display: flex; flex-direction: column; }

@media (max-height: 800px) { #customMenu { height: 85vh; } }
`;

const styleElement = document.createElement('style');
styleElement.textContent = STYLES;
document.head.appendChild(styleElement);
    // REMOVE NO NEED GUIS:
    const adSelectors = ["#adCard", "#promoImgHolder", "#wideAdCard", "#joinPartyButton", "#promoImgHolder",
                         "#pre-content-container", "#linksContainer2", "#partyButton", "#settingsButton",
                         "#leaderboardButton", "#ageText", "#ageBarContainer"];

    adSelectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) element.remove();
    });

function isC(id) {
    const raw = configs[id];
    const isBool = (raw === true || raw === false);
    return {
        checked: isBool ? raw : (raw !== false && raw !== 'false' && raw !== undefined),
        value: raw,
        is: function(val) { return raw === val; },
        options: { value: raw !== undefined ? String(raw) : '' }
    };
}


UI.InnerHtml('tabContent', (ui) => {

    ui.TabContent('offensive', (dc) => {
        dc.append('<div class="section-container">');

        dc.append('<div class="section"><h3>General</h3>');
        dc.BoxF("Auto Placer", "Places Item For you such as spike and Traps", "autoPlace");
        dc.BoxF("Auto Hits", "Automatically hits enemies", "autoHits");
        dc.BoxF("Auto Replacer", "Auto Replace Buildings", "autoReplace");
        dc.BoxF("Autohammer", "Shame Grind Enabled", "shameGrindEnabled");
        dc.BoxF("Preplacer", "Advanced Placing Obj", "autoPrePlace", {
            option: true,
            options: {
                "Spike Tick Type": { id: "spike", selected: true },
                "Retrap Type":     { id: "retrap" }
            }
        });
        dc.BoxF("Auto Push", "Pushes enemies to spike when they in trap", "autoPush");
        dc.append('</div>');

        dc.append('<div class="section"><h3>Combat</h3>');
        dc.BoxF("Reverse Insta", "Always reverse insta", "revInsta");
        dc.BoxF("Auto Bull Spam", "Automatically spam left-click when in range", "autoBullSpam");
        dc.BoxF("Auto One Tick", "Automatically smart one tick the nearest enemy", "autoOneTick");
        dc.BoxF("Spike On Reverse", "Place spike when reverse instaing and close to enemy", "doSpikeOnReverse");
        dc.BoxF("Auto Play", "Pathfinds to nearest enemy", "autoPlay");
        dc.BoxF("Spike Tick", "Spike and hit together when enemy break out of trap", "spikeTick");
        dc.append('</div>');

        dc.append('<div class="section"><h3>Advanced</h3>');
        dc.BoxF("KB Tick", "Knocks back enemy into spike", "predictTick");
        dc.BoxF("Slow One Tick", "Select wall when polearm ticking to slow down", "slowOT");
        dc.BoxF("Trap Animals", "Traps animals automatically", "trapAnimals");
        dc.BoxF("Turret Combat", "Uses turret when spike ticking", "turretCombat");
        dc.BoxF("Musket Veltick", "Auto veltick with musket - Blisma Corp.", "mVeltick");
        dc.BoxF("Hammer Veltick", "Auto veltick with hammer - Blisma Corp.", "hVeltick");
        dc.BoxF("Primary Sync", "Sync with players using this mod with primary", "serverSync");
        dc.append('</div>');

        dc.append('</div>'); // end section-container
    });

    ui.TabContent('defensive', (dc) => {
        dc.append('<div class="section-container">');

        dc.append('<div class="section"><h3>Protection</h3>');
        dc.BoxF("Auto Buy", "Buys hats and accessories automatically", "autoBuy");
        dc.BoxF("Anti 1 Tick", "Forces soldier when detects 1 tick", "anti1tick");
        dc.BoxF("Auto Q on Sync", "Heals as fast as possible when you may be synced", "autoQonSync");
        dc.BoxF("Hammer Breaker", "Use hammer when breaking", "hammerBreakerOptimisation");
        dc.append('</div>');

        dc.append('<div class="section"><h3>Safety</h3>');
        dc.BoxF("Safe Walk", "Avoids spikes", "safeWalk", {
            option: true,
            options: {
                "Move Away": { id: "move", selected: true },
                "Stop":      { id: "stop" }
            }
        });
        dc.BoxF("Anti Trap", "Places traps or spikes behind you when in trap", "antiTrap");
        dc.BoxF("strickSoldier");
        dc.BoxF("Extra Anti Spike Tick", "Uses knock back prediction and trap health to soldier or heal too", "safeAntiSpikeTick");
        dc.append('</div>');

        dc.append('<div class="section"><h3>Breakers</h3>');
        dc.BoxF("Spike Breaker", "Auto break enemy spikes in range", "breakSpikeSwitch");
        dc.BoxF("Trap Breaker", "Auto break enemy traps even if you are not in them", "breakTrapSwitch");
        dc.BoxF("Obstacle Breaker", "Auto break objects near the trap enemy is in", "breakAroundSwitch");
        dc.BoxF("Turret Type Breaker", "Auto break enemy turret/tp/blocked in range", "breakTTBSwitch");
        dc.BoxF("Break All", "Auto break all buildings", "breakAllSwitch");
        dc.append('</div>');

        dc.append('<div class="section"><h3>Counter</h3>');
        dc.BoxF("Counter Insta", "Spike gear and hit when enemy hit you", "antiBullType", {
            option: true,
            options: {
                "Predict": { id: "abreload" },
                "Always":  { id: "abalway", selected: true }
            }
        });
        dc.append('</div>');

        dc.append('</div>');
    });

    ui.TabContent('visuals', (dc) => {
        dc.append('<div class="section-container">');

        dc.append('<div class="section"><h3>Visual</h3>');
        dc.BoxF("Smoother Camera", "Makes camera move slower", "CAmera");
        dc.BoxF("Render Grid", "Shows grid overlay", "grid");
                dc.BoxF("Render Ghost", "Shows Ghost overlay", "Ghost");
        dc.BoxF("Player Glow", "Drop shadow and colour filter on every player. Looks nicer, costs a lot of FPS", "playerGlow");

        dc.BoxF("Render Direction", "Shows real direction", "renderDir", {
            option: true,
            options: {
                "When Auto Aim": { id: "attackDir" },
                "Always":        { id: "showDir", selected: true },
                "No Dir":        { id: "noDir" }
            }
        });
        dc.BoxF("Render Placers", "Show positions placed", "placeVis");
        dc.BoxF("Another Visual", "Another Render Day", "blablabla");
        dc.BoxF("Render Placer Calculations", "Visualise angle range arcs used by the placer", "placeCalcVis");
        dc.append('</div>');

        dc.append('</div>');
    });

    ui.TabContent('bots', (dc) => {
        dc.append('<div class="section-container">');
        dc.append('<div class="section"><h3>Bots</h3>');
        dc.append('<p>🤖 No bots for you :> (Coming soon™)</p>');
        dc.append('</div>');
        dc.append('</div>');
    });

    ui.TabContent('keybinds', (dc) => {
        dc.append('<div class="section-container">');
        dc.append('<div class="section"><h3>Keybinds</h3>');
        dc.append('<p><strong>Z</strong> - Auto Mill</p>');
        dc.append('<p><strong>F</strong> - Trap Type</p>');
        dc.append('<p><strong>V</strong> - Spike Type</p>');
        dc.append('<p><strong>N</strong> - Mill Type</p>');
        dc.append('<p><strong>H</strong> - Turret Type</p>');
        dc.append('<p><strong>Y</strong> - Stone/Sapling</p>');
        dc.append('<p><strong>Shift</strong> - Disable auto push or auto play for 10 seconds</p>');
        dc.append('<p><strong>T</strong> (hold) - 1 Tick</p>');
        dc.append('<p><strong>.</strong> (period) - Boost Tick</p>');
        dc.append('</div>');
        dc.append('</div>');
    });

    ui.TabContent('misc', (dc) => {
        dc.append('<div class="section-container">');

        dc.append('<div class="section"><h3>Other</h3>');
        dc.BoxF("Kill Chat", "Sends message when you kill someone", "killChat");
        dc.BoxF("Weapon Grind", "Auto place turret type item around you", "weaponGrind");
        dc.BoxF("Auto Respawn", "Respawns when you die automatically", "autoRespawn");
        dc.BoxF("Always Flipper", "Equips flipper when in water more", "alwaysFlipper");
        dc.BoxF("Auto Accept", "Adds players into your party asap when they request to join", "autoAccept");
        dc.BoxF("Ping Map", "Pings the map when you press r or click it", "allowPing");
        dc.BoxF("Player Follow", "Follows the targetted player around", "playerFollow");
        dc.append('</div>');

        dc.append('<div class="section"><h3>Fun</h3>');
        dc.BoxF("Funni Hats :)", "Changes hat when not near players", "hatType", {
            option: true,
            options: {
                "Hat Loop":      { id: "loop" },
                "Bush Gear":     { id: "bg", selected: true },
                "Assassin Gear": { id: "ag" }
            }
        });
        dc.append('</div>');

        dc.append('</div>');
    });

    ui.TabContent('settings', (dc) => {
        dc.append('<div class="section-container">');
        dc.append('<div class="section"><h3>Menu Appearance</h3>');
        dc.append(`
            <div class="control">
                <div class="control-info">
                    <div class="control-name">Menu Opacity</div>
                    <div class="control-desc">Adjust menu transparency</div>
                </div>
                <div class="control-right">
                    <input type="range" id="opacitySlider" min="0.3" max="1" step="0.01" value="1" class="minimal">
                </div>
            </div>
        `);
        dc.append(`
            <div class="control">
                <div class="control-info">
                    <div class="control-name">Background Blur</div>
                    <div class="control-desc">Enable blur effect behind menu</div>
                </div>
                <div class="control-right">
                    <label class="switch">
                        <input type="checkbox" id="blurToggle">
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
        `);
        dc.append('</div>');
        dc.append('</div>');
    });

});

const menu1 = getEl('customMenu');
const menuItems = document.querySelectorAll('.menu-item');
const tabPanels = document.querySelectorAll('.tab-panel');
const themeToggle = getEl('themeToggle');
const minimizeBtn = getEl('minimizeBtn');
const closeBtn = getEl('closeBtn');
const opacitySlider = getEl('opacitySlider');
const blurToggle = getEl('blurToggle');

let isDarkMode = true;
let isMenuOpen = true;
let isMinimized = false;

window.showMenu = function() {
    if (menu1) { menu1.classList.remove('hidden'); isMenuOpen = true; }
};
window.hideMenu = function() {
    if (menu1) { menu1.classList.add('hidden'); isMenuOpen = false; }
};

const switchTab = (tabId) => {
    tabPanels.forEach(p => p.classList.remove('active'));
    menuItems.forEach(i => i.classList.remove('active'));
    const panel = getEl(tabId);
    if (panel) panel.classList.add('active');
    const item = document.querySelector(`.menu-item[data-tab="${tabId}"]`);
    if (item) item.classList.add('active');
};

menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(item.getAttribute('data-tab'));
    });
});

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        menu1.classList.toggle('dark-theme', isDarkMode);
        menu1.classList.toggle('light-theme', !isDarkMode);
    });
}

if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation(); window.hideMenu();
    });
}

if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
        isMinimized = !isMinimized;
        menu1.classList.toggle('minimized', isMinimized);
        minimizeBtn.innerHTML = isMinimized ? '<i class="fas fa-plus"></i>' : '<i class="fas fa-minus"></i>';
    });
}

if (opacitySlider) {
    opacitySlider.addEventListener('input', function() {
        if (menu1) menu1.style.opacity = this.value;
    });
}

if (blurToggle) {
    blurToggle.addEventListener('change', () => {
        if (menu1) menu1.style.backdropFilter = blurToggle.checked ? 'blur(16px)' : 'blur(12px)';
    });
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        isMenuOpen ? window.hideMenu() : window.showMenu();
    }
});

switchTab('offensive');

(function initializeDragging() {
    const menu = getEl('customMenu');
    const header = getEl('menuHeader');
    if (!menu || !header) return;

    let isDragging = false, offsetX = 0, offsetY = 0;
    let menuX = window.innerWidth / 2, menuY = window.innerHeight / 2;

    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.icon-btn')) return;
        isDragging = true;
        offsetX = e.clientX - menuX;
        offsetY = e.clientY - menuY;
        header.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        menuX = e.clientX - offsetX;
        menuY = e.clientY - offsetY;
        menu.style.left = menuX + 'px';
        menu.style.top = menuY + 'px';
        menu.style.transform = 'translate(-50%, -50%)';
    });
    document.addEventListener('mouseup', () => {
        isDragging = false;
        header.style.cursor = 'grab';
    });
})();


(function initializeResizing() {
    const menu = getEl('customMenu');
    const handle = document.querySelector('.resize-handle');
    if (!menu || !handle) return;

    let isResizing = false, startX, startY, startW, startH;

    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX; startY = e.clientY;
        startW = menu.offsetWidth; startH = menu.offsetHeight;
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const w = startW + (e.clientX - startX);
        const h = startH + (e.clientY - startY);
        if (w > 600) menu.style.width = w + 'px';
        if (h > 400) menu.style.height = h + 'px';
    });
    document.addEventListener('mouseup', () => { isResizing = false; });
})();
let menuChatDiv = document.createElement("div");
menuChatDiv.id = "menuChatDiv";
gameUI.appendChild(menuChatDiv);

HTML.set("menuChatDiv");
HTML.setStyle(`
    position: absolute;
    display: block;
    left: 160px;
    bottom: 20px;
    width: 300px;
    background: transparent;
    box-shadow: none;
    border: none;
    font-family: "Gotham SSm", "Ubuntu", "Segoe UI", sans-serif;
`);

HTML.resetHTML();

HTML.setCSS(`
  .chMainDiv {
      max-height: 80px;
      overflow-y: auto;
      margin-bottom: 4px;
      background: transparent;
  }

  .chMainDiv::-webkit-scrollbar {
      width: 4px;
  }

  .chMainDiv::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.2);
      border-radius: 10px;
  }

  .chMainBox {
      width: 250px;
      height: 28px;
      background: transparent; /* fully invisible */
      color: #fff;
      border-radius: 4px;
      font-family: "Gotham SSm","Ubuntu","Segoe UI",sans-serif;
      border: none;
      outline: none;
      padding: 3px 6px;
      box-sizing: border-box;
      font-size: 12px;
      transition: background 0.15s ease;
  }

  .chMainBox:focus {
      background: rgba(0,0,0,0.25); /* only visible when typing */
  }
`);

HTML.startDiv({ id: "mChDiv", class: "chDiv" }, (html) => {
    HTML.addDiv({ id: "mChMain", class: "chMainDiv", appendID: "mChDiv" }, () => {});
    html.text({
        id: "mChBox",
        class: "chMainBox",
        placeHolder: `To chat click here or press "Enter" key`
    });
});

let menuChats = getEl("mChMain");
let menuChatBox = getEl("mChBox");
let menuCBFocus = false;
let menuChCounts = 0;

menuChatBox.value = "";

menuChatBox.addEventListener("focus", () => { menuCBFocus = true; });
menuChatBox.addEventListener("blur", () => { menuCBFocus = false; });

function removeChatBox() {
    const chatDiv = document.getElementById("menuChatDiv");
    if (chatDiv) chatDiv.remove();
}

function ChText(name, message, color, noTimer) {
    HTML.set("menuChatDiv");

    color = color || "white";

    let time = new Date();
    let min = time.getMinutes();
    let hour = time.getHours();

    min = min < 10 ? '0' + min : min;

    let getAMPM = hour >= 12 ? "PM" : "AM";
    let hour12 = hour % 12 || 12;

    let text = '';

    if (!noTimer) {
        text += `<span style="color:white;">${hour12}:${min} ${getAMPM} </span>`;
    }

    if (name) text += name;

    if (message) {
        text += `${(name ? ': ' : !noTimer ? ' ' : '') + message}\n`;
    }

    let messageDiv = document.createElement('div');
    messageDiv.id = "menuChDisp" + menuChCounts;
    messageDiv.style.color = color;
    messageDiv.style.fontSize = "10px";
    messageDiv.style.marginBottom = "2px";
    messageDiv.style.opacity = "0";
    messageDiv.style.background = "transparent";

    messageDiv.innerHTML = text;

    menuChats.appendChild(messageDiv);
    menuChats.scrollTop = menuChats.scrollHeight;

    menuChCounts++;

    let animation = messageDiv.animate([
        { opacity: 0, transform: "translateX(-10px)", offset: 0 },
        { opacity: 1, transform: "translateX(0)",     offset: 0.1 },
        { opacity: 1, transform: "translateX(0)",     offset: 0.85 },
        { opacity: 0, transform: "translateX(20px)",  offset: 1 }
    ], {
        duration: 6000,
        easing: 'ease-out',
        fill: 'forwards'
    });

    animation.onfinish = () => {
        messageDiv.remove();
    };
}

function resetMenuChText() {
    menuChats.innerHTML = '';
    menuChCounts = 0;
}

resetMenuChText();


const configs = {
    autoPlace: true,
    shameHammerHits: true,
    autoReplace: false,
    autoPrePlace: true,
    autoPush: true,
    revInsta: true,
    doSpikeOnReverse: true,
    autoPlay: false,
    spikeTick: true,
    predictTick: true,
    shameGrindEnabled: true,
    shameKillThreshold: 7,
    shamePerHit: 1,
    shameResetOnKill: true,
    shameResetOnEscape: true,
    slowOT: false,
    turretCombat: true,
    autoHits: true,
    velHit: true,
    predictHit: true,
    autoKillerHit: true,
    knockBackHit: true,
    serverSync: true,
    autoBuy: true,
    anti1tick: true,
    autoQonSync: true,
    hammerBreakerOptimisation: true,
    safeWalk: true,
    antiTrap: true,
    safeAntiSpikeTick: true,
    breakSpikeSwitch: true,
    breakAroundSwitch: true,
    breakTTBSwitch: true,
    breakAllSwitch: false,
    antiBullType: false,
    CAmera: true,
    renderDir: true,
    placeVis: true,
    killChat: true,
    weaponGrind: false,
    autoRespawn: false,
    alwaysFlipper: false,
    autoAccept: false,
    allowPing: true,
    playerFollow: false,
    trapAnimals: true,
    hatType: false,
    songChat: false,
    autoBullSpam: false,
    autoOneTick: false,
    mVeltick: false,
    hVeltick: false,
    breakTrapSwitch: false,
    grid: false,
    blablabla: false,
    placeCalcVis: false,
    retrapOnly: false,
    preplaceType: "spike",
    safeWalkType: "move",
    antiBullEnabled: false,
    hatTypeEnabled: false
};

let options = {};
let WS = undefined;
let socketID = undefined;

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

// CLIENT SERVER:
let serverSocket = null;
let serverIsOpen = false;
let isConnecting = false;
let serverUsers = {};

const MOD_SERVER_URL = 'wss://sync-script-users-qd2n.onrender.com/';
const RECONNECT_DELAY = 2000;
let modServer = new class {
    cleanup() {
        serverIsOpen = false;
        isConnecting = false;
    }

    scheduleReconnect() {
        setTimeout(() => {
            this.start();
        }, RECONNECT_DELAY);
    }

    getMyId() {
        return (typeof player !== 'undefined' && player) ? player.sid : null;
    }

    isMe(sid) {
        return sid === this.getMyId();
    }

    cleanupOldPlayers() {
        const now = Date.now();
        const TIMEOUT = 5000;
        const myId = this.getMyId();

        Object.keys(serverUsers).forEach(sid => {
            if (now - serverUsers[sid].receivedAt > TIMEOUT || sid == myId) {
                delete serverUsers[sid];
            }
        });
    }

    start() {

        if (isConnecting || serverIsOpen) return;

        isConnecting = true;

        try {
            serverSocket = new WebSocket(MOD_SERVER_URL);

            serverSocket.isModSocket = true;

            serverSocket.onopen = () => {
                isConnecting = false;
                serverIsOpen = true;

                serverSocket.send(JSON.stringify({
                    isPlay: true,
                    gameName: "moomoo.io",
                    challenge: "moo"
                }));
            };

            serverSocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (err) {
                    console.error('Parse error:', err);
                }
            };

            serverSocket.onclose = () => {
                this.cleanup();
                this.scheduleReconnect();
            };

            serverSocket.onerror = (error) => {
                this.cleanup();
                this.scheduleReconnect();
            };

        } catch (err) {
            console.error("Connection failed:", err);
            this.cleanup();
            this.scheduleReconnect();
        }

    }

    handleMessage(data) {
        switch (data.type) {
            case 'auth':
                console.log('🔓 Authenticated:', data.message);
                break;

            case 'playerUpdate':
                if (data.player && data.player.sid) {
                    if (!this.isMe(data.player.sid)) {
                        serverUsers[data.player.sid] = {
                            ...data.player,
                            receivedAt: Date.now()
                        };
                    }
                }
                break;

            case 'playersList':
                data.players.forEach(p => {
                    if (!this.isMe(p.sid)) {
                        serverUsers[p.sid] = {
                            ...p,
                            receivedAt: Date.now()
                        };
                    }
                });
                break;

            case 'playerLeft':
                delete serverUsers[data.sid];
                break;

            case 'chat':
                console.log('💬 CHAT received:', data);
                this.handleIncomingChat(data);
                break;

            case 'pong':
                const latency = Date.now() - window.lastPingTime;
                break;
        }

        this.cleanupOldPlayers();
    }

handleIncomingChat(data) {
    console.log('🎯 handleIncomingChat CALLED:', data); // ← ДОБАВЬ

    if (!data.sid || !data.message) {
        console.log('❌ Missing sid or message'); // ← ДОБАВЬ
        return;
    }

    console.log('✅ Calling ChText'); // ← ДОБАВЬ
    ChText(`${data.name} {${data.sid}}`, data.message, "#a8e6cf");
    console.log('✅ ChText done'); // ← ДОБАВЬ
}

    getModUsers() {
        const myId = this.getMyId();
        return Object.values(serverUsers).filter(user => user.sid !== myId);
    }

    isModUser(sid) {
        if (this.isMe(sid)) return false;
        return serverUsers.hasOwnProperty(sid);
    }
}();

modServer.start();

let dontSend = false;
let fpsTimer = {
    last: 0,
    time: 0,
    ltime: 0
}
let lastsp = ["cc", 1, "__proto__"];

function sendFiltered(sock, type, data) {
    {
        dontSend = false;
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
                        return (message.length == 30 ? match[0].toUpperCase() : (match[0] + "\x00")) + match.slice(1);
                    });
                });

                // FIX CHAT:
                data[0] = message.slice(0, 30);
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
                playersJoining.filter(e => e != data[0])
            }
        } else if (type == "e") {
            if (!data[0]) {
                dontSend = true;
            } else {
                player.moveDir = undefined;
            }
        }
        if (!dontSend) {
            EXP.send(sock, type, data);
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
    }
}

EXP.setHandler(function (message) {
    if (this.isModSocket) return EXP.nativeSend.call(this, message);
    if (!WS) {
        WS = this;
        WS.addEventListener("message", function (msg) {
            getMessage(msg);
        });
        WS.addEventListener("close", (event) => {
            window.location.reload();
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

// VOLCANO:
let xof = undefined;
let yof = undefined;
let volcano = {
    animationTime: 0,
    land: null,
    lava: null,
    x: config.volcanoLocationX,
    y: config.volcanoLocationY
};
let debugStop = false;
let kbIndc = {
    mex: 0,
    mey: 0
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
let near = {};
let targetPlayer = undefined;
let ping = {
    min: 0,
    max: 0,
    avg: 0
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
}

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
    placeSpawnPads: 0,
    old: {
        x: 0,
        y: 0
    },
    spawnDist: 124
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
        this.fgdo = function (a, b) {
            return Math.sqrt(Math.pow((b.y - a.y), 2) + Math.pow((b.x - a.x), 2));
        }
        this.getDirection = function (x1, y1, x2, y2) { //direction of x1,y1 from x2,y2
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
                this.scale -= .8;
                // this.scale > 0.35 && (this.scale = Math.max(this.scale, this.startScale));
                // this.speed < this.speedMax && (this.speed -= this.speedMax * .0075);
                if (this.scale >= this.maxScale) {
                    this.scale = this.maxScale;
                    this.scaleSpeed *= -.5;
                    this.speed = this.speed * .75;
                };
                this.life <= 0 && (this.life = 0)
            };
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
};
class Textmanager {
    constructor() {
        this.texts = [];
        this.stack = [];

        this.update = function (delta, ctxt, xOff, yOff) {
            ctxt.textBaseline = "middle";
            ctxt.textAlign = "center";

            for (let i = this.texts.length - 1; i >= 0; --i) {
                if (this.texts[i].life > 0) {
                    this.texts[i].update(delta);

                    // Calculate progress (0 to 1)
                    const progress = 1 - (this.texts[i].life / this.texts[i].maxLife);

                    // 1. Setup the heavy glow with dynamic intensity
                    ctxt.save();
                    ctxt.shadowColor = "#ffffff";
                    ctxt.shadowBlur = 25 * (1 - progress); // Fade glow over time
                    ctxt.fillStyle = "#ffffff";
                    ctxt.globalAlpha = 1 - progress; // Fade out text

                    // 2. Apply flying animation transformations
                    const translateX = Math.sin(progress * Math.PI * 2) * 15; // Horizontal wave
                    const translateY = -progress * 60; // Upward movement
                    const scaleAmount = 1 + progress * 0.3; // Slight growth

                    ctxt.translate(
                        this.texts[i].x - xOff + translateX,
                        this.texts[i].y - yOff + translateY
                    );
                    ctxt.scale(scaleAmount, scaleAmount);
                    ctxt.translate(
                        -(this.texts[i].x - xOff + translateX),
                        -(this.texts[i].y - yOff + translateY)
                    );

                    // 3. Render multiple times to "stack" the brightness
                    this.texts[i].render(ctxt, xOff - translateX, yOff + translateY);

                    ctxt.shadowBlur = 10 * (1 - progress);
                    this.texts[i].render(ctxt, xOff - translateX, yOff + translateY);

                    // 4. Add a subtle stroke that fades
                    ctxt.strokeStyle = `rgba(255, 255, 255, ${0.8 * (1 - progress)})`;
                    ctxt.lineWidth = 1;
                    ctxt.strokeText(
                        this.texts[i].text,
                        this.texts[i].x - xOff,
                        this.texts[i].y - yOff
                    );

                    ctxt.restore();
                } else {
                    // Remove dead text (optional: recycle for performance)
                    this.texts.splice(i, 1);
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

            // Store max life for animation calculations
            tmpText.maxLife = life;
            tmpText.init(x, y, scale, speed, life, text, "#ffffff");
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

            // === SPIN-TO-REST INIT ===
            this.lastDir = dir; // final resting direction
            this.dir = config.anotherVisual ? dir + Math.PI : dir + Math.PI; // start spun
            this.spawnSpin = true; // enable one-time spin animation
            // =========================

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
            this.reloads = this.shootRate;
            this.spawnPoint = data.spawnPoint;
            this.onNear = 0;
            this.breakObj = false;
            this.alpha = data.alpha || 1;
            this.maxAlpha = data.alpha || 1;
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
        this.getScale = function (sM = 1, ig) {
            return this.scale * (
                (this.isItem || this.type == 2 || this.type == 3 || this.type == 4)
                ? 1
                : (0.6 * sM)
            ) * (ig ? 1 : this.colDiv);
        };

        // VISIBLE TO PLAYER:
        this.visibleToPlayer = function (player) {
            return !(this.hideFromEnemy) || (
                this.owner && (
                    this.owner == player ||
                    (this.owner.team && player.team == this.owner.team)
                )
            );
        };

        // UPDATE:
        this.update = function (delta) {
            if (this.active) {

                // WIGGLE DECAY
                if (this.xWiggle) this.xWiggle *= Math.pow(0.99, delta);
                if (this.yWiggle) this.yWiggle *= Math.pow(0.99, delta);

                // === SPIN-TO-REST UPDATE ===
                if (this.spawnSpin) {
                    let d2 = UTILS.getAngleDist(this.lastDir, this.dir);
                    if (Math.abs(d2) > 0.01) {
                        this.dir += d2 / 5; // smooth spin
                    } else {
                        this.dir = this.lastDir;
                        this.spawnSpin = false; // stop spinning
                    }
                }
                // ===========================

                // EXISTING SPINNING SPIKES
                if (this.turnSpeed && this.name === "spinning spikes") {
                    this.dir += delta * 0.0009;
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

            } else if (this.alive) {

                this.alpha -= delta / (200 / this.maxAlpha);
                this.visScale += delta / (this.scale / 2.5);
                if (this.alpha <= 0) {
                    this.alpha = 0;
                    this.alive = false;
                }
            }
        };
this.isTeamObject = function (tmpObj) {
    if (!this.owner) return false; // No owner => treat as enemy
    if (tmpObj.sid == this.owner.sid || tmpObj.sid == player.sid && alliancePlayers.includes(this.owner.sid)) return true;
    let ownerPlayer = findPlayerBySID(this.owner.sid);
    if (ownerPlayer) return ownerPlayer.isTeam(tmpObj);
    return false;
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
            speed: 1.5,
            scale: 20,
            range: 600
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
            indx: 1, //idk what this is
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
    constructor(GameObject, gameObjects, UTILS, config) {
        let mathFloor = Math.floor,
            mathABS = Math.abs,
            mathCOS = Math.cos,
            mathSIN = Math.sin,
            mathPOW = Math.pow,
            mathSQRT = Math.sqrt,
            tmpX, tmpY,
            tmpS = config.mapScale / config.colGrid / 10;

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

        this.setObjectGrid = function (obj) {
            const gx = Math.floor(obj.x / tmpS);
            const gy = Math.floor(obj.y / tmpS);

            const key = gx + "_" + gy;

            if (!this.grids[key]) this.grids[key] = [];
            this.grids[key].push(obj);

            obj.gridKey = key;
        };

        // REMOVE OBJECT FROM GRID:
        this.removeObjGrid = function (obj) {
            const key = obj.gridKey;
            if (!key) return;

            const cell = this.grids[key];
            if (!cell) return;

            const i = cell.indexOf(obj);
            if (i !== -1) cell.splice(i, 1);

            obj.gridKey = null;
        };

        this.getGridArrays = function(x, y, r) {
            const minX = Math.floor((x - r) / tmpS);
            const maxX = Math.floor((x + r) / tmpS);
            const minY = Math.floor((y - r) / tmpS);
            const maxY = Math.floor((y + r) / tmpS);

            const result = [];

            for (let gx = minX; gx <= maxX; gx++) {
                for (let gy = minY; gy <= maxY; gy++) {
                    const cell = this.grids[gx + "_" + gy];
                    if (cell) result.push(cell);
                }
            }
            return result;
        }

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
            this.setObjectGrid(tmpObj);
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
            gameObjects.filter((tmp) => tmp.active && tmp.owner && tmp.owner.sid == sid).forEach((tmp) => this.disableObj(tmp));
        };

        // CHECK IF PLACABLE:
        this.checkItemLocation = function (x, y, s, sM, indx, ignoreWater) {
            let cantPlace = nearObjs.find((tmp) => UTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
            if (cantPlace) return false;
            if (!ignoreWater && indx != 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) return false;
            return true;
        };

        this.preplaceCheck = function (x, y, s, sM, indx, ignoreWater, object) {
            let cantPlace = nearObjs.find((tmp) => tmp.sid != object.sid && UTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
            if (cantPlace) return false;
            if (!ignoreWater && indx != 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) return false;
            return UTILS.getDistance(x, y, object.x, object.y) <= s + object.scale;
        };

this.canBeBroken = function (object) {
    if (!inGame || !object || !enemy.length) return;

    const useHammer = autoBreak.useHammer(object);

    const playerWeapon = player.weapons[useHammer ? 1 : 0];
    const isPlayerPrimary = playerWeapon < 9;

    const playerVariant = isPlayerPrimary ? player.primaryVariant : player.secondaryVariant;

    const playerVariantDmg = playerVariant !== undefined ? config.weaponVariants[playerVariant].val : 1;

    const playerReloaded = isPlayerPrimary ? player.primaryReloaded : player.secondaryReloaded;

    // --- ENEMY ---
    let enemyWeapon = 10;
    if (near.secondaryIndex !== undefined && near.primaryIndex !== undefined) {
        enemyWeapon = near.secondaryIndex === 10 && (object.health > items.weapons[near.primaryIndex].dmg || near.primaryIndex === 5) ? near.secondaryIndex : near.primaryIndex;
    }

    const isEnemyPrimary = enemyWeapon < 9;

    const enemyVariant = near.secondaryIndex !== undefined && near.primaryIndex !== undefined ? (isEnemyPrimary ? near.primaryVariant : near.secondaryVariant) : 3;

    const enemyVariantDmg = config.weaponVariants[enemyVariant].val;

    const enemyReloaded = isEnemyPrimary ? near.primaryReloaded : near.secondaryReloaded;

    // --- DAMAGE ---
    const playerDamage = items.weapons[playerWeapon].dmg;
    const enemyDamage = items.weapons[enemyWeapon].dmg;

    const tank = 3.3;
    let damageThreat = 0;

    if (enemyReloaded && this.canHit(near, object, enemyWeapon)) {
        damageThreat += enemyDamage * tank * enemyVariantDmg * (items.weapons[enemyWeapon].sDmg || 1);
    }

    if (playerReloaded && (clicks.right || (autoBreak.active && (autoBreak.priority[0].includes(object) || autoBreak.priority[1].includes(object) || autoBreak.priority[2].includes(object))))) {
        damageThreat += playerDamage * tank * playerVariantDmg * (items.weapons[playerWeapon].sDmg || 1);
    }

    return object.health <= damageThreat;
};

        /*this.hitsToBreak = function (object, who) {
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
        };*/

        this.canHit = function (player, object, weapon, moreSafe = 0) {
            return UTILS.getDist(player, object, 2, 0) <= items.weapons[weapon].range + object.scale + moreSafe;
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
                        if (obj2.dmg && (obj2.isAI || !obj2.isTeamObject(obj1) || obj2.type == 1 && obj2.y >= 12000)) {
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
                    }/* else if (obj2.boostSpeed) {
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
        }
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
    constructor(Projectile, projectiles, players, ais, objectManager, items, config, UTILS) {
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
                tmpProj = new Projectile(players, ais, objectManager, items, config, UTILS);
                tmpProj.sid = projectiles.length;
                projectiles.push(tmpProj);
            }
            tmpProj.init(indx, x, y, dir, speed, tmpData.dmg, range, tmpData.scale);
            tmpProj.layer = layer || tmpData.layer;
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

        this.update = function (delta) {
            let closeObjs = [];
            objectManager.getGridArrays(this.x, this.y, this.scale + 100).forEach(arr => {
                arr.forEach(obj => {
                    closeObjs.push(obj);
                });
            });
            let hitObjects = closeObjs.filter(e => UTILS.getDist(e, this, 0, 2) <= this.scale + e.getScale() + 2);
            if (!this.noTrap) {
                let nearTrap = hitObjects.filter(e => e.trap)[0];
                this.inTrap = nearTrap;
                if (nearTrap) nearTrap.hideFromEnemy = false;
                if (configs.trapAnimals && !this.inTrap && UTILS.getDist(tmpObj, player, 2, 2) <= player.scale + this.scale + items.list[player.items[4]]?.scale - 5) {
                    if (!autoPlace.rangesUpdated[4]) autoPlace.angleRanges(4);
                    place(4, autoPlace.closeToAngle(UTILS.getDirect(tmpObj, player, 2, 2), autoPlace.ranges[4]));
                }
            }
            if (this.colDmg && hitObjects.some(e => e.dmg)) {
                let objectsHit = objectManager.hitObj;
                objectManager.hitObj = [];
                objectsHit.forEach((healthy) => {
                    healthy.health -= this.colDmg;
                });
            }
        }

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

// something I made to try to predict player coordinates. Unfortunately I never finished it cuz of school.
class MovementSimulator {
    constructor(player) {
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
        for (let i = 0; i < depth; ++i) {
            if (this.xVel) this.x += this.xVel * delta * tMlt;
            if (this.yVel) this.y += this.yVel * delta * tMlt;
            let tmpList = objectManager.getGridArrays(this.x, this.y, this.scale + 100);
            for (let x = 0; x < tmpList.length; ++x) {
                for (let y = 0; y < tmpList[x].length; ++y) {
                    let object = tmpList[x][y];
                    if (tmpList[x][y].active) {
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
                                    if (object.dmg && !object.isTeamObject(this)) {
                                        let tmpSpd = 1.5 * (object.weightM || 1);
                                        this.xVel += tmpSpd * Math.cos(tmpDir);
                                        this.yVel += tmpSpd * Math.sin(tmpDir);
                                        hitSpikes.push(object);
                                    }
                                } else if (object.trap && !object.isTeamObject(this)) {
                                    gotTrapped = true;
                                } else if (object.boostSpeed) {
                                    this.xVel += delta * object.boostSpeed * Math.cos(object.dir);
                                    this.yVel += delta * object.boostSpeed * Math.sin(object.dir);
                                } else if (object.teleport) {
                                    gotTp = true;
                                }
                                if (object.zIndex > this.zIndex) this.zIndex = object.zIndex;
                            }
                        }
                    }
                }
            }
        }
        for (let i = 0; i < nears.length; ++i) {
            let near = nears[i];
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
                    //near.movementSimulator.x -= tmpInt * Math.cos(tmpDir)
                    //near.movementSimulator.y -= tmpInt * Math.sin(tmpDir)
                }
            }
        }
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
    //some testing stuff where I try to predict where I will end up if I move in a certain way. Have not tested this at all so may be very inaccurate
    customMovement() {
        this.continueTick(113, 0, 1);
        this.continueTick(113, Math.PI / 2, 0);
        this.continueTick(113, undefined, 0);
        this.continueTick(113, undefined, 0);
        this.continueTick(113, undefined, 0);
        this.continueTick(113, undefined, 0);
        console.log(this.x, this.y);
    }
}
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
        this.pingPredict = -1;
        this.inWater = false;
        this.tails = {0: 1};
        this.antiTurretSpam = false;
        for (let i = 0; i < accessories.length; ++i) {
            if (accessories[i].price <= 0)
                this.tails[accessories[i].id] = 1;
        }
        this.skins = {0: 1};
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
        this.hitSpike = 0;
        this.iconIndex = 0;
        this.skinColor = 0;
        this.dist2 = 0;
        this.aim2 = 0;
        this.chat = {
            message: null,
            count: 0
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
                totalNoSoldier: 0,
                totalSoldier: 0,
                sum: 0
            };
            this.inTrap = undefined;
            this.lastTrap = false;
            this.escaped = false;
            this.empAnti = false;
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
            objectManager.getGridArrays(this.x, this.y, this.scale + 69).forEach(arr => {
                arr.forEach(obj => {
                    obj.active && collideObjects.push(obj);
                });
            });

            let hitObjects = collideObjects.filter(e => UTILS.getDist(e, this, 0, 2) <= this.scale + e.getScale() + 2);
            let nearTrap = hitObjects.filter(e => e.trap && !e.isTeamObject(this))[0];
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
            return this.sid == tmpObj.sid || this.sid == player.sid && alliancePlayers.includes(tmpObj.sid) || tmpObj.sid == player.sid && alliancePlayers.includes(this.sid) || this.team != null && tmpObj.team != null && this.team == tmpObj.team;
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
                if (primary.weapon != undefined && this.primaryReloaded) {
                    totally += primary.dmg * pV * bull;
                }
                if (secondary.weapon != undefined && this.secondaryReloaded) {
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
                        if (this.reloads[this.weapons[0]] == 0 && this.reloads[this.weaponIndex] == 0) {
                            this.antiBull++;
                            game.tickBase(() => {
                                this.antiBull = 0;
                            }, 1);
                        }
                    }
                }
            }
            if (this.weaponIndex < 9) {
                this.primaryReloaded = this.reloads[this.weaponIndex] <= game.tickRate * Math.floor(ping.avg / game.tickRate);
            } else {
                this.secondaryReloaded = this.reloads[this.weaponIndex] <= game.tickRate * Math.floor(ping.avg / game.tickRate);
            }
        };

        // FOR ANTI INSTA:
        this.addDamageThreat = function (type, damage) {
            this.damageSources[type] += damage;
            this.damageSources.sum += damage;
            this.damageSources.totalNoSoldier = this.damageSources.sum - Math.min(this.damageSources.primary, (this.damageSources.secondary + this.damageSources.turret));
            this.damageSources.totalSoldier = this.damageSources.totalNoSoldier * 0.75;
        };
        this.removeDamageThreat = function (type, damage) {
            if (!damage) {
                this.damageSources[type] = 0;
                return;
            }
            let before = this.damageSources[type];
            this.damageSources[type] = Math.max(0, this.damageSources[type] - damage);
            let after = this.damageSources[type];
            let diff = before - after;
            this.damageSources.sum -= diff;
            this.damageSources.totalNoSoldier = this.damageSources.sum - Math.min(this.damageSources.primary, (this.damageSources.secondary + this.damageSources.turret));
            this.damageSources.totalSoldier = this.damageSources.totalNoSoldier * 0.75;
        }

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
                    dmg: 0
                }
                let secondary = {
                    weapon: tmpObj.secondaryIndex,
                    variant: tmpObj.secondaryVariant,
                    dmg: 0
                };
                primary.dmg = primary.weapon == undefined ? 45 : items.weapons[primary.weapon].dmg;
                secondary.dmg = primary.weapon == 0 ? 0 : secondary.weapon == undefined ? 50 : items.weapons[secondary.weapon].Pdmg;
                let pV = primary.variant != undefined ? config.weaponVariants[primary.variant].val : 1.18;
                let sV = secondary.variant != undefined ? [9, 12, 13, 15].includes(secondary.weapon) ? 1 : config.weaponVariants[secondary.variant].val : 1;
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
                        secondary.dmg = secondary.dmg * sV * (player.skinIndex == 7 ? 1.5 : 1);
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
                if (this.poisonCounter > 0 && [0, 7, 8].includes((game.tick - my.bullTick) % 9)) {
                    this.addDamageThreat("DOT", 5);
                }
            });
        };
    }
};

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
    weapon: null
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
        if (id === 0 || (player.alive && inGame && (player.itemCounts[item.group.id] == undefined || player.itemCounts[item.group.id] < (config.isSandbox ? id === 3 || id === 5 ? 299 : 99 : (item.group.limit || 99))))) {
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
                    dir: rad
                });
                workerSetTimeout(() => {
                    targetArray.shift();
                }, 111)
            }
        }
    } catch (e) {
        console.log(e)
    }
}

function checkPlace(id, rad, tmpX, tmpY) {
    try {
        if (id == undefined) return;
        let item = items.list[player.items[id]];
        if (!tmpX || !tmpY) {
            let tmpS = player.scale + item.scale + (item.placeOffset || 0);
            tmpX = player.x2 + tmpS * Math.cos(rad);
            tmpY = player.y2 + tmpS * Math.sin(rad);
        }
        if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false)) {
            place(id, rad, 0, tmpX, tmpY);
        }
    } catch (e) { }
}

// HEALING:
function healthBased() {
    if (player.health == player.maxHealth) return 0;
    if ((player.skinIndex != 45 && player.skinIndex != 56)) {
        return Math.ceil((player.maxHealth - player.health) / items.list[player.items[0]].healing);
    }
    return 0;
}

function getAttacker(damaged) {
    let attackers = nears.filter(tmp => {
        if (tmp.attacked) {
            let index = tmp.weaponIndex;
            let dmg = index > 8 ? items.weapons[index].Pdmg : items.weapons[index].dmg;
            let variant = tmp[(index < 9 ? "prima" : "seconda") + "ryVariant"]
            dmg = dmg * (tmp.skinIndex == 7 ? 1.5 : 1) * (tmp.tailIndex == 11 ? 0.2 : 1) * (config.weaponVariants[variant].val) * (player.skinIndex == 6 ? 0.75 : 1);
            if (Math.abs(damaged - dmg) < 0.000001) {
                if (player.skinIndex != 23) {
                    player.poisonCounter = variant == 3 ? 5 : tmp.skinIndex == 21 ? 6 : player.poisonCounter;
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
let loopHats = [28, 29, 30, 36, 37, 38, 44];
let aCounter = 0;

function biomeGear(mover, returns) {
    if (player.inWater) {
        if (returns) return 31;
        storeEquip(31, 0);
    } else {
        if (!configs.hatType || options.hatType == "ag") {
            if (player.y2 <= config.snowBiomeTop) {
                if (returns) return mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : 15;
                storeEquip(mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : 15, 0);
            } else {
                if (returns) return mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : 12;
                storeEquip(mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : 12, 0);
            }
        } else {
            if (options.hatType == "bg") {
                if (returns) return 10;
                storeEquip(10, 0)
            } else if (options.hatType == "loop") {
                aCounter = (aCounter >= loopHats.length - 1 ? 0 : aCounter + 1);
                if (player.y2 <= config.snowBiomeTop) {
                    if (returns) return mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : loopHats[aCounter];
                    storeEquip(mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : loopHats[aCounter], 0);
                } else {
                    if (returns) return mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : loopHats[aCounter];
                    storeEquip(mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : loopHats[aCounter], 0);
                }
            }
        }
    }
    if (returns) return 0;
}

function woah(mover) {
    storeEquip(mover && player.moveDir == undefined ? 0 : 11, 1);
}

const findPlacementAngle = (id, build) => {
    if (!build) return null;
    const item = items.list[player.items[id]];
    if (!item) return null;
    let closeAngles = autoPlace.closestPossibleAngles(build, id);
    if (closeAngles.length < 2) return null;
    if (!autoPlace.preplaceRanges[id]) autoPlace.calcPreplace(build, id);
    let clampRange = [autoPlace.normalizeArc(closeAngles[0], closeAngles[1])];
    autoPlace.debugRender[60] = clampRange;
    autoPlace.debugRender[80] = autoPlace.preplaceRanges[id];
    let preplaceRanges = autoPlace.intersectRanges(autoPlace.preplaceRanges[id], clampRange);
    autoPlace.debugRender[100] = preplaceRanges;
    if (!preplaceRanges.length) return null;
    if (near.inTrap) { // if enemy in trap
        if (build.sid != near.inTrap.sid) { //if enemy in trap and not preplacing the trap
            let trapAngle = UTILS.getDirect(near.inTrap, player, 0, 2);
            //id should be 2 and it tries to place spike near the trap
            return autoPlace.closeToAngle(trapAngle, preplaceRanges);
        } else if (id == 4) { //if preplacing the trap and retrapping
            //find a angle thats closest to a nearby spike and also can cause the near to stay in the trap. If nothing is gotten, go the the end of this function and just preplace directly on the trap.
            let spike = nearObjs.filter(obj => obj.dmg && obj.isTeamObject(player) && UTILS.getDist(obj, near.inTrap, 0, 0) <= near.inTrap.scale + obj.scale + 69).sort((a, b) => UTILS.getDist(a, near.inTrap, 0, 0) - UTILS.getDist(b, near.inTrap, 0, 0))[0];

            if (spike) { //only if there is a spike nearby
                let playerObject = {
                    x: near.x2,
                    y: near.y2,
                    getScale: function () {
                        return player.scale - item.scale;
                    }
                }
                let closeAngles = autoPlace.closestPossibleAngles(playerObject, id);
                if (closeAngles.length == 2) {
                    let retrapRange = [autoPlace.normalizeArc(closeAngles[0], closeAngles[1])];
                    let intersection = autoPlace.intersectRanges(preplaceRanges, retrapRange);
                    autoPlace.debugRender[120] = retrapRange;
                    autoPlace.debugRender[140] = intersection;
                    return autoPlace.closeToAngle(UTILS.getDirect(spike, player, 0, 2), intersection);
                }
            }
        }
    }
    let buildingAngle = UTILS.getDirect(build, player, 0, 2);
    //if no spike nearby, preplace as close as possible, if enemy not in trap, also come here, basically default place close to the preplacing building
    return autoPlace.closeToAngle(buildingAngle, preplaceRanges);
};
const preplacer = () => {
    if (near.dist2 > 269 || !configs.autoPrePlace) return;
    const replaceable = [];
    for (let i of nearObjs) {
        if (!i.isItem || UTILS.getDist(i, player, 0, 2) > 200 || (i.isTeamObject(player) && i.hideFromEnemy && !autoBreak.priority[1].includes(i))) continue;
        if (objectManager.canBeBroken(i)) {
            replaceable.push(i);
        }
    }
    let found = 0;
    replaceable.forEach((build) => {
        if (found > 2) return;
        let buildId = near.inTrap && !my.autoPush && ((options.autoPrePlace == "spike" && player.primaryReloaded) || build.sid != near.inTrap.sid) ? 2 : 4;
        let angle = findPlacementAngle(buildId, build);
        if (angle === null) return;
        scheduleAction(() => {
            place(buildId, angle, 1);
        }, 3)
        found++;
    });
};

let advHeal = [];

class Traps {
    constructor(UTILS, items) {
        this.replaced = true;
        this.antiTrapped = false;
        this.radObjs = [];
        this.preplaces = [[], []];
        this.testCanPlace = function (id, first = -(Math.PI / 2), repeat = (Math.PI / 2), plus = (Math.PI / 18), radian, loopAll, noOverlap, special) { //id, first, repeat, plus, radian, loopAll, noOverlap, special
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
                        blocker: p.blocker,
                        scale: p.scale,
                        isItem: p.isItem,
                        type: p.type,
                        colDiv: p.colDiv,
                        getScale: function (sM = 1, ig) {
                            return this.scale * ((this.isItem || this.type == 2 || this.type == 3 || this.type == 4)
                                ? 1 : (0.6 * sM)) * (ig ? 1 : this.colDiv);
                        },
                    });
                });
                for (let i = first; (loopAll ? i <= repeat : i < repeat); i += plus) {
                    counts.attempts++;
                    let relAim = radian + i;
                    let tmpX = player.x2 + tmpS * Math.cos(relAim);
                    let tmpY = player.y2 + tmpS * Math.sin(relAim);
                    let cantPlace = tmpObjects.find((tmp) => UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) < item.scale + (tmp.blocker ? tmp.blocker : tmp.getScale(0.6, tmp.isItem)));
                    if (cantPlace) continue;
                    if (item.id != 18 && tmpY >= config.mapScale / 2 - config.riverWidth / 2 && tmpY <= config.mapScale / 2 + config.riverWidth / 2) continue;
                    place(id, relAim, 0, tmpX, tmpY);
                    counts.placed++;
                    if (noOverlap) {
                        tmpObjects.push({
                            x: tmpX,
                            y: tmpY,
                            blocker: item.blocker,
                            scale: item.scale,
                            isItem: true,
                            type: null,
                            colDiv: item.colDiv,
                            getScale: function (sM = 1, ig) {
                                return this.scale * ((this.isItem || this.type == 2 || this.type == 3 || this.type == 4)
                                    ? 1 : (0.6 * sM)) * (ig ? 1 : this.colDiv);
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
                    if (counts.placed > 0) {
                        if ([1, 2].includes(special) && item.dmg) {
                            if (UTILS.getDist(near, { x: tmpX, y: tmpY }, 2, 0) < player.scale + item.scale && configs.spikeTick) {
                                instaC.canSpikeTick = true;
                            }
                        }
                        if (special == 2 && item.dmg && counts.placed >= 8 && targetPlayer.isTeam(player)) {
                            if (player.isLeader) {
                                packet("Q", targetPlayer.sid)
                            } else {
                                packet("N")
                            }
                        }
                        if (special == 3) {
                            //not working yet
                            autoBreak.priority[2].push({ x: tmpX, y: tmpY, scale: 45, health: 200 });
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
                colDiv: item.colDiv,
                //this function mainly for spike/cactus stuff to decrease checks or maybe this is bad for optimisation cuz its not used much?
                getScale: function (sM, ig) { //im keeping the sM here cuz to decrease confusion otherwise doing .getScale(0.6, .isItem) somewhere and .getScale(.isItem) at other places is confusing
                    return this.scale * (ig ? 1 : this.colDiv);
                },
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
        this.checkSpikeTick = function () {
            if (!configs.safeAntiSpikeTick || !enemy.length) return false;

            if (near.dist2 <= 200) {
                if (player.escaped || (player.inTrap && objectManager.canBeBroken(player.inTrap))) {
                    if (player.escaped) my.anti0Tick = 2;
                    let damage = [13, 15].includes(near.secondaryIndex) ? 35 : 45;
                    if (!([9, 12, 13, 15].includes(near.secondaryIndex) && near.secondaryReloaded)) {
                        player.addDamageThreat("spike", damage);
                    }
                    player.chat.message = `Break trap tick detected by ${near.sid} ${near.name}`;
                    player.chat.count = 223;
                    game.tickBase(() => {
                        if (!([9, 12, 13, 15].includes(near.secondaryIndex) && near.secondaryReloaded)) {
                            player.addDamageThreat("spike", damage);
                        }
                    }, 1)
                }
            }
            if (near.dist2 <= 200) {
                if (!player.inTrap) {
                    if (near.primaryReloaded) {
                        let spikeSet = new Set(); // Track unique spike sids
                        for (let tmp of nearObjs) {
                            if ((tmp.dmg && tmp.active && !tmp.isTeamObject(player)) || (tmp.type == 1 && tmp.y >= 12000)) {
                                let nea = Math.atan2(player.y2 - near.y2, player.x2 - near.x2);
                                let primaryKB = (items.weapons[near.weapons[0]].knock || 0) * items.weapons[near.weapons[0]].range + player.scale * 2;
                                let secondaryKB = ![undefined, 9, 12, 13, 15].includes(near.weapons[1]) ? (items.weapons[near.weapons[1]].knock || 0) * items.weapons[near.weapons[1]].range + player.scale * 2 : 60;
                                let turretKB = 50;

                                let totalKB = primaryKB + secondaryKB + turretKB;
                                let steps = 24
                                let stepKB = totalKB / steps
                                let skipDistance = 35;

                                for (let i = 1; i <= steps; i++) {
                                    let traveledDist = stepKB * i;
                                    if (traveledDist < skipDistance) continue;

                                    let stepX = player.x2 + (stepKB * i) * Math.cos(nea);
                                    let stepY = player.y2 + (stepKB * i) * Math.sin(nea);

                                    kbIndc.mex = stepX;
                                    kbIndc.mey = stepY;

                                    let distToSpike = UTILS.getDist({ x: stepX, y: stepY }, tmp, 0, 0);

                                    if (distToSpike <= (tmp.getScale() + player.scale * 1.5)) {
                                        spikeSet.add(tmp.sid);
                                    }
                                }
                            }
                        }
                        if (spikeSet.size) {
                            spikeSet.forEach(sid => {
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
        };
        this.protect = function (aim) {
            if (!configs.antiTrap) return;
            this.testCanPlace(4, -(Math.PI / 2), (Math.PI / 2), (Math.PI / 3), aim + Math.PI, true);
            this.testCanPlace(2, -(Math.PI / 3), (Math.PI / 3), (Math.PI / 3), aim + Math.PI, true);
            this.antiTrapped = true;
        };

        this.autoPlace = function (type, id, id2, reasonhaha) {
            if (!enemy.length) return;
            if (!configs.autoPlace) return;

            if (type == 0) {
                // id only

                if (id == undefined) return;

                let itemId = player.items[id];
                if (itemId == undefined) return;

                let item = items.list[itemId];

                let itemId2 = id2 == undefined ? null : player.items[id2];
                let item2 = itemId2 == undefined ? null : items.list[itemId2];

                this.radObjs = nearObjs;
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
                    for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
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

                this.radObjs = nearObjs.filter(obj => {
                    if (obj.isTeamObject(player)) {
                        if ((id == 4 ? obj.dmg : obj.trap) /* && obj.isTeamObject(player)*/) {
                            let dist = UTILS.getDist(obj, near, 0, 2);
                            if (dist < 500) {
                                return true;
                            }
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
                if (reasonhaha) {
                    this.autoPlace(type, id2, id, false);
                } else {
                    if (type == 1 && this.preplaces[1].length < 1) {
                        this.autoPlace(0, id2, id);
                    }
                }
            }
        };
        this.autoReplace = function (building) {
            if (!enemy.length || near.dist2 > 300 || !configs.autoReplace || this.replaced || configs.weaponGrind) return;
            game.tickBase(() => {
                let breakDist = UTILS.getDist(building, player, 0, 2)
                if (breakDist > 300) return;
                if (!autoPlace.rangesUpdated[2]) autoPlace.angleRanges(2);
                if (!autoPlace.rangesUpdated[4]) autoPlace.angleRanges(4);
                let breakDir = UTILS.getDirect(building, player, 0, 2);
                let sid = building.sid;
                this.replaced = true;
                if (near.escaped) {
                    if (sid == near.lastTrap.sid && [4, 5].includes(player.weapons[0]) && player.primaryReloaded && !my.autoPush) {
                        return this.testCanPlace(2, -Math.PI / 3, Math.PI / 3, Math.PI / 7.5, near.aim2, true, false, 1)
                    } else {
                        checkPlace(4, near.aim2)
                        checkPlace(4, near.aim2 + Math.PI / 12)
                        checkPlace(4, near.aim2 - Math.PI / 12)
                        place(4, autoPlace.closeToAngle(near.aim2, autoPlace.ranges[4]));
                        // this.testCanPlace(4, near.aim2 - Math.PI/12, near.aim2 + Math.PI/12, Math.PI/12, near.aim2, 1);
                        return;
                    }
                }
                if (near.inTrap && UTILS.getDist(player, near.inTrap, 0, 0) <= 169) {
                    return place(2, autoPlace.closeToAngle(UTILS.getDirect(near.inTrap, player, 0, 2), autoPlace.ranges[2]));
                }
                if (player.escaped && sid == player.lastTrap.sid) {
                    return this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 4, UTILS.randFloat(0, Math.PI * 2), true, false, 1);
                }
                this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 4, breakDir, true, true, 1);
            }, 1);

        };
    }
};

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
    }
    closestPossibleAngles(obj, id) {
        /* the obj given must have the following:
        {
            x: number,
            y: number,
            getScale: function(sM = 1, ig) { return number; } //number is the radius of the item
        }
        */
        let itemId = player.items[id];
        if (itemId == undefined) return;
        let item = items.list[itemId];

        let x = player.x2;
        let y = player.y2;

        let objX = obj.x;
        let objY = obj.y;
        let objScale = obj.getScale(0.6, obj.isItem) + 0.01; //a bit more cuz hitboxes cannot intersect at all I believe and also some rounding stuff when game gives us coords.

        let dx = objX - x;
        let dy = objY - y;

        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > player.scale + objScale + 2 * item.scale + item.placeOffset) {//if object so far away that it wont affect anything, return angle to object
            return [UTILS.getDirection(objX, objY, x, y)];
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

    normalizeAngle(a) {
        const twoPi = Math.PI * 2;
        if (a < 0) a += twoPi;
        if (a > twoPi) a -= twoPi;
        return a;
    }
    normalizeArc(start, end) {
        const twoPi = Math.PI * 2;

        // normalize both
        let s = this.normalizeAngle(start);
        let e = this.normalizeAngle(end);

        // compute original clockwise span BEFORE normalization
        let origSpan = (end - start + twoPi) % twoPi;

        // compute new clockwise span AFTER normalization
        let newSpan = (e - s + twoPi) % twoPi;

        // if direction flipped, swap
        if (Math.abs(origSpan - newSpan) > 0.000001) {
            return [e, s];
        }

        return [s, e];
    }

    mergeBlocked(arcs) {
        const twoPi = Math.PI * 2;
        let intervals = [];
        for (let [s, e] of arcs) {
            s = this.normalizeAngle(s);
            e = this.normalizeAngle(e);
            let span = (e - s + twoPi) % twoPi;
            if (span < 0.000001) {
                intervals.push([s, s]);
            } else if (s < e) {
                intervals.push([s, e]);
            } else {
                intervals.push([s, twoPi], [0, e]);
            }
        }
        if (!intervals.length) {
            return [];
        }
        intervals.sort((a, b) => a[0] - b[0]);
        let merged = [intervals[0].slice()];
        for (let i = 1; i < intervals.length; i++) {
            let [s, e] = intervals[i];
            let last = merged[merged.length - 1];
            if (s <= last[1] + 0.000001) {
                last[1] = Math.max(last[1], e);
            } else {
                merged.push([s, e]);
            }
        }
        if (merged.length === 1 && merged[0][0] <= 0.000001 && merged[0][1] >= twoPi - 0.000001) {
            return [[0, twoPi]];
        }
        return merged;
    }
    invertArcs(merged) {
        const twoPi = Math.PI * 2;
        if (merged.length === 0) {
            return [[0, twoPi]];
        }
        let free = [];
        for (let i = 0; i < merged.length; i++) {
            let [s1, e1] = merged[i];
            let gapStart = e1;
            let gapEnd = i < merged.length - 1 ? merged[i + 1][0] : merged[0][0] + twoPi;
            if (gapEnd - gapStart > 0.000001) {
                free.push([this.normalizeAngle(gapStart), this.normalizeAngle(gapEnd)]);
            }
        }
        return free;
    }

    angleRanges(id, additionalObjs = []) {
        const itemId = player.items[id];
        if (itemId == null) return;
        const item = items.list[itemId];
        let rawBlocked = [];
        for (let i = 0; i < nearObjs.length + additionalObjs.length; i++) {
            let obj = i < nearObjs.length ? nearObjs[i] : additionalObjs[i - nearObjs.length];
            if (UTILS.getDist(obj, player, 0, 2) > 200) continue;
            let angles = this.closestPossibleAngles(obj, id);
            if (angles.length != 2) {
                continue;
            }
            let a1 = angles[0];
            let a2 = angles[1];
            const offset = player.scale + item.scale + (item.placeOffset || 0);
            const buildAngle = UTILS.getDirect(obj, player, 0, 2);
            const v1 = objectManager.checkItemLocation(player.x2 + offset * Math.cos(a1), player.y2 + offset * Math.sin(a1), item.scale, 0.6, id, false);
            const v2 = objectManager.checkItemLocation(player.x2 + offset * Math.cos(a2), player.y2 + offset * Math.sin(a2), item.scale, 0.6, id, false)
            if (v1 && v2) {
                rawBlocked.push([a1, a2]);
            } else if (v1 || v2) {
                const valid = v1 ? a1 : a2;
                const invalid = v1 ? a2 : a1;
                const cw = (buildAngle - valid + Math.PI * 2) % (Math.PI * 2) < (invalid - valid + Math.PI * 2) % (Math.PI * 2);
                if (cw) {
                    rawBlocked.push([valid, invalid]);
                } else {
                    rawBlocked.push([invalid, valid]);
                }
            } else {
                rawBlocked.push([a1, a2]);
            }
        }
        this.ranges[id] = this.invertArcs(this.mergeBlocked(rawBlocked));
        this.rangesUpdated[id] = true;
    }

    calcPreplace(preplaceObject, id) {
        const itemId = player.items[id];
        if (itemId == null) return;
        const item = items.list[itemId];

        let rawBlocked = [];
        for (let obj of nearObjs) {
            if (UTILS.getDist(obj, player, 0, 3) > 200) continue;
            if (obj.sid == preplaceObject.sid) continue;
            let angles = this.closestPossibleAngles(obj, id);
            if (angles.length != 2) {
                continue;
            }
            let a1 = angles[0];
            let a2 = angles[1];
            const offset = player.scale + item.scale + (item.placeOffset || 0);
            const buildAngle = UTILS.getDirect(obj, player, 0, 2);
            const v1 = objectManager.preplaceCheck(player.x3 + offset * Math.cos(a1), player.y3 + offset * Math.sin(a1), item.scale, 0.6, id, false, preplaceObject);
            const v2 = objectManager.preplaceCheck(player.x3 + offset * Math.cos(a2), player.y3 + offset * Math.sin(a2), item.scale, 0.6, id, false, preplaceObject);
            if (v1 && v2) {
                rawBlocked.push([a1, a2]);
            } else if (v1 || v2) {
                const valid = v1 ? a1 : a2;
                const invalid = v1 ? a2 : a1;
                const cw = (buildAngle - valid + Math.PI * 2) % (Math.PI * 2) < (invalid - valid + Math.PI * 2) % (Math.PI * 2);
                if (cw) {
                    rawBlocked.push([valid, invalid]);
                } else {
                    rawBlocked.push([invalid, valid]);
                }
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
        angle = this.normalizeAngle(angle);
        let bestAngle = null;
        let bestDist = Infinity;

        for (let [start, end] of ranges) {
            if (this.angleInArc(angle, start, end)) {
                return angle;
            } else {
                for (let ang of [start, end]) {
                    let dist = UTILS.getAngleDist(ang, angle);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestAngle = ang;
                    }
                }
            }
        }

        if (bestAngle !== null) {
            return bestAngle;
        }
    }

    intersectRanges(range1, range2) {
        const TWO_PI = Math.PI * 2;
        let result = [];

        // Helper: split a possibly-wrapping arc into non-wrapping parts
        const split = ([s, e]) => {
            if (s <= e) {
                return [[s, e]];
            } else {
                return [
                    [s, TWO_PI],
                    [0, e]
                ];
            }
        };

        for (let r1 of range1) {
            let parts1 = split(r1);

            for (let r2 of range2) {
                let parts2 = split(r2);

                for (let [a1, b1] of parts1) {
                    for (let [a2, b2] of parts2) {
                        let start = Math.max(a1, a2);
                        let end = Math.min(b1, b2);

                        if (start < end) {
                            result.push([start, end]);
                        }
                    }
                }
            }
        }

        return result;
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
        let centX = Math.round(player.x3) - (PF.scale / 2);
        let centY = Math.round(player.y3) - (PF.scale / 2);
        let griScale = PF.scale / PF.gridSize;

        let overScale = [griScale - 10, griScale + 10];
        let overPos = [player.scale, config.mapScale - player.scale];

        let reEScale = reFind ? overScale[0] : griScale;

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
                    if (dist <= near.scale + player.scale) {
                        this.grid[i][i2] = 1;
                        continue;
                    }

                    let some = nearObjs.some(obj => {
                        if (!obj.isTeamObject(player) && (obj.dmg || obj.trap)) { //if its a trap or spike in enemy team, avoid them
                            return UTILS.getDist(pos, obj, 0, 0) <= obj.getScale(0.6, obj.isItem) + player.scale;
                        } else {
                            if (!obj.ignoreCollision || obj.name == "teleporter") { //if they not trap or spike in enemy team and u can collide with them, or if they are teleporter, avoid them
                                return UTILS.getDist(pos, obj, 0, 0) <= obj.getScale(0.6, obj.isItem) + player.scale;
                            }
                        }
                        return false
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

                    let some = nearObjs.some(obj => {
                        if (!obj.isTeamObject(player) && (obj.dmg || obj.trap)) { //if its a trap or spike in enemy team, avoid them
                            return UTILS.getDist(pos, obj, 0, 0) <= obj.getScale(0.6, obj.isItem) + player.scale;
                        } else {
                            if (!obj.ignoreCollision || obj.name == "teleporter") { //if they not trap or spike in enemy team and u can collide with them, or if they are teleporter, avoid them
                                return UTILS.getDist(pos, obj, 0, 0) <= obj.getScale(0.6, obj.isItem) + player.scale;
                            }
                            return false
                        }
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

        if (this.grid[start.y][start.x] == 1 || this.grid[goal.y][goal.x] == 1) {
            return { paths: [], attempts: 0 };
        }

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

        let foundPaths = [];
        let i = 0;
        let startTime = Date.now();
        while (Date.now() - startTime <= 5) {
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
            i++;
        }

        return {
            paths: foundPaths,
            attempts: i
        };
    };
};

function isPositionSafe(x, y, options = {}) {
    const {
        checkAllSpikes = false,        // false = only check own/ally spikes, true = check all spikes
        ownSpikeDistance = 83,         // Safe distance from own/ally spikes
        enemySpikeDistance = 103,      // Safe distance from enemy spikes
        checkEnemy = true,             // Whether to check enemy distance
        enemyDistance = 75,            // Safe distance from nearest enemy
    } = options;

    if (x < player.scale || x > config.mapScale - player.scale || y < player.scale || y > config.mapScale - player.scale) return false;

    for (let obj of nearObjs) {
        if (obj.trap || obj.dmg) continue;

        let requiredDistance = obj.scale + 35;
        let distance = UTILS.getDistance(x, y, obj.x, obj.y);

        if (distance < requiredDistance) {
            return false;
        }
    }

    // Get spikes based on filter mode (more strict check for spikes)
    let allSpikes = checkAllSpikes ? nearObjs.filter(object => object.dmg) : nearObjs.filter(object => object.dmg && object.isTeamObject(player));

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
        safetyOptions = {}  // Options to pass to isPositionSafe
    } = options;

    // Helper to get grid key
    const getKey = (x, y) => `${Math.round(x / gridSpacing) * gridSpacing},${Math.round(y / gridSpacing) * gridSpacing}`;

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
    let openSet = [{ x: startX, y: startY, g: 0, h: UTILS.getDistance(startX, startY, endX, endY), f: 0, parent: null }];
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

            let g = current.g + UTILS.getDistance(current.x, current.y, neighbor.x, neighbor.y);
            let h = UTILS.getDistance(neighbor.x, neighbor.y, endX, endY);
            let f = g + h;

            let existingNode = allNodes.get(neighborKey);
            if (!existingNode || g < existingNode.g) {
                let newNode = { x: neighbor.x, y: neighbor.y, g, h, f, parent: current };
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
class ShameSystem {
    constructor() {
        this.enemyShame = new Map();
        this.shameConfig = {
            enabled: true,
            triggerShame: 7,
            shamePerHit: 1,
            resetOnKill: true,
            resetOnEscape: true,
        };
    }

    getShameCount(enemy) {
        if (!enemy || !enemy.sid) return 0;
        if (!this.enemyShame.has(enemy.sid)) {
            this.enemyShame.set(enemy.sid, 0);
        }
        return this.enemyShame.get(enemy.sid);
    }

    addShame(enemy, amount) {
        if (!enemy || !enemy.sid) return;
        if (!configs.shameGrindEnabled) return;

        let currentShame = this.getShameCount(enemy);
        currentShame += (amount || this.shameConfig.shamePerHit);
        this.enemyShame.set(enemy.sid, currentShame);
        console.log(`[Shame] ${enemy.name} shame: ${currentShame}/${this.shameConfig.triggerShame}`);
    }

    resetShame(enemy) {
        if (!enemy || !enemy.sid) return;
        this.enemyShame.delete(enemy.sid);
        console.log(`[Shame] Reset shame for ${enemy.name}`);
    }

    resetAllShame() {
        this.enemyShame.clear();
    }

    displayShame(enemy) {
        return this.getShameCount(enemy);
    }
}



// ============================================================================
// COMPLETE INSTAKILL CLASS
// ============================================================================

class Instakill {
    constructor() {
        this.wait = false;
        this.can = false;
        this.isTrue = false;
        this.nobull = false;
        this.ticking = false;
        this.canSpikeTick = false;
        this.canMusketSync = false;
        this.startTick = false;
        this.readyTick = false;
        this.canCounter = false;
        this.revTick = false;
        this.syncHit = false;
        this.goTickThem = false;
        this.shame = new ShameSystem();
        this.autoOneTickCdUntil = 0;
        this.lastTarget = null;
    }

    // ===== SHAME SYSTEM METHODS =====

    shamegrindRetrap(enemy) {
        if (!enemy || !this.shame.shameConfig.enabled) return;
        if (!near.inTrap || near.inTrap.sid !== enemy.sid) return;

        // Check if hammer (weapon 10) is available
        let hasHammer = player.weapons[0] === 10 || player.weapons[1] === 10;
        if (!hasHammer) return;

        this.isTrue = true;
        my.autoAim = true;

        // Select hammer (prioritize secondary)
        selectWeapon(player.weapons[1] === 10 ? player.weapons[1] : player.weapons[0]);
        packet("9", near.aim2, 1);

        // ONLY INCREMENT SHAME - DON'T TRIGGER SPIKETICK HERE
        this.shame.addShame(enemy, this.shame.shameConfig.shamePerHit);

        game.tickBase(() => {
            this.isTrue = false;
            my.autoAim = false;
        }, 1);
    }

    checkShameAndTick(enemy) {
        if (!enemy || !this.shame.shameConfig.enabled) return false;
        const shameCount = this.shame.getShameCount(enemy);
        if (shameCount >= this.shame.shameConfig.triggerShame) {
            return true;
        }
        return false;
    }

    changeType = function (type) {
            this.wait = false;
            this.isTrue = true;
            my.autoAim = true;
            if (type == "rev") {
                selectWeapon(player.weapons[1]);
                storeEquip(53, 0);
                if (!my.autoGathering) sendAutoGather();
                game.tickBase(() => {
                    selectWeapon(player.weapons[0]);
                    if (near.dist2 <= 120 && configs.doSpikeOnReverse) place(2, near.aim2);
                    storeEquip(7, 0);
                    game.tickBase(() => {
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 1);
            } else if (type == "nobull") {
                selectWeapon(player.weapons[0]);
                storeEquip(6, 0);
                if (!my.autoGathering) sendAutoGather();
                game.tickBase(() => {
                    storeEquip((player.reloads[53] == 0 && near.skinIndex != 22) ? 53 : 6, 0);
                    selectWeapon(player.weapons[1]);
                    game.tickBase(() => {
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 1);
            } else if (type == "normal") {
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
                }, 1);
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
       spikeTickType = function (type) {
            this.isTrue = true;
            my.autoAim = true;
            selectWeapon(player.weapons[0])
            if (type == "rev" && player.reloads[53] == 0) {
                storeEquip(53, 0);
                game.tickBase(() => {
                    storeEquip(7, 0);
                    if (!my.autoGathering) sendAutoGather();
                    game.tickBase(() => {
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1)
                }, 1)
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
        counterType = function () {
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
        rangeType = function (type) {
            this.isTrue = true;
            my.aimTarget = true;
            if (type == "ageInsta") {
                my.ageInsta = false;
                if (player.items[5] == 18) {
                    traps.testCanPlace(5, 0, Math.PI * 2, Math.PI / 3, near.aim2, true);
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
                if (player.reloads[53] == 0 && near.dist2 <= 700 && near.skinIndex != 22) {
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
        musketSync = function () {
            if (player.weapons[1] != 15) return;
            this.isTrue = true;
            my.autoAim = true;
            if (player.items[5] == 18) traps.testCanPlace(5, 0, Math.PI * 2, Math.PI / 3, near.aim2, true);
            storeEquip(53, 0) //equip earlier cuz turret is slower but I dont think this will sync
            selectWeapon(player.weapons[1])
            if (!my.autoGathering) sendAutoGather();
            game.tickBase(() => {
                this.isTrue = false;
                my.autoAim = false;
            }, 1);
        };
 autoOneTickType() {
        try {
            const canKill = () => {
                if (!near || !player.weapons[0] || player.reloads[player.weapons[0]] != 0) return false;
                const primaryWeapon = items.weapons[player.weapons[0]];
                if (!primaryWeapon) return false;
                const variant = player[(player.weapons[0] < 9 ? "prima" : "seconda") + "ryVariant"];
                const variantDmg = variant != undefined ? config.weaponVariants[variant].val : 1.18;
                const damage = primaryWeapon.dmg * variantDmg * 1.5 * (near.skinIndex == 6 ? 0.75 : 1) + (near.skinIndex == 6 ? 19 : 25);

                const distToEnemy = near.dist2 !== undefined ? near.dist2 : UTILS.getDist(player, near, 0, 2);
                const weaponRange = primaryWeapon.range + near.scale * 1.8;
                if (distToEnemy > weaponRange) return false;

                return near.health <= damage;
            };

            const canStart =
                !this.isTrue &&
                configs.autoOneTick &&
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
            if (this.autoOneTickCdUntil && now < this.autoOneTickCdUntil) return;

            const finalDistCheck = near.dist2 !== undefined ? near.dist2 : UTILS.getDist(player, near, 0, 2);
            const weaponRange = items.weapons[player.weapons[0]].range + near.scale * 1.8;

            if (finalDistCheck > weaponRange) {
                packet("9", near.aim2, 1);
                return;
            }

            this.autoOneTickCdUntil = now + (traps.inTrap ? 1500 : 5000);
            if (typeof notif === "function") notif("One Tick");
            if (typeof this.setInstaType === "function") this.setInstaType("One Tick");
            this.lastTarget = near?.name || "Unknown";

            this.isTrue = true;
            my.autoAim = true;
            selectWeapon(
                player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0],
            );
            storeEquip(11, 1);
            packet("9", near?.aim2, 1);
            game.tickBase(() => {
                selectWeapon(
                    player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0],
                );
                storeEquip(53, 0);
                storeEquip(11, 1);
                packet("9", near?.aim2, 1);
                game.tickBase(() => {
                    selectWeapon(player.weapons[0]);
                    storeEquip(7, 0);
                    storeEquip(19, 1);
                    if (!my.autoGathering) sendAutoGather();
                    packet("9", near?.aim2, 1);
                    game.tickBase(() => {
                        this.isTrue = false;
                        my.autoAim = false;
                        packet("9", undefined, 1);
                    }, 1);
                }, 1);
            }, 1);
        } catch (err) {
            console.log("Auto One Tick Error:", err);
            this.isTrue = false;
            my.autoAim = false;
            packet("9", undefined, 1);
        }
    }

    primaryKillType() {
        const canKillWithPrimary = () => {
            if (!near || player.reloads[player.weapons[0]] != 0) return false;
            const primaryWeapon = items.weapons[player.weapons[0]];
            const variant = player[(player.weapons[0] < 9 ? "prima" : "seconda") + "ryVariant"];
            const variantDmg = variant != undefined ? config.weaponVariants[variant].val : 1.18;
            const primaryDamage = primaryWeapon.dmg * variantDmg * 1.5;
            return near.dist2 <= primaryWeapon.range && near.health <= primaryDamage;
        };

        const canKillWithTurret = () => {
            if (!near || player.reloads[53] != 0) return false;
            const turretDamage = near.skinIndex === 6 ? 19 : 25;
            return near.dist2 <= 700 && near.health <= turretDamage;
        };

        if (canKillWithPrimary()) {
            this.threeOneTickType();
        } else if (canKillWithTurret()) {
            storeEquip(53, 0);
        }
    }

    oneTickType() {
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
    }

    threeOneTickType() {
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
    }

    newTickType() {
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
    }

    boostTickType() {
        this.isTrue = true;
        my.aimTarget = true;

        let aimAngle = targetPlayer?.aim2;
        let boostAngle = targetPlayer?.aim2;

        if (targetPlayer && targetPlayer.visible) {
            const velX = targetPlayer.x2 - targetPlayer.x;
            const velY = targetPlayer.y2 - targetPlayer.y;
            const enemySpeed = Math.hypot(velX, velY);

            if (enemySpeed > 0.1) {
                let weapon = items.weapons[player.weapons[1]];
                let projectileSpeed = weapon ? (weapon.projSpd || weapon.speed || 500) : 500;

                const currentDist = Math.hypot(targetPlayer.x2 - player.x2, targetPlayer.y2 - player.y2);
                const timeToHit = currentDist / projectileSpeed;

                const predX = targetPlayer.x2 + velX * timeToHit * 50;
                const predY = targetPlayer.y2 + velY * timeToHit * 50;

                aimAngle = Math.atan2(targetPlayer.y2 - player.y2, targetPlayer.x2 - player.x2);

                const distToEnemy = Math.hypot(targetPlayer.x2 - player.x2, targetPlayer.y2 - player.y2);
                const boostDistance = Math.min(distToEnemy * 0.6, 100);

                const enemyAngle = Math.atan2(targetPlayer.y2 - player.y2, targetPlayer.x2 - player.x2);
                const boostX = player.x2 + Math.cos(enemyAngle) * boostDistance;
                const boostY = player.y2 + Math.sin(enemyAngle) * boostDistance;

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
            place(4, boostAngle);
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
    }

    gotoGoal(goto, OT) {
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
        let bQ = (wwww, awwwh) => {
            if (player.inWater && awwwh == 0) {
                storeEquip(31, 0);
            } else {
                storeEquip(wwww, awwwh);
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
    }

    bowMovement() {
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

    tickMovement() {
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
    }

    newTickMovement() {
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
                this.newTickType();
            } else {
                packet("9", moveMent.dir, 1);
            }
        } else {
            packet("9", moveMent.dir, 1);
        }
    }

    boostTickMovement() {
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
    }

    perfCheck(pl, nr) {
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
                }, 1)
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
let aiManager = new AiManager(ais, AI, players, items, objectManager, config, UTILS);
let textManager = new Textmanager();

let traps = new Traps(UTILS, items);
let autoBreak = new AutoBreaker();
let autoPlace = new AutoPlacer();
let instaC = new Instakill();
        let autoBuy = new Autobuy([[11, 1], [40, 0], [6, 0], [7, 0], [21, 1], [13, 1],[31, 0], [15, 0], [19, 1], [22, 0], [53, 0], [12, 0], [20, 0], [10, 0], [56, 0], [11, 0], [26, 0], [18, 1], [13, 1]])
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
        workerSetTimeout(() => {
            packet("6", message);
            lastSendTime = Date.now();
            singCooldown = Date.now() + 2000;
        }, 569 - Date.now() + lastSendTime);
    }
}

function checkProjectileHolder(x, y, dir, range, speed, indx, layer, sid) {
    let weaponIndx = indx == 0 ? 9 : indx == 2 ? 12 : indx == 3 ? 13 : indx == 5 && 15;
    let projOffset = player.scale * 2;
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
        }
        antiProj(nearPlayer, dir, range, speed, indx, weaponIndx);
    } else {
        let nearTurret = nearObjs.filter((e) => UTILS.getDist(projXY, e, 0, 0) <= e.scale).sort((a, b) => {
            return UTILS.getDist(projXY, a, 0, 0) - UTILS.getDist(projXY, b, 0, 0);
        })[0];
    }
}
let musketCount = 0;
let projectile = {
    count: 0,
    dmg: 0
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
                    projectile.count--
                    projectile.dmg -= items.projectiles[index].dmg;
                }
            }, range / speed);
            if (tmpObj.bowThreat[9] >= 1 || (tmpObj.bowThreat[12] >= 1)) {
                checkPlace(3, tmpObj.aim2);
                checkPlace(1, tmpObj.aim2);
                my.anti0Tick = 4;
                player.chat.message = `anti bow insta by ${tmpObj.sid} ${tmpObj.name}`;
                player.chat.count = 445;
                predictHeal(1);
            } else {
                if (musketCount >= 2 || projectile.count >= 4) {
                    if (player.weapons[1] == 11) {
                        selectWeapon(player.weapons[1])
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
            /*if (keys[16]) {
                agentTarget = mousePos;
                testRender = agentTarget;
            }*/
            clicks.left = true;
        } else if (e.button == 1) {
            if (keys[16]) {
                let old = targetPlayer?.sid;
                targetPlayer = players.filter(tmp => tmp.visible && tmp.sid != player.sid).sort((a, b) => UTILS.getDist(mousePos, a, 0, 2) - UTILS.getDist(mousePos, b, 0, 2))[0];
                if (targetPlayer?.sid == old) {
                    targetPlayer = undefined;
                }
            } else {
                clicks.middle = true;
            }
        } else if (e.button == 2) {
            clicks.right = true;
        }
    }
}
touchCountrols.addEventListener("mouseup", UTILS.checkTrusted(mouseUp));

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
touchCountrols.addEventListener("wheel", wheel, false);

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

function isNearPlayer() {
    return near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8;
}

let mousePos = {};

function getMouseWorldPos() {
    const rect = gameCanvas.getBoundingClientRect();

    // 1. Mouse → canvas pixels (DPI safe)
    const canvasX =
        (mouseX - rect.left) * (gameCanvas.width / rect.width);
    const canvasY =
        (mouseY - rect.top) * (gameCanvas.height / rect.height);

    // 2. Same transform values used in resize()
    const scaleFillNative =
        Math.max(
            screenWidth / maxScreenWidth,
            screenHeight / maxScreenHeight
        ) * pixelDensity;

    const tx = (screenWidth * pixelDensity - maxScreenWidth * scaleFillNative) / 2;
    const ty = (screenHeight * pixelDensity - maxScreenHeight * scaleFillNative) / 2;

    // 3. Invert transform
    const localX = (canvasX - tx) / scaleFillNative;
    const localY = (canvasY - ty) / scaleFillNative;

    // 4. Camera-centered → world
    mousePos = {
        x: camX + localX - maxScreenWidth / 2,
        y: camY + localY - maxScreenHeight / 2
    };
}



function getSafeDir() {// THANK U BRT
    if (!player) return 0;
    if (!player.lockDir) {
        return UTILS.getDirect(mousePos, player, 0, 0); //use player rendered coordinates which is x, y instead of x2, y2 which is tick coordinates to be accurate with render
    }
    return lastDir || 0;
}

function getAttackDir() {
    if (!player) return 0;
    if (my.aimTarget && targetPlayer) {
        lastDir = targetPlayer.aim2;
    } else if (my.autoAim) {
        lastDir = configs.weaponGrind ? getSafeDir() : enemy.length ? my.revAim ? (near.aim2 + Math.PI) : near.aim2 : getSafeDir();
    } else if (isNearPlayer && clicks.left) {
        lastDir = enemy.length && near.dist2 <= items.weapons[player.weaponIndex].range + player.scale * 2 ? near.aim2 : getSafeDir();
    } else if (clicks.right) {
        lastDir = getSafeDir();
    } else if (autoBreak.active && player[(autoBreak.useHammer(autoBreak.target) ? "secondary" : "primary") + "Reloaded"]) {
        lastDir = autoBreak.aim;
    } else if (!player.lockDir) {
        if (configs.renderDir && options.renderDir == "noDir") return undefined;
        lastDir = getSafeDir();
    }
    return lastDir || 0;
}

function getVisualDir() {
    if (!player) return 0;
    if (my.aimTarget && targetPlayer) {
        lastDir = targetPlayer.aim2;
    } else if (my.autoAim) {
        lastDir = configs.weaponGrind ? getSafeDir() : enemy.length ? my.revAim ? (near.aim2 + Math.PI) : near.aim2 : getSafeDir();
    } else if (isNearPlayer && clicks.left) {
        lastDir = enemy.length && near.dist2 <= items.weapons[player.weaponIndex].range + player.scale * 2 ? near.aim2 : getSafeDir();
    } else if (clicks.right) {
        lastDir = getSafeDir();
    } else if (autoBreak.active && player[(autoBreak.useHammer(autoBreak.target) ? "secondary" : "primary") + "Reloaded"]) {
        lastDir = autoBreak.aim;
    } else if (!player.lockDir) {
        lastDir = getSafeDir();
    }
    return lastDir || 0;
}

// KEYS:
function keysActive() {
    return (allianceMenu.style.display != "block" && !menuCBFocus);
}

let commands = {
    "help": ["Show Commands",
        function () {
            for (let cmds in commands) {
                ChText("/" + cmds, commands[cmds][0], "lime", 1);
            }
        }
    ],
    "clear": [
        "Clear Chats",
        function () {
            resetMenuChText();
        }
    ],
    "debug": [
        "Debug Mod For Development",
        function () {
            addDeadPlayer(player);
            ChText("Debug", "Done", "#99ee99", 1);
        }
    ],
    "play": [
        "Play Music ( /play [link] )",
        function (message) {
            let link = message.split(" ");
            if (link[1]) {
                let audio = new Audio(link[1]);
                audio.play();
            } else {
                ChText("Warn", "Enter Link ( /play [link] )", "#99ee99", 1);
            }
        }
    ],
    "bye": [
        "Leave Game",
        function () {
            window.leave();
        }
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
    "Escape": () => {
        let menu = document.getElementById('modmenus');
        if (menu.classList.contains('open')) {
            menu.classList.add('closed');
            menu.classList.remove('open');
            workerSetTimeout(() => {
                menu.style.display = 'none';
            }, 400);
        } else {
            menu.classList.add('open');
            menu.classList.remove('closed');
            menu.style.display = 'block';
            workerSetTimeout(() => {
                document.getElementById('modmenus-sidebar').style.opacity = 1;
            }, 400);
        }
    },
    "c": () => { // c key
        updateMapMarker();
    },
    "e": () => { // e key
        sendAutoGather(1);
    },
    "q": () => { // q key
        selectWeapon(player.weaponCode);
    },
    "m": () => { // m key
        mills.placeSpawnPads = !mills.placeSpawnPads;
        if (mills.placeSpawnPads) {
            traps.testCanPlace(player.getItemType(20), 0, Math.PI * 1.5, Math.PI / 2, getMoveDir() || 0, true)
            mills.old = {
                x: player.x2,
                y: player.y2
            }
        }
    },
    "z": () => { // z key
        mills.place = !mills.place;
    },
    "x": () => { // x key
        player.lockDir = !player.lockDir;
    },
    "Z": () => { // capital Z key
        window.debug();
    },
    " ": () => { // space key
        packet("F", 1, getSafeDir(), 1);
        packet("F", 0, getSafeDir(), 1);
    },
    ",": () => { // , key
        player.sync = true;
        //sendChat(getEl("testInput2").value);
    },
    "Shift": () => { // shift key
        workerClearTimeout(debugTimeout);
        debugStop = true;
        debugTimeout = workerSetTimeout(() => {
            debugStop = false;
        }, 5000);
    },
    "r": () => { // r key
        instaC.wait = !instaC.wait;
        if (!configs.allowPing) packet("S", 1);
    },
    "l": () => { // l key
        if (!targetPlayer?.visible) {
            targetPlayer = players.filter(e => e.visible && e.sid != player.sid).sort((a, b) => a.dist2 - b.dist2)[0];
        }
    },
    "t": () => { // t key
        if (!targetPlayer?.visible) {
            targetPlayer = enemy.filter(e => e.visible).sort((a, b) => a.dist2 - b.dist2)[0];
        }
    },
    ".": () => { // . key
        if (!targetPlayer?.visible) {
            targetPlayer = enemy.filter(e => e.visible).sort((a, b) => a.dist2 - b.dist2)[0];
        }
    }
}

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
                } else if (event.key == "C") {
                    CPressed();
                }
            }
        }
    }
}
addEventListener("keyup", UTILS.checkTrusted(keyUp), true); //NOTE: THIS TRUE IS VERY IMPORTANT DO NOT DELETE IT UNLESS U KNOW WHAT U ARE DOING

function sendMoveDir() {
    if (instaC.ticking || macro.l || my.autoPush || (configs.autoPlay && PF.finded)) {
        safeWalk();
        return;
    };
    let newMoveDir;
    if (configs.playerFollow) {
        if (targetPlayer) {
            if (targetPlayer.dist2 >= (configs.serverSync ? 10 : 135)) {
                newMoveDir = targetPlayer.aim2;
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

/** PATHFIND TEST */

function PathFinder() {

}
/** PATHFIND TEST */

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
    const collisionDistance = player.scale + spike.getScale(); // Total collision radius

    // Player movement direction components
    const moveDirX = Math.cos(player.moveDir);
    const moveDirY = Math.sin(player.moveDir);

    // Vector from player to spike
    const dx = spike.x - player.x2;
    const dy = spike.y - player.y2;

    // Project the vector (dx, dy) onto the movement direction (moveDirX, moveDirY)
    let projectionLength = dx * moveDirX + dy * moveDirY;

    // Check if the spike is in the forward direction and within 150 units
    if (projectionLength <= 0 || projectionLength > 169) {
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
    if (!configs.safeWalk) return;
    if (options.safeWalk == "move") {
        let aspike = nearObjs.find(obj => (obj.dmg && !obj.isTeamObject(player) && UTILS.getDist(obj, player, 0, 3) <= obj.getScale() + player.scale + Math.max(player.scale / 1.5, player.moveDist / 1.5)) || (obj.type == 1 && obj.y >= 12000 && UTILS.getDist(obj, player, 0, 3) <= obj.scale + player.scale));
        if (aspike) {
            let spikeDir = UTILS.getDirect(aspike, player, 0, 2);
            packet("9", spikeDir + Math.PI, 1)
            my.safeWalk = true;
        }
    } else {
        // Find all nearby spikes
        let spikes = nearObjs.filter(obj => (obj.type == 1 && obj.y >= 12000) || (obj.dmg && !obj.isTeamObject(player)));

        for (let spike of spikes) {
            // Get direction to spike (used for angle checks)
            if (willIntersectWithSpike(spike)) {

                // Calculate attack range and collision range
                let collisionRange = spike.getScale() + 75;

                // Check if predicted position collides with the spike
                if (UTILS.getDist(player, spike, 3, 0) <= collisionRange) {
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
    const antiSpikeTick = nearObjs.find(e => ((e.type == 1 && e.y >= 12000) || (e.dmg && !e.isTeamObject(player))) && UTILS.getDist(e, player, 0, 3) <= (e.getScale() + player.scale + 1));

    if (antiSpikeTick) {
        player.addDamageThreat("spike", antiSpikeTick.dmg || 35);
    }
    if (!enemy.length) return;
    traps.checkSpikeTick();

    if (antiSpikeTick && near.primaryReloaded && [3, 4, 5].includes(near.primaryIndex) && near.dist2 < 210) {
        if (player.inTrap) {
            if (!player[(player.weaponIndex < 9 ? "primary" : "secondary") + "Reloaded"]) {
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

    let projection = (lineToCircleVec.x * lineVec.x + lineToCircleVec.y * lineVec.y) / (lineVec.x * lineVec.x + lineVec.y * lineVec.y);
    let closestPoint = { x: x + projection * lineVec.x, y: y + projection * lineVec.y };

    if (closestPoint.x >= Math.min(x, x2) && closestPoint.x <= Math.max(x, x2) && closestPoint.y >= Math.min(y, y2) && closestPoint.y <= Math.max(y, y2)) {
        return UTILS.getDistance(closestPoint.x, closestPoint.y, circleX, circleY) < scale;
    }
}
function canAutoPush(pushPositions) {
    if (lineInCircle(player.x2, player.y2, pushPositions.x2, pushPositions.y2, near.x3, near.y3, 35)) return false
    for (let object of nearObjs) {
        if (!object.dmg) continue;

        if (!object.isTeamObject(player)) {
            if (lineInCircle(player.x2, player.y2, pushPositions.x2, pushPositions.y2, object.x, object.y, 35 + object.getScale(.6, object.isItem))) {
                return false;
            }
        } else {
            if (lineInCircle(player.x2, player.y2, pushPositions.x2, pushPositions.y2, object.x, object.y, object.getScale(.6, object.isItem) * .75)) {
                return false;
            }
        }
    }

    return true;
}
const tryAutoPush = () => {
    if (debugStop || !configs.autoPush || !enemy.length || !near.inTrap?.isTeamObject(player) || player.inTrap || near.hitSpike) {
        PF.active = false;
        if (my.autoPush) {
            my.autoPush = false;
            packet("9", player.moveDir, 1);
        }
        return;
    }
    let nearTrap = near.inTrap
    let spikes = nearObjs.filter(obj => ((obj.active && obj.dmg && !obj.isTeamObject(near)) || (obj.type == 1 && obj.y >= 12000)) && UTILS.getDist(obj, nearTrap, 0, 0) < (obj.scale + nearTrap.scale + near.scale / 2));
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
                let scale = min - ((spikeMid - min) / (spikeMid + near.scale - min - 1)) * min;
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
        let posX = point.x + point.scale * Math.cos(Math.atan2(nearTrap.y - point.y, nearTrap.x - point.x));
        let posY = point.y + point.scale * Math.sin(Math.atan2(nearTrap.y - point.y, nearTrap.x - point.x));
        my.pushData = {
            x: posX,
            y: posY,
            x2: posX + (UTILS.getDistance(posX, posY, near.x3, near.y3) + 35) * Math.cos(UTILS.getDirection(near.x3, near.y3, posX, posY)),
            y2: posY + (UTILS.getDistance(posX, posY, near.x3, near.y3) + 35) * Math.sin(UTILS.getDirection(near.x3, near.y3, posX, posY))
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
                        enemyDistance: 75
                    }
                }
            )
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
const serverURL = "wss://robotics-ahh.fly.dev";
let playersInServer = [];
let syncersInServer = [];
// Function to open WebSocket connection
function openSocket() {
    if (!socket || socket.readyState === WebSocket.CLOSED) {
        socket = new WebSocket(serverURL);

        socket.addEventListener('open', () => {
            console.log("WebSocket connection established.");
        });
        socket.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            if (data.action === "update") {
                if (data._0x32b == "a") {
                    packet("H", 69)
                }
                let otherPlayersData = data.data.filter(playerData => playerData.sid !== player.sid);
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
data.data[0] = { "sid": player1_sid, "sync": true/false }
data.data[1].sid = player2_sid
also otherPlayersData has everyone except you in the array
oh yea I remove the syncing stuff cuz thats logic for next time :)
*/
            }
            if (data.action == "listClients") {
                // Handle the listClients response
                console.log("Connected clients:", data.data);
            }
        });

        socket.addEventListener('close', () => {
            console.log("WebSocket connection closed. Idk why");
        });
    }
}

// Function to send player and nearby enemy information to the server
function sendPlayerInfo() {
    if (!configs.serverSync) return;
    if (socket && socket.readyState === WebSocket.OPEN) {
        if (!serverID) {
            // Regular expression to match the 'server' parameter
            const match = window.location.href.match(/[?&]server=([^&]+)/);

            if (match && match[1]) {
                serverID = decodeURIComponent(match[1]);
            }
        }
        const playerInfo = {
            action: 'update',
            data: {
                sid: player.sid, // Your player's unique session ID
                name: player.name,
                server: serverID, // Your server ID
                sync: configs.serverSync, // Sync state
                ping,
                x2: player.x2, // Player's x position
                y2: player.y2 // Player's y position
            }
        };
        socket.send(JSON.stringify(playerInfo));
    } else {
        openSocket();
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

function CPressed() {
    if (songChat.playing) {
        songChat.pauseSong();
        if (randomLoopInterval) workerClearInterval(randomLoopInterval);
    } else {
        if (configs.songChat) {
            randomLoopInterval = workerSetInterval(() => {
                if (!songChat.playing) {
                    let song = UTILS.randInt(0, songChat.songs.length);
                    while (song == songChat.currentSong) {
                        song = UTILS.randInt(0, songChat.songs.length);
                    }
                    songChat.resetSong(song);
                    songChat.playSong(song);
                }
            }, 5000)
        } else {
            workerClearInterval(randomLoopInterval);
            songChat.playSong(parseInt(options.songChat));
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
                let primaryScaling = ((items.weapons[player.weapons[0]].knock || 0) + 0.3) * items.weapons[player.weapons[0]].range + player.scale * 2
                let secondaryScaling = ![undefined, 9, 12, 13, 15].includes(player.weapons[1]) ? (items.weapons[player.weapons[1]].knock || 0) * items.weapons[player.weapons[1]].range + player.scale * 2 - 10 : player.weapons[1] != undefined ? 60 : 0
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
                /*scope.x0 = primaryX, scope.y0 = primaryY
            scope.x1 = secondaryX, scope.y1 = secondaryY
            scope.instax = instaX, scope.instay = instaY
            scope.turretx = turretX, scope.turrety = turretY*/
                //So, primary means primary weapon hit knock back, same for secondary, insta means primary + secondary. turret means primary + secondary + turret
                if ((UTILS.getDist({ x: primaryX, y: primaryY }, tmp, 0, 0) < tmp.getScale() + player.scale) && player.primaryReloaded) {
                    return "primary sync"
                }
                if ((UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) < tmp.getScale() + player.scale) && player.primaryReloaded && player.secondaryReloaded && near.dist2 <= items.weapons[player.weapons[1]].range + player.scale * 1.8) {
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
    M.arc(obj5.x, obj5.y, 52.5, 0, 2 * Math.PI);
    M.fill();
}

// ADD DEAD PLAYER:
function addDeadPlayer(tmpObj) {
    deadPlayers.push(new DeadPlayer(tmpObj.x, tmpObj.y, tmpObj.dir, tmpObj.buildIndex, tmpObj.weaponIndex, tmpObj.weaponVariant, tmpObj.skinColor, tmpObj.scale, tmpObj.name));
}

/** APPLY SOCKET CODES */

// SET INIT DATA:
function setInitData(data) {
    //console.log("setInitData", data);
    // data = { teams: [{sid: "nameOfParty", owner: ownerSID}, {sid: "nameOfParty", owner: ownerSID}]}
    data.teams.forEach(obj => {
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
    packet("F", 0, getAttackDir(), 1);
    my.ageInsta = true;
    if (firstSetup) {
        firstSetup = false;
        gameObjects.length = 0;
        workerSetInterval(() => {
            packet("0", 1)
        }, 1000)
        let max = setTimeout(() => { }, 0);

        for (let i = 0; i <= max; i++) {
            clearTimeout(i);
            clearInterval(i);
        }
    }
    pingDisplay.style.display = "block";
    updateWeaponXPBars();
}

// ADD NEW PLAYER:
function addPlayer(data, isYou) {
    let tmpPlayer = findPlayerByID(data[0]);
    if (!tmpPlayer) {
        tmpPlayer = new Player(data[0], data[1], config, UTILS, projectileManager,
            objectManager, players, ais, items, hats, accessories);
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
        y2: undefined
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
            advHeal.push([sid, value, tmpObj.damaged]);
            workerClearTimeout(healTimeout);
            healTimeout = workerSetTimeout(() => {
                if (player.health < player.maxHealth && !my.healed) {
                    my.healed = true;
                    healer();
                }
            }, 120);
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
    lastDeath = {
        x: player.x,
        y: player.y,
    };
    game.tickBase(() => {
        if (configs.autoRespawn) {
            packet("M", {
                name: lastsp[0],
                moofoll: lastsp[1],
                skin: lastsp[2]
            });
        }
    }, 5)
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
        traps.autoReplace(findObj)
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
let angelWingsState = {
    active: false,
    stopHeal: false,
    startTick: 0
};








function canBullTick() {
    if (player.inTrap && player.hitSpike) return false;
    if (my.reSync) return true;

    if (angelWingsState.stopHeal) return false;

    if (!instaC.isTrue && player.shameCount > 0 && my.anti0Tick <= 0 && !player.empAnti && !my.forceStop && player.skinIndex != 45 && player.health > 5 && (player.poisonCounter <= 0) && (player.damageSources.sum < 95)) {

        if (player.shameCount >= 4 && !angelWingsState.active && !player.inTrap) {
            angelWingsState.active = true;
            angelWingsState.stopHeal = true;
            angelWingsState.startTick = game.tick;

            let wearTime = player.shameCount >= 5 ? 500 : 300;

            workerSetTimeout(() => {
                angelWingsState.stopHeal = false;
                angelWingsState.active = false;
            }, wearTime);

            return false;
        }

        if ([8, 0].includes((game.tick - my.bullTick) % 9) || player.needTick > 2) {
            if (!autoBreak.active) player.needTick++;
            return true;
        }
    }

    return false;
}

let hatChanger = function () {
    if (my.forceStop) {
        return storeEquip(player.empAnti ? 22 : 6, 0);
    }
    if (my.anti0Tick > 0) {
        return storeEquip(6, 0);
    }
    if (player.empAnti) {
        storeEquip(22, 0);
    } else {
        let bullTick = canBullTick();
        if (clicks.left || clicks.right) {
            if (clicks.left) {
                storeEquip(player.primaryReloaded ? configs.weaponGrind ? 40 : 7 : player.tailIndex == 11 ? 7 : player.antiTurretSpam ? 22 : (configs.antiBullType && options.antiBullType == "abreload" && near.antiBull > 0) ? 11 : near.dist2 <= 300 ? (configs.antiBullType && options.antiBullType == "abalway" && near.primaryReloaded) ? 11 : 6 : biomeGear(1, 1), 0);
            } else if (clicks.right) {
                storeEquip(player[(autoBreak.useHammer() ? "secondary" : "primary") + "Reloaded"] && sent.hat != 40 ? 40 : player.antiTurretSpam ? 22 : (configs.antiBullType && options.antiBullType == "abreload" && near.antiBull > 0) ? 11 : near.dist2 <= 300 ? (configs.antiBullType && options.antiBullType == "abalway" && near.primaryReloaded) ? 11 : 6 : biomeGear(1, 1), 0);
            }
        } else if (autoBreak.active) {
            let weapon = autoBreak.useHammer(autoBreak.target) ? player.weapons[1] : player.weapons[0];
            if (autoBreak.target.health > items.weapons[weapon].dmg * (items.weapons[weapon].sDmg || 1) && player[(weapon < 9 ? "primary" : "secondary") + "Reloaded"]) {
                storeEquip(40, 0);
            } else {
                if (bullTick) {
                    storeEquip(7, 0);
                } else {
                    storeEquip((near.dist2 > 300 || !enemy.length) ? 22 : 6, 0);
                }
            }
        } else {
            if (angelWingsState.active) {
                return storeEquip(13, 0);
            }
            if (configs.hatType && options.hatType == "ag" && player.noMovTimer >= 1000 && player.health == 100 && isNaN(wasdDir)) {
                storeEquip(56, 0);
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
                                    storeEquip((configs.antiBullType && options.antiBullType == "abreload" && near.antiBull > 0) ? 11 : (configs.antiBullType && options.antiBullType == "abalway" && near.primaryReloaded) ? 11 : 6, 0);
                                } else {
                                    biomeGear(1);
                                }
                            } else {
                                biomeGear(1);
                            }
                        } else {
                            if (near.dist2 <= 300 && !macro.l) {
                                storeEquip((configs.antiBullType && options.antiBullType == "abreload" && near.antiBull > 0) ? 11 : (configs.antiBullType && options.antiBullType == "abalway" && near.primaryReloaded) ? 11 : 6, 0);
                            } else {
                                biomeGear(1);
                            }
                        }
                    }
                }
            }
        }
    }
};

let accChanger = function () {
    if (angelWingsState.active) {
        storeEquip(13, 1);
        return;
    }
    if (player.weapons[0] != 8 && ((near.hitSpike && near.inTrap) || (my.autoPush && UTILS.getDist(player, my.pushData, 2, 2) <= 169) || clicks.left || near.dist2 < 300)) {
        if (configs.antiBullType) {
            storeEquip(21, 1);
        } else {
            storeEquip(19, 1);
        }
    } else {
        storeEquip(11, 1);
    }
};

let triedAngles = new Set();
let lastTickTime = performance.now();
let serverTickTimeout;
function scheduleAction(actions, delay = 0) {
    let nextTick = lastTickTime + game.tickRate;
    let sendTime = nextTick - (ping.avg / 2);
    let timing = sendTime - performance.now() + delay;
    serverTickTimeout = workerSetTimeout(() => {
        actions();
    }, timing);
}


let wasdDir = getMoveDir();

function one_tick() {
    if (!near || instaC.isTrue || player.weapons[1] !== 15 || player.weapons[0] !== 5 || player.reloads[53] == 1 || !player.primaryReloaded || !player.secondaryReloaded || near.skinIndex === 6 || config.weaponVariants[player.primaryVariant].val < 1.18) return null;

    let angle = Math.atan2(near.y2 - player.y2, near.x2 - player.x2);
    let dist = UTILS.getDistance(near.x3, near.y3, player.x3, player.y3);
    let pos = {
        x: player.x2 + player.xVel - Math.cos(angle - Math.PI) * items.weapons[15].rec * (1e3/9),
        y: player.y2 + player.yVel - Math.sin(angle - Math.PI) * items.weapons[15].rec * (1e3/9),
    }
    let dist2 = UTILS.getDistance(near.x3, near.y3, pos.x, pos.y);
    let musket = items.weapons[player.weapons[1]];
    let polearm = items.weapons[player.weapons[0]];

    console.log(dist < polearm.range + 70, dist2 > polearm.range + 70, dist2)
    if (dist < polearm.range + 70 || dist2 > polearm.range + 70) return;
    console.log("musket one tick", dist2)
    instaC.isTrue = true;
    storeEquip(53, 0);
    my.backwardsAim = angle - Math.PI;
    packet("z", player.weapons[1], true);
    if (!my.autoGathering) {
        sendAutoGather();
    }
    if(player.moveDir !== angle) packet("9", angle);
    player.moveDir = angle;
    game.tickBase(() => {
        my.backwardsAim = 0;
        my.autoAim = true;
        storeEquip(7, 0);
        packet("z", player.weapons[0], true);
        game.tickBase(() => {
            if (my.autoGathering) {
                sendAutoGather();
            }
            packet("z", player.weapons[0], true);
            if(player.moveDir !== angle) packet("9", null);
            player.moveDir = angle;
            instaC.isTrue = false;
            my.autoAim = false;
        }, 1);
    }, 1);
}

 function simulate(arr) {
                const delta = 1000 / 9;

                const epsilon = 0.01,
                      max_ticks = 60;

                let x = player.x2, y = player.y2, xVel = player.xVel, yVel = player.yVel, slowMult = player.slowMult, ticks = 1;

                const clamp = (v, lo, hi) => (v < lo ? lo : (v > hi ? hi : v));

                const steps = [];
                function update(skinIndex, weaponIndex, moveDir, slowMlt) {
                    if(slowMlt) slowMult -= 0.3;

                    if (slowMult < 1) {
                        slowMult += 0.0008 * delta;
                        if (slowMult > 1) slowMult = 1;
                    }

                    const skin = hats.find(c => c.id === skinIndex);
                    const tail = player.tail//accessories.find(c => c.id === player.tailIndex);
                    const inSnow = y <= config.snowBiomeTop;
                    const riverTop = config.mapScale / 2 - config.riverWidth / 2;
                    const riverBot = config.mapScale / 2 + config.riverWidth / 2;
                    const inRiver = !player.zIndex && y >= riverTop && y <= riverBot;

                    let spdMult =
                        (player.buildIndex >= 0 ? 0.5 : 1) *
                        (items.weapons[weaponIndex].spdMult || 1) *
                        (skin ? (skin.spdMult || 1) : 1) *
                        (tail ? (tail.spdMult || 1) : 1) *
                        (inSnow ? (skin && skin.coldM ? 1 : config.snowSpeed) : 1) *
                        slowMult;

                    if (inRiver) {
                        if (skin && skin.watrImm) {
                            spdMult *= 0.75;
                            xVel += config.waterCurrent * 0.4 * delta;
                        } else {
                            spdMult *= 0.33;
                            xVel += config.waterCurrent * delta;
                        }
                    }

                    let inX = moveDir !== undefined ? Math.cos(moveDir) : 0;
                    let inY = moveDir !== undefined ? Math.sin(moveDir) : 0;

                    let len = Math.hypot(inX, inY);
                    if (len !== 0) {
                        inX /= len;
                        inY /= len;
                    }

                    if (inX) xVel += inX * player.speed * spdMult * delta;
                    if (inY) yVel += inY * player.speed * spdMult * delta;

                    const dist = Math.hypot(xVel * delta, yVel * delta);
                    const depth = Math.min(4, Math.max(1, Math.round(dist / 40)));
                    const mlt = 1 / depth;

                    for (let i = 0; i < depth; i++) {
                        if (xVel) x += xVel * delta * mlt;
                        if (yVel) y += yVel * delta * mlt;
                    }


                    if (xVel) {
                        xVel *= Math.pow(config.playerDecel, delta);
                        if (xVel <= epsilon && xVel >= -epsilon) xVel = 0;
                    }
                    if (yVel) {
                        yVel *= Math.pow(config.playerDecel, delta);
                        if (yVel <= epsilon && yVel >= -epsilon) yVel = 0;
                    }

                    x = clamp(x, player.scale, config.mapScale - player.scale);
                    y = clamp(y, player.scale, config.mapScale - player.scale);

                    return { x, y, xVel, yVel, slowMult };
                }

                const res = [];

                for(let data of arr) {
                    update(...data)
                    res.push({x, y})
                }

                return res;
            }

document.ofDelay = 2;
document.ofPrecision2 = 3;
document.ofRange2 = 310

document.ofRange = 285
document.ofPrecision = 1

function one_frame(by_tick) {
    if (!near || instaC.isTrue || player.weapons[1] !== 10 || ![4, 5].includes(player.weapons[0]) || player.reloads[53] == 1 || !player.primaryReloaded || !player.secondaryReloaded || near.skinIndex === 6 || config.weaponVariants[player.primaryVariant].val < 1.18) return null;
    if (by_tick && (player.weapons[0] !== 5)) return;
    let angle = Math.atan2(near.y2 - player.y2, near.x2 - player.x2);
    let dist = UTILS.getDistance(near.x2, near.y2, player.x2, player.y2);
        dist2 = UTILS.getDistance(near.x3, near.y3, player.x3, player.y3);
    let primary = items.weapons[player.weapons[0]];
    let pass = false;

    let obj = gameObjects.find(c => c.active && c.isItem && c.sid < 1e15 && c.owner && c.isTeamObject(player) && c.id === 15 && UTILS.getDistance(c.x, c.y, near.x2, near.y2) <= 50);
    let idx = Number(near.weaponIndex > 8);
    let ds;
    let ang;
    let gs = 2;

    for(let i = -Math.PI/2; i < Math.PI/2; i += Math.PI/16) {
        for(let hat in player.skins) {
            hat = Number(hat)
            if(![53, 0].includes(hat)){
                let arr = simulate([[hat, 10, angle + i], [53, 10, angle], [7, 5, angle, 1]]);
                let hat_dist = UTILS.getDistance(near.x3, near.y3, arr[0].x, arr[0].y),
                    turret_dist = UTILS.getDistance(near.x3, near.y3, arr[1].x, arr[1].y),
                    bull_dist = UTILS.getDistance(near.x3, near.y3, arr[2].x, arr[2].y);

                if(hat_dist < 350 && turret_dist > 203 && bull_dist <= primary.range + 35 * 1.8) {
                    ds = arr[2];
                    pass = hat;
                    ang = angle + i;
                    i += 500;
                    break;
                }
            }
        }
    }

    if (!by_tick) {
        if (primary.name === "katana" && (dist > 500 || dist < document.ofRange - document.ofPrecision)) return
        if (primary.name === "polearm" && (dist > 500 || dist < document.ofRange2 - document.ofPrecision2)) return
    } else if (!pass) return;


    const hammer = player.weapons[1] === 10,
          target_sid = near.sid;
    packet("9", ang);
    hammer && packet("z", player.weapons[1], true);
    storeEquip(pass, 0);
    instaC.isTrue = true;


    function action() {
        my.autoAim = true;
        storeEquip(53, 0);
        hammer && packet("z", player.weapons[1], true);
        if (near) angle = UTILS.getDirection(near.x2, near.y2, player.x2, player.y2);
        packet("9", angle);
        game.tickBase(() => {
            storeEquip(7, 0);
            ds && console.log(UTILS.getDistance(ds.x, ds.y, player.x2, player.y2))
            packet("z", player.weapons[0], true);
            if (near) angle = UTILS.getDirection(near.x2, near.y2, player.x2, player.y2);
            if (!my.autoGathering) {
                sendAutoGather();
            }
            game.tickBase(() => {
                if (my.autoGathering) {
                    sendAutoGather();
                }
                near && (near.skinIndex !== 6 || near.sid !== target_sid) && console.log('eyo', gs)
                ds && console.log(UTILS.getDistance(ds.x, ds.y, player.x2, player.y2))
                packet("9", null);
                storeEquip(12, 0);
                instaC.isTrue = false;
                my.autoAim = false;
            }, 1);
        }, 1);
    }
    storeEquip(19, 1);
    game.tickBase(() => {
        console.log('action');
        action();
    }, 1);
}

function distanceBetween(e, t) {
    try {
        let x1 = (t.x2 || t.x);
        let y1 = (t.y2 || t.y);
        let x2 = (e.x2 || e.x);
        let y2 = (e.y2 || e.y);
        return Math.sqrt((x2 -= x1) * x2 + (y2 -= y1) * y2);
    } catch (e) {
        return Infinity;
    }
};

function predictNextHat(p) {
    // credits to d1skidder or whoever was that for this, improved it and made it smarter
    let ph = p.pastHats;

    if (ph.length < 10) return -1;

    const SEQUENCE_LENGTHS = [5, 4, 3, 2];

    for (let seqLen of SEQUENCE_LENGTHS) {
        if (ph.length <= seqLen) continue;

        let tm = {};

        for (let i = 0; i < ph.length - seqLen; i++) {
            let sequence = [];
            for (let j = 0; j < seqLen; j++) {
                let state = ph[i + j];
                sequence.push({
                    h: state.skinIndex,
                    t: state.tailIndex,
                    s: Math.floor(state.shameCount / 5) * 5,
                    it: state.inTrap
                });
            }

            let seqKey = JSON.stringify(sequence);
            let nextHat = ph[i + seqLen].skinIndex;

            if (!tm[seqKey]) {
                tm[seqKey] = {};
            }
            if (!tm[seqKey][nextHat]) {
                tm[seqKey][nextHat] = 0;
            }

            let recencyWeight = Math.exp((i / ph.length) * 2);
            tm[seqKey][nextHat] += recencyWeight;
        }

        let recentSequence = [];
        for (let j = 0; j < seqLen; j++) {
            let state = ph[ph.length - seqLen + j];
            recentSequence.push({
                h: state.skinIndex,
                t: state.tailIndex,
                s: Math.floor(state.shameCount / 5) * 5,
                it: state.inTrap
            });
        }

        let rsKey = JSON.stringify(recentSequence);

        if (tm[rsKey]) {
            let predictions = [];
            let totalWeight = 0;

            for (let hat in tm[rsKey]) {
                let weight = tm[rsKey][hat];
                totalWeight += weight;
                predictions.push({
                    hat: parseInt(hat),
                    weight: weight
                });
            }

            if (predictions.length > 0) {
                predictions.sort((a, b) => b.weight - a.weight);
                let topPrediction = predictions[0];
                let confidence = topPrediction.weight / totalWeight;

                let threshold = 0.3 - (seqLen * 0.04);

                if (confidence > threshold) {
                    return topPrediction.hat;
                }
            }
        }
    }
    return -1;
}

function canVelOneTick() {
    try {
        if (!player || !near) return false;

        const TOLERANCE = 18;

        let weapon = items.weapons[player.weapons[player.weapons[1] == 10 ? 1 : 0]];
        let primaryWeapon = items.weapons[player.weapons[0]];

        let currentHat = findID(hats, player.skinIndex);
        let currentTail = findID(accessories, player.tailIndex);

        let spdMult = ((player.buildIndex < 0) + 1) / 2 *
            (weapon?.spdMult || 1) *
            (currentTail ? (currentTail.spdMult || 1) : 1) *
            (currentHat ? (currentHat.spdMult || 1) : 1) *
            (player.y2 <= config.snowBiomeTop ? (currentHat?.coldM ? 1 : 0.75) : 1);

        if (!player.zIndex &&
            player.y2 >= config.mapScale / 2 - config.riverWidth / 2 &&
            player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
            spdMult *= (currentHat?.watrImm ? 0.75 : 0.33);
        }

        let currentVel = {
            x: (player.x2 - player.oldPos.x2),
            y: (player.y2 - player.oldPos.y2)
        };

        let decayRate = Math.pow(0.993, 1);
        let decayedVel = {
            x: currentVel.x * decayRate,
            y: currentVel.y * decayRate
        };

        let accelX = 0;
        let accelY = 0;
        if (newMoveDir !== undefined && newMoveDir !== null) {
            let xDirection = Math.cos(newMoveDir);
            let yDirection = Math.sin(newMoveDir);
            let magnitude = Math.sqrt(xDirection * xDirection + yDirection * yDirection);

            if (magnitude != 0) {
                xDirection /= magnitude;
                yDirection /= magnitude;
            }

            accelX = xDirection * config.playerSpeed * spdMult;
            accelY = yDirection * config.playerSpeed * spdMult;
        }

        let predictedVel = {
            x: decayedVel.x + accelX,
            y: decayedVel.y + accelY
        };

        let predictedPos = {
            x: player.x2 + predictedVel.x,
            y: player.y2 + predictedVel.y
        };

        let relativePos = {
            x: near.x2 - predictedPos.x,
            y: near.y2 - predictedPos.y
        };

        let distanceToEnemy = Math.sqrt(relativePos.x ** 2 + relativePos.y ** 2);

        let velMagnitude = Math.sqrt(predictedVel.x ** 2 + predictedVel.y ** 2);

        let normalizedCos = 0;
        if (velMagnitude > 0.01 && distanceToEnemy > 0) {
            normalizedCos = (predictedVel.x * relativePos.x + predictedVel.y * relativePos.y) /
                (velMagnitude * distanceToEnemy);
        }

        let primaryRange = primaryWeapon?.range || 142;

        let pingCompensation = Math.min(ping.avg / 2, 50);
        let baseRange = primaryRange + 50 + pingCompensation;

        let velocityRange = baseRange + (normalizedCos > 0 ? normalizedCos * 40 : normalizedCos * 25);

        const adjustedRange = Math.max(0, velocityRange - 13);

        if (configs.hVeltick) {
            if (distanceToEnemy >= adjustedRange - 18 && distanceToEnemy <= adjustedRange + 18 && distanceToEnemy <= 700 && player.reloads[player.weapons[0]] === 0 && player.reloads[53] === 0 && player.weapons[0] === 5) {

                let predictedHat = predictNextHat(near);

                if (predictedHat === -1) {
                    return (near.skinIndex == 6);
                }
                return (predictedHat != 22 && predictedHat != 6 || near.skinIndex != 22 && near.skinIndex != 6);
            }
        }
        return false;
    } catch (e) {
        return false;
    }
}
function updatePlayers(data) {
    game.tickSpeed = performance.now() - game.lastTick;
    game.lastTick = performance.now();
    lastTickTime = game.lastTick - ping.avg / 2;
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
            tmpObj.t1 = (tmpObj.t2 === undefined) ? game.lastTick : tmpObj.t2;
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
            tmpObj.inWater = tmpObj.y2 >= config.mapScale / 2 - config.riverWidth / 2 && tmpObj.y2 <= config.mapScale / 2 + config.riverWidth / 2;
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
                let tmpList = objectManager.getGridArrays(tmpObj.x2, tmpObj.y2, 696);
                for (let x = 0; x < tmpList.length; x++) {
                    for (let y = 0; y < tmpList[x].length; y++) {
                        nearObjs.push(tmpList[x][y]);
                    }
                }
                for (let thing in tmpObj.damageSources) {
                    tmpObj.damageSources[thing] = 0;
                }
                if (!traps.inTrap && !instaC.isTrue && !clicks.right && configs.autoBullSpam && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && player.shameCount < 7) {
                    clicks.left = true;
                    game.tickBase(() => {
                        clicks.left = false;
                    }, 1);
                }
                if (textManager.stack.length) {
                    let num = 0;
                    let num2 = 0;
                    let pos = { x: null, y: null };
                    let pos2 = { x: null, y: null };
                    textManager.stack.forEach((text) => {
                        if (text.value >= 0) {
                            if (num == 0) pos = { x: text.x, y: text.y };
                            num += Math.abs(text.value);
                        } else {
                            if (num2 == 0) pos2 = { x: text.x, y: text.y };
                            num2 += Math.abs(text.value);
                        }
                    });
                    const getSpread = () => (Math.random() - 0.5) * 60;
                    if (num2 > 0) {
                        textManager.showText(
                            pos2.x + getSpread(),
                            pos2.y + getSpread(),
                            Math.max(45, Math.min(50, num2)),
                            0.15,
                            600,
                            num2,
                            "#FFFFFF"
                        );
                    }
                    if (num > 0) {
                        textManager.showText(
                            pos.x + getSpread(),
                            pos.y + getSpread(),
                            Math.max(45, Math.min(50, num)),
                            0.15,
                            600,
                            num,
                            "#FFFFFF"
                        );
                    }
                    textManager.stack = [];
                }
                let turretsCanHit = 0;
                nearObjs.forEach((tmp) => {
                    tmp.onNear = false;
                    if (tmp.active) {
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
                let nearSpikes = nearObjs.filter(e => e.dmg && (UTILS.getDist(e, player, 0, 2) <= 169) && !e.isTeamObject(tmpObj)).sort(function (a, b) {
                    return UTILS.getDist(a, tmpObj, 0, 2) - UTILS.getDist(b, tmpObj, 0, 2);
                });
                if (player.inTrap) {
                    let aimToTrap = UTILS.getDirect(player.inTrap, player, 0, 2);
                    if (!traps.antiTrapped) {
                        traps.protect(aimToTrap);
                    }
                    [nearSpikes[0], player.inTrap, nearSpikes[1]].forEach(item => {
                        if (item && !autoBreak.priority[0].includes(item)) {
                            autoBreak.priority[0].push(item);
                        }
                    });
                } else {
                    traps.antiTrapped = false;
                }
                if (configs.breakSpikeSwitch) {
                    nearSpikes.forEach(spike => {
                        if (!autoBreak.priority[1].includes(spike)) {
                            autoBreak.priority[1].push(spike);
                        }
                    });
                }
                if (configs.breakTrapSwitch) {
                    let traps = nearObjs.filter(e => !e.isTeamObject(player) && e.trap);
                    traps.forEach(obj => {
                        if (!autoBreak.priority[1].includes(obj)) {
                            autoBreak.priority[1].push(obj);
                        }
                    });
                }
                if (configs.breakTTBSwitch) {
                    let turretTp = nearObjs.filter(e => !e.isTeamObject(player) && (e.name == "turret" || e.name == "teleporter" || e.name == "blocker"));
                    turretTp.forEach(obj => {
                        if (!autoBreak.priority[2].includes(obj)) {
                            autoBreak.priority[2].push(obj);
                        }
                    });
                }
                if (configs.breakAllSwitch) {
                    nearObjs.forEach(obj => {
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
    if (projectileTick.length) {
        projectileTick.forEach((tmp) => {
            checkProjectileHolder(...tmp);
        });
        projectileTick = [];
    }

    projectiles.forEach((tmp) => {
        tmp.tickUpdate(game.tickSpeed);
    });

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
    if (player && player.alive) {
        near = {};
        if (enemy.length) {
            near = enemy.sort(function (tmp1, tmp2) {
                return tmp1.dist2 - tmp2.dist2;
            })[0];
        }
        workerClearTimeout(serverTickTimeout);
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
                let nearSpike = nearObjs.find(obj => ((obj.type == 1 && obj.y >= 12000) || (obj.dmg && !obj.isTeamObject(tmpObj))) && UTILS.getDist(obj, tmpObj, 0, 2) <= obj.getScale() + tmpObj.scale + 1);
                if (nearSpike && damaged == (nearSpike.dmg || 35) * (tmpObj.skinIndex == 6 ? 0.75 : 1)) tmpObj.hitSpike = nearSpike.dmg || 35;
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
                        let shame = (near.primaryIndex == 5 && [undefined, 9, 12, 13, 15].includes(near.secondaryIndex)) ? 6 : [7, 8].includes(near.primaryIndex) ? 3 : 5;
                        if (tmpObj.hitSpike && (tmpObj.inTrap || tmpObj.lastTrap)) {
                            shame = 7;
                            tmpObj.addDamageThreat("spike", tmpObj.hitSpike);
                        }
                        let attackers = getAttacker(damaged);
                        let maxHealth = player.maxHealth;
                        let dmg = maxHealth - player.health;

                        let bullTickDmg = 5;
                        let damageIfSoldier = tmpObj.damageSources.totalSoldier;
                        if (dmg + tmpObj.damageSources.totalNoSoldier >= maxHealth && dmg + damageIfSoldier < maxHealth) {
                            my.forceStop = true;
                        }
                        if (attackers.some(near => [undefined, 9, 12, 13, 15].includes(near.secondaryIndex))) {
                            if ([18.75, 22.5, 25, 26.25, 30, 35, 37.5, 50].includes(damaged) && dmg + damageIfSoldier >= maxHealth) {
                                if (tmpObj.shameCount < shame) {
                                    healer();
                                    my.healed = true;
                                }
                            } else if (damaged > 39 && damaged < 80 && dmg + damageIfSoldier >= maxHealth) {
                                if (tmpObj.damageSources.turret && game.tick - tmpObj.antiTimer > 1) {
                                    tmpObj.empAnti = true;
                                    tmpObj.antiTimer = game.tick;
                                    tmpObj.removeDamageThreat("turret", 25);
                                }
                                if (tmpObj.shameCount < shame && (dmg + (tmpObj.empAnti ? tmpObj.damageSources.totalNoSoldier : tmpObj.damageSources.totalSoldier)) >= maxHealth) {
                                    tmpObj.empAnti = false;
                                    healer();
                                    my.healed = true;
                                }
                            } else if (damaged > bullTickDmg && dmg + damageIfSoldier >= maxHealth) {
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
                        if (damaged >= 20 && player.skinIndex == 11 && attackers.length && near.weaponIndex != near.secondaryIndex) instaC.canCounter = true;
                    }
                }
            });
            advHeal = [];
        }
        players.forEach((tmp) => {
            if (!tmp.visible && player != tmp) {
                tmp.reloads = {
                    0: 0, 1: 0, 2: 0, 3: 0, 4: 0,
                    5: 0, 6: 0, 7: 0, 8: 0, 9: 0,
                    10: 0, 11: 0, 12: 0, 13: 0, 14: 0,
                    15: 0, 53: 0,
                };
                tmp.primaryReloaded = true;
                tmp.secondaryReloaded = true;
            }
        });
        if (inGame) {
            if (enemy.length) {
                configs.mVeltick && one_tick();
                configs.hVeltick && one_frame(true);
                traps.preplaces[0] = [];
                traps.preplaces[1] = [];
                if (my.autoPush) {
                    if (near.dist2 <= 169) {
                        traps.autoPlace(0, 2, 4);
                    } else if (near.dist2 > 222) {
                        traps.autoPlace(0, 4, 2);
                    }
                } else {
                    if (near.dist2 <= 222) {
                        if (near.inTrap) {
                            if (configs.shameGrindEnabled && instaC && instaC.shame) {
                                instaC.shamegrindRetrap(near);
                            }
                            traps.autoPlace(0, 2, 4);
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
                }
                if (!instaC.isTrue && configs.spikeTick && player.weapons[0] != 8 && player.tailIndex != 11) {
                    if (near.inTrap && near.hitSpike) {
                        let nearReload = near.reloads[near.secondaryIndex == 10 ? near.secondaryIndex : near.primaryIndex];
                        if (items.weapons[player.weapons[0]].speed < nearReload || nearReload < ping.min) {
                            instaC.canSpikeTick = true;
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
                if (nears.length > 1 && nears.some(tmpObj => [undefined, 3, 4, 5].includes(tmpObj.primaryIndex)) && secPacket < 60) {
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
                            if (myDist <= player.scale * 1.8 + items.weapons[player.weapons[0]].range && syncerDist <= player.scale * 1.8 + items.weapons[syncer.primaryIndex || 5].range && player.primaryReloaded && syncer.primaryReloaded) {
                                instaC.spikeTickType();
                            }
                        });
                    });
                }
                if (!instaC.isTrue && configs.predictTick && my.anti0Tick <= 0 && !player.empAnti && !my.forceStop && !near.inTrap && player.tailIndex != 11) {
                    let spikeSync = knockBackPredict();
                    if (spikeSync == "insta them" && (![9, 12, 13, 15].includes(player.weapons[1]) || near.dist2 <= items.weapons[player.weapons[1]].range + player.scale * 1.8)) {
                        instaC.changeType("rev");
                    }
                    if (spikeSync == "primary sync") {
                        instaC.spikeTickType("rev");
                    }
                    let prehit = nearObjs.filter(tmp => tmp.dmg && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 3) <= (tmp.scale + near.scale)).sort(function (a, b) {
                        return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                    })[0];
                    if (prehit) {
                        if (near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8) {
                            instaC.canSpikeTick = true;
                        }
                    }
                }
                tryAutoPush();
                if (!my.autoPush && !debugStop && !player.inTrap) {
                    if (configs.autoPlay && enemy.length && near.dist2 < PF.scale / 2) {
                        let result = createPath.calc({ x: Math.cos(near.aim2 + Math.PI / 2) * (near.scale * 2), y: Math.sin(near.aim2 + Math.PI / 2) * (near.scale * 2) }, false, "follow");
                        PF.paths = result.paths;
                        PF.attempts = result.attempts;
                        if (PF.paths.length > 0) {
                            PF.finded = true;
                            let dir = UTILS.getDirect(PF.paths[1], player, 0, 2);
                            packet("9", dir, 1);
                        } else {
                            result = createPath.calc({ x: 0, y: 0 }, true, "follow");
                            PF.paths = result.paths;
                            PF.attempts = result.attempts;
                            if (PF.paths.length > 0) {
                                PF.finded = true;
                                let dir = UTILS.getDirect(PF.paths[1], player, 0, 2);
                                packet("9", dir, 1);
                            } else {
                                PF.finded = false;
                                packet("9", player.moveDir, 1);
                            }
                        }
                    } else {
                        PF.finded = false;
                    }
                } else {
                    PF.finded = false;
                }
                if (configs.breakAroundSwitch) {
                    if (near.inTrap) {
                        let objs = nearObjs.filter(e => UTILS.getDist(e, near.inTrap, 0, 0) < 200 && !(e.dmg && e.isTeamObject(player)) && e.sid != near.inTrap.sid);
                        objs.forEach(obj => {
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
            if (near.dist2 <= items.weapons[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]].range + near.scale * 1.8 && instaC.wait && !instaC.isTrue && !my.waitHit && player.primaryReloaded && player.secondaryReloaded && instaC.perfCheck(player, near)) {
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
                if (!autoPlace.rangesUpdated[2]) autoPlace.angleRanges(2);
                console.log(autoPlace.ranges[2]);
                autoPlace.debugRender[50] = autoPlace.ranges[2];
            } else {
                autoPlace.debugRender = {};
            }
            if (macro.l) {
                if (targetPlayer) {
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
                }
            }
            sendMoveDir();
            if (mills.place) {
                let item = items.list[player.items[3]];
                if (UTILS.getDist(mills.old, player, 0, 2) >= (item.scale * 2 + 6) && !isNaN(wasdDir)) {
                    let dir = wasdDir + Math.PI;
                    if (macro.f && player.items[4] == 16) {
                        place(3, dir + 1.4);
                        place(3, dir - 1.4);
                    } else {
                        let tmpS = player.scale + item.scale + (items.list[player.items[3]].placeOffset || 0);
                        let tmpX = player.x2 + tmpS * Math.cos(dir);
                        let tmpY = player.y2 + tmpS * Math.sin(dir);
                        let otherAngles = autoPlace.closestPossibleAngles({ x: tmpX, y: tmpY, getScale: function () { return item.scale; } }, 3);
                        place(3, dir);
                        place(3, otherAngles[0]);
                        place(3, otherAngles[1]);
                    }
                    mills.old = { x: player.x2, y: player.y2 };
                    sendAtck(0, getAttackDir());
                }
            }
            if (mills.placeSpawnPads && !isNaN(wasdDir)) {
                let item = items.list[player.items[player.getItemType(20)]];
                let CanPlace = false;
                for (let angle = -Math.PI / 2; angle <= Math.PI / 2; angle += Math.PI) {
                    let testAngle = wasdDir + angle;
                    let tmpS = player.scale + item.scale + (item.placeOffset || 0);
                    let tmpX = player.x2 + tmpS * Math.cos(testAngle);
                    let tmpY = player.y2 + tmpS * Math.sin(testAngle);
                    if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false)) {
                        CanPlace = true;
                    }
                }
                if (CanPlace) {
                    traps.testCanPlace(player.getItemType(20), 0, Math.PI * 2, Math.PI / 2, wasdDir);
                }
            }
            if (instaC.can && my.anti0Tick <= 0 && !player.empAnti && !my.forceStop && secPacket < 69) {
                instaC.changeType((configs.revInsta || player.weapons[1] == 10) ? "rev" : "normal");
            }
            if (instaC.canCounter && my.anti0Tick <= 0 && secPacket < 69) {
                instaC.canCounter = false;
                if (player.primaryReloaded && !instaC.isTrue) {
                    instaC.counterType();
                }
            }
            if (instaC.canSpikeTick && my.anti0Tick <= 0 && !player.empAnti && !my.forceStop && secPacket < 69) {
                instaC.canSpikeTick = false;
                if (player.primaryReloaded && !instaC.isTrue && near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8) {
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
                if (!clicks.middle && !clicks.left && !clicks.right && !instaC.isTrue && !autoBreak.active && my.autoGathering) {
                    sendAutoGather();
                }
                if (!clicks.middle && (clicks.left || clicks.right) && !instaC.isTrue) {
                    if ((player.weaponIndex != (clicks.right && autoBreak.useHammer() ? player.weapons[1] : player.weapons[0])) || player.buildIndex > -1) {
                        selectWeapon(clicks.right && autoBreak.useHammer() ? player.weapons[1] : player.weapons[0]);
                    }
                    if (player[(clicks.right && autoBreak.useHammer() ? "secondary" : "primary") + "Reloaded"] && !my.waitHit && !my.autoGathering) {
                        sendAutoGather();
                        my.waitHit = 1;
                        game.tickBase(() => {
                            my.waitHit = 0;
                        }, 1);
                    }
                }
                if (autoBreak.active) {
                    if (!clicks.left && !clicks.right && !instaC.isTrue) {
                        let weapon = autoBreak.useHammer(autoBreak.target) ? player.weapons[1] : player.weapons[0];
                        if (player.weaponIndex != weapon || player.buildIndex > -1) {
                            selectWeapon(weapon);
                        }
                        if (player[(weapon < 9 ? "primary" : "secondary") + "Reloaded"] && !my.waitHit && !my.autoGathering) {
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
                    if (my.ageInsta && player.weapons[0] != 4 && player.weapons[1] == 9 && player.age >= 9 && enemy.length) {
                        if (!targetPlayer?.visible) {
                            targetPlayer = enemy.sort((a, b) => UTILS.getDist(a, mousePos, 2, 0) - UTILS.getDist(b, mousePos, 2, 0))[0];
                        }
                        instaC.bowMovement();
                    } else {
                        targetPlayer = enemy.sort((a, b) => UTILS.getDist(a, mousePos, 2, 0) - UTILS.getDist(b, mousePos, 2, 0))[0];
                        instaC.rangeType();
                    }
                }
            }
            if (macro.t && !player.inTrap) {
                if (!instaC.isTrue && player.primaryReloaded && (player.weapons[1] != 15 || player.secondaryReloaded) && (player.weapons[0] == 5 || (player.weapons[0] == 4 && player.weapons[1] == 15))) {
                    instaC[getEl("button2").checked ? "newTickMovement" : "tickMovement"]();
                }
            }
            if (!macro.t && !instaC.isTrue && instaC.ticking) {
                instaC.ticking = false;
            }
            if (macro["."] && !player.inTrap) {
                if (!instaC.isTrue && player.primaryReloaded && (![9, 12, 13, 15].includes(player.weapons[1]) || player.secondaryReloaded)) {
                    instaC["boostTickMovement"]();
                }
            }
            if (player.weapons[1] && !clicks.left && !clicks.right && !player.inTrap && !instaC.isTrue && !autoBreak.active) {
                if (player.primaryReloaded && player.secondaryReloaded) {
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
            if (storeMenu.style.display != "block" && !instaC.isTrue && !instaC.ticking) {
                hatChanger();
                accChanger();
            }
            if (configs.autoPrePlace) {
                autoPlace.preplaceRanges = {};
                preplacer();
            }
            if (playersJoining.length && game.tick % 10 == 0 && configs.autoAccept) {
                packet("P", playersJoining[0], 1);
                UTILS.removeAllChildren(notificationDisplay);
            }
            instaC.syncHit = false;
            autoBreak.priority = [[], [], [], []];
            my.anti0Tick--;
            if (configs.weaponGrind) {
                traps.testCanPlace(player.getItemType(22), 0, Math.PI * 2, Math.PI / 2, 0, false, true, 3);
            }
            traps.replaced = false;
        }
    }
}
// UPDATE LEADERBOARD:
let leaderboardAnimatedScores = {};
let leaderboardAnimationId = null;

const LEADERBOARD_COLORS = {
    self: "#fff",
    modUser: "#a8e6cf",
    partyMember: "#88d8ff",
    default: "rgba(255,255,255,0.6)"
};

function animateLeaderboardScores() {
    let needsUpdate = false;

    for (const sid in leaderboardAnimatedScores) {
        const data = leaderboardAnimatedScores[sid];
        if (!data) continue;

        const diff = data.target - data.current;
        if (Math.abs(diff) > 0.5) {
            data.current += diff * 0.1;
            needsUpdate = true;
        } else {
            data.current = data.target;
        }

        if (data.element) {
            data.element.textContent = UTILS.sFormat(Math.round(data.current));
        }
    }

    if (needsUpdate) {
        leaderboardAnimationId = requestAnimationFrame(animateLeaderboardScores);
    } else {
        leaderboardAnimationId = null;
    }
}

function getLeaderboardPlayerInfo(sid, originalName) {
    if (playerSID === sid) {
        return {
            color: LEADERBOARD_COLORS.self,
            displayName: originalName,
            isSelf: true
        };
    }

    const modUsers = modServer.getModUsers();
    const modUser = modUsers.find(user => user.sid === sid);

    if (modUser) {
        const customName = modUser.name || modUser.displayName || originalName;
        return {
            color: LEADERBOARD_COLORS.modUser,
            displayName: customName,
            isModUser: true
        };
    }

    return {
        color: LEADERBOARD_COLORS.default,
        displayName: originalName,
        isDefault: true
    };
}

function updateLeaderboard(data) {
    lastLeaderboardData = data;
    UTILS.removeAllChildren(leaderboardData);

    for (const sid in leaderboardAnimatedScores) {
        leaderboardAnimatedScores[sid].active = false;
    }

    let tmpC = 1;
    for (let i = 0; i < data.length; i += 3) {
        const SID = data[i];
        const playerName = data[i + 1] || "unknown";
        const playerScore = data[i + 2] || 0;

        const playerInfo = getLeaderboardPlayerInfo(SID, playerName);
        const { color: nameColor, displayName } = playerInfo;

        const scoreElement = UTILS.generateElement({
            class: "leaderScore",
            style: `font-size: 14px; color: ${nameColor};`,
            text: UTILS.sFormat(leaderboardAnimatedScores[SID]?.current || playerScore)
        });

        if (!leaderboardAnimatedScores[SID]) {
            leaderboardAnimatedScores[SID] = {
                current: playerScore,
                target: playerScore,
                element: scoreElement,
                active: true
            };
        } else {
            leaderboardAnimatedScores[SID].target = playerScore;
            leaderboardAnimatedScores[SID].element = scoreElement;
            leaderboardAnimatedScores[SID].active = true;
        }

        let extraStyles = "";
        if (playerInfo.isSelf) {
            extraStyles = "font-weight: bold; text-shadow: 0 0 5px rgba(255,255,255,0.5);";
        } else if (playerInfo.isModUser) {
            extraStyles = "font-weight: 600; text-shadow: 0 0 4px rgba(168,230,207,0.4);";
        }

        const leaderHolder = UTILS.generateElement({
            class: "leaderHolder",
            children: [
                UTILS.generateElement({
                    class: "leaderboardItem",
                    style: `font-size: 14px; color: ${nameColor}; ${extraStyles}`,
                    text: `${tmpC}. ${displayName}`
                }),
                scoreElement
            ]
        });

        leaderboardData.appendChild(leaderHolder);
        tmpC++;
    }

    for (const sid in leaderboardAnimatedScores) {
        if (!leaderboardAnimatedScores[sid].active) {
            delete leaderboardAnimatedScores[sid];
        }
    }

    if (!leaderboardAnimationId) {
        leaderboardAnimationId = requestAnimationFrame(animateLeaderboardScores);
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
            (data[i + 7] >= 0 ? {
                sid: data[i + 7]
            } : null));
        i += 8;
    }
}


// ADD AI:
let lastDist = null;
let lastAgentDir = null;
function normCoord(val) {
    return (val / 14400) - 1; // transforms 0..14400 -> -1..1
}
let skinCounter = {
    11: 0.45,
}
let tailCounter = {
    16: 0.15,
    21: 0.25
}

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
    if (!my.healed && player.health < player.maxHealth) {
        if (player.empAnti && sent.hat != 22) {
            player.addDamageThreat("turret", 25);
        }
        if (my.autoGathering) {
            nears.forEach((e) => {
                if (UTILS.getAngleDist(getAttackDir(), e.aim2) <= config.gatherAngle && e.dist2 <= items.weapons[player.weaponIndex].range + player.scale * 1.8) {
                    player.addDamageThreat("counter", items.weapons[sent.weapon||player.weaponIndex].dmg * (sent.hat == 7 ? 1.5 : 1) * (sent.tail == 11 ? 0.2 : 1) * getCounter(e.skinIndex, e.tailIndex));
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
            tmpObj.update();
            i += 7;
        }
    }
    if (!macro.q && !macro.f && !macro.v && !macro.h && !macro.n) {
        packet("D", getAttackDir());
    }
    player.empAnti = false;
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
                let val = items.weapons[index].dmg * (config.weaponVariants[tmpObj[(index < 9 ? "prima" : "seconda") + "ryVariant"]].val) * (items.weapons[index].sDmg || 1) * (tmpObj.skinIndex == 40 ? 3.3 : 1);
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
    tmpObj = findObjectBySid(sid);
    if (tmpObj) {
        tmpObj.xWiggle += config.gatherWiggle * Math.cos(dir);
        tmpObj.yWiggle += config.gatherWiggle * Math.sin(dir);
        //tmpObj.damaged = Math.min(255, tmpObj.damaged + 60);
        objectManager.hitObj.push(tmpObj);
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
                sendChat("Robotis Winn");
            }
        } else {
            if (diff > 0) {
                game.tickBase(() => {
                    player.weaponXP[player.weaponIndex] = (player.weaponXP[player.weaponIndex] || 0) + diff;
                    updateWeaponXPBars();
                }, 1)
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
                selectWeapon((player.weaponIndex < 9 || [9, 12, 13, 15].includes(player.secondaryIndex)) ? player.primaryIndex : player.secondaryIndex);
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
}

// ADD PROJECTILE:
function addProjectile(x, y, dir, range, speed, indx, layer, sid) {
    projectileManager.addProjectile(x, y, dir, range, speed, indx, layer).sid = sid;
    projectileTick.push(Array.prototype.slice.call(arguments));
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
    shutdownDisplay.innerHTML = `Server restarting in ${time}s`
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
    alliances = alliances.filter(e => e.sid != sid);
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
        alliancePlayers.push(data[i])
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
            player.skins[id] = 1
        } else {
            player.latestSkin = id;
        }
    }
}

// SEND MESSAGE:
function receiveChat(sid, message) {
    let tmpPlayer = findPlayerBySID(sid);
    if (tmpPlayer) {
        ChText(`${tmpPlayer.name} {${tmpPlayer.sid}}`, message, tmpPlayer == player || (tmpPlayer.team && tmpPlayer.team == player.team) ? "#8ecc51" : "#fff");
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
    textManager.showText(x, y, 50, 0.18, 500, Math.abs(value), (value >= 0) ? "#fff" : "#8ecc51");
}
function showSettingText(life, setting) {
    textManager.showText(player.x, player.y, player.scale, 0.1, life, setting, "#fff");
}



// RENDER LEAF:
function renderLeaf(x, y, l, r, ctxt) {
    var endX = x + (l * Math.cos(r));
    var endY = y + (l * Math.sin(r));
    var width = l * 0.4;
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

// RENDER HEALTH CIRCLE:
function renderHealthCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
    tmpContext = tmpContext || mainContext;
    tmpContext.beginPath();
    tmpContext.arc(x, y, scale, 0, 2 * Math.PI);
    if (!dontFill) tmpContext.fill();
    if (!dontStroke) tmpContext.stroke();
}

// RENDER STAR SHAPE:
function renderStar(ctxt, spikes, outer, inner) {
    var rot = Math.PI / 2 * 3;
    var x, y;
    var step = Math.PI / spikes;
    ctxt.beginPath();
    ctxt.moveTo(0, -outer);
    for (var i = 0; i < spikes; i++) {
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

// RENDER HEALTH STAR:
function renderHealthStar(ctxt, spikes, outer, inner) {
    var rot = Math.PI / 2 * 3;
    var x, y;
    var step = Math.PI / spikes;
    ctxt.beginPath();
    ctxt.moveTo(0, -outer);
    for (var i = 0; i < spikes; i++) {
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
function renderRect(x, y, w, h, ctxt, stroke) {
    ctxt.fillRect(x - (w / 2), y - (h / 2), w, h);
    if (!stroke)
        ctxt.strokeRect(x - (w / 2), y - (h / 2), w, h);
}

// RENDER HEALTH RECTANGLE:
function renderHealthRect(x, y, w, h, ctxt, stroke) {
    ctxt.fillRect(x - (w / 2), y - (h / 2), w, h);
    if (!stroke)
        ctxt.strokeRect(x - (w / 2), y - (h / 2), w, h);
}

// RENDER RECTCIRCLE:
function renderRectCircle(x, y, s, sw, seg, ctxt, stroke) {
    ctxt.save();
    ctxt.translate(x, y);
    seg = Math.ceil(seg / 2);
    for (var i = 0; i < seg; i++) {
        renderRect(0, 0, s * 2, sw, ctxt, stroke);
        ctxt.rotate(Math.PI / seg);
    }
    ctxt.restore();
}

// RENDER TEXT:
function renderText(x, y, text, ctx) {
    ctx.font = '16px Arial';
    ctx.fillText(text, x, y);
}

// RENDER BLOB:
function renderBlob(ctxt, spikes, outer, inner) {
    var rot = Math.PI / 2 * 3;
    var x, y;
    var step = Math.PI / spikes;
    var tmpOuter;
    ctxt.beginPath();
    ctxt.moveTo(0, -inner);
    for (var i = 0; i < spikes; i++) {
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
    var h = s * (Math.sqrt(3) / 2);
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
    var lineWidth = mainContext.lineWidth || 0;
    var radius = diameter / 2;
    mainContext.beginPath();
    var angles = (Math.PI * 2) / sides;

    for (var index = 0; index < sides; index++) {
        var x = radius + (radius - lineWidth / 2) * Math.cos(angles * index);
        var y = radius + (radius - lineWidth / 2) * Math.sin(angles * index);
        mainContext.lineTo(x, y);
    }

    mainContext.closePath();
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
                ctx.moveTo(PF.paths[PF.paths.length - 1].x - offset.x, PF.paths[PF.paths.length - 1].y - offset.y);
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
        console.error(e)
    };
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
const enemyGhosts = new Map();
let useWasd = false;

window.wasdMode = function () {
    useWasd = !useWasd;
    toggleUseless(useWasd);
};

// GHOST TRAIL SYSTEM
const playerGhost = {
    renderX: null,
    renderY: null,
    renderDir: null,
    targetX: null,
    targetY: null,
    scale: 0,
    skinIndex: 0,
    skinColor: 0,
    weaponIndex: 0,
    buildIndex: -1,
    tailIndex: 0,
    weaponVariant: 0,
    alpha: 0,
    active: false,
};

let lastPlayerX = null;
let lastPlayerY = null;
let playerIsMoving = false;
let movingTimer = 0;

// NORMALIZE ANGLE
function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
}

// RENDER DEAD PLAYERS
function renderDeadPlayers(xOffset, yOffset) {
    mainContext.fillStyle = "#91b2db";
    deadPlayers.filter(d => d.active).forEach(dead => {
        dead.animate(delta);
        mainContext.globalAlpha = dead.alpha;

        mainContext.save();
        mainContext.translate(dead.x - xOffset, dead.y - yOffset);
        mainContext.rotate(dead.dir);
        mainContext.scale(dead.visScale / dead.scale, dead.visScale / dead.scale);

        renderDeadPlayer(dead, mainContext);
        mainContext.restore();

        // Text labels
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

// RENDER PLAYERS
function renderPlayers(xOffset, yOffset, zIndex) {
    mainContext.globalAlpha = 1;
    mainContext.fillStyle = "#91b2db";

    for (let i = 0; i < players.length; ++i) {
        let tmpObj = players[i];
        if (tmpObj.zIndex !== zIndex) continue;

        tmpObj.animate(delta);
        if (!tmpObj.visible) continue;

        tmpObj.skinRot += 0.002 * delta;

        // Determine target direction
        let targetDir;
        if (tmpObj === player && configs.renderDir) {
            const rd = options.renderDir;
            if (rd === "noDir") targetDir = getSafeDir();
            else if (rd === "attackDir" || rd === "alwaysDir") targetDir = getVisualDir();
            else targetDir = tmpObj.dir || 0;
        } else {
            targetDir = tmpObj.dir || 0;
        }

        if (tmpObj.smoothDir === undefined) tmpObj.smoothDir = targetDir;

        const smoothingFactor = tmpObj === player && configs.autoSpin ? 1 : 0.5;
        const angleDifference = normalizeAngle(targetDir - tmpObj.smoothDir);
        tmpObj.smoothDir += angleDifference * smoothingFactor;
        tmpObj.smoothDir = normalizeAngle(tmpObj.smoothDir);

        // Ghost system
        if (tmpObj === player) {
            const currentDir = tmpObj.smoothDir + tmpObj.dirPlus;

            if (lastPlayerX === null) {
                lastPlayerX = tmpObj.x;
                lastPlayerY = tmpObj.y;
                playerGhost.renderX = tmpObj.x;
                playerGhost.renderY = tmpObj.y;
                playerGhost.renderDir = currentDir;
                playerGhost.targetX = tmpObj.x;
                playerGhost.targetY = tmpObj.y;
            }

            const dx = tmpObj.x - lastPlayerX;
            const dy = tmpObj.y - lastPlayerY;
            const speed = Math.sqrt(dx * dx + dy * dy);
            playerIsMoving = speed > 0.5;

            playerGhost.scale = tmpObj.scale;
            playerGhost.skinIndex = tmpObj.skinIndex;
            playerGhost.skinColor = tmpObj.skinColor;
            playerGhost.weaponIndex = tmpObj.weaponIndex;
            playerGhost.buildIndex = tmpObj.buildIndex;
            playerGhost.tailIndex = tmpObj.tailIndex;
            playerGhost.weaponVariant = tmpObj.weaponVariant;

            if (playerIsMoving) {
                movingTimer = 180;
                const moveAngle = Math.atan2(dy, dx);
                const ghostOffset = tmpObj.scale * 1.15;
                playerGhost.targetX = tmpObj.x - Math.cos(moveAngle) * ghostOffset;
                playerGhost.targetY = tmpObj.y - Math.sin(moveAngle) * ghostOffset;

                playerGhost.alpha += (0.38 - playerGhost.alpha) * 0.07;
                playerGhost.active = true;
            } else {
                movingTimer -= delta;
                playerGhost.targetX = tmpObj.x;
                playerGhost.targetY = tmpObj.y;

                if (movingTimer <= 0) {
                    const distToPlayer = Math.sqrt(
                        (playerGhost.renderX - tmpObj.x) ** 2 +
                        (playerGhost.renderY - tmpObj.y) ** 2
                    );
                    if (distToPlayer < 3) {
                        playerGhost.alpha += (0 - playerGhost.alpha) * 0.1;
                        if (playerGhost.alpha < 0.01) {
                            playerGhost.alpha = 0;
                            playerGhost.active = false;
                        }
                    }
                }
            }

            const lerpSpeed = playerIsMoving ? 0.18 : 0.06;
            playerGhost.renderX += (playerGhost.targetX - playerGhost.renderX) * lerpSpeed;
            playerGhost.renderY += (playerGhost.targetY - playerGhost.renderY) * lerpSpeed;

            const dirDiff = normalizeAngle(currentDir - playerGhost.renderDir);
            playerGhost.renderDir += dirDiff * 0.15;
            playerGhost.renderDir = normalizeAngle(playerGhost.renderDir);

            // Draw ghost
            if (isC("Ghost").checked && playerGhost.active && playerGhost.alpha > 0.01) {
                mainContext.save();
                mainContext.globalAlpha = playerGhost.alpha;
                mainContext.translate(playerGhost.renderX - xOffset, playerGhost.renderY - yOffset);

                mainContext.shadowBlur = 20;
                mainContext.shadowColor = "rgba(0,0,0,0.8)";
                mainContext.rotate(playerGhost.renderDir);

                const pulse = 1 + 0.03 * Math.sin(performance.now() * 0.004);
                mainContext.scale(pulse, pulse);

                mainContext.filter = "brightness(0.25) saturate(0.15) hue-rotate(190deg) blur(1.5px)";
                renderPlayer(playerGhost, mainContext);
                mainContext.filter = "none";
                mainContext.shadowBlur = 0;

                mainContext.restore();
            }
        }

        // Render actual player
        mainContext.save();
        mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
        mainContext.rotate(tmpObj.smoothDir + tmpObj.dirPlus);

        const glowOn = isC("playerGlow").checked;
        if (glowOn) {
            mainContext.shadowColor = "rgba(0,0,0,0.85)";
            mainContext.shadowBlur = 18;
            mainContext.filter = "brightness(0.85) saturate(1.1)";
        }
        renderPlayer(tmpObj, mainContext);
        if (glowOn) {
            mainContext.filter = "none";
            mainContext.shadowBlur = 0;
        }

        mainContext.restore();
    }
}

// RENDER DEAD PLAYER
function renderDeadPlayer(obj, ctxt) {
    ctxt = ctxt || mainContext;
    ctxt.lineWidth = outlineWidth;
    ctxt.lineJoin = "miter";

    // Render weapons, tools, skin, etc.
    if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
        renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
    }

    // Inner circle + outer shadow
    const glowInner = isC("playerGlow").checked;
    if (glowInner) {
        ctxt.shadowColor = "rgba(0,0,0,0.85)";
        ctxt.shadowBlur = 18;
        ctxt.filter = "brightness(0.85) saturate(1.1)";
    }
    renderCircle(0, 0, obj.scale, ctxt);
    if (glowInner) {
        ctxt.filter = "none";
        ctxt.shadowBlur = 0;
    }
}

// RENDER PLAYER
function renderPlayer(obj, ctxt) {
    ctxt = ctxt || mainContext;
    ctxt.lineWidth = outlineWidth;
    ctxt.lineJoin = "miter";

    const handAngle = (Math.PI / 4) * (items.weapons[obj.weaponIndex].armS || 1);
    const oHandAngle = obj.buildIndex < 0 ? items.weapons[obj.weaponIndex].hndS || 1 : 1;
    const oHandDist = obj.buildIndex < 0 ? items.weapons[obj.weaponIndex].hndD || 1 : 1;

    if (obj.tailIndex > 0) renderTail(obj.tailIndex, ctxt, obj);

    if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
        renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
    }

    ctxt.fillStyle = config.skinColors[obj.skinColor];
    renderCircle(obj.scale * Math.cos(handAngle), obj.scale * Math.sin(handAngle), 14, ctxt);
    renderCircle(obj.scale * oHandDist * Math.cos(-handAngle * oHandAngle), obj.scale * oHandDist * Math.sin(-handAngle * oHandAngle), 14, ctxt);

    if (obj.buildIndex >= 0) {
        let tmpSprite = getItemSprite(items.list[obj.buildIndex]);
        ctxt.drawImage(tmpSprite, obj.scale - items.list[obj.buildIndex].holdOffset, -tmpSprite.width / 2);
    }

    // Inner slightly darker circle + outer shadow
    const glowDarker = isC("playerGlow").checked;
    if (glowDarker) {
        ctxt.shadowColor = "rgba(0,0,0,0.85)";
        ctxt.shadowBlur = 18;
        ctxt.filter = "brightness(0.85) saturate(1.1)";
    }
    renderCircle(0, 0, obj.scale, ctxt);
    if (glowDarker) {
        ctxt.filter = "none";
        ctxt.shadowBlur = 0;
    }

    if (obj.skinIndex > 0) {
        ctxt.rotate(Math.PI / 2);
        renderSkin(obj.skinIndex, ctxt, null, obj);
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

          // TEXTURIES:
    let newHatImgs = {
        6: "https://i.imgur.com/vM9Ri8g.png",
        7: "https://i.imgur.com/vAOzlyY.png",
        11: "https://i.imgur.com/yfqME8H.png",
        "11_p": "https://i.imgur.com/yfqME8H.png",
        "11_top": "https://i.imgur.com/s7Cxc9y.png",
        15: "https://i.imgur.com/YRQ8Ybq.png",
        26: "https://i.imgur.com/I0xGtyZ.png",
        40: "https://i.imgur.com/pe3Yx3F.png",
        38: "https://i.postimg.cc/Fs8KDTsz/assfurryhacker.webp",
    };
    let newAccImgs = {
        18: "https://i.imgur.com/0rmN7L9.png",
        21: "https://i.imgur.com/4ddZert.png"
    };
    let newWeaponImgs = {
        sword_1_g: "https://i.imgur.com/wOTr8TG.png",
        sword_1_r: "https://i.imgur.com/V9dzAbF.png",
        samurai_1_g: "https://i.imgur.com/QKBc2ou.png",
        samurai_1_r: "https://i.imgur.com/vxLZW0S.png",
        spear_1_g: "https://i.imgur.com/jKDdyvc.png",
        spear_1_r: "https://i.imgur.com/UY7SV7j.png",
        great_hammer_1_d: "https://i.imgur.com/Fg93gj3.png",
        great_hammer_1_r: "https://i.imgur.com/tmUzurk.png",
        bat_1_g: "https://i.imgur.com/ivLPh10.png",
        bat_1_d: "https://i.imgur.com/phXTNsa.png",
        bat_1_r: "https://i.imgur.com/6ayjbIz.png",
    };
    let newAnimalsPack = {
        "enemy": "https://i.postimg.cc/GhhM9WSq/enemy-Num1.webp",
        "pig_1": "https://i.postimg.cc/5yGfKtJT/pig-1.webp",
        "wolf_2": "https://i.imgur.com/wANrStd.png",
        "cow_1": "https://i.imgur.com/7kuCRCr.png",
        "bull_1": "https://i.postimg.cc/jjrSrCfr/bull-3-alt.webp",
        "bull_2": "https://i.imgur.com/eKlFlSj.png",
        "bull_1": "https://i.imgur.com/LwsVi4x.png",
    };

    function getTexturePackImg(e, t) {
        const texturePacks = {
            hat: newHatImgs,
            acc: newAccImgs,
            weapons: newWeaponImgs,
            animals: newAnimalsPack
        };

        if (texturePacks[t] && texturePacks[t][e]) {
            return texturePacks[t][e];
        }

        const pathMap = {
            acc: ".././img/accessories/access_",
            hat: ".././img/hats/hat_",
            animals: ".././img/animals/",
            weapons: ".././img/weapons/"
        };

        return (pathMap[t] || ".././img/weapons/") + e + ".png";
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
            tmpImage.src = getTexturePackImg(index, "hat");
            skinSprites[index] = tmpImage;
            tmpSkin = tmpImage;
        }

        let _ = parentSkin||skinPointers[index];

        if (!_) {
            for (let i = 0; i < hats.length; ++i) {
                if (hats[i].id == index) {
                    _ = hats[i];
                    break;
                }
            }
            skinPointers[index] = _;
        }

        if (tmpSkin.isLoaded) ctxt.drawImage(tmpSkin, -_.scale/2, -_.scale/2, _.scale, _.scale);

        if (!parentSkin && _.topSprite) {
            ctxt.save();
            ctxt.rotate(owner.skinRot);
            renderSkin(index + "_top", ctxt, _, owner);
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
            tmpImage.src = getTexturePackImg(index, "acc");
            accessSprites[index] = tmpImage;
            tmpSkin = tmpImage;
        }

        let _ = accessPointers[index];

        if (!_) {
            for (let i = 0; i < accessories.length; ++i) {
                if (accessories[i].id == index) {
                    _ = accessories[i];
                    break;
                }
            }
            accessPointers[index] = _;
        }

        if (tmpSkin.isLoaded) {
            ctxt.save();
            ctxt.translate(-20 - (_.xOff || 0), 0);
            if (_.spin) ctxt.rotate(owner.skinRot);
            ctxt.drawImage(tmpSkin, -(_.scale / 2), -(_.scale / 2), _.scale, _.scale);
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
            tmpSprite.src = getTexturePackImg(tmpSrc, "weapons");
            toolSprites[tmpSrc] = tmpSprite;
        }

        if (tmpSprite.isLoaded) ctxt.drawImage(tmpSprite, x + obj.xOff - (obj.length / 2), y + obj.yOff - (obj.width / 2), obj.length, obj.width);
    }

     // RENDER PROJECTILES:
        function renderProjectiles(layer, xOffset, yOffset) {
            for (let i = 0; i < projectiles.length; i++) {
                tmpObj = projectiles[i];
                if (tmpObj.active && tmpObj.layer == layer) {
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
        const createEl = teg => document.createElement(teg);
// Game object sprites
let gameObjectSprites = {};

function getResSprite(obj) {
    let biomeID = (obj.y >= config.mapScale - config.snowBiomeTop) ? 2 :
                  ((obj.y <= config.snowBiomeTop) ? 1 : 0);

    let tmpIndex = obj.type + "_" + obj.scale + "_" + biomeID;
    let tmpSprite = gameObjectSprites[tmpIndex];

    if (!tmpSprite) {
        let tmpCanvas = createEl("canvas");
        tmpCanvas.width = tmpCanvas.height = (obj.scale * 2.1) + outlineWidth;

        let tmpContext = tmpCanvas.getContext("2d");
        tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
        tmpContext.rotate(UTILS.randFloat(0, Math.PI));

        tmpContext.strokeStyle = outlineColor;
        tmpContext.lineWidth = outlineWidth;
        tmpContext.globalAlpha = 1;

        // 🌳 TREE
        if (obj.type == 0) {
            let starPoints = Math.random() < 0.5 ? 7 : 5;
            for (let i = 0; i < 2; ++i) {
                let tmpScale = obj.scale * (i === 0 ? 1 : 0.5);

                // Black shadow glow at night
                if (isNight && i === 0) {
                    tmpContext.shadowBlur = 25;
                    tmpContext.shadowColor = "rgba(0,0,0,0.8)";
                } else {
                    tmpContext.shadowBlur = 0;
                    tmpContext.shadowColor = "transparent";
                }

                renderStar(tmpContext, starPoints, tmpScale, tmpScale * 0.7);

                tmpContext.fillStyle = (!biomeID)
                    ? (i === 0 ? "#9ebf57" : "#b4db62")
                    : (i === 0 ? "#e3f1f4" : "#ffffff");

                tmpContext.fill();

                if (i === 0) tmpContext.stroke();
            }
        }

        // 🌿 BUSH
        else if (obj.type == 1) {
            if (biomeID == 2) {
                tmpContext.fillStyle = "#606060";
                renderStar(tmpContext, 6, obj.scale * 0.3, obj.scale * 0.71);
                tmpContext.fill();
                tmpContext.stroke();

                tmpContext.fillStyle = "#89a54c";
                renderCircle(0, 0, obj.scale * 0.55, tmpContext);
                tmpContext.fill();

                tmpContext.fillStyle = "#a5c65b";
                renderCircle(0, 0, obj.scale * 0.3, tmpContext, true);
                tmpContext.fill();
            } else {
                renderBlob(tmpContext, 6, obj.scale, obj.scale * 0.7);

                tmpContext.fillStyle = biomeID ? "#e3f1f4" : "#89a54c";

                // Black shadow glow at night
                tmpContext.shadowBlur = isNight ? 12 : 5;
                tmpContext.shadowColor = "rgba(0,0,0,0.6)";

                tmpContext.fill();
                tmpContext.stroke();

                tmpContext.shadowBlur = 0;
                tmpContext.shadowColor = "transparent";

                tmpContext.fillStyle = biomeID ? "#6a64af" : "#c15555";

                let berries = 4;
                let rotVal = (Math.PI * 2) / berries;

                for (let i = 0; i < berries; ++i) {
                    let tmpRange = UTILS.randInt(obj.scale / 3.5, obj.scale / 2.3);
                    renderCircle(
                        tmpRange * Math.cos(rotVal * i),
                        tmpRange * Math.sin(rotVal * i),
                        UTILS.randInt(10, 12),
                        tmpContext
                    );
                    tmpContext.fill();
                }
            }
        }

        // 🪨 ROCK / GOLD
        else if (obj.type == 2 || obj.type == 3) {
            tmpContext.fillStyle = (obj.type == 2)
                ? (biomeID == 2 ? "#938d77" : "#939393")
                : "#e0c655";

            // Black shadow glow at night
            tmpContext.shadowBlur = isNight ? 15 : 6;
            tmpContext.shadowColor = "rgba(0,0,0,0.5)";

            renderStar(tmpContext, 3, obj.scale, obj.scale);
            tmpContext.fill();
            tmpContext.stroke();

            tmpContext.shadowBlur = 0;
            tmpContext.shadowColor = "transparent";

            tmpContext.fillStyle = (obj.type == 2)
                ? (biomeID == 2 ? "#b2ab90" : "#bcbcbc")
                : "#ebdca3";

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
        tmpContext.shadowColor = `rgba(0, 0, 0, ${Math.min(obj.name == "pit trap" ? 0.6 : 0.3, obj.alpha)})`;
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
// Spike rendering
            } else if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" ||
                obj.name == "spinning spikes") {
                if (asIcon) {
                    tmpContext.fillStyle = "#939393";
                } else if (obj.isTeamObject && obj.isTeamObject(player)) {
                    tmpContext.fillStyle = "#8DDAF2";
                } else {
                    tmpContext.fillStyle = "#EF8888";
                }

                let tmpScale = (reScale * 0.6);
                renderStar(tmpContext, (obj.name == "spikes") ? 5 : 6, reScale, tmpScale);
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

    tmpContext.globalAlpha = 0.35; // <-- transparency (0 = invisible, 1 = fully visible)

    // Add shadow settings
    tmpContext.shadowColor = "rgba(0, 0, 0, 0.7)";
    tmpContext.shadowBlur = 8;
    tmpContext.shadowOffsetX = 0;
    tmpContext.shadowOffsetY = 4;

    tmpContext.fillStyle = "#a5974c";
    renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
    tmpContext.fill();
    tmpContext.stroke();

    tmpContext.fillStyle = outlineColor;
    renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
    tmpContext.fill();

    // Reset shadow
    tmpContext.shadowColor = "transparent";
    tmpContext.shadowBlur = 0;
    tmpContext.shadowOffsetX = 0;
    tmpContext.shadowOffsetY = 0;

    tmpContext.globalAlpha = 1; // <-- reset transparency

    // I removed the second renderStar that was drawing the darker middle
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
    tmpContext.fillStyle = obj.name == "poison spikes" ? "#7b935d" : "#939393";
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
      tmpContext.shadowColor = `rgba(0, 0, 0, ${Math.min(0.3, obj.alpha)})`;
    }
    if (
      obj.name == "spikes" ||
      obj.name == "greater spikes" ||
      obj.name == "poison spikes" ||
      obj.name == "spinning spikes"
    ) {
      tmpContext.fillStyle =
        obj.name == "poison spikes" ? "#7b935d" : "#939393";
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
const damagedObjects = {};

function trackObjectDamage(obj) {
    if (!obj || !obj.sid) return;
    if (!damagedObjects[obj.sid]) {
        damagedObjects[obj.sid] = { lastHitTime: 0, prevHealth: obj.health };
    }
    const prev = damagedObjects[obj.sid];
    if (obj.health < prev.prevHealth) {
        prev.lastHitTime = Date.now();
    }
    prev.prevHealth = obj.health;
}

// RENDER GAME OBJECTS:
function renderGameObjects(layer, xOffset, yOffset) {
    let tmpSprite;
    let tmpX;
    let tmpY;
 // --- 2. MAIN OBJECT RENDER LOOP ---
    gameObjects.forEach((tmpObj) => {
        if (tmpObj.alive) {
            tmpX = tmpObj.x + tmpObj.xWiggle - xOffset;
            tmpY = tmpObj.y + tmpObj.yWiggle - yOffset;

            if (layer == 0) {
                tmpObj.update(delta);
            }

            mainContext.globalAlpha = tmpObj.alpha;

            if (tmpObj.layer == layer && isOnScreen(tmpX, tmpY, tmpObj.scale + (tmpObj.blocker || 0))) {

                if (tmpObj.isItem) {
                    let itemName = tmpObj.name ? tmpObj.name.toLowerCase() : "";
                    let isSpike = itemName.includes("spikes");
                    let isPitTrap = itemName === "pit trap";

                    // --- ORIGINAL ITEM RENDERING ---
                    tmpSprite = getItemSprite(tmpObj);
                    mainContext.save();
                    mainContext.translate(tmpX, tmpY);
                    mainContext.rotate(tmpObj.dir);

                    if (!tmpObj.active) {
                        mainContext.scale(tmpObj.visScale / tmpObj.scale, tmpObj.visScale / tmpObj.scale);
                    }
                    mainContext.globalAlpha = tmpObj.hideFromEnemy ? 1 : tmpObj.alpha;
                    if (tmpObj.reloads <= 0) mainContext.globalAlpha = 0.2;

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
            if (layer == 3) {
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
      if (layer == 0) {
        let allSpikes = gameObjects.filter(obj =>
            obj.alive &&
            obj.isItem &&
            obj.name &&
            obj.name.includes("spikes") &&
            obj.owner && obj.owner.sid === player.sid // ONLY YOUR SPIKES
        );

        mainContext.save();
        let connectedPairs = new Set();
        let connectionCount = {};

        allSpikes.forEach((s1) => {
            if (!connectionCount[s1.sid]) connectionCount[s1.sid] = 0;

            if (connectionCount[s1.sid] < 2) {
                let neighbors = allSpikes
                    .filter(s2 => s1.sid !== s2.sid)
                    .map(s2 => {
                        let dx = s1.x - s2.x;
                        let dy = s1.y - s2.y;
                        return { obj: s2, dist: Math.sqrt(dx * dx + dy * dy) };
                    })
                    .filter(n => n.dist < 210)
                    .sort((a, b) => a.dist - b.dist);

                for (let n of neighbors) {
                    let s2 = n.obj;
                    if (!connectionCount[s2.sid]) connectionCount[s2.sid] = 0;

                    let pairId = [s1.sid, s2.sid].sort().join(',');
                    if (connectionCount[s1.sid] < 2 && connectionCount[s2.sid] < 2 && !connectedPairs.has(pairId)) {

                        connectedPairs.add(pairId);
                        connectionCount[s1.sid]++;
                        connectionCount[s2.sid]++;

                        // CENTER-TO-CENTER CONNECTION
                        let x1 = s1.x - xOffset;
                        let y1 = s1.y - yOffset;
                        let x2 = s2.x - xOffset;
                        let y2 = s2.y - yOffset;

                        // If sprites are defined, adjust to sprite center
                        if (s1.sprite) {
                            x1 += s1.sprite.width / 2;
                            y1 += s1.sprite.height / 2;
                        }
                        if (s2.sprite) {
                            x2 += s2.sprite.width / 2;
                            y2 += s2.sprite.height / 2;
                        }

                        // Thick black outer line
                        mainContext.beginPath();
                        mainContext.lineWidth = 4.5;
                        mainContext.strokeStyle = "#000000";
                        mainContext.shadowBlur = 4;
                        mainContext.shadowColor = "#000000";
                        mainContext.moveTo(x1, y1);
                        mainContext.lineTo(x2, y2);
                        mainContext.stroke();

                        // Inner subtle line
                        mainContext.beginPath();
                        mainContext.lineWidth = 1.5;
                        mainContext.strokeStyle = "rgba(255, 255, 255, 0.3)";
                        mainContext.moveTo(x1, y1);
                        mainContext.lineTo(x2, y2);
                        mainContext.stroke();

                        mainContext.shadowBlur = 0;
                    }
                }
            }
        });

        mainContext.restore();
}

// --- LAYER 0: PLACEMENT & VISUALS ---
if (layer == 0) {
    // 1. Placement Visuals (The "Click" animations)
    if (placeVisible.length) {
        // Cap the array to prevent lag/spam
        if (placeVisible.length > 10) {
            placeVisible.splice(0, placeVisible.length - 10);
        }

        for (let i = placeVisible.length - 1; i >= 0; i--) {
            let p = placeVisible[i];

            // Initialize life if it doesn't exist to prevent NaN errors
            if (p.life === undefined) p.life = 1.0;

            // Draw the shape
            markObject(p, p.x - xOffset, p.y - yOffset, p.life);

            // Fade out
            p.life -= 0.08;

            // Remove when invisible
            if (p.life <= 0) {
                placeVisible.splice(i, 1);
            }
        }
    }

    // 2. Preplace Ghost (The item you are currently holding)
    if (preplaceVisible.length) {
        preplaceVisible.forEach((p) => {
            // Breathing/pulsing effect for the ghost
            let pulse = 0.4 + Math.sin(Date.now() / 200) * 0.15;
            markObject(p, p.x - xOffset, p.y - yOffset, pulse);
        });
    }
}
function drawObjectVisual(context, x, y, item, life = 1) {
    context.save();
    context.translate(x, y);

    const neonGreen = `rgba(57, 255, 20, ${0.8 * life})`;
    const innerAlpha = 0.35;
    const scale = item.scale || 45;
    const name = (item.name || "").toLowerCase();

    // Neon visuals for pit trap
    if (name === "pit trap") {
        context.beginPath();
        renderStar(context, 3, scale * 1.1, scale * 1.1);
        context.fillStyle = `rgba(0, 50, 0, ${innerAlpha})`;
        context.fill();

        context.shadowBlur = 30 * life;
        context.shadowColor = neonGreen;
        context.strokeStyle = neonGreen;
        context.lineWidth = 10;
        context.stroke();

        context.shadowBlur = 0;
        context.strokeStyle = "rgba(0,0,0,0.25)";
        context.lineWidth = 2;
        context.stroke();
    }
    // Neon visuals for spikes
    else if (["spikes","greater spikes","poison spikes","spinning spikes"].includes(name)) {
        const points = name === "spikes" ? 5 : 6;
        const innerRadius = scale * 0.6;

        context.beginPath();
        renderStar(context, points, scale, innerRadius);
        context.fillStyle = `rgba(0, 50, 0, ${innerAlpha})`;
        context.fill();

        context.shadowBlur = 30 * life;
        context.shadowColor = neonGreen;
        context.strokeStyle = neonGreen;
        context.lineWidth = 10;
        context.stroke();

        context.shadowBlur = 0;
        context.strokeStyle = "rgba(0,0,0,0.25)";
        context.lineWidth = 2;
        context.stroke();
    }
    // Invisible fill but smaller black border for other objects
    else {
        const radius = 45; // smaller circle
        const borderWidth = 4; // thicker border

        context.fillStyle = "rgba(0,0,0,0)"; // fully transparent fill
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.fill();

        // black border
        context.strokeStyle = "rgba(0,0,0,0.8)";
        context.lineWidth = borderWidth;
        context.stroke();
        context.closePath();
    }

    context.restore();
}

// Hook into PLACE VISIBLE logic
function markPreplace(tmpObj, tmpX, tmpY, life = 1) {
    drawObjectVisual(mainContext, tmpX, tmpY, tmpObj, life);
}
// Helper: Renders Star/Spike geometry
function renderStar(ctx, points, outer, inner) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        let radius = i % 2 === 0 ? outer : inner;
        let angle = (i * Math.PI) / points - (Math.PI / 2);
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    ctx.closePath();
}
function markObject(tmpObj, tmpX, tmpY, life) {
    drawObjectVisual(mainContext, tmpX, tmpY, tmpObj, life);
}


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

let crossHair = "https://upload.wikimedia.org/wikipedia/commons/9/95/Crosshairs_Red.svg";
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
    let maxVisibleWidth = maxScreenWidth / 2 * 1.3;
    let maxVisibleHeight = maxScreenHeight / 2 * 1.3;
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

    this.generate = function () {
        for (let i = 1; i <= this.amountPaths; i += 1) {
            const offsetY = i % 2 === 0 ? this.distance : 0
            const x = this.startX + this.distance * (i - 1)
            const randomOffsetY = Math.floor(Math.random() * (45 - 10)) + 10
            const y = this.startY + ((this.float === "down" ? offsetY : -offsetY) + (i % 2 === 0 ? (Math.random() < .55 ? randomOffsetY : -randomOffsetY) : 0))

            this.path.set(i, [x, y, offsetY, randomOffsetY])
        }
    }

    this.render = function (color, xOffset, yOffset) {
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
            const sidePoint1 = [oldPoint[0] - pointOffset / 2, oldPoint[1] + (oldPoint[2] === 0 ? pointOffset : -pointOffset)]
            const sidePoint2 = [currentPoint[0] + pointOffset * 1.15, currentPoint[1] + pointOffset * 1.2]
            const sidePoint3 = [currentPoint[0] + pointOffset * 1.35, currentPoint[1] - pointOffset * 1.15]
            const sidePoint4 = [currentPoint[0] - pointOffset * 1.35, currentPoint[1] + pointOffset * 1.15]

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


// 1. UPDATED STATE: Include the colors from your first snippet
let nightModeState = {
    isEnabled: false,
    overlay: {
        opacity: 0,
        // Default colors based on your "blablabla" logic
        activeColor: "rgba(0, 0, 70, 0.49)",
        inactiveColor: "rgba(0, 0, 5, 0.32)"
    },
    starField: []
};

// 2. UPDATED RENDER LOGIC:
let renderShapes = (mainContext, delta, offsetX, offsetY) => {

    // Check the "blablabla" config to drive the night mode state
    // This bridges your checkbox to your advanced star system
    nightModeState.isEnabled = isC("blablabla").checked;

    // Transition the opacity smoothly
    nightModeState.overlay.opacity = nightModeState.isEnabled
        ? Math.min(0.5, nightModeState.overlay.opacity + 0.005) // Speed up fade slightly
        : Math.max(0, nightModeState.overlay.opacity - 0.005);

    // DRAW THE BACKGROUND OVERLAY (From your first snippet)
    if (nightModeState.overlay.opacity > 0) {
        mainContext.save();
        mainContext.globalAlpha = nightModeState.overlay.opacity;

        // Use the colors you specified in the blablabla logic
        mainContext.fillStyle = nightModeState.isEnabled
            ? nightModeState.overlay.activeColor
            : nightModeState.overlay.inactiveColor;

        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        mainContext.restore();
    }

    // STAR LOGIC (Keep as is, but now it triggers based on the overlay opacity)
    if (configs.stars && nightModeState.overlay.opacity > 0) {
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

    // Star Rendering Loop
    if (configs.stars) {
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
            mainContext.globalAlpha = star.transparency * nightModeState.overlay.opacity; // Sync star visibility with night depth
            mainContext.translate(star.posX - (offsetX * star.scaleMultiplier), star.posY - (offsetY * star.scaleMultiplier));
            mainContext.scale(star.size, star.size);

            // Helper to draw the star shape
            mainContext.beginPath();
            mainContext.moveTo(0, -3);
            for (let j = 1; j < 8; j++) {
                let angle = Math.PI / 4 * j;
                let radius = j % 2 === 0 ? 3 : 1.5;
                mainContext.lineTo(Math.sin(angle) * radius, -Math.cos(angle) * radius);
            }
            mainContext.closePath();

            mainContext.fillStyle = star.color;
            mainContext.fill();
            mainContext.restore();
        }
    } else {
        nightModeState.starField = [];
    }
};
let zoomLevel = 1; // Current zoom level
let targetZoomLevel = 1; // Target zoom level for smooth interpolation
let zoomSmoothness = 0.1; // Smoothness factor for zoom (higher = smoother, no bounce)

// Add event listener for mouse wheel zoom (add this outside the function, e.g., in initialization)
document.addEventListener('wheel', function(event) {
    event.preventDefault(); // Prevent default scrolling
    if (event.deltaY < 0) {
        targetZoomLevel *= 1.1; // Zoom in
    } else {
        targetZoomLevel /= 1.1; // Zoom out
    }
    targetZoomLevel = Math.max(0.5, Math.min(2, targetZoomLevel)); // Limit zoom between 0.5x and 2x
});

// Optional: Add keyboard zoom controls (add this outside the function)
document.addEventListener('keydown', function(event) {
    if (event.key === '=') { // Zoom in with '=' key
        targetZoomLevel *= 1.1;
        targetZoomLevel = Math.min(2, targetZoomLevel);
    } else if (event.key === '-') { // Zoom out with '-' key
        targetZoomLevel /= 1.1;
        targetZoomLevel = Math.max(0.5, targetZoomLevel);
    }
});

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

    // Smoothly interpolate zoom level without bounce
    zoomLevel += (targetZoomLevel - zoomLevel) * zoomSmoothness;

    if (configs.CAmera) {
        if (player) {
            let width, targetScreenHeight;
            let smoothness = 0.15; // Smoothness for camera size changes
            width = original1.width * zoomLevel; // Apply smoothed zoom
            targetScreenHeight = original1.height * zoomLevel; // Apply smoothed zoom

            // MOVE CAMERA:
            let targetCamX = player.x, targetCamY = player.y;
            const camSmoothingFactor = 0.01;

            let totalWeight = 0;
            const camMouse = player.visible && configs.mouseCam;
            const playerWeight = camMouse ? 4 : 1;

            if (camMouse) {
                targetCamX = player.x*playerWeight + (mouseX - gameCanvas.width / 2 - player.x + camX)/2;
                targetCamY = player.y*playerWeight + (mouseY - gameCanvas.height / 2 - player.y + camY)/2;
            }

            totalWeight += playerWeight;

            (configs.playersCam && players.forEach(otherPlayer => {
                let getDist = UTILS.getDist(otherPlayer, player, 0, 2);

                if (otherPlayer.visible && getDist <= 800) {
                    targetCamX += otherPlayer.x;
                    targetCamY += otherPlayer.y;
                    totalWeight += 1;
                }
            }));

            (configs.animalCam && ais.forEach(ai => {
                let getDist = UTILS.getDist(ai, player, 0, 2);

                if (ai.visible && getDist <= 500) {
                    targetCamX += ai.x * 0.5;
                    targetCamY += ai.y * 0.5;
                    totalWeight += 0.5;
                }
            }));

            targetCamX /= totalWeight;
            targetCamY /= totalWeight;

            const camDeltaX = targetCamX - camX;
            const camDeltaY = targetCamY - camY;
            const distance = Math.hypot(camDeltaX, camDeltaY);

            if (distance > 0.05) {
                const moveDelta = Math.min(camSmoothingFactor * distance * delta, distance);
                camX += (camDeltaX / distance) * moveDelta;
                camY += (camDeltaY / distance) * moveDelta;
            } else {
                camX = targetCamX;
                camY = targetCamY;
            }

            camX = Math.max(540, Math.min(13840, camX));
            camY = Math.max(200, Math.min(14240, camY));
            maxScreenWidth += (width - maxScreenWidth) * smoothness;
            maxScreenHeight += (targetScreenHeight - maxScreenHeight) * smoothness;
            resize();
        } else {
            maxScreenWidth = config.maxScreenWidth * zoomLevel; // Apply smoothed zoom
            maxScreenHeight = config.maxScreenHeight * zoomLevel; // Apply smoothed zoom
            camX = config.mapScale / 2;
            camY = config.mapScale / 2;
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

       let useWasd = false;


    // RENDER GRID:
    if (isC("grid").checked) {
        mainContext.lineWidth = 4;
        mainContext.strokeStyle = "#000";
        mainContext.globalAlpha = 0.06;
        mainContext.beginPath();
        for (let x = -camX; x < maxScreenWidth; x += useWasd ? 500 : 1000) {
            if (x > 0) {
                mainContext.moveTo(x, 0);
                mainContext.lineTo(x, maxScreenHeight);
            }
        }
        for (let y = -camY; y < maxScreenHeight; y += useWasd ? 500 : 1000) {
            if (y > 0) {
                mainContext.moveTo(0, y);
                mainContext.lineTo(maxScreenWidth, y);
            }
        }
    }
    mainContext.stroke();



        window.wasdMode = function () {
            useWasd = !useWasd;
            toggleUseless(useWasd);
        };


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
        if (config.mapScale - xOffset <= maxScreenWidth) {
            tmpMin = maxScreenWidth - (config.mapScale - xOffset);
        }
        mainContext.fillRect(tmpX, config.mapScale - yOffset,
            (maxScreenWidth - tmpX) - tmpMin, maxScreenHeight - (config.mapScale - yOffset));
    }
   // RENDER DAY/NIGHT TIME:
    function renderDayNight() {
    mainContext.globalAlpha = 1;

    if (isC("blablabla").checked) {
        const gradient = mainContext.createRadialGradient(
            maxScreenWidth / 2, maxScreenHeight / 2, 0,
            maxScreenWidth / 2, maxScreenHeight / 2, maxScreenWidth / 2
        );
     mainContext.globalAlpha = 1;
 mainContext.fillStyle = "rgba(0, 0, 70, 0.35)";

        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);

    } else {
        mainContext.fillStyle = "rgba(0, 0, 5, 0.25)";;
    }

    mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);

}
renderDayNight();
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
    mainContext.globalAlpha = 0.3;
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
      mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
      mainContext.rotate(angle);
      mainContext.drawImage(crossHairSprites, -tmpS / 2, -tmpS / 2, tmpS, tmpS);
      mainContext.restore();
    }

    mainContext.globalAlpha = 1;
  }

  // HEALTH BAR
  if (tmpObj.health > 0) {
    let curr = tmpObj.prevHW || ((config.healthBarWidth * 2) * (tmpObj.health / tmpObj.maxHealth));

    // background
    mainContext.fillStyle = darkOutlineColor;
    mainContext.roundRect(
      tmpObj.x - xOffset - config.healthBarWidth - config.healthBarPad,
      (tmpObj.y - yOffset + tmpObj.scale) + config.nameY,
      (config.healthBarWidth * 2) + (config.healthBarPad * 2),
      17,
      8
    );
    mainContext.fill();

    let thw = (config.healthBarWidth * 2) * (tmpObj.health / tmpObj.maxHealth);

    // damage animation
    if (tmpObj.prevHW !== undefined) {
      tmpObj.prevDW = tmpObj.prevDW || tmpObj.prevHW;
      tmpObj.prevDW += (thw - tmpObj.prevDW) * 0.03;
    }

    curr += (thw - curr) * 0.2;
    tmpObj.prevHW = curr;

    // damage (yellow/red lag bar)
    mainContext.fillStyle = (tmpObj.sid == player.sid || (tmpObj.team && tmpObj.team == player.team)) ? "#FF6666" : "#FFFF66";
    mainContext.roundRect(
      tmpObj.x - xOffset - config.healthBarWidth,
      (tmpObj.y - yOffset + tmpObj.scale) + config.nameY + config.healthBarPad,
      tmpObj.prevDW,
      17 - config.healthBarPad * 2,
      7
    );
    mainContext.fill();

    // === MAIN HEALTH BAR WITH GLOW ===
    let isFriendly = (tmpObj.sid == player.sid || (tmpObj.team && tmpObj.team == player.team));
    let barColor = isFriendly ? "#8ecc51" : "#cc5151";

    // CONSTANT GLOW (no animation)
    mainContext.shadowBlur = 28;
    mainContext.shadowColor = barColor;

    mainContext.fillStyle = barColor;
    mainContext.roundRect(
      tmpObj.x - xOffset - config.healthBarWidth,
      (tmpObj.y - yOffset + tmpObj.scale) + config.nameY + config.healthBarPad,
      curr,
      17 - config.healthBarPad * 2,
      7
    );
    mainContext.fill();

    // reset so other drawings don't glow
    mainContext.shadowBlur = 0;
    mainContext.shadowColor = "transparent";

    if (tmpObj.isPlayer) {
      mainContext.globalAlpha = 1;

      // SHAME COUNT:
      mainContext.globalAlpha = 0.3;
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
      mainContext.globalAlpha = 1;

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

                        // Search ray: player → candidate placement
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

                // Committed placements this tick — yellow dashed rings
                traps.preplaces[1].forEach(p => {
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
if (tmpObj.sid == player.sid) {
    for (let radius in autoPlace.debugRender) {
        autoPlace.debugRender[radius].forEach(range => {
            let startAngle = range[0];
            let endAngle = range[1];
            let r = parseInt(radius);

            // Outer glow (soft, wide bloom)
            mainContext.beginPath();
            mainContext.strokeStyle = "rgba(0, 255, 70, 0.08)";
            mainContext.lineWidth = 4;
            mainContext.shadowColor = "#00ff46";
            mainContext.shadowBlur = 14;
            mainContext.arc(tmpObj.x - xOffset, tmpObj.y - yOffset, r, startAngle, endAngle);
            mainContext.stroke();

            // Middle glow
            mainContext.beginPath();
            mainContext.strokeStyle = "rgba(0, 255, 70, 0.25)";
            mainContext.lineWidth = 1.5;
            mainContext.shadowColor = "#00ff46";
            mainContext.shadowBlur = 8;
            mainContext.arc(tmpObj.x - xOffset, tmpObj.y - yOffset, r, startAngle, endAngle);
            mainContext.stroke();

            // Core — razor thin
            mainContext.beginPath();
            mainContext.strokeStyle = "#00ff46";
            mainContext.lineWidth = 0.5;
            mainContext.shadowColor = "#00ff46";
            mainContext.shadowBlur = 5;
            mainContext.arc(tmpObj.x - xOffset, tmpObj.y - yOffset, r, startAngle, endAngle);
            mainContext.stroke();

            // Reset shadow
            mainContext.shadowBlur = 0;
            mainContext.shadowColor = "transparent";
        });
    };
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
    mainContext.fillStyle = `#39FF14`;
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
        if (player.alive) {
            drawCircles(tmpObj, xOffset, yOffset)
            mainContext.globalAlpha = 1;
            mainContext.fillStyle = "#fff";
            mainContext.strokeStyle = "#000";
            renderCircle(my.pushData.x2 - xOffset, my.pushData.y2 - yOffset, 20);
            if (testRender.x) {
                renderCircle(testRender.x - xOffset, testRender.y - yOffset, 20);
            }
        }



    }

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
}
window.rAF = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function (callback) {
            workerSetTimeout(callback, 1000 / 60);
        };
})();


        // UPDATE & ANIMATE:
        window.requestAnimFrame = function () {
            return null;
        }
        window.rAF = (function () {
            return window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                function (callback) {
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
document.getElementById("pingInfo").innerText =
    `Ping: ${UTILS.round(ping.avg, 10)} ms | FPS: ${UTILS.round(fpsTimer.ltime, 10)} | Packets: ${secPacket}`;

drawPingGraph(ping.avg);

            updateGame();
            window.rAF(doUpdate);
        }
// Create the HUD container
const pingHud = document.createElement("div");
pingHud.style.cssText = `
    position: fixed;
    top: 9px;
    left: 50%;
    transform: translateX(-940px); /* moved left */
    width: 260px;
    height: 110px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 12px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    color: #CCCCCC;
    z-index: 999999;
    pointer-events: none;
    overflow: hidden;
`;

// Add ping info and canvas
pingHud.innerHTML = `
    <div id="pingInfo" style="margin-bottom:8px;">Ping: 0 ms | FPS: 0 | Packets: 0</div>
    <canvas id="pingGraph" width="260" height="80"></canvas>
`;

document.body.appendChild(pingHud);

const pingCanvas = document.getElementById("pingGraph");
const pingCtx = pingCanvas.getContext("2d");

const pingGraphData = {
    values: [],
    maxValues: 60
};

function drawPingGraph(pingValue) {
    pingGraphData.values.push(pingValue);
    if (pingGraphData.values.length > pingGraphData.maxValues) {
        pingGraphData.values.shift();
    }

    pingCtx.clearRect(0, 0, pingCanvas.width, pingCanvas.height);

    // Full dense grid background
    pingCtx.strokeStyle = 'rgba(200, 200, 200, 0.15)';
    pingCtx.lineWidth = 1;
    const gridSpacing = 18; // very dense
    for (let x = 0; x <= pingCanvas.width; x += gridSpacing) {
        pingCtx.beginPath();
        pingCtx.moveTo(x, 0);
        pingCtx.lineTo(x, pingCanvas.height);
        pingCtx.stroke();
    }
    for (let y = 0; y <= pingCanvas.height; y += gridSpacing) {
        pingCtx.beginPath();
        pingCtx.moveTo(0, y);
        pingCtx.lineTo(pingCanvas.width, y);
        pingCtx.stroke();
    }

    // Semi-transparent area under line
    pingCtx.fillStyle = "rgba(124, 255, 0, 0.1)";
    pingCtx.beginPath();
    pingGraphData.values.forEach((v, i) => {
        const x = (i / pingGraphData.maxValues) * pingCanvas.width;
        const y = pingCanvas.height - Math.min(v / 200, 1) * pingCanvas.height;
        if (i === 0) pingCtx.moveTo(x, y);
        else pingCtx.lineTo(x, y);
    });
    pingCtx.lineTo(pingCanvas.width, pingCanvas.height);
    pingCtx.lineTo(0, pingCanvas.height);
    pingCtx.closePath();
    pingCtx.fill();

    // Strong green line
    pingCtx.strokeStyle = "#00FF00";
    pingCtx.shadowColor = "#00FF00";
    pingCtx.shadowBlur = 8;
    pingCtx.lineWidth = 3;
    pingCtx.beginPath();
    pingGraphData.values.forEach((v, i) => {
        const x = (i / pingGraphData.maxValues) * pingCanvas.width;
        const y = pingCanvas.height - Math.min(v / 200, 1) * pingCanvas.height;
        if (i === 0) pingCtx.moveTo(x, y);
        else pingCtx.lineTo(x, y);
    });
    pingCtx.stroke();

    pingCtx.shadowBlur = 0; // reset
}

// Simulate ping updates
setInterval(() => {
    const ping = Math.floor(Math.random() * 150);
    const fps = Math.floor(50 + Math.random() * 10);
    const packets = Math.floor(Math.random() * 10);
    document.getElementById("pingInfo").textContent = `Ping: ${ping} ms | FPS: ${fps} | Packets: ${packets}`;
    drawPingGraph(ping);
}, 1000);


        prepareMenuBackground();
        doUpdate();

window.debug = function () {
    workerClearTimeout(debugTimeout)
    PF.paths.length = 0;
    my.waitHit = 0;
    my.autoAim = false;
    instaC.isTrue = false;
    autoBreak.active = false;
    my.anti0Tick = 0;
    player.antiTimer = 2;
    my.bullTick = 0;
    my.reSync = true;
    itemSprites.length = 0;
    objSprites.length = 0;
    gameObjectSprites.length = 0;
    debugStop = true;
    debugTimeout = workerSetTimeout(() => {
        debugStop = false
    }, 5000);
    game.tick = 0;
    petals.length = 0;
    for (let i = 0; i < 5; i++) {
        petals.push(new Petal(player.x, player.y));
    }
    config.resetRender = true;
    placeVisible.length = 0;
    preplaceVisible.length = 0;
    console.clear()
    console.log(alliancePlayers, alliances)
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
        bar.style.width = (pct * 100) + "%";
        bar.style.backgroundColor = xp < 3000 ? "#f7cf45" : xp < 7000 ? "#6d92cd" : "#be5455";
    }
}
window.prepareUI = function (tmpObj) {
    resize();
    // ACTION BAR:
    UTILS.removeAllChildren(actionBar);
    for (let i = 0; i < (items.weapons.length + items.list.length); ++i) {
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
                tmpContext.rotate((Math.PI / 4) + Math.PI);
                let tmpSprite = new Image();
                toolSprites[items.weapons[i].src] = tmpSprite;
                tmpSprite.onload = function () {
                    this.isLoaded = true;
                    let tmpPad = 1 / (this.height / this.width);
                    let tmpMlt = (items.weapons[i].iPad || 1);
                    tmpContext.drawImage(this, -(tmpCanvas.width * tmpMlt * config.iconPad * tmpPad) / 2, -(tmpCanvas.height * tmpMlt * config.iconPad) / 2,
                        tmpCanvas.width * tmpMlt * tmpPad * config.iconPad, tmpCanvas.height * tmpMlt * config.iconPad);
                    tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
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
                tmpUnit.style.position = "relative";
                let bar = addWeaponXPBar(tmpUnit)
                tmpUnit._xpBar = bar;
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


}

(function __carBootStart(tries) {
    tries = tries || 0;
    var page = document.readyState !== "loading" && document.getElementById("gameUI");
    var bundle = window.loadedScript === true || document.readyState === "complete";
    if ((!page || !bundle) && tries < 400) {
        return setTimeout(function () { __carBootStart(tries + 1); }, 50);
    }
    __carBoot();
})();
