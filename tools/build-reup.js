#!/usr/bin/env node
/*
 * build-reup.js
 *
 * Builds ReUp_Mix.user.js from the Ryn Type 2 client: the hook and transport
 * repairs this build carries against the shipped game bundle, plus the Luna
 * features RYN never had.
 *
 * RYN is the base rather than Luna because only RYN speaks the protocol the
 * current game actually uses — the per-connection opcode permutation, the
 * truncated-HMAC frame prefix, and now the per-frame xorshift mask and the
 * WebAssembly key mixer in src/game_protocol.js. Luna 1.1 is a fork of the old
 * webpack bundle and predates all of it, so its features are ported across as
 * modules instead of its code being merged in.
 *
 * Every edit is anchored to an exact string in the base client, and an anchor
 * that is missing or ambiguous fails the build: dropping in a newer RYN shows
 * up as a build error rather than a half-merged script.
 *
 *   node tools/build-reup.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "src/Ryn_Type_2.user.js");
const OUT = path.join(ROOT, "ReUp_Mix.user.js");
const DRIVERS = JSON.parse(
  fs.readFileSync(path.join(ROOT, "drivers/game-drivers.json"), "utf8")
);

let code = fs.readFileSync(BASE, "utf8");
const applied = [];

/* Every edit goes through here so a stale anchor fails the build loudly
 * instead of silently producing a half-merged script. */
function edit(label, find, replace) {
  const parts = code.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  code = parts[0] + replace + parts[1];
  applied.push(label);
}

/* For an edit that must apply everywhere a string occurs. */
function editAll(label, find, replace, expected) {
  const hits = code.split(find).length - 1;
  if (hits === 0) throw new Error(`anchor not found: ${label}`);
  if (expected !== undefined && hits !== expected) {
    throw new Error(`anchor hit ${hits} times, expected ${expected}: ${label}`);
  }
  code = code.split(find).join(replace);
  applied.push(`${label} (${hits})`);
}

/* An edit the base may already carry. Used where upstream has since fixed
 * something this build used to patch: the build says so rather than failing. */
function editIfPresent(label, find, replace) {
  if (!code.includes(find)) {
    applied.push(`${label} — already in the base, nothing to do`);
    return false;
  }
  return edit(label, find, replace) || true;
}

/* ------------------------------------------------------------------ *
 * 1. Userscript header
 * ------------------------------------------------------------------ */

const header = `// ==UserScript==
// @name            ReUp Mix (Luna x Ryn)
// @namespace       reup-mix
// @author          Mix build - Ryn Type 2 by Raptor, Luna Client by Luna & Skye (help from Zenith and XTRFY)
// @description     The Ryn Type 2 core on the current protocol, with its bundle hooks repaired and the Luna-only features folded in
// @version         2.0.0
// @match           *://*.moomoo.io/*
// @icon            https://i.postimg.cc/G294sRHY/ryn-type-2.webp
// @run-at          document-start
// @grant           none
// @license         MIT
// ==/UserScript==
`;

{
  const end = code.indexOf("// ==/UserScript==");
  if (end === -1) throw new Error("could not find end of base userscript header");
  code = header + code.slice(end + "// ==/UserScript==".length).replace(/^\r?\n/, "\n");
  applied.push("header: rewritten for ReUp Mix");
}

/* ------------------------------------------------------------------ *
 * 2. Branding
 * ------------------------------------------------------------------ */

edit(
  "branding: window title",
  `  if (document.title !== "Ryn Type 2") document.title = "Ryn Type 2";`,
  `  if (document.title !== "ReUp Mix") document.title = "ReUp Mix";`
);

edit(
  "branding: client name in the Misc page",
  `<span id=\\\"author\\\" class=\\\"text-value\\\">Ryn Type 2</span>`,
  `<span id=\\\"author\\\" class=\\\"text-value\\\">ReUp Mix</span>`
);

/* ------------------------------------------------------------------ *
 * 3. Transport: what the client reads off the bundle
 *
 * RynWire carries the game's transport for RYN's own sockets (the bots'),
 * which cannot borrow the game's code. tools/check-wire.js holds every piece
 * of it against the game's own functions; what it cannot check is the part
 * that reads the bundle's *constants* at load, because those are only right
 * if `learn()` finds them.
 *
 * On this bundle it finds the alphabets and nothing else. Its other anchor
 * expects salt, signature width and mode to be declared in one run ahead of
 * the c2s alphabet:
 *
 *     const uf=<salt>,So=<sig>,Ws=<mode>,Bl=["M","D","9",…]
 *
 * and the shipped bundle splits them:
 *
 *     const $f=1,Uo=6;                       … later …
 *     const Qs=1,dl=["M","D","9",…],eu=17,fl=["A",…],tu=36;
 *
 * so all three fall back to the values written into the class. They happen to
 * be right today, which is the problem: nothing says when they stop being.
 * Each is read from the code that uses it instead —
 *
 *     mode   the const the alphabet declaration opens with
 *     sig    the offset the payload is written at, after the signature at 0
 *     salt   the branch the alphabet slice is gated on
 *
 * — and a value that cannot be found is reported rather than quietly assumed.
 * ------------------------------------------------------------------ */

edit(
  "wire: read the protocol constants from the code that uses them",
  `    // The bundle's protocol constants, from its own text:
    //   const uf=<salt>,So=<sig bytes>,Ws=<mode>,Bl=["M","D","9",…],hf=<n>,Dl=["A","B","C",…],xf=<n>
    learn(text) {`,
  `    // Arithmetic the obfuscator writes constants as, exponents included
    // ("-1061+-5e3*1+-19*-319").
    _NUMEXPR="[-+*\\\\d\\\\s.eE]+";
    // \`<name> = <number>\` wherever the bundle declares it.
    _bind(text, name) {
      const m = new RegExp(
        "(?:const |let |var |[,;({])" + name.replace(/\\$/g, "\\\\$") + "=(" + this._NUMEXPR + ")[,;)}]"
      ).exec(text);
      return m ? this._num(m[1]) : null;
    }
    // The bundle's protocol constants, each from the code that uses it. See
    // the ReUp Mix build notes for why the old single anchor stopped matching.
    learn(text) {`
);

edit(
  "wire: tolerate exponent notation in the obfuscator's numbers",
  `    _num(expr) {
      if (typeof expr !== "string" || !/^[-+*\\d\\s]+$/.test(expr)) return null;`,
  `    _num(expr) {
      if (typeof expr !== "string" || !new RegExp("^" + this._NUMEXPR + "$").test(expr)) return null;`
);

edit(
  "wire: resolve mode, signature width and legacy salt",
  `          const head = new RegExp("const [\\\\w$]+=([-+*\\\\d\\\\s]+),[\\\\w$]+=([-+*\\\\d\\\\s]+),[\\\\w$]+=([-+*\\\\d\\\\s]+)," + c2s[1].replace(/\\$/g, "\\\\$") + "=\\\\[").exec(text);
          if (head) {
            const salt = this._num(head[1]), sig = this._num(head[2]), mode = this._num(head[3]);
            if (salt !== null) this.defaultSalt = salt;
            if (sig !== null && sig > 0 && sig <= 32) this.sigBytes = sig;
            if (mode !== null) this.mode = mode;
          }`,
  `          const name = c2s[1].replace(/\\$/g, "\\\\$");
          const missed = [];

          /* mode: \`const <mode>=1,<c2s>=["M",…]\` — the alphabet run opens
           * with it. */
          const mode = new RegExp("const ([\\\\w$]+)=(" + this._NUMEXPR + ")," + name + "=\\\\[").exec(text);
          const modeValue = mode ? this._num(mode[2]) : null;
          if (modeValue !== null) this.mode = modeValue; else missed.push("transport mode");

          /* signature width: the frame is the signature written at 0 and the
           * payload written at the width —
           *   f[.set](sig,0), f[.set](payload,<width>)
           * so the second offset is the binding, and the first has to be 0. */
          const sig = new RegExp(
            "([\\\\w$]+)\\\\[[^\\\\]]*\\\\]\\\\([\\\\w$]+,(" + this._NUMEXPR + ")\\\\),\\\\1\\\\[[^\\\\]]*\\\\]\\\\([\\\\w$]+,([\\\\w$]+)\\\\),"
          ).exec(text);
          const sigValue = sig && this._num(sig[2]) === 0 ? this._bind(text, sig[3]) : null;
          if (sigValue !== null && sigValue > 0 && sigValue <= 32) this.sigBytes = sigValue;
          else missed.push("frame signature width");

          /* legacy salt: the table builder picks it when no salt was passed,
           *   s = o ? <salt> : t,  …  c2s: ul(o ? <c2s>.slice(0, n) : <c2s>, a)
           * and the same \`o\` gates the alphabet slice, which is what ties this
           * to the right branch rather than to any other ternary. */
          const salt = new RegExp(
            ",([\\\\w$]+)=([\\\\w$]+)\\\\?([\\\\w$]+):[\\\\w$]+,[\\\\s\\\\S]{0,240}?\\\\2\\\\?" + name + "\\\\["
          ).exec(text);
          const saltValue = salt ? this._bind(text, salt[3]) : null;
          if (saltValue !== null) this.defaultSalt = saltValue; else missed.push("legacy table salt");

          if (missed.length) {
            // Not Logger: every Logger method returns early in a release
            // build, and this is a message about the transport.
            try {
              console.warn(
                "[ReUp] could not read " + missed.join(", ") + " off the game bundle; " +
                "using the values this build was verified against"
              );
            } catch (_) {}
          }`
);

/* ------------------------------------------------------------------ *
 * 4. Transport: the key mixer
 *
 * On a pinned connection the server's key is run through mixKey before
 * anything is signed with it, so a client that cannot mix cannot talk. RYN
 * takes mixKey from the game's own `moomoo-protocol` module, captured where
 * the injector imports it, and has nothing to fall back on: on a build where
 * that capture misses, every bot gets an unmixed key and every frame it sends
 * is rejected.
 *
 * The mixer is one WebAssembly function with no control flow, so the build
 * writes it out in JavaScript from drivers/game-drivers.json. The disassembly
 * it comes from is checked against the module itself during extraction
 * (tools/extract-drivers.js), and the result is checked again against the
 * module by tools/check-wire.js, so this cannot drift from the real thing
 * without a verifier saying so.
 *
 * It is a fallback, not a replacement: the module's own export is still
 * preferred wherever it can be had.
 * ------------------------------------------------------------------ */

const MIXER = DRIVERS.protocol.keyMixer;

edit(
  "wire: a key mixer to fall back on",
  `    sign(key, data) {
      return RynSign.signAlone(key, data, this.sigBytes);
    }`,
  `    sign(key, data) {
      return RynSign.signAlone(key, data, this.sigBytes);
    }
    /* One byte of the mixer's stream, as the module's WebAssembly computes it
     * (build ${MIXER.buildId}; see drivers/game-drivers.json). 32-bit wrapping
     * throughout. */
    _mixByte(seed, i) {
      let x;
      ${MIXER.byteJs.join(";\n      ")};
    }
    /* mixKey(key, seed), for a session that could not get hold of the
     * protocol module's own export. Only valid for the build the drivers were
     * taken from, which ReUpDrivers.check() watches for. */
    mixKey(key, seed) {
      const out = new Uint8Array(key.length);
      for (let i = 0; i < key.length; i++) out[i] = key[i] ^ this._mixByte(seed | 0, i);
      return out;
    }`
);

edit(
  "wire: use the fallback mixer and salt when the module is out of reach",
  `      mixKey: proto && typeof proto.mixKey === "function" ? proto.mixKey : fn(g.mixKey, null),
      salt: proto && proto.BUILD_SALT != null ? proto.BUILD_SALT : g.salt != null ? g.salt : null,
      buildId: proto && proto.BUILD_ID != null ? proto.BUILD_ID : g.buildId != null ? g.buildId : null,`,
  `      /* The module's own export first, then whatever a hook found in the
       * bundle, then RynWire's copy. A session with none of the three cannot
       * sign a frame a pinned server will accept. */
      mixKey: proto && typeof proto.mixKey === "function"
        ? proto.mixKey
        : fn(g.mixKey, (key, seed) => RynWire.mixKey(key, seed)),
      salt: proto && proto.BUILD_SALT != null
        ? proto.BUILD_SALT
        : g.salt != null ? g.salt : ${JSON.stringify(MIXER.buildSalt)},
      buildId: proto && proto.BUILD_ID != null
        ? proto.BUILD_ID
        : g.buildId != null ? g.buildId : ${JSON.stringify(MIXER.buildId)},`
);

/* ------------------------------------------------------------------ *
 * 5. The bundle hooks the shipped build orphaned
 *
 * tools/check-hooks.js runs the client's own hook list against
 * src/game_index.js exactly as served. Nine of them do not bind. Four are the
 * ones that name the transport's functions, and they fail for the reason the
 * client's own comment gives: the obfuscator routes a call through a throwaway
 * wrapper on some builds and not others, so `fn(a,b)` is written
 * `o["xyz"](fn,a,b)` and a pattern pinned to the first shape misses.
 *
 * Rather than pin them to the second shape — which would miss the next time it
 * flips — each accepts either: the wrapper prefix is optional and the
 * separator after the function name is `(` or `,`.
 * ------------------------------------------------------------------ */

/* `(?:\w+\[[^\]]*\]\()?(\w+)[(,]` — a call to a function worth naming, written
 * either plainly or through one of the obfuscator's wrappers. */
const WRAPPED = String.raw`(?:\w+\[[^\]]*\]\()?`;

edit(
  "hook: cryptoSession accepts a wrapped call",
  String.raw`    const cryptoSession = Hook.match("cryptoSession", /(\w+)=(\w+)\(\w+\[[^\]]+\]\),(\w+)=(\w+)\?(\w+)\(\1,(\w+)\):\1;(\w+)=(?:RYN\._myClient\._gameCrypto=)?\{(?:_bundle:!0,)?mode:(\w+),key:\3,tables:\4\?(\w+)\(\6,(\w+)\):.*?,seq:0,mask:\4\?(\w+)\(\3\):null,received:0\}/);`,
  "    const cryptoSession = Hook.match(\"cryptoSession\", /(\\w+)=" + WRAPPED +
    String.raw`(\w+)[(,]\w+\[[^\]]+\]\),(\w+)=(\w+)\?` + WRAPPED +
    String.raw`(\w+)[(,]\1,(\w+)\):\1;(\w+)=(?:RYN\._myClient\._gameCrypto=)?\{(?:_bundle:!0,)?mode:(\w+),key:\3,tables:\4\?` + WRAPPED +
    String.raw`(\w+)[(,]\6,(\w+)\):.*?,seq:0,mask:\4\?` + WRAPPED +
    String.raw`(\w+)[(,]\3\):null,received:0\}/);`
);

edit(
  "hook: cryptoInbound accepts a wrapped call",
  String.raw`    const cryptoInbound = Hook.match("cryptoInbound", /&&(\w+)\(\w+,(\w+)\((\w+)\[\w+\(\d+,"[^"]*"\)\]\[\w+\(\d+,"[^"]*"\)\],\+\+\3\[/);`,
  "    const cryptoInbound = Hook.match(\"cryptoInbound\", /&&" + WRAPPED +
    String.raw`(\w+)[(,]\w+,` + WRAPPED +
    String.raw`(\w+)[(,](\w+)\[\w+\(\d+,"[^"]*"\)\]\[\w+\(\d+,"[^"]*"\)\],\(?\+\+\3\[/);`
);

edit(
  "hook: cryptoSign accepts a wrapped frame size",
  String.raw`    const cryptoSign = Hook.match("cryptoSign", /\]\((\w+),(\w+)\[\w+\(\d+,"[^"]*"\)\],(\w+)\),\w+=new Uint8Array\((\w+)\+\3\[/);`,
  String.raw`    const cryptoSign = Hook.match("cryptoSign", /[\](,]\s*(\w+),(\w+)\[\w+\(\d+,"[^"]*"\)\],(\w+)\),\w+=new Uint8Array\(` +
    WRAPPED + String.raw`(\w+)[+,]\3\[/);`
);

edit(
  "hook: cryptoOutbound accepts a wrapped call",
  String.raw`    const cryptoOutbound = Hook.match("cryptoOutbound", /(\w+)\(\w+\[\w+\(\d+,"[^"]*"\)\+"ay"\]\(\w+\),(\w+)\(\w+\[/);`,
  "    const cryptoOutbound = Hook.match(\"cryptoOutbound\", /" + WRAPPED +
    String.raw`(\w+)[(,]\w+\[\w+\(\d+,"[^"]*"\)\+"ay"\]\(\w+\),(\w+)\(\w+\[/);`
);

edit(
  "hook: fastSign accepts a wrapped frame size",
  String.raw`    Hook.replace("fastSign", /\]\((\w+),(\w+\[\w+\(\d+,"[^"]*"\)\],\w+\),\w+=new Uint8Array\(\w+\+\w+\[)/,`,
  String.raw`    Hook.replace("fastSign", /\]\((\w+),(\w+\[\w+\(\d+,"[^"]*"\)\],\w+\),\w+=new Uint8Array\(` +
    WRAPPED + String.raw`\w+[+,]\w+\[)/,`
);

/* ── gameInit ───────────────────────────────────────────────────────
 * `RYN.startGame()` fetches a captcha token and hands it to `_gameInit`, which
 * this hook is what fills in — so with it unbound, starting the game from
 * RYN's own menu does nothing at all.
 *
 * Its pattern (`function X(a){Y.Z(w,f`) was written against a 2024 shape that
 * the bundle no longer has. The function is the one the game's own play button
 * reaches: it takes the token, exchanges it for a server token and opens the
 * socket, and it opens by picking the selected server and bailing out when
 * there is none. That message is unique in the bundle and is already the
 * anchor `connectGuardRelease` uses, so this is pinned to the same site.
 * ------------------------------------------------------------------ */

edit(
  "hook: gameInit re-anchored on the connect entry",
  String.raw`    Hook.prepend("gameInit", /function (\w+)\(\w+\)\{\w+\.\w+\(\w+,f/, "RYN._gameInit=function(a){$1(a);};");`,
  String.raw`    Hook.prepend("gameInit", /function (\w+)\(\w+\)\{const \w+=[^;]{0,80};if\(!\w+&&!\w+\)\{\w+\("No servers are available right now/, "RYN._gameInit=function(a){$1(a);};");`
);

/* ── nameColor ──────────────────────────────────────────────────────
 * The clan-vs-white choice is still there and still one expression; what went
 * away is the `{color:…}` object that used to follow it. 2025 builds a list of
 * runs and labels them in one call instead, so the tail of the pattern no
 * longer exists. The part being replaced is unchanged.
 * ------------------------------------------------------------------ */

edit(
  "hook: nameColor re-anchored past the label rewrite",
  String.raw`/(\w+)=(\w+)!=(\w+)&&\2\.clan&&\2\.clan==\3\.clan&&!\(\2\.team&&\2\.team==\3\.team\),(\w+)=\1\?(\w+):"#fff",(\w+)=\{color:\4,/, "$1=$2!=$3&&$2.clan&&$2.clan==$3.clan&&!($2.team&&$2.team==$3.team),$4=RYN._Renderer._nameColor($2,$3,$1?$5:\"#fff\"),$6={color:$4,");`,
  String.raw`/(\w+)=(\w+)!=(\w+)&&\2\.clan&&\2\.clan==\3\.clan&&!\(\2\.team&&\2\.team==\3\.team\),(\w+)=\1\?(\w+):"#fff",/, "$1=$2!=$3&&$2.clan&&$2.clan==$3.clan&&!($2.team&&$2.team==$3.team),$4=RYN._Renderer._nameColor($2,$3,$1?$5:\"#fff\"),");`
);

/* ── buildingTint ───────────────────────────────────────────────────
 * Two shapes of the same site: 2024 drew a structure with a ternary, 2025 with
 * an `if`. Only one of them can ever be in a given bundle, so attempting both
 * means one is always reported as a miss. The 2025 shape is tried first and
 * the 2024 one only if it was not there.
 * ------------------------------------------------------------------ */

edit(
  "hook: buildingTint only tried when the 2025 shape is absent",
  String.raw`    Hook.replace("buildingTint", /\.isItem\?\((\w+)=(\w+)\((\w+)\),/, ".isItem?($1=RYN._Renderer._buildingSprite($2($3),$3),");
    // 2025 draws a structure with an if-statement rather than a ternary.
    Hook.replace("buildingTint2025", /\.isItem\)\{if\((\w+)=(\w+)\((\w+)\),/, ".isItem){if($1=RYN._Renderer._buildingSprite($2($3),$3),");`,
  String.raw`    // 2025 draws a structure with an if-statement rather than a ternary; the
    // 2024 ternary is only looked for when that is not what this bundle has,
    // so the one that cannot match is not reported as a miss.
    {
      const before = Hook.hookCount;
      Hook.replace("buildingTint2025", /\.isItem\)\{if\((\w+)=(\w+)\((\w+)\),/, ".isItem){if($1=RYN._Renderer._buildingSprite($2($3),$3),");
      if (Hook.hookCount === before) {
        Hook.replace("buildingTint", /\.isItem\?\((\w+)=(\w+)\((\w+)\),/, ".isItem?($1=RYN._Renderer._buildingSprite($2($3),$3),");
      }
    }`
);

/* ── RenderGrid ─────────────────────────────────────────────────────
 * The two loops that draw the grid are still two loops of `M.line()` after
 * `globalAlpha=.06`, but each one's condition grew a flag of the game's own
 * ahead of the bound check — `for(var n=…;fi&&n<oe;n+=f)` — and the pattern
 * required the condition to be the bound check alone.
 *
 * The flag is left exactly where it is: this hook's job is to take the two
 * loops out, and whatever the game gates them on goes with them.
 * ------------------------------------------------------------------ */

edit(
  "hook: RenderGrid re-anchored past the bundle's own grid flag",
  String.raw`    Hook.replace("RenderGrid", /(\.globalAlpha=\.06;const (\w+)=\w+\/18;)for\((?:var|let) (\w+)=[^;]+;\3<\w+;\3\+=\2\)\3>0&&\w+\.line\([^)]*\);for\((?:var|let) (\w+)=[^;]+;\4<\w+;\4\+=\2\)\4>0&&\w+\.line\([^)]*\);/, "$1");`,
  String.raw`    Hook.replace("RenderGrid", /(\.globalAlpha=\.06;const (\w+)=\w+\/18;)for\((?:var|let) (\w+)=[^;]+;[^;]*\3<\w+;\3\+=\2\)\3>0&&\w+\.line\([^)]*\);for\((?:var|let) (\w+)=[^;]+;[^;]*\4<\w+;\4\+=\2\)\4>0&&\w+\.line\([^)]*\);/, "$1");`
);

/* ------------------------------------------------------------------ *
 * 6. Settings for the ported Luna features
 * ------------------------------------------------------------------ */

edit(
  "settings: ReUp keys",
  `    _velocityTickTimes: 0,
  };`,
  `    _velocityTickTimes: 0,
    // ReUp Mix: ported from Luna. The rotation toggles default to on, i.e.
    // vanilla behaviour — Luna defaulted them off, and a mix should not
    // silently change how the game looks on first run.
    _spikeRotation: true,
    _millRotation: true,
    _usernameCycler: false,
    _usernameList: "Luna1, Luna2, Luna3",
    _usernameIndex: 0,
    _menuTheme: "ryn",
  };`
);

/* ------------------------------------------------------------------ *
 * 7. Object spin (Luna: "spike rotation" / "mill rotation")
 *
 * Luna gates `this.dir += this.turnSpeed * delta` in the object update on a
 * pair of toggles so spinning spikes and mills can be frozen and read at a
 * glance. RYN already rewrites that same expression for its low-quality mode,
 * so the specific object-update site is claimed first and routed through a
 * helper that honours both; the existing generic hook then only catches the
 * remaining animal turn-rate site.
 * ------------------------------------------------------------------ */

edit(
  "hook: object rotation toggles",
  `    Hook.replace("freezeTurnSpeed",`,
  `    Hook.replace("objectRotation", /(\\w+)\\.turnSpeed\\s*&&\\s*\\(\\1\\.dir\\s*\\+=\\s*\\1\\.turnSpeed\\s*\\*\\s*(\\w+)\\)/, "$1.turnSpeed&&($1.dir+=RYN._objectSpin($1,$2))");
    Hook.replace("freezeTurnSpeed",`
);

edit(
  "bridge: RYN._objectSpin",
  `    _config: {},
    version: version,`,
  `    _config: {},
    /* Per-frame rotation delta for a placed object. Group 2 is spikes and
     * group 3 is mills; the id ranges are the fallback for objects that
     * reach here before their group is resolved. */
    _objectSpin(object, delta) {
      try {
        if (Settings_default._lowQuality) return 0;
        const groupId = object.group ? object.group.id : -1;
        const id = object.id;
        const isSpike = groupId === 2 || (groupId === -1 && id > 5 && id < 10);
        const isMill = groupId === 3 || (groupId === -1 && id > 9 && id < 13);
        if (isSpike && !Settings_default._spikeRotation) return 0;
        if (isMill && !Settings_default._millRotation) return 0;
        return object.turnSpeed * delta;
      } catch (e) {
        return object.turnSpeed * delta;
      }
    },
    version: version,`
);

/* ------------------------------------------------------------------ *
 * 8. Username cycler (Luna)
 *
 * Advances the name in #nameInput through a user-supplied list every time the
 * player spawns, so consecutive lives do not share a name. Luna hangs this off
 * document-level capture listeners for Enter and the play button; same idea
 * here, wired where the rest of the client's DOM setup happens.
 * ------------------------------------------------------------------ */

edit(
  "module: username cycler",
  `  const contentLoaded = () => {
    Logger.test("Menu initialization..");`,
  `  const cycleUsername = () => {
    if (!Settings_default._usernameCycler) return;
    const names = (Settings_default._usernameList || "")
      .split(",")
      .map(n => n.trim())
      .filter(Boolean);
    if (!names.length) return;
    const index = ((Settings_default._usernameIndex || 0) + 1) % names.length;
    Settings_default._usernameIndex = index;
    const nextName = names[index];
    const nameInput = document.getElementById("nameInput");
    if (nameInput) {
      nameInput.value = nextName;
      nameInput.dispatchEvent(new Event("input", {
        bubbles: true
      }));
      nameInput.dispatchEvent(new Event("change", {
        bubbles: true
      }));
    }
    SaveSettings();
  };
  const handleSpawnForCycler = event => {
    if (!Settings_default._usernameCycler) return;
    const nameInput = document.getElementById("nameInput");
    if (!nameInput || !nameInput.offsetParent) return;
    const isEnter = event.type === "keydown" && event.code === "Enter";
    const isPlayClick = event.type === "click" && event.target && event.target.id === "enterGame";
    if (isEnter || isPlayClick) cycleUsername();
  };
  document.addEventListener("keydown", handleSpawnForCycler, true);
  document.addEventListener("click", handleSpawnForCycler, true);
  const contentLoaded = () => {
    Logger.test("Menu initialization..");`
);

/* ------------------------------------------------------------------ *
 * 9. Menu themes (Luna)
 *
 * Luna ships five accent presets behind a picker. RYN's stylesheet already
 * drives every accent off --accent / --accent2 / --border-active on :root, so
 * a theme is just an override of those three on the menu root.
 * ------------------------------------------------------------------ */

const THEMES = {
  ryn: { name: "Ryn", accent: "#7A42F4", accent2: "#3A86FF" },
  nvg: { name: "NVG", accent: "#10B981", accent2: "#34D399" },
  ice: { name: "Ice", accent: "#0EA5E9", accent2: "#38BDF8" },
  red: { name: "Red", accent: "#EF4444", accent2: "#F87171" },
  void: { name: "Void", accent: "#D946EF", accent2: "#E879F9" },
};

edit(
  "menu: theme binder",
  `        this.attachTextInputs();
        this.attachSelects();`,
  `        this.attachTextInputs();
        this.attachReUpTheme();
        this.attachSelects();`
);

edit(
  "menu: attachReUpTheme",
  `    attachTextInputs() {`,
  `    get reUpThemes() {
      return ${JSON.stringify(THEMES, null, 6).replace(/\n/g, "\n      ")};
    }
    applyReUpTheme(key) {
      const theme = this.reUpThemes[key] || this.reUpThemes.ryn;
      const doc = this.frame && this.frame.document;
      if (!doc || !doc.documentElement) return;
      const root = doc.documentElement.style;
      root.setProperty("--accent", theme.accent);
      root.setProperty("--accent2", theme.accent2);
      root.setProperty("--border-active", theme.accent + "80");
    }
    attachReUpTheme() {
      const buttons = this.querySelectorAll(".reup-theme[data-theme]");
      const paint = () => {
        for (const button of buttons) {
          button.classList.toggle("active", button.dataset.theme === Settings_default._menuTheme);
        }
      };
      for (const button of buttons) {
        const key = button.dataset.theme;
        const theme = this.reUpThemes[key];
        if (theme) button.style.setProperty("--swatch", theme.accent);
        button.onclick = () => {
          Settings_default._menuTheme = key;
          SaveSettings();
          this.applyReUpTheme(key);
          paint();
        };
      }
      paint();
      this.applyReUpTheme(Settings_default._menuTheme);
    }
    attachTextInputs() {`
);

/* ------------------------------------------------------------------ *
 * 10. Menu markup for the ported features
 *
 * The page constants are JS string literals, so decode, splice, re-encode.
 * Checkboxes and text inputs bind themselves by id off the settings object.
 * The markup follows this client's own shape: a `.section` with a
 * `.section-title` carrying a `.sec-sub`, and each row an `.opt-main` pair of
 * title and description beside its control.
 * ------------------------------------------------------------------ */

function patchPage(constName, anchorHtml, insertHtml) {
  const declaration = `const ${constName} = `;
  const start = code.indexOf(declaration);
  if (start === -1) throw new Error(`page constant not found: ${constName}`);

  const lineEnd = code.indexOf("\n", start);
  const literal = code.slice(start + declaration.length, lineEnd).replace(/;\s*$/, "");

  // eslint-disable-next-line no-eval
  const html = eval(literal);
  const hits = html.split(anchorHtml).length - 1;
  if (hits === 0) throw new Error(`page anchor not found in ${constName}`);
  if (hits > 1) throw new Error(`page anchor is ambiguous (${hits} hits) in ${constName}`);

  const patched = html.replace(anchorHtml, insertHtml + anchorHtml);
  code =
    code.slice(0, start + declaration.length) +
    JSON.stringify(patched) +
    ";" +
    code.slice(lineEnd);
  applied.push(`menu: options added to ${constName}`);
}

const themeButtons = Object.entries(THEMES)
  .map(
    ([key, theme]) =>
      `                        <button class="reup-theme" data-theme="${key}" title="${theme.name}"></button>`
  )
  .join("\n");

patchPage(
  "Misc_default",
  `    <div class="section">
        <div class="section-title">Reset`,
  `    <div class="section">
        <div class="section-title">ReUp Mix<span class="sec-sub">The Luna-only features, ported onto this core.</span></div>
        <div class="section-content">
            <div class="content-option">
                <div class="opt-main">
                    <span class="option-title">Username Cycler</span>
                    <span class="opt-desc">Takes the next name in the comma separated list every time you spawn, so consecutive lives do not share a name.</span>
                </div>
                <div class="option-content">
                    <input id="_usernameList" class="input" type="text" maxlength="120" placeholder="Name, name, name">
                    <label class="switch-checkbox"><input id="_usernameCycler" type="checkbox"><span></span></label>
                </div>
            </div>
            <div class="content-option">
                <div class="opt-main">
                    <span class="option-title">Spike Rotation</span>
                    <span class="opt-desc">Off freezes spinning spikes so their hitbox is easier to read.</span>
                </div>
                <label class="switch-checkbox"><input id="_spikeRotation" type="checkbox"><span></span></label>
            </div>
            <div class="content-option">
                <div class="opt-main">
                    <span class="option-title">Mill Rotation</span>
                    <span class="opt-desc">Off freezes windmills and power mills.</span>
                </div>
                <label class="switch-checkbox"><input id="_millRotation" type="checkbox"><span></span></label>
            </div>
            <div class="content-option">
                <div class="opt-main">
                    <span class="option-title">Menu Theme</span>
                    <span class="opt-desc">The accent colour this menu is drawn in.</span>
                </div>
                <div class="option-content reup-theme-row">
${themeButtons}
                </div>
            </div>
        </div>
    </div>

`
);

/* Styles for the theme swatch row. */
{
  const declaration = "const styles_default = ";
  const start = code.indexOf(declaration);
  if (start === -1) throw new Error("styles_default not found");
  const lineEnd = code.indexOf("\n", start);
  const literal = code.slice(start + declaration.length, lineEnd).replace(/;\s*$/, "");
  // eslint-disable-next-line no-eval
  const css = eval(literal);

  const extra = `
.reup-theme-row{display:flex;gap:8px;align-items:center;}
.reup-theme{
  width:22px;height:22px;padding:0;border-radius:50%;cursor:pointer;
  background:var(--swatch,#7A42F4);
  border:2px solid transparent;
  transition:border-color 140ms ease,transform 140ms ease;
}
.reup-theme:hover{transform:scale(1.12);}
.reup-theme.active{border-color:var(--text);}
`;

  code =
    code.slice(0, start + declaration.length) +
    JSON.stringify(css + extra) +
    ";" +
    code.slice(lineEnd);
  applied.push("menu: theme swatch styles");
}

/* ------------------------------------------------------------------ *
 * 11. Driver manifest + runtime drift check
 *
 * The tables and the transport this build carries were checked against the
 * shipped bundle (tools/verify-drivers.js, tools/check-wire.js). This records
 * what they were checked against and re-checks the parts that are observable
 * at runtime, so a change on the server side shows up as a console warning
 * rather than as packets that quietly stop being understood.
 * ------------------------------------------------------------------ */

const manifest = {
  builtAt: new Date().toISOString(),
  extractedFrom: DRIVERS.source,
  extractedAt: DRIVERS.extractedAt,
  protocol: DRIVERS.protocol,
  tableSizes: {
    itemGroups: DRIVERS.itemGroups.length,
    projectiles: DRIVERS.projectiles.length,
    weapons: DRIVERS.weapons.length,
    items: DRIVERS.items.length,
    hats: DRIVERS.hats.length,
    accessories: DRIVERS.accessories.length,
  },
};

edit(
  "drivers: manifest + runtime check",
  `  const RYN = {
    _Login: Login_default,`,
  `  /* Game drivers this build was verified against. See drivers/game-drivers.json. */
  const ReUpDrivers = ${JSON.stringify(manifest, null, 4).replace(/\n/g, "\n  ")};
  ReUpDrivers.check = () => {
    const problems = [];
    const p = ReUpDrivers.protocol;
    const say = problem => problems.push(problem);
    try {
      const enc = win.RYN && win.RYN._enc;
      if (enc && enc.jt !== undefined && enc.jt !== null && enc.jt !== p.signatureBytes) {
        say(\`frame signature is \${enc.jt} bytes, expected \${p.signatureBytes}\`);
      }
      const crypto = client && client._gameCrypto;
      if (crypto && crypto.mode !== undefined && crypto.mode !== p.encryptedMode) {
        say(\`transport mode is \${crypto.mode}, expected \${p.encryptedMode}\`);
      }
      if (crypto && crypto.tables && crypto.tables.c2s && crypto.tables.c2s.enc) {
        const live = Object.keys(crypto.tables.c2s.enc).length;
        const want = crypto.mask ? p.c2sAlphabet.length : p.c2sLegacyCount;
        if (live !== want) say(\`c2s opcode table has \${live} entries, expected \${want}\`);
      }
      /* The key mixer is pinned to a build id. RynWire carries a copy of this
       * build's mixer to fall back on, and that copy is only right for this
       * build, so a server running a different one has to be said out loud. */
      const proto = win.RYN && win.RYN._modules && win.RYN._modules["moomoo-protocol"];
      const live = proto && proto.BUILD_ID;
      if (live && live !== p.keyMixer.buildId) {
        say(
          \`the game is build "\${live}", not the "\${p.keyMixer.buildId}" this was verified \` +
          "against; the built-in key mixer is for the latter, so bots will only connect " +
          "while the game's own moomoo-protocol module is reachable"
        );
      }
    } catch (e) {}
    if (problems.length) {
      try {
        console.warn("[ReUp] drift from the bundle this build was verified against:");
        for (const problem of problems) console.warn("  " + problem);
      } catch (_) {}
    }
    return problems;
  };
  const RYN = {
    _Login: Login_default,
    _drivers: ReUpDrivers,`
);

edit(
  "drivers: run the check once the game is up",
  `  resetGame_default(loadedFast);`,
  `  setTimeout(() => {
    try {
      ReUpDrivers.check();
    } catch (e) {}
  }, 15e3);
  resetGame_default(loadedFast);`
);

/* ------------------------------------------------------------------ */

fs.writeFileSync(OUT, code);

console.log("built", path.relative(ROOT, OUT));
console.log(`  from ${path.relative(ROOT, BASE)}`);
console.log(`  ${(code.length / 1024).toFixed(0)} KB, ${code.split("\n").length} lines\n`);
for (const step of applied) console.log("  + " + step);
