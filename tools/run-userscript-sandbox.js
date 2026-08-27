#!/usr/bin/env node
// Run a userscript in a throwaway headless browser on a fake moomoo.io page and
// report every address it tries to reach. All requests are intercepted and
// refused, and fetch / XHR / sendBeacon / WebSocket / element.src / localStorage
// are wrapped, so nothing leaves the machine - the point is only to watch.
//
//   npm i --no-save playwright-core        # Chromium is already on the box
//   node tools/run-userscript-sandbox.js <file.user.js> [seconds]
//
// The game bundle is not there, so the mod crashes partway through its own
// startup - that is expected, and it happens after the parts that phone home.
const fs = require('fs');
const { chromium } = require('playwright-core');

const target = process.argv[2];
const seconds = Number(process.argv[3] || 8);

(async () => {
    const browser = await chromium.launch({
        executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
        args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const context = await browser.newContext();

    const attempts = [];
    await context.route('**/*', async (route) => {
        const req = route.request();
        const url = req.url();
        if (url === 'https://moomoo.io/' ) {
            return route.fulfill({
                status: 200, contentType: 'text/html',
                body: `<!doctype html><html><head><title>fake</title></head><body>
                       <div id="gameUI"></div><canvas id="gameCanvas"></canvas>
                       <div id="menuCardHolder"></div><div id="chatBox"></div>
                       <input id="nameInput"><div id="storeMenu"></div><div id="mapDisplay"></div>
                       </body></html>`
            });
        }
        attempts.push({ kind: 'http', method: req.method(), url, body: (req.postData() || '').slice(0, 300) });
        return route.abort();
    });

    const logs = [];
    context.on('console', m => { const t = m.text(); if (t.startsWith('[SANDBOX]')) logs.push(t); });

    // wrappers + a msgpack stub so the script gets past its first line
    await context.addInitScript(() => {
        const say = (...a) => console.log('[SANDBOX]', ...a);
        window.msgpack = { encode: (x) => new Uint8Array(0), decode: (x) => [0] };
        const realFetch = window.fetch;
        window.fetch = function (...args) {
            say('fetch ->', String(args[0]), JSON.stringify(args[1] || {}).slice(0, 300));
            return realFetch.apply(this, args);
        };
        const xhrOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (m, u, ...r) { say('XHR ->', m, u); return xhrOpen.call(this, m, u, ...r); };
        if (navigator.sendBeacon) {
            const b = navigator.sendBeacon.bind(navigator);
            navigator.sendBeacon = (u, d) => { say('sendBeacon ->', u); return b(u, d); };
        }
        window.WebSocket = class {
            constructor(url) { say('WebSocket ->', url); this.readyState = 0; }
            send() {} close() {} addEventListener() {}
        };
        const ce = document.createElement.bind(document);
        document.createElement = function (tag, ...rest) {
            const el = ce(tag, ...rest);
            if (/^(iframe|script|img)$/i.test(tag)) {
                let v = '';
                Object.defineProperty(el, 'src', {
                    get: () => v,
                    set: (nv) => { say(tag.toLowerCase() + '.src ->', nv); v = nv; }
                });
            }
            return el;
        };
        const ls = window.localStorage;
        const si = ls.setItem.bind(ls), gi = ls.getItem.bind(ls);
        window.localStorage.setItem = (k, v) => { say('localStorage.set', k, String(v).slice(0, 80)); return si(k, v); };
        window.localStorage.getItem = (k) => { say('localStorage.get', k); return gi(k); };
    });

    await context.addInitScript({ content: fs.readFileSync(target, 'utf8') });

    const page = await context.newPage();
    page.on('pageerror', () => {});   // the game DOM is fake, crashes are expected
    try { await page.goto('https://moomoo.io/', { waitUntil: 'domcontentloaded', timeout: 20000 }); } catch (e) { console.log('goto:', e.message.split('\n')[0]); }
    await page.waitForTimeout(seconds * 1000);

    // did the script actually get to run, or did it die on line 1?
    const probe = await page.evaluate(() => ({
        contextMenuHooked: typeof window.oncontextmenu === 'function',
        menuDiv: !!document.getElementById('menuDiv'),
        wsProxied: String(WebSocket.prototype.send).includes('native') === false,
        elements: document.body ? document.body.children.length : -1
    })).catch(e => ({ error: e.message.split('\n')[0] }));

    await browser.close();
    console.log('\n-- did it run? ' + JSON.stringify(probe));

    console.log(`\n### ${target}`);
    console.log(`\n-- outbound requests the browser refused: ${attempts.length}`);
    const seen = new Set();
    for (const a of attempts) {
        const k = a.method + ' ' + a.url;
        if (seen.has(k)) continue;
        seen.add(k);
        console.log(`   ${a.method} ${a.url}${a.body ? `\n      body: ${a.body}` : ''}`);
    }
    if (!attempts.length) console.log('   none');

    console.log(`\n-- in-page API calls: ${logs.length}`);
    const seen2 = new Set();
    for (const l of logs) { if (seen2.has(l)) continue; seen2.add(l); console.log('   ' + l.slice(0, 240)); }
    if (!logs.length) console.log('   none');
})();
