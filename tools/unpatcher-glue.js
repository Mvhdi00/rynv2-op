
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
 * ======================================================================== */
const UNPATCH = (function () {
    "use strict";

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

    // Takes whatever a mod handed us and puts it on the wire correctly.
    function transmit(sock, data) {
        const bytes = toBytes(data);
        if (!bytes) return EXP.nativeSend.call(sock, data);
        if (!EXP.isSecure(sock)) return EXP.nativeSend.call(sock, bytes);
        if (isAlreadyFramed(sock, bytes)) return EXP.nativeSend.call(sock, bytes);
        try {
            const parsed = EXP.decode(bytes);
            if (Array.isArray(parsed) && typeof parsed[0] === "string") {
                const name = outName(parsed[0]);
                if (!EXP.send(sock, name, parsed[1] === undefined ? [] : parsed[1]))
                    console.warn('[unpatch] dropped unknown packet "' + parsed[0] + '"');
                return;
            }
        } catch (e) { /* not plain msgpack */ }
        // Neither a frame nor msgpack. Raw garbage on an authenticated channel
        // gets the session dropped, so it stops here.
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
    const hasOnMessage = new WeakSet();
    const wrapped = new WeakSet();     // never wrap the same listener twice
    let activeSocket = null;

    function translateForMod(sock, data) {
        const parsed = EXP.receive(sock, data);
        if (!parsed) return null;
        return EXP.encode([inName(parsed.type), parsed.args]);
    }

    const addEL = WebSocket.prototype.addEventListener;
    WebSocket.prototype.addEventListener = function (type, fn, opts) {
        if (type !== "message" || typeof fn !== "function") return addEL.call(this, type, fn, opts);
        if (wrapped.has(fn)) return addEL.call(this, type, fn, opts);
        const sock = this
            , rewrite = hasOnMessage.has(this);
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
                    const first = !hasOnMessage.has(sock);
                    hasOnMessage.add(sock);
                    return desc.set.call(this, function (ev) {
                        activeSocket = sock;
                        try {
                            if (first) return fn.call(this, ev);   // the game's
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
    window.msgpack = {
        encode: EXP.encode,
        decode: function (data) {
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
    };

    return {
        generation: function () { return generation; },
        setGeneration: function (g) { generation = g; },
        outName: outName,
        inName: inName,
        transmit: transmit,
        maps: { OLD_TO_NEW_OUT: OLD_TO_NEW_OUT, NEW_TO_OLD_IN: NEW_TO_OLD_IN, STRAGGLERS: STRAGGLERS }
    };
}
)();

// A small console banner, because the whole point is that you install this and
// then install an old mod unchanged -- it should be obvious it is running.
console.info("%c[unpatch]%c moomoo transport shim active - handshake, opcode tables and HMAC framing installed.",
    "color:#8ecc51;font-weight:bold", "color:inherit");
