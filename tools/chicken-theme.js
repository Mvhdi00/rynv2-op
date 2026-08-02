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
#ck-sky .ck-stars { position: absolute; left: 0; top: 0; border-radius: 50%; }
#ck-sky .ck-stars::after {
  content: ""; position: absolute; left: 0; top: 1200px;
  width: inherit; height: inherit; border-radius: 50%; box-shadow: inherit;
}
#ck-sky .ck-s1 {
  width: 1px; height: 1px; box-shadow: ${starfield(260, 2200, 1200, 7)};
  animation: ck-drift 190s linear infinite;
}
#ck-sky .ck-s2 {
  width: 2px; height: 2px; box-shadow: ${starfield(110, 2200, 1200, 99)};
  animation: ck-drift 120s linear infinite; opacity: .85;
}
#ck-sky .ck-s3 {
  width: 3px; height: 3px; box-shadow: ${starfield(40, 2200, 1200, 4242)};
  animation: ck-drift 75s linear infinite; opacity: .7;
  filter: drop-shadow(0 0 4px rgba(180, 210, 255, .9));
}
@keyframes ck-drift { from { transform: translateY(0); } to { transform: translateY(-1200px); } }

/* a slow twinkle over the whole field, so it never looks static */
#ck-sky::after {
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,.7), transparent 60%),
              radial-gradient(2px 2px at 72% 66%, rgba(190,220,255,.6), transparent 60%),
              radial-gradient(1.5px 1.5px at 45% 82%, rgba(255,255,255,.5), transparent 60%),
              radial-gradient(2px 2px at 86% 24%, rgba(210,230,255,.55), transparent 60%);
  animation: ck-twinkle 4.2s ease-in-out infinite alternate;
}
@keyframes ck-twinkle { from { opacity: .25; } to { opacity: .9; } }

/* ---------- shooting stars ------------------------------------------ */
#ck-sky .ck-shoot {
  position: absolute; width: 2px; height: 2px; border-radius: 50%;
  background: #fff; box-shadow: 0 0 8px 2px rgba(190, 220, 255, .9); opacity: 0;
}
#ck-sky .ck-shoot::before {                 /* the tail */
  content: ""; position: absolute; top: 50%; right: 2px;
  width: 190px; height: 1px; transform: translateY(-50%);
  background: linear-gradient(270deg, rgba(255,255,255,.95), rgba(140,190,255,.35), transparent);
}
#ck-sky .ck-shoot.a { top:  9%; left: 104%; animation: ck-shoot  7s ease-in infinite; animation-delay: 1.5s; }
#ck-sky .ck-shoot.b { top: 31%; left: 104%; animation: ck-shoot  9s ease-in infinite; animation-delay: 5s;   }
#ck-sky .ck-shoot.c { top: 58%; left: 104%; animation: ck-shoot 11s ease-in infinite; animation-delay: 8.5s; }
#ck-sky .ck-shoot.d { top: 76%; left: 104%; animation: ck-shoot 13s ease-in infinite; animation-delay: 12s;  }
@keyframes ck-shoot {
  0%        { opacity: 0; transform: translate(0, 0) rotate(14deg); }
  3%        { opacity: 1; }
  20%       { opacity: 1; }
  28%, 100% { opacity: 0; transform: translate(-130vw, 44vh) rotate(14deg); }
}

/* a planet, low and dim, so the corner is not empty */
#ck-sky .ck-planet {
  position: absolute; right: -60px; bottom: -90px; width: 260px; height: 260px;
  border-radius: 50%; opacity: .5;
  background:
    radial-gradient(circle at 32% 30%, #6f7cff 0%, #4534a8 45%, #1b1140 78%, #0a0720 100%);
  box-shadow: 0 0 70px rgba(110, 100, 255, .35), inset -18px -22px 60px rgba(0, 0, 0, .6);
  animation: ck-float 16s ease-in-out infinite alternate;
}
#ck-sky .ck-planet::after {                 /* its ring */
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
  #ck-sky *, #ck-sky::after, #ckMenu { animation: none !important; }
}
`;

    const SKY = '<div class="ck-stars ck-s1"></div>'
        + '<div class="ck-stars ck-s2"></div>'
        + '<div class="ck-stars ck-s3"></div>'
        + '<div class="ck-shoot a"></div><div class="ck-shoot b"></div>'
        + '<div class="ck-shoot c"></div><div class="ck-shoot d"></div>'
        + '<div class="ck-planet"></div>';

    // Drops the stylesheet in and puts the sky behind everything already in the
    // menu. Safe to call more than once.
    function install(mainMenu) {
        if (!document.getElementById("ck-cosmos-css")) {
            const style = document.createElement("style");
            style.id = "ck-cosmos-css";
            style.textContent = CSS;
            (document.head || document.documentElement).appendChild(style);
        }
        if (mainMenu && !document.getElementById("ck-sky")) {
            const sky = document.createElement("div");
            sky.id = "ck-sky";
            sky.innerHTML = SKY;
            mainMenu.insertBefore(sky, mainMenu.firstChild);
        }
    }

    return { css: CSS, sky: SKY, install: install };
})();
