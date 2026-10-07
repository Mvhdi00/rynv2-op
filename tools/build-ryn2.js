#!/usr/bin/env node
/*
 * build-ryn2.js
 *
 * Builds Ryn_Type_2.user.js from src/Ryn_Type_2-2.5.js with the fixes for the
 * current game build (src/game_index-cfaab428.js, "s16nqv").
 *
 * Every edit is anchored to an exact string in the input. An anchor that is
 * missing or matches more than once fails the build, so dropping in a newer
 * Ryn shows up as a build error instead of a half-patched script.
 *
 *   node tools/build-ryn2.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/Ryn_Type_2-2.5.js");
const OUT = path.join(ROOT, "Ryn_Type_2.user.js");

let code = fs.readFileSync(BASE, "utf8");
const applied = [];

function edit(label, find, replace) {
  const parts = code.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  code = parts[0] + replace + parts[1];
  applied.push(label);
}

/* ------------------------------------------------------------------ *
 * 0. Header
 * ------------------------------------------------------------------ */

edit("header: version", "// @version         2.5\n", "// @version         2.5.1\n");

/* ------------------------------------------------------------------ *
 * 1. Hats, accessories and weapon sprites
 *
 * The game draws every sprite through its WebGL renderer now: an image is
 * copied into a texture atlas the first time it is drawn. Three things could
 * leave a hat blank or break the frame around it, and each is closed here.
 * ------------------------------------------------------------------ */

// 1a. A game image that fails to load is retried, then mirrored. A store
//     preview or a hat whose request failed used to stay broken for the whole
//     session: the game makes each image once and never asks again.
edit(
  "images: retry and mirror game sprites that fail to load",
  `      const _imgDesc = Object.getOwnPropertyDescriptor(Image.prototype, "src");
      Object.defineProperty(Image.prototype, "src", {
        get() {
          return _imgDesc.get?.call(this);
        },
        set(value) {
          if (value in _customTextures) value = _customTextures[value];
          return _imgDesc.set?.call(this, value);
        },
        configurable: true
      });
    })();`,
  `      const _imgDesc = Object.getOwnPropertyDescriptor(Image.prototype, "src");
      /* A sprite the game asked for and did not get. The game creates each
       * hat, accessory and weapon image once, sets its src once and never
       * looks again, so one failed request is a blank hat and a broken store
       * preview for the rest of the session. A failure is retried once from
       * the page's own origin past any cached copy, and a hat that still will
       * not load falls back to its texture-pack image. That one is cross-
       * origin, so it is asked for with CORS: the WebGL renderer cannot upload
       * a tainted image into its atlas, and trying throws inside the frame. */
      const _rynGameImg = /^(?:\\.\\/|\\/)?img\\/(?:hats|accessories|weapons|animals|icons)\\/[\\w.-]+\\.png$/;
      const _rynImgRetry = function() {
        const original = this.__rynImgPath;
        if (!original) return;
        const stage = this.__rynImgStage = (this.__rynImgStage | 0) + 1;
        let next = null;
        if (stage === 1) {
          next = location.origin + "/" + original.replace(/^\\.?\\//, "") + "?ryn=" + Date.now().toString(36);
        } else if (stage === 2 && typeof patterns[original] === "string" && patterns[original]) {
          try {
            this.crossOrigin = "anonymous";
          } catch (e) {}
          next = patterns[original];
        }
        if (next !== null) {
          try {
            _imgDesc.set.call(this, next);
          } catch (e) {}
        }
      };
      Object.defineProperty(Image.prototype, "src", {
        get() {
          return _imgDesc.get?.call(this);
        },
        set(value) {
          try {
            this.__rynBad = false;
            if (typeof value === "string" && _rynGameImg.test(value) && !(value in _customTextures)) {
              this.__rynImgPath = value;
              this.__rynImgStage = 0;
              if (!this.__rynImgArmed) {
                this.__rynImgArmed = true;
                this.addEventListener("error", _rynImgRetry);
              }
            }
          } catch (e) {}
          if (value in _customTextures) value = _customTextures[value];
          return _imgDesc.set?.call(this, value);
        },
        configurable: true
      });
    })();`
);

// 1b. One sprite the renderer cannot take must cost that sprite, not the rest
//     of the frame (every player, hat and name drawn after it).
edit(
  "images: guard the WebGL atlas upload",
  `        if (!img.width || !img.height) return;
        if (arguments.length > 5) {
          const o = sync();
          return o ? o.drawImage.apply(o, arguments) : void 0;
        }
        return orig.drawImage.apply(M, arguments);
      };`,
  `        if (!img.width || !img.height) return;
        // Marked when the renderer refused it (a tainted or broken image), and
        // cleared again when its src changes.
        if (img.__rynBad === true) return;
        if (arguments.length > 5) {
          const o = sync();
          return o ? o.drawImage.apply(o, arguments) : void 0;
        }
        try {
          return orig.drawImage.apply(M, arguments);
        } catch (e) {
          try {
            img.__rynBad = true;
          } catch (_) {}
        }
      };
      /* The background grid. The bundle hook (RenderGrid) takes it out of the
       * frame code; this catches it at the draw call as well, so the grid
       * stays gone on a build whose code the pattern does not match. A grid
       * line is a full-width or full-height line at 4px, black, alpha .06 —
       * nothing else the game draws looks like that. */
      if (typeof M.line === "function") {
        const origLine = M.line;
        M.line = function(x1, y1, x2, y2) {
          if (M.lineWidth === 4 && M.globalAlpha === .06 && M.strokeStyle === "#000" && (x1 === x2 && y1 === 0 || y1 === y2 && x1 === 0)) {
            return;
          }
          return origLine.apply(M, arguments);
        };
      }
      /* Your own name, coloured even when the nameColor hook did not bind.
       * The hook reports in every time it runs (Renderer._nameHookAt); while
       * it is silent, a nameplate whose text is your nickname takes the
       * colour here instead. */
      if (typeof M.text === "function") {
        const origText = M.text;
        M.text = function(str, x, y, size, style) {
          try {
            if (style && typeof style === "object" && style.outline && Settings_default._myNameColor && Settings_default._myNameColorValue && Date.now() - Renderer._nameHookAt > 1e3) {
              const own = AC();
              const nick = own && own.myPlayer && own.myPlayer.nickname;
              if (nick && str === nick) {
                style = Object.assign({}, style, {
                  color: Settings_default._myNameColorValue
                });
              }
            }
          } catch (e) {}
          return origText.call(M, str, x, y, size, style);
        };
      }`
);

// 1c. Stop the page's own copy of the game at document-start too.
//
// At document-start RYN takes the game's <script type="module"> out of the
// page and runs its own patched copy. Chrome does not always honour the
// removal: once the parser has prepared a module script, it runs even after it
// is taken out of the document. When it does, two copies of the game draw into
// the same WebGL canvas every frame. The page's copy is unpatched — it draws the
// grid, draws your name white, and loads its sprites into its own texture atlas
// on the same GL context RYN's copy uses, so each overwrites the other's
// textures: hats vanish and weapons turn into dark blocks.
//
// The late-injection path already stops the page's copy at its first line; the
// same stop is armed here for the document-start path. It throws only for code
// running from the entry module RYN replaced, and only once RYN's own copy has
// been prepared, so a failed load still leaves the page's game running.
edit(
  "load: stop the page's own game copy at document-start too",
  `      window.addEventListener("load", disarm, {
        once: true
      });
      setTimeout(disarm, 6e4);
    }
    const _fetch = window.fetch;`,
  `      window.addEventListener("load", disarm, {
        once: true
      });
      setTimeout(disarm, 6e4);
    }
    if (loadedFast) {
      const pageModule = /https?:\\/\\/[^\\s()]+\\/assets\\/index-[^\\/\\s()]*\\.js/;
      const docProto = Document.prototype;
      const nativeCreateElement = docProto.createElement;
      let verdict = null;
      let stopped = null;
      const entryUrl = () => {
        try {
          return scriptBundle !== null && scriptBundle.src ? new URL(scriptBundle.src, location.href).href : null;
        } catch (e) {
          return null;
        }
      };
      const stopEarlyCopy = function createElement() {
        if (verdict === "allow") {
          return nativeCreateElement.apply(this, arguments);
        }
        let hit = null;
        try {
          hit = pageModule.exec(new Error().stack || "");
        } catch (e) {}
        const entry = entryUrl();
        if (hit === null || entry === null || hit[0] !== entry) {
          return nativeCreateElement.apply(this, arguments);
        }
        if (verdict === null) {
          if (Injector_lastCode === null) {
            try {
              Injector_default.init(scriptBundle);
            } catch (e) {}
          }
          // No copy of our own to run in its place: let the page's run.
          if (Injector_lastCode === null) {
            verdict = "allow";
            return nativeCreateElement.apply(this, arguments);
          }
          verdict = "stop";
          stopped = new Error("[RYN] The page's own copy of the game was stopped at its first line; RYN runs its own.");
          window.addEventListener("error", event => {
            if (event.error === stopped) {
              event.preventDefault();
            }
          }, true);
        }
        throw stopped;
      };
      docProto.createElement = stopEarlyCopy;
      const disarmEarly = () => {
        if (docProto.createElement === stopEarlyCopy) {
          docProto.createElement = nativeCreateElement;
        }
      };
      window.addEventListener("load", disarmEarly, {
        once: true
      });
      setTimeout(disarmEarly, 6e4);
    }
    const _fetch = window.fetch;`
);

/* ------------------------------------------------------------------ *
 * 2. The grid, in the bundle hook as well
 *
 * The pattern assumed the first loop is `for(var` and the second `for(let`.
 * Either may be either.
 * ------------------------------------------------------------------ */

edit(
  "grid: accept var or let in either grid loop",
  String.raw`for\(var (\w+)=[^;]+;\3<\w+;\3\+=\2\)\3>0&&\w+\.line\([^)]*\);for\(let (\w+)=`,
  String.raw`for\((?:var|let) (\w+)=[^;]+;\3<\w+;\3\+=\2\)\3>0&&\w+\.line\([^)]*\);for\((?:var|let) (\w+)=`
);

/* ------------------------------------------------------------------ *
 * 3. Own-name colour
 *
 * `player === me` compared two references to the bundle's player object. It is
 * the same check by id as well now, and the hook records that it ran, which is
 * what the renderer fallback in 1b keys off.
 * ------------------------------------------------------------------ */

edit(
  "name colour: match by id and report the hook alive",
  `    _nameColor(player, me, color) {
      try {
        if (player === me && Settings_default._myNameColor && Settings_default._myNameColorValue) {`,
  `    _nameHookAt=0;
    _nameColor(player, me, color) {
      try {
        this._nameHookAt = Date.now();
        const isMe = player === me || !!(player && me && player.sid != null && player.sid === me.sid);
        if (isMe && Settings_default._myNameColor && Settings_default._myNameColorValue) {`
);

/* ------------------------------------------------------------------ *
 * 4. Bots: join with the player's own device id
 *
 * The /join API trades a Turnstile token for a socket ticket and takes a
 * device id ("did") with it. The game sends the id it keeps in moo_did, and so
 * does Glotus, whose bots get in. RYN gave each bot an id from a list of ids
 * earlier bots had been issued, kept in localStorage. Nothing ever removed one:
 * an id the API stops accepting stayed first on the list and every bot after
 * it was refused. Bots now join with the same id the game itself sends.
 * ------------------------------------------------------------------ */

edit(
  "bots: send the player's own device id to /join",
  `    take() {
      for (const did of this._load()) {
        if (!this.inUse.has(did)) {
          this.inUse.add(did);
          return did;
        }
      }
      return null;
    },
    keep(did) {
      if (typeof did !== "string" || !did) return;
      this.inUse.add(did);
      try {
        const list = this._load();
        if (list.indexOf(did) < 0) {
          list.push(did);
          localStorage.setItem(RYN_BOT_DIDS_KEY, JSON.stringify(list.slice(-64)));
        }
      } catch (_) {}
    },
    release(did) {
      if (did) this.inUse.delete(did);
    }`,
  `    // The id the game itself joins with (moo_did), as the game and Glotus
    // send it. Null before the first join of this browser: the API then
    // issues one, and keep() stores it where the game keeps its own.
    take() {
      try {
        const own = localStorage.getItem("moo_did");
        if (typeof own === "string" && own) return own;
      } catch (_) {}
      return null;
    },
    keep(did) {
      if (typeof did !== "string" || !did) return;
      try {
        if (!localStorage.getItem("moo_did")) localStorage.setItem("moo_did", did);
      } catch (_) {}
    },
    release(did) {}`
);

/* ------------------------------------------------------------------ *
 * 5. Frost Helm in the snow
 *
 * The snow update added Frost Helm (60): normal speed in snow, 12% less damage
 * taken. In the snow biome every automatic soldier equip becomes Frost Helm
 * when you own it; outside the snow nothing changes. A soldier you pick by
 * hand in the store stays a soldier. The damage model follows the hat that is
 * actually worn. "Frost Helm in snow" (Combat, on by default) turns it off.
 * ------------------------------------------------------------------ */

edit(
  "frost helm: setting default",
  `    _safeSoldier: true,\n`,
  `    _safeSoldier: true,\n    _frostHelmInSnow: true,\n`
);

edit(
  "frost helm: store list default",
  `_storeItems: [ [ 15, 31, 6, 7, 22, 12, 26, 11, 53, 20, 40, 56 ]`,
  `_storeItems: [ [ 15, 31, 6, 60, 7, 22, 12, 26, 11, 53, 20, 40, 56 ]`
);

edit(
  "frost helm: add it to a saved store list",
  `  if (!FORMATION_IDS.has(settings._formation)) {`,
  `  // Frost Helm is new with the snow update: a store list saved before it
  // existed gets it next to the soldier helmet.
  if (Array.isArray(settings._storeItems) && Array.isArray(settings._storeItems[0]) && settings._storeItems[0].indexOf(60) < 0) {
    const hats = settings._storeItems[0].slice();
    const at = hats.indexOf(6);
    hats.splice(at < 0 ? hats.length : at + 1, 0, 60);
    settings._storeItems = [ hats, settings._storeItems[1] ];
  }
  if (!FORMATION_IDS.has(settings._formation)) {`
);

edit(
  "frost helm: combat menu toggle",
  String.raw`<label class=\"switch-checkbox\"><input id=\"_safeSoldier\" type=\"checkbox\"><span></span></label>\n            </div>`,
  String.raw`<label class=\"switch-checkbox\"><input id=\"_safeSoldier\" type=\"checkbox\"><span></span></label>\n            </div>\n            <div class=\"content-option quiet\">\n                <div class=\"opt-main\"><label class=\"option-title\" for=\"_frostHelmInSnow\">Frost Helm in snow</label><span class=\"opt-desc\">In the snow biome, wear Frost Helm wherever soldier would go on.</span></div>\n                <label class=\"switch-checkbox\"><input id=\"_frostHelmInSnow\" type=\"checkbox\"><span></span></label>\n            </div>`
);

edit(
  "frost helm: ModuleHandler.defenseHat and plannedHat",
  `    plannedHat() {
      if (this.soldierAnti && this.canBuy(0, 6)) {
        return 6;
      }
      if (this.forceHat !== null) {
        return this.forceHat;
      }
      if (this.useHat !== null) {
        return this.useHat;
      }
      return this.client.myPlayer.hatID;
    }`,
  `    // The defensive hat for where you stand: Frost Helm in the snow biome
    // when it is owned and the option is on, the soldier helmet everywhere
    // else.
    defenseHat() {
      try {
        const myPlayer = this.client.myPlayer;
        const pos = myPlayer && myPlayer.pos && myPlayer.pos.current;
        if (Settings_default._frostHelmInSnow && pos && pos.y <= Config_default.snowBiomeTop && this.canBuy(0, 60)) {
          return 60;
        }
      } catch (e) {}
      return 6;
    }
    plannedHat() {
      const defense = this.defenseHat();
      if (this.soldierAnti && this.canBuy(0, defense)) {
        return defense;
      }
      if (this.forceHat !== null) {
        return this.forceHat === 6 ? defense : this.forceHat;
      }
      if (this.useHat !== null) {
        return this.useHat === 6 ? defense : this.useHat;
      }
      return this.client.myPlayer.hatID;
    }`
);

edit(
  "frost helm: swap automatic soldier equips in _equip",
  `    _equip(type, id, force = false, toggle = false) {
      const store2 = this.store[type];
      const {myPlayer: myPlayer, PacketManager: PacketManager2, EnemyManager: EnemyManager2, isOwner: isOwner, clients: clients} = this.client;
      if (toggle && store2.last === id && id !== 0) {`,
  `    _equip(type, id, force = false, toggle = false) {
      const store2 = this.store[type];
      const {myPlayer: myPlayer, PacketManager: PacketManager2, EnemyManager: EnemyManager2, isOwner: isOwner, clients: clients} = this.client;
      // Automatic equips only: a soldier picked by hand stays a soldier.
      if (type === 0 && id === 6 && !force) {
        id = this.defenseHat();
      }
      if (toggle && store2.last === id && id !== 0) {`
);

edit(
  "frost helm: autohat counts Frost Helm as a soldier",
  `      const useSoldier = ModuleHandler.canBuy(0, 6);
      const useWinter = ModuleHandler.canBuy(0, 15);`,
  `      const useSoldier = ModuleHandler.canBuy(0, 6) || ModuleHandler.canBuy(0, ModuleHandler.defenseHat());
      const useWinter = ModuleHandler.canBuy(0, 15);`
);

edit(
  "frost helm: shadow wings follow Frost Helm too",
  `      const soldierActive = myPlayer.hatID === 6 || ModuleHandler.forceHat === 6 || ModuleHandler.shouldEquipSoldier;`,
  `      const soldierActive = myPlayer.hatID === 6 || myPlayer.hatID === 60 || ModuleHandler.forceHat === 6 || ModuleHandler.shouldEquipSoldier;`
);

edit(
  "frost helm: enemy danger uses the hat you would wear",
  `      const soldierDefense = Hats[6].dmgMult;
      const soldierMult = myPlayer.hatID === 6 ? soldierDefense : 1;
      if (potentialDamage * soldierDefense >= myPlayer.currentHealth) {`,
  `      const soldierDefense = Hats[this.client._ModuleHandler.defenseHat()].dmgMult;
      const soldierMult = myPlayer.hatID === 6 || myPlayer.hatID === 60 ? Hats[myPlayer.hatID].dmgMult : 1;
      if (potentialDamage * soldierDefense >= myPlayer.currentHealth) {`
);

edit(
  "frost helm: player danger uses the hat you would wear",
  `      const soldierDefense = Hats[6].dmgMult;
      if (this.potentialDamage * soldierDefense >= myPlayer.currentHealth) {
        return 3;
      }
      const soldierMult = myPlayer.hatID === 6 ? soldierDefense : 1;`,
  `      const soldierDefense = Hats[this.client._ModuleHandler.defenseHat()].dmgMult;
      if (this.potentialDamage * soldierDefense >= myPlayer.currentHealth) {
        return 3;
      }
      const soldierMult = myPlayer.hatID === 6 || myPlayer.hatID === 60 ? Hats[myPlayer.hatID].dmgMult : 1;`
);

edit(
  "frost helm: heal engine forces the defensive hat it can wear",
  `      if ((this.imTrapped && this.spikeDmgCount > 0 || this.spikeTickAnti) && ModuleHandler.canBuy(0, 6)) {
        ModuleHandler.setForceHat(6);
      }
      if (this.soldierAnti && ModuleHandler.canBuy(0, 6)) {
        ModuleHandler.soldierAnti = true;
      }`,
  `      if ((this.imTrapped && this.spikeDmgCount > 0 || this.spikeTickAnti) && ModuleHandler.canBuy(0, ModuleHandler.defenseHat())) {
        ModuleHandler.setForceHat(6);
      }
      if (this.soldierAnti && ModuleHandler.canBuy(0, ModuleHandler.defenseHat())) {
        ModuleHandler.soldierAnti = true;
      }`
);

edit(
  "frost helm: heal engine reduces damage by the hat worn",
  `      if (this.currentHat === 6) {
        this.totalDmgPot *= Hats[6].dmgMult;
      }`,
  `      if (this.currentHat === 6 || this.currentHat === 60) {
        this.totalDmgPot *= Hats[this.currentHat].dmgMult;
      }`
);

edit(
  "frost helm: spike damage recognised through Frost Helm",
  `    _spikeLike(value) {
      const mult = Hats[6].dmgMult;
      for (let i = 0; i < NS_SPIKE_DAMAGES.length; i++) {
        const base = NS_SPIKE_DAMAGES[i];
        if (Math.abs(value - base) < NS_EPS || Math.abs(value - base * mult) < NS_EPS) {
          return true;
        }
      }
      return false;
    }
    _reversed(value) {
      const mult = Hats[6].dmgMult;
      for (let i = 0; i < NS_SPIKE_DAMAGES.length; i++) {
        const base = NS_SPIKE_DAMAGES[i];
        if (Math.abs(value - base * mult) < NS_EPS) {
          return value / mult;
        }`,
  `    _spikeLike(value) {
      const mult = Hats[6].dmgMult, frost = Hats[60].dmgMult;
      for (let i = 0; i < NS_SPIKE_DAMAGES.length; i++) {
        const base = NS_SPIKE_DAMAGES[i];
        if (Math.abs(value - base) < NS_EPS || Math.abs(value - base * mult) < NS_EPS || Math.abs(value - base * frost) < NS_EPS) {
          return true;
        }
      }
      return false;
    }
    _reversed(value) {
      const mult = Hats[6].dmgMult, frost = Hats[60].dmgMult;
      for (let i = 0; i < NS_SPIKE_DAMAGES.length; i++) {
        const base = NS_SPIKE_DAMAGES[i];
        if (Math.abs(value - base * frost) < NS_EPS) {
          return value / frost;
        }
        if (Math.abs(value - base * mult) < NS_EPS) {
          return value / mult;
        }`
);

edit(
  "frost helm: poison recognised through Frost Helm",
  `if (Math.abs(this.damages[i] - NS_POISON_DAMAGE) < NS_EPS || Math.abs(this.damages[i] - NS_POISON_DAMAGE * Hats[6].dmgMult) < NS_EPS) {`,
  `if (Math.abs(this.damages[i] - NS_POISON_DAMAGE) < NS_EPS || Math.abs(this.damages[i] - NS_POISON_DAMAGE * Hats[6].dmgMult) < NS_EPS || Math.abs(this.damages[i] - NS_POISON_DAMAGE * Hats[60].dmgMult) < NS_EPS) {`
);

edit(
  "frost helm: sandbox auto-buy",
  `buyList=[ [ 0, 40 ], [ 0, 6 ], [ 0, 53 ],`,
  `buyList=[ [ 0, 40 ], [ 0, 6 ], [ 0, 60 ], [ 0, 53 ],`
);

/* ------------------------------------------------------------------ */

fs.writeFileSync(OUT, code);

console.log("built", path.relative(ROOT, OUT));
console.log(`  ${(code.length / 1024).toFixed(0)} KB, ${code.split("\n").length} lines\n`);
for (const step of applied) console.log("  + " + step);
