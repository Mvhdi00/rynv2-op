/*
 * repairs.js
 *
 * What Ryn Type 2 needs to work against the game bundle it actually has to run
 * on. Nothing in here is a feature or a preference: every edit fixes something
 * the shipped assets broke, and each one has a verifier that fails without it.
 *
 *   tools/check-hooks.js   the bundle-rewrite hooks, against the bundle as served
 *   tools/check-wire.js    the client's transport, against the game's own functions
 *
 * Applied by tools/fix-ryn.js on its own, and by tools/build-reup.js ahead of
 * the Luna ports.
 */

/* `(?:\w+\[[^\]]*\]\()?(\w+)[(,]` — a call to a function worth naming, written
 * either plainly or through one of the obfuscator's wrappers.
 *
 * The obfuscator rewrites the shape of a call at random per build: `hl(B,Ad)`
 * in one and `o["tU&W"](hl,B,Ad)` in the next. A pattern pinned to either one
 * misses the other, so the wrapper prefix is optional and the separator after
 * the function's name is `(` or `,`. */
const WRAPPED = String.raw`(?:\w+\[[^\]]*\]\()?`;

/*
 * The repairs, in groups, so a base that has absorbed some of them upstream can
 * take only the ones it still needs. Ryn Type 2 2.9.4 fixed the crypto hooks,
 * nameColor, RenderGrid and learn() itself, and still needs the bot devices.
 */
const GROUPS = { transport, hooks, bots, turnstile, joins, clan };

/*
 * Apply the named groups to `editor` (tools/edits.js), using `drivers`
 * (drivers/game-drivers.json) for the key mixer. All groups by default.
 */
function apply(editor, drivers, groups = Object.keys(GROUPS)) {
  for (const name of groups) {
    if (!GROUPS[name]) throw new Error("no repair group named " + name);
    GROUPS[name](editor, drivers);
  }
}

function transport(editor, drivers) {
  const edit = (label, find, replace) => editor.edit(label, find, replace);
  const MIXER = drivers.protocol.keyMixer;

  /* ------------------------------------------------------------------ *
   * 1. The protocol constants the client reads off the bundle
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
   * so all three fall back to the values written into the class. They happen
   * to be right today, which is the problem: nothing says when they stop
   * being. Each is read from the code that uses it instead —
   *
   *     mode   the const the alphabet declaration opens with
   *     sig    the offset the payload is written at, after the signature at 0
   *     salt   the branch the alphabet slice is gated on
   *
   * — and a value that cannot be found is reported rather than quietly
   * assumed.
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
    // The bundle's protocol constants, each from the code that uses it: the
    // single anchor this used to have expects them declared in one run ahead
    // of the c2s alphabet, and the shipped bundle splits them in two.
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
                "[RYN] could not read " + missed.join(", ") + " off the game bundle; " +
                "using the values this build was verified against"
              );
            } catch (_) {}
          }`
  );

  /* ------------------------------------------------------------------ *
   * 2. A key mixer to fall back on
   *
   * On a pinned connection the server's key is run through mixKey before
   * anything is signed with it, so a client that cannot mix cannot talk. RYN
   * takes mixKey from the game's own `moomoo-protocol` module, captured where
   * the injector imports it, and has nothing to fall back on: on a build where
   * that capture misses, every bot gets an unmixed key and every frame it
   * sends is rejected.
   *
   * The mixer is one WebAssembly function with no control flow, so it is
   * written out here in JavaScript from drivers/game-drivers.json. The
   * disassembly it comes from is checked against the module itself during
   * extraction (tools/extract-drivers.js), and the result is checked against
   * the module again by tools/check-wire.js, so it cannot drift from the real
   * thing without a verifier saying so.
   *
   * It is a fallback, not a replacement: the module's own export is still
   * preferred wherever it can be had.
   * ------------------------------------------------------------------ */

  edit(
    "wire: a key mixer to fall back on",
    `    sign(key, data) {
      return RynSign.signAlone(key, data, this.sigBytes);
    }`,
    `    sign(key, data) {
      return RynSign.signAlone(key, data, this.sigBytes);
    }
    /* The build the mixer below was taken from. A server running a different
     * one mixes differently, so the fallback is only good for this one. */
    mixerBuildId=${JSON.stringify(MIXER.buildId)};
    /* One byte of the mixer's stream, as the module's WebAssembly computes it
     * (see drivers/game-drivers.json). 32-bit wrapping throughout. */
    _mixByte(seed, i) {
      let x;
      ${MIXER.byteJs.join(";\n      ")};
    }
    /* mixKey(key, seed), for a session that could not get hold of the
     * protocol module's own export. */
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
        : fn(g.mixKey, (key, seed) => {
            /* RynWire's mixer is pinned to one build. If the bundle says it is
             * serving another, say so: the frames will be rejected and the
             * reason is worth knowing. */
            if (g.buildId != null && g.buildId !== RynWire.mixerBuildId) {
              try {
                console.warn(
                  '[RYN] the game is build "' + g.buildId + '", not the "' + RynWire.mixerBuildId +
                  '" the built-in key mixer is for, and the game\\'s own moomoo-protocol ' +
                  "module could not be reached — bot connections will be refused"
                );
              } catch (_) {}
            }
            return RynWire.mixKey(key, seed);
          }),
      salt: proto && proto.BUILD_SALT != null
        ? proto.BUILD_SALT
        : g.salt != null ? g.salt : ${JSON.stringify(MIXER.buildSalt)},
      buildId: proto && proto.BUILD_ID != null
        ? proto.BUILD_ID
        : g.buildId != null ? g.buildId : ${JSON.stringify(MIXER.buildId)},`
  );

}

function hooks(editor) {
  const edit = (label, find, replace) => editor.edit(label, find, replace);

  /* ------------------------------------------------------------------ *
   * 3. The four hooks that name the transport, and fastSign
   *
   * These are what fill in `RYN._enc`: the game's own signing function, hex
   * reader, table builder, mask splitter, keystream, mixKey and BUILD_SALT,
   * for RYN's own sockets to use. All four miss on the shipped bundle, for the
   * reason the client's own comment predicts — see WRAPPED above.
   *
   * With them unbound, bots fall back to RynWire for everything and to
   * capturing the moomoo-protocol module for mixKey alone: one capture away
   * from no bot being able to join at all.
   * ------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------ *
   * 4. gameInit — the hook that stopped the game starting
   *
   * `RYN.startGame()` fetches a captcha token and hands it to `_gameInit`,
   * which this hook is what fills in — so with it unbound, starting the game
   * from RYN's own menu does nothing at all.
   *
   * Its pattern (`function X(a){Y.Z(w,f`) was written against a 2024 shape the
   * bundle no longer has. The function is the one the game's own play button
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

  /* ------------------------------------------------------------------ *
   * 5. nameColor
   *
   * The clan-vs-white choice is still there and still one expression; what
   * went away is the `{color:…}` object that used to follow it. 2025 builds a
   * list of runs and labels them in one call instead, so the tail of the
   * pattern no longer exists. The part being replaced is unchanged.
   * ------------------------------------------------------------------ */

  edit(
    "hook: nameColor re-anchored past the label rewrite",
    String.raw`/(\w+)=(\w+)!=(\w+)&&\2\.clan&&\2\.clan==\3\.clan&&!\(\2\.team&&\2\.team==\3\.team\),(\w+)=\1\?(\w+):"#fff",(\w+)=\{color:\4,/, "$1=$2!=$3&&$2.clan&&$2.clan==$3.clan&&!($2.team&&$2.team==$3.team),$4=RYN._Renderer._nameColor($2,$3,$1?$5:\"#fff\"),$6={color:$4,");`,
    String.raw`/(\w+)=(\w+)!=(\w+)&&\2\.clan&&\2\.clan==\3\.clan&&!\(\2\.team&&\2\.team==\3\.team\),(\w+)=\1\?(\w+):"#fff",/, "$1=$2!=$3&&$2.clan&&$2.clan==$3.clan&&!($2.team&&$2.team==$3.team),$4=RYN._Renderer._nameColor($2,$3,$1?$5:\"#fff\"),");`
  );

  /* ------------------------------------------------------------------ *
   * 6. buildingTint
   *
   * Two shapes of the same site: 2024 drew a structure with a ternary, 2025
   * with an `if`. Only one of them can ever be in a given bundle, so
   * attempting both means one is always reported as a miss.
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

  /* ------------------------------------------------------------------ *
   * 7. RenderGrid — the hook that was deleting the wrong code
   *
   * The two loops that draw the grid are still two loops of `M.line()` after
   * `globalAlpha=.06`, but each one's condition grew a flag of the game's own
   * ahead of the bound check — `for(var n=…;fi&&n<oe;n+=f)` — and the pattern
   * required the condition to be the bound check alone. The old pattern
   * matched 924 characters of this bundle; this one removes 116, which is the
   * two loops exactly (tools/check-hooks.js --diff RenderGrid).
   *
   * The flag is left where it is: this hook's job is to take the two loops
   * out, and whatever the game gates them on goes with them.
   * ------------------------------------------------------------------ */

  edit(
    "hook: RenderGrid re-anchored past the bundle's own grid flag",
    String.raw`    Hook.replace("RenderGrid", /(\.globalAlpha=\.06;const (\w+)=\w+\/18;)for\((?:var|let) (\w+)=[^;]+;\3<\w+;\3\+=\2\)\3>0&&\w+\.line\([^)]*\);for\((?:var|let) (\w+)=[^;]+;\4<\w+;\4\+=\2\)\4>0&&\w+\.line\([^)]*\);/, "$1");`,
    String.raw`    Hook.replace("RenderGrid", /(\.globalAlpha=\.06;const (\w+)=\w+\/18;)for\((?:var|let) (\w+)=[^;]+;[^;]*\3<\w+;\3\+=\2\)\3>0&&\w+\.line\([^)]*\);for\((?:var|let) (\w+)=[^;]+;[^;]*\4<\w+;\4\+=\2\)\4>0&&\w+\.line\([^)]*\);/, "$1");`
  );
}


/* ------------------------------------------------------------------ *
 * Bots get their own device
 *
 * The join API (`POST <api>/join`) takes a device id, `did`, that it hands a
 * browser on its first join and expects back on every later one; the game
 * keeps its own in localStorage as `moo_did`. Ryn Type 2 2.9.4's
 * RynBotDevices says each bot is its own device and none is ever yours — and
 * then does the opposite: take() returns your `moo_did` for every bot, keep()
 * writes a bot's id into your `moo_did` when you have none yet, release() does
 * nothing, and the pool it declares (`_ryn_bot_dids`, `inUse`) is never used.
 *
 * So to the server every bot was you. Signed in, that device is a member's
 * that is already connected, and no bot gets in; as a guest, the one device
 * gets one extra seat, and one bot gets in.
 *
 * Here each bot draws its own id from a pool of ids the API has issued to
 * bots, or sends none and keeps the one the API issues. Yours is never sent,
 * never written, and never pooled.
 * ------------------------------------------------------------------ */

function bots(editor) {
  const edit = (label, find, replace) => editor.edit(label, find, replace);

  edit(
    "bots: a device pool of their own, never yours",
    `  const RYN_BOT_DIDS_KEY = "_ryn_bot_dids";
  const RynBotDevices = {
    inUse: new Set,
    _load() {
      try {
        const list = JSON.parse(localStorage.getItem(RYN_BOT_DIDS_KEY) || "[]");
        return Array.isArray(list) ? list.filter(d => typeof d === "string" && d) : [];
      } catch (_) {
        return [];
      }
    },
    // The id the game itself joins with (moo_did), as the game and Glotus
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
    release(did) {}
  };`,
    `  const RYN_BOT_DIDS_KEY = "_ryn_bot_dids";
  // Ids remembered for bots. A fleet is at most RYN_FLEET_CAP (40); the rest
  // is room for ids the API has replaced.
  const RYN_BOT_DIDS_MAX = 64;
  const RynBotDevices = {
    // Ids a bot is joining or connected with right now. Two bots never hold
    // the same one.
    inUse: new Set,
    // Yours: read so it can be kept out, never sent and never written.
    _own() {
      try {
        const own = localStorage.getItem("moo_did");
        return typeof own === "string" && own ? own : null;
      } catch (_) {
        return null;
      }
    },
    _load() {
      const own = this._own();
      try {
        const list = JSON.parse(localStorage.getItem(RYN_BOT_DIDS_KEY) || "[]");
        return Array.isArray(list) ? list.filter(d => typeof d === "string" && d && d !== own) : [];
      } catch (_) {
        return [];
      }
    },
    _save(list) {
      try {
        localStorage.setItem(RYN_BOT_DIDS_KEY, JSON.stringify(list.slice(-RYN_BOT_DIDS_MAX)));
      } catch (_) {}
    },
    // An id a bot had before and nobody is using now, or null: the API then
    // issues this bot a device of its own, and keep() remembers it.
    take() {
      for (const did of this._load()) {
        if (!this.inUse.has(did)) {
          this.inUse.add(did);
          return did;
        }
      }
      return null;
    },
    // The id the API gave this bot: remembered for bots, and held by this one.
    keep(did) {
      if (typeof did !== "string" || !did || did === this._own()) return;
      const list = this._load().filter(d => d !== did);
      list.push(did);
      this._save(list);
      this.inUse.add(did);
    },
    // The API answered with a different id: the old one will not be taken
    // again, so it is forgotten rather than handed to the next bot.
    retire(did) {
      if (typeof did !== "string" || !did) return;
      this.inUse.delete(did);
      this._save(this._load().filter(d => d !== did));
    },
    release(did) {
      if (did) this.inUse.delete(did);
    }
  };`
  );

  edit(
    "bots: a bot's join never carries your session",
    `    return fetch(RYN_API_BASE + "/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },`,
    `    return fetch(RYN_API_BASE + "/join", {
      method: "POST",
      // The API is another origin, so no cookie goes with this anyway; said
      // here so a bot's join can never carry your session.
      credentials: "omit",
      headers: {
        "Content-Type": "application/json"
      },`
  );

  /* createSocket takes an id and has a dozen ways out before the socket that
   * releases it on close exists — a cancelled check, a refusal, a throw. Each
   * of those used to leave the id held for the rest of the page. The body now
   * records the id on a lease, and a wrapper gives it back on any way out the
   * socket did not take over. */
  edit(
    "bots: createSocket records its device on a lease",
    `  const createSocket = async (href, fresh = false, label = "Bot", att = null) => {`,
    `  const createSocketWith = async (lease, href, fresh = false, label = "Bot", att = null) => {`
  );

  edit(
    "bots: the lease holds the device the bot took",
    `        did = RynBotDevices.take();
        let joined = await rynJoinTicket(host, token.slice(3), did);`,
    `        did = lease.did = RynBotDevices.take();
        let joined = await rynJoinTicket(host, token.slice(3), did);`
  );

  edit(
    "bots: a replaced device is retired, not reused",
    `        if (joined.did && joined.did !== did) {
          RynBotDevices.release(did);
          did = joined.did;
          RynBotDevices.keep(did);
        }`,
    `        if (joined.did && joined.did !== did) {
          RynBotDevices.retire(did);
          did = lease.did = joined.did;
          RynBotDevices.keep(did);
        }`
  );

  edit(
    "bots: the socket takes the device over",
    `    // The bot's device id is its own until this socket closes.
    if (did) {
      ws._rynDid = did;
      ws.addEventListener("close", () => RynBotDevices.release(did));
    }
    return ws;
  };
  const createSocket_default = createSocket;`,
    `    // The bot's device id is its own until this socket closes.
    if (did) {
      ws._rynDid = did;
      ws.addEventListener("close", () => RynBotDevices.release(did));
    }
    lease.held = true;
    return ws;
  };
  const createSocket = async (href, fresh = false, label = "Bot", att = null) => {
    const lease = {
      did: null,
      held: false
    };
    try {
      return await createSocketWith(lease, href, fresh, label, att);
    } catch (e) {
      if (!lease.held) RynBotDevices.release(lease.did);
      throw e;
    }
  };
  const createSocket_default = createSocket;`
  );
}

/* ------------------------------------------------------------------ *
 * Cloudflare's check for bots, when the page's `window.turnstile` is dead
 *
 * A guest bot needs a Cloudflare Turnstile token for /join. RYN mints one
 * with Cloudflare's `turnstile` API, and gives up with "Cloudflare's script
 * loaded, but its check never became available" when that global never
 * appears — the error a signed-in player gets on every bot.
 *
 * RYN itself puts a getter/setter on `window.turnstile` (to tell the page's
 * own copy of the game "no" when it renders), so the property exists, holding
 * `undefined`, before Cloudflare's script runs. A copy of Cloudflare's script
 * that sees a `turnstile` property already there takes itself for a second
 * copy and never publishes its API — so whether the API ever appears comes
 * down to whether Cloudflare's script ran before or after RYN's trap.
 *
 * When RYN loads its own copy it now: clears a `turnstile` slot that holds no
 * API, asks Cloudflare to call it back once the API is published (the
 * documented `onload` parameter) instead of guessing with a 4-second timer,
 * puts its trap back around the API it got, and — if it still gets nothing —
 * says what it saw, so the next screenshot names the cause.
 * ------------------------------------------------------------------ */

function turnstile(editor) {
  const edit = (label, find, replace) => editor.edit(label, find, replace);

  edit(
    "turnstile: a way for RynCF to hand the API back to RYN's trap",
    `  let rynGameSitekey = null;`,
    `  let rynGameSitekey = null;
  // Set by RYN's trap on window.turnstile once it is installed: puts the trap
  // back around an API RynCF's own copy of Cloudflare's script published.
  let rynTurnstileAdopt = null;
  // What occupies window.turnstile right now, for saying why a check failed.
  const rynTurnstileSlot = () => {
    try {
      const d = Object.getOwnPropertyDescriptor(window, "turnstile");
      if (!d) return "none";
      const v = d.get ? d.get.call(window) : d.value;
      return (d.get ? "trap" : "value") + ":" + (v && typeof v.render === "function" ? "api" : typeof v);
    } catch (_) {
      return "unreadable";
    }
  };
  let rynTurnstileReadySeq = 0;`
  );

  edit(
    "turnstile: RYN's own copy clears a dead slot and waits on Cloudflare's onload",
    `        const putOwn = () => {
          if (done || this.api()) return;
          try {
            own = document.createElement("script");
            own.src = RYN_TS_SRC + "?render=explicit";`,
    `        let slotBefore = "unseen";
        let cleared = false;
        let calledBack = false;
        const why = () => "copies of Cloudflare's script on the page: " + this.scripts().length +
          ", window.turnstile before: " + slotBefore + ", now: " + rynTurnstileSlot() +
          ", Cloudflare's onload: " + (calledBack ? "called" : "never called");
        const putOwn = () => {
          if (done || this.api()) return;
          /* A turnstile property holding no API is a slot nothing will fill:
           * Cloudflare's script finds it and takes itself for a duplicate.
           * Cleared so this copy publishes; the trap is put back around what
           * it publishes (rynTurnstileAdopt). */
          slotBefore = rynTurnstileSlot();
          if (slotBefore !== "none") {
            try {
              cleared = delete window.turnstile;
            } catch (_) {}
          }
          const ready = "__rynTurnstileReady" + ++rynTurnstileReadySeq;
          window[ready] = () => {
            calledBack = true;
            const api = this.api();
            if (api) finish(null, api);
          };
          timers.push({
            clear: () => {
              try {
                delete window[ready];
              } catch (_) {}
            }
          });
          try {
            own = document.createElement("script");
            own.src = RYN_TS_SRC + "?render=explicit&onload=" + ready;`
  );

  edit(
    "turnstile: a failed check says what it saw",
    `            own.addEventListener("load", () => {
              timers.push(setTimeout(() => {
                if (!this.api()) finish(new Error("Cloudflare's script loaded, but its check never became available"));
              }, 4e3));
            }, {`,
    `            own.addEventListener("load", () => {
              timers.push(setTimeout(() => {
                if (!this.api()) finish(new Error("Cloudflare's script loaded, but its check never became available (" + why() + ")"));
              }, 8e3));
            }, {`
  );

  edit(
    "turnstile: the trap goes back around the API RYN's copy published",
    `        const finish = (error, api) => {
          if (done) return;
          done = true;
          timers.forEach(t => clearTimeout(t) || clearInterval(t));`,
    `        const finish = (error, api) => {
          if (done) return;
          done = true;
          timers.forEach(t => t && typeof t.clear === "function" ? t.clear() : clearTimeout(t) || clearInterval(t));
          if (!error && cleared && typeof rynTurnstileAdopt === "function") {
            try {
              rynTurnstileAdopt(api);
            } catch (_) {}
          }`
  );

  edit(
    "turnstile: RYN's trap never loses the API, and can take one back",
    `    try {
      let turnstileApi = win.turnstile;
      Object.defineProperty(win, "turnstile", {
        configurable: true,
        enumerable: true,
        get() {
          return turnstileApi;
        },
        set(api) {
          turnstileApi = wrapTurnstile(api);
        }
      });
      wrapTurnstile(turnstileApi);
    } catch (e) {}`,
    `    try {
      let turnstileApi = win.turnstile;
      const trap = {
        configurable: true,
        enumerable: true,
        get() {
          return turnstileApi;
        },
        set(api) {
          // Kept whatever the wrap does: a wrap that fails must not cost the
          // page its Cloudflare API.
          turnstileApi = api;
          try {
            turnstileApi = wrapTurnstile(api) || api;
          } catch (e) {}
        }
      };
      Object.defineProperty(win, "turnstile", trap);
      try {
        wrapTurnstile(turnstileApi);
      } catch (e) {}
      // RynCF clears this slot when Cloudflare's script will not fill it, and
      // hands back the API its own copy then published.
      rynTurnstileAdopt = api => {
        turnstileApi = api;
        try {
          turnstileApi = wrapTurnstile(api) || api;
        } catch (e) {}
        Object.defineProperty(win, "turnstile", trap);
      };
    } catch (e) {}`
  );
}

/* ------------------------------------------------------------------ *
 * Joins: queued and paced, so a 429 is waited out instead of failing
 *
 * The join API counts /join requests per address, and every bot comes from
 * the same one. 2.9.4 sends each bot's /join the moment its token is ready, so
 * a fleet is a burst; past the API's limit each answer is a 429, and the bot
 * retries twice (3 s, then 6 s, a fresh Cloudflare check each time) and gives
 * up with "Too many joins from your address right now — wait a little and add
 * the bot again." The bots that failed are exactly the ones you then have to
 * add by hand.
 *
 * Now every bot's /join goes through one queue, RynJoinGate. While the API
 * takes them it lets three through at once, as fast as they come, so a fleet
 * that is under the limit joins as quickly as before. The first 429 drops it
 * to one at a time and holds the next start back: the API's Retry-After if
 * the browser is allowed to read it, otherwise 2.5 s doubling to 30 s. Joins
 * that go through shorten the wait again and, three in a row, open another
 * lane. A bot that meets a 429 keeps its device and its place, takes a new
 * token (the pool's first) and queues again, for up to five minutes, so it is
 * the queue that waits and not you.
 *
 * The limit is the server's: nothing here gets more joins through than it
 * allows, it only stops spending tokens against it and giving up.
 * ------------------------------------------------------------------ */

function joins(editor) {
  const edit = (label, find, replace) => editor.edit(label, find, replace);

  edit(
    "joins: a 429 says how long the API asked to wait, when it says",
    `      if (response.status === 403 || response.status === 429) {
        return response.json().catch(() => ({})).then(body => ({
          ticket: null,
          error: response.status === 429 ? "busy" : body && body.error === "auth" ? "members" : body && body.error === "vpn" ? "vpn" : "refused"
        }));
      }`,
    `      if (response.status === 403 || response.status === 429) {
        return response.json().catch(() => ({})).then(body => ({
          ticket: null,
          error: response.status === 429 ? "busy" : body && body.error === "auth" ? "members" : body && body.error === "vpn" ? "vpn" : "refused",
          retryAfterMs: response.status === 429 ? rynRetryAfterMs(response, body) : 0
        }));
      }`
  );

  edit(
    "joins: the queue every bot's /join goes through",
    `    }, () => ({
      ticket: null,
      error: "network"
    }));
  };
  /* A device id for each bot, the way the game keeps one for you.`,
    `    }, () => ({
      ticket: null,
      error: "network"
    }));
  };
  /* How long a 429 asked to wait, in ms, or 0. Retry-After is only readable
   * if the API exposes it to this origin; a body that names a wait is read
   * too. Seconds or an HTTP date, as the header allows. */
  const rynRetryAfterMs = (response, body) => {
    let raw = null;
    try {
      raw = response.headers && typeof response.headers.get === "function" ? response.headers.get("Retry-After") : null;
    } catch (_) {}
    if (raw === null && body && typeof body === "object") {
      raw = body.retryAfter ?? body.retry_after ?? body.wait ?? null;
    }
    if (raw === null || raw === void 0 || raw === "") return 0;
    const secs = Number(raw);
    if (Number.isFinite(secs)) return Math.max(0, Math.min(RYN_JOIN_BUSY_WAIT_MAX_MS, secs * 1e3));
    const at = Date.parse(String(raw));
    return Number.isFinite(at) ? Math.max(0, Math.min(RYN_JOIN_BUSY_WAIT_MAX_MS, at - Date.now())) : 0;
  };
  /* Every bot's /join, through one queue (see tools/repairs.js, "joins"):
   * up to RYN_JOIN_LANES at once while the API takes them; after a 429, one at
   * a time, each start held back until the API's wait is over. */
  const RYN_JOIN_LANES = 3;
  const RYN_JOIN_GAP_MIN_MS = 120;
  const RYN_JOIN_GAP_MAX_MS = 12e3;
  const RYN_JOIN_BUSY_WAIT_MS = 2500;
  const RYN_JOIN_BUSY_WAIT_MAX_MS = 30e3;
  // A bot stops queueing after this long of nothing but 429s.
  const RYN_JOIN_GIVE_UP_MS = 5 * 60e3;
  // A token that waited this long in the queue may have expired by the time
  // it is offered; a "refused" for one of those gets one new token.
  const RYN_JOIN_STALE_MS = 60e3;
  const RynJoinGate = {
    lanes: RYN_JOIN_LANES,
    inFlight: 0,
    gap: RYN_JOIN_GAP_MIN_MS,
    nextAt: 0,
    streak: 0,
    wins: 0,
    queue: [],
    timer: null,
    // How long until the next /join may start.
    waitMs() {
      return Math.max(0, this.nextAt - Date.now());
    },
    // \`fn\` sends one /join and resolves with rynJoinTicket's answer, which
    // comes back with \`queuedMs\` (how long it waited for its turn) added.
    // \`onWait(ms)\` is told whenever the queue is holding it back.
    run(fn, onWait) {
      return new Promise((resolve, reject) => {
        this.queue.push({
          fn: fn,
          onWait: onWait,
          at: Date.now(),
          resolve: resolve,
          reject: reject
        });
        this._pump();
      });
    },
    _pump() {
      if (this.timer !== null) return;
      while (this.queue.length > 0 && this.inFlight < this.lanes) {
        const wait = this.waitMs();
        if (wait > 0) {
          for (const job of this.queue) {
            try {
              if (job.onWait) job.onWait(wait);
            } catch (_) {}
          }
          this.timer = setTimeout(() => {
            this.timer = null;
            this._pump();
          }, wait);
          return;
        }
        const job = this.queue.shift();
        const sentAt = Date.now();
        this.inFlight++;
        this.nextAt = sentAt + this.gap;
        Promise.resolve().then(job.fn).then(answer => {
          this.inFlight--;
          if (answer && typeof answer === "object") answer.queuedMs = sentAt - job.at;
          this._note(answer);
          job.resolve(answer);
          this._pump();
        }, error => {
          this.inFlight--;
          job.reject(error);
          this._pump();
        });
      }
    },
    _note(answer) {
      const now = Date.now();
      if (answer && answer.error === "busy") {
        this.streak++;
        this.wins = 0;
        this.lanes = 1;
        this.gap = Math.min(RYN_JOIN_GAP_MAX_MS, Math.max(this.gap * 2, 1e3));
        const backoff = Math.min(RYN_JOIN_BUSY_WAIT_MAX_MS, RYN_JOIN_BUSY_WAIT_MS * Math.pow(2, this.streak - 1));
        this.nextAt = Math.max(this.nextAt, now + Math.max(backoff, answer.retryAfterMs || 0));
      } else if (answer && answer.ticket) {
        this.streak = 0;
        this.gap = Math.max(RYN_JOIN_GAP_MIN_MS, Math.round(this.gap * .7));
        if (++this.wins >= 3 && this.lanes < RYN_JOIN_LANES) {
          this.lanes++;
          this.wins = 0;
        }
      }
    }
  };
  /* A device id for each bot, the way the game keeps one for you.`
  );

  edit(
    "joins: a bot that meets a 429 queues again instead of failing",
    `        did = lease.did = RynBotDevices.take();
        let joined = await rynJoinTicket(host, token.slice(3), did);
        stop();
        // Too many joins at once: wait, and offer a new token (one that has
        // been offered is spent, whatever the answer was).
        for (let retry = 1; joined.error === "busy" && retry <= 2; retry++) {
          say("Too many joins from your address — trying again in " + 3 * retry + " s…");
          if (!att) rynBotNotice("Too many joins from your address — trying again in " + 3 * retry + " s");
          await new Promise(resolve => setTimeout(resolve, 3e3 * retry));
          stop();
          let again = null;
          try {
            again = await generateTurnstileToken({
              label: label,
              attempt: att
            });
          } catch (_) {}
          stop();
          if (!again) break;
          say("Joining " + (server && server.name ? server.name : host) + "…");
          joined = await rynJoinTicket(host, again, did);
          stop();
        }`,
    `        did = lease.did = RynBotDevices.take();
        const where = server && server.name ? server.name : host;
        // Through the queue (RynJoinGate), which spaces the fleet's joins the
        // way the API has been taking them.
        const ask = captcha => RynJoinGate.run(() => {
          stop();
          say("Joining " + where + "…");
          return rynJoinTicket(host, captcha, did);
        }, wait => say("Waiting for the join API — " + Math.max(1, Math.ceil(wait / 1e3)) + " s…"));
        let joined = await ask(token.slice(3));
        stop();
        /* Over the API's limit for your address (429): the queue has already
         * held the next start back. This bot keeps its device and queues
         * again with a new token (one that was offered is spent, whatever the
         * answer was), until it is in, refused for another reason, cancelled,
         * or RYN_JOIN_GIVE_UP_MS of nothing but 429s. A token that waited in
         * the queue long enough to expire comes back "refused"; that gets one
         * new token too. */
        const queuedSince = Date.now();
        let renewed = false;
        for (let tries = 2; ; tries++) {
          const busy = joined.error === "busy" && Date.now() - queuedSince < RYN_JOIN_GIVE_UP_MS;
          const stale = !renewed && joined.error === "refused" && joined.queuedMs > RYN_JOIN_STALE_MS;
          if (!busy && !stale) break;
          if (stale) renewed = true;
          if (busy) say("The join API is pacing your address — queued for try " + tries + "…");
          let again = TokenPool.take();
          if (again === null) {
            try {
              again = await generateTurnstileToken({
                label: label,
                attempt: att
              });
            } catch (_) {}
          }
          stop();
          if (!again) break;
          joined = await ask(again);
          stop();
        }`
  );

  edit(
    "joins: what a bot says when five minutes of 429s were not enough",
    `    busy: "Too many joins from your address right now — wait a little and add the bot again.",`,
    `    busy: "The join API kept turning away joins from your address for five minutes — add the bot again later.",`
  );
}

/* ------------------------------------------------------------------ *
 * Clan joins: every bot in, and Re-check keeps at it
 *
 * Most of the fleet got into your clan and a few never did, for three
 * reasons in the client:
 *
 *   - The leader's AutoAccept empties its list of join requests whenever the
 *     clan changes. A bot that asked before the leader's tick had seen the new
 *     clan had its request thrown away unanswered — and a request the server
 *     still holds is one the bot's later asks cannot get past.
 *   - AutoAccept declines (clanRequest(id, false)) any request it does not
 *     recognise as the fleet's while it is expecting fleet joins, and it
 *     recognised a bot only by RynAllegiance or clientIDList, never by the
 *     pendingJoins the queue had just put the bot's id in. A bot not yet in
 *     those lists was turned away, every time it asked.
 *   - Only a candidate's own tick could send its request, so a candidate
 *     whose tick had stopped held the whole queue; and a slow answer (1.4 s
 *     was all it got) cost it 6 s more.
 *
 * Now a fleet bot's request is never thrown away or declined; when a bot's
 * request is not answered in 2.5 s, the leader (when it is you or one of the
 * bots) answers it again, which clears a request the server is still holding;
 * any bot's tick sends for the bot whose turn it is; and a bot still outside
 * is asked again every ~2 s, for as long as it is outside. "Re-check clan
 * joins" goes further: for two minutes the bots still outside are tried back
 * to back — the leader answers, the bot asks, again — until each one is in.
 *
 * A leader who is somebody else cannot be answered for: the bots' requests
 * wait on that player.
 * ------------------------------------------------------------------ */

function clan(editor) {
  const edit = (label, find, replace) => editor.edit(label, find, replace);

  edit(
    "clan: answers that come late still count, and a bot outside is asked again every 2 s",
    `  const CLAN_JOIN_CONFIRM_MS = 1400;
  const CLAN_PACKET_GAP_MS = 450;
  const CLAN_RETRY_BACKOFF_MS = 6000;
  const CLAN_AUDIT_INTERVAL_MS = 5000;
`,
    `  const CLAN_JOIN_CONFIRM_MS = 2500;
  const CLAN_PACKET_GAP_MS = 450;
  const CLAN_RETRY_BACKOFF_MS = 2000;
  const CLAN_AUDIT_INTERVAL_MS = 2000;
  // Re-check clan joins: how long the bots still outside are tried back to back.
  const CLAN_INSIST_MS = 120e3;

  // One of this fleet's players: you, a bot, or a bot the queue has just sent
  // a request for. Whichever connection is asking, the fleet is the owner's.
  function clanIsFleet(c, id) {
    if (id === null || id === void 0 || !c) return false;
    try {
      if (RynAllegiance.isFriendlyID(c, id)) return true;
    } catch (_) {}
    if (c.clientIDList && c.clientIDList.has(id)) return true;
    if (c.pendingJoins && c.pendingJoins.has(id)) return true;
    const owner = c.ownerClient || c;
    if (owner.pendingJoins && owner.pendingJoins.has(id)) return true;
    if (owner.myPlayer && owner.myPlayer.id === id) return true;
    for (const b of owner.clients || []) {
      if (b && b.myPlayer && b.myPlayer.id === id) return true;
    }
    return false;
  }

  // The leader answers this bot's request, whether or not its client still
  // has it listed: a request it lost is still waiting on the server, and the
  // bot's next ask cannot get past it. With nothing waiting, the server
  // ignores the answer. Only when the leader is one of ours.
  function clanLeaderAccept(owner, bot) {
    const anchor = clanAnchor(owner);
    const p = bot && bot.myPlayer;
    if (!anchor || anchor === bot || !anchor.myPlayer || !anchor.myPlayer.isLeader || !p || p.id === null || p.id === void 0) return;
    try {
      anchor.PacketManager.clanRequest(p.id, true);
    } catch (_) {}
    const reqs = anchor.myPlayer.joinRequests || [];
    for (let i = reqs.length - 1; i >= 0; i--) {
      if (reqs[i][0] === p.id) reqs.splice(i, 1);
    }
  }
`
  );

  edit(
    "clan: the queue remembers a Re-check",
    `        nextPacketAt: 0, nextAuditAt: 0, manualRequested: false,
`,
    `        nextPacketAt: 0, nextAuditAt: 0, manualRequested: false, insistUntil: 0,
`
  );

  edit(
    "clan: an unanswered request is answered again by the leader",
    `      } else if (now - q.pendingAt >= CLAN_JOIN_CONFIRM_MS) {
        q.failed.add(pending);
        q.retryAt.set(pending, now + CLAN_RETRY_BACKOFF_MS);
`,
    `      } else if (now - q.pendingAt >= CLAN_JOIN_CONFIRM_MS) {
        if (action === "join") clanLeaderAccept(owner, pending);
        q.failed.add(pending);
        // During a Re-check, straight back in line.
        q.retryAt.set(pending, now + (q.insistUntil > now ? 0 : CLAN_RETRY_BACKOFF_MS));
`
  );

  edit(
    "clan: during a Re-check the next round starts at once",
    `    if (q.phase === "monitor" && now >= q.nextAuditAt) {
`,
    `    if (q.phase === "monitor" && (now >= q.nextAuditAt || q.insistUntil > now)) {
`
  );

  edit(
    "clan: any bot's tick sends for the bot whose turn it is",
    `      // Only the current candidate's own module sends its packet. Other bot
      // ticks can advance/confirm the shared state, but cannot send for it.
      if (candidate !== bot) return false;
`,
    `      // Any bot's tick sends for the current candidate, on the candidate's
      // own connection, so a candidate whose own tick has stopped cannot hold
      // the queue. One without an open socket is passed over.
      const sock = candidate.SocketManager && candidate.SocketManager.socket;
      if (!sock || sock.readyState !== 1) {
        q.index++;
        continue;
      }
`
  );

  edit(
    "clan: Re-check tries the bots still outside until they are in",
    `    q.clan = clan;
    if (q.pendingBot) {
`,
    `    q.clan = clan;
    // Back to back, until each is in or CLAN_INSIST_MS is up; and a request
    // any of them has waiting is answered now.
    q.insistUntil = now + CLAN_INSIST_MS;
    for (const b of clanMissingBots(owner, clan)) {
      q.retryAt.delete(b);
      clanLeaderAccept(owner, b);
    }
    if (q.pendingBot) {
`
  );

  edit(
    "clan: a new clan keeps the fleet's requests",
    `        this.prevClan = currentClan;
        myPlayer.joinRequests.length = 0;
`,
    `        this.prevClan = currentClan;
        // Strangers' requests were for the clan that is gone. The fleet's are
        // for this one: a bot that asked before this tick saw the new clan.
        for (let i = myPlayer.joinRequests.length - 1; i >= 0; i--) {
          if (!clanIsFleet(this.client, myPlayer.joinRequests[i][0])) myPlayer.joinRequests.splice(i, 1);
        }
`
  );

  edit(
    "clan: a fleet bot is always accepted (first pass)",
    `        if (RynAllegiance.isFriendlyID(this.client, id) || clientIDList.has(id)) {
          PacketManager2.clanRequest(id, true);
`,
    `        if (clanIsFleet(this.client, id)) {
          PacketManager2.clanRequest(id, true);
`
  );
  edit(
    "clan: a fleet bot is never declined",
    `        const isMine = RynAllegiance.isFriendlyID(this.client, id) || clientIDList.has(id);
`,
    `        const isMine = clanIsFleet(this.client, id);
`
  );

  edit(
    "clan: leaving keeps the fleet's requests",
    `    leaveClan() {
      this.client.myPlayer.joinRequests.length = 0;
`,
    `    leaveClan() {
      const reqs = this.client.myPlayer.joinRequests;
      for (let i = reqs.length - 1; i >= 0; i--) {
        if (!clanIsFleet(this.client, reqs[i][0])) reqs.splice(i, 1);
      }
`
  );

  edit(
    "clan: the button says it keeps going",
    `          button.textContent = a.clan === null ? "You are not in a clan" : a.joined + "/" + a.alive + " joined — retrying " + a.missing;
`,
    `          button.textContent = a.clan === null ? "You are not in a clan" : a.missing === 0 ? a.joined + "/" + a.alive + " joined — all in" : a.joined + "/" + a.alive + " joined — retrying " + a.missing + " until in";
`
  );
  edit(
    "clan: and so does its description",
    `retries only bots still outside your clan. Each bot gets one turn at a time.`,
    `retries the bots still outside your clan, again and again, until they are in (for up to two minutes).`
  );
}


module.exports = { apply, GROUPS, WRAPPED };
