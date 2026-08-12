
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
            //
            // The other way to arrive here is a mod that frames its own
            // packets, i.e. one that already speaks the current protocol and
            // does not need this shim at all. Renumbering keeps it working,
            // but say so once: running the unpatcher under an already-repaired
            // script is the one configuration worse than not running it.
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
        // Not `window.WebSocket.prototype.send` -- `WebSocket` here is whatever
        // the accessor currently hands back, and a mod is free to have put
        // something else there.
        const current = WebSocket.prototype.send;
        // "different from ours" is not the same as "a hook". novastorm hijacks
        // socket construction by putting a class with an empty prototype on
        // window.WebSocket:
        //
        //     window.OriginalWebSocket = window.WebSocket;
        //     window.WebSocket = class { constructor(addr) { connectSocket(addr) } };
        //
        // so `current` is undefined, which is different from ours, and calling
        // it threw on every outgoing packet -- the client connected and was
        // then mute. Anything that is not callable is not a hook.
        if (typeof current === "function" && current !== shimSend && !inModHook) {
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
    // A repaired client replacement inlines this shim into itself, so it can
    // simply say so: window.UNPATCH_CLIENT means every message handler on the
    // page belongs to the mod, because there is no game bundle underneath it.
    // That is knowledge the file has and this shim cannot infer, and it beats
    // the stack sniffing below, which is a guess that happens to be right.
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

    // Keeping the property assignable was only half of it. The bundle does
    //
    //     const kn = window.WebSocket;      // ...at load
    //     this.socket = new kn(e);          // ...much later
    //
    // so a mod that replaces window.WebSocket after the bundle has run -- to
    // hijack the connection, read the address, or put a transport of its own
    // underneath -- is still never reached for the socket that matters. The
    // assignment sticks and does nothing.
    //
    // novastorm is the whole of its client behind that door:
    //
    //     window.OriginalWebSocket = window.WebSocket;
    //     window.WebSocket = class { constructor(addr) { connectSocket(addr) } };
    //
    // It was written when the game said `new WebSocket(...)` at the call site.
    // Against the current bundle nothing of it ever ran.
    //
    // So the constructor the bundle captured forwards to whatever is on
    // window.WebSocket at call time.
    //
    // Which needs care, because every replacement of this kind keeps a
    // reference to what it replaced and constructs it -- and that inner call
    // comes back through here. Forwarding again would run the replacement
    // twice (or for ever). Knowing when we are inside one is the whole
    // difficulty: a replacement invoked through window.WebSocket by some other
    // script is not something we started, so a flag we set around our own
    // forwarding is not enough. Handing the replacement out through a thin
    // proxy that raises the count while it runs covers both, and the proxy
    // copies across prototype, statics, name and toString so that instanceof
    // and anything printing it see no difference.
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
            // the banner guard and the ENTER GAME hold live in the EXP core,
            // so that every script built on it gets them and not just this one
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
