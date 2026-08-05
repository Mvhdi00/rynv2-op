#!/usr/bin/env node
/**
 * Rebuilds RoBoTic-CaraMila.v6.9.5.js from the untouched original.
 *
 * Same treatment as Annihilator, and for the same reasons: metadata, the
 * shared transport shim, the seams where the mod's socket code hands over to
 * it, and a deferred boot so the shim can be early without the body being
 * early too. The shim goes in comment-free and the author's own comments are
 * left alone.
 *
 * Usage: node tools/build-caramila.js [original.js]
 */
const fs = require('fs');
const path = require('path');
const { stripComments } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const ORIGINAL = process.argv[2] || path.join(ROOT, 'reference', 'caramila-original.js');
const OUT = path.join(ROOT, 'RoBoTic-CaraMila.v6.9.5.js');

// The original ships with CRLF endings; everything else here is LF, and the
// seam matching below is written in LF. Normalise once rather than writing
// every pattern twice.
let src = fs.readFileSync(ORIGINAL, 'utf8').replace(/\r\n/g, '\n');

function swap(from, to) {
  if (src.indexOf(from) < 0) {
    console.error('build-caramila: could not find\n  ' + from.split('\n')[0]);
    process.exit(1);
  }
  src = src.replace(from, to);
}

/* --- metadata -------------------------------------------------------------
 * No @run-at at all, so this ran at document-end -- after the bundle had taken
 * its reference to WebSocket.prototype.send. The hook below went onto a
 * function nothing was calling, which is why it sent nothing.
 *
 * Both @requires go. msgpack-lite is replaced by the bundled shim, and three.js
 * is never used: "THREE." appears zero times in 15,610 lines.
 */
swap('// @grant       none\n', '// @grant       none\n// @run-at      document-start\n');
swap('// @require     https://cdnjs.cloudflare.com/ajax/libs/msgpack-lite/0.1.26/msgpack.min.js\n', '');
swap('// @require     https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js\n', '');

/* --- seam 0: page furniture moomoo deleted --------------------------------
 * UIS collects a page's worth of elements with getEl and the mod dereferences
 * them all over: promoImageHolder.style.display, adCard.remove(), and so on.
 * Those elements are gone, so each one is a TypeError that kills the rest of
 * the boot -- and there are too many call sites to guard one at a time.
 *
 * getEl is the mod's single accessor, so the fix goes there, and it is the
 * same one the unpatcher uses: for a CLOSED list of ids moomoo has removed,
 * hand back a real but hidden element instead of null. Hiding it, removing it
 * or writing into it are all the no-ops the mod was asking for. Every other id
 * still returns null, so feature tests against ids the page does have keep
 * telling the truth.
 *
 * altcha is deliberately not on the list: that one needs to stay null so the
 * polling loop below can retire itself instead of clicking a stub forever.
 */
swap(`function getEl(id) {
    return document.getElementById(id);
}`,
`const GONE_IDS = [
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
}`);

/* --- seam 1: the socket hook ----------------------------------------------
 * isModSocket stays first: the mod runs its own servers and their traffic is
 * JSON, not game packets. WS != this covers the second one, which never marks
 * itself.
 */
swap(`WebSocket.prototype.nsend = WebSocket.prototype.send;
WebSocket.prototype.send = function (message) {

    if (this.isModSocket) {// that shit need bc is shit from ueh raping my server
        return this.nsend(message);
    }

    if (!WS) {
        WS = this;
        WS.addEventListener("message", function (msg) {
            getMessage(msg);
        });
        WS.addEventListener("close", (event) => {
            window.location.reload();
        });
    }

    if (WS == this) {
        dontSend = false;
        // EXTRACT DATA ARRAY:
        let data = new Uint8Array(message);
        let parsed = msgpack.decode(data);

        let type = parsed[0];
        data = parsed[1];`,
`function sendFiltered(sock, type, data) {
    {
        dontSend = false;`);

/* --- seam 2: the send ------------------------------------------------------
 * The bare block above stands where "if (WS == this) {" used to open, so every
 * let in the body between keeps the block scope it had and nothing needed
 * reindenting.
 */
swap(`        if (!dontSend) {
            let binary = msgpack.encode([type, data]);
            this.nsend(binary);`,
`        if (!dontSend) {
            EXP.send(sock, type, data);`);

swap(`    } else {
        this.nsend(message);
    }
}

function packet(type) {
    // EXTRACT DATA ARRAY:
    let data = Array.prototype.slice.call(arguments, 1);

    // SEND MESSAGE:
    let binary = msgpack.encode([type, data]);
    WS.send(binary);
}`,
`    }
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
}`);

/* --- seam 3: incoming ------------------------------------------------------
 * io-init still arrives as a string-named packet, so socketID keeps working.
 */
swap(`function getMessage(message) {
    let data = new Uint8Array(message.data);
    let parsed = msgpack.decode(data);
    let type = parsed[0];
    data = parsed[1];`,
`function getMessage(message) {
    let parsed = EXP.receive(message.target || WS, message.data);
    if (!parsed) return;
    let type = parsed.type;
    let data = parsed.args;`);

/* --- seam 4: ALTCHA -------------------------------------------------------
 * moomoo replaced ALTCHA with Cloudflare Turnstile, so getEl("altcha") is null
 * and this block is a TypeError. The game solves Turnstile itself, so there is
 * nothing for the mod to click: guard the dereference and let the poll retire
 * itself.
 */
swap(`        altcha.style.display = 'none';

        let annoyingAltchaStuff = setInterval(() => {
            altchaButton.click();`,
`        if (altcha) altcha.style.display = 'none';

        let annoyingAltchaStuff = setInterval(() => {
            if (!altcha || !altchaButton) return clearInterval(annoyingAltchaStuff);
            altchaButton.click();`);

/* --- seam 5: the verification box had nowhere to appear --------------------
 * The mod builds its own inputCard and then does setupCard.style.display =
 * 'none'. #turnstileWidget lives inside setupCard, and the game will not
 * render into it while it is not laid out:
 *
 *     const e = document.getElementById("turnstileWidget");
 *     if (!e || e.offsetParent === null) return !1;
 *
 * So no checkbox ever appeared, no token was ever issued, and Play stayed
 * "disabled" -- the game only clears that class from onGotTurnstileToken.
 *
 * Moving the widget into the visible card is the whole fix: the game polls for
 * it every 150ms for about fifteen seconds, so it renders itself once it can
 * be seen. It goes directly under the name-and-Play row, which is the thing it
 * gates.
 *
 * The poll below is only for the case where the mod booted too late to catch
 * that window. It waits three seconds first so the game gets the first go, and
 * stops the moment anything has been rendered into the widget, so the two
 * cannot both render. Sitekey and callbacks are the game's own.
 */
swap(`        inputCard.appendChild(inputSection);`,
`        inputCard.appendChild(inputSection);

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
        })();`);

/* --- seam 6: the server browser came up empty -----------------------------
 * getServers() has no catch anywhere above it, so anything that goes wrong in
 * here leaves the panel silently blank -- which is exactly what it does.
 *
 * Its request differs from the game's in two ways. The game asks for
 * `${api}/servers?v=1.27`; this asks for /servers with no version at all on
 * production, and pins ?v=1.26 on sandbox. That version is not decorative:
 * another unpatcher doing the rounds carries a fetch hook whose only job is to
 * rewrite v=1.26 to v=1.27, so somebody else hit this too. And the ping URL
 * drops the port -- the game builds key.region.moomoo.io[:port]/ping, this
 * builds key.region.moomoo.io/ping/.
 *
 * There is no network from where this is built, so which URLs the live API
 * accepts cannot be settled here. The defensible thing is to send exactly what
 * the working client sends, fall back to the bare URL if that is refused, and
 * never let a failure turn into a blank panel with nothing in the console.
 */
swap(`            let currentMode = location.host.replace(/\\.moomoo\\.io/, "");
            let getRequestUrl = () => {
                if (/(sandbox|dev)/.test(currentMode)) {
                    return \`https://api-\${currentMode}.moomoo.io/servers?v=1.26\`;
                }
                return "https://api.moomoo.io/servers";
            };

            let response = await fetch(getRequestUrl());
            let servers = await response.json();

            await Promise.all(servers.map(async server => {
                let requestPingUrl = \`https://\${server.key}.\${server.region}.moomoo.io/ping/\`;`,
`            let currentMode = location.host.replace(/\\.moomoo\\.io/, "");
            let apiBase = /(sandbox|dev)/.test(currentMode)
                ? \`https://api-\${currentMode}.moomoo.io\`
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
                let pingHost = \`\${server.key}.\${server.region}.moomoo.io\`;
                if (server.port) pingHost += ":" + server.port;
                let requestPingUrl = \`https://\${pingHost}/ping\`;`);

/* --- seam 7: the sync toggle only worked one way --------------------------
 * The mod talks to two servers of its own. sync-script-users sends a fixed
 * handshake and receives other users' positions; robotics-ahh.fly.dev gets
 * sendPlayerInfo() on a timer, carrying your name, sid, server, ping and live
 * x2/y2. That is the "Primary Sync" feature -- seeing other users of this mod
 * -- and it is the author's, not something smuggled in.
 *
 * But the switch for it only worked in one direction. configs.serverSync
 * decides whether the mod *uses* what comes back, and it is reported inside
 * the payload, yet nothing checks it before sending: turn Primary Sync off and
 * your name and coordinates keep going out. Checking it here makes the toggle
 * that already exists do what it says, in both directions -- and because the
 * reconnect lives in this function's else branch, off means it stops dialling
 * out too.
 */
swap(`function sendPlayerInfo() {
    if (socket && socket.readyState === WebSocket.OPEN) {`,
`function sendPlayerInfo() {
    if (!configs.serverSync) return;
    if (socket && socket.readyState === WebSocket.OPEN) {`);

/* --- assembly -------------------------------------------------------------
 * The shim has to be installed at document-start, because the game captures
 * WebSocket.prototype.send once at bundle load. The body must not run then:
 * its top level does document.body.appendChild and reads a page full of ids
 * that do not exist yet. So the shim goes at the top and the body waits.
 */
const extLines = fs.readFileSync(path.join(ROOT, 'ExternalClient.user.js'), 'utf8').split('\n');
const a = extLines.indexOf('const EXP = (function() {');
const b = extLines.indexOf(')();', a);
if (a < 0 || b < 0) { console.error('could not find the EXP core'); process.exit(1); }
const shim = stripComments(extLines.slice(a, b + 1).join('\n'), { metadata: false }).out;

const marker = '// ==/UserScript==\n';
const at = src.indexOf(marker) + marker.length;
const head = src.slice(0, at);
const body = src.slice(at);

const starter = `
(function __carStart(tries) {
    tries = tries || 0;
    if ((document.readyState === "loading" || !document.getElementById("gameUI")) && tries < 400) {
        return setTimeout(function () { __carStart(tries + 1); }, 50);
    }
    __carBoot();
})();
`;

const out = head + '\n' + shim + '\n\nfunction __carBoot() {\n' + body + '\n}\n' + starter;
fs.writeFileSync(OUT, out);
console.log('wrote', path.relative(ROOT, OUT), '-', out.split('\n').length, 'lines');
