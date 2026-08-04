#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const {createRequire} = require("module");

const {ROOT, extractGameTransport, loadGameCodec} = require("./game-transport");

const target = process.argv[2] || path.join(ROOT, "Ae86_Fixed.user.js");

function loadPlaywright() {
    const candidates = [__filename, "/opt/node22/lib/node_modules/playwright/index.js", "/usr/lib/node_modules/playwright/index.js", "/usr/local/lib/node_modules/playwright/index.js"];
    for (const base of candidates) {
        try {
            return createRequire(base)("playwright");
        } catch (error) {
            continue;
        }
    }
    throw new Error("playwright not found — install it with: npm i --no-save playwright");
}

const ELEMENT_IDS = ["actionBar", "ad-container", "ageBarBody", "ageText", "allianceHolder", "allianceManager", "allianceMenu", "altServer", "chatHolder", "diedText", "downloadButtonContainer", "featuredYoutube", "foodDisplay", "gameUI", "guideCard", "itemInfoHolder", "killCounter", "leaderboard", "leaderboardData", "loadingText", "mainMenu", "menuCardHolder", "mobileDownloadButtonContainer", "noticationDisplay", "ot-sdk-btn-floating", "pingDisplay", "pre-content-container", "scoreDisplay", "shutdownDisplay", "skinColorHolder", "stoneDisplay", "storeHolder", "storeMenu", "touch-controls-fullscreen", "touch-controls-left", "touch-controls-right", "turnstileWidget", "upgradeCounter", "upgradeHolder", "woodDisplay"];

const BUTTON_IDS = ["allianceButton", "chatButton", "enterGame", "joinPartyButton", "leaderboardButton", "partyButton", "settingsButton", "storeButton"];

const INPUT_IDS = ["allianceInput", "chatBox", "nameInput"];

const CHECKBOX_IDS = ["nativeResolution", "playMusic", "showPing"];

function pageHtml() {
    const divs = ELEMENT_IDS.map(id => `<div id="${id}"></div>`).join("\n");
    const buttons = BUTTON_IDS.map(id => `<div id="${id}"><span></span></div>`).join("\n");
    const inputs = INPUT_IDS.map(id => `<input id="${id}" type="text">`).join("\n");
    const checks = CHECKBOX_IDS.map(id => `<input id="${id}" type="checkbox">`).join("\n");
    return `<!doctype html>
<html><head><title>moomoo.io</title>
<style>body{margin:0}#enterGame{position:fixed;left:420px;top:320px;width:200px;height:40px;background:#8ecc51}</style>
<script type="module" crossorigin src="/assets/index-deadbeef.js"></script>
</head><body>
<canvas id="gameCanvas" width="1920" height="1080"></canvas>
<canvas id="mapDisplay" width="300" height="300"></canvas>
<select id="serverBrowser"></select>
<img id="promoImg">
${divs}
${buttons}
${inputs}
${checks}
</body></html>`;
}

const SERVERS = [{
    region: "eu-west",
    name: "1",
    index: 0,
    key: "0",
    ip: "1.2.3.4",
    port: 443,
    playerCount: 3,
    playerCapacity: 40,
    games: [{
        playerCount: 3
    }]
}];

let failures = 0;

function check(label, condition, detail) {
    if (condition) {
        console.log("  ok    " + label);
    } else {
        failures += 1;
        console.log("  FAIL  " + label + (detail ? " — " + detail : ""));
    }
}

function bytesEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeout, step) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        if (await predicate()) {
            return true;
        }
        await wait(step || 100);
    }
    return false;
}

async function main() {
    console.log("smoke-ae86: " + path.relative(ROOT, target));

    if (!fs.existsSync(target)) {
        console.log("  FAIL  built script exists");
        process.exit(1);
    }

    const {chromium} = loadPlaywright();
    const game = extractGameTransport();
    const codec = await loadGameCodec();

    const SEED = 0x5f3a91c7;
    const KEY_HEX = "8f2b41d97ce05a36bb1e7d40f9a2c83571e6094dab3f5c28e70d1946bc8a2f53";
    const key = game.Ro(KEY_HEX);
    const tables = game.Po(SEED >>> 0);

    const received = [];
    let handshakeSent = false;
    let socketUrl = null;
    let badSignature = null;
    let badSequence = null;
    let expectedSeq = 0;

    const browser = await chromium.launch({
        args: ["--no-sandbox"]
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on("pageerror", error => {
        console.log("  note  page error: " + String(error).split("\n")[0]);
    });

    await page.routeWebSocket("**/*", ws => {
        ws.onMessage(message => {
            const bytes = Buffer.isBuffer(message) ? new Uint8Array(message) : new Uint8Array(Buffer.from(message));
            const signature = bytes.subarray(0, game.jt);
            const body = bytes.subarray(game.jt);
            const expected = game.Eo(key, body);
            if (!bytesEqual(signature, expected)) {
                badSignature = Array.from(signature).join(",");
                return;
            }
            let frame;
            try {
                frame = codec.decoder.decode(body);
            } catch (error) {
                badSignature = "undecodable payload";
                return;
            }
            const letter = tables.c2s.dec[frame[0]];
            expectedSeq += 1;
            if (frame[2] !== expectedSeq) {
                badSequence = "got " + frame[2] + " expected " + expectedSeq;
            }
            received.push({
                letter: letter,
                args: frame[1],
                seq: frame[2]
            });
            if (letter === "0") {
                ws.send(Buffer.from(codec.encoder.encode([tables.s2c.enc["0"], []])));
            }
            if (letter === "M") {
                ws.send(Buffer.from(codec.encoder.encode([tables.s2c.enc["C"], [1]])));
                ws.send(Buffer.from(codec.encoder.encode([tables.s2c.enc["Z"], [125]])));
            }
        });
        socketUrl = ws.url();
        handshakeSent = true;
        ws.send(Buffer.from(codec.encoder.encode(["io-init", [1, SEED >>> 0, KEY_HEX, game.Ht]])));
    });

    await page.route("**/*", route => {
        route.fulfill({
            status: 200,
            contentType: "text/plain",
            body: ""
        });
    });

    await page.route("https://api.moomoo.io/**", route => {
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(SERVERS)
        });
    });

    await page.route("**/assets/index-*.js", route => {
        route.fulfill({
            status: 200,
            contentType: "application/javascript",
            body: "window.__stockBundleRan = true;"
        });
    });

    await page.route("https://challenges.cloudflare.com/**", route => {
        route.fulfill({
            status: 200,
            contentType: "application/javascript",
            body: `window.turnstile = {
                ready: function (cb) { cb(); },
                render: function (el, opts) { setTimeout(function () { opts.callback("SMOKE-TOKEN"); }, 10); return "w1"; },
                reset: function () {},
                remove: function () {},
                getResponse: function () { return "SMOKE-TOKEN"; }
            };`
        });
    });

    await page.route("**/ping", route => {
        route.fulfill({
            status: 200,
            contentType: "text/plain",
            body: "ok"
        });
    });

    await page.route("https://moomoo.io/", route => {
        route.fulfill({
            status: 200,
            contentType: "text/html",
            body: pageHtml()
        });
    });

    await page.addInitScript({
        path: target
    });
    await page.goto("https://moomoo.io/", {
        waitUntil: "domcontentloaded"
    });

    console.log("\nEntry");
    const booted = await waitFor(() => page.evaluate(() => Boolean(window.vultr && window.vultr.servers)), 20000);
    check("bundle booted with a live server list", booted);
    check("stock game bundle was blocked", !(await page.evaluate(() => Boolean(window.__stockBundleRan))));
    check("legacy client globals are exposed", await page.evaluate(() => typeof window.selectSkinColor === "function" && typeof window.storeBuy === "function"));

    console.log("\nHandshake");
    const connected = await waitFor(() => Promise.resolve(handshakeSent), 20000);
    check("client opened a socket and the server sent io-init", connected);
    check("socket url carries the cf: challenge token the live server requires", Boolean(socketUrl && /[?&]token=cf%3ASMOKE-TOKEN/.test(socketUrl)), String(socketUrl));

    const wired = await waitFor(() => page.evaluate(() => {
        const button = document.getElementById("enterGame");
        return Boolean(button && typeof button.onclick === "function");
    }), 20000);
    check("enter-game button is wired by the connect callback", wired);
    await page.click("#enterGame", {
        force: true
    });

    const sawSpawn = await waitFor(() => Promise.resolve(received.some(frame => frame.letter === "M")), 20000);

    console.log("\nClient to server");
    check("frames carry a valid truncated hmac", badSignature === null, badSignature || "");
    check("frames carry a monotonic sequence number", badSequence === null, badSequence || "");
    check("spawn arrived as the current opcode M", sawSpawn, "saw " + JSON.stringify(received.map(f => f.letter)));
    const spawnFrame = received.find(frame => frame.letter === "M");
    check("spawn payload is the current shape", Boolean(spawnFrame && spawnFrame.args && spawnFrame.args[0] && typeof spawnFrame.args[0].name === "string" && "moofoll" in spawnFrame.args[0] && "skin" in spawnFrame.args[0]), spawnFrame ? JSON.stringify(spawnFrame.args) : "");
    check("every frame maps to a current c2s opcode", received.length > 0 && received.every(frame => game.bo.includes(frame.letter)), JSON.stringify(received.map(f => f.letter)));

    console.log("\nMenu");
    const menu = await waitFor(() => page.evaluate(() => Boolean(document.getElementById("ae86Menu"))), 20000);
    check("menu is rendered", menu);
    const rows = await page.evaluate(() => {
        const el = document.getElementById("ae86Menu");
        return el ? [...el.querySelectorAll(".row")].map(r => r.firstChild.textContent) : [];
    });
    check("menu lists the chat commands", rows.includes("!!atck") && rows.includes("!!heals"), rows.length + " rows");
    check("menu lists the key features", rows.some(r => r.includes("[q]")) && rows.some(r => r.includes("[h]")), JSON.stringify(rows.slice(-7)));

    const chatBefore = received.filter(f => f.letter === "6").length;
    await page.evaluate(() => {
        const row = [...document.getElementById("ae86Menu").querySelectorAll(".row")]
            .find(r => r.firstChild.textContent === "!!atck");
        row.click();
    });
    await wait(600);
    const chatAfter = received.filter(f => f.letter === "6").length;
    check("a command is handled by the client, not broadcast as chat", chatAfter === chatBefore, "chat frames " + chatBefore + " -> " + chatAfter);

    console.log("\nServer to client");
    const sawPing = await waitFor(() => Promise.resolve(received.some(frame => frame.letter === "0")), 20000);
    check("client sent the ping opcode 0", sawPing);
    const shutdownShown = await waitFor(() => page.evaluate(() => {
        const el = document.getElementById("shutdownDisplay");
        return Boolean(el && (el.textContent || "").includes("2:05"));
    }), 20000);
    check("client rendered the shutdown-notice argument it decoded from opcode Z", shutdownShown, await page.evaluate(() => {
        const el = document.getElementById("shutdownDisplay");
        return el ? JSON.stringify(el.textContent) : "no element";
    }));
    const pingShown = await waitFor(() => page.evaluate(() => {
        const el = document.getElementById("pingDisplay");
        return Boolean(el && /\d/.test(el.textContent || ""));
    }), 20000);
    check("client rendered the ping reply it decoded from opcode 0", pingShown, await page.evaluate(() => {
        const el = document.getElementById("pingDisplay");
        return el ? JSON.stringify(el.textContent) : "no element";
    }));

    await browser.close();

    console.log("");
    if (failures > 0) {
        console.log("smoke-ae86: " + failures + " check(s) failed");
        process.exit(1);
    }
    console.log("smoke-ae86: all checks passed");
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
