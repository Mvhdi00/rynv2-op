/* ===========================================================================
 * Cosmos — a space theme for the chicken menu.
 *
 * Purely additive: it restyles what the client already builds and never renames
 * an id, so every select, input and button keeps working exactly as before. It
 * replaces the menu's remote city photograph, which was the only thing the menu
 * pulled off a third-party host.
 *
 * The star layers are generated rather than hand-written: three parallax fields
 * of box-shadow dots drifting at different speeds, plus shooting stars on
 * staggered delays. No canvas, no images, no timers — it is all CSS, so it does
 * not compete with the game's own render loop.
 * ======================================================================== */
window.CHICKEN_COSMOS = (function () {
    "use strict";

    // A field of `count` star dots as one box-shadow list, laid out across a
    // `spread` x `height` px area so the layer can be tiled vertically.
    function starfield(count, spread, height, seed) {
        let s = seed;
        const rnd = function () {            // small deterministic PRNG
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
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700;800&display=swap");
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

/* ---------- the mod menu, in the RYN Client's visual language --------
 * Same tokens it uses: #7A42F4 into #3A86FF on near-black glass, Poppins for
 * headings and Inter for body, a 172px rail whose active item is marked by a
 * 3px accent border, flat hairline-separated rows, and the springy
 * cubic-bezier(.34,1.4,.64,1) it opens and throws its switch knobs with.
 *
 * Everything the client sets lives in inline styles, so the overrides have to
 * be !important. Nothing is renamed and no element moves, so every toggle,
 * slider and key bind keeps working.
 * ------------------------------------------------------------------------ */
#ckScriptMenu {
  --ryn-accent: #7A42F4;
  --ryn-accent2: #3A86FF;
  --ryn-text: #fff;
  --ryn-dim: rgba(200, 200, 215, .4);
  width: 1180px !important;
  height: 650px !important;
  max-width: 94vw !important;
  max-height: 90vh !important;
  border-radius: 20px !important;
  overflow: hidden !important;
  background: rgba(25, 25, 25, .45) !important;
  border: 1px solid rgba(255, 255, 255, .2) !important;
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, .2), inset 0 1px 1px rgba(255, 255, 255, .1);
  font-family: "Inter", "Poppins", system-ui, sans-serif;
  color: var(--ryn-text);
  /* the client toggles inline opacity to open and close it; ride that */
  transform: translate(-50%, -50%) scale(.98) translateY(-4px) !important;
  transition: opacity .15s ease-in, transform .2s cubic-bezier(.34, 1.4, .64, 1) !important;
}
#ckScriptMenu[style*="opacity: 1"] {
  transform: translate(-50%, -50%) scale(1) translateY(0) !important;
}

/* --- the rail --- */
#ckScriptMenu > div[style*="width: 212.5px"] {
  width: 172px !important;
  height: 100% !important;
  background: rgba(15, 15, 15, .3) !important;
  border-right: 1px solid rgba(255, 255, 255, .1);
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
}
/* the client's own title, given the header treatment RYN puts on its page name */
#ckScriptMenu div[style*="font-size: 25px"] {
  font-family: "Poppins", sans-serif !important;
  font-size: 13px !important;
  font-weight: 700 !important;
  letter-spacing: .22em !important;
  text-transform: uppercase;
  top: 16px !important;
  background: linear-gradient(90deg, #7A42F4, #3A86FF, #a07af4, #7A42F4);
  background-size: 200% auto;
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent !important;
  animation: ryn-shimmer 5s linear infinite;
}
@keyframes ryn-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

/* --- the tabs, as RYN's .open-menu rows --- */
#ckScriptMenu div[id^="tab:"] {
  left: 0 !important;
  width: 100% !important;
  height: 60px !important;
  border-radius: 0 !important;
  border-left: 3px solid transparent !important;
  border-bottom: 1px solid rgba(255, 255, 255, .05) !important;
  background: transparent !important;
  padding: 0 14px !important;
  gap: 10px;
  opacity: .7;
  color: var(--ryn-dim);
  box-sizing: border-box;
  transition: color 140ms, border-color 140ms, background 140ms, transform 100ms, opacity 100ms !important;
}
#ckScriptMenu div[id="tab:0"] { top: 58px !important; }
#ckScriptMenu div[id="tab:1"] { top: 118px !important; }
#ckScriptMenu div[id="tab:2"] { top: 178px !important; }
#ckScriptMenu div[id="tab:3"] { top: 238px !important; }
#ckScriptMenu div[id="tab:4"] { top: 298px !important; }
#ckScriptMenu div[id="tab:5"] { top: 358px !important; }
#ckScriptMenu div[id="tab:6"] { top: 418px !important; }
#ckScriptMenu div[id="tab:7"] { top: 478px !important; }
#ckScriptMenu div[id="tab:8"] { top: 538px !important; }
#ckScriptMenu div[id="tab:9"] { top: 598px !important; }
#ckScriptMenu div[id="tab:10"] { top: 658px !important; }
#ckScriptMenu div[id="tab:11"] { top: 718px !important; }
#ckScriptMenu div[id="tab:12"] { top: 778px !important; }
#ckScriptMenu div[id="tab:13"] { top: 838px !important; }
#ckScriptMenu div[id="tab:14"] { top: 898px !important; }
#ckScriptMenu div[id="tab:15"] { top: 958px !important; }
#ckScriptMenu div[id^="tab:"]:hover {
  opacity: 1;
  background: rgba(255, 255, 255, .04) !important;
  border-left-color: rgba(122, 66, 244, .5) !important;
}
#ckScriptMenu div[id^="tab:"]:active { transform: scale(.96); opacity: .75; }
/* the client marks the open tab by killing its pointer events */
#ckScriptMenu div[id^="tab:"][style*="pointer-events: none"] {
  opacity: 1;
  background: rgba(122, 66, 244, .12) !important;
  border-left-color: var(--ryn-accent) !important;
}
#ckScriptMenu div[id^="tab:"][style*="pointer-events: none"] img {
  filter: drop-shadow(0 0 5px rgba(122, 66, 244, .9));
}
#ckScriptMenu div[id^="tab:"] img { margin-left: 0 !important; }
#ckScriptMenu div[id^="tab:"] > div {
  font-family: "Poppins", sans-serif !important;
  font-size: 13px; font-weight: 700; letter-spacing: .04em;
  text-transform: uppercase; margin-left: 0 !important;
}

/* --- the page --- */
#ckScriptMenu > div[style*="left: 212.5px"] {
  left: 172px !important;
  width: calc(100% - 172px) !important;
  padding: 14px 18px !important;
  box-sizing: border-box !important;
  overflow-y: auto !important;
  scrollbar-width: thin;
  scrollbar-color: rgba(122, 66, 244, .25) transparent;
}
#ckScriptMenu > div[style*="left: 212.5px"]::-webkit-scrollbar { width: 2px; }
#ckScriptMenu > div[style*="left: 212.5px"]::-webkit-scrollbar-track { background: transparent; }
#ckScriptMenu > div[style*="left: 212.5px"]::-webkit-scrollbar-thumb {
  background: rgba(122, 66, 244, .25); border-radius: 2px;
}
#ckScriptMenu > div[style*="left: 212.5px"]:hover::-webkit-scrollbar-thumb {
  background: rgba(122, 66, 244, .45);
}

/* --- rows: flat, hairline-separated, no cards --- */
#ckScriptMenu div[style*="height: 40px"] {
  min-height: 42px !important;
  margin: 0 !important;
  width: 100% !important;
  padding: 6px 12px !important;
  border-radius: 0 !important;
  background: transparent !important;
  border-bottom: 1px solid rgba(255, 255, 255, .03) !important;
  box-sizing: border-box;
  transition: background 150ms !important;
}
#ckScriptMenu div[style*="height: 40px"]:hover { background: rgba(122, 66, 244, .04) !important; }
#ckScriptMenu div[style*="height: 40px"] > div:first-child {
  font-size: 15px; font-weight: 500;
  color: rgba(215, 215, 230, .8);
  transition: color 150ms;
}
#ckScriptMenu div[style*="height: 40px"]:hover > div:first-child { color: #fff; }

/* --- grouped settings become RYN's bordered section --- */
#ckScriptMenu div[style*="padding-top: 25px"] {
  margin: 0 0 10px 0 !important;
  width: 100% !important;
  background: transparent !important;
  border: 1px solid rgba(255, 255, 255, .07) !important;
  border-radius: 7px !important;
  transition: border-color 200ms !important;
}
#ckScriptMenu div[style*="padding-top: 25px"]:hover {
  border-color: rgba(122, 66, 244, .22) !important;
}

/* --- the switch --- */
#ckScriptMenu div[id^="toggle:id:"] {
  border-radius: 10px !important;
  background: rgba(255, 255, 255, .05) !important;
  border: 1px solid rgba(255, 255, 255, .1);
  box-sizing: border-box;
  transition: all 220ms !important;
}
#ckScriptMenu div[id^="toggle:id:"] > div {
  background: rgba(255, 255, 255, .25) !important;
  width: 20px !important; height: 20px !important;
  transition: transform 220ms cubic-bezier(.34, 1.4, .64, 1), background 220ms !important;
}
#ckScriptMenu div[id^="toggle:id:"][style*="background-color: rgb(33, 150, 243)"] {
  background: rgba(122, 66, 244, .18) !important;
  border-color: rgba(122, 66, 244, .55);
}
#ckScriptMenu div[id^="toggle:id:"][style*="background-color: rgb(33, 150, 243)"] > div {
  background: var(--ryn-accent) !important;
  box-shadow: 0 0 7px rgba(122, 66, 244, .7);
}

/* --- buttons, inputs, key binds --- */
#ckScriptMenu button {
  padding: 5px 16px !important;
  background: rgba(122, 66, 244, .1) !important;
  border: 1px solid rgba(122, 66, 244, .35) !important;
  border-radius: 5px !important;
  font-family: "Poppins", sans-serif !important;
  font-size: 11px !important; font-weight: 600; letter-spacing: .06em;
  color: #fff !important; text-transform: uppercase;
  cursor: pointer;
  transition: all 140ms !important;
}
#ckScriptMenu button:hover {
  background: rgba(122, 66, 244, .22) !important;
  border-color: rgba(122, 66, 244, .6) !important;
}
#ckScriptMenu button:active { transform: scale(.97); }
#ckScriptMenu input, #ckScriptMenu select {
  background: rgba(255, 255, 255, .04) !important;
  border: 1px solid rgba(255, 255, 255, .1) !important;
  border-radius: 4px !important;
  color: rgba(200, 175, 255, .9) !important;
  font-family: "Poppins", sans-serif !important;
  font-size: 12px !important;
  outline: none;
  transition: all 140ms !important;
}
#ckScriptMenu select option { color: #14141c; background: #e9e9f2; }
#ckScriptMenu input:hover, #ckScriptMenu select:hover {
  background: rgba(122, 66, 244, .12) !important;
  border-color: rgba(122, 66, 244, .5) !important;
}
#ckScriptMenu input:focus, #ckScriptMenu select:focus {
  border-color: var(--ryn-accent) !important;
  box-shadow: 0 0 0 2px rgba(122, 66, 244, .2);
}
#ckScriptMenu input[type="range"] { accent-color: var(--ryn-accent); }

/* the value tags the client builds for list settings */
#ckScriptMenu div[style*="border-radius: 6px; margin: 3px"] {
  background: rgba(122, 66, 244, .12) !important;
  border: 1px solid rgba(122, 66, 244, .35);
  border-radius: 5px !important;
  font-family: "Poppins", sans-serif !important;
  transition: all 140ms;
}
#ckScriptMenu div[style*="border-radius: 6px; margin: 3px"]:hover {
  background: rgba(122, 66, 244, .24) !important;
}

/* pages slide in from the top when a tab opens, as RYN's do */
#ckScriptMenu > div[style*="left: 212.5px"] > * { animation: ryn-slide-in 140ms ease-out both; }
@keyframes ryn-slide-in {
  from { opacity: 0; transform: translateY(-5px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ---------- someone may be on reduce-motion -------------------------- */
@media (prefers-reduced-motion: reduce) {
  .ck-sky-box *, .ck-sky-box::after, #ckMenu,
  #ckScriptMenu, #ckScriptMenu *,
  #ckScriptMenu > div[style*="left: 212.5px"] > * { animation: none !important; transition: none !important; }
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

    // Drops the stylesheet in and puts the sky behind everything already in the
    // main menu. Safe to call more than once.
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

    // The mod menu is styled after the RYN Client instead: flat dark glass, no
    // starfield behind it. All it needs from here is the id the rules hang off.
    function dressMenu(menu) {
        styles();
        if (menu) menu.id = "ckScriptMenu";
    }

    return { css: CSS, sky: SKY, install: install, dressMenu: dressMenu };
})();
