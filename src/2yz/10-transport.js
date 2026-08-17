/* ===========================================================================
 * 2yz / Transport
 * ---------------------------------------------------------------------------
 * 2yz does not reach into the game bundle. It attaches one level lower, at the
 * socket, and keeps its own view of the world built from the wire. That choice
 * is what makes the rest of the client independent: there is no minified
 * identifier anywhere in 2yz, so a rebuild of the game bundle cannot silently
 * unbind a hook.
 *
 * Everything in this file is a transcription of the shipped transport in
 * src/game_index.js:
 *
 *   Co   292-ish  splitmix-style seeded PRNG
 *   Oi   292      seeded Fisher-Yates permutation of an opcode alphabet
 *   Po   312      builds {c2s, s2c} from the io-init seed
 *   Vt   320      SHA-256
 *   Ao   381      HMAC-SHA256
 *   Eo   397      HMAC truncated to protocol.signatureBytes
 *   Ro   400      hex string -> bytes
 *   O    409      the socket itself: io-init handling, framing, send
 *
 * Frame layout, secure mode (game_index.js:467-480):
 *   [ 6 bytes HMAC-SHA256(key, payload) ][ payload = msgpack([op, args, seq]) ]
 *
 * 2yz takes ownership of the sequence counter. Every outbound frame -- the
 * game's own as much as 2yz's -- is decoded, re-numbered and re-signed here, so
 * there is exactly one writer to the socket and exactly one seq series. That is
 * what lets PacketScheduler reorder, drop and budget packets safely.
 * =========================================================================== */

const Transport = (function () {
    const NativeWebSocket = window.WebSocket;
    const nativeSend = NativeWebSocket.prototype.send;

    const utf8enc = new TextEncoder();
    const utf8dec = new TextDecoder();

    /* ---------------------------------------------------------------- msgpack */

    function Writer() {
        this.buf = new Uint8Array(2048);
        this.view = new DataView(this.buf.buffer);
        this.pos = 0;
    }
    Writer.prototype.need = function (n) {
        if (this.pos + n <= this.buf.byteLength) return;
        let size = this.buf.byteLength * 2;
        while (size < this.pos + n) size *= 2;
        const next = new Uint8Array(size);
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
    Writer.prototype.raw = function (b) { this.need(b.length); this.buf.set(b, this.pos); this.pos += b.length; };

    function encodeValue(w, v) {
        if (v === null || v === undefined) return w.u8(0xc0);
        const t = typeof v;
        if (t === 'boolean') return w.u8(v ? 0xc3 : 0xc2);
        if (t === 'number') return encodeNumber(w, v);
        if (t === 'string') return encodeString(w, v);
        if (Array.isArray(v)) {
            const n = v.length;
            if (n < 16) w.u8(0x90 | n);
            else if (n < 65536) { w.u8(0xdc); w.u16(n); }
            else { w.u8(0xdd); w.u32(n); }
            for (let i = 0; i < n; i++) encodeValue(w, v[i]);
            return undefined;
        }
        if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer) {
            const b = v instanceof ArrayBuffer
                ? new Uint8Array(v)
                : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
            if (b.length < 256) { w.u8(0xc4); w.u8(b.length); }
            else if (b.length < 65536) { w.u8(0xc5); w.u16(b.length); }
            else { w.u8(0xc6); w.u32(b.length); }
            return w.raw(b);
        }
        const keys = Object.keys(v);
        const n = keys.length;
        if (n < 16) w.u8(0x80 | n);
        else if (n < 65536) { w.u8(0xde); w.u16(n); }
        else { w.u8(0xdf); w.u32(n); }
        for (let i = 0; i < n; i++) {
            encodeString(w, keys[i]);
            encodeValue(w, v[keys[i]]);
        }
        return undefined;
    }

    function encodeNumber(w, v) {
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

    function encodeString(w, s) {
        const b = utf8enc.encode(s);
        const n = b.length;
        if (n < 32) w.u8(0xa0 | n);
        else if (n < 256) { w.u8(0xd9); w.u8(n); }
        else if (n < 65536) { w.u8(0xda); w.u16(n); }
        else { w.u8(0xdb); w.u32(n); }
        w.raw(b);
    }

    function encode(value) {
        const w = new Writer();
        encodeValue(w, value);
        return w.buf.subarray(0, w.pos);
    }

    function Reader(bytes) {
        this.b = bytes;
        this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        this.pos = 0;
    }
    Reader.prototype.read = function () {
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
            case 0xcf: { const hi = this.u32(); const lo = this.u32(); return hi * 4294967296 + lo; }
            case 0xd0: { const v = this.view.getInt8(this.pos); this.pos += 1; return v; }
            case 0xd1: { const v = this.view.getInt16(this.pos); this.pos += 2; return v; }
            case 0xd2: { const v = this.view.getInt32(this.pos); this.pos += 4; return v; }
            case 0xd3: { const hi = this.view.getInt32(this.pos); const lo = this.view.getUint32(this.pos + 4); this.pos += 8; return hi * 4294967296 + lo; }
            case 0xd9: return this.str(this.u8());
            case 0xda: return this.str(this.u16());
            case 0xdb: return this.str(this.u32());
            case 0xdc: return this.arr(this.u16());
            case 0xdd: return this.arr(this.u32());
            case 0xde: return this.map(this.u16());
            case 0xdf: return this.map(this.u32());
            default: throw new Error('2yz: unsupported msgpack byte 0x' + c.toString(16));
        }
    };
    Reader.prototype.u8 = function () { return this.view.getUint8(this.pos++); };
    Reader.prototype.u16 = function () { const v = this.view.getUint16(this.pos); this.pos += 2; return v; };
    Reader.prototype.u32 = function () { const v = this.view.getUint32(this.pos); this.pos += 4; return v; };
    Reader.prototype.str = function (n) {
        const s = utf8dec.decode(this.b.subarray(this.pos, this.pos + n));
        this.pos += n;
        return s;
    };
    Reader.prototype.bin = function (n) {
        const s = this.b.subarray(this.pos, this.pos + n);
        this.pos += n;
        return s;
    };
    Reader.prototype.arr = function (n) {
        const out = new Array(n);
        for (let i = 0; i < n; i++) out[i] = this.read();
        return out;
    };
    Reader.prototype.map = function (n) {
        const out = {};
        for (let i = 0; i < n; i++) { const k = this.read(); out[k] = this.read(); }
        return out;
    };

    function decode(bytes) { return new Reader(bytes).read(); }

    /* ------------------------------------------------------- opcode tables */

    /* game_index.js:283  Co */
    function seededRandom(seed) {
        let s = seed | 0;
        return function () {
            s = (s + 1831565813) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /* game_index.js:292  Oi */
    function permute(alphabet, seed) {
        const n = alphabet.length;
        const order = alphabet.map((_, i) => i);
        const rand = seededRandom(seed >>> 0);
        for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            const tmp = order[i];
            order[i] = order[j];
            order[j] = tmp;
        }
        const enc = {};
        const dec = {};
        for (let i = 0; i < n; i++) {
            enc[alphabet[i]] = order[i];
            dec[order[i]] = alphabet[i];
        }
        return { enc, dec };
    }

    /* game_index.js:312  Po -- tableSalt comes from drivers, not from a literal */
    function buildTables(seed) {
        const salted = (seed ^ Math.imul(Defs.protocol.tableSalt, 2654435761)) >>> 0;
        return {
            c2s: permute(Defs.protocol.c2sAlphabet, salted),
            s2c: permute(Defs.protocol.s2cAlphabet, (salted ^ 2246822507) >>> 0)
        };
    }

    /* ------------------------------------------------------------ SHA-256 */

    const K = new Uint32Array([
        1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993,
        2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987,
        1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774,
        264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
        2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711,
        113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291,
        1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411,
        3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
        430227734, 506948616, 659060556, 883997877, 958139571, 1322822218,
        1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424,
        2428436474, 2756734187, 3204031479, 3329325298
    ]);

    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

    /* game_index.js:320  Vt */
    function sha256(bytes) {
        const h = new Uint32Array([
            1779033703, 3144134277, 1013904242, 2773480762,
            1359893119, 2600822924, 528734635, 1541459225
        ]);
        const len = bytes.length;
        const bitLen = len * 8;
        const padded = new Uint8Array(Math.ceil((len + 9) / 64) * 64);
        padded.set(bytes);
        padded[len] = 0x80;
        const view = new DataView(padded.buffer);
        view.setUint32(padded.length - 4, bitLen >>> 0, false);
        view.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296), false);

        const w = new Uint32Array(64);
        for (let off = 0; off < padded.length; off += 64) {
            for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
            for (let i = 16; i < 64; i++) {
                const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
                const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
            }
            let a = h[0], b = h[1], c = h[2], d = h[3];
            let e = h[4], f = h[5], g = h[6], hh = h[7];
            for (let i = 0; i < 64; i++) {
                const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
                const ch = (e & f) ^ (~e & g);
                const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
                const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
                const maj = (a & b) ^ (a & c) ^ (b & c);
                const t2 = (S0 + maj) | 0;
                hh = g; g = f; f = e;
                e = (d + t1) | 0;
                d = c; c = b; b = a;
                a = (t1 + t2) | 0;
            }
            h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0;
            h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
            h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0;
            h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
        }
        const out = new Uint8Array(32);
        const ov = new DataView(out.buffer);
        for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i], false);
        return out;
    }

    const BLOCK = 64;

    /* game_index.js:381  Ao */
    function hmac(key, message) {
        let k = key;
        if (k.length > BLOCK) k = sha256(k);
        const padded = new Uint8Array(BLOCK);
        padded.set(k);
        const inner = new Uint8Array(BLOCK + message.length);
        const outer = new Uint8Array(BLOCK + 32);
        for (let i = 0; i < BLOCK; i++) {
            inner[i] = padded[i] ^ 0x36;
            outer[i] = padded[i] ^ 0x5c;
        }
        inner.set(message, BLOCK);
        outer.set(sha256(inner), BLOCK);
        return sha256(outer);
    }

    /* game_index.js:397  Eo -- width comes from drivers, not from a literal 6 */
    function sign(key, payload) {
        return hmac(key, payload).subarray(0, Defs.protocol.signatureBytes);
    }

    /* game_index.js:400  Ro */
    function hexToBytes(hex) {
        const out = new Uint8Array(hex.length / 2);
        for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
        return out;
    }

    /* -------------------------------------------------------------- session */

    const session = {
        socket: null,
        mode: null,       // null until io-init; Defs.protocol.encryptedMode when secure
        key: null,
        tables: null,
        seq: 0,
        ready: false
    };

    const listeners = { inbound: [], outbound: [], open: [], close: [] };

    function emit(channel, a, b) {
        const list = listeners[channel];
        for (let i = 0; i < list.length; i++) {
            try { list[i](a, b); } catch (err) { Log.error('transport/' + channel, err); }
        }
    }

    /* Turn a decoded outbound frame back into bytes, stamping a fresh seq.
     * This is the ONLY place a c2s frame is serialised. */
    function frame(name, args) {
        if (session.mode === Defs.protocol.encryptedMode && session.tables) {
            const op = session.tables.c2s.enc[name];
            if (op === undefined) return null;
            const seq = ++session.seq;
            const payload = encode([op, args, seq]);
            const sig = sign(session.key, payload);
            const out = new Uint8Array(Defs.protocol.signatureBytes + payload.length);
            out.set(sig, 0);
            out.set(payload, Defs.protocol.signatureBytes);
            return out;
        }
        return encode([name, args]);
    }

    /* Decode an outbound frame produced by the game bundle, so 2yz can see what
     * the human is doing and can re-stamp it. Returns {name, args} or null. */
    function unframe(bytes) {
        try {
            if (session.mode === Defs.protocol.encryptedMode && session.tables) {
                const payload = bytes.subarray(Defs.protocol.signatureBytes);
                const parsed = decode(payload);
                if (!Array.isArray(parsed)) return null;
                const name = session.tables.c2s.dec[parsed[0]];
                if (name === undefined) return null;
                return { name, args: parsed[1] || [] };
            }
            const parsed = decode(bytes);
            if (!Array.isArray(parsed)) return null;
            return { name: parsed[0], args: parsed[1] || [] };
        } catch (err) {
            return null;
        }
    }

    function handleInbound(bytes) {
        let parsed;
        try { parsed = decode(bytes); } catch (err) { return; }
        if (!Array.isArray(parsed)) return;

        let name = parsed[0];
        const args = parsed[1] || [];

        if (name === 'io-init') {
            if (args[3] === Defs.protocol.encryptedMode) {
                session.mode = Defs.protocol.encryptedMode;
                session.key = hexToBytes(args[2]);
                session.tables = buildTables(args[1] >>> 0);
                session.seq = 0;
            } else {
                session.mode = null;
                session.key = null;
                session.tables = null;
            }
            session.ready = true;
            emit('open', session);
            return;
        }

        if (session.tables && typeof name === 'number') {
            name = session.tables.s2c.dec[name];
            if (name === undefined) return;
        }
        emit('inbound', name, args);
    }

    /* --------------------------------------------------------------- hook */

    function install() {
        const proto = NativeWebSocket.prototype;
        const origSend = proto.send;

        proto.send = function (data) {
            if (this !== session.socket) return origSend.call(this, data);

            const bytes = data instanceof Uint8Array
                ? data
                : data instanceof ArrayBuffer
                    ? new Uint8Array(data)
                    : null;
            if (!bytes) return origSend.call(this, data);

            const parsed = unframe(bytes);
            if (!parsed) return origSend.call(this, data);

            /* Hand the game's own packet to the scheduler rather than letting it
             * through directly. The scheduler decides whether it survives, and
             * re-frames it so the seq series stays 2yz's. */
            emit('outbound', parsed.name, parsed.args);
            return undefined;
        };

        window.WebSocket = function PatchedWebSocket(url, protocols) {
            const socket = protocols === undefined
                ? new NativeWebSocket(url)
                : new NativeWebSocket(url, protocols);

            /* The game only opens one game socket; the newest one wins. */
            session.socket = socket;
            session.mode = null;
            session.tables = null;
            session.key = null;
            session.seq = 0;
            session.ready = false;

            socket.addEventListener('message', function (event) {
                if (!(event.data instanceof ArrayBuffer)) return;
                handleInbound(new Uint8Array(event.data));
            });
            socket.addEventListener('close', function () {
                if (session.socket === socket) {
                    session.ready = false;
                    session.tables = null;
                    emit('close', session);
                }
            });
            return socket;
        };
        window.WebSocket.prototype = NativeWebSocket.prototype;
        /* readyState constants are non-enumerable on the native constructor, so
         * Object.assign would miss them and any `WebSocket.OPEN` comparison in
         * the game bundle would become undefined. */
        window.WebSocket.CONNECTING = NativeWebSocket.CONNECTING;
        window.WebSocket.OPEN = NativeWebSocket.OPEN;
        window.WebSocket.CLOSING = NativeWebSocket.CLOSING;
        window.WebSocket.CLOSED = NativeWebSocket.CLOSED;
    }

    return {
        install,
        session,
        encode,
        decode,
        frame,
        /* Put a framed packet on the wire. PacketScheduler is the only caller. */
        write(name, args) {
            const socket = session.socket;
            if (!socket || socket.readyState !== 1) return false;
            const bytes = frame(name, args);
            if (!bytes) return false;
            nativeSend.call(socket, bytes);
            return true;
        },
        on(channel, fn) { listeners[channel].push(fn); },
        isReady() { return session.ready && session.socket && session.socket.readyState === 1; }
    };
})();
