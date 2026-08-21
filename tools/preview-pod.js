// preview-pod.js — render the Pod's look without launching the game.
//
// Pulls the real drawing functions and the real CSS out of YoRHa_System.user.js,
// paints them in Chromium, and writes two PNGs next to the script:
//
//   pod-preview-unit.png   every unit, in every state, at both draw sizes
//   pod-preview-panel.png  the terminal in English and Arabic, drawer open
//
//   npm i --no-save playwright && node tools/preview-pod.js
//
// A pre-installed Chromium is used when one is present (PLAYWRIGHT_BROWSERS_PATH
// or /opt/pw-browsers); otherwise Playwright's own download is used.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "YoRHa_System.user.js"), "utf8");

function slice(startMarker, endMarker) {
    const a = SRC.indexOf(startMarker);
    if (a < 0) throw new Error("marker not found: " + startMarker);
    const b = SRC.indexOf(endMarker, a);
    if (b < 0) throw new Error("marker not found: " + endMarker);
    return SRC.slice(a, b);
}

// Find a browser binary without downloading one.
function findChromium() {
    const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, "/opt/pw-browsers"].filter(Boolean);
    for (const root of roots) {
        let entries = [];
        try { entries = fs.readdirSync(root); } catch (e) { continue; }
        for (const dir of entries.filter(d => /^chromium/.test(d)).sort().reverse()) {
            for (const rel of ["chrome-linux/headless_shell", "chrome-linux/chrome",
                               "chrome-mac/Chromium.app/Contents/MacOS/Chromium"]) {
                const p = path.join(root, dir, rel);
                if (fs.existsSync(p)) return p;
            }
        }
    }
    return null;
}

const FONT = '<link href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700&display=swap" rel="stylesheet">';

// ---------------------------------------------------------------- unit sheet
// podFly is flight state rather than art, so it is dropped from the extract.
const ART = slice("        const POD_UNITS = [", "        function renderPod(xOffset, yOffset) {")
    .replace(/const podFly = \{[^}]*\};/, "")
    // podDrawMark reads the live waypoint and the screen size; the preview
    // supplies both so the marker can be drawn on its own.
    + "\n const PodMark = { x:0,y:0,label:'',kind:'',until:0, live(){return Date.now()<this.until;} };" +
      "\n let maxScreenWidth = 560, maxScreenHeight = 260;" +
      "\n const UTILS = { getDistance:(a,b,c,d)=>Math.hypot(c-a,d-b) };";

const unitHtml = `<!doctype html><html><head><meta charset="utf-8">${FONT}
<style>body{margin:0;background:#c7c3b1;font-family:Jost,sans-serif}canvas{display:block}</style>
</head><body><canvas id="c" width="1180" height="620"></canvas><script>
${ART}
const c = document.getElementById("c"), x = c.getContext("2d");
x.fillStyle = "#c7c3b1"; x.fillRect(0, 0, c.width, c.height);
x.strokeStyle = "rgba(69,65,56,0.08)"; x.lineWidth = 1;
for (let i = 0; i < c.width;  i += 40) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, c.height); x.stroke(); }
for (let i = 0; i < c.height; i += 40) { x.beginPath(); x.moveTo(0, i); x.lineTo(c.width, i); x.stroke(); }
const states = [
    { label: "IDLE",     flap: 0,   charge: 0,   thrust: 0,   talking: false, aim: -0.4 },
    { label: "MOVING",   flap: 0,   charge: 0,   thrust: 0.9, talking: false, aim: 0.9 },
    { label: "FIRING",   flap: 1,   charge: 1,   thrust: 0.3, talking: false, aim: 0 },
    { label: "SPEAKING", flap: 0.2, charge: 0.1, thrust: 0,   talking: true,  aim: -1.6 }
];
x.font = "600 12px Jost, sans-serif"; x.textAlign = "center";
POD_UNITS.forEach((U, r) => {
    states.forEach((s, col) => {
        const cx = 150 + col * 270, cy = 110 + r * 140;
        const opts = { flap: s.flap, charge: s.charge, thrust: s.thrust, talking: s.talking };
        x.save(); x.translate(cx, cy);
        x.save(); x.scale(1.6, 1.6); podDrawBody(x, U, 1000, s.aim, opts); x.restore();
        x.save(); x.translate(62, 6); podDrawBody(x, U, 1000, s.aim, opts); x.restore();
        x.restore();
        if (r === 0) { x.fillStyle = "#454138"; x.textAlign = "center"; x.fillText(s.label, cx + 20, 34); }
    });
    x.fillStyle = "#454138"; x.textAlign = "left";
    x.font = "600 13px Jost, sans-serif"; x.fillText(U.id, 18, 115 + r * 140);
    x.font = "600 12px Jost, sans-serif";
});
podDrawReticle(x, 1080, 560, POD_UNITS[0], 0.6, true);
podDrawReticle(x, 1000, 560, POD_UNITS[0], 0.2, false);
x.fillStyle = "#454138"; x.textAlign = "left"; x.fillText("RETICLE  idle / lock", 940, 600);

// The waypoint, in both of its forms.
PodMark.until = Date.now() + 60000;
maxScreenWidth = 560; maxScreenHeight = 260;
x.save();
x.translate(150, 428);
PodMark.x = 280; PodMark.y = 120; PodMark.label = "FARM"; PodMark.kind = "farm";
podDrawMark(x, 0, 0, 90, 200, POD_UNITS[0]);
PodMark.x = 900; PodMark.y = 40; PodMark.label = "KAINE"; PodMark.kind = "target";
podDrawMark(x, 0, 0, 90, 200, POD_UNITS[0]);
x.restore();
x.fillStyle = "#454138"; x.textAlign = "left";
x.fillText("WAYPOINT  on-screen / off-screen edge arrow", 130, 612);
<\/script></body></html>`;

// --------------------------------------------------------------- panel sheet
const CSS = slice("    /* =====================================================================\n       POD TERMINAL",
                  "`;");

const row = (who, tag, time, msg, cls) =>
    `<div class="pod-line pod-${who}${cls ? " " + cls : ""}">` +
    `<span class="pod-who">${tag}</span><span class="pod-t">${time}</span>` +
    `<span class="pod-msg">${msg}</span></div>`;

const enLines =
    row("pod", "POD", "21:04:11", "Pod support online. Records restored — session 12. Best streak on record: 9.") +
    row("you", "OP", "21:04:19", "what should I build here") +
    row("pod", "POD", "21:04:20", "Proposal: place a spike south-east and a trap behind them. You are short on stone — 8 held.") +
    row("you", "OP", "21:04:41", "any threats") +
    row("pod", "POD", "21:04:42", "Alert: hostile approaching from north-west, 480 units. Recommend disengaging.") +
    row("sys", "SYS", "21:04:55", "Microphone access denied.") +
    row("pod", "POD", "21:05:02", "Analysis: two units contest the centre", "typing");

const arLines =
    row("pod", "بود", "21:04:11", "وحدة البود جاهزة. تم استرجاع السجلات — الجلسة ١٢.") +
    row("you", "OP", "21:04:19", "وش أبني هنا؟") +
    row("pod", "بود", "21:04:20", "اقتراح: حط سبايك جنوب شرقك وتراب خلفهم. حجارتك قليلة — عندك ٨ فقط.") +
    row("you", "OP", "21:04:41", "فيه خطر؟") +
    row("pod", "بود", "21:04:42", "تنبيه: عدو جاي من شمال غربك، على بعد ٤٨٠. انسحب وتعالج.") +
    row("pod", "بود", "21:05:02", "تحليل: وحدتان تتنازعان الوسط", "typing");

function panel(o) {
    return `
<div id="pod-shell" style="position:relative;right:auto;bottom:auto;">
<div id="pod-panel" class="open${o.rtl ? " rtl" : ""}">
  <div class="pod-scan"></div>
  <div id="pod-head">
    <span class="pod-badge">POD</span><span id="pod-title">042</span>
    <span class="pod-hspace"></span>
    <button class="pod-b">${o.rtl ? "ع" : "EN"}</button>
    <button class="pod-b on">VOX</button>
    <button class="pod-b${o.mic ? " on" : ""}" id="pod-b-mic">MIC</button>
    <button class="pod-b${o.mem ? " on" : ""}">MEM</button>
    <button class="pod-b pod-b-x">✕</button>
  </div>
  <div id="pod-sub">
    <span id="pod-state" class="${o.busy ? "busy" : ""}">${o.state}</span>
    <span class="pod-dots"></span><span id="pod-link" class="on">${o.link}</span>
  </div>
  <div id="pod-log" dir="${o.rtl ? "rtl" : "ltr"}">${o.lines}</div>
  <div id="pod-mem" class="${o.mem ? "open" : ""}">
    <div id="pod-mem-head"><span>MEMORY</span><button class="pod-b">CLEAR ALL</button></div>
    <div id="pod-mem-list">
      <div class="pod-mem-row"><span class="pod-mem-tag">build</span><span class="pod-mem-txt">Runs polearm into repeater crossbow.</span><button class="pod-mem-x">✕</button></div>
      <div class="pod-mem-row"><span class="pod-mem-tag">name</span><span class="pod-mem-txt">Operator goes by Ryn.</span><button class="pod-mem-x">✕</button></div>
      <div class="pod-mem-row"><span class="pod-mem-tag">order</span><span class="pod-mem-txt">Warn before spike-ticking near a windmill.</span><button class="pod-mem-x">✕</button></div>
    </div>
  </div>
  <div id="pod-inrow">
    <span class="pod-caret">&gt;</span>
    <input id="pod-in" dir="${o.rtl ? "rtl" : "ltr"}" placeholder="${o.ph}" value="${o.val || ""}"/>
    <button class="pod-b pod-send">${o.rtl ? "إرسال" : "SEND"}</button>
  </div>
  <div id="pod-foot">${o.foot}</div>
</div>
</div>`;
}

const panelHtml = `<!doctype html><html><head><meta charset="utf-8">${FONT}
<style>
 body { margin:0; padding:26px; background:#5c6b4a; display:flex; gap:26px;
        align-items:flex-start; font-family:Jost,sans-serif; }
 .cap { color:#e2ddc9; font-size:11px; letter-spacing:3px; text-transform:uppercase; margin-bottom:8px; }
${CSS}
</style></head><body>
<div><div class="cap">English · standby</div>${panel({
    rtl: false, state: "STANDBY", link: "CLAUDE · opus-5", lines: enLines,
    ph: "talk to the pod…", foot: "LINK CLAUDE · VOICE ON · MEMORY 7 · K 214 / 9" })}</div>
<div><div class="cap">English · analysing, memory open</div>${panel({
    rtl: false, state: "ANALYSING", busy: true, link: "CLAUDE · opus-5", lines: enLines, mem: true, mic: true,
    ph: "talk to the pod…", val: "how do I break this trap", foot: "LINK CLAUDE · VOICE ON · MEMORY 7 · K 214 / 9" })}</div>
<div><div class="cap">العربية · listening</div>${panel({
    rtl: true, state: "ينصت", link: "كلود · opus-5", lines: arLines, mic: true,
    ph: "كلّم البود…", foot: "الاتصال كلود · الصوت مفعّل · الذاكرة ٧ · K 214 / 9" })}</div>
</body></html>`;

(async () => {
    const exe = findChromium();
    const browser = await chromium.launch(exe ? { executablePath: exe } : {});

    const shots = [
        { html: unitHtml,  out: "pod-preview-unit.png",  w: 1180, h: 620, sel: "#c",   scale: 1 },
        { html: panelHtml, out: "pod-preview-panel.png", w: 1320, h: 560, sel: null,   scale: 2 }
    ];
    for (const s of shots) {
        const tmp = path.join(ROOT, "." + s.out + ".html");
        fs.writeFileSync(tmp, s.html);
        const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.scale });
        await page.goto("file://" + tmp);
        await page.waitForTimeout(1200);
        const target = s.sel ? page.locator(s.sel) : page;
        await target.screenshot(s.sel ? { path: path.join(ROOT, s.out) }
                                     : { path: path.join(ROOT, s.out), fullPage: true });
        await page.close();
        fs.unlinkSync(tmp);
        console.log("wrote " + s.out);
    }
    await browser.close();
})();
