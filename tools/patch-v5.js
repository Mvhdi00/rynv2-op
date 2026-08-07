#!/usr/bin/env node
/*
 * patch-v5.js
 *
 * Folds the angle engine into both RYN v5 builds:
 *
 *   v5-src/RYN_Client_v5_OWNER.orig.js  -> RYN_Client_v5_OWNER.user.js
 *   v5-src/RYN_Client_v5_PLAYER.orig.js -> RYN_Client_v5_PLAYER.user.js
 *
 * The OWNER build is plain and gets ordinary anchored edits. The PLAYER
 * build is obfuscated, so it is patched through the readable view that
 * tools/decode-v5-player.js produces: an anchor is found in the decoded
 * text, mapped back to the byte range it came from, and spliced into the
 * shipped file. Everything around the patch stays obfuscated.
 *
 * Every anchor must match exactly once or the build fails, so a newer RYN
 * surfaces as an error rather than a half-patched script.
 *
 *   node tools/patch-v5.js
 */

const fs = require("fs");
const path = require("path");

const { decode } = require("./decode-v5-player.js");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "v5-src");
const ENGINE = fs.readFileSync(path.join(SRC, "reup-aim.js"), "utf8");

/* ------------------------------------------------------------------ *
 * Plain-text patching, for the OWNER build
 * ------------------------------------------------------------------ */

class PlainFile {
  constructor(source, name) {
    this.text = source;
    this.name = name;
    this.applied = [];
  }

  edit(label, find, replace) {
    const parts = this.text.split(find);
    if (parts.length === 1) throw new Error(`${this.name}: anchor not found: ${label}`);
    if (parts.length > 2) throw new Error(`${this.name}: anchor ambiguous (${parts.length - 1} hits): ${label}`);
    this.text = parts[0] + replace + parts[1];
    this.applied.push(label);
  }

  /* Read a JS string literal assigned to `const NAME = "...";`, run it
   * through a transform, and write it back. */
  editStringConst(label, constName, transform) {
    const declaration = `const ${constName} = `;
    const start = this.text.indexOf(declaration);
    if (start === -1) throw new Error(`${this.name}: string const not found: ${constName}`);
    const lineEnd = this.text.indexOf("\n", start);
    const literal = this.text.slice(start + declaration.length, lineEnd).replace(/;\s*$/, "");
    // eslint-disable-next-line no-eval
    const value = eval(literal);
    const patched = transform(value, label);
    this.text =
      this.text.slice(0, start + declaration.length) +
      JSON.stringify(patched) +
      ";" +
      this.text.slice(lineEnd);
    this.applied.push(label);
  }
}

/* ------------------------------------------------------------------ *
 * Obfuscated patching, for the PLAYER build
 *
 * decode() hands back the readable text plus the spans it rewrote. A
 * position in the readable text maps back to the shipped file by walking
 * to the last span that ended before it and adding the remainder; a
 * position that lands inside a span has no single answer, so anchors are
 * required to start and end outside one.
 * ------------------------------------------------------------------ */

class ObfuscatedFile {
  constructor(source, name) {
    this.original = source;
    this.name = name;
    this.applied = [];
    const result = decode(source);
    this.decoded = result.text;
    this.spans = result.spans;
    this.stats = result;
    /* Edits are collected and applied back to front, so earlier offsets
     * stay valid while they are being found. */
    this.edits = [];
  }

  mapPosition(decodedIndex) {
    let low = 0;
    let high = this.spans.length - 1;
    let found = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.spans[mid].decodedStart < decodedIndex) {
        found = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    if (found === -1) return decodedIndex;
    const span = this.spans[found];
    if (decodedIndex < span.decodedEnd) return null; /* inside a rewritten string */
    return span.originalEnd + (decodedIndex - span.decodedEnd);
  }

  locate(label, find) {
    const first = this.decoded.indexOf(find);
    if (first === -1) throw new Error(`${this.name}: anchor not found: ${label}`);
    if (this.decoded.indexOf(find, first + 1) !== -1) {
      throw new Error(`${this.name}: anchor ambiguous: ${label}`);
    }
    const start = this.mapPosition(first);
    const end = this.mapPosition(first + find.length);
    if (start === null || end === null) {
      throw new Error(`${this.name}: anchor starts or ends inside a decoded string: ${label}`);
    }
    return { start, end };
  }

  edit(label, find, replace) {
    const { start, end } = this.locate(label, find);
    this.edits.push({ start, end, replace, label });
  }

  /* Replace a whole decoded string literal - the call site it came from
   * becomes a plain literal, which is what makes the menu markup
   * patchable at all. */
  editStringSpan(label, startsWith, transform) {
    const matches = this.spans.filter(span => this.decoded.slice(span.decodedStart, span.decodedEnd).startsWith(startsWith));
    if (matches.length === 0) throw new Error(`${this.name}: string span not found: ${label}`);
    if (matches.length > 1) throw new Error(`${this.name}: string span ambiguous (${matches.length}): ${label}`);
    const span = matches[0];
    const value = JSON.parse(this.decoded.slice(span.decodedStart, span.decodedEnd));
    this.edits.push({
      start: span.originalStart,
      end: span.originalEnd,
      replace: JSON.stringify(transform(value, label)),
      label
    });
  }

  build() {
    const ordered = [...this.edits].sort((a, b) => b.start - a.start);
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i].end > ordered[i - 1].start) {
        throw new Error(`${this.name}: overlapping edits: ${ordered[i].label} / ${ordered[i - 1].label}`);
      }
    }
    let out = this.original;
    for (const edit of ordered) {
      out = out.slice(0, edit.start) + edit.replace + out.slice(edit.end);
    }
    this.applied = this.edits.map(edit => edit.label);
    return out;
  }
}

/* ------------------------------------------------------------------ *
 * The menu section, shared by both builds
 * ------------------------------------------------------------------ */

const MENU_SECTION = `\r
\r
    <div class="section">\r
        <div class="section-title">Aim<span class="sec-sub">Where the client says you are pointing.</span></div>\r
        <div class="section-content">\r
            <div class="content-option">\r
                <label class="option-title" for="_smartAim">Precision Aim</label>\r
                <label class="switch-checkbox">\r
                    <input id="_smartAim" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Aims from where you actually are to the point under the cursor, every tick, and corrects your facing as soon as it drifts instead of waiting for it to be 17 degrees out. The game aims from the centre of the screen, which is only where you are once the camera has caught up with you. Off restores the stock behaviour.</span>\r
            </div>\r
            <div class="content-option">\r
                <label class="option-title" for="_targetLock">Target Lock</label>\r
                <label class="switch-checkbox">\r
                    <input id="_targetLock" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Points at the nearest enemy in range instead of at the cursor, led by how far they will move before the hit lands, plus arrow flight time on ranged weapons. Picks whichever enemy your cursor is already closest to, so you still choose the target. Very visible to everyone else.</span>\r
            </div>\r
            <div class="content-option">\r
                <span class="option-title">Target lock range</span>\r
                <label class="slider">\r
                    <span class="slider-value"></span>\r
                    <input id="_targetLockRange" type="range" step="25" min="100" max="800">\r
                </label>\r
            </div>\r
            <div class="content-option">\r
                <label class="option-title" for="_smartBreakAngle">Exact Break Angle</label>\r
                <label class="switch-checkbox">\r
                    <input id="_smartBreakAngle" type="checkbox"></input>\r
                    <span></span>\r
                </label>\r
                <span class="option-description">Autobreak looks for the facing that hits the most things at once by sweeping 72 angles. The best facing always sits exactly on the edge of some object's hit window, so this tests those edges instead - it finds the multi-hits the sweep walks past, and does less work doing it.</span>\r
            </div>\r
        </div>\r
    </div>`;

const COMBAT_ANCHOR = '\r\n\r\n    <div class="section">\r\n        <div class="section-title">Instakills';

function addAimSection(html, label) {
  if (!html.includes(COMBAT_ANCHOR)) throw new Error(`combat page anchor not found: ${label}`);
  return html.replace(COMBAT_ANCHOR, MENU_SECTION + COMBAT_ANCHOR);
}

const ENGINE_BLOCK = `
/* ------------------------------------------------------------------ *
 * ReUp Aim - see v5-src/reup-aim.js. Injected ahead of the client so
 * window.__ReUpAim exists by the time anything calls into it.
 * ------------------------------------------------------------------ */
${ENGINE}
`;

/* ------------------------------------------------------------------ *
 * OWNER
 * ------------------------------------------------------------------ */

function patchOwner() {
  const file = new PlainFile(fs.readFileSync(path.join(SRC, "RYN_Client_v5_OWNER.orig.js"), "utf8"), "OWNER");

  file.edit("engine: inject ReUpAim", "// ==/UserScript==\n", "// ==/UserScript==\n" + ENGINE_BLOCK);

  file.edit(
    "aim: camera-corrected cursor on mousemove",
    `      if (this.rotation) {
        this.mouse.x = x;
        this.mouse.y = y;
        this.client._ModuleHandler._currentAngle = angle;
      }
    }`,
    `      if (this.rotation) {
        this.mouse.x = x;
        this.mouse.y = y;
        this.client._ModuleHandler._currentAngle = angle;
      }
      window.__ReUpAim.onMouseMove(this, event);
    }`
  );

  file.edit(
    "aim: camera-corrected cursor position",
    `    cursorPosition(force = false) {
      if (!force && this.lockPosition) {
        return this.lastPosition;
      }`,
    `    cursorPosition(force = false) {
      if (!force && this.lockPosition) {
        return this.lastPosition;
      }
      const _reupWorld = window.__ReUpAim.cursorWorld(this);
      if (_reupWorld !== null) return _reupWorld;`
  );

  file.edit(
    "aim: re-aim every tick",
    `      this._flushShameHealQueue();
      if (Settings_default._circleRotation && this.move_dir === null) {`,
    `      this._flushShameHealQueue();
      window.__ReUpAim.tickAim(this);
      if (Settings_default._circleRotation && this.move_dir === null) {`
  );

  file.edit(
    "aim: adaptive resend threshold",
    `      if (myPlayer && getAngleDist(myPlayer.angle, sendDir) > .3) {`,
    `      if (myPlayer && getAngleDist(myPlayer.angle, sendDir) > window.__ReUpAim.angleThreshold(mh)) {`
  );

  file.edit(
    "aim: target lock on the attack angle",
    `      if (MH._autoBreakActive && MH._lastBreakAngle != null) {
        return MH._lastBreakAngle;
      }
      return currentAngle;
    }`,
    `      if (MH._autoBreakActive && MH._lastBreakAngle != null) {
        return MH._lastBreakAngle;
      }
      return window.__ReUpAim.attackAngle(this.client, currentAngle);
    }`
  );

  file.edit(
    "aim: exact multi-hit angle for autobreak",
    `      for (let i = 0; i < 72; i++) {
        const testA = i / 72 * Math.PI * 2;
        const s = scoreAngle(testA);
        if (s > bestScore) {
          bestScore = s;
          angle = testA;
        }
      }`,
    `      for (const testA of window.__ReUpAim.breakCandidates(pos1, angle1, gatherAngle, target, nearestEnemyForScore, hittable, nonHittable, inRangeOf)) {
        const s = scoreAngle(testA);
        if (s > bestScore) {
          bestScore = s;
          angle = testA;
        }
      }`
  );

  file.edit(
    "settings: aim keys",
    `    _velocityTickTimes: 0,
  };`,
    `    _velocityTickTimes: 0,
    _smartAim: true,
    _targetLock: false,
    _targetLockRange: 400,
    _smartBreakAngle: true,
  };`
  );

  file.editStringConst("menu: Aim section", "Combat_default", addAimSection);

  fs.writeFileSync(path.join(ROOT, "RYN_Client_v5_OWNER.user.js"), file.text);
  return file;
}

/* ------------------------------------------------------------------ *
 * PLAYER
 *
 * The identifiers below are this build's mangled names, read out of the
 * decoded view. They are pinned by anchors that carry enough surrounding
 * code to be unique, so a rebuild with different names fails loudly
 * instead of patching the wrong thing.
 * ------------------------------------------------------------------ */

function patchPlayer() {
  const file = new ObfuscatedFile(fs.readFileSync(path.join(SRC, "RYN_Client_v5_PLAYER.orig.js"), "utf8"), "PLAYER");

  file.edit("engine: inject ReUpAim", "// ==/UserScript==\n", "// ==/UserScript==\n" + ENGINE_BLOCK);

  file.edit(
    "aim: camera-corrected cursor on mousemove",
    `this["mouse"]["angle"]=_0x4d78da,this["rotation"]&&(this["mouse"]['x']=_0x1180f1,this["mouse"]['y']=_0x5570b3,this["client"]["_ModuleHandler"]["_currentAngle"]=_0x4d78da);}`,
    `this["mouse"]["angle"]=_0x4d78da,this["rotation"]&&(this["mouse"]['x']=_0x1180f1,this["mouse"]['y']=_0x5570b3,this["client"]["_ModuleHandler"]["_currentAngle"]=_0x4d78da);window["__ReUpAim"]["onMouseMove"](this,_0x47331b);}`
  );

  file.edit(
    "aim: camera-corrected cursor position",
    `["cursorPosition"](_0x16dece=![]){if(!_0x16dece&&this["lockPosition"])return this["lastPosition"];`,
    `["cursorPosition"](_0x16dece=![]){if(!_0x16dece&&this["lockPosition"])return this["lastPosition"];{const _0x5265aa=window["__ReUpAim"]["cursorWorld"](this);if(_0x5265aa!==null)return _0x5265aa;}`
  );

  file.edit(
    "aim: re-aim every tick",
    `["postTick"](){this["_flushShameHealQueue"]();`,
    `["postTick"](){this["_flushShameHealQueue"]();window["__ReUpAim"]["tickAim"](this);`
  );

  file.edit(
    "aim: adaptive resend threshold",
    `_0x4c7755&&_0x40771d(_0x4c7755["angle"],_0x15e45e)>0.3&&(`,
    `_0x4c7755&&_0x40771d(_0x4c7755["angle"],_0x15e45e)>window["__ReUpAim"]["angleThreshold"](_0x439610)&&(`
  );

  file.edit(
    "aim: target lock on the attack angle",
    `if(_0x15bfc4["_autoBreakActive"]&&_0x15bfc4["_lastBreakAngle"]!=null)return _0x15bfc4["_lastBreakAngle"];return _0x217a17;}`,
    `if(_0x15bfc4["_autoBreakActive"]&&_0x15bfc4["_lastBreakAngle"]!=null)return _0x15bfc4["_lastBreakAngle"];return window["__ReUpAim"]["attackAngle"](this["client"],_0x217a17);}`
  );

  file.edit(
    "aim: exact multi-hit angle for autobreak",
    `for(let _0x259a70=0x0;_0x259a70<0x48;_0x259a70++){const _0x5ec35b=_0x259a70/0x48*Math['PI']*0x2,_0x46e493=_0x59fe97(_0x5ec35b);_0x46e493>_0x4daca8&&(_0x4daca8=_0x46e493,_0xeb8d2c=_0x5ec35b);}`,
    `for(const _0x5ec35b of window["__ReUpAim"]["breakCandidates"](_0x213711,_0x4eebaf,_0x1bbeaf,_0x4b373b,_0x1b1397,_0x33b071,_0x669405,_0x4c2257)){const _0x46e493=_0x59fe97(_0x5ec35b);_0x46e493>_0x4daca8&&(_0x4daca8=_0x46e493,_0xeb8d2c=_0x5ec35b);}`
  );

  file.edit(
    "settings: aim keys",
    `_0xc709e6["_velocityTickTimes"]=0x0;`,
    `_0xc709e6["_velocityTickTimes"]=0x0,_0xc709e6["_smartAim"]=!![],_0xc709e6["_targetLock"]=![],_0xc709e6["_targetLockRange"]=0x190,_0xc709e6["_smartBreakAngle"]=!![];`
  );

  file.editStringSpan("menu: Aim section", '"<div class=\\"menu-page\\" data-id=\\"2\\">', addAimSection);

  const text = file.build();
  fs.writeFileSync(path.join(ROOT, "RYN_Client_v5_PLAYER.user.js"), text);
  return file;
}

/* ------------------------------------------------------------------ */

const owner = patchOwner();
console.log(`built RYN_Client_v5_OWNER.user.js  (${(owner.text.length / 1024).toFixed(0)} KB)`);
for (const step of owner.applied) console.log("  + " + step);

const player = patchPlayer();
console.log(
  `\nbuilt RYN_Client_v5_PLAYER.user.js (decoded ${player.stats.replaced} string calls to find the sites; the shipped file stays obfuscated)`
);
for (const step of player.applied) console.log("  + " + step);
