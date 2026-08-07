#!/usr/bin/env node
/*
 * e2e-hooks.js
 *
 * check-hooks.js proves the hook patterns match by lifting the Regexer class
 * out of the client by name. That stops working the moment the client is
 * obfuscated, which is exactly when you most want to know the hooks still bind.
 *
 * So this one runs the real thing instead: it serves a fake moomoo.io whose
 * bundle is the checked-in game source, loads the client into a browser at
 * document-start the way a userscript would, and lets the client discover the
 * bundle, fetch it, rewrite it, and hand it to Function(). That last call is
 * intercepted, so the rewritten source can be read back and checked for every
 * injection the hooks are supposed to make - without running the game.
 *
 * It answers the question check-hooks.js cannot: does this build, as shipped,
 * still rewrite the bundle correctly?
 *
 *   node tools/e2e-hooks.js <client.user.js>
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { minify_sync } = require("terser");

const ROOT = path.resolve(__dirname, "..");
const CLIENT = process.argv[2] || path.join(ROOT, "RYN_Client_v5_PLAYER.user.js");

/* Every string the hook list is supposed to splice into the bundle. If a hook
 * silently stops matching, its marker goes missing here. */
const EXPECTED = [
  "RYN._Renderer._preRender()",
  "RYN._Renderer._postRender()",
  "RYN._Renderer._mapPreRender(",
  "RYN._gameInit=function",
  "RYN._myClient._ModuleHandler._currentAngle",
  "RYN._offset._setXY(",
  "RYN._hooks._EntityRenderer._render(",
  "RYN._Renderer._renderObjects.push(",
  "RYN._hooks._ObjectRenderer._render(",
  "RYN._Renderer._objectAlpha()",
  "RYN._Renderer._objectTint(",
  "RYN._Renderer._drawAnimal(",
  "RYN._myClient._ModuleHandler._equip(",
  "RYN._myClient._gameNet",
  "RYN._myClient._gameCrypto",
  "RYN._myClient._turnstileToken",
  "RYN._enc=",
  "RYN._myClient._ModuleHandler._buy(",
  "RYN._hooks._ObjectRenderer._preRender(",
  "RYN._myClient._ModuleHandler._upgradeItem(",
  "RYN._settings._autospawn",
  "RYN._hooks._renderPlayer=",
  "RYN._ZoomHandler._scale._smooth._w",
  "RYN._ZoomHandler._scale._smooth._h",
  "RYN._settings._lowQuality",
  'name:"by rap"',
  'name:"wolfy"',
];

(async () => {
  const client = fs.readFileSync(CLIENT, "utf8");

  /* The hook patterns are written against minified code, and the bundle checked
   * in here is beautified, so re-minify it the way check-hooks.js does. */
  const bundleSource = ["src/game_vendor.js", "src/game_index.js"]
    .map((f) => fs.readFileSync(path.join(ROOT, f), "utf8"))
    .join("\n;\n");
  const minified = minify_sync(bundleSource, {
    module: true,
    compress: false,
    mangle: false,
    format: { comments: false },
  });
  if (minified.error) throw minified.error;

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage();

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));

  /* Catch the rewritten bundle on its way into Function() and swallow it - the
   * game itself does not need to run for the rewrite to be checkable. */
  await page.addInitScript(() => {
    window.__rewritten = null;
    const RealFunction = window.Function;
    window.Function = new Proxy(RealFunction, {
      apply(target, thisArg, args) {
        if (args.length === 1 && typeof args[0] === "string" && args[0].length > 100000) {
          window.__rewritten = args[0];
          return function () {};
        }
        return target.apply(thisArg, args);
      },
      construct(target, args) {
        return Reflect.construct(target, args);
      },
    });
  });

  await page.addInitScript({ content: client });

  await page.route("**/*", (route) => {
    const request = route.request();
    if (/\/assets\/.*\.js$/.test(request.url())) {
      /* The client finds the bundle by its <script src> and then re-fetches it
       * over XHR to rewrite it. Only the XHR gets the real bundle - letting the
       * <script> serve it too would run the game for real, which this test has
       * no page for and does not need. */
      const body = request.resourceType() === "script" ? "" : minified.code;
      return route.fulfill({ status: 200, contentType: "application/javascript", body });
    }
    return route.fulfill({
      status: 200,
      contentType: "text/html",
      body:
        "<!DOCTYPE html><html><head><title>t</title></head><body>" +
        "<div id='gameUI'></div><canvas id='gameCanvas'></canvas></body></html>",
    });
  });

  await page.goto("https://moomoo.io/");

  /* Added from here rather than from the page: the client strips inline scripts
   * whose text mentions "assets", which an in-page bootstrap would. */
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.src = "/assets/index-test.js";
    (document.head || document.documentElement).appendChild(script);
  });

  await page.waitForFunction(() => window.__rewritten !== null, null, { timeout: 20000 }).catch(() => {});

  const rewritten = await page.evaluate(() => window.__rewritten);
  await browser.close();

  console.log("client :", path.relative(ROOT, CLIENT));
  console.log("");

  if (!rewritten) {
    console.log("the client never handed a rewritten bundle to Function()");
    if (errors.length) console.log("page errors:\n  " + errors.join("\n  "));
    process.exit(1);
  }

  const missing = EXPECTED.filter((marker) => !rewritten.includes(marker));
  for (const marker of EXPECTED) {
    console.log(`  ${missing.includes(marker) ? "MISSING" : "spliced"} ${marker}`);
  }

  console.log(
    `\n${EXPECTED.length - missing.length}/${EXPECTED.length} injections present in the rewritten bundle ` +
      `(${(rewritten.length / 1024).toFixed(0)} KB).`
  );

  if (errors.length) console.log("\npage errors:\n  " + errors.join("\n  "));
  if (missing.length) process.exit(1);
})();
