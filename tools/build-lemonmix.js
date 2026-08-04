#!/usr/bin/env node
/*
 * build-lemonmix.js
 *
 * Builds LemonMod_Mix.user.js — one file that replaces both
 * "! LemonMod v3.0 !" and "! LemonMod - Visuals !".
 *
 * The two scripts were a pair by necessity, not by design. Visuals was a fork
 * of the whole game bundle; the main script deleted the real bundle.js so the
 * fork could take its place, checked for cookies the fork set, and wiped the
 * page and pushed you at a download link if they were missing. Both halves
 * were written for a protocol the game no longer speaks.
 *
 * What this build does:
 *
 *   1. Rewires the packet layer onto the current transport. LemonMod's three
 *      socket seams (its send helper, its message handler, its outgoing-frame
 *      sniffer) are pointed at the game's own io object via the bundle hooks
 *      in src/lemonmix-injector.js, so the game does the opcode mapping, the
 *      sequence numbering and the HMAC and there is only one of each.
 *
 *   2. Folds Visuals in as bundle rewrites instead of a fork, which is why
 *      there is one file now and nothing to install alongside it.
 *
 *   3. Removes the gate, and every callback to the author's server.
 *
 * Every edit is anchored to an exact string in the deobfuscated source, and an
 * anchor that is missing or ambiguous fails the build rather than producing a
 * half-patched script.
 *
 *   node tools/build-lemonmix.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MAIN = path.join(ROOT, "src/LemonMod_v3.0.js");
const RUNTIME = path.join(ROOT, "src/lemonmix-runtime.js");
const INJECTOR = path.join(ROOT, "src/lemonmix-injector.js");
const VENDOR = path.join(ROOT, "src/game_vendor.js");
const OUT = path.join(ROOT, "LemonMod_Mix.user.js");
const DRIVERS = JSON.parse(fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8"));

let code = fs.readFileSync(MAIN, "utf8");
const applied = [];

/* Every edit goes through here so a stale anchor fails loudly. */
function edit(label, find, replace) {
  const parts = code.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  code = parts[0] + replace + parts[1];
  applied.push(label);
}

/* For edits that legitimately apply everywhere (asset URLs, mostly). */
function editAll(label, find, replace, expected) {
  const hits = code.split(find).length - 1;
  if (hits === 0) throw new Error(`anchor not found: ${label}`);
  if (expected !== undefined && hits !== expected) {
    throw new Error(`anchor hit ${hits} times, expected ${expected}: ${label}`);
  }
  code = code.split(find).join(replace);
  applied.push(`${label} (x${hits})`);
}

/* ================================================================== *
 * 1. Tracking, remote code, and the call-home paths
 * ================================================================== */

/* The kill switch. LemonMod fetched crCheck.php on every load and, if it came
 * back "1", fetched cr.php and eval'd whatever the response was. That is a
 * live remote-code channel into the page, controlled by whoever holds the
 * domain, with no version pinning and no way for the user to see it. */
edit(
  "remove remote-eval kill switch",
  `window.isDev = 0;
try {
  LEMONMOD_0x4225e4("https://lemonmod.com/lemonModUpdate/crCheck.php");
} catch (LEMONMOD_0x1fd303) {}
try {
  if (LEMONMOD_0x211e6c) console.log(LEMONMOD_0x5682b7);
} catch (LEMONMOD_0x2c9a9d) {}
if ("1" == LEMONMOD_0x5682b7) {
  try {
    LEMONMOD_0x2159e6("https://lemonmod.com/lemonModUpdate/cr.php");
  } catch (LEMONMOD_0x4f0c4d) {}
  if (null != LEMONMOD_0x21e566) try {
    if (LEMONMOD_0x211e6c) console.log(LEMONMOD_0x21e566);
    eval(LEMONMOD_0x21e566);
  } catch (LEMONMOD_0x214ce0) {}
}`,
  `window.isDev = 0;
/* removed: crCheck.php / cr.php remote-eval kill switch */`
);

/* The two XHR helpers the kill switch used. */
edit(
  "remove kill-switch fetchers",
  `function LEMONMOD_0x4225e4(_0x11d419) {
  var _0x153d71 = new XMLHttpRequest();
  _0x153d71.onreadystatechange = function () {
    LEMONMOD_0x5682b7 = _0x153d71.responseText;
  }, _0x153d71.open("GET", _0x11d419, !![]), _0x153d71.send(null);
}
function LEMONMOD_0x2159e6(_0xfa6633) {
  var _0x13058e = new XMLHttpRequest();
  _0x13058e.onreadystatechange = function () {
    LEMONMOD_0x21e566 = _0x13058e.responseText;
  }, _0x13058e.open("GET", _0xfa6633, !![]), _0x13058e.send(null);
}`,
  `/* removed: the two XHR helpers the kill switch used */`
);

/* The same beacon the Visuals script carried, in the main script too. The
 * numeric keys, the decoy Math.min/Math.max over a pile of huge floats, and
 * the base64 are all cover for one line: key 31 returns
 * https://ksw2-center.glitch.me/mm_aib_1 and key 9012 fetches it, with init()
 * at the bottom firing it on load, before anything else runs.
 *
 * The rotate override key 31 is wrapped around is real — it clamps rotation
 * values that would otherwise crash the canvas — so that stays and only the
 * fetch goes. */
{
  /* The base64 is read out of the source rather than retyped here, so a
   * typo cannot quietly turn this edit into a no-op. */
  const m = /return atob\("([A-Za-z0-9+/=]+)"\);\n  \},\n  9012: \(\) => \{\n    fetch\(LEMONMOD_0x399801\[31\]\(\)\);\n  \},/.exec(code);
  if (!m) throw new Error("anchor not found: glitch.me beacon");
  const url = Buffer.from(m[1], "base64").toString();
  if (!/^https?:\/\//.test(url)) throw new Error(`beacon anchor decoded to something unexpected: ${url}`);
  edit("remove the glitch.me beacon (" + url + ")", m[0],
    `return null;
  },
  9012: () => {},`);
}

/* The version ping, and the forced redirect to the author's download page
 * that followed a version it did not like. */
edit(
  "remove version ping",
  `if (LEMONMOD_0x7ec22c("https://lemonmod.com/lemonModUpdate/latest.php"), !LEMONMOD_0x211e6c) console.clear();`,
  `/* removed: latest.php version ping */
if (!LEMONMOD_0x211e6c) console.clear();`
);

/* With the ping gone the "latest version" string stays "ERROR", which sends
 * startup down the branch that sets the page title to "LemonMod Error!" before
 * the real title lands 800ms later. There is no remote version to compare
 * against any more, so the build's own version is the latest one. */
edit(
  "treat the build's own version as current",
  `var LEMONMOD_0x2708b = "ERROR";`,
  `var LEMONMOD_0x2708b = LEMONMOD_0x110d60;`
);

/* The XHR helper the ping used, now unreferenced. */
edit(
  "remove the version-ping fetcher",
  `function LEMONMOD_0x7ec22c(_0x140590) {
  var _0x126967 = new XMLHttpRequest();
  _0x126967.onreadystatechange = function () {
    LEMONMOD_0x2708b = _0x126967.responseText;
  }, _0x126967.open("GET", _0x140590, !![]), _0x126967.send(null);
}`,
  `/* removed: the XHR helper behind the version ping */`
);

edit(
  "remove forced update redirect",
  `  if (_0x424495 < _0x522e0b) {
    if (LEMONMOD_0x211e6c) console.log("version is outdated");
    window.location.replace("https://lemonmod.com/lemonModUpdate/");
  }`,
  `  /* removed: forced redirect to the author's update page */`
);

/* Death telemetry: health, damage taken, current weapons and several of your
 * menu settings, sent to the author on every death, synchronously. */
{
  const START = `            try {
              var _0x28d8cc = "https://lemonmod.com/api/death/?a="`;
  const END = `            var _0x56fc85 = new XMLHttpRequest();
            _0x56fc85.open("GET", _0x28d8cc, ![]);
            _0x56fc85.send(null);`;
  const at = code.indexOf(START);
  if (at === -1) throw new Error("anchor not found: death telemetry");
  if (code.indexOf(START, at + 1) !== -1) throw new Error("anchor is ambiguous: death telemetry");
  const end = code.indexOf(END, at);
  if (end === -1) throw new Error("anchor not found: death telemetry (end)");
  code = code.slice(0, at) +
    "            /* removed: per-death telemetry to lemonmod.com/api/death — health,\n" +
    "             * damage taken, weapons, hat, clan and menu settings, on every death */" +
    code.slice(end + END.length);
  applied.push("remove death telemetry");
}

/* Remote stylesheets. The first is served by the author and is another
 * arbitrary-content channel; the second is an unused CDN pull. */
edit(
  "remove remote stylesheets",
  `  var _0x230f6f = document.createElement("link");
  _0x230f6f.setAttribute("rel", "stylesheet"), _0x230f6f.setAttribute("type", "text/css"), _0x230f6f.setAttribute("href", "https://lemonmod.com/lemonModUpdate/LemonModStyleSheetCSSRaw.css"), document.head.appendChild(_0x230f6f);
  var _0x2c020b = document.createElement("link");
  _0x2c020b.setAttribute("rel", "stylesheet"), _0x2c020b.setAttribute("type", "text/css"), _0x2c020b.setAttribute("href", "https://unpkg.com/notie/dist/notie.min.css"), document.head.appendChild(_0x2c020b), $("#killCounter").css({`,
  `  /* removed: remote stylesheets (lemonmod.com, unpkg) */
  $("#killCounter").css({`
);

/* Sounds and notification icons. Each is a request to the author's host,
 * carrying your address and a referer, on a schedule that maps to what you
 * are doing in game. The audio elements stay so the sound code keeps its
 * shape; they just have no source. */
/* Blanked to empty strings rather than trimmed to a filename: the
 * notification helper skips its illustration block when the image argument is
 * falsy, so an empty string is clean where a relative "Katana.png" would be a
 * broken-image icon pointing at moomoo.io. */
edit(
  "drop the remote menu logo",
  `<div class=\\"circle\\"><img src=\\"https://lemonmod.com/lemonModUpdate/lemon.png\\" alt=\\"LemonMod v3.0\\" width=\\"300\\" height=\\"300\\"></div>`,
  `<div class=\\"circle\\"></div>`
);
edit(
  "drop the remote map image",
  `  $("#mapDisplay").css({
    "background": "url(https://lemonmod.com/img/map.png)"
  });`,
  `  /* removed: map background served from lemonmod.com */`
);
{
  const re = /https:\/\/lemonmod\.com\/(?:img|sound|lemonModUpdate)\/[A-Za-z0-9._-]*/g;
  const hits = (code.match(re) || []).length;
  if (hits < 20) throw new Error(`expected the asset URLs to be widespread, found ${hits}`);
  code = code.replace(re, "");
  applied.push(`blank remote asset URLs (x${hits})`);
}
edit("drop remote cursor", `$("#gameCanvas").css("cursor", "url(https://lemonmod.com/cursor.cur), default")`, `$("#gameCanvas").css("cursor", "default")`);
editAll("drop src-less Audio elements", `new Audio("")`, `new Audio()`, 6);

/* A synchronous XHR to code.jquery.com, in the middle of startup, whose
 * response is never read — the surrounding log lines claim it evaluates the
 * result, but nothing does. It blocks the main thread on a third-party round
 * trip, and if that host is unreachable for any reason — an ad blocker, a
 * filtered network, CSP, offline — it throws, and everything below it in the
 * startup path never runs. That includes the settings menu.
 *
 * jQuery is a shim in this build, so there was nothing to fetch even if the
 * response had been used. */
edit(
  "remove the blocking synchronous jQuery fetch",
  `  _0x172b9e.open("GET", window.location.protocol + "//code.jquery.com/jquery-3.3.1.slim.min.js", ![]);
  _0x172b9e.send();`,
  `  /* removed: blocking sync XHR to code.jquery.com whose response was
   * never read, and which took the rest of startup with it when it failed */`
);

/* ================================================================== *
 * 2. The Visuals gate
 * ================================================================== */

/* This is the nag. With the Visuals script absent it cleared document.body on
 * a 100ms interval — so the page stayed blank — alerted, and opened the
 * download link. There is nothing to install alongside this build, so the
 * whole check goes. */
edit(
  "remove Visuals install gate",
  `function LEMONMOD_0x4663d4() {
  if (LEMONMOD_0x3fb309("bundle") == null || LEMONMOD_0x3fb309("usingVisuals") == null || LEMONMOD_0x3fb309("usingFinalBundle") == null) {
    setInterval(() => {
      try {
        document.body.innerHTML = "";
      } catch (_0x559166) {}
    }, 100);
    if (!LEMONMOD_0x11e097) {
      alert("Please UPDATE/install the LemonMod Visuals to use this mod!");
      LEMONMOD_0xa3d254("bundle", 1, 365);
      window.open("https://lemonmod.com/bundle/latest/bundle.user.js");
    }
    LEMONMOD_0x11e097 = !![];
  }
}`,
  `/* The Visuals install gate. Visuals is built into this file, so there is
 * nothing to check for and nothing to download. */
function LEMONMOD_0x4663d4() {}`
);

/* The shipped script carried the nag twice; the second copy sat behind one of
 * the obfuscator's always-false string comparisons and did not survive
 * deobfuscation. Assert that nothing is left rather than assume it. */
for (const trace of [
  "Please UPDATE/install the LemonMod Visuals",
  "bundle/latest/bundle.user.js",
  "usingVisuals",
  "usingFinalBundle",
]) {
  if (code.includes(trace)) throw new Error(`the Visuals gate still references: ${trace}`);
}
applied.push("assert no Visuals gate remains");

/* LemonMod's own bundle blocker. It removed any script whose src was
 * `<origin>/bundle.js` — the path the game served in 2021 — so its fork could
 * take over. The game serves a hashed asset now, and the injector in the
 * prelude claims that one. */
edit(
  "remove stale bundle.js blocker",
  `let LEMONMOD_0x3c1d1b = new MutationObserver(function (_0x70f7fa) {
  _0x70f7fa.forEach(function (_0x12bb55) {
    _0x12bb55.addedNodes.forEach(function (_0x10b451) {
      if (_0x10b451.nodeName == "SCRIPT") {
        if (_0x10b451.src == window.location.protocol + "//" + window.location.hostname + "/bundle.js" || /(cookiepro.com)/.exec(_0x10b451.src)) {
          LEMONMOD_0x1883f2++;
          try {
            _0x10b451.parentNode.removeChild(_0x10b451);
          } catch (_0x5c8a73) {
            _0x10b451.remove();
          }
          ;
          LEMONMOD_0x1883f2 == 2 && LEMONMOD_0x3c1d1b.disconnect();
        }
        ;
      }
      ;
    });
  });
});
LEMONMOD_0x3c1d1b.observe(document, {
  "attributes": !![],
  "characterData": !![],
  "childList": !![],
  "subtree": !![]
});`,
  `/* LemonMod's bundle.js blocker: the game has not served that path in years,
 * and the injector in the prelude claims the real asset instead. */
let LEMONMOD_0x3c1d1b = { observe() {}, disconnect() {} };`
);

/* The shame counter was read out of a cookie the Visuals fork wrote, sixty
 * times a second. Same script now, so it is a field. */
edit(
  "read shame count locally",
  `setInterval(() => {
  try {
    LEMONMOD_0x388eda.shameCount = parseInt(LEMONMOD_0x3fb309("MYshame"));
  } catch (_0x444cd9) {}
}, 3);`,
  `setInterval(() => {
  try {
    LEMONMOD_0x388eda.shameCount = window.LemonMix._shameCount | 0;
  } catch (_0x444cd9) {}
}, 100);`
);

/* ================================================================== *
 * 3. The packet layer
 *
 * Three seams, and they are the reason nothing worked. LemonMod encoded plain
 * msgpack `[name, args]` frames under the pre-2022 packet names; the current
 * game permutes every opcode per connection, appends a sequence number and
 * prefixes six bytes of truncated HMAC. A frame built the old way does not
 * decode, and a name like "sp" or "ch" is not in the table at all.
 * ================================================================== */

/* Seam 1 — outbound. Route through the game's io.send so the sequence counter
 * and the key stay in one place. LemonMix.send does the name translation. */
edit(
  "route outbound packets through the game transport",
  `      function _0x35285a(_0x227f6c) {
        try {
          _0x83059.send(new Uint8Array(Array.from(LEMONMOD_0x5b0f86.encode(_0x227f6c))));
        } catch (_0x20aa5a) {
          return null;
        }
      }`,
  `      function _0x35285a(_0x227f6c) {
        /* [ legacyName, args ] in, a signed frame under the current opcode
         * table out. See LemonMix.C2S for the name mapping. */
        return window.LemonMix.send(_0x227f6c);
      }`
);

/* Seam 2 — inbound. The rewrite hands us the packet after the game has mapped
 * the opcode back to a name, so there is nothing left to decode. */
edit(
  "take inbound packets from the game dispatcher",
  `      function _0x51247d(_0x593617) {
        _0x593617.addEventListener("message", function (_0x3569ff) {
          _0x18eeae(_0x3569ff);
        });
        LEMONMOD_0x211e6c ? console.log("socketfound") : window.afinsefuia = !![];
      }`,
  `      function _0x51247d(_0x593617) {
        /* One subscription, made once, against the game's own dispatcher —
         * not a second "message" listener racing it on the raw socket. */
        window.LemonMix.onPacket(_0x18eeae);
        window.LemonMix.onClose(function () {
          LEMONMOD_0x32b091 = !0;
        });
        LEMONMOD_0x211e6c ? console.log("socketfound") : window.afinsefuia = !![];
      }
      _0x83059 = window.LemonMix.socketProxy;
      document.ws = _0x83059;
      _0x51247d(_0x83059);`
);

edit(
  "accept pre-decoded inbound packets",
  `      function _0x18eeae(_0x60679e) {
        if (LEMONMOD_0x4a352c) {
          return;
        }
        var _0x57bb3c = void 0,
          _0x5bbfea = LEMONMOD_0x5b0f86.decode(new Uint8Array(_0x60679e.data));
        _0x5bbfea.length > 1 ? (_0x57bb3c = [_0x5bbfea[0]].concat(_0x17a8b8(_0x5bbfea[1])))[1] instanceof Array && (_0x57bb3c = _0x57bb3c) : _0x57bb3c = _0x5bbfea;
        var _0x2be80f = _0x57bb3c[0];
        const _0x22962a = msgpack.decode(new Uint8Array(_0x60679e.data));
        const _0x52af62 = _0x22962a[1];`,
  `      function _0x18eeae(_0x60679e) {
        if (LEMONMOD_0x4a352c) {
          return;
        }
        /* { type, args } from LemonMix, with type already translated back to
         * the name this switch was written against. */
        var _0x2be80f = _0x60679e.type;
        const _0x52af62 = _0x60679e.args;
        var _0x57bb3c = [_0x2be80f].concat(_0x52af62);
        /* what msgpack.decode used to hand back, for the one handler that
         * passes the raw pair further down */
        var _0x5bbfea = [_0x2be80f, _0x52af62];`
);

/* Seam 3 — the sniffer. LemonMod wrapped WebSocket.prototype.send to read the
 * player's own frames back out of the wire. There is nothing readable on the
 * wire any more, so it becomes a filter on the game's io.send instead, which
 * sees the packet before it is framed. */
edit(
  "turn the frame sniffer into a send filter",
  `      WebSocket.prototype.oldSend = WebSocket.prototype.send;
      LEMONMOD_0x211e6c ? console.log("define send") : window.afinsefuia = !![];
      WebSocket.prototype.send = function (_0x4ff491) {`,
  `      LEMONMOD_0x211e6c ? console.log("define send") : window.afinsefuia = !![];
      window.LemonMix.onSend(function (LEMONMIX_NAME, LEMONMIX_ARGS) {`
);

/* Two lines above it did nothing but define window.send. `this` here is the
 * global object, not a socket, so this was never wiring anything up — it just
 * put a property called `send` on window. */
edit(
  "drop the stray window.send wrapper",
  `      this.staticSend = this.send;
      this.send = function (_0x17ff5c) {
        this.staticSend(_0x17ff5c);
      };
      LEMONMOD_0x211e6c ? console.log("staticsend") : window.afinsefuia = !![];`,
  `      /* removed: assigned window.send to a wrapper around itself */
      LEMONMOD_0x211e6c ? console.log("staticsend") : window.afinsefuia = !![];`
);

edit(
  "read the outgoing packet from the filter arguments",
  `        var _0x200659 = LEMONMOD_0x5b0f86.decode(new Uint8Array(_0x4ff491));
        if (_0x200659[0] == "ch") {`,
  `        var _0x200659 = [LEMONMIX_NAME, LEMONMIX_ARGS];
        if (_0x200659[0] == "ch") {`
);

/* The chat filter bypass. Two bugs here that the old transport hid: the
 * rewritten message was sent *in addition to* the original rather than
 * instead of it, and when no filtered word matched at all it still fired a
 * `["ch", [null]]` packet. Both cost a sequence number now. */
edit(
  "send the rewritten chat instead of duplicating it",
  `          try {
            this.oldSend(new Uint8Array(Array.from(LEMONMOD_0x5b0f86.encode(["ch", [_0x58c159]]))));
          } catch (_0x41adc0) {}
        } else if (_0x200659[0] == "6") {`,
  `          if (_0x58c159 !== null) {
            /* Replaces the original rather than racing it, and stays quiet
             * when nothing actually matched. */
            window.LemonMix.send(["ch", [_0x58c159]]);
            return false;
          }
        } else if (_0x200659[0] == "6") {`
);

edit(
  "return an allow/drop verdict instead of re-sending the frame",
  `        _0x83059 || (document.ws = this, _0x83059 = this, _0x51247d(this), this.addEventListener("close", function () {
          LEMONMOD_0x32b091 = !0;
        }));
        if (!LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) {
          if (_0x200659[0] == "ch" && document.getElementById("silentMode").checked) {} else {
            try {
              this.oldSend(_0x4ff491);
            } catch (_0x590e8c) {}
          }
        } else if (document.activeElement.id.toLowerCase() == "chatbox") {
          if (_0x200659[0] == "ch" && document.getElementById("silentMode").checked) {} else {
            try {
              this.oldSend(_0x4ff491);
            } catch (_0x5963c2) {}
          }
        } else {}
      };`,
  `        var LEMONMIX_FOCUS = document.activeElement && document.activeElement.id
          ? document.activeElement.id.toLowerCase()
          : "";
        /* Typing in one of the mod's own inputs swallows the packet, exactly
         * as before — except for the chat box, which is allowed through. */
        if (LEMONMOD_0x35bf68.includes(LEMONMIX_FOCUS) && LEMONMIX_FOCUS != "chatbox") {
          return false;
        }
        var LEMONMIX_SILENT = document.getElementById("silentMode");
        if (_0x200659[0] == "ch" && LEMONMIX_SILENT && LEMONMIX_SILENT.checked) {
          return false;
        }
        return true;
      });`
);

/* ================================================================== *
 * 4. Things the signed transport cannot carry
 * ================================================================== */

/* The "crash" payloads were hand-built msgpack blobs pushed straight down the
 * socket with no header. Every frame the server accepts now carries six bytes
 * of HMAC over [opcode, args, seq]; an unsigned frame is rejected, and enough
 * of them close the connection with code 4001. Emitting them would break the
 * player sending them and nobody else, so the raw sender is a no-op. */
{
  const hits = code.split("_0x83059.oldSend(").length - 1;
  if (hits < 10) throw new Error(`expected the raw crash sender to be widespread, found ${hits}`);
  applied.push(`neutralise raw unsigned frames (x${hits}, via socketProxy.oldSend)`);
}

/* ================================================================== *
 * 4b. Bot sockets
 *
 * The multibox feature opens WebSockets of its own, outside the game's io
 * object, so those frames are the one thing this script still has to build
 * by hand. LemonMix.Bot does it with the primitives lifted out of
 * src/game_index.js below.
 * ================================================================== */

/* The connection token. LemonMod asked grecaptcha for one against a site key
 * that belongs to the old menu; the game switched to Cloudflare Turnstile,
 * and the captureTurnstile rewrite keeps hold of the token it was issued. */
edit(
  "take the bot connection token from Turnstile",
  `      const _0x1c2157 = "6LevKusUAAAAAAFknhlV8sPtXAk5Z5dGP5T2FYIZ";
      const _0x238cff = () => grecaptcha.execute(_0x1c2157, {
        "action": "homepage"
      });`,
  `      /* grecaptcha is gone from the game; Turnstile issues the token now. */
      const _0x238cff = () => Promise.resolve(window.LemonMix.Bot.token());`
);

edit(
  "frame bot packets for the current transport",
  `        _0x1b2f64.binaryType = "arraybuffer";
        _0x1b2f64.emit = _0xb93c66 => {
          _0x1b2f64.send(LEMONMOD_0x5b0f86.encode(_0xb93c66));
        };`,
  `        window.LemonMix.Bot.wrap(_0x1b2f64);`
);

edit(
  "decode bot packets through the negotiated table",
  `        _0x1b2f64.onmessage = _0x100d06 => {
          let _0x2bee85 = LEMONMOD_0x5b0f86.decode(new Uint8Array(_0x100d06.data));
          let _0x35cf3f;
          if (_0x2bee85.length > 1) {
            _0x35cf3f = [_0x2bee85[0], ..._0x2bee85[1]];
            if (_0x35cf3f[1] instanceof Array) {
              _0x35cf3f = _0x35cf3f;
            }
          } else {
            _0x35cf3f = _0x2bee85;
          }`,
  `        _0x1b2f64.onmessage = _0x100d06 => {
          /* Handles io-init for this socket, maps the opcode back through the
           * table it negotiated, and hands back [ legacyName, ...args ]. */
          let _0x35cf3f = window.LemonMix.Bot.receive(_0x1b2f64, _0x100d06);`
);

/* The remaining grecaptcha calls sit in the multi-server bot routine. The
 * global does not exist on the page any more, so every one of them was a
 * ReferenceError waiting to happen; they take the Turnstile token too. */
editAll(
  "take multi-server bot tokens from Turnstile",
  `grecaptcha.execute("6LevKusUAAAAAAFknhlV8sPtXAk5Z5dGP5T2FYIZ", {
                    "action": "homepage"
                  })`,
  `window.LemonMix.Bot.tokenPromise()`,
  4
);
editAll(
  "take multi-server bot tokens from Turnstile (else branch)",
  `grecaptcha.execute("6LevKusUAAAAAAFknhlV8sPtXAk5Z5dGP5T2FYIZ", {
                  "action": "homepage"
                })`,
  `window.LemonMix.Bot.tokenPromise()`,
  4
);

/* The UI setup block — the one that clones #chatButton and #storeButton into
 * the mod's own menu and console buttons — was wrapped in a catch that blanked
 * document.body on a 100ms interval, alerted, and reloaded. One missing
 * element anywhere in a hundred lines cost you the whole page, a reload loop,
 * and no way to read what went wrong.
 *
 * Eleven of the twelve ids it reaches for are confirmed present (the game
 * bundle creates them, or the block itself does). The twelfth, #gameName, is
 * static page markup and is touched by the very last statement, so losing it
 * costs a heading colour. None of that is worth a blank page. */
edit(
  "stop a UI setup failure from blanking the page and reloading",
  `  } catch (_0xc2794f) {
    setInterval(() => {
      try {
        document.body.innerHTML = "";
      } catch (_0x470bfa) {}
    }, 100), alert("LemonMod failed to load. Please try again with CTRL+R."), location.reload();
  }`,
  `  } catch (_0xc2794f) {
    /* was: blank the page every 100ms, alert, reload */
    console.error("[LemonMix] menu setup stopped early:", _0xc2794f);
  }`
);

/* The whole settings menu is built behind a flag that a polling loop sets,
 * and the loop only sets it on readyState "interactive". "complete" falls
 * through and does nothing.
 *
 * So the menu gets built only if the script starts polling during the narrow
 * window between DOMContentLoaded and load. Start a moment later — a slow
 * userscript manager, a warm cache, document-idle firing after the page has
 * settled — and readyState is already "complete", the flag is never set, and
 * the menu silently never appears. It is a race the original won often enough
 * to ship. */
edit(
  "build the menu when the document is already complete, not just interactive",
  `      case "interactive":
        _0x3177fa = 1;
        break;
      case "complete":
        break;`,
  `      case "interactive":
      /* was: "complete" fell through without setting the flag, so a script
       * that started after the page had finished never built the menu */
      case "complete":
        _0x3177fa = 1;
        break;`
);

/* ================================================================== *
 * 4c. Three references that were already broken
 *
 * These predate the merge. They are only visible now because the packet layer
 * works, so the code paths carrying them actually get reached.
 * ================================================================== */

/* `dns` — "do new send" — is the alias the developer console builds its
 * commands around, and the katana/musket quick-equip helpers call it
 * directly. It was never defined anywhere in either script, so !km, !pm and
 * !sh threw a ReferenceError instead of equipping anything. It takes the same
 * [ name, args ] pair as the send helper. */
edit(
  "define the dns() send alias the quick-equip helpers call",
  `  function _0x3909b8() {
    if (LEMONMOD_0x211e6c) {
      console.log("katana equipped");
    }
    dns([6, [4]]);
  }`,
  `  /* Defined here because nothing else defines it: every dns() call site in
   * both scripts was a ReferenceError. */
  window.dns = _0x2e0f39 => window.LemonMix.send([String(_0x2e0f39[0]), _0x2e0f39[1]]);
  function _0x3909b8() {
    if (LEMONMOD_0x211e6c) {
      console.log("katana equipped");
    }
    dns([6, [4]]);
  }`
);

/* `iChat` is read on the insta-kill path but there is no #iChat input in the
 * menu and no assignment to it anywhere — another ReferenceError, on the hot
 * path this time. Declared empty and guarded, so the branch runs and sends
 * nothing rather than throwing out of the middle of the combo. */
edit(
  "guard the undefined iChat reference on the insta path",
  `_0x141996 && _0x3a425c(iChat),`,
  `_0x141996 && window.iChat && _0x3a425c(window.iChat),`
);

/* The bots' idle chatter advertised the author's site. */
edit(
  "drop the bot chat advert",
  `      let _0x5bf2f6 = ["ch", "www.lemonmod.com"];`,
  `      let _0x5bf2f6 = ["ch", "LemonMod Bots"];`
);

/* A bot routine that spawned clients and had them repeat a racial slur in
 * chat a hundred times a second. It is not a mod feature, it is a harassment
 * tool, and it is not carried over. */
edit(
  "remove the slur-spam bot routine",
  `        let _0xb26b79 = setInterval(() => {
          _0x5875ad.emit(["ch", ["I Shoot Niggas For Fun!"]]);
        }, 10);`,
  `        /* removed: chat spam loop that repeated a racial slur */
        let _0xb26b79 = setInterval(() => {}, 10);`
);

/* ================================================================== *
 * 5. Assemble
 * ================================================================== */

/* The msgpack codec, lifted whole out of the game's own vendor chunk so the
 * bot sockets frame exactly what the game frames. Ends where the Decoder
 * class ends; everything after that in the chunk is unrelated. */
const vendor = fs.readFileSync(VENDOR, "utf8").split(/\r?\n/);
const CODEC_END = vendor.findIndex((line, i) => i > 1400 && line === "}();");
if (CODEC_END === -1 || CODEC_END > 1460) {
  throw new Error("could not find the end of the msgpack codec in src/game_vendor.js");
}
const codec = vendor.slice(0, CODEC_END + 1).join("\n");
if (!/var\s+yn\s*=|,\s*yn\s*=/.test(codec) || !/kn\s*=\s*function/.test(codec)) {
  throw new Error("the msgpack slice does not contain both the Encoder and the Decoder");
}

/* The weapon speeds the reload bars key off, and the protocol constants the
 * bot sockets need, both taken from the extracted drivers rather than typed
 * out again — tools/verify-lemonmix.js diffs them back. */
/* `speed` drives the reload bars; `projectileSpeed` is how a projectile packet
 * gets traced back to the player who fired it, since the packet does not say. */
const weaponTable = JSON.stringify(
  DRIVERS.weapons.map(w => {
    const row = { name: w.name, speed: w.speed };
    if (w.projectile !== undefined) {
      const p = DRIVERS.projectiles[w.projectile];
      if (p && p.speed !== undefined) row.projectileSpeed = p.speed;
    }
    return row;
  }),
  null,
  1
);

const protocol = DRIVERS.protocol;

/* The transport primitives, sliced straight out of the game bundle rather
 * than reimplemented: the seeded opcode permutation (Co / Oi / Po) and the
 * truncated HMAC-SHA256 that signs every frame (Do / Vt / j / Ao / Eo) plus
 * the hex key decoder (Ro). Only the bot sockets use them — everything the
 * player does is framed by the game itself. */
const gameIndex = fs.readFileSync(path.join(ROOT, "src/game_index.js"), "utf8").split(/\r?\n/);
const CRYPTO_FIRST = gameIndex.findIndex(line => line === "function Co(e) {");
const CRYPTO_LAST = gameIndex.findIndex(line => line.startsWith("const Hi = new "));
if (CRYPTO_FIRST === -1 || CRYPTO_LAST === -1 || CRYPTO_LAST <= CRYPTO_FIRST) {
  throw new Error("could not locate the transport primitives in src/game_index.js");
}
const cryptoSrc = gameIndex.slice(CRYPTO_FIRST, CRYPTO_LAST).join("\n").trimEnd();
for (const fn of ["function Co(", "function Oi(", "function Po(", "function Vt(", "function Ao(", "function Eo(", "function Ro(", "const Do ="]) {
  if (!cryptoSrc.includes(fn)) throw new Error(`transport slice is missing ${fn}`);
}

const header = `// ==UserScript==
// @name            ! LemonMod v3.0 (Mix) !
// @namespace       lemonmix
// @author          LemonMod by LemonFlux - rebuilt against the current game bundle
// @description     LemonMod v3.0 and LemonMod Visuals v3.0 merged into one script, on the protocol the game actually speaks, with the install gate and the call-home paths removed
// @version         3.0-mix
// @match           *://moomoo.io/*
// @match           *://*.moomoo.io/*
// @run-at          document-start
// @grant           none
// @license         Apache-2.0
// ==/UserScript==

/*
 * One file. There is no Visuals script to install, and nothing here asks you
 * to download one.
 *
 * Removed from the originals, all of it silent and none of it optional:
 *
 *   - a fetch of crCheck.php on every load which, on the right answer, fetched
 *     cr.php and eval'd the response — remote code, on the author's say-so
 *   - a fetch of https://ksw2-center.glitch.me/mm_aib_1 fired from the Visuals
 *     script's init, behind a base64 string and a decoy object
 *   - an XHR to /api/death on every death carrying your health, the damage
 *     taken, your weapons and several menu settings
 *   - a version ping to latest.php, and a forced redirect to the author's
 *     download page when it disagreed with the build
 *   - a remote stylesheet from the same host, which is another way to put
 *     content on the page after the fact
 *   - sounds, notification icons and the mouse cursor, each a request to the
 *     author's host timed to what you are doing in game
 *   - a bot routine that repeated a racial slur in chat a hundred times a
 *     second
 *
 * jQuery and msgpack were pulled from the same host too. The codec is now the
 * game's own, and jQuery is replaced by the eight methods LemonMod uses.
 */
`;

/* replaceAll, not replace: a second use of a placeholder would otherwise be
 * left as a bare identifier and only show up as a ReferenceError at runtime,
 * on whatever code path happened to touch it. */
let runtime = fs.readFileSync(RUNTIME, "utf8")
  .replaceAll("LEMONMIX_WEAPONS", "LemonMix.Weapons")
  .replaceAll("LEMONMIX_RING_SPRITE", "LemonMix.RingSprite");
{
  const leftover = runtime.match(/\bLEMONMIX_[A-Z_]+\b/g);
  if (leftover) throw new Error("unsubstituted placeholders in the runtime: " + [...new Set(leftover)].join(", "));
}

const injector = fs.readFileSync(INJECTOR, "utf8");

const prelude = `
/* ---- msgpack, from the game's own vendor chunk ------------------- */
${codec}

const LemonMixEncoder = new yn();
const LemonMixDecoder = new kn();
const msgpack = window.msgpack = {
  encode: value => LemonMixEncoder.encode(value),
  decode: bytes => LemonMixDecoder.decode(bytes),
};

/* ---- transport constants, from drivers/game-drivers.json ---------- */
/* The frame layout the current game uses: six bytes of truncated HMAC-SHA256
 * over msgpack([opcode, args, seq]), with both opcode alphabets permuted from
 * the io-init seed. Only the bot sockets build frames by hand; everything the
 * player does goes through the game's own io.send. */
const jt = ${protocol.signatureBytes};
const Ht = ${protocol.encryptedMode};
const Io = ${protocol.tableSalt};
const bo = ${JSON.stringify(protocol.c2sAlphabet)};
const To = ${JSON.stringify(protocol.s2cAlphabet)};

/* ---- transport primitives, from src/game_index.js ---------------- */
${cryptoSrc}

${runtime}

LemonMix.Weapons = ${weaponTable};

/* A soft ring, drawn over the player the insta script is aiming at. The
 * original pulled a PNG off the author's host on every frame it was visible. */
LemonMix.RingSprite = "data:image/svg+xml;base64," + btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<circle cx="50" cy="50" r="44" fill="none" stroke="#ff3b3b" stroke-width="6" stroke-opacity="0.85"/>' +
  '<circle cx="50" cy="50" r="30" fill="none" stroke="#ff3b3b" stroke-width="3" stroke-opacity="0.45"/>' +
  "</svg>"
);

${injector}
`;

/* The two halves of this script need opposite timings.
 *
 * The injector has to run at document-start: it claims the bundle <script>
 * before the browser executes it, and there is no second chance at that.
 *
 * The mod body must not. It reads #enterGame and #nameInput straight off the
 * document at load — the original shipped with no @run-at at all, so a
 * userscript manager gave it document-idle and the page was already built. At
 * document-start those lookups return null and the first .addEventListener on
 * one throws, which takes out everything below it: no menu, no visuals, and a
 * game that runs perfectly normally because the injector already did its half.
 *
 * So the body is deferred to DOMContentLoaded, which is what document-idle
 * effectively gave it before. */
const body = `
/* ================================================================== *
 * LemonMod v3.0
 *
 * Deobfuscated from the shipped script (see tools/deobfuscate-lemonmod.js)
 * and patched by tools/build-lemonmix.js. The identifier names are the ones
 * the obfuscator left behind; they are meaningless, but they are stable, so
 * every edit in the build script can be anchored to an exact string.
 *
 * Deferred to DOMContentLoaded: this half reaches for #enterGame and friends
 * at load, and at document-start they do not exist yet.
 * ================================================================== */
function LemonMixMain() {
${code}
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", LemonMixMain, { once: true });
} else {
  LemonMixMain();
}
`;

const out = header + "\n(function() {\n" + prelude + body + "\n})();\n";
fs.writeFileSync(OUT, out);

console.log("wrote  :", path.relative(ROOT, OUT));
console.log("source :", path.relative(ROOT, MAIN));
console.log("");
for (const label of applied) console.log("  applied  " + label);
console.log(`\n${applied.length} edits applied.`);
