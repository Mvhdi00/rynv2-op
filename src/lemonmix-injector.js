/* ------------------------------------------------------------------ *
 * Bundle rewriting
 *
 * LemonMod Visuals was a fork of bundle.js: the whole game, copied, edited,
 * shipped. A fork goes stale the moment the game ships anything, which is
 * exactly what happened to it — the copy it carries predates the current
 * transport entirely, so it cannot connect at all.
 *
 * This does the same job from the other end. The real bundle is intercepted
 * on its way to the parser and the handful of statements the mod needs to
 * reach are rewritten in place. Nothing is forked, so nothing goes stale
 * except the individual hooks, and an orphaned hook is a build failure rather
 * than a silent one.
 *
 * Regexer is the hook engine from the RYN client already vendored in this
 * repo, kept byte-identical so tools/check-hooks.js can lift it back out of
 * the build and replay every hook against src/game_index.js.
 * ------------------------------------------------------------------ */

const Logger = {
  error(message) {
    console.warn("[LemonMix] hook failed - " + message);
  },
  test(message) {
    if (window.isDev) console.log("[LemonMix] " + message);
  },
};

  class Regexer {
    code;
    COPY_CODE;
    hookCount=0;
    hookAttempts=0;
    ANY_LETTER="(?:[^\\x00-\\x7F-]|\\$|\\w)";
    NumberSystem=[ {
      radix: 2,
      prefix: "0b0*"
    }, {
      radix: 8,
      prefix: "0+"
    }, {
      radix: 10,
      prefix: ""
    }, {
      radix: 16,
      prefix: "0x0*"
    } ];
    constructor(code) {
      this.code = code;
      this.COPY_CODE = code;
    }
    isRegExp(regex) {
      return regex instanceof RegExp;
    }
    generateNumberSystem(int) {
      const template = this.NumberSystem.map(({radix: radix, prefix: prefix}) => prefix + int.toString(radix));
      return `(?:${template.join("|")})`;
    }
    parseVariables(regex) {
      regex = regex.replace(/{VAR}/g, "(?:let|var|const)");
      regex = regex.replace(/{QUOTE{(\w+)}}/g, "(?:'$1'|\"$1\"|`$1`)");
      regex = regex.replace(/NUM{(\d+)}/g, (...args) => this.generateNumberSystem(Number(args[1])));
      regex = regex.replace(/\\w/g, this.ANY_LETTER);
      return regex;
    }
    format(name, inputRegex, flags) {
      this.hookAttempts++;
      let regex = "";
      if (Array.isArray(inputRegex)) {
        regex = inputRegex.map(exp => this.isRegExp(exp) ? exp.source : exp).join("\\s*");
      } else if (this.isRegExp(inputRegex)) {
        regex = inputRegex.source;
      } else {
        regex = inputRegex + "";
      }
      regex = this.parseVariables(regex);
      const expression = RegExp(regex, flags);
      if (!expression.test(this.code)) {
        Logger.error("Failed to find: " + name);
      } else {
        this.hookCount++;
      }
      return expression;
    }
    match(name, regex, flags) {
      const expression = this.format(name, regex, flags);
      return this.code.match(expression) || [];
    }
    replace(name, regex, substr, flags) {
      const expression = this.format(name, regex, flags);
      this.code = this.code.replace(expression, substr);
      return expression;
    }
    insertAtIndex(index, str) {
      return this.code.slice(0, index) + str + this.code.slice(index, this.code.length);
    }
    template(name, regex, substr, getIndex) {
      const expression = this.format(name, regex);
      const match = this.code.match(expression);
      if (match === null) {
        return;
      }
      const index = getIndex(match);
      this.code = this.insertAtIndex(index, substr.replace(/\$(\d+)/g, (...args) => match[args[1]]));
    }
    append(name, regex, substr) {
      this.template(name, regex, substr, match => (match.index || 0) + match[0].length);
    }
    prepend(name, regex, substr) {
      this.template(name, regex, substr, match => match.index || 0);
    }
    wrap(left, right) {
      this.code = left + this.code + right;
    }
  }
  const Regexer_default = Regexer;

  const formatCode2 = code => {
    const Hook = new Regexer_default(code);

    /* --- transport -------------------------------------------------- *
     *
     * These five are what make LemonMod's packets legal again. The old
     * client framed its own msgpack and picked its own packet names; the
     * current game negotiates an opcode permutation per connection, appends
     * a sequence number and signs every frame. Rather than reimplement any
     * of that, the mod is handed the game's own transport.
     */

    /* The io object. Everything LemonMod sends goes back through this, so the
     * sequence counter and the HMAC key stay in one place — two senders
     * incrementing two counters is a desync. */
    Hook.replace("exposeGameNet",
      /const (\w+)=\{socket:null,connected:!1,socketId:-1/,
      "const $1=window.LemonMix._net={socket:null,connected:!1,socketId:-1");

    /* The per-connection state built from io-init: mode, key, both permuted
     * opcode tables, seq. Read-only here — it is how the mod knows the
     * transport is up before it sends anything. */
    Hook.replace("exposeGameCrypto",
      /(\w+)=\{mode:(\w+),key:/,
      "$1=window.LemonMix._crypto={mode:$2,key:");

    /* Inbound, right after the game has mapped the numeric opcode back to a
     * packet name and before it dispatches. Decoded arguments and a stable
     * name, so nothing on our side ever parses a frame. */
    Hook.replace("packetIn",
      /const (\w+)=(\w+)\[(\w+)\];\1&&\1\.apply\(void 0,(\w+)\)/,
      "window.LemonMix._in($3,$4);const $1=$2[$3];$1&&$1.apply(void 0,$4)");

    /* Outbound, at the top of io.send and before framing. A filter returning
     * false drops the packet — that is how silent mode and the chat command
     * parser suppress the player's own frames. */
    Hook.replace("packetOut",
      /send:function\((\w+)\)\{const (\w+)=Array\.prototype\.slice\.call\(arguments,1\);/,
      "send:function($1){const $2=Array.prototype.slice.call(arguments,1);if(window.LemonMix._out($1,$2)===false)return;");

    /* Bot sockets need a token of their own. LemonMod v3.0 asked grecaptcha
     * for one; the game moved to Cloudflare Turnstile. */
    Hook.replace("captureTurnstile",
      /onGotTurnstileToken=function\((\w+)\)\{(\w+)=\1,/,
      "onGotTurnstileToken=function($1){$2=$1,window.LemonMix._turnstile=$1,");

    /* --- visuals ----------------------------------------------------- *
     *
     * The Visuals fork edited the health-bar statement in place to draw
     * reload bars and the insta-target ring under it. Same statement, same
     * position in the draw order, appended instead of replaced — and still
     * inside the game's own `health > 0` guard.
     */
    /* The clown-hat revive counter, appended to every other player's name.
     * The fork edited the same expression where the game composes the name. */
    Hook.replace("clownCounter",
      /const (\w+)=\((\w+)\.team\?"\["\+\2\.team\+"\] ":""\)\+\(\2\.name\|\|""\);/,
      'const $1=($2.team?"["+$2.team+"] ":"")+($2.name||"")+window.LemonMix._Visuals._clownTag($2);');

    Hook.replace("playerOverlay",
      /(\w+)\.roundRect\((\w+)\.x-(\w+)-(\w+)\.healthBarWidth,\2\.y-(\w+)\+\2\.scale\+\4\.nameY\+\4\.healthBarPad,\4\.healthBarWidth\*2\*\(\2\.health\/\2\.maxHealth\),17-\4\.healthBarPad\*2,7\),\1\.fill\(\)\)/,
      "$1.roundRect($2.x-$3-$4.healthBarWidth,$2.y-$5+$2.scale+$4.nameY+$4.healthBarPad,$4.healthBarWidth*2*($2.health/$2.maxHealth),17-$4.healthBarPad*2,7),$1.fill(),window.LemonMix._Visuals._draw($1,$2,$4,$3,$5))");

    Logger.test("bundle rewritten, " + Hook.hookCount + "/" + Hook.hookAttempts + " hooks bound");
    return Hook.code;
  };
  const formatCode_default = formatCode2;

/* ------------------------------------------------------------------ *
 * Injector
 *
 * The bundle is an ES module that pulls in a vendor chunk. Running it out of
 * a <script> we control means running it through Function(), which has no
 * module scope, so the one static import is rewritten to a dynamic one and
 * the whole thing is wrapped in an async IIFE.
 * ------------------------------------------------------------------ */

const Injector = new class {
  init(node) {
    this.loadScript(node.src);
  }

  loadScript(src) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", src, false);
    xhr.send();

    let code = formatCode_default(xhr.responseText);

    let baseUrl;
    try {
      baseUrl = new URL(".", src).href;
    } catch (e) {
      baseUrl = src.slice(0, src.lastIndexOf("/") + 1);
    }
    const toAbs = path => {
      try {
        return new URL(path, baseUrl).href;
      } catch (e) {
        return baseUrl + path.replace(/^\.\.?\//, "");
      }
    };

    code = code.replace(
      /(^|[\n;])\s*import\s*(\{[^}]*\}|\*\s+as\s+[\w$]+|[\w$]+)?\s*(?:,\s*(\{[^}]*\}|[\w$]+))?\s*from\s*(["'])([^"']+)\4\s*;?/g,
      (full, lead, spec1, spec2, quote, path) => {
        if (/import\s*\(/.test(full)) return full;
        const abs = toAbs(path);
        const conv = spec => {
          spec = (spec || "").trim();
          if (!spec) return null;
          if (spec.startsWith("{")) {
            const inner = spec.slice(1, -1).split(",").map(s => {
              s = s.trim();
              if (!s) return null;
              const parts = s.split(/\s+as\s+/);
              return parts.length === 2 ? parts[0].trim() + ": " + parts[1].trim() : s;
            }).filter(Boolean).join(", ");
            return "{" + inner + "}";
          }
          if (spec.startsWith("*")) return spec.replace(/\*\s+as\s+/, "").trim();
          return "{default: " + spec + "}";
        };
        const bindings = [ conv(spec1), conv(spec2) ].filter(b => b && b !== "{}");
        if (!bindings.length) return lead + "await import(" + JSON.stringify(abs) + ");";
        return lead + bindings.map(b => "const " + b + " = await import(" + JSON.stringify(abs) + ");").join("");
      }
    );
    code = code.replace(/(\bimport\s*\(\s*)(["'])(\.\.?\/[^"']+)\2/g, (m, kw, quote, path) => kw + quote + toAbs(path) + quote);
    code = "(async function(){" + code + "})();";

    this.waitForBody(() => {
      Function(code)();
    });
  }

  waitForBody(callback) {
    if (document.readyState !== "loading") {
      callback();
      return;
    }
    document.addEventListener("readystatechange", () => {
      if (document.readyState !== "loading") callback();
    }, { once: true });
  }
}();

/* Catch the bundle script element before the browser gets to run it, and take
 * the third-party trackers the page pulls in with it out at the same time.
 * LemonMod v3.0 had its own observer for this, aimed at `/bundle.js` — a path
 * the game stopped serving. */
(function() {
  let claimed = false;

  const cancel = node => {
    node.addEventListener("beforescriptexecute", event => event.preventDefault(), { once: true });
    node.remove();
  };

  const handle = node => {
    const isScript = node instanceof HTMLScriptElement;
    const isLink = node instanceof HTMLLinkElement;
    const junk = /frvr|howler|cookie|cookiepro|securepubads|googletagmanager|google-analytics|doubleclick|adsbygoogle/i;
    if (isScript && junk.test(node.src || "") || isLink && junk.test(node.href || "")) {
      cancel(node);
      return;
    }
    if (isScript && /assets\/.+\.js$/.test(node.src || "") && !claimed) {
      claimed = true;
      cancel(node);
      Injector.init({ src: node.src });
    }
  };

  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(handle));
  }).observe(document, { childList: true, subtree: true });

  document.querySelectorAll("script, link").forEach(handle);
})();
