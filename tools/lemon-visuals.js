/*
 * lemon-visuals.js
 *
 * The three things `LemonMod - Visuals` added, rebuilt for the current game.
 *
 * That script is a fork of the whole old webpack bundle: it replaces the client
 * rather than hooking it, so it cannot be patched forward - see the README. Its
 * renderer changes, though, are three self-contained features, and those are
 * portable:
 *
 *   1. reload bars      - primary and secondary weapon reload, drawn above each
 *                         player's health bar in the fork's three colours;
 *   2. shame counter    - `<n/7>` after every other player's name, counting the
 *                         times they healed straight out of damage;
 *   3. insta marker     - a crosshair over the player LemonMod is tracking,
 *                         while its insta display reads ON.
 *
 * Neither the camera nor the interpolation is reachable from outside the
 * bundle, so nothing here tries to reproduce them. Instead the overlay draws
 * from inside the game's own render pass: the bundle strokes and then fills
 * each nametag at `(x - xOffset, y - yOffset - scale - nameY)`, so hooking
 * fillText hands us the exact screen position of every visible player, in the
 * frame it is drawn, with the game's own interpolation already applied. The
 * health bar sits `2 * (playerScale + nameY)` below that, which is where the
 * bars are measured from.
 *
 * State comes off the wire through the bridge's observer hook, under the old
 * opcode names, and the reload model is the fork's own: accumulate
 * `111 / weapon.speed` per tick, reset on the attack the player is seen making.
 */
(function () {
  "use strict";

  if (window.__lemonVisuals) return;
  var bridge = window.__lemonBridge;
  if (!bridge || typeof bridge.observe !== "function") return;

  /* ------------------------------------------------------------------ *
   * Constants (drivers/game-drivers.json -> config, weapons)
   * ------------------------------------------------------------------ */

  var PLAYER_SCALE = 35;
  var NAME_Y = 34;
  var HEALTH_BAR_WIDTH = 50;
  var HEALTH_BAR_PAD = 4.5;
  var BAR_HEIGHT = 17;
  var TICK_MS = 111;                       // the server tick the fork counts in
  var BAR_LIFT = 13;                       // how far above the health bar

  var BAR_BACKGROUND = "#3d3f42";          // the bundle's own health bar backing
  var RELOADED = "#fff200";
  var HALF_RELOADED = "#ffa600";
  var NOT_RELOADED = "#FF0000";

  /* weapon fire rates, index-aligned with the bundle's weapon list */
  var WEAPON_SPEED = [300, 400, 400, 300, 300, 700, 300, 100, 400,
    600, 400, null, 700, 230, 700, 1500];
  var PRIMARY_COUNT = 9;                   // 0..8 primary, 9..15 secondary
  var MELEE_SECONDARY = { 10: true, 14: true };

  /* ------------------------------------------------------------------ *
   * What the wire says
   * ------------------------------------------------------------------ */

  var players = new Map();                 // sid -> state
  var bySocketId = new Map();              // player id -> sid
  var mainSocket = null;
  var selfSid = null;
  var tick = 0;

  function player(sid) {
    var p = players.get(sid);
    if (!p) {
      p = {
        sid: sid, name: "", team: null, health: 100, skinIndex: null,
        weaponIndex: 0, buildIndex: -1, primary: 0, secondary: null,
        primaryReload: 1, secondaryReload: 1, pr: 1, sr: 1,
        tickAt: 0, clown: 0, lastDamage: 0,
        x: 0, y: 0, px: 0, py: 0
      };
      players.set(sid, p);
    }
    return p;
  }

  function reloadStep(weapon) {
    var speed = WEAPON_SPEED[weapon];
    return speed ? TICK_MS / speed : 1;
  }

  /* The fork's model, kept as it was: a weapon the player is holding but not
   * building with recharges a tick's worth per update, and the attack itself
   * empties it. */
  function onTick(data) {
    tick++;
    var now = Date.now();
    for (var i = 0; i < data.length; i += 13) {
      var p = player(data[i]);
      p.px = p.x;
      p.py = p.y;
      p.x = data[i + 1];
      p.y = data[i + 2];
      p.buildIndex = data[i + 4];
      p.weaponIndex = data[i + 5];
      p.team = data[i + 7] === undefined ? null : data[i + 7];
      p.skinIndex = data[i + 9];
      p.tickAt = now;

      if (p.skinIndex === 45) p.clown = 7;          // wearing Shame! already

      if (p.weaponIndex < PRIMARY_COUNT) {
        if (p.weaponIndex === p.primary) {
          p.pr = p.primaryReload;
          p.sr = p.secondaryReload;
          if (p.buildIndex === -1) {
            p.primaryReload = Math.min(1, p.primaryReload + reloadStep(p.primary));
          }
        } else {
          p.primary = p.weaponIndex;
        }
      } else if (p.weaponIndex === p.secondary) {
        p.sr = p.secondaryReload;
        p.pr = p.primaryReload;
        if (p.buildIndex === -1) {
          p.secondaryReload = Math.min(1, p.secondaryReload + reloadStep(p.secondary));
        }
      } else {
        p.secondary = p.weaponIndex;
      }
    }
  }

  /* `startAnim(didHit, weaponIndex)` in the bundle, so the third argument says
   * which weapon swung. The fork emptied the primary bar for anything that was
   * not a great hammer or mc grabby, which also fired on bow and musket shots;
   * those are the ones the projectile below accounts for, so they are left
   * alone here. */
  function onAttack(sid, didHit, index) {
    var p = players.get(sid);
    if (!p) return;
    if (MELEE_SECONDARY[index]) p.secondaryReload = 0;
    else if (index === undefined || index < PRIMARY_COUNT) p.primaryReload = 0;
  }

  /* A projectile appears without saying who fired it, so the fork looks for the
   * nearest player holding a secondary that shoots at that speed. Same idea
   * here, off the last two positions we were sent. */
  function onProjectile(x, y, dir, range, speed) {
    var best = null;
    var bestDist = Infinity;
    players.forEach(function (p) {
      if (p.secondary === null || WEAPON_SPEED[p.secondary] === null) return;
      var ex = p.x + (p.x - p.px) * 0.5;
      var ey = p.y + (p.y - p.py) * 0.5;
      var dist = Math.pow(ex - x + 80 * Math.cos(dir), 2) + Math.pow(ey - y + 80 * Math.sin(dir), 2);
      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    });
    if (best && Math.sqrt(bestDist) < 220) best.secondaryReload = 0;
  }

  /* Health going up right after it went down is the shame the counter counts. */
  function onHealth(sid, health) {
    var p = players.get(sid);
    if (!p) return;
    var change = health - p.health;
    if (change > 0) {
      if (p.lastDamage) {
        if (tick - p.lastDamage < 2) p.clown++;
        else p.clown = Math.max(0, p.clown - 2);
        p.lastDamage = 0;
      }
    } else if (change < 0) {
      p.lastDamage = tick;
    }
    p.health = health;
  }

  bridge.observe(function (socket, type, args) {
    if (mainSocket === null) mainSocket = socket;      // the game connects first
    if (socket !== mainSocket) return;
    switch (type) {
      case "1":
        selfSid = args[0];
        break;
      case "2": {
        var data = args[0] || [];
        var p = player(data[1]);
        bySocketId.set(data[0], data[1]);
        p.name = data[2] || "";
        p.health = data[6] === undefined ? 100 : data[6];
        p.primaryReload = p.secondaryReload = p.pr = p.sr = 1;
        p.clown = 0;
        p.lastDamage = 0;
        break;
      }
      case "4": {
        var sid = bySocketId.get(args[0]);
        if (sid !== undefined) {
          players.delete(sid);
          bySocketId.delete(args[0]);
        }
        break;
      }
      case "33":
        onTick(args[0] || []);
        break;
      case "7":
        onAttack(args[0], args[1], args[2]);
        break;
      case "18":
        onProjectile(args[0], args[1], args[2], args[3], args[4]);
        break;
      case "h":
        onHealth(args[0], args[1]);
        break;
      case "11":
        players.forEach(function (p) {
          p.primaryReload = p.secondaryReload = p.pr = p.sr = 1;
        });
        break;
    }
  });

  /* ------------------------------------------------------------------ *
   * Settings, in LemonMod's own menu
   *
   * The fork's toggles lived in its own settings panel, which went with it.
   * These clone the markup LemonMod uses for its checkboxes and sit beside
   * them; if that menu is not there, the features stay on their defaults and
   * `window.__lemonVisuals.settings` still works.
   * ------------------------------------------------------------------ */

  var settings = { reloadBars: true, shameCounter: true, instaMarker: true };

  function remember(name, input) {
    var stored = null;
    try {
      stored = localStorage.getItem("lemonVisuals." + name);
    } catch (e) {}
    if (stored !== null) settings[name] = stored === "1";
    input.checked = settings[name];
    input.addEventListener("change", function () {
      settings[name] = input.checked;
      try {
        localStorage.setItem("lemonVisuals." + name, input.checked ? "1" : "0");
      } catch (e) {}
    });
  }

  function addToggles() {
    if (document.getElementById("reloadBars")) return true;
    var anchor = document.getElementById("radar");
    if (!anchor || !anchor.parentElement || !anchor.parentElement.parentElement) return false;
    var after = anchor.parentElement.parentElement;        // <div><label>…</label></div>

    [["reloadBars", "Reload Bars"], ["shameCounter", "Shame Counter"], ["instaMarker", "Insta Marker"]]
      .forEach(function (pair) {
        var holder = document.createElement("div");
        var label = document.createElement("label");
        label.className = pair[0];
        var input = document.createElement("input");
        input.id = pair[0];
        input.type = "checkbox";
        input.className = "i-checkbox";
        label.appendChild(input);
        label.appendChild(document.createTextNode(pair[1]));
        holder.appendChild(label);
        after.parentElement.insertBefore(holder, after.nextSibling);
        after = holder;
        remember(pair[0], input);
      });
    return true;
  }

  function enabled(name) {
    var input = document.getElementById(name);
    return input ? input.checked : settings[name];
  }

  /* ------------------------------------------------------------------ *
   * Drawing, from inside the bundle's own render pass
   * ------------------------------------------------------------------ */

  function nameOf(p) {
    return (p.team ? "[" + p.team + "] " : "") + (p.name || "");
  }

  /* Nametags are the only text the bundle strokes and then fills at the same
   * spot; chat bubbles are filled only. That is what tells them apart. */
  var lastStroke = null;

  /* Rebuilt once a tick rather than walked per nametag per frame. Two players
   * wearing the same name in the same clan stay unmatched rather than guessed
   * at - they would otherwise wear each other's bars. */
  var signs = null;
  var signsTick = -1;

  function findBySign(text) {
    if (signs === null || signsTick !== tick) {
      signs = new Map();
      players.forEach(function (p) {
        var sign = nameOf(p);
        signs.set(sign, signs.has(sign) ? null : p);
      });
      signsTick = tick;
    }
    return signs.get(text) || null;
  }

  function decorate(text, p) {
    if (!p || p.sid === selfSid || !enabled("shameCounter")) return text;
    if (p.skinIndex === null || p.skinIndex === undefined) return text;
    return text + " <" + (p.clown || 0) + "/7>";
  }

  function barPath(ctx, x, y, w, h, r, roundLeft, roundRight) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    if (r < 0) r = 0;
    ctx.beginPath();
    ctx.moveTo(x + (roundLeft ? r : 0), y);
    if (roundRight) {
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
    } else {
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
    }
    if (roundLeft) {
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
    } else {
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function colourFor(value) {
    return value >= 1 ? RELOADED : value > 0.5 ? HALF_RELOADED : NOT_RELOADED;
  }

  /* Between two ticks the fork slides the bar from where it was to where it is
   * now, over one tick's worth of time. */
  function eased(from, to, since) {
    if (from >= to) return to;
    return from + (to - from) * Math.min(1, since / TICK_MS);
  }

  function drawBars(ctx, p, x, nameY) {
    var top = nameY + 2 * (PLAYER_SCALE + NAME_Y) - BAR_LIFT;
    var since = Date.now() - p.tickAt;
    var width = (HEALTH_BAR_WIDTH * 2) / 2.1;

    ctx.fillStyle = BAR_BACKGROUND;
    barPath(ctx, x - HEALTH_BAR_PAD, top, HEALTH_BAR_WIDTH + 2 * HEALTH_BAR_PAD, BAR_HEIGHT, 8, false, true);
    ctx.fillStyle = BAR_BACKGROUND;
    barPath(ctx, x - HEALTH_BAR_WIDTH - HEALTH_BAR_PAD, top, HEALTH_BAR_WIDTH + 2 * HEALTH_BAR_PAD, BAR_HEIGHT, 8, true, false);

    var secondary = eased(p.sr, p.secondaryReload, since);
    var primary = eased(p.pr, p.primaryReload, since);

    ctx.fillStyle = colourFor(p.secondaryReload);
    barPath(ctx, x + 2.5, top + HEALTH_BAR_PAD, Math.max(0, width * secondary),
      BAR_HEIGHT - 2 * HEALTH_BAR_PAD, 7, true, true);

    ctx.fillStyle = colourFor(p.primaryReload);
    barPath(ctx, x - HEALTH_BAR_WIDTH, top + HEALTH_BAR_PAD, Math.max(0, width * primary),
      BAR_HEIGHT - 2 * HEALTH_BAR_PAD, 7, true, true);
  }

  /* The fork drew a red crosshair PNG over the target; this is the same mark,
   * as strokes, at the same 2.2 * scale it used. */
  function drawInstaMarker(ctx, x, nameY) {
    var centre = nameY + PLAYER_SCALE + NAME_Y;
    var radius = PLAYER_SCALE * 0.8;
    var arm = PLAYER_SCALE * 1.1;
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, centre, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - arm, centre);
    ctx.lineTo(x - radius * 0.45, centre);
    ctx.moveTo(x + radius * 0.45, centre);
    ctx.lineTo(x + arm, centre);
    ctx.moveTo(x, centre - arm);
    ctx.lineTo(x, centre - radius * 0.45);
    ctx.moveTo(x, centre + radius * 0.45);
    ctx.lineTo(x, centre + arm);
    ctx.stroke();
  }

  function instaTarget() {
    if (!enabled("instaMarker")) return null;
    var display = document.getElementById("instaDisplay");
    if (!display || display.innerText !== "ON") return null;
    var match = /(?:^|;\s*)target=([^;]*)/.exec(document.cookie);
    if (!match || match[1] === "none" || match[1] === "") return null;
    return match[1];
  }

  var proto = window.CanvasRenderingContext2D && window.CanvasRenderingContext2D.prototype;
  if (!proto) return;
  var nativeFillText = proto.fillText;
  var nativeStrokeText = proto.strokeText;

  function isGameCanvas(ctx) {
    return ctx.canvas && ctx.canvas.id === "gameCanvas";
  }

  proto.strokeText = function (text, x, y) {
    if (typeof text === "string" && isGameCanvas(this)) {
      lastStroke = { text: text, x: x, y: y };
      var p = findBySign(text);
      if (p) {
        return nativeStrokeText.call(this, decorate(text, p), x, y);
      }
    }
    return nativeStrokeText.apply(this, arguments);
  };

  proto.fillText = function (text, x, y) {
    if (typeof text !== "string" || !isGameCanvas(this)) {
      return nativeFillText.apply(this, arguments);
    }
    var isNameTag = lastStroke !== null && lastStroke.text === text &&
      lastStroke.x === x && lastStroke.y === y;
    lastStroke = null;
    if (!isNameTag) return nativeFillText.apply(this, arguments);

    var p = findBySign(text);
    var result = nativeFillText.call(this, decorate(text, p), x, y);
    if (!p) return result;

    this.save();
    try {
      if (enabled("reloadBars") && p.health > 0) drawBars(this, p, x, y);
      var target = instaTarget();
      if (target !== null && String(p.sid) === String(target)) drawInstaMarker(this, x, y);
    } catch (e) {} finally {
      this.restore();
    }
    return result;
  };

  /* Standing on its own, without LemonMod's menu to sit in: a small panel of
   * its own, in the same corner the game keeps its own counters. */
  function addOwnPanel() {
    if (document.getElementById("reloadBars")) return;
    var panel = document.createElement("div");
    panel.id = "lemonVisualsPanel";
    panel.style.cssText = [
      "position:fixed", "left:10px", "bottom:10px", "z-index:2147483646",
      "background:rgba(0,0,0,.45)", "color:#fff", "padding:8px 10px",
      "border-radius:6px", "font-family:Hammersmith One, sans-serif",
      "font-size:14px", "line-height:1.6", "user-select:none"
    ].join(";");

    var title = document.createElement("div");
    title.textContent = "Visuals";
    title.style.cssText = "opacity:.7;font-size:12px;letter-spacing:1px";
    panel.appendChild(title);

    [["reloadBars", "Reload bars"], ["shameCounter", "Shame counter"], ["instaMarker", "Insta marker"]]
      .forEach(function (pair) {
        var label = document.createElement("label");
        label.style.cssText = "display:block;cursor:pointer";
        var input = document.createElement("input");
        input.id = pair[0];
        input.type = "checkbox";
        input.style.cssText = "margin-right:6px;vertical-align:middle";
        label.appendChild(input);
        label.appendChild(document.createTextNode(pair[1]));
        panel.appendChild(label);
        remember(pair[0], input);
      });

    (document.body || document.documentElement).appendChild(panel);
  }

  /* The mod's menu is built well after the page is, so wait for it - but not
   * forever, and put up our own panel if it never arrives. */
  var attempts = 0;
  var settleToggles = setInterval(function () {
    if (addToggles()) {
      clearInterval(settleToggles);
      return;
    }
    if (++attempts > 20) {
      clearInterval(settleToggles);
      try {
        addOwnPanel();
      } catch (e) {}
    }
  }, 1000);

  window.__lemonVisuals = {
    version: "1.0.0",
    settings: settings,
    players: players,
    /* for tools/verify-lemon.js */
    _internals: {
      onTick: onTick, onAttack: onAttack, onHealth: onHealth, onProjectile: onProjectile,
      player: player, decorate: decorate, findBySign: findBySign, eased: eased,
      colourFor: colourFor,
      state: function () { return { tick: tick, selfSid: selfSid }; }
    }
  };
})();
