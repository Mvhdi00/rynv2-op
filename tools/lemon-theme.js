
/* ===========================================================================
 * Cosmos — a space theme for the LemonMod menu.
 *
 * Purely additive: it restyles the menu the mod already builds and never
 * renames an id or a class, so every checkbox, select and tab keeps working
 * exactly as before. It also replaces the menu's remote lemon image, which
 * pointed at a host this script no longer talks to.
 *
 * Everything is scoped under #mm-menu-container so nothing leaks into the
 * game's own UI.
 *
 * Star layers are generated rather than hand-written: three parallax fields of
 * box-shadow dots drifting at different speeds, plus a few shooting stars on
 * staggered delays. No canvas, no images, no timers -- it is all CSS, so it
 * costs nothing while the menu is closed.
 * ======================================================================== */
window.LEMON_COSMOS = (function () {
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
/* ---------- shell ---------------------------------------------------- */
#mm-menu-container.i-container {
  position: fixed;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  width: min(880px, 94vw);
  height: min(600px, 88vh);
  z-index: 2000000;
  border-radius: 18px;
  overflow: hidden;
  isolation: isolate;
  color: #dbe4ff;
  font-family: "Hammersmith One", "Segoe UI", system-ui, sans-serif;
  background:
    radial-gradient(120% 90% at 12% 0%,   rgba(124, 92, 255, .28) 0%, transparent 55%),
    radial-gradient(100% 80% at 88% 12%,  rgba(77, 216, 255, .20) 0%, transparent 50%),
    radial-gradient(90%  90% at 50% 110%, rgba(255, 92, 190, .16) 0%, transparent 60%),
    linear-gradient(160deg, #070818 0%, #0a0d24 45%, #100a26 100%);
  border: 1px solid rgba(150, 170, 255, .18);
  box-shadow:
    0 30px 90px rgba(0, 0, 0, .65),
    0 0 0 1px rgba(255, 255, 255, .03) inset,
    0 0 120px rgba(124, 92, 255, .12) inset;
  animation: lc-in .32s cubic-bezier(.2, .9, .25, 1.05) both;
}
@keyframes lc-in {
  from { opacity: 0; transform: translate(-50%, -46%) scale(.97); }
  to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

/* ---------- starfield ------------------------------------------------ */
#mm-menu-container .lc-sky {
  position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
}
#mm-menu-container .lc-stars { position: absolute; left: 0; top: 0; border-radius: 50%; }
#mm-menu-container .lc-stars::after {
  content: ""; position: absolute; left: 0; top: 700px;
  width: inherit; height: inherit; border-radius: 50%; box-shadow: inherit;
}
#mm-menu-container .lc-s1 {
  width: 1px; height: 1px; box-shadow: ${starfield(160, 900, 700, 7)};
  animation: lc-drift 150s linear infinite;
}
#mm-menu-container .lc-s2 {
  width: 2px; height: 2px; box-shadow: ${starfield(70, 900, 700, 99)};
  animation: lc-drift 95s linear infinite; opacity: .85;
}
#mm-menu-container .lc-s3 {
  width: 3px; height: 3px; box-shadow: ${starfield(26, 900, 700, 4242)};
  animation: lc-drift 60s linear infinite; opacity: .7;
  filter: drop-shadow(0 0 4px rgba(180, 210, 255, .9));
}
@keyframes lc-drift { from { transform: translateY(0); } to { transform: translateY(-700px); } }

/* a slow twinkle over the whole field, so it never looks static */
#mm-menu-container .lc-sky::after {
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,.7), transparent 60%),
              radial-gradient(2px 2px at 72% 66%, rgba(190,220,255,.6), transparent 60%),
              radial-gradient(1.5px 1.5px at 45% 82%, rgba(255,255,255,.5), transparent 60%);
  animation: lc-twinkle 4.2s ease-in-out infinite alternate;
}
@keyframes lc-twinkle { from { opacity: .25; } to { opacity: .9; } }

/* ---------- shooting stars ------------------------------------------ */
#mm-menu-container .lc-shoot {
  position: absolute; width: 2px; height: 2px; border-radius: 50%;
  background: #fff; box-shadow: 0 0 8px 2px rgba(190, 220, 255, .9);
  opacity: 0;
}
/* the tail */
#mm-menu-container .lc-shoot::before {
  content: ""; position: absolute; top: 50%; right: 2px;
  width: 160px; height: 1px; transform: translateY(-50%);
  background: linear-gradient(270deg, rgba(255,255,255,.95), rgba(140,190,255,.35), transparent);
}
#mm-menu-container .lc-shoot.a { top: 12%;  left: 105%; animation: lc-shoot 7s ease-in    infinite; animation-delay: 1.5s; }
#mm-menu-container .lc-shoot.b { top: 38%;  left: 105%; animation: lc-shoot 9s ease-in    infinite; animation-delay: 5s;   }
#mm-menu-container .lc-shoot.c { top: 68%;  left: 105%; animation: lc-shoot 11s ease-in   infinite; animation-delay: 8.5s; }
@keyframes lc-shoot {
  0%        { opacity: 0; transform: translate(0, 0) rotate(14deg); }
  4%        { opacity: 1; }
  22%       { opacity: 1; }
  30%, 100% { opacity: 0; transform: translate(-125vw, 42vh) rotate(14deg); }
}

/* ---------- the old lemon orb, reused as a planet -------------------- */
/* Tucked into the bottom-right corner and dimmed. An earlier pass had it
   centred and 340px across, which put a bright disc directly behind the
   controls and dropped a ring straight through the labels -- decoration has
   to lose to legibility. */
#mm-menu-container .circle {
  position: absolute !important;
  top: auto !important; left: auto !important;
  right: -54px; bottom: -62px;
  width: 208px !important; height: 208px !important;
  opacity: .5 !important;
  pointer-events: none; z-index: 0;
  border-radius: 50%;
  background:
    radial-gradient(circle at 34% 30%, #9b7bff 0%, #5b3fd6 40%, #2a1c6b 74%, #150e3a 100%);
  box-shadow:
    0 0 70px rgba(124, 92, 255, .28),
    inset -16px -18px 44px rgba(0, 0, 0, .6),
    inset 12px 10px 30px rgba(180, 160, 255, .16);
  animation: lc-float 14s ease-in-out infinite alternate;
}
#mm-menu-container .circle img { display: none !important; }
#mm-menu-container .circle::after {
  content: ""; position: absolute; left: 50%; top: 50%;
  width: 156%; height: 34%;
  transform: translate(-50%, -50%) rotate(-20deg);
  border-radius: 50%;
  border: 1.5px solid rgba(160, 200, 255, .16);
  border-top-color: rgba(200, 225, 255, .34);
}
@keyframes lc-float {
  from { transform: translateY(4px); }
  to   { transform: translateY(-10px); }
}

/* ---------- layout --------------------------------------------------- */
#mm-menu-container .i-tab-container {
  position: relative; z-index: 2;
  display: flex; height: 100%; gap: 0;
}
#mm-menu-container .i-tab-menu.sidebar {
  flex: 0 0 196px;
  display: flex; flex-direction: column; gap: 6px;
  padding: 18px 14px;
  background: linear-gradient(180deg, rgba(10, 12, 32, .72), rgba(10, 12, 32, .45));
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border-right: 1px solid rgba(150, 170, 255, .14);
  overflow-y: auto;
}
#mm-menu-container .i-tab-menu.sidebar a { text-decoration: none; }

/* the title */
#mm-menu-container h2.i-tab-menu-item {
  margin: 2px 0 14px; padding: 0;
  font-size: 19px; letter-spacing: .5px; text-align: center;
  background: linear-gradient(92deg, #b9a6ff, #6fe3ff 55%, #ff9ede);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
  cursor: default; border: 0; background-color: transparent;
  filter: drop-shadow(0 0 14px rgba(124, 92, 255, .45));
}

/* ---------- sidebar buttons ------------------------------------------ */
#mm-menu-container button.i-tab-menu-item {
  position: relative;
  display: block; width: 100%;
  padding: 10px 14px 10px 16px;
  font: inherit; font-size: 14.5px; letter-spacing: .3px; text-align: left;
  color: #b9c4ee;
  background: rgba(255, 255, 255, .035);
  border: 1px solid rgba(150, 170, 255, .10);
  border-radius: 11px;
  cursor: pointer;
  overflow: hidden;
  transition: color .18s ease, background .18s ease, border-color .18s ease,
              transform .18s cubic-bezier(.2,.9,.25,1.05), box-shadow .18s ease;
}
/* the sheen that sweeps across on hover */
#mm-menu-container button.i-tab-menu-item::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,.16) 48%, transparent 62%);
  transform: translateX(-120%);
  transition: transform .55s ease;
}
#mm-menu-container button.i-tab-menu-item:hover {
  color: #eaf0ff;
  background: rgba(124, 92, 255, .14);
  border-color: rgba(150, 170, 255, .3);
  transform: translateX(3px);
  box-shadow: 0 6px 20px rgba(88, 60, 200, .22);
}
#mm-menu-container button.i-tab-menu-item:hover::after { transform: translateX(120%); }
#mm-menu-container button.i-tab-menu-item:active { transform: translateX(3px) scale(.985); }

/* active tab -- the mod toggles .is-active */
#mm-menu-container button.i-tab-menu-item.is-active {
  color: #fff;
  background: linear-gradient(96deg, rgba(124, 92, 255, .42), rgba(77, 216, 255, .20));
  border-color: rgba(160, 190, 255, .42);
  box-shadow: 0 8px 26px rgba(96, 70, 220, .32),
              0 0 0 1px rgba(255, 255, 255, .06) inset;
}
#mm-menu-container button.i-tab-menu-item.is-active::before {
  content: ""; position: absolute; left: 0; top: 12%;
  width: 3px; height: 76%; border-radius: 0 3px 3px 0;
  background: linear-gradient(180deg, #9d7bff, #55e0ff);
  box-shadow: 0 0 12px rgba(120, 180, 255, .9);
}

/* ---------- content pane --------------------------------------------- */
#mm-menu-container .i-tab-content {
  position: relative; z-index: 1;
  flex: 1 1 auto;
  padding: 20px 24px 26px;
  overflow-y: auto;
  animation: lc-fade .26s ease both;
  /* a faint scrim: the starfield stays visible, the text stays readable */
  background: linear-gradient(180deg, rgba(6, 8, 22, .55), rgba(6, 8, 22, .38));
}
@keyframes lc-fade {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
#mm-menu-container .i-tab-content h3 {
  margin: 0 0 16px;
  font-size: 22px; letter-spacing: .4px; color: #fff;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(150, 170, 255, .16);
  text-shadow: 0 0 22px rgba(124, 92, 255, .5);
}

/* scrollbars */
#mm-menu-container ::-webkit-scrollbar { width: 9px; }
#mm-menu-container ::-webkit-scrollbar-track { background: rgba(255,255,255,.03); border-radius: 9px; }
#mm-menu-container ::-webkit-scrollbar-thumb {
  border-radius: 9px;
  background: linear-gradient(180deg, rgba(124,92,255,.65), rgba(77,216,255,.5));
  border: 2px solid transparent; background-clip: padding-box;
}
#mm-menu-container ::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #7c5cff, #4dd8ff); }

/* ---------- grouped sections ----------------------------------------- */
#mm-menu-container fieldset {
  margin: 0 0 16px; padding: 14px 16px 12px;
  border: 1px solid rgba(150, 170, 255, .16);
  border-radius: 13px;
  background: rgba(255, 255, 255, .028);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: border-color .2s ease, background .2s ease;
}
#mm-menu-container fieldset:hover {
  border-color: rgba(150, 170, 255, .3);
  background: rgba(255, 255, 255, .045);
}
#mm-menu-container legend {
  padding: 2px 10px; font-size: 13px; letter-spacing: .6px; text-transform: uppercase;
  color: #a9b6ee;
  background: rgba(124, 92, 255, .16);
  border: 1px solid rgba(150, 170, 255, .22);
  border-radius: 999px;
}

/* rows */
#mm-menu-container .i-tab-content > div,
#mm-menu-container fieldset > div { margin: 7px 0; }
#mm-menu-container label {
  display: inline-flex; align-items: center; gap: 9px;
  font-size: 14.5px; color: #c8d2f5; cursor: pointer;
  transition: color .15s ease;
}
#mm-menu-container label:hover { color: #fff; }
#mm-menu-container form {
  display: flex; align-items: center; gap: 10px;
  margin: 8px 0; flex-wrap: wrap;
}
#mm-menu-container form label { color: #97a3d0; font-size: 13.5px; min-width: 118px; }

/* ---------- checkboxes ------------------------------------------------ */
#mm-menu-container input.i-checkbox,
#mm-menu-container input[type="checkbox"] {
  appearance: none; -webkit-appearance: none;
  flex: 0 0 auto;
  width: 19px; height: 19px; margin: 0;
  border-radius: 6px;
  border: 1.5px solid rgba(150, 170, 255, .38);
  background: rgba(255, 255, 255, .05);
  cursor: pointer; position: relative;
  transition: background .18s ease, border-color .18s ease, box-shadow .18s ease, transform .12s ease;
}
#mm-menu-container input[type="checkbox"]:hover {
  border-color: rgba(140, 200, 255, .75);
  box-shadow: 0 0 0 4px rgba(124, 92, 255, .12);
}
#mm-menu-container input[type="checkbox"]:active { transform: scale(.92); }
#mm-menu-container input[type="checkbox"]:checked {
  background: linear-gradient(135deg, #7c5cff, #4dd8ff);
  border-color: transparent;
  box-shadow: 0 0 14px rgba(110, 140, 255, .6);
}
#mm-menu-container input[type="checkbox"]:checked::after {
  content: ""; position: absolute;
  left: 6px; top: 2.5px; width: 5px; height: 10px;
  border: solid #08091a; border-width: 0 2.2px 2.2px 0;
  transform: rotate(43deg);
}

/* ---------- selects & text inputs ------------------------------------ */
#mm-menu-container select,
#mm-menu-container input[type="text"],
#mm-menu-container input[type="number"] {
  appearance: none; -webkit-appearance: none;
  padding: 7px 30px 7px 12px;
  font: inherit; font-size: 13.5px;
  color: #e6ecff;
  background-color: rgba(16, 20, 46, .9);
  background-image: linear-gradient(45deg, transparent 50%, #8ea3e6 50%),
                    linear-gradient(135deg, #8ea3e6 50%, transparent 50%);
  background-position: right 13px center, right 8px center;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  border: 1px solid rgba(150, 170, 255, .22);
  border-radius: 9px;
  cursor: pointer;
  transition: border-color .18s ease, box-shadow .18s ease, background-color .18s ease;
}
#mm-menu-container input[type="text"],
#mm-menu-container input[type="number"] { background-image: none; padding-right: 12px; cursor: text; }
#mm-menu-container select:hover { border-color: rgba(150, 190, 255, .45); }
#mm-menu-container select:focus,
#mm-menu-container input[type="text"]:focus,
#mm-menu-container input[type="number"]:focus {
  outline: none;
  border-color: #4dd8ff;
  box-shadow: 0 0 0 3px rgba(77, 216, 255, .16);
  background-color: rgba(20, 26, 58, .96);
}
#mm-menu-container option { background: #10142e; color: #e6ecff; }

/* ---------- sliders --------------------------------------------------- */
#mm-menu-container input[type="range"] {
  appearance: none; -webkit-appearance: none;
  height: 5px; border-radius: 999px; outline: none;
  background: linear-gradient(90deg, #7c5cff, #4dd8ff);
  cursor: pointer;
}
#mm-menu-container input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 15px; height: 15px; border-radius: 50%;
  background: #fff; border: 0;
  box-shadow: 0 0 10px rgba(120, 180, 255, .9);
  transition: transform .12s ease;
}
#mm-menu-container input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.18); }

/* ---------- footer ---------------------------------------------------- */
#mm-menu-container .i-palomita {
  margin-top: 18px; padding-top: 12px;
  font-size: 12px; letter-spacing: .5px; text-align: center;
  color: #7f8bbd;
  border-top: 1px solid rgba(150, 170, 255, .12);
}

/* the toggle button the mod puts on the page */
#modSettingsButton {
  transition: transform .16s cubic-bezier(.2,.9,.25,1.05), filter .16s ease;
}
#modSettingsButton:hover { transform: translateY(-2px) scale(1.04); filter: brightness(1.15); }

/* respect a reduced-motion preference: keep the look, drop the movement */
@media (prefers-reduced-motion: reduce) {
  #mm-menu-container *,
  #mm-menu-container *::before,
  #mm-menu-container *::after { animation: none !important; }
}
`;

    let installed = false;

    function install() {
        if (installed) return;
        const host = document.getElementById("mm-menu-container");
        if (!host) return;
        installed = true;

        const style = document.createElement("style");
        style.id = "lemon-cosmos-theme";
        style.type = "text/css";
        style.textContent = CSS;
        document.head.appendChild(style);

        // star layers + shooting stars, injected ahead of the mod's own markup
        const sky = document.createElement("div");
        sky.className = "lc-sky";
        sky.innerHTML =
            '<div class="lc-stars lc-s1"></div>' +
            '<div class="lc-stars lc-s2"></div>' +
            '<div class="lc-stars lc-s3"></div>' +
            '<div class="lc-shoot a"></div>' +
            '<div class="lc-shoot b"></div>' +
            '<div class="lc-shoot c"></div>';
        host.insertBefore(sky, host.firstChild);

        console.info("%c[cosmos]%c LemonMod menu theme applied.",
            "color:#9d7bff;font-weight:bold", "color:inherit");
    }

    // The menu is built during the mod's GUI init; wait for it to exist.
    function watch() {
        if (document.getElementById("mm-menu-container")) return install();
        const obs = new MutationObserver(function () {
            if (document.getElementById("mm-menu-container")) {
                obs.disconnect();
                install();
            }
        });
        const start = function () {
            obs.observe(document.documentElement || document, { childList: true, subtree: true });
        };
        if (document.documentElement) start();
        else document.addEventListener("DOMContentLoaded", start, { once: true });
    }
    watch();

    return { install: install, css: CSS };
}
)();
