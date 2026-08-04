/* ------------------------------------------------------------------ *
 * LemonMix runtime
 *
 * LemonMod v3.0 and LemonMod Visuals v3.0 were both written against the
 * moomoo.io bundle of their day: plain msgpack `[type, args]` frames, the
 * old numeric packet names ("sp", "33", "ch", "13c" ...), and a renderer
 * you modified by forking bundle.js outright.
 *
 * None of that is true of the game any more. The current bundle negotiates
 * a per-connection opcode permutation on `io-init`, renames every packet to
 * a single character drawn from a shuffled alphabet, appends a sequence
 * number, and prefixes each client frame with 6 bytes of truncated HMAC.
 * A frame built the old way is either dropped or gets the socket closed.
 *
 * This runtime is the adapter. It rewrites the live bundle at load time to
 * expose the game's own transport, then presents that transport to LemonMod
 * under the packet names LemonMod already speaks. LemonMod's own code never
 * touches a socket or a msgpack frame again — the game does the framing, so
 * the sequence counter and the HMAC key stay in one place and stay correct.
 *
 * The Visuals script is folded in the same way: its render edits are applied
 * to the live bundle as anchored rewrites instead of shipping a stale fork of
 * it, which is why there is only one file now and nothing to download.
 * ------------------------------------------------------------------ */

const LemonMix = window.LemonMix = {
  /* filled in by the bundle rewrites below */
  _net: null,          // the game's io object: { socket, connected, send(name, ...args) }
  _crypto: null,       // the game's per-connection { mode, key, tables, seq }
  _turnstile: null,    // Cloudflare Turnstile token, for bot sockets

  _inbound: [],        // (legacyName, args) subscribers
  _outbound: [],       // (legacyName, args) filters; returning false drops the packet

  VERSION: "3.0-mix",
};

/* ------------------------------------------------------------------ *
 * Packet name translation
 *
 * LemonMod speaks the pre-2022 names. The current game speaks the letters
 * in `bo` / `To` (game_index.js), permuted per connection. The permutation
 * is handled by the game itself; all we have to do is agree on the *name*.
 * ------------------------------------------------------------------ */

/* client -> server. Semantics confirmed against the send sites in
 * src/game_index.js (see the build script's table for the line numbers). */
LemonMix.C2S = {
  "sp": "M",     // spawn { name, moofoll, skin }
  "33": "9",     // move direction
  "2": "D",      // aim angle
  "c": "F",      // attack [ state, angle ]
  "7": "K",      // auto attack / lock rotation
  "5": "z",      // select item [ id, isWeapon ]
  "6": "H",      // upgrade item
  "13c": "c",    // store [ 0 = equip | 1 = buy, id, type ]
  "ch": "6",     // chat
  "8": "L",      // create alliance
  "9": "N",      // leave alliance
  "10": "b",     // join alliance
  "11": "P",     // answer a join request
  "12": "Q",     // kick from alliance
  "14": "S",     // ping the map
  "rmd": "e",    // reset move direction
  "pp": "0",     // ping
};

/* server -> client. */
LemonMix.S2C = {
  "1": "C",      // setupGame (your sid)
  "2": "D",      // addPlayer
  "6": "H",      // loadGameObject
  "7": "K",      // gatherAnimation
  "8": "L",      // wiggleGameObject
  "9": "N",      // updatePlayerValue
  "11": "P",     // killPlayer
  "12": "Q",     // killObject
  "13": "R",     // killObjects
  "16": "T",     // updateAge
  "17": "V",     // updateItems
  "18": "X",     // addProjectile
  "33": "a",     // updatePlayers
  "ac": "g",     // addAlliance
  "ch": "6",     // receiveChat
  "h": "O",      // updateHealth
};

/* Built once so inbound translation is a single lookup. `io-init` keeps its
 * name in both directions. */
LemonMix.S2C_LEGACY = (() => {
  const out = { "io-init": "io-init", "0": "0" };
  for (const legacy in LemonMix.S2C) out[LemonMix.S2C[legacy]] = legacy;
  return out;
})();

LemonMix.C2S_LEGACY = (() => {
  const out = {};
  for (const legacy in LemonMix.C2S) out[LemonMix.C2S[legacy]] = legacy;
  return out;
})();

/* ------------------------------------------------------------------ *
 * Sending
 *
 * Everything LemonMod sends goes through here. Routing it into the game's
 * own `io.send` is what makes it correct: the game owns `Z.seq` and the HMAC
 * key, so a packet we inject and a packet the game sends share one counter
 * instead of racing two.
 * ------------------------------------------------------------------ */

LemonMix.send = function(packet) {
  if (!packet) return false;
  const legacy = packet[0];
  const args = packet[1] === undefined || packet[1] === null ? [] : packet[1];
  return LemonMix.sendNamed(legacy, Array.isArray(args) ? args : [ args ]);
};

LemonMix.sendNamed = function(legacyName, args) {
  const name = LemonMix.C2S[legacyName];
  if (name === undefined) return false;
  const net = LemonMix._net;
  if (!net || !net.socket || typeof net.send !== "function") return false;
  /* Before io-init lands there is no opcode table, and the game would encode
   * the packet under a name the server has not agreed to yet. */
  if (!LemonMix.ready()) return false;
  /* The game sends leaving-alliance and reset-move-dir with no arguments;
   * LemonMod passes an explicit null. Trailing nulls are trimmed so the
   * server sees the same shape it gets from the vanilla client. */
  let out = args.slice();
  while (out.length && (out[out.length - 1] === null || out[out.length - 1] === undefined)) {
    if (name !== "F") out.pop(); else break;
  }
  try {
    net.send.apply(net, [ name ].concat(out));
    return true;
  } catch (e) {
    return false;
  }
};

LemonMix.ready = function() {
  const c = LemonMix._crypto;
  const net = LemonMix._net;
  if (!net || !net.socket) return false;
  /* mode 0 (unencrypted) needs no table; mode 1 does. */
  if (!c) return false;
  return !!(c.tables && c.tables.c2s && c.key);
};

/* ------------------------------------------------------------------ *
 * Receiving
 *
 * The rewrite calls this from inside the game's own onmessage, after the
 * opcode has already been mapped back to a name. So we get decoded args and
 * a stable name without decoding a single frame ourselves.
 * ------------------------------------------------------------------ */

LemonMix._in = function(name, args) {
  const legacy = LemonMix.S2C_LEGACY[name];
  LemonMix._Visuals._packet(name, args);
  if (legacy === undefined) return;
  for (let i = 0; i < LemonMix._inbound.length; i++) {
    try {
      LemonMix._inbound[i]({ type: legacy, args: args || [] });
    } catch (e) {}
  }
};

LemonMix.onPacket = function(fn) {
  LemonMix._inbound.push(fn);
};

/* Called from inside the game's `io.send`, before framing. Returning false
 * from any filter drops the packet — that is how silent mode and the chat
 * command parser suppress the player's own frames. */
LemonMix._out = function(name, args) {
  const legacy = LemonMix.C2S_LEGACY[name];
  if (legacy === undefined) return true;
  let allow = true;
  for (let i = 0; i < LemonMix._outbound.length; i++) {
    try {
      if (LemonMix._outbound[i](legacy, args || []) === false) allow = false;
    } catch (e) {}
  }
  return allow;
};

LemonMix.onSend = function(fn) {
  LemonMix._outbound.push(fn);
};

/* ------------------------------------------------------------------ *
 * The socket handle LemonMod holds
 *
 * LemonMod grabbed the WebSocket instance the first time it saw a frame go
 * past and kept it in a variable, then used it for three things: sending,
 * reading `.url` to derive bot socket addresses, and pushing raw unsigned
 * byte arrays for its "crash" payloads.
 *
 * The first two are forwarded. The third cannot work and must not be
 * attempted: every frame the server accepts now carries six bytes of HMAC
 * over [opcode, args, seq], so an unsigned blob is rejected, and enough of
 * them close the connection with code 4001. The only player it would
 * disconnect is the one who sent it.
 * ------------------------------------------------------------------ */

LemonMix.socketProxy = {
  id: null,
  get url() {
    const net = LemonMix._net;
    return net && net.socket ? net.socket.url : "";
  },
  get readyState() {
    const net = LemonMix._net;
    return net && net.socket ? net.socket.readyState : 3;
  },
  send(packet) {
    return LemonMix.send(packet);
  },
  oldSend() {
    return false;
  },
  addEventListener() {},
  removeEventListener() {},
};

/* The game flips io.connected on close. LemonMod wants to know because a few
 * of its loops must stop when the socket goes away. */
LemonMix._closeHandlers = [];
LemonMix.onClose = function(fn) {
  LemonMix._closeHandlers.push(fn);
};
(function() {
  let wasConnected = false;
  setInterval(() => {
    const net = LemonMix._net;
    const connected = !!(net && net.connected);
    if (wasConnected && !connected) {
      LemonMix._closeHandlers.forEach(fn => {
        try {
          fn();
        } catch (e) {}
      });
    }
    wasConnected = connected;
  }, 250);
})();

/* Shame count. The Visuals fork wrote it into a cookie for the main script to
 * poll; both halves are the same script now, so it is a field the packet
 * stream keeps up to date. */
LemonMix._shameCount = 0;

/* ------------------------------------------------------------------ *
 * Visuals
 *
 * LemonMod Visuals tracked weapon reloads by patching four functions inside
 * its fork of the bundle. All four are packet-driven, so the same state is
 * rebuilt here from the packet stream and only the drawing needs a hook.
 * ------------------------------------------------------------------ */

LemonMix._Visuals = {
  primary: {},        // sid -> 0..1
  secondary: {},
  turret: {},
  prevPrimary: {},    // value before the last advance, for the fork's 111ms lerp
  prevSecondary: {},
  weapons: {},        // sid -> { primary, secondary }
  pos: {},            // sid -> { x, y }, only so a shot can be traced to a shooter
  health: {},         // sid -> last known health, to spot a hit
  clown: {},          // sid -> 0..7, the clown-hat revive counter
  lastHit: {},        // sid -> tick of the last health drop
  tick: 0,            // advanced once per updatePlayers, the fork's clock
  mySid: null,
  target: null,       // sid highlighted by the insta ring

  colors: {
    reloaded: "#8ecc51",
    middle: "#e0c31c",
    notReloaded: "#cc5151",
  },

  _weaponSpeed(index) {
    const w = LEMONMIX_WEAPONS[index];
    return w && w.speed ? w.speed : 300;
  },

  _slot(sid) {
    if (this.primary[sid] === undefined) this.primary[sid] = 1;
    if (this.secondary[sid] === undefined) this.secondary[sid] = 1;
    if (this.turret[sid] === undefined) this.turret[sid] = 1;
    if (!this.weapons[sid]) this.weapons[sid] = { primary: 0, secondary: undefined };
    return this.weapons[sid];
  },

  _packet(name, args) {
    if (!args) return;
    switch (name) {
     case "D": {                         // addPlayer(data, isYou)
      const sid = args[0] && args[0][1];
      if (sid === undefined) break;
      this.primary[sid] = 1;
      this.secondary[sid] = 1;
      this.turret[sid] = 1;
      this.prevPrimary[sid] = 1;
      this.prevSecondary[sid] = 1;
      break;
     }

     case "K": {                         // gatherAnimation(sid, didHit, index)
      const sid = args[0];
      const index = args[2];
      if (sid === undefined) break;
      this._slot(sid);
      if (index === 10 || index === 14) this.secondary[sid] = 0;
      else this.primary[sid] = 0;
      break;
     }

     case "C":                           // setupGame(yourSID)
      this.mySid = args[0];
      break;

     case "O": {                         // updateHealth(sid, value)
      const sid = args[0];
      const health = args[1];
      if (sid === undefined) break;
      if (this.health[sid] !== undefined && health < this.health[sid]) {
        this.lastHit[sid] = this.tick;
      }
      this.health[sid] = health;
      break;
     }

     case "X": {                         // addProjectile(x, y, dir, range, speed, ...)
      this._shotFired(args[0], args[1], args[2], args[4]);
      break;
     }

     case "a": {                         // updatePlayers, flat groups of 13
      const flat = args[0];
      if (!flat || !flat.length) break;
      this.tick++;
      for (let i = 0; i < flat.length; i += 13) {
        const sid = flat[i];
        const buildIndex = flat[i + 4];
        const weaponIndex = flat[i + 5];
        const skinIndex = flat[i + 9];
        const slot = this._slot(sid);
        this.pos[sid] = { x: flat[i + 1], y: flat[i + 2] };

        /* The clown hat revives you at seven hits taken inside two ticks of
         * each other; the counter decays by two when you go a tick unhit. */
        if (skinIndex === 45) {
          this.clown[sid] = 7;
        } else {
          if (this.clown[sid] === undefined) this.clown[sid] = 0;
          if (this.lastHit[sid] !== undefined) {
            if (this.tick - this.lastHit[sid] < 2) this.clown[sid]++;
            else this.clown[sid] = Math.max(0, this.clown[sid] - 2);
            delete this.lastHit[sid];
          }
        }

        this.prevPrimary[sid] = this.primary[sid];
        this.prevSecondary[sid] = this.secondary[sid];
        if (weaponIndex < 9) {
          if (weaponIndex === slot.primary) {
            if (buildIndex === -1) {
              this.primary[sid] = Math.min(1, this.primary[sid] + 111 / this._weaponSpeed(slot.primary));
            }
          } else {
            slot.primary = weaponIndex;
          }
        } else if (weaponIndex > 8) {
          if (weaponIndex === slot.secondary) {
            if (buildIndex === -1) {
              this.secondary[sid] = Math.min(1, this.secondary[sid] + 111 / this._weaponSpeed(slot.secondary));
            }
          } else {
            slot.secondary = weaponIndex;
          }
        }
        this.turret[sid] = Math.min(1, this.turret[sid] + .0444);
      }
      break;
     }
    }
  },

  /* A projectile packet does not say who fired it, so the fork worked it out:
   * a shot leaves the shooter about 80 units along its heading, so back that
   * off and look for a player near the result whose secondary weapon fires a
   * projectile at exactly this speed. Same method here, driven off the
   * positions the updatePlayers packet already carries. */
  _shotFired(x, y, dir, speed) {
    if (x === undefined || dir === undefined) return;
    const originX = x - 80 * Math.cos(dir);
    const originY = y - 80 * Math.sin(dir);

    let best = null;
    let bestDist = Infinity;
    for (const sid in this.pos) {
      const slot = this.weapons[sid];
      if (!slot || slot.secondary === undefined) continue;
      const weapon = LEMONMIX_WEAPONS[slot.secondary];
      if (!weapon || weapon.projectileSpeed !== speed) continue;
      const p = this.pos[sid];
      const d = (p.x - originX) * (p.x - originX) + (p.y - originY) * (p.y - originY);
      if (d < bestDist) {
        bestDist = d;
        best = sid;
      }
    }
    if (best !== null && Math.sqrt(bestDist) < 60) this.secondary[best] = 0;
  },

  /* The `<n/7>` the fork appended to every other player's name. */
  _clownTag(player) {
    try {
      if (!player || player.sid === undefined) return "";
      if (player.skinIndex === undefined || player.skinIndex === null) return "";
      if (this.mySid !== null && player.sid === this.mySid) return "";
      return " <" + (this.clown[player.sid] || 0) + "/7>";
    } catch (e) {
      return "";
    }
  },

  /* The fork drew the previous value eased towards the current one over the
   * 111ms between server ticks, using the interpolation clock the renderer
   * already keeps on each player (`dt`). */
  _lerped(map, prev, sid, dt) {
    const target = map[sid];
    if (target === undefined) return 1;
    const from = prev[sid];
    if (from === undefined || from >= target) return target;
    return from + (target - from) * Math.min(1, (dt || 0) / 111);
  },

  _barColor(v) {
    if (v >= 1) return this.colors.reloaded;
    if (v > .5) return this.colors.middle;
    return this.colors.notReloaded;
  },

  _enabled(id) {
    const el = document.getElementById(id);
    return !!(el && el.checked);
  },

  /* The one entry point the bundle rewrite calls. ctx / player / config /
   * xOffset / yOffset come straight off the game's own call site. */
  _draw(ctx, player, config, xOffset, yOffset) {
    this._targetRing(ctx, player, xOffset, yOffset);
    this._reloadBars(ctx, player, config, xOffset, yOffset);
  },

  /* Appended to the game's own health-bar draw, inside its `health > 0` guard. */
  _reloadBars(ctx, player, config, xOffset, yOffset) {
    try {
      if (!this._enabled("reloadBars")) return;
      const sid = player.sid;
      if (sid === undefined) return;
      const x = player.x - xOffset;
      const y = player.y - yOffset + player.scale + config.nameY - 13;
      const w = config.healthBarWidth;
      const pad = config.healthBarPad;

      ctx.fillStyle = "#3d3f42";
      ctx.roundRect(x - w - pad, y, w * 2 + pad * 2, 17, 8);
      ctx.fill();

      const sr = this._lerped(this.secondary, this.prevSecondary, sid, player.dt);
      ctx.fillStyle = this._barColor(this.secondary[sid]);
      ctx.roundRect(x + 2.5, y + pad, w * 2 / 2.1 * sr, 17 - pad * 2, 7);
      ctx.fill();

      const pr = this._lerped(this.primary, this.prevPrimary, sid, player.dt);
      ctx.fillStyle = this._barColor(this.primary[sid]);
      ctx.roundRect(x - w, y + pad, w * 2 / 2.1 * pr, 17 - pad * 2, 7);
      ctx.fill();
    } catch (e) {}
  },

  /* The insta-kill target ring. The fork read the target sid out of a cookie
   * the main script wrote; here the two halves are in the same script, so it
   * reads the field directly. */
  _targetRing(ctx, player, xOffset, yOffset) {
    try {
      if (this.target === null || player.sid !== this.target) return;
      const display = document.getElementById("instaDisplay");
      if (!display || display.innerText !== "ON") return;
      if (!this._ringImage) {
        this._ringImage = new Image();
        this._ringImage.src = LEMONMIX_RING_SPRITE;
      }
      if (!this._ringImage.complete) return;
      ctx.drawImage(
        this._ringImage,
        player.x - 1.1 * player.scale - xOffset,
        player.y - 1.1 * player.scale - yOffset,
        2.2 * player.scale,
        2.2 * player.scale
      );
    } catch (e) {}
  },
};

/* ------------------------------------------------------------------ *
 * A jQuery stand-in
 *
 * LemonMod pulled jQuery and jQuery UI from lemonmod.com. It uses eight
 * methods between them and nothing from jQuery UI, so the dependency (and
 * the two requests to the author's server that came with it) is replaced
 * with this.
 * ------------------------------------------------------------------ */

function LemonMixQuery(selector) {
  let nodes;
  if (selector === window || selector === document) nodes = [ selector ];
  else if (typeof selector === "string") nodes = Array.prototype.slice.call(document.querySelectorAll(selector));
  else if (selector && selector.nodeType) nodes = [ selector ];
  else if (selector && selector.length !== undefined) nodes = Array.prototype.slice.call(selector);
  else nodes = [];

  const api = {
    length: nodes.length,
    nodes: nodes,
    get(i) {
      return nodes[i];
    },
    val(value) {
      if (value === undefined) return nodes[0] ? nodes[0].value : undefined;
      nodes.forEach(n => n.value = value);
      return api;
    },
    text(value) {
      if (value === undefined) return nodes[0] ? nodes[0].textContent : undefined;
      nodes.forEach(n => n.textContent = value);
      return api;
    },
    html(value) {
      if (value === undefined) return nodes[0] ? nodes[0].innerHTML : undefined;
      nodes.forEach(n => n.innerHTML = value);
      return api;
    },
    css(prop, value) {
      if (typeof prop === "object") {
        nodes.forEach(n => {
          for (const k in prop) n.style.setProperty(k, prop[k]);
        });
        return api;
      }
      if (value === undefined) return nodes[0] ? getComputedStyle(nodes[0]).getPropertyValue(prop) : undefined;
      nodes.forEach(n => n.style.setProperty(prop, value));
      return api;
    },
    addClass(name) {
      nodes.forEach(n => n.classList.add.apply(n.classList, String(name).split(/\s+/).filter(Boolean)));
      return api;
    },
    removeClass(name) {
      nodes.forEach(n => n.classList.remove.apply(n.classList, String(name).split(/\s+/).filter(Boolean)));
      return api;
    },
    find(sel) {
      const found = [];
      nodes.forEach(n => found.push.apply(found, Array.prototype.slice.call(n.querySelectorAll(sel))));
      return LemonMixQuery(found);
    },
    prev() {
      return LemonMixQuery(nodes.map(n => n.previousElementSibling).filter(Boolean));
    },
    click(handler) {
      if (handler === undefined) {
        nodes.forEach(n => n.click && n.click());
        return api;
      }
      nodes.forEach(n => n.addEventListener("click", handler));
      return api;
    },
    resize(handler) {
      nodes.forEach(n => n.addEventListener && n.addEventListener("resize", handler));
      return api;
    },
    on(event, handler) {
      nodes.forEach(n => n.addEventListener && n.addEventListener(event, handler));
      return api;
    },
    ready(handler) {
      if (document.readyState !== "loading") handler();
      else document.addEventListener("DOMContentLoaded", handler, { once: true });
      return api;
    },
    each(fn) {
      nodes.forEach((n, i) => fn.call(n, i, n));
      return api;
    },
    attr(name, value) {
      if (value === undefined) return nodes[0] ? nodes[0].getAttribute(name) : undefined;
      nodes.forEach(n => n.setAttribute(name, value));
      return api;
    },
    append(child) {
      nodes.forEach(n => n.append(child && child.nodes ? child.nodes[0] : child));
      return api;
    },
    remove() {
      nodes.forEach(n => n.remove());
      return api;
    },
  };
  return api;
}
if (typeof window.$ !== "function") window.$ = LemonMixQuery;
const $ = window.$;

/* ------------------------------------------------------------------ *
 * Bot sockets
 *
 * The multibox feature opens its own WebSockets, outside the game's io
 * object, so those frames have to be built here. This is the one place in
 * the script that touches the wire format, and the primitives doing it are
 * lifted out of src/game_index.js by the build rather than reimplemented:
 * Co / Oi / Po for the seeded opcode permutation, Vt / Ao / Eo for the
 * truncated HMAC-SHA256, Ro for the hex key.
 *
 * LemonMod v3.0 asked grecaptcha for a connection token. The game moved to
 * Cloudflare Turnstile, and the token it received is captured by the
 * captureTurnstile rewrite.
 * ------------------------------------------------------------------ */

LemonMix.Bot = {
  /* Give a freshly opened bot socket the same shape LemonMod expects: an
   * `emit` that takes a legacy [ name, args ] pair. */
  wrap(ws) {
    ws.binaryType = "arraybuffer";
    ws._lemonCrypto = null;
    ws.emit = packet => LemonMix.Bot.send(ws, packet);
    return ws;
  },

  send(ws, packet) {
    if (!packet || ws.readyState !== 1) return false;
    const name = LemonMix.C2S[packet[0]];
    if (name === undefined) return false;
    let args = packet[1];
    args = args === undefined || args === null ? [] : (Array.isArray(args) ? args : [ args ]);

    const state = ws._lemonCrypto;
    try {
      if (state && state.mode === Ht) {
        const opcode = state.tables.c2s.enc[name];
        if (opcode === undefined) return false;
        const seq = ++state.seq;
        const payload = msgpack.encode([ opcode, args, seq ]);
        const signature = Eo(state.key, payload);
        const frame = new Uint8Array(jt + payload.length);
        frame.set(signature, 0);
        frame.set(payload, jt);
        ws.send(frame);
        return true;
      }
      /* mode 0: the server never negotiated a table, so the plain form still
       * applies. */
      ws.send(msgpack.encode([ name, args ]));
      return true;
    } catch (e) {
      return false;
    }
  },

  /* Decodes one inbound frame and returns it in the [ name, ...args ] shape
   * LemonMod's bot handler reads, with the name translated back to the one it
   * was written against. Returns null for anything it cannot place. */
  receive(ws, event) {
    let decoded;
    try {
      decoded = msgpack.decode(new Uint8Array(event.data));
    } catch (e) {
      return null;
    }
    let type = decoded[0];
    const args = decoded[1] || [];

    if (type === "io-init") {
      if (args[3] === Ht) {
        ws._lemonCrypto = {
          mode: Ht,
          key: Ro(args[2]),
          tables: Po(args[1] >>> 0),
          seq: 0,
        };
      } else {
        ws._lemonCrypto = null;
      }
      return [ "io-init" ].concat(args);
    }

    const state = ws._lemonCrypto;
    if (state && typeof type === "number") {
      type = state.tables.s2c.dec[type];
      if (type === undefined) return null;
    }
    const legacy = LemonMix.S2C_LEGACY[type];
    if (legacy === undefined) return null;
    return [ legacy ].concat(args);
  },

  /* The token a bot socket needs in its query string. */
  token() {
    return LemonMix._turnstile;
  },
};

/* A promise-shaped token, because the bot routine chains `.then` off what
 * grecaptcha used to return. */
LemonMix.Bot.tokenPromise = function() {
  return Promise.resolve(LemonMix._turnstile);
};

/* Read on the insta-kill path. There is no #iChat input in the menu and
 * nothing ever assigns it, so it stays empty and the guarded call sends
 * nothing — see tools/build-lemonmix.js. */
window.iChat = "";
