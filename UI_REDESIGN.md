# RYN Type 2 — UI redesign

A full visual rebuild of every RYN Type 2 menu and overlay. Presentation only:
no gameplay module was touched.

```
src/Ryn_Type_2_v5.4.js   the v5.4 script as shipped (build input)
ui/menu.css              the design system — every menu control lives here
ui/header.html           title bar: brand, version, search, close
ui/navbar.html           the tab strip
ui/formation.css         formation picker (dropdown + draggable popup)
ui/game.css              in-game layer: action bar, vitals HUD, session stats
ui/store.css             in-game hat / accessory picker
ui/lobby.css             moomoo setup card, skin swatches, corner badge
tools/build-ui.js        applies all of the above -> Ryn_Type_2.user.js
tools/verify-ui.js       proves nothing the client's JS binds to was lost
tools/preview-ui.js      extracts the menu into a standalone HTML page
tools/preview-game.js    same, for the in-game layer
tools/shoot-ui.js        screenshots every tab + drives the controls
```

## Build

```sh
node tools/build-ui.js      # -> Ryn_Type_2.user.js
node --check Ryn_Type_2.user.js
node tools/verify-ui.js     # needs: npm i --no-save playwright-core
node tools/shoot-ui.js /tmp/ryn-shots
```

Every edit in `build-ui.js` is anchored to an exact string in the base script,
and an anchor that is missing or ambiguous fails the build — dropping in a newer
RYN surfaces as a build error rather than a half-applied redesign.

## The design system

Three colours, each with one job.

| | role |
|---|---|
| **Black** `#08080B` → `#141419` | window, sections, control surfaces |
| **Red** `#E5384A` | a feature is *on*; destructive actions; conflicts; recording a keybind |
| **Purple** `#8B5CF6` | selection: active tab, section markers, sliders, focus, search |

Everything else is a hairline (`rgba(255,255,255,.07)`) or one of four text
tints. Accents are used at 12–42 % alpha except where they mark state, so the
panel reads as black with thin coloured signal rather than a coloured panel.

Type is Inter (400/500/600) with a full system fallback, at four sizes: page
title 17, section title 14 semibold, option 14 regular, meta 12–13. Sentence
case throughout; no shouting caps, no gradient text. The font is fetched with a
`<link>` — parallel and non-blocking — not a render-blocking `@import`, and the
menu is fully readable on the fallback if the request never lands.

Shape: 14 px window, 9 px sections, 6 px controls, 4 px chips. One soft shadow
on the window, none anywhere else.

## What changed structurally

The menu was a 1178 × 648 dashboard with a 172 px icon rail down the left side
and two `backdrop-filter: blur(25px)` surfaces. It is now a **940 × 650 window**
with a title bar, a horizontal tab strip and a single scrolling body, and no
blur.

`handleResize()` capped the panel scale at `0.9`, so the menu was *always*
downscaled: every glyph rasterised at a fractional size — visibly soft — and
every authored px arrived ~11 % smaller than designed. The cap is now `1`, so
the panel renders 1:1 at 940 × 650 on anything from 1280 × 720 up and only
shrinks when the viewport genuinely cannot fit it. That also lines the
formation popup up with its trigger: the popup is fixed to the unscaled
viewport while its position came from a rect measured inside the scaled
container, so the two only agreed at scale 1.

Rebuilt from scratch: panels, tabs, buttons, toggles, sliders, colour pickers,
key tiles, text inputs, dropdowns, section headers, status dots, the search
dropdown, the bot list, the weapon and formation pickers, the lobby card, the
vitals HUD, the session-stat readout and the hat picker.

The music page keeps its own layout (it is a player, not a settings list) but
its palette, radii, section headers and volume slider were re-pointed at the
design system, and its private stylesheet no longer defines anything the system
already owns.

## Performance

The rules the redesign holds to, asserted by `tools/verify-ui.js`:

- **One web font, non-blocking.** Four families across three render-blocking
  `@import`s (Inter, Poppins, Orbitron, Exo 2) became a single `<link>` for
  Inter at three weights, behind a `preconnect`, with a full system fallback.
- **No `backdrop-filter`.** Three blurred surfaces (menu window, tab rail,
  lobby card) replaced with opaque panels. This was the single largest
  per-frame compositing cost while the game rendered behind the menu.
- **No idle animation.** The always-on `shimmer` gradient is gone.
  `document.getAnimations()` returns nothing running once a tab settles.
- **Animation is `transform`/`opacity` only** — the toggle knob, page fade,
  window open/close, ripple and HUD bars all avoid layout.
- **Event-driven HUD.** The vitals HUD wrote `style.width` and a
  `background` gradient string 20×/sec unconditionally; it now runs at 10 Hz,
  compares against the last value and writes only on change, using
  `transform: scaleX()` and a class for the HP tier.
- **Fewer timers.** The dead `#ryn-main-logo` (permanently
  `display:none !important`) and its 500 ms visibility poll are gone. The
  search-attach and page-attach polls stop once they have wired the frame up,
  and are re-armed if the frame is rebuilt.
- **Bounded observers.** The lobby-card `MutationObserver` disconnects after
  the card is injected. The branding observer coalesces to one check per
  animation frame instead of one per mutation batch.
- **Cheaper search.** The option index was rebuilt on every keystroke
  (~150 `querySelector` traversals); it is now built once and reused.
- **No listener leak.** "Reset settings" rebuilds the iframe and re-runs
  `init()`; window-level listeners are now bound once instead of stacking a new
  `resize` handler on every reset.
- **Class toggles, not inline style rewrites.** Weapon, farm-mode, farm-type
  and age-4 pickers each rewrote three inline properties per button per click;
  they toggle one class now.

## Functionality

`tools/verify-ui.js` builds a DOM from the base script and from the build and
compares them. It asserts that every element id, toggle, slider, colour picker,
text input, hotkey button, option button, tab, page, option label and section
title still exists, that the wiring contracts the client's `attach*` methods
rely on still hold (`.slider-value` before each range, `.reset-color` before
each colour input, `.hotkeyInput` is a `<button>`, every checkbox has its track
`<span>`, every `label[for]` resolves), and that the script region between
`DataHandler` and the `UI` class is byte-identical to the base.

Two dead things were made live rather than left broken, both presentation-only:

- `--val`, which the stylesheet read to fill a slider track, was never written,
  so every range painted at a flat 50 %. It is set where the value changes.
- `#script-description`, which `attachListeners` fills with `RYN v<version>`,
  had no element to write into. The title bar now has one.
