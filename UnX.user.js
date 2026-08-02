// ==UserScript==
// @name         unX
// @namespace    promod
// @version      v4.6.3
// @description  No Share!
// @author       old: Mega, new: kwyxl
// @match        *://*.moomoo.io/*
// @match        *://*.mohmoh.dev.tc/*
// @icon         https://images.emojiterra.com/google/noto-emoji/unicode-15/color/512px/1f414.png
// @grant        none
// ==/UserScript==






let isMohMoh = location.href.includes("mohmoh");
const clientTranslate = new Map([
    ["P", "11"],
    ["Q", "12"],
    ["b", "10"],
    ["L", "8"],
    ["N", "9"],
    ["c", "13c"],
    ["6", "ch"],
    ["e", "rmd"],
    ["F", "c"],
    ["9", "33"],
    ["K", "7"],
    ["S", "14"],
    ["z", "5"],
    ["M", "sp"],
    ["H", "6"],
    ["D", "2"],
    ["0", "pp"],
]);

const CHKP = (function () {
    const TABLE_SALT = 1;
    const HEADER_LEN = 6;
    const MODE_SECURE = 1;
    const BLOCK = 64;
    const C2S = ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"];
    const S2C = ["A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

    function rng(seed) {
        return function () {
            seed |= 0;
            seed = (seed + 1831565813) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function shuffleTable(names, seed) {
        const len = names.length;
        const idx = names.map((_, i) => i);
        const next = rng(seed >>> 0);
        for (let i = len - 1; i > 0; i--) {
            const j = Math.floor(next() * (i + 1));
            const tmp = idx[i];
            idx[i] = idx[j];
            idx[j] = tmp;
        }
        const enc = {};
        const dec = {};
        for (let k = 0; k < len; k++) {
            enc[names[k]] = idx[k];
            dec[idx[k]] = names[k];
        }
        return { enc: enc, dec: dec };
    }

    function buildTables(seed) {
        const s = (seed ^ Math.imul(TABLE_SALT, 2654435761)) >>> 0;
        return {
            c2s: shuffleTable(C2S, s),
            s2c: shuffleTable(S2C, (s ^ 2246822507) >>> 0),
        };
    }

    const K = new Uint32Array([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);

    function rotr(x, n) {
        return (x >>> n) | (x << (32 - n));
    }

    function sha256(msg) {
        const h = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
        const len = msg.length;
        const bits = len * 8;
        const padded = new Uint8Array(Math.ceil((len + 9) / 64) * 64);
        padded.set(msg);
        padded[len] = 128;
        const view = new DataView(padded.buffer);
        view.setUint32(padded.length - 4, bits >>> 0, false);
        view.setUint32(padded.length - 8, Math.floor(bits / 4294967296), false);
        const w = new Uint32Array(64);
        for (let off = 0; off < padded.length; off += 64) {
            for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
            for (let i = 16; i < 64; i++) {
                const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
                const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
            }
            let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
            for (let i = 0; i < 64; i++) {
                const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
                const ch = (e & f) ^ (~e & g);
                const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
                const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
                const maj = (a & b) ^ (a & c) ^ (b & c);
                const t2 = (S0 + maj) | 0;
                hh = g;
                g = f;
                f = e;
                e = (d + t1) | 0;
                d = c;
                c = b;
                b = a;
                a = (t1 + t2) | 0;
            }
            h[0] = (h[0] + a) | 0;
            h[1] = (h[1] + b) | 0;
            h[2] = (h[2] + c) | 0;
            h[3] = (h[3] + d) | 0;
            h[4] = (h[4] + e) | 0;
            h[5] = (h[5] + f) | 0;
            h[6] = (h[6] + g) | 0;
            h[7] = (h[7] + hh) | 0;
        }
        const out = new Uint8Array(32);
        const outView = new DataView(out.buffer);
        for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i], false);
        return out;
    }

    function hmac(key, msg) {
        let k = key;
        if (k.length > BLOCK) k = sha256(k);
        const padKey = new Uint8Array(BLOCK);
        padKey.set(k);
        const inner = new Uint8Array(BLOCK + msg.length);
        const outer = new Uint8Array(BLOCK + 32);
        for (let i = 0; i < BLOCK; i++) {
            inner[i] = padKey[i] ^ 54;
            outer[i] = padKey[i] ^ 92;
        }
        inner.set(msg, BLOCK);
        outer.set(sha256(inner), BLOCK);
        return sha256(outer);
    }

    function tag(key, payload) {
        return hmac(key, payload).subarray(0, HEADER_LEN);
    }

    function hexToBytes(hex) {
        const out = new Uint8Array(hex.length / 2);
        for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
        return out;
    }

    const SITEKEY = "0x4AAAAAAAMYHI96GFiJzMmp";
    const API_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    let captchaToken = null;
    let widgetId = null;
    let apiRequested = false;

    function loadApi() {
        if (window.turnstile || apiRequested) return;
        apiRequested = true;
        const s = document.createElement("script");
        s.src = API_SRC;
        s.async = true;
        s.defer = true;
        s.onerror = function () {
            console.error("[chicken] the Turnstile api script failed to load (blocked by an extension?)");
        };
        (document.head || document.documentElement).appendChild(s);
    }

    function buildPanel() {
        const box = document.createElement("div");
        box.id = "chkCaptcha";
        box.style.cssText = [
            "position:fixed", "left:50%", "top:50%", "transform:translate(-50%,-50%)",
            "z-index:2147483647", "background:rgba(0,0,0,.82)", "border-radius:8px",
            "padding:22px 26px", "text-align:center", "color:#fff",
            "font:400 16px/1.4 'Hammersmith One',sans-serif",
            "box-shadow:0 8px 32px rgba(0,0,0,.6)",
        ].join(";");

        const title = document.createElement("div");
        title.textContent = "Verify to play";
        title.style.cssText = "font-size:22px;margin-bottom:4px;";

        const status = document.createElement("div");
        status.textContent = "Tick the box below.";
        status.style.cssText = "font-size:14px;opacity:.75;margin-bottom:14px;";

        const slot = document.createElement("div");
        slot.id = "chkTurnstile";
        slot.style.cssText = "display:flex;justify-content:center;min-height:65px;";

        box.appendChild(title);
        box.appendChild(status);
        box.appendChild(slot);
        (document.body || document.documentElement).appendChild(box);
        return { box: box, slot: slot, status: status };
    }

    function render(slot, onToken) {
        if (widgetId !== null || !window.turnstile || typeof window.turnstile.render != "function") return;
        try {
            widgetId = window.turnstile.render(slot, {
                sitekey: SITEKEY,
                theme: "dark",
                callback: function (t) {
                    captchaToken = t;
                    onToken();
                },
                "error-callback": function () {
                    captchaToken = null;
                },
                "expired-callback": function () {
                    captchaToken = null;
                },
            });
        } catch (e) {
            console.error("[chicken] turnstile render failed", e);
            widgetId = null;
        }
    }

    function token() {
        if (!captchaToken && widgetId !== null && window.turnstile
            && typeof window.turnstile.getResponse == "function") {
            try {
                captchaToken = window.turnstile.getResponse(widgetId) || null;
            } catch (e) {
            }
        }
        return captchaToken ? "cf:" + captchaToken : null;
    }

    function requestToken() {
        loadApi();
        return new Promise(function (resolve) {
            const ui = buildPanel();
            let done = false;

            const finish = function () {
                if (done) return;
                done = true;
                clearInterval(poll);
                ui.box.remove();
                resolve(token());
            };

            const poll = setInterval(function () {
                render(ui.slot, finish);
                if (token()) finish();
            }, 200);
        });
    }

    let botBox = null;
    let botSlot = null;
    let botStatus = null;
    let botWidgetId = null;
    let botToken = null;
    let botChain = Promise.resolve(null);
    let botQueued = 0;
    let botSolved = 0;
    let botCancelled = false;

    function botPanel() {
        if (botBox && botBox.isConnected) return botBox;
        botBox = document.createElement("div");
        botBox.id = "chkBotCaptcha";
        botBox.style.cssText = [
            "position:fixed", "left:50%", "top:50%", "transform:translate(-50%,-50%)",
            "z-index:2147483647", "background:rgba(0,0,0,.82)", "border-radius:8px",
            "padding:22px 26px", "text-align:center", "color:#fff",
            "font:400 16px/1.4 'Hammersmith One',sans-serif",
            "box-shadow:0 8px 32px rgba(0,0,0,.6)",
        ].join(";");

        const title = document.createElement("div");
        title.textContent = "Verify to add bots";
        title.style.cssText = "font-size:22px;margin-bottom:4px;";

        botStatus = document.createElement("div");
        botStatus.style.cssText = "font-size:14px;opacity:.75;margin-bottom:14px;";

        botSlot = document.createElement("div");
        botSlot.id = "chkBotTurnstile";
        botSlot.style.cssText = "display:flex;justify-content:center;min-height:65px;";

        const cancel = document.createElement("div");
        cancel.textContent = "Cancel";
        cancel.style.cssText = "margin-top:12px;font-size:14px;opacity:.7;cursor:pointer;text-decoration:underline;";
        cancel.onclick = function () {
            botCancelled = true;
            hideBotPanel();
        };

        botBox.appendChild(title);
        botBox.appendChild(botStatus);
        botBox.appendChild(botSlot);
        botBox.appendChild(cancel);
        (document.body || document.documentElement).appendChild(botBox);
        botWidgetId = null;
        return botBox;
    }

    function botLabel() {
        if (!botStatus) return;
        const total = botQueued;
        const at = Math.min(botSolved + 1, total);
        botStatus.textContent = total > 1
            ? "One challenge per bot -- " + at + " of " + total
            : "Tick the box to add the bot.";
    }

    function showBotPanel() {
        botPanel();
        botBox.style.display = "block";
        botLabel();
    }

    function hideBotPanel() {
        if (botBox) botBox.style.display = "none";
    }

    function renderBotWidget() {
        if (botWidgetId !== null) return true;
        if (!window.turnstile || typeof window.turnstile.render != "function") return false;
        try {
            botWidgetId = window.turnstile.render(botSlot, {
                sitekey: SITEKEY,
                theme: "dark",
                callback: function (t) {
                    botToken = t;
                },
                "error-callback": function () {
                    botToken = null;
                },
                "expired-callback": function () {
                    botToken = null;
                },
            });
            return true;
        } catch (e) {
            console.error("[unx] bot turnstile render failed", e);
            botWidgetId = null;
            return false;
        }
    }

    function awaitBotToken(timeoutMs) {
        return new Promise(function (resolve) {
            let waited = 0;
            const poll = setInterval(function () {
                if (botCancelled) {
                    clearInterval(poll);
                    resolve(null);
                    return;
                }
                renderBotWidget();
                if (botToken) {
                    clearInterval(poll);
                    const t = botToken;
                    botToken = null;
                    resolve("cf:" + t);
                    return;
                }
                waited += 150;
                if (waited >= timeoutMs) {
                    clearInterval(poll);
                    resolve(null);
                }
            }, 150);
        });
    }

    function freshToken() {
        botQueued++;
        if (botQueued === 1) {
            botSolved = 0;
            botCancelled = false;
        }
        const finish = function (result) {
            botSolved++;
            if (botSolved >= botQueued) {
                botQueued = 0;
                botSolved = 0;
                hideBotPanel();
            } else {
                botLabel();
            }
            return result;
        };
        const run = function () {
            if (botCancelled) return finish(null);
            loadApi();
            botToken = null;
            showBotPanel();
            if (botWidgetId !== null && window.turnstile && typeof window.turnstile.reset == "function") {
                try {
                    window.turnstile.reset(botWidgetId);
                } catch (e) {
                    botWidgetId = null;
                }
            }
            return awaitBotToken(120000).then(finish);
        };
        botChain = botChain.then(run, run);
        return botChain;
    }

    return {
        headerLen: HEADER_LEN,
        modeSecure: MODE_SECURE,
        buildTables: buildTables,
        tag: tag,
        hexToBytes: hexToBytes,
        token: token,
        requestToken: requestToken,
        freshToken: freshToken,
    };
})();

let chkProto = null;
let chkReady = false;

try {
    Object.defineProperty(window, "requestAnimFrame", {
        configurable: true,
        get: function () {
            return function () {};
        },
        set: function () {},
    });
} catch (e) {
    console.warn("[chicken] could not stop the page's render loop", e);
}

window.CHICKEN_COSMOS = (function () {
    "use strict";

    function starfield(count, spread, height, seed) {
        let s = seed;
        const rnd = function () {
            s = (s * 1664525 + 1013904223) >>> 0;
            return s / 4294967296;
        };
        const parts = [];
        for (let i = 0; i < count; i++) {
            const x = Math.floor(rnd() * spread)
                , y = Math.floor(rnd() * height)
                , a = (0.35 + rnd() * 0.65).toFixed(2);
            parts.push(x + "px " + y + "px rgba(255,255,255," + a + ")");
        }
        return parts.join(",");
    }

    const CSS = `
/* ---------- the sky, behind everything on the menu ------------------- */
#mainMenu {
  background: none !important;
  background-color: #04050e !important;
}
#ck-sky {
  position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0;
  background:
    radial-gradient(120% 90% at 12% 0%,   rgba(124, 92, 255, .30) 0%, transparent 55%),
    radial-gradient(100% 80% at 88% 10%,  rgba(77, 216, 255, .22) 0%, transparent 50%),
    radial-gradient(90%  90% at 50% 110%, rgba(255, 92, 190, .16) 0%, transparent 60%),
    linear-gradient(160deg, #05061a 0%, #080c26 45%, #120a2a 100%);
}
.ck-sky-box .ck-stars { position: absolute; left: 0; top: 0; border-radius: 50%; }
.ck-sky-box .ck-stars::after {
  content: ""; position: absolute; left: 0; top: 1200px;
  width: inherit; height: inherit; border-radius: 50%; box-shadow: inherit;
}
.ck-sky-box .ck-s1 {
  width: 1px; height: 1px; box-shadow: ${starfield(260, 2200, 1200, 7)};
  animation: ck-drift 190s linear infinite;
}
.ck-sky-box .ck-s2 {
  width: 2px; height: 2px; box-shadow: ${starfield(110, 2200, 1200, 99)};
  animation: ck-drift 120s linear infinite; opacity: .85;
}
.ck-sky-box .ck-s3 {
  width: 3px; height: 3px; box-shadow: ${starfield(40, 2200, 1200, 4242)};
  animation: ck-drift 75s linear infinite; opacity: .7;
  filter: drop-shadow(0 0 4px rgba(180, 210, 255, .9));
}
@keyframes ck-drift { from { transform: translateY(0); } to { transform: translateY(-1200px); } }

/* a slow twinkle over the whole field, so it never looks static */
.ck-sky-box::after {
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,.7), transparent 60%),
              radial-gradient(2px 2px at 72% 66%, rgba(190,220,255,.6), transparent 60%),
              radial-gradient(1.5px 1.5px at 45% 82%, rgba(255,255,255,.5), transparent 60%),
              radial-gradient(2px 2px at 86% 24%, rgba(210,230,255,.55), transparent 60%);
  animation: ck-twinkle 4.2s ease-in-out infinite alternate;
}
@keyframes ck-twinkle { from { opacity: .25; } to { opacity: .9; } }

/* ---------- shooting stars ------------------------------------------ */
.ck-sky-box .ck-shoot {
  position: absolute; width: 2px; height: 2px; border-radius: 50%;
  background: #fff; box-shadow: 0 0 8px 2px rgba(190, 220, 255, .9); opacity: 0;
}
/* The tail has to trail *behind* the head. These travel left and slightly
   down, so the tail extends to the right, fading away from the head — and the
   whole thing is rotated to sit along the direction of travel, not against it. */
.ck-sky-box .ck-shoot::before {
  content: ""; position: absolute; top: 50%; left: 2px;
  width: 190px; height: 1px; transform: translateY(-50%);
  background: linear-gradient(90deg, rgba(255,255,255,.95), rgba(140,190,255,.35), transparent);
}
.ck-sky-box .ck-shoot.a { top:  9%; left: 104%; animation: ck-shoot  7s ease-in infinite; animation-delay: 1.5s; }
.ck-sky-box .ck-shoot.b { top: 31%; left: 104%; animation: ck-shoot  9s ease-in infinite; animation-delay: 5s;   }
.ck-sky-box .ck-shoot.c { top: 58%; left: 104%; animation: ck-shoot 11s ease-in infinite; animation-delay: 8.5s; }
.ck-sky-box .ck-shoot.d { top: 76%; left: 104%; animation: ck-shoot 13s ease-in infinite; animation-delay: 12s;  }
@keyframes ck-shoot {
  0%        { opacity: 0; transform: translate(0, 0) rotate(-12deg); }
  3%        { opacity: 1; }
  20%       { opacity: 1; }
  28%, 100% { opacity: 0; transform: translate(-130vw, 44vh) rotate(-12deg); }
}

/* a planet, low and dim, so the corner is not empty */
.ck-sky-box .ck-planet {
  position: absolute; right: -60px; bottom: -90px; width: 260px; height: 260px;
  border-radius: 50%; opacity: .5;
  background:
    radial-gradient(circle at 32% 30%, #6f7cff 0%, #4534a8 45%, #1b1140 78%, #0a0720 100%);
  box-shadow: 0 0 70px rgba(110, 100, 255, .35), inset -18px -22px 60px rgba(0, 0, 0, .6);
  animation: ck-float 16s ease-in-out infinite alternate;
}
.ck-sky-box .ck-planet::after {                 /* its ring */
  content: ""; position: absolute; left: 50%; top: 50%;
  width: 400px; height: 92px; transform: translate(-50%, -50%) rotate(-18deg);
  border-radius: 50%; border: 2px solid rgba(160, 190, 255, .25);
  box-shadow: 0 0 22px rgba(140, 180, 255, .16);
}
@keyframes ck-float {
  from { transform: translateY(0)     rotate(0deg); }
  to   { transform: translateY(-16px) rotate(6deg); }
}

/* ---------- the menu card ------------------------------------------- */
#ckMenu {
  width: 760px !important;
  height: 380px !important;
  z-index: 1 !important;
  border-radius: 18px;
  padding: 8px 26px;
  box-sizing: border-box;
  background: rgba(10, 13, 34, .55);
  border: 1px solid rgba(150, 170, 255, .18);
  backdrop-filter: blur(9px);
  -webkit-backdrop-filter: blur(9px);
  box-shadow:
    0 30px 90px rgba(0, 0, 0, .6),
    0 0 0 1px rgba(255, 255, 255, .03) inset,
    0 0 120px rgba(124, 92, 255, .12) inset;
  animation: ck-in .34s cubic-bezier(.2, .9, .25, 1.05) both;
}
@keyframes ck-in {
  from { opacity: 0; transform: translate(-50%, -46%) scale(.97); }
  to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

#ckMenu #gameName span {
  color: #e8efff !important;
  text-shadow:
    0 0 6px rgba(120, 220, 255, .95),
    0 0 18px rgba(96, 140, 255, .75),
    0 0 42px rgba(124, 92, 255, .55) !important;
}
#ckMenu #loadingText { color: #b9c6f2 !important; letter-spacing: .3px; }

/* the client centres this block in the card; nudge it clear of the title so
   the card can hug its contents instead of trailing dead space */
#ckMenu #mainMenuItemHolder { top: 61% !important; }

/* ---------- controls ------------------------------------------------- */
#ckMenu select,
#ckMenu input[type="text"] {
  color: #e8efff !important;
  background: rgba(255, 255, 255, .06) !important;
  border: 1px solid rgba(150, 170, 255, .22) !important;
  border-radius: 8px !important;
  outline: none;
  transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
}
#ckMenu select option { color: #0b1020; background: #dfe7ff; }
#ckMenu input[type="text"]::placeholder { color: rgba(200, 214, 255, .45); }
#ckMenu select:hover,
#ckMenu input[type="text"]:hover { background: rgba(255, 255, 255, .10) !important; }
#ckMenu select:focus,
#ckMenu input[type="text"]:focus {
  border-color: rgba(120, 220, 255, .65) !important;
  box-shadow: 0 0 0 3px rgba(120, 220, 255, .16);
}
#ckMenu #enterGame {
  background: linear-gradient(180deg, #6ee7ff 0%, #4f8bff 100%) !important;
  border: 0 !important;
  border-radius: 9px !important;
  color: #06122b !important;
  font-weight: 700;
  letter-spacing: .4px;
  box-shadow: 0 6px 20px rgba(79, 139, 255, .38);
  transition: transform .14s ease, box-shadow .18s ease, filter .18s ease;
}
#ckMenu #enterGame:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 10px 26px rgba(79, 139, 255, .5);
}
#ckMenu #enterGame:active { transform: translateY(0); }

/* the skin swatches the client builds into #playerSkinHolder */
#ckMenu #playerSkinHolder > div {
  border-radius: 50% !important;
  transition: transform .14s ease, box-shadow .18s ease;
}
#ckMenu #playerSkinHolder > div:hover {
  transform: scale(1.12);
  box-shadow: 0 0 0 2px rgba(120, 220, 255, .7), 0 0 14px rgba(120, 220, 255, .5);
}

/* ---------- someone may be on reduce-motion -------------------------- */
@media (prefers-reduced-motion: reduce) {
  .ck-sky-box *, .ck-sky-box::after, #ckMenu { animation: none !important; }
}
`;

    const SKY = '<div class="ck-stars ck-s1"></div>'
        + '<div class="ck-stars ck-s2"></div>'
        + '<div class="ck-stars ck-s3"></div>'
        + '<div class="ck-shoot a"></div><div class="ck-shoot b"></div>'
        + '<div class="ck-shoot c"></div><div class="ck-shoot d"></div>'
        + '<div class="ck-planet"></div>';

    function styles() {
        if (document.getElementById("ck-cosmos-css")) return;
        const style = document.createElement("style");
        style.id = "ck-cosmos-css";
        style.textContent = CSS;
        (document.head || document.documentElement).appendChild(style);
    }

    function install(mainMenu) {
        styles();
        if (mainMenu && !document.getElementById("ck-sky")) {
            const sky = document.createElement("div");
            sky.id = "ck-sky";
            sky.className = "ck-sky-box";
            sky.innerHTML = SKY;
            mainMenu.insertBefore(sky, mainMenu.firstChild);
        }
    }


    return { css: CSS, sky: SKY, install: install };
})();

const config = {
    maxScreenWidth: 1920,
    maxScreenHeight: 1080,
    serverUpdateRate: 9,
    serverUpdateSpeed: 1000 / 9,
    maxPlayers: 50,
    maxPlayersHard: 50,
    collisionDepth: 6,
    minimapRate: 3e3,
    colGrid: 10,
    volanoScale: 320,
    innerVolcanoScale: 100,
    volcanoAnimationDuration: 3200,
    clientSendRate: 5,
    healthBarWidth: 50,
    healthBarPad: 4.5,
    iconPadding: 15,
    iconPad: 0.9,
    deathFadeout: 3e3,
    crownIconScale: 60,
    crownPad: 35,
    chatCountdown: 3e3,
    chatCooldown: 5e2,
    inSanbox: true,
    maxAge: 1e2,
    gatherAngle: Math.PI / 2.6,
    gatherWiggle: 10,
    hitReturnRatio: 0.25,
    hitAngle: Math.PI / 2,
    playerScale: 35,
    playerSpeed: 0.0016,
    playerDecel: 0.993,
    nameY: 34,
    skinColors: ["#bf8f54", "#cbb091", "#896c4b", "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3", "#8bc373", "#91b2db"],
    animalCount: 7,
    aiTurnRandom: 0.06,
    cowNames: ["SPSLPSLPSLSPLSPLPLS EHELP SHELP SHELpid", "Steph", "waohh", "Romn", "mega is crying inside", "fuck man", "Vince", "AHAHAHAHAHAHAH", "Nick Ger", "japan go boom boom", "HELPHELPHELP PLSPL", "Otis", "mega's lost sanity", "FUICK FUCK FUCK FUCK", "WAAAAAAAAAA", "big fat man", "Oliver", "Jeff took my wifi", "Jimmy", "WAAAAAAASDSADSAIJ HELP", "Reaper", "Ben", "Alan", "Naomi", "ABCDEFGHIJKLMPQURSTUVXYZ", "Clever", "Jeremy", "Mike", "Destined to fail", "OSPLSPLSPLPSLSPLSPL DUCK MAN TOOK MY HOME", "AHAHAHAHAHAHAHHAH PLSLPSLPSL", "Meaty and Creamy", "HELP HELP  HELP HELP HELP HELP HELP", "Vaja", "Joey", "GA GAS SAGGSAGASG", "Murdoch", "Theo robbed you", "Jared", "July is bad", "Sonia", "Mel", "Dexter", "Quinn is ass", "AHAHHAHAHAHAHAHHA PSLPSLPSLSPLS END EHLP"],
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
        for (let i = 4 - 1; i >= 0; --i) {
            if (tmpXP >= this.weaponVariants[i].xp) return this.weaponVariants[i];
        }
    },
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
    rockScales: [80, 85, 95],
    snowBiomeTop: 2400,
    snowSpeed: 0.75,
    maxNameLength: 15,
    mapScale: 144e2,
    mapPingScale: 40,
    mapPingTime: 22e2,
};

const profanityList = ["cunt", "whore", "fuck", "shit", "faggot", "nigger", "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex", "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune", "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard"];

let io = new (class {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.socketId = -1;
        this.clientData = {
            lastDirection: 0,
            movementDirection: 0,
        };
    }
    connect(socketAddress, callback, events) {
        if (this.socket) return;
        let socketError = false;
        let handshakeDone = false;
        try {
            this.socket = new WebSocket(socketAddress);
            this.socket.binaryType = "arraybuffer";
            this.socket.onopen = () => {
                this.connected = true;
            };
            this.socket.onmessage = (msg) => {
                let data = new Uint8Array(msg.data);
                let parsed = msgpack.decode(data);
                let type = parsed[0];

                data = parsed[1];

                if (type == "io-init") {
                    this.socketId = data[0];
                    chkProto =
                        data[3] === CHKP.modeSecure
                            ? {
                                  mode: CHKP.modeSecure,
                                  key: CHKP.hexToBytes(data[2]),
                                  tables: CHKP.buildTables(data[1] >>> 0),
                                  seq: 0,
                              }
                            : null;
                    chkReady = true;
                    if (!handshakeDone) {
                        handshakeDone = true;
                        callback();
                    }
                } else {
                    if (chkProto && typeof type == "number") {
                        type = chkProto.tables.s2c.dec[type];
                        if (type === undefined) return;
                    }
                    if (events[type.toString()]) {
                        events[type.toString()].apply(undefined, data);
                    }
                }
            };
            this.socket.onclose = (event) => {
                this.connected = false;
                chkProto = null;
                chkReady = false;
                if (event.code == 4001) {
                    callback("Invalid Connection");
                } else if (!socketError) {
                    callback("disconnected");
                }
            };
            this.socket.onerror = (error) => {
                if (this.socket && this.socket.readyState != WebSocket.OPEN) {
                    socketError = true;
                    console.error("Socket error", arguments);
                    callback("Socket error");
                }
            };
        } catch (e) {
            callback(e);
        }
    }
    send(type) {
        let dontSend = false;

        let invalidData = [null, undefined];
        let clientDirection = this.clientData.lastDirection;
        let movementDirection = this.clientData.movementDirection;

        if (type == "6") {
            arguments[1] = profanityList.reduce((m, w) => m.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (x) => x[0].toUpperCase() + x.slice(1)), arguments[1]);
        } else if (type == "D") {
            let direction = arguments[1];
            if (invalidData.includes(direction) || clientDirection == direction) {
                dontSend = true;
            } else {
                this.clientData.lastDirection = direction;
            }
        } else if (type == "F") {
            let direction = arguments[2];
            if (!invalidData.includes(direction) || clientDirection == direction) {
                this.clientData.lastDirection = direction;
            } else {
                dontSend = true;
            }
        }

        let data = Array.prototype.slice.call(arguments, 1);
        let name = location.href.includes("mohmoh") ? clientTranslate.get(type) || type : type;

        if (this.socket && this.socket.readyState == 1 && chkReady && !dontSend) {
            if (chkProto && chkProto.mode === CHKP.modeSecure) {
                let opcode = chkProto.tables.c2s.enc[name];
                if (opcode === undefined) return;
                let payload = msgpack.encode([opcode, data, ++chkProto.seq]);
                let frame = new Uint8Array(CHKP.headerLen + payload.length);
                frame.set(CHKP.tag(chkProto.key, payload), 0);
                frame.set(payload, CHKP.headerLen);
                this.socket.send(frame);
            } else {
                this.socket.send(msgpack.encode([name, data]));
            }

            if (window.packetsSent == undefined) window.packetsSent = [];
            window.packetsSent.push([type, data]);
            if (window.packetsSent.length > 200) {
                window.packetsSent.shift();
            }
        }
    }
    socketReady() {
        return this.socket && this.connected;
    }
    close() {
        if (this.socket && this.socket.readyState < 2) {
            this.socket.close();
        }
        chkProto = null;
        chkReady = false;
    }
})();

const mathABS = Math.abs;
const mathCOS = Math.cos;
const mathSIN = Math.sin;
const mathPOW = Math.pow;
const mathSQRT = Math.sqrt;
const mathATAN2 = Math.atan2;
const mathPI = Math.PI;

const UTILS = {
    randInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,

    randFloat: (min, max) => Math.random() * (max - min) + min,

    lerp: (value1, value2, amount) => value1 + (value2 - value1) * amount,

    intersectsLineCircle: (start, end, obj) => {
        let dx = end.x - start.x;
        let dy = end.y - start.y;
        let fx = start.x - obj.x;
        let fy = start.y - obj.y;
        let r = obj.scale + 20;

        let a = dx * dx + dy * dy;
        let b = 2 * (fx * dx + fy * dy);
        let c = fx * fx + fy * fy - r * r;

        let discriminant = b * b - 4 * a * c;

        if (discriminant < 0) {
            return false;
        }

        discriminant = Math.sqrt(discriminant);
        let t1 = (-b - discriminant) / (2 * a);
        let t2 = (-b + discriminant) / (2 * a);

        return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
    },

    decel: (val, cel) => {
        if (val > 0) val = Math.max(0, val - cel);
        else if (val < 0) val = Math.min(0, val + cel);
        return val;
    },

    removeWholeNumber: (decimalValue) => {
        let stringValue = decimalValue.toString();
        let decimalIndex = stringValue.indexOf(".");

        if (decimalIndex === -1 || decimalIndex === stringValue.length - 1) {
            return "";
        }

        return parseFloat("." + stringValue.substring(decimalIndex + 1));
    },

    getDistance: (obj1, obj2) => {
        let x1 = obj1.x2 || obj1.x;
        let y1 = obj1.y2 || obj1.y;
        let x2 = obj2.x2 || obj2.x;
        let y2 = obj2.y2 || obj2.y;
        return Math.hypot(y1 - y2, x1 - x2);
    },

    getDirection: (obj1, obj2) => {
        let x1 = obj1.x2 || obj1.x;
        let y1 = obj1.y2 || obj1.y;
        let x2 = obj2.x2 || obj2.x;
        let y2 = obj2.y2 || obj2.y;
        return mathATAN2(y1 - y2, x1 - x2);
    },

    getAngleDist: (a, b) => {
        const p = mathABS(b - a) % (mathPI * 2);
        return p > mathPI ? mathPI * 2 - p : p;
    },

    isNumber: (n) => typeof n === "number" && !isNaN(n) && isFinite(n),

    isString: (s) => s && typeof s === "string",

    kFormat: (num) => (num > 999 ? (num / 1000).toFixed(1) + "k" : num),

    capitalizeFirst: (string) => string.charAt(0).toUpperCase() + string.slice(1),

    capitalizeWordInString: (sentence, wordToCapitalize) => {
        var regex = new RegExp(wordToCapitalize, "i");
        return sentence.replace(regex, function (match) {
            return UTILS.capitalizeFirst(match);
        });
    },

    fixTo: (n, v) => parseFloat(n.toFixed(v)),

    sortByPoints: (a, b) => parseFloat(b.points) - parseFloat(a.points),

    lineInRect: (recX, recY, recX2, recY2, x1, y1, x2, y2) => {
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
        const dx = x2 - x1;
        if (Math.abs(dx) > 0.0000001) {
            const a = (y2 - y1) / dx;
            const b = y1 - a * x1;
            minY = a * minX + b;
            maxY = a * maxX + b;
        }
        if (minY > maxY) {
            const tmp = maxY;
            maxY = minY;
            minY = tmp;
        }
        if (maxY > recY2) maxY = recY2;
        if (minY < recY) minY = recY;
        if (minY > maxY) return false;
        return true;
    },

    containsPoint: (element, x, y) => {
        const bounds = element.getBoundingClientRect();
        const left = bounds.left + window.scrollX;
        const top = bounds.top + window.scrollY;
        const width = bounds.width;
        const height = bounds.height;
        const insideHorizontal = x > left && x < left + width;
        const insideVertical = y > top && y < top + height;
        return insideHorizontal && insideVertical;
    },

    mousifyTouchEvent: (event) => {
        const touch = event.changedTouches[0];
        event.screenX = touch.screenX;
        event.screenY = touch.screenY;
        event.clientX = touch.clientX;
        event.clientY = touch.clientY;
        event.pageX = touch.pageX;
        event.pageY = touch.pageY;
    },

    hookTouchEvents: (element, skipPrevent) => {
        const preventDefault = !skipPrevent;
        let isHovering = false;
        const passive = false;
        element.addEventListener("touchstart", UTILS.checkTrusted(touchStart), passive);
        element.addEventListener("touchmove", UTILS.checkTrusted(touchMove), passive);
        element.addEventListener("touchend", UTILS.checkTrusted(touchEnd), passive);
        element.addEventListener("touchcancel", UTILS.checkTrusted(touchEnd), passive);
        element.addEventListener("touchleave", UTILS.checkTrusted(touchEnd), passive);

        function touchStart(e) {
            UTILS.mousifyTouchEvent(e);
            window.setUsingTouch(true);
            if (preventDefault) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (element.onmouseover) element.onmouseover(e);
            isHovering = true;
        }

        function touchMove(e) {
            UTILS.mousifyTouchEvent(e);
            window.setUsingTouch(true);
            if (preventDefault) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (UTILS.containsPoint(element, e.pageX, e.pageY)) {
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
            UTILS.mousifyTouchEvent(e);
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
    },

    removeAllChildren: (element) => {
        while (element.hasChildNodes()) {
            element.removeChild(element.lastChild);
        }
    },

    generateElement: (config) => {
        const element = document.createElement(config.tag || "div");

        function bind(configValue, elementValue) {
            if (config[configValue]) element[elementValue] = config[configValue];
        }
        bind("text", "textContent");
        bind("html", "innerHTML");
        bind("class", "className");
        for (const key in config) {
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
        if (element.onclick) element.onclick = UTILS.checkTrusted(element.onclick);
        if (element.onmouseover) element.onmouseover = UTILS.checkTrusted(element.onmouseover);
        if (element.onmouseout) element.onmouseout = UTILS.checkTrusted(element.onmouseout);
        if (config.style) {
            element.style.cssText = config.style;
        }
        if (config.hookTouch) UTILS.hookTouchEvents(element, config.skipPreventTouch);
        if (config.parent) config.parent.appendChild(element);
        if (config.children && config.children.length > 0) {
            for (const child of config.children) element.appendChild(child);
        }
        return element;
    },

    checkTrusted: (callback) => (e) => {
        if (e && !e.isTrusted) {
            e.stopImmediatePropagation();
            e.preventDefault();
        } else {
            callback(e);
        }
    },

    findMiddlePoint: (a, b) => {
        return { x2: (a.x2 + b.x2) / 2, y2: (a.y2 + b.y2) / 2 };
    },
};


const groups = [
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
        sandboxLimit: 299,
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
        sandboxLimit: 299,
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
        sandboxLimit: 299,
        limit: 2,
        layer: -1,
    },
];
const projectiles = [
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
        scale: 20,
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
        indx: 1,
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
const weapons = [
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
        dmg: 25,
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
        dmg: 0,
        shield: 0.2,
        speed: 1,
        xOff: 6,
        yOff: 0,
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
        dmg: 35,
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
        dmg: 30,
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
        dmg: 50,
        projectile: 5,
        hideProjectile: true,
        spdMult: 0.6,
        speed: 1500,
    },
];
const list = (window.list = [
    {
        group: groups[0],
        name: "apple",
        desc: "restores 20 health when consumed",
        req: ["food", 10],
        consume: function (doer) {
            return doer.changeHealth(20, doer);
        },
        scale: 22,
        holdOffset: 15,
    },
    {
        age: 3,
        group: groups[0],
        name: "cookie",
        desc: "restores 40 health when consumed",
        req: ["food", 15],
        consume: function (doer) {
            return doer.changeHealth(40, doer);
        },
        scale: 27,
        holdOffset: 15,
    },
    {
        age: 7,
        group: groups[0],
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
    },
    {
        group: groups[1],
        name: "wood wall",
        desc: "provides protection for your village",
        req: ["wood", 10],
        projDmg: true,
        health: 380,
        scale: 50,
        holdOffset: 20,
        placeOffset: -5,
    },
    {
        age: 3,
        group: groups[1],
        name: "stone wall",
        desc: "provides improved protection for your village",
        req: ["stone", 25],
        health: 900,
        scale: 50,
        holdOffset: 20,
        placeOffset: -5,
    },
    {
        age: 7,
        pre: 1,
        group: groups[1],
        name: "castle wall",
        desc: "provides powerful protection for your village",
        req: ["stone", 35],
        health: 1500,
        scale: 52,
        holdOffset: 20,
        placeOffset: -5,
    },
    {
        group: groups[2],
        name: "spikes",
        desc: "damages enemies when they touch them",
        req: ["wood", 20, "stone", 5],
        health: 400,
        dmg: 20,
        scale: 49,
        spritePadding: -23,
        holdOffset: 8,
        placeOffset: -5,
    },
    {
        age: 5,
        group: groups[2],
        name: "greater spikes",
        desc: "damages enemies when they touch them",
        req: ["wood", 30, "stone", 10],
        health: 500,
        dmg: 35,
        scale: 52,
        spritePadding: -23,
        holdOffset: 8,
        placeOffset: -5,
    },
    {
        age: 9,
        pre: 1,
        group: groups[2],
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
    },
    {
        age: 9,
        pre: 2,
        group: groups[2],
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
    },
    {
        group: groups[3],
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
    },
    {
        age: 5,
        pre: 1,
        group: groups[3],
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
    },
    {
        age: 8,
        pre: 1,
        group: groups[3],
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
    },
    {
        age: 5,
        group: groups[4],
        type: 2,
        name: "mine",
        desc: "allows you to mine stone",
        req: ["wood", 20, "stone", 100],
        iconLineMult: 12,
        scale: 65,
        holdOffset: 20,
        placeOffset: 0,
    },
    {
        age: 5,
        group: groups[11],
        type: 0,
        name: "sapling",
        desc: "allows you to farm wood",
        req: ["wood", 150],
        iconLineMult: 12,
        colDiv: 0.5,
        scale: 110,
        holdOffset: 50,
        placeOffset: -15,
    },
    {
        age: 4,
        group: groups[5],
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
    },
    {
        age: 4,
        group: groups[6],
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
    },
    {
        age: 7,
        group: groups[7],
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
    },
    {
        age: 7,
        group: groups[8],
        name: "platform",
        desc: "platform to shoot over walls and cross over water",
        req: ["wood", 20],
        ignoreCollision: true,
        zIndex: 1,
        health: 300,
        scale: 43,
        holdOffset: 20,
        placeOffset: -5,
    },
    {
        age: 7,
        group: groups[9],
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
    },
    {
        age: 9,
        group: groups[10],
        name: "spawn pad",
        desc: "you will spawn here when you die but it will dissapear",
        req: ["wood", 100, "stone", 100],
        health: 400,
        ignoreCollision: true,
        spawnPoint: true,
        scale: 45,
        holdOffset: 20,
        placeOffset: -5,
    },
    {
        age: 7,
        group: groups[12],
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
    },
    {
        age: 7,
        group: groups[13],
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
    },
]);
for (let i = 0; i < list.length; ++i) {
    list[i].id = i;
}
let items = { groups, projectiles, weapons, list };

class Player {
    constructor(id, sid, config, UTILS, items, hats, accessories) {
        this.id = id;
        this.sid = sid;
        this.tmpScore = 0;
        this.team = null;
        this.skinIndex = 0;
        this.tailIndex = 0;
        this.hitTime = 0;
        this.tails = {};
        this.lastChatDate = Date.now();
        for (let i = 0; i < accessories.length; i++) {
            if (accessories[i].price <= 0) this.tails[accessories[i].id] = 1;
        }
        this.skins = {};
        for (let i = 0; i < hats.length; i++) {
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
        this.iconIndex = 0;
        this.skinColor = 0;
        this.chatMessages = [];
        this.resetResources = function (moofoll) {
            for (var i = 0; i < config.resourceTypes.length; ++i) {
                this[config.resourceTypes[i]] = moofoll ? 100 : 0;
            }
        };
        this.spawn = function (moofoll) {
            this.chatMessages = [];
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
            this.noMovTimer = 1000;
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
            this.dirPlus = 0;
            this.targetDir = 0;
            this.targetAngle = 0;
            this.maxHealth = 100;
            this.health = this.maxHealth;
            this.scale = config.playerScale;
            this.speed = config.playerSpeed;
            this.resetResources(moofoll);
            this.items = [0, 3, 6, 10];
            this.weapons = [0];
            this.shootCount = 0;
            this.weaponXP = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
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
            this.primaryWeapon = 0;
            this.secondaryWeapon = 15;
            this.primaryVariant = 0;
            this.secondaryVariant = 0;
            this.primaryHit = 0;
            this.secondaryHit = 0;
            this.turretTick = 0;
            this.bullTick = 0;
            this.vel = { x: 0, y: 0 };
            this.spikeType = { id: 6, sid: 0 };
            this.damages = [];
        };
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
        var tmpRatio = 0;
        var animIndex = 0;
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
        this.startAnim = function (didHit, index) {
            this.animTime = this.animSpeed = items.weapons[index].speed;
            this.targetAngle = didHit ? -config.hitAngle : -Math.PI;
            tmpRatio = 0;
            animIndex = 0;
        };
        this.resetReloads = function () {
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
        };
        this.manageReloads = function (delta, visible) {
            if (!visible) {
                this.resetReloads();
            } else {
                if (this.buildIndex == -1) {
                    this.reloads[this.weaponIndex] = Math.max(0, this.reloads[this.weaponIndex] - delta);
                    if (this.weaponIndex < 9) {
                        if (this.primaryWeapon != this.weaponIndex) {
                            if (this.weaponIndex == 4 && this.secondaryWeapon >= 12 && this.secondaryWeapon != 14) {
                                this.secondaryVariant = 0;
                                this.secondaryWeapon = 9;
                            } else if (this.secondaryWeapon != 10 && this.secondaryWeapon != 14 && this.secondaryWeapon != 11) {
                                this.secondaryWeapon = 15;
                                this.secondaryVariant = 0;
                            }
                        }
                        this.primaryWeapon = this.weaponIndex;
                        this.primaryVariant = this.weaponVariant;
                    } else {
                        this.secondaryWeapon = this.weaponIndex;
                        this.secondaryVariant = this.weaponVariant;
                        if (this.primaryWeapon == 0) {
                            this.primaryWeapon = 5;
                            this.primaryVariant = 2;
                        }
                    }
                }
                this.reloads[53] = Math.max(0, this.reloads[53] - delta);
            }
        };
    }
}

const hats = (window.hats = [
    {
        id: 45,
        name: "Shame!",
        dontSell: true,
        price: 0,
        scale: 120,
        desc: "hacks are for losers",
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
]);
const accessories = (window.accessories = [
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
]);
let store = { hats, accessories };

class Projectile {
    constructor() {
        this.init = function (indx, x, y, dir, spd, dmg, rng, scl, owner) {
            this.active = true;
            this.indx = indx;
            this.x = x;
            this.y = y;
            this.oldX = x;
            this.oldY = y;
            this.dir = dir;
            this.skipMov = true;
            this.speed = spd;
            this.dmg = dmg;
            this.scale = scl;
            this.range = rng;
            this.owner = owner;
        };
        this.update = function (delta) {
            if (this.active) {
                var tmpSpeed = this.speed * delta;
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
    }
}

class ProjectileManager {
    constructor(Projectile, projectiles, players, ais, objectManager, items, config, UTILS, server) {
        this.addProjectile = function (x, y, dir, range, speed, indx, owner, ignoreObj, layer) {
            var tmpData = items.projectiles[indx];
            var tmpProj;
            for (var i = 0; i < projectiles.length; ++i) {
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
            tmpProj.src = tmpData.src;
            return tmpProj;
        };
    }
}

var intervalId;
class VultrClient {
    constructor(baseUrl, devPort, lobbySize, lobbySpread, rawIPs) {
        this.debugLog = false;
        this.baseUrl = baseUrl;
        this.lobbySize = lobbySize;
        this.devPort = devPort;
        this.lobbySpread = lobbySpread;
        this.rawIPs = !!rawIPs;
        this.server = undefined;
        this.gameIndex = undefined;
        this.callback = undefined;
        this.errorCallback = undefined;
        this.regionInfo = {
            0: {
                name: "Local",
                latitude: 0,
                longitude: 0,
            },
            "us-east": {
                name: "Miami",
                latitude: 40.1393329,
                longitude: -75.8521818,
            },
            "us-west": {
                name: "Silicon Valley",
                latitude: 47.6149942,
                longitude: -122.4759879,
            },
            gb: {
                name: "London",
                latitude: 51.5283063,
                longitude: -0.382486,
            },
            "eu-west": {
                name: "Frankfurt",
                latitude: 50.1211273,
                longitude: 8.496137,
            },
            au: {
                name: "Sydney",
                latitude: -33.8479715,
                longitude: 150.651084,
            },
            sg: {
                name: "Singapore",
                latitude: 1.3147268,
                longitude: 103.7065876,
            },
        };
    }
    start(callback, errorCallback) {
        this.callback = callback;
        this.errorCallback = errorCallback;
        var query = this.parseServerQuery();
        if (query) {
            this.log("Found server in query.");
            this.password = query[3];
            this.connect(query[0], query[1], query[2]);
        } else {
            this.log("Pinging servers...");
            this.pingServers();
        }
    }
    parseServerQuery(e) {
        const t = new URLSearchParams(location.search, !0),
              i = e || t.get("server");
        if (typeof i != "string") return [];
        const [s, n] = i.split(":");
        return [s, n, t.get("password")];
    }
    findServer(region, index) {
        for (let region in this.servers) {
            var i = this.servers[region];
            for (let n = 0; n < i.length; n++) {
                const r = i[n];
                if (r.name === index) return r;
            }
        }
        console.warn("Could not find server in region " + region + " with index " + index + ".");
        return;
    }
    pingServers() {
        var _this = this;
        var requests = [];
        for (var region in this.servers) {
            if (!this.servers.hasOwnProperty(region)) continue;
            var serverList = this.servers[region];
            var targetServer = serverList[Math.floor(Math.random() * serverList.length)];
            if (targetServer == undefined) {
                console.log("No target server for region " + region);
                continue;
            }
            (function (serverList, targetServer) {
                var request = new XMLHttpRequest();
                request.onreadystatechange = function (requestEvent) {
                    var request = requestEvent.target;
                    if (request.readyState != 4) return;
                    if (request.status == 200) {
                        for (var i = 0; i < requests.length; i++) {
                            requests[i].abort();
                        }
                        _this.log("Connecting to region", targetServer.region);
                        var targetGame = _this.seekServer(targetServer.region);
                        _this.connect(targetGame[0], targetGame[1], targetGame[2]);
                    } else {
                        console.warn("Error pinging " + targetServer.ip + " in region " + region);
                    }
                };
                var targetAddress = "//" + _this.serverAddress(targetServer.ip, true) + ":" + _this.serverPort(targetServer) + "/ping";
                request.open("GET", targetAddress, true);
                request.send(null);
                _this.log("Pinging", targetAddress);
                requests.push(request);
            })(serverList, targetServer);
        }
    }
    seekServer(region, isPrivate, gameMode) {
        if (gameMode == undefined) {
            gameMode = "random";
        }
        if (isPrivate == undefined) {
            isPrivate = false;
        }
        const gameModeList = ["random"];
        var lobbySize = this.lobbySize;
        var lobbySpread = this.lobbySpread;
        var servers = this.servers[region]
        .flatMap(function (s) {
            var gameIndex = 0;
            return s.games.map(function (g) {
                var currentGameIndex = gameIndex++;
                return {
                    region: s.region,
                    index: s.index * s.games.length + currentGameIndex,
                    gameIndex: currentGameIndex,
                    gameCount: s.games.length,
                    playerCount: g.playerCount,
                    isPrivate: g.isPrivate,
                };
            });
        })
        .filter(function (s) {
            return !s.isPrivate;
        })
        .filter(function (s) {
            if (isPrivate) {
                return s.playerCount == 0 && s.gameIndex >= s.gameCount / 2;
            } else {
                return true;
            }
        })
        .filter(function (s) {
            if (gameMode == "random") {
                return true;
            } else {
                return gameModeList[s.index % gameModeList.length].key == gameMode;
            }
        })
        .sort(function (a, b) {
            return b.playerCount - a.playerCount;
        })
        .filter(function (s) {
            return s.playerCount < lobbySize;
        });
        if (isPrivate) {
            servers.reverse();
        }
        if (servers.length == 0) {
            this.errorCallback("No open servers.");
            return;
        }
        var randomSpread = Math.min(lobbySpread, servers.length);
        var selectedServerIndex = Math.floor(Math.random() * randomSpread);
        selectedServerIndex = Math.min(selectedServerIndex, servers.length - 1);
        var rawServer = servers[selectedServerIndex];
        var serverRegion = rawServer.region;
        var physicalServerIndex = Math.floor(rawServer.index / rawServer.gameCount);
        var gameIndex = rawServer.index % rawServer.gameCount;
        this.log("Found server.");
        return [serverRegion, physicalServerIndex, gameIndex];
    }
    connect(region, index, game) {
        if (this.connected) {
            return;
        }
        var server = this.findServer(region, index);
        if (server == undefined) {
            this.errorCallback("Failed to find server for region " + region + " and index " + index);
            return;
        }
        this.log("Connecting to server", server, "with game index", game);
        if (server.playerCount >= this.lobbySize) {
            this.errorCallback("Server is already full.");
            return;
        }
        window.history.replaceState(document.title, document.title, this.generateHref(region, index, game, this.password));
        this.server = server;
        this.gameIndex = game;
        this.log("Calling callback with address", this.serverAddress(server), "on port", this.serverPort(server), "with game index", game);
        this.callback(this.serverAddress(server), this.serverPort(server), game);
    }
    switchServer(region, index, game, password) {
        this.switchingServers = true;
        location.href = this.generateHref(region, index, null);
    }
    generateHref(region, index, game, password) {
        let s = window.location.href.split("?")[0];
        return ((s += "?server=" + region + ":" + index), game && (s += "&password=" + encodeURIComponent(game)), s);
    }
    serverAddress(e) {
        return e.region == 0 ? "localhost" : e.key + "." + e.region + "." + this.baseUrl;
    }
    serverPort(server) {
        return server.port;
    }
    processServers(servers) {

        if (intervalId) {
            clearInterval(intervalId);
        }
        return new Promise(async (resolve) => {
            const serverData = {};
            const pingServer = async (server) => {
                const regionData = serverData[server];
                const primaryServer = regionData[0];
                let serverAddress = this.serverAddress(primaryServer);
                const serverPort = this.serverPort(primaryServer);
                if (serverPort) {
                    serverAddress += `:${serverPort}`;
                }
                const pingUrl = `https://${serverAddress}/ping`;
                const startTime = new Date().getTime();
                try {
                    await Promise.race([
                        fetch(pingUrl).then(() => {
                            const pingTime = new Date().getTime() - startTime;
                            regionData.forEach((s) => {
                                s.ping = pingTime;
                            });
                        }),
                        new Promise((done) => setTimeout(done, 100)),
                    ]);
                } catch (error) {}
            };
            const processAllRegions = async () => {
                await Promise.all(Object.keys(serverData).map(pingServer));
                if (!window.blockRedraw) {
                }
            };
            servers.forEach((server) => {
                serverData[server.region] = serverData[server.region] || [];
                serverData[server.region].push(server);
            });
            for (const region in serverData) {
                serverData[region] = serverData[region].sort((a, b) => a.startTime - b.startTime);
            }
            this.servers = serverData;
            let selectedServer;
            const [queryRegion, queryName] = this.parseServerQuery();
            servers.forEach((server) => {
                if (queryRegion === server.region && queryName === server.name) {
                    server.selected = true;
                    selectedServer = server;
                }
            });
            processAllRegions()
                .then(processAllRegions)
                .then(() => {
                if (selectedServer) {
                    return;
                }
                let bestServer;
                servers.forEach((server) => {
                    if (!bestServer || bestServer.ping > server.ping) {
                        bestServer = server;
                    }
                });
                if (bestServer) {
                    bestServer.selected = true;
                    const newUrl = this.generateHref(bestServer.region, bestServer.name, this.password);
                    window.history.replaceState(document.title, document.title, newUrl);
                    if (!window.blockRedraw) {
                    }
                }
            })
                .catch((error) => {
                console.log("Failed to ping servers:", error);
            })
                .finally(resolve);
            intervalId = setInterval(processAllRegions, 5000);
        });
    }
    ipToHex(ip) {
        const encoded = ip
        .split(".")
        .map(
            (component) =>
            ("00" + parseInt(component).toString(16))
            .substr(-2),
        )
        .join("")
        .toLowerCase();
        return encoded;
    }
    hashIP(ip) {
        return md5(this.ipToHex(ip));
    }
    log() {
        if (this.debugLog) {
            return console.log.apply(undefined, arguments);
        } else if (console.verbose) {
            return console.verbose.apply(undefined, arguments);
        }
    }
    stripRegion(region) {
        if (region.startsWith("vultr:")) {
            region = region.slice(6);
        } else if (region.startsWith("do:")) {
            region = region.slice(3);
        }
        return region;
    }
}
const concat = function (x, y) {
    return x.concat(y);
};
const flatMap = function (f, xs) {
    return xs.map(f).reduce(concat, []);
};
Array.prototype.flatMap = function (f) {
    return flatMap(f, this);
};

class AiManager {
    constructor(ais, AI, players, items, objectManager, config, UTILS, scoreCallback, server) {
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
                name: "Technoblade",
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
                name: "nerfed duck man",
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
                weightM: 0.45,
                speed: 0.0015,
                turnSpeed: 0.0025,
                scale: 94,
                viewRange: 1440,
                chargePlayer: !0,
                drop: ["food", 3e3],
                minSpawnRange: 0.85,
                maxSpawnRange: 0.9,
            },
            {
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
                weightM: 0.45,
                speed: 0.00115,
                turnSpeed: 0.0025,
                scale: 88,
                viewRange: 1440,
                chargePlayer: !0,
                drop: ["food", 400],
                minSpawnRange: 0.85,
                maxSpawnRange: 0.9,
            },
            {
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
                weightM: 0.45,
                speed: 0.00115,
                turnSpeed: 0.0025,
                scale: 94,
                viewRange: 1440,
                chargePlayer: !0,
                drop: ["food", 800],
                minSpawnRange: 0.85,
                maxSpawnRange: 0.9,
            },
        ];
        this.spawn = function (x, y, dir, index) {
            var tmpObj;
            for (var i = 0; i < ais.length; ++i) {
                if (!ais[i].active) {
                    tmpObj = ais[i];
                    break;
                }
            }
            if (!tmpObj) {
                tmpObj = new AI(ais.length, objectManager, players, items, UTILS, config, scoreCallback, server);
                ais.push(tmpObj);
            }
            tmpObj.init(x, y, dir, index, this.aiTypes[index]);
            return tmpObj;
        };
    }
}


function serialize(data) {
    const pow32 = 0x100000000;
    let floatBuffer, floatView;
    let array = new Uint8Array(128);
    let length = 0;
    append(data);
    return array.subarray(0, length);

    function append(data) {
        switch (typeof data) {
            case "undefined":
                appendNull(data);
                break;
            case "boolean":
                appendBoolean(data);
                break;
            case "number":
                appendNumber(data);
                break;
            case "string":
                appendString(data);
                break;
            case "object":
                if (data === null) {
                    appendNull(data);
                } else if (data instanceof Date) {
                    appendDate(data);
                } else if (Array.isArray(data)) {
                    appendArray(data);
                } else if (data instanceof Uint8Array || data instanceof Uint8ClampedArray) {
                    appendBinArray(data);
                } else if (data instanceof Int8Array || data instanceof Int16Array || data instanceof Uint16Array || data instanceof Int32Array || data instanceof Uint32Array || data instanceof Float32Array || data instanceof Float64Array) {
                    appendArray(data);
                } else {
                    appendObject(data);
                }
                break;
        }
    }

    function appendNull(data) {
        appendByte(0xc0);
    }

    function appendBoolean(data) {
        appendByte(data ? 0xc3 : 0xc2);
    }

    function appendNumber(data) {
        if (isFinite(data) && Math.floor(data) === data) {
            if (data >= 0 && data <= 0x7f) {
                appendByte(data);
            } else if (data < 0 && data >= -0x20) {
                appendByte(data);
            } else if (data > 0 && data <= 0xff) {
                appendBytes([0xcc, data]);
            } else if (data >= -0x80 && data <= 0x7f) {
                appendBytes([0xd0, data]);
            } else if (data > 0 && data <= 0xffff) {
                appendBytes([0xcd, data >>> 8, data]);
            } else if (data >= -0x8000 && data <= 0x7fff) {
                appendBytes([0xd1, data >>> 8, data]);
            } else if (data > 0 && data <= 0xffffffff) {
                appendBytes([0xce, data >>> 24, data >>> 16, data >>> 8, data]);
            } else if (data >= -0x80000000 && data <= 0x7fffffff) {
                appendBytes([0xd2, data >>> 24, data >>> 16, data >>> 8, data]);
            } else if (data > 0 && data <= 0xffffffffffffffff) {
                let hi = data / pow32;
                let lo = data % pow32;
                appendBytes([0xd3, hi >>> 24, hi >>> 16, hi >>> 8, hi, lo >>> 24, lo >>> 16, lo >>> 8, lo]);
            } else if (data >= -0x8000000000000000 && data <= 0x7fffffffffffffff) {
                appendByte(0xd3);
                appendInt64(data);
            } else if (data < 0) {
                appendBytes([0xd3, 0x80, 0, 0, 0, 0, 0, 0, 0]);
            } else {
                appendBytes([0xcf, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
            }
        } else {
            if (!floatView) {
                floatBuffer = new ArrayBuffer(8);
                floatView = new DataView(floatBuffer);
            }
            floatView.setFloat64(0, data);
            appendByte(0xcb);
            appendBytes(new Uint8Array(floatBuffer));
        }
    }

    function appendString(data) {
        let bytes = encodeUtf8(data);
        let length = bytes.length;

        if (length <= 0x1f) {
            appendByte(0xa0 + length);
        } else if (length <= 0xff) {
            appendBytes([0xd9, length]);
        } else if (length <= 0xffff) {
            appendBytes([0xda, length >>> 8, length]);
        } else {
            appendBytes([0xdb, length >>> 24, length >>> 16, length >>> 8, length]);
        }

        appendBytes(bytes);
    }

    function appendArray(data) {
        let length = data.length;

        if (length <= 0xf) {
            appendByte(0x90 + length);
        } else if (length <= 0xffff) {
            appendBytes([0xdc, length >>> 8, length]);
        } else {
            appendBytes([0xdd, length >>> 24, length >>> 16, length >>> 8, length]);
        }

        for (let index = 0; index < length; index++) {
            append(data[index]);
        }
    }

    function appendBinArray(data) {
        let length = data.length;

        if (length <= 0xf) {
            appendBytes([0xc4, length]);
        } else if (length <= 0xffff) {
            appendBytes([0xc5, length >>> 8, length]);
        } else {
            appendBytes([0xc6, length >>> 24, length >>> 16, length >>> 8, length]);
        }

        appendBytes(data);
    }

    function appendObject(data) {
        let length = 0;
        for (let key in data) length++;

        if (length <= 0xf) {
            appendByte(0x80 + length);
        } else if (length <= 0xffff) {
            appendBytes([0xde, length >>> 8, length]);
        } else {
            appendBytes([0xdf, length >>> 24, length >>> 16, length >>> 8, length]);
        }

        for (let key in data) {
            append(key);
            append(data[key]);
        }
    }

    function appendDate(data) {
        let sec = data.getTime() / 1000;
        if (data.getMilliseconds() === 0 && sec >= 0 && sec < 0x100000000) {
            appendBytes([0xd6, 0xff, sec >>> 24, sec >>> 16, sec >>> 8, sec]);
        } else if (sec >= 0 && sec < 0x400000000) {
            let ns = data.getMilliseconds() * 1000000;
            appendBytes([0xd7, 0xff, ns >>> 22, ns >>> 14, ns >>> 6, ((ns << 2) >>> 0) | (sec / pow32), sec >>> 24, sec >>> 16, sec >>> 8, sec]);
        } else {
            let ns = data.getMilliseconds() * 1000000;
            appendBytes([0xc7, 12, 0xff, ns >>> 24, ns >>> 16, ns >>> 8, ns]);
            appendInt64(sec);
        }
    }

    function appendByte(byte) {
        if (array.length < length + 1) {
            let newLength = array.length * 2;
            while (newLength < length + 1) newLength *= 2;
            let newArray = new Uint8Array(newLength);
            newArray.set(array);
            array = newArray;
        }
        array[length] = byte;
        length++;
    }

    function appendBytes(bytes) {
        if (array.length < length + bytes.length) {
            let newLength = array.length * 2;
            while (newLength < length + bytes.length) newLength *= 2;
            let newArray = new Uint8Array(newLength);
            newArray.set(array);
            array = newArray;
        }
        array.set(bytes, length);
        length += bytes.length;
    }

    function appendInt64(value) {
        let hi, lo;
        if (value >= 0) {
            hi = value / pow32;
            lo = value % pow32;
        } else {
            value++;
            hi = Math.abs(value) / pow32;
            lo = Math.abs(value) % pow32;
            hi = ~hi;
            lo = ~lo;
        }
        appendBytes([hi >>> 24, hi >>> 16, hi >>> 8, hi, lo >>> 24, lo >>> 16, lo >>> 8, lo]);
    }
}

function deserialize(array) {
    const pow32 = 0x100000000;
    let pos = 0;
    if (array instanceof ArrayBuffer) {
        array = new Uint8Array(array);
    }
    if (typeof array !== "object" || typeof array.length === "undefined") {
        throw new Error("Invalid argument type: Expected a byte array (Array or Uint8Array) to deserialize.");
    }
    if (!array.length) {
        throw new Error("Invalid argument: The byte array to deserialize is empty.");
    }
    if (!(array instanceof Uint8Array)) {
        array = new Uint8Array(array);
    }
    let data = read();
    if (pos < array.length) {
    }
    return data;

    function read() {
        const byte = array[pos++];
        if (byte >= 0x00 && byte <= 0x7f) return byte;
        if (byte >= 0x80 && byte <= 0x8f) return readMap(byte - 0x80);
        if (byte >= 0x90 && byte <= 0x9f) return readArray(byte - 0x90);
        if (byte >= 0xa0 && byte <= 0xbf) return readStr(byte - 0xa0);
        if (byte === 0xc0) return null;
        if (byte === 0xc1) throw new Error("Invalid byte code 0xc1 found.");
        if (byte === 0xc2) return false;
        if (byte === 0xc3) return true;
        if (byte === 0xc4) return readBin(-1, 1);
        if (byte === 0xc5) return readBin(-1, 2);
        if (byte === 0xc6) return readBin(-1, 4);
        if (byte === 0xc7) return readExt(-1, 1);
        if (byte === 0xc8) return readExt(-1, 2);
        if (byte === 0xc9) return readExt(-1, 4);
        if (byte === 0xca) return readFloat(4);
        if (byte === 0xcb) return readFloat(8);
        if (byte === 0xcc) return readUInt(1);
        if (byte === 0xcd) return readUInt(2);
        if (byte === 0xce) return readUInt(4);
        if (byte === 0xcf) return readUInt(8);
        if (byte === 0xd0) return readInt(1);
        if (byte === 0xd1) return readInt(2);
        if (byte === 0xd2) return readInt(4);
        if (byte === 0xd3) return readInt(8);
        if (byte === 0xd4) return readExt(1);
        if (byte === 0xd5) return readExt(2);
        if (byte === 0xd6) return readExt(4);
        if (byte === 0xd7) return readExt(8);
        if (byte === 0xd8) return readExt(16);
        if (byte === 0xd9) return readStr(-1, 1);
        if (byte === 0xda) return readStr(-1, 2);
        if (byte === 0xdb) return readStr(-1, 4);
        if (byte === 0xdc) return readArray(-1, 2);
        if (byte === 0xdd) return readArray(-1, 4);
        if (byte === 0xde) return readMap(-1, 2);
        if (byte === 0xdf) return readMap(-1, 4);
        if (byte >= 0xe0 && byte <= 0xff) return byte - 256;
        console.debug("msgpack array:", array);
        throw new Error("Invalid byte value '" + byte + "' at index " + (pos - 1) + " in the MessagePack binary data (length " + array.length + "): Expecting a range of 0 to 255. This is not a byte array.");
    }

    function readInt(size) {
        let value = 0;
        let first = true;
        while (size-- > 0) {
            if (first) {
                let byte = array[pos++];
                value += byte & 0x7f;
                if (byte & 0x80) {
                    value -= 0x80;
                }
                first = false;
            } else {
                value *= 256;
                value += array[pos++];
            }
        }
        return value;
    }

    function readUInt(size) {
        let value = 0;
        while (size-- > 0) {
            value *= 256;
            value += array[pos++];
        }
        return value;
    }

    function readFloat(size) {
        let view = new DataView(array.buffer, pos, size);
        pos += size;
        if (size === 4) {
            return view.getFloat32(0, false);
        }
        if (size === 8) {
            return view.getFloat64(0, false);
        }
    }

    function readBin(size, lengthSize) {
        if (size < 0) size = readUInt(lengthSize);
        let data = array.subarray(pos, pos + size);
        pos += size;
        return data;
    }

    function readMap(size, lengthSize) {
        if (size < 0) size = readUInt(lengthSize);
        let data = {};
        while (size-- > 0) {
            let key = read();
            data[key] = read();
        }
        return data;
    }

    function readArray(size, lengthSize) {
        if (size < 0) size = readUInt(lengthSize);
        let data = [];
        while (size-- > 0) {
            data.push(read());
        }
        return data;
    }

    function readStr(size, lengthSize) {
        if (size < 0) size = readUInt(lengthSize);
        let start = pos;
        pos += size;
        return decodeUtf8(array, start, size);
    }

    function readExt(size, lengthSize) {
        if (size < 0) size = readUInt(lengthSize);
        let type = readUInt(1);
        let data = readBin(size);
        switch (type) {
            case 255:
                return readExtDate(data);
        }
        return { type: type, data: data };
    }

    function readExtDate(data) {
        if (data.length === 4) {
            let sec = ((data[0] << 24) >>> 0) + ((data[1] << 16) >>> 0) + ((data[2] << 8) >>> 0) + data[3];
            return new Date(sec * 1000);
        }
        if (data.length === 8) {
            let ns = ((data[0] << 22) >>> 0) + ((data[1] << 14) >>> 0) + ((data[2] << 6) >>> 0) + (data[3] >>> 2);
            let sec = (data[3] & 0x3) * pow32 + ((data[4] << 24) >>> 0) + ((data[5] << 16) >>> 0) + ((data[6] << 8) >>> 0) + data[7];
            return new Date(sec * 1000 + ns / 1000000);
        }
        if (data.length === 12) {
            let ns = ((data[0] << 24) >>> 0) + ((data[1] << 16) >>> 0) + ((data[2] << 8) >>> 0) + data[3];
            pos -= 8;
            let sec = readInt(8);
            return new Date(sec * 1000 + ns / 1000000);
        }
        throw new Error("Invalid data length for a date value.");
    }
}

function encodeUtf8(str) {
    let ascii = true,
        length = str.length;
    for (let x = 0; x < length; x++) {
        if (str.charCodeAt(x) > 127) {
            ascii = false;
            break;
        }
    }

    let i = 0,
        bytes = new Uint8Array(str.length * (ascii ? 1 : 4));
    for (let ci = 0; ci !== length; ci++) {
        let c = str.charCodeAt(ci);
        if (c < 128) {
            bytes[i++] = c;
            continue;
        }
        if (c < 2048) {
            bytes[i++] = (c >> 6) | 192;
        } else {
            if (c > 0xd7ff && c < 0xdc00) {
                if (++ci >= length) throw new Error("UTF-8 encode: incomplete surrogate pair");
                let c2 = str.charCodeAt(ci);
                if (c2 < 0xdc00 || c2 > 0xdfff) throw new Error("UTF-8 encode: second surrogate character 0x" + c2.toString(16) + " at index " + ci + " out of range");
                c = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);
                bytes[i++] = (c >> 18) | 240;
                bytes[i++] = ((c >> 12) & 63) | 128;
            } else bytes[i++] = (c >> 12) | 224;
            bytes[i++] = ((c >> 6) & 63) | 128;
        }
        bytes[i++] = (c & 63) | 128;
    }
    return ascii ? bytes : bytes.subarray(0, i);
}

function decodeUtf8(bytes, start, length) {
    let i = start,
        str = "";
    length += start;
    while (i < length) {
        let c = bytes[i++];
        if (c > 127) {
            if (c > 191 && c < 224) {
                if (i >= length) throw new Error("UTF-8 decode: incomplete 2-byte sequence");
                c = ((c & 31) << 6) | (bytes[i++] & 63);
            } else if (c > 223 && c < 240) {
                if (i + 1 >= length) throw new Error("UTF-8 decode: incomplete 3-byte sequence");
                c = ((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
            } else if (c > 239 && c < 248) {
                if (i + 2 >= length) throw new Error("UTF-8 decode: incomplete 4-byte sequence");
                c = ((c & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
            } else throw new Error("UTF-8 decode: unknown multibyte start 0x" + c.toString(16) + " at index " + (i - 1));
        }
        if (c <= 0xffff) str += String.fromCharCode(c);
        else if (c <= 0x10ffff) {
            c -= 0x10000;
            str += String.fromCharCode((c >> 10) | 0xd800);
            str += String.fromCharCode((c & 0x3ff) | 0xdc00);
        } else throw new Error("UTF-8 decode: code point 0x" + c.toString(16) + " exceeds UTF-16 reach");
    }
    return str;
}

let msgpack = {
    serialize: serialize,
    deserialize: deserialize,
    encode: serialize,
    decode: deserialize,
};

class AI {
    constructor(sid, objectManager, players, items, UTILS, config) {
        this.sid = sid;
        this.isAI = true;
        this.nameIndex = UTILS.randInt(0, config.cowNames.length - 1);
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
        var tmpRatio = 0;
        var animIndex = 0;
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
        this.startAnim = function () {
            this.animTime = this.animSpeed = 600;
            this.targetAngle = Math.PI * 0.8;
            tmpRatio = 0;
            animIndex = 0;
        };
    }
}

(function () {
    "use strict";

    window.scriptVersion = "kn1a24";
    window.addEventListener("keydown", (e) => {
        if (e.key === "F12" || (e.ctrlKey && e.shiftKey && e.key === "I") || (e.ctrlKey && e.shiftKey && e.key === "C") || (e.ctrlKey && (e.key === "U" || e.key === "u")) || (e.metaKey && e.altKey && e.key === "Dead")) {
            e.preventDefault();
        }
    });
    window.loadedScript = true;
    var player;
    var playerSID;
    var tmpObj;
    var camX;
    var camY;
    var screenWidth;
    var screenHeight;
    var lastDeath;
    var minimapData;
    var mapMarker;
    var tmpSkin;
    var vultrClient = new VultrClient("moomoo.io", 3000, config.maxPlayers, 5, false);
    vultrClient.debugLog = false;
    var gameObjects = [];
    class GameObject {
        constructor(e) {
            this.sid = e;
        }
        init(e, t, i, s, n, a, l) {
            a = a || {};
            this.sentTo = {};
            this.gridLocations = [];
            this.active = true;
            this.doUpdate = a.doUpdate;
            this.x = e;
            this.y = t;
            this.dir = i;
            this.xWiggle = 0;
            this.yWiggle = 0;
            this.scale = s;
            this.type = n;
            this.colorType = UTILS.randInt(0, 10);
            this.id = a.id;
            this.owner = l;
            this.name = a.name;
            this.isItem = this.id != undefined;
            this.group = a.group;
            this.health = a.health;
            this.currentHealth = this.health;
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
            this.colDiv = a.colDiv || 1;
            this.turretReload = 2200;
            this.blocker = a.blocker;
            this.ignoreCollision = a.ignoreCollision;
            this.dontGather = a.dontGather;
            this.hideFromEnemy = a.hideFromEnemy;
            this.friction = a.friction;
            this.projDmg = a.projDmg;
            this.dmg = a.dmg;
            this.pDmg = a.pDmg;
            this.pps = a.pps;
            this.zIndex = a.zIndex || 0;
            this.turnSpeed = a.turnSpeed;
            this.req = a.req;
            this.trap = a.trap;
            this.healCol = a.healCol;
            this.teleport = a.teleport;
            this.boostSpeed = a.boostSpeed;
            this.projectile = a.projectile;
            this.shootRange = a.shootRange;
            this.shootRate = a.shootRate;
            this.shootCount = this.shootRate;
            this.spawnPoint = a.spawnPoint;
        }
        getScale(e, t) {
            e = e || 1;
            return this.scale * (this.isItem || this.type == 2 || this.type == 3 || this.type == 4 ? 1 : e * 0.6) * (t ? 1 : this.colDiv);
        }
        update(e) {
            if (this.active) {
                if (this.xWiggle) {
                    this.xWiggle *= Math.pow(0.99, e);
                }
                if (this.yWiggle) {
                    this.yWiggle *= Math.pow(0.99, e);
                }
                if (this.turnSpeed) {
                    if ((scriptMenu.toggles.millRotate && this?.group?.name == "mill") || this?.group?.name != "mill") {
                        this.dir += this.turnSpeed * e;
                    }
                }
            }
        }
    }
    class ObjectManager {
        constructor() {
            this.tmpScale = config.mapScale / config.colGrid;
            this.grids = [];
        }
        disableObj(e) {
            e.active = false;
            this.removeObjGrid(e);
        }
        disableBySid(e) {
            for (let t = 0; t < gameObjects.length; t++) {
                if (gameObjects[t].sid == e) {
                    this.disableObj(gameObjects[t]);
                    return gameObjects[t];
                }
            }
        }
        removeAllItems(e) {
            for (let t = 0; t < gameObjects.length; t++) {
                let i = gameObjects[t];
                if (i.active && i.owner && i.owner.sid == e) {
                    this.disableObj(i);
                }
            }
        }
        checkItemLocation(e, t, i, s, n, a, l, o) {
            if (!a && n != 18 && t >= config.mapScale / 2 - config.riverWidth / 2 && t <= config.mapScale / 2 + config.riverWidth / 2) {
                return false;
            }
            for (let r = 0; r < game.closeObjects.length; r++) {
                let c = game.closeObjects[r];
                if (c.active) {
                    let d = c.blocker ? c.blocker : c.getScale(s, c.isItem);
                    if (
                        UTILS.getDistance(
                            {
                                x: e,
                                y: t,
                            },
                            c,
                        ) <
                        i + d &&
                        (!l || (l.length ? !l.find((e) => e.sid == c.sid) : l.sid != c.sid))
                    ) {
                        return !!o && c;
                    }
                }
            }
            return true;
        }
        add(e, t, i, s, n, a, l, o, r) {
            let c;
            for (let d = 0; d < gameObjects.length; d++) {
                let p = gameObjects[d];
                if (p.sid == e) {
                    c = p;
                    break;
                }
            }
            if (!c) {
                for (let h = 0; h < gameObjects.length; h++) {
                    if (!gameObjects[h].active) {
                        c = gameObjects[h];
                        break;
                    }
                }
            }
            if (!c) {
                c = new GameObject(e);
                gameObjects.push(c);
            }
            if (o) {
                c.sid = e;
            }
            c.init(t, i, s, n, a, l, r);
            this.setObjectGrids(c);
        }
        getGridArrays(e, t, i) {
            let s = this.tmpScale;
            let n;
            let a = [];
            let l = Math.floor(e / s);
            let o = Math.floor(t / s);
            try {
                if (this.grids[l + "_" + o]) {
                    a.push(this.grids[l + "_" + o]);
                }
                if (e + i >= (l + 1) * s) {
                    if ((n = this.grids[l + 1 + "_" + o])) {
                        a.push(n);
                    }
                    if (o && t - i <= o * s) {
                        if ((n = this.grids[l + 1 + "_" + (o - 1)])) {
                            a.push(n);
                        }
                    } else if (t + i >= (o + 1) * s && (n = this.grids[l + 1 + "_" + (o + 1)])) {
                        a.push(n);
                    }
                }
                if (l && e - i <= l * s) {
                    if ((n = this.grids[l - 1 + "_" + o])) {
                        a.push(n);
                    }
                    if (o && t - i <= o * s) {
                        if ((n = this.grids[l - 1 + "_" + (o - 1)])) {
                            a.push(n);
                        }
                    } else if (t + i >= (o + 1) * s && (n = this.grids[l - 1 + "_" + (o + 1)])) {
                        a.push(n);
                    }
                }
                if (t + i >= (o + 1) * s && (n = this.grids[l + "_" + (o + 1)])) {
                    a.push(n);
                }
                if (o && t - i <= o * s && (n = this.grids[l + "_" + (o - 1)])) {
                    a.push(n);
                }
            } catch (r) {}
            return a;
        }
        checkCollision(e, t, i, s) {
            i = i || 1;
            let n = e.x - t.x;
            let a = e.y - t.y;
            let l = e.scale + t.scale;
            if (s != t.sid && (Math.abs(n) <= l || Math.abs(a) <= l) && Math.sqrt(n * n + a * a) - (l = e.scale + (t.getScale ? t.getScale() : t.scale)) <= 0) {
                if (t.ignoreCollision) {
                    let o = UTILS.getDirection(
                        {
                            x: e.x,
                            y: e.y,
                        },
                        {
                            x: t.x,
                            y: t.y,
                        },
                    );
                    e.x = t.x + l * Math.cos(o);
                    e.y = t.y + l * Math.sin(o);
                    e.velx *= 0.75;
                    e.vely *= 0.75;
                    if (t.dmg && (e.sid == playerSID ? !game.isFriendly(t.owner.sid) : game.isFriendly(t.owner.sid))) {
                        let r = (t.weightM || 1) * 1.5;
                        e.dmg += t.dmg;
                        e.velx += r * Math.cos(o);
                        e.vely += r * Math.sin(o);
                    }
                } else if (t.trap && UTILS.getDistance(e, t) < 50 && (e.sid == playerSID ? !game.isFriendly(t.owner.sid) : game.isFriendly(t.owner.sid))) {
                    e.velx = 0;
                    e.vely = 0;
                    e.trap = true;
                } else if (t.boostSpeed) {
                    e.velx += i * t.boostSpeed * Math.cos(t.dir);
                    e.vely += i * t.boostSpeed * Math.sin(t.dir);
                } else if (t.teleport) {
                    e.x = 0;
                    e.y = 0;
                }
                if (t.zIndex > e.zIndex) {
                    e.zIndex = t.zIndex;
                }
                return true;
            }
            return false;
        }
        setObjectGrids(e) {
            let t;
            let i;
            let s = this.tmpScale;
            let n = Math.min(config.mapScale, Math.max(0, e.x));
            let a = Math.min(config.mapScale, Math.max(0, e.y));
            for (let l = 0; l < config.colGrid; l++) {
                t = l * this.tmpScale;
                for (let o = 0; o < config.colGrid; o++) {
                    i = o * this.tmpScale;
                    if (n + e.scale >= t && n - e.scale <= t + s && a + e.scale >= i && a - e.scale <= i + s) {
                        this.grids[l + "_" + o] ||= [];
                        this.grids[l + "_" + o].push(e);
                        e.gridLocations.push(l + "_" + o);
                    }
                }
            }
        }
        removeObjGrid(e) {
            for (let t = 0; t < e.gridLocations.length; t++) {
                let i = this.grids[e.gridLocations[t]].indexOf(e);
                if (i >= 0) {
                    this.grids[e.gridLocations[t]].splice(i, 1);
                }
            }
        }
    }
    var delta;
    var now;
    var lastSent;
    var attackState;
    var objectManager = new ObjectManager();
    var pixelDensity = 1;
    var lastUpdate = Date.now();
    var keys = {};
    var ais = [];
    var players = [];
    var alliances = [];
    var projectiles = [];
    var projectileManager = new ProjectileManager(Projectile, projectiles, players, ais, objectManager, items, config, UTILS);
    var aiManager = new AiManager(ais, AI, players, items, null, config, UTILS);
    var waterMult = 1;
    var waterPlus = 0;
    var mouseX = 0;
    var mouseY = 0;
    var maxScreenWidth = config.maxScreenWidth;
    var maxScreenHeight = config.maxScreenHeight;
    var inGame = false;
    const pageEl = (id) => document.getElementById(id);
    const dropEl = (id) => { const e = pageEl(id); if (e) e.remove(); };
    if (pageEl("ageBarContainer")) pageEl("ageBarContainer").style.position = "absolute";
    var itemInfoHolder = document.getElementById("itemInfoHolder");
    var mainMenu = document.getElementById("mainMenu");
    CHICKEN_COSMOS.install(mainMenu);
    var allianceButton = document.getElementById("allianceButton");
    var storeButton = document.getElementById("storeButton");
    var chatButton = document.getElementById("chatButton");
    var gameCanvas = document.getElementById("gameCanvas");
    var mainContext = gameCanvas.getContext("2d");
    var pingDisplay = document.getElementById("pingDisplay");
    document.body.append(pingDisplay);
    var shutdownDisplay = document.getElementById("shutdownDisplay");
    dropEl("linksContainer2");
    dropEl("menuCardHolder");
    dropEl("gameName");
    dropEl("loadingText");
    var gameUI = document.getElementById("gameUI");
    dropEl("partyButton");
    dropEl("joinPartyButton");
    dropEl("settingsButton");
    dropEl("leaderboardButton");
    dropEl("menuContainer");
    document.getElementById("leaderboard").style.fontSize = "26px";
    var actionBar = document.getElementById("actionBar");
    actionBar.style.position = "absolute";
    var scoreDisplay = document.getElementById("scoreDisplay");
    var foodDisplay = document.getElementById("foodDisplay");
    var woodDisplay = document.getElementById("woodDisplay");
    var stoneDisplay = document.getElementById("stoneDisplay");
    var killCounter = document.getElementById("killCounter");
    var leaderboardData = document.getElementById("leaderboardData");
    var itemInfoHolder = document.getElementById("itemInfoHolder");
    var ageText = document.getElementById("ageText");
    ageText.style.position = "absolute";
    var ageBarBody = document.getElementById("ageBarBody");
    var upgradeHolder = document.getElementById("upgradeHolder");
    upgradeHolder.style.top = "50px";
    var upgradeCounter = document.getElementById("upgradeCounter");
    upgradeCounter.style.top = "125px";
    var allianceMenu = document.getElementById("allianceMenu");
    var allianceHolder = document.getElementById("allianceHolder");
    var allianceManager = document.getElementById("allianceManager");
    var mapDisplay = document.getElementById("mapDisplay");
    var diedText = document.getElementById("diedText");
    var skinColorHolder = document.getElementById("skinColorHolder");
    var mapContext = mapDisplay.getContext("2d");
    mapDisplay.width = 300;
    mapDisplay.height = 300;
    var storeMenu = document.getElementById("storeMenu");
    var storeHolder = document.getElementById("storeHolder");
    var noticationDisplay = document.getElementById("noticationDisplay");
    noticationDisplay.style.top = "20px";
    noticationDisplay.style.right = "20px";
    var topInfoHolder;
    var hats = store.hats;
    var accessories = store.accessories;
    var outlineColor = "#525252";
    var darkOutlineColor = "#3d3f42";
    var outlineWidth = 5.5;
    var isSandbox = location.hostname === "sandbox-dev.moomoo.io" || location.hostname === "sandbox.moomoo.io";
    var mathPI = Math.PI;
    var mathPI2 = Math.PI * 2;
    if (pageEl("topInfoHolder")) pageEl("topInfoHolder").style.left = "20px";
    document.getElementById("resDisplay").appendChild(killCounter);
    killCounter.style.bottom = location.hostname == "sandbox.moomoo.io" ? "20px" : "185px";
    if (location.hostname == "sandbox.moomoo.io") {
        foodDisplay.style.display = "none";
        woodDisplay.style.display = "none";
        stoneDisplay.style.display = "none";
    }
    killCounter.style.right = "20px";
    allianceButton.style.left = "330px";
    chatButton.style.display = "none";
    storeButton.style.left = "270px";
    mapDisplay.style.backgroundSize = "100% 100%";
    mapDisplay.style.backgroundImage = "url('https://i.imgur.com/fgFsQJp.png')";
    storeButton.removeAttribute("id");
    allianceButton.removeAttribute("id");
    itemInfoHolder.style.left = "270px";
    itemInfoHolder.style.top = "80px";
    Math.lerpAngle = function (e, t, i) {
        if (Math.abs(t - e) > mathPI) {
            if (e > t) {
                t += mathPI2;
            } else {
                e += mathPI2;
            }
        }
        var s = t + (e - t) * i;
        if (s >= 0 && s <= mathPI2) {
            return s;
        } else {
            return s % mathPI2;
        }
    };
    var mainMenuManager = new (class {
        constructor() {
            this.tmpCamera = {
                x: config.mapScale / 2,
                y: config.mapScale / 2,
                dir: Math.random() * Math.PI * 2,
                lastChange: Date.now(),
            };
            this.skinColor = 0;
            this.menuElement = document.createElement("div");
            this.menuElement.style = `
           position: absolute;
           left: 50%;
           top: 50%;
           transform: translate(-50%, -50%);
           width: 650px;
           height: 450px;
           `;
            this.menuElement.id = "ckMenu";
            this.menuElement.innerHTML = `
               <div id="gameName" style="position: absolute; color: white; top: 0px; left: 0px; font-size: 72px; text-align: center; width: 100%;">
                    <span style="color:#fff;text-shadow:0 0 5px #fff,0 0 10px #fff,0 0 15px #fff,0 0 20px #fff,0 0 25px #fff,0 0 30px #fff,0 0 35px #fff;">unX</span>
               </div>
               <div id="loadingText" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 100%; font-size: 18px; color: white;">
                   Connecting to socket server...
               </div>
               <div id="mainMenuItemHolder" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 100%;">
               </div>
           `;
            mainMenu.appendChild(this.menuElement);
            this.gameName = document.getElementById("gameName");
            this.loadingText = document.getElementById("loadingText");
            this.mainMenuItemHolder = document.getElementById("mainMenuItemHolder");
            this.controlsButton = document.createElement("div");
            this.controlsButton.style = `
           position: absolute;
           top: 70px;
           right: 20px;
           cursor: pointer;
           `;
            this.controlsButton.innerHTML = `
           <div style="display: flex; align-items: center; color: white;">
           <i class="material-icons" style="font-size: 30px; vertical-align: middle;">help</i>
           <span style="margin-left: 5px; font-size: 18px;">Help</span>
           </div>
           `;
            this.controlsButton.onclick = () => {
                this.channelLogButton.style.display = "none";
                this.controlsButton.style.display = "none";
                this.discordButton.style.display = "none";
                this.controlsElement.style.right = "0px";
            };
            this.controlsElement = document.createElement("div");
            this.controlsElement.style = `
           position: absolute;
           top: 0px;
           right: -450px;
           width: 450px;
           height: 100%;
           transition: all .5s ease;
           background-color: rgb(0, 0, 0, .3);
           z-index: 1000;
           `;
            this.controlsElement.innerHTML = `
           <div style="position: absolute; top: 7px; left: 7px; font-size: 24px; color: white;">Controls / Help</div>
           <div id="closeControlsElement" style="position: absolute; cursor: pointer; top: 7px; right: 7px; font-size: 24px; color: white;">
               <i class="material-icons" style="font-size: 30px; vertical-align: middle;">close</i>
           </div>
           <div style="position: absolute; bottom: 0px; left: 0px; width: 100%; height: calc(100% - 40px); overflow-y: scroll; margin-left: 7px; color: white;">
               Desktop Controls:
               <div style="margin-left: 7px;">
                   Movement: W, A, S, D<br>
                   Aim: Mouse<br>
                   Auto Tank Hits: Left Click<br>
                   Auto Bullspam: Space Hold<br>
                   Auto Mills: Z<br>
                   Trap / Boost Pad: F<br>
                   Turret / Teleporter: H<br>
                   Spike: V<br>
                   Toggle ATOS (Auto-Trigger OneShot): R<br>
                   Auto Song: Shift + C<br>
                   Debug: Shift + Z<br>
               </div>
               <br>
               Other info:
               <div style="margin-left: 7px;">
                   Reading the Notes section of the script's menu can be very helpful!
               </div>
           </div>
           `;
            mainMenu.appendChild(this.controlsElement);
            this.closeControlsElement = document.getElementById("closeControlsElement");
            this.closeControlsElement.onclick = () => {
                this.controlsButton.style.display = "block";
                this.channelLogButton.style.display = "block";
                this.discordButton.style.display = "block";
                this.controlsElement.style.right = "-450px";
            };
            this.channelLogButton = document.createElement("div");
            this.channelLogButton.style = `
           position: absolute;
           top: 10px;
           right: 20px;
           cursor: pointer;
           `;
            this.channelLogButton.innerHTML = `
           <div style="display: flex; align-items: center; color: white;">
           <i class="material-icons" style="font-size: 30px; vertical-align: middle;">history</i>
           <span style="margin-left: 5px; font-size: 18px;">Changelogs / Dev Logs</span>
           </div>
           `;
            this.channelLogButton.onclick = () => {
                this.controlsButton.style.display = "none";
                this.channelLogButton.style.display = "none";
                this.discordButton.style.display = "none";
                this.changeLogElement.style.right = "0px";
            };
            this.changeLogElement = document.createElement("div");
            this.changeLogElement.style = `
           position: absolute;
           top: 0px;
           right: -450px;
           width: 450px;
           height: 100%;
           transition: all .5s ease;
           background-color: rgb(0, 0, 0, .3);
           z-index: 1000;
           `;
            this.changeLogElement.innerHTML = `
           <div style="position: absolute; top: 7px; left: 7px; font-size: 24px; color: white;">Changelog</div>
           <div id="closeChangelogs" style="position: absolute; cursor: pointer; top: 7px; right: 7px; font-size: 24px; color: white;">
               <i class="material-icons" style="font-size: 30px; vertical-align: middle;">close</i>
           </div>
           <div id="changeLogTextElement" style="position: absolute; bottom: 0px; left: 0px; width: 100%; height: calc(100% - 40px); overflow-y: scroll; margin-left: 7px; color: white;">
           Loading Changelogs / Dev logs
           </div>
           `;
            mainMenu.appendChild(this.changeLogElement);
            this.changeLogTextElement = document.getElementById("changeLogTextElement");
            this.closeChangelogs = document.getElementById("closeChangelogs");
            this.closeChangelogs.onclick = () => {
                this.controlsButton.style.display = "block";
                this.channelLogButton.style.display = "block";
                this.discordButton.style.display = "block";
                this.changeLogElement.style.right = "-450px";
            };
            this.createdByElement = document.createElement("div");
            this.createdByElement.style = `
           position: absolute;
           bottom: 5px;
           left: 5px;
           color: white;
           `;
            this.createdByElement.innerHTML = `
           Script Version: <a>${window.scriptVersion}</a><br>
           Game created by <a href="https://frvr.com/" style="cursor: pointer;" target="_blank">FRVR</a><br>
           Script created by <a href="https://www.youtube.com/@memeganoob" style="cursor: pointer;" target="_blank">mega</a>
           `;
            this.discordButton = document.createElement("div");
            this.discordButton.style = `
           position: absolute;
           top: 35px;
           right: 20px;
           cursor: pointer;
           `;
            this.discordButton.innerHTML = `
           <div style="display: flex; align-items: center; color: white;">
           <div style="width: 40px; height: 40px; background-size: 40px 40px; background-image: url('https://i.imgur.com/hop81pW.png');"></div>
           <span style="font-size: 18px;">Discord</span>
           </div>
           `;
            this.discordButton.onclick = () => {
                location.href = "https://discord.gg/AFYkkKTZq4";
            };
        }
        nextLoadingStage() {
            this.loadingText.innerHTML = "Connecting to moomoo servers...";
            this.connectionTimeout = setTimeout(() => {
                location.reload();
            }, 30000);
        }
        showLoadingText(e) {
            mainMenu.style.display = "block";
            gameUI.style.display = "none";
            diedText.style.display = "none";
            pingDisplay.style.display = "none";
            this.gameName.style.top = "0px";
            this.loadingText.style.display = "block";
            this.mainMenuItemHolder.style.display = "none";
            this.loadingText.innerHTML = e;
        }
        drawServerBrowser() {
            let e = location.href.split(".")[2].split("/?server=")[1].split(":");
            let t = "";
            for (let i in vultrClient.servers) {
                let s = new Map();
                let n = vultrClient.servers[i].sort((e, t) => t.playerCount - e.playerCount);
                for (let a of n) {
                    let l = `${a.region}:${a.name}`;
                    if (!s.has(l)) {
                        s.set(l, a);
                    }
                }
                for (let [o, r] of s) {
                    t += `<option value="${r.region}:${r.name}" ${r.region == e[0] && r.name == e[1] ? "selected" : ""}>${r.region}:${r.name} [${r.playerCount}/${r.playerCapacity}]</option>`;
                }
                if (i != "sydney") {
                    t += "<option disabled></option>";
                }
            }
            this.serverBrowser.innerHTML = t;
        }
        updateSkinPicker() {
            this.playerSkinHolder.innerHTML = "";
            for (let e = 0; e < config.skinColors.length; e++) {
                let t = document.createElement("div");
                t.classList.add("skinColorItem");
                t.style.backgroundColor = config.skinColors[e];
                if (e == this.skinColor || (e == 10 && this.skinColor == "constructor")) {
                    t.classList.add("activeSkin");
                }
                t.onclick = () => {
                    if (e == 10) {
                        this.skinColor = "constructor";
                    } else {
                        this.skinColor = e;
                    }
                    this.updateSkinPicker();
                };
                this.playerSkinHolder.appendChild(t);
            }
        }
        finishLoading() {
            this.loadingText.style.display = "none";
            this.gameName.style.top = "70px";
            this.loadingText.innerHTML = "i spent too much time working on this when i could've spent it on updating the actual combat and improving the script";
            this.mainMenuItemHolder.innerHTML = `
           <div style="margin-bottom: -12.5px; display: flex; align-items: center; justify-content: center; width: 100%; height: 60px;">
               <div>
                   <div style="color: white;">Game Mode</div>
                   <select id="gameModeSelector" style="cursor: pointer; color: black; font-size: 16px; width: 136px; height: 37px; border: none; border-radius: 2.5px;">
                       <option value="normal" ${isSandbox ? "" : "selected"}>Normal</option>
                       <option value="sandbox" ${isSandbox ? "selected" : ""}>Experimental</option>
                   </select>
               </div>
               <div style="margin-left: 10px;">
                   <div style="color: white;">Region</div>
                   <select id="serverBrowser" style="cursor: pointer; color: black; font-size: 16px; width: 136px; height: 37px; border: none; border-radius: 2.5px;">
                       <option disabled>No servers</option>
                   </select>
               </div>
           </div>
           <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 60px;">
               <input type="text" maxlength="15" id="playerNameInput" placeholder="Enter username" style="font-size: 18px; width: 200px; height: 25px; border: none; padding: 6px; border-radius: 2.5px;">
               <button id="enterGame" style="color: white; margin-left: 10px; background-color: #7ee559; padding: 7.25px; padding-left: 10px; padding-right: 10px; font-size: 18px; text-align: center; border: none; cursor: pointer; border-radius: 2.5px;">
                   Play!
               </button>
           </div>
           <div id="playerSkinHolder" style="margin-top: -20px; display: flex; align-items: center; justify-content: center; width: 100%; height: 60px;">
           </div>
           `;
            this.nameInput = document.getElementById("playerNameInput");
            this.gameModeSelector = document.getElementById("gameModeSelector");
            this.serverBrowser = document.getElementById("serverBrowser");
            this.playerSkinHolder = document.getElementById("playerSkinHolder");
            this.enterButton = document.getElementById("enterGame");
            this.enterButton.onmouseover = () => {
                this.enterButton.style.backgroundColor = "#39d402";
            };
            this.enterButton.onmouseout = () => {
                this.enterButton.style.backgroundColor = "#7ee559";
            };
            this.gameModeSelector.onchange = (e) => {
                if (e.target.value == "normal") {
                    if (isSandbox && confirm("Confirm changing game mode to: Normal?")) {
                        location.href = "https://moomoo.io";
                    }
                } else if (!isSandbox && confirm("Confirm changing game mode to: Sandbox?")) {
                    location.href = "https://sandbox.moomoo.io";
                }
            };
            this.serverBrowser.onchange = (e) => {
                let t = e.target.value.split(":");
                if (confirm(`Confirm server switch to server: ${t[0]}:${t[1]}?`)) {
                    window.onbeforeunload = null;
                    vultrClient.switchServer(t[0], t[1]);
                }
            };
            this.firstJoin = false;
            this.enterButton.onclick = () => {
                if (!this.firstJoin) {
                    gameObjects = [];
                    objectManager.grids = [];
                }
                this.firstJoin = true;
                enterGame();
            };
            this.drawServerBrowser();
            this.updateSkinPicker();
            this.nameInput.value = getSavedVal("moo_name") || "";
        }
    })();
    var effectsManager = new (class {
        constructor() {
            this.effects = [];
            this.elements = [];
            this.holderElement = document.createElement("div");
            this.holderElement.style = "position: absolute; left: 20px; bottom: 215px;";
            gameUI.appendChild(this.holderElement);
        }
        addEffect(e, t, i) {
            this.effects.push({
                name: e,
                icon: i,
                duration: t,
                maxDuration: t,
            });
        }
        getElement(e, t) {
            let i = document.getElementById(`war_robots_effect:${e.name}`);
            if (!i) {
                (i = document.createElement("div")).id = `war_robots_effect:${e.name}`;
                i.style = `position: absolute; left: -250px; bottom: ${t * 50}px; transition: bottom 0.7s ease, left 0.7s ease; width: 125px; height: 40px; border-radius: 4px; overflow: hidden; background-color: rgb(0, 0, 0, .3);`;
                this.elements.push(i);
                this.holderElement.appendChild(i);
                setTimeout(() => {
                    i.style.left = "0px";
                }, 10);
            }
            return i;
        }
        animate(e) {
            for (let t = 0; t < this.effects.length; t++) {
                let i = this.effects[t];
                let s = this.getElement(i, t);
                let n = i.duration <= 0 ? 0 : (i.duration / i.maxDuration) * 100;
                let a = Math.round(i.duration / 100) / 10;
                let l = 1;
                let o = 16;
                if (i.duration <= 3000) {
                    let r = UTILS.removeWholeNumber(i.duration / 1000);
                    l = r;
                    o += (1 - r) * 16;
                }
                s.innerHTML = `
               <div style="position: absolute; top: 0px; left: 0px; width: 100%; height: calc(100% - 3.75px);">
                   <img src="${i.icon}" style="width: 36.25px; height: 36.25px;">
                   <div style="position: absolute; color: white; top: 0px; right: 5px; display: flex; height: 100%; text-align: right; align-items: center;">
                       <div style="font-size: ${o}px; opacity: ${l};">${i.duration <= 0 ? "" : a.toString().includes(".") ? a : a + ".0"}</div>
                   </div>
               </div>

               <div style="position: absolute; bottom: 0px; left: 0px; height: 3.75px; width: 100%; background-color: rgb(0, 0, 0, .25);">
                   <div style="width: ${n}%; height: 100%; background-color: #f00;"></div>
</div>
`;
                i.duration -= e;
                if (i.duration <= 0 && i.isKilling == undefined) {
                    i.isKilling = 350;
                } else if (i.isKilling > 0) {
                    i.isKilling -= e;
                    s.style.left = "-250px";
                    for (let c = 0; c < this.effects.length; c++) {
                        let d = this.effects[c];
                        let p = this.getElement(d, c);
                        if (p.id != s.id) {
                            p.style.bottom = `${(c - 1) * 50}px`;
                        }
                    }
                } else if (i.isKilling <= 0) {
                    let h = this.elements.find((e) => e.id == s.id);
                    let g = this.elements.findIndex((e) => e.id == s.id);
                    this.effects.splice(t, 1);
                    this.elements.splice(g, 1);
                    h.remove();
                }
            }
        }
    })();
    var lastPingSocket = 0;
    var jumpscareManager = new (class {
        constructor() {
            this.images = ["https://i.imgur.com/3Tw8LyC.png", "https://i.imgur.com/7HWT2oq.png", "https://i.imgur.com/ORsS7zY.png", "https://i.imgur.com/pfK8o0g.png"];
            this.imgElements = [];
            this.images.forEach((e) => {
                let t = document.createElement("img");
                t.src = e;
                t.style.position = "fixed";
                t.style.top = "50%";
                t.style.left = "50%";
                t.style.transform = "translate(-50%, -50%)";
                t.style.display = "none";
                t.height = "400px";
                t.width = "400px";
                document.body.appendChild(t);
                this.imgElements.push(t);
            });
        }
        doit() {
            this.imgElements.forEach((e) => {
                e.style.display = "none";
            });
            let e = this.imgElements[Math.floor(Math.random() * this.imgElements.length)];
            e.style.display = "block";
            setTimeout(() => {
                e.style.display = "none";
            }, 500);
        }
    })();
    var altKeyManager = new (class {
        constructor() {
            this.blobFunction = "";
        }
        init() {
            this.blob = new Blob([`(${this.blobFunction})()`]);
        }
        async getToken() {
            let e = await new Promise((e) => {
                e(window.superman);
                return;
                let t = new Worker(URL.createObjectURL(this.blob));
                t.onmessage = (i) => {
                    if (i.data == "sigma") {
                        console.log("mini's token thingy is worky!");
                        return;
                    }
                    e(`alt:${i.data.token}`);
                    t.terminate();
                };
                t.postMessage("generate");
            });
            return e;
        }
    })();
    var socketConnector = new (class {
        constructor() {
            this.wsAddress = "";
            this.connectionInterval = null;
            this.selfFunc = self.URL || self.webkitURL;
            this.workerBlob = this.baseEncoded = "IWZ1bmN0aW9uKCl7InVzZSBzdHJpY3QiO2xldCBlPW5ldyBUZXh0RW5jb2Rlcjthc3luYyBmdW5jdGlvbiB0KHQsbixyKXt2YXIgbDtyZXR1cm4gbD1hd2FpdCBjcnlwdG8uc3VidGxlLmRpZ2VzdChyLnRvVXBwZXJDYXNlKCksZS5lbmNvZGUodCtuKSksWy4uLm5ldyBVaW50OEFycmF5KGwpXS5tYXAoZT0+ZS50b1N0cmluZygxNikucGFkU3RhcnQoMiwiMCIpKS5qb2luKCIiKX1mdW5jdGlvbiBuKGUsdD0xMil7bGV0IG49bmV3IFVpbnQ4QXJyYXkodCk7Zm9yKGxldCByPTA7cjx0O3IrKyluW3JdPWUlMjU2LGU9TWF0aC5mbG9vcihlLzI1Nik7cmV0dXJuIG59YXN5bmMgZnVuY3Rpb24gcih0LHI9IiIsbD0xZTYsbz0wKXtsZXQgYT0iQUVTLUdDTSIsYz1uZXcgQWJvcnRDb250cm9sbGVyLGk9RGF0ZS5ub3coKSx1PShhc3luYygpPT57Zm9yKGxldCBlPW87ZTw9bCYmIWMuc2lnbmFsLmFib3J0ZWQmJnMmJnc7ZSsrKXRyeXtsZXQgdD1hd2FpdCBjcnlwdG8uc3VidGxlLmRlY3J5cHQoe25hbWU6YSxpdjpuKGUpfSxzLHcpO2lmKHQpcmV0dXJue2NsZWFyVGV4dDpuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUodCksdG9vazpEYXRlLm5vdygpLWl9fWNhdGNoe31yZXR1cm4gbnVsbH0pKCkscz1udWxsLHc9bnVsbDt0cnl7dz1mdW5jdGlvbiBlKHQpe2xldCBuPWF0b2IodCkscj1uZXcgVWludDhBcnJheShuLmxlbmd0aCk7Zm9yKGxldCBsPTA7bDxuLmxlbmd0aDtsKyspcltsXT1uLmNoYXJDb2RlQXQobCk7cmV0dXJuIHJ9KHQpO2xldCBmPWF3YWl0IGNyeXB0by5zdWJ0bGUuZGlnZXN0KCJTSEEtMjU2IixlLmVuY29kZShyKSk7cz1hd2FpdCBjcnlwdG8uc3VidGxlLmltcG9ydEtleSgicmF3IixmLGEsITEsWyJkZWNyeXB0Il0pfWNhdGNoe3JldHVybntwcm9taXNlOlByb21pc2UucmVqZWN0KCksY29udHJvbGxlcjpjfX1yZXR1cm57cHJvbWlzZTp1LGNvbnRyb2xsZXI6Y319bGV0IGw7b25tZXNzYWdlPWFzeW5jIGU9PntsZXR7dHlwZTpuLHBheWxvYWQ6byxzdGFydDphLG1heDpjfT1lLmRhdGEsaT1udWxsO2lmKCJhYm9ydCI9PT1uKWwmJmwuYWJvcnQoKSxsPXZvaWQgMDtlbHNlIGlmKCJ3b3JrIj09PW4pe2lmKCJvYmZ1c2NhdGVkImluIG8pe2xldHtrZXk6dSxvYmZ1c2NhdGVkOnN9PW98fHt9O2k9YXdhaXQgcihzLHUsYyxhKX1lbHNle2xldHthbGdvcml0aG06dyxjaGFsbGVuZ2U6ZixzYWx0OmR9PW98fHt9O2k9ZnVuY3Rpb24gZShuLHIsbD0iU0hBLTI1NiIsbz0xZTYsYT0wKXtsZXQgYz1uZXcgQWJvcnRDb250cm9sbGVyLGk9RGF0ZS5ub3coKSx1PShhc3luYygpPT57Zm9yKGxldCBlPWE7ZTw9byYmIWMuc2lnbmFsLmFib3J0ZWQ7ZSsrKXtsZXQgdT1hd2FpdCB0KHIsZSxsKTtpZih1PT09bilyZXR1cm57bnVtYmVyOmUsdG9vazpEYXRlLm5vdygpLWl9fXJldHVybiBudWxsfSkoKTtyZXR1cm57cHJvbWlzZTp1LGNvbnRyb2xsZXI6Y319KGYsZCx3LGMsYSl9bD1pLmNvbnRyb2xsZXIsaS5wcm9taXNlLnRoZW4oZT0+e3NlbGYucG9zdE1lc3NhZ2UoZSYmey4uLmUsd29ya2VyOiEwfSl9KX19fSgpOw==";
            this.workerBlob = Uint8Array.from(atob(this.workerBlob), (e) => e.charCodeAt(0));
            this.workJSBlob = new Blob([this.workerBlob], {
                type: "text/javascript;charset=utf-8",
            });
        }
        socketReady() {
            return io.connected;
        }
        async processServers() {
            let e = `${isSandbox ? "https://api-sandbox.moomoo.io" : "https://api.moomoo.io"}/servers?v=1.27`;
            try {
                let t = await fetch(e);
                let i = await t.json();
                return await vultrClient.processServers(i);
            } catch (s) {
                errorEventManager.error("Failed to load moomoo.io server data");
            }
        }
        createWorker(e) {
            let t = this.workJSBlob && this.selfFunc.createObjectURL(this.workJSBlob);
            let i = new Worker(t, {
                name: e?.name,
            });
            i.addEventListener("error", () => {
                this.selfFunc.revokeObjectURL(t);
            });
            return i;
        }
        async getChallenge() {
            let e = await fetch("https://api.moomoo.io/verify", {
                headers: {},
            });
            let t = await e.json();
            return t;
        }
        async getWorkerSolution(e, t, i = 8) {
            let s = [];
            for (let n = 0; n < i; n++) {
                s.push(this.createWorker(undefined));
            }
            let a = Math.ceil(t / i);
            let l = await Promise.all(
                s.map((t, i) => {
                    let n = i * a;
                    return new Promise((i) => {
                        t.addEventListener("message", (e) => {
                            if (e.data) {
                                for (let n of s) {
                                    if (n !== t) {
                                        n.postMessage({
                                            type: "abort",
                                        });
                                    }
                                }
                            }
                            i(e.data);
                        });
                        t.postMessage({
                            payload: e,
                            max: n + a,
                            start: n,
                            type: "work",
                        });
                    });
                }),
            );
            for (let o of s) {
                o.terminate();
            }
            return l.find((e) => !!e) || null;
        }
        async validateChallenge(e) {
            let t = await this.getWorkerSolution(e, e.maxnumber);
            if (t?.number !== undefined || "obfuscated" in e) {
                return {
                    challengeData: e,
                    solution: t,
                };
            }
        }
        createPayload(e, t) {
            return btoa(
                JSON.stringify({
                    algorithm: e.algorithm,
                    challenge: e.challenge,
                    number: t.number,
                    salt: e.salt,
                    signature: e.signature,
                    test: !!e || undefined,
                    took: t.took,
                }),
            );
        }
        async executeRecaptcha() {
            clearTimeout(mainMenuManager.connectionTimeout);
            mainMenuManager.loadingText.innerHTML = "Verify to play";
            let token = await CHKP.requestToken();
            if (!token) {
                errorEventManager.error("Turnstile token unavailable -- is the captcha blocked?");
                return undefined;
            }
            mainMenuManager.loadingText.innerHTML = "Connecting to moomoo servers...";
            mainMenuManager.connectionTimeout = setTimeout(() => {
                location.reload();
            }, 30000);
            window.superman = token;
            return token;
        }
        connect(e) {
            io.connect(
                e,
                function (e) {
                    if (e) {
                        disconnect(e);
                    } else {
                        window.onbeforeunload = () => "Are you sure?";
                        clearTimeout(mainMenuManager.connectionTimeout);
                        pingSocket();
                        setInterval(() => {
                            pingSocket();
                        }, 1000);
                        prepareUI();
                        bindEvents();
                        loadIcons();
                        mainMenuManager.finishLoading();
                        for (let t = 19; t <= 38; t++) {
                            let i = document.createElement("div");
                            i.id = "itemCounts" + t;
                            i.style = `
                       position: absolute;
                       top: 0;
                       padding-left: 5px;
                       font-size: 2em;
                       color: #fff;
                       `;
                            i.innerHTML = "0";
                            document.getElementById("actionBarItem" + t).style.position = "relative";
                            document.getElementById("actionBarItem" + t).appendChild(i);
                        }
                        for (let s = 0; s <= 16; s++) {
                            let n = document.createElement("div");
                            n.id = `weaponXPActionBar:${s}`;
                            n.style = "position: absolute; bottom: 0px; left: 0px; height: 3px;";
                            document.getElementById("actionBarItem" + s).style.position = "relative";
                            document.getElementById("actionBarItem" + s).appendChild(n);
                        }
                    }
                },
                !location.href.includes("mohmoh")
                ? {
                    A: setInitData,
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
                }
                : {
                    id: setInitData,
                    1: setupGame,
                    2: addPlayer,
                    4: removePlayer,
                    33: updatePlayers,
                    6: loadGameObject,
                    7: gatherAnimation,
                    8: wiggleGameObject,
                    9: updatePlayerValue,
                    h: updateHealth,
                    11: killPlayer,
                    12: killObject,
                    13: killObjects,
                    14: updateItemCounts,
                    15: updateAge,
                    16: updateUpgrades,
                    17: updateItems,
                    18: addProjectile,
                    19: remProjectile,
                    st: setPlayerTeam,
                    sa: setAlliancePlayers,
                    us: updateStoreItems,
                    ch: receiveChat,
                    sp: shootTurret,
                    mm: updateMinimap,
                },
            );
        }
        async connectSocket() {
            let e = await this.executeRecaptcha();
            vultrClient.start(
                (t) => {
                    let i = `wss://${t}`;
                    this.wsAddress = window.wsAddress = i;
                    if (e) {
                        i += "/?token=" + encodeURIComponent(e);
                    }
                    this.connect(i);
                },
                (e) => {
                    errorEventManager.error(e);
                },
            );
        }
        tryConnect() {
            socketConnector.connectSocket();
        }
        connectServerIfReady() {
            mainMenuManager.nextLoadingStage();
            if (document.getElementById("touch-controls-right")) {
                document.getElementById("touch-controls-right").remove();
            }
            if (document.getElementById("touch-controls-left")) {
                document.getElementById("touch-controls-left").remove();
            }
            if (document.getElementById("touch-controls-fullscreen")) {
                document.getElementById("touch-controls-fullscreen").remove();
            }
            if (window.frvrSdkInitPromise) {
                window.frvrSdkInitPromise
                    .then(() => {
                    try {
                        window.FRVR?.bootstrapper?.complete();
                    } catch (e) {
                        errorEventManager.error("Bootstrapper error: " + e);
                    }
                })
                    .then(() => {
                    this.processServers()
                        .then(this.tryConnect)
                        .catch((e) => {
                        errorEventManager.error("Loading error: " + e);
                    });
                });
            } else {
                this.processServers()
                    .then(this.tryConnect)
                    .catch((e) => {
                    errorEventManager.error("Loading error: " + e);
                });
            }
        }
    })();
    var errorEventManager = new (class {
        error(e) {
            let t = document.createElement("div");
            t.style = `
           z-index: 1001;
           position: absolute;
           left: 50%;
           top: 50%;
           transform: translate(-50%, -50%);
           width: 550px;
           height: 300px;
           background-color: rgb(0, 0, 0, .85);
           border-radius: 6px;
           `;
            t.innerHTML = `
           <div style="display: flex; align-items: center; justify-content: center; position: absolute; color: #fff; text-align: center; font-size: 35px; top: 0px; left: 0px; width: 100%; height: 50px; background: linear-gradient(to right, transparent 0%, transparent 20%, rgb(255, 255, 255, .4) 50%, transparent 80%, transparent 100%);">
           ATTENTION
           </div>
           <div style="color: white; font-size: 16px; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);">
           ${e}
           </div>
           `;
            let i = document.createElement("div");
            i.style = "display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; border-radius: 4px; width: 200px; height: 50px; background-color: rgb(255, 255, 255, .75); cursor: pointer; position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%);";
            i.innerHTML = "OK";
            i.onclick = () => {
                t.remove();
            };
            t.appendChild(i);
            document.body.appendChild(t);
        }
    })();
    var chickenSocketHandler = new (class {
        constructor() {
            this.socket = null;
            this.botPassword = "";
            this.userPositions = [];
            this.connect(false);
            this.lastPingSocket = 0;
        }
        send(e) {}
        fetchKey() {
            fetch(`https://pond-hallowed-blackcurrant.glitch.me/mini-tech?data=${encodeURIComponent(getSavedVal("chV4-pAss_wordOfd_ata"))}`)
                .then((e) => e.text())
                .then((e) => {
                altKeyManager.blobFunction = e;
                altKeyManager.init();
                socketConnector.connectServerIfReady();
            });
        }
        connect(e) {
            this.validated = true;
            socketConnector.connectServerIfReady();
        }
    })();
    var deathAnimationHandler = new (class {
        constructor() {
            this.objects = [];
            this.players = [];
        }
        addObject(e) {
            this.objects.push({
                x: e.x,
                y: e.y,
                dir: e.dir,
                name: e.name,
                owner: {
                    sid: e.owner.sid,
                },
                globalAlpha: e.name == "pit trap" ? 0.6 : 1,
                sid: e.sid,
                scale: e.scale,
                id: e.id,
            });
        }
        addPlayer(e) {
            this.players.push({
                dir: e.sid == player.sid ? Math.atan2(mouseY - screenHeight / 2, mouseX - screenWidth / 2) : e.dir,
                dirPlus: e.dirPlus,
                x: e.x,
                y: e.y,
                skinIndex: e.skinIndex,
                tailIndex: e.tailIndex,
                weaponIndex: e.weaponIndex,
                buildIndex: -1,
                skinColor: e.skinColor,
                globalAlpha: 1,
                scale: 35,
                weaponVariant: e.weaponVariant || 0,
            });
        }
        renderAnimations(e, t, i, s) {
            try {
                for (let n = 0; n < this.players.length; n++) {
                    let a = this.players[n];
                    if (a) {
                        a.globalAlpha -= t * 0.0024;
                        e.save();
                        e.globalAlpha = Math.max(a.globalAlpha, 0);
                        e.translate(a.x - i, a.y - s);
                        e.rotate(a.dir + a.dirPlus);
                        renderPlayer(a, e);
                        e.restore();
                        if (a.globalAlpha <= 0) {
                            this.players.splice(n, 1);
                        }
                    }
                }
                for (let l = 0; l < this.objects.length; l++) {
                    let o = this.objects[l];
                    if (o) {
                        let r = getItemSprite(o);
                        o.globalAlpha -= t * 0.0024;
                        o.scale += (o.name == "pit trap" ? 0.024 : 0.02) * t;
                        e.save();
                        e.globalAlpha = Math.max(o.globalAlpha, 0);
                        e.translate(o.x - i, o.y - s);
                        e.rotate(o.dir);
                        e.drawImage(r, -(r.width / 2), -(r.height / 2));
                        e.restore();
                        if (o.globalAlpha <= 0) {
                            this.objects.splice(l, 1);
                        }
                    }
                }
            } catch (c) {}
        }
    })();
    function pingSocket() {
        lastPingSocket = Date.now();
        io.send("0");
    }
    function disconnect(e) {
        io.close();
        mainMenuManager.showLoadingText(e || "disconnected (no reason given)");
    }
    function enterGame() {
        if (document.getElementById("ot-sdk-btn-floating")) {
            document.getElementById("ot-sdk-btn-floating").style.display = "none";
        }
        saveVal("moo_name", mainMenuManager.nameInput.value);
        if (!inGame && socketConnector.socketReady()) {
            inGame = true;
            io.send("M", {
                name: mainMenuManager.nameInput.value,
                moofoll: moofoll,
                skin: mainMenuManager.skinColor,
            });
        }
    }
    var mapPings = [];
    function sendMapPing() {
        chicken.autoTriggerOneShot = !chicken.autoTriggerOneShot;
    }
    var chatBox = document.getElementById("chatBox");
    var chatHolder = document.getElementById("chatHolder");
    function sendChat(e) {
        if (e.includes("!cbot ")) {
            e = e.split(" ").slice(1).join(" ");
            for (let t = 0; t < botManager.bots.length; t++) {
                let i = botManager.bots[t];
                if (!i.disconnected) {
                    botManager.sendToServer(i.socket, {
                        type: "chat",
                        message: e,
                    });
                }
            }
        } else if (e.toLowerCase() == "!c!dc bots") {
            botManager.removeBots(botManager.bots.reduce((n, b) => n + b.amount, 0));
            io.send("6", e.slice(0, 30));
        } else if (e != "!clan" || player.team) {
            if (e.startsWith(".bots ")) {
                let a = e.slice(6, e.length).split(" ");
                if (a.length == 2) {
                    let l = Math.min(38, Math.max(parseInt(a[1]), 0));
                    if (a[0] == "add") {
                        botManager.addBots(l);
                    } else if (a[0] == "dc") {
                        botManager.removeBots(l);
                    }
                }
                io.send("6", e);
            } else if (e.includes(".target ")) {
                let o = e.split(".target ")[1];
                let r = document.getElementById("input:id:botTargetSids");
                if (r.value == "") {
                    r.value = o;
                } else if (!r.value.includes(o)) {
                    r.value += `,${o}`;
                }
                let c = new Event("change", {
                    bubbles: true,
                });
                r.dispatchEvent(c);
                io.send("6", e.slice(0, 30));
            } else if (e.includes(".untarget ")) {
                let d = e.split(".untarget ")[1];
                let p = document.getElementById("input:id:botTargetSids");
                p.value = p.value
                    .split(",")
                    .filter((e) => e != d)
                    .join(",");
                let h = new Event("change", {
                    bubbles: true,
                });
                p.dispatchEvent(h);
                io.send("6", e.slice(0, 30));
            } else if (e.includes("!ckick ")) {
                let g = e.split(" ")[1];
                chickenSocketHandler.send("kick", g);
                io.send("6", e.slice(0, 30));
            } else if (e.includes("!cfreeze ")) {
                let $ = e.split(" ")[1];
                let m = e.split(" ")[2];
                chickenSocketHandler.send("freeze", $, m || 10);
                io.send("6", e.slice(0, 30));
            } else if (botManager.playingAsData && botManager.playingAsData.socket.readyState == 1) {
                let u = botManager.playingAsData;
                botManager.sendToServer(u.socket, {
                    type: "packet",
                    sid: u.sid,
                    packetData: {
                        type: "6",
                        data: [e.slice(0, 30)],
                    },
                });
            } else {
                io.send("6", e.slice(0, 30));
            }
        } else {
            let f = "";
            let y = 0;
            for (let x = 0; x < UTILS.randInt(2, 7); x++) {
                f += "\0";
            }
            while (alliances.find((e) => e.sid == f)) {
                f = "";
                for (let b = 0; b < UTILS.randInt(2, 7); b++) {
                    f += "\0";
                }
                if (++y > 10) {
                    f = UTILS.randomString(Math.random(2, 7));
                    break;
                }
            }
            io.send("L", f);
        }
    }
    function closeChat() {
        chatBox.value = "";
        chatHolder.style.display = "none";
    }
    function resetMoveDir() {
        keys = {};
        io.send("e");
    }
    function updateCursorLocation() {
        let e = players.find((e) => e.sid == botManager.playingAsData?.sid) || player;
        let t = mouseX / window.innerWidth;
        let i = mouseY / window.innerHeight;
        let s = t * maxScreenWidth;
        let n = i * maxScreenHeight;
        let a = maxScreenWidth / 2;
        let l = maxScreenHeight / 2;
        let o = Math.atan2(n - l, s - a);
        let r = Math.hypot(n - l, s - a);
        chicken.cursorLocation = {
            x: (e ? e.x2 : 0) + Math.cos(o) * r,
            y: (e ? e.y2 : 0) + Math.sin(o) * r,
        };
    }
    function gameInput(e) {
        e.preventDefault();
        e.stopPropagation();
        mouseX = e.clientX;
        mouseY = e.clientY;
        updateCursorLocation();
    }
    function toggleChat() {
        if (document.activeElement == scriptMenu.chickenChatBox || (scriptMenu.menu.style.opacity == 1 && scriptMenu.items[5].style.top == "0px")) {
            closeChat();
            let e = document.activeElement.id == "privChatBox" ? scriptMenu.privChatBox : scriptMenu.chickenChatBox;
            if (document.activeElement.id == "privChatBox" || document.activeElement == scriptMenu.chickenChatBox) {
                if (e.value) {
                    let t = e.value;
                    if (t.includes("!cinvis")) {
                        let i = t.split("!cinvis ")[1];
                        chickenSocketHandler.send("invis", i);
                    } else if (t.includes("!play ")) {
                        let s = t.split("!play ")[1];
                        if (s != "end" && typeof +s == "number") {
                            for (let n = 0; n < botManager.bots.length; n++) {
                                let a = botManager.bots[n];
                                if (a && a.socket.readyState == 1) {
                                    botManager.sendToServer(a.socket, {
                                        type: "play",
                                        sid: +s,
                                    });
                                }
                            }
                        } else {
                            botManager.playingAsData = undefined;
                            for (let l = 0; l < botManager.bots.length; l++) {
                                let o = botManager.bots[l];
                                if (o && o.socket.readyState == 1) {
                                    botManager.sendToServer(o.socket, {
                                        type: "play",
                                        sid: undefined,
                                    });
                                }
                            }
                        }
                    } else if (t.includes("!clear")) {
                        scriptMenu.loggerFunction("clear");
                    } else if (t.startsWith("!") && t != "!cjumpscare") {
                        if (t.includes("!ignore")) {
                            let r = t.split(" ")[1];
                            if (r) {
                                let c = parseInt(r);
                                if (isNaN(c)) {
                                    if (typeof r == "string" && /[a-zA-Z]/.test(r)) {
                                        scriptMenu.ignored.push(r);
                                        scriptMenu.loggerFunction(`<span style="color: #0f0">Command Success:</span> Ignoring players with '${r}' in name`);
                                    } else {
                                        scriptMenu.loggerFunction("<span style=\"color: #f00\">Error with '!ignore' command:</span> Undefined Sid Value");
                                    }
                                } else {
                                    let d = findPlayerBySID(c);
                                    if (d) {
                                        scriptMenu.loggerFunction(`<span style="color: #0f0">Command Success:</span> Ignoring ${d.name} {${c}}`);
                                        scriptMenu.ignored.push(c);
                                    } else {
                                        scriptMenu.loggerFunction(`<span style="color: #f00">Error with '!ignore' command:</span> No player found with sid: ${c}`);
                                    }
                                }
                            } else {
                                scriptMenu.loggerFunction("<span style=\"color: #f00\">Error with '!ignore' command:</span> Undefined Sid Value");
                            }
                        } else if (t.includes("!stop")) {
                            let p = t.split(" ")[1];
                            if (p) {
                                let h = parseInt(p);
                                if (isNaN(h)) {
                                    if (scriptMenu.ignored.includes(p)) {
                                        let g = scriptMenu.ignored.findIndex((e) => e == p);
                                        scriptMenu.ignored.splice(g, 1);
                                        scriptMenu.loggerFunction(`<span style="color: #0f0">Command Success:</span> Stopped ignoring players with '${p}' in name`);
                                    } else {
                                        scriptMenu.loggerFunction("<span style=\"color: #f00\">Error with '!stop' command:</span> Undefined Sid Value");
                                    }
                                } else {
                                    let $ = findPlayerBySID(h);
                                    if ($) {
                                        if (scriptMenu.ignored.includes(h)) {
                                            scriptMenu.loggerFunction(`<span style="color: #0f0">Command Success:</span> Stopped ignoring ${$.name} {${h}}`);
                                            let m = scriptMenu.ignored.findIndex((e) => e == h);
                                            scriptMenu.ignored.splice(m, 1);
                                        } else {
                                            scriptMenu.loggerFunction(`<span style="color: #f00">Error with '!stop' command:</span> Player with sid of {${h}} wasn't ignored`);
                                        }
                                    } else {
                                        scriptMenu.loggerFunction(`<span style="color: #f00">Error with '!stop' command:</span> No player found with sid: ${h}`);
                                    }
                                }
                            } else {
                                scriptMenu.loggerFunction("<span style=\"color: #f00\">Error with '!stop' command:</span> Undefined Sid Value");
                            }
                        } else {
                            scriptMenu.loggerFunction("Not a command");
                        }
                    } else {
                        chickenSocketHandler.send("chat", mainMenuManager.nameInput.value || "unknown", e.value, player.sid);
                        if (document.activeElement == scriptMenu.chickenChatBox) {
                            receiveChat(player.sid, e.value, true);
                        }
                        scriptMenu.addLog("private", e.value, mainMenuManager.nameInput.value || "unknown", player.sid, false);
                    }
                }
                e.value = "";
                e.blur();
            } else {
                e.value = "";
                storeMenu.style.display = "none";
                allianceMenu.style.display = "none";
                if (scriptMenu.menu.style.opacity == 1 && scriptMenu.items[5].style.top == "0px") {
                    scriptMenu.privChatBox.focus();
                } else {
                    e.focus();
                }
                resetMoveDir();
            }
        } else {
            if (chatHolder.style.display == "flex") {
                if (chatBox.value) {
                    sendChat(chatBox.value);
                }
                closeChat();
            } else {
                storeMenu.style.display = "none";
                allianceMenu.style.display = "none";
                chatHolder.style.display = "flex";
                if (keys[18]) {
                    scriptMenu.chickenChatBox.focus();
                } else {
                    chatBox.focus();
                }
                resetMoveDir();
            }
            chatBox.value = "";
        }
    }
    chatHolder.style.alignItems = "center";
    chatHolder.style.justifyContent = "center";
    chatHolder.style.flexDirection = "column";
    gameCanvas.addEventListener("mousemove", gameInput, false);
    var currentStoreIndex = 0;
    function changeStoreIndex(e) {
        if (currentStoreIndex != e) {
            currentStoreIndex = e;
            generateStoreList();
        }
    }
    function generateStoreList() {
        if (player) {
            UTILS.removeAllChildren(storeHolder);
            var e = currentStoreIndex;
            for (var t = e ? accessories : hats, i = 0; i < t.length; ++i) {
                if (!t[i].dontSell) {
                    (function (i) {
                        var s = UTILS.generateElement({
                            id: "storeDisplay" + i,
                            class: "storeItem",
                            onmouseout: function () {
                                showItemInfo();
                            },
                            onmouseover: function () {
                                showItemInfo(t[i], false, true);
                            },
                            parent: storeHolder,
                        });
                        UTILS.hookTouchEvents(s, true);
                        UTILS.generateElement({
                            tag: "img",
                            class: "hatPreview",
                            src: "../img/" + (e ? "accessories/access_" : "hats/hat_") + t[i].id + (t[i].topSprite ? "_p" : "") + ".png",
                            parent: s,
                        });
                        UTILS.generateElement({
                            tag: "span",
                            text: t[i].name,
                            parent: s,
                        });
                        if (e ? player.tails[t[i].id] : player.skins[t[i].id]) {
                            if ((e ? player.tailIndex : player.skinIndex) == t[i].id) {
                                UTILS.generateElement({
                                    class: "joinAlBtn",
                                    style: "margin-top: 5px",
                                    text: "Unequip",
                                    onclick: function () {
                                        hatSystem.storeEquip(0, e);
                                    },
                                    hookTouch: true,
                                    parent: s,
                                });
                            } else {
                                UTILS.generateElement({
                                    class: "joinAlBtn",
                                    style: "margin-top: 5px",
                                    text: "Equip",
                                    onclick: function () {
                                        hatSystem.storeEquip(t[i].id, e);
                                    },
                                    hookTouch: true,
                                    parent: s,
                                });
                            }
                        } else {
                            UTILS.generateElement({
                                class: "joinAlBtn",
                                style: "margin-top: 5px",
                                text: "Buy",
                                onclick: function () {
                                    hatSystem.storeBuy(t[i].id, e);
                                },
                                hookTouch: true,
                                parent: s,
                            });
                            UTILS.generateElement({
                                tag: "span",
                                class: "itemPrice",
                                text: t[i].price,
                                parent: s,
                            });
                        }
                    })(i);
                }
            }
        }
    }
    function toggleStoreMenu() {
        if (storeMenu.style.display != "block") {
            storeMenu.style.display = "block";
            allianceMenu.style.display = "none";
            generateStoreList();
        } else {
            storeMenu.style.display = "none";
        }
    }
    function sendJoin(e) {
        io.send("b", alliances[e].sid);
    }
    function kickFromClan(e) {
        io.send("Q", e);
    }
    function leaveAlliance() {
        allianceNotifications = [];
        updateNotifications();
        io.send("N");
    }
    function aJoinReq(e) {
        io.send("P", allianceNotifications[0].sid, e);
        if (!e) {
            allianceNotifications.shift();
            game.nextTick(() => {
                updateNotifications();
            });
        }
    }
    function showAllianceMenu() {
        if (player && player.alive) {
            closeChat();
            storeMenu.style.display = "none";
            allianceMenu.style.display = "block";
            UTILS.removeAllChildren(allianceHolder);
            if (player.team) {
                for (var e = 0; e < alliancePlayers.length; e += 2) {
                    (function (e) {
                        var t = UTILS.generateElement({
                            class: "allianceItem",
                            style: "color:" + (alliancePlayers[e] == player.sid ? "#fff" : "rgba(255,255,255,0.6)"),
                            text: alliancePlayers[e + 1],
                            parent: allianceHolder,
                        });
                        if (player.isOwner && alliancePlayers[e] != player.sid) {
                            UTILS.generateElement({
                                class: "joinAlBtn",
                                text: "Kick",
                                onclick: function () {
                                    kickFromClan(alliancePlayers[e]);
                                },
                                hookTouch: true,
                                parent: t,
                            });
                        }
                    })(e);
                }
            } else if (alliances.length) {
                for (var e = 0; e < alliances.length; ++e) {
                    (function (e) {
                        var t = UTILS.generateElement({
                            class: "allianceItem",
                            style: `color: ${alliances[e].sid == player.team ? "#fff" : "rgba(255, 255, 255, 0.6)"}`,
                            text: alliances[e].sid,
                            parent: allianceHolder,
                        });
                        UTILS.generateElement({
                            class: "joinAlBtn",
                            text: "Join",
                            onclick: function () {
                                sendJoin(e);
                            },
                            hookTouch: true,
                            parent: t,
                        });
                    })(e);
                }
            } else {
                UTILS.generateElement({
                    class: "allianceItem",
                    text: "No Tribes Yet",
                    parent: allianceHolder,
                });
            }
            UTILS.removeAllChildren(allianceManager);
            if (player.team) {
                UTILS.generateElement({
                    class: "allianceButtonM",
                    style: "width: 360px",
                    text: player.isOwner ? "Delete Tribe" : "Leave Tribe",
                    onclick: function () {
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
                    ontouchstart: function (e) {
                        e.preventDefault();
                        var t = prompt("unique name", e.currentTarget.value);
                        e.currentTarget.value = t.slice(0, 7);
                    },
                    parent: allianceManager,
                });
                UTILS.generateElement({
                    tag: "div",
                    class: "allianceButtonM",
                    style: "width: 140px;",
                    text: "Create",
                    onclick: function () {
                        createAlliance();
                    },
                    hookTouch: true,
                    parent: allianceManager,
                });
            }
        }
    }
    function toggleAllianceMenu() {
        resetMoveDir();
        if (allianceMenu.style.display != "block") {
            showAllianceMenu();
        } else {
            allianceMenu.style.display = "none";
        }
    }
    function bindEvents() {
        allianceButton.onclick = UTILS.checkTrusted(function () {
            toggleAllianceMenu();
        });
        UTILS.hookTouchEvents(allianceButton);
        storeButton.onclick = UTILS.checkTrusted(function () {
            toggleStoreMenu();
        });
        UTILS.hookTouchEvents(storeButton);
        chatButton.onclick = UTILS.checkTrusted(function () {
            toggleChat();
        });
        UTILS.hookTouchEvents(chatButton);
        mapDisplay.onclick = UTILS.checkTrusted(function () {
            sendMapPing();
        });
        UTILS.hookTouchEvents(mapDisplay);
    }
    window.changeStoreIndex = changeStoreIndex;
    var iconSprites = {};
    var icons = ["crown", "skull", "crosshair"];
    function loadIcons() {
        let e = "../.";
        for (let t = 0; t < icons.length; t++) {
            let i = new Image();
            i.onload = function () {
                this.isLoaded = true;
            };
            i.src = icons[t] == "crosshair" ? "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Crosshairs_Red.svg/1200px-Crosshairs_Red.svg.png" : e + "/img/icons/" + icons[t] + ".png";
            iconSprites[icons[t]] = i;
        }
    }
    function saveVal(e, t) {
        localStorage.setItem(e, t);
    }
    function deleteVal(e) {
        localStorage.removeItem(e);
    }
    function getSavedVal(e) {
        return localStorage.getItem(e);
    }
    var moofoll = getSavedVal("moofoll");
    function follmoo() {
        if (!moofoll) {
            moofoll = true;
            saveVal("moofoll", 1);
        }
    }
    function resize() {
        var e = Math.max((screenWidth = window.innerWidth) / maxScreenWidth, (screenHeight = window.innerHeight) / maxScreenHeight) * pixelDensity;
        gameCanvas.width = screenWidth * pixelDensity;
        gameCanvas.height = screenHeight * pixelDensity;
        gameCanvas.style.width = screenWidth + "px";
        gameCanvas.style.height = screenHeight + "px";
        mainContext.setTransform(e, 0, 0, e, (screenWidth * pixelDensity - maxScreenWidth * e) / 2, (screenHeight * pixelDensity - maxScreenHeight * e) / 2);
    }
    function isAlly(e) {
        return alliancePlayers.includes(e);
    }
    follmoo();
    window.addEventListener("resize", UTILS.checkTrusted(resize));
    resize();
    var toolSprites = {};
    var itemSprites = {};
    var accessSprites = {};
    var accessPointers = {};
    function renderTail(e, t, i) {
        if (!(tmpSkin = accessSprites[e])) {
            var s = new Image();
            s.onload = function () {
                this.isLoaded = true;
                this.onload = null;
            };
            s.src = getTexturePackImg(e, "acc");
            accessSprites[e] = s;
            tmpSkin = s;
        }
        var n = accessPointers[e];
        if (!n) {
            for (var a = 0; a < accessories.length; ++a) {
                if (accessories[a].id == e) {
                    n = accessories[a];
                    break;
                }
            }
            accessPointers[e] = n;
        }
        if (tmpSkin.isLoaded) {
            t.save();
            t.translate(-20 - (n.xOff || 0), 0);
            if (n.spin) {
                t.rotate(i.skinRot);
            }
            t.drawImage(tmpSkin, -(n.scale / 2), -(n.scale / 2), n.scale, n.scale);
            t.restore();
        }
    }
    function renderLeaf(e, t, i, s, n) {
        var a = e + i * Math.cos(s);
        var l = t + i * Math.sin(s);
        var o = i * 0.4;
        n.moveTo(e, t);
        n.beginPath();
        n.quadraticCurveTo((e + a) / 2 + o * Math.cos(s + Math.PI / 2), (t + l) / 2 + o * Math.sin(s + Math.PI / 2), a, l);
        n.quadraticCurveTo((e + a) / 2 - o * Math.cos(s + Math.PI / 2), (t + l) / 2 - o * Math.sin(s + Math.PI / 2), e, t);
        n.closePath();
        n.fill();
        n.stroke();
    }
    function renderCircle(e, t, i, s, n, a) {
        (s = s || mainContext).beginPath();
        s.arc(e, t, i, 0, Math.PI * 2);
        if (!a) {
            s.fill();
        }
        if (!n) {
            s.stroke();
        }
    }
    function renderStar(e, t, i, s, n) {
        var a;
        var l;
        var o = (Math.PI / 2) * 3;
        var r = Math.PI / t;
        if (n) {
            e.rotate(Math.PI / 2);
        }
        e.beginPath();
        if (!navigator.platform.includes("Mac")) {
            e.moveTo(0, -i);
        }
        for (var c = 0; c < t; c++) {
            a = Math.cos(o) * i;
            l = Math.sin(o) * i;
            e.lineTo(a, l);
            o += r;
            a = Math.cos(o) * s;
            l = Math.sin(o) * s;
            e.lineTo(a, l);
            o += r;
        }
        if (!navigator.platform.includes("Mac")) {
            e.lineTo(0, -i);
        }
        e.closePath();
    }
    function renderRect(e, t, i, s, n, a) {
        n.fillRect(e - i / 2, t - s / 2, i, s);
        if (!a) {
            n.strokeRect(e - i / 2, t - s / 2, i, s);
        }
    }
    function renderRectCircle(e, t, i, s, n, a, l) {
        a.save();
        a.translate(e, t);
        n = Math.ceil(n / 2);
        for (var o = 0; o < n; o++) {
            renderRect(0, 0, i * 2, s, a, l);
            a.rotate(Math.PI / n);
        }
        a.restore();
    }
    function renderBlob(e, t, i, s) {
        var n;
        var a = (Math.PI / 2) * 3;
        var l = Math.PI / t;
        e.beginPath();
        e.moveTo(0, -s);
        for (var o = 0; o < t; o++) {
            n = UTILS.randInt(i + 0.9, i * 1.2);
            e.quadraticCurveTo(Math.cos(a + l) * n, Math.sin(a + l) * n, Math.cos(a + l * 2) * s, Math.sin(a + l * 2) * s);
            a += l * 2;
        }
        e.lineTo(0, -s);
        e.closePath();
    }
    function renderTriangle(e, t) {
        var i = e * (Math.sqrt(3) / 2);
        (t = t || mainContext).beginPath();
        t.moveTo(0, -i / 2);
        t.lineTo(-e / 2, i / 2);
        t.lineTo(e / 2, i / 2);
        t.lineTo(0, -i / 2);
        t.fill();
        t.closePath();
    }
    function getItemSprite(e, t) {
        let i = false;
        let s = e.id + (player && e.owner && e.owner.sid == player.sid ? 0 : player && player.team && e.owner && isAlly(e.owner.sid) ? 25 : 50) + e.scale.toString() + (scriptMenu.toggles.renderShadows ? "Shadow" : "") + i;
        var n = itemSprites[s];
        if (!n || t) {
            var a = document.createElement("canvas");
            a.width = a.height = e.scale * 2.6 + outlineWidth + (items.list[e.id].spritePadding || 0);
            var l = a.getContext("2d");
            l.translate(a.width / 2, a.height / 2);
            l.rotate(t ? 0 : Math.PI / 2);
            l.strokeStyle = outlineColor;
            l.lineWidth = outlineWidth * (t ? a.width / 81 : 1);
            if (scriptMenu.toggles.renderShadows) {
                l.shadowBlur = 8;
                l.shadowColor = i ? "rgb(0, 0, 255, .8)" : "rgb(0, 0, 0, .7)";
            }
            if (e.name == "apple") {
                l.fillStyle = i ? "#0000ff" : "#c15555";
                renderCircle(0, 0, e.scale, l);
                l.fillStyle = i ? "#0000ff" : "#89a54c";
                var o = -(Math.PI / 2);
                renderLeaf(e.scale * Math.cos(o), e.scale * Math.sin(o), 25, o + Math.PI / 2, l);
            } else if (e.name == "cookie") {
                l.fillStyle = i ? "#0000ff" : "#cca861";
                renderCircle(0, 0, e.scale, l);
                l.fillStyle = i ? "#0000ff" : "#937c4b";
                var r;
                for (var c = 4, d = mathPI2 / c, p = 0; p < c; ++p) {
                    renderCircle((r = UTILS.randInt(e.scale / 2.5, e.scale / 1.7)) * Math.cos(d * p), r * Math.sin(d * p), UTILS.randInt(4, 5), l, true);
                }
            } else if (e.name == "cheese") {
                l.fillStyle = i ? "#0000ff" : "#f4f3ac";
                renderCircle(0, 0, e.scale, l);
                l.fillStyle = i ? "#0000ff" : "#c3c28b";
                var r;
                for (var c = 4, d = mathPI2 / c, p = 0; p < c; ++p) {
                    renderCircle((r = UTILS.randInt(e.scale / 2.5, e.scale / 1.7)) * Math.cos(d * p), r * Math.sin(d * p), UTILS.randInt(4, 5), l, true);
                }
            } else if (e.name == "wood wall" || e.name == "stone wall" || e.name == "castle wall") {
                l.fillStyle = i ? "#0000ff" : e.name == "castle wall" ? "#83898e" : e.name == "wood wall" ? "#a5974c" : "#939393";
                var h = e.name == "castle wall" ? 4 : 3;
                renderStar(l, h, e.scale * 1.1, e.scale * 1.1);
                l.fill();
                l.stroke();
                l.fillStyle = i ? "#0000ff" : e.name == "castle wall" ? "#9da4aa" : e.name == "wood wall" ? "#c9b758" : "#bcbcbc";
                renderStar(l, h, e.scale * 0.65, e.scale * 0.65);
                l.fill();
            } else if (e.name == "spikes" || e.name == "greater spikes" || e.name == "poison spikes" || e.name == "spinning spikes") {
                l.fillStyle = i ? "#0000ff" : e.name == "poison spikes" ? "#7b935d" : "#939393";
                var g = e.scale * 0.6;
                renderStar(l, e.name == "spikes" ? 5 : 6, e.scale, g);
                l.fill();
                l.stroke();
                l.fillStyle = i ? "#0000ff" : "#a5974c";
                renderCircle(0, 0, g, l);
                l.fillStyle = i ? "#0000ff" : "#c9b758";
                renderCircle(0, 0, g / 2, l, true);
            } else if (e.name == "windmill" || e.name == "faster windmill" || e.name == "power mill") {
                l.fillStyle = i ? "#0000ff" : "#a5974c";
                renderCircle(0, 0, e.scale, l);
                l.fillStyle = i ? "#0000ff" : "#c9b758";
                renderRectCircle(0, 0, e.scale * 1.5, 29, 4, l);
                l.fillStyle = i ? "#0000ff" : "#a5974c";
                renderCircle(0, 0, e.scale * 0.5, l);
            } else if (e.name == "mine") {
                l.fillStyle = i ? "#0000ff" : "#939393";
                renderStar(l, 3, e.scale, e.scale);
                l.fill();
                l.stroke();
                l.fillStyle = i ? "#0000ff" : "#bcbcbc";
                renderStar(l, 3, e.scale * 0.55, e.scale * 0.65);
                l.fill();
            } else if (e.name == "sapling") {
                for (var p = 0; p < 2; ++p) {
                    var g = e.scale * (p ? 0.5 : 1);
                    renderStar(l, 7, g, g * 0.7);
                    l.fillStyle = i ? "#0000ff" : p ? "#b4db62" : "#9ebf57";
                    l.fill();
                    if (!p) {
                        l.stroke();
                    }
                }
            } else if (e.name == "pit trap") {
                l.fillStyle = i ? "#0000ff" : "#a5974c";
                renderStar(l, 3, e.scale * 1.1, e.scale * 1.1);
                l.fill();
                l.stroke();
                l.fillStyle = outlineColor;
                renderStar(l, 3, e.scale * 0.65, e.scale * 0.65);
                l.fill();
            } else if (e.name == "boost pad") {
                l.fillStyle = i ? "#0000ff" : "#7e7f82";
                renderRect(0, 0, e.scale * 2, e.scale * 2, l);
                l.fill();
                l.stroke();
                l.fillStyle = i ? "#0000ff" : "#dbd97d";
                renderTriangle(e.scale * 1, l);
            } else if (e.name == "turret") {
                l.fillStyle = i ? "#0000ff" : "#a5974c";
                renderCircle(0, 0, e.scale, l);
                l.fill();
                l.stroke();
                l.fillStyle = i ? "#0000ff" : "#939393";
                var $ = 50;
                renderRect(0, -$ / 2, e.scale * 0.9, $, l);
                renderCircle(0, 0, e.scale * 0.6, l);
                l.fill();
                l.stroke();
            } else if (e.name == "platform") {
                l.fillStyle = i ? "#0000ff" : "#cebd5f";
                for (var m = 4, u = e.scale * 2, f = u / m, y = -(e.scale / 2), p = 0; p < m; ++p) {
                    renderRect(y - f / 2, 0, f, e.scale * 2, l);
                    l.fill();
                    l.stroke();
                    y += u / m;
                }
            } else if (e.name == "healing pad") {
                l.fillStyle = i ? "#0000ff" : "#7e7f82";
                renderRect(0, 0, e.scale * 2, e.scale * 2, l);
                l.fill();
                l.stroke();
                l.fillStyle = i ? "#0000ff" : "#db6e6e";
                renderRectCircle(0, 0, e.scale * 0.65, 20, 4, l, true);
            } else if (e.name == "spawn pad") {
                l.fillStyle = i ? "#0000ff" : "#7e7f82";
                renderRect(0, 0, e.scale * 2, e.scale * 2, l);
                l.fill();
                l.stroke();
                l.fillStyle = i ? "#0000ff" : "#71aad6";
                renderCircle(0, 0, e.scale * 0.6, l);
            } else if (e.name == "blocker") {
                l.fillStyle = i ? "#0000ff" : "#7e7f82";
                renderCircle(0, 0, e.scale, l);
                l.fill();
                l.stroke();
                l.rotate(Math.PI / 4);
                l.fillStyle = i ? "#0000ff" : "#db6e6e";
                renderRectCircle(0, 0, e.scale * 0.65, 20, 4, l, true);
            } else if (e.name == "teleporter") {
                l.fillStyle = i ? "#0000ff" : "#7e7f82";
                renderCircle(0, 0, e.scale, l);
                l.fill();
                l.stroke();
                l.rotate(Math.PI / 4);
                l.fillStyle = i ? "#0000ff" : "#d76edb";
                renderCircle(0, 0, e.scale * 0.5, l, true);
            }
            n = a;
            if (!t) {
                l.globalAlpha = 0.6;
                l.fillStyle = player && e.owner && e.owner.sid == player.sid ? "" : e.owner && player && player.team && isAlly(e.owner.sid) ? "" : "#780c0c";
                if ((!player || !e.owner || e.owner.sid != player.sid) && (!e.owner || !player || !player.team || !isAlly(e.owner.sid))) {
                    if (e.name.includes("spike") || e.name.includes("pit trap")) {
                        if (e.name.includes("spike")) {
                            l.globalAlpha = 0.6;
                        } else {
                            l.globalAlpha = 1;
                        }
                        l.fill();
                    }
                }
            }
            if (!t) {
                itemSprites[s] = n;
            }
        }
        return n;
    }
    function updateActionBarUI() {
        for (var e = 0; e < items.list.length + items.weapons.length; ++e) {
            (function (e) {
                var t = document.createElement("canvas");
                t.width = t.height = 66;
                var i = t.getContext("2d");
                i.translate(t.width / 2, t.height / 2);
                i.imageSmoothingEnabled = false;
                i.webkitImageSmoothingEnabled = false;
                i.mozImageSmoothingEnabled = false;
                if (items.weapons[e]) {
                    i.rotate(Math.PI / 4 + Math.PI);
                    var s = new Image();
                    toolSprites[items.weapons[e].src] = s;
                    s.onload = function () {
                        this.isLoaded = true;
                        var s = 1 / (this.height / this.width);
                        var n = items.weapons[e].iPad || 1;
                        i.drawImage(this, -(t.width * n * config.iconPad * s) / 2, -(t.height * n * config.iconPad) / 2, t.width * n * s * config.iconPad, t.height * n * config.iconPad);
                        i.fillStyle = "rgba(0, 0, 70, 0.1)";
                        i.globalCompositeOperation = "source-atop";
                        i.fillRect(-t.width / 2, -t.height / 2, t.width, t.height);
                        document.getElementById("actionBarItem" + e).style.backgroundImage = "url(" + t.toDataURL() + ")";
                    };
                    s.src = ".././img/weapons/" + items.weapons[e].src + ".png";
                    var n = document.getElementById("actionBarItem" + e);
                    n.onmouseover = UTILS.checkTrusted(function () {
                        showItemInfo(items.weapons[e], true);
                    });
                    n.onclick = UTILS.checkTrusted(function () {
                        chicken.selectToBuild(e, true);
                    });
                    UTILS.hookTouchEvents(n);
                } else {
                    var s = getItemSprite(items.list[e - items.weapons.length], true);
                    var a = Math.min(t.width - config.iconPadding, s.width);
                    i.globalAlpha = 1;
                    i.drawImage(s, -a / 2, -a / 2, a, a);
                    i.fillStyle = "rgba(0, 0, 70, 0.1)";
                    i.globalCompositeOperation = "source-atop";
                    i.fillRect(-a / 2, -a / 2, a, a);
                    document.getElementById("actionBarItem" + e).style.backgroundImage = "url(" + t.toDataURL() + ")";
                    var n = document.getElementById("actionBarItem" + e);
                    n.onmouseover = UTILS.checkTrusted(function () {
                        showItemInfo(items.list[e - items.weapons.length]);
                    });
                    n.onclick = UTILS.checkTrusted(function () {
                        chicken.selectToBuild(e - items.weapons.length);
                    });
                    UTILS.hookTouchEvents(n);
                }
            })(e);
        }
    }
    function prepareUI() {
        UTILS.removeAllChildren(actionBar);
        for (let e = 0; e < items.weapons.length + items.list.length; ++e) {
            UTILS.generateElement({
                id: "actionBarItem" + e,
                class: "actionBarItem",
                style: "display:none",
                onmouseout: function () {
                    showItemInfo();
                },
                parent: actionBar,
            });
        }
        updateActionBarUI();
    }
    function setInitData(e) {
        alliances = e.teams;
    }
    gameCanvas.oncontextmenu = function () {
        return false;
    };
    var firstSetup = true;
    function setupGame(e) {
        pingDisplay.style.display = "block";
        mainMenu.style.display = "none";
        keys = {};
        playerSID = e;
        attackState = 0;
        inGame = true;
        if (firstSetup) {
            chickenSocketHandler.send("verify", location.href, playerSID, getSavedVal("chV4-pAss_wordOfd_ata"));
            setInterval(() => {
                chickenSocketHandler.lastPingSocket = Date.now();
                if (chickenSocketHandler.validated) {
                    chickenSocketHandler.send("pingSocket");
                }
            }, 1000);
            setInterval(() => {
                if (player && chickenSocketHandler.validated) {
                    chickenSocketHandler.send("update", player.x, player.y);
                }
            }, 3000);
            firstSetup = false;
            gameObjects.length = 0;
        }
    }
    function showText(e, t, i, s) {
        if (s === -1) {
            textManager.showText(
                {
                    x: e,
                    y: t,
                },
                500,
                50,
                0.18,
                "#ee5551",
                s,
            );
        } else {
            let n = i >= 0 ? "#fff" : "#8ecc51";
            let a = scriptMenu.toggles.stackText
            ? textManager.texts.find(
                (i) =>
                UTILS.getDistance(
                    {
                        x: e,
                        y: t,
                    },
                    i,
                ) <= 50 &&
                i.color == n &&
                !isNaN(parseInt(i.value)),
            )
            : undefined;
            if (a) {
                a.value += Math.abs(i);
            } else {
                textManager.showText(
                    {
                        x: e,
                        y: t,
                    },
                    500,
                    50,
                    0.18,
                    n,
                    Math.abs(i),
                );
            }
        }
    }
    function hideAllWindows() {
        storeMenu.style.display = "none";
        allianceMenu.style.display = "none";
        closeChat();
    }
    function serverShutdownNotice(e) {
        if (e < 0) {
            return;
        }
        let t = Math.floor(e / 60);
        let i = e % 60;
        i = ("0" + i).slice(-2);
        shutdownDisplay.innerText = "Server restarting in " + t + ":" + i;
        shutdownDisplay.hidden = false;
    }
    var deathTextScale = 99999;
    function killPlayer() {
        inGame = false;
        gameUI.style.display = "none";
        hideAllWindows();
        lastDeath = {
            x: player.x,
            y: player.y,
        };
        diedText.style.display = "block";
        diedText.style.fontSize = "0px";
        deathTextScale = 0;
        statsManager.addDeath();
        effectsManager.effects.forEach((e) => {
            e.duration = 0;
        });
        weaponXPManager.clearXPBars();
        chicken.preferedWeaponIndex = 0;
        setTimeout(function () {
            mainMenu.style.display = "block";
            diedText.style.display = "none";
        }, config.deathFadeout);
    }
    function addPlayer(e, t, i) {
        var s = findPlayerByID(e[0]);
        let n = false;
        if (!s) {
            s = new Player(e[0], e[1], config, UTILS, items, hats, accessories);
            players.push(s);
            if (!t) {
                scriptMenu.addLog("encountered", "", e[2], e[1]);
            }
            n = true;
            s.spawn(t ? moofoll : null);
            s.visible = false;
            s.x2 = undefined;
            s.y2 = undefined;
            s.setData(e);
        }
        if (!i && !n) {
            s.spawn(t ? moofoll : null);
            s.visible = false;
            s.x2 = undefined;
            s.y2 = undefined;
            s.setData(e);
        }
        if (t) {
            camX = (player = s).x;
            camY = player.y;
            updateItems();
            updateStatusDisplay();
            updateAge();
            updateUpgrades(0);
            gameUI.style.display = "block";
        }
    }
    function updateItemCounts(e, t) {
        if (player) {
            player.itemCounts[e] = t;
            let i = {
                1: [19, 20, 21],
                2: [22, 23, 24, 25],
                3: [26, 27, 28],
                4: [29],
                5: [31],
                6: [32],
                7: [33],
                8: [34],
                9: [35],
                10: [36],
                11: [30],
                12: [37],
                13: [38],
            }[e];
            if (i) {
                i.forEach((e) => {
                    document.getElementById("itemCounts" + e.toString()).innerHTML = t;
                });
            }
        }
    }
    var statsManager = new (class {
        constructor() {
            this.kills = 0;
            this.time = 0;
            this.deaths = 0;
            setInterval(() => {
                this.time += 3;
                if (chickenSocketHandler.validated && scriptMenu.toggles.collectStats) {
                    chickenSocketHandler.send("addTime", this.time);
                    this.time = 0;
                }
            }, 3000);
        }
        addKills() {
            let e = player.kills - this.kills;
            this.kills = player.kills;
            if (scriptMenu.toggles.collectStats && chickenSocketHandler.validated) {
                chickenSocketHandler.send("addKills", e);
            }
        }
        addDeath() {
            if (scriptMenu.toggles.collectStats && chickenSocketHandler.validated) {
                chickenSocketHandler.send("addDeath");
            }
        }
    })();
    var weaponXPManager = new (class {
        constructor() {
            this.colors = ["#f7cf45", "#86b5ff", "#ff716f", "#b1cc7a"];
        }
        manageWeaponXP(e) {
            player.weaponXP[player.weaponIndex] ||= 0;
            player.weaponXP[player.weaponIndex] += e;
            this.updateActionBar();
        }
        clearXPBars() {
            for (let e = 0; e <= 16; e++) {
                let t = document.getElementById(`weaponXPActionBar:${e}`);
                if (t) {
                    player.weaponXP[e] = 0;
                    t.style.width = "0%";
                }
            }
        }
        updateActionBar() {
            let e = items.weapons[player.weaponIndex];
            let t = player.weaponXP[player.weaponIndex];
            let i = document.getElementById(`weaponXPActionBar:${player.weaponIndex}`);
            if (!i) {
                return;
            }
            let s = 0;
            let n = 0;
            if (emeraldSprites[e.name] && t >= 12000) {
                if (t >= 18000) {
                    s = 0;
                } else {
                    s = ((t - 12000) / 6000) * 100;
                    n = 3;
                }
            } else if (t >= 12000) {
                s = 0;
            } else if (t >= 7000) {
                s = ((t - 7000) / 5000) * 100;
                n = 2;
            } else if (t >= 3000) {
                s = ((t - 3000) / 4000) * 100;
                n = 1;
            } else if (t >= 0) {
                s = (t / 3000) * 100;
            }
            i.style.backgroundColor = this.colors[n];
            i.style.width = `${s}%`;
        }
    })();
    function updateStatusDisplay() {
        let e = 0;
        if (player.food - foodDisplay.innerText > 0) {
            e += player.food - foodDisplay.innerText;
        }
        if (player.stone - stoneDisplay.innerText > 0) {
            e += player.stone - stoneDisplay.innerText;
        }
        if (player.wood - woodDisplay.innerText > 0) {
            e += player.wood - woodDisplay.innerText;
        }
        game.nextTick(() => {
            weaponXPManager.manageWeaponXP(e);
        });
        scoreDisplay.innerText = player.points;
        foodDisplay.innerText = player.food;
        woodDisplay.innerText = player.wood;
        stoneDisplay.innerText = player.stone;
        if (player.kills > killCounter.innerText) {
            statsManager.addKills();
            if (scriptMenu.toggles.killChat) {
                sendKillChat();
            }
        }
        killCounter.innerText = player.kills;
    }
    function updatePlayerValue(e, t, i) {
        if (player) {
            player[e] = t;
            if (game.shopList.length && e == "points") {
                game.autoBuy(t);
            }
            if (i) {
                updateStatusDisplay();
            }
        }
    }
    var packetManager = new (class {
        constructor() {
            this.packets = {
                sec: 0,
            };
            setInterval(() => {
                this.packets.sec = 0;
            }, 1000);
        }
        addPacket(e = 1) {
            this.packets.sec += e;
        }
    })();
    window.packetManager = packetManager;
    var kbSimulator = new (class {
        constructor() {
            this.animations = [];
        }
        addAnimation(e, t) {
            this.animations.push({
                dir: e.dir,
                dirPlus: e.dirPlus,
                skinIndex: e.skinIndex,
                pos: {
                    new: t,
                    old: {
                        x: e.x2,
                        y: e.y2,
                    },
                },
                duration: 250,
                maxDuration: 250,
                tailIndex: e.tailIndex,
                weaponIndex: e.weaponIndex,
                buildIndex: -1,
                skinColor: e.skinColor,
                scale: 35,
                weaponVariant: e.weaponVariant || 0,
            });
        }
        spikeKB(
        e = {
            x: 0,
            y: 0,
            scale: 35,
        },
         t = {
            x: 0,
            y: 0,
            scale: 0,
        },
         i,
        ) {
            e.vel = {
                x: 0,
                y: 0,
            };
            let s = e.vel;
            let n = true;
            let a = game.tickSpeed;
            let l = false;
            let o = [];
            let r = 0;
            while (((s.x != 0 || s.y != 0) && !isNaN(s.x) && !isNaN(s.y)) || !l) {
                let c = Math.min(
                    4,
                    Math.max(
                        1,
                        Math.round(
                            UTILS.getDistance(
                                {
                                    x: 0,
                                    y: 0,
                                },
                                {
                                    x: s.x * a,
                                    y: s.y * a,
                                },
                            ) / 40,
                        ),
                    ),
                );
                let d = 1 / c;
                for (let p = 0; p < c; p++) {
                    if (s.x) {
                        e.x += s.x * a * d;
                    }
                    if (s.y) {
                        e.y += s.y * a * d;
                    }
                    game.closeObjects
                        .filter((t) => t.active && ((t.type == 1 && t.y >= 12000) || t.teleport || t.trap || !t.ignoreCollision) && UTILS.getDistance(e, t) <= 35 + (t.getScale ? t.getScale() : t.scale))
                        .forEach((t) => {
                        let i = (t.getScale ? t.getScale() : t.scale) + 35;
                        let n = UTILS.getDirection(e, t);
                        e.x = t.x + i * Math.cos(n);
                        e.y = t.y + i * Math.sin(n);
                        s.x *= 0.75;
                        s.y *= 0.75;
                        if (t.dmg || t.trap) {
                            let a = players.find((e) => e.sid == t.owner.sid);
                            if (!a || !a.team || a.team != e.tmpObj.team) {
                                if (t.trap) {
                                    s.x = 0;
                                    s.y = 0;
                                    o.push({
                                        id: "trap",
                                        x: t.x,
                                        y: t.y,
                                        owner: t.owner.sid,
                                    });
                                } else {
                                    s.x += Math.cos(n) * 1.5;
                                    s.y += Math.sin(n) * 1.5;
                                    o.push({
                                        id: "spiek",
                                        dmg: t.dmg,
                                    });
                                }
                            }
                        } else if (t.type == 1 && t.y >= 12000) {
                            s.x += Math.cos(n) * 1.5;
                            s.y += Math.sin(n) * 1.5;
                            o.push({
                                id: "spiek",
                                dmg: 35,
                            });
                        } else if (t.teleport) {
                            o.push({
                                id: "tp",
                            });
                            s.x = 0;
                            s.y = 0;
                        }
                    });
                    if (UTILS.getDistance(t, e) <= 35 + t.scale) {
                        let h = t.scale + 35;
                        let g = UTILS.getDirection(e, t);
                        e.x = t.x + h * Math.cos(g);
                        e.y = t.y + h * Math.sin(g);
                        s.x *= 0.75;
                        s.y *= 0.75;
                        s.x += Math.cos(g) * 1.5;
                        s.y += Math.sin(g) * 1.5;
                        if (!n) {
                            o.push({
                                id: "spiek",
                                dmg: t.dmg,
                            });
                        }
                        n = false;
                    }
                    players
                        .filter((t) => t.visible && UTILS.getDistance(t, e) <= 70)
                        .forEach((t) => {
                        let i = UTILS.getDistance(t, e) - 70;
                        let s = UTILS.getDirection(e, t);
                        i = (i * -1) / 2;
                        e.x += i * Math.cos(s);
                        e.y += i * Math.sin(s);
                    });
                }
                if (s.x) {
                    s.x *= Math.pow(config.playerDecel, a);
                    if (s.x <= 0.01 && s.x >= -0.01) {
                        s.x = 0;
                    }
                }
                if (s.y) {
                    s.y *= Math.pow(config.playerDecel, a);
                    if (s.y <= 0.01 && s.y >= -0.01) {
                        s.y = 0;
                    }
                }
                l = true;
                if (++r > 30) {
                    break;
                }
            }
            if (!i) {
                this.addAnimation(e.tmpObj, e);
            }
            return {
                vel: s,
                pos: e,
                data: o,
                callback: () => {
                    this.addAnimation(e.tmpObj, e);
                },
            };
        }
        meleeKB(e, t, w1, w2, s) {
            let kb1 = (items.weapons[w1] || {}).knock || 0;
            let kb2 = (items.weapons[w2] || {}).knock || 0;

            let n = (kb1 + kb2 + 0.3) * game.tickSpeed;
            let ex = e.x2 !== undefined ? e.x2 : e.x;
            let ey = e.y2 !== undefined ? e.y2 : e.y;
            let pos = {
                x: ex,
                y: ey,
            };
            if (s && s.length) {
                for (let l = 0; l < s.length; l++) {
                    let o = s[l] * game.tickSpeed;
                    pos.x += Math.cos(t) * o;
                    pos.y += Math.sin(t) * o;
                }
            }
            pos.x += Math.cos(t) * n;
            pos.y += Math.sin(t) * n;
            return pos;
        }
    })();
    var placer = new (class {
        constructor() {
            this.brokenObj = [];
            this.markers = [];
            this.mill = {
                status: false,
                x: 0,
                y: 0,
            };
            this.preplacements = 0;
        }
        tickBase() {
            this.hotkeys();
            this.autoplace();
            this.preplace();
            setTimeout(() => this.preplace(), 22);
            setTimeout(() => this.preplace(), 55);
            setTimeout(() => this.preplace(), 88);
        }
        hotkeys() {
            if (document.activeElement.id.toLowerCase() == "chatbox") {
                return;
            }
            let e = chicken.getAttackDir(false, true);
            if (keys[70] && player.items[4]) {
                this.regCheckPlace(player.items[4], e);
            }
            if (keys[72] && player.items[5]) {
                this.regCheckPlace(player.items[5], e);
            }
            if (keys[86]) {
                this.regCheckPlace(player.items[2], e);
            }
            if (keys[78]) {
                this.regCheckPlace(player.items[3], e);
            }
        }
        mills() {
            if (UTILS.getDistance(this.mill, player) > 99) {
                if (this.mill.status && typeof lastMoveDir == "number") {
                    if (player.itemCounts[3] < (isSandbox ? 297 : 99) || !player.itemCounts[3]) {
                        placer.regCheckPlace(player.items[3], lastMoveDir + Math.PI);
                        placer.regCheckPlace(player.items[3], lastMoveDir - 4.345869833589793);
                        placer.regCheckPlace(player.items[3], lastMoveDir + 4.345869833589793);
                    } else {
                        this.mill.status = false;
                    }
                }
                this.mill.x = player.x2 || 0;
                this.mill.y = player.y2 || 0;
            }
        }
        addMarker({ x: e, y: t, name: i, id: s, angle: n, scale: a, differentVisual: l }) {
            if (n == undefined || n == null || isNaN(n)) {
                n = 0;
            }
            const id = this.markers.length;
            this.markers.push({
                x: e,
                y: t,
                id: s,
                angle: n || 0,
                name: i,
                differentVisual: l,
                owner: {
                    sid: player.sid,
                },
                scale: a,
                ticks: game.tick,
            });
            game.tickOut(() => {
                this.markers.shift();
            }, 1);
        }
        place(e, t) {
            let i = items.list[e];
            if (i && (player.itemCounts[i.group.id] + 1 < (isMohMoh ? Infinity : isSandbox ? i.group.sandboxLimit + 1 || 100 : i.group.limit) || !player.itemCounts[i.group.id]) && (chicken.selectToBuild(e), chicken.sendHit(1, t), chicken.selectToBuild(chicken.preferedWeaponIndex, true), e > 2)) {
                let s = 35 + i.scale + (i.placeOffset || 0);
                let n = {
                    x: player.x2 + Math.cos(t) * s,
                    y: player.y2 + Math.sin(t) * s,
                };
                this.addMarker({
                    x: n.x,
                    y: n.y,
                    scale: i.scale,
                    name: i.name,
                    angle: t,
                    id: i.id,
                });
            }
        }
        diffPlace(e, t, i) {
            let s = items.list[e];
            let n = s.scale;
            let a = 35 + n + (s.placeOffset || 0);
            let l = player.x2 + Math.cos(t) * a;
            let o = player.y2 + Math.sin(t) * a;
            if (this.checkMarkers(l, o, n, i) && s && (player.itemCounts[s.group.id] + 1 < (isSandbox ? s.group.sandboxLimit + 1 || 100 : s.group.limit) || !player.itemCounts[s.group.id])) {
                chicken.selectToBuild(e);
                chicken.sendHit(1, t);
                chicken.selectToBuild(chicken.preferedWeaponIndex, true);
                let r = chicken.getAttackDir(true);
                if (typeof r == "number" && UTILS.getAngleDist(r, t) >= Math.PI / 8) {
                    chicken.sendAim(r);
                }
                if (e > 2) {
                    this.addMarker({
                        x: l,
                        y: o,
                        scale: n,
                        name: s.name,
                        angle: t,
                        id: e,
                        differentVisual: true,
                    });
                }
            }
        }
        regCheckPlace(e, t) {
            let i = items.list[e];
            if (i) {
                let s = 35 + i.scale + (i.placeOffset || 0);
                let n = player.x2 + Math.cos(t) * s;
                let a = player.y2 + Math.sin(t) * s;
                if (objectManager.checkItemLocation(n, a, i.scale, 0.6, e, false)) {
                    this.place(e, t);
                }
            }
        }
        checkPlace(e, t = 0, i, s) {
            let n = items.list[e];
            if (n) {
                let a = n.scale;
                let l = 35 + a + (n.placeOffset || 0);
                let o = player.x2 + Math.cos(t) * l;
                let r = player.y2 + Math.sin(t) * l;
                if (this.checkMarkers(o, r, a, game.tick)) {
                    if (s) {
                        let c = pingTracker.data[s.id]?.ping || window.pingTime;
                        this.preplacements++;
                        setTimeout(
                            () => {
                                this.diffPlace(e, t, game.tick);
                            },
                            config.serverUpdateSpeed + c - window.pingTime,
                        );
                    } else {
                        this.place(e, t);
                    }
                    if (typeof i == "function") {
                        i();
                    }
                }
            }
        }
        checkMarkers(e, t, i, s) {
            for (let n = 0; n < this.markers.length; n++) {
                let a = this.markers[n];
                if (
                    a &&
                    UTILS.getDistance(a, {
                        x: e,
                        y: t,
                    }) <=
                    a.scale + i &&
                    (!a.differentVisual || s == a.ticks)
                ) {
                    return false;
                }
            }
            return true;
        }
        calculatePosition(e, t, i) {
            return {
                x: (e.x2 || e.x) + Math.cos(i) * t,
                y: (e.y2 || e.y) + Math.sin(i) * t,
            };
        }
        validateAngle(e, t) {
            let i = player.items[2];
            let s = items.list[15];
            let n = items.list[i];
            let a = 35 + n.scale + (n.placeOffset || 0);
            let l = 35 + s.scale + (s.placeOffset || 0);
            let o = game.enemies.nearest;
            let r = {
                angle: e,
                trap: false,
                pos: {},
                prioritization: 0,
            };
            let c = this.calculatePosition(player, l, e);
            if (objectManager.checkItemLocation(c.x, c.y, s.scale, 0.6, 15, false)) {
                r.trap = true;
                r.pos.trap = {
                    ...c,
                };
                r.pos.trap.scale = s.scale;
            }
            c = this.calculatePosition(player, a, e);
            if (objectManager.checkItemLocation(c.x, c.y, n.scale, 0.6, i, false)) {
                r.spike = true;
                r.prioritization++;
                r.pos.spike = {
                    ...c,
                };
                r.pos.spike.dmg = n.dmg;
                r.pos.spike.scale = n.scale;
            }
            if (r.spike || r.trap) {
                let d = r.pos.spike || r.pos.trap;
                let p = this.brokenObj.sort((e, t) => UTILS.getDistance(e, d) - UTILS.getDistance(t, d))[0];
                r.brokenDist = Infinity;
                r.enemyDist = UTILS.getDistance(o, d);
                if (p) {
                    r.brokenDist = UTILS.getDistance(p, d);
                }
                if (r.brokenDist <= r.enemyDist) {
                    r.prioritization++;
                }
                t.push(r);
            }
        }
        findAngles(e = 0) {
            let t = Math.PI / parseInt(scriptMenu.toggles.placementDepth);
            let i = player.items[2];
            let s = items.list[15];
            let n = items.list[i];
            let a = [0, Math.PI];
            let l = [];
            for (let o = 0; o <= Math.PI; o += t) {
                for (let r = 0; r < a.length; r++) {
                    let c = o + a[r] + e;
                    this.validateAngle(c, l);
                }
            }
            if (scriptMenu.toggles.dualAngleFinder) {
                let d = Math.max(n.scale, s.scale);
                let p = game.closeObjects.filter((e) => e.active && UTILS.getDistance(e, player) <= 35 + d + e.scale);
                for (let h = 0; h < p.length; h++) {
                    let g = p[h];
                    let $ = p[(h + 1) % p.length];
                    if (g && $) {
                        let m = UTILS.getDirection(g, player);
                        let u = UTILS.getDirection($, player);
                        if (m < 0) {
                            m += Math.PI * 2;
                        }
                        if (u < 0) {
                            u += Math.PI * 2;
                        }
                        let f = (m + u) / 2;
                        if (Math.abs(m - u) > Math.PI && (f += Math.PI) > Math.PI * 2) {
                            f -= Math.PI * 2;
                        }
                        this.validateAngle(f, l);
                    }
                }
            }
            return l
                .sort((e, t) => e.enemyDist - t.enemyDist)
                .sort((e, t) => e.brokenDist - t.brokenDist)
                .sort((e, t) => t.prioritization - e.prioritization);
        }
        replace(e) {
            let t = UTILS.getDirection(e, player);
            let i = game.enemies.nearest;
            let s = i ? UTILS.getDistance(i, player) : Infinity;
            if (s <= 400 && i && player.items[4] == 15 && scriptMenu.toggles.autoreplace) {
                this.brokenObj.unshift({
                    x: e.x,
                    y: e.y,
                    scale: e.scale,
                });
                game.tickOut(() => {
                    this.brokenObj.pop();
                }, 8);
                let n = i.trapData;
                let a = this.findAngles(t);
                let l = false;
                let o = autoHit.addSpiekTickHit();
                for (let r = 0; r < a.length; r++) {
                    let c = a[r];
                    if (n && e.sid == n.sid && c.trap && UTILS.getDistance(c.pos.trap, i) <= 50) {
                        if (c.spike) {
                            if (autoHit.reverseSpiketick) {
                                this.checkPlace(player.items[2], c.angle, () => {
                                    l = true;
                                });
                            } else {
                                let d = game.closeObjects.find((t) => t.active && t.dmg && game.isFriendly(t.owner.sid) && UTILS.getDistance(t, e) <= t.scale + 70);
                                let p = player.trapData;
                                if (d && p && chicken.replaceable(p)) {
                                    this.checkPlace(player.items[2], c.angle, () => {
                                        l = true;
                                    });
                                } else {
                                    let h = kbSimulator.spikeKB(
                                        {
                                            x: i.x2,
                                            y: i.y2,
                                            scale: 35,
                                            tmpObj: i,
                                        },
                                        c.pos.spike,
                                        true,
                                    );
                                    if (h.data.find((e) => e.id == "spiek")) {
                                        if (h.data.filter((e) => e.id == "spiek").reduce((e, t) => e + t.dmg, 0) + c.pos.spike.dmg + o >= 100) {
                                            this.checkPlace(player.items[2], c.angle, () => {
                                                l = true;
                                                h.callback();
                                            });
                                        } else {
                                            this.checkPlace(player.items[4], c.angle);
                                        }
                                    } else if (!d && h.data.find((e) => e.id == "trap")) {
                                        this.checkPlace(player.items[2], c.angle, () => {
                                            l = true;
                                            h.callback();
                                        });
                                    } else if (o + c.pos.spike.dmg >= 100) {
                                        let g = kbSimulator.meleeKB(i, game.enemies.angle, player.weapons[0]);
                                        if (game.closeObjects.find((e) => e.active && (e.dmg || e.trap) && game.isFriendly(e.owner.sid) && UTILS.getDistance(g, e) <= 35 + e.scale)) {
                                            this.checkPlace(player.items[2], c.angle, () => {
                                                l = true;
                                            });
                                        } else {
                                            this.checkPlace(player.items[4], c.angle);
                                        }
                                    } else {
                                        this.checkPlace(player.items[4], c.angle);
                                    }
                                }
                            }
                        } else {
                            this.checkPlace(player.items[4], c.angle);
                        }
                    } else if (n && c.spike) {
                        if (UTILS.getDistance(c.pos.spike, n) <= 130) {
                            this.checkPlace(player.items[2], c.angle);
                        } else if (c.trap) {
                            this.checkPlace(player.items[4], c.angle);
                        }
                    } else if (s <= 200) {
                        if (c.spike) {
                            if (UTILS.getAngleDist(game.enemies.angle, c.angle) <= 0.75) {
                                this.checkPlace(player.items[2], c.angle);
                            } else if (UTILS.getDistance(c.pos.spike, i) <= 100) {
                                let $ = kbSimulator.spikeKB(
                                    {
                                        x: i.x2,
                                        y: i.y2,
                                        scale: 35,
                                        tmpObj: i,
                                    },
                                    c.pos.spike,
                                    true,
                                );
                                if ($.data.find((e) => e.id == "spiek" || e.id == "trap")) {
                                    this.checkPlace(player.items[2], c.angle, () => {
                                        $.callback();
                                    });
                                }
                            } else if (c.trap) {
                                this.checkPlace(player.items[4], c.angle);
                            }
                        } else if (c.trap) {
                            this.checkPlace(player.items[4], c.angle);
                        }
                    } else if (c.trap) {
                        this.checkPlace(player.items[4], c.angle);
                    }
                }
                if (l) {
                    autoHit.spiekTick();
                }
            }
        }
        autoplace() {
            if (!scriptMenu.toggles.autoplace || !game.enemies.nearest || placer.mill.status) {
                return;
            }
            let e = game.enemies.nearest;
            let t = UTILS.getDistance(e, player);
            if (t > scriptMenu.toggles.autoPlacerRange) {
                return;
            }
            let i = e.trapData;
            let s = this.findAngles(game.enemies.angle);
            let n = game.closeObjects.filter((e) => e.active && e.trap && game.isFriendly(e.owner.sid) && UTILS.getDistance(e, player) <= 300);
            for (let a = 0; a < s.length; a++) {
                let l = s[a];
                if (i && l.spike) {
                    if (UTILS.getDistance(l.pos.spike, i) <= 130) {
                        this.checkPlace(player.items[2], l.angle);
                    } else if (l.trap) {
                        this.checkPlace(player.items[4], l.angle);
                    }
                } else if (t <= 200) {
                    if (l.spike) {
                        let o = l.pos.spike;
                        if (UTILS.getDistance(o, e) <= 100) {
                            let r = kbSimulator.spikeKB(
                                {
                                    x: e.x2,
                                    y: e.y2,
                                    scale: 35,
                                    tmpObj: e,
                                },
                                l.pos.spike,
                                true,
                            );
                            let c = () => {
                                this.checkPlace(player.items[2], l.angle, () => {
                                    r.callback();
                                });
                            };
                            if (r.data.find((e) => e.id == "trap")) {
                                c();
                            } else if (r.data.find((e) => e.id == "spiek") && r.data.filter((e) => e.id == "spiek").reduce((e, t) => e + t.dmg, 0) + l.pos.spike.dmg >= 100) {
                                c();
                            } else if (l.trap) {
                                this.checkPlace(player.items[4], l.angle);
                            }
                        } else if (UTILS.getAngleDist(game.enemies.angle, l.angle) <= 0.75 && n.find((e) => UTILS.getDistance(o, e) <= 135)) {
                            this.checkPlace(player.items[2], l.angle);
                        } else if (l.trap) {
                            this.checkPlace(player.items[4], l.angle);
                        }
                    } else if (l.trap) {
                        this.checkPlace(player.items[4], l.angle);
                    }
                } else if (l.trap) {
                    this.checkPlace(player.items[4], l.angle);
                }
            }
        }
        validateBuilding(e) {
            if (UTILS.getDistance(player, e) > 100 + e.scale * 2) {
                return false;
            }
            if (!e.currentHealth) {
                return;
            }
            let t = 0;
            for (let i = 0; i < players.length; i++) {
                let s = players[i];
                if (s.visible && UTILS.getDistance(s, e) <= 100 + e.scale * 2) {
                    let n = s.secondaryWeapon == 10 ? 10 : s.primaryWeapon;
                    let a = config.weaponVariants[n == 10 ? s.secondaryVariant : s.primaryVariant].val;
                    let l = items.weapons[n];
                    let o = l.dmg * (l.sDmg || 1) * (a || 1);
                    if (playerSID == s.sid) {
                        if (s.skins[40]) {
                            o *= 3.3;
                        }
                    } else {
                        o *= 3.3;
                    }
                    if (!!(UTILS.getDistance(s, e) - e.scale < l.range) && healer.reloadPercent(s, n) == 1 && (!e.trap || !e.hideFromEnemy)) {
                        t += o;
                    }
                }
            }
            return e.currentHealth <= t;
        }
        validateClashWithEnemy(e) {
            let t = [];
            for (let i = 0; i < e.length; i++) {
                let s = e[i];
                if (UTILS.getDistance(player, s) <= 100 + s.scale * 2) {
                    for (let n = 0; n < game.enemies.all.length; n++) {
                        let a = game.enemies.all[n];
                        if (UTILS.getDistance(a, s) <= 100 + s.scale * 2) {
                            t.push({
                                x: s.x,
                                y: s.y,
                                enemy: a,
                                scale: s.scale,
                                sid: s.sid,
                            });
                            break;
                        }
                    }
                }
            }
            return t;
        }
        validateIfOverLap(e, t, i, s) {
            for (let n = 0; n < s.length; n++) {
                let a = s[n];
                if (a.active) {
                    let l = a.blocker ? a.blocker : a.getScale(0.6, a.isItem);
                    if (UTILS.getDistance(e, a) < t + l && !i.find((e) => e.sid == a.sid)) {
                        return true;
                    }
                }
            }
            return false;
        }
        validateOpenAngle(e, t, i, s) {
            let n = player.items[2];
            let a = items.list[15];
            let l = items.list[n];
            let o = 35 + l.scale + (l.placeOffset || 0);
            let r = 35 + a.scale + (a.placeOffset || 0);
            let c = game.enemies.nearest;
            let d = {
                angle: e,
                trap: false,
                pos: {},
                prioritization: 0,
            };
            let p = this.calculatePosition(player, r, e);
            let h = objectManager.checkItemLocation(p.x, p.y, a.scale, 0.6, 15, false, undefined, true);
            let g = i.find((e) => e.sid == h.sid);
            if (g && !this.validateIfOverLap(p, a.scale, i, s)) {
                d.trap = true;
                d.pos.trap = {
                    ...p,
                };
                d.pos.trap.scale = a.scale;
                d.preplacedTo = UTILS.getDirection(g, player);
                d.enemy = g.enemy;
            }
            p = this.calculatePosition(player, o, e);
            h = objectManager.checkItemLocation(p.x, p.y, l.scale, 0.6, n, false, undefined, true);
            if ((g = i.find((e) => e.sid == h.sid)) && !this.validateIfOverLap(p, a.scale, i, s)) {
                d.spike = true;
                d.prioritization++;
                d.pos.spike = {
                    ...p,
                };
                d.pos.spike.dmg = l.dmg;
                d.preplacedTo = UTILS.getDirection(g, player);
                d.pos.spike.scale = l.scale;
                d.enemy = g.enemy;
            }
            if (d.spike || d.trap) {
                let $ = d.pos.spike || d.pos.trap;
                let m = this.brokenObj.sort((e, t) => UTILS.getDistance(e, $) - UTILS.getDistance(t, $))[0];
                d.brokenDist = Infinity;
                d.enemyDist = UTILS.getDistance(c, $);
                if (m) {
                    d.brokenDist = UTILS.getDistance(m, $);
                }
                if (d.brokenDist <= d.enemyDist) {
                    d.prioritization++;
                }
                t.push(d);
            }
        }
        findOpenAngles(e) {
            let t = Math.PI / parseInt(scriptMenu.toggles.placementDepth);
            let i = [0, Math.PI];
            let s = player.items[2];
            let n = items.list[s];
            let a = items.list[15];
            let l = [];
            let o = Math.max(n.scale, a.scale);
            let r = game.closeObjects.filter((e) => e.active && UTILS.getDistance(e, player) <= 35 + o + e.scale);
            for (let c = 0; c <= Math.PI; c += t) {
                for (let d = 0; d < i.length; d++) {
                    let p = c + i[d];
                    this.validateOpenAngle(p, l, e, r);
                }
            }
            if (scriptMenu.toggles.dualAngleFinder) {
                for (let h = 0; h < r.length; h++) {
                    let g = r[h];
                    let $ = r[(h + 1) % r.length];
                    if (g && $) {
                        let m = UTILS.getDirection(g, player);
                        let u = UTILS.getDirection($, player);
                        if (m < 0) {
                            m += Math.PI * 2;
                        }
                        if (u < 0) {
                            u += Math.PI * 2;
                        }
                        let f = (m + u) / 2;
                        if (Math.abs(m - u) > Math.PI && (f += Math.PI) > Math.PI * 2) {
                            f -= Math.PI * 2;
                        }
                        this.validateOpenAngle(f, l, e, r);
                    }
                }
            }
            return l
                .sort((e, t) => e.enemyDist - t.enemyDist)
                .sort((e, t) => e.brokenDist - t.brokenDist)
                .sort((e, t) => t.prioritization - e.prioritization);
        }
        preplace() {
            if (!scriptMenu.toggles.autoplace || !scriptMenu.toggles.preplace || !game.enemies.nearest || placer.mill.status) {
                return;
            }
            let e = game.closeObjects.filter((e) => e.active && this.validateBuilding(e));
            if (!e.length) {
                return;
            }
            e = this.validateClashWithEnemy(e);
            let t = this.findOpenAngles(e);
            let i = game.closeObjects.filter((e) => e.active && e.trap && game.isFriendly(e.owner.sid) && UTILS.getDistance(e, player) <= 300);
            for (let s = 0; s < t.length; s++) {
                let n = t[s];
                let a = n.enemy;
                let l = a.trap;
                let o = UTILS.getDistance(a, player);
                if (l && n.spike) {
                    if (UTILS.getDistance(n.pos.spike, l) <= 130) {
                        this.checkPlace(player.items[2], n.angle, undefined, a);
                        if (this.preplacements > 3) {
                            break;
                        }
                    } else if (n.trap && (this.checkPlace(player.items[4], n.angle, undefined, a), this.preplacements > 3)) {
                        break;
                    }
                } else if (o <= 200) {
                    if (n.spike) {
                        let r = n.pos.spike;
                        if (UTILS.getDistance(r, a) <= 100) {
                            let c = kbSimulator.spikeKB(
                                {
                                    x: a.x2,
                                    y: a.y2,
                                    scale: 35,
                                    tmpObj: a,
                                },
                                n.pos.spike,
                                true,
                            );
                            let d = () => {
                                this.checkPlace(player.items[2], n.angle, undefined, a);
                            };
                            if (c.data.find((e) => e.id == "trap")) {
                                d();
                                if (this.preplacements > 3) {
                                    break;
                                }
                            } else if (c.data.find((e) => e.id == "spiek")) {
                                if (c.data.filter((e) => e.id == "spiek").reduce((e, t) => e + t.dmg, 0) + n.pos.spike.dmg >= 100) {
                                    d();
                                    if (this.preplacements > 3) {
                                        break;
                                    }
                                } else if (n.trap && (this.checkPlace(player.items[4], n.angle, undefined, a), this.preplacements > 2)) {
                                    break;
                                }
                            } else if (n.trap && (this.checkPlace(player.items[4], n.angle, undefined, a), this.preplacements > 2)) {
                                break;
                            }
                        } else if (UTILS.getAngleDist(game.enemies.angle, n.angle) <= 0.75 && i.find((e) => UTILS.getDistance(r, e) <= 135)) {
                            this.checkPlace(player.items[2], n.angle, undefined, a);
                            if (this.preplacements > 3) {
                                break;
                            }
                        } else if (n.trap && (this.checkPlace(player.items[4], n.angle, undefined, a), this.preplacements > 2)) {
                            break;
                        }
                    } else if (n.trap && (this.checkPlace(player.items[4], n.angle, undefined, a), this.preplacements > 2)) {
                        break;
                    }
                } else if (n.trap && (this.checkPlace(player.items[4], n.angle, undefined, a), this.preplacements > 2)) {
                    break;
                }
            }
            this.preplacements = 0;
        }
    })();
    var hatSystem = new (class {
        constructor() {
            this.itemQueue = [];
            this.needTick = 0;
            this.sentPacket = false;
            this.forceAddIndexs = {
                onlySoldier: 0,
                onlyEMP: 1,
                trapSoldier: 2,
                otSoldier: 3,
            };
            this.forcedAddOns = [0, 0, 0, 0];
            this.velSoldier = false;
            this.spikeSoldier = false;
        }
        resetAllForcedAddOns() {
            for (let e = 0; e < this.forcedAddOns.length; e++) {
                this.forcedAddOns[e] = 0;
            }
        }
        addForcedAddOnValue(e, t, i) {
            if (!(e >= 4)) {
                this.forcedAddOns[e] += t;
                this.storeEquip(e == 1 ? 22 : 6);
                if (typeof i == "function") {
                    if (t == 1) {
                        game.nextTick(() => {
                            i();
                        });
                    } else {
                        game.tickOut(() => {
                            i();
                        }, t);
                    }
                }
            }
        }
        resetForcedAddOn(e) {
            if (!(e >= 4)) {
                this.forcedAddOns[e] = 0;
            }
        }
        storeBuy(e, t) {
            io.send("c", 1, e, t);
        }
        biomeEquip(e) {
            if (player.y2 < 2400) {
                this.storeEquip(15);
            } else if (player.skins[12]) {
                this.storeEquip(12);
            } else {
                this.storeEquip(6);
            }
            if (!e) {
                this.storeEquip(11, true);
            }
        }
        canBullTick() {
            return !game.closeObjects.find((e) => e.active && e.dmg && !game.isFriendly(e.owner.sid) && UTILS.getDistance(e, player) <= 40 + e.scale) && !effectsManager.effects.find((e) => e.name == "shame!") && !(player.health - 5 <= 0) && !!player.skins[7] && player.shameCount > 0 && ((game.tick - player.bullTick) % 9 == 0 || this.needTick > 1) && (this.needTick++, true);
        }
        doBasicFunction(e) {
            let t = game.enemies.nearest;
            if (hatSystem.canBullTick()) {
                this.storeEquip(7, 0, true);
            } else if (player.y2 > 6850 && player.y2 < 7550) {
                this.storeEquip(31, 0, true);
                if (!e) {
                    hatSystem.storeEquip(11, 1, true);
                }
            } else if (player.trapData) {
                this.storeEquip(6, 0, true);
                if (!e) {
                    this.storeEquip(11, 1, true);
                }
            } else if (t && UTILS.getDistance(t, player) <= 300) {
                this.storeEquip(6, 0, true);
                if (!e) {
                    if (chicken.pushing && ![4, 5].includes(player.weapons[0]) && UTILS.getDistance(chicken.pushing.victim, player) >= 130) {
                        this.storeEquip(11, 1, true);
                    } else if (chicken.autoTriggerOneShot && UTILS.getDistance(t, player) <= 250) {
                        this.storeEquip(chicken.checkHave(19, true), 1, true);
                    } else if (player.weapons[0] == 7 || player.weapons[0] == 8 || (UTILS.getDistance(t, player) >= 110 && !game.closeObjects.find((e) => e.active && e.dmg && UTILS.getDistance(e, player) <= 400))) {
                        this.storeEquip(11, 1, true);
                    } else {
                        this.storeEquip(chicken.checkHave(19, true), 1, true);
                    }
                }
            } else if (game.turretsInSight > 0 && player.skins[22]) {
                this.storeEquip(22, 0, true);
                if (!e) {
                    this.storeEquip(11, 1, true);
                }
            } else if (chicken.movementDirection == undefined || chicken.movementDirection == null) {
                this.storeEquip(6, 0, true);
                if (!e) {
                    this.storeEquip(11, 1, true);
                }
            } else {
                this.biomeEquip(e);
            }
        }
        checkOnlySoldier() {
            return [0, 2, 3].some((e) => this.forcedAddOns[e] > 0) || this.velSoldier || this.spikeSoldier;
        }
        storeEquip(e, t, i) {
            let s = () =>
            !!i &&
                (!!this.sentPacket ||
                 void ((this.sentPacket = true),
                       setTimeout(() => {
                    this.sentPacket = false;
                }, 5)));
            if (t) {
                if (e > 0 && !player.tails[e]) {
                    return;
                }
                if (player.tailIndex != e) {
                    if (s()) {
                        return;
                    }
                    io.send("c", 0, e, 1);
                }
            } else {
                if (e > 0 && !player.skins[e]) {
                    return;
                }
                if (this.checkOnlySoldier()) {
                    if (player.skinIndex != 6) {
                        io.send("c", 0, 6, 0);
                    }
                } else if (this.onlyEMP) {
                    if (player.skinIndex != 22) {
                        io.send("c", 0, 22, 0);
                    }
                } else if (player.skinIndex != e) {
                    if (s()) {
                        return false;
                    }
                    io.send("c", 0, e, 0);
                }
            }
        }
        tickBase() {
            for (let e = 0; e < this.forcedAddOns.length; e++) {
                if (this.forcedAddOns[e] > 0) {
                    this.forcedAddOns[e]--;
                    if (this.forcedAddOns[e] <= 0) {
                        this.forcedAddOns[e] = 0;
                    }
                }
            }
            this.spikeSoldier = false;
            if (player.trapData) {
                let t = 0;
                for (let i = 0; i < game.enemies.near.length; i++) {
                    let s = game.enemies.near[i];
                    let n = s.primaryWeapon;
                    let a = healer.reloadPercent(s, n);
                    let l = healer.calculateWeaponDamage(n, s.primaryVariant) * 1.5;
                    if (a == 1 && (t += l) >= 100) {
                        break;
                    }
                }
                if (game.closeObjects.find((e) => e.active && e.dmg && !game.isFriendly(e.owner.sid) && e.dmg + t >= 100 && UTILS.getDistance(player.vel, e) <= 35 + e.scale)) {
                    textManager.showText(player, 250, 40, 0, "#000", "block");
                    this.spikeSoldier = true;
                    return;
                }
            } else {
                let o = 0;
                let r = [];
                for (let c = 0; c < game.closeObjects.length; c++) {
                    let d = game.closeObjects[c];
                    if (d.active && d.dmg && !game.isFriendly(d.owner.sid)) {
                        r.push(d);
                        if (UTILS.getDistance(d, player.vel) <= 35 + d.scale) {
                            o += d.dmg;
                        }
                    }
                }
                for (let p = 0; p < game.enemies.near.length; p++) {
                    let h = game.enemies.near[p];
                    let g = h.primaryWeapon;
                    let $ = healer.reloadPercent(h, g);
                    let m = healer.calculateWeaponDamage(g, h.primaryVariant) * 1.5;
                    if ($ == 1) {
                        if (o > 0 && o + m >= 100) {
                            this.spikeSoldier = true;
                            break;
                        }
                        let u = UTILS.getDirection(player, h);
                        let f = kbSimulator.meleeKB(player, u, g);
                        if (r.filter((e) => UTILS.getDistance(f, e) <= 35 + e.scale).reduce((e, t) => e + t.dmg, 0) + m >= 100) {
                            this.spikeSoldier = true;
                            break;
                        }
                    }
                }
            }
        }
    })();
    var healer = new (class {
        constructor() {
            this.projectiles = [];
            this.damages = [];
            this.healingPotential = 0;
            this.healingDelay = 0;
            this.cachedDamages = {};
            this.spikeDamages = [45, 35, 20, 30];
            this.projectileDamage = 0;
            this.bowHealer = null;
            this.possibleEnemySpikes = {};
        }
        doTurretTargetLineMath(e) {
            let t = ais.filter((t) => t.visible && t.hostile && UTILS.getDistance(t, e) <= 600).sort((t, i) => UTILS.getDistance(t, e) - UTILS.getDistance(i, e))[0];
            let i = players.filter((t) => t.visible && t.skinIndex != 26 && e.sid != t.sid && t.sid != playerSID && (!t.team || t.team != e.team) && UTILS.getDistance(t, e) <= 600).sort((t, i) => UTILS.getDistance(t, e) - UTILS.getDistance(i, e))[0];
            let s = t;
            if (t) {
                if (i && UTILS.getDistance(i, e) <= UTILS.getDistance(t, e)) {
                    s = i;
                }
            } else {
                s = i;
            }
            if (s) {
                let n = UTILS.getDirection(s, e);
                if (UTILS.getDistance(player, e) <= UTILS.getDistance(s, e)) {
                    let a = UTILS.getDistance(player, e);
                    let l = {
                        x: e.x2 + Math.cos(n) * a,
                        y: e.y2 + Math.sin(n) * a,
                    };
                    if (UTILS.getDistance(player, l) <= 60) {
                        return true;
                    }
                }
            }
            return false;
        }
        heal(e) {
            let t = player.items[0];
            let i = Math.abs(e) / (t == 0 ? 20 : t == 1 ? 40 : 30);
            for (let s = 0; s < i; s++) {
                chicken.selectToBuild(t);
                chicken.sendHit(1, chicken.getAttackDir());
                chicken.selectToBuild(chicken.preferedWeaponIndex, true);
            }
        }
        calculateWeaponDamage(e, t) {
            if (items.weapons[e]) {
                if (items.weapons[e].projectile) {
                    return items.weapons[e].dmg;
                } else {
                    return items.weapons[e].dmg * config.weaponVariants[t].val;
                }
            } else {
                return 0;
            }
        }
        reloadPercent(e, t) {
            if (t == 53) {
                return 1 - e.reloads[53] / 2500;
            }
            if (!items.weapons[t]) {
                return 1;
            }
            let i = items.weapons[t].speed;
            return 1 - e.reloads[t] / i;
        }
        hasHit(e, t) {
            if (t == 53) {
                return game.tick - e.turretHit <= 2;
            }
            if (t < 9) {
                if (game.tick - e.primaryHit <= 2) {
                    return true;
                }
            } else if (game.tick - e.secondaryHit <= 2) {
                return true;
            }
            return false;
        }
        doPreciseValues(e, t) {
            if (e - t < 0.01 && e - t > 0) {
                return t;
            } else {
                return e;
            }
        }
        soldierRound(e, t) {
            if (player.skinIndex == 6) {
                return this.doPreciseValues(e * 0.75, t);
            } else {
                return this.doPreciseValues(e);
            }
        }
        autoHealing() {
            if (this.healingDelay > 0) {
                this.healingDelay--;
                if (this.healingDelay <= 0) {
                    this.healingDelay = 0;
                    this.heal(100 - player.health);
                }
            }
            this.damages = [];
        }
        findCachedDamage(e, t, i) {
            let s = this.cachedDamages[e + " " + t];
            if (!s) {
                s = [];
                let n = [1, 1.5, 1.2];
                let a = [1, 0.2];
                for (let l = 0; l < n.length; l++) {
                    for (let o = 0; o < a.length; o++) {
                        s.push(i * n[l] * a[o]);
                    }
                }
                this.cachedDamages[e + " " + t] = [...s];
            }
            return s;
        }
        fitsPalette(e, t) {
            let i = t.primaryWeapon;
            let s = t.primaryVariant;
            let n = this.calculateWeaponDamage(i, s);
            let a = this.findCachedDamage(i, s, n);
            for (let l = 0; l < a.length; l++) {
                if (this.soldierRound(a[l], e) == e) {
                    return "primary";
                }
            }
            let o = t.secondaryWeapon;
            if (items.weapons[t.secondaryWeapon].projectile) {
                let r = this.calculateWeaponDamage(o, 0);
                if (this.soldierRound(r, e) == e) {
                    return "secondary";
                }
            }
            return this.soldierRound(25, e) == e && "turret";
        }
        checkForSpikePlacements() {
            let e = game.enemies.near;
            let t = e.length;
            let i = [];
            let s = Math.PI / 16;
            let n = Math.PI * 2;
            for (let a = 0; a < t; a++) {
                let l = false;
                let o = e[a];
                let r = o.spikeType?.id || 9;
                let c = items.list[r];
                let d = 35 + c.scale + (c.placeOffset || 0);
                let p = 35 + c.scale;
                for (let h = 0; h <= n; h += s) {
                    let g = placer.calculatePosition(o, d, h);
                    if (objectManager.checkItemLocation(g.x, g.y, c.scale, 0.6, r, false) && (UTILS.getDistance(g, player) <= p || UTILS.getDistance(player.vel, g) <= p)) {
                        i.push({
                            enemy: o,
                            dmg: c.dmg,
                        });
                        break;
                    }
                }
                if (l) {
                    continue;
                }
            }
            return i.sort((e, t) => t.dmg - e.dmg)[0] || false;
        }
        checkIfUserCanOnetick(e) {
            let t = e.primaryWeapon;
            let i = e.primaryVariant;
            return this.calculateWeaponDamage(t, i) * 1.5 + 25 + (i == 3 ? 5 : 0) >= 100;
        }
        addKBSpikeDamage(e, t) {
            if (player.trapData) {
                return 0;
            }
            let i = UTILS.getDirection(player, t);
            let s = kbSimulator.meleeKB(player, i, e);
            return game.closeObjects.filter((e) => e.active && e.dmg && !game.isFriendly(e.owner.sid) && UTILS.getDistance(s, e) <= 35 + e.scale).reduce((e, t) => e + t.dmg, 0) || 0;
        }
        possibleSpikes(t) {
            let a = items.list.find((e) => e.name == "spinning spikes");
            let k = items.list.find((e) => e.name == "greater spikes");
            let possible = {
                7: a,
                10: a,
                15: k,
                5: a,
                4: a,
                3: k,
            };
            return game.closeObjects.filter((e) => e.active && e.dmg && (e.owner.sid == t.sid || game.isFriendly(e.owner.sid))).sort((a, b) => UTILS.getDistance(t, a) - UTILS.getDistance(t, b))[0] || (t.weaponIndex in possible ? possible[t.weaponIndex] : null);
        }
        interpretDamage() {
            let e = game.enemies.near;
            let t = e.length;
            t ? (this.possibleEnemySpikes = this.possibleSpikes(game.enemies.nearest)) : items.list.find((e) => e.name == "spinning spikes");
            let i = [];
            let s = [];
            for (let n = 0; n < this.damages.length; n++) {
                let a = this.damages[n];
                let l = false;
                for (let o = 0; o < t; o++) {
                    let r = {
                        canEMP: true,
                        potDamage: 0,
                        done: false,
                    };
                    let c = e[o];
                    r.sid = c.sid;
                    let d = this.fitsPalette(a, c);
                    if (!d) {
                        continue;
                    }
                    let p = c.primaryWeapon;
                    let h = c.secondaryWeapon;
                    let g = this.calculateWeaponDamage(p, c.primaryVariant);
                    let $ = this.calculateWeaponDamage(h, c.secondaryVariant);
                    let m = this.reloadPercent(c, p);
                    let u = this.reloadPercent(c, h);
                    let f = this.reloadPercent(c, 53);
                    if (d == "primary") {
                        if (this.hasHit(c, p)) {
                            if (u > 0.7) {
                                r.potDamage += $;
                                let y = this.addKBSpikeDamage(h, c);
                                if (y) {
                                    r.potDamage += y;
                                    r.spike = true;
                                }
                            }
                            if (f > 0.7) {
                                r.potDamage += 25;
                            }
                            if (this.doTurretTargetLineMath(c) || !items.weapons[h].projectile) {
                                r.canEMP = false;
                            }
                            r.done = true;
                        }
                    } else if (d == "secondary") {
                        r.canEMP = false;
                        if (this.hasHit(c, h)) {
                            if (m > 0.7) {
                                console.log(true);
                                r.potDamage += g * 1.5;
                                let x = this.addKBSpikeDamage(p, c);
                                if (x) {
                                    r.potDamage += x;
                                    r.spike = true;
                                }
                            }
                            r.done = true;
                        }
                    } else {
                        r.canEMP = false;
                        if (this.hasHit(c, 53) && !items.weapons[h].projectile && this.hasHit(c, h)) {
                            if (m > 0.7) {
                                r.potDamage += g * 1.5;
                                let b = this.addKBSpikeDamage(p, c);
                                if (b) {
                                    r.potDamage += b;
                                    r.spike = true;
                                }
                            }
                            if (this.checkIfUserCanOnetick(c)) {
                                hatSystem.resetForcedAddOn(hatSystem.forceAddIndexs.otSoldier);
                            }
                            r.done = true;
                        }
                    }
                    if (r.done) {
                        i.push(r);
                        l = true;
                        break;
                    }
                }
                if (l) {
                    continue;
                }
                let k = this.spikeDamages.find((e) => e == a || e == a / 0.75);
                if (k && player.trapData) {
                    let _ = 0;
                    let v = game.closeObjects
                    .filter((e) => e.active && e.dmg == k && !game.isFriendly(e.owner.sid) && !s.includes(e.sid))
                    .map((e) => ({
                        obj: e,
                        distance: UTILS.getDistance(e, player),
                    }))
                    .sort((e, t) => e.distance - t.distance)
                    .map((e) => e.obj);
                    for (let w = 0; w < t; w++) {
                        let T = e[w];
                        let S = v.find((e) => e.owner.sid == T.sid);
                        let I = i.find((e) => e.sid == T.sid);
                        if (S) {
                            let B = T.primaryWeapon;
                            let D = this.reloadPercent(T, B);
                            let E = this.calculateWeaponDamage(B, T.primaryVariant) * 1.5;
                            if (D + 111 / items.weapons[B].speed >= 1) {
                                if (I) {
                                    if (I.potDamage < E) {
                                        s.push(S.sid);
                                        I.potDamage = E;
                                        break;
                                    }
                                } else {
                                    s.push(S.sid);
                                    _ += E;
                                    break;
                                }
                            }
                        }
                    }
                    i.push({
                        canEMP: false,
                        spike: true,
                        potDamage: k + _,
                    });
                }
            }
            if (scriptMenu.toggles.sensitiveHealing) {
                if (!player.trapData) {
                    let P = game.closeObjects.filter((e) => e.active && e.dmg && UTILS.getDistance(player.vel, e) <= 35 + e.scale && !game.isFriendly(e.owner.sid) && !s.includes(e.sid)).reduce((e, t) => e + t.dmg, 0);
                    i.push({
                        canEMP: false,
                        spike: true,
                        potDamage: P,
                    });
                }
                let A = this.checkForSpikePlacements();
                if (A) {
                    let C = i.find((e) => e.sid == A.enemy.sid);
                    let L = A.enemy;
                    let H = L.primaryWeapon;
                    let O = L.primaryVariant;
                    let W = this.calculateWeaponDamage(H, O) * 1.5;
                    let j = this.reloadPercent(L, H);
                    if (C) {
                        C.spike = true;
                        C.canEMP = false;
                        if (j == 1 && W + A.dmg > C.potDamage) {
                            C.potDamage = W + A.dmg;
                        }
                    } else {
                        i.push({
                            canEMP: false,
                            spike: true,
                            potDamage: A.dmg + (j == 1 ? W : 0),
                        });
                    }
                }
            }
            return i;
        }
        validateAnti(e, t, i) {
            if (e == "emp") {
                if (!player.skins[22] || player.skinIndex != 6 || player.health - (t - 25) <= 0 || hatSystem.checkOnlySoldier()) {
                    return false;
                }
            } else {
                if (player.health - t <= 0 || !player.skins[6]) {
                    return false;
                }
                if (player.trapData && i) {
                    let s = chicken.equipBestBreakWeapon("autobreak", true);
                    let n = this.reloadPercent(player, s);
                    if (s == 10 && n == 1) {
                        return false;
                    }
                }
            }
            return true;
        }
        updateProjectileDamage() {
            this.projectileDamage = this.projectiles.reduce((e, t) => e + t, 0);
        }
        addProjectile(e, t, i) {
            if (!game.isFriendly(e.sid) && UTILS.getDistance(e, player) >= 300) {
                this.projectiles.push(t);
                if ((this.projectileDamage = this.projectiles.reduce((e, t) => e + t, 0)) >= 100 && this.healingPotential != "IntBow") {
                    let s = 0;
                    this.heal(40);
                    this.healingPotential = "IntBow";
                    this.bowHealer = setInterval(() => {
                        s++;
                        this.healingPotential = "IntBow";
                        if (s > 4) {
                            clearInterval(this.bowHealer);
                        }
                        this.heal(40);
                    }, 75);
                }
                setTimeout(() => {
                    this.projectiles.shift();
                }, i);
            }
        }
        start0ShameHeal(e, t) {
            if (e == 2) {
                if (game.closeObjects.find((e) => e.active && e.dmg && !game.isFriendly(e.owner.sid) && UTILS.getDistance(e, player) <= e.scale + 60)) {
                    game.nextTick(() => {
                        this.heal(t);
                    });
                } else {
                    this.healingDelay = 2;
                }
            } else {
                game.nextTick(() => {
                    this.heal(t);
                });
            }
        }
        healing() {
            if (this.damages.length && !botManager.playingAsData) {
                let e = 100 - player.health;
                if (game.enemies.near.length) {
                    let t = this.interpretDamage();
                    let i = (this.healingPotential = t.reduce((e, t) => e + t.potDamage, 0) + (player.skinIndex == 7 ? 5 : 0));
                    let s = t.every((e) => e.canEMP);
                    let n = t.some((e) => e.spike);
                    if (player.health - i <= 0) {
                        if (scriptMenu.toggles.soldierEMP && s && this.validateAnti("emp", i)) {
                            hatSystem.addForcedAddOnValue(hatSystem.forceAddIndexs.onlyEMP, 1, () => {
                                this.heal(e);
                            });
                        } else if (this.validateAnti("soldier", i * 0.75, n)) {
                            hatSystem.addForcedAddOnValue(hatSystem.forceAddIndexs.onlySoldier, 1, () => {
                                this.heal(e);
                            });
                        } else if (player.shameCount < 7) {
                            this.heal(e);
                        } else {
                            this.start0ShameHeal(true, e);
                        }
                    } else {
                        this.start0ShameHeal(2, e);
                    }
                } else {
                    this.start0ShameHeal(true, e);
                }
            }
            this.autoHealing();
        }
        isSpikeTickAThreat() {
            let e = game.enemies.near;
            let t = game.enemies.near.length;
            for (let i = 0; i < t; i++) {
                let s = e[i];
                if (s) {
                    let n = s.primaryWeapon;
                    let a = s.primaryVariant;
                    let l = this.reloadPercent(s, n);
                    let o = this.calculateWeaponDamage(n, a) * 1.5;
                    let r = items.list[s.spikeData?.id || 9];
                    if (l == 1 && o + r.dmg >= 100 && UTILS.getDistance(s, player) <= 100 + r.scale * 2) {
                        return true;
                    }
                }
            }
            return false;
        }
        doAntiInstaSpikeTick() {
            let e = game.enemies.nearest;
            let W = (e.weaponIndex == 10 ? 75 : this.calculateWeaponDamage(e.weaponIndex, e.weaponVariant)) * (e.skinIndex == 40 ? 3.3 : 1);
            let P = (player.weaponIndex == 10 ? 75 : this.calculateWeaponDamage(player.weaponIndex, player.weaponVariant)) * (player.skinIndex == 40 ? 3.3 : 1);
            let E = Math.max(W, P);
            let A = e.weaponIndex < e.primary ? [this.calculateWeaponDamage(e.secondaryWeapon, e.secondaryVariant), e.secondaryWeapon] : [this.calculateWeaponDamage(e.primaryWeapon, e.primaryVariant), e.primaryWeapon];
            let F = this.reloadPercent(e, A[1]);
            let a = items.list[e?.spikeType?.id] || this.possibleEnemySpikes;
            let I = this.interpretDamage();
            let z = A[0] * 1.5 + a.dmg;
            if (this.isSpikeTickAThreat() && a && player.trapData.currentHealth <= E * 1.25 && F == 1) {
                console.log("antiSpikeTick");
                if (I.length) {
                    if (I.potDamage < z) {
                        I.potDamage += z;
                        I.spike = true;
                        I.canEMP = false;
                    }
                } else {
                    I.push({ potDamage: z, spike: true, canEMP: false });
                }
                textManager.showText(player, 250, 35, 0, "#f00", "antispiektick " + I[0].potDamage);
            }
        }
        doAntiSpiketick(t) {
            if (this.isSpikeTickAThreat() && player.trapData && player.trapData.sid === t.sid) {
                hatSystem.addForcedAddOnValue(hatSystem.forceAddIndexs.trapSoldier, 3);
                textManager.showText(player, 250, 35, 0, "#008000", "break");
            }
        }
    })();
    var pingTracker = new (class {
        constructor() {
            this.data = {};
            this.tracker = class {
                constructor() {
                    this.ping = 0;
                    this.allPings = [];
                    this.healingPromises = [];
                    this.updated = Date.now();
                }
            };
        }
        add(e, t) {
            this.data[e] ||= new this.tracker();
            let i = this.data[e];
            if ((t >= 0 ? "heal" : "dmg") == "dmg") {
                let s = i.healingPromises.length;
                let n = Date.now();
                new Promise(function (e) {
                    i.healingPromises.push(e);
                    setTimeout(() => {
                        e();
                    }, 500);
                }).then(function (e) {
                    i.healingPromises.splice(s, 1);
                    if (!e) {
                        return;
                    }
                    let t = Date.now() - n;
                    if (t > 120) {
                        if (Date.now() - i.updated >= 30000) {
                            i.allPings = [];
                        }
                        i.allPings.push(t - 120);
                        i.updated = Date.now();
                        if (i.allPings.length > 15) {
                            i.allPings.shift();
                        }
                        i.ping = Math.round(i.allPings.reduce((e, t) => e + t, 0) / i.allPings.length);
                    }
                });
            } else if (i.healingPromises.length) {
                i.healingPromises.forEach((e) => e(true));
                i.healingPromises = [];
            }
        }
    })();
    function updateHealth(e, t) {
        let i = findPlayerBySID(e);
        if (i) {
            let s = t - i.health;
            pingTracker.add(i.id, s);
            if (s >= 0) {
                if (i.hitTime) {
                    let n = Date.now() - i.hitTime;
                    i.hitTime = 0;
                    if (n <= 120) {
                        i.shameCount++;
                    } else {
                        i.shameCount = Math.max(0, i.shameCount - 2);
                    }
                }
            } else {
                i.hitTime = Date.now();
                if (s == -5) {
                    i.bullTick = game.tick;
                    if (i == player) {
                        hatSystem.needTick = 0;
                    }
                }
                if (i == player) {
                    healer.damages.push(Math.abs(s));
                    if (t <= 0) {
                        scriptMenu.addLog("death", `[${healer.damages.join(",")}]`, i.name, e);
                        deathAnimationHandler.addPlayer(i);
                    }
                } else if (!game.isFriendly(e)) {
                    i.damages.push(Math.abs(s));
                    if (t <= 0) {
                        botManager.killChat(i.name);
                        scriptMenu.addLog("death", "", i.name, e);
                        deathAnimationHandler.addPlayer(i);
                    }
                }
            }
            i.health = t;
        }
    }
    var pathfinder = new (class {
        constructor() {
            this.Node = class {
                constructor(e, t) {
                    this.x = e;
                    this.y = t;
                    this.fScore = Infinity;
                    this.gScore = Infinity;
                    this.hScore = Infinity;
                }
            };
        }
        search(e, t) {
            let i = 5;
            let s = [];
            let n = {
                x: Math.floor((Math.min(e.x2, t.x) / i) * i) - i * 80,
                y: Math.floor((Math.min(e.y2, t.y) / i) * i) - i * 80,
            };
            let a = {
                x: Math.floor((Math.max(e.x2, t.x) / i) * i) + i * 80,
                y: Math.floor((Math.max(e.y2, t.y) / i) * i) + i * 80,
            };
            let l = {
                x: a.x - n.x,
                y: a.y - n.y,
            };
            let o = {
                x: Math.ceil(l.x / i) / 2,
                y: Math.ceil(l.y / i) / 2,
            };
            for (let r = 0; r < o.x; r++) {
                for (let c = 0; c < o.y; c++) {
                    let d = {
                        x: n.x + i * 2 * r,
                        y: n.y + i * 2 * c,
                    };
                    if (!(d.x <= 35) && !(d.x >= 14365) && !(d.y <= 35) && !(d.y >= 14365) && !game.closeObjects.find((e) => e.active && UTILS.getDistance(e, d) <= 5 + e.scale)) {
                        s.push(new this.Node(d.x, d.y));
                    }
                }
            }
            return s;
        }
    })();
    var game = new (class {
        constructor() {
            this.turretsInSight = 0;
            this.perfectOTDistance = 225;
            this.lastTickUpdate = Date.now();
            this.tick = 0;
            this.tickSpeed = config.serverUpdateSpeed;
            this.tickBase = [];
            this.doNextTick = [];
            this.closeObjects = [];
            this.enemies = {
                all: [],
                nearest: null,
                near: [],
                angle: 0,
            };
            this.shopList = [
                {
                    id: 11,
                    index: true,
                },
                {
                    id: 15,
                },
                {
                    id: 6,
                },
                {
                    id: 7,
                },
                {
                    id: 40,
                },
                {
                    id: 53,
                },
                {
                    id: 31,
                },
                {
                    id: 12,
                },
                {
                    id: 22,
                },
                {
                    id: 19,
                    index: true,
                },
                {
                    id: 20,
                },
            ];
            this.buildingsHit = [];
            setInterval(() => {
                for (let e = 0; e < gameObjects.length; e++) {
                    let t = gameObjects[e];
                    if (t && !t.active) {
                        gameObjects.splice(e, 1);
                    }
                }
            }, 60000);
        }
        isAlly(e) {
            return alliancePlayers.includes(e);
        }
        isMine(e) {
            return e == player.sid;
        }
        isFriendly(e) {
            return player.sid == e || !!this.isAlly(e);
        }
        nextTick(e) {
            if (typeof e == "function") {
                this.doNextTick.push(e);
            }
        }
        tickOut(e, t) {
            if (typeof e != "function") {
                return;
            }
            let i = this.tick + t;
            if (typeof this.tickBase[i] != "object") {
                this.tickBase[i] = [e];
            } else {
                this.tickBase[i].push(e);
            }
        }
        autoBuy(e) {
            if (!scriptMenu.toggles.autobuy) {
                return;
            }
            let t = this.shopList[0];
            if (t) {
                let i = (t.index ? accessories : hats).find((e) => e.id == t.id);
                if (t.index) {
                    if (player.tails[t.id]) {
                        this.shopList.shift();
                        return;
                    }
                    if (e >= i.price) {
                        io.send("c", 1, t.id, 1);
                    }
                } else {
                    if (player.skins[t.id]) {
                        this.shopList.shift();
                        return;
                    }
                    if (e >= i.price) {
                        io.send("c", 1, t.id, 0);
                    }
                }
            }
        }
        gameTick() {
            this.tick++;
            this.enemies.all = [];
            this.enemies.nearest = null;
            this.enemies.near = [];
            this.enemies.angle = null;
        }
        manageTurretReload(e) {
            this.turretsInSight = 0;
            for (let t = 0; t < this.closeObjects.length; t++) {
                let i = this.closeObjects[t];
                if (i.active && i.name == "turret") {
                    if (scriptMenu.toggles.autoEMP && i.turretReload <= config.serverUpdateSpeed * 2 && UTILS.getDistance(player, i) <= 735 && !this.isFriendly(i.owner.sid) && chicken.canShoot(player, i, i.sid)) {
                        this.turretsInSight++;
                    }
                    if (i.turretReload <= 0) {
                        i.turretReload = 2200;
                    } else {
                        i.turretReload -= e;
                    }
                }
            }
        }
        updateEnemies() {
            if (this.enemies.all) {
                this.enemies.all = this.enemies.all.sort((e, t) => UTILS.getDistance(e, player) - UTILS.getDistance(t, player));
                this.enemies.nearest = this.enemies.all[0];
            }
            if (this.enemies.nearest) {
                this.enemies.angle = UTILS.getDirection(this.enemies.nearest, player);
            }
        }
        manageTickBase() {
            if (this.tickBase[this.tick]) {
                this.tickBase[this.tick].forEach((e) => e());
            }
            if (this.doNextTick.length) {
                this.doNextTick.forEach((e) => e());
            }
            this.doNextTick = [];
            chicken.checkTraps();
            hatSystem.tickBase();
            healer.healing();
            if (!player.team && alliancePlayers.length) {
                alliancePlayers = [];
            }
        }
    })();
    class PathfindNode {
        constructor(e, t, i, s, n) {
            this.x = e;
            this.y = t;
            this.fScore = 0;
            this.gScore = 0;
            this.parent = null;
            this.circleScale = 10;
            this.type = i.some((e) => {
                let t = 0;
                if (e.teleport) {
                    t += 35;
                } else if (e.dmg && !game.isFriendly(e.owner.sid)) {
                    t += 35;
                } else if (e.type == 1 && e.y >= 12000) {
                    t += 35;
                }
                if (UTILS.getDistance(this, e) <= e.getScale() + t && (!e.trap || !game.isFriendly(e.owner.sid))) {
                    return true;
                }
            })
                ? "wall"
            : players.some((e) => {
                if (e.visible && !game.isFriendly(e.sid) && UTILS.getDistance(this, e) <= this.circleScale + 40) {
                    return true;
                }
            })
                ? "wall"
            : "space";
            if (n && UTILS.getDistance(this, n) <= this.circleScale * 2) {
                this.isOk = true;
                this.type = "space";
            }
            if (s && UTILS.getDistance(this, s) <= this.circleScale + 17) {
                this.type = "wall";
            }
        }
    }
    var autoHit = new (class {
        constructor() {
            this.active = false;
            this.spikeDamages = [20, 35, 45, 30];
            this.reverseSpiketick = false;
        }
        damagedBySpike(e) {
            for (let t = 0; t < e.damages.length; t++) {
                let i = e.damages[t];
                if (this.spikeDamages.find((e) => e == i || e == i / 0.75)) {
                    return true;
                }
            }
            return false;
        }
        resetActivity() {
            this.active = false;
        }
        isInRange(e, t) {
            return UTILS.getDistance(e, player) - 63 < t;
        }
        autoInsta() {
            if (!scriptMenu.toggles.autoInsta) {
                return false;
            }
            let e = player.weapons[0];
            let t = player.weapons[1];
            if (e == 8 || ![4, 5].includes(e)) {
                return false;
            }
            let i = game.enemies.nearest;
            let s = game.enemies.angle;
            if (!i) {
                return false;
            }
            let n = items.weapons[t];
            let a = player.primaryVariant;
            let l = healer.calculateWeaponDamage(e, a);
            if (player.skins[7]) {
                l *= 1.5;
            }
            let o = healer.reloadPercent(player, e);
            let r = healer.reloadPercent(player, t);
            let c = healer.reloadPercent(player, 53);
            if (o != 1 || r != 1 || c != 1) {
                return false;
            }
            if (t == 10) {
                if (chicken.pushing && l >= 60) {
                    if (this.damagedBySpike(i) && this.isInRange(i, n.range)) {
                        return "reverse";
                    }
                } else {
                    if (i.trapData || !this.isInRange(i, n.range)) {
                        return false;
                    }
                    let d = [];
                    d = e == 4 ? [0.6, 0.3] : [0.6, 0.5];
                    let p = kbSimulator.meleeKB(i, s, undefined, d);
                    let h = UTILS.getDistance(p, player) / 9;
                    for (let g = 0; g < 9; g++) {
                        let $ = {
                            x: i.x + Math.cos(s) * (h * (g + 1)),
                            y: i.y + Math.sin(s) * (h * (g + 1)),
                        };
                        let m = game.closeObjects.find((e) => e.active && e.dmg && UTILS.getDistance($, e) <= 35 + e.scale);
                        if (m) {
                            if (game.isFriendly(m.owner.sid)) {
                                return "reverse";
                            }
                            break;
                        }
                    }
                }
            }
            return false;
        }
        autoHit() {
            if (!scriptMenu.toggles.autohit) {
                return false;
            }
            let e = player.weapons[0];
            if (e == 8) {
                return false;
            }
            let t = player.primaryVariant;
            let i = healer.calculateWeaponDamage(e, t);
            let s = healer.reloadPercent(player, e);
            let n = items.weapons[e];
            if (player.skins[7]) {
                i *= 1.5;
            }
            let a = game.enemies.nearest;
            let l = game.enemies.angle;
            if (!a) {
                return false;
            }
            if (UTILS.getDistance(a, player) - 63 < n.range) {
                let o = chicken.pushing;
                if (a.skinIndex == 45) {
                    this.active = true;
                    return true;
                }
                if (o) {
                    if (o.victim.sid == a.sid) {
                        if (i >= 60) {
                            if (s < 1) {
                                return false;
                            }
                            if (!this.damagedBySpike(a) && UTILS.getDistance(a.vel, o.last) <= o.scale + 35) {
                                this.active = true;
                                return true;
                            }
                        } else if (o.dist <= o.scale + 45 && UTILS.getDistance(a, player) <= 85) {
                            this.active = true;
                            return true;
                        }
                    }
                } else if ([4, 5].includes(e)) {
                    if (s < 1) {
                        return false;
                    }
                    if (a.trapData) {
                        return;
                    }
                    let r = kbSimulator.meleeKB(a, l, e);
                    let c = game.closeObjects.filter((e) => e.active && e.dmg && game.isFriendly(e.owner.sid) && UTILS.getDistance(r, e) <= 35 + e.scale).reduce((e, t) => e + t.dmg, 0);
                    if ((a.skinIndex == 6 ? 0.75 : 1) * (c + i) >= 100) {
                        this.active = true;
                        return true;
                    }
                }
            }
            return false;
        }
        addSpiekTickHit() {
            let e = player.weapons[0];
            let t = healer.calculateWeaponDamage(e, player.primaryVariant) * 1.5;
            if (healer.reloadPercent(player, e) < 1 || t < 60) {
                return 0;
            } else {
                return t;
            }
        }
        spiekTick() {
            if (!scriptMenu.toggles.spiekTick || player.tailindex == 11) {
                return;
            }
            let e = player.weapons[0];
            let t = healer.calculateWeaponDamage(e, player.primaryVariant) * 1.5;
            if (!(healer.reloadPercent(player, e) < 1)) {
                if (!(t < 60)) {
                    chicken.autoaim = "bullhit";
                    chicken.preferedWeaponIndex = player.weapons[0];
                    if (player.weaponIndex != player.weapons[0]) {
                        chicken.selectToBuild(player.weapons[0], true);
                    }
                    hatSystem.storeEquip(7, 0);
                    if (!autoHit.reverseSpiketick) {
                        chicken.sendAutoGather();
                    }
                    game.tickOut(
                        () => {
                            chicken.sendAutoGather();
                            chicken.autoaim = false;
                        },
                        autoHit.reverseSpiketick ? 3 : 2,
                    );
                }
            }
        }
        checkForReverseSpiketick() {
            this.reverseSpiketick = false;
            if (!scriptMenu.toggles.spiekTick || player.tailindex == 11) {
                return false;
            }
            if (player.weapons[0] != 5 && player.weapons[0] != 4) {
                return;
            }
            let e = game.enemies.nearest;
            if (!e || !e.trapData) {
                return false;
            }
            let t = e.trapData;
            if (player.weapons[1] != 10 || UTILS.getDistance(player, t) - 50 > 75 || healer.reloadPercent(player, 10) < 1 || healer.reloadPercent(player, player.weapons[0]) < 1 || t.currentHealth - (player.skins[40] ? 3.3 : 1) * 75 > 0) {
                return false;
            }
            let i = items.list[player.items[2]];
            let s = placer.calculatePosition(player, 30 + i.scale, game.enemies.angle);
            return !!objectManager.checkItemLocation(s.x, s.y, i.scale, 0.6, player.items[2], false, t);
        }
        meleeSync() {
            if (!scriptMenu.toggles.doMeleeSync || player.tailIndex == 11) {
                return;
            }
            let e = game.enemies.nearest;
            if (!e || !player.team || healer.reloadPercent(player, player.weapons[0]) < 1) {
                return;
            }
            let t = items.weapons[player.weapons[0]];
            if (UTILS.getDistance(e, player) - 68 < t.range) {
                chickenSocketHandler.send("meleeSync", e.sid, window.pingTime, chickenSocketHandler.pingTime, player.team);
            }
        }
    })();
    var instaManager = new (class {
        constructor() {
            this.onQueue = [];
            this.holdModeOT = false;
        }
        tickBase() {
            if (typeof this.onQueue[0] == "function") {
                this.onQueue[0]();
                this.onQueue.shift();
            }
        }
        addToQueue(e) {
            if (typeof e == "function") {
                this.onQueue.push(e);
            }
        }
        startInsta(e) {
            chicken.autoaim = e;
            if (e == "reverse") {
                hatSystem.storeEquip(53);
                chicken.preferedWeaponIndex = player.weapons[1];
                if (player.weaponIndex != chicken.preferedWeaponIndex) {
                    chicken.selectToBuild(chicken.preferedWeaponIndex, true);
                }
                chicken.sendAim(game.enemies.angle);
                chicken.sendAutoGather();
                this.addToQueue(() => {
                    hatSystem.storeEquip(7);
                    chicken.preferedWeaponIndex = player.weapons[0];
                    if (player.weaponIndex != chicken.preferedWeaponIndex) {
                        chicken.selectToBuild(chicken.preferedWeaponIndex, true);
                    }
                    chicken.sendAim(game.enemies.angle);
                });
                this.addToQueue(() => {
                    chicken.sendAutoGather();
                    chicken.autoaim = false;
                });
            } else {
                hatSystem.storeEquip(53);
                chicken.preferedWeaponIndex = player.weapons[0];
                if (player.weaponIndex != chicken.preferedWeaponIndex) {
                    chicken.selectToBuild(chicken.preferedWeaponIndex, true);
                }
                this.addToQueue(() => {
                    hatSystem.storeEquip(7);
                    chicken.sendAim(game.enemies.angle);
                    io.send("K", 1, 1);
                });
                this.addToQueue(() => {
                    chicken.autoaim = false;
                    io.send("K", 1, 1);
                });
            }
        }
        oneTickMovement() {
            let e = game.enemies.nearest;
            if (!e) {
                this.holdModeOT = false;
                return;
            }
            let t = game.enemies.angle;
            let i = UTILS.getDistance(e, player) - game.perfectOTDistance;
            let s = UTILS.getDistance(e, player.vel) - i;
            let n = Math.abs(i);
            if (player.weapons[1] == 10) {
                if (player.weaponIndex != 10) {
                    chicken.selectToBuild(10, true);
                }
                chicken.preferedWeaponIndex = 10;
            }
            if (n <= 25 && s < 0) {
                n = 5;
            }
            if (n <= 5) {
                if (e.skinindex != 6 && e.skinIndex != 22 && player.tailIndex != 11 && healer.reloadPercent(player, 53) == 1 && healer.reloadPercent(player, player.weapons[0]) == 1) {
                    this.startInsta("ot");
                    return t;
                } else {
                    hatSystem.storeEquip(chicken.checkHave(19, true), 1, true);
                    hatSystem.storeEquip(6, 0, true);
                    return "stop movement";
                }
            } else {
                if (n <= 20) {
                    if (n <= 10) {
                        hatSystem.storeEquip(chicken.checkHave(19, true), 1, true);
                    } else {
                        hatSystem.storeEquip(0, 1, true);
                    }
                    hatSystem.storeEquip(40, 0, true);
                } else {
                    hatSystem.storeEquip(n <= 35 ? chicken.checkHave(19, true) : 11, 1, true);
                    hatSystem.storeEquip(6, 0, true);
                }
                return t + (i > 0 ? 0 : Math.PI);
            }
        }
    })();
    var chicken = new (class {
        constructor() {
            this.rangeAddOnCache = {};
            this.chickenUsers = [];
            this.autoTriggerOneShot = false;
            this.aimAngle = 0;
            this.preferedWeaponIndex = 0;
            this.trapAim = 0;
            this.reloaded = false;
            this.autoaim = false;
            this.movementDirection = undefined;
            this.pushing = false;
            this.objBreakingTarget = undefined;
            this.autoBrakeGameTick = 0;
            this.onClick = {
                tank: false,
            };
            this.cursorLocation = {
                x: 0,
                y: 0,
            };
        }
        drawTracer(e) {
            if (!document.getElementById("enemyradar" + e.sid)) {
                let t = document.createElement("div");
                t.id = `enemyradar${e.sid}`;
                t.style = `
               display: none;
               position: absolute;
               left: 0;
               top: 0;
               color: #fff;
               width: 0;
               height: 0;
               border: solid;
               border-color: transparent transparent transparent #ffffff;
               `;
                document.body.appendChild(t);
            }
            let i = window.innerWidth / 2;
            let s = window.innerHeight / 2;
            let n = Math.atan2(e.y2 - camY, e.x2 - camX);
            let a = (Math.sqrt(Math.pow(0 - (camX - e.x2), 2) + Math.pow(0 - (camY - e.y2) * (16 / 9), 2)) * 100) / (maxScreenHeight / 2) / s;
            if (a > 1) {
                a = 1;
            }
            let l = i + s * a * Math.cos(n) - 10;
            let o = s + s * a * Math.sin(n) - 10;
            document.getElementById("enemyradar" + e.sid).style.borderWidth = "10px 0px 10px 20px";
            document.getElementById("enemyradar" + e.sid).style.pointerEvents = "none";
            document.getElementById("enemyradar" + e.sid).style.left = l + "px";
            document.getElementById("enemyradar" + e.sid).style.top = o + "px";
            document.getElementById("enemyradar" + e.sid).style.opacity = a;
            document.getElementById("enemyradar" + e.sid).style.transform = `rotate(${(n * 180) / Math.PI}deg)`;
            document.getElementById("enemyradar" + e.sid).style.display = player.team === null || player.team !== e.team ? "block" : "none";
        }
        doTurretParameters(e) {
            return e.layer >= 1;
        }
        canShoot(e, t, i = 1000000) {
            for (let s = 0; s < game.closeObjects.length; s++) {
                let n = game.closeObjects[s];
                if (n.sid != i && (i == 1000000 || this.doTurretParameters(n)) && !n.ignoreCollision && UTILS.intersectsLineCircle(e, t, n)) {
                    return false;
                }
            }
            return true;
        }
        setPlayerWeapons() {
            player.primaryWeapon = player.weapons[0];
            if (player.weapons[1]) {
                player.secondaryWeapon = player.weapons[1];
            }
        }
        sendHit(e, t) {
            io.send("F", e, t);
        }
        manageReloads() {
            if (!inWindow) {
                for (let e = 0; e < players.length; e++) {
                    let t = players[e];
                    t.manageReloads(Date.now() - game.lastTickUpdate, t.visible);
                }
            }
        }
        selectToBuild(e, t) {
            let i = botManager.playingAsData;
            if (i && i.socket.readyState == 1) {
                let s = 0;
                if (t) {
                    if (s == player.weapons[1]) {
                        s = 1;
                    }
                } else {
                    s = player.items.findIndex((t) => t == e);
                }
                botManager.sendToServer(i.socket, {
                    type: "packet",
                    sid: i.sid,
                    packetData: {
                        type: "z",
                        data: [s, t],
                    },
                });
            } else if (t) {
                io.send("z", e, true);
            } else {
                io.send("z", e);
            }
        }
        checkHave(e, t) {
            if (t) {
                if (player.tails[e]) {
                    return e;
                } else {
                    return 0;
                }
            } else if (player.skins[e]) {
                return e;
            } else {
                return 0;
            }
        }
        mouseAimDir() {
            if (player && (!this.autoaim || !game.enemies.nearest) && (!player.trapData || !player.trapData.active || !scriptMenu.toggles.inTrapBreak || (scriptMenu.toggles.bullSpamInTrap && attackState)) && (!this.spikeTickData || !this.spikeTickData.spiekTick) && !attackState && !this.objBreakingTarget) {
                return Math.atan2(mouseY - screenHeight / 2, mouseX - screenWidth / 2);
            }
        }
        getAttackDir(e, t) {
            if (t) {
                return Math.atan2(mouseY - screenHeight / 2, mouseX - screenWidth / 2);
            }
            if (!player) {
                return 0;
            }
            if ((this.autoaim || autoHit.reverseSpiketick) && game.enemies.nearest) {
                return game.enemies.angle;
            }
            if (player.trapData && player.trapData.active && scriptMenu.toggles.inTrapBreak && (!scriptMenu.toggles.bullSpamInTrap || !attackState)) {
                return this.trapAim;
            }
            if (attackState || autoHit.active) {
                if (game.enemies.nearest) {
                    return game.enemies.angle;
                } else {
                    return Math.atan2(mouseY - screenHeight / 2, mouseX - screenWidth / 2);
                }
            }
            if (this.objBreakingTarget) {
                return UTILS.getDirection(this.objBreakingTarget, player);
            } else if (!e || scriptMenu.toggles.autoGrind || this.onClick.tank || this.onClick.bull) {
                if (scriptMenu.toggles.autoGrind && typeof unxGrind.angle == "number") {
                    return unxGrind.angle;
                }
                return Math.atan2(mouseY - screenHeight / 2, mouseX - screenWidth / 2);
            }
        }
        checkTraps() {
            for (let e = 0; e < players.length; e++) {
                let t = players[e];
                if (t && t.visible && (!game.isAlly(t.sid) || game.isMine(t.sid))) {
                    let i;
                    i = t.sid == player.sid ? game.closeObjects.find((e) => e.active && e.trap && UTILS.getDistance(t, e) < 49 && !game.isFriendly(e.owner.sid)) : game.closeObjects.find((e) => e.active && e.trap && UTILS.getDistance(t, e) < 49 && e.owner.sid != t.sid);
                    t.lastTrapData = !!t.trapData;
                    if (i) {
                        if (player == t) {
                            hatSystem.trapSoldier = false;
                        }
                        t.trapData = i;
                        i.hideFromEnemy = false;
                    } else {
                        t.trapData = undefined;
                    }
                } else if (t) {
                    t.trapData = undefined;
                }
            }
        }
        autoSelect() {
            let e = player.weapons[0];
            let t = player.weapons[1];
            let i = healer.reloadPercent(player, player.weapons[0]);
            let s = healer.reloadPercent(player, player.weapons[1]);
            if (i < 1 && [4, 5].includes(e)) {
                this.reloaded = true;
                this.preferedWeaponIndex = e;
                if (player.weaponIndex != e) {
                    this.selectToBuild(e, 1);
                }
            } else if (s < 1) {
                this.reloaded = true;
                this.preferedWeaponIndex = t;
                if (player.weaponIndex != t) {
                    this.selectToBuild(t, 1);
                }
            } else if (i < 1) {
                this.reloaded = true;
                this.preferedWeaponIndex = e;
                if (player.weaponIndex != e) {
                    this.selectToBuild(e, 1);
                }
            } else if (this.reloaded) {
                this.reloaded = false;
                if (t == 10 && [4, 5].includes(e)) {
                    this.preferedWeaponIndex = t;
                    if (player.weaponIndex != t) {
                        this.selectToBuild(t, 1);
                    }
                } else {
                    this.preferedWeaponIndex = e;
                    if (player.weaponIndex != e) {
                        this.selectToBuild(e, 1);
                    }
                }
            }
        }
        equipBestBreakWeapon(e, t, i) {
            let s = player.weapons[1] == 10 ? 10 : player.weapons[0];
            if (e == "autobreak" && s == 10 && player.weapons[0] != 5 && healer.reloadPercent(player, player.weapons[0]) == 1 && (i || player.trapData).currentHealth - healer.calculateWeaponDamage(player.weapons[0], player.primaryVariant) <= 0) {
                s = player.weapons[0];
            }
            if (player.weaponIndex != s && !t) {
                this.selectToBuild(s, true);
            }
            return s;
        }
        doPathFind(e, { gridThing: t, moreTrash: i }) {
            let s = 10;
            let n = {
                x: Math.floor(Math.min(player.x2, e.x) / s) * s - s * 20,
                y: Math.floor(Math.min(player.y2, e.y) / s) * s - s * 20,
            };
            let a = {
                x: Math.floor(Math.max(player.x2, e.x) / s) * s + s * 20,
                y: Math.floor(Math.max(player.y2, e.y) / s) * s + s * 20,
            };
            let l = {
                x: a.x - n.x,
                y: a.y - n.y,
            };
            let o = {
                x: Math.ceil(l.x / s) / 2,
                y: Math.ceil(l.y / s) / 2,
            };
            let r = [];
            let c = game.closeObjects.filter((t) => t.active && UTILS.getDistance(UTILS.findMiddlePoint(player, e), t) <= 500);
            for (let d = 0; d < o.x; d++) {
                for (let p = 0; p < o.y; p++) {
                    let h = {
                        x: n.x + s * 2 * d,
                        y: n.y + s * 2 * p,
                    };
                    if (h.x > 35 && h.x < 14365 && h.y > 35 && h.y < 14365) {
                        r.push(new PathfindNode(h.x, h.y, c, i, e));
                    }
                }
            }
            let g = r.sort((e, t) => UTILS.getDistance(e, player) - UTILS.getDistance(t, player))[0];
            let $ = r.sort((t, i) => UTILS.getDistance(t, e) - UTILS.getDistance(i, e))[0];
            let m = [g];
            let u = [];
            let f = false;
            while (!f && m.length > 0) {
                let y = m[0];
                for (let x = 1; x < m.length; x++) {
                    let b = m[x];
                    if (b.fScore < y.fScore || (b.fScore === y.fScore && b.fScore < y.fScore)) {
                        y = b;
                    }
                }
                m = m.filter((e) => e !== y);
                u.push(y);
                if (y === $) {
                    f = true;
                    break;
                }
                let k = this.getNeighbors(y, r, c);
                for (let _ = 0; _ < k.length; _++) {
                    let v = k[_];
                    if (u.includes(v) || v.type === "wall") {
                        continue;
                    }
                    let w = y.gScore + 1;
                    let T = false;
                    if (m.includes(v)) {
                        if (w < v.gScore) {
                            T = true;
                        }
                    } else {
                        m.push(v);
                        T = true;
                    }
                    if (T) {
                        v.parent = y;
                        v.gScore = w;
                        v.hScore = UTILS.getDistance(v, $);
                        v.fScore = v.gScore + v.hScore;
                    }
                }
            }
            if (!f) {
                if (window.devTesting) {
                    chicken.grid = r;
                }
                if (t) {
                    return r;
                } else {
                    return undefined;
                }
            }
            {
                let S = [];
                let I = $;
                while (I !== g) {
                    S.unshift(I);
                    I.isPath = true;
                    I = I.parent;
                }
                S.unshift(g);
                if (window.devTesting) {
                    chicken.grid = r;
                }
                if (t) {
                    return r;
                } else {
                    return S;
                }
            }
        }
        getNeighbors(e, t, i) {
            let s = [];
            let n = [
                {
                    x: -1,
                    y: 0,
                },
                {
                    x: 1,
                    y: 0,
                },
                {
                    x: 0,
                    y: -1,
                },
                {
                    x: 0,
                    y: 1,
                },
                {
                    x: -1,
                    y: -1,
                },
                {
                    x: 1,
                    y: -1,
                },
                {
                    x: -1,
                    y: 1,
                },
                {
                    x: 1,
                    y: 1,
                },
            ];
            let a = 10;
            for (let l = 0; l < n.length; l++) {
                let o = n[l];
                let r = e.x + o.x * (a * 2);
                let c = e.y + o.y * (a * 2);
                let d = t.find((e) => e.x === r && e.y === c);
                if (d) {
                    if (d.type != "space" || d.isOk) {
                        s.push(d);
                    } else if (!i.find((e) => !e.trap && UTILS.getDistance(d, e) <= e.getScale() + 20)) {
                        s.push(d);
                    }
                }
            }
            return s;
        }
        autoPush() {
            if (!scriptMenu.toggles.autopush || keys[16]) {
                this.pushing = false;
                return;
            }
            let e = game.enemies.all.filter((e) => UTILS.getDistance(player, e) <= 250);
            let t;
            let i;
            let s = game.closeObjects.filter((e) => e.active && ((e.dmg && game.isFriendly(e.owner.sid)) || (e.type == 1 && e.y >= 12000)) && UTILS.getDistance(e, player) <= scriptMenu.toggles.autoPushDistance);
            for (let n = 0; n < e.length; n++) {
                let a = e[n];
                if (a && a.trapData && a.trapData.active) {
                    let l = s.filter((e) => UTILS.getDistance(e, a.trapData) <= 75 + e.getScale());
                    if (l.length) {
                        t = a;
                        i = l;
                        break;
                    }
                }
            }
            if (i && t) {
                let o = i.sort((e, t) => t.currentHealth - e.currentHealth).sort((e, i) => UTILS.getDistance(e, t) - UTILS.getDistance(i, t));
                if (i.length == 1) {
                    o = o[0];
                } else {
                    let r = o[0];
                    let c = o.filter((e) => (e.type != 1 || !(e.y >= 12000)) && e.sid != r.sid).sort((e, t) => UTILS.getDistance(e, r) - UTILS.getDistance(t, r))[0];
                    let d = UTILS.findMiddlePoint(r, c);
                    o =
                        UTILS.getDistance(d, r) <= 20 + r.getScale() && UTILS.getDistance(d, c) <= 20 + c.getScale()
                        ? {
                        x: d.x,
                        y: d.y,
                        scale: ((r.getScale() + c.getScale()) / 2) * 0.9,
                        double: true,
                    }
                    : o[0];
                }
                let p = o.type == 1 && o.y >= 12000;
                if (o) {
                    let h = UTILS.getDirection(t, o);
                    let g = UTILS.getDistance(o, t) + 72;
                    let $ = {
                        x: o.x + Math.cos(h) * g,
                        y: o.y + Math.sin(h) * g,
                    };
                    let m = o.scale + (p ? 64 : 96) - (o.double ? 10 : 0);
                    if (UTILS.getDistance($, player) <= 35) {
                        if ((g -= 18) <= m) {
                            g = m;
                        }
                        $ = {
                            x: o.x + Math.cos(h) * g,
                            y: o.y + Math.sin(h) * g,
                        };
                    }
                    if (game.closeObjects.find((e) => e.active && e.dmg && !game.isFriendly(e.owner.sid) && UTILS.getDistance(e, $) <= e.getScale() + 35)) {
                        this.pushing &&= false;
                        return;
                    }
                    if (UTILS.getDistance($, player) <= 35) {
                        this.pushing = {
                            first: $,
                            last: o,
                            dist: UTILS.getDistance(o, t),
                            ang: UTILS.getDirection(o, player),
                            victim: t,
                            scale: o.scale,
                        };
                        return UTILS.getDirection($, player);
                    }
                    {
                        let u = this.doPathFind($, {
                            moreTrash: UTILS.findMiddlePoint(o, t),
                        });
                        if (u && u.length > 1) {
                            this.pushing = {
                                first: $,
                                last: o,
                                path: u,
                                victim: t,
                                dist: UTILS.getDistance(o, t),
                                ang: UTILS.getDirection(o, player),
                                scale: o.scale,
                            };
                            return Math.atan2(u[1].y - u[0].y, u[1].x - u[0].x);
                        }
                        if (scriptMenu.toggles.pathfindOverride && UTILS.getDistance($, player) <= 175) {
                            this.pushing = {
                                first: $,
                                last: o,
                                dist: UTILS.getDistance(o, t),
                                ang: UTILS.getDirection(o, player),
                                victim: t,
                                scale: o.scale,
                            };
                            return Math.atan2($.y - player.y2, $.x - player.x2);
                        }
                    }
                    this.pushing &&= false;
                } else {
                    this.pushing &&= false;
                }
            } else {
                this.pushing &&= false;
            }
        }
        tickMovement(e) {
            if ((!keys[16] && player.trapData) || effectsManager.effects.find((e) => e.name == "freeze")) {
                return;
            }
            let t = false;
            if (!player.trapData && scriptMenu.toggles.autoBrake) {
                let i = UTILS.getDistance(player.vel, player) >= 4;
                let s = this.getPredictedDistance(typeof e == "number" ? e : lastMoveDir, i ? 2 : 1);
                if (s) {
                    let n = s.pos.obj;
                    if (n) {
                        let a = s.tmpPos[s.tmpPos.length - 1];
                        let l = s.tmpPos.length - 1;
                        let o = UTILS.getDistance(n, player) - (40 + n.scale);
                        if (o <= UTILS.getDistance(a, player)) {
                            l--;
                        }
                        if (window.pingTime >= 100) {
                            l--;
                        }
                        if (i) {
                            l--;
                        }
                        if (l <= 0) {
                            this.autoBrakeGameTick = game.tick;
                        } else {
                            this.autoBrakeGameTick = game.tick + l;
                        }
                        if (this.alreadyCanHit(n) || o <= 0) {
                            t = true;
                            this.autoBrakeGameTick = game.tick;
                        }
                    }
                }
            }
            if (e == "stop movement" || ((typeof e == "number" || typeof lastMoveDir == "number") && (t || this.autoBrakeGameTick == game.tick))) {
                if (this.movementDirection != "stop movement") {
                    this.movementDirection = "stop movement";
                    textManager.showText(player, 250, 35, 0, "#fff", "stop");
                    io.send("9", undefined);
                }
            } else if (typeof e == "number") {
                if (e != this.movementDirection) {
                    this.movementDirection = e;
                    io.send("9", e);
                }
            } else if (this.autoaim == "ot") {
                if (this.movementDirection != game.enemies.angle) {
                    this.movementDirection = game.enemies.angle;
                    io.send("9", game.enemies.angle);
                }
            } else if (this.movementDirection != lastMoveDir) {
                this.movementDirection = lastMoveDir;
                io.send("9", lastMoveDir);
            }
        }
        canAutoObjBreak() {
            if (!scriptMenu.toggles.outOfTrapBreak) {
                return false;
            }
            let e = this.equipBestBreakWeapon("", true);
            if (e != 10) {
                return;
            }
            let t = items.weapons[e].range;
            let i = game.closeObjects.filter((e) => e.active && (e.teleport || e.dmg || e.trap || e.boostSpeed) && !game.isFriendly(e.owner.sid) && UTILS.getDistance(e, player) - e.scale < t);
            let s = (i = i
                     .sort((e, t) => e.currentHealth - t.currenthealth)
                     .sort((e, t) => UTILS.getDistance(e, player) - UTILS.getDistance(t, player))
                     .sort((e, t) => (e.dmg && !t.dmg ? -1 : !e.dmg && t.dmg ? 1 : e.trap && !t.trap ? -1 : !e.trap && t.trap ? 1 : 0)))[0];
            if (s) {
                if (i.length > 1) {
                    let n = UTILS.getDirection(s, player);
                    for (let a = 1; a < i.length; a++) {
                        let l = i[a];
                        let o = UTILS.getDirection(l, player);
                        let r = UTILS.findMiddlePoint(l, s);
                        let c = UTILS.getDirection(r, player);
                        if (UTILS.getAngleDist(c, n) <= config.gatherAngle && UTILS.getAngleDist(c, o) <= config.gatherAngle) {
                            this.objBreakingTarget = {
                                sids: [s.sid, l.sid],
                                x: r.x,
                                y: r.y,
                                moreThanOneSpiek: true,
                            };
                            return true;
                        }
                    }
                }
                this.objBreakingTarget = {
                    sid: s.sid,
                    x: s.x,
                    y: s.y,
                };
                return true;
            }
            return false;
        }
        getPredictedDistance(e, t = 1) {
            if (typeof e != "number") {
                return false;
            }
            let i = config.serverUpdateSpeed;
            let s = items.weapons[player.weaponIndex];
            let n = hats.find((e) => e.id == player.skinIndex);
            let a = accessories.find((e) => e.id == player.tailIndex);
            let l = (player.buildIndex >= 0 ? 0.5 : 1) * (s.spdMult || 1) * ((n && n.spdMult) || 1) * ((a && a.spdMult) || 1) * (player.y2 <= config.snowBiomeTop ? (n && n.coldM ? 1 : config.snowSpeed) : 1);
            let o = {
                x: player.x2,
                y: player.y2,
            };
            let r = {
                x: 0,
                y: 0,
            };
            let c = Math.cos(e);
            let d = Math.sin(e);
            let p = Math.sqrt(c * c + d * d);
            if (p != 0) {
                c /= p;
                d /= p;
            }
            r.x += c * player.speed * l * i;
            r.y += d * player.speed * l * i;
            t--;
            let h = [];
            while ((r.x != 0 || r.y != 0) && !isNaN(r.x) && !isNaN(r.y)) {
                let g = Math.min(
                    4,
                    Math.max(
                        1,
                        Math.round(
                            UTILS.getDistance(
                                {
                                    x: 0,
                                    y: 0,
                                },
                                {
                                    x: r.x * i,
                                    y: r.y * i,
                                },
                            ) / 40,
                        ),
                    ),
                );
                let $ = 1 / g;
                for (let m = 0; m < g; m++) {
                    if (r.x) {
                        o.x += r.x * i * $;
                    }
                    if (r.y) {
                        o.y += r.y * i * $;
                    }
                    let u = game.closeObjects.find((e) => e.active && (e.teleport || !e.ignoreCollision) && UTILS.getDistance(e, o) <= e.getScale() + 35);
                    if (u) {
                        if (u.teleport || (u.dmg && !game.isFriendly(u.owner.sid))) {
                            o.obj = u;
                            r.x = 0;
                            r.y = 0;
                            break;
                        }
                        let f = u.getScale() + 35;
                        let y = UTILS.getDirection(o, u);
                        o.x = u.x + f * Math.cos(y);
                        o.y = u.y + f * Math.sin(y);
                        r.x *= 0.75;
                        r.y *= 0.75;
                    }
                }
                h.push({
                    x: o.x,
                    y: o.y,
                });
                if (r.x) {
                    r.x *= Math.pow(config.playerDecel, i);
                    if (r.x <= 0.01 && r.x >= -0.01) {
                        r.x = 0;
                    }
                }
                if (r.y) {
                    r.y *= Math.pow(config.playerDecel, i);
                    if (r.y <= 0.01 && r.y >= -0.01) {
                        r.y = 0;
                    }
                }
                if (t > 0) {
                    r.x += c * player.speed * l * i;
                    r.y += d * player.speed * l * i;
                    t--;
                }
            }
            return {
                tmpPos: h,
                pos: o,
            };
        }
        getNextTickRangeAddOn(e, t) {
            let i = this.rangeAddOnCache[e + ":" + t];
            if (!i) {
                let s = hats.find((t) => t.id == e);
                let n = accessories.find((e) => e.id == t);
                let a = player.weaponIndex;
                let l = (items.weapons[a].spdMult || 1) * ((s && s.spdMult) || 1) * ((n && n.spdMult) || 1);
                i = this.rangeAddOnCache[e + ":" + t] = (config.serverUpdateSpeed / 2) * l;
            }
            return i || 0;
        }
        alreadyCanHit(e) {
            let t = this.equipBestBreakWeapon("", true);
            let i = items.weapons[t].range;
            let s = this.getNextTickRangeAddOn(player.skinIndex, player.tailIndex);
            return UTILS.getDistance(e, player) - e.scale < i + s;
        }
        sendAim(e) {
            let t = botManager.playingAsData;
            if (t && t.socket.readyState == 1) {
                botManager.sendToServer(t.socket, {
                    type: "packet",
                    sid: t.sid,
                    packetData: {
                        type: "D",
                        data: [e],
                    },
                });
            } else {
                io.send("D", e);
            }
        }
        sendAutoGather() {
            let e = botManager.playingAsData;
            if (e && e.socket.readyState == 1) {
                botManager.sendToServer(e.socket, {
                    type: "packet",
                    sid: e.sid,
                    packetData: {
                        type: "K",
                        data: [1],
                    },
                });
            } else {
                io.send("K", 1, 1);
            }
        }
        sendHitOnce(e) {
            this.sendAutoGather();
            if (e) {
                game.tickOut(() => {
                    this.sendAutoGather();
                }, 2);
            } else {
                game.nextTick(() => {
                    this.sendAutoGather();
                });
            }
        }
        healthToHits(e, t) {
            let i = items.weapons[t];
            let s = i.projectile == null ? i.dmg : 0;
            let n;
            return Math.ceil(e / (s * (config.weaponVariants[player.weaponVariant]?.val || 1) * (i.sDmg || 1) * (player.skins[40] ? 3.3 : 1)));
        }
        bullHit() {
            this.preferedWeaponIndex = player.weapons[0];
            if (player.weaponIndex != player.weapons[0]) {
                this.selectToBuild(player.weapons[0], true);
            }
            if (healer.reloadPercent(player, player.weapons[0]) == 1) {
                if (this.pushing || player.weapons[0] != 7) {
                    hatSystem.storeEquip(7, 0, true);
                } else {
                    hatSystem.storeEquip(this.checkHave(19, true), 1, true);
                }
                this.sendHitOnce();
                placer.preplace();
            } else {
                let e = () => {
                    if (player.skins[53] && this.pushing && this.pushing.dist <= 90 && healer.reloadPercent(player, 53) == 1) {
                        hatSystem.storeEquip(53, 0, true);
                    } else {
                        hatSystem.doBasicFunction(true);
                    }
                };
                if (player.weapons[0] == 7 && player.tailIndex != 11) {
                    e();
                } else if (player.weapons[0] != 7) {
                    e();
                }
                if (!this.pushing && player.weapons[0] == 7) {
                    hatSystem.storeEquip(11, 1, true);
                }
            }
            if (!!this.pushing || player.weapons[0] != 7) {
                hatSystem.storeEquip(this.checkHave(19, true), 1, true);
            }
        }
        replaceable(e) {
            let t = Math.PI;
            let i = Math.PI / 12;
            let s = items.list[15].scale + 30;
            for (let n = 0; n < game.enemies.near.length; n++) {
                let a = game.enemies.near[n];
                if (a && UTILS.getDistance(a, player) <= 160) {
                    for (let l = 0; l <= t; l += i) {
                        let o = placer.calculatePosition(a, s, l);
                        if (objectManager.checkItemLocation(o.x, o.y, 52, 0.6, false, false, e) || ((o = placer.calculatePosition(a, s, l + t)), objectManager.checkItemLocation(o.x, o.y, 52, 0.6, false, false, e))) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }
        manageTickBase() {
            if (inGame) {
                this.setPlayerWeapons();
                autoHit.resetActivity();
                let e = this.autoPush();
                if (typeof e != "number" && scriptMenu.toggles.autoPlay) {
                    try {
                        e = unxAutoPlay.dir();
                    } catch (autoPlayError) {
                        console.error("[unx] auto play failed, leaving movement alone", autoPlayError);
                    }
                }
                this.objBreakingTarget = undefined;
                placer.tickBase();
                instaManager.tickBase();
                if (autoHit.reverseSpiketick && this.autoaim != "bullhit") {
                    this.autoaim = false;
                    this.sendAutoGather();
                }
                let t = autoHit.checkForReverseSpiketick();
                let hit = healer.interpretDamage();
                let en = game.enemies.nearest;
                if (en && !player.trapData) {
                    let awqw = game.closeObjects.filter((e) => e.active && e.dmg && !game.isFriendly(e.owner.sid));
                    awqw.forEach((e) => {
                        if (UTILS.getDistance(player.vel, en.vel) <= items.weapons[en.primaryWeapon].range + en.scale * 1.3) {
                            let kbPos = kbSimulator.meleeKB(player.vel, UTILS.getDirection(player, en), en.primaryWeapon, en.secondaryWeapon);
                            let kbEnd = {
                                x: kbPos.x + (kbPos.x - player.vel.x) * 0.15,
                                y: kbPos.y + (kbPos.y - player.vel.y) * 0.15
                            };
                            let combinedRadius = player.scale + e.scale;
                            let destCollision = UTILS.getDistance(kbEnd, e) <= combinedRadius;
                            let pathCollision = UTILS.intersectsLineCircle(player.vel, kbEnd, { x: e.x, y: e.y, scale: combinedRadius });
                            if (destCollision || pathCollision) {
                                !hit.spike && (hit.spike = true);
                                hit.potDamage < 100 && (hit.potDamage = 124);
                                console.log("predictive spike detected");
                                player.skinIndex != 6 && hatSystem.addForcedAddOnValue(hatSystem.forceAddIndexs.trapSoldier, 3);
                            }
                        }
                    });
                }


                if (this.autoaim);
                else if (player.trapData && scriptMenu.toggles.inTrapBreak && (!scriptMenu.toggles.bullSpamInTrap || !attackState)) {
                    let i = this.equipBestBreakWeapon("autobreak", true);
                    let s = items.weapons[i];
                    let n = UTILS.getDistance(player.vel, player) >= 2 ? 4 : 0;
                    let a = game.closeObjects.filter((e) => e.active && e.dmg && !game.isFriendly(e.owner.sid) && UTILS.getDistance(e, player) - e.scale <= s.range + n);
                    let l = (a = a.sort((e, t) => UTILS.getDistance(e, player) - UTILS.getDistance(t, player)).sort((e, t) => e.currentHealth - t.currentHealth))[0];
                    if (keys[16]) {
                        l = undefined;
                    }
                    if (l && this.healthToHits(player.trapData.currentHealth, i) < this.healthToHits(l.currentHealth, i) && !this.replaceable(player.trapData)) {
                        l = undefined;
                    }
                    if (l) {
                        let o = UTILS.getDirection(l, player);
                        for (let r = 1; r < a.length; r++) {
                            let c = a[r];
                            let d = UTILS.getDirection(c, player);
                            let p = UTILS.findMiddlePoint(c, l);
                            let h = UTILS.getDirection(p, player);
                            if (UTILS.getAngleDist(h, o) <= config.gatherAngle && UTILS.getAngleDist(h, d) <= config.gatherAngle) {
                                l = {
                                    x: p.x,
                                    y: p.y,
                                    currentHealth: Math.max(c.currentHealth, l.currentHealth),
                                };
                                break;
                            }
                        }
                    }
                    game.enemies.nearest && UTILS.getDistance(player, game.enemies.nearest) <= items.weapons[game.enemies.nearest.weaponIndex].range + 35 && healer.doAntiInstaSpikeTick();
                    i = this.equipBestBreakWeapon("autobreak", false, l);
                    this.preferedWeaponIndex = i;
                    this.trapAim = UTILS.getDirection(l || player.trapData, player);
                    if (healer.reloadPercent(player, i) == 1) {
                        hatSystem.storeEquip(40, 0, true);
                        this.sendHitOnce();
                        placer.preplace();
                    } else {
                        hatSystem.doBasicFunction(true);
                    }
                    if (![7, 8, 6].includes(player.weapons[0])) {
                        hatSystem.storeEquip(this.checkHave(19, true), 1, true);
                    }
                } else {
                    let g = autoHit.autoInsta();
                    let $ = autoHit.autoHit();
                    if (!$ && !g && !t) {
                        autoHit.meleeSync();
                    }
                    if (t) {
                        chicken.autoaim = true;
                        autoHit.reverseSpiketick = true;
                        this.preferedWeaponIndex = 10;
                        if (player.weaponIndex != this.preferedWeaponIndex) {
                            this.selectToBuild(this.preferedWeaponIndex, true);
                        }
                        hatSystem.storeEquip(40, 0, true);
                        this.sendAutoGather();
                        placer.preplace();
                    } else if ($) {
                        this.bullHit();
                    } else if (g) {
                        instaManager.startInsta(g);
                    } else if (instaManager.holdModeOT && typeof e != "number") {
                        e = instaManager.oneTickMovement();
                    } else if (scriptMenu.toggles.autoGrind && unxGrind.tick(this)) {
                        hatSystem.storeEquip(11, 1, true);
                    } else if (this.onClick.tank) {
                        let u = this.equipBestBreakWeapon();
                        this.preferedWeaponIndex = u;
                        if (healer.reloadPercent(player, u) == 1) {
                            hatSystem.storeEquip(40, 0, true);
                            this.sendHitOnce();
                            placer.preplace();
                        } else if (player.skins[53] && chicken.pushing && chicken.pushing.dist <= 90 && healer.reloadPercent(player, 53) == 1) {
                            hatSystem.storeEquip(53, 0, true);
                        } else {
                            hatSystem.doBasicFunction(true);
                        }
                    } else if (attackState || this.onClick.bull) {
                        this.bullHit();
                        placer.preplace();
                    } else if (this.canAutoObjBreak() && (scriptMenu.toggles.ignoreSoldierWhenBreakingOutOfTrap || !hatSystem.velSoldier)) {
                        let f = this.equipBestBreakWeapon("");
                        this.preferedWeaponIndex = f;
                        if (healer.reloadPercent(player, f) == 1) {
                            hatSystem.storeEquip(40, 0, true);
                            this.sendHitOnce();
                            placer.preplace();
                        } else {
                            hatSystem.doBasicFunction();
                        }
                    } else {
                        this.autoSelect();
                        hatSystem.doBasicFunction();
                    }
                }
                let y = this.getAttackDir(true);
                if (typeof y == "number") {
                    this.sendAim(y);
                }
                this.tickMovement(e);
            }
        }
        manageBuildingBreak(e) {
            if (UTILS.getDistance(player, e) <= 300 && inGame) {
                healer.doAntiSpiketick(e);
                e.currentHealth = 0;
                game.nextTick(() => {
                    placer.replace(e);
                });
            }
            deathAnimationHandler.addObject(e);
        }
    })();
    function doPlayerUpdates(e) {
        let t = Date.now();
        for (let i = 0; i < players.length; i++) {
            players[i].forcePos = !players[i].visible;
            players[i].visible = false;
            if (document.getElementById("enemyradar" + players[i].sid)) {
                document.getElementById("enemyradar" + players[i].sid).style.display = "none";
            }
        }
        for (let s = 0; s < e.length; ) {
            let n = findPlayerBySID(e[s]);
            if (n) {
                n.t1 = n.t2 === undefined ? t : n.t2;
                n.t2 = t;
                n.x1 = n.x;
                n.y1 = n.y;
                n.lastX = n.x2 || 0;
                n.lastY = n.y2 || 0;
                n.x2 = e[s + 1];
                n.y2 = e[s + 2];
                n.vel = {
                    x: n.x2 * 2 - n.lastX,
                    y: n.y2 * 2 - n.lastY,
                };
                n.d1 = n.d2 === undefined ? e[s + 3] : n.d2;
                n.d2 = e[s + 3];
                n.dt = 0;
                n.buildIndex = e[s + 4];
                n.weaponIndex = e[s + 5];
                n.weaponVariant = e[s + 6];
                n.team = e[s + 7];
                n.isLeader = e[s + 8];
                n.skinIndex = e[s + 9];
                n.tailIndex = e[s + 10];
                n.iconIndex = e[s + 11];
                n.zIndex = e[s + 12];
                n.visible = true;
                if (player == n || game.isAlly(n.sid)) {
                    if (player == n && n.skinIndex == 45 && !effectsManager.effects.find((e) => e.name == "shame!")) {
                        effectsManager.addEffect("shame!", 30000 - game.tickSpeed, "https://i.imgur.com/ryNqa5q.png");
                    }
                } else {
                    if (n.skinIndex > 0) {
                        n.skins[n.skinIndex] = 1;
                    }
                    if (n.tailIndex > 0) {
                        n.tails[n.tailIndex] = 1;
                    }
                    if (n.weaponIndex < 9 && n.primaryWeapon != 4 && n.secondaryWeapon != 13 && n.secondaryWeapon != 10 && n.secondaryWeapon != 14 && n.secondaryWeapon != 15 && n.spikeType.id != 9) {
                        n.secondaryWeapon = 15;
                        n.reloads[15] = 0;
                        n.secondaryVariant = 0;
                    }
                    game.enemies.all.push(n);
                    if (UTILS.getDistance(n, player) - 100 <= items.weapons[n.primaryWeapon].range) {
                        game.enemies.near.push(n);
                    }
                    chicken.drawTracer(n);
                }
            }
            s += 13;
        }
    }

    function updatePlayers(e) {
        if (!botManager.playingAsData) {
            game.gameTick();
            doPlayerUpdates(e);
            game.closeObjects = gameObjects.filter((e) => e.active && UTILS.getDistance(e, player) <= 1000);
            chicken.manageReloads();
            game.tickSpeed = Date.now() - game.lastTickUpdate;
            game.lastTickUpdate = Date.now();
            placer.mills();
            game.updateEnemies();
            game.manageTickBase();
            chicken.manageTickBase();
            game.buildingsHit = [];
            for (let t = 0; t < game.enemies.all.length; t++) {
                game.enemies.all[t].damages = [];
            }
        }
        botManager.updateBots();
    }
    function findPlayerByID(e) {
        for (var t = 0; t < players.length; ++t) {
            if (players[t].id == e) {
                return players[t];
            }
        }
        return null;
    }
    function findPlayerBySID(e) {
        for (let t = 0; t < players.length; t++) {
            if (players[t].sid == e) {
                return players[t];
            }
        }
        return null;
    }
    function findAIBySID(e) {
        for (var t = 0; t < ais.length; ++t) {
            if (ais[t].sid == e) {
                return ais[t];
            }
        }
        return null;
    }
    function findObjectBySid(e) {
        for (var t = 0; t < gameObjects.length; ++t) {
            if (gameObjects[t].sid == e) {
                return gameObjects[t];
            }
        }
        return null;
    }
    function pingSocketResponse() {
        let e = Date.now() - lastPingSocket;
        if (player && e - window.pingTime >= 40 && e >= 90) {
            textManager.showText(player, 1000, 25, 0, "#f00", "Ping Spike");
        }
        window.pingTime = e;
    }
    function loadGameObject(e) {
        for (let t = 0; t < e.length; ) {
            objectManager.add(
                e[t],
                e[t + 1],
                e[t + 2],
                e[t + 3],
                e[t + 4],
                e[t + 5],
                items.list[e[t + 6]],
                true,
                e[t + 7] >= 0
                ? {
                    sid: e[t + 7],
                }
                : null,
            );
            let i = gameObjects.find((i) => i.sid == e[t]);
            let s = e[t + 6];
            let n = e[t + 7];
            let a = game.isFriendly(n);
            if (s == 15 && !a) {
                i.hideFromEnemy = false;
            }
            if (items.list[s] && items.list[s].dmg && !a) {
                let l = findPlayerBySID(n);
                if (l && e[t] > l.spikeType.sid) {
                    l.spikeType.sid = e[t];
                    l.spikeType.id = s;
                }
            }
            t += 8;
        }
    }
    function wiggleGameObject(e, t) {
        if ((tmpObj = findObjectBySid(t))) {
            tmpObj.xWiggle += config.gatherWiggle * Math.cos(e);
            tmpObj.yWiggle += config.gatherWiggle * Math.sin(e);
            if (tmpObj.currentHealth) {
                game.buildingsHit.push(tmpObj);
            }
        }
    }
    function shootTurret(e, t) {
        if ((tmpObj = findObjectBySid(e))) {
            tmpObj.dir = t;
            tmpObj.xWiggle += config.gatherWiggle * Math.cos(t + Math.PI);
            tmpObj.yWiggle += config.gatherWiggle * Math.sin(t + Math.PI);
            tmpObj.turretReload = 2200;
        }
    }
    var inWindow = true;
    function addProjectile(e, t, i, s, n, a, l, o) {
        let r = {
            x: e - Math.cos(i) * 70,
            y: t - Math.sin(i) * 70,
        };
        let c = {
            x: e,
            y: t,
        };
        let d;
        let p = false;
        for (let h = 0; h < players.length; h++) {
            let g = players[h];
            if (g.visible) {
                let $ = items.weapons[g.secondaryWeapon];
                if (
                    n == 1.5 &&
                    (UTILS.getDistance(g, c) <= 35 ||
                     UTILS.getDistance(
                        {
                            x: g.x,
                            y: g.y,
                        },
                        c,
                    ) <= 35)
                ) {
                    d = g;
                    p = true;
                    break;
                }
                if ($ && $.projectile !== null && UTILS.getDistance(g, r) <= 35) {
                    d = g;
                    break;
                }
            }
        }
        if (d) {
            let m = UTILS.getDistance(c, player);
            let u = UTILS.getDirection(player, c);
            if (p) {
                d.reloads[53] = 2500;
                d.turretHit = game.tick;
                let f = items.weapons[d.primaryWeapon];
                if (healer.checkIfUserCanOnetick(d) && UTILS.getAngleDist(i, u) <= 0.2 && UTILS.getDistance(d, player) - 95 <= f.range) {
                    hatSystem.addForcedAddOnValue(hatSystem.forceAddIndexs.otSoldier, 3);
                }
                if (UTILS.getAngleDist(i, u) <= 0.18) {
                    healer.addProjectile(d, 25, Math.ceil(Math.min(m, s) / 1.5));
                }
            } else {
                let y = n == 1.6 ? 9 : n == 2.5 ? 12 : n == 2 ? 13 : 15;
                let x = items.weapons[y];
                d.reloads[y] = x.speed;
                d.secondaryWeapon = y;
                d.secondaryHit = game.tick;
                if (UTILS.getAngleDist(i, u) <= 0.18) {
                    healer.addProjectile(d, x.dmg, Math.ceil(Math.min(m, s) / n));
                }
            }
        }
        if (inWindow) {
            projectileManager.addProjectile(
                e,
                t,
                i,
                s,
                n,
                a,
                d
                ? {
                    sid: d.sid,
                }
                : null,
                null,
                l,
            ).sid = o;
        }
    }
    function remProjectile(e, t) {
        for (var i = 0; i < projectiles.length; ++i) {
            if (projectiles[i].sid == e) {
                projectiles[i].range = t;
                let s = projectiles[i].dmg;
                let n = game.buildingsHit;
                game.buildingsHit = [];
                game.nextTick(() => {
                    for (let e = 0; e < n.length; e++) {
                        let t = n[e];
                        if (t && t.projDmg) {
                            t.currentHealth -= s;
                            t.lastHitTime = Date.now();
                            if (scriptMenu.toggles.renderBuildingDamage) {
                                renderBuildingDmgText(s, "player", tmpObj, t);
                            }
                        }
                    }
                });
            }
        }
    }
    function animateAI(e) {
        let t = findAIBySID(e);
        if (t && (t.startAnim(), t.name == "MOOSTAFA")) {
            let i = game.buildingsHit;
            game.buildingsHit = [];
            game.nextTick(() => {
                for (let e = 0; e < i.length; e++) {
                    let s = i[e];
                    if (s) {
                        s.lastHitTime = Date.now();
                        s.currentHealth -= 232;
                        if (scriptMenu.toggles.renderBuildingDamage) {
                            renderBuildingDmgText(232, "AI", t, s);
                        }
                    }
                }
            });
        }
    }
    function loadAI(e) {
        for (var t = 0; t < ais.length; ++t) {
            ais[t].forcePos = !ais[t].visible;
            ais[t].visible = false;
        }
        if (e) {
            for (let t = 0, i = Date.now(); t < e.length; ) {
                let s = findAIBySID(e[t]);
                if (s) {
                    s.index = e[t + 1];
                    s.t1 = s.t2 === undefined ? i : s.t2;
                    s.t2 = i;
                    s.x1 = s.x;
                    s.y1 = s.y;
                    s.x2 = e[t + 2];
                    s.y2 = e[t + 3];
                    s.d1 = s.d2 === undefined ? e[t + 4] : s.d2;
                    s.d2 = e[t + 4];
                    s.health = e[t + 5];
                    s.dt = 0;
                    s.visible = true;
                } else {
                    (s = aiManager.spawn(e[t + 2], e[t + 3], e[t + 4], e[t + 1])).x2 = s.x;
                    s.y2 = s.y;
                    s.d2 = s.dir;
                    s.health = e[t + 5];
                    if (!aiManager.aiTypes[e[t + 1]].name) {
                        s.name = config.cowNames[e[t + 6]];
                    }
                    s.forcePos = true;
                    s.sid = e[t];
                    s.visible = true;
                }
                t += 7;
            }
        }
    }
    function removePlayer(e) {
        for (let t = 0; t < players.length; t++) {
            let i = players[t];
            if (i.id == e) {
                scriptMenu.addLog("left", "", i.name, i.sid);
                if (document.getElementById("enemyradar" + i.sid)) {
                    document.getElementById("enemyradar" + i.sid).remove();
                }
                players.splice(t, 1);
                break;
            }
        }
    }
    function updateItems(e, t) {
        if (e) {
            if (t) {
                let i = player.weapons.findIndex((e) => chicken.preferedWeaponIndex == e);
                player.weapons = e;
                chicken.preferedWeaponIndex = player.weapons[i];
            } else {
                player.items = e;
            }
        }
        for (let s = 0; s < items.list.length; ++s) {
            let n = items.weapons.length + s;
            document.getElementById("actionBarItem" + n).style.display = player.items.indexOf(items.list[s].id) >= 0 ? "inline-block" : "none";
        }
        for (let a = 0; a < items.weapons.length; ++a) {
            document.getElementById("actionBarItem" + a).style.display = player.weapons[items.weapons[a].type] == items.weapons[a].id ? "inline-block" : "none";
        }
    }
    function showItemInfo(e, t, i) {
        if (player && e) {
            UTILS.removeAllChildren(itemInfoHolder);
            itemInfoHolder.classList.add("visible");
            UTILS.generateElement({
                id: "itemInfoName",
                text: UTILS.capitalizeFirst(e.name),
                parent: itemInfoHolder,
            });
            UTILS.generateElement({
                id: "itemInfoDesc",
                text: e.desc,
                parent: itemInfoHolder,
            });
            if (i);
            else if (t) {
                UTILS.generateElement({
                    class: "itemInfoReq",
                    text: e.type ? "secondary" : "primary",
                    parent: itemInfoHolder,
                });
            } else {
                for (var s = 0; s < e.req.length; s += 2) {
                    UTILS.generateElement({
                        class: "itemInfoReq",
                        html: e.req[s] + "<span class='itemInfoReqVal'> x" + e.req[s + 1] + "</span>",
                        parent: itemInfoHolder,
                    });
                }
                if (e.group.limit) {
                    UTILS.generateElement({
                        class: "itemInfoLmt",
                        text: (player.itemCounts[e.group.id] || 0) + "/" + ((isSandbox && e.group.sandboxLimit) || e.group.limit),
                        parent: itemInfoHolder,
                    });
                }
            }
        } else {
            itemInfoHolder.classList.remove("visible");
        }
    }
    function updateUpgrades(e, t) {
        let i = [];
        player.upgradePoints = e;
        player.upgrAge = t;
        if (e > 0) {
            UTILS.removeAllChildren(upgradeHolder);
            for (let s = 0; s < items.weapons.length; s++) {
                let n = items.weapons[s];
                if (n.age == t && (n.pre == undefined || player.weapons.indexOf(n.pre) >= 0)) {
                    UTILS.generateElement({
                        id: "upgradeItem" + s,
                        class: "actionBarItem",
                        onmouseout: function () {
                            showItemInfo();
                        },
                        parent: upgradeHolder,
                    }).style.backgroundImage = document.getElementById("actionBarItem" + s).style.backgroundImage;
                    i.push(s);
                }
            }
            for (let a = 0; a < items.list.length; a++) {
                if (items.list[a].age == t) {
                    let l = items.weapons.length + a;
                    UTILS.generateElement({
                        id: "upgradeItem" + l,
                        class: "actionBarItem",
                        onmouseout: function () {
                            showItemInfo();
                        },
                        parent: upgradeHolder,
                    }).style.backgroundImage = document.getElementById("actionBarItem" + l).style.backgroundImage;
                    i.push(l);
                }
            }
            for (let o = 0; o < i.length; o++) {
                let r = i[o];
                let c = document.getElementById("upgradeItem" + r);
                c.onmouseover = function () {
                    if (items.weapons[r]) {
                        showItemInfo(items.weapons[r], true);
                    } else {
                        showItemInfo(items.list[r - items.weapons.length]);
                    }
                };
                c.onclick = UTILS.checkTrusted(function () {
                    sendUpgrade(r);
                });
                if (scriptMenu.toggles.autoUpgrade) {
                    let d = false;
                    let p = parseInt(scriptMenu.toggles["7thSlot"]);
                    if (i.length == 1) {
                        sendUpgrade(r);
                    } else if (["17", "31", "23", p].find((e) => c.id.includes(e))) {
                        sendUpgrade(r);
                    }
                    if (d) {
                        break;
                    }
                }
                UTILS.hookTouchEvents(c);
            }
            if (i.length) {
                upgradeHolder.style.display = "block";
                upgradeCounter.style.display = "block";
                upgradeCounter.innerHTML = "SELECT ITEMS (" + Math.min(e, 8) + ")";
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
    function sendUpgrade(e) {
        io.send("H", e);
    }
    function updateStoreItems(e, t, i) {
        if (i) {
            if (e) {
                player.tailIndex = t;
            } else {
                player.tails[t] = 1;
            }
        } else if (e) {
            player.skinIndex = t;
        } else {
            player.skins[t] = 1;
        }
        if (game.shopList.length) {
            game.autoBuy(player.points);
        }
        if (storeMenu.style.display == "block") {
            generateStoreList();
        }
    }
    function createAlliance() {
        io.send("L", document.getElementById("allianceInput").value);
    }
    function generateStoreList() {
        if (player) {
            UTILS.removeAllChildren(storeHolder);
            var e = currentStoreIndex;
            for (var t = e ? accessories : hats, i = 0; i < t.length; ++i) {
                if (!t[i].dontSell) {
                    (function (i) {
                        var s = UTILS.generateElement({
                            id: "storeDisplay" + i,
                            class: "storeItem",
                            onmouseout: function () {
                                showItemInfo();
                            },
                            onmouseover: function () {
                                showItemInfo(t[i], false, true);
                            },
                            parent: storeHolder,
                        });
                        UTILS.hookTouchEvents(s, true);
                        UTILS.generateElement({
                            tag: "img",
                            class: "hatPreview",
                            src: "../img/" + (e ? "accessories/access_" : "hats/hat_") + t[i].id + (t[i].topSprite ? "_p" : "") + ".png",
                            parent: s,
                        });
                        UTILS.generateElement({
                            tag: "span",
                            text: t[i].name,
                            parent: s,
                        });
                        if (e ? player.tails[t[i].id] : player.skins[t[i].id]) {
                            if ((e ? player.tailIndex : player.skinIndex) == t[i].id) {
                                UTILS.generateElement({
                                    class: "joinAlBtn",
                                    style: "margin-top: 5px",
                                    text: "Unequip",
                                    onclick: function () {
                                        hatSystem.storeEquip(0, e);
                                    },
                                    hookTouch: true,
                                    parent: s,
                                });
                            } else {
                                UTILS.generateElement({
                                    class: "joinAlBtn",
                                    style: "margin-top: 5px",
                                    text: "Equip",
                                    onclick: function () {
                                        hatSystem.storeEquip(t[i].id, e);
                                    },
                                    hookTouch: true,
                                    parent: s,
                                });
                            }
                        } else {
                            UTILS.generateElement({
                                class: "joinAlBtn",
                                style: "margin-top: 5px",
                                text: "Buy",
                                onclick: function () {
                                    hatSystem.storeBuy(t[i].id, e);
                                },
                                hookTouch: true,
                                parent: s,
                            });
                            UTILS.generateElement({
                                tag: "span",
                                class: "itemPrice",
                                text: t[i].price,
                                parent: s,
                            });
                        }
                    })(i);
                }
            }
        }
    }
    function addAlliance(e) {
        alliances.push(e);
        if (allianceMenu.style.display == "block") {
            showAllianceMenu();
        }
    }
    window.onblur = function () {
        inWindow = false;
    };
    window.onfocus = function () {
        inWindow = true;
        if (player && player.alive) {
            resetMoveDir();
            for (let e = 0; e < players.length; e++) {
                players[e].resetReloads();
            }
        }
    };
    var allianceNotifications = [];
    var alliancePlayers = [];
    function updateNotifications() {
        if (allianceNotifications[0]) {
            var e = allianceNotifications[0];
            UTILS.removeAllChildren(noticationDisplay);
            noticationDisplay.style.display = "block";
            let t = chicken.chickenUsers.find((t) => t.sid == e.sid);
            UTILS.generateElement({
                class: "notificationText",
                html: `${e.name}${t ? ` <span style="color: #f00;">(${t.name})</span>` : ""} {${e.sid}}`,
                parent: noticationDisplay,
            });
            UTILS.generateElement({
                class: "notifButton",
                html: "<i class='material-icons' style='font-size:28px;color:#cc5151;'>&#xE14C;</i>",
                parent: noticationDisplay,
                onclick: function () {
                    aJoinReq(0);
                },
                hookTouch: true,
            });
            UTILS.generateElement({
                class: "notifButton",
                html: "<i class='material-icons' style='font-size:28px;color:#8ecc51;'>&#xE876;</i>",
                parent: noticationDisplay,
                onclick: function () {
                    aJoinReq(1);
                },
                hookTouch: true,
            });
        } else {
            noticationDisplay.style.display = "none";
        }
    }
    function allianceNotification(e, t) {
        allianceNotifications.push({
            sid: e,
            name: t,
        });
        updateNotifications();
    }
    function setPlayerTeam(e, t) {
        if (player) {
            player.team = e;
            player.isOwner = t;
            if (allianceMenu.style.display == "block") {
                showAllianceMenu();
            }
        }
    }
    var alliancePlayers = [];
    function setAlliancePlayers(e) {
        alliancePlayers = e;
        let t = allianceNotifications.findIndex((e) => alliancePlayers.includes(e.sid));
        if (t >= 0) {
            allianceNotifications.splice(t, 1);
            updateNotifications();
        }
        if (allianceMenu.style.display == "block") {
            showAllianceMenu();
        }
    }
    function updateLeaderboard(e) {
        UTILS.removeAllChildren(leaderboardData);
        var t = 1;
        for (var i = 0; i < e.length; i += 3) {
            (function (i) {
                UTILS.generateElement({
                    class: "leaderHolder",
                    parent: leaderboardData,
                    children: [
                        UTILS.generateElement({
                            class: "leaderboardItem",
                            style: `max-width: 220px; font-size: 14px; color: ${e[i] == playerSID ? "#fff" : chicken.chickenUsers.find((t) => t.sid == e[i]) ? "#f00" : "rgb(255, 255, 255, .6"}`,
                            text: `${t}. ${e[i + 1] || "unknown"} {${e[i]}}`,
                        }),
                        UTILS.generateElement({
                            class: "leaderScore",
                            style: "font-size: 14px;",
                            text: UTILS.kFormat(e[i + 2]) || "0",
                        }),
                    ],
                });
            })(i);
            t++;
        }
    }
    function killObjects(e) {
        if (player) {
            objectManager.removeAllItems(e);
        }
    }
    function killObject(e) {
        let t = objectManager.disableBySid(e);
        if (t && player) {
            chicken.manageBuildingBreak(t);
        }
    }
    function updateAge(e, t, i) {
        if (e != undefined) {
            player.XP = e;
        }
        if (t != undefined) {
            player.maxXP = t;
        }
        if (i != undefined) {
            player.age = i;
        }
        if (i == config.maxAge) {
            ageText.innerHTML = "MAX AGE";
            ageBarBody.style.width = "100%";
        } else {
            ageText.innerHTML = "AGE " + player.age;
            ageBarBody.style.width = (player.XP / player.maxXP) * 100 + "%";
        }
    }
    function deleteAlliance(e) {
        for (var t = alliances.length - 1; t >= 0; t--) {
            if (alliances[t].sid == e) {
                alliances.splice(t, 1);
            }
        }
        if (allianceMenu.style.display == "block") {
            showAllianceMenu();
        }
    }
    class MapPing {
        init(e, t) {
            this.scale = 0;
            this.x = e;
            this.y = t;
            this.active = true;
        }
        update(e, t) {
            if (this.active) {
                this.scale += t * 0.05;
                if (this.scale >= config.mapPingScale) {
                    this.active = false;
                } else {
                    e.globalAlpha = 1 - Math.max(0, this.scale / config.mapPingScale);
                    e.beginPath();
                    e.arc((this.x / config.mapScale) * mapDisplay.width, (this.y / config.mapScale) * mapDisplay.width, this.scale, 0, Math.PI * 2);
                    e.stroke();
                }
            }
        }
    }
    function pingMap(e, t) {
        let i;
        for (var s = 0; s < mapPings.length; ++s) {
            if (!mapPings[s].active) {
                i = mapPings[s];
                break;
            }
        }
        if (!i) {
            i = new MapPing();
            mapPings.push(i);
        }
        i.init(e, t);
    }
    function updateMinimap(e) {
        minimapData = e;
    }
    async function autoTranslateMessage(e) {
        if (!scriptMenu.toggles.chatTranslate) {
            return e;
        }
        let t = "auto";
        let i = "en";
        if (e.includes("¯\\_(ツ)_/¯")) {
            return e;
        }
        let s = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${t}&tl=${i}&dt=t&q=${encodeURIComponent(e)}`;
        try {
            let n = await fetch(s);
            if (!n.ok) {
                return e;
            }
            {
                let a = await n.json();
                return a[0][0][0];
            }
        } catch (l) {
            return e;
        }
    }
    async function receiveChat(e, t, i) {
        let s = findPlayerBySID(e);
        if (s && Date.now() - s.lastChatDate >= 500) {
            s.lastChatDate = Date.now();
            let n = "#fff";
            if (t.includes("@@@@@")) {
                t = "Spammed '@'";
                n = "#ffc0cb";
            } else if (i) {
                n = "#ffb400";
            }
            t = t.replace(/\/shrug|\/shrg|\/shurg|\/shrgu/g, "¯\\_(ツ)_/¯");
            let a = await autoTranslateMessage((t = scriptMenu.convertEmojis(t)));
            let l = false;
            if (a !== t) {
                t = a;
                l = true;
                n = "#ffc0cb";
            }
            s.chatMessages.unshift({
                msg: t,
                color: n,
                duration: config.chatCountdown,
            });
            let o = scriptMenu.toggles.chatLimit;
            if (s.chatMessages.length > o) {
                s.chatMessages.splice(o);
            }
            if (!i) {
                scriptMenu.addLog("chat", t, s.name, s.sid, l);
            }
        }
    }
    var gameObjectSprites = {};
    function getResSprite(e) {
        let t = false;
        let i = e.y >= config.mapScale - config.snowBiomeTop ? 2 : e.y <= config.snowBiomeTop ? 1 : 0;
        let s = e.type + "_" + e.scale + "_" + i + (e.type == 0 ? e.colorType : "") + (scriptMenu.toggles.renderShadows ? "Shadow" : "") + t;
        let n = gameObjectSprites[s];
        if (!n) {
            var a = document.createElement("canvas");
            a.width = a.height = e.scale * 2.1 + outlineWidth;
            var l = a.getContext("2d");
            l.translate(a.width / 2, a.height / 2);
            l.rotate(UTILS.randFloat(0, Math.PI));
            l.strokeStyle = outlineColor;
            l.lineWidth = outlineWidth;
            if (scriptMenu.toggles.renderShadows) {
                l.shadowBlur = 8;
                l.shadowColor = t ? "rgb(0, 0, 255, .8)" : "rgb(0, 0, 0, .7)";
            }
            if (e.type == 0) {
                for (var o = 0; o < 2; ++o) {
                    renderStar(l, Math.random() < 0.25 ? 5 : 7, (c = tmpObj.scale * (o ? 0.5 : 1)), c * 0.7);
                    let r = t ? "#0000ff" : i ? `hsl(191, 20%, ${85 + Math.floor(Math.random() * 10)}%)` : `hsl(80, 45%, ${38 + Math.floor(Math.random() * 10)}%)`;
                    l.fillStyle = t ? "#0000ff" : i ? (o ? "#fff" : Math.random() > 0.5 ? r : "#e3f1f4") : o ? "#b4db62" : Math.random() > 0.5 ? r : "#9ebf57";
                    l.fill();
                    if (!o) {
                        l.stroke();
                    }
                }
            } else if (e.type == 1) {
                if (i == 2) {
                    l.fillStyle = t ? "#0000ff" : "#606060";
                    renderStar(l, 6, e.scale * 0.3, e.scale * 0.71);
                    l.fill();
                    l.stroke();
                    l.fillStyle = t ? "#0000ff" : "#89a54c";
                    renderCircle(0, 0, e.scale * 0.55, l);
                    l.fillStyle = t ? "#0000ff" : "#a5c65b";
                    renderCircle(0, 0, e.scale * 0.3, l, true);
                } else {
                    renderBlob(l, 6, tmpObj.scale, tmpObj.scale * 0.7);
                    l.fillStyle = t ? "#0000ff" : i ? "#e3f1f4" : "#89a54c";
                    l.fill();
                    l.stroke();
                    l.fillStyle = t ? "#0000ff" : i ? "#6a64af" : "#c15555";
                    var c;
                    var d;
                    for (var p = 4, h = mathPI2 / p, o = 0; o < p; ++o) {
                        renderCircle((d = UTILS.randInt(tmpObj.scale / 3.5, tmpObj.scale / 2.3)) * Math.cos(h * o), d * Math.sin(h * o), UTILS.randInt(10, 12), l);
                    }
                }
            } else if (e.type == 2 || e.type == 3) {
                l.fillStyle = t ? "#0000ff" : e.type == 2 ? (i == 2 ? "#938d77" : "#939393") : "#e0c655";
                renderStar(l, 3, e.scale, e.scale);
                l.fill();
                l.stroke();
                l.fillStyle = t ? "#0000ff" : e.type == 2 ? (i == 2 ? "#b2ab90" : "#bcbcbc") : "#ebdca3";
                renderStar(l, 3, e.scale * 0.55, e.scale * 0.65);
                l.fill();
            }
            n = a;
            gameObjectSprites[s] = n;
        }
        return n;
    }
    function updateGame() {
        let e = players.find((e) => e.sid == botManager.playingAsData?.sid) || player;
        if ((botManager.playingAsData || !scriptMenu.toggles.mouseless) && (!lastSent || now - lastSent >= 1000 / config.clientSendRate)) {
            lastSent = now;
            if (scriptMenu.toggles.mouseless) {
                chicken.sendAim(chicken.getAttackDir(false, true));
            } else {
                let t = chicken.mouseAimDir();
                if (typeof t == "number") {
                    chicken.sendAim(t);
                }
            }
        }
        if (singerManager.isSinging && keysActive()) {
            let i = singerManager.songChats[singerManager.songIndx];
            let s = singerManager.songAudios[singerManager.songIndx];
            singerManager.currentTime += delta;
            if (s.paused) {
                s.play();
            }
            if (i[singerManager.syncChatIndx]) {
                let n = i[singerManager.syncChatIndx];
                if (singerManager.currentTime >= n.time) {
                    io.send("6", n.lyrics.slice(0, 30));
                    singerManager.syncChatIndx++;
                }
            } else if (singerManager.currentTime >= s.duration * 1000 && singerManager.syncChatIndx >= 0) {
                singerManager.syncChatIndx = 0;
                singerManager.currentTime = 0;
                singerManager.resetAllAudios();
                singerManager.isSinging = false;
            }
        } else if (!keysActive() && singerManager.isSinging) {
            singerManager.songAudios[singerManager.songIndx].pause();
        }
        if (deathTextScale < 120) {
            deathTextScale += delta * 0.1;
            diedText.style.fontSize = Math.min(Math.round(deathTextScale), 120) + "px";
        }
        if (e) {
            let a;
            let l;
            let o = 0;
            let r = 0;
            a = UTILS.getDistance(
                {
                    x: camX,
                    y: camY,
                },
                {
                    x: e.x + o,
                    y: e.y + r,
                },
            );
            l = UTILS.getDirection(
                {
                    x: e.x + o,
                    y: e.y + r,
                },
                {
                    x: camX,
                    y: camY,
                },
            );
            let c = Math.min(a * 0.01 * delta, a);
            if (a > 0.05) {
                camX += c * Math.cos(l);
                camY += c * Math.sin(l);
            } else {
                camX = e.x + o;
                camY = e.y + r;
            }
        } else {
        }
        var d;
        var p = now - 1000 / config.serverUpdateRate;
        for (var h = 0; h < players.length + ais.length; ++h) {
            if ((tmpObj = players[h] || ais[h - players.length]) && tmpObj.visible) {
                if (tmpObj.forcePos) {
                    tmpObj.x = tmpObj.x2;
                    tmpObj.y = tmpObj.y2;
                    tmpObj.dir = tmpObj.d2;
                } else {
                    var g = tmpObj.t2 - tmpObj.t1;
                    var $ = (p - tmpObj.t1) / g;
                    var m = 170;
                    tmpObj.dt += delta;
                    var u = Math.min(1.7, tmpObj.dt / m);
                    var d = tmpObj.x2 - tmpObj.x1;
                    tmpObj.x = tmpObj.x1 + d * u;
                    d = tmpObj.y2 - tmpObj.y1;
                    tmpObj.y = tmpObj.y1 + d * u;
                    tmpObj.dir = Math.lerpAngle(tmpObj.d2, tmpObj.d1, Math.min(1.2, $));
                }
            }
        }
        var f = camX - maxScreenWidth / 2;
        var y = camY - maxScreenHeight / 2;
        if (false) {
            mainContext.fillStyle = "#ffff00";
            mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        } else if (config.snowBiomeTop - y <= 0 && config.mapScale - config.snowBiomeTop - y >= maxScreenHeight) {
            mainContext.fillStyle = "#b6db66";
            mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        } else if (config.mapScale - config.snowBiomeTop - y <= 0) {
            mainContext.fillStyle = "#dbc666";
            mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        } else if (config.snowBiomeTop - y >= maxScreenHeight) {
            mainContext.fillStyle = "#fff";
            mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        } else if (config.snowBiomeTop - y >= 0) {
            mainContext.fillStyle = "#fff";
            mainContext.fillRect(0, 0, maxScreenWidth, config.snowBiomeTop - y);
            mainContext.fillStyle = "#b6db66";
            mainContext.fillRect(0, config.snowBiomeTop - y, maxScreenWidth, maxScreenHeight - (config.snowBiomeTop - y));
        } else {
            mainContext.fillStyle = "#b6db66";
            mainContext.fillRect(0, 0, maxScreenWidth, config.mapScale - config.snowBiomeTop - y);
            mainContext.fillStyle = "#dbc666";
            mainContext.fillRect(0, config.mapScale - config.snowBiomeTop - y, maxScreenWidth, maxScreenHeight - (config.mapScale - config.snowBiomeTop - y));
        }
        if ((waterMult += waterPlus * config.waveSpeed * delta) >= config.waveMax) {
            waterMult = config.waveMax;
            waterPlus = -1;
        } else if (waterMult <= 1) {
            waterMult = waterPlus = 1;
        }
        mainContext.globalAlpha = 1;
        mainContext.fillStyle = "#dbc666";
        renderWaterBodies(f, y, mainContext, config.riverPadding);
        mainContext.fillStyle = "#91b2db";
        renderWaterBodies(f, y, mainContext, (waterMult - 1) * 250);
        mainContext.globalAlpha = 1;
        mainContext.strokeStyle = outlineColor;
        renderGameObjects(-1, f, y);
        mainContext.globalAlpha = 1;
        mainContext.lineWidth = outlineWidth;
        renderProjectiles(0, f, y);
        renderPlayers(f, y, 0);
        mainContext.globalAlpha = 1;
        let x = scriptMenu.toggles.renderShadows;
        for (var h = 0; h < ais.length; ++h) {
            if ((tmpObj = ais[h]).active && tmpObj.visible) {
                tmpObj.animate(delta);
                mainContext.save();
                mainContext.translate(tmpObj.x - f, tmpObj.y - y);
                mainContext.rotate(tmpObj.dir + tmpObj.dirPlus - Math.PI / 2);
                if (x) {
                    mainContext.shadowBlur = 8;
                    mainContext.shadowColor = "rgb(0, 0, 0, .7)";
                }
                renderAI(tmpObj, mainContext);
                mainContext.restore();
            }
        }
        game.manageTurretReload(delta);
        renderGameObjects(0, f, y);
        renderProjectiles(1, f, y);
        renderGameObjects(1, f, y);
        renderPlayers(f, y, 1);
        renderGameObjects(2, f, y);
        renderGameObjects(3, f, y);
        mainContext.fillStyle = "#000";
        mainContext.globalAlpha = 0.09;
        if (f <= 0) {
            mainContext.fillRect(0, 0, -f, maxScreenHeight);
        }
        if (config.mapScale - f <= maxScreenWidth) {
            var b = Math.max(0, -y);
            mainContext.fillRect(config.mapScale - f, b, maxScreenWidth - (config.mapScale - f), maxScreenHeight - b);
        }
        if (y <= 0) {
            mainContext.fillRect(-f, 0, maxScreenWidth + f, -y);
        }
        if (config.mapScale - y <= maxScreenHeight) {
            var k = Math.max(0, -f);
            var _ = 0;
            if (config.mapScale - f <= maxScreenWidth) {
                _ = maxScreenWidth - (config.mapScale - f);
            }
            mainContext.fillRect(k, config.mapScale - y, maxScreenWidth - k - _, maxScreenHeight - (config.mapScale - y));
        }
        if (scriptMenu.toggles.renderBuildingHP) {
            mainContext.globalAlpha = 1;
            for (let v = 0; v < game.closeObjects.length; v++) {
                let w = game.closeObjects[v];
                if (w && w.active && w.currentHealth && w.currentHealth != w.health && Math.hypot(w.y - e.y, w.x - e.x) < 300 + w.scale) {
                    mainContext.fillStyle = darkOutlineColor;
                    mainContext.roundRect(w.x + w.xWiggle - f - config.healthBarWidth / 2 - config.healthBarPad, w.y + w.yWiggle - y - config.healthBarPad, config.healthBarWidth + config.healthBarPad * 2, 17, 8);
                    mainContext.fill();
                    mainContext.fillStyle = game.isMine(w.owner.sid) ? "#8ecc51" : game.isAlly(w.owner.sid) ? "#ffff00" : "#cc5151";
                    mainContext.roundRect(w.x + w.xWiggle - f - config.healthBarWidth / 2, w.y + w.yWiggle - y, config.healthBarWidth * (Math.max(0, w.currentHealth) / w.health), 17 - config.healthBarPad * 2, 7);
                    mainContext.fill();
                }
            }
        }
        deathAnimationHandler.renderAnimations(mainContext, delta, f, y);
        if (scriptMenu.toggles.renderKnockbackVisualization) {
            for (let T = 0; T < kbSimulator.animations.length; T++) {
                let S = kbSimulator.animations[T];
                if (S) {
                    let I = UTILS.getDirection(S.pos.new, S.pos.old);
                    let B = UTILS.getDistance(S.pos.old, S.pos.new) * (1 - Math.max(0, S.duration) / S.maxDuration);
                    let D = {
                        x: S.pos.old.x + Math.cos(I) * B,
                        y: S.pos.old.y + Math.sin(I) * B,
                    };
                    mainContext.save();
                    mainContext.translate(D.x - f, D.y - y);
                    renderPlayer(S, mainContext);
                    mainContext.restore();
                    S.duration -= delta;
                    if (S.duration <= -(S.maxDuration * 0.375)) {
                        kbSimulator.animations.splice(T, 1);
                    }
                }
            }
        } else {
            kbSimulator.animations = [];
        }
        mainContext.globalAlpha = 1;
        if (scriptMenu.toggles.renderPlacements) {
            for (let E = 0; E < placer.markers.length; E++) {
                let P = placer.markers[E];
                if (P && !isNaN(P.x) && !isNaN(P.y)) {
                    mainContext.save();
                    mainContext.translate(P.x - f, P.y - y);
                    if (P.differentVisual) {
                        mainContext.fillStyle = P.id == e.items[2] ? "rgb(255, 0, 0, .45)" : "rgb(0, 255, 255, .45)";
                        renderCircle(0, 0, P.scale, mainContext, true, false);
                    } else {
                        mainContext.globalAlpha = P.name == "pit trap" ? 0.18 : 0.3;
                        mainContext.rotate(P.angle);
                        let A = getItemSprite(P);
                        mainContext.drawImage(A, -(A.width / 2), -(A.height / 2));
                    }
                    mainContext.restore();
                }
            }
        }
        mainContext.globalAlpha = 1;
        mainContext.fillStyle = "rgba(0, 0, 70, 0.35)";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        mainContext.strokeStyle = darkOutlineColor;
        if (chicken.pushing) {
            let C = chicken.pushing;
            mainContext.save();
            mainContext.globalAlpha = 1;
            mainContext.lineWidth = 6;

            mainContext.beginPath();
            mainContext.fillStyle = "rgba(255, 255, 0, 0.6)";
            mainContext.arc(C.last.x - f, C.last.y - y, 52, 0, 2 * Math.PI);
            mainContext.fill();
            if (C.path) {
                mainContext.beginPath();
                mainContext.strokeStyle = "#00ffff";
                mainContext.moveTo(e.x - f, e.y - y);
                for (let L = 0; L < C.path.length; L++) {
                    let H = C.path[L];
                    if (H) {
                        mainContext.lineTo(H.x - f, H.y - y);
                    }
                }
                mainContext.stroke();
                mainContext.beginPath();
                mainContext.strokeStyle = "#fff";
                mainContext.moveTo(C.path[C.path.length - 1].x - f, C.path[C.path.length - 1].y - y);
                mainContext.lineTo(C.first.x - f, C.first.y - y);
                mainContext.lineTo(C.last.x - f, C.last.y - y);
                mainContext.stroke();
            } else {
                mainContext.beginPath();
                mainContext.strokeStyle = "#fff";
                mainContext.moveTo(e.x - f, e.y - y);
                mainContext.lineTo(C.first.x - f, C.first.y - y);
                mainContext.lineTo(C.last.x - f, C.last.y - y);
                mainContext.stroke();
            }
            mainContext.restore();
        }
        mainContext.globalAlpha = 1;
        if (chicken.grid) {
            for (let O = 0; O < chicken.grid.length; O++) {
                let W = chicken.grid[O];
                mainContext.save();
                mainContext.translate(W.x - f, W.y - y);
                mainContext.fillStyle = "rgb(0, 0, 0, .4)";
                renderCircle(0, 0, 5, mainContext, true, false);
                mainContext.restore();
            }
        }
        textManager.update(delta, mainContext, f, y);
        for (let j = 0; j < players.length + ais.length; j++) {
            let M = players[j] || ais[j - players.length];
            if (M && (M.isPlayer && inWindow && M.manageReloads(delta, M.visible), M.visible)) {
                let R = (M.team ? "[" + M.team + "] " : "") + (M.name || "");
                if (!scriptMenu.toggles.renderNames) {
                    R = "";
                }
                if (R != "") {
                    mainContext.font = (M.nameScale || 30) + "px Hammersmith One";
                    mainContext.fillStyle = "#fff";
                    mainContext.textBaseline = "middle";
                    mainContext.textAlign = "center";
                    mainContext.lineWidth = M.nameScale ? 11 : 8;
                    mainContext.lineJoin = "round";
                    mainContext.strokeText(R, M.x - f, M.y - y - M.scale - config.nameY);
                    mainContext.fillText(R, M.x - f, M.y - y - M.scale - config.nameY);
                }
                if (M.isLeader && iconSprites.crown.isLoaded) {
                    var F = config.crownIconScale;
                    var k = M.x - f - F / 2 - mainContext.measureText(R).width / 2 - config.crownPad;
                    mainContext.drawImage(iconSprites.crown, k, M.y - y - M.scale - config.nameY - F / 2 - 5, F, F);
                }
                if (M.iconIndex == 1 && iconSprites.skull.isLoaded) {
                    var F = config.crownIconScale;
                    var k = M.x - f - F / 2 + mainContext.measureText(R).width / 2 + config.crownPad;
                    mainContext.drawImage(iconSprites.skull, k, M.y - y - M.scale - config.nameY - F / 2 - 5, F, F);
                }
                if (M.isPlayer && game.enemies.nearest && (chicken.autoTriggerOneShot || instaManager.holdModeOT) && M.sid == game.enemies.nearest.sid && iconSprites.crosshair.isLoaded) {
                    F = config.playerScale * 2 - 10;
                    mainContext.drawImage(iconSprites.crosshair, M.x - f - F / 2, M.y - y - F / 2, F, F);
                }
                if (M.isPlayer) {
                    if (!botManager.botSids.includes(M.sid)) {
                        if (scriptMenu.toggles.renderReloadingBars) {
                            if (!scriptMenu.toggles.renderReloadingBarsOnReload || M.reloads[M.secondaryWeapon] > 0) {
                                let z = 1 - M.reloads[M.secondaryWeapon] / items.weapons[M.secondaryWeapon].speed;
                                mainContext.fillStyle = darkOutlineColor;
                                mainContext.roundRect( M.x - f + 2 - config.healthBarPad, M.y - y + M.scale + config.nameY - 13, 47 + config.healthBarPad * 2, 17, 10);
                                mainContext.fill();
                                mainContext.fillStyle = scriptMenu.toggles.renderReloadingBarsColorx2;
                                mainContext.roundRect(M.x - f + 2, M.y - y + M.scale + config.nameY - 13 + config.healthBarPad, z * 47,16 - config.healthBarPad * 2, 10);
                                mainContext.fill();
                            }
                            if (!scriptMenu.toggles.renderReloadingBarsOnReload || M.reloads[M.primaryWeapon] > 0) {
                                let V = 1 - M.reloads[M.primaryWeapon] / items.weapons[M.primaryWeapon].speed;
                                mainContext.fillStyle = darkOutlineColor;
                                mainContext.roundRect(M.x - f - 50 - config.healthBarPad, M.y - y + M.scale + config.nameY - 13, 47 + config.healthBarPad * 2, 17, 10);
                                mainContext.fill();
                                mainContext.fillStyle = scriptMenu.toggles.renderReloadingBarsColor;
                                mainContext.roundRect(M.x - f - 50, M.y - y + M.scale + config.nameY - 13 + config.healthBarPad, V * 47, 16 - config.healthBarPad * 2, 10);
                                mainContext.fill();
                            }
                        }

                        let G = chicken.chickenUsers.find((e) => e.sid == M.sid);
                        if (G && G.sid != e.sid) {
                            let q = G.name.slice(0, 12) + (G.length >= 15 ? "..." : "");
                            mainContext.textAlign = "center";
                            mainContext.fillStyle = "#f00";
                            mainContext.lineJoin = "round";
                            mainContext.font = "15px Hammersmith One";
                            mainContext.strokeStyle = darkOutlineColor;
                            mainContext.lineWidth = 6;
                            mainContext.strokeText(q, M.x - f, M.y - y - M.scale - config.nameY + 20);
                            mainContext.fillText(q, M.x - f, M.y - y - M.scale - config.nameY + 20);
                        }
                        if (M.isPlayer && (M.sid == playerSID || !game.isAlly(M.sid))) {
                            let K = M == player && keys[16] ? "true" : M.shameCount;
                            if (!game.isFriendly(M.sid)) {
                                K = M.primaryWeapon + " " + M.shameCount + " " + M.secondaryWeapon;
                            }
                            mainContext.textAlign = "center";
                            mainContext.fillStyle = M == player && !keys[16] && M.shameCount > 5 ? "#f00" : "#fff";
                            mainContext.lineJoin = "round";
                            mainContext.font = "20px Hammersmith One";
                            mainContext.strokeStyle = darkOutlineColor;
                            mainContext.lineWidth = 6;
                            mainContext.strokeText(K, M.x - f, M.y - y + M.scale + config.nameY + 30);
                            mainContext.fillText(K, M.x - f, M.y - y + M.scale + config.nameY + 30);
                        }
                        if (scriptMenu.toggles.renderHealthText) {
                            if (G) {
                                if (G.sid == e.sid) {
                                    G = false;
                                }
                                if (!G.name) {
                                    G = false;
                                }
                            }
                            let N = `[${M.health.toString().includes(".") ? UTILS.fixTo(M.health, 4) : M.health}${M.sid == playerSID ? `,${healer.healingPotential.toString().includes(".") ? UTILS.fixTo(healer.healingPotential, 4) : healer.healingPotential}` : ""}${game.isFriendly(M.sid) ? "" : `,${items.list[M.spikeType?.id].dmg || healer.possibleEnemySpikes}`}]`;
                            mainContext.textAlign = "center";
                            mainContext.fillStyle = "#fff";
                            mainContext.lineJoin = "round";
                            mainContext.font = "20px Hammersmith One";
                            mainContext.strokeStyle = darkOutlineColor;
                            mainContext.lineWidth = 6;
                            mainContext.strokeText(N, M.x - f, M.y - y - M.scale - config.nameY + (G ? 40 : 20));
                            mainContext.fillText(N, M.x - f, M.y - y - M.scale - config.nameY + (G ? 40 : 20));
                        }
                    }
                    let X = "";
                    X = M.sid == playerSID ? (keys[16] ? playerSID : packetManager.packets.sec) : game.isAlly(M.sid) ? (keys[16] ? `${M.sid}${pingTracker.data[M.id] ? `/${pingTracker.data[M.id].ping}` : "/0"}` : M.sid) : `${M.sid}${pingTracker.data[M.id] ? `/${pingTracker.data[M.id].ping}` : "/0"}`;
                    mainContext.fillStyle = "#fff";
                    mainContext.lineJoin = "round";
                    mainContext.font = "18px Hammersmith One";
                    mainContext.strokeStyle = darkOutlineColor;
                    mainContext.lineWidth = 6;
                    mainContext.strokeText(X, M.x - f, M.y - y);
                    mainContext.fillText(X, M.x - f, M.y - y);
                }
                if (M.health > 0) {
                    mainContext.fillStyle = darkOutlineColor;
                    mainContext.roundRect(M.x - f - config.healthBarWidth - config.healthBarPad, M.y - y + M.scale + config.nameY, config.healthBarWidth * 2 + config.healthBarPad * 2, 17, 8);
                    mainContext.fill();
                    mainContext.fillStyle = M == player || (M.team && M.team == e.team) ? "#8ecc51" : "#cc5151";
                    mainContext.roundRect(M.x - f - config.healthBarWidth, M.y - y + M.scale + config.nameY + config.healthBarPad, config.healthBarWidth * 2 * (M.health / M.maxHealth), 17 - config.healthBarPad * 2, 7);
                    mainContext.fill();
                }
            }
        }
        for (let U = 0; U < players.length; U++) {
            let Z = players[U];
            if (Z.visible) {
                for (let Y = 0; Y < Z.chatMessages.length; Y++) {
                    let J = Z.chatMessages[Y];
                    if (J) {
                        J.duration -= delta;
                        mainContext.font = "28px Hammersmith One";
                        let Q = mainContext.measureText(J.msg);
                        mainContext.textBaseline = "middle";
                        mainContext.textAlign = "center";
                        let ee = Z.x - f;
                        if (J.add == null) {
                            J.add = 0;
                        }
                        let et = Y * 44;
                        if (J.add < et) {
                            J.add += (et / 100) * delta;
                        } else {
                            J.add = et;
                        }
                        let ei = Z.y - Z.scale - y - 90 - J.add;
                        let es = 37;
                        let en = Q.width + 17;
                        mainContext.fillStyle = "rgba(0, 0, 0, 0.2)";
                        mainContext.roundRect(ee - en / 2, ei - es / 2 + 10, en, es, 6);
                        mainContext.fill();
                        mainContext.fillStyle = J.color;
                        mainContext.fillText(J.msg, ee, ei + 10);
                        if (J.duration <= 0) {
                            Z.chatMessages.splice(Y, 1);
                        }
                    }
                }
            }
        }
        renderMinimap(delta);
        effectsManager.animate(delta);
    }
    function isOnScreen(x, y, s) {
        return x + s >= 0 && x - s <= maxScreenWidth && y + s >= 0 && (y, s, maxScreenHeight);
    }
    function renderProjectiles(e, t, i) {
        for (var s = 0; s < projectiles.length; ++s) {
            if ((tmpObj = projectiles[s]).active && tmpObj.layer == e) {
                tmpObj.update(delta);
                if (tmpObj.active && isOnScreen(tmpObj.x - t, tmpObj.y - i, tmpObj.scale)) {
                    mainContext.save();
                    mainContext.translate(tmpObj.x - t, tmpObj.y - i);
                    mainContext.rotate(tmpObj.dir);
                    renderProjectile(0, 0, tmpObj, mainContext, 1);
                    mainContext.restore();
                }
            }
        }
    }
    CanvasRenderingContext2D.prototype.roundRect = function (e, t, i, s, n) {
        if (i < n * 2) {
            n = i / 2;
        }
        if (s < n * 2) {
            n = s / 2;
        }
        if (n < 0) {
            n = 0;
        }
        this.beginPath();
        this.moveTo(e + n, t);
        this.arcTo(e + i, t, e + i, t + s, n);
        this.arcTo(e + i, t + s, e, t + s, n);
        this.arcTo(e, t + s, e, t, n);
        this.arcTo(e, t, e + i, t, n);
        this.closePath();
        return this;
    };
    var projectileSprites = {};
    function renderProjectile(e, t, i, s, n) {
        if (i.src) {
            var a = items.projectiles[i.indx].src;
            var l = projectileSprites[a];
            if (!l) {
                (l = new Image()).onload = function () {
                    this.isLoaded = true;
                };
                l.src = ".././img/weapons/" + a + ".png";
                projectileSprites[a] = l;
            }
            if (l.isLoaded) {
                s.drawImage(l, e - i.scale / 2, t - i.scale / 2, i.scale, i.scale);
            }
        } else if (i.indx == 1) {
            s.fillStyle = "#939393";
            renderCircle(e, t, i.scale, s);
        }
    }
    function renderWaterBodies(e, t, i, s) {
        var n = config.riverWidth + s;
        var a = config.mapScale / 2 - t - n / 2;
        if (a < maxScreenHeight && a + n > 0) {
            i.fillRect(0, a, maxScreenWidth, n);
        }
    }
    function renderMinimap(e) {
        if (player && player.alive) {
            mapContext.clearRect(0, 0, mapDisplay.width, mapDisplay.height);
            mapContext.strokeStyle = "#fff";
            mapContext.lineWidth = 4;
            for (var t = 0; t < mapPings.length; ++t) {
                mapPings[t].update(mapContext, e);
            }
            mapContext.globalAlpha = 1;
            mapContext.fillStyle = "#fff";
            renderCircle((player.x / config.mapScale) * mapDisplay.width, (player.y / config.mapScale) * mapDisplay.height, 7, mapContext, true);
            mapContext.fillStyle = "rgba(255,255,255,0.35)";
            if (player.team && minimapData) {
                for (var t = 0; t < minimapData.length; ) {
                    renderCircle((minimapData[t] / config.mapScale) * mapDisplay.width, (minimapData[t + 1] / config.mapScale) * mapDisplay.height, 7, mapContext, true);
                    t += 2;
                }
            }
            if (chickenSocketHandler.userPositions.length) {
                for (let i = 0; i < chickenSocketHandler.userPositions.length; i++) {
                    let s = chickenSocketHandler.userPositions[i];
                    if (s && s.sid != player.sid) {
                        mapContext.globalAlpha = 1;
                        mapContext.fillStyle = "#ffff00";
                        renderCircle((s.x / config.mapScale) * mapDisplay.width, (s.y / config.mapScale) * mapDisplay.height, 7, mapContext, true);
                    }
                }
            }
            if (lastDeath) {
                mapContext.fillStyle = "#fc5553";
                mapContext.font = "34px Hammersmith One";
                mapContext.textBaseline = "middle";
                mapContext.textAlign = "center";
                mapContext.fillText("x", (lastDeath.x / config.mapScale) * mapDisplay.width, (lastDeath.y / config.mapScale) * mapDisplay.height);
            }
            if (mapMarker) {
                mapContext.fillStyle = "#fff";
                mapContext.font = "34px Hammersmith One";
                mapContext.textBaseline = "middle";
                mapContext.textAlign = "center";
                mapContext.fillText("x", (mapMarker.x / config.mapScale) * mapDisplay.width, (mapMarker.y / config.mapScale) * mapDisplay.height);
            }
        }
    }
    var aiSprites = {};
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
    var volanco = {
        land: null,
        lava: null,
        animationTime: 0,
        x: 13960,
        y: 13960,
    };
    function drawRegularPolygon(e, t, i) {
        let s = e.lineWidth || 0;
        let n = i / 2;
        e.beginPath();
        let a = (Math.PI * 2) / t;
        for (let l = 0; l < t; l++) {
            let o = n + (n - s / 2) * Math.cos(a * l);
            let r = n + (n - s / 2) * Math.sin(a * l);
            e.lineTo(o, r);
        }
        e.closePath();
    }
    function drawVolancoImage() {
        let e = config.volanoScale * 2;
        let t = document.createElement("canvas");
        t.width = e;
        t.height = e;
        let i = t.getContext("2d");
        i.strokeStyle = "#3e3e3e";
        i.lineWidth = outlineWidth * 2;
        i.fillStyle = "#7f7f7f";
        drawRegularPolygon(i, 10, e);
        i.fill();
        i.stroke();
        volanco.land = t;
        let s = config.innerVolcanoScale * 2;
        let n = document.createElement("canvas");
        n.width = s;
        n.height = s;
        let a = n.getContext("2d");
        a.strokeStyle = outlineColor;
        a.lineWidth = outlineWidth * 1.6;
        a.fillStyle = "#f54e16";
        a.strokeStyle = "#f56f16";
        drawRegularPolygon(a, 10, s);
        a.fill();
        a.stroke();
        volanco.lava = n;
    }
    let objSprites = [];
    function getObjSprite(obj) {
        let tmpSprite = objSprites[obj.id];
        if (!tmpSprite) {
            let tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = tmpCanvas.height = obj.scale * 2.5 + outlineWidth + (items.list[obj.id].spritePadding || 0);
            let tmpContext = tmpCanvas.getContext("2d");
            tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
            tmpContext.rotate(Math.PI / 2);
            tmpContext.strokeStyle = outlineColor;
            tmpContext.lineWidth = outlineWidth;
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
    function renderGameObjects(e, t, i) {
        var s;
        var n;
        var a;
        for (var l = 0; l < gameObjects.length; l++) {
            if ((tmpObj = gameObjects[l]).active && ((n = tmpObj.x + tmpObj.xWiggle - t), (a = tmpObj.y + tmpObj.yWiggle - i), e == 0 && tmpObj.update(delta), tmpObj.layer == e && isOnScreen(n, a, tmpObj.scale + (tmpObj.blocker || 0)))) {
                mainContext.globalAlpha = tmpObj.trap && scriptMenu.toggles.trapsAlwaysTransparent ? 0.6 : tmpObj.hideFromEnemy ? 0.6 : 1;
                if (tmpObj.isItem) {
                    s = getItemSprite(tmpObj);
                    mainContext.save();
                    mainContext.translate(n, a);
                    mainContext.rotate(tmpObj.dir);
                    mainContext.drawImage(s, -(s.width / 2), -(s.height / 2));
                    if (tmpObj.blocker) {
                        mainContext.strokeStyle = "#db6e6e";
                        mainContext.globalAlpha = 0.3;
                        mainContext.lineWidth = 6;
                        renderCircle(0, 0, tmpObj.blocker, mainContext, false, true);
                    }
                    if (tmpObj.name == "turret") {
                        let o = 1 - tmpObj.turretReload / 2200;
                        mainContext.strokeStyle = "#fff";
                        mainContext.beginPath();
                        mainContext.arc(0, 0, tmpObj.scale * 0.6, 0, Math.PI * 2 * o);
                        mainContext.stroke();
                    }
                    if (chicken.objBreakingTarget && (chicken.objBreakingTarget.moreThanOneSpiek ? chicken.objBreakingTarget.sids.includes(tmpObj.sid) : chicken.objBreakingTarget.sid == tmpObj.sid) && !hatSystem.velSoldier) {
                        let r = chicken.equipBestBreakWeapon("", true);
                        if (healer.reloadPercent(player, r) + config.serverUpdateSpeed / items.weapons[r].speed >= 1) {
                            mainContext.fillStyle = "#f00";
                            mainContext.globalAlpha = 0.2;
                            renderCircle(0, 0, tmpObj.scale, mainContext, true, false);
                        }
                    }
                    mainContext.restore();
                } else {
                    s = getResSprite(tmpObj);
                    if (tmpObj.type == 4) {
                        mainContext.globalAlpha = 1;
                        volanco.animationTime += delta;
                        volanco.animationTime %= config.volcanoAnimationDuration;
                        let c = config.volcanoAnimationDuration / 2;
                        let d = 1.7 + (Math.abs(c - volanco.animationTime) / c) * 0.3;
                        let p = config.innerVolcanoScale * d;
                        mainContext.drawImage(volanco.land, n - config.volanoScale, a - config.volanoScale, config.volanoScale * 2, config.volanoScale * 2);
                        mainContext.drawImage(volanco.lava, n - p, a - p, p * 2, p * 2);
                    } else {
                        mainContext.globalAlpha = 1;
                        if (player && scriptMenu.toggles.treeFade && tmpObj.type == 0) {
                            mainContext.fillStyle = "rgb(0, 0, 0, .4)";
                            mainContext.strokeStyle = "rgb(0, 0, 0, .5)";
                            renderCircle(n, a, tmpObj.scale * 0.6, mainContext, false, false);
                            let h = 235 + tmpObj.scale;
                            let g = (tmpObj.scale * 0.6 + 52.5) / h;
                            let $ =
                                Math.min(
                                    h,
                                    UTILS.getDistance(
                                        {
                                            x: player.x,
                                            y: player.y,
                                        },
                                        tmpObj,
                                    ),
                                ) / h;
                            mainContext.globalAlpha = Math.max($ - g * (1 - $), 0.15);
                        }
                        mainContext.drawImage(s, n - s.width / 2, a - s.height / 2);
                    }
                }
            }
        }
    }
    drawVolancoImage();
    var moveKeys = {
        87: [0, -1],
        38: [0, -1],
        83: [0, 1],
        40: [0, 1],
        65: [-1, 0],
        37: [-1, 0],
        68: [1, 0],
        39: [1, 0],
    };
    function keysActive() {
        return (document.activeElement.tagName != "INPUT" || (document.activeElement.type != "number" && document.activeElement.type != "text")) && document.activeElement.id != "chickenChatBox" && allianceMenu.style.display != "block" && chatHolder.style.display != "flex";
    }

    const GRIND_RUBY = 3;
    const GRIND_RANGE = 300;
    const GRIND_ENEMY_RANGE = 400;
    const GRIND_TANK_HAT = 40;

    const unxGrind = {
        angle: null,

        variantOf(index) {
            const xp = (player && player.weaponXP && player.weaponXP[index]) || 0;
            for (let i = config.weaponVariants.length - 1; i >= 0; i--) {
                if (xp >= config.weaponVariants[i].xp) return config.weaponVariants[i].id;
            }
            return 0;
        },

        isFullyUpgraded() {
            if (!player || !player.weapons) return false;
            const primary = player.weapons[0];
            const secondary = player.weapons[1];
            const doneSecondary = secondary === 10 && this.variantOf(secondary) >= GRIND_RUBY;
            const donePrimary = primary !== 8 && this.variantOf(primary) >= GRIND_RUBY;
            return doneSecondary && donePrimary;
        },

        buildingDamage(index, tank) {
            const weapon = items.weapons[index];
            if (!weapon) return 0;
            const variant = config.weaponVariants[this.variantOf(index)];
            return weapon.dmg * (weapon.sDmg || 1) * ((variant && variant.val) || 1) * (tank ? 3.3 : 1);
        },

        canAffordTank() {
            if (player.skins && player.skins[GRIND_TANK_HAT]) return true;
            const hat = hats.find((h) => h.id === GRIND_TANK_HAT);
            return !!hat && player.points >= hat.price;
        },

        action(turret) {
            if (!turret) return null;
            const primary = player.weapons[0];
            const secondary = player.weapons[1];
            const useTank = this.canAffordTank();

            let type = null;
            if (secondary === 10 && this.variantOf(secondary) < GRIND_RUBY) type = 1;
            else if (primary !== 8 && this.variantOf(primary) < GRIND_RUBY) type = 0;
            if (type === null) return null;

            if (type === 1) return { weapon: 1, hat: useTank ? GRIND_TANK_HAT : 0 };

            const primaryDamage = this.buildingDamage(primary, useTank);
            if (secondary === 10) {
                const secondaryDamage = this.buildingDamage(secondary, useTank);
                const health = turret.health != null ? turret.health : turret.currentHealth || 0;
                if (health > primaryDamage + secondaryDamage) return { weapon: 1, hat: useTank ? GRIND_TANK_HAT : 0 };
                if (health > primaryDamage) return { weapon: 1, hat: 0 };
                return { weapon: 0, hat: useTank ? GRIND_TANK_HAT : 0 };
            }
            return { weapon: 0, hat: useTank ? GRIND_TANK_HAT : 0 };
        },

        nearbyTurrets() {
            let sumX = 0;
            let sumY = 0;
            let count = 0;
            let nearest = null;
            let nearestDist = Infinity;
            for (let i = 0; i < gameObjects.length; i++) {
                const obj = gameObjects[i];
                if (!obj.active || obj.name !== "turret") continue;
                if (!obj.owner || obj.owner.sid !== player.sid) continue;
                const dist = UTILS.getDistance(player, obj);
                if (dist > GRIND_RANGE) continue;
                sumX += obj.x;
                sumY += obj.y;
                count++;
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = obj;
                }
            }
            if (!count) return null;
            return {
                count: count,
                nearest: nearest,
                angle: Math.atan2(sumY / count - player.y, sumX / count - player.x),
            };
        },

        blocked() {
            const enemy = game.enemies.nearest;
            return !!enemy && UTILS.getDistance(player, enemy) < GRIND_ENEMY_RANGE;
        },

        stop() {
            const el = document.getElementById("toggle:id:autoGrind");
            if (el) el.click();
            else scriptMenu.toggles.autoGrind = false;
            this.angle = null;
        },

        tick(owner) {
            this.angle = null;
            if (!player || !player.items || !player.items[5]) return false;

            if (this.isFullyUpgraded()) {
                this.stop();
                return false;
            }
            if (this.blocked()) return false;

            const near = this.nearbyTurrets();
            if (!near) {
                const base = owner.getAttackDir(true);
                if (typeof base !== "number") return false;
                const spread = (Math.PI / 180) * (isSandbox ? 75 : 40);
                if (isSandbox) placer.regCheckPlace(player.items[5], base);
                placer.regCheckPlace(player.items[5], base - spread);
                placer.regCheckPlace(player.items[5], base + spread);
                hatSystem.doBasicFunction(true);
                return true;
            }

            const action = this.action(near.nearest);
            if (!action) return false;

            const index = action.weapon === 1 ? player.weapons[1] : player.weapons[0];
            if (index == null) return false;

            this.angle = near.angle;
            if (player.weaponIndex !== index) owner.selectToBuild(index, true);

            if (healer.reloadPercent(player, index) !== 1) {
                hatSystem.doBasicFunction(true);
                return true;
            }
            if (action.hat) hatSystem.storeEquip(action.hat, 0, true);
            else hatSystem.doBasicFunction(true);
            owner.sendHitOnce();
            return true;
        },
    };


    const AUTOPLAY_RADIUS = 80;
    const AUTOPLAY_SPEED = 0.2;
    const AUTOPLAY_CLEARANCE = 35;

    const unxAutoPlay = {
        direction: 1,

        reset() {
            this.direction = 1;
        },

        blocked(x, y) {
            for (let i = 0; i < gameObjects.length; i++) {
                const obj = gameObjects[i];
                if (!obj.active) continue;
                if (obj.dmg && obj.owner && !game.isFriendly(obj.owner.sid)) continue;
                if (Math.hypot(x - obj.x, y - obj.y) < obj.scale + AUTOPLAY_CLEARANCE) return true;
            }
            return false;
        },

        dir() {
            if (!scriptMenu.toggles.autoPlay) return undefined;
            if (!player || !player.alive) return undefined;
            if (lastMoveDir !== undefined) return undefined;

            const target = game.enemies.nearest;
            if (!target) return undefined;
            const ex = target.x2;
            const ey = target.y2;
            if (typeof ex != "number" || typeof ey != "number") return undefined;

            const current = Math.atan2(player.y2 - ey, player.x2 - ex);
            let next = current + AUTOPLAY_SPEED * this.direction;
            let tx = ex + Math.cos(next) * AUTOPLAY_RADIUS;
            let ty = ey + Math.sin(next) * AUTOPLAY_RADIUS;

            if (this.blocked(tx, ty)) {
                this.direction *= -1;
                next = current + AUTOPLAY_SPEED * this.direction;
                tx = ex + Math.cos(next) * AUTOPLAY_RADIUS;
                ty = ey + Math.sin(next) * AUTOPLAY_RADIUS;
            }

            return Math.atan2(ty - player.y2, tx - player.x2);
        },
    };


    let lastKillName = "";
    let lastKillAt = 0;

    function formatKillChat(template, victim) {
        return String(template == null ? "" : template)
            .replace(/\{name\}/gi, victim || "")
            .replace(/\{kills\}/gi, player && player.kills != null ? player.kills : 0)
            .trim()
            .slice(0, 30);
    }

    function sendKillChat() {
        const victim = Date.now() - lastKillAt < 1000 ? lastKillName : "";
        const first = formatKillChat(scriptMenu.toggles.killChatMessage, victim);
        if (first) sendChat(first);
        const second = formatKillChat(scriptMenu.toggles.killCountMessage, victim);
        if (second) setTimeout(() => sendChat(second), 900);
    }

    const BOT_PACKET_CAP = 85;
    const BOT_TRAP_ID = 15;
    const BOT_SPIKE_ID = 6;

    class BotSocket {
        constructor(relay, slot) {
            this.relay = relay;
            this.slot = slot;
            this.ws = null;
            this.proto = null;
            this.ready = false;
            this.spawned = false;
            this.dead = false;
            this.name = "";
            this.sid = null;
            this.id = null;
            this.x = 0;
            this.y = 0;
            this.dir = 0;
            this.team = null;
            this.health = 100;
            this.age = 1;
            this.upgradePoints = 0;
            this.weaponIndex = 0;
            this.itemIds = [];
            this.players = [];
            this.objects = [];
            this.packets = 0;
            this.windowStart = 0;
            this.lastMoveDir = undefined;
            this.attacking = false;
            this.lastAim = null;
            this.lastPlace = 0;
            this.lastBreak = 0;
            this.spawnedAt = 0;
        }

        send(name) {
            if (!this.ws || this.ws.readyState !== 1 || !this.ready) return;
            const now = Date.now();
            if (now - this.windowStart >= 1000) {
                this.windowStart = now;
                this.packets = 0;
            }
            if (++this.packets >= BOT_PACKET_CAP) return;
            const data = Array.prototype.slice.call(arguments, 1);
            const wire = isMohMoh ? clientTranslate.get(name) || name : name;
            if (this.proto && this.proto.mode === CHKP.modeSecure) {
                const opcode = this.proto.tables.c2s.enc[wire];
                if (opcode === undefined) return;
                const payload = msgpack.encode([opcode, data, ++this.proto.seq]);
                const frame = new Uint8Array(CHKP.headerLen + payload.length);
                frame.set(CHKP.tag(this.proto.key, payload), 0);
                frame.set(payload, CHKP.headerLen);
                this.ws.send(frame);
            } else {
                this.ws.send(msgpack.encode([wire, data]));
            }
        }

        connect(address, token, name) {
            this.name = name;
            let url = address;
            if (token) url += "/?token=" + encodeURIComponent(token);
            try {
                this.ws = new WebSocket(url);
            } catch (e) {
                this.relay.botClosed(this);
                return;
            }
            this.ws.binaryType = "arraybuffer";
            this.ws.onmessage = (msg) => this.onMessage(msg);
            this.ws.onclose = () => this.relay.botClosed(this);
            this.ws.onerror = () => {};
        }

        close() {
            this.ready = false;
            if (this.ws && this.ws.readyState < 2) this.ws.close();
        }

        onMessage(msg) {
            let parsed;
            try {
                parsed = msgpack.decode(new Uint8Array(msg.data));
            } catch (e) {
                return;
            }
            let type = parsed[0];
            const args = parsed[1];
            if (type == "io-init") {
                this.proto =
                    args[3] === CHKP.modeSecure
                        ? {
                              mode: CHKP.modeSecure,
                              key: CHKP.hexToBytes(args[2]),
                              tables: CHKP.buildTables(args[1] >>> 0),
                              seq: 0,
                          }
                        : null;
                this.ready = true;
                this.spawn();
                return;
            }
            if (this.proto && typeof type == "number") {
                type = this.proto.tables.s2c.dec[type];
                if (type === undefined) return;
            }
            this.handle(String(type), args || []);
        }

        spawn() {
            this.send("M", {
                name: this.name,
                moofoll: 1,
                skin: 0,
            });
        }

        handle(type, args) {
            switch (type) {
                case "C":
                    this.sid = args[0];
                    this.spawned = true;
                    this.dead = false;
                    this.spawnedAt = Date.now();
                    this.relay.emit({ type: "botSid", sid: this.sid });
                    this.send("K", 1, 1);
                    break;
                case "D":
                    if (args[1] && args[0]) {
                        this.id = args[0][0];
                        this.sid = args[0][1];
                    }
                    break;
                case "a":
                    this.readPlayers(args[0] || []);
                    break;
                case "H":
                    this.readObjects(args[0] || []);
                    break;
                case "Q":
                    this.objects = this.objects.filter((o) => o.sid !== args[0]);
                    break;
                case "R":
                    this.objects = this.objects.filter((o) => o.owner !== args[0]);
                    break;
                case "O":
                    if (args[0] === this.sid) this.health = args[1];
                    break;
                case "T":
                    this.age = args[1] || this.age;
                    break;
                case "U":
                    this.upgradePoints = args[0] || 0;
                    break;
                case "V":
                    if (!args[1]) this.itemIds = args[0] || [];
                    break;
                case "P":
                    this.dead = true;
                    this.spawned = false;
                    this.attacking = false;
                    this.lastMoveDir = undefined;
                    this.relay.emit({ type: "botSidRemove", sid: this.sid });
                    break;
                case "3":
                    if (args[0] === this.sid) this.team = args[1];
                    break;
            }
        }

        readPlayers(flat) {
            const list = [];
            for (let i = 0; i + 12 < flat.length; i += 13) {
                const p = {
                    sid: flat[i],
                    x: flat[i + 1],
                    y: flat[i + 2],
                    dir: flat[i + 3],
                    team: flat[i + 7],
                };
                list.push(p);
                if (p.sid === this.sid) {
                    this.x = p.x;
                    this.y = p.y;
                    this.dir = p.dir;
                }
            }
            this.players = list;
        }

        readObjects(flat) {
            for (let i = 0; i + 7 < flat.length; i += 8) {
                const sid = flat[i];
                const obj = {
                    sid: sid,
                    x: flat[i + 1],
                    y: flat[i + 2],
                    id: flat[i + 6],
                    owner: flat[i + 7],
                };
                const at = this.objects.findIndex((o) => o.sid === sid);
                if (at >= 0) this.objects[at] = obj;
                else this.objects.push(obj);
            }
            if (this.objects.length > 900) this.objects.splice(0, this.objects.length - 900);
        }


        friendly(sid, msg) {
            if (sid === this.sid) return true;
            if (this.relay.ownerSid !== null && sid === this.relay.ownerSid) return true;
            if (this.relay.manager.botSids.indexOf(sid) >= 0) return true;
            return false;
        }

        pickTarget(msg) {
            const wanted = msg.targetSids || [];
            const fromOwner = msg.targetType !== "bot";
            const ox = fromOwner ? msg.ownerPos.x : this.x;
            const oy = fromOwner ? msg.ownerPos.y : this.y;
            let best = null;
            let bestDist = Infinity;
            for (let i = 0; i < this.players.length; i++) {
                const p = this.players[i];
                if (this.friendly(p.sid, msg)) continue;
                if (msg.ownerTeam && p.team === msg.ownerTeam) continue;
                if (wanted.length) {
                    if (wanted.indexOf(p.sid) < 0) continue;
                } else if (!msg.killOnSight) {
                    continue;
                }
                const d = Math.hypot(p.x - ox, p.y - oy);
                if (d < bestDist) {
                    bestDist = d;
                    best = p;
                }
            }
            return best;
        }

        moveAngle(msg) {
            const mode = msg.botMovement;
            const owner = msg.ownerPos;
            if (mode === "stop") return null;
            if (mode === "mouse") {
                const c = owner.cursorLocation;
                if (!c) return null;
                if (Math.hypot(c.x - this.x, c.y - this.y) < 40) return null;
                return Math.atan2(c.y - this.y, c.x - this.x);
            }
            if (mode === "circle") {
                const ring = msg.fixedCircles || [];
                if (!ring.length) return null;
                const a = ring[this.slot % ring.length];
                const tx = owner.x + Math.cos(a) * msg.circleRad;
                const ty = owner.y + Math.sin(a) * msg.circleRad;
                if (Math.hypot(tx - this.x, ty - this.y) < 25) return null;
                return Math.atan2(ty - this.y, tx - this.x);
            }
            const d = Math.hypot(owner.x - this.x, owner.y - this.y);
            if (d <= msg.playerDist) return null;
            return Math.atan2(owner.y - this.y, owner.x - this.x);
        }

        breakTarget(msg) {
            if (msg.botModule !== 2 && msg.botModule !== 3) return null;
            const radius = msg.breakingRad;
            let best = null;
            let bestDist = Infinity;
            const pool =
                msg.botModule === 2
                    ? (msg.ownerPos.buildings || []).map((b) => ({ x: b.x, y: b.y }))
                    : this.objects.filter((o) => o.owner >= 0 && o.owner !== this.sid && !this.friendly(o.owner, msg));
            for (let i = 0; i < pool.length; i++) {
                const o = pool[i];
                const d = Math.hypot(o.x - this.x, o.y - this.y);
                if (d > radius) continue;
                if (d < bestDist) {
                    bestDist = d;
                    best = o;
                }
            }
            return best;
        }

        placeTrap(angle) {
            const now = Date.now();
            if (now - this.lastPlace < 900) return;
            this.lastPlace = now;
            const id = this.itemIds.indexOf(BOT_TRAP_ID) >= 0 ? BOT_TRAP_ID : BOT_SPIKE_ID;
            this.send("z", id);
            this.send("F", 1, angle);
            this.send("z", this.weaponIndex, true);
        }

        tick(msg) {
            if (!this.ready) return;
            if (this.dead) {
                if (Date.now() - this.spawnedAt > 1200) {
                    this.spawnedAt = Date.now();
                    this.spawn();
                }
                return;
            }
            if (!this.spawned) return;

            const wanted = msg.primaryWeaponSelector;
            if (wanted !== this.weaponIndex) {
                this.weaponIndex = wanted;
                this.send("z", wanted, true);
            }

            const move = this.moveAngle(msg);
            if (move !== this.lastMoveDir) {
                this.lastMoveDir = move;
                this.send("9", move === null ? undefined : move);
            }

            const target = this.pickTarget(msg);
            const wall = target ? null : this.breakTarget(msg);
            const hit = target || wall;

            if (hit) {
                const aim = Math.atan2(hit.y - this.y, hit.x - this.x);
                if (this.lastAim === null || Math.abs(aim - this.lastAim) > 0.02) {
                    this.lastAim = aim;
                    this.send("D", aim);
                }
                if (!this.attacking) {
                    this.attacking = true;
                    this.send("F", 1, aim);
                }
                if (msg.autoplace && target) this.placeTrap(aim);
            } else if (this.attacking) {
                this.attacking = false;
                this.send("F", 0);
            }
        }

        chat(message) {
            this.send("6", String(message).slice(0, 30));
        }
    }

    class LocalRelay {
        constructor(slotName, manager) {
            this.readyState = 0;
            this.slotName = slotName;
            this.manager = manager || botManager;
            this.sockets = [];
            this.ownerSid = null;
            this.onopen = null;
            this.onmessage = null;
            this.onclose = null;
            this.pending = 0;
            setTimeout(() => {
                this.readyState = 1;
                if (this.onopen) this.onopen();
            }, 0);
        }

        emit(obj) {
            if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) });
        }

        send(raw) {
            let msg;
            try {
                msg = JSON.parse(raw);
            } catch (e) {
                return;
            }
            if (msg.type === "add") {
                this.addBots(msg.ip, msg.tokens || []);
            } else if (msg.type === "remove") {
                this.removeBots(msg.amount || 0);
            } else if (msg.type === "update") {
                this.ownerSid = playerSID === undefined ? null : playerSID;
                for (let i = 0; i < this.sockets.length; i++) {
                    try {
                        this.sockets[i].tick(msg.msg);
                    } catch (e) {}
                }
            } else if (msg.type === "chat") {
                for (let i = 0; i < this.sockets.length; i++) this.sockets[i].chat(msg.message);
            } else if (msg.type === "killChat") {
                const line = formatKillChat(scriptMenu.toggles.killChatMessage, msg.name);
                if (line) for (let i = 0; i < this.sockets.length; i++) this.sockets[i].chat(line);
            } else if (msg.type === "packet") {
                const bot = this.sockets.find((b) => b.sid === msg.sid);
                if (bot && msg.packetData) bot.send.apply(bot, [msg.packetData.type].concat(msg.packetData.data || []));
            }
        }

        addBots(address, tokens) {
            const names = (scriptMenu.toggles.botNames || "").split(",").map((s) => s.trim()).filter(Boolean);
            let missing = 0;
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                if (!token) {
                    missing++;
                    continue;
                }
                const bot = new BotSocket(this, this.sockets.length);
                this.sockets.push(bot);
                const name = names.length ? names[(this.sockets.length - 1) % names.length] : "unX";
                bot.connect(address || window.wsAddress, token, name);
            }
            if (missing) {
                console.warn("[unx] " + missing + " of " + tokens.length + " bot(s) got no captcha token and were not connected");
                if (typeof errorEventManager != "undefined" && errorEventManager) {
                    errorEventManager.error(missing + "/" + tokens.length + " bots skipped: no captcha token");
                }
            }
            this.emit({ type: "canSendNow" });
        }

        removeBots(amount) {
            for (let i = 0; i < amount && this.sockets.length; i++) {
                const bot = this.sockets.pop();
                if (bot.sid !== null) this.emit({ type: "botSidRemove", sid: bot.sid });
                bot.close();
            }
            if (!this.sockets.length) this.close();
        }

        botClosed(bot) {
            const at = this.sockets.indexOf(bot);
            if (at >= 0) this.sockets.splice(at, 1);
            if (bot.sid !== null) this.emit({ type: "botSidRemove", sid: bot.sid });
            if (!this.sockets.length) this.close();
        }

        close() {
            if (this.readyState === 3) return;
            this.readyState = 3;
            for (let i = 0; i < this.sockets.length; i++) this.sockets[i].close();
            this.sockets = [];
            if (this.onclose) this.onclose();
        }
    }

    class Bot {
        constructor(e, t, i) {
            this.manager = botManager;
            this.project = i;
            this.amount = t || 0;
            this.socket = e;
            e.onopen = () => {
                this.manager.projects.find((e) => e.link == i).isActive = true;
                this.manager.requestBots(e, this.amount);
            };
            e.onmessage = (t) => {
                let i = JSON.parse(t.data);
                if (i.type == "canSendNow") {
                    this.manager.requestBots(e, this.amount);
                } else if (i.type == "botSidRemove") {
                    let s = botManager.botSids.findIndex((e) => e == i.sid);
                    if (s >= 0) {
                        botManager.botSids.splice(s, 1);
                    }
                } else if (i.type == "botSid") {
                    botManager.botSids.push(i.sid);
                } else if (i.type == "playingAS") {
                    botManager.playingAsData = {
                        socket: e,
                        sid: i.sid,
                    };
                } else if (i.type == "updatePlayers") {
                    doPlayerUpdates(i.data);
                } else if (i.type == "addPlayer") {
                    addPlayer(i.data, false, true);
                } else if (i.type == "loadObjects") {
                    loadGameObject(i.data);
                } else if (i.type == "killObject") {
                    killObject(i.data);
                } else if (i.type == "killObjects") {
                    killObjects(i.data);
                } else if (i.type == "chat") {
                    receiveChat(...i.data);
                } else if (i.type == "gatherAnimation") {
                    gatherAnimation(...i.data);
                } else if (i.type == "wiggleGameObject") {
                    wiggleGameObject(...i.data);
                }
            };
            e.onclose = () => {
                let e = this.manager.bots.findIndex((e) => e.project == this.project);
                this.manager.bots.splice(e, 1);
                this.manager.projects.find((e) => e.link == i).isActive = false;
            };
        }
    }
    var botManager = new (class {
        constructor() {
            this.addOn = 0;
            this.projects = [
                {
                    link: "coco-delirious-nut",
                    isActive: false,
                },
                {
                    link: "tartan-octagonal-buckthorn",
                    isActive: false,
                },
                {
                    link: "fixed-morning-holiday",
                    isActive: false,
                },
                {
                    link: "plant-roasted-bee",
                    isActive: false,
                },
                {
                    link: "rambunctious-momentous-diagnostic",
                    isActive: false,
                },
                {
                    link: "festive-handsomely-glue",
                    isActive: false,
                },
                {
                    link: "shine-wide-beret",
                    isActive: false,
                },
                {
                    link: "lacy-foggy-swift",
                    isActive: false,
                },
                {
                    link: "lace-cypress-plywood",
                    isActive: false,
                },
                {
                    link: "steady-eight-offer",
                    isActive: false,
                },
            ];
            this.bots = [];
            this.botSids = [];
        }
        getTokens(e) {
            let t = [];
            for (let i = 0; i < e; i++) {
                t.push(CHKP.freshToken());
            }
            return Promise.all(t);
        }
        sendToServer(e, t) {
            if (e.readyState == 1) {
                e.send(JSON.stringify(t));
            }
        }
        async requestBots(e, t) {
            let i = await this.getTokens(t);
            this.sendToServer(e, {
                type: "add",
                ip: window.wsAddress,
                tokens: i,
            });
        }
        getTargetArray() {
            if (!scriptMenu.toggles.botTargetSids) {
                return [];
            }
            let e = [...new Set(scriptMenu.toggles.botTargetSids.split(",").map(Number))];
            return e.filter((e) => !Number.isNaN(e));
        }
        getCircleAddOn() {
            let e = items.weapons[scriptMenu.toggles.botPrimaryWeapon];
            let t = hats.find((e) => e.id == 6);
            let i = accessories.find((e) => e.id == 11);
            return ((e.spdMult || 1) * ((t && t.spdMult) || 1) * ((i && i.spdMult) || 1) * game.tickSpeed * 0.5) / scriptMenu.toggles.botCircleSize;
        }
        getBaseCirclingAngles() {
            let e = Math.PI * 2;
            let t = Math.PI / (this.amountOfBotsYouHaveInServer * 0.5);
            let i = [];
            this.addOn += this.getCircleAddOn();
            for (let s = 0; s < e; s += t) {
                i.push(s + this.addOn);
            }
            return i;
        }
        updateBots() {
            updateCursorLocation();
            let e = this.getTargetArray();
            this.amountOfBotsYouHaveInServer = this.bots.filter((e) => !e.disconnected).reduce((e, t) => e + t.amount, 0);
            if (!this.amountOfBotsYouHaveInServer) {
                this.botSids = [];
            }
            let t = this.bots.length ? this.getBaseCirclingAngles() : [];
            let i = 0;
            for (let s = 0; s < this.bots.length; s++) {
                let n = this.bots[s];
                if (!n.disconnected) {
                    this.sendToServer(n.socket, {
                        type: "update",
                        msg: {
                            ownerPos: {
                                x: players.find((e) => e.sid == botManager.playingAsData?.sid)?.x2 || player.x2,
                                y: players.find((e) => e.sid == botManager.playingAsData?.sid)?.y2 || player.y2,
                                enemy: game.enemies.nearest
                                ? {
                                    x: game.enemies.nearest.x2,
                                    y: game.enemies.nearest.y2,
                                }
                                : undefined,
                                buildings: botManager.playingAsData ? [] : gameObjects.filter((e) => e.active && (e.trap || e.dmg) && e.owner.sid == player.sid && UTILS.getDistance(e, player) >= parseInt(scriptMenu.toggles.botBreakingRadius)),
                                cursorLocation: chicken.cursorLocation,
                            },
                            ownerTeam: player.team,
                            botModule: scriptMenu.toggles.botModule,
                            botMovement: scriptMenu.toggles.botMovementModule,
                            targetType: scriptMenu.toggles.autoaimBotModule,
                            circleRad: parseInt(scriptMenu.toggles.botCircleSize),
                            playerDist: parseInt(scriptMenu.toggles.playerDistance),
                            breakingRad: parseInt(scriptMenu.toggles.botBreakingRadius),
                            primaryWeaponSelector: parseInt(scriptMenu.toggles.botPrimaryWeapon),
                            targetSids: e,
                            botNames: scriptMenu.toggles.botNames,
                            autoplace: scriptMenu.toggles.botAutoplace,
                            killOnSight: scriptMenu.toggles.botKillOnSight,
                            fixedCircles: t.slice(i, i + 4),
                        },
                    });
                    i += 4;
                }
            }
        }
        killChat(e) {
            lastKillName = e || "";
            lastKillAt = Date.now();
            for (let t = 0; t < this.bots.length; t++) {
                let i = this.bots[t];
                if (!i.disconnected) {
                    this.sendToServer(i.socket, {
                        type: "killChat",
                        name: e,
                    });
                }
            }
        }
        addBots(e) {
            let t = this.projects.filter((e) => e.isActive && this.bots.find((e) => e.project == e.link && e.amount < 4 && !e.disconnected));
            for (let i = 0; i < t.length && !(e <= 0); i++) {
                let s = this.bots.find((e) => e.project == t[i].link && !e.disconnected);
                let n = 4 - s.amount;
                e -= n;
                s.amount += n;
                this.requestBots(s.socket, n);
            }
            let a = this.projects.filter((e) => !e.isActive);
            for (let l = 0; l < a.length && !(e <= 0); l++) {
                let o = a[l];
                let c = new LocalRelay(o.link, this);
                this.bots.push(new Bot(c, Math.min(e, 4), o.link));
                e -= 4;
            }
        }
        removeBots(e) {
            let t = this.bots.filter((e) => e.amount > 0 && !e.disconnected);
            for (let i = 0; i < t.length; i++) {
                let s = t[i];
                let n = Math.min(e, 4);
                e -= n;
                s.amount -= n;
                if (s.amount <= 0) {
                    s.disconnected = true;
                }
                this.sendToServer(s.socket, {
                    type: "remove",
                    amount: n,
                });
                if (e <= 0) {
                    break;
                }
            }
        }
    })();
    var singerManager = new (class {
        constructor() {
            this.songs = [
                {
                    label: "Don Toliver - TORE UP",
                    selected: true,
                    value: 0,
                },
                {
                    label: "V O E - Giants",
                    value: 1,
                },
                {
                    label: "Ace - Adrenaline",
                    value: 2,
                },
            ];
            this.syncChatIndx = 0;
            this.songChatPaths = ["DonToliver-ToreUp.json", "V_O_E-Giants.json", "Ace-Adrenaline.json"];
            this.songAudios = [new Audio("https://cdn.glitch.global/28f0537b-f314-4270-9a7e-9f8c6c223e95/DonToliver-TORE_UP.mp3?v=1720102520354"), new Audio("https://cdn.glitch.global/28f0537b-f314-4270-9a7e-9f8c6c223e95/V_O_E-Giants.mp3?v=1720102536082"), new Audio("https://cdn.glitch.global/28f0537b-f314-4270-9a7e-9f8c6c223e95/Ace-Adrenaline.mp3?v=1720102538472")];
            this.songChats = [];
            this.isSinging = false;
            this.currentTime = 0;
            for (let e = 0; e < this.songAudios.length; e++) {
                this.songAudios[e].onerror = () => {
                    console.log("Failed loading: Song " + (e + 1));
                };
            }
            this.fetchSongChats();
        }
        resetAllAudios() {
            for (let e = 0; e < this.songAudios.length; e++) {
                let t = this.songAudios[e];
                t.pause();
                t.currentTime = 0;
            }
        }
        async fetchSongChats() {
            try {
                let e = await Promise.all(this.songChatPaths.map((e) => fetch(`https://pond-hallowed-blackcurrant.glitch.me/song-chats?filePath=${e}`).then((e) => e.json())));
                this.songChats = e;
            } catch (t) {
                this.songChats = [];
            }
        }
        toggle() {
            this.songIndx = scriptMenu.toggles.songType;
            this.isSinging = !this.isSinging;
            this.currentTime = 0;
            if (this.isSinging) {
                let e = this.songAudios[this.songIndx];
                e.currentTime = 0;
                this.syncChatIndx = 0;
                e.play();
            } else {
                this.resetAllAudios();
            }
        }
    })();
    const style = document.createElement("style");
    style.textContent = `
         div::-webkit-scrollbar {
            display: none;
         }
    `;
    document.head.appendChild(style);

    var scriptMenu = new (class {
        constructor() {
            this.ignored = [];
            this.items = [];
            this.toggles = {};
            this.keyBinds = {};
            this.keyBindsAction = {};
            this.loadToggles();
            let e = document.createElement("script");
            e.src = "https://cdn.jsdelivr.net/npm/emojione@4.5.0/lib/js/emojione.min.js";
            document.body.appendChild(e);
            this.menu = document.createElement("div");
            this.menu.style = `
                position: absolute;
                opacity: 0;
                pointer-events: none;
                z-index: 1000;
                top: 50%;
                left: 50%;
                width: 700px;
                height: 475px;
                transform: translate(-50%, -50%);
                border-radius: 6px;
                background-color: rgba(0, 0, 0, .6);
                transition: all ease-in .5s;
                overflow: auto;
                scrollbar-width: none;
                -ms-overflow-style: none;
            `;
            this.tabHolder = document.createElement("div");
            this.tabHolder.style = "position: absolute; top: 0px; left: 0px; width: 212.5px; height: calc(100% - 40px); background-color: rgba(0, 0, 0, .1);";
            this.menu.appendChild(this.tabHolder);
            this.socketPing = document.createElement("div");
            this.itemHolder = document.createElement("div");
            this.itemHolder.style = "position: absolute; top: 0px; left: 212.5px; width: calc(100% - 212.5px); height: 100%; overflow: hidden;";
            this.menu.appendChild(this.itemHolder);
            document.body.appendChild(this.menu);
            this.darkModeElement = document.createElement("div");
            this.darkModeElement.style = "opacity: 0; position: absolute; top: 0px; left: 0px; width: 100%; height: 100%; background-color: rgb(0, 0, 70, .25); pointer-events: none; transition: 5s; ";
            document.body.insertBefore(this.darkModeElement, this.menuElement);
            let t = this.initTabs([
                {
                    label: "Home",
                    icon: "https://i.imgur.com/Da9LKoE.png",
                },
                {
                    label: "Combat",
                    icon: "https://i.imgur.com/sR5JnTE.png",
                },
                {
                    label: "Defense",
                    icon: "https://i.imgur.com/0fz1qiE.png",
                },
                {
                    label: "Visual",
                    icon: "https://i.imgur.com/cJOwD3n.png",
                },
                {
                    label: "Bots",
                    icon: "https://i.imgur.com/g6p10wB.png",
                },
                {
                    label: "Logs",
                    icon: "https://i.imgur.com/XWv7qI9.png",
                },
                {
                    label: "Notes",
                    icon: "https://i.imgur.com/9fbjRuw.png",
                },
            ]);
            this.initItems(
                [
                    [
                        {
                            label: "Auto Upgrade",
                            id: "autoUpgrade",
                            type: "group toggle",
                            options: [
                                {
                                    label: "7th Slot",
                                    id: "7thSlot",
                                    type: "select",
                                    options: [
                                        {
                                            label: "Teleport",
                                            selected: true,
                                            value: 38,
                                        },
                                        {
                                            label: "Turret",
                                            value: 33,
                                        },
                                        {
                                            label: "Healing Pad",
                                            value: 35,
                                        },
                                        {
                                            label: "Blocker",
                                            value: 37,
                                        },
                                        {
                                            label: "Platform",
                                            value: 34,
                                        },
                                    ],
                                },
                            ],
                            checked: true,
                        },
                        {
                            label: "Auto Grind",
                            id: "autoGrind",
                            type: "toggle",
                        },
                        {
                            label: "Auto Play",
                            id: "autoPlay",
                            type: "toggle",
                        },
                        {
                            label: "Full FPS",
                            id: "fullFps",
                            type: "toggle",
                        },
                        {
                            label: "Kill Chat",
                            id: "killChat",
                            type: "toggle",
                        },
                        {
                            label: "Kill Message",
                            id: "killChatMessage",
                            type: "text",
                            size: 60,
                            value: "gg {name}",
                        },
                        {
                            label: "Kill Count Message",
                            id: "killCountMessage",
                            type: "text",
                            size: 60,
                            value: "{kills} idiots down",
                        },
                        {
                            label: "Chat Translation",
                            id: "chatTranslate",
                            type: "toggle",
                        },
                        {
                            label: "Mouseless",
                            id: "mouseless",
                            type: "toggle",
                        },
                        {
                            label: "Collect User Stats",
                            id: "collectStats",
                            type: "toggle",
                            checked: window.scriptVersion != "Dev",
                        },
                        {
                            label: "Chat Message Limit",
                            id: "chatLimit",
                            type: "number",
                            value: 3,
                            max: 3,
                            min: 0,
                        },
                        {
                            label: "Placement",
                            type: "group",
                            options: [
                                {
                                    label: "Depth",
                                    id: "placementDepth",
                                    type: "number",
                                    value: 64,
                                    min: 0,
                                },
                                {
                                    label: "Throttle",
                                    id: "placementThrottle",
                                    type: "number",
                                    value: 2,
                                    max: 4,
                                    min: 1,
                                },
                                {
                                    label: "Dual Angle Finding",
                                    id: "dualAngleFinder",
                                    type: "toggle",
                                    checked: true,
                                },
                            ],
                        },
                        {
                            label: "Song Type",
                            id: "songType",
                            type: "select",
                            options: [...singerManager.songs],
                        },
                        {
                            label: "Song Volume",
                            id: "songVolume",
                            type: "number",
                            max: 100,
                            min: 0,
                            value: 100,
                            margin: true,
                        },
                    ],
                    [
                        {
                            label: "Auto Place",
                            id: "autoplace",
                            type: "group toggle",
                            options: [
                                {
                                    label: "Preplacements",
                                    id: "preplace",
                                    type: "toggle",
                                    checked: true,
                                },
                                {
                                    label: "Auto Placer Range",
                                    id: "autoPlacerRange",
                                    type: "number",
                                    value: 400,
                                    max: 14000,
                                    size: 15,
                                    min: 170,
                                },
                            ],
                        },
                        {
                            label: "Auto Push",
                            id: "autopush",
                            type: "group toggle",
                            options: [
                                {
                                    label: "Distance",
                                    id: "autoPushDistance",
                                    type: "number",
                                    max: 800,
                                    value: 300,
                                    min: 0,
                                },
                                {
                                    label: "Override Pathfinding",
                                    id: "pathfindOverride",
                                    type: "toggle",
                                    checked: true,
                                },
                            ],
                            checked: true,
                        },
                        {
                            label: "Auto Hitting",
                            type: "group",
                            options: [
                                {
                                    label: "ATOS Key",
                                    id: "atosKey",
                                    key: "r",
                                    type: "keybind",
                                    logic() {
                                        sendMapPing();
                                    },
                                },
                                {
                                    label: "Auto Insta",
                                    id: "autoInsta",
                                    type: "toggle",
                                    checked: true,
                                },
                                {
                                    label: "Auto Bull Hits",
                                    id: "autohit",
                                    type: "toggle",
                                    checked: true,
                                },
                                {
                                    label: "Melee Sync",
                                    id: "doMeleeSync",
                                    type: "toggle",
                                },
                                {
                                    label: "Spiek Tick",
                                    id: "spiekTick",
                                    type: "group toggle",
                                    checked: true,
                                    options: [
                                        {
                                            label: "Do with Daggers",
                                            id: "doWithDaggers",
                                            type: "toggle",
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            label: "One Tick",
                            type: "group",
                            options: [
                                {
                                    label: "One Tick Key",
                                    id: "oneTickKey",
                                    type: "keybind",
                                    key: "t",
                                    logic() {},
                                },
                                {
                                    label: "Auto One Tick",
                                    id: "autoOneTick",
                                    type: "group toggle",
                                    options: [
                                        {
                                            label: "Ignore Soldier",
                                            id: "oneTickIgnoreSoldier",
                                            type: "toggle",
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            label: "Bullspam",
                            type: "group",
                            options: [
                                {
                                    label: "Allow Intrap",
                                    id: "bullSpamInTrap",
                                    type: "toggle",
                                },
                                {
                                    label: "Safe Dagger Spamming",
                                    id: "safeSoldierSpamming",
                                    type: "toggle",
                                    checked: true,
                                },
                            ],
                            margin: true,
                        },
                    ],
                    [
                        {
                            label: "Auto Replace",
                            id: "autoreplace",
                            type: "toggle",
                            checked: true,
                        },
                        {
                            label: "Auto EMP",
                            id: "autoEMP",
                            type: "toggle",
                            checked: true,
                        },
                        {
                            label: "Auto Buy",
                            id: "autobuy",
                            type: "toggle",
                            checked: true,
                        },
                        {
                            label: "Healing",
                            type: "group",
                            options: [
                                {
                                    label: "Use Soldier-EMP Anti",
                                    id: "soldierEMP",
                                    type: "toggle",
                                    checked: true,
                                },
                                {
                                    label: "Sensitive Healing",
                                    id: "sensitiveHealing",
                                    type: "toggle",
                                    checked: true,
                                },
                            ],
                        },
                        {
                            label: "Auto Breaking",
                            type: "group",
                            options: [
                                {
                                    label: "In Trap",
                                    id: "inTrapBreak",
                                    type: "toggle",
                                    checked: true,
                                },
                                {
                                    label: "Out of Trap",
                                    id: "outOfTrapBreak",
                                    type: "group toggle",
                                    options: [
                                        {
                                            label: "Ignore Soldier",
                                            id: "ignoreSoldierWhenBreakingOutOfTrap",
                                            type: "toggle",
                                            checked: true,
                                        },
                                    ],
                                    checked: true,
                                },
                            ],
                        },
                        {
                            label: "Auto Brake",
                            id: "autoBrake",
                            type: "toggle",
                            checked: true,
                            margin: true,
                        },
                    ],
                    [
                        {
                            label: "Render Knockback Visualization",
                            id: "renderKnockbackVisualization",
                            type: "toggle",
                        },
                        {
                            label: "Health",
                            type: "group",
                            options: [
                                {
                                    label: "Render Building HP",
                                    id: "renderBuildingHP",
                                    type: "toggle",
                                    checked: true,
                                },
                                {
                                    label: "Render Building Damage",
                                    id: "renderBuildingDamage",
                                    type: "toggle",
                                    checked: true,
                                },
                                {
                                    label: "Render Health Text Below Name",
                                    id: "renderHealthText",
                                    type: "toggle",
                                    checked: true,
                                },
                                {
                                    label: "Render Health Text",
                                    id: "renderHealthTextx2",
                                    type: "group toggle",
                                    checked: true,
                                    options: [
                                        {
                                            label: "Speed",
                                            id: "healthTextSpeed",
                                            type: "number",
                                            value: 1,
                                            max: 5,
                                            min: 0.1,
                                        },
                                        {
                                            label: "Scale",
                                            id: "healthTextScale",
                                            type: "number",
                                            value: 50,
                                            max: 100,
                                            min: 1,
                                        },
                                        {
                                            label: "Color (You to Enemy/Animal)",
                                            id: "healthColor",
                                            type: "text",
                                            value: "#fff",
                                        },
                                        {
                                            label: "Color (Enemy to You/Animal)",
                                            id: "healthColorx2",
                                            type: "text",
                                            value: "#8ecc51",
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            label: "GoL",
                            type: "group",
                            options: [
                                {
                                    label: "Render Player/AI Names",
                                    id: "renderNames",
                                    type: "toggle",
                                    checked: true,
                                },
                                {
                                    label: "Tree Fade",
                                    id: "treeFade",
                                    type: "toggle",
                                    checked: true,
                                },
                                {
                                    label: "Mill Rotate",
                                    id: "millRotate",
                                    type: "toggle",
                                    checked: false,
                                },
                                {
                                    label: "Reload Bars",
                                    id: "renderReloadingBars",
                                    type: "group toggle",
                                    checked: true,
                                    options: [
                                        {
                                            label: "On Reload",
                                            id: "renderReloadingBarsOnReload",
                                            type: "toggle",
                                            checked: false,
                                        },
                                        {
                                            label: "Color (Primary)",
                                            id: "renderReloadingBarsColor",
                                            type: "text",
                                            value: "#a5974c"
                                        },
                                        {
                                            label: "Color (secondary)",
                                            id: "renderReloadingBarsColorx2",
                                            type: "text",
                                            value: "#a5974c"
                                        },
                                    ],
                                },
                                {
                                    label: "Stack Damage/Heal Text",
                                    id: "stackText",
                                    type: "toggle",
                                },
                                {
                                    label: "Render Shadows",
                                    id: "renderShadows",
                                    type: "toggle",
                                },
                                {
                                    label: "Render Dark Overlay",
                                    id: "renderDarkMode",
                                    type: "toggle",
                                },
                                {
                                    label: "Render Placements",
                                    id: "renderPlacements",
                                    type: "toggle",
                                    checked: true,
                                },
                            ],
                        },
                        {
                            label: "Render All Traps Transparent",
                            id: "trapsAlwaysTransparent",
                            type: "toggle",
                        },
                        {
                            label: "Render Real Direction",
                            id: "renderRealDir",
                            type: "toggle",
                            margin: true,
                        },
                    ],
                    [
                        {
                            label: "Bot Names",
                            id: "botNames",
                            type: "list",
                        },
                        {
                            label: "General Module",
                            id: "botModule",
                            type: "select",
                            options: [
                                {
                                    label: "Musket Sync",
                                    value: 0,
                                    selected: true,
                                },
                                {
                                    label: "Bow Spam",
                                    value: 1,
                                },
                                {
                                    label: "Object Breaker (Owner)",
                                    value: 2,
                                },
                                {
                                    label: "Object Breaker (All)",
                                    value: 3,
                                },
                            ],
                        },
                        {
                            label: "Movement Module",
                            id: "botMovementModule",
                            type: "select",
                            options: [
                                {
                                    label: "Follow Player",
                                    selected: true,
                                    value: "normal",
                                },
                                {
                                    label: "Circle Player",
                                    value: "circle",
                                },
                                {
                                    label: "Follow Mouse",
                                    value: "mouse",
                                },
                                {
                                    label: "Stop Moving",
                                    value: "stop",
                                },
                            ],
                        },
                        {
                            label: "Autoaim Module",
                            id: "autoaimBotModule",
                            type: "select",
                            options: [
                                {
                                    label: "Nearest to Player",
                                    value: "player",
                                },
                                {
                                    label: "Nearest to Bot",
                                    value: "bot",
                                },
                            ],
                        },
                        {
                            label: "Primary Weapon",
                            id: "botPrimaryWeapon",
                            type: "select",
                            options: [
                                {
                                    label: "Short Sword",
                                    selected: true,
                                    value: 3,
                                },
                                {
                                    label: "Daggers",
                                    value: 7,
                                },
                                {
                                    label: "Polearm",
                                    value: 5,
                                },
                                {
                                    label: "Bat",
                                    value: 6,
                                },
                            ],
                        },
                        {
                            label: "Bot Target Sids",
                            id: "botTargetSids",
                            type: "text",
                            size: 90,
                            value: "",
                        },
                        {
                            label: "Circle Size",
                            id: "botCircleSize",
                            type: "number",
                            value: 300,
                            min: 35,
                            size: 10,
                            max: 6000,
                        },
                        {
                            label: "Player Distance",
                            id: "playerDistance",
                            type: "number",
                            value: 200,
                            min: 35,
                            size: 10,
                            max: 6000,
                        },
                        {
                            label: "Breaking Radius",
                            id: "botBreakingRadius",
                            type: "number",
                            value: 900,
                            min: 200,
                            size: 15,
                            max: 14000,
                        },
                        {
                            label: "Auto Place Traps",
                            id: "botAutoplace",
                            type: "toggle",
                        },
                        {
                            label: "Kill-On Sight",
                            id: "botKillOnSight",
                            type: "toggle",
                        },
                        {
                            label: "Mouse Movement",
                            id: "botMouseMovement",
                            type: "keybind",
                            key: "B",
                            logic() {
                                let e = document.getElementById("select:id:botMovementModule");
                                e.selectedIndex = 2;
                                let t = new Event("change", {
                                    bubbles: true,
                                });
                                e.dispatchEvent(t);
                                textManager.showText(player, 2000, 15, 0, "#fff", "Bot Movement");
                                textManager.showText(
                                    {
                                        x: player.x,
                                        y: player.y + 20,
                                    },
                                    2000,
                                    15,
                                    0,
                                    "#fff",
                                    "Mouse",
                                );
                            },
                        },
                        {
                            label: "Stop Movement",
                            id: "botStopMovement",
                            type: "keybind",
                            key: "O",
                            logic() {
                                let e = document.getElementById("select:id:botMovementModule");
                                e.selectedIndex = 3;
                                let t = new Event("change", {
                                    bubbles: true,
                                });
                                e.dispatchEvent(t);
                                textManager.showText(player, 2000, 15, 0, "#fff", "Bot Movement");
                                textManager.showText(
                                    {
                                        x: player.x,
                                        y: player.y + 20,
                                    },
                                    2000,
                                    15,
                                    0,
                                    "#fff",
                                    "Stop",
                                );
                            },
                        },
                        {
                            label: "Player Movement",
                            id: "botPlayerMovement",
                            type: "keybind",
                            key: "M",
                            logic() {
                                let e = document.getElementById("select:id:botMovementModule");
                                e.selectedIndex = 0;
                                let t = new Event("change", {
                                    bubbles: true,
                                });
                                e.dispatchEvent(t);
                                textManager.showText(player, 2000, 15, 0, "#fff", "Bot Movement");
                                textManager.showText(
                                    {
                                        x: player.x,
                                        y: player.y + 20,
                                    },
                                    2000,
                                    15,
                                    0,
                                    "#fff",
                                    "Player",
                                );
                            },
                        },
                        {
                            label: "Object Breaker (All)",
                            id: "botObjBreakerAll",
                            type: "keybind",
                            key: "b",
                            logic() {
                                let e = document.getElementById("select:id:botModule");
                                e.selectedIndex = 3;
                                let t = new Event("change", {
                                    bubbles: true,
                                });
                                e.dispatchEvent(t);
                                textManager.showText(player, 2000, 15, 0, "#fff", "Bot Module");
                                textManager.showText(
                                    {
                                        x: player.x,
                                        y: player.y + 20,
                                    },
                                    2000,
                                    15,
                                    0,
                                    "#fff",
                                    "Obj Breaker (All)",
                                );
                            },
                        },
                        {
                            label: "Object Breaker (Owner)",
                            id: "botObjBreakerOwner",
                            type: "keybind",
                            key: "o",
                            logic() {
                                let e = document.getElementById("select:id:botModule");
                                e.selectedIndex = 2;
                                let t = new Event("change", {
                                    bubbles: true,
                                });
                                e.dispatchEvent(t);
                                textManager.showText(player, 2000, 15, 0, "#fff", "Bot Module");
                                textManager.showText(
                                    {
                                        x: player.x,
                                        y: player.y + 20,
                                    },
                                    2000,
                                    15,
                                    0,
                                    "#fff",
                                    "Obj Breaker (Owner)",
                                );
                            },
                        },
                        {
                            label: "Musket Sync",
                            id: "botMusketSyncModule",
                            type: "keybind",
                            key: "m",
                            logic() {
                                let e = document.getElementById("select:id:botModule");
                                e.selectedIndex = 0;
                                let t = new Event("change", {
                                    bubbles: true,
                                });
                                e.dispatchEvent(t);
                                textManager.showText(player, 2000, 15, 0, "#fff", "Bot Module");
                                textManager.showText(
                                    {
                                        x: player.x,
                                        y: player.y + 20,
                                    },
                                    2000,
                                    15,
                                    0,
                                    "#fff",
                                    "Musket Sync",
                                );
                            },
                        },
                        {
                            label: "Target Nearest to Player",
                            id: "botTargetNearestToPlayerModule",
                            type: "keybind",
                            key: "G",
                            logic() {
                                let e = document.getElementById("select:id:autoaimBotModule");
                                e.selectedIndex = 0;
                                let t = new Event("change", {
                                    bubbles: true,
                                });
                                e.dispatchEvent(t);
                                textManager.showText(player, 2000, 15, 0, "#fff", "Target Type");
                                textManager.showText(
                                    {
                                        x: player.x,
                                        y: player.y + 20,
                                    },
                                    2000,
                                    15,
                                    0,
                                    "#fff",
                                    "Player",
                                );
                            },
                        },
                        {
                            label: "Target Nearest to Bot",
                            id: "botTargetNearestToSelfModule",
                            type: "keybind",
                            key: "T",
                            logic() {
                                let e = document.getElementById("select:id:autoaimBotModule");
                                e.selectedIndex = 1;
                                let t = new Event("change", {
                                    bubbles: true,
                                });
                                e.dispatchEvent(t);
                                textManager.showText(player, 2000, 15, 0, "#fff", "Target Type");
                                textManager.showText(
                                    {
                                        x: player.x,
                                        y: player.y + 20,
                                    },
                                    2000,
                                    15,
                                    0,
                                    "#fff",
                                    "Bot",
                                );
                            },
                        },
                        {
                            label: "Bot Trap Placer",
                            id: "botToggleTrapPlacer",
                            type: "keybind",
                            key: "p",
                            logic: () => {
                                document.getElementById("toggle:id:botAutoplace").click();
                                textManager.showText(player, 2000, 15, 0, "#fff", "Bot Autoplace");
                                textManager.showText(
                                    {
                                        x: player.x,
                                        y: player.y + 20,
                                    },
                                    2000,
                                    15,
                                    0,
                                    "#fff",
                                    this.toggles.botAutoplace ? "Enabled" : "Disabled",
                                );
                            },
                            margin: true,
                        },
                    ],
                    [],
                    [
                        {
                            label: "Chat commands",
                            type: "group",
                            options: [],
                            text: `
                   Chicken mod also has tons of chat commands!<br><br>
                   Use the ${this.highlightText('"!cbot *message*"')} command to make all active bots chat the message.<br>
                   Use the ${this.highlightText('"!play *sid*"')} command to play as a bot.<br>
                   Use the ${this.highlightText('"!play stop"')} command to stop playing as a bot.<br>
                   Use the ${this.highlightText('"!clan"')} command to quick create a clan.
                   Use the ${this.highlightText('"!target/untarget *sid*"')} command to target/untarget a sid for priority aimming for the bots.<br>
                   Use the ${this.highlightText('"!ignore *sid/name*"')} command to make the chatlogger ignore players with name/sid.<br>
                   Use the ${this.highlightText('"!stop *sid/name*"')} command to make the chatlogger stop ignoring players with name/sid.<br><br>
                   Please note that when ignoring/unignoring players with the name function of the command, values are case-sensitive.
                   `,
                        },
                        {
                            label: "Private chat",
                            type: "group",
                            options: [],
                            text: `
                   Chicken mod has its own built-in chat feature! You can chat with other users privately without outsiders knowing!<br><br>
                   Use the ${this.highlightText('"Alt / Option"')} key along with enter, to quick select the private chat box.<br>
                   Use the command ${this.highlightText('"!clear"')} on the private chatbox, to manually clear the chatlog<br><br>
                   You can also use the private chat inside the ${this.highlightText("Logs")} section of the menu!
                   `,
                        },
                        {
                            label: "Bots",
                            type: "group",
                            options: [],
                            text: `
                   ${this.highlightText("Playing as a bot")}: When playing as a bot, your main player becomes unresponsive and all inputs are redirected the to bot you are playing. Please also note that when playing as a bot, it may be impossible to return to playing normally because of object rendering glitches that mega refuses to fix.<br>
                   ${this.highlightText("Recommended bots to use")}: It is recommended to use at most ${this.highlightText("20")} bots. Although chicken mod supports up to 38, it may get laggy if your computer/wifi can't handle the mass amount of data transfer that's required to maintain bots.
                   `,
                        },
                        {
                            label: "Useful trivia",
                            type: "group",
                            options: [],
                            text: `
                   When autobreak is being dumb (breaking object when it's out of range), hold the ${this.highlightText('"Shift"')} key to force it to hit trap.<br>
                   If the script gets stuck/bugged, you can press the ${this.highlightText('"Z"')} key to try and debug the script. Please note that depending on the type of bug, the key might not always work.<br>
                   The ${this.highlightText('"Melee Sync"')} toggle only melee syncs with other chicken mod users (if they have the toggle on as well).<br><br>
                   The ${this.highlightText('"X ms / X bots"')} display on the menu are self-explanatory: X ms stands for your ping for chicken mod's built-in websocket, and X bots means the total amount of active bots in the server
                   `,
                        },
                        {
                            label: "Admin controls",
                            type: "group",
                            options: [],
                            text: `
                   If you are a chicken admin, to access the admin-console: <a href="https://pond-hallowed-blackcurrant.glitch.me/users">click here</a><br><br>
                   Use the command ${this.highlightText('"!cinvis *boolean*"')}, to hide your username from other chicken users.<br>
                   Use the command ${this.highlightText('"!cjumpscare"')}, to jumpscare other chicken mod users.<br>
                   Use the command ${this.highlightText('"!cfreeze *sid* *duration=in_seconds*"')}, freeze a chicken user for X seconds.<br>
                   Use the command ${this.highlightText('"!ckick *sid*"')}, kicks a chicken user from the game.
                   `,
                        },
                        {
                            label: "Credits",
                            type: "group",
                            options: [],
                            text: `
                   Credits goes to: ${this.highlightText("Me")}, ${this.highlightText("Myself")}, and ${this.highlightText("I")} for designing and coding the menu.<br>
                   Credits goes to: ${this.highlightText("Luchador")} and ${this.highlightText("ele5570")} for making the core logic that makes chicken mod, chicken mod!<br>
                   Credits goes to: ${this.highlightText("Mega")} for maintaining the script for years and keeping the script ${this.highlightText('"up-to-date"')}.<br>
                   <div style="font-size: 4px">self glaze op</div>
                   `,
                            margin: true,
                        },
                    ],
                ],
                t,
            );
        }
        highlightText(e) {
            return `<span style="color: #f00;">${e}</span>`;
        }
        loggerFunction(e) {
            if (e == "clear" || e == "autoclear") {
                this.privateLogger.innerHTML = "";
                this.chatLog.innerHTML = `
               <div style="font-size: 13px; margin-left: 5px; margin-top: 5px;">
               <span style="color: #fff">${this.getCurrentTime()} - </span>
               <span style="color: #ffff00">${e == "autoclear" ? "Auto cleared chat logger" : "Cleared chat logger"}</span>
               </div>
               `;
            } else {
                this.chatLog.innerHTML += `
               <div style="font-size: 13px; margin-left: 5px; margin-top: 0px;">
               <span style="color: #fff">${this.getCurrentTime()} - </span>
               <span style="color: #9e9e9e">${e}</span>
               </div>
               `;
                this.autoScroll(player.sid, player.name);
            }
        }
        convertEmojis(e) {
            return emojione.shortnameToUnicode(e);
        }
        changeTab(e, t) {
            this.oldTab.style.backgroundColor = null;
            this.oldTab.style.pointerEvents = null;
            e.style.backgroundColor = "rgba(255, 255, 255, .25)";
            e.style.pointerEvents = "none";
            this.oldTab = e;
            for (let i = 0; i < this.items.length; i++) {
                this.items[i].style.top = `${(i - t) * 475}px`;
            }
        }
        initTabs(e) {
            this.tabHolder.innerHTML = `
               <div style="position: absolute; font-size: 25px; left: 50%; top: 20px; color: #fff; transform: translateX(-50%);">unX</div>
               <div style="position: absolute; font-size: 15px; right: 47.5px; top: 12.5px; color: #fff; text-shadow: 0 0 10px #fff, 0 0 20px #fff, 0 0 30px #fff, 0 0 40px #00f, 0 0 70px #00f, 0 0 80px #00f, 0 0 100px #00f, 0 0 150px #00f;">V4.6.2</div>
           `;
            for (let t = 0; t < e.length; t++) {
                let i = e[t];
                let s = document.createElement("div");
                s.id = `tab:${t}`;
                s.style = "cursor: pointer; transition: all linear .35s; display: flex; align-items: center; width: calc(100% - 20px); height: 30px; position: absolute; left: 10px; border-radius: 6px;";
                s.style.top = `${t * 35 + 65}px`;
                s.innerHTML = `
               <img src="${i.icon}" width="20" height="20" style="margin-left: 2px;">
               <div style="color: white; margin-left: 5px;">${i.label}</div>
               `;
                s.onmouseout = () => {
                    if (s.id !== this.oldTab.id) {
                        s.style.backgroundColor = null;
                    }
                };
                s.onmouseover = function () {
                    this.style.backgroundColor = "rgba(255, 255, 255, .25)";
                };
                s.onclick = () => {
                    this.changeTab(s, t);
                };
                if (t == 0) {
                    s.style.backgroundColor = "rgba(255, 255, 255, .25)";
                    s.style.pointerEvents = "none";
                    this.oldTab = s;
                }
                this.tabHolder.appendChild(s);
            }
            return e;
        }
        getCurrentTime() {
            let e = new Date();
            let t = e.getHours();
            let i = e.getMinutes();
            let s;
            return `${t % 12 == 0 ? 12 : t % 12}:${i < 10 ? `0${i}` : i} ${t >= 12 ? "PM" : "AM"}`;
        }
        createTag(e, t, i) {
            let s = t.value;
            let n = document.createElement("div");
            n.style = "cursor: pointer; display: inline-block; font-size: 12px; background-color: rgba(255, 255, 255, 0.25); padding: 1px 6px 1px 6px; border-radius: 6px; margin: 3px;";
            n.innerHTML = s;
            n.onclick = () => {
                let e = this.toggles[i].findIndex((e) => e == s);
                if (e >= 0) {
                    this.toggles[i].splice(e, 1);
                }
                n.remove();
            };
            e.insertBefore(n, t);
        }
        generateDefaultNames() {
            let e = ["Tamer", "Damper", "Vajra", "Punisher", "Spark", "Razdor", "Molot", "Ecu", "Gust", "Magnum", "Halo", "Jaw", "Claw", "Talon", "Atomizer", "Thunder", "Brisant", "Reaper", "Evora", "Veyron", "Glory", "Subduer", "Talon", "Punisher", "Lance", "Fengbao", "Leiming"];
            let t = ["Luchador", "Ochokochi", "Fenrir", "Fafnir", "Curie", "Indra", "Rook", "Ravana", "Hover", "Bulwark", "Lynx", "Ares", "Ao Jun", "Ophion", "Revenant", "Aether", "Nether", "Shenlou", "Pathfinder"];
            let i = [];
            for (let s = 0; s < 20; s++) {
                let n;
                let a = `${e[Math.floor(Math.random() * e.length)]}${t[Math.floor(Math.random() * t.length)]}`;
                i.push(a.slice(0, 15));
            }
            return [...new Set(i)];
        }
        saveToggles() {
            localStorage.setItem('menuToggles', JSON.stringify(this.toggles));
            localStorage.setItem('menuKeyBinds', JSON.stringify(this.keyBinds));
        }

        loadToggles() {
            const saved = localStorage.getItem('menuToggles');
            const savedKeys = localStorage.getItem('menuKeyBinds');
            if (saved) this.toggles = JSON.parse(saved);
            if (savedKeys) this.keyBinds = JSON.parse(savedKeys);
        }
        Builder(e, t, i, s) {
            if (e.type == "toggle") {
                if (!e.id) {
                    throw Error("No ID found for ON/OFF TOGGLE");
                }
                let n = document.createElement("div");
                n.style = "position: relative; color: white; display: flex; align-items: center; margin-left: 10px; width: calc(100% - 20px); height: 40px; background-color: rgba(0, 0, 0, .25); border-radius: 6px;";
                if (s) {
                    n.style.position = "absolute";
                    n.style.top = `${i * 45 + 45}px`;
                }
                if (i > 0) {
                    n.style.marginTop = "5px";
                }
                if (e.margin) {
                    n.style.marginBottom = "10px";
                }
                n.innerHTML = `
           <div style="margin-left: 5px;">${e.label}</div>
           `;
                let a = document.createElement("div");
                a.id = `toggle:id:${e.id}`;
                a.style = "position: absolute; cursor: pointer; display: flex; align-items: center; top: 5px; right: 10px; width: 55px; height: 30px; background-color: #ccc; border-radius: 16px; transition: 0.2s ease-out;";
                let l = document.createElement("div");
                l.style = "background-color: white; width: 22px; height: 22px; border-radius: 100%; position: absolute; transform: translateX(5px); transition: 0.2s ease-out;";
                a.appendChild(l);
                a.onclick = () => {
                    if ((this.toggles[e.id] = !this.toggles[e.id])) {
                        a.style.backgroundColor = "#2196f3";
                        l.style.transform = "translateX(28px)";
                        if (e.id == "renderDarkMode") {
                            this.darkModeElement.style.opacity = 1;
                        }
                    } else {
                        a.style.backgroundColor = "#ccc";
                        l.style.transform = "translateX(5px)";
                        if (e.id == "renderDarkMode") {
                            this.darkModeElement.style.opacity = 0;
                        }
                    }
                    this.saveToggles();
                };
                n.appendChild(a);
                if (this.toggles[e.id] === undefined) {
                    this.toggles[e.id] = e.checked || false;
                }
                if (this.toggles[e.id]) {
                    a.style.backgroundColor = "#2196f3";
                    l.style.transform = "translateX(28px)";
                    if (e.id === "renderDarkMode") {
                        this.darkModeElement.style.opacity = 1;
                    }
                } else {
                    a.style.backgroundColor = "#ccc";
                    l.style.transform = "translateX(5px)";
                }

                t.appendChild(n);
            } else if (e.type == "group") {
                let o = e.options;
                let r = document.createElement("div");
                r.style = "position: relative; margin-left: 10px; width: calc(100% - 20px); background-color: rgba(0, 0, 0, .25); padding-top: 25px; padding-bottom: 7px; border-radius: 6px;";
                if (e.margin) {
                    r.style.marginBottom = "10px";
                }
                let c = document.createElement("div");
                c.style = "position: absolute; left: 0px; top: 4px; color: white; width: 100%; text-align: center;";
                c.innerText = e.label;
                r.appendChild(c);
                let d = document.createElement("div");
                if (e.text) {
                    d.style = "margin-left: 6px; color: white; max-width: calc(100% - 12px);";
                    d.innerHTML = e.text;
                    r.appendChild(d);
                }
                if (i > 0) {
                    r.style.marginTop = "7px";
                }
                for (let p = 0; p < o.length; p++) {
                    let h = o[p];
                    this.Builder(h, r, p);
                }
                t.appendChild(r);
            } else if (e.type == "number" || e.type == "text") {
                let g = document.createElement("div");
                g.style = "position: relative; color: white; display: flex; align-items: center; margin-left: 10px; width: calc(100% - 20px); height: 40px; background-color: rgba(0, 0, 0, .25); border-radius: 6px;";
                if (i > 0) {
                    g.style.marginTop = "5px";
                }
                if (e.margin) {
                    g.style.marginBottom = "10px";
                }
                if (s) {
                    g.style.position = "absolute";
                    g.style.top = `${i * 45 + 45}px`;
                }
                g.innerHTML = `
           <div style="margin-left: 5px;">${e.label}</div>
           `;
                let $ = document.createElement("input");
                $.type = "text";
                $.id = `input:id:${e.id}`;
                $.style = `padding-left: 4px; box-shadow: none; outline: none; border: none; width: ${40 + (e.size || 0)}px; height: 30px; font-size: 12px; border-radius: 4px; color: white; background-color: rgba(255, 255, 255, .25); position: absolute; right: 10px;`;
                if (this.toggles[e.id] === undefined) this.toggles[e.id] = e.value;
                $.value = this.toggles[e.id];
                g.appendChild($);
                $.oninput = () => {
                    if (e.type == "number") {
                        if ($.value === "") {
                            return;
                        }

                        let t = parseFloat($.value);
                        if (!isNaN(t)) {
                            this.toggles[e.id] = t;
                            if (e.id == "songVolume") {
                                for (let i = 0; i < singerManager.songAudios.length; i++) {
                                    singerManager.songAudios[i].volume = t / 100;
                                }
                            }
                        }
                    } else {
                        this.toggles[e.id] = $.value;
                    }
                    this.saveToggles();
                };
                if (e.type == "number") {
                    $.onblur = () => {
                        let t = parseFloat($.value);
                        if (isNaN(t) || $.value === "") {
                            $.value = e.min || 0;
                            t = e.min || 0;
                        } else if (e.min !== undefined && t < e.min) {
                            $.value = e.min;
                            t = e.min;
                        } else if (e.max !== undefined && t > e.max) {
                            $.value = e.max;
                            t = e.max;
                        }
                        this.toggles[e.id] = t;

                        if (e.id == "songVolume") {
                            for (let i = 0; i < singerManager.songAudios.length; i++) {
                                singerManager.songAudios[i].volume = t / 100;
                            }
                        }
                        this.saveToggles();
                    };
                }

                t.appendChild(g);
            } else if (e.type == "group toggle") {
                let m = document.createElement("div");
                m.style = "position: relative; transition: .3s ease-in; color: white; display: flex; align-items: center; margin-left: 10px; width: calc(100% - 20px); height: 40px; background-color: rgba(0, 0, 0, .25); border-radius: 6px; overflow: hidden;";
                if (i > 0) {
                    m.style.marginTop = "5px";
                }
                if (e.margin) {
                    m.style.marginBottom = "10px";
                }
                m.innerHTML = `
           <div style="display: flex; align-items: center; top: 0px; left: 5px; height: 40px; position: absolute;">${e.label}</div>
           `;
                let u = document.createElement("div");
                u.id = `toggle:id:${e.id}`;
                u.style = "position: absolute; cursor: pointer; display: flex; align-items: center; top: 5px; right: 10px; width: 55px; height: 30px; background-color: #ccc; border-radius: 16px; transition: 0.2s ease-out;";
                let f = document.createElement("div");
                f.style = "background-color: white; width: 22px; height: 22px; border-radius: 100%; position: absolute; transform: translateX(5px); transition: 0.2s ease-out;";
                u.appendChild(f);
                u.onclick = () => {
                    let t = e.options.length;
                    if ((this.toggles[e.id] = !this.toggles[e.id])) {
                        u.style.backgroundColor = "#2196f3";
                        f.style.transform = "translateX(28px)";
                        m.style.height = `${t * 45 + 55}px`;
                    } else {
                        u.style.backgroundColor = "#ccc";
                        f.style.transform = "translateX(5px)";
                        m.style.height = "40px";
                    }
                    this.saveToggles();
                };
                for (let y = 0; y < e.options.length; y++) {
                    let x = e.options[y];
                    this.Builder(x, m, y, true);
                }
                m.appendChild(u);
                if (this.toggles[e.id] === undefined) {
                    this.toggles[e.id] = e.checked || false;
                }
                if (this.toggles[e.id]) {
                    u.style.backgroundColor = "#2196f3";
                    f.style.transform = "translateX(28px)";
                    m.style.height = `${e.options.length * 45 + 55}px`;
                } else {
                    u.style.backgroundColor = "#ccc";
                    f.style.transform = "translateX(5px)";
                    m.style.height = "40px";
                }

                t.appendChild(m);
            } else if (e.type == "select") {
                let b = document.createElement("div");
                b.style = "position: relative; color: white; display: flex; align-items: center; margin-left: 10px; width: calc(100% - 20px); height: 40px; background-color: rgba(0, 0, 0, .25); border-radius: 6px;";
                if (i > 0) {
                    b.style.marginTop = "5px";
                }
                if (e.margin) {
                    b.style.marginBottom = "10px";
                }
                if (s) {
                    b.style.position = "absolute";
                    b.style.top = `${i * 45 + 45}px`;
                }
                b.innerHTML = `
           <div style="margin-left: 5px;">${e.label}</div>
           `;
                let k = document.createElement("select");
                k.id = `select:id:${e.id}`;
                k.style = "padding-left: 4px; cursor: pointer; box-shadow: none; outline: none; border: none; height: 30px; font-size: 12px; border-radius: 4px; color: white; background-color: rgba(255, 255, 255, .25); position: absolute; right: 10px;";
                b.appendChild(k);
                for (let _ = 0; _ < e.options.length; _++) {
                    let v = e.options[_];
                    let isSelected = this.toggles[e.id] !== undefined ? String(this.toggles[e.id]) === String(v.value) : v.selected;
                    k.innerHTML += `<option value="${v.value}" ${isSelected ? "selected" : ""}>${v.label}</option>`;
                    if (v.selected && this.toggles[e.id] === undefined) {
                        this.toggles[e.id] = v.value;
                    }
                }
                k.onchange = () => {
                    this.toggles[e.id] = k.value;
                    this.saveToggles();
                };
                t.appendChild(b);
            } else if (e.type == "list") {
                let w = document.createElement("div");
                w.style = "position: relative; color: white; display: flex; align-items: center; margin-left: 10px; width: calc(100% - 20px); height: 200px; background-color: rgba(0, 0, 0, .25); border-radius: 6px;";
                if (e.margin) {
                    w.style.marginBottom = "10px";
                }
                let T = document.createElement("div");
                T.style = "position: absolute; top: 3px; width: 100%; text-align: center;";
                T.innerText = e.label;
                w.appendChild(T);
                let S = document.createElement("div");
                S.style = "position: absolute; bottom: 10px; left: 10px; width: calc(100% - 20px); height: 160px; background-color: rgba(255, 255, 255, 0.25); border-radius: 6px; overflow: hidden; overflow-y: scroll;";
                w.appendChild(S);
                S.onclick = () => {
                    I.focus();
                };
                if (this.toggles[e.id] == undefined) {
                    this.toggles[e.id] = this.generateDefaultNames();
                }
                let I = document.createElement("input");
                I.maxLength = "15";
                I.type = "text";
                I.placeholder = "Enter here";
                I.style = "color: white; background: none; height: 26px; border-radius: 6px; outline: none; box-shadow: none; border: none;";
                S.appendChild(I);

                let keydownHandler = (t) => {
                    if (document.activeElement === I && t.key == ",") {
                        if (I.value && !this.toggles[e.id].find((e) => e == I.value)) {
                            this.createTag(S, I, e.id);
                            this.toggles[e.id].push(I.value);
                        }
                        I.blur();
                        I.value = "";
                    }
                };

                document.addEventListener("keydown", keydownHandler);

                for (let B = 0; B < this.toggles[e.id].length; B++) {
                    I.value = this.toggles[e.id][B];
                    this.createTag(S, I, e.id);
                }
                I.value = "";
                let D = document.createElement("div");
                D.style = "font-size: 8px; position: absolute; top: 20px; left: 13px;";
                D.innerText = "Enter a comma after each name";
                w.appendChild(D);
                t.appendChild(w);
            } else if (e.type == "keybind") {
                let E = document.createElement("div");
                E.style = "position: relative; color: white; display: flex; align-items: center; margin-left: 10px; width: calc(100% - 20px); height: 40px; background-color: rgba(0, 0, 0, .25); border-radius: 6px;";
                if (i > 0) {
                    E.style.marginTop = "5px";
                }
                if (e.margin) {
                    E.style.marginBottom = "10px";
                }
                E.innerHTML = `
           <div style="margin-left: 5px;">${e.label}</div>
           `;
                let P = document.createElement("button");
                P.style = "color: white; top: 5px; cursor: pointer; outline: none; width: 50px; position: absolute; right: 10px; height: 30px; border: none; border-radius: 6px; background-color: rgba(255, 255, 255, .4);";
                if (this.keyBinds[e.id] === undefined) this.keyBinds[e.id] = e.key;
                P.innerText = this.keyBinds[e.id];
                this.keyBindsAction[e.id] = e.logic;

                let currentListener = null;

                P.onclick = () => {
                    if (currentListener) return;

                    P.innerText = "-";

                    let keydownHandler = (keyEvent) => {
                        if (keyEvent.key == "Escape") {
                            this.keyBinds[e.id] = "N/A";
                            P.innerText = "N/A";
                            document.removeEventListener("keydown", keydownHandler);
                            currentListener = null;
                            this.saveToggles();
                        } else if (keyEvent.key != "Shift" && keyEvent.key != "Alt" && keyEvent.key != "Meta" && keyEvent.key != "Control" && keyEvent.key != "-") {
                            this.keyBinds[e.id] = keyEvent.key;
                            P.innerText = keyEvent.key;
                            document.removeEventListener("keydown", keydownHandler);
                            currentListener = null;
                            this.saveToggles();
                        }
                        keyEvent.preventDefault();
                    };

                    currentListener = keydownHandler;
                    document.addEventListener("keydown", keydownHandler);
                };
                E.appendChild(P);
                t.appendChild(E);
            }
        }
        insertToggles(e, t) {
            for (let i = 0; i < e.length; i++) {
                let s = e[i];
                this.Builder(s, t, i);
            }
        }
        initItems(e, t) {
            for (let i = 0; i < t.length; i++) {
                let s = document.createElement("div");
                s.id = `item:${i}`;
                s.style = `position: absolute; top: ${i * 475}px; left: 0px; width: 100%; height: 100%; transition: all ease-in .3s;`;
                s.innerHTML = `<div style="margin-top: 7px; margin-left: 10px; font-size: 24px; color: white;">${t[i].label}</div>`;
                if (i == 5) {
                    s.innerHTML += `
                   <div id="chatLog" style="position: absolute; top: 45px; left: 10px; width: calc(100% - 20px); height: calc(100% - 90px); border-radius: 6px; background-color: rgba(255, 255, 255, .1); overflow: hidden; overflow-y: scroll;"></div>
                   <input id="privChatBox" placeholder="To chat: click here or press 'Enter' key" style="color: white; box-shadow: none; outline: none; left: 10px; bottom: 10px; height: 30px; position: absolute; border-radius: 5px; width: calc(100% - 20px); background: rgb(255, 255, 255, .15); border: none;">
                   `;
                }
                if (i != 5) {
                    let n = document.createElement("div");
                    n.style = "position: relative; width: 100%; height: calc(100% - 37px); overflow: hidden; overflow-y: scroll;";
                    s.appendChild(n);
                    let a = e[i];
                    if (a) {
                        this.insertToggles(a, n);
                    }
                }
                this.items.push(s);
                this.itemHolder.appendChild(s);
            }
            this.chatLog = document.getElementById("chatLog");
            this.privChatBox = document.getElementById("privChatBox");
            this.addLog("init");
            let l = document.createElement("style");
            l.innerHTML = `
               .chicken-chat-box {
                   color: white;
               }

               .chicken-chat-box::placeholder {
                   color: #ffc0cb;
               }
           `;
            document.body.appendChild(l);
            this.chickenChatBox = document.createElement("input");
            this.chickenChatBox.type = "text";
            this.chickenChatBox.classList.add("chicken-chat-box");
            this.chickenChatBox.placeholder = "Enter Message";
            this.chickenChatBox.style = "box-shadow: none; outline: none; padding: 6px; font-size: 20px; color: #fff; background-color: rgba(0, 0, 0, 0.25); border-radius: 4px; pointer-events: all; border: 0; margin-bottom: 10px;";
            chatHolder.insertBefore(this.chickenChatBox, chatHolder.firstChild);
            this.privateLogger = document.createElement("div");
            this.privateLogger.style = "pointer-events: all; position: absolute; width: 275px; max-height: 200px; bottom: 20px; left: 160px; overflow-y: scroll;";
            gameUI.appendChild(this.privateLogger);
            this.privateLogger.onmouseover = () => {
                this.privateLogger.isHovered = true;
            };
            this.privateLogger.onmouseout = () => {
                this.privateLogger.isHovered = false;
            };
        }
        autoScroll(e, t) {
            if (this.menu.style.opacity == 0) {
                this.chatLog.scrollTop = this.chatLog.scrollHeight;
            } else if (this.oldTab.id != "tab:5") {
                this.chatLog.scrollTop = this.chatLog.scrollHeight;
            } else if (e == player.sid && t == player.name) {
                this.chatLog.scrollTop = this.chatLog.scrollHeight;
            }
            if (!this.privateLogger.isHovered) {
                this.privateLogger.scrollTop = this.privateLogger.scrollHeight;
            }
        }
        addLog(e, t, i, s, n, a) {
            if (t) {
                if (t.length > 100) {
                    return;
                }
                t = t.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                let l = 0;
                for (let o = 0; o < t.length; o++) {
                    if (t[o] == "@" && ++l > 4) {
                        return;
                    }
                }
                if (s && this.ignored.includes(s)) {
                    return "Ignored Player";
                }
                if (i && this.ignored.find((e) => typeof e == "string" && !!i.includes(e))) {
                    return "Ignored Player";
                }
                if (t && t.includes("WHY DIE XDDD '")) {
                    return "Ignored bot msg";
                }
            }
            if (this.chatLog.scrollHeight >= 3500) {
                this.loggerFunction("autoclear");
            }
            if (e == "init") {
                this.chatLog.innerHTML += `
               <div style="font-size: 13px; margin-left: 5px; margin-top: 5px;">
               <span style="color: #fff">${this.getCurrentTime()} - </span>
               <span style="color: #0f0">Successfully imported chicken mod remake by: kwyxl/ail</span>
               </div>
               `;
            } else if (e == "chat") {
                this.chatLog.innerHTML += `
               <div style="font-size: 13px; margin-left: 5px;">
               <span style="color: #fff">${this.getCurrentTime()} - </span>
               <span style="color: #fff">${i} {${s}}${n ? '<span style="color: #f00"> (translated)</span>' : ""}:</span>
               <span style="color: ${a || "#fff"}">${t}</span>
               </div>
               `;
                this.autoScroll(s, i);
            } else if (e == "private") {
                this.privateLogger.innerHTML += `
               <div style="font-size: 13px; margin-left: 5px;">
               <span style="color: #fff">${this.getCurrentTime()} - </span>
               <span style="color: #fff">${i} {${s}}:</span>
               <span style="color: ${a || "#fff"}">${t}</span>
               </div>
               `;
                this.chatLog.innerHTML += `
               <div style="font-size: 13px; margin-left: 5px;">
               <span style="color: #fff">${this.getCurrentTime()} - </span>
               <span style="color: #fff">${i} {${s}}</span>
               <span style="color: #f00">(private message):</span>
               <span style="color: ${a || "#fff"}">${t}</span>
               </div>
               `;
                this.autoScroll(s, i);
            } else if (e == "encountered") {
                this.chatLog.innerHTML += `
               <div style="font-size: 13px; margin-left: 5px;">
               <span style="color: #fff">${this.getCurrentTime()} - </span>
               <span style="color: #ffff00">encountered: ${i} {${s}}</span>
               </div>
               `;
                this.autoScroll(s, i);
            } else if (e == "death") {
                this.chatLog.innerHTML += `
               <div style="font-size: 13px; margin-left: 5px;">
               <span style="color: #fff">${this.getCurrentTime()} - </span>
               <span style="color: #f00">${i} {${s}} has died ${s == playerSID ? t : ""}</span>
               </div>
               `;
                this.autoScroll(s, i);
            } else if (e == "left") {
                this.chatLog.innerHTML += `
               <div style="font-size: 13px; margin-left: 5px;">
               <span style="color: #fff">${this.getCurrentTime()} - </span>
               <span style="color: #f00">${i} {${s}} has left the game</span>
               </div>
               `;
                this.autoScroll(s, i);
            }
        }
        toggleMenu() {
            if ((this.menu.style.opacity || 1) == 1) {
                this.menu.style.opacity = 0;
                this.menu.style.pointerEvents = "none";
            } else {
                this.menu.style.opacity = 1;
                this.menu.style.pointerEvents = "auto";
            }
        }
        doKeyBindActions(e) {
            for (let t in this.keyBindsAction) {
                let i = this.keyBindsAction[t];
                for (let s in this.keyBinds) {
                    if (s == t) {
                        let n;
                        if (this.keyBinds[s] == e.key) {
                            i();
                        }
                        break;
                    }
                }
            }
        }
    })();
    class AnimText {
        constructor(x, y, duration, scale, speed, color, value, { BuildingDmg }) {
            this.x = x;
            this.y = y;
            this.speed = speed;
            this.totalDuration = 0.85 * duration;
            this.duration = duration
            this.scale = scale;
            this.color = color;
            this.value = value;
            this.oldScale = scale;
            this.maxScale = this.scale * 1.3;
            this.minScale = this.scale * 0.15;
            this.animationState = 0;
            this.BuildingDmg = BuildingDmg;
            this.easingDuration = 0.3 * duration;
            this.elapsedTime = 0;
        }
        easeInOutQuad(t) {
            return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        }
        update(delta) {
            this.duration -= delta;
            this.y -= this.speed * delta;

            if (isNaN(parseInt(this.value)) || this.BuildingDmg) {
                this.elapsedTime += delta;
                let t;

                if (this.animationState === 0) {
                    t = Math.min(this.elapsedTime / this.easingDuration, 1);
                    this.scale = this.oldScale + (this.maxScale - this.oldScale) * this.easeInOutQuad(t);
                    if (t >= 1) {
                        this.animationState++;
                        this.elapsedTime = 0;
                    }
                } else {
                    t = Math.min(this.elapsedTime / (this.totalDuration - this.easingDuration), 1);
                    this.scale = this.maxScale - (this.maxScale - this.minScale) * this.easeInOutQuad(t);
                }

                if (this.scale <= 0) this.scale = 0;
            }
        }

        render(mainContext, xOff, yOff) {
            mainContext.save();
            mainContext.textBaseline = "middle";
            mainContext.textAlign = "center";
            if (isNaN(parseInt(this.value)) || this.BuildingDmg) {
                mainContext.lineWidth = 7;
                mainContext.strokeStyle = "black";
            }
            mainContext.fillStyle = this.color;
            mainContext.font = this.scale + "px Hammersmith One";
            if (isNaN(parseInt(this.value)) || this.BuildingDmg) mainContext.strokeText(this.value, this.x - xOff, this.y - yOff);
            mainContext.fillText(this.value, this.x - xOff, this.y - yOff);
            mainContext.restore();
        }
    }
    class TextManager {
        constructor() {
            this.texts = [];
        }
        update(delta, mainContext, xOff, yOff) {
            for (let i = 0; i < this.texts.length; i++) {
                let text = this.texts[i];
                if (text) {
                    if (text.duration > 0) {
                        text.update(delta);
                        text.render(mainContext, xOff, yOff);
                    } else {
                        this.texts.splice(i, 1);
                    }
                }
            }
        }
        showText(pos, duration, scale, speed, color, value, objParameters = {}) {
            if (scriptMenu.toggles.renderHealthTextx2 || Object.keys(objParameters).length) {
                let v = scriptMenu.toggles.renderHealthTextx2 && !Object.keys(objParameters).length && typeof value == "number" ? [scriptMenu.toggles.healthTextSpeed, scriptMenu.toggles.healthTextScale, scriptMenu.toggles.healthColor, scriptMenu.toggles.healthColorx2] : [1, scale, color, color];
                this.texts.push(new AnimText(pos.x, pos.y, duration / v[0], v[1], speed * v[0], typeof value == "number" ? (color == "#fff" ? v[2] : v[3]) : color, value, objParameters));
            }
        }
    }

    let animText = { AnimText, TextManager };
    var textManager = new animText.TextManager();
    function keyDown(e) {
        let t = e.which || e.keyCode || 0;
        let i = e.key;
        if (t == 27) {
            hideAllWindows();
            scriptMenu.privChatBox.blur();
            scriptMenu.privChatBox.value = "";
            scriptMenu.toggleMenu();
        } else if (player && player.alive && keysActive() && !keys[t]) {
            keys[t] = 1;
            placer.hotkeys();
            if (t == 69) {
                chicken.sendAutoGather();
            } else if (i == "=") {
                maxScreenWidth = config.maxScreenWidth;
                maxScreenHeight = config.maxScreenHeight;
                resize();
                updateCursorLocation();
            } else if (i == scriptMenu.keyBinds.oneTickKey) {
                instaManager.holdModeOT = true;
            } else if (i == "P");
            else if (i == "C") {
                singerManager.toggle();
            } else if (i == "Z") {
                keys = {};
                gameObjectSprites = {};
                itemSprites = {};
                pingTracker.data = {};
                hatSystem.resetAllForcedAddOns();
                hatSystem.velSoldier = false;
                hatSystem.spikeSoldier = false;
                game.tick = 0;
                game.tickBase = [];
                game.doNextTick = [];
                attackState = 0;
                chicken.autoaim = false;
                chicken.onClick.tank = false;
                chicken.grid = undefined;
                placer.markers = [];
                game.buildingsHit = [];
                kbSimulator.animations = [];
            } else if (i == "." && player.team) {
                for (let s = 0; s < botManager.bots.length; s++) {
                    let n = botManager.bots[s];
                    if (!n.disconnected) {
                        botManager.sendToServer(n.socket, {
                            type: "sync",
                        });
                    }
                }
                let a = botManager.playingAsData;
                if (!a || a.socket.readyState != 1) {
                    io.send("S", 1);
                }
            } else if (t == 67) {
                updateMapMarker();
            } else if (player.weapons[t - 49] != undefined) {
                chicken.preferedWeaponIndex = player.weapons[t - 49];
                chicken.selectToBuild(player.weapons[t - 49], true);
            } else if (player.items[t - 49 - player.weapons.length] != undefined) {
                chicken.selectToBuild(player.items[t - 49 - player.weapons.length]);
            } else if (t == 81) {
                chicken.selectToBuild(player.items[0]);
            } else if (moveKeys[t]) {
                sendMoveDir();
            } else if (t == 32) {
                attackState = 1;
            } else if (i == "z") {
                placer.mill.status = !placer.mill.status;
            } else {
                scriptMenu.doKeyBindActions(e);
            }
        }
    }
    function keyUp(e) {
        if (player && player.alive) {
            let t = e.which || e.keyCode || 0;
            let i = e.key;
            if (t == 13) {
                toggleChat();
            } else if (keysActive() && keys[t]) {
                keys[t] = 0;
                if (moveKeys[t]) {
                    sendMoveDir();
                } else if (t == 32) {
                    attackState = 0;
                } else if (i == scriptMenu.keyBinds.oneTickKey) {
                    instaManager.holdModeOT = false;
                }
            }
        }
    }
    window.addEventListener("keydown", UTILS.checkTrusted(keyDown));
    window.addEventListener("keyup", UTILS.checkTrusted(keyUp));
    gameCanvas.addEventListener(
        "mousedown",
        function (e) {
            if (e.button == 0) {
                chicken.onClick.bull = !chicken.onClick.bull;
            } else {
                chicken.onClick.tank = !chicken.onClick.tank;
            }
        },
        false,
    );
    var lastMoveDir = undefined;
    function getMoveDir() {
        let e = 0;
        let t = 0;
        for (let i in moveKeys) {
            let s = moveKeys[i];
            e += !!keys[i] * s[0];
            t += !!keys[i] * s[1];
        }
        if (e == 0 && t == 0) {
            return undefined;
        } else {
            return UTILS.fixTo(Math.atan2(t, e), 2);
        }
    }
    function sendMoveDir() {
        let e = getMoveDir();
        if (!scriptMenu.toggles.autoGrind && (lastMoveDir == undefined || e == undefined || Math.abs(e - lastMoveDir) > 0.3)) {
            let t = botManager.playingAsData;
            if (t && t.socket.readyState == 1) {
                botManager.sendToServer(t.socket, {
                    type: "packet",
                    sid: t.sid,
                    packetData: {
                        type: "f",
                        data: [e],
                    },
                });
            } else {
                lastMoveDir = e;
            }
        }
    }
    function renderBuildingDmgText(e, t, i, s) {
        let n = e;
        let a = e;
        if (t == "player") {
            let l = healer.calculateWeaponDamage(i.primaryWeapon, i.primaryVariant);
            let o = healer.calculateWeaponDamage(i.secondaryWeapon, i.secondaryVariant);
            let r = [1, 3.3];
            let c = [l, o];
            for (let d = 0; d < c.length; d++) {
                let p = c[d];
                if (d != 1 || s.projDmg || !(i.secondaryWeapon >= 9) || i.secondaryWeapon == 14 || i.secondaryWeapon == 11 || i.secondaryWeapon == 10) {
                    r.forEach((e) => {
                        let t = p * e;
                        if (d == 1 && i.secondaryWeapon == 10) {
                            t *= 7.5;
                        }
                        if (t < n) {
                            n = t;
                        }
                        if (t > a) {
                            a = t;
                        }
                    });
                }
            }
        } else {
            n = 0;
        }
        let h = ((e - n) / (a - n)) * 100;
        let g;
        g = (h = Math.min(Math.max(h, 0), 100)) >= 50 ? `rgb(255, ${Math.round((1 - (h - 50) / 50) * 255)}, 0)` : `rgb(${Math.round((h / 50) * 255)}, 255, 0)`;
        textManager.showText(
            {
                x: s.x,
                y: s.y - 15,
            },
            500,
            20,
            0,
            g,
            Math.abs(e.toString().includes(".") ? UTILS.fixTo(e, 3) : e),
            {
                BuildingDmg: true,
            },
        );
    }
    function gatherAnimation(e, t, i) {
        let s = findPlayerBySID(e);
        if (s && (s.startAnim(t, i), (s.reloads[i] = items.weapons[i].speed), i < 9 ? (s.primaryHit = game.tick) : (s.secondaryHit = game.tick), t)) {
            let n = game.buildingsHit;
            game.buildingsHit = [];
            game.nextTick(() => {
                let e = items.weapons[i];
                let t = e.projectile == null ? e.dmg : 0;
                let a;
                let l = t * (config.weaponVariants[s.weaponVariant]?.val || 1) * (e.sDmg || 1) * (s.skinIndex == 40 ? 3.3 : 1);
                for (let o = 0; o < n.length; o++) {
                    let r = n[o];
                    if (r) {
                        r.lastHitTime = Date.now();
                        r.currentHealth -= l;
                        if (scriptMenu.toggles.renderBuildingDamage) {
                            renderBuildingDmgText(l, "player", s, r);
                        }
                    }
                }
            });
        }
    }
    function renderPlayers(e, t, i) {
        mainContext.globalAlpha = 1;
        let s = scriptMenu.toggles.renderShadows;
        let n = scriptMenu.toggles.renderRealDir;
        for (var a = 0; a < players.length; ++a) {
            let l = players[a];
            if (l.zIndex == i && (l.animate(delta), l.visible)) {
                l.skinRot += delta * 0.002;
                let o = (n || player != l ? l.dir : chicken.getAttackDir(false, true)) + l.dirPlus;
                mainContext.save();
                mainContext.translate(l.x - e, l.y - t);
                mainContext.rotate(o);
                if (s) {
                    mainContext.shadowBlur = 8;
                    mainContext.shadowColor = "rgb(0, 0, 0, .7)";
                }
                renderPlayer(l, mainContext);
                mainContext.restore();
            }
        }
    }
    let targetWidth = maxScreenWidth;
    let targetHeight = maxScreenHeight;
    let currentWidth = maxScreenWidth;
    let currentHeight = maxScreenHeight;

    gameCanvas.addEventListener("wheel", function (e) {
        if (e.deltaY > 0) {
            targetWidth *= 0.95;
            targetHeight *= 0.95;
        } else {
            targetWidth /= 0.95;
            targetHeight /= 0.95;
        }
        e.preventDefault();
    });

    function smoothZoom() {
        let lerpFactor = 0.15;
        currentWidth += (targetWidth - currentWidth) * lerpFactor;
        currentHeight += (targetHeight - currentHeight) * lerpFactor;
        if (Math.abs(targetWidth - currentWidth) > 0.1 || Math.abs(targetHeight - currentHeight) > 0.1) {
            maxScreenWidth = currentWidth;
            maxScreenHeight = currentHeight;
            resize();
            updateCursorLocation();
        }
        requestAnimationFrame(smoothZoom);
    }

    smoothZoom();
    function renderTool(e, t, i, s, n, a) {
        var l = e.src + (t || "") + (a ? "true" : "");
        var o = toolSprites[l];
        if (!o) {
            (o = new Image()).onload = function () {
                this.isLoaded = true;
            };
            o.src = getTexturePackImg(l, "weapons", a, e);
            toolSprites[l] = o;
        }
        if (o.isLoaded) {
            n.drawImage(o, i + e.xOff - e.length / 2, s + e.yOff - e.width / 2, e.length, e.width);
        }
    }
    var skinSprites = {};
    var skinPointers = {};
    var emeraldSprites = {
        "hand axe": true, bat: true, "hunting bow": true, crossbow: true,
        "repeater crossbow": true, daggers: true, "mc grabby": true,
        "great axe": true, "great hammer": true, "tool hammer": true,
        katana: true, stick: true, polearm: true, "short sword": true,
    };
    function getTexturePackImg(e, t, i, s) {
        if (t == "acc") {
            return ".././img/accessories/access_" + e + ".png";
        } else if (t == "hat") {
            return ".././img/hats/hat_" + e + ".png";
        } else {
            return ".././img/weapons/" + e + ".png";
        }
    }
    function renderSkin(e, t, i, s) {
        if (!(tmpSkin = skinSprites[e])) {
            var n = new Image();
            n.onload = function () {
                this.isLoaded = true;
                this.onload = null;
            };
            n.src = getTexturePackImg(e, "hat");
            skinSprites[e] = n;
            tmpSkin = n;
        }
        var a = i || skinPointers[e];
        if (!a) {
            for (var l = 0; l < hats.length; ++l) {
                if (hats[l].id == e) {
                    a = hats[l];
                    break;
                }
            }
            skinPointers[e] = a;
        }
        if (tmpSkin.isLoaded) {
            t.drawImage(tmpSkin, -a.scale / 2, -a.scale / 2, a.scale, a.scale);
        }
        if (!i && a.topSprite) {
            t.save();
            t.rotate(s.skinRot);
            renderSkin(e + "_top", t, a, s);
            t.restore();
        }
    }
    function renderPlayer(obj, ctxt) {
        ctxt = ctxt || mainContext;
        ctxt.lineWidth = outlineWidth;
        ctxt.lineJoin = "miter";
        let handAngle = (Math.PI / 4) * (items.weapons[obj.weaponIndex].armS || 1);
        let oHandAngle = obj.buildIndex < 0 ? items.weapons[obj.weaponIndex].hndS || 1 : 1;
        let oHandDist = obj.buildIndex < 0 ? items.weapons[obj.weaponIndex].hndD || 1 : 1;

        let katanaMusket = obj == player && obj.weapons[0] == 4 && obj.weapons[1] == 15;

        if (obj.tailIndex > 0) {
            renderTail(obj.tailIndex, ctxt, obj);
        }

        if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
            renderTool(items.weapons[katanaMusket ? 4 : obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
            if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
                renderProjectile(obj.scale, 0, items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
            }
        }

        ctxt.fillStyle = config.skinColors[obj.skinColor];
        renderCircle(obj.scale * Math.cos(handAngle), obj.scale * Math.sin(handAngle), 14);
        renderCircle(obj.scale * oHandDist * Math.cos(-handAngle * oHandAngle), obj.scale * oHandDist * Math.sin(-handAngle * oHandAngle), 14);

        if (obj.buildIndex < 0 && items.weapons[obj.weaponIndex].aboveHand) {
            renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
            if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
                renderProjectile(obj.scale, 0, items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
            }
        }

        if (obj.buildIndex >= 0) {
            var tmpSprite = getItemSprite(items.list[obj.buildIndex]);
            ctxt.drawImage(tmpSprite, obj.scale - items.list[obj.buildIndex].holdOffset, -tmpSprite.width / 2);
        }

        renderCircle(0, 0, obj.scale, ctxt);

        if (obj.skinIndex > 0) {
            ctxt.rotate(Math.PI / 2);
            renderSkin(obj.skinIndex, ctxt, null, obj);
        }
    }
    var fpsCount = 0;
    var fpsLast = 0;
    var fps = 0;
    const unxFpsChannel = new MessageChannel();
    unxFpsChannel.port1.onmessage = function () {
        doUpdate();
    };
    function doUpdate() {
        fpsCount++;
        if (Date.now() - fpsLast >= 1000) {
            fps = fpsCount;
            fpsCount = 0;
            fpsLast = Date.now();
        }
        pingDisplay.innerText = `Ping: ${window.pingTime} | FPS: ${fps}`;
        delta = (now = Date.now()) - lastUpdate;
        lastUpdate = now;
        updateGame();
        if (scriptMenu.toggles.fullFps) {
            unxFpsChannel.port2.postMessage("");
        } else {
            window.requestAnimationFrame(doUpdate);
        }
    }
    window.requestAnimationFrame =
        window.requestAnimationFrame ||
        window.requestAnimationFrame ||
        window.requestAnimationFrame ||
        function (e) {
        window.setTimeout(e, 1000 / 60);
    };

    doUpdate();
})();

(function() {
    'use strict';

})();
